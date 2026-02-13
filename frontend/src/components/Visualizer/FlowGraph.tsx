import React, { useState, useEffect, useCallback } from 'react';
import { ReactFlow, Background, Controls, MarkerType, Handle, Position, applyNodeChanges } from '@xyflow/react';
import type { Edge, Node, NodeProps } from '@xyflow/react';
import ELK from 'elkjs/lib/elk.bundled.js'; 
import '@xyflow/react/dist/style.css';
import type { CFG, SafetyCheck, ControlFlowNode } from '../../types';

interface Props {
  cfg: CFG;
  safetyChecks: SafetyCheck[];
  onNodeClick?: (line: number) => void;
  isDrawerOpen?: boolean;
}

interface ExtendedNodeData extends ControlFlowNode {
  violation?: boolean;
  visited?: boolean;
  onHover?: (msg: string | null) => void;
}

const elk = new ELK();

// Collapsible Legend Component
const FlowchartLegend: React.FC<{ isDrawerOpen?: boolean }> = ({ isDrawerOpen = false }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  return (
    <div style={{
      position: 'absolute',
      bottom: '80px',
      left: '20px',
      zIndex: 1000,
      background: 'linear-gradient(135deg, rgba(13, 17, 23, 0.98) 0%, rgba(22, 27, 34, 0.98) 100%)',
      border: '2px solid #30363d',
      borderRadius: '12px',
      padding: isExpanded ? '16px' : '12px 16px',
      minWidth: isExpanded ? '240px' : 'auto',
      maxWidth: isExpanded ? '240px' : '180px',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
      backdropFilter: 'blur(10px)',
      transition: 'all 0.3s ease',
      opacity: isDrawerOpen ? 0.3 : 1,
      filter: isDrawerOpen ? 'blur(2px)' : 'none',
      pointerEvents: isDrawerOpen ? 'none' : 'auto'
    }}>
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        style={{ 
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          userSelect: 'none'
        }}
      >
        <div style={{ 
          fontSize: '12px', 
          fontWeight: 'bold', 
          color: '#58a6ff',
          letterSpacing: '0.5px'
        }}>
          📊 LEGEND
        </div>
        <div style={{ 
          fontSize: '16px',
          color: '#58a6ff',
          transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.3s ease'
        }}>
          ▼
        </div>
      </div>
      
      {isExpanded && (
        <div style={{ marginTop: '14px', borderTop: '1px solid #30363d', paddingTop: '12px' }}>
          {/* Start/End */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px', gap: '10px' }}>
            <div style={{
              width: '50px',
              height: '26px',
              background: 'linear-gradient(135deg, #0d47a1 0%, #1976d2 100%)',
              border: '2px solid #42a5f5',
              borderRadius: '50px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '7px',
              color: 'white',
              fontWeight: '600'
            }}>
              Start
            </div>
            <div style={{ fontSize: '10px', color: '#c9d1d9', flex: 1 }}>
              <strong style={{ color: 'white', display: 'block' }}>Start/End</strong>
              <span style={{ fontSize: '9px', opacity: 0.8 }}>Entry/Exit</span>
            </div>
          </div>

          {/* Process */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px', gap: '10px' }}>
            <div style={{
              width: '50px',
              height: '26px',
              background: 'linear-gradient(135deg, #1e1e1e 0%, #2d2d2d 100%)',
              border: '2px solid #4caf50',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '7px',
              color: 'white',
              fontWeight: '600'
            }}>
              Process
            </div>
            <div style={{ fontSize: '10px', color: '#c9d1d9', flex: 1 }}>
              <strong style={{ color: 'white', display: 'block' }}>Process</strong>
              <span style={{ fontSize: '9px', opacity: 0.8 }}>Action</span>
            </div>
          </div>

          {/* Decision */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px', gap: '10px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              background: 'linear-gradient(135deg, #1a1a2e 0%, #2d2d44 100%)',
              border: '2px solid #ffa726',
              transform: 'rotate(45deg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <div style={{ 
                transform: 'rotate(-45deg)', 
                fontSize: '7px', 
                color: 'white',
                fontWeight: '600'
              }}>
                If?
              </div>
            </div>
            <div style={{ fontSize: '10px', color: '#c9d1d9', flex: 1 }}>
              <strong style={{ color: 'white', display: 'block' }}>Decision</strong>
              <span style={{ fontSize: '9px', opacity: 0.8 }}>Condition</span>
            </div>
          </div>

          {/* Input/Output - Pretty Parallelogram */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <svg width="50" height="26" viewBox="0 0 50 26" style={{ flexShrink: 0 }}>
              <defs>
                <linearGradient id="legend-io-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style={{ stopColor: '#2a5298', stopOpacity: 1 }} />
                  <stop offset="100%" style={{ stopColor: '#1e3a5f', stopOpacity: 1 }} />
                </linearGradient>
              </defs>
              <path
                d="M 5 2 L 45 2 L 48 24 L 8 24 Z"
                fill="url(#legend-io-grad)"
                stroke="#64b5f6"
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <path
                d="M 5 2 L 45 2 L 48 24 L 8 24 Z"
                fill="white"
                opacity="0.1"
              />
            </svg>
            <div style={{ fontSize: '10px', color: '#c9d1d9', flex: 1 }}>
              <strong style={{ color: 'white', display: 'block' }}>Input/Output</strong>
              <span style={{ fontSize: '9px', opacity: 0.8 }}>cin/cout</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Collapsible Game Stats
const GameStats: React.FC<{ visitedNodes: Set<string>; totalNodes: number; safeNodes: number; isDrawerOpen?: boolean }> = ({ 
  visitedNodes, 
  totalNodes, 
  safeNodes,
  isDrawerOpen = false
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  
  return (
    <div style={{
      position: 'absolute',
      top: '20px',
      left: '20px',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      opacity: isDrawerOpen ? 0.3 : 1,
      filter: isDrawerOpen ? 'blur(2px)' : 'none',
      transition: 'all 0.3s ease',
      pointerEvents: isDrawerOpen ? 'none' : 'auto'
    }}>
      {/* Exploration Progress */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(13, 17, 23, 0.95) 0%, rgba(22, 27, 34, 0.95) 100%)',
        border: '2px solid #4caf50',
        borderRadius: '12px',
        padding: isExpanded ? '14px 16px' : '10px 14px',
        minWidth: isExpanded ? '200px' : '160px',
        boxShadow: '0 4px 20px rgba(76, 175, 80, 0.3)',
        transition: 'all 0.3s ease'
      }}>
        <div 
          onClick={() => setIsExpanded(!isExpanded)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            userSelect: 'none'
          }}
        >
          <div style={{ 
            fontSize: '10px', 
            color: '#4caf50', 
            fontWeight: 'bold',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            📍 Exploration
          </div>
          <div style={{ 
            fontSize: '14px',
            color: '#4caf50',
            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.3s ease'
          }}>
            ▼
          </div>
        </div>
        
        <div style={{ fontSize: '15px', color: 'white', fontWeight: '600', marginTop: '6px' }}>
          {visitedNodes.size} / {totalNodes}
        </div>
        
        {isExpanded && (
          <>
            <div style={{
              width: '100%',
              height: '6px',
              background: 'rgba(76, 175, 80, 0.15)',
              borderRadius: '3px',
              overflow: 'hidden',
              border: '1px solid rgba(76, 175, 80, 0.3)',
              marginTop: '8px'
            }}>
              <div style={{
                width: `${(visitedNodes.size / totalNodes) * 100}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #4caf50 0%, #66bb6a 100%)',
                transition: 'width 0.4s ease',
                boxShadow: '0 0 10px rgba(76, 175, 80, 0.6)'
              }} />
            </div>
            {visitedNodes.size === totalNodes && (
              <div style={{ 
                fontSize: '10px', 
                color: '#4caf50', 
                marginTop: '6px',
                fontWeight: '600'
              }}>
                ✓ Complete!
              </div>
            )}
          </>
        )}
      </div>

      {/* Safety Score */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(13, 17, 23, 0.95) 0%, rgba(22, 27, 34, 0.95) 100%)',
        border: `2px solid ${safeNodes === totalNodes ? '#4caf50' : '#ff4444'}`,
        borderRadius: '12px',
        padding: isExpanded ? '14px 16px' : '10px 14px',
        minWidth: isExpanded ? '200px' : '160px',
        boxShadow: `0 4px 20px ${safeNodes === totalNodes ? 'rgba(76, 175, 80, 0.3)' : 'rgba(255, 68, 68, 0.3)'}`,
        transition: 'all 0.3s ease'
      }}>
        <div 
          onClick={() => setIsExpanded(!isExpanded)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            userSelect: 'none'
          }}
        >
          <div style={{ 
            fontSize: '10px', 
            color: safeNodes === totalNodes ? '#4caf50' : '#ff4444', 
            fontWeight: 'bold',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            🛡️ Safety
          </div>
          <div style={{ 
            fontSize: '14px',
            color: safeNodes === totalNodes ? '#4caf50' : '#ff4444',
            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.3s ease'
          }}>
            ▼
          </div>
        </div>
        
        <div style={{ 
          fontSize: '17px', 
          color: 'white', 
          fontWeight: 'bold',
          marginTop: '4px'
        }}>
          {safeNodes} / {totalNodes}
        </div>
        
        {isExpanded && (
          <div style={{ 
            fontSize: '10px', 
            color: safeNodes === totalNodes ? '#4caf50' : '#ff4444', 
            fontWeight: '600',
            marginTop: '6px'
          }}>
            {safeNodes === totalNodes ? '✓ All safe' : `⚠ ${totalNodes - safeNodes} issue${totalNodes - safeNodes > 1 ? 's' : ''}`}
          </div>
        )}
      </div>
    </div>
  );
};

// Start/End Node (Terminator - Oval)
const TerminatorNode = ({ data, selected }: NodeProps<Node<ExtendedNodeData>>) => {
  const isViolation = data.violation ?? false;
  const isVisited = data.visited ?? false;
  
  return (
    <div 
      className="terminator-node"
      onMouseEnter={() => data.onHover?.(data.tutorExplanation || null)}
      onMouseLeave={() => data.onHover?.(null)}
      style={{
        padding: '14px 28px',
        minWidth: '120px',
        textAlign: 'center',
        color: 'white',
        background: isViolation 
          ? 'linear-gradient(135deg, #2d0a0a 0%, #4a1515 100%)'
          : isVisited
            ? 'linear-gradient(135deg, #0a2d0a 0%, #154a15 100%)'
            : 'linear-gradient(135deg, #0d47a1 0%, #1976d2 100%)',
        border: `3px solid ${isViolation ? '#ff4444' : isVisited ? '#4caf50' : '#42a5f5'}`,
        borderRadius: '50px',
        fontSize: '13px',
        fontWeight: '700',
        position: 'relative',
        cursor: 'pointer',
        boxShadow: isViolation
          ? '0 4px 20px rgba(255, 68, 68, 0.4), inset 0 0 30px rgba(255, 68, 68, 0.15)'
          : isVisited
            ? '0 4px 20px rgba(76, 175, 80, 0.4), inset 0 0 30px rgba(76, 175, 80, 0.15)'
            : '0 4px 20px rgba(66, 165, 245, 0.4), inset 0 0 30px rgba(66, 165, 245, 0.15)',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        animation: selected ? 'pulse 1.5s ease-in-out infinite' : 'none',
        textShadow: '0 2px 4px rgba(0,0,0,0.5)',
        letterSpacing: '0.5px'
      }}
    >
      {isViolation && (
        <div style={{
          position: 'absolute',
          top: '-12px',
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: '20px',
          animation: 'bounce 1s ease-in-out infinite',
          filter: 'drop-shadow(0 0 8px rgba(255, 68, 68, 0.8))'
        }}>
          ⚠️
        </div>
      )}
      
      <Handle 
        type="target" 
        position={Position.Top} 
        style={{ 
          background: isViolation ? '#ff4444' : isVisited ? '#4caf50' : '#42a5f5',
          width: '12px',
          height: '12px',
          border: '2px solid #0d1117',
          boxShadow: `0 0 10px ${isViolation ? '#ff4444' : isVisited ? '#4caf50' : '#42a5f5'}`
        }} 
      />
      {String(data.label ?? '')}
      <Handle 
        type="source" 
        position={Position.Bottom} 
        style={{ 
          background: isViolation ? '#ff4444' : isVisited ? '#4caf50' : '#42a5f5',
          width: '12px',
          height: '12px',
          border: '2px solid #0d1117',
          boxShadow: `0 0 10px ${isViolation ? '#ff4444' : isVisited ? '#4caf50' : '#42a5f5'}`
        }} 
      />
    </div>
  );
};

// Input/Output Node (Pretty Parallelogram with smooth curves)
const IONode = ({ data, selected }: NodeProps<Node<ExtendedNodeData>>) => {
  const isViolation = data.violation ?? false;
  const isVisited = data.visited ?? false;
  
  const borderColor = isViolation ? '#ff4444' : isVisited ? '#4caf50' : '#64b5f6';
  const glowColor = isViolation 
    ? 'rgba(255, 68, 68, 0.4)' 
    : isVisited 
      ? 'rgba(76, 175, 80, 0.3)' 
      : 'rgba(100, 181, 246, 0.3)';
  
  return (
    <div 
      className="io-node"
      onMouseEnter={() => data.onHover?.(data.tutorExplanation || null)}
      onMouseLeave={() => data.onHover?.(null)}
      style={{
        position: 'relative',
        width: '180px',
        height: '70px',
        cursor: 'pointer',
        animation: selected ? 'pulse 1.5s ease-in-out infinite' : 'none',
      }}
    >
      {/* Main parallelogram shape */}
      <svg 
        width="180" 
        height="70" 
        viewBox="0 0 180 70" 
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          filter: `drop-shadow(0 4px 20px ${glowColor})`,
        }}
      >
        <defs>
          <linearGradient id={`io-grad-${data.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ 
              stopColor: isViolation ? '#4a1515' : isVisited ? '#2d5a2d' : '#2a5298', 
              stopOpacity: 1 
            }} />
            <stop offset="100%" style={{ 
              stopColor: isViolation ? '#2d0a0a' : isVisited ? '#1a3a1a' : '#1e3a5f', 
              stopOpacity: 1 
            }} />
          </linearGradient>
          
          {/* Glossy overlay gradient */}
          <linearGradient id={`io-gloss-${data.id}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style={{ stopColor: 'white', stopOpacity: 0.15 }} />
            <stop offset="50%" style={{ stopColor: 'white', stopOpacity: 0.05 }} />
            <stop offset="100%" style={{ stopColor: 'black', stopOpacity: 0.1 }} />
          </linearGradient>
        </defs>
        
        {/* Outer glow border */}
        <path
          d="M 25 5 L 155 5 L 165 65 L 35 65 Z"
          fill="none"
          stroke={borderColor}
          strokeWidth="1"
          opacity="0.3"
          style={{ filter: `blur(3px)` }}
        />
        
        {/* Main parallelogram */}
        <path
          d="M 20 3 L 160 3 L 170 67 L 30 67 Z"
          fill={`url(#io-grad-${data.id})`}
          stroke={borderColor}
          strokeWidth={selected ? '3' : '2.5'}
          strokeLinejoin="round"
          style={{
            transition: 'all 0.3s ease'
          }}
        />
        
        {/* Glossy overlay */}
        <path
          d="M 20 3 L 160 3 L 170 67 L 30 67 Z"
          fill={`url(#io-gloss-${data.id})`}
          opacity="0.6"
        />
        
        {/* Inner highlight */}
        <path
          d="M 25 8 L 158 8 L 165 62 L 32 62 Z"
          fill="none"
          stroke="white"
          strokeWidth="1"
          opacity="0.1"
        />
      </svg>
      
      {isViolation && (
        <div style={{
          position: 'absolute',
          top: '-12px',
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: '20px',
          animation: 'bounce 1s ease-in-out infinite',
          filter: 'drop-shadow(0 0 8px rgba(255, 68, 68, 0.8))',
          zIndex: 10
        }}>
          ⚠️
        </div>
      )}
      
      <Handle 
        type="target" 
        position={Position.Top} 
        style={{ 
          background: borderColor,
          width: '12px',
          height: '12px',
          border: '2px solid #0d1117',
          boxShadow: `0 0 10px ${borderColor}`,
          zIndex: 5
        }} 
      />
      
      {/* Content container */}
      <div style={{ 
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '140px',
        textAlign: 'center',
        zIndex: 1,
        pointerEvents: 'none',
        userSelect: 'none'
      }}>
        <strong style={{ 
          display: 'block', 
          color: 'white',
          fontSize: '13px',
          fontWeight: '700',
          marginBottom: data.code ? '6px' : '0',
          textShadow: '0 2px 4px rgba(0,0,0,0.7)',
          letterSpacing: '0.3px'
        }}>
          {String(data.label ?? '')}
        </strong>
        {data.code && (
          <code style={{ 
            display: 'block', 
            color: 'rgba(255,255,255,0.9)',
            fontSize: '10px',
            fontFamily: "'JetBrains Mono', monospace",
            background: 'rgba(0,0,0,0.4)',
            padding: '4px 8px',
            borderRadius: '4px',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.3)'
          }}>
            {String(data.code)}
          </code>
        )}
      </div>
      
      <Handle 
        type="source" 
        position={Position.Bottom} 
        style={{ 
          background: borderColor,
          width: '12px',
          height: '12px',
          border: '2px solid #0d1117',
          boxShadow: `0 0 10px ${borderColor}`,
          zIndex: 5
        }} 
      />
    </div>
  );
};

// Decision Node (Diamond)
const DecisionNode = ({ data, selected }: NodeProps<Node<ExtendedNodeData>>) => {
  const isViolation = data.violation ?? false;
  const isVisited = data.visited ?? false;
  
  return (
    <div 
      className="decision-node"
      onMouseEnter={() => data.onHover?.(data.tutorExplanation || null)}
      onMouseLeave={() => data.onHover?.(null)}
      style={{
        width: '120px',
        height: '120px',
        background: isViolation 
          ? 'linear-gradient(135deg, #2d0a0a 0%, #4a1515 100%)' 
          : isVisited
            ? 'linear-gradient(135deg, #1a2e1a 0%, #2d442d 100%)'
            : 'linear-gradient(135deg, #1a1a2e 0%, #2d2d44 100%)',
        border: `3px solid ${isViolation ? '#ff4444' : isVisited ? '#4caf50' : '#ffa726'}`,
        transform: 'rotate(45deg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        cursor: 'pointer',
        boxShadow: isViolation 
          ? '0 4px 20px rgba(255, 68, 68, 0.4), inset 0 0 20px rgba(255, 68, 68, 0.15)' 
          : isVisited
            ? '0 4px 20px rgba(76, 175, 80, 0.4), inset 0 0 20px rgba(76, 175, 80, 0.15)'
            : '0 4px 15px rgba(255, 167, 38, 0.3), inset 0 0 20px rgba(255, 167, 38, 0.08)',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        animation: selected ? 'pulse 1.5s ease-in-out infinite' : 'none',
      }}
    >
      {isViolation && (
        <div style={{
          position: 'absolute',
          top: '-12px',
          left: '50%',
          transform: 'translateX(-50%) rotate(-45deg)',
          fontSize: '20px',
          animation: 'bounce 1s ease-in-out infinite',
          filter: 'drop-shadow(0 0 8px rgba(255, 68, 68, 0.8))'
        }}>
          ⚠️
        </div>
      )}
      
      <Handle 
        type="target" 
        position={Position.Top} 
        style={{ 
          background: isViolation ? '#ff4444' : isVisited ? '#4caf50' : '#ffa726',
          width: '12px',
          height: '12px',
          border: '2px solid #0d1117',
          boxShadow: `0 0 10px ${isViolation ? '#ff4444' : isVisited ? '#4caf50' : '#ffa726'}`
        }} 
      />
      <div 
        style={{ 
          transform: 'rotate(-45deg)', 
          color: 'white', 
          fontSize: '12px', 
          fontWeight: '700',
          textAlign: 'center', 
          pointerEvents: 'none',
          maxWidth: '75px',
          lineHeight: '1.2',
          textShadow: '0 2px 4px rgba(0,0,0,0.7)'
        }}
      >
        {String(data.label ?? '')}
      </div>
      <Handle 
        type="source" 
        position={Position.Bottom} 
        style={{ 
          background: isViolation ? '#ff4444' : isVisited ? '#4caf50' : '#ffa726',
          width: '12px',
          height: '12px',
          border: '2px solid #0d1117',
          boxShadow: `0 0 10px ${isViolation ? '#ff4444' : isVisited ? '#4caf50' : '#ffa726'}`
        }} 
      />
    </div>
  );
};

// Process Node (Rectangle)
const ProcessNode = ({ data, selected }: NodeProps<Node<ExtendedNodeData>>) => {
  const isViolation = data.violation ?? false;
  const isVisited = data.visited ?? false;
  
  return (
    <div 
      className="process-node"
      onMouseEnter={() => data.onHover?.(data.tutorExplanation || null)}
      onMouseLeave={() => data.onHover?.(null)}
      style={{
        padding: '16px 18px',
        minWidth: '160px',
        maxWidth: '200px',
        textAlign: 'center',
        color: 'white',
        background: isViolation 
          ? 'linear-gradient(135deg, #2d0a0a 0%, #4a1515 100%)'
          : isVisited
            ? 'linear-gradient(135deg, #1a2e1a 0%, #2d4a2d 100%)'
            : 'linear-gradient(135deg, #1e1e1e 0%, #2d2d2d 100%)',
        border: `3px solid ${isViolation ? '#ff4444' : isVisited ? '#4caf50' : '#4caf50'}`,
        borderRadius: '6px',
        fontSize: '12px',
        fontWeight: '600',
        position: 'relative',
        cursor: 'pointer',
        boxShadow: isViolation 
          ? '0 4px 20px rgba(255, 68, 68, 0.4), inset 0 0 20px rgba(255, 68, 68, 0.15)'
          : isVisited
            ? '0 4px 15px rgba(76, 175, 80, 0.3), inset 0 0 20px rgba(76, 175, 80, 0.1)'
            : '0 4px 12px rgba(76, 175, 80, 0.2), inset 0 0 15px rgba(76, 175, 80, 0.05)',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        animation: selected ? 'pulse 1.5s ease-in-out infinite' : 'none',
      }}
    >
      {isViolation && (
        <div style={{
          position: 'absolute',
          top: '-12px',
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: '20px',
          animation: 'bounce 1s ease-in-out infinite',
          filter: 'drop-shadow(0 0 8px rgba(255, 68, 68, 0.8))'
        }}>
          ⚠️
        </div>
      )}
      
      <Handle 
        type="target" 
        position={Position.Top} 
        style={{ 
          background: isViolation ? '#ff4444' : isVisited ? '#4caf50' : '#64b5f6',
          width: '12px',
          height: '12px',
          border: '2px solid #0d1117',
          boxShadow: `0 0 10px ${isViolation ? '#ff4444' : isVisited ? '#4caf50' : '#64b5f6'}`
        }} 
      />
      <div style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <strong 
          style={{ 
            display: 'block',
            fontSize: '13px',
            marginBottom: data.code ? '6px' : '0',
            letterSpacing: '0.3px',
            textShadow: '0 2px 3px rgba(0,0,0,0.6)'
          }}
        >
          {String(data.label ?? 'Process')}
        </strong>
        {data.code && (
          <code 
            style={{ 
              display: 'block', 
              fontSize: '10px', 
              opacity: 0.9,
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              background: 'rgba(0,0,0,0.4)',
              padding: '5px 7px',
              borderRadius: '4px',
              marginTop: '4px',
              lineHeight: '1.4',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word'
            }}
          >
            {String(data.code)}
          </code>
        )}
      </div>
      <Handle 
        type="source" 
        position={Position.Bottom} 
        style={{ 
          background: isViolation ? '#ff4444' : isVisited ? '#4caf50' : '#64b5f6',
          width: '12px',
          height: '12px',
          border: '2px solid #0d1117',
          boxShadow: `0 0 10px ${isViolation ? '#ff4444' : isVisited ? '#4caf50' : '#64b5f6'}`
        }} 
      />
    </div>
  );
};

const nodeTypes = { 
  terminator: TerminatorNode,
  decision: DecisionNode, 
  process: ProcessNode,
  io: IONode
};

export const FlowGraph: React.FC<Props> = ({ cfg, safetyChecks, onNodeClick, isDrawerOpen = false }) => {
  const [nodes, setNodes] = useState<Node<ExtendedNodeData>[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [isInteractive, setIsInteractive] = useState(true);
  const [hoverInfo, setHoverInfo] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [visitedNodes, setVisitedNodes] = useState<Set<string>>(new Set());

  const handleMouseMove = (e: React.MouseEvent) => {
    setMousePos({ x: e.clientX + 15, y: e.clientY + 15 });
  };

  const handleNodeClickWithGameLogic = useCallback((_: React.MouseEvent, node: Node<ExtendedNodeData>) => {
    const cfgNode = cfg.nodes.find(n => n.id === node.id);
    
    if (!visitedNodes.has(node.id)) {
      setVisitedNodes(prev => new Set([...prev, node.id]));
    }
    
    if (cfgNode?.line != null && onNodeClick) {
      onNodeClick(cfgNode.line);
    }
  }, [cfg.nodes, visitedNodes, onNodeClick]);

  useEffect(() => {
    const initialNodes: Node<ExtendedNodeData>[] = cfg.nodes.map((node) => {
      const hasViolation = safetyChecks.some(
        check => check.line === node.line && check.status === 'UNSAFE'
      );

      let nodeType = 'process';
      const label = String(node.label || '').toLowerCase();
      
      if (label === 'start' || label === 'end') {
        nodeType = 'terminator';
      } else if (node.type === 'decision') {
        nodeType = 'decision';
      } else if (label.includes('input') || label.includes('output') || 
                 label.includes('cin') || label.includes('cout')) {
        nodeType = 'io';
      }

      return {
        id: node.id,
        type: nodeType,
        data: { 
          ...node,
          violation: hasViolation,
          visited: visitedNodes.has(node.id),
          onHover: setHoverInfo
        },
        position: { x: 0, y: 0 },
        draggable: true,
      };
    });

    const initialEdges: Edge[] = cfg.edges.map((edge, i) => {
      const targetNode = cfg.nodes.find(n => n.id === edge.to);
      const hasViolation = targetNode && safetyChecks.some(
        check => check.line === targetNode.line && check.status === 'UNSAFE'
      );
      const isVisited = visitedNodes.has(edge.from) && visitedNodes.has(edge.to);

      return {
        id: `e-${i}`,
        source: edge.from,
        target: edge.to,
        label: edge.label,
        type: 'default',
        animated: hasViolation || isVisited,
        style: { 
          stroke: hasViolation ? '#ff4444' : isVisited ? '#4caf50' : '#64b5f6',
          strokeWidth: hasViolation ? 3 : isVisited ? 2.5 : 2,
        },
        markerEnd: { 
          type: MarkerType.ArrowClosed, 
          color: hasViolation ? '#ff4444' : isVisited ? '#4caf50' : '#64b5f6',
          width: 20,
          height: 20
        },
        labelStyle: {
          fill: '#ffffff',
          fontSize: '11px',
          fontWeight: '600',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        },
        labelBgStyle: {
          fill: '#0d1117',
          fillOpacity: 0.9,
          rx: 4,
          ry: 4,
        },
        labelBgPadding: [5, 8] as [number, number],
      };
    });

    const elkGraph = {
      id: "root",
      layoutOptions: {
        'elk.algorithm': 'layered',
        'elk.direction': 'DOWN',
        'elk.spacing.nodeNode': '90',
        'elk.layered.spacing.nodeNodeBetweenLayers': '120',
        'elk.layered.nodePlacement.strategy': 'SIMPLE',
        'elk.edgeRouting': 'ORTHOGONAL',
      },
      children: initialNodes.map(n => {
        let width = 180, height = 90;
        if (n.type === 'decision') {
          width = height = 120;
        } else if (n.type === 'terminator') {
          width = 140;
          height = 60;
        } else if (n.type === 'io') {
          width = 190;
          height = 85;
        }
        return { id: n.id, width, height };
      }),
      edges: initialEdges.map(e => ({ 
        id: e.id, 
        sources: [e.source], 
        targets: [e.target] 
      })),
    };

    elk.layout(elkGraph).then((layout) => {
      const layoutedNodes = initialNodes.map(n => {
        const pos = layout.children?.find(c => c.id === n.id);
        return { 
          ...n, 
          position: { 
            x: pos?.x ?? 0, 
            y: pos?.y ?? 0 
          } 
        };
      });
      
      setNodes(layoutedNodes);
      setEdges(initialEdges);
    }).catch(err => {
      console.error('ELK layout error:', err);
      setNodes(initialNodes.map((n, i) => ({
        ...n,
        position: { x: 200, y: i * 150 }
      })));
      setEdges(initialEdges);
    });
  }, [cfg, safetyChecks, visitedNodes]);

  const safeNodes = cfg.nodes.filter(n => !safetyChecks.some(c => c.line === n.line && c.status === 'UNSAFE')).length;
  const totalNodes = cfg.nodes.length;

  return (
    <div 
      onMouseMove={handleMouseMove}
      style={{ 
        width: '100%', 
        height: '100%', 
        position: 'relative',
        background: '#0d1117'
      }}
    >
      <FlowchartLegend isDrawerOpen={isDrawerOpen} />
      <GameStats visitedNodes={visitedNodes} totalNodes={totalNodes} safeNodes={safeNodes} isDrawerOpen={isDrawerOpen} />

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={(changes) => {
          setNodes((nds) => applyNodeChanges(changes, nds));
        }}
        onNodeClick={handleNodeClickWithGameLogic}
        fitView
        fitViewOptions={{
          padding: 0.25,
          includeHiddenNodes: true,
          minZoom: 0.1,
          maxZoom: 1.0,
          duration: 800
        }}
        colorMode="dark"
        nodesDraggable={isInteractive}
        nodesConnectable={false}
        nodesFocusable={isInteractive}
        edgesFocusable={false}
        panOnDrag={isInteractive}
        panOnScroll={false}
        selectionOnDrag={isInteractive}
        selectionKeyCode={null}
        multiSelectionKeyCode="Shift"
        deleteKeyCode={null}
        zoomOnScroll={isInteractive}
        zoomOnPinch={isInteractive}
        zoomOnDoubleClick={isInteractive}
        minZoom={0.05}
        maxZoom={2}
        defaultEdgeOptions={{
          type: 'default',
        }}
      >
        <Background 
          color="#1f2937" 
          gap={16} 
          size={1}
          style={{ opacity: 0.4 }}
        />
        <Controls 
          showInteractive={true} 
          onInteractiveChange={(interactive) => setIsInteractive(interactive)}
          position="bottom-right"
          style={{
            background: 'rgba(13, 17, 23, 0.9)',
            border: '1px solid #30363d',
            borderRadius: '8px'
          }}
        />
      </ReactFlow>

      {hoverInfo && (
        <div 
          style={{ 
            position: 'fixed', 
            top: mousePos.y, 
            left: mousePos.x,
            pointerEvents: 'none',
            zIndex: 9999,
            background: 'linear-gradient(135deg, #1e1e1e 0%, #2d2d2d 100%)',
            border: '2px solid #ffa726',
            borderRadius: '8px',
            padding: '12px',
            maxWidth: '300px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.6), 0 0 20px rgba(255, 167, 38, 0.3)',
            animation: 'fadeIn 0.2s ease-in-out'
          }}
        >
          <div style={{ 
            color: '#ffa726', 
            fontWeight: 'bold', 
            fontSize: '10px', 
            textTransform: 'uppercase', 
            marginBottom: '6px', 
            borderBottom: '1px solid #444', 
            paddingBottom: '4px' 
          }}>
            💡 Mentor Tip
          </div>
          <div style={{ color: '#e0e0e0', fontSize: '12px', lineHeight: '1.5' }}>
            {hoverInfo}
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(5px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .decision-node:hover {
          transform: rotate(45deg) scale(1.08);
          box-shadow: 0 8px 30px rgba(255, 167, 38, 0.5), inset 0 0 35px rgba(255, 167, 38, 0.2);
        }
        
        .process-node:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 25px rgba(76, 175, 80, 0.4), inset 0 0 30px rgba(76, 175, 80, 0.15);
        }
        
        .terminator-node:hover {
          transform: scale(1.05);
          box-shadow: 0 6px 25px rgba(66, 165, 245, 0.5), inset 0 0 35px rgba(66, 165, 245, 0.2);
        }
        
        .io-node:hover {
          transform: scale(1.05);
          box-shadow: 0 8px 30px rgba(100, 181, 246, 0.5), inset 0 0 30px rgba(100, 181, 246, 0.15);
        }
        
        .react-flow__node {
          cursor: grab !important;
        }
        
        .react-flow__node.dragging {
          cursor: grabbing !important;
        }
        
        .react-flow__edge-path {
          stroke-linecap: round;
          stroke-linejoin: round;
        }
      `}</style>
    </div>
  );
};