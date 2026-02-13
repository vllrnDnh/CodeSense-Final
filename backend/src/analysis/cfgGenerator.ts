/**
 * Control Flow Graph Generator
 * Implements the Sugiyama Framework for Hierarchical Graph Layout
 * Phase 3 (Output) - Step 1 of the analysis pipeline.
 */

import {
  ASTNode,
  IfStatementNode,
  WhileLoopNode,
  DoWhileLoopNode,
  ForLoopNode,
  FunctionDeclNode,
  ReturnStatementNode,
  BlockNode,
  ControlFlowNode
} from '../types';
import { Translator } from './translator'; // Import the Mentor Translator

interface GraphEdge {
  from: string;
  to: string;
  label?: string;
  isReversed?: boolean; // For cycle breaking
}

interface CFG {
  nodes: ControlFlowNode[];
  edges: GraphEdge[];
}

export class CFGGenerator {
  private nodes: ControlFlowNode[] = [];
  private edges: GraphEdge[] = [];
  private currentNodeId = 0;
  private mentor = new Translator(); // Initialize the tutor

  generate(ast: ASTNode): CFG {
    this.nodes = [];
    this.edges = [];
    this.currentNodeId = 0;

    const startNode = this.createNode('start', 'Start');
    const endNode = this.createNode('end', 'End');

    this.visit(ast, startNode, endNode);
    this.applySugiyamaLayout();

    return { nodes: this.nodes, edges: this.edges };
  }

  // =========================================================================
  //  SUGIYAMA FRAMEWORK IMPLEMENTATION (Intact)
  // =========================================================================

  private applySugiyamaLayout(): void {
    this.breakCycles();
    const layers = this.assignLayers();
    this.minimizeCrossings(layers);
    this.calculateCoordinates(layers);
    this.restoreCycles();
  }

  private breakCycles(): void {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const dfs = (nodeId: string) => {
      visited.add(nodeId);
      recursionStack.add(nodeId);
      const outgoing = this.edges.filter(e => e.from === nodeId);
      for (const edge of outgoing) {
        if (recursionStack.has(edge.to)) {
          const temp = edge.from;
          edge.from = edge.to;
          edge.to = temp;
          edge.isReversed = true;
        } else if (!visited.has(edge.to)) {
          dfs(edge.to);
        }
      }
      recursionStack.delete(nodeId);
    };
    if (this.nodes.length > 0) dfs(this.nodes[0].id);
  }

  private assignLayers(): ControlFlowNode[][] {
    const layers: ControlFlowNode[][] = [];
    const ranks = new Map<string, number>();
    this.nodes.forEach(n => ranks.set(n.id, 0));
    let changed = true;
    let iterations = 0;
    while (changed && iterations < this.nodes.length + 2) {
        changed = false;
        this.edges.forEach(edge => {
            const fromRank = ranks.get(edge.from) || 0;
            const toRank = ranks.get(edge.to) || 0;
            if (toRank <= fromRank) {
                ranks.set(edge.to, fromRank + 1);
                changed = true;
            }
        });
        iterations++;
    }
    ranks.forEach((rank, nodeId) => {
      if (!layers[rank]) layers[rank] = [];
      const node = this.nodes.find(n => n.id === nodeId);
      if (node) layers[rank].push(node);
    });
    return layers;
  }

  private minimizeCrossings(layers: ControlFlowNode[][]): void {
    for (let i = 1; i < layers.length; i++) {
        const currentLayer = layers[i];
        const prevLayer = layers[i - 1];
        const nodeWeights = currentLayer.map(node => {
            const parents = this.edges
                .filter(e => e.to === node.id && !e.isReversed)
                .map(e => e.from);
            if (parents.length === 0) return { node, weight: 0 };
            let sumPositions = 0;
            let count = 0;
            parents.forEach(parentId => {
                const index = prevLayer.findIndex(n => n.id === parentId);
                if (index !== -1) {
                    sumPositions += index;
                    count++;
                }
            });
            return { node, weight: count === 0 ? 0 : sumPositions / count };
        });
        nodeWeights.sort((a, b) => a.weight - b.weight);
        layers[i] = nodeWeights.map(nw => nw.node);
    }
  }

  private calculateCoordinates(layers: ControlFlowNode[][]): void {
    const layerHeight = 100;
    const nodeSpacing = 140;
    const canvasWidth = 800;
    layers.forEach((layer, layerIndex) => {
        const layerWidth = layer.length * nodeSpacing;
        const startX = (canvasWidth - layerWidth) / 2;
        layer.forEach((node, index) => {
            node.y = 50 + layerIndex * layerHeight;
            node.x = startX + index * nodeSpacing;
        });
    });
  }

