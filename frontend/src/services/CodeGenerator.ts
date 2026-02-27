import type { Node, Edge } from '@xyflow/react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface NodeData {
  label?: unknown;
  code?: unknown;
  [key: string]: unknown;
}

// ─── Grammar-Aligned Reserved Words ──────────────────────────────────────────
// Matches ReservedWord rule in grammar exactly

const RESERVED_WORDS = new Set([
  'if', 'else', 'while', 'for', 'return', 'int', 'float', 'double',
  'char', 'bool', 'void', 'using', 'namespace', 'auto', 'const',
  'static', 'extern', 'unsigned', 'signed', 'sizeof', 'switch',
  'case', 'default', 'break', 'continue', 'do', 'long', 'string',
  'volatile', 'inline', 'virtual', 'public', 'private', 'protected',
  'class', 'struct', 'enum', 'typedef', 'typename', 'template',
  'this', 'new', 'delete', 'nullptr', 'try', 'catch', 'throw',
  'override', 'final', 'true', 'false'
])

// ─── Grammar-Aligned Types ────────────────────────────────────────────────────
// Matches BaseType rule: int|float|double|char|bool|void|string|auto + compound

const BASE_TYPES = [
  'long long', 'long double', 'unsigned int', // compound first (order matters)
  'int', 'float', 'double', 'char', 'bool', 'void', 'string', 'auto',
  'typename', 'class', 'struct', 'enum'
]

const TYPE_MODIFIERS = [
  'const', 'static', 'extern', 'volatile', 'unsigned', 'signed',
  'inline', 'virtual', 'public', 'private', 'protected', 'override', 'final'
]

// ─── Auto-Include Detection ───────────────────────────────────────────────────
// Maps identifiers to their required #include header

const CPP_INCLUDES: Record<string, string> = {
  'cout':       'iostream',
  'cin':        'iostream',
  'endl':       'iostream',
  'cerr':       'iostream',
  'string':     'string',
  'getline':    'string',
  'stoi':       'string',
  'stod':       'string',
  'stof':       'string',
  'to_string':  'string',
  'vector':     'vector',
  'array':      'array',
  'map':        'map',
  'unordered_map': 'unordered_map',
  'set':        'set',
  'unordered_set': 'unordered_set',
  'stack':      'stack',
  'queue':      'queue',
  'deque':      'deque',
  'list':       'list',
  'pair':       'utility',
  'make_pair':  'utility',
  'sqrt':       'cmath',
  'pow':        'cmath',
  'abs':        'cmath',
  'floor':      'cmath',
  'ceil':       'cmath',
  'round':      'cmath',
  'log':        'cmath',
  'exp':        'cmath',
  'sin':        'cmath',
  'cos':        'cmath',
  'tan':        'cmath',
  'rand':       'cstdlib',
  'srand':      'cstdlib',
  'exit':       'cstdlib',
  'printf':     'cstdio',
  'scanf':      'cstdio',
  'sprintf':    'cstdio',
  'strlen':     'cstring',
  'strcpy':     'cstring',
  'strcmp':     'cstring',
  'sort':       'algorithm',
  'reverse':    'algorithm',
  'find':       'algorithm',
  'min':        'algorithm',
  'max':        'algorithm',
  'fill':       'algorithm',
  'count':      'algorithm',
  'accumulate': 'numeric',
  'iota':       'numeric',
  'INT_MAX':    'climits',
  'INT_MIN':    'climits',
  'FLT_MAX':    'cfloat',
  'setw':       'iomanip',
  'setprecision': 'iomanip',
  'fixed':      'iomanip',
}

const INCLUDE_ORDER = [
  'iostream', 'string', 'vector', 'array', 'map', 'unordered_map',
  'set', 'unordered_set', 'stack', 'queue', 'deque', 'list',
  'utility', 'algorithm', 'numeric', 'cmath', 'cstdlib',
  'cstdio', 'cstring', 'climits', 'cfloat', 'iomanip'
]
const str = (v: unknown): string => String(v ?? '').trim()

