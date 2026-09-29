const assert = require('assert');
const SIHTaskParser = require('../task-parser.js');
const SIHReasoningPlanner = require('../reasoning-planner.js');

console.log("================================================================================");
console.log("IRIS FINAL NATURAL-LANGUAGE INTENT & TASK NORMALIZATION TEST SUITE");
console.log("================================================================================\n");

let passed = 0;
let failed = 0;

function runTest(testNum, input, assertionsFn) {
  try {
    console.log(`[TEST ${testNum}] Input: "${input}"`);
    const parsedTask = SIHTaskParser.parseTask(input);
    const initialPlan = SIHReasoningPlanner.planTask(parsedTask, { title: "Test Page", url: "https://example.com" });
    const normalizedPlan = SIHReasoningPlanner.normalizeTaskPlan(initialPlan, parsedTask, input);

    assertionsFn(parsedTask, initialPlan, normalizedPlan);
    console.log(`  -> PASSED\n`);
    passed++;
  } catch (err) {
    console.error(`  -> FAILED: ${err.message}\n`, err.stack);
    failed++;
  }
}

// TEST 1: "Reply with the message thank you sir and ask me before sending"
runTest(1, "Reply with the message thank you sir and ask me before sending", (parsed, plan, norm) => {
  // Expected: Reply clicked, Message Body = "thank you sir", Send NOT clicked without approval, Approval requested before Send
  assert.strictEqual(parsed.requireApprovalBeforeSend, true, "requireApprovalBeforeSend should be true");
  assert.strictEqual(parsed.approval.required, true, "approval.required should be true");
  assert.strictEqual(parsed.approval.before_action, "SEND", "approval before_action should be SEND");

  const fillStep = norm.steps.find(s => s.type === "FILL");
  assert.ok(fillStep, "Must have a FILL step");
  assert.strictEqual(fillStep.value, "thank you sir", `FILL value must be exactly 'thank you sir', got '${fillStep.value}'`);
  assert.ok(!fillStep.value.includes("ask me"), "FILL value must not contain 'ask me'");
  assert.ok(!fillStep.value.includes("the message"), "FILL value must not contain 'the message'");

  const replyClick = norm.steps.find(s => s.type === "CLICK" && (s.targetHint || s.target || "").toLowerCase().includes("reply"));
  assert.ok(replyClick, "Must have a Reply click step");

  const sendStep = norm.steps.find(s => s.type === "CLICK" && (s.targetHint || s.target || "").toLowerCase().includes("send"));
  assert.ok(sendStep, "Must have Send step with approval required");
  assert.strictEqual(sendStep.requiresApproval, true, "Send step must require approval");
});

// TEST 2: "Reply saying I will attend tomorrow and wait for my approval before sending"
runTest(2, "Reply saying I will attend tomorrow and wait for my approval before sending", (parsed, plan, norm) => {
  // Expected: Message Body = "I will attend tomorrow", Send blocked pending approval
  assert.strictEqual(parsed.requireApprovalBeforeSend, true, "requireApprovalBeforeSend should be true");
  const fillStep = norm.steps.find(s => s.type === "FILL");
  assert.ok(fillStep, "Must have a FILL step");
  assert.strictEqual(fillStep.value, "I will attend tomorrow", `FILL value must be 'I will attend tomorrow', got '${fillStep.value}'`);
  assert.ok(!fillStep.value.includes("wait for my approval"), "FILL value must not contain control clause");

  const sendStep = norm.steps.find(s => s.type === "CLICK" && (s.targetHint || s.target || "").toLowerCase().includes("send"));
  assert.ok(sendStep, "Must have Send step");
  assert.strictEqual(sendStep.requiresApproval, true, "Send step must require approval");
});

// TEST 3: "Search for ISRO and open the most relevant result"
runTest(3, "Search for ISRO and open the most relevant result", (parsed, plan, norm) => {
  // Expected: Search box = "ISRO", Search submitted, Relevant result opened
  const fillStep = norm.steps.find(s => s.type === "FILL");
  assert.ok(fillStep, "Must have a FILL step for search");
  assert.strictEqual(fillStep.value, "ISRO", `Search query must be 'ISRO', got '${fillStep.value}'`);
  assert.ok(!fillStep.value.includes("open"), "Search query must not contain 'open'");

  const submitStep = norm.steps.find(s => s.type === "SUBMIT");
  assert.ok(submitStep, "Must have a SUBMIT step");

  const openStep = norm.steps.find(s => s.type === "CLICK" && s !== fillStep);
  assert.ok(openStep, "Must have a result click step");
  assert.ok(
    (openStep.targetHint || openStep.target || "").toLowerCase().includes("isro") ||
    (openStep.targetHint || openStep.target || "").toLowerCase().includes("result"),
    "Open step target should reference ISRO or result"
  );
});

// TEST 4: "Search for ISRO. Open the most relevant result. If a language-selection page appears, click English."
runTest(4, "Search for ISRO. Open the most relevant result. If a language-selection page appears, click English.", (parsed, plan, norm) => {
  // Expected: Search = "ISRO", Relevant result opened, English clicked only when required
  const fillStep = norm.steps.find(s => s.type === "FILL");
  assert.ok(fillStep, "Must have a FILL step for search");
  assert.strictEqual(fillStep.value, "ISRO", `Search query must be 'ISRO', got '${fillStep.value}'`);

  const condStep = norm.steps.find(s => (s.targetHint || s.target || "").toLowerCase().includes("english"));
  assert.ok(condStep, "Must have conditional English click step");
  assert.ok(condStep.conditional || condStep.condition, "English step must have condition");
});

