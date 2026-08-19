# Dinoland visual guide

> Status: the prototype now has a cohesive code-drawn art layer. It remains lightweight and easy to iterate without changing game mechanics.

## Direction

The current implementation uses a sunny fenced meadow, animated baby dinosaurs, a magic flower launcher, illustrated care items, decorated eggs, gift boxes, heart progress, and warm wooden inventory controls. Need bubbles reuse the exact item illustrations from the inventory so every request is immediately recognizable.

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
- Character rigs and object textures are generated in Phaser and remain independent from collision geometry
- Keep interactive silhouettes simple and recognizable at inventory, bubble, and field scales

## Next art pass

Future passes can add restrained texture and bespoke sound-reactive effects, but should preserve these silhouettes, palette roles, and shared texture keys.
