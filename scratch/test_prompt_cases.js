const SIHTaskParser = require('../task-parser.js');

const tests = [
  'Search Gmail for emails about SIH.',
  'Reply to the currently open email with: Thank you for the information. This is a test of Iris replying to an existing email. Stop after filling the reply. Do not send it.',
  'Open Gmail, compose an email to test@example.com, set subject to SIH Final Test, write Hello, and stop before sending.',
  'Reply to the open email with Hello and ask for confirmation before sending.',
  'Open YouTube and search for DSA in Java.'
];

tests.forEach((t, i) => {
  const r = SIHTaskParser.parseTask(t);
  console.log(`=== TEST ${i + 1} ===`);
  console.log(`Task: "${t}"`);
  console.log(`Intent: ${r.intent}`);
  console.log(`Constraints: ${JSON.stringify(r.constraints)}`);
  console.log(`StopCondition: ${r.stopCondition}`);
  console.log(`RequireApprovalBeforeSend: ${r.requireApprovalBeforeSend}`);
  console.log(`DoNotSend: ${r.doNotSend}`);
  console.log('Steps:');
  (r.steps || []).forEach((s, idx) => {
    const roleStr = s.expectedRole || s.role ? ` [role: ${s.expectedRole || s.role}]` : '';
    const valStr = s.value ? ` (value: "${s.value}")` : '';
    const qStr = s.query ? ` (query: "${s.query}")` : '';
    const appStr = s.requiresApproval ? ' [REQUIRES APPROVAL]' : '';
    console.log(`  ${idx + 1}. ${s.type} -> ${s.semanticTarget || s.target || s.targetHint || s.fieldHint}${roleStr}${valStr}${qStr}${appStr}`);
  });
  console.log('');
});
