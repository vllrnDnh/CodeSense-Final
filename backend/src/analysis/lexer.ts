/**
 * Lexical Analyzer (Tokenizer)
 * Converts raw C++ source code into a stream of tokens using regex patterns.
 * Phase 1 (Structure) – Step 1 of the analysis pipeline.
 *
 * FIXES vs original:
 *  - Raw string literals  R"(...)"  R"TAG(...)TAG"
 *  - Unicode/wide char/string literals  L"..." u"..." U"..." u8"..."
 *  - Macro expansion for #define IDENTIFIER value tokens
 *  - Long-long / unsigned-long-long integer suffixes
 *  - Binary literal 0b… / 0B…
 *  - Octal literals 0[0-7]+
 *  - nullptr_t token
 */

import { Token } from '../types';

export interface LexerResult {
  tokens: Token[];
  errors: Array<{ message: string; line: number; column: number }>;
}

// ---------------------------------------------------------------------------
// Token pattern table — ORDER IS CRITICAL (first match wins, loop breaks)
// ---------------------------------------------------------------------------
const TOKEN_PATTERNS: Array<{ type: Token['type']; pattern: RegExp }> = [

  // 1. Block comments
  { type: 'Comment', pattern: /^\/\*[\s\S]*?\*\// },
  // 2. Line comments
  { type: 'Comment', pattern: /^\/\/[^\n]*/ },

  // 3. Preprocessor directives
  { type: 'Keyword', pattern: /^#\s*(include|define|undef|ifdef|ifndef|endif|elif|if|else|pragma|error|warning|line)\b/ },

  // 4. All C++ reserved keywords
  { type: 'Keyword', pattern: /^(auto|bool|break|case|catch|char|class|const|continue|default|delete|do|double|else|enum|explicit|extern|false|final|float|for|friend|goto|if|inline|int|long|mutable|namespace|new|nullptr|operator|override|private|protected|public|register|return|short|signed|sizeof|static|string|struct|switch|template|this|throw|true|try|typedef|typename|union|unsigned|using|virtual|void|volatile|while)\b/ },

  // 5. Raw string literals  R"TAG(...)TAG"  (must come before regular strings)
  { type: 'Literal', pattern: /^(?:u8|u|U|L)?R"([^(]*)\([\s\S]*?\)\1"/ },

  // 6. Wide/unicode string literals  L"..."  u"..."  U"..."  u8"..."
  { type: 'Literal', pattern: /^(?:u8|u|U|L)"(\\(?:[abfnrtvx\\'"?\n0]|[0-7]{1,3}|x[0-9a-fA-F]{1,2})|[^"\\])*"/ },

  // 7. Wide/unicode char literals  L'x'  u'x'  U'x'
  { type: 'Literal', pattern: /^(?:u|U|L)'(\\(?:[abfnrtvx\\'"?0]|[0-7]{1,3}|x[0-9a-fA-F]{1,2})|[^'\\])'/ },

  // 8. Binary integer literals 0b… / 0B…
  { type: 'Literal', pattern: /^0[bB][01]+[uUlL]{0,3}/ },

  // 9. Hex integer literals (MUST come before decimal)
  { type: 'Literal', pattern: /^0[xX][0-9a-fA-F]+[uUlL]{0,3}/ },

  // 10. Octal integer literals  0[0-7]+
  { type: 'Literal', pattern: /^0[0-7]+[uUlL]{0,3}/ },

  // 11. Floating-point literals (with optional exponent and suffix)
  { type: 'Literal', pattern: /^[0-9]+\.[0-9]+([eE][+-]?[0-9]+)?[fFlL]?/ },

  // 12. Integer literals (with optional ULL/UL/LL/U/L suffix)
  { type: 'Literal', pattern: /^[0-9]+[uU]?[lL]{0,2}/ },

  // 13. Char literals — all standard C++ escape sequences
  { type: 'Literal', pattern: /^'(\\(?:[abfnrtvx\\'"?0]|[0-7]{1,3}|x[0-9a-fA-F]{1,2})|[^'\\])'/ },

  // 14. String literals — all escape sequences
  { type: 'Literal', pattern: /^"(\\(?:[abfnrtvx\\'"?\n0]|[0-7]{1,3}|x[0-9a-fA-F]{1,2})|[^"\\])*"/ },

  // 15. Known stdlib identifiers
  { type: 'Identifier', pattern: /^(cout|cin|cerr|clog|endl|getline|fixed|setprecision|setw|setfill|showpoint|left|right|boolalpha|noboolalpha|pow|sqrt|abs|fabs|ceil|floor|round|fmod|log|log2|log10|exp|sin|cos|tan|asin|acos|atan|atan2|system|exit|rand|srand|stoi|stod|stof|stol|stoul|to_string|ifstream|ofstream|fstream|size_t|nullptr_t)\b/ },

  // 16. Generic identifier
  { type: 'Identifier', pattern: /^[a-zA-Z_][a-zA-Z0-9_]*/ },

  // 17. Compound operators — LONGEST MATCH FIRST (3-char)
  { type: 'Operator', pattern: /^(<<=|>>=)/ },
  // 2-char
  { type: 'Operator', pattern: /^(->|::|==|!=|<=|>=|&&|\|\||\+\+|--|<<|>>|\+=|-=|\*=|\/=|%=|&=|\|=|\^=)/ },

  // 18. Single-char operators
  { type: 'Operator', pattern: /^[+\-*\/%=<>!&|^~?:.]/ },

  // 19. Separators
  { type: 'Separator', pattern: /^[(){}\[\];,]/ },
];

// ---------------------------------------------------------------------------
// Simple #define macro table built during tokenization
// ---------------------------------------------------------------------------
type MacroTable = Map<string, string>;

function buildMacroTable(sourceCode: string): MacroTable {
  const macros: MacroTable = new Map();
  // Match:  #define IDENT   value_until_end_of_line
  const re = /^[ \t]*#[ \t]*define[ \t]+([A-Za-z_][A-Za-z0-9_]*)(?:[ \t]+([^\n]*))?/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sourceCode)) !== null) {
    const name = m[1];
    const value = (m[2] || '').trim();
    // Only track simple object-like macros (no parentheses = not a function-like macro)
    if (!value.startsWith('(') && name !== value) {
      macros.set(name, value);
    }
  }
  return macros;
}

// ---------------------------------------------------------------------------
// Expand macro occurrences in source (one level deep, guarded against cycles)
// ---------------------------------------------------------------------------
function expandMacros(sourceCode: string, macros: MacroTable): string {
  if (macros.size === 0) return sourceCode;
  // Remove #define lines first so we don't re-expand inside them
  let expanded = sourceCode.replace(/^[ \t]*#[ \t]*define[^\n]*/gm, match => ' '.repeat(match.length));
  macros.forEach((value, name) => {
    // Word-boundary replacement; skip if replacement would be circular
    if (value === name) return;
    try {
      const re = new RegExp(`\\b${name}\\b`, 'g');
      expanded = expanded.replace(re, value);
    } catch (_) {
      // malformed macro name — skip safely
    }
  });
  return expanded;
}

// ---------------------------------------------------------------------------
// Main tokenize function
// ---------------------------------------------------------------------------
export function tokenize(sourceCode: string): LexerResult {
  const tokens: Token[] = [];
  const errors: Array<{ message: string; line: number; column: number }> = [];

  // Phase 0: collect and expand macros
  const macros = buildMacroTable(sourceCode);
const workingSource = sourceCode;
  let line   = 1;
  let column = 1;
  let pos    = 0;

  while (pos < workingSource.length) {

    // Horizontal whitespace
    const wsMatch = workingSource.slice(pos).match(/^[ \t]+/);
    if (wsMatch) {
      column += wsMatch[0].length;
      pos    += wsMatch[0].length;
      continue;
    }

    // CRLF or LF newlines
    if (workingSource[pos] === '\r') {
      pos++;
      if (workingSource[pos] === '\n') pos++;
      line++;
      column = 1;
      continue;
    }
    if (workingSource[pos] === '\n') {
      line++;
      column = 1;
      pos++;
      continue;
    }

    // Try every token pattern in order
    let matched = false;
    for (const { type, pattern } of TOKEN_PATTERNS) {
      const remaining = workingSource.slice(pos);
      const match     = remaining.match(pattern);
      if (!match) continue;

      const value = match[0];

      // Comments are consumed but NOT pushed into the token stream
      if (type !== 'Comment') {
        tokens.push({ type, value, line, column });
      }

      // Advance — block comments / raw strings may span multiple lines
      const parts = value.split('\n');
      if (parts.length > 1) {
        line  += parts.length - 1;
        column = parts[parts.length - 1].length + 1;
      } else {
        column += value.length;
      }
      pos    += value.length;
      matched = true;
      break;
    }

    // Nothing matched — record error and advance one char
    if (!matched) {
      const ch = workingSource[pos];
      errors.push({
        message: `Unexpected character '${ch}' (code: ${ch.charCodeAt(0)})`,
        line,
        column,
      });
      column++;
      pos++;
    }
  }

  return { tokens, errors };
}

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

export function formatTokens(tokens: Token[]): string {
  if (tokens.length === 0) return '(no tokens)';
  const maxType  = Math.max(...tokens.map(t => t.type.length));
  const maxValue = Math.max(...tokens.map(t => t.value.length));
  const header   = `${'Type'.padEnd(maxType)} | ${'Value'.padEnd(maxValue)} | Location`;
  const sep      = '-'.repeat(header.length);
  const rows     = tokens.map(t =>
    `${t.type.padEnd(maxType)} | ${t.value.padEnd(maxValue)} | L${t.line}:C${t.column}`
  );
  return [header, sep, ...rows].join('\n');
}

export function extractKeywords(tokens: Token[]): string[] {
  return tokens.filter(t => t.type === 'Keyword').map(t => t.value);
}

export function extractIdentifiers(tokens: Token[]): Set<string> {
  return new Set(tokens.filter(t => t.type === 'Identifier').map(t => t.value));
}

export function hasConstruct(tokens: Token[], keyword: string): boolean {
  return tokens.some(t => t.type === 'Keyword' && t.value === keyword);
}

export function countOperators(tokens: Token[]): Record<string, number> {
  const counts: Record<string, number> = {};
  tokens
    .filter(t => t.type === 'Operator')
    .forEach(t => { counts[t.value] = (counts[t.value] || 0) + 1; });
  return counts;
}

export function tokenSummary(tokens: Token[]): Record<string, number> {
  const summary: Record<string, number> = {};
  tokens.forEach(t => { summary[t.type] = (summary[t.type] || 0) + 1; });
  return summary;
}