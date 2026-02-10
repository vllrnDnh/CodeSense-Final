{
  function loc() {
    return {
      line: location().start.line,
      column: location().start.column
    };
  }
}

// ============================================================================
// Program Entry Point
// ============================================================================

Program
  = _ directives:Preprocessor* _ namespace:Namespace? _ 
    body:(Function / VariableDeclaration)+ _ {
      return { 
        type: 'Program', 
        directives, 
        namespace: namespace || null, 
        body, 
        ...loc() 
      };
    }

Preprocessor
  = "#include" _ "<" name:$[a-zA-Z0-9_/.]+ ">" _ {
      return { type: 'Include', name, isSystem: true, ...loc() };
    }
  / "#include" _ "\"" name:$[a-zA-Z0-9_/.]+ "\"" _ {
      return { type: 'Include', name, isSystem: false, ...loc() };
    }
  / "#define" _ name:Identifier _ value:MacroValue? _ {
      return { type: 'Define', name, value, ...loc() };
    }
  / "#undef" _ name:Identifier _ {
      return { type: 'Undef', name, ...loc() };
    }
  / "#ifdef" _ name:Identifier _ { 
      return { type: 'IfDef', name, ...loc() }; 
    }
  / "#ifndef" _ name:Identifier _ { 
      return { type: 'IfNDef', name, ...loc() }; 
    }
  / "#if" _ condition:PreprocessorCondition _ {
      return { type: 'If', condition, ...loc() };
    }
  / "#elif" _ condition:PreprocessorCondition _ {
      return { type: 'ElIf', condition, ...loc() };
    }
  / "#else" _ {
      return { type: 'Else', ...loc() };
    }
  / "#endif" _ { 
      return { type: 'EndIf', ...loc() }; 
    }
  / "#pragma" _ directive:PragmaDirective _ {
      return { type: 'Pragma', directive, ...loc() };
    }
  / "#error" _ message:$[^\n]* _ {
      return { type: 'Error', message: message.trim(), ...loc() };
    }
  / "#warning" _ message:$[^\n]* _ {
      return { type: 'Warning', message: message.trim(), ...loc() };
    }
  / "#line" _ lineNum:Integer _ file:String? _ {
      return { type: 'Line', lineNumber: lineNum.value, filename: file?.value, ...loc() };
    }

// Macro value can be expressions or raw text
MacroValue
  = expr:Expression { return expr; }
  / text:$[^\n]+ { return { type: 'MacroText', value: text.trim() }; }

// Preprocessor conditions (simplified - full C preprocessor is complex)
PreprocessorCondition
  = "defined" _ "(" _ name:Identifier _ ")" {
      return { type: 'Defined', name };
    }
  / "defined" __ name:Identifier {
      return { type: 'Defined', name };
    }
  / expr:LogicalOr { return expr; }

// Common pragma directives
PragmaDirective
  = "once" { return { type: 'PragmaOnce' }; }
  / "pack" _ "(" _ value:Integer _ ")" { 
      return { type: 'PragmaPack', value: value.value }; 
    }
  / text:$[^\n]+ { 
      return { type: 'PragmaGeneric', value: text.trim() }; 
    }

GlobalAccess
  = "::" _ name:Identifier {
      return { type: 'GlobalAccess', name, ...loc() };
    }

Namespace
  = "using" __ "namespace" __ name:Identifier _ ";" _ {
      return { type: 'Namespace', name, ...loc() };
    }

// ============================================================================
// Functions
// ============================================================================

Function
  = returnType:Type __ name:Identifier _ "(" _ params:ParameterList? _ ")" _ "{" _ body:Statement* _ "}" _ {
      return {
        type: 'FunctionDecl',
        returnType,
        name,
        params: params || [],
        body,
        ...loc()
      };
    }

FunctionCall
  = name:Identifier _ "(" _ args:ArgumentList? _ ")" {
      return { type: 'FunctionCall', name, arguments: args || [], ...loc() };
    }

ArgumentList
  = first:Expression rest:(_ "," _ Expression)* {
      return [first, ...rest.map(r => r[3])];
    }

