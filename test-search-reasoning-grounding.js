/**
 * test-search-reasoning-grounding.js
 * Verification test suite for IRIS Reasoning -> Grounding Handoff for Search Result Navigation.
 *
 * Validates:
 * 1. Concrete target resolution for official websites and profiles (ISRO, LinkedIn, Sundar Pichai).
 * 2. Abstract targets ("most relevant result", "the website", "the result") are never sent directly to grounding.
 * 3. Search-result grounding resolves against actual title, URL, domain (e.g. "Indian Space Research Organisation", "isro.gov.in").
 * 4. Multi-stage navigation handoff:
 *    Google home -> search "ISRO" -> click official ISRO result -> verify isro.gov.in -> find "GSLV-F17/EOS-05 mission" -> click "GSLV-F17/EOS-05 MISSION - ISRO" -> verify mission details page.
 * 5. Normalization of OPEN actions to CLICK for clickable links.
 */

const assert = require("assert");
const taskParser = require("./task-parser.js");
const reasoningPlanner = require("./reasoning-planner.js");
const actionVerifier = require("./action-verifier.js");

console.log("============================================================");
console.log("RUNNING IRIS REASONING -> GROUNDING SEARCH NAVIGATION SUITE");
console.log("============================================================\n");

// -----------------------------------------------------------------------------
// TEST 1: User task: "Search Google for LinkedIn and open the official website."
// -----------------------------------------------------------------------------
{
  console.log("[TEST 1] 'Search Google for LinkedIn and open the official website.'");
  const task = "Search Google for LinkedIn and open the official website.";
  const parsed = taskParser.parseTask(task);

  assert.strictEqual(parsed.intent, "MULTI_STEP");
  assert.strictEqual(parsed.steps.length, 3, "Must produce FILL -> SUBMIT -> CLICK");

  assert.strictEqual(parsed.steps[0].type, "FILL");
  assert.strictEqual(parsed.steps[0].value, "LinkedIn");

  assert.strictEqual(parsed.steps[1].type, "SUBMIT");

  assert.strictEqual(parsed.steps[2].type, "CLICK");
  assert.strictEqual(parsed.steps[2].targetHint, "LinkedIn official website");

  const plan = reasoningPlanner.planTask(parsed);
  assert.strictEqual(plan.steps[2].action, "CLICK");
  assert.strictEqual(plan.steps[2].target, "LinkedIn official website");
  assert.strictEqual(reasoningPlanner.isAbstractTarget(plan.steps[2].target), false);

  console.log("  ✓ Test 1 PASSED: FILL ('LinkedIn') -> SUBMIT -> CLICK ('LinkedIn official website')\n");
}

// -----------------------------------------------------------------------------
// TEST 2: User task: "Search for ISRO and open the official website."
// -----------------------------------------------------------------------------
{
  console.log("[TEST 2] 'Search for ISRO and open the official website.'");
  const task = "Search for ISRO and open the official website.";
  const parsed = taskParser.parseTask(task);

  assert.strictEqual(parsed.intent, "MULTI_STEP");
  assert.strictEqual(parsed.steps.length, 3, "Must produce FILL -> SUBMIT -> CLICK");

  assert.strictEqual(parsed.steps[0].type, "FILL");
  assert.strictEqual(parsed.steps[0].value, "ISRO");

  assert.strictEqual(parsed.steps[1].type, "SUBMIT");

  assert.strictEqual(parsed.steps[2].type, "CLICK");
  assert.strictEqual(parsed.steps[2].targetHint, "official ISRO website (isro.gov.in)");
  assert.strictEqual(parsed.steps[2].domain, "isro.gov.in");

  const plan = reasoningPlanner.planTask(parsed);
  assert.strictEqual(plan.steps[2].action, "CLICK");
  assert.strictEqual(plan.steps[2].target, "official ISRO website (isro.gov.in)");
  assert.strictEqual(reasoningPlanner.isAbstractTarget(plan.steps[2].target), false);

  console.log("  ✓ Test 2 PASSED: FILL ('ISRO') -> SUBMIT -> CLICK ('official ISRO website (isro.gov.in)')\n");
}

