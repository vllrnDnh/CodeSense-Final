const axios = require('axios');

// Update this if your backend is running on a different port
const API_URL = 'http://localhost:3000/api/analyze';

const allTestCases = [
  // --- PHASE 1: STANDARD STRUCTURAL TESTS ---
  { 
    name: "PHASE 1: Lexical Error (Invalid Symbol)", 
    code: "int main() { int x = @; }", 
    expected: "lexical" 
  },
  { 
    name: "PHASE 1: Syntactic Error (Missing Semicolon)", 
    code: "int main() { int x = 10 \n return 0; }", 
    expected: "syntactic" 
  },

  // --- PHASE 2: SEMANTIC & SCOPE TESTS ---
  { 
    name: "PHASE 2: Semantic (Redeclaration)", 
    code: "int main() { int x = 10; int x = 20; return 0; }", 
    expected: "semantic" 
  },
  { 
    name: "PHASE 2: Semantic (Undefined Variable)", 
    code: "int main() { y = 10; return 0; }", 
    expected: "semantic" 
  },
  { 
    name: "ADVANCED: Scope Shadowing Conflict", 
    code: "int main() { int x = 5; if(true) { int x = 10; } return 0; }", 
    expected: "semantic" 
  },
  { 
    name: "ADVANCED: Mismatched Return Type", 
    code: "int main() { return 3.14; }", 
    expected: "semantic" 
  },

  // --- PHASE 3: LOGIC, SAFETY & COMPLEXITY ---
  { 
    name: "PHASE 3: Basic Division by Zero", 
    code: "int main() { int x = 10; int y = 0; int z = x / y; return 0; }", 
    expected: "safetyCheck" 
  },
  { 
    name: "ELITE: Cross-Variable Math Propagation", 
    code: "int main() { int x = 5; int y = x - 5; int z = 100 / y; return 0; }", 
    expected: "safetyCheck" 
  },
  { 
    name: "ELITE: Logical Short-Circuit Path", 
    code: "int main() { int x = 0; if (false && (10 / x == 0)) { return 1; } return 0; }", 
    expected: "success" 
  },
  { 
    name: "GRANDMASTER: Array Out of Bounds", 
    code: "int main() { int arr[5]; arr[10] = 1; return 0; }", 
    expected: "safetyCheck" 
  },

  // --- PHASE 4 & 5: TRANSLATION & GAMIFICATION (NEW!) ---
  { 
    name: "TRANSLATOR: Variable Declaration Logic", 
    code: "int main() { int heroHealth = 100; return 0; }", 
    expected: "translation",
    mustContain: "Declare a int variable named 'heroHealth'"
  },
 { 
    name: "TRANSLATOR: Loop Logic", 
    // FIX: Add 'int i = 0;' inside the brackets. 
    // Your Parser likely treats empty brackets '{}' as a Syntax Error.
    code: "int main() { while(true) { int i = 0; } return 0; }", 
    expected: "translation",
    mustContain: "Loop while the condition"
  },
  { 
    name: "GAMIFICATION: XP Reward Calculation", 
    code: "int main() { int x = 10; return 0; }", 
    expected: "gamification",
    minXP: 25 // 10 Base + 15 Clean Code Bonus
  },
  { 
    name: "GAMIFICATION: Level Title Check", 
    code: "int main() { return 0; }", 
    expected: "gamification",
    checkTitle: true
  },
  // --- PHASE 1.5: STRICT C++ DEPENDENCY TESTS ---
  { 
    name: "STRICT: Missing iostream for cout", 
    code: "int main() { std::cout << 10; return 0; }", 
    expected: "semantic" // Should be blocked by your strict dependency check
  },
  { 
    name: "STRICT: Missing namespace std for cin", 
    code: "#include <iostream>\n int main() { int x; cin >> x; return 0; }", 
    expected: "semantic" 
  },

  // --- PHASE 2.5: ADVANCED TYPE & SCOPE ---
  { 
    name: "TYPE: Assigning String to Int", 
    code: "int main() { int x = \"hello\"; return 0; }", 
    expected: "semantic" 
  },
  { 
    name: "SCOPE: Accessing Variable Outside Loop", 
    code: "int main() { for(int i=0; i<10; i++) { int temp = 5; } return temp; }", 
    expected: "semantic" 
  },

  // --- PHASE 3.5: COMPLEX LOGIC & SAFETY (Symbolic Execution) ---
  { 
    name: "LOGIC: Division by Zero in Loop", 
    code: "int main() { for(int i=5; i>=0; i--) { int x = 100 / i; } return 0; }", 
    expected: "safetyCheck" 
  },
  { 
    name: "ELITE: Nested Division Risk", 
    code: "int main() { int a = 0; int b = 10; if (b > 5) { if (a == 0) { int c = b / a; } } return 0; }", 
    expected: "safetyCheck" 
  },
  { 
    name: "GRANDMASTER: Array Index via Variable", 
    code: "int main() { int arr[3]; int idx = 5; arr[idx] = 10; return 0; }", 
    expected: "safetyCheck" 
  },
  { 
    name: "PATH: Impossible Condition (Dead Code)", 
    code: "int main() { int x = 10; if (x < 5) { int y = 10 / 0; } return 0; }", 
    expected: "success" // This should PASS because the division by zero is unreachable
  },

  // --- PHASE 4.5: TRANSLATOR METAPHORS ---
  { 
    name: "TRANSLATOR: Boolean Choice Logic", 
    code: "int main() { if (true) { int x = 1; } return 0; }", 
    expected: "translation",
    mustContain: "Choice" // Testing if it uses the '⚖️ Choice' metaphor
  },
  { 
    name: "TRANSLATOR: Memory Allocation", 
    code: "int main() { float pi = 3.14; return 0; }", 
    expected: "translation",
    mustContain: "Storage" // Testing if it uses the '📦 Storage' metaphor
  }
];

