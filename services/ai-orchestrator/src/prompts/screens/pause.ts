export const PAUSE_SCREEN_PROMPT = `### Pause Screen Rendering
The pause screen overlays the gameplay, which should remain visible but frozen underneath.

**Required Elements:**
- **Semi-Transparent Backdrop:** A dark overlay (rgba(0,0,0,0.5–0.7)) covering the entire game area so the frozen game is dimly visible behind it.
- **"PAUSED" Text:** Large centered text. Should be immediately obvious.
- **Resume Prompt:** Text like "Click to Resume" or "Press ESC to Resume" below the PAUSED text.
- **Optional Buttons:** Restart and Quit/Menu buttons if appropriate. These are text-based buttons with pointer interaction.

**Behavior:**
- The game loop must be frozen (no game logic updates) while paused. Rendering can continue to show the static scene behind the overlay.
- Clicking resume or pressing ESC should trigger \`resume()\`.
- Clicking restart should trigger \`restart()\`.
- \`renderPauseScreen()\` is called when transitioning to the paused state. The pause overlay must be removable when resuming.
- For Phaser games, implement as a separate Scene launched on top of GameScene.
- For Three.js games, implement as an HTML overlay div.
`;
