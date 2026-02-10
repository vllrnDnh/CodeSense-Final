/**
 * Advanced Type Checker (Semantic Analysis)
 * Validates type compatibility and semantic correctness of C++ code.
 * This is Phase 2 (Logic & Meaning) - Step 1 of the analysis pipeline.
 * 
 * Features:
 * - Comprehensive type checking for 30+ node types
 * - Dead code analysis and usage tracking
 * - Redundant assignment detection
 * - Scope shadowing warnings
 * - Strict return statement enforcement
 * - Advanced type compatibility (pointers, conversions, promotions)
 */

import {
  ASTNode,
  SymbolTable,
  SymbolInfo,
  AnalysisError,
  BinaryOpNode,
  VariableDeclNode,
  AssignmentNode,
  FunctionDeclNode,
  FunctionPrototypeNode,
  WhileLoopNode,
  IfStatementNode,
  ReturnStatementNode,
  ArrayAccessNode,      
  SwitchStatementNode,  
  UnaryOpNode,          
  DoWhileLoopNode,      
  InitializerListNode,  
  GlobalAccessNode,     
  LoopControlNode,
  ForLoopNode,          
  FunctionCallNode,     
  BlockNode,            
  ExpressionStatementNode,
  CaseNode,
  ConditionalExpressionNode,
  CastExpressionNode,
  LambdaExpressionNode,
  SizeofExpressionNode,
  ParameterNode         
} from '../types';

export class TypeChecker {
  // ============================================================================
  // State Management
  // ============================================================================
  private symbolTable: SymbolTable = {};
  private errors: AnalysisError[] = [];
  private currentScope: string = 'global';
  private scopeStack: string[] = ['global'];
  private currentFunction: { name: string, returnType: string } | null = null;
  private functionHasReturn: boolean = false;
  
  // Optimization & Dead Code Analysis
  private usageTracker: Map<string, number> = new Map();
  private dirtyAssignment: Map<string, { line: number, overwritten: boolean }> = new Map();
  
  /**
   * Main entry point for type checking
   */
  check(ast: ASTNode): { symbolTable: SymbolTable; errors: AnalysisError[] } {
    this.symbolTable = {};
    this.errors = [];
    this.usageTracker.clear();
    this.dirtyAssignment.clear();
    this.currentScope = 'global';
    this.scopeStack = ['global'];
    this.currentFunction = null;
    this.functionHasReturn = false;
    
    this.visit(ast);
    this.performDeadCodeAnalysis();
    
    return {
      symbolTable: this.symbolTable,
      errors: this.errors,
    };
  }
  
  /**
   * Visitor pattern dispatcher
   */
  private visit(node: ASTNode | null | string | undefined): string | null {
    if (!node) return null;
    
    if (typeof node === 'string') {
        return this.visitIdentifier({ type: 'Identifier', name: node } as any);
    }

    // Wrap node.type in String() to prevent the Symbol-to-String runtime crash
    const typeStr = String(node.type);
    const methodName = `visit${typeStr}` as keyof this;

    if (typeof this[methodName] === 'function') {
      return (this[methodName] as any).call(this, node);
    }
    
    return null;
  }
  
  /**
   * Visit Program node
   */
  private visitProgram(node: ASTNode): string | null {
    const programNode = node as any;
    programNode.body.forEach((stmt: ASTNode) => this.visit(stmt));
    return null;
  }

  // ============================================================================
  // Structural Wrappers
  // ============================================================================

  private visitBlock(node: ASTNode): string | null {
    const blockNode = node as BlockNode;
    this.enterScope('block'); 
    blockNode.statements.forEach((stmt: ASTNode) => this.visit(stmt));
    this.exitScope();
    return null;
  }

  private visitExpressionStatement(node: ASTNode): string | null {
    const exprNode = node as ExpressionStatementNode;
    return this.visit(exprNode.expression);
  }

  // ============================================================================
  // Function Declarations & Prototypes
  // ============================================================================
  
  /**
   * Visit Function Prototype (forward declaration)
   */
  private visitFunctionPrototype(node: ASTNode): string | null {
    const protoNode = node as FunctionPrototypeNode;
    
    // Register prototype as a special symbol (not fully defined)
    this.addSymbol(
      protoNode.name,
      protoNode.returnType,
      protoNode.line || 0,
      true, // Prototypes are "initialized" (declared)
      undefined,
      false // isDefined = false (only declared, not defined)
    );
    
    return protoNode.returnType;
  }
  
