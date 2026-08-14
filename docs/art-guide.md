# Dinoland art guide

## Direction

Dinoland uses a warm, hand-painted 2D storybook style with a fixed three-quarter top-down field view. Shapes are rounded, silhouettes are readable at tablet size, and nothing is sharp, threatening, or visually noisy.

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

## Asset prompts

Final prompts and generation method are recorded in `public/assets/ASSETS.md` alongside the shipped files.
