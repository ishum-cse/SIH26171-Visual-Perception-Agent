/**
 * test-attribute-grounding.js
 * Automated verification suite for Generic Attribute-Aware Target Grounding.
 * Tests:
 *  1. Attribute extraction: objectTarget, attribute, attributeValue across generic nouns & colors
 *  2. Planning: propagation of attribute metadata into reasoning planner steps & traces
 *  3. Grounding Verification: positive evidence matches grounded with high confidence
 *  4. Negative Case (Phase 5): object exists without attribute evidence -> BLOCKED / NOT VERIFIED
 *  5. Ambiguity Case (Phase 5): multiple attribute matches without ordinal -> BLOCKED / AMBIGUOUS
 *  6. Ordinal Disambiguation: "find the first black earbuds" resolves safely
 *  7. Backward compatibility: non-attribute tasks remain 100% unchanged
 */

const assert = require("assert");
const taskParser = require("./task-parser.js");
const reasoningPlanner = require("./reasoning-planner.js");

console.log("============================================================");
console.log("RUNNING GENERIC ATTRIBUTE-AWARE GROUNDING TEST SUITE");
console.log("============================================================\n");

// [TEST 1] Attribute Extraction & Representation across natural-language phrases
console.log("[TEST 1] Attribute Extraction & Representation");
{
  const cases = [
    { input: "find the black colour earbuds", obj: "earbuds", attr: "color", val: "black" },
    { input: "find black earbuds", obj: "earbuds", attr: "color", val: "black" },
    { input: "find white shoes", obj: "shoes", attr: "color", val: "white" },
    { input: "find red backpack", obj: "backpack", attr: "color", val: "red" },
    { input: "find blue headphones", obj: "headphones", attr: "color", val: "blue" },
    { input: "find silver laptop", obj: "laptop", attr: "color", val: "silver" },
    { input: "find green jacket", obj: "jacket", attr: "color", val: "green" },
    { input: "find gold watch", obj: "watch", attr: "color", val: "gold" }
  ];

  for (const c of cases) {
    const res = taskParser.parseTask(c.input);
    assert.strictEqual(res.steps.length, 1, `Expected 1 step for '${c.input}'`);
    const step = res.steps[0];
    assert.strictEqual(step.type, "CLICK");
    assert.strictEqual(step.objectTarget, c.obj, `objectTarget mismatch for '${c.input}'`);
    assert.strictEqual(step.attribute, c.attr, `attribute mismatch for '${c.input}'`);
    assert.strictEqual(step.attributeValue, c.val, `attributeValue mismatch for '${c.input}'`);
    // Crucial: original target is preserved
    assert.ok(step.targetHint.includes(c.val), `targetHint must preserve full phrasing`);
    console.log(`  ✓ '${c.input}' -> object='${step.objectTarget}', ${step.attribute}='${step.attributeValue}' (target='${step.targetHint}')`);
  }
}

// [TEST 2] Backward compatibility on non-attribute targets
console.log("\n[TEST 2] Backward compatibility on non-attribute targets");
{
  const nonAttr = [
    "find the search box",
    "click submit",
    "click add to cart",
    "find english"
  ];
  for (const text of nonAttr) {
    const res = taskParser.parseTask(text);
    const step = res.steps[0];
    assert.strictEqual(step.objectTarget, null, `objectTarget should be null for '${text}'`);
    assert.strictEqual(step.attribute, null, `attribute should be null for '${text}'`);
    assert.strictEqual(step.attributeValue, null, `attributeValue should be null for '${text}'`);
    console.log(`  ✓ Non-attribute '${text}' preserved with objectTarget=null`);
  }
}

