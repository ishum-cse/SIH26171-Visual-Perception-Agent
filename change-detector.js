/**
 * change-detector.js - Milestone 14: On-device Local Screen-Change Detection
 * Computes lightweight perceptual image fingerprints and DOM structure signatures
 * to verify whether an executed agent action produced a meaningful screen change.
 *
 * Privacy & Security Guarantees:
 * - Operates entirely client-side on-device using the HTML5 Canvas API.
 * - Computes coarse, downsampled (32x32) perceptual average-hashes; never persists images.
 * - Computes structural DOM signatures from existing M8 element descriptors; never reads input values.
 * - Signatures are purely local and are NEVER transmitted over any network request.
 */

// Configurable perceptual difference threshold (Hamming distance on 1024-bit hash)
// ~3% of pixels differing indicates a visible change on downsampled 32x32 canvas
const PIXEL_CHANGE_THRESHOLD = 30;

/**
 * Computes a lightweight FNV-1a 32-bit string hash.
 * Used for fast, deterministic hashing of sorted DOM element descriptors.
 *
 * @param {string} str - String to hash
 * @returns {string} Hexadecimal hash string
 */
function hashString(str) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/**
 * Computes a compact perceptual screen signature from a screenshot data URL and DOM elements.
 *
 * @param {string} screenshotDataUrl - Screenshot image data URL (data:image/...)
 * @param {Array<Object>} visualElements - Array of M8 visual element descriptors
 * @returns {Promise<Object>} { pixelHash: string, domSignature: string, elementCount: number, timestamp: number }
 */
function computeScreenSignature(screenshotDataUrl, visualElements = []) {
  return new Promise((resolve) => {
    const timestamp = Date.now();
    const elements = Array.isArray(visualElements) ? visualElements : [];
    const elementCount = elements.length;

    // 1. Compute lightweight DOM structural signature
    const sortedSummary = elements
      .map((el) => `${el.type || ""}:${el.label || ""}:${el.semanticTag || ""}`)
      .sort()
      .join("|");
    const domSignature = hashString(sortedSummary);

    // 2. Compute 32x32 perceptual average-hash from screenshot
    if (!screenshotDataUrl || typeof screenshotDataUrl !== "string" || !screenshotDataUrl.startsWith("data:image/")) {
      return resolve({
        pixelHash: "0".repeat(1024),
        domSignature,
        elementCount,
        timestamp
      });
    }

    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          return resolve({
            pixelHash: "0".repeat(1024),
            domSignature,
            elementCount,
            timestamp
          });
        }

        // Downsample image to 32x32
        ctx.drawImage(img, 0, 0, 32, 32);
        const imgData = ctx.getImageData(0, 0, 32, 32);
        const data = imgData.data;

        // Compute luminance for each pixel and calculate mean luminance
        const luminances = new Float32Array(1024);
        let sumLuminance = 0;

        for (let i = 0; i < 1024; i++) {
          const idx = i * 4;
          // Standard ITU-R BT.601 perceptual luminance
          const y = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
          luminances[i] = y;
          sumLuminance += y;
        }

        const meanLuminance = sumLuminance / 1024;

        // Generate 1024-bit binary string (1 if >= mean, else 0)
        let pixelHash = "";
        for (let i = 0; i < 1024; i++) {
          pixelHash += luminances[i] >= meanLuminance ? "1" : "0";
        }

        resolve({
          pixelHash,
          domSignature,
          elementCount,
          timestamp
        });
      } catch (err) {
        console.warn("computeScreenSignature canvas error:", err);
        resolve({
          pixelHash: "0".repeat(1024),
          domSignature,
          elementCount,
          timestamp
        });
      }
    };

    img.onerror = () => {
      resolve({
        pixelHash: "0".repeat(1024),
        domSignature,
        elementCount,
        timestamp
      });
    };

    img.src = screenshotDataUrl;
  });
}

/**
 * Computes Hamming distance between two binary hash strings.
 *
 * @param {string} hashA - First binary string
 * @param {string} hashB - Second binary string
 * @returns {number} Count of differing bits
 */
function computeHammingDistance(hashA = "", hashB = "") {
  if (!hashA || !hashB || hashA.length !== hashB.length) {
    return 1024;
  }
  let dist = 0;
  for (let i = 0; i < hashA.length; i++) {
    if (hashA[i] !== hashB[i]) {
      dist++;
    }
  }
  return dist;
}

