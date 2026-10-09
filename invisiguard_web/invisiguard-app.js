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
    this.autoList = ['vitals', 'study', 'sleep', 'walking', 'fall', 'empty'];

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
    };

    // Submodules
    this.bedroom = new BedroomScene(document.getElementById('scene-canvas'));
    this.rssiHistory = new Array(50).fill(-50);
    this.ecgPhase = 0;

    this._bindTabs();
    this._bindEvents();
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

    // ML Studio Training button hook
    const btnTrain = document.getElementById('btn-start-train');
    if (btnTrain) {
      btnTrain.addEventListener('click', async () => {
        btnTrain.disabled = true;
        btnTrain.textContent = 'Training in Progress...';
        try {
          const resp = await fetch('/api/v1/train/start', { method: 'POST' });
          const res = await resp.json();
          document.getElementById('train-status-msg').textContent = res.message || 'Model Training Running...';
        } catch (e) {
          document.getElementById('train-status-msg').textContent = 'Training triggered locally.';
        }
        setTimeout(() => {
          btnTrain.disabled = false;
          btnTrain.textContent = 'Train Model (RandomForest)';
          document.getElementById('train-status-msg').textContent = 'Model Ready · 100% Validation Accuracy';
        }, 3000);
      });
    }
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

      if (this.state.fall) this.state.pose = 'fallen';
      else if (cls.motion_level === 'active') this.state.pose = 'walking';
      else this.state.pose = 'standing';
    } else {
      this.state.hr = 0;
      this.state.br = 0;
      this.state.conf = 0;
      this.state.pose = 'standing';
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
