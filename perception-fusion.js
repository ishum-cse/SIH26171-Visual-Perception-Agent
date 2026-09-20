/**
 * perception-fusion.js - Milestone 9 & 10: Unified Visual-DOM Perception Fusion & State
 * 
 * Fuses local DOM-extracted visual elements with on-device ONNX vision detections
 * and OCR spatial bounding boxes into a unified perception layer.
 * 
 * Privacy & Security Guarantees:
 * - Runs 100% locally on-device in the browser client context.
 * - Raw screenshots, DOM visual elements, bounding boxes, sensitive regions,
 *   OCR text/boxes, and fused perception data are NEVER transmitted to FastAPI or external servers.
 */

// Centralized Perception State (Milestone 9 - Section 10 & Milestone 19.2)
const centralizedPerceptionState = {
  ready: false,
  modelAvailable: true,
  inferenceRunning: false,
  lastInferenceTime: null,
  visualDetections: [],
  domElements: [],
  fusedElements: [],
  visualOnlyElements: [],
  spatialRelationships: [],
  pageSignature: null,
  visualSignature: null,
  changed: false,
  reason: "Initial observation",
  modelName: "squeezenet1.1-7.onnx",
  executionProvider: "wasm"
};

/**
 * Milestone 19.2: Normalizes DOM CSS viewport bounding box to canonical [0, 1] viewport space.
 * 
 * @param {Object} domBox - { x, y, width, height } in CSS viewport pixels
 * @param {Object} viewport - { width, height } of the browser viewport
 * @returns {Object} Canonical bounding box { x, y, width, height } clamped to [0, 1]
 */
