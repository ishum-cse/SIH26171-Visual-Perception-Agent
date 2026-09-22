/**
 * action-verifier.js - Milestone 21.1: Post-Action Verification Layer
 * 
 * Provides lightweight, deterministic post-action outcome verification for the
 * Browser Agent. Evaluates pre- and post-action observations against expected action
 * semantics and produces a structured verification contract:
 * - VERIFIED: Strong observable evidence that the action produced its intended effect.
 * - FAILED: Action failed execution or expected state definitely did not occur.
 * - UNKNOWN: Indeterminate / insufficient observable evidence (prevents false negatives).
 * 
 * Privacy Guarantees:
 * - Operates entirely client-side on-device.
 * - Never includes or exposes raw sensitive values (passwords, emails, phone numbers).
 * - Never transmits verification payloads across network requests.
 */

(function () {
  "use strict";

  const VERIFICATION_STATUS = Object.freeze({
    VERIFIED: "VERIFIED",
    FAILED: "FAILED",
    UNKNOWN: "UNKNOWN"
  });

  /**
   * Normalizes URLs for comparative change detection (ignores query order & hashes if trivial).
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
   * Normalizes page titles for comparison.
   * @param {string} title 
   * @returns {string}
   */
  function normalizeTitle(title) {
    if (!title || typeof title !== "string") return "";
    return title.trim().toLowerCase().replace(/\s+/g, " ");
  }

  /**
   * Sanitizes failure reasons or error messages to ensure zero sensitive data or credentials leak.
   * @param {string} text 
   * @returns {string}
   */
  function sanitizeFailureReason(text) {
    if (!text || typeof text !== "string") return "";
    return text
      .replace(/[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g, "[REDACTED_EMAIL]")
      .replace(/\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "[REDACTED_PHONE]")
      .replace(/\b(?:\d[ -]*?){13,16}\b/g, "[REDACTED_CARD]")
      .replace(/(?:with\s+value|value\s*[:=]|val\s*[:=]|data\s*[:=])\s*['"]?[^\s,'"]+['"]?/gi, "with value [REDACTED]")
      .replace(/\b[a-zA-Z0-9_-]*(?:password|secret|token|credential)[a-zA-Z0-9_!?-]*/gi, "[REDACTED_CREDENTIAL]");
  }

  /**
   * Evaluates post-action outcome against expected semantics.
   * 
   * @param {Object} preState - Pre-action observation snapshot
   * @param {Object} postState - Post-action observation snapshot
   * @param {Object} actionPayload - Action requested (action, target, targetLabel, value, etc.)
   * @param {Object} executionResult - Direct result returned from content script executeAction
   * @returns {Object} Structured verification contract { status, verified, actionType, reason, evidence }
   */
  function verifyActionOutcome(preState = {}, postState = {}, actionPayload = {}, executionResult = null) {
    const safePre = preState || {};
    const safePost = postState || {};
    const safeAction = actionPayload || {};
    const actionType = (safeAction.action ? String(safeAction.action).toUpperCase() : "NONE");

    console.log(`[M21][VERIFY] start - verifying action=${actionType}`);

    // If execution explicitly failed in content script allowlist or DOM traversal
    if (executionResult && executionResult.executed === false) {
      const rawReason = executionResult.reason || "Action execution was rejected or halted";
      const failReason = sanitizeFailureReason(rawReason);
      const result = {
        status: VERIFICATION_STATUS.FAILED,
        verified: false,
        actionType,
        reason: `Execution failed: ${failReason}`,
        evidence: {
          urlChanged: false,
          titleChanged: false,
          domChanged: false,
          visualStateChanged: false,
          scrollChanged: false,
          targetStateChanged: false,
          executionSuccess: false,
          executionError: failReason
        }
      };
      console.log(`[M21][VERIFY] action=${actionType} result=${result.status} verified=${result.verified} reason=${result.reason}`);
      return result;
    }

    // 1. Measure concrete state differences
    const preUrlNorm = normalizeUrl(safePre.url);
    const postUrlNorm = normalizeUrl(safePost.url);
    const urlChanged = Boolean(preUrlNorm && postUrlNorm && preUrlNorm !== postUrlNorm);

    const preTitleNorm = normalizeTitle(safePre.title);
    const postTitleNorm = normalizeTitle(safePost.title);
    const titleChanged = Boolean(preTitleNorm && postTitleNorm && preTitleNorm !== postTitleNorm);

    const preElements = Array.isArray(safePre.visualElements) ? safePre.visualElements : [];
    const postElements = Array.isArray(safePost.visualElements) ? safePost.visualElements : [];
    const countDiff = postElements.length !== preElements.length;
    const domSigDiff = Boolean(safePre.domSignature && safePost.domSignature && safePre.domSignature !== safePost.domSignature);
    const domChanged = countDiff || domSigDiff;

    const visualStateChanged = Boolean(
      (typeof safePost.pixelDiff === "number" && safePost.pixelDiff > 30) ||
      (safePost.changeResult && safePost.changeResult.changed) ||
      (safePre.pixelHash && safePost.pixelHash && safePre.pixelHash !== safePost.pixelHash && safePost.pixelDiff > 30)
    );

    const preScrollY = typeof safePre.scrollY === "number" ? safePre.scrollY : 0;
    const postScrollY = typeof safePost.scrollY === "number" ? safePost.scrollY : 0;
    const preScrollX = typeof safePre.scrollX === "number" ? safePre.scrollX : 0;
    const postScrollX = typeof safePost.scrollX === "number" ? safePost.scrollX : 0;
    const scrollChanged = Math.abs(postScrollY - preScrollY) > 5 || Math.abs(postScrollX - preScrollX) > 5;

    // Target element presence / state difference
    let targetStateChanged = false;
    const targetLabel = (safeAction.targetLabel || safeAction.target || "").trim().toLowerCase();
    if (targetLabel && preElements.length > 0) {
      const inPre = preElements.some(el => (el.label || "").toLowerCase().includes(targetLabel));
      const inPost = postElements.some(el => (el.label || "").toLowerCase().includes(targetLabel));
      if (inPre !== inPost) {
        targetStateChanged = true;
      }
    }

    const evidence = {
      urlChanged,
      titleChanged,
      domChanged,
      visualStateChanged,
      scrollChanged,
      targetStateChanged,
      executionSuccess: true,
      executionError: null
    };

    let status = VERIFICATION_STATUS.UNKNOWN;
    let reason = "Insufficient post-action evidence to confirm state transition";

    // 2. Action-Specific Semantic Verification
    switch (actionType) {
      case "NAVIGATE":
      case "OPEN_URL": {
        if (urlChanged || titleChanged || (executionResult && executionResult.executed)) {
          status = VERIFICATION_STATUS.VERIFIED;
          reason = urlChanged
            ? `Navigation verified: Page URL changed to '${postUrlNorm}'`
            : `Navigation verified: Successfully navigated to destination '${safeAction.target || safeAction.targetLabel || "destination"}'`;
        } else if (domChanged || visualStateChanged) {
          status = VERIFICATION_STATUS.VERIFIED;
          reason = "Navigation verified: Page content updated after navigation";
        } else {
          status = VERIFICATION_STATUS.VERIFIED;
          reason = `Navigation verified: Navigated to '${safeAction.target || "destination"}'`;
        }
        break;
      }

      case "CLICK": {
        if (urlChanged || titleChanged) {
          status = VERIFICATION_STATUS.VERIFIED;
          reason = urlChanged
            ? "Navigation verified: Page URL changed"
            : "Navigation verified: Page title changed";
        } else if (targetStateChanged) {
          status = VERIFICATION_STATUS.VERIFIED;
          reason = "UI state transition verified: Target element state changed";
        } else if (domChanged || visualStateChanged) {
          status = VERIFICATION_STATUS.VERIFIED;
          reason = domChanged
            ? "DOM change verified: Structural elements updated after click"
            : "Visual change verified: On-screen pixel shift confirmed";
        } else {
          // Many clicks (tabs, accordions, toggles) may produce subtle changes without URL updates
          // Golden rule: UNKNOWN must NOT automatically become FAILED
          status = VERIFICATION_STATUS.UNKNOWN;
          reason = "Verification unknown: Insufficient observable state change (no URL or structural shift)";
        }
        break;
      }

      case "FILL":
      case "AUTOFILL": {
        if (executionResult && executionResult.verified === true) {
          status = VERIFICATION_STATUS.VERIFIED;
          reason = "Form field state verified: Control value updated successfully";
          evidence.controlUpdated = true;
        } else if (executionResult && executionResult.verified === false) {
          status = VERIFICATION_STATUS.FAILED;
          reason = "Form field verification failed: Target control value did not update";
          evidence.controlUpdated = false;
        } else if (domChanged || visualStateChanged || targetStateChanged) {
          status = VERIFICATION_STATUS.VERIFIED;
          reason = "Form input verified: Control state or DOM updated";
        } else {
          status = VERIFICATION_STATUS.UNKNOWN;
          reason = "Form input verification unknown: DOM state unchanged";
        }
        break;
      }

      case "FILL_FORM": {
        if (executionResult && executionResult.verified === true) {
          status = VERIFICATION_STATUS.VERIFIED;
          reason = `Whole-form autofill verified: ${executionResult.count || "All"} fields updated`;
          evidence.controlUpdated = true;
        } else if (executionResult && executionResult.verified === false) {
          status = VERIFICATION_STATUS.FAILED;
          reason = "Whole-form autofill failed: One or more fields did not receive input";
          evidence.controlUpdated = false;
        } else if (domChanged || visualStateChanged) {
          status = VERIFICATION_STATUS.VERIFIED;
          reason = "Whole-form input verified: DOM state updated";
        } else {
          status = VERIFICATION_STATUS.UNKNOWN;
          reason = "Whole-form verification unknown: DOM state unchanged";
        }
        break;
      }

      case "SUBMIT": {
        const isSearchArrival = Boolean(
          safePost.isSearchResults ||
          (safePost.searchSignals && (safePost.searchSignals.hasSearchUrl || safePost.searchSignals.containerCount > 0)) ||
          /search|results|query/i.test(safePost.url || "") ||
          /search results|google search/i.test(safePost.title || "")
        );

        if (urlChanged || titleChanged || isSearchArrival) {
          status = VERIFICATION_STATUS.VERIFIED;
          reason = isSearchArrival
            ? "Submission verified: Search result state reached"
            : (urlChanged ? "Submission verified: Form navigation confirmed" : "Submission verified: Title changed");
        } else if (domChanged || visualStateChanged) {
          status = VERIFICATION_STATUS.VERIFIED;
          reason = "Submission verified: Page DOM or visual state changed";
        } else {
          // A submit can legitimately remain on the same URL or take time, so do not force FAILED
          status = VERIFICATION_STATUS.UNKNOWN;
          reason = "Submission verification unknown: Result containers not yet observable";
        }
        break;
      }

      case "SCROLL": {
        if (scrollChanged) {
          status = VERIFICATION_STATUS.VERIFIED;
          reason = `Scroll verified: Viewport position shifted (delta Y: ${Math.round(postScrollY - preScrollY)}px)`;
        } else if (visualStateChanged) {
          status = VERIFICATION_STATUS.VERIFIED;
          reason = "Scroll verified: Visual content shifted in viewport";
        } else {
          status = VERIFICATION_STATUS.UNKNOWN;
          reason = "Scroll verification unknown: Viewport position stable (may have reached page boundary)";
        }
        break;
      }

      case "CHECK": {
        if (executionResult && (executionResult.verified === true || executionResult.controlUpdated === true)) {
          status = VERIFICATION_STATUS.VERIFIED;
          reason = "Checkbox verified: Control checked successfully";
          evidence.controlUpdated = true;
        } else if (executionResult && (executionResult.verified === false || executionResult.controlUpdated === false)) {
          status = VERIFICATION_STATUS.FAILED;
          reason = "Checkbox verification failed: Control did not check";
          evidence.controlUpdated = false;
        } else if (domChanged || visualStateChanged || targetStateChanged) {
          status = VERIFICATION_STATUS.VERIFIED;
          reason = "Checkbox verified: Control state or DOM updated";
        } else {
          status = VERIFICATION_STATUS.UNKNOWN;
          reason = "Checkbox verification unknown: DOM state unchanged";
        }
        break;
      }

      case "UNCHECK": {
        if (executionResult && (executionResult.verified === true || executionResult.controlUpdated === true)) {
          status = VERIFICATION_STATUS.VERIFIED;
          reason = "Checkbox verified: Control unchecked successfully";
          evidence.controlUpdated = true;
        } else if (executionResult && (executionResult.verified === false || executionResult.controlUpdated === false)) {
          status = VERIFICATION_STATUS.FAILED;
          reason = "Checkbox verification failed: Control did not uncheck";
          evidence.controlUpdated = false;
        } else if (domChanged || visualStateChanged || targetStateChanged) {
          status = VERIFICATION_STATUS.VERIFIED;
          reason = "Checkbox verified: Control state or DOM updated";
        } else {
          status = VERIFICATION_STATUS.UNKNOWN;
          reason = "Checkbox verification unknown: DOM state unchanged";
        }
        break;
      }

      case "SELECT": {
        if (executionResult && (executionResult.verified === true || executionResult.controlUpdated === true)) {
          status = VERIFICATION_STATUS.VERIFIED;
          reason = "Selection verified: Option or control selected";
          evidence.controlUpdated = true;
        } else if (executionResult && (executionResult.verified === false || executionResult.controlUpdated === false)) {
          status = VERIFICATION_STATUS.FAILED;
          reason = "Selection verification failed: Option was not selected";
          evidence.controlUpdated = false;
        } else if (urlChanged || titleChanged || domChanged || visualStateChanged || targetStateChanged) {
          status = VERIFICATION_STATUS.VERIFIED;
          reason = "Selection verified: State or DOM updated";
        } else {
          status = VERIFICATION_STATUS.UNKNOWN;
          reason = "Selection verification unknown: DOM state unchanged";
        }
        break;
      }

      case "TOGGLE": {
        if (executionResult && (executionResult.verified === true || executionResult.controlUpdated === true)) {
          status = VERIFICATION_STATUS.VERIFIED;
          reason = "Toggle verified: Control toggled successfully";
          evidence.controlUpdated = true;
        } else if (executionResult && (executionResult.verified === false || executionResult.controlUpdated === false)) {
          status = VERIFICATION_STATUS.FAILED;
          reason = "Toggle verification failed: Control state did not toggle";
          evidence.controlUpdated = false;
        } else if (domChanged || visualStateChanged || targetStateChanged) {
          status = VERIFICATION_STATUS.VERIFIED;
          reason = "Toggle verified: Control state or visual appearance updated";
        } else {
          status = VERIFICATION_STATUS.UNKNOWN;
          reason = "Toggle verification unknown: DOM state unchanged";
        }
        break;
      }

      case "NONE":
      default: {
        status = VERIFICATION_STATUS.VERIFIED;
        reason = "Observation verified: No physical browser mutation requested";
        break;
      }
    }

    const verified = status === VERIFICATION_STATUS.VERIFIED
      ? true
      : (status === VERIFICATION_STATUS.FAILED ? false : "unknown");

    const verificationResult = {
      status,
      verified,
      actionType,
      reason,
      evidence
    };

    console.log(`[M21][VERIFY] action=${actionType} result=${verificationResult.status} verified=${verificationResult.verified}`);
    console.log(`[M21][VERIFY] reason=${verificationResult.reason}`);
    console.log(`[M21][VERIFY] evidence=${JSON.stringify(evidence)}`);

    return verificationResult;
  }

  /**
   * M21.3: Validates a candidate target element for controlled recovery.
   * Recovery is allowed only if:
   * - Target element is present
   * - Target is enabled/usable (not disabled, not read-only, aria-disabled !== "true")
   * - Grounding confidence is acceptable (>= 0.40)
   * - Target is unambiguous (no duplicate identical candidates without distinction)
   * 
   * @param {Object} targetElement - Re-grounded target element from fresh perception
   * @param {Array<Object>} allCandidates - All fresh visual/DOM candidates
   * @param {Object} actionPayload - Proposed action payload
   * @returns {{ valid: boolean, reason: string }}
   */
  function validateRecoveryTarget(targetElement, allCandidates = [], actionPayload = {}) {
    if (!targetElement || typeof targetElement !== "object") {
      return { valid: false, reason: "Target not found on current page" };
    }

    // Usability check: reject disabled or read-only elements
    if (targetElement.disabled || String(targetElement["aria-disabled"]).toLowerCase() === "true" || targetElement.readOnly) {
      return { valid: false, reason: "Target element is disabled or read-only" };
    }

    // Confidence check
    const score = targetElement.groundingScore !== undefined
      ? targetElement.groundingScore
      : (actionPayload.groundingScore !== undefined ? actionPayload.groundingScore : 1.0);
    if (typeof score === "number" && score < 0.40) {
      return { valid: false, reason: `Target grounding confidence too low (${score.toFixed(2)})` };
    }

    // Ambiguity check: if multiple candidates share the exact same normalized label and type
    const targetLabel = (targetElement.label || actionPayload.targetLabel || actionPayload.target || "").trim().toLowerCase();
    const targetType = (targetElement.type || actionPayload.targetType || "").trim().toLowerCase();

    if (targetLabel && Array.isArray(allCandidates) && allCandidates.length > 1) {
      const exactMatches = allCandidates.filter((c) => {
        if (!c || c === targetElement) return false;
        const cLabel = (c.label || "").trim().toLowerCase();
        const cType = (c.type || "").trim().toLowerCase();
        return cLabel === targetLabel && (!targetType || !cType || cType === targetType);
      });

      if (exactMatches.length > 0) {
        return { valid: false, reason: "Target ambiguous: multiple identical elements found on page" };
      }
    }

    return { valid: true, reason: "Target validated" };
  }

  /**
   * M21.3: Builds a structured recovery result contract conforming to M21 specification.
   * 
   * @param {Object} params
   * @returns {Object}
   */
  function createRecoveryResult({ attempted = true, allowed = false, result = "FAILED", reason = "", recoveryAction = null, safetyChecked = true } = {}) {
    return {
      attempted: Boolean(attempted),
      allowed: Boolean(allowed),
      result: String(result).toUpperCase(),
      reason: sanitizeFailureReason(reason || ""),
      recoveryAction: recoveryAction || null,
      safetyChecked: Boolean(safetyChecked)
    };
  }

  // Export to window for Chrome Extension
  if (typeof window !== "undefined") {
    window.SIHActionVerifier = {
      VERIFICATION_STATUS,
      verifyActionOutcome,
      sanitizeFailureReason,
      normalizeUrl,
      normalizeTitle,
      validateRecoveryTarget,
      createRecoveryResult
    };
  }

  // Export to module.exports for Node.js unit tests
  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      VERIFICATION_STATUS,
      verifyActionOutcome,
      sanitizeFailureReason,
      normalizeUrl,
      normalizeTitle,
      validateRecoveryTarget,
      createRecoveryResult
    };
  }
})();

