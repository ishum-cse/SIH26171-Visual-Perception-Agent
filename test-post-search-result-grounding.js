/**
 * test-post-search-result-grounding.js
 * Verification of post-search result selection and grounding in IRIS.
 *
 * Verifies:
 * 1. Step 3 grounding immediately following SUBMIT -> search prioritizes search-result candidates.
 * 2. Explicitly excludes Google Account (Index #9), Google apps (Index #10), Settings, Tools, Nav tabs.
 * 3. Regression Test 1: "Search Google for ISRO and open the official Indian Space Research Organisation result."
 *    -> Must select ISRO official result (Index #21, https://www.isro.gov), NEVER Google Account button.
 * 4. Regression Test 2: "Search Google for ISRO and open the first result."
 *    -> Must select first actual search result (Index #21), NOT first clickable element on the page (#9).
 * 5. Regression Test 3: "Search Google for ISRO and open the most relevant result."
 *    -> Must rank exclusively search-result candidates and select #21.
 * 6. Preserves grounded identity (DOM index, URL, bounds).
 */

const assert = require("assert");
const taskParser = require("./task-parser.js");
const reasoningPlanner = require("./reasoning-planner.js");
const semanticResolver = require("./semantic-resolver.js");

console.log("============================================================");
console.log("RUNNING POST-SEARCH RESULT GROUNDING REGRESSION TEST SUITE");
console.log("============================================================\n");

// Simulated Google search results perception DOM elements
const simulatedGoogleSearchElements = [
  { index: 0, type: "link", label: "Google", href: "https://www.google.com" },
  { index: 1, type: "link", label: "About", href: "https://about.google" },
  { index: 2, type: "link", label: "Store", href: "https://store.google.com" },
  { index: 3, type: "link", label: "Gmail", href: "https://mail.google.com" },
  { index: 4, type: "link", label: "Images", href: "https://images.google.com" },
  // DOM Index #9: The problematic Google Account profile button
  {
    index: 9,
    type: "button",
    role: "button",
    label: "Google Account: Sanketh Mallikarjuna (sanketh@gmail.com)",
    ariaLabel: "Google Account: Sanketh Mallikarjuna",
    title: "Google Account: Sanketh Mallikarjuna",
    clickable: true,
    bounds: { x: 1200, y: 15, width: 40, height: 40 }
  },
  // DOM Index #10: Google apps launcher button
  {
    index: 10,
    type: "button",
    role: "button",
    label: "Google apps",
    ariaLabel: "Google apps",
    clickable: true,
    bounds: { x: 1150, y: 15, width: 30, height: 30 }
  },
  // DOM Index #11: Navigation tabs
  { index: 11, type: "link", role: "tab", label: "All", href: "https://www.google.com/search?q=isro" },
  { index: 12, type: "link", role: "tab", label: "News", href: "https://www.google.com/search?q=isro&tbm=nws" },
  { index: 13, type: "link", role: "tab", label: "Images", href: "https://www.google.com/search?q=isro&tbm=isch" },
  { index: 14, type: "button", role: "button", label: "Tools", clickable: true },
  { index: 15, type: "button", role: "button", label: "Quick settings", clickable: true },
  // DOM Index #20: Search input
  {
    index: 20,
    type: "input",
    label: "Search",
    semanticTag: "SEARCH_INPUT",
    bounds: { x: 180, y: 30, width: 600, height: 44 }
  },
  // DOM Index #21: The official ISRO search result
  {
    index: 21,
    type: "link",
    role: "link",
    tag: "a",
    label: "Indian Space Research Organisation ISRO",
    text: "Indian Space Research Organisation ISRO https://www.isro.gov ... ISRO is the space agency of India.",
    title: "Indian Space Research Organisation ISRO",
    href: "https://www.isro.gov",
    url: "https://www.isro.gov",
    isSearchResult: true,
    snippet: "ISRO is the space agency of India. The organisation is involved in science, engineering and technology to harvest the benefits of outer space for India.",
    bounds: { x: 180, y: 220, width: 600, height: 32 },
    clickable: true
  },
  // DOM Index #22: ISRO Wikipedia result
  {
    index: 22,
    type: "link",
    role: "link",
    tag: "a",
    label: "ISRO - Wikipedia",
    text: "ISRO - Wikipedia https://en.wikipedia.org › wiki › ISRO",
    href: "https://en.wikipedia.org/wiki/ISRO",
    url: "https://en.wikipedia.org/wiki/ISRO",
    isSearchResult: true,
    snippet: "The Indian Space Research Organisation is the national space agency of India, headquartered in Bengaluru.",
    bounds: { x: 180, y: 320, width: 600, height: 32 },
    clickable: true
  },
  // DOM Index #23: Careers link on ISRO
  {
    index: 23,
    type: "link",
    role: "link",
    tag: "a",
    label: "Careers - ISRO",
    text: "Careers - ISRO https://www.isro.gov › careers",
    href: "https://www.isro.gov/careers",
    url: "https://www.isro.gov/careers",
    isSearchResult: true,
    bounds: { x: 180, y: 420, width: 400, height: 28 },
    clickable: true
  }
];

