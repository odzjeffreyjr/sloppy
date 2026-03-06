export const GAMEOVER_SCREEN_PROMPT = `### Game Over Screen Rendering
The game-over screen shows the player's results and invites them to play again.

**Required Elements:**
- **"GAME OVER" Header:** Large, prominent centered text. Consider a dramatic entrance tween (scale up from 0, or drop in from above).
- **Final Score Display:** Show the score prominently below the header. Use large font size. If the score includes level or time, show those too.
- **High Score Comparison:** Compare final score to stored high score (localStorage). If new high score, show a "NEW HIGH SCORE!" celebration (flash, particles, color change). Update localStorage with the new high score.
- **"Play Again" Prompt:** Clear call-to-action: "Click to Play Again" or a styled button. Should trigger \`restart()\`.
- **Back to Menu Option:** Text or button to return to the intro screen via \`renderIntroScreen()\`.

**Behavior:**
- \`renderGameOverScreen(score)\` receives the final score object \`{ score, level?, timeElapsed, customData? }\`.
- The game loop should be stopped — no game logic runs during game-over.
- For Phaser games, transition to a dedicated GameOverScene.
- For Three.js games, show an HTML overlay. Optionally keep the final game frame visible behind a semi-transparent backdrop.
- Clicking "Play Again" must fully reset all game state before starting a new game.
`;
