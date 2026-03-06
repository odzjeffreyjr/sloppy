export const RHYTHM_2D_PROMPT = `## Genre: 2D Rhythm Game (Phaser 3)

### Core Mechanics
- **Note Spawning:** Notes (hit targets) spawn at the top or side of the screen and scroll toward a "hit zone" at a fixed speed. Spawn timing is pre-defined in a beat map array: \`[{ time: ms, lane: 0–3, type: 'tap'|'hold' }]\`. Use \`this.time.addEvent()\` or check elapsed time each frame to spawn notes.
- **Hit Zone & Timing Windows:** A fixed line/zone where the player must press the correct key as notes cross it. Timing accuracy:
  - **Perfect:** within ±50ms → full points, bright flash effect.
  - **Good:** within ±100ms → 75% points, moderate flash.
  - **Miss:** beyond ±100ms or no input → 0 points, combo reset, dim flash.
  Calculate timing: \`Math.abs(note.y - hitZoneY) / noteSpeed * 1000\` for ms offset.
- **Lane System:** 2–4 lanes, each mapped to a key (e.g., D, F, J, K or arrow keys). Each lane has its own hit zone column. Visual lane dividers on screen. Notes only need to match the correct lane key.
- **Combo System:** Consecutive successful hits (Perfect or Good) build a combo counter. Combo multiplier: \`Math.floor(combo / 10) + 1\`, capped at 4–8x. Combo resets on miss. Display combo prominently with scale tween on increment.
- **BPM & Beat Map Generation:** Since there's no audio file, generate a procedural beat pattern. Choose a BPM (100–140). Calculate beat interval: \`60000 / bpm\` ms. Place notes on beats and half-beats. Vary lane assignment for interest. Increase density over time.

### Object Archetypes
- **Notes:** Graphics-generated textures (circles, arrows, or squares) in lane-specific colors. Physics group moving downward at constant speed. Remove when they pass below the hit zone + a grace window. \`note.getData('lane')\` to store lane assignment.
- **Hit Zone:** Horizontal line or row of target outlines at the bottom of the screen. Semi-transparent target shapes in each lane. Brief glow effect (tween alpha/scale) when a key is pressed.
- **Lane Dividers:** Vertical lines or subtle color strips separating lanes. Subtle enough not to distract.
- **Feedback Text:** "PERFECT!", "GOOD!", "MISS!" text that appears briefly at the hit zone. Color-coded (gold, green, red). Tween: scale up + fade out over 300ms.
- **Combo Display:** Large number showing current combo. Positioned center or top. Scale pop tween on each increment. Resets to 0 with a brief shake effect on miss.

### Scoring Patterns
- Points per hit: Perfect=300, Good=100, Miss=0.
- Points multiplied by current combo multiplier.
- Track accuracy: (Perfect + Good) / total notes as a percentage.
- End-of-song rating: S (>95%), A (>85%), B (>70%), C (>50%), F (<50%).
- High score per song/level stored in \`localStorage\`.

### Difficulty Progression
- Increase BPM in later levels (100 → 120 → 140).
- More notes per beat (quarter notes → eighth notes → sixteenth notes).
- Use all lanes more evenly (early levels favor center lanes).
- Introduce hold notes: player must press and hold the key while the note traverses a length.
- Introduce simultaneous notes (two lanes at once).
- Narrower timing windows in harder difficulties.
`;
