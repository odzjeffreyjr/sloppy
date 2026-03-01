# Electron Testing Guide

## Prerequisites

- Node.js 20+
- pnpm 9+
- For Windows builds on Mac/Linux: Wine (via `brew install --cask wine-stable`)
- For Linux builds on Mac: Docker (for cross-compilation)

## Development

```bash
# From repo root
cd apps/electron
pnpm dev
```

This starts both the Vite dev server (`localhost:5173`) and the Electron app. Hot-reload is supported — the Electron window will reflect changes made to the web app.

## Building

### macOS (DMG)

```bash
pnpm build:mac
```

Output: `apps/electron/release/Sloppy-{version}-universal.dmg`

**Testing:**
1. Open the `.dmg` and drag Sloppy to Applications
2. Launch from Applications folder
3. Verify the app loads the web UI correctly
4. Check that external links open in the default browser
5. Test window resizing (minimum 800x600)
6. Verify `Cmd+Q` quits the app

### Windows (NSIS Installer)

```bash
pnpm build:win
```

Output: `apps/electron/release/Sloppy Setup {version}.exe`

**Testing:**
1. Run the installer
2. Launch Sloppy from Start Menu or Desktop shortcut
3. Verify the app loads correctly
4. Test window resizing
5. Verify uninstall works cleanly via Add/Remove Programs

### Linux (AppImage)

```bash
pnpm build:linux
```

Output: `apps/electron/release/Sloppy-{version}.AppImage`

**Testing:**
1. Make the AppImage executable: `chmod +x Sloppy-*.AppImage`
2. Run it: `./Sloppy-*.AppImage`
3. Verify the app loads correctly
4. Test window resizing

## Checklist

- [ ] App launches and displays the web UI
- [ ] Window is resizable with correct minimum size (800x600)
- [ ] External links open in system browser
- [ ] App icon displays correctly in dock/taskbar
- [ ] Window title shows "Sloppy"
- [ ] Background color matches cream (#fdf6ec)
- [ ] Mac: `Cmd+Q` exits, closing window hides to dock
- [ ] Windows: Close button exits the app
- [ ] Linux: Close button exits the app

## Known Limitations

- Auto-updater is a placeholder — update server URL (`https://updates.sloppy.app`) is not live
- App icons are placeholders and should be replaced with proper assets
- Cross-platform builds may require additional tooling (Wine for Windows, Docker for Linux)