  /**
   * Visit Function Declaration (full definition)
   */
  private visitFunctionDecl(node: ASTNode): string | null {
    const funcNode = node as FunctionDeclNode;
    
    // 1. Register or update function symbol
    const existingSymbol = this.symbolTable[`${this.currentScope}::${funcNode.name}`];
    
    if (existingSymbol) {
      // Check if already defined (not just prototyped)
      if (existingSymbol.isDefined) {
        this.addError(node, `Function '${funcNode.name}' already defined`, 'error');
        return funcNode.returnType;
      }
      // Prototype exists, check compatibility
      if (existingSymbol.type !== funcNode.returnType) {
        this.addError(
          node,
          `Function definition '${funcNode.name}' return type '${funcNode.returnType}' does not match prototype '${existingSymbol.type}'`,
          'error'
        );
      }
      // Upgrade prototype to definition
      existingSymbol.isDefined = true;
    } else {
      // New function definition
      this.addSymbol(
        funcNode.name,
        funcNode.returnType,
        funcNode.line || 0,
        true,
        undefined,
        true // isDefined = true (full definition)
      );
    }
    
    // 2. Set context for return statement validation
    this.currentFunction = { 
        name: funcNode.name, 
        returnType: funcNode.returnType 
    };
    this.functionHasReturn = false;
    
    this.enterScope(funcNode.name);
    
    // 3. Register Parameters in the new scope
    // 3. Register Parameters in the new scope
funcNode.params.forEach((param: ParameterNode) => {
    // Validate that function definitions have named parameters
    if (!param.name) {
        this.addError(
            node,
            `Function definition '${funcNode.name}' cannot have unnamed parameters. Only prototypes allow unnamed parameters.`,
            'error'
        );
        return; // Skip this parameter
    }
    
    this.addSymbol(
        param.name, 
        param.varType, 
        param.line || 0, 
        true,
        undefined,
        true
    );
});
    
    // 4. Visit the body to analyze local variables and logic
    funcNode.body.forEach((stmt: ASTNode) => this.visit(stmt));
    
    // 5. STRICT ENFORCEMENT: Check for return statement violations
    if (funcNode.name === 'main') {
        // Enforce int return type for main
        if (funcNode.returnType !== 'int') {
            this.addError(node, "Strict Error: 'main' function must return 'int'", 'error');
        }
        // Enforce explicit return for main in strict mode
        if (!this.functionHasReturn) {
            this.addError(node, "Strict Error: 'main' function must explicitly 'return 0;'", 'error');
        }
    } else if (funcNode.returnType !== 'void' && !this.functionHasReturn) {
        // Convert warning to error for all non-void functions
        this.addError(
            node, 
            `Strict Error: Function '${funcNode.name}' with return type '${funcNode.returnType}' must return a value`,
            'error' 
        );
    }
    
    this.exitScope();
    this.currentFunction = null;
    this.functionHasReturn = false;
    
    return funcNode.returnType;
  }
  
  // ============================================================================
  // Variable Declarations
  // ============================================================================
  
  /**
   * Visit Variable Declaration
   */
  private visitVariableDecl(node: ASTNode): string | null {
    const varNode = node as VariableDeclNode;
    const scopedName = `${this.currentScope}::${varNode.name}`;
    
    if (this.symbolTable[scopedName]) {
      this.addError(node, `Variable '${varNode.name}' already declared in this scope`);
    }

    const initialized = varNode.value !== null && varNode.value !== undefined;
    
    let dimensions: number[] | undefined = undefined;
    if (varNode.dimensions && varNode.dimensions.length > 0) {
        dimensions = varNode.dimensions.map((dim: ASTNode) => {
            const dimNode = dim as any; 
            return (dimNode.type === 'Integer') ? dimNode.value : 0; 
        });
    }

    this.addSymbol(
      varNode.name, 
      varNode.varType, 
      varNode.line || 0, 
      initialized, 
      dimensions,
      true
    );

    // Track initialization as a write
    if (initialized) {
      this.markWrite(varNode.name, varNode.line || 0);
      const valueType = this.visit(varNode.value);
      if (valueType && !dimensions && !this.isTypeCompatible(varNode.varType, valueType, varNode.value)) {
        this.addError(node, `Type mismatch: cannot assign ${valueType} to ${varNode.varType}`);
      }
    }
    
    return varNode.varType;
  }
  
  /**
   * Visit Array Access
   */
  private visitArrayAccess(node: ASTNode): string | null {
    const arrayNode = node as ArrayAccessNode;
    const symbol = this.lookupSymbol(arrayNode.name);

    if (!symbol) {
      this.addError(node, `Undeclared array '${arrayNode.name}'`);
      return null;
    }

    // Mark array as read (accessing elements)
    this.markRead(arrayNode.name);

    arrayNode.indices.forEach((indexNode: ASTNode) => {
      const indexType = this.visit(indexNode);
      if (indexType !== 'int') {
        this.addError(indexNode, `Array index must be an integer, got ${indexType}`);
      }
    });
    return symbol.type;
  }

