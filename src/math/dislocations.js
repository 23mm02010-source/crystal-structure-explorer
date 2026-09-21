import * as THREE from 'three';

// ============================================================
// DISLOCATION & DEFECTS MATHEMATICAL ENGINE
// Implements discrete atomic models and continuum elasticity solutions
// for Edge Dislocations, Screw Dislocations, Burgers Circuits,
// and Glide/Slip mechanics across FCC, BCC, and HCP lattices.
// ============================================================

export const SLIP_SYSTEMS_INFO = {
  fcc: {
    structure: 'FCC (e.g. Cu, Al, Au, Ni)',
    planes: '{111} (4 close-packed octahedral planes)',
    directions: '<110> (3 close-packed directions per plane)',
    totalSystems: 12,
    ductility: 'Extremely Ductile (all temperatures)',
    explanation:
      'With 12 symmetrically equivalent close-packed slip systems, Taylor / von Mises criterion (minimum 5 independent systems) is easily satisfied in any grain orientation. Dislocation cores are wide with low Peierls barrier.',
  },
  bcc: {
    structure: 'BCC (e.g. Fe, W, Cr, Mo)',
    planes: '{110}, {112}, {123}',
    directions: '<111> (4 body-diagonal directions)',
    totalSystems: 48,
    ductility: 'Ductile at Room Temp; Brittle at Low Temp (DBTT)',
    explanation:
      'Lacks truly close-packed planes. Screw dislocations have non-planar 3-fold dissociated cores requiring thermal activation to constrict and glide. Exhibits sharp Ductile-to-Brittle Transition Temperature (DBTT).',
  },
  hcp: {
    structure: 'HCP (e.g. Mg, Zn, Ti, Co)',
    planes: '{0001} (Basal plane), {10-10} (Prismatic)',
    directions: '<11-20> (3 close-packed close directions)',
    totalSystems: 3,
    ductility: 'Limited Ductility / Brittle at Ambient Temp',
    explanation:
      'Only 3 independent slip systems on the basal plane at room temperature, failing the von Mises criterion of 5 independent systems. Twinning or elevated temperature prismatic slip is required to avoid brittle cleavage.',
  },
};

// Generate 3D grid of atoms for perfect crystal reference
export function generatePerfectGrid({ nx = 9, ny = 7, nz = 5, spacing = 1.0 }) {
  const atoms = [];
  const startX = -((nx - 1) / 2) * spacing;
  const startY = -((ny - 1) / 2) * spacing;
  const startZ = -((nz - 1) / 2) * spacing;

  for (let ix = 0; ix < nx; ix++) {
    for (let iy = 0; iy < ny; iy++) {
      for (let iz = 0; iz < nz; iz++) {
        const x = startX + ix * spacing;
        const y = startY + iy * spacing;
        const z = startZ + iz * spacing;
        atoms.push({
          pos: new THREE.Vector3(x, y, z),
          gridIndex: [ix, iy, iz],
          isExtraPlane: false,
        });
      }
    }
  }

  return { atoms, nx, ny, nz, spacing };
}

// Generate Edge Dislocation:
// Extra half-plane of atoms inserted at x = 0 for y > 0
// Dislocation line along z-axis, slip plane at y = 0, Burgers vector b = [spacing, 0, 0]
export function generateEdgeDislocationGrid({
  nx = 9,
  ny = 7,
  nz = 5,
  spacing = 1.0,
  coreX = 0, // position along slip plane for glide animation
  nu = 0.33, // Poisson's ratio
}) {
  const b = spacing;
  const startX = -((nx - 1) / 2) * spacing;
  const startY = -((ny - 1) / 2) * spacing;
  const startZ = -((nz - 1) / 2) * spacing;

  const atoms = [];
  const coreCutoff = 0.3 * spacing;

  for (let ix = 0; ix < nx; ix++) {
    for (let iy = 0; iy < ny; iy++) {
      for (let iz = 0; iz < nz; iz++) {
        const x0 = startX + ix * spacing;
        const y0 = startY + iy * spacing;
        const z0 = startZ + iz * spacing;

        // Coordinates relative to dislocation core
        const relX = x0 - coreX;
        const relY = y0;
        const r2 = relX * relX + relY * relY;

        let ux = 0;
        let uy = 0;

        // Standard isotropic linear elasticity displacement field
        if (r2 > coreCutoff * coreCutoff) {
          const theta = Math.atan2(relY, relX);
          ux = (b / (2 * Math.PI)) * (theta + (relX * relY) / (2 * (1 - nu) * r2));
          uy = -(b / (2 * Math.PI)) * (
            ((1 - 2 * nu) / (4 * (1 - nu))) * Math.log(r2) +
            (relX * relX - relY * relY) / (4 * (1 - nu) * r2)
          );
        } else {
          // Core smoothing to avoid singularity
          const theta = Math.atan2(relY, relX);
          ux = (b / (2 * Math.PI)) * theta;
        }

        // Extra half-plane tag: atoms directly above the core
        const isExtra = Math.abs(relX) < 0.6 * spacing && relY > 0.1 * spacing;

        atoms.push({
          pos: new THREE.Vector3(x0 + ux, y0 + uy, z0),
          basePos: new THREE.Vector3(x0, y0, z0),
          gridIndex: [ix, iy, iz],
          isExtraPlane: isExtra,
          isAboveSlipPlane: relY > 0,
        });
      }
    }
  }

  return { atoms, nx, ny, nz, spacing, b, coreX };
}

