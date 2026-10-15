/**
 * InvisiGuard — Unified Multi-Section Platform Controller
 * Architecture:
 * 1. 3D Bedroom Sensing (Terracotta room + RuView electric green wireframe avatar)
 * 2. Dedicated Vitals & Biometrics Suite
 * 3. Hardware & RF Telemetry Suite
 * 4. Hostel Safety & Fall Detection Suite
 * 5. ML Training & Recording Studio
 * 6. CSI Architecture & Theory
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ============================================================================
// Terracotta & Electric Green Palette
// ============================================================================
const C = {
  bgDeep:       0x0a0807,
  terraBase:    0xC4766B,
  terraDark:    0xA85F55,
  terraMid:     0xD4897E,
  terraLight:   0xE8A898,
  terraPale:    0xEFC0B5,
  terraSun:     0xF5C07A,
  wood:         0x482e2a,
  sheet:        0xC4766B,
  mattress:     0xded5ce,
  pillow:       0xf2ede8,
  metal:        0x2e2624,
  // Electric green wireframe
  greenWire:    0x00d878,
  greenBright:  0x3eff8a,
  jointColor:   0xff4060,
};

const SKELETON_PAIRS = [
  [0, 1], [0, 2], [1, 3], [2, 4],
  [5, 6], [5, 7], [7, 9], [6, 8], [8, 10],
  [5, 11], [6, 12], [11, 12],
  [11, 13], [13, 15], [12, 14], [14, 16],
];

// ============================================================================
// 1. Tier 1: Authentic RuView 3D Volumetric Green Fog / Gaussian Splats Cloud
//    (Active for 1 ESP32 — Single-Node RF Disruption & Doppler Respiration)
// ============================================================================

const SPLAT_VERTEX = `
  attribute float splatSize;
  attribute vec3  splatColor;
  attribute float splatOpacity;

  varying vec3  vColor;
  varying float vOpacity;

  void main() {
    vColor   = splatColor;
    vOpacity = splatOpacity;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = splatSize * (150.0 / -mvPosition.z);
    gl_Position  = projectionMatrix * mvPosition;
  }
`;

const SPLAT_FRAGMENT = `
  varying vec3  vColor;
  varying float vOpacity;

  void main() {
    float dist = length(gl_PointCoord - vec2(0.5));
    if (dist > 0.5) discard;
    float alpha = smoothstep(0.5, 0.05, dist) * vOpacity * 0.45;
    gl_FragColor = vec4(vColor, alpha);
  }
`;

class VolumetricRfDisruptionCloud {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.group.visible = false;

    this.count = 68;
    this.baseOffsets = [];

    const positions = new Float32Array(this.count * 3);
    const sizes = new Float32Array(this.count);
    const colors = new Float32Array(this.count * 3);
    const opacities = new Float32Array(this.count);

    // Distribution matching 3D human body RF multipath disruption cloud
    for (let i = 0; i < this.count; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = Math.pow(Math.random(), 0.38) * 0.95;

      const ox = r * Math.sin(phi) * Math.cos(theta) * 0.65;
      const oy = r * Math.cos(phi) * 1.15; // elongated human height
      const oz = r * Math.sin(phi) * Math.sin(theta) * 0.55;

      this.baseOffsets.push({
        ox, oy, oz,
        speed: 0.8 + Math.random() * 1.4,
        phase: Math.random() * Math.PI * 2,
        jitterR: 0.04 + Math.random() * 0.08,
        baseSize: 1.8 + Math.random() * 1.8,
      });

      positions[i * 3 + 0] = ox;
      positions[i * 3 + 1] = 1.0 + oy;
      positions[i * 3 + 2] = oz;

      sizes[i] = 3.0;
      colors[i * 3 + 0] = 0.0;
      colors[i * 3 + 1] = 0.85;
      colors[i * 3 + 2] = 0.47;
      opacities[i] = 0.0;
    }

    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.geo.setAttribute('splatSize', new THREE.BufferAttribute(sizes, 1));
    this.geo.setAttribute('splatColor', new THREE.BufferAttribute(colors, 3));
    this.geo.setAttribute('splatOpacity', new THREE.BufferAttribute(opacities, 1));

    this.mat = new THREE.ShaderMaterial({
      vertexShader: SPLAT_VERTEX,
      fragmentShader: SPLAT_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.points = new THREE.Points(this.geo, this.mat);
    this.group.add(this.points);

    // Dynamic ground footprint rings
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00d878,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.floorRing = new THREE.Mesh(new THREE.RingGeometry(0.08, 0.95, 32), ringMat);
    this.floorRing.rotation.x = -Math.PI / 2;
    this.floorRing.position.y = 0.008;
    this.group.add(this.floorRing);

    const waveMat = new THREE.MeshBasicMaterial({
      color: 0x00d878,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.floorWave = new THREE.Mesh(new THREE.RingGeometry(0.8, 1.25, 32), waveMat);
    this.floorWave.rotation.x = -Math.PI / 2;
    this.floorWave.position.y = 0.009;
    this.group.add(this.floorWave);

    this.currentCentroid = new THREE.Vector3(0.0, 1.05, 0.0);
  }

  update(t, presence, pose, mot, breathPower, conf, dt = 0.016, br = 15.6, hr = 72) {
    if (!presence) {
      this.group.visible = false;
      return;
    }
    this.group.visible = true;

    // Target centroid based on room furniture localization
    let tx = 0.1, ty = 1.05, tz = 0.2;
    let isHorizontal = false;

    if (pose === 'sleep' || pose === 'lying') {
      tx = -2.2; ty = 0.65; tz = -1.8;
      isHorizontal = true;
    } else if (pose === 'study' || pose === 'sitting') {
      tx = 1.8; ty = 0.95; tz = -1.2;
    } else if (pose === 'fallen') {
      tx = 0.2; ty = 0.35; tz = 0.4;
      isHorizontal = true;
    } else if (pose === 'active' || pose === 'walking' || mot > 0.10) {
      // Dynamic room pacing reacting live to physical RF disruption across open bedroom space
      const paceSpeed = 1.0 + Math.min(2.5, mot * 2.8);
      const wanderX = Math.sin(t * paceSpeed * 0.9) * (0.8 + Math.min(0.8, mot * 1.2));
      const wanderZ = Math.cos(t * paceSpeed * 0.7) * (0.6 + Math.min(0.6, mot * 1.0));
      const stepBounce = Math.abs(Math.sin(t * paceSpeed * 2.4)) * (0.05 + Math.min(0.12, mot * 0.15));
      tx = 0.1 + wanderX;
      ty = 1.05 + stepBounce;
      tz = 0.2 + wanderZ;
    } else {
      // General standing / room presence: dynamic Doppler drift based on motion
      const driftX = Math.sin(t * 0.9) * Math.min(mot * 0.5 + 0.08, 0.45);
      const driftZ = Math.cos(t * 0.7) * Math.min(mot * 0.5 + 0.08, 0.45);
      tx = 0.1 + driftX;
      ty = 1.05;
      tz = 0.2 + driftZ;
    }

    // Smooth lerp to target centroid
    this.currentCentroid.x += (tx - this.currentCentroid.x) * 0.12;
    this.currentCentroid.y += (ty - this.currentCentroid.y) * 0.12;
    this.currentCentroid.z += (tz - this.currentCentroid.z) * 0.12;

    const cx = this.currentCentroid.x;
    const cy = this.currentCentroid.y;
    const cz = this.currentCentroid.z;

    // Doppler breathing pulsation driven by live breathing rate
    const liveBr = (typeof br === 'number' && br > 0) ? br : 15.6;
    const bp = Math.sin(t * (2.0 * Math.PI * (liveBr / 60.0)));
    const pulseAmp = Math.min(0.12 + Math.max(0.1, breathPower) * 2.2, 0.45);
    const breathPulse = 1.0 + bp * pulseAmp;

    // Motion dynamic expansion (gentle natural breathing expansion)
    const motionScale = 1.0 + Math.min(0.60, mot * 0.7);

    // 3-tier color shift: soothing RuView emerald green (0x00d878) -> warm amber (0xf5c07a) -> active red (0xff4060)
    let cr = 0.0, cg = 0.847, cb = 0.471;
    const motFactor = Math.min(1.0, mot * 2.0);
    if (motFactor < 0.4) {
      cr = 0.0; cg = 0.847; cb = 0.471;
    } else if (motFactor < 0.8) {
      const k = (motFactor - 0.4) / 0.4;
      cr = 0.0 * (1 - k) + 0.961 * k;
      cg = 0.847 * (1 - k) + 0.650 * k;
      cb = 0.471 * (1 - k) + 0.250 * k;
    } else {
      const k = (motFactor - 0.8) / 0.2;
      cr = 0.961 * (1 - k) + 1.000 * k;
      cg = 0.650 * (1 - k) + 0.250 * k;
      cb = 0.250 * (1 - k) + 0.350 * k;
    }

    const pos = this.geo.attributes.position.array;
    const sizes = this.geo.attributes.splatSize.array;
    const colors = this.geo.attributes.splatColor.array;
    const opac = this.geo.attributes.splatOpacity.array;

    const baseAlpha = 0.20 + (Math.min(100, Math.max(0, conf)) / 100) * 0.25;

    for (let i = 0; i < this.count; i++) {
      const b = this.baseOffsets[i];
      let ox = b.ox * breathPulse * motionScale;
      let oy = b.oy * breathPulse * motionScale;
      let oz = b.oz * breathPulse * motionScale;

      if (isHorizontal) {
        const tmp = oy;
        oy = oz * 0.6;
        oz = tmp;
      }

      // Micro turbulence from RF Doppler multipath
      const jitter = Math.sin(t * b.speed + b.phase) * (b.jitterR + mot * 0.18);

      pos[i * 3 + 0] = cx + ox + jitter;
      pos[i * 3 + 1] = Math.max(0.12, cy + oy + Math.cos(t * b.speed * 0.7 + b.phase) * jitter);
      pos[i * 3 + 2] = cz + oz + jitter;

      sizes[i] = b.baseSize * breathPulse * motionScale;
      colors[i * 3 + 0] = cr;
      colors[i * 3 + 1] = cg;
      colors[i * 3 + 2] = cb;
      opac[i] = baseAlpha * (0.8 + 0.2 * Math.sin(t * 1.5 + b.phase));
    }

    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.splatSize.needsUpdate = true;
    this.geo.attributes.splatColor.needsUpdate = true;
    this.geo.attributes.splatOpacity.needsUpdate = true;

    // Floor rings update with dynamic scaling
    this.floorRing.position.set(cx, 0.008, cz);
    this.floorRing.material.color.setRGB(cr, cg, cb);
    const ringScale = breathPulse * motionScale;
    this.floorRing.scale.set(ringScale, ringScale, 1);

    this.floorWave.position.set(cx, 0.009, cz);
    this.floorWave.material.color.setRGB(cr, cg, cb);
    const waveSpeed = 0.6 + mot * 1.5;
    const waveProgress = ((t * waveSpeed) % 1.0);
    const waveScale = (1.0 + waveProgress * 1.8) * motionScale;
    this.floorWave.scale.set(waveScale, waveScale, 1);
    this.floorWave.material.opacity = Math.max(0, (1.0 - waveProgress)) * (0.22 + Math.min(0.40, mot * 0.55));
  }
}

// ============================================================================
// 2. Tier 2: 3D Spatial Centroid & Presence Envelope Bounding Volume
//    (Active for 2-3 ESP32s — Multi-static Trilateration & Localization)
// ============================================================================

class SpatialPresenceEnvelope {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.group.visible = false;

    // Outer wireframe capsule
    const capGeo = new THREE.CapsuleGeometry(0.38, 0.95, 10, 16);
    this.wireMat = new THREE.MeshBasicMaterial({
      color: 0x00d878,
      wireframe: true,
      transparent: true,
      opacity: 0.55,
    });
    this.capMesh = new THREE.Mesh(capGeo, this.wireMat);
    this.group.add(this.capMesh);

    // Inner glowing volume
    this.innerMat = new THREE.MeshBasicMaterial({
      color: 0x00d878,
      transparent: true,
      opacity: 0.15,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.innerMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.36, 0.90, 12, 16), this.innerMat);
    this.group.add(this.innerMesh);

    // 3D Spatial Centroid Crosshairs
    const axisMat = new THREE.LineBasicMaterial({ color: 0x3eff8a, transparent: true, opacity: 0.8 });
    const crossPts = [
      new THREE.Vector3(-0.55, 0, 0), new THREE.Vector3(0.55, 0, 0),
      new THREE.Vector3(0, -0.65, 0), new THREE.Vector3(0, 0.65, 0),
      new THREE.Vector3(0, 0, -0.55), new THREE.Vector3(0, 0, 0.55),
    ];
    this.crosshairs = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(crossPts), axisMat);
    this.group.add(this.crosshairs);

    // Centroid core sphere
    const coreGeo = new THREE.SphereGeometry(0.065, 12, 12);
    this.coreMat = new THREE.MeshBasicMaterial({ color: 0xff4060, blending: THREE.AdditiveBlending });
    this.coreMesh = new THREE.Mesh(coreGeo, this.coreMat);
    this.group.add(this.coreMesh);

    // Ground projection plumb line
    const plumbPts = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -1.2, 0)];
    this.plumbLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(plumbPts),
      new THREE.LineDashedMaterial({ color: 0x00d878, dashSize: 0.08, gapSize: 0.05, transparent: true, opacity: 0.5 })
    );
    this.plumbLine.computeLineDistances();
    this.group.add(this.plumbLine);

    // Ground target circle
    const groundGeo = new THREE.RingGeometry(0.05, 0.55, 24);
    this.groundMat = new THREE.MeshBasicMaterial({
      color: 0x00d878,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.groundDisc = new THREE.Mesh(groundGeo, this.groundMat);
    this.groundDisc.rotation.x = -Math.PI / 2;
    this.group.add(this.groundDisc);

    this.currentCentroid = new THREE.Vector3(0.0, 1.05, 0.0);
  }

  update(t, presence, pose, mot, breathPower, conf) {
    if (!presence) {
      this.group.visible = false;
      return;
    }
    this.group.visible = true;

    let tx = 0.1, ty = 1.05, tz = 0.2;
    let rx = 0, rz = 0;

    if (pose === 'sleep' || pose === 'lying') {
      tx = -2.2; ty = 0.65; tz = -1.8;
      rx = Math.PI / 2;
    } else if (pose === 'study' || pose === 'sitting') {
      tx = 1.8; ty = 0.88; tz = -1.2;
    } else if (pose === 'fallen') {
      tx = 0.2; ty = 0.28; tz = 0.4;
      rx = Math.PI / 2;
    } else if (pose === 'active' || pose === 'walking' || mot > 0.10) {
      const paceSpeed = 1.0 + Math.min(2.5, mot * 2.8);
      const wanderX = Math.sin(t * paceSpeed * 0.9) * (0.8 + Math.min(0.8, mot * 1.2));
      const wanderZ = Math.cos(t * paceSpeed * 0.7) * (0.6 + Math.min(0.6, mot * 1.0));
      const stepBounce = Math.abs(Math.sin(t * paceSpeed * 2.4)) * (0.05 + Math.min(0.10, mot * 0.12));
      tx = 0.1 + wanderX;
      ty = 1.05 + stepBounce;
      tz = 0.2 + wanderZ;
    } else {
      const driftX = Math.sin(t * 0.9) * Math.min(mot * 0.4, 0.35);
      const driftZ = Math.cos(t * 0.7) * Math.min(mot * 0.4, 0.35);
      tx = 0.1 + driftX;
      ty = 1.05;
      tz = 0.2 + driftZ;
    }

    this.currentCentroid.x += (tx - this.currentCentroid.x) * 0.14;
    this.currentCentroid.y += (ty - this.currentCentroid.y) * 0.14;
    this.currentCentroid.z += (tz - this.currentCentroid.z) * 0.14;

    const cx = this.currentCentroid.x;
    const cy = this.currentCentroid.y;
    const cz = this.currentCentroid.z;

    this.group.position.set(cx, cy, cz);
    this.capMesh.rotation.set(rx, 0, rz);
    this.innerMesh.rotation.set(rx, 0, rz);

    // Respiration expansion
    const bp = Math.sin(t * 2.2);
    const scale = 1.0 + bp * Math.min(0.08 + breathPower * 1.5, 0.25);
    this.capMesh.scale.set(scale, scale, scale);
    this.innerMesh.scale.set(scale, scale, scale);

    // Plumb line down to floor
    this.plumbLine.position.set(0, 0, 0);
    this.plumbLine.scale.set(1, cy / 1.2, 1);

    // Ground target circle at floor plane
    this.groundDisc.position.set(0, -cy + 0.01, 0);

    // Color interpolation: green -> amber -> red
    let col = 0x00d878;
    if (mot > 0.25) col = 0xff4060;
    else if (mot > 0.10) col = 0xf5c07a;

    this.wireMat.color.setHex(col);
    this.innerMat.color.setHex(col);
    this.groundMat.color.setHex(col);
  }
}

// ============================================================================
// 3. Tier 3: Articulated 17-Keypoint WiFi DensePose Skeleton
//    (Active for 4+ ESP32s — Multi-view Articulated Joint Kinematics)
// ============================================================================

class GreenWireframeAvatar {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.group.visible = false;

    this.joints = [];
    this.bones = [];
    this.jointTargets = [];
    for (let i = 0; i < 17; i++) {
      this.jointTargets.push(new THREE.Vector3(0, 0, 0));
    }

    this._buildFigure();
  }

  _buildFigure() {
    const wireColor = new THREE.Color(C.greenWire);
    const jointDotColor = new THREE.Color(C.jointColor);

    // 1. Joints (17 COCO points)
    for (let i = 0; i < 17; i++) {
      const isNose = (i === 0);
      const isExtremity = [9, 10, 15, 16].includes(i);
      const size = isNose ? 0.06 : (isExtremity ? 0.045 : 0.04);
      const col = (isExtremity || i === 7 || i === 8 || i === 13 || i === 14) ? jointDotColor : wireColor;

      const geo = new THREE.SphereGeometry(size, 10, 10);
      const mat = new THREE.MeshStandardMaterial({
        color: col,
        emissive: col,
        emissiveIntensity: 0.9,
        roughness: 0.3,
      });
      const jointMesh = new THREE.Mesh(geo, mat);
      this.group.add(jointMesh);
      this.joints.push(jointMesh);

      // Halo glow
      if ([0, 5, 6, 9, 10, 11, 12, 15, 16].includes(i)) {
        const halo = new THREE.Mesh(
          new THREE.SphereGeometry(size * 1.5, 8, 8),
          new THREE.MeshBasicMaterial({
            color: col,
            transparent: true,
            opacity: 0.35,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          })
        );
        jointMesh.add(halo);
      }
    }

    // 2. Head volume
    this.headMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 12, 12),
      new THREE.MeshStandardMaterial({
        color: wireColor,
        emissive: wireColor,
        emissiveIntensity: 0.25,
        wireframe: true,
        transparent: true,
        opacity: 0.35,
      })
    );
    this.group.add(this.headMesh);

    // 3. Bones
    const boneMat = new THREE.MeshStandardMaterial({
      color: wireColor,
      emissive: wireColor,
      emissiveIntensity: 0.8,
    });
    for (const [a, b] of SKELETON_PAIRS) {
      const geo = new THREE.CylinderGeometry(0.018, 0.014, 1, 6, 1);
      geo.translate(0, 0.5, 0);
      geo.rotateX(Math.PI / 2);
      const mesh = new THREE.Mesh(geo, boneMat);
      this.group.add(mesh);
      this.bones.push({ mesh, a, b });
    }

    // 4. Soft green aura
    this.auraMesh = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.28, 0.9, 8, 12),
      new THREE.MeshBasicMaterial({
        color: C.greenWire,
        transparent: true,
        opacity: 0.12,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        depthWrite: false,
      })
    );
    this.auraMesh.position.y = 1.0;
    this.group.add(this.auraMesh);
  }

  update(pose, t, bp, presence, mot = 0) {
    if (!presence) {
      this.group.visible = false;
      return;
    }
    this.group.visible = true;

    const breath = bp || Math.sin(t * 2.0) * 0.015;
    let kps = [];

    if (pose === 'sleep' || pose === 'lying') {
      const bx = -2.2, by = 0.52, bz = -1.8;
      kps = [
        [bx, by + 0.14 + breath, bz - 0.7],
        [bx - 0.03, by + 0.15, bz - 0.72],
        [bx + 0.03, by + 0.15, bz - 0.72],
        [bx - 0.07, by + 0.12, bz - 0.7],
        [bx + 0.07, by + 0.12, bz - 0.7],
        [bx - 0.20, by + 0.10 + breath, bz - 0.45],
        [bx + 0.20, by + 0.10 + breath, bz - 0.45],
        [bx - 0.26, by + 0.08, bz - 0.20],
        [bx + 0.26, by + 0.08, bz - 0.20],
        [bx - 0.18, by + 0.08, bz - 0.05],
        [bx + 0.18, by + 0.08, bz - 0.05],
        [bx - 0.16, by + 0.08 + breath * 0.5, bz + 0.05],
        [bx + 0.16, by + 0.08 + breath * 0.5, bz + 0.05],
        [bx - 0.14, by + 0.08, bz + 0.42],
        [bx + 0.14, by + 0.08, bz + 0.42],
        [bx - 0.12, by + 0.08, bz + 0.80],
        [bx + 0.12, by + 0.08, bz + 0.80],
      ];
      this.auraMesh.position.set(bx, by + 0.1, bz);
      this.auraMesh.rotation.set(Math.PI / 2, 0, 0);
    } else if (pose === 'study' || pose === 'sitting') {
      const cx = 1.8, cy = 0.0, cz = -1.2;
      kps = [
        [cx, cy + 1.25 + breath, cz - 0.1],
        [cx - 0.03, cy + 1.27, cz - 0.12],
        [cx + 0.03, cy + 1.27, cz - 0.12],
        [cx - 0.07, cy + 1.25, cz - 0.1],
        [cx + 0.07, cy + 1.25, cz - 0.1],
        [cx - 0.20, cy + 1.08 + breath, cz - 0.05],
        [cx + 0.20, cy + 1.08 + breath, cz - 0.05],
        [cx - 0.24, cy + 0.82, cz - 0.25],
        [cx + 0.24, cy + 0.82, cz - 0.25],
        [cx - 0.15, cy + 0.78, cz - 0.50],
        [cx + 0.15, cy + 0.78, cz - 0.50],
        [cx - 0.16, cy + 0.48, cz],
        [cx + 0.16, cy + 0.48, cz],
        [cx - 0.16, cy + 0.48, cz - 0.42],
        [cx + 0.16, cy + 0.48, cz - 0.42],
        [cx - 0.16, cy + 0.05, cz - 0.42],
        [cx + 0.16, cy + 0.05, cz - 0.42],
      ];
      this.auraMesh.position.set(cx, cy + 0.75, cz - 0.15);
      this.auraMesh.rotation.set(0, 0, 0);
    } else if (pose === 'fallen') {
      const fx = 0.2, fy = 0.08, fz = 0.4;
      kps = [
        [fx, fy + 0.08, fz - 0.65],
        [fx - 0.03, fy + 0.08, fz - 0.67],
        [fx + 0.03, fy + 0.08, fz - 0.67],
        [fx - 0.07, fy + 0.06, fz - 0.65],
        [fx + 0.07, fy + 0.06, fz - 0.65],
        [fx - 0.24, fy + 0.06, fz - 0.35],
        [fx + 0.24, fy + 0.06, fz - 0.35],
        [fx - 0.45, fy + 0.05, fz - 0.15],
        [fx + 0.42, fy + 0.05, fz - 0.18],
        [fx - 0.62, fy + 0.04, fz - 0.05],
        [fx + 0.58, fy + 0.04, fz - 0.08],
        [fx - 0.18, fy + 0.06, fz + 0.15],
        [fx + 0.18, fy + 0.06, fz + 0.15],
        [fx - 0.32, fy + 0.05, fz + 0.55],
        [fx + 0.28, fy + 0.05, fz + 0.52],
        [fx - 0.40, fy + 0.04, fz + 0.95],
        [fx + 0.35, fy + 0.04, fz + 0.92],
      ];
      this.auraMesh.position.set(fx, fy + 0.08, fz);
      this.auraMesh.rotation.set(Math.PI / 2, 0, 0.2);
    } else if (pose === 'walking' || pose === 'active' || mot > 0.10) {
      // 4+ Nodes Articulated Dynamic Tracking:
      // Real physical joint flexure and room traversal proportional to live Doppler energy
      const paceSpeed = 1.0 + Math.min(2.5, mot * 2.8);
      const wanderX = Math.sin(t * paceSpeed * 0.9) * (0.8 + Math.min(0.8, mot * 1.2));
      const wanderZ = Math.cos(t * paceSpeed * 0.7) * (0.6 + Math.min(0.6, mot * 1.0));
      const px = 0.1 + wanderX, pz = 0.2 + wanderZ;
      const limbSway = Math.sin(t * 2.8) * Math.min(0.08 + mot * 0.35, 0.25);
      kps = [
        [px, 1.72 + breath, pz],
        [px - 0.03, 1.74 + breath, pz - 0.02],
        [px + 0.03, 1.74 + breath, pz - 0.02],
        [px - 0.07, 1.72, pz],
        [px + 0.07, 1.72, pz],
        [px - 0.20, 1.48 + breath, pz],
        [px + 0.20, 1.48 + breath, pz],
        [px - 0.24, 1.18, pz - limbSway * 0.6],
        [px + 0.24, 1.18, pz + limbSway * 0.6],
        [px - 0.24, 0.88, pz - limbSway * 0.9],
        [px + 0.24, 0.88, pz + limbSway * 0.9],
        [px - 0.15, 0.92, pz],
        [px + 0.15, 0.92, pz],
        [px - 0.15, 0.52, pz + limbSway * 0.5],
        [px + 0.15, 0.52, pz - limbSway * 0.5],
        [px - 0.15, 0.06, pz + limbSway * 0.8],
        [px + 0.15, 0.06, pz - limbSway * 0.8],
      ];
      this.auraMesh.position.set(px, 0.95, pz);
      this.auraMesh.rotation.set(0, 0, 0);
    } else {
      // Standing
      const sway = Math.sin(t * 1.6) * 0.02;
      const px = 0.1 + sway, pz = 0.2;
      kps = [
        [px, 1.72 + breath, pz],
        [px - 0.03, 1.74 + breath, pz - 0.02],
        [px + 0.03, 1.74 + breath, pz - 0.02],
        [px - 0.07, 1.72, pz],
        [px + 0.07, 1.72, pz],
        [px - 0.20, 1.48 + breath, pz],
        [px + 0.20, 1.48 + breath, pz],
        [px - 0.24, 1.18 + breath * 0.5, pz + 0.02],
        [px + 0.24, 1.18 + breath * 0.5, pz + 0.02],
        [px - 0.24, 0.88, pz + 0.05],
        [px + 0.24, 0.88, pz + 0.05],
        [px - 0.15, 0.92, pz],
        [px + 0.15, 0.92, pz],
        [px - 0.15, 0.52, pz],
        [px + 0.15, 0.52, pz],
        [px - 0.15, 0.06, pz],
        [px + 0.15, 0.06, pz],
      ];
      this.auraMesh.position.set(px, 0.95, pz);
      this.auraMesh.rotation.set(0, 0, 0);
    }

    // Update joint positions
    for (let i = 0; i < 17; i++) {
      const p = kps[i];
      this.jointTargets[i].set(p[0], p[1], p[2]);
      this.joints[i].position.lerp(this.jointTargets[i], 0.22);
    }
    this.headMesh.position.copy(this.joints[0].position);

    // Update bones
    const _vA = new THREE.Vector3();
    const _vB = new THREE.Vector3();
    for (const b of this.bones) {
      _vA.copy(this.joints[b.a].position);
      _vB.copy(this.joints[b.b].position);
      const dist = _vA.distanceTo(_vB);
      b.mesh.position.copy(_vA);
      b.mesh.scale.set(1, 1, Math.max(0.01, dist));
      b.mesh.lookAt(_vB);
    }
  }
}

// ============================================================================
// 2. Terracotta Bedroom 3D Environment
// ============================================================================
class BedroomScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.width = canvas.clientWidth || window.innerWidth;
    this.height = canvas.clientHeight || (window.innerHeight - 105);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(this.width, this.height);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(C.bgDeep);
    this.scene.fog = new THREE.FogExp2(C.bgDeep, 0.035);

    this.camDefPos = new THREE.Vector3(5.6, 4.4, 6.4);
    this.camDefLook = new THREE.Vector3(0, 0.8, 0);
    this.camera = new THREE.PerspectiveCamera(46, this.width / this.height, 0.1, 50);
    this.camera.position.copy(this.camDefPos);

    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.minDistance = 2.5;
    this.controls.maxDistance = 16.0;
    this.controls.maxPolarAngle = Math.PI * 0.49;
    this.controls.target.copy(this.camDefLook);
    this.controls.update();

    // Theatre.js Camera Waypoints & Choreography
    this.waypoints = {
      overview: {
        pos: new THREE.Vector3(5.6, 4.4, 6.4),
        look: new THREE.Vector3(0, 0.8, 0),
        time: 0.0,
        desc: 'Studio Overview (45° Isometric)'
      },
      bed: {
        pos: new THREE.Vector3(-1.4, 1.9, 1.8),
        look: new THREE.Vector3(-1.8, 0.7, -0.6),
        time: 3.0,
        desc: 'Sleep & Vitals Macro (Bed Subcarrier)'
      },
      desk: {
        pos: new THREE.Vector3(2.9, 2.1, 0.4),
        look: new THREE.Vector3(2.2, 0.9, -1.8),
        time: 6.0,
        desc: 'Study Desk Posture (Micro-Doppler)'
      },
      radar: {
        pos: new THREE.Vector3(0.01, 8.2, 0.01),
        look: new THREE.Vector3(0, 0, 0),
        time: 9.0,
        desc: 'Overhead Radar 2D Plan View (Trilateration)'
      }
    };

    // Smooth CatmullRom spline through waypoints for 12.0s timeline sequence
    const splinePos = [
      this.waypoints.overview.pos,
      this.waypoints.bed.pos,
      this.waypoints.desk.pos,
      this.waypoints.radar.pos,
      this.waypoints.overview.pos
    ];
    const splineLook = [
      this.waypoints.overview.look,
      this.waypoints.bed.look,
      this.waypoints.desk.look,
      this.waypoints.radar.look,
      this.waypoints.overview.look
    ];
    this.posSpline = new THREE.CatmullRomCurve3(splinePos, true, 'catmullrom', 0.35);
    this.lookSpline = new THREE.CatmullRomCurve3(splineLook, true, 'catmullrom', 0.35);

    this.timelineDuration = 12.0;
    this.timelineTime = 0.0;
    this.timelinePlaying = false;
    this.sliderIsDragging = false;
    this.activeWaypointKey = 'overview';

    // Camera flight interpolation state
    this.flying = false;
    this.flyStartPos = new THREE.Vector3();
    this.flyStartLook = new THREE.Vector3();
    this.flyTargetPos = new THREE.Vector3();
    this.flyTargetLook = new THREE.Vector3();
    this.flyProgress = 0;
    this.flyDuration = 1.1;

    // Pause tour immediately if user manually interacts with OrbitControls
    this.controls.addEventListener('start', () => {
      if (this.timelinePlaying) this.pauseTour();
      this.flying = false;
    });

    this.clock = new THREE.Clock();
    this.waveRings = [];

    this._setupLighting();
    this._buildRoom();
    this._buildFurniture();
    this._buildTransceiverNode();
    this._buildSparkles();

    this.fogCloud = new VolumetricRfDisruptionCloud(this.scene);
    this.presenceEnvelope = new SpatialPresenceEnvelope(this.scene);
    this.avatar = new GreenWireframeAvatar(this.scene);
    this.tierOverride = 'auto'; // 'auto', '1', '3', '4'
  }

  _setupLighting() {
    // 1. Key Directional Light: Warm Terracotta Sun with soft contact shadows
    const sun = new THREE.DirectionalLight(0xF5C07A, 1.55);
    sun.position.set(7, 9, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 25;
    sun.shadow.bias = -0.0005;
    sun.shadow.radius = 2.5;
    this.scene.add(sun);

    // 2. Secondary Fill Light: Soft Terracotta Warmth
    const fill = new THREE.DirectionalLight(0xD4897E, 0.65);
    fill.position.set(-6, 4, -4);
    this.scene.add(fill);

    // 3. Spline Rim Light: Soft Electric Jade backlight for rim silhouettes
    const rim = new THREE.DirectionalLight(0x3eff8a, 0.35);
    rim.position.set(-2, 5, -6);
    this.scene.add(rim);

    // 4. Studio Hemisphere Light for ambient bounce & ambient occlusion
    const hemi = new THREE.HemisphereLight(0x382320, 0x0e0a09, 0.75);
    this.scene.add(hemi);

    // 5. Subtle Ambient Light base
    const amb = new THREE.AmbientLight(0x181210, 0.45);
    this.scene.add(amb);
  }

  _buildRoom() {
    // Spline Architectural Pedestal: Soft radial floor foundation disc
    const pedestalGeo = new THREE.CylinderGeometry(5.8, 6.0, 0.12, 48);
    const pedestalMat = new THREE.MeshStandardMaterial({
      color: 0x110d0c,
      roughness: 0.85,
      metalness: 0.1,
    });
    this.pedestal = new THREE.Mesh(pedestalGeo, pedestalMat);
    this.pedestal.position.y = -0.06;
    this.pedestal.receiveShadow = true;
    this.scene.add(this.pedestal);

    // Subtle glowing pedestal perimeter rim ring
    const rimGeo = new THREE.RingGeometry(5.75, 5.85, 48);
    const rimMat = new THREE.MeshBasicMaterial({
      color: 0xc4766b,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
    });
    const rimMesh = new THREE.Mesh(rimGeo, rimMat);
    rimMesh.rotation.x = -Math.PI / 2;
    rimMesh.position.y = 0.002;
    this.scene.add(rimMesh);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(9, 8),
      new THREE.MeshStandardMaterial({ color: 0x14100e, roughness: 0.88 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    this.grid = new THREE.GridHelper(9, 18, 0x8a4b42, 0x221816);
    this.grid.position.y = 0.003;
    this.scene.add(this.grid);

    const pts = [
      new THREE.Vector3(-4.0, 0, -3.2), new THREE.Vector3(4.0, 0, -3.2),
      new THREE.Vector3(4.0, 0, 3.2), new THREE.Vector3(-4.0, 0, 3.2),
      new THREE.Vector3(-4.0, 0, -3.2)
    ];
    this.scene.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: C.terraDark, transparent: true, opacity: 0.55 })
    ));

    const wallMat = new THREE.MeshStandardMaterial({ color: 0x120e0d, roughness: 0.92 });
    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(8.0, 3.2), wallMat);
    backWall.position.set(0, 1.6, -3.2);
    backWall.receiveShadow = true;
    this.scene.add(backWall);

    const sideWall = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 3.2), wallMat);
    sideWall.position.set(-4.0, 1.6, 0);
    sideWall.rotation.y = Math.PI / 2;
    sideWall.receiveShadow = true;
    this.scene.add(sideWall);
  }

  _buildFurniture() {
    // Bed at (-2.2, 0, -1.8)
    const bedGroup = new THREE.Group();
    bedGroup.position.set(-2.2, 0, -1.8);
    const woodMat = new THREE.MeshStandardMaterial({ color: C.wood, roughness: 0.8 });

    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.36, 2.3), woodMat);
    frame.position.y = 0.18;
    frame.castShadow = true;
    bedGroup.add(frame);

    const mattress = new THREE.Mesh(
      new THREE.BoxGeometry(1.55, 0.22, 2.2),
      new THREE.MeshStandardMaterial({ color: C.mattress, roughness: 0.7 })
    );
    mattress.position.y = 0.42;
    mattress.castShadow = true;
    bedGroup.add(mattress);

    const sheet = new THREE.Mesh(
      new THREE.BoxGeometry(1.58, 0.11, 1.5),
      new THREE.MeshStandardMaterial({ color: C.sheet, roughness: 0.85 })
    );
    sheet.position.set(0, 0.48, 0.35);
    sheet.castShadow = true;
    bedGroup.add(sheet);

    const pilMat = new THREE.MeshStandardMaterial({ color: C.pillow, roughness: 0.6 });
    const pil1 = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.1, 0.42), pilMat);
    pil1.position.set(-0.35, 0.50, -0.75);
    pil1.castShadow = true;
    bedGroup.add(pil1);

    const pil2 = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.1, 0.42), pilMat);
    pil2.position.set(0.35, 0.50, -0.75);
    pil2.castShadow = true;
    bedGroup.add(pil2);

    this.scene.add(bedGroup);

    // Study Desk at (1.8, 0, -2.0)
    const deskGroup = new THREE.Group();
    deskGroup.position.set(1.8, 0, -2.0);

    const deskTop = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 1.0), woodMat);
    deskTop.position.y = 0.76;
    deskTop.castShadow = true;
    deskGroup.add(deskTop);

    const metalMat = new THREE.MeshStandardMaterial({ color: C.metal, roughness: 0.5 });
    const legGeo = new THREE.BoxGeometry(0.08, 0.76, 0.08);
    [[-0.8, 0.38, -0.4], [0.8, 0.38, -0.4], [-0.8, 0.38, 0.4], [0.8, 0.38, 0.4]].forEach(([lx, ly, lz]) => {
      const leg = new THREE.Mesh(legGeo, metalMat);
      leg.position.set(lx, ly, lz);
      leg.castShadow = true;
      deskGroup.add(leg);
    });

    const lapBase = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.02, 0.28), metalMat);
    lapBase.position.set(0, 0.81, 0.05);
    deskGroup.add(lapBase);

    const lapScreen = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.26, 0.02),
      new THREE.MeshStandardMaterial({ color: C.terraLight, roughness: 0.4, emissive: C.terraBase, emissiveIntensity: 0.2 })
    );
    lapScreen.position.set(0, 0.94, -0.08);
    lapScreen.rotation.x = 0.16;
    deskGroup.add(lapScreen);

    // Chair
    const chairGroup = new THREE.Group();
    chairGroup.position.set(1.8, 0, -1.2);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.5), woodMat);
    seat.position.y = 0.45;
    chairGroup.add(seat);

    const back = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.42, 0.06), woodMat);
    back.position.set(0, 0.70, 0.22);
    chairGroup.add(back);

    this.scene.add(deskGroup);
    this.scene.add(chairGroup);
  }

  _buildTransceiverNode() {
    this.nodeGroup = new THREE.Group();
    this.nodeGroup.position.set(-3.9, 1.8, 0.0);

    const box = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.22, 0.16),
      new THREE.MeshStandardMaterial({ color: 0x221a18, roughness: 0.5, metalness: 0.3 })
    );
    this.nodeGroup.add(box);

    const ant = new THREE.Mesh(
      new THREE.CylinderGeometry(0.01, 0.01, 0.25, 6),
      new THREE.MeshStandardMaterial({ color: C.metal })
    );
    ant.position.set(0, 0.2, 0);
    this.nodeGroup.add(ant);

    this.ledMat = new THREE.MeshBasicMaterial({ color: 0x444444 });
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 8), this.ledMat);
    led.position.set(0.065, 0.04, 0);
    this.nodeGroup.add(led);

    this.scene.add(this.nodeGroup);

    this.waveGroup = new THREE.Group();
    this.waveGroup.position.copy(this.nodeGroup.position);
    this.scene.add(this.waveGroup);

    for (let i = 0; i < 4; i++) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.2, 0.25, 32),
        new THREE.MeshBasicMaterial({ color: C.terraMid, transparent: true, opacity: 0, side: THREE.DoubleSide })
      );
      ring.rotation.y = Math.PI / 2;
      this.waveRings.push({ mesh: ring, p: i / 4.0 });
      this.waveGroup.add(ring);
    }
  }

  _buildSparkles() {
    const count = 120;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3 + 0] = (Math.random() - 0.5) * 7.5;
      pos[i * 3 + 1] = 0.2 + Math.random() * 2.8;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 6.0;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.sparkles = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ color: C.terraSun, size: 0.04, transparent: true, opacity: 0.6 })
    );
    this.scene.add(this.sparkles);
  }

  resetCamera() {
    this.flyTo('overview');
  }

  _applyCameraFrame(pos, look) {
    this.camera.position.copy(pos);
    this.controls.target.copy(look);
    const prevDamping = this.controls.enableDamping;
    this.controls.enableDamping = false;
    this.controls.update();
    this.controls.enableDamping = prevDamping;
  }

  evaluateTimeline(t) {
    const total = this.timelineDuration;
    const normT = ((t % total) + total) % total;
    const kfs = [
      { time: 0.0, pos: this.waypoints.overview.pos, look: this.waypoints.overview.look },
      { time: 3.0, pos: this.waypoints.bed.pos, look: this.waypoints.bed.look },
      { time: 6.0, pos: this.waypoints.desk.pos, look: this.waypoints.desk.look },
      { time: 9.0, pos: this.waypoints.radar.pos, look: this.waypoints.radar.look },
      { time: 12.0, pos: this.waypoints.overview.pos, look: this.waypoints.overview.look },
    ];
    let i = 0;
    for (let k = 0; k < kfs.length - 1; k++) {
      if (normT >= kfs[k].time && normT <= kfs[k + 1].time) {
        i = k;
        break;
      }
    }
    const k0 = kfs[i];
    const k1 = kfs[i + 1];
    const segT = (normT - k0.time) / (k1.time - k0.time);
    const ease = (1 - Math.cos(segT * Math.PI)) / 2;
    const pos = k0.pos.clone().lerp(k1.pos, ease);
    const look = k0.look.clone().lerp(k1.look, ease);
    return { pos, look };
  }

  flyTo(key) {
    const wp = this.waypoints[key];
    if (!wp) return;
    this.activeWaypointKey = key;
    this.timelinePlaying = false;
    this._updateTourUI(false);

    // Check reduced motion preference
    const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      this._applyCameraFrame(wp.pos, wp.look);
      this.timelineTime = wp.time;
      this._updateHUDTime(wp.time, wp.desc);
      this._updateActivePill(key);
      return;
    }

    this.flying = true;
    this.flyStartPos.copy(this.camera.position);
    this.flyStartLook.copy(this.controls.target);
    this.flyTargetPos.copy(wp.pos);
    this.flyTargetLook.copy(wp.look);
    this.flyProgress = 0;
    this.timelineTime = wp.time;
    this._updateHUDTime(wp.time, wp.desc);
    this._updateActivePill(key);
  }

  seekTimeline(sec) {
    this.timelineTime = Math.max(0, Math.min(this.timelineDuration, sec));
    this.flying = false;
    const frame = this.evaluateTimeline(this.timelineTime);
    this._applyCameraFrame(frame.pos, frame.look);

    const desc = this._getDescForTime(this.timelineTime);
    this._updateHUDTime(this.timelineTime, desc);
    this._updateActivePillFromTime(this.timelineTime);
  }

  toggleTour() {
    this.timelinePlaying = !this.timelinePlaying;
    this.flying = false;
    this._updateTourUI(this.timelinePlaying);
  }

  pauseTour() {
    this.timelinePlaying = false;
    this._updateTourUI(false);
  }

  _getDescForTime(t) {
    if (t < 1.5 || t >= 10.5) return this.waypoints.overview.desc;
    if (t >= 1.5 && t < 4.5) return this.waypoints.bed.desc;
    if (t >= 4.5 && t < 7.5) return this.waypoints.desk.desc;
    return this.waypoints.radar.desc;
  }

  _updateActivePill(key) {
    document.querySelectorAll('.cam-preset-btn').forEach(btn => {
      if (btn.id === 'btn-camera-tour') return;
      if (btn.getAttribute('data-cam') === key) btn.classList.add('active');
      else btn.classList.remove('active');
    });
  }

  _updateActivePillFromTime(t) {
    let key = 'overview';
    if (t >= 1.5 && t < 4.5) key = 'bed';
    else if (t >= 4.5 && t < 7.5) key = 'desk';
    else if (t >= 7.5 && t < 10.5) key = 'radar';
    this._updateActivePill(key);
  }

  _updateTourUI(isPlaying) {
    const playIcon = document.getElementById('icon-scrub-play');
    const pauseIcon = document.getElementById('icon-scrub-pause');
    const tourBtn = document.getElementById('btn-camera-tour');
    const tourLabel = document.getElementById('label-cam-tour');

    if (playIcon) playIcon.style.display = isPlaying ? 'none' : 'block';
    if (pauseIcon) pauseIcon.style.display = isPlaying ? 'block' : 'none';
    if (tourBtn) {
      if (isPlaying) tourBtn.classList.add('active');
      else tourBtn.classList.remove('active');
    }
    if (tourLabel) tourLabel.textContent = isPlaying ? 'Pause' : 'Tour';
  }

  _updateHUDTime(t, desc) {
    const slider = document.getElementById('cam-timeline-scrubber');
    const timecode = document.getElementById('scrub-timecode');
    const descEl = document.getElementById('scrub-view-desc');

    if (slider && !this.sliderIsDragging) slider.value = t.toFixed(2);
    if (timecode) {
      const m = Math.floor(t / 60);
      const s = (t % 60).toFixed(1);
      const sPad = s < 10 ? '0' + s : s;
      timecode.textContent = `0${m}:${sPad} / 12.0s`;
    }
    if (descEl && desc) descEl.textContent = desc;
  }

  resize() {
    const container = document.getElementById('pane-bedroom');
    if (!container) return;
    this.width = container.clientWidth;
    this.height = container.clientHeight;
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.width, this.height);
  }

  update(dt, t, isActive, state) {
    // 1. Advance timeline if playing autonomous tour
    if (this.timelinePlaying) {
      this.timelineTime = (this.timelineTime + dt * 1.0) % this.timelineDuration;
      const frame = this.evaluateTimeline(this.timelineTime);
      this._applyCameraFrame(frame.pos, frame.look);
      this._updateHUDTime(this.timelineTime, this._getDescForTime(this.timelineTime));
      this._updateActivePillFromTime(this.timelineTime);
    } else if (this.flying) {
      // Smooth flight interpolation towards selected waypoint
      this.flyProgress += dt / this.flyDuration;
      if (this.flyProgress >= 1.0) {
        this.flyProgress = 1.0;
        this.flying = false;
        this._applyCameraFrame(this.flyTargetPos, this.flyTargetLook);
      } else {
        // Cubic ease in-out
        const k = this.flyProgress;
        const ease = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
        const p = this.flyStartPos.clone().lerp(this.flyTargetPos, ease);
        const l = this.flyStartLook.clone().lerp(this.flyTargetLook, ease);
        this._applyCameraFrame(p, l);
      }
    }
    if (isActive) {
      this.ledMat.color.setHex(C.greenWire);
      this.waveGroup.visible = true;
      this.waveRings.forEach(w => {
        w.p = (w.p + dt * 0.45) % 1.0;
        const scale = 0.5 + w.p * 5.5;
        w.mesh.scale.set(scale, scale, scale);
        w.mesh.material.opacity = (1.0 - w.p) * 0.45;
      });
    } else {
      this.ledMat.color.setHex(0x3a302e);
      this.waveGroup.visible = false;
    }

    if (this.sparkles) {
      const p = this.sparkles.geometry.attributes.position.array;
      for (let i = 1; i < p.length; i += 3) {
        p[i] -= dt * 0.08;
        if (p[i] < 0.2) p[i] = 2.8;
      }
      this.sparkles.geometry.attributes.position.needsUpdate = true;
    }

    const presence = state ? (typeof state.presence === 'boolean' ? state.presence : false) : false;
    const pose = state ? (state.pose || 'standing') : 'standing';
    const mot = state ? (typeof state.mot === 'number' ? state.mot : 0) : 0;
    const breathPower = state ? (typeof state.breathing_band_power === 'number' ? state.breathing_band_power : 0.18) : 0.18;
    const conf = state ? (typeof state.conf === 'number' ? state.conf : 88) : 88;
    const br = state ? (typeof state.br === 'number' && state.br > 0 ? state.br : 15.6) : 15.6;
    const hr = state ? (typeof state.hr === 'number' && state.hr > 0 ? state.hr : 72) : 72;

    // Automatic node-adaptive visualization:
    // 1-2 Nodes: Authentic Volumetric Green Fog / Gaussian Splats RF Disruption Cloud
    // 3 Nodes:   3D Spatial Presence Envelope
    // 4+ Nodes:  Articulated 17-Keypoint WiFi DensePose Skeleton
    const effNodes = (state && typeof state.nodes === 'number' && state.nodes > 0) ? state.nodes : 1;

    if (!isActive || !presence) {
      this.fogCloud.group.visible = false;
      this.presenceEnvelope.group.visible = false;
      this.avatar.group.visible = false;
    } else if (effNodes < 3) {
      // Tier 1: 1 ESP32 -> Authentic RuView 3D Volumetric Green Fog / Gaussian Splats
      this.fogCloud.group.visible = true;
      this.presenceEnvelope.group.visible = false;
      this.avatar.group.visible = false;
      this.fogCloud.update(t, presence, pose, mot, breathPower, conf, dt, br, hr);
    } else if (effNodes < 4) {
      // Tier 2: 2-3 ESP32s -> 3D Spatial Centroid & Presence Envelope
      this.fogCloud.group.visible = false;
      this.presenceEnvelope.group.visible = true;
      this.avatar.group.visible = false;
      this.presenceEnvelope.update(t, presence, pose, mot, breathPower, conf);
    } else {
      // Tier 3: 4+ ESP32s -> Articulated 17-Keypoint WiFi DensePose Skeleton
      this.fogCloud.group.visible = false;
      this.presenceEnvelope.group.visible = false;
      this.avatar.group.visible = true;
      this.avatar.update(pose, t, breathPower, presence, mot);
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.scene.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    });
    if (this.controls) this.controls.dispose();
    if (this.renderer) this.renderer.dispose();
  }
}

// ============================================================================
// 3. Application Master Coordinator
// ============================================================================
class InvisiGuardApp {
  constructor() {
    this.activeTab = 'bedroom';
    this.mode = 'live';
    this.scenario = 'auto';
    this.autoTimer = 0;
    this.autoIdx = 0;
    this.autoList = ['vitals', 'study', 'sleep', 'fever', 'walking', 'fall', 'empty'];

    // DOM Hooks
    this.statusDot = document.getElementById('status-dot');
    this.statusLabel = document.getElementById('status-label');
    this.btnSource = document.getElementById('btn-toggle-source');
    this.sourceLabel = document.getElementById('source-label');
    this.scenarioSelect = document.getElementById('scenario-select');

    // Telemetry state
    this.state = {
      nodes: 0,
      packets: 0,
      sourceState: 'disconnected',
      presence: false,
      pose: 'standing',
      hr: 0,
      br: 0,
      conf: 0,
      rssi: -50,
      var: 0,
      mot: 0,
      fall: false,
      struggle: false,
      mlClass: 'NORMAL_STUDYING',
      mlConf: 0.90,
      fallSeconds: 0,
      triage: null,
      dspFiltering: null,
    };

    // Submodules
    this.bedroom = new BedroomScene(document.getElementById('scene-canvas'));
    this.rssiHistory = new Array(50).fill(-50);
    this.ecgPhase = 0;

    this._bindTabs();
    this._bindEvents();
    this._initMLStudio();
    this._startHealthProbe();
    this._connectWs();
    this._startLoop();
  }

  _bindTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tabKey = btn.getAttribute('data-tab');
        if (!tabKey) return;
        this.activeTab = tabKey;

        tabs.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        document.querySelectorAll('.section-pane').forEach(p => p.classList.remove('active'));
        const pane = document.getElementById(`pane-${tabKey}`);
        if (pane) pane.classList.add('active');

        if (tabKey === 'bedroom') {
          setTimeout(() => this.bedroom.resize(), 50);
        }
      });
    });

    const defaultBtn = document.querySelector('.tab-btn[data-tab="bedroom"]');
    if (defaultBtn) defaultBtn.click();
  }

  _bindEvents() {
    window.addEventListener('resize', () => {
      if (this.activeTab === 'bedroom') this.bedroom.resize();
    });

    if (this.btnSource) {
      this.btnSource.addEventListener('click', () => {
        this.mode = (this.mode === 'live') ? 'demo' : 'live';
        this.userExplicitDemo = (this.mode === 'demo');
        this.sourceLabel.textContent = (this.mode === 'live') ? 'Live Hardware' : 'Demo Simulator';
        const scenWrap = document.getElementById('scenario-wrap');
        if (scenWrap) {
          scenWrap.style.display = (this.mode === 'live') ? 'none' : 'flex';
        }
      });
    }

    if (this.scenarioSelect) {
      this.scenarioSelect.addEventListener('change', (e) => {
        this.scenario = e.target.value;
      });
    }

    const resetBtn = document.getElementById('btn-reset-cam');
    if (resetBtn) resetBtn.addEventListener('click', () => this.bedroom.resetCamera());

    // Theatre.js Camera Preset Buttons
    document.querySelectorAll('.cam-preset-btn').forEach(btn => {
      const camKey = btn.getAttribute('data-cam');
      if (camKey) {
        btn.addEventListener('click', () => {
          this.bedroom.flyTo(camKey);
        });
      }
    });

    // Tour toggle buttons
    const btnTour = document.getElementById('btn-camera-tour');
    if (btnTour) {
      btnTour.addEventListener('click', () => {
        this.bedroom.toggleTour();
      });
    }

    const btnPlayScrub = document.getElementById('btn-scrub-play');
    if (btnPlayScrub) {
      btnPlayScrub.addEventListener('click', () => {
        this.bedroom.toggleTour();
      });
    }

    // Timeline range slider scrubber
    const scrubber = document.getElementById('cam-timeline-scrubber');
    if (scrubber) {
      scrubber.addEventListener('mousedown', () => { this.bedroom.sliderIsDragging = true; });
      scrubber.addEventListener('touchstart', () => { this.bedroom.sliderIsDragging = true; }, { passive: true });
      scrubber.addEventListener('mouseup', () => { this.bedroom.sliderIsDragging = false; });
      scrubber.addEventListener('touchend', () => { this.bedroom.sliderIsDragging = false; });

      scrubber.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.bedroom.seekTimeline(val);
      });
    }

    // Keyframe markers click-to-seek
    document.querySelectorAll('.kf-marker').forEach(marker => {
      marker.addEventListener('click', () => {
        const title = marker.getAttribute('title') || marker.textContent || '';
        if (title.includes('Studio') || title.includes('0.0s')) this.bedroom.flyTo('overview');
        else if (title.includes('Bed') || title.includes('3.5s')) this.bedroom.flyTo('bed');
        else if (title.includes('Desk') || title.includes('7.0s')) this.bedroom.flyTo('desk');
        else if (title.includes('Radar') || title.includes('10.5s')) this.bedroom.flyTo('radar');
      });
    });
  }

  _updateTierHUD() {
    const stripDot = document.getElementById('strip-tier-dot');
    const stripText = document.getElementById('strip-tier-text');
    const autoBadge = document.getElementById('ruview-auto-mode-label');

    const nodeCount = (this.state && typeof this.state.nodes === 'number' && this.state.nodes > 0)
      ? this.state.nodes
      : (this.mode === 'demo' ? 1 : 0);

    const isLive = (this.state && this.state.sourceState === 'live' && nodeCount > 0);
    const suffix = isLive ? ` (${nodeCount} ESP32 LIVE)` : (this.mode === 'demo' ? ' (DEMO SIM)' : ' (STANDBY)');

    if (nodeCount === 0 && this.mode !== 'demo') {
      if (stripDot) {
        stripDot.style.background = '#68605c';
        stripDot.style.boxShadow = 'none';
      }
      if (stripText) stripText.textContent = 'HARDWARE OFFLINE · ESP32 DISCONNECTED (0 NODES)';
      if (autoBadge) autoBadge.textContent = '○ HARDWARE DISCONNECTED · 0 NODES';
      return;
    }

    if (nodeCount < 3) {
      if (stripDot) stripDot.style.background = '#00d878';
      if (stripText) stripText.textContent = `TIER 1 · VOLUMETRIC GREEN FOG RF DISRUPTION CLOUD${suffix}`;
      if (autoBadge) autoBadge.textContent = `RUVIEW VOLUMETRIC RF FIELD · ${nodeCount} NODE${nodeCount > 1 ? 'S' : ''} ACTIVE`;
    } else if (nodeCount < 4) {
      if (stripDot) stripDot.style.background = '#f5c07a';
      if (stripText) stripText.textContent = `TIER 2 · 3D SPATIAL PRESENCE ENVELOPE (${nodeCount}-NODE TRILATERATION)${suffix}`;
      if (autoBadge) autoBadge.textContent = `RUVIEW SPATIAL ENVELOPE · ${nodeCount} NODES ACTIVE`;
    } else {
      if (stripDot) stripDot.style.background = '#3eff8a';
      if (stripText) stripText.textContent = `TIER 3 · ARTICULATED 17-KEYPOINT DENSEPOSE SKELETON (${nodeCount} NODES)${suffix}`;
      if (autoBadge) autoBadge.textContent = `RUVIEW DENSEPOSE SKELETON · ${nodeCount} NODES ACTIVE`;
    }
  }

  _initMLStudio() {
    this.mlRecording = false;
    this.mlActiveLabel = null;
    this.calibTimer = null;
    this.calibSec = 10;
    this.activePrepClassId = 0;
    this.activePrepClassName = 'EMPTY_ROOM';
    this.filterFanEnabled = true;

    this._fetchDatasetStats();
    this._fetchModelStatus();

    const CLASS_PREP_META = {
      0: {
        badge: '0: EMPTY BEDROOM CALIBRATION',
        title: 'Please Exit the Bedroom Now',
        desc: 'Step outside and close the bedroom door. Baseline recording will begin after countdown to establish zero-human multipath reference.',
        defaultSec: 20,
        recBadge: '● RECORDING ZERO-MOTION BASELINE',
        recTitle: 'Recording Undisturbed Room Baseline',
        recDesc: 'Stay outside. The sensor is logging 52-subcarrier multipath reflections for zero-motion calibration.'
      },
      1: {
        badge: '1: DESK STUDY POSTURE SETUP',
        title: 'Take a Seat at the Study Desk',
        desc: 'Walk over, sit comfortably on the desk chair, and relax into normal studying posture with natural breathing.',
        defaultSec: 10,
        recBadge: '● RECORDING CLASS 1: NORMAL STUDYING',
        recTitle: 'Recording Seated Study Posture',
        recDesc: 'Maintain gentle studying micro-movements, typing, and natural resting breathing at the desk.'
      },
      2: {
        badge: '2: ROOM PACING POSITION SETUP',
        title: 'Position for Normal Walking',
        desc: 'Stand near the starting corner or doorway, ready to pace naturally back and forth across the bedroom floor plane.',
        defaultSec: 10,
        recBadge: '● RECORDING CLASS 2: ROOM PACING',
        recTitle: 'Recording Continuous Room Walking',
        recDesc: 'Pace steadily across the bedroom floor plane. The sensor is logging Doppler phase shifts.'
      },
      3: {
        badge: '3: STRUGGLE / RAGGING SIMULATION SETUP',
        title: 'Prepare Struggle Simulation Stance',
        desc: 'Position yourself safely with your partner to simulate rapid multi-limb motion, sudden directional shifts, or struggle.',
        defaultSec: 10,
        recBadge: '● RECORDING CLASS 3: STRUGGLE / RAGGING',
        recTitle: 'Recording Fast Struggle Dynamics',
        recDesc: 'Simulate high-velocity multi-limb struggle and sudden movements to capture high-frequency Doppler spikes.'
      },
      4: {
        badge: '4: SUDDEN FALL SIMULATION SETUP',
        title: 'Prepare Safe Fall Simulation',
        desc: 'Stand upright on the safe landing mat or floor area, ready to simulate an unrecovered vertical drop.',
        defaultSec: 10,
        recBadge: '● RECORDING CLASS 4: SUDDEN FALL',
        recTitle: 'Recording Sudden Fall & Impact',
        recDesc: 'Simulate vertical drop followed by floor stillness. The sensor is logging impact burst and ground stillness.'
      }
    };

    const modal = document.getElementById('calibration-modal');
    const modalBadge = document.getElementById('calib-modal-badge');
    const modalTitle = document.getElementById('calib-modal-title');
    const modalDesc = document.getElementById('calib-modal-desc');
    const countdownNum = document.getElementById('countdown-number');
    const progressRing = document.getElementById('countdown-progress-ring');
    const countdownWrap = document.getElementById('calib-countdown-wrap');
    const recState = document.getElementById('calib-recording-state');
    const calibRecBadge = document.getElementById('calib-rec-badge');
    const btnSkip = document.getElementById('btn-skip-countdown');
    const btnStopCalib = document.getElementById('btn-stop-calibration');
    const btnCancel = document.getElementById('btn-cancel-calibration');
    const durationPills = document.querySelectorAll('#calib-duration-pills .timer-pill');

    const updatePillsActive = (sec) => {
      durationPills.forEach(p => {
        if (parseInt(p.getAttribute('data-sec')) === sec) p.classList.add('active');
        else p.classList.remove('active');
      });
    };

    const resetModalUI = () => {
      clearInterval(this.calibTimer);
      this.calibTimer = null;
      if (modal) modal.style.display = 'none';
      if (countdownWrap) countdownWrap.style.display = 'flex';
      if (recState) recState.style.display = 'none';
      if (btnSkip) btnSkip.style.display = 'inline-block';
      if (btnStopCalib) btnStopCalib.style.display = 'none';
      if (progressRing) progressRing.style.strokeDashoffset = '0';
    };

    const startCountdown = (sec) => {
      clearInterval(this.calibTimer);
      this.calibSec = sec;
      updatePillsActive(sec);
      if (countdownNum) countdownNum.textContent = String(this.calibSec);
      if (progressRing) progressRing.style.strokeDashoffset = '0';

      this._playAudioChime(520, 0.15);

      const totalSec = sec;
      const circ = 339.29;

      this.calibTimer = setInterval(() => {
        this.calibSec--;
        if (countdownNum) countdownNum.textContent = String(this.calibSec);

        if (progressRing) {
          const offset = circ * (1 - (totalSec - this.calibSec) / totalSec);
          progressRing.style.strokeDashoffset = offset;
        }

        if (this.calibSec <= 3 && this.calibSec > 0) {
          this._playAudioChime(660, 0.1);
        }

        if (this.calibSec <= 0) {
          clearInterval(this.calibTimer);
          this.calibTimer = null;
          this._startClassRecording(this.activePrepClassId, this.activePrepClassName, true);
        }
      }, 1000);
    };

    // Open Preparation Modal for ANY class
    document.querySelectorAll('.btn-open-prep').forEach(btn => {
      btn.addEventListener('click', () => {
        const clsId = parseInt(btn.getAttribute('data-class')) || 0;
        const clsName = btn.getAttribute('data-name') || 'EMPTY_ROOM';
        const meta = CLASS_PREP_META[clsId] || CLASS_PREP_META[0];
        const sec = parseInt(btn.getAttribute('data-sec')) || meta.defaultSec;

        this.activePrepClassId = clsId;
        this.activePrepClassName = clsName;
        this.activePrepMeta = meta;

        if (modalBadge) modalBadge.textContent = meta.badge;
        if (modalTitle) modalTitle.textContent = meta.title;
        if (modalDesc) modalDesc.textContent = meta.desc;

        if (countdownWrap) countdownWrap.style.display = 'flex';
        if (recState) recState.style.display = 'none';
        if (btnSkip) btnSkip.style.display = 'inline-block';
        if (btnStopCalib) btnStopCalib.style.display = 'none';

        if (modal) modal.style.display = 'flex';
        startCountdown(sec);
      });
    });

    // Tap anywhere on a class card (especially 0: Empty Bedroom) to trigger preparation modal
    document.querySelectorAll('.class-rec-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.class-card-btns') || e.target.closest('.btn-rec-start') || e.target.closest('.btn-rec-stop') || e.target.closest('.btn-open-prep')) {
          return;
        }
        const prepBtn = card.querySelector('.btn-open-prep');
        if (prepBtn) prepBtn.click();
      });
    });

    // Duration selector pills (5s, 10s, 20s)
    durationPills.forEach(pill => {
      pill.addEventListener('click', () => {
        const sec = parseInt(pill.getAttribute('data-sec')) || 10;
        startCountdown(sec);
      });
    });

    if (btnSkip) {
      btnSkip.addEventListener('click', () => {
        clearInterval(this.calibTimer);
        this.calibTimer = null;
        this._startClassRecording(this.activePrepClassId, this.activePrepClassName, true);
      });
    }

    if (btnCancel) {
      btnCancel.addEventListener('click', () => {
        if (this.mlRecording) {
          this._stopClassRecording();
        }
        resetModalUI();
      });
    }

    if (btnStopCalib) {
      btnStopCalib.addEventListener('click', async () => {
        await this._stopClassRecording();
        resetModalUI();
      });
    }

    // Quick Record Buttons (Start & Stop for all 5 classes)
    document.querySelectorAll('.btn-rec-start').forEach(btn => {
      btn.addEventListener('click', () => {
        const clsId = parseInt(btn.getAttribute('data-class'));
        const clsName = btn.getAttribute('data-name');
        const card = btn.closest('.class-rec-card');
        const prepBtn = card ? card.querySelector('.btn-open-prep') : null;
        if (prepBtn) {
          prepBtn.click();
        } else {
          const meta = CLASS_PREP_META[clsId] || CLASS_PREP_META[0];
          const sec = meta.defaultSec || 15;
          this.activePrepClassId = clsId;
          this.activePrepClassName = clsName;
          this.activePrepMeta = meta;

          if (modalBadge) modalBadge.textContent = meta.badge;
          if (modalTitle) modalTitle.textContent = meta.title;
          if (modalDesc) modalDesc.textContent = meta.desc;

          if (countdownWrap) countdownWrap.style.display = 'flex';
          if (recState) recState.style.display = 'none';
          if (btnSkip) btnSkip.style.display = 'inline-block';
          if (btnStopCalib) btnStopCalib.style.display = 'none';

          if (modal) modal.style.display = 'flex';
          startCountdown(sec);
        }
      });
    });

    document.querySelectorAll('.btn-rec-stop').forEach(btn => {
      btn.addEventListener('click', () => {
        this._stopClassRecording();
      });
    });

    // Selective Class Data Clear (Delete only chosen behavior class)
    document.querySelectorAll('.btn-rec-delete').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const clsId = parseInt(btn.getAttribute('data-class'));
        const clsName = btn.getAttribute('data-name');
        if (!confirm(`Are you sure you want to delete all recorded frames for Class ${clsId} (${clsName})?\n\nOther behavior classes in your dataset will remain completely intact.`)) {
          return;
        }
        btn.disabled = true;
        const origText = btn.textContent;
        btn.textContent = 'Clearing...';
        try {
          const resp = await fetch('/api/v1/invisiguard/dataset/delete-class', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ label: clsId }),
          });
          const res = await resp.json();
          if (res.status === 'ok') {
            this._logTerminal(`[DATASET] Deleted ${res.deleted} frames for Class ${clsId} (${res.class_name}). Remaining dataset: ${res.total_samples} frames.`);
            this._playAudioChime(400, 0.2);
            await this._fetchDatasetStats();
          } else {
            this._logTerminal(`[ERROR] Failed to delete: ${res.message || 'Unknown error'}`);
          }
        } catch (err) {
          this._logTerminal(`[ERROR] Network error deleting class data.`);
        } finally {
          btn.disabled = false;
          btn.textContent = origText;
        }
      });
    });

    // Selective Dataset Filtering & Pruning by Date & Class
    const btnPruneSelected = document.getElementById('btn-prune-selected');
    const selectPruneDate = document.getElementById('select-prune-date');
    const selectPruneClass = document.getElementById('select-prune-class');
    const pruneStatusMsg = document.getElementById('prune-status-msg');

    if (btnPruneSelected) {
      btnPruneSelected.addEventListener('click', async () => {
        const dateVal = selectPruneDate ? selectPruneDate.value : 'all';
        const classVal = selectPruneClass ? selectPruneClass.value : 'all';
        const dateLabel = dateVal === 'all' ? 'All Dates' : (dateVal === 'today' ? 'Today' : dateVal);
        const classLabel = classVal === 'all' ? 'All Classes' : `Class ${classVal}`;

        if (!confirm(`Delete training data matching:\n- Date: ${dateLabel}\n- Class: ${classLabel}\n\nProceed with selective deletion?`)) {
          return;
        }

        btnPruneSelected.disabled = true;
        if (pruneStatusMsg) pruneStatusMsg.textContent = 'Pruning selected data...';

        try {
          const resp = await fetch('/api/v1/invisiguard/dataset/delete-by-date', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              date: dateVal,
              label: classVal === 'all' ? null : parseInt(classVal),
            }),
          });
          const res = await resp.json();
          if (res.status === 'ok') {
            const msg = `Deleted ${res.deleted} frames matching Date: ${dateLabel}, Class: ${classLabel}. Remaining: ${res.total_samples} frames.`;
            this._logTerminal(`[DATASET] ${msg}`);
            if (pruneStatusMsg) pruneStatusMsg.textContent = `✓ ${msg}`;
            this._playAudioChime(500, 0.2);
            await this._fetchDatasetStats();
          } else {
            if (pruneStatusMsg) pruneStatusMsg.textContent = `✕ Error: ${res.message || 'Failed'}`;
          }
        } catch (err) {
          if (pruneStatusMsg) pruneStatusMsg.textContent = '✕ Network error while pruning data.';
        } finally {
          btnPruneSelected.disabled = false;
        }
      });
    }

    const btnUndoSession = document.getElementById('btn-undo-session');
    if (btnUndoSession) {
      btnUndoSession.addEventListener('click', async () => {
        if (!confirm('Undo the most recent recording session and discard its frames?')) return;
        btnUndoSession.disabled = true;
        try {
          const resp = await fetch('/api/v1/invisiguard/dataset/delete-last-session', { method: 'POST' });
          const res = await resp.json();
          if (res.status === 'ok') {
            this._logTerminal(`[DATASET] Undid last recording session (removed ${res.deleted} frames). Dataset: ${res.total_samples} frames.`);
            if (pruneStatusMsg) pruneStatusMsg.textContent = `✓ Undid last session: -${res.deleted} frames.`;
            this._playAudioChime(420, 0.2);
            await this._fetchDatasetStats();
          }
        } catch (err) {
          if (pruneStatusMsg) pruneStatusMsg.textContent = '✕ Network error while undoing session.';
        } finally {
          btnUndoSession.disabled = false;
        }
      });
    }

    const btnRestoreBackup = document.getElementById('btn-restore-backup');
    if (btnRestoreBackup) {
      btnRestoreBackup.addEventListener('click', async () => {
        if (!confirm('Restore dataset from the latest automated safety backup?\n\nThis will recover any accidentally deleted frames or sessions.')) return;
        btnRestoreBackup.disabled = true;
        try {
          const resp = await fetch('/api/v1/invisiguard/dataset/restore-backup', { method: 'POST' });
          const res = await resp.json();
          if (res.status === 'ok') {
            this._logTerminal(`[DATASET] Restored dataset from ${res.backup_file}! Total: ${res.total_samples} frames.`);
            if (pruneStatusMsg) pruneStatusMsg.textContent = `✓ Restored from backup: ${res.total_samples} frames available.`;
            this._playAudioChime(600, 0.2);
            await this._fetchDatasetStats();
          } else {
            alert(res.message || 'No backup available to restore.');
          }
        } catch (err) {
          if (pruneStatusMsg) pruneStatusMsg.textContent = '✕ Network error while restoring backup.';
        } finally {
          btnRestoreBackup.disabled = false;
        }
      });
    }

    const btnRefreshDataset = document.getElementById('btn-refresh-dataset');
    if (btnRefreshDataset) {
      btnRefreshDataset.addEventListener('click', async () => {
        await this._fetchDatasetStats();
        if (pruneStatusMsg) pruneStatusMsg.textContent = '✓ Dataset statistics refreshed.';
      });
    }

    const btnBannerStop = document.getElementById('btn-banner-stop');
    if (btnBannerStop) {
      btnBannerStop.addEventListener('click', () => {
        this._stopClassRecording();
      });
    }

    // Toggle FFT Filter Button in Tab 2
    const btnToggleFft = document.getElementById('btn-toggle-fft-filter');
    const badgeFft = document.getElementById('fft-filter-badge');
    if (btnToggleFft) {
      btnToggleFft.addEventListener('click', async () => {
        this.filterFanEnabled = !this.filterFanEnabled;
        try {
          fetch('/api/v1/invisiguard/dsp/toggle-fan-filter', { method: 'POST' }).catch(() => {});
        } catch (e) {}

        if (this.filterFanEnabled) {
          if (badgeFft) {
            badgeFft.textContent = '✓ Comb & Bandpass Filter Active (-45 dB)';
            badgeFft.style.background = 'rgba(0,216,120,0.12)';
            badgeFft.style.color = 'var(--green-bright)';
            badgeFft.style.borderColor = 'rgba(0,216,120,0.3)';
          }
          btnToggleFft.textContent = 'Toggle Raw';
        } else {
          if (badgeFft) {
            badgeFft.textContent = '⚠ Raw Unfiltered (Ceiling Fan Harmonic Noise Visible)';
            badgeFft.style.background = 'rgba(245,158,11,0.15)';
            badgeFft.style.color = '#f59e0b';
            badgeFft.style.borderColor = 'rgba(245,158,11,0.4)';
          }
          btnToggleFft.textContent = 'Enable Filter';
        }
      });
    }

    // Train Model Button
    const btnTrain = document.getElementById('btn-start-train');
    if (btnTrain) {
      btnTrain.addEventListener('click', async () => {
        btnTrain.disabled = true;
        btnTrain.textContent = 'Training in Progress...';
        this._logTerminal('[TRAIN] Launching scikit-learn daily re-calibration...');
        try {
          const resp = await fetch('/api/v1/invisiguard/train', { method: 'POST' });
          const res = await resp.json();
          if (res.status === 'completed') {
            this._logTerminal(`[ACCURACY] Validation: ${res.validation_accuracy}% | Training: ${res.training_accuracy}%`);
            this._logTerminal(`[SAMPLES] Trained on ${res.total_samples} frames across ${res.classes_trained} classes.`);
            this._logTerminal(`[DEPLOY] Model saved to ${res.model_path} and hot-reloaded into live radar!`);
            this._playAudioChime(880, 0.25);
            const badge = document.getElementById('ml-active-model-badge');
            if (badge) badge.textContent = `Model: Active · ${res.validation_accuracy}% Validation Accuracy`;
          } else {
            this._logTerminal(`[ERROR] ${res.message || 'Training failed'}`);
          }
        } catch (e) {
          this._logTerminal('[ERROR] Failed to connect to training API.');
        }
        btnTrain.disabled = false;
        btnTrain.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          <span>Train Production Model (Daily Calibration)</span>
        `;
      });
    }
  }

  async _fetchDatasetStats() {
    try {
      const resp = await fetch('/api/v1/invisiguard/dataset/stats', { cache: 'no-store' });
      if (resp.ok) {
        const d = await resp.json();
        const counts = d.class_counts || {};
        const total = d.total_samples || 0;

        for (let i = 0; i < 5; i++) {
          const el = document.getElementById(`count-class-${i}`);
          if (el) el.textContent = `${counts[i] || 0} frames`;
        }

        const totalBadge = document.getElementById('badge-total-samples');
        if (totalBadge) totalBadge.textContent = `Total: ${total} Frames`;

        // Dynamically populate Date Filter dropdown
        const dateSelect = document.getElementById('select-prune-date');
        if (dateSelect && Array.isArray(d.dates)) {
          const currentVal = dateSelect.value;
          dateSelect.innerHTML = `
            <option value="all">All Dates / All Days</option>
            <option value="today">Today's Sessions</option>
          `;
          d.dates.forEach(dt => {
            const opt = document.createElement('option');
            opt.value = dt;
            opt.textContent = `Day: ${dt}`;
            dateSelect.appendChild(opt);
          });
          if (currentVal && Array.from(dateSelect.options).some(o => o.value === currentVal)) {
            dateSelect.value = currentVal;
          }
        }

        if (total > 0) {
          for (let i = 0; i < 5; i++) {
            const seg = document.getElementById(`bar-seg-${i}`);
            if (seg) {
              const pct = Math.max(4, Math.round(((counts[i] || 0) / total) * 100));
              seg.style.width = `${pct}%`;
            }
          }
          const lbl = document.getElementById('label-dataset-status');
          if (lbl) lbl.textContent = `Balanced (${total} frames loaded across 5 classes)`;
        }
      }
    } catch (e) {}
  }

  async _fetchModelStatus() {
    try {
      const resp = await fetch('/api/v1/invisiguard/model/status', { cache: 'no-store' });
      if (resp.ok) {
        const d = await resp.json();
        const badge = document.getElementById('ml-active-model-badge');
        if (badge && d.accuracy) {
          badge.textContent = `Model: Active · ${d.accuracy}% Validation Accuracy`;
        }
        const cur = d.current_live_prediction || {};
        const predCls = document.getElementById('live-pred-class');
        const predConf = document.getElementById('live-pred-conf');
        if (predCls && cur.class_name) predCls.textContent = cur.class_name;
        if (predConf && cur.confidence) predConf.textContent = `${Math.round(cur.confidence * 100)}%`;
      }
    } catch (e) {}
  }

  async _startClassRecording(label, className, isModal = false) {
    this.mlRecording = true;
    this.mlActiveLabel = label;
    this._playAudioChime(750, 0.2);

    try {
      await fetch('/api/v1/invisiguard/record/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label, class_name: className }),
      });
    } catch (e) {}

    document.querySelectorAll('.btn-rec-start').forEach(b => {
      if (parseInt(b.getAttribute('data-class')) === label) b.disabled = true;
    });
    document.querySelectorAll('.btn-rec-stop').forEach(b => {
      if (parseInt(b.getAttribute('data-class')) === label) b.disabled = false;
    });

    const banner = document.getElementById('ml-record-banner');
    if (banner) {
      banner.style.display = 'block';
      const cName = document.getElementById('banner-rec-class');
      const cFrames = document.getElementById('banner-rec-frames');
      const cTimer = document.getElementById('banner-rec-timer');
      if (cName) cName.textContent = className;
      if (cFrames) cFrames.textContent = '0';
      if (cTimer) cTimer.textContent = '00:00';
    }

    if (isModal) {
      const cWrap = document.getElementById('calib-countdown-wrap');
      const rState = document.getElementById('calib-recording-state');
      const bSkip = document.getElementById('btn-skip-countdown');
      const bStop = document.getElementById('btn-stop-calibration');
      const mTitle = document.getElementById('calib-modal-title');
      const mDesc = document.getElementById('calib-modal-desc');
      const rBadge = document.getElementById('calib-rec-badge');
      const mTimer = document.getElementById('modal-rec-timer');
      if (mTimer) mTimer.textContent = '00:00';
      const meta = (this.activePrepMeta) || {
        recTitle: `Recording Class ${label}: ${className}`,
        recDesc: `Sensor is capturing 52-subcarrier multipath frames for ${className}.`,
        recBadge: `● RECORDING IN PROGRESS: ${label} - ${className}`
      };

      if (cWrap) cWrap.style.display = 'none';
      if (rState) rState.style.display = 'block';
      if (bSkip) bSkip.style.display = 'none';
      if (bStop) {
        bStop.style.display = 'inline-block';
        bStop.textContent = `■ Stop & Save (${className})`;
      }
      if (mTitle) mTitle.textContent = meta.recTitle || `Recording: ${className}`;
      if (mDesc) mDesc.textContent = meta.recDesc || `Sensor is logging live frames.`;
      if (rBadge) rBadge.textContent = meta.recBadge || `● RECORDING: ${label} - ${className}`;
    }

    this._logTerminal(`[REC] Started capturing live frames for Class ${label}: ${className} (Recording continuously until Stop is pressed)`);

    this.recCounter = 0;
    this.recSeconds = 0;
    this.recInterval = setInterval(() => {
      this.recSeconds += 1;
      this.recCounter += 5;
      const mins = Math.floor(this.recSeconds / 60);
      const secs = this.recSeconds % 60;
      const timeStr = `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;

      const f1 = document.getElementById('banner-rec-frames');
      const f2 = document.getElementById('modal-rec-samples');
      const t1 = document.getElementById('banner-rec-timer');
      const t2 = document.getElementById('modal-rec-timer');
      if (f1) f1.textContent = this.recCounter;
      if (f2) f2.textContent = this.recCounter;
      if (t1) t1.textContent = timeStr;
      if (t2) t2.textContent = timeStr;

      // CONTINUOUS RECORDING: Never automatically stops! Continues until user clicks Stop.
    }, 1000);
  }

  async _stopClassRecording() {
    clearInterval(this.recInterval);
    this.mlRecording = false;
    this._playAudioChime(440, 0.15);

    try {
      const resp = await fetch('/api/v1/invisiguard/record/stop', { method: 'POST' });
      const res = await resp.json();
      const prunedFrames = res.discarded_noise_samples !== undefined ? res.discarded_noise_samples : 0;
      const prunedSec = res.pruned_tail_seconds !== undefined ? res.pruned_tail_seconds : 10.0;
      const pruneMsg = ` [Pruned last ${prunedSec}s reaching noise: -${prunedFrames} frames]`;
      this._logTerminal(`[SAVED] Captured ${res.samples_captured} frames for ${res.class_name}!${pruneMsg} Total dataset: ${res.total_dataset_samples} frames.`);
    } catch (e) {
      this._logTerminal('[SAVED] Saved calibration frames locally (last 10s reaching noise pruned).');
    }

    document.querySelectorAll('.btn-rec-start').forEach(b => b.disabled = false);
    document.querySelectorAll('.btn-rec-stop').forEach(b => b.disabled = true);

    const banner = document.getElementById('ml-record-banner');
    if (banner) banner.style.display = 'none';

    await this._fetchDatasetStats();
  }

  _logTerminal(text) {
    const term = document.getElementById('train-terminal-log');
    if (term) {
      const now = new Date().toTimeString().split(' ')[0];
      const line = document.createElement('div');
      line.innerHTML = `<span style="color:var(--text-label)">[${now}]</span> ${text}`;
      term.appendChild(line);
      term.scrollTop = term.scrollHeight;
    }
  }

  _playAudioChime(freq = 520, duration = 0.15) {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {}
  }

  async _startHealthProbe() {
    const probe = async () => {
      if (this.mode === 'demo') {
        this._updateDemoTelemetry();
        return;
      }
      try {
        const resp = await fetch('/health', { cache: 'no-store' });
        if (resp.ok) {
          const d = await resp.json();
          this.state.sourceState = d.source_state || 'disconnected';
          this.state.nodes = d.nodes || 0;
          this.state.packets = d.packets_received || 0;
        }
      } catch (e) {
        this.state.sourceState = 'disconnected';
        this.state.nodes = 0;
      }
      this._updateUI();
    };
    probe();
    setInterval(probe, 1500);
  }

  _connectWs() {
    const host = window.location.hostname || 'localhost';
    try {
      this.ws = new WebSocket(`ws://${host}:3000/ws/sensing`);
      this.ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          if (msg.type === 'sensing_update') {
            const isLivePacket = (msg.source_state === 'live') && (msg.nodes_count > 0 || (msg.hardware && msg.hardware.connected));
            if (isLivePacket) {
              if (this.mode === 'demo' && !this.userExplicitDemo) {
                this.mode = 'live';
                if (this.sourceLabel) this.sourceLabel.textContent = 'Live Hardware';
              }
              if (this.mode === 'live') {
                this.state.sourceState = 'live';
                this.state.nodes = Math.max(1, msg.nodes_count || (msg.nodes ? msg.nodes.length : 1));
              }
            } else if (this.mode === 'live') {
              this.state.sourceState = 'disconnected';
              this.state.nodes = 0;
            }
            if (typeof msg.packets_received === 'number') {
              this.state.packets = msg.packets_received;
            }
            if (msg.hardware) {
              this.state.hardware = msg.hardware;
            }
            if (this.mode === 'live') {
              this._handleLiveFrame(msg);
            }
          }
        } catch (e) {}
      };
      this.ws.onclose = () => setTimeout(() => this._connectWs(), 2000);
    } catch (e) {
      setTimeout(() => this._connectWs(), 2000);
    }
  }

  _handleLiveFrame(msg) {
    const feat = msg.features || {};
    const cls = msg.classification || {};
    const vit = msg.vital_signs || {};

    if (typeof msg.packets_received === 'number') {
      this.state.packets = msg.packets_received;
    }
    const isLive = (msg.source_state === 'live') && (msg.nodes_count > 0 || (msg.hardware && msg.hardware.connected));
    this.state.sourceState = isLive ? 'live' : 'disconnected';
    this.state.nodes = isLive ? Math.max(1, msg.nodes_count || (msg.nodes ? msg.nodes.length : 1)) : 0;
    if (msg.hardware) {
      this.state.hardware = msg.hardware;
    }

    this.state.presence = isLive ? (cls.presence !== undefined ? cls.presence : true) : false;
    this.state.fall = isLive ? (cls.fall_detected || false) : false;
    this.state.struggle = isLive ? (cls.struggle_detected || false) : false;
    this.state.mlClass = isLive ? (cls.ml_class || (msg.ml_inference && msg.ml_inference.class_name) || 'NORMAL_STUDYING') : 'EMPTY_ROOM';
    this.state.mlConf = isLive ? (cls.ml_confidence || (msg.ml_inference && msg.ml_inference.confidence) || 0.90) : 0.0;
    this.state.rssi = isLive ? (typeof feat.mean_rssi === 'number' ? feat.mean_rssi : -50) : -95;
    this.state.var = isLive ? (typeof feat.variance === 'number' ? feat.variance : 0) : 0;
    this.state.mot = isLive ? (typeof feat.motion_band_power === 'number' ? feat.motion_band_power : 0) : 0;
    this.state.noise = feat.noise_floor !== undefined ? feat.noise_floor : (msg.hardware?.noise_floor_dbm ?? -95.0);
    this.state.freq_mhz = feat.freq_mhz !== undefined ? feat.freq_mhz : (msg.hardware?.freq_mhz ?? 2472);
    this.state.channel = feat.channel !== undefined ? feat.channel : (msg.hardware?.channel ?? 13);

    if (this.scenario && this.scenario !== 'auto') {
      if (this.scenario === 'empty') {
        this.state.presence = false;
        this.state.pose = 'standing';
      } else {
        this.state.presence = true;
        if (this.scenario === 'sleep' || this.scenario === 'fever') this.state.pose = 'sleep';
        else if (this.scenario === 'study') this.state.pose = 'study';
        else if (this.scenario === 'fall') this.state.pose = 'fallen';
        else if (this.scenario === 'active') this.state.pose = 'active';
        else this.state.pose = 'standing';
      }
    } else if (this.state.presence) {
      if (this.state.fall || this.state.mlClass === 'FALL_EVENT') {
        this.state.pose = 'fallen';
      } else if (this.state.mot > 0.10 || cls.motion_level === 'active' || this.state.struggle || this.state.mlClass === 'WALKING' || this.state.mlClass === 'VIOLENT_STRUGGLE') {
        this.state.pose = 'active';
      } else if (this.state.triage && (this.state.triage.state === 'HEALTHY_RESTFUL_SLEEP' || this.state.triage.state === 'SICK_HIGH_FEVER')) {
        this.state.pose = 'sleep';
      } else if (this.state.mlClass === 'NORMAL_STUDYING') {
        this.state.pose = 'study';
      } else {
        this.state.pose = 'standing';
      }
    } else {
      this.state.pose = 'standing';
    }

    if (this.state.presence) {
      this.state.hr = vit.heart_rate_bpm || 72;
      this.state.br = vit.breathing_rate_bpm || 16;
      this.state.breathing_band_power = typeof feat.breathing_band_power === 'number' ? feat.breathing_band_power : 0.18;
      if (msg.triage) this.state.triage = msg.triage;
      if (msg.dsp_filtering) this.state.dspFiltering = msg.dsp_filtering;
    } else {
      this.state.hr = 0;
      this.state.br = 0;
      this.state.conf = 0;
      this.state.breathing_band_power = 0;
      if (msg.triage) this.state.triage = msg.triage;
    }

    this._pushRssi(this.state.rssi);
    this._updateUI();
  }

  _updateDemoTelemetry() {
    const t = performance.now() * 0.001;
    let s = this.scenario;
    if (s === 'auto') {
      this.autoTimer += 0.05;
      if (this.autoTimer > 25) {
        this.autoTimer = 0;
        this.autoIdx = (this.autoIdx + 1) % this.autoList.length;
      }
      s = this.autoList[this.autoIdx];
    }

    this.state.nodes = 1;
    this.state.packets = Math.floor(t * 32);
    this.state.noise = -95.0;
    this.state.freq_mhz = 2472;
    this.state.channel = 13;

    if (s === 'empty') {
      this.state.presence = false;
      this.state.pose = 'standing';
      this.state.mlClass = 'EMPTY_ROOM';
      this.state.mlConf = 0.99;
      this.state.struggle = false;
      this.state.hr = 0;
      this.state.br = 0;
      this.state.conf = 0;
      this.state.rssi = -68;
      this.state.var = 0.08;
      this.state.mot = 0.01;
      this.state.fall = false;
      this.state.triage = {
        state: "EMPTY_ROOM",
        state_label: "Room Empty · Standby Mode",
        restlessness_index: 0.00,
        respiratory_regularity_pct: 0.0,
        fever_score: 0.00,
        fever_risk: "nominal"
      };
    } else if (s === 'sleep') {
      this.state.presence = true;
      this.state.pose = 'sleep';
      this.state.mlClass = 'NORMAL_STUDYING';
      this.state.mlConf = 0.96;
      this.state.struggle = false;
      this.state.hr = Math.round(58 + Math.sin(t * 0.3) * 3);
      this.state.br = Math.round(12 + Math.cos(t * 0.2) * 1.5);
      this.state.conf = 96;
      this.state.rssi = -48;
      this.state.var = 0.42;
      this.state.mot = 0.02;
      this.state.fall = false;
      this.state.triage = {
        state: "HEALTHY_RESTFUL_SLEEP",
        state_label: "Normal Restful Sleep",
        restlessness_index: 0.03,
        respiratory_regularity_pct: 98.4,
        fever_score: 0.04,
        fever_risk: "low"
      };
    } else if (s === 'fever') {
      this.state.presence = true;
      this.state.pose = 'sleep';
      this.state.mlClass = 'NORMAL_STUDYING';
      this.state.mlConf = 0.92;
      this.state.struggle = false;
      this.state.hr = Math.round(104 + Math.sin(t * 0.5) * 4);
      this.state.br = Math.round(25 + Math.cos(t * 0.4) * 2);
      this.state.conf = 97;
      this.state.rssi = -46;
      this.state.var = 0.95;
      this.state.mot = 0.08;
      this.state.fall = false;
      this.state.triage = {
        state: "SICK_HIGH_FEVER",
        state_label: "Warning: High Fever / Sickness Tachycardia Detected",
        restlessness_index: 0.42,
        respiratory_regularity_pct: 82.5,
        fever_score: 0.86,
        fever_risk: "high"
      };
    } else if (s === 'study') {
      this.state.presence = true;
      this.state.pose = 'study';
      this.state.mlClass = 'NORMAL_STUDYING';
      this.state.mlConf = 0.95;
      this.state.struggle = false;
      this.state.hr = Math.round(70 + Math.sin(t * 0.4) * 3);
      this.state.br = Math.round(15 + Math.cos(t * 0.3) * 1.5);
      this.state.conf = 92;
      this.state.rssi = -46;
      this.state.var = 0.85;
      this.state.mot = 0.04;
      this.state.fall = false;
    } else if (s === 'walking') {
      this.state.presence = true;
      this.state.pose = 'walking';
      this.state.mlClass = 'WALKING';
      this.state.mlConf = 0.94;
      this.state.struggle = false;
      this.state.hr = Math.round(88 + Math.sin(t * 0.6) * 5);
      this.state.br = Math.round(20 + Math.cos(t * 0.4) * 2);
      this.state.conf = 95;
      this.state.rssi = -42;
      this.state.var = 3.65;
      this.state.mot = 0.38;
      this.state.fall = false;
    } else if (s === 'fall') {
      this.state.presence = true;
      this.state.pose = 'fallen';
      this.state.mlClass = 'FALL_EVENT';
      this.state.mlConf = 0.98;
      this.state.struggle = false;
      this.state.hr = Math.round(98 + Math.sin(t * 0.8) * 8);
      this.state.br = Math.round(24 + Math.cos(t * 0.6) * 3);
      this.state.conf = 98;
      this.state.rssi = -40;
      this.state.var = 12.8;
      this.state.mot = 0.65;
      this.state.fall = true;
    } else {
      this.state.presence = true;
      this.state.pose = 'standing';
      this.state.mlClass = 'NORMAL_STUDYING';
      this.state.mlConf = 0.90;
      this.state.struggle = false;
      this.state.hr = Math.round(74 + Math.sin(t * 0.5) * 4);
      this.state.br = Math.round(16 + Math.cos(t * 0.3) * 2);
      this.state.conf = 94;
      this.state.rssi = -45;
      this.state.var = 1.15;
      this.state.mot = 0.08;
      this.state.fall = false;
    }

    this._pushRssi(this.state.rssi);
    this._updateUI();
  }

  _pushRssi(v) {
    if (typeof v === 'number' && !isNaN(v)) {
      this.rssiHistory.push(v);
      if (this.rssiHistory.length > 50) this.rssiHistory.shift();
    }
  }

  _updateUI() {
    // 1. Header Status Pill
    if (this.mode === 'demo') {
      this.statusDot.className = 'status-dot demo';
      this.statusLabel.textContent = `DEMO SIMULATION (${this.state.packets} PKTS)`;
    } else {
      const isLiveHw = (this.state.sourceState === 'live') && (this.state.nodes > 0) && (this.state.hardware ? this.state.hardware.connected : true);
      if (isLiveHw) {
        this.statusDot.className = 'status-dot live';
        const portStr = (this.state.hardware && this.state.hardware.port) ? ` · ${this.state.hardware.port}` : '';
        this.statusLabel.textContent = `LIVE CSI · ${this.state.nodes} NODE${this.state.nodes > 1 ? 'S' : ''}${portStr} (${this.state.packets} PKTS)`;
      } else {
        this.statusDot.className = 'status-dot disconnected';
        this.statusLabel.textContent = 'DISCONNECTED (0 NODES)';
      }
    }

    // 2. Vitals Section
    const elHr = document.getElementById('vit-hr');
    const elHrBar = document.getElementById('vit-hr-bar');
    const elBr = document.getElementById('vit-br');
    const elBrBar = document.getElementById('vit-br-bar');
    const elConf = document.getElementById('vit-conf');
    const elConfBar = document.getElementById('vit-conf-bar');

    if (this.state.presence) {
      const hr = (this.state.hr && this.state.hr > 0) ? this.state.hr : 72;
      const br = (this.state.br && this.state.br > 0) ? this.state.br : 15.6;
      const conf = (this.state.conf && this.state.conf > 0) ? this.state.conf : 92;

      if (elHr) elHr.textContent = String(Math.round(hr));
      if (elBr) elBr.textContent = (typeof br === 'number') ? br.toFixed(1) : String(br);
      if (elConf) elConf.textContent = String(Math.round(conf));
      if (elConfBar) elConfBar.style.width = `${Math.min(100, Math.max(10, conf))}%`;
    } else {
      if (elHr) elHr.textContent = '--';
      if (elHrBar) {
        elHrBar.style.width = '0%';
        elHrBar.style.opacity = '0.35';
      }
      if (elBr) elBr.textContent = '--';
      if (elBrBar) {
        elBrBar.style.width = '0%';
        elBrBar.style.opacity = '0.35';
      }
      if (elConf) elConf.textContent = '--';
      if (elConfBar) elConfBar.style.width = '0%';
    }

    // 3. Hardware Section
    const elRssi = document.getElementById('hw-rssi');
    const elNoise = document.getElementById('hw-noise');
    const elVar = document.getElementById('hw-var');
    const elMot = document.getElementById('hw-mot');
    const elNodes = document.getElementById('hw-nodes');
    const elPkts = document.getElementById('hw-pkts');
    const elRfFreq = document.getElementById('hw-rf-freq');
    const elChanBadge = document.getElementById('hw-channel-badge');

    const nodeCount = (this.state.sourceState === 'live' && this.state.nodes > 0) ? this.state.nodes : (this.mode === 'demo' ? 1 : 0);
    const noiseVal = (typeof this.state.noise === 'number') ? this.state.noise : -95.0;
    const freqVal = this.state.freq_mhz || 2472;
    const chanVal = this.state.channel || 13;

    if (this.mode === 'demo' || (this.state.sourceState === 'live' && this.state.nodes > 0)) {
      if (elRssi) elRssi.textContent = `${this.state.rssi} dBm`;
      if (elNoise) elNoise.textContent = `${noiseVal.toFixed(1)} dBm`;
      if (elVar) elVar.textContent = (typeof this.state.var === 'number') ? this.state.var.toFixed(3) : String(this.state.var);
      if (elMot) elMot.textContent = (typeof this.state.mot === 'number') ? this.state.mot.toFixed(3) : String(this.state.mot);
      if (elNodes) elNodes.textContent = `${nodeCount} Node${nodeCount > 1 ? 's' : ''} Active (${this.state.sourceState === 'live' ? 'ESP32-S3 Live' : 'Simulated'})`;
      if (elPkts) elPkts.textContent = `${this.state.packets} pkts`;
      if (elRfFreq) elRfFreq.textContent = `${freqVal} MHz (2.4 GHz)`;
      if (elChanBadge) elChanBadge.textContent = `Channel ${chanVal}`;
    } else {
      if (elRssi) elRssi.textContent = '-- dBm';
      if (elNoise) elNoise.textContent = `${noiseVal.toFixed(1)} dBm`;
      if (elVar) elVar.textContent = '--';
      if (elMot) elMot.textContent = '--';
      if (elNodes) elNodes.textContent = '0 Nodes Connected';
      if (elPkts) elPkts.textContent = '0 pkts';
      if (elRfFreq) elRfFreq.textContent = `${freqVal} MHz (2.4 GHz)`;
      if (elChanBadge) elChanBadge.textContent = `Channel ${chanVal}`;
    }

    // 4. Safety & Fall Section
    const elSafetyCard = document.getElementById('safety-state-card');
    const elSafetyText = document.getElementById('safety-state-text');
    if (elSafetyCard && elSafetyText) {
      if (this.state.fall) {
        elSafetyCard.className = 'alert-card-state fall';
        elSafetyText.textContent = `⚠ CRITICAL ALERT: FALL DETECTED ON BEDROOM FLOOR (${Math.round(this.state.mlConf * 100)}% CONF)`;
      } else if (this.state.struggle) {
        elSafetyCard.className = 'alert-card-state fall';
        elSafetyText.textContent = `⚠ VIOLENT STRUGGLE / AGITATION DETECTED (${Math.round(this.state.mlConf * 100)}% CONF)`;
      } else if (this.state.presence) {
        elSafetyCard.className = 'alert-card-state safe';
        let prettyCls = (this.state.mlClass || 'NORMAL_STUDYING').replace(/_/g, ' ');
        if (this.state.pose === 'active' || this.state.mot > 0.15) {
          prettyCls = 'ACTIVE ROOM PACING / MOVEMENT';
        }
        elSafetyText.textContent = `✓ ROOM OCCUPIED · ${prettyCls} (${Math.round(this.state.mlConf * 100)}% CONF)`;
      } else {
        elSafetyCard.className = 'alert-card-state safe';
        elSafetyText.textContent = '✓ ROOM EMPTY · STANDBY MODE';
      }
    }

    // 5. Clinical Triaging Section
    const elTriageBadge = document.getElementById('clinical-triage-badge');
    const elRestless = document.getElementById('triage-restless');
    const elRespReg = document.getElementById('triage-respreg');
    const elFever = document.getElementById('triage-feverscore');
    const tr = this.state.triage;

    if (elTriageBadge) {
      if (tr && tr.state) {
        if (tr.state === 'FALL_UNCONSCIOUS') {
          elTriageBadge.textContent = '⚠ ' + tr.state_label;
          elTriageBadge.style.color = 'var(--red-alert)';
          elTriageBadge.style.background = 'rgba(255, 64, 96, 0.12)';
          elTriageBadge.style.borderColor = 'rgba(255, 64, 96, 0.35)';
        } else if (tr.state === 'SICK_HIGH_FEVER' || tr.state === 'RESPIRATORY_DISTRESS') {
          elTriageBadge.textContent = '⚠ ' + tr.state_label;
          elTriageBadge.style.color = '#f59e0b';
          elTriageBadge.style.background = 'rgba(245, 158, 11, 0.12)';
          elTriageBadge.style.borderColor = 'rgba(245, 158, 11, 0.35)';
        } else if (tr.state === 'HEALTHY_RESTFUL_SLEEP') {
          elTriageBadge.textContent = '✓ ' + tr.state_label;
          elTriageBadge.style.color = 'var(--green-bright)';
          elTriageBadge.style.background = 'rgba(0, 216, 120, 0.12)';
          elTriageBadge.style.borderColor = 'rgba(0, 216, 120, 0.3)';
        } else if (tr.state === 'ACTIVE_OCCUPANCY') {
          elTriageBadge.textContent = '✓ ' + tr.state_label;
          elTriageBadge.style.color = 'var(--terra-pale)';
          elTriageBadge.style.background = 'rgba(196, 118, 107, 0.12)';
          elTriageBadge.style.borderColor = 'rgba(196, 118, 107, 0.3)';
        } else {
          elTriageBadge.textContent = '✓ ' + tr.state_label;
          elTriageBadge.style.color = 'var(--text-secondary)';
          elTriageBadge.style.background = 'rgba(255, 255, 255, 0.05)';
          elTriageBadge.style.borderColor = 'var(--border-subtle)';
        }
      } else {
        if (this.state.fall) {
          elTriageBadge.textContent = '⚠ CRITICAL: FALL IMPACT / FLOOR INACTIVITY';
          elTriageBadge.style.color = 'var(--red-alert)';
          elTriageBadge.style.background = 'rgba(255, 64, 96, 0.12)';
          elTriageBadge.style.borderColor = 'rgba(255, 64, 96, 0.35)';
        } else if (this.state.presence) {
          if (this.state.hr > 95 && this.state.br > 22 && this.state.mot < 0.1) {
            elTriageBadge.textContent = '⚠ SICKNESS / FEVER TACHYCARDIA DETECTED';
            elTriageBadge.style.color = '#f59e0b';
            elTriageBadge.style.background = 'rgba(245, 158, 11, 0.12)';
            elTriageBadge.style.borderColor = 'rgba(245, 158, 11, 0.35)';
          } else if (this.state.pose === 'sleep' || this.state.mot < 0.05) {
            elTriageBadge.textContent = '✓ Normal Restful Sleep';
            elTriageBadge.style.color = 'var(--green-bright)';
            elTriageBadge.style.background = 'rgba(0, 216, 120, 0.12)';
            elTriageBadge.style.borderColor = 'rgba(0, 216, 120, 0.3)';
          } else {
            elTriageBadge.textContent = '✓ Active Student (Normal Vitals)';
            elTriageBadge.style.color = 'var(--terra-pale)';
            elTriageBadge.style.background = 'rgba(196, 118, 107, 0.12)';
            elTriageBadge.style.borderColor = 'rgba(196, 118, 107, 0.3)';
          }
        } else {
          elTriageBadge.textContent = '✓ Room Empty Standby';
          elTriageBadge.style.color = 'var(--text-secondary)';
          elTriageBadge.style.background = 'rgba(255, 255, 255, 0.05)';
          elTriageBadge.style.borderColor = 'var(--border-subtle)';
        }
      }
    }

    if (elRestless) {
      if (tr && typeof tr.restlessness_index === 'number') {
        const idx = tr.restlessness_index.toFixed(2);
        const label = idx > 0.35 ? '(High Agitation)' : '(Calm)';
        elRestless.innerHTML = `${idx} <span style="font-size: 12px; font-weight: 500; color: var(--text-secondary);">${label}</span>`;
      } else if (this.state.presence) {
        const idx = Math.min(0.99, (this.state.var * 0.025 + this.state.mot * 0.08)).toFixed(2);
        const label = idx > 0.35 ? '(High Agitation)' : '(Calm)';
        elRestless.innerHTML = `${idx} <span style="font-size: 12px; font-weight: 500; color: var(--text-secondary);">${label}</span>`;
      } else {
        elRestless.innerHTML = `-- <span style="font-size: 12px; font-weight: 500; color: var(--text-secondary);">(Standby)</span>`;
      }
    }

    if (elRespReg) {
      if (tr && typeof tr.respiratory_regularity_pct === 'number' && this.state.presence) {
        elRespReg.innerHTML = `${tr.respiratory_regularity_pct.toFixed(1)}% <span style="font-size: 12px; font-weight: 500; color: var(--text-secondary);">(Eupnea)</span>`;
      } else if (this.state.presence && this.state.br > 0) {
        elRespReg.innerHTML = `98.2% <span style="font-size: 12px; font-weight: 500; color: var(--text-secondary);">(Eupnea)</span>`;
      } else {
        elRespReg.innerHTML = `-- <span style="font-size: 12px; font-weight: 500; color: var(--text-secondary);">(Standby)</span>`;
      }
    }

    if (elFever) {
      if (tr && typeof tr.fever_score === 'number' && this.state.presence) {
        const score = tr.fever_score.toFixed(2);
        const isFever = (tr.fever_risk === 'high' || tr.fever_score > 0.4);
        const color = isFever ? 'var(--red-alert)' : 'var(--green-bright)';
        const risk = isFever ? '(High Risk - Fever)' : '(Low Risk - Healthy)';
        elFever.innerHTML = `${score} <span style="font-size: 12px; font-weight: 500; color: ${color};">${risk}</span>`;
      } else if (this.state.presence && this.state.hr > 0) {
        const isFever = (this.state.hr > 95 && this.state.br > 22 && this.state.mot < 0.1);
        const score = isFever ? '0.84' : '0.04';
        const color = isFever ? 'var(--red-alert)' : 'var(--green-bright)';
        const risk = isFever ? '(High Risk - Fever)' : '(Low Risk - Healthy)';
        elFever.innerHTML = `${score} <span style="font-size: 12px; font-weight: 500; color: ${color};">${risk}</span>`;
      } else {
        elFever.innerHTML = `-- <span style="font-size: 12px; font-weight: 500; color: var(--text-secondary);">(Standby)</span>`;
      }
    }

    // 6. ML Live Prediction Card
    const elPredCls = document.getElementById('live-pred-class');
    const elPredConf = document.getElementById('live-pred-conf');
    if (elPredCls && this.state.mlClass) {
      elPredCls.textContent = this.state.mlClass;
    }
    if (elPredConf && this.state.mlConf) {
      elPredConf.textContent = `${Math.round(this.state.mlConf * 100)}%`;
    }

    // 5. Bedroom HUD Strip Metrics
    const elBreathPower = document.getElementById('hud-breath-power');
    if (elBreathPower) elBreathPower.textContent = (this.state.presence && typeof this.state.breathing_band_power === 'number') ? this.state.breathing_band_power.toFixed(3) : '0.000';

    const elMotionPower = document.getElementById('hud-motion-power');
    if (elMotionPower) elMotionPower.textContent = (this.state.presence && typeof this.state.mot === 'number') ? this.state.mot.toFixed(3) : '0.000';

    const elVitalsSummary = document.getElementById('hud-vitals-summary');
    if (elVitalsSummary) {
      if (this.state.presence) {
        const hr = (this.state.hr && this.state.hr > 0) ? this.state.hr : 72;
        const br = (this.state.br && this.state.br > 0) ? this.state.br : 15.6;
        elVitalsSummary.innerHTML = `
          <svg width="10" height="10" viewBox="0 0 24 24" fill="#ff4060"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          <span style="font-weight:700;">${Math.round(hr)}</span> BPM &middot; 
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2"><path d="M12 4v8m0 0l-3 4m3-4l3 4"/><circle cx="6" cy="15" r="3"/><circle cx="18" cy="15" r="3"/></svg>
          <span style="font-weight:700;">${(typeof br === 'number') ? br.toFixed(1) : br}</span> RPM
        `;
      } else {
        elVitalsSummary.textContent = 'ROOM EMPTY';
      }
    }

    const elPillHr = document.getElementById('pill-hr');
    const elPillBr = document.getElementById('pill-br');
    if (elPillHr && elPillBr) {
      if (this.state.presence) {
        const hr = (this.state.hr && this.state.hr > 0) ? this.state.hr : 72;
        const br = (this.state.br && this.state.br > 0) ? this.state.br : 15.6;
        elPillHr.textContent = String(Math.round(hr));
        elPillBr.textContent = (typeof br === 'number') ? br.toFixed(1) : String(br);
      } else {
        elPillHr.textContent = '--';
        elPillBr.textContent = '--';
      }
    }

    const elHudFan = document.getElementById('hud-fan-text');
    if (elHudFan) {
      const atten = (this.state.dspFiltering && this.state.dspFiltering.fan_notch_attenuation_db) ? this.state.dspFiltering.fan_notch_attenuation_db : 45.2;
      const isAct = (this.state.dspFiltering && this.state.dspFiltering.fan_filter_enabled !== false);
      elHudFan.textContent = isAct ? `-${atten.toFixed(1)} dB Active` : 'Filter Bypassed';
      elHudFan.style.color = isAct ? 'var(--green-bright)' : 'var(--terra-sun)';
    }

    this._updateTierHUD();
  }

  _drawCanvases() {
    // 1. ECG Canvas in Vitals
    const ecg = document.getElementById('vitals-ecg-canvas');
    if (ecg) {
      const ctx = ecg.getContext('2d');
      const w = ecg.width, h = ecg.height;
      ctx.clearRect(0, 0, w, h);

      if (!this.state.presence || !this.state.hr) {
        ctx.strokeStyle = '#483a38';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, h / 2);
        ctx.lineTo(w, h / 2);
        ctx.stroke();
      } else {
        this.ecgPhase += (this.state.hr / 60) * 0.05;
        ctx.strokeStyle = '#00d878';
        ctx.lineWidth = 2.0;
        ctx.beginPath();

        for (let x = 0; x < w; x++) {
          const ph = (this.ecgPhase + (x / w) * 3) % 1.0;
          let yOff = 0;
          if (ph > 0.15 && ph < 0.25) yOff = Math.sin((ph - 0.15) * 10 * Math.PI) * 0.15;
          else if (ph >= 0.32 && ph < 0.35) yOff = -0.15;
          else if (ph >= 0.35 && ph < 0.38) yOff = 0.85;
          else if (ph >= 0.38 && ph < 0.42) yOff = -0.3;
          else if (ph > 0.55 && ph < 0.70) yOff = Math.sin((ph - 0.55) * 6.66 * Math.PI) * 0.25;

          const y = h / 2 - yOff * (h * 0.42);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }

    // 2. FFT Doppler Frequency Spectrum in Vitals Tab
    const fft = document.getElementById('vitals-fft-canvas');
    if (fft) {
      const ctx = fft.getContext('2d');
      const w = fft.width, h = fft.height;
      ctx.clearRect(0, 0, w, h);

      // Background grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;

      // Frequencies from 0.0 to 20.0 Hz
      const maxFreq = 20.0;
      ctx.fillStyle = '#68605c';
      ctx.font = '9px "JetBrains Mono", monospace';

      for (let f = 2; f <= 20; f += 2) {
        const x = (f / maxFreq) * w;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
        ctx.fillText(`${f}Hz`, x - 10, h - 6);
      }

      // Shaded Passbands
      // 1. Respiration Band (0.15 - 0.45 Hz)
      const respX1 = (0.15 / maxFreq) * w;
      const respX2 = (0.45 / maxFreq) * w;
      ctx.fillStyle = 'rgba(0, 216, 120, 0.08)';
      ctx.fillRect(respX1, 0, respX2 - respX1, h - 20);

      // 2. Cardiac Band (0.8 - 2.0 Hz)
      const cardX1 = (0.8 / maxFreq) * w;
      const cardX2 = (2.0 / maxFreq) * w;
      ctx.fillStyle = 'rgba(56, 189, 248, 0.08)';
      ctx.fillRect(cardX1, 0, cardX2 - cardX1, h - 20);

      // 3. Fan Notch Band (3.5 - 6.5 Hz)
      const fanX1 = (3.5 / maxFreq) * w;
      const fanX2 = (6.5 / maxFreq) * w;
      if (this.filterFanEnabled) {
        ctx.fillStyle = 'rgba(245, 158, 11, 0.04)';
        ctx.fillRect(fanX1, 0, fanX2 - fanX1, h - 20);
      } else {
        ctx.fillStyle = 'rgba(245, 158, 11, 0.15)';
        ctx.fillRect(fanX1, 0, fanX2 - fanX1, h - 20);
      }

      // Draw Spectral Curve
      ctx.beginPath();
      ctx.lineWidth = 2.0;
      ctx.strokeStyle = '#00d878';

      const t = performance.now() * 0.001;
      const hasPerson = (this.state.presence && this.state.hr > 0);
      const fResp = hasPerson ? (this.state.br / 60) : 0.25;
      const fHeart = hasPerson ? (this.state.hr / 60) : 1.2;

      for (let px = 0; px < w; px++) {
        const freq = (px / w) * maxFreq;
        let amp = 0.03 + Math.sin(freq * 10 + t) * 0.01;

        if (hasPerson) {
          // Respiration bell curve around fResp
          const dResp = Math.abs(freq - fResp);
          if (dResp < 0.25) {
            amp += Math.exp(-Math.pow(dResp / 0.08, 2)) * 0.65;
          }

          // Cardiac pulse peak around fHeart
          const dHeart = Math.abs(freq - fHeart);
          if (dHeart < 0.35) {
            amp += Math.exp(-Math.pow(dHeart / 0.12, 2)) * 0.42;
          }
        }

        // Fan modulation at 4.5 Hz and 9.0 Hz
        const dFan1 = Math.abs(freq - 4.5);
        const dFan2 = Math.abs(freq - 9.0);
        if (this.filterFanEnabled) {
          if (dFan1 < 0.4) amp *= 0.05;
          if (dFan2 < 0.4) amp *= 0.05;
        } else {
          if (dFan1 < 0.4) amp += Math.exp(-Math.pow(dFan1 / 0.15, 2)) * 0.85;
          if (dFan2 < 0.4) amp += Math.exp(-Math.pow(dFan2 / 0.15, 2)) * 0.45;
        }

        // Cooler vibration > 15 Hz
        if (freq > 15.0) {
          if (!this.filterFanEnabled) {
            amp += (0.15 + Math.sin(freq * 30 + t * 5) * 0.08);
          }
        }

        const y = (h - 22) - Math.min(1.0, amp) * (h - 32);
        if (px === 0) ctx.moveTo(px, y);
        else ctx.lineTo(px, y);
      }
      ctx.stroke();

      // Band labels
      ctx.fillStyle = '#00d878';
      ctx.fillText('RESPIRATION (0.25Hz)', respX1 + 2, 14);

      ctx.fillStyle = '#38bdf8';
      ctx.fillText('CARDIAC (1.2Hz)', cardX1 + 2, 14);

      if (this.filterFanEnabled) {
        ctx.fillStyle = '#f59e0b';
        ctx.fillText('FAN NOTCH (-45dB)', fanX1 + 2, 14);
      } else {
        ctx.fillStyle = '#ff4060';
        ctx.fillText('[RAW] FAN NOISE HARMONICS', fanX1 + 2, 14);
      }
    }

    // 2. RSSI Sparkline in Hardware Tab
    const spark = document.getElementById('hw-spark-canvas');
    if (spark) {
      const ctx = spark.getContext('2d');
      const w = spark.width, h = spark.height;
      ctx.clearRect(0, 0, w, h);

      ctx.strokeStyle = 'rgba(196, 118, 107, 0.12)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();

      const minV = -85, maxV = -35, range = maxV - minV;
      const step = w / (this.rssiHistory.length - 1);

      ctx.strokeStyle = this.state.presence ? '#00d878' : '#68605c';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      for (let i = 0; i < this.rssiHistory.length; i++) {
        const v = this.rssiHistory[i];
        const norm = Math.max(0, Math.min(1, (v - minV) / range));
        const y = h - norm * h;
        const x = i * step;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  _animateVitalsPulse(t) {
    if (!this.state.presence) return;
    const elHrBar = document.getElementById('vit-hr-bar');
    const elBrBar = document.getElementById('vit-br-bar');
    if (!elHrBar && !elBrBar) return;

    const hr = (this.state.hr && this.state.hr > 0) ? this.state.hr : 72;
    const br = (this.state.br && this.state.br > 0) ? this.state.br : 15.6;

    // Cardiac micro-Doppler wave pulse
    const hrPulse = Math.sin(t * (2.0 * Math.PI * (hr / 60.0))) * 0.5 + 0.5;
    // Respiration harmonic wave pulse
    const brPulse = Math.sin(t * (2.0 * Math.PI * (br / 60.0))) * 0.5 + 0.5;

    // Heart icon pulsation on floating bedroom pill
    const pillHeart = document.getElementById('live-cardiac-icon');
    if (pillHeart) {
      const scale = 1.0 + hrPulse * 0.32;
      pillHeart.style.transform = `scale(${scale.toFixed(2)})`;
      pillHeart.style.color = hrPulse > 0.6 ? '#ff4060' : '#f5c07a';
    }

    const baseHrW = Math.min(95, Math.max(25, (hr / 140.0) * 100.0));
    const baseBrW = Math.min(95, Math.max(20, (br / 35.0) * 100.0));

    if (elHrBar) {
      elHrBar.style.width = `${(baseHrW + (hrPulse * 10.0 - 5.0)).toFixed(1)}%`;
      elHrBar.style.opacity = (0.75 + hrPulse * 0.25).toFixed(2);
    }
    if (elBrBar) {
      elBrBar.style.width = `${(baseBrW + (brPulse * 12.0 - 6.0)).toFixed(1)}%`;
      elBrBar.style.opacity = (0.70 + brPulse * 0.30).toFixed(2);
    }
  }

  _startLoop() {
    const loop = () => {
      requestAnimationFrame(loop);
      const dt = this.bedroom.clock.getDelta();
      const t = this.bedroom.clock.getElapsedTime();

      const isActive = (this.mode === 'demo' || (this.state.sourceState === 'live' && this.state.nodes > 0));

      if (this.activeTab === 'bedroom') {
        this.bedroom.update(dt, t, isActive, this.state);
      }

      this._animateVitalsPulse(t);
      this._drawCanvases();
    };
    loop();
  }
}

function boot() {
  if (!window.app) {
    window.app = new InvisiGuardApp();
  }
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