  private visitInitializerList(node: ASTNode): string | null {
    const initList = node as InitializerListNode;
    let detectedType: string | null = null;

    for (const val of initList.values) {
      const type = this.visit(val);
      if (!detectedType) {
        detectedType = type;
      } else if (type && !this.isTypeCompatible(detectedType, type)) {
        this.addError(node, `Inconsistent types in initializer list: ${detectedType} and ${type}`);
      }
    }
    return detectedType; 
  }

  // ============================================================================
  // Loops & Control Flow
  // ============================================================================

  private visitWhileLoop(node: ASTNode): string | null {
    const whileNode = node as WhileLoopNode;
    const condType = this.visit(whileNode.condition);
    if (condType && !this.isContextuallyConvertibleToBool(condType)) {
      this.addError(whileNode.condition, `While condition must be boolean or convertible, got ${condType}`);
    }
    
    this.enterScope('while');
    whileNode.body.forEach((stmt: ASTNode) => this.visit(stmt));
    this.exitScope();
    return null;
  }

  private visitDoWhileLoop(node: ASTNode): string | null {
    const doWhileNode = node as DoWhileLoopNode;

    this.enterScope('do-while');
    doWhileNode.body.forEach((stmt: ASTNode) => this.visit(stmt));
    this.exitScope();

    const condType = this.visit(doWhileNode.condition);
    if (condType && !this.isContextuallyConvertibleToBool(condType)) {
      this.addError(doWhileNode.condition, `Do-while condition must be boolean or convertible, got ${condType}`);
    }
    return null;
  }

  /**
   * Visit For Loop
   */
  private visitForLoop(node: ASTNode): string | null {
    const forNode = node as ForLoopNode;

    this.enterScope('for');

    // Visit init (e.g., int i = 0)
    if (forNode.init) {
      this.visit(forNode.init);
    }

    // Visit condition (e.g., i < 10)
    if (forNode.condition) {
      const condType = this.visit(forNode.condition);
      if (condType && !this.isContextuallyConvertibleToBool(condType)) {
        this.addError(forNode.condition, `For loop condition must be boolean or convertible, got ${condType}`);
      }
    }

    // Visit update (e.g., i++)
    if (forNode.update) {
      this.visit(forNode.update);
    }

    // Visit body
    forNode.body.forEach((stmt: ASTNode) => this.visit(stmt));

    this.exitScope();
    return null;
  }

  /**
   * Visit Switch Statement
   */
  private visitSwitchStatement(node: ASTNode): string | null {
    const switchNode = node as SwitchStatementNode;

    // Check the condition type
    const condType = this.visit(switchNode.condition);
    if (condType && !['int', 'char'].includes(condType)) {
      this.addError(switchNode.condition, `Switch condition must be int or char, got ${condType}`);
    }

    this.enterScope('switch');

    // Visit all cases
    switchNode.cases.forEach((caseNode: CaseNode) => {
      this.visit(caseNode as unknown as ASTNode);
    });

    this.exitScope();
    return null;
  }

  /**
   * Visit Case Node (case or default in switch)
   */
  private visitCase(node: ASTNode): string | null {
    const caseNode = node as unknown as CaseNode;

    // Visit case value if it exists
    if (caseNode.value) {
      this.visit(caseNode.value);
    }

    // Visit statements in this case
    caseNode.statements.forEach((stmt: ASTNode) => this.visit(stmt));

    return null;
  }

  /**
   * Visit Default Case
   */
  private visitDefaultCase(node: ASTNode): string | null {
    return this.visitCase(node);
  }

  /**
   * Visit If Statement with contextual boolean conversion
   */
  private visitIfStatement(node: ASTNode): string | null {
    const ifNode = node as IfStatementNode;
    const condType = this.visit(ifNode.condition);

    if (condType && !this.isContextuallyConvertibleToBool(condType)) {
      this.addError(ifNode.condition, `Condition must be boolean or convertible, got ${condType}`);
    }

    this.enterScope('if');
    ifNode.thenBranch.forEach((stmt: ASTNode) => this.visit(stmt));
    this.exitScope();
    
    if (ifNode.elseBranch) {
      this.enterScope('else');
      ifNode.elseBranch.forEach((stmt: ASTNode) => this.visit(stmt));
      this.exitScope();
    }
    return null;
  }

  /**
   * Visit Loop Control (break/continue)
   */
  private visitLoopControl(node: ASTNode): string | null {
    // Cast to the specific type to silence the unused import warning
    const controlNode = node as LoopControlNode; 
    
    // Loop control (break/continue) has no type value to check
    return null;
  }

