# Sloppy — Thumbnail Generation & In-Game Sound Effects Plan

---

## Part 1: Thumbnail Generation Pipeline

### The Problem With Screenshots Alone

Your existing Puppeteer validation already captures screenshots of each game state (intro, playing, paused, game over). Those screenshots are useful as proof-of-quality, but they make **mediocre thumbnails** — they're just raw game frames: small text, cluttered HUD, no branding, no punch.

Great game store thumbnails (CrazyGames, Steam) are **composed marketing assets**: bold title text, dramatic key art, genre-appropriate mood. You need a separate AI-generated thumbnail that represents the game's identity, not a literal frame from it.

### Recommended Stack: fal.ai + FLUX

**Primary: fal.ai hosting FLUX.2 [dev]**

fal.ai is the right choice for this pipeline because:

- FLUX.1 [schnell] costs just $0.003 per megapixel with sub-second results in 1–4 inference steps — perfect for bulk thumbnail generation during the game population pipeline
- FLUX.2 [dev] costs $0.012 per megapixel with full commercial licensing, delivering higher quality for games created by paying subscribers
- fal's Inference Engine is up to 10x faster than comparable providers, scaling from prototype to 100M+ daily inference calls with 99.99% uptime
- Both text-to-image and image-to-image in one API — you can pass the Puppeteer screenshot as a reference and generate an enhanced version

**Cost math for scale:**
- 1024×512 thumbnail (0.5MP) via FLUX.1 schnell = **$0.003** per game
- 1024×512 via FLUX.2 [dev] = **$0.006** per game
- 200 games = ~$0.60–$1.20 total. Essentially free.

**Nano Banana:** You mentioned this — it's a third-party proxy that resells Gemini Imagen access. Google's own Imagen 4 Fast API is $0.02 per image, making direct Google access cheaper than proxies. At this price point, just use fal.ai (faster, gaming-style outputs, better prompt adherence for stylized art).

### Thumbnail Generation Pipeline

```
Game GDD (title, genre, visual_style, engine)
  + Puppeteer screenshot (playing state)
         ↓
[Thumbnail Prompt Agent]
  Generates an optimized image prompt from the GDD
         ↓
[fal.ai FLUX.2 API call]
  image_size: "landscape_16_9" (1280×720)
  model: "fal-ai/flux-2" (dev, commercial)
  image_url: puppeteer_screenshot (for reference)
         ↓
[Post-processing: Sharp.js]
  Add game title text overlay (bottom-left, bold)
  Add genre badge (top-right pill)
  Add subtle vignette
         ↓
[Upload to GCS]
  games/{id}/v{version}/thumbnail.webp
  games/{id}/v{version}/thumbnail_sm.webp (300×169 for cards)
         ↓
[Update game record]
  games.thumbnail_url = CDN URL
```

### The Thumbnail Prompt Agent

The prompt engineering for game thumbnails is specialized. A generic "make a game thumbnail" prompt produces generic outputs. The agent must extract visual DNA from the GDD:

```typescript
// services/ai-orchestrator/src/agents/thumbnail-prompter.ts

// Input: GameDesignDocument
// Output: Optimized FLUX prompt string

// Example outputs:

// For "Neon Runner" (3D endless runner):
// "Dark cyberpunk cityscape at night, neon-lit highway stretching into the horizon,
//  lone silhouetted runner figure in foreground, purple and cyan neon reflections
//  on wet asphalt, dramatic low camera angle, cinematic depth of field,
//  game key art style, ultra detailed, moody atmosphere"

// For "Dungeon Crawler" (2D top-down):
// "Dark fantasy dungeon interior, torchlit stone corridors, treasure chests and
//  glowing magic artifacts scattered on floor, pixelart-adjacent illustrated style,
//  dramatic top-down perspective, warm orange torch glow against cold blue shadows,
//  adventure game promotional art"
```

The agent is given a template per genre with visual archetypes proven to generate strong results.

### Image Post-Processing with Sharp.js

After FLUX generates the base image, Sharp.js (Node.js image processing library, zero native deps) composites the final thumbnail:

