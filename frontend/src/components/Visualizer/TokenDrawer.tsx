import React from 'react';
import type { Token } from '../../types';

interface TokenDrawerProps {
  tokens: Token[];
  isOpen: boolean;
  onClose: () => void;
}

export const TokenDrawer: React.FC<TokenDrawerProps> = ({ tokens, isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <>
      {/* Dark Overlay */}
      <div 
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 100 }} 
      />

      {/* Slide-out Panel */}
      <div style={{ 
        position: 'fixed', top: 0, right: 0, height: '100%', width: '350px', 
        backgroundColor: '#252526', color: 'white', zIndex: 101, 
        boxShadow: '-5px 0 15px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column' 
      }}>
        
        <div style={{ padding: '20px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '1.2rem' }}>🔍 Lexical Tokens</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '15px' }}>
          {tokens.map((token, index) => (
            <div key={index} style={{ 
              backgroundColor: '#1e1e1e', marginBottom: '10px', padding: '12px', 
              borderRadius: '6px', border: '1px solid #333', display: 'flex', 
              justifyContent: 'space-between', alignItems: 'center' 
            }}>
              <div>
                <span style={{ display: 'block', fontSize: '10px', fontWeight: 'bold', color: '#569cd6', textTransform: 'uppercase', marginBottom: '4px' }}>
                  {token.type}
                </span>
                <code style={{ backgroundColor: '#333', color: '#ce9178', padding: '2px 6px', borderRadius: '3px' }}>
                  {token.value}
                </code>
              </div>
              <div style={{ textAlign: 'right', fontSize: '10px', color: '#666' }}>
                <div>Ln {token.line}</div>
                <div>Col {token.column}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};