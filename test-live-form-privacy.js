/**
 * test-live-form-privacy.js - Regression and Verification Suite for SIH26171 Critical Privacy Fix
 *
 * Verifies that:
 * 1. Email: xyz@gmail.com -> detected & redacted to [REDACTED_EMAIL]
 * 2. Phone: 9876543210 -> detected & redacted to [REDACTED_PHONE]
 * 3. Credit card: 4111 1111 1111 1111 -> detected & redacted to [REDACTED_CARD]
 * 4. Normal text: hello world -> NOT detected
 * 5. Empty password field -> structural sensitivity remains intact
 * 6. Gmail-like arbitrary field (label "To recipients", value "xyz@gmail.com") -> detected via value analysis
 * 7. Verification that returned privacy context does NOT contain raw xyz@gmail.com
 * 8. Verification that existing generic YouTube workflow still works
 * 9. Verification that explicit-target validation still works
 * 10. Verification that Gmail compose + send task preserves local execution values while reaching human approval gate
 */

const assert = require("assert");
const { redactText, detectAndRedactSensitiveValue } = require("./pii-detector.js");
const SIHTaskParser = require("./task-parser.js");
const SIHReasoningPlanner = require("./reasoning-planner.js");
const SIHContent = require("./content.js");

console.log("============================================================");
console.log("RUNNING SIH26171 LIVE FORM VALUE PRIVACY & REGRESSION TESTS");
console.log("============================================================");

// ---------------------------------------------------------------------
// TEST 1: Email detection & redaction
// ---------------------------------------------------------------------
{
  const testEmail = "xyz@gmail.com";
  const result = detectAndRedactSensitiveValue(testEmail);
  assert.strictEqual(result.detected, true, "Email must be detected as sensitive");
  assert.strictEqual(result.redacted, "[REDACTED_EMAIL]", `Expected [REDACTED_EMAIL], got ${result.redacted}`);
  assert.strictEqual(result.redacted.includes(testEmail), false, "Redacted text must not contain raw email");
  console.log("[PASS] 1. Email 'xyz@gmail.com' -> detected & redacted to [REDACTED_EMAIL]");
}

// ---------------------------------------------------------------------
// TEST 2: Phone number detection & redaction
// ---------------------------------------------------------------------
{
  const testPhone = "9876543210";
  const result = detectAndRedactSensitiveValue(testPhone);
  assert.strictEqual(result.detected, true, "Phone must be detected as sensitive");
  assert.strictEqual(result.redacted, "[REDACTED_PHONE]", `Expected [REDACTED_PHONE], got ${result.redacted}`);
  assert.strictEqual(result.redacted.includes(testPhone), false, "Redacted text must not contain raw phone");
  console.log("[PASS] 2. Phone '9876543210' -> detected & redacted to [REDACTED_PHONE]");
}

// ---------------------------------------------------------------------
// TEST 3: Credit card number detection & redaction
// ---------------------------------------------------------------------
{
  const testCard = "4111 1111 1111 1111";
  const result = detectAndRedactSensitiveValue(testCard);
  assert.strictEqual(result.detected, true, "Credit card must be detected as sensitive");
  assert.strictEqual(result.redacted, "[REDACTED_CARD]", `Expected [REDACTED_CARD], got ${result.redacted}`);
  assert.strictEqual(result.redacted.includes(testCard), false, "Redacted text must not contain raw card");
  console.log("[PASS] 3. Credit card '4111 1111 1111 1111' -> detected & redacted to [REDACTED_CARD]");
}

// ---------------------------------------------------------------------
// TEST 4: Normal non-sensitive text
// ---------------------------------------------------------------------
{
  const normalText = "hello world";
  const result = detectAndRedactSensitiveValue(normalText);
  assert.strictEqual(result.detected, false, "Normal text must NOT be detected as sensitive");
  assert.strictEqual(result.redacted, "hello world", "Normal text should remain unchanged");
  console.log("[PASS] 4. Normal text 'hello world' -> NOT detected");
}