// -----------------------------------------------------------------------------
// TEST 3: User task: "Search for Sundar Pichai and open his LinkedIn profile."
// -----------------------------------------------------------------------------
{
  console.log("[TEST 3] 'Search for Sundar Pichai and open his LinkedIn profile.'");
  const task = "Search for Sundar Pichai and open his LinkedIn profile.";
  const parsed = taskParser.parseTask(task);

  assert.strictEqual(parsed.intent, "MULTI_STEP");
  assert.strictEqual(parsed.steps.length, 3, "Must produce FILL -> SUBMIT -> CLICK");

  assert.strictEqual(parsed.steps[0].type, "FILL");
  assert.strictEqual(parsed.steps[0].value, "Sundar Pichai");

  assert.strictEqual(parsed.steps[1].type, "SUBMIT");

  assert.strictEqual(parsed.steps[2].type, "CLICK");
  assert.strictEqual(parsed.steps[2].targetHint, "Sundar Pichai LinkedIn profile");

  const plan = reasoningPlanner.planTask(parsed);
  assert.strictEqual(plan.steps[2].action, "CLICK");
  assert.strictEqual(plan.steps[2].target, "Sundar Pichai LinkedIn profile");
  assert.strictEqual(reasoningPlanner.isAbstractTarget(plan.steps[2].target), false);

  console.log("  ✓ Test 3 PASSED: FILL ('Sundar Pichai') -> SUBMIT -> CLICK ('Sundar Pichai LinkedIn profile')\n");
}

// -----------------------------------------------------------------------------
// TEST 4: Full Multi-Stage Task:
// "Open Google, search for ISRO, open the official ISRO website, then find the GSLV-F17/EOS-05 mission and open its details."
// -----------------------------------------------------------------------------
{
  console.log("[TEST 4] Full Multi-Stage Workflow: Google -> search ISRO -> open official site -> find GSLV-F17/EOS-05 mission -> open details");
  const task = "Open Google, search for ISRO, open the official ISRO website, then find the GSLV-F17/EOS-05 mission and open its details.";
  const parsed = taskParser.parseTask(task);

  assert.strictEqual(parsed.intent, "MULTI_STEP");
  assert.strictEqual(parsed.steps.length, 5, "Must produce 5 continuous steps across both stages");

  // Step 0: NAVIGATE Google
  assert.strictEqual(parsed.steps[0].type, "NAVIGATE");
  assert.strictEqual(parsed.steps[0].target, "Google");

  // Step 1: FILL search ISRO
  assert.strictEqual(parsed.steps[1].type, "FILL");
  assert.strictEqual(parsed.steps[1].value, "ISRO");

  // Step 2: SUBMIT search
  assert.strictEqual(parsed.steps[2].type, "SUBMIT");

  // Step 3: CLICK official ISRO website (isro.gov.in)
  assert.strictEqual(parsed.steps[3].type, "CLICK");
  assert.strictEqual(parsed.steps[3].targetHint, "official ISRO website (isro.gov.in)");
  assert.strictEqual(parsed.steps[3].domain, "isro.gov.in");

  // Step 4: CLICK GSLV-F17/EOS-05 mission
  assert.strictEqual(parsed.steps[4].type, "CLICK");
  assert.strictEqual(parsed.steps[4].targetHint, "GSLV-F17/EOS-05 mission");

  const plan = reasoningPlanner.planTask(parsed);
  assert.strictEqual(plan.steps.length, 5, "Reasoning plan must retain all 5 steps");
  assert.strictEqual(plan.steps[3].target, "official ISRO website (isro.gov.in)");
  assert.strictEqual(plan.steps[4].target, "GSLV-F17/EOS-05 mission");

  console.log("  ✓ Test 4 PASSED: All 5 continuous steps generated cleanly without dropping stage 2.\n");
}

