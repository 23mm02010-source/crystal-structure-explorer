import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { RotateCw, Atom, Link2, Triangle, Diamond, MousePointerClick, X, Ruler } from 'lucide-react';

// ---------- Crystallography constants (FCC) ----------
const A = 4; // unit cell edge length in scene units
const R_NN = A / Math.SQRT2; // nearest-neighbor distance
const R_OCTA_BOND = A * 0.5; // void-to-atom distance for octahedral (6-coordinate)
const R_TETRA_BOND = A * (Math.sqrt(3) / 4); // void-to-atom distance for tetrahedral (4-coordinate)
const EPS = 0.02;

const CORNER_FRAC = [
  [0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1],
  [1, 1, 0], [1, 0, 1], [0, 1, 1], [1, 1, 1],
];
const FACE_FRAC = [
  [0.5, 0.5, 0], [0.5, 0.5, 1],
  [0.5, 0, 0.5], [0.5, 1, 0.5],
  [0, 0.5, 0.5], [1, 0.5, 0.5],
];
const OCTA_FRAC = [
  [0.5, 0.5, 0.5],
  [0.5, 0, 0], [0.5, 1, 0], [0.5, 0, 1], [0.5, 1, 1],
  [0, 0.5, 0], [1, 0.5, 0], [0, 0.5, 1], [1, 0.5, 1],
  [0, 0, 0.5], [1, 0, 0.5], [0, 1, 0.5], [1, 1, 0.5],
];
const TETRA_FRAC = [
  [0.25, 0.25, 0.25], [0.75, 0.25, 0.25], [0.25, 0.75, 0.25], [0.25, 0.25, 0.75],
  [0.75, 0.75, 0.25], [0.75, 0.25, 0.75], [0.25, 0.75, 0.75], [0.75, 0.75, 0.75],
];

// 12 nearest-neighbor offset vectors for FCC (permutations of (±0.5,±0.5,0)*A)
const FCC_NN_OFFSETS = [
  [0.5, 0.5, 0], [0.5, -0.5, 0], [-0.5, 0.5, 0], [-0.5, -0.5, 0],
  [0.5, 0, 0.5], [0.5, 0, -0.5], [-0.5, 0, 0.5], [-0.5, 0, -0.5],
  [0, 0.5, 0.5], [0, 0.5, -0.5], [0, -0.5, 0.5], [0, -0.5, -0.5],
].map(([x, y, z]) => new THREE.Vector3(x * A, y * A, z * A));

const toVec = ([x, y, z]) => new THREE.Vector3(x * A, y * A, z * A);

const CUBE_EDGES = [
  [[0,0,0],[1,0,0]], [[1,0,0],[1,1,0]], [[1,1,0],[0,1,0]], [[0,1,0],[0,0,0]],
  [[0,0,1],[1,0,1]], [[1,0,1],[1,1,1]], [[1,1,1],[0,1,1]], [[0,1,1],[0,0,1]],
  [[0,0,0],[0,0,1]], [[1,0,0],[1,0,1]], [[1,1,0],[1,1,1]], [[0,1,0],[0,1,1]],
];

const COLORS = {
  bg: 0x0c1118,
  atom: 0x8fb4d9,
  atomEmissive: 0x1a2a3a,
  bond: 0x5a6b80,
  edge: 0x3a4a5e,
  octa: 0xd98e3f,
  tetra: 0x4fd1c5,
  highlight: 0xf4d35e,
  ghost: 0x8fb4d9,
};

// Real FCC metals — lattice constant a (Å); atomic radius r = a√2/4 (touching along face diagonal)
const COMPOUNDS = [
  { id: 'cu', name: 'Copper (Cu)', a: 3.615 },
  { id: 'al', name: 'Aluminium (Al)', a: 4.046 },
  { id: 'ni', name: 'Nickel (Ni)', a: 3.524 },
  { id: 'au', name: 'Gold (Au)', a: 4.078 },
  { id: 'ag', name: 'Silver (Ag)', a: 4.086 },
  { id: 'pb', name: 'Lead (Pb)', a: 4.950 },
];

