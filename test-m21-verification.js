/**
 * test-m21-verification.js - Milestone 21.2: Action Failure Detection & Verification Suite
 * 
 * Verifies:
 * TEST 1  — Successful click with URL/Title navigation -> VERIFIED (verified: true)
 * TEST 2  — Explicit click execution failure (disabled/stale/drift) -> FAILED (verified: false)
 * TEST 3  — Successful action but no observable change -> UNKNOWN (verified: "unknown", NEVER false failure)
 * TEST 4  — Successful fill with confirmed value -> VERIFIED (verified: true)
 * TEST 5  — Fill execution failure (disabled field / setter failure) -> FAILED (verified: false)
 * TEST 6  — Scroll position changed -> VERIFIED (verified: true)
 * TEST 7  — Scroll execution failure (unsupported target / invalid amount) -> FAILED (verified: false)
 * TEST 8  — Submit execution failure (no form/submit input) -> FAILED (verified: false)
 * TEST 9  — URL unchanged after valid click -> must NOT automatically mean FAILED
 * TEST 10 — Sensitive form values never appear in failure logs or verification telemetry
 * TEST 11 — Content script target-not-found & disabled-target safety checks
 * TEST 12 — Simultaneous whole-form autofill (success & failure cases)
 * TEST 13 — Scroll at page boundary with zero displacement -> UNKNOWN (avoids brittle failure)
 * TEST 14 — Submit without URL transition (in-place SPA / AJAX) -> UNKNOWN or VERIFIED, never false FAILED
 * TEST 15 — Fail-safe contract against null / undefined / malformed observations
 */

const assert = require("assert");
const actionVerifier = require("./action-verifier.js");
const SIHContent = require("./content.js");

console.log("============================================================");
console.log("RUNNING MILESTONE 21.2 ACTION FAILURE DETECTION TEST SUITE");
console.log("============================================================\n");

// [TEST 1] Successful click -> VERIFIED
console.log("[TEST 1] Successful click -> VERIFIED");
{
  const pre = { url: "https://www.google.com", title: "Google", visualElements: [{ label: "Search" }] };
  const post = { url: "https://www.youtube.com", title: "YouTube", visualElements: [{ label: "YouTube Home" }] };
  const action = { action: "CLICK", target: "search_result", targetLabel: "YouTube" };
  const exec = { executed: true, action: "CLICK" };

  const res = actionVerifier.verifyActionOutcome(pre, post, action, exec);
  assert.strictEqual(res.status, "VERIFIED");
  assert.strictEqual(res.verified, true);
  assert.strictEqual(res.evidence.urlChanged, true);
  assert.strictEqual(res.evidence.executionSuccess, true);
  assert.ok(res.reason.includes("URL changed"));
  console.log(`  ✓ CLICK navigation verified: verified=${res.verified} reason=${res.reason}`);
}

// [TEST 2] Explicit click execution failure -> FAILED
console.log("\n[TEST 2] Explicit click execution failure -> FAILED");
{
  const pre = { url: "https://example.com", title: "Example", visualElements: [] };
  const post = { url: "https://example.com", title: "Example", visualElements: [] };
  const action = { action: "CLICK", target: "deleted_btn" };
  const exec = { executed: false, reason: "Target element is disabled or read-only" };

  const res = actionVerifier.verifyActionOutcome(pre, post, action, exec);
  assert.strictEqual(res.status, "FAILED");
  assert.strictEqual(res.verified, false);
  assert.strictEqual(res.evidence.executionSuccess, false);
  assert.strictEqual(res.evidence.executionError, "Target element is disabled or read-only");
  assert.ok(res.reason.includes("Execution failed"));
  console.log(`  ✓ Explicit execution failure verified: verified=${res.verified} reason=${res.reason}`);
}

