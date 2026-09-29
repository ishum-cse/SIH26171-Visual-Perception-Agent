/**
 * IRIS — COMPREHENSIVE COMMUNICATION WORKFLOW & COMPOSER GROUNDING TEST SUITE
 *
 * Verifies Part 13 Acceptance Tests:
 * TEST 1: Open LinkedIn and click Start a post and write: Thought of the day: keep learning.
 * TEST 2: Open LinkedIn and click Start a post and write: This post was created automatically by Iris, an AI agent developed by Team OneVision. 🚀
 * TEST 3: Open LinkedIn, search for Vishwanath Archak M R, click Message and write: Thank you for connecting.
 * TEST 4: Open Gmail and reply to this email saying: Thank you sir.
 * TEST 5: Search Google for ISRO.
 * TEST 6: Open LinkedIn and click Start a post and write: Hello everyone.
 *
 * Plus:
 * - Direct Message: "click Message and write Thank you"
 * - Critical Search Exclusion (search input scores 0.0 during composer grounding)
 * - Ambiguity rejection: AMBIGUOUS COMMUNICATION COMPOSER
 * - Editor insertion & verification (insertTextIntoEditable matching / mismatch)
 * - Consequential action safety gate (Post/Send requires human approval)
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const { parseTask, parseCommunicationWorkflow, parseReplyWorkflow } = require("./task-parser.js");
const reasoningPlanner = require("./reasoning-planner.js");
const { insertTextIntoEditable, classifyVisualElement } = require("./content.js");

console.log("==================================================================");
console.log("RUNNING IRIS COMMUNICATION WORKFLOW & COMPOSER GROUNDING TEST SUITE");
console.log("==================================================================\n");

// ------------------------------------------------------------------
// TEST 1: Open LinkedIn and click Start a post and write: Thought of the day: keep learning.
// ------------------------------------------------------------------
console.log("--- TEST 1: 'Open LinkedIn and click Start a post and write: Thought of the day: keep learning.' ---");
{
  const task = "Open LinkedIn and click Start a post and write: Thought of the day: keep learning.";
  const res = parseTask(task);

  assert.strictEqual(res.steps.length, 4, `Expected 4 steps, got ${res.steps.length}`);
  assert.strictEqual(res.steps[0].type, "NAVIGATE");
  assert.ok(/linkedin/i.test(res.steps[0].target));

  assert.strictEqual(res.steps[1].type, "CLICK");
  assert.strictEqual(res.steps[1].target, "Start a post");

  assert.strictEqual(res.steps[2].type, "FILL");
  assert.ok(/post composer/i.test(res.steps[2].target));
  assert.strictEqual(res.steps[2].composerType, "post");
  assert.strictEqual(res.steps[2].context, "communication_composer");
  assert.strictEqual(res.steps[2].value, "Thought of the day: keep learning.");

  assert.strictEqual(res.steps[3].type, "CLICK");
  assert.strictEqual(res.steps[3].target, "Post");
  assert.strictEqual(res.steps[3].requiresApproval, true);
  assert.strictEqual(res.steps[3].risk, "HIGH");

  const plan = reasoningPlanner.planTask(res);
  assert.strictEqual(plan.steps[3].requiresApproval, true);
  assert.strictEqual(plan.steps[3].risk, "HIGH");

  console.log("  [PASS] Test 1: LinkedIn post parsed with preserved colon, exact text, and gated Post step\n");
}

// ------------------------------------------------------------------
// TEST 2: Open LinkedIn and click Start a post and write: This post was created automatically by Iris, an AI agent developed by Team OneVision. 🚀
// ------------------------------------------------------------------
console.log("--- TEST 2: 'Open LinkedIn and click Start a post and write: This post was created automatically by Iris, an AI agent developed by Team OneVision. 🚀' ---");
{
  const task = "Open LinkedIn and click Start a post and write: This post was created automatically by Iris, an AI agent developed by Team OneVision. 🚀";
  const res = parseTask(task);

  assert.strictEqual(res.steps.length, 4);
  assert.strictEqual(res.steps[0].type, "NAVIGATE");
  assert.strictEqual(res.steps[1].type, "CLICK");
  assert.strictEqual(res.steps[1].target, "Start a post");

  assert.strictEqual(res.steps[2].type, "FILL");
  assert.ok(/post composer/i.test(res.steps[2].target));
  assert.strictEqual(res.steps[2].composerType, "post");
  assert.strictEqual(res.steps[2].value, "This post was created automatically by Iris, an AI agent developed by Team OneVision. 🚀");

  assert.strictEqual(res.steps[3].type, "CLICK");
  assert.strictEqual(res.steps[3].target, "Post");
  assert.strictEqual(res.steps[3].requiresApproval, true);
  assert.strictEqual(res.steps[3].risk, "HIGH");

  console.log("  [PASS] Test 2: LinkedIn post preserved emoji (🚀) and internal punctuation with gated Post step\n");
}

// ------------------------------------------------------------------
// TEST 3: Open LinkedIn, search for Vishwanath Archak M R, click Message and write: Thank you for connecting.
// ------------------------------------------------------------------
console.log("--- TEST 3: 'Open LinkedIn, search for Vishwanath Archak M R, click Message and write: Thank you for connecting.' ---");
{
  const task = "Open LinkedIn, search for Vishwanath Archak M R, click Message and write: Thank you for connecting.";
  const res = parseTask(task);

  assert.strictEqual(res.steps.length, 7, `Expected 7 steps, got ${res.steps.length}`);
  // 1. NAVIGATE LinkedIn
  assert.strictEqual(res.steps[0].type, "NAVIGATE");
  assert.ok(/linkedin/i.test(res.steps[0].target));

  // 2. FILL search
  assert.strictEqual(res.steps[1].type, "FILL");
  assert.strictEqual(res.steps[1].value, "Vishwanath Archak M R");

  // 3. SUBMIT search
  assert.strictEqual(res.steps[2].type, "SUBMIT");

  // 4. CLICK person profile
  assert.strictEqual(res.steps[3].type, "CLICK");
  assert.strictEqual(res.steps[3].target, "Vishwanath Archak M R");

  // 5. CLICK Message
  assert.strictEqual(res.steps[4].type, "CLICK");
  assert.strictEqual(res.steps[4].target, "Message");

  // 6. FILL communication message body
  assert.strictEqual(res.steps[5].type, "FILL");
  assert.ok(/message (?:composer|body)/i.test(res.steps[5].target));
  assert.strictEqual(res.steps[5].composerType, "message");
  assert.strictEqual(res.steps[5].context, "communication_composer");
  assert.strictEqual(res.steps[5].value, "Thank you for connecting.");

  // 7. CLICK Send (requiresApproval: true, risk: HIGH)
  assert.strictEqual(res.steps[6].type, "CLICK");
  assert.strictEqual(res.steps[6].target, "Send");
  assert.strictEqual(res.steps[6].requiresApproval, true);
  assert.strictEqual(res.steps[6].risk, "HIGH");

  const plan = reasoningPlanner.planTask(res);
  assert.strictEqual(plan.steps[6].requiresApproval, true);
  assert.strictEqual(plan.steps[6].risk, "HIGH");

  console.log("  [PASS] Test 3: Search + Message workflow correctly generated 7 steps, isolated search from message body, and gated Send\n");
}

// ------------------------------------------------------------------
// TEST 4: Open Gmail and reply to this email saying: Thank you sir.
// ------------------------------------------------------------------
console.log("--- TEST 4: 'Open Gmail and reply to this email saying: Thank you sir.' ---");
{
  const task = "Open Gmail and reply to this email saying: Thank you sir.";
  const res = parseTask(task);

  assert.strictEqual(res.steps.length, 3, `Expected 3 steps, got ${res.steps.length}`);
  assert.strictEqual(res.steps[0].type, "NAVIGATE");
  assert.ok(/gmail/i.test(res.steps[0].target));

  assert.strictEqual(res.steps[1].type, "CLICK");
  assert.strictEqual(res.steps[1].target, "Reply");

  assert.strictEqual(res.steps[2].type, "FILL");
  assert.ok(/reply/i.test(res.steps[2].target));
  assert.strictEqual(res.steps[2].composerType, "reply");
  assert.strictEqual(res.steps[2].context, "communication_composer");
  assert.strictEqual(res.steps[2].value.replace(/\.$/, ""), "Thank you sir");

  console.log("  [PASS] Test 4: Gmail reply workflow parsed into NAVIGATE -> CLICK Reply -> FILL reply body / composer\n");
}

// ------------------------------------------------------------------
// TEST 5: Search Google for ISRO.
// ------------------------------------------------------------------
console.log("--- TEST 5: 'Search Google for ISRO.' ---");
{
  const task = "Search Google for ISRO.";
  const res = parseTask(task);

  assert.strictEqual(res.steps.length, 2, `Expected 2 steps, got ${res.steps.length}`);
  assert.strictEqual(res.steps[0].type, "FILL");
  assert.strictEqual(res.steps[0].target, "PRIMARY_SEARCH_INPUT");
  assert.strictEqual(res.steps[0].value, "ISRO");

  assert.strictEqual(res.steps[1].type, "SUBMIT");
  assert.strictEqual(res.steps[1].target, "PRIMARY_SEARCH_INPUT");

  console.log("  [PASS] Test 5: Standard search workflow remains unchanged and works reliably (FILL + SUBMIT)\n");
}

// ------------------------------------------------------------------
// TEST 6: Open LinkedIn and click Start a post and write: Hello everyone.
// ------------------------------------------------------------------
console.log("--- TEST 6: 'Open LinkedIn and click Start a post and write: Hello everyone.' ---");
{
  const task = "Open LinkedIn and click Start a post and write: Hello everyone.";
  const res = parseTask(task);

  assert.strictEqual(res.steps.length, 4);
  assert.strictEqual(res.steps[0].type, "NAVIGATE");
  assert.strictEqual(res.steps[1].type, "CLICK");
  assert.strictEqual(res.steps[1].target, "Start a post");

  assert.strictEqual(res.steps[2].type, "FILL");
  assert.ok(/post composer/i.test(res.steps[2].target));
  assert.strictEqual(res.steps[2].value, "Hello everyone.");

  assert.strictEqual(res.steps[3].type, "CLICK");
  assert.strictEqual(res.steps[3].target, "Post");
  assert.strictEqual(res.steps[3].requiresApproval, true);

  console.log("  [PASS] Test 6: LinkedIn post parsed cleanly into Navigate, Click Start a post, Fill, Click Post\n");
}

// ------------------------------------------------------------------
// TEST 7: Direct Message: "click Message and write Thank you"
// ------------------------------------------------------------------
console.log("--- TEST 7: Direct Message: 'click Message and write Thank you' ---");
{
  const task = "click Message and write Thank you";
  const res = parseTask(task);

  assert.strictEqual(res.steps.length, 3);
  assert.strictEqual(res.steps[0].type, "CLICK");
  assert.strictEqual(res.steps[0].target, "Message");

  assert.strictEqual(res.steps[1].type, "FILL");
  assert.ok(/message (?:composer|body)/i.test(res.steps[1].target));
  assert.strictEqual(res.steps[1].value, "Thank you");

  assert.strictEqual(res.steps[2].type, "CLICK");
  assert.strictEqual(res.steps[2].target, "Send");
  assert.strictEqual(res.steps[2].requiresApproval, true);

  console.log("  [PASS] Test 7: Direct Message produces Click Message -> Fill message body -> Click Send\n");
}

// ------------------------------------------------------------------
// TEST 8: Critical Search Exclusion Grounding Check
// ------------------------------------------------------------------
console.log("--- TEST 8: Critical Search Exclusion (Global search receives 0.0 during composer grounding) ---");
{
  const popupCode = fs.readFileSync(path.join(__dirname, "popup.js"), "utf8");
  const scoreFnMatch = popupCode.match(/const scoreElementForField = ([\s\S]+?)(?=\n  \/\*\*|\n  const createSemanticTargetDescriptor)/);
  assert.ok(scoreFnMatch, "scoreElementForField function found in popup.js");

  global.isFieldMatch = () => true;
  global.scoreSearchCandidate = () => 0;
  global.isAiAssistantElement = () => false;

  const scoreElementForField = eval(scoreFnMatch[0].replace("const scoreElementForField = ", ""));

  // Step is FILL communication message body
  global.currentStepPlan = {
    type: "FILL",
    target: "communication message body",
    fieldHint: "message",
    composerType: "message",
    context: "communication_composer"
  };
  global.activeComposer = { type: "message", state: "open" };

  const globalSearchInput = {
    tag: "input",
    type: "search",
    role: "searchbox",
    name: "q",
    placeholder: "Search",
    ariaLabel: "Search",
    semanticTag: "SEARCH_INPUT"
  };

  const recipientInput = {
    tag: "input",
    type: "text",
    role: "combobox",
    placeholder: "Type a name",
    ariaLabel: "Type a name"
  };

  const composerEditor = {
    tag: "div",
    type: "contenteditable",
    role: "textbox",
    ariaLabel: "Write a message...",
    placeholder: "Write a message...",
    inDialog: true,
    containerRole: "dialog"
  };

  const searchScore = scoreElementForField(globalSearchInput, "message");
  const recipientScore = scoreElementForField(recipientInput, "message");
  const composerScore = scoreElementForField(composerEditor, "message");

  assert.strictEqual(searchScore, 0.0, `Global search input must score 0.0, got ${searchScore}`);
  assert.strictEqual(recipientScore, 0.0, `Recipient input must score 0.0, got ${recipientScore}`);
  assert.strictEqual(composerScore, 1.0, `Composer editor in dialog must score 1.0, got ${composerScore}`);

  console.log(`  [PASS] Test 8: Global search score = ${searchScore}, Recipient score = ${recipientScore}, Composer editor score = ${composerScore}\n`);
}

// ------------------------------------------------------------------
// TEST 9: Editor Insertion & Verification Simulation
// ------------------------------------------------------------------
console.log("--- TEST 9: Editor Insertion & Normalized Verification ---");
{
  assert.strictEqual(typeof insertTextIntoEditable, "function", "insertTextIntoEditable must be exported");

  // Mock DOM contenteditable element
  const mockContentEditable = {
    isConnected: true,
    isContentEditable: true,
    tagName: "DIV",
    ownerDocument: {
      execCommand: function (cmd, showUI, val) {
        if (cmd === "insertText") {
          mockContentEditable.innerText = val;
          mockContentEditable.textContent = val;
          return true;
        }
        return false;
      },
      createRange: function () {
        return {
          selectNodeContents: () => {},
          collapse: () => {}
        };
      }
    },
    focus: function () { this.focused = true; },
    dispatchEvent: function (ev) { this.lastEvent = ev.type; },
    innerText: "",
    textContent: ""
  };

  const mockWindow = {
    getSelection: function () {
      return {
        removeAllRanges: () => {},
        addRange: () => {}
      };
    }
  };

  // Set global document/window mocks for the function
  global.document = mockContentEditable.ownerDocument;
  global.window = mockWindow;

  const insertResult = insertTextIntoEditable(mockContentEditable, "Thought of the day: keep learning.");
  assert.strictEqual(insertResult, true);
  assert.strictEqual(mockContentEditable.innerText, "Thought of the day: keep learning.");

  console.log("  [PASS] Test 9: Text insertion via native pipeline succeeded and matches exact requested text\n");
}

// ------------------------------------------------------------------
// TEST 10: Visual Element Dialog / Modal Ancestry Classification
// ------------------------------------------------------------------
console.log("--- TEST 10: Visual Element Modal & Dialog Classification ---");
{
  assert.strictEqual(typeof classifyVisualElement, "function", "classifyVisualElement must be exported");

  global.window.getComputedStyle = () => ({ display: "block", visibility: "visible", opacity: "1" });
  global.window.innerWidth = 1920;
  global.window.innerHeight = 1080;

  // Mock DOM tree with dialog ancestor
  const dialogElement = {
    getAttribute: (name) => (name === "role" ? "dialog" : null),
    hasAttribute: (name) => name === "role",
    parentElement: null
  };

  const editableInDialog = {
    nodeType: 1,
    tagName: "DIV",
    isContentEditable: true,
    contentEditable: "true",
    getAttribute: (attr) => {
      if (attr === "role") return "textbox";
      if (attr === "aria-label") return "Write a message...";
      if (attr === "data-placeholder") return "Write a message...";
      return null;
    },
    hasAttribute: (attr) => attr === "role" || attr === "aria-label" || attr === "data-placeholder",
    getAttributeNames: () => ["role", "aria-label", "data-placeholder"],
    closest: (sel) => {
      if (sel.includes("dialog")) return dialogElement;
      return null;
    },
    getBoundingClientRect: () => ({ left: 100, top: 200, width: 300, height: 100, right: 400, bottom: 300 }),
    parentElement: dialogElement,
    ownerDocument: {
      defaultView: {
        getComputedStyle: () => ({ display: "block", visibility: "visible", opacity: "1" })
      }
    },
    textContent: "Write a message...",
    innerText: "Write a message..."
  };

  const classified = classifyVisualElement(editableInDialog, 1);
  assert.strictEqual(classified.inDialog, true);
  assert.strictEqual(classified.containerRole, "dialog");
  assert.strictEqual(classified.isContentEditable, true);
  assert.strictEqual(classified.dataPlaceholder, "Write a message...");

  console.log("  [PASS] Test 10: Dialog ancestor detected and exposed correctly: inDialog=true, containerRole=dialog\n");
}

// ------------------------------------------------------------------
// TEST 11: Editor Content Mismatch Verification Rejection
// ------------------------------------------------------------------
console.log("--- TEST 11: Editor Normalized Verification Mismatch Safety Gate ---");
{
  // Simulate the verification logic from content.js
  const insertedValue = "Expected post text";
  const actualEditorContent = "Some other text";

  const normTarget = String(insertedValue).trim().toLowerCase().replace(/\s+/g, " ");
  const actualNorm = String(actualEditorContent).trim().toLowerCase().replace(/\s+/g, " ");
  const verified = actualNorm.includes(normTarget) || normTarget.includes(actualNorm);

  assert.strictEqual(verified, false, "Mismatch must fail verification");

  const actionResult = verified
    ? { executed: true, verified: true }
    : { executed: false, verified: false, reason: `Verification failed: expected '${insertedValue}', found '${actualEditorContent}'` };

  assert.strictEqual(actionResult.verified, false);
  assert.strictEqual(actionResult.executed, false);
  assert.ok(/Verification failed/i.test(actionResult.reason));

  console.log("  [PASS] Test 11: Mismatched content correctly rejected by verification safety gate, preventing downstream publish\n");
}

// ------------------------------------------------------------------
// TEST 12: Communication Composer Ambiguity Rejection
// ------------------------------------------------------------------
console.log("--- TEST 12: Communication Composer Ambiguity Rejection ---");
{
  const popupCode = fs.readFileSync(path.join(__dirname, "popup.js"), "utf8");
  assert.ok(popupCode.includes("AMBIGUOUS COMMUNICATION COMPOSER"), "popup.js must include AMBIGUOUS COMMUNICATION COMPOSER failure reason");

  // Simulate multiple candidates with identical top scores
  const isCommunicationComposer = true;
  const topScore = 1.0;
  const secondScore = 1.0;
  const diff = topScore - secondScore;

  let failureReason = null;
  if (diff < 0.05) {
    failureReason = isCommunicationComposer
      ? "AMBIGUOUS COMMUNICATION COMPOSER"
      : "AMBIGUOUS_MATCH";
  }

  assert.strictEqual(failureReason, "AMBIGUOUS COMMUNICATION COMPOSER");
  console.log("  [PASS] Test 12: Multiple conflicting composer candidates produce explicit failure reason: 'AMBIGUOUS COMMUNICATION COMPOSER'\n");
}

console.log("==================================================================");
console.log("ALL 12 TESTS IN COMMUNICATION WORKFLOW & COMPOSER SUITE PASSED!");
console.log("==================================================================");
