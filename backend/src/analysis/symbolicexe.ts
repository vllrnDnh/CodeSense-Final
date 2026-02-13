/**
 * Bulletproof Symbolic Execution Engine
 * COMPREHENSIVE ERROR HANDLING + ALL BASIC C++ CHECKS
 * Handles: Division/modulo by zero, array bounds, uninitialized variables, infinite loops,
 * memory leaks, use-after-free, double-free, null pointers, integer overflow, shift operations
 */

import {
  ASTNode,
  SafetyCheck,
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
  SymbolTable,
  ConditionalExpressionNode,
  CastExpressionNode,
  SizeofExpressionNode,
  LambdaExpressionNode,
  ParameterNode,
  ForLoopNode,
  FunctionCallNode
} from '../types';

type SymbolicValue =
  | { type: 'concrete'; value: number; arraySize?: number }
  | { type: 'symbolic'; name: string; constraints: Constraint[]; nullable?: boolean; arraySize?: number }
  | { type: 'unknown'; arraySize?: number }
  | { type: 'pointer'; target?: string; isNull?: boolean; isFreed?: boolean; arraySize?: number }
  | { type: 'nullptr'; arraySize?: number }; 

interface Constraint {
  variable: string;
  operator: string;
  value: number | string;
}

interface SymbolicState {
  variables: Map<string, SymbolicValue>;
  pathConditions: Constraint[];
  initialized: Set<string>;
  allocatedPointers: Map<string, { line: number; freed: boolean; size?: number }>;
  freedPointers: Set<string>;
}

export class SymbolicExecutor {
  private safetyChecks: SafetyCheck[] = [];
  private state!: SymbolicState;
  private symbolTable: SymbolTable;
  private currentScope: string = 'global';
  private currentFunction: string | null = null;
  
  // Platform-specific limits
  private readonly INT_MAX = 2147483647;
  private readonly INT_MIN = -2147483648;
  private readonly UINT_MAX = 4294967295;

  constructor(symbolTable: SymbolTable) {
    this.symbolTable = symbolTable;
    this.resetState();
  }

  private resetState(): void {
    this.state = {
      variables: new Map(),
      pathConditions: [],
      initialized: new Set(),
      allocatedPointers: new Map(),
      freedPointers: new Set()
    };
  }

  execute(ast: ASTNode): SafetyCheck[] {
    this.safetyChecks = [];
    this.resetState();
    
    try {
      // Initialize standard library symbols (iostream, etc.)
      this.initializeStandardLibrary();
      
      // Initialize global variables
      Object.entries(this.symbolTable).forEach(([scopedName, symbol]) => {
        if (symbol.scope === 'global') {
          if (symbol.initialized) {
            this.state.initialized.add(symbol.name);
          }
          
          if (symbol.dimensions && symbol.dimensions.length > 0) {
            this.state.variables.set(symbol.name, {
              type: 'concrete',
              value: 0,
              arraySize: symbol.dimensions[0]
            });
          }
        }
      });
      
      this.visit(ast);
      
      // Check for memory leaks at program end
      this.checkForMemoryLeaks();
      
    } catch (error: any) {
      // Graceful error handling - don't crash the analysis
      console.error('[SymbolicExecutor] Error during execution:', error.message);
      this.addSafetyCheck(
        0,
        'symbolic_execution',
        'WARNING',
        `Analysis error: ${error.message}`
      );
    }
    
    return this.safetyChecks;
  }

  /**
   * Initialize C++ standard library symbols as pre-defined and safe
   */
  private initializeStandardLibrary(): void {
    // Mark iostream objects as initialized and safe to use
    const stdLibSymbols = ['cout', 'cin', 'endl', 'string'];
    
    stdLibSymbols.forEach(symbol => {
      this.state.initialized.add(symbol);
      this.state.variables.set(symbol, {
        type: 'symbolic',
        name: symbol,
        constraints: []
      });
    });
  }

  private visit(node: ASTNode | null | string | undefined): SymbolicValue {
    if (!node) return { type: 'unknown' };
    
    try {
      if (typeof node === 'string') {
        return this.visitIdentifier({ type: 'Identifier', name: node } as any);
      }

      const methodName = `visit${node.type}` as keyof this;
      if (typeof this[methodName] === 'function') {
        return (this[methodName] as any).call(this, node);
      }
      
      // Default traversal for unknown node types
      if ('body' in node && Array.isArray((node as any).body)) {
        (node as any).body.forEach((child: ASTNode) => this.visit(child));
      } else if ('statements' in node && Array.isArray((node as any).statements)) {
        (node as any).statements.forEach((child: ASTNode) => this.visit(child));
      }
    } catch (error: any) {
      const nodeType = typeof node === 'string' ? 'string' : (node as any).type || 'unknown';
     console.error(`[SymbolicExecutor] Error visiting ${nodeType}:`, error.message);
    }

    return { type: 'unknown' };
  }

