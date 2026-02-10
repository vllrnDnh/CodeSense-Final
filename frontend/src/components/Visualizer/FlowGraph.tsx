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
}

interface ExtendedNodeData extends ControlFlowNode {
  violation?: boolean;
  visited?: boolean;
  onHover?: (msg: string | null) => void;
}

const elk = new ELK();

// Decision Node with game elements
const DecisionNode = ({ data, selected }: NodeProps<Node<ExtendedNodeData>>) => {
  const isViolation = data.violation ?? false;
  const isVisited = data.visited ?? false;
  
  return (
    <div 
      className="decision-node"
      onMouseEnter={() => data.onHover?.(data.tutorExplanation || null)}
      onMouseLeave={() => data.onHover?.(null)}
      style={{
        width: '110px',
        height: '110px',
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
          ? '0 4px 20px rgba(255, 68, 68, 0.4), inset 0 0 20px rgba(255, 68, 68, 0.15), 0 0 40px rgba(255, 68, 68, 0.2)' 
          : isVisited
            ? '0 4px 20px rgba(76, 175, 80, 0.4), inset 0 0 20px rgba(76, 175, 80, 0.15), 0 0 30px rgba(76, 175, 80, 0.2)'
            : '0 4px 15px rgba(255, 167, 38, 0.3), inset 0 0 20px rgba(255, 167, 38, 0.08)',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        animation: selected ? 'pulse 1.5s ease-in-out infinite' : 'none',
      }}
    >
      
      {/* Danger indicator */}
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
          background: isViolation ? '#ff4444' : isVisited ? '#4caf50' : '#64b5f6',
          width: '12px',
          height: '12px',
          border: '2px solid #0d1117',
          boxShadow: `0 0 10px ${isViolation ? '#ff4444' : isVisited ? '#4caf50' : '#64b5f6'}`
        }} 
      />
      <div 
        style={{ 
          transform: 'rotate(-45deg)', 
          color: 'white', 
          fontSize: '12px', 
          fontWeight: '600',
          textAlign: 'center', 
          pointerEvents: 'none',
          maxWidth: '70px',
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

// Process Node with game elements
const ProcessNode = ({ data, selected }: NodeProps<Node<ExtendedNodeData>>) => {
  const isTerminator = data.label === 'Start' || data.label === 'End';
  const isViolation = data.violation ?? false;
  const isVisited = data.visited ?? false;
  
  return (
    <div 
      className="process-node"
      onMouseEnter={() => data.onHover?.(data.tutorExplanation || null)}
      onMouseLeave={() => data.onHover?.(null)}
      style={{
        padding: isTerminator ? '12px 24px' : '14px 16px',
        minWidth: isTerminator ? '100px' : '150px',
        maxWidth: '190px',
        textAlign: 'center',
        color: 'white',
        background: isTerminator 
          ? 'linear-gradient(135deg, #0d47a1 0%, #1976d2 100%)'
          : isViolation 
            ? 'linear-gradient(135deg, #2d0a0a 0%, #4a1515 100%)'
            : isVisited
              ? 'linear-gradient(135deg, #1a2e1a 0%, #2d4a2d 100%)'
              : 'linear-gradient(135deg, #1e1e1e 0%, #2d2d2d 100%)',
        border: `3px solid ${isViolation ? '#ff4444' : isTerminator ? '#42a5f5' : isVisited ? '#4caf50' : '#4caf50'}`,
        borderRadius: isTerminator ? '50px' : '8px',
        fontSize: '11px',
        fontWeight: '500',
        position: 'relative',
        cursor: 'pointer',
        boxShadow: isViolation 
          ? '0 4px 20px rgba(255, 68, 68, 0.4), inset 0 0 20px rgba(255, 68, 68, 0.15), 0 0 40px rgba(255, 68, 68, 0.2)'
          : isTerminator
            ? '0 4px 15px rgba(66, 165, 245, 0.4), inset 0 0 20px rgba(66, 165, 245, 0.15), 0 0 30px rgba(66, 165, 245, 0.2)'
            : isVisited
              ? '0 4px 15px rgba(76, 175, 80, 0.3), inset 0 0 20px rgba(76, 175, 80, 0.1)'
              : '0 4px 12px rgba(76, 175, 80, 0.2), inset 0 0 15px rgba(76, 175, 80, 0.05)',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        animation: selected ? 'pulse 1.5s ease-in-out infinite' : 'none',
      }}
    >
      
      {/* Danger indicator */}
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
            fontSize: isTerminator ? '13px' : '12px',
            marginBottom: data.code && !isTerminator ? '6px' : '0',
            letterSpacing: '0.3px',
            textShadow: '0 2px 3px rgba(0,0,0,0.6)'
          }}
        >
          {String(data.label ?? 'Process')}
        </strong>
        {data.code && !isTerminator && (
          <code 
            style={{ 
              display: 'block', 
              fontSize: '9px', 
              opacity: 0.85,
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
  decision: DecisionNode, 
  process: ProcessNode 
};

export const FlowGraph: React.FC<Props> = ({ cfg, safetyChecks, onNodeClick }) => {
  const [nodes, setNodes] = useState<Node<ExtendedNodeData>[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [isInteractive, setIsInteractive] = useState(true);
  const [hoverInfo, setHoverInfo] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  
  // Game state
  const [visitedNodes, setVisitedNodes] = useState<Set<string>>(new Set());

  const handleMouseMove = (e: React.MouseEvent) => {
    setMousePos({ x: e.clientX + 15, y: e.clientY + 15 });
  };


  const handleNodeClickWithGameLogic = useCallback((_: React.MouseEvent, node: Node<ExtendedNodeData>) => {
    const cfgNode = cfg.nodes.find(n => n.id === node.id);
    
    // Mark as visited
    if (!visitedNodes.has(node.id)) {
      setVisitedNodes(prev => new Set([...prev, node.id]));
    }
    
    // Original click handler
    if (cfgNode?.line != null && onNodeClick) {
      onNodeClick(cfgNode.line);
    }
  }, [cfg.nodes, visitedNodes, onNodeClick]);


  useEffect(() => {
    const initialNodes: Node<ExtendedNodeData>[] = cfg.nodes.map((node) => {
      const hasViolation = safetyChecks.some(
        check => check.line === node.line && check.status === 'UNSAFE'
      );

      return {
        id: node.id,
        type: node.type === 'decision' ? 'decision' : 'process',
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
          fontSize: '12px',
          fontWeight: '600',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        },
        labelBgStyle: {
          fill: '#0d1117',
          fillOpacity: 0.85,
          rx: 4,
          ry: 4,
        },
        labelBgPadding: [6, 10] as [number, number],
      };
    });

    const elkGraph = {
      id: "root",
      layoutOptions: {
        'elk.algorithm': 'layered',
        'elk.direction': 'DOWN',
        'elk.spacing.nodeNode': '85',
        'elk.layered.spacing.nodeNodeBetweenLayers': '110',
        'elk.layered.nodePlacement.strategy': 'SIMPLE',
      },
      children: initialNodes.map(n => ({ 
        id: n.id, 
        width: n.type === 'decision' ? 110 : 170, 
        height: n.type === 'decision' ? 110 : 85 
      })),
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
      const fallbackNodes = initialNodes.map((n, i) => ({
        ...n,
        position: { x: 200, y: i * 150 }
      }));
      setNodes(fallbackNodes);
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
      {/* Game HUD */}
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        {/* Exploration Progress */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(13, 17, 23, 0.95) 0%, rgba(22, 27, 34, 0.95) 100%)',
          border: '2px solid #4caf50',
          borderRadius: '12px',
          padding: '14px 18px',
          minWidth: '220px',
          boxShadow: '0 4px 20px rgba(76, 175, 80, 0.3)'
        }}>
          <div style={{ 
            fontSize: '11px', 
            color: '#4caf50', 
            fontWeight: 'bold', 
            marginBottom: '8px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            📍 Exploration
          </div>
          <div style={{ fontSize: '16px', color: 'white', fontWeight: '600', marginBottom: '10px' }}>
            {visitedNodes.size} / {totalNodes} nodes
          </div>
          <div style={{
            width: '100%',
            height: '8px',
            background: 'rgba(76, 175, 80, 0.15)',
            borderRadius: '4px',
            overflow: 'hidden',
            border: '1px solid rgba(76, 175, 80, 0.3)'
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
              fontSize: '11px', 
              color: '#4caf50', 
              marginTop: '8px',
              fontWeight: '600'
            }}>
              ✓ All nodes explored!
            </div>
          )}
        </div>

        {/* Safety Score */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(13, 17, 23, 0.95) 0%, rgba(22, 27, 34, 0.95) 100%)',
          border: `2px solid ${safeNodes === totalNodes ? '#4caf50' : '#ff4444'}`,
          borderRadius: '12px',
          padding: '14px 18px',
          minWidth: '220px',
          boxShadow: `0 4px 20px ${safeNodes === totalNodes ? 'rgba(76, 175, 80, 0.3)' : 'rgba(255, 68, 68, 0.3)'}`
        }}>
          <div style={{ 
            fontSize: '11px', 
            color: safeNodes === totalNodes ? '#4caf50' : '#ff4444', 
            fontWeight: 'bold', 
            marginBottom: '8px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            🛡️ Safety Score
          </div>
          <div style={{ 
            fontSize: '20px', 
            color: 'white', 
            fontWeight: 'bold',
            marginBottom: '6px'
          }}>
            {safeNodes} / {totalNodes}
          </div>
          {safeNodes === totalNodes ? (
            <div style={{ fontSize: '11px', color: '#4caf50', fontWeight: '600' }}>
              ✓ All systems safe
            </div>
          ) : (
            <div style={{ fontSize: '11px', color: '#ff4444', fontWeight: '600' }}>
              ⚠ {totalNodes - safeNodes} violation{totalNodes - safeNodes > 1 ? 's' : ''} detected
            </div>
          )}
        </div>
      </div>

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
          type: 'smoothstep',
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

      {/* Mentor Tooltip */}
      {hoverInfo && (
        <div 
          className="mentor-tooltip"
          style={{ 
            position: 'fixed', 
            top: mousePos.y, 
            left: mousePos.x,
            pointerEvents: 'none',
            zIndex: 9999,
            background: 'linear-gradient(135deg, #1e1e1e 0%, #2d2d2d 100%)',
            border: '2px solid #ffa726',
            borderRadius: '8px',
            padding: '14px',
            maxWidth: '280px',
            boxShadow: '0 6px 20px rgba(0,0,0,0.6), 0 0 20px rgba(255, 167, 38, 0.3)',
            animation: 'fadeIn 0.2s ease-in-out'
          }}
        >
          <div style={{ color: '#ffa726', fontWeight: 'bold', fontSize: '11px', textTransform: 'uppercase', marginBottom: '8px', borderBottom: '1px solid #444', paddingBottom: '6px' }}>
            💡 Mentor Tip
          </div>
          <div style={{ color: '#e0e0e0', fontSize: '13px', lineHeight: '1.5' }}>
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
        
        .decision-node:hover {
          transform: rotate(45deg) scale(1.08);
          box-shadow: 0 8px 30px rgba(255, 167, 38, 0.5), inset 0 0 35px rgba(255, 167, 38, 0.2);
        }
        
        .process-node:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 25px rgba(76, 175, 80, 0.4), inset 0 0 30px rgba(76, 175, 80, 0.15);
        }
        
        .react-flow__node-decision.selected .decision-node,
        .react-flow__node-process.selected .process-node {
          border-width: 4px;
        }
        
        .react-flow__edge-path {
          transition: stroke 0.3s ease;
        }
        
        .react-flow__edge:hover .react-flow__edge-path {
          stroke-width: 4px;
        }
        
        .react-flow__node {
          cursor: grab !important;
        }
        
        .react-flow__node.dragging {
          cursor: grabbing !important;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(5px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};