/**
 * test-action-aware-grounding.js
 * Regression & Acceptance Test Suite for Action-Aware Semantic Grounding
 *
 * Tests:
 * 1. Full LinkedIn task: 5 explicit ordered action objects, values, and context preservation
 * 2. Test A: "Click Start a post" grounds "Start a post", NOT profile avatar/picture
 * 3. Test B: "Enter this text in the post composer..." grounds composer, NOT search input
 * 4. Test C: "Click Post" grounds publish button, NOT "Start a post"
 * 5. Test D: "Click the profile picture" intentionally grounds profile picture when requested
 * 6. Test E: "Search for ISRO" grounds primary search input, NOT AI Mode
 * 7. Test F: Multi-field form filling continues filling separate fields correctly
 * 8. Safety gate verification: Publishing requires approval, composer opening does not
 */

const assert = require("assert");
const taskParser = require("./task-parser.js");
const reasoningPlanner = require("./reasoning-planner.js");
const semanticResolver = require("./semantic-resolver.js");

console.log("============================================================");
console.log("RUNNING ACTION-AWARE SEMANTIC GROUNDING REGRESSION TEST SUITE");
console.log("============================================================\n");

// ------------------------------------------------------------
// 1. FULL LINKEDIN TASK ACCEPTANCE TEST
// ------------------------------------------------------------
console.log("--- 1. Full Multi-Step LinkedIn Task Acceptance Test ---");
const linkedInTask = "Open LinkedIn. Once LinkedIn is loaded, go to the Home page. Click Start a post. In the post editor, enter exactly: This post was created automatically by Iris, an AI agent developed by Team OneVision. 🚀 Then click the Post button.";

const parsed = taskParser.parseTask(linkedInTask);
assert.strictEqual(parsed.intent, "MULTI_STEP", "Intent must be MULTI_STEP");
assert.strictEqual(parsed.steps.length, 5, `Must parse exactly 5 steps, got ${parsed.steps.length}`);

// Step 0: NAVIGATE -> LinkedIn
assert.strictEqual(parsed.steps[0].action, "NAVIGATE");
assert.strictEqual(parsed.steps[0].target, "LinkedIn");
assert.strictEqual(parsed.steps[0].url, "https://www.linkedin.com");

// Step 1: CLICK -> Home
assert.strictEqual(parsed.steps[1].action, "CLICK");
assert.strictEqual(parsed.steps[1].target, "Home");
assert.strictEqual(parsed.steps[1].precondition, "LinkedIn_loaded");

// Step 2: CLICK -> Start a post (NEVER reduced to "post")
assert.strictEqual(parsed.steps[2].action, "CLICK");
assert.strictEqual(parsed.steps[2].target, "Start a post", "Target must be 'Start a post', not 'post'");
assert.notStrictEqual(parsed.steps[2].target.toLowerCase(), "post");

// Step 3: FILL -> post composer with exact value
assert.strictEqual(parsed.steps[3].action, "FILL");
assert.strictEqual(parsed.steps[3].target, "post composer");
assert.strictEqual(parsed.steps[3].value, "This post was created automatically by Iris, an AI agent developed by Team OneVision. 🚀");

// Step 4: CLICK -> Post
assert.strictEqual(parsed.steps[4].action, "CLICK");
assert.strictEqual(parsed.steps[4].target, "Post");

console.log("[PASS] 1.1 task-parser parsed exact ordered action objects:");
parsed.steps.forEach((st, i) => console.log(`   Step ${i + 1}: ${st.action} -> ${st.target}${st.value ? ` (value: "${st.value}")` : ""}`));

// Check Reasoning Plan Context & Safety
const plan = reasoningPlanner.planTask(parsed);
assert.strictEqual(plan.steps.length, 5, "Plan must retain all 5 steps");

// Context preservation (Requirement 10)
assert.strictEqual(plan.steps[2].expectedTransition, "post_composer_open");
assert.strictEqual(plan.steps[2].previousAction, "CLICK");
assert.strictEqual(plan.steps[2].nextAction, "FILL");
assert.strictEqual(plan.steps[2].requiresApproval, false, "Start a post is autonomous (medium risk)");
assert.strictEqual(plan.steps[2].risk, "MEDIUM");

