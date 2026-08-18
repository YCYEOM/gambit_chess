# Image analysis — refs/base-oak.jpg (oak log cross-section)

Protocol: grimoire/intake/image_analysis.md.

## Layer 1 — Identification
- Work type: **cross-section slice of an oak log** (end-grain disc), held up by a hand outdoors.
- Broad classification: natural material sample.
- `primaryDomain`: `object`. Confidence 0.95.

## Layer 2 — Overall form & silhouette
- Bounding volume: a **short cylinder**; the footprint is a circle whose edge is *irregular*,
  not a true circle — the bark makes it lobed.
- Symmetry: **radial, imperfect**. The pith is off-centre.
- Aspect: thickness is not measurable from this view (seen face-on). Only the face matters here.

## Layer 3 — Macro -> meso -> micro
- **Macro**: (1) the wood disc, (2) the bark rim.
- **Meso**: pith (dark centre), heartwood field, sapwood band, bark ring.
- **Micro**: growth rings, radial rays, surface saw texture.

## Layer 4 — Spatial relationships
- `<pith, inside, heartwood>` contact `embed`, at an offset from the geometric centre.
- `<sapwood, surrounds, heartwood>` contact `flush-with`, boundary diffuse not sharp.
- `<bark, surrounds, sapwood>` contact `butt`, boundary sharp on the inside and ragged outside.

## Layer 5 — Materials & surface (PBR)
- Observed: no specular highlight anywhere on the face. Fully **matte** — this is a rough sawn
  end grain, not a finished surface. (Contrast with the game board's satin varnish.)
- Observed: fine radial saw scoring across the whole face.
- Inference: metalness 0, roughness ~0.9, specular F0 ~4%. Opaque.
- The bark is a separate material: darker, rougher, with much larger relief.

## Layer 6 — Colour & finish
Measured on a radial fan through the upper (unoccluded) sector, luminance vs radius:
- r/R 0.00-0.03  pith: dark (lum 45-73)
- r/R 0.03-0.72  heartwood: mid warm (lum ~106-155, oscillating)
- r/R 0.72-0.88  **sapwood: distinctly paler** (lum ~160-183)
- r/R 0.88-1.00  bark: dark (lum ~67-87)
- Growth rings oscillate with a period of about 0.058R, roughly 17 rings across the radius,
  denser toward the outside.

## Layer 7 — Identity-defining features
1. **Ragged bark rim** — dark, irregular thickness measured between 0.03R and 0.12R around
   the perimeter. The disc is not a clean circle.
2. **Pale sapwood band** — a clearly lighter ring just inside the bark. This is the strongest
   single cue that the object is a log slice and not a wooden coaster.
3. **Concentric growth rings** with an **off-centre pith**.
4. **Dark pith** at the centre.
5. Matte rough-sawn face with radial saw scoring.

## Layer 8 — Uncertainty & single-image limits
- **Side face and back: hidden.** The slice is seen face-on; its thickness is undetermined.
- The hand **occludes** the lower-left arc of the rim.
- Background (sky, trees) is **not isolated**; the reference is admitted as *conditional*.
- Pith offset direction/magnitude is **inference** from the visible ring centres, not measured.
- The bark's true colour is uncertain: no bark-only region in this photo is large enough or
  clean enough to extract PBR from, so bark is derived rather than measured.