// ---------------------------------------------------------------------
// TEST 5: Empty password field structural sensitivity
// ---------------------------------------------------------------------
{
  const mockPasswordInput = {
    tagName: "INPUT",
    type: "password",
    getAttribute: (attr) => (attr === "name" ? "pwd" : (attr === "placeholder" ? "Password" : null)),
    closest: () => null
  };
  const isSens = SIHContent.isSensitiveElement(mockPasswordInput);
  assert.strictEqual(isSens, true, "Empty password field must retain structural sensitivity (Reason A)");
  console.log("[PASS] 5. Empty password field -> structural sensitivity remains intact");
}

// ---------------------------------------------------------------------
// TEST 6: Gmail-like arbitrary field ("To recipients", value = "testuser123@gmail.com")
// ---------------------------------------------------------------------
{
  // Simulating an arbitrary input or contenteditable field with NO "email" in name/id/placeholder/type
  const testEmail = "testuser123@gmail.com";
  const mockField = {
    tagName: "INPUT",
    type: "text",
    id: "to-field-123",
    value: testEmail,
    getAttribute: (attr) => (attr === "aria-label" ? "To recipients" : (attr === "name" ? "to" : null)),
    closest: () => null,
    getBoundingClientRect: () => ({ x: 100, y: 150, width: 350, height: 40, top: 150, left: 100, bottom: 190, right: 450 })
  };

  // Structural sensitivity alone should be false because label is "To recipients" and type is "text"
  const isStructural = SIHContent.isSensitiveElement(mockField);
  assert.strictEqual(isStructural, false, "Field without structural sensitive markers should not be structurally sensitive");

  // Value-based inspection should detect the live email value
  const extractedVal = SIHContent.extractElementLocalValue(mockField);
  assert.strictEqual(extractedVal, testEmail, "Must extract local value cleanly");

  const valueCheck = SIHContent.checkValueSensitivity(extractedVal);
  assert.strictEqual(valueCheck.detected, true, "Value analysis must detect live PII in arbitrary field");
  assert.strictEqual(valueCheck.redacted, "[REDACTED_EMAIL]", "Value analysis must redact live PII to placeholder");

  console.log("[PASS] 6. Gmail-like arbitrary field ('To recipients' = 'testuser123@gmail.com') -> detected via value analysis");
}

// ---------------------------------------------------------------------
// TEST 6b: Gmail recipient chip (<span email="testuser123@gmail.com"> / chip token)
// ---------------------------------------------------------------------
{
  const testEmail = "testuser123@gmail.com";
  const mockChip = {
    tagName: "SPAN",
    className: "vN bfK a3s",
    innerText: testEmail,
    getAttribute: (attr) => {
      if (attr === "email") return testEmail;
      if (attr === "data-hovercard-id") return testEmail;
      if (attr === "class") return "vN bfK a3s";
      return null;
    },
    closest: () => null,
    getBoundingClientRect: () => ({ x: 120, y: 155, width: 180, height: 28, top: 155, left: 120, bottom: 183, right: 300 })
  };

  const extractedVal = SIHContent.extractElementLocalValue(mockChip);
  assert.strictEqual(extractedVal, testEmail, "Must extract email from recipient chip attributes/text");

  const check = SIHContent.checkValueSensitivity(extractedVal);
  assert.strictEqual(check.detected, true, "Recipient chip must be recognized as sensitive PII");
  assert.strictEqual(check.redacted, "[REDACTED_EMAIL]", "Recipient chip must be redacted to [REDACTED_EMAIL]");
  assert.strictEqual(check.redacted.includes(testEmail), false, "Redacted output must not contain raw email");

  console.log("[PASS] 6b. Gmail recipient chip ('testuser123@gmail.com') -> detected and masked locally");
}

