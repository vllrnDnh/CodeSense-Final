/**
 * Cognitive Complexity Calculator
 * Measures code complexity based on control flow structures.
 * Updated to fully traverse expressions in conditions and headers.
 */

import {
  ASTNode,
  ProgramNode,
  FunctionDeclNode,
  IfStatementNode,
  WhileLoopNode,
  DoWhileLoopNode,
  ForLoopNode,
  SwitchStatementNode,
  CaseNode,
  BinaryOpNode,
  ConditionalExpressionNode,
  LambdaExpressionNode,
  UnaryOpNode,
  CastExpressionNode,
  SizeofExpressionNode,
  FunctionCallNode,
  ArrayAccessNode,
  AssignmentNode,
  BlockNode,
  ExpressionStatementNode,
  VariableDeclNode,
  ReturnStatementNode,
  InitializerListNode,
} from '../types';

export class CognitiveComplexity {
  private complexity = 0;
  private nestingLevel = 0;
  private inFunction = false;

  calculate(ast: ASTNode): number {
    this.complexity = 0;
    this.nestingLevel = 0;
    this.inFunction = false;
    this.visit(ast);
    return this.complexity;
  }

  private visit(node: ASTNode | null | string): void {
    if (!node || typeof node === 'string') return;
    const methodName = `visit${node.type}`;
    if (typeof (this as any)[methodName] === 'function') {
      (this as any)[methodName](node);
    }
  }

  // ── Program ───────────────────────────────────────────────────────────────
  private visitProgram(node: ASTNode): void {
    const prog = node as ProgramNode;
    // Visit preprocessor directives in case they contain expressions
    (prog.directives || []).forEach((d: ASTNode) => this.visit(d));
    if (prog.body) {
      prog.body.forEach((stmt: ASTNode) => this.visit(stmt));
    }
  }

  // ── Functions ─────────────────────────────────────────────────────────────
  private visitFunctionDecl(node: ASTNode): void {
    const funcNode = node as FunctionDeclNode;
    const wasInFunction = this.inFunction;
    this.inFunction = true;
    (funcNode.body || []).forEach((stmt: ASTNode) => this.visit(stmt));
    this.inFunction = wasInFunction;
  }

  private visitFunctionPrototype(_node: ASTNode): void {
    // Prototypes are forward declarations — no complexity contribution.
  }

  // ── Control Flow ──────────────────────────────────────────────────────────
  private visitIfStatement(node: ASTNode): void {
    const ifNode = node as IfStatementNode;
    this.complexity += 1 + this.nestingLevel;
    this.visit(ifNode.condition);

    this.nestingLevel++;
    (ifNode.thenBranch || []).forEach((stmt: ASTNode) => this.visit(stmt));

    if (ifNode.elseBranch && ifNode.elseBranch.length > 0) {
      const isElseIf =
        ifNode.elseBranch.length === 1 &&
        ifNode.elseBranch[0].type === 'IfStatement';
      if (!isElseIf) {
        this.complexity += 1;
      }
      ifNode.elseBranch.forEach((stmt: ASTNode) => this.visit(stmt));
    }
    this.nestingLevel--;
  }

  private visitWhileLoop(node: ASTNode): void {
    const whileNode = node as WhileLoopNode;
    this.complexity += 1 + this.nestingLevel;
    this.visit(whileNode.condition);
    this.nestingLevel++;
    (whileNode.body || []).forEach((stmt: ASTNode) => this.visit(stmt));
    this.nestingLevel--;
  }

  private visitDoWhileLoop(node: ASTNode): void {
    const doWhileNode = node as DoWhileLoopNode;
    this.complexity += 1 + this.nestingLevel;
    this.visit(doWhileNode.condition);
    this.nestingLevel++;
    (doWhileNode.body || []).forEach((stmt: ASTNode) => this.visit(stmt));
    this.nestingLevel--;
  }

  private visitForLoop(node: ASTNode): void {
    const forNode = node as ForLoopNode;
    this.complexity += 1 + this.nestingLevel;
    if (forNode.init)      this.visit(forNode.init);
    if (forNode.condition) this.visit(forNode.condition);
    if (forNode.update)    this.visit(forNode.update);
    this.nestingLevel++;
    (forNode.body || []).forEach((stmt: ASTNode) => this.visit(stmt));
    this.nestingLevel--;
  }

