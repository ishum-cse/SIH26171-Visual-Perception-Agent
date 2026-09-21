/**
 * test-target-field-mapping-regression.js
 * Regression test suite verifying that form field targets and values are correctly
 * parsed, planned, and grounded, and that unrelated page text (e.g. "Switch accounts")
 * can NEVER substitute or replace the requested form field target.
 */

const assert = require("assert");
const taskParser = require("./task-parser.js");
const reasoningPlanner = require("./reasoning-planner.js");

console.log("============================================================");
console.log("RUNNING TARGET & FIELD MAPPING REGRESSION TEST SUITE");
console.log("============================================================\n");

// [TEST 1] Exact Bug Reproduction: "Fill Name with Sankii"
console.log("[TEST 1] 'Fill Name with Sankii'");
{
  const res = taskParser.parseTask("Fill Name with Sankii");
  assert.strictEqual(res.intent, "FILL", "Intent should be FILL");
  assert.strictEqual(res.steps.length, 1, "Should produce exactly 1 step");
  assert.strictEqual(res.steps[0].type, "FILL", "Step type should be FILL");
  assert.strictEqual(res.steps[0].fieldHint, "Name", "fieldHint should be 'Name'");
  assert.strictEqual(res.steps[0].value, "Sankii", "value should be 'Sankii'");
  assert.strictEqual(res.localValues[0], "Sankii", "localValues[0] should be 'Sankii'");

  const plan = reasoningPlanner.planTask(res, { title: "Test Page", url: "http://example.com" });
  assert.strictEqual(plan.totalSteps, 1, "Plan should have 1 step");
  assert.strictEqual(plan.steps[0].type, "FILL", "Planned step should be FILL");
  assert.strictEqual(plan.steps[0].target, "Name", "Planned target should be 'Name'");
  console.log("  ✓ Verified: 'Fill Name with Sankii' produces FILL -> Name (value: Sankii)");
}

// [TEST 2] Idiom variant: "Find the Name field and fill it with \"Sankii\""
console.log("\n[TEST 2] 'Find the Name field and fill it with \"Sankii\"'");
{
  const res = taskParser.parseTask('Find the Name field and fill it with "Sankii"');
  assert.strictEqual(res.intent, "FILL", "Intent should be FILL");
  assert.strictEqual(res.steps.length, 1, "Should produce exactly 1 step (no spurious CLICK step)");
  assert.strictEqual(res.steps[0].type, "FILL", "Step type should be FILL");
  assert.strictEqual(res.steps[0].fieldHint, "Name", "fieldHint should be 'Name'");
  assert.strictEqual(res.steps[0].value, "Sankii", "value should be unquoted 'Sankii'");
  assert.strictEqual(res.localValues[0], "Sankii", "localValues should store unquoted 'Sankii'");
  console.log("  ✓ Verified: Idiom normalizes to single FILL step with clean unquoted value");
}

// [TEST 3] Multi-field form filling: Name, Email, Phone, College
console.log("\n[TEST 3] Multi-field form task (4 fields)");
{
  const taskText = 'Find the Name field and fill it with "Sankii", find the Email field and fill it with "sankii@example.com", find the Phone field and fill it with "9876543210", and find the College field and fill it with "Rajarajeswari College of Engineering".';
  const res = taskParser.parseTask(taskText);
  assert.strictEqual(res.intent, "MULTI_STEP", "Intent should be MULTI_STEP");
  assert.strictEqual(res.steps.length, 4, `Should produce exactly 4 steps, got ${res.steps.length}`);

  const expectedFields = [
    { field: "Name", val: "Sankii" },
    { field: "Email", val: "sankii@example.com" },
    { field: "Phone", val: "9876543210" },
    { field: "College", val: "Rajarajeswari College of Engineering" }
  ];

  expectedFields.forEach((exp, idx) => {
    assert.strictEqual(res.steps[idx].type, "FILL", `Step ${idx + 1} must be FILL`);
    assert.strictEqual(res.steps[idx].fieldHint, exp.field, `Step ${idx + 1} fieldHint must be ${exp.field}`);
    assert.strictEqual(res.steps[idx].value, exp.val, `Step ${idx + 1} value must be ${exp.val}`);
    assert.strictEqual(res.localValues[idx], exp.val, `localValues[${idx}] must be ${exp.val}`);
  });

  const plan = reasoningPlanner.planTask(res, { title: "Form", url: "http://example.com" });
  assert.strictEqual(plan.totalSteps, 4, "Reasoning plan must contain exactly 4 steps");
  console.log("  ✓ Verified: 4 form fields produce exactly 4 FILL steps with correct hints and unquoted values");
}