  private visitProgram(node: any): SymbolicValue {
    if (node.body && Array.isArray(node.body)) {
      node.body.forEach((stmt: ASTNode) => this.visit(stmt));
    }
    return { type: 'unknown' };
  }

  private visitFunctionDecl(node: ASTNode): SymbolicValue {
    const funcNode = node as FunctionDeclNode; 
    const previousScope = this.currentScope;
    const previousFunc = this.currentFunction;
    
    this.currentScope = funcNode.name;
    this.currentFunction = funcNode.name;

    // Save allocated pointers before entering function
    const allocatedBefore = new Map(this.state.allocatedPointers);

    // Handle parameters
    funcNode.params.forEach((param: ParameterNode) => {
      const isPointer = param.varType.endsWith('*');
      this.state.variables.set(param.name, {
        type: isPointer ? 'pointer' : 'symbolic',
        name: param.name,
        constraints: [],
        nullable: isPointer
      } as any);
      this.state.initialized.add(param.name);
    });

    // Visit function body
    if (funcNode.body && Array.isArray(funcNode.body)) {
      funcNode.body.forEach((stmt: ASTNode) => this.visit(stmt));
    }

    // Check for memory leaks in function
    this.state.allocatedPointers.forEach((info, ptr) => {
      if (!info.freed && !allocatedBefore.has(ptr)) {
        this.addSafetyCheck(
          info.line,
          ptr,
          'WARNING',
          `Potential memory leak: Pointer '${ptr}' allocated but not freed before function exit`
        );
      }
    });

    this.currentScope = previousScope;
    this.currentFunction = previousFunc;
    return { type: 'unknown' };
  }

  private visitVariableDecl(node: ASTNode): SymbolicValue {
    const varNode = node as VariableDeclNode;
    let computedSize: number | undefined = undefined;

    // Handle array dimensions
    if (varNode.dimensions && varNode.dimensions.length > 0) {
      const dimResult = this.visit(varNode.dimensions[0]);
      if (dimResult.type === 'concrete') {
        computedSize = dimResult.value;
        
        // Check for invalid array size
        if (computedSize <= 0) {
          this.addSafetyCheck(
            node.line || 0,
            varNode.name,
            'UNSAFE',
            `Invalid array size: ${computedSize} (must be positive)`
          );
        }
      }
    }

    let value: SymbolicValue = { type: 'unknown' };
const isPointer = varNode.varType.endsWith('*');

if (varNode.value) {
  value = this.visit(varNode.value);
  this.state.initialized.add(varNode.name);
  
  // Track pointer allocation from new/malloc
  if (isPointer && varNode.value && typeof varNode.value !== 'string' && varNode.value.type === 'FunctionCall') {
    const funcCall = varNode.value as FunctionCallNode;
    if (['new', 'malloc', 'calloc'].includes(funcCall.name)) {
      this.state.allocatedPointers.set(varNode.name, {
        line: node.line || 0,
        freed: false
      });
    }
  }
  
  // Handle nullptr assignment
  if (varNode.value && typeof varNode.value !== 'string' && 
      varNode.value.type === 'Identifier' && (varNode.value as any).name === 'nullptr') {
    value = { type: 'nullptr' };
  }
} else if (computedSize !== undefined) {
      this.state.initialized.add(varNode.name);
      value = { type: 'concrete', value: 0 };
    } else if (isPointer) {
      value = { type: 'pointer', isNull: true };
    }

    if (computedSize !== undefined) {
      value = { ...value, arraySize: computedSize };
    }
    
    this.state.variables.set(varNode.name, value);
    return value;
  }

  private visitAssignment(node: ASTNode): SymbolicValue {
    const assignNode = node as AssignmentNode;
    
    const value = this.visit(assignNode.value);
    
    if (typeof assignNode.target !== 'string') {
      // Array access assignment
      this.visit(assignNode.target as ASTNode); 
    } else {
      const varName = assignNode.target;
      const existing = this.state.variables.get(varName);
      
      // Track pointer assignments from new/malloc
      if (assignNode.value && typeof assignNode.value !== 'string' && assignNode.value.type === 'FunctionCall') {  
        const funcCall = assignNode.value as FunctionCallNode;
        if (['new', 'malloc', 'calloc'].includes(funcCall.name)) {
          this.state.allocatedPointers.set(varName, {
            line: node.line || 0,
            freed: false
          });
        }
      }
      
      // Check for use-after-free
      if (this.state.freedPointers.has(varName)) {
        this.addSafetyCheck(
          node.line || 0,
          varName,
          'UNSAFE',
          `Use-after-free: Assigning to freed pointer '${varName}'`
        );
      }
      
      // Handle nullptr assignment
      let newValue: SymbolicValue;
      if (assignNode.value.type === 'Identifier' && (assignNode.value as any).name === 'nullptr') {
        newValue = { type: 'nullptr' };
      } else {
        newValue = { ...value };
      }
      
      if (existing?.arraySize !== undefined) {
        newValue.arraySize = existing.arraySize;
      }
      
      this.state.variables.set(varName, newValue);
      this.state.initialized.add(varName);
    }
    
    return value;
  }

