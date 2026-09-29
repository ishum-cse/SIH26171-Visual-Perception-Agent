const tp = require('../task-parser.js');

function testParseCond(t) {
  const trailingIfMatch = t.match(/^((?:click|press|tap|open|select|choose|navigate\s+to|go\s+to)\s+.+?)\s+(?:if|when|in\s+case)\s+(.+)$/i);
  if (trailingIfMatch) {
    const actionText = trailingIfMatch[1].trim();
    let conditionText = trailingIfMatch[2].trim();
    let trailingNextActions = null;

    const thenMatch = conditionText.match(/^(.*?)(?:,\s*then|\s+then|\s*;\s*then|\s*,\s*and\s+then|\s+and\s+then)\s+(.+)$/i);
    if (thenMatch) {
      conditionText = thenMatch[1].trim();
      trailingNextActions = thenMatch[2].trim();
    }

    const parsedAction = tp.parseTask(actionText, true);
    const condSteps = parsedAction.steps.map((st) => ({
      ...st,
      isConditional: true,
      conditional: true,
      condition: conditionText
    }));

    if (trailingNextActions) {
      const nextRes = tp.parseTask(trailingNextActions, true);
      if (nextRes && Array.isArray(nextRes.steps) && nextRes.steps.length > 0 && nextRes.steps[0].type !== "NONE") {
        condSteps.push(...nextRes.steps);
      }
    }

    return condSteps;
  }
  return null;
}

const t = 'click English if the language page appears, then search for GSLV-F17/EOS-05 mission and open the relevant mission result.';
const res = testParseCond(t);
console.log('Result steps count:', res ? res.length : null);
res.forEach((s, idx) => console.log((idx+1) + '. ' + s.type + ' -> ' + (s.target || s.targetHint) + (s.value ? ' (' + s.value + ')' : '') + (s.condition ? ' [cond: ' + s.condition + ']' : '')));
