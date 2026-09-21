// ============================================================
// CRYSTALLOGRAPHY STRUCTURE DEFINITIONS
// Covers 12 major crystal structures with correct Wyckoff / fractional
// coordinates, true coordination numbers, packing fractions,
// void fractional positions & counts, slip systems, and Miller planes.
// ============================================================

// Standard fractional coordinates of cubic lattice sites
export const CORNER_FRAC = [
  [0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1],
  [1, 1, 0], [1, 0, 1], [0, 1, 1], [1, 1, 1],
];

export const FACE_FRAC = [
  [0.5, 0.5, 0], [0.5, 0.5, 1],
  [0.5, 0, 0.5], [0.5, 1, 0.5],
  [0, 0.5, 0.5], [1, 0.5, 0.5],
];

export const BODY_FRAC = [[0.5, 0.5, 0.5]];

export const EDGE_CENTERS_FRAC = [
  [0.5, 0, 0], [0.5, 1, 0], [0.5, 0, 1], [0.5, 1, 1],
  [0, 0.5, 0], [1, 0.5, 0], [0, 0.5, 1], [1, 0.5, 1],
  [0, 0, 0.5], [1, 0, 0.5], [0, 1, 0.5], [1, 1, 0.5],
];

// 8 tetrahedral sites in FCC (centers of 8 octants)
export const FCC_TETRA_FRAC = [
  [0.25, 0.25, 0.25], [0.75, 0.25, 0.25], [0.25, 0.75, 0.25], [0.25, 0.25, 0.75],
  [0.75, 0.75, 0.25], [0.75, 0.25, 0.75], [0.25, 0.75, 0.75], [0.75, 0.75, 0.75],
];

// Zinc-blende cation sub-lattice (4 of the 8 tetrahedral sites)
export const ZINCBLENDE_CATION_FRAC = [
  [0.25, 0.25, 0.25], [0.75, 0.75, 0.25], [0.75, 0.25, 0.75], [0.25, 0.75, 0.75],
];

// BCC tetrahedral void sites (24 sites on the 6 cube faces: 4 per face at (1/4, 1/2, 0) and permutations)
export const BCC_TETRA_FRAC = [
  [0.25, 0.5, 0], [0.75, 0.5, 0], [0.5, 0.25, 0], [0.5, 0.75, 0],
  [0.25, 0.5, 1], [0.75, 0.5, 1], [0.5, 0.25, 1], [0.5, 0.75, 1],
  [0.25, 0, 0.5], [0.75, 0, 0.5], [0.5, 0, 0.25], [0.5, 0, 0.75],
  [0.25, 1, 0.5], [0.75, 1, 0.5], [0.5, 1, 0.25], [0.5, 1, 0.75],
  [0, 0.25, 0.5], [0, 0.75, 0.5], [0, 0.5, 0.25], [0, 0.5, 0.75],
  [1, 0.25, 0.5], [1, 0.75, 0.5], [1, 0.5, 0.25], [1, 0.5, 0.75],
];

// Standard 12 cube edges
export const CUBE_EDGES = [
  [[0, 0, 0], [1, 0, 0]], [[1, 0, 0], [1, 1, 0]], [[1, 1, 0], [0, 1, 0]], [[0, 1, 0], [0, 0, 0]],
  [[0, 0, 1], [1, 0, 1]], [[1, 0, 1], [1, 1, 1]], [[1, 1, 1], [0, 1, 1]], [[0, 1, 1], [0, 0, 1]],
  [[0, 0, 0], [0, 0, 1]], [[1, 0, 0], [1, 0, 1]], [[1, 1, 0], [1, 1, 1]], [[0, 1, 0], [0, 1, 1]],
];

