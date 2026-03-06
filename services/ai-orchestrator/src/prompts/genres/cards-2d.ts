export const CARDS_2D_PROMPT = `## Genre: 2D Card Game (Phaser 3)

### Core Mechanics
- **Card Representation:** Each card is a graphics-generated texture (rounded rectangle with text/symbols). Store card data as objects: \`{ id, suit, value, type, cost, effect }\`. Render cards at a fixed size (e.g., 80×120). Show face/back states by toggling the texture. Cards in hand are arranged in a fan or row at the bottom of the screen.
- **Hand Management:** Player draws cards from a deck (array, shuffled with Fisher-Yates). Hand is displayed at the bottom. Cards can be selected (tween scale up + glow), played (tween move to play area), and discarded. Enforce hand size limits (e.g., max 7 cards). Draw phase: add cards from deck to hand at turn start.
- **Turn-Based Flow:** Game state cycles through phases: Draw → Play → Resolve → Opponent → repeat. Display current phase in the HUD. Player plays cards during their turn by clicking them. "End Turn" button advances the phase. Opponent AI plays cards automatically during its turn.
- **Card Effects:** When a card is played, resolve its effect:
  - **Attack:** Deal damage to opponent (shake target, flash red, reduce HP bar).
  - **Defense:** Add shield/block value (tween shield icon overlay).
  - **Heal:** Restore HP (tween green flash, HP bar increase).
  - **Buff/Debuff:** Modify stats for N turns (display status icon).
- **Opponent AI:** Simple AI: prioritize attack cards when opponent HP is low, defense when own HP is low, otherwise play highest-value card. Random selection within priority tier for variety.
- **Mana/Energy System:** Each card has a cost. Player gets N energy per turn (increases over game). Cards can only be played if sufficient energy remains. Display energy as filled pips or a counter.

### Object Archetypes
- **Cards:** Interactive sprites with rich graphics. Face shows type icon, cost (top-left corner), name, and effect value. Back is a uniform pattern. Hover: tween up + scale. Selected: tween up further + glow outline. Played: tween to center play area.
- **Deck:** Stack visual in the corner (several overlapping card backs). Counter showing remaining cards. Click to draw (if applicable outside draw phase).
- **Discard Pile:** Stack visual opposite the deck. Counter for discarded cards.
- **Play Area:** Center of screen where played cards are shown temporarily before resolving.
- **HP Bars:** Horizontal bars for player and opponent at top. Color gradient (green → yellow → red). Tween width on damage/heal. Numeric HP text overlay.
- **Energy Display:** Row of filled/empty circles or a numeric counter below the player's HP. Refills each turn with animation.

### Scoring Patterns
- Opponent defeated = level/round cleared.
- Score based on: HP remaining, turns taken (fewer = bonus), cards remaining in deck.
- Win streak multiplier for consecutive victories.
- Final score is cumulative across rounds/opponents.

### Difficulty Progression
- Opponents gain more HP and stronger cards in later rounds.
- Opponent AI improves: better prioritization, combo awareness.
- Player unlocks stronger cards in their deck over rounds (deck building between battles).
- Introduce new card types: multi-target, conditional effects, synergy combos.
- Reduce starting energy or increase card costs in later rounds.
`;
