#!/bin/bash
#
# add-restart-command-to-games.sh
#
# Adds the 'restart' command handler to all game templates that are missing it.
# This fixes the issue where games don't respond to the "tap to play" action
# in the TikTok-style feed.
#

set -e

GAMES_DIR="scripts/games"
BACKUP_DIR="scripts/games-backup-$(date +%Y%m%d-%H%M%S)"

echo "🔧 Adding restart command handler to game templates..."
echo ""

# Create backup
echo "📦 Creating backup at: $BACKUP_DIR"
cp -r "$GAMES_DIR" "$BACKUP_DIR"
echo "✅ Backup created"
echo ""

# Find all game index.html files
game_files=$(find "$GAMES_DIR" -name "index.html" -type f)
count=0
updated=0

for file in $game_files; do
  count=$((count + 1))
  game_name=$(basename $(dirname "$file"))
  
  # Check if restart is already handled
  if grep -q "cmd === 'restart'" "$file"; then
    echo "⏭️  $game_name - already has restart handler"
    continue
  fi
  
  # Check if it has the sloppy:command handler
  if ! grep -q "sloppy:command" "$file"; then
    echo "⚠️  $game_name - no command handler found, skipping"
    continue
  fi
  
  # Two patterns we need to handle:
  # Pattern 1: if (cmd === 'pause' && g.pause) g.pause();
  # Pattern 2: if (cmd === 'pause')   window.SloppyGame.pause();
  
  if grep -q "if (cmd === 'pause' && g.pause)" "$file"; then
    # Pattern 1: Using 'g' object
    echo "✏️  $game_name - adding restart handler (pattern 1)"
    
    # Add restart handler after the pause line
    sed -i.bak "/if (cmd === 'pause' && g.pause)/a\\
      if (cmd === 'restart' && g.start) { if (g.reset) g.reset(); g.start(); }
" "$file"
    
    # Remove the .bak file created by sed
    rm -f "$file.bak"
    updated=$((updated + 1))
    
  elif grep -q "if (cmd === 'pause')   window.SloppyGame.pause()" "$file"; then
    # Pattern 2: Using window.SloppyGame
    echo "✏️  $game_name - adding restart handler (pattern 2)"
    
    sed -i.bak "/if (cmd === 'pause')   window.SloppyGame.pause()/a\\
    if (cmd === 'restart') { if (window.SloppyGame.reset) window.SloppyGame.reset(); window.SloppyGame.start(); }
" "$file"
    
    rm -f "$file.bak"
    updated=$((updated + 1))
  else
    echo "⚠️  $game_name - unknown command pattern, manual fix needed"
  fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Done!"
echo "   Total games: $count"
echo "   Updated: $updated"
echo "   Backup: $BACKUP_DIR"
echo ""
echo "Next steps:"
echo "  1. Test a game: open scripts/games/neon-drift/index.html"
echo "  2. Test in feed: ./dev.sh then go to /feed"
echo "  3. Upload games: ./scripts/upload-dev-games.sh"
echo ""
