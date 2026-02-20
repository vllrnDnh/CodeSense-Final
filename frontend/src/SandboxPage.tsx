import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './layout.css'; 
import { CodeEditor } from './components/Editor/CodeEditor';
import { analyzeCode } from './services/api';
import { FlowGraph } from './components/Visualizer/FlowGraph';
import { TokenDrawer } from './components/Visualizer/TokenDrawer';
import { TokenChart } from './components/Visualizer/TokenChart'; 
import { useAuth } from './components/AuthScreen';
import { DataIsolationService } from './Dataisolationservice';

import type { AnalysisResult, SymbolInfo } from './types';

// ─── Mode type ────────────────────────────────────────────────────────────────

type AppMode = 'analyze' | 'build';

// ─── Mode Toggle ──────────────────────────────────────────────────────────────

const ModeToggle: React.FC<{ mode: AppMode; onChange: (m: AppMode) => void }> = ({ mode, onChange }) => (
  <div style={{
    display: 'flex',
    gap: 0,
    background: 'rgba(13,17,23,0.95)',
    border: '1px solid #30363d',
    borderRadius: '10px',
    padding: '3px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.4)',
  }}>
    {([
      { id: 'analyze' as AppMode, label: '🔍 Analyze Code', activeColor: '#4caf50' },
      { id: 'build'   as AppMode, label: '🎨 Build Flowchart', activeColor: '#a855f7' },
    ]).map(({ id, label, activeColor }) => (
      <button
        key={id}
        onClick={() => onChange(id)}
        style={{
          padding: '7px 16px',
          borderRadius: '8px',
          border: 'none',
          fontSize: '12px',
          fontWeight: '700',
          cursor: 'pointer',
          letterSpacing: '0.3px',
          transition: 'all 0.2s',
          background: mode === id
            ? `linear-gradient(135deg,${activeColor}cc,${activeColor}88)`
            : 'transparent',
          color: mode === id ? 'white' : '#8b949e',
          boxShadow: mode === id ? `0 2px 10px ${activeColor}44` : 'none',
        }}
      >
        {label}
      </button>
    ))}
  </div>
);

// ─── Build Flowchart Panel ────────────────────────────────────────────────────
// Shown on the LEFT side in build mode. Displays the generated code and lets
// the user copy or open it in the editor — completely independent of the
// backend analyzeCode() call.

