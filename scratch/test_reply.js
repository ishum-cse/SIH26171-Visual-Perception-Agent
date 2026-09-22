const SIHTaskParser = require('../task-parser.js');

function parseReplyWorkflow(taskText, executionConstraints = {}) {
  if (!taskText || typeof taskText !== "string") return null;
  const t = taskText.trim();

  // Pattern: "reply to [the] [currently] [open] [this] [email|message] (?:with|saying|and say|:)\s*(.+)"
  // or "reply with: (.+)" or "reply with (.+)"
  const replyWithContentMatch = t.match(
    /^reply(?:\s+to\s+(?:the\s+)?(?:currently\s+)?(?:open\s+)?(?:this\s+)?(?:email|message|conversation|thread|mail))?(?:\s+(?:with|saying|and\s+say|:)\s*|\s*:\s*)([\s\S]+)$/i
  );

  if (replyWithContentMatch) {
    let replyBody = replyWithContentMatch[1].trim();
    if (replyBody) {
      if ((replyBody.startsWith('"') && replyBody.endsWith('"') && replyBody.length >= 2) ||
          (replyBody.startsWith("'") && replyBody.endsWith("'") && replyBody.length >= 2)) {
        replyBody = replyBody.slice(1, -1).trim();
      }
      replyBody = replyBody.replace(/^[:\s]+/, "").trim();
    }

    if (!replyBody) {
      return [
        {
          type: "CLICK",
          action: "CLICK",
          targetHint: "Reply",
          target: "Reply",
          role: "button",
          expectedRole: "button",
          targetType: "button",
          semanticTag: "REPLY_BUTTON",
          reasoning: "Click the Reply button"
        }
      ];
    }

    const steps = [
      {
        type: "CLICK",
        action: "CLICK",
        targetHint: "Reply",
        target: "Reply",
        role: "button",
        expectedRole: "button",
        targetType: "button",
        semanticTag: "REPLY_BUTTON",
        reasoning: "Click the Reply button to open reply editor"
      },
      {
        type: "FILL",
        action: "FILL",
        fieldHint: "message body",
        targetHint: "reply message body",
        semanticTarget: "reply message body",
        target: "reply message body",
        role: "textarea/contenteditable",
        expectedRole: "textarea",
        targetType: "textarea",
        value: replyBody,
        reasoning: "Fill the reply composer message body"
      }
    ];

    if (!executionConstraints.doNotSend && !executionConstraints.stopAfterFilling) {
      if (executionConstraints.requireApprovalBeforeSend) {
        steps.push({
          type: "CLICK",
          action: "CLICK",
          targetHint: "Send",
          target: "Send",
          role: "button",
          expectedRole: "button",
          targetType: "button",
          requiresApproval: true,
          semanticTag: "SEND_BUTTON",
          reasoning: "Send the reply (requires confirmation)"
        });
      }
    }

    return steps;
  }

  // Standalone reply:
  const standaloneReplyMatch = t.match(
    /^(?:click\s+)?reply(?:\s+to\s+(?:the\s+)?(?:currently\s+)?(?:open\s+)?(?:this\s+)?(?:email|message|conversation|thread|mail))?$/i
  );
  if (standaloneReplyMatch) {
    return [
      {
        type: "CLICK",
        action: "CLICK",
        targetHint: "Reply",
        target: "Reply",
        role: "button",
        expectedRole: "button",
        targetType: "button",
        semanticTag: "REPLY_BUTTON",
        reasoning: "Click the Reply button"
      }
    ];
  }

  return null;
}

console.log("--- Test Reply Workflow ---");
const r1 = parseReplyWorkflow("Reply to the currently open email with: Thank you for the information. This is a test of Iris replying to an existing email", { doNotSend: true, stopAfterFilling: true });
console.log("R1 steps:", JSON.stringify(r1, null, 2));

const r4 = parseReplyWorkflow("Reply to the open email with Hello", { requireApprovalBeforeSend: true });
console.log("R4 steps:", JSON.stringify(r4, null, 2));
