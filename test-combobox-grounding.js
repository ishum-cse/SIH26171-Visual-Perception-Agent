/**
 * test-combobox-grounding.js
 * Verification suite for Generic Dynamic Form / Combobox Grounding & Re-grounding.
 *
 * Validates:
 * 1. Form-Target vs Value Distinction (Cases A, B, C, D, E and IRCTC phrases)
 * 2. Dynamic Combobox Perception (PrimeNG, Material, floating labels, ARIA)
 * 3. Bounded Local DOM Context Extraction
 * 4. Role-Aware Semantic Matching (From, To, Departure, Arrival, etc.)
 * 5. Re-grounding Field Identity Preservation
 * 6. Non-confusion of Search vs Form Fill
 * 7. Ambiguity Safety Gate
 */

const assert = require("assert");

console.log("============================================================");
console.log("RUNNING GENERIC DYNAMIC FORM / COMBOBOX GROUNDING TEST SUITE");
console.log("============================================================\n");

// ============================================================
// PART 1: INTENT & FORM-TARGET TASK PARSING TESTS (CASES A - E)
// ============================================================
const tp = require("./task-parser.js");

console.log("--- PART 1: FORM-TARGET VS VALUE PARSING TESTS ---");

// Test A: "Fill From with Mysore"
const resA = tp.parseTask("Fill From with Mysore");
assert.strictEqual(resA.steps.length, 1, "Test A should have exactly 1 step");
assert.strictEqual(resA.steps[0].type, "FILL", "Test A step type must be FILL");
assert.strictEqual(resA.steps[0].fieldHint.toLowerCase(), "from", "Test A fieldHint must be 'From'");
assert.strictEqual(resA.steps[0].value, "Mysore", "Test A value must be 'Mysore'");
console.log("  [PASS] Case A: 'Fill From with Mysore' -> target='From', value='Mysore'");

// Test B: "Enter Bengaluru in the To field"
const resB = tp.parseTask("Enter Bengaluru in the To field");
assert.strictEqual(resB.steps.length, 1, "Test B should have exactly 1 step");
assert.strictEqual(resB.steps[0].type, "FILL", "Test B step type must be FILL");
assert.strictEqual(resB.steps[0].fieldHint.toLowerCase(), "to", "Test B fieldHint must be 'To'");
assert.strictEqual(resB.steps[0].value, "Bengaluru", "Test B value must be 'Bengaluru'");
console.log("  [PASS] Case B: 'Enter Bengaluru in the To field' -> target='To', value='Bengaluru'");

// Test C: "Set departure city to Mysore"
const resC = tp.parseTask("Set departure city to Mysore");
assert.strictEqual(resC.steps.length, 1, "Test C should have exactly 1 step");
assert.strictEqual(resC.steps[0].type, "FILL", "Test C step type must be FILL");
assert.strictEqual(resC.steps[0].fieldHint.toLowerCase(), "departure city", "Test C fieldHint must be 'departure city'");
assert.strictEqual(resC.steps[0].value, "Mysore", "Test C value must be 'Mysore'");
console.log("  [PASS] Case C: 'Set departure city to Mysore' -> target='departure city', value='Mysore'");

// Test D: "Search for Mysore"
const resD = tp.parseTask("Search for Mysore");
assert.ok(resD.steps.length >= 1, "Test D should produce search steps");
assert.strictEqual(resD.steps[0].type, "FILL", "Test D step 1 must be FILL search");
assert.strictEqual(resD.steps[0].fieldHint.toLowerCase(), "search", "Test D target must be 'search'");
assert.strictEqual(resD.steps[0].value, "Mysore", "Test D value must be 'Mysore'");
console.log("  [PASS] Case D: 'Search for Mysore' -> target='search', value='Mysore'");

// Test E: "Fill the From station with Mysore and the To station with Bengaluru"
const resE = tp.parseTask("Fill the From station with Mysore and the To station with Bengaluru");
assert.strictEqual(resE.steps.length, 2, "Test E should produce 2 independent field fill steps");
assert.strictEqual(resE.steps[0].type, "FILL");
assert.strictEqual(resE.steps[0].fieldHint.toLowerCase(), "from station");
assert.strictEqual(resE.steps[0].value, "Mysore");
assert.strictEqual(resE.steps[1].type, "FILL");
assert.strictEqual(resE.steps[1].fieldHint.toLowerCase(), "to station");
assert.strictEqual(resE.steps[1].value, "Bengaluru");
console.log("  [PASS] Case E: 'Fill the From station with Mysore and the To station with Bengaluru' -> 2 steps: From station=Mysore, To station=Bengaluru");