  /**
   * Visit Global Access (::variable)
   */
  private visitGlobalAccess(node: ASTNode): string | null {
    const globalNode = node as GlobalAccessNode;
    const scopedName = `global::${globalNode.name}`;
    const symbol = this.symbolTable[scopedName];

    if (!symbol) {
      this.addError(node, `Undeclared global variable '${globalNode.name}'`);
      return null;
    }

    if (!symbol.initialized) {
      this.addError(node, `Global variable '${globalNode.name}' used before initialization`, 'warning');
    }

    // Track global access as a read
    this.markRead(globalNode.name);

    return symbol.type;
  }

  // ============================================================================
  // Function Calls
  // ============================================================================

  /**
   * Visit Function Call with usage tracking
   */
  private visitFunctionCall(node: ASTNode): string | null {
    const callNode = node as FunctionCallNode;

    // Track function usage
    this.markRead(callNode.name);

    // Visit all arguments to check their types
    if (callNode.arguments) {
      callNode.arguments.forEach((arg: ASTNode) => this.visit(arg));
    }

    // Look up function symbol to get return type
    const symbol = this.lookupSymbol(callNode.name);
    if (symbol) {
      return symbol.type; // Return the function's return type
    }

    // If function not found, return 'unknown'
    return 'unknown';
  }

  // ============================================================================
  // Unary Operators
  // ============================================================================

  /**
   * Visit Unary Operations (++, --, &, *, etc.)
   */
  private visitPreIncrement(node: ASTNode): string | null {
    return this.visitUnaryOp(node);
  }

  private visitPostIncrement(node: ASTNode): string | null {
    return this.visitUnaryOp(node);
  }

  private visitPreDecrement(node: ASTNode): string | null {
    return this.visitUnaryOp(node);
  }

  private visitPostDecrement(node: ASTNode): string | null {
    return this.visitUnaryOp(node);
  }

  private visitAddressOf(node: ASTNode): string | null {
    return this.visitUnaryOp(node);
  }

  private visitDereference(node: ASTNode): string | null {
    return this.visitUnaryOp(node);
  }

  /**
   * Unified unary operator handler with usage tracking
   */
  private visitUnaryOp(node: ASTNode): string | null {
    const unaryNode = node as UnaryOpNode;

    // Get variable name
    let varName = '';
    if (typeof unaryNode.operand === 'string') {
      varName = unaryNode.operand;
    } else if ((unaryNode.operand as any).name) {
      varName = (unaryNode.operand as any).name;
    }

    // Look up the variable
    const symbol = this.lookupSymbol(varName);
    if (!symbol) {
      this.addError(node, `Undeclared variable '${varName}'`);
      return null;
    }

    // Track usage: increment/decrement is both read and write
    if (node.type.includes('Increment') || node.type.includes('Decrement')) {
      this.markRead(varName); // Read the current value
      this.markWrite(varName, (node as any).line || 0); // Write new value
      
      if (!this.isNumericType(symbol.type)) {
        this.addError(node, `Cannot apply ${node.type} to non-numeric type ${symbol.type}`);
      }
    } else {
      // Address-of and dereference are reads
      this.markRead(varName);
    }

    return symbol.type;
  }

  // ============================================================================
  // Advanced Expressions
  // ============================================================================

  /**
   * Visit Conditional Expression (ternary operator: a ? b : c)
   */
  private visitConditionalExpression(node: ASTNode): string | null {
    const ternaryNode = node as ConditionalExpressionNode;

    // Check condition is boolean
    const condType = this.visit(ternaryNode.condition);
    if (condType && !this.isContextuallyConvertibleToBool(condType)) {
      this.addError(ternaryNode.condition, `Ternary condition must be boolean or convertible, got ${condType}`);
    }

    // Check both branches
    const trueType = this.visit(ternaryNode.trueExpression);
    const falseType = this.visit(ternaryNode.falseExpression);

    // Return the promoted type
    if (trueType && falseType) {
      if (this.isTypeCompatible(trueType, falseType)) {
        return trueType;
      } else if (this.isTypeCompatible(falseType, trueType)) {
        return falseType;
      } else {
        this.addError(node, `Ternary branches have incompatible types: ${trueType} and ${falseType}`);
        return trueType; // Return first type as fallback
      }
    }

    return trueType || falseType;
  }

  /**
   * Visit Cast Expression
   */
  private visitCastExpression(node: ASTNode): string | null {
    const castNode = node as CastExpressionNode;

    // Visit the operand to check it's valid
    this.visit(castNode.operand);

    // Return the target type
    return castNode.targetType;
  }

