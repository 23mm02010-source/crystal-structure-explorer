import React from 'react';
import {
  X,
  BookOpen,
  Layers,
  Diamond,
  CheckCircle,
} from 'lucide-react';

export default function HelpModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-wrap">
            <BookOpen size={20} className="modal-icon" />
            <span className="modal-title">Crystallography Primer</span>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-scroll-body">
          {/* Section 1 */}
          <div className="modal-guide-section">
            <div className="guide-section-heading">
              <Layers size={16} />
              <span>1. What is a Unit Cell &amp; Periodic Lattice?</span>
            </div>
            <p>
              A crystal is not an isolated box; it is an infinite periodic 3D tiling of identical building blocks called <strong>unit cells</strong>. Atoms situated at corners, edges, or faces are shared between multiple neighboring cells:
            </p>
            <ul className="guide-bullets">
              <li><strong>Corner atom:</strong> Shared equally among 8 adjacent unit cells (1/8 per cell).</li>
              <li><strong>Edge atom:</strong> Shared among 4 unit cells (1/4 per cell).</li>
              <li><strong>Face-center atom:</strong> Shared between 2 unit cells (1/2 per cell).</li>
              <li><strong>Body-center atom:</strong> Fully contained inside 1 unit cell (1 per cell).</li>
            </ul>
          </div>

          {/* Section 2 */}
          <div className="modal-guide-section">
            <div className="guide-section-heading">
              <CheckCircle size={16} />
              <span>2. Interactive Coordination Number (CN)</span>
            </div>
            <p>
              The <strong>coordination number</strong> is the number of immediate nearest neighbors touching a central atom.
            </p>
            <div className="guide-callout-box">
              <strong>Why textbook diagrams confuse students:</strong> If you count neighbors inside only a single drawn unit cell, a corner atom in FCC appears to have only 3 neighbors! But in a real bulk crystal, it is surrounded by <strong>12 nearest neighbors</strong> spanning across 8 adjacent cells.
            </div>
            <p>
              <strong>In this explorer:</strong> Click any atom! The visualizer will dynamically reach into adjacent unit cells, spawn all external neighbors with golden coordination bonds, and draw dashed outlines of the neighboring cells so you can see the true geometry.
            </p>
          </div>

          {/* Section 3 */}
          <div className="modal-guide-section">
            <div className="guide-section-heading">
              <Diamond size={16} />
              <span>3. Voids (Interstitial Sites) &amp; Coordination Cages</span>
            </div>
            <p>
              Voids are the empty geometric spaces nestled between close-packed atoms. Atoms or interstitial impurities (like Carbon in Iron to make steel) occupy these sites:
            </p>
            <ul className="guide-bullets">
              <li>
                <strong>Octahedral Voids (Amber):</strong> Surrounded by 6 coordinating atoms arranged in an octahedron. In FCC, there are 4 net octahedral voids per cell (1 at body-center, 12 at edge-centers × 1/4). Critical radius ratio: r_void / r_atom = √2 - 1 ≈ 0.414.
              </li>
              <li>
                <strong>Tetrahedral Voids (Teal):</strong> Surrounded by 4 coordinating atoms arranged in a tetrahedron. In FCC, there are 8 tetrahedral voids located at the centers of the 8 sub-octants (1/4, 1/4, 1/4). Critical radius ratio: r_void / r_atom = √(3/2) - 1 ≈ 0.225.
              </li>
            </ul>
            <p>
              Turn on the <strong>Octa/Tetra Voids</strong> toggle to inspect their polyhedral shapes and connector lines radiating to their coordinating atom cages.
            </p>
          </div>
        </div>

        <div className="modal-footer">
          <button className="modal-dismiss-btn" onClick={onClose}>
            Got it, let's explore!
          </button>
        </div>
      </div>
    </div>
  );
}