```typescript
// services/game-builder/src/thumbnails/compositor.ts
import sharp from 'sharp';

const composeThumbnail = async (
  baseImageBuffer: Buffer,
  title: string,
  genre: string
): Promise<Buffer> => {
  
  const titleOverlay = await createTextSVG(title, genre);
  
  return sharp(baseImageBuffer)
    .resize(1280, 720)
    .composite([
      // Subtle gradient overlay at bottom for text legibility
      { input: gradientBuffer, blend: 'multiply' },
      // Title text SVG
      { input: Buffer.from(titleOverlay), top: 580, left: 40 },
      // Genre badge
      { input: await createGenreBadge(genre), top: 20, right: 20 }
    ])
    .webp({ quality: 85 })
    .toBuffer();
};
```

### When Thumbnails Are Generated

| Trigger | Model | Why |
|---|---|---|
| Game population pipeline (batch) | FLUX.1 schnell | Speed + cost — bulk generation |
| User creates a game (subscribed) | FLUX.2 [dev] | Higher quality for creator content |
| User regenerates thumbnail | FLUX.2 [dev] | On-demand, quality matters |
| Validation screenshot fallback | None (use screenshot) | If FLUX fails, fall back gracefully |

### Thumbnail Regeneration (Creator Feature)

Paying creators can regenerate their game's thumbnail with a different prompt. This is exposed in their Dashboard → My Games page:

```
[Game Card]
  [Current Thumbnail]
  [Regenerate Thumbnail]
  ↳ Opens modal with prompt input pre-filled
  ↳ Shows 2 variations to choose from
  ↳ Select one → published to CDN
```

---

## Part 2: In-Game Sound Effects

### The Architecture Decision: Two-Layer Audio System

There are two distinct problems to solve:

1. **Playback** — reliably playing audio in browser games across all devices (iOS is notorious for audio restrictions)
2. **Generation** — creating game-appropriate sound effects without requiring a sound library of MP3 files in every game bundle

The answer to each is different. Here's the full stack:

---

### Layer 1: Playback — Howler.js (Inside Every Game)

Howler.js defaults to Web Audio and falls back to HTML5 Audio to provide full coverage across all browsers and platforms, including Cordova. It's just 7KB gzipped with no outside dependencies.

This goes into the `packages/runtime-sdk` as the universal audio playback layer for all games. The AI generates game code that calls the Howler API — it's extremely well represented in AI training data (which matters for code generation quality).

Key features used in Sloppy games:
- Audio sprites — define and control segments of a single file for more precise playback and lower resource usage. All a game's SFX are packed into one sprite file = one HTTP request = faster load
- Spatial audio plugin for 3D games — all game sounds implemented with a single sound sprite and Howl instance
- Auto-handles the iOS "audio locked until first user interaction" restriction
- Global mute/unmute via `Howler.mute(true)` — directly controlled by the feed's mute button via postMessage

```javascript
// In every generated game (via runtime-sdk audio module):
const sfx = new Howl({
  src: ['sounds.webm', 'sounds.mp3'],  // webm primary, mp3 fallback
  sprite: {
    jump:     [0,    300],
    coin:     [500,  200],
    hurt:     [800,  400],
    shoot:    [1300, 150],
    explosion:[1500, 800],
    levelUp:  [2400, 1200],
    gameOver: [3700, 2000]
  }
});

// Play a sound:
sfx.play('jump');
```

---

### Layer 2: Sound Generation — Two Options (Procedural vs AI-Generated)

#### Option A: ZzFX — Zero-File Procedural SFX (Best for AI Code Gen)

ZzFX is a tiny sound generator designed to produce a wide variety of sound effects with minimal code overhead — less than 1 kilobyte when compressed. It has 20 controllable parameters and requires no sound asset files.

This is **the perfect fit for AI-generated games** because:

