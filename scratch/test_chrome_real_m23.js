/**
 * scratch/test_chrome_real_m23.js
 * Runs real browser execution in Google Chrome via Chrome DevTools Protocol (CDP).
 */

const { spawn } = require('child_process');
const http = require('http');
const os = require('os');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DEMO_URL = 'http://localhost:8000/demo-pages/m23-hierarchical-demo.html';

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 1;
    this.callbacks = new Map();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new globalThis.WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (err) => reject(err);
      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id && this.callbacks.has(msg.id)) {
          const { resolve, reject } = this.callbacks.get(msg.id);
          this.callbacks.delete(msg.id);
          if (msg.error) reject(new Error(msg.error.message));
          else resolve(msg.result);
        }
      };
    });
  }

  async send(method, params = {}) {
    const id = this.id++;
    return new Promise((resolve, reject) => {
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (res.exceptionDetails) {
      throw new Error(res.exceptionDetails.exception?.description || 'Evaluation error');
    }
    return res.result?.value;
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

async function runRealChromeTest() {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-m23-'));
  console.log('Launching Google Chrome with user data dir:', userDataDir);

  const chromeProc = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=9223',
    '--user-data-dir=' + userDataDir,
    '--no-first-run',
    '--no-default-browser-check',
    DEMO_URL
  ]);

  try {
    // Wait for Chrome to open debugging port
    await new Promise((r) => setTimeout(r, 2000));

    // Get CDP targets
    const targets = await new Promise((resolve, reject) => {
      http.get('http://127.0.0.1:9223/json', (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => resolve(JSON.parse(data)));
      }).on('error', reject);
    });

    const pageTarget = targets.find(t => t.type === 'page' && t.url.includes('m23-hierarchical-demo.html'));
    if (!pageTarget) throw new Error('Page target not found in Chrome');

    console.log('Connecting to page via CDP:', pageTarget.title);
    const client = new CDPClient(pageTarget.webSocketDebuggerUrl);
    await client.connect();

    // Inject content.js code
    const contentJs = fs.readFileSync(path.resolve(__dirname, '../content.js'), 'utf8');
    await client.evaluate(contentJs);

    console.log('\n============================================================');
    console.log('REAL CHROME TEST: Find filters section, check 4 Stars & Up checkbox, then select Black');
    console.log('============================================================\n');

    // Parse the task using task-parser.js
    const taskParser = require('../task-parser.js');
    const reasoningPlanner = require('../reasoning-planner.js');
    const actionVerifier = require('../action-verifier.js');

    const parsedTask = taskParser.parseTask("Find the filters section, check the 4 Stars & Up checkbox, then select Black.");
    const plan = reasoningPlanner.planTask(parsedTask);

    console.log('PARSED PLAN:');
    plan.steps.forEach((s, idx) => {
      console.log(`  Step ${idx + 1}: [${s.type}] target='${s.target}' context='${s.context}' relation='${s.relation}'`);
    });

    // STEP 1: CLICK filters
    console.log('\n--- STEP 1 / 3: CLICK -> filters ---');
    const step1Payload = {
      action: plan.steps[0].type,
      target: plan.steps[0].target,
      targetLabel: plan.steps[0].targetHint
    };
    const execRes1 = await client.evaluate(`executeAction(${JSON.stringify(step1Payload)})`);
    console.log('Step 1 execution result:', execRes1);

    const step1Verification = await client.evaluate(`
      (() => {
        const sec = document.getElementById('filters-section');
        return {
          active: sec.classList.contains('active'),
          statusLog: document.getElementById('statusLog').textContent
        };
      })()
    `);
    console.log('Step 1 DOM state:', step1Verification);
    if (!execRes1.executed) throw new Error('Step 1 failed');

    // STEP 2: CHECK 4 Stars & Up
    console.log('\n--- STEP 2 / 3: CHECK -> 4 Stars & Up ---');
    const step2Payload = {
      action: plan.steps[1].type,
      target: plan.steps[1].target,
      targetLabel: plan.steps[1].targetHint,
      context: plan.steps[1].context,
      relation: plan.steps[1].relation
    };
    const execRes2 = await client.evaluate(`executeAction(${JSON.stringify(step2Payload)})`);
    console.log('Step 2 execution result:', execRes2);

    const step2Verification = await client.evaluate(`
      (() => {
        const chk = document.getElementById('chk-4stars');
        return {
          checked: chk.checked,
          statusLog: document.getElementById('statusLog').textContent
        };
      })()
    `);
    console.log('Step 2 DOM state:', step2Verification);
    if (!execRes2.executed || !step2Verification.checked) throw new Error('Step 2 failed');

    // M22: Check state changed triggers fresh perception
    console.log('\n[M22 Fresh Perception Verification]');
    const freshElementsMetadata = await client.evaluate(`
      (() => {
        const elements = extractVisualElements();
        const blackEl = elements.find(e => e.label === 'Black');
        return {
          totalElements: elements.length,
          blackFound: !!blackEl,
          blackMetadata: blackEl ? {
            label: blackEl.label,
            type: blackEl.type,
            index: blackEl.index,
            bounds: { x: blackEl.x, y: blackEl.y, width: blackEl.width, height: blackEl.height },
            disabled: blackEl.disabled
          } : null
        };
      })()
    `);
    console.log('Fresh perception candidate metadata:', freshElementsMetadata);

    // STEP 3: SELECT Black
    console.log('\n--- STEP 3 / 3: SELECT -> Black ---');
    const step3Payload = {
      action: plan.steps[2].type,
      target: plan.steps[2].target,
      targetLabel: plan.steps[2].targetHint,
      context: plan.steps[2].context,
      relation: plan.steps[2].relation
    };
    const execRes3 = await client.evaluate(`executeAction(${JSON.stringify(step3Payload)})`);
    console.log('Step 3 execution result:', execRes3);

    const step3Verification = await client.evaluate(`
      (() => {
        const btn = document.querySelector('button[data-color="Black"]');
        return {
          selected: btn.classList.contains('selected'),
          ariaChecked: btn.getAttribute('aria-checked'),
          statusLog: document.getElementById('statusLog').textContent
        };
      })()
    `);
    console.log('Step 3 DOM state:', step3Verification);
    if (!execRes3.executed || !step3Verification.selected) throw new Error('Step 3 failed');

    console.log('\n============================================================');
    console.log('✓ PRIMARY TASK VERIFIED IN REAL CHROME: ALL 3 STEPS SUCCEEDED!');
    console.log('============================================================');

    // REGRESSION A: Electronics -> Headphones -> SELECT
    console.log('\n--- REGRESSION A: Electronics -> Headphones -> SELECT ---');
    const regAPayload = {
      action: 'SELECT',
      target: 'Headphones',
      targetLabel: 'Headphones',
      context: 'Electronics'
    };
    const regARes = await client.evaluate(`executeAction(${JSON.stringify(regAPayload)})`);
    const regAVerif = await client.evaluate(`
      (() => {
        const btn = document.getElementById('opt-headphones');
        return { selected: btn.classList.contains('selected') };
      })()
    `);
    console.log('Regression A result:', regARes, regAVerif);
    if (!regARes.executed || !regAVerif.selected) throw new Error('Regression A failed');
    console.log('✓ REGRESSION A PASSED');

    // REGRESSION D: Explicit nonexistent target remains blocked
    console.log('\n--- REGRESSION D: Explicit nonexistent target remains blocked ---');
    const regDPayload = {
      action: 'SELECT',
      target: 'Nonexistent_Target_XYZ',
      targetLabel: 'Nonexistent_Target_XYZ',
      context: 'filters'
    };
    const regDRes = await client.evaluate(`executeAction(${JSON.stringify(regDPayload)})`);
    console.log('Regression D result (must be blocked):', regDRes);
    if (regDRes.executed) throw new Error('Regression D should have failed');
    console.log('✓ REGRESSION D PASSED (Target not found safely handled)');

    client.close();
  } finally {
    chromeProc.kill();
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch(_) {}
  }
}

runRealChromeTest().then(() => {
  console.log('\nREAL CHROME TEST COMPLETE WITH ZERO REGRESSIONS!');
  process.exit(0);
}).catch(err => {
  console.error('\nREAL CHROME TEST FAILED:', err);
  process.exit(1);
});
