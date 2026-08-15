# Dinoland: Field-Care Prototype

## Purpose

Test whether a young child enjoys hatching and caring for a small baby triceratops in one readable, toy-like field.

## Core experience

The whole prototype takes place on one fixed field screen. The current mechanics build represents the map, eggs, inventory items, and dinosaurs with simple geometry and visible collision outlines. It contains a small egg, a bottom item tray, and a broad bounded roaming area. Dinosaurs deliberately occupy only a small fraction of the map so a growing herd has room to spread out.

## Player loop

1. Place the egg anywhere in the field and tap it four times to hatch a baby triceratops.
2. Watch the smaller dinosaur roam slowly without leaving the field.
3. A need bubble asks for thirst, play, hunger, affection, or music.
4. Drag the drink container from the item tray onto the field. It remains draggable until a dinosaur reaches it.
5. Bring a thirsty dinosaur and the drink together—by dragging either one or through random roaming—to fulfill thirst.
6. Use the ball from the item tray in the same way to fulfill play.
7. Give either of the two food types to any hungry dinosaur; both foods are valid and return to inventory after being eaten.
8. Tap—not drag—a dinosaur asking for affection.
9. Place the speaker on the field. It remains draggable and satisfies musical dinosaurs inside its proximity ring.
10. Receive one heart for the correct action.
11. At four hearts, reveal a new draggable egg on the field.
12. Tap the new egg four times to hatch another independently managed triceratops.
13. Reset the round to zero hearts and repeat the four-heart target for the next egg.
14. Continue caring for the growing herd without failure states.

## Prototype rules

- The dinosaur is draggable anywhere inside the walkable field bounds.
- The play space is a bounded box inside the visible fence. The whole dinosaur is clamped inside it and visibly bumps when it reaches an edge.
- Spawn points cover the full field, and roaming targets use the enlarged horizontal and vertical range rather than clustering around the center.
- Random roaming pauses during direct manipulation and reactions.
- Every dinosaur owns an independent need and comic bubble.
- A need bubble is a non-physical visual attached at a fixed offset above its dinosaur. It can cross the field boundary and overlap other bubbles without affecting collisions.
- Every movable field object, including both eggs, remains draggable inside the play bounds.
- The ball, drink, and both foods return to inventory after contact so they can be placed again.
- Both foods fulfill the same hunger need for every dinosaur; food preference is not restricted by dinosaur type in this prototype.
- Affection responds to a clean tap on the dinosaur and ignores drag gestures.
- The speaker is a persistent solid field object with a larger non-physical music radius. It can satisfy multiple dinosaurs without being consumed.
- Dino/object proximity is checked continuously, so random roaming can discover a placed toy. The dinosaur that touches it owns the interaction; it cannot fulfill another dinosaur's need.
- Dinosaurs maintain physical separation from one another and from every visible unopened egg. Dragging an egg into a dinosaur pushes the dinosaur out of the egg collider.
- Thirst, play, hunger, affection, and music cycle independently per dinosaur for predictable prototype testing.
- A newly hatched dinosaur already has a fully visible first need when it becomes playable; later needs recur after its own need is completed.
- Performing the wrong action is harmless but gives no heart.
- Progress persists locally: first hatch, current heart round, target, and herd size.
- The reset control clears all progress immediately when clicked.

## Interaction principles

- Need icons remain visual; debug labels only identify prototype objects and score state.
- Every target is large and forgiving.
- A valid care action gets immediate sound, motion, particles, and heart feedback.
- The dinosaur cannot be harmed, lost, or dragged out of bounds.
- The care loop now tests three interaction families: consumable items, direct tapping, and persistent proximity objects.

## Test coverage

- Unit tests cover hatch sequences, per-dinosaur recurring needs, repeated four-heart score rounds, reset, and legacy storage migration.
- Browser tests cover partially cracked egg dragging, hatch interruption safety, opaque spawned dinos, independent needs, physical egg separation, immediate reset, both food types, affection taps, persistent music proximity, drink interaction, and ball collision ownership.

## Next questions for playtesting

- Is the small egg still discoverable without instruction?
- Is the need bubble understood without text?
- Is dragging a drink from inventory toward a thirsty dinosaur intuitive?
- Is dragging a ball out of the tray intuitive?
- Is four hearts too fast or too slow for the second egg to appear?
- Does the child understand that both eggs can be repositioned before hatching?
- Is the ball returning to inventory clear and satisfying?
- Does random roaming make the dinosaur feel alive or make it harder to grab?