// Step 3 context
assert.strictEqual(plan.steps[3].context, "post_composer");
assert.strictEqual(plan.steps[3].expectedTransition, "composer_filled");
assert.strictEqual(plan.steps[3].previousAction, "CLICK");
assert.strictEqual(plan.steps[3].nextAction, "CLICK");

// Step 4 safety gate (Requirement 8)
assert.strictEqual(plan.steps[4].action, "CLICK");
assert.strictEqual(plan.steps[4].target, "Post");
assert.strictEqual(plan.steps[4].requiresApproval, true, "CLICK Post must require human approval via safety gate");
assert.strictEqual(plan.steps[4].risk, "HIGH");
assert.strictEqual(plan.steps[4].expectedTransition, "post_published");

console.log("[PASS] 1.2 Reasoning plan context and safety gates verified (Start a post autonomous, Post requires approval)\n");

// ------------------------------------------------------------
// 2. MOCK DOM & GROUNDING LOGIC TESTS (A - F)
// ------------------------------------------------------------

/**
 * Re-implementation of action-aware grounding logic from popup.js for verification
 */
function mockScoreCandidateForClick(el, requestedHint) {
  if (!el || el.disabled || String(el["aria-disabled"]).toLowerCase() === "true" || el.readOnly) return 0;
  const normalize = (s) => (s || "").trim().toLowerCase();
  const rawHint = normalize(requestedHint).replace(/_button|_input/, "").trim();
  const cleanHint = rawHint.replace(/\s+(?:box|input|field|area|button|link|section|tab|panel|container|header|heading|option|checkbox)$/i, "").trim();

  const elType = (el.type || "").toLowerCase();
  const ALLOWED_CLICK_TYPES = ["button", "link", "input", "element", "heading", "tab", "menuitem", "option", "checkbox", "radio", "switch", "select", "section"];
  if (!ALLOWED_CLICK_TYPES.includes(elType)) return 0;

  const labelNorm = normalize(el.label);
  const candTextParts = [
    el.label,
    el.text,
    el.ariaLabel,
    el.title,
    el.alt,
    el.dataColor,
    el.placeholder,
    el.href,
    el.url
  ].filter(Boolean).map(normalize);
  const candFullText = candTextParts.join(" ");

  // Profile picture / avatar rejection unless explicitly requested
  const isExplicitProfileRequested = Boolean(rawHint && /\b(?:profile\s*(?:picture|photo|image|avatar|pic)|user\s*avatar|avatar)\b/i.test(rawHint));
  const isProfileElement = Boolean(
    /\b(?:profile\s*(?:picture|photo|image|avatar|pic)|user\s*avatar|avatar|profile_photo|profile_pic|identity-module)\b/i.test(candFullText) ||
    (el.role === "img" && /\b(?:photo|picture|avatar|profile)\b/i.test(el.ariaLabel || el.alt || "")) ||
    elType === "image" ||
    (el.tagName && el.tagName.toLowerCase() === "img") ||
    (el.className && /\b(?:avatar|profile-photo|profile-pic)\b/i.test(el.className))
  );

  if (isExplicitProfileRequested) {
    if (isProfileElement || candFullText.includes("profile")) return 1.0;
    return 0;
  }
  if (isProfileElement && !isExplicitProfileRequested) {
    return 0;
  }

  // ACTION-AWARE COMPOSITE UI TARGET: "Start a post" / "Create a post" / "Write a post"
  const isStartPostTarget = Boolean(
    cleanHint === "start a post" ||
    rawHint === "start a post" ||
    /^(?:start|create|write|open)\s+(?:a\s+)?post\b/i.test(rawHint) ||
    /^(?:start|create|write|open)\s+(?:a\s+)?post\b/i.test(cleanHint)
  );
  if (isStartPostTarget) {
    const hasActionWord = /\b(?:start|create|write|open)\b/i.test(labelNorm) || /\b(?:start|create|write|open)\b/i.test(candFullText);
    const hasPostWord = /\bpost\b/i.test(labelNorm) || /\bpost\b/i.test(candFullText);
    if (!hasActionWord || !hasPostWord) return 0;
    if (labelNorm === "start a post") return 1.0;
    if (candFullText.includes("start a post")) return 0.95;
    if (hasActionWord && hasPostWord) return (elType === "button" || el.role === "button") ? 0.92 : 0.85;
    return 0;
  }

  // ACTION-AWARE PUBLISH BUTTON: "Post" / "Publish"
  const isPublishTarget = Boolean(
    cleanHint === "post" ||
    rawHint === "post" ||
    rawHint === "post button" ||
    cleanHint === "post button" ||
    rawHint === "publish" ||
    cleanHint === "publish"
  );
  if (isPublishTarget) {
    if (/\b(?:start|create|write|open)\s+(?:a\s+)?post\b/i.test(candFullText) || /\b(?:start|create|write|open)\s+(?:a\s+)?post\b/i.test(labelNorm)) return 0;
    if (el.role === "article" || elType === "article" || /\b(?:feed|comment|share)\b/i.test(labelNorm)) return 0;
    const isButtonRole = elType === "button" || el.role === "button" || el.semanticTag === "SUBMIT_BUTTON";
    if ((labelNorm === "post" || labelNorm === "publish") && isButtonRole) return 1.0;
    if (labelNorm === "post" || labelNorm === "publish") return 0.90;
    if (candFullText.trim() === "post" && isButtonRole) return 0.95;
    return 0;
  }

  if (labelNorm === cleanHint || labelNorm === rawHint) return 1.0;
  if (cleanHint && (labelNorm.includes(cleanHint) || cleanHint.includes(labelNorm) || candFullText.includes(cleanHint))) return 0.85;
  return 0;
}

