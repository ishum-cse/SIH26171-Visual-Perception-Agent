/**
 * test-sidepanel-integration.js
 * Verification suite for Chrome Side Panel Migration (Milestone 24)
 *
 * Verifies:
 * 1. Manifest V3 sidePanel permissions and configuration
 * 2. Background service worker side panel behavior registration
 * 3. Side Panel HTML structure, responsive styling, and script loading order
 * 4. Single Source of Truth architecture (popup.js reused across containers)
 * 5. Preservation of all core agent workflows (YouTube, Gmail, Amazon, PII redaction)
 */

const fs = require('fs');
const assert = require('assert');

console.log("============================================================");
console.log("RUNNING CHROME SIDE PANEL MIGRATION VERIFICATION SUITE");
console.log("============================================================");

// [TEST 1] Manifest V3 Side Panel Configuration
console.log("\n[TEST 1] Verifying manifest.json sidePanel configuration");
const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));

assert.ok(manifest.permissions.includes('sidePanel'), "manifest.permissions must include 'sidePanel'");
console.log("  ✓ manifest.permissions includes 'sidePanel'");

assert.strictEqual(typeof manifest.side_panel, 'object', "manifest.side_panel must be defined");
assert.strictEqual(manifest.side_panel.default_path, 'sidepanel.html', "manifest.side_panel.default_path must be 'sidepanel.html'");
console.log("  ✓ manifest.side_panel.default_path correctly configured to 'sidepanel.html'");

assert.strictEqual(typeof manifest.action, 'object', "manifest.action must be defined");
assert.strictEqual(manifest.action.default_popup, undefined, "manifest.action.default_popup should be omitted to allow openPanelOnActionClick");
console.log("  ✓ manifest.action configured for side panel activation without blocking popup");

// [TEST 2] Background Service Worker Configuration
console.log("\n[TEST 2] Verifying background.js sidePanel behavior");
const backgroundJs = fs.readFileSync('background.js', 'utf8');

assert.ok(backgroundJs.includes('setPanelBehavior'), "background.js must invoke setPanelBehavior");
assert.ok(backgroundJs.includes('openPanelOnActionClick: true'), "background.js must set openPanelOnActionClick: true");
console.log("  ✓ background.js sets openPanelOnActionClick: true for automatic side panel launch on toolbar click");

assert.ok(backgroundJs.includes('captureScreenshot'), "background.js must preserve captureScreenshot message handler");
console.log("  ✓ background.js preserves screenshot capture handler");

// [TEST 3] Side Panel HTML Structure and Responsive Layout
console.log("\n[TEST 3] Verifying sidepanel.html assets and structure");
assert.ok(fs.existsSync('sidepanel.html'), "sidepanel.html must exist in extension root");
assert.ok(fs.existsSync('sidepanel.js'), "sidepanel.js must exist in extension root");

const sidepanelHtml = fs.readFileSync('sidepanel.html', 'utf8');

// Verify responsive body layout
assert.ok(sidepanelHtml.includes('width: 100%') || sidepanelHtml.includes('min-width: 280px'), "sidepanel.html must have responsive width styling");
assert.ok(sidepanelHtml.includes('min-height: 100vh'), "sidepanel.html must have full-height viewport styling");
console.log("  ✓ sidepanel.html includes responsive width and 100vh height styling");

// Verify essential UI elements
const requiredElementIds = [
  "taskInput", "runAgentTaskBtn", "voiceMicBtn", "liveAgentStatusBadge",
  "pipelineStepCounter", "stagePerception", "stageReasoning", "stageGrounding",
  "stageSafety", "stageExecution", "stageVerification", "currentActionStepBadge",
  "cardActionType", "cardActionTarget", "inspectGroundingConfidenceBadge",
  "previewScreenshotStatus", "previewSensitiveCount", "agentTraceContainer",
  "fusionContainer", "privacyDetails", "screenshotPreview", "sanitizedScreenshotPreview"
];
for (const id of requiredElementIds) {
  assert.ok(sidepanelHtml.includes(`id="${id}"`), `sidepanel.html must contain element #${id}`);
}
console.log(`  ✓ All ${requiredElementIds.length} core UI & telemetry elements present in sidepanel.html`);

