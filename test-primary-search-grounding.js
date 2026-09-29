/**
 * Regression Test Suite: Generic Search Grounding & AI Mode Exclusion Fix
 * 
 * Verifies:
 * TEST 1: Google Homepage - "Search Google for ISRO." -> PRIMARY_SEARCH_INPUT, NOT "AI Mode".
 *         Safety check verifies "AI Mode" is rejected for "search", while "PRIMARY_SEARCH_INPUT" is allowed.
 * TEST 2: Multi-step - "Search Google for ISRO and open the official ISRO website." ->
 *         Step 1: SEARCH ISRO (target PRIMARY_SEARCH_INPUT), Step 2: SUBMIT, Step 3: OPEN ISRO.
 * TEST 3: Normal Form Filling - "Fill the form: Name = Sanketh, Email = abc@gmail.com" ->
 *         Field-specific form grounding unaffected.
 * TEST 4: Mixed Search + AI page - "Search for ISRO." -> Selects normal search input, not AI/chat input.
 * TEST 5: Explicit AI request - "Ask Gemini about ISRO." -> Selects AI/chat input because requested.
 * TEST 6: Execution-time Re-grounding - Re-grounding using SemanticTargetDescriptor preserves
 *         PRIMARY_SEARCH_INPUT / isSearchIntent and does not fall back to AI Mode or random textareas.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Load modules
const taskParser = require('./task-parser.js');
const reasoningPlanner = require('./reasoning-planner.js');
const actionVerifier = require('./action-verifier.js');
const SIHContent = require('./content.js');

// Load popup functions
const popupCode = fs.readFileSync(path.join(__dirname, 'popup.js'), 'utf8');

// Extract popup helper functions
function extractFunction(name, code) {
  const match = code.match(new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\([^{]*\\)\\s*\\{`));
  if (!match) {
    const varMatch = code.match(new RegExp(`const\\s+${name}\\s*=\\s*(?:async\\s*)?\\([^{]*\\)\\s*=>\\s*\\{`));
    if (!varMatch) throw new Error(`Could not find function ${name}`);
    let start = varMatch.index;
    let braceCount = 0;
    let foundFirstBrace = false;
    for (let i = start; i < code.length; i++) {
      if (code[i] === '{') {
        braceCount++;
        foundFirstBrace = true;
      } else if (code[i] === '}') {
        braceCount--;
        if (foundFirstBrace && braceCount === 0) {
          return code.substring(start, i + 1);
        }
      }
    }
  } else {
    let start = match.index;
    let braceCount = 0;
    let foundFirstBrace = false;
    for (let i = start; i < code.length; i++) {
      if (code[i] === '{') {
        braceCount++;
        foundFirstBrace = true;
      } else if (code[i] === '}') {
        braceCount--;
        if (foundFirstBrace && braceCount === 0) {
          return code.substring(start, i + 1);
        }
      }
    }
  }
  throw new Error(`Could not parse function ${name}`);
}

const normalizeBoundsSrc = extractFunction('normalizeBounds', popupCode);
const normalizeUrlSrc = extractFunction('normalizeUrl', popupCode);
const isAiAssistantElementSrc = extractFunction('isAiAssistantElement', popupCode);
const scoreSearchCandidateSrc = extractFunction('scoreSearchCandidate', popupCode);
const createSemanticTargetDescriptorSrc = extractFunction('createSemanticTargetDescriptor', popupCode);
const scoreCandidateAgainstDescriptorSrc = extractFunction('scoreCandidateAgainstDescriptor', popupCode);
const isFieldMatchSrc = extractFunction('isFieldMatch', popupCode);

// Evaluate popup functions in sandbox
const sandbox = {
  console: console,
  Math: Math,
  normalizeFieldLabel: (lbl) => (lbl || '').toLowerCase().replace(/[^a-z0-9]/g, ''),
  normalizeBounds: null,
  normalizeUrl: null,
  isFieldMatch: null,
  isAiAssistantElement: null,
  scoreSearchCandidate: null,
  createSemanticTargetDescriptor: null,
  scoreCandidateAgainstDescriptor: null
};

const fnDefinitions = `
${normalizeBoundsSrc};
sandbox.normalizeBounds = normalizeBounds;
${normalizeUrlSrc};
sandbox.normalizeUrl = normalizeUrl;
${isAiAssistantElementSrc};
sandbox.isAiAssistantElement = isAiAssistantElement;
${scoreSearchCandidateSrc};
sandbox.scoreSearchCandidate = scoreSearchCandidate;
${isFieldMatchSrc};
sandbox.isFieldMatch = isFieldMatch;
${createSemanticTargetDescriptorSrc};
sandbox.createSemanticTargetDescriptor = createSemanticTargetDescriptor;
${scoreCandidateAgainstDescriptorSrc};
sandbox.scoreCandidateAgainstDescriptor = scoreCandidateAgainstDescriptor;
`;

const evalFn = new Function('sandbox', `with(sandbox) { ${fnDefinitions} }`);
evalFn(sandbox);

const {
  normalizeBounds,
  normalizeUrl,
  isAiAssistantElement,
  scoreSearchCandidate,
  isFieldMatch,
  createSemanticTargetDescriptor,
  scoreCandidateAgainstDescriptor
} = sandbox;

console.log('='.repeat(70));
console.log('RUNNING GENERIC SEARCH GROUNDING REGRESSION TEST SUITE');
console.log('='.repeat(70));

let passedTests = 0;

// -------------------------------------------------------------
// TEST 1: Google Homepage - "Search Google for ISRO."
// -------------------------------------------------------------
console.log('\n--- TEST 1: Google Homepage - "Search Google for ISRO." ---');
{
  const task = "Search Google for ISRO.";
  const parsed = taskParser.parseTask(task);
  assert(parsed.isMultiStep, "Should parse as multi-step");
  assert(parsed.steps.length >= 2, "Should have at least FILL and SUBMIT steps");
  
  const fillStep = parsed.steps.find(s => s.type === 'FILL');
  assert.strictEqual(fillStep.target, "PRIMARY_SEARCH_INPUT");
  assert.strictEqual(fillStep.targetRole, "PRIMARY_SEARCH_INPUT");
  assert.strictEqual(fillStep.role, "PRIMARY_SEARCH_INPUT");
  assert.strictEqual(fillStep.value, "ISRO");
  assert.strictEqual(fillStep.fieldHint, "search");
  assert.strictEqual(fillStep.isSearchIntent, true);

  // Check planTask from reasoning-planner
  const plan = reasoningPlanner.planTask(parsed, { elements: [] });
  assert.strictEqual(plan.steps[0].target, "PRIMARY_SEARCH_INPUT");
  assert.strictEqual(plan.steps[0].targetRole, "PRIMARY_SEARCH_INPUT");
  assert.strictEqual(plan.steps[0].expectedRole, "PRIMARY_SEARCH_INPUT");

  // Mock DOM of Google Homepage
  const googleDomElements = [
    {
      domIndex: 0,
      tag: 'a',
      type: 'link',
      label: 'Gmail',
      text: 'Gmail'
    },
    {
      domIndex: 1,
      tag: 'a',
      type: 'link',
      label: 'Images',
      text: 'Images'
    },
    {
      domIndex: 2,
      tag: 'button',
      type: 'button',
      label: 'AI Mode',
      text: 'AI Mode',
      ariaLabel: 'AI Mode'
    },
    {
      domIndex: 3,
      tag: 'textarea',
      type: 'textarea',
      name: 'q',
      id: 'APjFqb',
      title: 'Search',
      role: 'combobox',
      ariaLabel: 'Search',
      placeholder: '',
      semanticTag: 'SEARCH_INPUT',
      boundingBox: { width: 500, height: 40, top: 200, left: 300 }
    },
    {
      domIndex: 4,
      tag: 'input',
      type: 'submit',
      name: 'btnK',
      value: 'Google Search',
      label: 'Google Search'
    }
  ];

  // Grounding check:
  // AI Mode element MUST be recognized as AI assistant
  assert.strictEqual(isAiAssistantElement(googleDomElements[2]), true, "AI Mode must be recognized as AI assistant");
  assert.strictEqual(isAiAssistantElement(googleDomElements[3]), false, "Search box must not be AI assistant");

  // Score candidate search controls
  const aiScore = scoreSearchCandidate(googleDomElements[2], task, false);
  const searchScore = scoreSearchCandidate(googleDomElements[3], task, false);

  assert(aiScore <= 0, `AI Mode score must be <= 0 (excluded) for normal search, got ${aiScore}`);
  assert(searchScore >= 0.95, `Search box score should be >= 0.95 (actual: ${searchScore})`);

  // Safety Gate Check:
  // Safety rule: "Target 'AI Mode' does not match requested field 'search'"
  const aiSafetyMatch = isFieldMatch("search", "AI Mode");
  assert.strictEqual(aiSafetyMatch, false, "Safety check MUST reject AI Mode for requested field 'search'");

  // Safety check with PRIMARY_SEARCH_INPUT or Search
  const searchSafetyMatch = isFieldMatch("search", "PRIMARY_SEARCH_INPUT");
  assert.strictEqual(searchSafetyMatch, true, "Safety check MUST allow PRIMARY_SEARCH_INPUT for requested field 'search'");

  const directSearchSafetyMatch = isFieldMatch("search", "Search");
  assert.strictEqual(directSearchSafetyMatch, true, "Safety check MUST allow Search for requested field 'search'");

  console.log('  [PASS] Test 1: Grounded to primary search (score=' + searchScore + '), AI Mode excluded (score=' + aiScore + '), safety gate strictly protected.');
  passedTests++;
}

// -------------------------------------------------------------
// TEST 2: Multi-step - "Search Google for ISRO and open the official ISRO website."
// -------------------------------------------------------------
console.log('\n--- TEST 2: Multi-step Search & Navigate ---');
{
  const task = "Search Google for ISRO and open the official ISRO website.";
  const parsed = taskParser.parseTask(task);
  
  assert(parsed.isMultiStep, "Should parse as multi-step");
  assert(parsed.steps.length >= 2, "Should contain search and navigation/click steps");
  
  const searchStep = parsed.steps[0];
  assert.strictEqual(searchStep.type, "FILL");
  assert.strictEqual(searchStep.target, "PRIMARY_SEARCH_INPUT");
  assert.strictEqual(searchStep.value, "ISRO", "Value must be ISRO, not entire task text");
  
  // Subsequent step to open result
  const lastStep = parsed.steps[parsed.steps.length - 1];
  assert(lastStep.type === "CLICK" || lastStep.action === "NAVIGATE" || (lastStep.target && lastStep.target.toLowerCase().includes("isro")),
    "Last step should target ISRO website");
  assert(!lastStep.value || lastStep.value !== task, "Task text itself must never be inserted as field value");

  console.log('  [PASS] Test 2: Multi-step workflow preserved. Step 1: SEARCH "ISRO" -> PRIMARY_SEARCH_INPUT, Step 2+: target ISRO website.');
  passedTests++;
}

// -------------------------------------------------------------
// TEST 3: Form filling - "Fill the form: Name = Sanketh, Email = abc@gmail.com"
// -------------------------------------------------------------
console.log('\n--- TEST 3: Form Filling - Field-specific grounding ---');
{
  const task = "Fill the form: Name = Sanketh, Email = abc@gmail.com";
  const parsed = taskParser.parseTask(task);
  
  assert(parsed.isMultiStep, "Should parse as multi-step");
  
  const rawNameStep = parsed.steps.find(s => s.fieldHint && s.fieldHint.toLowerCase() === 'name');
  const rawEmailStep = parsed.steps.find(s => s.fieldHint && s.fieldHint.toLowerCase() === 'email');
  assert(rawNameStep, "Should have a step for Name");
  assert.strictEqual(rawNameStep.value, "Sanketh");
  assert(rawEmailStep, "Should have a step for Email");
  assert.strictEqual(rawEmailStep.value, "abc@gmail.com");

  const nameStep = parsed.sanitizedPlan.find(s => s.target && s.target.toLowerCase() === 'name');
  const emailStep = parsed.sanitizedPlan.find(s => s.target && s.target.toLowerCase() === 'email');
  
  assert(nameStep, "Should have a sanitized step for Name");
  assert.notStrictEqual(nameStep.target, "PRIMARY_SEARCH_INPUT", "Form name field must NOT be PRIMARY_SEARCH_INPUT");
  assert.strictEqual(nameStep.isSearchIntent, false, "Form name field is NOT search intent");
  
  assert(emailStep, "Should have a sanitized step for Email");
  assert.notStrictEqual(emailStep.target, "PRIMARY_SEARCH_INPUT", "Form email field must NOT be PRIMARY_SEARCH_INPUT");
  assert.strictEqual(emailStep.isSearchIntent, false, "Form email field is NOT search intent");

  assert.strictEqual(parsed.localValues["name"], "Sanketh");
  assert.strictEqual(parsed.localValues["email"], "abc@gmail.com");

  console.log('  [PASS] Test 3: Normal form filling unchanged. Name and Email retain field-specific grounding.');
  passedTests++;
}

// -------------------------------------------------------------
// TEST 4: Page with normal search input and AI chat input -> "Search for ISRO."
// -------------------------------------------------------------
console.log('\n--- TEST 4: Page with Search + AI Input - "Search for ISRO." ---');
{
  const task = "Search for ISRO.";
  const parsed = taskParser.parseTask(task);
  
  const searchStep = parsed.steps.find(s => s.type === 'FILL');
  assert.strictEqual(searchStep.target, "PRIMARY_SEARCH_INPUT");
  assert.strictEqual(searchStep.value, "ISRO");
  assert.strictEqual(searchStep.isSearchIntent, true);

  const mockPageElements = [
    {
      domIndex: 10,
      tag: 'input',
      type: 'search',
      name: 'site-search',
      placeholder: 'Search the site...',
      label: 'Search'
    },
    {
      domIndex: 11,
      tag: 'textarea',
      type: 'textarea',
      name: 'ai-prompt',
      placeholder: 'Ask AI anything...',
      label: 'Ask AI assistant',
      ariaLabel: 'Chat with AI assistant'
    }
  ];

  const searchCandidate = mockPageElements[0];
  const aiCandidate = mockPageElements[1];

  const scoreSearch = scoreSearchCandidate(searchCandidate, task, false);
  const scoreAi = scoreSearchCandidate(aiCandidate, task, false);

  assert(scoreSearch >= 0.9, `Normal search control should receive high score (actual: ${scoreSearch})`);
  assert(scoreAi <= 0, `AI/Chat control must be excluded for ordinary search, got ${scoreAi}`);

  console.log('  [PASS] Test 4: "Search for ISRO." scored normal search ' + scoreSearch + ' and excluded AI control (' + scoreAi + ').');
  passedTests++;
}

// -------------------------------------------------------------
// TEST 5: Page with Search + AI Input -> "Ask Gemini about ISRO."
// -------------------------------------------------------------
console.log('\n--- TEST 5: Explicit AI Request - "Ask Gemini about ISRO." ---');
{
  const task = "Ask Gemini about ISRO.";
  const parsed = taskParser.parseTask(task);
  
  const aiStep = parsed.steps.find(s => s.type === 'FILL');
  assert.strictEqual(aiStep.isAiAssistantIntent, true, "Should recognize explicit AI assistant intent");
  assert.strictEqual(aiStep.targetRole, "AI_ASSISTANT_INPUT");
  assert.strictEqual(aiStep.fieldHint, "Gemini");
  assert.strictEqual(aiStep.value, "ISRO");

  const mockPageElements = [
    {
      domIndex: 10,
      tag: 'input',
      type: 'search',
      name: 'site-search',
      placeholder: 'Search documentation...',
      label: 'Search docs'
    },
    {
      domIndex: 11,
      tag: 'textarea',
      type: 'textarea',
      name: 'gemini-prompt',
      placeholder: 'Ask Gemini anything...',
      label: 'Ask Gemini',
      ariaLabel: 'Ask Gemini'
    }
  ];

  // 1. Safety & Field Matching check: Gemini field hint matches Gemini element, but not normal search
  const isGeminiMatch = isFieldMatch(mockPageElements[1].label, aiStep.fieldHint);
  const isSearchMatch = isFieldMatch(mockPageElements[0].label, aiStep.fieldHint);
  assert.strictEqual(isGeminiMatch, true, "Gemini control should match requested field hint 'Gemini'");
  assert.strictEqual(isSearchMatch, false, "Normal search should not match field hint 'Gemini'");

  // 2. Re-grounding descriptor for AI assistant step
  const geminiDesc = createSemanticTargetDescriptor(mockPageElements[1], {
    action: "FILL",
    target: "Gemini",
    fieldHint: "Gemini",
    targetRole: "AI_ASSISTANT_INPUT",
    role: "AI_ASSISTANT_INPUT",
    isAiAssistantIntent: true,
    value: "ISRO"
  });

  const scoreGemini = scoreCandidateAgainstDescriptor(mockPageElements[1], geminiDesc);
  const scoreSearch = scoreCandidateAgainstDescriptor(mockPageElements[0], geminiDesc);

  assert(scoreGemini > 0.4, `Gemini input should have strong score (actual: ${scoreGemini})`);
  assert(scoreGemini > scoreSearch, `Gemini input (${scoreGemini}) must be selected over search input (${scoreSearch})`);
  
  console.log('  [PASS] Test 5: "Ask Gemini about ISRO." correctly targeted AI assistant control (score=' +
    scoreGemini.toFixed(2) + ') over search input (score=' + scoreSearch.toFixed(2) + ').');
  passedTests++;
}

// -------------------------------------------------------------
// TEST 6: Execution-Time Re-grounding with PRIMARY_SEARCH_INPUT
// -------------------------------------------------------------
console.log('\n--- TEST 6: Execution-Time Re-grounding ---');
{
  // Create a target descriptor for PRIMARY_SEARCH_INPUT
  const searchAction = {
    action: "FILL",
    target: "PRIMARY_SEARCH_INPUT",
    targetRole: "PRIMARY_SEARCH_INPUT",
    role: "PRIMARY_SEARCH_INPUT",
    expectedRole: "PRIMARY_SEARCH_INPUT",
    isSearchIntent: true,
    fieldHint: "search",
    value: "ISRO"
  };

  const initialElement = {
    domIndex: 3,
    tag: 'textarea',
    type: 'textarea',
    name: 'q',
    id: 'APjFqb',
    title: 'Search',
    role: 'combobox',
    ariaLabel: 'Search',
    placeholder: '',
    semanticTag: 'SEARCH_INPUT',
    boundingBox: { width: 500, height: 40, top: 200, left: 300 }
  };

  const descriptor = createSemanticTargetDescriptor(initialElement, searchAction);
  assert.strictEqual(descriptor.targetRole, "PRIMARY_SEARCH_INPUT");
  assert.strictEqual(descriptor.isSearchIntent, true);

  // Now simulate page re-rendering / fresh DOM with elements in different indexes
  // and an AI assistant input at index 0!
  const freshDom = [
    {
      domIndex: 0,
      tag: 'textarea',
      type: 'textarea',
      placeholder: 'Ask anything...',
      label: 'AI Mode',
      ariaLabel: 'AI Mode'
    },
    {
      domIndex: 1,
      tag: 'textarea',
      type: 'textarea',
      name: 'q',
      id: 'search-box-refreshed',
      title: 'Search',
      role: 'combobox',
      ariaLabel: 'Search'
    },
    {
      domIndex: 2,
      tag: 'textarea',
      type: 'textarea',
      name: 'feedback',
      placeholder: 'Send feedback'
    }
  ];

  // Score candidates during re-grounding
  const scoreAiMode = scoreCandidateAgainstDescriptor(freshDom[0], descriptor);
  const scoreSearchBox = scoreCandidateAgainstDescriptor(freshDom[1], descriptor);
  const scoreFeedback = scoreCandidateAgainstDescriptor(freshDom[2], descriptor);

  assert(scoreAiMode <= 0, `Re-grounding MUST exclude AI Mode (score <= 0), got ${scoreAiMode}`);
  assert(scoreSearchBox > 0.8, `Re-grounding MUST strongly prefer primary search box (actual: ${scoreSearchBox})`);
  assert(scoreSearchBox > scoreFeedback, "Search box score must be higher than random textarea");

  console.log('  [PASS] Test 6: Re-grounding successfully resolved PRIMARY_SEARCH_INPUT (score=' +
    scoreSearchBox.toFixed(2) + ') and rejected AI Mode (score=' + scoreAiMode + ').');
  passedTests++;
}

// -------------------------------------------------------------
// TEST 7: 5-Tier Search Ranking Hierarchy Verification
// -------------------------------------------------------------
console.log('\n--- TEST 7: 5-Tier Search Ranking Hierarchy ---');
{
  const task = "Search for docs";
  
  // Tier 1: input[type="search"]
  const t1 = { tag: 'input', type: 'search', name: 'term' };
  // Tier 2: name="q"
  const t2 = { tag: 'input', type: 'text', name: 'q' };
  // Tier 3: aria-label="Search"
  const t3 = { tag: 'input', type: 'text', ariaLabel: 'Search' };
  // Tier 4: placeholder="Search"
  const t4 = { tag: 'input', type: 'text', placeholder: 'Search...' };
  // Tier 5: role="searchbox"
  const t5 = { tag: 'div', role: 'searchbox', label: 'Search' };
  // Non-search:
  const nonSearch = { tag: 'input', type: 'text', name: 'username', placeholder: 'Enter username' };

  const s1 = scoreSearchCandidate(t1, task, false);
  const s2 = scoreSearchCandidate(t2, task, false);
  const s3 = scoreSearchCandidate(t3, task, false);
  const s4 = scoreSearchCandidate(t4, task, false);
  const s5 = scoreSearchCandidate(t5, task, false);
  const sNon = scoreSearchCandidate(nonSearch, task, false);

  assert(s1 >= 0.95, `Tier 1 score should be >= 0.95 (actual: ${s1})`);
  assert(s2 >= 0.90, `Tier 2 score should be >= 0.90 (actual: ${s2})`);
  assert(s3 >= 0.85, `Tier 3 score should be >= 0.85 (actual: ${s3})`);
  assert(s4 >= 0.80, `Tier 4 score should be >= 0.80 (actual: ${s4})`);
  assert(s5 >= 0.70, `Tier 5 score should be >= 0.70 (actual: ${s5})`);
  assert(sNon === 0, `Non-search element should score 0 (actual: ${sNon})`);

  console.log('  [PASS] Test 7: 5-Tier hierarchy verified: T1=' + s1 + ', T2=' + s2 + ', T3=' + s3 + ', T4=' + s4 + ', T5=' + s5 + ', non-search=' + sNon);
  passedTests++;
}

// -------------------------------------------------------------
// TEST 8: REGRESSION TEST 1 - Google Homepage "Search Google for ISRO."
// -------------------------------------------------------------
console.log('\n--- TEST 8: Regression Test 1 - Search Google for ISRO (Must NEVER ground to AI Mode / How Search works) ---');
{
  const task = "Search Google for ISRO.";
  const parsed = taskParser.parseTask(task);
  const plan = reasoningPlanner.planTask(parsed, { elements: [] });

  const fillParsed = parsed.steps.find(s => s.type === "FILL");
  assert.strictEqual(fillParsed.value, "ISRO");

  const fillStep = plan.steps[0];
  assert.strictEqual(fillStep.type, "FILL");
  assert.strictEqual(fillStep.target, "PRIMARY_SEARCH_INPUT");
  assert.strictEqual(fillStep.targetRole, "PRIMARY_SEARCH_INPUT");

  // Simulated Google Homepage DOM with potential distractors:
  // - "AI Mode" / "Ask anything" textarea
  // - "How Search works" footer link
  // - "Gemini" assistant icon
  // - Real primary search input: textarea name="q" id="APjFqb"
  const googlePageElements = [
    { domIndex: 0, tag: 'a', type: 'link', label: 'Gmail' },
    { domIndex: 1, tag: 'a', type: 'link', label: 'Images' },
    {
      domIndex: 2,
      tag: 'textarea',
      type: 'textarea',
      name: 'q',
      id: 'APjFqb',
      title: 'Search',
      role: 'combobox',
      ariaLabel: 'Search',
      placeholder: '',
      semanticTag: 'SEARCH_INPUT',
      bounds: { x: 300, y: 250, width: 600, height: 44 }
    },
    {
      domIndex: 3,
      tag: 'textarea',
      type: 'textarea',
      label: 'AI Mode',
      ariaLabel: 'AI Mode',
      placeholder: 'Ask anything or chat with AI...',
      bounds: { x: 300, y: 320, width: 600, height: 80 }
    },
    {
      domIndex: 4,
      tag: 'a',
      type: 'link',
      label: 'How Search works',
      url: 'https://www.google.com/search/howsearchworks/'
    },
    {
      domIndex: 5,
      tag: 'button',
      type: 'button',
      label: 'Google Search',
      semanticTag: 'SUBMIT_BUTTON'
    }
  ];

  // 1. Verify candidate scoring: real search gets top score, AI/distractors get 0
  const scoreRealSearch = scoreSearchCandidate(googlePageElements[2], task, false);
  const scoreAiMode = scoreSearchCandidate(googlePageElements[3], task, false);
  const scoreHowSearchWorks = scoreSearchCandidate(googlePageElements[4], task, false);

  assert(scoreRealSearch >= 0.95, `Primary search input score must be >= 0.95, got ${scoreRealSearch}`);
  assert.strictEqual(scoreAiMode, 0, `AI Mode must score 0, got ${scoreAiMode}`);
  assert.strictEqual(scoreHowSearchWorks, 0, `How Search works must score 0, got ${scoreHowSearchWorks}`);

  // 2. Verify descriptor creation
  const descriptor = createSemanticTargetDescriptor(googlePageElements[2], "search", "PRIMARY_SEARCH_INPUT");
  assert.strictEqual(descriptor.targetRole, "PRIMARY_SEARCH_INPUT");
  assert.strictEqual(descriptor.isSearchIntent, true);

  // 3. Verify descriptor scores across candidates
  const descScoreReal = scoreCandidateAgainstDescriptor(googlePageElements[2], descriptor);
  const descScoreAi = scoreCandidateAgainstDescriptor(googlePageElements[3], descriptor);
  const descScoreHow = scoreCandidateAgainstDescriptor(googlePageElements[4], descriptor);

  assert(descScoreReal >= 0.95, `Descriptor score for real search must be >= 0.95, got ${descScoreReal}`);
  assert.strictEqual(descScoreAi, 0, `Descriptor score for AI Mode must be 0, got ${descScoreAi}`);
  assert.strictEqual(descScoreHow, 0, `Descriptor score for How Search works must be 0, got ${descScoreHow}`);

  // 4. Verify step 2 is SUBMIT -> search
  const submitStep = plan.steps[1];
  assert.strictEqual(submitStep.type, "SUBMIT");
  assert.strictEqual(submitStep.target, "search");

  console.log('  [PASS] Test 8: Regression Test 1 passed: FILL -> primary search input (score=' +
    scoreRealSearch.toFixed(2) + '), Value -> ISRO, AI Mode/How Search works strictly excluded (0), SUBMIT -> search.');
  passedTests++;
}

// -------------------------------------------------------------
// TEST 9: REGRESSION TEST 2 - Duplicate Search Results Disambiguation
// -------------------------------------------------------------
console.log('\n--- TEST 9: Regression Test 2 - Duplicate Search Results Disambiguation (DOM Index #21, URL isro.gov, BBox) ---');
{
  // Grounded result from perception snapshot:
  // Name: "Indian Space Research Organisation ISRO"
  // URL: "https://www.isro.gov"
  // DOM Index: #21
  // Bounding Box: [130, 179, 375, 43]
  const groundedAction = {
    action: "CLICK",
    target: "Indian Space Research Organisation ISRO",
    targetLabel: "Indian Space Research Organisation ISRO",
    targetIndex: 21,
    url: "https://www.isro.gov",
    bounds: [130, 179, 375, 43],
    groundingScore: 1.00
  };

  // Mock Google Search results page containing multiple duplicate/similar links
  // for ISRO: main result, sitelink, header link, footer link
  const searchResultsDom = [
    {
      index: 10,
      type: "link",
      label: "All",
      url: "https://www.google.com/search?q=isro"
    },
    {
      index: 21,
      type: "link",
      label: "Indian Space Research Organisation ISRO",
      url: "https://www.isro.gov",
      x: 130,
      y: 179,
      width: 375,
      height: 43,
      bounds: { x: 130, y: 179, width: 375, height: 43 }
    },
    {
      index: 28,
      type: "link",
      label: "Indian Space Research Organisation ISRO",
      url: "https://www.isro.gov/about",
      x: 130,
      y: 350,
      width: 375,
      height: 43,
      bounds: { x: 130, y: 350, width: 375, height: 43 }
    },
    {
      index: 35,
      type: "link",
      label: "Indian Space Research Organisation ISRO",
      url: "https://twitter.com/isro",
      x: 130,
      y: 600,
      width: 375,
      height: 43,
      bounds: { x: 130, y: 600, width: 375, height: 43 }
    }
  ];

  // 1. Verify validateRecoveryTarget in actionVerifier
  // MUST NOT return "Target ambiguous: multiple identical elements found on page"
  // because targetElement is uniquely identified by DOM index 21, URL https://www.isro.gov, and Bounding Box
  const targetElement = searchResultsDom[1]; // index 21
  const validation = actionVerifier.validateRecoveryTarget(
    targetElement,
    searchResultsDom,
    groundedAction
  );

  assert.strictEqual(validation.valid, true, `Validation must succeed for uniquely identified duplicate result: ${validation.reason}`);
  assert.notStrictEqual(validation.reason, "Target ambiguous: multiple identical elements found on page");

  // 2. Also test with DOM Index formatted as string '#21'
  const validationWithHash = actionVerifier.validateRecoveryTarget(
    targetElement,
    searchResultsDom,
    { ...groundedAction, targetIndex: '#21' }
  );
  assert.strictEqual(validationWithHash.valid, true, `Validation must support DOM index '#21': ${validationWithHash.reason}`);

  // 3. Test that ambiguity safety STILL triggers if NO distinguishing index, URL, or bounds exist
  const trulyIndistinguishable = [
    { label: "Duplicate Button", type: "button", index: 1 },
    { label: "Duplicate Button", type: "button", index: 2 }
  ];
  const ambiguousVal = actionVerifier.validateRecoveryTarget(
    trulyIndistinguishable[0],
    trulyIndistinguishable,
    { action: "CLICK", targetLabel: "Duplicate Button" } // No index, url, or bounds provided
  );
  assert.strictEqual(ambiguousVal.valid, false, "Ambiguous elements without distinguishing evidence must be rejected");
  assert.strictEqual(ambiguousVal.reason, "Target ambiguous: multiple identical elements found on page");

  console.log('  [PASS] Test 9: Regression Test 2 passed: validateRecoveryTarget accepted grounded ISRO result (Index #21, isro.gov, bbox) amidst duplicate text elements without ambiguity failure.');
  passedTests++;
}

// -------------------------------------------------------------
// TEST 10: REGRESSION TEST 3 - Multi-step Search & Grounded Result Click
// -------------------------------------------------------------
console.log('\n--- TEST 10: Regression Test 3 - Full Flow: Search Google for ISRO and open official ISRO result ---');
{
  const task = "Search Google for ISRO and open the official Indian Space Research Organisation result.";
  const parsed = taskParser.parseTask(task);
  assert.strictEqual(parsed.isMultiStep, true);
  assert(parsed.steps.length >= 3, `Expected at least 3 steps, got ${parsed.steps.length}`);

  const fillParsed = parsed.steps.find(s => s.type === "FILL");
  assert.strictEqual(fillParsed.value, "ISRO");

  const plan = reasoningPlanner.planTask(parsed, { elements: [] });
  assert.strictEqual(plan.steps[0].type, "FILL");
  assert.strictEqual(plan.steps[0].target, "PRIMARY_SEARCH_INPUT");

  assert.strictEqual(plan.steps[1].type, "SUBMIT");
  assert.strictEqual(plan.steps[1].target, "search");

  // Step 3: Open / Click official ISRO result
  const clickStep = plan.steps[2];
  assert(clickStep.type === "CLICK" || clickStep.type === "OPEN", `Step 3 should be CLICK or OPEN, got ${clickStep.type}`);
  assert(
    clickStep.target.toLowerCase().includes("isro") ||
    clickStep.target.toLowerCase().includes("indian space research organisation") ||
    clickStep.targetHint.toLowerCase().includes("isro") ||
    clickStep.targetHint.toLowerCase().includes("indian space research organisation"),
    `Step 3 target should refer to ISRO: ${clickStep.target}`
  );

  // Verify that semantic descriptor preserves rich signals for ISRO result:
  const isroDescriptor = createSemanticTargetDescriptor(
    {
      index: 21,
      type: "link",
      label: "Indian Space Research Organisation ISRO",
      url: "https://www.isro.gov",
      bounds: { x: 130, y: 179, width: 375, height: 43 }
    },
    clickStep.targetHint || "Indian Space Research Organisation ISRO",
    "link"
  );

  assert.strictEqual(isroDescriptor.url, "https://www.isro.gov");
  assert.strictEqual(isroDescriptor.originalIndex, 21);
  assert.deepStrictEqual(isroDescriptor.bounds, { x: 130, y: 179, width: 375, height: 43 });

  console.log('  [PASS] Test 10: Regression Test 3 passed: End-to-end multi-step plan SEARCH -> SUBMIT -> GROUND official ISRO result with URL, index, and bounds preserved.');
  passedTests++;
}

console.log('\n' + '='.repeat(70));
console.log(`ALL GENERIC SEARCH GROUNDING TESTS PASSED (${passedTests} / 10)`);
console.log('='.repeat(70));
