/**
 * IRIS General Human-Language Browser Task Understanding Test Suite
 * Validates natural language understanding, semantic descriptor extraction,
 * perception candidate resolution, spatial & ordinal reasoning, price/recency sorting,
 * execution constraints, and safe ambiguity handling across general websites.
 *
 * Covers Section 16 Required Tests (A through J) & Core Pipeline Invariants.
 */

const assert = require("assert");
const semanticResolver = require("./semantic-resolver.js");
const taskParser = require("./task-parser.js");
const reasoningPlanner = require("./reasoning-planner.js");

console.log("\n=======================================================");
console.log("   IRIS SEMANTIC TASK UNDERSTANDING TEST SUITE");
console.log("=======================================================\n");

let passedCount = 0;
let totalCount = 0;

function runTest(testName, fn) {
  totalCount++;
  try {
    fn();
    console.log(`  [PASS] ${testName}`);
    passedCount++;
  } catch (err) {
    console.error(`  [FAIL] ${testName}`);
    console.error(`         ${err.message}`);
    throw err;
  }
}

// =============================================================================
// SECTION 16 MINIMAL REGRESSION TESTS (A THROUGH J)
// =============================================================================

console.log("--- SECTION 16: Core Semantic Resolution Test Matrix (A - J) ---");

// TEST A: "Find the black earbuds" / "Find the black earbuds on the screen"
runTest("Test A: 'Find the black earbuds on the screen' -> Structural semantic object, not literal DOM search", () => {
  const plan = taskParser.parseTask("Find the black earbuds on the screen");
  assert.ok(plan.steps.length >= 1, "Must produce planned step");
  const step = plan.steps[0];
  
  // Structural target object verification
  assert.strictEqual(step.isSemantic, true);
  assert.strictEqual(step.attribute, "color");
  assert.strictEqual(step.attributeValue, "black");
  assert.strictEqual(step.objectTarget, "earbuds");
  assert.ok(!step.targetHint.includes("on the screen"), "Location suffix must be stripped");
  
  const sto = step.semanticTargetObject;
  assert.ok(sto, "Must construct structural semanticTargetObject");
  assert.strictEqual(sto.entity, "product");
  assert.strictEqual(sto.description, "earbuds");
  assert.deepStrictEqual(sto.attributes, { color: "black" });
  assert.strictEqual(sto.context, "current_page");

  // Candidate resolution against perceived page
  const perceivedPage = [
    { label: "Product A Earbuds White $1999", type: "link", dataColor: "white", index: 0 },
    { label: "Product B Wireless Earbuds Black $2499", type: "link", dataColor: "black", index: 1 },
    { label: "Product C Bluetooth Earbuds Blue $1799", type: "link", dataColor: "blue", index: 2 }
  ];

  const grounded = semanticResolver.resolveSemanticTarget(step, perceivedPage, { allElements: perceivedPage });
  assert.strictEqual(grounded.action, "CLICK");
  assert.strictEqual(grounded.targetIndex, 1);
  assert.strictEqual(grounded.target, "Product B Wireless Earbuds Black $2499");
  assert.notStrictEqual(grounded.target, "black earbuds on the screen");
  assert.strictEqual(grounded.concreteElement, perceivedPage[1]);
});

// TEST B: "Open the cheapest product"
runTest("Test B: 'Open the cheapest product' -> Price extraction, comparison, concrete candidate selection", () => {
  const plan = taskParser.parseTask("Open the cheapest product");
  const step = plan.steps[0];
  assert.strictEqual(step.ranking, "cheapest");
  assert.strictEqual(step.semanticCategory, "product");
  assert.strictEqual(step.url, undefined, "Must not navigate to domain 'product'");

  const sto = step.semanticTargetObject;
  assert.ok(sto);
  assert.strictEqual(sto.entity, "product");
  assert.strictEqual(sto.selector.type, "minimum");
  assert.strictEqual(sto.selector.attribute, "price");

  const candidates = [
    { label: "Sony Wireless Headphones - $199.99", type: "link", index: 0 },
    { label: "Anker Soundcore Earbuds - $29.99", type: "link", index: 1 },
    { label: "Bose QuietComfort - $279.00", type: "link", index: 2 }
  ];

  const grounded = semanticResolver.resolveSemanticTarget(step, candidates, { allElements: candidates });
  assert.strictEqual(grounded.action, "CLICK");
  assert.strictEqual(grounded.targetIndex, 1);
  assert.strictEqual(grounded.target, "Anker Soundcore Earbuds - $29.99");
  assert.notStrictEqual(grounded.target, "cheapest product");
  assert.strictEqual(grounded.concreteElement, candidates[1]);
});