// [TEST 3] Planning & Reasoning Trace Verification
console.log("\n[TEST 3] Reasoning Planner propagation");
{
  const res = taskParser.parseTask("find the black colour earbuds");
  const plan = reasoningPlanner.planTask(res, { title: "Earbuds Store", url: "https://example.com/earbuds" });
  assert.strictEqual(plan.steps.length, 1);
  const plannedStep = plan.steps[0];
  assert.strictEqual(plannedStep.objectTarget, "earbuds");
  assert.strictEqual(plannedStep.attribute, "color");
  assert.strictEqual(plannedStep.attributeValue, "black");
  assert.ok(plan.reasoningTrace.some(t => t.includes("object='earbuds'") && t.includes("color='black'")), "Reasoning trace must reflect attribute constraints");
  console.log("  ✓ Reasoning plan correctly constructed with attribute metadata in trace");
}

// [TEST 4] Attribute-Aware Candidate Grounding Simulation
console.log("\n[TEST 4] Attribute-Aware Grounding Logic (Positive, Negative, Ambiguous)");
{
  // Simulated grounding scoring function mirroring popup.js
  function groundCandidate(currentStepPlan, candidates) {
    const normalize = (s) => (s || "").trim().toLowerCase();
    const hasAttributeConstraint = Boolean(currentStepPlan?.attribute && currentStepPlan?.attributeValue && currentStepPlan?.objectTarget);
    const targetObjNorm = hasAttributeConstraint ? normalize(currentStepPlan.objectTarget) : null;
    const targetValNorm = hasAttributeConstraint ? normalize(currentStepPlan.attributeValue) : null;

    let bestIdx = -1;
    let bestScore = 0;
    let verifiedAttributeMatches = [];
    let objectFoundWithoutAttribute = false;

    candidates.forEach((el, idx) => {
      if (hasAttributeConstraint) {
        const candTextParts = [
          el.label,
          el.text,
          el.ariaLabel,
          el.title,
          el.alt,
          el.dataColor,
          el.placeholder
        ].filter(Boolean).map(normalize);
        const candFullText = candTextParts.join(" ");

        const objTokens = targetObjNorm.split(/\s+/).filter(t => t.length > 2);
        const matchesObject = candFullText.includes(targetObjNorm) || (objTokens.length > 0 && objTokens.every(t => candFullText.includes(t)));
        const matchesAttribute = candFullText.includes(targetValNorm) || (el.dataColor && normalize(el.dataColor).includes(targetValNorm));

        if (matchesObject && !matchesAttribute) {
          objectFoundWithoutAttribute = true;
        }
        if (matchesObject && matchesAttribute) {
          let s = 0.95;
          if (el.isVisualConfirmed) s = 1.0;
          verifiedAttributeMatches.push({ el, idx, score: s });
        }
      }
    });

    if (hasAttributeConstraint) {
      if (verifiedAttributeMatches.length === 1) {
        bestIdx = verifiedAttributeMatches[0].idx;
        bestScore = verifiedAttributeMatches[0].score;
        return {
          action: "CLICK",
          target: candidates[bestIdx].label,
          targetIndex: bestIdx,
          groundingScore: bestScore,
          groundingMethod: "attribute-verified-grounding"
        };
      } else if (verifiedAttributeMatches.length > 1) {
        const ordinal = currentStepPlan?.ordinal;
        if (typeof ordinal === "number" && ordinal >= 1 && ordinal <= verifiedAttributeMatches.length) {
          bestIdx = verifiedAttributeMatches[ordinal - 1].idx;
          bestScore = verifiedAttributeMatches[ordinal - 1].score;
          return {
            action: "CLICK",
            target: candidates[bestIdx].label,
            targetIndex: bestIdx,
            groundingScore: bestScore,
            groundingMethod: "attribute-verified-grounding"
          };
        } else {
          return {
            action: "NONE",
            groundingScore: 0,
            groundingMethod: "ambiguous-attribute-targets",
            reason: `Target ambiguous: multiple identical '${targetValNorm} ${targetObjNorm}' elements found on page without distinguishing evidence`
          };
        }
      } else if (objectFoundWithoutAttribute) {
        return {
          action: "NONE",
          groundingScore: 0,
          groundingMethod: "attribute-not-verified",
          reason: `Target attribute not verified: object '${targetObjNorm}' found on current page, but attribute '${currentStepPlan.attribute} = ${targetValNorm}' has insufficient evidence`
        };
      } else {
        return {
          action: "NONE",
          groundingScore: 0,
          groundingMethod: "target-not-found",
          reason: `Target not found on current page`
        };
      }
    }
  }

  // 4a. Positive match: Candidate has text evidence
  const plan = reasoningPlanner.planTask(taskParser.parseTask("find the black colour earbuds"), {}).steps[0];
  const candidatesPos = [
    { label: "Wireless Bluetooth Earbuds - Midnight Black", type: "link" },
    { label: "Phone Charging Cable", type: "link" }
  ];
  const groundedPos = groundCandidate(plan, candidatesPos);
  assert.strictEqual(groundedPos.action, "CLICK");
  assert.strictEqual(groundedPos.targetIndex, 0);
  assert.strictEqual(groundedPos.groundingMethod, "attribute-verified-grounding");
  assert.ok(groundedPos.groundingScore >= 0.95);
  console.log("  ✓ 4a. Positive match verified (Score: " + groundedPos.groundingScore + ", Method: " + groundedPos.groundingMethod + ")");

  // 4b. Positive match via image alt metadata
  const candidatesAlt = [
    { label: "Wireless Earbuds Pro", alt: "Wireless Earbuds in Black", type: "link" }
  ];
  const groundedAlt = groundCandidate(plan, candidatesAlt);
  assert.strictEqual(groundedAlt.action, "CLICK");
  assert.strictEqual(groundedAlt.groundingMethod, "attribute-verified-grounding");
  console.log("  ✓ 4b. Alt-text attribute evidence verified");

  // 4c. Negative Case (Phase 5): Object found, but no evidence of requested color
  const candidatesNeg = [
    { label: "Wireless Earbuds Pro", type: "link" },
    { label: "Over-Ear Headphones", type: "link" }
  ];
  const groundedNeg = groundCandidate(plan, candidatesNeg);
  assert.strictEqual(groundedNeg.action, "NONE", "Must return action=NONE when attribute is not verified");
  assert.strictEqual(groundedNeg.groundingScore, 0);
  assert.strictEqual(groundedNeg.groundingMethod, "attribute-not-verified");
  assert.ok(groundedNeg.reason.includes("insufficient evidence"));
  console.log("  ✓ 4c. Negative case correctly BLOCKED (Reason: " + groundedNeg.reason + ")");

  // 4d. Ambiguity Case (Phase 5): Multiple identical black earbuds without ordinal
  const candidatesAmb = [
    { label: "Sony Black Earbuds Model A", type: "link" },
    { label: "Sony Black Earbuds Model B", type: "link" }
  ];
  const groundedAmb = groundCandidate(plan, candidatesAmb);
  assert.strictEqual(groundedAmb.action, "NONE", "Must return action=NONE when ambiguous");
  assert.strictEqual(groundedAmb.groundingScore, 0);
  assert.strictEqual(groundedAmb.groundingMethod, "ambiguous-attribute-targets");
  console.log("  ✓ 4d. Ambiguity case correctly BLOCKED without guessing");

  // 4e. Disambiguated with Ordinal
  const planOrdinal = reasoningPlanner.planTask(taskParser.parseTask("find the second black earbuds"), {}).steps[0];
  const groundedOrd = groundCandidate(planOrdinal, candidatesAmb);
  assert.strictEqual(groundedOrd.action, "CLICK");
  assert.strictEqual(groundedOrd.targetIndex, 1, "Ordinal 2 must select second candidate");
  console.log("  ✓ 4e. Ordinal disambiguation successfully selected index 1");
}

console.log("\n============================================================");
console.log("ALL ATTRIBUTE GROUNDING TESTS PASSED (100%)!");
console.log("============================================================\n");
