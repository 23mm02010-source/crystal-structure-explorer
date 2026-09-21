import * as THREE from 'three';

// ============================================================
// PURE CRYSTALLOGRAPHY MATHEMATICAL ENGINE
// Handles unit cell transformations, periodic neighbor generation,
// void coordination cages, Miller plane intersections, and density.
// ============================================================

export const AVOGADRO = 6.02214076e23;

export function fracToVec([x, y, z], a) {
  return new THREE.Vector3(x * a, y * a, z * a);
}

// Convert fractional coordinates in hexagonal lattice to Cartesian
// a1 = (a, 0, 0), a2 = (-a/2, a*sqrt(3)/2, 0), a3 = (0, 0, c)
export function hexFracToVec([u, v, w], a, c) {
  const x = a * (u - 0.5 * v);
  const y = a * ((Math.sqrt(3) / 2) * v);
  const z = c * w;
  return new THREE.Vector3(x, y, z);
}

// HCP conventional hexagonal prism geometry:
// 12 corners (bottom & top rings) + 2 face centers + 3 interior atoms at z = c/2.
export function getHexPrismPositions(a, c) {
  const R = a;
  const bottom = [];
  const top = [];
  for (let k = 0; k < 6; k++) {
    const th = (k * Math.PI) / 3;
    bottom.push(new THREE.Vector3(R * Math.cos(th), 0, R * Math.sin(th)));
    top.push(new THREE.Vector3(R * Math.cos(th), c, R * Math.sin(th)));
  }
  const faceCenters = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, c, 0)];
  const rIn = a / Math.sqrt(3);
  const interior = [30, 150, 270].map((deg) => {
    const rad = (deg * Math.PI) / 180;
    return new THREE.Vector3(rIn * Math.cos(rad), c / 2, rIn * Math.sin(rad));
  });

  const positions = [...bottom, ...top, ...faceCenters, ...interior];

  // Conventional edges: bottom 6, top 6, 6 vertical struts
  const edges = [];
  for (let k = 0; k < 6; k++) {
    edges.push([bottom[k], bottom[(k + 1) % 6]]);
    edges.push([top[k], top[(k + 1) % 6]]);
    edges.push([bottom[k], top[k]]);
  }

  // Octahedral voids (6 confirmed): radius a/sqrt(3), angles 90, 210, 330, z = c/4 and 3c/4
  const octaVoids = [];
  [90, 210, 330].forEach((deg) => {
    [c / 4, (3 * c) / 4].forEach((z) => {
      const rad = (deg * Math.PI) / 180;
      octaVoids.push(new THREE.Vector3(rIn * Math.cos(rad), z, rIn * Math.sin(rad)));
    });
  });

  // Tetrahedral voids (8 shown): radius a/sqrt(3) at 30, 150, 270, z = c/8 and 7c/8 + 2 on-axis at z = 3c/8, 5c/8
  const tetraVoids = [];
  [30, 150, 270].forEach((deg) => {
    [c / 8, (7 * c) / 8].forEach((z) => {
      const rad = (deg * Math.PI) / 180;
      tetraVoids.push(new THREE.Vector3(rIn * Math.cos(rad), z, rIn * Math.sin(rad)));
    });
  });
  [(3 * c) / 8, (5 * c) / 8].forEach((z) => {
    tetraVoids.push(new THREE.Vector3(0.0001, z, 0));
  });

  const measPoints = {
    edgeA: [bottom[0], bottom[1]],
    heightC: [faceCenters[0], faceCenters[1]],
  };

  return { positions, edges, octaVoids, tetraVoids, measPoints };
}

// Adaptive bond network solver within a single set of atom positions
export function computeBondsAdaptive(positions, tol = 0.06) {
  const n = positions.length;
  if (n < 2) return { pairs: [], adjacency: new Map() };

  const distMin = new Array(n).fill(Infinity);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const d = positions[i].distanceTo(positions[j]);
      if (d < distMin[i]) distMin[i] = d;
    }
  }

  const pairs = [];
  const adjacency = new Map();
  for (let i = 0; i < n; i++) adjacency.set(i, []);

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = positions[i].distanceTo(positions[j]);
      const thresh = Math.min(distMin[i], distMin[j]) * (1 + tol);
      if (d <= thresh) {
        pairs.push([i, j]);
        adjacency.get(i).push(j);
        adjacency.get(j).push(i);
      }
    }
  }
  return { pairs, adjacency };
}

