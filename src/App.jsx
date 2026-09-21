import React, { useState, useMemo, useCallback } from 'react';
import './App.css';
import Navbar from './components/Navbar.jsx';
import CrystalCanvas from './components/CrystalCanvas.jsx';
import ControlSidebar from './components/ControlSidebar.jsx';
import InfoCardPanel from './components/InfoCardPanel.jsx';
import DislocationStudio from './components/DislocationStudio.jsx';
import HelpModal from './components/HelpModal.jsx';
import { STRUCTURE_DEFS } from './data/structures.js';
import { COMPOUNDS } from './data/compounds.js';

export default function App() {
  // App Mode: 'crystal' (Unit Cell Explorer) or 'dislocation' (Defects Studio)
  const [mode, setMode] = useState('crystal');

  // Category and Compound Selection
  const [categoryTab, setCategoryTab] = useState('metal');
  const [selectedCompoundId, setSelectedCompoundId] = useState('cu');

  // Temperature Allotropy State
  const [temperature, setTemperature] = useState(25);

  // Solid Solution (PZT) State
  const [pztFraction, setPztFraction] = useState(0.52); // ~MPB
  const [stochasticDisorder, setStochasticDisorder] = useState(false);

  // 3D Display Toggles
  const [showAtoms, setShowAtoms] = useState(true);
  const [showBonds, setShowBonds] = useState(true);
  const [showOcta, setShowOcta] = useState(false);
  const [showTetra, setShowTetra] = useState(false);
  const [showVoidCages, setShowVoidCages] = useState(true);
  const [showMillerPlanes, setShowMillerPlanes] = useState(false);
  const [activeMillerPlane, setActiveMillerPlane] = useState([1, 1, 1]);
  const [supercellSize, setSupercellSize] = useState(1);

  // Measurements State
  const [measState, setMeasState] = useState({
    side: false,
    face: false,
    body: false,
    octaR: false,
    tetraR: false,
  });

  // Display Settings
  const [atomScale, setAtomScale] = useState(0.52);
  const [autoRotate, setAutoRotate] = useState(true);

  // Modal & Camera triggers
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [resetTrigger, setResetTrigger] = useState(0);

  // Current selected compound
  const rawCompound = useMemo(() => {
    return (
      COMPOUNDS.find((c) => c.id === selectedCompoundId) ||
      COMPOUNDS[0]
    );
  }, [selectedCompoundId]);

  // Handle Allotropic Polymorphism (Iron, Titanium, etc.)
  const activePhase = useMemo(() => {
    if (!rawCompound.tempDependent || !rawCompound.phases) return null;
    return (
      rawCompound.phases.find(
        (p) => temperature >= p.min && temperature <= p.max
      ) || rawCompound.phases[0]
    );
  }, [rawCompound, temperature]);

  // Handle Solid Solutions (PZT Vegard's Law Interpolation)
  const effectiveCompound = useMemo(() => {
    if (!rawCompound.solidSolution) return rawCompound;
    const { zr, ti } = rawCompound.endpoints;
    const lerp = (v1, v2, t) => v1 + (v2 - v1) * t;
    const lerpColor = (c1, c2, t) => {
      const r1 = (c1 >> 16) & 255, g1 = (c1 >> 8) & 255, b1 = c1 & 255;
      const r2 = (c2 >> 16) & 255, g2 = (c2 >> 8) & 255, b2 = c2 & 255;
      const r = Math.round(lerp(r1, r2, t));
      const g = Math.round(lerp(g1, g2, t));
      const b = Math.round(lerp(b1, b2, t));
      return (r << 16) | (g << 8) | b;
    };

    const interpA = lerp(zr.a, ti.a, pztFraction);
    const interpR = lerp(zr.r, ti.r, pztFraction);
    const interpColor = lerpColor(zr.color, ti.color, pztFraction);

    return {
      ...rawCompound,
      a: interpA,
      bSite: {
        symbol: `Zr⁴⁺/Ti⁴⁺ (x=${pztFraction.toFixed(2)})`,
        r: parseFloat(interpR.toFixed(3)),
        color: interpColor,
      },
    };
  }, [rawCompound, pztFraction]);

  // Active Structure Key & Parameters
  const activeStructureKey = activePhase ? activePhase.structure : rawCompound.structure;
  const activeStructureDef = STRUCTURE_DEFS[activeStructureKey] || STRUCTURE_DEFS.fcc;
  const activeA = activePhase ? activePhase.a : effectiveCompound.a;
  const activeC = activePhase ? activePhase.c : effectiveCompound.c;

  const isHex = activeStructureDef.system === 'hexagonal';
  const hasOcta = activeStructureDef.hasOctaVoids;
  const hasTetra = activeStructureDef.hasTetraVoids;

  const handleSelectCompound = (id) => {
    setSelectedCompoundId(id);
    setTemperature(25);
    setMeasState({ side: false, face: false, body: false, octaR: false, tetraR: false });
  };

  const handleToggleMeas = (key) => {
    setMeasState((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleResetCamera = () => {
    setResetTrigger((prev) => prev + 1);
  };

  return (
    <div className="app-layout">
      {/* Top Navigation Bar */}
      <Navbar
        mode={mode}
        setMode={setMode}
        structureName={activeStructureDef.name}
        compoundName={effectiveCompound.name}
        onResetCamera={handleResetCamera}
        onOpenHelp={() => setIsHelpOpen(true)}
      />

      {/* Main Content Area */}
      <main className="app-main-content">
        {mode === 'crystal' ? (
          <div className="crystal-view-layout">
            {/* Split 3D View and Sidebar */}
            <div className="workspace-split">
              {/* 3D Canvas Area */}
              <div className="canvas-column">
                <CrystalCanvas
                  structureDef={activeStructureDef}
                  compound={rawCompound}
                  activeA={activeA}
                  activeC={activeC}
                  effectiveCompound={effectiveCompound}
                  showAtoms={showAtoms}
                  showBonds={showBonds}
                  showOcta={showOcta}
                  showTetra={showTetra}
                  showVoidCages={showVoidCages}
                  showMillerPlanes={showMillerPlanes}
                  activeMillerPlane={activeMillerPlane}
                  supercellSize={supercellSize}
                  measState={measState}
                  atomScale={atomScale}
                  autoRotate={autoRotate}
                  stochasticDisorder={stochasticDisorder}
                  pztFraction={pztFraction}
                  resetTrigger={resetTrigger}
                />
              </div>

              {/* Controls Column */}
              <ControlSidebar
                compounds={COMPOUNDS}
                selectedCompoundId={selectedCompoundId}
                onSelectCompound={handleSelectCompound}
                categoryTab={categoryTab}
                onSelectCategory={setCategoryTab}
                temperature={temperature}
                onTemperatureChange={setTemperature}
                activePhase={activePhase}
                pztFraction={pztFraction}
                onPztFractionChange={setPztFraction}
                stochasticDisorder={stochasticDisorder}
                onToggleStochasticDisorder={setStochasticDisorder}
                showAtoms={showAtoms}
                onToggleAtoms={() => setShowAtoms((v) => !v)}
                showBonds={showBonds}
                onToggleBonds={() => setShowBonds((v) => !v)}
                showOcta={showOcta}
                onToggleOcta={() => setShowOcta((v) => !v)}
                showTetra={showTetra}
                onToggleTetra={() => setShowTetra((v) => !v)}
                showVoidCages={showVoidCages}
                onToggleVoidCages={() => setShowVoidCages((v) => !v)}
                showMillerPlanes={showMillerPlanes}
                onToggleMillerPlanes={() => setShowMillerPlanes((v) => !v)}
                activeMillerPlane={activeMillerPlane}
                onSelectMillerPlane={setActiveMillerPlane}
                supercellSize={supercellSize}
                onSelectSupercell={setSupercellSize}
                measState={measState}
                onToggleMeas={handleToggleMeas}
                atomScale={atomScale}
                onAtomScaleChange={setAtomScale}
                autoRotate={autoRotate}
                onToggleAutoRotate={() => setAutoRotate((v) => !v)}
                isHex={isHex}
                hasOcta={hasOcta}
                hasTetra={hasTetra}
                compound={rawCompound}
                activeA={activeA}
                activeC={activeC}
              />
            </div>

            {/* Structure and Material Information Cards */}
            <InfoCardPanel
              structureDef={activeStructureDef}
              compound={rawCompound}
              activeA={activeA}
              activeC={activeC}
              effectiveCompound={effectiveCompound}
              activePhase={activePhase}
            />
          </div>
        ) : (
          /* Dislocation & Slip Studio Mode */
          <DislocationStudio activeStructureId={activeStructureDef.id} />
        )}
      </main>

      {/* Guide & Help Modal */}
      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
    </div>
  );
}