// TEST 5: "Fill the form: Name = Sankit, mail id = ABC@gmail.com, Phone number = 1234, address = Mysore, comments = Super, company = Infosys, job title = developer"
runTest(5, "Fill the form: Name = Sankit, mail id = ABC@gmail.com, Phone number = 1234, address = Mysore, comments = Super, company = Infosys, job title = developer", (parsed, plan, norm) => {
  // Expected: Each field receives only its own value
  assert.ok(parsed.intent === "MULTI_STEP" || parsed.intent === "FILL_FORM", `Intent should be MULTI_STEP or FILL_FORM, got ${parsed.intent}`);
  assert.strictEqual(parsed.localValues["Name"], "Sankit");
  assert.strictEqual(parsed.localValues["mail id"], "ABC@gmail.com");
  assert.strictEqual(parsed.localValues["Phone number"], "1234");
  assert.strictEqual(parsed.localValues["address"], "Mysore");
  assert.strictEqual(parsed.localValues["comments"], "Super");
  assert.strictEqual(parsed.localValues["company"], "Infosys");
  assert.strictEqual(parsed.localValues["job title"], "developer");

  const fillSteps = norm.steps.filter(s => s.type === "FILL");
  assert.strictEqual(fillSteps.length, 7, `Expected 7 fill steps, got ${fillSteps.length}`);
});

// TEST 6: "Open Amazon. Search for iPhone 17 white colour. Open the first product and click Add to Cart."
runTest(6, "Open Amazon. Search for iPhone 17 white colour. Open the first product and click Add to Cart.", (parsed, plan, norm) => {
  // Expected: Amazon opened, Search field = "iPhone 17 white colour", First product opened, Add to Cart clicked
  const navStep = norm.steps.find(s => s.type === "NAVIGATE");
  assert.ok(navStep, "Must have a NAVIGATE step to Amazon");
  assert.ok(navStep.url.includes("amazon"), "NAVIGATE url should point to Amazon");

  const fillStep = norm.steps.find(s => s.type === "FILL");
  assert.ok(fillStep, "Must have a FILL step for product search");
  assert.strictEqual(fillStep.value, "iPhone 17 white colour", `Search value must be 'iPhone 17 white colour', got '${fillStep.value}'`);

  const cartClick = norm.steps.find(s => (s.targetHint || s.target || "").toLowerCase().includes("cart"));
  assert.ok(cartClick, "Must have Add to Cart click step");
});

// TEST 7: "Reply with 'Thank you sir!' and don't send it."
runTest(7, "Reply with 'Thank you sir!' and don't send it.", (parsed, plan, norm) => {
  // Expected: Message Body = "Thank you sir!", Send is not executed
  assert.strictEqual(parsed.doNotSend, true, "doNotSend must be true");
  const fillStep = norm.steps.find(s => s.type === "FILL");
  assert.ok(fillStep, "Must have a FILL step");
  assert.strictEqual(fillStep.value, "Thank you sir!", `Value must be 'Thank you sir!', got '${fillStep.value}'`);

  // Either Send is not in steps or marked doNotExecute
  const sendStep = norm.steps.find(s => (s.targetHint || s.target || "").toLowerCase().includes("send"));
  assert.ok(!sendStep || sendStep.doNotExecute, "Send step must either be absent or marked doNotExecute");
});

// TEST 8: "Submit the form, but ask me before submitting."
runTest(8, "Submit the form, but ask me before submitting.", (parsed, plan, norm) => {
  // Expected: Submit action identified, Safety gate pauses before Submit, User approval required,
  // The phrase "ask me before submitting" NEVER appears inside a form field.
  assert.strictEqual(parsed.requireApprovalBeforeSubmit, true, "requireApprovalBeforeSubmit must be true");
  assert.strictEqual(parsed.approval.required, true, "approval.required must be true");

  const anyFill = norm.steps.some(s => s.type === "FILL" && (s.value || "").includes("ask me before submitting"));
  assert.strictEqual(anyFill, false, "Phrase 'ask me before submitting' must NEVER appear inside a form field");

  const submitStep = norm.steps.find(s => (s.targetHint || s.target || "").toLowerCase().includes("submit") || s.type === "SUBMIT");
  assert.ok(submitStep, "Must have Submit step");
  assert.strictEqual(submitStep.requiresApproval, true, "Submit step must require approval");
});

// BONUS TEST 9: Section 7 prompt multi-step mission search
runTest(9, "Search for ISRO, open the most relevant result, click English if the language page appears, then search for GSLV-F17/EOS-05 mission and open the relevant mission result.", (parsed, plan, norm) => {
  const isroFill = norm.steps.find(s => s.type === "FILL" && s.value === "ISRO");
  assert.ok(isroFill, "Must have FILL step for 'ISRO'");

  const gslvFill = norm.steps.find(s => s.type === "FILL" && s.value.includes("GSLV-F17/EOS-05"));
  assert.ok(gslvFill, "Must have second FILL step for 'GSLV-F17/EOS-05 mission'");

  const englishClick = norm.steps.find(s => (s.targetHint || s.target || "").toLowerCase().includes("english"));
  assert.ok(englishClick, "Must have English click step");
  assert.ok(englishClick.condition || englishClick.conditional, "English click must be conditional");
});

console.log(`\nRESULTS: ${passed} passed, ${failed} failed out of ${passed + failed} tests.`);
if (failed > 0) {
  process.exit(1);
}