// [TEST 4] Single Source of Truth Assertion
console.log("\n[TEST 4] Verifying Single Source of Truth architecture");
assert.ok(sidepanelHtml.includes('src="popup.js"'), "sidepanel.html must load popup.js directly");
assert.ok(sidepanelHtml.includes('src="sidepanel.js"'), "sidepanel.html must load sidepanel.js");
console.log("  ✓ sidepanel.html reuses popup.js as the single source of truth for agent execution");

// [TEST 5] Workflows Preservation Check
console.log("\n[TEST 5] Verifying existing core workflows preservation");
const taskParser = require('./task-parser.js');
const reasoningPlanner = require('./reasoning-planner.js');
const piiDetector = require('./pii-detector.js');

// TEST 5.1: "Open YouTube and search for DSA in Java"
const ytTask = "Open YouTube and search for DSA in Java.";
const ytParsed = taskParser.parseTask(ytTask);
assert.strictEqual(ytParsed.intent, "MULTI_STEP");
assert.strictEqual(ytParsed.steps[0].type, "NAVIGATE");
assert.strictEqual(ytParsed.steps[0].target, "YouTube");
assert.strictEqual(ytParsed.steps[1].type, "FILL");
assert.strictEqual(ytParsed.steps[1].value, "DSA in Java");
console.log("  ✓ TEST 1 (YouTube): NAVIGATE YouTube -> SEARCH 'DSA in Java' preserved");

// TEST 5.2: Gmail multi-step task (To, Subject, Message Body)
const gmailTask = "Open Gmail, compose an email to test@example.com, set the subject to SIH Final Test, and write Hello in the message.";
const gmailParsed = taskParser.parseTask(gmailTask);
assert.strictEqual(gmailParsed.steps[0].type, "NAVIGATE");
assert.strictEqual(gmailParsed.steps[0].target, "Gmail");
assert.strictEqual(gmailParsed.steps[1].type, "CLICK");
assert.strictEqual(gmailParsed.steps[1].targetHint, "compose");
assert.strictEqual(gmailParsed.steps[2].type, "FILL");
assert.strictEqual(gmailParsed.steps[2].fieldHint, "recipient");
assert.strictEqual(gmailParsed.steps[2].value, "test@example.com");
assert.strictEqual(gmailParsed.steps[3].type, "FILL");
assert.strictEqual(gmailParsed.steps[3].fieldHint, "subject");
assert.strictEqual(gmailParsed.steps[3].value, "SIH Final Test");
assert.strictEqual(gmailParsed.steps[4].type, "FILL");
assert.strictEqual(gmailParsed.steps[4].fieldHint, "message");
assert.strictEqual(gmailParsed.steps[4].value, "Hello");
console.log("  ✓ TEST 2 (Gmail): NAVIGATE Gmail -> COMPOSE -> To -> Subject -> Message Body preserved");

// TEST 5.3: Amazon natural-language task
const amazonTask = "Open Amazon and search for wireless headphones.";
const amazonParsed = taskParser.parseTask(amazonTask);
assert.strictEqual(amazonParsed.intent, "MULTI_STEP");
assert.strictEqual(amazonParsed.steps[0].type, "NAVIGATE");
assert.strictEqual(amazonParsed.steps[0].target, "Amazon");
assert.strictEqual(amazonParsed.steps[1].type, "FILL");
assert.strictEqual(amazonParsed.steps[1].value, "wireless headphones");
console.log("  ✓ TEST 3 (Amazon): NAVIGATE Amazon -> SEARCH 'wireless headphones' preserved");

// TEST 5.4: Local PII Redaction
const sensitiveSample = "Contact user at john.doe@example.com with phone 123-456-7890 and password SecretPass123";
const redacted = piiDetector.redactText(sensitiveSample);
assert.ok(redacted.includes("[REDACTED_EMAIL]"), "PII detector must redact email");
assert.ok(redacted.includes("[REDACTED_PHONE]"), "PII detector must redact phone number");
console.log("  ✓ TEST 4 (PII Redaction): Local PII detection identified and redacted sensitive email/phone patterns");

console.log("\n============================================================");
console.log("ALL CHROME SIDE PANEL MIGRATION VERIFICATION TESTS PASSED!");
console.log("============================================================");
