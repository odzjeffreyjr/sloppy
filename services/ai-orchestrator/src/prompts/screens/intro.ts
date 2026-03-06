export const INTRO_SCREEN_PROMPT = `### Intro Screen Rendering
The intro screen is the first thing the player sees. It should feel polished and inviting.

**Required Elements:**
- **Title:** Large centered text displaying the game name. Use a bold, readable font (24–48px). Add a subtle tween (pulse scale or glow) to draw attention.
- **"Press Start" Prompt:** Smaller text below the title that pulses or blinks to indicate interactivity. Text like "Click to Start" or "Press SPACE to Start" depending on primary input.
- **Controls Hint:** Brief list of controls (e.g., "Arrow Keys to Move, Space to Jump") displayed below the start prompt in a smaller, muted color.
- **High Score Display:** If a previous high score exists (from localStorage), show "High Score: X" in a corner or below the controls.
- **Animated Background:** The intro should not be a static screen. Options: slowly moving shapes, parallax layers, particle effects, a zoomed-out preview of the game world, or a simple color gradient animation.

**Behavior:**
- Clicking anywhere or pressing SPACE/ENTER should trigger \`start()\`.
- The intro screen must be rendered inside the game canvas/renderer — not as external HTML (for 2D/Phaser games). For Three.js games, an HTML overlay is acceptable.
- \`renderIntroScreen()\` sets the game state to 'intro'.
`;
