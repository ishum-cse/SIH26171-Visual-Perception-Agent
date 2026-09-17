/**
 * Regression Test Suite: Strict Intent Preservation & Target Validation
 *
 * Verifies that:
 * 1. User tasks with explicit target constraints retain the exact target in parsing, planning, and grounding.
 * 2. If an explicit target is specified (e.g. XYZ_NONEXISTENT_987654), local grounding strictly refuses to substitute
 *    unrelated elements or generic search results (e.g. OpenAI).
 * 3. The agent safely halts with "TARGET NOT FOUND / ACTION BLOCKED" without false-positive execution.
 * 4. Generic requests and long multi-step workflows continue to work normally.
 */

const assert = require("assert");
const taskParser = require("./task-parser.js");
const reasoningPlanner = require("./reasoning-planner.js");

console.log("============================================================");
console.log("RUNNING TARGET VALIDATION & INTENT PRESERVATION TESTS (A - E)");
console.log("============================================================");

// Simulated simulated DOM visual elements (e.g. a search engine results page for OpenAI)
const searchPageElements = [
  { index: 0, label: "Search input", type: "input", semanticTag: "SEARCH_INPUT" },
  { index: 1, label: "Search button", type: "button", semanticTag: "SUBMIT_BUTTON" },
  { index: 2, label: "OpenAI: Creating safe AGI that benefits all of humanity", type: "link", semanticTag: "SEARCH_RESULT" },
  { index: 3, label: "OpenAI - Wikipedia", type: "link", semanticTag: "SEARCH_RESULT" },
  { index: 4, label: "About OpenAI", type: "link", semanticTag: "SEARCH_RESULT" },
  { index: 5, label: "Privacy Policy", type: "link", semanticTag: "NAVIGATION" }
];

// Helper to simulate popup.js computeClickScore logic
function simulateComputeClickScore(currentStepPlan, candidateElements) {
  const normalize = (s) => (s || "").trim().toLowerCase();
  const isSearchResultSelection = !!(
    currentStepPlan.query ||
    currentStepPlan.isProductSelection ||
    (currentStepPlan.targetHint && /result|product|item|listing|video|movie|article|website|site|webpage|page|link/i.test(currentStepPlan.targetHint))
  );
  const isExplicitTarget = !!(currentStepPlan.isExplicitTarget);
  const explicitTargetVal = (currentStepPlan.explicitTarget || (isExplicitTarget ? currentStepPlan.targetHint : null) || "").toLowerCase().trim();
  const queryNorm = (currentStepPlan.query || "").toLowerCase().trim();
  const queryTokens = queryNorm.split(/\s+/).filter(Boolean);

  let bestIdx = -1;
  let bestScore = 0;

  candidateElements.forEach((el, idx) => {
    if (el.disabled) return;
    const elType = (el.type || "").toLowerCase();
    if (!["button", "link", "input", "element"].includes(elType)) return;
    const labelNorm = normalize(el.label);

    // STRICT TARGET VALIDATION
    if (isExplicitTarget && explicitTargetVal) {
      if (elType === "input" && (el.semanticTag === "SEARCH_INPUT" || labelNorm.includes("search"))) return;

      if (labelNorm === explicitTargetVal) {
        if (1.0 > bestScore) { bestScore = 1.0; bestIdx = idx; }
        return;
      }
      if (labelNorm.includes(explicitTargetVal)) {
        if (0.95 > bestScore) { bestScore = 0.95; bestIdx = idx; }
        return;
      }
      const explicitTokens = explicitTargetVal.split(/\s+/).filter((t) => t.length > 2 && !["result", "called", "named", "titled", "product", "item"].includes(t));
      if (explicitTokens.length > 0 && explicitTokens.every((t) => labelNorm.includes(t))) {
        if (0.90 > bestScore) { bestScore = 0.90; bestIdx = idx; }
        return;
      }
      // Strict rejection when explicit target does not match!
      return;
    }

    if (isSearchResultSelection) {
      if (elType === "input" && (el.semanticTag === "SEARCH_INPUT" || labelNorm.includes("search"))) return;
      const hintTokens = (currentStepPlan.targetHint || "").toLowerCase().split(/\s+/).filter(t => !["official", "website", "the", "most", "relevant", "result", "page", "site", "webpage", "link"].includes(t));
      const searchTokens = [...new Set([...queryTokens, ...hintTokens])];
      if (searchTokens.length > 0 && (elType === "link" || elType === "button" || elType === "element")) {
        let matchCount = 0;
        for (const t of searchTokens) {
          if (labelNorm.includes(t)) matchCount++;
        }
        if (matchCount > 0) {
          let relScore = 0.7 + (matchCount / searchTokens.length) * 0.25;
          if (queryNorm && labelNorm.includes(queryNorm)) relScore += 0.05;
          if (relScore > bestScore) {
            bestScore = Math.min(relScore, 0.98);
            bestIdx = idx;
          }
        }
      }
    }
  });

  if (bestIdx >= 0 && bestScore >= 0.35) {
    const matched = candidateElements[bestIdx];
    return {
      action: "CLICK",
      target: matched.label,
      targetIndex: bestIdx,
      targetLabel: matched.label,
      groundingScore: bestScore
    };
  }

  return {
    action: "NONE",
    target: null,
    reason: isExplicitTarget
      ? `Target not found: ${currentStepPlan.explicitTarget || currentStepPlan.targetHint}`
      : `Could not safely ground click target '${currentStepPlan.targetHint}' on DOM.`
  };
}

