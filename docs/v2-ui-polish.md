# V2 UI Polish: Emoji Replacement & UI Consistency

> **Purpose**: Next-prompt reference for replacing all emojis with a proper icon library and fixing UI inconsistencies across the app.

---

## Part 1: Icon Library Recommendation

### Chosen Library: **Lucide React** (`lucide-react`)

**Why Lucide:**
- 1,500+ icons with consistent stroke-based design
- Tree-shakable — only used icons are bundled
- Full TypeScript support with autocomplete
- Default icon set for shadcn/ui — aligns with modern React ecosystem
- 200k+ weekly downloads, 21k+ GitHub stars, actively maintained
- Customizable `size`, `color`, `strokeWidth` props
- Already uses inline SVGs — matches the existing pattern in `BottomNav.tsx`, `Sidebar.tsx`, `NavBar.tsx`

**Install**: `pnpm --filter @sloppy/web add lucide-react`

**Alternative considered:** Phosphor Icons (single-designer consistency, 6 weight variants) — but Lucide has a larger icon set and better ecosystem support.

---

## Part 2: Emoji Replacement Map

Every emoji in the app must be replaced with a Lucide icon component. Below is the full mapping.

### 2.1 Shared Patterns (used across many files)

| Emoji | Context | Lucide Icon | Notes |
|-------|---------|-------------|-------|
| 💥 | Error states | `<AlertTriangle />` | Used in Feed, MyGames, Explore, Favourites, GamePlayerShell |
| 🎮 | Empty/generic game | `<Gamepad2 />` | Used in Feed, MyGames, Home, Creator, Category, Create, PWAInstallPrompt, MultiplayerModal |
| 🔒 | Auth gate | `<Lock />` | Used in Favourites, MyGames, Earnings |
| 🔍 | No search results | `<SearchX />` | Used in Explore |
| ❤️ / 🤍 | Favourite toggle | `<Heart />` with `fill` prop | Used in GameOverlay, Favourites footer |
| 💔 | Empty favourites | `<HeartOff />` or `<HeartCrack />` | Favourites.tsx |
| 👥 | Multiplayer | `<Users />` | GameOverlay, MultiplayerHUD, MultiplayerModal |

### 2.2 File-by-File Replacement

#### `apps/web/src/pages/Feed.tsx`
| Line | Emoji | Replace with |
|------|-------|-------------|
| ~185 | 💥 | `<AlertTriangle size={48} />` |
| ~204 | 🎮 | `<Gamepad2 size={56} />` |
| ~522 | 🎮 | `<Gamepad2 size={48} />` |

#### `apps/web/src/pages/Favourites.tsx`
| Line | Emoji | Replace with |
|------|-------|-------------|
| 59 | 💔 | `<HeartCrack size={56} />` |
| 87 | 🔒 | `<Lock size={48} />` |
| 118 | 💥 | `<AlertTriangle size={48} />` |
| 239 | ❤️ | `<Heart size={16} className="inline" />` |

#### `apps/web/src/pages/Create.tsx`
| Line | Emoji | Replace with |
|------|-------|-------------|
| 40 | 💡 | `<Lightbulb size={18} />` |
| 41 | 📋 | `<ClipboardList size={18} />` |
| 42 | ⚡ | `<Zap size={18} />` |
| 43 | 🧪 | `<FlaskConical size={18} />` |
| 44 | 🔧 | `<Wrench size={18} />` |
| 45 | ✨ | `<Sparkles size={18} />` |
| 46 | 🔊 | `<Volume2 size={18} />` |
| 47 | 🖼️ | `<Image size={18} />` |
| 48 | 🚀 | `<Rocket size={18} />` |
| 679 | 😵 | `<AlertTriangle size={48} />` |
| 693 | 🔄 | `<RefreshCw size={18} />` |
| 693 | 🎮 | `<Gamepad2 size={18} />` |
| 871 | ✏️ | `<Pencil size={16} />` |
| 876 | 💾 | `<Save size={16} />` |
| 881 | 🎉 | `<PartyPopper size={16} />` |
| 885 | 🏠 | `<Home size={16} />` |
| 890 | ✨ | `<Sparkles size={16} />` |

#### `apps/web/src/pages/MyGames.tsx`
| Line | Emoji | Replace with |
|------|-------|-------------|
| 59 | 🎮 | `<Gamepad2 size={56} />` |
| 87 | 🔒 | `<Lock size={48} />` |
| 176 | 🎮 | `<Gamepad2 size={32} />` |
| 417 | 💥 | `<AlertTriangle size={48} />` |

