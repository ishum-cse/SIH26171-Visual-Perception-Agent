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
  assert.strictEqual(res.steps.length, 4, "NAVIGATE YouTube, FILL search, SUBMIT search, CLICK result");

  assert.strictEqual(res.steps[0].type, "NAVIGATE");
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
  assert.strictEqual(t6.intent, "NAVIGATE");
  assert.strictEqual(t6.steps[0].type, "NAVIGATE");
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

// ---------------------------------------------------------------------
// TEST 9: Action-Aware Clause Segmentation & Connector Disambiguation (Regression Suite)
// ---------------------------------------------------------------------
{
  // 1. "Open YouTube and search for DSA in Java." -> 2 actions (NAVIGATE YouTube, SEARCH DSA in Java)
  {
    const r = SIHTaskParser.parseTask("Open YouTube and search for DSA in Java.");
    assert.strictEqual(r.intent, "MULTI_STEP");
    assert.strictEqual(r.goals.length, 2, "Must recognize 2 high-level actions (NAVIGATE + SEARCH)");
    assert.strictEqual(r.goals[0].type, "NAVIGATE");
    assert.strictEqual(r.goals[1].type, "SEARCH");
    assert.strictEqual(r.steps[0].type, "NAVIGATE");
    assert.strictEqual(r.steps[0].targetHint, "YouTube", "Target must be YouTube, NOT 'YouTube and'");
    assert.strictEqual(r.steps[1].type, "FILL");
    assert.strictEqual(r.steps[1].fieldHint, "search");
    assert.strictEqual(r.steps[1].value, "DSA in Java");
    assert.strictEqual(r.steps[2].type, "SUBMIT");
    assert.strictEqual(r.steps[2].query, "DSA in Java");
    console.log("  [PASS] 9.1 'Open YouTube and search for DSA in Java.' -> NAVIGATE YouTube + SEARCH DSA in Java");
  }

  // 2. "Open Amazon and search for wireless headphones." -> 2 actions (NAVIGATE Amazon, SEARCH wireless headphones)
  {
    const r = SIHTaskParser.parseTask("Open Amazon and search for wireless headphones.");
    assert.strictEqual(r.intent, "MULTI_STEP");
    assert.strictEqual(r.goals.length, 2, "Must recognize 2 actions (NAVIGATE + SEARCH)");
    assert.strictEqual(r.goals[0].type, "NAVIGATE");
    assert.strictEqual(r.goals[1].type, "SEARCH");
    assert.strictEqual(r.steps[0].type, "NAVIGATE");
    assert.strictEqual(r.steps[0].targetHint, "Amazon", "Target must be Amazon, NOT 'Amazon and'");
    assert.strictEqual(r.steps[1].type, "FILL");
    assert.strictEqual(r.steps[1].value, "wireless headphones");
    console.log("  [PASS] 9.2 'Open Amazon and search for wireless headphones.' -> NAVIGATE Amazon + SEARCH wireless headphones");
  }

  // 3. "Find Electronics and select Headphones." -> 2 actions
  {
    const r = SIHTaskParser.parseTask("Find Electronics and select Headphones.");
    assert.strictEqual(r.intent, "MULTI_STEP");
    assert.strictEqual(r.goals.length, 2, "Must recognize 2 actions (FIND + SELECT)");
    assert.strictEqual(r.steps[0].type, "CLICK");
    assert.strictEqual(r.steps[0].targetHint, "Electronics", "Target must be Electronics, NOT 'Electronics and'");
    assert.strictEqual(r.steps[1].type, "SELECT");
    assert.strictEqual(r.steps[1].targetHint, "Headphones");
    assert.strictEqual(r.steps[1].context, "Electronics");
    console.log("  [PASS] 9.3 'Find Electronics and select Headphones.' -> 2 actions, clean target 'Electronics'");
  }

  // 4. "Search for YouTube and open the most relevant result." -> 2 actions
  {
    const r = SIHTaskParser.parseTask("Search for YouTube and open the most relevant result.");
    assert.strictEqual(r.intent, "MULTI_STEP");
    assert.strictEqual(r.goals.length, 2, "Must recognize 2 actions (SEARCH + OPEN_RESULT)");
    assert.strictEqual(r.steps[0].type, "FILL");
    assert.strictEqual(r.steps[0].value, "YouTube");
    assert.strictEqual(r.steps[1].type, "SUBMIT");
    assert.strictEqual(r.steps[2].type, "CLICK");
    assert.strictEqual(r.steps[2].isProductSelection, true);
    assert.strictEqual(r.steps[2].isMostRelevant, true);
    console.log("  [PASS] 9.4 'Search for YouTube and open the most relevant result.' -> 2 actions (SEARCH + OPEN_RESULT)");
  }

  // 5. "Find the filters section, check 4 Stars & Up, then select Black." -> 3 actions
  {
    const r = SIHTaskParser.parseTask("Find the filters section, check 4 Stars & Up, then select Black.");
    assert.strictEqual(r.intent, "MULTI_STEP");
    assert.strictEqual(r.goals.length, 3, "Must recognize 3 actions (FIND + CHECK + SELECT)");
    assert.strictEqual(r.steps[0].type, "CLICK");
    assert.strictEqual(r.steps[0].targetHint, "filters section");
    assert.strictEqual(r.steps[1].type, "CHECK");
    assert.strictEqual(r.steps[1].targetHint, "4 Stars & Up");
    assert.strictEqual(r.steps[1].context, "filters");
    assert.strictEqual(r.steps[2].type, "SELECT");
    assert.strictEqual(r.steps[2].targetHint, "Black");
    assert.strictEqual(r.steps[2].context, "filters");
    console.log("  [PASS] 9.5 'Find the filters section, check 4 Stars & Up, then select Black.' -> 3 actions with hierarchical context");
  }

  // 6. "Search for rock and roll music." -> 1 action
  {
    const r = SIHTaskParser.parseTask("Search for rock and roll music.");
    assert.strictEqual(r.intent, "MULTI_STEP");
    assert.strictEqual(r.goals.length, 1, "Must remain exactly 1 SEARCH action");
    assert.strictEqual(r.steps[0].type, "FILL");
    assert.strictEqual(r.steps[0].value, "rock and roll music", "'and' inside search query must NOT be split");
    console.log("  [PASS] 9.6 'Search for rock and roll music.' -> 1 action, 'rock and roll music' preserved intact");
  }

  // 7. "Fill the company field with Research and Development." -> 1 action
  {
    const r = SIHTaskParser.parseTask("Fill the company field with Research and Development.");
    assert.strictEqual(r.intent, "FILL");
    assert.strictEqual(r.goals.length, 1, "Must remain exactly 1 FILL action");
    assert.strictEqual(r.steps[0].fieldHint, "company");
    assert.strictEqual(r.steps[0].value, "Research and Development", "'and' inside value must NOT be split");
    console.log("  [PASS] 9.7 'Fill the company field with Research and Development.' -> 1 action, value preserved intact");
  }

  // 8. "Open Google and search for data structures and algorithms." -> 2 actions with internal 'and' preserved
  {
    const r = SIHTaskParser.parseTask("Open Google and search for data structures and algorithms.");
    assert.strictEqual(r.intent, "MULTI_STEP");
    assert.strictEqual(r.goals.length, 2, "Must recognize 2 actions (NAVIGATE + SEARCH)");
    assert.strictEqual(r.goals[0].type, "NAVIGATE");
    assert.strictEqual(r.goals[1].type, "SEARCH");
    assert.strictEqual(r.steps[0].type, "NAVIGATE");
    assert.strictEqual(r.steps[0].targetHint, "Google", "Target must be Google, NOT 'Google and'");
    assert.strictEqual(r.steps[1].type, "FILL");
    assert.strictEqual(r.steps[1].value, "data structures and algorithms", "Query must preserve 'data structures and algorithms'");
    assert.strictEqual(r.steps[2].type, "SUBMIT");
    assert.strictEqual(r.steps[2].query, "data structures and algorithms");
    console.log("  [PASS] 9.8 'Open Google and search for data structures and algorithms.' -> NAVIGATE Google + SEARCH");
  }

  // 9. Normal single-step task must remain unchanged
  {
    const r = SIHTaskParser.parseTask("Click the submit button");
    assert.strictEqual(r.intent, "CLICK");
    assert.strictEqual(r.goals.length, 1);
    assert.strictEqual(r.steps.length, 1);
    assert.strictEqual(r.steps[0].type, "CLICK");
    assert.strictEqual(r.steps[0].targetHint, "submit");
    assert.strictEqual(r.steps[0].legacyTarget, "SUBMIT_BUTTON");
    console.log("  [PASS] 9.9 Normal single-step task unchanged");
  }

  // 10. Existing natural-language form filling must remain unchanged
  {
    const r = SIHTaskParser.parseTask("Fill this form with my name Sanketh, email sankii@gmail.com, phone 4656 and address Mysore.");
    assert.strictEqual(r.intent, "MULTI_STEP");
    assert.strictEqual(r.steps.length, 4);
    assert.strictEqual(r.localValues["name"], "Sanketh");
    assert.strictEqual(r.localValues["email"], "sankii@gmail.com");
    assert.strictEqual(r.localValues["phone"], "4656");
    assert.strictEqual(r.localValues["address"], "Mysore");
    console.log("  [PASS] 9.10 Existing natural-language form filling unchanged");
  }

  // Bonus 11: Multi-field unvalued credentials pattern: "Find the login form and enter my email and password."
  {
    const r = SIHTaskParser.parseTask("Find the login form and enter my email and password.");
    assert.strictEqual(r.intent, "MULTI_STEP");
    assert.strictEqual(r.goals.length, 3, "CLICK login form + FILL email + FILL password");
    assert.strictEqual(r.steps[0].targetHint, "login form", "Target must be 'login form', NOT 'login form and'");
    assert.strictEqual(r.steps[1].fieldHint, "email");
    assert.strictEqual(r.steps[2].fieldHint, "password");
    console.log("  [PASS] 9.11 'Find the login form and enter my email and password.' -> 3 steps parsed cleanly");
  }

  // 12. "Go to Wikipedia and search for binary trees." -> NAVIGATE Wikipedia + SEARCH binary trees
  {
    const r = SIHTaskParser.parseTask("Go to Wikipedia and search for binary trees.");
    assert.strictEqual(r.intent, "MULTI_STEP");
    assert.strictEqual(r.goals.length, 2, "NAVIGATE + SEARCH");
    assert.strictEqual(r.goals[0].type, "NAVIGATE");
    assert.strictEqual(r.steps[0].type, "NAVIGATE");
    assert.strictEqual(r.steps[0].targetHint, "Wikipedia");
    assert.strictEqual(r.steps[1].type, "FILL");
    assert.strictEqual(r.steps[1].value, "binary trees");
    assert.strictEqual(r.steps[2].type, "SUBMIT");
    console.log("  [PASS] 9.12 'Go to Wikipedia and search for binary trees.' -> NAVIGATE Wikipedia + SEARCH binary trees");
  }

  // 13. "Navigate to GitHub and search for Node.js." -> NAVIGATE GitHub + SEARCH Node.js
  {
    const r = SIHTaskParser.parseTask("Navigate to GitHub and search for Node.js.");
    assert.strictEqual(r.intent, "MULTI_STEP");
    assert.strictEqual(r.goals.length, 2);
    assert.strictEqual(r.steps[0].type, "NAVIGATE");
    assert.strictEqual(r.steps[0].targetHint, "GitHub");
    assert.strictEqual(r.steps[1].type, "FILL");
    assert.strictEqual(r.steps[1].value, "Node.js");
    console.log("  [PASS] 9.13 'Navigate to GitHub and search for Node.js.' -> NAVIGATE GitHub + SEARCH Node.js");
  }

  // 14. "Open Gmail." -> single-step NAVIGATE action
  {
    const r = SIHTaskParser.parseTask("Open Gmail.");
    assert.strictEqual(r.intent, "NAVIGATE");
    assert.strictEqual(r.steps[0].type, "NAVIGATE");
    assert.strictEqual(r.steps[0].targetHint, "Gmail");
    console.log("  [PASS] 9.14 'Open Gmail.' -> single-step NAVIGATE Gmail");
  }

  // 15. "Open Gmail, compose an email to test@example.com, set the subject to SIH Final Test, and write Hello in the message."
  {
    const r = SIHTaskParser.parseTask("Open Gmail, compose an email to test@example.com, set the subject to SIH Final Test, and write Hello in the message.");
    assert.strictEqual(r.intent, "MULTI_STEP");
    assert.strictEqual(r.steps.length, 5);
    assert.strictEqual(r.steps[0].type, "NAVIGATE");
    assert.strictEqual(r.steps[0].targetHint, "Gmail");
    assert.strictEqual(r.steps[1].type, "CLICK");
    assert.strictEqual(r.steps[1].targetHint, "compose");
    assert.strictEqual(r.steps[2].type, "FILL");
    assert.strictEqual(r.steps[2].fieldHint, "recipient");
    assert.strictEqual(r.steps[2].value, "test@example.com");
    assert.strictEqual(r.steps[3].type, "FILL");
    assert.strictEqual(r.steps[3].fieldHint, "subject");
    assert.strictEqual(r.steps[3].value, "SIH Final Test");
    assert.strictEqual(r.steps[4].type, "FILL");
    assert.strictEqual(r.steps[4].fieldHint, "message");
    assert.strictEqual(r.steps[4].value, "Hello");
    assert.strictEqual(r.localValues["recipient"], "test@example.com");
    assert.strictEqual(r.localValues["subject"], "SIH Final Test");
    assert.strictEqual(r.localValues["message"], "Hello");
    console.log("  [PASS] 9.15 'Open Gmail, compose email to X...' -> NAVIGATE + CLICK compose + 3 FILL steps with values");
  }

  // 16. "Find the settings section, enable dark mode, and save the changes."
  {
    const r = SIHTaskParser.parseTask("Find the settings section, enable dark mode, and save the changes.");
    assert.strictEqual(r.intent, "MULTI_STEP");
    assert.strictEqual(r.steps.length, 3);
    assert.strictEqual(r.steps[0].type, "CLICK");
    assert.strictEqual(r.steps[0].targetHint, "settings section");
    assert.strictEqual(r.steps[1].type, "CHECK");
    assert.strictEqual(r.steps[1].targetHint, "dark mode");
    assert.strictEqual(r.steps[2].type, "CLICK");
    assert.strictEqual(r.steps[2].targetHint, "save changes");
    console.log("  [PASS] 9.16 'Find settings, enable dark mode, save changes' -> CLICK + CHECK + CLICK save");
  }

  // 17. "Find the latest PDF and download it."
  {
    const r = SIHTaskParser.parseTask("Find the latest PDF and download it.");
    assert.strictEqual(r.steps[0].type, "CLICK");
    assert.strictEqual(r.steps[0].targetHint, "latest PDF");
    console.log("  [PASS] 9.17 'Find the latest PDF and download it.' -> CLICK latest PDF");
  }

  // 18. "Fill this form with my details and submit it."
  {
    const r = SIHTaskParser.parseTask("Fill this form with my details and submit it.");
    assert.strictEqual(r.intent, "MULTI_STEP");
    assert.strictEqual(r.steps.length, 2);
    assert.strictEqual(r.steps[0].type, "FILL_FORM");
    assert.strictEqual(r.steps[1].type, "CLICK");
    assert.strictEqual(r.steps[1].targetHint, "submit");
    console.log("  [PASS] 9.18 'Fill this form with my details and submit it.' -> FILL_FORM + CLICK submit");
  }

  // 19. "Find the dark mode option and turn it on."
  {
    const r = SIHTaskParser.parseTask("Find the dark mode option and turn it on.");
    assert.strictEqual(r.steps[0].type, "CHECK");
    assert.strictEqual(r.steps[0].targetHint, "dark mode");
    console.log("  [PASS] 9.19 'Find the dark mode option and turn it on.' -> CHECK dark mode");
  }

  console.log("[PASS] 9. All Action-Aware Clause Segmentation & Navigation regression tests PASSED");
}

