export const PUZZLE_2D_PROMPT = `## Genre: 2D Puzzle (Phaser 3)

### Core Mechanics
- **Grid System:** Define a logical grid (e.g., 8×8). Each cell maps to screen coordinates via \`cellX * cellSize + offsetX\`. Store game state in a 2D array. Render grid lines with \`this.add.graphics()\`. Highlight hovered/selected cells.
- **Match Mechanics (match-3 style):** Detect horizontal and vertical runs of 3+ same-type cells. On match: mark cells, play clear animation (tween scale to 0 or fade out), remove from grid, apply gravity (shift cells down), refill top row. Chain detection: re-scan after gravity settles.
- **Drag-and-Drop:** Use \`this.input.setDraggable(sprite)\`. Listen for \`drag\`, \`dragstart\`, \`dragend\`. Snap to nearest grid cell on drop. Validate the move; revert if invalid with a tween back to original position.
- **Clear/Win Conditions:** Level complete when target score reached, specific pattern formed, all special tiles cleared, or board is empty. Track and display progress toward the goal.
- **Undo System (optional):** Push board state snapshots to an array before each move. Pop to restore on undo.

### Object Archetypes
- **Tiles/Pieces:** Graphics-generated textures in 4–6 distinct colors/shapes. Each type has a unique visual identity. Interact via pointer events.
- **Grid Board:** Background graphics layer with gridlines. Optional cell highlight on hover.
- **Special Tiles:** Power-ups that clear rows, columns, or areas. Visually distinct (glow effect via emissive tween or particle burst).
- **Obstacles:** Locked cells, blockers, or walls within the grid that constrain movement.
- **UI Elements:** Move counter, score display, level goal indicator.

### Scoring Patterns
- Base points per match/clear (varies by match size: 3=100, 4=200, 5=500).
- Chain/combo multiplier: successive matches without player input multiply score.
- Bonus for completing a level under the move limit.
- Star rating: 1–3 stars based on score thresholds.

### Difficulty Progression
- Increase board complexity: more tile types, larger grid, fewer moves allowed.
- Introduce obstacle cells that cannot be moved or matched.
- Require specific tile arrangements to clear the level.
- Time pressure: add optional countdown timer in later levels.
`;