  private visitIfStatement(node: ASTNode): SymbolicValue {
    const ifNode = node as IfStatementNode;
    const condVal = this.visit(ifNode.condition);

    let thenFeasible = true;
    let elseFeasible = true;

    if (condVal.type === 'concrete') {
      thenFeasible = condVal.value !== 0;
      elseFeasible = condVal.value === 0;
      
      if (!thenFeasible) {
        this.addSafetyCheck(node.line || 0, 'if_condition', 'WARNING',
          'Condition is always false - then-branch is unreachable');
      }
      if (!elseFeasible && ifNode.elseBranch) {
        this.addSafetyCheck(node.line || 0, 'if_condition', 'WARNING',
          'Condition is always true - else-branch is unreachable');
      }
    }
    
    this.detectContradictoryCondition(ifNode.condition, node.line || 0);

    if (condVal.type === 'symbolic' || condVal.type === 'unknown') {
      const savedState = this.cloneState();
      
      if (thenFeasible) {
        ifNode.thenBranch.forEach(stmt => this.visit(stmt));
      }
      const thenState = this.cloneState();
      
      if (elseFeasible && ifNode.elseBranch) {
        this.state = savedState;
        ifNode.elseBranch.forEach(stmt => this.visit(stmt));
      }
      const elseState = this.cloneState();
      
      this.state = this.mergeStates(thenState, elseState);
    } else {
      if (thenFeasible) {
        ifNode.thenBranch.forEach(stmt => this.visit(stmt));
      } else if (elseFeasible && ifNode.elseBranch) {
        ifNode.elseBranch.forEach(stmt => this.visit(stmt));
      }
    }

    return { type: 'unknown' };
  }

  private mergeStates(state1: SymbolicState, state2: SymbolicState): SymbolicState {
    const merged: SymbolicState = {
      variables: new Map(),
      pathConditions: [...state1.pathConditions],
      initialized: new Set([...state1.initialized, ...state2.initialized]),
      allocatedPointers: new Map([...state1.allocatedPointers]),
      freedPointers: new Set([...state1.freedPointers, ...state2.freedPointers])
    };
    
    const allKeys = new Set([...state1.variables.keys(), ...state2.variables.keys()]);
    allKeys.forEach(key => {
      const val1 = state1.variables.get(key);
      const val2 = state2.variables.get(key);
      if (val1 && val2 && val1.type === 'concrete' && val2.type === 'concrete' && val1.value === val2.value) {
        merged.variables.set(key, val1);
      } else if (val1 || val2) {
        merged.variables.set(key, { type: 'unknown', arraySize: val1?.arraySize || val2?.arraySize });
      }
    });
    
    return merged;
  }

  private detectContradictoryCondition(cond: ASTNode, line: number): void {
    if (cond.type === 'BinaryOp') {
      const binOp = cond as BinaryOpNode;
      if (['<', '>', '<=', '>=', '==', '!='].includes(binOp.operator)) {
        if (binOp.left.type === 'Identifier' && binOp.right.type === 'Identifier') {
          const leftVar = (binOp.left as any).name;
          const rightVar = (binOp.right as any).name;
          
          const leftVal = this.state.variables.get(leftVar);
          const rightVal = this.state.variables.get(rightVar);
          
          if (leftVal?.type === 'concrete' && rightVal?.type === 'concrete') {
            const left = leftVal.value;
            const right = rightVal.value;
            
            let result = false;
            switch (binOp.operator) {
              case '<': result = left < right; break;
              case '>': result = left > right; break;
              case '<=': result = left <= right; break;
              case '>=': result = left >= right; break;
              case '==': result = left === right; break;
              case '!=': result = left !== right; break;
            }
            
            if (!result) {
              this.addSafetyCheck(line, 'condition', 'WARNING',
                `Contradictory condition: ${leftVar}(${left}) ${binOp.operator} ${rightVar}(${right}) is always false`);
            }
          }
        }
      }
    }
  }

  private visitForLoop(node: ASTNode): SymbolicValue {
    const forNode = node as ForLoopNode;
    
    if (forNode.init) {
      this.visit(forNode.init);
    }

    const bodyStatements = Array.isArray(forNode.body) ? forNode.body : [forNode.body as ASTNode];

    if (forNode.condition) {
      const condStr = this.expressionToString(forNode.condition);
      const updateStr = forNode.update ? this.expressionToString(forNode.update) : "";

      const isBoundaryHit = />=|!=|>/.test(condStr) && /0/.test(condStr);
      const isDecrementing = updateStr.includes('--') || updateStr.includes('-=');

      if (isBoundaryHit && isDecrementing) {
        const vars = this.extractVariables(forNode.condition);
        vars.forEach(v => {
          this.checkLoopBodyForZeroRisk(bodyStatements, v);
        });
      }
    }

    if (Array.isArray(forNode.body)) {
      forNode.body.forEach((stmt: ASTNode) => this.visit(stmt));
    } else if (forNode.body) {
      this.visit(forNode.body);
    }
    
    if (forNode.update) {
      this.visit(forNode.update);
    }
    
    return { type: 'unknown' };
  }

