/**
 * IRIS — ACTIVE COMPOSER GROUNDING & NATURAL-LANGUAGE FILL INTENT REGRESSION TEST SUITE
 *
 * Tests:
 * 1. Primary real-world LinkedIn messaging command:
 *    "click on message button and write a message with thank you sir"
 * 2. Section 13 Regression Tests:
 *    - TEST 1: "Click Message and write thank you sir."
 *    - TEST 2: "Click Reply and type Thanks for your email."
 *    - TEST 3: "Click Compose and write Hello, I wanted to contact you."
 *    - TEST 4: "Click Start a post and write This post was created automatically by Iris."
 *    - TEST 5: "Fill the form: Name = Sanketh, Email = abc@gmail.com, Phone = 1234."
 *    - TEST 6: "Search for ISRO."
 *    - TEST 7: "Click Send."
 * 3. Additional requirements:
 *    - "open compose and type hello"
 *    - "send a message saying hello"
 *    - "write this in the comments box: Great post"
 * 4. Grounding & Placeholder Semantic Matching (LinkedIn "Write a message..." DOM element)
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");

// Load modules in VM sandbox with browser globals
const vm = require("vm");

const sandbox = {
  console,
  setTimeout,
  clearTimeout,
  window: {},
  document: {
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => []
  },
  navigator: { userAgent: "Node" }
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;

vm.createContext(sandbox);

// Load semantic-resolver.js
const semanticResolverCode = fs.readFileSync(path.join(__dirname, "semantic-resolver.js"), "utf8");
vm.runInContext(semanticResolverCode, sandbox);

// Load task-parser.js
const taskParserCode = fs.readFileSync(path.join(__dirname, "task-parser.js"), "utf8");
vm.runInContext(taskParserCode, sandbox);

// Load reasoning-planner.js
const reasoningPlannerCode = fs.readFileSync(path.join(__dirname, "reasoning-planner.js"), "utf8");
vm.runInContext(reasoningPlannerCode, sandbox);

const taskParser = sandbox.window.SIHTaskParser;
const reasoningPlanner = sandbox.window.SIHReasoningPlanner;

console.log("============================================================");
console.log("RUNNING ACTIVE COMPOSER GROUNDING REGRESSION TEST SUITE");
console.log("============================================================\n");

// ------------------------------------------------------------
// PRIMARY ACCEPTANCE TEST: LINKEDIN MESSAGING COMMAND
// "click on message button and write a message with thank you sir"
// ------------------------------------------------------------
console.log("--- Acceptance Test: Primary LinkedIn Messaging Task ---");
{
  const task = "click on message button and write a message with thank you sir";
  const parsed = taskParser.parseTask(task);

  assert.strictEqual(parsed.intent, "MULTI_STEP", "Intent must be MULTI_STEP");
  assert.strictEqual(parsed.steps.length, 3, `Must produce exactly 3 steps, got ${parsed.steps.length}`);

  // Step 1: CLICK -> message button / Message
  assert.strictEqual(parsed.steps[0].action, "CLICK");
  assert.ok(/message/i.test(parsed.steps[0].target), "Step 1 target must be message button");

  // Step 2: FILL -> communication message body with value "thank you sir"
  assert.strictEqual(parsed.steps[1].action, "FILL");
  assert.ok(/message (?:composer|body)/i.test(parsed.steps[1].target));
  assert.notStrictEqual(parsed.steps[1].target.toLowerCase(), "write a message", "Target must NEVER be 'write a message'");
  assert.strictEqual(parsed.steps[1].value, "thank you sir");
  assert.strictEqual(parsed.steps[1].composerType, "message");

  // Step 3: CLICK -> Send (requiresApproval: true, risk: HIGH)
  assert.strictEqual(parsed.steps[2].action, "CLICK");
  assert.strictEqual(parsed.steps[2].target, "Send");
  assert.strictEqual(parsed.steps[2].requiresApproval, true);
  assert.strictEqual(parsed.steps[2].risk, "HIGH");

  const plan = reasoningPlanner.planTask(parsed);
  assert.strictEqual(plan.steps[0].expectedTransition, "message_composer_open");
  assert.strictEqual(plan.steps[1].expectedTransition, "message_filled");
  assert.strictEqual(plan.steps[2].requiresApproval, true);
  assert.strictEqual(plan.steps[2].risk, "HIGH");

  console.log("[PASS] Primary task correctly parsed into CLICK Message, FILL communication message body, and CLICK Send (approval gated)\n");
}

// ------------------------------------------------------------
// TEST 1: "Click Message and write thank you sir."
// ------------------------------------------------------------
console.log("--- TEST 1: 'Click Message and write thank you sir.' ---");
{
  const task = "Click Message and write thank you sir.";
  const parsed = taskParser.parseTask(task);

  assert.strictEqual(parsed.steps.length, 3);
  assert.strictEqual(parsed.steps[0].action, "CLICK");
  assert.ok(/message/i.test(parsed.steps[0].target));

  assert.strictEqual(parsed.steps[1].action, "FILL");
  assert.ok(/message (?:composer|body)/i.test(parsed.steps[1].target));
  assert.notStrictEqual(parsed.steps[1].target.toLowerCase(), "write a message");
  assert.strictEqual(parsed.steps[1].value.replace(/\.$/, ""), "thank you sir");

  assert.strictEqual(parsed.steps[2].action, "CLICK");
  assert.strictEqual(parsed.steps[2].target, "Send");
  assert.strictEqual(parsed.steps[2].requiresApproval, true);
  assert.strictEqual(parsed.steps[2].risk, "HIGH");

  const plan = reasoningPlanner.planTask(parsed);
  assert.strictEqual(plan.steps[0].expectedTransition, "message_composer_open");
  assert.strictEqual(plan.steps[1].expectedTransition, "message_filled");
  assert.strictEqual(plan.steps[2].requiresApproval, true);

  console.log("[PASS] TEST 1: CLICK Message -> FILL communication message body = 'thank you sir' -> CLICK Send (approval gated)\n");
}

// ------------------------------------------------------------
// TEST 2: "Click Reply and type Thanks for your email."
// ------------------------------------------------------------
console.log("--- TEST 2: 'Click Reply and type Thanks for your email.' ---");
{
  const task = "Click Reply and type Thanks for your email.";
  const parsed = taskParser.parseTask(task);

  assert.strictEqual(parsed.steps.length, 2);
  assert.strictEqual(parsed.steps[0].action, "CLICK");
  assert.ok(/reply/i.test(parsed.steps[0].target));

  assert.strictEqual(parsed.steps[1].action, "FILL");
  assert.strictEqual(parsed.steps[1].target, "active reply composer");
  assert.strictEqual(parsed.steps[1].value.replace(/\.$/, ""), "Thanks for your email");

  const plan = reasoningPlanner.planTask(parsed);
  assert.strictEqual(plan.steps[0].expectedTransition, "reply_composer_open");
  assert.strictEqual(plan.steps[1].expectedTransition, "reply_filled");

  console.log("[PASS] TEST 2: CLICK Reply -> FILL active reply composer = 'Thanks for your email.'\n");
}

// ------------------------------------------------------------
// TEST 3: "Click Compose and write Hello, I wanted to contact you."
// ------------------------------------------------------------
console.log("--- TEST 3: 'Click Compose and write Hello, I wanted to contact you.' ---");
{
  const task = "Click Compose and write Hello, I wanted to contact you.";
  const parsed = taskParser.parseTask(task);

  assert.strictEqual(parsed.steps.length, 2);
  assert.strictEqual(parsed.steps[0].action, "CLICK");
  assert.ok(/compose/i.test(parsed.steps[0].target));

  assert.strictEqual(parsed.steps[1].action, "FILL");
  assert.strictEqual(parsed.steps[1].target, "active compose textbox");
  assert.strictEqual(parsed.steps[1].value.replace(/\.$/, ""), "Hello, I wanted to contact you");

  const plan = reasoningPlanner.planTask(parsed);
  assert.strictEqual(plan.steps[0].expectedTransition, "compose_modal_open");
  assert.strictEqual(plan.steps[1].expectedTransition, "compose_filled");

  console.log("[PASS] TEST 3: CLICK Compose -> FILL compose body = 'Hello, I wanted to contact you.'\n");
}

// ------------------------------------------------------------
// TEST 4: "Click Start a post and write This post was created automatically by Iris."
// ------------------------------------------------------------
console.log("--- TEST 4: 'Click Start a post and write This post was created automatically by Iris.' ---");
{
  const task = "Click Start a post and write This post was created automatically by Iris.";
  const parsed = taskParser.parseTask(task);

  assert.strictEqual(parsed.steps.length, 3);
  assert.strictEqual(parsed.steps[0].action, "CLICK");
  assert.strictEqual(parsed.steps[0].target, "Start a post");

  assert.strictEqual(parsed.steps[1].action, "FILL");
  assert.ok(/post composer/i.test(parsed.steps[1].target));
  assert.strictEqual(parsed.steps[1].value.replace(/\.$/, ""), "This post was created automatically by Iris");

  assert.strictEqual(parsed.steps[2].action, "CLICK");
  assert.strictEqual(parsed.steps[2].target, "Post");
  assert.strictEqual(parsed.steps[2].requiresApproval, true);
  assert.strictEqual(parsed.steps[2].risk, "HIGH");

  const plan = reasoningPlanner.planTask(parsed);
  assert.strictEqual(plan.steps[0].expectedTransition, "post_composer_open");
  assert.strictEqual(plan.steps[1].expectedTransition, "composer_filled");
  assert.strictEqual(plan.steps[2].requiresApproval, true);

  console.log("[PASS] TEST 4: CLICK Start a post -> FILL post composer -> CLICK Post (approval gated)\n");
}

// ------------------------------------------------------------
// TEST 5: "Fill the form: Name = Sanketh, Email = abc@gmail.com, Phone = 1234."
// ------------------------------------------------------------
console.log("--- TEST 5: 'Fill the form: Name = Sanketh, Email = abc@gmail.com, Phone = 1234.' ---");
{
  const task = "Fill the form: Name = Sanketh, Email = abc@gmail.com, Phone = 1234.";
  const parsed = taskParser.parseTask(task);

  assert.strictEqual(parsed.steps.length, 3);
  assert.strictEqual(parsed.steps[0].action, "FILL");
  assert.strictEqual(parsed.steps[0].fieldHint.toLowerCase(), "name");
  assert.strictEqual(parsed.steps[0].value, "Sanketh");

  assert.strictEqual(parsed.steps[1].action, "FILL");
  assert.strictEqual(parsed.steps[1].fieldHint.toLowerCase(), "email");
  assert.strictEqual(parsed.steps[1].value, "abc@gmail.com");

  assert.strictEqual(parsed.steps[2].action, "FILL");
  assert.strictEqual(parsed.steps[2].fieldHint.toLowerCase(), "phone");
  assert.strictEqual(parsed.steps[2].value, "1234");

  console.log("[PASS] TEST 5: Separate form fields parsed cleanly without composer collision\n");
}

// ------------------------------------------------------------
// TEST 6: "Search for ISRO."
// ------------------------------------------------------------
console.log("--- TEST 6: 'Search for ISRO.' ---");
{
  const task = "Search for ISRO.";
  const parsed = taskParser.parseTask(task);

  assert.strictEqual(parsed.steps.length, 2);
  assert.strictEqual(parsed.steps[0].action, "FILL");
  assert.strictEqual(parsed.steps[0].target, "PRIMARY_SEARCH_INPUT");
  assert.strictEqual(parsed.steps[0].value, "ISRO");

  assert.strictEqual(parsed.steps[1].action, "SUBMIT");
  assert.strictEqual(parsed.steps[1].targetHint, "search");

  console.log("[PASS] TEST 6: Primary search parsed cleanly into FILL + SUBMIT\n");
}

// ------------------------------------------------------------
// TEST 7: "Click Send."
// ------------------------------------------------------------
console.log("--- TEST 7: 'Click Send.' ---");
{
  const task = "Click Send.";
  const parsed = taskParser.parseTask(task);

  assert.strictEqual(parsed.steps.length, 1);
  assert.strictEqual(parsed.steps[0].action, "CLICK");
  assert.strictEqual(parsed.steps[0].target, "Send");

  const plan = reasoningPlanner.planTask(parsed);
  assert.strictEqual(plan.steps[0].risk, "HIGH");
  assert.strictEqual(plan.steps[0].requiresApproval, true);

  console.log("[PASS] TEST 7: CLICK Send requires approval under high risk safety gate\n");
}

// ------------------------------------------------------------
// TEST 8: "open compose and type hello"
// ------------------------------------------------------------
console.log("--- TEST 8: 'open compose and type hello' ---");
{
  const task = "open compose and type hello";
  const parsed = taskParser.parseTask(task);

  assert.strictEqual(parsed.steps.length, 2);
  assert.strictEqual(parsed.steps[0].action, "CLICK");
  assert.ok(/compose/i.test(parsed.steps[0].target));
  assert.strictEqual(parsed.steps[1].action, "FILL");
  assert.strictEqual(parsed.steps[1].target, "active compose textbox");
  assert.strictEqual(parsed.steps[1].value, "hello");

  console.log("[PASS] TEST 8: 'open compose and type hello' -> CLICK compose, FILL active compose textbox = 'hello'\n");
}

// ------------------------------------------------------------
// TEST 9: "send a message saying hello"
// ------------------------------------------------------------
console.log("--- TEST 9: 'send a message saying hello' ---");
{
  const task = "send a message saying hello";
  const parsed = taskParser.parseTask(task);

  assert.strictEqual(parsed.steps.length, 2);
  assert.strictEqual(parsed.steps[0].action, "FILL");
  assert.strictEqual(parsed.steps[0].target, "active message composer");
  assert.strictEqual(parsed.steps[0].value, "hello");

  assert.strictEqual(parsed.steps[1].action, "CLICK");
  assert.strictEqual(parsed.steps[1].target, "Send");

  console.log("[PASS] TEST 9: 'send a message saying hello' -> FILL active message composer = 'hello', CLICK Send\n");
}

// ------------------------------------------------------------
// TEST 10: "write this in the comments box: Great post"
// ------------------------------------------------------------
console.log("--- TEST 10: 'write this in the comments box: Great post' ---");
{
  const task = "write this in the comments box: Great post";
  const parsed = taskParser.parseTask(task);

  assert.strictEqual(parsed.steps.length, 1);
  assert.strictEqual(parsed.steps[0].action, "FILL");
  assert.strictEqual(parsed.steps[0].fieldHint, "comments");
  assert.strictEqual(parsed.steps[0].value, "Great post");

  console.log("[PASS] TEST 10: Container colon fill parsed cleanly\n");
}

// ------------------------------------------------------------
// TEST 11: DOM GROUNDING & PLACEHOLDER SEMANTIC MATCHING
// Simulates LinkedIn Message Composer DOM elements
// ------------------------------------------------------------
console.log("--- TEST 11: LinkedIn Message Composer DOM Grounding ---");
{
  // Extract isFieldMatch and scoreElementForField from popup.js
  const popupCode = fs.readFileSync(path.join(__dirname, "popup.js"), "utf8");

  // Extract isFieldMatch and scoreElementForField from popup.js
  const matchFnMatch = popupCode.match(/const isFieldMatch = ([\s\S]+?)(?=\n  \/\*\*|\n  const scoreElementForField)/);
  const scoreFnMatch = popupCode.match(/const scoreElementForField = ([\s\S]+?)(?=\n  \/\*\*|\n  const createSemanticTargetDescriptor)/);

  assert.ok(matchFnMatch, "isFieldMatch must be present in popup.js");
  assert.ok(scoreFnMatch, "scoreElementForField must be present in popup.js");

  const isFieldMatch = eval(matchFnMatch[0].replace("const isFieldMatch = ", ""));
  global.isFieldMatch = isFieldMatch;
  global.activeComposer = {
    type: "message",
    state: "open",
    sourceAction: "Message"
  };
  global.currentStepPlan = {
    type: "FILL",
    target: "active message composer",
    fieldHint: "message",
    composerType: "message",
    context: "message_composer"
  };
  global.scoreSearchCandidate = () => 0;
  global.isAiAssistantElement = () => false;

  const scoreElementForField = eval(scoreFnMatch[0].replace("const scoreElementForField = ", ""));

  // 1. Semantic placeholder matching
  assert.strictEqual(isFieldMatch("Write a message...", "message"), true, "'Write a message...' must match 'message'");
  assert.strictEqual(isFieldMatch("Write a message...", "active message composer"), true, "'Write a message...' must match 'active message composer'");
  assert.strictEqual(isFieldMatch("Write a message", "message"), true, "'Write a message' must match 'message'");
  assert.strictEqual(isFieldMatch("Write a reply...", "reply"), true, "'Write a reply...' must match 'reply'");
  assert.strictEqual(isFieldMatch("Write a reply...", "active reply composer"), true, "'Write a reply...' must match 'active reply composer'");

  // 2. LinkedIn message composer candidates
  const linkedInMessageBody = {
    tag: "div",
    type: "contenteditable",
    role: "textbox",
    label: "",
    ariaLabel: "Write a message...",
    placeholder: "Write a message...",
    nearbyText: "Write a message...",
    contextText: "New message dialog"
  };

  const linkedInRecipient = {
    tag: "input",
    type: "input",
    role: "combobox",
    label: "Type a name or multiple names",
    ariaLabel: "Type a name or multiple names",
    placeholder: "Type a name or multiple names"
  };

  const linkedInSubject = {
    tag: "input",
    type: "input",
    label: "Subject (optional)",
    ariaLabel: "Subject (optional)",
    placeholder: "Subject (optional)"
  };

  const linkedInSearch = {
    tag: "input",
    type: "searchbox",
    role: "searchbox",
    label: "Search messages",
    placeholder: "Search messages",
    semanticTag: "SEARCH_INPUT"
  };

  const scoreBody = scoreElementForField(linkedInMessageBody, "message");
  const scoreRecipient = scoreElementForField(linkedInRecipient, "message");
  const scoreSubject = scoreElementForField(linkedInSubject, "message");
  const scoreSearch = scoreElementForField(linkedInSearch, "message");

  assert.strictEqual(scoreBody, 1.0, `Message body editor must score 1.0, got ${scoreBody}`);
  assert.strictEqual(scoreRecipient, 0, `Recipient input must score 0, got ${scoreRecipient}`);
  assert.strictEqual(scoreSubject, 0, `Subject input must score 0, got ${scoreSubject}`);
  assert.strictEqual(scoreSearch, 0, `Search input must score 0, got ${scoreSearch}`);

  console.log(`[PASS] LinkedIn DOM candidate scoring:
   - Message body editor ('Write a message...'): Score = ${scoreBody} (Accepted)
   - Recipient input ('Type a name...'): Score = ${scoreRecipient} (Rejected)
   - Subject input ('Subject (optional)'): Score = ${scoreSubject} (Rejected)
   - Search input ('Search messages'): Score = ${scoreSearch} (Rejected)\n`);
}

console.log("============================================================");
console.log("ALL 11 ACTIVE COMPOSER GROUNDING REGRESSION TESTS PASSED!");
console.log("============================================================");
