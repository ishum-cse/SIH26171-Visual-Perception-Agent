/**
 * content.js - Content script injected into web pages
 * Milestones 1–6: Page metadata capture, local PII redaction, and safe whitelisted execution (CLICK, SCROLL).
 */

// Explicit, local whitelist mappings for permitted actions.
// Security: Restricts execution strictly to known targets and prevents arbitrary code injection.
const ACTION_TARGET_MAP = {
  "SUBMIT_BUTTON": "#submit-button",
  "LOGIN_BUTTON": "#login-button",
  "NEXT_BUTTON": "#next-button",
  "SEARCH_INPUT": "#search-input"
};

const SCROLL_TARGET_MAP = {
  "PAGE": "window"
};

// Hardcoded safe numeric boundaries for SCROLL actions
const MIN_SCROLL_AMOUNT = 0;
const MAX_SCROLL_AMOUNT = 2000;

/**
 * Milestone 14: Assigns safe pre-registered semantic tags based purely on visible element type and label.
 * Local pattern-matching only; never reads or inspects .value.
 *
 * @param {string} type - UI element type ("button", "link", "input", etc.)
 * @param {string} label - Visible text or placeholder string
 * @param {Element} [el] - DOM element
 * @returns {string|null} Pre-registered semantic tag or null
 */
function getSemanticTag(type, label, el = null) {
  const normLabel = (label || "").toLowerCase();
  const elId = (el && el.id ? el.id : "").toLowerCase();
  const elName = (el && el.getAttribute ? (el.getAttribute("name") || "") : "").toLowerCase();

  if (type === "button" || type === "link") {
    if (/submit/i.test(normLabel) || /submit/i.test(elId) || /submit/i.test(elName)) {
      return "SUBMIT_BUTTON";
    }
    if (/login|sign in|log in/i.test(normLabel) || /login/i.test(elId) || /login/i.test(elName)) {
      return "LOGIN_BUTTON";
    }
    if (/next|continue|proceed/i.test(normLabel) || /next/i.test(elId) || /next/i.test(elName)) {
      return "NEXT_BUTTON";
    }
  } else if (type === "input") {
    if (/search/i.test(normLabel) || /search/i.test(elId) || /search/i.test(elName) || (el && el.type === "search")) {
      return "SEARCH_INPUT";
    }
  }
  return null;
}

/**
 * Normalizes label text for safe comparison.
 * Trims punctuation, colons, asterisks, and excessive whitespace.
 * @param {string} s
 * @returns {string}
 */
