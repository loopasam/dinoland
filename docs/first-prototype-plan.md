# Dinoland: First Prototype Plan

## Purpose

Build a tiny, playful vertical slice that answers one question:

> Is it fun for a young child to hatch a baby dinosaur and interact with it?

This prototype is a digital toy, not yet a complete game. A full play session should be understandable without reading and enjoyable for roughly three to five minutes.

## Target player

- Primary player: a five-year-old child
- Primary input: mouse
- Secondary input: touch
- Reading required: none during play
- Failure states, scores, timers, advertisements and purchases: none

## Core experience

The prototype has one cozy nursery scene containing:

- One large dinosaur egg
- One baby triceratops
- One colorful ball
- One small bath or pond
- A few decorative environmental objects

The player first hatches the egg, then freely discovers how the baby dinosaur reacts to clicks, plays with the ball and gives it a bubble bath.

## Player loop

1. Click the egg and observe an immediate reaction.
2. Continue clicking until the baby triceratops hatches.
3. Click different parts of the dinosaur to discover funny reactions.
4. Drag or click the ball to play with the dinosaur.
5. Click the bath to begin a short bubble-bath interaction.
6. Pop bubbles and make the dinosaur splash.
7. Return to the nursery and repeat any interaction freely.

There is no formal ending. The child can continue playing or reset the scene.

## Scene flow

### Phase 1: Egg

The egg sits prominently in the center of the nursery. It should subtly animate to invite interaction.

Each click advances a short fixed sequence:

1. The egg wiggles.
2. A visible crack appears.
3. Something inside knocks back and the egg jumps.
4. The shell opens and the baby triceratops pops out.

Every click must provide immediate visual and audio feedback. Clicking quickly must not skip or break the sequence.

### Phase 2: Free play

After hatching, the dinosaur remains in the nursery and performs occasional idle animations. The player can choose any available interaction in any order.

Suggested dinosaur reactions:

- Head: leans into a pet and looks happy
- Belly: giggles and wiggles
- Feet: performs a small stomp
- Tail: turns around and tries to catch it
- Horns: shakes its head proudly
- Several quick clicks: becomes playfully dizzy
- No interaction for a short period: sits, sneezes or looks around

The first prototype should implement five reliable reactions before adding more.

### Phase 3: Ball play

The room contains one large, visually obvious ball.

Minimum interaction:

- The player drags the ball and releases it.
- Releasing it near the dinosaur triggers a response.
- The dinosaur nudges or head-butts it away.
- The ball moves to a new reachable position and can be used again.

Nice-to-have only after the minimum version works:

- Clicking the ball makes it bounce.
- The dinosaur follows a slowly dragged ball with its eyes or head.
- Different drop positions trigger slightly different reactions.

The ball should use forgiving hit areas and simple authored motion rather than realistic physics.

### Phase 4: Bubble bath

Clicking the bath moves the dinosaur into a focused bath state. This may zoom or reframe the same room rather than load a separate scene.

Minimum interaction:

- The dinosaur jumps into the bath.
- Several large bubbles appear.
- Clicking a bubble pops it with sound and particles.
- Clicking the dinosaur makes it splash.
- A large, obvious back control returns to the nursery.

The bath has no cleanliness meter and never needs to be completed. After enough bubbles are popped, the dinosaur may perform a happy shake as an optional reward.

## Interaction principles

- All important targets are large and forgiving.
- Every valid click causes an immediate response.
- Unexpected clicks should produce harmless feedback where practical.
- Input is temporarily locked only during very short non-interruptible animations.
- Repeated interactions remain entertaining through small animation or sound variations.
- The dinosaur is always safe, happy and impossible to harm.
- The player can move freely between normal play and the bath.

## Visual and audio direction

### Visual style

- Warm, colorful storybook illustration
- Soft shapes and rounded silhouettes
- Clear separation between interactive objects and background decoration
- Baby triceratops with an oversized head, short legs and expressive eyes
- Consistent three-quarter or side-facing perspective across all assets
- No interface text embedded in generated images

### Asset layers

Generate or draw separate assets rather than one flattened screen:

- Nursery background
- Egg: intact, cracked and opened states
- Shell fragments
- Baby triceratops base pose
- Dinosaur reaction poses or animation parts
- Ball
- Bath/pond
- Bubbles and splash particles
- Reset and back icons
- Optional environmental props

