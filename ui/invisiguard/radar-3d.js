/**
 * InvisiGuard — 3D Interactive Room & RF Radar Hologram Engine
 * Implemented with Three.js WebGL (Vanilla JS)
 *
 * Visualizes:
 * - 3D Wireframe Room Bounding Box & Floor Grid
 * - 3 ESP32 Mesh Beacons (Node 1 Tx, Node 2 Rx, Node 3 Rx)
 * - Dynamic Multipath Radar Wavefront Ripples
 * - Traveling RF Photon Packets between Node Beams
 * - Dynamic Human RF Silhouette & Skeleton responding to telemetry postures:
 *   (Seated Study, Walking/Pacing, Violent Struggle, Fall on Floor, Empty)
 */

class Radar3DEngine {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.renderer = null;
        this.scene = null;
        this.camera = null;
        this.animFrameId = null;
        this.isDestroyed = false;

        // View options
        this.showRipples = true;
        this.showBeams = true;

        // Mouse Drag Orbit Control
        this.isDragging = false;
        this.prevMouse = { x: 0, y: 0 };
        this.camDistance = 7.5;
        this.camTheta = 0.75; // Azimuth
        this.camPhi = 0.85;   // Polar elevation
        this.targetLookAt = new THREE.Vector3(2.5, 1.2, 2.0);

        // Nodes coordinates in room [X, Y, Z]
        this.nodePositions = [
            new THREE.Vector3(0.4, 1.4, 0.4),  // Node 1: Entrance / Tx
            new THREE.Vector3(4.6, 1.2, 0.8),  // Node 2: Desk / Rx
            new THREE.Vector3(4.2, 1.2, 3.6),  // Node 3: Bed / Rx
        ];

        // Wavefront rings
        this.wavefrontRings = [];
        this.maxRings = 4;

        // Photon particles traveling on beams
        this.photons = [];

        // Dynamic Human Avatar Parts
        this.avatarGroup = null;
        this.avatarJoints = {};
        this.currentPoseState = 'normal'; // 'normal', 'pacing', 'struggle', 'fall', 'inactivity', 'empty'
        this.avatarPosition = new THREE.Vector3(2.5, 0.85, 2.0);
        this.targetAvatarPos = new THREE.Vector3(2.5, 0.85, 2.0);

        // Limbs & Joint Meshes
        this.lArmLine = null;
        this.rArmLine = null;
        this.lLegLine = null;
        this.rLegLine = null;
        this.lArmGeom = null;
        this.rArmGeom = null;
        this.lLegGeom = null;
        this.rLegGeom = null;
        this.jointMeshes = [];
        this.abortController = null;

        // Clocks & timing
        this.clock = new THREE.Clock();