#### `apps/web/src/pages/Home.tsx`
| Line | Emoji | Replace with |
|------|-------|-------------|
| 15 | 🏃 (action) | `<Swords size={18} />` |
| 16 | 🗺️ (adventure) | `<Map size={18} />` |
| 17 | 🧩 (puzzle) | `<Puzzle size={18} />` |
| 18 | 🕹️ (arcade) | `<Joystick size={18} />` |
| 19 | 🔫 (shooter) | `<Crosshair size={18} />` |
| 20 | 🏰 (strategy) | `<Castle size={18} />` |
| 21 | 🏃‍♂️ (platformer) | `<Footprints size={18} />` |
| 22 | 🎵 (rhythm) | `<Music size={18} />` |
| 23 | 🃏 (cards) | `<Spade size={18} />` |
| 24 | ⏳ (survival) | `<Timer size={18} />` |
| 25 | 🏎️ (racing) | `<Car size={18} />` |
| 26 | 🎯 (casual) | `<Target size={18} />` |
| 27 | 🔮 (rpg) | `<Wand2 size={18} />` |
| 28 | ✈️ (flight) | `<Plane size={18} />` |
| 29 | 🌀 (other) | `<Shapes size={18} />` |
| 246 | 🎮 | `<Gamepad2 size={56} />` |

#### `apps/web/src/pages/Category.tsx`
| Line | Emoji | Replace with |
|------|-------|-------------|
| 12–29 | (same as Home.tsx genre icons) | Same Lucide mappings as Home.tsx |
| 177 | 🎮 | `<Gamepad2 size={56} />` |

#### `apps/web/src/pages/Explore.tsx`
| Line | Emoji | Replace with |
|------|-------|-------------|
| 178 | 💥 | `<AlertTriangle size={48} />` |
| 228 | 🔍 | `<SearchX size={48} />` |

#### `apps/web/src/pages/Game.tsx`
| Line | Emoji | Replace with |
|------|-------|-------------|
| 134 | 🕳️ | `<FileQuestion size={48} />` |

#### `apps/web/src/pages/Creator.tsx`
| Line | Emoji | Replace with |
|------|-------|-------------|
| 84 | 👤 | `<UserX size={48} />` |
| 164 | 🎮 | `<Gamepad2 size={48} />` |

#### `apps/web/src/pages/Dashboard/Earnings.tsx`
| Line | Emoji | Replace with |
|------|-------|-------------|
| 108 | 🔒 | `<Lock size={48} />` |
| 126 | 💎 | `<Gem size={48} />` |

#### `apps/web/src/components/layout/GameOverlay.tsx`
| Line | Emoji | Replace with |
|------|-------|-------------|
| 220 | 👥 | `<Users size={20} />` |
| 230 | ❤️/🤍 | `<Heart size={20} />` with `fill` prop based on state |

#### `apps/web/src/components/GamePlayerShell.tsx`
| Line | Emoji | Replace with |
|------|-------|-------------|
| 163 | 💥 | `<AlertTriangle size={48} />` |
| 173 | ⚠️ | `<AlertTriangle size={32} />` |

#### `apps/web/src/components/PWAInstallPrompt.tsx`
| Line | Emoji | Replace with |
|------|-------|-------------|
| 56 | 🎮 | `<Gamepad2 size={32} />` |

#### `apps/web/src/components/OfflineBanner.tsx`
| Line | Emoji | Replace with |
|------|-------|-------------|
| 30 | 📡 | `<WifiOff size={18} />` |

#### `apps/web/src/components/multiplayer/MultiplayerModal.tsx`
| Line | Emoji | Replace with |
|------|-------|-------------|
| 72 | 🎮 | `<Gamepad2 size={18} />` |
| 131 | 🚀 | `<Rocket size={18} />` |
| 180 | 📋 | `<Copy size={16} />` |
| 190 | 🔗 | `<Link size={16} />` |
| 230 | 👑 | `<Crown size={14} />` |
| 257 | 🎮 | `<Gamepad2 size={18} />` |
| 338 | 🎮/👥 | `<Gamepad2 />` / `<Users />` |
| 367 | ✨/🚪 | `<Sparkles size={16} />` / `<DoorOpen size={16} />` |

#### `apps/web/src/components/multiplayer/MultiplayerReconnect.tsx`
| Line | Emoji | Replace with |
|------|-------|-------------|
| 14 | 👋 | `<UserMinus size={20} />` |
| 19 | 📡 | `<WifiOff size={20} />` |

#### `apps/web/src/components/multiplayer/MultiplayerHUD.tsx`
| Line | Emoji | Replace with |
|------|-------|-------------|
| 39 | 👥 | `<Users size={14} />` |

