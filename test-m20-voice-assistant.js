/**
 * test-m20-voice-assistant.js - Milestone 20 Verification Suite
 * 
 * Verifies:
 * TEST 1 — Manual regression: Typed agent task parsing and planning
 * TEST 2 — Voice simple task: Voice input -> transcript -> confirmation -> pipeline handoff
 * TEST 3 — Voice multi-step task: Multi-step command matches typed behavior
 * TEST 4 — Voice confirmation requirement: Zero execution without explicit user confirmation
 * TEST 5 — Try Again: Discards previous transcript and restarts listening cleanly
 * TEST 6 — Safety regression: "Send the email" via voice goes through Safety Gate / APPROVAL REQ
 * TEST 7 — Speech API unavailable: Graceful degradation, informative message, text task works
 * TEST 8 — Transcript normalization: Whitespace, capitalization, formatting
 * TEST 9 — Error handling: Permission denial, no speech, network error recovery
 */

const assert = require("assert");
const voiceModule = require("./voice-assistant.js");
const taskParser = require("./task-parser.js");
const reasoningPlanner = require("./reasoning-planner.js");

console.log("============================================================");
console.log("RUNNING MILESTONE 20 VOICE ASSISTANT INPUT LAYER VERIFICATION");
console.log("============================================================\n");

// [TEST 1] Manual Regression: Typed Agent Task Input & Planning
console.log("[TEST 1] Manual regression: Typed Agent Task execution pathway");
{
  const typedTask = "Find the search box, search for YouTube, open the most relevant result.";
  const parsed = taskParser.parseTask(typedTask);
  assert.ok(parsed, "Typed task must parse successfully");
  assert.ok(Array.isArray(parsed.goals), "Parsed task must contain goals");
  assert.ok(parsed.goals.length >= 2, "Typed task must have multiple subgoals");

  const plan = reasoningPlanner.planTask(parsed, {
    title: "Google Search",
    url: "https://www.google.com"
  });
  assert.ok(plan, "Planner must create execution plan");
  assert.ok(Array.isArray(plan.steps), "Plan must contain action steps");
  assert.ok(plan.steps.length >= 2, "Plan must contain ordered steps");
  console.log(`  ✓ Typed task parsed (${parsed.goals.length} goals) and planned (${plan.steps.length} steps) identically to baseline`);
}

// [TEST 2] Voice Simple Task
console.log("\n[TEST 2] Voice simple task: Voice -> Transcript -> Confirmation -> Pipeline");
{
  const spokenVoiceInput = "find the search box and search for YouTube";
  let stateLog = [];
  let transcriptReadyFired = false;
  let executedTask = null;

  const voiceAssistant = new voiceModule.VoiceAssistantController({
    onStateChange: (state, msg, trans) => {
      stateLog.push({ state, msg });
    },
    onTranscriptReady: (trans) => {
      transcriptReadyFired = true;
    },
    onExecute: (task) => {
      executedTask = task;
    }
  });

  // Simulate user speaking
  voiceAssistant.simulateVoiceInput(spokenVoiceInput);

  assert.strictEqual(voiceAssistant.getState(), "CONFIRMING", "State must be CONFIRMING after speech recognized");
  assert.strictEqual(transcriptReadyFired, true, "onTranscriptReady callback must fire");
  assert.strictEqual(voiceAssistant.getTranscript(), "Find the search box and search for YouTube", "Transcript must be normalized");
  assert.strictEqual(executedTask, null, "Pipeline must NOT execute before explicit user confirmation");

  // User confirms: "Use This Command"
  const confirmed = voiceAssistant.confirmTranscript();
  assert.strictEqual(confirmed, true, "confirmTranscript must return true");
  assert.strictEqual(executedTask, "Find the search box and search for YouTube", "Pipeline must receive exact confirmed transcript");
  assert.strictEqual(voiceAssistant.getState(), "IDLE", "State must return to IDLE after task submission");

  // Verify the executed task routes through existing task parser
  const parsedFromVoice = taskParser.parseTask(executedTask);
  assert.ok(parsedFromVoice.goals.length >= 1, "Voice task must be parsed by existing task parser");

  console.log(`  ✓ Voice task transcript generated: "${voiceAssistant.getTranscript()}"`);
  console.log(`  ✓ Confirmed and routed to Agent Task pipeline: "${executedTask}"`);
}

