const taskParser = require('../task-parser.js');
const res = taskParser.parseTask('Find the Name field and fill it with "Sankii"');
console.log('intent:', res.intent);
console.log('steps:', res.steps);
