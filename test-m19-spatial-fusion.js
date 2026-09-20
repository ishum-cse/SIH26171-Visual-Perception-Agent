/**
 * test-m19-spatial-fusion.js - Milestone 19.2 Verification Suite
 * 
 * Verifies:
 * A. DOM normalization (1280x720 and 1920x1080)
 * B. Visual 224x224 -> canonical normalization
 * C. OCR pixel -> canonical normalization
 * D. DPR/scaling cases (DPR 1, DPR 1.5, DPR 2)
 * E. IoU identical boxes
 * F. IoU partial overlap
 * G. IoU no overlap
 * H. contains relationship
 * I. above relationship
 * J. below relationship
 * K. leftOf relationship
 * L. rightOf relationship
 * M. invalid/zero-area boxes
 * N. duplicate/self relationship prevention
 * O. Full fusion output schema (canonicalBbox, spatialRelations, visual-only preservation)
 */

const assert = require("assert");
const fusion = require("./perception-fusion.js");

console.log("============================================================");
console.log("RUNNING MILESTONE 19.2 COORDINATE NORMALIZATION & SPATIAL FUSION TESTS");
console.log("============================================================\n");

// [TEST A] DOM Normalization
console.log("[TEST A] DOM Normalization");
{
  // Viewport 1280x720
  const vp720 = { width: 1280, height: 720 };
  const domBoxA = { x: 320, y: 180, width: 640, height: 360 };
  const normA = fusion.normalizeDomBbox(domBoxA, vp720);
  assert.strictEqual(normA.x, 0.25, "1280x720: x should be 320/1280 = 0.25");
  assert.strictEqual(normA.y, 0.25, "1280x720: y should be 180/720 = 0.25");
  assert.strictEqual(normA.width, 0.5, "1280x720: width should be 640/1280 = 0.5");
  assert.strictEqual(normA.height, 0.5, "1280x720: height should be 360/720 = 0.5");

  // Viewport 1920x1080
  const vp1080 = { width: 1920, height: 1080 };
  const domBoxB = { x: 480, y: 270, width: 960, height: 540 };
  const normB = fusion.normalizeDomBbox(domBoxB, vp1080);
  assert.strictEqual(normB.x, 0.25, "1920x1080: x should be 480/1920 = 0.25");
  assert.strictEqual(normB.y, 0.25, "1920x1080: y should be 270/1080 = 0.25");
  assert.strictEqual(normB.width, 0.5, "1920x1080: width should be 960/1920 = 0.5");
  assert.strictEqual(normB.height, 0.5, "1920x1080: height should be 540/1080 = 0.5");

  // Clamping for off-screen / overflow elements
  const overflowBox = { x: -50, y: -20, width: 2000, height: 1200 };
  const normOverflow = fusion.normalizeDomBbox(overflowBox, vp1080);
  assert.ok(normOverflow.x >= 0 && normOverflow.x <= 1.0, "x must be clamped [0, 1]");
  assert.ok(normOverflow.y >= 0 && normOverflow.y <= 1.0, "y must be clamped [0, 1]");
  assert.ok(normOverflow.width <= 1.0, "width must be bounded");
  assert.ok(normOverflow.height <= 1.0, "height must be bounded");

  console.log("  ✓ DOM normalization verified across 1280x720 and 1920x1080 viewports");
}

