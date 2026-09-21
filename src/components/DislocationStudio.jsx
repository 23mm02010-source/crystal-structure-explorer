import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import {
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  Info,
  Layers,
  ArrowRight,
  ShieldAlert,
  Sparkles,
  CheckCircle,
} from 'lucide-react';
import {
  generatePerfectGrid,
  generateEdgeDislocationGrid,
  generateScrewDislocationGrid,
  generateBurgersCircuit,
  SLIP_SYSTEMS_INFO,
} from '../math/dislocations.js';

const DISLOC_COLORS = {
  bg: 0x0a0e14,
  atomRegular: 0x8fb4d9,
  atomExtra: 0xf97316, // glowing orange for extra half-plane
  atomAbove: 0x60a5fa,
  atomBelow: 0x93c5fd,
  bond: 0x3e4e62,
  slipPlane: 0xef4444,
  burgersCircuit: 0xfacc15,
  burgersVector: 0xef4444,
  coreMarker: 0xfbbf24,
};

function disposeObject3D(obj) {
  if (!obj) return;
  obj.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      if (Array.isArray(child.material)) {
        child.material.forEach((m) => m.dispose());
      } else {
        child.material.dispose();
      }
    }
  });
}

function makeCylinderBond(p1, p2, radius, mat) {
  const dir = p2.clone().sub(p1);
  const len = dir.length();
  if (len < 0.001) return new THREE.Group();
  const cyl = new THREE.CylinderGeometry(radius, radius, len, 8);
  const mesh = new THREE.Mesh(cyl, mat);
  mesh.position.copy(p1.clone().add(p2).multiplyScalar(0.5));
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  return mesh;
}

function makeArrow(from, to, colorHex, headLength = 0.4, headWidth = 0.25) {
  const dir = to.clone().sub(from);
  const length = dir.length();
  if (length < 0.01) return new THREE.Group();
  const arrowHelper = new THREE.ArrowHelper(
    dir.clone().normalize(),
    from,
    length,
    colorHex,
    headLength,
    headWidth
  );
  return arrowHelper;
}

