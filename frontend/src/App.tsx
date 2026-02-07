import { useState } from 'react';
import './layout.css';
import { CodeEditor } from './components/Editor/CodeEditor';
import { analyzeCode } from './services/api';
import { FlowGraph } from './components/Visualizer/FlowGraph';
import { TokenDrawer } from './components/Visualizer/TokenDrawer';
import { TokenChart } from './components/Visualizer/TokenChart'; 
import type { AnalysisResult, SymbolInfo } from './types';

function App() {
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

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [isTokenDrawerOpen, setIsTokenDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('lexical');

  // Highlights code line when graph node is clicked
  const handleNodeClick = (line: number) => {
    const textarea = document.querySelector('textarea');
    if (!textarea) return;
    const lines = code.split('\n');
    let characterPos = 0;
    for (let i = 0; i < line - 1; i++) {
      characterPos += lines[i].length + 1;
    }
    textarea.focus();
    textarea.setSelectionRange(characterPos, characterPos + lines[line - 1].length);
    const lineHeight = 20; 
    textarea.scrollTop = (line - 1) * lineHeight;
  };

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    try {
        const data = await analyzeCode(code);
        setResult(data);
    } catch (error) {
        alert("System Offline: Unable to connect to backend.");
    } finally {
        setIsAnalyzing(false);
    }
  };

  // Safely converts SymbolTable Record or Array to a flat list for the UI
  const getSymbolList = (): SymbolInfo[] => {
    if (!result?.symbolTable) return [];
    if (Array.isArray(result.symbolTable)) return result.symbolTable;
    return Object.values(result.symbolTable);
  };

  const symbols = getSymbolList();

  return (
    <div className="app-container">
      {/* HEADER HUD: Integrated Gamification */}
      <header className="app-header">
        <div className="header-brand">
          <span className="brand-icon">📦</span> 
          <span className="brand-text">CodeSense Sandbox</span>
        </div>
        <div className="header-actions">
           {result?.gamification && (
            <span className="badge-xp">
              ★ {result.gamification.xpEarned} XP | {result.gamification.levelTitle.toUpperCase()}
            </span>
          )}
           <button className="exit-btn">⎋</button>
        </div>
      </header>

      {/* MAIN LAYOUT: TWO COLUMNS */}
      <main className="main-layout">
        
        {/* LEFT COLUMN: EDITOR & TABS */}
        <div className="left-column">
          <section className="editor-section">
            <div className="section-title">SOURCE CODE INPUT</div>
            <div className="editor-container">
              <CodeEditor code={code} onChange={setCode} />
            </div>
            <div className="action-bar">
              <button onClick={handleAnalyze} disabled={isAnalyzing} className="analyze-btn">
                {isAnalyzing ? 'RE-CALIBRATING...' : 'ANALYZE CODE'}
              </button>
            </div>
          </section>

          <section className="tabs-section">
            <div className="tab-headers">
              <button onClick={() => setActiveTab('lexical')} className={activeTab === 'lexical' ? 'tab-link active' : 'tab-link'}>1. Lexical</button>
              <button onClick={() => setActiveTab('syntactic')} className={activeTab === 'syntactic' ? 'tab-link active' : 'tab-link'}>2. Syntactic</button>
              <button onClick={() => setActiveTab('symbols')} className={activeTab === 'symbols' ? 'tab-link active' : 'tab-link'}>3. Symbols</button>
              <button onClick={() => setActiveTab('math')} className={activeTab === 'math' ? 'tab-link active' : 'tab-link'}>4. Math</button>
              <button onClick={() => setActiveTab('logs')} className={activeTab === 'logs' ? 'tab-link active' : 'tab-link'}>5. Logs</button>
            </div>
            
            <div className="tab-content">
               {/* 1. LEXICAL TAB */}
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

               {/* 2. SYNTACTIC TAB */}
               {activeTab === 'syntactic' && (
                 <div className="tab-view-scroll syntactic-bg">
                    {result?.ast ? (
                      <div className="ast-viewer">
                        <pre className="ast-json-code">
                          {JSON.stringify(result.ast, null, 2)}
                        </pre>
                      </div>
                    ) : (
                      <div className="placeholder-text">NO SYNTACTIC DATA DETECTED.</div>
                    )}
                 </div>
               )}

               {/* 3. SYMBOLS TAB */}
               {activeTab === 'symbols' && (
                 <div className="tab-view-scroll">
                    {symbols.length > 0 ? (
                      <table className="symbol-table">
                        <thead>
                          <tr><th>Type</th><th style={{textAlign:'center'}}>Variable</th><th style={{textAlign:'right'}}>Line</th></tr>
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

               {/* 4. MATH TAB (SYMBOLIC EXECUTION & ERRORS) */}
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
                            <div className="math-error-trace">Status: <strong>CRITICAL FAILURE</strong></div>
                          </div>
                        ))}
                    </div>
                  ) : 
                  result?.symbolicExecution && result.symbolicExecution.length > 0 ? (
                    <table className="math-table">
                      <thead>
                        <tr>
                          <th>Expression</th>
                          <th style={{ textAlign: 'right' }}>Resolved Value</th>
                        </tr>
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
                    <div className="placeholder-text">
                      {isAnalyzing ? "Analyzing paths..." : "NO MATHEMATICAL DATA DETECTED."}
                    </div>
                  )}
                </div>
              )}

               {/* 5. LOGS TAB - High-Level Status Terminal */}
               {activeTab === 'logs' && (
                 <div className="tab-view-scroll">
                    <div className="terminal-container" style={{ padding: '15px' }}>
                      <div className="terminal-header" style={{ color: '#ffa726', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '10px', letterSpacing: '1px' }}>
                        🛰️ System Analysis Report
                      </div>
                      
                      <div className="terminal-output" style={{ background: '#121212', borderRadius: '6px', padding: '15px', border: '1px solid #333' }}>
                        {result?.explanations && result.explanations.length > 0 ? (
                          result.explanations.map((exp, i) => (
                            <div 
                              key={i} 
                              className="log-entry" 
                              style={{ 
                                color: exp.includes('❌') ? '#ff4444' : exp.includes('✅') ? '#4caf50' : '#e0e0e0',
                                fontFamily: "'JetBrains Mono', monospace",
                                fontSize: '13px',
                                margin: '8px 0',
                                lineHeight: '1.5'
                              }}
                            >
                              <span style={{ opacity: 0.5, marginRight: '10px' }}>➜</span>
                              {exp}
                            </div>
                          ))
                        ) : (
                          <div style={{ color: '#666', fontStyle: 'italic', fontSize: '13px' }}>
                            System idle... Waiting for code analysis.
                          </div>
                        )}
                      </div>

                      {result?.success && (
                        <div style={{ marginTop: '15px', padding: '10px', background: 'rgba(255, 167, 38, 0.1)', borderRadius: '4px', borderLeft: '3px solid #ffa726' }}>
                          <p style={{ color: '#ffa726', fontSize: '12px', margin: 0 }}>
                            <strong>Mentor Tip:</strong> Interactive explanations have been moved! 
                            Hover over the blocks in the <strong>Control Flow Graph</strong> (right panel) to see step-by-step logic.
                          </p>
                        </div>
                      )}
                    </div>
                 </div>
               )}
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN: VISUALIZER */}
        <div className="right-column">
          <div className="section-title">CONTROL FLOW GRAPH</div>
          <div className="visualizer-container">
             {result?.success && result.cfg ? (
                <FlowGraph 
                  cfg={result.cfg} 
                  safetyChecks={result.safetyChecks} 
                  onNodeClick={handleNodeClick}
                /> 
             ) : (
                <div className="placeholder-msg">Graph area</div>
             )}
          </div>
        </div>
      </main>

      <TokenDrawer 
        tokens={result?.tokens || []} 
        isOpen={isTokenDrawerOpen} 
        onClose={() => setIsTokenDrawerOpen(false)} 
      />
    </div>
  );
}

export default App;