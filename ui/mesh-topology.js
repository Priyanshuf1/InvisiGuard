/**
 * InvisiGuard — 3-Node Triangle Mesh Topology Engine
 * Implemented with High-DPI Canvas 2D (Vanilla JS)
 *
 * Visualizes:
 * - 3-Node ESP32 Sensing Network (Entrance Tx/Rx, Study Rx, Bed Rx)
 * - Real-time animated RF packets traveling across cross-links
 * - Multipath link SNR & RSSI telemetry metrics
 */

class MeshTopologyEngine {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
        this.animFrameId = null;
        this.isDestroyed = false;

        // Node Visual Configuration
        this.nodes = [
            { id: 1, name: 'Node 1 (Gateway)', x: 0.22, y: 0.32, color: '#00f0ff', rssi: -58, role: 'Tx/Rx' },
            { id: 2, name: 'Node 2 (Desk)',    x: 0.80, y: 0.32, color: '#f59e0b', rssi: -62, role: 'Rx' },
            { id: 3, name: 'Node 3 (Bed)',     x: 0.51, y: 0.82, color: '#a855f7', rssi: -59, role: 'Rx' },
        ];

        // Animated Link Packets
        this.packets = [];
        this.links = [
            { from: 0, to: 1, color: '#00f0ff' },
            { from: 1, to: 2, color: '#f59e0b' },
            { from: 2, to: 0, color: '#a855f7' },
        ];

        this.links.forEach((link, idx) => {
            for (let i = 0; i < 3; i++) {
                this.packets.push({
                    linkIdx: idx,
                    progress: i / 3.0,
                    speed: 0.4 + Math.random() * 0.2,
                });
            }
        });

        this.abortController = new AbortController();
        this._init();
    }

    _init() {
        this._handleResize();
        window.addEventListener('resize', () => this._handleResize(), { signal: this.abortController.signal });
        this._animate();
    }

    _handleResize() {
        if (!this.canvas || !this.ctx) return;
        const rect = this.canvas.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);

        this.canvas.width = (rect.width || 280) * dpr;
        this.canvas.height = (rect.height || 180) * dpr;
        this.ctx.resetTransform?.();
        this.ctx.scale(dpr, dpr);
    }

    updateNodes(nodesData) {
        if (Array.isArray(nodesData) && nodesData.length > 0) {
            nodesData.forEach((nd) => {
                const targetNode = this.nodes.find((n) => n.id === nd.node_id);
                if (targetNode && nd.rssi_dbm !== undefined) {
                    targetNode.rssi = Math.round(nd.rssi_dbm);
                }
            });
        }
    }

    _animate() {
        if (this.isDestroyed) return;
        this.animFrameId = requestAnimationFrame(() => this._animate());

        const c = this.canvas;
        const ctx = this.ctx;
        if (!c || !ctx) return;

        const w = c.getBoundingClientRect().width || 280;
        const h = c.getBoundingClientRect().height || 180;
        const now = performance.now() / 1000;

        ctx.clearRect(0, 0, w, h);

        // 1. Draw Link Lines
        this.links.forEach((l) => {
            const n1 = this.nodes[l.from];
            const n2 = this.nodes[l.to];

            const x1 = n1.x * w;
            const y1 = n1.y * h;
            const x2 = n2.x * w;
            const y2 = n2.y * h;

            // Translucent glowing link
            ctx.beginPath();
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();

            // Active pulsating beam
            ctx.beginPath();
            ctx.lineWidth = 1;
            ctx.strokeStyle = l.color;
            ctx.setLineDash([4, 6]);
            ctx.lineDashOffset = -now * 18;
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
            ctx.setLineDash([]);
        });

        // 2. Draw Traveling Signal Packets
        this.packets.forEach((p) => {
            p.progress = (p.progress + 0.015 * p.speed) % 1.0;
            const link = this.links[p.linkIdx];
            const n1 = this.nodes[link.from];
            const n2 = this.nodes[link.to];

            const px = (n1.x + (n2.x - n1.x) * p.progress) * w;
            const py = (n1.y + (n2.y - n1.y) * p.progress) * h;

            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = link.color;
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.arc(px, py, 2.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
        });

        // 3. Draw Nodes
        this.nodes.forEach((n, idx) => {
            const nx = n.x * w;
            const ny = n.y * h;
            const pulse = Math.sin(now * 3 + idx) * 3;

            // Outer pulse ring
            ctx.strokeStyle = n.color;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(nx, ny, 14 + pulse, 0, Math.PI * 2);
            ctx.stroke();

            // Inner solid disc
            ctx.fillStyle = 'rgba(10, 16, 30, 0.9)';
            ctx.beginPath();
            ctx.arc(nx, ny, 10, 0, Math.PI * 2);
            ctx.fill();

            // Core dot
            ctx.fillStyle = n.color;
            ctx.shadowColor = n.color;
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(nx, ny, 4.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;

            // Label
            ctx.fillStyle = '#f8fafc';
            ctx.font = 'bold 9px "JetBrains Mono", monospace';
            ctx.textAlign = 'center';
            ctx.fillText(`ESP32 #${n.id}`, nx, ny - 16);

            ctx.fillStyle = 'rgba(148, 163, 184, 0.8)';
            ctx.font = '8px sans-serif';
            ctx.fillText(`${n.rssi} dBm`, nx, ny + 20);
        });
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
window.MeshTopologyEngine = MeshTopologyEngine;
