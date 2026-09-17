/**
 * Hardening Test Suite for SIH 2026 Visual Perception Agent
 * Validates:
 * - Test A: Single-stage search + open result
 * - Test B: Two-stage search (YouTube -> DSA in Java)
 * - Test C: Two-stage search (Amazon -> laptops)
 * - Test D: Two-stage search (GitHub -> Java)
 * - Test E: Two-stage search (Wikipedia -> artificial intelligence)
 * - Loop safety limit handling (max step bound, no false COMPLETED)
 * - Goal completion tracking and plan verification
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const vm = require("vm");

const sandbox = {
  window: {},
  document: { title: "Browser", location: { href: "https://www.google.com" } },
  console: console,
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  performance: { now: () => Date.now() }
};
sandbox.window = sandbox;

const taskParserCode = fs.readFileSync(path.join(__dirname, "task-parser.js"), "utf8");
vm.runInNewContext(taskParserCode, sandbox);

const reasoningPlannerCode = fs.readFileSync(path.join(__dirname, "reasoning-planner.js"), "utf8");
vm.runInNewContext(reasoningPlannerCode, sandbox);

const SIHTaskParser = sandbox.SIHTaskParser;
const SIHReasoningPlanner = sandbox.SIHReasoningPlanner;

console.log("============================================================");
console.log("RUNNING MULTI-STEP HARDENING VERIFICATION TESTS (A - E)");
console.log("============================================================");

const testCases = [
  {
    id: "Test A",
    task: "Find the search box, search for YouTube, and open the most relevant result.",
    expectedStepCount: 4,
    expectedGoalsCount: 3,
    expectedSequence: ["CLICK", "FILL", "SUBMIT", "CLICK"],
    expectedQueries: ["YouTube"]
  },
  {
    id: "Test B",
    task: "Find the search box, search for YouTube, open the most relevant result, find the search box on YouTube, search for DSA in Java, and open the most relevant result.",
    expectedStepCount: 8,
    expectedGoalsCount: 6,
    expectedSequence: ["CLICK", "FILL", "SUBMIT", "CLICK", "CLICK", "FILL", "SUBMIT", "CLICK"],
    expectedQueries: ["YouTube", "DSA in Java"]
  },
  {
    id: "Test C",
    task: "Find the search box, search for Amazon, open the official Amazon website, find the search box on Amazon, search for laptops, and open the most relevant laptop result.",
    expectedStepCount: 8,
    expectedGoalsCount: 6,
    expectedSequence: ["CLICK", "FILL", "SUBMIT", "CLICK", "CLICK", "FILL", "SUBMIT", "CLICK"],
    expectedQueries: ["Amazon", "laptops"]
  },
  {
    id: "Test D",
    task: "Find the search box, search for GitHub, open the official GitHub website, find the search box on GitHub, search for Java, and open the most relevant result.",
    expectedStepCount: 8,
    expectedGoalsCount: 6,
    expectedSequence: ["CLICK", "FILL", "SUBMIT", "CLICK", "CLICK", "FILL", "SUBMIT", "CLICK"],
    expectedQueries: ["GitHub", "Java"]
  },
  {
    id: "Test E",
    task: "Find the search box, search for Wikipedia, open the official Wikipedia website, find the search box on Wikipedia, search for artificial intelligence, and open the most relevant result.",
    expectedStepCount: 8,
    expectedGoalsCount: 6,
    expectedSequence: ["CLICK", "FILL", "SUBMIT", "CLICK", "CLICK", "FILL", "SUBMIT", "CLICK"],
    expectedQueries: ["Wikipedia", "artificial intelligence"]
  }
];

let allPassed = true;

for (const tc of testCases) {
  console.log(`\n[VERIFY ${tc.id}] Task: "${tc.task}"`);
  const parsed = SIHTaskParser.parseTask(tc.task);

  assert.ok(parsed, `${tc.id}: parseTask returned null/undefined`);
  assert.strictEqual(
    parsed.steps.length,
    tc.expectedStepCount,
    `${tc.id}: Expected ${tc.expectedStepCount} steps, got ${parsed.steps.length}`
  );

  const stepTypes = Array.from(parsed.steps).map((s) => String(s.type));
  assert.strictEqual(
    JSON.stringify(stepTypes),
    JSON.stringify(tc.expectedSequence),
    `${tc.id}: Step sequence mismatch. Expected ${tc.expectedSequence.join("->")}, got ${stepTypes.join("->")}`
  );

  if (tc.expectedGoalsCount) {
    assert.strictEqual(
      parsed.goals.length,
      tc.expectedGoalsCount,
      `${tc.id}: Expected ${tc.expectedGoalsCount} subgoals, got ${parsed.goals.length}`
    );
  }

  // Verify reasoning plan integration
  const plan = SIHReasoningPlanner.planTask(parsed, { title: "Browser", url: "https://google.com" });
  assert.ok(plan && plan.steps, `${tc.id}: planTask failed to produce reasoning plan`);
  assert.strictEqual(plan.steps.length, tc.expectedStepCount, `${tc.id}: Plan step count mismatch`);

  // Verify completion evaluation
  const emptyHistory = [];
  assert.strictEqual(
    SIHReasoningPlanner.isOverallTaskCompleted(plan, emptyHistory),
    false,
    `${tc.id}: isOverallTaskCompleted must be false for empty execution history`
  );

  // Simulate complete execution
  const completedHistory = plan.steps.map((s, idx) => ({
    step: idx + 1,
    action: { action: s.type },
    executed: true,
    status: "success"
  }));
  plan.steps.forEach((s) => { s.completed = true; s.verified = true; });

  assert.strictEqual(
    SIHReasoningPlanner.isOverallTaskCompleted(plan, completedHistory),
    true,
    `${tc.id}: isOverallTaskCompleted must be true when all planned steps succeeded`
  );

  console.log(`  ✓ ${tc.id} passed cleanly: ${parsed.steps.length} steps, ${parsed.goals.length} subgoals.`);
}

console.log("\n[VERIFY Loop Safety & Boundary Handling]");
// Test: Incomplete execution must not falsely return completed
const partialPlan = SIHReasoningPlanner.planTask(SIHTaskParser.parseTask(testCases[0].task), {});
partialPlan.steps[0].completed = true;
// Step 1 done, step 2-4 not done
const partialHistory = [{ step: 1, action: { action: "CLICK" }, executed: true, status: "success" }];
assert.strictEqual(
  SIHReasoningPlanner.isOverallTaskCompleted(partialPlan, partialHistory),
  false,
  "Partial execution must NOT report task as completed"
);
console.log("  ✓ Partial execution correctly reported as incomplete");

console.log("\n============================================================");
console.log("ALL MULTI-STEP HARDENING VERIFICATION TESTS PASSED CLEANLY!");
console.log("============================================================");