// [TEST B] Visual 224x224 -> Canonical Normalization
console.log("\n[TEST B] Visual 224x224 -> Canonical Normalization");
{
  const vis224 = { x: 56, y: 56, width: 112, height: 112 };
  const normVis = fusion.normalizeVisualBbox(vis224, {
    viewport: { width: 1920, height: 1080 },
    detectorSize: { width: 224, height: 224 }
  });
  assert.strictEqual(normVis.x, 0.25, "224x224: x should be 56/224 = 0.25");
  assert.strictEqual(normVis.y, 0.25, "224x224: y should be 56/224 = 0.25");
  assert.strictEqual(normVis.width, 0.5, "224x224: width should be 112/224 = 0.5");
  assert.strictEqual(normVis.height, 0.5, "224x224: height should be 112/224 = 0.5");

  // Pre-scaled visual detection (already in viewport space)
  const visScaled = { x: 480, y: 270, width: 960, height: 540 };
  const normScaled = fusion.normalizeVisualBbox(visScaled, {
    viewport: { width: 1920, height: 1080 }
  });
  assert.strictEqual(normScaled.x, 0.25, "Viewport scaled: x should be 480/1920 = 0.25");
  assert.strictEqual(normScaled.y, 0.25, "Viewport scaled: y should be 270/1080 = 0.25");
  assert.strictEqual(normScaled.width, 0.5, "Viewport scaled: width should be 960/1920 = 0.5");
  assert.strictEqual(normScaled.height, 0.5, "Viewport scaled: height should be 540/1080 = 0.5");

  // Already normalized box
  const alreadyNorm = { x: 0.15, y: 0.25, width: 0.35, height: 0.45 };
  const normPreserved = fusion.normalizeVisualBbox(alreadyNorm);
  assert.strictEqual(normPreserved.x, 0.15);
  assert.strictEqual(normPreserved.y, 0.25);
  assert.strictEqual(normPreserved.width, 0.35);
  assert.strictEqual(normPreserved.height, 0.45);

  console.log("  ✓ Visual 224x224 and pre-scaled detector normalization verified");
}

// [TEST C] OCR Pixel -> Canonical Normalization
console.log("\n[TEST C] OCR Pixel -> Canonical Normalization");
{
  const ocrBox = { x: 480, y: 270, width: 960, height: 540 };
  const normOcr = fusion.normalizeOcrBbox(ocrBox, {
    screenshotDimensions: { width: 1920, height: 1080 },
    viewport: { width: 1920, height: 1080 },
    dpr: 1
  });
  assert.strictEqual(normOcr.x, 0.25, "OCR screenshot pixel: x should be 480/1920 = 0.25");
  assert.strictEqual(normOcr.y, 0.25, "OCR screenshot pixel: y should be 270/1080 = 0.25");
  assert.strictEqual(normOcr.width, 0.5, "OCR screenshot pixel: width should be 960/1920 = 0.5");
  assert.strictEqual(normOcr.height, 0.5, "OCR screenshot pixel: height should be 540/1080 = 0.5");

  console.log("  ✓ OCR pixel -> canonical normalization verified");
}

// [TEST D] DPR / Scaling Cases (DPR 1, DPR 1.5, DPR 2)
console.log("\n[TEST D] DPR / Scaling Cases (DPR 1, DPR 1.5, DPR 2)");
{
  const vp = { width: 1280, height: 720 };

  // Case D1: DPR = 1 -> screenshot is 1280x720
  const ocrDpr1 = { x: 320, y: 180, width: 640, height: 360 };
  const normDpr1 = fusion.normalizeOcrBbox(ocrDpr1, { viewport: vp, dpr: 1 });
  assert.strictEqual(normDpr1.x, 0.25);
  assert.strictEqual(normDpr1.y, 0.25);
  assert.strictEqual(normDpr1.width, 0.5);
  assert.strictEqual(normDpr1.height, 0.5);

  // Case D2: DPR = 1.5 -> screenshot is 1920x1080 (1280 * 1.5 = 1920, 720 * 1.5 = 1080)
  const ocrDpr15 = { x: 480, y: 270, width: 960, height: 540 };
  const normDpr15 = fusion.normalizeOcrBbox(ocrDpr15, { viewport: vp, dpr: 1.5 });
  assert.strictEqual(normDpr15.x, 0.25);
  assert.strictEqual(normDpr15.y, 0.25);
  assert.strictEqual(normDpr15.width, 0.5);
  assert.strictEqual(normDpr15.height, 0.5);

  // Case D3: DPR = 2.0 -> screenshot is 2560x1440 (1280 * 2 = 2560, 720 * 2 = 1440)
  const ocrDpr2 = { x: 640, y: 360, width: 1280, height: 720 };
  const normDpr2 = fusion.normalizeOcrBbox(ocrDpr2, { viewport: vp, dpr: 2.0 });
  assert.strictEqual(normDpr2.x, 0.25);
  assert.strictEqual(normDpr2.y, 0.25);
  assert.strictEqual(normDpr2.width, 0.5);
  assert.strictEqual(normDpr2.height, 0.5);

  // Case D4: High-res viewport 1920x1080 with DPR = 2.0 -> screenshot is 3840x2160
  const ocr4K = { x: 960, y: 540, width: 1920, height: 1080 };
  const norm4K = fusion.normalizeOcrBbox(ocr4K, {
    viewport: { width: 1920, height: 1080 },
    dpr: 2.0
  });
  assert.strictEqual(norm4K.x, 0.25);
  assert.strictEqual(norm4K.y, 0.25);
  assert.strictEqual(norm4K.width, 0.5);
  assert.strictEqual(norm4K.height, 0.5);

  console.log("  ✓ DPR 1, DPR 1.5, and DPR 2 normalization tested cleanly");
}

