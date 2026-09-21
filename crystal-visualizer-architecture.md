# Crystal Structure Visualizer — System Architecture

## 1. Product Scope (recap)

A web app where users can:
- Explore Bravais lattices (SCC, BCC, FCC, HCP) and derived/ionic structures (rock salt/NaCl, CsCl, zinc blende, fluorite, antifluorite, perovskite, spinel, diamond, etc.)
- See tetrahedral/octahedral voids, coordination number, nearest-neighbor bonds, in interactive 3D
- Browse real compounds tagged under each structure type
- Visualize dislocations (edge, screw, mixed) inside a chosen lattice, including Burgers vector and glide animation

---

## 2. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT (Browser)                        │
│  ┌───────────────┐  ┌───────────────────┐  ┌──────────────────┐ │
│  │   React App    │  │  3D Engine Layer   │  │  State/Store     │ │
│  │  (UI, routing) │  │ (Three.js / R3F)   │  │ (Zustand/Redux)  │ │
│  └───────────────┘  └───────────────────┘  └──────────────────┘ │
└───────────────────────────────┬───────────────────────────────┘
                                 │ REST / GraphQL (HTTPS)
┌───────────────────────────────▼───────────────────────────────┐
│                          BACKEND API                            │
│  ┌───────────────┐  ┌───────────────────┐  ┌──────────────────┐ │
│  │ Structure API  │  │  Compound API      │  │  Search/Filter   │ │
│  │ (lattice defs) │  │ (compound catalog) │  │  API             │ │
│  └───────────────┘  └───────────────────┘  └──────────────────┘ │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │      Geometry Service (computes atom coords, voids,        │ │
│  │      bonds, Burgers vectors, slip systems — on demand)      │ │
│  └───────────────────────────────────────────────────────────┘ │
└───────────────────────────────┬───────────────────────────────┘
                                 │
┌───────────────────────────────▼───────────────────────────────┐
│                          DATA LAYER                              │
│  ┌───────────────┐  ┌───────────────────┐  ┌──────────────────┐ │
│  │  PostgreSQL    │  │  Static JSON/CDN   │  │  External APIs   │ │
│  │ (compounds,    │  │ (lattice templates,│  │ (Materials       │ │
│  │  users, saves) │  │  precomputed       │  │  Project API,    │ │
│  │                │  │  geometry)         │  │  optional)       │ │
│  └───────────────┘  └───────────────────┘  └──────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

