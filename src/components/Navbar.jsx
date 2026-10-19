import React from 'react';
import { HelpCircle, RotateCcw, Box } from 'lucide-react';

export default function Navbar({
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
            Interactive 3D Crystallography
          </div>
        </div>
      </div>

      <div className="navbar-actions">
        <button
          className="nav-action-btn"
          onClick={onResetCamera}
          title="Reset 3D camera"
        >
          <RotateCcw size={14} />
          <span className="action-text">Reset</span>
        </button>

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