// Helper to simulate popup.js Step 9 termination evaluation
function simulateStep9Termination(agentAction, currentStepPlan, currentStep, totalPlannedSteps) {
  const isPlannedTask = true;
  const targetName = currentStepPlan?.explicitTarget || currentStepPlan?.targetHint || currentStepPlan?.fieldHint || "element";
  const isExplicit = !!(currentStepPlan?.isExplicitTarget);

  if (!agentAction || agentAction.action === "NONE" || (!agentAction.target && agentAction.targetIndex === undefined)) {
    if (isExplicit) {
      return {
        safetyStatus: "TARGET NOT FOUND / ACTION BLOCKED",
        executionStatus: `Target not found: ${targetName}`,
        executionOutput: `Target not found: ${targetName}`,
        status: "blocked",
        executed: false
      };
    } else if (isPlannedTask && currentStepPlan && currentStepPlan.type !== "NONE") {
      return {
        safetyStatus: "HALTED (Target not found on page)",
        executionStatus: `Halted at step ${currentStep} of ${totalPlannedSteps}: Target '${targetName}' not visible`,
        executionOutput: `Halted at step ${currentStep}: Target not visible`,
        status: "unresolved",
        executed: false
      };
    } else {
      return {
        safetyStatus: "PASSED (No-op action safely handled)",
        executionStatus: "Task complete (No further action needed)",
        executionOutput: "Task complete (Action is NONE)",
        status: "completed",
        executed: false
      };
    }
  }

  return {
    safetyStatus: "PASSED",
    executionStatus: "Action ready",
    status: "ready",
    executed: true
  };
}

// -----------------------------------------------------------------------------
// [REGRESSION TEST A]: Existing successful task
// "Find the search box, search for OpenAI, and open the most relevant result."
// -----------------------------------------------------------------------------
console.log("\n[TEST A] 'Find the search box, search for OpenAI, and open the most relevant result.'");
const taskA = "Find the search box, search for OpenAI, and open the most relevant result.";
const parsedA = taskParser.parseTask(taskA);
assert.strictEqual(parsedA.steps.length, 4, "Test A must produce exactly 4 steps");
assert.strictEqual(parsedA.steps[3].isProductSelection, true, "Step 4 must be product selection");
assert.strictEqual(parsedA.steps[3].isMostRelevant, true, "Step 4 must be marked as isMostRelevant");
assert.strictEqual(parsedA.steps[3].isExplicitTarget, false, "Step 4 is not an explicit target constraint");

