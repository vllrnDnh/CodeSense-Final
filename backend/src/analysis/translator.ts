/**
 * CodeSense Mentor (Translator) - Pedagogical Edition
 * Explains C++ code in simple, student-friendly language.
 * Uses metaphors, real-world examples, and step-by-step breakdowns.
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
  private indentLevel: number = 0;

  /**
   * Clean up names from parser (handles arrays and weird formats)
   */
  private cleanName(name: any): string {
    if (!name) return 'unknown';
    const flatName = Array.isArray(name) ? name.flat(Infinity).join('') : String(name);
    return flatName.replace(/,/g, '').trim();
  }

  /**
   * Add proper indentation for nested explanations
   */
  private indent(): string {
    return '  '.repeat(this.indentLevel);
  }

  /**
   * Main translation entry point
   */
  translate(ast: ASTNode): string[] {
    this.explanations = [];
    this.indentLevel = 0;
    this.visit(ast);
    return this.explanations;
  }

  /**
   * Visitor dispatcher
   */
  private visit(node: ASTNode | null | string | undefined): void {
    if (!node || typeof node === 'string') return;
    
    // Handle special I/O statements
    if (node.type === 'CoutStatement') return this.visitCoutStatement(node);
    if (node.type === 'CinStatement') return this.visitCinStatement(node);

    const methodName = `visit${node.type}` as keyof this;
    if (typeof this[methodName] === 'function') {
      (this[methodName] as any).call(this, node);
    } else if ('body' in node && Array.isArray((node as any).body)) {
      (node as any).body.forEach((stmt: ASTNode) => this.visit(stmt));
    } else if ('statements' in node && Array.isArray((node as any).statements)) {
      (node as any).statements.forEach((stmt: ASTNode) => this.visit(stmt));
    }
  }

  // =========================================================================
  //  PROGRAM STRUCTURE
  // =========================================================================

  private visitProgram(node: ProgramNode): void {
    this.explanations.push("🎬 **Your Program Starts Here**");
    this.explanations.push("");
    
    if (node.directives && node.directives.length > 0) {
      this.explanations.push("📚 **Libraries You're Using:**");
      node.directives.forEach(d => {
        if ((d as any).name === 'iostream') {
          this.explanations.push("   • iostream - for keyboard input (cin) and screen output (cout)");
        } else {
          this.explanations.push(`   • ${(d as any).name}`);
        }
      });
      this.explanations.push("");
    }
    
    this.explanations.push("📖 **Step-by-Step Walkthrough:**");
    this.explanations.push("");
    
    node.body.forEach(stmt => this.visit(stmt));
    
    this.explanations.push("");
    this.explanations.push("✅ **Program Complete!**");
  }

  // =========================================================================
  //  VARIABLES - The Storage Boxes
  // =========================================================================

  private visitVariableDecl(node: VariableDeclNode): void {
    const name = this.cleanName(node.name);
    const isConstant = node.modifiers && node.modifiers.includes('const');
    const isArray = node.dimensions && node.dimensions.length > 0;
    
    // Main declaration
    if (isConstant) {
      this.explanations.push(`${this.indent()}🔒 **Constant Box Created: '${name}'**`);
      this.explanations.push(`${this.indent()}   Type: ${node.varType} (can NEVER be changed)`);
    } else if (isArray) {
      const size = node.dimensions?.[0] ? this.formatExpr(node.dimensions[0]) : '?';
      this.explanations.push(`${this.indent()}📦 **Array Created: '${name}[${size}]'**`);
      this.explanations.push(`${this.indent()}   Like a row of ${size} boxes, each storing a ${node.varType}`);
    } else {
      this.explanations.push(`${this.indent()}📦 **Variable Box: '${name}'**`);
      this.explanations.push(`${this.indent()}   Type: ${node.varType}`);
    }
    
    // Initialization
    if (node.value) {
      const valueStr = this.formatExpr(node.value);
      this.explanations.push(`${this.indent()}   Starting value: ${valueStr}`);
      this.explanations.push(`${this.indent()}   💡 Think: Label a box "${name}" and put ${valueStr} inside`);
    } else {
      this.explanations.push(`${this.indent()}   ⚠️  No starting value - box is empty!`);
    }
    
    this.explanations.push("");
  }

  private visitAssignment(node: AssignmentNode): void {
    const target = typeof node.target === 'string' ? this.cleanName(node.target) : 'array slot';
    const value = this.formatExpr(node.value);
    
    this.explanations.push(`${this.indent()}✏️  **Update Box: '${target}'**`);
    this.explanations.push(`${this.indent()}   Old contents? Thrown away!`);
    this.explanations.push(`${this.indent()}   New contents: ${value}`);
    this.explanations.push(`${this.indent()}   💡 Like replacing what's in the box with something new`);
    this.explanations.push("");
  }

  // =========================================================================
  //  FUNCTIONS - The Tasks
  // =========================================================================

  private visitFunctionPrototype(node: FunctionPrototypeNode): void {
    const name = this.cleanName(node.name);
    const params = node.params.map((p: any) => 
      p.name ? `${p.varType} ${p.name}` : p.varType
    ).join(', ');
    
    this.explanations.push(`${this.indent()}📢 **Task Announcement: '${name}'**`);
    this.explanations.push(`${this.indent()}   What it needs: ${params || 'nothing'}`);
    this.explanations.push(`${this.indent()}   What it returns: ${node.returnType}`);
    this.explanations.push(`${this.indent()}   💡 Like posting a job description before hiring someone`);
    this.explanations.push(`${this.indent()}   (Full details will come later)`);
    this.explanations.push("");
  }

  private visitFunctionDecl(node: FunctionDeclNode): void {
    const name = this.cleanName(node.name);
    const isMain = name === 'main';
    
    if (isMain) {
      this.explanations.push("");
      this.explanations.push("🚀 **MAIN FUNCTION - Your Program Starts Here!**");
      this.explanations.push("   This is like the 'Play' button for your code");
      this.explanations.push("   Everything inside runs from top to bottom");
    } else {
      const params = node.params.map((p: any) => 
        `${p.varType} ${p.name || '?'}`
      ).join(', ');
      
      this.explanations.push(`${this.indent()}🔧 **Task Definition: '${name}'**`);
      this.explanations.push(`${this.indent()}   Inputs: ${params || 'none'}`);
      this.explanations.push(`${this.indent()}   Output: ${node.returnType}`);
    }
    
    this.explanations.push("");
    this.explanations.push(`${this.indent()}▶️  **Task Steps:**`);
    this.indentLevel++;
    
    if (node.body && node.body.length > 0) {
      node.body.forEach(stmt => this.visit(stmt));
    } else {
      this.explanations.push(`${this.indent()}(No steps yet)`);
    }
    
    this.indentLevel--;
    this.explanations.push("");
  }

  private visitFunctionCall(node: FunctionCallNode): void {
    const name = this.cleanName(node.name);
    const argCount = node.arguments?.length || 0;
    
    this.explanations.push(`${this.indent()}📞 **Call Task: '${name}'**`);
    if (argCount > 0) {
      this.explanations.push(`${this.indent()}   Sending ${argCount} value(s) to work with`);
    }
    this.explanations.push(`${this.indent()}   💡 Like asking someone to do their job now`);
    this.explanations.push("");
  }

  private visitReturnStatement(node: ReturnStatementNode): void {
    if (node.value) {
      const value = this.formatExpr(node.value);
      this.explanations.push(`${this.indent()}↩️  **Return: ${value}**`);
      this.explanations.push(`${this.indent()}   Task complete! Handing back result`);
    } else {
      this.explanations.push(`${this.indent()}↩️  **Return**`);
      this.explanations.push(`${this.indent()}   Task complete! Going back`);
    }
    this.explanations.push("");
  }

  // =========================================================================
  //  CONTROL FLOW - Making Decisions
  // =========================================================================

  private visitIfStatement(node: IfStatementNode): void {
    const condition = this.formatExpr(node.condition);
    
    this.explanations.push(`${this.indent()}🤔 **Decision Point**`);
    this.explanations.push(`${this.indent()}   Question: Is ${condition} true?`);
    this.explanations.push("");
    
    this.explanations.push(`${this.indent()}✅ **If YES:**`);
    this.indentLevel++;
    node.thenBranch.forEach(stmt => this.visit(stmt));
    this.indentLevel--;

    if (node.elseBranch && node.elseBranch.length > 0) {
      this.explanations.push(`${this.indent()}❌ **If NO:**`);
      this.indentLevel++;
      node.elseBranch.forEach(stmt => this.visit(stmt));
      this.indentLevel--;
    }
    
    this.explanations.push(`${this.indent()}💡 Like choosing between two paths at a fork in the road`);
    this.explanations.push("");
  }

  private visitWhileLoop(node: WhileLoopNode): void {
    const condition = this.formatExpr(node.condition);
    
    this.explanations.push(`${this.indent()}🔁 **While Loop**`);
    this.explanations.push(`${this.indent()}   Keep doing this as long as: ${condition}`);
    this.explanations.push(`${this.indent()}   💡 Like "Keep washing dishes while there are dirty dishes"`);
    this.explanations.push("");
    
    this.explanations.push(`${this.indent()}🔄 **Repeat These Steps:**`);
    this.indentLevel++;
    node.body.forEach(stmt => this.visit(stmt));
    this.indentLevel--;
    
    this.explanations.push(`${this.indent()}   Then check condition again...`);
    this.explanations.push("");
  }

  private visitDoWhileLoop(node: DoWhileLoopNode): void {
    const condition = this.formatExpr(node.condition);
    
    this.explanations.push(`${this.indent()}🔁 **Do-While Loop**`);
    this.explanations.push(`${this.indent()}   💡 Do something FIRST, then decide if you should repeat`);
    this.explanations.push("");
    
    this.explanations.push(`${this.indent()}🔄 **These Steps (at least once):**`);
    this.indentLevel++;
    node.body.forEach(stmt => this.visit(stmt));
    this.indentLevel--;
    
    this.explanations.push(`${this.indent()}❓ **Should we repeat?**`);
    this.explanations.push(`${this.indent()}   Check: ${condition}`);
    this.explanations.push(`${this.indent()}   If true → go back to start`);
    this.explanations.push(`${this.indent()}   If false → continue forward`);
    this.explanations.push("");
  }

  private visitForLoop(node: ForLoopNode): void {
    this.explanations.push(`${this.indent()}🔢 **For Loop (Counting Loop)**`);
    this.explanations.push(`${this.indent()}   💡 Perfect for doing something a specific number of times`);
    this.explanations.push("");
    
    if (node.init) {
      this.explanations.push(`${this.indent()}1️⃣ **Setup:** ${this.formatExpr(node.init)}`);
    }
    if (node.condition) {
      this.explanations.push(`${this.indent()}2️⃣ **Keep going while:** ${this.formatExpr(node.condition)}`);
    }
    if (node.update) {
      this.explanations.push(`${this.indent()}3️⃣ **After each round:** ${this.formatExpr(node.update)}`);
    }
    this.explanations.push("");
    
    this.explanations.push(`${this.indent()}🔄 **Repeat These Steps:**`);
    this.indentLevel++;
    node.body.forEach(stmt => this.visit(stmt));
    this.indentLevel--;
    this.explanations.push("");
  }

  private visitSwitchStatement(node: SwitchStatementNode): void {
    const condition = this.formatExpr(node.condition);
    
    this.explanations.push(`${this.indent()}🎯 **Menu Selection (Switch)**`);
    this.explanations.push(`${this.indent()}   Looking at: ${condition}`);
    this.explanations.push(`${this.indent()}   💡 Like choosing from a restaurant menu`);
    this.explanations.push("");
    
    node.cases.forEach((c, index) => {
      if (c.value) {
        const caseValue = this.formatExpr(c.value);
        this.explanations.push(`${this.indent()}${index + 1}. **If it equals ${caseValue}:**`);
      } else {
        this.explanations.push(`${this.indent()}${index + 1}. **Otherwise (Default):**`);
      }
      
      this.indentLevel++;
      if (c.statements && c.statements.length > 0) {
        c.statements.forEach(stmt => this.visit(stmt));
      } else {
        this.explanations.push(`${this.indent()}(do nothing)`);
      }
      this.indentLevel--;
    });
    this.explanations.push("");
  }

  // =========================================================================
  //  INPUT/OUTPUT - Talking to the User
  // =========================================================================

  private visitCoutStatement(node: any): void {
    const outputs = node.values 
      ? node.values.map((expr: any) => this.formatExpr(expr)).join(' + ')
      : "something";

    this.explanations.push(`${this.indent()}🖥️  **Show on Screen**`);
    this.explanations.push(`${this.indent()}   Display: ${outputs}`);
    this.explanations.push(`${this.indent()}   💡 Like printing a message on paper`);
    this.explanations.push("");
  }

  private visitCinStatement(node: any): void {
    const targetNames = node.targets 
      ? node.targets.map((t: any) => 
          typeof t === 'string' ? t : this.cleanName(t.name)
        ).join(', ')
      : "a variable";
    
    this.explanations.push(`${this.indent()}⌨️  **Get Input from User**`);
    this.explanations.push(`${this.indent()}   Waiting for user to type...`);
    this.explanations.push(`${this.indent()}   Store in: ${targetNames}`);
    this.explanations.push(`${this.indent()}   💡 Like asking someone a question and writing down their answer`);
    this.explanations.push("");
  }

  // =========================================================================
  //  ADVANCED OPERATORS
  // =========================================================================

  private visitPreIncrement(node: UnaryOpNode): void {
    const varName = this.cleanName(node.operand);
    this.explanations.push(`${this.indent()}⬆️  **++${varName} (Pre-Increment)**`);
    this.explanations.push(`${this.indent()}   Add 1 FIRST, then use the value`);
    this.explanations.push(`${this.indent()}   💡 Example: If x=5, then y=(++x) makes x=6, y=6`);
    this.explanations.push("");
  }

  private visitPostIncrement(node: UnaryOpNode): void {
    const varName = this.cleanName(node.operand);
    this.explanations.push(`${this.indent()}⬆️  **${varName}++ (Post-Increment)**`);
    this.explanations.push(`${this.indent()}   Use the value FIRST, then add 1`);
    this.explanations.push(`${this.indent()}   💡 Example: If x=5, then y=(x++) makes y=5, x=6`);
    this.explanations.push("");
  }

  private visitPreDecrement(node: UnaryOpNode): void {
    const varName = this.cleanName(node.operand);
    this.explanations.push(`${this.indent()}⬇️  **--${varName} (Pre-Decrement)**`);
    this.explanations.push(`${this.indent()}   Subtract 1 FIRST, then use the value`);
    this.explanations.push("");
  }

  private visitPostDecrement(node: UnaryOpNode): void {
    const varName = this.cleanName(node.operand);
    this.explanations.push(`${this.indent()}⬇️  **${varName}-- (Post-Decrement)**`);
    this.explanations.push(`${this.indent()}   Use the value FIRST, then subtract 1`);
    this.explanations.push("");
  }

  private visitConditionalExpression(node: ConditionalExpressionNode): void {
    const cond = this.formatExpr(node.condition);
    const ifTrue = this.formatExpr(node.trueExpression);
    const ifFalse = this.formatExpr(node.falseExpression);
    
    this.explanations.push(`${this.indent()}❓ **Ternary (Shortcut If-Else)**`);
    this.explanations.push(`${this.indent()}   Question: ${cond}`);
    this.explanations.push(`${this.indent()}   If true → use ${ifTrue}`);
    this.explanations.push(`${this.indent()}   If false → use ${ifFalse}`);
    this.explanations.push(`${this.indent()}   💡 Format: condition ? valueIfTrue : valueIfFalse`);
    this.explanations.push("");
  }

  private visitCastExpression(node: CastExpressionNode): void {
    const value = this.formatExpr(node.operand);
    this.explanations.push(`${this.indent()}🔄 **Type Conversion**`);
    this.explanations.push(`${this.indent()}   Convert ${value} to ${node.targetType}`);
    this.explanations.push(`${this.indent()}   ⚠️  Warning: May lose precision!`);
    this.explanations.push(`${this.indent()}   💡 Like pouring liquid from a big cup to a small one`);
    this.explanations.push("");
  }

  private visitSizeofExpression(node: SizeofExpressionNode): void {
    const value = this.formatExpr(node.value);
    this.explanations.push(`${this.indent()}📏 **Measure Memory Size**`);
    this.explanations.push(`${this.indent()}   How many bytes does ${value} occupy?`);
    this.explanations.push(`${this.indent()}   💡 Common sizes: int=4 bytes, char=1 byte, double=8 bytes`);
    this.explanations.push("");
  }

  private visitAddressOf(node: UnaryOpNode): void {
    const varName = this.cleanName(node.operand);
    this.explanations.push(`${this.indent()}📍 **Get Memory Address (&${varName})**`);
    this.explanations.push(`${this.indent()}   Find where ${varName} lives in memory`);
    this.explanations.push(`${this.indent()}   💡 Like getting someone's home address instead of visiting them`);
    this.explanations.push("");
  }

  private visitDereference(node: UnaryOpNode): void {
    const varName = this.cleanName(node.operand);
    this.explanations.push(`${this.indent()}🎯 **Follow Pointer (*${varName})**`);
    this.explanations.push(`${this.indent()}   Go to the address and get what's stored there`);
    this.explanations.push(`${this.indent()}   💡 Like using an address to actually visit the house`);
    this.explanations.push("");
  }

  private visitExpressionStatement(node: ExpressionStatementNode): void {
    this.visit(node.expression);
  }

  // =========================================================================
  //  HELPERS - Format expressions nicely
  // =========================================================================

  private formatExpr(node: any): string {
    if (!node) return '???';
    
    switch (node.type) {
      case 'BinaryOp':
        const left = this.formatExpr(node.left);
        const right = this.formatExpr(node.right);
        return `(${left} ${node.operator} ${right})`;
      
      case 'Identifier':
        return this.cleanName(node.name);
      
      case 'Integer':
      case 'Float':
        return String(node.value);
      
      case 'String':
        return `"${node.value}"`;
      
      case 'VariableDecl':
        return this.cleanName(node.name);
      
      case 'ConditionalExpression':
        const cond = this.formatExpr(node.condition);
        const trueVal = this.formatExpr(node.trueExpression);
        const falseVal = this.formatExpr(node.falseExpression);
        return `${cond} ? ${trueVal} : ${falseVal}`;
      
      case 'FunctionCall':
        return `${node.name}(...)`;
      
      default:
        return node.type || 'value';
    }
  }
}