// ============================================================
// PERIODIC COORDINATION SHELL SOLVER
// Given an atom in the primary unit cell, search across periodic
// image cells (translations dx, dy, dz in {-1, 0, 1}) to find
// ALL true nearest neighbors.
// ============================================================
export function solvePeriodicCoordinationShell({
  targetIndex,
  atomPositions,
  atomRoles,
  structureKey,
  a,
  c,
  isHex,
  isTwoSpeciesIonic,
  isPerovskite,
}) {
  if (targetIndex == null || targetIndex < 0 || targetIndex >= atomPositions.length) {
    return null;
  }

  const targetPos = atomPositions[targetIndex].clone();
  const targetRole = atomRoles[targetIndex];

  // Define candidate periodic displacement vectors
  const translations = [];
  if (isHex) {
    // Hexagonal lattice basis vectors
    const a1 = new THREE.Vector3(a, 0, 0);
    const a2 = new THREE.Vector3(-a * 0.5, a * (Math.sqrt(3) / 2), 0);
    const a3 = new THREE.Vector3(0, 0, c);
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        for (let k = -1; k <= 1; k++) {
          const shift = a1.clone().multiplyScalar(i)
            .add(a2.clone().multiplyScalar(j))
            .add(a3.clone().multiplyScalar(k));
          translations.push({ shift, cell: [i, j, k] });
        }
      }
    }
  } else {
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          translations.push({
            shift: new THREE.Vector3(dx * a, dy * a, dz * a),
            cell: [dx, dy, dz],
          });
        }
      }
    }
  }

  // Find minimum distance to any unlike/coordinating site
  let minDist = Infinity;
  translations.forEach(({ shift }) => {
    atomPositions.forEach((pos, j) => {
      const cand = pos.clone().add(shift);
      const d = targetPos.distanceTo(cand);
      if (d > 0.001 && d < minDist) {
        // In ionic/perovskite, nearest neighbor is unlike species
        if (isTwoSpeciesIonic) {
          if (atomRoles[j] !== targetRole) minDist = d;
        } else if (isPerovskite) {
          if (targetRole === 'aSite' && atomRoles[j] === 'xSite') minDist = d;
          else if (targetRole === 'bSite' && atomRoles[j] === 'xSite') minDist = d;
          else if (targetRole === 'xSite' && (atomRoles[j] === 'bSite' || atomRoles[j] === 'aSite')) {
            if (minDist === Infinity || d < minDist) minDist = d;
          } else if (d < minDist) minDist = d;
        } else {
          minDist = d;
        }
      }
    });
  });

  if (!isFinite(minDist) || minDist <= 0) return null;

  // Collect all neighbors within tolerance of minDist
  const tol = 0.05 * minDist;
  const neighbors = [];
  const neighborCellSet = new Set();

  translations.forEach(({ shift, cell }) => {
    atomPositions.forEach((pos, j) => {
      const cand = pos.clone().add(shift);
      const d = targetPos.distanceTo(cand);
      const isCandidateNeighbor = Math.abs(d - minDist) <= tol;

      if (isCandidateNeighbor) {
        // Filter by role for ionic/perovskite
        let validPair = true;
        if (isTwoSpeciesIonic) {
          validPair = (atomRoles[j] !== targetRole);
        } else if (isPerovskite) {
          if (targetRole === 'aSite') validPair = (atomRoles[j] === 'xSite');
          else if (targetRole === 'bSite') validPair = (atomRoles[j] === 'xSite');
          else if (targetRole === 'xSite') validPair = (atomRoles[j] === 'bSite'); // Primary octahedral coordination
        }

        if (validPair) {
          const isPrimary = (cell[0] === 0 && cell[1] === 0 && cell[2] === 0);
          if (!isPrimary) {
            neighborCellSet.add(`${cell[0]},${cell[1]},${cell[2]}`);
          }
          neighbors.push({
            pos: cand,
            role: atomRoles[j],
            index: j,
            distance: d,
            isPrimary,
            cell,
          });
        }
      }
    });
  });

  // Unique neighbor cells that need ghost wireframes
  const neighborCells = Array.from(neighborCellSet).map((str) => str.split(',').map(Number));

  return {
    targetPos,
    targetRole,
    minDist,
    neighbors,
    totalCount: neighbors.length,
    internalCount: neighbors.filter((n) => n.isPrimary).length,
    externalCount: neighbors.filter((n) => !n.isPrimary).length,
    neighborCells,
  };
}

