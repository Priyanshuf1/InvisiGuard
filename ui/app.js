/**
 * InvisiGuard — Unified Sensing Web Application Orchestrator
 * Aesthetics: RuView Observatory Precision + Warm Low-Poly Terracotta
 * Guidelines: /cinematic-lowpoly-terracotta + /cinematic-web-typography
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ============================================================================
// Terracotta Color Palette
// ============================================================================
const PALETTE = {
  bgDeep:     0x0c0a09,
  terraBase:  0xC4766B,
  terraDark:  0xA85F55,
  terraMid:   0xD4897E,
  terraLight: 0xE8A898,
  terraPale:  0xEFC0B5,
  terraSun:   0xF5C07A,
  wood:       0x4a2e2b,
  mattress:   0xe0d5ce,
  sheet:      0xC4766B,
  pillow:     0xf2ede8,
  metal:      0x38302e,
  charBase:   0xD4897E,
  charShirt:  0xC4766B,
  charPants:  0x6e4844,
  greenLive:  0x4EBE7D,
  amberDemo:  0xE5A24D,
  redAlert:   0xE05252,
};

// ============================================================================
// 3D Scene Controller
// ============================================================================
class RoomScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(this.width, this.height);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Scene & Fog
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(PALETTE.bgDeep);
    this.scene.fog = new THREE.FogExp2(PALETTE.bgDeep, 0.035);

    // Camera
    this.defaultCamPos = new THREE.Vector3(5.2, 4.2, 6.2);
    this.defaultLookAt = new THREE.Vector3(0, 0.8, 0);
    this.camera = new THREE.PerspectiveCamera(46, this.width / this.height, 0.1, 50);
    this.camera.position.copy(this.defaultCamPos);

    // Controls
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.minDistance = 2.5;
    this.controls.maxDistance = 16.0;
    this.controls.maxPolarAngle = Math.PI * 0.49; // Keep camera above floor
    this.controls.target.copy(this.defaultLookAt);
    this.controls.update();

    // Lighting (Warm sunset setup, no HDRI)
    this._initLighting();

    // Procedural Low-Poly Room & Furniture
    this._buildRoom();
    this._buildFurniture();

    // ESP32 Transceiver node on wall
    this._buildTransceiverNode();

    // Stylized Avatar
    this._buildAvatar();

    // Floating Dust Sparkles
    this._buildSparkles();

    // Wavefront Rings for RF Radiance
    this.waveRings = [];
    this._initRfWaveRings();

    // Animation state
    this.clock = new THREE.Clock();
    this.activeNodes = 0;
    this.presence = false;
    this.pose = 'standing'; // 'standing', 'sitting', 'fallen'
    this.motionIntensity = 0.0;
  }

  _initLighting() {
    // 1. Warm sunset directional sunlight
    const sunLight = new THREE.DirectionalLight(PALETTE.terraSun, 1.4);
    sunLight.position.set(6, 8, 4);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.camera.near = 1;
    sunLight.shadow.camera.far = 20;
    sunLight.shadow.camera.left = -4;
    sunLight.shadow.camera.right = 4;
    sunLight.shadow.camera.top = 4;
    sunLight.shadow.camera.bottom = -4;
    sunLight.shadow.bias = -0.001;
    this.scene.add(sunLight);

    // 2. Soft rose fill light from opposite corner
    const fillLight = new THREE.DirectionalLight(PALETTE.terraMid, 0.5);
    fillLight.position.set(-6, 4, -4);
    this.scene.add(fillLight);

    // 3. Ambient light to lift dark shadows cleanly
    const ambLight = new THREE.AmbientLight(0x2d1d1a, 0.85);
    this.scene.add(ambLight);
  }

  _buildRoom() {
    // Floor
    const floorGeo = new THREE.PlaneGeometry(8, 7);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x161210,
      roughness: 0.88,
      metalness: 0.1,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Terracotta Floor Grid
    const grid = new THREE.GridHelper(8, 16, PALETTE.terraDark, 0x221a18);
    grid.position.y = 0.002;
    this.scene.add(grid);

    // Wall outlines (Low-poly boundary posts & subtle perimeter)
    const lineMat = new THREE.LineBasicMaterial({
      color: PALETTE.terraDark,
      transparent: true,
      opacity: 0.45,
    });

    const pts = [
      new THREE.Vector3(-3.5, 0, -3.0),
      new THREE.Vector3(3.5, 0, -3.0),
      new THREE.Vector3(3.5, 0, 3.0),
      new THREE.Vector3(-3.5, 0, 3.0),
      new THREE.Vector3(-3.5, 0, -3.0),
    ];
    const borderGeo = new THREE.BufferGeometry().setFromPoints(pts);
    const borderLine = new THREE.Line(borderGeo, lineMat);
    this.scene.add(borderLine);

    // Back wall panel (subtle warm silhouette)
    const wallGeo = new THREE.PlaneGeometry(7.0, 3.0);
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x120f0e,
      roughness: 0.95,
      metalness: 0.05,
    });
    const backWall = new THREE.Mesh(wallGeo, wallMat);
    backWall.position.set(0, 1.5, -3.0);
    backWall.receiveShadow = true;
    this.scene.add(backWall);

    // Left wall panel
    const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(6.0, 3.0), wallMat);
    leftWall.position.set(-3.5, 1.5, 0);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.receiveShadow = true;
    this.scene.add(leftWall);
  }

  _buildFurniture() {
    // 1. Hostel Bed (low-poly wooden frame, mattress, pillow, blanket)
    const bedGroup = new THREE.Group();
    bedGroup.position.set(-2.0, 0, -1.6);

    // Bed frame
    const frameGeo = new THREE.BoxGeometry(1.6, 0.35, 2.2);
    const woodMat = new THREE.MeshStandardMaterial({ color: PALETTE.wood, roughness: 0.8 });
    const frame = new THREE.Mesh(frameGeo, woodMat);
    frame.position.y = 0.175;
    frame.castShadow = true;
    frame.receiveShadow = true;
    bedGroup.add(frame);

    // Mattress
    const matGeo = new THREE.BoxGeometry(1.5, 0.22, 2.1);
    const matMat = new THREE.MeshStandardMaterial({ color: PALETTE.mattress, roughness: 0.7 });
    const mattress = new THREE.Mesh(matGeo, matMat);
    mattress.position.y = 0.40;
    mattress.castShadow = true;
    mattress.receiveShadow = true;
    bedGroup.add(mattress);

    // Blanket (warm terracotta)
    const blkGeo = new THREE.BoxGeometry(1.52, 0.1, 1.4);
    const blkMat = new THREE.MeshStandardMaterial({ color: PALETTE.sheet, roughness: 0.85 });
    const blanket = new THREE.Mesh(blkGeo, blkMat);
    blanket.position.set(0, 0.46, 0.35);
    blanket.castShadow = true;
    bedGroup.add(blanket);

    // Pillow
    const pilGeo = new THREE.BoxGeometry(0.8, 0.1, 0.45);
    const pilMat = new THREE.MeshStandardMaterial({ color: PALETTE.pillow, roughness: 0.6 });
    const pillow = new THREE.Mesh(pilGeo, pilMat);
    pillow.position.set(0, 0.48, -0.75);
    pillow.castShadow = true;
    bedGroup.add(pillow);

    this.scene.add(bedGroup);

    // 2. Study Desk (low-poly desk, laptop, study chair)
    const deskGroup = new THREE.Group();
    deskGroup.position.set(1.8, 0, -2.1);

    // Desktop
    const deskTopGeo = new THREE.BoxGeometry(1.8, 0.08, 1.0);
    const deskMat = new THREE.MeshStandardMaterial({ color: PALETTE.wood, roughness: 0.75 });
    const deskTop = new THREE.Mesh(deskTopGeo, deskMat);
    deskTop.position.y = 0.76;
    deskTop.castShadow = true;
    deskTop.receiveShadow = true;
    deskGroup.add(deskTop);

    // Desk Legs
    const legGeo = new THREE.BoxGeometry(0.08, 0.76, 0.08);
    const legMat = new THREE.MeshStandardMaterial({ color: PALETTE.metal, roughness: 0.6 });
    const legOffsets = [
      [-0.8, 0.38, -0.4],
      [0.8, 0.38, -0.4],
      [-0.8, 0.38, 0.4],
      [0.8, 0.38, 0.4],
    ];
    legOffsets.forEach(([lx, ly, lz]) => {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(lx, ly, lz);
      leg.castShadow = true;
      deskGroup.add(leg);
    });

    // Laptop on desk
    const lapBase = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.02, 0.28), legMat);
    lapBase.position.set(0, 0.81, 0.05);
    deskGroup.add(lapBase);

    const lapScreen = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.25, 0.02),
      new THREE.MeshStandardMaterial({ color: PALETTE.terraLight, roughness: 0.4 })
    );
    lapScreen.position.set(0, 0.94, -0.08);
    lapScreen.rotation.x = 0.15;
    deskGroup.add(lapScreen);

    // Chair
    const chairGroup = new THREE.Group();
    chairGroup.position.set(1.8, 0, -1.2);

    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.5), deskMat);
    seat.position.y = 0.45;
    seat.castShadow = true;
    chairGroup.add(seat);

    const backrest = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 0.06), deskMat);
    backrest.position.set(0, 0.72, 0.22);
    backrest.castShadow = true;
    chairGroup.add(backrest);

    const chairLegGeo = new THREE.BoxGeometry(0.05, 0.45, 0.05);
    [[-0.2, 0.225, -0.2], [0.2, 0.225, -0.2], [-0.2, 0.225, 0.2], [0.2, 0.225, 0.2]].forEach(([cx, cy, cz]) => {
      const cl = new THREE.Mesh(chairLegGeo, legMat);
      cl.position.set(cx, cy, cz);
      cl.castShadow = true;
      chairGroup.add(cl);
    });

    this.scene.add(deskGroup);
    this.scene.add(chairGroup);
  }

  _buildTransceiverNode() {
    this.nodeGroup = new THREE.Group();
    this.nodeGroup.position.set(-3.4, 1.8, 0.0);

    // Mounting plate & box
    const boxGeo = new THREE.BoxGeometry(0.12, 0.22, 0.16);
    this.nodeMat = new THREE.MeshStandardMaterial({
      color: 0x221a18,
      roughness: 0.5,
      metalness: 0.3,
    });
    const box = new THREE.Mesh(boxGeo, this.nodeMat);
    this.nodeGroup.add(box);

    // Small Antenna
    const antGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.25, 6);
    const ant = new THREE.Mesh(antGeo, new THREE.MeshStandardMaterial({ color: PALETTE.metal }));
    ant.position.set(0, 0.2, 0);
    this.nodeGroup.add(ant);

    // LED Status Indicator
    const ledGeo = new THREE.SphereGeometry(0.02, 8, 8);
    this.ledMat = new THREE.MeshBasicMaterial({ color: 0x444444 });
    this.ledMesh = new THREE.Mesh(ledGeo, this.ledMat);
    this.ledMesh.position.set(0.065, 0.04, 0);
    this.nodeGroup.add(this.ledMesh);

    this.scene.add(this.nodeGroup);
  }

  _initRfWaveRings() {
    this.waveGroup = new THREE.Group();
    this.waveGroup.position.copy(this.nodeGroup.position);
    this.scene.add(this.waveGroup);

    for (let i = 0; i < 4; i++) {
      const ringGeo = new THREE.RingGeometry(0.2, 0.24, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: PALETTE.terraMid,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.y = Math.PI / 2;
      this.waveRings.push({ mesh: ring, progress: i / 4.0 });
      this.waveGroup.add(ring);
    }
  }

  _buildAvatar() {
    this.avatarGroup = new THREE.Group();
    this.avatarGroup.position.set(0.2, 0, 0.5);

    const skinMat = new THREE.MeshStandardMaterial({ color: PALETTE.charBase, roughness: 0.7 });
    const shirtMat = new THREE.MeshStandardMaterial({ color: PALETTE.charShirt, roughness: 0.8 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: PALETTE.charPants, roughness: 0.85 });

    // Torso
    this.torso = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.55, 0.26), shirtMat);
    this.torso.position.y = 1.15;
    this.torso.castShadow = true;
    this.avatarGroup.add(this.torso);

    // Head
    this.head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), skinMat);
    this.head.position.y = 1.62;
    this.head.castShadow = true;
    this.avatarGroup.add(this.head);

    // Left Arm
    this.lArm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.48, 0.12), shirtMat);
    this.lArm.position.set(-0.3, 1.15, 0);
    this.lArm.castShadow = true;
    this.avatarGroup.add(this.lArm);

    // Right Arm
    this.rArm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.48, 0.12), shirtMat);
    this.rArm.position.set(0.3, 1.15, 0);
    this.rArm.castShadow = true;
    this.avatarGroup.add(this.rArm);

    // Left Leg
    this.lLeg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.65, 0.16), pantsMat);
    this.lLeg.position.set(-0.14, 0.55, 0);
    this.lLeg.castShadow = true;
    this.avatarGroup.add(this.lLeg);

    // Right Leg
    this.rLeg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.65, 0.16), pantsMat);
    this.rLeg.position.set(0.14, 0.55, 0);
    this.rLeg.castShadow = true;
    this.avatarGroup.add(this.rLeg);

    this.scene.add(this.avatarGroup);
    this.avatarGroup.visible = false; // Hidden until presence confirmed
  }

  _buildSparkles() {
    const count = 120;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      positions[i * 3 + 0] = (Math.random() - 0.5) * 6.5;
      positions[i * 3 + 1] = 0.2 + Math.random() * 2.6;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 5.5;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
      color: PALETTE.terraSun,
      size: 0.04,
      transparent: true,
      opacity: 0.6,
    });

    this.sparkles = new THREE.Points(geo, mat);
    this.scene.add(this.sparkles);
  }

  resetCamera() {
    this.camera.position.copy(this.defaultCamPos);
    this.controls.target.copy(this.defaultLookAt);
    this.controls.update();
  }

  resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.width, this.height);
  }

  update(telemetry) {
    const dt = this.clock.getDelta();
    const t = this.clock.getElapsedTime();

    this.activeNodes = telemetry.nodes || 0;
    this.presence = telemetry.presence || false;
    this.pose = telemetry.pose || 'standing';
    this.motionIntensity = telemetry.motionPower || 0.05;

    // 1. Update Transceiver Node Status & Radiance
    if (this.activeNodes > 0) {
      this.ledMat.color.setHex(PALETTE.greenLive);
      this.waveGroup.visible = true;

      // Expand wave rings
      this.waveRings.forEach(w => {
        w.progress = (w.progress + dt * 0.45) % 1.0;
        const scale = 0.5 + w.progress * 5.5;
        w.mesh.scale.set(scale, scale, scale);
        w.mesh.material.opacity = (1.0 - w.progress) * 0.45;
      });
    } else {
      this.ledMat.color.setHex(0x3a302e);
      this.waveGroup.visible = false;
    }

    // 2. Update Avatar Pose & Visibility
    if (this.presence) {
      this.avatarGroup.visible = true;

      if (this.pose === 'fallen') {
        // Fallen on floor
        this.avatarGroup.position.set(0.0, 0.15, 0.8);
        this.avatarGroup.rotation.set(Math.PI / 2, 0, 0.4);
        this.torso.position.set(0, 0.15, 0);
        this.head.position.set(0, 0.15, -0.45);
        this.lArm.rotation.z = 0.8;
        this.rArm.rotation.z = -0.8;
      } else if (this.pose === 'sitting') {
        // Seated on study chair
        this.avatarGroup.position.set(1.8, 0, -1.2);
        this.avatarGroup.rotation.set(0, -Math.PI / 2, 0);
        this.torso.position.set(0, 0.75, 0);
        this.head.position.set(0, 1.15, 0);
        this.lLeg.rotation.x = -Math.PI / 2;
        this.rLeg.rotation.x = -Math.PI / 2;
        this.lArm.rotation.x = -0.5;
        this.rArm.rotation.x = -0.5;
      } else {
        // Standing / Natural Micro-sway
        const sway = Math.sin(t * 1.8) * 0.03 * (1 + this.motionIntensity * 4);
        this.avatarGroup.position.set(0.2 + sway, 0, 0.5);
        this.avatarGroup.rotation.set(0, Math.sin(t * 0.8) * 0.2, 0);

        this.torso.position.set(0, 1.15 + Math.abs(sway) * 0.3, 0);
        this.head.position.set(0, 1.62 + Math.abs(sway) * 0.3, 0);
        this.lLeg.rotation.set(0, 0, 0);
        this.rLeg.rotation.set(0, 0, 0);
        this.lArm.rotation.set(Math.sin(t * 2.0) * 0.2, 0, 0);
        this.rArm.rotation.set(-Math.sin(t * 2.0) * 0.2, 0, 0);
      }
    } else {
      this.avatarGroup.visible = false;
    }

    // 3. Gentle Sparkles Drift
    if (this.sparkles) {
      const pos = this.sparkles.geometry.attributes.position.array;
      for (let i = 1; i < pos.length; i += 3) {
        pos[i] -= dt * 0.08;
        if (pos[i] < 0.2) pos[i] = 2.8;
      }
      this.sparkles.geometry.attributes.position.needsUpdate = true;
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}

// ============================================================================
// Real-Time Signal Visualizers (Sparkline & ECG)
// ============================================================================
class SignalVisualizers {
  constructor() {
    this.rssiCanvas = document.getElementById('rssi-sparkline');
    this.ecgCanvas = document.getElementById('ecg-canvas');

    this.rssiCtx = this.rssiCanvas ? this.rssiCanvas.getContext('2d') : null;
    this.ecgCtx = this.ecgCanvas ? this.ecgCanvas.getContext('2d') : null;

    this.rssiHistory = new Array(50).fill(-50);
    this.ecgPhase = 0;
  }

  pushRssi(val) {
    if (typeof val === 'number' && !isNaN(val)) {
      this.rssiHistory.push(val);
      if (this.rssiHistory.length > 50) this.rssiHistory.shift();
    }
  }

  draw(presence, hrBpm) {
    this._drawSparkline(presence);
    this._drawEcg(presence, hrBpm);
  }

  _drawSparkline(hasPresence) {
    if (!this.rssiCtx) return;
    const ctx = this.rssiCtx;
    const w = this.rssiCanvas.width;
    const h = this.rssiCanvas.height;

    ctx.clearRect(0, 0, w, h);

    // Background grid
    ctx.strokeStyle = 'rgba(196, 118, 107, 0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();

    if (this.rssiHistory.length < 2) return;

    // Normalization bounds (-90 dBm to -30 dBm)
    const minVal = -85;
    const maxVal = -35;
    const range = maxVal - minVal;

    const step = w / (this.rssiHistory.length - 1);

    ctx.strokeStyle = hasPresence ? '#D4897E' : '#6E6864';
    ctx.lineWidth = 1.8;
    ctx.beginPath();

    for (let i = 0; i < this.rssiHistory.length; i++) {
      const val = this.rssiHistory[i];
      const norm = Math.max(0, Math.min(1, (val - minVal) / range));
      const y = h - norm * h;
      const x = i * step;

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  _drawEcg(hasPresence, hrBpm) {
    if (!this.ecgCtx) return;
    const ctx = this.ecgCtx;
    const w = this.ecgCanvas.width;
    const h = this.ecgCanvas.height;

    ctx.clearRect(0, 0, w, h);

    if (!hasPresence || !hrBpm) {
      // Flatline trace when no presence
      ctx.strokeStyle = '#4a3a38';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();
      return;
    }

    // Cardiac P-Q-R-S-T synthesis
    const freq = (hrBpm / 60) * 0.05;
    this.ecgPhase += freq;

    ctx.strokeStyle = '#E8A898';
    ctx.lineWidth = 1.8;
    ctx.beginPath();

    for (let x = 0; x < w; x++) {
      const samplePhase = (this.ecgPhase + (x / w) * 3) % 1.0;
      let yOffset = 0;

      // P wave
      if (samplePhase > 0.15 && samplePhase < 0.25) {
        yOffset = Math.sin((samplePhase - 0.15) * 10 * Math.PI) * 0.15;
      }
      // Q-R-S spike
      else if (samplePhase >= 0.32 && samplePhase < 0.35) {
        yOffset = -0.15; // Q dip
      } else if (samplePhase >= 0.35 && samplePhase < 0.38) {
        yOffset = 0.85; // R peak
      } else if (samplePhase >= 0.38 && samplePhase < 0.42) {
        yOffset = -0.3; // S dip
      }
      // T wave
      else if (samplePhase > 0.55 && samplePhase < 0.70) {
        yOffset = Math.sin((samplePhase - 0.55) * 6.66 * Math.PI) * 0.25;
      }

      const y = h / 2 - yOffset * (h * 0.42);
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

// ============================================================================
// Application Orchestrator
// ============================================================================
class InvisiGuardApp {
  constructor() {
    this.mode = 'live'; // 'live' or 'demo'
    this.overlayDismissed = false;

    // DOM Elements
    this.canvas = document.getElementById('scene-canvas');
    this.modeSelect = document.getElementById('mode-select');
    this.connDot = document.getElementById('conn-dot');
    this.connLabel = document.getElementById('conn-label');
    this.nodeNum = document.getElementById('node-num');
    this.pktNum = document.getElementById('pkt-num');
    this.btnResetCam = document.getElementById('btn-reset-cam');

    this.hrVal = document.getElementById('hr-value');
    this.hrBar = document.getElementById('hr-bar');
    this.brVal = document.getElementById('br-value');
    this.brBar = document.getElementById('br-bar');
    this.confVal = document.getElementById('conf-value');
    this.confBar = document.getElementById('conf-bar');

    this.rssiVal = document.getElementById('rssi-value');
    this.varVal = document.getElementById('var-value');
    this.motionVal = document.getElementById('motion-value');
    this.personsVal = document.getElementById('persons-value');
    this.presenceIndicator = document.getElementById('presence-indicator');
    this.presenceLabel = document.getElementById('presence-label');
    this.fallAlert = document.getElementById('fall-alert');

    this.noHwOverlay = document.getElementById('no-hw-overlay');
    this.btnSwitchDemo = document.getElementById('btn-switch-demo');
    this.btnDismissOverlay = document.getElementById('btn-dismiss-overlay');

    // Sub-modules
    this.scene = new RoomScene(this.canvas);
    this.viz = new SignalVisualizers();

    // Telemetry State
    this.state = {
      nodes: 0,
      packets: 0,
      sourceState: 'disconnected',
      presence: false,
      pose: 'standing',
      hrBpm: 0,
      brRpm: 0,
      confidence: 0,
      rssi: -50,
      variance: 0,
      motionPower: 0,
      fallDetected: false,
    };

    // WebSocket Handle
    this.ws = null;
    this.wsConnecting = false;

    this._bindEvents();
    this._startHealthProbe();
    this._connectWebSocket();
    this._startRenderLoop();
  }

  _bindEvents() {
    window.addEventListener('resize', () => this.scene.resize());

    if (this.modeSelect) {
      this.modeSelect.addEventListener('change', (e) => {
        this.mode = e.target.value;
        if (this.mode === 'demo') {
          this.noHwOverlay.style.display = 'none';
        }
      });
    }

    if (this.btnResetCam) {
      this.btnResetCam.addEventListener('click', () => this.scene.resetCamera());
    }

    if (this.btnSwitchDemo) {
      this.btnSwitchDemo.addEventListener('click', () => {
        this.mode = 'demo';
        if (this.modeSelect) this.modeSelect.value = 'demo';
        this.noHwOverlay.style.display = 'none';
      });
    }

    if (this.btnDismissOverlay) {
      this.btnDismissOverlay.addEventListener('click', () => {
        this.overlayDismissed = true;
        this.noHwOverlay.style.display = 'none';
      });
    }

    window.addEventListener('keydown', (e) => {
      if (e.key === 'r' || e.key === 'R') this.scene.resetCamera();
    });
  }

  // 1. Proactive Backend Health Probe
  async _startHealthProbe() {
    const probe = async () => {
      if (this.mode === 'demo') {
        this._applyDemoState();
        return;
      }

      try {
        const resp = await fetch('/health', { cache: 'no-store' });
        if (resp.ok) {
          const data = await resp.json();
          this.state.sourceState = data.source_state || 'disconnected';
          this.state.nodes = data.nodes || 0;
          this.state.packets = data.packets_received || 0;

          // If no hardware streaming and overlay not dismissed
          if (this.state.nodes === 0 && !this.overlayDismissed) {
            this.noHwOverlay.style.display = 'flex';
          } else {
            this.noHwOverlay.style.display = 'none';
          }
        }
      } catch (err) {
        this.state.sourceState = 'disconnected';
        this.state.nodes = 0;
      }

      this._updateHUD();
    };

    probe();
    setInterval(probe, 1500);
  }

  // 2. Telemetry WebSocket Stream
  _connectWebSocket() {
    if (this.wsConnecting || this.ws) return;
    this.wsConnecting = true;

    const host = window.location.hostname || 'localhost';
    const wsUrl = `ws://${host}:3000/ws/sensing`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.wsConnecting = false;
      };

      this.ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          if (msg.type === 'sensing_update') {
            if (msg.packets_received > 0) {
              if (this.mode === 'demo') {
                this.mode = 'live';
              }
              this.state.sourceState = 'live';
              this.state.nodes = 1;
              this.state.packets = msg.packets_received;
            }
            if (this.mode === 'live') {
              this._handleLiveTelemetry(msg);
            }
          }
        } catch (e) {}
      };

      this.ws.onclose = () => {
        this.ws = null;
        this.wsConnecting = false;
        setTimeout(() => this._connectWebSocket(), 2000);
      };

      this.ws.onerror = () => {
        if (this.ws) this.ws.close();
      };
    } catch (e) {
      this.wsConnecting = false;
      setTimeout(() => this._connectWebSocket(), 2000);
    }
  }

  _handleLiveTelemetry(msg) {
    const feat = msg.features || {};
    const cls = msg.classification || {};
    const vit = msg.vital_signs || {};

    if (typeof msg.packets_received === 'number') {
      this.state.packets = msg.packets_received;
    }
    if (this.state.packets > 0) {
      this.state.sourceState = 'live';
      this.state.nodes = 1;
    }

    // In live mode, only report presence if active hardware is sending packets
    const isLive = (this.state.sourceState === 'live' || this.state.packets > 0) && this.state.nodes > 0;

    this.state.presence = isLive ? (cls.presence || false) : false;
    this.state.fallDetected = isLive ? (cls.fall_detected || false) : false;
    this.state.rssi = typeof feat.mean_rssi === 'number' ? feat.mean_rssi : -50;
    this.state.variance = typeof feat.variance === 'number' ? feat.variance : 0;
    this.state.motionPower = typeof feat.motion_band_power === 'number' ? feat.motion_band_power : 0;

    if (this.state.presence) {
      this.state.hrBpm = vit.heart_rate_bpm || 72;
      this.state.brRpm = vit.breathing_rate_bpm || 16;
      this.state.confidence = Math.round((vit.confidence || 0.88) * 100);

      if (this.state.fallDetected) this.state.pose = 'fallen';
      else if (cls.motion_level === 'active') this.state.pose = 'standing';
      else this.state.pose = 'sitting';
    } else {
      this.state.hrBpm = 0;
      this.state.brRpm = 0;
      this.state.confidence = 0;
      this.state.pose = 'standing';
    }

    this.viz.pushRssi(this.state.rssi);
    this._updateHUD();
  }

  _applyDemoState() {
    const t = performance.now() * 0.001;
    this.state.nodes = 1;
    this.state.sourceState = 'demo';
    this.state.packets = Math.floor(t * 30);
    this.state.presence = true;
    this.state.fallDetected = false;

    this.state.hrBpm = Math.round(72 + Math.sin(t * 0.5) * 4);
    this.state.brRpm = Math.round(15 + Math.cos(t * 0.3) * 2);
    this.state.confidence = 94;

    this.state.rssi = Math.round(-46 + Math.sin(t * 0.8) * 4);
    this.state.variance = +(1.2 + Math.sin(t) * 0.5).toFixed(2);
    this.state.motionPower = +(0.08 + Math.cos(t * 1.2) * 0.04).toFixed(3);
    this.state.pose = 'standing';

    this.viz.pushRssi(this.state.rssi);
    this._updateHUD();
  }

  _updateHUD() {
    // 1. Connection Badge & Counters
    if (this.mode === 'demo') {
      this.connDot.className = 'dot dot--demo';
      this.connLabel.textContent = 'DEMO SIMULATION';
      this.nodeNum.textContent = '1';
      this.pktNum.textContent = String(this.state.packets);
    } else {
      if ((this.state.sourceState === 'live' || this.state.packets > 0) && this.state.nodes > 0) {
        this.connDot.className = 'dot dot--live';
        this.connLabel.textContent = `LIVE CSI · 1 NODE (${this.state.packets} PKTS)`;
        this.nodeNum.textContent = String(this.state.nodes);
        this.pktNum.textContent = String(this.state.packets);
      } else if (this.state.sourceState === 'idle') {
        this.connDot.className = 'dot dot--disconnected';
        this.connLabel.textContent = 'IDLE (NO DATA)';
        this.nodeNum.textContent = '0';
        this.pktNum.textContent = String(this.state.packets);
      } else {
        this.connDot.className = 'dot dot--disconnected';
        this.connLabel.textContent = 'DISCONNECTED';
        this.nodeNum.textContent = '0';
        this.pktNum.textContent = '0';
      }
    }

    // 2. Vitals Panel
    if (this.state.presence && this.state.hrBpm > 0) {
      this.hrVal.textContent = String(this.state.hrBpm);
      this.hrBar.style.width = `${Math.min(100, (this.state.hrBpm / 140) * 100)}%`;

      this.brVal.textContent = String(this.state.brRpm);
      this.brBar.style.width = `${Math.min(100, (this.state.brRpm / 35) * 100)}%`;

      this.confVal.textContent = String(this.state.confidence);
      this.confBar.style.width = `${this.state.confidence}%`;
    } else {
      this.hrVal.textContent = '--';
      this.hrBar.style.width = '0%';
      this.brVal.textContent = '--';
      this.brBar.style.width = '0%';
      this.confVal.textContent = '--';
      this.confBar.style.width = '0%';
    }

    // 3. Signal Panel
    if (this.mode === 'demo' || (this.state.sourceState === 'live' && this.state.nodes > 0)) {
      this.rssiVal.textContent = `${this.state.rssi} dBm`;
      this.varVal.textContent = String(this.state.variance);
      this.motionVal.textContent = String(this.state.motionPower);
      this.personsVal.textContent = this.state.presence ? '1' : '0';

      if (this.state.fallDetected) {
        this.presenceIndicator.className = 'presence-state';
        this.presenceIndicator.style.background = 'rgba(224, 82, 82, 0.2)';
        this.presenceIndicator.style.color = '#E05252';
        this.presenceLabel.textContent = 'FALL DETECTED';
        this.fallAlert.style.display = 'block';
      } else if (this.state.presence) {
        this.fallAlert.style.display = 'none';
        if (this.state.motionPower > 0.15) {
          this.presenceIndicator.className = 'presence-state presence--active';
          this.presenceLabel.textContent = 'ACTIVE MOTION';
        } else {
          this.presenceIndicator.className = 'presence-state presence--still';
          this.presenceLabel.textContent = 'PRESENT · RESTING';
        }
      } else {
        this.fallAlert.style.display = 'none';
        this.presenceIndicator.className = 'presence-state presence--absent';
        this.presenceLabel.textContent = 'ROOM EMPTY';
      }
    } else {
      this.rssiVal.textContent = '-- dBm';
      this.varVal.textContent = '--';
      this.motionVal.textContent = '--';
      this.personsVal.textContent = '0';
      this.fallAlert.style.display = 'none';
      this.presenceIndicator.className = 'presence-state presence--absent';
      this.presenceLabel.textContent = 'NO HARDWARE';
    }
  }

  // 3. Render Loop (60 FPS)
  _startRenderLoop() {
    const loop = () => {
      requestAnimationFrame(loop);

      // Render 3D scene
      this.scene.update({
        nodes: this.state.nodes,
        presence: this.state.presence,
        pose: this.state.pose,
        motionPower: this.state.motionPower,
      });

      // Render signal visualizers
      this.viz.draw(this.state.presence, this.state.hrBpm);
    };
    loop();
  }
}

// Start application when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  new InvisiGuardApp();
});