ArrayAccess
  = name:Identifier dims:(_ "[" _ Expression _ "]")+ {
      return { type: 'ArrayAccess', name, indices: dims.map(d => d[3]), ...loc() };
    }

ParameterList
  = first:Parameter rest:(_ "," _ Parameter)* {
      return [first, ...rest.map(r => r[3])];
    }

Parameter
  = type:Type __ name:Identifier _ init:("=" _ Expression)? {
      return { 
        type: 'Parameter', 
        varType: type, 
        name, 
        defaultValue: init ? init[2] : null,
        ...loc() 
      };
    }

// ============================================================================
// Statements
// ============================================================================

Statement
  = VariableDeclaration
  / StreamStatement
  / ReturnStatement
  / IfStatement
  / WhileLoop
  / ForLoop
  / DoWhileLoop
  / SwitchStatement
  / LoopControlStatement
  / ExpressionStatement
  / Block

Block
  = "{" _ statements:Statement* _ "}" _ {
      return { type: 'Block', statements, ...loc() };
    }

SwitchStatement
  = "switch" _ "(" _ cond:Expression _ ")" _ "{" _ cases:CaseBlock* _ "}" {
      return { type: 'SwitchStatement', condition: cond, cases, ...loc() };
    }

DoWhileLoop
  = "do" _ body:Statement _ "while" _ "(" _ condition:Expression _ ")" _ ";" _ {
      return {
        type: 'DoWhileLoop',
        condition,
        body: body.type === 'Block' ? body.statements : [body],
        ...loc()
      };
    }

CaseBlock
  = "case" __ val:Expression _ ":" _ statements:Statement* {
      return { type: 'Case', value: val, statements, ...loc() };
    }
  / "default" _ ":" _ statements:Statement* {
      return { type: 'DefaultCase', statements, ...loc() };
    }

LoopControlStatement
  = type:("break" / "continue") _ ";" _ {
      return { type: 'LoopControl', value: type, ...loc() };
    }

VariableDeclaration
  = mods:TypeModifier* _ type:Type __ name:Identifier dims:(_ "[" _ Expression _ "]")* value:(_ "=" _ Expression)? _ ";" _ {
      return {
        type: 'VariableDecl',
        modifiers: mods, 
        varType: type,
        name: name,
        dimensions: dims.map(d => d[3]),
        value: value ? value[3] : null,
        ...loc()
      };
    }

StreamStatement
  = ("std::" _)? "cout" _ items:CoutChain _ ";" _ {
      return { type: 'CoutStatement', values: items, ...loc() };
    }
  / ("std::" _)? "cin" _ items:CinChain _ ";" _ {
      return { type: 'CinStatement', targets: items, ...loc() };
    }

CoutChain
  = "<<" _ first:Expression rest:(_ "<<" _ Expression)* {
      return [first, ...rest.map(r => r[3])];
    }

CinChain
  = ">>" _ first:CinTarget rest:(_ ">>" _ CinTarget)* {
      return [first, ...rest.map(r => r[3])];
    }

CinTarget
  = name:Identifier dims:(_ "[" _ Expression _ "]")+ { 
      return { type: 'ArrayAccess', name, indices: dims.map(d => d[3]), ...loc() }; 
    }
  / Identifier

ReturnStatement
  = "return" __ value:Expression _ ";" _ {
      return { type: 'ReturnStatement', value, ...loc() };
    }
  / "return" _ ";" _ {
      return { type: 'ReturnStatement', value: null, ...loc() };
    }

IfStatement
  = "if" _ "(" _ condition:Expression _ ")" _ thenBranch:Statement elseBranch:(_ "else" _ Statement)? _ {
      return {
        type: 'IfStatement',
        condition,
        thenBranch: thenBranch.type === 'Block' ? thenBranch.statements : [thenBranch],
        elseBranch: elseBranch ? (elseBranch[3].type === 'Block' ? elseBranch[3].statements : [elseBranch[3]]) : null,
        ...loc()
      };
    }