// Generate Screw Dislocation:
// Dislocation line along z-axis, Burgers vector b = [0, 0, spacing] parallel to line
// Atomic planes are converted into a continuous helical spiral ramp!
export function generateScrewDislocationGrid({
  nx = 9,
  ny = 7,
  nz = 5,
  spacing = 1.0,
  coreX = 0,
}) {
  const b = spacing;
  const startX = -((nx - 1) / 2) * spacing;
  const startY = -((ny - 1) / 2) * spacing;
  const startZ = -((nz - 1) / 2) * spacing;

  const atoms = [];

  for (let ix = 0; ix < nx; ix++) {
    for (let iy = 0; iy < ny; iy++) {
      for (let iz = 0; iz < nz; iz++) {
        const x0 = startX + ix * spacing;
        const y0 = startY + iy * spacing;
        const z0 = startZ + iz * spacing;

        const relX = x0 - coreX;
        const relY = y0;

        // Helical displacement: uz = (b / 2pi) * theta
        // theta from -pi to +pi
        let theta = Math.atan2(relY, relX);
        if (theta < 0) theta += 2 * Math.PI; // 0 to 2pi branch cut along positive x-axis
        const uz = (b / (2 * Math.PI)) * theta;

        atoms.push({
          pos: new THREE.Vector3(x0, y0, z0 + uz),
          basePos: new THREE.Vector3(x0, y0, z0),
          gridIndex: [ix, iy, iz],
          theta,
          isAboveSlipPlane: relY > 0,
        });
      }
    }
  }

  return { atoms, nx, ny, nz, spacing, b, coreX };
}

// ============================================================
// BURGERS CIRCUIT CALCULATOR
// Path: Start at (-2, -2), go 4 steps Right (+x), 4 steps Up (+y),
// 4 steps Left (-x), 4 steps Down (-y).
// Perfect lattice: closes perfectly at start (0 closure error).
// Defected lattice: fails to close by exactly vector b (Burgers vector)!
// ============================================================
export function generateBurgersCircuit({
  mode = 'edge', // 'edge' | 'screw' | 'perfect'
  atoms,
  nx,
  ny,
  nz,
  spacing,
  b,
  stepSize = 3, // steps per leg
}) {
  // Find mid-plane iz
  const midZ = Math.floor(nz / 2);
  const midX = Math.floor(nx / 2);
  const midY = Math.floor(ny / 2);

  // Define 4 corners in grid index space centered around dislocation core
  const iStartX = midX - Math.floor(stepSize / 2);
  const iStartY = midY - Math.floor(stepSize / 2);

  const startIdx = [iStartX, iStartY, midZ];
  const p1Idx = [iStartX + stepSize, iStartY, midZ]; // after Right
  const p2Idx = [iStartX + stepSize, iStartY + stepSize, midZ]; // after Up
  const p3Idx = [iStartX, iStartY + stepSize, midZ]; // after Left
  const p4Idx = [iStartX, iStartY, midZ]; // after Down

  // Find atom corresponding to grid index
  const findAtom = (ix, iy, iz) =>
    atoms.find(
      (a) =>
        a.gridIndex[0] === ix &&
        a.gridIndex[1] === iy &&
        a.gridIndex[2] === iz
    );

  // Generate intermediate waypoint nodes along each leg of the circuit
  const legs = [
    { from: startIdx, to: p1Idx, label: 'Leg 1: Right (+x)' },
    { from: p1Idx, to: p2Idx, label: 'Leg 2: Up (+y)' },
    { from: p2Idx, to: p3Idx, label: 'Leg 3: Left (-x)' },
    { from: p3Idx, to: p4Idx, label: 'Leg 4: Down (-y)' },
  ];

  const circuitPoints = [];
  legs.forEach(({ from, to }) => {
    const dx = to[0] - from[0];
    const dy = to[1] - from[1];
    const steps = Math.max(Math.abs(dx), Math.abs(dy));
    const stepX = steps > 0 ? dx / steps : 0;
    const stepY = steps > 0 ? dy / steps : 0;

    for (let s = 0; s < steps; s++) {
      const curX = Math.round(from[0] + s * stepX);
      const curY = Math.round(from[1] + s * stepY);
      const at = findAtom(curX, curY, midZ);
      if (at) circuitPoints.push(at.pos.clone());
    }
  });

  // End point (should close at start for perfect, fails to close for defect)
  const startAtom = findAtom(startIdx[0], startIdx[1], midZ);
  if (!startAtom) return null;

  const startPos = startAtom.pos.clone();
  let endPos;
  let burgersVector;

  if (mode === 'perfect') {
    endPos = startPos.clone();
    burgersVector = new THREE.Vector3(0, 0, 0);
  } else if (mode === 'edge') {
    // Fails to close in x by b
    endPos = startPos.clone().add(new THREE.Vector3(-b, 0, 0));
    burgersVector = new THREE.Vector3(b, 0, 0);
  } else {
    // Screw: fails to close in z by b
    endPos = startPos.clone().add(new THREE.Vector3(0, 0, -b));
    burgersVector = new THREE.Vector3(0, 0, b);
  }

  circuitPoints.push(endPos);

  return {
    circuitPoints,
    startPos,
    endPos,
    burgersVector,
    hasClosureFailure: mode !== 'perfect',
  };
}