### Audio

- Soft egg knocks and cracks
- Cute dinosaur chirps, giggles and sneezes
- Ball bounce or nudge sound
- Bubble pops with two or three variations
- Gentle splash sounds
- Short, calm hatching flourish

No loud roars, startling cracks or continuous background audio are required for the first version.

## Minimal environmental surprises

Environmental interactions are secondary. Include no more than three if time allows:

- A flower briefly sings when clicked.
- A cloud changes shape.
- A small hidden creature peeks out from behind furniture.

These must not be required for progress.

## Save and reset behavior

Persist only whether the egg has hatched.

- Before hatching: reopening shows the intact egg.
- After hatching: reopening shows the baby dinosaur ready for free play.
- A parent-facing reset control returns the experience to the intact egg.

No accounts or remote storage are needed. Use browser local storage.

## Technical approach

### Stack

- Phaser
- TypeScript
- Vite
- Vitest for state and interaction-logic tests
- Playwright for the critical browser interaction path

### Suggested structure

- `BootScene`: load assets and initialize saved state
- `NurseryScene`: egg, dinosaur, ball and general interactions
- Bath mode implemented as a state within `NurseryScene` unless separation proves simpler
- Small explicit state machine:
  - `egg-intact`
  - `egg-cracking`
  - `hatching`
  - `free-play`
  - `bath`
- JSON data may describe reaction names, sounds and animation timing, but avoid building a generalized content system prematurely.

### Interaction safety

- Debounce egg clicks during animation transitions.
- Ensure drag cancellation returns the ball to a valid position.
- Prevent overlapping dinosaur reactions from corrupting state.
- Keep the reset control away from the child's primary play area.
- Respect reduced-motion browser settings where practical.

## Delivery milestones

### Milestone 1: Grey-box interaction

- Phaser/Vite project runs locally.
- Placeholder egg advances through four clicks.
- Placeholder dinosaur appears.
- Basic body click produces one reaction.
- Bath and ball targets are present.

Success criterion: the complete interaction flow works using simple shapes.

### Milestone 2: Core toy

- Five dinosaur reactions work reliably.
- Ball can be dragged and triggers a dinosaur response.
- Bath mode supports bubble popping and splashing.
- Hatching and idle states are stable.
- Mouse and touch interactions both work.

Success criterion: a child can discover every core interaction without written instructions.

### Milestone 3: Presentation and persistence

- Final or representative visual assets replace placeholders.
- Sound effects and small particles are added.
- Hatching state persists locally.
- Parent-facing reset works.
- Layout works on common laptop and tablet sizes.

Success criterion: the prototype is pleasant enough for a short child playtest.

### Milestone 4: Test and observe

- Automated tests cover hatching progression, save/reset and state transitions.
- Playwright covers hatch, ball and bath paths.
- Conduct one supervised playtest without explaining the controls.
- Record observations rather than asking abstract preference questions.

## Playtest questions

Observe:

- Does the child click the egg without being told?
- Does the four-click hatch feel exciting or repetitive?
- Which dinosaur reactions are repeated voluntarily?
- Is dragging the ball understandable?
- Is the bath discovered without prompting?
- Does the child return from the bath and continue playing?
- Does the child talk to, name or show affection toward the dinosaur?
- Where does attention drop or confusion appear?

The strongest signal is repeated voluntary interaction, not verbal approval.

## Explicit non-goals

Do not include in this prototype:

- Multiple dinosaurs or eggs
- Creature selection
- Egg-care activities before hatching
- Guessing the dinosaur
- Food, sleep or health systems
- Decorating or persistent personality traits
- Multiple rooms
- Cards or collection systems
- Currency, scoring or achievements
- Spoken instructions
- Accounts, cloud saves or social features
- Procedural animation or a generalized game-content framework

## Definition of done

The first prototype is done when a child can, without reading:

1. Hatch the egg.
2. Discover several baby-dinosaur reactions.
3. Play once with the ball.
4. Enter the bath and pop bubbles.
5. Return to free play.
6. Close and reopen the game without losing the hatched state.

Anything beyond this list should be evaluated only after the first playtest.