        this._init();
    }

    _init() {
        if (!this.canvas || typeof THREE === 'undefined') {
            console.error('[Radar3D] Canvas or THREE not available');
            return;
        }

        const width = this.canvas.parentElement.clientWidth || 600;
        const height = this.canvas.parentElement.clientHeight || 380;

        // 1. Scene
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.FogExp2(0x05080e, 0.05);

        // 2. Camera
        this.camera = new THREE.PerspectiveCamera(48, width / height, 0.1, 100);
        this._updateCameraPosition();

        // 3. Renderer
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            alpha: true,
            powerPreference: 'high-performance',
        });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

        // 4. Lighting
        const ambient = new THREE.AmbientLight(0x38bdf8, 0.45);
        this.scene.add(ambient);

        const dirLight = new THREE.DirectionalLight(0x00f0ff, 0.8);
        dirLight.position.set(5, 10, 5);
        this.scene.add(dirLight);

        // 5. Build Room Structure
        this._buildRoom();

        // 6. Build 3 ESP32 Nodes & RF Links
        this._buildNodesAndBeams();

        // 7. Build Human RF Silhouette
        this._buildHumanAvatar();

        // 8. Event Listeners
        this._setupInteraction();

        // 9. Start Render Loop
        this._animate();
    }

    _buildRoom() {
        // Room Dimensions: 5.0m wide (X) x 2.8m high (Y) x 4.0m deep (Z)
        const roomW = 5.0, roomH = 2.8, roomD = 4.0;

        // Wireframe Room Box
        const boxGeom = new THREE.BoxGeometry(roomW, roomH, roomD);
        const edgesGeom = new THREE.EdgesGeometry(boxGeom);
        const boxMat = new THREE.LineBasicMaterial({
            color: 0x00f0ff,
            transparent: true,
            opacity: 0.28,
            linewidth: 1,
        });
        const roomBox = new THREE.LineSegments(edgesGeom, boxMat);
        roomBox.position.set(roomW / 2, roomH / 2, roomD / 2);
        this.scene.add(roomBox);

        // Floor Grid
        const gridHelper = new THREE.GridHelper(6, 12, 0x00f0ff, 0x1e293b);
        gridHelper.position.set(roomW / 2, 0.005, roomD / 2);
        this.scene.add(gridHelper);

        // Floor Solid Plane with subtle glow
        const floorGeom = new THREE.PlaneGeometry(roomW, roomD);
        const floorMat = new THREE.MeshBasicMaterial({
            color: 0x08101d,
            transparent: true,
            opacity: 0.75,
            side: THREE.DoubleSide,
        });
        const floorMesh = new THREE.Mesh(floorGeom, floorMat);
        floorMesh.rotation.x = Math.PI / 2;
        floorMesh.position.set(roomW / 2, 0, roomD / 2);
        this.scene.add(floorMesh);

        // Room Furniture Bounding Markers (Desk & Bed)
        // Study Desk Wireframe at [4.0, 0, 0.9]
        const deskGeom = new THREE.BoxGeometry(1.2, 0.75, 0.8);
        const deskEdges = new THREE.EdgesGeometry(deskGeom);
        const deskLine = new THREE.LineSegments(deskEdges, new THREE.LineBasicMaterial({
            color: 0xf59e0b,
            transparent: true,
            opacity: 0.35,
        }));
        deskLine.position.set(3.8, 0.75 / 2, 1.0);
        this.scene.add(deskLine);

        // Bed Marker at [3.8, 0, 3.2]
        const bedGeom = new THREE.BoxGeometry(1.6, 0.45, 1.0);
        const bedEdges = new THREE.EdgesGeometry(bedGeom);
        const bedLine = new THREE.LineSegments(bedEdges, new THREE.LineBasicMaterial({
            color: 0xa855f7,
            transparent: true,
            opacity: 0.35,
        }));
        bedLine.position.set(3.8, 0.45 / 2, 3.2);
        this.scene.add(bedLine);

        // Door Marker at [0.5, 0, 0]
        const doorGeom = new THREE.BoxGeometry(0.9, 2.1, 0.05);
        const doorEdges = new THREE.EdgesGeometry(doorGeom);
        const doorLine = new THREE.LineSegments(doorEdges, new THREE.LineBasicMaterial({
            color: 0x10b981,
            transparent: true,
            opacity: 0.4,
        }));
        doorLine.position.set(0.6, 1.05, 0.02);
        this.scene.add(doorLine);
    }

    _buildNodesAndBeams() {
        this.nodeMeshes = [];
        const colors = [0x00f0ff, 0xf59e0b, 0xa855f7]; // Node 1 cyan, 2 amber, 3 purple

        this.nodePositions.forEach((pos, idx) => {
            const group = new THREE.Group();
            group.position.copy(pos);

            // Glowing Core Sphere
            const sphereGeom = new THREE.SphereGeometry(0.12, 16, 16);
            const sphereMat = new THREE.MeshBasicMaterial({
                color: colors[idx],
                wireframe: true,
            });
            const sphere = new THREE.Mesh(sphereGeom, sphereMat);
            group.add(sphere);

            // Outer Pulsing Halo
            const haloGeom = new THREE.RingGeometry(0.18, 0.26, 16);
            const haloMat = new THREE.MeshBasicMaterial({
                color: colors[idx],
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.6,
            });
            const halo = new THREE.Mesh(haloGeom, haloMat);
            halo.rotation.x = Math.PI / 2;
            group.add(halo);

            // Antenna Vertical Stalk
            const stalkGeom = new THREE.CylinderGeometry(0.015, 0.015, 0.35, 8);
            const stalkMat = new THREE.MeshBasicMaterial({ color: 0x94a3b8 });
            const stalk = new THREE.Mesh(stalkGeom, stalkMat);
            stalk.position.y = 0.2;
            group.add(stalk);

            // Mounting Wall Base
            const baseGeom = new THREE.BoxGeometry(0.14, 0.14, 0.04);
            const baseMat = new THREE.MeshBasicMaterial({ color: 0x334155 });
            const base = new THREE.Mesh(baseGeom, baseMat);
            base.position.y = -0.1;
            group.add(base);

            this.scene.add(group);
            this.nodeMeshes.push({ group, halo, sphere, baseColor: colors[idx] });
        });

        // RF Beams connecting Node 1-2, 2-3, 3-1
        this.beamGroup = new THREE.Group();
        const linkPairs = [
            [0, 1, 0x00f0ff],
            [1, 2, 0xf59e0b],
            [2, 0, 0xa855f7],
        ];

        this.beamLines = [];
        linkPairs.forEach(([i, j, col]) => {
            const points = [this.nodePositions[i], this.nodePositions[j]];
            const geom = new THREE.BufferGeometry().setFromPoints(points);
            const mat = new THREE.LineDashedMaterial({
                color: col,
                dashSize: 0.25,
                gapSize: 0.12,
                transparent: true,
                opacity: 0.55,
                linewidth: 2,
            });
            const line = new THREE.Line(geom, mat);
            line.computeLineDistances();
            this.beamGroup.add(line);
            this.beamLines.push({ line, p1: this.nodePositions[i], p2: this.nodePositions[j] });

            // Create 3 traveling photon particles per link
            for (let k = 0; k < 3; k++) {
                const photonGeom = new THREE.SphereGeometry(0.04, 8, 8);
                const photonMat = new THREE.MeshBasicMaterial({ color: col });
                const photon = new THREE.Mesh(photonGeom, photonMat);
                this.beamGroup.add(photon);
                this.photons.push({
                    mesh: photon,
                    p1: this.nodePositions[i],
                    p2: this.nodePositions[j],
                    progress: k / 3.0,
                    speed: 0.4 + Math.random() * 0.2,
                });
            }
        });

        this.scene.add(this.beamGroup);

        // Multipath Expanding Wavefront Rings from Node 1 (Tx)
        this.wavefrontGroup = new THREE.Group();
        for (let r = 0; r < this.maxRings; r++) {
            const ringGeom = new THREE.RingGeometry(0.2, 0.24, 32);
            const ringMat = new THREE.MeshBasicMaterial({
                color: 0x00f0ff,
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.5,
            });
            const ring = new THREE.Mesh(ringGeom, ringMat);
            ring.rotation.x = Math.PI / 2;
            ring.position.copy(this.nodePositions[0]);
            ring.position.y = 0.05; // Along floor
            this.wavefrontGroup.add(ring);
            this.wavefrontRings.push({
                mesh: ring,
                radius: 0.2 + (r * 1.2),
                maxRadius: 5.5,
                speed: 1.4,
            });
        }
        this.scene.add(this.wavefrontGroup);
    }

    _buildHumanAvatar() {
        this.avatarGroup = new THREE.Group();
        this.avatarGroup.position.copy(this.avatarPosition);

        // Material for Human RF Silhouette (Holographic Cyan Glow)
        const silMat = new THREE.MeshBasicMaterial({
            color: 0x00f0ff,
            wireframe: true,
            transparent: true,
            opacity: 0.85,
        });

        const jointMat = new THREE.MeshBasicMaterial({
            color: 0x38bdf8,
            wireframe: false,
        });

        // 1. Head
        const headGeom = new THREE.SphereGeometry(0.18, 12, 12);
        const head = new THREE.Mesh(headGeom, silMat);
        head.position.y = 1.62;
        this.avatarGroup.add(head);
        this.avatarJoints.head = head;

        // 2. Torso / Ribcage
        const torsoGeom = new THREE.CylinderGeometry(0.22, 0.16, 0.55, 8, 4, true);
        const torso = new THREE.Mesh(torsoGeom, silMat);
        torso.position.y = 1.15;
        this.avatarGroup.add(torso);
        this.avatarJoints.torso = torso;

        // 3. Pelvis / Hip
        const hipGeom = new THREE.BoxGeometry(0.32, 0.14, 0.22);
        const hip = new THREE.Mesh(hipGeom, silMat);
        hip.position.y = 0.82;
        this.avatarGroup.add(hip);
        this.avatarJoints.hip = hip;

        // 4. Limbs & Skeleton Bones
        const limbMat = new THREE.LineBasicMaterial({
            color: 0x00f0ff,
            linewidth: 2,
            transparent: true,
            opacity: 0.9,
        });

        // Left Arm (Shoulder -> Elbow -> Hand)
        this.avatarJoints.lShoulder = new THREE.Vector3(-0.25, 1.38, 0);
        this.avatarJoints.lElbow = new THREE.Vector3(-0.35, 1.1, 0.1);
        this.avatarJoints.lHand = new THREE.Vector3(-0.32, 0.85, 0.25);

        // Right Arm
        this.avatarJoints.rShoulder = new THREE.Vector3(0.25, 1.38, 0);
        this.avatarJoints.rElbow = new THREE.Vector3(0.35, 1.1, 0.1);
        this.avatarJoints.rHand = new THREE.Vector3(0.32, 0.85, 0.25);

        // Left Leg (Hip -> Knee -> Foot)
        this.avatarJoints.lHip = new THREE.Vector3(-0.14, 0.82, 0);
        this.avatarJoints.lKnee = new THREE.Vector3(-0.16, 0.42, 0.05);
        this.avatarJoints.lFoot = new THREE.Vector3(-0.16, 0.05, 0.1);

        // Right Leg
        this.avatarJoints.rHip = new THREE.Vector3(0.14, 0.82, 0);
        this.avatarJoints.rKnee = new THREE.Vector3(0.16, 0.42, 0.05);
        this.avatarJoints.rFoot = new THREE.Vector3(0.16, 0.05, 0.1);

        // Create BufferGeometries for the 4 limbs
        this.lArmGeom = new THREE.BufferGeometry().setFromPoints([this.avatarJoints.lShoulder, this.avatarJoints.lElbow, this.avatarJoints.lHand]);
        this.rArmGeom = new THREE.BufferGeometry().setFromPoints([this.avatarJoints.rShoulder, this.avatarJoints.rElbow, this.avatarJoints.rHand]);
        this.lLegGeom = new THREE.BufferGeometry().setFromPoints([this.avatarJoints.lHip, this.avatarJoints.lKnee, this.avatarJoints.lFoot]);
        this.rLegGeom = new THREE.BufferGeometry().setFromPoints([this.avatarJoints.rHip, this.avatarJoints.rKnee, this.avatarJoints.rFoot]);

        this.lArmLine = new THREE.Line(this.lArmGeom, limbMat);
        this.rArmLine = new THREE.Line(this.rArmGeom, limbMat);
        this.lLegLine = new THREE.Line(this.lLegGeom, limbMat);
        this.rLegLine = new THREE.Line(this.rLegGeom, limbMat);

        this.avatarGroup.add(this.lArmLine);
        this.avatarGroup.add(this.rArmLine);
        this.avatarGroup.add(this.lLegLine);
        this.avatarGroup.add(this.rLegLine);

        // Joint Node Spheres
        this.jointMeshes = [];
        const jointGeom = new THREE.SphereGeometry(0.04, 8, 8);
        const jointKeys = ['lShoulder', 'lElbow', 'lHand', 'rShoulder', 'rElbow', 'rHand', 'lHip', 'lKnee', 'lFoot', 'rHip', 'rKnee', 'rFoot'];
        jointKeys.forEach(k => {
            const m = new THREE.Mesh(jointGeom, jointMat);
            m.position.copy(this.avatarJoints[k]);
            this.avatarGroup.add(m);
            this.jointMeshes.push({ key: k, mesh: m });
        });

        // Particle cloud aura surrounding human body (RF reflections)
        const cloudCount = 64;
        const cloudGeom = new THREE.BufferGeometry();
        const positions = new Float32Array(cloudCount * 3);
        for (let i = 0; i < cloudCount; i++) {
            positions[i * 3 + 0] = (Math.random() - 0.5) * 0.7;
            positions[i * 3 + 1] = Math.random() * 1.8;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 0.7;
        }
        cloudGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const cloudMat = new THREE.PointsMaterial({
            color: 0x00f0ff,
            size: 0.05,
            transparent: true,
            opacity: 0.75,
        });
        this.auraPoints = new THREE.Points(cloudGeom, cloudMat);
        this.avatarGroup.add(this.auraPoints);

        // Floor Fall Impact Ring (initially hidden)
        const fallRingGeom = new THREE.RingGeometry(0.3, 0.55, 32);
        const fallRingMat = new THREE.MeshBasicMaterial({
            color: 0xef4444,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.0,
        });
        this.fallRing = new THREE.Mesh(fallRingGeom, fallRingMat);
        this.fallRing.rotation.x = Math.PI / 2;
        this.fallRing.position.y = 0.02;
        this.avatarGroup.add(this.fallRing);

        this.scene.add(this.avatarGroup);
    }

    _setupInteraction() {
        const c = this.canvas;
        this.abortController = new AbortController();

        c.addEventListener('mousedown', (e) => {
            this.isDragging = true;
            this.prevMouse = { x: e.clientX, y: e.clientY };
        });

        window.addEventListener('mouseup', () => {
            this.isDragging = false;
        }, { signal: this.abortController.signal });

        c.addEventListener('mousemove', (e) => {
            if (!this.isDragging) return;
            const dx = e.clientX - this.prevMouse.x;
            const dy = e.clientY - this.prevMouse.y;

            this.camTheta -= dx * 0.008;
            this.camPhi -= dy * 0.008;

            // Clamp polar elevation to prevent gimbal flipping
            this.camPhi = Math.max(0.15, Math.min(Math.PI / 2 - 0.05, this.camPhi));

            this.prevMouse = { x: e.clientX, y: e.clientY };
            this._updateCameraPosition();
        });

        c.addEventListener('wheel', (e) => {
            e.preventDefault();
            this.camDistance += e.deltaY * 0.005;
            this.camDistance = Math.max(3.0, Math.min(14.0, this.camDistance));
            this._updateCameraPosition();
        }, { passive: false });

        // Touch support
        c.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                this.isDragging = true;
                this.prevMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            }
        }, { passive: true });

        c.addEventListener('touchmove', (e) => {
            if (!this.isDragging || e.touches.length !== 1) return;
            const dx = e.touches[0].clientX - this.prevMouse.x;
            const dy = e.touches[0].clientY - this.prevMouse.y;

            this.camTheta -= dx * 0.01;
            this.camPhi -= dy * 0.01;
            this.camPhi = Math.max(0.15, Math.min(Math.PI / 2 - 0.05, this.camPhi));

            this.prevMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            this._updateCameraPosition();
        }, { passive: true });

        c.addEventListener('touchend', () => {
            this.isDragging = false;
        });

        // Resize Observer
        this.resizeObserver = new ResizeObserver(() => this.resize());
        this.resizeObserver.observe(this.canvas.parentElement);
    }

    _updateCameraPosition() {
        const x = this.targetLookAt.x + this.camDistance * Math.sin(this.camPhi) * Math.sin(this.camTheta);
        const y = this.targetLookAt.y + this.camDistance * Math.cos(this.camPhi);
        const z = this.targetLookAt.z + this.camDistance * Math.sin(this.camPhi) * Math.cos(this.camTheta);

        this.camera.position.set(x, y, z);
        this.camera.lookAt(this.targetLookAt);
    }

    // Camera Presets
    setViewIsometric() {
        this.camDistance = 7.5;
        this.camTheta = 0.75;
        this.camPhi = 0.85;
        this.targetLookAt.set(2.5, 1.2, 2.0);
        this._updateCameraPosition();
    }

    setViewTopDown() {
        this.camDistance = 7.2;
        this.camTheta = 0.0;
        this.camPhi = 0.08;
        this.targetLookAt.set(2.5, 0.0, 2.0);
        this._updateCameraPosition();
    }

    setViewSide() {
        this.camDistance = 7.0;
        this.camTheta = Math.PI / 2;
        this.camPhi = 1.35;
        this.targetLookAt.set(2.5, 1.2, 2.0);
        this._updateCameraPosition();
    }

    resetView() {
        this.setViewIsometric();
    }

    toggleRipples(state) {
        this.showRipples = typeof state === 'boolean' ? state : !this.showRipples;
        if (this.wavefrontGroup) {
            this.wavefrontGroup.visible = this.showRipples;
        }
        return this.showRipples;
    }

    toggleBeams(state) {
        this.showBeams = typeof state === 'boolean' ? state : !this.showBeams;
        if (this.beamGroup) {
            this.beamGroup.visible = this.showBeams;
        }
        return this.showBeams;
    }

    resize() {
        if (!this.canvas || !this.renderer || !this.camera) return;
        const width = this.canvas.parentElement.clientWidth || 600;
        const height = this.canvas.parentElement.clientHeight || 380;
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    // -----------------------------------------------------------------------
    // Posture & Telemetry Updater
    // -----------------------------------------------------------------------

    updateTelemetry(telemetry) {
        if (!telemetry) return;

        const classification = telemetry.classification || {};
        const motionLevel = classification.motion_level || 'present_still';
        const fallDetected = classification.fall_detected || false;
        const presence = classification.presence !== false;

        if (!presence) {
            this.setPosture('empty');
            return;
        }

        if (fallDetected) {
            this.setPosture('fall');
            return;
        }

        if (telemetry.threat_mode === 'inactivity' || motionLevel === 'inactivity_alert') {
            this.setPosture('inactivity');
            return;
        }

        if (telemetry.threat_mode === 'struggle' || motionLevel === 'struggle') {
            this.setPosture('struggle');
            return;
        }

        if (motionLevel === 'active' || telemetry.threat_mode === 'pacing') {
            this.setPosture('pacing');
            return;
        }

        this.setPosture('normal');
    }

    setPosture(state) {
        this.currentPoseState = state;

        if (!this.avatarGroup) return;

        // Show/hide based on empty state
        if (state === 'empty') {
            this.avatarGroup.visible = false;
            return;
        }
        this.avatarGroup.visible = true;

        const auraMat = this.auraPoints.material;
        const fallMat = this.fallRing.material;

        switch (state) {
            case 'normal': // Seated study
                this.targetAvatarPos.set(3.4, 0.55, 1.4); // At desk
                auraMat.color.setHex(0x00f0ff);
                fallMat.opacity = 0.0;
                break;

            case 'pacing': // Walking around
                this.targetAvatarPos.set(2.2, 0.85, 2.0);
                auraMat.color.setHex(0x38bdf8);
                fallMat.opacity = 0.0;
                break;

            case 'struggle': // Violent fight / ragging
                auraMat.color.setHex(0xef4444);
                fallMat.opacity = 0.0;
                break;

            case 'fall': // Fallen on floor
                this.targetAvatarPos.y = 0.18;
                auraMat.color.setHex(0xf59e0b);
                fallMat.opacity = 0.85;
                break;

            case 'inactivity': // Prolonged unmoving stillness / distress
                this.targetAvatarPos.set(3.4, 0.50, 1.4); // Slumped at desk
                auraMat.color.setHex(0xf59e0b);
                fallMat.opacity = 0.0;
                break;
        }
    }

    // -----------------------------------------------------------------------
    // Render & Animation Loop
    // -----------------------------------------------------------------------

    _animate() {
        if (this.isDestroyed) return;
        this.animFrameId = requestAnimationFrame(() => this._animate());

        const delta = this.clock.getDelta();
        const time = this.clock.getElapsedTime();

        // 1. Animate Node Beacon Halos
        this.nodeMeshes.forEach((n, idx) => {
            const scale = 1.0 + 0.25 * Math.sin(time * 3.5 + idx);
            n.halo.scale.set(scale, scale, 1);
            n.halo.material.opacity = 0.35 + 0.25 * Math.sin(time * 4.0 + idx);
        });

        // 2. Animate Traveling Photons on RF Beams
        if (this.showBeams) {
            this.photons.forEach((p) => {
                p.progress = (p.progress + delta * p.speed) % 1.0;
                p.mesh.position.lerpVectors(p.p1, p.p2, p.progress);
                p.mesh.position.y += Math.sin(p.progress * Math.PI) * 0.15; // Arc trajectory
            });
        }

        // 3. Animate Multipath Wavefront Rings
        if (this.showRipples) {
            this.wavefrontRings.forEach((r) => {
                r.radius += delta * r.speed;
                if (r.radius > r.maxRadius) {
                    r.radius = 0.2;
                }
                const sc = r.radius;
                r.mesh.scale.set(sc, sc, 1);
                // Fade out as it expands
                const fade = Math.max(0, 1.0 - (r.radius / r.maxRadius));
                r.mesh.material.opacity = fade * 0.45;
            });
        }

        // 4. Animate Dynamic Human Avatar
        if (this.avatarGroup && this.avatarGroup.visible) {
            // Smooth position interpolation
            this.avatarPosition.lerp(this.targetAvatarPos, delta * 3.0);
            this.avatarGroup.position.copy(this.avatarPosition);

            // Posture-specific animation dynamics
            if (this.currentPoseState === 'normal') {
                // Calm thoracic breathing expansion
                const breath = Math.sin(time * 2.2) * 0.02;
                this.avatarJoints.torso.scale.set(1 + breath, 1 + breath, 1 + breath);
                this.avatarGroup.rotation.y = -Math.PI / 4; // Facing desk
                this.avatarJoints.head.position.set(0, 1.45 + breath * 0.5, 0);
                this.avatarJoints.head.rotation.set(0.1, 0, 0);
                this.avatarGroup.rotation.z = 0;
                this.avatarGroup.rotation.x = 0;

                // Seated arms resting on desk
                this.avatarJoints.lShoulder.set(-0.25, 1.35, 0);
                this.avatarJoints.lElbow.set(-0.32, 1.05, 0.2);
                this.avatarJoints.lHand.set(-0.22, 0.78, 0.38);
                this.avatarJoints.rShoulder.set(0.25, 1.35, 0);
                this.avatarJoints.rElbow.set(0.32, 1.05, 0.2);
                this.avatarJoints.rHand.set(0.22, 0.78, 0.38);

                // Seated legs bent
                this.avatarJoints.lHip.set(-0.14, 0.75, 0);
                this.avatarJoints.lKnee.set(-0.16, 0.42, 0.28);
                this.avatarJoints.lFoot.set(-0.16, 0.05, 0.28);
                this.avatarJoints.rHip.set(0.14, 0.75, 0);
                this.avatarJoints.rKnee.set(0.16, 0.42, 0.28);
                this.avatarJoints.rFoot.set(0.16, 0.05, 0.28);
            } else if (this.currentPoseState === 'pacing') {
                // Walking oscillation & circling
                const walkPathRadius = 1.1;
                this.targetAvatarPos.x = 2.5 + Math.cos(time * 0.8) * walkPathRadius;
                this.targetAvatarPos.z = 2.0 + Math.sin(time * 0.8) * walkPathRadius;
                this.avatarGroup.rotation.y = time * 0.8 + Math.PI / 2;
                this.avatarGroup.rotation.z = 0;
                this.avatarGroup.rotation.x = 0;
                this.avatarJoints.torso.scale.set(1, 1, 1);
                this.avatarJoints.head.position.set(0, 1.62, 0);
                this.avatarJoints.head.rotation.set(0, 0, 0);

                // Leg swing gait
                const gait = Math.sin(time * 4.0);
                this.avatarPosition.y = 0.85 + Math.abs(gait) * 0.04;

                this.avatarJoints.lShoulder.set(-0.25, 1.38, 0);
                this.avatarJoints.lElbow.set(-0.30, 1.10, -gait * 0.15);
                this.avatarJoints.lHand.set(-0.28, 0.82, -gait * 0.25);

                this.avatarJoints.rShoulder.set(0.25, 1.38, 0);
                this.avatarJoints.rElbow.set(0.30, 1.10, gait * 0.15);
                this.avatarJoints.rHand.set(0.28, 0.82, gait * 0.25);

                this.avatarJoints.lHip.set(-0.14, 0.82, 0);
                this.avatarJoints.lKnee.set(-0.16, 0.45, gait * 0.20);
                this.avatarJoints.lFoot.set(-0.16, 0.05, gait * 0.30);

                this.avatarJoints.rHip.set(0.14, 0.82, 0);
                this.avatarJoints.rKnee.set(0.16, 0.45, -gait * 0.20);
                this.avatarJoints.rFoot.set(0.16, 0.05, -gait * 0.30);
            } else if (this.currentPoseState === 'struggle') {
                // Chaotic violent jitter & flailing
                const jitterX = (Math.random() - 0.5) * 0.18;
                const jitterY = (Math.random() - 0.5) * 0.12;
                const jitterZ = (Math.random() - 0.5) * 0.18;
                this.avatarGroup.position.x += jitterX;
                this.avatarGroup.position.z += jitterZ;
                this.avatarGroup.rotation.y += (Math.random() - 0.5) * 0.4;
                this.avatarGroup.rotation.z = (Math.random() - 0.5) * 0.2;
                this.avatarGroup.rotation.x = (Math.random() - 0.5) * 0.2;
                this.avatarJoints.head.position.set(jitterX, 1.6 + jitterY, jitterZ);

                // Flailing arms & limbs
                this.avatarJoints.lShoulder.set(-0.25, 1.38, 0);
                this.avatarJoints.lElbow.set(-0.45 + (Math.random() - 0.5) * 0.3, 1.2 + (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.4);
                this.avatarJoints.lHand.set(-0.55 + (Math.random() - 0.5) * 0.4, 1.4 + (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.5);

                this.avatarJoints.rShoulder.set(0.25, 1.38, 0);
                this.avatarJoints.rElbow.set(0.45 + (Math.random() - 0.5) * 0.3, 1.2 + (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.4);
                this.avatarJoints.rHand.set(0.55 + (Math.random() - 0.5) * 0.4, 1.4 + (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.5);

                this.avatarJoints.lKnee.set(-0.2 + (Math.random() - 0.5) * 0.2, 0.45 + (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.3);
                this.avatarJoints.lFoot.set(-0.2 + (Math.random() - 0.5) * 0.3, 0.1 + (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.4);
                this.avatarJoints.rKnee.set(0.2 + (Math.random() - 0.5) * 0.2, 0.45 + (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.3);
                this.avatarJoints.rFoot.set(0.2 + (Math.random() - 0.5) * 0.3, 0.1 + (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.4);
            } else if (this.currentPoseState === 'fall') {
                // Prone on floor
                this.avatarGroup.rotation.z = Math.PI / 2; // Lie on side/floor
                this.avatarGroup.rotation.x = Math.PI / 2;
                this.avatarGroup.position.y = 0.15;

                // Splayed limbs on ground
                this.avatarJoints.lShoulder.set(-0.25, 1.38, 0);
                this.avatarJoints.lElbow.set(-0.45, 1.15, 0.1);
                this.avatarJoints.lHand.set(-0.55, 0.90, 0.15);
                this.avatarJoints.rShoulder.set(0.25, 1.38, 0);
                this.avatarJoints.rElbow.set(0.40, 1.25, -0.1);
                this.avatarJoints.rHand.set(0.50, 1.10, -0.15);

                this.avatarJoints.lKnee.set(-0.25, 0.40, 0.2);
                this.avatarJoints.lFoot.set(-0.30, 0.05, 0.3);
                this.avatarJoints.rKnee.set(0.18, 0.40, -0.1);
                this.avatarJoints.rFoot.set(0.22, 0.05, -0.15);

                // Pulse fall impact ring
                const ringScale = 1.0 + 0.3 * Math.sin(time * 3.0);
                this.fallRing.scale.set(ringScale, ringScale, 1);
            } else if (this.currentPoseState === 'inactivity') {
                // Slumped unmoving distress posture
                const faintBreath = Math.sin(time * 1.2) * 0.008;
                this.avatarJoints.torso.scale.set(1 + faintBreath, 1 + faintBreath, 1 + faintBreath);
                this.avatarGroup.rotation.y = -Math.PI / 4;
                this.avatarGroup.rotation.z = 0.08;
                this.avatarGroup.rotation.x = 0.15;
                this.avatarJoints.head.position.set(0.04, 1.35, 0.12);
                this.avatarJoints.head.rotation.set(0.35, 0, 0.1);

                // Limp hanging arms
                this.avatarJoints.lShoulder.set(-0.25, 1.30, 0);
                this.avatarJoints.lElbow.set(-0.28, 0.95, 0.08);
                this.avatarJoints.lHand.set(-0.24, 0.65, 0.14);
                this.avatarJoints.rShoulder.set(0.25, 1.30, 0);
                this.avatarJoints.rElbow.set(0.28, 0.95, 0.08);
                this.avatarJoints.rHand.set(0.24, 0.65, 0.14);

                this.avatarJoints.lHip.set(-0.14, 0.72, 0);
                this.avatarJoints.lKnee.set(-0.15, 0.40, 0.22);
                this.avatarJoints.lFoot.set(-0.15, 0.05, 0.22);
                this.avatarJoints.rHip.set(0.14, 0.72, 0);
                this.avatarJoints.rKnee.set(0.15, 0.40, 0.22);
                this.avatarJoints.rFoot.set(0.15, 0.05, 0.22);
            }

            // Synchronize limb line geometries and joint node spheres
            if (this.lArmGeom) {
                this.lArmGeom.setFromPoints([this.avatarJoints.lShoulder, this.avatarJoints.lElbow, this.avatarJoints.lHand]);
                this.rArmGeom.setFromPoints([this.avatarJoints.rShoulder, this.avatarJoints.rElbow, this.avatarJoints.rHand]);
                this.lLegGeom.setFromPoints([this.avatarJoints.lHip, this.avatarJoints.lKnee, this.avatarJoints.lFoot]);
                this.rLegGeom.setFromPoints([this.avatarJoints.rHip, this.avatarJoints.rKnee, this.avatarJoints.rFoot]);
            }
            if (this.jointMeshes) {
                this.jointMeshes.forEach(j => {
                    if (this.avatarJoints[j.key]) {
                        j.mesh.position.copy(this.avatarJoints[j.key]);
                    }
                });
            }

            // Animate aura particle jitter
            if (this.auraPoints) {
                const posArr = this.auraPoints.geometry.attributes.position.array;
                for (let i = 0; i < posArr.length; i += 3) {
                    posArr[i + 1] += (Math.random() - 0.5) * 0.02;
                    if (posArr[i + 1] < 0) posArr[i + 1] = 1.8;
                    if (posArr[i + 1] > 1.8) posArr[i + 1] = 0;
                }
                this.auraPoints.geometry.attributes.position.needsUpdate = true;
            }
        }

        // Render Frame
        this.renderer.render(this.scene, this.camera);
    }

    destroy() {
        this.isDestroyed = true;
        if (this.animFrameId) {
            cancelAnimationFrame(this.animFrameId);
        }
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
        if (this.abortController) {
            this.abortController.abort();
        }

        // Clean up Three.js memory
        if (this.scene) {
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
        }
        if (this.renderer) {
            this.renderer.dispose();
        }
    }
}

// Global export for vanilla script inclusion
window.Radar3DEngine = Radar3DEngine;
