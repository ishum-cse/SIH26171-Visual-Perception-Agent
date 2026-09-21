/**
 * test-m22-change-detection.js
 * Milestone 22.2: Test Suite for Adaptive Local Perception Reuse & Lightweight Page-State Change Detection
 *
 * Tests:
 * 1. SAME PAGE: Same URL/title/structure/bounds -> REUSE
 * 2. URL CHANGE: Different URL -> FRESH
 * 3. ELEMENT COUNT CHANGE: Add/remove interactive element -> FRESH
 * 4. STRUCTURAL CHANGE: Alter element type/label/state -> FRESH
 * 5. BOUNDING BOX CHANGE: Shift element positions crossing coarse 10px bucket -> FRESH
 * 6. FILL REUSE: Sequential FILL with stable page state -> REUSE
 * 7. CLICK: Forced fresh perception on CLICK -> FRESH
 * 8. SUBMIT: Forced fresh perception on SUBMIT -> FRESH
 * 9. SCROLL: Forced fresh perception on SCROLL -> FRESH
 * 10. EXPIRED CACHE: Cached state older than 10s TTL -> FRESH
 * 11. FAILED VERIFICATION: Prior verification FAILED -> FRESH
 * 12. UNKNOWN VERIFICATION: Prior verification UNKNOWN -> FRESH
 * 13. RECOVERY: Explicit recovery directive -> FRESH
 * 14. PRIVACY GUARANTEE: Never includes input values, passwords, or raw form data -> PASS
 * 15. EXISTING CHANGE DETECTOR: Regression verification -> PASS
 */

const assert = require("assert");
const {
  computeLightweightDomSignature,
  compareLightweightSignatures,
  canReusePerception,
  computeScreenSignature,
  compareScreenSignatures,
  computeHammingDistance,
  hashString,
  normalizeUrl,
  normalizeTitle,
  PERCEPTION_CACHE_TTL_MS
} = require("./change-detector.js");

console.log("============================================================");
console.log("RUNNING MILESTONE 22.2 ADAPTIVE PERCEPTION TEST SUITE");
console.log("============================================================");

// Sample baseline elements
const BASE_ELEMENTS = [
  { type: "input", label: "Full Name", semanticTag: null, disabled: false, x: 50, y: 100, width: 250, height: 40 },
  { type: "input", label: "Email Address", semanticTag: null, disabled: false, x: 50, y: 160, width: 250, height: 40 },
  { type: "input", label: "Phone Number", semanticTag: null, disabled: false, x: 50, y: 220, width: 250, height: 40 },
  { type: "button", label: "Submit", semanticTag: "SUBMIT_BUTTON", disabled: false, x: 50, y: 290, width: 120, height: 45 }
];

const BASE_META = {
  url: "https://example.com/form",
  title: "Contact Form",
  viewport: { scrollX: 0, scrollY: 0, width: 1280, height: 800 }
};

// TEST 1 — SAME PAGE
{
  console.log("\n[TEST 1] SAME PAGE");
  const sig1 = computeLightweightDomSignature(BASE_ELEMENTS, BASE_META);
  const sig2 = computeLightweightDomSignature(BASE_ELEMENTS, BASE_META);
  const comp = compareLightweightSignatures(sig1, sig2);
  assert.strictEqual(comp.changed, false, "Signatures for identical page state must report changed=false");

  const decision = canReusePerception({
    lastAction: "FILL",
    previousSignature: sig1,
    currentSignature: sig2,
    currentStep: 2,
    verificationResult: { status: "VERIFIED" },
    cachedAt: Date.now() - 1000,
    hasCachedData: true
  });
  assert.strictEqual(decision.canReuse, true, "Stable page state must allow reuse");
  assert.ok(decision.reason.includes("REUSED"), `Decision reason must indicate REUSED, got: ${decision.reason}`);
  console.log("  ✓ Verified: Same URL/title/structure/bounds produces REUSED");
}

// TEST 2 — URL CHANGE
{
  console.log("\n[TEST 2] URL CHANGE");
  const sig1 = computeLightweightDomSignature(BASE_ELEMENTS, BASE_META);
  const sig2 = computeLightweightDomSignature(BASE_ELEMENTS, { ...BASE_META, url: "https://example.com/success" });
  const comp = compareLightweightSignatures(sig1, sig2);
  assert.strictEqual(comp.changed, true, "URL change must report changed=true");

  const decision = canReusePerception({
    lastAction: "FILL",
    previousSignature: sig1,
    currentSignature: sig2,
    currentStep: 2,
    verificationResult: { status: "VERIFIED" },
    cachedAt: Date.now() - 1000,
    hasCachedData: true
  });
  assert.strictEqual(decision.canReuse, false, "URL change must force fresh perception");
  assert.ok(decision.reason.includes("FRESH"), `Decision reason must indicate FRESH, got: ${decision.reason}`);
  console.log("  ✓ Verified: URL change forces FRESH perception");
}