function detectIncludes(allCode: string[]): string[] {
  const needed = new Set<string>(['iostream']) // always include iostream
  const combined = allCode.join(' ')

  for (const [keyword, header] of Object.entries(CPP_INCLUDES)) {
    if (combined.includes(keyword)) needed.add(header)
  }
  // Detect template types like vector<T>, map<K,V>
  if (/\bvector\s*</.test(combined))      needed.add('vector')
  if (/\bmap\s*</.test(combined))         needed.add('map')
  if (/\bset\s*</.test(combined))         needed.add('set')
  if (/\bstack\s*</.test(combined))       needed.add('stack')
  if (/\bqueue\s*</.test(combined))       needed.add('queue')
  if (/\bpair\s*</.test(combined))        needed.add('utility')

  const sorted = INCLUDE_ORDER.filter(h => needed.has(h))
  const rest = [...needed].filter(h => !INCLUDE_ORDER.includes(h)).sort()
  return [...sorted, ...rest]
}

// ─── Variable Declaration Parser ──────────────────────────────────────────────
// Matches grammar: TypeModifier* Type Identifier (= Expression)?
// Covers: int x, int x = 5, const int x = 5, int arr[10], unsigned int x

interface VarDecl {
  modifiers: string[]
  varType: string
  name: string
  value?: string
  isArray: boolean
  arraySize?: string
}

function isValidIdentifier(name: string): boolean {
  // Must match grammar Identifier rule: !ReservedWord [a-zA-Z_][a-zA-Z0-9_]*
  if (RESERVED_WORDS.has(name)) return false
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)
}

function parseVarDecl(code: string): VarDecl | null {
  const clean = code.replace(/;\s*$/, '').trim()

  // Extract leading type modifiers (const, static, etc.)
  const modifiers: string[] = []
  let rest = clean
  for (const mod of TYPE_MODIFIERS) {
    const modRe = new RegExp(`^${mod}\\s+`)
    if (modRe.test(rest)) {
      modifiers.push(mod)
      rest = rest.replace(modRe, '').trim()
    }
  }

  // Try to match a base type
  let matchedType: string | null = null
  for (const bt of BASE_TYPES) {
    const typeRe = new RegExp(`^${bt.replace(' ', '\\s+')}\\s+`)
    if (typeRe.test(rest)) {
      matchedType = bt
      rest = rest.replace(typeRe, '').trim()
      break
    }
  }

  if (!matchedType) return null

  // Handle pointer/reference suffix on type: int* x, int& x
  let ptrSuffix = ''
  const ptrMatch = rest.match(/^([*&]+)\s*/)
  if (ptrMatch) {
    ptrSuffix = ptrMatch[1]
    rest = rest.slice(ptrMatch[0].length).trim()
  }

  // Match: name[size] = value  OR  name = value  OR  name
  const arrayMatch = rest.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*\[([^\]]*)\](?:\s*=\s*(.+))?$/)
  if (arrayMatch) {
    const name = arrayMatch[1]
    if (!isValidIdentifier(name)) return null
    return {
      modifiers,
      varType: modifiers.join(' ') + (modifiers.length ? ' ' : '') + matchedType + ptrSuffix,
      name,
      isArray: true,
      arraySize: arrayMatch[2].trim(),
      value: arrayMatch[3]?.trim()
    }
  }

  const assignMatch = rest.match(/^([a-zA-Z_][a-zA-Z0-9_]*)(?:\s*=\s*(.+))?$/)
  if (assignMatch) {
    const name = assignMatch[1]
    if (!isValidIdentifier(name)) return null
    return {
      modifiers,
      varType: modifiers.join(' ') + (modifiers.length ? ' ' : '') + matchedType + ptrSuffix,
      name,
      isArray: false,
      value: assignMatch[2]?.trim()
    }
  }

  return null
}

// ─── Statement Normalizer ─────────────────────────────────────────────────────
// Ensures every statement ends with ; per grammar ExpressionStatement rule
// Handles: Assignment, ExpressionStatement, LoopControl, ReturnStatement

