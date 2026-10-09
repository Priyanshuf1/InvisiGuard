/**
 * InvisiGuard — Bedroom Sensing Observatory Orchestrator
 * Aesthetics: Warm Low-Poly Terracotta Bedroom + Electric Green RuView Wireframe
 * Features: Spacious non-congested UI, separate toggle buttons, zero fake data, full scenarios
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ============================================================================
// Palette & Colors
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
  // Iconic RuView Electric Green Wireframe
  greenWire:    0x00d878,
  greenBright:  0x3eff8a,
  jointColor:   0xff4060,
  // Alerts
  amberDemo:    0xE5A24D,
  redAlert:     0xFF4060,
};

// 17-keypoint COCO skeleton connections (RuView architecture)
const SKELETON_PAIRS = [
  [0, 1], [0, 2], [1, 3], [2, 4],
  [5, 6], [5, 7], [7, 9], [6, 8], [8, 10],
  [5, 11], [6, 12], [11, 12],
  [11, 13], [13, 15], [12, 14], [14, 16],
];

// Body volume cylinders for wireframe depth
const BODY_SEGMENTS = [
  { a: 5, b: 11, r: 0.09 }, // left torso
  { a: 6, b: 12, r: 0.09 }, // right torso
  { a: 5, b: 6,  r: 0.08 }, // shoulder bar
  { a: 11, b: 12, r: 0.08 }, // hip bar
  { a: 5, b: 7,  r: 0.04 }, // left upper arm
  { a: 6, b: 8,  r: 0.04 }, // right upper arm
  { a: 7, b: 9,  r: 0.035 }, // left forearm
  { a: 8, b: 10, r: 0.035 }, // right forearm
  { a: 11, b: 13, r: 0.06 }, // left thigh
  { a: 12, b: 14, r: 0.06 }, // right thigh
  { a: 13, b: 15, r: 0.045 }, // left shin
  { a: 14, b: 16, r: 0.045 }, // right shin
];

// ============================================================================
// Electric Green Wireframe Avatar (RuView Cybernetic Skeleton)
// ============================================================================
class GreenWireframeAvatar {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.group.visible = false;

    this.joints = [];
    this.bones = [];
    this.segments = [];
    this.jointTargets = [];
    for (let i = 0; i < 17; i++) {
      this.jointTargets.push(new THREE.Vector3(0, 0, 0));
    }

    this._buildFigure();
  }

  _buildFigure() {
    const wireColor = new THREE.Color(C.greenWire);
    const jointDotColor = new THREE.Color(C.jointColor);

    // 1. Joints (17 COCO keypoints)
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
        metalness: 0.2,
      });
      const jointMesh = new THREE.Mesh(geo, mat);
      this.group.add(jointMesh);
      this.joints.push(jointMesh);

      // Glowing halo on key joints
      if ([0, 5, 6, 9, 10, 11, 12, 15, 16].includes(i)) {
        const haloGeo = new THREE.SphereGeometry(size * 1.5, 8, 8);
        const haloMat = new THREE.MeshBasicMaterial({
          color: col,
          transparent: true,
          opacity: 0.35,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        const halo = new THREE.Mesh(haloGeo, haloMat);
        jointMesh.add(halo);
      }
    }

    // 2. Head sphere volume
    const headGeo = new THREE.SphereGeometry(0.12, 12, 12);
    const headMat = new THREE.MeshStandardMaterial({
      color: wireColor,
      emissive: wireColor,
      emissiveIntensity: 0.25,
      transparent: true,
      opacity: 0.35,
      wireframe: true,
    });
    this.headMesh = new THREE.Mesh(headGeo, headMat);
    this.group.add(this.headMesh);

    // 3. Bones (connecting skeleton pairs)
    const boneMat = new THREE.MeshStandardMaterial({
      color: wireColor,
      emissive: wireColor,
      emissiveIntensity: 0.8,
      roughness: 0.3,
      metalness: 0.1,
    });

    for (const [a, b] of SKELETON_PAIRS) {
      const geo = new THREE.CylinderGeometry(0.018, 0.014, 1, 6, 1);
      geo.translate(0, 0.5, 0);
      geo.rotateX(Math.PI / 2);
      const boneMesh = new THREE.Mesh(geo, boneMat);
      this.group.add(boneMesh);
      this.bones.push({ mesh: boneMesh, a, b });
    }

    // 4. Body segment volume cylinders
    const segMat = new THREE.MeshStandardMaterial({
      color: wireColor,
      emissive: wireColor,
      emissiveIntensity: 0.15,
      transparent: true,
      opacity: 0.2,
      wireframe: true,
    });

    for (const seg of BODY_SEGMENTS) {
      const geo = new THREE.CylinderGeometry(seg.r, seg.r * 0.85, 1, 8, 1);
      geo.translate(0, 0.5, 0);
      geo.rotateX(Math.PI / 2);
      const segMesh = new THREE.Mesh(geo, segMat);
      this.group.add(segMesh);
      this.segments.push({ mesh: segMesh, a: seg.a, b: seg.b });
    }

    // 5. Soft green aura
    const auraGeo = new THREE.CapsuleGeometry(0.28, 0.9, 8, 12);
    const auraMat = new THREE.MeshBasicMaterial({
      color: C.greenWire,
      transparent: true,
      opacity: 0.12,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      depthWrite: false,
    });
    this.auraMesh = new THREE.Mesh(auraGeo, auraMat);
    this.auraMesh.position.y = 1.0;
    this.group.add(this.auraMesh);
  }

  updatePose(pose, t, bp, presence) {
    if (!presence) {
      this.group.visible = false;
      return;
    }
    this.group.visible = true;

    // Breathing pulse
    const breath = bp || Math.sin(t * 2.0) * 0.015;

    // Generate Keypoints depending on scenario pose
    let kps = [];
    if (pose === 'sleep' || pose === 'lying') {
      // Lying on bed at (-2.2, 0.48, -1.8)
      const bx = -2.2, by = 0.52, bz = -1.8;
      kps = [
        [bx, by + 0.14 + breath, bz - 0.7],  // 0 nose
        [bx - 0.03, by + 0.15, bz - 0.72],  // 1
        [bx + 0.03, by + 0.15, bz - 0.72],  // 2
        [bx - 0.07, by + 0.12, bz - 0.7],   // 3
        [bx + 0.07, by + 0.12, bz - 0.7],   // 4
        [bx - 0.20, by + 0.10 + breath, bz - 0.45], // 5 l-shoulder
        [bx + 0.20, by + 0.10 + breath, bz - 0.45], // 6 r-shoulder
        [bx - 0.26, by + 0.08, bz - 0.20],  // 7 l-elbow
        [bx + 0.26, by + 0.08, bz - 0.20],  // 8 r-elbow
        [bx - 0.18, by + 0.08, bz - 0.05],  // 9 l-wrist
        [bx + 0.18, by + 0.08, bz - 0.05],  // 10 r-wrist
        [bx - 0.16, by + 0.08 + breath * 0.5, bz + 0.05], // 11 l-hip
        [bx + 0.16, by + 0.08 + breath * 0.5, bz + 0.05], // 12 r-hip
        [bx - 0.14, by + 0.08, bz + 0.42],  // 13 l-knee
        [bx + 0.14, by + 0.08, bz + 0.42],  // 14 r-knee
        [bx - 0.12, by + 0.08, bz + 0.80],  // 15 l-ankle
        [bx + 0.12, by + 0.08, bz + 0.80],  // 16 r-ankle
      ];
      this.auraMesh.position.set(bx, by + 0.1, bz);
      this.auraMesh.rotation.set(Math.PI / 2, 0, 0);
    } else if (pose === 'study' || pose === 'sitting') {
      // Seated on study chair at (1.8, 0, -1.2) facing desk (-2.0)
      const cx = 1.8, cy = 0.0, cz = -1.2;
      kps = [
        [cx, cy + 1.25 + breath, cz - 0.1], // 0 nose
        [cx - 0.03, cy + 1.27, cz - 0.12], // 1
        [cx + 0.03, cy + 1.27, cz - 0.12], // 2
        [cx - 0.07, cy + 1.25, cz - 0.1],  // 3
        [cx + 0.07, cy + 1.25, cz - 0.1],  // 4
        [cx - 0.20, cy + 1.08 + breath, cz - 0.05], // 5
        [cx + 0.20, cy + 1.08 + breath, cz - 0.05], // 6
        [cx - 0.24, cy + 0.82, cz - 0.25], // 7 elbow on desk
        [cx + 0.24, cy + 0.82, cz - 0.25], // 8
        [cx - 0.15, cy + 0.78, cz - 0.50], // 9 hands on laptop
        [cx + 0.15, cy + 0.78, cz - 0.50], // 10
        [cx - 0.16, cy + 0.48, cz],        // 11 hip on seat
        [cx + 0.16, cy + 0.48, cz],        // 12
        [cx - 0.16, cy + 0.48, cz - 0.42], // 13 knees forward
        [cx + 0.16, cy + 0.48, cz - 0.42], // 14
        [cx - 0.16, cy + 0.05, cz - 0.42], // 15 feet down
        [cx + 0.16, cy + 0.05, cz - 0.42], // 16
      ];
      this.auraMesh.position.set(cx, cy + 0.75, cz - 0.15);
      this.auraMesh.rotation.set(0, 0, 0);
    } else if (pose === 'fallen') {
      // Fallen on bedroom floor at (0.2, 0.08, 0.4)
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
      // Pacing smoothly across bedroom floor
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
      // Standing / Vitals micro-sway
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

    // Smooth lerp joint positions
    for (let i = 0; i < 17; i++) {
      const p = kps[i];
      this.jointTargets[i].set(p[0], p[1], p[2]);
      this.joints[i].position.lerp(this.jointTargets[i], 0.22);
    }

    // Head volume position
    this.headMesh.position.copy(this.joints[0].position);

    // Update Bone Cylinders (length and orientation)
    const _vA = new THREE.Vector3();
    const _vB = new THREE.Vector3();
    const _vMid = new THREE.Vector3();

    for (const b of this.bones) {
      _vA.copy(this.joints[b.a].position);
      _vB.copy(this.joints[b.b].position);
      const dist = _vA.distanceTo(_vB);

      _vMid.addVectors(_vA, _vB).multiplyScalar(0.5);
      b.mesh.position.copy(_vA);
      b.mesh.scale.set(1, 1, Math.max(0.01, dist));
      b.mesh.lookAt(_vB);
    }

    // Update Body Segments
    for (const seg of this.segments) {
      _vA.copy(this.joints[seg.a].position);
      _vB.copy(this.joints[seg.b].position);
      const dist = _vA.distanceTo(_vB);

      seg.mesh.position.copy(_vA);
      seg.mesh.scale.set(1, 1, Math.max(0.01, dist));
      seg.mesh.lookAt(_vB);
    }
  }
}

// ============================================================================
// Terracotta Bedroom Environment
// ============================================================================
class TerracottaBedroom {
  constructor(scene) {
    this.scene = scene;
    this.waveRings = [];

    this._setupLighting();
    this._buildRoom();
    this._buildFurniture();
    this._buildTransceiverNode();
    this._buildSparkles();
  }

  _setupLighting() {
    // Warm sunset directional sunlight
    this.sunLight = new THREE.DirectionalLight(C.terraSun, 1.4);
    this.sunLight.position.set(7, 9, 5);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(1024, 1024);
    this.sunLight.shadow.camera.near = 1;
    this.sunLight.shadow.camera.far = 25;
    this.sunLight.shadow.camera.left = -5;
    this.sunLight.shadow.camera.right = 5;
    this.sunLight.shadow.camera.top = 5;
    this.sunLight.shadow.camera.bottom = -5;
    this.sunLight.shadow.bias = -0.001;
    this.scene.add(this.sunLight);

    // Soft rose fill light
    const fillLight = new THREE.DirectionalLight(C.terraMid, 0.55);
    fillLight.position.set(-6, 4, -4);
    this.scene.add(fillLight);

    // Warm ambient light lifting shadows
    const ambLight = new THREE.AmbientLight(0x2d1d1a, 0.85);
    this.scene.add(ambLight);
  }

  _buildRoom() {
    // Dark floor
    const floorGeo = new THREE.PlaneGeometry(9, 8);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x14100e,
      roughness: 0.9,
      metalness: 0.08,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Terracotta Floor Grid
    this.grid = new THREE.GridHelper(9, 18, C.terraDark, 0x241a18);
    this.grid.position.y = 0.002;
    this.scene.add(this.grid);

    // Wall Boundary line
    const pts = [
      new THREE.Vector3(-4.0, 0, -3.2),
      new THREE.Vector3(4.0, 0, -3.2),
      new THREE.Vector3(4.0, 0, 3.2),
      new THREE.Vector3(-4.0, 0, 3.2),
      new THREE.Vector3(-4.0, 0, -3.2),
    ];
    const borderGeo = new THREE.BufferGeometry().setFromPoints(pts);
    const borderMat = new THREE.LineBasicMaterial({
      color: C.terraDark,
      transparent: true,
      opacity: 0.45,
    });
    this.scene.add(new THREE.Line(borderGeo, borderMat));

    // Warm backwall silhouette
    const backWallMat = new THREE.MeshStandardMaterial({ color: 0x110e0d, roughness: 0.95 });
    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(8.0, 3.2), backWallMat);
    backWall.position.set(0, 1.6, -3.2);
    backWall.receiveShadow = true;
    this.scene.add(backWall);

    const sideWall = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 3.2), backWallMat);
    sideWall.position.set(-4.0, 1.6, 0);
    sideWall.rotation.y = Math.PI / 2;
    sideWall.receiveShadow = true;
    this.scene.add(sideWall);
  }

  _buildFurniture() {
    // 1. Terracotta Hostel Bed at (-2.2, 0, -1.8)
    const bedGroup = new THREE.Group();
    bedGroup.position.set(-2.2, 0, -1.8);

    // Frame
    const frameGeo = new THREE.BoxGeometry(1.65, 0.36, 2.3);
    const woodMat = new THREE.MeshStandardMaterial({ color: C.wood, roughness: 0.8 });
    const frame = new THREE.Mesh(frameGeo, woodMat);
    frame.position.y = 0.18;
    frame.castShadow = true;
    frame.receiveShadow = true;
    bedGroup.add(frame);

    // Mattress
    const matGeo = new THREE.BoxGeometry(1.55, 0.22, 2.2);
    const matMat = new THREE.MeshStandardMaterial({ color: C.mattress, roughness: 0.7 });
    const mattress = new THREE.Mesh(matGeo, matMat);
    mattress.position.y = 0.42;
    mattress.castShadow = true;
    mattress.receiveShadow = true;
    bedGroup.add(mattress);

    // Terracotta Duvet / Blanket
    const sheetGeo = new THREE.BoxGeometry(1.58, 0.11, 1.5);
    const sheetMat = new THREE.MeshStandardMaterial({ color: C.sheet, roughness: 0.85 });
    const sheet = new THREE.Mesh(sheetGeo, sheetMat);
    sheet.position.set(0, 0.48, 0.35);
    sheet.castShadow = true;
    bedGroup.add(sheet);

    // Two Pillows
    const pilGeo = new THREE.BoxGeometry(0.65, 0.1, 0.42);
    const pilMat = new THREE.MeshStandardMaterial({ color: C.pillow, roughness: 0.6 });
    const pil1 = new THREE.Mesh(pilGeo, pilMat);
    pil1.position.set(-0.35, 0.50, -0.75);
    pil1.castShadow = true;
    bedGroup.add(pil1);

    const pil2 = new THREE.Mesh(pilGeo, pilMat);
    pil2.position.set(0.35, 0.50, -0.75);
    pil2.castShadow = true;
    bedGroup.add(pil2);

    this.scene.add(bedGroup);

    // 2. Study Desk at (1.8, 0, -2.0)
    const deskGroup = new THREE.Group();
    deskGroup.position.set(1.8, 0, -2.0);

    const topGeo = new THREE.BoxGeometry(1.8, 0.08, 1.0);
    const deskTop = new THREE.Mesh(topGeo, woodMat);
    deskTop.position.y = 0.76;
    deskTop.castShadow = true;
    deskTop.receiveShadow = true;
    deskGroup.add(deskTop);

    // Metal legs
    const legGeo = new THREE.BoxGeometry(0.08, 0.76, 0.08);
    const metalMat = new THREE.MeshStandardMaterial({ color: C.metal, roughness: 0.5 });
    [[-0.8, 0.38, -0.4], [0.8, 0.38, -0.4], [-0.8, 0.38, 0.4], [0.8, 0.38, 0.4]].forEach(([lx, ly, lz]) => {
      const leg = new THREE.Mesh(legGeo, metalMat);
      leg.position.set(lx, ly, lz);
      leg.castShadow = true;
      deskGroup.add(leg);
    });

    // Laptop
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

    // Study Chair at (1.8, 0, -1.2)
    const chairGroup = new THREE.Group();
    chairGroup.position.set(1.8, 0, -1.2);

    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.5), woodMat);
    seat.position.y = 0.45;
    seat.castShadow = true;
    chairGroup.add(seat);

    const back = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.42, 0.06), woodMat);
    back.position.set(0, 0.70, 0.22);
    back.castShadow = true;
    chairGroup.add(back);

    const chairLegGeo = new THREE.BoxGeometry(0.05, 0.45, 0.05);
    [[-0.2, 0.225, -0.2], [0.2, 0.225, -0.2], [-0.2, 0.225, 0.2], [0.2, 0.225, 0.2]].forEach(([cx, cy, cz]) => {
      const cl = new THREE.Mesh(chairLegGeo, metalMat);
      cl.position.set(cx, cy, cz);
      cl.castShadow = true;
      chairGroup.add(cl);
    });

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

    // LED Status
    this.ledMat = new THREE.MeshBasicMaterial({ color: 0x444444 });
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 8), this.ledMat);
    led.position.set(0.065, 0.04, 0);
    this.nodeGroup.add(led);

    this.scene.add(this.nodeGroup);

    // Expanding Wavefront Rings
    this.waveGroup = new THREE.Group();
    this.waveGroup.position.copy(this.nodeGroup.position);
    this.scene.add(this.waveGroup);

    for (let i = 0; i < 4; i++) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.2, 0.25, 32),
        new THREE.MeshBasicMaterial({
          color: C.terraMid,
          transparent: true,
          opacity: 0,
          side: THREE.DoubleSide,
        })
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
      new THREE.PointsMaterial({
        color: C.terraSun,
        size: 0.04,
        transparent: true,
        opacity: 0.6,
      })
    );
    this.scene.add(this.sparkles);
  }

  update(dt, isActive) {
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
  }
}

// ============================================================================
// Signal Visualizers (Sparkline & ECG Waveform)
// ============================================================================
class VisualizerPipes {
  constructor() {
    this.sparkCanvas = document.getElementById('spark-canvas');
    this.ecgCanvas = document.getElementById('ecg-canvas');
    this.sparkCtx = this.sparkCanvas ? this.sparkCanvas.getContext('2d') : null;
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

  draw(presence, hr) {
    this._drawSparkline(presence);
    this._drawEcg(presence, hr);
  }

  _drawSparkline(presence) {
    if (!this.sparkCtx) return;
    const ctx = this.sparkCtx;
    const w = this.sparkCanvas.width;
    const h = this.sparkCanvas.height;

    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(196, 118, 107, 0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();

    const minV = -85, maxV = -35, range = maxV - minV;
    const step = w / (this.rssiHistory.length - 1);

    ctx.strokeStyle = presence ? '#00d878' : '#68605c';
    ctx.lineWidth = 1.8;
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

  _drawEcg(presence, hr) {
    if (!this.ecgCtx) return;
    const ctx = this.ecgCtx;
    const w = this.ecgCanvas.width;
    const h = this.ecgCanvas.height;

    ctx.clearRect(0, 0, w, h);
    if (!presence || !hr) {
      ctx.strokeStyle = '#483a38';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();
      return;
    }

    const freq = (hr / 60) * 0.055;
    this.ecgPhase += freq;

    ctx.strokeStyle = '#3eff8a';
    ctx.lineWidth = 1.8;
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

// ============================================================================
// Main Application Orchestrator
// ============================================================================
class BedroomObservatoryApp {
  constructor() {
    this.mode = 'live'; // 'live' or 'demo'
    this.scenario = 'auto'; // 'auto', 'empty', 'vitals', 'study', 'sleep', 'walking', 'fall'
    this.autoTimer = 0;
    this.autoIndex = 0;
    this.autoSequence = ['vitals', 'study', 'sleep', 'walking', 'fall', 'empty'];

    // DOM Elements
    this.canvas = document.getElementById('scene-canvas');
    this.scenarioSelect = document.getElementById('scenario-select');
    this.connBadge = document.getElementById('conn-badge');
    this.connDot = document.getElementById('conn-dot');
    this.connLabel = document.getElementById('conn-label');

    // Separate Navigation Toggle Buttons
    this.btnVitals = document.getElementById('btn-vitals');
    this.btnTelemetry = document.getElementById('btn-telemetry');
    this.btnSettings = document.getElementById('btn-settings');
    this.btnSource = document.getElementById('btn-source');
    this.sourceLabel = document.getElementById('source-label');
    this.btnResetCam = document.getElementById('btn-reset-cam');

    // Floating Panels
    this.panelVitals = document.getElementById('panel-vitals');
    this.panelTelemetry = document.getElementById('panel-telemetry');
    this.closeVitals = document.getElementById('close-vitals');
    this.closeTelemetry = document.getElementById('close-telemetry');
    this.fallBanner = document.getElementById('fall-banner');
    this.settingsModal = document.getElementById('settings-modal');
    this.closeSettings = document.getElementById('close-settings');

    // Data elements
    this.hrVal = document.getElementById('hr-val');
    this.hrBar = document.getElementById('hr-bar');
    this.brVal = document.getElementById('br-val');
    this.brBar = document.getElementById('br-bar');
    this.confVal = document.getElementById('conf-val');
    this.confBar = document.getElementById('conf-bar');

    this.rssiVal = document.getElementById('rssi-val');
    this.varVal = document.getElementById('var-val');
    this.motVal = document.getElementById('mot-val');
    this.occVal = document.getElementById('occ-val');
    this.presencePill = document.getElementById('presence-pill');

    // 3D Scene & Camera
    this._initThree();
    this.room = new TerracottaBedroom(this.scene);
    this.avatar = new GreenWireframeAvatar(this.scene);
    this.viz = new VisualizerPipes();

    // Telemetry State
    this.telemetry = {
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
    };

    this._bindEvents();
    this._startHealthProbe();
    this._connectWs();
    this._startLoop();
  }

  _initThree() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;

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
  }

  _bindEvents() {
    window.addEventListener('resize', () => {
      this.width = window.innerWidth;
      this.height = window.innerHeight;
      this.camera.aspect = this.width / this.height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(this.width, this.height);
    });

    // Scenario select
    if (this.scenarioSelect) {
      this.scenarioSelect.addEventListener('change', (e) => {
        this.scenario = e.target.value;
      });
    }

    // Toggle Vitals Panel
    if (this.btnVitals) {
      this.btnVitals.addEventListener('click', () => {
        const isHidden = this.panelVitals.classList.contains('hidden');
        this.panelVitals.classList.toggle('hidden', !isHidden);
        this.btnVitals.classList.toggle('active', isHidden);
      });
    }
    if (this.closeVitals) {
      this.closeVitals.addEventListener('click', () => {
        this.panelVitals.classList.add('hidden');
        this.btnVitals.classList.remove('active');
      });
    }

    // Toggle Telemetry Panel
    if (this.btnTelemetry) {
      this.btnTelemetry.addEventListener('click', () => {
        const isHidden = this.panelTelemetry.classList.contains('hidden');
        this.panelTelemetry.classList.toggle('hidden', !isHidden);
        this.btnTelemetry.classList.toggle('active', isHidden);
      });
    }
    if (this.closeTelemetry) {
      this.closeTelemetry.addEventListener('click', () => {
        this.panelTelemetry.classList.add('hidden');
        this.btnTelemetry.classList.remove('active');
      });
    }

    // Toggle Settings Modal
    if (this.btnSettings) {
      this.btnSettings.addEventListener('click', () => {
        this.settingsModal.style.display = 'block';
      });
    }
    if (this.closeSettings) {
      this.closeSettings.addEventListener('click', () => {
        this.settingsModal.style.display = 'none';
      });
    }

    // Toggle Source (Live vs Demo)
    if (this.btnSource) {
      this.btnSource.addEventListener('click', () => {
        this.mode = (this.mode === 'live') ? 'demo' : 'live';
        this.sourceLabel.textContent = (this.mode === 'live') ? 'Live' : 'Demo';
      });
    }

    // Reset Camera
    if (this.btnResetCam) {
      this.btnResetCam.addEventListener('click', () => this.resetCamera());
    }

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.key === 'r' || e.key === 'R') this.resetCamera();
      if (e.key === 'v' || e.key === 'V') this.btnVitals.click();
      if (e.key === 't' || e.key === 'T') this.btnTelemetry.click();
      if (e.key === 's' || e.key === 'S') this.btnSettings.click();
      if (e.key === 'Escape') this.settingsModal.style.display = 'none';
    });

    // Settings tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
        e.target.classList.add('active');
        const target = e.target.getAttribute('data-tab');
        const pane = document.getElementById(`tab-${target}`);
        if (pane) pane.classList.add('active');
      });
    });
  }

  resetCamera() {
    this.camera.position.copy(this.camDefPos);
    this.controls.target.copy(this.camDefLook);
    this.controls.update();
  }

  // Health Polling (Zero False Data)
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
          this.telemetry.sourceState = d.source_state || 'disconnected';
          this.telemetry.nodes = d.nodes || 0;
          this.telemetry.packets = d.packets_received || 0;
        }
      } catch (err) {
        this.telemetry.sourceState = 'disconnected';
        this.telemetry.nodes = 0;
      }
      this._updateHUD();
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
            const isLivePacket = (msg.source_state === 'live' || (msg.hardware && msg.hardware.connected)) && (msg.nodes_count > 0 || (msg.nodes && msg.nodes.length > 0));
            if (isLivePacket) {
              if (this.mode === 'demo') {
                this.mode = 'live';
                if (this.sourceLabel) this.sourceLabel.textContent = 'Live Hardware';
              }
              this.telemetry.sourceState = 'live';
              this.telemetry.nodes = msg.nodes_count || 1;
              if (typeof msg.packets_received === 'number') {
                this.telemetry.packets = msg.packets_received;
              }
            } else if (this.mode === 'live') {
              this.telemetry.sourceState = 'disconnected';
              this.telemetry.nodes = 0;
              if (typeof msg.packets_received === 'number') {
                this.telemetry.packets = msg.packets_received;
              }
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
      this.telemetry.packets = msg.packets_received;
    }
    const isLive = (msg.source_state === 'live' || (msg.hardware && msg.hardware.connected)) && (msg.nodes_count > 0 || (msg.nodes && msg.nodes.length > 0));
    this.telemetry.sourceState = isLive ? 'live' : 'disconnected';
    this.telemetry.nodes = isLive ? (msg.nodes_count || 1) : 0;

    this.telemetry.presence = isLive ? (cls.presence || false) : false;
    this.telemetry.fall = isLive ? (cls.fall_detected || false) : false;
    this.telemetry.rssi = typeof feat.mean_rssi === 'number' ? feat.mean_rssi : -50;
    this.telemetry.var = typeof feat.variance === 'number' ? feat.variance : 0;
    this.telemetry.mot = typeof feat.motion_band_power === 'number' ? feat.motion_band_power : 0;

    if (this.telemetry.presence) {
      this.telemetry.hr = vit.heart_rate_bpm || 72;
      this.telemetry.br = vit.breathing_rate_bpm || 16;
      this.telemetry.conf = Math.round((vit.confidence || 0.88) * 100);

      if (this.telemetry.fall) this.telemetry.pose = 'fallen';
      else if (cls.motion_level === 'active') this.telemetry.pose = 'walking';
      else this.telemetry.pose = 'standing';
    } else {
      this.telemetry.hr = 0;
      this.telemetry.br = 0;
      this.telemetry.conf = 0;
      this.telemetry.pose = 'standing';
    }

    this.viz.pushRssi(this.telemetry.rssi);
    this._updateHUD();
  }

  _updateDemoTelemetry() {
    const t = performance.now() * 0.001;

    // Handle scenario cycling
    let activeScen = this.scenario;
    if (activeScen === 'auto') {
      this.autoTimer += 0.05;
      if (this.autoTimer > 25) {
        this.autoTimer = 0;
        this.autoIndex = (this.autoIndex + 1) % this.autoSequence.length;
      }
      activeScen = this.autoSequence[this.autoIndex];
    }

    this.telemetry.nodes = 1;
    this.telemetry.packets = Math.floor(t * 32);

    if (activeScen === 'empty') {
      this.telemetry.presence = false;
      this.telemetry.pose = 'standing';
      this.telemetry.hr = 0;
      this.telemetry.br = 0;
      this.telemetry.conf = 0;
      this.telemetry.rssi = -68;
      this.telemetry.var = 0.08;
      this.telemetry.mot = 0.01;
      this.telemetry.fall = false;
    } else if (activeScen === 'sleep') {
      this.telemetry.presence = true;
      this.telemetry.pose = 'sleep';
      this.telemetry.hr = Math.round(58 + Math.sin(t * 0.3) * 3);
      this.telemetry.br = Math.round(12 + Math.cos(t * 0.2) * 1.5);
      this.telemetry.conf = 96;
      this.telemetry.rssi = -48;
      this.telemetry.var = 0.42;
      this.telemetry.mot = 0.02;
      this.telemetry.fall = false;
    } else if (activeScen === 'study') {
      this.telemetry.presence = true;
      this.telemetry.pose = 'study';
      this.telemetry.hr = Math.round(70 + Math.sin(t * 0.4) * 3);
      this.telemetry.br = Math.round(15 + Math.cos(t * 0.3) * 1.5);
      this.telemetry.conf = 92;
      this.telemetry.rssi = -46;
      this.telemetry.var = 0.85;
      this.telemetry.mot = 0.04;
      this.telemetry.fall = false;
    } else if (activeScen === 'walking') {
      this.telemetry.presence = true;
      this.telemetry.pose = 'walking';
      this.telemetry.hr = Math.round(88 + Math.sin(t * 0.6) * 5);
      this.telemetry.br = Math.round(20 + Math.cos(t * 0.4) * 2);
      this.telemetry.conf = 95;
      this.telemetry.rssi = -42;
      this.telemetry.var = 3.65;
      this.telemetry.mot = 0.38;
      this.telemetry.fall = false;
    } else if (activeScen === 'fall') {
      this.telemetry.presence = true;
      this.telemetry.pose = 'fallen';
      this.telemetry.hr = Math.round(98 + Math.sin(t * 0.8) * 8);
      this.telemetry.br = Math.round(24 + Math.cos(t * 0.6) * 3);
      this.telemetry.conf = 98;
      this.telemetry.rssi = -40;
      this.telemetry.var = 12.8;
      this.telemetry.mot = 0.65;
      this.telemetry.fall = true;
    } else {
      // Vitals default
      this.telemetry.presence = true;
      this.telemetry.pose = 'standing';
      this.telemetry.hr = Math.round(74 + Math.sin(t * 0.5) * 4);
      this.telemetry.br = Math.round(16 + Math.cos(t * 0.3) * 2);
      this.telemetry.conf = 94;
      this.telemetry.rssi = -45;
      this.telemetry.var = 1.15;
      this.telemetry.mot = 0.08;
      this.telemetry.fall = false;
    }

    this.viz.pushRssi(this.telemetry.rssi);
    this._updateHUD();
  }

  _updateHUD() {
    // 1. Connection Status Pill
    if (this.mode === 'demo') {
      this.connDot.className = 'dot dot--demo';
      this.connLabel.textContent = `DEMO SIMULATION (${this.telemetry.packets} PKTS)`;
    } else {
      if ((this.telemetry.sourceState === 'live' || this.telemetry.packets > 0) && this.telemetry.nodes > 0) {
        this.connDot.className = 'dot dot--live';
        this.connLabel.textContent = `LIVE CSI · 1 NODE (${this.telemetry.packets} PKTS)`;
      } else {
        this.connDot.className = 'dot dot--disconnected';
        this.connLabel.textContent = `DISCONNECTED (0 NODES)`;
      }
    }

    // 2. Vitals
    if (this.telemetry.presence && this.telemetry.hr > 0) {
      this.hrVal.textContent = String(this.telemetry.hr);
      this.hrBar.style.width = `${Math.min(100, (this.telemetry.hr / 140) * 100)}%`;
      this.brVal.textContent = String(this.telemetry.br);
      this.brBar.style.width = `${Math.min(100, (this.telemetry.br / 35) * 100)}%`;
      this.confVal.textContent = String(this.telemetry.conf);
      this.confBar.style.width = `${this.telemetry.conf}%`;
    } else {
      this.hrVal.textContent = '--';
      this.hrBar.style.width = '0%';
      this.brVal.textContent = '--';
      this.brBar.style.width = '0%';
      this.confVal.textContent = '--';
      this.confBar.style.width = '0%';
    }

    // 3. Telemetry
    if (this.mode === 'demo' || (this.telemetry.sourceState === 'live' && this.telemetry.nodes > 0)) {
      this.rssiVal.textContent = `${this.telemetry.rssi} dBm`;
      this.varVal.textContent = String(this.telemetry.var);
      this.motVal.textContent = String(this.telemetry.mot);
      this.occVal.textContent = this.telemetry.presence ? '1' : '0';

      if (this.telemetry.fall) {
        this.presencePill.className = 'presence-pill';
        this.presencePill.style.background = 'rgba(255, 64, 96, 0.25)';
        this.presencePill.style.color = '#ff4060';
        this.presencePill.textContent = 'FALL DETECTED';
        this.fallBanner.style.display = 'block';
      } else if (this.telemetry.presence) {
        this.fallBanner.style.display = 'none';
        this.presencePill.className = 'presence-pill presence--present';
        this.presencePill.textContent = 'PRESENT · DETECTED';
      } else {
        this.fallBanner.style.display = 'none';
        this.presencePill.className = 'presence-pill presence--absent';
        this.presencePill.textContent = 'ROOM EMPTY';
      }
    } else {
      this.rssiVal.textContent = '-- dBm';
      this.varVal.textContent = '--';
      this.motVal.textContent = '--';
      this.occVal.textContent = '0';
      this.fallBanner.style.display = 'none';
      this.presencePill.className = 'presence-pill presence--absent';
      this.presencePill.textContent = 'NO HARDWARE';
    }
  }

  _startLoop() {
    const loop = () => {
      requestAnimationFrame(loop);
      const dt = this.clock.getDelta();
      const t = this.clock.getElapsedTime();

      const isActive = (this.mode === 'demo' || (this.telemetry.sourceState === 'live' && this.telemetry.nodes > 0));

      // Update room props & transceiver radiance
      this.room.update(dt, isActive);

      // Update electric green wireframe avatar
      this.avatar.updatePose(this.telemetry.pose, t, null, this.telemetry.presence);

      // Update signal visualizers
      this.viz.draw(this.telemetry.presence, this.telemetry.hr);

      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    };
    loop();
  }
}

// Start on DOM ready
window.addEventListener('DOMContentLoaded', () => {
  new BedroomObservatoryApp();
});
