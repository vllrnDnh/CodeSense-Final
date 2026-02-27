import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ReactFlow, Background, Controls, MarkerType,
  Handle, Position, applyNodeChanges, applyEdgeChanges, addEdge
} from '@xyflow/react';
import type { Connection, Edge, Node, NodeProps } from '@xyflow/react';
import ELK from 'elkjs/lib/elk.bundled.js';
import '@xyflow/react/dist/style.css';
import type { CFG, SafetyCheck, ControlFlowNode } from '../../types';
import { generateCppFromGraph } from '../../services/CodeGenerator';

interface ExtendedNodeData extends ControlFlowNode {
  violation?: boolean;
  visited?: boolean;
  onHover?: (msg: string | null) => void;
  onEdit?: (id: string) => void;
}

interface Props {
  cfg?: CFG;
  safetyChecks?: SafetyCheck[];
  onNodeClick?: (line: number) => void;
  isDrawerOpen?: boolean;
  onGraphChange?: (nodes: Node<ExtendedNodeData>[], edges: Edge[]) => void;
  onCodeGenerated?: (code: string) => void;
}

interface EditState { nodeId: string; label: string; code: string; type: string; }
interface EdgeEditState { edgeId: string; label: string; x: number; y: number; }

type FlowNodeType =
  | 'terminator' | 'process' | 'decision' | 'io'
  | 'predefined' | 'connector' | 'document'
  | 'manual_input' | 'delay' | 'database';

const elk = new ELK();
let _nodeIdCounter = 1000;
const newNodeId = () => `user-node-${++_nodeIdCounter}`;

const NODE_COLORS: Record<FlowNodeType, string> = {
  terminator: '#42a5f5', process: '#4caf50', decision: '#ffa726', io: '#64b5f6',
  predefined: '#ab47bc', connector: '#26c6da', document: '#ef5350',
  manual_input: '#ff7043', delay: '#78909c', database: '#66bb6a',
};

const defaultLabels: Record<FlowNodeType, string> = {
  terminator: 'Start', process: 'Process', decision: 'Condition', io: 'Output',
  predefined: 'Function Call', connector: 'A', document: 'Document',
  manual_input: 'Input', delay: 'Delay', database: 'Data Store',
};

const NODE_SIZES: Record<FlowNodeType, { width: number; height: number }> = {
  terminator: { width: 160, height: 50 },
  process:    { width: 180, height: 90 },
  decision:   { width: 140, height: 140 },
  io:         { width: 185, height: 70 },
  predefined: { width: 180, height: 90 },
  connector:  { width: 60,  height: 60 },
  document:   { width: 185, height: 90 },
  manual_input:{ width: 185, height: 75 },
  delay:      { width: 185, height: 70 },
  database:   { width: 175, height: 95 },
};

// ─── Shared handle style ──────────────────────────────────────────────────────
const hStyle = (c: string): React.CSSProperties => ({
  background: c, width: '11px', height: '11px',
  border: '2px solid #0d1117', boxShadow: `0 0 8px ${c}`,
});

// ─── Node label renderer ──────────────────────────────────────────────────────
const NodeLabel: React.FC<{ data: ExtendedNodeData }> = ({ data }) => (
  <div style={{ pointerEvents: 'none', userSelect: 'none', textAlign: 'center' }}>
    <strong style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'white', letterSpacing: '0.3px', textShadow: '0 2px 3px rgba(0,0,0,0.6)' }}>
      {String(data.label ?? '')}
    </strong>
    {data.code && (
      <code style={{ display: 'block', fontSize: '10px', marginTop: '5px', fontFamily: "'JetBrains Mono','Fira Code',monospace", background: 'rgba(0,0,0,0.4)', padding: '4px 6px', borderRadius: '4px', color: 'rgba(255,255,255,0.9)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: '1.4' }}>
        {String(data.code)}
      </code>
    )}
  </div>
);

const EditHintOverlay = () => (
  <div className="edit-hint" style={{ position: 'absolute', top: '-22px', left: '50%', transform: 'translateX(-50%)', fontSize: '9px', color: '#8b949e', whiteSpace: 'nowrap', background: 'rgba(13,17,23,0.92)', border: '1px solid #30363d', borderRadius: '4px', padding: '2px 7px', pointerEvents: 'none', opacity: 0, transition: 'opacity 0.2s', zIndex: 10 }}>
    ✏️ double-click to edit
  </div>
);

const VBadge = () => (
  <div style={{ position: 'absolute', top: '-16px', left: '50%', transform: 'translateX(-50%)', fontSize: '16px', animation: 'bounce 1s ease-in-out infinite', zIndex: 10 }}>⚠️</div>
);

// ─── 1. TERMINATOR — stadium / rounded pill (ISO 5807) ───────────────────────
const TerminatorNode = ({ data, selected }: NodeProps<Node<ExtendedNodeData>>) => {
  const c = data.violation ? '#ff4444' : data.visited ? '#4caf50' : NODE_COLORS.terminator;
  const bg = data.violation
    ? 'linear-gradient(135deg,#2d0a0a,#4a1515)'
    : data.visited
    ? 'linear-gradient(135deg,#0a2d0a,#154a15)'
    : 'linear-gradient(135deg,#0d47a1,#1565c0)';
  return (
    <div
      className="flow-node editable-node"
      onMouseEnter={() => data.onHover?.(data.tutorExplanation ?? null)}
      onMouseLeave={() => data.onHover?.(null)}
      onDoubleClick={() => data.onEdit?.(String(data.id ?? ''))}
      style={{
        width: '160px', height: '50px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: bg, border: `2.5px solid ${c}`,
        borderRadius: '999px',           /* true stadium shape */
        position: 'relative', cursor: 'pointer',
        boxShadow: `0 4px 20px ${c}55`,
        animation: selected ? 'nodePulse 1.5s ease-in-out infinite' : 'none',
        transition: 'all 0.25s ease',
      }}>
      <EditHintOverlay />
      {data.violation && <VBadge />}
      <Handle type="target" position={Position.Top}    style={{ ...hStyle(c), top: '-6px' }} />
      <span style={{ pointerEvents: 'none', userSelect: 'none', fontSize: '12px', fontWeight: '700', color: 'white', letterSpacing: '0.5px', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
        {String(data.label ?? '')}
      </span>
      <Handle type="source" position={Position.Bottom} style={{ ...hStyle(c), bottom: '-6px' }} />
    </div>
  );
};

// ─── 2. PROCESS — plain rectangle (ISO 5807) ─────────────────────────────────
const ProcessNode = ({ data, selected }: NodeProps<Node<ExtendedNodeData>>) => {
  const c = data.violation ? '#ff4444' : NODE_COLORS.process;
  const bg = data.violation
    ? 'linear-gradient(135deg,#2d0a0a,#4a1515)'
    : data.visited
    ? 'linear-gradient(135deg,#1a2e1a,#2d4a2d)'
    : 'linear-gradient(135deg,#141a14,#1e271e)';
  return (
    <div
      className="flow-node editable-node"
      onMouseEnter={() => data.onHover?.(data.tutorExplanation ?? null)}
      onMouseLeave={() => data.onHover?.(null)}
      onDoubleClick={() => data.onEdit?.(String(data.id ?? ''))}
      style={{
        padding: '14px 16px', minWidth: '160px', maxWidth: '210px',
        background: bg, border: `2.5px solid ${c}`, borderRadius: '4px',
        position: 'relative', cursor: 'pointer',
        boxShadow: `0 3px 14px ${c}33`,
        animation: selected ? 'nodePulse 1.5s ease-in-out infinite' : 'none',
        transition: 'all 0.25s ease',
      }}>
      <EditHintOverlay />
      {data.violation && <VBadge />}
      <Handle type="target" position={Position.Top}    style={hStyle(c)} />
      <NodeLabel data={data} />
      <Handle type="source" position={Position.Bottom} style={hStyle(c)} />
    </div>
  );
};

// ─── 3. DECISION — true diamond via SVG (ISO 5807) ───────────────────────────
// Using SVG so handles can be placed precisely at cardinal points.
const DecisionNode = ({ data, selected }: NodeProps<Node<ExtendedNodeData>>) => {
  const W = 140, H = 140;
  const c = data.violation ? '#ff4444' : data.visited ? '#4caf50' : NODE_COLORS.decision;
  const fill = data.violation ? '#2d0a0a' : data.visited ? '#0d2010' : '#1a1608';
  // Diamond points: top-center, right-center, bottom-center, left-center
  const pts = `${W/2},4 ${W-4},${H/2} ${W/2},${H-4} 4,${H/2}`;
  return (
    <div
      className="flow-node editable-node"
      onMouseEnter={() => data.onHover?.(data.tutorExplanation ?? null)}
      onMouseLeave={() => data.onHover?.(null)}
      onDoubleClick={() => data.onEdit?.(String(data.id ?? ''))}
      style={{ width: `${W}px`, height: `${H}px`, position: 'relative', cursor: 'pointer', animation: selected ? 'nodePulse 1.5s ease-in-out infinite' : 'none' }}>
      <EditHintOverlay />
      {data.violation && <VBadge />}
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', top: 0, left: 0, filter: `drop-shadow(0 4px 14px ${c}44)` }}>
        <polygon points={pts} fill={fill} stroke={c} strokeWidth={selected ? '3' : '2.5'} strokeLinejoin="round" />
      </svg>
      {/* Handles at exact diamond cardinal points */}
      <Handle type="target" position={Position.Top}   style={{ ...hStyle(c), top: '0px',           left: '50%', transform: 'translateX(-50%)' }} />
      <Handle type="source" position={Position.Bottom} style={{ ...hStyle(c), bottom: '0px',         left: '50%', transform: 'translateX(-50%)' }} />
      <Handle type="source" id="right" position={Position.Right} style={{ ...hStyle(c), right: '0px',  top: '50%',  transform: 'translateY(-50%)' }} />
      <Handle type="source" id="left"  position={Position.Left}  style={{ ...hStyle(c), left: '0px',   top: '50%',  transform: 'translateY(-50%)' }} />
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        pointerEvents: 'none',
      }}>
        <span style={{ fontSize: '11px', fontWeight: '700', color: 'white', textAlign: 'center', maxWidth: '80px', lineHeight: '1.3', textShadow: '0 2px 4px rgba(0,0,0,0.7)' }}>
          {String(data.label ?? 'Condition')}
        </span>
      </div>
    </div>
  );
};

// ─── 4. I/O — parallelogram (ISO 5807: Data) ─────────────────────────────────
// Correct parallelogram: left edge offset to the right at top, left at bottom
const IONode = ({ data, selected }: NodeProps<Node<ExtendedNodeData>>) => {
  const W = 180, H = 65;
  const SKEW = 20; // horizontal offset for the slant
  const c = data.violation ? '#ff4444' : data.visited ? '#4caf50' : NODE_COLORS.io;
  const fill = data.violation ? '#2d0a0a' : data.visited ? '#0d2010' : '#081c33';
  // Parallelogram: top-left skewed right, top-right at W, bottom-right skewed left, bottom-left at 0
  const pts = `${SKEW},2 ${W-2},2 ${W-SKEW-2},${H-2} 2,${H-2}`;
  return (
    <div
      className="flow-node editable-node"
      onMouseEnter={() => data.onHover?.(data.tutorExplanation ?? null)}
      onMouseLeave={() => data.onHover?.(null)}
      onDoubleClick={() => data.onEdit?.(String(data.id ?? ''))}
      style={{ width: `${W}px`, height: `${H}px`, position: 'relative', cursor: 'pointer', animation: selected ? 'nodePulse 1.5s ease-in-out infinite' : 'none' }}>
      <EditHintOverlay />
      {data.violation && <VBadge />}
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', inset: 0, filter: `drop-shadow(0 3px 12px ${c}44)` }}>
        <polygon points={pts} fill={fill} stroke={c} strokeWidth={selected ? '3' : '2'} strokeLinejoin="round" />
      </svg>
      <Handle type="target" position={Position.Top}    style={{ ...hStyle(c), zIndex: 5, left: `${(W - SKEW/2)}px` }} />
      <Handle type="source" position={Position.Bottom} style={{ ...hStyle(c), zIndex: 5, left: `${(W/2 - SKEW/2)}px` }} />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1, paddingLeft: `${SKEW/2}px` }}>
        <NodeLabel data={data} />
      </div>
    </div>
  );
};

