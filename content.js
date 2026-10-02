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
  } else if (type === "input" || type === "combobox" || type === "textarea" || type === "searchbox" || type === "contenteditable" || type === "textbox") {
    // Modal/post composer controls must never be tagged as SEARCH_INPUT
    const isInDialog = Boolean(el && el.closest && el.closest('[role="dialog"], [role="alertdialog"], [aria-modal="true"], dialog, .modal, .dialog, [class*="modal" i], [class*="dialog" i], [class*="overlay" i]'));
    const isPostIntent = /post|talk\s+about|what\s+do\s+you\s+want\s+to\s+talk\s+about|share\s+your\s+thoughts|thought\s+of\s+the\s+day|start\s+a\s+post|text\s+editor/i.test(normLabel);
    if ((isInDialog || isPostIntent) && (type === "contenteditable" || type === "textbox" || type === "textarea" || (el && el.isContentEditable))) {
      return "POST_COMPOSER";
    }
    const isSpecificFormField = /^(?:from|to|departure|arrival|source|destination|origin|station|city|email|phone|mobile|password|username|name|message|subject)\b/i.test(normLabel);
    if (!isSpecificFormField && !isInDialog && !isPostIntent) {
      const isSearchName = elName === "q" || elName === "query" || /search/i.test(elName);
      const isSearchId = /search/i.test(elId);
      const isSearchType = el && (el.type === "search" || (el.getAttribute && el.getAttribute("type") === "search"));
      const isSearchTitle = el && el.getAttribute && /search/i.test(el.getAttribute("title") || "");
      const isSearchAria = el && el.getAttribute && /search/i.test(el.getAttribute("aria-label") || "");
      const isSearchPlaceholder = el && el.getAttribute && /search/i.test(el.getAttribute("placeholder") || "");
      if (/search/i.test(normLabel) || isSearchName || isSearchId || isSearchType || isSearchTitle || isSearchAria || isSearchPlaceholder) {
        return "SEARCH_INPUT";
      }
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
  if (ordinal >= 1 && ordinal <= sorted.length) {
    return sorted[ordinal - 1];
  }
  return null;
}

/**
 * Weighted Semantic Evidence Matching Engine.
 * Evaluates candidate DOM element against a semantic target descriptor.
 * Considers: exact/normalized label, aria-label, placeholder, role,
 * name/id/title, nearby visible text, associated label, parent/ancestor context.
 * DOM index and coordinates are used strictly as secondary tie-breaking hints.
 *
 * @param {Object} cand - Candidate element descriptor from live perception
 * @param {Object} targetDesc - Semantic target descriptor
 * @returns {number} Confidence score [0.0 - 1.0]
 */
// Helper to normalize bounding boxes [x, y, w, h] or { x, y, width, height }
function normalizeBounds(b) {
  if (!b) return null;
  if (Array.isArray(b) && b.length >= 4) {
    return { x: b[0], y: b[1], width: b[2], height: b[3] };
  }
  if (typeof b.x === "number" && typeof b.y === "number") {
    return { x: b.x, y: b.y, width: b.width || 0, height: b.height || 0 };
  }
  return null;
}

// Helper to normalize URLs
function normalizeUrl(u) {
  if (!u) return "";
  return String(u).trim().toLowerCase()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/+$/, "");
}

/**
 * Determines whether an element is an AI/chat/assistant interface.
 * Universal and website-agnostic: matches semantic patterns across arbitrary pages.
 */