WhileLoop
  = "while" _ "(" _ condition:Expression _ ")" _ body:Statement {
      return {
        type: 'WhileLoop',
        condition,
        body: body.type === 'Block' ? body.statements : [body],
        ...loc()
      };
    }

ForLoop
  = "for" _ "(" _ init:VariableDeclaration? condition:Expression? _ ";" _ update:Expression? _ ")" _ body:Statement {
      return {
        type: 'ForLoop',
        init,
        condition,
        update,
        body: body.type === 'Block' ? body.statements : [body],
        ...loc()
      };
    }

ExpressionStatement
  = expr:Expression _ ";" _ {
      return { type: 'ExpressionStatement', expression: expr, ...loc() };
    }

// ============================================================================
// Expressions
// ============================================================================

Expression = Assignment / InitializerList

Assignment
  = target:Primary _ op:("=" / "+=" / "-=" / "*=" / "/=" / "%=") _ value:Expression {
      return { type: 'Assignment', operator: op, target, value, ...loc() }; 
    }
  / Conditional

Conditional
  = condition:LogicalOr _ "?" _ trueExpr:Expression _ ":" _ falseExpr:Conditional {
      return { 
        type: 'ConditionalExpression', 
        condition, 
        trueExpression: trueExpr, 
        falseExpression: falseExpr, 
        ...loc() 
      };
    }
  / LogicalOr

LogicalOr
  = left:LogicalAnd rest:(_ "||" _ LogicalAnd)* {
      return rest.reduce((acc, r) => ({
        type: 'BinaryOp',
        operator: '||',
        left: acc,
        right: r[3],
        ...loc()
      }), left);
    }

LogicalAnd
  = left:Equality rest:(_ "&&" _ Equality)* {
      return rest.reduce((acc, r) => ({
        type: 'BinaryOp',
        operator: '&&',
        left: acc,
        right: r[3],
        ...loc()
      }), left);
    }

InitializerList
  = "{" _ first:(Expression / InitializerList) rest:(_ "," _ (Expression / InitializerList))* _ "}" {
      return { type: 'InitializerList', values: [first, ...rest.map(r => r[3])], ...loc() };
    }

Equality
  = left:Relational rest:(_ ("==" / "!=") _ Relational)* {
      return rest.reduce((acc, r) => ({
        type: 'BinaryOp',
        operator: r[1],
        left: acc,
        right: r[3],
        ...loc()
      }), left);
    }

Relational
  = left:Additive rest:(_ ("<=" / ">=" / "<" / ">") _ Additive)* {
      return rest.reduce((acc, r) => ({
        type: 'BinaryOp',
        operator: r[1],
        left: acc,
        right: r[3],
        ...loc()
      }), left);
    }

Additive
  = left:Multiplicative rest:(_ ("+" / "-") _ Multiplicative)* {
      return rest.reduce((acc, r) => ({
        type: 'BinaryOp',
        operator: r[1],
        left: acc,
        right: r[3],
        ...loc()
      }), left);
    }

Multiplicative
  = left:Unary rest:(_ ("*" / "/" / "%") _ Unary)* {
      return rest.reduce((acc, r) => ({
        type: 'BinaryOp',
        operator: r[1],
        left: acc,
        right: r[3],
        ...loc()
      }), left);
    }

Unary
  = "(" _ type:Type _ ")" _ operand:Unary { 
      return { type: 'CastExpression', targetType: type, operand, ...loc() }; 
    }
  / "sizeof" _ "(" _ expr:Expression _ ")" { 
      return { type: 'SizeofExpression', value: expr, ...loc() };
    } 
  / "-" _ operand:Unary { return { type: 'UnaryOp', operator: '-', operand, ...loc() }; } 
  / "!" _ operand:Unary { return { type: 'UnaryOp', operator: '!', operand, ...loc() }; } 
  / "*" _ operand:Unary { return { type: 'Dereference', operand, ...loc() }; }
  / "&" _ operand:Unary { return { type: 'AddressOf', operand, ...loc() }; }
  / "++" _ name:Identifier { return { type: 'PreIncrement', operand: name, ...loc() }; }
  / "--" _ name:Identifier { return { type: 'PreDecrement', operand: name, ...loc() }; }
  / name:Identifier _ "++" { return { type: 'PostIncrement', operand: name, ...loc() }; }
  / name:Identifier _ "--" { return { type: 'PostDecrement', operand: name, ...loc() }; }
  / Primary