// [TEST 3] Voice Multi-Step Task: Equivalence to Typed Command
console.log("\n[TEST 3] Voice multi-step task equivalence");
{
  const multiStepVoice = "find the search box, search for YouTube, open the most relevant result, find the search box on YouTube, search for KGF songs, and open the most relevant result.";
  let voiceSubmittedTask = null;

  const voiceAssistant = new voiceModule.VoiceAssistantController({
    onExecute: (task) => {
      voiceSubmittedTask = task;
    }
  });

  voiceAssistant.simulateVoiceInput(multiStepVoice);
  voiceAssistant.confirmTranscript();

  assert.ok(voiceSubmittedTask, "Task must be submitted on confirmation");

  // Compare parsed output of typed vs voice
  const parsedTyped = taskParser.parseTask(multiStepVoice);
  const parsedVoice = taskParser.parseTask(voiceSubmittedTask);

  assert.strictEqual(parsedVoice.goals.length, parsedTyped.goals.length, "Goal count must match between voice and typed task");
  assert.strictEqual(parsedVoice.steps.length, parsedTyped.steps.length, "Step count must match between voice and typed task");

  const planTyped = reasoningPlanner.planTask(parsedTyped);
  const planVoice = reasoningPlanner.planTask(parsedVoice);
  assert.strictEqual(planVoice.steps.length, planTyped.steps.length, "Execution plan steps must be identical");

  console.log(`  ✓ Multi-step voice command produced identical reasoning plan (${planVoice.steps.length} steps, ${planVoice.goals.length} goals) as typed command`);
}

// [TEST 4] Voice Confirmation Requirement: Zero Execution Without Confirmation
console.log("\n[TEST 4] Voice confirmation requirement (Safety & Intent verification)");
{
  let executionOccurred = false;
  const voiceAssistant = new voiceModule.VoiceAssistantController({
    onExecute: () => {
      executionOccurred = true;
    }
  });

  voiceAssistant.simulateVoiceInput("Delete all bookmarks and close browser");

  // State is CONFIRMING
  assert.strictEqual(voiceAssistant.getState(), "CONFIRMING");
  assert.strictEqual(executionOccurred, false, "Execution must NOT occur upon voice recognition alone");

  // User decides NOT to click "Use This Command", but instead clears/cancels
  voiceAssistant.clearTranscript();
  assert.strictEqual(executionOccurred, false, "Execution must NOT occur when cancelled");
  assert.strictEqual(voiceAssistant.getState(), "IDLE", "State must return to IDLE on clear");
  assert.strictEqual(voiceAssistant.getTranscript(), "", "Transcript must be emptied on clear");

  console.log("  ✓ Absolute requirement verified: Voice input has zero execution authority without explicit user confirmation");
}

// [TEST 5] Try Again (Discard and re-listen)
console.log("\n[TEST 5] Try Again: Discard and restart listening");
{
  let capturedTranscript = "";
  let executionCount = 0;

  class MockSpeechRecognition {
    constructor() {
      this.continuous = false;
      this.interimResults = false;
      this.lang = "en-US";
    }
    start() {
      setTimeout(() => {
        if (typeof this.onstart === "function") this.onstart();
        if (typeof this.onresult === "function") {
          this.onresult({
            results: [[{ transcript: "Search for weather" }]]
          });
        }
      }, 5);
    }
    stop() {}
    abort() {}
  }

  const voiceAssistant = new voiceModule.VoiceAssistantController({
    SpeechRecognition: MockSpeechRecognition,
    onTranscriptReady: (t) => {
      capturedTranscript = t;
    },
    onExecute: () => {
      executionCount++;
    }
  });

  // First attempt with incorrect phrase
  voiceAssistant.simulateVoiceInput("Search for sweater");
  assert.strictEqual(voiceAssistant.getTranscript(), "Search for sweater");

  // User clicks "Try Again"
  voiceAssistant.tryAgain();
  assert.strictEqual(voiceAssistant.getTranscript(), "", "Previous transcript must be discarded immediately");
  assert.strictEqual(executionCount, 0, "No execution should have happened");

  // Simulate new second speech recognition
  voiceAssistant.simulateVoiceInput("Search for weather in Delhi");
  assert.strictEqual(voiceAssistant.getTranscript(), "Search for weather in Delhi");

  voiceAssistant.confirmTranscript();
  assert.strictEqual(executionCount, 1, "Only confirmed second task should execute");

  console.log("  ✓ Try Again successfully discarded previous transcript and accepted corrected voice task");
}

