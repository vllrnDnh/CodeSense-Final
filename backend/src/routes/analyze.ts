import { Router } from 'express';
import { tokenize } from '../analysis/lexer';
import { TypeChecker } from '../analysis/typechecker';
import { SymbolicExecutor } from '../analysis/symbolicexe';
import { CFGGenerator } from '../analysis/cfgGenerator';
import { CognitiveComplexity } from '../analysis/scoring';
import type { AnalysisResult, AnalysisError } from '../types';
import { Translator } from '../analysis/translator';
import { GameEngine } from '../gamification/GameEngine';

const parser = require('../analysis/parser');
const router = Router();

router.post('/analyze', (req, res) => {
    const { sourceCode } = req.body;
    console.log("\n--- [DEBUG] New Analysis Request ---");
    console.log("Source Snippet:", sourceCode.substring(0, 50).replace(/\n/g, ' '));
    
    // PHASE 1: Lexical Analysis
    const lexResult = tokenize(sourceCode);
    let ast: any = null;

    try {
        if (lexResult.errors.length > 0) {
            console.log("❌ Lexical Errors Found:", lexResult.errors.length);
            return res.status(200).json({
                success: false,
                tokens: lexResult.tokens,
                ast: null,
                symbolTable: {},
                errors: lexResult.errors.map(err => ({ ...err, type: 'lexical', severity: 'error' })),
                cognitiveComplexity: 0,
                safetyChecks: [],
                cfg: { nodes: [], edges: [] },
                symbolicExecution: [],
                explanations: ["❌ **Status:** Lexical Analysis Failed."]
            });
        }

        // PHASE 2: Syntactic Analysis
        ast = parser.parse(sourceCode);
        
        // ====================================================================
        // STRICT C++ DEPENDENCY VALIDATION
        // ====================================================================
        const usesCout = /\bcout\b/.test(sourceCode);
        const usesCin = /\bcin\b/.test(sourceCode);
        const usesExplicitStd = sourceCode.includes('std::');
        const requiresIostream = usesCout || usesCin || usesExplicitStd;

        const hasIostreamInclude = ast.directives && ast.directives.some((d: any) => d.type === 'Include' && d.name === 'iostream');
        const hasStdNamespace = ast.namespace && ast.namespace.name === 'std';

        console.log("--- Dependency Check ---");
        console.log("Requires Iostream:", requiresIostream);
        console.log("Has #include <iostream>:", hasIostreamInclude);
        console.log("Has namespace std:", hasStdNamespace);
        console.log("Uses std:: explicit:", usesExplicitStd);

        const strictErrors: AnalysisError[] = [];

        if (requiresIostream) {
            if (!hasIostreamInclude) {
                strictErrors.push({
                    type: 'semantic',
                    severity: 'error',
                    message: "Strict Error: 'cout/cin' requires '#include <iostream>'",
                    line: 1, column: 1
                });
            }
            if (!usesExplicitStd && !hasStdNamespace && (usesCout || usesCin)) {
                strictErrors.push({
                    type: 'semantic',
                    severity: 'error',
                    message: "Strict Error: 'cout/cin' requires 'using namespace std;'",
                    line: 2, column: 1
                });
            }
        }

        if (strictErrors.length > 0) {
            console.log("🚨 Strict Errors Found:", strictErrors.map(e => e.message));
            return res.status(200).json({
                success: false,
                tokens: lexResult.tokens,
                ast: ast,
                symbolTable: {},
                safetyChecks: [],
                cfg: { nodes: [], edges: [] },
                symbolicExecution: [],
                cognitiveComplexity: 0,
                explanations: ["❌ **Status:** Strict Dependency Check Failed."],
                errors: strictErrors.map(err => ({ ...err, type: 'semantic' }))
            });
        }

        // PHASE 3: Semantic Analysis
        console.log("--- Semantic Phase ---");
        const typeChecker = new TypeChecker();
        const typeResult = typeChecker.check(ast);
        const semanticErrors = typeResult.errors.filter(e => e.severity === 'error');
        
        if (semanticErrors.length > 0) {
            console.log("❌ Semantic Errors:", semanticErrors.length);
            return res.status(200).json({
                success: false,
                tokens: lexResult.tokens,
                ast: ast,
                symbolTable: typeResult.symbolTable,
                safetyChecks: [],
                cfg: { nodes: [], edges: [] },
                symbolicExecution: [],
                cognitiveComplexity: 0,
                explanations: ["❌ **Status:** Semantic Analysis Failed"],
                errors: typeResult.errors
            });
        }

        // PHASE 4: Logic, Safety, and Control Flow
        console.log("--- Logic & Safety Phase ---");
        
        // Symbolic Execution (catches division by zero, negative indices, etc.)
        const executor = new SymbolicExecutor(typeResult.symbolTable);
        const safetyChecks = executor.execute(ast);
        
        // Generate Control Flow Graph
        const cfgGenerator = new CFGGenerator();
        const cfg = cfgGenerator.generate(ast);
        console.log("✅ CFG Generated with", cfg.nodes?.length || 0, "nodes");
        
        // Generate Mentor Explanations
        const translator = new Translator();
        const mentorExplanations = translator.translate(ast);
        
        // Calculate Complexity Score
        const scorer = new CognitiveComplexity();
        const score = scorer.calculate(ast);
        
        // Gamification Rewards
        const gameEngine = new GameEngine();
        const reward = gameEngine.calculateReward({ 
            cognitiveComplexity: score, 
            errors: [], 
            safetyChecks: safetyChecks 
        } as any, req.body.hintsUsed || 0);

        // COMPLETE RESPONSE WITH ALL FIELDS
        console.log("✅ Analysis Complete - Success!");
        res.json({
            success: true,
            tokens: lexResult.tokens,
            ast: ast,
            symbolTable: typeResult.symbolTable,
            safetyChecks: safetyChecks,
            cfg: cfg,
            symbolicExecution: [], // Not implemented in SymbolicExecutor yet
            cognitiveComplexity: score,
            explanations: mentorExplanations,
            gamification: {
                xpEarned: reward.xp,
                qualityBonus: reward.bonus,
                levelTitle: gameEngine.getLevelTitle(Math.floor(reward.xp / 100) + 1)
            },
            errors: [] // No errors on success
        });

    } catch (e: any) {
        console.log("🔥 Syntax/Runtime Crash:", e.message);
        const syntaxError: AnalysisError = {
            type: 'syntactic',
            message: e.message,
            line: e.location?.start.line || 1,
            column: e.location?.start.column || 1,
            severity: 'error'
        };

        res.status(200).json({
            success: false,
            tokens: lexResult.tokens,
            ast: null,
            symbolTable: {},
            errors: [syntaxError],
            cognitiveComplexity: 0,
            safetyChecks: [],
            cfg: { nodes: [], edges: [] },
            symbolicExecution: [],
            explanations: ["❌ **Status:** Syntax Error Detected."]
        });
    }
});

export default router;