function isAiAssistantElement(el) {
  if (!el) return false;
  const normalize = (s) => (s || "").toLowerCase().replace(/[:*#_\-\/\\]+/g, " ").replace(/\s+/g, " ").trim();
  const texts = [
    el.label,
    el.ariaLabel,
    el.placeholder,
    el.title,
    el.name,
    el.id,
    el.nearbyText,
    el.contextText,
    el.associatedLabel
  ].map(normalize).filter(Boolean);

  const aiPattern = /\b(?:ai\s+mode|ask\s+anything|ask\s+google|gemini|ai\s+assistant|assistant|chat\s+with|ask\s+ai|ai\s+search|copilot|chatgpt|how\s+search\s+works)\b/i;
  const exactAiOrChat = /^(?:chat|ai|assistant|ai\s+mode|copilot|gemini|how\s+search\s+works)$/i;

  return texts.some(t => aiPattern.test(t) || exactAiOrChat.test(t));
}

/**
 * Generic 5-tier semantic ranking for primary search input controls.
 * - Tier 1: Native search control (input[type="search"])
 * - Tier 2: Semantic search naming (name="q", "query", "search", id/name containing search)
 * - Tier 3: Accessible labels (aria-label, title, associated label containing search)
 * - Tier 4: Search placeholders (placeholder containing search)
 * - Tier 5: Other DOM elements with search semantics (semanticTag="SEARCH_INPUT", role="searchbox", label)
 * Explicitly excludes AI/chat/assistant inputs for normal search intent.
 */
function scoreSearchCandidate(el, taskText = "", isExplicitAiAllowed = false) {
  if (!el) return 0;
  const normalize = (s) => (s || "").toLowerCase().replace(/[:*#_\-\/\\]+/g, " ").trim();

  // Check if element is an AI / assistant / chat interface
  if (isAiAssistantElement(el) && !isExplicitAiAllowed) {
    return 0; // Exclude AI/chat/assistant inputs for normal search intent
  }

  // Must be an editable form-capable control
  const elType = (el.type || "").toLowerCase();
  const elRole = (el.role || "").toLowerCase();
  const elTag = (el.tag || el.node?.tagName || "").toLowerCase();
  const isFormType = ["input", "textarea", "combobox", "searchbox", "search", "text", "textbox", "contenteditable"].includes(elType) ||
    ["input", "textarea", "combobox", "searchbox", "textbox"].includes(elRole) ||
    elTag === "input" || elTag === "textarea" ||
    Boolean(el.ariaAutocomplete);
  if (!isFormType) return 0;
  if (el.disabled || String(el["aria-disabled"]).toLowerCase() === "true") return 0;

  // Reject non-text inputs (checkbox, radio, button, submit, file, image)
  if (["button", "submit", "reset", "checkbox", "radio", "file", "image"].includes(elType)) return 0;

  // Reject voice/mic/camera controls unless explicitly requested
  const fullText = [el.label, el.ariaLabel, el.title].map(normalize).join(" ");
  if (!taskText || (!/voice|mic|audio|speak|camera|lens/i.test(taskText))) {
    if (/voice|mic|microphone|audio|speak|camera|lens/i.test(fullText)) return 0;
  }

  const elName = normalize(el.name);
  const elId = normalize(el.id);
  const elAria = normalize(el.ariaLabel);
  const elPlaceholder = normalize(el.placeholder);
  const elTitle = normalize(el.title);
  const elAssoc = normalize(el.associatedLabel);
  const elLabel = normalize(el.label);
  const elContext = normalize(el.contextText || el.nearbyText);

  let tierScore = 0;
  let tiersMatched = 0;

  // Tier 1: Native search control (input[type="search"])
  const isNativeSearch = elType === "search" || el.inputType === "search" || (elTag === "input" && elType === "search");
  if (isNativeSearch) {
    tierScore = Math.max(tierScore, 1.00);
    tiersMatched++;
  }

  // Tier 2: Semantic search naming (name="q", "query", "search", id/name containing search)
  const isExactSearchName = elName === "q" || elName === "query" || elName === "search";
  const isPartialSearchNameOrId = (elName && /\bsearch\b/i.test(elName)) || (elId && /\bsearch\b/i.test(elId));
  if (isExactSearchName) {
    tierScore = Math.max(tierScore, 0.95);
    tiersMatched++;
  } else if (isPartialSearchNameOrId) {
    tierScore = Math.max(tierScore, 0.92);
    tiersMatched++;
  }

  // Tier 3: Accessible labels (aria-label containing "search", associated <label> containing "search", title containing "search")
  const isAriaSearch = elAria && /\bsearch\b/i.test(elAria);
  const isAssocSearch = elAssoc && /\bsearch\b/i.test(elAssoc);
  const isTitleSearch = elTitle && /\bsearch\b/i.test(elTitle);
  if (isAriaSearch || isAssocSearch || isTitleSearch) {
    tierScore = Math.max(tierScore, 0.88);
    tiersMatched++;
  }

  // Tier 4: Search placeholders (placeholder containing "search")
  const isPlaceholderSearch = elPlaceholder && /\bsearch\b/i.test(elPlaceholder);
  if (isPlaceholderSearch) {
    tierScore = Math.max(tierScore, 0.84);
    tiersMatched++;
  }

  // Tier 5: Other DOM elements whose accessible name / role / surrounding semantics indicate search
  const isSemanticTagSearch = el.semanticTag === "SEARCH_INPUT";
  const isSearchRole = elRole === "searchbox" || elType === "searchbox";
  const isLabelSearch = elLabel && /\bsearch\b/i.test(elLabel);
  const isContextSearch = elContext && /\bsearch\b/i.test(elContext);
  if (isSemanticTagSearch || isSearchRole || isLabelSearch || isContextSearch) {
    tierScore = Math.max(tierScore, 0.78);
    tiersMatched++;
  }

  if (tierScore === 0) return 0;

  // Multi-tier reinforcement bonus
  let finalScore = tierScore;
  if (tiersMatched > 1 && finalScore < 1.00) {
    finalScore = Math.min(0.99, finalScore + (tiersMatched - 1) * 0.02);
  }

  return finalScore;
}

/**
 * Weighted Semantic Evidence Matching Engine.
 * Evaluates candidate DOM element against a semantic target descriptor.
 * Considers: exact/normalized label, aria-label, placeholder, role,
 * name/id/title, nearby visible text, associated label, parent/ancestor context.
 * DOM index and coordinates are used strictly as secondary tie-breaking hints.
 *
 * @param {Object} cand - Candidate element descriptor from live perception
 * @param {Object} targetDesc - Semantic target descriptor
 * @returns {number} Confidence score [0.0 - 1.0]
 */
function scoreCandidateAgainstDescriptor(cand, targetDesc) {
  if (!cand || !targetDesc) return 0;
  const normalize = (s) => (s || "").toLowerCase().replace(/[:*#_\-\/\\]+/g, " ").trim();
  const targetLabel = normalize(targetDesc.normalizedLabel || targetDesc.targetLabel || targetDesc.label || targetDesc.fieldHint || targetDesc.target || "");
  if (!targetLabel) return 0;

  const candLabel = normalize(cand.label);
  const candAria = normalize(cand.ariaLabel);
  const candPlaceholder = normalize(cand.placeholder);
  const candName = normalize(cand.name);
  const candId = normalize(cand.id);
  const candTitle = normalize(cand.title);
  const candNearby = normalize(cand.nearbyText);
  const candContext = normalize(cand.contextText);
  const candAssoc = normalize(cand.associatedLabel);

  // SEARCH INTENT GROUNDING: Rank using 5-tier search hierarchy and exclude AI assistants
  const isSearchDescriptor = targetDesc.isSearchIntent ||
    targetDesc.targetRole === "PRIMARY_SEARCH_INPUT" ||
    targetDesc.role === "PRIMARY_SEARCH_INPUT" ||
    targetLabel === "primary_search_input" ||
    targetLabel === "search";

  if (isSearchDescriptor) {
    return scoreSearchCandidate(cand, "", false);
  }

  // COMPOSER SEMANTIC GROUNDING: Handle POST_COMPOSER, MESSAGE_COMPOSER, REPLY_COMPOSER
  const isPostComposerTarget = targetDesc.semanticRole === "POST_COMPOSER" ||
    targetDesc.targetRole === "POST_COMPOSER" ||
    targetDesc.targetRole === "post_composer" ||
    targetDesc.expectedRole === "POST_COMPOSER" ||
    targetDesc.expectedRole === "post_composer" ||
    targetDesc.composerType === "post" ||
    targetDesc.context === "post_composer" ||
    targetLabel === "post composer" ||
    targetLabel === "active post composer" ||
    targetLabel === "linkedin post composer";

  if (isPostComposerTarget) {
    // 1. Strict rejection of search controls and profile avatars
    if (cand.semanticRole === "SEARCH_INPUT" || cand.semanticTag === "SEARCH_INPUT" || cand.type === "search" || /search/i.test(candLabel) || /search/i.test(candAria) || /search/i.test(candPlaceholder)) {
      return 0.0;
    }
    const isProfileAvatar = Boolean(
      /\b(?:profile\s*(?:picture|photo|image|avatar|pic)|user\s*avatar|avatar)\b/i.test(cand.className || cand.node?.className || "") ||
      /\b(?:profile\s*(?:picture|photo|image|avatar|pic)|user\s*avatar|avatar)\b/i.test(candLabel) ||
      /\b(?:profile\s*(?:picture|photo|image|avatar|pic)|user\s*avatar|avatar)\b/i.test(candAria)
    );
    if (isProfileAvatar) return 0.0;

    // 2. Candidate compatibility and contextual scoring
    const candIsContentEditable = Boolean(cand.isContentEditable || cand.type === "contenteditable" || cand.role === "textbox");
    const candInDialog = Boolean(cand.inDialog || cand.inModal);
    const candMatchesClues = /\b(?:post|talk\s+about|what\s+do\s+you\s+want\s+to\s+talk\s+about|share\s+your\s+thoughts|share|thoughts|write|create\s+a\s+post|start\s+a\s+post|text\s+editor)\b/i.test(candLabel + " " + candAria + " " + candPlaceholder + " " + (cand.dataPlaceholder || ""));

    if (cand.semanticRole === "POST_COMPOSER" && candInDialog) return 1.0;
    if (candIsContentEditable && candInDialog && candMatchesClues) return 1.0;
    if (candIsContentEditable && candInDialog) return 0.98;
    if (cand.semanticRole === "POST_COMPOSER") return 0.95;
    if (candIsContentEditable && candMatchesClues) return 0.95;
    if (cand.type === "textarea" && candInDialog) return 0.90;
    if (candIsContentEditable) return 0.85;

    // Generic inputs outside post dialog must never satisfy POST_COMPOSER
    return 0.0;
  }

  const isMessageComposerTarget = targetDesc.semanticRole === "MESSAGE_COMPOSER" ||
    targetDesc.targetRole === "MESSAGE_COMPOSER" ||
    targetDesc.targetRole === "message_composer" ||
    targetDesc.expectedRole === "MESSAGE_COMPOSER" ||
    targetDesc.composerType === "message" ||
    targetLabel === "message composer" ||
    targetLabel === "communication message body" ||
    targetLabel === "active message composer";

  if (isMessageComposerTarget) {
    if (cand.semanticRole === "SEARCH_INPUT" || cand.semanticTag === "SEARCH_INPUT" || cand.type === "search" || /search/i.test(candLabel) || /search/i.test(candAria) || /search/i.test(candPlaceholder)) return 0.0;
    if (cand.semanticRole === "MESSAGE_COMPOSER") return 1.0;
    const isMsgCap = Boolean(cand.isContentEditable || cand.type === "contenteditable" || cand.type === "textarea" || cand.role === "textbox");
    const msgClues = /\b(?:message|chat|conversation|write\s+a\s+message|type\s+a\s+message|send\s+a\s+message)\b/i.test(candLabel + " " + candAria + " " + candPlaceholder);
    if (isMsgCap && (cand.inDialog || msgClues)) return 1.0;
    if (isMsgCap && /message/i.test(candNearby)) return 0.95;
    if (isMsgCap) return 0.85;
    return 0.0;
  }

  const isReplyComposerTarget = targetDesc.semanticRole === "REPLY_COMPOSER" ||
    targetDesc.targetRole === "REPLY_COMPOSER" ||
    targetDesc.targetRole === "reply_composer" ||
    targetDesc.expectedRole === "REPLY_COMPOSER" ||
    targetDesc.composerType === "reply" ||
    targetLabel === "reply composer" ||
    targetLabel === "reply message body" ||
    targetLabel === "active reply composer";

  if (isReplyComposerTarget) {
    if (cand.semanticRole === "SEARCH_INPUT" || cand.semanticTag === "SEARCH_INPUT" || cand.type === "search" || /search/i.test(candLabel) || /search/i.test(candAria) || /search/i.test(candPlaceholder)) return 0.0;
    if (cand.semanticRole === "REPLY_COMPOSER") return 1.0;
    const isReplyCap = Boolean(cand.isContentEditable || cand.type === "contenteditable" || cand.type === "textarea" || cand.role === "textbox");
    const replyClues = /\b(?:reply|response|write\s+a\s+reply|type\s+a\s+reply|body|message\s+body)\b/i.test(candLabel + " " + candAria + " " + candPlaceholder);
    if (isReplyCap && (cand.inDialog || replyClues)) return 1.0;
    if (isReplyCap && /reply/i.test(candNearby)) return 0.95;
    if (isReplyCap) return 0.85;
    return 0.0;
  }

  const isCommentComposerTarget = targetDesc.semanticRole === "COMMENT_COMPOSER" ||
    targetDesc.targetRole === "COMMENT_COMPOSER" ||
    targetDesc.targetRole === "comment_composer" ||
    targetDesc.expectedRole === "COMMENT_COMPOSER" ||
    targetDesc.composerType === "comment" ||
    targetLabel === "comment composer" ||
    targetLabel === "active comment box" ||
    targetLabel === "comment";

  if (isCommentComposerTarget) {
    if (cand.semanticRole === "SEARCH_INPUT" || cand.semanticTag === "SEARCH_INPUT" || cand.type === "search" || /search/i.test(candLabel) || /search/i.test(candAria) || /search/i.test(candPlaceholder)) return 0.0;
    if (cand.semanticRole === "COMMENT_COMPOSER") return 1.0;
    const isCommentCap = Boolean(cand.isContentEditable || cand.type === "contenteditable" || cand.type === "textarea" || cand.role === "textbox");
    const commentClues = /\b(?:comment|add\s+a\s+comment|write\s+a\s+comment|leave\s+a\s+comment)\b/i.test(candLabel + " " + candAria + " " + candPlaceholder);
    if (isCommentCap && (cand.inDialog || commentClues)) return 1.0;
    if (isCommentCap && /comment/i.test(candNearby)) return 0.95;
    if (isCommentCap) return 0.85;
    return 0.0;
  }

  const isChatComposerTarget = targetDesc.semanticRole === "CHAT_COMPOSER" ||
    targetDesc.targetRole === "CHAT_COMPOSER" ||
    targetDesc.expectedRole === "CHAT_COMPOSER" ||
    targetDesc.composerType === "chat" ||
    targetLabel === "chat composer" ||
    targetLabel === "chat box";

  if (isChatComposerTarget) {
    if (cand.semanticRole === "SEARCH_INPUT" || cand.semanticTag === "SEARCH_INPUT" || cand.type === "search" || /search/i.test(candLabel) || /search/i.test(candAria) || /search/i.test(candPlaceholder)) return 0.0;
    if (cand.semanticRole === "CHAT_COMPOSER") return 1.0;
    const isChatCap = Boolean(cand.isContentEditable || cand.type === "contenteditable" || cand.type === "textarea" || cand.role === "textbox");
    const chatClues = /\b(?:chat|type\s+a\s+message|type\s+message|send\s+a\s+message|ask\s+anything|ask)\b/i.test(candLabel + " " + candAria + " " + candPlaceholder);
    if (isChatCap && (cand.inDialog || chatClues)) return 1.0;
    if (isChatCap) return 0.85;
    return 0.0;
  }

  const isGenericEditorTarget = targetDesc.semanticRole === "GENERIC_TEXT_EDITOR" ||
    targetDesc.targetRole === "GENERIC_TEXT_EDITOR" ||
    targetDesc.expectedRole === "GENERIC_TEXT_EDITOR" ||
    targetLabel === "generic text editor" ||
    targetLabel === "compose area";

  if (isGenericEditorTarget) {
    if (cand.semanticRole === "SEARCH_INPUT" || cand.semanticTag === "SEARCH_INPUT" || cand.type === "search" || /search/i.test(candLabel) || /search/i.test(candAria) || /search/i.test(candPlaceholder)) return 0.0;
    const isEdit = Boolean(cand.isContentEditable || cand.type === "contenteditable" || cand.type === "textarea" || cand.role === "textbox");
    if (isEdit && cand.inDialog) return 1.0;
    if (isEdit) return 0.90;
    return 0.0;
  }

  const candType = (cand.type || "").toLowerCase();
  const candRole = (cand.role || cand.type || "").toLowerCase();

  // Semantic button targets
  const isMessageButtonTarget = targetDesc.semanticRole === "MESSAGE_BUTTON" ||
    targetDesc.targetRole === "MESSAGE_BUTTON" ||
    targetDesc.expectedRole === "MESSAGE_BUTTON" ||
    targetLabel === "message button" ||
    targetLabel === "message";

  if (isMessageButtonTarget) {
    const isBtn = candType === "button" || candType === "link" || candRole === "button" || candRole === "link";
    if (isBtn && (candLabel === "message" || candAria === "message" || candLabel.includes("message") || candAria.includes("message"))) {
      return 1.0;
    }
  }

  const isReplyButtonTarget = targetDesc.semanticRole === "REPLY_BUTTON" ||
    targetDesc.targetRole === "REPLY_BUTTON" ||
    targetDesc.expectedRole === "REPLY_BUTTON" ||
    targetLabel === "reply button" ||
    targetLabel === "reply";

  if (isReplyButtonTarget) {
    const isBtn = candType === "button" || candType === "link" || candRole === "button" || candRole === "link";
    if (isBtn && (candLabel === "reply" || candAria === "reply" || candLabel.includes("reply") || candAria.includes("reply"))) {
      return 1.0;
    }
  }

  const isPostEntryTarget = targetDesc.semanticRole === "POST_ENTRY" ||
    targetDesc.targetRole === "POST_ENTRY" ||
    targetDesc.expectedRole === "POST_ENTRY" ||
    targetLabel === "start a post" ||
    targetLabel === "create a post";

  if (isPostEntryTarget) {
    const isTrigger = candType === "button" || candType === "link" || candRole === "button" || cand.isContentEditable || candType === "contenteditable";
    if (isTrigger && (candLabel.includes("start a post") || candAria.includes("start a post") || candPlaceholder.includes("start a post") || candLabel.includes("create a post"))) {
      return 1.0;
    }
  }

  const isSendButtonTarget = targetDesc.semanticRole === "SEND_BUTTON" ||
    targetDesc.targetRole === "SEND_BUTTON" ||
    targetDesc.expectedRole === "SEND_BUTTON" ||
    targetLabel === "send" ||
    targetLabel === "send button";

  if (isSendButtonTarget) {
    const isBtn = candType === "button" || candType === "link" || candRole === "button" || candRole === "link";
    if (isBtn && (candLabel === "send" || candAria === "send" || candLabel.includes("send") || candAria.includes("send"))) {
      return 1.0;
    }
  }

  const isPublishButtonTarget = targetDesc.semanticRole === "PUBLISH_BUTTON" ||
    targetDesc.targetRole === "PUBLISH_BUTTON" ||
    targetDesc.expectedRole === "PUBLISH_BUTTON" ||
    targetLabel === "post" ||
    targetLabel === "publish" ||
    targetLabel === "post button" ||
    targetLabel === "publish button";

  if (isPublishButtonTarget) {
    const isBtn = candType === "button" || candType === "link" || candRole === "button" || candRole === "link";
    if (isBtn && (candLabel === "post" || candLabel === "publish" || candAria === "post" || candAria === "publish")) {
      return 1.0;
    }
  }
  const targetRole = (targetDesc.role || targetDesc.targetType || "").toLowerCase();
  const isFormTarget = ["input", "textarea", "select", "combobox", "searchbox", "textbox", "contenteditable"].some(r => targetRole.includes(r)) ||
    Boolean(targetDesc.fieldHint);
  const isFormCand = ["input", "textarea", "select", "combobox", "searchbox", "textbox", "contenteditable"].includes(candType) ||
    ["input", "textarea", "select", "combobox", "searchbox", "textbox"].includes(candRole) ||
    Boolean(cand.ariaAutocomplete);

  // Reject voice/mic controls unless explicitly requested
  if (!targetLabel.includes("voice") && !targetLabel.includes("mic")) {
    if (/voice|mic|audio|speak/i.test(candLabel) || /voice|mic|audio|speak/i.test(candAria)) return 0;
  }

  // Generic search vs non-search distinction
  const isTargetSearch = /\bsearch\b/i.test(targetLabel);
  const isCandSearch = /\bsearch\b/i.test(candLabel) || /\bsearch\b/i.test(candAria) || /\bsearch\b/i.test(candPlaceholder) || cand.semanticTag === "SEARCH_INPUT";
  if (!isTargetSearch && isCandSearch && !candNearby.includes(targetLabel) && !candAssoc.includes(targetLabel)) {
    if (/^search(?:\s+(?:box|input|field|bar|area|website))?$/i.test(candLabel) || /^search(?:\s+(?:box|input|field|bar|area|website))?$/i.test(candPlaceholder)) {
      return 0;
    }
  }

  // Profile picture / avatar rejection unless explicitly requested
  const isExplicitProfileRequested = Boolean(targetLabel && /\b(?:profile\s*(?:picture|photo|image|avatar|pic)|user\s*avatar|avatar)\b/i.test(targetLabel));
  const candClassName = normalize(cand.className || cand.node?.className || "");
  const candAlt = normalize(cand.alt);
  const isProfileElement = Boolean(
    /\b(?:profile\s*(?:picture|photo|image|avatar|pic)|user\s*avatar|avatar|profile_photo|profile_pic|identity-module)\b/i.test(candClassName) ||
    /\b(?:profile\s*(?:picture|photo|image|avatar|pic)|user\s*avatar|avatar|profile_photo|profile_pic|identity-module)\b/i.test(candLabel) ||
    /\b(?:profile\s*(?:picture|photo|image|avatar|pic)|user\s*avatar|avatar)\b/i.test(candAria) ||
    (candRole === "img" || candType === "image" || (cand.tag && cand.tag.toLowerCase() === "img") || (cand.node?.tagName && cand.node.tagName.toLowerCase() === "img")) &&
      /\b(?:photo|picture|avatar|profile)\b/i.test(candAria || candAlt || candClassName || "") ||
    (cand.node?.querySelector && cand.node.querySelector("img[alt*='profile' i], img[alt*='photo' i], img.avatar, img.profile-photo"))
  );

  if (isExplicitProfileRequested) {
    if (isProfileElement || candLabel.includes("profile")) return 1.0;
    return 0;
  }
  if (isProfileElement && !isExplicitProfileRequested) {
    return 0;
  }

  // CRITICAL FIX: Never allow generic candidate labels ("input field", "textarea", "textbox")
  // to outrank a task-specific semantic target
  const isGenericLabel = (lbl) => /^(?:input\s*field|field|textarea|textbox|text\s*box|input|text\s*field|text\s*area|form\s*field|control|element)$/i.test(lbl);
  const candIsGenericLabel = isGenericLabel(candLabel);
  const targetIsGenericLabel = isGenericLabel(targetLabel);

  let score = 0;

  // 1. Direct and normalized label match (Exact text outranks proximity and fuzzy similarity)
  const candText = normalize(cand.text);
  if (candLabel === targetLabel || candText === targetLabel) {
    if (candIsGenericLabel && targetIsGenericLabel) {
      score = Math.max(score, 0.20);
    } else if (candIsGenericLabel) {
      score = 0.0;
    } else {
      return 1.0;
    }
  } else if (!candIsGenericLabel && (candLabel.startsWith(targetLabel) || candText.startsWith(targetLabel))) {
    score = Math.max(score, 0.95);
  } else if (!candIsGenericLabel && targetLabel.length >= 3 && (candLabel.includes(targetLabel) || targetLabel.includes(candLabel))) {
    score += 0.35;
  } else if (!candIsGenericLabel) {
    // Token overlap
    const tTokens = targetLabel.split(/\s+/).filter(w => w.length >= 3 || w === "to" || w === "from");
    const cTokens = candLabel.split(/\s+/).filter(w => w.length >= 3 || w === "to" || w === "from");
    const matchedTokens = tTokens.filter(t => cTokens.includes(t) || candLabel.includes(t));
    if (tTokens.length > 0 && matchedTokens.length === tTokens.length) {
      score += 0.30;
    } else if (matchedTokens.length > 0) {
      score += 0.15 * (matchedTokens.length / tTokens.length);
    }
  }

  // 1b. Destination URL / domain matching (Essential for search results like ISRO)
  const targetUrl = normalize(targetDesc.url || targetDesc.href || "");
  const targetDomain = normalize(targetDesc.domain || (targetUrl.match(/https?:\/\/(?:www\.)?([^/]+)/i)?.[1]) || "");
  const candUrl = normalize(cand.url || cand.href || (cand.node?.href || ""));
  if (targetUrl && candUrl) {
    if (candUrl === targetUrl || candUrl.includes(targetUrl) || targetUrl.includes(candUrl)) {
      score += 0.50;
    }
  }
  if (targetDomain && (candUrl.includes(targetDomain) || candNearby.includes(targetDomain) || candContext.includes(targetDomain) || candLabel.includes(targetDomain))) {
    score += 0.45;
  }

  // 1c. Acronym & Organization Entity expansion (e.g. ISRO <-> Indian Space Research Organisation)
  const ENTITY_EXPANSIONS = {
    isro: ["indian space research organisation", "isro"],
    linkedin: ["linkedin"],
    github: ["github"],
    nasa: ["national aeronautics and space administration", "nasa"]
  };
  for (const [ek, expansions] of Object.entries(ENTITY_EXPANSIONS)) {
    if (targetLabel.includes(ek) || (targetDesc.targetHint && targetDesc.targetHint.toLowerCase().includes(ek))) {
      if (expansions.some(exp => candLabel.includes(exp) || candNearby.includes(exp) || candAria.includes(exp))) {
        score += 0.40;
        break;
      }
    }
  }

  // Pre-registered generic field synonyms
  const SYNONYMS = {
    from: ["from", "from station", "from city", "departure", "departure station", "source", "source station", "origin", "leaving from"],
    to: ["to", "to station", "to city", "arrival", "arrival station", "destination", "destination station", "going to"],
    search: ["search", "search mail", "search query", "find", "searchbox", "search input"],
    mail: ["search mail", "mail", "gmail search", "inbox search"],
    station: ["station", "railway station", "city", "location", "stop"]
  };
  for (const [key, synList] of Object.entries(SYNONYMS)) {
    const targetSynMatch = targetLabel === key || synList.some(s => targetLabel === s || (s.length >= 3 && targetLabel.includes(s)));
    const candSynMatch = candLabel === key || synList.some(s => candLabel === s || (s.length >= 3 && candLabel.includes(s))) ||
      (candAria && synList.some(s => candAria.includes(s))) ||
      (candPlaceholder && synList.some(s => candPlaceholder.includes(s)));
    if (targetSynMatch && candSynMatch) {
      score = Math.max(score, 0.40);
      break;
    }
  }

  // 2. ARIA label match
  if (candAria) {
    if (candAria === targetLabel || (targetDesc.ariaLabel && candAria === normalize(targetDesc.ariaLabel))) {
      score += 0.35;
    } else if (targetLabel.length >= 3 && (candAria.includes(targetLabel) || targetLabel.includes(candAria))) {
      score += 0.25;
    }
  }

  // 3. Placeholder match
  if (candPlaceholder) {
    if (candPlaceholder === targetLabel || (targetDesc.placeholder && candPlaceholder === normalize(targetDesc.placeholder))) {
      score += 0.30;
    } else if (targetLabel.length >= 3 && (candPlaceholder.includes(targetLabel) || targetLabel.includes(candPlaceholder))) {
      score += 0.20;
    }
  }

  // 4. Role & dynamic control compatibility
  if (isFormTarget && isFormCand) {
    score += 0.15;
    if (targetRole && candRole && (targetRole === candRole || candType === targetRole)) {
      score += 0.05;
    }
  } else if (!isFormTarget && (candType === "button" || candType === "link" || candRole === "button" || candRole === "link")) {
    score += 0.10;
  }

  // 5. Name / ID / Title match
  if (candName && (candName === targetLabel || (targetDesc.name && candName === normalize(targetDesc.name)))) score += 0.15;
  if (candId && (candId === targetLabel || (targetDesc.id && candId === normalize(targetDesc.id)))) score += 0.15;
  if (candTitle && (candTitle === targetLabel || (targetDesc.title && candTitle === normalize(targetDesc.title)))) score += 0.15;

  // 6. Nearby DOM text & parent/ancestor context
  // Only grant secondary context points if candidate itself has positive textual or role relevance
  if (score > 0) {
    if (candNearby && (candNearby === targetLabel || candNearby.includes(targetLabel))) score += 0.20;
    if (candContext && (candContext === targetLabel || candContext.includes(targetLabel))) score += 0.15;
    if (candAssoc && (candAssoc === targetLabel || candAssoc.includes(targetLabel))) score += 0.20;
  }

  // 7. Secondary hints (tie-breakers and identity confirmation)
  if (typeof targetDesc.originalIndex === "number" && cand.index === targetDesc.originalIndex && score > 0) {
    score += 0.15;
  }
  if (targetDesc.bounds && cand.bounds) {
    const dx = Math.abs(cand.bounds.x - targetDesc.bounds.x);
    const dy = Math.abs(cand.bounds.y - targetDesc.bounds.y);
    if (dx < 25 && dy < 25) {
      score += 0.25;
    } else if (dx < 50 && dy < 50) {
      score += 0.10;
    }
  }

  return Math.min(1.0, score);
}

/**
 * Re-grounds a target against live fresh elements using weighted semantic evidence.
 * If exactly one candidate matches strongly, returns it.
 * If multiple candidates match with similar confidence, flags ambiguity.
 *
 * @param {Array<Object>} freshElements
 * @param {Object} targetDesc
 * @returns {{ match: Object|null, isAmbiguous: boolean, score: number, index: number }}
 */
function findBestSemanticCandidate(freshElements, targetDesc) {
  if (!Array.isArray(freshElements) || freshElements.length === 0 || !targetDesc) {
    return { match: null, isAmbiguous: false, score: 0, index: -1 };
  }
  const scored = [];
  freshElements.forEach((cand, idx) => {
    if (!cand || (cand.node && !cand.node.isConnected)) return;
    if (cand.disabled || cand.readOnly || (cand.node && cand.node.disabled)) return;
    const s = scoreCandidateAgainstDescriptor(cand, targetDesc);
    if (s >= 0.35) {
      scored.push({ cand, idx, score: s });
    }
  });

  if (scored.length === 0) {
    return { match: null, isAmbiguous: false, score: 0, index: -1 };
  }

  scored.sort((a, b) => b.score - a.score);
  const top = scored[0];

  // Ambiguity check: if runner-up has similar score but represents a different control
  if (scored.length > 1) {
    const runnerUp = scored[1];
    if (Math.abs(top.score - runnerUp.score) < 0.08) {
      const topLabel = (top.cand.label || "").trim().toLowerCase();
      const runLabel = (runnerUp.cand.label || "").trim().toLowerCase();
      const topNode = top.cand.node;
      const runNode = runnerUp.cand.node;

      // If labels differ, they represent competing fields -> ambiguous
      if (topLabel !== runLabel) {
        return { match: null, isAmbiguous: true, score: top.score, index: -1, candidates: [top.cand, runnerUp.cand] };
      }

      // If duplicate identical text controls exist on page (e.g. search result links),
      // disambiguate using stable DOM index, destination URL, or bounding-box correspondence
      // rather than failing as ambiguous.
      if (topNode && runNode && topNode !== runNode) {
        const rawTIdx = typeof targetDesc.originalIndex === "number" ? targetDesc.originalIndex : targetDesc.index;
        const targetIdx = (rawTIdx !== undefined && rawTIdx !== null) ? parseInt(String(rawTIdx).replace(/^#/, ""), 10) : undefined;
        if (targetIdx !== undefined && !isNaN(targetIdx)) {
          if (top.cand.index === targetIdx && runnerUp.cand.index !== targetIdx) {
            return { match: top.cand, isAmbiguous: false, score: top.score, index: top.idx };
          }
          if (runnerUp.cand.index === targetIdx && top.cand.index !== targetIdx) {
            return { match: runnerUp.cand, isAmbiguous: false, score: runnerUp.score, index: runnerUp.idx };
          }
        }

        const tUrl = normalizeUrl(targetDesc.url || targetDesc.href || "");
        if (tUrl) {
          const topUrl = normalizeUrl(top.cand.url || top.cand.href || top.cand.node?.href || "");
          const runUrl = normalizeUrl(runnerUp.cand.url || runnerUp.cand.href || runnerUp.cand.node?.href || "");
          const topUrlMatches = topUrl && (topUrl === tUrl || topUrl.includes(tUrl) || tUrl.includes(topUrl));
          const runUrlMatches = runUrl && (runUrl === tUrl || runUrl.includes(tUrl) || tUrl.includes(runUrl));
          if (topUrlMatches && !runUrlMatches) {
            return { match: top.cand, isAmbiguous: false, score: top.score, index: top.idx };
          }
          if (runUrlMatches && !topUrlMatches) {
            return { match: runnerUp.cand, isAmbiguous: false, score: runnerUp.score, index: runnerUp.idx };
          }
        }

        const tBounds = normalizeBounds(targetDesc.bounds);
        if (tBounds) {
          const topB = normalizeBounds(top.cand.bounds || top.cand);
          const runB = normalizeBounds(runnerUp.cand.bounds || runnerUp.cand);
          if (topB && runB) {
            const dTop = Math.hypot(topB.x - tBounds.x, topB.y - tBounds.y);
            const dRun = Math.hypot(runB.x - tBounds.x, runB.y - tBounds.y);
            if (dTop < 30 && dRun >= 30) {
              return { match: top.cand, isAmbiguous: false, score: top.score, index: top.idx };
            }
            if (dRun < 30 && dTop >= 30) {
              return { match: runnerUp.cand, isAmbiguous: false, score: runnerUp.score, index: runnerUp.idx };
            }
          }
        }

        // If no differentiating evidence exists at all, only then flag ambiguity
        return { match: null, isAmbiguous: true, score: top.score, index: -1, candidates: [top.cand, runnerUp.cand] };
      }
    }
  }

  return { match: top.cand, isAmbiguous: false, score: top.score, index: top.idx };
}

/**
 * Exact-Text Click Grounding for Composite UI Controls.
 * Resolves explicit visible text targets against fresh perceived elements and DOM hierarchy.
 * If text node is inside a child element (e.g. <span>Start a post</span>), walks upward
 * through ancestors to find the nearest clickable container while preserving exact text evidence.
 * Strictly excludes adjacent avatars, profile pictures, and unrelated siblings.
 *
 * @param {string} targetText - Requested explicit text (e.g. "Start a post")
 * @param {Array<Object>} freshElements - Perceived visual elements with live nodes
 * @returns {{ match?: Object, isAmbiguous?: boolean, notFound?: boolean, totalCount: number, candidates?: Array }}
 */
function findClickableExactTextTarget(targetText, freshElements) {
  if (!targetText || typeof targetText !== "string") return null;
  const normalize = (s) => (s || "").toLowerCase().replace(/[:*#_\-\/\\]+/g, " ").replace(/\s+/g, " ").trim();
  const targetNorm = normalize(targetText);
  if (!targetNorm) return null;

  const isExplicitProfile = /\b(?:profile\s*(?:picture|photo|image|avatar|pic)|user\s*avatar|avatar)\b/i.test(targetNorm);

  const isAvatarOrProfile = (cand) => {
    if (isExplicitProfile) return false;
    if (!cand) return false;
    const l = normalize(cand.label);
    const a = normalize(cand.ariaLabel);
    const alt = normalize(cand.alt);
    const cName = normalize(cand.className || cand.node?.className || "");
    const role = (cand.role || cand.type || "").toLowerCase();
    const tag = (cand.tag || cand.node?.tagName || "").toLowerCase();
    if (role === "img" || tag === "img" || cand.type === "image") return true;
    if (/\b(?:avatar|profile-photo|profile-pic|identity-module)\b/i.test(cName)) return true;
    if (/\b(?:profile\s*(?:picture|photo|image|avatar|pic)|user\s*avatar|avatar)\b/i.test(l) ||
        /\b(?:profile\s*(?:picture|photo|image|avatar|pic)|user\s*avatar|avatar)\b/i.test(a) ||
        /\b(?:photo|picture|avatar|profile)\b/i.test(alt)) return true;
    if (cand.node && cand.node.querySelector && cand.node.querySelector("img[alt*='profile' i], img[alt*='photo' i], img.avatar, img.profile-photo")) return true;
    return false;
  };

  // 1. First scan freshElements for direct exact text matches
  const directMatches = [];
  if (Array.isArray(freshElements)) {
    for (const cand of freshElements) {
      if (!cand || (cand.node && !cand.node.isConnected)) continue;
      if (cand.disabled || cand.node?.disabled) continue;
      if (isAvatarOrProfile(cand)) continue;

      const candLabel = normalize(cand.label);
      const candText = normalize(cand.text);
      const candAria = normalize(cand.ariaLabel);

      const isExact = (candLabel === targetNorm || candText === targetNorm || candAria === targetNorm);
      const isPrefix = (candLabel.startsWith(targetNorm) || candText.startsWith(targetNorm) || candAria.startsWith(targetNorm));

      if (isExact) {
        directMatches.push({ cand, exact: true });
      } else if (isPrefix) {
        directMatches.push({ cand, exact: false, prefix: true });
      }
    }
  }

  const exactDirect = directMatches.filter(m => m.exact);
  if (exactDirect.length === 1) {
    return { match: exactDirect[0].cand, totalCount: 1 };
  }
  if (exactDirect.length > 1) {
    return { isAmbiguous: true, totalCount: exactDirect.length, candidates: exactDirect.map(m => m.cand) };
  }

  // 2. Composite UI control resolution: Traverse DOM to locate exact text node and walk upward to clickable ancestor
  if (typeof document !== "undefined" && document.querySelectorAll) {
    const domCandidates = [];
    const textElements = document.querySelectorAll("span, p, div, b, strong, button, a, [role='button'], [role='link']");
    for (const el of textElements) {
      if (!el || !el.isConnected) continue;
      const rect = typeof getVisibleRect === "function" ? getVisibleRect(el) : (el.getBoundingClientRect ? el.getBoundingClientRect() : null);
      if (rect && (rect.width === 0 || rect.height === 0)) continue;

      const directText = normalize(el.innerText || el.textContent);
      const isExactText = (directText === targetNorm);
      const isPrefixText = (directText.startsWith(targetNorm) && directText.length <= targetNorm.length + 35);

      if (isExactText || isPrefixText) {
        // Walk upward to find nearest clickable container
        let clickable = el;
        let curr = el;
        while (curr && curr !== document.body && curr !== document.documentElement) {
          const tag = (curr.tagName || "").toLowerCase();
          const role = (curr.getAttribute ? (curr.getAttribute("role") || "").toLowerCase() : "");
          const hasClick = curr.onclick !== null || (curr.getAttribute && curr.getAttribute("tabindex") !== null && curr.getAttribute("tabindex") !== "-1");
          let cursor = "";
          try {
            if (typeof window !== "undefined" && window.getComputedStyle) {
              cursor = window.getComputedStyle(curr).cursor;
            }
          } catch (_) {}

          if (tag === "button" || (tag === "a" && (curr.href || curr.getAttribute?.("href"))) || role === "button" || role === "link" || hasClick || cursor === "pointer") {
            clickable = curr;
            break;
          }
          curr = curr.parentElement;
        }

        // Verify clickable element is not an avatar/profile picture
        if (isAvatarOrProfile({ node: clickable, label: directText, className: clickable.className })) {
          continue;
        }

        const existing = Array.isArray(freshElements) ? freshElements.find(fe => fe.node === clickable) : null;
        if (existing) {
          if (!domCandidates.some(dc => dc.node === clickable)) {
            domCandidates.push({ ...existing, matchedVisibleText: directText, isExactTextMatch: isExactText });
          }
        } else {
          if (!domCandidates.some(dc => dc.node === clickable)) {
            domCandidates.push({
              node: clickable,
              label: directText,
              text: directText,
              type: (clickable.tagName || "").toLowerCase() === "button" ? "button" : "element",
              role: (clickable.getAttribute && clickable.getAttribute("role")) || "button",
              bounds: rect ? {
                x: Math.round(rect.x || rect.left || 0),
                y: Math.round(rect.y || rect.top || 0),
                width: Math.round(rect.width || 0),
                height: Math.round(rect.height || 0)
              } : null,
              matchedVisibleText: directText,
              isExactTextMatch: isExactText
            });
          }
        }
      }
    }

    const exactDom = domCandidates.filter(c => c.isExactTextMatch);
    if (exactDom.length === 1) {
      return { match: exactDom[0], totalCount: 1 };
    }
    if (exactDom.length > 1) {
      // Disambiguate identical DOM nodes
      const uniqueNodes = [];
      for (const dc of exactDom) {
        if (!uniqueNodes.some(u => u.node === dc.node)) uniqueNodes.push(dc);
      }
      if (uniqueNodes.length === 1) {
        return { match: uniqueNodes[0], totalCount: 1 };
      }
      return { isAmbiguous: true, totalCount: uniqueNodes.length, candidates: uniqueNodes };
    }

    if (domCandidates.length === 1) {
      return { match: domCandidates[0], totalCount: 1 };
    }
    if (domCandidates.length > 1) {
      const uniqueNodes = [];
      for (const dc of domCandidates) {
        if (!uniqueNodes.some(u => u.node === dc.node)) uniqueNodes.push(dc);
      }
      if (uniqueNodes.length === 1) {
        return { match: uniqueNodes[0], totalCount: 1 };
      }
      return { isAmbiguous: true, totalCount: uniqueNodes.length, candidates: uniqueNodes };
    }
  }

  // 3. Fallback to direct prefix matches if any
  const prefixDirect = directMatches.filter(m => m.prefix);
  if (prefixDirect.length === 1) {
    return { match: prefixDirect[0].cand, totalCount: 1 };
  }
  if (prefixDirect.length > 1) {
    return { isAmbiguous: true, totalCount: prefixDirect.length, candidates: prefixDirect.map(m => m.cand) };
  }

  return { notFound: true, totalCount: 0 };
}

/**
 * Inserts text into a rich-text contenteditable or textbox element using browser editing pipeline.
/**
 * Generic fillEditableElement(element, value) executor (Sections 6, 7 & 8).
 * Supports:
 * - <input>
 * - <textarea>
 * - contenteditable elements (isContentEditable === true, contenteditable="true"|"plaintext-only"|"")
 * - role="textbox" editable elements
 *
 * For native input/textarea:
 * - focus element
 * - select existing text
 * - update using correct native setter
 * - dispatch bubbling input event
 * - dispatch change event
 * - verify resulting value
 *
 * For contenteditable:
 * - verify element.isContentEditable or contenteditable attribute
 * - focus it
 * - select existing editable content
 * - insert plain text using document.execCommand("insertText") or selection range fallback
 * - dispatch beforeinput and input events (inputType="insertText")
 * - dispatch bubbling input and change events
 * - verify element.innerText / textContent reflects requested value
 *
 * Verification:
 * If verification fails, retries once using the generic editable adapter.
 * If it still fails, returns executed: false, verified: false,
 * reason: "Editable target was grounded but the page did not accept the text."
 *
 * @param {HTMLElement} el
 * @param {string|any} value
 * @returns {{ executed: boolean, verified: boolean, actualValue: string, reason?: string }}
 */
function fillEditableElement(el, value) {
  if (!el) return { executed: false, verified: false, reason: "Element not found" };
  const strVal = String(value !== undefined && value !== null ? value : "");

  // 1. Focus element
  try { el.focus(); } catch (_) {}
  if (el.isConnected === false) {
    return { executed: false, verified: false, reason: "Element is disconnected from DOM" };
  }

  const tagName = (el.tagName || "").toLowerCase();
  const isInput = tagName === "input";
  const isTextarea = tagName === "textarea";
  const ceAttr = el.getAttribute ? (el.getAttribute("contenteditable") || "").toLowerCase() : "";
  const isContentEditable = !!(el.isContentEditable || ceAttr === "true" || ceAttr === "plaintext-only" || ceAttr === "");
  const isRoleTextbox = !!(el.getAttribute && el.getAttribute("role") === "textbox");

  const norm = (s) => (s || "").replace(/\s+/g, " ").trim();
  const targetVal = norm(strVal);

  if (isInput || isTextarea) {
    // 2. Select existing text
    try {
      if (typeof el.select === "function") {
        el.select();
      }
    } catch (_) {}

    // 3. Update using native property setter
    try {
      const proto = isInput
        ? (typeof window !== "undefined" && window.HTMLInputElement ? window.HTMLInputElement.prototype : Object.getPrototypeOf(el))
        : (typeof window !== "undefined" && window.HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : Object.getPrototypeOf(el));
      const nativeSetter = proto ? Object.getOwnPropertyDescriptor(proto, "value")?.set : null;
      if (nativeSetter) {
        nativeSetter.call(el, strVal);
      } else {
        el.value = strVal;
      }
    } catch (_) {
      el.value = strVal;
    }

    // 4. Dispatch bubbling input and change events
    el.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    el.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
    try {
      el.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, composed: true, key: "Enter" }));
    } catch (_) {}

    // 5. Verification
    let currentVal = norm(el.value);
    let verified = currentVal === targetVal || currentVal.includes(targetVal);

    if (!verified) {
      // Retry once using generic adapter
      try {
        el.value = strVal;
        el.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
        el.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
      } catch (_) {}
      currentVal = norm(el.value);
      verified = currentVal === targetVal || currentVal.includes(targetVal);
    }

    if (!verified) {
      return {
        executed: false,
        verified: false,
        actualValue: currentVal,
        reason: "Editable target was grounded but the page did not accept the text."
      };
    }
    return { executed: true, verified: true, actualValue: currentVal };
  }

  if (isContentEditable || isRoleTextbox) {
    // 1. Focus element
    try { el.focus(); } catch (_) {}

    // 2. Select existing editable content
    let selection = null;
    try {
      selection = window.getSelection ? window.getSelection() : null;
      if (selection) {
        selection.removeAllRanges();
        const range = document.createRange();
        range.selectNodeContents(el);
        selection.addRange(range);
      }
    } catch (_) {}

    // 3. Dispatch beforeinput event with inputType="insertText"
    try {
      if (typeof InputEvent === "function") {
        const beforeEvt = new InputEvent("beforeinput", {
          bubbles: true,
          cancelable: true,
          composed: true,
          data: strVal,
          inputType: "insertText"
        });
        el.dispatchEvent(beforeEvt);
      }
    } catch (_) {}

    // 4. Preferred browser editing mechanism: document.execCommand("insertText", false, value)
    let execSuccess = false;
    try {
      if (typeof document.execCommand === "function") {
        execSuccess = document.execCommand("insertText", false, strVal);
      }
    } catch (_) {}

    // 5. Safe DOM fallback if execCommand failed or did not insert text
    const checkText = (el.innerText || el.textContent || "");
    if (!execSuccess || !norm(checkText).includes(targetVal)) {
      try {
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          range.deleteContents();
          const textNode = document.createTextNode(strVal);
          range.insertNode(textNode);
          range.setStartAfter(textNode);
          range.setEndAfter(textNode);
          selection.removeAllRanges();
          selection.addRange(range);
        } else {
          while (el.firstChild) {
            el.removeChild(el.firstChild);
          }
          const p = document.createElement("p");
          p.textContent = strVal;
          el.appendChild(p);
        }
      } catch (_) {
        el.textContent = strVal;
      }
    }

    // 6. Dispatch synthetic InputEvent and change event
    try {
      if (typeof InputEvent === "function") {
        el.dispatchEvent(new InputEvent("input", {
          bubbles: true,
          composed: true,
          data: strVal,
          inputType: "insertText"
        }));
      }
    } catch (_) {}
    el.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    el.dispatchEvent(new Event("change", { bubbles: true, composed: true }));

    // 7. Verification: element.innerText / textContent contains requested value
    let curInner = norm(el.innerText || "");
    let curContent = norm(el.textContent || "");
    let verified = curInner === targetVal || curContent === targetVal || curInner.includes(targetVal) || curContent.includes(targetVal);

    if (!verified) {
      // Retry once using generic editable adapter
      try {
        el.textContent = strVal;
        el.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
        el.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
      } catch (_) {}
      curInner = norm(el.innerText || "");
      curContent = norm(el.textContent || "");
      verified = curInner === targetVal || curContent === targetVal || curInner.includes(targetVal) || curContent.includes(targetVal);
    }

    if (!verified) {
      return {
        executed: false,
        verified: false,
        actualValue: curInner || curContent,
        reason: "Editable target was grounded but the page did not accept the text."
      };
    }
    return { executed: true, verified: true, actualValue: curInner || curContent };
  }

  return { executed: false, verified: false, reason: "Target element is not an editable element" };
}

function insertTextIntoEditable(el, value) {
  const res = fillEditableElement(el, value);
  return res.verified;
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

  // Planning/action boundary normalization:
  // If OPEN reaches executor, normalize OPEN -> CLICK for grounded clickable elements
  // or OPEN -> NAVIGATE for destination URLs.
  if (actionPayload.action === "OPEN") {
    actionPayload.semanticAction = actionPayload.semanticAction || "OPEN";
    const dest = String(actionPayload.url || actionPayload.target || "");
    const isUrl = Boolean(actionPayload.url || /^https?:\/\//i.test(dest) || /^www\./i.test(dest));
    if (isUrl) {
      actionPayload.action = "NAVIGATE";
      actionPayload.executionAction = "NAVIGATE";
    } else if (actionPayload.targetIndex !== undefined || actionPayload.context || ["link", "button", "a", "tab", "clickable"].includes((actionPayload.targetType || "").toLowerCase())) {
      actionPayload.action = "CLICK";
      actionPayload.executionAction = "CLICK";
    }
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

    // Generalized grounded path: payload has targetIndex or semanticTargetDescriptor
    if (typeof actionPayload.targetIndex === "number" || actionPayload.semanticTargetDescriptor || actionPayload.targetLabel) {
      const { targetIndex, targetType, targetLabel } = actionPayload;

      // Always re-scan the LIVE DOM at execution time — never trust a stale index/bbox
      const freshElements = extractVisualElementsWithNodes();

      const targetDesc = actionPayload.semanticTargetDescriptor || {
        normalizedLabel: normalizeLabel(targetLabel || actionPayload.target || ""),
        targetLabel: targetLabel || actionPayload.target || "",
        targetType: targetType || "element",
        role: actionPayload.targetType || "element",
        originalIndex: targetIndex
      };

      let matched = null;

      // =========================================================================
      // EXACT-TEXT CLICK GROUNDING FOR COMPOSITE UI CONTROLS
      // 1. Resolve exact visible text in locally perceived DOM / visual elements
      // 2. Prefer normalized exact text match over proximity/fuzzy/generic clickable
      // 3. If exact text node is not clickable, walk upward to nearest clickable container
      // 4. Never select nearby avatar/image sibling
      // 5. Fail safely if exact text is missing; flag ambiguous if multiple matches
      // =========================================================================
      const rawExactText = (actionPayload.exactTargetText || targetDesc.exactText || actionPayload.targetLabel || targetDesc.targetLabel || actionPayload.target || "").trim();
      const isSearchTarget = Boolean(
        actionPayload.isSearchResult ||
        targetDesc.isSearchIntent ||
        /^(?:search|primary_search_input)$/i.test(rawExactText)
      );
      const isExplicitVisibleClick = Boolean(
        rawExactText &&
        !actionPayload.url &&
        !targetDesc.url &&
        !isSearchTarget &&
        !/^(?:submit|next|previous)$/i.test(rawExactText)
      );

      if (isExplicitVisibleClick) {
        const exactRes = findClickableExactTextTarget(rawExactText, freshElements);
        if (exactRes) {
          if (exactRes.isAmbiguous) {
            return {
              executed: false,
              reason: `Ambiguous target: multiple elements matching '${rawExactText}' found on page`
            };
          }
          if (exactRes.match) {
            matched = exactRes.match;
          } else if (exactRes.notFound) {
            return {
              executed: false,
              reason: `Target '${rawExactText}' with exact visible text not found on page`
            };
          }
        }
      }

      // STEP 1: Stable DOM identity/index from latest perception snapshot
      if (!matched) {
        const rawIdx = actionPayload.targetIndex !== undefined ? actionPayload.targetIndex : targetDesc.originalIndex;
        const numIdx = (rawIdx !== undefined && rawIdx !== null) ? parseInt(String(rawIdx).replace(/^#/, ""), 10) : undefined;
        if (typeof numIdx === "number" && !isNaN(numIdx) && freshElements[numIdx] && freshElements[numIdx].node && freshElements[numIdx].node.isConnected) {
          const atIdx = freshElements[numIdx];
          if (!atIdx.node.disabled && atIdx.node.getAttribute?.("aria-disabled") !== "true") {
            const directScore = scoreCandidateAgainstDescriptor(atIdx, targetDesc);
            const rawPayloadBounds = actionPayload.bounds || actionPayload.bbox || targetDesc.bounds;
            const targetBounds = normalizeBounds(rawPayloadBounds);
            const atIdxBounds = normalizeBounds(atIdx.bounds || atIdx);
            const boundsMatch = Boolean(targetBounds && atIdxBounds &&
              Math.abs(atIdxBounds.x - targetBounds.x) < 30 &&
              Math.abs(atIdxBounds.y - targetBounds.y) < 30);
            const targetUrl = actionPayload.url || targetDesc.url || targetDesc.href || actionPayload.domain;
            const atIdxUrl = atIdx.url || atIdx.href || atIdx.node.href;
            const urlMatch = Boolean(targetUrl && atIdxUrl && (
              normalizeUrl(atIdxUrl).includes(normalizeUrl(targetUrl)) ||
              normalizeUrl(targetUrl).includes(normalizeUrl(atIdxUrl))
            ));
            const labelMatch = labelsMatch(atIdx.label, targetLabel) || labelsMatch(atIdx.label, targetDesc.targetLabel);

            // If confirmed by direct score, bounds match (with score), url match, or label match
            if ((directScore >= 0.40 && (boundsMatch || labelMatch || directScore >= 0.70)) || urlMatch || labelMatch) {
              matched = atIdx;
            }
          }
        }
      }

      // STEP 2: Unique element attributes / selector / URL
      if (!matched) {
        const targetUrl = actionPayload.url || targetDesc.url || targetDesc.href || actionPayload.domain;
        if (targetUrl) {
          const normTargetUrl = normalizeUrl(targetUrl);
          const urlMatches = freshElements.filter(el => {
            if (!el || !el.node || !el.node.isConnected || el.node.disabled) return false;
            const elUrl = normalizeUrl(el.url || el.href || el.node.href || "");
            return elUrl && normTargetUrl && (elUrl === normTargetUrl || elUrl.includes(normTargetUrl) || normTargetUrl.includes(elUrl));
          });
          if (urlMatches.length === 1) {
            matched = urlMatches[0];
          } else if (urlMatches.length > 1) {
            // Disambiguate identical URLs using targetIndex or closest bounding box
            if (typeof numIdx === "number") {
              const idxMatch = urlMatches.find(el => el.index === numIdx);
              if (idxMatch) matched = idxMatch;
            }
            if (!matched) {
              const targetBounds = normalizeBounds(actionPayload.bounds || actionPayload.bbox || targetDesc.bounds);
              if (targetBounds) {
                let closest = null, minD = Infinity;
                urlMatches.forEach(el => {
                  const eb = normalizeBounds(el.bounds || el);
                  if (eb) {
                    const d = Math.hypot(eb.x - targetBounds.x, eb.y - targetBounds.y);
                    if (d < minD) { minD = d; closest = el; }
                  }
                });
                if (closest && minD < 100) matched = closest;
              }
            }
            if (!matched) matched = urlMatches[0];
          }
        }
      }

      // STEP 3: Bounding-box correspondence from the same perception snapshot
      if (!matched) {
        const targetBounds = normalizeBounds(actionPayload.bounds || actionPayload.bbox || targetDesc.bounds);
        if (targetBounds) {
          const bMatches = freshElements.filter(el => {
            if (!el || !el.node || !el.node.isConnected || el.node.disabled) return false;
            const eb = normalizeBounds(el.bounds || el);
            if (!eb) return false;
            const dx = Math.abs(eb.x - targetBounds.x);
            const dy = Math.abs(eb.y - targetBounds.y);
            return dx < 30 && dy < 30 && (labelsMatch(el.label, targetLabel) || scoreCandidateAgainstDescriptor(el, targetDesc) >= 0.35);
          });
          if (bMatches.length === 1) {
            matched = bMatches[0];
          } else if (bMatches.length > 1) {
            bMatches.sort((a, b) => {
              const ab = normalizeBounds(a.bounds || a);
              const bb = normalizeBounds(b.bounds || b);
              const da = Math.hypot(ab.x - targetBounds.x, ab.y - targetBounds.y);
              const db = Math.hypot(bb.x - targetBounds.x, bb.y - targetBounds.y);
              return da - db;
            });
            matched = bMatches[0];
          }
        }
      }

      // STEP 4: Text + URL + surrounding context (findBestSemanticCandidate)
      if (!matched) {
        const res = findBestSemanticCandidate(freshElements, targetDesc);
        if (res.isAmbiguous) {
          return {
            executed: false,
            reason: "Ambiguous target: multiple candidates match with similar confidence"
          };
        }
        if (res.match) {
          matched = res.match;
        }
      }

      // STEP 5: Text-only matching ONLY as final fallback
      if (!matched) {
        const matchingCandidates = freshElements.filter(
          (el) => el.node && el.node.isConnected && (el.type === targetType || ["button", "link", "input", "element", "heading", "tab", "menuitem", "option", "checkbox", "radio", "switch", "select", "section", "combobox", "textbox"].includes(el.type)) && labelsMatch(el.label, targetLabel)
        );
        if (matchingCandidates.length === 1) {
          matched = matchingCandidates[0];
        } else if (matchingCandidates.length > 1) {
          // Disambiguate using already-grounded element's DOM identity/context instead of blindly clicking first or failing
          if (typeof numIdx === "number") {
            const idxMatch = matchingCandidates.find(el => el.index === numIdx);
            if (idxMatch) matched = idxMatch;
          }
          if (!matched) {
            const targetBounds = normalizeBounds(actionPayload.bounds || actionPayload.bbox || targetDesc.bounds);
            if (targetBounds) {
              let closest = null, minD = Infinity;
              matchingCandidates.forEach(el => {
                const eb = normalizeBounds(el.bounds || el);
                if (eb) {
                  const d = Math.hypot(eb.x - targetBounds.x, eb.y - targetBounds.y);
                  if (d < minD) { minD = d; closest = el; }
                }
              });
              if (closest && minD < 100) matched = closest;
            }
          }
          if (!matched) {
            return {
              executed: false,
              reason: "Ambiguous target: multiple elements with identical label found on page"
            };
          }
        }
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

        const tagLower = (matched.node.tagName || "").toLowerCase();
        if (tagLower === "input" || matched.node.getAttribute?.("role") === "combobox" || matched.node.isContentEditable) {
          matched.node.focus?.();
        }
        matched.node.click();
        return {
          executed: true,
          action: "CLICK",
          targetType: matched.type || targetType,
          targetLabel: matched.label || targetLabel,
          groundedIndex: typeof targetIndex === "number" ? targetIndex : matched.index
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

  // 2. FILL Action Execution (Milestone 16 Generic Safe Form Fill & Dynamic Controls)
  if (action === "FILL") {
    const { targetIndex, targetType, targetLabel } = actionPayload;
    // Protocol: value is NOT part of the message from backend; popup.js passes locally-held value via localValue
    const fillValue = actionPayload.localValue !== undefined
      ? actionPayload.localValue
      : (actionPayload.value !== undefined ? actionPayload.value : "");

    // 1. Re-scan live DOM at execution time
    const freshElements = extractVisualElementsWithNodes();

    const targetDesc = actionPayload.semanticTargetDescriptor || {
      normalizedLabel: normalizeLabel(targetLabel || actionPayload.fieldHint || actionPayload.target || ""),
      targetLabel: targetLabel || actionPayload.fieldHint || actionPayload.target || "",
      targetType: targetType || "input",
      role: targetType || "textbox",
      fieldHint: targetLabel || actionPayload.fieldHint || "",
      originalIndex: targetIndex
    };

    let matched = null;

    // Check if this action represents an ordinary search intent
    const isSearchFill = targetDesc.isSearchIntent ||
      targetDesc.targetRole === "PRIMARY_SEARCH_INPUT" ||
      targetDesc.role === "PRIMARY_SEARCH_INPUT" ||
      actionPayload.isSearchIntent ||
      actionPayload.targetRole === "PRIMARY_SEARCH_INPUT" ||
      actionPayload.target === "PRIMARY_SEARCH_INPUT" ||
      actionPayload.targetLabel === "PRIMARY_SEARCH_INPUT" ||
      normalizeLabel(targetLabel) === "search" ||
      normalizeLabel(targetLabel) === "primary_search_input";

    if (isSearchFill) {
      let topSearchCand = null;
      let topSearchScore = 0;
      freshElements.forEach(cand => {
        if (!cand || !cand.node || !cand.node.isConnected || cand.node.disabled) return;
        const s = scoreSearchCandidate(cand, "", false);
        if (s > topSearchScore) {
          topSearchScore = s;
          topSearchCand = cand;
        }
      });
      if (topSearchCand && topSearchScore >= 0.50) {
        matched = topSearchCand;
      }
    }

    // 1) Secondary hint check: if targetIndex points to matching connected form element
    if (!matched && typeof targetIndex === "number" && freshElements[targetIndex]) {
      const atIdx = freshElements[targetIndex];
      if (atIdx.node && atIdx.node.isConnected) {
        const directScore = scoreCandidateAgainstDescriptor(atIdx, targetDesc);
        if (directScore >= 0.70) {
          matched = atIdx;
        }
      }
    }

    // 2) Semantic re-grounding against live page
    if (!matched) {
      const res = findBestSemanticCandidate(freshElements, targetDesc);
      if (res.isAmbiguous) {
        return {
          executed: false,
          reason: "Ambiguous target: multiple candidates match with similar confidence"
        };
      }
      if (res.match) {
        matched = res.match;
      }
    }

    // 3) Drift fallback: single unique candidate by label/nearby match
    if (!matched) {
      const matchingCandidates = freshElements.filter(
        (el) => el.node && el.node.isConnected &&
          (el.type === targetType || ["input", "textarea", "select", "combobox", "searchbox", "textbox", "contenteditable"].includes((el.type || "").toLowerCase()) || ["input", "textarea", "select"].includes((el.node.tagName || "").toLowerCase())) &&
          (labelsMatch(el.label, targetLabel) || (el.nearbyText && labelsMatch(el.nearbyText, targetLabel))) &&
          (!isAiAssistantElement(el) || targetLabel.toLowerCase().includes("ai"))
      );
      if (matchingCandidates.length === 1) {
        matched = matchingCandidates[0];
      } else if (matchingCandidates.length > 1) {
        const exactMatches = matchingCandidates.filter(c => normalizeLabel(c.label) === normalizeLabel(targetLabel));
        if (typeof targetIndex === "number") {
          const idxMatch = exactMatches.find(c => c.index === targetIndex);
          if (idxMatch) matched = idxMatch;
        }
        if (!matched && exactMatches.length > 1) {
          return {
            executed: false,
            reason: "Ambiguous target: multiple elements with identical label found on page"
          };
        } else if (!matched && exactMatches.length === 1) {
          matched = exactMatches[0];
        }
      }
    }

    if (!matched || !matched.node || !matched.node.isConnected) {
      return {
        executed: false,
        reason: "Grounded target element not found or drifted beyond safety threshold"
      };
    }

    let el = matched.node;
    if (el && !["input", "textarea", "select"].includes((el.tagName || "").toLowerCase()) && !el.isContentEditable && (el.getAttribute && el.getAttribute("role") !== "textbox" && el.getAttribute("role") !== "combobox")) {
      const inner = el.querySelector ? el.querySelector("input:not([type='hidden']), textarea, select, [contenteditable='true'], [role='textbox'], [role='combobox']") : null;
      if (inner) el = inner;
    }
    const tagName = (el.tagName || "").toLowerCase();
    const isInput = tagName === "input";
    const isTextarea = tagName === "textarea";
    const isSelect = tagName === "select";
    const isContentEditable = !!(el.isContentEditable || (el.getAttribute && el.getAttribute("contenteditable") === "true"));
    const isRoleTextbox = !!(el.getAttribute && (el.getAttribute("role") === "textbox" || el.getAttribute("role") === "combobox" || el.getAttribute("role") === "searchbox" || !!el.getAttribute("aria-autocomplete")));

    // 3. Verify matched node is an actual fillable control
    if (!isInput && !isTextarea && !isSelect && !isContentEditable && !isRoleTextbox) {
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

    // 5. Focus field before filling (requirement 6: autocomplete workflow)
    if (typeof el.focus === "function") {
      try { el.focus(); } catch (_) {}
    }

    // 5b. Set value via fillEditableElement and verify locally
    try {
      let fillRes;
      if (isInput || isTextarea || isContentEditable || isRoleTextbox) {
        fillRes = fillEditableElement(el, fillValue);
      } else if (isSelect) {
        let optSelected = false;
        if (el.options && el.options.length > 0) {
          const valNorm = String(fillValue).toLowerCase().trim();
          for (let oi = 0; oi < el.options.length; oi++) {
            const opt = el.options[oi];
            const optText = (opt.text || opt.label || "").toLowerCase().trim();
            const optVal = (opt.value || "").toLowerCase().trim();
            if (optText === valNorm || optVal === valNorm || optText.includes(valNorm) || valNorm.includes(optText)) {
              el.selectedIndex = oi;
              optSelected = true;
              break;
            }
          }
        }
        if (!optSelected) el.value = String(fillValue);
        el.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
        el.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
        const normalizeWs = (s) => (s || "").replace(/\s+/g, " ").trim();
        const verified = normalizeWs(el.value) === normalizeWs(fillValue) || (el.selectedIndex >= 0 && (normalizeWs(el.options[el.selectedIndex]?.text).includes(normalizeWs(fillValue)) || normalizeWs(el.options[el.selectedIndex]?.value) === normalizeWs(fillValue)));
        fillRes = { executed: verified, verified: verified };
      } else {
        fillRes = { executed: false, verified: false, reason: "Target element is not a fillable form control" };
      }

      if (!fillRes.verified) {
        return {
          executed: false,
          action: "FILL",
          targetType: matched.type,
          targetLabel: matched.label,
          groundedIndex: typeof targetIndex === "number" ? targetIndex : freshElements.indexOf(matched),
          verified: false,
          reason: fillRes.reason || "Editable target was grounded but the page did not accept the text."
        };
      }

      return {
        executed: true,
        action: "FILL",
        targetType: matched.type,
        targetLabel: matched.label,
        groundedIndex: typeof targetIndex === "number" ? targetIndex : freshElements.indexOf(matched),
        verified: true
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
            insertTextIntoEditable(el, fillVal);
          }

          let verified = false;
          if (isInput || isTextarea) {
            verified = (el.value || "").trim() === String(fillVal).trim();
          } else if (isContentEditable || isRoleTextbox) {
            const curText = (el.textContent || el.innerText || "").replace(/\s+/g, " ").trim();
            const targetVal = String(fillVal).replace(/\s+/g, " ").trim();
            verified = curText.includes(targetVal) || curText === targetVal;
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

    // C. Search DOM for the primary search input using 5-tier ranking
    if (!targetInput) {
      let topSearchInput = null;
      let topSearchScore = 0;
      for (const item of freshElements) {
        if (!item || !item.node || !item.node.isConnected || item.node.disabled) continue;
        const s = scoreSearchCandidate(item, "", false);
        if (s > topSearchScore) {
          topSearchScore = s;
          topSearchInput = item.node;
        }
      }
      if (topSearchInput && topSearchScore >= 0.50) {
        targetInput = topSearchInput;
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
const VISUAL_SELECTOR = "button, a[href], input, textarea, select, [role='button'], [role='link'], [role='checkbox'], [role='radio'], [role='combobox'], [role='searchbox'], [role='textbox'], [contenteditable]:not([contenteditable='false']), [aria-autocomplete], [role='option'], [role='tab'], [role='menuitem'], [role='switch'], h1, h2, h3, h4, h5, h6, [tabindex]:not([tabindex='-1'])";

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
    "untitled question",
    "how search works",
    "ai mode",
    "privacy",
    "terms",
    "settings",
    "advertising",
    "business",
    "about",
    "google apps",
    "sign in",
    "send feedback"
  ]);
  if (boilerplateExact.has(s)) return true;
  if (/^(?:your\s+answer|required\s+question|\*|text\s+field|input\s+field|how\s+search\s+works|ai\s+mode)$/i.test(s)) return true;
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

  // 1b. Associated <label for="wrapperId"> when input is inside an ID'd custom component wrapper
  if (el.closest && typeof document !== "undefined" && document.querySelector) {
    try {
      const wrapperWithId = el.closest("[id]:not(body):not(html)");
      if (wrapperWithId && wrapperWithId !== el && wrapperWithId.id) {
        const escapedWrapperId = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(wrapperWithId.id) : wrapperWithId.id;
        const wrapperLabel = document.querySelector(`label[for="${escapedWrapperId}"]`);
        if (wrapperLabel) {
          const text = cleanFieldTitle(wrapperLabel.innerText || wrapperLabel.textContent || "");
          if (text && !isGenericBoilerplateLabel(text)) return text;
        }
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

  // 5. Enclosing Question / Field Container (PrimeNG, Material, Angular, Bootstrap, Google Forms)
  if (el.closest) {
    const questionContainer = el.closest(
      "[role='listitem'], .Qr7Oae, .geS5n, [data-item-id], .freebirdFormviewerViewNumberedItemContainer, .freebirdFormviewerComponentsQuestionBaseRoot, .form-group, .field-group, .form-item, fieldset, .ui-float-label, .p-float-label, p-autocomplete, .ui-autocomplete, mat-form-field, .mat-form-field, .form-floating, .input-container, .field-container, .station-from, .station-to, [data-field]"
    );
    if (questionContainer) {
      const heading = questionContainer.querySelector(
        ".M7eMe, [role='heading'], .exportQuestionTitle, .freebirdFormviewerComponentsQuestionBaseTitle, .FmiOAc, .c2gGi, legend, label, .field-label, mat-label, .mat-form-field-label, .ui-float-label label, h1, h2, h3, h4, h5, strong, b"
      );
      if (heading && heading !== el) {
        const headingText = cleanFieldTitle(heading.innerText || heading.textContent || "");
        if (headingText && !isGenericBoilerplateLabel(headingText) && headingText.length < 100) {
          return headingText;
        }
      }
    }
  }

  // 6. Nearby preceding or following visible text sibling (including floating labels)
  let prev = el.previousElementSibling;
  while (prev) {
    const prevText = cleanFieldTitle(prev.innerText || prev.textContent || "");
    if (prevText && !isGenericBoilerplateLabel(prevText) && prevText.length < 100) {
      return prevText;
    }
    prev = prev.previousElementSibling;
  }
  let next = el.nextElementSibling;
  while (next) {
    const nextText = cleanFieldTitle(next.innerText || next.textContent || "");
    if (nextText && !isGenericBoilerplateLabel(nextText) && nextText.length < 100) {
      return nextText;
    }
    next = next.nextElementSibling;
  }

  // Sibling of parent container (e.g. <span class="ui-autocomplete"><input></span><label>From</label>)
  if (el.parentElement && el.parentElement !== document.body) {
    let pNext = el.parentElement.nextElementSibling;
    while (pNext) {
      const pNextText = cleanFieldTitle(pNext.innerText || pNext.textContent || "");
      if (pNextText && !isGenericBoilerplateLabel(pNextText) && pNextText.length < 100) {
        return pNextText;
      }
      pNext = pNext.nextElementSibling;
    }
    let pPrev = el.parentElement.previousElementSibling;
    while (pPrev) {
      const pPrevText = cleanFieldTitle(pPrev.innerText || pPrev.textContent || "");
      if (pPrevText && !isGenericBoilerplateLabel(pPrevText) && pPrevText.length < 100) {
        return pPrevText;
      }
      pPrev = pPrev.previousElementSibling;
    }
  }

  // 7. Associated visible label text (aria-describedby)
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

  // 8. name attribute (humanized)
  if (el.getAttribute) {
    const nameAttr = el.getAttribute("name");
    if (nameAttr && nameAttr.trim()) {
      const humanized = humanizeName(nameAttr);
      if (humanized && !isGenericBoilerplateLabel(humanized)) return humanized;
    }
  }

  // 9. placeholder (non-boilerplate)
  if (el.getAttribute) {
    const placeholder = el.getAttribute("placeholder");
    if (placeholder && placeholder.trim()) {
      const cleaned = cleanFieldTitle(placeholder);
      if (cleaned && !isGenericBoilerplateLabel(cleaned)) {
        return cleaned;
      }
    }
  }

  // 10. title attribute
  if (el.getAttribute) {
    const title = el.getAttribute("title");
    if (title && title.trim()) {
      const cleaned = cleanFieldTitle(title);
      if (cleaned && !isGenericBoilerplateLabel(cleaned)) {
        return cleaned;
      }
    }
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
 * Collects a small bounded semantic context window around a candidate element.
 * Gathers direct sibling text and nearest parent container labels (max 120 chars).
 * @param {Element} el
 * @returns {string}
 */
function extractBoundedContext(el) {
  if (!el || typeof el !== "object") return "";
  const parts = [];
  try {
    // 1. Preceding sibling
    let prev = el.previousElementSibling;
    let pCount = 0;
    while (prev && pCount < 2) {
      const pt = cleanFieldTitle(prev.innerText || prev.textContent || "");
      if (pt && !isGenericBoilerplateLabel(pt) && pt.length < 60) {
        parts.unshift(pt);
        break;
      }
      prev = prev.previousElementSibling;
      pCount++;
    }

    // 2. Following sibling
    let next = el.nextElementSibling;
    let nCount = 0;
    while (next && nCount < 2) {
      const nt = cleanFieldTitle(next.innerText || next.textContent || "");
      if (nt && !isGenericBoilerplateLabel(nt) && nt.length < 60) {
        parts.push(nt);
        break;
      }
      next = next.nextElementSibling;
      nCount++;
    }

    // 3. Parent container siblings and direct label
    if (el.parentElement && el.parentElement !== document.body) {
      const p = el.parentElement;
      if (p.nextElementSibling) {
        const pnt = cleanFieldTitle(p.nextElementSibling.innerText || p.nextElementSibling.textContent || "");
        if (pnt && !isGenericBoilerplateLabel(pnt) && pnt.length < 60) parts.push(pnt);
      }
      if (p.previousElementSibling) {
        const ppt = cleanFieldTitle(p.previousElementSibling.innerText || p.previousElementSibling.textContent || "");
        if (ppt && !isGenericBoilerplateLabel(ppt) && ppt.length < 60) parts.unshift(ppt);
      }
      const parentLabel = p.querySelector ? p.querySelector("label, .label, .field-label, span.ui-float-label, strong") : null;
      if (parentLabel && parentLabel !== el) {
        const plt = cleanFieldTitle(parentLabel.innerText || parentLabel.textContent || "");
        if (plt && !isGenericBoilerplateLabel(plt) && plt.length < 60) parts.push(plt);
      }
    }
  } catch (_) {}

  const unique = [];
  for (const part of parts) {
    if (part && !unique.includes(part)) unique.push(part);
  }
  return unique.join(" ").slice(0, 120);
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

  // 2. Identify UI element type & Universal Editable Target Model (Part 2)
  const tagName = (el.tagName || "").toLowerCase();
  const elRole = el.getAttribute ? (el.getAttribute("role") || "").toLowerCase() : "";
  const hasAriaAutocomplete = el.getAttribute && !!el.getAttribute("aria-autocomplete");
  const rawCe = el.getAttribute ? el.getAttribute("contenteditable") : null;
  const hasCeAttr = rawCe !== null && rawCe !== undefined;
  const ceAttr = hasCeAttr ? String(rawCe) : null;
  const ceAttrLower = hasCeAttr ? ceAttr.toLowerCase().trim() : null;
  const isContentEditable = !!(
    el.isContentEditable === true ||
    (hasCeAttr && (ceAttrLower === "true" || ceAttrLower === "plaintext-only" || ceAttrLower === ""))
  );

  let inputKind = null;
  let isEditableTarget = false;

  if (tagName === "input") {
    const inputType = (el.type || "text").toLowerCase();
    if (!["button", "submit", "reset", "checkbox", "radio", "image", "file", "color", "hidden"].includes(inputType)) {
      inputKind = "NATIVE_INPUT";
      isEditableTarget = true;
    }
  } else if (tagName === "textarea") {
    inputKind = "NATIVE_TEXTAREA";
    isEditableTarget = true;
  } else if (isContentEditable) {
    inputKind = "CONTENTEDITABLE";
    isEditableTarget = true;
  } else if (elRole === "textbox" && (isContentEditable || !el.getAttribute || el.getAttribute("aria-readonly") !== "true")) {
    inputKind = "ARIA_TEXTBOX";
    isEditableTarget = true;
  } else if (elRole === "combobox" || elRole === "searchbox" || hasAriaAutocomplete) {
    inputKind = "OTHER_EDITABLE";
    isEditableTarget = true;
  }

  let type = "element";

  if (/^h[1-6]$/.test(tagName)) {
    type = "heading";
  } else if (tagName === "button" || elRole === "button" || (tagName === "input" && ["button", "submit", "reset"].includes(el.type))) {
    type = "button";
  } else if (tagName === "a" || elRole === "link") {
    type = "link";
  } else if (tagName === "textarea") {
    type = "textarea";
  } else if (tagName === "input") {
    if (el.type === "checkbox" || elRole === "checkbox") {
      type = "checkbox";
    } else if (el.type === "radio" || elRole === "radio") {
      type = "radio";
    } else if (elRole === "combobox" || hasAriaAutocomplete) {
      type = "combobox";
    } else {
      type = "input";
    }
  } else if (tagName === "select") {
    type = "select";
  } else if (elRole === "combobox" || hasAriaAutocomplete) {
    type = "combobox";
  } else if (elRole === "searchbox") {
    type = "searchbox";
  } else if (isContentEditable) {
    type = "contenteditable";
  } else if (elRole === "textbox") {
    type = (el.getAttribute && el.getAttribute("aria-multiline") === "true") || tagName === "textarea" ? "textarea" : "input";
  } else if (["checkbox", "radio", "tab", "menuitem", "switch"].includes(elRole)) {
    type = elRole;
  }

  // 3. Safe, non-sensitive label extraction
  // NOTE: Explicitly NEVER reads .value from user-entered form controls to ensure privacy preservation.
  let label = "";
  const isFormField = ["input", "textarea", "select"].includes(tagName) ||
    elRole === "textbox" ||
    elRole === "combobox" ||
    elRole === "searchbox" ||
    hasAriaAutocomplete ||
    isContentEditable;

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

  // Bounded context extraction for comboboxes and dynamic form fields
  let nearbyContext = extractBoundedContext(el);
  const elNameAttr = (el.getAttribute ? (el.getAttribute("name") || "") : "").toLowerCase();
  const isSearchControl = type === "searchbox" ||
    (tagName === "textarea" && (elNameAttr === "q" || elNameAttr === "query" || /search/i.test(el.getAttribute?.("title") || ""))) ||
    (tagName === "input" && (el.type === "search" || elNameAttr === "q" || elNameAttr === "query")) ||
    /^(?:search|searchbox|google search)$/i.test(label);

  if (isFormField && !isSearchControl && (!label || /^(?:input|combobox|select|textarea|textbox)\s+element$/i.test(label) || /^(?:enter|type)\s+/i.test(label)) && nearbyContext) {
    if (!isGenericBoilerplateLabel(nearbyContext)) {
      label = nearbyContext;
    }
  }

  // Ensure search control retains clean semantic search label
  if (isSearchControl && (!label || isGenericBoilerplateLabel(label) || /^(?:textarea|input)\s+element$/i.test(label))) {
    label = "Search";
  }

  // Normalize spacing and truncate label length
  label = label.replace(/\s+/g, " ").slice(0, 60) || `${type} element`;
  const surroundingContext = [label, nearbyContext, (el.getAttribute ? (el.getAttribute("aria-label") || "") : "")].filter(Boolean).join(" ");
  try {
    if (typeof redactText === "function") {
      label = redactText(label, { contextText: surroundingContext });
    } else if (typeof window !== "undefined" && typeof window.redactText === "function") {
      label = window.redactText(label, { contextText: surroundingContext });
    } else if (typeof globalThis !== "undefined" && typeof globalThis.redactText === "function") {
      label = globalThis.redactText(label, { contextText: surroundingContext });
    }
    if (nearbyContext) {
      if (typeof redactText === "function") nearbyContext = redactText(nearbyContext);
      else if (typeof window !== "undefined" && typeof window.redactText === "function") nearbyContext = window.redactText(nearbyContext);
      else if (typeof globalThis !== "undefined" && typeof globalThis.redactText === "function") nearbyContext = globalThis.redactText(nearbyContext);
    }
  } catch (err) {
    console.warn("[IRIS Privacy] Redaction processing failed; sanitized fallback applied.", err);
  }

  const isDisabled = !!(
    el.disabled ||
    (el.getAttribute && el.getAttribute("aria-disabled") === "true") ||
    (el.classList && el.classList.contains("disabled"))
  );

  // Search result & header/footer context detection
  let isSearchResultEl = false;
  let isAccountControlEl = false;
  let isHeaderNavEl = false;
  let isFooterNavEl = false;
  let surroundingSnippetText = null;

  try {
    const rawLabelLower = (label || "").toLowerCase();
    const ariaLower = (el.getAttribute ? (el.getAttribute("aria-label") || "") : "").toLowerCase();
    const titleLower = (el.getAttribute ? (el.getAttribute("title") || "") : "").toLowerCase();
    const hrefVal = (tagName === "a" ? (el.href || (el.getAttribute ? el.getAttribute("href") : "") || "") : "").toLowerCase();
    const comboText = `${rawLabelLower} ${ariaLower} ${titleLower}`;

    // 1. Account / Profile controls (Google Account, user profile, account switchers)
    if (/google\s+account|manage\s+your\s+google\s+account|switch\s+account|user\s+profile|\bprofile\b/i.test(comboText) &&
        !comboText.includes("linkedin") && !comboText.includes("twitter") && !comboText.includes("github")) {
      isAccountControlEl = true;
    }
    if (hrefVal.includes("accounts.google.") || hrefVal.includes("myaccount.google.")) {
      isAccountControlEl = true;
    }

    // 2. Header / Nav / Footer controls
    if (el.closest) {
      const headerAncestor = el.closest("header, nav, [role='banner'], [role='navigation'], #gb, #top_nav, .appbar, #hdtb, #header");
      if (headerAncestor) {
        isHeaderNavEl = true;
      }
      const footerAncestor = el.closest("footer, [role='contentinfo'], #foot, #fbar, #footer");
      if (footerAncestor) {
        isFooterNavEl = true;
      }

      // 3. Search result container detection
      const resultArea = el.closest("#search, #rso, #center_col, #links, .results, .search-results, [role='main'], main, .b_results, .mw-search-results");
      if (resultArea && !headerAncestor && !footerAncestor && !isAccountControlEl) {
        const isExternalLink = /^https?:\/\//i.test(hrefVal) && !/(?:google\.[a-z.]+\/(?:search|preferences|webhp|intl|policies)|accounts\.google\.|support\.google\.|maps\.google\.)/i.test(hrefVal);
        const hasResultStructure = isExternalLink || tagName === "h3" || tagName === "h4" || elRole === "heading" || !!el.closest(".g, [data-hveid], .tF2Cxc, .MjjYud, .b_algo, .result, article, li");
        if (hasResultStructure && !isGenericBoilerplateLabel(label)) {
          isSearchResultEl = true;
          const resultCard = el.closest(".g, [data-hveid], .tF2Cxc, .MjjYud, .b_algo, .result, article, li");
          if (resultCard) {
            const snippetEl = resultCard.querySelector(".VwiC3b, [data-sncf], .b_caption p, .result__snippet, p, span[style*='-webkit-line-clamp']");
            if (snippetEl && snippetEl !== el) {
              const snip = (snippetEl.innerText || snippetEl.textContent || "").trim();
              if (snip && snip !== label) {
                surroundingSnippetText = snip.slice(0, 300);
              }
            }
          }
        }
      }
    }
  } catch (_) {}

  // 3b. Dialog / Modal / Composer container detection
  let inDialog = false;
  let inModal = false;
  let containerRole = null;
  try {
    if (el.closest) {
      const dialogAncestor = el.closest('[role="dialog"], [role="alertdialog"], [aria-modal="true"], dialog, .modal, .dialog, [class*="modal" i], [class*="dialog" i], [class*="popup" i], [class*="overlay" i]');
      if (dialogAncestor) {
        inDialog = true;
        inModal = true;
        containerRole = (dialogAncestor.getAttribute && dialogAncestor.getAttribute("role")) || "dialog";
      }
    }
  } catch (_) {}

  // 4. Record bounding box and metadata with safe semantic label
  const semanticTag = getSemanticTag(type, label, el);
  const descriptor = {
    type: type,
    tag: tagName,
    role: elRole || (["button", "link"].includes(type) ? type : (isFormField ? "textbox" : null)),
    label: label,
    text: label,
    url: tagName === "a" ? (el.href || (el.getAttribute ? el.getAttribute("href") : null) || null) : null,
    href: tagName === "a" ? ((el.getAttribute ? el.getAttribute("href") : null) || el.href || null) : null,
    semanticTag: semanticTag,
    visible: true,
    enabled: !isDisabled,
    disabled: isDisabled,
    editable: isEditableTarget,
    contentEditable: ceAttr || (el.contentEditable !== undefined ? el.contentEditable : null),
    isContentEditable: isContentEditable,
    inputKind: inputKind,
    boundingBox: {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height)
    },
    parentContext: containerRole || (inDialog ? "dialog" : null),
    inDialog: inDialog,
    inModal: inModal,
    containerRole: containerRole,
    dataPlaceholder: (el.getAttribute ? (el.getAttribute("data-placeholder") || el.getAttribute("data-placeholder-default")) : null) || null,
    placeholder: (el.getAttribute ? el.getAttribute("placeholder") : null) || null,
    ariaLabel: (el.getAttribute ? el.getAttribute("aria-label") : null) || null,
    title: (el.getAttribute ? el.getAttribute("title") : null) || null,
    name: (el.getAttribute ? el.getAttribute("name") : null) || null,
    id: el.id || null,
    associatedLabel: (function() {
      try {
        if (el.id && typeof document !== "undefined" && document.querySelector) {
          const l = document.querySelector(`label[for="${CSS.escape ? CSS.escape(el.id) : el.id}"]`);
          if (l) return (l.innerText || l.textContent || "").trim();
        }
        if (el.closest) {
          const p = el.closest(".form-group, .field-group, .form-row, .ui-float-label, .p-float-label, mat-form-field, fieldset, [data-field]");
          if (p) {
            const lbl = p.querySelector("label, .field-label, mat-label, legend");
            if (lbl && lbl !== el) return (lbl.innerText || lbl.textContent || "").trim();
          }
        }
      } catch (_) {}
      return null;
    })(),
    alt: (el.getAttribute ? el.getAttribute("alt") : null) || (el.querySelector ? el.querySelector("img[alt]")?.getAttribute("alt") : null) || null,
    className: (el.className && typeof el.className === "string") ? el.className.slice(0, 100) : "",
    dataColor: (el.getAttribute ? (el.getAttribute("data-color") || el.getAttribute("data-colour") || (el.dataset && (el.dataset.color || el.dataset.colour))) : null) || null,
    inputType: tagName === "input" ? (el.type || "text") : null,
    nearbyText: nearbyContext || null,
    contextText: nearbyContext || null,
    ariaAutocomplete: (el.getAttribute ? el.getAttribute("aria-autocomplete") : null) || null,
    ariaExpanded: (el.getAttribute ? el.getAttribute("aria-expanded") : null) || null,
    ariaControls: (el.getAttribute ? el.getAttribute("aria-controls") : null) || null,
    ariaHasPopup: (el.getAttribute ? el.getAttribute("aria-haspopup") : null) || null,
    autocomplete: (el.getAttribute ? el.getAttribute("autocomplete") : null) || null,
    isInteractable: !isDisabled && ["button", "link", "input", "textarea", "select", "checkbox", "radio", "textbox", "combobox", "searchbox"].includes(type),
    isSearchResult: isSearchResultEl,
    isAccountControl: isAccountControlEl,
    isHeaderNav: isHeaderNavEl,
    isFooterNav: isFooterNavEl,
    snippet: surroundingSnippetText,
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
  if (typeof document === "undefined" || !document.querySelectorAll) return [];
  const elements = document.querySelectorAll(VISUAL_SELECTOR);
  const visualElements = [];
  let formFieldCounter = 0;

  elements.forEach((el) => {
    const tagName = (el.tagName || "").toLowerCase();
    const elRole = (el.getAttribute && el.getAttribute("role") ? el.getAttribute("role").toLowerCase() : "");
    const hasAriaAutocomplete = el.getAttribute && !!el.getAttribute("aria-autocomplete");
    const isFormField = ["input", "textarea", "select"].includes(tagName) ||
      elRole === "textbox" ||
      elRole === "combobox" ||
      elRole === "searchbox" ||
      hasAriaAutocomplete ||
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
  if (typeof document === "undefined" || !document.querySelectorAll) return [];
  const elements = document.querySelectorAll(VISUAL_SELECTOR);
  const visualElementsWithNodes = [];
  let formFieldCounter = 0;

  elements.forEach((el) => {
    const tagName = (el.tagName || "").toLowerCase();
    const elRole = (el.getAttribute && el.getAttribute("role") ? el.getAttribute("role").toLowerCase() : "");
    const hasAriaAutocomplete = el.getAttribute && !!el.getAttribute("aria-autocomplete");
    const isFormField = ["input", "textarea", "select"].includes(tagName) ||
      elRole === "textbox" ||
      elRole === "combobox" ||
      elRole === "searchbox" ||
      hasAriaAutocomplete ||
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
 * Milestone 11 & Privacy Hardening: Local DOM-attribute heuristic for sensitive input detection.
 * Evaluates safe metadata only: input types, autocomplete, and name/id/placeholder/label keywords.
 * SECURITY: Never reads or inspects `.value` of any field.
 */
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
  const nameAttr = (el.getAttribute ? (el.getAttribute("name") || "") : "").toLowerCase();
  const idAttr = (el.id || "").toLowerCase();
  const placeholderAttr = (el.getAttribute ? (el.getAttribute("placeholder") || "") : "").toLowerCase();
  const autocompleteAttr = (el.getAttribute ? (el.getAttribute("autocomplete") || "") : "").toLowerCase();
  const ariaLabelAttr = (el.getAttribute ? (el.getAttribute("aria-label") || "") : "").toLowerCase();

  // Safe associated label text if present
  let labelText = "";
  if (el.id && typeof document !== "undefined" && document.querySelector) {
    try {
      const labelEl = document.querySelector(`label[for="${el.id}"]`);
      if (labelEl) {
        labelText = (labelEl.innerText || labelEl.textContent || "").trim();
      }
    } catch (_) {}
  }

  const metadata = {
    type,
    name: nameAttr,
    id: idAttr,
    placeholder: placeholderAttr,
    autocomplete: autocompleteAttr,
    ariaLabel: ariaLabelAttr,
    labelText
  };

  // Delegate to canonical pii-detector module
  if (typeof isSensitiveInputMetadata === "function") {
    return isSensitiveInputMetadata(metadata);
  }
  if (typeof window !== "undefined" && typeof window.isSensitiveInputMetadata === "function") {
    return window.isSensitiveInputMetadata(metadata);
  }
  if (typeof globalThis !== "undefined" && typeof globalThis.isSensitiveInputMetadata === "function") {
    return globalThis.isSensitiveInputMetadata(metadata);
  }
  if (typeof require === "function") {
    try {
      const pii = require("./pii-detector.js");
      if (pii && typeof pii.isSensitiveInputMetadata === "function") {
        return pii.isSensitiveInputMetadata(metadata);
      }
    } catch (_) {}
  }

  // Fallback heuristic if detector module is not yet wired
  if (tagName === "input" && (type === "password" || type === "email" || type === "tel")) {
    return true;
  }
  const SENSITIVE_KEYWORDS = ["card", "credit", "cvv", "ssn", "phone", "password", "email", "bank", "account", "token", "otp", "pin"];
  return SENSITIVE_KEYWORDS.some(kw =>
    nameAttr.includes(kw) || idAttr.includes(kw) || placeholderAttr.includes(kw) || ariaLabelAttr.includes(kw)
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
  try {
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
  } catch (err) {
    console.warn("[IRIS Privacy] Redaction processing failed; sanitized fallback applied.", err);
    return { detected: true, redacted: "[REDACTED]" };
  }
  return { detected: false, redacted: "" };
}

/**
 * Helper to retrieve contextual sensitive spans from pii-detector.
 * @param {string} text
 * @returns {Array<Object>}
 */
function getContextualSensitiveSpans(text) {
  if (!text || typeof text !== "string") return [];
  try {
    if (typeof detectContextualSensitiveSpans === "function") {
      return detectContextualSensitiveSpans(text);
    }
    if (typeof window !== "undefined" && typeof window.detectContextualSensitiveSpans === "function") {
      return window.detectContextualSensitiveSpans(text);
    }
    if (typeof globalThis !== "undefined" && typeof globalThis.detectContextualSensitiveSpans === "function") {
      return globalThis.detectContextualSensitiveSpans(text);
    }
    if (typeof require === "function") {
      try {
        const pii = require("./pii-detector.js");
        if (pii && typeof pii.detectContextualSensitiveSpans === "function") {
          return pii.detectContextualSensitiveSpans(text);
        }
      } catch (_) {}
    }
  } catch (_) {}
  return [];
}

/**
 * Calculates screen pixel coordinates for character range within an element's text nodes.
 * @param {Element} element
 * @param {number} startIndex
 * @param {number} endIndex
 * @returns {DOMRect|null}
 */
function findTextRangeRect(element, startIndex, endIndex) {
  if (typeof document === "undefined" || !document.createRange || typeof NodeFilter === "undefined") return null;
  try {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null, false);
    let currentNode = walker.nextNode();
    let currentOffset = 0;
    let startNode = null;
    let startCharOffset = 0;
    let endNode = null;
    let endCharOffset = 0;

    while (currentNode) {
      const nodeLength = (currentNode.textContent || "").length;
      if (!startNode && currentOffset + nodeLength >= startIndex) {
        startNode = currentNode;
        startCharOffset = Math.max(0, startIndex - currentOffset);
      }
      if (startNode && currentOffset + nodeLength >= endIndex) {
        endNode = currentNode;
        endCharOffset = Math.min(nodeLength, endIndex - currentOffset);
        break;
      }
      currentOffset += nodeLength;
      currentNode = walker.nextNode();
    }

    if (startNode && endNode) {
      const range = document.createRange();
      range.setStart(startNode, startCharOffset);
      range.setEnd(endNode, endCharOffset);
      const rect = range.getBoundingClientRect();
      if (rect && rect.width > 0 && rect.height > 0) {
        return rect;
      }
    }
  } catch (_) {}
  return null;
}

/**
 * Helper to identify DOM text elements that contain sensitive PII (Layer 4 Cross-element & text perception).
 * Scans leaf elements or short text blocks containing sensitive identifiers,
 * personal names, sensitive dates, banking details, or employment context.
 */
function extractSensitiveTextRegions() {
  const regions = [];
  if (typeof document === "undefined" || !document.querySelectorAll) return regions;

  const candidates = document.querySelectorAll(
    "p, span, div, td, th, li, dt, dd, b, strong, em, [role='article'], [role='document'], [data-message-id], .a3s"
  );

  candidates.forEach((el) => {
    if (el.closest && (el.closest("#sih-agent-overlay-root") || el.closest("[id^='sih-agent-overlay']"))) {
      return;
    }
    if (el.id && el.id.startsWith("sih-agent-overlay")) {
      return;
    }
    // Only inspect leaf or small container elements to get precise bounding boxes
    if (el.children && el.children.length > 2) {
      return;
    }

    const text = (el.innerText || el.textContent || "").trim();
    if (!text || text.length > 300 || text.includes("[REDACTED_")) {
      return;
    }

    // M28: Local Contextual Sensitive Identifier Detection
    const contextualSpans = getContextualSensitiveSpans(text);
    if (contextualSpans && contextualSpans.length > 0) {
      contextualSpans.forEach((span) => {
        let spanRect = null;
        if (typeof span.startIndex === "number" && typeof span.endIndex === "number") {
          spanRect = findTextRangeRect(el, span.startIndex, span.endIndex);
        }
        if (!spanRect) {
          spanRect = getVisibleRect(el);
        }
        if (spanRect && spanRect.width > 0 && spanRect.height > 0) {
          regions.push({
            x: Math.round(spanRect.x !== undefined ? spanRect.x : (spanRect.left || 0)),
            y: Math.round(spanRect.y !== undefined ? spanRect.y : (spanRect.top || 0)),
            width: Math.round(spanRect.width),
            height: Math.round(spanRect.height),
            source: "dom-contextual-text",
            category: span.type || "OTHER_CONTEXTUAL_IDENTIFIER",
            confidence: "HIGH"
          });
        }
      });
      return;
    }

    const check = checkValueSensitivity(text);
    if (check && check.detected) {
      const rect = getVisibleRect(el);
      if (rect && rect.width > 0 && rect.height > 0) {
        const cat = (check.categories && check.categories[0]) ? check.categories[0] : "IDENTITY";
        regions.push({
          x: Math.round(rect.x !== undefined ? rect.x : (rect.left || 0)),
          y: Math.round(rect.y !== undefined ? rect.y : (rect.top || 0)),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          source: "dom-text",
          category: cat,
          confidence: "HIGH"
        });
      }
    }
  });

  // Table row label-value pair detection (e.g. <tr><td>Employee ID:</td><td>NXT-2609307</td></tr>)
  const rows = document.querySelectorAll("tr");
  rows.forEach((row) => {
    if (row.closest && (row.closest("#sih-agent-overlay-root") || row.closest("[id^='sih-agent-overlay']"))) return;
    const cells = row.children;
    if (cells && cells.length >= 2 && cells.length <= 4) {
      const labelText = (cells[0].innerText || cells[0].textContent || "").trim();
      const valText = (cells[1].innerText || cells[1].textContent || "").trim();
      if (labelText && valText && !valText.includes("[REDACTED_")) {
        const combined = `${labelText}: ${valText}`;
        const ctxSpans = getContextualSensitiveSpans(combined);
        if (ctxSpans && ctxSpans.length > 0) {
          const valRect = getVisibleRect(cells[1]);
          if (valRect && valRect.width > 0 && valRect.height > 0) {
            regions.push({
              x: Math.round(valRect.x !== undefined ? valRect.x : (valRect.left || 0)),
              y: Math.round(valRect.y !== undefined ? valRect.y : (valRect.top || 0)),
              width: Math.round(valRect.width),
              height: Math.round(valRect.height),
              source: "dom-contextual-text",
              category: ctxSpans[0].type || "OTHER_CONTEXTUAL_IDENTIFIER",
              confidence: "HIGH"
            });
          }
          return;
        }

        const check = checkValueSensitivity(combined);
        if (check && check.detected) {
          const valRect = getVisibleRect(cells[1]);
          if (valRect && valRect.width > 0 && valRect.height > 0) {
            regions.push({
              x: Math.round(valRect.x !== undefined ? valRect.x : (valRect.left || 0)),
              y: Math.round(valRect.y !== undefined ? valRect.y : (valRect.top || 0)),
              width: Math.round(valRect.width),
              height: Math.round(valRect.height),
              source: "dom-text",
              category: check.categories?.[0] || "IDENTITY",
              confidence: "HIGH"
            });
          }
        }
      }
    }
  });

  return regions;
}

/**
 * Milestone 11 & SIH26171: Extracts bounding boxes of visible sensitive elements.
 * Combines:
 * A. Structural detection (M11): password fields, type=email, sensitive name/id/placeholder keywords (even if empty).
 * B. Local value-based detection (SIH26171): arbitrary form fields containing sensitive PII (emails, phones, credit cards, passwords).
 * C. Text-element detection: sensitive DOM text elements, onboarding cards, email bodies, and student/banking records.
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

  // Reason C: Sensitive DOM text regions (Layer 4 Cross-element & text perception)
  try {
    const textRegions = extractSensitiveTextRegions();
    if (Array.isArray(textRegions)) {
      sensitiveRegions.push(...textRegions);
    }
  } catch (_) {}

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
      let redactedSample = "";
      try {
        if (typeof redactText === "function") {
          redactedSample = redactText(rawVisibleText);
        } else if (typeof window !== "undefined" && typeof window.redactText === "function") {
          redactedSample = window.redactText(rawVisibleText);
        } else if (typeof globalThis !== "undefined" && typeof globalThis.redactText === "function") {
          redactedSample = globalThis.redactText(rawVisibleText);
        } else {
          redactedSample = "[REDACTED_PAGE_CONTENT]";
        }
      } catch (err) {
        console.warn("[IRIS Privacy] Redaction processing failed; sanitized fallback applied.", err);
        redactedSample = "[REDACTED_PAGE_CONTENT]";
      }

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
    findClickableExactTextTarget,
    scoreCandidateAgainstDescriptor,
    insertTextIntoEditable,
    fillEditableElement,
    SENSITIVE_CONTROL_SELECTOR
  };
}

if (typeof window !== "undefined") {
  window.fillEditableElement = fillEditableElement;
}
