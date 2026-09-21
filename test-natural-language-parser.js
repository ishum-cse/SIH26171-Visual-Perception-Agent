/**
 * test-natural-language-parser.js
 * Comprehensive unit and integration tests for Natural-Language Task Parsing.
 * Verifies generic, conversational task phrasing while enforcing backward compatibility
 * and the strict privacy boundary.
 */

const assert = require("assert");
const SIHTaskParser = require("./task-parser.js");

console.log("============================================================");
console.log("RUNNING NATURAL-LANGUAGE TASK PARSER TEST SUITE");
console.log("============================================================\n");

// ---------------------------------------------------------------------
// TEST 1: Multi-field form filling (Minimum Test 1)
// "Fill this form with my name Sanketh, email sankii@gmail.com, phone 4656 and address Mysore."
// ---------------------------------------------------------------------
{
  const task = "Fill this form with my name Sanketh, email sankii@gmail.com, phone 4656 and address Mysore.";
  const res = SIHTaskParser.parseTask(task);

  assert.strictEqual(res.intent, "MULTI_STEP", "Intent must be MULTI_STEP");
  assert.strictEqual(res.isMultiStep, true, "isMultiStep must be true");
  assert.strictEqual(res.steps.length, 4, "Must have exactly 4 fill steps");

  assert.strictEqual(res.steps[0].type, "FILL");
  assert.strictEqual(res.steps[0].fieldHint, "name");
  assert.strictEqual(res.steps[0].value, "Sanketh");

  assert.strictEqual(res.steps[1].type, "FILL");
  assert.strictEqual(res.steps[1].fieldHint, "email");
  assert.strictEqual(res.steps[1].value, "sankii@gmail.com");

  assert.strictEqual(res.steps[2].type, "FILL");
  assert.strictEqual(res.steps[2].fieldHint, "phone");
  assert.strictEqual(res.steps[2].value, "4656");

  assert.strictEqual(res.steps[3].type, "FILL");
  assert.strictEqual(res.steps[3].fieldHint, "address");
  assert.strictEqual(res.steps[3].value, "Mysore");

  // Privacy verification: literal values must NOT exist in sanitizedPlan
  res.sanitizedPlan.forEach(p => {
    assert.strictEqual(p.value, undefined, "Sanitized plan must never contain literal values");
  });

  // Local values verification
  assert.strictEqual(res.localValues["name"], "Sanketh");
  assert.strictEqual(res.localValues["email"], "sankii@gmail.com");
  assert.strictEqual(res.localValues["phone"], "4656");
  assert.strictEqual(res.localValues["address"], "Mysore");

  console.log("[PASS] 1. Multi-field natural form filling parsed correctly with privacy preserved");
}

// ---------------------------------------------------------------------
// TEST 2: Search and open pronoun resolution (Minimum Test 2)
// "Search YouTube and open it."
// ---------------------------------------------------------------------
{
  const task = "Search YouTube and open it.";
  const res = SIHTaskParser.parseTask(task);

  assert.strictEqual(res.intent, "MULTI_STEP");
  assert.strictEqual(res.steps.length, 3, "FILL search, SUBMIT search, CLICK result");

  assert.strictEqual(res.steps[0].type, "FILL");
  assert.strictEqual(res.steps[0].fieldHint, "search");
  assert.strictEqual(res.steps[0].value, "YouTube");

  assert.strictEqual(res.steps[1].type, "SUBMIT");
  assert.strictEqual(res.steps[1].targetHint, "search");

  assert.strictEqual(res.steps[2].type, "CLICK");
  assert.strictEqual(res.steps[2].isProductSelection, true);
  assert.strictEqual(res.steps[2].isMostRelevant, true);
  assert.strictEqual(res.steps[2].targetHint, "most relevant result");

  console.log("[PASS] 2. 'Search YouTube and open it' resolved pronoun to search result selection");
}

// ---------------------------------------------------------------------
// TEST 3: Navigation, search, and result selection (Minimum Test 3)
// "Go to YouTube, search for DSA in Java and open the most relevant result."
// ---------------------------------------------------------------------
{
  const task = "Go to YouTube, search for DSA in Java and open the most relevant result.";
  const res = SIHTaskParser.parseTask(task);

  assert.strictEqual(res.intent, "MULTI_STEP");
  assert.strictEqual(res.steps.length, 4, "CLICK YouTube, FILL search, SUBMIT search, CLICK result");

  assert.strictEqual(res.steps[0].type, "CLICK");
  assert.strictEqual(res.steps[0].targetHint, "YouTube");

  assert.strictEqual(res.steps[1].type, "FILL");
  assert.strictEqual(res.steps[1].fieldHint, "search");
  assert.strictEqual(res.steps[1].value, "DSA in Java");

  assert.strictEqual(res.steps[2].type, "SUBMIT");

  assert.strictEqual(res.steps[3].type, "CLICK");
  assert.strictEqual(res.steps[3].isProductSelection, true);
  assert.strictEqual(res.steps[3].targetHint, "most relevant result");

  console.log("[PASS] 3. 'Go to YouTube, search for DSA in Java and open the most relevant result' verified");
}