  /**
   * Visit Sizeof Expression
   */
  private visitSizeofExpression(node: ASTNode): string | null {
    const sizeofNode = node as SizeofExpressionNode;

    // Visit the value to check it's valid
    this.visit(sizeofNode.value);

    // sizeof always returns size_t (we'll use int for simplicity)
    return 'int';
  }

  /**
   * Visit Lambda Expression
   */
  private visitLambdaExpression(node: ASTNode): string | null {
    const lambdaNode = node as LambdaExpressionNode;

    this.enterScope('lambda');

    // Visit lambda body
    lambdaNode.body.forEach((stmt: ASTNode) => this.visit(stmt));

    this.exitScope();

    // Return a generic function type
    return 'lambda';
  }

  // ============================================================================
  // Expressions & Literals
  // ============================================================================

  /**
   * Visit Assignment with redundant assignment detection
   */
  private visitAssignment(node: ASTNode): string | null {
    const assignNode = node as AssignmentNode;
    let targetType: string | null = null;
    let targetName = '';

    // Case 1: Simple Assignment (x = 5)
    if (typeof assignNode.target === 'string') {
        targetName = assignNode.target;
        const symbol = this.lookupSymbol(targetName);
        if (!symbol) {
            this.addError(node, `Undeclared variable '${targetName}'`);
            return null;
        }
        
        // Track usage: compound operators (+=, -=, etc.) read then write
        if (assignNode.operator !== '=') {
            this.markRead(targetName); // Read current value
            if (!symbol.initialized) {
                this.addError(node, `Variable '${targetName}' used (via ${assignNode.operator}) before initialization`, 'warning');
            }
        }
        
        // Mark symbol as initialized
        symbol.initialized = true;
        targetType = symbol.type;
    } 
    // Case 2: Array/Pointer Assignment (arr[5] = 10)
    else {
        // Visit the target (ArrayAccess) to validate indices and get the underlying type
        targetType = this.visit(assignNode.target);
        // Extract name for array access tracking
        if ((assignNode.target as any).name) {
          targetName = (assignNode.target as any).name;
        }
    }

    // Process RHS (Value)
    const valueType = this.visit(assignNode.value);
    
    // Track the write after evaluating the RHS
    if (targetName) {
      this.markWrite(targetName, (assignNode as any).line || 0);
    }
    
    // Compatibility Check
    if (targetType && valueType && !this.isTypeCompatible(targetType, valueType, assignNode.value)) {
      this.addError(
        node,
        `Type mismatch: cannot assign ${valueType} to ${targetType}`
      );
    }
    return targetType;
  }
  
  private visitBinaryOp(node: ASTNode): string | null {
    const binOp = node as BinaryOpNode;
    const leftType = this.visit(binOp.left);
    const rightType = this.visit(binOp.right);
    
    if (!leftType || !rightType) return null;
    
    if (['+', '-', '*', '/', '%'].includes(binOp.operator)) {
      if (!this.isNumericType(leftType) || !this.isNumericType(rightType)) {
        this.addError(node, `Arithmetic operator '${binOp.operator}' requires numeric operands`);
      }
      return this.promoteType(leftType, rightType);
    }
    
    if (['<', '>', '<=', '>=', '==', '!='].includes(binOp.operator)) {
      if (!this.isComparable(leftType, rightType)) {
        this.addError(node, `Cannot compare ${leftType} with ${rightType}`);
      }
      return 'bool';
    }
    
    if (['&&', '||'].includes(binOp.operator)) {
      if (!this.isContextuallyConvertibleToBool(leftType) || !this.isContextuallyConvertibleToBool(rightType)) {
        this.addError(node, `Logical operator '${binOp.operator}' requires boolean or convertible operands`);
      }
      return 'bool';
    }
    return null;
  }
  
  /**
   * Visit Identifier with usage tracking
   */
  private visitIdentifier(node: ASTNode): string | null {
    const name = (node as any).name;

    // Keywords 'true' and 'false' should NEVER reach lookupSymbol
    if (name === 'true' || name === 'false') return 'bool';

    const symbol = this.lookupSymbol(name);
    
    if (!symbol) {
      this.addError(node, `Undeclared variable '${name}'`);
      return null;
    }
    
    if (!symbol.initialized) {
      this.addError(node, `Variable '${name}' used before initialization`, 'warning');
    }
    
    // Track usage (read)
    this.markRead(name);
    
    return symbol.type;
  }

  /**
   * Visit Return Statement with strict enforcement
   */
  private visitReturnStatement(node: ASTNode): string | null {
    const retNode = node as ReturnStatementNode;
    const actualType = retNode.value ? this.visit(retNode.value) : 'void';

    this.functionHasReturn = true;

    if (this.currentFunction) {
      const expectedType = this.currentFunction.returnType;
      if (actualType && !this.isTypeCompatible(expectedType, actualType)) {
        this.addError(
          node,
          `Mismatched return type: function expects ${expectedType} but got ${actualType}`,
          'error' 
        );
      }
    }
    return actualType;
  }