// TEST 3 — ELEMENT COUNT CHANGE
{
  console.log("\n[TEST 3] ELEMENT COUNT CHANGE");
  const sig1 = computeLightweightDomSignature(BASE_ELEMENTS, BASE_META);
  // Add a dynamic error message / banner element
  const elementsWithBanner = [
    ...BASE_ELEMENTS,
    { type: "element", label: "Invalid format error", semanticTag: null, disabled: false, x: 50, y: 350, width: 250, height: 30 }
  ];
  const sig2 = computeLightweightDomSignature(elementsWithBanner, BASE_META);
  const comp = compareLightweightSignatures(sig1, sig2);
  assert.strictEqual(comp.changed, true, "Element count change must report changed=true");

  const decision = canReusePerception({
    lastAction: "FILL",
    previousSignature: sig1,
    currentSignature: sig2,
    currentStep: 2,
    verificationResult: { status: "VERIFIED" },
    cachedAt: Date.now() - 1000,
    hasCachedData: true
  });
  assert.strictEqual(decision.canReuse, false, "Element count change must force fresh perception");
  console.log("  ✓ Verified: Element count addition/removal forces FRESH perception");
}

// TEST 4 — STRUCTURAL CHANGE
{
  console.log("\n[TEST 4] STRUCTURAL CHANGE");
  const sig1 = computeLightweightDomSignature(BASE_ELEMENTS, BASE_META);
  // Change button label or disabled state
  const modifiedElements = BASE_ELEMENTS.map((el, i) => i === 3 ? { ...el, disabled: true, label: "Submitting..." } : el);
  const sig2 = computeLightweightDomSignature(modifiedElements, BASE_META);
  const comp = compareLightweightSignatures(sig1, sig2);
  assert.strictEqual(comp.changed, true, "Element label/disabled change must report changed=true");

  const decision = canReusePerception({
    lastAction: "FILL",
    previousSignature: sig1,
    currentSignature: sig2,
    currentStep: 2,
    verificationResult: { status: "VERIFIED" },
    cachedAt: Date.now() - 1000,
    hasCachedData: true
  });
  assert.strictEqual(decision.canReuse, false, "Structural change must force fresh perception");
  console.log("  ✓ Verified: Element structural change forces FRESH perception");
}

// TEST 5 — BOUNDING BOX CHANGE
{
  console.log("\n[TEST 5] BOUNDING BOX CHANGE");
  const sig1 = computeLightweightDomSignature(BASE_ELEMENTS, BASE_META);
  // Shift elements down by 80px (e.g. accordion expanded or banner injected above)
  const shiftedElements = BASE_ELEMENTS.map((el) => ({ ...el, y: el.y + 80 }));
  const sig2 = computeLightweightDomSignature(shiftedElements, BASE_META);
  const comp = compareLightweightSignatures(sig1, sig2);
  assert.strictEqual(comp.changed, true, "Coarse bbox shift >10px must report changed=true");

  const decision = canReusePerception({
    lastAction: "FILL",
    previousSignature: sig1,
    currentSignature: sig2,
    currentStep: 2,
    verificationResult: { status: "VERIFIED" },
    cachedAt: Date.now() - 1000,
    hasCachedData: true
  });
  assert.strictEqual(decision.canReuse, false, "Layout/position shift must force fresh perception");
  console.log("  ✓ Verified: Layout shift crossing coarse buckets forces FRESH perception");
}

// TEST 6 — FILL REUSE
{
  console.log("\n[TEST 6] FILL REUSE");
  const sig = computeLightweightDomSignature(BASE_ELEMENTS, BASE_META);
  const decision = canReusePerception({
    lastAction: "FILL",
    nextActionType: "FILL",
    previousSignature: sig,
    currentSignature: sig,
    currentStep: 2,
    verificationResult: { status: "VERIFIED" },
    cachedAt: Date.now() - 500,
    hasCachedData: true
  });
  assert.strictEqual(decision.canReuse, true, "Sequential FILL on stable form must allow reuse");
  assert.strictEqual(decision.reason, "REUSED — Stable Page");
  console.log("  ✓ Verified: Sequential FILL on stable page cleanly REUSES perception");
}