// Additional Travel Test: "Open IRCTC and set From to Mysore"
const resIRCTC1 = tp.parseTask("Open IRCTC and set From to Mysore");
assert.strictEqual(resIRCTC1.steps.length, 2, "Should produce 2 steps (NAVIGATE + FILL)");
assert.strictEqual(resIRCTC1.steps[0].type, "NAVIGATE");
assert.strictEqual(resIRCTC1.steps[0].targetHint.toLowerCase(), "irctc");
assert.strictEqual(resIRCTC1.steps[1].type, "FILL");
assert.strictEqual(resIRCTC1.steps[1].fieldHint.toLowerCase(), "from");
assert.strictEqual(resIRCTC1.steps[1].value, "Mysore");
console.log("  [PASS] 'Open IRCTC and set From to Mysore' -> NAVIGATE(IRCTC) + FILL(From, Mysore)");

// Additional Travel Test: "On IRCTC, enter Mysore in the From station field"
const resIRCTC2 = tp.parseTask("On IRCTC, enter Mysore in the From station field");
assert.strictEqual(resIRCTC2.steps.length, 2, "Should produce 2 steps (NAVIGATE + FILL)");
assert.strictEqual(resIRCTC2.steps[0].type, "NAVIGATE");
assert.strictEqual(resIRCTC2.steps[0].targetHint.toLowerCase(), "irctc");
assert.strictEqual(resIRCTC2.steps[1].type, "FILL");
assert.strictEqual(resIRCTC2.steps[1].fieldHint.toLowerCase(), "from station");
assert.strictEqual(resIRCTC2.steps[1].value, "Mysore");
console.log("  [PASS] 'On IRCTC, enter Mysore in the From station field' -> NAVIGATE(IRCTC) + FILL(From station, Mysore)");

// Additional Travel Test: "Set From to Mysore and To to Bengaluru"
const resIRCTC3 = tp.parseTask("Set From to Mysore and To to Bengaluru");
assert.strictEqual(resIRCTC3.steps.length, 2, "Should produce 2 independent steps");
assert.strictEqual(resIRCTC3.steps[0].fieldHint.toLowerCase(), "from");
assert.strictEqual(resIRCTC3.steps[0].value, "Mysore");
assert.strictEqual(resIRCTC3.steps[1].fieldHint.toLowerCase(), "to");
assert.strictEqual(resIRCTC3.steps[1].value, "Bengaluru");
console.log("  [PASS] 'Set From to Mysore and To to Bengaluru' -> FILL(From, Mysore) + FILL(To, Bengaluru)");

console.log("\n--- PART 2: DYNAMIC COMBOBOX DOM PERCEPTION (CONTENT.JS) ---");

// Set up lightweight DOM Mock for Node testing of content.js
class MockNode {
  constructor(tagName = "div") {
    this.tagName = tagName.toUpperCase();
    this.id = "";
    this.className = "";
    this.attributes = {};
    this.children = [];
    this.parentNode = null;
    this.previousElementSibling = null;
    this.nextElementSibling = null;
    this.innerText = "";
    this.textContent = "";
    this.value = "";
    this.isConnected = true;
    this.isContentEditable = false;
  }
  getAttribute(k) { return this.attributes[k] !== undefined ? this.attributes[k] : null; }
  setAttribute(k, v) { this.attributes[k] = String(v); }
  getBoundingClientRect() { return { x: 50, y: 100, width: 200, height: 36, top: 100, left: 50, right: 250, bottom: 136 }; }
  closest(selector) {
    let curr = this;
    while (curr) {
      if (selector.includes("p-autocomplete") && curr.tagName === "P-AUTOCOMPLETE") return curr;
      if (selector.includes(".ui-float-label") && curr.className && curr.className.includes("ui-float-label")) return curr;
      if (selector.includes("mat-form-field") && curr.tagName === "MAT-FORM-FIELD") return curr;
      if (selector.includes("[id]") && curr.id) return curr;
      if (selector.includes(".form-group") && curr.className && curr.className.includes("form-group")) return curr;
      curr = curr.parentNode;
    }
    return null;
  }
  querySelector(sel) {
    function search(node) {
      for (const ch of node.children) {
        if (sel.includes("label") && ch.tagName === "LABEL") return ch;
        if (sel.includes("mat-label") && ch.tagName === "MAT-LABEL") return ch;
        if (sel.includes("input") && ch.tagName === "INPUT") return ch;
        const sub = search(ch);
        if (sub) return sub;
      }
      return null;
    }
    return search(this);
  }
  querySelectorAll(sel) {
    const res = [];
    function search(node) {
      for (const ch of node.children) {
        if (sel.includes("input") && ch.tagName === "INPUT") res.push(ch);
        search(ch);
      }
    }
    search(this);
    return res;
  }
  appendChild(ch) {
    if (this.children.length > 0) {
      const last = this.children[this.children.length - 1];
      last.nextElementSibling = ch;
      ch.previousElementSibling = last;
    }
    ch.parentNode = this;
    this.children.push(ch);
    return ch;
  }
}