// TEST C: "Open the first product"
runTest("Test C: 'Open the first product' -> Candidate ordering, selects candidate 1", () => {
  const plan = taskParser.parseTask("Open the first product");
  const step = plan.steps[0];
  assert.strictEqual(step.ordinal, 1);
  assert.strictEqual(step.semanticCategory, "product");

  const candidates = [
    { label: "Apple iPhone 15 Pro", type: "link", bounds: { x: 10, y: 100, width: 200, height: 50 }, index: 0 },
    { label: "Google Pixel 8", type: "link", bounds: { x: 10, y: 160, width: 200, height: 50 }, index: 1 },
    { label: "Samsung Galaxy S24", type: "link", bounds: { x: 10, y: 220, width: 200, height: 50 }, index: 2 }
  ];

  const grounded = semanticResolver.resolveSemanticTarget(step, candidates, { allElements: candidates });
  assert.strictEqual(grounded.action, "CLICK");
  assert.strictEqual(grounded.targetIndex, 0);
  assert.strictEqual(grounded.target, "Apple iPhone 15 Pro");
  assert.strictEqual(grounded.concreteElement, candidates[0]);
});

// TEST D: "Open the most recent email"
runTest("Test D: 'Open the most recent email' -> Email candidates, recency resolution", () => {
  const plan = taskParser.parseTask("Open the most recent email");
  const step = plan.steps[0];
  assert.ok(step.ranking === "latest" || step.ranking === "most_recent");
  assert.strictEqual(step.semanticCategory, "email");

  const sto = step.semanticTargetObject;
  assert.ok(sto);
  assert.strictEqual(sto.entity, "email");
  assert.strictEqual(sto.selector.type, "most_recent");

  const emailCandidates = [
    { label: "Security alert from Google - Yesterday at 4:15 PM", type: "element", bounds: { x: 20, y: 300, width: 600, height: 40 }, index: 0 },
    { label: "Team Standup Notes - 10:45 AM", type: "element", bounds: { x: 20, y: 150, width: 600, height: 40 }, index: 1 },
    { label: "Weekly Newsletter - Sep 18", type: "element", bounds: { x: 20, y: 400, width: 600, height: 40 }, index: 2 }
  ];

  const grounded = semanticResolver.resolveSemanticTarget(step, emailCandidates, { allElements: emailCandidates });
  assert.strictEqual(grounded.action, "CLICK");
  assert.strictEqual(grounded.targetIndex, 1);
  assert.strictEqual(grounded.target, "Team Standup Notes - 10:45 AM");
  assert.strictEqual(grounded.concreteElement, emailCandidates[1]);
});

// TEST E: "Click the button below the heading"
runTest("Test E: 'Click the button below the heading' -> Relational resolution (spatial)", () => {
  const plan = taskParser.parseTask("Click the button below the heading");
  const step = plan.steps[0];
  assert.ok(step.spatial);
  assert.strictEqual(step.spatial.relation, "below");
  assert.ok(step.spatial.referenceTarget.includes("heading"));

  const allElements = [
    { label: "Account Overview Heading", type: "heading", bounds: { x: 50, y: 100, width: 300, height: 40 }, index: 0 },
    { label: "Top Navigation Button", type: "button", bounds: { x: 50, y: 30, width: 100, height: 30 }, index: 1 },
    { label: "Upgrade Subscription Button", type: "button", bounds: { x: 50, y: 160, width: 150, height: 35 }, index: 2 }
  ];

  const grounded = semanticResolver.resolveSemanticTarget(step, allElements, { allElements });
  assert.strictEqual(grounded.action, "CLICK");
  assert.strictEqual(grounded.targetIndex, 2);
  assert.strictEqual(grounded.target, "Upgrade Subscription Button");
  assert.strictEqual(grounded.concreteElement, allElements[2]);
});