// [TEST E] IoU Identical Boxes
console.log("\n[TEST E] IoU Identical Boxes");
{
  const box1 = { x: 0.2, y: 0.3, width: 0.4, height: 0.2 };
  const box2 = { x: 0.2, y: 0.3, width: 0.4, height: 0.2 };
  const overlapNorm = fusion.computeSpatialOverlap(box1, box2);
  assert.strictEqual(overlapNorm, 1.0, "Overlap of identical normalized boxes must be 1.0");

  const pixelBox1 = { x: 100, y: 150, width: 250, height: 40 };
  const pixelBox2 = { x: 100, y: 150, width: 250, height: 40 };
  const overlapPixel = fusion.computeSpatialOverlap(pixelBox1, pixelBox2, { width: 1280, height: 800 });
  assert.strictEqual(overlapPixel, 1.0, "Overlap of identical pixel boxes must be 1.0");

  console.log("  ✓ IoU for identical boxes returns exactly 1.0");
}

// [TEST F] IoU Partial Overlap
console.log("\n[TEST F] IoU Partial Overlap");
{
  // Box A: [0.1, 0.1, 0.2, 0.2] (area = 0.04)
  // Box B: [0.2, 0.1, 0.2, 0.2] (area = 0.04)
  // Intersection: x in [0.2, 0.3], y in [0.1, 0.3] -> w=0.1, h=0.2, area = 0.02
  // Union: 0.04 + 0.04 - 0.02 = 0.06
  // IoU = 0.02 / 0.06 = 0.3333, IoMin = 0.02 / 0.04 = 0.5 (0.5 * 0.75 = 0.375)
  const boxA = { x: 0.1, y: 0.1, width: 0.2, height: 0.2 };
  const boxB = { x: 0.2, y: 0.1, width: 0.2, height: 0.2 };
  const overlap = fusion.computeSpatialOverlap(boxA, boxB);
  assert.ok(overlap >= 0.33 && overlap <= 0.38, `Expected ~0.375 partial overlap, got ${overlap}`);

  console.log(`  ✓ IoU partial overlap verified (${overlap})`);
}

// [TEST G] IoU No Overlap
console.log("\n[TEST G] IoU No Overlap");
{
  const boxA = { x: 0.05, y: 0.05, width: 0.1, height: 0.1 };
  const boxB = { x: 0.50, y: 0.50, width: 0.2, height: 0.2 };
  const overlap = fusion.computeSpatialOverlap(boxA, boxB);
  assert.strictEqual(overlap, 0, "Disjoint boxes must have 0 overlap");

  console.log("  ✓ Disjoint boxes correctly return 0 overlap");
}

// [TEST H] Contains Relationship
console.log("\n[TEST H] Contains Relationship");
{
  const containerCard = { id: "card-main", type: "region", x: 100, y: 100, width: 600, height: 400 };
  const childButton = { id: "btn-inside", type: "button", x: 200, y: 200, width: 120, height: 40 };

  const rels = fusion.computeSpatialRelationships([containerCard, childButton], {
    viewport: { width: 1000, height: 1000 }
  });

  const containsRel = rels.find(r => r.sourceId === "card-main" && r.targetId === "btn-inside" && r.relation === "contains");
  assert.ok(containsRel, "Container card should contain child button");
  assert.ok(containsRel.confidence >= 0.85, "Containment should have high confidence");

  // Child button should NOT contain card
  const reverseRel = rels.find(r => r.sourceId === "btn-inside" && r.targetId === "card-main" && r.relation === "contains");
  assert.strictEqual(reverseRel, undefined, "Child button must not contain parent card");

  console.log(`  ✓ Contains relationship confirmed (confidence: ${containsRel.confidence})`);
}