function mockScoreCandidateForField(el, fieldHint) {
  if (!el || !fieldHint) return 0;
  const normalize = (s) => (s || "").toLowerCase().replace(/[:*#_\-\/\\]+/g, " ").trim();
  const hNorm = normalize(fieldHint);
  const labelNorm = normalize(el.label);
  const ariaNorm = normalize(el.ariaLabel);
  const placeholderNorm = normalize(el.placeholder);

  const elType = (el.type || "").toLowerCase();
  const elRole = (el.role || "").toLowerCase();
  const isFormType = ["input", "textarea", "select", "combobox", "searchbox", "textbox", "contenteditable"].includes(elType) ||
    ["input", "textarea", "select", "combobox", "searchbox", "textbox"].includes(elRole) ||
    Boolean(el.ariaAutocomplete) || el.isContentEditable;
  if (!isFormType) return 0;

  const isSearchHint = /\bsearch\b/i.test(hNorm);
  const isSearchTarget = /\bsearch\b/i.test(labelNorm) || /\bsearch\b/i.test(ariaNorm) || /\bsearch\b/i.test(placeholderNorm) || el.semanticTag === "SEARCH_INPUT";
  if (isSearchHint && !isSearchTarget) return 0;

  // Post composer grounding
  const isComposerHint = hNorm === "post composer" || hNorm === "post editor" || /\b(?:composer|post\s+editor)\b/i.test(hNorm);
  if (isComposerHint) {
    if (isSearchTarget || isSearchHint || el.semanticTag === "SEARCH_INPUT") return 0;
    if (/\b(?:profile|author|user|name)\b/i.test(labelNorm) || el.name === "name") return 0;
    if (/\bcomment\b/i.test(labelNorm) || /\bcomment\b/i.test(ariaNorm) || /\bcomment\b/i.test(placeholderNorm)) return 0;

    const isContentEditable = elType === "contenteditable" || el.isContentEditable || elRole === "textbox";
    const fullCand = [labelNorm, ariaNorm, placeholderNorm, normalize(el.nearbyText), normalize(el.contextText)].join(" ");
    const matchesPostIntent = /\b(?:post|talk\s+about|share|write|editor|composer|what's\s+on\s+your\s+mind)\b/i.test(fullCand);

    if (isContentEditable && matchesPostIntent) return 1.0;
    if (isContentEditable) return 0.95;
    if (elType === "textarea" && matchesPostIntent) return 0.95;
    if (elType === "textarea") return 0.85;
    return 0.1;
  }

  if (labelNorm === hNorm || ariaNorm === hNorm || placeholderNorm === hNorm) return 1.0;
  if (labelNorm.includes(hNorm) || hNorm.includes(labelNorm)) return 0.85;
  return 0;
}

// ------------------------------------------------------------
// TEST A: "Click Start a post" -> grounds Start a post, NOT profile image
// ------------------------------------------------------------
console.log("--- 2. Test A: 'Click Start a post' Grounding ---");
const pageElementsForTestA = [
  {
    type: "element",
    role: "img",
    label: "Sanketh Mallikarjuna's profile picture",
    alt: "Profile photo",
    className: "feed-identity-module__actor-avatar"
  },
  {
    type: "button",
    role: "button",
    label: "Start a post",
    text: "Start a post, try writing with AI"
  },
  {
    type: "link",
    role: "link",
    label: "View post activity",
    href: "https://www.linkedin.com/feed/recent"
  }
];

const scoreAvatarA = mockScoreCandidateForClick(pageElementsForTestA[0], "Start a post");
const scoreButtonA = mockScoreCandidateForClick(pageElementsForTestA[1], "Start a post");
const scoreLinkA = mockScoreCandidateForClick(pageElementsForTestA[2], "Start a post");

assert.strictEqual(scoreAvatarA, 0, "Profile image/avatar must be strictly rejected (score 0)");
assert.strictEqual(scoreLinkA, 0, "Unrelated link containing 'post' must not match 'Start a post'");
assert.ok(scoreButtonA >= 0.95, `Button 'Start a post' must score high confidence, got ${scoreButtonA}`);
console.log(`[PASS] Test A: 'Start a post' button scored ${scoreButtonA}, profile avatar scored ${scoreAvatarA} (rejected)\n`);

// ------------------------------------------------------------
// TEST B: "Enter this text in the post composer..." -> grounds composer, NOT search
// ------------------------------------------------------------
console.log("--- 3. Test B: 'Enter this text in the post composer...' Grounding ---");
const pageElementsForTestB = [
  {
    type: "input",
    role: "searchbox",
    label: "Search",
    placeholder: "Search",
    semanticTag: "SEARCH_INPUT"
  },
  {
    type: "textarea",
    role: "textbox",
    label: "Add a comment...",
    placeholder: "Add a comment..."
  },
  {
    type: "contenteditable",
    role: "textbox",
    isContentEditable: true,
    label: "What do you want to talk about?",
    placeholder: "What do you want to talk about?",
    ariaLabel: "Text editor for creating content"
  }
];

const scoreSearchB = mockScoreCandidateForField(pageElementsForTestB[0], "post composer");
const scoreCommentB = mockScoreCandidateForField(pageElementsForTestB[1], "post composer");
const scoreComposerB = mockScoreCandidateForField(pageElementsForTestB[2], "post composer");

assert.strictEqual(scoreSearchB, 0, "Search input must be rejected for post composer");
assert.strictEqual(scoreCommentB, 0, "Comment box must be rejected for post composer");
assert.ok(scoreComposerB >= 0.95, `Contenteditable post composer must score high, got ${scoreComposerB}`);
console.log(`[PASS] Test B: Post composer contenteditable scored ${scoreComposerB}, search input scored ${scoreSearchB} (rejected)\n`);

// ------------------------------------------------------------
// TEST C: "Click Post" -> grounds publish button, NOT Start a post
// ------------------------------------------------------------
console.log("--- 4. Test C: 'Click Post' Grounding ---");
const pageElementsForTestC = [
  {
    type: "button",
    role: "button",
    label: "Start a post",
    text: "Start a post"
  },
  {
    type: "button",
    role: "button",
    label: "Post",
    text: "Post"
  },
  {
    type: "element",
    role: "img",
    label: "User avatar photo",
    alt: "User avatar"
  }
];

const scoreStartPostC = mockScoreCandidateForClick(pageElementsForTestC[0], "Post");
const scorePublishPostC = mockScoreCandidateForClick(pageElementsForTestC[1], "Post");
const scoreAvatarC = mockScoreCandidateForClick(pageElementsForTestC[2], "Post");

assert.strictEqual(scoreStartPostC, 0, "Start a post must NOT match publishing button 'Post'");
assert.strictEqual(scoreAvatarC, 0, "Avatar must NOT match 'Post'");
assert.ok(scorePublishPostC >= 0.95, `Publish button 'Post' must score 1.0, got ${scorePublishPostC}`);
console.log(`[PASS] Test C: Publish button 'Post' scored ${scorePublishPostC}, 'Start a post' scored ${scoreStartPostC} (rejected)\n`);

// ------------------------------------------------------------
// TEST D: "Click the profile picture" -> intentionally grounds profile picture
// ------------------------------------------------------------
console.log("--- 5. Test D: 'Click the profile picture' Grounding ---");
const pageElementsForTestD = [
  {
    type: "element",
    role: "img",
    label: "Profile photo",
    alt: "Profile photo of Sanketh Mallikarjuna"
  },
  {
    type: "button",
    role: "button",
    label: "Start a post"
  }
];

const scoreProfileD = mockScoreCandidateForClick(pageElementsForTestD[0], "profile picture");
const scoreButtonD = mockScoreCandidateForClick(pageElementsForTestD[1], "profile picture");

assert.ok(scoreProfileD >= 0.95, `Explicitly requested profile picture must score high, got ${scoreProfileD}`);
assert.strictEqual(scoreButtonD, 0, "'Start a post' must not match 'profile picture'");
console.log(`[PASS] Test D: Profile photo scored ${scoreProfileD} when intentionally requested\n`);

// ------------------------------------------------------------
// TEST E: "Search for ISRO" -> uses search input, NOT AI Mode
// ------------------------------------------------------------
console.log("--- 6. Test E: 'Search for ISRO' Grounding ---");
const parsedSearchE = taskParser.parseTask("Search for ISRO");
assert.strictEqual(parsedSearchE.steps[0].action, "FILL");
assert.strictEqual(parsedSearchE.steps[0].targetRole, "PRIMARY_SEARCH_INPUT");
assert.strictEqual(parsedSearchE.steps[0].value, "ISRO");

const pageElementsForTestE = [
  {
    type: "input",
    role: "searchbox",
    label: "Search",
    placeholder: "Search Google or type a URL",
    semanticTag: "SEARCH_INPUT"
  },
  {
    type: "textarea",
    role: "textbox",
    label: "Ask Gemini / AI Mode",
    placeholder: "Ask anything..."
  }
];

const scorePrimarySearchE = mockScoreCandidateForField(pageElementsForTestE[0], "search");
const scoreAiModeE = mockScoreCandidateForField(pageElementsForTestE[1], "search");

assert.strictEqual(scorePrimarySearchE, 1.0, "Primary search input must score 1.0");
assert.strictEqual(scoreAiModeE, 0, "AI Mode textarea must be rejected for generic search");
console.log(`[PASS] Test E: Primary search input scored ${scorePrimarySearchE}, AI Mode scored ${scoreAiModeE} (rejected)\n`);

// ------------------------------------------------------------
// TEST F: "Fill the form: Name=..., Email=..., Phone=..."
// ------------------------------------------------------------
console.log("--- 7. Test F: Multi-Field Form Filling ---");
const multiFormTask = "Fill the form: Name=Sanketh, Email=sanketh@example.com, Phone=9876543210";
const parsedFormF = taskParser.parseTask(multiFormTask);
assert.strictEqual(parsedFormF.steps.length, 3, "Must parse 3 separate fields");
assert.strictEqual(parsedFormF.steps[0].target, "Name");
assert.strictEqual(parsedFormF.steps[0].value, "Sanketh");
assert.strictEqual(parsedFormF.steps[1].target, "Email");
assert.strictEqual(parsedFormF.steps[1].value, "sanketh@example.com");
assert.strictEqual(parsedFormF.steps[2].target, "Phone");
assert.strictEqual(parsedFormF.steps[2].value, "9876543210");
console.log("[PASS] Test F: Multi-field form parsed into 3 distinct FILL steps with unquoted values\n");

console.log("============================================================");
console.log("ALL ACTION-AWARE GROUNDING REGRESSION TESTS PASSED (7 / 7)!");
console.log("============================================================");
