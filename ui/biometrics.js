/**
 * InvisiGuard — Vital Signs & Biometrics HUD Engine
 * Implemented with High-DPI Canvas 2D & Web Audio API (Vanilla JS)
 *
 * Features:
 * 1. Synchronized High-DPI ECG Cardiac Oscilloscope (P-Q-R-S-T complex)
 * 2. Sinusoidal Pulmonary Respiration Oscilloscope
 * 3. Web Audio API Cardiac Sound & Alarm Chime Synthesizer
 */

class BiometricsEngine {
    constructor(ecgCanvasId, respCanvasId) {
        this.ecgCanvas = document.getElementById(ecgCanvasId);
        this.respCanvas = document.getElementById(respCanvasId);
        this.ecgCtx = this.ecgCanvas ? this.ecgCanvas.getContext('2d') : null;
        this.respCtx = this.respCanvas ? this.respCanvas.getContext('2d') : null;

        this.animFrameId = null;
        this.isDestroyed = false;

        // Vital Signs State
        this.bpm = 74.0;
        this.rpm = 16.4;
        this.confidence = 0.96;
        this.presence = true;

        // Waveform Buffers
        this.ecgBuffer = [];
        this.respBuffer = [];
        this.maxBufferLen = 240;

        // Oscilloscope Phase tracking
        this.ecgPhase = 0.0;
        this.respPhase = 0.0;
        this.lastTime = performance.now();

        // Web Audio Synthesizer
        this.audioCtx = null;
        this.soundEnabled = false;
        this.lastBeepTime = 0;
        this.abortController = new AbortController();

        this._init();
    }

    _init() {
        this._handleResize();
        window.addEventListener('resize', () => this._handleResize(), { signal: this.abortController.signal });

        // Pre-fill buffers
        for (let i = 0; i < this.maxBufferLen; i++) {
            this.ecgBuffer.push(0);
            this.respBuffer.push(0);
        }

        this._animate();
    }

    _handleResize() {
        this._setupHighDPI(this.ecgCanvas, this.ecgCtx);
        this._setupHighDPI(this.respCanvas, this.respCtx);
    }

    _setupHighDPI(canvas, ctx) {
        if (!canvas || !ctx) return;
        const rect = canvas.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);