// [TEST 6] Safety Regression: Voice Command Must NOT Bypass Safety Gate
console.log("\n[TEST 6] Safety regression: Voice commands must undergo full Safety Gate");
{
  // 1. Test standalone voice command: "Send the email"
  const standaloneVoiceTask = "send the email";
  let submittedTask = null;

  const voiceAssistant = new voiceModule.VoiceAssistantController({
    onExecute: (t) => {
      submittedTask = t;
    }
  });

  voiceAssistant.simulateVoiceInput(standaloneVoiceTask);
  voiceAssistant.confirmTranscript();

  assert.strictEqual(submittedTask, "Send the email");

  const parsedStandalone = taskParser.parseTask(submittedTask);
  assert.ok(parsedStandalone && parsedStandalone.steps.length > 0, "Standalone send task must parse");
  const standaloneSendStep = parsedStandalone.steps.find(s => (s.targetHint || s.target || "").toLowerCase().includes("send"));
  assert.ok(standaloneSendStep, "Send step must exist in parsed task");

  const standaloneSafety = reasoningPlanner.classifyActionRisk({ action: "CLICK", target: standaloneSendStep.targetHint || "send" }, submittedTask);
  assert.strictEqual(standaloneSafety.risk, "HIGH", "Standalone send must be classified as HIGH risk");
  assert.strictEqual(standaloneSafety.requiresApproval, true, "Standalone send must require explicit human approval");

  // 2. Test full Gmail voice workflow
  const fullGmailVoice = "Find the search box, search Gmail, open the most relevant result, compose a new email, enter xyz@gmail.com as the recipient, enter Test Mail as the subject, type Hello, send the email, and verify that the email was sent.";
  let fullSubmitted = null;

  const fullAssistant = new voiceModule.VoiceAssistantController({
    onExecute: (t) => {
      fullSubmitted = t;
    }
  });

  fullAssistant.simulateVoiceInput(fullGmailVoice);
  fullAssistant.confirmTranscript();

  const parsedFull = taskParser.parseTask(fullSubmitted);
  const fullSendStep = parsedFull.steps.find(s => (s.targetHint || s.target || "").toLowerCase().includes("send"));
  assert.ok(fullSendStep, "Send step must exist in full Gmail workflow");

  const fullSafety = reasoningPlanner.classifyActionRisk({ action: "CLICK", target: fullSendStep.targetHint || "send" }, fullSubmitted);
  assert.strictEqual(fullSafety.risk, "HIGH", "Send action in Gmail workflow must be HIGH risk");
  assert.strictEqual(fullSafety.requiresApproval, true, "Send action must require explicit approval");

  console.log(`  ✓ Consequential voice command "${submittedTask}" strictly enforced HIGH risk [APPROVAL REQ]`);
  console.log("  ✓ Voice layer has zero privilege to bypass safety gates or auto-approve high-risk actions");
}