// TEST F: "Select the black one"
runTest("Test F: 'Select the black one' -> Contextual candidate resolution with pronoun 'one'", () => {
  const plan = taskParser.parseTask("Select the black one");
  const step = plan.steps[0];
  assert.strictEqual(step.attribute, "color");
  assert.strictEqual(step.attributeValue, "black");
  assert.strictEqual(step.isSemantic, true);

  const candidates = [
    { label: "Option A - Pure White Edition", dataColor: "white", index: 0 },
    { label: "Option B - Matte Finish", dataColor: "black", index: 1 },
    { label: "Option C - Classic Silver", dataColor: "silver", index: 2 }
  ];

  const grounded = semanticResolver.resolveSemanticTarget(step, candidates, { allElements: candidates });
  assert.strictEqual(grounded.action, "SELECT");
  assert.strictEqual(grounded.targetIndex, 1);
  assert.strictEqual(grounded.target, "Option B - Matte Finish");
  assert.strictEqual(grounded.concreteElement, candidates[1]);
});

// TEST G: "Click Compose"
runTest("Test G: 'Click Compose' -> Existing exact-target behavior unchanged", () => {
  const plan = taskParser.parseTask("Click Compose");
  assert.strictEqual(plan.steps.length, 1);
  assert.strictEqual(plan.steps[0].type, "CLICK");
  assert.strictEqual(plan.steps[0].targetHint.toLowerCase(), "compose");
  assert.strictEqual(Boolean(plan.steps[0].ranking), false);
  assert.strictEqual(Boolean(plan.steps[0].spatial), false);
  assert.strictEqual(plan.doNotSend, false);
});

// TEST H: "Fill Email with test@example.com"
runTest("Test H: 'Fill Email with test@example.com' -> Existing fill behavior unchanged", () => {
  const plan = taskParser.parseTask("Fill Email with test@example.com");
  assert.strictEqual(plan.steps.length, 1);
  assert.strictEqual(plan.steps[0].type, "FILL");
  assert.strictEqual(plan.steps[0].fieldHint.toLowerCase(), "email");
  assert.strictEqual(plan.steps[0].value, "test@example.com");
});

// TEST I: "Fill this form but don't submit it"
runTest("Test I: 'Fill this form but don't submit it' -> Existing form flow, submission constraint preserved", () => {
  const plan = taskParser.parseTask("Fill this form but don't submit it");
  assert.strictEqual(plan.doNotSubmit, true);
  assert.ok(plan.steps.some(s => s.type === "FILL_FORM" || s.type === "FILL"));
  // Must NOT include a trailing submit CLICK step
  assert.ok(!plan.steps.some(s => s.type === "CLICK" && (s.targetHint || "").toLowerCase() === "submit"));
});

// TEST J: "Draft a reply but don't send it"
runTest("Test J: 'Draft a reply but don't send it' -> Reply field resolved, message filled, NO send action", () => {
  const plan = taskParser.parseTask("Draft a reply but don't send it");
  assert.strictEqual(plan.doNotSend, true);
  assert.ok(plan.steps.length >= 2, "Must include reply click and fill step");
  assert.strictEqual(plan.steps[0].type, "CLICK");
  assert.strictEqual(plan.steps[0].targetHint.toLowerCase(), "reply");
  assert.strictEqual(plan.steps[1].type, "FILL");
  assert.ok(plan.steps[1].fieldHint.toLowerCase().includes("reply") || plan.steps[1].fieldHint.toLowerCase().includes("message"));
  // Absolutely NO send click or submit step
  assert.ok(!plan.steps.some(s => (s.targetHint || "").toLowerCase() === "send"));
});

// SECTION 6 TEST: Visual Attribute Resolution without OCR text color
runTest("Section 6: Visual attribute resolution succeeds when OCR text lacks color", () => {
  const stepPlan = {
    type: "CLICK",
    targetHint: "black earbuds",
    attribute: "color",
    attributeValue: "black",
    objectTarget: "earbuds",
    isSemantic: true
  };
  // OCR labels only say "Wireless Earbuds" / "Sport Earbuds", but visual perception provides color
  const candidates = [
    { label: "Wireless Earbuds", type: "link", visualColor: "white", index: 0 },
    { label: "Wireless Earbuds", type: "link", visualColor: "black", index: 1 },
    { label: "Sport Earbuds", type: "link", visualColor: "blue", index: 2 }
  ];

  const grounded = semanticResolver.resolveSemanticTarget(stepPlan, candidates, { allElements: candidates });
  assert.strictEqual(grounded.action, "CLICK");
  assert.strictEqual(grounded.targetIndex, 1);
  assert.strictEqual(grounded.groundingMethod, "semantic + DOM + visual fusion");
  assert.strictEqual(grounded.concreteElement, candidates[1]);
});

