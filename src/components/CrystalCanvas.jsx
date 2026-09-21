import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import {
  MousePointerClick,
  X,
  Eye,
  Maximize2,
  Compass,
  CheckCircle2,
} from 'lucide-react';
import {
  fracToVec,
  getHexPrismPositions,
  computeBondsAdaptive,
  solvePeriodicCoordinationShell,
  getVoidCoordinationConnectors,
  computeMillerPlanePolygon,
  makeCellWireframe,
} from '../math/crystallography.js';

const COLORS = {
  bg: 0x0a0e14,
  bond: 0x506277,
  edge: 0x314256,
  octa: 0xf59e0b,
  tetra: 0x06b6d4,
  highlight: 0xfacc15,
  ghostNeighbor: 0x93c5fd,
  ghostCell: 0x22364c,
  plane100: 0xef4444,
  plane110: 0x10b981,
  plane111: 0x6366f1,
};

function makeLabelSprite(text, color) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const fontSize = 36;
  ctx.font = `600 ${fontSize}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  const w = Math.ceil(ctx.measureText(text).width) + 36;
  const h = fontSize + 26;
  canvas.width = w;
  canvas.height = h;

  ctx.font = `600 ${fontSize}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  ctx.fillStyle = 'rgba(10, 14, 20, 0.92)';
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.strokeRect(1, 1, w - 2, h - 2);

  ctx.fillStyle = color;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 18, h / 2 + 2);

  const texture = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  const scale = 0.0105;
  sprite.scale.set(w * scale, h * scale, 1);
  return sprite;
}

function makeBondMesh(p1, p2, radius, material) {
  const dir = p2.clone().sub(p1);
  const len = dir.length();
  if (len < 0.001) return new THREE.Group();
  const cyl = new THREE.CylinderGeometry(radius, radius, len, 12);
  const mesh = new THREE.Mesh(cyl, material);
  mesh.position.copy(p1.clone().add(p2).multiplyScalar(0.5));
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  return mesh;
}

function disposeObject3D(obj) {
  if (!obj) return;
  obj.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      if (Array.isArray(child.material)) {
        child.material.forEach((m) => {
          if (m.map) m.map.dispose();
          m.dispose();
        });
      } else {
        if (child.material.map) child.material.map.dispose();
        child.material.dispose();
      }
    }
  });
}

