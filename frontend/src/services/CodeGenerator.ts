import type { Node, Edge } from '@xyflow/react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface NodeData {
  label?: unknown;
  code?: unknown;
  [key: string]: unknown;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const str = (v: unknown): string => String(v ?? '').trim();

/**
 * Determines if a string is a clean, user-authored C++ fragment worth emitting.
 * Rejects raw CFG metadata garbage like "Func: main", "[object Object]",
 * "undefined > Integer", "Exit Loop", "Return", etc.
 */
function isCleanCode(s: string): boolean {
  if (!s) return false;

  // Reject known CFG metadata patterns emitted by the backend analyser
  const metadataPatterns = [
    /^func:/i,               // "Func: main"
    /^exit\s/i,              // "Exit Loop", "Exit Block"
    /^enter\s/i,             // "Enter Loop"
    /^\[object/i,            // "[object Object]"
    /^undefined/i,           // "undefined > Integer"
    /\binteger\b/i,          // "undefined > Integer" — type names from CFG
    /\bboolean\b/i,
    /\bvoid\b.*:\s/i,        // "void: something"
    /^return\s*$/i,          // bare "Return" label (not a return statement)
    /^loop\s/i,              // "Loop Body"
    /\[.*\]/,                // anything with brackets like "[condition]"
  ];

  if (metadataPatterns.some(p => p.test(s))) return false;

  // Reject pure internal node labels that look like names but aren't code
  // (they contain no C++ operators, parens, quotes, or semicolons)
  const looksLikeCode =
    s.includes('(') ||
    s.includes(';') ||
    s.includes('=') ||
    s.includes('+') ||
    s.includes('-') ||
    s.includes('*') ||
    s.includes('/') ||
    s.includes('"') ||
    s.includes("'") ||
    s.includes('<') ||
    s.includes('>') ||
    s.includes('!') ||
    s.includes('&') ||
    s.includes('|') ||
    s.includes('cout') ||
    s.includes('cin') ||
    s.includes('++') ||
    s.includes('--');

  return looksLikeCode;
}

/** Build a map from node id → outgoing edges, sorted so "true"/"yes" edges come first. */
function buildAdjacency(edges: Edge[]): Map<string, Edge[]> {
  const adj = new Map<string, Edge[]>();
  for (const e of edges) {
    if (!adj.has(e.source)) adj.set(e.source, []);
    adj.get(e.source)!.push(e);
  }
  for (const [, outEdges] of adj) {
    outEdges.sort((a, b) => {
      const aLabel = str(a.label).toLowerCase();
      const bLabel = str(b.label).toLowerCase();
      const aTrue = aLabel === 'true' || aLabel === 'yes';
      const bTrue = bLabel === 'true' || bLabel === 'yes';
      return aTrue === bTrue ? 0 : aTrue ? -1 : 1;
    });
  }
  return adj;
}

/** Find the start node: explicitly labelled "start", OR node with no incoming edges. */
function findStartNode(nodes: Node<NodeData>[], edges: Edge[]): Node<NodeData> | undefined {
  const explicitStart = nodes.find(
    n => n.type === 'terminator' && str(n.data.label).toLowerCase() === 'start'
  );
  if (explicitStart) return explicitStart;

  const targetIds = new Set(edges.map(e => e.target));
  return nodes.find(n => !targetIds.has(n.id));
}

/**
 * Resolve the best code string to emit for a node.
 * Priority: data.code (user-edited) → data.label if it looks like C++ → null
 */
function resolveContent(node: Node<NodeData>): string | null {
  const code = str(node.data.code);
  const label = str(node.data.label);

  // User explicitly set a code field — always trust it
  if (code && isCleanCode(code)) return code;

  // Label looks like actual C++ — use it
  if (label && isCleanCode(label)) return label;

  // Nothing usable
  return null;
}

/** Emit the code line(s) for a single non-decision node. */
function emitNode(node: Node<NodeData>, indent: string): string {
  if (node.type === 'terminator') return '';

  const content = resolveContent(node);

  // No clean content at all → emit a TODO comment so the user knows
  if (!content) {
    const rawLabel = str(node.data.label);
    const tag = rawLabel && rawLabel.length < 60 ? rawLabel : node.id;
    return `${indent}// TODO: ${tag}\n`;
  }

  if (node.type === 'io') {
    // Already has cout/cin — emit as-is
    if (content.includes('cout') || content.includes('cin') || content.includes('printf') || content.includes('scanf')) {
      return `${indent}${content.endsWith(';') ? content : content + ';'}\n`;
    }
    // Guess direction from label
    const labelLower = str(node.data.label).toLowerCase();
    if (labelLower.includes('output') || labelLower.includes('print') || labelLower.includes('display')) {
      return `${indent}cout << ${content} << endl;\n`;
    }
    return `${indent}cin >> ${content};\n`;
  }

  if (node.type === 'process') {
    if (content.endsWith(';') || content.endsWith('}')) return `${indent}${content}\n`;
    return `${indent}${content};\n`;
  }

  return '';
}

// ─── Traversal ────────────────────────────────────────────────────────────────

function traverse(
  nodeId: string,
  nodeMap: Map<string, Node<NodeData>>,
  adj: Map<string, Edge[]>,
  visited: Set<string>,
  indent: string,
  stopAt: Set<string>
): string {
  let output = '';
  let currentId: string | undefined = nodeId;

  while (currentId && !visited.has(currentId) && !stopAt.has(currentId)) {
    const node = nodeMap.get(currentId);
    if (!node) break;

    visited.add(currentId);
    const outEdges: Edge[] = adj.get(currentId) ?? [];

    if (node.type === 'decision') {
      const condition = resolveContent(node) ?? '/* condition */';

      const trueEdge = outEdges.find(e => {
        const l = str(e.label).toLowerCase();
        return l === 'true' || l === 'yes';
      }) ?? outEdges[0];

      const falseEdge: Edge | undefined = outEdges.find(e => {
        const l = str(e.label).toLowerCase();
        return l === 'false' || l === 'no';
      }) ?? outEdges[1];

      const mergeNode = findMergeNode(trueEdge?.target, falseEdge?.target, adj);
      const mergeSet = mergeNode ? new Set([mergeNode]) : new Set<string>();

      output += `${indent}if (${condition}) {\n`;
      if (trueEdge) {
        output += traverse(trueEdge.target, nodeMap, adj, new Set(visited), indent + '    ', mergeSet);
      }
      output += `${indent}}`;

      if (falseEdge && falseEdge.target !== mergeNode) {
        output += ` else {\n`;
        output += traverse(falseEdge.target, nodeMap, adj, new Set(visited), indent + '    ', mergeSet);
        output += `${indent}}`;
      }
      output += '\n';

      currentId = mergeNode;
    } else if (outEdges.length === 1) {
      output += emitNode(node, indent);
      currentId = outEdges[0].target;
    } else if (outEdges.length === 0) {
      output += emitNode(node, indent);
      currentId = undefined;
    } else {
      output += emitNode(node, indent);
      currentId = outEdges[0].target;
    }
  }

  return output;
}

function findMergeNode(
  aId: string | undefined,
  bId: string | undefined,
  adj: Map<string, Edge[]>
): string | undefined {
  if (!aId || !bId) return undefined;
  if (aId === bId) return aId;

  const aReachable = new Set<string>();
  const aQueue = [aId];
  while (aQueue.length) {
    const id = aQueue.shift()!;
    if (aReachable.has(id)) continue;
    aReachable.add(id);
    for (const e of adj.get(id) ?? []) aQueue.push(e.target);
  }

  const bQueue = [bId];
  const bVisited = new Set<string>();
  while (bQueue.length) {
    const id = bQueue.shift()!;
    if (bVisited.has(id)) continue;
    bVisited.add(id);
    if (aReachable.has(id)) return id;
    for (const e of adj.get(id) ?? []) bQueue.push(e.target);
  }

  return undefined;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const generateCppFromGraph = (nodes: Node[], edges: Edge[]): string => {
  if (nodes.length === 0) return '// No graph data to generate code from.\n';

  const typedNodes = nodes as Node<NodeData>[];
  const nodeMap = new Map(typedNodes.map(n => [n.id, n]));
  const adj = buildAdjacency(edges);

  const startNode = findStartNode(typedNodes, edges);
  if (!startNode) return '// Could not determine graph entry point.\n';

  const bodyLines = traverse(startNode.id, nodeMap, adj, new Set(), '    ', new Set());

  return [
    '#include <iostream>',
    'using namespace std;',
    '',
    'int main() {',
    bodyLines.trimEnd() || '    // Empty graph — add nodes and connect them, then sync.',
    '    return 0;',
    '}',
    '',
  ].join('\n');
};