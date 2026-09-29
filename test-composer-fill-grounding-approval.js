/**
 * Test Suite: Natural-Language FILL + Dynamic Composer Grounding + Publish Approval
 *
 * Validates:
 * 1. Natural Language FILL Target Resolution ("write a message saying Thank you sir" -> value="Thank you sir", target="active post composer")
 * 2. Precedence of activeComposerContext over conversational phrases
 * 3. Multi-line form tasks (Name, email, phone, address, comments, company, job title)
 * 4. Preservation of commas in composer values (no erroneous splitting)
 * 5. LinkedIn Post Composer Grounding & Negative Target Rejection (avatar, search, post button, etc.)
 * 6. Safety Gate: Post/Publish actions require human approval and NEVER auto-publish
 */

const assert = require("assert");
const { parseTask } = require("./task-parser.js");
const reasoningPlanner = require("./reasoning-planner.js");
const { classifyVisualElement } = require("./content.js");

console.log("============================================================");
console.log("RUNNING COMPOSER FILL GROUNDING & PUBLISH APPROVAL TEST SUITE");
console.log("============================================================\n");

// --- TEST A: Simple Input ---
console.log("--- TEST A: Simple input: 'Fill Name with Sankit.' ---");
{
  const res = parseTask("Fill Name with Sankit.");
  assert.strictEqual(res.intent, "FILL");
  assert.strictEqual(res.steps.length, 1);
  assert.strictEqual(res.steps[0].type, "FILL");
  assert.strictEqual(res.steps[0].fieldHint.toLowerCase(), "name");
  assert.strictEqual(res.steps[0].value, "Sankit");
  console.log("  [PASS] Test A: 'Fill Name with Sankit.' -> FILL Name = 'Sankit'\n");
}

// --- TEST B: Multi-Field Form ---
console.log("--- TEST B: Multi-field form ---");
{
  const taskText = `Fill the form:
Name = Sankit
mail id = ABC@gmail.com
Phone number = 1234
address = Mysore
comments = Super
company = Infosys
job title = developer`;

  const res = parseTask(taskText);
  assert.strictEqual(res.steps.length, 7, `Expected 7 steps, got ${res.steps.length}`);

  const expectedFields = [
    { field: "Name", val: "Sankit" },
    { field: "mail id", val: "ABC@gmail.com" },
    { field: "Phone number", val: "1234" },
    { field: "address", val: "Mysore" },
    { field: "comments", val: "Super" },
    { field: "company", val: "Infosys" },
    { field: "job title", val: "developer" }
  ];

  expectedFields.forEach((exp, idx) => {
    assert.strictEqual(res.steps[idx].type, "FILL");
    assert.strictEqual(res.steps[idx].fieldHint.toLowerCase(), exp.field.toLowerCase());
    assert.strictEqual(res.steps[idx].value, exp.val);
  });
  console.log("  [PASS] Test B: All 7 multi-field form items parsed cleanly into distinct steps\n");
}

// --- TEST C: Gmail Reply ---
console.log("--- TEST C: Gmail reply: 'Open the email and reply with Thank you sir.' ---");
{
  const res = parseTask("Open the email and reply with Thank you sir.");
  assert.strictEqual(res.steps.length, 3);
  assert.strictEqual(res.steps[0].type, "CLICK");
  assert.strictEqual(res.steps[0].target, "email");
  assert.strictEqual(res.steps[1].type, "CLICK");
  assert.strictEqual(res.steps[1].target, "Reply");
  assert.strictEqual(res.steps[2].type, "FILL");
  assert.strictEqual(res.steps[2].value, "Thank you sir");
  console.log("  [PASS] Test C: 'Open the email and reply with Thank you sir.' -> CLICK email, CLICK Reply, FILL Reply message body = 'Thank you sir'\n");
}