  // Literals - synchronized with PEG.js node names
  private visitInteger(node: any): string { return 'int'; }
  private visitFloat(node: any): string { return 'float'; }
  private visitChar(node: any): string { return 'char'; }
  private visitString(node: any): string { return 'string'; }

  // Handle boolean literals (Lexer 'Literal' tokens) 
  private visitLiteral(node: any): string {
    const val = String(node.value);
    if (val === 'true' || val === 'false') return 'bool';
    return val.includes('.') ? 'float' : 'int';
  }

  // ============================================================================
  // Stream I/O Wrappers
  // ============================================================================

  /**
   * Visit Cin Statement with chained input support
   */
  private visitCinStatement(node: ASTNode): string | null {
      const cinNode = node as any;
      
      // Handle chained cin (cin >> x >> y >> arr[i])
      if (cinNode.targets && Array.isArray(cinNode.targets)) {
          cinNode.targets.forEach((target: string | ASTNode) => {
              if (typeof target === 'string') {
                  // Simple identifier: cin >> x
                  const symbol = this.lookupSymbol(target);
                  if (symbol) {
                      symbol.initialized = true; // Mark as initialized after input
                      this.markWrite(target, (cinNode as any).line || 0);
                  } else {
                      this.addError(node, `Undeclared variable '${target}' in cin statement`);
                  }
              } else if (target.type === 'ArrayAccess') {
                  // Array element: cin >> arr[i]
                  const arrayAccess = target as any;
                  const symbol = this.lookupSymbol(arrayAccess.name);
                  if (!symbol) {
                      this.addError(node, `Undeclared array '${arrayAccess.name}' in cin statement`);
                  } else {
                      this.markWrite(arrayAccess.name, (cinNode as any).line || 0);
                  }
                  // Validate array indices
                  arrayAccess.indices?.forEach((idx: ASTNode) => {
                      const idxType = this.visit(idx);
                      if (idxType && idxType !== 'int') {
                          this.addError(idx, `Array index must be integer, got ${idxType}`);
                      }
                  });
              }
          });
      } 
      // LEGACY: Handle old single-target format (backward compatibility)
      else if (cinNode.target) {
          const symbol = this.lookupSymbol(cinNode.target);
          if (symbol) {
              symbol.initialized = true;
              this.markWrite(cinNode.target, (cinNode as any).line || 0);
          }
      }
      
      return null;
  }

  /**
   * Visit Cout Statement with chained output support
   */
  private visitCoutStatement(node: ASTNode): string | null {
      const coutNode = node as any;
      
      // Handle chained cout (cout << x << y << "text")
      if (coutNode.values && Array.isArray(coutNode.values)) {
          coutNode.values.forEach((expr: ASTNode) => {
              this.visit(expr); // Validate each expression in the chain
          });
      }
      // LEGACY: Handle old single-value format (backward compatibility)
      else if (coutNode.value) {
          this.visit(coutNode.value);
      }
      
      return null;
  }
  
  // ============================================================================
  // Preprocessor Directive Handlers
  // ============================================================================

  private visitInclude(node: any): string | null {
      // Validation: Check if included file exists (warning only, not error)
      if (node.name && !node.name.match(/^(iostream|string|vector|cmath|algorithm|iomanip|cstdio|cstdlib|cstring|fstream)$/)) {
          this.addError(node, `Include file '${node.name}' may not exist`, 'warning');
      }
      return null;
  }

  private visitDefine(node: any): string | null {
      // Track macro definitions (could be used for constant folding later)
      if (node.value) {
          this.visit(node.value);
      }
      return null;
  }

  private visitUndef(node: any): string | null {
      // Remove macro definition (no-op for now)
      return null;
  }

  private visitIfDef(node: any): string | null {
      // Conditional compilation check
      return null;
  }

  private visitIfNDef(node: any): string | null {
      // Inverse conditional compilation check
      return null;
  }

  private visitIf(node: any): string | null {
      // Preprocessor if with condition
      if (node.condition) {
          this.visit(node.condition);
      }
      return null;
  }

  private visitElIf(node: any): string | null {
      // Preprocessor elif
      if (node.condition) {
          this.visit(node.condition);
      }
      return null;
  }

  private visitElse(node: any): string | null {
      // Preprocessor else (no-op)
      return null;
  }

  private visitEndIf(node: any): string | null {
      // End conditional block (no-op)
      return null;
  }

  private visitPragma(node: any): string | null {
      // Compiler-specific directives (validated but not enforced)
      if (node.directive?.type === 'PragmaGeneric') {
          // Could warn about unknown pragmas
      }
      return null;
  }