// ============================================================
// VOID COORDINATION CAGES
// For each octahedral void, computes thin connector lines to its 6
// coordinating atoms; for each tetrahedral void, connects to 4 atoms.
// ============================================================
export function getVoidCoordinationConnectors({
  octaVoidPositions,
  tetraVoidPositions,
  atomPositions,
  a,
}) {
  const octaConnectors = [];
  const tetraConnectors = [];

  // Translations for finding coordinating atoms across periodic boundaries
  const shifts = [];
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dz = -1; dz <= 1; dz++) {
        shifts.push(new THREE.Vector3(dx * a, dy * a, dz * a));
      }
    }
  }

  // Octahedral voids (6-coordinate)
  if (octaVoidPositions && octaVoidPositions.length > 0) {
    octaVoidPositions.forEach((vPos) => {
      // Find 6 nearest atoms
      const candidates = [];
      shifts.forEach((shift) => {
        atomPositions.forEach((aPos) => {
          const cand = aPos.clone().add(shift);
          const d = vPos.distanceTo(cand);
          candidates.push({ pos: cand, dist: d });
        });
      });
      candidates.sort((p1, p2) => p1.dist - p2.dist);
      const top6 = candidates.slice(0, 6);
      top6.forEach((c) => {
        octaConnectors.push([vPos, c.pos]);
      });
    });
  }

  // Tetrahedral voids (4-coordinate)
  if (tetraVoidPositions && tetraVoidPositions.length > 0) {
    tetraVoidPositions.forEach((vPos) => {
      const candidates = [];
      shifts.forEach((shift) => {
        atomPositions.forEach((aPos) => {
          const cand = aPos.clone().add(shift);
          const d = vPos.distanceTo(cand);
          candidates.push({ pos: cand, dist: d });
        });
      });
      candidates.sort((p1, p2) => p1.dist - p2.dist);
      const top4 = candidates.slice(0, 4);
      top4.forEach((c) => {
        tetraConnectors.push([vPos, c.pos]);
      });
    });
  }

  return { octaConnectors, tetraConnectors };
}