export default function DislocationStudio({ activeStructureId = 'fcc' }) {
  const mountRef = useRef(null);
  const stateRef = useRef({});

  const [dislocType, setDislocType] = useState('edge'); // 'edge' | 'screw' | 'perfect'
  const [showSlipPlane, setShowSlipPlane] = useState(true);
  const [showBurgersCircuit, setShowBurgersCircuit] = useState(true);
  const [showExtraPlaneHighlight, setShowExtraPlaneHighlight] = useState(true);

  // Glide animation state
  const [isGliding, setIsGliding] = useState(false);
  const [coreProgress, setCoreProgress] = useState(0.5); // 0 = left edge, 0.5 = center, 1 = right edge
  const [glideSpeed, setGlideSpeed] = useState(1);
  const [selectedSlipSystem, setSelectedSlipSystem] = useState(
    activeStructureId === 'bcc' ? 'bcc' : activeStructureId === 'hcp' ? 'hcp' : 'fcc'
  );

  // ------------------------------------------------------------
  // Three.js Mount Setup
  // ------------------------------------------------------------
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth || 800;
    const height = mount.clientHeight || 550;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(DISLOC_COLORS.bg);

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 400);
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0x758ca3, 0.7));
    const d1 = new THREE.DirectionalLight(0xffffff, 1.2);
    d1.position.set(12, 16, 14);
    scene.add(d1);
    const d2 = new THREE.DirectionalLight(0x88aaff, 0.45);
    d2.position.set(-10, -6, -8);
    scene.add(d2);

    const rig = new THREE.Group();
    scene.add(rig);
    const world = new THREE.Group();
    rig.add(world);

    stateRef.current = {
      scene,
      camera,
      renderer,
      rig,
      world,
      dragging: false,
      moved: false,
      rotY: 0.45,
      rotX: -0.28,
      dist: 16,
      lastX: 0,
      lastY: 0,
      downX: 0,
      downY: 0,
      autoRotate: false,
    };

    rig.rotation.y = stateRef.current.rotY;
    rig.rotation.x = stateRef.current.rotX;

    const dom = renderer.domElement;
    const onMouseDown = (e) => {
      const s = stateRef.current;
      s.dragging = true;
      s.lastX = e.clientX;
      s.lastY = e.clientY;
    };
    const onMouseMove = (e) => {
      const s = stateRef.current;
      if (!s.dragging) return;
      const dx = e.clientX - s.lastX;
      const dy = e.clientY - s.lastY;
      s.lastX = e.clientX;
      s.lastY = e.clientY;
      s.rotY += dx * 0.0075;
      s.rotX += dy * 0.0075;
      s.rotX = Math.max(-1.45, Math.min(1.45, s.rotX));
    };
    const onMouseUp = () => {
      stateRef.current.dragging = false;
    };
    const onWheel = (e) => {
      e.preventDefault();
      const s = stateRef.current;
      s.dist = Math.max(4, Math.min(60, s.dist + e.deltaY * 0.015));
    };

    dom.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    dom.addEventListener('wheel', onWheel, { passive: false });

    let raf;
    const animate = () => {
      const s = stateRef.current;
      s.rig.rotation.y = s.rotY;
      s.rig.rotation.x = s.rotX;
      const dir = s.camera.position.clone().normalize();
      if (dir.lengthSq() < 0.001) dir.set(1, 0.6, 1).normalize();
      s.camera.position.copy(dir.multiplyScalar(s.dist));
      s.camera.lookAt(0, 0, 0);

      s.renderer.render(s.scene, s.camera);
      raf = requestAnimationFrame(animate);
    };
    animate();

    const onResize = () => {
      if (!mount) return;
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      stateRef.current.camera.aspect = w / h;
      stateRef.current.camera.updateProjectionMatrix();
      stateRef.current.renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      dom.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      dom.removeEventListener('wheel', onWheel);
      renderer.dispose();
      if (mount.contains(dom)) mount.removeChild(dom);
    };
  }, []);

  // ------------------------------------------------------------
  // Glide Animation Loop
  // ------------------------------------------------------------
  useEffect(() => {
    if (!isGliding) return;
    let animId;
    let lastTime = performance.now();

    const step = (now) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;
      setCoreProgress((prev) => {
        let next = prev + dt * 0.25 * glideSpeed;
        if (next > 1.0) next = 0.0;
        return next;
      });
      animId = requestAnimationFrame(step);
    };
    animId = requestAnimationFrame(step);

    return () => cancelAnimationFrame(animId);
  }, [isGliding, glideSpeed]);

  // ------------------------------------------------------------
  // Rebuild 3D Dislocation Mesh
  // ------------------------------------------------------------
  useEffect(() => {
    const s = stateRef.current;
    if (!s.world) return;

    while (s.world.children.length > 0) {
      const c = s.world.children.pop();
      disposeObject3D(c);
    }

    const nx = 9;
    const ny = 7;
    const nz = 5;
    const spacing = 1.2;

    // Convert coreProgress (0..1) to physical coreX across crystal width
    const totalW = (nx - 1) * spacing;
    const coreX = (coreProgress - 0.5) * totalW * 0.85;

    let latticeData;
    if (dislocType === 'edge') {
      latticeData = generateEdgeDislocationGrid({ nx, ny, nz, spacing, coreX });
    } else if (dislocType === 'screw') {
      latticeData = generateScrewDislocationGrid({ nx, ny, nz, spacing, coreX });
    } else {
      latticeData = generatePerfectGrid({ nx, ny, nz, spacing });
    }

    const { atoms, b } = latticeData;

    // 1. Slip Plane Translucent Surface (y = 0)
    if (showSlipPlane) {
      const planeGeo = new THREE.PlaneGeometry((nx + 1) * spacing, (nz + 1) * spacing);
      const planeMat = new THREE.MeshBasicMaterial({
        color: DISLOC_COLORS.slipPlane,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.2,
        depthWrite: false,
      });
      const planeMesh = new THREE.Mesh(planeGeo, planeMat);
      planeMesh.rotation.x = Math.PI / 2;
      s.world.add(planeMesh);

      // Slip plane perimeter boundary
      const edgesGeo = new THREE.EdgesGeometry(planeGeo);
      const edgesMat = new THREE.LineBasicMaterial({
        color: DISLOC_COLORS.slipPlane,
        transparent: true,
        opacity: 0.6,
      });
      const edgesMesh = new THREE.LineSegments(edgesGeo, edgesMat);
      edgesMesh.rotation.x = Math.PI / 2;
      s.world.add(edgesMesh);
    }

    // 2. Atoms
    const atomGroup = new THREE.Group();
    const sphereGeo = new THREE.SphereGeometry(0.32, 20, 16);

    const matRegular = new THREE.MeshStandardMaterial({
      color: DISLOC_COLORS.atomRegular,
      roughness: 0.35,
      metalness: 0.2,
    });
    const matExtra = new THREE.MeshStandardMaterial({
      color: DISLOC_COLORS.atomExtra,
      roughness: 0.25,
      metalness: 0.3,
      emissive: 0x7c2d12,
      emissiveIntensity: 0.4,
    });
    const matAbove = new THREE.MeshStandardMaterial({
      color: DISLOC_COLORS.atomAbove,
      roughness: 0.4,
    });

    atoms.forEach((atom) => {
      let mat = matRegular;
      if (showExtraPlaneHighlight && atom.isExtraPlane) {
        mat = matExtra;
      } else if (atom.isAboveSlipPlane) {
        mat = matAbove;
      }
      const m = new THREE.Mesh(sphereGeo, mat);
      m.position.copy(atom.pos);
      atomGroup.add(m);
    });
    s.world.add(atomGroup);

    // 3. Nearest neighbor bonds (in-plane x and y)
    const bondGroup = new THREE.Group();
    const bondMat = new THREE.MeshStandardMaterial({
      color: DISLOC_COLORS.bond,
      roughness: 0.7,
    });

    // Draw horizontal bonds along x
    for (let iy = 0; iy < ny; iy++) {
      for (let iz = 0; iz < nz; iz++) {
        for (let ix = 0; ix < nx - 1; ix++) {
          const at1 = atoms.find(
            (a) => a.gridIndex[0] === ix && a.gridIndex[1] === iy && a.gridIndex[2] === iz
          );
          const at2 = atoms.find(
            (a) => a.gridIndex[0] === ix + 1 && a.gridIndex[1] === iy && a.gridIndex[2] === iz
          );
          if (at1 && at2 && at1.pos.distanceTo(at2.pos) < spacing * 1.45) {
            bondGroup.add(makeCylinderBond(at1.pos, at2.pos, 0.03, bondMat));
          }
        }
      }
    }

    // Draw vertical bonds along y
    for (let ix = 0; ix < nx; ix++) {
      for (let iz = 0; iz < nz; iz++) {
        for (let iy = 0; iy < ny - 1; iy++) {
          const at1 = atoms.find(
            (a) => a.gridIndex[0] === ix && a.gridIndex[1] === iy && a.gridIndex[2] === iz
          );
          const at2 = atoms.find(
            (a) => a.gridIndex[0] === ix && a.gridIndex[1] === iy + 1 && a.gridIndex[2] === iz
          );
          if (at1 && at2 && at1.pos.distanceTo(at2.pos) < spacing * 1.45) {
            bondGroup.add(makeCylinderBond(at1.pos, at2.pos, 0.03, bondMat));
          }
        }
      }
    }
    s.world.add(bondGroup);

    // 4. Burgers Circuit & Closure Failure Vector b
    if (showBurgersCircuit) {
      const circuit = generateBurgersCircuit({
        mode: dislocType,
        atoms,
        nx,
        ny,
        nz,
        spacing,
        b: b || spacing,
        stepSize: 4,
      });

      if (circuit && circuit.circuitPoints.length > 1) {
        const circuitGroup = new THREE.Group();
        const linePts = [];
        circuit.circuitPoints.forEach((p) => linePts.push(p.x, p.y, p.z));

        const lineGeo = new THREE.BufferGeometry();
        lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePts, 3));
        const lineMat = new THREE.LineBasicMaterial({
          color: DISLOC_COLORS.burgersCircuit,
          linewidth: 3,
        });
        circuitGroup.add(new THREE.Line(lineGeo, lineMat));

        // Circuit waypoint nodes
        const nodeGeo = new THREE.SphereGeometry(0.12, 12, 10);
        const nodeMat = new THREE.MeshBasicMaterial({ color: DISLOC_COLORS.burgersCircuit });
        circuit.circuitPoints.forEach((p) => {
          const nodeMesh = new THREE.Mesh(nodeGeo, nodeMat);
          nodeMesh.position.copy(p);
          circuitGroup.add(nodeMesh);
        });

        // Closure Failure Arrow: Burgers Vector b (spanning endPos to startPos)
        if (circuit.hasClosureFailure) {
          const arrow = makeArrow(circuit.endPos, circuit.startPos, DISLOC_COLORS.burgersVector, 0.5, 0.35);
          circuitGroup.add(arrow);

          // Vector label sprite
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          ctx.font = 'bold 36px ui-monospace, monospace';
          canvas.width = 240;
          canvas.height = 70;
          ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
          ctx.fillRect(0, 0, 240, 70);
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 30px ui-monospace, monospace';
          ctx.fillText('Burgers b', 20, 46);
          const tex = new THREE.CanvasTexture(canvas);
          const spMat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
          const sprite = new THREE.Sprite(spMat);
          sprite.scale.set(1.4, 0.45, 1);
          sprite.position.copy(circuit.endPos.clone().lerp(circuit.startPos, 0.5)).add(new THREE.Vector3(0, 0.5, 0));
          circuitGroup.add(sprite);
        }

        s.world.add(circuitGroup);
      }
    }
  }, [
    dislocType,
    showSlipPlane,
    showBurgersCircuit,
    showExtraPlaneHighlight,
    coreProgress,
  ]);

  const slipInfo = SLIP_SYSTEMS_INFO[selectedSlipSystem] || SLIP_SYSTEMS_INFO.fcc;

  return (
    <div className="disloc-studio-container">
      {/* 3D Canvas Mount Area */}
      <div className="disloc-canvas-container" ref={mountRef}>
        {/* Top Floating Badge */}
        <div className="disloc-hud-top">
          <div className="disloc-badge-title">
            {dislocType === 'edge'
              ? 'Edge Dislocation (Extra Half-Plane ⊥)'
              : dislocType === 'screw'
              ? 'Screw Dislocation (Helical Ramp ↺)'
              : 'Perfect Crystal (Zero Defects Reference)'}
          </div>
          <div className="disloc-badge-desc">
            {dislocType === 'edge'
              ? 'Burgers vector b is perpendicular to dislocation line (b ⊥ ξ). An extra half-plane of atoms is inserted above the slip plane.'
              : dislocType === 'screw'
              ? 'Burgers vector b is parallel to dislocation line (b ∥ ξ). Atomic planes spiral in a continuous helical ramp around the core.'
              : 'Closed Burgers circuit on a perfect crystal closes with zero error (b = 0).'}
          </div>
        </div>

        {/* Bottom Floating Instructions */}
        <div className="disloc-hud-bottom">
          <span>Click &amp; drag to rotate · Scroll to zoom · Dislocation line ξ along Z-axis</span>
        </div>
      </div>

      {/* Dislocation Control Sidebar */}
      <div className="disloc-control-sidebar">
        {/* Mode Selector */}
        <div className="control-section">
          <div className="control-section-header">Defect Type</div>
          <div className="defect-type-buttons">
            <button
              className={`control-btn ${dislocType === 'edge' ? 'active' : ''}`}
              onClick={() => setDislocType('edge')}
            >
              Edge Dislocation (⊥)
            </button>
            <button
              className={`control-btn ${dislocType === 'screw' ? 'active' : ''}`}
              onClick={() => setDislocType('screw')}
            >
              Screw Dislocation (↺)
            </button>
            <button
              className={`control-btn ${dislocType === 'perfect' ? 'active' : ''}`}
              onClick={() => setDislocType('perfect')}
            >
              Perfect Crystal
            </button>
          </div>
        </div>

        {/* Glide / Slip Animation Controls */}
        <div className="control-section">
          <div className="control-section-header">
            Glide Dynamics (Shear Stress τ)
          </div>
          <div className="glide-controls-bar">
            <button
              className="glide-action-btn"
              onClick={() => setIsGliding(!isGliding)}
            >
              {isGliding ? <Pause size={15} /> : <Play size={15} />}
              <span>{isGliding ? 'Pause Glide' : 'Simulate Slip'}</span>
            </button>
            <button
              className="glide-action-btn secondary"
              onClick={() => {
                setIsGliding(false);
                setCoreProgress(0.5);
              }}
              title="Center dislocation"
            >
              <RotateCcw size={15} />
            </button>
          </div>

          <div className="slider-container">
            <div className="slider-label-row">
              <span>Dislocation Core Position:</span>
              <span className="slider-value">
                {coreProgress <= 0.05
                  ? 'Left Surface'
                  : coreProgress >= 0.95
                  ? 'Right Surface (Step Formed!)'
                  : `${Math.round(coreProgress * 100)}% across cell`}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={coreProgress}
              onChange={(e) => {
                setIsGliding(false);
                setCoreProgress(parseFloat(e.target.value));
              }}
              className="range-slider"
            />
          </div>

          <div className="educational-note">
            <Info size={13} className="note-icon" />
            <span>
              Instead of shearing an entire atomic plane at once (which requires theoretical shear strength G/10 ≈ gigapascals), dislocations glide one atomic row at a time with minimal force!
            </span>
          </div>
        </div>

        {/* Visual Layer Toggles */}
        <div className="control-section">
          <div className="control-section-header">Visual Elements</div>
          <div className="toggle-list">
            <label className="toggle-item">
              <input
                type="checkbox"
                checked={showBurgersCircuit}
                onChange={(e) => setShowBurgersCircuit(e.target.checked)}
              />
              <span>Burgers Circuit &amp; Closure Failure (b)</span>
            </label>

            <label className="toggle-item">
              <input
                type="checkbox"
                checked={showSlipPlane}
                onChange={(e) => setShowSlipPlane(e.target.checked)}
              />
              <span>Slip Plane (y = 0)</span>
            </label>

            {dislocType === 'edge' && (
              <label className="toggle-item">
                <input
                  type="checkbox"
                  checked={showExtraPlaneHighlight}
                  onChange={(e) => setShowExtraPlaneHighlight(e.target.checked)}
                />
                <span>Highlight Extra Half-Plane (Orange)</span>
              </label>
            )}
          </div>
        </div>

        {/* Slip Systems & Ductility Comparison */}
        <div className="control-section">
          <div className="control-section-header">
            Slip Systems &amp; Ductility (Von Mises)
          </div>
          <div className="slip-system-selector">
            {['fcc', 'bcc', 'hcp'].map((sys) => (
              <button
                key={sys}
                className={`slip-tab-btn ${selectedSlipSystem === sys ? 'active' : ''}`}
                onClick={() => setSelectedSlipSystem(sys)}
              >
                {sys.toUpperCase()}
              </button>
            ))}
          </div>

          <div className="slip-info-card">
            <div className="slip-info-row">
              <span className="slip-info-label">Structure:</span>
              <span className="slip-info-val">{slipInfo.structure}</span>
            </div>
            <div className="slip-info-row">
              <span className="slip-info-label">Slip Planes:</span>
              <span className="slip-info-val">{slipInfo.planes}</span>
            </div>
            <div className="slip-info-row">
              <span className="slip-info-label">Slip Directions:</span>
              <span className="slip-info-val">{slipInfo.directions}</span>
            </div>
            <div className="slip-info-row">
              <span className="slip-info-label">Total Independent Systems:</span>
              <span className="slip-info-val highlight">
                {slipInfo.totalSystems} systems
              </span>
            </div>
            <div className="slip-info-row">
              <span className="slip-info-label">Mechanical Behavior:</span>
              <span className="slip-info-val">{slipInfo.ductility}</span>
            </div>
            <div className="slip-explanation">{slipInfo.explanation}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
