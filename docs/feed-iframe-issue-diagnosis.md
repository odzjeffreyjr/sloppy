# Feed Iframe Loading Issue - Diagnosis Summary

## Date
March 7, 2026

## Issue
Games in the TikTok-style feed at `/feed` load but don't respond to the "Tap to play" action.

## Root Cause Identified

**The Feed page sends a `restart` command that games don't handle.**

### What Happens

1. User navigates to `/feed` ✅
2. Feed loads games from API ✅
3. Iframes render with correct src URLs ✅
4. Games send `sloppy:game:ready` message ✅
5. Feed auto-sends `start` command when game becomes active ✅
6. User taps screen to play
7. Feed sets `isPlaying = true`
8. Feed sends `restart` command to iframe ❌ **Games don't handle this!**

### Code Evidence

**Feed.tsx (lines 560-573)** - When entering play mode:
```typescript
useEffect(() => {
  if (!isPlaying || !iframeRef.current) return;

  const sendRestart = () => {
    iframeRef.current!.focus();
    iframeRef.current!.contentWindow?.postMessage(
      { type: 'sloppy:command', command: 'restart' },  // ← This is sent
      '*',
    );
  };

  if (ready) {
    sendRestart();
  }
}, [isPlaying, ready]);
```

**Game templates** (all games in `scripts/games/*/index.html`):
```javascript
case 'sloppy:command':
  var cmd = e.data.command;
  if (cmd === 'start' && g.start) g.start();   // ✅ Handled
  if (cmd === 'pause' && g.pause) g.pause();   // ✅ Handled
  // Missing: cmd === 'restart'                 // ❌ NOT handled
```

## Commands Used by Feed

| Command | When Sent | Purpose | Games Handle? |
|---------|-----------|---------|---------------|
| `start` | When game becomes active slide | Auto-play in feed | ✅ Yes |
| `pause` | When game becomes inactive slide | Stop when scrolled away | ✅ Yes |
| `restart` | When user taps "play" | Skip intro, start fresh | ❌ **NO** |

## Solutions

### Option 1: Add `restart` Handler to Games (Recommended)

Modify all game templates to handle the `restart` command:

```javascript
window.addEventListener('message', function(e) {
  if (!e.data || e.data.type !== 'sloppy:command') return;
  
  var cmd = e.data.command;
  if (cmd === 'start' && g.start) g.start();
  if (cmd === 'pause' && g.pause) g.pause();
  if (cmd === 'restart' && g.start) {
    // Restart = reset the game and start playing
    if (g.reset) g.reset();  // If there's a reset method
    g.start();
  }
});
```

### Option 2: Change Feed to Send `start` Instead of `restart`

Modify Feed.tsx line 567:

```typescript
// BEFORE
{ type: 'sloppy:command', command: 'restart' }

// AFTER
{ type: 'sloppy:command', command: 'start' }
```

**Pros**: Quick fix, works immediately
**Cons**: Doesn't actually "restart" the game, just continues where it left off

### Option 3: Make Games Handle Both

Update games to handle both commands:

```javascript
if (cmd === 'start' && g.start) g.start();
if (cmd === 'restart' && g.start) {
  // For now, treat restart same as start
  g.start();
}
```

## Recommended Fix

**Go with Option 1** - Add proper `restart` handling to all games:

1. Create a batch script to update all game templates
2. Add `restart` command handler that:
   - Resets game state (score, level, etc.)
   - Transitions directly to playing scene (skips intro)
   - Starts gameplay immediately

## Files to Update

All game templates need the `restart` handler:

```
scripts/games/chrono-hop/index.html
scripts/games/cosmic-tycoon/index.html
scripts/games/crystal-keep/index.html
scripts/games/duel-deck/index.html
scripts/games/dungeon-dash/index.html
scripts/games/ember-guard/index.html
scripts/games/gravity-flip/index.html
scripts/games/gravity-maze/index.html
scripts/games/labyrinth/index.html
scripts/games/meteor-dodge/index.html
scripts/games/neon-drift/index.html
scripts/games/neon-surge/index.html
scripts/games/plasma-blitz/index.html
scripts/games/prism-match/index.html
scripts/games/serpent-neon/index.html
scripts/games/shadow-sprint/index.html
scripts/games/sky-islands/index.html
scripts/games/star-viper/index.html
scripts/games/synth-wave/index.html
scripts/games/tesseract/index.html
scripts/games/turbo-circuit/index.html
```

## Debug Tools Created

1. **`/docs/feed-iframe-debugging.md`** - Comprehensive manual debugging guide
2. **`/scripts/debug-feed-iframe.js`** - Browser console debug script

To use the debug script:
```javascript
// In browser console at http://localhost:5173/feed
// Copy-paste contents of scripts/debug-feed-iframe.js

// Then run:
debugFeedClickTest();      // Simulate tap to play
debugFeedSendCommand();    // Send commands to iframe
debugFeedCheckState();     // Check current state
```

## Testing Steps

After implementing the fix:

1. Navigate to `http://localhost:5173/feed`
2. Wait for game to load (should see iframe)
3. Click/tap center of screen
4. Game should immediately start playing (skip intro)
5. Scroll up/down to next game
6. Previous game should pause
7. New game should auto-start

## Related Documents

- `docs/feed-game-start-fix.md` - Previous CORS fix (already applied)
- `docs/feed-iframe-debugging.md` - Manual debugging guide
- `docs/game-creation-guide.md` - Game SDK documentation

## Next Steps

1. ✅ Identified root cause: `restart` command not handled
2. ⏳ Choose fix approach (Option 1 recommended)
3. ⏳ Update all game templates
4. ⏳ Test in browser
5. ⏳ Deploy updated games to GCS
