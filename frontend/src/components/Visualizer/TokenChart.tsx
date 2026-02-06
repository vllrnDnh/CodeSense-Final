import React, { useMemo } from 'react';
import type { Token } from '../../types';

interface TokenChartProps {
  tokens: Token[];
}

export const TokenChart: React.FC<TokenChartProps> = ({ tokens }) => {
  // Aggregate counts of each token type
  const stats = useMemo(() => {
    const counts: Record<string, number> = {
      Keyword: 0,
      Identifier: 0,
      Operator: 0,
      Literal: 0,
      Separator: 0
    };

    tokens.forEach(t => {
      if (counts[t.type] !== undefined) {
        counts[t.type]++;
      }
    });

    return counts;
  }, [tokens]);

  const maxCount = Math.max(...Object.values(stats), 1);

  return (
    <div className="token-stats" style={{ marginTop: '20px', padding: '15px', background: '#252526', borderRadius: '8px' }}>
      <h3 style={{ fontSize: '0.9rem', marginBottom: '15px', color: '#aaa', textTransform: 'uppercase' }}>
        Lexical Distribution
      </h3>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {Object.entries(stats).map(([type, count]) => (
          <div key={type} style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
              <span>{type}</span>
              <span style={{ color: '#007acc', fontWeight: 'bold' }}>{count}</span>
            </div>
            {/* Simple Progress Bar */}
            <div style={{ height: '6px', background: '#444', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ 
                height: '100%', 
                width: `${(count / maxCount) * 100}%`, 
                background: getTokenTypeColor(type),
                transition: 'width 0.5s ease-out'
              }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Helper for consistent coloring across the UI
const getTokenTypeColor = (type: string) => {
  switch (type) {
    case 'Keyword': return '#569cd6';
    case 'Identifier': return '#9cdcfe';
    case 'Operator': return '#d4d4d4';
    case 'Literal': return '#b5cea8';
    case 'Separator': return '#cccccc';
    default: return '#808080';
  }
};