// Dimension/measurement definitions (fractional cell coords).
// text(aReal) returns the label using the SELECTED compound's real lattice constant.
const MEASUREMENTS = [
  { key: 'side', label: 'Cell edge', p1: [0, 0, 0], p2: [1, 0, 0], color: '#f4d35e', text: (a) => `a = ${a.toFixed(3)} \u00c5` },
  { key: 'face', label: 'Face diagonal', p1: [0, 0, 0], p2: [1, 1, 0], color: '#f4d35e', text: (a) => `a\u221a2 = ${(a * Math.SQRT2).toFixed(3)} \u00c5` },
  { key: 'body', label: 'Body diagonal', p1: [0, 0, 0], p2: [1, 1, 1], color: '#f4d35e', text: (a) => `a\u221a3 = ${(a * Math.sqrt(3)).toFixed(3)} \u00c5` },
  { key: 'octaR', label: 'Octahedral void \u2192 atom', p1: [0.5, 0.5, 0.5], p2: [0.5, 0.5, 0], color: '#d98e3f', text: (a) => `a/2 = ${(a * 0.5).toFixed(3)} \u00c5` },
  { key: 'tetraR', label: 'Tetrahedral void \u2192 atom', p1: [0.25, 0.25, 0.25], p2: [0, 0, 0], color: '#4fd1c5', text: (a) => `a\u221a3/4 = ${(a * Math.sqrt(3) / 4).toFixed(3)} \u00c5` },
];

function makeLabelSprite(text, color) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const fontSize = 40;
  ctx.font = `600 ${fontSize}px ui-monospace, monospace`;
  const w = Math.ceil(ctx.measureText(text).width) + 36;
  const h = fontSize + 26;
  canvas.width = w;
  canvas.height = h;
  ctx.font = `600 ${fontSize}px ui-monospace, monospace`;
  ctx.fillStyle = 'rgba(10,14,20,0.88)';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, w - 2, h - 2);
  ctx.fillStyle = color;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 16, h / 2 + 2);
  const texture = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  const scale = 0.011;
  sprite.scale.set(w * scale, h * scale, 1);
  return sprite;
}

function refreshLabelSprite(sprite, text, color) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const fontSize = 40;
  ctx.font = `600 ${fontSize}px ui-monospace, monospace`;
  const w = Math.ceil(ctx.measureText(text).width) + 36;
  const h = fontSize + 26;
  canvas.width = w;
  canvas.height = h;
  ctx.font = `600 ${fontSize}px ui-monospace, monospace`;
  ctx.fillStyle = 'rgba(10,14,20,0.88)';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, w - 2, h - 2);
  ctx.fillStyle = color;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 16, h / 2 + 2);
  const texture = new THREE.CanvasTexture(canvas);
  if (sprite.material.map) sprite.material.map.dispose();
  sprite.material.map = texture;
  sprite.material.needsUpdate = true;
  const scale = 0.011;
  sprite.scale.set(w * scale, h * scale, 1);
}

function buildGhostCube(offsetVec, color) {
  const pts = [];
  CUBE_EDGES.forEach(([p1, p2]) => {
    const v1 = toVec(p1).add(offsetVec);
    const v2 = toVec(p2).add(offsetVec);
    pts.push(v1.x, v1.y, v1.z, v2.x, v2.y, v2.z);
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.35 });
  return new THREE.LineSegments(geo, mat);
}

function disposeObject3D(obj) {
  obj.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      if (child.material.map) child.material.map.dispose();
      child.material.dispose();
    }
  });
}

