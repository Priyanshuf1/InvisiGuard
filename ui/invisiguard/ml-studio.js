/**
 * InvisiGuard — Machine Learning Studio & Dataset Recorder Engine
 * Implemented with High-DPI Canvas 2D (Vanilla JS)
 *
 * Features:
 * 1. Live CSI 10-Feature Vector Recording & CSV Dataset Export
 * 2. Animated Model Training Simulation (Loss & Accuracy Convergence)
 * 3. Model Benchmark & Latency Analytics
 */

class MlStudioEngine {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;

        // Recording State
        this.isRecording = false;
        this.recordedFrames = [];
        this.recStartTime = 0;

        // Training State
        this.isTraining = false;
        this.currentEpoch = 0;
        this.totalEpochs = 100;
        this.lossHistory = [];
        this.accHistory = [];
        this.trainInterval = null;
        this.abortController = new AbortController();

        this._init();
    }

    _init() {
        this._handleResize();
        window.addEventListener('resize', () => this._handleResize(), { signal: this.abortController.signal });

        // Pre-fill initial benchmark curve
        for (let ep = 1; ep <= 100; ep++) {
            const decay = Math.pow(0.96, ep * 0.4);
            const loss = 0.45 * decay + 0.03 + (Math.random() - 0.5) * 0.015;
            const acc = Math.min(0.984, 0.45 + 0.53 * (1.0 - Math.exp(-ep / 18.0)) + (Math.random() - 0.5) * 0.01);
            this.lossHistory.push(Math.max(0.02, loss));
            this.accHistory.push(acc);
        }
        this._drawTrainingCurves();
    }

    _handleResize() {
        if (!this.canvas || !this.ctx) return;
        const rect = this.canvas.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);

        this.canvas.width = (rect.width || 300) * dpr;
        this.canvas.height = (rect.height || 110) * dpr;
        this.ctx.resetTransform?.();
        this.ctx.scale(dpr, dpr);
        this._drawTrainingCurves();
    }

    // Toggle CSI Recording
    toggleRecording(currentStateLabel = 'NORMAL_STUDYING') {
        this.isRecording = !this.isRecording;
        if (this.isRecording) {
            this.recordedFrames = [];
            this.recStartTime = Date.now();
        }
        return this.isRecording;
    }

    // Ingest frame for dataset recording
    recordFrame(frame, labelName = 'NORMAL_STUDYING') {
        if (!this.isRecording || !frame) return;

        const f = frame.features || {};
        const node = (frame.nodes && frame.nodes[0]) || {};

        const rssiMean = f.mean_rssi || node.rssi_dbm || -58.0;
        const rssiVar = f.variance || 1.25;
        const motion = f.motion_band_power || 0.12;
        const breath = f.breathing_band_power || 0.04;
        const spectralPower = f.spectral_power || 1.05;

        // Amplitudes
        const amps = node.amplitude || [];
        let scMean = 12.5, scStd = 1.4, scEntropy = 1.15;
        if (amps.length >= 10) {
            let sum = 0;
            amps.forEach(a => sum += a);
            scMean = sum / amps.length;
            let sqDiff = 0;
            amps.forEach(a => sqDiff += Math.pow(a - scMean, 2));
            scStd = Math.sqrt(sqDiff / amps.length);
        }

        const row = {
            timestamp: ((Date.now() - this.recStartTime) / 1000).toFixed(3),
            rssi_mean: rssiMean.toFixed(2),
            rssi_var: rssiVar.toFixed(3),
            sc_mean: scMean.toFixed(2),
            sc_std: scStd.toFixed(2),
            sc_entropy: scEntropy.toFixed(3),
            motion_power: motion.toFixed(3),
            breathing_power: breath.toFixed(3),
            variance_current: rssiVar.toFixed(3),
            velocity_delta: (motion * 1.8).toFixed(3),
            cooler_noise_ratio: (scStd / (motion + 0.01)).toFixed(3),
            label: labelName,
        };

        this.recordedFrames.push(row);
        return this.recordedFrames.length;
    }

    // Export Dataset as CSV
    exportCsv() {
        if (this.recordedFrames.length === 0) return;

        const headers = [
            'timestamp',
            'rssi_mean',
            'rssi_var',
            'sc_mean',
            'sc_std',
            'sc_entropy',
            'motion_power',
            'breathing_power',
            'variance_current',
            'velocity_delta',
            'cooler_noise_ratio',
            'label'
        ];

        let csv = headers.join(',') + '\n';
        this.recordedFrames.forEach((row) => {
            csv += headers.map(h => row[h]).join(',') + '\n';
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `invisiguard_dataset_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // Start Interactive Training Animation
    startTraining(onProgress, onComplete) {
        if (this.isTraining) return;

        this.isTraining = true;
        this.currentEpoch = 0;
        this.lossHistory = [];
        this.accHistory = [];

        this.trainInterval = setInterval(() => {
            this.currentEpoch++;

            const ep = this.currentEpoch;
            const decay = Math.pow(0.96, ep * 0.4);
            const loss = Math.max(0.03, 0.48 * decay + 0.02 * Math.sin(ep * 0.5) + (Math.random() - 0.5) * 0.015);
            const acc = Math.min(0.985, 0.42 + 0.56 * (1.0 - Math.exp(-ep / 16.0)) + (Math.random() - 0.5) * 0.01);

            this.lossHistory.push(loss);
            this.accHistory.push(acc);
            this._drawTrainingCurves();

            if (onProgress) {
                onProgress({
                    epoch: ep,
                    totalEpochs: this.totalEpochs,
                    loss: loss.toFixed(4),
                    acc: (acc * 100).toFixed(1),
                });
            }

            if (this.currentEpoch >= this.totalEpochs) {
                clearInterval(this.trainInterval);
                this.isTraining = false;
                if (onComplete) onComplete();
            }
        }, 35);
    }

    _drawTrainingCurves() {
        const c = this.canvas;
        const ctx = this.ctx;
        if (!c || !ctx || this.lossHistory.length < 2) return;

        const w = c.getBoundingClientRect().width || 300;
        const h = c.getBoundingClientRect().height || 110;

        ctx.clearRect(0, 0, w, h);

        // Grid lines
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;
        for (let y = 15; y < h; y += 22) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
        }

        const len = this.lossHistory.length;
        const step = w / Math.max(1, len - 1);

        // Draw Loss Curve (Red)
        ctx.beginPath();
        ctx.lineWidth = 1.8;
        ctx.strokeStyle = '#ef4444';
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 6;
        for (let i = 0; i < len; i++) {
            const x = i * step;
            const y = (this.lossHistory[i] / 0.55) * (h - 20) + 10;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Draw Accuracy Curve (Emerald)
        ctx.beginPath();
        ctx.lineWidth = 1.8;
        ctx.strokeStyle = '#10b981';
        ctx.shadowColor = '#10b981';
        ctx.shadowBlur = 6;
        for (let i = 0; i < len; i++) {
            const x = i * step;
            const y = h - (this.accHistory[i] * (h - 20) + 5);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
    }

    destroy() {
        if (this.trainInterval) {
            clearInterval(this.trainInterval);
        }
        if (this.abortController) {
            this.abortController.abort();
        }
    }
}

// Global export for vanilla script inclusion
window.MlStudioEngine = MlStudioEngine;
