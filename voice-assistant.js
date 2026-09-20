/**
 * voice-assistant.js - Milestone 20: Voice Assistant Input Layer
 * 
 * Provides a browser-native voice-command input interface for the Browser Agent.
 * Voice acts purely as an input modality:
 * 
 * VOICE INPUT
 *     ↓
 * SPEECH RECOGNITION (Web Speech API)
 *     ↓
 * TRANSCRIPT NORMALIZATION
 *     ↓
 * USER CONFIRMATION REQUIRED ("Use This Command" / "Try Again")
 *     ↓
 * EXISTING AGENT TASK INPUT & PIPELINE
 *     ↓
 * PERCEIVE → REASON → GROUND → SAFETY → EXECUTE → VERIFY
 * 
 * Architectural & Privacy Guarantees:
 * - Voice has ZERO execution authority; it only sets task text with explicit confirmation.
 * - Reuses the exact same task parser, planner, perception, grounding, safety gate, and execution loop.
 * - Technically honest: Uses browser-native SpeechRecognition (or webkitSpeechRecognition); does not claim full on-device STT.
 * - Fails safely if SpeechRecognition is unavailable or microphone access is denied.
 */

(function () {
  "use strict";

  const VOICE_STATE = {
    IDLE: "IDLE",
    LISTENING: "LISTENING",
    PROCESSING: "PROCESSING",
    CONFIRMING: "CONFIRMING",
    RUNNING: "RUNNING",
    ERROR: "ERROR"
  };

  /**
   * Normalizes speech recognition transcripts (trims, collapses extra spaces, harmless formatting).
   * 
   * @param {string} rawText 
   * @returns {string} Cleaned transcript
   */
  function normalizeTranscript(rawText) {
    if (!rawText || typeof rawText !== "string") return "";
    let cleaned = rawText.trim().replace(/\s+/g, " ");
    if (cleaned.length > 0) {
      // Capitalize first character if lowercase letter
      cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }
    return cleaned;
  }

  /**
   * VoiceAssistantController manages the voice input lifecycle, speech recognition events,
   * user confirmation states, and handoff to the existing Agent Task pipeline.
   */
  /**
   * Hardware Microphone Activity Monitor
   * Uses Web Audio API and getUserMedia to measure actual acoustic energy (RMS & peak)
   * on the device without sending audio anywhere. Diagnoses whether 'no-speech'
   * is caused by physical microphone silence vs Chrome Web Speech cloud timeouts.
   */
  class MicActivityMonitor {
    constructor() {
      this.audioContext = null;
      this.mediaStream = null;
      this.analyser = null;
      this.hasDetectedAudio = false;
      this.peakLevel = 0;
      this.rafId = null;
    }

    async start() {
      this.hasDetectedAudio = false;
      this.peakLevel = 0;
      if (typeof navigator === "undefined" || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        return false;
      }
      try {
        const AudioCtx = (typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext)) || null;
        if (!AudioCtx) return false;

        this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        this.audioContext = new AudioCtx();
        const source = this.audioContext.createMediaStreamSource(this.mediaStream);
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 256;
        source.connect(this.analyser);

        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const checkAudio = () => {
          if (!this.analyser) return;
          this.analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i];
          }
          const avg = sum / bufferLength;
          if (avg > this.peakLevel) this.peakLevel = avg;
          if (avg > 8) { // Acoustic speech threshold
            this.hasDetectedAudio = true;
          }
          if (typeof requestAnimationFrame === "function") {
            this.rafId = requestAnimationFrame(checkAudio);
          }
        };
        checkAudio();
        return true;
      } catch (err) {
        console.log("[M20][VOICE] MicActivityMonitor could not start:", err.message);
        return false;
      }
    }

    stop() {
      if (this.rafId && typeof cancelAnimationFrame === "function") {
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }
      if (this.mediaStream) {
        try {
          this.mediaStream.getTracks().forEach(t => t.stop());
        } catch (_) {}
        this.mediaStream = null;
      }
      if (this.audioContext && this.audioContext.state !== "closed") {
        try {
          this.audioContext.close();
        } catch (_) {}
        this.audioContext = null;
      }
    }
  }

  /**
   * Base class for pluggable Speech-To-Text Providers.
   * Allows swapping speech recognition mechanisms (WebSpeech, local WASM, server-based)
   * without touching the agent execution pipeline.
   */
  class BaseSTTProvider {
    constructor(name) {
      this.name = name || "base";
    }
    isAvailable() { return true; }
    start(callbacks) {}
    stop() {}
    abort() {}
  }

  /**
   * WebSpeechSTTProvider wraps browser-native SpeechRecognition / webkitSpeechRecognition.
   */
  class WebSpeechSTTProvider extends BaseSTTProvider {
    constructor(SpeechRecognitionClass, options = {}) {
      super("web-speech");
      this.SpeechRecognitionClass = SpeechRecognitionClass;
      this.options = options;
      this.recognition = null;
    }

    isAvailable() {
      return Boolean(this.SpeechRecognitionClass);
    }

    start(callbacks = {}) {
      if (!this.isAvailable()) return false;
      if (this.recognition) {
        try { this.recognition.abort(); } catch (_) {}
      }

      const recognition = new this.SpeechRecognitionClass();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = this.options.lang || "en-US";

      recognition.onstart = () => {
        if (callbacks.onStart) callbacks.onStart();
      };
      recognition.onspeechstart = () => {
        if (callbacks.onSpeechStart) callbacks.onSpeechStart();
      };
      recognition.onspeechend = () => {
        if (callbacks.onSpeechEnd) callbacks.onSpeechEnd();
        try { recognition.stop(); } catch (_) {}
      };
      recognition.onresult = (event) => {
        if (callbacks.onResult) callbacks.onResult(event);
      };
      recognition.onerror = (event) => {
        if (callbacks.onError) callbacks.onError(event);
      };
      recognition.onend = () => {
        if (callbacks.onEnd) callbacks.onEnd();
      };

      this.recognition = recognition;
      recognition.start();
      return true;
    }

    stop() {
      if (this.recognition) {
        try { this.recognition.stop(); } catch (_) {}
      }
    }

    abort() {
      if (this.recognition) {
        try { this.recognition.abort(); } catch (_) {}
      }
    }
  }

  /**
   * VoiceAssistantController manages the voice input lifecycle, speech recognition events,
   * hardware acoustic diagnostics, user confirmation states, and handoff to the Agent Task pipeline.
   */
  class VoiceAssistantController {
    constructor(options = {}) {
      this.options = options;
      this.state = VOICE_STATE.IDLE;
      this.currentTranscript = "";
      this.errorMessage = "";

      // Allow injecting custom SpeechRecognition class (useful for unit tests and headless environments)
      const GlobalSpeech = (typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition)) || null;
      this.SpeechRecognitionClass = options.SpeechRecognition || GlobalSpeech;

      // Initialize pluggable STT Provider
      this.sttProvider = options.sttProvider || new WebSpeechSTTProvider(this.SpeechRecognitionClass, {
        lang: options.lang || "en-US"
      });

      // Hardware mic activity diagnostic monitor
      this.micMonitor = new MicActivityMonitor();

      // Event callbacks
      this.onStateChange = typeof options.onStateChange === "function" ? options.onStateChange : null;
      this.onTranscriptReady = typeof options.onTranscriptReady === "function" ? options.onTranscriptReady : null;
      this.onExecute = typeof options.onExecute === "function" ? options.onExecute : null;
      this.onError = typeof options.onError === "function" ? options.onError : null;
    }

    /**
     * Checks if active STT provider is available.
     * @returns {boolean}
     */
    isAvailable() {
      return Boolean(this.sttProvider && this.sttProvider.isAvailable());
    }

    /**
     * Allows plugging an alternate STT provider.
     * @param {BaseSTTProvider} provider 
     */
    setSTTProvider(provider) {
      if (provider && typeof provider.start === "function") {
        this.sttProvider = provider;
      }
    }

    /**
     * Returns current voice assistant state.
     * @returns {string}
     */
    getState() {
      return this.state;
    }

    /**
     * Returns current normalized transcript.
     * @returns {string}
     */
    getTranscript() {
      return this.currentTranscript;
    }

    /**
     * Internal state updater that fires state change callback.
     * @param {string} newState 
     * @param {string} message 
     */
    _setState(newState, message = "") {
      this.state = newState;
      if (this.onStateChange) {
        this.onStateChange(this.state, message, this.currentTranscript);
      }
    }

    /**
     * Starts listening via active STT provider and initiates local mic activity monitoring.
     */
    startListening() {
      if (!this.isAvailable()) {
        this.errorMessage = "Voice input is not available in this browser. You can still use the text Agent Task.";
        this._setState(VOICE_STATE.ERROR, this.errorMessage);
        if (this.onError) this.onError(this.errorMessage);
        return false;
      }

      this.currentTranscript = "";
      this.errorMessage = "";

      // Start hardware mic energy monitor in parallel (client-side only, zero transmission)
      try {
        this.micMonitor.start();
      } catch (_) {}

      try {
        const started = this.sttProvider.start({
          onStart: () => {
            console.log("[M20][VOICE] onstart: recognition started, state:", this.state);
            this._setState(VOICE_STATE.LISTENING, "Listening... Speak your browser task...");
          },
          onSpeechStart: () => {
            console.log("[M20][VOICE] onspeechstart: speech detected, state:", this.state);
          },
          onSpeechEnd: () => {
            console.log("[M20][VOICE] speechend");
          },
          onResult: (event) => {
            try {
              console.log("[M20][VOICE] onresult fired, state:", this.state);
              let finalTranscript = "";
              let interimTranscript = "";

              if (event && event.results) {
                const startIndex = (typeof event.resultIndex === "number") ? event.resultIndex : 0;
                for (let i = startIndex; i < event.results.length; ++i) {
                  if (event.results[i].isFinal || event.results[i].isFinal === undefined) {
                    finalTranscript += (event.results[i][0] && event.results[i][0].transcript) || "";
                  } else {
                    interimTranscript += (event.results[i][0] && event.results[i][0].transcript) || "";
                  }
                }
              }

              if (interimTranscript && !finalTranscript) {
                console.log("[M20][VOICE] interim transcript received:", interimTranscript);
                if (this.state === VOICE_STATE.LISTENING) {
                  this._setState(VOICE_STATE.LISTENING, `Listening: "${interimTranscript.trim()}"`);
                }
              }

              if (finalTranscript) {
                console.log("[M20][VOICE] final transcript received:", finalTranscript);
                const normalized = normalizeTranscript(finalTranscript);

                if (normalized.length > 0) {
                  this.currentTranscript = normalized;
                  this._setState(VOICE_STATE.CONFIRMING, "Confirm this browser task.");
                  if (this.onTranscriptReady) {
                    this.onTranscriptReady(this.currentTranscript);
                  }
                } else {
                  this.errorMessage = "No command was detected. Please try again.";
                  this._setState(VOICE_STATE.ERROR, this.errorMessage);
                  if (this.onError) this.onError(this.errorMessage);
                }
              }
            } catch (err) {
              console.log("[M20][VOICE] onresult error:", err.message);
              this.errorMessage = `Error processing speech result: ${err.message}`;
              this._setState(VOICE_STATE.ERROR, this.errorMessage);
              if (this.onError) this.onError(this.errorMessage);
            }
          },
          onError: (event) => {
            const errCode = event && event.error ? event.error : "unknown";
            console.log("[M20][VOICE] onerror: error type:", errCode, "state:", this.state);
            let friendlyMsg = "Voice input failed. You can retry or type the task.";

            if (errCode === "not-allowed" || errCode === "permission-denied") {
              friendlyMsg = "Microphone permission denied. Please allow microphone access or use text input.";
            } else if (errCode === "no-speech") {
              if (this.micMonitor && this.micMonitor.hasDetectedAudio) {
                friendlyMsg = "Microphone detected audio, but Chrome's speech recognition server timed out. You can retry or use text input.";
              } else {
                friendlyMsg = "No speech detected. Please check your microphone settings or speak louder.";
              }
            } else if (errCode === "network") {
              friendlyMsg = "Network error during speech recognition. You can still type your task.";
            } else if (errCode === "audio-capture") {
              friendlyMsg = "No microphone was detected on this device.";
            }

            this.errorMessage = friendlyMsg;
            this._setState(VOICE_STATE.ERROR, friendlyMsg);
            if (this.onError) this.onError(friendlyMsg);
          },
          onEnd: () => {
            console.log("[M20][VOICE] onend: recognition ended, state:", this.state);
            this.micMonitor.stop();
            // If ended while still listening without transcript or error, reset safely
            if (this.state === VOICE_STATE.LISTENING || this.state === VOICE_STATE.PROCESSING) {
              this._setState(VOICE_STATE.IDLE, "Click the microphone and speak your task.");
            }
          }
        });

        return started;
      } catch (err) {
        console.log("[M20][VOICE] startListening exception:", err.message);
        this.micMonitor.stop();
        this.errorMessage = `Could not start voice recognition: ${err.message}`;
        this._setState(VOICE_STATE.ERROR, this.errorMessage);
        if (this.onError) this.onError(this.errorMessage);
        return false;
      }
    }

    /**
     * Stops active speech recognition.
     */
    stopListening() {
      console.log("[M20][VOICE] stopListening called, state:", this.state);
      this.micMonitor.stop();
      if (this.sttProvider) {
        this.sttProvider.stop();
      }
    }

    /**
     * User confirms the recognized transcript ("Use This Command").
     * Invokes existing Agent Task pipeline with the confirmed transcript.
     */
    confirmTranscript() {
      if (!this.currentTranscript || this.state !== VOICE_STATE.CONFIRMING) {
        return false;
      }

      const taskToRun = this.currentTranscript;
      this._setState(VOICE_STATE.RUNNING, "Agent is executing the confirmed task.");

      if (this.onExecute) {
        this.onExecute(taskToRun);
      }

      // Return to IDLE after handoff
      this._setState(VOICE_STATE.IDLE, "Task submitted. Click microphone to speak a new task.");
      return true;
    }

    /**
     * User requests to try again ("Try Again").
     * Discards previous transcript and restarts listening.
     */
    tryAgain() {
      this.currentTranscript = "";
      this.errorMessage = "";
      return this.startListening();
    }

    /**
     * User cancels or clears the transcript.
     */
    clearTranscript() {
      this.currentTranscript = "";
      this.errorMessage = "";
      this.micMonitor.stop();
      if (this.sttProvider) {
        try {
          this.sttProvider.abort();
        } catch (_) {}
      }
      this._setState(VOICE_STATE.IDLE, "Click the microphone and speak your task.");
    }

    /**
     * Programmatic simulation helper for automated testing and verification.
     * Simulates speech recognition producing a transcript.
     * 
     * @param {string} transcriptText 
     */
    simulateVoiceInput(transcriptText) {
      this._setState(VOICE_STATE.LISTENING, "Listening... Speak your browser task...");
      const normalized = normalizeTranscript(transcriptText);

      if (normalized.length > 0) {
        this.currentTranscript = normalized;
        this._setState(VOICE_STATE.CONFIRMING, "Confirm this browser task.");
        if (this.onTranscriptReady) {
          this.onTranscriptReady(this.currentTranscript);
        }
      } else {
        this.errorMessage = "No command was detected. Please try again.";
        this._setState(VOICE_STATE.ERROR, this.errorMessage);
        if (this.onError) this.onError(this.errorMessage);
      }
    }
  }

  // Export to global window for Chrome Extension environment
  if (typeof window !== "undefined") {
    window.SIHVoiceAssistant = {
      VOICE_STATE,
      VoiceAssistantController,
      BaseSTTProvider,
      WebSpeechSTTProvider,
      MicActivityMonitor,
      normalizeTranscript
    };
  }

  // Export to module.exports for Node.js test environment
  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      VOICE_STATE,
      VoiceAssistantController,
      BaseSTTProvider,
      WebSpeechSTTProvider,
      MicActivityMonitor,
      normalizeTranscript
    };
  }
})();