#### `apps/web/src/stores/multiplayer.ts`
| Line | Emoji | Replace with |
|------|-------|-------------|
| 10 | 🦊🐸🐙🦄🐲🎃🤖🎮 | Keep as emojis — these are player avatars displayed in game UI, not UI icons. Could optionally be replaced with colored initials or SVG avatar illustrations in a future pass. |

---

## Part 3: UI Consistency Fixes

### 3.1 Theme Unification

The app has two conflicting color palettes:

**Cream/Light theme (v1 remnant):**
- `sloppy-cream`, `sloppy-dark`, `sloppy-pink`, `sloppy-cyan`, `sloppy-yellow`
- `bg-white`, `text-sloppy-dark`, `border-sloppy-dark/5`
- Used in: `Favourites.tsx`, `Create.tsx`, `MultiplayerModal.tsx`, `PWAInstallPrompt.tsx`, `OfflineBanner.tsx`

**Dark theme (v2 standard):**
- `sloppy-bg`, `sloppy-surface`, `sloppy-surface-hover`, `sloppy-text`, `sloppy-text-muted`, `sloppy-border`, `sloppy-primary`, `sloppy-secondary`
- Used in: `MyGames.tsx`, `Home.tsx`, `Explore.tsx`, `Game.tsx`, `GameCard.tsx`, `Sidebar.tsx`, `BottomNav.tsx`

**Action**: Migrate ALL pages to the dark theme (v2 standard). Replace every `sloppy-cream`, `sloppy-dark`, `sloppy-pink`, `bg-white` with the equivalent `sloppy-*` dark theme token.

### 3.2 Files to Migrate to Dark Theme

| File | Issue |
|------|-------|
| `Favourites.tsx` | Uses `text-sloppy-dark`, `bg-white`, `border-sloppy-dark/5`, skeleton uses cream bg |
| `Create.tsx` | Uses `sloppy-cream`, `sloppy-dark`, `sloppy-pink`, `sloppy-cyan` throughout |
| `MultiplayerModal.tsx` | Uses `bg-white`, `sloppy-cream`, `sloppy-dark` |
| `PWAInstallPrompt.tsx` | Uses `bg-white`, `border-sloppy-pink/20`, `sloppy-dark` |
| `OfflineBanner.tsx` | Uses `sloppy-yellow`, `sloppy-dark` |

### 3.3 Hardcoded Colors to Replace

| File | Current | Replace with |
|------|---------|-------------|
| `Create.tsx` | `bg-red-50`, `border-red-200`, `text-red-800` | `bg-sloppy-danger/10`, `border-sloppy-danger/30`, `text-sloppy-danger` |
| `MultiplayerHUD.tsx` | `bg-green-400`, `bg-yellow-400`, `bg-red-400` | `bg-sloppy-success`, `bg-sloppy-warning`, `bg-sloppy-danger` |
| `MultiplayerHUD.tsx` | `bg-red-500/80` | `bg-sloppy-danger/80` |
| `MultiplayerModal.tsx` | `text-red-500` | `text-sloppy-danger` |
| `MyGames.tsx` | `bg-amber-500/20`, `text-amber-400`, `bg-emerald-500`, `text-emerald-400` | `bg-sloppy-warning/20`, `text-sloppy-warning`, `bg-sloppy-success`, `text-sloppy-success` |
| `Earnings.tsx` | `bg-amber-500/20`, `bg-blue-500/20`, `bg-emerald-500/20`, `bg-red-500/20` | Use `sloppy-warning`, `sloppy-secondary`, `sloppy-success`, `sloppy-danger` |
| `Settings.tsx` | `bg-emerald-500/10`, `bg-emerald-400`, `text-red-400`, `bg-red-500` | Use `sloppy-success` and `sloppy-danger` tokens |

### 3.4 Button Standardization

**Standard**: Use `SloppyButton` component for ALL CTAs. Replace raw `motion.button` in:

| File | Lines | Current | Replace with |
|------|-------|---------|-------------|
| `Home.tsx` | ~252 | Raw `motion.button` with `bg-sloppy-primary` | `<SloppyButton>` |
| `Explore.tsx` | ~181, ~238 | Raw `motion.button` | `<SloppyButton>` |
| `Game.tsx` | ~137, ~206 | Raw `motion.button` | `<SloppyButton>` |
| `Category.tsx` | ~184 | Raw `motion.button` | `<SloppyButton>` |
| `Feed.tsx` | ~186, ~206 | Raw `motion.button` | `<SloppyButton>` |
| `MyGames.tsx` | ~222–263 | Custom buttons with `bg-emerald-500` etc. | `<SloppyButton variant="...">` |