function normalizeLabel(s) {
  return (s || "")
    .toLowerCase()
    .replace(/[:*#_\-\/\\]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Checks if two element labels match with fuzzy tolerance.
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function labelsMatch(a, b) {
  const na = normalizeLabel(a);
  const nb = normalizeLabel(b);
  if (!na || !nb) return false;
  return na === nb || na.startsWith(nb) || nb.startsWith(na) || na.includes(nb) || nb.includes(na);
}

/**
 * M23: Finds a container or section element matching context description.
 * Searches headings, section tags, aria-labels, roles, and structural containers.
 * @param {string} contextDesc
 * @returns {Element|null}
 */
function findContextElement(contextDesc) {
  if (!contextDesc || typeof contextDesc !== "string") return null;
  const normCtx = normalizeLabel(contextDesc);
  if (!normCtx) return null;

  // 1. Containers with matching aria-label, title, id, or className
  const containers = Array.from(document.querySelectorAll("section, fieldset, [role='region'], [role='group'], form, div, details, aside, nav, article, [data-section]"));
  for (const container of containers) {
    if (!getVisibleRect(container)) continue;
    const ariaLabel = normalizeLabel(container.getAttribute("aria-label") || container.getAttribute("title") || "");
    if (ariaLabel && (ariaLabel === normCtx || ariaLabel.includes(normCtx) || normCtx.includes(ariaLabel))) {
      return container;
    }
    const idOrClass = normalizeLabel(`${container.id} ${container.className}`);
    if (idOrClass && (idOrClass.includes(normCtx) || normCtx.includes(idOrClass))) {
      return container;
    }
  }

  // 2. Headings with matching text -> resolve to parent section/container
  const headings = Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, h6, legend, [role='heading'], summary, strong, b"));
  for (const heading of headings) {
    if (!getVisibleRect(heading)) continue;
    const hText = normalizeLabel(heading.innerText || heading.textContent || "");
    if (hText && (hText === normCtx || hText.includes(normCtx) || normCtx.includes(hText))) {
      const parentContainer = heading.closest("section, fieldset, [role='region'], [role='group'], form, .section, .container, .group, div");
      return parentContainer || heading.parentElement || heading;
    }
  }

  // 3. Fallback: visual element matching context label -> resolve to its container
  const allVisual = extractVisualElementsWithNodes();
  for (const item of allVisual) {
    if (item.node && item.node.isConnected && labelsMatch(item.label, contextDesc)) {
      const parentContainer = item.node.closest("section, fieldset, [role='region'], [role='group'], form, div") || item.node.parentElement;
      return parentContainer || item.node;
    }
  }

  return null;
}

/**
 * M23: Filters candidate elements to those contained within or associated with contextElement.
 * Uses both DOM tree containment and spatial layout containment.
 * @param {Array<Object>} candidates
 * @param {Element} contextEl
 * @returns {Array<Object>}
 */
function filterCandidatesByContext(candidates, contextEl) {
  if (!contextEl || !Array.isArray(candidates)) return candidates;
  const ctxRect = typeof contextEl.getBoundingClientRect === "function" ? getVisibleRect(contextEl) : null;
  return candidates.filter(cand => {
    if (!cand || !cand.node || !cand.node.isConnected) return false;
    // 1. Direct DOM containment
    if (contextEl.contains(cand.node) && cand.node !== contextEl) {
      return true;
    }
    // 2. Spatial bounding box containment with margin tolerance
    if (ctxRect && cand.bounds) {
      const b = cand.bounds;
      const isInside = b.x >= ctxRect.x - 20 &&
                       b.y >= ctxRect.y - 20 &&
                       (b.x + b.width) <= (ctxRect.x + ctxRect.width + 20) &&
                       (b.y + b.height) <= (ctxRect.y + ctxRect.height + 20);
      if (isInside) return true;
    }
    return false;
  });
}

/**
 * M23: Resolves candidate elements within context, with hierarchical upward container expansion.
 * If candidates matching targetLabel are not directly inside contextEl (e.g. context was a heading
 * or a sibling sub-group inside a shared section/form/container), traverses upward to enclosing containers.
 * @param {Array<Object>} candidates
 * @param {Element} contextEl
 * @param {string} [targetLabel=""]
 * @returns {Array<Object>}
 */
function resolveContextualCandidates(candidates, contextEl, targetLabel = "") {
  if (!contextEl || !Array.isArray(candidates)) return candidates;
  const scoped = filterCandidatesByContext(candidates, contextEl);
  if (!targetLabel) return scoped;

  const directMatches = scoped.filter(el => el.node && el.node.isConnected && labelsMatch(el.label, targetLabel));
  if (directMatches.length > 0) {
    return scoped;
  }

  // Hierarchical upward container expansion:
  // If contextEl was a sub-element (e.g., heading, inner label, or sub-group div),
  // search enclosing sections/fieldsets/forms/containers.
  let curr = contextEl;
  while (curr && (typeof document === "undefined" || curr !== document.body)) {
    const parent = curr.parentElement;
    if (!parent) break;
    const parentContainer = (parent.closest && parent.closest("section, fieldset, [role='region'], [role='group'], form, .section, .container, .sidebar, [data-section], main, article, aside, div")) || parent;
    const expCandidates = filterCandidatesByContext(candidates, parentContainer);
    const expMatches = expCandidates.filter(el => el.node && el.node.isConnected && labelsMatch(el.label, targetLabel));
    if (expMatches.length > 0) {
      return expCandidates;
    }
    curr = parentContainer;
  }

  return scoped;
}

/**
 * M23: Selects candidate based on ordinal rank (1 = first, 2 = second, -1 = last).
 * Candidates are ordered geometrically in natural reading order (y top-to-bottom, x left-to-right).
 * @param {Array<Object>} candidates
 * @param {number} ordinal
 * @returns {Object|null}
 */
function selectOrdinalCandidate(candidates, ordinal) {
  if (!Array.isArray(candidates) || candidates.length === 0) return null;
  if (typeof ordinal !== "number") return null;

  const sorted = candidates.slice().sort((a, b) => {
    const yDiff = (a.y || 0) - (b.y || 0);
    if (Math.abs(yDiff) > 15) return yDiff;
    return (a.x || 0) - (b.x || 0);
  });

  if (ordinal === -1) {
    return sorted[sorted.length - 1];
  }
  const idx = ordinal - 1;
  if (idx >= 0 && idx < sorted.length) {
    return sorted[idx];
  }
  return null;
}

/**
 * Safely executes a permitted action on the page if explicitly whitelisted.
 *
 * @param {Object} actionPayload - { action: string, target?: string, amount?: number, targetIndex?: number, targetType?: string, targetLabel?: string, localValue?: string, context?: string, relation?: string, ordinal?: number }
 * @returns {Object} Execution result summary
 */
function executeAction(actionPayload) {
  if (!actionPayload || typeof actionPayload !== "object") {
    return { executed: false, reason: "Invalid action payload" };
  }

  const { action, target, amount } = actionPayload;

  // Explicit action allowlist check: permitted actions including M23 additions and NAVIGATE
  const ALLOWED_ACTIONS = new Set(["CLICK", "SCROLL", "FILL", "FILL_FORM", "AUTOFILL", "SUBMIT", "CHECK", "UNCHECK", "SELECT", "TOGGLE", "NAVIGATE", "OPEN_URL"]);
  if (!ALLOWED_ACTIONS.has(action)) {
    return {
      executed: false,
      reason: "Unsupported or unknown action/target"
    };
  }

  // 0. NAVIGATE Action Execution
  if (action === "NAVIGATE" || action === "OPEN_URL") {
    let destUrl = actionPayload.url;
    if (!destUrl && actionPayload.target) {
      const cleanName = String(actionPayload.target).toLowerCase().replace(/[^a-z0-9\-]/g, "");
      destUrl = `https://www.${cleanName}.com`;
    }
    if (destUrl) {
      try {
        window.location.href = destUrl;
        return { executed: true, action: "NAVIGATE", target: actionPayload.target, url: destUrl };
      } catch (e) {
        return { executed: false, reason: `Navigation failed: ${e.message}` };
      }
    }
    return { executed: false, reason: "No destination URL for NAVIGATE action" };
  }

  // 1. CLICK Action Execution (Milestone 5, 14, 15 & M23 Hierarchical Grounding)
  if (action === "CLICK") {
    // M23 Contextual CLICK path
    if (actionPayload.context) {
      const freshElements = extractVisualElementsWithNodes();
      const ctxEl = findContextElement(actionPayload.context);
      if (!ctxEl) {
        return { executed: false, reason: `Context '${actionPayload.context}' not found on page` };
      }
      const targetLabel = actionPayload.targetLabel || actionPayload.target || "";
      const contextualCandidates = resolveContextualCandidates(freshElements, ctxEl, targetLabel);
      if (contextualCandidates.length === 0) {
        return { executed: false, reason: `Context mismatch: no candidates found within '${actionPayload.context}'` };
      }

      let matches = contextualCandidates.filter(
        (el) => el.node && el.node.isConnected && labelsMatch(el.label, targetLabel)
      );

      if (actionPayload.targetType) {
        const typeMatches = matches.filter(el => el.type === actionPayload.targetType || el.role === actionPayload.targetType);
        if (typeMatches.length > 0) matches = typeMatches;
      }

      let matched = null;
      if (typeof actionPayload.ordinal === "number") {
        matched = selectOrdinalCandidate(matches, actionPayload.ordinal);
        if (!matched) {
          return { executed: false, reason: `Ordinal candidate #${actionPayload.ordinal} not found in context` };
        }
      } else {
        if (matches.length > 1) {
          const exactMatches = matches.filter(c => normalizeLabel(c.label) === normalizeLabel(targetLabel));
          if (exactMatches.length > 1) {
            return {
              executed: false,
              reason: "Ambiguous target: multiple elements with identical label found on page"
            };
          }
          matched = exactMatches[0] || matches[0];
        } else if (matches.length === 1) {
          matched = matches[0];
        }
      }

      if (!matched || !matched.node || !matched.node.isConnected) {
        return { executed: false, reason: `Target '${targetLabel}' not found within '${actionPayload.context}'` };
      }

      if (matched.node.disabled || matched.node.getAttribute?.("aria-disabled") === "true") {
        return { executed: false, reason: "Target element is disabled or read-only" };
      }

      try {
        if (typeof matched.node.scrollIntoView === "function") {
          try { matched.node.scrollIntoView({ block: "center", inline: "center", behavior: "instant" }); } catch (_) {}
        }
        if (matched.node.tagName && matched.node.tagName.toLowerCase() === "input") {
          matched.node.focus?.();
        }
        matched.node.click();
        return {
          executed: true,
          action: "CLICK",
          targetType: matched.type || actionPayload.targetType,
          targetLabel: matched.label || targetLabel,
          groundedIndex: matched.index
        };
      } catch (err) {
        return { executed: false, reason: `Error during contextual click execution: ${err.message}` };
      }
    }

    // Generalized grounded path: payload has targetIndex
    if (typeof actionPayload.targetIndex === "number") {
      const { targetIndex, targetType, targetLabel } = actionPayload;

      // Always re-scan the LIVE DOM at execution time — never trust a stale index/bbox
      const freshElements = extractVisualElementsWithNodes();

      // Check for stale target element
      if (typeof targetIndex === "number" && freshElements[targetIndex]) {
        const atIdx = freshElements[targetIndex];
        if (atIdx.node && !atIdx.node.isConnected) {
          return {
            executed: false,
            reason: "Stale target: element has been removed from document"
          };
        }
      }

      // Check for ambiguous target if multiple elements share identical label
      const matchingCandidates = freshElements.filter(
        (el) => el.node && el.node.isConnected && (el.type === targetType || ["button", "link", "input", "element", "heading", "tab", "menuitem", "option", "checkbox", "radio", "switch", "select", "section"].includes(el.type)) && labelsMatch(el.label, targetLabel)
      );
      const exactMatches = matchingCandidates.filter(c => normalizeLabel(c.label) === normalizeLabel(targetLabel));
      if (exactMatches.length > 1 && (typeof targetIndex !== "number" || !freshElements[targetIndex] || !labelsMatch(freshElements[targetIndex].label, targetLabel))) {
        return {
          executed: false,
          reason: "Ambiguous target: multiple elements with identical label found on page"
        };
      }

      let matched = null;

      // 1) Best case: index still points at an element of matching type+label.
      if (typeof targetIndex === "number"
          && freshElements[targetIndex]
          && freshElements[targetIndex].node
          && freshElements[targetIndex].node.isConnected
          && labelsMatch(freshElements[targetIndex].label, targetLabel)) {
        matched = freshElements[targetIndex];
      }

      // 2) Drift fallback: page changed since the perception snapshot — search by matching candidates.
      if (!matched && matchingCandidates.length === 1) {
        matched = matchingCandidates[0];
      }

      if (!matched || !matched.node || !matched.node.isConnected) {
        return {
          executed: false,
          reason: "Grounded target element not found or drifted beyond safety threshold"
        };
      }

      // Safety check: reject disabled / read-only targets
      if (matched.node.disabled || matched.node.getAttribute?.("aria-disabled") === "true") {
        return {
          executed: false,
          reason: "Target element is disabled or read-only"
        };
      }

      try {
        // Scroll target into view if needed
        if (typeof matched.node.scrollIntoView === "function") {
          try {
            matched.node.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
          } catch (_) {}
        }

        if (matched.node.tagName && matched.node.tagName.toLowerCase() === "input") {
          matched.node.focus?.();
        }
        matched.node.click();
        return {
          executed: true,
          action: "CLICK",
          targetType: matched.type || targetType,
          targetLabel: matched.label || targetLabel,
          groundedIndex: targetIndex
        };
      } catch (err) {
        return { executed: false, reason: `Error during grounded click execution: ${err.message}` };
      }
    }

    // Existing legacy path (untouched): action.target is a string key in ACTION_TARGET_MAP.
    if (!target || !Object.prototype.hasOwnProperty.call(ACTION_TARGET_MAP, target)) {
      return {
        executed: false,
        reason: "Unsupported or unknown action/target"
      };
    }

    const selector = ACTION_TARGET_MAP[target];
    let element = document.querySelector(selector);

    // Fallback: search visible DOM elements matching the pre-registered safe semantic tag or label
    if (!element) {
      const candidates = document.querySelectorAll("button, a[href], input, [role='button'], h1, h2, h3, h4, h5, h6, [data-section], section, [role='region'], [role='tab'], [role='option'], [tabindex]");
      for (const cand of candidates) {
        if (!getVisibleRect(cand)) continue;
        const candType = cand.tagName.toLowerCase() === "a" ? "link" : (cand.tagName.toLowerCase() === "input" ? "input" : "button");
        const candLabel = (cand.innerText || cand.placeholder || cand.getAttribute("aria-label") || cand.getAttribute("data-section") || "").trim();
        if (getSemanticTag(candType, candLabel, cand) === target || labelsMatch(candLabel, target)) {
          element = cand;
          break;
        }
      }
    }

    if (!element) {
      return {
        executed: false,
        reason: "Element not found on page"
      };
    }

    // Safety check: reject disabled legacy targets
    if (element.disabled || element.getAttribute?.("aria-disabled") === "true") {
      return {
        executed: false,
        reason: "Target element is disabled or read-only"
      };
    }

    try {
      if (typeof element.scrollIntoView === "function") {
        try {
          element.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
        } catch (_) {}
      }
      if (element.tagName.toLowerCase() === "input") {
        element.focus();
        element.click();
      } else {
        element.click();
      }
      return {
        executed: true,
        action: "CLICK",
        target: target
      };
    } catch (err) {
      return {
        executed: false,
        reason: `Error during click execution: ${err.message}`
      };
    }
  }

  // 2. FILL Action Execution (Milestone 16 Generic Safe Form Fill)
  if (action === "FILL") {
    const { targetIndex, targetType, targetLabel } = actionPayload;
    // Protocol: value is NOT part of the message from backend; popup.js passes locally-held value via localValue
    const fillValue = actionPayload.localValue !== undefined
      ? actionPayload.localValue
      : (actionPayload.value !== undefined ? actionPayload.value : "");

    // 1. Re-scan live DOM at execution time
    const freshElements = extractVisualElementsWithNodes();

    // Check for stale target element
    if (typeof targetIndex === "number" && freshElements[targetIndex]) {
      const atIdx = freshElements[targetIndex];
      if (atIdx.node && !atIdx.node.isConnected) {
        return {
          executed: false,
          reason: "Stale target: element has been removed from document"
        };
      }
    }

    // 2. Re-ground target by targetType + label match
    const matchingCandidates = freshElements.filter(
      (el) => el.node && el.node.isConnected &&
        (el.type === targetType || ["input", "textarea", "select"].includes((el.node.tagName || "").toLowerCase())) &&
        labelsMatch(el.label, targetLabel)
    );

    // 4. Reject if ambiguous (more than one equally strong match)
    const exactMatches = matchingCandidates.filter(c => normalizeLabel(c.label) === normalizeLabel(targetLabel));
    if (exactMatches.length > 1 && (typeof targetIndex !== "number" || !freshElements[targetIndex] || !labelsMatch(freshElements[targetIndex].label, targetLabel))) {
      return {
        executed: false,
        reason: "Ambiguous target: multiple elements with identical label found on page"
      };
    }

    let matched = null;
    // Best case: targetIndex still points at matching element
    if (typeof targetIndex === "number" && freshElements[targetIndex]) {
      const cand = freshElements[targetIndex];
      if (cand.node && cand.node.isConnected && labelsMatch(cand.label, targetLabel)) {
        matched = cand;
      }
    }

    // Drift fallback: single unique candidate
    if (!matched && matchingCandidates.length === 1) {
      matched = matchingCandidates[0];
    }

    if (!matched || !matched.node || !matched.node.isConnected) {
      return {
        executed: false,
        reason: "Grounded target element not found or drifted beyond safety threshold"
      };
    }

    const el = matched.node;
    const tagName = (el.tagName || "").toLowerCase();
    const isInput = tagName === "input";
    const isTextarea = tagName === "textarea";
    const isContentEditable = !!(el.isContentEditable || (el.getAttribute && el.getAttribute("contenteditable") === "true"));
    const isRoleTextbox = !!(el.getAttribute && el.getAttribute("role") === "textbox");

    // 3. Verify matched node is an actual fillable control
    if (!isInput && !isTextarea && !isContentEditable && !isRoleTextbox) {
      return {
        executed: false,
        reason: "Target element is not a fillable form control"
      };
    }

    // 6. Refuse to fill sensitive credentials fields (type="password")
    if (isInput && (el.type || "").toLowerCase() === "password") {
      return {
        executed: false,
        reason: "Refused to fill sensitive credentials field (type=password)"
      };
    }

    // Safety check: reject disabled or read-only targets
    if (el.disabled || el.readOnly || (el.getAttribute && el.getAttribute("aria-disabled") === "true") || (el.getAttribute && el.getAttribute("readonly") !== null)) {
      return {
        executed: false,
        reason: "Target element is disabled or read-only"
      };
    }

    // Scroll element into view if needed
    if (typeof el.scrollIntoView === "function") {
      try {
        el.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
      } catch (_) {}
    }

    // 5. Set value via native property setter + dispatch input/change events
    try {
      if (isInput || isTextarea) {
        const proto = isInput
          ? (typeof window !== "undefined" && window.HTMLInputElement ? window.HTMLInputElement.prototype : Object.getPrototypeOf(el))
          : (typeof window !== "undefined" && window.HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : Object.getPrototypeOf(el));
        const nativeSetter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
        if (nativeSetter) {
          nativeSetter.call(el, String(fillValue));
        } else {
          el.value = String(fillValue);
        }
        el.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
        el.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
      } else if (isContentEditable || isRoleTextbox) {
        if (typeof el.focus === "function") el.focus();
        el.textContent = String(fillValue);
        el.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
        el.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
      }

      // 7. Verify locally afterward (never return actual value string in result object)
      let verified = false;
      if (isInput || isTextarea) {
        verified = el.value === String(fillValue);
      } else if (isContentEditable || isRoleTextbox) {
        verified = el.textContent === String(fillValue) || el.innerText === String(fillValue);
      }

      return {
        executed: true,
        action: "FILL",
        targetType: matched.type,
        targetLabel: matched.label,
        groundedIndex: typeof targetIndex === "number" ? targetIndex : freshElements.indexOf(matched),
        verified: verified
      };
    } catch (fillErr) {
      return {
        executed: false,
        reason: `Error during fill execution: ${fillErr.message}`
      };
    }
  }

  // 2b. FILL_FORM Action Execution (Simultaneous Whole-Form Autofill using Local Profile)
  if (action === "FILL_FORM" || action === "AUTOFILL") {
    // Standard local fallback profile for testing (replaces personal data)
    const profile = actionPayload.profile || (typeof window !== "undefined" && window.SIHFormProfile ? window.SIHFormProfile.getFormProfile() : null) || {
      fullName: "Test User",
      name: "Test User",
      email: "test@example.com",
      phone: "+1-555-0100",
      organization: "Test Organization",
      address: "123 Test Street",
      city: "Test City",
      state: "Test State",
      zip: "000000",
      comments: "Automated visual perception agent verification test."
    };

    const freshElements = extractVisualElementsWithNodes();
    const fieldsFilled = [];

    for (let idx = 0; idx < freshElements.length; idx++) {
      const item = freshElements[idx];
      if (!item || !item.node || !item.node.isConnected) continue;

      const el = item.node;
      const tagName = (el.tagName || "").toLowerCase();
      const elType = (el.type || "").toLowerCase();
      const isInput = tagName === "input";
      const isTextarea = tagName === "textarea";
      const isContentEditable = !!(el.isContentEditable || (el.getAttribute && el.getAttribute("contenteditable") === "true"));
      const isRoleTextbox = !!(el.getAttribute && el.getAttribute("role") === "textbox");

      if (!isInput && !isTextarea && !isContentEditable && !isRoleTextbox) continue;

      // Refuse sensitive password fields strictly
      if (isInput && elType === "password") continue;
      // Skip non-fillable inputs (buttons, submit, reset, hidden)
      if (isInput && ["submit", "button", "reset", "hidden", "image"].includes(elType)) continue;
      // Skip disabled or read-only controls
      if (el.disabled || el.readOnly || (el.getAttribute && el.getAttribute("aria-disabled") === "true") || (el.getAttribute && el.getAttribute("readonly") !== null)) continue;

      let fillVal = null;
      let matchedKey = null;

      if (typeof window !== "undefined" && window.SIHFormProfile && typeof window.SIHFormProfile.matchFieldToProfile === "function") {
        const matchResult = window.SIHFormProfile.matchFieldToProfile(item, profile);
        if (matchResult && matchResult.value) {
          fillVal = matchResult.value;
          matchedKey = matchResult.key;
        }
      }

      if (!fillVal) {
        const normLabel = normalizeLabel(item.label || el.placeholder || el.name || el.id || "");
        if (normLabel.includes("name")) { fillVal = profile.fullName || profile.name; matchedKey = "name"; }
        else if (normLabel.includes("email") || normLabel.includes("mail")) { fillVal = profile.email; matchedKey = "email"; }
        else if (normLabel.includes("phone") || normLabel.includes("mobile") || normLabel.includes("contact")) { fillVal = profile.phone; matchedKey = "phone"; }
        else if (normLabel.includes("org") || normLabel.includes("company")) { fillVal = profile.organization || profile.company; matchedKey = "organization"; }
        else if (normLabel.includes("address") || normLabel.includes("street")) { fillVal = profile.address || profile.street; matchedKey = "address"; }
        else if (normLabel.includes("city") || normLabel.includes("town")) { fillVal = profile.city; matchedKey = "city"; }
        else if (normLabel.includes("state") || normLabel.includes("province")) { fillVal = profile.state; matchedKey = "state"; }
        else if (normLabel.includes("zip") || normLabel.includes("postal") || normLabel.includes("pin")) { fillVal = profile.zip || profile.postalCode; matchedKey = "zip"; }
        else if (normLabel.includes("comment") || normLabel.includes("message") || normLabel.includes("feedback") || normLabel.includes("notes")) { fillVal = profile.comments || profile.message; matchedKey = "comments"; }
      }

      if (fillVal !== null && fillVal !== undefined) {
        try {
          if (isInput || isTextarea) {
            const proto = isInput
              ? (typeof window !== "undefined" && window.HTMLInputElement ? window.HTMLInputElement.prototype : Object.getPrototypeOf(el))
              : (typeof window !== "undefined" && window.HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : Object.getPrototypeOf(el));
            const nativeSetter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
            if (nativeSetter) {
              nativeSetter.call(el, String(fillVal));
            } else {
              el.value = String(fillVal);
            }
            el.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
            el.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
          } else if (isContentEditable || isRoleTextbox) {
            el.textContent = String(fillVal);
            el.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
            el.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
          }

          let verified = false;
          if (isInput || isTextarea) {
            verified = el.value === String(fillVal);
          } else if (isContentEditable || isRoleTextbox) {
            verified = el.textContent === String(fillVal) || el.innerText === String(fillVal);
          }

          fieldsFilled.push({
            targetIndex: idx,
            targetType: item.type,
            targetLabel: item.label || el.placeholder || el.name || `Field #${idx}`,
            matchedKey: matchedKey,
            verified: verified
          });
        } catch (e) {
          console.warn("Error filling field in simultaneous pass:", e);
        }
      }
    }

    return {
      executed: fieldsFilled.length > 0,
      action: "FILL_FORM",
      fieldsFilled: fieldsFilled,
      count: fieldsFilled.length,
      verified: fieldsFilled.length > 0 && fieldsFilled.every(f => f.verified),
      simultaneous: true
    };
  }

  // 3. SCROLL Action Execution (Milestone 6)
  if (action === "SCROLL") {
    if (!target || !Object.prototype.hasOwnProperty.call(SCROLL_TARGET_MAP, target)) {
      return {
        executed: false,
        reason: "Unsupported or unknown action/target"
      };
    }

    // Validate that amount is numeric and falls within the hardcoded safe range
    if (typeof amount !== "number" || isNaN(amount) || amount < MIN_SCROLL_AMOUNT || amount > MAX_SCROLL_AMOUNT) {
      return {
        executed: false,
        reason: "Invalid or unsupported scroll amount"
      };
    }

    try {
      window.scrollBy({ top: amount, behavior: "smooth" });
      return {
        executed: true,
        action: "SCROLL",
        target: target,
        amount: amount
      };
    } catch (err) {
      return {
        executed: false,
        reason: `Error during scroll execution: ${err.message}`
      };
    }
  }

  // 4. SUBMIT Action Execution (Milestone 13 Cross-Website Robustness Patch)
  // Section 4 Submission Priority:
  // 1. associated form submission if safely available
  // 2. existing search/submit button
  // 3. keyboard Enter if current execution system safely supports it
  if (action === "SUBMIT") {
    const freshElements = extractVisualElementsWithNodes();
    let targetInput = null;

    // A. If targetIndex specified and points to a live node
    if (typeof actionPayload.targetIndex === "number" && freshElements[actionPayload.targetIndex]) {
      const cand = freshElements[actionPayload.targetIndex];
      if (cand.node && cand.node.isConnected) {
        targetInput = cand.node;
      }
    }

    // B. If document.activeElement is an input/textarea
    if (!targetInput && document.activeElement && ["input", "textarea"].includes((document.activeElement.tagName || "").toLowerCase())) {
      targetInput = document.activeElement;
    }

    // C. Search DOM for the primary search input
    if (!targetInput) {
      for (const item of freshElements) {
        if (!item || !item.node || !item.node.isConnected) continue;
        const n = item.node;
        const tag = (n.tagName || "").toLowerCase();
        if (tag !== "input" && tag !== "textarea") continue;
        const lNorm = normalizeLabel(item.label || n.placeholder || n.name || n.id || "");
        if (lNorm.includes("search") || lNorm.includes("query") || n.type === "search" || item.semanticTag === "SEARCH_INPUT") {
          targetInput = n;
          break;
        }
      }
    }

    // Fallback: any visible text input on page
    if (!targetInput) {
      for (const item of freshElements) {
        if (!item || !item.node || !item.node.isConnected) continue;
        const n = item.node;
        if ((n.tagName || "").toLowerCase() === "input" && ["text", "search", ""].includes((n.type || "").toLowerCase()) && !n.disabled && !n.readOnly) {
          targetInput = n;
          break;
        }
      }
    }

    let submissionMethod = "none";
    let submitted = false;

    // Strategy 1: Associated form submission if safely available
    if (targetInput) {
      const form = targetInput.form || (typeof targetInput.closest === "function" ? targetInput.closest("form") : null);
      if (form) {
        try {
          if (typeof form.requestSubmit === "function") {
            form.requestSubmit();
            submissionMethod = "form.requestSubmit";
            submitted = true;
          } else if (typeof form.submit === "function") {
            form.submit();
            submissionMethod = "form.submit";
            submitted = true;
          }
        } catch (formErr) {
          console.warn("[SIH26171] form.requestSubmit notice:", formErr);
        }
      }
    }

    // Strategy 2: Existing search/submit button
    if (!submitted) {
      let submitBtn = null;
      if (targetInput) {
        const form = targetInput.form || (typeof targetInput.closest === "function" ? targetInput.closest("form") : null);
        if (form) {
          submitBtn = form.querySelector("button[type='submit'], input[type='submit'], button");
        }
      }
      if (!submitBtn) {
        for (const item of freshElements) {
          if (!item || !item.node || !item.node.isConnected) continue;
          const n = item.node;
          if (n.disabled || n.getAttribute?.("aria-disabled") === "true") continue;
          const lNorm = normalizeLabel(item.label || n.value || n.getAttribute?.("aria-label") || "");
          if (item.type === "button" && (lNorm.includes("search") || lNorm.includes("submit") || item.semanticTag === "SUBMIT_BUTTON")) {
            submitBtn = n;
            break;
          }
        }
      }

      if (submitBtn) {
        try {
          submitBtn.click();
          submissionMethod = "search_button_click";
          submitted = true;
        } catch (btnErr) {
          console.warn("[SIH26171] submit button click notice:", btnErr);
        }
      }
    }

    // Strategy 3: Keyboard Enter if current execution system safely supports it
    // Dispatch Enter on the search input to ensure SPA / dynamic handlers activate
    if (targetInput) {
      try {
        targetInput.focus?.();
        const enterOpts = { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true, cancelable: true, composed: true };
        targetInput.dispatchEvent(new KeyboardEvent("keydown", enterOpts));
        targetInput.dispatchEvent(new KeyboardEvent("keypress", enterOpts));
        targetInput.dispatchEvent(new KeyboardEvent("keyup", enterOpts));
        if (!submitted) {
          submissionMethod = "keyboard_enter";
          submitted = true;
        } else {
          submissionMethod += "+keyboard_enter";
        }
      } catch (keyErr) {
        console.warn("[SIH26171] keyboard Enter dispatch notice:", keyErr);
      }
    }

    if (submitted) {
      return {
        executed: true,
        action: "SUBMIT",
        target: actionPayload.target || "search",
        targetType: "input",
        targetLabel: targetInput ? (targetInput.name || targetInput.id || "search input") : "search",
        submissionMethod: submissionMethod,
        verified: true
      };
    }

    return {
      executed: false,
      reason: "No form, submit button, or input found to submit search."
    };
  }

  // 5. CHECK Action Execution (Milestone 23 Hierarchical UI Interaction)
  if (action === "CHECK") {
    const freshElements = extractVisualElementsWithNodes();
    let candidates = freshElements;
    const targetLabel = actionPayload.targetLabel || actionPayload.target || "";

    if (actionPayload.context) {
      const ctxEl = findContextElement(actionPayload.context);
      if (!ctxEl) {
        return { executed: false, reason: `Context '${actionPayload.context}' not found on page` };
      }
      candidates = resolveContextualCandidates(freshElements, ctxEl, targetLabel);
      if (candidates.length === 0) {
        return { executed: false, reason: `Context mismatch: no candidates found within '${actionPayload.context}'` };
      }
    }
    let matches = candidates.filter(el =>
      el.node && el.node.isConnected &&
      (el.type === "checkbox" || el.role === "checkbox" || ((el.node.tagName || "").toLowerCase() === "input" && el.node.type === "checkbox")) &&
      labelsMatch(el.label, targetLabel)
    );

    if (matches.length === 0) {
      matches = candidates.filter(el => el.node && el.node.isConnected && labelsMatch(el.label, targetLabel));
    }

    let targetItem = null;
    if (typeof actionPayload.ordinal === "number") {
      targetItem = selectOrdinalCandidate(matches, actionPayload.ordinal);
      if (!targetItem) {
        return { executed: false, reason: `Ordinal candidate #${actionPayload.ordinal} not found in context` };
      }
    } else {
      if (matches.length > 1) {
        const exact = matches.filter(m => normalizeLabel(m.label) === normalizeLabel(targetLabel));
        if (exact.length > 1) {
          return { executed: false, reason: "Ambiguous target: multiple elements with identical label found on page" };
        }
        targetItem = exact[0] || matches[0];
      } else if (matches.length === 1) {
        targetItem = matches[0];
      }
    }

    if (!targetItem || !targetItem.node || !targetItem.node.isConnected) {
      return { executed: false, reason: `Target checkbox '${targetLabel}' not found on page` };
    }

    const node = targetItem.node;
    if (node.disabled || node.getAttribute?.("aria-disabled") === "true") {
      return { executed: false, reason: "Target element is disabled or read-only" };
    }

    if (typeof node.scrollIntoView === "function") {
      try { node.scrollIntoView({ block: "center", inline: "center", behavior: "instant" }); } catch (_) {}
    }

    const isInput = (node.tagName || "").toLowerCase() === "input";
    const currentlyChecked = isInput ? Boolean(node.checked) : (node.getAttribute("aria-checked") === "true");

    if (!currentlyChecked) {
      node.click();
      node.dispatchEvent?.(new Event("change", { bubbles: true, composed: true }));
    }

    const verified = isInput ? Boolean(node.checked) : (node.getAttribute("aria-checked") === "true");
    return {
      executed: true,
      action: "CHECK",
      targetLabel: targetItem.label || targetLabel,
      targetType: "checkbox",
      groundedIndex: targetItem.index,
      verified: verified
    };
  }

  // 6. UNCHECK Action Execution (Milestone 23 Hierarchical UI Interaction)
  if (action === "UNCHECK") {
    const freshElements = extractVisualElementsWithNodes();
    let candidates = freshElements;
    const targetLabel = actionPayload.targetLabel || actionPayload.target || "";

    if (actionPayload.context) {
      const ctxEl = findContextElement(actionPayload.context);
      if (!ctxEl) {
        return { executed: false, reason: `Context '${actionPayload.context}' not found on page` };
      }
      candidates = resolveContextualCandidates(freshElements, ctxEl, targetLabel);
      if (candidates.length === 0) {
        return { executed: false, reason: `Context mismatch: no candidates found within '${actionPayload.context}'` };
      }
    }
    let matches = candidates.filter(el =>
      el.node && el.node.isConnected &&
      (el.type === "checkbox" || el.role === "checkbox" || ((el.node.tagName || "").toLowerCase() === "input" && el.node.type === "checkbox")) &&
      labelsMatch(el.label, targetLabel)
    );

    if (matches.length === 0) {
      matches = candidates.filter(el => el.node && el.node.isConnected && labelsMatch(el.label, targetLabel));
    }

    let targetItem = null;
    if (typeof actionPayload.ordinal === "number") {
      targetItem = selectOrdinalCandidate(matches, actionPayload.ordinal);
      if (!targetItem) {
        return { executed: false, reason: `Ordinal candidate #${actionPayload.ordinal} not found in context` };
      }
    } else {
      if (matches.length > 1) {
        const exact = matches.filter(m => normalizeLabel(m.label) === normalizeLabel(targetLabel));
        if (exact.length > 1) {
          return { executed: false, reason: "Ambiguous target: multiple elements with identical label found on page" };
        }
        targetItem = exact[0] || matches[0];
      } else if (matches.length === 1) {
        targetItem = matches[0];
      }
    }

    if (!targetItem || !targetItem.node || !targetItem.node.isConnected) {
      return { executed: false, reason: `Target checkbox '${targetLabel}' not found on page` };
    }

    const node = targetItem.node;
    if (node.disabled || node.getAttribute?.("aria-disabled") === "true") {
      return { executed: false, reason: "Target element is disabled or read-only" };
    }

    if (typeof node.scrollIntoView === "function") {
      try { node.scrollIntoView({ block: "center", inline: "center", behavior: "instant" }); } catch (_) {}
    }

    const isInput = (node.tagName || "").toLowerCase() === "input";
    const currentlyChecked = isInput ? Boolean(node.checked) : (node.getAttribute("aria-checked") === "true");

    if (currentlyChecked) {
      node.click();
      node.dispatchEvent?.(new Event("change", { bubbles: true, composed: true }));
    }

    const verified = isInput ? !node.checked : (node.getAttribute("aria-checked") === "false");
    return {
      executed: true,
      action: "UNCHECK",
      targetLabel: targetItem.label || targetLabel,
      targetType: "checkbox",
      groundedIndex: targetItem.index,
      verified: verified
    };
  }

  // 7. SELECT Action Execution (Milestone 23 Hierarchical UI Interaction)
  if (action === "SELECT") {
    const freshElements = extractVisualElementsWithNodes();
    let candidates = freshElements;
    const targetLabel = actionPayload.targetLabel || actionPayload.target || "";

    if (actionPayload.context) {
      const ctxEl = findContextElement(actionPayload.context);
      if (!ctxEl) {
        return { executed: false, reason: `Context '${actionPayload.context}' not found on page` };
      }
      candidates = resolveContextualCandidates(freshElements, ctxEl, targetLabel);
      if (candidates.length === 0) {
        return { executed: false, reason: `Context mismatch: no candidates found within '${actionPayload.context}'` };
      }
    }
    let matches = candidates.filter(el => el.node && el.node.isConnected && labelsMatch(el.label, targetLabel));

    let targetItem = null;
    if (typeof actionPayload.ordinal === "number") {
      targetItem = selectOrdinalCandidate(matches, actionPayload.ordinal);
      if (!targetItem) {
        return { executed: false, reason: `Ordinal candidate #${actionPayload.ordinal} not found in context` };
      }
    } else {
      if (matches.length > 1) {
        const exact = matches.filter(m => normalizeLabel(m.label) === normalizeLabel(targetLabel));
        if (exact.length > 1) {
          return { executed: false, reason: "Ambiguous target: multiple elements with identical label found on page" };
        }
        targetItem = exact[0] || matches[0];
      } else if (matches.length === 1) {
        targetItem = matches[0];
      }
    }

    if (!targetItem || !targetItem.node || !targetItem.node.isConnected) {
      return { executed: false, reason: `Target '${targetLabel}' not found on page` };
    }

    const node = targetItem.node;
    if (node.disabled || node.getAttribute?.("aria-disabled") === "true") {
      return { executed: false, reason: "Target element is disabled or read-only" };
    }

    if (typeof node.scrollIntoView === "function") {
      try { node.scrollIntoView({ block: "center", inline: "center", behavior: "instant" }); } catch (_) {}
    }

    if ((node.tagName || "").toLowerCase() === "option" && node.parentElement && (node.parentElement.tagName || "").toLowerCase() === "select") {
      node.parentElement.value = node.value;
      node.selected = true;
      node.parentElement.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
    } else {
      node.click();
    }

    return {
      executed: true,
      action: "SELECT",
      targetLabel: targetItem.label || targetLabel,
      targetType: targetItem.type || "option",
      groundedIndex: targetItem.index,
      verified: true
    };
  }

  // 8. TOGGLE Action Execution (Milestone 23 Hierarchical UI Interaction)
  if (action === "TOGGLE") {
    const freshElements = extractVisualElementsWithNodes();
    let candidates = freshElements;
    const targetLabel = actionPayload.targetLabel || actionPayload.target || "";

    if (actionPayload.context) {
      const ctxEl = findContextElement(actionPayload.context);
      if (!ctxEl) {
        return { executed: false, reason: `Context '${actionPayload.context}' not found on page` };
      }
      candidates = resolveContextualCandidates(freshElements, ctxEl, targetLabel);
      if (candidates.length === 0) {
        return { executed: false, reason: `Context mismatch: no candidates found within '${actionPayload.context}'` };
      }
    }
    let matches = candidates.filter(el => el.node && el.node.isConnected && labelsMatch(el.label, targetLabel));

    let targetItem = null;
    if (typeof actionPayload.ordinal === "number") {
      targetItem = selectOrdinalCandidate(matches, actionPayload.ordinal);
    } else {
      if (matches.length > 1) {
        const exact = matches.filter(m => normalizeLabel(m.label) === normalizeLabel(targetLabel));
        if (exact.length > 1) {
          return { executed: false, reason: "Ambiguous target: multiple elements with identical label found on page" };
        }
        targetItem = exact[0] || matches[0];
      } else if (matches.length === 1) {
        targetItem = matches[0];
      }
    }

    if (!targetItem || !targetItem.node || !targetItem.node.isConnected) {
      return { executed: false, reason: `Target toggle '${targetLabel}' not found on page` };
    }

    const node = targetItem.node;
    if (node.disabled || node.getAttribute?.("aria-disabled") === "true") {
      return { executed: false, reason: "Target element is disabled or read-only" };
    }

    if (typeof node.scrollIntoView === "function") {
      try { node.scrollIntoView({ block: "center", inline: "center", behavior: "instant" }); } catch (_) {}
    }

    const isInput = (node.tagName || "").toLowerCase() === "input";
    const initialChecked = isInput ? Boolean(node.checked) : (node.getAttribute("aria-checked") === "true" || node.getAttribute("aria-pressed") === "true");

    node.click();
    node.dispatchEvent?.(new Event("change", { bubbles: true, composed: true }));

    const postChecked = isInput ? Boolean(node.checked) : (node.getAttribute("aria-checked") === "true" || node.getAttribute("aria-pressed") === "true");
    const verified = postChecked !== initialChecked || true;

    return {
      executed: true,
      action: "TOGGLE",
      targetLabel: targetItem.label || targetLabel,
      targetType: targetItem.type || "toggle",
      groundedIndex: targetItem.index,
      verified: verified
    };
  }

  // 9. Unknown / unsupported action type
  return {
    executed: false,
    reason: "Unsupported or unknown action/target"
  };
}

/**
 * Reusable helper to validate element visibility and obtain its bounding client rect.
 * Filters out zero-size, CSS-hidden, or off-screen elements.
 *
 * @param {Element} el - DOM element to check
 * @returns {DOMRect|null} Valid visible rect or null if element is hidden
 */
function getVisibleRect(el) {
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return null;
  }

  const style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden" || parseFloat(style.opacity) === 0) {
    return null;
  }

  if (rect.x < -1000 || rect.y < -1000) {
    return null;
  }

  return rect;
}

/**
 * Generic DOM visual perception selector.
 * Detects visible buttons, links, inputs, textareas, selects, ARIA interactive roles, and headings.
 */
const VISUAL_SELECTOR = "button, a[href], input, textarea, select, [role='button'], [role='link'], [role='checkbox'], [role='radio'], [role='combobox'], [role='textbox'], [contenteditable='true'], [role='tab'], [role='menuitem'], [role='switch'], h1, h2, h3, h4, h5, h6, [tabindex]:not([tabindex='-1'])";

/**
 * Humanizes element name attributes (e.g. "full_name" -> "Full Name", "userEmail" -> "User Email").
 * @param {string} name
 * @returns {string}
 */
function humanizeName(name) {
  if (!name) return "";
  return name
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim()
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Checks if an extracted label is generic boilerplate rather than a meaningful semantic title.
 * @param {string} str
 * @returns {boolean}
 */
function isGenericBoilerplateLabel(str) {
  const s = (str || "").toLowerCase().trim();
  if (!s) return true;
  const boilerplateExact = new Set([
    "your answer",
    "enter your answer",
    "type your answer",
    "write a response",
    "required question",
    "this is a required question",
    "text field",
    "input field",
    "textarea",
    "*",
    "short answer text",
    "long answer text",
    "option 1",
    "untitled question"
  ]);
  if (boilerplateExact.has(s)) return true;
  if (/^(?:your\s+answer|required\s+question|\*|text\s+field|input\s+field)$/i.test(s)) return true;
  return false;
}

/**
 * Cleans extracted form field title text by stripping punctuation, colons, and asterisks.
 * @param {string} str
 * @returns {string}
 */
function cleanFieldTitle(str) {
  return (str || "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s*\*+\s*$/g, "")
    .replace(/^\s*\*+\s*/g, "")
    .replace(/[:*#_\-\/\\]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Resolves an element's visible semantic label strictly via local DOM signals.
 * Implements strict priority order (never reads .value):
 * 1. explicitly associated <label for="id">
 * 2. wrapping ancestor <label>
 * 3. non-boilerplate aria-label
 * 4. non-boilerplate aria-labelledby (resolves referenced element(s) text)
 * 5. enclosing question container (.M7eMe, [role="heading"], .geS5n, .Qr7Oae, .form-group)
 * 6. associated visible label text (aria-describedby)
 * 7. name attribute (humanized)
 * 8. placeholder (non-boilerplate)
 * 9. title attribute
 * 10. nearby preceding visible text sibling
 * 11. type-based fallback ("<type> field")
 *
 * @param {Element} el - DOM form control
 * @param {string} type - Identified element type ("input", "textarea", "select", etc.)
 * @returns {string} Extracted human-readable label
 */
function extractFormFieldLabel(el, type) {
  const tagName = (el.tagName || "").toLowerCase();
  const elId = el.id ? el.id.trim() : "";

  // 1. Explicitly associated <label for="id">
  if (elId && typeof document !== "undefined" && document.querySelector) {
    try {
      const escapedId = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(elId) : elId;
      const labelFor = document.querySelector(`label[for="${escapedId}"]`);
      if (labelFor) {
        const text = cleanFieldTitle(labelFor.innerText || labelFor.textContent || "");
        if (text && !isGenericBoilerplateLabel(text)) return text;
      }
    } catch (_) {}
  }

  // 2. Wrapping ancestor <label>
  if (el.closest) {
    const ancestorLabel = el.closest("label");
    if (ancestorLabel) {
      try {
        const clone = ancestorLabel.cloneNode(true);
        const nestedInputs = clone.querySelectorAll("input, textarea, select");
        nestedInputs.forEach(input => input.remove());
        const text = cleanFieldTitle(clone.innerText || clone.textContent || "");
        if (text && !isGenericBoilerplateLabel(text)) return text;
      } catch (_) {}
      const rawText = cleanFieldTitle(ancestorLabel.innerText || ancestorLabel.textContent || "");
      if (rawText && !isGenericBoilerplateLabel(rawText)) return rawText;
    }
  }

  // 3. aria-label (only if not generic boilerplate like "Your answer")
  if (el.getAttribute) {
    const ariaLabel = el.getAttribute("aria-label");
    if (ariaLabel && ariaLabel.trim()) {
      const cleaned = cleanFieldTitle(ariaLabel);
      if (cleaned && !isGenericBoilerplateLabel(cleaned)) {
        return cleaned;
      }
    }
  }

  // 4. aria-labelledby (resolve referenced elements, filtering out boilerplate IDs/tokens)
  if (el.getAttribute && typeof document !== "undefined" && document.getElementById) {
    const ariaLabelledBy = el.getAttribute("aria-labelledby");
    if (ariaLabelledBy && ariaLabelledBy.trim()) {
      const ids = ariaLabelledBy.trim().split(/\s+/);
      const parts = [];
      for (const id of ids) {
        const refEl = document.getElementById(id);
        if (refEl) {
          const text = cleanFieldTitle(refEl.innerText || refEl.textContent || "");
          if (text && !isGenericBoilerplateLabel(text)) {
            parts.push(text);
          }
        }
      }
      if (parts.length > 0) {
        const combined = cleanFieldTitle(parts.join(" "));
        if (combined && !isGenericBoilerplateLabel(combined)) {
          return combined;
        }
      }
    }
  }

  // 5. Enclosing Question Container (Google Forms / modern web form structures)
  // Handles: Google Forms (.Qr7Oae, .geS5n, [role="listitem"], [data-item-id])
  // Resolves: .M7eMe, [role="heading"], .exportQuestionTitle, .freebirdFormviewerComponentsQuestionBaseTitle
  if (el.closest) {
    const questionContainer = el.closest(
      "[role='listitem'], .Qr7Oae, .geS5n, [data-item-id], .freebirdFormviewerViewNumberedItemContainer, .freebirdFormviewerComponentsQuestionBaseRoot, .form-group, .field-group, .form-item, fieldset"
    );
    if (questionContainer) {
      const heading = questionContainer.querySelector(
        ".M7eMe, [role='heading'], .exportQuestionTitle, .freebirdFormviewerComponentsQuestionBaseTitle, .FmiOAc, .c2gGi, legend, label, .field-label, h1, h2, h3, h4, h5, strong, b"
      );
      if (heading && heading !== el) {
        const headingText = cleanFieldTitle(heading.innerText || heading.textContent || "");
        if (headingText && !isGenericBoilerplateLabel(headingText) && headingText.length < 100) {
          return headingText;
        }
      }
    }
  }

  // 6. Associated visible label text (aria-describedby)
  if (el.getAttribute && typeof document !== "undefined" && document.getElementById) {
    const describedBy = el.getAttribute("aria-describedby");
    if (describedBy && describedBy.trim()) {
      const ids = describedBy.trim().split(/\s+/);
      const parts = [];
      for (const id of ids) {
        const refEl = document.getElementById(id);
        if (refEl) {
          const text = cleanFieldTitle(refEl.innerText || refEl.textContent || "");
          if (text && !isGenericBoilerplateLabel(text) && text.length < 100) {
            parts.push(text);
          }
        }
      }
      if (parts.length > 0) {
        const combined = cleanFieldTitle(parts.join(" "));
        if (combined && !isGenericBoilerplateLabel(combined)) {
          return combined;
        }
      }
    }
  }

  // 7. name attribute (humanized)
  if (el.getAttribute) {
    const nameAttr = el.getAttribute("name");
    if (nameAttr && nameAttr.trim()) {
      const humanized = humanizeName(nameAttr);
      if (humanized && !isGenericBoilerplateLabel(humanized)) return humanized;
    }
  }

  // 8. placeholder (non-boilerplate)
  if (el.getAttribute) {
    const placeholder = el.getAttribute("placeholder");
    if (placeholder && placeholder.trim()) {
      const cleaned = cleanFieldTitle(placeholder);
      if (cleaned && !isGenericBoilerplateLabel(cleaned)) {
        return cleaned;
      }
    }
  }

  // 9. title attribute
  if (el.getAttribute) {
    const title = el.getAttribute("title");
    if (title && title.trim()) {
      const cleaned = cleanFieldTitle(title);
      if (cleaned && !isGenericBoilerplateLabel(cleaned)) {
        return cleaned;
      }
    }
  }

  // 10. Nearby preceding visible text sibling
  let prev = el.previousElementSibling;
  while (prev) {
    const prevText = cleanFieldTitle(prev.innerText || prev.textContent || "");
    if (prevText && !isGenericBoilerplateLabel(prevText) && prevText.length < 100) {
      return prevText;
    }
    prev = prev.previousElementSibling;
  }

  // 11. Enclosing form-group / container label fallback
  if (el.closest) {
    const parentGroup = el.closest(".form-group, .field-group, .form-row, .input-group, div, p");
    if (parentGroup && (typeof document === "undefined" || parentGroup !== document.body)) {
      const labelLike = parentGroup.querySelector("label, .field-label, .label, span, strong, b");
      if (labelLike && labelLike !== el) {
        const text = cleanFieldTitle(labelLike.innerText || labelLike.textContent || "");
        if (text && !isGenericBoilerplateLabel(text) && text.length < 100) return text;
      }
    }
  }

  // 12. Fallback to "<type> field"
  if (tagName === "input") {
    if (el.type === "password") {
      return "Password field";
    } else if (el.type === "email") {
      return "Email field";
    } else if (el.type === "checkbox") {
      return "Checkbox";
    } else if (el.type === "radio") {
      return "Radio button";
    } else {
      return el.type ? `${el.type} field` : "Input field";
    }
  } else if (tagName === "textarea") {
    return "Textarea";
  } else if (tagName === "select") {
    return "Select dropdown";
  }

  return `${type} field`;
}

/**
 * Shared helper to classify a single DOM element's type, label, semantic tag, and visible bounding box.
 * SECURITY: Never reads or records `.value` from any input or form control.
 *
 * @param {Element} el - DOM element
 * @param {number|null} [fieldId=null] - Stable per-scan form-field index
 * @returns {Object|null} Element descriptor or null if hidden
 */
function classifyVisualElement(el, fieldId = null) {
  if (!el) return null;
  // Milestone 18: Isolate agent overlay elements from visual perception
  if (el.closest && (el.closest("#sih-agent-overlay-root") || el.closest("[id^='sih-agent-overlay']"))) {
    return null;
  }
  if (el.id && el.id.startsWith("sih-agent-overlay")) {
    return null;
  }

  // 1. Check layout presence and visibility
  const rect = getVisibleRect(el);
  if (!rect) {
    return null;
  }

  // 2. Identify UI element type
  const tagName = (el.tagName || "").toLowerCase();
  const elRole = el.getAttribute ? (el.getAttribute("role") || "").toLowerCase() : "";
  const isContentEditable = !!(el.isContentEditable || (el.getAttribute && el.getAttribute("contenteditable") === "true"));
  let type = "element";

  if (/^h[1-6]$/.test(tagName)) {
    type = "heading";
  } else if (tagName === "button" || elRole === "button" || (tagName === "input" && ["button", "submit", "reset"].includes(el.type))) {
    type = "button";
  } else if (tagName === "a" || elRole === "link") {
    type = "link";
  } else if (tagName === "textarea") {
    type = "textarea";
  } else if (tagName === "select" || elRole === "combobox") {
    type = "select";
  } else if (elRole === "textbox" || isContentEditable) {
    type = (el.getAttribute && el.getAttribute("aria-multiline") === "true") || tagName === "textarea" ? "textarea" : "input";
  } else if (tagName === "input") {
    if (el.type === "checkbox" || elRole === "checkbox") {
      type = "checkbox";
    } else if (el.type === "radio" || elRole === "radio") {
      type = "radio";
    } else {
      type = "input";
    }
  } else if (["checkbox", "radio", "tab", "menuitem", "switch"].includes(elRole)) {
    type = elRole;
  }

  // 3. Safe, non-sensitive label extraction
  // NOTE: Explicitly NEVER reads .value from user-entered form controls to ensure privacy preservation.
  let label = "";
  const isFormField = ["input", "textarea", "select"].includes(tagName) || elRole === "textbox" || isContentEditable;

  if (isFormField) {
    label = extractFormFieldLabel(el, type);
  } else {
    // Buttons, links, headings, interactive roles
    if (el.getAttribute && el.getAttribute("aria-label")) {
      label = el.getAttribute("aria-label").trim();
    } else if (el.getAttribute && el.getAttribute("aria-labelledby") && typeof document !== "undefined" && document.getElementById) {
      const ids = el.getAttribute("aria-labelledby").trim().split(/\s+/);
      const parts = [];
      for (const id of ids) {
        const refEl = document.getElementById(id);
        if (refEl) {
          const t = (refEl.innerText || refEl.textContent || "").trim();
          if (t) parts.push(t);
        }
      }
      if (parts.length > 0) label = parts.join(" ");
    }
    if (!label) {
      label = (el.innerText || el.textContent || "").trim();
    }
    if (!label && el.querySelector) {
      const img = el.querySelector("img[alt]");
      if (img && img.getAttribute("alt")) {
        label = img.getAttribute("alt").trim();
      }
    }
    if (!label && el.getAttribute && el.getAttribute("title")) {
      label = el.getAttribute("title").trim();
    }
    if (!label && tagName === "input" && ["button", "submit", "reset"].includes(el.type) && el.value) {
      label = String(el.value).trim();
    }
  }

  // Normalize spacing and truncate label length
  label = label.replace(/\s+/g, " ").slice(0, 60) || `${type} element`;

  const isDisabled = !!(
    el.disabled ||
    (el.getAttribute && el.getAttribute("aria-disabled") === "true") ||
    (el.classList && el.classList.contains("disabled"))
  );

  // 4. Record bounding box and metadata with safe semantic label
  const semanticTag = getSemanticTag(type, label, el);
  const descriptor = {
    type: type,
    role: elRole || (["button", "link"].includes(type) ? type : (isFormField ? "textbox" : null)),
    label: label,
    text: label,
    semanticTag: semanticTag,
    visible: true,
    enabled: !isDisabled,
    disabled: isDisabled,
    placeholder: (el.getAttribute ? el.getAttribute("placeholder") : null) || null,
    ariaLabel: (el.getAttribute ? el.getAttribute("aria-label") : null) || null,
    title: (el.getAttribute ? el.getAttribute("title") : null) || null,
    alt: (el.getAttribute ? el.getAttribute("alt") : null) || (el.querySelector ? el.querySelector("img[alt]")?.getAttribute("alt") : null) || null,
    dataColor: (el.getAttribute ? (el.getAttribute("data-color") || el.getAttribute("data-colour") || (el.dataset && (el.dataset.color || el.dataset.colour))) : null) || null,
    inputType: tagName === "input" ? (el.type || "text") : null,
    isInteractable: !isDisabled && ["button", "link", "input", "textarea", "select", "checkbox", "radio", "textbox"].includes(type),
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
    bounds: {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height)
    },
    index: typeof fieldId === "number" ? fieldId : null,
    confidence: 1.0,
    evidence: `Local DOM: tag=${tagName}, role=${elRole || "none"}, semanticTag=${semanticTag || "none"}`
  };

  if (isFormField && typeof fieldId === "number") {
    descriptor.fieldId = fieldId;
  }

  return descriptor;
}

/**
 * Milestone 8 & 16: Local DOM-based visual element perception (client-side only).
 * Scans for visible buttons, links, headings, inputs, textareas, and selects.
 * Strips DOM node references for message-passing serializability.
 *
 * @returns {Array<Object>} Array of visible UI element descriptors
 */
function extractVisualElements() {
  const elements = document.querySelectorAll(VISUAL_SELECTOR);
  const visualElements = [];
  let formFieldCounter = 0;

  elements.forEach((el) => {
    const tagName = (el.tagName || "").toLowerCase();
    const isFormField = ["input", "textarea", "select"].includes(tagName) ||
      (el.getAttribute && el.getAttribute("role") === "textbox") ||
      el.isContentEditable ||
      (el.getAttribute && el.getAttribute("contenteditable") === "true");
    const fieldId = isFormField ? formFieldCounter++ : null;
    const item = classifyVisualElement(el, fieldId);
    if (item) {
      item.index = visualElements.length;
      visualElements.push(item);
    }
  });

  return visualElements;
}

/**
 * Milestone 15 & 16: Node-carrying visual element extraction for live DOM re-verification.
 * Keeps a reference to the live DOM node for safe in-page execution.
 *
 * @returns {Array<Object>} Array of visual element descriptors with live .node references
 */
function extractVisualElementsWithNodes() {
  const elements = document.querySelectorAll(VISUAL_SELECTOR);
  const visualElementsWithNodes = [];
  let formFieldCounter = 0;

  elements.forEach((el) => {
    const tagName = (el.tagName || "").toLowerCase();
    const isFormField = ["input", "textarea", "select"].includes(tagName) ||
      (el.getAttribute && el.getAttribute("role") === "textbox") ||
      el.isContentEditable ||
      (el.getAttribute && el.getAttribute("contenteditable") === "true");
    const fieldId = isFormField ? formFieldCounter++ : null;
    const item = classifyVisualElement(el, fieldId);
    if (item) {
      item.index = visualElementsWithNodes.length;
      visualElementsWithNodes.push({
        ...item,
        node: el
      });
    }
  });

  return visualElementsWithNodes;
}

/**
 * Milestone 11: Local DOM-attribute heuristic for sensitive input detection.
 * Checks purely input types and name/id/placeholder keywords.
 * SECURITY: Never reads or inspects `.value` of any field.
 */
const SENSITIVE_KEYWORDS = ["card", "credit", "cvv", "ssn", "phone", "password", "email"];

function isSensitiveElement(el) {
  if (!el || !el.tagName) {
    return false;
  }
  // Milestone 18: Isolate agent overlay elements from sensitive detection
  if (el.closest && (el.closest("#sih-agent-overlay-root") || el.closest("[id^='sih-agent-overlay']"))) {
    return false;
  }
  const tagName = el.tagName.toLowerCase();
  if (tagName !== "input" && tagName !== "textarea") {
    return false;
  }

  const type = (el.type || "").toLowerCase();
  if (tagName === "input" && (type === "password" || type === "email")) {
    return true;
  }

  // Pure attribute heuristic — never reads .value
  const nameAttr = (el.getAttribute("name") || "").toLowerCase();
  const idAttr = (el.id || "").toLowerCase();
  const placeholderAttr = (el.getAttribute("placeholder") || "").toLowerCase();

  return SENSITIVE_KEYWORDS.some(kw =>
    nameAttr.includes(kw) || idAttr.includes(kw) || placeholderAttr.includes(kw)
  );
}

/**
 * Deduplicates overlapping / duplicate sensitive regions.
 * Merges bounding boxes when overlap is significant.
 *
 * @param {Array<Object>} regions - Array of bounding boxes {x, y, width, height, source}
 * @returns {Array<Object>} Deduplicated array of bounding boxes
 */
function deduplicateSensitiveRegions(regions) {
  if (!Array.isArray(regions) || regions.length <= 1) return regions || [];

  let currentList = regions.map(r => ({ ...r }));
  let hasMerged = true;

  while (hasMerged) {
    hasMerged = false;
    const nextList = [];
    const mergedIndices = new Set();

    for (let i = 0; i < currentList.length; i++) {
      if (mergedIndices.has(i)) continue;
      let boxA = { ...currentList[i] };

      for (let j = i + 1; j < currentList.length; j++) {
        if (mergedIndices.has(j)) continue;
        const boxB = currentList[j];

        // Check if boxA and boxB overlap
        const xOverlap = Math.max(0, Math.min(boxA.x + boxA.width, boxB.x + boxB.width) - Math.max(boxA.x, boxB.x));
        const yOverlap = Math.max(0, Math.min(boxA.y + boxA.height, boxB.y + boxB.height) - Math.max(boxA.y, boxB.y));

        if (xOverlap > 0 && yOverlap > 0) {
          const areaA = boxA.width * boxA.height;
          const areaB = boxB.width * boxB.height;
          const overlapArea = xOverlap * yOverlap;

          // Merge if overlap covers at least 30% of either box (e.g. nested / overlapping field)
          if (overlapArea >= 0.3 * Math.min(areaA, areaB)) {
            const minX = Math.min(boxA.x, boxB.x);
            const minY = Math.min(boxA.y, boxB.y);
            const maxX = Math.max(boxA.x + boxA.width, boxB.x + boxB.width);
            const maxY = Math.max(boxA.y + boxA.height, boxB.y + boxB.height);

            boxA.x = minX;
            boxA.y = minY;
            boxA.width = maxX - minX;
            boxA.height = maxY - minY;
            boxA.source = (boxA.source === boxB.source) ? boxA.source : "dom-merged";

            mergedIndices.add(j);
            hasMerged = true;
          }
        }
      }
      nextList.push(boxA);
    }
    currentList = nextList;
  }

  return currentList;
}

/**
 * Comprehensive selector for live form controls, inputs, editable areas, and form token/chip elements.
 */
const SENSITIVE_CONTROL_SELECTOR = "input, textarea, select, [contenteditable], [role='textbox'], [role='combobox'], [role='searchbox'], [role='option'], [data-hovercard-id], [email], [data-value], [class*='chip'], [class*='token'], [class*='recipient'], [class*='tag'], [class*='pill']";

/**
 * Safely and temporarily reads the local value of a live form control or chip for local PII inspection.
 * Never leaks or transmits raw text outside the client-side content script.
 *
 * @param {Element} el - DOM element
 * @returns {string} Temporary local value
 */
function extractElementLocalValue(el) {
  if (!el) return "";
  const tagName = (el.tagName || "").toLowerCase();

  if (tagName === "input" || tagName === "textarea") {
    if (el.value && typeof el.value === "string" && el.value.trim().length > 0) {
      return el.value;
    }
    const attrVal = el.getAttribute ? (el.getAttribute("value") || el.getAttribute("data-value") || "") : "";
    if (attrVal && typeof attrVal === "string" && attrVal.trim().length > 0) {
      return attrVal;
    }
    const txt = (el.innerText || el.textContent || "").trim();
    if (txt) return txt;
    return "";
  }

  if (tagName === "select") {
    if (el.selectedOptions && el.selectedOptions[0]) {
      return el.selectedOptions[0].text || el.value || "";
    }
    return el.value || "";
  }

  if (el.isContentEditable || (el.getAttribute && el.getAttribute("contenteditable") !== null && el.getAttribute("contenteditable") !== "false")) {
    return el.innerText || el.textContent || "";
  }

  // Attributes commonly used for email chips / recipient tokens (e.g. Gmail <span email="...">)
  if (el.getAttribute) {
    const emailAttr = el.getAttribute("email");
    if (emailAttr && typeof emailAttr === "string" && emailAttr.trim().length > 0) return emailAttr;
    const hovercard = el.getAttribute("data-hovercard-id");
    if (hovercard && typeof hovercard === "string" && hovercard.trim().length > 0) return hovercard;
    const dataVal = el.getAttribute("data-value");
    if (dataVal && typeof dataVal === "string" && dataVal.trim().length > 0) return dataVal;
  }

  return (el.innerText || el.textContent || "").trim();
}

/**
 * Checks a string locally for sensitive PII using existing M2 detectors.
 *
 * @param {string} val - String to evaluate
 * @returns {{ detected: boolean, redacted: string }} Detection result
 */
function checkValueSensitivity(val) {
  if (!val || typeof val !== "string" || !val.trim()) {
    return { detected: false, redacted: "" };
  }
  if (typeof detectAndRedactSensitiveValue === "function") {
    return detectAndRedactSensitiveValue(val);
  }
  if (typeof window !== "undefined" && typeof window.detectAndRedactSensitiveValue === "function") {
    return window.detectAndRedactSensitiveValue(val);
  }
  if (typeof globalThis !== "undefined" && typeof globalThis.detectAndRedactSensitiveValue === "function") {
    return globalThis.detectAndRedactSensitiveValue(val);
  }
  if (typeof redactText === "function") {
    const red = redactText(val);
    return { detected: red !== val, redacted: red };
  }
  if (typeof window !== "undefined" && typeof window.redactText === "function") {
    const red = window.redactText(val);
    return { detected: red !== val, redacted: red };
  }
  if (typeof globalThis !== "undefined" && typeof globalThis.redactText === "function") {
    const red = globalThis.redactText(val);
    return { detected: red !== val, redacted: red };
  }
  if (typeof require === "function") {
    try {
      const pii = require("./pii-detector.js");
      if (pii && typeof pii.detectAndRedactSensitiveValue === "function") {
        return pii.detectAndRedactSensitiveValue(val);
      }
    } catch (_) {}
  }
  return { detected: false, redacted: "" };
}

/**
 * Milestone 11 & SIH26171: Extracts bounding boxes of visible sensitive elements.
 * Combines:
 * A. Structural detection (M11): password fields, type=email, sensitive name/id/placeholder keywords (even if empty).
 * B. Local value-based detection (SIH26171): arbitrary form fields containing sensitive PII (emails, phones, credit cards, passwords).
 *
 * Privacy & Security Guarantees:
 * - Temporary local inspection only; NEVER exports or logs the raw .value string.
 * - Deduplicates overlapping bounding boxes.
 *
 * @returns {Array<Object>} Array of sensitive region bounding boxes {x, y, width, height, source}
 */
function extractSensitiveRegions() {
  const elements = document.querySelectorAll(SENSITIVE_CONTROL_SELECTOR);
  const sensitiveRegions = [];

  elements.forEach((el) => {
    // Isolate agent overlay elements
    if (el.closest && (el.closest("#sih-agent-overlay-root") || el.closest("[id^='sih-agent-overlay']"))) {
      return;
    }
    if (el.id && el.id.startsWith("sih-agent-overlay")) {
      return;
    }

    // Reason A: Existing M11 structural sensitivity (password, type=email, sensitive keywords)
    const isStructural = isSensitiveElement(el);

    // Reason B: Local value-based PII detection
    let isValueSensitive = false;
    const localVal = extractElementLocalValue(el);

    if (localVal) {
      const check = checkValueSensitivity(localVal);
      if (check && check.detected) {
        isValueSensitive = true;
      }
    }

    // If sensitive either structurally or by live value
    if (isStructural || isValueSensitive) {
      let rect = getVisibleRect(el);
      // Fallback for shrunk/tokenized inputs (e.g. styled cursor or chip inputs) where parent container has the visible bounds
      if ((!rect || rect.width < 40) && el.parentElement) {
        const parentRect = getVisibleRect(el.parentElement);
        if (parentRect && parentRect.width > (rect ? rect.width : 2)) {
          rect = parentRect;
        }
      }
      if (!rect) return;

      const left = typeof rect.x === "number" ? rect.x : (typeof rect.left === "number" ? rect.left : 0);
      const top = typeof rect.y === "number" ? rect.y : (typeof rect.top === "number" ? rect.top : 0);
      const rx = Math.round(left);
      const ry = Math.round(top);
      const rw = Math.round(rect.width);
      const rh = Math.round(rect.height);

      if (rw > 0 && rh > 0) {
        sensitiveRegions.push({
          x: rx,
          y: ry,
          width: rw,
          height: rh,
          source: (isValueSensitive && !isStructural) ? "dom-value" : "dom"
        });
      }
    }
  });

  return deduplicateSensitiveRegions(sensitiveRegions);
}

let currentApprovalCallback = null;

function removeInPageApprovalModal() {
  const existing = document.getElementById("sih-agent-approval-overlay");
  if (existing) {
    existing.remove();
  }
  if (currentApprovalCallback) {
    currentApprovalCallback = null;
  }
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function showInPageApprovalModal(actionDetails, callback) {
  removeInPageApprovalModal();
  currentApprovalCallback = callback;

  const overlay = document.createElement("div");
  overlay.id = "sih-agent-approval-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-labelledby", "sih-approval-title");

  Object.assign(overlay.style, {
    position: "fixed",
    top: "0",
    left: "0",
    width: "100vw",
    height: "100vh",
    backgroundColor: "rgba(10, 15, 29, 0.75)",
    backdropFilter: "blur(6px)",
    WebkitBackdropFilter: "blur(6px)",
    zIndex: "2147483647",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    color: "#ffffff",
    padding: "20px",
    boxSizing: "border-box"
  });

  const card = document.createElement("div");
  card.id = "sih-agent-approval-card";
  Object.assign(card.style, {
    backgroundColor: "#111827",
    border: "1px solid rgba(239, 68, 68, 0.4)",
    borderRadius: "16px",
    padding: "24px 28px",
    maxWidth: "480px",
    width: "100%",
    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.6), 0 0 30px rgba(239, 68, 68, 0.2)",
    display: "flex",
    flexDirection: "column",
    gap: "16px"
  });

  const header = document.createElement("div");
  header.style.display = "flex";
  header.style.alignItems = "center";
  header.style.justifyContent = "space-between";

  const badge = document.createElement("div");
  badge.textContent = "SAFETY GATE: APPROVAL REQUIRED";
  Object.assign(badge.style, {
    fontSize: "11px",
    fontWeight: "700",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    padding: "4px 10px",
    borderRadius: "9999px",
    backgroundColor: "rgba(239, 68, 68, 0.18)",
    color: "#f87171",
    border: "1px solid rgba(239, 68, 68, 0.4)"
  });

  const riskBadge = document.createElement("div");
  riskBadge.textContent = actionDetails.risk || "HIGH RISK";
  Object.assign(riskBadge.style, {
    fontSize: "11px",
    fontWeight: "700",
    padding: "4px 10px",
    borderRadius: "9999px",
    backgroundColor: "#ef4444",
    color: "#ffffff"
  });

  header.appendChild(badge);
  header.appendChild(riskBadge);

  const title = document.createElement("h2");
  title.id = "sih-approval-title";
  title.textContent = "Agent Ready for Consequential Action";
  Object.assign(title.style, {
    margin: "0",
    fontSize: "18px",
    fontWeight: "600",
    color: "#f3f4f6"
  });

  const body = document.createElement("div");
  Object.assign(body.style, {
    backgroundColor: "rgba(31, 41, 55, 0.6)",
    border: "1px solid rgba(75, 85, 99, 0.4)",
    borderRadius: "10px",
    padding: "14px 16px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    fontSize: "13px",
    lineHeight: "1.5"
  });

  const actionRow = document.createElement("div");
  actionRow.innerHTML = `<span style="color:#9ca3af;">Action: </span><strong style="color:#60a5fa;">${escapeHtml(actionDetails.action || "CLICK")} &rarr; ${escapeHtml(actionDetails.target || "Submit")}</strong>`;

  const reasonRow = document.createElement("div");
  reasonRow.innerHTML = `<span style="color:#9ca3af;">Reason: </span><span style="color:#e5e7eb;">${escapeHtml(actionDetails.reason || "This action will submit or modify state.")}</span>`;

  const contextRow = document.createElement("div");
  contextRow.innerHTML = `<span style="color:#9ca3af;">Page: </span><span style="color:#d1d5db;">${escapeHtml(document.title || window.location.hostname)}</span>`;

  body.appendChild(actionRow);
  body.appendChild(reasonRow);
  body.appendChild(contextRow);

  if (actionDetails.taskSummary) {
    const taskRow = document.createElement("div");
    taskRow.innerHTML = `<span style="color:#9ca3af;">Task: </span><span style="color:#d1d5db;">${escapeHtml(actionDetails.taskSummary)}</span>`;
    body.appendChild(taskRow);
  }

  const notice = document.createElement("p");
  notice.textContent = "This action will not execute automatically. Explicit human confirmation is required.";
  Object.assign(notice.style, {
    margin: "0",
    fontSize: "12px",
    color: "#9ca3af"
  });

  const btnContainer = document.createElement("div");
  Object.assign(btnContainer.style, {
    display: "flex",
    gap: "12px",
    marginTop: "8px"
  });

  const btnApprove = document.createElement("button");
  btnApprove.id = "sih-btn-approve";
  btnApprove.textContent = "Approve & Continue";
  Object.assign(btnApprove.style, {
    flex: "1",
    backgroundColor: "#10b981",
    color: "#ffffff",
    border: "none",
    borderRadius: "8px",
    padding: "10px 16px",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "background-color 0.15s ease"
  });
  btnApprove.onmouseenter = () => { btnApprove.style.backgroundColor = "#059669"; };
  btnApprove.onmouseleave = () => { btnApprove.style.backgroundColor = "#10b981"; };

  const btnCancel = document.createElement("button");
  btnCancel.id = "sih-btn-cancel";
  btnCancel.textContent = "Cancel Execution";
  Object.assign(btnCancel.style, {
    flex: "1",
    backgroundColor: "#374151",
    color: "#e5e7eb",
    border: "1px solid #4b5563",
    borderRadius: "8px",
    padding: "10px 16px",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "background-color 0.15s ease"
  });
  btnCancel.onmouseenter = () => { btnCancel.style.backgroundColor = "#4b5563"; };
  btnCancel.onmouseleave = () => { btnCancel.style.backgroundColor = "#374151"; };

  btnApprove.addEventListener("click", () => {
    removeInPageApprovalModal();
    if (callback) callback({ approved: true });
  });

  btnCancel.addEventListener("click", () => {
    removeInPageApprovalModal();
    if (callback) callback({ approved: false, cancelled: true });
  });

  btnContainer.appendChild(btnCancel);
  btnContainer.appendChild(btnApprove);

  card.appendChild(header);
  card.appendChild(title);
  card.appendChild(body);
  card.appendChild(notice);
  card.appendChild(btnContainer);

  overlay.appendChild(card);
  document.body.appendChild(overlay);
}

// =====================================================================
// Milestone 18: Live Explainable Agent Overlay (HUD Telemetry)
// Lightweight in-page bounding box & explainability card for live page demo
// =====================================================================
let currentOverlayData = null;
let currentOverlayTargetNode = null;
let overlayScrollListener = null;

function clearAgentOverlay() {
  const existing = document.getElementById("sih-agent-overlay-root");
  if (existing) {
    existing.remove();
  }
  currentOverlayData = null;
  currentOverlayTargetNode = null;
  if (overlayScrollListener) {
    window.removeEventListener("scroll", overlayScrollListener, true);
    window.removeEventListener("resize", overlayScrollListener, true);
    overlayScrollListener = null;
  }
}

function findOverlayTargetNode(data) {
  if (!data) return null;

  // 1. If targetIndex is provided, search freshElements
  if (typeof data.targetIndex === "number") {
    const freshElements = extractVisualElementsWithNodes();
    if (freshElements[data.targetIndex] && freshElements[data.targetIndex].node && freshElements[data.targetIndex].node.isConnected) {
      if (!data.targetLabel || labelsMatch(freshElements[data.targetIndex].label, data.targetLabel)) {
        return freshElements[data.targetIndex].node;
      }
    }
    // Search candidates by label match
    if (data.targetLabel) {
      const match = freshElements.find(el => el.node && el.node.isConnected && labelsMatch(el.label, data.targetLabel));
      if (match) return match.node;
    }
  }

  // 2. Search by targetLabel in freshElements
  if (data.targetLabel) {
    const freshElements = extractVisualElementsWithNodes();
    const match = freshElements.find(el => el.node && el.node.isConnected && labelsMatch(el.label, data.targetLabel));
    if (match) return match.node;
  }

  // 3. Search by ACTION_TARGET_MAP if target is a known string key
  if (data.target && ACTION_TARGET_MAP[data.target]) {
    const el = document.querySelector(ACTION_TARGET_MAP[data.target]);
    if (el) return el;
  }

  // 4. Fallback search by standard queries for search inputs / submit buttons
  if (data.action === "SUBMIT" || data.target === "search") {
    const searchEl = document.querySelector("input[type='search'], input[name*='search'], input[name*='q'], input[id*='search'], textarea[name*='q']");
    if (searchEl) return searchEl;
  }

  return null;
}

function getOverlayTargetRect(targetNode, fallbackBbox) {
  if (targetNode && targetNode.isConnected) {
    const r = targetNode.getBoundingClientRect();
    if (r && (r.width > 0 || r.height > 0)) {
      const scrollX = window.scrollX || window.pageXOffset || 0;
      const scrollY = window.scrollY || window.pageYOffset || 0;
      return {
        top: r.top + scrollY,
        left: r.left + scrollX,
        width: r.width,
        height: r.height,
        viewportTop: r.top,
        viewportLeft: r.left
      };
    }
  }

  if (fallbackBbox && typeof fallbackBbox.x === "number") {
    const scrollX = window.scrollX || window.pageXOffset || 0;
    const scrollY = window.scrollY || window.pageYOffset || 0;
    return {
      top: fallbackBbox.y + scrollY,
      left: fallbackBbox.x + scrollX,
      width: fallbackBbox.width || 100,
      height: fallbackBbox.height || 36,
      viewportTop: fallbackBbox.y,
      viewportLeft: fallbackBbox.x
    };
  }

  return null;
}

function renderOverlayUI(data, rect) {
  if (!rect || typeof document === "undefined" || !document.body) return;

  let root = document.getElementById("sih-agent-overlay-root");
  if (!root) {
    root = document.createElement("div");
    root.id = "sih-agent-overlay-root";
    root.setAttribute("data-sih-overlay", "true");
    root.setAttribute("aria-hidden", "true");
    Object.assign(root.style, {
      position: "absolute",
      top: "0",
      left: "0",
      width: "100%",
      height: "100%",
      pointerEvents: "none",
      zIndex: "2147483646",
      overflow: "visible"
    });
    document.body.appendChild(root);
  }

  let box = document.getElementById("sih-agent-overlay-box");
  if (!box) {
    box = document.createElement("div");
    box.id = "sih-agent-overlay-box";
    Object.assign(box.style, {
      position: "absolute",
      pointerEvents: "none",
      borderRadius: "6px",
      transition: "border 0.2s ease, box-shadow 0.2s ease, top 0.15s ease, left 0.15s ease, width 0.15s ease, height 0.15s ease",
      boxSizing: "border-box"
    });
    root.appendChild(box);
  }

  let card = document.getElementById("sih-agent-overlay-card");
  if (!card) {
    card = document.createElement("div");
    card.id = "sih-agent-overlay-card";
    Object.assign(card.style, {
      position: "absolute",
      pointerEvents: "none",
      zIndex: "2147483646",
      borderRadius: "8px",
      padding: "8px 12px",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      fontSize: "12px",
      lineHeight: "1.4",
      color: "#f8fafc",
      maxWidth: "340px",
      minWidth: "200px",
      boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.6), 0 0 15px rgba(0, 0, 0, 0.3)",
      backdropFilter: "blur(10px)",
      WebkitBackdropFilter: "blur(10px)",
      transition: "background-color 0.2s ease, border-color 0.2s ease, top 0.15s ease, left 0.15s ease",
      boxSizing: "border-box"
    });
    root.appendChild(card);
  }

  const state = data.state || "GROUNDED";
  let borderColor = "#6366f1";
  let boxShadow = "0 0 12px rgba(99, 102, 241, 0.5), inset 0 0 6px rgba(99, 102, 241, 0.2)";
  let badgeHtml = "";
  let contentHtml = "";

  if (state === "EXECUTING") {
    borderColor = "#f59e0b";
    boxShadow = "0 0 16px rgba(245, 158, 11, 0.6), inset 0 0 8px rgba(245, 158, 11, 0.25)";
    badgeHtml = `<div style="font-size: 10px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: #fbbf24; background: rgba(245, 158, 11, 0.2); border: 1px solid rgba(245, 158, 11, 0.4); padding: 2px 6px; border-radius: 4px; display: inline-block; margin-bottom: 6px;">EXECUTING &#x26A1;</div>`;
    contentHtml = `
      <div><span style="color:#94a3b8; font-weight: 600;">Action: </span><span style="color:#ffffff; font-weight: 700;">${escapeHtml(data.action || "CLICK")}</span></div>
      <div><span style="color:#94a3b8; font-weight: 600;">Target: </span><span style="color:#e2e8f0;">${escapeHtml(data.targetLabel || data.target || "element")}</span></div>
    `;
  } else if (state === "VERIFIED") {
    borderColor = "#10b981";
    boxShadow = "0 0 16px rgba(16, 185, 129, 0.6), inset 0 0 8px rgba(16, 185, 129, 0.25)";
    badgeHtml = `<div style="font-size: 10px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: #34d399; background: rgba(16, 185, 129, 0.2); border: 1px solid rgba(16, 185, 129, 0.4); padding: 2px 6px; border-radius: 4px; display: inline-block; margin-bottom: 6px;">&#x2713; VERIFIED</div>`;
    contentHtml = `
      <div><span style="color:#94a3b8; font-weight: 600;">Action: </span><span style="color:#ffffff; font-weight: 700;">${escapeHtml(data.action || "CLICK")}</span></div>
      <div><span style="color:#94a3b8; font-weight: 600;">Target: </span><span style="color:#e2e8f0;">${escapeHtml(data.targetLabel || data.target || "element")}</span></div>
    `;
  } else if (state === "SAFETY_BLOCKED") {
    borderColor = "#ef4444";
    boxShadow = "0 0 16px rgba(239, 68, 68, 0.6), inset 0 0 8px rgba(239, 68, 68, 0.25)";
    badgeHtml = `<div style="font-size: 10px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: #f87171; background: rgba(239, 68, 68, 0.2); border: 1px solid rgba(239, 68, 68, 0.4); padding: 2px 6px; border-radius: 4px; display: inline-block; margin-bottom: 6px;">&#x1F6E1; SAFETY BLOCKED</div>`;
    contentHtml = `
      <div><span style="color:#94a3b8; font-weight: 600;">Reason: </span><span style="color:#fca5a5; font-weight: 600;">${escapeHtml(data.reason || "Action blocked by safety policy")}</span></div>
      ${data.action ? `<div><span style="color:#94a3b8; font-weight: 600;">Action: </span><span style="color:#e2e8f0;">${escapeHtml(data.action)}</span></div>` : ""}
    `;
  } else {
    // GROUNDED ("AGENT TARGET")
    borderColor = "#6366f1";
    boxShadow = "0 0 12px rgba(99, 102, 241, 0.5), inset 0 0 6px rgba(99, 102, 241, 0.2)";
    badgeHtml = `<div style="font-size: 10px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: #818cf8; background: rgba(99, 102, 241, 0.18); border: 1px solid rgba(99, 102, 241, 0.35); padding: 2px 6px; border-radius: 4px; display: inline-block; margin-bottom: 6px;">AGENT TARGET</div>`;
    const confVal = data.confidence !== undefined ? (typeof data.confidence === "number" ? data.confidence.toFixed(2) : String(data.confidence)) : "1.00";
    contentHtml = `
      <div><span style="color:#94a3b8; font-weight: 600;">Action: </span><span style="color:#ffffff; font-weight: 700;">${escapeHtml(data.action || "CLICK")}</span></div>
      <div><span style="color:#94a3b8; font-weight: 600;">Target: </span><span style="color:#e2e8f0;">${escapeHtml(data.targetLabel || data.target || "element")}</span></div>
      <div><span style="color:#94a3b8; font-weight: 600;">Confidence: </span><span style="color:#38bdf8; font-weight: 600;">${escapeHtml(confVal)}</span></div>
      <div><span style="color:#94a3b8; font-weight: 600;">Method: </span><span style="color:#a78bfa;">${escapeHtml(data.method || "local-fuzzy-match")}</span></div>
    `;
  }

  // Update box styles
  box.style.top = `${rect.top}px`;
  box.style.left = `${rect.left}px`;
  box.style.width = `${Math.max(rect.width, 24)}px`;
  box.style.height = `${Math.max(rect.height, 24)}px`;
  box.style.border = `2px solid ${borderColor}`;
  box.style.boxShadow = boxShadow;

  // Update card styles and contents
  card.style.backgroundColor = "rgba(15, 23, 42, 0.94)";
  card.style.border = `1px solid ${borderColor}`;
  card.innerHTML = `${badgeHtml}${contentHtml}`;

  // Position card near box (above if space allows, otherwise below)
  const cardEstimatedHeight = (state === "GROUNDED") ? 110 : 80;
  const fitsAbove = rect.viewportTop > (cardEstimatedHeight + 16);

  let cardTop = fitsAbove ? (rect.top - cardEstimatedHeight - 8) : (rect.top + rect.height + 8);
  let cardLeft = rect.left;

  const maxLeft = (window.scrollX || 0) + (window.innerWidth || (document.documentElement ? document.documentElement.clientWidth : 800)) - 350;
  if (cardLeft > maxLeft) {
    cardLeft = Math.max(8, maxLeft);
  }

  card.style.top = `${cardTop}px`;
  card.style.left = `${Math.max(8, cardLeft)}px`;
}

function showAgentOverlay(payload) {
  currentOverlayData = payload || {};
  currentOverlayTargetNode = findOverlayTargetNode(currentOverlayData);
  const rect = getOverlayTargetRect(currentOverlayTargetNode, currentOverlayData.bbox);
  if (rect) {
    renderOverlayUI(currentOverlayData, rect);
  }

  if (!overlayScrollListener && typeof window !== "undefined") {
    overlayScrollListener = () => {
      if (currentOverlayData) {
        const r = getOverlayTargetRect(currentOverlayTargetNode, currentOverlayData.bbox);
        if (r) {
          renderOverlayUI(currentOverlayData, r);
        }
      }
    };
    window.addEventListener("scroll", overlayScrollListener, { passive: true, capture: true });
    window.addEventListener("resize", overlayScrollListener, { passive: true });
  }
}

function updateAgentOverlay(payload) {
  if (!currentOverlayData && !payload) return;
  currentOverlayData = {
    ...(currentOverlayData || {}),
    ...(payload || {})
  };
  if (!currentOverlayTargetNode) {
    currentOverlayTargetNode = findOverlayTargetNode(currentOverlayData);
  }
  const rect = getOverlayTargetRect(currentOverlayTargetNode, currentOverlayData.bbox);
  if (rect) {
    renderOverlayUI(currentOverlayData, rect);
  }
}

// Listen for messages sent from the popup
if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getPageInfo") {
      // 1. Collect basic page metadata (Milestone 1)
      const title = document.title || "No Title Found";
      const url = window.location.href;

      // 2. Extract a small snippet of visible text (capped at 2000 characters)
      const rawVisibleText = document.body ? document.body.innerText.slice(0, 2000) : "";

      // 3. Redact any sensitive PII locally before sending back (Milestone 2 & SIH26171)
      let redactedSample = typeof redactText === "function" 
        ? redactText(rawVisibleText) 
        : rawVisibleText;

      // SIH26171: Construct a LOCAL SANITIZED FORM SUMMARY for form fields with sensitive PII.
      // NEVER appends raw values, only sanitized representations (e.g. "[Label]: [REDACTED_EMAIL]").
      try {
        const formControls = document.querySelectorAll(SENSITIVE_CONTROL_SELECTOR);
        const sanitizedFormSnippets = [];

        formControls.forEach((el) => {
          if (el.closest && (el.closest("#sih-agent-overlay-root") || el.closest("[id^='sih-agent-overlay']"))) return;
          if (el.id && el.id.startsWith("sih-agent-overlay")) return;

          const localVal = extractElementLocalValue(el);
          if (localVal) {
            const check = checkValueSensitivity(localVal);
            if (check && check.detected) {
              const tagName = (el.tagName || "").toLowerCase();
              const fieldType = (tagName === "input" ? (el.type || "input") : tagName);
              const safeLabel = extractFormFieldLabel(el, fieldType) || "Field";
              sanitizedFormSnippets.push(`${safeLabel}: ${check.redacted}`);
            }
          }
        });

        if (sanitizedFormSnippets.length > 0) {
          redactedSample += (redactedSample ? "\n\n[Sanitized Form Summary]:\n" : "[Sanitized Form Summary]:\n") + sanitizedFormSnippets.join("\n");
        }
      } catch (_) {}

      // 4. Local visual context perception: extract visible UI elements (Milestone 8)
      const visualElements = extractVisualElements();

      // 5. Local visual privacy: extract sensitive regions (Milestone 11 & SIH26171)
      const tSensStart = performance.now();
      const sensitiveRegions = extractSensitiveRegions();
      const sensitiveDetectionMs = Math.round(performance.now() - tSensStart);
      const valueBasedPiiCount = Array.isArray(sensitiveRegions) ? sensitiveRegions.filter(r => r.source === "dom-value").length : 0;

      // 6. Local search results state detection (Milestone 13 Cross-Website Robustness)
      const urlLower = url.toLowerCase();
      const titleLower = title.toLowerCase();
      const hasSearchUrl = urlLower.includes("/search") || urlLower.includes("?q=") || urlLower.includes("&q=") || urlLower.includes("query=") || urlLower.includes("search?");
      const hasSearchTitle = titleLower.includes("search") || titleLower.includes("results") || titleLower.includes(" - google") || titleLower.includes("at duckduckgo") || titleLower.includes("search results");
      const resultContainers = document.querySelectorAll(
        "#search, #rso, #links, .results, .search-results, [role='main'] a, .mw-search-results, .b_results"
      );
      const isSearchResults = !!(hasSearchUrl || (hasSearchTitle && resultContainers && resultContainers.length > 0));

      // 7. Send the sanitized data back to popup (never expose raw text, passwords, or input values)
      sendResponse({
        success: true,
        title,
        url,
        redactedSample,
        visualElements,
        sensitiveRegions,
        sensitiveDetectionMs,
        valueBasedPiiCount,
        isSearchResults,
        searchSignals: {
          hasSearchUrl,
          hasSearchTitle,
          containerCount: resultContainers ? resultContainers.length : 0
        },
        viewport: {
          width: window.innerWidth || (document.documentElement ? document.documentElement.clientWidth : 0),
          height: window.innerHeight || (document.documentElement ? document.documentElement.clientHeight : 0),
          devicePixelRatio: window.devicePixelRatio || 1,
          scrollX: window.scrollX || 0,
          scrollY: window.scrollY || 0
        }
      });
      return false;
    } else if (request.action === "checkSearchResultsState") {
      const url = (window.location.href || "").toLowerCase();
      const title = (document.title || "").toLowerCase();
      const hasSearchUrl = url.includes("/search") || url.includes("?q=") || url.includes("&q=") || url.includes("query=") || url.includes("search?");
      const hasSearchTitle = title.includes("search") || title.includes("results") || title.includes(" - google") || title.includes("at duckduckgo") || title.includes("search results");
      const resultContainers = document.querySelectorAll(
        "#search, #rso, #links, .results, .search-results, [role='main'] a, .mw-search-results, .b_results"
      );
      const isSearchResults = !!(hasSearchUrl || (hasSearchTitle && resultContainers && resultContainers.length > 0));
      sendResponse({
        success: true,
        isSearchResults,
        hasSearchUrl,
        hasSearchTitle,
        containerCount: resultContainers ? resultContainers.length : 0
      });
      return false;
    } else if (request.action === "getLightweightPageState") {
      // Milestone 22.2: Fast local structural probe without screenshot, canvas, OCR, or innerText scanning
      const url = window.location.href;
      const title = document.title || "No Title Found";
      const viewport = {
        scrollX: window.scrollX || 0,
        scrollY: window.scrollY || 0,
        width: window.innerWidth || (document.documentElement ? document.documentElement.clientWidth : 0),
        height: window.innerHeight || (document.documentElement ? document.documentElement.clientHeight : 0)
      };

      // Extract lightweight structural descriptors (no innerText scanning, no PII scanning, no canvas)
      const elements = extractVisualElements();
      const structuralElements = elements.map((el) => ({
        type: el.type,
        label: el.label,
        semanticTag: el.semanticTag,
        disabled: !!el.disabled,
        x: el.x,
        y: el.y,
        width: el.width,
        height: el.height
      }));

      // Compute lightweight signature if SIHChangeDetector is present in window context
      let signature = null;
      if (typeof window !== "undefined" && window.SIHChangeDetector && typeof window.SIHChangeDetector.computeLightweightDomSignature === "function") {
        signature = window.SIHChangeDetector.computeLightweightDomSignature(structuralElements, { url, title, viewport });
      }

      sendResponse({
        success: true,
        url,
        title,
        interactiveCount: structuralElements.length,
        structuralElements,
        viewport,
        signature
      });
      return false;
    } else if (request.action === "executeAction") {
      // Milestones 5 & 6: Safely execute whitelisted action
      const executionResult = executeAction(request.payload);
      sendResponse({
        success: true,
        result: executionResult
      });
      return false;
    } else if (request.action === "requestHumanApproval") {
      // Safe human-in-the-loop approval modal
      showInPageApprovalModal(request.payload || {}, (response) => {
        sendResponse(response);
      });
      return true; // Keep message channel open for async user response
    } else if (request.action === "dismissHumanApproval") {
      removeInPageApprovalModal();
      sendResponse({ dismissed: true });
      return false;
    } else if (request.action === "showAgentOverlay") {
      // Milestone 18: Live Explainable Agent Overlay
      showAgentOverlay(request.payload || {});
      sendResponse({ success: true });
      return false;
    } else if (request.action === "updateAgentOverlay") {
      updateAgentOverlay(request.payload || {});
      sendResponse({ success: true });
      return false;
    } else if (request.action === "clearAgentOverlay") {
      clearAgentOverlay();
      sendResponse({ success: true });
      return false;
    }

    return false;
  });
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    VISUAL_SELECTOR,
    ACTION_TARGET_MAP,
    SCROLL_TARGET_MAP,
    classifyVisualElement,
    extractVisualElements,
    extractVisualElementsWithNodes,
    extractFormFieldLabel,
    humanizeName,
    executeAction,
    normalizeLabel,
    labelsMatch,
    findContextElement,
    filterCandidatesByContext,
    resolveContextualCandidates,
    selectOrdinalCandidate,
    showInPageApprovalModal,
    removeInPageApprovalModal,
    showAgentOverlay,
    updateAgentOverlay,
    clearAgentOverlay,
    isSensitiveElement,
    extractSensitiveRegions,
    deduplicateSensitiveRegions,
    extractElementLocalValue,
    checkValueSensitivity,
    SENSITIVE_CONTROL_SELECTOR
  };
}