// ---------------------------------------------------------------------
// TEST 10: Natural Human Approval Instructions Separation (Cases A - F)
// ---------------------------------------------------------------------
console.log("\n--- TEST 10: Natural Human Approval Instructions Separation (Cases A - F) ---");

// CASE A: Reply to this email with “Thank you sir!” and ask me before sending.
{
  const task = "Reply to this email with “Thank you sir!” and ask me before sending.";
  const res = SIHTaskParser.parseTask(task);

  assert.strictEqual(res.intent, "MULTI_STEP");
  assert.strictEqual(res.steps[0].type, "CLICK");
  assert.strictEqual(res.steps[0].targetHint, "Reply");

  assert.strictEqual(res.steps[1].type, "FILL");
  assert.strictEqual(res.steps[1].fieldHint, "Reply message body");
  assert.strictEqual(res.steps[1].value, "Thank you sir!");

  assert.strictEqual(res.steps[2].type, "CLICK");
  assert.strictEqual(res.steps[2].targetHint, "Send");
  assert.strictEqual(res.steps[2].requiresApproval, true);
  assert.strictEqual(res.steps[2].risk, "HIGH");
  assert.strictEqual(res.steps[2].riskLevel, "HIGH");

  assert.strictEqual(res.requireApprovalBeforeSend, true);
  assert.strictEqual(res.constraints.includes("REQUIRE_APPROVAL_BEFORE_SEND"), true);
  assert.strictEqual(res.steps[1].value.includes("ask me before sending"), false);
  assert.strictEqual(res.steps[1].value.includes("before sending"), false);
  assert.strictEqual(res.steps[1].value.includes("approval"), false);
  assert.strictEqual(res.steps[1].value.includes("confirmation"), false);
  console.log("  [PASS] 10.A 'Reply to this email with “Thank you sir!” and ask me before sending.' -> value='Thank you sir!', requireApprovalBeforeSend=true");
}

