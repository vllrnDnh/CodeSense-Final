/**
 * Cognitive Complexity Calculator
 * Measures code complexity based on control flow structures.
 * Updated to fully traverse expressions in conditions and headers.
 */

import {
  ASTNode,
  ProgramNode, // Added
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
  BlockNode, // Added
  ExpressionStatementNode, // Added
  VariableDeclNode, // Used to be unused
  ReturnStatementNode, // Used to be unused
  InitializerListNode // Used to be unused
} from '../types';

export class CognitiveComplexity {
  private complexity = 0;
  private nestingLevel = 0;
  private inFunction = false;

  /**
   * Calculate cognitive complexity of AST
   */
  calculate(ast: ASTNode): number {
    this.complexity = 0;
    this.nestingLevel = 0;
    this.inFunction = false;

    this.visit(ast);
    return this.complexity;
  }

  /**
   * Visit AST node
   */
  private visit(node: ASTNode | null | string): void {
    if (!node || typeof node === 'string') return;

    const methodName = `visit${node.type}` as keyof this;
    if (typeof this[methodName] === 'function') {
      (this[methodName] as any).call(this, node);
    }
  }

  /**
   * Visit Program
   */
  private visitProgram(node: ASTNode): void {
    // FIX: Cast to ProgramNode instead of any
    const programNode = node as ProgramNode;
    if (programNode.body) {
      programNode.body.forEach((stmt: ASTNode) => this.visit(stmt));
    }
  }

  /**
   * Visit Function Declaration
   */
  private visitFunctionDecl(node: ASTNode): void {
    const funcNode = node as FunctionDeclNode;
    const wasInFunction = this.inFunction;
    this.inFunction = true;

    funcNode.body.forEach((stmt: ASTNode) => this.visit(stmt));

    this.inFunction = wasInFunction;
  }

  /**
   * Visit If Statement
   */
  private visitIfStatement(node: ASTNode): void {
    const ifNode = node as IfStatementNode;

    this.complexity += 1 + this.nestingLevel;
    this.visit(ifNode.condition);

    this.nestingLevel++;
    ifNode.thenBranch.forEach((stmt: ASTNode) => this.visit(stmt));

    if (ifNode.elseBranch) {
      const isElseIf = ifNode.elseBranch.length === 1 && 
                       ifNode.elseBranch[0].type === 'IfStatement';
      
      if (!isElseIf) {
        this.complexity += 1;
      }

      ifNode.elseBranch.forEach((stmt: ASTNode) => this.visit(stmt));
    }

    this.nestingLevel--;
  }

  /**
   * Visit While Loop
   */
  private visitWhileLoop(node: ASTNode): void {
    const whileNode = node as WhileLoopNode;
    this.complexity += 1 + this.nestingLevel;
    this.visit(whileNode.condition);

    this.nestingLevel++;
    whileNode.body.forEach((stmt: ASTNode) => this.visit(stmt));
    this.nestingLevel--;
  }

  /**
   * Visit Do-While Loop
   */
  private visitDoWhileLoop(node: ASTNode): void {
    const doWhileNode = node as DoWhileLoopNode;
    this.complexity += 1 + this.nestingLevel;
    this.visit(doWhileNode.condition);

    this.nestingLevel++;
    doWhileNode.body.forEach((stmt: ASTNode) => this.visit(stmt));
    this.nestingLevel--;
  }

  /**
   * Visit For Loop
   */
  private visitForLoop(node: ASTNode): void {
    const forNode = node as ForLoopNode;
    this.complexity += 1 + this.nestingLevel;

    if (forNode.init) this.visit(forNode.init);
    if (forNode.condition) this.visit(forNode.condition);
    if (forNode.update) this.visit(forNode.update);

    this.nestingLevel++;
    forNode.body.forEach((stmt: ASTNode) => this.visit(stmt));
    this.nestingLevel--;
  }

  /**
   * Visit Switch Statement
   */
  private visitSwitchStatement(node: ASTNode): void {
    const switchNode = node as SwitchStatementNode;
    this.complexity += 1 + this.nestingLevel;
    this.visit(switchNode.condition);

    this.nestingLevel++;
    switchNode.cases.forEach((caseNode: CaseNode) => {
      if (caseNode.value) this.visit(caseNode.value);
      caseNode.statements.forEach((stmt: ASTNode) => this.visit(stmt));
    });
    this.nestingLevel--;
  }

  /**
   * Visit Conditional Expression (ternary)
   */
  private visitConditionalExpression(node: ASTNode): void {
    const ternaryNode = node as ConditionalExpressionNode;
    this.complexity += 1 + this.nestingLevel;
    this.visit(ternaryNode.condition);
    this.visit(ternaryNode.trueExpression);
    this.visit(ternaryNode.falseExpression);
  }