  private visitSwitchStatement(node: ASTNode): void {
    const switchNode = node as SwitchStatementNode;
    this.complexity += 1 + this.nestingLevel;
    this.visit(switchNode.condition);
    this.nestingLevel++;
    (switchNode.cases || []).forEach((caseNode: CaseNode) => {
      if (caseNode.value) this.visit(caseNode.value);
      (caseNode.statements || []).forEach((stmt: ASTNode) => this.visit(stmt));
    });
    this.nestingLevel--;
  }

  private visitCase(node: ASTNode): void {
    const c = node as unknown as CaseNode;
    if (c.value) this.visit(c.value);
    (c.statements || []).forEach((stmt: ASTNode) => this.visit(stmt));
  }

  private visitDefaultCase(node: ASTNode): void {
    this.visitCase(node);
  }

  private visitConditionalExpression(node: ASTNode): void {
    const ternaryNode = node as ConditionalExpressionNode;
    this.complexity += 1 + this.nestingLevel;
    this.visit(ternaryNode.condition);
    this.nestingLevel++;
    this.visit(ternaryNode.trueExpression);
    this.visit(ternaryNode.falseExpression);
    this.nestingLevel--;
  }

  private visitBinaryOp(node: ASTNode): void {
    const binOp = node as BinaryOpNode;
    if (binOp.operator === '&&' || binOp.operator === '||') {
      this.complexity += 1;
    }
    this.visit(binOp.left);
    this.visit(binOp.right);
  }

  private visitLambdaExpression(node: ASTNode): void {
    const lambdaNode = node as LambdaExpressionNode;
    this.nestingLevel++;
    (lambdaNode.body || []).forEach((stmt: ASTNode) => this.visit(stmt));
    this.nestingLevel--;
  }

  // ── Statements ────────────────────────────────────────────────────────────
  private visitAssignment(node: ASTNode): void {
    const assignNode = node as AssignmentNode;
    if (assignNode.target && typeof assignNode.target !== 'string') {
      this.visit(assignNode.target);
    }
    if (assignNode.value) {
      this.visit(assignNode.value);
    }
  }

  private visitBlock(node: ASTNode): void {
    const blockNode = node as BlockNode;
    (blockNode.statements || []).forEach((stmt: ASTNode) => this.visit(stmt));
  }

  private visitExpressionStatement(node: ASTNode): void {
    const exprNode = node as ExpressionStatementNode;
    if (exprNode.expression) this.visit(exprNode.expression);
  }

  private visitVariableDecl(node: ASTNode): void {
    const varNode = node as VariableDeclNode;
    if (varNode.value) this.visit(varNode.value);
    (varNode.dimensions || []).forEach((d: ASTNode) => this.visit(d));
  }

  private visitReturnStatement(node: ASTNode): void {
    const returnNode = node as ReturnStatementNode;
    if (returnNode.value) this.visit(returnNode.value);
  }

  private visitInitializerList(node: ASTNode): void {
    const initList = node as InitializerListNode;
    (initList.values || []).forEach((val: ASTNode) => this.visit(val));
  }

  // ── Function Call & Array Access ──────────────────────────────────────────
  private visitFunctionCall(node: ASTNode): void {
    const callNode = node as FunctionCallNode;
    (callNode.arguments || []).forEach((arg: ASTNode) => this.visit(arg));
  }

  private visitArrayAccess(node: ASTNode): void {
    const arrayNode = node as ArrayAccessNode;
    (arrayNode.indices || []).forEach((index: ASTNode) => this.visit(index));
  }

  // ── Unary Operators ───────────────────────────────────────────────────────
  private visitUnaryOp(node: ASTNode): void {
    const unaryNode = node as UnaryOpNode;
    if (unaryNode.operand && typeof unaryNode.operand !== 'string') {
      this.visit(unaryNode.operand as ASTNode);
    }
  }

  private visitPreIncrement(node: ASTNode):  void { this.visitUnaryOp(node); }
  private visitPostIncrement(node: ASTNode): void { this.visitUnaryOp(node); }
  private visitPreDecrement(node: ASTNode):  void { this.visitUnaryOp(node); }
  private visitPostDecrement(node: ASTNode): void { this.visitUnaryOp(node); }
  private visitAddressOf(node: ASTNode):     void { this.visitUnaryOp(node); }
  private visitDereference(node: ASTNode):   void { this.visitUnaryOp(node); }