  private restoreCycles(): void {
    this.edges.forEach(edge => {
        if (edge.isReversed) {
            const temp = edge.from;
            edge.from = edge.to;
            edge.to = temp;
            delete edge.isReversed;
        }
    });
  }

  // =========================================================================
  //  MODIFIED GRAPH CONSTRUCTION WITH TUTOR HOVER
  // =========================================================================

  private createNode(type: ControlFlowNode['type'], label: string, code?: string, line?: number, astNode?: ASTNode): ControlFlowNode {
    // Generate the simple explanation for this specific block
    let tutorExplanation = "";
    if (astNode) {
        const lines = this.mentor.translate(astNode);
        // Clean up formatting (removing emojis for simple hover display if needed)
        tutorExplanation = lines.join(" ").replace(/\*\*/g, ""); 
    }

    const node: ControlFlowNode = {
      id: `node_${this.currentNodeId++}`,
      type,
      label,
      code,
      line,
      tutorExplanation, // Attach to the node for frontend hover
      children: [],
      x: 0,
      y: 0
    };
    this.nodes.push(node);
    return node;
  }

  private connect(from: ControlFlowNode, to: ControlFlowNode, label?: string): void {
    this.edges.push({ from: from.id, to: to.id, label });
    from.children.push(to.id);
  }

  private visit(node: ASTNode, current: ControlFlowNode, exit: ControlFlowNode): ControlFlowNode {
    if (!node) return current;

    // Explicitly handle I/O statements to satisfy the compiler and ensure execution
    if (node.type === 'CoutStatement') {
    return this.visitCoutStatement(node, current);
    }
    if (node.type === 'CinStatement') {
    return this.visitCinStatement(node, current);
    }

    const methodName = `visit${node.type}`;
    if ((this as any)[methodName]) {
        return (this as any)[methodName](node, current, exit);
    }
    if ('body' in node) {
        let lastNode = current;
        (node as any).body.forEach((stmt: ASTNode) => {
            lastNode = this.visit(stmt, lastNode, exit);
        });
        return lastNode;
    }
    return current;
  }

  private visitProgram(node: any, current: ControlFlowNode, exit: ControlFlowNode): ControlFlowNode {
    let lastNode = current;
    node.body.forEach((stmt: ASTNode) => {
        lastNode = this.visit(stmt, lastNode, exit);
    });
    this.connect(lastNode, exit);
    return exit;
  }

  private visitIfStatement(node: IfStatementNode, current: ControlFlowNode, exit: ControlFlowNode): ControlFlowNode {
    const decision = this.createNode('decision', 'Condition', this.nodeToString(node.condition), node.line, node);
    const merge = this.createNode('process', 'Merge');
    this.connect(current, decision);

    let truePath = decision;
    node.thenBranch.forEach(stmt => {
        truePath = this.visit(stmt, truePath, merge);
    });
    this.connect(truePath, merge, 'True');

    if (node.elseBranch) {
        let falsePath = decision;
        node.elseBranch.forEach(stmt => {
            falsePath = this.visit(stmt, falsePath, merge);
        });
        this.connect(falsePath, merge, 'False');
    } else {
        this.connect(decision, merge, 'False');
    }
    return merge;
  }

  private visitCoutStatement(node: any, current: ControlFlowNode): ControlFlowNode {
    // Pass 'node' as the 5th argument so the Mentor Translator can read it
    const step = this.createNode('process', 'Output (cout)', 'cout << ...', node.line, node);
    this.connect(current, step);
    return step;
}

private visitCinStatement(node: any, current: ControlFlowNode): ControlFlowNode {
    // Create the node and pass 'node' so the translator can extract the targets
    const step = this.createNode('process', 'Input (cin)', 'cin >> ...', node.line, node);
    this.connect(current, step);
    return step;
}

  private visitDoWhileLoop(node: DoWhileLoopNode, current: ControlFlowNode, exit: ControlFlowNode): ControlFlowNode {
    const loopStart = this.createNode('process', 'Do-While Start', '', node.line, node);
    this.connect(current, loopStart);
    let bodyNode = loopStart;
    node.body.forEach(stmt => {
        bodyNode = this.visit(stmt, bodyNode, exit); 
    });
    const decision = this.createNode('decision', 'Condition', this.nodeToString(node.condition), node.line, node);
    this.connect(bodyNode, decision);
    this.connect(decision, loopStart, 'True');
    const afterLoop = this.createNode('process', 'Exit Loop');
    this.connect(decision, afterLoop, 'False');
    return afterLoop;
  }

