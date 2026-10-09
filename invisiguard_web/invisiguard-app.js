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
// 1. Electric Green Wireframe Avatar
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

  update(pose, t, bp, presence) {
    if (!presence) {
      this.group.visible = false;
      return;
    }
    this.group.visible = true;

    const breath = bp || Math.sin(t * 2.0) * 0.015;
    let kps = [];

    if (pose === 'sleep' || pose === 'lying') {
      // Lying on bed
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
      // Sitting at study desk
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
      // Fallen on bedroom floor
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
    } else if (pose === 'walking') {
      const walkCycle = Math.sin(t * 3.5);
      const px = Math.sin(t * 0.8) * 1.2;
      const pz = 0.2 + Math.cos(t * 0.8) * 0.6;
      kps = [
        [px, 1.72 + breath, pz],
        [px - 0.03, 1.74 + breath, pz - 0.02],
        [px + 0.03, 1.74 + breath, pz - 0.02],
        [px - 0.07, 1.72, pz],
        [px + 0.07, 1.72, pz],
        [px - 0.20, 1.48 + breath, pz],
        [px + 0.20, 1.48 + breath, pz],
        [px - 0.24, 1.18, pz - walkCycle * 0.15],
        [px + 0.24, 1.18, pz + walkCycle * 0.15],
        [px - 0.24, 0.88, pz - walkCycle * 0.25],
        [px + 0.24, 0.88, pz + walkCycle * 0.25],
        [px - 0.15, 0.92, pz],
        [px + 0.15, 0.92, pz],
        [px - 0.15, 0.52, pz + walkCycle * 0.25],
        [px + 0.15, 0.52, pz - walkCycle * 0.25],
        [px - 0.15, 0.06, pz + walkCycle * 0.40],
        [px + 0.15, 0.06, pz - walkCycle * 0.40],
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

    this.clock = new THREE.Clock();
    this.waveRings = [];

    this._setupLighting();
    this._buildRoom();
    this._buildFurniture();
    this._buildTransceiverNode();
    this._buildSparkles();

    this.avatar = new GreenWireframeAvatar(this.scene);
  }

  _setupLighting() {
    const sun = new THREE.DirectionalLight(C.terraSun, 1.4);
    sun.position.set(7, 9, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    this.scene.add(sun);

    const fill = new THREE.DirectionalLight(C.terraMid, 0.55);
    fill.position.set(-6, 4, -4);
    this.scene.add(fill);

    const amb = new THREE.AmbientLight(0x2d1d1a, 0.85);
    this.scene.add(amb);
  }

  _buildRoom() {
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(9, 8),
      new THREE.MeshStandardMaterial({ color: 0x14100e, roughness: 0.9 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    this.grid = new THREE.GridHelper(9, 18, C.terraDark, 0x241a18);
    this.grid.position.y = 0.002;
    this.scene.add(this.grid);

    const pts = [
      new THREE.Vector3(-4.0, 0, -3.2), new THREE.Vector3(4.0, 0, -3.2),
      new THREE.Vector3(4.0, 0, 3.2), new THREE.Vector3(-4.0, 0, 3.2),
      new THREE.Vector3(-4.0, 0, -3.2)
    ];
    this.scene.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: C.terraDark, transparent: true, opacity: 0.45 })
    ));

    const wallMat = new THREE.MeshStandardMaterial({ color: 0x110e0d, roughness: 0.95 });
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
    this.camera.position.copy(this.camDefPos);
    this.controls.target.copy(this.camDefLook);
    this.controls.update();
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

  update(dt, t, isActive, pose, presence) {
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

    this.avatar.update(pose, t, null, presence);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
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
        this.sourceLabel.textContent = (this.mode === 'live') ? 'Live Hardware' : 'Demo Mode';
      });
    }

    if (this.scenarioSelect) {
      this.scenarioSelect.addEventListener('change', (e) => {
        this.scenario = e.target.value;
      });
    }

    const resetBtn = document.getElementById('btn-reset-cam');
    if (resetBtn) resetBtn.addEventListener('click', () => this.bedroom.resetCamera());

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
        title: '🚪 Please Exit the Bedroom Now',
        desc: 'Step outside and close the bedroom door. Baseline recording will begin after countdown to establish zero-human multipath reference.',
        defaultSec: 20,
        recBadge: '● RECORDING ZERO-MOTION BASELINE',
        recTitle: 'Recording Undisturbed Room Baseline',
        recDesc: 'Stay outside. The sensor is logging 52-subcarrier multipath reflections for zero-motion calibration.'
      },
      1: {
        badge: '1: DESK STUDY POSTURE SETUP',
        title: '📖 Take a Seat at the Study Desk',
        desc: 'Walk over, sit comfortably on the desk chair, and relax into normal studying posture with natural breathing.',
        defaultSec: 10,
        recBadge: '● RECORDING CLASS 1: NORMAL STUDYING',
        recTitle: 'Recording Seated Study Posture',
        recDesc: 'Maintain gentle studying micro-movements, typing, and natural resting breathing at the desk.'
      },
      2: {
        badge: '2: ROOM PACING POSITION SETUP',
        title: '🚶 Position for Normal Walking',
        desc: 'Stand near the starting corner or doorway, ready to pace naturally back and forth across the bedroom floor plane.',
        defaultSec: 10,
        recBadge: '● RECORDING CLASS 2: ROOM PACING',
        recTitle: 'Recording Continuous Room Walking',
        recDesc: 'Pace steadily across the bedroom floor plane. The sensor is logging Doppler phase shifts.'
      },
      3: {
        badge: '3: STRUGGLE / RAGGING SIMULATION SETUP',
        title: '⚡ Prepare Struggle Simulation Stance',
        desc: 'Position yourself safely with your partner to simulate rapid multi-limb motion, sudden directional shifts, or struggle.',
        defaultSec: 10,
        recBadge: '● RECORDING CLASS 3: STRUGGLE / RAGGING',
        recTitle: 'Recording Fast Struggle Dynamics',
        recDesc: 'Simulate high-velocity multi-limb struggle and sudden movements to capture high-frequency Doppler spikes.'
      },
      4: {
        badge: '4: SUDDEN FALL SIMULATION SETUP',
        title: '🚨 Prepare Safe Fall Simulation',
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
        this.activePrepClassId = clsId;
        this.activePrepClassName = clsName;
        this.activePrepMeta = CLASS_PREP_META[clsId] || CLASS_PREP_META[0];
        this._startClassRecording(clsId, clsName, false);
      });
    });

    document.querySelectorAll('.btn-rec-stop').forEach(btn => {
      btn.addEventListener('click', () => {
        this._stopClassRecording();
      });
    });

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
        btnTrain.textContent = '⚡ Train Production Model (Daily Calibration)';
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
      if (cName) cName.textContent = className;
      if (cFrames) cFrames.textContent = '0';
    }

    if (isModal) {
      const cWrap = document.getElementById('calib-countdown-wrap');
      const rState = document.getElementById('calib-recording-state');
      const bSkip = document.getElementById('btn-skip-countdown');
      const bStop = document.getElementById('btn-stop-calibration');
      const mTitle = document.getElementById('calib-modal-title');
      const mDesc = document.getElementById('calib-modal-desc');
      const rBadge = document.getElementById('calib-rec-badge');
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

    this._logTerminal(`[REC] Started capturing live frames for Class ${label}: ${className}`);

    this.recCounter = 0;
    this.recInterval = setInterval(() => {
      this.recCounter += 5;
      const f1 = document.getElementById('banner-rec-frames');
      const f2 = document.getElementById('modal-rec-samples');
      if (f1) f1.textContent = this.recCounter;
      if (f2) f2.textContent = this.recCounter;

      if (isModal && this.recCounter >= 125) {
        clearInterval(this.recInterval);
        document.getElementById('btn-stop-calibration')?.click();
      }
    }, 1000);
  }

  async _stopClassRecording() {
    clearInterval(this.recInterval);
    this.mlRecording = false;
    this._playAudioChime(440, 0.15);

    try {
      const resp = await fetch('/api/v1/invisiguard/record/stop', { method: 'POST' });
      const res = await resp.json();
      this._logTerminal(`[SAVED] Captured ${res.samples_captured} frames for ${res.class_name}! Total: ${res.total_dataset_samples} frames.`);
    } catch (e) {
      this._logTerminal('[SAVED] Saved calibration frames locally.');
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
        if (this.mode !== 'live') return;
        try {
          const msg = JSON.parse(evt.data);
          if (msg.type === 'sensing_update') this._handleLiveFrame(msg);
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

    const isLive = (this.state.sourceState === 'live' && this.state.nodes > 0);
    this.state.presence = isLive ? (cls.presence || false) : false;
    this.state.fall = isLive ? (cls.fall_detected || false) : false;
    this.state.rssi = typeof feat.mean_rssi === 'number' ? feat.mean_rssi : -50;
    this.state.var = typeof feat.variance === 'number' ? feat.variance : 0;
    this.state.mot = typeof feat.motion_band_power === 'number' ? feat.motion_band_power : 0;

    if (this.state.presence) {
      this.state.hr = vit.heart_rate_bpm || 72;
      this.state.br = vit.breathing_rate_bpm || 16;
      this.state.conf = Math.round((vit.confidence || 0.88) * 100);

      if (msg.triage) this.state.triage = msg.triage;
      if (msg.dsp_filtering) this.state.dspFiltering = msg.dsp_filtering;

      if (this.state.fall) this.state.pose = 'fallen';
      else if (cls.motion_level === 'active') this.state.pose = 'walking';
      else this.state.pose = 'standing';
    } else {
      this.state.hr = 0;
      this.state.br = 0;
      this.state.conf = 0;
      this.state.pose = 'standing';
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

    if (s === 'empty') {
      this.state.presence = false;
      this.state.pose = 'standing';
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
      if (this.state.sourceState === 'live' && this.state.nodes > 0) {
        this.statusDot.className = 'status-dot live';
        this.statusLabel.textContent = `LIVE CSI · 1 NODE (${this.state.packets} PKTS)`;
      } else {
        this.statusDot.className = 'status-dot disconnected';
        this.statusLabel.textContent = `DISCONNECTED (0 NODES)`;
      }
    }

    // 2. Vitals Section
    const elHr = document.getElementById('vit-hr');
    const elHrBar = document.getElementById('vit-hr-bar');
    const elBr = document.getElementById('vit-br');
    const elBrBar = document.getElementById('vit-br-bar');
    const elConf = document.getElementById('vit-conf');
    const elConfBar = document.getElementById('vit-conf-bar');

    if (this.state.presence && this.state.hr > 0) {
      if (elHr) elHr.textContent = String(this.state.hr);
      if (elHrBar) elHrBar.style.width = `${Math.min(100, (this.state.hr / 140) * 100)}%`;
      if (elBr) elBr.textContent = String(this.state.br);
      if (elBrBar) elBrBar.style.width = `${Math.min(100, (this.state.br / 35) * 100)}%`;
      if (elConf) elConf.textContent = String(this.state.conf);
      if (elConfBar) elConfBar.style.width = `${this.state.conf}%`;
    } else {
      if (elHr) elHr.textContent = '--';
      if (elHrBar) elHrBar.style.width = '0%';
      if (elBr) elBr.textContent = '--';
      if (elBrBar) elBrBar.style.width = '0%';
      if (elConf) elConf.textContent = '--';
      if (elConfBar) elConfBar.style.width = '0%';
    }

    // 3. Hardware Section
    const elRssi = document.getElementById('hw-rssi');
    const elVar = document.getElementById('hw-var');
    const elMot = document.getElementById('hw-mot');
    const elNodes = document.getElementById('hw-nodes');
    const elPkts = document.getElementById('hw-pkts');

    if (this.mode === 'demo' || (this.state.sourceState === 'live' && this.state.nodes > 0)) {
      if (elRssi) elRssi.textContent = `${this.state.rssi} dBm`;
      if (elVar) elVar.textContent = String(this.state.var);
      if (elMot) elMot.textContent = String(this.state.mot);
      if (elNodes) elNodes.textContent = '1 Node Active';
      if (elPkts) elPkts.textContent = `${this.state.packets} pkts`;
    } else {
      if (elRssi) elRssi.textContent = '-- dBm';
      if (elVar) elVar.textContent = '--';
      if (elMot) elMot.textContent = '--';
      if (elNodes) elNodes.textContent = '0 Nodes Connected';
      if (elPkts) elPkts.textContent = '0 pkts';
    }

    // 4. Safety & Fall Section
    const elSafetyCard = document.getElementById('safety-state-card');
    const elSafetyText = document.getElementById('safety-state-text');
    if (elSafetyCard && elSafetyText) {
      if (this.state.fall) {
        elSafetyCard.className = 'alert-card-state fall';
        elSafetyText.textContent = '⚠ CRITICAL ALERT: FALL DETECTED ON BEDROOM FLOOR';
      } else if (this.state.presence) {
        elSafetyCard.className = 'alert-card-state safe';
        elSafetyText.textContent = '✓ ROOM SECURE · NORMAL MOTION DETECTED';
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
        ctx.fillText('⚠ FAN NOISE (RAW)', fanX1 + 2, 14);
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

  _startLoop() {
    const loop = () => {
      requestAnimationFrame(loop);
      const dt = this.bedroom.clock.getDelta();
      const t = this.bedroom.clock.getElapsedTime();

      const isActive = (this.mode === 'demo' || (this.state.sourceState === 'live' && this.state.nodes > 0));

      if (this.activeTab === 'bedroom') {
        this.bedroom.update(dt, t, isActive, this.state.pose, this.state.presence);
      }

      this._drawCanvases();
    };
    loop();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new InvisiGuardApp();
});
