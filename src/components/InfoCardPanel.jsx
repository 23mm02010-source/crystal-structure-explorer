import React from 'react';
import {
  Info,
  ShieldCheck,
  Scale,
  Hash,
  Box,
  Compass,
  Zap,
  Tag,
  Circle,
} from 'lucide-react';
import { calculateTheoreticalDensity } from '../math/crystallography.js';

const hexColor = (n) => `#${(n || 0).toString(16).padStart(6, '0')}`;

export default function InfoCardPanel({
  structureDef,
  compound,
  activeA,
  activeC,
  effectiveCompound,
  activePhase,
}) {
  const isHex = structureDef.system === 'hexagonal';
  const isPerovskite = structureDef.id === 'perovskite';
  const isTwoSpeciesIonic = structureDef.basisType === 'ionic_binary';

  // Compute nearest neighbor bond length
  const nearestNeighborDist = (() => {
    if (isHex) {
      return activeA;
    }
    if (structureDef.id === 'sc') return activeA;
    if (structureDef.id === 'bcc') return (activeA * Math.sqrt(3)) / 2;
    if (structureDef.id === 'fcc') return activeA / Math.SQRT2;
    if (structureDef.id === 'diamond') return (activeA * Math.sqrt(3)) / 4;
    if (structureDef.id === 'rocksalt') return activeA / 2;
    if (structureDef.id === 'cscl') return (activeA * Math.sqrt(3)) / 2;
    if (structureDef.id === 'zincblende') return (activeA * Math.sqrt(3)) / 4;
    if (structureDef.id === 'fluorite' || structureDef.id === 'antifluorite') {
      return (activeA * Math.sqrt(3)) / 4;
    }
    if (isPerovskite) {
      // B-site to X-site octahedral bond
      return activeA / 2;
    }
    return activeA / Math.SQRT2;
  })();

  // Calculate theoretical density if molar mass and atoms/cell exist
  const molarMass =
    effectiveCompound.molarMass ||
    effectiveCompound.atomicWeight ||
    (effectiveCompound.solidSolution ? effectiveCompound.molarMassBase : null);

  const densityResult = calculateTheoreticalDensity({
    atomsPerCell: structureDef.atomsPerCell,
    molarMass,
    a: activeA,
    c: activeC,
    isHex,
  });

  return (
    <div className="infocard-container">
      {/* 1. UNIVERSAL GEOMETRY FACTS (STRUCTURE-INVARIANT) */}
      <div className="infocard universal-facts-card">
        <div className="infocard-header">
          <div className="infocard-badge universal">Universal Geometry</div>
          <div className="infocard-title">{structureDef.name}</div>
          <div className="infocard-subtitle">
            True for ALL materials possessing this crystal lattice
          </div>
        </div>

        <div className="infocard-grid">
          <div className="fact-item">
            <span className="fact-label">Coordination Number (CN):</span>
            <span className="fact-value highlight-cyan">
              {structureDef.cn}
            </span>
          </div>

          <div className="fact-item">
            <span className="fact-label">Atomic Packing Factor (APF):</span>
            <span className="fact-value highlight-cyan">
              {structureDef.apf ? structureDef.apf.toFixed(4) : structureDef.apfFormula}
            </span>
          </div>

          <div className="fact-item">
            <span className="fact-label">Atoms Per Unit Cell (Net):</span>
            <span className="fact-value">{structureDef.atomsPerCell} atoms</span>
          </div>

          <div className="fact-item">
            <span className="fact-label">Lattice System:</span>
            <span className="fact-value capitalize">{structureDef.system}</span>
          </div>

          {structureDef.hasOctaVoids && (
            <div className="fact-item">
              <span className="fact-label">Octahedral Voids / Cell:</span>
              <span className="fact-value highlight-amber">
                {structureDef.octaNet} net voids
                {structureDef.octaRadiusRatio && (
                  <span className="fact-subvalue"> (r_v/r = {structureDef.octaRadiusRatio.toFixed(3)})</span>
                )}
              </span>
            </div>
          )}

          {structureDef.hasTetraVoids && (
            <div className="fact-item">
              <span className="fact-label">Tetrahedral Voids / Cell:</span>
              <span className="fact-value highlight-teal">
                {structureDef.tetraNet} net voids
                {structureDef.tetraRadiusRatio && (
                  <span className="fact-subvalue"> (r_v/r = {structureDef.tetraRadiusRatio.toFixed(3)})</span>
                )}
              </span>
            </div>
          )}

          {structureDef.slipSystems && (
            <div className="fact-item full-width">
              <span className="fact-label">Primary Slip Systems:</span>
              <span className="fact-value">
                {structureDef.slipSystems.family} ({structureDef.slipSystems.count} systems)
              </span>
            </div>
          )}
        </div>
        <div className="card-footer-desc">{structureDef.description}</div>
      </div>

      {/* 2. COMPOUND-SPECIFIC PROPERTIES (MATERIAL-INVARIANT) */}
      <div className="infocard compound-specific-card">
        <div className="infocard-header">
          <div className="infocard-badge material">Material Specifics</div>
          <div className="infocard-title">
            {effectiveCompound.name}
            {effectiveCompound.formula ? ` — ${effectiveCompound.formula}` : ''}
          </div>
          <div className="infocard-subtitle">
            Physical properties for this specific chemical composition
          </div>
        </div>

        <div className="infocard-grid">
          <div className="fact-item">
            <span className="fact-label">Lattice Constant a:</span>
            <span className="fact-value highlight-yellow">{activeA.toFixed(3)} Å</span>
          </div>

          {isHex && activeC && (
            <>
              <div className="fact-item">
                <span className="fact-label">Lattice Constant c:</span>
                <span className="fact-value highlight-yellow">{activeC.toFixed(3)} Å</span>
              </div>
              <div className="fact-item">
                <span className="fact-label">c/a Axial Ratio:</span>
                <span className="fact-value">{(activeC / activeA).toFixed(4)}</span>
              </div>
            </>
          )}

          {nearestNeighborDist && (
            <div className="fact-item">
              <span className="fact-label">Nearest-Neighbor Distance:</span>
              <span className="fact-value highlight-yellow">{nearestNeighborDist.toFixed(3)} Å</span>
            </div>
          )}

          {densityResult && (
            <>
              <div className="fact-item">
                <span className="fact-label">Theoretical Mass Density:</span>
                <span className="fact-value highlight-green">{densityResult.density} g/cm³</span>
              </div>
              <div className="fact-item">
                <span className="fact-label">Unit Cell Volume:</span>
                <span className="fact-value">{densityResult.volume} Å³</span>
              </div>
            </>
          )}

          {molarMass && (
            <div className="fact-item">
              <span className="fact-label">Molar Mass:</span>
              <span className="fact-value">{molarMass.toFixed(2)} g/mol</span>
            </div>
          )}
        </div>

        {/* 3. SPECIES LEGEND (Cation vs Anion) */}
        <div className="species-legend-section">
          <div className="legend-title">Atomic Species &amp; Ionic Radii</div>
          <div className="species-list">
            {isTwoSpeciesIonic && effectiveCompound.cation && effectiveCompound.anion && (
              <>
                <div className="species-pill">
                  <span
                    className="species-dot"
                    style={{ backgroundColor: hexColor(effectiveCompound.cation.color) }}
                  />
                  <span className="species-symbol">{effectiveCompound.cation.symbol}</span>
                  <span className="species-role">(Cation, r = {effectiveCompound.cation.r} Å)</span>
                  {effectiveCompound.cation.wyckoff && (
                    <span className="wyckoff-badge">{effectiveCompound.cation.wyckoff}</span>
                  )}
                </div>

                <div className="species-pill">
                  <span
                    className="species-dot"
                    style={{ backgroundColor: hexColor(effectiveCompound.anion.color) }}
                  />
                  <span className="species-symbol">{effectiveCompound.anion.symbol}</span>
                  <span className="species-role">(Anion, r = {effectiveCompound.anion.r} Å)</span>
                  {effectiveCompound.anion.wyckoff && (
                    <span className="wyckoff-badge">{effectiveCompound.anion.wyckoff}</span>
                  )}
                </div>
              </>
            )}

            {isPerovskite && effectiveCompound.aSite && (
              <>
                <div className="species-pill">
                  <span
                    className="species-dot"
                    style={{ backgroundColor: hexColor(effectiveCompound.aSite.color) }}
                  />
                  <span className="species-symbol">{effectiveCompound.aSite.symbol}</span>
                  <span className="species-role">(A-Site Corners, r = {effectiveCompound.aSite.r} Å)</span>
                </div>

                <div className="species-pill">
                  <span
                    className="species-dot"
                    style={{ backgroundColor: hexColor(effectiveCompound.bSite.color) }}
                  />
                  <span className="species-symbol">{effectiveCompound.bSite.symbol}</span>
                  <span className="species-role">(B-Site Center, r = {effectiveCompound.bSite.r} Å)</span>
                </div>

                <div className="species-pill">
                  <span
                    className="species-dot"
                    style={{ backgroundColor: hexColor(effectiveCompound.xSite.color) }}
                  />
                  <span className="species-symbol">{effectiveCompound.xSite.symbol}</span>
                  <span className="species-role">(X-Site Faces, r = {effectiveCompound.xSite.r} Å)</span>
                </div>
              </>
            )}

            {!isTwoSpeciesIonic && !isPerovskite && (
              <div className="species-pill">
                <span
                  className="species-dot"
                  style={{ backgroundColor: hexColor(effectiveCompound.color) }}
                />
                <span className="species-symbol">{effectiveCompound.formula || effectiveCompound.name}</span>
                <span className="species-role">
                  (Atomic radius r ≈ {effectiveCompound.r ? `${effectiveCompound.r} Å` : `${(activeA / 2).toFixed(3)} Å`})
                </span>
              </div>
            )}
          </div>
        </div>

        {effectiveCompound.notes && (
          <div className="card-footer-desc notes-box">
            <Info size={13} className="desc-icon" />
            <span>{effectiveCompound.notes}</span>
          </div>
        )}
      </div>
    </div>
  );
}