Primary
  = "(" _ expr:Expression _ ")" { return expr; }
  / BooleanLiteral
  / LambdaExpression
  / Float    // Match "3.14" BEFORE "3"
  / Integer
  / Char
  / String
  / InitializerList
  / ArrayAccess
  / FunctionCall
  / GlobalAccess
  / "std::" name:Identifier { return { type: 'Identifier', name: "std::" + name, ...loc() }; }
  / Identifier

Identifier 
  = !ReservedWord chars:([a-zA-Z_][a-zA-Z0-9_]*) { 
      return chars[0] + chars[1].join(""); 
    }

LambdaExpression
  = capture:LambdaCapture _ "()" _ "{" _ body:Statement* _ "}" {
      return { type: 'LambdaExpression', capture, body, ...loc() };
    }

LambdaCapture
  = "[" _ captureList:($[^\]]*) _ "]" { return captureList; }


// ============================================================================
// Literals
// ============================================================================

BooleanLiteral
  = value:("true" / "false") {
      return { type: 'Literal', value: value === "true", ...loc() };
    }

Integer
  = sign:"-"? value:$[0-9]+ {
      const val = parseInt(value, 10);
      return { type: 'Integer', value: sign ? -val : val, ...loc() };
    }

Float
  = sign:"-"? value:$([0-9]+ "." [0-9]+) {
      const val = parseFloat(value);
      return { type: 'Float', value: sign ? -val : val, ...loc() };
    }

Char
  = "'" char:. "'" {
      return { type: 'Char', value: char, ...loc() };
    }

String
  = "\"" chars:$[^"]* "\"" {
      return { type: 'String', value: chars, ...loc() };
    }

// ============================================================================
// Types
// ============================================================================
Type
  = mods:TypeModifier* _ base:BaseType ptr:(_ ("*" / "&"))* {
      // Combine modifiers, base, and pointers into a single string like "const int*"
      return mods.join(" ") + (mods.length ? " " : "") + base + ptr.map(m => m[1]).join("");
    }

BaseType
  = "long" _ "long" { return "long long"; } 
  / "long" _ "double" { return "long double"; }
  / "unsigned" _ "int" { return "unsigned int"; }
  / ("int" / "float" / "double" / "char" / "bool" / "void" / "string" / "auto" / "typename" / "class" / "struct" / "enum")

TypeModifier
  = ("const" / "static" / "extern" / "volatile" / "unsigned" / "signed" / "inline" / "virtual" / "public" / "private" / "protected" / "override" / "final")

// ============================================================================
// Reserved Keywords (Sync with Lexer)
// ============================================================================

ReservedWord
  = (
      "if" / "else" / "while" / "for" / "return" / "int" / "float" / "double" / 
      "char" / "bool" / "void" / "using" / "namespace" / "auto" / "const" / 
      "static" / "extern" / "unsigned" / "signed" / "sizeof" / "switch" / 
      "case" / "default" / "break" / "continue" / "do" / "long" / "string" / 
      "volatile" / "inline" / "virtual" / "public" / "private" / "protected" / 
      "class" / "struct" / "enum" / "typedef" / "typename" / "template" / 
      "this" / "new" / "delete" / "nullptr" / "try" / "catch" / "throw" / 
      "override" / "final" / "true" / "false"
    ) ![a-zA-Z0-9_]

// ============================================================================
// Whitespace & Comments
// ============================================================================

_
  = (Whitespace / LineComment / BlockComment)*

__
  = (Whitespace / LineComment / BlockComment)+

Whitespace
  = [ \t\r\n]

LineComment
  = "//" [^\r\n]*

BlockComment
  = "/*" (!"*/" .)* "*/"