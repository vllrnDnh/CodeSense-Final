/**
 * CodeSense Mentor (Translator)
 * Explains every part of the analysis pipeline in simple words.
 * Handles PEG.js nodes, TypeChecker logic, and Symbolic Execution risks.
 */

import {
  ASTNode,
  VariableDeclNode,
  IfStatementNode,
  WhileLoopNode,
  ForLoopNode,
  AssignmentNode,
  BinaryOpNode,
  FunctionDeclNode,
  ReturnStatementNode,
  ProgramNode,
  FunctionCallNode,
  DoWhileLoopNode,
  SwitchStatementNode,
  ExpressionStatementNode
} from '../types';

export class Translator {
  private explanations: string[] = [];

  /**
   * Cleans names that might come in as arrays/comma-separated strings from the parser.
   * Uses flat(Infinity) to handle nested arrays from PEG.js and ensures a clean string.
   */
  private cleanName(name: any): string {
    if (!name) return 'unknown';
    
    // MODIFIED: Use flat(Infinity) to ensure nested character arrays are flattened before joining
    const flatName = Array.isArray(name) ? name.flat(Infinity).join('') : String(name);
    
    // Strip any lingering commas and whitespace
    return flatName.replace(/,/g, '').trim();
  }

  translate(ast: ASTNode): string[] {
    this.explanations = [];
    this.visit(ast);
    return this.explanations;
  }

  private visit(node: ASTNode | null | string): void {
    if (!node || typeof node === 'string') return;
    
    // Explicitly call the I/O translators
    if (node.type === 'CoutStatement') {
        return this.visitCoutStatement(node);
    }
    if (node.type === 'CinStatement') {
        return this.visitCinStatement(node);
    }

    const methodName = `visit${node.type}` as keyof this;
    if (typeof this[methodName] === 'function') {
      (this[methodName] as any).call(this, node);
    } else if ('body' in node) {
       (node as any).body.forEach((stmt: ASTNode) => this.visit(stmt));
    } else if ('statements' in node) {
       (node as any).statements.forEach((stmt: ASTNode) => this.visit(stmt));
    }
  }

  // =========================================================================
  //  Simplified Mentor Explanations (Synchronized with All Phases)
  // =========================================================================

  private visitFunctionCall(node: FunctionCallNode): void {
    const name = this.cleanName(node.name);
    this.explanations.push(`📞 **Call:** Run the task named **'${name}'** using the values provided.`);
    if (node.arguments && Array.isArray(node.arguments)) {
      node.arguments.forEach(arg => this.visit(arg));
    }
  }

  private visitDoWhileLoop(node: DoWhileLoopNode): void {
    this.explanations.push("🔄 **Do-While:** Perform these steps first, then check if we should repeat them:");
    node.body.forEach(stmt => this.visit(stmt));
    this.explanations.push(`⚖️ **Check:** Repeat if **(${this.formatExpr(node.condition)})** is true.`);
  }

  private visitSwitchStatement(node: SwitchStatementNode): void {
    this.explanations.push(`🚦 **Switch:** Look at the value of **'${this.formatExpr(node.condition)}'** and find the matching case:`);
    node.cases.forEach(c => {
      const caseLabel = c.value ? `Case ${this.formatExpr(c.value)}` : "Default (if no match)";
      this.explanations.push(`  📍 **${caseLabel}:**`);
      c.statements.forEach(stmt => this.visit(stmt));
    });
  }

  private visitExpressionStatement(node: ExpressionStatementNode): void {
    this.visit(node.expression);
  }

  private visitProgram(node: ProgramNode): void {
    this.explanations.push("🚀 **Start:** I am scanning your code to understand your logic.");
    if (node.directives && node.directives.length > 0) {
        this.explanations.push("📋 **Tools:** You brought in special toolkits (like iostream) to help with standard tasks.");
    }
    node.body.forEach(stmt => this.visit(stmt));
    this.explanations.push("🏁 **Finish:** I've reached the end of your instructions.");
  }

  private visitVariableDecl(node: VariableDeclNode): void {
    const name = this.cleanName(node.name);
    
    // 1. Check if "const" exists in the modifiers array we added to the grammar
    const isConstant = node.modifiers && node.modifiers.includes('const');
    
    // 2. Select the correct metaphor based on the modifier
    const icon = isConstant ? "❄️ **Frozen Value:**" : "📦 **Storage:**";
    const action = isConstant ? "Create a permanent" : "Declare a";
    
    let msg = `${icon} ${action} ${node.varType} variable named '${name}'`;
    
    if (node.value) {
      msg += ` and initialize it with ${this.formatExpr(node.value)}`;
    }
    
    this.explanations.push(msg + ".");

    // 3. Add the specific metaphor explanation for the "Constant Storage" test
    if (isConstant) {
      this.explanations.push(`   🔒 **Note:** Because this is 'const', its value is frozen and cannot be changed later.`);
    }
  }