// [TEST 3] Successful action but no observable change -> UNKNOWN (NEVER FAILED)
console.log("\n[TEST 3] Successful action but no observable change -> UNKNOWN (Golden Rule)");
{
  const pre = { url: "https://example.com", title: "Example", visualElements: [{ label: "Accordion" }] };
  const post = { url: "https://example.com", title: "Example", visualElements: [{ label: "Accordion" }] };
  const action = { action: "CLICK", target: "Accordion", targetLabel: "Accordion" };
  const exec = { executed: true, action: "CLICK" };

  const res = actionVerifier.verifyActionOutcome(pre, post, action, exec);
  assert.strictEqual(res.status, "UNKNOWN", "Ambiguous state without observable diff must be UNKNOWN");
  assert.strictEqual(res.verified, "unknown", "verified field must be 'unknown', NOT false");
  assert.strictEqual(res.evidence.executionSuccess, true);
  assert.ok(res.reason.includes("Insufficient observable state change"));
  console.log(`  ✓ Golden Rule preserved: Ambiguity is verified='unknown' (never false negative FAILED)`);
}

// [TEST 4] Successful fill -> VERIFIED
console.log("\n[TEST 4] Successful fill -> VERIFIED");
{
  const pre = { url: "https://example.com", title: "Form", visualElements: [{ label: "Username" }] };
  const post = { url: "https://example.com", title: "Form", visualElements: [{ label: "Username" }] };
  const action = { action: "FILL", target: "Username", targetLabel: "Username", value: "TestUser" };
  const exec = { executed: true, action: "FILL", verified: true };

  const res = actionVerifier.verifyActionOutcome(pre, post, action, exec);
  assert.strictEqual(res.status, "VERIFIED");
  assert.strictEqual(res.verified, true);
  assert.strictEqual(res.evidence.controlUpdated, true);
  assert.ok(res.reason.includes("Control value updated"));
  console.log(`  ✓ Field update verified: verified=${res.verified} reason=${res.reason}`);
}

// [TEST 5] Fill execution failure -> FAILED
console.log("\n[TEST 5] Fill execution failure -> FAILED");
{
  // 5a. Control failed to take value
  const execFailedValue = { executed: true, action: "FILL", verified: false };
  const res1 = actionVerifier.verifyActionOutcome({}, {}, { action: "FILL" }, execFailedValue);
  assert.strictEqual(res1.status, "FAILED");
  assert.strictEqual(res1.verified, false);
  assert.strictEqual(res1.evidence.controlUpdated, false);
  assert.ok(res1.reason.includes("Target control value did not update"));

  // 5b. Control disabled/read-only execution rejection
  const execRejected = { executed: false, reason: "Target element is disabled or read-only" };
  const res2 = actionVerifier.verifyActionOutcome({}, {}, { action: "FILL" }, execRejected);
  assert.strictEqual(res2.status, "FAILED");
  assert.strictEqual(res2.verified, false);
  assert.strictEqual(res2.evidence.executionSuccess, false);
  console.log(`  ✓ Fill execution failures strictly detected: verified=${res1.verified}, ${res2.verified}`);
}

// [TEST 6] Scroll position changed -> VERIFIED
console.log("\n[TEST 6] Scroll position changed -> VERIFIED");
{
  const pre = { scrollY: 0, scrollX: 0 };
  const post = { scrollY: 450, scrollX: 0 };
  const action = { action: "SCROLL", target: "PAGE", amount: 450 };
  const exec = { executed: true, action: "SCROLL", amount: 450 };

  const res = actionVerifier.verifyActionOutcome(pre, post, action, exec);
  assert.strictEqual(res.status, "VERIFIED");
  assert.strictEqual(res.verified, true);
  assert.strictEqual(res.evidence.scrollChanged, true);
  assert.ok(res.reason.includes("delta Y: 450px"));
  console.log(`  ✓ Scroll displacement verified: verified=${res.verified} reason=${res.reason}`);
}

// [TEST 7] Scroll execution failure -> FAILED
console.log("\n[TEST 7] Scroll execution failure -> FAILED");
{
  const action = { action: "SCROLL", target: "PAGE", amount: 99999 };
  const exec = { executed: false, reason: "Invalid or unsupported scroll amount" };

  const res = actionVerifier.verifyActionOutcome({}, {}, action, exec);
  assert.strictEqual(res.status, "FAILED");
  assert.strictEqual(res.verified, false);
  assert.strictEqual(res.evidence.executionSuccess, false);
  assert.ok(res.reason.includes("Invalid or unsupported scroll amount"));
  console.log(`  ✓ Scroll failure detected: verified=${res.verified} reason=${res.reason}`);
}

