/**
 * test-open-action-normalization.js
 * Dedicated regression test suite for Generic "OPEN" Action Normalization.
 *
 * Verifies:
 * 1. Natural language "open" semantics normalization (OPEN -> CLICK for grounded links/buttons/clickables).
 * 2. Preservation of semanticAction = "OPEN" and executionAction = "CLICK".
 * 3. Local safety gate evaluation and allowlist integrity (ALLOWED_ACTIONS does NOT contain OPEN).
 * 4. URL navigation preserved (OPEN -> NAVIGATE for URLs/destinations).
 * 5. Fail-closed behavior when target is ungrounded (Target Not Found / blocked).
 * 6. Safety regression: Consequential actions (Send, Delete, Purchase, Pay, Publish) remain high-risk/approval-required.
 * 7. Verification layer validates page state change.
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const taskParser = require("./task-parser.js");
const reasoningPlanner = require("./reasoning-planner.js");
const actionVerifier = require("./action-verifier.js");

console.log("============================================================");
console.log("RUNNING IRIS GENERIC OPEN ACTION NORMALIZATION TEST SUITE");
console.log("============================================================\n");

let passedCount = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`[FAIL] ${name}`);
    console.error(err);
    process.exit(1);
  }
}

// =========================================================================
// SECTION 1: SPECIFICATION REGRESSION TESTS (TESTS 1 - 6)
// =========================================================================

test("TEST 1: 'Open the GSLV-F17/EOS-05 mission on the ISRO website.' produces FILL -> SUBMIT -> CLICK", () => {
  const task = "Open the GSLV-F17/EOS-05 mission on the ISRO website.";
  const parsed = taskParser.parseTask(task);

  assert.strictEqual(parsed.intent, "MULTI_STEP");
  assert.strictEqual(parsed.steps.length, 3, "Must produce exactly 3 steps (FILL -> SUBMIT -> CLICK)");

  // Step 1: FILL
  assert.strictEqual(parsed.steps[0].type, "FILL");
  assert.strictEqual(parsed.steps[0].fieldHint, "search");
  assert.strictEqual(parsed.steps[0].value, "GSLV-F17/EOS-05 mission");

  // Step 2: SUBMIT
  assert.strictEqual(parsed.steps[1].type, "SUBMIT");
  assert.strictEqual(parsed.steps[1].targetHint, "search");
  assert.strictEqual(parsed.steps[1].query, "GSLV-F17/EOS-05 mission");

  // Step 3: CLICK / OPEN
  assert.strictEqual(parsed.steps[2].type, "CLICK");
  assert.strictEqual(parsed.steps[2].action, "OPEN");
  assert.strictEqual(parsed.steps[2].targetHint, "GSLV-F17/EOS-05 mission");
});

test("TEST 2: 'Open Sundar Pichai's profile on LinkedIn.' produces FILL -> SUBMIT -> CLICK", () => {
  const task = "Open Sundar Pichai's profile on LinkedIn.";
  const parsed = taskParser.parseTask(task);

  assert.strictEqual(parsed.intent, "MULTI_STEP");
  assert.strictEqual(parsed.steps.length, 3, "Must produce exactly 3 steps (FILL -> SUBMIT -> CLICK)");

  // Step 1: FILL
  assert.strictEqual(parsed.steps[0].type, "FILL");
  assert.strictEqual(parsed.steps[0].fieldHint, "search");
  assert.strictEqual(parsed.steps[0].value, "Sundar Pichai");

  // Step 2: SUBMIT
  assert.strictEqual(parsed.steps[1].type, "SUBMIT");
  assert.strictEqual(parsed.steps[1].targetHint, "search");
  assert.strictEqual(parsed.steps[1].query, "Sundar Pichai");

  // Step 3: CLICK / OPEN
  assert.strictEqual(parsed.steps[2].type, "CLICK");
  assert.strictEqual(parsed.steps[2].action, "OPEN");
  assert.deepStrictEqual(parsed.steps[2].targetEntity, { type: "person", name: "Sundar Pichai" });
  assert.strictEqual(parsed.steps[2].targetIntent, "profile");
});

test("TEST 3: 'Open the first result.' parses and grounds to clickable result", () => {
  const task = "Open the first result.";
  const parsed = taskParser.parseTask(task);

  assert.strictEqual(parsed.steps[0].type, "CLICK");
  assert.strictEqual(parsed.steps[0].ordinal, 1);

  // Normalization on grounded candidate
  const groundedCandidate = {
    action: "OPEN",
    target: "First Search Result Link",
    targetLabel: "First Search Result Link",
    targetIndex: 0,
    targetType: "link",
    groundingScore: 0.95
  };
  const normalized = reasoningPlanner.normalizeAction(groundedCandidate, parsed.steps[0]);
  assert.strictEqual(normalized.action, "CLICK");
  assert.strictEqual(normalized.semanticAction, "OPEN");
  assert.strictEqual(normalized.executionAction, "CLICK");
});

test("TEST 4: 'Open Google.' destination navigation behavior remains correct", () => {
  const task = "Open Google.";
  const parsed = taskParser.parseTask(task);

  assert.strictEqual(parsed.intent, "NAVIGATE");
  assert.strictEqual(parsed.steps[0].type, "NAVIGATE");
  assert.strictEqual(parsed.steps[0].action, "NAVIGATE");
  assert.strictEqual(parsed.steps[0].url, "https://www.google.com");
  assert.strictEqual(parsed.steps[0].isNavigation, true);
});

test("TEST 5: 'Open https://example.com' URL navigation behavior remains correct", () => {
  const task = "Open https://example.com";
  const parsed = taskParser.parseTask(task);

  assert.strictEqual(parsed.intent, "NAVIGATE");
  assert.strictEqual(parsed.steps[0].type, "NAVIGATE");
  assert.strictEqual(parsed.steps[0].action, "NAVIGATE");
  assert.strictEqual(parsed.steps[0].url, "https://example.com");
  assert.strictEqual(parsed.steps[0].isNavigation, true);
});

test("TEST 6: 'Open the mission details' when no matching target exists remains safely blocked", () => {
  const task = "Open the mission details";
  const parsed = taskParser.parseTask(task);

  assert.strictEqual(parsed.steps[0].type, "CLICK");
  assert.strictEqual(parsed.steps[0].targetHint, "mission details");

  // Mock ungrounded target action
  const ungroundedAction = {
    action: "OPEN",
    target: "mission details",
    targetIndex: undefined,
    groundingScore: 0,
    groundingMethod: "target-not-found"
  };

  const normalized = reasoningPlanner.normalizeAction({ ...ungroundedAction }, parsed.steps[0]);
  // When ungrounded and not a destination URL, action must NOT be normalized to CLICK
  assert.strictEqual(normalized.action, "OPEN", "Must not normalize ungrounded target to CLICK");

  // Safety gate evaluation must reject/block ungrounded OPEN action
  const gate = reasoningPlanner.evaluateSafetyGate(normalized, parsed.steps[0]);
  assert.strictEqual(gate.allowed, false, "Must block ungrounded action");
  assert.ok(gate.reason.includes("not in the local permitted allowlist") || gate.reason.includes("Target"));
});

// =========================================================================
// SECTION 2: GROUNDED LINK NORMALIZATION & SAFETY GATE EVALUATION
// =========================================================================

test("ISRO exact trace scenario: Grounded link with OPEN is normalized to CLICK and safely allowed", () => {
  // Trace parameters from observed bug
  const isroAction = {
    action: "OPEN",
    target: "GSLV-F17/EOS-05 MISSION - ISRO",
    targetLabel: "GSLV-F17/EOS-05 MISSION - ISRO",
    targetType: "link",
    role: "link",
    targetIndex: 34,
    groundingScore: 0.98,
    bounds: { x: 197, y: 489, width: 328, height: 22 }
  };
  const stepPlan = {
    type: "CLICK",
    action: "OPEN",
    targetHint: "GSLV-F17/EOS-05 mission"
  };

  // 1. Normalization at planning/action boundary
  const normalized = reasoningPlanner.normalizeAction(isroAction, stepPlan);
  assert.strictEqual(normalized.action, "CLICK");
  assert.strictEqual(normalized.semanticAction, "OPEN");
  assert.strictEqual(normalized.executionAction, "CLICK");
  assert.strictEqual(normalized.targetIndex, 34);
  assert.strictEqual(normalized.groundingScore, 0.98);

  // 2. Safety Gate evaluation
  const gate = reasoningPlanner.evaluateSafetyGate(normalized, stepPlan);
  assert.strictEqual(gate.allowed, true, "Grounded link navigation must be allowed");
  assert.strictEqual(gate.requiresApproval, false, "Navigation link must be autonomous (not blocked)");
  assert.strictEqual(gate.risk, "MEDIUM");
});

test("Direct safety gate call with un-normalized action object normalizes and evaluates safely", () => {
  const action = {
    action: "OPEN",
    targetLabel: "Satish Dhawan Space Centre Link",
    targetType: "link",
    targetIndex: 10,
    groundingScore: 0.96
  };
  const gate = reasoningPlanner.evaluateSafetyGate(action, { type: "CLICK", action: "OPEN" });
  assert.strictEqual(gate.allowed, true);
  assert.strictEqual(action.action, "CLICK");
  assert.strictEqual(action.semanticAction, "OPEN");
  assert.strictEqual(action.executionAction, "CLICK");
});

// =========================================================================
// SECTION 3: ALLOWLIST INTEGRITY (ALLOWLIST MUST NOT CONTAIN "OPEN")
// =========================================================================

test("Do NOT add OPEN to ALLOWED_ACTIONS in reasoning-planner.js or content.js", () => {
  const rpSource = fs.readFileSync(path.join(__dirname, "reasoning-planner.js"), "utf8");
  const contentSource = fs.readFileSync(path.join(__dirname, "content.js"), "utf8");

  // In reasoning-planner.js, ALLOWED_ACTIONS must not contain "OPEN" as a standalone permitted token
  const rpMatch = rpSource.match(/ALLOWED_ACTIONS\s*=\s*new\s+Set\(\[\s*([\s\S]+?)\s*\]\)/);
  assert.ok(rpMatch, "Must find ALLOWED_ACTIONS in reasoning-planner.js");
  const rpActions = rpMatch[1].split(",").map(s => s.trim().replace(/['"]/g, ""));
  assert.strictEqual(rpActions.includes("OPEN"), false, "reasoning-planner ALLOWED_ACTIONS must NOT contain 'OPEN'");
  assert.ok(rpActions.includes("CLICK"));
  assert.ok(rpActions.includes("NAVIGATE"));

  // In content.js, ALLOWED_ACTIONS must not contain "OPEN" as a standalone permitted token
  const contentMatch = contentSource.match(/ALLOWED_ACTIONS\s*=\s*new\s+Set\(\[\s*([\s\S]+?)\s*\]\)/);
  assert.ok(contentMatch, "Must find ALLOWED_ACTIONS in content.js");
  const contentActions = contentMatch[1].split(",").map(s => s.trim().replace(/['"]/g, ""));
  assert.strictEqual(contentActions.includes("OPEN"), false, "content.js ALLOWED_ACTIONS must NOT contain 'OPEN'");
  assert.ok(contentActions.includes("CLICK"));
  assert.ok(contentActions.includes("NAVIGATE"));
});

// =========================================================================
// SECTION 4: SAFETY REGRESSION - CONSEQUENTIAL ACTIONS REMAIN BLOCKED
// =========================================================================

test("Consequential action safety regression: Send, Delete, Purchase, Pay, Publish remain high/critical risk", () => {
  const consequentialCases = [
    { target: "Send the message" },
    { target: "Delete the account" },
    { target: "Purchase this product" },
    { target: "Pay now" },
    { target: "Publish the post" }
  ];

  for (const c of consequentialCases) {
    const action = {
      action: "OPEN",
      target: c.target,
      targetLabel: c.target,
      targetType: "button",
      targetIndex: 5,
      groundingScore: 0.95
    };

    // Normalize
    reasoningPlanner.normalizeAction(action);
    assert.strictEqual(action.action, "CLICK");
    assert.strictEqual(action.semanticAction, "OPEN");

    // Safety gate evaluation without prior human approval
    const gate = reasoningPlanner.evaluateSafetyGate(action, { type: "CLICK", targetHint: c.target });
    assert.strictEqual(gate.allowed, false, `Action '${c.target}' must NOT be allowed autonomously`);
    assert.strictEqual(gate.requiresApproval, true, `Action '${c.target}' must require human approval`);
    assert.ok(gate.risk === "HIGH" || gate.risk === "CRITICAL", `Action '${c.target}' must be assessed as HIGH or CRITICAL risk (got ${gate.risk})`);
  }
});

// =========================================================================
// SECTION 5: ACTION VERIFIER SUPPORTS STATE CHANGE ON NORMALIZED CLICK
// =========================================================================

test("Action Verifier verifies navigation/state change for normalized OPEN -> CLICK", () => {
  const preState = {
    url: "https://www.isro.gov.in/search-results",
    title: "Search Results - ISRO",
    visualElements: [{ label: "GSLV-F17/EOS-05 MISSION - ISRO", type: "link", index: 34 }]
  };
  const postState = {
    url: "https://www.isro.gov.in/missions/gslv-f17-eos-05",
    title: "GSLV-F17/EOS-05 Mission - ISRO",
    visualElements: [{ label: "Mission Details", type: "heading", index: 1 }]
  };

  const action = {
    action: "CLICK",
    semanticAction: "OPEN",
    executionAction: "CLICK",
    target: "GSLV-F17/EOS-05 MISSION - ISRO",
    targetLabel: "GSLV-F17/EOS-05 MISSION - ISRO",
    targetType: "link"
  };

  const outcome = actionVerifier.verifyActionOutcome(preState, postState, action, { executed: true });
  assert.strictEqual(outcome.status, "VERIFIED");
  assert.strictEqual(outcome.verified, true);
  assert.ok(outcome.reason.includes("Navigation verified") || outcome.reason.includes("Page URL changed"));
  assert.strictEqual(outcome.evidence.urlChanged, true);
});

console.log("\n============================================================");
console.log(`ALL ${passedCount} SPECIFICATION & REGRESSION TESTS PASSED CLEANLY!`);
console.log("============================================================");
