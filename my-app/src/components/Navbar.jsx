import React from 'react';
import { Layers, Activity, HelpCircle, RotateCcw, Box } from 'lucide-react';

export default function Navbar({
  mode,
  setMode,
  structureName,
  compoundName,
  onResetCamera,
  onOpenHelp,
}) {
  return (
    <header className="navbar-container">
      <div className="navbar-brand">
        <div className="brand-logo">
          <Box size={20} className="logo-icon" />
        </div>
        <div className="brand-text">
          <div className="brand-title">Crystal Explorer</div>
          <div className="brand-subtitle">
            3D Crystallography &amp; Defects
          </div>
        </div>
      </div>

      <div className="navbar-center-tabs">
        <button
          className={`nav-tab-btn ${mode === 'crystal' ? 'active' : ''}`}
          onClick={() => setMode('crystal')}
          title="Unit Cell & Crystal Explorer"
        >
          <Layers size={15} />
          <span className="tab-label-full">Unit Cell &amp; Crystal</span>
          <span className="tab-label-short">Crystals</span>
        </button>

        <button
          className={`nav-tab-btn ${mode === 'dislocation' ? 'active' : ''}`}
          onClick={() => setMode('dislocation')}
          title="Dislocation & Slip Studio"
        >
          <Activity size={15} />
          <span className="tab-label-full">Dislocations &amp; Slip</span>
          <span className="tab-label-short">Defects</span>
        </button>
      </div>

      <div className="navbar-actions">
        {mode === 'crystal' && (
          <button
            className="nav-action-btn"
            onClick={onResetCamera}
            title="Reset 3D camera"
          >
            <RotateCcw size={14} />
            <span className="action-text">Reset</span>
          </button>
        )}

        <button
          className="nav-action-btn help-btn"
          onClick={onOpenHelp}
          title="Open Crystallography Guide"
        >
          <HelpCircle size={14} />
          <span className="action-text">Guide</span>
        </button>
      </div>
    </header>
  );
}