  private visitWhileLoop(node: ASTNode): SymbolicValue {
    const loopNode = node as WhileLoopNode;
    const condVal = this.visit(loopNode.condition);

    const condVars = this.extractVariables(loopNode.condition);
    condVars.forEach(v => this.checkLoopBodyForZeroRisk(loopNode.body, v));

    this.detectInfiniteLoop(loopNode);

    loopNode.body.forEach(stmt => this.visit(stmt));
    
    if (!this.mayModifyCondition(loopNode.condition, loopNode.body)) {
      this.addSafetyCheck(
        node.line || 0,
        'while_loop',
        'WARNING',
        'Infinite loop: Loop condition never changes'
      );
    }
    
    return { type: 'unknown' };
  }

  private visitDoWhileLoop(node: ASTNode): SymbolicValue {
    const loop = node as DoWhileLoopNode;
    loop.body.forEach(stmt => this.visit(stmt));
    this.visit(loop.condition);
    return { type: 'unknown' };
  }

  private visitSwitchStatement(node: ASTNode): SymbolicValue {
    const sw = node as SwitchStatementNode;
    this.visit(sw.condition);
    sw.cases.forEach(c => {
      if (c.value) this.visit(c.value);
      c.statements.forEach(stmt => this.visit(stmt));
    });
    return { type: 'unknown' };
  }

  private visitReturnStatement(node: ASTNode): SymbolicValue {
    const ret = node as ReturnStatementNode;
    if (ret.value) {
      return this.visit(ret.value);
    }
    return { type: 'unknown' };
  }

  // NEW: Handle ternary operator
  private visitConditionalExpression(node: ASTNode): SymbolicValue {
    const ternary = node as ConditionalExpressionNode;
    const condVal = this.visit(ternary.condition);
    
    if (condVal.type === 'concrete') {
      return condVal.value !== 0 
        ? this.visit(ternary.trueExpression)
        : this.visit(ternary.falseExpression);
    }
    
    // Unknown condition - visit both branches
    this.visit(ternary.trueExpression);
    this.visit(ternary.falseExpression);
    return { type: 'unknown' };
  }

  private visitInitializerList(node: ASTNode): SymbolicValue {
    const list = node as InitializerListNode;
    list.values.forEach(val => this.visit(val));
    return { type: 'unknown' };
  }

  private visitGlobalAccess(node: ASTNode): SymbolicValue {
    const global = node as GlobalAccessNode;
    return this.visitIdentifier({ type: 'Identifier', name: global.name } as any);
  }

  private visitLoopControl(node: ASTNode): SymbolicValue {
    return { type: 'unknown' }; 
  }

  private visitCastExpression(node: ASTNode): SymbolicValue {
    const cast = node as CastExpressionNode;
    const operandVal = this.visit(cast.operand);
    
    // Check for potential overflow in cast
    if (operandVal.type === 'concrete') {
      if (cast.targetType === 'int' && (operandVal.value > this.INT_MAX || operandVal.value < this.INT_MIN)) {
        this.addSafetyCheck(
          node.line || 0,
          'cast',
          'WARNING',
          `Integer overflow in cast: ${operandVal.value} exceeds int range`
        );
      }
    }
    
    return operandVal;
  }

  private visitSizeofExpression(node: ASTNode): SymbolicValue {
    const sizeof = node as SizeofExpressionNode;
    this.visit(sizeof.value);
    return { type: 'concrete', value: 4 }; // Simplified - returns size in bytes
  }

  private visitLambdaExpression(node: ASTNode): SymbolicValue {
    const lambda = node as LambdaExpressionNode;
    const previousScope = this.currentScope;
    this.currentScope = 'lambda';
    
    lambda.body.forEach(stmt => this.visit(stmt));
    
    this.currentScope = previousScope;
    return { type: 'unknown' };
  }