// TEST 7 — CLICK
{
  console.log("\n[TEST 7] CLICK FORCED FRESH");
  const sig = computeLightweightDomSignature(BASE_ELEMENTS, BASE_META);
  const decision = canReusePerception({
    lastAction: "CLICK",
    previousSignature: sig,
    currentSignature: sig,
    currentStep: 2,
    verificationResult: { status: "VERIFIED" },
    cachedAt: Date.now() - 500,
    hasCachedData: true
  });
  assert.strictEqual(decision.canReuse, false, "CLICK must force fresh perception");
  assert.ok(decision.reason.includes("Forced by CLICK"), `Expected 'Forced by CLICK', got: ${decision.reason}`);
  console.log("  ✓ Verified: CLICK action strictly forces FRESH perception");
}

// TEST 8 — SUBMIT
{
  console.log("\n[TEST 8] SUBMIT FORCED FRESH");
  const sig = computeLightweightDomSignature(BASE_ELEMENTS, BASE_META);
  const decision1 = canReusePerception({
    lastAction: "SUBMIT",
    previousSignature: sig,
    currentSignature: sig,
    currentStep: 2,
    verificationResult: { status: "VERIFIED" },
    cachedAt: Date.now() - 500,
    hasCachedData: true
  });
  assert.strictEqual(decision1.canReuse, false, "Prior SUBMIT must force fresh perception");

  const decision2 = canReusePerception({
    lastAction: "FILL",
    nextActionType: "SUBMIT",
    previousSignature: sig,
    currentSignature: sig,
    currentStep: 2,
    verificationResult: { status: "VERIFIED" },
    cachedAt: Date.now() - 500,
    hasCachedData: true
  });
  assert.strictEqual(decision2.canReuse, false, "Upcoming SUBMIT must force fresh perception");
  console.log("  ✓ Verified: SUBMIT action strictly forces FRESH perception");
}

// TEST 9 — SCROLL
{
  console.log("\n[TEST 9] SCROLL FORCED FRESH");
  const sig = computeLightweightDomSignature(BASE_ELEMENTS, BASE_META);
  const decision1 = canReusePerception({
    lastAction: "SCROLL",
    previousSignature: sig,
    currentSignature: sig,
    currentStep: 2,
    verificationResult: { status: "VERIFIED" },
    cachedAt: Date.now() - 500,
    hasCachedData: true
  });
  assert.strictEqual(decision1.canReuse, false, "Prior SCROLL must force fresh perception");

  const decision2 = canReusePerception({
    lastAction: "FILL",
    nextActionType: "SCROLL",
    previousSignature: sig,
    currentSignature: sig,
    currentStep: 2,
    verificationResult: { status: "VERIFIED" },
    cachedAt: Date.now() - 500,
    hasCachedData: true
  });
  assert.strictEqual(decision2.canReuse, false, "Upcoming SCROLL must force fresh perception");
  console.log("  ✓ Verified: SCROLL action strictly forces FRESH perception");
}

// TEST 10 — EXPIRED CACHE
{
  console.log("\n[TEST 10] EXPIRED CACHE TTL");
  const sig = computeLightweightDomSignature(BASE_ELEMENTS, BASE_META);
  const expiredTime = Date.now() - (PERCEPTION_CACHE_TTL_MS + 1000); // 11s old
  const decision = canReusePerception({
    lastAction: "FILL",
    previousSignature: sig,
    currentSignature: sig,
    currentStep: 2,
    verificationResult: { status: "VERIFIED" },
    cachedAt: expiredTime,
    hasCachedData: true
  });
  assert.strictEqual(decision.canReuse, false, "Expired perception cache must force fresh perception");
  assert.ok(decision.reason.includes("expired"), `Expected 'expired', got: ${decision.reason}`);
  console.log("  ✓ Verified: Cache older than PERCEPTION_CACHE_TTL_MS (10s) forces FRESH perception");
}

// TEST 11 — FAILED VERIFICATION
{
  console.log("\n[TEST 11] FAILED VERIFICATION");
  const sig = computeLightweightDomSignature(BASE_ELEMENTS, BASE_META);
  const decision = canReusePerception({
    lastAction: "FILL",
    previousSignature: sig,
    currentSignature: sig,
    currentStep: 2,
    verificationResult: { status: "FAILED", reason: "Target not found" },
    cachedAt: Date.now() - 500,
    hasCachedData: true
  });
  assert.strictEqual(decision.canReuse, false, "FAILED verification must force fresh perception");
  assert.ok(decision.reason.includes("FAILED"), `Expected 'FAILED', got: ${decision.reason}`);
  console.log("  ✓ Verified: FAILED action verification strictly forces FRESH perception");
}