// -----------------------------------------------------------------------------
// PART 2: ADDITIONAL SPECIFICATION PROMPTS
// -----------------------------------------------------------------------------

console.log("\n--- PART 2: Multi-step & Complex Relational Scenarios ---");

runTest("Multi-step: 'Open Gmail and click Compose'", () => {
  const plan = taskParser.parseTask("Open Gmail and click Compose");
  assert.strictEqual(plan.steps.length, 2);
  assert.strictEqual(plan.steps[0].type, "NAVIGATE");
  assert.ok(plan.steps[0].url.includes("gmail.com"));
  assert.strictEqual(plan.steps[1].type, "CLICK");
  assert.strictEqual(plan.steps[1].targetHint.toLowerCase(), "compose");
});

runTest("Multi-step: 'Search for black earbuds and open the cheapest one'", () => {
  const plan = taskParser.parseTask("Search for black earbuds and open the cheapest one");
  assert.ok(plan.steps.length >= 2);
  const firstStep = plan.steps[0];
  const lastStep = plan.steps[plan.steps.length - 1];
  assert.ok(firstStep.type === "FILL" || firstStep.type === "FILL_FORM");
  assert.strictEqual(firstStep.value, "black earbuds");
  assert.strictEqual(lastStep.type, "CLICK");
  assert.strictEqual(lastStep.ranking, "cheapest");
});

runTest("Spatial grounding: 'Open the product on the right' finds max horizontal X", () => {
  const stepPlan = {
    type: "CLICK",
    targetHint: "product on the right",
    spatial: { relation: "rightOf" },
    semanticCategory: "product",
    isSemantic: true
  };
  const candidates = [
    { label: "Left Product Card", type: "link", bounds: { x: 100, y: 200, width: 180, height: 250 }, index: 0 },
    { label: "Center Product Card", type: "link", bounds: { x: 320, y: 200, width: 180, height: 250 }, index: 1 },
    { label: "Right Product Card", type: "link", bounds: { x: 540, y: 200, width: 180, height: 250 }, index: 2 }
  ];

  const grounded = semanticResolver.resolveSemanticTarget(stepPlan, candidates, { allElements: candidates });
  assert.strictEqual(grounded.action, "CLICK");
  assert.strictEqual(grounded.targetIndex, 2);
  assert.strictEqual(grounded.target, "Right Product Card");
  assert.strictEqual(grounded.concreteElement, candidates[2]);
});

runTest("Spatial grounding: 'Click the option next to Premium'", () => {
  const stepPlan = {
    type: "CLICK",
    targetHint: "option next to Premium",
    spatial: { relation: "nextTo", referenceTarget: "premium" },
    isSemantic: true
  };
  const allElements = [
    { label: "Premium Plan", type: "element", bounds: { x: 200, y: 300, width: 120, height: 40 }, index: 0 },
    { label: "Select Standard Option", type: "button", bounds: { x: 40, y: 300, width: 100, height: 35 }, index: 1 },
    { label: "Select Pro Option", type: "button", bounds: { x: 340, y: 300, width: 100, height: 35 }, index: 2 },
    { label: "Footer Contact Link", type: "link", bounds: { x: 200, y: 900, width: 100, height: 20 }, index: 3 }
  ];

  const grounded = semanticResolver.resolveSemanticTarget(stepPlan, allElements, { allElements });
  assert.strictEqual(grounded.action, "CLICK");
  assert.strictEqual(grounded.targetIndex, 2);
  assert.strictEqual(grounded.target, "Select Pro Option");
});

// -----------------------------------------------------------------------------
// PART 3: SAFETY GATES & FAIL-CLOSED AMBIGUITY VERIFICATION
// -----------------------------------------------------------------------------

console.log("\n--- PART 3: Safety Gates & Safe Fail-Closed Ambiguity Handling ---");