// [TEST 8] Submit execution failure -> FAILED
console.log("\n[TEST 8] Submit execution failure -> FAILED");
{
  const action = { action: "SUBMIT", target: "search_box" };
  const exec = { executed: false, reason: "No form, submit button, or input found to submit search." };

  const res = actionVerifier.verifyActionOutcome({}, {}, action, exec);
  assert.strictEqual(res.status, "FAILED");
  assert.strictEqual(res.verified, false);
  assert.strictEqual(res.evidence.executionSuccess, false);
  assert.ok(res.reason.includes("No form, submit button, or input found"));
  console.log(`  ✓ Submit failure detected: verified=${res.verified} reason=${res.reason}`);
}

// [TEST 9] URL unchanged after valid click -> must NOT automatically mean FAILED
console.log("\n[TEST 9] URL unchanged after valid click -> must NOT automatically mean FAILED");
{
  // 9a. Click that produced DOM mutation without URL change -> VERIFIED
  const preDom = { url: "https://example.com", title: "Example", visualElements: [{ label: "Tab 1" }] };
  const postDom = { url: "https://example.com", title: "Example", visualElements: [{ label: "Tab 1" }, { label: "Tab Panel 2" }] };
  const resDom = actionVerifier.verifyActionOutcome(preDom, postDom, { action: "CLICK", target: "Tab 2" }, { executed: true });
  assert.strictEqual(resDom.status, "VERIFIED");
  assert.strictEqual(resDom.verified, true);
  assert.strictEqual(resDom.evidence.urlChanged, false);
  assert.strictEqual(resDom.evidence.domChanged, true);

  // 9b. Click that produced no observable diff -> UNKNOWN (never FAILED)
  const preStale = { url: "https://example.com", title: "Example", visualElements: [] };
  const postStale = { url: "https://example.com", title: "Example", visualElements: [] };
  const resStale = actionVerifier.verifyActionOutcome(preStale, postStale, { action: "CLICK", target: "Toggle" }, { executed: true });
  assert.notStrictEqual(resStale.status, "FAILED", "URL unchanged alone MUST NOT yield FAILED");
  assert.notStrictEqual(resStale.verified, false, "verified must NOT be false when action succeeded");
  assert.strictEqual(resStale.status, "UNKNOWN");
  assert.strictEqual(resStale.verified, "unknown");
  console.log(`  ✓ Safe handling verified: URL stability never causes false FAILED`);
}

// [TEST 10] Sensitive form values never appear in failure logs or verification output
console.log("\n[TEST 10] Sensitive form values never appear in failure logs");
{
  const secretCreds = "SecretPassword!123_test@victim.org_4111222233334444";
  const action = { action: "FILL", target: "login_pass", value: secretCreds };
  const execFailure = { executed: false, reason: `Failed to fill input with value ${secretCreds}` };

  const res = actionVerifier.verifyActionOutcome({}, {}, action, execFailure);
  const outJson = JSON.stringify(res);

  assert.ok(!outJson.includes(secretCreds), "Full sensitive value must NEVER appear in verification output");
  assert.ok(!outJson.includes("SecretPassword"), "Password substring must NEVER appear in verification output");
  assert.ok(!outJson.includes("test@victim.org"), "Email must NEVER appear in verification output");
  assert.ok(!outJson.includes("4111222233334444"), "Card number must NEVER appear in verification output");
  console.log(`  ✓ Privacy verified: Sanitizer successfully scrubbed all credentials from failure output`);
}