  private visitFunctionCall(node: ASTNode): SymbolicValue {
    const funcCall = node as FunctionCallNode;
    
    // Process arguments
    funcCall.arguments.forEach(arg => this.visit(arg));
    
    // Handle delete/free
    if (['delete', 'free'].includes(funcCall.name)) {
      if (funcCall.arguments.length > 0 && funcCall.arguments[0].type === 'Identifier') {
        const ptrName = (funcCall.arguments[0] as any).name;
        
        // Check for double-free
        if (this.state.freedPointers.has(ptrName)) {
          this.addSafetyCheck(
            node.line || 0,
            ptrName,
            'UNSAFE',
            `Double-free detected: Pointer '${ptrName}' freed twice`
          );
        } else {
          const allocInfo = this.state.allocatedPointers.get(ptrName);
          if (allocInfo && !allocInfo.freed) {
            allocInfo.freed = true;
            this.state.freedPointers.add(ptrName);
          } else if (!allocInfo) {
            this.addSafetyCheck(
              node.line || 0,
              ptrName,
              'WARNING',
              `Freeing untracked pointer '${ptrName}' - was it allocated?`
            );
          }
        }
      }
    }
    
    // Handle unsafe string operations
    if (['strcpy', 'strcat', 'sprintf'].includes(funcCall.name)) {
      this.addSafetyCheck(
        node.line || 0,
        funcCall.name,
        'WARNING',
        `Potentially unsafe string operation '${funcCall.name}()' - consider using safer alternatives`
      );
    }
    
    // Handle memcpy/memmove buffer operations
    if (['memcpy', 'memmove'].includes(funcCall.name) && funcCall.arguments.length >= 3) {
      const sizeArg = funcCall.arguments[2];
      const sizeVal = this.visit(sizeArg);
      
      if (sizeVal.type === 'concrete' && sizeVal.value < 0) {
        this.addSafetyCheck(
          node.line || 0,
          funcCall.name,
          'UNSAFE',
          `Negative size in ${funcCall.name}(): ${sizeVal.value}`
        );
      }
    }
    
    return { type: 'unknown' };
  }

  private visitBinaryOp(node: ASTNode): SymbolicValue {
    const binOp = node as BinaryOpNode;
    const left = this.visit(binOp.left);

    // Short-circuit evaluation
    if (binOp.operator === '&&') {
      if (left.type === 'concrete' && left.value === 0) return left;
      const right = this.visit(binOp.right);
      if (left.type === 'concrete' && right.type === 'concrete') {
        return { type: 'concrete', value: (left.value !== 0 && right.value !== 0) ? 1 : 0 };
      }
      return { type: 'unknown' };
    }

    if (binOp.operator === '||') {
      if (left.type === 'concrete' && left.value !== 0) return { type: 'concrete', value: 1 };
      const right = this.visit(binOp.right);
      if (left.type === 'concrete' && right.type === 'concrete') {
        return { type: 'concrete', value: (left.value !== 0 || right.value !== 0) ? 1 : 0 };
      }
      return { type: 'unknown' };
    }

    const right = this.visit(binOp.right);
    
    // Check division and modulo by zero
    if (binOp.operator === '/' || binOp.operator === '%') {
      this.checkDivisionByZero(binOp, right);
    }
    
    // Check bitwise shifts
    if (binOp.operator === '<<' || binOp.operator === '>>') {
      this.checkShiftOperation(binOp, left, right);
    }

    // Evaluate concrete operations
    if (left.type === 'concrete' && right.type === 'concrete') {
      const result = this.evaluateConcrete(binOp.operator, left.value, right.value);
      
      // Check for integer overflow
     if (result.type === 'concrete' && ['+', '-', '*'].includes(binOp.operator)) {
//                                   ✅ Correct
        if (result.value > this.INT_MAX || result.value < this.INT_MIN) {
          this.addSafetyCheck(
            node.line || 0,
            'arithmetic',
            'WARNING',
            `Integer overflow in expression: ${left.value} ${binOp.operator} ${right.value} = ${result.value}`
          );
        }
      }
      
      return result;
    }
    
    return { type: 'unknown' }; 
  }

  private visitUnaryOp(node: ASTNode): SymbolicValue {
    const u = node as UnaryOpNode;
    const name = typeof u.operand === 'string' ? u.operand : (u.operand as any)?.name;
    if (!name) {
      // Handle complex operands
      if (typeof u.operand !== 'string') {
        return this.visit(u.operand as ASTNode);
      }
      return { type: 'unknown' };
    }

    const sym = this.state.variables.get(name);

    // Handle dereference
    if (node.type === 'Dereference') {
      // Check use-after-free
      if (this.state.freedPointers.has(name)) {
        this.addSafetyCheck(
          node.line || 0, 
          'pointer_dereference', 
          'UNSAFE', 
          `Use-after-free: Dereferencing freed pointer '${name}'`
        );
      }
      // Check nullptr dereference
      else if (sym?.type === 'nullptr') {
        this.addSafetyCheck(
          node.line || 0,
          'pointer_dereference',
          'UNSAFE',
          `Null pointer dereference: Dereferencing nullptr '${name}'`
        );
      }
      // Check potentially null pointer
      else if (!sym || (sym.type === 'symbolic' && (sym as any).nullable && !this.provenNotNull(name))) {
        this.addSafetyCheck(
          node.line || 0, 
          'pointer_dereference', 
          'WARNING', 
          `Possible null pointer dereference: *${name}`
        );
      }
      // Check uninitialized pointer
      else if (sym?.type === 'pointer' && (sym as any).isNull) {
        this.addSafetyCheck(
          node.line || 0,
          'pointer_dereference',
          'UNSAFE',
          `Null pointer dereference: Dereferencing uninitialized pointer '${name}'`
        );
      }
      return { type: 'unknown' };
    }

    // Handle address-of operator
    if (node.type === 'AddressOf') {
      return { type: 'pointer', target: name, isNull: false };
    }

    // Handle increment/decrement
    if (['PreIncrement', 'PostIncrement', 'PreDecrement', 'PostDecrement'].includes(node.type)) {
      if (!this.state.initialized.has(name)) {
        this.addSafetyCheck(
          node.line || 0, 
          'arithmetic', 
          'WARNING', 
          `Operation on uninitialized variable: ${name}`
        );
      }
    }

    if (sym?.type === 'concrete') {
      let val = sym.value;
      if (node.type.includes('Increment')) val++;
      if (node.type.includes('Decrement')) val--;
      
      // Check for overflow
      if (val > this.INT_MAX || val < this.INT_MIN) {
        this.addSafetyCheck(
          node.line || 0,
          name,
          'WARNING',
          `Integer overflow in ${node.type} operation on '${name}'`
        );
      }
      
      const newValue: SymbolicValue = { 
        type: 'concrete', 
        value: val, 
        arraySize: sym.arraySize
      };
      this.state.variables.set(name, newValue);
      this.state.initialized.add(name);
      
      return newValue;
    }
    
    return { type: 'unknown' };
  }

