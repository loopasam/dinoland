# Runtime assets

The prototype currently ships no raster game art. The field, dinosaurs, eggs, ball, bath, inventory, controls, need bubbles, and collision boundaries are generated from simple Phaser geometry in `src/scenes/NurseryScene.ts`.

This is intentional: the visual layer stays transparent while the reusable N-dinosaur interaction, collision, scoring, and hatching systems are validated. Final art can later replace the generated texture keys without changing those mechanics.