const planA = reasoningPlanner.planTask(parsedA);
assert.strictEqual(planA.steps.length, 4, "Reasoning plan A must have 4 steps");
assert.strictEqual(planA.steps[3].isMostRelevant, true, "Plan step 4 retains isMostRelevant");

// Grounding on search page must successfully ground OpenAI result
const groundedA = simulateComputeClickScore(planA.steps[3], searchPageElements);
assert.strictEqual(groundedA.action, "CLICK", "Generic most relevant search must succeed");
assert.ok([2, 3, 4].includes(groundedA.targetIndex), "Must ground to an OpenAI result");
assert.ok(groundedA.target.toLowerCase().includes("openai"), "Result must be an OpenAI result");
console.log("  ✓ Test A PASSED: Parsed as most-relevant, grounded top OpenAI result successfully.");

// -----------------------------------------------------------------------------
// [REGRESSION TEST B]: Existing long multi-step task
// "Find the search box, search for YouTube, open the most relevant result, find the search box on YouTube, search for DSA in Java, and open the most relevant result."
// -----------------------------------------------------------------------------
console.log("\n[TEST B] Long form continuous multi-step task across 2 stages");
const taskB = "Find the search box, search for YouTube, open the most relevant result, find the search box on YouTube, search for DSA in Java, and open the most relevant result.";
const parsedB = taskParser.parseTask(taskB);
assert.strictEqual(parsedB.steps.length, 8, "Test B must produce 8 continuous steps");
assert.strictEqual(parsedB.goals.length, 6, "Test B must produce 6 subgoals across both stages");
const planB = reasoningPlanner.planTask(parsedB);
assert.strictEqual(planB.steps.length, 8, "Reasoning plan B must have 8 steps");
console.log("  ✓ Test B PASSED: 8 continuous steps and 6 subgoals preserved without interruption.");

// -----------------------------------------------------------------------------
// [REGRESSION TEST C]: Explicit nonexistent target
// "Find the search box, search for OpenAI, and click the result called XYZ_NONEXISTENT_987654."
// -----------------------------------------------------------------------------
console.log("\n[TEST C] Explicit nonexistent target: 'Find the search box, search for OpenAI, and click the result called XYZ_NONEXISTENT_987654.'");
const taskC = "Find the search box, search for OpenAI, and click the result called XYZ_NONEXISTENT_987654.";
const parsedC = taskParser.parseTask(taskC);
assert.strictEqual(parsedC.steps.length, 4, "Test C must have 4 steps");
assert.strictEqual(parsedC.steps[3].isExplicitTarget, true, "Step 4 must be flagged as explicit target");
assert.strictEqual(parsedC.steps[3].explicitTarget, "XYZ_NONEXISTENT_987654", "Step 4 must retain explicit target name");
assert.strictEqual(parsedC.steps[3].targetHint, "XYZ_NONEXISTENT_987654", "Step 4 targetHint must be the explicit target");
assert.strictEqual(parsedC.steps[3].isMostRelevant, false, "Step 4 must NOT be flagged as most relevant");

const planC = reasoningPlanner.planTask(parsedC);
assert.strictEqual(planC.steps[3].isExplicitTarget, true, "Reasoning plan step must preserve isExplicitTarget");
assert.strictEqual(planC.steps[3].explicitTarget, "XYZ_NONEXISTENT_987654", "Reasoning plan step must preserve explicitTarget");

// Grounding on search page with OpenAI results MUST NOT click OpenAI!
const groundedC = simulateComputeClickScore(planC.steps[3], searchPageElements);
assert.strictEqual(groundedC.action, "NONE", "Must NOT click OpenAI when target does not exist");
assert.strictEqual(groundedC.target, null, "Target must be null");
assert.strictEqual(groundedC.reason, "Target not found: XYZ_NONEXISTENT_987654", "Reason must report target not found");

