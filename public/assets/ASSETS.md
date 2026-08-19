# Runtime assets

The prototype currently ships no raster game art. The field, dinosaur rigs, eggs, care items, gift, flower launcher, inventory, controls, need bubbles, and progress hearts are drawn at runtime with Phaser geometry.

This keeps the visual layer crisp, lightweight, and easy to iterate. Raster art can later replace individual generated texture keys without changing interactions, collisions, scoring, or hatching.
