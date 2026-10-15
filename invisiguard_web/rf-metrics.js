/**
 * InvisiGuard — Live RF Signal Metrics & Subcarrier Spectrum Visualizer
 * Implemented with High-DPI Canvas 2D (Vanilla JS)
 *
 * Features:
 * 1. Rolling RSSI Sparkline with dynamic gradient & peak indicators
 * 2. 52-OFDM Subcarrier CSI Amplitude Spectrum Equalizer
 * 3. Spectral Energy, Variance & Motion Band telemetry gauges
 */

class RfMetricsEngine {
    constructor(rssiCanvasId, spectrumCanvasId) {
        this.rssiCanvas = document.getElementById(rssiCanvasId);
        this.spectrumCanvas = document.getElementById(spectrumCanvasId);
        this.rssiCtx = this.rssiCanvas ? this.rssiCanvas.getContext('2d') : null;
        this.spectrumCtx = this.spectrumCanvas ? this.spectrumCanvas.getContext('2d') : null;

        this.animFrameId = null;
        this.isDestroyed = false;

        // RSSI Sparkline History
        this.rssiHistory = [];
        this.maxRssiHistory = 60;
        this.minRssi = -70.0;
        this.maxRssi = -40.0;
        this.currentRssi = -58.0;

        // Subcarrier Amplitudes (52 OFDM subcarriers)
        this.numSubcarriers = 52;
        this.subcarrierAmps = new Float32Array(this.numSubcarriers);
        this.targetSubcarrierAmps = new Float32Array(this.numSubcarriers);

        // Pre-fill default natural multipath shape
        for (let i = 0; i < this.numSubcarriers; i++) {
            const base = 12.0 + 3.5 * Math.sin((i / this.numSubcarriers) * Math.PI);
            this.subcarrierAmps[i] = base;
            this.targetSubcarrierAmps[i] = base;
        }

        this.abortController = new AbortController();
        this._init();
    }

    _init() {
        this._handleResize();
        window.addEventListener('resize', () => this._handleResize(), { signal: this.abortController.signal });

        // Pre-fill RSSI history
        for (let i = 0; i < this.maxRssiHistory; i++) {
            this.rssiHistory.push(-58.0 + (Math.random() - 0.5) * 2.0);
        }

        this._animate();
    }

    _handleResize() {
        this._setupHighDPI(this.rssiCanvas, this.rssiCtx);
        this._setupHighDPI(this.spectrumCanvas, this.spectrumCtx);
    }

    _setupHighDPI(canvas, ctx) {
        if (!canvas || !ctx) return;
        const rect = canvas.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);

