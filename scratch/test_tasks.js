const tp = require('../task-parser.js');
const tasks = [
  'write "Hello from IRIS"',
  'make a post saying Hello from IRIS',
  'type this in the post',
  'reply saying thank you',
  'send a message saying thanks',
  'write a comment',
  'enter this in the message box',
  'reply to this mail with thank you',
  'make a LinkedIn post saying hello',
  'send him a message saying thank you',
  'write this review'
];
tasks.forEach(t => {
  const p = tp.parseTask(t);
  console.log('TASK:', t);
  if (p && p.steps) {
    p.steps.forEach((s, i) => console.log('  Step ' + i + ': ' + s.type + ' -> target: ' + (s.target || s.fieldHint) + ', role: ' + (s.semanticRole || s.role) + ', val: ' + s.value));
  } else {
    console.log('  NULL/NO STEPS');
  }
});