  private visitError(node: any): string | null {
      // #error directive - treat as error
      this.addError(node, `Preprocessor error: ${node.message}`, 'error');
      return null;
  }

  private visitWarning(node: any): string | null {
      // #warning directive - treat as warning
      this.addError(node, `Preprocessor warning: ${node.message}`, 'warning');
      return null;
  }

  private visitLine(node: any): string | null {
      // Line number directive (no-op for semantic analysis)
      return null;
  }

  private visitDefined(node: any): string | null {
      // defined() operator in preprocessor conditions
      return 'bool';
  }

  private visitMacroText(node: any): string | null {
      // Raw macro text (no type checking)
      return 'unknown';
  }

  private visitNamespace(node: any): string | null {
      // using namespace directive (no-op for basic analysis)
      return null;
  }

  // ============================================================================
  // Optimization & Dead Code Analysis
  // ============================================================================

  /**
   * Mark a variable as written to (detects redundant assignments)
   */
  private markWrite(name: string, line: number): void {
    const fullName = this.getFullyScopedName(name);
    if (!fullName) return;

    // If there's already a 'dirty' write that hasn't been read...
    if (this.dirtyAssignment.has(fullName)) {
        const prevAssignment = this.dirtyAssignment.get(fullName);
        this.addError(
            { line } as any, 
            `Redundant Assignment: The previous value assigned to '${name}' on line ${prevAssignment?.line} was never used and has been overwritten.`, 
            'warning'
        );
    }
    
    this.dirtyAssignment.set(fullName, { line, overwritten: true });
  }

  /**
   * Mark a variable as read (clears redundant assignment flag)
   */
  private markRead(name: string): void {
    const fullName = this.getFullyScopedName(name);
    if (!fullName) return;
    
    // Value was used - clear dirty flag
    this.dirtyAssignment.delete(fullName);
    
    // Track usage count
    const count = this.usageTracker.get(fullName) || 0;
    this.usageTracker.set(fullName, count + 1);
  }

  /**
   * Perform dead code analysis after visiting entire AST
   */
  private performDeadCodeAnalysis(): void {
    Object.keys(this.symbolTable).forEach(fullName => {
      const symbol = this.symbolTable[fullName];
      
      // Skip main function
      if (symbol.name === 'main') return;
      
      // Check for unused variables and functions
      const usageCount = this.usageTracker.get(fullName) || 0;
      if (usageCount === 0) {
        const entityType = symbol.isDefined !== undefined 
          ? (symbol.isDefined ? 'Function' : 'Function Prototype') 
          : 'Variable';
        
        this.addError(
          { line: symbol.line } as any, 
          `Unused ${entityType}: '${symbol.name}' is declared but never used`,
          'warning'
        );
      }
    });
  }

  /**
   * Get fully scoped name for a variable (searches up scope chain)
   */
  private getFullyScopedName(name: string): string | null {
    for (let i = this.scopeStack.length - 1; i >= 0; i--) {
      const scope = this.scopeStack.slice(0, i + 1).join('::');
      const scopedName = `${scope}::${name}`;
      if (this.symbolTable[scopedName]) {
        return scopedName;
      }
    }
    return null;
  }
  
  // ============================================================================
  // Scope Management Helpers
  // ============================================================================
  
  private enterScope(name: string): void {
    this.scopeStack.push(name);
    this.currentScope = this.scopeStack.join('::');
  }
  
  private exitScope(): void {
    this.scopeStack.pop();
    this.currentScope = this.scopeStack.join('::');
  }
  
  /**
   * Add symbol to symbol table with comprehensive validation
   */
  private addSymbol(
    name: string, 
    type: string, 
    line: number, 
    initialized: boolean, 
    dimensions?: number[],
    isDefined: boolean = true
  ): void {
    // Keyword protection
    if (name === 'true' || name === 'false') {
        this.addError(
            { line } as any, 
            `Cannot use reserved keyword '${name}' as an identifier`
        );
        return;
    }

    const scopedName = `${this.currentScope}::${name}`;

    // Redeclaration check
    if (this.symbolTable[scopedName]) {
        const existing = this.symbolTable[scopedName];
        
        // Allow prototype followed by definition
        if (existing.isDefined === false && isDefined) {
            // Upgrade prototype to definition
            existing.isDefined = true;
            return;
        }
        
        // Otherwise, it's a redeclaration error
        this.addError(
            { line, type: 'VariableDecl' } as any, 
            `${isDefined ? 'Redefinition' : 'Redeclaration'} of '${name}' (previously declared on line ${existing.line})`
        );
        return; 
    }

    // Scope shadowing check (parent scopes)
    for (let i = this.scopeStack.length - 2; i >= 0; i--) {
      const parentScope = this.scopeStack.slice(0, i + 1).join('::');
      const parentScopedName = `${parentScope}::${name}`;
      if (this.symbolTable[parentScopedName]) {
        this.addError(
          { line, type: 'VariableDecl' } as any,
          `Variable '${name}' shadows declaration from outer scope (line ${this.symbolTable[parentScopedName].line})`,
          'error'
        );
        break; // Only report the closest shadowed variable
      }
    }

    // Symbol registration
    this.symbolTable[scopedName] = { 
        name, 
        type, 
        line, 
        scope: this.currentScope, 
        initialized,
        dimensions,
        isDefined
    };
  }