Key design decision: **most 3D geometry math can run client-side** (it's cheap — a few hundred atom positions, closed-form lattice equations). The backend's job is mainly to serve the **compound database, search/filter, user accounts, and saved views** — not to render or compute geometry per request. This keeps the app fast and mostly static/CDN-cacheable.

---

## 3. Frontend Architecture

### 3.1 Tech stack
- **Framework:** React + TypeScript (Next.js for SSR/SEO on compound pages — important since "list of compounds under FCC" pages should be indexable)
- **3D rendering:** Three.js via **React Three Fiber (R3F)** + `drei` helper library (orbit controls, instancing, text labels)
- **State management:** Zustand (lightweight, good for 3D scene state) or Redux Toolkit if the app grows complex
- **UI components:** Tailwind CSS + shadcn/ui or Radix for controls (sliders, dropdowns, tabs)
- **Math:** a small custom crystallography module (lattice vectors, fractional→cartesian conversion) — no heavy external dependency needed

### 3.2 Core frontend modules

| Module | Responsibility |
|---|---|
| `LatticeViewer` | Renders unit cell(s), atoms (instanced spheres), bonds (cylinders), voids (translucent polyhedra) |
| `ControlPanel` | Structure selector, atomic radius slider, "show voids/bonds/slice" toggles, repeat-cell (1×1×1 → 3×3×3) control |
| `CompoundBrowser` | Search + filter compounds by structure type, element, coordination number |
| `CompoundDetailPage` | Shows a specific compound rendered in its structure, with lattice constants, properties |
| `DislocationViewer` | Separate (or overlay) mode: perfect lattice → inserts edge/screw dislocation, animates glide, draws Burgers circuit/vector |
| `InfoPanel` | Live-updating stats: packing fraction, coordination number, void radius ratio, slip systems |
| `AuthModule` (optional, phase 2) | Login, save custom views, bookmark compounds |

### 3.3 Rendering approach for atoms/bonds/voids
- **Atoms:** `InstancedMesh` (Three.js) — critical for performance once you go beyond a single unit cell (e.g., 3×3×3 supercell = hundreds of atoms). Never create individual meshes per atom.
- **Bonds:** cylinders drawn between nearest-neighbor pairs, computed from a distance cutoff (precomputed per structure, not searched at runtime)
- **Voids:** small translucent polyhedra (tetrahedra/octahedra) positioned at computed fractional coordinates, toggle-able layer
- **Unit cell edges:** simple line geometry (`LineSegments`) so the cube/hexagonal prism boundary is always visible
- **Slicing/cutaway:** implemented via clipping planes (Three.js `Material.clippingPlanes`) — lets users "peer inside" as seen in existing tools

---

## 4. Geometry & Crystallography Engine (the real IP of the project)

This is a **pure-math module**, ideally written once (e.g., TypeScript) and shared/reused for both frontend rendering and any backend precomputation.

### 4.1 Inputs
- Structure type (enum: SC, BCC, FCC, HCP, diamond, NaCl, CsCl, ZnS, CaF2, Na2O-antifluorite, perovskite, spinel...)
- Lattice parameters (a, b, c, α, β, γ — most will just need `a`, cubic case)
- Atomic radii / ionic radii (for packing calculations)

### 4.2 Outputs (computed once, cached)
- Basis atom fractional coordinates (per structure type — this is the core lookup table)
- Cartesian atom positions for N×N×N supercell
- Coordination number + nearest-neighbor distance
- Bond list (pairs of atom indices within cutoff)
- Void positions (tetrahedral/octahedral), void radius ratio
- Packing fraction (APF)
- For dislocations: displacement field functions (edge: standard isotropic elasticity formulas; screw: helical displacement), Burgers vector, slip plane/direction

### 4.3 Data structure for a "structure definition" (example)
```json
{
  "id": "fcc",
  "name": "Face-Centered Cubic",
  "latticeSystem": "cubic",
  "basisAtoms": [
    { "element": "generic", "frac": [0,0,0] },
    { "element": "generic", "frac": [0.5,0.5,0] },
    { "element": "generic", "frac": [0.5,0,0.5] },
    { "element": "generic", "frac": [0,0.5,0.5] }
  ],
  "coordinationNumber": 12,
  "packingFraction": 0.7405,
  "voids": {
    "octahedral": [{ "frac": [0.5,0.5,0.5] }, "...edge centers"],
    "tetrahedral": ["...8 positions"]
  },
  "slipSystems": [{ "plane": "111", "direction": "110" }],
  "compounds": ["Cu", "Al", "Au", "Ag", "Ni", "..."]
}
```
This pattern extends naturally to ionic structures (two basis-atom sets, one per ion) and to complex ones like perovskite (three distinct Wyckoff sites: A-cation, B-cation, O-anion).

This structure-definition JSON is effectively your **content model** — adding a new crystal structure to the site is mostly "add a new JSON entry," not new code.

---

## 5. Backend Architecture

### 5.1 Tech stack (reasonable default)
- **API:** Node.js + Express/Fastify, or Python + FastAPI (FastAPI is a strong choice if you want to eventually integrate with materials-science Python libraries like `pymatgen` for real compound data)
- **Database:** PostgreSQL — compounds, structures metadata, user accounts, saved views
- **Static assets:** Precomputed lattice geometry JSON served from a CDN (Cloudflare/Vercel Edge) — no need to hit the DB for base lattice math
- **Search:** Postgres full-text search initially; Elasticsearch/Meilisearch if compound catalog grows large (thousands of entries) and needs fuzzy/faceted search

### 5.2 API surface (REST example)
```
GET  /api/structures                 → list all structure types with summary stats
GET  /api/structures/:id             → full structure definition (basis, voids, slip systems)
GET  /api/compounds?structure=fcc    → compounds filtered by structure type
GET  /api/compounds/:id              → compound detail (lattice constant, real radii, source)
GET  /api/compounds/search?q=...     → search by name/formula/element
POST /api/users/saved-views          → (auth) save a custom viewer configuration
GET  /api/dislocations/:type         → edge/screw parameters + displacement field metadata
```

### 5.3 Database schema (simplified)
```
structures
 ├─ id, name, lattice_system, coordination_number, packing_fraction, description

compounds
 ├─ id, formula, common_name, structure_id (FK), lattice_constant_a/b/c,
 │  space_group, source_citation, notes

users (phase 2)
 ├─ id, email, auth_provider

saved_views (phase 2)
 ├─ id, user_id (FK), structure_id (FK), config_json (radius scale, slice toggle, etc.)
```

### 5.4 Where real compound data comes from
Two options, not mutually exclusive:
1. **Hand-curated seed dataset** (fast to start): a spreadsheet/CSV of ~100–200 well-known compounds with structure type, lattice constant, and source citation — good enough for an MVP and fully under your control.
2. **Materials Project API** (materialsproject.org) — free API with real crystallographic data for 100,000+ compounds, if you want to scale the catalog later. This is a bigger lift (auth, rate limits, data licensing/attribution) — treat as a Phase 2/3 feature, not MVP.

---

## 6. Dislocation Module (as its own subsystem)

Because this is geometrically distinct from static lattices, treat it as a semi-independent feature that reuses the same atom-rendering pipeline:

- **Perfect lattice base:** same `InstancedMesh` atom rendering as the structure viewer
- **Displacement engine:** given dislocation type + Burgers vector + line direction, compute a per-atom displacement `(Δx, Δy, Δz)` using standard isotropic elasticity formulas (edge) or helical transform (screw), applied to the base lattice positions
- **Burgers circuit overlay:** a drawn square/rectangular path (line geometry) around the dislocation core in both perfect and defected lattice, so the "closure failure" is visually obvious
- **Glide animation:** interpolate the extra half-plane's position over time along the slip direction (simple `requestAnimationFrame` tween or Three.js `AnimationMixer`)
- **Context linking:** launched from within a specific structure's page (e.g., "View dislocation in FCC copper") so slip system data (already in the structure definition) feeds directly into which planes/directions are glide-able

---

## 7. Non-Functional Concerns

| Concern | Approach |
|---|---|
| **Performance** | InstancedMesh for atoms/bonds; limit default supercell size (2×2×2 or 3×3×3); lazy-load heavier structures (perovskite, spinel) |
| **Mobile** | Touch-friendly orbit controls (`drei`'s `OrbitControls` supports touch out of box); simplify UI panel to bottom sheet on small screens |
| **SEO** | Next.js SSR for compound/structure pages so "FCC compounds list," "perovskite structure" etc. are indexable and can drive organic traffic |
| **Accessibility** | Provide a non-3D fallback (static labeled diagrams/table) for screen readers and low-end devices/WebGL-unavailable cases |
| **Testing** | Unit test the geometry engine heavily (this is pure math — very testable) separately from UI/rendering |
| **Attribution** | If using Materials Project or other external data, follow their citation/attribution requirements explicitly on each compound page |

---

## 8. Suggested Build Phases

**Phase 1 — MVP (core value prop)**
- SC, BCC, FCC, HCP viewers with atoms, bonds, unit cell, coordination number/packing fraction readouts
- Void visualization (tetrahedral/octahedral) toggle
- ~20–30 hand-curated compounds per structure

**Phase 2 — Ionic/complex structures + compound catalog**
- NaCl, CsCl, ZnS, fluorite, antifluorite, perovskite, spinel
- Searchable compound browser with filters
- SSR compound detail pages for SEO

**Phase 3 — Dislocations**
- Edge dislocation visualization + Burgers vector
- Screw dislocation + glide animation
- Link dislocations to slip systems per structure

**Phase 4 — Accounts & scale**
- User accounts, saved custom views
- Larger compound catalog (Materials Project integration)
- Possibly X-ray diffraction / Miller index tools as a bonus module (several competitor tools already do this, so it's a natural addition)

---

## 9. Suggested Repo Structure

```
/apps
  /web              → Next.js frontend
    /components
      /viewer        (LatticeViewer, ControlPanel, InfoPanel)
      /dislocation
      /compound-browser
    /lib
      /crystallography  → geometry engine (shared, pure TS)
    /pages / /app
/apps
  /api              → FastAPI or Node backend
    /routes
    /models
    /db
/packages
  /crystallography-core  → if you want geometry engine as a shared npm package
  /structure-data         → JSON definitions for each structure type
```

This keeps the crystallography math as a **framework-agnostic core library** — useful if you ever want a mobile app or API-only consumers later.