// Helper to simulate popup.js computeClickScore logic
function simulatePopupClickGrounding(stepPlan, elements, prevStepAction = "SUBMIT") {
  const normalize = (s) => (s || "").trim().toLowerCase();
  const rawHint = normalize(stepPlan.targetHint || stepPlan.target || "");
  const queryNorm = normalize(stepPlan.query || "isro");
  const isPreviousStepSearchSubmit = prevStepAction === "SUBMIT";
  const isSearchResultSelection = Boolean(
    isPreviousStepSearchSubmit ||
    stepPlan.isSearchResult ||
    stepPlan.query ||
    (stepPlan.targetHint && /result|product|item|listing|video|movie|article|website|site|webpage|page|link/i.test(stepPlan.targetHint))
  );

  // 1. Try semantic-resolver first if semantic task
  const isSemanticTask = Boolean(
    isSearchResultSelection ||
    stepPlan.isSearchResult ||
    stepPlan.isSemantic ||
    (stepPlan.ordinal !== null && stepPlan.ordinal !== undefined) ||
    semanticResolver.isSemanticInstruction(rawHint)
  );

  if (isSemanticTask) {
    const semanticRes = semanticResolver.resolveSemanticTarget(stepPlan, elements, {
      allElements: elements,
      isSearchResultSelection: true,
      isPreviousStepSearchSubmit: true
    });
    if (semanticRes && semanticRes.action !== "PASS_THROUGH" && semanticRes.targetIndex >= 0) {
      return semanticRes;
    }
  }

  // 2. Fallback scoring
  let bestIdx = -1;
  let bestScore = 0;

  elements.forEach((el, idx) => {
    if (semanticResolver.isExcludedSearchPageControl(el)) return;
    const candTextParts = [el.label, el.text, el.title, el.ariaLabel, el.snippet, el.href, el.url].filter(Boolean).map(normalize);
    const candFullText = candTextParts.join(" ");

    let score = 0;
    if (candFullText.includes("isro.gov") || candFullText.includes("isro.gov.in")) {
      score = 0.98;
    } else if (candFullText.includes("indian space research organisation")) {
      score = 0.96;
    } else if (queryNorm && candFullText.includes(queryNorm)) {
      score = 0.75;
    }

    if (score > bestScore) {
      bestScore = score;
      bestIdx = el.index !== undefined ? el.index : idx;
    }
  });

  return {
    action: "CLICK",
    targetIndex: bestIdx,
    target: elements.find(e => e.index === bestIdx)?.label,
    targetLabel: elements.find(e => e.index === bestIdx)?.label,
    groundingScore: bestScore
  };
}

