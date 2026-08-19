# Suitability verdict — CONDITIONAL, material-only
Rubric: grimoire/intake/validation_rubric.md

The rubric is written for object references and this is not one. There is no bounded target
object: the frame is a surface. Rather than force a PASS or a REJECT, the honest classification
is **material-only reconstruction**:

- geometry comes from the GAME (a ground plane under the board, extent chosen to cover the
  camera frustum), not from the reference;
- the reference supplies the MATERIAL: colour, seam structure, plank rhythm, grain relief;
- consequently there is no silhouette to review, and silhouette IoU is not a meaningful gate here.

What the reference does support well: it is sharp, evenly lit, and shows the full frequency
range from plank seams down to fibre, which is exactly what a procedural material needs.