// ─── 5. PREDEFINED PROCESS — rectangle + double side bars (ISO 5807) ─────────
const PredefinedNode = ({ data, selected }: NodeProps<Node<ExtendedNodeData>>) => {
  const c = data.violation ? '#ff4444' : NODE_COLORS.predefined;
  const bg = data.violation
    ? 'linear-gradient(135deg,#2d0a0a,#4a1515)'
    : data.visited
    ? 'linear-gradient(135deg,#1a2e1a,#2d4a2d)'
    : 'linear-gradient(135deg,#18091f,#271040)';
  return (
    <div
      className="flow-node editable-node"
      onMouseEnter={() => data.onHover?.(data.tutorExplanation ?? null)}
      onMouseLeave={() => data.onHover?.(null)}
      onDoubleClick={() => data.onEdit?.(String(data.id ?? ''))}
      style={{
        padding: '14px 30px', minWidth: '160px', maxWidth: '210px',
        background: bg, border: `2.5px solid ${c}`, borderRadius: '4px',
        position: 'relative', cursor: 'pointer',
        boxShadow: `0 3px 14px ${c}33`,
        animation: selected ? 'nodePulse 1.5s ease-in-out infinite' : 'none',
        transition: 'all 0.25s ease',
      }}>
      {/* ISO double-bar: two vertical lines near left and right edges */}
      <div style={{ position: 'absolute', left: '10px',  top: '2px', bottom: '2px', width: '2px', background: c, opacity: 0.9, borderRadius: '1px' }} />
      <div style={{ position: 'absolute', left: '16px',  top: '2px', bottom: '2px', width: '2px', background: c, opacity: 0.9, borderRadius: '1px' }} />
      <div style={{ position: 'absolute', right: '10px', top: '2px', bottom: '2px', width: '2px', background: c, opacity: 0.9, borderRadius: '1px' }} />
      <div style={{ position: 'absolute', right: '16px', top: '2px', bottom: '2px', width: '2px', background: c, opacity: 0.9, borderRadius: '1px' }} />
      <EditHintOverlay />
      {data.violation && <VBadge />}
      <Handle type="target" position={Position.Top}    style={hStyle(c)} />
      <NodeLabel data={data} />
      <Handle type="source" position={Position.Bottom} style={hStyle(c)} />
    </div>
  );
};