  /**
   * Look up symbol in current scope and parent scopes
   */
  private lookupSymbol(name: string): SymbolInfo | null {
    for (let i = this.scopeStack.length - 1; i >= 0; i--) {
      const scope = this.scopeStack.slice(0, i + 1).join('::');
      const scopedName = `${scope}::${name}`;
      if (this.symbolTable[scopedName]) {
        return this.symbolTable[scopedName];
      }
    }
    return null;
  }
  
  // ============================================================================
  // Type Compatibility & Conversion Helpers
  // ============================================================================
  
  /**
   * Check if source type can be assigned to target type
   */
  private isTypeCompatible(target: string, source: string, sourceNode?: any): boolean {
    if (target === source) return true;
    if (target === 'unknown' || source === 'unknown') return true;

    // 1. Pointer Logic
    if (target.endsWith('*')) {
      if (source === 'nullptr_t') return true;
      // Check for literal 0 constant
      if (source === 'int' && sourceNode?.type === 'Integer' && sourceNode.value === 0) return true;
      // Pointer to void* is generally allowed in many contexts, but void* to T* is not
      if (target === 'void*' && source.endsWith('*')) return true;
    }

    // 2. Boolean Truthiness (Contextual conversion to bool)
    if (target === 'bool') {
      return this.isContextuallyConvertibleToBool(source);
    }

    // 3. Widening Conversions (Safe)
    const numericWeight: Record<string, number> = { 
      'char': 1, 
      'int': 2, 
      'long': 2.5,
      'float': 3, 
      'double': 4 
    };
    
    if (numericWeight[target] && numericWeight[source]) {
      // Only return true if target is "wider" than or equal to source
      return numericWeight[target] >= numericWeight[source];
    }

    // 4. Narrowing (Unsafe) - explicitly disallow
    if (target === 'int' && (source === 'float' || source === 'double')) {
      return false; 
    }

    return false;
  }

  /**
   * Check if a type can be contextually converted to bool (C++ standard)
   */
  private isContextuallyConvertibleToBool(type: string): boolean {
    // Core types allowed via standard boolean conversion
    if (['bool', 'int', 'char', 'long', 'short', 'float', 'double'].includes(type)) {
      return true;
    }

    // Pointers (including nullptr_t if you model it)
    if (type.endsWith('*') || type === 'nullptr_t') {
      return true;
    }

    // Unscoped enum (if you model enum as e.g. "enum:Color" or just "int" underlying)
    if (type.startsWith('enum:')) {
      return true;
    }

    // User-defined types with explicit operator bool()
    // For a real checker you'd look up the type definition and check for
    // explicit operator bool() const
    // For now, reject all unknown types (strict but simple)
    return false;
  }

  /**
   * Check if a type is numeric
   */
  private isNumericType(type: string): boolean {
    return ['int', 'float', 'double', 'char', 'long', 'short'].includes(type);
  }
  
  /**
   * Check if two types can be compared
   */
  private isComparable(left: string, right: string): boolean {
    // Numeric types can be compared
    if (this.isNumericType(left) && this.isNumericType(right)) return true;
    
    // Same types can be compared (including pointers)
    if (left === right) return true;
    
    // Pointers can be compared with nullptr
    if ((left.endsWith('*') && right === 'nullptr_t') || 
        (right.endsWith('*') && left === 'nullptr_t')) return true;
    
    return false;
  }
  
  /**
   * Promote types for binary operations (widening)
   */
  private promoteType(left: string, right: string): string {
    if (left === 'double' || right === 'double') return 'double';
    if (left === 'float' || right === 'float') return 'float';
    if (left === 'long' || right === 'long') return 'long';
    return 'int';
  }
  
  /**
   * Add error to error list
   */
  private addError(node: any, message: string, severity: 'error' | 'warning' = 'error'): void {
    this.errors.push({
      type: 'semantic',
      message: message,
      line: node?.line || node?.location?.start?.line || 0,
      column: node?.column || node?.location?.start?.column || 0,
      severity: severity,
    });
  }
}