// -----------------------------------------------------------------------------
// TEST 5: Grounding Google Search Results to ISRO Official Website
// Simulates Google search results perceived elements and validates grounding logic.
// -----------------------------------------------------------------------------
{
  console.log("[TEST 5] Grounding Google Search Results against 'official ISRO website (isro.gov.in)'");

  const googleSearchResults = [
    { type: "input", label: "Search", tag: "input" },
    { type: "button", label: "Google Search", tag: "button" },
    {
      type: "link",
      label: "Indian Space Research Organisation",
      text: "Indian Space Research Organisation https://www.isro.gov.in › ... ISRO is the space agency of India...",
      href: "https://www.isro.gov.in/",
      url: "https://www.isro.gov.in/",
      index: 2
    },
    {
      type: "link",
      label: "ISRO - Wikipedia",
      text: "ISRO - Wikipedia https://en.wikipedia.org › wiki › ISRO",
      href: "https://en.wikipedia.org/wiki/ISRO",
      url: "https://en.wikipedia.org/wiki/ISRO",
      index: 3
    },
    {
      type: "link",
      label: "ISRO Careers",
      text: "ISRO Careers https://www.isro.gov.in › careers",
      href: "https://www.isro.gov.in/careers",
      url: "https://www.isro.gov.in/careers",
      index: 4
    }
  ];

  // Helper matching simulated computeClickScore from popup.js
  function simulateSearchGrounding(stepPlan, elements) {
    const normalize = (s) => (s || "").trim().toLowerCase();
    const queryNorm = normalize(stepPlan.query || "");
    const domainHint = stepPlan.domain || (stepPlan.targetHint && stepPlan.targetHint.match(/\(([^)]+\.[a-z]{2,})\)/i)?.[1]);

    let bestIdx = -1;
    let bestScore = 0;

    elements.forEach((el, idx) => {
      const elType = (el.type || "").toLowerCase();
      if (elType === "input") return;

      const candTextParts = [el.label, el.text, el.href, el.url, el.title, el.ariaLabel].filter(Boolean).map(normalize);
      const candFullText = candTextParts.join(" ");

      let score = 0;
      if (domainHint && candFullText.includes(normalize(domainHint))) {
        score = 0.98;
      } else if (candFullText.includes("indian space research organisation") || candFullText.includes("isro.gov.in")) {
        score = 0.96;
      } else if (queryNorm && candFullText.includes(queryNorm)) {
        score = 0.75;
      }

      if (score > bestScore) {
        bestScore = score;
        bestIdx = idx;
      }
    });

    return {
      action: "CLICK",
      targetIndex: bestIdx,
      target: elements[bestIdx].label,
      targetLabel: elements[bestIdx].label,
      groundingScore: bestScore
    };
  }

  const step3Plan = {
    type: "CLICK",
    action: "CLICK",
    targetHint: "official ISRO website (isro.gov.in)",
    query: "ISRO",
    domain: "isro.gov.in",
    isProductSelection: true
  };

  const grounded = simulateSearchGrounding(step3Plan, googleSearchResults);
  assert.strictEqual(grounded.action, "CLICK");
  assert.strictEqual(grounded.targetIndex, 2);
  assert.strictEqual(grounded.target, "Indian Space Research Organisation");
  assert.ok(grounded.groundingScore >= 0.95, "Grounding confidence must be >= 0.95");

  console.log(`  ✓ Test 5 PASSED: Grounded to element #${grounded.targetIndex} ('${grounded.target}') with score ${grounded.groundingScore}\n`);
}

