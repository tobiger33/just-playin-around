# Motion Lab

A lightweight, agent-friendly toolkit for building expressive mascot motion,
alongside a gallery of loading indicator experiments.

## Mascot Motion Toolkit

Upload a single image for whole-character movement or transparent image parts
for articulated gestures. Preview motion in 2D and CSS 3D, set joint pivots,
then copy an animation brief for your coding agent or download a starter bundle
containing the image parts and scene configuration.

- [Open Mascot Motion Studio](mascot-motion-studio.html)
- [Read the coding-agent workflow](AGENTS.md)
- [Use the animation runtime](mascot-motion.js)

The runtime supports keyframed translation, squash-and-stretch, opacity,
rotation on all three axes, perspective, parented image layers, and reduced
motion preferences. High-quality articulation works best with separated,
transparent artwork parts.

## Loading Indicator Gallery

Each loading indicator has a standalone HTML demo and two animated previews:
the complete outline on the left and only the moving blue traces on the right.

## Gallery

### 01 · Four Petals

Four soft loops form a flower. The shape stays still while a single light trace
moves along its outline.

<p align="center">
  <img src="assets/four-petals.gif" width="160" alt="Four-petal loading indicator with a gray outline and a moving blue trace" />
  &nbsp;&nbsp;
  <img src="assets/four-petals-lines-only.gif" width="160" alt="Only the moving blue trace of the four-petal design" />
</p>

[View in browser](loading-indicator.html)

---

### 02 · Four Petals — 360°

The flower slowly rotates around its vertical (Y) axis. A light trace travels
along the outline to emphasize its depth.

<p align="center">
  <img src="assets/four-petals-360.gif" width="160" alt="Four-petal loading indicator with an outline, slowly rotating through 360 degrees" />
  &nbsp;&nbsp;
  <img src="assets/four-petals-360-lines-only.gif" width="160" alt="Only the moving blue trace of the rotating four-petal design" />
</p>

[View in browser](loading-indicator-360.html)

---

### 03 · Four Petals — Crossed 360°

Two flower planes intersect at right angles and rotate together through 360°.
A separate, slightly offset light trace moves along each plane.

<p align="center">
  <img src="assets/four-petals-crossed-360.gif" width="160" alt="Two intersecting four-petal planes with outlines and moving light traces" />
  &nbsp;&nbsp;
  <img src="assets/four-petals-crossed-360-lines-only.gif" width="160" alt="Only the moving blue traces of the two rotating intersecting planes" />
</p>

[View in browser](loading-indicator-crossed-360.html)

---

### 04 · Four Petals — Orbital Triad 360°

Three flower planes form an orthogonal cross. They remain rigidly aligned and
rotate together around a space diagonal.

<p align="center">
  <img src="assets/four-petals-triad-360.gif" width="160" alt="Three orthogonal four-petal planes with outlines and moving light traces" />
  &nbsp;&nbsp;
  <img src="assets/four-petals-triad-360-lines-only.gif" width="160" alt="Only the moving blue traces of the three rotating planes" />
</p>

[View in browser](loading-indicator-triad-360.html)

---

### 05 · Four Petals — Octahedral Seven 360°

Four additional planes are perpendicular to the four body diagonals, joining
the orthogonal three-plane cross. All seven planes remain rigidly aligned and
rotate together around a space diagonal.

<p align="center">
  <img src="assets/four-petals-octahedral-360.gif" width="160" alt="Seven symmetrically arranged four-petal planes with outlines and moving blue traces" />
  &nbsp;&nbsp;
  <img src="assets/four-petals-octahedral-360-lines-only.gif" width="160" alt="Only the moving blue traces of the seven rotating planes" />
</p>

[View in browser](loading-indicator-octahedral-360.html)

---

### 06 · Four Petals — Cubic Thirteen 360°

Six additional planes, perpendicular to the cube's face diagonals, complete
the 13-plane symmetric arrangement. All planes stay rigidly aligned as they
rotate together through 360°.

<p align="center">
  <img src="assets/four-petals-cubic-360.gif" width="160" alt="Thirteen symmetrically arranged four-petal planes with outlines and moving blue traces" />
  &nbsp;&nbsp;
  <img src="assets/four-petals-cubic-360-lines-only.gif" width="160" alt="Only the moving blue traces of the thirteen rotating planes" />
</p>

[View in browser](loading-indicator-cubic-360.html)