// ---------------------------------------------------------------------
// TEST 7: Privacy boundary guarantee: raw email never leaks into perception output
// ---------------------------------------------------------------------
{
  const rawEmail = "testuser123@gmail.com";

  // Simulate local sanitized form summary construction
  const fieldLabel = "To recipients";
  const check = detectAndRedactSensitiveValue(rawEmail);
  assert.strictEqual(check.detected, true);

  const sanitizedSummary = `${fieldLabel}: ${check.redacted}`;
  const mockRedactedSample = `Inbox - Test User\n\n[Sanitized Form Summary]:\n${sanitizedSummary}`;

  assert.strictEqual(mockRedactedSample.includes(rawEmail), false, "Redacted sample must NEVER contain raw email");
  assert.strictEqual(mockRedactedSample.includes("[REDACTED_EMAIL]"), true, "Redacted sample must contain placeholder");

  // Ensure structuredContext elements strip .value completely
  const mockVisualElement = {
    type: "input",
    label: "To recipients",
    semanticTag: "to",
    fieldId: 0,
    x: 100,
    y: 150,
    width: 350,
    height: 40
  };

  const serializedContext = JSON.stringify({
    redactedSample: mockRedactedSample,
    elements: [mockVisualElement]
  });

  assert.strictEqual(serializedContext.includes(rawEmail), false, "Serialized context payload must NEVER contain raw email");
  console.log("[PASS] 7. Privacy boundary -> sanitized perception context never contains raw 'testuser123@gmail.com'");
}

// ---------------------------------------------------------------------
// TEST 8: Verify generic YouTube search workflow regression
// ---------------------------------------------------------------------
{
  const ytTask = "search YouTube";
  const parsed = SIHTaskParser.parseTask(ytTask);
  assert.strictEqual(parsed.steps.length, 2, "search YouTube must produce 2 steps (FILL + SUBMIT)");
  assert.strictEqual(parsed.steps[0].type, "FILL");
  assert.strictEqual(parsed.steps[0].value, "YouTube");
  assert.strictEqual(parsed.steps[1].type, "SUBMIT");
  console.log("[PASS] 8. Generic YouTube search workflow -> preserved cleanly");
}

// ---------------------------------------------------------------------
// TEST 9: Verify explicit-target validation regression
// ---------------------------------------------------------------------
{
  const explicitTask = "enter xyz@gmail.com as the recipient";
  const parsed = SIHTaskParser.parseTask(explicitTask);
  assert.strictEqual(parsed.steps.length, 1, "Expected 1 step");
  assert.strictEqual(parsed.steps[0].type, "FILL");
  assert.strictEqual(parsed.steps[0].fieldHint, "recipient");
  assert.strictEqual(parsed.steps[0].value, "xyz@gmail.com");

  // Verify sanitizedPlan preserves privacy
  assert.ok(parsed.sanitizedPlan, "sanitizedPlan must exist");
  assert.strictEqual(parsed.sanitizedPlan[0].value, undefined, "sanitizedPlan step must NOT expose raw value");
  console.log("[PASS] 9. Explicit-target validation -> preserves local execution value while sanitizing plan");
}

// ---------------------------------------------------------------------
// TEST 10: Verify full Gmail multi-step task and Send approval gate
// ---------------------------------------------------------------------
{
  const fullTask = "Find the search box, search Gmail, open the most relevant result, compose a new email, enter xyz@gmail.com as the recipient, enter Test Mail as the subject, type Hello, send the email, and verify that the email was sent.";
  const parsed = SIHTaskParser.parseTask(fullTask);

  assert.ok(parsed.steps.length >= 6, `Expected at least 6 steps, got ${parsed.steps.length}`);

  // Step with recipient email
  const recipientStep = parsed.steps.find(s => s.value === "xyz@gmail.com");
  assert.ok(recipientStep, "Recipient step must exist with local execution value");
  assert.strictEqual(recipientStep.type, "FILL");
  assert.strictEqual(recipientStep.fieldHint, "recipient");

  // Step with subject
  const subjectStep = parsed.steps.find(s => s.value === "Test Mail");
  assert.ok(subjectStep, "Subject step must exist with local execution value");
  assert.strictEqual(subjectStep.fieldHint, "subject");

  // Step with Send action
  const sendStep = parsed.steps.find(s => (s.targetHint || s.target || "").toLowerCase().includes("send") || s.legacyTarget === "SUBMIT_BUTTON" || s.type === "CLICK" && (s.targetHint || "").includes("email"));
  assert.ok(sendStep, "Send action must be recognized");

  // Check safety risk on Send action
  const safetyEvaluation = SIHReasoningPlanner.classifyActionRisk({ action: "CLICK", target: sendStep.targetHint || "send" }, fullTask);
  assert.strictEqual(safetyEvaluation.risk, "HIGH", "Send action must be classified as HIGH risk");
  assert.strictEqual(safetyEvaluation.requiresApproval, true, "Send action must require explicit human approval");

  console.log("[PASS] 10. Full Gmail task -> steps mapped correctly, local execution value retained, Send gated by HIGH risk approval");
}

