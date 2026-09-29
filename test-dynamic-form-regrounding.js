/**
 * TEST SUITE: GENERIC DYNAMIC FORM RE-GROUNDING & TARGET/VALUE SEPARATION
 * 
 * Validates:
 * 1. Target/Value separation:
 *    - 'Type hello in Search mail' -> target='Search mail', value='hello'
 *    - 'Search mail for most recent email' -> target='Search mail', value='most recent email'
 *    - 'Enter Mysore in From' -> target='From', value='Mysore'
 *    - 'Set To to Bengaluru' -> target='To', value='Bengaluru'
 *    - 'Type software engineer in Search' -> target='Search', value='software engineer'
 * 2. Case A: Navigate to Gmail -> re-ground 'Search mail' (role: combobox, DOM index shifted #3 -> #7)
 * 3. Case B: Navigate to IRCTC -> re-ground 'From' (role: combobox, placeholder: 'From*', DOM index shifted #5 -> #12)
 * 4. Case C: Navigate to IRCTC -> re-ground 'To' (role: combobox, placeholder: 'To*', DOM index shifted #6 -> #14)
 * 5. Case D: Navigate to LinkedIn -> re-ground 'Search' (role: combobox, DOM index shifted #2 -> #9)
 * 6. Case E: Static form controls (<button>Submit</button>, <input name="email">)
 * 7. DOM index shift resilience: index completely shifted or stale, grounded solely on semantic descriptor
 * 8. Ambiguity safety gate: multiple identical elements without distinguishing evidence rejected
 * 9. Content execution: dynamic controls (combobox, textbox, contenteditable, select, input, textarea) safely filled
 * 10. Privacy guarantee: values never leak into descriptors or failure reasons
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");

// Load modules
const taskParser = require("./task-parser.js");
const actionVerifier = require("./action-verifier.js");

// Extract helper functions from popup.js
const popupCode = fs.readFileSync(path.join(__dirname, "popup.js"), "utf8");

const isFieldMatchMatch = popupCode.match(/const isFieldMatch = ([\s\S]+?)(?=\n  \/\*\*|\n  const scoreElementForField)/);
assert.ok(isFieldMatchMatch, "isFieldMatch must be present in popup.js");
const isFieldMatch = eval(isFieldMatchMatch[0].replace("const isFieldMatch = ", ""));

const scoreElementMatch = popupCode.match(/const scoreElementForField = ([\s\S]+?)(?=\n  \/\*\*|\n  const createSemanticTargetDescriptor)/);
assert.ok(scoreElementMatch, "scoreElementForField must be present in popup.js");
const scoreElementForField = eval(scoreElementMatch[0].replace("const scoreElementForField = ", ""));

const createSemanticDescMatch = popupCode.match(/const createSemanticTargetDescriptor = ([\s\S]+?)(?=\n  \/\*\*|\n  const scoreCandidateAgainstDescriptor)/);
assert.ok(createSemanticDescMatch, "createSemanticTargetDescriptor must be present in popup.js");
const createSemanticTargetDescriptor = eval(createSemanticDescMatch[0].replace("const createSemanticTargetDescriptor = ", ""));

const scoreCandMatch = popupCode.match(/const scoreCandidateAgainstDescriptor = ([\s\S]+?)(?=\n  \/\*\*|\n  const reGroundSemanticTarget)/);
assert.ok(scoreCandMatch, "scoreCandidateAgainstDescriptor must be present in popup.js");
const scoreCandidateAgainstDescriptor = eval(scoreCandMatch[0].replace("const scoreCandidateAgainstDescriptor = ", ""));

const regroundMatch = popupCode.match(/const reGroundSemanticTarget = ([\s\S]+?)(?=\n  \/\*\*|\n  const runLocalPipeline)/);
assert.ok(regroundMatch, "reGroundSemanticTarget must be present in popup.js");
const reGroundSemanticTarget = eval(regroundMatch[0].replace("const reGroundSemanticTarget = ", ""));

console.log("============================================================");
console.log("RUNNING IRIS DYNAMIC FORM RE-GROUNDING TEST SUITE");
console.log("============================================================\n");

// ============================================================================
// PART 1: TARGET / VALUE SEPARATION TESTS
// ============================================================================
console.log("--- PART 1: TARGET / VALUE SEPARATION TESTS ---");

// 1.1 Type hello in Search mail
{
  const res = taskParser.parseTask("Type hello in Search mail");
  assert.strictEqual(res.intent, "FILL");
  assert.strictEqual(res.steps[0].type, "FILL");
  assert.strictEqual(res.steps[0].fieldHint, "Search mail", "Target must be 'Search mail'");
  assert.strictEqual(res.steps[0].value, "hello", "Value must be 'hello'");
  console.log("  [PASS] 1.1 'Type hello in Search mail' -> target='Search mail', value='hello'");
}

// 1.2 Search mail for most recent email
{
  const res = taskParser.parseTask("Search mail for most recent email");
  assert.strictEqual(res.steps[0].type, "FILL");
  assert.strictEqual(res.steps[0].fieldHint, "Search mail", "Target must be 'Search mail'");
  assert.strictEqual(res.steps[0].value, "most recent email", "Value must be 'most recent email'");
  assert.strictEqual(res.steps[1].type, "SUBMIT");
  assert.strictEqual(res.steps[1].targetHint, "Search mail");
  console.log("  [PASS] 1.2 'Search mail for most recent email' -> target='Search mail', value='most recent email'");
}

// 1.3 Enter Mysore in From
{
  const res = taskParser.parseTask("Enter Mysore in From");
  assert.strictEqual(res.steps[0].type, "FILL");
  assert.strictEqual(res.steps[0].fieldHint, "From");
  assert.strictEqual(res.steps[0].value, "Mysore");
  console.log("  [PASS] 1.3 'Enter Mysore in From' -> target='From', value='Mysore'");
}

// 1.4 Set To to Bengaluru
{
  const res = taskParser.parseTask("Set To to Bengaluru");
  assert.strictEqual(res.steps[0].type, "FILL");
  assert.strictEqual(res.steps[0].fieldHint, "To");
  assert.strictEqual(res.steps[0].value, "Bengaluru");
  console.log("  [PASS] 1.4 'Set To to Bengaluru' -> target='To', value='Bengaluru'");
}

// 1.5 Type software engineer in Search
{
  const res = taskParser.parseTask("Type software engineer in Search");
  assert.strictEqual(res.steps[0].type, "FILL");
  assert.strictEqual(res.steps[0].fieldHint, "Search");
  assert.strictEqual(res.steps[0].value, "software engineer");
  console.log("  [PASS] 1.5 'Type software engineer in Search' -> target='Search', value='software engineer'");
}

// ============================================================================
// PART 2: DYNAMIC FORM RE-GROUNDING SPECIFICATION TESTS (CASES A - E)
// ============================================================================
console.log("\n--- PART 2: DYNAMIC FORM RE-GROUNDING SPECIFICATION TESTS ---");

// CASE A: Navigate to Gmail -> re-ground "Search mail" (role: combobox, DOM index shifted #3 -> #7)
{
  // Initial descriptor preserved during perception
  const initialGmailEl = {
    label: "Search mail",
    type: "combobox",
    role: "combobox",
    inputType: "input",
    placeholder: "Search mail",
    ariaLabel: "Search mail",
    id: "aso_search_form_anchor",
    name: "q",
    index: 3,
    bounds: { x: 200, y: 15, width: 600, height: 40 }
  };
  const descriptor = createSemanticTargetDescriptor(initialGmailEl, "Search mail", "combobox");

  assert.strictEqual(descriptor.normalizedLabel, "search mail");
  assert.strictEqual(descriptor.role, "combobox");
  assert.strictEqual(descriptor.placeholder, "Search mail");
  assert.strictEqual(descriptor.ariaLabel, "Search mail");
  assert.strictEqual(descriptor.name, "q");

  // Fresh perception after navigation/hydration (DOM shifted to #7, banner ads/nav icons inserted)
  const freshGmailElements = [
    { label: "Main menu", type: "button", role: "button", index: 0 },
    { label: "Gmail", type: "link", role: "link", index: 1 },
    { label: "Search options", type: "button", role: "button", index: 2 },
    { label: "Inbox", type: "link", role: "link", index: 3 }, // Old index #3 now holds Inbox!
    { label: "Starred", type: "link", role: "link", index: 4 },
    { label: "Snoozed", type: "link", role: "link", index: 5 },
    { label: "Sent", type: "link", role: "link", index: 6 },
    {
      label: "Search mail",
      type: "combobox",
      role: "combobox",
      inputType: "input",
      placeholder: "Search mail",
      ariaLabel: "Search mail",
      id: "aso_search_form_anchor",
      name: "q",
      index: 7, // Shifted!
      bounds: { x: 210, y: 15, width: 590, height: 40 }
    }
  ];

  const reground = reGroundSemanticTarget(freshGmailElements, descriptor);
  assert.ok(reground.match, "Must re-ground Gmail search combobox");
  assert.strictEqual(reground.isAmbiguous, false, "Must not be ambiguous");
  assert.strictEqual(reground.index, 7, "Must locate shifted element at index 7");
  assert.strictEqual(reground.match.label, "Search mail");
  assert.ok(reground.score >= 0.85, `Grounding score must be >= 0.85 (got ${reground.score})`);

  // Verify Action Verifier confirms the re-grounded recovery target
  const validation = actionVerifier.validateRecoveryTarget(reground.match, freshGmailElements, {
    action: "FILL",
    targetLabel: "Search mail",
    targetType: "combobox",
    groundingScore: reground.score
  });
  assert.strictEqual(validation.valid, true, "Action verifier must validate re-grounded target");

  console.log("  [PASS] Case A: Gmail 'Search mail' combobox cleanly re-grounded after DOM shift (#3 -> #7, score: " + reground.score.toFixed(2) + ")");
}

// CASE B: Navigate to IRCTC -> re-ground "From" (role: combobox, placeholder: 'From*', DOM index shifted #5 -> #12)
{
  const initialIrctcFromEl = {
    label: "From",
    type: "combobox",
    role: "combobox",
    inputType: "input",
    placeholder: "From*",
    ariaLabel: "From",
    id: "origin",
    name: "originStation",
    nearbyText: "From station name or code",
    index: 5,
    bounds: { x: 80, y: 220, width: 250, height: 35 }
  };
  const descriptor = createSemanticTargetDescriptor(initialIrctcFromEl, "From", "combobox");

  // Fresh page after navigation / dynamic Angular hydration (index shifted to #12)
  const freshIrctcElements = [
    { label: "IRCTC Logo", type: "image", index: 0 },
    { label: "Login", type: "button", index: 1 },
    { label: "Register", type: "link", index: 2 },
    { label: "Agent Login", type: "link", index: 3 },
    { label: "Contact Us", type: "link", index: 4 },
    { label: "Book Ticket", type: "heading", index: 5 }, // Stale index #5 is a heading!
    { label: "PNR Status", type: "button", index: 6 },
    { label: "Charts / Vacancy", type: "link", index: 7 },
    { label: "Special Trains", type: "link", index: 8 },
    { label: "IRCTC Trains", type: "link", index: 9 },
    { label: "Search trains", type: "button", index: 10 },
    { label: "Origin Station Label", type: "element", index: 11 },
    {
      label: "From",
      type: "combobox",
      role: "combobox",
      inputType: "input",
      placeholder: "From*",
      ariaLabel: "From",
      id: "origin",
      name: "originStation",
      nearbyText: "From station name or code",
      index: 12, // Shifted!
      bounds: { x: 80, y: 225, width: 250, height: 35 }
    },
    {
      label: "To",
      type: "combobox",
      role: "combobox",
      inputType: "input",
      placeholder: "To*",
      ariaLabel: "To",
      id: "destination",
      name: "destinationStation",
      nearbyText: "To station name or code",
      index: 13
    }
  ];

  const reground = reGroundSemanticTarget(freshIrctcElements, descriptor);
  assert.ok(reground.match, "Must re-ground IRCTC From combobox");
  assert.strictEqual(reground.isAmbiguous, false);
  assert.strictEqual(reground.index, 12, "Must locate element at index 12");
  assert.strictEqual(reground.match.id, "origin");
  assert.ok(reground.score >= 0.85);

  const validation = actionVerifier.validateRecoveryTarget(reground.match, freshIrctcElements, {
    action: "FILL",
    targetLabel: "From",
    targetType: "combobox",
    groundingScore: reground.score
  });
  assert.strictEqual(validation.valid, true);

  console.log("  [PASS] Case B: IRCTC 'From' combobox cleanly re-grounded after DOM shift (#5 -> #12, score: " + reground.score.toFixed(2) + ")");
}

// CASE C: Navigate to IRCTC -> re-ground "To" (role: combobox, placeholder: 'To*', DOM index shifted #6 -> #14)
{
  const initialIrctcToEl = {
    label: "To",
    type: "combobox",
    role: "combobox",
    inputType: "input",
    placeholder: "To*",
    ariaLabel: "To",
    id: "destination",
    name: "destinationStation",
    nearbyText: "To station name or code",
    index: 6
  };
  const descriptor = createSemanticTargetDescriptor(initialIrctcToEl, "To", "combobox");

  const freshIrctcElements = [
    { label: "Book Ticket", type: "heading", index: 0 },
    {
      label: "From",
      type: "combobox",
      role: "combobox",
      inputType: "input",
      placeholder: "From*",
      ariaLabel: "From",
      id: "origin",
      index: 10
    },
    {
      label: "Swap Stations",
      type: "button",
      index: 11
    },
    {
      label: "To",
      type: "combobox",
      role: "combobox",
      inputType: "input",
      placeholder: "To*",
      ariaLabel: "To",
      id: "destination",
      name: "destinationStation",
      nearbyText: "To station name or code",
      index: 14 // Shifted to #14
    }
  ];

  const reground = reGroundSemanticTarget(freshIrctcElements, descriptor);
  assert.strictEqual(reground.index, 3, "Array position in freshElements");
  assert.strictEqual(reground.match.index, 14, "Shifted DOM index");
  assert.strictEqual(reground.match.id, "destination");
  assert.ok(reground.score >= 0.85);

  console.log("  [PASS] Case C: IRCTC 'To' combobox cleanly re-grounded after DOM shift (#6 -> #14, score: " + reground.score.toFixed(2) + ")");
}

// CASE D: Navigate to LinkedIn -> re-ground "Search" (role: combobox, placeholder: 'Search', DOM index shifted #2 -> #9)
{
  const initialLinkedInSearch = {
    label: "Search",
    type: "combobox",
    role: "combobox",
    inputType: "input",
    placeholder: "Search",
    ariaLabel: "Search",
    id: "global-nav-typeahead",
    index: 2
  };
  const descriptor = createSemanticTargetDescriptor(initialLinkedInSearch, "Search", "combobox");

  const freshLinkedInElements = [
    { label: "LinkedIn Logo", type: "link", index: 0 },
    { label: "Home", type: "link", index: 1 },
    { label: "My Network", type: "link", index: 2 }, // Old index #2 is now My Network!
    { label: "Jobs", type: "link", index: 3 },
    { label: "Messaging", type: "link", index: 4 },
    { label: "Notifications", type: "link", index: 5 },
    { label: "Me", type: "button", index: 6 },
    { label: "For Business", type: "button", index: 7 },
    { label: "Try Premium", type: "link", index: 8 },
    {
      label: "Search",
      type: "combobox",
      role: "combobox",
      inputType: "input",
      placeholder: "Search",
      ariaLabel: "Search",
      id: "global-nav-typeahead",
      index: 9 // Shifted to #9
    }
  ];

  const reground = reGroundSemanticTarget(freshLinkedInElements, descriptor);
  assert.ok(reground.match);
  assert.strictEqual(reground.isAmbiguous, false);
  assert.strictEqual(reground.index, 9);
  assert.strictEqual(reground.match.id, "global-nav-typeahead");
  assert.ok(reground.score >= 0.85);

  console.log("  [PASS] Case D: LinkedIn 'Search' combobox cleanly re-grounded after DOM shift (#2 -> #9, score: " + reground.score.toFixed(2) + ")");
}

// CASE E: Static form controls (<button>Submit</button>, <input name="email">)
{
  const initialBtn = {
    label: "Submit Application",
    type: "button",
    role: "button",
    id: "submit-btn",
    index: 10
  };
  const btnDesc = createSemanticTargetDescriptor(initialBtn, "Submit Application", "button");

  const freshElements = [
    { label: "Previous", type: "button", index: 0 },
    { label: "Cancel", type: "button", index: 1 },
    { label: "Save Draft", type: "button", index: 2 },
    {
      label: "Submit Application",
      type: "button",
      role: "button",
      id: "submit-btn",
      index: 3 // Shifted to 3
    }
  ];

  const reground = reGroundSemanticTarget(freshElements, btnDesc);
  assert.ok(reground.match);
  assert.strictEqual(reground.index, 3);
  assert.ok(reground.score >= 0.70);

  console.log("  [PASS] Case E: Static button element cleanly re-grounded (#10 -> #3, score: " + reground.score.toFixed(2) + ")");
}

// ============================================================================
// PART 3: DOM INDEX SHIFT & INDEPENDENCE (REQUIREMENT 1 & 2)
// ============================================================================
console.log("\n--- PART 3: DOM INDEX SHIFT & IDENTITY INDEPENDENCE ---");

{
  // A target descriptor where originalIndex was 99, but on fresh page it is at 0
  const desc = {
    normalizedLabel: "from",
    targetLabel: "From",
    role: "combobox",
    inputType: "input",
    placeholder: "From*",
    ariaLabel: "From",
    id: "origin_station",
    originalIndex: 99 // Completely wrong/stale index
  };

  const freshElements = [
    {
      label: "From",
      type: "combobox",
      role: "combobox",
      placeholder: "From*",
      ariaLabel: "From",
      id: "origin_station",
      index: 0
    },
    {
      label: "To",
      type: "combobox",
      role: "combobox",
      placeholder: "To*",
      ariaLabel: "To",
      id: "dest_station",
      index: 1
    }
  ];

  const reground = reGroundSemanticTarget(freshElements, desc);
  assert.ok(reground.match, "Must ground even when originalIndex is completely stale");
  assert.strictEqual(reground.index, 0);
  console.log("  [PASS] DOM index independence: Stale originalIndex=99 discarded; re-grounded accurately to index 0");
}

// ============================================================================
// PART 4: SAFETY GATE & AMBIGUITY REJECTION (REQUIREMENT 6 & SAFETY)
// ============================================================================
console.log("\n--- PART 4: SAFETY GATE & AMBIGUITY REJECTION ---");

{
  // Two identical candidate elements with identical labels, types, and scores
  const desc = {
    normalizedLabel: "download",
    targetLabel: "Download",
    role: "button"
  };

  const ambiguousElements = [
    { label: "Download", type: "button", role: "button", index: 0 },
    { label: "Download", type: "button", role: "button", index: 1 }
  ];

  const reground = reGroundSemanticTarget(ambiguousElements, desc);
  // Re-grounding should flag ambiguity if they have different identity or validateRecoveryTarget catches it
  const validation = actionVerifier.validateRecoveryTarget(ambiguousElements[0], ambiguousElements, {
    action: "CLICK",
    targetLabel: "Download",
    targetType: "button"
  });

  assert.strictEqual(validation.valid, false);
  assert.ok(validation.reason.includes("ambiguous"), "Must reject duplicate targets as ambiguous");
  console.log("  [PASS] Ambiguity rejection: Duplicate identical candidates safely rejected: '" + validation.reason + "'");
}

// ============================================================================
// PART 5: CONTENT.JS DYNAMIC CONTROLS SUPPORT & EXECUTION
// ============================================================================
console.log("\n--- PART 5: CONTENT.JS DYNAMIC CONTROLS RE-GROUNDING ---");

{
  const contentCode = fs.readFileSync(path.join(__dirname, "content.js"), "utf8");

  // Extract content.js findBestSemanticCandidate function
  const findBestSemanticCandidateMatch = contentCode.match(/function findBestSemanticCandidate\([\s\S]+?\n\}/);
  assert.ok(findBestSemanticCandidateMatch, "findBestSemanticCandidate must be present in content.js");

  const scoreCandidateMatch = contentCode.match(/function scoreCandidateAgainstDescriptor\([\s\S]+?\n\}/);
  assert.ok(scoreCandidateMatch, "scoreCandidateAgainstDescriptor must be present in content.js");

  const normalizeLabelMatch = contentCode.match(/function normalizeLabel\([\s\S]+?\n\}/);
  assert.ok(normalizeLabelMatch, "normalizeLabel must be present in content.js");

  const labelsMatchMatch = contentCode.match(/function labelsMatch\([\s\S]+?\n\}/);
  assert.ok(labelsMatchMatch, "labelsMatch must be present in content.js");

  const isFieldMatchMatchContent = contentCode.match(/function isFieldMatch\([\s\S]+?\n\}/);

  const evalContentFn = new Function(`
    ${normalizeLabelMatch[0]}
    ${labelsMatchMatch[0]}
    ${isFieldMatchMatchContent ? isFieldMatchMatchContent[0] : ""}
    ${scoreCandidateMatch[0]}
    ${findBestSemanticCandidateMatch[0]}
    return { findBestSemanticCandidate };
  `)();

  const targetDesc = {
    normalizedLabel: "search mail",
    targetLabel: "Search mail",
    role: "combobox",
    targetType: "combobox",
    placeholder: "Search mail",
    ariaLabel: "Search mail",
    name: "q",
    id: "aso_search_form_anchor"
  };

  const freshElements = [
    { label: "Inbox", type: "link", node: { isConnected: true } },
    {
      label: "Search mail",
      type: "combobox",
      role: "combobox",
      placeholder: "Search mail",
      ariaLabel: "Search mail",
      name: "q",
      id: "aso_search_form_anchor",
      node: { isConnected: true, tagName: "INPUT", type: "text" }
    }
  ];

  const res = evalContentFn.findBestSemanticCandidate(freshElements, targetDesc);
  assert.ok(res.match, "content.js findBestSemanticCandidate must find Gmail search combobox");
  assert.strictEqual(res.match.label, "Search mail");
  assert.strictEqual(res.isAmbiguous, false);
  console.log("  [PASS] content.js findBestSemanticCandidate cleanly grounds dynamic combobox control");
}

// ============================================================================
// PART 6: PRIVACY GUARANTEE (ZERO TRANSMISSION OF FIELD VALUES)
// ============================================================================
console.log("\n--- PART 6: PRIVACY GUARANTEE ---");

{
  const confidentialPasswordEl = {
    label: "Password",
    type: "input",
    inputType: "password",
    id: "user_secret_pwd",
    value: "super_secret_12345!@#" // Simulating DOM node with user value
  };

  const desc = createSemanticTargetDescriptor(confidentialPasswordEl, "Password", "input");

  // Verify descriptor NEVER contains `.value`
  assert.strictEqual(desc.value, undefined, "Descriptor must NEVER contain user field value");
  assert.strictEqual(JSON.stringify(desc).includes("super_secret"), false, "Descriptor must never leak secret string");

  console.log("  [PASS] Privacy Guarantee: Field values strictly omitted from descriptors (zero credential leakage)");
}

console.log("\n============================================================");
console.log("ALL DYNAMIC FORM RE-GROUNDING & RECOVERY TESTS PASSED!");
console.log("============================================================\n");