  /**
   * Visit Binary Operation
   */
  private visitBinaryOp(node: ASTNode): void {
    const binOp = node as BinaryOpNode;
    if (binOp.operator === '&&' || binOp.operator === '||') {
      this.complexity += 1;
    }
    this.visit(binOp.left);
    this.visit(binOp.right);
  }

  /**
   * Visit Lambda Expression
   */
  private visitLambdaExpression(node: ASTNode): void {
    const lambdaNode = node as LambdaExpressionNode;
    this.nestingLevel++;
    lambdaNode.body.forEach((stmt: ASTNode) => this.visit(stmt));
    this.nestingLevel--;
  }

  /**
   * Visit Assignment
   */
  private visitAssignment(node: ASTNode): void {
    const assignNode = node as AssignmentNode;
    if (assignNode.target && typeof assignNode.target !== 'string') {
        this.visit(assignNode.target);
    }
    if (assignNode.value) {
      this.visit(assignNode.value);
    }
  }

  /**
   * Visit Function Call
   */
  private visitFunctionCall(node: ASTNode): void {
    const callNode = node as FunctionCallNode;
    if (callNode.arguments) {
      callNode.arguments.forEach((arg: ASTNode) => this.visit(arg));
    }
  }

  /**
   * Visit Array Access
   */
  private visitArrayAccess(node: ASTNode): void {
    const arrayNode = node as ArrayAccessNode;
    if (arrayNode.indices) {
      arrayNode.indices.forEach((index: ASTNode) => this.visit(index));
    }
  }

  // =========================================================================
  //  STRICT TYPE CASTING (Fixes "Value Never Read" Errors)
  // =========================================================================

  private visitBlock(node: ASTNode): void {
    // FIX: Use strict type
    const blockNode = node as BlockNode;
    if (blockNode.statements) {
      blockNode.statements.forEach((stmt: ASTNode) => this.visit(stmt));
    }
  }

  private visitExpressionStatement(node: ASTNode): void {
    // FIX: Use strict type
    const exprNode = node as ExpressionStatementNode;
    if (exprNode.expression) {
      this.visit(exprNode.expression);
    }
  }

  private visitVariableDecl(node: ASTNode): void {
    // FIX: Use strict type
    const varNode = node as VariableDeclNode;
    if (varNode.value) {
      this.visit(varNode.value);
    }
  }

  private visitReturnStatement(node: ASTNode): void {
    // FIX: Use strict type
    const returnNode = node as ReturnStatementNode;
    if (returnNode.value) {
      this.visit(returnNode.value);
    }
  }

  private visitInitializerList(node: ASTNode): void {
    // FIX: Use strict type
    const initList = node as InitializerListNode;
    if (initList.values) {
      initList.values.forEach((val: ASTNode) => this.visit(val));
    }
  }

  private visitUnaryOp(node: ASTNode): void {
    const unaryNode = node as UnaryOpNode;
    if (unaryNode.operand && typeof unaryNode.operand !== 'string') {
      this.visit(unaryNode.operand as ASTNode);
    }
  }

  // Alias visitors
  private visitPreIncrement(node: ASTNode): void { this.visitUnaryOp(node); }
  private visitPostIncrement(node: ASTNode): void { this.visitUnaryOp(node); }
  private visitPreDecrement(node: ASTNode): void { this.visitUnaryOp(node); }
  private visitPostDecrement(node: ASTNode): void { this.visitUnaryOp(node); }
  private visitAddressOf(node: ASTNode): void { this.visitUnaryOp(node); }
  private visitDereference(node: ASTNode): void { this.visitUnaryOp(node); }

  private visitCastExpression(node: ASTNode): void {
    const castNode = node as CastExpressionNode;
    this.visit(castNode.operand);
  }

  private visitSizeofExpression(node: ASTNode): void {
    const sizeofNode = node as SizeofExpressionNode;
    this.visit(sizeofNode.value);
  }

  // No-ops
  private visitIdentifier(): void {}
  private visitInteger(): void {}
  private visitFloat(): void {}
  private visitChar(): void {}
  private visitString(): void {}
  private visitLiteral(): void {}
  private visitParameter(): void {}
  private visitBreakStatement(): void {}
  private visitContinueStatement(): void {}
  private visitLoopControl(): void {}
  private visitCinStatement(): void {}
  private visitCoutStatement(): void {} 
  
  // Preprocessor directives (no impact on cognitive complexity)
  private visitInclude(): void {}
  private visitDefine(): void {}
  private visitUndef(): void {}
  private visitIfDef(): void {}
  private visitIfNDef(): void {}
  private visitIf(): void {}
  private visitElIf(): void {}
  private visitElse(): void {}
  private visitEndIf(): void {}
  private visitPragma(): void {}
  private visitError(): void {}
  private visitWarning(): void {}
  private visitLine(): void {}
  private visitDefined(): void {}
  private visitMacroText(): void {}
  private visitNamespace(): void {}
}