// TEST 12 — UNKNOWN VERIFICATION
{
  console.log("\n[TEST 12] UNKNOWN VERIFICATION");
  const sig = computeLightweightDomSignature(BASE_ELEMENTS, BASE_META);
  const decision = canReusePerception({
    lastAction: "FILL",
    previousSignature: sig,
    currentSignature: sig,
    currentStep: 2,
    verificationResult: { status: "UNKNOWN", reason: "Indeterminate outcome" },
    cachedAt: Date.now() - 500,
    hasCachedData: true
  });
  assert.strictEqual(decision.canReuse, false, "UNKNOWN verification must force fresh perception");
  assert.ok(decision.reason.includes("UNKNOWN") || decision.reason.includes("Uncertain"), `Expected UNKNOWN/Uncertain, got: ${decision.reason}`);
  console.log("  ✓ Verified: UNKNOWN action verification strictly forces FRESH perception");
}

// TEST 13 — RECOVERY
{
  console.log("\n[TEST 13] RECOVERY FORCE FRESH");
  const sig = computeLightweightDomSignature(BASE_ELEMENTS, BASE_META);
  const decision = canReusePerception({
    lastAction: "FILL",
    previousSignature: sig,
    currentSignature: sig,
    currentStep: 2,
    verificationResult: { status: "VERIFIED" },
    cachedAt: Date.now() - 500,
    forceFresh: true,
    hasCachedData: true
  });
  assert.strictEqual(decision.canReuse, false, "Controlled recovery directive must force fresh perception");
  assert.ok(decision.reason.includes("Forced by recovery"), `Expected 'Forced by recovery', got: ${decision.reason}`);
  console.log("  ✓ Verified: Controlled recovery directive strictly forces FRESH perception");
}

// TEST 14 — PRIVACY GUARANTEE
{
  console.log("\n[TEST 14] PRIVACY GUARANTEE");
  const elementWithSecret = {
    type: "input",
    label: "Password",
    semanticTag: null,
    disabled: false,
    x: 50,
    y: 100,
    width: 200,
    height: 40,
    // Sensitive properties that MUST NEVER enter the signature
    value: "SecretPassword123!",
    inputValue: "SecretPassword123!",
    text: "SecretPassword123!",
    password: "SecretPassword123!",
    formData: { creditCard: "4111-2222-3333-4444" }
  };

  const sig = computeLightweightDomSignature([elementWithSecret], BASE_META);
  const sigStr = JSON.stringify(sig);

  assert.strictEqual(sigStr.includes("SecretPassword123!"), false, "Signature must NOT contain input secret value");
  assert.strictEqual(sigStr.includes("4111-2222-3333-4444"), false, "Signature must NOT contain credit card data");
  assert.strictEqual(sigStr.includes("value"), false, "Signature must NOT contain 'value' property");

  // Verify that changing ONLY the input value produces identical signatures
  const elementWithDifferentSecret = {
    ...elementWithSecret,
    value: "DifferentSecret456!",
    inputValue: "DifferentSecret456!"
  };
  const sig2 = computeLightweightDomSignature([elementWithDifferentSecret], BASE_META);
  const comp = compareLightweightSignatures(sig, sig2);
  assert.strictEqual(comp.changed, false, "Typing into a field without altering DOM structure must not change the structural signature");
  console.log("  ✓ Verified: Zero sensitive content/passwords/values leak into signature");
}

// TEST 15 — EXISTING CHANGE DETECTOR TESTS
{
  console.log("\n[TEST 15] EXISTING CHANGE DETECTOR REGRESSION");
  assert.strictEqual(typeof computeScreenSignature, "function", "computeScreenSignature must remain exported");
  assert.strictEqual(typeof compareScreenSignatures, "function", "compareScreenSignatures must remain exported");
  assert.strictEqual(typeof computeHammingDistance, "function", "computeHammingDistance must remain exported");
  assert.strictEqual(typeof hashString, "function", "hashString must remain exported");

  const h1 = hashString("test-string");
  const h2 = hashString("test-string");
  assert.strictEqual(h1, h2, "hashString determinism intact");

  const d1 = computeHammingDistance("1010", "1010");
  const d2 = computeHammingDistance("1010", "0101");
  assert.strictEqual(d1, 0, "Hamming distance for identical strings must be 0");
  assert.strictEqual(d2, 4, "Hamming distance for inverted strings must be length");
  console.log("  ✓ Verified: Existing change-detector APIs and contracts remain 100% intact");
}

console.log("\n============================================================");
console.log("ALL 15 MILESTONE 22.2 ADAPTIVE PERCEPTION TESTS PASSED!");
console.log("============================================================");
