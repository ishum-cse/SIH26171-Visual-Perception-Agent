/**
 * semantic-resolver.js — General Human-Language Browser Task Understanding
 * SIH26171 IRIS Browser Agent
 *
 * ARCHITECTURAL ROLE:
 * Bridges Layer 2 (Semantic Target) to Layer 3 (Concrete UI Target).
 * Never passes unresolved semantic phrases (e.g. "cheapest product", "most recent email",
 * "button below the heading") directly to literal DOM search.
 *
 * Resolves semantic targets against perceived page evidence:
 * - DOM structure & visible candidate elements
 * - OCR text & spatial bounding boxes
 * - Visual perception & color/attribute grounding
 * - Relative rankings (cheapest, most expensive, highest rated, latest, most recent)
 * - Spatial relationships (below, above, leftOf, rightOf, nextTo, beside, on the right)
 * - Content and textual filters (containing, labelled, from)
 * - List/repeated item understanding across general websites (products, emails, search results, cards)
 *
 * CRITICAL SAFETY & PRIVACY RULES:
 * 1. Semantic understanding != guessing: fails closed when ambiguous or evidence is insufficient.
 * 2. 100% on-device and client-side; no PII exposure.
 * 3. General website compatibility: operates on webpage evidence, no hard-coded website hacks.
 */