function normalizeStatement(code: string): string {
  const s = code.trim()
  if (!s) return ''

  // Already properly terminated
  if (s.endsWith(';') || s.endsWith('}')) return s

  // Grammar LoopControlStatement: "break" | "continue" followed by ";"
  if (s === 'break' || s === 'continue') return s + ';'

  // Grammar ReturnStatement: "return" __ Expression ";"
  if (/^return(\s|$)/.test(s)) return s.endsWith(';') ? s : s + ';'

  // Grammar LoopControl for break/continue with trailing text
  if (/^(break|continue)\s/.test(s)) return s.endsWith(';') ? s : s + ';'

  // Control flow headers — no semicolons
  if (/^(if|else|while|for|do|switch)\s*[\s({]/.test(s)) return s
  if (s === 'else' || s === 'do') return s

  // Everything else is an ExpressionStatement — needs ";"
  return s + ';'
}

// ─── I/O Statement Builder ────────────────────────────────────────────────────
// Matches grammar StreamStatement:
//   cout << expr << expr ... ;
//   cin >> identifier >> identifier ... ;

function normalizeIO(label: string, code: string): string {
  const c = code.trim()
  const l = label.toLowerCase()

  if (!c) {
    // Infer from label when no code provided
    if (l.includes('output') || l.includes('print') || l.includes('display') || l.includes('show') || l.includes('write')) {
      return `cout << "" << endl;`
    }
    if (l.includes('input') || l.includes('read') || l.includes('get') || l.includes('enter')) {
      return `cin >> variable;`
    }
    return `// I/O: ${label}`
  }

  // Already a valid stream statement
  if (c.includes('cout') || c.includes('cin') || c.includes('printf') || c.includes('scanf')) {
    return normalizeStatement(c)
  }

  // Build from direction hints
  if (l.includes('output') || l.includes('print') || l.includes('display') || l.includes('write')) {
    const val = c.includes('"') ? c : `${c} << endl`
    return `cout << ${val};`
  }
  if (l.includes('input') || l.includes('read') || l.includes('enter')) {
    return `cin >> ${c};`
  }

  // Default: treat as output
  return `cout << ${c} << endl;`
}

// ─── Graph Helpers ────────────────────────────────────────────────────────────

function buildAdjacency(edges: Edge[]): Map<string, Edge[]> {
  const adj = new Map<string, Edge[]>()
  for (const e of edges) {
    if (!adj.has(e.source)) adj.set(e.source, [])
    adj.get(e.source)!.push(e)
  }
  // Sort so true/yes edges come first (matches grammar IfStatement then-branch order)
  for (const [, outEdges] of adj) {
    outEdges.sort((a, b) => {
      const aL = str(a.label).toLowerCase()
      const bL = str(b.label).toLowerCase()
      const aTrue = aL === 'true' || aL === 'yes'
      const bTrue = bL === 'true' || bL === 'yes'
      return aTrue === bTrue ? 0 : aTrue ? -1 : 1
    })
  }
  return adj
}

function findStartNode(nodes: Node<NodeData>[], edges: Edge[]): Node<NodeData> | undefined {
  const explicit = nodes.find(
    n => n.type === 'terminator' && str(n.data.label).toLowerCase() === 'start'
  )
  if (explicit) return explicit
  const targetIds = new Set(edges.map(e => e.target))
  return nodes.find(n => !targetIds.has(n.id))
}

function resolveCode(node: Node<NodeData>): string {
  const code = str(node.data.code)
  const label = str(node.data.label)
  return code || label
}

function collectAllCode(nodes: Node<NodeData>[]): string[] {
  return nodes
    .filter(n => n.type !== 'terminator')
    .map(n => resolveCode(n))
    .filter(Boolean)
}

function findMergeNode(
  aId: string | undefined,
  bId: string | undefined,
  adj: Map<string, Edge[]>
): string | undefined {
  if (!aId || !bId) return undefined
  if (aId === bId) return aId

  const aReachable = new Set<string>()
  const queue = [aId]
  while (queue.length) {
    const id = queue.shift()!
    if (aReachable.has(id)) continue
    aReachable.add(id)
    for (const e of adj.get(id) ?? []) queue.push(e.target)
  }

  const bQueue = [bId]
  const bVisited = new Set<string>()
  while (bQueue.length) {
    const id = bQueue.shift()!
    if (bVisited.has(id)) continue
    bVisited.add(id)
    if (aReachable.has(id)) return id
    for (const e of adj.get(id) ?? []) bQueue.push(e.target)
  }

  return undefined
}

// ─── Loop Detection ───────────────────────────────────────────────────────────
// Detects back-edges via BFS to distinguish while loops from if/else
// Matches grammar: WhileLoop vs IfStatement

function detectLoop(
  nodeId: string,
  trueEdge: Edge | undefined,
  falseEdge: Edge | undefined,
  adj: Map<string, Edge[]>
): boolean {
  const checkBackEdge = (startId: string): boolean => {
    const visited = new Set<string>()
    const queue = [startId]
    let hops = 0
    while (queue.length && hops < 50) {
      const id = queue.shift()!
      if (id === nodeId) return true
      if (visited.has(id)) continue
      visited.add(id)
      hops++
      for (const e of adj.get(id) ?? []) queue.push(e.target)
    }
    return false
  }

  if (trueEdge && checkBackEdge(trueEdge.target)) return true
  if (falseEdge && checkBackEdge(falseEdge.target)) return true
  return false
}

// ─── Main Traversal ───────────────────────────────────────────────────────────
// Produces statement list matching grammar Statement* rule inside FunctionDecl body

function traverse(
  nodeId: string,
  nodeMap: Map<string, Node<NodeData>>,
  adj: Map<string, Edge[]>,
  visited: Set<string>,
  indent: string,
  stopAt: Set<string>,
  declaredVars: Set<string>
): string {
  let output = ''
  let currentId: string | undefined = nodeId

  while (currentId && !visited.has(currentId) && !stopAt.has(currentId)) {
    const node = nodeMap.get(currentId)
    if (!node) break

    visited.add(currentId)
    const outEdges: Edge[] = adj.get(currentId) ?? []

    // Terminator nodes (Start/End) — grammar entry/exit, emit nothing
    if (node.type === 'terminator') {
      currentId = outEdges[0]?.target
      continue
    }

    // ── Decision node → IfStatement or WhileLoop ──────────────────────────────
    if (node.type === 'decision') {
      const rawCondition = resolveCode(node)
      // Strip surrounding parens — grammar wraps condition in "(" ")" already
      const condition = rawCondition
        .replace(/^[({[\s]+|[)}\]\s]+$/g, '')
        .trim() || '/* condition */'

      const trueEdge = outEdges.find(e => {
        const l = str(e.label).toLowerCase()
        return l === 'true' || l === 'yes'
      }) ?? outEdges[0]

      const falseEdge: Edge | undefined = outEdges.find(e => {
        const l = str(e.label).toLowerCase()
        return l === 'false' || l === 'no'
      }) ?? outEdges[1]

      const isLoop = detectLoop(currentId, trueEdge, falseEdge, adj)
      const mergeNode = findMergeNode(trueEdge?.target, falseEdge?.target, adj)
      const mergeSet = mergeNode ? new Set([mergeNode]) : new Set<string>()

      if (isLoop) {
        // Grammar: WhileLoop = "while" "(" condition ")" body:Statement
        output += `${indent}while (${condition}) {\n`
        if (trueEdge) {
          output += traverse(trueEdge.target, nodeMap, adj, new Set(visited), indent + '    ', mergeSet, declaredVars)
        }
        output += `${indent}}\n`
      } else {
        // Grammar: IfStatement = "if" "(" condition ")" thenBranch elseBranch?
        output += `${indent}if (${condition}) {\n`
        if (trueEdge) {
          output += traverse(trueEdge.target, nodeMap, adj, new Set(visited), indent + '    ', mergeSet, declaredVars)
        }
        output += `${indent}}`

        if (falseEdge && falseEdge.target !== mergeNode) {
          output += ` else {\n`
          output += traverse(falseEdge.target, nodeMap, adj, new Set(visited), indent + '    ', mergeSet, declaredVars)
          output += `${indent}}`
        }
        output += '\n'
      }

      currentId = mergeNode

    // ── I/O node → StreamStatement ────────────────────────────────────────────
    } else if (node.type === 'io') {
      const label = str(node.data.label)
      const code = str(node.data.code)
      output += `${indent}${normalizeIO(label, code)}\n`
      currentId = outEdges[0]?.target

    // ── Process node → VariableDeclaration or ExpressionStatement ────────────
    } else {
      const rawCode = resolveCode(node)
      const label = str(node.data.label)

      // No real code — emit a comment
      if (!rawCode || rawCode === 'Process' || rawCode === label && !rawCode.includes('=') && !rawCode.includes('(')) {
        if (label && label !== 'Process' && label.length < 80) {
          output += `${indent}// ${label}\n`
        } else {
          output += `${indent}// TODO: implement this step\n`
        }
      } else {
        // Try to parse as grammar VariableDeclaration first
        const decl = parseVarDecl(rawCode)

        if (decl) {
          if (declaredVars.has(decl.name)) {
            // Already declared in this scope — grammar Assignment only (no re-declaration)
            if (decl.value !== undefined) {
              output += `${indent}${decl.name} = ${decl.value};\n`
            }
            // Skip redeclaration with no new value — would be a grammar error
          } else {
            // Grammar VariableDeclaration: TypeModifier* Type Identifier (= Expression)?
            declaredVars.add(decl.name)
            const modPart = decl.modifiers.length ? decl.modifiers.join(' ') + ' ' : ''
            if (decl.isArray) {
              const init = decl.value ? ` = ${decl.value}` : ''
              output += `${indent}${modPart}${decl.varType.replace(/^(const |static )*/, '')} ${decl.name}[${decl.arraySize}]${init};\n`
            } else {
              const init = decl.value !== undefined ? ` = ${decl.value}` : ''
              output += `${indent}${modPart}${decl.varType.replace(/^(const |static )*/, '')} ${decl.name}${init};\n`
            }
          }
        } else {
          // Grammar ExpressionStatement: Expression ";"
          // Handle multi-line blocks (user typed a full block)
          if (rawCode.includes('\n') || rawCode.trimEnd().endsWith('}')) {
            output += rawCode.split('\n').map(l => `${indent}${l}`).join('\n') + '\n'
          } else {
            output += `${indent}${normalizeStatement(rawCode)}\n`
          }
        }
      }

      currentId = outEdges[0]?.target
    }
  }

  return output
}

// ─── Public API ───────────────────────────────────────────────────────────────
// Produces a complete Program matching grammar:
//   Preprocessor* Namespace? Function+
//   → #include <...> \n using namespace std; \n int main() { Statement* return 0; }

export const generateCppFromGraph = (nodes: Node[], edges: Edge[]): string => {
  if (nodes.length === 0) {
    return [
      '#include <iostream>',
      'using namespace std;',
      '',
      'int main() {',
      '    // No nodes yet — use ADD NODE to build your flowchart',
      '    return 0;',
      '}',
      '',
    ].join('\n')
  }

  const typedNodes = nodes as Node<NodeData>[]
  const nodeMap = new Map(typedNodes.map(n => [n.id, n]))
  const adj = buildAdjacency(edges)

  const startNode = findStartNode(typedNodes, edges)
  if (!startNode) {
    return [
      '#include <iostream>',
      'using namespace std;',
      '',
      'int main() {',
      '    // No Start node found — add a Start terminator to your flowchart',
      '    return 0;',
      '}',
      '',
    ].join('\n')
  }

  // Detect required includes from all node code
  const allCode = collectAllCode(typedNodes)
  const includes = detectIncludes(allCode)

  // Track declared variables to enforce grammar: no duplicate VariableDeclaration
  const declaredVars = new Set<string>()

  // Traverse graph → statement list
  const bodyLines = traverse(
    startNode.id,
    nodeMap,
    adj,
    new Set(),
    '    ',
    new Set(),
    declaredVars
  )

  // ── Assemble final file in correct grammar order ───────────────────────────
  // Grammar Program = Preprocessor* Namespace? (Function | VariableDeclaration)+
  //
  // 1. #include directives    (Preprocessor*)
  // 2. using namespace std;   (Namespace)
  // 3. blank line
  // 4. int main() {           (Function → FunctionDecl)
  // 5.   body statements      (Statement*)
  // 6.   return 0;            (ReturnStatement)
  // 7. }

  return [
    ...includes.map(h => `#include <${h}>`),
    'using namespace std;',
    '',
    'int main() {',
    bodyLines.trimEnd() || '    // Empty graph — connect your nodes',
    '    return 0;',
    '}',
    '',
  ].join('\n')
}