// CASE B: Reply to this email with "Thank you sir!" and wait for my approval before sending.
{
  const task = 'Reply to this email with "Thank you sir!" and wait for my approval before sending.';
  const res = SIHTaskParser.parseTask(task);

  assert.strictEqual(res.steps[1].value, "Thank you sir!");
  assert.strictEqual(res.requireApprovalBeforeSend, true);
  assert.strictEqual(res.steps[2].requiresApproval, true);
  assert.strictEqual(res.steps[1].value.includes("before sending"), false);
  assert.strictEqual(res.steps[1].value.includes("approval"), false);
  console.log("  [PASS] 10.B 'Reply to this email with \"Thank you sir!\" and wait for my approval before sending.' -> value='Thank you sir!', requireApprovalBeforeSend=true");
}

// CASE C: Reply to this email saying "Thank you sir!" and don't send it.
{
  const task = 'Reply to this email saying "Thank you sir!" and don\'t send it.';
  const res = SIHTaskParser.parseTask(task);

  assert.strictEqual(res.steps[1].value, "Thank you sir!");
  assert.strictEqual(res.doNotSend, true);
  assert.strictEqual(res.steps.length, 2, "Must not have Send step");
  assert.strictEqual(res.steps.some(s => s.targetHint === "Send"), false);
  console.log("  [PASS] 10.C 'Reply to this email saying \"Thank you sir!\" and don\'t send it.' -> value='Thank you sir!', doNotSend=true, no Send step");
}