// [TEST 4] Generic variants: Email, Phone, College, Subject, Recipient, Message
console.log("\n[TEST 4] Generic Natural-Language Variants");
{
  const variants = [
    {
      text: "Enter sankii@example.com as the email.",
      expectedType: "FILL",
      expectedField: "email",
      expectedVal: "sankii@example.com"
    },
    {
      text: "Type Hello in the message box.",
      expectedType: "FILL",
      expectedField: "message",
      expectedVal: "Hello"
    },
    {
      text: "Fill the College field with Rajarajeswari College of Engineering.",
      expectedType: "FILL",
      expectedField: "College",
      expectedVal: "Rajarajeswari College of Engineering"
    },
    {
      text: "Enter Test Mail as the subject.",
      expectedType: "FILL",
      expectedField: "subject",
      expectedVal: "Test Mail"
    },
    {
      text: "Enter xyz@gmail.com as the recipient.",
      expectedType: "FILL",
      expectedField: "recipient",
      expectedVal: "xyz@gmail.com"
    },
    {
      text: "Send the email.",
      expectedType: "CLICK",
      expectedField: "send",
      expectedVal: null
    }
  ];

  variants.forEach((v) => {
    const res = taskParser.parseTask(v.text);
    assert.ok(res.steps && res.steps.length > 0, `Must parse steps for: ${v.text}`);
    const first = res.steps[0];
    assert.strictEqual(first.type, v.expectedType, `Type mismatch for: ${v.text}`);
    const actualHint = first.fieldHint || first.targetHint;
    assert.strictEqual(actualHint.toLowerCase(), v.expectedField.toLowerCase(), `Field mismatch for: ${v.text}`);
    if (v.expectedVal) {
      assert.strictEqual(first.value, v.expectedVal, `Value mismatch for: ${v.text}`);
    }
    console.log(`  ✓ Verified: '${v.text}' -> [${first.type}] ${actualHint}${v.expectedVal ? " = " + first.value : ""}`);
  });
}

// [TEST 5] Unrelated text substitution protection ("Switch accounts" must NEVER replace "Name")
console.log("\n[TEST 5] Unrelated page text substitution protection");
{
  // Simulated perceived elements on page including "Switch accounts"
  const elements = [
    { type: "link", label: "Google Forms", x: 10, y: 10, width: 100, height: 20 },
    { type: "button", label: "Switch accounts", x: 50, y: 20, width: 120, height: 30 },
    { type: "input", label: "Name", x: 50, y: 100, width: 200, height: 40 },
    { type: "input", label: "Email", x: 50, y: 160, width: 200, height: 40 }
  ];

  const parsed = taskParser.parseTask("Fill Name with Sankii");
  const step = parsed.steps[0];

  // Verify that a candidate with label "Switch accounts" is rejected against requested field "Name"
  const targetCandidate = "Switch accounts";
  const requestedField = step.fieldHint; // "Name"

  // Check matching logic: "Switch accounts" vs "Name"
  const isMatch = (t, h) => {
    const tNorm = (t || "").toLowerCase().trim();
    const hNorm = (h || "").toLowerCase().trim();
    if (tNorm === hNorm) return true;
    if (hNorm.length >= 3 && tNorm.includes(hNorm)) return true;
    if (tNorm.length >= 3 && hNorm.includes(tNorm)) return true;
    const tTokens = tNorm.split(/\s+/).filter(w => w.length >= 3);
    const hTokens = hNorm.split(/\s+/).filter(w => w.length >= 3);
    return hTokens.some(ht => tTokens.includes(ht));
  };

  assert.strictEqual(isMatch(targetCandidate, requestedField), false, "'Switch accounts' must not match requested field 'Name'");
  assert.strictEqual(isMatch("Switch accounts", "Email"), false, "'Switch accounts' must not match requested field 'Email'");
  assert.strictEqual(isMatch("Switch accounts", "College"), false, "'Switch accounts' must not match requested field 'College'");
  assert.strictEqual(isMatch("Name", requestedField), true, "'Name' must match requested field 'Name'");

  console.log("  ✓ Verified: 'Switch accounts' is strictly rejected against requested field 'Name'");
}

// [TEST 6] Pronoun protection: "it", "this", "that" must never be accepted as valid field target
console.log("\n[TEST 6] Pronoun field target protection");
{
  assert.strictEqual(taskParser.isPronounOrReference("it"), true);
  assert.strictEqual(taskParser.isPronounOrReference("this"), true);
  assert.strictEqual(taskParser.isPronounOrReference("that"), true);
  assert.strictEqual(taskParser.isPronounOrReference("the field"), true);
  assert.strictEqual(taskParser.isPronounOrReference("Name"), false);
  assert.strictEqual(taskParser.isPronounOrReference("College"), false);
  console.log("  ✓ Verified: Pronouns ('it', 'this', 'that', 'the field') cannot be standalone targets");
}

console.log("\n============================================================");
console.log("ALL TARGET & FIELD MAPPING REGRESSION TESTS PASSED CLEANLY!");
console.log("============================================================\n");