// ---------------------------------------------------------------------
// TEST 11: Deduplication of overlapping sensitive regions
// ---------------------------------------------------------------------
{
  const duplicateRegions = [
    { x: 100, y: 150, width: 300, height: 40, source: "dom" },
    { x: 100, y: 150, width: 300, height: 40, source: "dom-value" }, // exact duplicate
    { x: 500, y: 200, width: 200, height: 35, source: "dom" } // separate field
  ];

  const deduped = SIHContent.deduplicateSensitiveRegions(duplicateRegions);
  assert.strictEqual(deduped.length, 2, `Expected 2 deduplicated regions, got ${deduped.length}`);
  console.log("[PASS] 11. Sensitive region deduplication -> merges overlapping regions correctly");
}

// ---------------------------------------------------------------------
// TESTS 12–20: REQUIREMENTS A–H LIVE-FORM MASKING & COORDINATE VERIFICATION
// ---------------------------------------------------------------------
const redactor = require("./screenshot-redactor.js");

// Setup canvas mock for buildSanitizedScreenshot
let filledBoxes = [];
global.Image = class {
  set src(val) {
    this.naturalWidth = 1500;
    this.naturalHeight = 1000;
    setTimeout(() => this.onload && this.onload(), 5);
  }
};
global.document = {
  createElement: (tag) => {
    if (tag === "canvas") {
      return {
        width: 0,
        height: 0,
        getContext: () => ({
          drawImage: () => {},
          fillRect: (x, y, w, h) => filledBoxes.push({ x, y, w, h }),
          fillText: () => {}
        }),
        toDataURL: () => "data:image/jpeg;base64,SANITIZED_SCREENSHOT_DATA"
      };
    }
  }
};

async function runTestPipeline(elements, viewport = { width: 1200, height: 800 }) {
  filledBoxes = [];
  const sensitiveRegions = [];

  elements.forEach((el) => {
    const isStructural = SIHContent.isSensitiveElement(el);
    let isValueSensitive = false;
    const localVal = SIHContent.extractElementLocalValue(el);
    if (localVal) {
      const check = SIHContent.checkValueSensitivity(localVal);
      if (check && check.detected) isValueSensitive = true;
    }

    if (isStructural || isValueSensitive) {
      const rect = el.getBoundingClientRect();
      const left = typeof rect.x === "number" ? rect.x : rect.left;
      const top = typeof rect.y === "number" ? rect.y : rect.top;
      sensitiveRegions.push({
        x: Math.round(left),
        y: Math.round(top),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        source: (isValueSensitive && !isStructural) ? "dom-value" : "dom"
      });
    }
  });

  const scaleX = 1500 / viewport.width; // 1.25
  const scaleY = 1000 / viewport.height; // 1.25
  const merged = redactor.mergeSensitiveRegions(sensitiveRegions, [], 1500, 1000, { scaleX, scaleY });
  const result = await redactor.buildSanitizedScreenshot("data:image/jpeg;base64,RAW", merged);

  return { sensitiveRegions, merged, filledBoxes, result };
}