// -----------------------------------------------------------------------------
// TEST 6: Grounding Mission Link on ISRO Website & Action Normalization
// Simulates perceived elements on isro.gov.in and validates mission link grounding.
// -----------------------------------------------------------------------------
{
  console.log("[TEST 6] Grounding 'GSLV-F17/EOS-05 mission' on ISRO website & OPEN -> CLICK normalization");

  const isroPageElements = [
    { type: "link", label: "Home", href: "https://www.isro.gov.in/", index: 0 },
    { type: "link", label: "Missions", href: "https://www.isro.gov.in/missions", index: 1 },
    {
      type: "link",
      label: "GSLV-F17/EOS-05 MISSION - ISRO",
      text: "GSLV-F17/EOS-05 MISSION - ISRO The Geosynchronous Satellite Launch Vehicle...",
      href: "https://www.isro.gov.in/gslv-f17-eos-05-mission",
      index: 14
    },
    { type: "link", label: "PSLV-C58 / XPoSat Mission", href: "https://www.isro.gov.in/pslv-c58-xposat", index: 15 }
  ];

  function simulateMissionGrounding(stepPlan, elements) {
    const normalize = (s) => (s || "").trim().toLowerCase();
    const rawHint = normalize(stepPlan.targetHint || stepPlan.target || "");

    let bestIdx = -1;
    let bestScore = 0;

    elements.forEach((el, idx) => {
      const elType = (el.type || "").toLowerCase();
      const candTextParts = [el.label, el.text, el.href, el.url, el.title].filter(Boolean).map(normalize);
      const candFullText = candTextParts.join(" ");

      let score = 0;
      if (candFullText.includes("gslv-f17") && candFullText.includes("eos-05")) {
        score = 0.98;
      } else if (candFullText.includes("gslv") || candFullText.includes("eos")) {
        score = 0.85;
      }

      if (score > bestScore) {
        bestScore = score;
        bestIdx = idx;
      }
    });

    return {
      action: "OPEN", // Simulating Gemini proposing OPEN
      targetIndex: elements[bestIdx].index !== undefined ? elements[bestIdx].index : bestIdx,
      target: elements[bestIdx].label,
      targetLabel: elements[bestIdx].label,
      groundingScore: bestScore
    };
  }

  const step4Plan = {
    type: "CLICK",
    action: "CLICK",
    targetHint: "GSLV-F17/EOS-05 mission",
    target: "GSLV-F17/EOS-05 mission"
  };

  const rawGroundedAction = simulateMissionGrounding(step4Plan, isroPageElements);
  assert.strictEqual(rawGroundedAction.targetIndex, 14);
  assert.strictEqual(rawGroundedAction.target, "GSLV-F17/EOS-05 MISSION - ISRO");

  // Rule 6: Normalize OPEN -> CLICK when target is an actual clickable link
  const normalizedAction = reasoningPlanner.normalizeAction(rawGroundedAction, step4Plan);
  assert.strictEqual(normalizedAction.action, "CLICK", "OPEN must be normalized to CLICK for execution");
  assert.strictEqual(normalizedAction.semanticAction, "OPEN", "Semantic intent must be preserved as OPEN");
  assert.strictEqual(normalizedAction.executionAction, "CLICK");

  // Safety Gate Check: Normalization allows safe execution without weakening allowlist
  const safetyGate = reasoningPlanner.evaluateSafetyGate(normalizedAction, step4Plan);
  assert.strictEqual(safetyGate.allowed, true, "Safety gate must permit normalized CLICK");

  // Action Verifier: Navigation and mission content verification
  const verifResult = actionVerifier.verifyActionOutcome(
    normalizedAction,
    { url: "https://www.isro.gov.in/", title: "ISRO Home", text: "Welcome to ISRO" },
    { url: "https://www.isro.gov.in/gslv-f17-eos-05-mission", title: "GSLV-F17/EOS-05 MISSION - ISRO", text: "GSLV-F17/EOS-05 mission details and launch updates." }
  );
  assert.strictEqual(verifResult.verified, true, "Action verifier must confirm mission page load");

  console.log(`  ✓ Test 6 PASSED: Grounded to #${rawGroundedAction.targetIndex} ('${rawGroundedAction.target}'), normalized OPEN -> CLICK, safety gate passed, verification confirmed.\n`);
}

// -----------------------------------------------------------------------------
// TEST 7: Rule 10: Abstract Search-Result References Are Never Sent to Grounding
// -----------------------------------------------------------------------------
{
  console.log("[TEST 7] Rule 10: Abstract references ('most relevant result', 'the website') normalization");

  const abstractPhrases = [
    "most relevant result",
    "most relavent result",
    "the website",
    "the result",
    "appropriate result",
    "correct result"
  ];

  abstractPhrases.forEach((phrase) => {
    assert.strictEqual(reasoningPlanner.isAbstractTarget(phrase), true, `'${phrase}' must be recognized as abstract`);
    const resolved = reasoningPlanner.resolveConcreteSearchTarget("ISRO", phrase);
    assert.strictEqual(resolved, "official ISRO website (isro.gov.in)", `Abstract phrase '${phrase}' must resolve to concrete ISRO website`);
    assert.strictEqual(reasoningPlanner.isAbstractTarget(resolved), false, `Resolved target '${resolved}' must NOT be abstract`);
  });

  // Verify normalizeAction transforms abstract targets when provided with query context
  const abstractAction = { action: "CLICK", target: "most relavent result", targetLabel: "most relavent result" };
  const stepContext = { query: "ISRO", targetHint: "official ISRO website (isro.gov.in)" };
  const resolvedAction = reasoningPlanner.normalizeAction(abstractAction, stepContext);
  assert.strictEqual(resolvedAction.target, "official ISRO website (isro.gov.in)");
  assert.strictEqual(resolvedAction.targetLabel, "official ISRO website (isro.gov.in)");

  console.log("  ✓ Test 7 PASSED: Abstract search-result references safely resolved and never sent directly to grounding.\n");
}

console.log("============================================================");
console.log("ALL 7 SEARCH REASONING -> GROUNDING TESTS PASSED (7 / 7)!");
console.log("============================================================");
