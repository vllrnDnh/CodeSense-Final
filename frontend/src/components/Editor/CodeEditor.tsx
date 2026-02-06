import React from 'react';

interface CodeEditorProps {
  code: string;
  onChange: (value: string) => void;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({ code, onChange }) => {
  
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  // Calculate line numbers based on newlines
  const lineNumbers = code.split('\n').map((_, i) => i + 1).join('\n');

  return (
    <div style={{ 
      display: 'flex', 
      height: '100%', 
      width: '100%', 
      backgroundColor: '#1e1e1e', 
      color: '#d4d4d4', 
      overflow: 'hidden' 
    }}>
      {/* Line Numbers Gutter */}
      <div style={{ 
        width: '40px', 
        backgroundColor: '#252526', 
        color: '#858585', 
        textAlign: 'right', 
        paddingRight: '10px', 
        paddingTop: '10px', 
        borderRight: '1px solid #333', 
        userSelect: 'none', 
        lineHeight: '1.5' 
      }}>
        <pre style={{ margin: 0 }}>{lineNumbers}</pre>
      </div>

      {/* Text Area */}
      <textarea
        style={{
           flex: 1,
           height: '100%',
           width: '100%',
           backgroundColor: 'transparent',
           border: 'none',
           resize: 'none',
           padding: '10px',
           outline: 'none',
           color: 'inherit',
           fontFamily: 'Consolas, Monaco, monospace',
           lineHeight: '1.5'
        }}
        value={code}
        onChange={handleChange}
        spellCheck={false}
        autoCapitalize="off"
        autoComplete="off"
      />
    </div>
  );
};