// ---------------------------------------------------------------------
// TEST 4: Open container, tick checkbox, choose option (Minimum Test 4)
// "Open the filters, tick 4 stars and above, then choose black."
// ---------------------------------------------------------------------
{
  const task = "Open the filters, tick 4 stars and above, then choose black.";
  const res = SIHTaskParser.parseTask(task);

  assert.strictEqual(res.intent, "MULTI_STEP");
  assert.strictEqual(res.steps.length, 3);

  // Step 1: CLICK filters
  assert.strictEqual(res.steps[0].type, "CLICK");
  assert.strictEqual(res.steps[0].targetHint, "filters");

  // Step 2: CHECK 4 stars and above in filters
  assert.strictEqual(res.steps[1].type, "CHECK");
  assert.strictEqual(res.steps[1].targetHint, "4 stars and above");
  assert.strictEqual(res.steps[1].context, "filters");

  // Step 3: SELECT black in filters
  assert.strictEqual(res.steps[2].type, "SELECT");
  assert.strictEqual(res.steps[2].targetHint, "black");
  assert.strictEqual(res.steps[2].context, "filters");

  console.log("[PASS] 4. 'Open the filters, tick 4 stars and above, then choose black' verified with context");
}

// ---------------------------------------------------------------------
// TEST 5: Navigation and ordinal choice (Minimum Test 5)
// "Go to Electronics and choose the first headphones option."
// ---------------------------------------------------------------------
{
  const task = "Go to Electronics and choose the first headphones option.";
  const res = SIHTaskParser.parseTask(task);

  assert.strictEqual(res.intent, "MULTI_STEP");
  assert.strictEqual(res.steps.length, 2);

  assert.strictEqual(res.steps[0].type, "CLICK");
  assert.strictEqual(res.steps[0].targetHint, "Electronics");

  assert.strictEqual(res.steps[1].type, "SELECT");
  assert.ok((res.steps[1].targetHint || "").includes("headphones"));
  assert.strictEqual(res.steps[1].context, "Electronics");
  assert.strictEqual(res.steps[1].ordinal, 1);
  assert.strictEqual(res.steps[1].targetType, "option");

  console.log("[PASS] 5. 'Go to Electronics and choose the first headphones option' verified with ordinal 1");
}

// ---------------------------------------------------------------------
// TEST 6: All existing explicit M23 commands (Minimum Test 6)
// ---------------------------------------------------------------------
{
  // M23 Command A
  const tA = "Find the search box, search for YouTube, and open the most relevant result.";
  const resA = SIHTaskParser.parseTask(tA);
  assert.strictEqual(resA.intent, "MULTI_STEP");
  assert.strictEqual(resA.steps.length, 4);
  assert.strictEqual(resA.steps[0].targetHint, "search box");
  assert.strictEqual(resA.steps[1].value, "YouTube");
  assert.strictEqual(resA.steps[2].type, "SUBMIT");
  assert.strictEqual(resA.steps[3].targetHint, "most relevant result");

  // M23 Command B
  const tB = "Find the Electronics section, then select the Headphones option inside it.";
  const resB = SIHTaskParser.parseTask(tB);
  assert.strictEqual(resB.intent, "MULTI_STEP");
  assert.strictEqual(resB.steps.length, 2);
  assert.strictEqual(resB.steps[0].targetHint, "Electronics section");
  assert.strictEqual(resB.steps[1].type, "SELECT");
  assert.strictEqual(resB.steps[1].targetHint, "Headphones");
  assert.strictEqual(resB.steps[1].context, "Electronics");

  // M23 Command C
  const tC = "Find the filters section, check the 4 Stars & Up checkbox, then select Black.";
  const resC = SIHTaskParser.parseTask(tC);
  assert.strictEqual(resC.intent, "MULTI_STEP");
  assert.strictEqual(resC.steps.length, 3);
  assert.strictEqual(resC.steps[0].targetHint, "filters section");
  assert.strictEqual(resC.steps[1].type, "CHECK");
  assert.strictEqual(resC.steps[1].targetHint, "4 Stars & Up");
  assert.strictEqual(resC.steps[1].context, "filters");
  assert.strictEqual(resC.steps[2].type, "SELECT");
  assert.strictEqual(resC.steps[2].targetHint, "Black");
  assert.strictEqual(resC.steps[2].context, "filters");

  console.log("[PASS] 6. All existing explicit M23 commands work identically to baseline");
}