export default function FCCLatticeViewer() {
  const mountRef = useRef(null);
  const stateRef = useRef({});
  const [showAtoms, setShowAtoms] = useState(true);
  const [showBonds, setShowBonds] = useState(true);
  const [showOcta, setShowOcta] = useState(false);
  const [showTetra, setShowTetra] = useState(false);
  const [atomScale, setAtomScale] = useState(0.55);
  const [autoRotate, setAutoRotate] = useState(true);
  const [coordAtomIndex, setCoordAtomIndex] = useState(null);
  const [ghostCellCount, setGhostCellCount] = useState(0);
  const [measState, setMeasState] = useState({ side: false, face: false, body: false, octaR: false, tetraR: false });
  const [selectedCompoundId, setSelectedCompoundId] = useState('cu');
  const compound = COMPOUNDS.find((c) => c.id === selectedCompoundId) || COMPOUNDS[0];
  const aReal = compound.a;
  const rReal = (aReal * Math.SQRT2) / 4; // metallic radius, atoms touch along face diagonal in FCC

  // ---------- Scene setup (runs once) ----------
  useEffect(() => {
    const mount = mountRef.current;
    const width = mount.clientWidth;
    const height = mount.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(COLORS.bg);

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 200);
    const dist = A * 2.1;
    const center = new THREE.Vector3(A / 2, A / 2, A / 2);
    camera.position.set(dist, dist * 0.78, dist);
    camera.lookAt(center);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0x6b7f99, 0.55));
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.1);
    keyLight.position.set(A * 3, A * 4, A * 2);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0x88aaff, 0.35);
    fillLight.position.set(-A * 2, -A, -A * 3);
    scene.add(fillLight);

    const rig = new THREE.Group();
    scene.add(rig);
    rig.position.copy(center);
    const world = new THREE.Group();
    world.position.set(-A / 2, -A / 2, -A / 2);
    rig.add(world);

    // Unit cell edges
    const edgePts = [];
    CUBE_EDGES.forEach(([p1, p2]) => {
      const v1 = toVec(p1), v2 = toVec(p2);
      edgePts.push(v1.x, v1.y, v1.z, v2.x, v2.y, v2.z);
    });
    const edgeGeo = new THREE.BufferGeometry();
    edgeGeo.setAttribute('position', new THREE.Float32BufferAttribute(edgePts, 3));
    const edgeMat = new THREE.LineBasicMaterial({ color: COLORS.edge, transparent: true, opacity: 0.85 });
    world.add(new THREE.LineSegments(edgeGeo, edgeMat));

    // Atoms
    const allAtomFrac = [...CORNER_FRAC, ...FACE_FRAC];
    const atomGeo = new THREE.SphereGeometry(1, 32, 24);
    const atomMat = new THREE.MeshStandardMaterial({
      color: COLORS.atom, emissive: COLORS.atomEmissive, roughness: 0.35, metalness: 0.25,
    });
    const atomGroup = new THREE.Group();
    const positions = allAtomFrac.map(toVec);
    const atomMeshes = positions.map((p) => {
      const m = new THREE.Mesh(atomGeo, atomMat);
      m.position.copy(p);
      atomGroup.add(m);
      return m;
    });
    world.add(atomGroup);

    // Bonds (nearest-neighbor pairs within the drawn cell)
    const bondGroup = new THREE.Group();
    const bondMat = new THREE.MeshStandardMaterial({ color: COLORS.bond, roughness: 0.6 });
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const d = positions[i].distanceTo(positions[j]);
        if (Math.abs(d - R_NN) < EPS) {
          const mid = positions[i].clone().add(positions[j]).multiplyScalar(0.5);
          const dir = positions[j].clone().sub(positions[i]);
          const len = dir.length();
          const cyl = new THREE.CylinderGeometry(0.045, 0.045, len, 8);
          const mesh = new THREE.Mesh(cyl, bondMat);
          mesh.position.copy(mid);
          mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
          bondGroup.add(mesh);
        }
      }
    }
    world.add(bondGroup);

    // Octahedral voids + their coordination bonds
    const octaGroup = new THREE.Group();
    const octaGeo = new THREE.OctahedronGeometry(0.42, 0);
    const octaMat = new THREE.MeshStandardMaterial({ color: COLORS.octa, transparent: true, opacity: 0.55, roughness: 0.4 });
    OCTA_FRAC.forEach((f) => {
      const m = new THREE.Mesh(octaGeo, octaMat);
      m.position.copy(toVec(f));
      octaGroup.add(m);
    });
    octaGroup.visible = false;
    world.add(octaGroup);

    const octaBondGroup = new THREE.Group();
    const octaBondMat = new THREE.MeshStandardMaterial({ color: COLORS.octa, transparent: true, opacity: 0.55, roughness: 0.5 });
    OCTA_FRAC.forEach((vf) => {
      const vPos = toVec(vf);
      positions.forEach((aPos) => {
        const d = vPos.distanceTo(aPos);
        if (Math.abs(d - R_OCTA_BOND) < EPS) {
          const mid = vPos.clone().add(aPos).multiplyScalar(0.5);
          const dir = aPos.clone().sub(vPos);
          const len = dir.length();
          const cyl = new THREE.CylinderGeometry(0.022, 0.022, len, 6);
          const mesh = new THREE.Mesh(cyl, octaBondMat);
          mesh.position.copy(mid);
          mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
          octaBondGroup.add(mesh);
        }
      });
    });
    octaBondGroup.visible = false;
    world.add(octaBondGroup);

    // Tetrahedral voids + their coordination bonds
    const tetraGroup = new THREE.Group();
    const tetraGeo = new THREE.TetrahedronGeometry(0.32, 0);
    const tetraMat = new THREE.MeshStandardMaterial({ color: COLORS.tetra, transparent: true, opacity: 0.6, roughness: 0.4 });
    TETRA_FRAC.forEach((f) => {
      const m = new THREE.Mesh(tetraGeo, tetraMat);
      m.position.copy(toVec(f));
      tetraGroup.add(m);
    });
    tetraGroup.visible = false;
    world.add(tetraGroup);

    const tetraBondGroup = new THREE.Group();
    const tetraBondMat = new THREE.MeshStandardMaterial({ color: COLORS.tetra, transparent: true, opacity: 0.6, roughness: 0.5 });
    TETRA_FRAC.forEach((vf) => {
      const vPos = toVec(vf);
      positions.forEach((aPos) => {
        const d = vPos.distanceTo(aPos);
        if (Math.abs(d - R_TETRA_BOND) < EPS) {
          const mid = vPos.clone().add(aPos).multiplyScalar(0.5);
          const dir = aPos.clone().sub(vPos);
          const len = dir.length();
          const cyl = new THREE.CylinderGeometry(0.022, 0.022, len, 6);
          const mesh = new THREE.Mesh(cyl, tetraBondMat);
          mesh.position.copy(mid);
          mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
          tetraBondGroup.add(mesh);
        }
      });
    });
    tetraBondGroup.visible = false;
    world.add(tetraBondGroup);

    // Measurement group (dimension lines + labels), built once, text refreshed when compound changes
    const measGroup = new THREE.Group();
    const measSubgroups = {};
    const measSprites = {};
    MEASUREMENTS.forEach((m) => {
      const g = new THREE.Group();
      const v1 = toVec(m.p1), v2 = toVec(m.p2);
      const dir = v2.clone().sub(v1);
      const len = dir.length();
      const mid = v1.clone().add(v2).multiplyScalar(0.5);
      const cyl = new THREE.CylinderGeometry(0.03, 0.03, len, 8);
      const mat = new THREE.MeshBasicMaterial({ color: m.color });
      const mesh = new THREE.Mesh(cyl, mat);
      mesh.position.copy(mid);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
      g.add(mesh);
      const sprite = makeLabelSprite(m.text(COMPOUNDS[0].a), m.color);
      sprite.position.copy(mid).add(new THREE.Vector3(0, 0.4, 0));
      g.add(sprite);
      g.visible = false;
      measSubgroups[m.key] = g;
      measSprites[m.key] = sprite;
      measGroup.add(g);
    });
    world.add(measGroup);

    stateRef.current = {
      scene, camera, renderer, rig, world, center,
      atomGroup, atomMeshes, bondGroup,
      octaGroup, octaBondGroup, tetraGroup, tetraBondGroup,
      measSubgroups, measSprites, coordGroup: null,
      dragging: false, moved: false, lastX: 0, lastY: 0, downX: 0, downY: 0,
      rotY: 0.5, rotX: -0.35, dist,
    };
    rig.rotation.y = stateRef.current.rotY;
    rig.rotation.x = stateRef.current.rotX;

    // ---------- Interaction ----------
    const dom = renderer.domElement;
    const raycaster = new THREE.Raycaster();

    const doRaycast = (clientX, clientY) => {
      const rect = dom.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(mouse, stateRef.current.camera);
      const hits = raycaster.intersectObjects(stateRef.current.atomMeshes);
      if (hits.length > 0) {
        const idx = stateRef.current.atomMeshes.indexOf(hits[0].object);
        setCoordAtomIndex((prev) => (prev === idx ? null : idx));
      }
    };

    const onDown = (e) => {
      const p = e.touches ? e.touches[0] : e;
      stateRef.current.dragging = true;
      stateRef.current.moved = false;
      stateRef.current.lastX = p.clientX;
      stateRef.current.lastY = p.clientY;
      stateRef.current.downX = p.clientX;
      stateRef.current.downY = p.clientY;
    };
    const onMove = (e) => {
      if (!stateRef.current.dragging) return;
      const p = e.touches ? e.touches[0] : e;
      const dx = p.clientX - stateRef.current.lastX;
      const dy = p.clientY - stateRef.current.lastY;
      stateRef.current.lastX = p.clientX;
      stateRef.current.lastY = p.clientY;
      if (Math.abs(p.clientX - stateRef.current.downX) > 4 || Math.abs(p.clientY - stateRef.current.downY) > 4) {
        stateRef.current.moved = true;
      }
      stateRef.current.rotY += dx * 0.008;
      stateRef.current.rotX += dy * 0.008;
      stateRef.current.rotX = Math.max(-1.4, Math.min(1.4, stateRef.current.rotX));
    };
    const onUp = (e) => {
      stateRef.current.dragging = false;
      if (!stateRef.current.moved) {
        const p = e.changedTouches ? e.changedTouches[0] : e;
        doRaycast(p.clientX, p.clientY);
      }
    };
    const onWheel = (e) => {
      e.preventDefault();
      stateRef.current.dist = Math.max(A * 1.1, Math.min(A * 6, stateRef.current.dist + e.deltaY * 0.01));
    };

    dom.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    dom.addEventListener('touchstart', onDown, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onUp);
    dom.addEventListener('wheel', onWheel, { passive: false });

    let raf;
    const animate = () => {
      const s = stateRef.current;
      if (autoRotateRef.current && !s.dragging) s.rotY += 0.0028;
      s.rig.rotation.y = s.rotY;
      s.rig.rotation.x = s.rotX;
      const dir = s.camera.position.clone().sub(center).normalize();
      s.camera.position.copy(center.clone().add(dir.multiplyScalar(s.dist)));
      s.camera.lookAt(center);
      s.renderer.render(s.scene, s.camera);
      raf = requestAnimationFrame(animate);
    };
    animate();

    const onResize = () => {
      const w = mount.clientWidth, h = mount.clientHeight;
      stateRef.current.camera.aspect = w / h;
      stateRef.current.camera.updateProjectionMatrix();
      stateRef.current.renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      dom.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      dom.removeEventListener('touchstart', onDown);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
      dom.removeEventListener('wheel', onWheel);
      renderer.dispose();
      if (mount.contains(dom)) mount.removeChild(dom);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const autoRotateRef = useRef(autoRotate);
  useEffect(() => { autoRotateRef.current = autoRotate; }, [autoRotate]);

  useEffect(() => {
    const s = stateRef.current;
    if (!s.atomGroup) return;
    s.atomGroup.visible = showAtoms;
    s.bondGroup.visible = showBonds;
    s.octaGroup.visible = showOcta;
    s.octaBondGroup.visible = showOcta;
    s.tetraGroup.visible = showTetra;
    s.tetraBondGroup.visible = showTetra;
  }, [showAtoms, showBonds, showOcta, showTetra]);

  useEffect(() => {
    const s = stateRef.current;
    if (!s.atomMeshes) return;
    s.atomMeshes.forEach((m) => m.scale.setScalar(atomScale));
  }, [atomScale]);

  useEffect(() => {
    const s = stateRef.current;
    if (!s.measSubgroups) return;
    Object.entries(measState).forEach(([key, on]) => {
      if (s.measSubgroups[key]) s.measSubgroups[key].visible = on;
    });
  }, [measState]);

  useEffect(() => {
    const s = stateRef.current;
    if (!s.measSprites) return;
    MEASUREMENTS.forEach((m) => {
      refreshLabelSprite(s.measSprites[m.key], m.text(aReal), m.color);
    });
  }, [aReal]);

  // ---------- Coordination shell: click an atom -> show its 12 neighbors + ghost cells ----------
  useEffect(() => {
    const s = stateRef.current;
    if (!s.world) return;
    if (s.coordGroup) {
      s.world.remove(s.coordGroup);
      disposeObject3D(s.coordGroup);
      s.coordGroup = null;
    }
    if (coordAtomIndex == null) {
      setGhostCellCount(0);
      return;
    }
    const atomPos = s.atomMeshes[coordAtomIndex].position.clone();
    const group = new THREE.Group();

    // highlight ring around selected atom
    const ringGeo = new THREE.TorusGeometry(0.75 * atomScale + 0.15, 0.03, 8, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: COLORS.highlight });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.copy(atomPos);
    group.add(ring);

    // ghost cells for neighbors that fall outside the drawn base cell
    const ghostKeys = new Set();
    const neighborMat = new THREE.MeshStandardMaterial({ color: COLORS.highlight, emissive: 0x332200, roughness: 0.4, metalness: 0.2 });
    const bondMat = new THREE.MeshBasicMaterial({ color: COLORS.highlight });
    const neighborGeo = new THREE.SphereGeometry(0.85 * atomScale, 24, 18);

    FCC_NN_OFFSETS.forEach((offset) => {
      const nPos = atomPos.clone().add(offset);
      // determine which adjacent cell (if any) this neighbor lands in
      const cx = nPos.x < -EPS ? -1 : nPos.x > A + EPS ? 1 : 0;
      const cy = nPos.y < -EPS ? -1 : nPos.y > A + EPS ? 1 : 0;
      const cz = nPos.z < -EPS ? -1 : nPos.z > A + EPS ? 1 : 0;
      if (cx || cy || cz) {
        const key = `${cx},${cy},${cz}`;
        if (!ghostKeys.has(key)) {
          ghostKeys.add(key);
          const cellOffset = new THREE.Vector3(cx * A, cy * A, cz * A);
          group.add(buildGhostCube(cellOffset, COLORS.ghost));
        }
      }
      // neighbor marker
      const nMesh = new THREE.Mesh(neighborGeo, neighborMat);
      nMesh.position.copy(nPos);
      group.add(nMesh);
      // bond to selected atom
      const dir = nPos.clone().sub(atomPos);
      const len = dir.length();
      const cyl = new THREE.CylinderGeometry(0.05, 0.05, len, 8);
      const mesh = new THREE.Mesh(cyl, bondMat);
      mesh.position.copy(atomPos.clone().add(nPos).multiplyScalar(0.5));
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
      group.add(mesh);
    });

    const label = makeLabelSprite('CN = 12', '#f4d35e');
    label.position.copy(atomPos).add(new THREE.Vector3(0, 1.0, 0));
    group.add(label);

    s.world.add(group);
    s.coordGroup = group;
    setGhostCellCount(ghostKeys.size);
  }, [coordAtomIndex, atomScale]);

  const Toggle = useCallback(({ active, onClick, icon: Icon, label, accent }) => (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 12px', borderRadius: 7,
        border: `1px solid ${active ? accent : '#2a3441'}`,
        background: active ? `${accent}1a` : 'transparent',
        color: active ? accent : '#8b98a9',
        fontFamily: "ui-monospace, monospace",
        fontSize: 12, letterSpacing: '0.03em', cursor: 'pointer',
        width: '100%', transition: 'all 0.15s ease',
      }}
    >
      <Icon size={14} strokeWidth={2} />
      {label}
    </button>
  ), []);

  const SectionLabel = ({ children }) => (
    <div style={{
      color: '#5a6b80', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase',
      marginBottom: 10, fontFamily: "ui-monospace, monospace",
    }}>{children}</div>
  );

  return (
    <div style={{
      display: 'flex', width: '100%', height: 600, background: '#0c1118',
      borderRadius: 12, overflow: 'hidden', border: '1px solid #1c2530',
      fontFamily: "ui-sans-serif, system-ui, sans-serif",
    }}>
      <div style={{ flex: 1, position: 'relative' }} ref={mountRef}>
        <div style={{
          position: 'absolute', top: 14, left: 16,
          color: '#c8d3e0', fontSize: 11, letterSpacing: '0.12em',
          textTransform: 'uppercase', opacity: 0.65,
          fontFamily: "ui-monospace, monospace",
        }}>
          FCC · Face-Centered Cubic
        </div>

        <div style={{
          position: 'absolute', top: 14, right: 16,
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 10px', borderRadius: 7,
          background: coordAtomIndex != null ? 'rgba(244,211,94,0.12)' : 'rgba(20,26,34,0.75)',
          border: `1px solid ${coordAtomIndex != null ? '#f4d35e' : '#2a3441'}`,
          color: coordAtomIndex != null ? '#f4d35e' : '#8b98a9',
          fontSize: 11, fontFamily: "ui-monospace, monospace",
        }}>
          {coordAtomIndex != null ? (
            <>
              <span>CN shell active · {ghostCellCount} neighbor {ghostCellCount === 1 ? 'cell' : 'cells'} shown</span>
              <button
                onClick={() => setCoordAtomIndex(null)}
                style={{ background: 'none', border: 'none', color: '#f4d35e', cursor: 'pointer', display: 'flex' }}
              >
                <X size={13} />
              </button>
            </>
          ) : (
            <>
              <MousePointerClick size={13} />
              <span>Click an atom to reveal its coordination shell</span>
            </>
          )}
        </div>

        <div style={{
          position: 'absolute', bottom: 14, left: 16,
          color: '#5a6b80', fontSize: 10.5,
          fontFamily: "ui-monospace, monospace",
        }}>
          drag to rotate · scroll to zoom · click an atom for CN
        </div>
      </div>

      <div style={{
        width: 240, background: '#0f141b', borderLeft: '1px solid #1c2530',
        padding: '18px 14px', display: 'flex', flexDirection: 'column', gap: 16,
        overflowY: 'auto',
      }}>
        <div>
          <SectionLabel>Compound</SectionLabel>
          <select
            value={selectedCompoundId}
            onChange={(e) => setSelectedCompoundId(e.target.value)}
            style={{
              width: '100%', padding: '8px 10px', borderRadius: 7,
              background: '#141a22', border: '1px solid #2a3441', color: '#c8d3e0',
              fontFamily: "ui-monospace, monospace", fontSize: 12.5, cursor: 'pointer',
            }}
          >
            {COMPOUNDS.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div>
          <SectionLabel>Display</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Toggle active={showAtoms} onClick={() => setShowAtoms(v => !v)} icon={Atom} label="ATOMS" accent="#8fb4d9" />
            <Toggle active={showBonds} onClick={() => setShowBonds(v => !v)} icon={Link2} label="BONDS" accent="#8fb4d9" />
            <Toggle active={showOcta} onClick={() => setShowOcta(v => !v)} icon={Diamond} label="OCTAHEDRAL VOIDS (6-CN)" accent="#d98e3f" />
            <Toggle active={showTetra} onClick={() => setShowTetra(v => !v)} icon={Triangle} label="TETRAHEDRAL VOIDS (4-CN)" accent="#4fd1c5" />
          </div>
        </div>

        <div>
          <SectionLabel>Measurements</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {MEASUREMENTS.map((m) => (
              <Toggle
                key={m.key}
                active={measState[m.key]}
                onClick={() => setMeasState((prev) => ({ ...prev, [m.key]: !prev[m.key] }))}
                icon={Ruler}
                label={m.label.toUpperCase()}
                accent={m.color}
              />
            ))}
          </div>
        </div>

        <div>
          <SectionLabel>Atom radius</SectionLabel>
          <input
            type="range" min={0.25} max={0.85} step={0.01} value={atomScale}
            onChange={(e) => setAtomScale(parseFloat(e.target.value))}
            style={{ width: '100%', accentColor: '#8fb4d9' }}
          />
        </div>

        <Toggle active={autoRotate} onClick={() => setAutoRotate(v => !v)} icon={RotateCw} label="AUTO-ROTATE" accent="#8fb4d9" />

        <div style={{ borderTop: '1px solid #1c2530', paddingTop: 14, marginTop: 'auto' }}>
          <SectionLabel>Structure (any FCC)</SectionLabel>
          <ReadoutRow label="Coordination №" value="12" />
          <ReadoutRow label="Packing fraction" value="0.740" />
          <ReadoutRow label="Octa. voids / cell" value="4" />
          <ReadoutRow label="Tetra. voids / cell" value="8" />
          <ReadoutRow label="r(oct) / r(atom)" value="0.414" />
          <ReadoutRow label="r(tet) / r(atom)" value="0.225" />
        </div>

        <div style={{ borderTop: '1px solid #1c2530', paddingTop: 14 }}>
          <SectionLabel>{compound.name}</SectionLabel>
          <ReadoutRow label="Lattice constant a" value={`${aReal.toFixed(3)} \u00c5`} />
          <ReadoutRow label="Atomic radius r" value={`${rReal.toFixed(3)} \u00c5`} />
          <ReadoutRow label="Nearest-neighbor dist." value={`${(aReal / Math.SQRT2).toFixed(3)} \u00c5`} />
          <ReadoutRow label="Octa. void radius" value={`${(aReal * 0.5 - rReal).toFixed(3)} \u00c5`} />
          <ReadoutRow label="Tetra. void radius" value={`${((aReal * Math.sqrt(3)) / 4 - rReal).toFixed(3)} \u00c5`} />
        </div>
      </div>
    </div>
  );
}

function ReadoutRow({ label, value }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      padding: '4px 0', borderBottom: '1px solid #161c25',
    }}>
      <span style={{ color: '#748199', fontSize: 11 }}>{label}</span>
      <span style={{
        color: '#c8d3e0', fontSize: 12.5, fontFamily: "ui-monospace, monospace",
      }}>{value}</span>
    </div>
  );
}