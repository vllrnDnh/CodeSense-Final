/**
 * Lexical Analyzer (Tokenizer)
 * Converts raw C++ source code into a stream of tokens using regex patterns.
 * This is Phase 1 (Structure) - Step 1 of the analysis pipeline.
 */

import { Token } from '../types';

export interface LexerResult {
  tokens: Token[];
  errors: Array<{ message: string; line: number; column: number }>;
}

// Token pattern definitions
const TOKEN_PATTERNS: Array<{ type: Token['type']; pattern: RegExp }> = [
  // 1. Comments
  { type: 'Comment', pattern: /^\/\/[^\n]*/ },
  { type: 'Comment', pattern: /^\/\*[\s\S]*?\*\// },
  
  // 2. Preprocessor
  { type: 'Keyword', pattern: /^#(include|define|ifdef|ifndef|endif|if|else|elif|pragma)\b/ }, 

  // 3. Keywords 
  { type: 'Keyword', pattern: /^(if|else|while|for|return|int|float|double|char|bool|void|using|namespace|auto|const|static|extern|unsigned|signed|sizeof|switch|case|default|break|continue|do|long|string|volatile|inline|virtual|public|private|protected|class|struct|enum|typedef|typename|template|this|new|delete|nullptr|try|catch|throw|override|final)\b/ },

  // 4. Boolean Literals
  { type: 'Literal', pattern: /^(true|false)\b/ },
  
  // 5. Numeric Literals (Including suffixes like f, f, U, L)
  { type: 'Literal', pattern: /^0x[0-9a-fA-F]+/ }, 
  { type: 'Literal', pattern: /^[0-9]+\.[0-9]+([eE][+-]?[0-9]+)?[fF]?/ }, 
  { type: 'Literal', pattern: /^[0-9]+([eE][+-]?[0-9]+)?[uUlL]{0,2}/ }, 
  
  // 6. Character and String Literals
  { type: 'Literal', pattern: /^'([^'\\]|\\.)*'/ }, 
  { type: 'Literal', pattern: /^"([^"\\]|\\.)*"/ }, 
  
  // 7. Identifiers
  { type: 'Identifier', pattern: /^[a-zA-Z_][a-zA-Z0-9_]*/ },
  
  // 8. Compound Operators (Longest matches first: 3 chars then 2 chars)
  { type: 'Operator', pattern: /^(<<=|>>=)/ }, 
  { type: 'Operator', pattern: /^(==|!=|<=|>=|&&|\|\||<<|>>|\+\+|--|\+=|-=|\*=|\/=|%=|&=|\|=|\^=|->|\:\:)/ },
  
  // 9. Single Operators
  { type: 'Operator', pattern: /^[+\-*\/%=<>!&|?:^~.#]/ }, // Added # for directive matching
  
  // 10. Separators
  { type: 'Separator', pattern: /^[(){}\[\];,]/ },
];
/**
 * Tokenize C++ source code into lexical units
 */
export function tokenize(sourceCode: string): LexerResult {
  const tokens: Token[] = [];
  const errors: Array<{ message: string; line: number; column: number }> = [];
  
  let line = 1;
  let column = 1;
  let position = 0;
  
  while (position < sourceCode.length) {
    let matched = false;
    
    // Handle whitespace (track line/column)
    const whitespaceMatch = sourceCode.slice(position).match(/^[ \t]+/);
    if (whitespaceMatch) {
      column += whitespaceMatch[0].length;
      position += whitespaceMatch[0].length;
      continue;
    }
    
    // Handle newlines
    if (sourceCode[position] === '\n') {
      line++;
      column = 1;
      position++;
      continue;
    }
    if (sourceCode[position] === '\r') {
      position++;
      if (sourceCode[position] === '\n') {
        position++;
      }
      line++;
      column = 1;
      continue;
    }
    
    // Try to match token patterns
    for (const { type, pattern } of TOKEN_PATTERNS) {
      const remaining = sourceCode.slice(position);
      const match = remaining.match(pattern);
      
      if (match) {
        const value = match[0];
        
        // Skip comments (don't add to token stream)
        if (type !== 'Comment') {
          tokens.push({
            type,
            value,
            line,
            column,
          });
        }
        
        // Update position trackers
        const lines = value.split('\n');
        if (lines.length > 1) {
          line += lines.length - 1;
          column = lines[lines.length - 1].length + 1;
        } else {
          column += value.length;
        }
        
        position += value.length;
        matched = true;
        break;
      }
    }
    
    // If no pattern matched, record an error
    if (!matched) {
      const char = sourceCode[position];
      errors.push({
        message: `Unexpected character '${char}' (code: ${char.charCodeAt(0)})`,
        line,
        column,
      });
      column++;
      position++;
    }
  }
  
  return { tokens, errors };
}

/**
 * Pretty-print tokens for debugging
 */
export function formatTokens(tokens: Token[]): string {
  const maxTypeLen = Math.max(...tokens.map(t => t.type.length));
  const maxValueLen = Math.max(...tokens.map(t => t.value.length));
  
  const header = `${'Type'.padEnd(maxTypeLen)} | ${'Value'.padEnd(maxValueLen)} | Location`;
  const separator = '-'.repeat(header.length);
  
  const rows = tokens.map(t => 
    `${t.type.padEnd(maxTypeLen)} | ${t.value.padEnd(maxValueLen)} | L${t.line}:C${t.column}`
  );
  
  return [header, separator, ...rows].join('\n');
}

/**
 * Extract keywords from token stream
 */
export function extractKeywords(tokens: Token[]): string[] {
  return tokens
    .filter(t => t.type === 'Keyword')
    .map(t => t.value);
}

/**
 * Extract identifiers (variable/function names)
 */
export function extractIdentifiers(tokens: Token[]): Set<string> {
  return new Set(
    tokens
      .filter(t => t.type === 'Identifier')
      .map(t => t.value)
  );
}

/**
 * Check if code contains specific constructs
 */
export function hasConstruct(tokens: Token[], keyword: string): boolean {
  return tokens.some(t => t.type === 'Keyword' && t.value === keyword);
}

/**
 * Count operator usage (for complexity analysis)
 */
export function countOperators(tokens: Token[]): Record<string, number> {
  const counts: Record<string, number> = {};
  
  tokens
    .filter(t => t.type === 'Operator')
    .forEach(t => {
      counts[t.value] = (counts[t.value] || 0) + 1;
    });
  
  return counts;
}