        canvas.width = (rect.width || 300) * dpr;
        canvas.height = (rect.height || 70) * dpr;
        ctx.resetTransform?.();
        ctx.scale(dpr, dpr);
    }

    // Toggle Audio
    setAudioEnabled(enabled) {
        this.soundEnabled = enabled;
        if (enabled && !this.audioCtx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                this.audioCtx = new AudioContext();
            }
        }
        if (this.audioCtx && this.audioCtx.state === 'suspended' && enabled) {
            this.audioCtx.resume();
        }
    }

    resumeAudio() {
        if (!this.audioCtx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                this.audioCtx = new AudioContext();
            }
        }
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
    }

    // Play subtle cardiac blip
    _playHeartbeatSound() {
        if (!this.soundEnabled || !this.audioCtx) return;
        try {
            const now = this.audioCtx.currentTime;
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(140, now);
            osc.frequency.exponentialRampToValueAtTime(45, now + 0.08);

            gain.gain.setValueAtTime(0.06, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

            osc.connect(gain);
            gain.connect(this.audioCtx.destination);

            osc.start(now);
            osc.stop(now + 0.09);
        } catch {
            // Audio context policy
        }
    }

    // Play threat alert alarm tone
    playAlarmSound(type = 'struggle') {
        if (!this.soundEnabled || !this.audioCtx) return;
        try {
            const now = this.audioCtx.currentTime;
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();

            osc.type = 'sawtooth';
            if (type === 'struggle') {
                osc.frequency.setValueAtTime(880, now);
                osc.frequency.setValueAtTime(440, now + 0.12);
                osc.frequency.setValueAtTime(880, now + 0.24);
                gain.gain.setValueAtTime(0.12, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
            } else if (type === 'inactivity') {
                osc.frequency.setValueAtTime(440, now);
                osc.frequency.setValueAtTime(330, now + 0.18);
                gain.gain.setValueAtTime(0.10, now);
                gain.gain.exponentialRampToValueAtTime(0.005, now + 0.45);
            } else {
                // Fall alert: low urgency chime
                osc.frequency.setValueAtTime(520, now);
                osc.frequency.setValueAtTime(390, now + 0.2);
                gain.gain.setValueAtTime(0.15, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
            }

            osc.connect(gain);
            gain.connect(this.audioCtx.destination);
            osc.start(now);
            osc.stop(now + 0.45);
        } catch {
            // Audio policy
        }
    }

    // Update with live sensing frame data
    updateVitals(vitals, presence = true) {
        this.presence = presence;
        if (!presence) {
            this.bpm = 0;
            this.rpm = 0;
            return;
        }

        if (vitals) {
            if (vitals.heart_rate_bpm || vitals.heartrate_bpm) {
                const newBpm = parseFloat(vitals.heart_rate_bpm || vitals.heartrate_bpm);
                if (newBpm > 35 && newBpm < 190) {
                    this.bpm = newBpm;
                }
            }
            if (vitals.breathing_rate_bpm) {
                const newRpm = parseFloat(vitals.breathing_rate_bpm);
                if (newRpm > 4 && newRpm < 50) {
                    this.rpm = newRpm;
                }
            }
            if (vitals.confidence) {
                this.confidence = parseFloat(vitals.confidence);
            }
        }
    }

    // Mathematical Cardiac Function: P-Q-R-S-T synthesis
    _synthesizeECG(phase) {
        const p = (phase % 1.0); // Normalized 0 to 1

        let val = 0.0;

        // Baseline wander / noise
        val += (Math.random() - 0.5) * 0.03;

        // P Wave (Atrial depolarization: 0.12 - 0.22)
        if (p > 0.14 && p < 0.24) {
            const sub = (p - 0.19) / 0.05;
            val += 0.16 * Math.exp(-sub * sub * 4);
        }

        // Q Dip (0.28 - 0.31)
        if (p > 0.27 && p < 0.32) {
            const sub = (p - 0.295) / 0.02;
            val -= 0.15 * Math.exp(-sub * sub * 8);
        }

        // R Peak (Ventricular depolarization spike: 0.31 - 0.36)
        if (p >= 0.32 && p <= 0.38) {
            const sub = (p - 0.35) / 0.025;
            val += 0.95 * Math.exp(-sub * sub * 12);
        }

        // S Dip (0.37 - 0.41)
        if (p > 0.37 && p < 0.43) {
            const sub = (p - 0.40) / 0.025;
            val -= 0.28 * Math.exp(-sub * sub * 8);
        }

        // T Wave (Ventricular repolarization: 0.50 - 0.68)
        if (p > 0.50 && p < 0.70) {
            const sub = (p - 0.60) / 0.08;
            val += 0.32 * Math.exp(-sub * sub * 4);
        }

        return Math.max(-0.4, Math.min(1.0, val));
    }

    // Sinusoidal Respiration curve
    _synthesizeResp(phase) {
        // Natural asymmetric respiratory curve (inhalation steeper than exhalation)
        const rad = phase * Math.PI * 2;
        return 0.75 * Math.sin(rad) + 0.15 * Math.sin(2 * rad);
    }

    _animate() {
        if (this.isDestroyed) return;
        this.animFrameId = requestAnimationFrame(() => this._animate());

        const now = performance.now();
        const dt = (now - this.lastTime) / 1000.0;
        this.lastTime = now;

        if (this.presence && this.bpm > 0) {
            // Advance cardiac phase
            const heartFreq = this.bpm / 60.0; // Cycles per second (Hz)
            const prevPhase = this.ecgPhase;
            this.ecgPhase = (this.ecgPhase + dt * heartFreq) % 1.0;

            // Trigger sound on R-peak passage (~0.35 phase)
            if (prevPhase < 0.35 && this.ecgPhase >= 0.35 && (now - this.lastBeepTime > 400)) {
                this._playHeartbeatSound();
                this.lastBeepTime = now;
            }

            // Push sample to buffer
            const sample = this._synthesizeECG(this.ecgPhase);
            this.ecgBuffer.push(sample);

            // Advance respiration phase
            const respFreq = this.rpm / 60.0;
            this.respPhase = (this.respPhase + dt * respFreq) % 1.0;
            const respSample = this._synthesizeResp(this.respPhase);
            this.respBuffer.push(respSample);
        } else {
            // Zero / Flatline state
            this.ecgBuffer.push((Math.random() - 0.5) * 0.02);
            this.respBuffer.push((Math.random() - 0.5) * 0.02);
        }

        if (this.ecgBuffer.length > this.maxBufferLen) this.ecgBuffer.shift();
        if (this.respBuffer.length > this.maxBufferLen) this.respBuffer.shift();

        this._drawECG();
        this._drawResp();
    }

    _drawECG() {
        const c = this.ecgCanvas;
        const ctx = this.ecgCtx;
        if (!c || !ctx) return;

        const w = c.getBoundingClientRect().width || 300;
        const h = c.getBoundingClientRect().height || 70;

        ctx.clearRect(0, 0, w, h);

        // Grid lines (Medical Oscilloscope Grid)
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.07)';
        ctx.lineWidth = 1;
        const gridSize = 16;
        for (let x = 0; x < w; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
        }
        for (let y = 0; y < h; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
        }

        // Zero reference center line
        const midY = h * 0.65;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.beginPath();
        ctx.moveTo(0, midY);
        ctx.lineTo(w, midY);
        ctx.stroke();

        // Draw Waveform Line
        if (this.ecgBuffer.length < 2) return;

        const step = w / (this.maxBufferLen - 1);

        ctx.beginPath();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#10b981';
        ctx.shadowColor = '#10b981';
        ctx.shadowBlur = 8;

        for (let i = 0; i < this.ecgBuffer.length; i++) {
            const x = i * step;
            const y = midY - this.ecgBuffer[i] * (h * 0.48);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Draw leading sweep dot
        const lastIdx = this.ecgBuffer.length - 1;
        const headX = lastIdx * step;
        const headY = midY - this.ecgBuffer[lastIdx] * (h * 0.48);

        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#10b981';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(headX, headY, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    _drawResp() {
        const c = this.respCanvas;
        const ctx = this.respCtx;
        if (!c || !ctx) return;

        const w = c.getBoundingClientRect().width || 300;
        const h = c.getBoundingClientRect().height || 60;

        ctx.clearRect(0, 0, w, h);

        const midY = h * 0.5;
        const step = w / (this.maxBufferLen - 1);

        // Draw smooth sinusoidal curve
        ctx.beginPath();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#38bdf8';
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 6;

        for (let i = 0; i < this.respBuffer.length; i++) {
            const x = i * step;
            const y = midY - this.respBuffer[i] * (h * 0.38);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Fill subtle gradient under curve
        ctx.lineTo(w, h);
        ctx.lineTo(0, h);
        ctx.closePath();
        const grad = ctx.createLinearGradient(0, midY, 0, h);
        grad.addColorStop(0, 'rgba(56, 189, 248, 0.12)');
        grad.addColorStop(1, 'rgba(56, 189, 248, 0.0)');
        ctx.fillStyle = grad;
        ctx.fill();
    }

    destroy() {
        this.isDestroyed = true;
        if (this.animFrameId) {
            cancelAnimationFrame(this.animFrameId);
        }
        if (this.abortController) {
            this.abortController.abort();
        }
        if (this.audioCtx) {
            this.audioCtx.close().catch(() => {});
        }
    }
}

// Global export for vanilla script inclusion
window.BiometricsEngine = BiometricsEngine;