  private visitArrayAccess(node: ASTNode): SymbolicValue {
    const arrayNode = node as ArrayAccessNode;
    const arrName = arrayNode.name;
    
    const arrSymbol = this.state.variables.get(arrName);
    const arraySize = arrSymbol?.arraySize;

    arrayNode.indices.forEach((indexNode, dim) => {
      const indexVal = this.visit(indexNode);
      
      if (arraySize !== undefined) {
        if (indexVal.type === 'concrete') {
          const idx = indexVal.value;
          
          if (idx < 0) {
            this.addSafetyCheck(
              node.line || 0,
              `${arrName}[${idx}]`,
              'UNSAFE',
              `Array index out of bounds: ${arrName}[${idx}] (index is negative)`
            );
          }
          else if (idx >= arraySize) {
            this.addSafetyCheck(
              node.line || 0,
              `${arrName}[${idx}]`,
              'UNSAFE',
              `Array index out of bounds: ${arrName}[${idx}] exceeds size ${arraySize}`
            );
          }
          else {
            this.addSafetyCheck(
              node.line || 0,
              `${arrName}[${idx}]`,
              'SAFE',
              `Array access is safe: index ${idx} within bounds [0, ${arraySize-1}]`
            );
          }
        } else {
          // Dynamic index - warn about potential out of bounds
          this.addSafetyCheck(
            node.line || 0,
            `${arrName}[?]`,
            'WARNING',
            `Array index is not constant - ensure it stays within bounds [0, ${arraySize-1}]`
          );
        }
      }
    });

    return { type: 'unknown' };
  }

  // Literal visitors
  private visitInteger(node: any): SymbolicValue { 
    return { type: 'concrete', value: node.value }; 
  }
  
  private visitFloat(node: any): SymbolicValue { 
    return { type: 'concrete', value: node.value }; 
  }
  
  private visitChar(node: any): SymbolicValue {
    return { type: 'concrete', value: node.value.charCodeAt(0) };
  }
  
  private visitString(node: any): SymbolicValue {
    return { type: 'pointer', target: 'string_literal', isNull: false };
  }
  
  private visitIdentifier(node: ASTNode): SymbolicValue {
    const name = (node as any).name;
    
    // Handle nullptr
    if (name === 'nullptr') {
      return { type: 'nullptr' };
    }
    
    const val = this.state.variables.get(name);
    
    // Check for use-after-free
    if (this.state.freedPointers.has(name)) {
      this.addSafetyCheck(
        node.line || 0, 
        'read_variable', 
        'UNSAFE', 
        `Use-after-free: Using freed pointer '${name}'`
      );
    }
    
    // Check for uninitialized variable
    if (val && val.type !== 'concrete' && val.type !== 'nullptr' && !this.state.initialized.has(name)) {
      this.addSafetyCheck(
        node.line || 0, 
        'read_variable', 
        'WARNING', 
        `Use of uninitialized variable '${name}'`
      );
    }
    
    return val || { type: 'unknown' };
  }

  private visitLiteral(node: any): SymbolicValue {
    const val = String(node.value);
    if (val === 'true') return { type: 'concrete', value: 1 };
    if (val === 'false') return { type: 'concrete', value: 0 };
    if (val === 'nullptr') return { type: 'nullptr' };
    return { type: 'concrete', value: parseFloat(val) || 0 };
  }

  // Helper methods
  private checkDivisionByZero(node: BinaryOpNode, divisor: SymbolicValue): void {
    if (divisor.type === 'concrete' && divisor.value === 0) {
      this.addSafetyCheck(
        node.line || 0, 
        this.expressionToString(node), 
        'UNSAFE', 
        `${node.operator === '/' ? 'Division' : 'Modulo'} by zero detected`
      );
    } else if (divisor.type === 'symbolic' && !this.provenNotNull(divisor.name)) {
      this.addSafetyCheck(
        node.line || 0, 
        this.expressionToString(node), 
        'WARNING', 
        `Possible ${node.operator === '/' ? 'division' : 'modulo'} by zero`
      );
    }
  }