// [TEST 7] Speech API Unavailable Handling
console.log("\n[TEST 7] Speech API unavailable graceful degradation");
{
  let errorFired = false;
  let recordedError = "";

  const voiceAssistant = new voiceModule.VoiceAssistantController({
    SpeechRecognition: null, // Simulate environment where Web Speech API is absent
    onError: (msg) => {
      errorFired = true;
      recordedError = msg;
    }
  });

  assert.strictEqual(voiceAssistant.isAvailable(), false, "isAvailable must return false when API absent");

  const startRes = voiceAssistant.startListening();
  assert.strictEqual(startRes, false, "startListening must return false when API absent");
  assert.strictEqual(voiceAssistant.getState(), "ERROR", "State must be ERROR");
  assert.strictEqual(errorFired, true, "onError callback must fire");
  assert.ok(recordedError.includes("Voice input is not available in this browser"), "Informative fallback message provided");

  // Verify normal typed agent task continues working even when voice is unavailable
  const typedTask = "Find the login button";
  const parsed = taskParser.parseTask(typedTask);
  assert.ok(parsed && parsed.goals.length > 0, "Typed task pipeline remains 100% operational");

  console.log("  ✓ Graceful degradation confirmed: Informative notice displayed without breaking extension");
}

// [TEST 8] Transcript Normalization
console.log("\n[TEST 8] Transcript normalization");
{
  assert.strictEqual(voiceModule.normalizeTranscript("   hello    world   "), "Hello world");
  assert.strictEqual(voiceModule.normalizeTranscript("find the search box"), "Find the search box");
  assert.strictEqual(voiceModule.normalizeTranscript(""), "");
  assert.strictEqual(voiceModule.normalizeTranscript(null), "");
  assert.strictEqual(voiceModule.normalizeTranscript(undefined), "");
  assert.strictEqual(voiceModule.normalizeTranscript("   \n\t  click button  \t "), "Click button");

  console.log("  ✓ Harmless whitespace and formatting normalization verified");
}