export const STRUCTURE_DEFS = {
  sc: {
    id: 'sc',
    name: 'Simple Cubic (SC)',
    system: 'cubic',
    description: 'Primitive cubic lattice with one lattice point per corner. Open, low-density structure found in alpha-Polonium.',
    cn: 6,
    apf: Math.PI / 6, // 0.5236
    apfFormula: 'π / 6 ≈ 0.524',
    atomsPerCell: 1, // 8 * (1/8)
    basisType: 'single',
    atomFrac: CORNER_FRAC,
    hasOctaVoids: false,
    hasTetraVoids: false,
    slipSystems: { family: '{100}<010>', count: 3, note: 'Very few slip systems; inherently brittle.' },
    millerPresets: [[1, 0, 0], [1, 1, 0], [1, 1, 1]],
  },

  bcc: {
    id: 'bcc',
    name: 'Body-Centered Cubic (BCC)',
    system: 'cubic',
    description: 'Cubic cell with atoms at 8 corners and 1 at the body center. Atoms touch along the body diagonal (4r = a√3). Common in refractory metals and α-Fe.',
    cn: 8,
    apf: (Math.PI * Math.sqrt(3)) / 8, // 0.6802
    apfFormula: 'π√3 / 8 ≈ 0.680',
    atomsPerCell: 2, // 8 * (1/8) + 1
    basisType: 'single',
    atomFrac: [...CORNER_FRAC, ...BODY_FRAC],
    hasOctaVoids: true,
    hasTetraVoids: true,
    octaFrac: [...FACE_FRAC, ...EDGE_CENTERS_FRAC], // 6 faces * (1/2) + 12 edges * (1/4) = 6 net voids
    tetraFrac: BCC_TETRA_FRAC, // 24 sites * (1/2) = 12 net voids
    octaNet: 6,
    tetraNet: 12,
    octaRadiusRatio: 0.155, // (a/2 - r)/r = sqrt(3)/sqrt(2) - 1 for distorted octahedra
    tetraRadiusRatio: 0.291,
    slipSystems: { family: '{110}<111>, {112}<111>, {123}<111>', count: 48, note: 'High number of slip systems (up to 48); wavy slip lines, ductile at room temp.' },
    millerPresets: [[1, 1, 0], [1, 0, 0], [1, 1, 2]],
  },

  fcc: {
    id: 'fcc',
    name: 'Face-Centered Cubic (FCC)',
    system: 'cubic',
    description: 'Close-packed cubic structure with atoms at 8 corners and 6 face centers. Stacking sequence ABCABC. Atoms touch along face diagonals (4r = a√2).',
    cn: 12,
    apf: (Math.PI * Math.SQRT2) / 6, // 0.7405
    apfFormula: 'π√2 / 6 ≈ 0.741',
    atomsPerCell: 4, // 8 * (1/8) + 6 * (1/2)
    basisType: 'single',
    atomFrac: [...CORNER_FRAC, ...FACE_FRAC],
    hasOctaVoids: true,
    hasTetraVoids: true,
    octaFrac: [...BODY_FRAC, ...EDGE_CENTERS_FRAC], // 1 body + 12 edges * (1/4) = 4 net voids
    tetraFrac: FCC_TETRA_FRAC, // 8 fully inside cell = 8 net voids
    octaNet: 4,
    tetraNet: 8,
    octaRadiusRatio: Math.SQRT2 - 1, // 0.4142
    tetraRadiusRatio: Math.sqrt(3 / 2) - 1, // 0.2247
    slipSystems: { family: '{111}<110>', count: 12, note: '12 close-packed slip systems; exceptionally ductile, high work hardenability (Cu, Al, Au).' },
    millerPresets: [[1, 1, 1], [1, 1, 0], [1, 0, 0]],
  },

  hcp: {
    id: 'hcp',
    name: 'Hexagonal Close-Packed (HCP)',
    system: 'hexagonal',
    description: 'Close-packed hexagonal prism with ABABAB stacking. Ideal c/a = √(8/3) ≈ 1.633. Same packing fraction as FCC (0.741) and CN = 12.',
    cn: 12,
    apf: (Math.PI * Math.SQRT2) / 6, // 0.7405
    apfFormula: 'π√2 / 6 ≈ 0.741',
    atomsPerCell: 6, // conventional hexagonal prism: 12 * (1/6) + 2 * (1/2) + 3 interior = 6
    basisType: 'hexagonal',
    hasOctaVoids: true,
    hasTetraVoids: true,
    octaNet: 6,
    tetraNet: 12,
    octaRadiusRatio: 0.414,
    tetraRadiusRatio: 0.225,
    slipSystems: { family: '{0001}<11-20>', count: 3, note: 'Primary slip limited to basal plane (3 systems) at room temperature; tends to be brittle or limited ductility (Mg, Zn, Ti).' },
    millerPresets: [[0, 0, 1], [1, 0, 0], [1, 1, 0]],
  },

  diamond: {
    id: 'diamond',
    name: 'Diamond Cubic',
    system: 'cubic',
    description: 'FCC Bravais lattice with a two-atom basis at (0,0,0) and (1/4, 1/4, 1/4). Each atom is tetrahedrally bonded to 4 neighbors through strong sp³ hybridization.',
    cn: 4,
    apf: (Math.PI * Math.sqrt(3)) / 16, // 0.3401
    apfFormula: 'π√3 / 16 ≈ 0.340',
    atomsPerCell: 8, // 4 from FCC lattice + 4 from tetrahedral sites
    basisType: 'single',
    atomFrac: [...CORNER_FRAC, ...FACE_FRAC, ...ZINCBLENDE_CATION_FRAC],
    hasOctaVoids: true,
    hasTetraVoids: false,
    octaFrac: [...BODY_FRAC, ...EDGE_CENTERS_FRAC],
    octaNet: 4,
    slipSystems: { family: '{111}<110>', count: 12, note: 'Directional covalent bonding makes dislocation glide very difficult at room temperature (extreme hardness, brittle cleavage).' },
    millerPresets: [[1, 1, 1], [1, 1, 0], [1, 0, 0]],
  },

  rocksalt: {
    id: 'rocksalt',
    name: 'Rock Salt (NaCl-type)',
    system: 'cubic',
    description: 'Interpenetrating FCC sublattices of cations and anions shifted by (1/2, 0, 0). Every ion is octahedrally coordinated (CN 6:6). Found in halides and transition metal monoxides.',
    cn: 6,
    apfFormula: '4 × 4/3 π (r₊³ + r₋³) / a³',
    atomsPerCell: 8, // 4 cations + 4 anions
    basisType: 'ionic_binary',
    cationFrac: [...CORNER_FRAC, ...FACE_FRAC],
    anionFrac: [...BODY_FRAC, ...EDGE_CENTERS_FRAC],
    hasOctaVoids: false,
    hasTetraVoids: true,
    tetraFrac: FCC_TETRA_FRAC, // 8 tetrahedral sites unoccupied
    tetraNet: 8,
    slipSystems: { family: '{110}<1-10>', count: 6, note: 'Slip occurs along {110} planes to avoid bringing like charges into contact; limited slip causes ceramic brittleness.' },
    millerPresets: [[1, 0, 0], [1, 1, 0], [1, 1, 1]],
  },

  cscl: {
    id: 'cscl',
    name: 'Caesium Chloride (CsCl-type)',
    system: 'cubic',
    description: 'Simple cubic cation lattice with an anion at the body center. 8:8 cubic coordination shell. Favored when cation/anion radius ratio r₊/r₋ ≥ 0.732.',
    cn: 8,
    apfFormula: '4/3 π (r₊³ + r₋³) / a³',
    atomsPerCell: 2, // 1 cation + 1 anion
    basisType: 'ionic_binary',
    cationFrac: CORNER_FRAC,
    anionFrac: BODY_FRAC,
    hasOctaVoids: false,
    hasTetraVoids: false,
    slipSystems: { family: '{110}<001>', count: 6, note: 'Dominant slip on {110} along <001>; moderate ductility in intermetallics like NiAl or CsCl.' },
    millerPresets: [[1, 1, 0], [1, 0, 0], [1, 1, 1]],
  },

  zincblende: {
    id: 'zincblende',
    name: 'Zinc Blende (ZnS-type)',
    system: 'cubic',
    description: 'FCC anion lattice with cations occupying alternating tetrahedral sites (4 of 8). 4:4 tetrahedral coordination. Crucial structure for III-V semiconductors (GaAs, InP).',
    cn: 4,
    apfFormula: '4 × 4/3 π (r₊³ + r₋³) / a³',
    atomsPerCell: 8, // 4 cations + 4 anions
    basisType: 'ionic_binary',
    cationFrac: ZINCBLENDE_CATION_FRAC,
    anionFrac: [...CORNER_FRAC, ...FACE_FRAC],
    hasOctaVoids: true,
    hasTetraVoids: true,
    octaFrac: [...BODY_FRAC, ...EDGE_CENTERS_FRAC],
    tetraFrac: [
      [0.75, 0.25, 0.25], [0.25, 0.75, 0.25], [0.25, 0.25, 0.75], [0.75, 0.75, 0.75]
    ], // the 4 remaining unoccupied tetrahedral sites
    octaNet: 4,
    tetraNet: 4,
    slipSystems: { family: '{111}<110>', count: 12, note: 'Zinc blende slip on {111} planes; polarity of {111} surfaces leads to asymmetric dislocation mobility.' },
    millerPresets: [[1, 1, 1], [1, 1, 0], [1, 0, 0]],
  },

  fluorite: {
    id: 'fluorite',
    name: 'Fluorite (CaF₂-type)',
    system: 'cubic',
    description: 'FCC lattice of Ca²⁺ cations with F⁻ anions filling all 8 tetrahedral sites. Cation CN = 8 (cubic), Anion CN = 4 (tetrahedral). Common in oxides (UO₂, ZrO₂).',
    cn: '8 (Ca²⁺) / 4 (F⁻)',
    apfFormula: '4/3 π (4 r₊³ + 8 r₋³) / a³',
    atomsPerCell: 12, // 4 cations + 8 anions
    basisType: 'ionic_binary',
    cationFrac: [...CORNER_FRAC, ...FACE_FRAC],
    anionFrac: FCC_TETRA_FRAC,
    hasOctaVoids: true,
    hasTetraVoids: false,
    octaFrac: [...BODY_FRAC, ...EDGE_CENTERS_FRAC], // octahedral sites remain vacant!
    octaNet: 4,
    slipSystems: { family: '{001}<110>', count: 6, note: 'Primary slip on {001} planes; high-temperature plasticity enabled by fast oxygen/fluorine diffusion.' },
    millerPresets: [[1, 0, 0], [1, 1, 1], [1, 1, 0]],
  },

  antifluorite: {
    id: 'antifluorite',
    name: 'Antifluorite (Na₂O-type)',
    system: 'cubic',
    description: 'Inverse of fluorite: FCC lattice of anions (O²⁻) with cations (Na⁺) filling all 8 tetrahedral sites. Cation CN = 4, Anion CN = 8. Common in alkali metal oxides.',
    cn: '4 (Na⁺) / 8 (O²⁻)',
    apfFormula: '4/3 π (8 r₊³ + 4 r₋³) / a³',
    atomsPerCell: 12, // 8 cations + 4 anions
    basisType: 'ionic_binary',
    cationFrac: FCC_TETRA_FRAC,
    anionFrac: [...CORNER_FRAC, ...FACE_FRAC],
    hasOctaVoids: true,
    hasTetraVoids: false,
    octaFrac: [...BODY_FRAC, ...EDGE_CENTERS_FRAC],
    octaNet: 4,
    slipSystems: { family: '{001}<110>', count: 6, note: 'Inverse charge distribution compared to fluorite.' },
    millerPresets: [[1, 0, 0], [1, 1, 1], [1, 1, 0]],
  },

  perovskite: {
    id: 'perovskite',
    name: 'Perovskite (ABX₃-type)',
    system: 'cubic',
    description: 'Cubic aristotype structure: Large A-cation at corners (CN 12), smaller B-cation at body center (CN 6, octahedral), and X-anions at face centers (CN 6). Foundation of ferroelectrics and solar materials.',
    cn: '12 (A-site) / 6 (B-site) / 6 (X-site)',
    apfFormula: '4/3 π (r_A³ + r_B³ + 3 r_X³) / a³',
    atomsPerCell: 5, // 1 A + 1 B + 3 X
    basisType: 'perovskite',
    aFrac: CORNER_FRAC,
    bFrac: BODY_FRAC,
    xFrac: FACE_FRAC,
    hasOctaVoids: false,
    hasTetraVoids: false,
    slipSystems: { family: '{110}<1-10>', count: 6, note: 'Dislocations in perovskites play critical roles in ferroelectric domain pinning and resistive switching.' },
    millerPresets: [[1, 0, 0], [1, 1, 0], [1, 1, 1]],
  },

  wurtzite: {
    id: 'wurtzite',
    name: 'Wurtzite (Hexagonal ZnS)',
    system: 'hexagonal',
    description: 'Hexagonal close-packed analogue of zinc blende. Both cation and anion form interpenetrating HCP sublattices. 4:4 tetrahedral coordination. Key to modern LEDs (GaN, ZnO).',
    cn: 4,
    apfFormula: 'Hexagonal 4:4 coordination',
    atomsPerCell: 4, // 2 cations + 2 anions per primitive unit cell
    basisType: 'hexagonal_wurtzite',
    hasOctaVoids: false,
    hasTetraVoids: false,
    slipSystems: { family: '{0001}<11-20>', count: 3, note: 'Basal and prismatic slip systems; threading dislocations in GaN heavily affect optical quantum efficiency.' },
    millerPresets: [[0, 0, 1], [1, 0, 0], [1, 1, 0]],
  },
};