### 3.5 Empty/Error State Standardization

Create a reusable `EmptyState` component pattern:

```tsx
interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}
```

**Standard sizing**:
- Icon: Lucide icon at `size={48}` with `text-sloppy-text-muted`
- Title: `font-heading text-xl text-sloppy-text`
- Description: `text-sm text-sloppy-text-muted`
- Container: `py-20 flex flex-col items-center gap-4`
- CTA: `<SloppyButton>`

Apply to: Feed, Favourites, MyGames, Explore, Game, Creator, Category, Earnings

### 3.6 Auth Gate Standardization

Create a consistent `AuthGate` component with:
- Lock icon (Lucide `<Lock />`)
- Title: "Sign in to {feature}"
- Sign-in buttons (Google + Guest)
- Consistent padding and spacing

Fix `Earnings.tsx` auth gate — currently has no sign-in CTA.

### 3.7 Skeleton Card Consistency

Standardize skeleton cards to use dark theme:
- `bg-sloppy-surface rounded-wobbly-lg border border-sloppy-border`
- Animate with `animate-pulse`
- Replace Favourites cream skeleton (`bg-white border-sloppy-dark/5`)

### 3.8 Sort/Filter Tab Consistency

Standardize tab styling across pages:

| Page | Current Style | Standard |
|------|--------------|----------|
| Favourites | `bg-sloppy-pink text-white` / `bg-sloppy-dark/5 text-sloppy-dark/50` | `bg-sloppy-primary/15 text-sloppy-primary` / `text-sloppy-text-muted` |
| MyGames | `bg-sloppy-primary/15 text-sloppy-primary` / `text-sloppy-text-muted` | Already correct |
| Category | `bg-sloppy-primary/15 text-sloppy-primary` / `text-sloppy-text-muted` | Already correct |

### 3.9 Font Usage Consistency

- `font-heading` for page titles, section headings, game titles, button CTAs
- `font-body` (default) for body text, descriptions, labels
- Tabs/filters: `text-sm font-medium` with `font-body`
- Badges: `text-[10px] font-bold uppercase tracking-wider`

Fix `Create.tsx` and `Favourites.tsx` which mix heading/body fonts inconsistently.

### 3.10 Missing Hover/Active States

Add `whileHover={{ scale: 1.02 }}` or `hover:bg-sloppy-surface-hover` to:
- Explore retry button (line ~181)
- Category sort tabs (line ~122–132)
- Earnings auth gate (needs CTA button entirely)

---

## Part 4: Implementation Order

1. **Install `lucide-react`** — `pnpm --filter @sloppy/web add lucide-react`
2. **Create shared `EmptyState` and `AuthGate` components** — reusable patterns
3. **Replace emojis file by file** — start with highest-traffic pages (Feed, Home, Explore, Create)
4. **Migrate theme** — switch cream-themed pages to dark theme tokens
5. **Standardize buttons** — replace raw `motion.button` with `SloppyButton`
6. **Fix hardcoded colors** — replace `red-`, `amber-`, `emerald-`, `blue-` with `sloppy-*`
7. **Skeleton/tab/font consistency** — polish remaining inconsistencies
8. **Test all pages** — verify visual consistency across Feed, Home, Explore, Create, Favourites, MyGames, Game, Creator, Category, Dashboard

---

## Files to Touch (Complete List)

1. `apps/web/src/pages/Feed.tsx`
2. `apps/web/src/pages/Favourites.tsx`
3. `apps/web/src/pages/Create.tsx`
4. `apps/web/src/pages/MyGames.tsx`
5. `apps/web/src/pages/Home.tsx`
6. `apps/web/src/pages/Explore.tsx`
7. `apps/web/src/pages/Game.tsx`
8. `apps/web/src/pages/Creator.tsx`
9. `apps/web/src/pages/Category.tsx`
10. `apps/web/src/pages/Dashboard/Earnings.tsx`
11. `apps/web/src/pages/Dashboard/Settings.tsx`
12. `apps/web/src/components/layout/GameOverlay.tsx`
13. `apps/web/src/components/GamePlayerShell.tsx`
14. `apps/web/src/components/PWAInstallPrompt.tsx`
15. `apps/web/src/components/OfflineBanner.tsx`
16. `apps/web/src/components/multiplayer/MultiplayerModal.tsx`
17. `apps/web/src/components/multiplayer/MultiplayerReconnect.tsx`
18. `apps/web/src/components/multiplayer/MultiplayerHUD.tsx`
19. `apps/web/src/components/ui/EmptyState.tsx` (new)
20. `apps/web/src/components/ui/AuthGate.tsx` (new — extract from Favourites/MyGames)