const GeneratedCodeViewer: React.FC<{
  code: string;
  onLoadInEditor: (code: string) => void;
}> = ({ code, onLoadInEditor }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  if (!code) {
    return (
      <div className="placeholder-text" style={{ padding: '20px', textAlign: 'center', color: '#484f58', lineHeight: '1.8' }}>
        <div style={{ fontSize: '32px', marginBottom: '10px', opacity: 0.3 }}>⚡</div>
        <strong style={{ display: 'block', color: '#30363d', marginBottom: '6px' }}>No code generated yet</strong>
        Build a flowchart on the right, then click<br />
        <strong style={{ color: '#a855f7' }}>⚡ GENERATE C++ CODE</strong> in the canvas panel.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ fontSize: '11px', color: '#a855f7', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          ⚡ Generated C++ Code
        </div>
        <div style={{ fontSize: '10px', color: '#484f58', marginLeft: 'auto' }}>from flowchart</div>
      </div>

      <div style={{
        flex: 1,
        overflow: 'auto',
        background: '#0d1117',
        border: '1px solid rgba(168,85,247,0.35)',
        borderRadius: '8px',
        padding: '14px',
      }}>
        <pre style={{
          margin: 0,
          fontSize: '12px',
          color: '#c9d1d9',
          fontFamily: "'JetBrains Mono','Fira Code',monospace",
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          lineHeight: '1.7',
        }}>
          {code}
        </pre>
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={handleCopy}
          style={{
            flex: 1,
            padding: '9px',
            borderRadius: '8px',
            border: '1px solid rgba(168,85,247,0.5)',
            background: copied ? 'rgba(76,175,80,0.15)' : 'rgba(168,85,247,0.1)',
            color: copied ? '#4caf50' : '#a855f7',
            fontSize: '12px',
            fontWeight: '700',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          {copied ? '✓ Copied!' : '📋 Copy Code'}
        </button>
        <button
          onClick={() => onLoadInEditor(code)}
          style={{
            flex: 1,
            padding: '9px',
            borderRadius: '8px',
            border: '1px solid rgba(76,175,80,0.5)',
            background: 'rgba(76,175,80,0.1)',
            color: '#4caf50',
            fontSize: '12px',
            fontWeight: '700',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
          title="Switch to Analyze mode and load this code into the editor"
        >
          🔍 Load &amp; Analyze
        </button>
      </div>

      <div style={{ fontSize: '10px', color: '#484f58', textAlign: 'center' }}>
        "Load &amp; Analyze" switches to Analyze mode and populates the editor with this code.
      </div>
    </div>
  );
};

// ─── SandboxPage ──────────────────────────────────────────────────────────────

export const SandboxPage = () => {
  const navigate = useNavigate();
  const { user, setUser, isGuest } = useAuth();

  const editorRef = useRef<any>(null);

  // ── Shared state ──────────────────────────────────────────────────────────

  /** Which feature is active: "analyze" (Code → Graph) or "build" (Graph → Code) */
  const [mode, setMode] = useState<AppMode>('analyze');

  const [code, setCode] = useState<string>(
`#include <iostream>
using namespace std;

int main() {
    int hp = 100;
    int damage = 0;
    cout<<"Hello,World!";
    // Safety Risk: Division by Zero
    int risk = hp / damage; 
    while (hp > 0) {
        hp = hp - 10;
    }
    return 0;
}`
  );

  // ── Analyze mode state ────────────────────────────────────────────────────

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [isTokenDrawerOpen, setIsTokenDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('lexical');

  // ── Build mode state ──────────────────────────────────────────────────────

  /** C++ code generated from the user-built flowchart */
  const [builtCode, setBuiltCode] = useState<string>('');

  // ── Handlers ──────────────────────────────────────────────────────────────

  /** Called when a node in the CFG is clicked — highlights that line in Monaco */
  const handleNodeClick = (line: number) => {
    if (!editorRef.current) return;
    const editor = editorRef.current;
    const model = editor.getModel();
    if (model) {
      const lineLength = model.getLineContent(line).length;
      editor.setSelection({ startLineNumber: line, startColumn: 1, endLineNumber: line, endColumn: lineLength + 1 });
      editor.revealLineInCenterIfOutsideViewport(line);
      editor.focus();
    }
  };

  /** Sends current code to the backend for analysis (Analyze mode only) */
  const handleAnalyze = async () => {
    if (!user && !isGuest) return;

    const userId = isGuest ? null : user?.id || null;
    DataIsolationService.saveSandboxCode(userId, code, 'main.cpp');

    setIsAnalyzing(true);
    try {
      const data = await analyzeCode(code);
      setResult(data);
      if (data.success && user) {
        const xpToEarn = data.gamification?.xpEarned || 10;
        const updatedUser = { ...user, totalXP: (user.totalXP || 0) + xpToEarn };
        DataIsolationService.saveUserProgress(user.id, { totalXP: updatedUser.totalXP });
        setUser(updatedUser);
      }
    } catch (error) {
      console.error('Analysis failed:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  /**
   * Called by the GenerateCodePanel inside FlowGraph (build mode).
   * Stores the code for display in the left panel.
   */
  const handleCodeGenerated = (generatedCode: string) => {
    setBuiltCode(generatedCode);
  };

  /**
   * Called when the user clicks "Load & Analyze" in the generated code viewer.
   * Switches to analyze mode and populates the editor with the generated code.
   */
  const handleLoadInEditor = (generatedCode: string) => {
    setCode(generatedCode);
    setMode('analyze');
    // Clear previous results so the new code isn't confused with old data
    setResult(null);
  };

  /** Switch modes — preserve all state, just change the view */
  const handleModeChange = (newMode: AppMode) => {
    setMode(newMode);
  };

  const getSymbolList = (): SymbolInfo[] => {
    if (!result?.symbolTable) return [];
    return Array.isArray(result.symbolTable) ? result.symbolTable : Object.values(result.symbolTable);
  };

  const symbols = getSymbolList();

  return (
    <div className="app-container">
      <header className="app-header">
        <div
          className="header-brand"
          onClick={() => navigate('/home')}
          style={{ cursor: 'pointer' }}
          title="Return to Dashboard"
        >
          <span className="brand-icon">📦</span>
          <span className="brand-text">CodeSense Sandbox</span>
        </div>

        {/* ── Mode toggle — centre of header ── */}
        <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
          <ModeToggle mode={mode} onChange={handleModeChange} />
        </div>

        <div className="header-actions">
          {result?.gamification && mode === 'analyze' && (
            <span className="badge-xp" style={{ marginRight: '15px', color: '#ffc107', fontWeight: 'bold' }}>
              ★ {result.gamification.xpEarned} XP | {result.gamification.levelTitle.toUpperCase()}
            </span>
          )}
          <button
            className="exit-btn"
            onClick={() => navigate('/home')}
            title="Back to Dashboard"
          >
            EXIT ⎋
          </button>
        </div>
      </header>

      <main className="main-layout">

        {/* ════════════════════════════════════════════════════════════════
            ANALYZE MODE — Code editor on the left, CFG on the right
        ════════════════════════════════════════════════════════════════ */}
        {mode === 'analyze' && (
          <>
            <div className="left-column">
              <section className="editor-section">
                <div className="section-title">SOURCE CODE INPUT</div>
                <div className="editor-container">
                  <CodeEditor
                    code={code}
                    onChange={setCode}
                    onEditorMount={(editor) => (editorRef.current = editor)}
                  />
                </div>
                <div className="action-bar">
                  <button onClick={handleAnalyze} disabled={isAnalyzing} className="analyze-btn">
                    {isAnalyzing ? 'RE-CALIBRATING...' : 'ANALYZE CODE'}
                  </button>
                </div>
              </section>

              <section className="tabs-section">
                <div className="tab-headers">
                  {['lexical', 'syntactic', 'symbols', 'math', 'logs'].map((tab, idx) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={activeTab === tab ? 'tab-link active' : 'tab-link'}
                    >
                      {idx + 1}. {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                  ))}
                </div>

                <div className="tab-content">
                  {activeTab === 'lexical' && (
                    <div className="tab-view-scroll">
                      {result?.tokens ? (
                        <div className="token-integration">
                          <TokenChart tokens={result.tokens} />
                          <div className="token-action-footer">
                            <button onClick={() => setIsTokenDrawerOpen(true)} className="view-all-tokens-btn">
                              Open Token Drawer ➜
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="placeholder-text">Run analysis to view Lexical Distribution.</div>
                      )}
                    </div>
                  )}

                  {activeTab === 'syntactic' && (
                    <div className="tab-view-scroll">
                      {result?.ast ? (
                        <div className="ast-viewer">
                          <pre className="ast-json-code">{JSON.stringify(result.ast, null, 2)}</pre>
                        </div>
                      ) : (
                        <div className="placeholder-text">NO SYNTACTIC DATA DETECTED.</div>
                      )}
                    </div>
                  )}

                  {activeTab === 'symbols' && (
                    <div className="tab-view-scroll">
                      {symbols.length > 0 ? (
                        <table className="symbol-table">
                          <thead>
                            <tr><th>Type</th><th style={{ textAlign: 'center' }}>Variable</th><th style={{ textAlign: 'right' }}>Line</th></tr>
                          </thead>
                          <tbody>
                            {symbols.map((symbol, i) => (
                              <tr key={i}>
                                <td className="symbol-type">{symbol.type}</td>
                                <td className="symbol-name">{symbol.name}</td>
                                <td className="symbol-line">{symbol.line}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <div className="placeholder-text">NO SYMBOLS DETECTED.</div>
                      )}
                    </div>
                  )}

                  {activeTab === 'math' && (
                    <div className="tab-view-scroll">
                      {result?.safetyChecks?.some(check => check.status === 'UNSAFE') ? (
                        <div className="math-error-container">
                          <h4 className="math-error-title">⚠️ SYMBOLIC EXECUTION ERROR</h4>
                          {result.safetyChecks
                            .filter(check => check.status === 'UNSAFE')
                            .map((error, i) => (
                              <div key={`err-${i}`} className="math-error-card">
                                <div className="math-error-loc">Line {error.line}: {error.operation}</div>
                                <div className="math-error-msg">{error.message}</div>
                                <div className="math-error-trace" style={{ color: '#ffa726', fontSize: '11px', marginTop: '5px' }}>
                                  Status: <strong>CRITICAL FAILURE</strong>
                                </div>
                              </div>
                            ))}
                        </div>
                      ) : result?.symbolicExecution && result.symbolicExecution.length > 0 ? (
                        <table className="math-table">
                          <thead>
                            <tr><th>Expression</th><th style={{ textAlign: 'right' }}>Value</th></tr>
                          </thead>
                          <tbody>
                            {result.symbolicExecution.map((entry, i) => (
                              <tr key={`math-${i}`}>
                                <td className="math-expr">{entry.expression}</td>
                                <td className="math-value">{entry.value}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <div className="placeholder-text">NO MATHEMATICAL DATA DETECTED.</div>
                      )}
                    </div>
                  )}

                  {activeTab === 'logs' && (
                    <div className="tab-view-scroll">
                      <div className="terminal-container">
                        <div className="terminal-header" style={{ color: '#ffa726', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '10px' }}>
                          🛰️ System Analysis Report
                        </div>
                        <div className="terminal-output" style={{ background: '#000', borderRadius: '6px', padding: '15px', border: '1px solid #333' }}>
                          {result?.explanations && result.explanations.length > 0 ? (
                            result.explanations.map((exp, i) => (
                              <div key={i} className="log-entry" style={{ color: exp.includes('❌') ? '#f85149' : exp.includes('✅') ? '#3fb950' : '#c9d1d9' }}>
                                <span style={{ opacity: 0.5, marginRight: '10px' }}>➜</span> {exp}
                              </div>
                            ))
                          ) : (
                            <div style={{ color: '#484f58', fontStyle: 'italic', fontSize: '13px' }}>System idle... Waiting for analysis.</div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            </div>

            <div className="right-column">
              <div className="section-title">CONTROL FLOW GRAPH</div>
              <div className="visualizer-container">
                {result?.success && result.cfg ? (
                  <FlowGraph
                    cfg={result.cfg}
                    safetyChecks={result.safetyChecks}
                    onNodeClick={handleNodeClick}
                    isDrawerOpen={isTokenDrawerOpen}
                  />
                ) : (
                  <div className="placeholder-msg">Run analysis to generate Control Flow Graph</div>
                )}
              </div>
            </div>
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════
            BUILD MODE — Generated code viewer on the left, blank canvas on the right
            The two sides are completely independent of the backend.
        ════════════════════════════════════════════════════════════════ */}
        {mode === 'build' && (
          <>
            <div className="left-column">
              <section className="editor-section" style={{ flex: 1 }}>
                <div className="section-title" style={{ color: '#a855f7' }}>
                  GENERATED C++ OUTPUT
                </div>
                <div className="editor-container" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <GeneratedCodeViewer
                    code={builtCode}
                    onLoadInEditor={handleLoadInEditor}
                  />
                </div>
              </section>

              {/* Build-mode tip card */}
              <div style={{
                margin: '0 0 12px 0',
                padding: '14px 16px',
                background: 'linear-gradient(135deg,rgba(168,85,247,0.08),rgba(168,85,247,0.04))',
                border: '1px solid rgba(168,85,247,0.25)',
                borderRadius: '10px',
                fontSize: '11px',
                color: '#8b949e',
                lineHeight: '1.7',
              }}>
                <strong style={{ color: '#a855f7', display: 'block', marginBottom: '4px' }}>🎨 Build Flowchart Mode</strong>
                Use <strong style={{ color: '#58a6ff' }}>ADD NODE →</strong> on the canvas to build your logic,
                double-click nodes to write C++ statements, connect them with edges, then hit
                <strong style={{ color: '#a855f7' }}> ⚡ GENERATE C++ CODE</strong>.<br /><br />
                Click <strong style={{ color: '#4caf50' }}>🔍 Load &amp; Analyze</strong> to send the result to the analyzer.
              </div>
            </div>

            <div className="right-column">
              <div className="section-title" style={{ color: '#a855f7' }}>
                FLOWCHART CANVAS
              </div>
              <div className="visualizer-container">
                {/*
                  No `cfg` prop → FlowGraph starts with a blank canvas.
                  The built-in GenerateCodePanel (shown inside FlowGraph when cfg is absent)
                  calls onCodeGenerated, which feeds the left panel.
                */}
                <FlowGraph
                  onCodeGenerated={handleCodeGenerated}
                />
              </div>
            </div>
          </>
        )}
      </main>

      {/* Token drawer is only relevant in analyze mode */}
      {mode === 'analyze' && (
        <TokenDrawer
          tokens={result?.tokens || []}
          isOpen={isTokenDrawerOpen}
          onClose={() => setIsTokenDrawerOpen(false)}
        />
      )}
    </div>
  );
};