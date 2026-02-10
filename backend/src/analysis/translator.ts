/**
 * CodeSense Mentor (Translator) - Enhanced Version
 * Explains every part of the analysis pipeline in simple words.
 * Handles PEG.js nodes, TypeChecker logic, and Symbolic Execution risks.
 * 
 * NEW: Support for function prototypes, advanced expressions, and unary operators
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
  FunctionPrototypeNode,
  ReturnStatementNode,
  ProgramNode,
  FunctionCallNode,
  DoWhileLoopNode,
  SwitchStatementNode,
  ExpressionStatementNode,
  ConditionalExpressionNode,
  CastExpressionNode,
  SizeofExpressionNode,
  UnaryOpNode
} from '../types';

export class Translator {
  private explanations: string[] = [];

  /**
   * Cleans names that might come in as arrays/comma-separated strings from the parser.
   * Uses flat(Infinity) to handle nested arrays from PEG.js and ensures a clean string.
   */
  private cleanName(name: any): string {
    if (!name) return 'unknown';
    
    // Use flat(Infinity) to ensure nested character arrays are flattened before joining
    const flatName = Array.isArray(name) ? name.flat(Infinity).join('') : String(name);
    
    // Strip any lingering commas and whitespace
    return flatName.replace(/,/g, '').trim();
  }

  translate(ast: ASTNode): string[] {
    this.explanations = [];
    this.visit(ast);
    return this.explanations;
  }

  private visit(node: ASTNode | null | string | undefined): void {
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
  //  Core Language Features
  // =========================================================================

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
    
    // Check if "const" exists in the modifiers array
    const isConstant = node.modifiers && node.modifiers.includes('const');
    
    // Select the correct metaphor based on the modifier
    const icon = isConstant ? "❄️ **Frozen Value:**" : "📦 **Storage:**";
    const action = isConstant ? "Create a permanent" : "Declare a";
    
    let msg = `${icon} ${action} ${node.varType} variable named '${name}'`;
    
    if (node.value) {
      msg += ` and initialize it with ${this.formatExpr(node.value)}`;
    }
    
    this.explanations.push(msg + ".");

    // Add the specific metaphor explanation for constants
    if (isConstant) {
      this.explanations.push(`   🔒 **Note:** Because this is 'const', its value is frozen and cannot be changed later.`);
    }
  }

  private visitAssignment(node: AssignmentNode): void {
    const target = typeof node.target === 'string' ? this.cleanName(node.target) : 'a slot in an array';
    this.explanations.push(`✏️ **Update:** Change the value inside **'${target}'** to **${this.formatExpr(node.value)}**.`);
  }

  // =========================================================================
  //  Function Declarations & Prototypes (NEW)
  // =========================================================================

  private visitFunctionPrototype(node: FunctionPrototypeNode): void {
  const name = this.cleanName(node.name);
  
  // Build parameter list description
  const paramDesc = node.params.map((p: any) => {
    if (p.name) {
      return `${p.varType} ${p.name}`;
    } else {
      return p.varType; // Unnamed parameter
    }
  }).join(', ');
  
  this.explanations.push(
    `📋 **Forward Declaration:** You're announcing that a task named **'${name}'** exists with parameters (${paramDesc}) and will be defined later.`
  );
  this.explanations.push(
    `   💡 **Why?** This lets you use it before writing the full implementation.`
  );
}

  private visitFunctionDecl(node: FunctionDeclNode): void {
    const name = this.cleanName(node.name);
    const isMain = name === 'main';
    const tutorNote = isMain ? " (This is the 'Main Entrance' where your code always starts)" : "";
    this.explanations.push(`🛠️ **New Task:** You created a task named **'${name}'**${tutorNote}. It will result in a **${node.returnType}**.`);
    node.body.forEach(stmt => this.visit(stmt));
  }

  private visitFunctionCall(node: FunctionCallNode): void {
    const name = this.cleanName(node.name);
    this.explanations.push(`📞 **Call:** Run the task named **'${name}'** using the values provided.`);
    if (node.arguments && Array.isArray(node.arguments)) {
      node.arguments.forEach(arg => this.visit(arg));
    }
  }

  private visitReturnStatement(node: ReturnStatementNode): void {
    const valMsg = node.value ? `hand back the result: **${this.formatExpr(node.value)}**` : "go back to where you started";
    this.explanations.push(`📤 **Done:** Exit this task and ${valMsg}.`);
  }

  // =========================================================================
  //  Control Flow
  // =========================================================================

  private visitIfStatement(node: IfStatementNode): void {
    this.explanations.push(`⚖️ **Choice:** Look at this condition: **(${this.formatExpr(node.condition)})**.`);
    this.explanations.push("  ✅ **If it's TRUE:** Follow this path:");
    node.thenBranch.forEach(stmt => this.visit(stmt));

    if (node.elseBranch) {
      this.explanations.push("  ❌ **If it's FALSE:** Go this way instead:");
      node.elseBranch.forEach(stmt => this.visit(stmt));
    }
  }

  private visitWhileLoop(node: WhileLoopNode): void {
    this.explanations.push(`Loop while the condition (${this.formatExpr(node.condition)}) is TRUE:`);
    node.body.forEach(stmt => this.visit(stmt));
    this.explanations.push(`  (End of loop block)`);
  }

  private visitDoWhileLoop(node: DoWhileLoopNode): void {
    this.explanations.push("🔄 **Do-While:** Perform these steps first, then check if we should repeat them:");
    node.body.forEach(stmt => this.visit(stmt));
    this.explanations.push(`⚖️ **Check:** Repeat if **(${this.formatExpr(node.condition)})** is true.`);
  }

  private visitForLoop(node: ForLoopNode): void {
    this.explanations.push("🔁 **Structured Repeat:** A task that happens in three clear steps:");
    if (node.init) this.explanations.push(`  1️⃣ **First:** Set things up (**${this.formatExpr(node.init)}**).`);
    if (node.condition) this.explanations.push(`  2️⃣ **Check:** Only run if **(${this.formatExpr(node.condition)})** is true.`);
    if (node.update) this.explanations.push(`  3️⃣ **Step:** Update your counters (**${this.formatExpr(node.update)}**) after each round.`);
    node.body.forEach(stmt => this.visit(stmt));
  }

  private visitSwitchStatement(node: SwitchStatementNode): void {
    this.explanations.push(`🚦 **Switch:** Look at the value of **'${this.formatExpr(node.condition)}'** and find the matching case:`);
    node.cases.forEach(c => {
      const caseLabel = c.value ? `Case ${this.formatExpr(c.value)}` : "Default (if no match)";
      this.explanations.push(`  🏷️ **${caseLabel}:**`);
      c.statements.forEach(stmt => this.visit(stmt));
    });
  }

  // =========================================================================
  //  Advanced Expressions (NEW)
  // =========================================================================

  private visitConditionalExpression(node: ConditionalExpressionNode): void {
    this.explanations.push(
        `🔀 **Ternary Operator (? :):** This is a compact if-else statement in one line.`
    );
    this.explanations.push(
        `   📋 **How it works:** If **(${this.formatExpr(node.condition)})** is TRUE, use **${this.formatExpr(node.trueExpression)}**, otherwise use **${this.formatExpr(node.falseExpression)}**.`
    );
    this.explanations.push(
        `   💡 **Think of it as:** "condition ? value_if_true : value_if_false"`
    );
  }

  private visitCastExpression(node: CastExpressionNode): void {
    this.explanations.push(
        `🔄 **Type Conversion (Cast):** Force **${this.formatExpr(node.operand)}** to be treated as a **${node.targetType}**.`
    );
    this.explanations.push(
        `   ⚠️ **Caution:** This can lose data if you're converting from a larger type (like double) to a smaller one (like int).`
    );
  }

  private visitSizeofExpression(node: SizeofExpressionNode): void {
    this.explanations.push(
        `📏 **Sizeof:** Find out how many bytes of memory **${this.formatExpr(node.value)}** occupies.`
    );
    this.explanations.push(
        `   📊 **Example:** sizeof(int) is usually 4 bytes, sizeof(char) is 1 byte.`
    );
  }

  // =========================================================================
  //  Unary Operators (NEW)
  // =========================================================================

  private visitPreIncrement(node: UnaryOpNode): void {
    const varName = this.cleanName(node.operand);
    this.explanations.push(
        `⬆️ **Pre-Increment (++x):** Add 1 to **'${varName}'** FIRST, then use the new value.`
    );
    this.explanations.push(
        `   💡 **Example:** If x = 5, then y = ++x makes x = 6 and y = 6.`
    );
  }

  private visitPostIncrement(node: UnaryOpNode): void {
    const varName = this.cleanName(node.operand);
    this.explanations.push(
        `⬆️ **Post-Increment (x++):** Use the current value of **'${varName}'** first, THEN add 1 to it.`
    );
    this.explanations.push(
        `   💡 **Example:** If x = 5, then y = x++ makes y = 5 and x = 6.`
    );
  }

  private visitPreDecrement(node: UnaryOpNode): void {
    const varName = this.cleanName(node.operand);
    this.explanations.push(
        `⬇️ **Pre-Decrement (--x):** Subtract 1 from **'${varName}'** FIRST, then use the new value.`
    );
  }

  private visitPostDecrement(node: UnaryOpNode): void {
    const varName = this.cleanName(node.operand);
    this.explanations.push(
        `⬇️ **Post-Decrement (x--):** Use the current value of **'${varName}'** first, THEN subtract 1 from it.`
    );
  }

  private visitAddressOf(node: UnaryOpNode): void {
    const varName = this.cleanName(node.operand);
    this.explanations.push(
        `📍 **Address-Of Operator (&):** Get the memory address where **'${varName}'** is stored.`
    );
    this.explanations.push(
        `   🎯 **Result:** This creates a pointer that points to ${varName}'s location in memory.`
    );
    this.explanations.push(
        `   💡 **Why?** Pointers let you work with memory directly and pass large data efficiently.`
    );
  }

  private visitDereference(node: UnaryOpNode): void {
    const varName = this.cleanName(node.operand);
    this.explanations.push(
        `🎯 **Dereference Operator (*):** Follow the pointer **'${varName}'** to the memory location it points to and get the value stored there.`
    );
    this.explanations.push(
        `   📦 **Think of it as:** Opening a box that ${varName} is pointing to and looking at what's inside.`
    );
  }

  // =========================================================================
  //  I/O Operations
  // =========================================================================

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
    this.explanations.push(`   🔄 **Note:** This will overwrite whatever was previously stored in **'${targetNames}'**.`);
  }

  private visitExpressionStatement(node: ExpressionStatementNode): void {
    this.visit(node.expression);
  }

  // =========================================================================
  //  Helpers
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
    if (node.type === 'ConditionalExpression') {
        const ternary = node as ConditionalExpressionNode;
        return `${this.formatExpr(ternary.condition)} ? ${this.formatExpr(ternary.trueExpression)} : ${this.formatExpr(ternary.falseExpression)}`;
    }
    return 'a value';
  }
}