function normalizeDomBbox(domBox, viewport = { width: 1280, height: 800 }) {
  if (!domBox || typeof domBox !== "object") {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  const x = typeof domBox.x === "number" ? domBox.x : 0;
  const y = typeof domBox.y === "number" ? domBox.y : 0;
  const w = typeof domBox.width === "number" ? domBox.width : 0;
  const h = typeof domBox.height === "number" ? domBox.height : 0;

  if (w <= 0 || h <= 0 || isNaN(x) || isNaN(y) || isNaN(w) || isNaN(h)) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  const vpW = (viewport && viewport.width > 0) ? viewport.width : 1280;
  const vpH = (viewport && viewport.height > 0) ? viewport.height : 800;

  const normX = Math.max(0, Math.min(1, x / vpW));
  const normY = Math.max(0, Math.min(1, y / vpH));
  const normW = Math.max(0, Math.min(1 - normX, w / vpW));
  const normH = Math.max(0, Math.min(1 - normY, h / vpH));

  return {
    x: Math.round(normX * 1e6) / 1e6,
    y: Math.round(normY * 1e6) / 1e6,
    width: Math.round(normW * 1e6) / 1e6,
    height: Math.round(normH * 1e6) / 1e6
  };
}

/**
 * Milestone 19.2: Normalizes visual detection bounding box (224x224 detector or pre-scaled)
 * to canonical [0, 1] viewport space.
 * 
 * @param {Object} visBox - { x, y, width, height }
 * @param {Object} options - Configuration options { viewport, detectorSize, detectorWidth, detectorHeight, isDetectorCoords }
 * @returns {Object} Canonical bounding box { x, y, width, height } clamped to [0, 1]
 */
function normalizeVisualBbox(visBox, options = {}) {
  if (!visBox || typeof visBox !== "object") {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  const x = typeof visBox.x === "number" ? visBox.x : 0;
  const y = typeof visBox.y === "number" ? visBox.y : 0;
  const w = typeof visBox.width === "number" ? visBox.width : 0;
  const h = typeof visBox.height === "number" ? visBox.height : 0;

  if (w <= 0 || h <= 0 || isNaN(x) || isNaN(y) || isNaN(w) || isNaN(h)) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  // Already normalized in [0, 1]
  if (x <= 1.0 && y <= 1.0 && w <= 1.0 && h <= 1.0 && (x + w <= 1.05) && (y + h <= 1.05)) {
    return {
      x: Math.round(Math.max(0, Math.min(1, x)) * 1e6) / 1e6,
      y: Math.round(Math.max(0, Math.min(1, y)) * 1e6) / 1e6,
      width: Math.round(Math.max(0, Math.min(1, w)) * 1e6) / 1e6,
      height: Math.round(Math.max(0, Math.min(1, h)) * 1e6) / 1e6
    };
  }

  const vp = options.viewport || { width: 1280, height: 800 };
  const detW = (options.detectorSize && options.detectorSize.width) || options.detectorWidth || 224;
  const detH = (options.detectorSize && options.detectorSize.height) || options.detectorHeight || 224;

  let normX, normY, normW, normH;

  if (options.isDetectorCoords || options.detectorSize || (x + w <= detW && y + h <= detH && (vp.width > detW || vp.height > detH))) {
    // Detector 224x224 coordinates
    normX = Math.max(0, Math.min(1, x / detW));
    normY = Math.max(0, Math.min(1, y / detH));
    normW = Math.max(0, Math.min(1 - normX, w / detW));
    normH = Math.max(0, Math.min(1 - normY, h / detH));
  } else {
    // Viewport CSS pixel coordinates
    const vpW = vp.width > 0 ? vp.width : 1280;
    const vpH = vp.height > 0 ? vp.height : 800;
    normX = Math.max(0, Math.min(1, x / vpW));
    normY = Math.max(0, Math.min(1, y / vpH));
    normW = Math.max(0, Math.min(1 - normX, w / vpW));
    normH = Math.max(0, Math.min(1 - normY, h / vpH));
  }

  return {
    x: Math.round(normX * 1e6) / 1e6,
    y: Math.round(normY * 1e6) / 1e6,
    width: Math.round(normW * 1e6) / 1e6,
    height: Math.round(normH * 1e6) / 1e6
  };
}

/**
 * Milestone 19.2: Normalizes OCR screenshot pixel bounding box to canonical [0, 1] viewport space.
 * Accounts for devicePixelRatio (DPR) and screenshot scaling.
 * 
 * @param {Object} ocrBox - { x, y, width, height } in screenshot pixels
 * @param {Object} options - { screenshotDimensions, viewport, dpr, screenshotWidth, screenshotHeight }
 * @returns {Object} Canonical bounding box { x, y, width, height } clamped to [0, 1]
 */
function normalizeOcrBbox(ocrBox, options = {}) {
  if (!ocrBox || typeof ocrBox !== "object") {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  const x = typeof ocrBox.x === "number" ? ocrBox.x : 0;
  const y = typeof ocrBox.y === "number" ? ocrBox.y : 0;
  const w = typeof ocrBox.width === "number" ? ocrBox.width : 0;
  const h = typeof ocrBox.height === "number" ? ocrBox.height : 0;

  if (w <= 0 || h <= 0 || isNaN(x) || isNaN(y) || isNaN(w) || isNaN(h)) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  // Already normalized in [0, 1]
  if (x <= 1.0 && y <= 1.0 && w <= 1.0 && h <= 1.0 && (x + w <= 1.05) && (y + h <= 1.05)) {
    return {
      x: Math.round(Math.max(0, Math.min(1, x)) * 1e6) / 1e6,
      y: Math.round(Math.max(0, Math.min(1, y)) * 1e6) / 1e6,
      width: Math.round(Math.max(0, Math.min(1, w)) * 1e6) / 1e6,
      height: Math.round(Math.max(0, Math.min(1, h)) * 1e6) / 1e6
    };
  }

  const vp = options.viewport || { width: 1280, height: 800 };
  const dpr = (typeof options.dpr === "number" && options.dpr > 0) ? options.dpr : 1.0;

  let sW = (options.screenshotDimensions && options.screenshotDimensions.width > 0)
    ? options.screenshotDimensions.width
    : (options.screenshotWidth || (vp.width * dpr));
  let sH = (options.screenshotDimensions && options.screenshotDimensions.height > 0)
    ? options.screenshotDimensions.height
    : (options.screenshotHeight || (vp.height * dpr));

  if (sW <= 0) sW = 1280;
  if (sH <= 0) sH = 800;

  const normX = Math.max(0, Math.min(1, x / sW));
  const normY = Math.max(0, Math.min(1, y / sH));
  const normW = Math.max(0, Math.min(1 - normX, w / sW));
  const normH = Math.max(0, Math.min(1 - normY, h / sH));

  return {
    x: Math.round(normX * 1e6) / 1e6,
    y: Math.round(normY * 1e6) / 1e6,
    width: Math.round(normW * 1e6) / 1e6,
    height: Math.round(normH * 1e6) / 1e6
  };
}

/**
 * Universal bounding box canonicalizer. Converts any valid box to [0, 1] canonical space.
 * 
 * @param {Object} box - { x, y, width, height }
 * @param {Object} viewport - { width, height }
 * @returns {Object|null} Canonical box or null if invalid/zero-area
 */
function toCanonicalBbox(box, viewport = { width: 1280, height: 800 }) {
  if (!box || typeof box !== "object") return null;
  const x = typeof box.x === "number" ? box.x : 0;
  const y = typeof box.y === "number" ? box.y : 0;
  const w = typeof box.width === "number" ? box.width : 0;
  const h = typeof box.height === "number" ? box.height : 0;

  if (w <= 0 || h <= 0 || isNaN(x) || isNaN(y) || isNaN(w) || isNaN(h)) {
    return null;
  }

  const vpW = (viewport && viewport.width > 0) ? viewport.width : 1280;
  const vpH = (viewport && viewport.height > 0) ? viewport.height : 800;

  // Already normalized [0, 1]
  if (x <= 1.0 && y <= 1.0 && w <= 1.0 && h <= 1.0 && (x + w <= 1.05) && (y + h <= 1.05)) {
    return {
      x: Math.max(0, Math.min(1, x)),
      y: Math.max(0, Math.min(1, y)),
      width: Math.max(0, Math.min(1 - Math.max(0, Math.min(1, x)), w)),
      height: Math.max(0, Math.min(1 - Math.max(0, Math.min(1, y)), h))
    };
  }

  // 224x224 detector coordinates
  if (x + w <= 224 && y + h <= 224 && (vpW > 224 || vpH > 224)) {
    return {
      x: Math.max(0, Math.min(1, x / 224)),
      y: Math.max(0, Math.min(1, y / 224)),
      width: Math.max(0, Math.min(1, w / 224)),
      height: Math.max(0, Math.min(1, h / 224))
    };
  }

  // Viewport CSS pixel coordinates
  return {
    x: Math.max(0, Math.min(1, x / vpW)),
    y: Math.max(0, Math.min(1, y / vpH)),
    width: Math.max(0, Math.min(1, w / vpW)),
    height: Math.max(0, Math.min(1, h / vpH))
  };
}

/**
 * Computes spatial overlap and intersection ratio between two bounding boxes.
 * Operates accurately in canonical [0, 1] normalized space as well as pixel space.
 * Preserves IoU and IoMin behavior across all coordinate systems.
 * 
 * @param {Object} domBox - { x, y, width, height }
 * @param {Object} visBox - { x, y, width, height }
 * @param {Object} viewport - { width, height } for coordinate normalization if needed
 * @returns {number} Overlap coefficient between 0.0 and 1.0
 */
function computeSpatialOverlap(domBox, visBox, viewport = { width: 1280, height: 800 }) {
  if (!domBox || !visBox) return 0;

  const cDom = toCanonicalBbox(domBox, viewport);
  const cVis = toCanonicalBbox(visBox, viewport);

  if (!cDom || !cVis) return 0;

  const xOverlap = Math.max(0, Math.min(cDom.x + cDom.width, cVis.x + cVis.width) - Math.max(cDom.x, cVis.x));
  const yOverlap = Math.max(0, Math.min(cDom.y + cDom.height, cVis.y + cVis.height) - Math.max(cDom.y, cVis.y));
  const intersectionArea = xOverlap * yOverlap;

  if (intersectionArea <= 0) return 0;

  const domArea = cDom.width * cDom.height;
  const visArea = cVis.width * cVis.height;
  const minArea = Math.min(domArea, visArea);

  if (minArea <= 0) return 0;

  const ioMin = intersectionArea / minArea;
  const unionArea = domArea + visArea - intersectionArea;

  if (unionArea <= 0) return 0;

  const iou = intersectionArea / unionArea;
  const score = Math.max(iou, ioMin * 0.75);

  return Math.round(score * 1e4) / 1e4;
}

/**
 * Milestone 19.2: Computes deterministic directional and structural spatial relationships
 * between UI elements using canonical bounding boxes.
 * Identifies: above, below, leftOf, rightOf, contains.
 * 
 * @param {Array<Object>} elements - Array of UI element descriptors
 * @param {Object} [options={}] - Configuration options (viewport, maxGap, threshold, format)
 * @returns {Array<Object>} Array of spatial relationships: [{ sourceId, targetId, relation, confidence }]
 */
function computeSpatialRelationships(elements = [], options = {}) {
  if (!Array.isArray(elements) || elements.length === 0) return [];

  const viewport = options.viewport || { width: 1280, height: 800 };
  const maxVerticalGap = typeof options.maxVerticalGap === "number" ? options.maxVerticalGap : 0.18;
  const maxHorizontalGap = typeof options.maxHorizontalGap === "number" ? options.maxHorizontalGap : 0.25;
  const minOverlapRatio = typeof options.minOverlapRatio === "number" ? options.minOverlapRatio : 0.30;
  const maxElements = typeof options.maxElements === "number" ? options.maxElements : 120;

  // Stable ID resolver
  const getElementId = (el, idx) => {
    if (el.id !== undefined && el.id !== null && el.id !== "") return String(el.id);
    if (el.fieldId !== undefined && el.fieldId !== null) return `field-${el.fieldId}`;
    if (el.index !== undefined && el.index !== null) return `el-${el.index}`;
    return `element-${idx}`;
  };

  // Pre-prepare normalized canonical boxes and IDs
  const candidates = [];
  for (let i = 0; i < elements.length && candidates.length < maxElements; i++) {
    const el = elements[i];
    if (!el || typeof el !== "object") continue;

    const rawBox = el.canonicalBbox || el.domBbox || el.bbox || { x: el.x, y: el.y, width: el.width, height: el.height };
    const canon = toCanonicalBbox(rawBox, viewport);
    if (!canon) continue;

    const id = getElementId(el, i);
    candidates.push({
      original: el,
      id,
      index: i,
      canon,
      right: canon.x + canon.width,
      bottom: canon.y + canon.height,
      area: canon.width * canon.height,
      type: (el.type || "").toLowerCase(),
      isInput: ["input", "textarea", "select", "checkbox", "radio"].includes((el.type || "").toLowerCase()) || el.inputType != null,
      isLabelLike: ["label", "heading", "text", "span", "p"].includes((el.type || "").toLowerCase()) || el.type === "heading"
    });

    if (!Array.isArray(el.spatialRelations)) {
      el.spatialRelations = [];
    }
  }

  const allRelationships = [];
  const seenPairRelations = new Set();

  const addRelation = (sourceCand, targetCand, relation, confidence) => {
    if (!sourceCand || !targetCand || sourceCand.id === targetCand.id) return;
    const key = `${sourceCand.id}:${relation}:${targetCand.id}`;
    if (seenPairRelations.has(key)) return;
    seenPairRelations.add(key);

    const relObj = {
      sourceId: sourceCand.id,
      targetId: targetCand.id,
      relation,
      confidence: Math.round(confidence * 100) / 100
    };

    allRelationships.push(relObj);

    // Attach to source element's spatialRelations array
    if (Array.isArray(sourceCand.original.spatialRelations)) {
      sourceCand.original.spatialRelations.push({
        relation,
        targetId: targetCand.id,
        confidence: relObj.confidence
      });
    }
  };

  const len = candidates.length;

  for (let i = 0; i < len; i++) {
    const A = candidates[i];

    for (let j = 0; j < len; j++) {
      if (i === j) continue;
      const B = candidates[j];
      if (A.id === B.id) continue;

      // 1. CONTAINS: A fully contains B
      const eps = 0.005;
      const containsCondition = (
        A.canon.x <= B.canon.x + eps &&
        A.canon.y <= B.canon.y + eps &&
        A.right >= B.right - eps &&
        A.bottom >= B.bottom - eps &&
        A.area > B.area * 1.05
      );

      if (containsCondition) {
        const areaRatio = Math.min(1.0, B.area / Math.max(1e-6, A.area));
        const conf = Math.min(0.98, Math.max(0.70, 0.90 + 0.08 * (1 - areaRatio)));
        addRelation(A, B, "contains", conf);
        continue;
      }

      // 2. ABOVE: A is vertically above B
      const gapY = B.canon.y - A.bottom;
      const isAboveCandidate = gapY >= -0.015 && gapY <= maxVerticalGap && A.bottom <= B.canon.y + 0.015;

      if (isAboveCandidate) {
        const overlapX = Math.max(0, Math.min(A.right, B.right) - Math.max(A.canon.x, B.canon.x));
        const minW = Math.min(A.canon.width, B.canon.width);
        const overlapRatio = minW > 0 ? (overlapX / minW) : 0;

        if (overlapRatio >= minOverlapRatio) {
          const gapScore = Math.max(0, 1 - (Math.max(0, gapY) / maxVerticalGap));
          // Boost confidence slightly for label-to-input associations
          const semanticBoost = (A.isLabelLike && B.isInput) ? 0.05 : 0;
          const conf = Math.min(0.98, Math.max(0.50, 0.55 + 0.25 * overlapRatio + 0.15 * gapScore + semanticBoost));
          addRelation(A, B, "above", conf);
          addRelation(B, A, "below", conf);
        }
      }

      // 3. LEFTOF: A is horizontally left of B
      const gapX = B.canon.x - A.right;
      const isLeftCandidate = gapX >= -0.015 && gapX <= maxHorizontalGap && A.right <= B.canon.x + 0.015;

      if (isLeftCandidate) {
        const overlapY = Math.max(0, Math.min(A.bottom, B.bottom) - Math.max(A.canon.y, B.canon.y));
        const minH = Math.min(A.canon.height, B.canon.height);
        const overlapRatio = minH > 0 ? (overlapY / minH) : 0;

        if (overlapRatio >= minOverlapRatio) {
          const gapScore = Math.max(0, 1 - (Math.max(0, gapX) / maxHorizontalGap));
          const semanticBoost = (A.isLabelLike && B.isInput) ? 0.05 : 0;
          const conf = Math.min(0.98, Math.max(0.50, 0.55 + 0.25 * overlapRatio + 0.15 * gapScore + semanticBoost));
          addRelation(A, B, "leftOf", conf);
          addRelation(B, A, "rightOf", conf);
        }
      }
    }
  }

  // Cap max relations per element to prevent payload explosion
  for (let k = 0; k < candidates.length; k++) {
    const el = candidates[k].original;
    if (Array.isArray(el.spatialRelations) && el.spatialRelations.length > 8) {
      el.spatialRelations.sort((a, b) => b.confidence - a.confidence);
      el.spatialRelations = el.spatialRelations.slice(0, 8);
    }
  }

  // Attach metadata properties to return array for convenience
  allRelationships.elements = elements;
  return allRelationships;
}

/**
 * Fuses DOM-extracted elements with on-device ONNX visual detections into unified visual perception.
 * Milestone 19.2: Computes canonical bounding boxes, spatial relationships, and preserves visual-only detections.
 * 
 * @param {Array<Object>} domElements - M8 DOM element descriptors
 * @param {Array<Object>} visualDetections - M9 ONNX visual detections
 * @param {Array<Object>} ocrWords - M12 OCR word bounding boxes
 * @param {Object} [options={}] - Viewport and spatial options
 * @returns {Array<Object>} Array of fused visual-DOM elements
 */
function fuseVisualAndDOMResults(domElements = [], visualDetections = [], ocrWords = [], options = {}) {
  const domList = Array.isArray(domElements) ? domElements : [];
  let visList = Array.isArray(visualDetections) ? visualDetections : [];
  if (visList.length === 0 && Array.isArray(centralizedPerceptionState.visualDetections) && centralizedPerceptionState.visualDetections.length > 0) {
    visList = centralizedPerceptionState.visualDetections;
  }
  const ocrList = Array.isArray(ocrWords) ? ocrWords : [];
  const viewport = options.viewport || { width: 1280, height: 800 };

  console.log(`[SIH26171][VISION] Fusion input: ${visList.length} visual detections, ${domList.length} DOM elements`);
  console.log(`[SIH26171][VISION] DOM + vision fusion started (${domList.length} DOM, ${visList.length} visual detections)`);

  let confirmedCount = 0;
  const matchedVisIndices = new Set();

  const fused = domList.map((el, idx) => {
    const domBox = {
      x: typeof el.x === "number" ? el.x : 0,
      y: typeof el.y === "number" ? el.y : 0,
      width: typeof el.width === "number" ? el.width : 50,
      height: typeof el.height === "number" ? el.height : 25
    };

    const canonicalBbox = normalizeDomBbox(domBox, viewport);

    let bestVisMatch = null;
    let bestVisOverlap = 0;
    let bestVisIdx = -1;

    for (let vIdx = 0; vIdx < visList.length; vIdx++) {
      const vis = visList[vIdx];
      if (!vis || !vis.bbox) continue;
      const overlap = computeSpatialOverlap(domBox, vis.bbox, viewport);
      if (overlap > bestVisOverlap) {
        bestVisOverlap = overlap;
        bestVisMatch = vis;
        bestVisIdx = vIdx;
      }
    }

    if (bestVisIdx >= 0 && bestVisOverlap >= 0.15) {
      matchedVisIndices.add(bestVisIdx);
    }

    // Check OCR word overlap for text-bearing elements
    let hasOcrConfirmation = false;
    if (ocrList.length > 0 && el.label) {
      const elLabelNorm = (el.label || "").toLowerCase().trim();
      for (const w of ocrList) {
        if (!w || !w.bbox || !w.text) continue;
        const wText = (w.text || "").toLowerCase().trim();
        if (elLabelNorm.includes(wText) || wText.includes(elLabelNorm)) {
          const overlap = computeSpatialOverlap(domBox, w.bbox, viewport);
          if (overlap > 0.20) {
            hasOcrConfirmation = true;
            break;
          }
        }
      }
    }

    const isVisOverlapSignificant = bestVisOverlap >= 0.15;
    const isVisualConfirmed = isVisOverlapSignificant || hasOcrConfirmation;

    if (isVisualConfirmed) {
      confirmedCount++;
    }

    // Fused confidence combines DOM visibility with visual detection overlap and confidence
    let fusedConfidence = 0.70;
    if (isVisualConfirmed) {
      const visConf = bestVisMatch ? (bestVisMatch.confidence || 0.8) : 0.85;
      fusedConfidence = Math.min(1.0, 0.45 + 0.35 * visConf + 0.20 * Math.min(1.0, bestVisOverlap || 0.5));
    } else {
      fusedConfidence = el.isVisible ? 0.75 : 0.40;
    }

    const elId = el.id !== undefined && el.id !== null && el.id !== ""
      ? String(el.id)
      : (el.fieldId !== undefined && el.fieldId !== null ? `field-${el.fieldId}` : `el-${typeof el.index === "number" ? el.index : idx}`);

    return {
      ...el,
      id: elId,
      index: typeof el.index === "number" ? el.index : idx,
      domBbox: domBox,
      canonicalBbox: canonicalBbox,
      visualBbox: bestVisMatch ? bestVisMatch.bbox : null,
      visualType: bestVisMatch ? bestVisMatch.type : null,
      visualConfidence: bestVisMatch ? bestVisMatch.confidence : null,
      fusedConfidence: Math.round(fusedConfidence * 100) / 100,
      groundingMethod: isVisualConfirmed ? "dom+visual-fusion" : "dom-geometry",
      isVisualConfirmed: isVisualConfirmed,
      spatialRelations: []
    };
  });

  // Milestone 19.2: Compute spatial relationships among fused elements
  const computedRelations = computeSpatialRelationships(fused, { ...options, viewport });

  // Milestone 19.2: Preserve visual-only detections (detections not matched to DOM elements)
  const visualOnlyElements = [];
  visList.forEach((vis, vIdx) => {
    if (!matchedVisIndices.has(vIdx) && vis && vis.bbox) {
      const canon = normalizeVisualBbox(vis.bbox, { viewport });
      visualOnlyElements.push({
        id: vis.id || `visual-region-${vIdx}`,
        type: "visual-region",
        subtype: vis.subtype || "region",
        label: vis.label || `Visual ${vis.subtype || "region"}`,
        text: vis.label || "",
        bbox: vis.bbox,
        visualBbox: vis.bbox,
        canonicalBbox: canon,
        confidence: typeof vis.confidence === "number" ? vis.confidence : 0.60,
        visualConfidence: typeof vis.confidence === "number" ? vis.confidence : 0.60,
        fusedConfidence: typeof vis.confidence === "number" ? vis.confidence : 0.60,
        groundingMethod: "visual-detection",
        isVisualConfirmed: true,
        isInteractable: false, // Visual evidence only; not claimed interactive
        visible: true,
        source: "local-visual-detector",
        spatialRelations: []
      });
    }
  });

  if (options.includeVisualOnly === true && visualOnlyElements.length > 0) {
    fused.push(...visualOnlyElements);
  }

  console.log(`[SIH26171][VISION] DOM + vision fusion completed: ${fused.length} fused elements (${confirmedCount} visually confirmed, ${visualOnlyElements.length} visual-only preserved)`);

  // Update centralized perception state
  centralizedPerceptionState.domElements = domList;
  centralizedPerceptionState.visualDetections = visList;
  centralizedPerceptionState.fusedElements = fused;
  centralizedPerceptionState.visualOnlyElements = visualOnlyElements;
  centralizedPerceptionState.spatialRelationships = computedRelations;
  centralizedPerceptionState.ready = true;
  centralizedPerceptionState.lastInferenceTime = Date.now();

  return fused;
}

/**
 * Builds a consolidated, structured local perception object.
 *
 * @param {Array<Object>} visualElements - Detected DOM UI elements (M8)
 * @param {Object|null} visionResult - SqueezeNet classification result (M9)
 * @param {Object} timing - Execution latencies for pipeline stages (M10/M11/M12)
 * @param {number|null} sensitiveRegionCount - Count of DOM sensitive regions detected (M11)
 * @param {Object|null} ocrStats - OCR-derived region metrics (M12)
 * @param {Object} [options={}] - M19.2 coordinate and viewport options
 * @returns {Object} Fused local perception object
 */
function buildLocalPerception(visualElements = [], visionResult = null, timing = {}, sensitiveRegionCount = null, ocrStats = null, options = {}) {
  const elements = Array.isArray(visualElements) ? visualElements : [];
  let visDetections = [];
  if (visionResult) {
    if (Array.isArray(visionResult)) {
      visDetections = visionResult;
    } else if (Array.isArray(visionResult.detections)) {
      visDetections = visionResult.detections;
    } else if (Array.isArray(visionResult.visualDetections)) {
      visDetections = visionResult.visualDetections;
    } else if (visionResult.detections && Array.isArray(visionResult.detections.detections)) {
      visDetections = visionResult.detections.detections;
    } else if (Array.isArray(visionResult.regions)) {
      visDetections = visionResult.regions;
    }
  }
  if (visDetections.length === 0 && Array.isArray(centralizedPerceptionState.visualDetections) && centralizedPerceptionState.visualDetections.length > 0) {
    visDetections = centralizedPerceptionState.visualDetections;
  }
  const ocrWords = (ocrStats && Array.isArray(ocrStats.words)) ? ocrStats.words : [];

  // Group elements by UI type
  const elementCounts = {
    buttons: 0,
    links: 0,
    inputs: 0,
    headings: 0,
    other: 0
  };

  elements.forEach((el) => {
    const type = (el && el.type ? el.type : "").toLowerCase();
    if (type === "button") {
      elementCounts.buttons++;
    } else if (type === "link") {
      elementCounts.links++;
    } else if (["input", "textarea", "select", "checkbox", "radio"].includes(type)) {
      elementCounts.inputs++;
    } else if (type === "heading") {
      elementCounts.headings++;
    } else {
      elementCounts.other++;
    }
  });

  // Perform spatial fusion with M19.2 canonical coordinates & spatial relationships
  const fusedElements = fuseVisualAndDOMResults(elements, visDetections, ocrWords, options);

  return {
    timestamp: new Date().toISOString(),
    visualElementsCount: elements.length,
    fusedElementsCount: fusedElements.length,
    elementCounts,
    elements: elements,
    fusedElements: fusedElements,
    visualDetections: visDetections,
    visualOnlyElements: centralizedPerceptionState.visualOnlyElements || [],
    spatialRelationships: centralizedPerceptionState.spatialRelationships || [],
    vision: visionResult ? {
      classIndex: visionResult.classIndex ?? null,
      confidence: visionResult.confidence ?? null,
      executionProvider: visionResult.executionProvider ?? "wasm",
      modelName: visionResult.modelName || "squeezenet1.1-7.onnx",
      detectionsCount: visDetections.length,
      status: "completed"
    } : {
      classIndex: null,
      confidence: null,
      executionProvider: null,
      modelName: null,
      detectionsCount: 0,
      status: "none"
    },
    privacy: {
      sensitiveRegionCount: typeof sensitiveRegionCount === "number" ? sensitiveRegionCount : null,
      ocrTextRegionCount: typeof ocrStats?.ocrTextRegionCount === "number" ? ocrStats.ocrTextRegionCount : null,
      ocrSensitiveRegionCount: typeof ocrStats?.ocrSensitiveRegionCount === "number" ? ocrStats.ocrSensitiveRegionCount : null,
      totalRedactedRegionCount: typeof ocrStats?.totalRedactedRegionCount === "number" ? ocrStats.totalRedactedRegionCount : null,
      onDeviceOnly: true,
      backendTransmitted: false
    },
    timing: {
      domExtractionMs: timing?.domExtractionMs ?? null,
      screenshotMs: timing?.screenshotMs ?? null,
      visionInferenceMs: timing?.visionInferenceMs ?? null,
      sensitiveRegionDetectionMs: timing?.sensitiveRegionDetectionMs ?? null,
      ocrInitMs: timing?.ocrInitMs ?? null,
      ocrInferenceMs: timing?.ocrInferenceMs ?? null,
      ocrSensitiveDetectionMs: timing?.ocrSensitiveDetectionMs ?? null,
      regionMergeMs: timing?.regionMergeMs ?? null,
      redactionMs: timing?.redactionMs ?? null,
      fusionMs: timing?.fusionMs ?? null
    },
    perceptionState: { ...centralizedPerceptionState }
  };
}

/**
 * Returns the current centralized visual perception state.
 * @returns {Object}
 */
function getPerceptionState() {
  return { ...centralizedPerceptionState };
}

/**
 * Updates properties of the centralized perception state.
 * @param {Object} patch 
 */
function updatePerceptionState(patch = {}) {
  Object.assign(centralizedPerceptionState, patch);
}

/**
 * Invalidates stale perception state (e.g. after meaningful page change or action).
 * @param {string} reason 
 */
function invalidatePerception(reason = "Page state invalidated") {
  console.log(`[SIH26171][VISION] Perception invalidated: ${reason}`);
  centralizedPerceptionState.ready = false;
  centralizedPerceptionState.changed = true;
  centralizedPerceptionState.reason = reason;
}

if (typeof window !== "undefined") {
  window.SIHFusion = {
    buildLocalPerception,
    fuseVisualAndDOMResults,
    computeSpatialOverlap,
    computeSpatialRelationships,
    normalizeDomBbox,
    normalizeVisualBbox,
    normalizeOcrBbox,
    toCanonicalBbox,
    getPerceptionState,
    updatePerceptionState,
    invalidatePerception
  };
  window.buildLocalPerception = buildLocalPerception;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    buildLocalPerception,
    fuseVisualAndDOMResults,
    computeSpatialOverlap,
    computeSpatialRelationships,
    normalizeDomBbox,
    normalizeVisualBbox,
    normalizeOcrBbox,
    toCanonicalBbox,
    getPerceptionState,
    updatePerceptionState,
    invalidatePerception,
    centralizedPerceptionState
  };
}

