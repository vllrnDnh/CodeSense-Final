import React, { useState, useEffect } from 'react';
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

// Extended type for node data with all properties
interface ExtendedNodeData extends ControlFlowNode {
  violation?: boolean;
  // Hooks for the mentor tooltip
  onHover?: (msg: string | null) => void;
}

const elk = new ELK();

// Decision Node (Diamond shape for conditionals)
const DecisionNode = ({ data }: NodeProps<Node<ExtendedNodeData>>) => {
  const isViolation = data.violation ?? false;
  
  return (
    <div 
      className="decision-node"
      onMouseEnter={() => data.onHover?.(data.tutorExplanation || null)}
      onMouseLeave={() => data.onHover?.(null)}
      style={{
        width: '100px',
        height: '100px',
        background: isViolation 
          ? 'linear-gradient(135deg, #1a0a0a 0%, #2d1515 100%)' 
          : 'linear-gradient(135deg, #1a1a2e 0%, #2d2d44 100%)',
        border: `3px solid ${isViolation ? '#ff4444' : '#ffa726'}`,
        transform: 'rotate(45deg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        cursor: 'pointer',
        boxShadow: isViolation 
          ? '0 4px 20px rgba(255, 68, 68, 0.3), inset 0 0 20px rgba(255, 68, 68, 0.1)' 
          : '0 4px 15px rgba(255, 167, 38, 0.2), inset 0 0 20px rgba(255, 167, 38, 0.05)',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      <Handle 
        type="target" 
        position={Position.Top} 
        style={{ 
          background: isViolation ? '#ff4444' : '#64b5f6',
          width: '10px',
          height: '10px',
          border: '2px solid #0d1117'
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
          maxWidth: '60px',
          lineHeight: '1.2',
          textShadow: '0 1px 3px rgba(0,0,0,0.5)'
        }}
      >
        {String(data.label ?? '')}
      </div>
      <Handle 
        type="source" 
        position={Position.Bottom} 
        style={{ 
          background: isViolation ? '#ff4444' : '#64b5f6',
          width: '10px',
          height: '10px',
          border: '2px solid #0d1117'
        }} 
      />
    </div>
  );
};

// Process Node (Rectangle for statements)
const ProcessNode = ({ data }: NodeProps<Node<ExtendedNodeData>>) => {
  const isTerminator = data.label === 'Start' || data.label === 'End';
  const isViolation = data.violation ?? false;
  
  return (
    <div 
      className="process-node"
      onMouseEnter={() => data.onHover?.(data.tutorExplanation || null)}
      onMouseLeave={() => data.onHover?.(null)}
      style={{
        padding: isTerminator ? '12px 24px' : '14px 16px',
        minWidth: isTerminator ? '100px' : '140px',
        maxWidth: '180px',
        textAlign: 'center',
        color: 'white',
        background: isTerminator 
          ? 'linear-gradient(135deg, #0d47a1 0%, #1976d2 100%)'
          : isViolation 
            ? 'linear-gradient(135deg, #1a0a0a 0%, #2d1515 100%)'
            : 'linear-gradient(135deg, #1e1e1e 0%, #2d2d2d 100%)',
        border: `3px solid ${isViolation ? '#ff4444' : isTerminator ? '#42a5f5' : '#4caf50'}`,
        borderRadius: isTerminator ? '50px' : '8px',
        fontSize: '11px',
        fontWeight: '500',
        position: 'relative',
        cursor: 'pointer',
        boxShadow: isViolation 
          ? '0 4px 20px rgba(255, 68, 68, 0.3), inset 0 0 20px rgba(255, 68, 68, 0.1)'
          : isTerminator
            ? '0 4px 15px rgba(66, 165, 245, 0.3), inset 0 0 20px rgba(66, 165, 245, 0.1)'
            : '0 4px 12px rgba(76, 175, 80, 0.2), inset 0 0 15px rgba(76, 175, 80, 0.05)',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      <Handle 
        type="target" 
        position={Position.Top} 
        style={{ 
          background: isViolation ? '#ff4444' : '#64b5f6',
          width: '10px',
          height: '10px',
          border: '2px solid #0d1117'
        }} 
      />
      <div style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <strong 
          style={{ 
            display: 'block',
            fontSize: isTerminator ? '13px' : '12px',
            marginBottom: data.code && !isTerminator ? '6px' : '0',
            letterSpacing: '0.3px',
            textShadow: '0 1px 2px rgba(0,0,0,0.5)'
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
              background: 'rgba(0,0,0,0.3)',
              padding: '4px 6px',
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
          background: isViolation ? '#ff4444' : '#64b5f6',
          width: '10px',
          height: '10px',
          border: '2px solid #0d1117'
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

  // Mentor Tooltip State
  const [hoverInfo, setHoverInfo] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent) => {
    // Offset the tooltip slightly from the cursor
    setMousePos({ x: e.clientX + 15, y: e.clientY + 15 });
  };

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
          onHover: setHoverInfo // Pass the state setter to the node component
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

      return {
        id: `e-${i}`,
        source: edge.from,
        target: edge.to,
        label: edge.label,
        animated: hasViolation,
        style: { 
          stroke: hasViolation ? '#ff4444' : '#64b5f6',
          strokeWidth: hasViolation ? 3 : 2.5,
        },
        markerEnd: { 
          type: MarkerType.ArrowClosed, 
          color: hasViolation ? '#ff4444' : '#64b5f6',
          width: 20,
          height: 20
        },
        labelStyle: {
          fill: '#fff',
          fontSize: '11px',
          fontWeight: '500',
          background: 'rgba(13, 17, 23, 0.8)',
          padding: '4px 8px',
          borderRadius: '4px'
        },
        labelBgStyle: {
          fill: 'rgba(13, 17, 23, 0.9)',
          fillOpacity: 0.9
        }
      };
    });

    const elkGraph = {
      id: "root",
      layoutOptions: {
        'elk.algorithm': 'layered',
        'elk.direction': 'DOWN',
        'elk.spacing.nodeNode': '80',
        'elk.layered.spacing.nodeNodeBetweenLayers': '100',
        'elk.layered.nodePlacement.strategy': 'SIMPLE',
      },
      children: initialNodes.map(n => ({ 
        id: n.id, 
        width: n.type === 'decision' ? 100 : 160, 
        height: n.type === 'decision' ? 100 : 80 
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
  }, [cfg, safetyChecks]);

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
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={(changes) => {
          setNodes((nds) => applyNodeChanges(changes, nds));
        }}
        onNodeClick={(_, node) => {
          const cfgNode = cfg.nodes.find(n => n.id === node.id);
          if (cfgNode?.line != null && onNodeClick) {
            onNodeClick(cfgNode.line);
          }
        }}
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

      {/* Floating Mentor Tooltip */}
      {hoverInfo && (
        <div 
          className="mentor-tooltip"
          style={{ 
            position: 'fixed', 
            top: mousePos.y, 
            left: mousePos.x,
            pointerEvents: 'none',
            zIndex: 9999,
            background: '#1e1e1e',
            border: '1px solid #ffa726',
            borderRadius: '6px',
            padding: '12px',
            maxWidth: '250px',
            boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
            animation: 'fadeIn 0.2s ease-in-out'
          }}
        >
          <div style={{ color: '#ffa726', fontWeight: 'bold', fontSize: '11px', textTransform: 'uppercase', marginBottom: '6px', borderBottom: '1px solid #333', paddingBottom: '4px' }}>
            💡 Mentor Tip
          </div>
          <div style={{ color: '#e0e0e0', fontSize: '13px', lineHeight: '1.4' }}>
            {hoverInfo}
          </div>
        </div>
      )}

      <style>{`
        .decision-node:hover {
          transform: rotate(45deg) scale(1.05);
          box-shadow: 0 6px 25px rgba(255, 167, 38, 0.4), inset 0 0 30px rgba(255, 167, 38, 0.15);
        }
        
        .process-node:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(76, 175, 80, 0.3), inset 0 0 25px rgba(76, 175, 80, 0.1);
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