  private visitCoutStatement(node: any): void {
  // Use 'values' to support chained output like cout << x << y;
  const outputs = node.values 
    ? node.values.map((expr: any) => this.formatExpr(expr)).join(', ')
    : "information";

  this.explanations.push(`🖥️ **Screen:** Show the current value of **${outputs}** to the user.`);
  
  if (node.values) {
    node.values.forEach((expr: any) => {
      if (expr.type === 'Identifier') {
        const name = this.cleanName(expr.name);
        this.explanations.push(`   🔍 I am grabbing the data currently stored in the variable **'${name}'** to display it.`);
      }
    });
  }
}

  private visitCinStatement(node: any): void {
  // Use 'targets' as defined in types/index.ts
  const targetNames = node.targets 
    ? node.targets.map((t: any) => typeof t === 'string' ? t : this.cleanName(t.name)).join(' and ')
    : "a variable";
  
  this.explanations.push(`⌨️ **Keyboard:** Wait for the user to type a value and save it directly into the **'${targetNames}'** variable.`);
  this.explanations.push(`   📝 **Note:** This will overwrite whatever was previously stored in **'${targetNames}'**.`);
}

  private visitAssignment(node: AssignmentNode): void {
    const target = typeof node.target === 'string' ? this.cleanName(node.target) : 'a slot in an array';
    this.explanations.push(`📝 **Update:** Change the value inside **'${target}'** to **${this.formatExpr(node.value)}**.`);
  }

  private visitIfStatement(node: IfStatementNode): void {
    // FIX: Using "Choice" metaphor for test compatibility
    this.explanations.push(`⚖️ **Choice:** Look at this condition: **(${this.formatExpr(node.condition)})**.`);
    this.explanations.push("  ✅ **If it's TRUE:** Follow this path:");
    node.thenBranch.forEach(stmt => this.visit(stmt));

    if (node.elseBranch) {
      this.explanations.push("  ❌ **If it's FALSE:** Go this way instead:");
      node.elseBranch.forEach(stmt => this.visit(stmt));
    }
  }

  private visitWhileLoop(node: WhileLoopNode): void {
    // FIX: Matches the test phrase: "Loop while the condition"
    this.explanations.push(`Loop while the condition (${this.formatExpr(node.condition)}) is TRUE:`);
    node.body.forEach(stmt => this.visit(stmt));
    this.explanations.push(`  (End of loop block)`);
  }

  private visitForLoop(node: ForLoopNode): void {
    this.explanations.push("🔁 **Structured Repeat:** A task that happens in three clear steps:");
    if (node.init) this.explanations.push(`  1️⃣ **First:** Set things up (**${this.formatExpr(node.init)}**).`);
    if (node.condition) this.explanations.push(`  2️⃣ **Check:** Only run if **(${this.formatExpr(node.condition)})** is true.`);
    if (node.update) this.explanations.push(`  3️⃣ **Step:** Update your counters (**${this.formatExpr(node.update)}**) after each round.`);
    node.body.forEach(stmt => this.visit(stmt));
  }

  private visitFunctionDecl(node: FunctionDeclNode): void {
    const name = this.cleanName(node.name);
    const isMain = name === 'main';
    const tutorNote = isMain ? " (This is the 'Main Entrance' where your code always starts)" : "";
    this.explanations.push(`🛠️ **New Task:** You created a task named **'${name}'**${tutorNote}. It will result in a **${node.returnType}**.`);
    node.body.forEach(stmt => this.visit(stmt));
  }

  private visitReturnStatement(node: ReturnStatementNode): void {
    const valMsg = node.value ? `hand back the result: **${this.formatExpr(node.value)}**` : "go back to where you started";
    this.explanations.push(`📤 **Done:** Exit this task and ${valMsg}.`);
  }


  // =========================================================================
  //  Helpers (Synchronized with PEG.js Node Structure)
  // =========================================================================

  private formatExpr(node: any): string {
    if (!node) return '?';
    if (node.type === 'BinaryOp') {
      const binOp = node as BinaryOpNode; 
      return `${this.formatExpr(binOp.left)} ${binOp.operator} ${this.formatExpr(binOp.right)}`;
    }
    if (node.type === 'Identifier') return this.cleanName(node.name);
    if (node.type === 'Integer' || node.type === 'Float') return node.value;
    if (node.type === 'String') return `"${node.value}"`;
    if (node.type === 'VariableDecl') return this.cleanName(node.name);
    return 'a value';
  }
}