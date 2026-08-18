# Image analysis — refs/board.jpg (folding wooden chessboard)

Protocol: grimoire/intake/image_analysis.md. Observation stated separately from inference;
3D object-space terms; single-view limits declared in Layer 8.

## Layer 1 — Identification & classification
- Work type: **folding wooden chessboard** (two-leaf board-box, veneered playing field).
- Broad classification: furnishing / game board.
- `primaryDomain`: `object`. Confidence 0.95.
- Physical inventory before meaning: one flat square slab; a recessed-reading 8x8 two-tone field;
  a continuous wide surround; four tall plain side faces; a straight kerf across the middle;
  short parallel kerf clusters near the corners of the side faces.

## Layer 2 — Overall form & silhouette
- Bounding volume: a single **cuboid**, square footprint.
- Symmetry: **bilateral on both horizontal axes**; 4-fold about the vertical axis, broken only by
  the middle kerf (2-fold) and the corner kerf clusters.
- Shape language: geometric, orthogonal. No curvature anywhere except an eased top arris.
- Proportion (measured against board width W): side-face height ~0.075W; playing field ~0.78W;
  border rail width ~0.11W per side. Square pitch = playing field / 8.

## Layer 3 — Macro -> meso -> micro
- **Macro**: (1) slab body, (2) playing field, (3) border frame.
- **Meso**: 64 square inlays in two tones; 4 mitred frame rails; 4 side faces; middle kerf
  splitting the slab into two leaves.
- **Micro**: corner spline kerfs (3 thin parallel grooves on each side face near each corner);
  per-rail grain direction running along the rail's length; eased outer top arris.

## Layer 4 — Spatial relationships
- `<playing field, inlaid-into, slab top face>` contact `embed`, embedDepth ~0 (veneer, coplanar).
- `<border frame, surrounds, playing field>` contact `butt`, tops coplanar.
- `<frame rail, mitred-to, adjacent rail>` contact `butt` at 45 deg.
- `<side face, below, frame outer edge>` contact `flush-with`.
- `<spline kerf, embedded-in, side face>` contact `embed`, shallow groove.
- `<middle kerf, splits, slab body>` contact `gap`.

## Layer 5 — Materials & surface (PBR)
One material family: **varnished light hardwood**, dielectric.
- Observed: two square tones of *similar value*, both warm; the frame reads between them.
- Observed: broad soft specular sheen across the near side face, no sharp mirror highlight.
- Observed: directional open-pore grain lines, longest and most visible on the frame rails and
  side faces; shorter, finer figure inside the inlay squares.
- Inference: metalness 0; roughness satin ~0.38 top face, ~0.32 side faces; specular F0 ~4%.
- Translucency: opaque.

## Layer 6 — Color & finish
- Hue band 30-40 deg (orange-yellow) for every region; mid-high value; mid saturation.
- Light square: high value, mid-low saturation. Dark square: mid value, mid saturation.
  **The value gap between the two is small** — this is wood-on-wood, not black-and-white.
- Frame: value between the two squares, saturation closest to the dark square.
- Finish: satin varnish, wide gloss lobe.
- Baked lighting: the top face brightens toward the back-left. This is illumination, not albedo,
  and must not be read into base color.

## Layer 7 — Identity-defining features
1. **Low-contrast wood-on-wood squares** (not black/white).
2. **Wide mitred border frame** with visible 45 deg corner miters.
3. **Thick slab with a tall plain side face** — the board reads as a box, not a sheet.
4. **Corner spline kerfs**: three thin parallel grooves on the side face near each corner.
5. Middle kerf (folding seam).

## Layer 8 — Uncertainty & single-image limits
- Underside: **hidden** (not in view).
- Rear and far-left side faces: **occluded/foreshortened**; spline kerf symmetry is *inference*.
- Square count 8x8: **counted**, not inferred.
- Whether the frame is a glued-on rail or a border veneer on one slab: **undetermined**.
- Hinge hardware: **hidden** inside the seam.
- Environment: shot on white with the cast shadow removed; light direction inferable, environment
  unknown.

## Declared deviation for this project (not a fidelity miss)
Identity feature 5 (**middle kerf**) will be **deliberately excluded**. gambit_chess renders a
single fixed slab; a seam across the playing field would cut the a-h files and read as a
rendering artifact. Every other identity feature is in scope.