(function (root, factory) {
  if (typeof define === "function" && define.amd) {
    define([], factory);
  } else if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.SIHSemanticResolver = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const normalize = (s) => (s || "").trim().toLowerCase();

  // Known item categories
  const ITEM_CATEGORIES = Object.freeze({
    PRODUCT: "product",
    EMAIL: "email",
    RESULT: "result",
    ARTICLE: "article",
    MESSAGE: "message",
    BUTTON: "button",
    LINK: "link",
    OPTION: "option",
    CHECKBOX: "checkbox",
    CARD: "card",
    ROW: "row",
    ITEM: "item",
    PERSON: "person",
    PROFILE: "profile",
    GENERIC: "generic"
  });

  // Common product-related nouns
  const PRODUCT_NOUNS = [
    "product", "item", "earbuds", "headphones", "shoes", "shoe", "laptop",
    "phone", "backpack", "jacket", "watch", "camera", "tablet", "device",
    "dress", "shirt", "book", "gadget", "accessory", "listing"
  ];

  // Common email/message nouns
  const EMAIL_NOUNS = [
    "email", "mail", "message", "conversation", "thread", "inbox item", "letter"
  ];

  // Common search result nouns
  const RESULT_NOUNS = [
    "result", "search result", "entry", "hit", "match", "listing"
  ];

  // Common article nouns
  const ARTICLE_NOUNS = [
    "article", "post", "story", "blog post", "news", "headline"
  ];

  // Colors dictionary
  const COLOR_TERMS = [
    "black", "white", "blue", "red", "green", "silver", "gold", "yellow",
    "purple", "orange", "grey", "gray", "pink", "brown", "midnight black",
    "space gray", "rose gold"
  ];

  /**
   * Currency and price extraction from text string.
   * Handles formats: $19.99, ₹1,499, €25.50, £10, 19.99 USD, 50.00, etc.
   * @param {string} text
   * @returns {number|null} Price as a floating point number or null if not found
   */
  function extractPrice(text) {
    if (!text || typeof text !== "string") return null;
    const priceMatch = text.match(/(?:[\$₹€£¥]|(?:rs\.?|usd|eur|inr|gbp)\s*)(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/i) ||
      text.match(/(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)\s*(?:usd|eur|inr|gbp|bucks|dollars|rupees)/i);

    if (priceMatch) {
      const cleanNum = priceMatch[1].replace(/,/g, "");
      const val = parseFloat(cleanNum);
      return !isNaN(val) && val >= 0 ? val : null;
    }
    return null;
  }

  /**
   * Rating extraction from text string.
   * Handles formats: "4.5 out of 5", "★ 4.8", "4.2 stars", "Rating: 4.6"
   * @param {string} text
   * @returns {number|null} Rating as floating point number or null
   */
  function extractRating(text) {
    if (!text || typeof text !== "string") return null;
    const ratingMatch = text.match(/(\d(?:\.\d)?)\s*(?:out\s+of\s+5|\/\s*5|stars?|\*|★)/i) ||
      text.match(/(?:rating|score|rated)[:\s]+(\d(?:\.\d)?)/i) ||
      text.match(/[★⭐]\s*(\d(?:\.\d)?)/i);

    if (ratingMatch) {
      const val = parseFloat(ratingMatch[1]);
      return !isNaN(val) && val >= 0 && val <= 5 ? val : null;
    }
    return null;
  }

  /**
   * Date or timestamp recency score extraction from text.
   * Higher number = more recent.
   * @param {string} text
   * @param {number} documentIndex
   * @returns {number}
   */
  function extractRecencyScore(text, documentIndex = 0) {
    let score = 1000 - documentIndex;
    if (!text) return score;

    const lower = text.toLowerCase();
    if (/\b(?:just now|mins? ago|minutes? ago|moments? ago|seconds? ago)\b/i.test(lower)) {
      score += 500;
    } else if (/\b(?:yesterday)\b/i.test(lower)) {
      score += 100;
    } else if (/\b(?:hours? ago|today|\b\d{1,2}:\d{2}\s*(?:am|pm)\b)\b/i.test(lower)) {
      score += 300;
    } else if (/\b(?:unread|new)\b/i.test(lower)) {
      score += 200;
    }

    return score;
  }

  /**
   * Checks whether a target hint represents a semantic phrase rather than a literal DOM label.
   * @param {string} phrase
   * @returns {boolean}
   */
  function isSemanticInstruction(phrase) {
    if (!phrase || typeof phrase !== "string") return false;
    const lower = phrase.toLowerCase().trim();

    // Ordinals & relative items
    if (/\b(?:first|second|third|fourth|fifth|last|1st|2nd|3rd|4th|5th)\s+(?:result|product|item|email|mail|message|article|card|row|option|one|element|button|link)\b/i.test(lower)) return true;
    if (/^(?:the\s+)?(?:first|second|third|last|1st|2nd|3rd|cheapest|latest|most\s+recent|highest\s+rated)\s+one$/i.test(lower)) return true;

    // Rankings & superlatives
    if (/\b(?:cheapest|lowest\s+price|most\s+expensive|highest\s+price|highest\s+rated|top\s+rated|lowest\s+rated|latest|most\s+recent|newest|oldest)\b/i.test(lower)) return true;

    // Spatial relationships
    if (/\b(?:below|above|next\s+to|beside|left\s+of|right\s+of|on\s+the\s+right|on\s+the\s+left|at\s+the\s+top|at\s+the\s+bottom)\b/i.test(lower)) return true;

    // Relative indicators
    if (/\b(?:this\s+(?:email|mail|product|item|message|page)|currently\s+open|the\s+selected\s+item)\b/i.test(lower)) return true;

    // Textual filters
    if (/\b(?:containing|labelled|labeled|with\s+text|named|from\s+[a-zA-Z]+)\b/i.test(lower)) return true;

    // Attribute descriptions: e.g. "black earbuds", "cheapest product"
    for (const color of COLOR_TERMS) {
      if (lower.startsWith(color + " ") || lower.includes(" " + color + " ")) {
        for (const noun of PRODUCT_NOUNS) {
          if (lower.includes(noun)) return true;
        }
      }
    }

    // Generic category phrases like "the email", "the product", "the latest email"
    if (/^(?:the\s+)?(?:email|product|result|article|message|cheapest\s+one|latest\s+one|first\s+one)$/i.test(lower)) return true;

    // Contextual references & pronouns to previously established entities
    if (CONTEXTUAL_REFERENCE_PATTERN.test(lower)) return true;
    if (/\b(?:his|her|their|its)\s+(?:profile|page|product|item|email|post)\b/i.test(lower)) return true;
    if (/^(?:open|view|visit|see|choose|select)\s+(?:his|her|their|its|that|this|the)\s+(?:profile|product\s+page|page|person|product|item|email|mail|message|post|result|card|listing|link)$/i.test(lower)) return true;
    if (/^(?:open|view|visit|see|choose|select)\s+(?:it|that|this|them)$/i.test(lower)) return true;

    return false;
  }

  const CONTEXTUAL_REFERENCE_PATTERN = /^(?:(?:his|her|their|its|this|that|the)\s+)?(?:profile|product(?:\s+page)?|page|item|email|mail|message|post|result|first\s+result|person)$|\b(?:his|her|their|its|that|this|the)\s+(?:profile|product\s+page|page|person|product|item|email|mail|message|post|result|one|card|listing|link)\b|\b(?:his|her|their|its)\s+profile\b|\b(?:this|that|the)\s+person\b|\b(?:its\s+product\s+page|that\s+profile|their\s+profile)\b/i;

  function isContextualReference(text) {
    if (!text || typeof text !== "string") return false;
    const t = text.trim().toLowerCase();
    return CONTEXTUAL_REFERENCE_PATTERN.test(t) || isPronounOrReference(t);
  }

  function isPronounOrReference(text) {
    if (!text || typeof text !== "string") return false;
    return /^(?:it|this|that|them|here|the\s+item|the\s+one|one|element)$/i.test(text.trim());
  }

  /**
   * Builds the formal Structural Semantic Target Object as defined in Section 1.
   * Representing intent conceptually rather than as a literal DOM label query.
   *
   * @param {Object} descriptor
   * @param {Object} [stepPlan]
   * @returns {Object} Structured Semantic Target Object
   */
  function buildSemanticTargetObject(descriptor, stepPlan = {}) {
    if (!descriptor) return null;
    const rawAction = (stepPlan.action || stepPlan.type || "CLICK").toUpperCase();
    let action = rawAction;
    const phrase = descriptor.rawPhrase || stepPlan.targetHint || "";
    const firstWord = phrase.trim().split(/\s+/)[0].toUpperCase();
    if (["FIND", "LOCATE", "LOOK", "OPEN", "SELECT", "CLICK", "CHECK", "CHOOSE"].includes(firstWord)) {
      action = firstWord === "LOCATE" || firstWord === "LOOK" ? "FIND" : firstWord;
    }

    const entity = descriptor.category || "generic";
    const description = descriptor.objectTarget || descriptor.rawPhrase || entity;

    const attributes = {};
    if (descriptor.attribute && descriptor.attributeValue) {
      attributes[descriptor.attribute] = descriptor.attributeValue;
    }

    let selector = null;
    if (descriptor.ranking === "cheapest") {
      selector = { type: "minimum", attribute: "price" };
    } else if (descriptor.ranking === "most_expensive") {
      selector = { type: "maximum", attribute: "price" };
    } else if (descriptor.ranking === "highest_rated") {
      selector = { type: "maximum", attribute: "rating" };
    } else if (descriptor.ranking === "lowest_rated") {
      selector = { type: "minimum", attribute: "rating" };
    } else if (descriptor.ranking === "latest" || descriptor.ranking === "most_recent") {
      selector = { type: "most_recent" };
    } else if (descriptor.ranking === "oldest") {
      selector = { type: "oldest" };
    } else if (descriptor.ordinal !== null && descriptor.ordinal !== undefined) {
      selector = { type: "ordinal", index: descriptor.ordinal };
    } else if (descriptor.spatial) {
      selector = {
        type: "spatial",
        relation: descriptor.spatial.relation || descriptor.spatial.position,
        reference: descriptor.spatial.referenceTarget || null
      };
    }

    const obj = {
      action: action,
      entity: entity,
      description: description,
      context: "current_page"
    };

    if (descriptor.targetEntity || stepPlan.targetEntity) {
      obj.targetEntity = descriptor.targetEntity || stepPlan.targetEntity;
    }
    if (descriptor.targetIntent || stepPlan.targetIntent) {
      obj.targetIntent = descriptor.targetIntent || stepPlan.targetIntent;
    }

    if (Object.keys(attributes).length > 0) {
      obj.attributes = attributes;
    }
    if (selector) {
      obj.selector = selector;
    }

    return obj;
  }

  /**
   * Extracts a structured semantic descriptor from a user's target phrase.
   * @param {string} phrase
   * @param {Object} [basePlan]
   * @returns {Object} Structured Semantic Target Descriptor (Layer 2)
   */
  function extractSemanticDescriptor(phrase, basePlan = {}) {
    if (!phrase || typeof phrase !== "string") {
      return {
        isSemantic: false,
        category: ITEM_CATEGORIES.GENERIC,
        ranking: null,
        ordinal: null,
        spatial: null,
        attribute: null,
        attributeValue: null,
        objectTarget: null,
        contentFilter: null,
        senderFilter: null,
        referenceContext: null,
        rawPhrase: phrase,
        normalizedTarget: ""
      };
    }

    const LOCATION_SUFFIX_PATTERN = /\s+(?:on\s+(?:the\s+)?(?:screen|page|webpage|site)|on\s+screen|here|in\s+(?:the\s+)?page)$/i;
    const lower = phrase.toLowerCase().trim();
    let cleanText = lower.replace(/^(?:the|a|an|that|this)\s+/i, "").replace(LOCATION_SUFFIX_PATTERN, "").trim();

    // 1. Determine Category
    let category = ITEM_CATEGORIES.GENERIC;
    let objectTarget = null;

    if (PRODUCT_NOUNS.some(n => cleanText.includes(n))) {
      category = ITEM_CATEGORIES.PRODUCT;
      for (const n of PRODUCT_NOUNS) {
        if (cleanText.includes(n)) { objectTarget = n; break; }
      }
    } else if (EMAIL_NOUNS.some(n => cleanText.includes(n))) {
      category = ITEM_CATEGORIES.EMAIL;
      objectTarget = "email";
    } else if (RESULT_NOUNS.some(n => cleanText.includes(n))) {
      category = ITEM_CATEGORIES.RESULT;
      objectTarget = "result";
    } else if (ARTICLE_NOUNS.some(n => cleanText.includes(n))) {
      category = ITEM_CATEGORIES.ARTICLE;
      objectTarget = "article";
    } else if (/\bbutton\b/i.test(cleanText)) {
      category = ITEM_CATEGORIES.BUTTON;
      objectTarget = "button";
    } else if (/\blink\b/i.test(cleanText)) {
      category = ITEM_CATEGORIES.LINK;
      objectTarget = "link";
    } else if (/\boption\b/i.test(cleanText)) {
      category = ITEM_CATEGORIES.OPTION;
      objectTarget = "option";
    } else if (/\bcheckbox\b/i.test(cleanText)) {
      category = ITEM_CATEGORIES.CHECKBOX;
      objectTarget = "checkbox";
    } else if (/\b(?:profile|person)\b/i.test(cleanText) || /\b(?:his|her|their)\s+profile\b/i.test(lower)) {
      category = ITEM_CATEGORIES.PERSON;
      objectTarget = "profile";
    }

    let targetEntity = basePlan.targetEntity || null;
    let targetIntent = basePlan.targetIntent || null;
    if (CONTEXTUAL_REFERENCE_PATTERN.test(lower) || /\b(?:his|her|their|its)\s+profile\b/i.test(lower)) {
      if (/\b(?:profile|his|her|their|person)\b/i.test(lower)) {
        category = ITEM_CATEGORIES.PERSON;
        targetIntent = targetIntent || "profile";
      } else if (/\b(?:product\s+page|product|item)\b/i.test(lower)) {
        category = ITEM_CATEGORIES.PRODUCT;
        targetIntent = targetIntent || "product_page";
      } else if (/\b(?:email|message)\b/i.test(lower)) {
        category = ITEM_CATEGORIES.EMAIL;
        targetIntent = targetIntent || "email";
      } else if (/\b(?:result)\b/i.test(lower)) {
        category = ITEM_CATEGORIES.RESULT;
        targetIntent = targetIntent || "result";
      }
    }

    // 2. Ranking & Superlatives
    let ranking = basePlan.ranking || null;
    if (/\b(?:cheapest|lowest\s+price)\b/i.test(lower)) ranking = "cheapest";
    else if (/\b(?:most\s+expensive|highest\s+price)\b/i.test(lower)) ranking = "most_expensive";
    else if (/\b(?:highest\s+rated|top\s+rated)\b/i.test(lower)) ranking = "highest_rated";
    else if (/\b(?:lowest\s+rated)\b/i.test(lower)) ranking = "lowest_rated";
    else if (/\b(?:latest|most\s+recent|newest)\b/i.test(lower)) ranking = "latest";
    else if (/\b(?:oldest)\b/i.test(lower)) ranking = "oldest";

    // 3. Ordinals
    let ordinal = typeof basePlan.ordinal === "number" ? basePlan.ordinal : null;
    if (ordinal === null) {
      if (/\b(?:first|1st)\b/i.test(lower)) ordinal = 1;
      else if (/\b(?:second|2nd)\b/i.test(lower)) ordinal = 2;
      else if (/\b(?:third|3rd)\b/i.test(lower)) ordinal = 3;
      else if (/\b(?:fourth|4th)\b/i.test(lower)) ordinal = 4;
      else if (/\b(?:fifth|5th)\b/i.test(lower)) ordinal = 5;
      else if (/\b(?:last)\b/i.test(lower)) ordinal = -1;
    }

    // 4. Spatial Relationships
    let spatial = basePlan.spatial || null;
    const belowMatch = lower.match(/(?:button|link|element|item|option)?\s*(?:below|under)\s+(?:the\s+)?(.+)$/i);
    const aboveMatch = lower.match(/(?:button|link|element|item|option)?\s*(?:above)\s+(?:the\s+)?(.+)$/i);
    const nextToMatch = lower.match(/(?:button|link|element|item|option)?\s*(?:next\s+to|beside)\s+(?:the\s+)?(.+)$/i);
    const onRightMatch = /\b(?:on\s+the\s+right|to\s+the\s+right)\b/i.test(lower);
    const onLeftMatch = /\b(?:on\s+the\s+left|to\s+the\s+left)\b/i.test(lower);

    if (belowMatch) {
      spatial = { relation: "below", referenceTarget: belowMatch[1].trim() };
    } else if (aboveMatch) {
      spatial = { relation: "above", referenceTarget: aboveMatch[1].trim() };
    } else if (nextToMatch) {
      spatial = { relation: "nextTo", referenceTarget: nextToMatch[1].trim() };
    } else if (onRightMatch) {
      spatial = { relation: "rightOf", position: "right", referenceTarget: null };
    } else if (onLeftMatch) {
      spatial = { relation: "leftOf", position: "left", referenceTarget: null };
    }

    // 5. Attributes (Color, Size)
    let attribute = basePlan.attribute || null;
    let attributeValue = basePlan.attributeValue || null;
    for (const color of COLOR_TERMS) {
      if (new RegExp(`\\b${color}\\b`, "i").test(lower)) {
        attribute = "color";
        attributeValue = color;
        break;
      }
    }

    // 6. Content filter: containing 'X', labelled 'Y'
    let contentFilter = basePlan.contentFilter || null;
    const containingMatch = phrase.match(/containing\s+['"]?([^'"]+?)['"]?(?:\s|$)/i);
    const labelledMatch = phrase.match(/(?:labelled|labeled|with\s+text|named)\s+['"]?([^'"]+?)['"]?(?:\s|$)/i);
    if (containingMatch) contentFilter = containingMatch[1].trim();
    else if (labelledMatch) contentFilter = labelledMatch[1].trim();

    // 7. Sender filter: from X
    let senderFilter = basePlan.senderFilter || null;
    const fromMatch = phrase.match(/from\s+([a-zA-Z0-9_\-\s]+?)(?:\s+(?:about|regarding)|$)/i);
    if (fromMatch) senderFilter = fromMatch[1].trim();

    // 8. Reference context
    let referenceContext = null;
    if (/\b(?:this\s+(?:email|mail|product|item|message|page)|currently\s+open)\b/i.test(lower)) {
      referenceContext = "current";
    }

    // If objectTarget was not found in nouns but cleanText has an object description after attribute
    if (!objectTarget && attributeValue) {
      const remainder = cleanText.replace(new RegExp(`\\b${attributeValue}\\b`, "i"), "").trim();
      if (remainder && !isPronounOrReference(remainder)) {
        objectTarget = remainder;
      }
    }

    const isSemantic = Boolean(
      ranking ||
      (ordinal !== null && ordinal !== undefined) ||
      spatial ||
      (attribute && attributeValue) ||
      contentFilter ||
      senderFilter ||
      referenceContext ||
      targetEntity ||
      isContextualReference(phrase) ||
      isSemanticInstruction(phrase)
    );

    const descriptor = {
      isSemantic,
      category,
      ranking,
      ordinal,
      spatial,
      attribute,
      attributeValue,
      objectTarget,
      contentFilter,
      senderFilter,
      referenceContext,
      targetEntity,
      targetIntent,
      rawPhrase: phrase,
      normalizedTarget: cleanText
    };

    descriptor.semanticTargetObject = buildSemanticTargetObject(descriptor, basePlan);
    return descriptor;
  }

  /**
   * Helper: checks if candidate element matches the category/role.
   * @param {Object} el
   * @param {string} category
   * @returns {boolean}
   */
  function matchesCategory(el, category) {
    if (!el) return false;
    const type = (el.type || "").toLowerCase();
    const role = (el.role || "").toLowerCase();
    const fullText = [el.label, el.text, el.title, el.ariaLabel, el.alt].filter(Boolean).map(normalize).join(" ");

    if (category === ITEM_CATEGORIES.BUTTON) {
      return type === "button" || role === "button" || el.semanticTag === "BUTTON";
    }
    if (category === ITEM_CATEGORIES.LINK) {
      return type === "link" || role === "link";
    }
    if (category === ITEM_CATEGORIES.OPTION || category === ITEM_CATEGORIES.CHECKBOX) {
      return ["option", "checkbox", "radio", "switch", "tab"].includes(type) ||
        ["option", "checkbox", "radio", "switch", "tab"].includes(role) ||
        type === "button" || type === "element";
    }

    if (category === ITEM_CATEGORIES.EMAIL) {
      const hasEmailIndicators = /inbox|mail|message|sender|subject|unread|starred|draft|sent|reply/i.test(fullText) ||
        el.className?.includes("email") || el.className?.includes("mail") || el.className?.includes("message") ||
        el.role === "row" || el.role === "listitem" || el.type === "link" || el.type === "element";
      return hasEmailIndicators;
    }

    if (category === ITEM_CATEGORIES.PRODUCT) {
      const hasPrice = extractPrice(fullText) !== null;
      const hasProductKeywords = PRODUCT_NOUNS.some(n => fullText.includes(n));
      const isCardOrLink = type === "link" || type === "element" || role === "article" || role === "listitem";
      return hasPrice || hasProductKeywords || isCardOrLink;
    }

    if (category === ITEM_CATEGORIES.RESULT) {
      return type === "link" || type === "heading" || type === "element" || role === "heading" || role === "link";
    }

    if (category === ITEM_CATEGORIES.ARTICLE) {
      return type === "link" || type === "heading" || type === "element" || role === "article";
    }

    return true;
  }

  /**
   * Spatial Relationship Resolver: Finds candidates that satisfy spatial constraint relative to a reference.
   * @param {Array<Object>} candidates
   * @param {Object} spatialConstraint
   * @param {Array<Object>} allElements
   * @returns {Array<{ el: Object, score: number, distance: number }>}
   */
  function filterBySpatialRelation(candidates, spatialConstraint, allElements) {
    if (!spatialConstraint) return candidates.map((el, i) => ({ el, score: 1.0, distance: i }));

    const { relation, referenceTarget, position } = spatialConstraint;

    // Position-only (e.g. "on the right", "on the left")
    if (position === "right") {
      return [...candidates]
        .map((el) => ({
          el,
          score: 0.95,
          val: (el.x !== undefined ? el.x : (el.bounds ? el.bounds.x : 0))
        }))
        .sort((a, b) => b.val - a.val);
    }
    if (position === "left") {
      return [...candidates]
        .map((el) => ({
          el,
          score: 0.95,
          val: (el.x !== undefined ? el.x : (el.bounds ? el.bounds.x : 0))
        }))
        .sort((a, b) => a.val - b.val);
    }

    if (!referenceTarget) return candidates.map((el, i) => ({ el, score: 1.0, distance: i }));

    const refNorm = normalize(referenceTarget);

    let refEl = null;
    for (const el of allElements) {
      const elType = (el.type || "").toLowerCase();
      const labelNorm = normalize(el.label);
      const textNorm = normalize(el.text);

      if (refNorm === "heading" || refNorm === "the heading") {
        if (elType === "heading" || el.tagName?.startsWith("h") || el.role === "heading") {
          refEl = el;
          break;
        }
      } else if (refNorm === "price" || refNorm === "the price") {
        if (extractPrice(labelNorm) !== null || extractPrice(textNorm) !== null) {
          refEl = el;
          break;
        }
      } else if (refNorm.includes("email")) {
        if (elType === "input" && (labelNorm.includes("email") || el.name?.includes("email"))) {
          refEl = el;
          break;
        }
      } else {
        if (labelNorm.includes(refNorm) || textNorm.includes(refNorm) || (el.ariaLabel && normalize(el.ariaLabel).includes(refNorm))) {
          refEl = el;
          break;
        }
      }
    }

    if (!refEl) {
      return [];
    }

    const refBox = refEl.bounds || { x: refEl.x || 0, y: refEl.y || 0, width: refEl.width || 100, height: refEl.height || 30 };
    const refBottom = refBox.y + refBox.height;
    const refRight = refBox.x + refBox.width;
    const refCenterY = refBox.y + refBox.height / 2;
    const refCenterX = refBox.x + refBox.width / 2;

    const matched = [];

    for (const cand of candidates) {
      if (cand === refEl || (cand.index !== undefined && cand.index === refEl.index)) continue;
      const cBox = cand.bounds || { x: cand.x || 0, y: cand.y || 0, width: cand.width || 50, height: cand.height || 30 };
      const cCenterY = cBox.y + cBox.height / 2;
      const cCenterX = cBox.x + cBox.width / 2;

      if (relation === "below") {
        if (cBox.y >= refBox.y || cBox.y >= refBottom - 5) {
          const dy = cBox.y - refBottom;
          const dx = Math.abs(cCenterX - refCenterX);
          const distance = Math.max(0, dy) * 1.5 + dx;
          matched.push({ el: cand, score: 0.95, distance });
        }
      } else if (relation === "above") {
        if (cBox.y + cBox.height <= refBox.y + 5) {
          const dy = refBox.y - (cBox.y + cBox.height);
          const dx = Math.abs(cCenterX - refCenterX);
          const distance = Math.max(0, dy) * 1.5 + dx;
          matched.push({ el: cand, score: 0.95, distance });
        }
      } else if (relation === "nextTo" || relation === "beside") {
        const vOverlap = Math.abs(cCenterY - refCenterY) <= Math.max(refBox.height, cBox.height, 40);
        if (vOverlap) {
          const dx = Math.abs(cCenterX - refCenterX);
          matched.push({ el: cand, score: 0.95, distance: dx });
        }
      } else if (relation === "rightOf") {
        if (cBox.x >= refBox.x) {
          const dx = cBox.x - refRight;
          const dy = Math.abs(cCenterY - refCenterY);
          matched.push({ el: cand, score: 0.95, distance: Math.max(0, dx) + dy });
        }
      } else if (relation === "leftOf") {
        if (cBox.x + cBox.width <= refBox.x + 5) {
          const dx = refBox.x - (cBox.x + cBox.width);
          const dy = Math.abs(cCenterY - refCenterY);
          matched.push({ el: cand, score: 0.95, distance: Math.max(0, dx) + dy });
        }
      }
    }

    matched.sort((a, b) => a.distance - b.distance);
    return matched;
  }

  /**
   * Main Semantic Target Resolution Function.
   * Translates Layer 2 Semantic Target into Layer 3 Concrete Target Element.
   *
   * @param {Object} currentStepPlan - Planned step with semantic metadata
   * @param {Array<Object>} candidates - Available perceived visual/fused elements
   * @param {Object} [perceptionContext] - Page metadata, all elements, OCR text, spatial relations
   * @returns {Object} Resolution result
   */
  function resolveSemanticTarget(currentStepPlan, candidates, perceptionContext = {}) {
    if (!candidates || !Array.isArray(candidates) || candidates.length === 0) {
      return {
        action: "NONE",
        target: null,
        targetIndex: -1,
        groundingScore: 0,
        groundingMethod: "target-not-found",
        reason: "No candidate elements available on page"
      };
    }

    const rawPhrase = (
      (currentStepPlan && (currentStepPlan.explicitTarget || currentStepPlan.targetHint || currentStepPlan.target || currentStepPlan.semanticTarget)) ||
      ""
    ).trim();

    // 1. Build Layer 2 Semantic Target Descriptor
    const descriptor = extractSemanticDescriptor(rawPhrase, currentStepPlan);

    // If step is NOT a semantic instruction (e.g. "Click Compose", "Click Login"), pass through
    if (!descriptor.isSemantic && !currentStepPlan.isSemantic && !currentStepPlan.attribute) {
      return {
        action: "PASS_THROUGH",
        groundingScore: 0,
        groundingMethod: "literal-candidate"
      };
    }

    const allElements = perceptionContext.allElements || candidates;

    // 2. Identify candidate elements matching Category / Role / Interactive structure
    let matchingCandidates = candidates.filter((el) => {
      if (el.disabled || String(el["aria-disabled"]).toLowerCase() === "true") return false;
      if (["product", "email", "result", "article"].includes(descriptor.category)) {
        if (/^(?:home|about|contact|privacy|terms|careers|help|support|feedback)$/i.test(normalize(el.label))) {
          return false;
        }
      }
      return matchesCategory(el, descriptor.category);
    });

    if (matchingCandidates.length === 0) {
      matchingCandidates = candidates.filter(el => !el.disabled);
    }

    // 3. Filter by Object Target / Category Nouns (if present)
    if (descriptor.objectTarget && !["product", "email", "result", "item", "article", "button", "link", "option", "checkbox", "one", "element"].includes(descriptor.objectTarget)) {
      const objNorm = normalize(descriptor.objectTarget);
      const objTokens = objNorm.split(/\s+/).filter(t => t.length > 2);
      const filteredByObj = matchingCandidates.filter((el) => {
        const fullText = [el.label, el.text, el.title, el.ariaLabel, el.alt].filter(Boolean).map(normalize).join(" ");
        return fullText.includes(objNorm) || (objTokens.length > 0 && objTokens.every(t => fullText.includes(t)));
      });
      if (filteredByObj.length > 0) {
        matchingCandidates = filteredByObj;
      }
    }

    // 4. Filter by Attributes (Color, etc.)
    if (descriptor.attribute && descriptor.attributeValue) {
      const attrValNorm = normalize(descriptor.attributeValue);
      const verifiedAttrMatches = [];
      let objectFoundWithoutAttr = false;

      matchingCandidates.forEach((el) => {
        const candParts = [
          el.label, el.text, el.ariaLabel, el.title, el.alt, el.dataColor, el.visualColor, el.color, el.visualClassification, el.placeholder
        ].filter(Boolean).map(normalize);
        const candFullText = candParts.join(" ");

        const matchesAttr = candFullText.includes(attrValNorm) ||
          (el.dataColor && normalize(el.dataColor).includes(attrValNorm)) ||
          (el.visualColor && normalize(el.visualColor).includes(attrValNorm)) ||
          (el.color && normalize(el.color).includes(attrValNorm)) ||
          (el.visualClassification && normalize(el.visualClassification).includes(attrValNorm));
        if (matchesAttr) {
          verifiedAttrMatches.push(el);
        } else {
          objectFoundWithoutAttr = true;
        }
      });

      if (verifiedAttrMatches.length === 0) {
        if (objectFoundWithoutAttr) {
          return {
            action: "NONE",
            target: null,
            targetIndex: -1,
            groundingScore: 0,
            groundingMethod: "attribute-not-verified",
            reason: `Target attribute not verified: object '${descriptor.objectTarget || "item"}' found on page, but attribute '${descriptor.attribute} = ${descriptor.attributeValue}' has insufficient evidence`,
            blockedReason: `Object found: ${descriptor.objectTarget || "item"}, Requested attribute: ${descriptor.attribute} = ${descriptor.attributeValue}, Attribute evidence: insufficient, Confidence: below threshold, Action: BLOCKED`
          };
        }
        return {
          action: "NONE",
          target: null,
          targetIndex: -1,
          groundingScore: 0,
          groundingMethod: "target-not-found",
          reason: `No candidates found matching '${descriptor.attributeValue} ${descriptor.objectTarget || ""}'`
        };
      }
      matchingCandidates = verifiedAttrMatches;
    }

    // 5. Filter by Content / Textual Filter (e.g. containing 'AI agents', labelled 'premium')
    if (descriptor.contentFilter) {
      const filterNorm = normalize(descriptor.contentFilter);
      const contentMatches = matchingCandidates.filter((el) => {
        const fullText = [el.label, el.text, el.title, el.ariaLabel, el.alt].filter(Boolean).map(normalize).join(" ");
        return fullText.includes(filterNorm);
      });
      if (contentMatches.length === 0) {
        return {
          action: "NONE",
          target: null,
          targetIndex: -1,
          groundingScore: 0,
          groundingMethod: "target-not-found",
          reason: `No candidate elements found containing text '${descriptor.contentFilter}'`
        };
      }
      matchingCandidates = contentMatches;
    }

    // 6. Filter by Sender (e.g. "from Rahul")
    if (descriptor.senderFilter) {
      const senderNorm = normalize(descriptor.senderFilter);
      const senderMatches = matchingCandidates.filter((el) => {
        const fullText = [el.label, el.text, el.title, el.ariaLabel].filter(Boolean).map(normalize).join(" ");
        return fullText.includes(senderNorm);
      });
      if (senderMatches.length === 0) {
        return {
          action: "NONE",
          target: null,
          targetIndex: -1,
          groundingScore: 0,
          groundingMethod: "target-not-found",
          reason: `No items found from '${descriptor.senderFilter}'`
        };
      }
      if (senderMatches.length > 1 && descriptor.ordinal === null && descriptor.ranking === null) {
        return {
          action: "NONE",
          target: null,
          targetIndex: -1,
          groundingScore: 0,
          groundingMethod: "ambiguous-semantic-targets",
          reason: `Target ambiguous: multiple items (${senderMatches.length}) found from '${descriptor.senderFilter}' without distinguishing evidence`
        };
      }
      matchingCandidates = senderMatches;
    }

    // 6b. Section 6 Priority-based Entity Resolution (e.g. person = "Sundar Pichai", product = "Amazon Echo", sender = "Rahul")
    const entityObj = currentStepPlan.targetEntity || descriptor.targetEntity || perceptionContext.currentEntity || (currentStepPlan.query ? { type: descriptor.category || "item", name: currentStepPlan.query } : null);

    if (entityObj && entityObj.name) {
      const entityNameNorm = normalize(entityObj.name);
      const entityTokens = entityNameNorm.split(/\s+/).filter(t => t.length > 1 && !["official", "website", "the", "page", "result", "profile", "product"].includes(t));

      const entityMatches = matchingCandidates.filter((el) => {
        const fullText = [el.label, el.text, el.title, el.ariaLabel, el.alt].filter(Boolean).map(normalize).join(" ");
        return fullText.includes(entityNameNorm) || (entityTokens.length > 0 && entityTokens.every(t => fullText.includes(t)));
      });

      if (entityMatches.length === 0) {
        return {
          action: "NONE",
          target: null,
          targetIndex: -1,
          groundingScore: 0,
          groundingMethod: "target-not-found",
          reason: `Target entity '${entityObj.name}' not found on current page perception.`,
          blockedReason: `Entity '${entityObj.name}' (${entityObj.type || "item"}) not found. Action: BLOCKED`
        };
      }

      // Prioritize direct interactive candidates (link, button, heading, clickable)
      let candidatePool = entityMatches;
      const interactiveMatches = entityMatches.filter(el => {
        const role = (el.type || el.role || "").toLowerCase();
        return el.clickable || el.href || ["link", "button", "heading"].includes(role);
      });
      if (interactiveMatches.length > 0) {
        candidatePool = interactiveMatches;
      }

      // Check if multiple candidates are ambiguous without an explicit ordinal
      if (candidatePool.length > 1 && (descriptor.ordinal === null || descriptor.ordinal === undefined)) {
        const exactMatches = candidatePool.filter(el => {
          const lNorm = normalize(el.label || el.text || "");
          return lNorm === entityNameNorm;
        });

        const hasDistinctEntities = candidatePool.some(el => {
          const l = normalize(el.label || el.text || "");
          return /\b(?:foundation|trust|fan\s+page|inc|ltd|corp|corporation|group|parody|updates)\b/i.test(l);
        });

        if (hasDistinctEntities || exactMatches.length > 1) {
          return {
            action: "NONE",
            target: null,
            targetIndex: -1,
            groundingScore: 0,
            groundingMethod: "ambiguous-semantic-targets",
            reason: `Target ambiguous: multiple candidates (${candidatePool.length}) found for entity '${entityObj.name}' without distinguishing criteria`,
            blockedReason: `Multiple matching candidates found for entity '${entityObj.name}'. Action: BLOCKED`
          };
        } else if (exactMatches.length === 1) {
          matchingCandidates = exactMatches;
        } else {
          matchingCandidates = candidatePool;
        }
      } else {
        matchingCandidates = candidatePool;
      }
    }

    // 7. Filter / Rank by Spatial Relationships (e.g. "button below heading", "product on right", "option next to Premium")
    if (descriptor.spatial) {
      const spatialRanked = filterBySpatialRelation(matchingCandidates, descriptor.spatial, allElements);
      if (spatialRanked.length === 0) {
        return {
          action: "NONE",
          target: null,
          targetIndex: -1,
          groundingScore: 0,
          groundingMethod: "target-not-found",
          reason: `No elements found matching spatial relation '${descriptor.spatial.relation || descriptor.spatial.position}' relative to '${descriptor.spatial.referenceTarget || "page"}'`
        };
      }
      matchingCandidates = spatialRanked.map(r => r.el);
    }

    // 8. Apply Relative Ranking (e.g. cheapest, most expensive, highest rated, latest, most recent)
    if (descriptor.ranking) {
      if (descriptor.ranking === "cheapest" || descriptor.ranking === "most_expensive") {
        const pricedCandidates = [];
        matchingCandidates.forEach((el, idx) => {
          const fullText = [el.label, el.text, el.title, el.ariaLabel, el.alt].filter(Boolean).join(" ");
          let price = extractPrice(fullText);

          if (price === null) {
            const elBox = el.bounds || { x: el.x || 0, y: el.y || 0, width: el.width || 100, height: el.height || 50 };
            for (const other of allElements) {
              const otherBox = other.bounds || { x: other.x || 0, y: other.y || 0, width: other.width || 50, height: other.height || 20 };
              if (Math.abs(otherBox.y - elBox.y) < 80 && Math.abs(otherBox.x - elBox.x) < elBox.width + 40) {
                const otherPrice = extractPrice(other.label || other.text || "");
                if (otherPrice !== null) {
                  price = otherPrice;
                  break;
                }
              }
            }
          }

          if (price !== null) {
            pricedCandidates.push({ el, price, idx });
          }
        });

        if (pricedCandidates.length === 0) {
          return {
            action: "NONE",
            target: null,
            targetIndex: -1,
            groundingScore: 0,
            groundingMethod: "attribute-not-verified",
            reason: `Cannot extract visible prices to determine '${descriptor.ranking}' product without guessing`
          };
        }

        pricedCandidates.sort((a, b) => {
          return descriptor.ranking === "cheapest" ? (a.price - b.price) : (b.price - a.price);
        });

        matchingCandidates = pricedCandidates.map(p => p.el);
      } else if (descriptor.ranking === "highest_rated" || descriptor.ranking === "lowest_rated") {
        const ratedCandidates = [];
        matchingCandidates.forEach((el, idx) => {
          const fullText = [el.label, el.text, el.title, el.ariaLabel, el.alt].filter(Boolean).join(" ");
          const rating = extractRating(fullText);
          if (rating !== null) {
            ratedCandidates.push({ el, rating, idx });
          }
        });

        if (ratedCandidates.length === 0) {
          return {
            action: "NONE",
            target: null,
            targetIndex: -1,
            groundingScore: 0,
            groundingMethod: "attribute-not-verified",
            reason: `Cannot extract ratings to determine '${descriptor.ranking}' product without guessing`
          };
        }

        ratedCandidates.sort((a, b) => {
          return descriptor.ranking === "highest_rated" ? (b.rating - a.rating) : (a.rating - b.rating);
        });

        matchingCandidates = ratedCandidates.map(r => r.el);
      } else if (descriptor.ranking === "latest" || descriptor.ranking === "most_recent" || descriptor.ranking === "oldest") {
        const datedCandidates = matchingCandidates.map((el, i) => {
          const fullText = [el.label, el.text, el.title, el.ariaLabel].filter(Boolean).join(" ");
          const recency = extractRecencyScore(fullText, i);
          return { el, recency };
        });

        datedCandidates.sort((a, b) => {
          return descriptor.ranking === "oldest" ? (a.recency - b.recency) : (b.recency - a.recency);
        });

        matchingCandidates = datedCandidates.map(d => d.el);
      }
    }

    // 9. Apply Ordinal (first, second, last)
    let selectedCandidate = null;
    let selectedIndex = -1;

    if (descriptor.ordinal !== null && descriptor.ordinal !== undefined) {
      if (descriptor.ordinal === -1) {
        selectedIndex = matchingCandidates.length - 1;
        selectedCandidate = matchingCandidates[selectedIndex];
      } else if (descriptor.ordinal >= 1 && descriptor.ordinal <= matchingCandidates.length) {
        selectedIndex = descriptor.ordinal - 1;
        selectedCandidate = matchingCandidates[selectedIndex];
      } else {
        return {
          action: "NONE",
          target: null,
          targetIndex: -1,
          groundingScore: 0,
          groundingMethod: "target-not-found",
          reason: `Ordinal #${descriptor.ordinal} exceeds matching candidate count (${matchingCandidates.length})`
        };
      }
    } else if (descriptor.ranking || descriptor.spatial || descriptor.referenceContext === "current") {
      selectedCandidate = matchingCandidates[0];
      selectedIndex = 0;
    } else if (matchingCandidates.length === 1) {
      selectedCandidate = matchingCandidates[0];
      selectedIndex = 0;
    } else if (matchingCandidates.length > 1) {
      return {
        action: "NONE",
        target: null,
        targetIndex: -1,
        groundingScore: 0,
        groundingMethod: "ambiguous-semantic-targets",
        reason: `Target ambiguous: multiple identical '${rawPhrase}' candidates (${matchingCandidates.length}) found on page without distinguishing criteria`,
        blockedReason: `Multiple '${rawPhrase}' candidates found on page. Action: BLOCKED`
      };
    }

    if (!selectedCandidate) {
      return {
        action: "NONE",
        target: null,
        targetIndex: -1,
        groundingScore: 0,
        groundingMethod: "target-not-found",
        reason: `Target '${rawPhrase}' not found on current page`
      };
    }

    const realIndex = selectedCandidate.index !== undefined ? selectedCandidate.index : candidates.indexOf(selectedCandidate);
    const concreteLabel = selectedCandidate.label || selectedCandidate.text || selectedCandidate.ariaLabel || descriptor.rawPhrase;

    const actionType = (
      (currentStepPlan && currentStepPlan.action) ||
      (currentStepPlan && currentStepPlan.type) ||
      (descriptor.category === ITEM_CATEGORIES.OPTION ? "SELECT" : "CLICK")
    ).toUpperCase();

    const hasVisualConf = Boolean(selectedCandidate.isVisualConfirmed || selectedCandidate.dataColor || selectedCandidate.visualColor);
    const resolvedMethod = hasVisualConf ? "semantic + DOM + visual fusion" : "semantic + DOM grounding";

    return {
      action: actionType,
      target: concreteLabel,
      targetIndex: realIndex >= 0 ? realIndex : 0,
      targetType: selectedCandidate.type || "element",
      targetLabel: concreteLabel,
      bounds: selectedCandidate.bounds || { x: selectedCandidate.x || 0, y: selectedCandidate.y || 0, width: selectedCandidate.width || 100, height: selectedCandidate.height || 40 },
      groundingScore: selectedCandidate.isVisualConfirmed ? 0.98 : 0.95,
      groundingMethod: resolvedMethod,
      concreteElement: selectedCandidate,
      descriptor: descriptor,
      semanticTargetObject: descriptor.semanticTargetObject || buildSemanticTargetObject(descriptor, currentStepPlan),
      targetEntity: entityObj || null,
      targetIntent: currentStepPlan.targetIntent || descriptor.targetIntent || null
    };
  }

  return {
    resolveSemanticTarget,
    isSemanticInstruction,
    isContextualReference,
    extractSemanticDescriptor,
    buildSemanticTargetObject,
    extractPrice,
    extractRating,
    extractRecencyScore,
    filterBySpatialRelation,
    ITEM_CATEGORIES
  };
});