// ============================================================
// MILLER PLANE INTERSECTION POLYGON
// Intersects plane h*x + k*y + l*z = d with the unit cube [0, a]^3
// to generate a polygon representing the crystallographic plane.
// ============================================================
export function computeMillerPlanePolygon(h, k, l, a) {
  // Normalize direction vector
  const normal = new THREE.Vector3(h, k, l).normalize();
  if (normal.lengthSq() < 1e-6) return null;

  // Center plane passing through the middle of the unit cell: d = 0.5 * (h*a + k*a + l*a)
  const d = 0.5 * (h * a + k * a + l * a);

  // Cube edges (12 segments)
  const cubeEdges = [
    // z = 0
    [new THREE.Vector3(0, 0, 0), new THREE.Vector3(a, 0, 0)],
    [new THREE.Vector3(a, 0, 0), new THREE.Vector3(a, a, 0)],
    [new THREE.Vector3(a, a, 0), new THREE.Vector3(0, a, 0)],
    [new THREE.Vector3(0, a, 0), new THREE.Vector3(0, 0, 0)],
    // z = a
    [new THREE.Vector3(0, 0, a), new THREE.Vector3(a, 0, a)],
    [new THREE.Vector3(a, 0, a), new THREE.Vector3(a, a, a)],
    [new THREE.Vector3(a, a, a), new THREE.Vector3(0, a, a)],
    [new THREE.Vector3(0, a, a), new THREE.Vector3(0, 0, a)],
    // vertical
    [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, a)],
    [new THREE.Vector3(a, 0, 0), new THREE.Vector3(a, 0, a)],
    [new THREE.Vector3(a, a, 0), new THREE.Vector3(a, a, a)],
    [new THREE.Vector3(0, a, 0), new THREE.Vector3(0, a, a)],
  ];

  const points = [];
  const eps = 1e-4;

  cubeEdges.forEach(([p1, p2]) => {
    const val1 = h * p1.x + k * p1.y + l * p1.z - d;
    const val2 = h * p2.x + k * p2.y + l * p2.z - d;
    if ((val1 > eps && val2 < -eps) || (val1 < -eps && val2 > eps)) {
      const t = val1 / (val1 - val2);
      const intersection = p1.clone().lerp(p2, t);
      // Check duplicate
      const isDup = points.some((p) => p.distanceTo(intersection) < 1e-3);
      if (!isDup) points.push(intersection);
    } else if (Math.abs(val1) <= eps) {
      if (!points.some((p) => p.distanceTo(p1) < 1e-3)) points.push(p1.clone());
    }
  });

  if (points.length < 3) return null;

  // Order vertices around centroid in the plane
  const centroid = new THREE.Vector3();
  points.forEach((p) => centroid.add(p));
  centroid.multiplyScalar(1 / points.length);

  // Coordinate system on plane
  const u = points[0].clone().sub(centroid).normalize();
  const v = new THREE.Vector3().crossVectors(normal, u).normalize();

  points.sort((pA, pB) => {
    const vA = pA.clone().sub(centroid);
    const vB = pB.clone().sub(centroid);
    const angA = Math.atan2(vA.dot(v), vA.dot(u));
    const angB = Math.atan2(vB.dot(v), vB.dot(u));
    return angA - angB;
  });

  return { points, normal, centroid };
}

// ============================================================
// THEORETICAL DENSITY CALCULATOR
// rho = (n * M) / (V * N_A) in g/cm³
// a, c in Å; 1 Å³ = 1e-24 cm³
// ============================================================
export function calculateTheoreticalDensity({ atomsPerCell, molarMass, a, c, isHex }) {
  if (!atomsPerCell || !molarMass || !a || a <= 0) return null;

  let volumeAngstrom3;
  if (isHex) {
    if (!c || c <= 0) return null;
    // Volume of hexagonal prism = (3 * sqrt(3) / 2) * a² * c
    volumeAngstrom3 = ((3 * Math.sqrt(3)) / 2) * (a ** 2) * c;
  } else {
    volumeAngstrom3 = a ** 3;
  }

  const volumeCm3 = volumeAngstrom3 * 1e-24;
  const massGramsPerCell = (atomsPerCell * molarMass) / AVOGADRO;
  const density = massGramsPerCell / volumeCm3;

  return {
    density: parseFloat(density.toFixed(3)),
    volume: parseFloat(volumeAngstrom3.toFixed(2)),
  };
}

// Generate wireframe edges for any unit cell bounding box
export function makeCellWireframe(origin, sizeVector) {
  const p0 = origin.clone();
  const px = origin.clone().add(new THREE.Vector3(sizeVector.x, 0, 0));
  const py = origin.clone().add(new THREE.Vector3(0, sizeVector.y, 0));
  const pz = origin.clone().add(new THREE.Vector3(0, 0, sizeVector.z));
  const pxy = origin.clone().add(new THREE.Vector3(sizeVector.x, sizeVector.y, 0));
  const pxz = origin.clone().add(new THREE.Vector3(sizeVector.x, 0, sizeVector.z));
  const pyz = origin.clone().add(new THREE.Vector3(0, sizeVector.y, sizeVector.z));
  const pxyz = origin.clone().add(sizeVector);

  return [
    [p0, px], [px, pxy], [pxy, py], [py, p0],
    [pz, pxz], [pxz, pxyz], [pxyz, pyz], [pyz, pz],
    [p0, pz], [px, pxz], [py, pyz], [pxy, pxyz],
  ];
}