runTest("Ambiguous semantic targets without distinguishing signal fail safely (BLOCKED)", () => {
  const stepPlan = {
    type: "CLICK",
    targetHint: "earbuds",
    objectTarget: "earbuds",
    isSemantic: true
  };
  // Two identical candidates without ordinal or price ranking to differentiate
  const candidates = [
    { label: "Wireless Earbuds", type: "button", bounds: { x: 100, y: 100, width: 100, height: 40 }, index: 0 },
    { label: "Wireless Earbuds", type: "button", bounds: { x: 300, y: 100, width: 100, height: 40 }, index: 1 }
  ];

  const grounded = semanticResolver.resolveSemanticTarget(stepPlan, candidates, { allElements: candidates });
  assert.strictEqual(grounded.action, "NONE");
  assert.strictEqual(grounded.groundingMethod, "ambiguous-semantic-targets");
  assert.ok(grounded.blockedReason.includes("BLOCKED"));
});

runTest("Attribute not verified fails safely (BLOCKED)", () => {
  const stepPlan = {
    type: "CLICK",
    targetHint: "red earbuds",
    attribute: "red",
    attributeValue: "red",
    objectTarget: "earbuds",
    isSemantic: true
  };
  // Candidates exist for 'earbuds', but NONE have 'red'
  const candidates = [
    { label: "Midnight Black Earbuds", type: "link", dataColor: "black", index: 0 },
    { label: "Pure White Earbuds", type: "link", dataColor: "white", index: 1 }
  ];

  const grounded = semanticResolver.resolveSemanticTarget(stepPlan, candidates, { allElements: candidates });
  assert.strictEqual(grounded.action, "NONE");
  assert.strictEqual(grounded.groundingMethod, "attribute-not-verified");
  assert.ok(grounded.blockedReason.includes("BLOCKED"));
});

// ============================================================================
// PART 4: Section 12 Required Tests (Tests 1 through 6)
// ============================================================================
console.log("\n--- PART 4: Section 12 Required Tests (Tests 1 through 6) ---");

runTest("Test 1: 'Open LinkedIn, search for Sundar Pichai, and open his profile.'", () => {
  const task = "Open LinkedIn, search for Sundar Pichai, and open his profile.";
  const parsed = taskParser.parseTask(task);

  assert.strictEqual(parsed.intent, "MULTI_STEP");
  assert.strictEqual(parsed.steps.length, 4);

  // Step 1: NAVIGATE -> LinkedIn
  assert.strictEqual(parsed.steps[0].type, "NAVIGATE");
  assert.strictEqual(parsed.steps[0].target, "LinkedIn");

  // Step 2: FILL -> Search = Sundar Pichai
  assert.strictEqual(parsed.steps[1].type, "FILL");
  assert.strictEqual(parsed.steps[1].value, "Sundar Pichai");

  // Step 3: SUBMIT -> Search
  assert.strictEqual(parsed.steps[2].type, "SUBMIT");
  assert.strictEqual(parsed.steps[2].query, "Sundar Pichai");

  // Step 4: OPEN -> Sundar Pichai profile (No literal grounding attempt for "his profile")
  const step4 = parsed.steps[3];
  assert.strictEqual(step4.action, "OPEN");
  assert.strictEqual(step4.isExplicitTarget, false, "Must NOT treat 'his profile' as literal explicit target");
  assert.strictEqual(step4.explicitTarget, null);
  assert.deepStrictEqual(step4.targetEntity, { type: "person", name: "Sundar Pichai" });
  assert.strictEqual(step4.targetIntent, "profile");

  // Sanitized plan verification
  const planStep4 = parsed.sanitizedPlan[3];
  assert.deepStrictEqual(planStep4.targetEntity, { type: "person", name: "Sundar Pichai" });
  assert.strictEqual(planStep4.targetIntent, "profile");

  // Reasoning planner verification
  const planned = reasoningPlanner.planTask(parsed);
  assert.strictEqual(planned.steps[3].action, "OPEN");
  assert.deepStrictEqual(planned.steps[3].targetEntity, { type: "person", name: "Sundar Pichai" });

  // DOM Grounding layer against fresh perceived search results
  const searchResultCandidates = [
    { label: "Search filter: People", type: "button", index: 1 },
    { label: "Sundar Pichai - CEO at Google and Alphabet", type: "link", index: 5, href: "https://www.linkedin.com/in/sundarpichai" },
    { label: "Satya Nadella - Chairman and CEO at Microsoft", type: "link", index: 6, href: "https://www.linkedin.com/in/satyanadella" }
  ];
  const grounded = semanticResolver.resolveSemanticTarget(planned.steps[3], searchResultCandidates, {
    allElements: searchResultCandidates,
    currentEntity: { type: "person", name: "Sundar Pichai" }
  });

  assert.strictEqual(grounded.action, "OPEN");
  assert.strictEqual(grounded.targetIndex, 5, "Grounds to Sundar Pichai result, NOT literal 'his profile'");
  assert.ok(grounded.groundingScore >= 0.9);
  assert.strictEqual(grounded.targetEntity.name, "Sundar Pichai");
});