  private visitCastExpression(node: ASTNode): void {
    const castNode = node as CastExpressionNode;
    this.visit(castNode.operand);
  }

  private visitSizeofExpression(node: ASTNode): void {
    const sizeofNode = node as SizeofExpressionNode;
    this.visit(sizeofNode.value);
  }

  // ── No-ops ────────────────────────────────────────────────────────────────
  private visitIdentifier(): void {}
  private visitInteger():    void {}
  private visitFloat():      void {}
  private visitChar():       void {}
  private visitString():     void {}
  private visitLiteral():    void {}  // BooleanLiteral (true/false)
  private visitParameter():  void {}
  private visitLoopControl(): void {}  // break / continue
  private visitGlobalAccess(): void {}
  private visitNewExpression(): void {}    // allocation alone ≠ complexity
  private visitDeleteStatement(): void {}  // deallocation alone ≠ complexity
  private visitCinStatement():  void {}
  private visitCoutStatement(): void {}

  // Preprocessor directives (no complexity impact)
  private visitInclude():   void {}
  private visitDefine():    void {}
  private visitUndef():     void {}
  private visitIfDef():     void {}
  private visitIfNDef():    void {}
  private visitIf():        void {}
  private visitElIf():      void {}
  private visitElse():      void {}
  private visitEndIf():     void {}
  private visitPragma():    void {}
  private visitError():     void {}
  private visitWarning():   void {}
  private visitLine():      void {}
  private visitDefined():   void {}
  private visitMacroText(): void {}
  private visitNamespace(): void {}
}

// ============================================================================
// Cyclomatic Complexity  V(G) = E - N + 2P
// Counts decision points: each if/for/while/do-while/case/catch/&&/||/?:
// ============================================================================
export interface CyclomaticResult {
  score: number;
  edges: number;
  nodes: number;
  rating: 'low' | 'moderate' | 'high' | 'very high';
  interpretation: string;
}

export class CyclomaticComplexity {
  private decisions = 0;

  calculate(ast: ASTNode): CyclomaticResult {
    this.decisions = 0;
    this.walk(ast);
    // V(G) = number of decisions + 1 (for a single function / connected component)
    const score = this.decisions + 1;
    return {
      score,
      edges: this.decisions + 1,     // simplified — actual edge count ≈ decisions + 1
      nodes: 1,                       // simplified representation
      rating: this.rate(score),
      interpretation: this.interpret(score),
    };
  }

  private walk(node: any): void {
    if (!node || typeof node !== 'object') return;

    switch (node.type) {
      case 'IfStatement':
        this.decisions += 1;
        if (node.elseBranch && node.elseBranch.length > 0) this.decisions += 1;
        break;
      case 'WhileLoop':
      case 'DoWhileLoop':
      case 'ForLoop':
      case 'RangeBasedFor':
        this.decisions += 1;
        break;
      case 'SwitchStatement':
        // Each case adds a decision; default is already counted as the fall-through
        (node.cases || []).forEach((c: any) => {
          if (c.type === 'Case') this.decisions += 1;
        });
        break;
      case 'CatchClause':
        this.decisions += 1;
        break;
      case 'ConditionalExpression': // ternary ? :
        this.decisions += 1;
        break;
      case 'BinaryOp':
        if (node.operator === '&&' || node.operator === '||') {
          this.decisions += 1;
        }
        break;
    }

    // Recurse into children
    for (const key of Object.keys(node)) {
      const child = node[key];
      if (Array.isArray(child)) {
        child.forEach((c: any) => this.walk(c));
      } else if (child && typeof child === 'object' && child.type) {
        this.walk(child);
      }
    }
  }

  private rate(score: number): 'low' | 'moderate' | 'high' | 'very high' {
    if (score <= 5)  return 'low';
    if (score <= 10) return 'moderate';
    if (score <= 20) return 'high';
    return 'very high';
  }

  private interpret(score: number): string {
    if (score <= 5)  return 'Simple, well-structured code. Easy to test and maintain.';
    if (score <= 10) return 'Moderate complexity. Consider splitting into smaller functions.';
    if (score <= 20) return 'High complexity. Hard to test fully — refactor is recommended.';
    return 'Very high complexity. This code is extremely risky and should be refactored immediately.';
  }
}