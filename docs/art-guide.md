# Dinoland placeholder visual guide

> Status: final art is intentionally deferred. The live prototype uses code-generated geometry and visible collision bounds so playtesting can focus on mechanics.

## Direction

The current implementation uses a flat debug field, a visible grid, colored dinosaur boxes, egg ellipses, a ball circle, and a circular bath. Each collider is outlined onscreen. These placeholders retain the intended fixed three-quarter top-down game layout without implying that the art direction is final.

## Palette

- Mint dinosaur: `#83cdb1`
- Deep mint shadow: `#4f927c`
- Peach belly and egg markings: `#e99982`
- Cream horns and shell: `#f8e5b7`
- Honey wood: `#c98e55`
- Leaf green: `#79a768`
- Sky blue: `#9ddce5`
- Charcoal outlines: `#3f5750`

## Character

The baby triceratops has an oversized head and frill, short sturdy legs, three cream horns, a peach belly, large dark eyes, and a friendly closed-mouth smile. It is always shown in a soft three-quarter view facing right. Reactions are created mostly with Phaser motion and particles so the approved character remains visually consistent.

## Rendering

- Soft gouache texture with restrained detail
- Dark green-brown outlines, never pure black
- Diffuse morning light from the upper left
- Gentle ambient shadow only in the environment
- No embedded text, logos, or photorealistic materials
- Interactive cutouts use transparent backgrounds and generous padding

## Canvas and exports

- Logical game canvas: `1280 × 720`
- Background export: landscape, cropped to `1280 × 720`
- Character/object sources: square images, then transparent PNG cutouts
- Keep generated source files out of runtime assets; commit only optimized final assets

## Future art pass

The palette and character notes below are retained as possible future direction, not as requirements for the current mechanics prototype. Runtime textures should only be reintroduced after the click, drag, collision, need, scoring, and repeated hatching loops are validated.