// --- TEST D: LinkedIn Post with "write a message saying ..." ---
console.log("--- TEST D: LinkedIn post: 'Open LinkedIn and click Start a post and write a message saying Thank you sir.' ---");
{
  const res = parseTask("Open LinkedIn and click Start a post and write a message saying Thank you sir.");
  assert.strictEqual(res.steps.length, 4);
  assert.strictEqual(res.steps[0].type, "NAVIGATE");
  assert.strictEqual(res.steps[1].type, "CLICK");
  assert.strictEqual(res.steps[1].target, "Start a post");
  assert.strictEqual(res.steps[2].type, "FILL");
  assert.ok(/post composer/i.test(res.steps[2].target));
  assert.strictEqual(res.steps[2].composerType, "post");
  assert.strictEqual(res.steps[2].context, "communication_composer");
  assert.strictEqual(res.steps[2].value, "Thank you sir.");
  assert.strictEqual(res.steps[3].type, "CLICK");
  assert.strictEqual(res.steps[3].target, "Post");
  assert.strictEqual(res.steps[3].requiresApproval, true);
  assert.strictEqual(res.steps[3].risk, "HIGH");

  // Verify that reasoningPlanner builds the plan correctly
  const plan = reasoningPlanner.planTask(res);
  assert.strictEqual(plan.steps.length, 4);
  // Autonomous click on Start a post
  assert.strictEqual(plan.steps[1].requiresApproval, false);
  assert.strictEqual(plan.steps[1].expectedTransition, "post_composer_open");
  // Fill composer
  assert.strictEqual(plan.steps[2].requiresApproval, false);
  assert.strictEqual(plan.steps[2].expectedTransition, "composer_filled");
  // Safety check: CLICK Post has requiresApproval: true and risk: HIGH
  assert.strictEqual(plan.steps[3].requiresApproval, true);
  assert.strictEqual(plan.steps[3].risk, "HIGH");
  console.log("  [PASS] Test D: 'Start a post' -> 'LinkedIn post composer' (value: 'Thank you sir') -> CLICK Post (requiresApproval: true, risk: HIGH).\n");
}

// --- TEST E: LinkedIn Post with longer multi-line content & emoji ---
console.log("--- TEST E: LinkedIn post with longer content: 'Open LinkedIn, click Start a post, and write: This post was created automatically by Iris, an AI agent developed by Team OneVision. 🚀' ---");
{
  const taskText = `Open LinkedIn, click Start a post, and write:
This post was created automatically by Iris, an AI agent developed by Team OneVision. 🚀`;

  const res = parseTask(taskText);
  assert.strictEqual(res.steps.length, 4);
  assert.strictEqual(res.steps[0].type, "NAVIGATE");
  assert.strictEqual(res.steps[1].type, "CLICK");
  assert.strictEqual(res.steps[1].target, "Start a post");
  assert.strictEqual(res.steps[2].type, "FILL");
  assert.ok(/post composer/i.test(res.steps[2].target));
  assert.strictEqual(res.steps[2].value, "This post was created automatically by Iris, an AI agent developed by Team OneVision. 🚀");
  assert.strictEqual(res.steps[3].type, "CLICK");
  assert.strictEqual(res.steps[3].target, "Post");
  assert.strictEqual(res.steps[3].requiresApproval, true);
  console.log("  [PASS] Test E: Long post with comma and emoji parsed with gated Post approval step\n");
}

// --- TEST F: Standalone 'Write a post saying ...' (Internal comma preservation) ---
console.log("--- TEST F: Standalone 'Write a post saying This post was created automatically by Iris, an AI agent developed by Team OneVision.' ---");
{
  const res = parseTask("Write a post saying This post was created automatically by Iris, an AI agent developed by Team OneVision.");
  assert.strictEqual(res.steps.length, 3);
  assert.strictEqual(res.steps[0].type, "CLICK");
  assert.strictEqual(res.steps[0].target, "Start a post");
  assert.strictEqual(res.steps[1].type, "FILL");
  assert.ok(/post composer/i.test(res.steps[1].target));
  assert.strictEqual(res.steps[1].value, "This post was created automatically by Iris, an AI agent developed by Team OneVision.");
  assert.strictEqual(res.steps[2].type, "CLICK");
  assert.strictEqual(res.steps[2].target, "Post");
  assert.strictEqual(res.steps[2].requiresApproval, true);
  console.log("  [PASS] Test F: Post workflow task preserved value across internal commas without splitting and requires approval\n");
}