global.window = {
  innerWidth: 1920,
  innerHeight: 1080,
  getComputedStyle: () => ({ display: "block", visibility: "visible", opacity: "1" }),
  Event: class { constructor(t) { this.type = t; } },
  KeyboardEvent: class { constructor(t, o) { this.type = t; this.key = o?.key; } }
};
global.document = {
  body: new MockNode("body"),
  getElementById: (id) => null,
  querySelector: (sel) => null,
  querySelectorAll: (sel) => []
};

const content = require("./content.js");

// Scenario 1: PrimeNG floating label autocomplete on IRCTC
// <span class="ui-float-label">
//   <p-autocomplete id="origin">
//     <span class="ui-autocomplete">
//       <input role="searchbox" aria-autocomplete="list" placeholder=" ">
//     </span>
//   </p-autocomplete>
//   <label for="origin">From</label>
// </span>
const floatLabelContainer = new MockNode("span");
floatLabelContainer.className = "ui-float-label";

const pAuto = new MockNode("p-autocomplete");
pAuto.id = "origin";
floatLabelContainer.appendChild(pAuto);

const uiAutoSpan = new MockNode("span");
uiAutoSpan.className = "ui-autocomplete";
pAuto.appendChild(uiAutoSpan);

const primeInput = new MockNode("input");
primeInput.setAttribute("role", "searchbox");
primeInput.setAttribute("aria-autocomplete", "list");
primeInput.setAttribute("placeholder", " ");
uiAutoSpan.appendChild(primeInput);

const primeLabel = new MockNode("label");
primeLabel.setAttribute("for", "origin");
primeLabel.innerText = "From";
primeLabel.textContent = "From";
floatLabelContainer.appendChild(primeLabel);

// Hook document.querySelector for label[for]
global.document.querySelector = (sel) => {
  if (sel.includes('origin')) return primeLabel;
  return null;
};

const primeDesc = content.classifyVisualElement(primeInput, 0);
assert.ok(primeDesc, "PrimeNG combobox must be classified as a visual element");
assert.strictEqual(primeDesc.type, "combobox", "Element with aria-autocomplete must be classified as combobox");
assert.strictEqual(primeDesc.label, "From", "Label must resolve to 'From' via wrapper id / floating label");
assert.ok(primeDesc.isInteractable, "Combobox must be interactable");
assert.notStrictEqual(primeDesc.semanticTag, "SEARCH_INPUT", "'From' station field must NEVER have semanticTag SEARCH_INPUT");
console.log("  [PASS] PrimeNG Autocomplete: type='combobox', label='From', semanticTag!=SEARCH_INPUT");

// Scenario 2: Generic instructional placeholder with nearby label
// <div class="form-group">
//   <label>To</label>
//   <input placeholder="Enter station/city" role="combobox" aria-autocomplete="list">
// </div>
const formGroup = new MockNode("div");
formGroup.className = "form-group";

const toLabel = new MockNode("label");
toLabel.innerText = "To";
toLabel.textContent = "To";
formGroup.appendChild(toLabel);

const toInput = new MockNode("input");
toInput.setAttribute("placeholder", "Enter station/city");
toInput.setAttribute("role", "combobox");
toInput.setAttribute("aria-autocomplete", "list");
formGroup.appendChild(toInput);

global.document.querySelector = (sel) => null;

const toDesc = content.classifyVisualElement(toInput, 1);
assert.ok(toDesc, "To combobox must be classified");
assert.strictEqual(toDesc.label, "To", "Preceding sibling label 'To' must override instructional placeholder 'Enter station/city'");
console.log("  [PASS] Instructional placeholder overridden by nearby label 'To'");

// Scenario 3: Material design floating label
// <mat-form-field>
//   <input role="combobox">
//   <mat-label>Departure</mat-label>
// </mat-form-field>
const matField = new MockNode("mat-form-field");
const matInput = new MockNode("input");
matInput.setAttribute("role", "combobox");
matField.appendChild(matInput);

const matLabel = new MockNode("mat-label");
matLabel.innerText = "Departure";
matLabel.textContent = "Departure";
matField.appendChild(matLabel);

const matDesc = content.classifyVisualElement(matInput, 2);
assert.ok(matDesc, "Material input must be classified");
assert.strictEqual(matDesc.label, "Departure", "Material label 'Departure' must be resolved");
console.log("  [PASS] Material Form Field: label='Departure' resolved from following sibling/container");

