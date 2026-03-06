export const HUD_SCREEN_PROMPT = `### HUD (Heads-Up Display) Rendering
The HUD is the persistent in-game UI showing player status and score during gameplay.

**Required Elements:**
- **Score Counter:** Always visible, typically top-left or top-center. Update every frame or on score change. Format large numbers with commas or abbreviations.
- **Health/Lives:** If the game uses health, show a health bar (colored rectangle that shrinks). If it uses lives, show remaining lives as icons or a number. Position top-left area.
- **Timer:** If the game is time-based, show elapsed time or countdown. Format as MM:SS. Position near the score.
- **Level Indicator:** If the game has levels or waves, display the current level/wave. Position top-right or near the score.

**Rendering Approach:**
- For Phaser 3 games: Use \`this.add.text()\` with \`setScrollFactor(0)\` to pin HUD elements to the camera. Group HUD elements in a container or manage them as scene-level references. Update text in the \`update()\` loop.
- For Three.js games: Use an HTML overlay div (positioned absolute, pointer-events: none, z-index above the canvas). Update \`textContent\` or \`innerHTML\` each frame. Style with CSS for readability (text-shadow for contrast against the 3D scene).

**Design Guidelines:**
- Keep the HUD minimal — don't obscure gameplay.
- Use consistent positioning: score top-left, lives/health below it, timer top-right.
- Use readable colors with adequate contrast (white text with dark shadow, or a semi-transparent background strip behind HUD text).
- Animate score changes: brief scale pop or color flash when score increases.
- \`renderHUD()\` is called to update the HUD display. It should read current game state and update all HUD elements accordingly.
`;