        canvas.width = (rect.width || 300) * dpr;
        canvas.height = (rect.height || 85) * dpr;
        ctx.resetTransform?.();
        ctx.scale(dpr, dpr);
    }

    // Ingest live sensing frame from WebSocket
    updateMetrics(frame) {
        if (!frame) return;

        // 1. Extract RSSI
        const features = frame.features || {};
        const nodes = frame.nodes || [];
        const node = nodes[0] || {};

        let rssi = features.mean_rssi;
        if (rssi === undefined && node.rssi_dbm !== undefined) {
            rssi = node.rssi_dbm;
        }
        if (rssi !== undefined && !isNaN(rssi)) {
            this.currentRssi = parseFloat(rssi);
            this.rssiHistory.push(this.currentRssi);
            if (this.rssiHistory.length > this.maxRssiHistory) {
                this.rssiHistory.shift();
            }

            // Update dynamic min/max bounds
            let minVal = 999, maxVal = -999;
            for (let v of this.rssiHistory) {
                if (v < minVal) minVal = v;
                if (v > maxVal) maxVal = v;
            }
            this.minRssi = Math.floor(minVal - 2);
            this.maxRssi = Math.ceil(maxVal + 2);
        }

        // 2. Extract Subcarrier Amplitudes
        const amps = node.amplitude || frame.amplitude;
        if (Array.isArray(amps) && amps.length > 0) {
            const count = Math.min(amps.length, this.numSubcarriers);
            for (let i = 0; i < count; i++) {
                this.targetSubcarrierAmps[i] = parseFloat(amps[i]) || 10.0;
            }
        }
    }

    _animate() {
        if (this.isDestroyed) return;
        this.animFrameId = requestAnimationFrame(() => this._animate());

        // Smoothly interpolate subcarrier amplitudes
        for (let i = 0; i < this.numSubcarriers; i++) {
            this.subcarrierAmps[i] += (this.targetSubcarrierAmps[i] - this.subcarrierAmps[i]) * 0.25;
        }

        this._drawRssi();
        this._drawSpectrum();
    }

    _drawRssi() {
        const c = this.rssiCanvas;
        const ctx = this.rssiCtx;
        if (!c || !ctx || this.rssiHistory.length < 2) return;

        const w = c.getBoundingClientRect().width || 300;
        const h = c.getBoundingClientRect().height || 85;

        ctx.clearRect(0, 0, w, h);

        const range = Math.max(4, this.maxRssi - this.minRssi);
        const step = w / (this.maxRssiHistory - 1);

        // Grid lines
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
        ctx.lineWidth = 1;
        for (let y = 10; y < h; y += 22) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
        }

        // Compute points
        const points = [];
        for (let i = 0; i < this.rssiHistory.length; i++) {
            const val = this.rssiHistory[i];
            const norm = (val - this.minRssi) / range;
            const x = i * step;
            const y = h - (norm * (h - 16) + 8);
            points.push({ x, y });
        }

        // Fill area gradient
        ctx.beginPath();
        ctx.moveTo(points[0].x, h);
        ctx.lineTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.lineTo(points[points.length - 1].x, h);
        ctx.closePath();

        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, 'rgba(0, 240, 255, 0.28)');
        grad.addColorStop(1, 'rgba(0, 240, 255, 0.01)');
        ctx.fillStyle = grad;
        ctx.fill();

        // Stroke line
        ctx.beginPath();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#00f0ff';
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 6;
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Current head dot
        const lastPt = points[points.length - 1];
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(lastPt.x, lastPt.y, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    _drawSpectrum() {
        const c = this.spectrumCanvas;
        const ctx = this.spectrumCtx;
        if (!c || !ctx) return;

        const w = c.getBoundingClientRect().width || 600;
        const h = c.getBoundingClientRect().height || 120;

        ctx.clearRect(0, 0, w, h);

        const barGap = 2;
        const barWidth = Math.max(3, (w - (this.numSubcarriers - 1) * barGap) / this.numSubcarriers);
        const maxAmp = 28.0;

        // Draw subcarrier bars
        for (let i = 0; i < this.numSubcarriers; i++) {
            const amp = Math.max(0.5, this.subcarrierAmps[i]);
            const barH = Math.min(h - 10, (amp / maxAmp) * (h - 14));
            const x = i * (barWidth + barGap);
            const y = h - barH;

            // Gradient per bar (Cyan at bottom, Neon Purple at peak)
            const grad = ctx.createLinearGradient(0, h, 0, y);
            grad.addColorStop(0, '#00f0ff');
            grad.addColorStop(0.65, '#38bdf8');
            grad.addColorStop(1, '#a855f7');

            ctx.fillStyle = grad;
            ctx.fillRect(x, y, barWidth, barH);

            // Subcarrier peak cap
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(x, y, barWidth, 2);
        }

        // Subcarrier Center Null Marker (DC subcarrier 26)
        const dcX = 26 * (barWidth + barGap);
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(dcX, 0);
        ctx.lineTo(dcX, h);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    destroy() {
        this.isDestroyed = true;
        if (this.animFrameId) {
            cancelAnimationFrame(this.animFrameId);
        }
        if (this.abortController) {
            this.abortController.abort();
        }
    }
}

// Global export for vanilla script inclusion
window.RfMetricsEngine = RfMetricsEngine;