runTest("Test 1 Variant: 'Open LinkedIn, find Sundar Pichai, open his profile, and ...'", () => {
  const task = "Open LinkedIn, find Sundar Pichai, open his profile, and ...";
  const parsed = taskParser.parseTask(task);

  assert.strictEqual(parsed.intent, "MULTI_STEP");
  assert.strictEqual(parsed.steps.length, 4);
  assert.strictEqual(parsed.steps[0].type, "NAVIGATE");
  assert.strictEqual(parsed.steps[1].type, "FILL");
  assert.strictEqual(parsed.steps[1].value, "Sundar Pichai");
  assert.strictEqual(parsed.steps[2].type, "SUBMIT");
  assert.strictEqual(parsed.steps[3].action, "OPEN");
  assert.deepStrictEqual(parsed.steps[3].targetEntity, { type: "person", name: "Sundar Pichai" });
  assert.strictEqual(parsed.steps[3].targetIntent, "profile");
  assert.strictEqual(parsed.steps[3].isExplicitTarget, false);
});

runTest("Test 2: 'Search for black earbuds and open the first result.'", () => {
  const task = "Search for black earbuds and open the first result.";
  const parsed = taskParser.parseTask(task);

  assert.strictEqual(parsed.intent, "MULTI_STEP");
  assert.strictEqual(parsed.steps.length, 3);

  // Step 1: SEARCH -> black earbuds
  assert.strictEqual(parsed.steps[0].type, "FILL");
  assert.strictEqual(parsed.steps[0].value, "black earbuds");

  // Step 2: SUBMIT
  assert.strictEqual(parsed.steps[1].type, "SUBMIT");
  assert.strictEqual(parsed.steps[1].query, "black earbuds");

  // Step 3: OPEN -> first grounded result
  const step3 = parsed.steps[2];
  assert.strictEqual(step3.action, "OPEN");
  assert.strictEqual(step3.ordinal, 1);
  assert.strictEqual(step3.isExplicitTarget, false);

  // Ground against search result list
  const results = [
    { label: "Sony WF-1000XM5 Black Wireless Earbuds", type: "link", index: 2, y: 150 },
    { label: "Bose QuietComfort Earbuds Black", type: "link", index: 3, y: 320 }
  ];
  const grounded = semanticResolver.resolveSemanticTarget(step3, results, { allElements: results });
  assert.strictEqual(grounded.action, "OPEN");
  assert.strictEqual(grounded.targetIndex, 2, "Selects first grounded result (Sony)");
});

runTest("Test 3: 'Find the email from Rahul and open it.'", () => {
  const task = "Find the email from Rahul and open it.";
  const parsed = taskParser.parseTask(task);

  assert.strictEqual(parsed.intent, "MULTI_STEP");
  assert.strictEqual(parsed.steps.length, 2);

  // Step 1: LOCATE/CLICK -> Rahul email
  assert.strictEqual(parsed.steps[0].type, "CLICK");
  assert.strictEqual(parsed.steps[0].target, "email");
  assert.strictEqual(parsed.steps[0].context, "Rahul");

  // Step 2: OPEN -> that email
  assert.strictEqual(parsed.steps[1].action, "OPEN");
  assert.deepStrictEqual(parsed.steps[1].targetEntity, { type: "email", name: "Rahul email" });
  assert.strictEqual(parsed.steps[1].targetIntent, "open");
});