// Termination UI check
const termC = simulateStep9Termination(groundedC, planC.steps[3], 4, 4);
assert.strictEqual(termC.safetyStatus, "TARGET NOT FOUND / ACTION BLOCKED", "Safety status must report action blocked");
assert.strictEqual(termC.executionStatus, "Target not found: XYZ_NONEXISTENT_987654", "Execution status must show clear failure");
assert.strictEqual(termC.status, "blocked", "Task must be marked blocked, never complete");
console.log("  ✓ Test C PASSED: Explicit target preserved, OpenAI strictly rejected, safety status is TARGET NOT FOUND / ACTION BLOCKED.");

// -----------------------------------------------------------------------------
// [REGRESSION TEST D]: Natural language variants
// "search OpenAI and select XYZ_NONEXISTENT_987654"
// "search OpenAI and choose XYZ_NONEXISTENT_987654"
// "search OpenAI and open XYZ_NONEXISTENT_987654"
// -----------------------------------------------------------------------------
console.log("\n[TEST D] Natural-language explicit target variants (select, choose, open)");
const variantsD = [
  "search OpenAI and select XYZ_NONEXISTENT_987654",
  "search OpenAI and choose XYZ_NONEXISTENT_987654",
  "search OpenAI and open XYZ_NONEXISTENT_987654",
  "search OpenAI and click XYZ_NONEXISTENT_987654",
  "search OpenAI and visit XYZ_NONEXISTENT_987654"
];

variantsD.forEach((v) => {
  const p = taskParser.parseTask(v);
  assert.ok(p.steps.length >= 3, `Variant '${v}' must have at least 3 steps`);
  const clickStep = p.steps[p.steps.length - 1];
  assert.strictEqual(clickStep.isExplicitTarget, true, `Variant '${v}' must be explicit target`);
  assert.strictEqual(clickStep.explicitTarget, "XYZ_NONEXISTENT_987654", `Variant '${v}' must preserve target name`);
  assert.strictEqual(clickStep.isMostRelevant, false, `Variant '${v}' must NOT be most relevant`);

  const plan = reasoningPlanner.planTask(p);
  const lastPlanStep = plan.steps[plan.steps.length - 1];
  const grounded = simulateComputeClickScore(lastPlanStep, searchPageElements);
  assert.strictEqual(grounded.action, "NONE", `Variant '${v}' must reject unrelated OpenAI result`);
  assert.strictEqual(grounded.reason, "Target not found: XYZ_NONEXISTENT_987654");

  const term = simulateStep9Termination(grounded, lastPlanStep, 3, 3);
  assert.strictEqual(term.safetyStatus, "TARGET NOT FOUND / ACTION BLOCKED");
  console.log(`  ✓ Variant '${v}' correctly rejected substitute and reported ACTION BLOCKED.`);
});

// -----------------------------------------------------------------------------
// [REGRESSION TEST E]: Generic request
// "search OpenAI and open the most relevant result"
// -----------------------------------------------------------------------------
console.log("\n[TEST E] Generic request: 'search OpenAI and open the most relevant result'");
const taskE = "search OpenAI and open the most relevant result";
const parsedE = taskParser.parseTask(taskE);
assert.strictEqual(parsedE.steps.length, 3, "Test E must produce 3 steps (FILL, SUBMIT, CLICK)");
const clickStepE = parsedE.steps[2];
assert.strictEqual(clickStepE.isMostRelevant, true, "Step 3 must be isMostRelevant = true");
assert.strictEqual(clickStepE.isExplicitTarget, false, "Step 3 must be isExplicitTarget = false");

const planE = reasoningPlanner.planTask(parsedE);
const groundedE = simulateComputeClickScore(planE.steps[2], searchPageElements);
assert.strictEqual(groundedE.action, "CLICK", "Generic request must successfully match relevant result");
assert.ok([2, 3, 4].includes(groundedE.targetIndex), "Generic request must ground to an OpenAI result");
assert.ok(groundedE.target.toLowerCase().includes("openai"), "Generic request must ground to an OpenAI result");
console.log("  ✓ Test E PASSED: Generic request preserved and grounds normally.");

console.log("\n============================================================");
console.log("ALL TARGET VALIDATION & INTENT PRESERVATION TESTS PASSED CLEANLY!");
console.log("============================================================");
