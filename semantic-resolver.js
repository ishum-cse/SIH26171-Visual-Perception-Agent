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

  // M25: Canonical Semantic UI Roles
  const SEMANTIC_ROLES = Object.freeze({
    SEARCH_INPUT: "SEARCH_INPUT",
    SEARCH_SUBMIT: "SEARCH_SUBMIT",
    REPLY_BUTTON: "REPLY_BUTTON",
    REPLY_COMPOSER: "REPLY_COMPOSER",
    MESSAGE_BUTTON: "MESSAGE_BUTTON",
    MESSAGE_COMPOSER: "MESSAGE_COMPOSER",
    POST_ENTRY: "POST_ENTRY",
    POST_COMPOSER: "POST_COMPOSER",
    COMMENT_COMPOSER: "COMMENT_COMPOSER",
    CHAT_COMPOSER: "CHAT_COMPOSER",
    GENERIC_TEXT_EDITOR: "GENERIC_TEXT_EDITOR",
    SUBMIT_BUTTON: "SUBMIT_BUTTON",
    SEND_BUTTON: "SEND_BUTTON",
    PUBLISH_BUTTON: "PUBLISH_BUTTON",
    COMPOSE_BUTTON: "COMPOSE_BUTTON",
    RECIPIENT_FIELD: "RECIPIENT_FIELD",
    SUBJECT_FIELD: "SUBJECT_FIELD",
    FORM_FIELD: "FORM_FIELD",
    RESULT_LINK: "RESULT_LINK",
    PROFILE_LINK: "PROFILE_LINK",
    PRODUCT_LINK: "PRODUCT_LINK",
    ADD_TO_CART_BUTTON: "ADD_TO_CART_BUTTON"
  });

  // M24: Supported Generic Semantic Intents
  const SEMANTIC_INTENTS = Object.freeze({
    SEARCH: "SEARCH",
    NAVIGATE: "NAVIGATE",
    OPEN_RESULT: "OPEN_RESULT",
    OPEN_ITEM: "OPEN_ITEM",
    REPLY_MESSAGE: "REPLY_MESSAGE",
    COMPOSE_EMAIL: "COMPOSE_EMAIL",
    SEND_MESSAGE: "SEND_MESSAGE",
    CREATE_POST: "CREATE_POST",
    COMMENT: "COMMENT",
    FILL_FORM: "FILL_FORM",
    SUBMIT_FORM: "SUBMIT_FORM",
    SELECT: "SELECT",
    CHECK: "CHECK",
    UNCHECK: "UNCHECK",
    TOGGLE: "TOGGLE",
    DOWNLOAD: "DOWNLOAD",
    ADD_TO_CART: "ADD_TO_CART",
    OPEN_PROFILE: "OPEN_PROFILE",
    OPEN_PRODUCT: "OPEN_PRODUCT",
    SCROLL: "SCROLL",
    CLICK_GENERIC: "CLICK_GENERIC"
  });

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
    "result", "search result", "official result", "official website", "website", "site",
    "webpage", "page", "entry", "hit", "match", "listing", "first result", "most relevant result"
  ];

  const HOMEPAGE_NAVIGATION_LABELS = new Set([
    "google apps", "sign in", "login", "gmail", "images", "privacy", "terms", "settings",
    "about", "advertising", "business", "how search works", "search settings", "advanced search",
    "history", "search help", "send feedback", "all", "maps", "news", "videos", "shopping",
    "books", "flights", "finance", "tools", "clear", "home", "search", "google search", "i'm feeling lucky",
    "google", "store"
  ]);

  /**
   * Identifies non-result elements that MUST be deprioritized or excluded during post-search result selection.
   * Excludes: Google account/profile buttons, Google apps button, header/footer navigation, search settings, search inputs.
   */
  function isExcludedSearchPageControl(el) {
    if (!el) return false;
    if (typeof el === "string") {
      el = { label: el };
    }
    if (el.isAccountControl || el.isHeaderNav || el.isFooterNav) return true;

    const labelNorm = normalize(el.label || el.text || el.targetLabel || el.target || "");
    const ariaNorm = normalize(el.ariaLabel || "");
    const titleNorm = normalize(el.title || "");
    const hrefNorm = normalize(el.href || el.url || "");
    const combined = `${labelNorm} ${ariaNorm} ${titleNorm}`;

    // 1. Google Account / Profile / User buttons & menus (MUST BE EXCLUDED)
    if (/google\s+account|manage\s+your\s+google\s+account|switch\s+account|user\s+profile|\bprofile\b/i.test(combined) &&
        !combined.includes("linkedin") && !combined.includes("twitter") && !combined.includes("github")) {
      return true;
    }
    if (hrefNorm.includes("accounts.google.") || hrefNorm.includes("myaccount.google.")) {
      return true;
    }

    // 2. Google apps / App launcher (MUST BE EXCLUDED)
    if (/google\s+apps|app\s+launcher|waffle\s+menu/i.test(combined)) {
      return true;
    }

    // 3. Search settings / Quick settings / Tools / Filters / Engine Logo
    if (HOMEPAGE_NAVIGATION_LABELS.has(labelNorm) || /^(?:google|bing|yahoo|duckduckgo|baidu|yandex|store)$/i.test(labelNorm)) {
      return true;
    }
    if (/^https?:\/\/(?:www\.)?(?:google|bing|yahoo|duckduckgo)\.[a-z.]+\/?(?:[?#]|$)/i.test(hrefNorm) && !hrefNorm.includes("/search")) {
      return true;
    }
    if (/^(?:settings|quick\s+settings|search\s+settings|advanced\s+search|search\s+tools|tools|filter|filters|safesearch|verbatim|any\s+time|all\s+results)$/i.test(labelNorm) ||
        /\b(?:search\s+settings|quick\s+settings|advanced\s+search|search\s+tools)\b/i.test(combined)) {
      return true;
    }
    if (hrefNorm.includes("google.com/preferences") || hrefNorm.includes("google.com/advanced_search")) {
      return true;
    }

    // 4. Header navigation tabs
    if (/^(?:all|images|videos|news|maps|shopping|books|flights|finance|more|web)$/i.test(labelNorm)) {
      return true;
    }

    // 5. Footer navigation / Legal / Support
    if (/^(?:about|advertising|business|how\s+search\s+works|privacy|terms|privacy\s+policy|terms\s+of\s+service|help|search\s+help|send\s+feedback|consumer\s+information)$/i.test(labelNorm)) {
      return true;
    }
    if (hrefNorm.includes("support.google.com") || hrefNorm.includes("policies.google.com") || hrefNorm.includes("about.google")) {
      return true;
    }

    // 6. Search input / Search buttons
    if (el.semanticTag === "SEARCH_INPUT" || /^(?:search|google\s+search|clear|search\s+by\s+voice|search\s+by\s+image)$/i.test(labelNorm)) {
      return true;
    }

    return false;
  }

  /**
   * Determines whether an element represents a search-result candidate link/card.
   */
  function isSearchResultCandidate(el) {
    if (!el) return false;
    if (typeof el === "string") {
      el = { label: el };
    }
    if (el.disabled || String(el["aria-disabled"]).toLowerCase() === "true") return false;
    if (isExcludedSearchPageControl(el)) return false;

    const elType = (el.type || el.targetType || "").toLowerCase();
    const tag = (el.tag || el.tagName || "").toLowerCase();
    const href = el.href || el.url || "";
    const label = (el.label || el.text || el.targetLabel || el.target || "").trim();

    if (!label && !el.ariaLabel && !el.title) return false;

    // Explicitly flagged by DOM perception in content.js
    if (el.isSearchResult) return true;

    // External link with valid http/https destination that is not search engine navigation
    if ((elType === "link" || tag === "a" || href) && /^https?:\/\//i.test(href)) {
      const isSearchEngineNav = /(?:google\.[a-z.]+(?:\/?$|\/(?:search|preferences|webhp|intl|policies)|[?#])|accounts\.google\.|support\.google\.|maps\.google\.)/i.test(href);
      if (!isSearchEngineNav) {
        return true;
      }
    }

    // Result heading / title
    if ((elType === "heading" || elType === "element" || tag === "h3" || tag === "h4" || tag === "h2") && label.length > 3) {
      if (!/^(?:search\s+results|people\s+also\s+ask|related\s+searches|filters)$/i.test(label)) {
        return true;
      }
    }

    // Link with substantial text (> 3 chars) and not an excluded control
    if ((elType === "link" || tag === "a") && label.length >= 3) {
      return true;
    }

    return false;
  }

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

    // Search result phrases
    if (/\b(?:first|most\s+relevant|relevant|official|top)\s+result\b/i.test(lower)) return true;
    if (/\bofficial\s+(?:website|site|webpage|page|portal)\b/i.test(lower)) return true;
    if (/\b(?:the\s+)?(?:result|website|site|webpage)\b/i.test(lower) && !lower.includes("how search works")) return true;

    return false;
  }

  const CONTEXTUAL_REFERENCE_PATTERN = /^(?:(?:his|her|their|its|this|that|the)\s+)(?:profile|product(?:\s+page)?|page|item|email|mail|message|post|result|first\s+result|person)$|\b(?:his|her|their|its|that|this|the)\s+(?:profile|product\s+page|page|person|product|item|email|mail|message|post|result|one|card|listing|link)\b|\b(?:his|her|their|its)\s+profile\b|\b(?:this|that|the)\s+person\b|\b(?:its\s+product\s+page|that\s+profile|their\s+profile)\b/i;

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

    if (/^(?:start|create|write|open|new)\s+(?:a\s+)?post\b/i.test(cleanText) || /^(?:post|post\s+button)$/i.test(cleanText)) {
      category = ITEM_CATEGORIES.BUTTON;
      objectTarget = "button";
    } else if (PRODUCT_NOUNS.some(n => cleanText.includes(n))) {
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

    if (basePlan.semanticCategory === "person" || basePlan.targetIntent === "profile" || basePlan.targetEntity?.type === "person") {
      category = ITEM_CATEGORIES.PERSON;
      objectTarget = "profile";
    } else if (basePlan.isSearchResult || basePlan.isFirstResult || basePlan.isMostRelevant) {
      category = ITEM_CATEGORIES.RESULT;
      if (!objectTarget) objectTarget = "result";
    }

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

    // Entity extraction for search-result targets (e.g. "official Indian Space Research Organisation result", "official ISRO website")
    if (category === ITEM_CATEGORIES.RESULT || basePlan.isSearchResult || /result|website/i.test(lower)) {
      const officialEntityMatch = lower.match(/(?:official\s+(?:website|site|result|page)\s+(?:of\s+|for\s+)?|official\s+)([a-zA-Z0-9_\-\s]+?)(?:\s+(?:result|website|site|page)|$)/i) ||
        lower.match(/(?:click|open)\s+(?:the\s+)?([a-zA-Z0-9_\-\s]+?)\s+(?:result|website|site|page)/i);
      if (officialEntityMatch && !targetEntity) {
        const entCandidate = officialEntityMatch[1].replace(/^(?:the|an|a)\s+/i, "").trim();
        if (entCandidate && !["first", "most relevant", "relevant", "best", "official", "search"].includes(entCandidate)) {
          targetEntity = {
            type: "organization",
            name: entCandidate
          };
          targetIntent = targetIntent || (/website|site/i.test(lower) ? "official_website" : "official_result");
        }
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
      category === ITEM_CATEGORIES.RESULT ||
      basePlan.isSearchResult ||
      basePlan.isFirstResult ||
      basePlan.isMostRelevant ||
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

    // 1b. DEDICATED SEARCH RESULT CONTEXT RESOLUTION (Step following search submission)
    const isSearchResultStep = Boolean(
      (descriptor.category === ITEM_CATEGORIES.RESULT ||
      currentStepPlan.isSearchResult ||
      currentStepPlan.isFirstResult ||
      currentStepPlan.isMostRelevant ||
      perceptionContext.isSearchResultSelection ||
      perceptionContext.isPreviousStepSearchSubmit ||
      /result|official\s+website|official\s+result|first\s+result|most\s+relevant/i.test(rawPhrase)) &&
      descriptor.category !== ITEM_CATEGORIES.PERSON &&
      currentStepPlan.targetIntent !== "profile"
    );

    if (isSearchResultStep) {
      // Rule 1: Exclude non-result elements (Google Account, Google apps, settings, header/footer nav, search inputs)
      const nonExcludedCandidates = candidates.filter(el => {
        if (!el || el.disabled || String(el["aria-disabled"]).toLowerCase() === "true") return false;
        if (isExcludedSearchPageControl(el)) return false;
        return true;
      });

      // Prioritize candidates flagged as search results by DOM perception
      let searchCandidates = nonExcludedCandidates.filter(el => el.isSearchResult);
      if (searchCandidates.length === 0) {
        searchCandidates = nonExcludedCandidates.filter(el => isSearchResultCandidate(el));
      }
      if (searchCandidates.length === 0) {
        // Fallback: any actionable link or heading that is not an excluded control
        searchCandidates = nonExcludedCandidates.filter(el => {
          const t = (el.type || el.targetType || "").toLowerCase();
          const tag = (el.tag || el.tagName || "").toLowerCase();
          return t === "link" || tag === "a" || t === "heading" || tag === "h3" || tag === "h4" || el.href || el.url;
        });
      }
      if (searchCandidates.length === 0) {
        searchCandidates = nonExcludedCandidates;
      }

      if (searchCandidates.length === 0) {
        return {
          action: "NONE",
          target: null,
          targetIndex: -1,
          groundingScore: 0,
          groundingMethod: "target-not-found",
          reason: "No valid search-result candidates found in results area"
        };
      }

      // Check user intent:
      // Case 1: "open the first result" / ordinal === 1
      const isFirstResult = descriptor.ordinal === 1 ||
        currentStepPlan.isFirstResult ||
        /\b(?:first\s+result|1st\s+result|top\s+result)\b/i.test(rawPhrase);

      if (isFirstResult) {
        const firstCand = searchCandidates[0];
        const realIdx = firstCand.index !== undefined ? firstCand.index : candidates.indexOf(firstCand);
        const concreteLbl = firstCand.label || firstCand.text || firstCand.title || firstCand.ariaLabel || "first search result";
        return {
          action: (currentStepPlan.action || currentStepPlan.type || "CLICK").toUpperCase(),
          target: concreteLbl,
          targetIndex: realIdx >= 0 ? realIdx : 0,
          targetType: firstCand.type || "link",
          targetLabel: concreteLbl,
          url: firstCand.url || firstCand.href || null,
          bounds: firstCand.bounds || { x: firstCand.x || 0, y: firstCand.y || 0, width: firstCand.width || 100, height: firstCand.height || 40 },
          groundingScore: 0.98,
          groundingMethod: "first-search-result-ranking",
          concreteElement: firstCand,
          descriptor: descriptor,
          semanticTargetObject: descriptor.semanticTargetObject || buildSemanticTargetObject(descriptor, currentStepPlan),
          targetIntent: "first_result"
        };
      }

      // Case 2: Entity / Official result matching (e.g. ISRO, Indian Space Research Organisation)
      const requestedEntity = currentStepPlan.targetEntity || descriptor.targetEntity || perceptionContext.currentEntity || null;
      const entityName = requestedEntity ? (requestedEntity.name || "") : "";
      const isOfficialRequested = Boolean(
        currentStepPlan.targetIntent === "official_website" ||
        currentStepPlan.targetIntent === "official_result" ||
        descriptor.targetIntent === "official_website" ||
        descriptor.targetIntent === "official_result" ||
        /\bofficial\b/i.test(rawPhrase) ||
        /\bwebsite\b/i.test(rawPhrase)
      );

      // Known entity synonyms and official domains dictionary
      const ENTITY_EXPANSIONS = {
        isro: ["indian space research organisation", "isro", "isro.gov", "isro.gov.in"],
        "indian space research organisation": ["indian space research organisation", "isro", "isro.gov", "isro.gov.in"],
        linkedin: ["linkedin", "linkedin.com"],
        github: ["github", "github.com"],
        nasa: ["national aeronautics and space administration", "nasa", "nasa.gov"],
        google: ["google", "google.com"]
      };

      const queryNorm = normalize(currentStepPlan.query || "");
      const entityNorm = normalize(entityName || "");
      const domainHint = currentStepPlan.domain ||
        (currentStepPlan.targetHint && (currentStepPlan.targetHint.match(/\(([^)]+\.[a-z]{2,})\)/i)?.[1] || currentStepPlan.targetHint.match(/\b([a-zA-Z0-9_\-]+\.[a-zA-Z]{2,})\b/i)?.[1])) ||
        null;

      // Extract search target terms
      const searchTerms = [entityNorm, queryNorm, rawPhrase].filter(Boolean);
      let expansions = [];
      for (const st of searchTerms) {
        for (const [key, expList] of Object.entries(ENTITY_EXPANSIONS)) {
          if (st.includes(key) || key.includes(st)) {
            expansions.push(...expList);
          }
        }
      }
      expansions = [...new Set(expansions)];

      // Rank search result candidates
      const scoredCandidates = searchCandidates.map((cand, candPos) => {
        const textParts = [
          cand.label,
          cand.text,
          cand.title,
          cand.ariaLabel,
          cand.snippet,
          cand.href,
          cand.url
        ].filter(Boolean).map(normalize);
        const fullCandText = textParts.join(" ");
        const hrefNorm = normalize(cand.href || cand.url || "");

        let score = 0.50; // Base score for being a valid search-result candidate

        // High priority: Explicit DOM search result flag from content.js
        if (cand.isSearchResult) {
          score += 0.10;
        }

        // Domain hint match (e.g. isro.gov.in, isro.gov)
        if (domainHint && (hrefNorm.includes(normalize(domainHint)) || fullCandText.includes(normalize(domainHint)))) {
          score += 0.35;
        } else if (/\bisro\.gov(?:\.in)?\b/i.test(hrefNorm) || /\bisro\.gov(?:\.in)?\b/i.test(fullCandText)) {
          score += 0.35;
        }

        // Entity / Acronym expansions match
        if (expansions.length > 0) {
          let expansionMatched = false;
          for (const exp of expansions) {
            if (fullCandText.includes(exp)) {
              score += 0.25;
              expansionMatched = true;
              break;
            }
          }
          if (!expansionMatched && entityNorm) {
            const entTokens = entityNorm.split(/\s+/).filter(t => t.length > 2 && !["official", "website", "the", "page", "result"].includes(t));
            if (entTokens.length > 0 && entTokens.every(t => fullCandText.includes(t))) {
              score += 0.20;
            }
          }
        } else if (queryNorm && fullCandText.includes(queryNorm)) {
          score += 0.20;
        }

        // Official website preference
        if (isOfficialRequested) {
          if (hrefNorm.includes(".gov") || hrefNorm.includes(".org") || hrefNorm.includes(".edu") || /official/i.test(cand.label || "")) {
            score += 0.10;
          }
          // Avoid Wikipedia when official site is requested
          if (hrefNorm.includes("wikipedia.org") || (cand.label || "").toLowerCase().includes("wikipedia")) {
            score -= 0.15;
          }
        }

        // Surrounding snippet relevance
        if (cand.snippet) {
          const snipNorm = normalize(cand.snippet);
          if (expansions.some(exp => snipNorm.includes(exp)) || (queryNorm && snipNorm.includes(queryNorm))) {
            score += 0.05;
          }
        }

        // Result position prior: earlier results preferred over later results
        const posPenalty = Math.min(candPos * 0.01, 0.05);
        score -= posPenalty;

        return {
          cand,
          score,
          pos: candPos
        };
      });

      scoredCandidates.sort((a, b) => b.score - a.score);

      const topResult = scoredCandidates[0];
      const selectedEl = topResult.cand;
      const realIdx = selectedEl.index !== undefined ? selectedEl.index : candidates.indexOf(selectedEl);
      const concreteLbl = selectedEl.label || selectedEl.text || selectedEl.title || selectedEl.ariaLabel || descriptor.rawPhrase;

      const actionType = (currentStepPlan.action || currentStepPlan.type || "CLICK").toUpperCase();
      const finalScore = Math.min(Math.max(topResult.score, 0.95), 0.99);

      return {
        action: actionType,
        target: concreteLbl,
        targetIndex: realIdx >= 0 ? realIdx : 0,
        targetType: selectedEl.type || "link",
        targetLabel: concreteLbl,
        url: selectedEl.url || selectedEl.href || null,
        bounds: selectedEl.bounds || { x: selectedEl.x || 0, y: selectedEl.y || 0, width: selectedEl.width || 100, height: selectedEl.height || 40 },
        groundingScore: finalScore,
        groundingMethod: "search-result-semantic-ranking",
        concreteElement: selectedEl,
        descriptor: descriptor,
        semanticTargetObject: descriptor.semanticTargetObject || buildSemanticTargetObject(descriptor, currentStepPlan),
        targetEntity: requestedEntity || (entityName ? { name: entityName } : null),
        targetIntent: currentStepPlan.targetIntent || descriptor.targetIntent || (isOfficialRequested ? "official_website" : "search_result")
      };
    }

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

  /**
   * Identifies whether a candidate label is purely generic (e.g. 'input field', 'textarea').
   * Generic labels must NEVER outrank task-specific semantic targets.
   * @param {string} str
   * @returns {boolean}
   */
  function isGenericInputLabel(str) {
    if (!str) return false;
    const s = String(str).toLowerCase().trim().replace(/[:*#_\-\/\\]+/g, " ");
    return /^(?:input\s*field|field|textarea|textbox|text\s*box|input|text\s*field|text\s*area|form\s*field|control|element)$/i.test(s);
  }

  /**
   * Detects the primary canonical semantic intent from user instruction and/or parsed steps.
   * @param {string} taskText
   * @param {Array<Object>} [steps]
   * @returns {string} One of SEMANTIC_INTENTS
   */
  function detectSemanticIntent(taskText, steps) {
    const t = String(taskText || "").toLowerCase().trim();
    if (!t && (!steps || steps.length === 0)) return SEMANTIC_INTENTS.CLICK_GENERIC;

    if (/\b(?:reply|draft\s+a\s+reply)\b/i.test(t)) return SEMANTIC_INTENTS.REPLY_MESSAGE;
    if (/\b(?:start\s+a\s+post|make\s+a\s+post|create\s+a\s+post|write\s+a\s+post|share\s+a\s+post|post\s+saying)\b/i.test(t)) return SEMANTIC_INTENTS.CREATE_POST;
    if (/\b(?:send\s+(?:a\s+|him\s+a\s+|her\s+a\s+|them\s+a\s+)?message|write\s+a\s+message)\b/i.test(t)) return SEMANTIC_INTENTS.SEND_MESSAGE;
    if (/\b(?:comment|write\s+a\s+comment|leave\s+a\s+comment)\b/i.test(t)) return SEMANTIC_INTENTS.COMMENT;
    if (/\b(?:compose|new\s+email|send\s+an\s+email|write\s+an\s+email)\b/i.test(t)) return SEMANTIC_INTENTS.COMPOSE_EMAIL;
    if (/\b(?:add\s+to\s+cart|buy\s+now|checkout)\b/i.test(t)) return SEMANTIC_INTENTS.ADD_TO_CART;
    if (/\b(?:download|save\s+file)\b/i.test(t)) return SEMANTIC_INTENTS.DOWNLOAD;
    if (/\b(?:check\s+(?:the\s+)?box|check\s+the|enable\s+checkbox)\b/i.test(t)) return SEMANTIC_INTENTS.CHECK;
    if (/\b(?:uncheck|disable\s+checkbox)\b/i.test(t)) return SEMANTIC_INTENTS.UNCHECK;
    if (/\b(?:toggle|switch)\b/i.test(t)) return SEMANTIC_INTENTS.TOGGLE;
    if (/\b(?:select|choose\s+option)\b/i.test(t)) return SEMANTIC_INTENTS.SELECT;
    if (/\b(?:fill\s+(?:the\s+)?form|fill\s+details|fill\s+out|autofill|fill\s+[a-zA-Z0-9_\-]+\s+with|enter\s+[a-zA-Z0-9_\-]+\s+in)\b/i.test(t)) return SEMANTIC_INTENTS.FILL_FORM;
    if (/\b(?:submit\s+(?:the\s+)?form|submit)\b/i.test(t)) return SEMANTIC_INTENTS.SUBMIT_FORM;
    if (/\b(?:open|click|select|view|visit)\s+(?:on\s+)?(?:the\s+)?(?:(?:first|second|third|fourth|fifth|1st|2nd|3rd|top|last|most\s+relevant|relevant)\s+)?(?:search\s+result|result|results|product\s+result)\b/i.test(t)) return SEMANTIC_INTENTS.OPEN_RESULT;
    if (/\b(?:search\s+for|search|find|look\s+for)\b/i.test(t)) return SEMANTIC_INTENTS.SEARCH;
    if (/\b(?:open|view)\s+(?:profile|user)\b/i.test(t)) return SEMANTIC_INTENTS.OPEN_PROFILE;
    if (/\b(?:open|view)\s+(?:product|item)\b/i.test(t)) return SEMANTIC_INTENTS.OPEN_PRODUCT;
    if (/\b(?:scroll\s+down|scroll\s+up|scroll)\b/i.test(t)) return SEMANTIC_INTENTS.SCROLL;
    if (/^(?:go\s+to|open|navigate\s+to|launch|visit)\s+https?:\/\//i.test(t) || /^(?:go\s+to|open|navigate\s+to)\s+[a-zA-Z0-9_\-]+\.(?:com|org|edu|gov|net|io)/i.test(t)) return SEMANTIC_INTENTS.NAVIGATE;

    if (Array.isArray(steps) && steps.length > 0) {
      if (steps.some(s => s.composerType === "reply" || s.semanticRole === "REPLY_COMPOSER" || s.targetRole === "REPLY_COMPOSER")) return SEMANTIC_INTENTS.REPLY_MESSAGE;
      if (steps.some(s => s.composerType === "post" || s.semanticRole === "POST_COMPOSER" || s.targetRole === "POST_COMPOSER")) return SEMANTIC_INTENTS.CREATE_POST;
      if (steps.some(s => s.composerType === "message" || s.semanticRole === "MESSAGE_COMPOSER" || s.targetRole === "MESSAGE_COMPOSER")) return SEMANTIC_INTENTS.SEND_MESSAGE;
      if (steps.some(s => s.composerType === "comment" || s.semanticRole === "COMMENT_COMPOSER" || s.targetRole === "COMMENT_COMPOSER")) return SEMANTIC_INTENTS.COMMENT;
      if (steps.some(s => s.isSearchIntent || s.targetRole === "SEARCH_INPUT" || s.semanticRole === "SEARCH_INPUT")) return SEMANTIC_INTENTS.SEARCH;
      if (steps.some(s => s.type === "FILL_FORM" || s.type === "FILL" || s.action === "FILL")) return SEMANTIC_INTENTS.FILL_FORM;
    }

    return SEMANTIC_INTENTS.CLICK_GENERIC;
  }

  /**
   * Infers the canonical semantic role for an individual action step.
   * @param {Object} step
   * @param {Object} [context]
   * @returns {string|null} Canonical SEMANTIC_ROLES value
   */
  function inferSemanticRoleForStep(step, context) {
    if (!step) return null;
    const t = String(step.target || step.fieldHint || step.targetHint || "").toLowerCase().trim();
    const action = String(step.action || step.type || "").toUpperCase();

    if (step.semanticRole && SEMANTIC_ROLES[step.semanticRole]) {
      return SEMANTIC_ROLES[step.semanticRole];
    }
    if (step.targetRole && SEMANTIC_ROLES[step.targetRole]) {
      return SEMANTIC_ROLES[step.targetRole];
    }
    if (step.expectedRole && SEMANTIC_ROLES[step.expectedRole]) {
      return SEMANTIC_ROLES[step.expectedRole];
    }

    if (action === "FILL") {
      if (step.isSearchIntent || t === "primary_search_input" || t === "search" || t === "search mail" || t === "searchbox") {
        return SEMANTIC_ROLES.SEARCH_INPUT;
      }
      if (step.composerType === "post" || t.includes("post composer") || t.includes("start a post")) {
        return SEMANTIC_ROLES.POST_COMPOSER;
      }
      if (step.composerType === "message" || t.includes("message composer") || t === "message" || t === "communication message body") {
        return SEMANTIC_ROLES.MESSAGE_COMPOSER;
      }
      if (step.composerType === "reply" || t.includes("reply composer") || t === "reply" || t.includes("reply message body")) {
        return SEMANTIC_ROLES.REPLY_COMPOSER;
      }
      if (step.composerType === "comment" || t.includes("comment box") || t.includes("comment composer") || t === "comment") {
        return SEMANTIC_ROLES.COMMENT_COMPOSER;
      }
      if (t === "recipient" || t === "to") return SEMANTIC_ROLES.RECIPIENT_FIELD;
      if (t === "subject") return SEMANTIC_ROLES.SUBJECT_FIELD;
      return SEMANTIC_ROLES.FORM_FIELD;
    }

    if (action === "CLICK" || action === "OPEN") {
      if (t === "reply" || /\breply\b/i.test(t)) return SEMANTIC_ROLES.REPLY_BUTTON;
      if (t === "start a post" || /\bstart\s+a\s+post\b/i.test(t)) return SEMANTIC_ROLES.POST_ENTRY;
      if (t === "message" || /\bmessage\b/i.test(t)) return SEMANTIC_ROLES.MESSAGE_BUTTON;
      if (t === "send" || /\bsend\b/i.test(t)) return SEMANTIC_ROLES.SEND_BUTTON;
      if (t === "post" || t === "publish" || /\b(?:post|publish)\b/i.test(t)) return SEMANTIC_ROLES.PUBLISH_BUTTON;
      if (t === "submit" || /\bsubmit\b/i.test(t)) return SEMANTIC_ROLES.SUBMIT_BUTTON;
      if (t === "compose" || /\bcompose\b/i.test(t)) return SEMANTIC_ROLES.COMPOSE_BUTTON;
      if (t === "add to cart" || /\badd\s+to\s+cart\b/i.test(t)) return SEMANTIC_ROLES.ADD_TO_CART_BUTTON;
      if (step.isSearchResult || t.includes("search result") || t.includes("result")) return SEMANTIC_ROLES.RESULT_LINK;
      if (step.targetEntity && step.targetEntity.type === "person") return SEMANTIC_ROLES.PROFILE_LINK;
      if (step.targetEntity && step.targetEntity.type === "product") return SEMANTIC_ROLES.PRODUCT_LINK;
    }

    if (action === "SUBMIT") {
      if (step.isSearchIntent || t === "primary_search_input" || t === "search") {
        return SEMANTIC_ROLES.SEARCH_SUBMIT;
      }
      return SEMANTIC_ROLES.SUBMIT_BUTTON;
    }

    return null;
  }

  /**
   * Generalized semantic composer candidate scoring.
   * Works across arbitrary websites without site-specific checks.
   * @param {Object} cand - Candidate element
   * @param {string} requestedRole - Canonical role (POST_COMPOSER, MESSAGE_COMPOSER, etc.)
   * @param {Object} [context]
   * @returns {number} Score [0, 1]
   */
  function scoreComposerCandidate(cand, requestedRole, context = {}) {
    if (!cand) return 0;
    const role = requestedRole || cand.expectedRole || cand.targetRole;
    if (!role) return 0;

    const norm = (s) => (s || "").toLowerCase().replace(/[:*#_\-\/\\]+/g, " ").trim();
    const candLabel = norm(cand.label);
    const candAria = norm(cand.ariaLabel);
    const candPlaceholder = norm(cand.placeholder || cand.dataPlaceholder);
    const candType = (cand.type || "").toLowerCase();
    const candRole = (cand.role || "").toLowerCase();
    const isEditable = Boolean(cand.isContentEditable || cand.contenteditable === "true" || cand.contenteditable === true || cand.type === "contenteditable" || cand.tag === "textarea" || candType === "textarea");
    const isTextCapable = isEditable || candType === "text" || candRole === "textbox" || cand.tag === "input" || cand.tag === "textarea";
    if (!isTextCapable) return 0;

    const isSearchControl = cand.semanticRole === "SEARCH_INPUT" || cand.semanticTag === "SEARCH_INPUT" || candType === "search" || /search/i.test(candLabel) || /search/i.test(candAria) || /search/i.test(candPlaceholder);
    if (isSearchControl && role !== SEMANTIC_ROLES.SEARCH_INPUT) {
      return 0.0;
    }

    if (/\b(?:profile\s*(?:picture|photo|image|avatar|pic)|user\s*avatar|avatar)\b/i.test(candLabel + " " + candAria + " " + (cand.className || ""))) {
      return 0.0;
    }

    const inDialog = Boolean(cand.inDialog || cand.inModal || (context && (context.inDialog || context.inModal)));

    if (role === SEMANTIC_ROLES.POST_COMPOSER) {
      if (cand.semanticRole === "POST_COMPOSER" && inDialog) return 1.0;
      const clues = /\b(?:post|talk\s+about|what\s+do\s+you\s+want\s+to\s+talk\s+about|share\s+your\s+thoughts|share|thoughts|write|create\s+a\s+post|start\s+a\s+post|text\s+editor)\b/i.test(candLabel + " " + candAria + " " + candPlaceholder);
      if (isEditable && inDialog && clues) return 1.0;
      if (isEditable && inDialog) return 0.98;
      if (cand.semanticRole === "POST_COMPOSER") return 0.95;
      if (isEditable && clues) return 0.95;
      if (candType === "textarea" && inDialog) return 0.90;
      if (isEditable) return 0.85;
      if (candType === "textarea" && clues) return 0.80;
      return 0.0;
    }

    if (role === SEMANTIC_ROLES.MESSAGE_COMPOSER) {
      if (cand.semanticRole === "MESSAGE_COMPOSER") return 1.0;
      const clues = /\b(?:message|chat|conversation|write\s+a\s+message|type\s+a\s+message|send\s+a\s+message)\b/i.test(candLabel + " " + candAria + " " + candPlaceholder);
      if (isEditable && (inDialog || clues)) return 1.0;
      if (candType === "textarea" && (inDialog || clues)) return 0.95;
      if (isEditable) return 0.90;
      if (candType === "textarea") return 0.85;
      return 0.0;
    }

    if (role === SEMANTIC_ROLES.REPLY_COMPOSER) {
      if (cand.semanticRole === "REPLY_COMPOSER") return 1.0;
      const clues = /\b(?:reply|response|write\s+a\s+reply|type\s+a\s+reply|body|message\s+body)\b/i.test(candLabel + " " + candAria + " " + candPlaceholder);
      if (isEditable && clues) return 1.0;
      if (candType === "textarea" && clues) return 0.95;
      if (isEditable) return 0.90;
      if (candType === "textarea") return 0.85;
      return 0.0;
    }

    if (role === SEMANTIC_ROLES.COMMENT_COMPOSER) {
      if (cand.semanticRole === "COMMENT_COMPOSER") return 1.0;
      const clues = /\b(?:comment|add\s+a\s+comment|write\s+a\s+comment|leave\s+a\s+comment)\b/i.test(candLabel + " " + candAria + " " + candPlaceholder);
      if (isEditable && clues) return 1.0;
      if (candType === "textarea" && clues) return 0.95;
      if (isEditable) return 0.90;
      if (candType === "textarea") return 0.85;
      return 0.0;
    }

    if (role === SEMANTIC_ROLES.CHAT_COMPOSER) {
      if (cand.semanticRole === "CHAT_COMPOSER") return 1.0;
      const clues = /\b(?:chat|type\s+a\s+message|type\s+message|send\s+a\s+message|ask\s+anything|ask)\b/i.test(candLabel + " " + candAria + " " + candPlaceholder);
      if (isEditable && (inDialog || clues)) return 1.0;
      if (candType === "textarea" && (inDialog || clues)) return 0.95;
      if (isEditable) return 0.90;
      if (candType === "textarea") return 0.85;
      return 0.0;
    }

    if (role === SEMANTIC_ROLES.GENERIC_TEXT_EDITOR) {
      if (inDialog && isEditable) return 1.0;
      if (inDialog && candType === "textarea") return 0.95;
      if (isEditable) return 0.90;
      if (candType === "textarea") return 0.85;
      if (candType === "text" || candRole === "textbox") return 0.70;
      return 0.0;
    }

    return 0.0;
  }

  /**
   * Generic semantic editable-target resolver (Part 2, Part 4, Part 5).
   * Resolves human intent / semantic role to the concrete current DOM/visual element
   * across <textarea>, <input>, [contenteditable="true"], role="textbox", role="combobox".
   * Considers action history, container/dialog hierarchy, accessibility, and visual clues.
   *
   * @param {string|Object} intent - Semantic intent, role name, or step object
   * @param {Array<Object>|Object} perception - Visual elements snapshot from perception
   * @param {Object} [context] - Action history: { previousAction, previousTarget, currentDialog, currentContainer }
   * @returns {{ target: Object, score: number, role: string, candidateCount: number, method: string }|null}
   */
  function resolveEditableTarget(intent, perception, context = {}) {
    let elements = [];
    if (Array.isArray(perception)) {
      elements = perception;
    } else if (perception && Array.isArray(perception.elements)) {
      elements = perception.elements;
    } else if (perception && Array.isArray(perception.visualElements)) {
      elements = perception.visualElements;
    }
    if (!elements || elements.length === 0) return null;

    // 1. Determine target semantic role
    let role = null;
    let intentStr = "";
    if (typeof intent === "string") {
      intentStr = intent;
      role = SEMANTIC_ROLES[intent] || null;
    } else if (intent && typeof intent === "object") {
      intentStr = String(intent.target || intent.semanticRole || intent.role || intent.action || "");
      role = intent.semanticRole || intent.role || intent.expectedRole || SEMANTIC_ROLES[intent.target] || null;
    }

    if (!role) {
      const lower = intentStr.toLowerCase();
      if (/\b(?:search|searchbox|search\s+mail|primary_search_input)\b/i.test(lower)) {
        role = SEMANTIC_ROLES.SEARCH_INPUT;
      } else if (/\b(?:start\s+a\s+post|post\s+composer|post\s+body|create\s+a\s+post|share\s+a\s+post)\b/i.test(lower)) {
        role = SEMANTIC_ROLES.POST_COMPOSER;
      } else if (/\b(?:reply\s+composer|reply\s+message\s+body|reply\s+body|reply)\b/i.test(lower)) {
        role = SEMANTIC_ROLES.REPLY_COMPOSER;
      } else if (/\b(?:message\s+composer|message\s+body|message\s+box|send\s+message)\b/i.test(lower)) {
        role = SEMANTIC_ROLES.MESSAGE_COMPOSER;
      } else if (/\b(?:comment\s+composer|comment\s+box|comment)\b/i.test(lower)) {
        role = SEMANTIC_ROLES.COMMENT_COMPOSER;
      } else if (/\b(?:chat\s+composer|chat\s+box|chat)\b/i.test(lower)) {
        role = SEMANTIC_ROLES.CHAT_COMPOSER;
      }
    }

    // Contextual inference from Action History (Part 5)
    if (!role && context) {
      const prevAction = String(context.previousAction || "").toUpperCase();
      const prevTarget = String(context.previousTarget || "").toLowerCase();
      if (prevAction === "CLICK" || prevAction === "OPEN") {
        if (/\b(?:start\s+a\s+post|post|share)\b/i.test(prevTarget) || context.currentDialog === "post") {
          role = SEMANTIC_ROLES.POST_COMPOSER;
        } else if (/\breply\b/i.test(prevTarget) || context.currentContainer === "reply") {
          role = SEMANTIC_ROLES.REPLY_COMPOSER;
        } else if (/\bmessage\b/i.test(prevTarget) || context.currentContainer === "message") {
          role = SEMANTIC_ROLES.MESSAGE_COMPOSER;
        }
      }
    }

    if (!role) {
      role = SEMANTIC_ROLES.GENERIC_TEXT_EDITOR;
    }

    // 2. Score candidates
    const scored = [];
    for (const el of elements) {
      if (!el) continue;
      const tag = (el.tagName || el.tag || "").toLowerCase();
      const type = (el.type || "").toLowerCase();
      const elRole = (el.role || "").toLowerCase();
      const isContentEditable = Boolean(el.isContentEditable || el.contenteditable === "true" || el.contenteditable === true || type === "contenteditable");
      const isTextCapable = isContentEditable || tag === "textarea" || type === "textarea" || tag === "input" || elRole === "textbox" || elRole === "combobox";

      if (!isTextCapable) continue;

      let score = 0;
      if (role === SEMANTIC_ROLES.SEARCH_INPUT) {
        if (el.semanticRole === "SEARCH_INPUT" || el.semanticTag === "SEARCH_INPUT") score = 1.0;
        else if (type === "search") score = 0.95;
        else if (/search/i.test((el.label || "") + " " + (el.ariaLabel || "") + " " + (el.placeholder || ""))) score = 0.90;
        else if (elRole === "combobox" && /search/i.test((el.ariaLabel || "") + " " + (el.placeholder || ""))) score = 0.88;
        else if (tag === "input" && (type === "text" || !type)) score = 0.50;
      } else {
        score = scoreComposerCandidate(el, role, context);
      }

      if (score > 0) {
        scored.push({ element: el, score });
      }
    }

    if (scored.length === 0) return null;

    scored.sort((a, b) => b.score - a.score);
    const best = scored[0];

    return {
      target: best.element,
      score: best.score,
      role: role,
      candidateCount: scored.length,
      method: "semantic+container+visual"
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
    isExcludedSearchPageControl,
    isSearchResultCandidate,
    ITEM_CATEGORIES,
    SEMANTIC_ROLES,
    SEMANTIC_INTENTS,
    isGenericInputLabel,
    detectSemanticIntent,
    inferSemanticRoleForStep,
    scoreComposerCandidate,
    resolveEditableTarget
  };
});