// ─── 6. CONNECTOR — small circle / on-page ref (ISO 5807) ────────────────────
const ConnectorNode = ({ data, selected }: NodeProps<Node<ExtendedNodeData>>) => {
  const c = data.violation ? '#ff4444' : data.visited ? '#4caf50' : NODE_COLORS.connector;
  const bg = data.violation
    ? 'linear-gradient(135deg,#2d0a0a,#4a1515)'
    : data.visited
    ? 'linear-gradient(135deg,#0a2d0a,#154a15)'
    : 'linear-gradient(135deg,#042a2e,#073540)';
  return (
    <div
      className="flow-node editable-node"
      onMouseEnter={() => data.onHover?.(data.tutorExplanation ?? null)}
      onMouseLeave={() => data.onHover?.(null)}
      onDoubleClick={() => data.onEdit?.(String(data.id ?? ''))}
      style={{
        width: '60px', height: '60px', borderRadius: '50%',
        background: bg, border: `2.5px solid ${c}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative', cursor: 'pointer',
        boxShadow: `0 3px 16px ${c}55`,
        animation: selected ? 'nodePulse 1.5s ease-in-out infinite' : 'none',
        transition: 'all 0.25s ease',
      }}>
      <EditHintOverlay />
      {data.violation && <VBadge />}
      <Handle type="target" position={Position.Top}    style={hStyle(c)} />
      <span style={{ color: 'white', fontSize: '14px', fontWeight: '800', pointerEvents: 'none' }}>
        {String(data.label ?? 'A')}
      </span>
      <Handle type="source" position={Position.Bottom} style={hStyle(c)} />
    </div>
  );
};

// ─── 7. DOCUMENT — rectangle with wavy bottom (ISO 5807) ─────────────────────
const DocumentNode = ({ data, selected }: NodeProps<Node<ExtendedNodeData>>) => {
  const W = 185, H = 90;
  const c = data.violation ? '#ff4444' : data.visited ? '#4caf50' : NODE_COLORS.document;
  const fill = data.violation ? '#2d0a0a' : data.visited ? '#0d2010' : '#180303';
  // Wavy bottom: flat sides and top, single wave at bottom
  const path = `M 3,3 L ${W-3},3 L ${W-3},${H-20}
    Q ${W*0.875},${H-3}  ${W*0.75},${H-20}
    Q ${W*0.625},${H-37} ${W*0.5}, ${H-20}
    Q ${W*0.375},${H-3}  ${W*0.25},${H-20}
    Q ${W*0.125},${H-37} 3,${H-20}
    Z`;
  return (
    <div
      className="flow-node editable-node"
      onMouseEnter={() => data.onHover?.(data.tutorExplanation ?? null)}
      onMouseLeave={() => data.onHover?.(null)}
      onDoubleClick={() => data.onEdit?.(String(data.id ?? ''))}
      style={{ width: `${W}px`, height: `${H}px`, position: 'relative', cursor: 'pointer', animation: selected ? 'nodePulse 1.5s ease-in-out infinite' : 'none' }}>
      <EditHintOverlay />
      {data.violation && <VBadge />}
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', inset: 0, filter: `drop-shadow(0 3px 12px ${c}44)` }}>
        <path d={path} fill={fill} stroke={c} strokeWidth={selected ? '3' : '2'} strokeLinejoin="round" />
      </svg>
      <Handle type="target" position={Position.Top}    style={{ ...hStyle(c), zIndex: 5 }} />
      <div style={{ position: 'absolute', top: '28%', left: '50%', transform: 'translate(-50%,-50%)', width: '150px', zIndex: 1 }}>
        <NodeLabel data={data} />
      </div>
      <Handle type="source" position={Position.Bottom} style={{ ...hStyle(c), bottom: '10px', zIndex: 5 }} />
    </div>
  );
};

// ─── 8. MANUAL INPUT — trapezoid slanting top-left high (ISO 5807: Manual Input / cin) ──
// ISO standard: top edge slopes DOWN left-to-right (higher on left)
const ManualInputNode = ({ data, selected }: NodeProps<Node<ExtendedNodeData>>) => {
  const W = 185, H = 72;
  const SLOPE = 18;
  const c = data.violation ? '#ff4444' : data.visited ? '#4caf50' : NODE_COLORS.manual_input;
  const fill = data.violation ? '#2d0a0a' : data.visited ? '#0d2010' : '#180b00';
  // Top-left corner raised, top-right corner lower → correct ISO manual-input shape
  const pts = `2,${SLOPE} ${W-2},2 ${W-2},${H-2} 2,${H-2}`;
  return (
    <div
      className="flow-node editable-node"
      onMouseEnter={() => data.onHover?.(data.tutorExplanation ?? null)}
      onMouseLeave={() => data.onHover?.(null)}
      onDoubleClick={() => data.onEdit?.(String(data.id ?? ''))}
      style={{ width: `${W}px`, height: `${H}px`, position: 'relative', cursor: 'pointer', animation: selected ? 'nodePulse 1.5s ease-in-out infinite' : 'none' }}>
      <EditHintOverlay />
      {data.violation && <VBadge />}
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', inset: 0, filter: `drop-shadow(0 3px 12px ${c}44)` }}>
        <polygon points={pts} fill={fill} stroke={c} strokeWidth={selected ? '3' : '2'} strokeLinejoin="round" />
      </svg>
      <Handle type="target" position={Position.Top}    style={{ ...hStyle(c), top: `${SLOPE / 2}px`, zIndex: 5 }} />
      <div style={{ position: 'absolute', top: '55%', left: '50%', transform: 'translate(-50%,-50%)', width: '145px', zIndex: 1 }}>
        <NodeLabel data={data} />
      </div>
      <Handle type="source" position={Position.Bottom} style={{ ...hStyle(c), zIndex: 5 }} />
    </div>
  );
};

// ─── 9. DELAY — proper D-shape via SVG (ISO 5807) ────────────────────────────
// Flat left edge, rounded right (semi-circle)
const DelayNode = ({ data, selected }: NodeProps<Node<ExtendedNodeData>>) => {
  const W = 185, H = 68;
  const R = H / 2 - 2; // radius of the right half-circle
  const c = data.violation ? '#ff4444' : NODE_COLORS.delay;
  const fill = data.violation ? '#2d0a0a' : data.visited ? '#1a2e1a' : '#0e1418';
  // D path: left vertical, top horizontal, right arc, bottom horizontal back
  const path = `M 3,3 L ${W - R - 2},3 A ${R},${R} 0 0 1 ${W - R - 2},${H-3} L 3,${H-3} Z`;
  return (
    <div
      className="flow-node editable-node"
      onMouseEnter={() => data.onHover?.(data.tutorExplanation ?? null)}
      onMouseLeave={() => data.onHover?.(null)}
      onDoubleClick={() => data.onEdit?.(String(data.id ?? ''))}
      style={{ width: `${W}px`, height: `${H}px`, position: 'relative', cursor: 'pointer', animation: selected ? 'nodePulse 1.5s ease-in-out infinite' : 'none' }}>
      <EditHintOverlay />
      {data.violation && <VBadge />}
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', inset: 0, filter: `drop-shadow(0 3px 14px ${c}33)` }}>
        <path d={path} fill={fill} stroke={c} strokeWidth={selected ? '3' : '2'} strokeLinejoin="round" />
      </svg>
      <Handle type="target" position={Position.Top}    style={{ ...hStyle(c), zIndex: 5 }} />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1, paddingRight: `${R / 2}px` }}>
        <NodeLabel data={data} />
      </div>
      <Handle type="source" position={Position.Bottom} style={{ ...hStyle(c), zIndex: 5 }} />
    </div>
  );
};

// ─── 10. DATABASE — cylinder (ISO 5807: Stored Data) ─────────────────────────
const DatabaseNode = ({ data, selected }: NodeProps<Node<ExtendedNodeData>>) => {
  const W = 175, H = 95;
  const rx = (W - 6) / 2, ry = 14;
  const c = data.violation ? '#ff4444' : data.visited ? '#4caf50' : NODE_COLORS.database;
  const fillTop = data.violation ? '#2d0a0a' : data.visited ? '#0d220d' : '#071407';
  const fillBody = data.violation ? '#1a0808' : data.visited ? '#0a1a0a' : '#050d05';
  return (
    <div
      className="flow-node editable-node"
      onMouseEnter={() => data.onHover?.(data.tutorExplanation ?? null)}
      onMouseLeave={() => data.onHover?.(null)}
      onDoubleClick={() => data.onEdit?.(String(data.id ?? ''))}
      style={{ width: `${W}px`, height: `${H}px`, position: 'relative', cursor: 'pointer', animation: selected ? 'nodePulse 1.5s ease-in-out infinite' : 'none' }}>
      <EditHintOverlay />
      {data.violation && <VBadge />}
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', inset: 0, filter: `drop-shadow(0 3px 14px ${c}44)` }}>
        {/* Body rectangle */}
        <rect x={3} y={ry} width={W - 6} height={H - ry - 3} fill={fillBody} stroke={c} strokeWidth={selected ? '3' : '2'} />
        {/* Bottom ellipse cap */}
        <ellipse cx={W/2} cy={H - ry - 2} rx={rx} ry={ry} fill={fillBody} stroke={c} strokeWidth={selected ? '3' : '2'} />
        {/* Top ellipse cap */}
        <ellipse cx={W/2} cy={ry + 1} rx={rx} ry={ry} fill={fillTop} stroke={c} strokeWidth={selected ? '3' : '2'} />
        {/* Inner top ellipse highlight */}
        <ellipse cx={W/2} cy={ry + 1} rx={rx - 6} ry={ry - 5} fill="none" stroke={c} strokeWidth="1" opacity="0.3" />
      </svg>
      <Handle type="target" position={Position.Top}    style={{ ...hStyle(c), top: '4px', zIndex: 5 }} />
      <div style={{ position: 'absolute', top: '55%', left: '50%', transform: 'translate(-50%,-50%)', width: `${W - 20}px`, zIndex: 1 }}>
        <NodeLabel data={data} />
      </div>
      <Handle type="source" position={Position.Bottom} style={{ ...hStyle(c), zIndex: 5 }} />
    </div>
  );
};

const nodeTypes = {
  terminator: TerminatorNode, process: ProcessNode, decision: DecisionNode, io: IONode,
  predefined: PredefinedNode, connector: ConnectorNode, document: DocumentNode,
  manual_input: ManualInputNode, delay: DelayNode, database: DatabaseNode,
};

// ─── Palette shape previews ───────────────────────────────────────────────────
const PALETTE_ITEMS: { type: FlowNodeType; label: string; iso: string; shape: React.ReactNode }[] = [
  {
    type: 'terminator', label: 'Start / End', iso: 'ISO: Terminal',
    shape: <div style={{ width: '48px', height: '20px', background: 'linear-gradient(135deg,#0d47a1,#1565c0)', border: '2px solid #42a5f5', borderRadius: '999px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '7px', color: 'white', fontWeight: '700', flexShrink: 0 }}>START</div>,
  },
  {
    type: 'process', label: 'Process', iso: 'ISO: Process',
    shape: <div style={{ width: '48px', height: '20px', background: 'linear-gradient(135deg,#141a14,#1e271e)', border: '2px solid #4caf50', borderRadius: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '7px', color: 'white', fontWeight: '700', flexShrink: 0 }}>PROC</div>,
  },
  {
    type: 'decision', label: 'Decision', iso: 'ISO: Decision',
    shape: (
      <svg width="24" height="24" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
        <polygon points="12,2 22,12 12,22 2,12" fill="#1a1608" stroke="#ffa726" strokeWidth="1.5" />
        <text x="12" y="16" textAnchor="middle" fontSize="6" fill="white" fontWeight="700">IF</text>
      </svg>
    ),
  },
  {
    type: 'io', label: 'Output (cout)', iso: 'ISO: Data',
    shape: (
      <svg width="48" height="20" viewBox="0 0 48 20" style={{ flexShrink: 0 }}>
        <polygon points="6,2 46,2 42,18 2,18" fill="#081c33" stroke="#64b5f6" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    type: 'predefined', label: 'Function Call', iso: 'ISO: Predefined',
    shape: (
      <div style={{ position: 'relative', width: '48px', height: '20px', background: 'linear-gradient(135deg,#18091f,#271040)', border: '2px solid #ab47bc', borderRadius: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '7px', color: 'white', fontWeight: '700', flexShrink: 0 }}>
        <div style={{ position: 'absolute', left: '5px',  top: 0, bottom: 0, width: '1.5px', background: '#ab47bc' }} />
        <div style={{ position: 'absolute', left: '9px',  top: 0, bottom: 0, width: '1.5px', background: '#ab47bc' }} />
        <div style={{ position: 'absolute', right: '5px', top: 0, bottom: 0, width: '1.5px', background: '#ab47bc' }} />
        <div style={{ position: 'absolute', right: '9px', top: 0, bottom: 0, width: '1.5px', background: '#ab47bc' }} />
        FUNC
      </div>
    ),
  },
  {
    type: 'connector', label: 'Connector', iso: 'ISO: On-page ref',
    shape: <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'linear-gradient(135deg,#042a2e,#073540)', border: '2px solid #26c6da', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', color: 'white', fontWeight: '800', flexShrink: 0 }}>A</div>,
  },
  {
    type: 'document', label: 'Document', iso: 'ISO: Document',
    shape: (
      <svg width="48" height="22" viewBox="0 0 48 22" style={{ flexShrink: 0 }}>
        <path d="M 2,2 L 46,2 L 46,14 Q 40,22 34,14 Q 28,6 22,14 Q 16,22 10,14 Q 6,8 2,14 Z" fill="#180303" stroke="#ef5350" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    type: 'manual_input', label: 'Manual Input (cin)', iso: 'ISO: Manual Input',
    shape: (
      <svg width="48" height="20" viewBox="0 0 48 20" style={{ flexShrink: 0 }}>
        <polygon points="2,6 46,2 46,18 2,18" fill="#180b00" stroke="#ff7043" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    type: 'delay', label: 'Delay / Wait', iso: 'ISO: Delay',
    shape: (
      <svg width="48" height="20" viewBox="0 0 48 20" style={{ flexShrink: 0 }}>
        <path d="M 2,2 L 38,2 A 9,9 0 0 1 38,18 L 2,18 Z" fill="#0e1418" stroke="#78909c" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    type: 'database', label: 'Database / Store', iso: 'ISO: Stored Data',
    shape: (
      <svg width="36" height="22" viewBox="0 0 36 22" style={{ flexShrink: 0 }}>
        <rect x="2" y="5" width="32" height="14" fill="#050d05" stroke="#66bb6a" strokeWidth="1.5" />
        <ellipse cx="18" cy="19" rx="16" ry="4" fill="#050d05" stroke="#66bb6a" strokeWidth="1.5" />
        <ellipse cx="18" cy="5"  rx="16" ry="4" fill="#0d220d" stroke="#66bb6a" strokeWidth="1.5" />
      </svg>
    ),
  },
];

// ─── Node Palette ─────────────────────────────────────────────────────────────
const NodePalette: React.FC<{
  onAddNode: (type: FlowNodeType) => void;
  onClearCanvas: () => void;
  /** When true the palette shrinks its list so the Generate panel fits below */
  hasGeneratePanel?: boolean;
}> = ({ onAddNode, onClearCanvas, hasGeneratePanel = false }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  // In build mode (hasGeneratePanel), cap the list height so items don't push into the generate panel
  const listMaxH = hasGeneratePanel ? 'calc(100vh - 420px)' : 'calc(100vh - 100px)';
  return (
    <div style={{
      background: 'linear-gradient(135deg,rgba(13,17,23,0.98),rgba(22,27,34,0.98))',
      border: '2px solid #30363d', borderRadius: '12px',
      padding: isExpanded ? '14px' : '10px 14px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.6)', backdropFilter: 'blur(12px)',
      transition: 'all 0.3s ease', flexShrink: 0,
    }}>
      <div onClick={() => setIsExpanded(v => !v)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none', marginBottom: isExpanded ? '10px' : 0 }}>
        <div style={{ fontSize: '11px', fontWeight: '700', color: '#58a6ff', letterSpacing: '0.5px' }}>➕ ADD NODE</div>
        <div style={{ fontSize: '12px', color: '#58a6ff', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s', marginLeft: '8px' }}>▼</div>
      </div>
      {isExpanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: listMaxH, overflowY: 'auto' }}>
          {PALETTE_ITEMS.map(({ type, label, iso, shape }) => {
            const color = NODE_COLORS[type];
            return (
              <button key={type} onClick={() => onAddNode(type)} title={iso}
                style={{ display: 'flex', alignItems: 'center', gap: '9px', background: 'rgba(255,255,255,0.02)', border: `1px solid ${color}33`, borderRadius: '7px', padding: '6px 9px', cursor: 'pointer', transition: 'all 0.2s', textAlign: 'left' }}
                onMouseEnter={e => { const b = e.currentTarget; b.style.background = `${color}14`; b.style.borderColor = `${color}88`; b.style.transform = 'translateX(-2px)'; }}
                onMouseLeave={e => { const b = e.currentTarget; b.style.background = 'rgba(255,255,255,0.02)'; b.style.borderColor = `${color}33`; b.style.transform = 'none'; }}>
                <div style={{ width: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{shape}</div>
                <div>
                  <div style={{ fontSize: '11px', color: '#c9d1d9', fontWeight: '600', lineHeight: 1.2 }}>{label}</div>
                  <div style={{ fontSize: '9px', color: '#484f58', marginTop: '1px' }}>{iso}</div>
                </div>
              </button>
            );
          })}
          <div style={{ height: '1px', background: '#21262d', margin: '4px 0' }} />
          <button onClick={onClearCanvas}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,68,68,0.04)', border: '1px solid rgba(255,68,68,0.25)', borderRadius: '7px', padding: '7px 9px', cursor: 'pointer', transition: 'all 0.2s' }}
            onMouseEnter={e => { const b = e.currentTarget; b.style.background = 'rgba(255,68,68,0.12)'; b.style.borderColor = '#ff4444'; }}
            onMouseLeave={e => { const b = e.currentTarget; b.style.background = 'rgba(255,68,68,0.04)'; b.style.borderColor = 'rgba(255,68,68,0.25)'; }}>
            <span style={{ fontSize: '12px' }}>🗑️</span>
            <span style={{ fontSize: '11px', color: '#ff6b6b', fontWeight: '600' }}>Clear Canvas</span>
          </button>
          <div style={{ padding: '5px 4px', fontSize: '9px', color: '#484f58', lineHeight: '1.7', borderTop: '1px solid #21262d', marginTop: '2px' }}>
            Double-click node to edit · double-click edge to label · Backspace to delete
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Legend ───────────────────────────────────────────────────────────────────
// Moved to bottom-left, stays above ReactFlow Controls (which are bottom-right)
const FlowchartLegend: React.FC<{ isDrawerOpen?: boolean }> = ({ isDrawerOpen = false }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  return (
    <div style={{
      position: 'absolute', bottom: '12px', left: '12px', zIndex: 1000,
      background: 'linear-gradient(135deg,rgba(13,17,23,0.98),rgba(22,27,34,0.98))',
      border: '2px solid #30363d', borderRadius: '12px',
      padding: isExpanded ? '14px' : '10px 14px',
      width: isExpanded ? '240px' : 'auto',
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)',
      transition: 'all 0.3s ease',
      opacity: isDrawerOpen ? 0.25 : 1, filter: isDrawerOpen ? 'blur(2px)' : 'none',
      pointerEvents: isDrawerOpen ? 'none' : 'auto',
    }}>
      <div onClick={() => setIsExpanded(v => !v)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' }}>
        <div style={{ fontSize: '11px', fontWeight: '700', color: '#58a6ff', letterSpacing: '0.5px' }}>📊 LEGEND</div>
        <div style={{ fontSize: '12px', color: '#58a6ff', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s', marginLeft: '8px' }}>▼</div>
      </div>
      {isExpanded && (
        <div style={{ marginTop: '12px', borderTop: '1px solid #21262d', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '7px', maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
          {PALETTE_ITEMS.map(({ type, label, iso, shape }) => (
            <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{shape}</div>
              <div>
                <div style={{ fontSize: '10px', color: 'white', fontWeight: '600' }}>{label}</div>
                <div style={{ fontSize: '9px', color: '#484f58' }}>{iso}</div>
              </div>
            </div>
          ))}
          <div style={{ marginTop: '4px', padding: '5px 4px', fontSize: '9px', color: '#484f58', lineHeight: '1.7', borderTop: '1px solid #21262d' }}>
            💡 Label decision edges <strong style={{ color: '#4caf50' }}>true</strong>/<strong style={{ color: '#ff6b6b' }}>false</strong>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Game Stats ───────────────────────────────────────────────────────────────
const GameStats: React.FC<{
  visitedNodes: Set<string>; totalNodes: number; safeNodes: number; isDrawerOpen?: boolean;
}> = ({ visitedNodes, totalNodes, safeNodes, isDrawerOpen = false }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const isSafe = safeNodes === totalNodes;
  const safeColor = isSafe ? '#4caf50' : '#ff4444';
  return (
    <div style={{
      position: 'absolute', top: '12px', left: '12px', zIndex: 1000,
      display: 'flex', flexDirection: 'column', gap: '8px',
      opacity: isDrawerOpen ? 0.25 : 1, filter: isDrawerOpen ? 'blur(2px)' : 'none',
      transition: 'all 0.3s ease', pointerEvents: isDrawerOpen ? 'none' : 'auto',
    }}>
      <div style={{ background: 'linear-gradient(135deg,rgba(13,17,23,0.95),rgba(22,27,34,0.95))', border: '2px solid #4caf50', borderRadius: '12px', padding: isExpanded ? '12px 14px' : '9px 12px', minWidth: '185px', boxShadow: '0 4px 20px rgba(76,175,80,0.25)', transition: 'all 0.3s ease' }}>
        <div onClick={() => setIsExpanded(v => !v)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' }}>
          <div style={{ fontSize: '10px', color: '#4caf50', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>📍 Exploration</div>
          <div style={{ fontSize: '12px', color: '#4caf50', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s' }}>▼</div>
        </div>
        <div style={{ fontSize: '15px', color: 'white', fontWeight: '600', marginTop: '5px' }}>{visitedNodes.size} / {totalNodes}</div>
        {isExpanded && (<>
          <div style={{ width: '100%', height: '5px', background: 'rgba(76,175,80,0.15)', borderRadius: '3px', overflow: 'hidden', border: '1px solid rgba(76,175,80,0.3)', marginTop: '7px' }}>
            <div style={{ width: `${totalNodes ? (visitedNodes.size / totalNodes) * 100 : 0}%`, height: '100%', background: 'linear-gradient(90deg,#4caf50,#66bb6a)', transition: 'width 0.4s ease' }} />
          </div>
          {visitedNodes.size === totalNodes && totalNodes > 0 && <div style={{ fontSize: '10px', color: '#4caf50', marginTop: '5px', fontWeight: '600' }}>✓ Complete!</div>}
        </>)}
      </div>
      <div style={{ background: 'linear-gradient(135deg,rgba(13,17,23,0.95),rgba(22,27,34,0.95))', border: `2px solid ${safeColor}`, borderRadius: '12px', padding: isExpanded ? '12px 14px' : '9px 12px', minWidth: '185px', boxShadow: `0 4px 20px ${isSafe ? 'rgba(76,175,80,0.25)' : 'rgba(255,68,68,0.25)'}`, transition: 'all 0.3s ease' }}>
        <div onClick={() => setIsExpanded(v => !v)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' }}>
          <div style={{ fontSize: '10px', color: safeColor, fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>🛡️ Safety</div>
          <div style={{ fontSize: '12px', color: safeColor, transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s' }}>▼</div>
        </div>
        <div style={{ fontSize: '15px', color: 'white', fontWeight: '600', marginTop: '5px' }}>{safeNodes} / {totalNodes}</div>
        {isExpanded && <div style={{ fontSize: '10px', color: safeColor, fontWeight: '600', marginTop: '5px' }}>{isSafe ? '✓ All safe' : `⚠ ${totalNodes - safeNodes} issue${totalNodes - safeNodes > 1 ? 's' : ''}`}</div>}
      </div>
    </div>
  );
};


// ─── Generate Code Panel ──────────────────────────────────────────────────────
// Rendered as a plain (non-absolute) box — positioned by the right-column flex container
const GenerateCodePanel: React.FC<{
  nodes: Node[]; edges: Edge[];
  onCodeGenerated?: (code: string) => void;
  isDirty?: boolean; onMarkClean?: () => void;
}> = ({ nodes, edges, onCodeGenerated, isDirty = false, onMarkClean }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerate = () => {
    const code = generateCppFromGraph(nodes, edges);
    setGeneratedCode(code); onCodeGenerated?.(code); onMarkClean?.();
  };
  const handleCopy = () => {
    if (!generatedCode) return;
    navigator.clipboard.writeText(generatedCode).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); });
  };
  const handleExport = () => {
    if (!generatedCode) return;
    const blob = new Blob([generatedCode], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'generated.cpp'; a.click();
    URL.revokeObjectURL(url);
  };

  const bc = isDirty && generatedCode ? '#ffa726' : '#a855f7';
  return (
    <div style={{
      background: 'linear-gradient(135deg,rgba(13,17,23,0.98),rgba(22,27,34,0.98))',
      border: `2px solid ${bc}`, borderRadius: '12px',
      padding: isExpanded ? '14px' : '10px 14px',
      boxShadow: `0 8px 32px ${isDirty && generatedCode ? 'rgba(255,167,38,0.3)' : 'rgba(168,85,247,0.3)'}`,
      backdropFilter: 'blur(10px)', transition: 'all 0.3s ease', flexShrink: 0,
    }}>
      <div onClick={() => setIsExpanded(v => !v)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none', marginBottom: isExpanded ? '10px' : 0 }}>
        <div style={{ fontSize: '11px', fontWeight: '700', color: bc, letterSpacing: '0.5px' }}>
          ⚡ GENERATE C++ {isDirty && generatedCode ? '⚠ outdated' : ''}
        </div>
        <div style={{ fontSize: '12px', color: '#a855f7', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s', marginLeft: '8px' }}>▼</div>
      </div>
      {isExpanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {isDirty && generatedCode && (
            <div style={{ fontSize: '9px', color: '#ffa726', padding: '5px 8px', background: 'rgba(255,167,38,0.08)', border: '1px solid rgba(255,167,38,0.3)', borderRadius: '6px' }}>
              ⚠️ Graph changed since last generation — click Generate to update
            </div>
          )}
          {!isDirty && (
            <div style={{ fontSize: '9px', color: '#484f58', lineHeight: '1.6', padding: '5px 8px', background: 'rgba(168,85,247,0.06)', borderRadius: '6px', border: '1px solid rgba(168,85,247,0.2)' }}>
              Build flowchart → label decision edges <strong style={{ color: '#4caf50' }}>true</strong>/<strong style={{ color: '#ff6b6b' }}>false</strong> → Generate
            </div>
          )}
          <button onClick={handleGenerate} disabled={nodes.length === 0}
            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: 'none', background: nodes.length === 0 ? 'rgba(168,85,247,0.15)' : isDirty && generatedCode ? 'linear-gradient(135deg,#ffa726cc,#ff8f00cc)' : 'linear-gradient(135deg,#a855f7cc,#7c3aedcc)', color: nodes.length === 0 ? '#6b21a8' : 'white', fontWeight: '700', fontSize: '12px', cursor: nodes.length === 0 ? 'not-allowed' : 'pointer', letterSpacing: '0.5px', transition: 'all 0.2s' }}
            onMouseEnter={e => { if (nodes.length > 0) e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}>
            {nodes.length === 0 ? 'Add nodes first' : `⚡ Generate from ${nodes.length} node${nodes.length !== 1 ? 's' : ''}`}
          </button>
          {generatedCode && (<>
            <div style={{ background: '#0d1117', border: `1px solid ${isDirty ? 'rgba(255,167,38,0.3)' : 'rgba(168,85,247,0.3)'}`, borderRadius: '8px', padding: '10px', maxHeight: '140px', overflowY: 'auto' }}>
              <pre style={{ margin: 0, fontSize: '10px', color: isDirty ? '#8b949e' : '#c9d1d9', fontFamily: "'JetBrains Mono','Fira Code',monospace", whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: '1.6', opacity: isDirty ? 0.6 : 1 }}>{generatedCode}</pre>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={handleCopy} style={{ flex: 1, padding: '8px', borderRadius: '7px', border: '1px solid rgba(168,85,247,0.5)', background: copied ? 'rgba(76,175,80,0.2)' : 'rgba(168,85,247,0.1)', color: copied ? '#4caf50' : '#a855f7', fontSize: '11px', fontWeight: '700', cursor: 'pointer', transition: 'all 0.2s' }}>{copied ? '✓ Copied!' : '📋 Copy'}</button>
              <button onClick={handleExport} style={{ flex: 1, padding: '8px', borderRadius: '7px', border: '1px solid rgba(168,85,247,0.5)', background: 'rgba(168,85,247,0.1)', color: '#a855f7', fontSize: '11px', fontWeight: '700', cursor: 'pointer', transition: 'all 0.2s' }}>💾 Export .cpp</button>
            </div>
          </>)}
        </div>
      )}
    </div>
  );
};

// ─── Node Editor Modal ────────────────────────────────────────────────────────
const ACCENT_MAP: Record<string, string> = { terminator: '#42a5f5', process: '#4caf50', decision: '#ffa726', io: '#64b5f6', predefined: '#ab47bc', connector: '#26c6da', document: '#ef5350', manual_input: '#ff7043', delay: '#78909c', database: '#66bb6a' };
const TITLE_MAP: Record<string, string> = { terminator: 'Start / End', process: 'Process', decision: 'Decision', io: 'Output', predefined: 'Predefined Process (Function)', connector: 'Connector (On-page ref)', document: 'Document / Output File', manual_input: 'Manual Input (cin)', delay: 'Delay / Wait', database: 'Database / Data Store' };
const CODE_PH: Record<string, string> = { process: 'e.g. hp = hp - 10;', decision: 'e.g. hp > 0', io: 'e.g. cout << hp << endl;', predefined: 'e.g. calculateDamage(hp, atk);', connector: '', document: 'e.g. label or filename', manual_input: 'e.g. cin >> name;', delay: 'e.g. sleep(1000);', database: 'e.g. scores[i]', terminator: '' };

const NodeEditor: React.FC<{ editState: EditState; onSave: (label: string, code: string) => void; onCancel: () => void }> = ({ editState, onSave, onCancel }) => {
  const [label, setLabel] = useState(editState.label);
  const [code, setCode] = useState(editState.code);
  const labelRef = useRef<HTMLInputElement>(null);
  useEffect(() => { labelRef.current?.focus(); labelRef.current?.select(); }, []);
  const accent = ACCENT_MAP[editState.type] ?? '#58a6ff';
  const title = TITLE_MAP[editState.type] ?? 'Node';
  const noCode = editState.type === 'terminator' || editState.type === 'connector';
  const fieldLabel = editState.type === 'decision' ? 'Condition / Label' : editState.type === 'connector' ? 'Reference Letter' : 'Label';
  const inputPlaceholder = editState.type === 'connector' ? 'e.g. A, B, 1' : `e.g. ${defaultLabels[editState.type as FlowNodeType] ?? 'Label'}`;
  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)' }}
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        onKeyDown={e => { if (e.key === 'Escape') onCancel(); if (e.key === 'Enter' && e.ctrlKey) onSave(label, code); }}
        style={{ background: '#13181f', border: `1px solid ${accent}44`, borderTop: `3px solid ${accent}`, borderRadius: '14px', width: '460px', boxShadow: `0 24px 64px rgba(0,0,0,0.85), 0 0 0 1px ${accent}18`, animation: 'editorSlideIn 0.18s ease-out', overflow: 'hidden' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '13px 20px', background: `${accent}0c`, borderBottom: `1px solid ${accent}1e` }}>
          <div style={{ width: '9px', height: '9px', borderRadius: '50%', background: accent, boxShadow: `0 0 8px ${accent}bb`, flexShrink: 0 }} />
          <div style={{ fontSize: '11px', fontWeight: '700', color: accent, textTransform: 'uppercase', letterSpacing: '1.2px', fontFamily: "'IBM Plex Mono', monospace", flex: 1 }}>{title}</div>
          <div style={{ fontSize: '10px', color: '#3d444d', fontFamily: "'IBM Plex Mono', monospace" }}>Ctrl+Enter · Esc</div>
        </div>
        {/* Fields */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', color: '#6e7681', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '7px', fontFamily: "'IBM Plex Mono', monospace" }}>{fieldLabel}</label>
            <input ref={labelRef} value={label} onChange={e => setLabel(e.target.value)} placeholder={inputPlaceholder}
              style={{ width: '100%', boxSizing: 'border-box', background: '#0d1117', border: '1px solid #2d333b', borderRadius: '8px', padding: '10px 13px', color: '#e6edf3', fontSize: '14px', fontFamily: "'IBM Plex Mono', monospace", outline: 'none', transition: 'border-color 0.15s, box-shadow 0.15s' }}
              onFocus={e => { e.target.style.borderColor = accent; e.target.style.boxShadow = `0 0 0 3px ${accent}22`; }}
              onBlur={e => { e.target.style.borderColor = '#2d333b'; e.target.style.boxShadow = 'none'; }} />
          </div>
          {!noCode && (
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '7px' }}>
                <label style={{ fontSize: '10px', fontWeight: '700', color: '#6e7681', textTransform: 'uppercase', letterSpacing: '0.8px', fontFamily: "'IBM Plex Mono', monospace" }}>C++ Code</label>
                <span style={{ fontSize: '10px', color: '#3d444d', fontFamily: "'IBM Plex Mono', monospace" }}>— written into generated output</span>
              </div>
              <textarea value={code} onChange={e => setCode(e.target.value)} placeholder={CODE_PH[editState.type] ?? ''} rows={3}
                style={{ width: '100%', boxSizing: 'border-box', background: '#0d1117', border: '1px solid #2d333b', borderRadius: '8px', padding: '10px 13px', color: '#e6edf3', fontSize: '12px', fontFamily: "'JetBrains Mono','Fira Code',monospace", outline: 'none', resize: 'vertical', lineHeight: '1.7', minHeight: '78px', maxHeight: '160px', transition: 'border-color 0.15s, box-shadow 0.15s' }}
                onFocus={e => { e.target.style.borderColor = accent; e.target.style.boxShadow = `0 0 0 3px ${accent}22`; }}
                onBlur={e => { e.target.style.borderColor = '#2d333b'; e.target.style.boxShadow = 'none'; }} />
            </div>
          )}
        </div>
        {/* Footer */}
        <div style={{ display: 'flex', gap: '10px', padding: '14px 20px', background: '#0d1117', borderTop: '1px solid #1e242c' }}>
          <button onClick={() => onSave(label, code)}
            style={{ flex: 1, padding: '10px 16px', borderRadius: '8px', border: 'none', background: `linear-gradient(135deg,${accent},${accent}aa)`, color: '#fff', fontWeight: '700', fontSize: '12px', cursor: 'pointer', letterSpacing: '0.5px', fontFamily: "'IBM Plex Mono', monospace", boxShadow: `0 4px 14px ${accent}44`, transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = `0 6px 20px ${accent}66`; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = `0 4px 14px ${accent}44`; }}>
            ✓ Save
          </button>
          <button onClick={onCancel}
            style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #2d333b', background: 'transparent', color: '#6e7681', fontWeight: '600', fontSize: '12px', cursor: 'pointer', transition: 'all 0.15s' }}
            onMouseEnter={e => { const b = e.currentTarget; b.style.borderColor = '#444c56'; b.style.color = '#8b949e'; }}
            onMouseLeave={e => { const b = e.currentTarget; b.style.borderColor = '#2d333b'; b.style.color = '#6e7681'; }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Edge Label Editor ────────────────────────────────────────────────────────
const EdgeLabelEditor: React.FC<{ editState: EdgeEditState; onSave: (label: string) => void; onCancel: () => void }> = ({ editState, onSave, onCancel }) => {
  const [label, setLabel] = useState(editState.label);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); inputRef.current?.select(); }, []);
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(3px)' }} onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div onKeyDown={e => { if (e.key === 'Escape') onCancel(); if (e.key === 'Enter') onSave(label); }}
        style={{ background: 'linear-gradient(135deg,#0d1117,#161b22)', border: '2px solid #64b5f6', borderRadius: '14px', padding: '20px', width: '320px', boxShadow: '0 20px 60px rgba(0,0,0,0.85), 0 0 30px rgba(100,181,246,0.2)', animation: 'editorSlideIn 0.18s ease-out' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#64b5f6', boxShadow: '0 0 8px #64b5f6' }} />
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#64b5f6', textTransform: 'uppercase', letterSpacing: '1px' }}>Edge Label</div>
          <div style={{ marginLeft: 'auto', fontSize: '10px', color: '#484f58' }}>Enter to save</div>
        </div>
        <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
          {['true', 'false', 'yes', 'no'].map(ql => (
            <button key={ql} onClick={() => onSave(ql)}
              style={{ flex: 1, padding: '7px', borderRadius: '6px', border: `1px solid ${ql === 'true' || ql === 'yes' ? '#4caf5066' : '#ff444466'}`, background: ql === 'true' || ql === 'yes' ? 'rgba(76,175,80,0.1)' : 'rgba(255,68,68,0.1)', color: ql === 'true' || ql === 'yes' ? '#4caf50' : '#ff6b6b', fontSize: '11px', fontWeight: '700', cursor: 'pointer', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}>
              {ql}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input ref={inputRef} value={label} onChange={e => setLabel(e.target.value)} placeholder="Custom label..."
            style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid #64b5f666', borderRadius: '8px', padding: '9px 12px', color: 'white', fontSize: '13px', fontFamily: 'inherit', outline: 'none' }}
            onFocus={e => { e.target.style.borderColor = '#64b5f6'; }} onBlur={e => { e.target.style.borderColor = '#64b5f666'; }} />
          <button onClick={() => onSave(label)} style={{ padding: '9px 14px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg,#64b5f6cc,#42a5f5cc)', color: 'white', fontWeight: '700', fontSize: '12px', cursor: 'pointer' }}>✓</button>
          <button onClick={onCancel} style={{ padding: '9px 14px', borderRadius: '8px', border: '1px solid #30363d', background: 'transparent', color: '#8b949e', fontSize: '12px', cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ fontSize: '9px', color: '#484f58', marginTop: '10px', lineHeight: '1.6' }}>
          💡 Label decision edges <strong style={{ color: '#4caf50' }}>true</strong> / <strong style={{ color: '#ff6b6b' }}>false</strong> for correct if/while code generation
        </div>
      </div>
    </div>
  );
};

// ─── Main FlowGraph ───────────────────────────────────────────────────────────
export const FlowGraph: React.FC<Props> = ({ cfg, safetyChecks = [], onNodeClick, isDrawerOpen = false, onGraphChange, onCodeGenerated }) => {
  const [nodes, setNodes] = useState<Node<ExtendedNodeData>[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [isInteractive, setIsInteractive] = useState(true);
  const [hoverInfo, setHoverInfo] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [visitedNodes, setVisitedNodes] = useState<Set<string>>(new Set());
  const visitedNodesRef = useRef<Set<string>>(new Set());
  const [editState, setEditState] = useState<EditState | null>(null);
  const [edgeEditState, setEdgeEditState] = useState<EdgeEditState | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  const handleOpenEdit = useCallback((nodeId: string) => {
    setNodes(current => {
      const node = current.find(n => n.id === nodeId);
      if (node) setEditState({ nodeId, label: String(node.data.label ?? ''), code: String(node.data.code ?? ''), type: node.type ?? 'process' });
      return current;
    });
  }, []);

  const handleSaveEdit = useCallback((newLabel: string, newCode: string) => {
    if (!editState) return;
    setNodes(current => {
      const next = current.map(n => n.id !== editState.nodeId ? n : { ...n, data: { ...n.data, label: newLabel || n.data.label, code: newCode } });
      setEdges(eds => { onGraphChange?.(next, eds); return eds; });
      return next;
    });
    setEditState(null); setIsDirty(true);
  }, [editState, onGraphChange]);

  const handleEdgeDoubleClick = useCallback((_: React.MouseEvent, edge: Edge) => {
    setEdgeEditState({ edgeId: edge.id, label: String(edge.label ?? ''), x: mousePos.x, y: mousePos.y });
  }, [mousePos]);

  const handleSaveEdgeLabel = useCallback((newLabel: string) => {
    if (!edgeEditState) return;
    const isT = newLabel === 'true' || newLabel === 'yes';
    const isF = newLabel === 'false' || newLabel === 'no';
    const ec = isT ? '#4caf50' : isF ? '#ff4444' : '#64b5f6';
    setEdges(current => {
      const next = current.map(e => e.id !== edgeEditState.edgeId ? e : {
        ...e, label: newLabel,
        labelStyle: { fill: isT ? '#4caf50' : isF ? '#ff6b6b' : '#ffffff', fontSize: '11px', fontWeight: '700' },
        style: { ...e.style, stroke: ec },
        markerEnd: { type: MarkerType.ArrowClosed, color: ec },
      });
      setNodes(nds => { onGraphChange?.(nds, next); return nds; });
      return next;
    });
    setEdgeEditState(null); setIsDirty(true);
  }, [edgeEditState, onGraphChange]);

  const handleClearCanvas = useCallback(() => {
    if (nodes.length === 0) return;
    if (!window.confirm('Clear the entire canvas? This cannot be undone.')) return;
    setNodes([]); setEdges([]);
    setVisitedNodes(new Set()); visitedNodesRef.current = new Set();
    setIsDirty(false); onGraphChange?.([], []);
  }, [nodes.length, onGraphChange]);

  const handleOpenEditRef = useRef(handleOpenEdit);
  handleOpenEditRef.current = handleOpenEdit;

  const handleAddNode = useCallback((type: FlowNodeType) => {
    const id = newNodeId();
    setNodes(current => {
      const hasStart = current.some(n => n.type === 'terminator' && String(n.data.label ?? '').toLowerCase() === 'start');
      const initialLabel = (type === 'terminator' && hasStart) ? 'End' : defaultLabels[type];
      const newNode: Node<ExtendedNodeData> = {
        id, type, position: { x: 220 + Math.random() * 160, y: 80 + current.length * 30 },
        data: { id, label: initialLabel, code: '', line: -1, onHover: setHoverInfo, onEdit: (nid: string) => handleOpenEditRef.current(nid) } as ExtendedNodeData,
        draggable: true,
      };
      return [...current, newNode];
    });
    setTimeout(() => {
      setNodes(current => {
        const node = current.find(n => n.id === id);
        if (node) {
          const hasStart = current.some(n => n.type === 'terminator' && String(n.data.label ?? '').toLowerCase() === 'start' && n.id !== id);
          const lbl = (type === 'terminator' && hasStart) ? 'End' : defaultLabels[type];
          setEditState({ nodeId: id, label: lbl, code: '', type });
        }
        return current;
      });
    }, 50);
    setIsDirty(true);
  }, []);

  const onNodesChangeHandler = useCallback((changes: any) => {
    setNodes(nds => {
      const next = applyNodeChanges(changes, nds);
      setEdges(eds => { onGraphChange?.(next, eds); return eds; });
      setIsDirty(true); return next;
    });
  }, [onGraphChange]);

  const onEdgesChangeHandler = useCallback((changes: any) => {
    setEdges(eds => {
      const next = applyEdgeChanges(changes, eds);
      setNodes(nds => { onGraphChange?.(nds, next); return nds; });
      setIsDirty(true); return next;
    });
  }, [onGraphChange]);

  const onConnectHandler = useCallback((params: Connection) => {
    setEdges(eds => {
      const next = addEdge({
        ...params, type: 'default',
        markerEnd: { type: MarkerType.ArrowClosed, color: '#64b5f6' },
        style: { stroke: '#64b5f6', strokeWidth: 2 },
        labelStyle: { fill: '#ffffff', fontSize: '11px', fontWeight: '600' },
        labelBgStyle: { fill: '#0d1117', fillOpacity: 0.9 },
        labelBgPadding: [5, 8] as [number, number],
      }, eds);
      setNodes(nds => { onGraphChange?.(nds, next); return nds; });
      setIsDirty(true); return next;
    });
  }, [onGraphChange]);

  const handleNodeClickWithGameLogic = useCallback((_: React.MouseEvent, node: Node<ExtendedNodeData>) => {
    visitedNodesRef.current = new Set([...visitedNodesRef.current, node.id]);
    setVisitedNodes(new Set(visitedNodesRef.current));
    setNodes(current => current.map(n => n.id === node.id ? { ...n, data: { ...n.data, visited: true } } : n));
    const cfgNode = cfg?.nodes.find(n => n.id === node.id);
    if (cfgNode?.line != null && onNodeClick) onNodeClick(cfgNode.line);
  }, [cfg, onNodeClick]);

  useEffect(() => {
    if (!cfg?.nodes?.length) return;
    const initialNodes: Node<ExtendedNodeData>[] = cfg.nodes.map(node => {
      const hasViolation = safetyChecks.some(c => c.line === node.line && c.status === 'UNSAFE');
      const lbl = String(node.label ?? '').toLowerCase();
      let nodeType: FlowNodeType = 'process';
      if (lbl === 'start' || lbl === 'end') nodeType = 'terminator';
      else if (node.type === 'decision') nodeType = 'decision';
      else if (lbl.includes('cin') || lbl.includes('scanf')) nodeType = 'manual_input';
      else if (lbl.includes('cout') || lbl.includes('printf') || lbl.includes('print') || lbl.includes('output')) nodeType = 'io';
      else if (lbl.includes('write') || lbl.includes('file') || lbl.includes('document') || lbl.includes('report')) nodeType = 'document';
      else if (lbl.includes('array') || lbl.includes('vector') || lbl.includes('map') || lbl.includes('database') || lbl.includes('store') || lbl.includes('[]')) nodeType = 'database';
      else if (lbl.includes('sleep') || lbl.includes('delay') || lbl.includes('wait') || lbl.includes('pause')) nodeType = 'delay';
      else if ((lbl.includes('(') && lbl.includes(')')) || lbl.includes('call') || lbl.includes('func')) nodeType = 'predefined';
      return {
        id: node.id, type: nodeType,
        data: { ...node, violation: hasViolation, visited: visitedNodesRef.current.has(node.id), onHover: setHoverInfo, onEdit: handleOpenEdit },
        position: { x: 0, y: 0 }, draggable: true,
      };
    });

    const initialEdges: Edge[] = cfg.edges.map((edge, i) => {
      const targetNode = cfg.nodes.find(n => n.id === edge.to);
      const hasViolation = targetNode && safetyChecks.some(c => c.line === targetNode.line && c.status === 'UNSAFE');
      const isVisited = visitedNodesRef.current.has(edge.from) && visitedNodesRef.current.has(edge.to);
      const color = hasViolation ? '#ff4444' : isVisited ? '#4caf50' : '#64b5f6';
      return {
        id: `e-${i}`, source: edge.from, target: edge.to, label: edge.label, type: 'default',
        animated: !!(hasViolation || isVisited),
        style: { stroke: color, strokeWidth: hasViolation ? 3 : isVisited ? 2.5 : 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color, width: 20, height: 20 },
        labelStyle: { fill: '#ffffff', fontSize: '11px', fontWeight: '600' },
        labelBgStyle: { fill: '#0d1117', fillOpacity: 0.9, rx: 4, ry: 4 },
        labelBgPadding: [5, 8] as [number, number],
      };
    });

    elk.layout({
      id: 'root',
      layoutOptions: { 'elk.algorithm': 'layered', 'elk.direction': 'DOWN', 'elk.spacing.nodeNode': '90', 'elk.layered.spacing.nodeNodeBetweenLayers': '120', 'elk.layered.nodePlacement.strategy': 'SIMPLE', 'elk.edgeRouting': 'ORTHOGONAL' },
      children: initialNodes.map(n => ({ id: n.id, ...(NODE_SIZES[n.type as FlowNodeType] ?? NODE_SIZES.process) })),
      edges: initialEdges.map(e => ({ id: e.id, sources: [e.source], targets: [e.target] })),
    })
      .then(layout => {
        const layouted = initialNodes.map(n => ({ ...n, position: { x: layout.children?.find(c => c.id === n.id)?.x ?? 0, y: layout.children?.find(c => c.id === n.id)?.y ?? 0 } }));
        setNodes(layouted); setEdges(initialEdges); onGraphChange?.(layouted, initialEdges);
      })
      .catch(err => {
        console.error('ELK layout error:', err);
        const fallback = initialNodes.map((n, i) => ({ ...n, position: { x: 200, y: i * 160 } }));
        setNodes(fallback); setEdges(initialEdges); onGraphChange?.(fallback, initialEdges);
      });
  }, [cfg, safetyChecks]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setNodes(nds => nds.map(n => ({ ...n, data: { ...n.data, onHover: setHoverInfo, onEdit: handleOpenEdit } })));
  }, [handleOpenEdit]);

  const totalNodes = nodes.length;
  const safeNodes = nodes.filter(n => {
    const cfgNode = cfg?.nodes.find(cn => cn.id === n.id);
    return !cfgNode || !safetyChecks.some(c => c.line === cfgNode.line && c.status === 'UNSAFE');
  }).length;
  const isBuildMode = !cfg;

  return (
    <div
      onMouseMove={e => setMousePos({ x: e.clientX + 15, y: e.clientY + 15 })}
      style={{ width: '100%', height: '100%', position: 'relative', background: '#0d1117' }}>

      {/*
        ── LAYOUT STRATEGY ────────────────────────────────────────────────
        Left side  (absolute, top-left):  GameStats (analysis mode only)
        Left side  (absolute, bot-left):  Legend
        Right side (absolute, flex col):  NodePalette + GenerateCodePanel
          • Both live inside ONE flex column so they NEVER overlap each other.
          • The column is scrollable if the viewport is too short.
          • ReactFlow Controls stay at bottom-right OUTSIDE this column,
            so we add padding-bottom to the column to avoid covering them.
        ────────────────────────────────────────────────────────────────── */}

      {/* Left: Legend */}
      <FlowchartLegend isDrawerOpen={isDrawerOpen} />

      {/* Left: GameStats (analysis mode only) */}
      {!isBuildMode && (
        <GameStats visitedNodes={visitedNodes} totalNodes={totalNodes} safeNodes={safeNodes} isDrawerOpen={isDrawerOpen} />
      )}

      {/* Right: single flex column containing Palette + (optionally) GenerateCodePanel */}
      <div style={{
        position: 'absolute', top: '12px', right: '12px',
        zIndex: 1000,
        width: '230px',
        display: 'flex', flexDirection: 'column', gap: '10px',
        /* Leave room at the bottom for ReactFlow Controls (~110px) */
        maxHeight: 'calc(100vh - 130px)',
        overflowY: 'auto',
        overflowX: 'visible',
        /* Hide the scrollbar visually but keep it functional */
        scrollbarWidth: 'thin',
        opacity: isDrawerOpen ? 0.25 : 1,
        filter: isDrawerOpen ? 'blur(2px)' : 'none',
        transition: 'all 0.3s ease',
        pointerEvents: isDrawerOpen ? 'none' : 'auto',
      }}>
        <NodePalette onAddNode={handleAddNode} onClearCanvas={handleClearCanvas} hasGeneratePanel={isBuildMode} />
        {isBuildMode && (
          <GenerateCodePanel nodes={nodes} edges={edges} onCodeGenerated={onCodeGenerated} isDirty={isDirty} onMarkClean={() => setIsDirty(false)} />
        )}
      </div>

      <ReactFlow
        nodes={nodes} edges={edges} nodeTypes={nodeTypes}
        onNodesChange={onNodesChangeHandler} onEdgesChange={onEdgesChangeHandler}
        onConnect={onConnectHandler} onNodeClick={handleNodeClickWithGameLogic}
        onEdgeDoubleClick={handleEdgeDoubleClick}
        fitView fitViewOptions={{ padding: 0.25, includeHiddenNodes: true, minZoom: 0.1, maxZoom: 1.0, duration: 800 }}
        nodesConnectable colorMode="dark"
        nodesDraggable={isInteractive} nodesFocusable={isInteractive} edgesFocusable
        panOnDrag={isInteractive} panOnScroll={false}
        selectionOnDrag={isInteractive} selectionKeyCode={null} multiSelectionKeyCode="Shift"
        deleteKeyCode="Backspace" zoomOnScroll={isInteractive} zoomOnPinch={isInteractive}
        zoomOnDoubleClick={false} minZoom={0.05} maxZoom={2} defaultEdgeOptions={{ type: 'default' }}>
        <Background color="#1f2937" gap={16} size={1} style={{ opacity: 0.4 }} />
        <Controls
          showInteractive onInteractiveChange={setIsInteractive} position="bottom-right"
          style={{ background: 'rgba(13,17,23,0.9)', border: '1px solid #30363d', borderRadius: '8px', bottom: '12px', right: '12px' }}
        />
      </ReactFlow>

      {nodes.length === 0 && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', gap: '12px' }}>
          <div style={{ fontSize: '48px', opacity: 0.12 }}>🗂</div>
          <div style={{ fontSize: '13px', color: '#484f58', textAlign: 'center', lineHeight: '1.9' }}>
            <strong style={{ color: '#30363d', display: 'block', marginBottom: '6px' }}>Canvas is empty</strong>
            Use <strong style={{ color: '#58a6ff' }}>➕ ADD NODE</strong> — 10 ISO 5807 shapes available.<br />
            {isBuildMode
              ? <>Label decision edges <strong style={{ color: '#4caf50' }}>true</strong>/<strong style={{ color: '#ff6b6b' }}>false</strong>, then <strong style={{ color: '#a855f7' }}>⚡ GENERATE C++ CODE</strong>.</>
              : <>Or run <strong style={{ color: '#4caf50' }}>ANALYZE CODE</strong> to auto-generate from source.</>}
          </div>
        </div>
      )}

      {hoverInfo && (
        <div style={{ position: 'fixed', top: mousePos.y, left: mousePos.x, pointerEvents: 'none', zIndex: 9999, background: 'linear-gradient(135deg,#1e1e1e,#2d2d2d)', border: '2px solid #ffa726', borderRadius: '8px', padding: '12px', maxWidth: '300px', boxShadow: '0 8px 24px rgba(0,0,0,0.6)', animation: 'fadeIn 0.2s ease-in-out' }}>
          <div style={{ color: '#ffa726', fontWeight: 'bold', fontSize: '10px', textTransform: 'uppercase', marginBottom: '6px', borderBottom: '1px solid #444', paddingBottom: '4px' }}>💡 Mentor Tip</div>
          <div style={{ color: '#e0e0e0', fontSize: '12px', lineHeight: '1.5' }}>{hoverInfo}</div>
        </div>
      )}

      {editState && <NodeEditor editState={editState} onSave={handleSaveEdit} onCancel={() => setEditState(null)} />}
      {edgeEditState && <EdgeLabelEditor editState={edgeEditState} onSave={handleSaveEdgeLabel} onCancel={() => setEdgeEditState(null)} />}

      <style>{`
        @keyframes nodePulse     { 0%,100%{transform:scale(1)}      50%{transform:scale(1.04)} }
        @keyframes bounce        { 0%,100%{transform:translateY(0)}  50%{transform:translateY(-6px)} }
        @keyframes fadeIn        { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
        @keyframes editorSlideIn { from{opacity:0;transform:translateY(-10px) scale(0.97)} to{opacity:1;transform:none} }

        .flow-node:hover          { transform:translateY(-2px); }
        .editable-node:hover .edit-hint { opacity:1 !important; }

        .react-flow__node          { cursor:grab !important; }
        .react-flow__node.dragging { cursor:grabbing !important; }
        .react-flow__edge-path     { stroke-linecap:round; stroke-linejoin:round; }
        .react-flow__edge:hover .react-flow__edge-path { stroke-width:3 !important; cursor:pointer; }
      `}</style>
    </div>
  );
};