// CASE D: Reply to this email with "Thank you sir!"
{
  const task = 'Reply to this email with "Thank you sir!"';
  const res = SIHTaskParser.parseTask(task);

  assert.strictEqual(res.steps[1].value, "Thank you sir!");
  assert.strictEqual(res.requireApprovalBeforeSend, false);
  assert.strictEqual(res.steps.length, 2, "Must not have Send step");
  console.log("  [PASS] 10.D 'Reply to this email with \"Thank you sir!\"' -> value='Thank you sir!', requireApprovalBeforeSend=false");
}

// CASE E: Reply to this email with ‘Thank you sir!’ and ask me before sending.
{
  const task = "Reply to this email with ‘Thank you sir!’ and ask me before sending.";
  const res = SIHTaskParser.parseTask(task);

  assert.strictEqual(res.steps[1].value, "Thank you sir!");
  assert.strictEqual(res.requireApprovalBeforeSend, true);
  assert.strictEqual(res.steps[2].requiresApproval, true);
  assert.strictEqual(res.steps[1].value.includes("before sending"), false);
  console.log("  [PASS] 10.E 'Reply to this email with ‘Thank you sir!’ and ask me before sending.' -> value='Thank you sir!', requireApprovalBeforeSend=true");
}

// CASE F: Reply to this email with "Thank you sir!" and ask me before sending, then verify the reply.
{
  const task = 'Reply to this email with "Thank you sir!" and ask me before sending, then verify the reply.';
  const res = SIHTaskParser.parseTask(task);

  assert.strictEqual(res.steps[1].value, "Thank you sir!");
  assert.strictEqual(res.requireApprovalBeforeSend, true);
  assert.strictEqual(res.steps[2].requiresApproval, true);
  assert.strictEqual(res.steps[1].value.includes("verify"), false);
  assert.strictEqual(res.steps[1].value.includes("reply"), false);
  assert.strictEqual(res.steps[1].value.includes("before sending"), false);
  console.log("  [PASS] 10.F 'Reply to this email with \"Thank you sir!\" and ask me before sending, then verify the reply.' -> value='Thank you sir!', approval requirement preserved, no verification text in value");
}

console.log("\n============================================================");
console.log("ALL NATURAL-LANGUAGE PARSER TESTS PASSED (10 / 10)");
console.log("============================================================");

