/**
 * Symbolic Execution Engine
 * Performs bounded, path-sensitive analysis to detect:
 * - Division by zero
 * - Null pointer dereference
 * - Array out-of-bounds
 * - Use of uninitialized variables
 * - Potential infinite loops
 *
 * This is Phase 2 (Logic & Meaning) - Step 2 of the analysis pipeline.
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
  ForLoopNode
} from '../types';

type SymbolicValue =
  | { type: 'concrete'; value: number; arraySize?: number }
  | { type: 'symbolic'; name: string; constraints: Constraint[]; nullable?: boolean; arraySize?: number }
  | { type: 'unknown'; arraySize?: number };

interface Constraint {
  variable: string;
  operator: string;
  value: number | string;
}

interface SymbolicState {
  variables: Map<string, SymbolicValue>;
  pathConditions: Constraint[];
  initialized: Set<string>;
}

export class SymbolicExecutor {
  private safetyChecks: SafetyCheck[] = [];
  private state!: SymbolicState;
  private symbolTable: SymbolTable;
  private currentScope: string = 'global';

  constructor(symbolTable: SymbolTable) {
    this.symbolTable = symbolTable;
    this.resetState();
  }

  private resetState(): void {
    this.state = {
      variables: new Map(),
      pathConditions: [],
      initialized: new Set(),
    };
  }

  /**
   * Main entry point for symbolic execution
   */
  execute(ast: ASTNode): SafetyCheck[] {
    this.safetyChecks = [];
    this.resetState();
    this.visit(ast);
    return this.safetyChecks;
  }

  /**
   * Visitor dispatcher synchronized with PEG.js types
   */
  private visit(node: ASTNode | null | string): SymbolicValue {
    if (!node) return { type: 'unknown' };
    
    if (typeof node === 'string') {
        return this.visitIdentifier({ type: 'Identifier', name: node } as any);
    }

    const methodName = `visit${node.type}` as keyof this;
    if (typeof this[methodName] === 'function') {
      return (this[methodName] as any).call(this, node);
    }
    
    // Fallback for containers
    if ('body' in node) {
        (node as any).body.forEach((child: ASTNode) => this.visit(child));
    } else if ('statements' in node) {
        (node as any).statements.forEach((child: ASTNode) => this.visit(child));
    }

    return { type: 'unknown' };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Program & Functions
  // ─────────────────────────────────────────────────────────────────────────────

private visitProgram(node: any): SymbolicValue {
    // If the program body is not iterated, main() is never analyzed!
    if (node.body && Array.isArray(node.body)) {
        node.body.forEach((stmt: ASTNode) => this.visit(stmt));
    }
    return { type: 'unknown' };
}

 private visitFunctionDecl(node: ASTNode): SymbolicValue {
    const funcNode = node as FunctionDeclNode; 
    const previousScope = this.currentScope;
    this.currentScope = funcNode.name;

    // 1. Initialize parameters as symbolic values to handle unknown caller data
    funcNode.params.forEach((param: ParameterNode) => {
      const isPointer = param.varType.endsWith('*');
      this.state.variables.set(param.name, {
        type: 'symbolic',
        name: param.name,
        constraints: [],
        nullable: isPointer
      });
      this.state.initialized.add(param.name);
    });

    // 2. CRITICAL: Iterate through the body to trigger safety checks
    // The test runner will miss logic risks if this loop is skipped or fails.
    if (funcNode.body && Array.isArray(funcNode.body)) {
        funcNode.body.forEach((stmt: ASTNode) => this.visit(stmt));
    }

    this.currentScope = previousScope;
    return { type: 'unknown' };
}

  // ─────────────────────────────────────────────────────────────────────────────
  // Variable Declaration & Assignment
  // ─────────────────────────────────────────────────────────────────────────────

  private visitVariableDecl(node: ASTNode): SymbolicValue {
    const varNode = node as VariableDeclNode;
    let computedSize: number | undefined = undefined;

    // 1. Capture Array Size
    if (varNode.dimensions && varNode.dimensions.length > 0) {
        const dimResult = this.visit(varNode.dimensions[0]);
        if (dimResult.type === 'concrete') {
            computedSize = dimResult.value;
        }
    }

    // 2. Evaluate Initial Value
    let value: SymbolicValue = { type: 'unknown' };
    
    if (varNode.value) {
      value = this.visit(varNode.value);
      this.state.initialized.add(varNode.name);
    } else {
        // Mark arrays as initialized
        if (computedSize !== undefined) {
            this.state.initialized.add(varNode.name);
            value = { type: 'concrete', value: 0 }; 
        }
    }

    // 3. Store the value WITH the arraySize metadata
    if (value.type === 'concrete') {
        value = { ...value, arraySize: computedSize };
    } else {
        if (computedSize !== undefined) {
            value = { type: 'concrete', value: 0, arraySize: computedSize };
        }
    }
    
    this.state.variables.set(varNode.name, value);
    return value;
  }

private visitAssignment(node: ASTNode): SymbolicValue {
    const assignNode = node as AssignmentNode;
    
    // 1. Resolve the value being assigned (RHS)
    const value = this.visit(assignNode.value);
    
    // 2. Identify the target (LHS)
    if (typeof assignNode.target !== 'string') {
        // LHS is complex (like arr[idx]). 
        // We MUST visit it to trigger visitArrayAccess for bounds checking.
        this.visit(assignNode.target as ASTNode); 
    } else {
        // LHS is a simple variable (like x = 10)
        const varName = assignNode.target;
        const existing = this.state.variables.get(varName);
        
        // Preservation Logic: Update the value but keep the arraySize metadata
        this.state.variables.set(varName, { 
            ...value, 
            arraySize: existing?.arraySize 
        });
        
        // Mark as initialized in our set
        this.state.initialized.add(varName);
    }
    
    return value;
}
  // ─────────────────────────────────────────────────────────────────────────────
  // Control Flow
  // ─────────────────────────────────────────────────────────────────────────────

  private visitIfStatement(node: ASTNode): SymbolicValue {
    const ifNode = node as IfStatementNode;
    const condVal = this.visit(ifNode.condition);

    const savedState = this.cloneState();

    // Branch Analysis: Only explore feasible paths if concrete
    let thenFeasible = true;
    let elseFeasible = true;

    if (condVal.type === 'concrete') {
      thenFeasible = condVal.value !== 0;
      elseFeasible = !thenFeasible;
    }

    if (thenFeasible) {
      this.addPathCondition(ifNode.condition, true);
      ifNode.thenBranch.forEach((stmt: ASTNode) => this.visit(stmt));
    }

    if (elseFeasible && ifNode.elseBranch) {
      this.state = savedState; // Reset to state before 'then'
      this.addPathCondition(ifNode.condition, false);
      ifNode.elseBranch.forEach((stmt: ASTNode) => this.visit(stmt));
    }

    return { type: 'unknown' };
  }

  private visitConditionalExpression(node: ASTNode): SymbolicValue {
    const ternary = node as ConditionalExpressionNode;
    const cond = this.visit(ternary.condition);

    if (cond.type === 'concrete') {
        if (cond.value !== 0) return this.visit(ternary.trueExpression);
        else return this.visit(ternary.falseExpression);
    }

    this.visit(ternary.trueExpression);
    this.visit(ternary.falseExpression);
    return { type: 'unknown' };
  }

  private addPathCondition(cond: ASTNode, isPositive: boolean): void {
    if (cond.type !== 'BinaryOp') return;
    const bin = cond as BinaryOpNode;
    
    let op = isPositive ? bin.operator : this.negateOperator(bin.operator);
    if (!op) return;

    this.state.pathConditions.push({
      variable: this.expressionToString(bin.left),
      operator: op,
      value: this.expressionToString(bin.right),
    });
  }

  private negateOperator(op: string): string | null {
    const map: Record<string, string> = {
      '==': '!=', '!=': '==', '<': '>=', '>=': '<', '>': '<=', '<=': '>'
    };
    return map[op] || null;
  }

  private visitForLoop(node: ASTNode): SymbolicValue {
    const forNode = node as ForLoopNode;
    
    // 1. Initialize the loop variable
    if (forNode.init) this.visit(forNode.init);

    // 2. Prepare the body statements for the scanner
    // C++ bodies can be a single statement, an array, or a Block node
    let bodyStatements: ASTNode[] = [];
    if (Array.isArray(forNode.body)) {
        bodyStatements = forNode.body;
    } else if ((forNode.body as any).type === 'Block') {
        bodyStatements = (forNode.body as any).statements || [];
    } else {
        bodyStatements = [forNode.body as ASTNode];
    }

    // 3. The Gatekeeper: Identify if this loop hits zero
    if (forNode.condition) {
        const condStr = this.expressionToString(forNode.condition);
        const updateStr = forNode.update ? this.expressionToString(forNode.update) : "";

        const isBoundaryHit = />=|!=|>/.test(condStr) && /0/.test(condStr);
        const isDecrementing = updateStr.includes('--') || updateStr.includes('-=');

        if (isBoundaryHit && isDecrementing) {
            const vars = this.extractVariables(forNode.condition);
            vars.forEach(v => {
                // Pass the ARRAY of statements to the recursive scanner
                this.checkLoopBodyForZeroRisk(bodyStatements, v);
            });
        }
    }

    // 4. Normal execution: Visit the body correctly
    // If it's an array, visit each item. If it's a node, visit the node.
    if (Array.isArray(forNode.body)) {
        forNode.body.forEach((stmt: ASTNode) => this.visit(stmt));
    } else {
        this.visit(forNode.body);
    }
    
    if (forNode.update) this.visit(forNode.update);
    
    return { type: 'unknown' };
}
  // ==========================================================================
  //  MISSING VISITORS (Fixes Unused Import Warnings)
  // ==========================================================================

 private visitWhileLoop(node: ASTNode): SymbolicValue {
    const loopNode = node as WhileLoopNode;
    
    // 1. Evaluate condition for dead code (e.g., while(0))
    const cond = this.visit(loopNode.condition);
    if (cond.type === 'concrete' && cond.value === 0) return { type: 'unknown' };

    // 2. Normalize the body IMMEDIATELY
    // This makes bodyStatements available to both the Gatekeeper and Normal Execution
    let bodyStatements: ASTNode[] = [];
    if (Array.isArray(loopNode.body)) {
        bodyStatements = loopNode.body;
    } else if ((loopNode.body as any).type === 'Block') {
        bodyStatements = (loopNode.body as any).statements || [];
    } else {
        bodyStatements = [loopNode.body as ASTNode];
    }

    // 3. Boundary Simulation (The Gatekeeper)
    const condStr = this.expressionToString(loopNode.condition);
    const isBoundaryHit = />=|!=|>/.test(condStr) && /0/.test(condStr);
    
    if (isBoundaryHit) {
        const loopVars = this.extractVariables(loopNode.condition);
        loopVars.forEach(v => {
            // Now bodyStatements is safely in scope
            this.checkLoopBodyForZeroRisk(bodyStatements, v);
        });
    }

    // 4. Normal Execution
    // We can now use the normalized array for a cleaner loop
    bodyStatements.forEach(stmt => this.visit(stmt));
    
    return { type: 'unknown' };
}

  private visitDoWhileLoop(node: ASTNode): SymbolicValue {
    const loop = node as DoWhileLoopNode;
    // Do-while always executes body at least once
    loop.body.forEach(stmt => this.visit(stmt));
    this.visit(loop.condition);
    return { type: 'unknown' };
  }

  private visitSwitchStatement(node: ASTNode): SymbolicValue {
    const sw = node as SwitchStatementNode;
    this.visit(sw.condition);
    // Visit all cases to ensure we catch errors in every branch
    sw.cases.forEach(c => {
        if (c.value) this.visit(c.value);
        c.statements.forEach(stmt => this.visit(stmt));
    });
    return { type: 'unknown' };
  }

  private visitReturnStatement(node: ASTNode): SymbolicValue {
    const ret = node as ReturnStatementNode;
    if (ret.value) {
        // Visit return value to ensure variables used are initialized
        return this.visit(ret.value);
    }
    return { type: 'unknown' };
  }

  private visitInitializerList(node: ASTNode): SymbolicValue {
    const list = node as InitializerListNode;
    // Visit all elements (e.g., int a[] = {1, 2, x}) to check 'x'
    list.values.forEach(val => this.visit(val));
    return { type: 'unknown' };
  }

  private visitGlobalAccess(node: ASTNode): SymbolicValue {
    const global = node as GlobalAccessNode;
    // Check if the global variable exists/is initialized
    return this.visitIdentifier({ type: 'Identifier', name: global.name } as any);
  }

  private visitLoopControl(node: ASTNode): SymbolicValue {
    // node is LoopControlNode (break/continue). 
    // Logic: No specific symbolic value, just flow control.
    const ctrl = node as LoopControlNode; 
    return { type: 'unknown' }; 
  }

  private visitCastExpression(node: ASTNode): SymbolicValue {
    const cast = node as CastExpressionNode;
    // Logic: The value survives the cast, check the operand
    return this.visit(cast.operand);
  }

  private visitSizeofExpression(node: ASTNode): SymbolicValue {
    const sizeof = node as SizeofExpressionNode;
    // Logic: Verify the variable inside sizeof exists
    this.visit(sizeof.value);
    return { type: 'concrete', value: 4 }; // Mock size
  }

  private visitLambdaExpression(node: ASTNode): SymbolicValue {
    const lambda = node as LambdaExpressionNode;
    const previousScope = this.currentScope;
    this.currentScope = 'lambda';
    
    // Lambdas have their own scope
    lambda.body.forEach(stmt => this.visit(stmt));
    
    this.currentScope = previousScope;
    return { type: 'unknown' };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Operations & Safety Checks
  // ─────────────────────────────────────────────────────────────────────────────

  private visitBinaryOp(node: ASTNode): SymbolicValue {
    const binOp = node as BinaryOpNode;
    const left = this.visit(binOp.left);

    // 1. Handle Short-Circuiting (&&)
    if (binOp.operator === '&&') {
        if (left.type === 'concrete' && left.value === 0) return left; // false && anything = false
        const right = this.visit(binOp.right);
        if (left.type === 'concrete' && right.type === 'concrete') {
            return { type: 'concrete', value: (left.value !== 0 && right.value !== 0) ? 1 : 0 };
        }
        return { type: 'unknown' };
    }

    // 2. Handle Short-Circuiting (||)
    if (binOp.operator === '||') {
        if (left.type === 'concrete' && left.value !== 0) return { type: 'concrete', value: 1 }; // true || anything = true
        const right = this.visit(binOp.right);
        if (left.type === 'concrete' && right.type === 'concrete') {
            return { type: 'concrete', value: (left.value !== 0 || right.value !== 0) ? 1 : 0 };
        }
        return { type: 'unknown' };
    }

    // 3. Handle Standard Math Operators
    const right = this.visit(binOp.right);
    
    // Safety check for division
    if (binOp.operator === '/' || binOp.operator === '%') {
        this.checkDivisionByZero(binOp, right);
    }

    if (left.type === 'concrete' && right.type === 'concrete') {
        return this.evaluateConcrete(binOp.operator, left.value, right.value);
    }
    
    return { type: 'unknown' }; 
}

  private visitUnaryOp(node: ASTNode): SymbolicValue {
    const u = node as UnaryOpNode;
    const name = typeof u.operand === 'string' ? u.operand : (u.operand as any).name;
    if (!name) return { type: 'unknown' };

    const sym = this.state.variables.get(name);

    // 1. Handle Pointer Safety
    if (node.type === 'Dereference') {
      if (!sym || (sym.type === 'symbolic' && sym.nullable && !this.provenNotNull(name))) {
         this.addSafetyCheck(node.line || 0, 'pointer_dereference', 'WARNING', `Possible null pointer dereference: *${name}`);
      }
      return { type: 'unknown' };
    }

    // 2. Catch Arithmetic on Uninitialized (Garbage) Values
    if (['PreIncrement', 'PostIncrement', 'PreDecrement', 'PostDecrement'].includes(node.type)) {
      if (!this.state.initialized.has(name)) {
        this.addSafetyCheck(node.line || 0, 'arithmetic', 'WARNING', `Operation on uninitialized variable: ${name}`);
      }
    }

    // 3. Process Concrete Math and Preserve Metadata
    if (sym?.type === 'concrete') {
      let val = sym.value;
      if (node.type.includes('Increment')) val++;
      if (node.type.includes('Decrement')) val--;
      
      // Update state: ensure arraySize metadata survives the increment
      const newValue: SymbolicValue = { type: 'concrete', value: val, arraySize: sym.arraySize };
      this.state.variables.set(name, newValue);
      
      // Mark as initialized now that a concrete operation has occurred
      this.state.initialized.add(name);
      
      return newValue;
    }
    
    return { type: 'unknown' };
}

 // MODIFIED: Added specific error code arguments ('array_access', 'UNSAFE')
private visitArrayAccess(node: ASTNode): SymbolicValue {
    const access = node as ArrayAccessNode;
    // CRITICAL: Resolve the index (handles both numbers and variables like 'idx')
    const indexRes = this.visit(access.indices[0]); 
    const arrVar = this.state.variables.get(access.name);

    if (arrVar && 'arraySize' in arrVar && arrVar.arraySize !== undefined) {
        const size = arrVar.arraySize; 

        if (indexRes.type === 'concrete') {
            if (indexRes.value < 0 || indexRes.value >= size) {
                this.addSafetyCheck(
                    node.line || 0,
                    'array_access', 
                    'UNSAFE', 
                    `Array index out of bounds: Index ${indexRes.value} is outside valid range [0, ${size - 1}]`
                );
            }
        } 
    }
    return { type: 'unknown' };
}
  // ─────────────────────────────────────────────────────────────────────────────
  // Literals & Helpers
  // ─────────────────────────────────────────────────────────────────────────────

  private visitInteger(node: any): SymbolicValue { return { type: 'concrete', value: node.value }; }
  private visitFloat(node: any): SymbolicValue { return { type: 'concrete', value: node.value }; }
  // MODIFIED: Added arguments for read variable check
private visitIdentifier(node: ASTNode): SymbolicValue {
    const name = (node as any).name;
    const val = this.state.variables.get(name);
    if (val && val.type !== 'concrete' && !this.state.initialized.has(name)) {
      // FIXED: Added all 4 arguments
      this.addSafetyCheck(node.line || 0, 'read_variable', 'WARNING', `Use of uninitialized variable '${name}'`);
    }
    return val || { type: 'unknown' };
  }

  private visitLiteral(node: any): SymbolicValue {
    const val = String(node.value);
    if (val === 'true') return { type: 'concrete', value: 1 };
    if (val === 'false') return { type: 'concrete', value: 0 };
    return { type: 'concrete', value: parseFloat(val) || 0 };
  }

  // MODIFIED: Added arguments for both UNSAFE and WARNING cases
private checkDivisionByZero(node: BinaryOpNode, divisor: SymbolicValue): void {
    if (divisor.type === 'concrete' && divisor.value === 0) {
      // FIXED: Added all 4 arguments
      this.addSafetyCheck(node.line || 0, this.expressionToString(node), 'UNSAFE', 'Division by zero detected');
    } else if (divisor.type === 'symbolic' && !this.provenNotNull(divisor.name)) {
      // FIXED: Added all 4 arguments
      this.addSafetyCheck(node.line || 0, this.expressionToString(node), 'WARNING', 'Possible division by zero');
    }
  }

private checkLoopBodyForZeroRisk(body: ASTNode[] | ASTNode | null, varName: string): void {
    const cleanVarName = varName.trim(); // 🚨 CLEAN THE VARIABLE NAME
    const walk = (n: any) => {
        if (!n || typeof n === 'string') return;
        
        if (n.type === 'BinaryOp' && (n.operator === '/' || n.operator === '%')) {
            const divisorVars = this.extractVariables(n.right);
            // Check against the cleaned name
            if (Array.from(divisorVars).some(v => v.trim() === cleanVarName)) {
                this.addSafetyCheck(
                    n.line || 0, 
                    cleanVarName, 
                    'UNSAFE', 
                    `Division by zero detected: Loop variable '${cleanVarName}' will hit 0.`
                );
            }
        }
        
        // 2. Deep Recursion
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

    // Entry point: handle both single nodes and arrays of nodes
    if (Array.isArray(body)) {
        body.forEach(walk);
    } else {
        walk(body);
    }
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
      if (s.type === 'Assignment') mods.add((s as AssignmentNode).target as string);
      if (s.type.includes('Increment')) mods.add((s as any).operand);
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
      case '&&': res = (l && r) ? 1 : 0; break;
      case '||': res = (l || r) ? 1 : 0; break;
      case '==': res = (l === r) ? 1 : 0; break;
      case '!=': res = (l !== r) ? 1 : 0; break;
      // ADD THESE:
      case '<':  res = l < r ? 1 : 0; break;
      case '>':  res = l > r ? 1 : 0; break;
      case '<=': res = l <= r ? 1 : 0; break;
      case '>=': res = l >= r ? 1 : 0; break;
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
    
    // PEG.js robustness: Check name, value, id, and the node itself
    if (node.type === 'Identifier') {
        return node.name || node.value || node.id || (typeof node === 'string' ? node : "?");
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
      initialized: new Set(this.state.initialized)
    };
  }

  // MODIFIED: Changed signature to accept 4 arguments instead of 2
private addSafetyCheck(line: number, operation: string, status: 'SAFE' | 'UNSAFE' | 'WARNING', message: string) {
    this.safetyChecks.push({
      line,
      operation,
      status,
      message
    });
  }
  private visitBlock(node: any): SymbolicValue {
    node.statements?.forEach((s: ASTNode) => this.visit(s));
    return { type: 'unknown' };
  }

  private visitExpressionStatement(node: any): SymbolicValue {
    return this.visit(node.expression);
  }

  private visitParameter(node: any): SymbolicValue { return { type: 'unknown' }; }
  private visitType(node: any): SymbolicValue { return { type: 'unknown' }; }

  // ─────────────────────────────────────────────────────────────────────────────
  // Stream I/O Handlers (NEW: Full chaining support)
  // ─────────────────────────────────────────────────────────────────────────────

  private visitCinStatement(node: ASTNode): SymbolicValue {
      const cinNode = node as any;
      
      // NEW: Handle chained cin (cin >> x >> y >> arr[i])
      if (cinNode.targets && Array.isArray(cinNode.targets)) {
          cinNode.targets.forEach((target: string | ASTNode) => {
              if (typeof target === 'string') {
                  // Simple identifier
                  this.state.initialized.add(target);
                  this.state.variables.set(target, { type: 'symbolic', name: target, constraints: [] });
              } else if (target.type === 'ArrayAccess') {
                  // Array element: mark array as initialized, validate bounds
                  const arrayAccess = target as any;
                  this.visit(arrayAccess); // Triggers bounds checking
                  this.state.initialized.add(arrayAccess.name);
              }
          });
      }
      // LEGACY: Handle old single-target format
      else if (cinNode.target) {
          this.state.initialized.add(cinNode.target);
          this.state.variables.set(cinNode.target, { type: 'symbolic', name: cinNode.target, constraints: [] });
      }
      
      return { type: 'unknown' };
  }

  private visitCoutStatement(node: ASTNode): SymbolicValue {
      const coutNode = node as any;
      
      // NEW: Handle chained cout (cout << a << b << c)
      if (coutNode.values && Array.isArray(coutNode.values)) {
          coutNode.values.forEach((expr: ASTNode) => {
              this.visit(expr); // Evaluate each expression (triggers safety checks)
          });
      }
      // LEGACY: Handle old single-value format
      else if (coutNode.value) {
          this.visit(coutNode.value);
      }
      
      return { type: 'unknown' };
  }
}