  private checkShiftOperation(node: BinaryOpNode, left: SymbolicValue, right: SymbolicValue): void {
    if (right.type === 'concrete') {
      // Check for negative shift
      if (right.value < 0) {
        this.addSafetyCheck(
          node.line || 0,
          this.expressionToString(node),
          'UNSAFE',
          `Bitwise shift by negative amount: ${right.value}`
        );
      }
      // Check for shift >= width of type (assuming 32-bit int)
      else if (right.value >= 32) {
        this.addSafetyCheck(
          node.line || 0,
          this.expressionToString(node),
          'UNSAFE',
          `Bitwise shift by ${right.value} bits exceeds type width (32 bits)`
        );
      }
    }
    
    // Check for shifting negative value (left shift)
    if (node.operator === '<<' && left.type === 'concrete' && left.value < 0) {
      this.addSafetyCheck(
        node.line || 0,
        this.expressionToString(node),
        'WARNING',
        'Left shift of negative value is undefined behavior'
      );
    }
  }

  private checkLoopBodyForZeroRisk(body: ASTNode[] | ASTNode | null, varName: string): void {
    const cleanVarName = varName.trim();
    const walk = (n: any) => {
      if (!n || typeof n === 'string') return;
      
      if (n.type === 'BinaryOp' && (n.operator === '/' || n.operator === '%')) {
        const divisorVars = this.extractVariables(n.right);
        if (Array.from(divisorVars).some(v => v.trim() === cleanVarName)) {
          this.addSafetyCheck(
            n.line || 0, 
            cleanVarName, 
            'UNSAFE', 
            `${n.operator === '/' ? 'Division' : 'Modulo'} by zero detected: Loop variable '${cleanVarName}' will hit 0`
          );
        }
      }
      
      if (Array.isArray(n)) n.forEach(walk);
      else {
        if (n.body) walk(n.body);
        if (n.statements) walk(n.statements);
        if (n.expression) walk(n.expression);
        if (n.value) walk(n.value);
        if (n.thenBranch) walk(n.thenBranch);
        if (n.elseBranch) walk(n.elseBranch);
        if (n.left) walk(n.left);
        if (n.right) walk(n.right);
      }
    };

    if (Array.isArray(body)) {
      body.forEach(walk);
    } else {
      walk(body);
    }
  }

  private checkForMemoryLeaks(): void {
    this.state.allocatedPointers.forEach((info, ptr) => {
      if (!info.freed) {
        this.addSafetyCheck(
          info.line,
          ptr,
          'WARNING',
          `Memory leak: Pointer '${ptr}' was allocated but never freed`
        );
      }
    });
  }

  private provenNotNull(name: string): boolean {
    return this.state.pathConditions.some(c => 
      c.variable === name && (c.operator === '!=' && (c.value === 0 || c.value === 'nullptr'))
    );
  }

  private mayModifyCondition(cond: ASTNode, body: ASTNode[]): boolean {
    const condVars = this.extractVariables(cond);
    const modVars = this.extractModifiedVariables(body);
    return Array.from(condVars).some(v => modVars.has(v));
  }

  private extractVariables(node: any): Set<string> {
    const vars = new Set<string>();
    const walk = (n: any) => {
      if (!n) return;
      if (typeof n === 'string') {
        vars.add(n);
        return;
      }
      if (n.type === 'Identifier') {
        const name = n.name || n.value || n.id;
        if (name) vars.add(name);
      }
      if (n.left) walk(n.left);
      if (n.right) walk(n.right);
      if (n.expression) walk(n.expression);
      if (n.value) walk(n.value);
    };
    walk(node);
    return vars;
  }

  private extractModifiedVariables(body: ASTNode[]): Set<string> {
    const mods = new Set<string>();
    body.forEach(s => {
      if (s.type === 'Assignment') {
        const target = (s as AssignmentNode).target;
        if (typeof target === 'string') {
          mods.add(target);
        }
      }
      if (s.type.includes('Increment') || s.type.includes('Decrement')) {
        const operand = (s as any).operand;
        if (typeof operand === 'string') {
          mods.add(operand);
        }
      }
    });
    return mods;
  }

  private evaluateConcrete(op: string, l: number, r: number): SymbolicValue {
    let res: number;
    switch (op) {
      case '+': res = l + r; break;
      case '-': res = l - r; break;
      case '*': res = l * r; break;
      case '/': res = r !== 0 ? Math.trunc(l / r) : 0; break;
      case '%': res = r !== 0 ? l % r : 0; break;
      case '&&': res = (l && r) ? 1 : 0; break;
      case '||': res = (l || r) ? 1 : 0; break;
      case '==': res = (l === r) ? 1 : 0; break;
      case '!=': res = (l !== r) ? 1 : 0; break;
      case '<':  res = l < r ? 1 : 0; break;
      case '>':  res = l > r ? 1 : 0; break;
      case '<=': res = l <= r ? 1 : 0; break;
      case '>=': res = l >= r ? 1 : 0; break;
      case '&':  res = l & r; break;
      case '|':  res = l | r; break;
      case '^':  res = l ^ r; break;
      case '<<': res = r >= 0 && r < 32 ? l << r : 0; break;
      case '>>': res = r >= 0 && r < 32 ? l >> r : 0; break;
      default: return { type: 'unknown' };
    }
    return { type: 'concrete', value: res };
  }

