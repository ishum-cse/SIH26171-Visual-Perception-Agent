const fs = require('fs');

// We will test our logic against the actual task-parser.js
// Let's create a prototype of the additions and run all regression tests

function extractExecutionConstraints(text) {
  if (!text || typeof text !== "string") {
    return {
      constraints: [],
      requireApprovalBeforeSend: false,
      doNotSend: false,
      stopAfterFilling: false,
      stopCondition: null
    };
  }

  const constraints = [];
  let requireApprovalBeforeSend = false;
  let doNotSend = false;
  let stopAfterFilling = false;
  let stopCondition = null;

  if (/\b(?:do\s+not|don't|dont|never)\s+(?:click\s+)?send\b/i.test(text) ||
      /\bstop\s+before\s+sending\b/i.test(text) ||
      /\bwithout\s+sending\b/i.test(text)) {
    doNotSend = true;
    constraints.push("DO_NOT_SEND");
  }

  if (/\bstop\s+after\s+(?:filling|typing|entering|writing)(?:\s+(?:the\s+)?(?:reply|message|form|field|email))?\b/i.test(text) ||
      /\bstop\s+before\s+sending\b/i.test(text)) {
    stopAfterFilling = true;
    stopCondition = "AFTER_FILL";
    constraints.push("STOP_AFTER_FILLING");
  }

  if (/\b(?:ask\s+for|require|with|await|need|wait\s+for)\s+(?:human\s+|explicit\s+|user\s+)?(?:confirmation|approval)(?:\s+(?:first|before\s+sending))?\b/i.test(text) ||
      /\bconfirmation\s+(?:first|before\s+sending)\b/i.test(text) ||
      /\bonly\s+send\s+after\s+(?:human\s+|explicit\s+|user\s+)?(?:confirmation|approval)\b/i.test(text) ||
      /\bwait\s+for\s+(?:confirmation|approval)\b/i.test(text)) {
    requireApprovalBeforeSend = true;
    constraints.push("REQUIRE_APPROVAL_BEFORE_SEND");
  }

  return {
    constraints,
    requireApprovalBeforeSend,
    doNotSend,
    stopAfterFilling,
    stopCondition
  };
}

function stripExecutionControlPhrases(text) {
  if (!text || typeof text !== "string") return text;
  let t = text;

  const controlPatterns = [
    /(?:,\s*|\.\s*|\s+(?:and\s+then|and|then)\s+)?(?:do\s+not|don't|dont|never)\s+(?:click\s+)?send(?:\s+it)?(?:\s+yet)?\.?/gi,
    /(?:,\s*|\.\s*|\s+(?:and\s+then|and|then)\s+)?stop\s+after\s+(?:filling|typing|entering|writing)(?:\s+(?:the\s+)?(?:reply|message|form|field|email))?\.?/gi,
    /(?:,\s*|\.\s*|\s+(?:and\s+then|and|then)\s+)?stop\s+before\s+sending(?:\s+it)?\.?/gi,
    /(?:,\s*|\.\s*|\s+(?:and\s+then|and|then)\s+)?(?:ask\s+for|require|need|wait\s+for)\s+(?:human\s+|explicit\s+|user\s+)?(?:confirmation|approval)(?:\s+(?:first|before\s+sending))?\.?/gi,
    /(?:,\s*|\.\s*|\s+(?:and\s+then|and|then)\s+)?confirmation\s+first\.?/gi,
    /(?:,\s*|\.\s*|\s+(?:and\s+then|and|then)\s+)?only\s+send\s+after\s+(?:human\s+|explicit\s+|user\s+)?(?:confirmation|approval)\.?/gi,
    /(?:,\s*|\.\s*|\s+(?:and\s+then|and|then)\s+)?without\s+sending(?:\s+it)?\.?/gi
  ];

  for (const pat of controlPatterns) {
    t = t.replace(pat, " ");
  }

  return t.replace(/\s+/g, " ").trim().replace(/[.,;]+$/, "");
}

console.log("--- Testing Constraints Extraction ---");
const taskUser = "Reply to the currently open email with: Thank you for the information. This is a test of Iris replying to an existing email. Stop after filling the reply. Do not send it.";
console.log("Constraints:", extractExecutionConstraints(taskUser));
console.log("Cleaned:", stripExecutionControlPhrases(taskUser));

const task4 = "Reply to the open email with Hello and ask for confirmation before sending.";
console.log("Constraints 4:", extractExecutionConstraints(task4));
console.log("Cleaned 4:", stripExecutionControlPhrases(task4));

const task3 = "Open Gmail, compose an email to test@example.com, set subject to SIH Final Test, write Hello, and stop before sending.";
console.log("Constraints 3:", extractExecutionConstraints(task3));
console.log("Cleaned 3:", stripExecutionControlPhrases(task3));