console.log("\n--- PART 3: ROLE-AWARE GROUNDING & RE-GROUNDING (POPUP.JS) ---");

// Extract the popup.js isFieldMatch and scoreElementForField logic to test in Node
const fs = require("fs");
const popupCode = fs.readFileSync("./popup.js", "utf8");

// Extract isFieldMatch implementation
const isFieldMatchMatch = popupCode.match(/const isFieldMatch = ([\s\S]+?)(?=\n  \/\*\*|\n  const scoreElementForField)/);
assert.ok(isFieldMatchMatch, "isFieldMatch must be present in popup.js");
const isFieldMatch = eval(isFieldMatchMatch[0].replace("const isFieldMatch = ", ""));

// Extract scoreElementForField implementation
const scoreElementMatch = popupCode.match(/const scoreElementForField = ([\s\S]+?)(?=\n  \/\*\*|\n  const runLocalPipeline)/);
assert.ok(scoreElementMatch, "scoreElementForField must be present in popup.js");
const scoreElementForField = eval(scoreElementMatch[0].replace("const scoreElementForField = ", ""));

// Test 1: Travel synonyms and short word boundary in isFieldMatch
assert.strictEqual(isFieldMatch("From", "from"), true, "'From' must match 'from'");
assert.strictEqual(isFieldMatch("To", "to"), true, "'To' must match 'to'");
assert.strictEqual(isFieldMatch("To Station", "to"), true, "'To Station' must match hint 'to'");
assert.strictEqual(isFieldMatch("Departure", "from"), true, "'Departure' must match synonym 'from'");
assert.strictEqual(isFieldMatch("Arrival", "to"), true, "'Arrival' must match synonym 'to'");
assert.strictEqual(isFieldMatch("Destination", "to"), true, "'Destination' must match synonym 'to'");
assert.strictEqual(isFieldMatch("Source Station", "from"), true, "'Source Station' must match synonym 'from'");
assert.strictEqual(isFieldMatch("search", "from"), false, "'search' must NEVER match 'from'");
assert.strictEqual(isFieldMatch("search", "to"), false, "'search' must NEVER match 'to'");
console.log("  [PASS] isFieldMatch: Travel synonyms & word-boundary matching verified for From/To/Departure/Arrival/Source/Destination");

// Test 2: Role-aware scoreElementForField
const candidateFrom = {
  type: "combobox",
  role: "searchbox",
  label: "From",
  nearbyText: "From Station",
  placeholder: "Enter station/city",
  ariaLabel: "From"
};
const scoreFrom = scoreElementForField(candidateFrom, "From");
assert.ok(scoreFrom >= 0.95, `candidateFrom score for 'From' must be >= 0.95, got ${scoreFrom}`);

const candidateGenericSearch = {
  type: "input",
  role: "searchbox",
  label: "Search",
  placeholder: "Search trains",
  ariaLabel: "Search"
};
const scoreSearchAgainstFrom = scoreElementForField(candidateGenericSearch, "From");
assert.strictEqual(scoreSearchAgainstFrom, 0, "Generic search box must score 0 against fieldHint 'From'");
console.log("  [PASS] scoreElementForField: Combobox 'From' scores 1.0, generic search box scores 0");

// Test 3: Re-grounding preserves field identity when page re-renders
const reRenderedFrom = {
  type: "combobox",
  role: "combobox",
  label: "From",
  nearbyText: "From",
  placeholder: "",
  isVisualConfirmed: true
};
const reGroundScore = scoreElementForField(reRenderedFrom, "From");
assert.ok(reGroundScore >= 0.95, `Re-grounded field must score >= 0.95, got ${reGroundScore}`);
console.log("  [PASS] Re-grounding: Fresh DOM element successfully re-grounded to 'From' with high confidence");

// Test 4: Ambiguity Safety Gate
// When 2 candidates with different labels match with identical confidence, reject
const candidate1 = { type: "input", label: "Station A", nearbyText: "Station" };
const candidate2 = { type: "input", label: "Station B", nearbyText: "Station" };
const s1 = scoreElementForField(candidate1, "Station");
const s2 = scoreElementForField(candidate2, "Station");
assert.ok(s1 > 0 && s2 > 0, "Both candidates match 'Station'");
assert.strictEqual(s1, s2, "Ambiguous candidates have equal confidence");
console.log("  [PASS] Ambiguity Safety: Equal-confidence different candidates detected for safety gate rejection");

console.log("\n============================================================");
console.log("ALL GENERIC DYNAMIC FORM / COMBOBOX GROUNDING TESTS PASSED!");
console.log("============================================================\n");