// [TEST I & J] Above and Below Directional Relationships
console.log("\n[TEST I & J] Above and Below Directional Relationships");
{
  const labelEl = { id: "username-label", type: "label", x: 100, y: 100, width: 250, height: 25 };
  const inputEl = { id: "username-input", type: "input", x: 100, y: 135, width: 250, height: 40 };

  const rels = fusion.computeSpatialRelationships([labelEl, inputEl], {
    viewport: { width: 1000, height: 1000 }
  });

  // I. Above
  const aboveRel = rels.find(r => r.sourceId === "username-label" && r.targetId === "username-input" && r.relation === "above");
  assert.ok(aboveRel, "Label should be identified as above input");
  assert.ok(aboveRel.confidence > 0.75, "Above confidence should be high for aligned elements");

  // J. Below
  const belowRel = rels.find(r => r.sourceId === "username-input" && r.targetId === "username-label" && r.relation === "below");
  assert.ok(belowRel, "Input should be identified as below label");
  assert.ok(belowRel.confidence > 0.75, "Below confidence should be high for aligned elements");

  // Also check direct element attachment
  assert.ok(labelEl.spatialRelations.some(r => r.targetId === "username-input" && r.relation === "above"));
  assert.ok(inputEl.spatialRelations.some(r => r.targetId === "username-label" && r.relation === "below"));

  console.log(`  ✓ Above relationship confirmed (confidence: ${aboveRel.confidence})`);
  console.log(`  ✓ Below relationship confirmed (confidence: ${belowRel.confidence})`);
}

// [TEST K & L] LeftOf and RightOf Directional Relationships
console.log("\n[TEST K & L] LeftOf and RightOf Directional Relationships");
{
  const labelEl = { id: "opt-in-label", type: "label", x: 50, y: 200, width: 120, height: 30 };
  const checkEl = { id: "opt-in-check", type: "checkbox", x: 180, y: 200, width: 30, height: 30 };

  const rels = fusion.computeSpatialRelationships([labelEl, checkEl], {
    viewport: { width: 1000, height: 1000 }
  });

  // K. LeftOf
  const leftRel = rels.find(r => r.sourceId === "opt-in-label" && r.targetId === "opt-in-check" && r.relation === "leftOf");
  assert.ok(leftRel, "Label should be identified as leftOf checkbox");
  assert.ok(leftRel.confidence > 0.70, "leftOf confidence should be solid");

  // L. RightOf
  const rightRel = rels.find(r => r.sourceId === "opt-in-check" && r.targetId === "opt-in-label" && r.relation === "rightOf");
  assert.ok(rightRel, "Checkbox should be identified as rightOf label");
  assert.ok(rightRel.confidence > 0.70, "rightOf confidence should be solid");

  console.log(`  ✓ LeftOf relationship confirmed (confidence: ${leftRel.confidence})`);
  console.log(`  ✓ RightOf relationship confirmed (confidence: ${rightRel.confidence})`);
}

// [TEST M] Invalid and Zero-Area Bounding Boxes
console.log("\n[TEST M] Invalid and Zero-Area Bounding Boxes");
{
  const zeroW = { x: 10, y: 10, width: 0, height: 50 };
  const zeroH = { x: 10, y: 10, width: 50, height: 0 };
  const negBox = { x: 10, y: 10, width: -10, height: 20 };
  const nanBox = { x: NaN, y: 10, width: 50, height: 50 };
  const validBox = { x: 10, y: 10, width: 50, height: 50 };

  assert.strictEqual(fusion.computeSpatialOverlap(zeroW, validBox), 0);
  assert.strictEqual(fusion.computeSpatialOverlap(validBox, zeroH), 0);
  assert.strictEqual(fusion.computeSpatialOverlap(negBox, validBox), 0);
  assert.strictEqual(fusion.computeSpatialOverlap(nanBox, validBox), 0);
  assert.strictEqual(fusion.computeSpatialOverlap(null, validBox), 0);
  assert.strictEqual(fusion.computeSpatialOverlap(undefined, undefined), 0);

  const invalidNorm = fusion.normalizeDomBbox(zeroW);
  assert.strictEqual(invalidNorm.width, 0);
  assert.strictEqual(invalidNorm.height, 0);

  const relsWithInvalid = fusion.computeSpatialRelationships([zeroW, zeroH, validBox]);
  assert.strictEqual(relsWithInvalid.length, 0, "No relationships should be generated for zero-area elements");

  console.log("  ✓ Zero-area and invalid boxes handled safely with 0 errors");
}