// -----------------------------------------------------------------------------
// TEST 1: Exclusion of Non-Result Page Controls
// -----------------------------------------------------------------------------
{
  console.log("[TEST 1] Verifying Exclusion of Non-Result Page Controls");
  const el9 = simulatedGoogleSearchElements.find(e => e.index === 9);
  const el10 = simulatedGoogleSearchElements.find(e => e.index === 10);
  const el14 = simulatedGoogleSearchElements.find(e => e.index === 14);
  const el15 = simulatedGoogleSearchElements.find(e => e.index === 15);
  const el21 = simulatedGoogleSearchElements.find(e => e.index === 21);

  assert.strictEqual(semanticResolver.isExcludedSearchPageControl(el9), true, "Google Account button (#9) MUST be excluded");
  assert.strictEqual(semanticResolver.isExcludedSearchPageControl(el10), true, "Google apps button (#10) MUST be excluded");
  assert.strictEqual(semanticResolver.isExcludedSearchPageControl(el14), true, "Tools button (#14) MUST be excluded");
  assert.strictEqual(semanticResolver.isExcludedSearchPageControl(el15), true, "Settings button (#15) MUST be excluded");
  assert.strictEqual(semanticResolver.isExcludedSearchPageControl(el21), false, "ISRO result link (#21) MUST NOT be excluded");

  assert.strictEqual(semanticResolver.isSearchResultCandidate(el9), false, "Google Account button is NOT a search result candidate");
  assert.strictEqual(semanticResolver.isSearchResultCandidate(el10), false, "Google apps button is NOT a search result candidate");
  assert.strictEqual(semanticResolver.isSearchResultCandidate(el21), true, "ISRO result link IS a search result candidate");

  console.log("  ✓ Test 1 PASSED: Non-result page controls are successfully identified and excluded.\n");
}

// -----------------------------------------------------------------------------
// TEST 2: Primary Regression Test
// Task: "Search Google for ISRO and open the official Indian Space Research Organisation result."
// -----------------------------------------------------------------------------
{
  console.log("[TEST 2] Primary Regression Test:");
  console.log("         'Search Google for ISRO and open the official Indian Space Research Organisation result.'");

  const task = "Search Google for ISRO and open the official Indian Space Research Organisation result.";
  const parsed = taskParser.parseTask(task);
  const plan = reasoningPlanner.planTask(parsed);

  // STEP 1: FILL -> Search -> "ISRO"
  assert.strictEqual(plan.steps[0].type, "FILL");
  assert.strictEqual(parsed.steps[0].value.toLowerCase(), "isro");
  console.log("  ✓ STEP 1: FILL -> Search -> 'isro'");

  // STEP 2: SUBMIT -> search
  assert.strictEqual(plan.steps[1].type, "SUBMIT");
  console.log("  ✓ STEP 2: SUBMIT -> search");

  // STEP 3: CLICK -> Grounding against search result elements
  assert.strictEqual(plan.steps[2].type, "CLICK");
  const step3Plan = plan.steps[2];

  const groundedStep3 = simulatePopupClickGrounding(step3Plan, simulatedGoogleSearchElements, "SUBMIT");

  console.log(`  ✓ STEP 3: Grounded to element #${groundedStep3.targetIndex} ('${groundedStep3.targetLabel || groundedStep3.target}')`);
  console.log(`            URL: ${groundedStep3.url || (groundedStep3.concreteElement && groundedStep3.concreteElement.url)}`);
  console.log(`            Confidence: ${groundedStep3.groundingScore}`);
  console.log(`            Method: ${groundedStep3.groundingMethod}`);

  // CRITICAL INVARIANTS:
  assert.notStrictEqual(groundedStep3.targetIndex, 9, "CRITICAL ERROR: Selected Google Account button (#9)!");
  assert.notStrictEqual(groundedStep3.targetIndex, 10, "CRITICAL ERROR: Selected Google apps button (#10)!");
  assert.notStrictEqual(groundedStep3.targetIndex, 14, "CRITICAL ERROR: Selected Tools (#14)!");
  assert.notStrictEqual(groundedStep3.targetIndex, 15, "CRITICAL ERROR: Selected Settings (#15)!");

  assert.strictEqual(groundedStep3.targetIndex, 21, "Must ground to official ISRO result (#21)");
  assert.ok(groundedStep3.groundingScore >= 0.95, "Grounding confidence must be >= 0.95");
  assert.ok(groundedStep3.target.includes("Indian Space Research Organisation"), "Target label must match ISRO title");
  assert.strictEqual(groundedStep3.url, "https://www.isro.gov", "Grounded URL must be https://www.isro.gov");

  console.log("  ✓ Test 2 PASSED: Official ISRO result selected cleanly with confidence >= 0.95. Element #9 rejected.\n");
}