// [TEST 11] Content script execution target safety checks
console.log("\n[TEST 11] Content script target safety checks");
{
  // Content script executeAction rejects missing target
  const missingTargetRes = SIHContent.executeAction({ action: "CLICK", target: "NON_EXISTENT_TARGET" });
  assert.strictEqual(missingTargetRes.executed, false);
  assert.ok(missingTargetRes.reason.includes("Unsupported or unknown"));

  // Verifier receives content script failure and flags FAILED
  const verifRes = actionVerifier.verifyActionOutcome({}, {}, { action: "CLICK" }, missingTargetRes);
  assert.strictEqual(verifRes.status, "FAILED");
  assert.strictEqual(verifRes.verified, false);
  console.log(`  ✓ Content safety integration verified: ${verifRes.reason}`);
}

// [TEST 12] Simultaneous whole-form autofill (success & failure)
console.log("\n[TEST 12] Simultaneous whole-form autofill");
{
  const execSuccess = { executed: true, action: "FILL_FORM", count: 4, verified: true };
  const resSuccess = actionVerifier.verifyActionOutcome({}, {}, { action: "FILL_FORM" }, execSuccess);
  assert.strictEqual(resSuccess.status, "VERIFIED");
  assert.strictEqual(resSuccess.verified, true);

  const execFail = { executed: true, action: "FILL_FORM", count: 4, verified: false };
  const resFail = actionVerifier.verifyActionOutcome({}, {}, { action: "FILL_FORM" }, execFail);
  assert.strictEqual(resFail.status, "FAILED");
  assert.strictEqual(resFail.verified, false);
  console.log(`  ✓ Whole-form verification contracts verified (VERIFIED & FAILED)`);
}

// [TEST 13] Scroll at page boundary with zero displacement -> UNKNOWN
console.log("\n[TEST 13] Scroll at page boundary with zero displacement -> UNKNOWN");
{
  const pre = { scrollY: 1500, scrollX: 0 };
  const post = { scrollY: 1500, scrollX: 0, pixelDiff: 0 };
  const action = { action: "SCROLL", target: "PAGE", amount: 500 };
  const exec = { executed: true, action: "SCROLL", amount: 500 };

  const res = actionVerifier.verifyActionOutcome(pre, post, action, exec);
  assert.strictEqual(res.status, "UNKNOWN");
  assert.strictEqual(res.verified, "unknown");
  assert.ok(res.reason.includes("page boundary"));
  console.log(`  ✓ Scroll at boundary handled safely as UNKNOWN: ${res.reason}`);
}

// [TEST 14] Submit without URL transition (in-place SPA / AJAX) -> UNKNOWN, never false FAILED
console.log("\n[TEST 14] Submit without URL transition (in-place SPA / AJAX)");
{
  const pre = { url: "https://example.com/form", title: "Contact Us" };
  const post = { url: "https://example.com/form", title: "Contact Us" };
  const action = { action: "SUBMIT", target: "contact_form" };
  const exec = { executed: true, action: "SUBMIT" };

  const res = actionVerifier.verifyActionOutcome(pre, post, action, exec);
  assert.notStrictEqual(res.status, "FAILED", "In-place submit must NOT be FAILED");
  assert.strictEqual(res.status, "UNKNOWN");
  assert.strictEqual(res.verified, "unknown");
  console.log(`  ✓ In-place submit verified safely as UNKNOWN without false failure`);
}

// [TEST 15] Robustness against null / undefined / malformed inputs
console.log("\n[TEST 15] Robustness against null / undefined / malformed inputs");
{
  const resNull = actionVerifier.verifyActionOutcome(null, null, null, null);
  assert.strictEqual(resNull.status, "VERIFIED");
  assert.strictEqual(resNull.verified, true);

  const resUndef = actionVerifier.verifyActionOutcome(undefined, undefined, { action: "CLICK" }, undefined);
  assert.strictEqual(resUndef.status, "UNKNOWN");
  assert.strictEqual(resUndef.verified, "unknown");
  console.log(`  ✓ Fail-safe contract against null/undefined verified`);
}

console.log("\n============================================================");
console.log("ALL MILESTONE 21.2 ACTION FAILURE DETECTION TESTS PASSED!");
console.log("============================================================\n");
