/**
 * Type Checker (Semantic Analysis)
 * Validates type compatibility and semantic correctness of C++ code.
 * This is Phase 2 (Logic & Meaning) - Step 1 of the analysis pipeline.
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
  private symbolTable: SymbolTable = {};
  private errors: AnalysisError[] = [];
  private currentScope: string = 'global';
  private scopeStack: string[] = ['global'];
  private currentFunction: { name: string, returnType: string } | null = null;
  private functionHasReturn: boolean = false;
  
  /**
   * Main entry point for type checking
   */
  check(ast: ASTNode): { symbolTable: SymbolTable; errors: AnalysisError[] } {
    this.symbolTable = {};
    this.errors = [];
    this.currentScope = 'global';
    this.scopeStack = ['global'];
    
    this.visit(ast);
    
    return {
      symbolTable: this.symbolTable,
      errors: this.errors,
    };
  }
  
  /**
   * Visitor pattern dispatcher
   */
  private visit(node: ASTNode | null | string): string | null {
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
  
  /**
   * Visit Function Declaration
   */
  private visitFunctionDecl(node: ASTNode): string | null {
    const funcNode = node as FunctionDeclNode;
    
    // 1. Set context for return statement validation
    this.currentFunction = { 
        name: funcNode.name, 
        returnType: funcNode.returnType 
    };
    this.functionHasReturn = false;
    
    this.enterScope(funcNode.name);
    
    // 2. Register Parameters in the new scope
    funcNode.params.forEach((param: ParameterNode) => {
        this.addSymbol(
            param.name, 
            param.varType, 
            param.line || 0, 
            true // Parameters are considered initialized by the caller
        );
    });
    
    // 3. Visit the body to analyze local variables and logic
    funcNode.body.forEach((stmt: ASTNode) => this.visit(stmt));
    
    // 4. STRICT ENFORCEMENT: Check for return statement violations
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

    this.addSymbol(varNode.name, varNode.varType, varNode.line || 0, initialized, dimensions);

    if (varNode.value) {
      const valueType = this.visit(varNode.value);
      if (valueType && !dimensions && !this.isTypeCompatible(varNode.varType, valueType)) {
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
    if (condType && condType !== 'bool') {
      this.addError(whileNode.condition, `While condition must be boolean, got ${condType}`);
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
    if (condType && condType !== 'bool') {
      this.addError(doWhileNode.condition, `Do-while condition must be boolean, got ${condType}`);
    }
    return null;
  }

  /**
   * Visit For Loop
   * FIX: Added missing visitor
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
      if (condType && condType !== 'bool') {
        this.addError(forNode.condition, `For loop condition must be boolean, got ${condType}`);
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
   * FIX: Added missing visitor
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
   * FIX: Added missing visitor
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
   * FIX: Added missing visitor
   */
  private visitDefaultCase(node: ASTNode): string | null {
    return this.visitCase(node);
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
   * FIX: Added missing visitor
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

    return symbol.type;
  }

  // ============================================================================
  // Function Calls
  // ============================================================================

  /**
   * Visit Function Call
   * FIX: Added missing visitor
   */
  private visitFunctionCall(node: ASTNode): string | null {
    const callNode = node as FunctionCallNode;

    // Visit all arguments to check their types
    if (callNode.arguments) {
      callNode.arguments.forEach((arg: ASTNode) => this.visit(arg));
    }

    // We return 'unknown' since we don't have function signature tracking yet
    // In a full implementation, we'd look up the function and check parameter types
    return 'unknown';
  }

  // ============================================================================
  // Unary Operators
  // ============================================================================

  /**
   * Visit Unary Operations (++, --, &, *, etc.)
   * FIX: Added missing visitors for all unary types
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
   * Unified unary operator handler
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

    // For increment/decrement, check that it's numeric
    if (node.type.includes('Increment') || node.type.includes('Decrement')) {
      if (!this.isNumericType(symbol.type)) {
        this.addError(node, `Cannot apply ${node.type} to non-numeric type ${symbol.type}`);
      }
    }

    return symbol.type;
  }

  // ============================================================================
  // Advanced Expressions
  // ============================================================================

  /**
   * Visit Conditional Expression (ternary operator: a ? b : c)
   * FIX: Added missing visitor
   */
  private visitConditionalExpression(node: ASTNode): string | null {
    const ternaryNode = node as ConditionalExpressionNode;

    // Check condition is boolean
    const condType = this.visit(ternaryNode.condition);
    if (condType && condType !== 'bool') {
      this.addError(ternaryNode.condition, `Ternary condition must be boolean, got ${condType}`);
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
   * FIX: Added missing visitor
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
   * FIX: Added missing visitor
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
   * FIX: Added missing visitor
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
        // Check initialization logic
        if (assignNode.operator !== '=' && !symbol.initialized) {
            this.addError(node, `Variable '${targetName}' used (via ${assignNode.operator}) before initialization`, 'warning');
        }
        symbol.initialized = true;
        targetType = symbol.type;
    } 
    // Case 2: Array/Pointer Assignment (arr[5] = 10)
    else {
        // Visit the target (ArrayAccess) to validate indices and get the underlying type
        targetType = this.visit(assignNode.target);
    }

    // Process RHS (Value)
    const valueType = this.visit(assignNode.value);
    
    // Compatibility Check
    if (targetType && valueType && !this.isTypeCompatible(targetType, valueType)) {
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
      if (leftType !== 'bool' || rightType !== 'bool') {
        this.addError(node, `Logical operator '${binOp.operator}' requires boolean operands`);
      }
      return 'bool';
    }
    return null;
  }
  
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
    return symbol.type;
  }

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

  private visitIfStatement(node: ASTNode): string | null {
  const ifNode = node as IfStatementNode;
  const condType = this.visit(ifNode.condition);

  if (condType && !this.isContextuallyConvertibleToBool(condType)) {
    this.addError(ifNode.condition, `Condition must be boolean or convertible, got ${condType}`);
  }

  ifNode.thenBranch.forEach((stmt: ASTNode) => this.visit(stmt));
  if (ifNode.elseBranch) {
    ifNode.elseBranch.forEach((stmt: ASTNode) => this.visit(stmt));
  }
  return null;
}

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
  // For now, you can either:
  //   a) reject all unknown types (strict but simple)
  //   b) allow anything not explicitly forbidden (closer to real C++)
  // Most teaching/minimal checkers start strict:

  return false;  // reject classes/structs/unions without conversion function

  // If you want to be more permissive (closer to real C++):
  // return !['void', 'string', 'array<int,5> /*etc*/'].includes(type);
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

  private visitCinStatement(node: ASTNode): string | null {
      const cinNode = node as any;
      
      // NEW: Handle chained cin (cin >> x >> y >> arr[i])
      if (cinNode.targets && Array.isArray(cinNode.targets)) {
          cinNode.targets.forEach((target: string | ASTNode) => {
              if (typeof target === 'string') {
                  // Simple identifier: cin >> x
                  const symbol = this.lookupSymbol(target);
                  if (symbol) {
                      symbol.initialized = true; // Mark as initialized after input
                  } else {
                      this.addError(node, `Undeclared variable '${target}' in cin statement`);
                  }
              } else if (target.type === 'ArrayAccess') {
                  // Array element: cin >> arr[i]
                  const arrayAccess = target as any;
                  const symbol = this.lookupSymbol(arrayAccess.name);
                  if (!symbol) {
                      this.addError(node, `Undeclared array '${arrayAccess.name}' in cin statement`);
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
          }
      }
      
      return null;
  }

  private visitCoutStatement(node: ASTNode): string | null {
      const coutNode = node as any;
      
      // NEW: Handle chained cout (cout << x << y << "text")
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
  // Helpers
  // ============================================================================
  
  private enterScope(name: string): void {
    this.scopeStack.push(name);
    this.currentScope = this.scopeStack.join('::');
  }
  
  private exitScope(): void {
    this.scopeStack.pop();
    this.currentScope = this.scopeStack.join('::');
  }
  
  private addSymbol(
    name: string, 
    type: string, 
    line: number, 
    initialized: boolean, 
    dimensions?: number[] 
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
        this.addError(
            { line, type: 'VariableDecl' } as any, 
            `Variable '${name}' already declared in this scope`
        );
        return; 
    }

    // Scope shadowing check (parent scopes)
    // Check if variable exists in any parent scope
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
        dimensions 
    };
  }

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
    return this.isNumericType(source) || source.endsWith('*');
  }

  // 3. Widening Conversions (Safe)
  const numericWeight: Record<string, number> = { 'char': 1, 'int': 2, 'float': 3, 'double': 4 };
  if (numericWeight[target] && numericWeight[source]) {
    // Only return true if target is "wider" than or equal to source
    return numericWeight[target] >= numericWeight[source];
  }

  // 4. Narrowing (Unsafe) - explicitly caught by the weight check above,
  // but keeping your explicit catch for clarity in logs:
  if (target === 'int' && (source === 'float' || source === 'double')) {
    return false; 
  }

  return false;
}
  private isNumericType(type: string): boolean {
    return ['int', 'float', 'double'].includes(type);
  }
  
  private isComparable(left: string, right: string): boolean {
    return this.isNumericType(left) && this.isNumericType(right);
  }
  
  private promoteType(left: string, right: string): string {
    if (left === 'double' || right === 'double') return 'double';
    if (left === 'float' || right === 'float') return 'float';
    return 'int';
  }
  
  private addError(node: any, message: string, severity: 'error' | 'warning' = 'error'): void {
    this.errors.push({
      type: 'semantic',
      message: message,
      line: node?.line || node?.location?.start?.line || 0,
      column: node?.column || node?.location?.start?.column || 0,
      severity: severity,
    });
  }

  // ============================================================================
  // Preprocessor Directive Handlers (ADDED: Full support)
  // ============================================================================

  private visitInclude(node: any): string | null {
      // Validation: Check if included file exists (warning only, not error)
      if (node.name && !node.name.match(/^(iostream|string|vector|cmath|algorithm|iomanip)$/)) {
          this.addError(node, `Include file '${node.name}' may not exist`, 'warning');
      }
      return null;
  }

  private visitDefine(node: any): string | null {
      // Track macro definitions (could be used for constant folding later)
      // For now, just validate the value if present
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
}