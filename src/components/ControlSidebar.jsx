import React, { useState, useMemo } from 'react';
import {
  Search,
  Atom,
  Link2,
  Diamond,
  Triangle,
  Ruler,
  RotateCw,
  Thermometer,
  Layers,
  Sliders,
  Grid3X3,
  Box,
  Split,
  Sparkles,
} from 'lucide-react';
import { CATEGORIES } from '../data/compounds.js';

export default function ControlSidebar({
  compounds,
  selectedCompoundId,
  onSelectCompound,
  categoryTab,
  onSelectCategory,
  temperature,
  onTemperatureChange,
  activePhase,
  pztFraction,
  onPztFractionChange,
  stochasticDisorder,
  onToggleStochasticDisorder,
  showAtoms,
  onToggleAtoms,
  showBonds,
  onToggleBonds,
  showOcta,
  onToggleOcta,
  showTetra,
  onToggleTetra,
  showVoidCages,
  onToggleVoidCages,
  showMillerPlanes,
  onToggleMillerPlanes,
  activeMillerPlane,
  onSelectMillerPlane,
  supercellSize,
  onSelectSupercell,
  measState,
  onToggleMeas,
  atomScale,
  onAtomScaleChange,
  autoRotate,
  onToggleAutoRotate,
  isHex,
  hasOcta,
  hasTetra,
  compound,
  activeA,
  activeC,
}) {
  const [searchQuery, setSearchQuery] = useState('');

  // Filtered compounds based on category and search query
  const filteredCompounds = useMemo(() => {
    return compounds.filter((c) => {
      const matchCat = categoryTab === 'all' || c.category === categoryTab;
      if (!searchQuery.trim()) return matchCat;
      const query = searchQuery.toLowerCase().trim();
      const matchName = c.name.toLowerCase().includes(query);
      const matchFormula = c.formula?.toLowerCase().includes(query);
      const matchStruct = c.structure?.toLowerCase().includes(query);
      return (matchName || matchFormula || matchStruct) && matchCat;
    });
  }, [compounds, categoryTab, searchQuery]);

  return (
    <aside className="control-sidebar">
      {/* Category Filter Pills */}
      <div className="sidebar-section category-tabs-section">
        <div className="sidebar-section-title">Category</div>
        <div className="category-pills">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              className={`category-pill ${categoryTab === cat.id ? 'active' : ''}`}
              onClick={() => {
                onSelectCategory(cat.id);
                // Select first compound in new category
                const first = compounds.find((c) => c.category === cat.id);
                if (first) onSelectCompound(first.id);
              }}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Compound Selector with Instant Search */}
      <div className="sidebar-section">
        <div className="sidebar-section-title">Compound &amp; Material</div>
        <div className="search-box">
          <Search size={14} className="search-icon" />
          <input
            type="text"
            placeholder="Search element, formula (e.g. Fe, FCC, NaCl)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>

        <select
          value={selectedCompoundId}
          onChange={(e) => onSelectCompound(e.target.value)}
          className="compound-select-dropdown"
        >
          {filteredCompounds.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} {c.formula ? `[${c.formula}]` : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Temperature-Dependent Polymorphism Slider */}
      {compound.tempDependent && compound.phases && (
        <div className="sidebar-section highlight-section">
          <div className="sidebar-section-title">
            <Thermometer size={14} className="title-icon" />
            <span>Temperature Allotropy: {temperature}°C</span>
          </div>
          <input
            type="range"
            min={compound.phases[0].min}
            max={compound.phases[compound.phases.length - 1].max}
            step="1"
            value={temperature}
            onChange={(e) => onTemperatureChange(parseInt(e.target.value, 10))}
            className="range-slider temp-slider"
          />
          <div className="phase-indicator-badge">
            <span className="phase-badge-label">Active Phase:</span>
            <span className="phase-badge-value">
              {activePhase ? activePhase.name : 'Standard'}
            </span>
          </div>
          <div className="phase-range-labels">
            {compound.phases.map((p) => (
              <span
                key={p.name}
                className={`phase-range-tick ${activePhase?.name === p.name ? 'active' : ''}`}
                onClick={() => onTemperatureChange(Math.round((p.min + p.max) / 2))}
              >
                {p.name.split(' ')[0]} ({p.min}–{p.max}°C)
              </span>
            ))}
          </div>
          <div className="sidebar-hint">
            Drag the slider to watch the crystal lattice transform between allotropic phases in real-time!
          </div>
        </div>
      )}

      {/* Solid Solution (PZT) Composition Slider */}
      {compound.solidSolution && (
        <div className="sidebar-section highlight-section">
          <div className="sidebar-section-title">
            <Sliders size={14} className="title-icon" />
            <span>Composition: Ti fraction x = {pztFraction.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={pztFraction}
            onChange={(e) => onPztFractionChange(parseFloat(e.target.value))}
            className="range-slider pzt-slider"
          />
          <div className="solid-solution-endpoints">
            <span onClick={() => onPztFractionChange(0.0)}>PbZrO₃ (x=0.0)</span>
            <span
              onClick={() => onPztFractionChange(0.52)}
              className="mpb-tag"
              title="Morphotropic Phase Boundary"
            >
              MPB (x≈0.52)
            </span>
            <span onClick={() => onPztFractionChange(1.0)}>PbTiO₃ (x=1.0)</span>
          </div>

          <div className="stochastic-toggle-row">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={stochasticDisorder}
                onChange={(e) => onToggleStochasticDisorder(e.target.checked)}
              />
              <span>Simulate Stochastic B-Site Disorder in Supercells</span>
            </label>
          </div>
          <div className="sidebar-hint">
            In real solid solutions, Zr⁴⁺ and Ti⁴⁺ randomly occupy B-sites. This view interpolates lattice constant a via Vegard's law.
          </div>
        </div>
      )}

      {/* 3D Visual Layers Toggles */}
      <div className="sidebar-section">
        <div className="sidebar-section-title">3D Display Layers</div>
        <div className="toggle-grid">
          <button
            className={`display-toggle-btn ${showAtoms ? 'active' : ''}`}
            onClick={onToggleAtoms}
          >
            <Atom size={15} />
            <span>Atoms</span>
          </button>

          <button
            className={`display-toggle-btn ${showBonds ? 'active' : ''}`}
            onClick={onToggleBonds}
          >
            <Link2 size={15} />
            <span>Bonds</span>
          </button>

          <button
            className={`display-toggle-btn octa ${showOcta ? 'active' : ''}`}
            onClick={onToggleOcta}
            disabled={!hasOcta}
            title={hasOcta ? 'Toggle octahedral voids' : 'No octahedral voids in this structure'}
          >
            <Diamond size={15} />
            <span>Octa Voids</span>
          </button>

          <button
            className={`display-toggle-btn tetra ${showTetra ? 'active' : ''}`}
            onClick={onToggleTetra}
            disabled={!hasTetra}
            title={hasTetra ? 'Toggle tetrahedral voids' : 'No tetrahedral voids in this structure'}
          >
            <Triangle size={15} />
            <span>Tetra Voids</span>
          </button>
        </div>

        {/* Supercell Selector */}
        <div className="supercell-bar">
          <span className="supercell-title">Lattice Supercell:</span>
          <div className="supercell-btns">
            {[1, 2, 3].map((size) => (
              <button
                key={size}
                className={`supercell-btn ${supercellSize === size ? 'active' : ''}`}
                onClick={() => onSelectSupercell(size)}
              >
                {size}×{size}×{size}
              </button>
            ))}
          </div>
        </div>

        {/* Miller Planes Selector */}
        {!isHex && (
          <div className="miller-planes-bar">
            <div className="miller-header">
              <span>Miller Slice Planes:</span>
              <button
                className={`miller-toggle-switch ${showMillerPlanes ? 'active' : ''}`}
                onClick={onToggleMillerPlanes}
              >
                {showMillerPlanes ? 'Visible' : 'Hidden'}
              </button>
            </div>
            {showMillerPlanes && (
              <div className="miller-preset-btns">
                {[
                  { label: '(100)', plane: [1, 0, 0] },
                  { label: '(110)', plane: [1, 1, 0] },
                  { label: '(111)', plane: [1, 1, 1] },
                ].map((item) => (
                  <button
                    key={item.label}
                    className={`miller-btn ${
                      activeMillerPlane[0] === item.plane[0] &&
                      activeMillerPlane[1] === item.plane[1] &&
                      activeMillerPlane[2] === item.plane[2]
                        ? 'active'
                        : ''
                    }`}
                    onClick={() => onSelectMillerPlane(item.plane)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Dimension Lines & Measurements */}
      <div className="sidebar-section">
        <div className="sidebar-section-title">
          <Ruler size={14} className="title-icon" />
          <span>Measurements &amp; Dimensions</span>
        </div>
        <div className="meas-buttons-list">
          <button
            className={`meas-toggle-btn ${measState.side ? 'active' : ''}`}
            onClick={() => onToggleMeas('side')}
          >
            <span>{isHex ? 'Basal Edge (a)' : 'Cell Edge (a)'}</span>
            <span className="meas-val-preview">{activeA.toFixed(3)} Å</span>
          </button>

          {isHex && activeC && (
            <button
              className={`meas-toggle-btn ${measState.face ? 'active' : ''}`}
              onClick={() => onToggleMeas('face')}
            >
              <span>Height (c)</span>
              <span className="meas-val-preview">{activeC.toFixed(3)} Å</span>
            </button>
          )}

          {!isHex && (
            <>
              <button
                className={`meas-toggle-btn ${measState.face ? 'active' : ''}`}
                onClick={() => onToggleMeas('face')}
              >
                <span>Face Diagonal (a√2)</span>
                <span className="meas-val-preview">{(activeA * Math.SQRT2).toFixed(3)} Å</span>
              </button>

              <button
                className={`meas-toggle-btn ${measState.body ? 'active' : ''}`}
                onClick={() => onToggleMeas('body')}
              >
                <span>Body Diagonal (a√3)</span>
                <span className="meas-val-preview">{(activeA * Math.sqrt(3)).toFixed(3)} Å</span>
              </button>

              {hasOcta && (
                <button
                  className={`meas-toggle-btn octa ${measState.octaR ? 'active' : ''}`}
                  onClick={() => onToggleMeas('octaR')}
                >
                  <span>Octa. Void Distance (a/2)</span>
                  <span className="meas-val-preview">{(activeA * 0.5).toFixed(3)} Å</span>
                </button>
              )}

              {hasTetra && (
                <button
                  className={`meas-toggle-btn tetra ${measState.tetraR ? 'active' : ''}`}
                  onClick={() => onToggleMeas('tetraR')}
                >
                  <span>Tetra. Void Distance (a√3/4)</span>
                  <span className="meas-val-preview">
                    {(activeA * (Math.sqrt(3) / 4)).toFixed(3)} Å
                  </span>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Visual Sliders & Auto-Rotate */}
      <div className="sidebar-section">
        <div className="sidebar-section-title">Display Settings</div>
        <div className="slider-container">
          <div className="slider-label-row">
            <span>Atom Display Radius:</span>
            <span className="slider-value">{(atomScale * 100).toFixed(0)}%</span>
          </div>
          <input
            type="range"
            min="0.2"
            max="0.85"
            step="0.01"
            value={atomScale}
            onChange={(e) => onAtomScaleChange(parseFloat(e.target.value))}
            className="range-slider"
          />
        </div>

        <button
          className={`autorotate-btn ${autoRotate ? 'active' : ''}`}
          onClick={onToggleAutoRotate}
        >
          <RotateCw size={15} />
          <span>{autoRotate ? 'Auto-Rotate: Enabled' : 'Auto-Rotate: Paused'}</span>
        </button>
      </div>
    </aside>
  );
}