  private visitWhileLoop(node: WhileLoopNode, current: ControlFlowNode, exit: ControlFlowNode): ControlFlowNode {
    const decision = this.createNode('decision', 'While Loop', this.nodeToString(node.condition), node.line, node);
    this.connect(current, decision);
    let bodyNode = decision;
    node.body.forEach(stmt => {
        bodyNode = this.visit(stmt, bodyNode, decision);
    });
    this.connect(bodyNode, decision, 'Loop');
    const afterLoop = this.createNode('process', 'Exit Loop');
    this.connect(decision, afterLoop, 'False');
    return afterLoop;
  }

  private visitForLoop(node: ForLoopNode, current: ControlFlowNode, exit: ControlFlowNode): ControlFlowNode {
    let lastNode = current;
    if (node.init) {
        const initNode = this.createNode('process', 'Init', this.nodeToString(node.init), undefined, node.init);
        this.connect(lastNode, initNode);
        lastNode = initNode;
    }
    const decision = this.createNode('decision', 'For Condition', node.condition ? this.nodeToString(node.condition) : 'true', node.line, node);
    this.connect(lastNode, decision);
    let bodyNode = decision;
    node.body.forEach(stmt => {
        bodyNode = this.visit(stmt, bodyNode, decision);
    });
    if (node.update) {
        const updateNode = this.createNode('process', 'Update', this.nodeToString(node.update));
        this.connect(bodyNode, updateNode);
        this.connect(updateNode, decision, 'Loop');
    } else {
        this.connect(bodyNode, decision, 'Loop');
    }
    const afterLoop = this.createNode('process', 'Exit Loop');
    this.connect(decision, afterLoop, 'False');
    return afterLoop;
  }

  private visitVariableDecl(node: any, current: ControlFlowNode): ControlFlowNode {
    const step = this.createNode('process', 'Declare', `${node.varType} ${node.name}`, node.line, node);
    this.connect(current, step);
    return step;
  }

  private visitAssignment(node: any, current: ControlFlowNode): ControlFlowNode {
    const step = this.createNode('process', 'Assign', `${node.target} = ...`, node.line, node);
    this.connect(current, step);
    return step;
  }

  private visitExpressionStatement(node: any, current: ControlFlowNode): ControlFlowNode {
    const code = this.nodeToString(node.expression);
    const step = this.createNode('process', 'Expression', code, node.line, node.expression);
    this.connect(current, step);
    return step;
  }

  private visitFunctionDecl(node: FunctionDeclNode, current: ControlFlowNode, exit: ControlFlowNode): ControlFlowNode {
      const funcStart = this.createNode('start', `Func: ${node.name}`, '', node.line, node);
      this.connect(current, funcStart);
      let lastNode = funcStart;
      
      // Handle function prototypes (body is null) vs full definitions (body is array)
      if (node.body && Array.isArray(node.body)) {
          node.body.forEach(stmt => {
              lastNode = this.visit(stmt, lastNode, exit);
          });
      }
      
      return lastNode;
  }

  private visitFunctionPrototype(node: any, current: ControlFlowNode, exit: ControlFlowNode): ControlFlowNode {
      // Function prototypes are forward declarations - they don't have executable code
      // Just create a simple node to document the prototype and move on
      const protoNode = this.createNode('process', `Prototype: ${node.name}`, `${node.returnType} ${node.name}(...)`, node.line, node);
      this.connect(current, protoNode);
      return protoNode;
  }

  private visitReturnStatement(node: ReturnStatementNode, current: ControlFlowNode, exit: ControlFlowNode): ControlFlowNode {
      const ret = this.createNode('end', 'Return', '', node.line, node);
      this.connect(current, ret);
      this.connect(ret, exit); 
      return ret;
  }

  private visitBlock(node: BlockNode, current: ControlFlowNode, exit: ControlFlowNode): ControlFlowNode {
      let lastNode = current;
      node.statements.forEach(stmt => {
          lastNode = this.visit(stmt, lastNode, exit);
      });
      return lastNode;
  }

  private nodeToString(node: any): string {
      if (!node) return '';
      if (node.name) return node.name;
      if (node.value) return String(node.value);
      if (node.type === 'BinaryOp') return `${this.nodeToString(node.left)} ${node.operator} ${this.nodeToString(node.right)}`;
      return node.type;
  }
}