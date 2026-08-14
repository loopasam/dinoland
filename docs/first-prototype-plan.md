# Dinoland: Field-Care Prototype

## Purpose

Test whether a young child enjoys hatching and caring for a small baby triceratops in one readable, toy-like field.

## Core experience

The whole prototype takes place on one three-quarter top-down meadow screen. The map contains a small egg, a permanent pond, a bottom item tray, and a large safe roaming area enclosed by scenery and a fence.

## Player loop

1. Place the egg anywhere in the field and tap it four times to hatch a baby triceratops.
2. Watch the smaller dinosaur roam slowly without leaving the field.
3. A comic bubble asks for either a bath or play.
4. Drag the dinosaur into the pond to fulfill a bath need.
5. Drag the ball from the item tray onto the field. It remains draggable until a dinosaur reaches it.
6. Bring the dinosaur and ball together—by dragging either one or through random roaming—to fulfill a play need.
7. Receive one heart for the correct action.
8. After play, the ball immediately returns to its inventory slot for another toss.
9. At four hearts, reveal a new draggable egg on the field.
10. Tap the new egg four times to hatch another independently managed triceratops.
11. Reset the round to zero hearts and repeat the four-heart target for the next egg.
12. Continue caring for the growing herd without failure states.

## Prototype rules

- The dinosaur is draggable anywhere inside the walkable field bounds.
- The play space is a bounded box inside the visible fence. The whole dinosaur is clamped inside it and visibly bumps when it reaches an edge.
- Random roaming pauses during direct manipulation and reactions.
- The pond stays on the main map; there is no separate bath screen.
- Every dinosaur owns an independent need and comic bubble.
- Every movable field object, including both eggs, remains draggable inside the play bounds.
- The ball returns to inventory after a play collision so it can be thrown again.
- Dino/object proximity is checked continuously, so random roaming can discover a placed toy. The dinosaur that touches it owns the interaction; it cannot fulfill another dinosaur's need.
- Dinosaurs maintain physical separation from one another, the placed ball, and the pond. The pool is always solid during walking and dragging; touching its edge starts a controlled bath only for a dinosaur with that need.
- Bath and play alternate independently per dinosaur for predictable prototype testing.
- A newly hatched dinosaur already has a fully visible first need when it becomes playable; later needs recur after its own need is completed.
- Performing the wrong action is harmless but gives no heart.
- Progress persists locally: first hatch, current heart round, target, and herd size.
- The reset control clears all progress immediately when clicked.

## Interaction principles

- No reading is required to understand a need.
- Every target is large and forgiving.
- A valid care action gets immediate sound, motion, particles, and heart feedback.
- The dinosaur cannot be harmed, lost, or dragged out of bounds.
- The initial loop stays deliberately small: hatch, bath, play, reward.

## Test coverage

- Unit tests cover hatch sequences, per-dinosaur recurring needs, repeated four-heart score rounds, reset, and legacy storage migration.
- Browser tests cover partially cracked egg dragging, hatch interruption safety, opaque spawned dinos, independent needs, physical separation, immediate reset, bath, and ball collision ownership.

## Next questions for playtesting

- Is the small egg still discoverable without instruction?
- Is the need bubble understood without text?
- Is dragging the dinosaur into the pond intuitive?
- Is dragging a ball out of the tray intuitive?
- Is four hearts too fast or too slow for the second egg to appear?
- Does the child understand that both eggs can be repositioned before hatching?
- Is the ball returning to inventory clear and satisfying?
- Does random roaming make the dinosaur feel alive or make it harder to grab?
