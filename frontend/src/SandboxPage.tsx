import { useState, useRef } from 'react'; // Added useRef
import { useNavigate } from 'react-router-dom';
import './layout.css'; 
import { CodeEditor } from './components/Editor/CodeEditor';
import { analyzeCode } from './services/api';
import { FlowGraph } from './components/Visualizer/FlowGraph';
import { TokenDrawer } from './components/Visualizer/TokenDrawer';
import { TokenChart } from './components/Visualizer/TokenChart'; 
import { useAuth } from './components/AuthScreen';
import { DataIsolationService } from './Dataisolationservice';

// Use type-only imports for TS 5.0+ verbatimModuleSyntax
import type { AnalysisResult, SymbolInfo } from './types';

export const SandboxPage = () => {
  const navigate = useNavigate();
  const { user, setUser, isGuest } = useAuth();
  
  // 1. Create a reference to store the Monaco editor instance
  const editorRef = useRef<any>(null);

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

  // 2. Updated highlight logic specifically for Monaco
  const handleNodeClick = (line: number) => {
  if (!editorRef.current) return;

  const editor = editorRef.current;
  const model = editor.getModel(); // Get the current code model
  
  if (model) {
    // Get the length of the specific line to ensure the highlight covers it all
    const lineLength = model.getLineContent(line).length;

    // Apply the selection
    editor.setSelection({
      startLineNumber: line,
      startColumn: 1,
      endLineNumber: line,
      endColumn: lineLength + 1 // Highlight to the very end of the text
    });

    // Scroll and Focus
    editor.revealLineInCenterIfOutsideViewport(line);
    editor.focus();
  }
};

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
            const updatedUser = { 
              ...user, 
              totalXP: (user.totalXP || 0) + xpToEarn 
            };
            
            DataIsolationService.saveUserProgress(user.id, { totalXP: updatedUser.totalXP });
            setUser(updatedUser);
        }
    } catch (error) {
        console.error("Analysis failed:", error);
    } finally {
        setIsAnalyzing(false);
    }
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
        
        <div className="header-actions">
           {result?.gamification && (
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
        <div className="left-column">
          <section className="editor-section">
            <div className="section-title">SOURCE CODE INPUT</div>
            <div className="editor-container">
              {/* 3. Pass the editor instance to our Ref on mount */}
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
                        <pre className="ast-json-code">
                          {JSON.stringify(result.ast, null, 2)}
                        </pre>
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
                  ) : 
                  result?.symbolicExecution && result.symbolicExecution.length > 0 ? (
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
      </main>

      <TokenDrawer 
        tokens={result?.tokens || []} 
        isOpen={isTokenDrawerOpen} 
        onClose={() => setIsTokenDrawerOpen(false)} 
      />
    </div>
  );
};