export default function CrystalCanvas({
  structureDef,
  compound,
  activeA,
  activeC,
  effectiveCompound,
  showAtoms,
  showBonds,
  showOcta,
  showTetra,
  showVoidCages,
  showMillerPlanes,
  activeMillerPlane,
  supercellSize,
  measState,
  atomScale,
  autoRotate,
  stochasticDisorder,
  pztFraction,
  resetTrigger,
}) {
  const mountRef = useRef(null);
  const stateRef = useRef({});
  const [selectedAtomIndex, setSelectedAtomIndex] = useState(null);
  const [coordShellData, setCoordShellData] = useState(null);

  const isHex = structureDef.system === 'hexagonal';
  const isPerovskite = structureDef.id === 'perovskite';
  const isTwoSpeciesIonic = structureDef.basisType === 'ionic_binary';

  // ------------------------------------------------------------
  // ONE-TIME SETUP: Scene, Camera, Renderer, Orbit-style Controls
  // ------------------------------------------------------------
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth || 800;
    const height = mount.clientHeight || 600;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(COLORS.bg);

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 500);
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = false;
    mount.appendChild(renderer.domElement);

    // Subtle lighting
    scene.add(new THREE.AmbientLight(0x758ca3, 0.65));
    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight1.position.set(12, 18, 14);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x90b0d4, 0.5);
    dirLight2.position.set(-12, -8, -10);
    scene.add(dirLight2);

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
      lastX: 0,
      lastY: 0,
      downX: 0,
      downY: 0,
      rotY: 0.55,
      rotX: -0.32,
      dist: 12,
      targetDist: 12,
      center: new THREE.Vector3(0, 0, 0),
      atomMeshes: [],
      atomPositions: [],
      atomRoles: [],
      coordGroup: null,
      autoRotate: true,
    };

    rig.rotation.y = stateRef.current.rotY;
    rig.rotation.x = stateRef.current.rotX;

    const dom = renderer.domElement;
    const raycaster = new THREE.Raycaster();

    const doRaycast = (clientX, clientY) => {
      const rect = dom.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(mouse, stateRef.current.camera);
      const hits = raycaster.intersectObjects(stateRef.current.atomMeshes || []);
      if (hits.length > 0) {
        const idx = stateRef.current.atomMeshes.indexOf(hits[0].object);
        if (idx !== -1) {
          setSelectedAtomIndex((prev) => (prev === idx ? null : idx));
        }
      }
    };

    const onMouseDown = (e) => {
      const s = stateRef.current;
      s.dragging = true;
      s.moved = false;
      s.lastX = e.clientX;
      s.lastY = e.clientY;
      s.downX = e.clientX;
      s.downY = e.clientY;
    };

    const onMouseMove = (e) => {
      const s = stateRef.current;
      if (!s.dragging) return;
      const dx = e.clientX - s.lastX;
      const dy = e.clientY - s.lastY;
      s.lastX = e.clientX;
      s.lastY = e.clientY;
      if (Math.abs(e.clientX - s.downX) > 4 || Math.abs(e.clientY - s.downY) > 4) {
        s.moved = true;
      }
      s.rotY += dx * 0.0075;
      s.rotX += dy * 0.0075;
      s.rotX = Math.max(-1.45, Math.min(1.45, s.rotX));
    };

    const onMouseUp = (e) => {
      const s = stateRef.current;
      s.dragging = false;
      if (!s.moved) {
        doRaycast(e.clientX, e.clientY);
      }
    };

    // Touch support
    let touchStartDist = 0;
    const onTouchStart = (e) => {
      const s = stateRef.current;
      if (e.touches.length === 1) {
        s.dragging = true;
        s.moved = false;
        s.lastX = e.touches[0].clientX;
        s.lastY = e.touches[0].clientY;
        s.downX = e.touches[0].clientX;
        s.downY = e.touches[0].clientY;
      } else if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        touchStartDist = Math.hypot(dx, dy);
      }
    };

    const onTouchMove = (e) => {
      const s = stateRef.current;
      if (e.touches.length === 1 && s.dragging) {
        const dx = e.touches[0].clientX - s.lastX;
        const dy = e.touches[0].clientY - s.lastY;
        s.lastX = e.touches[0].clientX;
        s.lastY = e.touches[0].clientY;
        if (Math.abs(e.touches[0].clientX - s.downX) > 4 || Math.abs(e.touches[0].clientY - s.downY) > 4) {
          s.moved = true;
        }
        s.rotY += dx * 0.008;
        s.rotX += dy * 0.008;
        s.rotX = Math.max(-1.45, Math.min(1.45, s.rotX));
      } else if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const currentDist = Math.hypot(dx, dy);
        const factor = touchStartDist / currentDist;
        s.dist = Math.max(2, Math.min(80, s.dist * (1 + (factor - 1) * 0.05)));
        touchStartDist = currentDist;
      }
    };

    const onTouchEnd = (e) => {
      const s = stateRef.current;
      s.dragging = false;
      if (!s.moved && e.changedTouches && e.changedTouches.length === 1) {
        doRaycast(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
      }
    };

    const onWheel = (e) => {
      e.preventDefault();
      const s = stateRef.current;
      s.dist = Math.max(2.5, Math.min(80, s.dist + e.deltaY * 0.012));
    };

    dom.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    dom.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd);
    dom.addEventListener('wheel', onWheel, { passive: false });

    let rafId;
    const animate = () => {
      const s = stateRef.current;
      if (s.autoRotate && !s.dragging) {
        s.rotY += 0.0024;
      }
      s.rig.rotation.y = s.rotY;
      s.rig.rotation.x = s.rotX;

      const dir = s.camera.position.clone().sub(s.center).normalize();
      if (dir.lengthSq() < 0.001) dir.set(1, 0.6, 1).normalize();
      s.camera.position.copy(s.center.clone().add(dir.multiplyScalar(s.dist)));
      s.camera.lookAt(s.center);

      s.renderer.render(s.scene, s.camera);
      rafId = requestAnimationFrame(animate);
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
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
      dom.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      dom.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      dom.removeEventListener('wheel', onWheel);
      renderer.dispose();
      if (mount.contains(dom)) mount.removeChild(dom);
    };
  }, []);

  // Update auto-rotate in state ref
  useEffect(() => {
    stateRef.current.autoRotate = autoRotate;
  }, [autoRotate]);

  // Handle external reset camera viewpoint
  useEffect(() => {
    if (resetTrigger == null) return;
    const s = stateRef.current;
    if (s.rig) {
      s.rotY = 0.55;
      s.rotX = -0.32;
    }
    setSelectedAtomIndex(null);
  }, [resetTrigger]);

  // ------------------------------------------------------------
  // REBUILD 3D GEOMETRY ON PARAMETER CHANGE
  // ------------------------------------------------------------
  useEffect(() => {
    const s = stateRef.current;
    if (!s.world) return;

    // Clean up previous meshes
    while (s.world.children.length > 0) {
      const child = s.world.children.pop();
      disposeObject3D(child);
    }
    setSelectedAtomIndex(null);
    setCoordShellData(null);

    const a = activeA;
    const c = activeC || a * Math.sqrt(8 / 3);
    const nCells = supercellSize || 1;

    let basePositions = [];
    let baseRoles = []; // 'atom' | 'cation' | 'anion' | 'aSite' | 'bSite' | 'xSite'
    let octaFrac = structureDef.hasOctaVoids ? structureDef.octaFrac : null;
    let tetraFrac = structureDef.hasTetraVoids ? structureDef.tetraFrac : null;
    let octaPositions = [];
    let tetraPositions = [];
    let cellEdgeLines = [];
    let center = new THREE.Vector3(0, 0, 0);
    let camDist = 12;

    if (isHex) {
      const hex = getHexPrismPositions(a, c);
      basePositions = hex.positions;
      baseRoles = hex.positions.map(() => 'atom');
      octaPositions = hex.octaVoids;
      tetraPositions = hex.tetraVoids;
      cellEdgeLines = hex.edges;
      center = new THREE.Vector3(0, c / 2, 0);
      camDist = Math.max(a * 2.8, c * 1.8);
    } else if (isPerovskite) {
      const { aFrac, bFrac, xFrac } = structureDef;
      basePositions = [
        ...aFrac.map((f) => fracToVec(f, a)),
        ...bFrac.map((f) => fracToVec(f, a)),
        ...xFrac.map((f) => fracToVec(f, a)),
      ];
      baseRoles = [
        ...aFrac.map(() => 'aSite'),
        ...bFrac.map(() => 'bSite'),
        ...xFrac.map(() => 'xSite'),
      ];
      center = new THREE.Vector3(a / 2, a / 2, a / 2);
      camDist = a * 2.5;
    } else if (isTwoSpeciesIonic) {
      const { cationFrac, anionFrac } = structureDef;
      basePositions = [
        ...cationFrac.map((f) => fracToVec(f, a)),
        ...anionFrac.map((f) => fracToVec(f, a)),
      ];
      baseRoles = [
        ...cationFrac.map(() => 'cation'),
        ...anionFrac.map(() => 'anion'),
      ];
      center = new THREE.Vector3(a / 2, a / 2, a / 2);
      camDist = a * 2.5;
      if (octaFrac) octaPositions = octaFrac.map((f) => fracToVec(f, a));
      if (tetraFrac) tetraPositions = tetraFrac.map((f) => fracToVec(f, a));
    } else {
      // Single species cubic (SC, BCC, FCC, Diamond)
      basePositions = structureDef.atomFrac.map((f) => fracToVec(f, a));
      baseRoles = basePositions.map(() => 'atom');
      center = new THREE.Vector3(a / 2, a / 2, a / 2);
      camDist = a * 2.5;
      if (octaFrac) octaPositions = octaFrac.map((f) => fracToVec(f, a));
      if (tetraFrac) tetraPositions = tetraFrac.map((f) => fracToVec(f, a));
    }

    // Handle Supercell Tiling (1x1x1, 2x2x2, 3x3x3)
    const allPositions = [];
    const allRoles = [];
    const allUnitCellBoxes = [];

    const cellStepX = a;
    const cellStepY = isHex ? c : a;
    const cellStepZ = a;

    for (let ix = 0; ix < nCells; ix++) {
      for (let iy = 0; iy < (isHex ? 1 : nCells); iy++) {
        for (let iz = 0; iz < nCells; iz++) {
          const shift = new THREE.Vector3(ix * cellStepX, iy * cellStepY, iz * cellStepZ);
          basePositions.forEach((p, idx) => {
            allPositions.push(p.clone().add(shift));
            // Stochastic disorder for PZT solid solution in supercells
            if (
              effectiveCompound.solidSolution &&
              baseRoles[idx] === 'bSite' &&
              stochasticDisorder
            ) {
              const rand = Math.random();
              allRoles.push(rand < pztFraction ? 'bSite_ti' : 'bSite_zr');
            } else {
              allRoles.push(baseRoles[idx]);
            }
          });

          // Record wireframe bounding box for this cell
          allUnitCellBoxes.push({
            origin: shift,
            size: new THREE.Vector3(cellStepX, cellStepY, cellStepZ),
          });
        }
      }
    }

    // Recompute scene center and camera distance
    const totalCenterX = (nCells * cellStepX) / 2;
    const totalCenterY = isHex ? c / 2 : (nCells * cellStepY) / 2;
    const totalCenterZ = (nCells * cellStepZ) / 2;
    center = new THREE.Vector3(totalCenterX, totalCenterY, totalCenterZ);
    camDist = Math.max(totalCenterX, totalCenterY, totalCenterZ) * 2.8 + 4;

    s.rig.position.copy(center);
    s.world.position.copy(center.clone().multiplyScalar(-1));
    s.center = center;
    s.dist = camDist;

    // 1. UNIT CELL WIREFRAMES
    const wireframeMat = new THREE.LineBasicMaterial({
      color: COLORS.edge,
      transparent: true,
      opacity: 0.85,
      linewidth: 1.5,
    });

    if (isHex) {
      // Hexagonal prism lines
      const edgePts = [];
      cellEdgeLines.forEach(([v1, v2]) => edgePts.push(v1.x, v1.y, v1.z, v2.x, v2.y, v2.z));
      const edgeGeo = new THREE.BufferGeometry();
      edgeGeo.setAttribute('position', new THREE.Float32BufferAttribute(edgePts, 3));
      s.world.add(new THREE.LineSegments(edgeGeo, wireframeMat));
    } else {
      // Cubic cells wireframe
      const edgePts = [];
      allUnitCellBoxes.forEach((cell) => {
        const segs = makeCellWireframe(cell.origin, cell.size);
        segs.forEach(([p1, p2]) => edgePts.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z));
      });
      const edgeGeo = new THREE.BufferGeometry();
      edgeGeo.setAttribute('position', new THREE.Float32BufferAttribute(edgePts, 3));
      s.world.add(new THREE.LineSegments(edgeGeo, wireframeMat));
    }

    // 2. ATOM MESHES
    const atomGroup = new THREE.Group();
    const sphereGeo = new THREE.SphereGeometry(1, 28, 20);
    const matCache = {};

    const getMaterial = (colorHex) => {
      if (!matCache[colorHex]) {
        matCache[colorHex] = new THREE.MeshStandardMaterial({
          color: colorHex,
          roughness: 0.35,
          metalness: 0.22,
          emissive: 0x090e14,
        });
      }
      return matCache[colorHex];
    };

    const getRoleColor = (role) => {
      if (role === 'cation') return effectiveCompound.cation?.color ?? 0xd7b3ff;
      if (role === 'anion') return effectiveCompound.anion?.color ?? 0x8fd98a;
      if (role === 'aSite') return effectiveCompound.aSite?.color ?? 0xf0e68c;
      if (role === 'bSite') return effectiveCompound.bSite?.color ?? 0x7f93d1;
      if (role === 'xSite') return effectiveCompound.xSite?.color ?? 0xe86a6a;
      if (role === 'bSite_ti') return effectiveCompound.endpoints?.ti?.color ?? 0x7f93d1;
      if (role === 'bSite_zr') return effectiveCompound.endpoints?.zr?.color ?? 0xb388e8;
      return effectiveCompound.color != null ? effectiveCompound.color : 0x8fb4d9;
    };

    const atomMeshes = allPositions.map((pos, idx) => {
      const color = getRoleColor(allRoles[idx]);
      const mesh = new THREE.Mesh(sphereGeo, getMaterial(color));
      mesh.position.copy(pos);
      mesh.scale.setScalar(atomScale);
      atomGroup.add(mesh);
      return mesh;
    });

    atomGroup.visible = showAtoms;
    s.world.add(atomGroup);

    // 3. BONDS
    const bondGroup = new THREE.Group();
    const bondMat = new THREE.MeshStandardMaterial({
      color: COLORS.bond,
      roughness: 0.6,
      metalness: 0.1,
    });
    const tol = isTwoSpeciesIonic || isPerovskite ? 0.045 : 0.06;
    const { pairs } = computeBondsAdaptive(allPositions, tol);
    pairs.forEach(([i, j]) => {
      // In ionic or perovskite, only draw bonds between unlike species
      let shouldDraw = true;
      if (isTwoSpeciesIonic) {
        shouldDraw = allRoles[i] !== allRoles[j];
      } else if (isPerovskite) {
        const r1 = allRoles[i], r2 = allRoles[j];
        shouldDraw = (r1 === 'xSite' && (r2 === 'bSite' || r2 === 'aSite')) ||
                     (r2 === 'xSite' && (r1 === 'bSite' || r1 === 'aSite'));
      }
      if (shouldDraw) {
        bondGroup.add(makeBondMesh(allPositions[i], allPositions[j], 0.042, bondMat));
      }
    });

    bondGroup.visible = showBonds;
    s.world.add(bondGroup);

    // 4. VOIDS & VOID COORDINATION CAGES
    const octaGroup = new THREE.Group();
    const tetraGroup = new THREE.Group();
    const voidCageGroup = new THREE.Group();

    const octaGeo = new THREE.OctahedronGeometry(0.38, 0);
    const octaMat = new THREE.MeshStandardMaterial({
      color: COLORS.octa,
      transparent: true,
      opacity: 0.6,
      roughness: 0.35,
    });

    const tetraGeo = new THREE.TetrahedronGeometry(0.32, 0);
    const tetraMat = new THREE.MeshStandardMaterial({
      color: COLORS.tetra,
      transparent: true,
      opacity: 0.65,
      roughness: 0.35,
    });

    const hasOcta = octaPositions.length > 0;
    const hasTetra = tetraPositions.length > 0;

    octaPositions.forEach((p) => {
      const m = new THREE.Mesh(octaGeo, octaMat);
      m.position.copy(p);
      octaGroup.add(m);
    });

    tetraPositions.forEach((p) => {
      const m = new THREE.Mesh(tetraGeo, tetraMat);
      m.position.copy(p);
      tetraGroup.add(m);
    });

    // Void coordination connector cages
    const { octaConnectors, tetraConnectors } = getVoidCoordinationConnectors({
      octaVoidPositions: hasOcta ? octaPositions : [],
      tetraVoidPositions: hasTetra ? tetraPositions : [],
      atomPositions: basePositions,
      a,
    });

    const cageOctaMat = new THREE.LineBasicMaterial({
      color: COLORS.octa,
      transparent: true,
      opacity: 0.7,
      linewidth: 1,
    });
    const cageTetraMat = new THREE.LineBasicMaterial({
      color: COLORS.tetra,
      transparent: true,
      opacity: 0.7,
      linewidth: 1,
    });

    if (hasOcta && octaConnectors.length > 0) {
      const pts = [];
      octaConnectors.forEach(([p1, p2]) => pts.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z));
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      octaGroup.add(new THREE.LineSegments(geo, cageOctaMat));
    }

    if (hasTetra && tetraConnectors.length > 0) {
      const pts = [];
      tetraConnectors.forEach(([p1, p2]) => pts.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z));
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      tetraGroup.add(new THREE.LineSegments(geo, cageTetraMat));
    }

    octaGroup.visible = showOcta && hasOcta;
    tetraGroup.visible = showTetra && hasTetra;
    s.world.add(octaGroup);
    s.world.add(tetraGroup);

    // 5. MILLER PLANES
    const millerGroup = new THREE.Group();
    if (showMillerPlanes && !isHex) {
      const [h, k, l] = activeMillerPlane || [1, 1, 1];
      const planeData = computeMillerPlanePolygon(h, k, l, a);
      if (planeData && planeData.points.length >= 3) {
        const polyGeo = new THREE.BufferGeometry();
        const verts = [];
        const p0 = planeData.points[0];
        for (let i = 1; i < planeData.points.length - 1; i++) {
          const p1 = planeData.points[i];
          const p2 = planeData.points[i + 1];
          verts.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
        }
        polyGeo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
        polyGeo.computeVertexNormals();

        const planeColor =
          h === 1 && k === 0 && l === 0
            ? COLORS.plane100
            : h === 1 && k === 1 && l === 0
            ? COLORS.plane110
            : COLORS.plane111;

        const polyMat = new THREE.MeshBasicMaterial({
          color: planeColor,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.45,
          depthWrite: false,
        });
        millerGroup.add(new THREE.Mesh(polyGeo, polyMat));

        // Perimeter wireframe
        const edgePts = [];
        for (let i = 0; i < planeData.points.length; i++) {
          const p1 = planeData.points[i];
          const p2 = planeData.points[(i + 1) % planeData.points.length];
          edgePts.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
        }
        const edgeG = new THREE.BufferGeometry();
        edgeG.setAttribute('position', new THREE.Float32BufferAttribute(edgePts, 3));
        const edgeM = new THREE.LineBasicMaterial({ color: planeColor, linewidth: 2 });
        millerGroup.add(new THREE.LineSegments(edgeG, edgeM));
      }
    }
    s.world.add(millerGroup);

    // 6. DIMENSION LINES & MEASUREMENTS
    const measGroup = new THREE.Group();
    const measSubgroups = {};

    const measDefinitions = isHex
      ? [
          {
            key: 'side',
            label: 'Basal edge (a)',
            color: '#facc15',
            p1: new THREE.Vector3(a, 0, 0),
            p2: new THREE.Vector3(a * Math.cos(Math.PI / 3), 0, a * Math.sin(Math.PI / 3)),
            text: () => `a = ${a.toFixed(3)} Å`,
          },
          {
            key: 'face',
            label: 'Height (c)',
            color: '#facc15',
            p1: new THREE.Vector3(0, 0, 0),
            p2: new THREE.Vector3(0, c, 0),
            text: () => `c = ${c.toFixed(3)} Å`,
          },
        ]
      : [
          {
            key: 'side',
            label: 'Cell edge (a)',
            color: '#facc15',
            p1: new THREE.Vector3(0, 0, 0),
            p2: new THREE.Vector3(a, 0, 0),
            text: () => `a = ${a.toFixed(3)} Å`,
          },
          {
            key: 'face',
            label: 'Face diagonal (a√2)',
            color: '#facc15',
            p1: new THREE.Vector3(0, 0, 0),
            p2: new THREE.Vector3(a, a, 0),
            text: () => `a√2 = ${(a * Math.SQRT2).toFixed(3)} Å`,
          },
          {
            key: 'body',
            label: 'Body diagonal (a√3)',
            color: '#facc15',
            p1: new THREE.Vector3(0, 0, 0),
            p2: new THREE.Vector3(a, a, a),
            text: () => `a√3 = ${(a * Math.sqrt(3)).toFixed(3)} Å`,
          },
          {
            key: 'octaR',
            label: 'Octa. void radius (a/2)',
            color: '#f59e0b',
            p1: new THREE.Vector3(a * 0.5, a * 0.5, a * 0.5),
            p2: new THREE.Vector3(a * 0.5, a * 0.5, 0),
            text: () => `a/2 = ${(a * 0.5).toFixed(3)} Å`,
          },
          {
            key: 'tetraR',
            label: 'Tetra. void radius (a√3/4)',
            color: '#06b6d4',
            p1: new THREE.Vector3(a * 0.25, a * 0.25, a * 0.25),
            p2: new THREE.Vector3(0, 0, 0),
            text: () => `a√3/4 = ${(a * (Math.sqrt(3) / 4)).toFixed(3)} Å`,
          },
        ];

    measDefinitions.forEach((def) => {
      const g = new THREE.Group();
      g.add(makeBondMesh(def.p1, def.p2, 0.032, new THREE.MeshBasicMaterial({ color: def.color })));
      const sprite = makeLabelSprite(def.text(), def.color);
      const mid = def.p1.clone().add(def.p2).multiplyScalar(0.5);
      sprite.position.copy(mid).add(new THREE.Vector3(0.3, 0.35, 0.1));
      g.add(sprite);
      g.visible = measState[def.key] || false;
      measSubgroups[def.key] = g;
      measGroup.add(g);
    });

    s.world.add(measGroup);

    // Save references to state
    Object.assign(s, {
      atomGroup,
      atomMeshes,
      atomPositions: allPositions,
      atomRoles: allRoles,
      basePositions,
      baseRoles,
      bondGroup,
      octaGroup,
      tetraGroup,
      voidCageGroup,
      measSubgroups,
      hasOcta,
      hasTetra,
      coordGroup: null,
    });
  }, [
    structureDef,
    compound,
    activeA,
    activeC,
    effectiveCompound,
    supercellSize,
    stochasticDisorder,
    pztFraction,
    showMillerPlanes,
    activeMillerPlane,
  ]);

  // Display toggles update
  useEffect(() => {
    const s = stateRef.current;
    if (s.atomGroup) s.atomGroup.visible = showAtoms;
    if (s.bondGroup) s.bondGroup.visible = showBonds;
    if (s.octaGroup) s.octaGroup.visible = showOcta && s.hasOcta;
    if (s.tetraGroup) s.tetraGroup.visible = showTetra && s.hasTetra;
  }, [showAtoms, showBonds, showOcta, showTetra]);

  // Atom scale slider update
  useEffect(() => {
    const s = stateRef.current;
    if (s.atomMeshes) {
      s.atomMeshes.forEach((mesh) => mesh.scale.setScalar(atomScale));
    }
  }, [atomScale]);

  // Measurement toggles update
  useEffect(() => {
    const s = stateRef.current;
    if (!s.measSubgroups) return;
    Object.entries(measState).forEach(([key, on]) => {
      if (s.measSubgroups[key]) s.measSubgroups[key].visible = !!on;
    });
  }, [measState]);

  // ------------------------------------------------------------
  // PERIODIC COORDINATION SHELL RENDERER
  // Highlights clicked atom, renders ALL true neighbors across
  // adjacent unit cells, golden bonds, and neighbor cell wireframes!
  // ------------------------------------------------------------
  useEffect(() => {
    const s = stateRef.current;
    if (!s.world) return;

    if (s.coordGroup) {
      s.world.remove(s.coordGroup);
      disposeObject3D(s.coordGroup);
      s.coordGroup = null;
    }

    if (selectedAtomIndex == null || !s.atomPositions[selectedAtomIndex]) {
      setCoordShellData(null);
      return;
    }

    const shell = solvePeriodicCoordinationShell({
      targetIndex: selectedAtomIndex,
      atomPositions: s.atomPositions,
      atomRoles: s.atomRoles,
      structureKey: structureDef.id,
      a: activeA,
      c: activeC || activeA * Math.sqrt(8 / 3),
      isHex,
      isTwoSpeciesIonic,
      isPerovskite,
    });

    if (!shell) {
      setCoordShellData(null);
      return;
    }

    setCoordShellData(shell);

    const group = new THREE.Group();

    // 1. Glowing golden torus ring around selected atom
    const ringGeo = new THREE.TorusGeometry(0.85 * atomScale + 0.15, 0.04, 10, 36);
    const ringMat = new THREE.MeshBasicMaterial({ color: COLORS.highlight });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.copy(shell.targetPos);
    group.add(ring);

    // 2. Ghost neighbor atoms outside the unit cell
    const ghostGeo = new THREE.SphereGeometry(1, 24, 18);
    const ghostMat = new THREE.MeshStandardMaterial({
      color: COLORS.ghostNeighbor,
      roughness: 0.3,
      metalness: 0.3,
      transparent: true,
      opacity: 0.85,
    });

    // 3. Golden coordination bonds to all neighbors
    const coordBondMat = new THREE.MeshBasicMaterial({ color: COLORS.highlight });

    shell.neighbors.forEach((neighbor) => {
      // If the neighbor is in an external image cell, render it
      if (!neighbor.isPrimary) {
        const ghost = new THREE.Mesh(ghostGeo, ghostMat);
        ghost.position.copy(neighbor.pos);
        ghost.scale.setScalar(atomScale * 0.95);
        group.add(ghost);
      }
      group.add(makeBondMesh(shell.targetPos, neighbor.pos, 0.055, coordBondMat));
    });

    // 4. Ghost wireframes for neighbor unit cells
    const ghostWireMat = new THREE.LineDashedMaterial({
      color: COLORS.ghostCell,
      dashSize: 0.3,
      gapSize: 0.15,
      transparent: true,
      opacity: 0.65,
    });

    shell.neighborCells.forEach(([dx, dy, dz]) => {
      const cellOrigin = new THREE.Vector3(dx * activeA, dy * (isHex ? activeC : activeA), dz * activeA);
      const cellSize = new THREE.Vector3(activeA, isHex ? activeC : activeA, activeA);
      const segs = makeCellWireframe(cellOrigin, cellSize);
      const pts = [];
      segs.forEach(([p1, p2]) => pts.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z));
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      const line = new THREE.LineSegments(geo, ghostWireMat);
      line.computeLineDistances();
      group.add(line);
    });

    s.world.add(group);
    s.coordGroup = group;
  }, [
    selectedAtomIndex,
    atomScale,
    activeA,
    activeC,
    isHex,
    isTwoSpeciesIonic,
    isPerovskite,
    structureDef.id,
  ]);

  // Viewpoint presets
  const setViewPreset = (preset) => {
    const s = stateRef.current;
    if (!s.rig) return;
    s.autoRotate = false;
    switch (preset) {
      case 'iso':
        s.rotY = 0.55;
        s.rotX = -0.32;
        break;
      case 'front':
        s.rotY = 0;
        s.rotX = 0;
        break;
      case 'top':
        s.rotY = 0;
        s.rotX = -Math.PI / 2 + 0.001;
        break;
      case '110':
        s.rotY = Math.PI / 4;
        s.rotX = 0;
        break;
      case '111':
        s.rotY = Math.PI / 4;
        s.rotX = -Math.asin(1 / Math.sqrt(3));
        break;
      default:
        break;
    }
  };

  return (
    <div className="canvas-wrapper">
      <div className="three-mount-area" ref={mountRef} />

      {/* Top Left: Structure & Compound Badge */}
      <div className="canvas-badge-top-left">
        <div className="badge-structure-name">{structureDef.name}</div>
        <div className="badge-compound-formula">
          {compound.formula ? `${compound.name} (${compound.formula})` : compound.name}
        </div>
      </div>

      {/* Top Right: Coordination Shell Active HUD */}
      <div className="canvas-hud-top-right">
        {selectedAtomIndex != null && coordShellData ? (
          <div className="coord-hud-active">
            <div className="coord-hud-header">
              <CheckCircle2 size={14} className="hud-icon-active" />
              <span>
                Atom Selected: <strong>{coordShellData.targetRole}</strong>
              </span>
              <button
                className="hud-close-btn"
                onClick={() => setSelectedAtomIndex(null)}
                title="Clear selection"
              >
                <X size={13} />
              </button>
            </div>
            <div className="coord-hud-body">
              <div className="coord-stat-row">
                <span className="coord-label">Full Coordination Shell:</span>
                <span className="coord-val-highlight">
                  {coordShellData.totalCount} / {structureDef.cn} neighbors
                </span>
              </div>
              <div className="coord-breakdown">
                {coordShellData.internalCount} within cell +{' '}
                {coordShellData.externalCount} in neighboring unit cells
              </div>
              <div className="coord-distance">
                Nearest neighbor bond: {coordShellData.minDist.toFixed(3)} Å
              </div>
            </div>
          </div>
        ) : (
          <div className="coord-hud-idle">
            <MousePointerClick size={14} className="hud-icon-idle" />
            <span>Click any atom to reveal full periodic coordination shell</span>
          </div>
        )}
      </div>

      {/* Bottom Left: Camera Navigation Controls & Presets */}
      <div className="canvas-presets-bottom-left">
        <div className="preset-label">View Presets:</div>
        <div className="preset-btns">
          <button className="preset-btn" onClick={() => setViewPreset('iso')}>
            Isometric
          </button>
          <button className="preset-btn" onClick={() => setViewPreset('front')}>
            [100] Front
          </button>
          <button className="preset-btn" onClick={() => setViewPreset('top')}>
            [001] Top
          </button>
          <button className="preset-btn" onClick={() => setViewPreset('110')}>
            [110]
          </button>
          <button className="preset-btn" onClick={() => setViewPreset('111')}>
            [111]
          </button>
        </div>
      </div>

      {/* Bottom Right: Drag & Zoom Tips */}
      <div className="canvas-tips-bottom-right">
        <span>Drag to rotate · Scroll to zoom · Shift+drag to tilt</span>
      </div>
    </div>
  );
}