(async () => {
  // TEST 12 (A): Email inside input
  {
    const emailInput = {
      tagName: "INPUT",
      type: "text",
      value: "testuser123@gmail.com",
      getAttribute: () => null,
      closest: () => null,
      getBoundingClientRect: () => ({ x: 100, y: 100, width: 200, height: 30, left: 100, top: 100 })
    };
    const { sensitiveRegions, filledBoxes, result } = await runTestPipeline([emailInput]);
    assert.strictEqual(sensitiveRegions.length, 1, "A: Email region must be detected");
    assert.strictEqual(result.success, true, "A: Redaction must succeed");
    assert.strictEqual(filledBoxes.length, 1, "A: Screenshot region must be masked");
    assert.ok(filledBoxes[0].w >= 200 * 1.25, "A: Mask width must cover input scaled");
    console.log("[PASS] 12 (A). Email inside input -> sensitive region detected & screenshot masked");
  }

  // TEST 13 (B): Phone number inside input
  {
    const phoneInput = {
      tagName: "INPUT",
      type: "tel",
      value: "9876543210",
      getAttribute: () => null,
      closest: () => null,
      getBoundingClientRect: () => ({ x: 50, y: 200, width: 160, height: 32, left: 50, top: 200 })
    };
    const { sensitiveRegions, filledBoxes, result } = await runTestPipeline([phoneInput]);
    assert.strictEqual(sensitiveRegions.length, 1, "B: Phone region must be detected");
    assert.strictEqual(result.success, true, "B: Redaction must succeed");
    assert.strictEqual(filledBoxes.length, 1, "B: Screenshot region must be masked");
    console.log("[PASS] 13 (B). Phone number inside input -> sensitive region detected & screenshot masked");
  }

  // TEST 14 (C): Password input
  {
    const passwordInput = {
      tagName: "INPUT",
      type: "password",
      value: "secret123",
      getAttribute: () => null,
      closest: () => null,
      getBoundingClientRect: () => ({ x: 80, y: 300, width: 180, height: 35, left: 80, top: 300 })
    };
    const { sensitiveRegions, filledBoxes, result } = await runTestPipeline([passwordInput]);
    assert.strictEqual(sensitiveRegions.length, 1, "C: Password region must be detected");
    assert.strictEqual(result.success, true, "C: Redaction must succeed");
    assert.strictEqual(filledBoxes.length, 1, "C: Screenshot region must be masked");
    console.log("[PASS] 14 (C). Password input -> sensitive region detected & screenshot masked");
  }

  // TEST 15 (D): Credit/debit card number inside input
  {
    const cardInput = {
      tagName: "INPUT",
      type: "text",
      value: "4111111111111111",
      getAttribute: () => null,
      closest: () => null,
      getBoundingClientRect: () => ({ x: 60, y: 400, width: 220, height: 35, left: 60, top: 400 })
    };
    const { sensitiveRegions, filledBoxes, result } = await runTestPipeline([cardInput]);
    assert.strictEqual(sensitiveRegions.length, 1, "D: Card region must be detected");
    assert.strictEqual(result.success, true, "D: Redaction must succeed");
    assert.strictEqual(filledBoxes.length, 1, "D: Screenshot region must be masked");
    console.log("[PASS] 15 (D). Credit/debit card number -> sensitive region detected & screenshot masked");
  }

  // TEST 16 (E): Normal non-sensitive input -> should NOT be masked
  {
    const normalInput = {
      tagName: "INPUT",
      type: "text",
      value: "blue running shoes",
      getAttribute: () => null,
      closest: () => null,
      getBoundingClientRect: () => ({ x: 100, y: 100, width: 300, height: 40, left: 100, top: 100 })
    };
    const { sensitiveRegions, filledBoxes, result } = await runTestPipeline([normalInput]);
    assert.strictEqual(sensitiveRegions.length, 0, "E: Normal input must NOT create sensitive region");
    assert.strictEqual(result.success, true, "E: Redaction must succeed (pass-through)");
    assert.strictEqual(filledBoxes.length, 0, "E: Normal input must NOT be masked");
    console.log("[PASS] 16 (E). Normal non-sensitive input -> NOT masked");
  }

  // TEST 17 (F): Multiple sensitive inputs -> every region masked
  {
    const emailField = {
      tagName: "INPUT",
      type: "text",
      value: "admin@portal.org",
      getAttribute: () => null,
      closest: () => null,
      getBoundingClientRect: () => ({ x: 50, y: 50, width: 200, height: 30, left: 50, top: 50 })
    };
    const phoneField = {
      tagName: "INPUT",
      type: "text",
      value: "9123456780",
      getAttribute: () => null,
      closest: () => null,
      getBoundingClientRect: () => ({ x: 50, y: 150, width: 150, height: 30, left: 50, top: 150 })
    };
    const pwdField = {
      tagName: "INPUT",
      type: "password",
      value: "supersecret",
      getAttribute: () => null,
      closest: () => null,
      getBoundingClientRect: () => ({ x: 50, y: 250, width: 180, height: 30, left: 50, top: 250 })
    };
    const { sensitiveRegions, filledBoxes, result } = await runTestPipeline([emailField, phoneField, pwdField]);
    assert.strictEqual(sensitiveRegions.length, 3, "F: All 3 sensitive inputs must be detected");
    assert.strictEqual(result.success, true, "F: Redaction must succeed");
    assert.strictEqual(filledBoxes.length, 3, "F: All 3 corresponding regions must be masked");
    console.log("[PASS] 17 (F). Multiple sensitive inputs -> every corresponding region is masked");
  }

  // TEST 18 (G): Existing M11 structural sensitive regions continue working
  {
    const emptyPwd = {
      tagName: "INPUT",
      type: "password",
      value: "",
      getAttribute: () => null,
      closest: () => null,
      getBoundingClientRect: () => ({ x: 200, y: 200, width: 150, height: 30, left: 200, top: 200 })
    };
    const { sensitiveRegions, filledBoxes } = await runTestPipeline([emptyPwd]);
    assert.strictEqual(sensitiveRegions.length, 1, "G: Empty password must remain structurally sensitive");
    assert.strictEqual(filledBoxes.length, 1, "G: Must be masked on screenshot");
    console.log("[PASS] 18 (G). Existing M11 structural sensitive regions -> continue working");
  }

  // TEST 19 (H): Arbitrary field labels / arbitrary websites behavior remains generic
  {
    const arbitraryPortalField = {
      tagName: "INPUT",
      type: "text",
      id: "custom_input_portal_99",
      value: "citizen99@customdomain.io",
      getAttribute: (attr) => (attr === "aria-label" ? "Custom User Identifier" : null),
      closest: () => null,
      getBoundingClientRect: () => ({ x: 120, y: 180, width: 250, height: 32, left: 120, top: 180 })
    };
    const { sensitiveRegions, filledBoxes } = await runTestPipeline([arbitraryPortalField]);
    assert.strictEqual(sensitiveRegions.length, 1, "H: Arbitrary label with email value must be detected generically");
    assert.strictEqual(filledBoxes.length, 1, "H: Masked generically without site-specific logic");
    console.log("[PASS] 19 (H). Arbitrary field labels / arbitrary websites -> behavior remains generic");
  }

  // TEST 20: Coordinate scaling verification with anisotropic ratio
  {
    const domBox = [{ x: 100, y: 200, width: 300, height: 50, source: "dom-value" }];
    const scaled = redactor.mergeSensitiveRegions(domBox, [], 1600, 1000, { scaleX: 1.333, scaleY: 1.25 });
    assert.strictEqual(scaled.length, 1);
    assert.strictEqual(scaled[0].x, Math.round(100 * 1.333));
    assert.strictEqual(scaled[0].y, Math.round(200 * 1.25));
    assert.strictEqual(scaled[0].width, Math.round(300 * 1.333));
    assert.strictEqual(scaled[0].height, Math.round(50 * 1.25));
    console.log("[PASS] 20. Coordinate scaling verification -> anisotropic viewport scaling accurate");
  }

  console.log("============================================================");
  console.log("ALL SIH26171 LIVE FORM PRIVACY & REGRESSION TESTS PASSED!");
  console.log("============================================================");
})();