runTest("Test 4: 'Find the laptop and add it to the cart.'", () => {
  const task = "Find the laptop and add it to the cart.";
  const parsed = taskParser.parseTask(task);

  assert.strictEqual(parsed.intent, "MULTI_STEP");
  assert.strictEqual(parsed.steps.length, 2);

  // Step 1: LOCATE -> laptop
  assert.strictEqual(parsed.steps[0].type, "CLICK");
  assert.strictEqual(parsed.steps[0].target, "laptop");

  // Step 2: ADD -> same laptop (add to cart)
  assert.strictEqual(parsed.steps[1].legacyTarget, "ADD_TO_CART_BUTTON");
  assert.deepStrictEqual(parsed.steps[1].targetEntity, { type: "product", name: "laptop" });
  assert.strictEqual(parsed.steps[1].targetIntent, "add_to_cart");
});

runTest("Test 5: 'Search for Sundar Pichai.'", () => {
  const task = "Search for Sundar Pichai.";
  const parsed = taskParser.parseTask(task);

  assert.strictEqual(parsed.intent, "MULTI_STEP");
  assert.strictEqual(parsed.steps.length, 2);
  assert.strictEqual(parsed.steps[0].type, "FILL");
  assert.strictEqual(parsed.steps[0].value, "Sundar Pichai");
  assert.strictEqual(parsed.steps[1].type, "SUBMIT");
  assert.strictEqual(parsed.steps[1].query, "Sundar Pichai");
});

runTest("Test 6: 'Open LinkedIn.'", () => {
  const task = "Open LinkedIn.";
  const parsed = taskParser.parseTask(task);

  assert.strictEqual(parsed.intent, "NAVIGATE");
  assert.strictEqual(parsed.steps.length, 1);
  assert.strictEqual(parsed.steps[0].type, "NAVIGATE");
  assert.strictEqual(parsed.steps[0].target, "LinkedIn");
  assert.strictEqual(parsed.steps[0].url, "https://www.linkedin.com");
});

// -----------------------------------------------------------------------------
// PART 5: CONTEXTUAL ENTITY -> PAGE ELEMENT GROUNDING (Section 13 Tests)
// -----------------------------------------------------------------------------

console.log("\n--- PART 5: Contextual Entity -> Page Element Grounding (Section 13) ---");

runTest("Section 13 - TEST 1: 'Search for Sundar Pichai and open his profile.' (Must NOT produce target = 'Sundar Pichai profile')", () => {
  const task = "Search for Sundar Pichai and open his profile.";
  const parsed = taskParser.parseTask(task);
  const planned = reasoningPlanner.planTask(parsed);

  assert.strictEqual(parsed.intent, "MULTI_STEP");
  assert.strictEqual(parsed.steps.length, 3);

  // Step 1: FILL search
  assert.strictEqual(parsed.steps[0].type, "FILL");
  assert.strictEqual(parsed.steps[0].value, "Sundar Pichai");

  // Step 2: SUBMIT search
  assert.strictEqual(parsed.steps[1].type, "SUBMIT");
  assert.strictEqual(parsed.steps[1].query, "Sundar Pichai");

  // Step 3: OPEN/CLICK entity = Sundar Pichai, intent = profile
  const step3 = parsed.steps[2];
  assert.strictEqual(step3.action, "OPEN");
  assert.deepStrictEqual(step3.targetEntity, { type: "person", name: "Sundar Pichai" });
  assert.strictEqual(step3.targetIntent, "profile");

  // MUST NOT produce target = "Sundar Pichai profile"
  assert.strictEqual(step3.target, "Sundar Pichai", "Target must be entity name, NOT 'Sundar Pichai profile'");
  assert.notStrictEqual(step3.target, "Sundar Pichai profile");

  const plannedStep3 = planned.steps[2];
  assert.strictEqual(plannedStep3.target, "Sundar Pichai", "Planned target must be entity name, NOT 'Sundar Pichai profile'");
  assert.notStrictEqual(plannedStep3.target, "Sundar Pichai profile");
  assert.deepStrictEqual(plannedStep3.targetEntity, { type: "person", name: "Sundar Pichai" });
  assert.strictEqual(plannedStep3.targetIntent, "profile");
});