// Meaningful Change Classification Levels
const CHANGE_LEVELS = Object.freeze({
  NO_CHANGE: "NO_CHANGE",
  MINOR_CHANGE: "MINOR_CHANGE",
  MEANINGFUL_CHANGE: "MEANINGFUL_CHANGE",
  MAJOR_CHANGE: "MAJOR_CHANGE"
});

/**
 * Compares two screen signatures to determine if a meaningful visual or DOM change occurred.
 * Classifies changes into: NO_CHANGE, MINOR_CHANGE, MEANINGFUL_CHANGE, MAJOR_CHANGE.
 *
 * @param {Object|null} prev - Previous screen signature
 * @param {Object|null} current - Current screen signature
 * @param {number} pixelThreshold - Configurable Hamming distance threshold
 * @returns {Object} { changed: boolean, changeLevel: string, reason: string, pixelDiff: number, domDiff: boolean }
 */
function compareScreenSignatures(prev, current, pixelThreshold = PIXEL_CHANGE_THRESHOLD) {
  if (!prev || !current) {
    return {
      changed: true,
      changeLevel: CHANGE_LEVELS.MAJOR_CHANGE,
      reason: "Initial observation (no previous signature)",
      pixelDiff: 0,
      domDiff: false
    };
  }

  const pixelDiff = computeHammingDistance(prev.pixelHash, current.pixelHash);
  const countDiff = current.elementCount !== prev.elementCount;
  const domDiff = current.domSignature !== prev.domSignature;

  // 1. Structural DOM count change (e.g. modal appeared, elements added/removed) -> MAJOR_CHANGE
  if (countDiff) {
    return {
      changed: true,
      changeLevel: CHANGE_LEVELS.MAJOR_CHANGE,
      reason: `DOM structure changed (element count ${prev.elementCount} -> ${current.elementCount})`,
      pixelDiff,
      domDiff: true
    };
  }

  // 2. Large visual shift (>= 100 bits) -> MAJOR_CHANGE
  if (pixelDiff >= 100) {
    return {
      changed: true,
      changeLevel: CHANGE_LEVELS.MAJOR_CHANGE,
      reason: `Major visual shift (${pixelDiff} bits changed >= 100)`,
      pixelDiff,
      domDiff
    };
  }

  // 3. Structural DOM content change (e.g. text or labels changed while count remained equal) -> MEANINGFUL_CHANGE
  if (domDiff) {
    return {
      changed: true,
      changeLevel: CHANGE_LEVELS.MEANINGFUL_CHANGE,
      reason: `DOM element labels changed (signature ${prev.domSignature} -> ${current.domSignature})`,
      pixelDiff,
      domDiff: true
    };
  }

  // 4. Perceptual pixel change exceeding threshold -> MEANINGFUL_CHANGE
  if (pixelDiff >= pixelThreshold) {
    return {
      changed: true,
      changeLevel: CHANGE_LEVELS.MEANINGFUL_CHANGE,
      reason: `Visual difference exceeded threshold (${pixelDiff} bits changed >= ${pixelThreshold})`,
      pixelDiff,
      domDiff: false
    };
  }

  // 5. Minor perceptual difference (< threshold but > 5) -> MINOR_CHANGE
  if (pixelDiff > 5) {
    return {
      changed: false,
      changeLevel: CHANGE_LEVELS.MINOR_CHANGE,
      reason: `Minor sub-threshold pixel fluctuation (${pixelDiff} bits changed < ${pixelThreshold})`,
      pixelDiff,
      domDiff: false
    };
  }

  // 6. No meaningful change detected -> NO_CHANGE
  return {
    changed: false,
    changeLevel: CHANGE_LEVELS.NO_CHANGE,
    reason: `No meaningful change detected (${pixelDiff} bits changed < ${pixelThreshold})`,
    pixelDiff,
    domDiff: false
  };
}

/**
 * Normalizes URL for stable comparisons.
 * @param {string} url
 * @returns {string}
 */
function normalizeUrl(url) {
  if (!url || typeof url !== "string") return "";
  try {
    const parsed = new URL(url);
    return (parsed.origin + parsed.pathname + parsed.search).toLowerCase();
  } catch (_) {
    return url.trim().toLowerCase();
  }
}

/**
 * Normalizes title for stable comparisons.
 * @param {string} title
 * @returns {string}
 */