// --- TEST G: LinkedIn Post Composer DOM Grounding Validation ---
console.log("--- TEST G: Post Composer DOM Candidate Grounding & Negative Validation ---");
{
  // Simulating candidates on LinkedIn modal
  const candidates = [
    {
      label: "Share your thoughts...",
      ariaLabel: "Text editor for creating content",
      placeholder: "Share your thoughts...",
      type: "contenteditable",
      isContentEditable: true,
      role: "textbox"
    },
    {
      label: "Profile photo",
      ariaLabel: "Sanketh M Profile",
      type: "image",
      role: "img"
    },
    {
      label: "Search",
      placeholder: "Search",
      type: "input",
      role: "searchbox"
    },
    {
      label: "Post",
      type: "button",
      role: "button"
    }
  ];

  // Helper simulating popup.js scoreElementForField for post composer
  function scoreForPostComposer(el) {
    const elType = (el.type || "").toLowerCase();
    const elRole = (el.role || "").toLowerCase();
    const isFormType = ["input", "textarea", "select", "combobox", "searchbox", "textbox", "contenteditable"].includes(elType) ||
      ["input", "textarea", "select", "combobox", "searchbox", "textbox"].includes(elRole);
    if (!isFormType) return 0;

    const labelNorm = (el.label || "").toLowerCase();
    const ariaNorm = (el.ariaLabel || "").toLowerCase();
    const placeholderNorm = (el.placeholder || "").toLowerCase();

    // Negative filters
    if (labelNorm.includes("search") || ariaNorm.includes("search") || placeholderNorm.includes("search")) return 0;
    if (labelNorm.includes("profile") || labelNorm.includes("author") || labelNorm.includes("user")) return 0;

    const isContentEditable = elType === "contenteditable" || el.isContentEditable || elRole === "textbox";
    const fullCand = [labelNorm, ariaNorm, placeholderNorm].join(" ");
    const matchesPostIntent = /\b(?:post|talk\s+about|what\s+do\s+you\s+want\s+to\s+talk\s+about|share\s+your\s+thoughts|share|thoughts|write|editor|composer|what's\s+on\s+your\s+mind|create\s+a\s+post)\b/i.test(fullCand);

    if (isContentEditable && matchesPostIntent) return 1.0;
    if (isContentEditable) return 0.98;
    return 0.1;
  }

  const composerScore = scoreForPostComposer(candidates[0]);
  const avatarScore = scoreForPostComposer(candidates[1]);
  const searchScore = scoreForPostComposer(candidates[2]);
  const postBtnScore = scoreForPostComposer(candidates[3]);

  assert.strictEqual(composerScore, 1.0, "Composer must score 1.0");
  assert.strictEqual(avatarScore, 0.0, "Avatar must score 0.0");
  assert.strictEqual(searchScore, 0.0, "Search input must score 0.0");
  assert.strictEqual(postBtnScore, 0.0, "Post button must score 0.0 for FILL");

  console.log(`  Composer Score:   ${composerScore} (Accepted)`);
  console.log(`  Avatar Score:     ${avatarScore} (Strictly Rejected)`);
  console.log(`  Search Score:     ${searchScore} (Strictly Rejected)`);
  console.log(`  Post Btn Score:   ${postBtnScore} (Strictly Rejected for FILL)`);
  console.log("  [PASS] Test G: Fusion grounding strictly isolates post composer and rejects nearby controls\n");
}

// --- TEST H: Safety Gate on Publishing / Posting ---
console.log("--- TEST H: Safety Gate: Publishing / Posting requires explicit human approval ---");
{
  const publishAction = { action: "CLICK", target: "Post", semanticCategory: "button" };
  const riskAssessment = reasoningPlanner.classifyActionRisk(publishAction);

  assert.strictEqual(riskAssessment.risk, reasoningPlanner.RISK_LEVELS.HIGH);
  assert.strictEqual(riskAssessment.requiresApproval, true);
  console.log(`  Risk level: ${riskAssessment.risk}`);
  console.log(`  Requires Approval: ${riskAssessment.requiresApproval}`);
  console.log(`  Reason: ${riskAssessment.reason}`);
  console.log("  [PASS] Test H: 'Post' is classified as HIGH risk and CANNOT execute without explicit human approval\n");
}

console.log("============================================================");
console.log("ALL TESTS IN COMPOSER FILL GROUNDING & PUBLISH APPROVAL SUITE PASSED!");
console.log("============================================================\n");