runTest("Section 13 - TEST 2: Grounding mock for 'Search for Sundar Pichai and open his profile.'", () => {
  const task = "Search for Sundar Pichai and open his profile.";
  const parsed = taskParser.parseTask(task);
  const planned = reasoningPlanner.planTask(parsed);

  const candidate = [{ text: "Sundar Pichai", role: "link", clickable: true }];
  const grounded = semanticResolver.resolveSemanticTarget(planned.steps[2], candidate, { allElements: candidate });

  assert.strictEqual(grounded.action, "OPEN");
  assert.strictEqual(grounded.target, "Sundar Pichai");
  assert.strictEqual(grounded.targetIndex, 0);
  assert.ok(grounded.groundingScore >= 0.9);
  assert.deepStrictEqual(grounded.concreteElement, candidate[0]);
});

runTest("Section 13 - TEST 3: 'Search for black Sony earbuds and open the product.' (Must NOT require 'black Sony earbuds product')", () => {
  const task = "Search for black Sony earbuds and open the product.";
  const parsed = taskParser.parseTask(task);
  const planned = reasoningPlanner.planTask(parsed);

  assert.strictEqual(parsed.intent, "MULTI_STEP");
  assert.strictEqual(parsed.steps.length, 3);
  assert.strictEqual(parsed.steps[0].value, "black Sony earbuds");

  const step3 = parsed.steps[2];
  assert.strictEqual(step3.action, "OPEN");
  assert.deepStrictEqual(step3.targetEntity, { type: "product", name: "black Sony earbuds" });
  assert.strictEqual(step3.targetIntent, "product");
  assert.strictEqual(step3.target, "black Sony earbuds");
  assert.notStrictEqual(step3.target, "black Sony earbuds product");

  const plannedStep3 = planned.steps[2];
  assert.strictEqual(plannedStep3.target, "black Sony earbuds");
  assert.notStrictEqual(plannedStep3.target, "black Sony earbuds product");
  assert.deepStrictEqual(plannedStep3.targetEntity, { type: "product", name: "black Sony earbuds" });
  assert.strictEqual(plannedStep3.targetIntent, "product");
});

runTest("Section 13 - TEST 4: 'Search for John and open his profile.'", () => {
  const task = "Search for John and open his profile.";
  const parsed = taskParser.parseTask(task);
  const planned = reasoningPlanner.planTask(parsed);

  assert.strictEqual(parsed.intent, "MULTI_STEP");
  assert.strictEqual(parsed.steps.length, 3);
  assert.strictEqual(parsed.steps[0].value, "John");

  const step3 = parsed.steps[2];
  assert.strictEqual(step3.action, "OPEN");
  assert.deepStrictEqual(step3.targetEntity, { type: "person", name: "John" });
  assert.strictEqual(step3.targetIntent, "profile");
  assert.strictEqual(step3.target, "John");

  const plannedStep3 = planned.steps[2];
  assert.strictEqual(plannedStep3.target, "John");
  assert.deepStrictEqual(plannedStep3.targetEntity, { type: "person", name: "John" });
  assert.strictEqual(plannedStep3.targetIntent, "profile");
});

runTest("Section 13 - TEST 5: Ambiguous candidates ('Sundar Pichai', 'Sundar Pichai Foundation') fail safely (BLOCKED)", () => {
  const task = "Search for Sundar Pichai and open his profile.";
  const parsed = taskParser.parseTask(task);
  const planned = reasoningPlanner.planTask(parsed);

  const ambiguousCandidates = [
    { label: "Sundar Pichai", role: "link", type: "link", clickable: true },
    { label: "Sundar Pichai Foundation", role: "link", type: "link", clickable: true }
  ];

  const grounded = semanticResolver.resolveSemanticTarget(planned.steps[2], ambiguousCandidates, { allElements: ambiguousCandidates });
  assert.strictEqual(grounded.action, "NONE", "Must return action=NONE when candidates are ambiguous");
  assert.strictEqual(grounded.groundingMethod, "ambiguous-semantic-targets");
  assert.ok(grounded.blockedReason.includes("BLOCKED"), "Must block safely rather than blindly clicking");
});

console.log("\n=======================================================");
console.log(`   ALL ${passedCount}/${totalCount} SEMANTIC UNDERSTANDING TESTS PASSED!`);
console.log("=======================================================\n");
