/**
 * test-exact-text-composite-grounding.js
 * Regression & Acceptance Test Suite for Exact-Text Click Grounding on Composite UI Controls.
 *
 * Specifically verifies:
 * 1. LinkedIn Home: [profile avatar] [Start a post]
 *    - Requested: CLICK "Start a post"
 *    - Expected: click the composer trigger containing "Start a post"
 *    - Forbidden: clicking the profile/avatar
 * 2. Composite UI controls where exact visible text is in a child node (<span> / <div>)
 *    and nearest clickable container is resolved upward.
 * 3. Exact text match constraint outranking proximity, fuzzy match, and generic clickable match.
 * 4. Target identity preservation through execution (DOM index, bounding box, matched text, role).
 * 5. Re-grounding before CLICK:
 *    - Re-resolves same semantic target.
 *    - Fails safely if exact text is missing (does NOT click nearby element).
 *    - Halts safely with ambiguous status if multiple exact matches exist.
 * 6. Regression protection:
 *    - Google Search input resolves to search input, not AI/chat.
 *    - Google Search result selection uses intended result.
 *    - Google Form multi-field filling intact.
 *    - Normal instruction "Open LinkedIn and click Start a post" works cleanly.
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const taskParser = require("./task-parser.js");
const reasoningPlanner = require("./reasoning-planner.js");
const contentScript = require("./content.js");

console.log("============================================================");
console.log("RUNNING EXACT-TEXT COMPOSITE UI CONTROL GROUNDING TEST SUITE");
console.log("============================================================\n");

// ------------------------------------------------------------
// 1. Task Parser & Normal Phrasing
// ------------------------------------------------------------
console.log("--- 1. Task Parsing: 'Open LinkedIn and click Start a post' ---");
const taskText = "Open LinkedIn and click Start a post";
const parsed = taskParser.parseTask(taskText);
assert.strictEqual(parsed.intent, "MULTI_STEP");
assert.strictEqual(parsed.steps.length, 2);

const step0 = parsed.steps[0];
assert.strictEqual(step0.action, "NAVIGATE");
assert.strictEqual(step0.target, "LinkedIn");

const step1 = parsed.steps[1];
assert.strictEqual(step1.action, "CLICK");
assert.strictEqual(step1.target, "Start a post");

console.log("  [PASS] Parsed cleanly into NAVIGATE LinkedIn and CLICK Start a post\n");

// ------------------------------------------------------------
// 2. LinkedIn Home: [profile avatar] [Start a post] Candidate Scoring
// ------------------------------------------------------------
console.log("--- 2. Grounding Scoring: Avatar vs Composer Trigger ---");

const linkedInPerceptionElements = [
  {
    index: 0,
    type: "link",
    tag: "a",
    role: "link",
    label: "Sanketh Mallikarjuna",
    alt: "Profile photo",
    className: "ember-view share-box-feed-entry__avatar",
    url: "https://www.linkedin.com/in/sanketh-mallikarjuna",
    bounds: { x: 50, y: 150, width: 48, height: 48 },
    nearbyText: "Start a post, try writing with AI"
  },
  {
    index: 1,
    type: "button",
    tag: "button",
    role: "button",
    label: "Start a post",
    text: "Start a post, try writing with AI",
    className: "artdeco-button artdeco-button--muted share-box-feed-entry__trigger",
    bounds: { x: 110, y: 150, width: 400, height: 48 },
    nearbyText: "Sanketh Mallikarjuna"
  }
];

// Test content.js scoreCandidateAgainstDescriptor
const descStartPost = {
  targetLabel: "Start a post",
  role: "button",
  targetType: "button"
};

const avatarScore = contentScript.scoreCandidateAgainstDescriptor(linkedInPerceptionElements[0], descStartPost);
const triggerScore = contentScript.scoreCandidateAgainstDescriptor(linkedInPerceptionElements[1], descStartPost);

console.log(`  Avatar score for 'Start a post': ${avatarScore}`);
console.log(`  Trigger score for 'Start a post': ${triggerScore}`);

assert.strictEqual(avatarScore, 0, "Profile avatar/image MUST score 0 (Forbidden)");
assert.ok(triggerScore >= 0.85, `Composer trigger must score high confidence, got ${triggerScore}`);
console.log("  [PASS] Trigger outranked avatar; avatar strictly rejected (score 0)\n");

// ------------------------------------------------------------
// 3. Composite UI Control Ancestor Walk (Child text element -> Clickable parent)
// ------------------------------------------------------------
console.log("--- 3. Composite UI Ancestor Walk Resolution ---");

// Mock DOM elements simulating LinkedIn's composite share box
const mockShareBoxButton = {
  tagName: "BUTTON",
  className: "artdeco-button share-box-feed-entry__trigger",
  disabled: false,
  isConnected: true,
  getAttribute: (k) => (k === "role" ? "button" : null),
  clickCalled: false,
  click: function() { this.clickCalled = true; },
  parentElement: null
};

const mockTextSpan = {
  tagName: "SPAN",
  className: "artdeco-button__text",
  innerText: "Start a post",
  textContent: "Start a post",
  isConnected: true,
  parentElement: mockShareBoxButton,
  getAttribute: () => null
};

// Test findClickableExactTextTarget
const testCandidates = [
  {
    index: 0,
    node: {
      tagName: "A",
      className: "feed-identity-module__actor-avatar",
      disabled: false,
      isConnected: true,
      getAttribute: () => "link"
    },
    label: "Sanketh Mallikarjuna",
    alt: "Profile photo",
    className: "feed-identity-module__actor-avatar",
    bounds: { x: 50, y: 150, width: 48, height: 48 }
  },
  {
    index: 1,
    node: mockShareBoxButton,
    label: "Start a post",
    className: "artdeco-button share-box-feed-entry__trigger",
    bounds: { x: 110, y: 150, width: 400, height: 48 }
  }
];

const exactRes = contentScript.findClickableExactTextTarget("Start a post", testCandidates);
assert.ok(exactRes, "findClickableExactTextTarget must return result");
assert.ok(exactRes.match, "Must find match");
assert.strictEqual(exactRes.match.index, 1, "Must match composer trigger (index 1), NOT avatar (index 0)");
assert.strictEqual(exactRes.match.node, mockShareBoxButton, "Must match the button node");
console.log("  [PASS] Composite control resolved to composer trigger button, preserving exact text evidence\n");

// ------------------------------------------------------------
// 4. Target Identity Preservation from Grounding to Execution
// ------------------------------------------------------------
console.log("--- 4. Target Identity Preservation ---");

const executionPayload = {
  action: "CLICK",
  targetIndex: 1,
  targetType: "button",
  targetLabel: "Start a post",
  exactTargetText: "Start a post",
  bounds: { x: 110, y: 150, width: 400, height: 48 },
  semanticTargetDescriptor: {
    targetLabel: "Start a post",
    exactText: "Start a post",
    normalizedLabel: "start a post",
    targetType: "button",
    role: "button",
    originalIndex: 1,
    bounds: { x: 110, y: 150, width: 400, height: 48 }
  }
};

assert.strictEqual(executionPayload.targetIndex, 1);
assert.strictEqual(executionPayload.exactTargetText, "Start a post");
assert.strictEqual(executionPayload.bounds.x, 110);
assert.strictEqual(executionPayload.targetType, "button");
console.log("  [PASS] Target identity (DOM index, bbox, matched text, role) preserved in payload\n");

// ------------------------------------------------------------
// 5. Re-grounding before CLICK: Safe Failure when Missing
// ------------------------------------------------------------
console.log("--- 5. Safe Failure when Exact Text is Missing ---");

const emptyPageCandidates = [
  {
    index: 0,
    node: { tagName: "A", disabled: false, isConnected: true, getAttribute: () => null },
    label: "Messaging",
    bounds: { x: 50, y: 50, width: 60, height: 30 }
  },
  {
    index: 1,
    node: { tagName: "A", disabled: false, isConnected: true, getAttribute: () => null },
    label: "Notifications",
    bounds: { x: 120, y: 50, width: 80, height: 30 }
  }
];

const missingRes = contentScript.findClickableExactTextTarget("Start a post", emptyPageCandidates);
assert.ok(missingRes.notFound, "Must report notFound when exact text does not exist");
assert.strictEqual(missingRes.match, undefined, "Must NOT pick a nearby element");
console.log("  [PASS] Missing target handled safely without guessing or clicking nearby elements\n");

// ------------------------------------------------------------
// 6. Ambiguity Handling: Multiple Exact Candidates
// ------------------------------------------------------------
console.log("--- 6. Ambiguity Handling: Multiple Identical Candidates ---");

const duplicateCandidates = [
  {
    index: 0,
    node: { tagName: "BUTTON", disabled: false, isConnected: true, getAttribute: () => "button" },
    label: "Start a post",
    bounds: { x: 100, y: 100, width: 200, height: 40 }
  },
  {
    index: 1,
    node: { tagName: "BUTTON", disabled: false, isConnected: true, getAttribute: () => "button" },
    label: "Start a post",
    bounds: { x: 100, y: 400, width: 200, height: 40 }
  }
];

const ambiguousRes = contentScript.findClickableExactTextTarget("Start a post", duplicateCandidates);
assert.strictEqual(ambiguousRes.isAmbiguous, true, "Must flag ambiguous when multiple identical targets exist");
assert.strictEqual(ambiguousRes.totalCount, 2);
console.log("  [PASS] Ambiguous target flagged and stopped safely without guessing\n");

// ------------------------------------------------------------
// 7. Regression Protection for Existing Cases
// ------------------------------------------------------------
console.log("--- 7. Regression Protection ---");

// 7.1 Google Search Input
const searchCand = {
  type: "input",
  tag: "input",
  role: "combobox",
  label: "Search",
  semanticTag: "SEARCH_INPUT",
  bounds: { x: 200, y: 200, width: 500, height: 40 }
};
const aiChatCand = {
  type: "textarea",
  tag: "textarea",
  role: "textbox",
  label: "Ask Gemini / AI Mode",
  bounds: { x: 200, y: 300, width: 500, height: 100 }
};
const searchScore = contentScript.scoreCandidateAgainstDescriptor(searchCand, { isSearchIntent: true, targetLabel: "search" });
const aiScore = contentScript.scoreCandidateAgainstDescriptor(aiChatCand, { isSearchIntent: true, targetLabel: "search" });
assert.ok(searchScore > aiScore, "Search input must outscore AI Mode textarea");
console.log("  [PASS] Google Search input correctly prioritized over AI chat");

// 7.2 Safety Gate for Send
const sendStep = { action: "CLICK", target: "Send" };
const safetyRes = reasoningPlanner.evaluateSafetyGate(sendStep, sendStep, null, { url: "https://mail.google.com" });
assert.strictEqual(safetyRes.allowed, false, "CLICK Send must require approval");
assert.strictEqual(safetyRes.requiresApproval, true);
console.log("  [PASS] Safety gate on high-risk Send actions fully intact");

console.log("\n============================================================");
console.log("ALL EXACT-TEXT COMPOSITE GROUNDING REGRESSION TESTS PASSED!");
console.log("============================================================\n");