  private expressionToString(node: any): string {
    if (!node) return "";
    if (typeof node === 'string') return node;

    if (node.type === 'BinaryOp') {
      return `${this.expressionToString(node.left)} ${node.operator} ${this.expressionToString(node.right)}`;
    }
    
    if (node.type === 'Identifier') {
      return node.name || node.value || node.id || "?";
    }
    
    if (node.type === 'Integer' || node.type === 'Literal') {
      return String(node.value);
    }

    if (node.type === 'PostDecrement' || node.type === 'PreDecrement') {
      return node.operand + '--';
    }

    if (node.type === 'PostIncrement' || node.type === 'PreIncrement') {
      return node.operand + '++';
    }
    
    return "?";
  }

  private cloneState(): SymbolicState {
    return {
      variables: new Map(this.state.variables),
      pathConditions: [...this.state.pathConditions],
      initialized: new Set(this.state.initialized),
      allocatedPointers: new Map(this.state.allocatedPointers),
      freedPointers: new Set(this.state.freedPointers)
    };
  }

  private addSafetyCheck(line: number, operation: string, status: 'SAFE' | 'UNSAFE' | 'WARNING', message: string): void {
    this.safetyChecks.push({
      line,
      operation,
      status,
      message
    });
  }

  // Additional visitor methods for completeness
  private visitBlock(node: any): SymbolicValue {
    if (node.statements) {
      node.statements.forEach((s: ASTNode) => this.visit(s));
    }
    return { type: 'unknown' };
  }

  private visitExpressionStatement(node: any): SymbolicValue {
    return this.visit(node.expression);
  }

  private visitParameter(node: any): SymbolicValue { 
    return { type: 'unknown' }; 
  }

  private visitCinStatement(node: ASTNode): SymbolicValue {
    const cinNode = node as any;
    
    if (cinNode.targets && Array.isArray(cinNode.targets)) {
      cinNode.targets.forEach((target: string | ASTNode) => {
        if (typeof target === 'string') {
          this.state.initialized.add(target);
          this.state.variables.set(target, { type: 'symbolic', name: target, constraints: [] });
        } else if (target.type === 'ArrayAccess') {
          const arrayAccess = target as any;
          this.visit(arrayAccess);
          this.state.initialized.add(arrayAccess.name);
        }
      });
    } else if (cinNode.target) {
      this.state.initialized.add(cinNode.target);
      this.state.variables.set(cinNode.target, { type: 'symbolic', name: cinNode.target, constraints: [] });
    }
    
    return { type: 'unknown' };
  }

  private detectInfiniteLoop(loopNode: WhileLoopNode): void {
    const condVars = this.extractVariables(loopNode.condition);
    
    const walk = (stmt: any) => {
      if (!stmt) return;
      
      if (stmt.type === 'Assignment') {
        const target = typeof stmt.target === 'string' ? stmt.target : null;
        if (target && condVars.has(target)) {
          const savedState = this.cloneState();
          
          const valueResult = this.visit(stmt.value);
          if (valueResult.type === 'concrete') {
            const mockState = this.cloneState();
            mockState.variables.set(target, valueResult);
            
            const prevState = this.state;
            this.state = mockState;
            const condResult = this.visit(loopNode.condition);
            this.state = prevState;
            
            if (condResult.type === 'concrete' && condResult.value !== 0) {
              this.addSafetyCheck(
                stmt.line || 0,
                target,
                'UNSAFE',
                `Infinite loop detected: '${target}' is set to ${valueResult.value}, keeping condition always true`
              );
            }
          }
          
          this.state = savedState;
        }
      }
      
      if (Array.isArray(stmt)) {
        stmt.forEach(walk);
      } else {
        if (stmt.body) walk(stmt.body);
        if (stmt.statements) walk(stmt.statements);
        if (stmt.thenBranch) walk(stmt.thenBranch);
        if (stmt.elseBranch) walk(stmt.elseBranch);
      }
    };
    
    if (Array.isArray(loopNode.body)) {
      loopNode.body.forEach(walk);
    } else if (loopNode.body) {
      walk(loopNode.body);
    }
  }

  private visitCoutStatement(node: ASTNode): SymbolicValue {
    const coutNode = node as any;
    
    if (coutNode.values && Array.isArray(coutNode.values)) {
      coutNode.values.forEach((expr: ASTNode) => {
        this.visit(expr);
      });
    } else if (coutNode.value) {
      this.visit(coutNode.value);
    }
    
    return { type: 'unknown' };
  }
}