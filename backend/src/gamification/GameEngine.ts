/**
 * Gamification Engine
 * Manages XP calculation, Leveling logic, and Quest progression.
 * Connects the Analysis Results to the User Profile.
 */

import { 
    AnalysisResult, 
    ExplorerProfile, 
    TutorialHint 
} from '../types';

// Level Thresholds (Based on your Thesis methodology)
const LEVEL_THRESHOLDS = {
    1: 0,     // Squire (Beginner)
    2: 100,   // Knight (Intermediate)
    3: 300,   // Duke (Advanced)
    4: 600    // Lord (Master)
};

export class GameEngine {

    /**
     * Calculate XP reward for a code submission
     */
    calculateReward(analysis: AnalysisResult, hintsUsed: number): { xp: number; bonus: number } {
        // 1. Base XP for successful compilation (valid syntax)
        let xp = 10; 

        // 2. Cognitive Complexity scoring (nesting-weighted)
        const cogComplexity = analysis.cognitiveComplexity ?? 0;
        const cogRaw = cogComplexity <= 3
            ? cogComplexity * 2          // up to +6 for simple code
            : -((cogComplexity - 3) * 5); // penalty for high nesting
        xp += cogRaw;

        // 2b. Cyclomatic Complexity scoring
        const cycloScore: number = (analysis as any).cyclomaticComplexity?.score
            ?? (analysis as any).cyclomaticComplexity   // handles plain number
            ?? 1;
        const cycloAdj = cycloScore <= 5 ? 3
            : cycloScore > 10 ? -Math.floor((cycloScore - 10) * 2)
            : 0;
        xp += cycloAdj;

        // 3. Quality Bonus — awarded when there are no compiler errors.
        //    Safety warnings (UNSAFE safetyChecks) deduct from bonus but don't zero it.
        let qualityBonus = 0;
        const errorCount = analysis.errors?.length ?? 0;
        const unsafeCount = (analysis.safetyChecks ?? []).filter((s: any) => s.status === 'UNSAFE').length;

        if (errorCount === 0) {
            // Full bonus for clean code, reduced by unsafe checks (min 5 if any unsafe found)
            qualityBonus = unsafeCount === 0 ? 15 : Math.max(5, 15 - unsafeCount * 3);
        }

        // Apply floor THEN add quality bonus so even heavily penalised but clean code
        // still gets the quality reward.
        xp = Math.max(0, xp) + qualityBonus;

        // 4. Hint penalty (applied last, after quality bonus)
        const hintPenalty = hintsUsed * 5;
        xp = Math.max(0, xp - hintPenalty);

        return { xp, bonus: qualityBonus };
    }

    /**
     * Check if the user has leveled up based on new total XP
     */
    checkLevelUp(currentProfile: ExplorerProfile, earnedXP: number): { newLevel: number; leveledUp: boolean } {
        const totalXP = currentProfile.totalXP + earnedXP;
        let newLevel = currentProfile.currentLevel;

        // Check thresholds
        if (totalXP >= LEVEL_THRESHOLDS[4]) newLevel = 4;
        else if (totalXP >= LEVEL_THRESHOLDS[3]) newLevel = 3;
        else if (totalXP >= LEVEL_THRESHOLDS[2]) newLevel = 2;
        else newLevel = 1;

        return {
            newLevel,
            leveledUp: newLevel > currentProfile.currentLevel
        };
    }

    /**
     * Get the title for a specific level
     */
    getLevelTitle(level: number): string {
        switch (level) {
            case 1: return 'Squire';
            case 2: return 'Knight';
            case 3: return 'Duke';
            case 4: return 'Lord';
            default: return 'Wanderer';
        }
    }

    /**
     * Generate a tutorial hint based on the specific error type found
     * (Mappings from your Thesis "Error-Hint" table)
     */
    generateHint(errorType: string): TutorialHint {
        switch (errorType) {
            case 'lexical':
                return {
                    errorCode: 'LEX_01',
                    clue: "Unknown symbol detected.",
                    explanation: "You used a character that C++ doesn't understand. Check for typos.",
                    xpCost: 2
                };
            case 'syntactic':
                return {
                    errorCode: 'SYN_01',
                    clue: "Check your punctuation.",
                    explanation: "C++ requires semicolons ';' at the end of statements and matching braces '{}' for blocks.",
                    xpCost: 5
                };
            case 'division_by_zero':
                return {
                    errorCode: 'LOG_01',
                    clue: "The denominator is zero.",
                    explanation: "Division by zero is undefined. Ensure your divisor is never 0.",
                    xpCost: 10
                };
            case 'array_out_of_bounds':
                return {
                    errorCode: 'MEM_01',
                    clue: "You stepped outside the array.",
                    explanation: "Arrays are 0-indexed. If size is 5, valid indices are 0 to 4.",
                    xpCost: 10
                };
            case 'uninitialized_variable':
                return {
                    errorCode: 'MEM_02',
                    clue: "Empty variable usage.",
                    explanation: "You are using a variable that hasn't been given a value yet.",
                    xpCost: 5
                };
                case 'recursion':
                    return {
                        errorCode: 'LOG_02',
                        clue: "This function is calling itself.",
                        explanation: "Recursive functions need a base case — a condition where the function stops calling itself. Without it, the program will crash with a stack overflow.",
                        xpCost: 10
                    };
             default:
                return {
                    errorCode: 'GEN_01',
                    clue: "Review the logic flow.",
                    explanation: "Try tracing the code variable by variable.",
                    xpCost: 5
                };
        }
    }
}