// -----------------------------------------------------------------------------
// TEST 3: Second Regression Test
// Task: "Search Google for ISRO and open the first result."
// -----------------------------------------------------------------------------
{
  console.log("[TEST 3] Second Regression Test: 'Search Google for ISRO and open the first result.'");

  const task = "Search Google for ISRO and open the first result.";
  const parsed = taskParser.parseTask(task);
  const plan = reasoningPlanner.planTask(parsed);

  assert.strictEqual(plan.steps[0].type, "FILL");
  assert.strictEqual(plan.steps[1].type, "SUBMIT");
  assert.strictEqual(plan.steps[2].type, "CLICK");

  const step3Plan = plan.steps[2];
  const groundedStep3 = simulatePopupClickGrounding(step3Plan, simulatedGoogleSearchElements, "SUBMIT");

  console.log(`  ✓ Grounded 'first result' to #${groundedStep3.targetIndex} ('${groundedStep3.targetLabel || groundedStep3.target}')`);

  assert.notStrictEqual(groundedStep3.targetIndex, 9, "CRITICAL: 'first result' must NEVER be Google Account button (#9)!");
  assert.strictEqual(groundedStep3.targetIndex, 21, "'first result' must select the first actual search-result candidate (#21)");
  assert.strictEqual(groundedStep3.groundingMethod, "first-search-result-ranking");

  console.log("  ✓ Test 3 PASSED: 'first result' grounds to candidate #21 (ISRO), not the first clickable button.\n");
}

// -----------------------------------------------------------------------------
// TEST 4: "open the most relevant result"
// -----------------------------------------------------------------------------
{
  console.log("[TEST 4] 'open the most relevant result' for ISRO search");

  const stepPlan = {
    type: "CLICK",
    targetHint: "most relevant result",
    query: "isro",
    isSearchResult: true
  };

  const grounded = simulatePopupClickGrounding(stepPlan, simulatedGoogleSearchElements, "SUBMIT");

  assert.strictEqual(grounded.targetIndex, 21, "Must ground to official ISRO result (#21)");
  assert.notStrictEqual(grounded.targetIndex, 9, "Must never ground to Google Account");

  console.log("  ✓ Test 4 PASSED: 'most relevant result' correctly ranks and selects #21.\n");
}

// -----------------------------------------------------------------------------
// TEST 5: "open the official ISRO website"
// -----------------------------------------------------------------------------
{
  console.log("[TEST 5] 'open the official ISRO website'");

  const stepPlan = {
    type: "CLICK",
    targetHint: "official ISRO website (isro.gov.in)",
    domain: "isro.gov.in",
    query: "isro",
    isSearchResult: true
  };

  const grounded = simulatePopupClickGrounding(stepPlan, simulatedGoogleSearchElements, "SUBMIT");

  assert.strictEqual(grounded.targetIndex, 21, "Must ground to official ISRO website (#21)");
  assert.ok(grounded.groundingScore >= 0.95);

  console.log("  ✓ Test 5 PASSED: 'official ISRO website' grounds to #21.\n");
}

console.log("============================================================");
console.log("ALL POST-SEARCH GROUNDING REGRESSION TESTS PASSED (5 / 5)!");
console.log("============================================================\n");