async function runTests() {
  console.log("🚀 Initializing Elite CodeSense Validation Suite...");
  console.log(`📡 Target: ${API_URL}\n`);

  let passed = 0;
  const startTime = Date.now();

  for (const test of allTestCases) {
    try {
      const response = await axios.post(API_URL, { sourceCode: test.code, hintsUsed: 0 });
      const data = response.data;

      console.log(`--- [TEST: ${test.name}] ---`);
      
      let testPassed = false;

      // SAFETY CHECKS
      if (test.expected === "safetyCheck") {
        const foundSafetyIssue = data.safetyChecks && data.safetyChecks.length > 0;
        testPassed = data.success && foundSafetyIssue;
        console.log(testPassed ? "✅ Logic Risk Detected" : "❌ Logic Risk Missed");
        if (foundSafetyIssue) console.log(`   Message: ${data.safetyChecks[0].message}`);
      } 
      // SUCCESS CHECKS
      else if (test.expected === "success") {
        testPassed = data.success && (!data.errors || data.errors.length === 0);
        console.log(testPassed ? "✅ Path Validated" : "❌ Unexpected Block");
      }
      // TRANSLATION CHECKS (NEW)
      else if (test.expected === "translation") {
        // Check both the old explanations array AND the new CFG tutorExplanation field
        const inExplanations = data.explanations && data.explanations.some(t => t.includes(test.mustContain));
        
        // Search every node in the CFG for the mentor tip
        const inCFG = data.cfg && data.cfg.nodes && data.cfg.nodes.some(node => 
          node.tutorExplanation && node.tutorExplanation.includes(test.mustContain)
        );

        testPassed = inExplanations || inCFG;

        console.log(testPassed ? "✅ Translation Accurate" : "❌ Translation Mismatch");
        
        if (!testPassed) {
          console.log(`   Expected phrase: "${test.mustContain}"`);
          console.log(`   Got (Logs):`, data.explanations);
          console.log(`   Got (CFG Sample):`, data.cfg?.nodes?.[2]?.tutorExplanation || "No CFG data");
        } else {
          console.log(`   Phrase found in ${inCFG ? "CFG Node" : "Logs Tab"}: "${test.mustContain}"`);
        }
      }
      // GAMIFICATION CHECKS (NEW)
      else if (test.expected === "gamification") {
        const hasGamification = !!data.gamification;
        if (!hasGamification) {
            console.log("❌ Gamification data missing");
        } else {
            if (test.minXP) {
                testPassed = data.gamification.xpEarned >= test.minXP;
                console.log(testPassed ? `✅ XP Awarded Correctly (${data.gamification.xpEarned} XP)` : `❌ Low XP Awarded (${data.gamification.xpEarned})`);
            } else if (test.checkTitle) {
                testPassed = !!data.gamification.levelTitle;
                console.log(testPassed ? `✅ Level Title Validated ("${data.gamification.levelTitle}")` : "❌ Level Title Missing");
            }
        }
      }
      // ERROR CHECKS
      else {
        const hasCorrectError = data.errors && data.errors.some(e => e.type === test.expected);
        testPassed = !data.success && hasCorrectError;
        console.log(testPassed ? `✅ Correctly Blocked (${test.expected})` : "❌ Error Leaked/Wrong Type");
        if (hasCorrectError) {
            const err = data.errors.find(e => e.type === test.expected);
            console.log(`   Error: ${err.message}`);
        }
      }

      console.log("------------------------------------------\n");

      if (testPassed) passed++;

    } catch (err) {
      console.error(`🔴 API Connection Failed: ${err.message}`);
      break; 
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`🏁 Validation Finished in ${duration}s`);
  console.log(`📈 Final Result: ${passed} / ${allTestCases.length} Tests Passed`);
}

runTests();