function normalizeTitle(title) {
  if (!title || typeof title !== "string") return "";
  return title.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Milestone 22.2: Generates a fast, lightweight structural page signature from DOM
 * elements and page metadata without screenshot capture, canvas rendering, OCR, or reading form values.
 *
 * Privacy Guarantees:
 * - NEVER reads or includes element.value, input contents, passwords, or raw form data.
 * - Only structural metadata (type, label, semanticTag, disabled state, coarse bounds) is hashed.
 *
 * @param {Array<Object>} elements - List of visible interactive element descriptors
 * @param {Object} metadata - { url, title, viewport: { scrollX, scrollY, width, height } }
 * @returns {Object} Lightweight signature object
 */
function computeLightweightDomSignature(elements = [], metadata = {}) {
  const normUrl = normalizeUrl(metadata.url || "");
  const normTitle = normalizeTitle(metadata.title || "");
  const vp = metadata.viewport || {};
  const elList = Array.isArray(elements) ? elements : [];

  // 1. Structural hash: sorted summary of element type, label, semantic tag, and disabled state
  // STRICT PRIVACY: NEVER inspects or includes el.value, el.inputValue, password, or textarea content
  const sortedStructure = elList
    .map((el) => {
      const type = el.type || "";
      const label = el.label || "";
      const tag = el.semanticTag || "";
      const disabled = el.disabled ? "1" : "0";
      return `${type}:${label}:${tag}:${disabled}`;
    })
    .sort()
    .join("|");
  const domHash = hashString(sortedStructure);

  // 2. Coarse bounding box hash: element coordinates rounded to 10px buckets
  // Detects layout shifts, dynamic insertions, or reflows while being immune to sub-pixel noise
  const sortedBboxes = elList
    .map((el) => {
      const type = el.type || "";
      const cx = Math.round((el.x || 0) / 10) * 10;
      const cy = Math.round((el.y || 0) / 10) * 10;
      const cw = Math.round((el.width || 0) / 10) * 10;
      const ch = Math.round((el.height || 0) / 10) * 10;
      return `${type}:${cx}:${cy}:${cw}:${ch}`;
    })
    .sort()
    .join("|");
  const bboxHash = hashString(sortedBboxes);

  return {
    url: normUrl,
    title: normTitle,
    elementCount: elList.length,
    domHash,
    bboxHash,
    scrollX: Math.round(vp.scrollX || 0),
    scrollY: Math.round(vp.scrollY || 0),
    viewportWidth: Math.round(vp.width || 0),
    viewportHeight: Math.round(vp.height || 0),
    timestamp: Date.now()
  };
}

/**
 * Milestone 22.2: Compares two lightweight DOM signatures to determine if a page state change occurred.
 *
 * @param {Object|null} prev - Previous lightweight signature
 * @param {Object|null} current - Current lightweight signature
 * @returns {Object} { changed: boolean, reason: string }
 */
function compareLightweightSignatures(prev, current) {
  if (!prev || !current) {
    return { changed: true, reason: "Initial or missing page signature" };
  }
  if (prev.url !== current.url) {
    return { changed: true, reason: `URL changed (${prev.url} -> ${current.url})` };
  }
  if (prev.title !== current.title) {
    return { changed: true, reason: `Title changed (${prev.title} -> ${current.title})` };
  }
  if (prev.elementCount !== current.elementCount) {
    return { changed: true, reason: `Interactive element count changed (${prev.elementCount} -> ${current.elementCount})` };
  }
  if (prev.domHash !== current.domHash) {
    return { changed: true, reason: "Structural DOM signature or labels changed" };
  }
  if (prev.bboxHash !== current.bboxHash) {
    return { changed: true, reason: "Element layout or positions shifted" };
  }
  if (Math.abs((prev.scrollX || 0) - (current.scrollX || 0)) > 10 || Math.abs((prev.scrollY || 0) - (current.scrollY || 0)) > 10) {
    return { changed: true, reason: "Viewport scroll position changed" };
  }
  return { changed: false, reason: "Page structure, elements, and layout identical" };
}

const PERCEPTION_CACHE_TTL_MS = 10000;

/**
 * Milestone 22.2: Evaluates whether the cached on-device visual perception state
 * can safely be reused for the current step without running expensive screenshot,
 * OCR, SqueezeNet, and spatial fusion passes.
 *
 * @param {Object} params
 * @param {string} [params.lastAction] - Type of previous action executed ("FILL", "CLICK", "SUBMIT", "SCROLL", etc.)
 * @param {string} [params.nextActionType] - Type of next planned action if known
 * @param {Object|null} [params.previousSignature] - Cached lightweight DOM signature from prior step
 * @param {Object|null} [params.currentSignature] - Freshly probed lightweight DOM signature
 * @param {number} [params.currentStep] - 1-based index of current agent loop step
 * @param {Object|null} [params.verificationResult] - Verification outcome of previous action
 * @param {number} [params.cachedAt] - Timestamp when current perception cache was generated
 * @param {boolean} [params.forceFresh] - Explicit override forcing fresh perception
 * @param {boolean} [params.hasCachedData] - Whether perception variables (fused elements, DOM elements) exist
 * @returns {{ canReuse: boolean, reason: string }}
 */
function canReusePerception({
  lastAction = null,
  nextActionType = null,
  previousSignature = null,
  currentSignature = null,
  currentStep = 1,
  verificationResult = null,
  cachedAt = 0,
  forceFresh = false,
  hasCachedData = false
} = {}) {
  // 1. Initial Step (Step 1) must always execute full baseline perception
  if (currentStep <= 1) {
    return { canReuse: false, reason: "FRESH — Initial observation (Step 1)" };
  }

  // 2. Explicit force fresh (e.g. controlled recovery or caller directive)
  if (forceFresh) {
    return { canReuse: false, reason: "FRESH — Forced by recovery or directive" };
  }

  // 3. Cached data availability check
  if (!hasCachedData) {
    return { canReuse: false, reason: "FRESH — No cached perception available" };
  }

  // 4. Cache TTL expiration check (PERCEPTION_CACHE_TTL_MS = 10000ms)
  const ageMs = Date.now() - (cachedAt || 0);
  if (ageMs > PERCEPTION_CACHE_TTL_MS) {
    return { canReuse: false, reason: `FRESH — Perception cache expired (${Math.round(ageMs / 1000)}s > ${PERCEPTION_CACHE_TTL_MS / 1000}s TTL)` };
  }

  // 5. Actions that MUST force fresh perception:
  const normLast = (lastAction || "").toUpperCase();
  if (normLast === "CLICK") {
    return { canReuse: false, reason: "FRESH — Forced by CLICK (possible UI navigation/modal)" };
  }
  if (normLast === "SUBMIT") {
    return { canReuse: false, reason: "FRESH — Forced by SUBMIT (form submission/transition)" };
  }
  if (normLast === "SCROLL") {
    return { canReuse: false, reason: "FRESH — Forced by SCROLL (viewport coordinates shifted)" };
  }
  // M23: State-changing contextual actions force fresh perception
  if (["CHECK", "UNCHECK", "SELECT", "TOGGLE"].includes(normLast)) {
    return { canReuse: false, reason: `FRESH — Forced by ${normLast} (state-changing contextual action)` };
  }

  // 6. If next planned action is explicitly SCROLL or SUBMIT:
  const normNext = (nextActionType || "").toUpperCase();
  if (normNext === "SCROLL") {
    return { canReuse: false, reason: "FRESH — Forced by upcoming SCROLL" };
  }
  if (normNext === "SUBMIT") {
    return { canReuse: false, reason: "FRESH — Forced by upcoming SUBMIT" };
  }

  // 7. Verification outcome of previous action:
  if (verificationResult) {
    if (verificationResult.status === "FAILED") {
      return { canReuse: false, reason: "FRESH — Prior action verification FAILED" };
    }
    if (verificationResult.status === "UNKNOWN") {
      return { canReuse: false, reason: "FRESH — Verification Uncertain (Prior action status UNKNOWN)" };
    }
  }

  // 8. Signatures presence
  if (!previousSignature || !currentSignature) {
    return { canReuse: false, reason: "FRESH — Missing page state signature" };
  }

  // 9. Compare signatures using compareLightweightSignatures
  const comp = compareLightweightSignatures(previousSignature, currentSignature);
  if (comp.changed) {
    return { canReuse: false, reason: `FRESH — Page Changed (${comp.reason})` };
  }

  // 10. All checks passed: safe for adaptive perception reuse
  return { canReuse: true, reason: "REUSED — Stable Page" };
}

if (typeof window !== "undefined") {
  window.SIHChangeDetector = {
    computeScreenSignature,
    compareScreenSignatures,
    computeLightweightDomSignature,
    compareLightweightSignatures,
    canReusePerception,
    computeHammingDistance,
    hashString,
    normalizeUrl,
    normalizeTitle,
    PIXEL_CHANGE_THRESHOLD,
    CHANGE_LEVELS,
    PERCEPTION_CACHE_TTL_MS
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    computeScreenSignature,
    compareScreenSignatures,
    computeLightweightDomSignature,
    compareLightweightSignatures,
    canReusePerception,
    computeHammingDistance,
    hashString,
    normalizeUrl,
    normalizeTitle,
    PIXEL_CHANGE_THRESHOLD,
    CHANGE_LEVELS,
    PERCEPTION_CACHE_TTL_MS
  };
}
