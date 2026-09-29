(function(root, factory) {
  if (typeof define === "function" && define.amd) {
    define([], factory);
  } else if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.SIHTaskParser = factory();
  }
})(typeof self !== "undefined" ? self : this, function() {
  "use strict";
  const semanticResolver = (function() {
    if (typeof require === "function") {
      try {
        return require("./semantic-resolver.js");
      } catch (e) {
      }
    }
    if (typeof self !== "undefined" && self.SIHSemanticResolver) return self.SIHSemanticResolver;
    if (typeof window !== "undefined" && window.SIHSemanticResolver) return window.SIHSemanticResolver;
    if (typeof globalThis !== "undefined" && globalThis.SIHSemanticResolver) return globalThis.SIHSemanticResolver;
    return null;
  })();
  const DEFAULT_SCROLL_AMOUNT = 500;
  function normalizeText(text) {
    return (text || "").trim().replace(/[.!?]+$/, "").replace(/\s+/g, " ");
  }
  function resolveNavigationUrl(target) {
    if (!target) return null;
    const t = String(target).trim();
    if (/^https?:\/\//i.test(t)) {
      return t;
    }
    if (/^www\./i.test(t)) {
      return "https://" + t;
    }
    if (/^[a-zA-Z0-9_\-]+\.[a-zA-Z]{2,}(?:\/.*)?$/i.test(t)) {
      return "https://" + t;
    }
    if (/^localhost(?::\d+)?(?:\/.*)?$/i.test(t)) {
      return "http://" + t;
    }
    const lower = t.toLowerCase();
    const isMultiWord = /\s+/.test(t);
    const hasSemanticTerm = /\b(?:cheapest|expensive|rated|latest|recent|newest|oldest|first|second|third|fourth|fifth|last|black|white|blue|red|green|right|left|top|bottom|below|above|next|beside|product|email|mail|result|item|article|message|button|link|card|row|option|checkbox|page|site|website|downloads?|settings?|section|container|tab)\b/i.test(lower);
    if (isMultiWord || hasSemanticTerm) {
      if (/^hacker\s+news$/i.test(lower)) return "https://news.ycombinator.com";
      if (/^google\s+maps$/i.test(lower)) return "https://maps.google.com";
      if (/^google\s+docs$/i.test(lower)) return "https://docs.google.com";
      return null;
    }
    const cleanName = lower.replace(/[^a-z0-9\-]/g, "");
    if (cleanName && cleanName.length >= 2) {
      return `https://www.${cleanName}.com`;
    }
    return null;
  }
  function cleanFieldHint(field) {
    if (!field || typeof field !== "string") return "";
    let f = field.trim();
    f = f.replace(/\s+(?:field|input|box|area|textbox)$/i, "").trim();
    f = f.replace(/^(?:the|a|an|my|our|your)\s+/i, "").trim();
    f = f.replace(/\s+(?:and\s+then|and|then|after\s+that|next|followed\s+by|also)$/i, "").trim();
    f = f.replace(/^(?:and\s+then|and|then|after\s+that|next|followed\s+by|also)\s+/i, "").trim();
    return f;
  }
  function cleanValue(val) {
    if (!val || typeof val !== "string") return "";
    let v = val.trim();
    if (v.length >= 2) {
      const first = v[0];
      const last = v[v.length - 1];
      if (first === '"' && last === '"' || first === "'" && last === "'" || (first === "\u201C" || first === "\u201D") && (last === "\u201D" || last === "\u201C") || (first === "\u2018" || first === "\u2019") && (last === "\u2019" || last === "\u2018")) {
        v = v.slice(1, -1).trim();
      }
    }
    return v;
  }
  function resolveLegacyClickTarget(text) {
    const lower = text.toLowerCase();
    if (/button/i.test(lower) && /search/i.test(lower)) return null;
    if (/cart|add to cart|bag/i.test(lower)) return "ADD_TO_CART_BUTTON";
    if (/login|sign in|log in/i.test(lower)) return "LOGIN_BUTTON";
    if (/next|continue|proceed|step/i.test(lower)) return "NEXT_BUTTON";
    if (/submit/i.test(lower)) return "SUBMIT_BUTTON";
    if (/(?:^|\s)(?:search\s+input|search\s+box|query\s+input|find\s+input)(?:$|\s)/i.test(lower)) return "SEARCH_INPUT";
    return null;
  }
  function extractTaskQueryOrValue(task) {
    if (!task || typeof task !== "string") return null;
    const taskClean = task.trim();
    const mEnterIn = taskClean.match(/^(?:enter|type|put|write)\s+['"]?([^'",;]+?)['"]?\s+(?:in|into|to|for)\s+(?:the\s+)?[a-zA-Z0-9_\-\s]+/i);
    if (mEnterIn) {
      const val = cleanValue(mEnterIn[1]);
      if (val && !/^(?:the|a|an|box|input|field|button)$/i.test(val)) return val;
    }
    const mEnterAs = taskClean.match(/\b(?:enter|type|put)\s+['"]?([^'",;]+?)['"]?\s+as\s+(?:the\s+)?[a-zA-Z0-9_\-\s]+/i);
    if (mEnterAs) {
      const val = cleanValue(mEnterAs[1]);
      if (val && !/^(?:the|a|an|box|input|field|button)$/i.test(val)) return val;
    }
    const mPlatformSearch = taskClean.match(/\bsearch\s+([a-zA-Z0-9_\-]+)\s+for\s+['"]?([^'",;]+?)['"]?(?:\s+(?:and\s+then|and|then|after\s+that|next|followed\s+by|also)\b|[.,;!?]|$)/i);
    if (mPlatformSearch && !/^(?:the|a|an|box|input|field|bar|area|button|for)$/i.test(mPlatformSearch[1])) {
      let val = cleanValue(mPlatformSearch[2]);
      if (val) {
        val = val.replace(/\s+(?:and\s+then|and|then|after\s+that|next|followed\s+by|also)$/i, "").trim();
      }
      if (val && !/^(?:the|a|an|it|this|that|box|input|field|bar|area|button)$/i.test(val)) {
        return val;
      }
    }
    const mSearch = taskClean.match(/(?<!\bfill\s)(?<!\benter\s)(?<!\btype\s)(?<!\bclick\s)(?<!\bfind\s)(?<!\bin\s)(?<!\binto\s)(?<!\bto\s)(?<!\bfor\s)\bsearch\s+(?:for\s+)?(?!(?:the\s+)?(?:box|input|field|bar|area|button)\b)['"]?([^'",;]+?)['"]?(?:\s+(?:and\s+then|and|then|after\s+that|next|followed\s+by|also)\s+(?:identify|find|open|click|select|choose|visit|view|launch|pick|tap|press|see|go\s+to|navigate\s+to)\b|\s+(?:then|after\s+that|next|followed\s+by|and\s+then)\b|(?:\s+[.,;!?]|[.,;!?](?:\s+|$))|$)/i);
    if (mSearch) {
      let val = cleanValue(mSearch[1]);
      if (val) {
        val = val.replace(/\s+(?:and\s+then|and|then|after\s+that|next|followed\s+by|also)$/i, "").trim();
      }
      if (val && !/^(?:the|a|an|it|this|that|box|input|field|bar|area|button)$/i.test(val)) {
        return val;
      }
    }
    const mIn = taskClean.match(/\b(?:enter|type|put)\s+['"]?([^'",;]+?)['"]?\s+(?:in|into|for)\b/i);
    if (mIn) {
      const val = cleanValue(mIn[1]);
      if (val && !/^(?:the|a|an|box|input|field|button)$/i.test(val)) return val;
    }
    const mFill = taskClean.match(/\b(?:fill|set)\b.*?\b(?:as|with|value|to)\s+['"]?([^'",;]+?)['"]?(?:\s+(?:and\s+then|and|then|after\s+that|next|followed\s+by|also)\b|[.,;!?]|$)/i);
    if (mFill) {
      let val = cleanValue(mFill[1]);
      if (val) val = val.replace(/\s+(?:and\s+then|and|then|after\s+that|next|followed\s+by|also)$/i, "").trim();
      if (val && !/^(?:the|a|an|box|input|field|button)$/i.test(val)) return val;
    }
    const mType = taskClean.match(/\b(?:type|write)\s+['"]?([^'",;]+?)['"]?(?:\s+(?:and\s+then|and|then|after\s+that|next|followed\s+by|also)\b|[.,;!?]|$)/i);
    if (mType) {
      let val = cleanValue(mType[1]);
      if (val) val = val.replace(/\s+(?:and\s+then|and|then|after\s+that|next|followed\s+by|also)$/i, "").trim();
      if (val && !/^(?:the|a|an|box|input|field|button|it|this|that)$/i.test(val)) return val;
    }
    return null;
  }
  function parseFillClause(clause) {
    const text = (clause || "").trim();
    if (!text) return null;
    if (/^(?:click|press|tap|open|scroll|view|navigate|go\s+to|select|choose|check|uncheck|toggle|enable|disable|turn|save|download|look|add|reply|compose|send)\b/i.test(text)) {
      return null;
    }
    const enterAsMatch = text.match(/^(?:enter|type|put|write)\s+(.+?)\s+as\s+(?:the\s+)?([a-zA-Z0-9_\-\s]+?)(?:\s+field|\s+input|\s+box|\s+area|\s+textbox)?$/i);
    if (enterAsMatch) {
      let val = cleanValue(enterAsMatch[1]);
      let field = cleanFieldHint(enterAsMatch[2]);
      if (/@/.test(enterAsMatch[2]) || /^(?:email|email\s+address|mail|name|full\s+name|phone|mobile|address|password|username|city|state|zip|country)$/i.test(cleanFieldHint(enterAsMatch[1]))) {
        field = cleanFieldHint(enterAsMatch[1]);
        val = cleanValue(enterAsMatch[2]);
      }
      if (val && field && !isPronounOrReference(field) && !/^(?:the|a|an|to)$/i.test(val)) {
        return { type: "FILL", fieldHint: field, value: val };
      }
    }
    if (!/^(?:set|fill)\b/i.test(text)) {
      const enterInMatch = text.match(/^(?:(?:enter|type|put|write)\s+)?(.+?)\s+(?:in|into|for|to)\s+(?:the\s+)?([a-zA-Z0-9_\-\s]+?)(?:\s+field|\s+input|\s+box|\s+area|\s+textbox)?$/i);
      if (enterInMatch) {
        const val = cleanValue(enterInMatch[1]);
        const field = cleanFieldHint(enterInMatch[2]);
        if (val && field && !isPronounOrReference(field) && !/^(?:the|a|an|to|it|that|this)$/i.test(val)) {
          return { type: "FILL", fieldHint: field, value: val };
        }
      }
    }
    const explicitFillMatch = text.match(/^(?:fill|set|enter)\s+(?:in\s+|into\s+)?(?:the\s+)?([a-zA-Z0-9_\-\s]+?)(?:\s+(?:with|to|as|is|:=|=)\s+|\s*:\s*)(.+)$/i);
    if (explicitFillMatch) {
      const rawField = explicitFillMatch[1].trim();
      if (!/^(?:(?:this|the|a|all)\s+)?(?:form|details|fields|profile|information|data)$/i.test(rawField)) {
        const field = cleanFieldHint(rawField);
        const val = cleanValue(explicitFillMatch[2]);
        if (field && val && !isPronounOrReference(field)) {
          return { type: "FILL", fieldHint: field, value: val };
        }
      }
    }
    const implicitFillMatch = text.match(/^(?:the\s+)?([a-zA-Z0-9_\-\s]+?)(?:\s+(?:with|as|is|:=|=)\s+|\s*:\s*)(.+)$/i);
    if (implicitFillMatch) {
      const field = cleanFieldHint(implicitFillMatch[1]);
      const val = cleanValue(implicitFillMatch[2]);
      if (field && val && !isPronounOrReference(field) && !/^(?:search|click|press|tap|open|find|go|select|choose|check|uncheck|toggle|reply|compose|send)$/i.test(field) && !/^(?:reply|compose|send|open|go|navigate|click|press)\b/i.test(field)) {
        return { type: "FILL", fieldHint: field, value: val };
      }
    }
    const typeValMatch = text.match(/^(?:type|write)\s+['"]?([^'"]+?)['"]?$/i);
    if (typeValMatch) {
      const val = cleanValue(typeValMatch[1]);
      if (val && !/^(?:the|a|an|it|this|that)$/i.test(val)) {
        return { type: "FILL", fieldHint: "body", value: val };
      }
    }
    return null;
  }
  function isPronounOrReference(str) {
    const s = (str || "").toLowerCase().trim();
    return /^(?:it|this|that|them|that\s+button|this\s+button|the\s+button|button|that\s+link|this\s+link|the\s+link|link|the\s+above|above|the\s+field|that\s+field|this\s+field|field)$/i.test(s);
  }
  const CONTEXTUAL_REFERENCE_PATTERN = /^(?:(?:his|her|their|its|this|that|the)\s+)?(?:profile|product(?:\s+page)?|page|item|email|message|post|result|first\s+result|person)$|^(?:his|her|their|its|this|that|it|them|this\s+person|that\s+person|the\s+person|the\s+result|the\s+first\s+result|the\s+selected\s+result|that\s+profile|their\s+profile|his\s+profile|her\s+profile|that\s+item|this\s+product|that\s+product|the\s+email|that\s+email|the\s+message|this\s+post)$/i;
  function isContextualReference(str) {
    if (!str || typeof str !== "string") return false;
    return CONTEXTUAL_REFERENCE_PATTERN.test(str.trim());
  }
  function extractContextualIntent(text) {
    if (!text || typeof text !== "string") return "open";
    const t = text.trim().toLowerCase();
    if (/\bprofile\b/i.test(t)) return "profile";
    if (/\bproduct(?:\s+page)?\b/i.test(t)) return "product";
    if (/\b(?:email|mail|message)\b/i.test(t)) return "email";
    if (/\b(?:first\s+result|result)\b/i.test(t)) return "result";
    if (/\bitem\b/i.test(t)) return "item";
    if (/\bcart\b/i.test(t)) return "cart";
    return "open";
  }
  function inferEntityType(text, intent) {
    if (!text && !intent) return "generic";
    const combined = `${text || ""} ${intent || ""}`.toLowerCase();
    if (/\b(?:his|her|profile|person|user|candidate|employee|ceo|founder)\b/i.test(combined)) return "person";
    if (/\b(?:product|item|laptop|phone|earbuds|book|price|cart)\b/i.test(combined)) return "product";
    if (/\b(?:email|mail|message|inbox)\b/i.test(combined)) return "email";
    return "result";
  }
  function extractEntityFromStep(step) {
    if (!step) return null;
    if (step.targetEntity && step.targetEntity.name) {
      return step.targetEntity;
    }
    if (step.query) {
      return {
        type: inferEntityType(step.query, step.targetHint),
        name: step.query
      };
    }
    if (step.value && step.type === "FILL") {
      return {
        type: inferEntityType(step.value, step.fieldHint),
        name: step.value
      };
    }
    if (step.context) {
      return {
        type: inferEntityType(step.target || step.targetHint, step.context),
        name: `${step.context} ${step.target || step.targetHint || "item"}`.trim()
      };
    }
    if (step.objectTarget) {
      return {
        type: inferEntityType(step.objectTarget, step.targetHint),
        name: step.objectTarget
      };
    }
    if (step.targetHint && (step.type === "CLICK" || step.type === "OPEN")) {
      const t = step.targetHint.trim();
      if (!/^(?:search|submit|button|box|input|field|link|bar)$/i.test(t)) {
        return {
          type: inferEntityType(t, step.context),
          name: t
        };
      }
    }
    return null;
  }
  function normalizeRelation(rel) {
    if (!rel || typeof rel !== "string") return null;
    const r = rel.toLowerCase().trim();
    if (["inside", "in", "within", "under", "from", "of"].includes(r)) {
      return "inside";
    }
    return r;
  }
  function extractOrdinal(text) {
    if (!text || typeof text !== "string") return null;
    const s = text.toLowerCase().trim();
    if (/\b(?:first|last)\s+(?:name|word|character)\b/i.test(s)) return null;
    if (/\b(?:first|1st)\b/i.test(s)) return 1;
    if (/\b(?:second|2nd)\b/i.test(s)) return 2;
    if (/\b(?:third|3rd)\b/i.test(s)) return 3;
    if (/\blast\b/i.test(s)) return -1;
    return null;
  }
  function extractTargetType(text) {
    if (!text || typeof text !== "string") return null;
    const s = text.toLowerCase().trim();
    if (/\bcheckbox\b/i.test(s)) return "checkbox";
    if (/\bradio\b/i.test(s)) return "radio";
    if (/\bdropdown\b/i.test(s)) return "dropdown";
    if (/\boption\b/i.test(s)) return "option";
    if (/\btoggle\b|\bswitch\b/i.test(s)) return "toggle";
    if (/\bbutton\b/i.test(s)) return "button";
    if (/\blink\b/i.test(s)) return "link";
    if (/\btab\b/i.test(s)) return "tab";
    if (/\binput\b|\btextbox\b/i.test(s)) return "input";
    if (/\bproduct\b|\bitem\b/i.test(s)) return "product";
    if (/\bsection\b|\bcontainer\b|\bcard\b/i.test(s)) return "section";
    if (/\bcoupon\b/i.test(s)) return "coupon";
    if (/\bfilter\b/i.test(s)) return "filter";
    return null;
  }
  function cleanContextName(str) {
    if (!str || typeof str !== "string") return "";
    let s = str.trim();
    s = s.replace(/^(?:the|a|an)\s+/i, "").trim();
    s = s.replace(/\s+(?:section|container|card|panel|area|box|group)$/i, "").trim();
    return s;
  }
  function parseMultiFieldNoValClause(clause) {
    if (!clause || typeof clause !== "string") return null;
    const text = clause.trim().replace(/[.,;!?]+$/, "");
    const match = text.match(/^(?:fill|enter|type|put)\s+(?:in\s+|into\s+)?(?:(?:the|my|our|your)\s+)?([a-zA-Z0-9_\-]+(?:\s+[a-zA-Z0-9_\-]+)?)\s+(?:and|,)\s+(?:(?:the|my|our|your)\s+)?([a-zA-Z0-9_\-]+(?:\s+[a-zA-Z0-9_\-]+)?)(?:\s+(?:and|,)\s+(?:(?:the|my|our|your)\s+)?([a-zA-Z0-9_\-]+(?:\s+[a-zA-Z0-9_\-]+)?))?$/i);
    if (!match) return null;
    if (/\b(?:as|with|value|to|is)\b/i.test(text)) return null;
    const f1 = cleanFieldHint(match[1]);
    const f2 = cleanFieldHint(match[2]);
    const f3 = match[3] ? cleanFieldHint(match[3]) : null;
    if (!f1 || !f2) return null;
    const steps = [
      { type: "FILL", fieldHint: f1, value: "..." },
      { type: "FILL", fieldHint: f2, value: "..." }
    ];
    if (f3) {
      steps.push({ type: "FILL", fieldHint: f3, value: "..." });
    }
    return steps;
  }
  const ACTION_VERB_PREFIX = "(?:click|press|tap|open|launch|visit|navigate\\s+to|go\\s+to|select|choose|pick|check|uncheck|toggle|tick|untick|enable|disable|turn\\s+on|turn\\s+off|activate|deactivate|fill|enter|type|put|set|write|populate|autofill|complete|search\\s+for|search|find|locate|look\\s+for|look|compose|reply|send|submit|save|download|add(?:\\s+to\\s+cart)?|add|scroll(?:\\s+down|\\s+up)?)";
  const ACTION_CONNECTOR_PATTERN = new RegExp(
    "(?:(?:,\\s*|;\\s*)(?:and\\s+then|and|then|after\\s+that|next|followed\\s+by|also)?\\s*|\\s+(?:and\\s+then|then|after\\s+that|followed\\s+by|next|also|and)\\s+)(?=" + ACTION_VERB_PREFIX + "\\b)",
    "i"
  );
  function splitActionClauses(text) {
    if (!text || typeof text !== "string") return [text];
    const t = text.trim();
    const parts = t.split(ACTION_CONNECTOR_PATTERN);
    return parts.map((p) => p.trim()).filter(Boolean);
  }
  function resolveActiveContainerContext(step) {
    if (!step || typeof step !== "object") return null;
    if (step.context) {
      return cleanContextName(step.context);
    }
    if (["CHECK", "UNCHECK", "SELECT", "TOGGLE", "FILL", "FILL_FORM", "AUTOFILL"].includes(step.type)) {
      return null;
    }
    return cleanContextName(step.targetHint || step.target || "");
  }
  function parseJuxtapositionFill(str) {
    if (!str || typeof str !== "string") return null;
    let s = str.trim();
    s = s.replace(/^(?:and\s+then|and|then|after\s+that|next|followed\s+by|also)\s+/i, "").trim();
    s = s.replace(/^(?:my|our|your|the|a|an)\s+/i, "").trim();
    if (!s) return null;
    if (/^(?:click|press|tap|open|scroll|select|choose|check|uncheck|toggle|tick|untick|enable|disable|turn|activate|deactivate|find|locate|search|look|go|navigate|fill|enter|type|put|set|write|compose|reply|send|submit|save|download|add)\b/i.test(s)) {
      return null;
    }
    if (/\b(?:inside|within|under|from|of)\b/i.test(s)) {
      return null;
    }
    if (/\b(?:as|is|with|to|in|into|for|:=|=)\b|:/i.test(s)) {
      return null;
    }
    const parts = s.split(/\s+/);
    if (parts.length < 2) return null;
    if (/^(?:and|then|after|next|also|followed)$/i.test(parts[0])) return null;
    if (/^(?:on|in|at|by|with|from|to|for|of|about|into|onto|upon)$/i.test(parts[0])) return null;
    const actionVerbPattern = /^(?:click|press|tap|open|scroll|select|choose|check|uncheck|toggle|tick|untick|enable|disable|turn|activate|deactivate|find|locate|search|look|go|navigate|fill|enter|type|put|set|write|compose|reply|send|submit|save|download|add)$/i;
    const compoundFieldNouns = /^(?:name|number|no|code|id|address|line|date|word|mail)$/i;
    if (parts.length >= 3 && compoundFieldNouns.test(parts[1])) {
      if (actionVerbPattern.test(parts[0])) return null;
      const field2 = cleanFieldHint(parts[0] + " " + parts[1]);
      const val2 = cleanValue(parts.slice(2).join(" "));
      if (field2 && val2 && !isPronounOrReference(field2)) {
        return { type: "FILL", fieldHint: field2, value: val2 };
      }
    }
    if (actionVerbPattern.test(parts[0])) return null;
    const field = cleanFieldHint(parts[0]);
    if (actionVerbPattern.test(field)) return null;
    const val = cleanValue(parts.slice(1).join(" "));
    if (field && val && !isPronounOrReference(field)) {
      return { type: "FILL", fieldHint: field, value: val };
    }
    return null;
  }
  function parseContextualClause(clause, prevContext = null) {
    if (!clause || typeof clause !== "string") return null;
    let text = clause.trim().replace(/[.,;!?]+$/, "").replace(/^(?:and\s+then|and|then|after\s+that|next|followed\s+by|also)\s+/i, "");
    if (!text) return null;
    if (/\b(?:as|with|to|is|:=|=)\s+['"]?[^'"\s]+/i.test(text) && !/\b(?:inside|within|under|in|from|of)\b/i.test(text)) {
      return null;
    }
    if (/^(?:fill|enter|type|put|set)\b/i.test(text)) {
      return null;
    }
    if (/^scroll\b/i.test(text)) {
      return null;
    }
    let action = null;
    let rest = text;
    const mAction = text.match(/^(?:(check|uncheck|select|choose|toggle|tick|untick|click|press|tap|find|locate|open)\s+(?:on\s+)?)(.+)$/i);
    if (mAction) {
      const verb = mAction[1].toLowerCase();
      rest = mAction[2].trim();
      if (verb === "check" || verb === "tick") action = "CHECK";
      else if (verb === "uncheck" || verb === "untick") action = "UNCHECK";
      else if (verb === "select" || verb === "choose") action = "SELECT";
      else if (verb === "toggle") action = "TOGGLE";
      else action = "CLICK";
    }
    const mRel = rest.match(/^(.+?)\s+\b(inside|within|under|in|from|of)\s+(.+)$/i);
    if (mRel) {
      let targetPart = mRel[1].trim();
      if (targetPart.includes(",") || targetPart.includes(";") || /\b(?:compose|navigate|open|go\s+to|fill|enter|type|write|search|click|press|tap|submit|send|enable|disable|save|download)\b/i.test(targetPart)) {
        return null;
      }
      const relWord = mRel[2].toLowerCase();
      let contextPart = mRel[3].trim();
      targetPart = targetPart.replace(/^(?:the|a|an)\s+/i, "").trim();
      contextPart = contextPart.replace(/^(?:the|a|an)\s+/i, "").trim();
      if (isPronounOrReference(contextPart) || /^(?:it|this|that|them)$/i.test(contextPart)) {
        if (prevContext) {
          contextPart = prevContext;
        }
      }
      const relation = normalizeRelation(relWord);
      const ordinal2 = extractOrdinal(targetPart);
      const targetType = extractTargetType(targetPart);
      let cleanTarget = targetPart;
      if (!/^(?:option|checkbox|toggle|switch|product|item|coupon|button|link)$/i.test(cleanTarget.toLowerCase())) {
        cleanTarget = cleanTarget.replace(/\s+(?:option|checkbox|button|link|toggle|switch)$/i, "").trim();
      }
      cleanTarget = cleanTarget.replace(/\s+(?:and\s+then|and|then|after\s+that|next|followed\s+by|also)$/i, "").trim();
      if (!action) {
        if (targetType === "checkbox") action = "CHECK";
        else if (targetType === "option") action = "SELECT";
        else if (targetType === "toggle") action = "TOGGLE";
        else action = "SELECT";
      }
      const attrConstraint = extractAttributeConstraint(cleanTarget);
      return {
        type: action,
        action,
        target: cleanTarget,
        targetHint: cleanTarget,
        objectTarget: attrConstraint ? attrConstraint.objectTarget : null,
        attribute: attrConstraint ? attrConstraint.attribute : null,
        attributeValue: attrConstraint ? attrConstraint.attributeValue : null,
        context: contextPart,
        relation,
        ordinal: ordinal2 !== null ? ordinal2 : null,
        targetType
      };
    }
    if (action && ["CHECK", "UNCHECK", "SELECT", "TOGGLE"].includes(action)) {
      let targetPart = rest.replace(/^(?:the|a|an)\s+/i, "").trim();
      const ordinal2 = extractOrdinal(targetPart);
      const targetType = extractTargetType(targetPart) || (action === "CHECK" || action === "UNCHECK" ? "checkbox" : action === "TOGGLE" ? "toggle" : "option");
      let cleanTarget = targetPart;
      if (!/^(?:option|checkbox|toggle|switch|product|item|coupon|button|link)$/i.test(cleanTarget.toLowerCase())) {
        cleanTarget = cleanTarget.replace(/\s+(?:option|checkbox|button|link|toggle|switch)$/i, "").trim();
      }
      cleanTarget = cleanTarget.replace(/\s+(?:and\s+then|and|then|after\s+that|next|followed\s+by|also)$/i, "").trim();
      const attrConstraint = extractAttributeConstraint(cleanTarget);
      const desc = semanticResolver ? semanticResolver.extractSemanticDescriptor(targetPart) : {};
      return {
        type: action,
        action,
        target: cleanTarget,
        targetHint: cleanTarget,
        semanticTarget: cleanTarget,
        semanticCategory: desc.category || null,
        ranking: desc.ranking || null,
        spatial: desc.spatial || null,
        isSemantic: !!(desc.isSemantic || ordinal2 !== null || attrConstraint),
        objectTarget: attrConstraint ? attrConstraint.objectTarget : desc.objectTarget || null,
        attribute: attrConstraint ? attrConstraint.attribute : desc.attribute || null,
        attributeValue: attrConstraint ? attrConstraint.attributeValue : desc.attributeValue || null,
        context: prevContext || null,
        relation: prevContext ? "inside" : null,
        ordinal: ordinal2 !== null ? ordinal2 : null,
        targetType
      };
    }
    const ordinal = extractOrdinal(rest);
    if (ordinal !== null && (action === "CLICK" || action === "SELECT" || !action)) {
      let targetPart = rest.replace(/^(?:the|a|an)\s+/i, "").trim();
      const targetType = extractTargetType(targetPart) || "generic";
      const attrConstraint = extractAttributeConstraint(targetPart);
      const desc = semanticResolver ? semanticResolver.extractSemanticDescriptor(targetPart) : {};
      const act = action === "SELECT" ? "SELECT" : "CLICK";
      return {
        type: act,
        action: act,
        target: targetPart,
        targetHint: targetPart,
        semanticTarget: targetPart,
        semanticCategory: desc.category || null,
        ranking: desc.ranking || null,
        spatial: desc.spatial || null,
        isSemantic: true,
        objectTarget: attrConstraint ? attrConstraint.objectTarget : desc.objectTarget || null,
        attribute: attrConstraint ? attrConstraint.attribute : desc.attribute || null,
        attributeValue: attrConstraint ? attrConstraint.attributeValue : desc.attributeValue || null,
        context: prevContext || null,
        relation: prevContext ? "inside" : null,
        ordinal,
        targetType
      };
    }
    return null;
  }
  function extractAttributeConstraint(text) {
    if (!text || typeof text !== "string") return null;
    let s = text.trim().replace(/[.,;!?]+$/, "");
    s = s.replace(/^(?:the|a|an)\s+/i, "").trim();
    s = s.replace(/^(?:first|second|third|1st|2nd|3rd|last)\s+/i, "").trim();
    const LOCATION_SUFFIX_PATTERN = /\s+(?:on\s+(?:the\s+)?(?:screen|page|webpage|site)|on\s+screen|here|in\s+(?:the\s+)?page)$/i;
    s = s.replace(LOCATION_SUFFIX_PATTERN, "").trim();
    const colorPattern = "\\b(black|white|red|blue|green|yellow|orange|purple|pink|brown|gray|grey|silver|gold)\\b";
    const p1Regex = new RegExp(`^${colorPattern}(?:[\\s\\-]+(?:colour|color|colored|coloured))?\\s+(.+)$`, "i");
    const m1 = s.match(p1Regex);
    if (m1) {
      const colorVal = m1[1].toLowerCase();
      let obj = m1[2].trim().replace(/^(?:the|a|an)\s+/i, "").replace(LOCATION_SUFFIX_PATTERN, "").trim();
      if (obj && !isPronounOrReference(obj)) {
        return {
          objectTarget: obj,
          attribute: "color",
          attributeValue: colorVal,
          normalizedTarget: `${colorVal} ${obj}`
        };
      }
    }
    const p2Regex = new RegExp(`^(.+?)\\s+(?:in|with)\\s+(?:the\\s+)?${colorPattern}(?:[\\s\\-]+(?:colour|color|colored|coloured))?$`, "i");
    const m2 = s.match(p2Regex);
    if (m2) {
      let obj = m2[1].trim().replace(/^(?:the|a|an)\s+/i, "").replace(LOCATION_SUFFIX_PATTERN, "").trim();
      const colorVal = m2[2].toLowerCase();
      if (obj && !isPronounOrReference(obj)) {
        return {
          objectTarget: obj,
          attribute: "color",
          attributeValue: colorVal,
          normalizedTarget: `${colorVal} ${obj}`
        };
      }
    }
    return null;
  }
  function normalizeTaskPhrasing(rawTask) {
    let text = normalizeText(rawTask);
    if (!text) return "";
    text = text.replace(
      /^\s*(?:on|in)\s+([a-zA-Z0-9_\-\.]+?(?:\s+website|\s+site|\s+portal)?)\s*,\s*(.+)$/i,
      (match, platform, rest) => {
        if (/^(?:this|the|a|an)\s+(?:form|field|input|box|page|email|message|modal|dialog|card|panel|document|table|row|list)$/i.test(platform.trim())) {
          return match;
        }
        return `open ${platform.trim()} and ${rest.trim()}`;
      }
    );
    text = text.replace(
      /\b(set|fill)\s+(?:the\s+)?([a-zA-Z0-9_\-\s]+?)\s+(to|with)\s+([^,;]+?)\s+(?:and\s+then|and)\s+(?:the\s+)?([a-zA-Z0-9_\-\s]+?)\s+\3\s+([^,;]+?)(?=$|\s*[,;.])/gi,
      (match, verb, f1, prep, v1, f2, v2) => {
        return `${verb} ${f1.trim()} ${prep} ${v1.trim()} and ${verb} ${f2.trim()} ${prep} ${v2.trim()}`;
      }
    );
    text = text.replace(
      /\b(?:find|locate|go\s+to)\s+(?:the\s+)?([a-zA-Z0-9_\-\s]+?)(?:\s+(?:field|input|box|area|textbox))?\s*(?:,\s*(?:and\s+then|and|then)\s*|\s+(?:and\s+then|and|then)\s+)(?:enter|fill|type|put|set|write)(?:\s+(?:(?:in|into)\s+)?(?:it|that|this|the\s+field|the\s+input|the\s+box))?\s*(?:(?:with|to|as|value|is|:=|=)\s+)?(.+?)(?:\s+(?:in|into)\s+(?:it|that|this|the\s+field|the\s+input|the\s+box))?(?=\s*[,;.]|\s+(?:and\s+then|and|then)\b|$)/gi,
      (match, field, val) => {
        const cleanF = cleanFieldHint(field);
        if (/\b(?:form|section|modal|dialog|page|card|panel)\b/i.test(cleanF)) return match;
        if (/\b(?:and|,)\b\s*(?:(?:my|the|your|our)\s+)?(?:email|password|username|name|phone|address)\b/i.test(val)) return match;
        return `fill ${cleanF} with ${val.trim()}`;
      }
    );
    text = text.replace(
      /\b(?:find|locate|search\s+for|look\s+for)\s+(?:the\s+)?((?:(?!\b(?:and|then)\b)[a-zA-Z0-9_\-\s\/])+?)\s*(?:,\s*(?:and\s+then\s+|and\s+|then\s+)?|\s+(?:and\s+then\s+|and\s+|then\s+))(click|press|tap|select|use|open|download)\s+(?:on\s+)?(?:it|that|this|them|that\s+button|this\s+button|that\s+link|this\s+link|the\s+above|above|the\s+field|that\s+field|this\s+field|(?:its|their)\s+(?:details|mission\s+details|page|info|information|link|view|description))\b/gi,
      (match, target, verb) => {
        const cleanTarget = target.trim();
        const v = (verb || "").toLowerCase();
        if (/\b(?:email|mail|message|profile|person|user|product|item|laptop|phone|cart)\b/i.test(cleanTarget)) {
          return match;
        }
        const act = v === "select" ? "select" : v === "open" ? "open" : v === "download" ? "download" : "click";
        return `${act} ${cleanTarget}`;
      }
    );
    text = text.replace(
      /\b(?:find|locate|search\s+for|look\s+for)\s+(?:the\s+)?((?:(?!\b(?:and|then)\b)[a-zA-Z0-9_\-\s\/])+?)\s*(?:,\s*(?:and\s+then\s+|and\s+|then\s+)?|\s+(?:and\s+then\s+|and\s+|then\s+))(?:turn\s+(?:it|this|that)\s+on|enable\s+(?:it|this|that)|activate\s+(?:it|this|that))\b/gi,
      (match, target) => `enable ${target.trim()}`
    );
    text = text.replace(
      /\b(?:find|locate|search\s+for|look\s+for)\s+(?:the\s+)?((?:(?!\b(?:and|then)\b)[a-zA-Z0-9_\-\s\/])+?)\s+(button|link)\s*(?:,\s*(?:and\s+then\s+|and\s+|then\s+)?|\s+(?:and\s+then\s+|and\s+|then\s+))(click|press|tap|select|use|open)\s+(?:on\s+)?(?:it|that|this|them|that\s+button|this\s+button|that\s+link|this\s+link|the\s+above|above|the\s+field|that\s+field|this\s+field)\b/gi,
      (match, target, type, verb) => {
        const cleanTarget = target.trim();
        const v = (verb || "").toLowerCase();
        const act = v === "select" ? "select" : v === "open" ? "open" : "click";
        return `${act} ${cleanTarget} ${type}`;
      }
    );
    text = text.replace(
      /\b(?:the\s+)?([a-zA-Z0-9_\-]+(?:\s+(?:button|link)))\s*(?:,\s*(?:and\s+then\s+|and\s+|then\s+)?|\s+(?:and\s+then\s+|and\s+|then\s+))(click|press|tap|select|use|open)\s+(?:on\s+)?(?:it|that|this|them|that\s+button|this\s+button|that\s+link|this\s+link|the\s+above|above|the\s+field|that\s+field|this\s+field)\b/gi,
      (match, target, verb) => {
        const cleanTarget = (target || "").trim();
        if (/^(?:fill|enter|type|put|set|is|as|with|in|into|then|and|from|of|to|for|at|by|about)$/i.test(cleanTarget)) {
          return match;
        }
        const v = (verb || "").toLowerCase();
        const act = v === "select" ? "select" : v === "open" ? "open" : "click";
        return `${act} ${cleanTarget}`;
      }
    );
    text = text.replace(
      /\b(?:find|locate|go\s+to)\s+(?:the\s+)?(?:search\s+(?:box|input|field|area)|search)\s*(?:,\s*|\s+)(?:and\s+then\s+|and\s+|then\s+)?search\s+(?:for\s+)?((?:(?!\b(?:and|then)\b)[a-zA-Z0-9_\-\s])+?)(?=(?:,\s*|\s+)(?:and\s+(?:then\s+)?|then\s+)?(?:find|click|press|tap|submit|send)|$)/i,
      (match, query) => {
        return `fill search as ${query.trim()}`;
      }
    );
    text = text.replace(
      /(?:,\s*|\s+)(?:and\s+)?(?:then\s+)?(?:(?:verify|confirm|ensure)(?:\s+(?:that|if|whether))?|check\s+(?:that|if|whether))(?:\s+.*)?$/i,
      ""
    );
    return text;
  }
  function extractExecutionConstraints(text) {
    if (!text || typeof text !== "string") {
      return {
        constraints: [],
        stopCondition: null,
        approvalRequirement: null,
        requireApprovalBeforeSend: false,
        doNotSend: false,
        doNotSubmit: false,
        doNotBuy: false
      };
    }
    const constraints = [];
    let stopCondition = null;
    let approvalRequirement = null;
    let requireApprovalBeforeSend = false;
    let doNotSend = false;
    let doNotSubmit = false;
    let doNotBuy = false;
    const lower = text.toLowerCase();
    if (/\b(?:do\s+not\s+send(?:\s+it)?|don'?t\s+(?:click\s+)?send(?:\s+it)?|never\s+send)\b(?!\s*until\s+i\s+approve)/i.test(lower)) {
      constraints.push("DO_NOT_SEND");
      doNotSend = true;
      if (!stopCondition) stopCondition = "DO_NOT_SEND";
    }
    if (/\b(?:do\s+not\s+submit(?:\s+it)?|don'?t\s+(?:click\s+)?submit(?:\s+it)?|never\s+submit)\b/i.test(lower)) {
      constraints.push("DO_NOT_SUBMIT");
      doNotSubmit = true;
      if (!stopCondition) stopCondition = "DO_NOT_SUBMIT";
    }
    if (/\b(?:do\s+not\s+(?:buy|purchase|checkout|order)(?:\s+it)?|don'?t\s+(?:buy|purchase|checkout|order)(?:\s+it)?|never\s+(?:buy|purchase))\b/i.test(lower)) {
      constraints.push("DO_NOT_BUY");
      doNotBuy = true;
      if (!stopCondition) stopCondition = "DO_NOT_BUY";
    }
    if (/\b(?:stop\s+after\s+filling(?:\s+the\s+reply)?|stop\s+before\s+sending|pause\s+after\s+filling|halt\s+after\s+filling)\b/i.test(lower)) {
      constraints.push("STOP_AFTER_FILLING");
      stopCondition = "AFTER_FILL";
    }
    if (/\b(?:and\s+wait|prepare\s+.*and\s+wait|wait\s+for\s+user|just\s+prepare\s+it)\b/i.test(lower)) {
      constraints.push("WAIT_FOR_USER");
      if (!stopCondition) stopCondition = "WAIT_FOR_USER";
    }
    const approvalBeforeSendRegex = /\b(?:(?:ask|get)\s+(?:me\s+)?(?:for\s+)?(?:my\s+)?(?:approval|confirmation)\s+before\s+send(?:ing)?|ask\s+me\s+before\s+send(?:ing)?|get\s+(?:my\s+)?approval\s+before\s+send(?:ing)?|wait\s+for\s+(?:my\s+approval|approval|me)\s+before\s+send(?:ing)?|require\s+(?:my\s+)?(?:approval|confirmation)(?:\s+before\s+send(?:ing)?)?|confirm\s+with\s+me\s+before\s+send(?:ing)?|check\s+with\s+me\s+before\s+send(?:ing)?|(?:don'?t|do\s+not)\s+send(?:\s+it)?\s+until\s+i\s+approve|send\s+only\s+after\s+i\s+approve|only\s+send\s+after\s+(?:my\s+approval|approval|i\s+approve)|confirmation\s+first|wait\s+for\s+approval|need\s+approval|approval\s+before\s+send(?:ing)?)(?:\s+it)?\b/i;
    if (approvalBeforeSendRegex.test(lower)) {
      constraints.push("REQUIRE_APPROVAL_BEFORE_SEND");
      requireApprovalBeforeSend = true;
      approvalRequirement = "HUMAN_CONFIRMATION_BEFORE_SEND";
    }
    return {
      constraints,
      stopCondition,
      approvalRequirement,
      requireApprovalBeforeSend,
      doNotSend,
      doNotSubmit,
      doNotBuy
    };
  }
  function stripExecutionControlPhrases(text) {
    if (!text || typeof text !== "string") return "";
    let s = text;
    s = s.replace(
      /(?:,\s*|\s+)?(?:\b(?:but|and\s+then|and|then|also)\b\s*)?\b(?:(?:ask|get)\s+(?:me\s+)?(?:for\s+)?(?:my\s+)?(?:approval|confirmation)\s+before\s+send(?:ing)?|ask\s+me\s+before\s+send(?:ing)?|get\s+(?:my\s+)?approval\s+before\s+send(?:ing)?|wait\s+for\s+(?:my\s+approval|approval|me)\s+before\s+send(?:ing)?|require\s+(?:my\s+)?(?:approval|confirmation)(?:\s+before\s+send(?:ing)?)?|confirm\s+with\s+me\s+before\s+send(?:ing)?|check\s+with\s+me\s+before\s+send(?:ing)?|(?:don'?t|do\s+not)\s+send(?:\s+it)?\s+until\s+i\s+approve|send\s+only\s+after\s+i\s+approve|only\s+send\s+after\s+(?:my\s+approval|approval|i\s+approve)|confirmation\s+first|wait\s+for\s+approval|need\s+approval|approval\s+before\s+send(?:ing)?)(?:\s+it)?\b[.,;!?]?/gi,
      " "
    );
    s = s.replace(/(?:,\s*|\s+)?(?:\b(?:but|and\s+then|and|then|also)\b\s*)?\b(?:stop\s+after\s+filling(?:\s+the\s+reply)?|stop\s+before\s+sending|pause\s+after\s+filling|halt\s+after\s+filling)\b[.,;!?]?/gi, " ");
    s = s.replace(/(?:,\s*|\s+)?(?:\b(?:but|and\s+then|and|then|also)\b\s*)?\b(?:do\s+not\s+send(?:\s+it)?|don'?t\s+(?:click\s+)?send(?:\s+it)?|never\s+send)(?!\s*until\s+i\s+approve)\b[.,;!?]?/gi, " ");
    s = s.replace(/(?:,\s*|\s+)?(?:\b(?:but|and\s+then|and|then|also)\b\s*)?\b(?:do\s+not\s+submit(?:\s+it)?|don'?t\s+(?:click\s+)?submit(?:\s+it)?|never\s+submit)\b[.,;!?]?/gi, " ");
    s = s.replace(/(?:,\s*|\s+)?(?:\b(?:but|and\s+then|and|then|also)\b\s*)?\b(?:do\s+not\s+(?:buy|purchase|checkout|order)(?:\s+it)?|don'?t\s+(?:buy|purchase|checkout|order)(?:\s+it)?|never\s+(?:buy|purchase))\b[.,;!?]?/gi, " ");
    s = s.replace(/(?:,\s*|\s+)?(?:\b(?:and\s+then|and|then)\b\s*)?\b(?:wait\s+for\s+user|just\s+prepare\s+it|wait)\b[.,;!?]?/gi, " ");
    s = s.replace(/\s+(?:but|and|then|also|after\s+that)\s*$/i, "");
    return s.replace(/\s+/g, " ").trim().replace(/[.,;!?]+$/, "").trim();
  }
  function parseReplyWorkflow(text, constraints) {
    if (!text || typeof text !== "string") return null;
    const t = text.trim();
    const replyWithMatch = t.match(/^(?:reply|draft\s+(?:a\s+)?reply|write\s+(?:a\s+)?reply|prepare\s+(?:a\s+)?reply)(?:\s+(?:to\s+)?(?:the\s+)?(?:currently\s+)?(?:open\s+)?(?:this\s+)?(?:email|mail|message))?\s*(?:saying|with\s*[:\s]+|:\s*)(.+)$/i);
    if (replyWithMatch) {
      let replyBody = replyWithMatch[1].trim();
      const leadingDoubleMatch = replyBody.match(/^["“”]([\s\S]*?)["”]/);
      const leadingSingleMatch = replyBody.match(/^['‘’]([\s\S]*?)['’]/);
      if (leadingDoubleMatch) {
        replyBody = leadingDoubleMatch[1].trim();
      } else if (leadingSingleMatch) {
        replyBody = leadingSingleMatch[1].trim();
      } else {
        replyBody = cleanValue(replyBody);
      }
      if (!replyBody) replyBody = "...";
      const steps = [
        {
          type: "CLICK",
          targetHint: "Reply",
          target: "Reply",
          expectedRole: "button",
          role: "button",
          semanticTarget: "Reply",
          legacyTarget: null
        },
        {
          type: "FILL",
          fieldHint: "Reply message body",
          expectedRole: "textarea/contenteditable",
          role: "textarea/contenteditable",
          semanticTarget: "Reply message body",
          value: replyBody
        }
      ];
      if (constraints && constraints.requireApprovalBeforeSend && !constraints.doNotSend) {
        steps.push({
          type: "CLICK",
          targetHint: "Send",
          target: "Send",
          expectedRole: "button",
          role: "button",
          semanticTarget: "Send",
          requiresApproval: true,
          risk: "HIGH",
          riskLevel: "HIGH",
          legacyTarget: resolveLegacyClickTarget("Send")
        });
      }
      return steps;
    }
    const standaloneReplyMatch = t.match(/^(?:reply|draft\s+(?:a\s+)?reply|write\s+(?:a\s+)?reply)(?:\s+(?:to\s+)?(?:the\s+)?(?:currently\s+)?(?:open\s+)?(?:this\s+)?(?:email|mail|message))?$/i);
    if (standaloneReplyMatch) {
      const isDraft = /\bdraft\b/i.test(t);
      const steps = [
        {
          type: "CLICK",
          targetHint: "Reply",
          target: "Reply",
          expectedRole: "button",
          role: "button",
          semanticTarget: "Reply",
          legacyTarget: null
        }
      ];
      if (isDraft) {
        steps.push({
          type: "FILL",
          fieldHint: "Reply message body",
          expectedRole: "textarea/contenteditable",
          role: "textarea/contenteditable",
          semanticTarget: "Reply message body",
          value: ""
        });
      }
      if (constraints && constraints.requireApprovalBeforeSend && !constraints.doNotSend) {
        steps.push({
          type: "CLICK",
          targetHint: "Send",
          target: "Send",
          expectedRole: "button",
          role: "button",
          semanticTarget: "Send",
          requiresApproval: true,
          risk: "HIGH",
          riskLevel: "HIGH",
          legacyTarget: resolveLegacyClickTarget("Send")
        });
      }
      return steps;
    }
    return null;
  }
  function parsePlatformSearchWorkflow(rawTask) {
    if (!rawTask || typeof rawTask !== "string") return null;
    const text = (rawTask || "").trim().replace(/[.!?]+$/, "");
    if (!text) return null;
    const m = text.match(/^search\s+(?:in\s+|on\s+)?([a-zA-Z0-9_\-\s]+?)\s+for\s+(.+?)(?:\s*(?:,\s*|\s+)(?:and\s+then|and|then)\s+(?:open|click|select|choose|visit|view)\s+(?:the\s+)?(.+))?$/i);
    if (m) {
      const platform = m[1].trim();
      const rawQuery = m[2].trim();
      const postActionTarget = m[3] ? m[3].trim() : null;
      const query = cleanValue(rawQuery);
      if (/^(?:the|a|an|all|my|this|that|in|on|at|for)$/i.test(platform)) return null;
      const pLower = platform.toLowerCase();
      let searchTarget = "search";
      if (pLower === "gmail" || pLower === "mail" || pLower === "search mail") {
        searchTarget = "Search mail";
      } else if (pLower === "youtube") {
        searchTarget = "search";
      } else if (pLower === "amazon") {
        searchTarget = "search";
      }
      const isGeneralSearch = searchTarget === "search";
      const stepTarget = isGeneralSearch ? "PRIMARY_SEARCH_INPUT" : searchTarget;
      const stepRole = isGeneralSearch ? "PRIMARY_SEARCH_INPUT" : "input";
      const steps = [
        {
          type: "FILL",
          fieldHint: searchTarget,
          target: stepTarget,
          targetRole: stepRole,
          expectedRole: stepRole,
          role: stepRole,
          semanticTarget: stepTarget,
          isSearchIntent: true,
          value: query
        },
        {
          type: "SUBMIT",
          targetHint: searchTarget,
          target: stepTarget,
          semanticTarget: stepTarget,
          query
        }
      ];
      if (postActionTarget) {
        const isFirst = /\b(?:first|1st|top)\s+result\b/i.test(postActionTarget);
        const isMostRelevant = /\b(?:most\s+relevant|relevant|best)\s+result\b/i.test(postActionTarget);
        const concreteTarget = resolveConcreteSearchTarget(query, postActionTarget);
        const concreteDomain = KNOWN_ENTITY_DOMAINS[query.toLowerCase()] || null;
        steps.push({
          type: "CLICK",
          action: "CLICK",
          targetHint: concreteTarget,
          target: concreteTarget,
          semanticTarget: concreteTarget,
          query,
          domain: concreteDomain,
          isSearchResult: true,
          isProductSelection: true,
          isFirstResult: isFirst,
          isMostRelevant,
          ordinal: isFirst ? 1 : null,
          role: "link",
          expectedRole: "link",
          isExplicitTarget: false
        });
      }
      return steps;
    }
    return null;
  }
  const KNOWN_ENTITY_DOMAINS = {
    isro: "isro.gov.in",
    linkedin: "linkedin.com",
    github: "github.com",
    google: "google.com",
    wikipedia: "wikipedia.org",
    youtube: "youtube.com",
    twitter: "twitter.com",
    x: "x.com",
    amazon: "amazon.in",
    nasa: "nasa.gov",
    apple: "apple.com",
    microsoft: "microsoft.com",
    facebook: "facebook.com",
    instagram: "instagram.com",
    reddit: "reddit.com"
  };
  function isAbstractTarget(target) {
    if (!target) return true;
    const t = target.trim().toLowerCase();
    return /^(?:most\s+relevant\s+result|most\s+relavent\s+result|relevant\s+result|correct\s+result|appropriate\s+result|the\s+result|result|the\s+website|website|the\s+site|site|the\s+page|page|the\s+link|link|the\s+product|product|most\s+relevant\s+product|it|that|this|them|first\s+result|top\s+result)$/i.test(t);
  }
  function resolveConcreteSearchTarget(query, candidate = "", entity = null, intent = null) {
    const q = (query || "").trim();
    const qLower = q.toLowerCase();
    const candLower = (candidate || "").toLowerCase().trim();
    const intentLower = (intent || "").toLowerCase().trim();
    if (candLower.includes("profile") || intentLower.includes("profile") || /\bprofile\b/i.test(candLower)) {
      if (candLower.includes("linkedin") || /linkedin\b/i.test(candLower)) {
        return `${q} LinkedIn profile`;
      }
      if (entity && entity.name) {
        return entity.name;
      }
      return `${q} profile`;
    }
    const isOfficial = /official/i.test(candLower) || /official/i.test(intentLower);
    const isWebsite = /\b(?:website|site|webpage|page|portal)\b/i.test(candLower) || /\b(?:website|site|webpage|page|portal)\b/i.test(intentLower);
    if (isOfficial || isWebsite) {
      if (qLower === "isro") {
        return "official ISRO website (isro.gov.in)";
      }
      if (qLower === "linkedin") {
        return "LinkedIn official website";
      }
      const knownDomain = KNOWN_ENTITY_DOMAINS[qLower];
      if (knownDomain && isOfficial) {
        return `official ${q} website (${knownDomain})`;
      }
      if (isOfficial) {
        return `${q} official website`;
      }
      return `${q} website`;
    }
    if (candidate && !isAbstractTarget(candidate)) {
      return candidate;
    }
    if (q) {
      if (qLower === "isro") {
        return "official ISRO website (isro.gov.in)";
      }
      if (qLower === "linkedin") {
        return "LinkedIn official website";
      }
      return `${q} official website`;
    }
    return candidate || "search result";
  }
  function parseSearchWorkflow(rawTask) {
    let text = (rawTask || "").trim().replace(/[.!?]+$/, "");
    if (!text) return null;
    text = text.replace(/(?:,\s*|\s+)(?:and\s+then|and|then|\.{3,}|…)+$/i, "").trim();
    const openOnSiteMatch = !/\b(?:and\s+then|and|then)\s+(?:search|find|open|click|select|fill|type)\b/i.test(text) && text.match(/^(?:open|find|locate|search\s+for|view)\s+(?:the\s+)?(.+?)\s+(?:on|in|at)\s+(?:the\s+)?([a-zA-Z0-9_\-]+(?:\s+[a-zA-Z0-9_\-]+){0,2})(?:\s+website|\s+site)?$/i);
    if (openOnSiteMatch) {
      const rawTarget = openOnSiteMatch[1].trim();
      const site = openOnSiteMatch[2].trim();
      if (!/^(?:search\s*(?:box|input|field|bar|area)?)$/i.test(rawTarget)) {
        const isKnownSiteOrPlatform = /\b(?:website|site|platform|portal|page)\b/i.test(openOnSiteMatch[0]) || /^(?:linkedin|youtube|amazon|google|wikipedia|github|twitter|isro|reddit|facebook|instagram)\b/i.test(site);
        if (isKnownSiteOrPlatform) {
          let query2 = rawTarget;
          let targetEntity2 = null;
          let targetIntent2 = null;
          const possMatch = rawTarget.match(/^(.+?)['’]s\s+(profile|page|account|details)$/i);
          if (possMatch) {
            query2 = possMatch[1].trim();
            targetIntent2 = possMatch[2].toLowerCase();
            targetEntity2 = { type: targetIntent2 === "profile" ? "person" : "item", name: query2 };
          }
          const steps2 = [
            {
              type: "FILL",
              fieldHint: "search",
              value: query2
            },
            {
              type: "SUBMIT",
              targetHint: "search",
              query: query2
            },
            {
              type: "CLICK",
              action: "OPEN",
              semanticAction: "OPEN",
              targetHint: rawTarget,
              target: rawTarget,
              semanticTarget: rawTarget,
              query: query2,
              isProductSelection: true,
              isExplicitTarget: !targetEntity2,
              explicitTarget: !targetEntity2 ? rawTarget : null,
              targetEntity: targetEntity2 || null,
              targetIntent: targetIntent2 || null,
              semanticCategory: targetEntity2 ? targetEntity2.type : "generic",
              isSemantic: Boolean(targetEntity2)
            }
          ];
          return steps2;
        }
      }
    }
    const navPrefixMatch = text.match(/^(?:open|go\s+to|navigate\s+to|launch|visit)\s+(?:the\s+)?((?:(?!\b(?:and|then|after\s+that|next|followed\s+by|also)\b)[a-zA-Z0-9_\-])+(?:\s+(?!\b(?:and|then|after\s+that|next|followed\s+by|also)\b)[a-zA-Z0-9_\-]+)*)\s*(?:,\s*|\s+)?(?:\b(?:and\s+then|and|then|after\s+that|next|followed\s+by|also)\b\s*)?(?=\b(?:search|find|look\s+for)\b)/i);
    let navTarget = null;
    let searchTaskText = text;
    if (navPrefixMatch) {
      navTarget = navPrefixMatch[1].trim().replace(/\s+(?:and\s+then|and|then|after\s+that|next|followed\s+by|also)$/i, "").trim();
      searchTaskText = text.substring(navPrefixMatch[0].length).trim();
    }
    let query = extractTaskQueryOrValue(searchTaskText);
    if (!query && navTarget) {
      const mFindNav = searchTaskText.match(/\b(?:find|look\s+for)\s+(?:the\s+)?['"]?([^'",;]+?)['"]?(?:\s*(?:,\s*|\s+)(?:\b(?:and\s+then|and|then|after\s+that|next|followed\s+by|also)\b\s*)?(?:identify|find|open|click|select|choose|visit|view|launch|pick|tap|press|add)\b|\s*[,;]|$)/i);
      if (mFindNav) {
        query = cleanValue(mFindNav[1]);
      }
    }
    if (!query) return null;
    if (/^(?:enter|type|put|write|fill|set)\b/i.test(searchTaskText) && !/\b(?:and\s+then|and|then)\s+(?:search|find)\b/i.test(searchTaskText)) {
      return null;
    }
    if (navTarget) {
      if (!/\b(?:search|find|look\s+for)\b/i.test(searchTaskText)) return null;
    } else {
      if (!/\bsearch\b/i.test(searchTaskText)) return null;
    }
    const hasSearchBoxPrefix = /^(?:find|locate|go\s+to|click)\s+(?:on\s+)?(?:the\s+)?(?:search\s+(?:box|input|field|bar|area)|search)(?:\s+(?:in|on|at|of)\s+[a-zA-Z0-9_\-]+)?\b/i.test(searchTaskText);
    let isExplicitTarget = false;
    let explicitTarget = null;
    let isMostRelevant = false;
    let hasProductOpen = false;
    let productTarget = null;
    let targetEntity = null;
    let targetIntent = null;
    let actionVerb = "OPEN";
    let candidate = null;
    const calledTargetMatch = searchTaskText.match(/(?:identify|find|select|choose|open|click|visit|view)\s+(?:on\s+)?(?:the\s+)?(?:(?:most\s+relevant|actual|first|top|selected|chosen|official|main|verified|primary)\s+)*(?:product|result|item|listing|video|movie|article|song|track|stream|content|website|site|webpage|page|link|portal|entry)?\s*(?:called|named|titled|with\s+(?:the\s+)?name|with\s+(?:the\s+)?title)\s+['"]?([^'",;]+?)['"]?(?:\s*[,;.]|\s+(?:and|then)|$)/i);
    if (calledTargetMatch) {
      explicitTarget = calledTargetMatch[1].trim();
      isExplicitTarget = true;
      isMostRelevant = false;
      hasProductOpen = true;
      productTarget = explicitTarget;
    } else {
      const postSearchActionMatch = searchTaskText.match(/(?:,\s*|\s+)(?:\b(?:and\s+then|and|then|after\s+that|next|followed\s+by|also)\b\s*)?(?:identify|find|select|choose|open|click|visit|view|launch|pick|tap|press)\s+(?:on\s+)?(?:the\s+)?([^,;]+?)(?:\s*[,;.]|\s+(?:and\s+then|and|then|after\s+that|next|followed\s+by|also)\s+(?:find|locate|click|press|tap|play|add)|$)/i);
      if (postSearchActionMatch) {
        candidate = postSearchActionMatch[1].trim();
        const isPronoun = /^(?:it|that|this|them)$/i.test(candidate);
        const isOrdinalResult = /\b(?:first|second|third|top|last)\s+result\b/i.test(candidate);
        const isGeneric = /^(?:(?:most\s+relevant|relevant|actual|first|second|third|top|selected|chosen|official|main|verified|primary)\s+)*(?:product|result|item|listing|video|movie|article|song|track|stream|content|website|site|webpage|page|link|portal|entry|it|that|this|them)$/i.test(candidate);
        const isContextual = !isPronoun && !isOrdinalResult && (isContextualReference(candidate) || isContextualReference("the " + candidate) || /^(?:profile|product(?:\s+page)?|page|item|email|message|post|person)$/i.test(candidate) || typeof semanticResolver !== "undefined" && semanticResolver && semanticResolver.isContextualReference && (semanticResolver.isContextualReference(candidate) || semanticResolver.isContextualReference("the " + candidate)));
        const qLower = (query || "").toLowerCase().trim();
        const candLower = candidate.toLowerCase().trim();
        const isOfficialOrSite = /\b(?:official\s+)?(?:website|site)\b/i.test(candidate) || qLower && candLower.includes(qLower) && /\b(?:website|site|portal)\b/i.test(candLower);
        const isExternalProfileSearch = !navTarget && (candLower.includes("linkedin") || candLower.includes("profile") && !/^(?:his|her|their|my)\s+profile$/i.test(candidate));
        if (isOfficialOrSite || isExternalProfileSearch) {
          const concrete = resolveConcreteSearchTarget(query, candidate, null, isExternalProfileSearch ? "profile" : null);
          productTarget = concrete;
          hasProductOpen = true;
          isExplicitTarget = false;
          explicitTarget = null;
          isMostRelevant = false;
          actionVerb = "CLICK";
        } else if (isContextual) {
          const cIntent = extractContextualIntent(candidate);
          const eType = inferEntityType(candidate, cIntent);
          targetEntity = {
            type: eType,
            name: query
          };
          targetIntent = cIntent;
          isExplicitTarget = false;
          explicitTarget = null;
          isMostRelevant = false;
          hasProductOpen = true;
          productTarget = candidate.toLowerCase().includes("first result") ? "first result" : query;
          actionVerb = "OPEN";
        } else if (!isGeneric) {
          explicitTarget = candidate;
          isExplicitTarget = true;
          isMostRelevant = false;
          hasProductOpen = true;
          productTarget = explicitTarget;
        } else {
          isMostRelevant = /\b(?:most\s+relevant|relevant)\b/i.test(candidate) || isPronoun;
          isExplicitTarget = false;
          hasProductOpen = true;
          productTarget = isPronoun ? "most relevant result" : candidate;
        }
      } else if (/\bopen\s+(?:it|that|the\s+product|the\s+result|the\s+video|the\s+item|the\s+website|the\s+site|the\s+page|the\s+link)\b/i.test(searchTaskText)) {
        hasProductOpen = true;
        const isWeb = /\b(?:the\s+)?(?:website|site)\b/i.test(searchTaskText);
        if (query && isWeb) {
          productTarget = resolveConcreteSearchTarget(query, "website");
          actionVerb = "CLICK";
        } else {
          productTarget = "most relevant product";
        }
        isMostRelevant = false;
        isExplicitTarget = false;
      }
    }
    let trailingTarget = null;
    const trailingFindClickMatch = searchTaskText.match(/(?:open\s+(?:the\s+)?(?:(?:most\s+relevant|actual|first|top|selected|chosen|official|main|verified|primary)\s+)*(?:[a-zA-Z0-9_\-]+\s+)?(?:product|result|item|listing|video|movie|article|song|track|stream|content|website|site|webpage|page|link|portal|entry|it)|open\s+it)\s*(?:,\s*|\s+)(?:and\s+)?(?:then\s+)?(?:find|locate|search\s+for)\s+(?:the\s+)?(.+?)\s*(?:,\s*|\s+)(?:and\s+)?(?:then\s+)?(?:click|press|tap)\s+(?:on\s+)?(?:it|that|this)\b/i);
    if (trailingFindClickMatch) {
      trailingTarget = trailingFindClickMatch[1].trim();
    } else {
      const trailingClickMatch = searchTaskText.match(/(?:open\s+(?:the\s+)?(?:(?:most\s+relevant|actual|first|top|selected|chosen|official|main|verified|primary)\s+)*(?:[a-zA-Z0-9_\-]+\s+)?(?:product|result|item|listing|video|movie|article|song|track|stream|content|website|site|webpage|page|link|portal|entry|it)|open\s+it)\s*(?:,\s*|\s+)(?:and\s+)?(?:then\s+)?(?:click|press|tap)\s+(?:on\s+)?(?:the\s+)?([a-zA-Z0-9_\-\s]+?)(?:\s+button)?$/i);
      if (trailingClickMatch) {
        trailingTarget = trailingClickMatch[1].trim();
      } else {
        const trailingPlayMatch = searchTaskText.match(/(?:,\s*|\s+)(?:and\s+)?(?:then\s+)?(?:click\s+(?:on\s+)?(?:the\s+)?play(?:\s+button|\s+icon)?|play\s+(?:it|the\s+video|that|this)?|start\s+(?:playing|the\s+video)?)\b/i);
        if (trailingPlayMatch) {
          trailingTarget = "play";
        } else {
          const trailingAddToCartMatch = searchTaskText.match(/(?:,\s*|\s+)(?:and\s+)?(?:then\s+)?(?:add\s+(?:it\s+)?to\s+(?:the\s+)?cart|click\s+(?:on\s+)?(?:the\s+)?add\s+to\s+cart(?:\s+button)?)\b/i);
          if (trailingAddToCartMatch) {
            trailingTarget = "Add to Cart button";
          }
        }
      }
    }
    const steps = [];
    if (navTarget) {
      steps.push({
        type: "NAVIGATE",
        action: "NAVIGATE",
        targetHint: navTarget,
        target: navTarget,
        url: resolveNavigationUrl(navTarget),
        isNavigation: true,
        legacyTarget: null
      });
    }
    if (hasSearchBoxPrefix && (hasProductOpen || trailingTarget)) {
      steps.push({
        type: "CLICK",
        targetHint: "search box",
        legacyTarget: "SEARCH_INPUT"
      });
    }
    steps.push({
      type: "FILL",
      fieldHint: "search",
      target: "PRIMARY_SEARCH_INPUT",
      targetRole: "PRIMARY_SEARCH_INPUT",
      expectedRole: "PRIMARY_SEARCH_INPUT",
      role: "PRIMARY_SEARCH_INPUT",
      semanticTarget: "PRIMARY_SEARCH_INPUT",
      isSearchIntent: true,
      value: query
    });
    steps.push({
      type: "SUBMIT",
      targetHint: "search",
      target: "PRIMARY_SEARCH_INPUT",
      semanticTarget: "PRIMARY_SEARCH_INPUT",
      query
    });
    if (hasProductOpen) {
      const semanticDesc = typeof semanticResolver !== "undefined" && semanticResolver ? semanticResolver.extractSemanticDescriptor(productTarget) : {};
      const finalCategory = targetEntity ? targetEntity.type : semanticDesc.category || "product";
      const isFirstResult = productTarget && productTarget.toLowerCase().includes("first result") || candidate && candidate.toLowerCase().includes("first result");
      const finalOrdinal = isFirstResult ? 1 : semanticDesc.ordinal !== void 0 ? semanticDesc.ordinal : null;
      const finalTarget = targetEntity ? targetEntity.name : productTarget;
      const concreteDomain = query && KNOWN_ENTITY_DOMAINS[query.toLowerCase()] || null;
      steps.push({
        type: "CLICK",
        action: actionVerb || "CLICK",
        targetHint: finalTarget,
        target: finalTarget,
        semanticTarget: finalTarget,
        query,
        domain: concreteDomain,
        isSearchResult: true,
        isProductSelection: true,
        isFirstResult,
        isExplicitTarget,
        explicitTarget: explicitTarget || null,
        targetEntity: targetEntity || null,
        targetIntent: targetIntent || null,
        isMostRelevant,
        semanticCategory: finalCategory,
        ranking: semanticDesc.ranking || null,
        ordinal: finalOrdinal,
        spatial: semanticDesc.spatial || null,
        isSemantic: !!(targetEntity || semanticDesc.isSemantic || finalOrdinal !== null),
        role: "link",
        expectedRole: "link"
      });
    }
    if (trailingTarget) {
      const cleanTrailing = trailingTarget.trim();
      steps.push({
        type: "CLICK",
        targetHint: cleanTrailing,
        legacyTarget: resolveLegacyClickTarget(cleanTrailing)
      });
    }
    return steps.length > 0 ? steps : null;
  }
  let currentActiveConstraints = null;
  function parseTask(rawTask, isSubCall = false) {
    if (!rawTask || !rawTask.trim()) {
      return createNoneResult("Empty task", !isSubCall ? currentActiveConstraints : null);
    }
    const cleanRawTask = rawTask.trim().replace(
      /(?:,\s*|\s+)(?:and\s+)?(?:then\s+)?(?:(?:verify|confirm|ensure)(?:\s+(?:that|if|whether))?|check\s+(?:that|if|whether))(?:\s+.*)?$/i,
      ""
    );
    let executionConstraints;
    if (!isSubCall) {
      executionConstraints = extractExecutionConstraints(cleanRawTask);
      currentActiveConstraints = executionConstraints;
    } else {
      executionConstraints = currentActiveConstraints || {
        constraints: [],
        stopCondition: null,
        approvalRequirement: null,
        requireApprovalBeforeSend: false,
        doNotSend: false
      };
    }
    const taskWithoutControls = executionConstraints.constraints.length > 0 ? stripExecutionControlPhrases(cleanRawTask) : cleanRawTask;
    const platformSearchSteps = parsePlatformSearchWorkflow(taskWithoutControls);
    if (platformSearchSteps && platformSearchSteps.length > 0) {
      return buildResultFromSteps(platformSearchSteps, executionConstraints);
    }
    const replySteps = parseReplyWorkflow(taskWithoutControls, executionConstraints);
    if (replySteps && replySteps.length > 0) {
      return buildResultFromSteps(replySteps, executionConstraints);
    }
    const multiStageSplitPattern = /(?<=(?:open|click|select|view)\s+(?:on\s+)?(?:the\s+)?(?:(?:most\s+relevant|actual|first|top|selected|chosen|official|main|verified|primary)\s+)*(?:[a-zA-Z0-9_\-]+\s+)?(?:product|result|item|listing|video|movie|article|email|mail|message|song|track|stream|content|website|site|webpage|page|link|portal|entry|it|that|them))\s*(?:,\s*(?:then|and\s+then|and)?|\s+(?:then|and\s+then)|\s*;\s*(?:then)?|\.\s*|\s+after\s+opening\s+[^,;]+,?\s*)\s*(?=(?:(?:find|locate|go\s+to|click|select|open|view)\b|search\b|compose\b|enter\b|type\b|fill\b|send\b|write\b|reply\b|draft\b))/i;
    let stageParts = taskWithoutControls.split(multiStageSplitPattern);
    if (stageParts.length <= 1) {
      const legacyPattern = /(?:,\s*then|\s+then|\s*;\s*then|\s*,\s*and\s+then|\s+and\s+then|\s+after\s+opening\s+(?:it|the\s+result|the\s+product|that|the\s+video|the\s+item))\s+(?=(?:find|locate|go\s+to|click|search|on\b|in\b))/i;
      const legacyParts = taskWithoutControls.split(legacyPattern);
      if (legacyParts.length > 1 && legacyParts.every((p) => /\bsearch\b/i.test(p))) {
        stageParts = legacyParts;
      }
    }
    if (stageParts.length > 1) {
      let combinedSteps = [];
      let currentTaskEntity = null;
      let allValid = true;
      for (const part of stageParts) {
        const trimmedPart = part.trim();
        const stageWorkflow = parseSearchWorkflow(trimmedPart);
        if (stageWorkflow && stageWorkflow.length > 0) {
          combinedSteps = combinedSteps.concat(stageWorkflow);
          const lastSt = stageWorkflow[stageWorkflow.length - 1];
          currentTaskEntity = extractEntityFromStep(lastSt) || currentTaskEntity;
        } else {
          const isCtxRef = isContextualReference(trimmedPart) || /^(?:open|click|view|select|visit)\s+(?:his|her|their|its|this|that|the)\s+(?:profile|product|page|email|message|item|result|first\s+result|person)\b/i.test(trimmedPart) || /^(?:open|click|view)\s+(?:it|this|that|them)$/i.test(trimmedPart);
          if (isCtxRef && currentTaskEntity) {
            const cIntent = extractContextualIntent(trimmedPart);
            const labelSuffix = cIntent && cIntent !== "open" ? " " + cIntent : "";
            combinedSteps.push({
              type: "CLICK",
              action: "OPEN",
              targetHint: `${currentTaskEntity.name}${labelSuffix}`,
              target: currentTaskEntity.name,
              semanticTarget: `${currentTaskEntity.name}${labelSuffix}`,
              targetEntity: currentTaskEntity,
              targetIntent: cIntent,
              isSemantic: true,
              semanticCategory: currentTaskEntity.type || "person"
            });
          } else {
            const subRes = parseTask(trimmedPart, true);
            if (subRes.intent !== "NONE" && Array.isArray(subRes.steps) && subRes.steps.length > 0 && subRes.steps[0].type !== "NONE") {
              combinedSteps = combinedSteps.concat(subRes.steps);
              const lastSt = subRes.steps[subRes.steps.length - 1];
              currentTaskEntity = extractEntityFromStep(lastSt) || currentTaskEntity;
            } else {
              allValid = false;
              break;
            }
          }
        }
      }
      if (allValid && combinedSteps.length > 0) {
        return buildResultFromSteps(combinedSteps, executionConstraints);
      }
    }
    const searchWorkflowSteps = parseSearchWorkflow(taskWithoutControls);
    if (searchWorkflowSteps && searchWorkflowSteps.length > 0) {
      return buildResultFromSteps(searchWorkflowSteps, executionConstraints);
    }
    const task = normalizeTaskPhrasing(taskWithoutControls);
    if (!task) {
      return createNoneResult("Empty task", executionConstraints);
    }
    const lower = task.toLowerCase();
    const wholeFormMatch = task.match(/^(?:fill|autofill|complete|populate)\s+(?:in\s+|out\s+)?(?:the\s+|this\s+|all\s+|my\s+|out\s+the\s+)?(?:form|details|fields|profile|information|registration\s+form|contact\s+form|simple\s+form)(?:\s+with\s+(?:my\s+|all\s+)?(?:details|information|profile|data))?(?:\s+simultaneously|\s+all\s+at\s+once)?$/i);
    if (wholeFormMatch) {
      return buildResultFromSteps([
        {
          type: "FILL_FORM",
          fieldHint: "all form fields",
          profileSource: "form-profile.json",
          simultaneous: true
        }
      ], executionConstraints);
    }
    const wholeFormThenClickMatch = task.match(/^(?:fill|autofill|complete|populate)\s+(?:in\s+|out\s+)?(?:the\s+|this\s+|all\s+|my\s+|out\s+the\s+)?(?:form|details|fields|profile|information|registration\s+form|contact\s+form|simple\s+form)(?:\s+with\s+(?:my\s+|all\s+)?(?:details|information|profile|data))?\s*(?:,\s*then|\s+then|\s*;\s*then|\s*,\s*and\s+then|\s+and\s+then|\s+and)\s+(?:click|press|tap|submit|send)\s+(?:on\s+)?(?:the\s+)?([a-z0-9_\-\s]+?)(?:\s+button)?$/i);
    if (wholeFormThenClickMatch) {
      let clickTarget = wholeFormThenClickMatch[1].trim();
      if (/^(?:it|this|that|them)$/i.test(clickTarget) || wholeFormThenClickMatch[0].toLowerCase().includes("submit")) {
        clickTarget = "submit";
      }
      const steps = [
        {
          type: "FILL_FORM",
          fieldHint: "all form fields",
          profileSource: "form-profile.json",
          simultaneous: true
        }
      ];
      if (!executionConstraints || !executionConstraints.doNotSubmit) {
        steps.push({
          type: "CLICK",
          targetHint: clickTarget,
          legacyTarget: resolveLegacyClickTarget(clickTarget)
        });
      }
      return buildResultFromSteps(steps, executionConstraints);
    }
    const actionClauses = splitActionClauses(task);
    const candidateSplit = actionClauses.length > 1 ? actionClauses : task.split(/\s*(?:,\s*then|\s+then|\s*;\s*then|\s*,\s*and\s+then|\s+and\s+then)\s+/i);
    if (candidateSplit.length > 1) {
      const parsedSeqSteps = [];
      let currentContext = null;
      let currentTaskEntity = null;
      let allValid = true;
      for (const part of candidateSplit) {
        const trimmedPart = part.trim();
        if (isPronounOrReference(trimmedPart) || /^(?:click|press|tap|select|use)\s+(?:on\s+)?(?:it|this|that|them|that\s+button|this\s+button|that\s+link|this\s+link|the\s+above|above|the\s+field|that\s+field|this\s+field|the\s+button|button|the\s+link|link)$/i.test(trimmedPart)) {
          if (parsedSeqSteps.length > 0) {
            const lastStep = parsedSeqSteps[parsedSeqSteps.length - 1];
            if (lastStep.type === "CLICK" || lastStep.type === "SELECT") {
              continue;
            }
          }
        }
        const isAddToCartClause = /^(?:add\s+(?:it\s+)?to\s+(?:the\s+)?cart|add\s+to\s+cart)$/i.test(trimmedPart);
        if (isAddToCartClause) {
          parsedSeqSteps.push({
            type: "CLICK",
            action: "CLICK",
            targetHint: "add_to_cart",
            target: "add_to_cart",
            legacyTarget: "ADD_TO_CART_BUTTON",
            targetEntity: currentTaskEntity || null,
            targetIntent: "add_to_cart"
          });
          continue;
        }
        const isCtxRef = isContextualReference(trimmedPart) || /^(?:open|click|view|select|visit)\s+(?:his|her|their|its|this|that|the)\s+(?:profile|product|page|email|message|item|result|first\s+result|person)\b/i.test(trimmedPart) || /^(?:open|click|view)\s+(?:it|this|that|them)$/i.test(trimmedPart);
        if (isCtxRef && currentTaskEntity) {
          const cIntent = extractContextualIntent(trimmedPart);
          parsedSeqSteps.push({
            type: "CLICK",
            action: "OPEN",
            targetHint: currentTaskEntity.name,
            target: currentTaskEntity.name,
            semanticTarget: currentTaskEntity.name,
            targetEntity: currentTaskEntity,
            targetIntent: cIntent,
            isSemantic: true,
            semanticCategory: currentTaskEntity.type || "person"
          });
          continue;
        }
        const multiFillNoVal = parseMultiFieldNoValClause(trimmedPart);
        if (multiFillNoVal) {
          parsedSeqSteps.push(...multiFillNoVal);
          continue;
        }
        const fill = parseFillClause(trimmedPart) || parseJuxtapositionFill(trimmedPart);
        if (fill) {
          parsedSeqSteps.push(fill);
          currentTaskEntity = extractEntityFromStep(fill) || currentTaskEntity;
        } else {
          const contextual = parseContextualClause(trimmedPart, currentContext);
          if (contextual) {
            parsedSeqSteps.push(contextual);
            currentTaskEntity = extractEntityFromStep(contextual) || currentTaskEntity;
            const activeCtx = resolveActiveContainerContext(contextual);
            if (activeCtx) {
              currentContext = activeCtx;
            }
          } else {
            const subRes = parseTask(trimmedPart, true);
            if (subRes.intent !== "NONE" && Array.isArray(subRes.steps) && subRes.steps.length > 0 && subRes.steps[0].type !== "NONE") {
              parsedSeqSteps.push(...subRes.steps);
              const last = subRes.steps[subRes.steps.length - 1];
              currentTaskEntity = extractEntityFromStep(last) || currentTaskEntity;
              const candCtx = resolveActiveContainerContext(last);
              if (candCtx) currentContext = candCtx;
            } else {
              allValid = false;
              break;
            }
          }
        }
      }
      if (allValid && parsedSeqSteps.length > 0) {
        parsedSeqSteps.forEach((step, sIdx) => {
          if (step.type === "NAVIGATE" && (step.targetHint || step.target)) {
            const targetNorm = (step.targetHint || step.target).toLowerCase();
            const hasContextualChild = parsedSeqSteps.slice(sIdx + 1).some(
              (nxt) => nxt.context && nxt.context.toLowerCase() === targetNorm
            );
            if (hasContextualChild) {
              step.type = "CLICK";
              step.action = "CLICK";
              delete step.url;
              delete step.isNavigation;
            }
          }
        });
        return buildResultFromSteps(parsedSeqSteps);
      }
    }
    const formWithItemsMatch = task.match(/^(?:fill|autofill|complete|populate)\s+(?:in\s+|into\s+|out\s+)?(?:(?:the|this|a|all)\s+)?(?:form|details|fields|profile|information|data)?\s*(?:with|:)\s*(.+)$/i);
    if (formWithItemsMatch) {
      const itemsBody = formWithItemsMatch[1].trim();
      let trailingSubmit = null;
      let fieldsOnlyText = itemsBody;
      const trailingSubmitMatch = itemsBody.match(/(?:,\s*then|\s+then|\s*;\s*then|\s*,\s*and\s+then|\s+and\s+then|\s*,\s*and|\s+and)\s+(?:click|press|tap|submit|send)\s+(?:on\s+)?(?:the\s+)?([a-z0-9_\-\s]+?)(?:\s+button)?$/i);
      if (trailingSubmitMatch) {
        trailingSubmit = trailingSubmitMatch[1].trim();
        fieldsOnlyText = itemsBody.substring(0, trailingSubmitMatch.index).trim();
      }
      const itemClauses = fieldsOnlyText.split(/\s*(?:,\s*and\s+|\s+and\s+|,\s*)\s*/i);
      const parsedFormSteps = [];
      for (const item of itemClauses) {
        const trimmed = item.trim();
        if (!trimmed) continue;
        const fill = parseFillClause(trimmed) || parseJuxtapositionFill(trimmed);
        if (fill) {
          parsedFormSteps.push(fill);
        }
      }
      if (parsedFormSteps.length > 0) {
        if (trailingSubmit) {
          parsedFormSteps.push({
            type: "CLICK",
            targetHint: trailingSubmit,
            legacyTarget: resolveLegacyClickTarget(trailingSubmit)
          });
        }
        return buildResultFromSteps(parsedFormSteps);
      }
    }
    const fillThenClickMatch = task.match(/^fill\s+(?:the\s+)?([a-z0-9_\-\s]+?)\s+and\s+(?:the\s+)?([a-z0-9_\-\s]+?)\s*,\s*then\s+(?:click|press)\s+(?:the\s+)?([a-z0-9_\-\s]+?)(?:\s+button)?$/i);
    if (fillThenClickMatch) {
      const field1 = fillThenClickMatch[1].trim();
      const field2 = fillThenClickMatch[2].trim();
      const clickTarget = fillThenClickMatch[3].trim();
      return buildResultFromSteps([
        { type: "FILL", fieldHint: field1, value: "..." },
        { type: "FILL", fieldHint: field2, value: "..." },
        {
          type: "CLICK",
          targetHint: clickTarget,
          legacyTarget: resolveLegacyClickTarget(clickTarget)
        }
      ]);
    }
    const andSplit = task.split(/\s*(?:,\s*and\s+|\s+and\s+(?!(?:above|up|over|higher|more)\b)|,\s*)\s*/i);
    if (andSplit.length > 1) {
      const parsedClauses = [];
      let allValid = true;
      for (const clause of andSplit) {
        const trimmedClause = clause.trim();
        if (/^(?:and\s+)?(?:then\s+)?(?:(?:verify|confirm|ensure)\b|check\s+(?:that|if|whether)\b)/i.test(trimmedClause)) {
          continue;
        }
        if (isPronounOrReference(trimmedClause) || /^(?:and\s+)?(?:then\s+)?(?:click|press|tap|select|use)\s+(?:on\s+)?(?:it|this|that|them|that\s+button|this\s+button|that\s+link|this\s+link|the\s+above|above|the\s+field|that\s+field|this\s+field|the\s+button|button|the\s+link|link)$/i.test(trimmedClause)) {
          if (parsedClauses.length > 0) {
            const lastStep = parsedClauses[parsedClauses.length - 1];
            if (lastStep.type === "CLICK") {
              continue;
            }
          }
          allValid = false;
          break;
        }
        const fillStep = parseFillClause(trimmedClause) || parseJuxtapositionFill(trimmedClause);
        if (fillStep) {
          if (parsedClauses.length > 0) {
            const prev = parsedClauses[parsedClauses.length - 1];
            if (prev.type === "CLICK") {
              const prevTarget = cleanFieldHint(prev.targetHint || "");
              if (prevTarget && prevTarget.toLowerCase() === fillStep.fieldHint.toLowerCase()) {
                parsedClauses.pop();
              }
            }
          }
          parsedClauses.push(fillStep);
        } else {
          const lastStep = parsedClauses.length > 0 ? parsedClauses[parsedClauses.length - 1] : null;
          const prevCtx = lastStep ? resolveActiveContainerContext(lastStep) : null;
          const contextualStep = parseContextualClause(trimmedClause, prevCtx);
          if (contextualStep) {
            parsedClauses.push(contextualStep);
          } else {
            const subTaskRes = parseTask(trimmedClause, true);
            if (subTaskRes.intent !== "NONE" && Array.isArray(subTaskRes.steps) && subTaskRes.steps.length > 0 && subTaskRes.steps[0].type !== "NONE") {
              parsedClauses.push(...subTaskRes.steps);
            } else {
              allValid = false;
              break;
            }
          }
        }
      }
      if (allValid && parsedClauses.length > 1) {
        return buildResultFromSteps(parsedClauses);
      }
    }
    const singleFill = parseFillClause(task);
    if (singleFill) {
      return buildResultFromSteps([singleFill]);
    }
    const scrollNumMatch = lower.match(/^scroll(?:\s+down)?\s+(\d+)(?:\s*(?:pixels|px))?$/i);
    if (scrollNumMatch) {
      const rawAmt = parseInt(scrollNumMatch[1], 10);
      const safeAmt = isNaN(rawAmt) ? DEFAULT_SCROLL_AMOUNT : Math.min(Math.max(rawAmt, 50), 1500);
      return buildResultFromSteps([
        {
          type: "SCROLL",
          target: "PAGE",
          amount: safeAmt
        }
      ]);
    }
    if (/^scroll(?:\s+down|\s+up)?(?:\s+a\s+bit|\s+more|\s+the\s+page|\s+page)?$/i.test(lower) || /^(?:view|read)\s+more$/i.test(lower) || /^scroll\s+to\s+/i.test(lower)) {
      return buildResultFromSteps([
        {
          type: "SCROLL",
          target: "PAGE",
          amount: DEFAULT_SCROLL_AMOUNT
        }
      ]);
    }
    const searchIntentMatch = task.match(/^search(?:\s+for)?\s+['"]?([^'"]+?)['"]?$/i);
    if (searchIntentMatch) {
      const query = searchIntentMatch[1].trim();
      if (query && !/^(?:the|a|an|input|box|field|button|it|that|this|them)$/i.test(query)) {
        return buildResultFromSteps([
          {
            type: "FILL",
            fieldHint: "search",
            target: "PRIMARY_SEARCH_INPUT",
            targetRole: "PRIMARY_SEARCH_INPUT",
            expectedRole: "PRIMARY_SEARCH_INPUT",
            role: "PRIMARY_SEARCH_INPUT",
            semanticTarget: "PRIMARY_SEARCH_INPUT",
            isSearchIntent: true,
            value: query
          },
          {
            type: "SUBMIT",
            targetHint: "search",
            target: "PRIMARY_SEARCH_INPUT",
            semanticTarget: "PRIMARY_SEARCH_INPUT",
            query
          }
        ]);
      }
    }
    const askAiMatch = task.match(/^(?:ask|chat\s+with|talk\s+to)\s+(?:the\s+)?([a-zA-Z0-9_\-\s]+?)\s+(?:about|regarding|for|to)\s+['"]?([^'"]+?)['"]?$/i) || task.match(/^(?:ask|chat\s+with|talk\s+to)\s+(?:the\s+)?(gemini|copilot|chatgpt|ai|assistant|ai\s+mode)\s+['"]?([^'"]+?)['"]?$/i);
    if (askAiMatch) {
      const assistant = cleanFieldHint(askAiMatch[1]);
      const aiQuery = cleanValue(askAiMatch[2]);
      if (assistant && aiQuery && !isPronounOrReference(assistant)) {
        return buildResultFromSteps([
          {
            type: "FILL",
            fieldHint: assistant,
            target: assistant,
            semanticTarget: assistant,
            targetRole: "AI_ASSISTANT_INPUT",
            expectedRole: "AI_ASSISTANT_INPUT",
            role: "AI_ASSISTANT_INPUT",
            isAiAssistantIntent: true,
            value: aiQuery
          },
          {
            type: "SUBMIT",
            targetHint: assistant,
            target: assistant,
            semanticTarget: assistant,
            query: aiQuery
          }
        ], executionConstraints);
      }
    }
    const contextualIntent = parseContextualClause(task);
    if (contextualIntent) {
      return buildResultFromSteps([contextualIntent]);
    }
    const labelledBtnMatch = task.match(/^(?:click|press|tap)\s+(?:on\s+)?(?:the\s+)?(?:button|link)\s+(?:labelled|labeled|named|with\s+text)\s+['"]?([a-zA-Z0-9_\-\s]+?)['"]?$/i);
    if (labelledBtnMatch) {
      const targetHint = labelledBtnMatch[1].trim().replace(/\s+(?:and\s+then|and|then|after\s+that|next|followed\s+by|also)$/i, "").trim();
      if (isPronounOrReference(targetHint)) {
        return createNoneResult("Cannot resolve pronoun target '" + targetHint + "' without prior clickable context");
      }
      return buildResultFromSteps([
        {
          type: "CLICK",
          targetHint,
          legacyTarget: resolveLegacyClickTarget(targetHint)
        }
      ]);
    }
    const openMatch = task.match(/^(?:open|navigate\s+to|go\s+to)\s+(?:the\s+)?([a-zA-Z0-9_\-.:\/\s]+?)(?:\s+page|\s+link|\s+tab)?$/i);
    if (openMatch) {
      const LOCATION_SUFFIX_PATTERN = /\s+(?:on\s+(?:the\s+)?(?:screen|page|webpage|site)|on\s+screen|here|in\s+(?:the\s+)?page)$/i;
      const targetHint = openMatch[1].trim().replace(/\s+(?:and\s+then|and|then|after\s+that|next|followed\s+by|also)$/i, "").replace(LOCATION_SUFFIX_PATTERN, "").trim();
      if (isPronounOrReference(targetHint)) {
        return createNoneResult("Cannot resolve pronoun target '" + targetHint + "' without prior clickable context");
      }
      const isUiContainer = /^(?:filters?|menu|dropdown|accordion|dialog|modal|panel|cart|popup|drawer|sidebar|section|tabs?|options?|settings?)$/i.test(targetHint.toLowerCase()) || /\b(?:section|panel|container|accordion|dropdown|filters?|modal|dialog|drawer|sidebar)\b/i.test(targetHint.toLowerCase());
      const navUrl = resolveNavigationUrl(targetHint);
      const isSemantic = semanticResolver ? semanticResolver.isSemanticInstruction(targetHint) : false;
      if (!navUrl || isSemantic || isUiContainer) {
        const desc = semanticResolver ? semanticResolver.extractSemanticDescriptor(targetHint) : {};
        return buildResultFromSteps([
          {
            type: "CLICK",
            action: "CLICK",
            targetHint,
            target: targetHint,
            semanticTarget: targetHint,
            semanticCategory: desc.category || null,
            ranking: desc.ranking || null,
            ordinal: desc.ordinal !== void 0 ? desc.ordinal : null,
            spatial: desc.spatial || null,
            attribute: desc.attribute || null,
            attributeValue: desc.attributeValue || null,
            objectTarget: desc.objectTarget || null,
            contentFilter: desc.contentFilter || null,
            senderFilter: desc.senderFilter || null,
            isSemantic: !!(desc.isSemantic || isSemantic),
            semanticTargetObject: desc.semanticTargetObject || null,
            legacyTarget: resolveLegacyClickTarget(targetHint)
          }
        ], executionConstraints);
      }
      return buildResultFromSteps([
        {
          type: "NAVIGATE",
          action: "NAVIGATE",
          targetHint,
          target: targetHint,
          url: navUrl,
          isNavigation: true,
          legacyTarget: resolveLegacyClickTarget(targetHint)
        }
      ], executionConstraints);
    }
    const clickMatch = task.match(/^(?:click|press|tap|find|locate|look\s+for)\s+(?:on\s+)?(?:the\s+)?([a-zA-Z0-9_\-\s]+?)(?:\s+button|\s+link)?$/i);
    if (clickMatch) {
      const LOCATION_SUFFIX_PATTERN = /\s+(?:on\s+(?:the\s+)?(?:screen|page|webpage|site)|on\s+screen|here|in\s+(?:the\s+)?page)$/i;
      const targetHint = clickMatch[1].trim().replace(/\s+(?:and\s+then|and|then|after\s+that|next|followed\s+by|also)$/i, "").replace(LOCATION_SUFFIX_PATTERN, "").trim();
      if (isPronounOrReference(targetHint)) {
        return createNoneResult("Cannot resolve pronoun target '" + targetHint + "' without prior clickable context");
      }
      const desc = semanticResolver ? semanticResolver.extractSemanticDescriptor(targetHint) : {};
      const attrConstraint = extractAttributeConstraint(targetHint);
      return buildResultFromSteps([
        {
          type: "CLICK",
          targetHint,
          target: targetHint,
          semanticTarget: targetHint,
          semanticCategory: desc.category || null,
          ranking: desc.ranking || null,
          ordinal: desc.ordinal !== void 0 ? desc.ordinal : null,
          spatial: desc.spatial || null,
          contentFilter: desc.contentFilter || null,
          senderFilter: desc.senderFilter || null,
          isSemantic: !!(desc.isSemantic || attrConstraint),
          objectTarget: attrConstraint ? attrConstraint.objectTarget : desc.objectTarget || null,
          attribute: attrConstraint ? attrConstraint.attribute : desc.attribute || null,
          attributeValue: attrConstraint ? attrConstraint.attributeValue : desc.attributeValue || null,
          semanticTargetObject: desc.semanticTargetObject || null,
          legacyTarget: resolveLegacyClickTarget(targetHint)
        }
      ], executionConstraints);
    }
    const composeRecipientMatch = task.match(/^compose(?:\s+(?:(?:a\s+|an\s+)?(?:new\s+)?(?:email|mail|message|letter|draft)))?\s+to\s+['"]?([^'",;]+?)['"]?$/i);
    if (composeRecipientMatch) {
      const recipient = cleanValue(composeRecipientMatch[1]);
      return buildResultFromSteps([
        {
          type: "CLICK",
          targetHint: "compose",
          legacyTarget: null
        },
        {
          type: "FILL",
          fieldHint: "recipient",
          value: recipient
        }
      ]);
    }
    const composeMatch = task.match(/^compose(?:\s+(?:(?:a\s+|an\s+)?(?:new\s+)?([a-zA-Z0-9_\-\s]+?)))?$/i);
    if (composeMatch) {
      return buildResultFromSteps([
        {
          type: "CLICK",
          targetHint: "compose",
          legacyTarget: null
        }
      ]);
    }
    const sendMatch = task.match(/^send(?:\s+(?:the\s+)?(?:email|mail|message))?$/i);
    if (sendMatch) {
      return buildResultFromSteps([
        {
          type: "CLICK",
          targetHint: "send",
          legacyTarget: resolveLegacyClickTarget("send")
        }
      ]);
    }
    const toggleMatch = task.match(/^(?:(enable|turn\s+on|activate|check|tick)|(disable|turn\s+off|deactivate|uncheck|untick)|(toggle))\s+(?:the\s+)?([a-zA-Z0-9_\-\s]+?)(?:\s+(?:option|checkbox|toggle|switch))?$/i);
    if (toggleMatch) {
      const isEnable = Boolean(toggleMatch[1]);
      const isDisable = Boolean(toggleMatch[2]);
      const actType = isEnable ? "CHECK" : isDisable ? "UNCHECK" : "TOGGLE";
      const targetHint = toggleMatch[4].trim();
      return buildResultFromSteps([
        {
          type: actType,
          action: actType,
          targetHint,
          target: targetHint,
          targetType: "checkbox"
        }
      ]);
    }
    const saveMatch = task.match(/^save(?:\s+(?:the\s+)?([a-zA-Z0-9_\-\s]+?))?$/i);
    if (saveMatch) {
      const subTarget = saveMatch[1] ? saveMatch[1].trim() : "";
      const targetHint = subTarget ? "save " + subTarget : "save";
      return buildResultFromSteps([
        {
          type: "CLICK",
          targetHint,
          legacyTarget: resolveLegacyClickTarget(targetHint)
        }
      ]);
    }
    const downloadMatch = task.match(/^download(?:\s+(?:the\s+)?([a-zA-Z0-9_\-\s]+?))?$/i);
    if (downloadMatch) {
      const subTarget = downloadMatch[1] ? downloadMatch[1].trim() : "";
      const isPronoun = isPronounOrReference(subTarget);
      const targetHint = !subTarget || isPronoun ? "download" : subTarget;
      return buildResultFromSteps([
        {
          type: "CLICK",
          targetHint,
          legacyTarget: null
        }
      ]);
    }
    const legacyTarget = resolveLegacyClickTarget(lower);
    if (legacyTarget) {
      return buildResultFromSteps([
        {
          type: "CLICK",
          targetHint: legacyTarget.toLowerCase().replace(/_button|_input/, ""),
          legacyTarget
        }
      ]);
    }
    return createNoneResult("Unsupported or ambiguous task");
  }
  function buildResultFromSteps(steps, constraintsObj) {
    if (!steps || steps.length === 0) {
      return createNoneResult("No steps parsed", constraintsObj);
    }
    const sanitizedPlan = [];
    const localValues = {};
    const goals = [];
    let currentGoal = null;
    let fillStepIndex = 0;
    steps.forEach((step, idx) => {
      step.stepId = idx;
      if (step.type === "CLICK" && (step.targetHint === "search box" || step.legacyTarget === "SEARCH_INPUT")) {
        currentGoal = {
          id: goals.length + 1,
          title: "Find search box",
          type: "LOCATE_SEARCH",
          stepIds: [idx]
        };
        goals.push(currentGoal);
      } else if (step.type === "FILL" && (step.fieldHint === "search" || step.fieldHint === "Search mail")) {
        currentGoal = {
          id: goals.length + 1,
          title: `Search for '${step.value || "query"}'`,
          type: "SEARCH",
          query: step.value || null,
          stepIds: [idx]
        };
        goals.push(currentGoal);
      } else if (step.type === "SUBMIT") {
        if (currentGoal && currentGoal.type === "SEARCH") {
          currentGoal.stepIds.push(idx);
        } else {
          currentGoal = {
            id: goals.length + 1,
            title: `Submit search${step.query ? " for '" + step.query + "'" : ""}`,
            type: "SEARCH",
            query: step.query || null,
            stepIds: [idx]
          };
          goals.push(currentGoal);
        }
      } else if ((step.type === "CLICK" || step.type === "OPEN") && (step.targetEntity || step.isProductSelection || /result|product|item|listing|video|movie|article|website|site|webpage|page|link|portal/i.test(step.targetHint || ""))) {
        const goalTarget = step.targetEntity && step.targetEntity.name ? step.targetIntent && step.targetIntent !== "open" ? `${step.targetEntity.name} ${step.targetIntent}` : step.targetEntity.name : step.isExplicitTarget && step.explicitTarget ? step.explicitTarget : step.targetHint || "relevant result";
        currentGoal = {
          id: goals.length + 1,
          title: `Open ${goalTarget}`,
          type: "OPEN_RESULT",
          target: goalTarget,
          stepIds: [idx]
        };
        goals.push(currentGoal);
      } else if (step.type === "FILL_FORM") {
        currentGoal = {
          id: goals.length + 1,
          title: "Fill all form fields",
          type: "FILL_FORM",
          stepIds: [idx]
        };
        goals.push(currentGoal);
      } else if (step.type === "FILL") {
        currentGoal = {
          id: goals.length + 1,
          title: `Fill ${step.fieldHint || "form field"}`,
          type: "FILL_FIELD",
          stepIds: [idx]
        };
        goals.push(currentGoal);
      } else if (step.type === "CHECK" || step.type === "UNCHECK" || step.type === "SELECT" || step.type === "TOGGLE") {
        const verbName = step.type.charAt(0) + step.type.slice(1).toLowerCase();
        currentGoal = {
          id: goals.length + 1,
          title: `${verbName} ${step.targetHint || step.target || "element"}${step.context ? " in " + step.context : ""}`,
          type: step.type,
          target: step.targetHint || step.target || "element",
          stepIds: [idx]
        };
        goals.push(currentGoal);
      } else if (step.type === "CLICK") {
        currentGoal = {
          id: goals.length + 1,
          title: `Click ${step.targetHint || "element"}`,
          type: "CLICK",
          target: step.targetHint || "element",
          stepIds: [idx]
        };
        goals.push(currentGoal);
      } else if (step.type === "NAVIGATE") {
        currentGoal = {
          id: goals.length + 1,
          title: `Navigate to ${step.targetHint || step.target || "destination"}`,
          type: "NAVIGATE",
          target: step.targetHint || step.target || "destination",
          url: step.url || null,
          stepIds: [idx]
        };
        goals.push(currentGoal);
      } else if (step.type === "SCROLL") {
        currentGoal = {
          id: goals.length + 1,
          title: `Scroll down ${step.amount || DEFAULT_SCROLL_AMOUNT}px`,
          type: "SCROLL",
          stepIds: [idx]
        };
        goals.push(currentGoal);
      } else {
        currentGoal = {
          id: goals.length + 1,
          title: `Action step ${idx + 1}`,
          type: "GENERIC",
          stepIds: [idx]
        };
        goals.push(currentGoal);
      }
      step.goalId = currentGoal.id;
      if (step.type === "FILL_FORM") {
        sanitizedPlan.push({
          type: "FILL_FORM",
          fieldHint: step.fieldHint || "all form fields",
          stepId: idx,
          goalId: step.goalId
        });
        localValues[idx] = "[FORM_PROFILE_DATA]";
        localValues["form_profile"] = step.profileSource || "form-profile.json";
        localValues["simultaneous"] = true;
      } else if (step.type === "FILL") {
        const isSearchFill = step.targetRole === "PRIMARY_SEARCH_INPUT" || step.expectedRole === "PRIMARY_SEARCH_INPUT" || step.semanticTarget === "PRIMARY_SEARCH_INPUT" || step.target === "PRIMARY_SEARCH_INPUT" || step.fieldHint === "search";
        const fillTarget = isSearchFill ? "PRIMARY_SEARCH_INPUT" : step.target || step.semanticTarget || step.fieldHint;
        const fillRole = isSearchFill ? "PRIMARY_SEARCH_INPUT" : step.expectedRole || step.role || "input";
        sanitizedPlan.push({
          type: "FILL",
          fieldHint: step.fieldHint,
          target: fillTarget,
          semanticTarget: fillTarget,
          targetRole: fillRole,
          expectedRole: fillRole,
          role: fillRole,
          isSearchIntent: isSearchFill,
          isAiAssistantIntent: !!step.isAiAssistantIntent,
          stepId: idx,
          goalId: step.goalId
        });
        localValues[idx] = step.value;
        localValues[`fill_${fillStepIndex}`] = step.value;
        localValues[`step_${idx}`] = step.value;
        fillStepIndex++;
        const normHint = (step.fieldHint || "").toLowerCase().trim();
        if (normHint) {
          localValues[normHint] = step.value;
          if (normHint === "body" || normHint.includes("message")) {
            localValues["message"] = step.value;
            localValues["body"] = step.value;
          } else if (normHint === "recipient" || normHint === "to") {
            localValues["to"] = step.value;
            localValues["recipient"] = step.value;
            localValues["email"] = step.value;
          }
        }
      } else if (step.type === "SUBMIT") {
        sanitizedPlan.push({
          type: "SUBMIT",
          targetHint: step.targetHint || "search",
          semanticTarget: step.semanticTarget || step.targetHint || "search",
          stepId: idx,
          goalId: step.goalId
        });
        if (step.query) {
          localValues["search_query"] = step.query;
          localValues[idx] = step.query;
          localValues[`step_${idx}`] = step.query;
        }
      } else if (step.type === "CHECK" || step.type === "UNCHECK" || step.type === "SELECT" || step.type === "TOGGLE") {
        const stoSelect = step.semanticTargetObject || (typeof buildSemanticTargetObject === "function" && (step.isSemantic || step.attribute || step.ranking || step.spatial || step.relation) ? buildSemanticTargetObject(step, step) : null);
        sanitizedPlan.push({
          type: step.type,
          action: step.type,
          targetHint: step.targetHint || step.target,
          target: step.targetHint || step.target,
          semanticTarget: step.semanticTarget || step.targetHint || step.target,
          semanticCategory: step.semanticCategory || null,
          ranking: step.ranking || null,
          spatial: step.spatial || null,
          contentFilter: step.contentFilter || null,
          senderFilter: step.senderFilter || null,
          isSemantic: !!step.isSemantic,
          objectTarget: step.objectTarget || null,
          attribute: step.attribute || null,
          attributeValue: step.attributeValue || null,
          context: step.context || null,
          relation: step.relation || null,
          ordinal: step.ordinal !== void 0 ? step.ordinal : null,
          targetType: step.targetType || null,
          semanticTargetObject: stoSelect,
          stepId: idx,
          goalId: step.goalId
        });
      } else if (step.type === "CLICK" || step.type === "OPEN") {
        const stoClick = step.semanticTargetObject || (typeof buildSemanticTargetObject === "function" && (step.isSemantic || step.attribute || step.ranking || step.spatial || step.relation) ? buildSemanticTargetObject(step, step) : null);
        const resolvedEntity = step.targetEntity || stoClick && stoClick.targetEntity || null;
        const stepTarget = resolvedEntity && resolvedEntity.name ? resolvedEntity.name : step.target || step.targetHint;
        sanitizedPlan.push({
          type: step.type === "OPEN" ? "OPEN" : "CLICK",
          action: step.action || (step.type === "OPEN" ? "OPEN" : "CLICK"),
          targetHint: stepTarget,
          target: stepTarget,
          semanticTarget: step.semanticTarget || stepTarget,
          targetEntity: resolvedEntity,
          targetIntent: step.targetIntent || stoClick && stoClick.targetIntent || null,
          semanticCategory: step.semanticCategory || null,
          ranking: step.ranking || null,
          spatial: step.spatial || null,
          contentFilter: step.contentFilter || null,
          senderFilter: step.senderFilter || null,
          isSemantic: !!step.isSemantic,
          isSearchResult: Boolean(step.isSearchResult || step.isProductSelection || step.semanticCategory === "result" || step.isFirstResult),
          isFirstResult: !!step.isFirstResult,
          isMostRelevant: !!step.isMostRelevant,
          domain: step.domain || null,
          query: step.query || null,
          expectedRole: step.expectedRole || step.role || (step.isSearchResult || step.isProductSelection || step.semanticCategory === "result" || step.isFirstResult ? "link" : "button"),
          role: step.role || step.expectedRole || (step.isSearchResult || step.isProductSelection || step.semanticCategory === "result" || step.isFirstResult ? "link" : "button"),
          requiresApproval: !!step.requiresApproval,
          legacyTarget: step.legacyTarget || null,
          context: step.context || null,
          relation: step.relation || null,
          ordinal: step.ordinal !== void 0 ? step.ordinal : null,
          targetType: step.targetType || null,
          objectTarget: step.objectTarget || null,
          attribute: step.attribute || null,
          attributeValue: step.attributeValue || null,
          semanticTargetObject: stoClick,
          stepId: idx,
          goalId: step.goalId
        });
        if (step.query) {
          localValues["search_query"] = step.query;
          localValues[`step_${idx}`] = step.query;
        }
      } else if (step.type === "NAVIGATE") {
        sanitizedPlan.push({
          type: "NAVIGATE",
          action: "NAVIGATE",
          targetHint: step.targetHint || step.target,
          target: step.targetHint || step.target,
          semanticTarget: step.semanticTarget || step.targetHint || step.target,
          url: step.url || null,
          stepId: idx,
          goalId: step.goalId
        });
      } else if (step.type === "SCROLL") {
        sanitizedPlan.push({
          type: "SCROLL",
          target: step.target || "PAGE",
          amount: step.amount || DEFAULT_SCROLL_AMOUNT,
          stepId: idx,
          goalId: step.goalId
        });
      } else {
        sanitizedPlan.push({ type: "NONE", stepId: idx, goalId: step.goalId });
      }
    });
    const isMultiStep = steps.length > 1;
    const primaryIntent = isMultiStep ? "MULTI_STEP" : steps[0].type || "NONE";
    const cons = constraintsObj || currentActiveConstraints;
    return {
      intent: primaryIntent,
      steps,
      goals,
      sanitizedPlan,
      localValues,
      isMultiStep,
      constraints: cons && cons.constraints || [],
      stopCondition: cons && cons.stopCondition || null,
      approvalRequirement: cons && cons.approvalRequirement || null,
      requireApprovalBeforeSend: !!(cons && cons.requireApprovalBeforeSend),
      doNotSend: !!(cons && cons.doNotSend),
      doNotSubmit: !!(cons && cons.doNotSubmit),
      doNotBuy: !!(cons && cons.doNotBuy)
    };
  }
  function createNoneResult(reason, constraintsObj) {
    const cons = constraintsObj || currentActiveConstraints;
    return {
      intent: "NONE",
      reason: reason || "Unrecognized task",
      steps: [{ type: "NONE" }],
      sanitizedPlan: [{ type: "NONE" }],
      localValues: {},
      isMultiStep: false,
      constraints: cons && cons.constraints || [],
      stopCondition: cons && cons.stopCondition || null,
      approvalRequirement: cons && cons.approvalRequirement || null,
      requireApprovalBeforeSend: !!(cons && cons.requireApprovalBeforeSend),
      doNotSend: !!(cons && cons.doNotSend)
    };
  }
  return {
    parseTask,
    resolveNavigationUrl,
    parseContextualClause,
    extractOrdinal,
    normalizeRelation,
    extractTargetType,
    cleanContextName,
    resolveActiveContainerContext,
    extractTaskQueryOrValue,
    resolveLegacyClickTarget,
    isPronounOrReference,
    cleanFieldHint,
    cleanValue,
    parseJuxtapositionFill,
    extractExecutionConstraints,
    stripExecutionControlPhrases,
    extractAttributeConstraint,
    DEFAULT_SCROLL_AMOUNT
  };
});