// [TEST N] Duplicate and Self-Relationship Prevention
console.log("\n[TEST N] Duplicate and Self-Relationship Prevention");
{
  const elA = { id: "item-1", type: "button", x: 100, y: 100, width: 100, height: 30 };
  const elB = { id: "item-2", type: "button", x: 100, y: 140, width: 100, height: 30 };

  const rels = fusion.computeSpatialRelationships([elA, elB], {
    viewport: { width: 1000, height: 1000 }
  });

  // Self relationship check
  const selfRel = rels.find(r => r.sourceId === r.targetId);
  assert.strictEqual(selfRel, undefined, "Elements must never generate self relationships");

  // Duplicate check: pair + relation must be unique
  const keys = rels.map(r => `${r.sourceId}:${r.relation}:${r.targetId}`);
  const uniqueKeys = new Set(keys);
  assert.strictEqual(keys.length, uniqueKeys.size, "All generated relationships must be unique");

  console.log("  ✓ Self-relationship and duplicate prevention verified");
}

// [TEST O] Full Fusion Integration & Output Schema
console.log("\n[TEST O] Full Fusion Integration & Output Schema");
{
  const domElements = [
    { index: 0, label: "Search", type: "input", x: 100, y: 150, width: 400, height: 40, isVisible: true },
    { index: 1, label: "Search Label", type: "label", x: 100, y: 110, width: 200, height: 25, isVisible: true }
  ];

  const visualDetections = [
    { type: "visual-region", subtype: "input-like", bbox: { x: 98, y: 148, width: 405, height: 44 }, confidence: 0.92 },
    // Unmatched visual detection (e.g. standalone logo or banner)
    { type: "visual-region", subtype: "card-like", bbox: { x: 700, y: 100, width: 250, height: 200 }, confidence: 0.85 }
  ];

  const ocrWords = [
    { text: "Search", bbox: { x: 105, y: 112, width: 80, height: 20 } }
  ];

  const fused = fusion.fuseVisualAndDOMResults(domElements, visualDetections, ocrWords, {
    viewport: { width: 1280, height: 800 }
  });

  assert.strictEqual(fused.length, 2, "DOM elements count preserved");
  assert.ok(fused[0].canonicalBbox, "Element must contain canonicalBbox");
  assert.strictEqual(typeof fused[0].canonicalBbox.x, "number");
  assert.strictEqual(typeof fused[0].canonicalBbox.y, "number");
  assert.strictEqual(typeof fused[0].canonicalBbox.width, "number");
  assert.strictEqual(typeof fused[0].canonicalBbox.height, "number");
  assert.ok(Array.isArray(fused[0].spatialRelations), "Element must contain spatialRelations array");

  // Element 1 (Search Label) should be above Element 0 (Search input)
  const labelAbove = fused[1].spatialRelations.find(r => r.relation === "above");
  assert.ok(labelAbove, "Search label should have spatial relation 'above'");

  // Visual-only evidence check in centralized state
  const state = fusion.getPerceptionState();
  assert.ok(Array.isArray(state.visualOnlyElements), "Centralized state should contain visualOnlyElements");
  assert.strictEqual(state.visualOnlyElements.length, 1, "Unmatched visual detection should be preserved as visual evidence");
  assert.strictEqual(state.visualOnlyElements[0].type, "visual-region");
  assert.strictEqual(state.visualOnlyElements[0].groundingMethod, "visual-detection");
  assert.strictEqual(state.visualOnlyElements[0].isInteractable, false, "Visual-only evidence must not claim interactable");

  // Test buildLocalPerception wrapper
  const perceptionObj = fusion.buildLocalPerception(domElements, { detections: visualDetections }, {}, 0, { words: ocrWords });
  assert.ok(Array.isArray(perceptionObj.fusedElements));
  assert.ok(Array.isArray(perceptionObj.visualOnlyElements));
  assert.ok(Array.isArray(perceptionObj.spatialRelationships));

  console.log("  ✓ Full fusion output schema, canonical bboxes, and visual-only preservation verified");
}

console.log("\n============================================================");
console.log("ALL MILESTONE 19.2 SPATIAL FUSION TESTS PASSED CLEANLY!");
console.log("============================================================\n");
