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

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExtendedNodeData extends ControlFlowNode {
  violation?: boolean;
  visited?: boolean;
  onHover?: (msg: string | null) => void;
  onEdit?: (id: string) => void;
}

interface Props {
  cfg?: CFG;                        // optional — absent = blank canvas mode
  safetyChecks?: SafetyCheck[];     // optional — absent = no violation highlighting
  onNodeClick?: (line: number) => void;
  isDrawerOpen?: boolean;
  onGraphChange?: (nodes: Node<ExtendedNodeData>[], edges: Edge[]) => void;
  /** When provided, the "Generate Code" panel will call this with the result */
  onCodeGenerated?: (code: string) => void;
}

interface EditState {
  nodeId: string;
  label: string;
  code: string;
  type: string;
}

// ─── ELK ─────────────────────────────────────────────────────────────────────

const elk = new ELK();

let _nodeIdCounter = 1000;
const newNodeId = () => `user-node-${++_nodeIdCounter}`;

// ─── Node Editor Modal ────────────────────────────────────────────────────────

const NodeEditor: React.FC<{
  editState: EditState;
  onSave: (label: string, code: string) => void;
  onCancel: () => void;
}> = ({ editState, onSave, onCancel }) => {
  const [label, setLabel] = useState(editState.label);
  const [code, setCode] = useState(editState.code);
  const labelRef = useRef<HTMLInputElement>(null);

  useEffect(() => { labelRef.current?.focus(); labelRef.current?.select(); }, []);

  const isTerminator = editState.type === 'terminator';
  const accentMap: Record<string, string> = { terminator: '#42a5f5', decision: '#ffa726', process: '#4caf50', io: '#64b5f6' };
  const titleMap: Record<string, string> = { terminator: 'Start / End', decision: 'Decision (Condition)', process: 'Process', io: 'Input / Output' };
  const accent = accentMap[editState.type] ?? '#58a6ff';
  const title = titleMap[editState.type] ?? 'Node';
  const placeholderMap: Record<string, { label: string; code: string }> = {
    process:    { label: 'e.g. Assign hp',   code: 'e.g.  hp = hp - 10;' },
    decision:   { label: 'e.g. hp > 0',      code: 'e.g.  hp > 0' },
    io:         { label: 'e.g. Output hp',   code: 'e.g.  cout << hp << endl;' },
    terminator: { label: '',                  code: '' },
  };
  const ph = placeholderMap[editState.type] ?? placeholderMap.process;

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        onKeyDown={e => { if (e.key === 'Escape') onCancel(); if (e.key === 'Enter' && e.ctrlKey) onSave(label, code); }}
        style={{ background: 'linear-gradient(135deg,#0d1117,#161b22)', border: `2px solid ${accent}`, borderRadius: '16px', padding: '24px', width: '400px', boxShadow: `0 20px 60px rgba(0,0,0,0.85),0 0 40px ${accent}33`, animation: 'editorSlideIn 0.18s ease-out' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: accent, boxShadow: `0 0 10px ${accent}` }} />
          <div style={{ fontSize: '11px', fontWeight: '700', color: accent, textTransform: 'uppercase', letterSpacing: '1px' }}>Edit {title}</div>
          <div style={{ marginLeft: 'auto', fontSize: '10px', color: '#484f58' }}>Ctrl+Enter to save · Esc to cancel</div>
        </div>

        <div style={{ marginBottom: '14px' }}>
          <label style={{ display: 'block', fontSize: '10px', color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
            {editState.type === 'decision' ? 'Condition / Label' : 'Label'}
          </label>
          <input
            ref={labelRef}
            value={label}
            onChange={e => setLabel(e.target.value)}
            disabled={isTerminator}
            placeholder={isTerminator ? 'Start/End cannot be renamed' : ph.label}
            style={{ width: '100%', boxSizing: 'border-box', background: isTerminator ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.06)', border: `1px solid ${isTerminator ? '#30363d' : accent + '66'}`, borderRadius: '8px', padding: '10px 12px', color: isTerminator ? '#484f58' : 'white', fontSize: '13px', fontFamily: 'inherit', outline: 'none', cursor: isTerminator ? 'not-allowed' : 'text', transition: 'border-color 0.2s' }}
            onFocus={e => { if (!isTerminator) e.target.style.borderColor = accent; }}
            onBlur={e => { e.target.style.borderColor = isTerminator ? '#30363d' : accent + '66'; }}
          />
        </div>

        {!isTerminator && (
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '10px', color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
              C++ Code Statement
              <span style={{ marginLeft: '8px', color: '#484f58', textTransform: 'none', letterSpacing: 0, fontSize: '9px' }}>used directly in generated code</span>
            </label>
            <textarea
              value={code}
              onChange={e => setCode(e.target.value)}
              placeholder={ph.code}
              rows={3}
              style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.06)', border: `1px solid ${accent}66`, borderRadius: '8px', padding: '10px 12px', color: 'white', fontSize: '12px', fontFamily: "'JetBrains Mono','Fira Code',monospace", outline: 'none', resize: 'vertical', lineHeight: '1.6', transition: 'border-color 0.2s' }}
              onFocus={e => { e.target.style.borderColor = accent; }}
              onBlur={e => { e.target.style.borderColor = accent + '66'; }}
            />
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => onSave(label, code)}
            style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: `linear-gradient(135deg,${accent}cc,${accent}88)`, color: 'white', fontWeight: '700', fontSize: '12px', cursor: 'pointer', letterSpacing: '0.5px', boxShadow: `0 4px 12px ${accent}44`, transition: 'all 0.2s' }}
            onMouseEnter={e => { (e.target as HTMLButtonElement).style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { (e.target as HTMLButtonElement).style.transform = 'none'; }}>
            ✓ SAVE
          </button>
          <button onClick={onCancel}
            style={{ padding: '10px 18px', borderRadius: '8px', border: '1px solid #30363d', background: 'transparent', color: '#8b949e', fontWeight: '600', fontSize: '12px', cursor: 'pointer', transition: 'all 0.2s' }}
            onMouseEnter={e => { const b = e.target as HTMLButtonElement; b.style.borderColor = '#58a6ff'; b.style.color = '#58a6ff'; }}
            onMouseLeave={e => { const b = e.target as HTMLButtonElement; b.style.borderColor = '#30363d'; b.style.color = '#8b949e'; }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Node Palette ─────────────────────────────────────────────────────────────

const NodePalette: React.FC<{
  onAddNode: (type: 'terminator' | 'process' | 'decision' | 'io') => void;
  isDrawerOpen?: boolean;
}> = ({ onAddNode, isDrawerOpen = false }) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const items: { type: 'terminator' | 'process' | 'decision' | 'io'; label: string; color: string; shape: React.ReactNode }[] = [
    { type: 'terminator', label: 'Start / End', color: '#42a5f5', shape: <div style={{ width: '44px', height: '22px', background: 'linear-gradient(135deg,#0d47a1,#1976d2)', border: '2px solid #42a5f5', borderRadius: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '7px', color: 'white', fontWeight: '700', flexShrink: 0 }}>START</div> },
    { type: 'process',    label: 'Process',    color: '#4caf50', shape: <div style={{ width: '44px', height: '22px', background: 'linear-gradient(135deg,#1e1e1e,#2d2d2d)', border: '2px solid #4caf50', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '7px', color: 'white', fontWeight: '700', flexShrink: 0 }}>PROC</div> },
    { type: 'decision',   label: 'Decision',   color: '#ffa726', shape: <div style={{ width: '22px', height: '22px', background: 'linear-gradient(135deg,#1a1a2e,#2d2d44)', border: '2px solid #ffa726', transform: 'rotate(45deg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><span style={{ transform: 'rotate(-45deg)', fontSize: '7px', color: 'white', fontWeight: '700' }}>IF</span></div> },
    { type: 'io',         label: 'Input/Output', color: '#64b5f6', shape: <svg width="44" height="22" viewBox="0 0 44 22" style={{ flexShrink: 0 }}><path d="M 4 2 L 40 2 L 42 20 L 6 20 Z" fill="#1e3a5f" stroke="#64b5f6" strokeWidth="1.5" strokeLinejoin="round" /><text x="22" y="14" textAnchor="middle" fontSize="6" fill="white" fontWeight="700">I/O</text></svg> },
  ];

  return (
    <div style={{ position: 'absolute', top: '20px', right: '20px', zIndex: 1000, background: 'linear-gradient(135deg,rgba(13,17,23,0.98),rgba(22,27,34,0.98))', border: '2px solid #30363d', borderRadius: '12px', padding: isExpanded ? '14px' : '10px 14px', minWidth: isExpanded ? '180px' : 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)', transition: 'all 0.3s ease', opacity: isDrawerOpen ? 0.3 : 1, filter: isDrawerOpen ? 'blur(2px)' : 'none', pointerEvents: isDrawerOpen ? 'none' : 'auto' }}>
      <div onClick={() => setIsExpanded(v => !v)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none', marginBottom: isExpanded ? '12px' : '0' }}>
        <div style={{ fontSize: '11px', fontWeight: '700', color: '#58a6ff', letterSpacing: '0.5px' }}>➕ ADD NODE</div>
        <div style={{ fontSize: '14px', color: '#58a6ff', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s ease', marginLeft: '8px' }}>▼</div>
      </div>
      {isExpanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {items.map(({ type, label, color, shape }) => (
            <button key={type} onClick={() => onAddNode(type)}
              style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${color}44`, borderRadius: '8px', padding: '8px 10px', cursor: 'pointer', transition: 'all 0.2s', textAlign: 'left', color: 'white' }}
              onMouseEnter={e => { const b = e.currentTarget; b.style.background = `${color}18`; b.style.borderColor = color; b.style.transform = 'translateX(-2px)'; }}
              onMouseLeave={e => { const b = e.currentTarget; b.style.background = 'rgba(255,255,255,0.03)'; b.style.borderColor = `${color}44`; b.style.transform = 'none'; }}>
              {shape}
              <span style={{ fontSize: '11px', color: '#c9d1d9', fontWeight: '500' }}>{label}</span>
            </button>
          ))}
          <div style={{ marginTop: '4px', padding: '6px 4px', fontSize: '9px', color: '#484f58', lineHeight: '1.6', borderTop: '1px solid #21262d' }}>
            Click to add · double-click to edit · drag handles to connect · Backspace to delete
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Edit hint badge ──────────────────────────────────────────────────────────

const EditHint = () => (
  <div className="edit-hint" style={{ position: 'absolute', top: '-22px', left: '50%', transform: 'translateX(-50%)', fontSize: '9px', color: '#8b949e', whiteSpace: 'nowrap', background: 'rgba(13,17,23,0.92)', border: '1px solid #30363d', borderRadius: '4px', padding: '2px 7px', pointerEvents: 'none', opacity: 0, transition: 'opacity 0.2s', zIndex: 10 }}>
    ✏️ double-click to edit
  </div>
);

// ─── Legend ───────────────────────────────────────────────────────────────────

const FlowchartLegend: React.FC<{ isDrawerOpen?: boolean }> = ({ isDrawerOpen = false }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  return (
    <div style={{ position: 'absolute', bottom: '80px', left: '20px', zIndex: 1000, background: 'linear-gradient(135deg,rgba(13,17,23,0.98),rgba(22,27,34,0.98))', border: '2px solid #30363d', borderRadius: '12px', padding: isExpanded ? '16px' : '12px 16px', minWidth: isExpanded ? '220px' : 'auto', maxWidth: isExpanded ? '220px' : '180px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)', transition: 'all 0.3s ease', opacity: isDrawerOpen ? 0.3 : 1, filter: isDrawerOpen ? 'blur(2px)' : 'none', pointerEvents: isDrawerOpen ? 'none' : 'auto' }}>
      <div onClick={() => setIsExpanded(v => !v)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' }}>
        <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#58a6ff', letterSpacing: '0.5px' }}>📊 LEGEND</div>
        <div style={{ fontSize: '16px', color: '#58a6ff', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s ease' }}>▼</div>
      </div>
      {isExpanded && (
        <div style={{ marginTop: '14px', borderTop: '1px solid #30363d', paddingTop: '12px' }}>
          {[
            { shape: <div style={{ width: '44px', height: '22px', background: 'linear-gradient(135deg,#0d47a1,#1976d2)', border: '2px solid #42a5f5', borderRadius: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '7px', color: 'white', fontWeight: '600' }}>Start</div>, title: 'Start/End', sub: 'Entry/Exit' },
            { shape: <div style={{ width: '44px', height: '22px', background: 'linear-gradient(135deg,#1e1e1e,#2d2d2d)', border: '2px solid #4caf50', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '7px', color: 'white', fontWeight: '600' }}>Process</div>, title: 'Process', sub: 'Action/Statement' },
            { shape: <div style={{ width: '22px', height: '22px', background: 'linear-gradient(135deg,#1a1a2e,#2d2d44)', border: '2px solid #ffa726', transform: 'rotate(45deg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ transform: 'rotate(-45deg)', fontSize: '7px', color: 'white', fontWeight: '600' }}>If?</div></div>, title: 'Decision', sub: 'if/while condition' },
          ].map(({ shape, title, sub }) => (
            <div key={title} style={{ display: 'flex', alignItems: 'center', marginBottom: '10px', gap: '10px' }}>
              {shape}
              <div style={{ fontSize: '10px', color: '#c9d1d9', flex: 1 }}>
                <strong style={{ color: 'white', display: 'block' }}>{title}</strong>
                <span style={{ fontSize: '9px', opacity: 0.8 }}>{sub}</span>
              </div>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <svg width="44" height="22" viewBox="0 0 44 22" style={{ flexShrink: 0 }}>
              <defs><linearGradient id="legend-io-grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style={{ stopColor: '#2a5298', stopOpacity: 1 }} /><stop offset="100%" style={{ stopColor: '#1e3a5f', stopOpacity: 1 }} /></linearGradient></defs>
              <path d="M 4 2 L 40 2 L 42 20 L 6 20 Z" fill="url(#legend-io-grad)" stroke="#64b5f6" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
            <div style={{ fontSize: '10px', color: '#c9d1d9', flex: 1 }}>
              <strong style={{ color: 'white', display: 'block' }}>Input/Output</strong>
              <span style={{ fontSize: '9px', opacity: 0.8 }}>cin / cout</span>
            </div>
          </div>
          <div style={{ paddingTop: '10px', borderTop: '1px solid #30363d', fontSize: '9px', color: '#484f58', lineHeight: '1.7' }}>
            💡 <strong style={{ color: '#8b949e' }}>Double-click</strong> any node to edit code.<br />
            Use <strong style={{ color: '#8b949e' }}>ADD NODE</strong> panel to build from scratch.
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Game Stats ───────────────────────────────────────────────────────────────

const GameStats: React.FC<{ visitedNodes: Set<string>; totalNodes: number; safeNodes: number; isDrawerOpen?: boolean }> = ({ visitedNodes, totalNodes, safeNodes, isDrawerOpen = false }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const isSafe = safeNodes === totalNodes;
  const safeColor = isSafe ? '#4caf50' : '#ff4444';
  return (
    <div style={{ position: 'absolute', top: '20px', left: '20px', zIndex: 1000, display: 'flex', flexDirection: 'column', gap: '10px', opacity: isDrawerOpen ? 0.3 : 1, filter: isDrawerOpen ? 'blur(2px)' : 'none', transition: 'all 0.3s ease', pointerEvents: isDrawerOpen ? 'none' : 'auto' }}>
      <div style={{ background: 'linear-gradient(135deg,rgba(13,17,23,0.95),rgba(22,27,34,0.95))', border: '2px solid #4caf50', borderRadius: '12px', padding: isExpanded ? '14px 16px' : '10px 14px', minWidth: '190px', boxShadow: '0 4px 20px rgba(76,175,80,0.3)', transition: 'all 0.3s ease' }}>
        <div onClick={() => setIsExpanded(v => !v)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' }}>
          <div style={{ fontSize: '10px', color: '#4caf50', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>📍 Exploration</div>
          <div style={{ fontSize: '14px', color: '#4caf50', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s ease' }}>▼</div>
        </div>
        <div style={{ fontSize: '15px', color: 'white', fontWeight: '600', marginTop: '6px' }}>{visitedNodes.size} / {totalNodes}</div>
        {isExpanded && (<>
          <div style={{ width: '100%', height: '6px', background: 'rgba(76,175,80,0.15)', borderRadius: '3px', overflow: 'hidden', border: '1px solid rgba(76,175,80,0.3)', marginTop: '8px' }}>
            <div style={{ width: `${totalNodes ? (visitedNodes.size / totalNodes) * 100 : 0}%`, height: '100%', background: 'linear-gradient(90deg,#4caf50,#66bb6a)', transition: 'width 0.4s ease' }} />
          </div>
          {visitedNodes.size === totalNodes && totalNodes > 0 && <div style={{ fontSize: '10px', color: '#4caf50', marginTop: '6px', fontWeight: '600' }}>✓ Complete!</div>}
        </>)}
      </div>
      <div style={{ background: 'linear-gradient(135deg,rgba(13,17,23,0.95),rgba(22,27,34,0.95))', border: `2px solid ${safeColor}`, borderRadius: '12px', padding: isExpanded ? '14px 16px' : '10px 14px', minWidth: '190px', boxShadow: `0 4px 20px ${isSafe ? 'rgba(76,175,80,0.3)' : 'rgba(255,68,68,0.3)'}`, transition: 'all 0.3s ease' }}>
        <div onClick={() => setIsExpanded(v => !v)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' }}>
          <div style={{ fontSize: '10px', color: safeColor, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>🛡️ Safety</div>
          <div style={{ fontSize: '14px', color: safeColor, transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s ease' }}>▼</div>
        </div>
        <div style={{ fontSize: '17px', color: 'white', fontWeight: 'bold', marginTop: '4px' }}>{safeNodes} / {totalNodes}</div>
        {isExpanded && <div style={{ fontSize: '10px', color: safeColor, fontWeight: '600', marginTop: '6px' }}>{isSafe ? '✓ All safe' : `⚠ ${totalNodes - safeNodes} issue${totalNodes - safeNodes > 1 ? 's' : ''}`}</div>}
      </div>
    </div>
  );
};

// ─── Generate Code Panel ─────────────────────────────────────────────────────
// This panel is ONLY shown in "build flowchart" mode (no cfg prop).
// It runs generateCppFromGraph locally — no backend call needed.

const GenerateCodePanel: React.FC<{
  nodes: Node[];
  edges: Edge[];
  onCodeGenerated?: (code: string) => void;
  isDrawerOpen?: boolean;
}> = ({ nodes, edges, onCodeGenerated, isDrawerOpen = false }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerate = () => {
    const code = generateCppFromGraph(nodes, edges);
    setGeneratedCode(code);
    onCodeGenerated?.(code);
  };

  const handleCopy = () => {
    if (!generatedCode) return;
    navigator.clipboard.writeText(generatedCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  const handleExport = () => {
    if (!generatedCode) return;
    const blob = new Blob([generatedCode], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'generated.cpp';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{
      position: 'absolute',
      bottom: '80px',
      right: '20px',
      zIndex: 1000,
      background: 'linear-gradient(135deg,rgba(13,17,23,0.98),rgba(22,27,34,0.98))',
      border: '2px solid #a855f7',
      borderRadius: '12px',
      padding: isExpanded ? '14px' : '10px 14px',
      width: isExpanded ? '280px' : 'auto',
      boxShadow: '0 8px 32px rgba(168,85,247,0.3)',
      backdropFilter: 'blur(10px)',
      transition: 'all 0.3s ease',
      opacity: isDrawerOpen ? 0.3 : 1,
      filter: isDrawerOpen ? 'blur(2px)' : 'none',
      pointerEvents: isDrawerOpen ? 'none' : 'auto',
    }}>
      {/* Header */}
      <div
        onClick={() => setIsExpanded(v => !v)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none', marginBottom: isExpanded ? '12px' : '0' }}
      >
        <div style={{ fontSize: '11px', fontWeight: '700', color: '#a855f7', letterSpacing: '0.5px' }}>⚡ GENERATE C++ CODE</div>
        <div style={{ fontSize: '14px', color: '#a855f7', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s ease', marginLeft: '8px' }}>▼</div>
      </div>

      {isExpanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Instruction hint */}
          <div style={{ fontSize: '9px', color: '#484f58', lineHeight: '1.6', padding: '6px 8px', background: 'rgba(168,85,247,0.07)', borderRadius: '6px', border: '1px solid rgba(168,85,247,0.2)' }}>
            Build your flowchart above using <strong style={{ color: '#8b949e' }}>ADD NODE</strong>, connect nodes, then click Generate to produce C++ source code.
          </div>

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={nodes.length === 0}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '8px',
              border: 'none',
              background: nodes.length === 0
                ? 'rgba(168,85,247,0.2)'
                : 'linear-gradient(135deg,#a855f7cc,#7c3aedcc)',
              color: nodes.length === 0 ? '#6b21a8' : 'white',
              fontWeight: '700',
              fontSize: '12px',
              cursor: nodes.length === 0 ? 'not-allowed' : 'pointer',
              letterSpacing: '0.5px',
              boxShadow: nodes.length > 0 ? '0 4px 12px rgba(168,85,247,0.4)' : 'none',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { if (nodes.length > 0) (e.currentTarget).style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { (e.currentTarget).style.transform = 'none'; }}
          >
            {nodes.length === 0 ? 'Add nodes first' : `⚡ Generate from ${nodes.length} node${nodes.length !== 1 ? 's' : ''}`}
          </button>

          {/* Generated code preview + actions */}
          {generatedCode && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{
                background: '#0d1117',
                border: '1px solid rgba(168,85,247,0.35)',
                borderRadius: '8px',
                padding: '10px',
                maxHeight: '180px',
                overflowY: 'auto',
              }}>
                <pre style={{ margin: 0, fontSize: '10px', color: '#c9d1d9', fontFamily: "'JetBrains Mono','Fira Code',monospace", whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: '1.6' }}>
                  {generatedCode}
                </pre>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={handleCopy}
                  style={{ flex: 1, padding: '8px', borderRadius: '7px', border: '1px solid rgba(168,85,247,0.5)', background: copied ? 'rgba(76,175,80,0.2)' : 'rgba(168,85,247,0.1)', color: copied ? '#4caf50' : '#a855f7', fontSize: '11px', fontWeight: '700', cursor: 'pointer', transition: 'all 0.2s' }}
                >
                  {copied ? '✓ Copied!' : '📋 Copy'}
                </button>
                <button
                  onClick={handleExport}
                  style={{ flex: 1, padding: '8px', borderRadius: '7px', border: '1px solid rgba(168,85,247,0.5)', background: 'rgba(168,85,247,0.1)', color: '#a855f7', fontSize: '11px', fontWeight: '700', cursor: 'pointer', transition: 'all 0.2s' }}
                >
                  💾 Export .cpp
                </button>
              </div>
              <div style={{ fontSize: '9px', color: '#484f58', textAlign: 'center' }}>
                {onCodeGenerated ? 'Code synced to editor →' : 'Copy or export your code above'}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Node Components ──────────────────────────────────────────────────────────

const TerminatorNode = ({ data, selected }: NodeProps<Node<ExtendedNodeData>>) => {
  const isViolation = data.violation ?? false;
  const isVisited = data.visited ?? false;
  const color = isViolation ? '#ff4444' : isVisited ? '#4caf50' : '#42a5f5';
  return (
    <div className="terminator-node editable-node" onMouseEnter={() => data.onHover?.(data.tutorExplanation ?? null)} onMouseLeave={() => data.onHover?.(null)} onDoubleClick={() => data.onEdit?.(String(data.id ?? ''))}
      style={{ padding: '14px 28px', minWidth: '120px', textAlign: 'center', color: 'white', background: isViolation ? 'linear-gradient(135deg,#2d0a0a,#4a1515)' : isVisited ? 'linear-gradient(135deg,#0a2d0a,#154a15)' : 'linear-gradient(135deg,#0d47a1,#1976d2)', border: `3px solid ${color}`, borderRadius: '50px', fontSize: '13px', fontWeight: '700', position: 'relative', cursor: 'pointer', boxShadow: `0 4px 20px ${isViolation ? 'rgba(255,68,68,0.4)' : isVisited ? 'rgba(76,175,80,0.4)' : 'rgba(66,165,245,0.4)'}`, transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)', animation: selected ? 'pulse 1.5s ease-in-out infinite' : 'none', textShadow: '0 2px 4px rgba(0,0,0,0.5)', letterSpacing: '0.5px' }}>
      <EditHint />
      {isViolation && <div style={{ position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)', fontSize: '20px', animation: 'bounce 1s ease-in-out infinite' }}>⚠️</div>}
      <Handle type="target" position={Position.Top} style={{ background: color, width: '12px', height: '12px', border: '2px solid #0d1117', boxShadow: `0 0 10px ${color}` }} />
      {String(data.label ?? '')}
      <Handle type="source" position={Position.Bottom} style={{ background: color, width: '12px', height: '12px', border: '2px solid #0d1117', boxShadow: `0 0 10px ${color}` }} />
    </div>
  );
};

const ProcessNode = ({ data, selected }: NodeProps<Node<ExtendedNodeData>>) => {
  const isViolation = data.violation ?? false;
  const isVisited = data.visited ?? false;
  const handleColor = isViolation ? '#ff4444' : isVisited ? '#4caf50' : '#64b5f6';
  const borderColor = isViolation ? '#ff4444' : '#4caf50';
  return (
    <div className="process-node editable-node" onMouseEnter={() => data.onHover?.(data.tutorExplanation ?? null)} onMouseLeave={() => data.onHover?.(null)} onDoubleClick={() => data.onEdit?.(String(data.id ?? ''))}
      style={{ padding: '16px 18px', minWidth: '160px', maxWidth: '200px', textAlign: 'center', color: 'white', background: isViolation ? 'linear-gradient(135deg,#2d0a0a,#4a1515)' : isVisited ? 'linear-gradient(135deg,#1a2e1a,#2d4a2d)' : 'linear-gradient(135deg,#1e1e1e,#2d2d2d)', border: `3px solid ${borderColor}`, borderRadius: '6px', fontSize: '12px', fontWeight: '600', position: 'relative', cursor: 'pointer', boxShadow: isViolation ? '0 4px 20px rgba(255,68,68,0.4)' : '0 4px 12px rgba(76,175,80,0.2)', transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)', animation: selected ? 'pulse 1.5s ease-in-out infinite' : 'none' }}>
      <EditHint />
      {isViolation && <div style={{ position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)', fontSize: '20px', animation: 'bounce 1s ease-in-out infinite' }}>⚠️</div>}
      <Handle type="target" position={Position.Top} style={{ background: handleColor, width: '12px', height: '12px', border: '2px solid #0d1117', boxShadow: `0 0 10px ${handleColor}` }} />
      <div style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <strong style={{ display: 'block', fontSize: '13px', marginBottom: data.code ? '6px' : '0', letterSpacing: '0.3px', textShadow: '0 2px 3px rgba(0,0,0,0.6)' }}>{String(data.label ?? 'Process')}</strong>
        {data.code && <code style={{ display: 'block', fontSize: '10px', opacity: 0.9, fontFamily: "'JetBrains Mono','Fira Code',monospace", background: 'rgba(0,0,0,0.4)', padding: '5px 7px', borderRadius: '4px', marginTop: '4px', lineHeight: '1.4', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{String(data.code)}</code>}
      </div>
      <Handle type="source" position={Position.Bottom} style={{ background: handleColor, width: '12px', height: '12px', border: '2px solid #0d1117', boxShadow: `0 0 10px ${handleColor}` }} />
    </div>
  );
};

const DecisionNode = ({ data, selected }: NodeProps<Node<ExtendedNodeData>>) => {
  const isViolation = data.violation ?? false;
  const isVisited = data.visited ?? false;
  const color = isViolation ? '#ff4444' : isVisited ? '#4caf50' : '#ffa726';
  return (
    <div className="decision-node editable-node" onMouseEnter={() => data.onHover?.(data.tutorExplanation ?? null)} onMouseLeave={() => data.onHover?.(null)} onDoubleClick={() => data.onEdit?.(String(data.id ?? ''))}
      style={{ width: '120px', height: '120px', background: isViolation ? 'linear-gradient(135deg,#2d0a0a,#4a1515)' : isVisited ? 'linear-gradient(135deg,#1a2e1a,#2d442d)' : 'linear-gradient(135deg,#1a1a2e,#2d2d44)', border: `3px solid ${color}`, transform: 'rotate(45deg)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', cursor: 'pointer', boxShadow: `0 4px 20px ${isViolation ? 'rgba(255,68,68,0.4)' : isVisited ? 'rgba(76,175,80,0.4)' : 'rgba(255,167,38,0.3)'}`, transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)', animation: selected ? 'pulse 1.5s ease-in-out infinite' : 'none' }}>
      {isViolation && <div style={{ position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%) rotate(-45deg)', fontSize: '20px', animation: 'bounce 1s ease-in-out infinite' }}>⚠️</div>}
      <Handle type="target" position={Position.Top} style={{ background: color, width: '12px', height: '12px', border: '2px solid #0d1117', boxShadow: `0 0 10px ${color}` }} />
      <div style={{ transform: 'rotate(-45deg)', color: 'white', fontSize: '12px', fontWeight: '700', textAlign: 'center', pointerEvents: 'none', maxWidth: '75px', lineHeight: '1.2', textShadow: '0 2px 4px rgba(0,0,0,0.7)' }}>{String(data.label ?? 'Condition')}</div>
      <Handle type="source" position={Position.Bottom} style={{ background: color, width: '12px', height: '12px', border: '2px solid #0d1117', boxShadow: `0 0 10px ${color}` }} />
    </div>
  );
};

const IONode = ({ data, selected }: NodeProps<Node<ExtendedNodeData>>) => {
  const isViolation = data.violation ?? false;
  const isVisited = data.visited ?? false;
  const borderColor = isViolation ? '#ff4444' : isVisited ? '#4caf50' : '#64b5f6';
  const glowColor = isViolation ? 'rgba(255,68,68,0.4)' : isVisited ? 'rgba(76,175,80,0.3)' : 'rgba(100,181,246,0.3)';
  const gradStart = isViolation ? '#4a1515' : isVisited ? '#2d5a2d' : '#2a5298';
  const gradEnd = isViolation ? '#2d0a0a' : isVisited ? '#1a3a1a' : '#1e3a5f';
  return (
    <div className="io-node editable-node" onMouseEnter={() => data.onHover?.(data.tutorExplanation ?? null)} onMouseLeave={() => data.onHover?.(null)} onDoubleClick={() => data.onEdit?.(String(data.id ?? ''))}
      style={{ position: 'relative', width: '180px', height: '70px', cursor: 'pointer', animation: selected ? 'pulse 1.5s ease-in-out infinite' : 'none' }}>
      <EditHint />
      <svg width="180" height="70" viewBox="0 0 180 70" style={{ position: 'absolute', top: 0, left: 0, filter: `drop-shadow(0 4px 20px ${glowColor})` }}>
        <defs>
          <linearGradient id={`io-grad-${data.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: gradStart, stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: gradEnd, stopOpacity: 1 }} />
          </linearGradient>
        </defs>
        <path d="M 20 3 L 160 3 L 170 67 L 30 67 Z" fill={`url(#io-grad-${data.id})`} stroke={borderColor} strokeWidth={selected ? '3' : '2.5'} strokeLinejoin="round" style={{ transition: 'all 0.3s ease' }} />
        <path d="M 20 3 L 160 3 L 170 67 L 30 67 Z" fill="white" opacity="0.05" />
      </svg>
      {isViolation && <div style={{ position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)', fontSize: '20px', animation: 'bounce 1s ease-in-out infinite', zIndex: 10 }}>⚠️</div>}
      <Handle type="target" position={Position.Top} style={{ background: borderColor, width: '12px', height: '12px', border: '2px solid #0d1117', boxShadow: `0 0 10px ${borderColor}`, zIndex: 5 }} />
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '140px', textAlign: 'center', zIndex: 1, pointerEvents: 'none', userSelect: 'none' }}>
        <strong style={{ display: 'block', color: 'white', fontSize: '13px', fontWeight: '700', marginBottom: data.code ? '6px' : '0', textShadow: '0 2px 4px rgba(0,0,0,0.7)', letterSpacing: '0.3px' }}>{String(data.label ?? 'I/O')}</strong>
        {data.code && <code style={{ display: 'block', color: 'rgba(255,255,255,0.9)', fontSize: '10px', fontFamily: "'JetBrains Mono',monospace", background: 'rgba(0,0,0,0.4)', padding: '4px 8px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)' }}>{String(data.code)}</code>}
      </div>
      <Handle type="source" position={Position.Bottom} style={{ background: borderColor, width: '12px', height: '12px', border: '2px solid #0d1117', boxShadow: `0 0 10px ${borderColor}`, zIndex: 5 }} />
    </div>
  );
};

const nodeTypes = { terminator: TerminatorNode, decision: DecisionNode, process: ProcessNode, io: IONode };

const defaultNodeLabel: Record<string, string> = {
  terminator: 'Start',
  process: 'Process',
  decision: 'Condition',
  io: 'Input / Output',
};

// ─── Main FlowGraph ───────────────────────────────────────────────────────────

export const FlowGraph: React.FC<Props> = ({
  cfg,
  safetyChecks = [],
  onNodeClick,
  isDrawerOpen = false,
  onGraphChange,
  onCodeGenerated,
}) => {
  const [nodes, setNodes] = useState<Node<ExtendedNodeData>[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [isInteractive, setIsInteractive] = useState(true);
  const [hoverInfo, setHoverInfo] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [visitedNodes, setVisitedNodes] = useState<Set<string>>(new Set());
  const [editState, setEditState] = useState<EditState | null>(null);

  // ── Edit handlers ──────────────────────────────────────────────────────────

  const handleOpenEdit = useCallback((nodeId: string) => {
    setNodes(current => {
      const node = current.find(n => n.id === nodeId);
      if (node) {
        setEditState({
          nodeId,
          label: String(node.data.label ?? ''),
          code: String(node.data.code ?? ''),
          type: node.type ?? 'process',
        });
      }
      return current;
    });
  }, []);

  const handleSaveEdit = useCallback((newLabel: string, newCode: string) => {
    if (!editState) return;
    setNodes(current => {
      const next = current.map(n =>
        n.id !== editState.nodeId ? n
          : { ...n, data: { ...n.data, label: newLabel || n.data.label, code: newCode } }
      );
      onGraphChange?.(next, edges);
      return next;
    });
    setEditState(null);
  }, [editState, edges, onGraphChange]);

  const handleCancelEdit = useCallback(() => setEditState(null), []);

  // ── Add node from palette ──────────────────────────────────────────────────

  const handleAddNode = useCallback((type: 'terminator' | 'process' | 'decision' | 'io') => {
    const id = newNodeId();
    const newNode: Node<ExtendedNodeData> = {
      id,
      type,
      position: { x: 220 + Math.random() * 160, y: 80 + nodes.length * 28 },
      data: {
        id,
        label: defaultNodeLabel[type],
        code: '',
        line: -1,
        onHover: setHoverInfo,
        onEdit: handleOpenEdit,
      } as ExtendedNodeData,
      draggable: true,
    };
    setNodes(current => {
      const next = [...current, newNode];
      onGraphChange?.(next, edges);
      return next;
    });
    setTimeout(() => setEditState({ nodeId: id, label: defaultNodeLabel[type], code: '', type }), 50);
  }, [nodes.length, edges, onGraphChange, handleOpenEdit]);

  // ── Graph change handlers ──────────────────────────────────────────────────

  const onNodesChangeHandler = useCallback((changes: any) => {
    setNodes(nds => {
      const next = applyNodeChanges(changes, nds);
      onGraphChange?.(next, edges);
      return next;
    });
  }, [edges, onGraphChange]);

  const onEdgesChangeHandler = useCallback((changes: any) => {
    setEdges(eds => {
      const next = applyEdgeChanges(changes, eds);
      onGraphChange?.(nodes, next);
      return next;
    });
  }, [nodes, onGraphChange]);

  const onConnectHandler = useCallback((params: Connection) => {
    setEdges(eds => {
      const next = addEdge({
        ...params,
        type: 'default',
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { stroke: '#64b5f6', strokeWidth: 2 },
        labelStyle: { fill: '#ffffff', fontSize: '11px', fontWeight: '600' },
        labelBgStyle: { fill: '#0d1117', fillOpacity: 0.9 },
        labelBgPadding: [5, 8] as [number, number],
      }, eds);
      onGraphChange?.(nodes, next);
      return next;
    });
  }, [nodes, onGraphChange]);

  const handleNodeClickWithGameLogic = useCallback((_: React.MouseEvent, node: Node<ExtendedNodeData>) => {
    setVisitedNodes(prev => new Set([...prev, node.id]));
    const cfgNode = cfg?.nodes.find(n => n.id === node.id);
    if (cfgNode?.line != null && onNodeClick) onNodeClick(cfgNode.line);
  }, [cfg, onNodeClick]);

  // ── Load CFG into canvas when provided (Code → Graph mode) ────────────────
  // Only runs when a real CFG arrives from the backend. Does NOT run in
  // blank-canvas mode (cfg is undefined). Clears any manually-built graph.

  useEffect(() => {
    if (!cfg?.nodes?.length) return;

    const nodeSizeMap: Record<string, { width: number; height: number }> = {
      decision: { width: 120, height: 120 },
      terminator: { width: 140, height: 60 },
      io: { width: 190, height: 85 },
      process: { width: 180, height: 90 },
    };

    const initialNodes: Node<ExtendedNodeData>[] = cfg.nodes.map(node => {
      const hasViolation = safetyChecks.some(c => c.line === node.line && c.status === 'UNSAFE');
      const label = String(node.label ?? '').toLowerCase();
      let nodeType = 'process';
      if (label === 'start' || label === 'end') nodeType = 'terminator';
      else if (node.type === 'decision') nodeType = 'decision';
      else if (label.includes('input') || label.includes('output') || label.includes('cin') || label.includes('cout')) nodeType = 'io';

      return {
        id: node.id,
        type: nodeType,
        data: { ...node, violation: hasViolation, visited: visitedNodes.has(node.id), onHover: setHoverInfo, onEdit: handleOpenEdit },
        position: { x: 0, y: 0 },
        draggable: true,
      };
    });

    const initialEdges: Edge[] = cfg.edges.map((edge, i) => {
      const targetNode = cfg.nodes.find(n => n.id === edge.to);
      const hasViolation = targetNode && safetyChecks.some(c => c.line === targetNode.line && c.status === 'UNSAFE');
      const isVisited = visitedNodes.has(edge.from) && visitedNodes.has(edge.to);
      const color = hasViolation ? '#ff4444' : isVisited ? '#4caf50' : '#64b5f6';
      return {
        id: `e-${i}`, source: edge.from, target: edge.to, label: edge.label, type: 'default',
        animated: !!(hasViolation || isVisited),
        style: { stroke: color, strokeWidth: hasViolation ? 3 : isVisited ? 2.5 : 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color, width: 20, height: 20 },
        labelStyle: { fill: '#ffffff', fontSize: '11px', fontWeight: '600', fontFamily: 'system-ui,-apple-system,sans-serif' },
        labelBgStyle: { fill: '#0d1117', fillOpacity: 0.9, rx: 4, ry: 4 },
        labelBgPadding: [5, 8] as [number, number],
      };
    });

    elk.layout({
      id: 'root',
      layoutOptions: { 'elk.algorithm': 'layered', 'elk.direction': 'DOWN', 'elk.spacing.nodeNode': '90', 'elk.layered.spacing.nodeNodeBetweenLayers': '120', 'elk.layered.nodePlacement.strategy': 'SIMPLE', 'elk.edgeRouting': 'ORTHOGONAL' },
      children: initialNodes.map(n => ({ id: n.id, ...(nodeSizeMap[n.type ?? 'process'] ?? nodeSizeMap.process) })),
      edges: initialEdges.map(e => ({ id: e.id, sources: [e.source], targets: [e.target] })),
    })
      .then(layout => {
        const layouted = initialNodes.map(n => ({
          ...n,
          position: { x: layout.children?.find(c => c.id === n.id)?.x ?? 0, y: layout.children?.find(c => c.id === n.id)?.y ?? 0 },
        }));
        setNodes(layouted);
        setEdges(initialEdges);
        onGraphChange?.(layouted, initialEdges);
      })
      .catch(err => {
        console.error('ELK layout error:', err);
        const fallback = initialNodes.map((n, i) => ({ ...n, position: { x: 200, y: i * 150 } }));
        setNodes(fallback);
        setEdges(initialEdges);
        onGraphChange?.(fallback, initialEdges);
      });
  }, [cfg, safetyChecks]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-inject fresh callbacks to prevent stale closures
  useEffect(() => {
    setNodes(nds => nds.map(n => ({ ...n, data: { ...n.data, onHover: setHoverInfo, onEdit: handleOpenEdit } })));
  }, [handleOpenEdit]);

  const totalNodes = nodes.length;
  const safeNodes = nodes.filter(n => {
    const cfgNode = cfg?.nodes.find(cn => cn.id === n.id);
    return !cfgNode || !safetyChecks.some(c => c.line === cfgNode.line && c.status === 'UNSAFE');
  }).length;

  // Determine if this is in "build flowchart" mode (no backend CFG driving it)
  const isBuildMode = !cfg;

  return (
    <div onMouseMove={e => setMousePos({ x: e.clientX + 15, y: e.clientY + 15 })} style={{ width: '100%', height: '100%', position: 'relative', background: '#0d1117' }}>
      <FlowchartLegend isDrawerOpen={isDrawerOpen} />

      {/* Only show game stats in analyze mode where CFG comes from the backend */}
      {!isBuildMode && (
        <GameStats visitedNodes={visitedNodes} totalNodes={totalNodes} safeNodes={safeNodes} isDrawerOpen={isDrawerOpen} />
      )}

      <NodePalette onAddNode={handleAddNode} isDrawerOpen={isDrawerOpen} />

      {/* Generate Code panel — only shown in build mode */}
      {isBuildMode && (
        <GenerateCodePanel
          nodes={nodes}
          edges={edges}
          onCodeGenerated={onCodeGenerated}
          isDrawerOpen={isDrawerOpen}
        />
      )}

      <ReactFlow
        nodes={nodes} edges={edges} nodeTypes={nodeTypes}
        onNodesChange={onNodesChangeHandler} onEdgesChange={onEdgesChangeHandler} onConnect={onConnectHandler}
        onNodeClick={handleNodeClickWithGameLogic}
        fitView fitViewOptions={{ padding: 0.25, includeHiddenNodes: true, minZoom: 0.1, maxZoom: 1.0, duration: 800 }}
        nodesConnectable colorMode="dark"
        nodesDraggable={isInteractive} nodesFocusable={isInteractive}
        edgesFocusable={false} panOnDrag={isInteractive} panOnScroll={false}
        selectionOnDrag={isInteractive} selectionKeyCode={null} multiSelectionKeyCode="Shift"
        deleteKeyCode="Backspace"
        zoomOnScroll={isInteractive} zoomOnPinch={isInteractive}
        zoomOnDoubleClick={false}
        minZoom={0.05} maxZoom={2} defaultEdgeOptions={{ type: 'default' }}
      >
        <Background color="#1f2937" gap={16} size={1} style={{ opacity: 0.4 }} />
        <Controls showInteractive onInteractiveChange={setIsInteractive} position="bottom-right" style={{ background: 'rgba(13,17,23,0.9)', border: '1px solid #30363d', borderRadius: '8px' }} />
      </ReactFlow>

      {/* Empty state hint */}
      {nodes.length === 0 && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', gap: '12px' }}>
          <div style={{ fontSize: '48px', opacity: 0.15 }}>🗂</div>
          <div style={{ fontSize: '13px', color: '#484f58', textAlign: 'center', lineHeight: '1.8' }}>
            {isBuildMode ? (
              <>
                <strong style={{ color: '#30363d', display: 'block', marginBottom: '4px' }}>Canvas is empty</strong>
                Use <strong style={{ color: '#58a6ff' }}>➕ ADD NODE</strong> to start building your flowchart,<br />
                then <strong style={{ color: '#a855f7' }}>⚡ GENERATE C++ CODE</strong> to produce source code.
              </>
            ) : (
              <>
                <strong style={{ color: '#30363d', display: 'block', marginBottom: '4px' }}>Canvas is empty</strong>
                Use <strong style={{ color: '#58a6ff' }}>➕ ADD NODE</strong> to build a flowchart from scratch<br />
                or run <strong style={{ color: '#4caf50' }}>SYNC CODE ➔ GRAPH</strong> to generate one from code
              </>
            )}
          </div>
        </div>
      )}

      {hoverInfo && (
        <div style={{ position: 'fixed', top: mousePos.y, left: mousePos.x, pointerEvents: 'none', zIndex: 9999, background: 'linear-gradient(135deg,#1e1e1e,#2d2d2d)', border: '2px solid #ffa726', borderRadius: '8px', padding: '12px', maxWidth: '300px', boxShadow: '0 8px 24px rgba(0,0,0,0.6)', animation: 'fadeIn 0.2s ease-in-out' }}>
          <div style={{ color: '#ffa726', fontWeight: 'bold', fontSize: '10px', textTransform: 'uppercase', marginBottom: '6px', borderBottom: '1px solid #444', paddingBottom: '4px' }}>💡 Mentor Tip</div>
          <div style={{ color: '#e0e0e0', fontSize: '12px', lineHeight: '1.5' }}>{hoverInfo}</div>
        </div>
      )}

      {editState && <NodeEditor editState={editState} onSave={handleSaveEdit} onCancel={handleCancelEdit} />}

      <style>{`
        @keyframes pulse { 0%,100% { transform:scale(1); } 50% { transform:scale(1.05); } }
        @keyframes bounce { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-8px); } }
        @keyframes fadeIn { from { opacity:0; transform:translateY(5px); } to { opacity:1; transform:translateY(0); } }
        @keyframes editorSlideIn { from { opacity:0; transform:translateY(-12px) scale(0.97); } to { opacity:1; transform:translateY(0) scale(1); } }
        .decision-node:hover { transform:rotate(45deg) scale(1.08); }
        .process-node:hover { transform:translateY(-3px); }
        .terminator-node:hover { transform:scale(1.05); }
        .io-node:hover { transform:scale(1.05); }
        .editable-node:hover .edit-hint { opacity:1 !important; }
        .react-flow__node { cursor:grab !important; }
        .react-flow__node.dragging { cursor:grabbing !important; }
        .react-flow__edge-path { stroke-linecap:round; stroke-linejoin:round; }
      `}</style>
    </div>
  );
};