// ---------------------------------------------------------------------
// TEST 7: Conversational expressions & field patterns
// ---------------------------------------------------------------------
{
  // Single field with conversational pronoun
  const t1 = SIHTaskParser.parseTask("my name is Sanketh");
  assert.strictEqual(t1.intent, "FILL");
  assert.strictEqual(t1.steps[0].fieldHint, "name");
  assert.strictEqual(t1.steps[0].value, "Sanketh");

  const t2 = SIHTaskParser.parseTask("email is sankii@gmail.com");
  assert.strictEqual(t2.intent, "FILL");
  assert.strictEqual(t2.steps[0].fieldHint, "email");
  assert.strictEqual(t2.steps[0].value, "sankii@gmail.com");

  const t3 = SIHTaskParser.parseTask("put Sanketh as my name");
  assert.strictEqual(t3.intent, "FILL");
  assert.strictEqual(t3.steps[0].fieldHint, "name");
  assert.strictEqual(t3.steps[0].value, "Sanketh");

  // Whole form with conversational pronoun
  const t4 = SIHTaskParser.parseTask("fill my details");
  assert.strictEqual(t4.intent, "FILL_FORM");
  assert.strictEqual(t4.steps[0].simultaneous, true);

  // Search intent
  const t5 = SIHTaskParser.parseTask("search for YouTube");
  assert.strictEqual(t5.intent, "MULTI_STEP");
  assert.strictEqual(t5.steps[0].type, "FILL");
  assert.strictEqual(t5.steps[0].value, "YouTube");
  assert.strictEqual(t5.steps[1].type, "SUBMIT");

  // Navigation intent
  const t6 = SIHTaskParser.parseTask("go to YouTube");
  assert.strictEqual(t6.intent, "CLICK");
  assert.strictEqual(t6.steps[0].targetHint, "YouTube");

  // tick / untick actions
  const t7 = SIHTaskParser.parseTask("tick this option");
  assert.strictEqual(t7.intent, "CHECK");

  const t8 = SIHTaskParser.parseTask("untick the newsletter checkbox");
  assert.strictEqual(t8.intent, "UNCHECK");
  assert.strictEqual(t8.steps[0].targetHint, "newsletter");

  // select
  const t9 = SIHTaskParser.parseTask("select black");
  assert.strictEqual(t9.intent, "SELECT");
  assert.strictEqual(t9.steps[0].targetHint, "black");

  // Multi-field with commas and 'is'
  const t10 = SIHTaskParser.parseTask("my name is Sanketh, email is sankii@gmail.com, phone is 4656 and address is Mysore");
  assert.strictEqual(t10.intent, "MULTI_STEP");
  assert.strictEqual(t10.steps.length, 4);
  assert.strictEqual(t10.steps[0].fieldHint, "name");
  assert.strictEqual(t10.steps[1].fieldHint, "email");
  assert.strictEqual(t10.steps[2].fieldHint, "phone");
  assert.strictEqual(t10.steps[3].fieldHint, "address");

  console.log("[PASS] 7. Conversational expressions and field patterns verified");
}

// ---------------------------------------------------------------------
// TEST 8: Safety & Ambiguity Protection
// ---------------------------------------------------------------------
{
  // Standalone unresolvable pronoun must fail-closed to NONE
  const t1 = SIHTaskParser.parseTask("open it");
  assert.strictEqual(t1.intent, "NONE", "Standalone 'open it' must fail-closed without prior context");

  const t2 = SIHTaskParser.parseTask("click that");
  assert.strictEqual(t2.intent, "NONE", "Standalone 'click that' must fail-closed");

  const t3 = SIHTaskParser.parseTask("press the button");
  assert.strictEqual(t3.intent, "NONE", "Ambiguous 'press the button' must fail-closed");

  console.log("[PASS] 8. Safety & ambiguity protection verified (fail-closed)");
}

console.log("\n============================================================");
console.log("ALL NATURAL-LANGUAGE PARSER TESTS PASSED (8 / 8)");
console.log("============================================================");
