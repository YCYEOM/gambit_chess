# Image analysis — refs/table.jpg (weathered plank deck)

Protocol: grimoire/intake/image_analysis.md.

## Layer 1 — Identification
- Work type: **weathered softwood plank deck**, photographed obliquely in sun.
- Broad classification: building surface / material sample.
- `primaryDomain`: `object`, but see the suitability note: this is a **MATERIAL reference, not an
  object reference**. There is no bounded object in the frame.
- Confidence 0.95.

## Layer 2 — Overall form & silhouette
- No silhouette. The subject is a plane. In this reconstruction the plane's extent is set by the
  game (a ground surface under the board), not by the reference.

## Layer 3 — Macro -> meso -> micro
- **Macro**: the plank field.
- **Meso**: individual planks of unequal width; the seams between them.
- **Micro**: raised grain ridges, knots with radial cracking, end checks, surface fibre.

## Layer 4 — Spatial relationships
- `<plank, butts, adjacent plank>` contact `gap`; the gap is a dark slot, not a line.
- `<knot, embedded-in, plank>` contact `embed`; grain deflects around it.

## Layer 5 — Materials & surface (PBR)
- Observed: broad soft sheen along the grain ridges, no sharp mirror highlight anywhere.
- Observed: strong linear relief — the soft summer wood has eroded and left the hard grain proud.
- Inference: metalness 0, roughness ~0.85, specular F0 ~4%. Opaque.

## Layer 6 — Colour & finish
Measured over the whole frame:
- plank median **#838386**, hue 240 deg, **saturation 0.022**, value 0.53. Essentially neutral
  grey with a trace of blue. Weathering has removed the wood's colour entirely — this is the
  single most important measurement in the file.
- seam / plank luminance ratio **0.211** (the gaps are very dark, not merely darker).
- grain highlight / plank luminance ratio **1.404**.
- Finish: matte, no varnish.

## Layer 7 — Identity-defining features
1. **Desaturated silver-grey** (sat 0.022). Fresh-wood colour would read as a different material.
2. **Dark plank seams** at ratio 0.211 — slots, not lines.
3. **Unequal plank widths.**
4. **Raised grain ridges** running the plank's length, high contrast (1.404).
5. **Knots** with radial cracking; grain deflects around them.

## Layer 8 — Uncertainty & single-image limits
- No thickness, no edges, no underside: this is a surface, and the frame shows only the surface.
- Plank width in world units is **undetermined** — the photo has no scale reference.
- The sun is hard and directional; the measured tones carry that lighting and are not albedo.