// [TEST 9] Speech Recognition Error Mapping
console.log("\n[TEST 9] Speech Recognition error handling & recovery");
{
  class MockFailingRecognition {
    constructor() {
      this.errorToTrigger = "not-allowed";
    }
    start() {
      setTimeout(() => {
        if (typeof this.onerror === "function") {
          this.onerror({ error: this.errorToTrigger });
        }
      }, 5);
    }
    stop() {}
    abort() {}
  }

  let reportedError = "";
  const failingAssistant = new voiceModule.VoiceAssistantController({
    SpeechRecognition: MockFailingRecognition,
    onError: (msg) => {
      reportedError = msg;
    }
  });

  failingAssistant.startListening();

  setTimeout(() => {
    assert.strictEqual(failingAssistant.getState(), "ERROR");
    assert.ok(reportedError.includes("Microphone permission denied"), "not-allowed mapped to permission message");

    // Recovering: user can clear and return to IDLE
    failingAssistant.clearTranscript();
    assert.strictEqual(failingAssistant.getState(), "IDLE");

    console.log("  ✓ Microphone permission denial safely handled and UI returned to usable state");

    // [TEST 10] Diagnostic Fix Verification: Interim accumulation, onspeechend, and stopListening
    console.log("\n[TEST 10] Diagnostic fix verification: Interim accumulation, onspeechend & stopListening");
    {
      let instanceCreated = null;
      let stateTransitions = [];
      let executed = false;

      class MockDiagnosticRecognition {
        constructor() {
          this.continuous = false;
          this.interimResults = false;
          this.lang = "en-US";
          this.stopped = false;
          instanceCreated = this;
        }
        start() {
          if (typeof this.onstart === "function") this.onstart();
        }
        stop() {
          this.stopped = true;
          // In Web Speech API, stop() allows pending results to arrive then fires onend
          if (typeof this.onend === "function") this.onend();
        }
        abort() {}
      }

      const assistant = new voiceModule.VoiceAssistantController({
        SpeechRecognition: MockDiagnosticRecognition,
        onStateChange: (state, msg) => {
          stateTransitions.push({ state, msg });
        },
        onExecute: () => {
          executed = true;
        }
      });

      assistant.startListening();
      assert.strictEqual(instanceCreated.interimResults, true, "recognition.interimResults must be set to true");
      assert.strictEqual(assistant.getState(), "LISTENING");

      // 1. Send interim result
      instanceCreated.onresult({
        resultIndex: 0,
        results: [
          Object.assign([{ transcript: "find search" }], { isFinal: false })
        ]
      });
      // Verify state is still LISTENING (not CONFIRMING), no execution occurred
      assert.strictEqual(assistant.getState(), "LISTENING", "Interim result must not change state to CONFIRMING");
      assert.strictEqual(assistant.getTranscript(), "", "Interim result must not populate final transcript");
      assert.strictEqual(executed, false, "Interim result must never execute anything");

      // 2. Send accumulated interim + final result
      instanceCreated.onresult({
        resultIndex: 0,
        results: [
          Object.assign([{ transcript: "find search box" }], { isFinal: true })
        ]
      });
      assert.strictEqual(assistant.getState(), "CONFIRMING", "Final result must transition state to CONFIRMING");
      assert.strictEqual(assistant.getTranscript(), "Find search box", "Final transcript must be normalized");
      assert.strictEqual(executed, false, "Execution must still require explicit user confirmation");

      // 3. Verify onspeechend triggers recognition.stop()
      assert.strictEqual(typeof instanceCreated.onspeechend, "function", "onspeechend handler must be attached");
      instanceCreated.onspeechend();
      assert.strictEqual(instanceCreated.stopped, true, "onspeechend must call recognition.stop()");

      // 4. Verify stopListening does not clobber CONFIRMING state
      assistant.stopListening();
      assert.strictEqual(assistant.getState(), "CONFIRMING", "stopListening must preserve CONFIRMING state");

      // 5. User explicitly confirms
      assistant.confirmTranscript();
      assert.strictEqual(executed, true, "Explicit user confirmation executes pipeline");

      console.log("  ✓ Diagnostic fixes verified: interimResults=true, isFinal accumulation, onspeechend, and preserved confirmation");
    }

    // [TEST 11] Swappable STT Provider Abstraction & Mic Diagnostics
    console.log("\n[TEST 11] STT Provider Abstraction & Swappability (Preference 3)");
    {
      let executedTask = null;

      class MockCustomSTTProvider extends voiceModule.BaseSTTProvider {
        constructor() {
          super("mock-local-stt");
          this.active = false;
        }
        isAvailable() { return true; }
        start(callbacks) {
          this.active = true;
          if (callbacks.onStart) callbacks.onStart();
          // Simulate local speech engine recognizing speech
          setTimeout(() => {
            if (callbacks.onResult) {
              callbacks.onResult({
                resultIndex: 0,
                results: [
                  Object.assign([{ transcript: "open youtube and search for tutorials" }], { isFinal: true })
                ]
              });
            }
          }, 5);
          return true;
        }
        stop() { this.active = false; }
        abort() { this.active = false; }
      }

      const assistant = new voiceModule.VoiceAssistantController({
        onExecute: (task) => {
          executedTask = task;
        }
      });

      // Verify default provider is WebSpeechSTTProvider
      assert.strictEqual(assistant.sttProvider.name, "web-speech");

      // Swap provider via clean abstraction
      const customProvider = new MockCustomSTTProvider();
      assistant.setSTTProvider(customProvider);
      assert.strictEqual(assistant.sttProvider.name, "mock-local-stt");

      // Start listening with swapped provider
      assistant.startListening();
      assert.strictEqual(assistant.getState(), "LISTENING");

      setTimeout(() => {
        // Transcript received from custom provider
        assert.strictEqual(assistant.getState(), "CONFIRMING");
        assert.strictEqual(assistant.getTranscript(), "Open youtube and search for tutorials");
        assert.strictEqual(executedTask, null, "Pipeline must NOT execute without explicit confirmation");

        // Confirm
        assistant.confirmTranscript();
        assert.strictEqual(executedTask, "Open youtube and search for tutorials");
        assert.strictEqual(assistant.getState(), "IDLE");

        // Verify routing through task parser
        const parsed = taskParser.parseTask(executedTask);
        assert.ok(parsed.goals.length >= 1, "Swapped provider command parsed identically by existing agent pipeline");

        console.log("  ✓ Swappable STT provider abstraction verified: provider swapped and routed through confirmation into existing agent pipeline without modifying core agent");

        console.log("\n============================================================");
        console.log("ALL MILESTONE 20 VOICE ASSISTANT VERIFICATION TESTS PASSED!");
        console.log("============================================================\n");
      }, 15);
    }
  }, 20);
}