- The entire library is ~1KB of JavaScript — inlined directly into the game bundle, zero HTTP requests
- Sounds are defined as parameter arrays, e.g. `zzfx(...[,,925,.04,.3,.6,1,.3,,6.27,-184,.09,.17])` — the AI can write these directly in code
- No external files = no CORS issues = no CDN dependency
- MIT licensed
- The AI knows ZzFX well from training data (it's used in thousands of game jam entries)

Preset library that maps to common game events:

```javascript
// packages/runtime-sdk/src/v2/audio/zzfx-presets.ts

export const SFX = {
  // Movement
  jump:        [,,220,,.1,,.3,2,,,,,.12,.1],
  land:        [.5,,123,.01,,.03,,1.8,,,,,,8,-2],
  walk:        [.1,,150,.01,.01,.01,4,.5,,,,,,20],
  dash:        [,,880,,.06,.04,,1.3,,7,,,,6],
  
  // Combat
  shoot:       [,,90,.01,.03,.02,4,2,,,,,,,4],
  hit:         [1,.1,480,.03,.1,.02,1,.5,,,,,,.5],
  explosion:   [2,.1,130,.01,.6,.5,4,.1,,30,,,,.5,-5],
  
  // Collectibles
  coin:        [,,537,.02,.02,.22,1,1.59,-6.98,4.97],
  powerUp:     [,,660,,.1,.3,1,1.8,,7,,,.09],
  
  // UI
  select:      [,,440,,.03,.03,1,2,,,100,.03],
  confirm:     [,,660,,.05,.1,1,1.5],
  back:        [,,220,,.05,.1,1,.5],
  
  // Game states
  levelUp:     [1.5,.8,270,,.1,,1,1.5,,,,,,.1,.01],
  gameOver:    [,,925,.04,.3,.6,1,.3,,6.27,-184,.09,.17],
  
  // 3D specific
  engineRev:   [.5,,50,.1,.3,.5,4,.2,-2,,,,,.8],
  impact:      [2,,100,.01,.1,.2,4,1.5,,,-200,.1,,2],
};
```

The AI receives this preset map in its system prompt and calls `SFX.jump`, `SFX.coin` etc. — no sound design knowledge required.

For games needing more custom sounds, ZzFX has a sound designer web app where you can craft sounds and export them as a single line of code — you can use this to hand-tune presets and add them to the library.

#### Option B: ElevenLabs SFX API — AI-Generated Audio Files (Best for Quality)

For the highest quality audio on player-created games, generate real audio files using ElevenLabs:

The ElevenLabs sound effects API turns text descriptions into high-quality audio effects with precise control over timing, style and complexity, generating cinematic sound design for films and trailers, custom sound effects for games and interactive media.

ElevenLabs Sound Effect V2 (launched September 2025) supports 20+ second clips, seamless looping, and 48 kHz audio, making text to sound effect generation more accurate and production-ready.

These generated audio files are stored alongside the game bundle in GCS:

```
games/{id}/v{version}/
  index.html
  game.js
  config.json
  thumbnail.webp
  audio/              ← NEW
    sounds.webm       ← Howler sprite (all SFX packed)
    sounds.mp3        ← Fallback
    ambient.webm      ← Background music/ambience loop
```

The ElevenLabs call happens in the AI orchestrator pipeline during the generation phase:

```typescript
// services/ai-orchestrator/src/agents/audio-generator.ts

const generateGameAudio = async (gdd: GameDesignDocument) => {
  const sfxList = determineSFXNeeds(gdd);
  // e.g. for a dungeon crawler:
  // ["medieval sword clash", "dungeon door creaking open",
  //  "magic spell whoosh", "coin pickup jingle", "monster growl",
  //  "player footsteps on stone", "game over horn"]

  const generated = await Promise.all(
    sfxList.map(description =>
      elevenLabsClient.textToSoundEffects.convert({
        text: description,
        duration_seconds: getSFXDuration(description),
        prompt_influence: 0.5,
        output_format: 'mp3_44100_128'
      })
    )
  );

  // Pack into a single audio sprite using audiosprite CLI
  return packIntoSprite(generated, sfxList);
};
```

The ambient/background music is also generated via ElevenLabs' music generation API (launched 2025):

```typescript
const generateAmbientMusic = async (gdd: GameDesignDocument) => {
  const musicPrompt = `${gdd.visual_style} background music, loopable, 
    ${gdd.genre} game atmosphere, no melody that's distracting, 
    ambient and atmospheric`;
  
  return elevenLabsClient.music.compositionPlan.create({
    prompt: musicPrompt,
    music_length_ms: 30000  // 30s loop
  });
};
```

---

### The Decision Tree: Which Audio Approach Per Game?

```
Game generated by:
  
  Population Pipeline (automated)
        ↓
   Use ZzFX presets
   (zero cost, zero latency,
    fully inline, no HTTP calls)
   
  Creator Subscriber
        ↓
   Use ElevenLabs SFX API
   (real generated audio,
    stored in GCS,
    higher quality)
   
  Either (with 3D game)
        ↓
   Always use Howler.js for playback
   + Three.js AudioListener for
     3D spatial sound positioning
```

---

### How the AI Generates Sound Code

The code generation agent receives the audio layer as part of its context. The system prompt for the Code Generator includes:

```
AUDIO RULES:
- ALWAYS initialize ZzFX OR load Howler sprite at game init
- NEVER use new Audio() or raw AudioContext directly
- Every player action MUST have a sound response
- Required sounds for ALL games: jump/move, collect/score, hurt/die, 
  game-over, level-up/win
- For 3D games: use THREE.AudioListener + THREE.PositionalAudio for
  sounds attached to game objects (explosions, footsteps)
- All audio must be paused when game.pause() is called
- All audio must resume when game.resume() is called
- Background music must loop seamlessly

ZzFX USAGE:
import the ZzFX micro snippet (900 bytes) at top of game.
Use the SFX preset map provided. Call as: zzfx(...SFX.jump)
```

---

### SDK v2 Audio Contract Addition

Add audio management to the runtime SDK v2:

```typescript
// packages/runtime-sdk/src/v2/audio-manager.ts

interface AudioManager {
  // Playback control
  play(sfxKey: string): void;
  playAmbient(src: string, loop: boolean): void;
  stopAmbient(): void;
  
  // Volume
  setMasterVolume(v: number): void;  // 0–1
  setMusicVolume(v: number): void;
  setSFXVolume(v: number): void;
  
  // State sync (called by SDK when game state changes)
  onPause(): void;    // Pause all audio
  onResume(): void;   // Resume all audio
  onDestroy(): void;  // Dispose all Howl instances
  
  // Feed integration
  mute(): void;       // Called when feed mutes globally
  unmute(): void;
}
```

The `mute()`/`unmute()` methods are wired to the postMessage bridge so the feed's global mute toggle instantly controls all game audio.

---

## Summary: What Gets Added to the Pipeline

### New pipeline steps (added to AI Orchestrator):

```
[Existing: Code Generation]
         ↓
[NEW: Audio Generation Agent]
  → Determines SFX needs from GDD
  → For automated games: writes ZzFX preset calls into game code
  → For creator games: calls ElevenLabs SFX API, stores audio files
  → Writes Howler sprite config into game code
         ↓
[NEW: Thumbnail Prompt Agent]  ← runs in parallel with audio
  → Generates FLUX-optimized prompt from GDD
         ↓
[Existing: Validation]
         ↓
[NEW: Thumbnail Generation]  ← after validation passes
  → Calls fal.ai FLUX.2 API with prompt + screenshot reference
  → Sharp.js composites title + badge
  → Uploads thumbnail.webp to GCS
         ↓
[Existing: Final Build → Deploy]
```

### New service additions:

```
services/ai-orchestrator/src/agents/
  audio-generator.ts       ← ElevenLabs SFX + ZzFX preset writer
  thumbnail-prompter.ts    ← FLUX prompt generation

services/game-builder/src/
  thumbnails/
    compositor.ts          ← Sharp.js image compositing
    fal-client.ts          ← fal.ai API wrapper

packages/runtime-sdk/src/v2/
  audio/
    audio-manager.ts       ← Howler.js wrapper
    zzfx-presets.ts        ← All preset SFX arrays
    zzfx-micro.ts          ← ZzFX engine (900 bytes inlined)
```

### New GCS bundle structure:

```
games/{id}/v{version}/
  index.html
  game.js
  config.json
  thumbnail.webp        ← NEW: AI-generated game store thumbnail
  thumbnail_sm.webp     ← NEW: 300×169 card thumbnail
  audio/                ← NEW (creator games only)
    sounds.webm
    sounds.mp3
    ambient.webm
  screenshots/
    intro.png
    playing.png
    paused.png
    gameover.png
```

---

## Quick Reference: Costs

| Asset | Provider | Cost Per Game |
|---|---|---|
| Thumbnail (bulk/automated) | fal.ai FLUX.1 schnell | ~$0.003 |
| Thumbnail (creator quality) | fal.ai FLUX.2 dev | ~$0.006 |
| SFX (automated games) | ZzFX (procedural) | $0.00 |
| SFX (creator games, ~7 sounds) | ElevenLabs SFX v2 | ~$0.07 |
| Ambient music loop | ElevenLabs Music API | ~$0.05 |
| **Total per automated game** | | **~$0.003** |
| **Total per creator game** | | **~$0.126** |