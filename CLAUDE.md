# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Zy's House** — A 2.5D pixel art interior explorer built with Phaser 3 and vanilla JavaScript. No build tools, no package manager, no bundler. Files are served as static assets.

## Running the Project

```bash
# Start local server (from project root)
python3 -m http.server 8080

# Open in browser
# http://localhost:8080/
```

There is no build step, no tests, no linting configured. Edit files directly and refresh the browser.

## Architecture

### Scene Flow
```
BootScene → StartScene → LoadingScene → GameScene
```

- **BootScene** (`js/scenes/BootScene.js`) — Empty pass-through; immediately transitions to StartScene.
- **StartScene** (`js/scenes/StartScene.js`) — Title screen with "Explore The World" button. Has re-entry protection (checks `hidden` class). Transitions to LoadingScene on click.
- **LoadingScene** (`js/scenes/LoadingScene.js`) — Preloads all assets (7 tilesets, player spritesheet, Tiled map JSON, interactables JSON, BGM audio) with a weighted progress bar (small files 20%, BGM 80%). Load errors count toward progress to prevent stalling. Enforces a 2.5s minimum display time. Transitions to GameScene when both loading and timer complete.
- **GameScene** (`js/scenes/GameScene.js`) — Creates tilemap layers, physics collision, player entity, animations, camera, keyboard input, the InteractionManager, and BGM playback with volume control. All game logic lives here.

### Physics System (Arcade Physics)

Collision comes from two sources:
1. **Tileset objectgroup** — Per-tile collision shapes defined in Tiled tilesets. Extracted dynamically from `map.tilesets[*].tileData` in GameScene. Applied via `layer.setCollision(collisionGIDs)`.
2. **collision_boxes object layer** — Custom collision regions drawn in Tiled as an object layer. Converted to Arcade static bodies using bounding boxes (polygons are approximated).

Player collision box is 16×16 at the feet (`body.setSize(16,16)` + `body.setOffset(0,16)`), matching the 16×32 sprite.

### Map System

- Map authored in **Tiled Map Editor v1.12.1** (`assets/map.json`)
- 21×18 tile grid, 16×16 tiles, scaled 2× in-game
- 5 tile layers (bottom→top): `ground`, `on the ground`, `wall`, `on the object`, `roof`
- 7 tilesets, all 16×16 frames (loaded as spritesheets)
- Canvas size: 672×576 (21×16×2, 18×16×2)

### Player

- Sprite: `assets/player.png` — 3 columns × 4 rows, 16×32 per frame
- Row order: down (0-2), left (3-5), right (6-8), up (9-11)
- Middle column (frames 1, 4, 7, 10) = standing idle frames
- Animation uses ping-pong pattern: `[0,1,2,1]`, `[3,4,5,4]`, etc.
- Movement: WASD keys, speed 100 (Arcade pixels/sec)
- Scale: 2× to match tilemap

### Interaction System

**InteractionManager** (`js/systems/InteractionManager.js`) — Two interaction types:

**Dialogue** (default): Visual-novel-style dialogue for map objects.
- Config: `conf/interactables.json` maps Tiled object IDs to `{name, lines}`
- Proximity: finds nearest interactable within 40px of player's feet each frame
- Shows "Press E" prompt when near an interactable; E key opens dialogue
- Typewriter text effect (35ms/char); Enter advances/completes, Esc closes

**App** (`type: "app"`): Deep interaction that launches a full-screen app overlay.
- Config entry uses `{name, type: "app", appId: "computer|mirror|television|bookshelf|window"}` instead of `lines`
- `launchApp(appId)` sets `appActive = true`, instantiates the app, and awaits its Promise
- `appActive` freezes the player and blocks all game input in `GameScene.update()`
- Apps dispatched: `computer` → ComputerApp, `mirror` → MirrorApp, `television` → TelevisionApp, `bookshelf` → BookshelfApp, `window` → WindowApp

### Computer App (`js/apps/ComputerApp.js`)

A windowed desktop environment rendered as DOM overlay on the Phaser canvas:

**Top Bar (macOS-style)**:
- Center: real-time clock
- Right: Bluetooth icon, WiFi icon, Battery icon with percentage
- Battery starts at 22%, charges 1% every 30 seconds until 100%, then shows non-charging state
- Icons: `assets/bluetooth.svg`, `assets/wifi.svg`, `assets/battery.svg` (charging), `assets/battery_100.svg` (full)

**Desktop**:
- Wallpaper: `assets/computer-wp.jpg`
- Icons: Terminal (`assets/terminal.svg`), Browser (`assets/browser.svg`), README (`assets/MarkdownLogo.svg`)
- Double-click opens app windows

**Window System**:
- Draggable windows with minimize/maximize/close buttons
- Windows constrained to desktop area (cannot drag outside)
- Focus tracking, right-side Dock showing active windows
- Light-themed windows for Browser and README apps

**Apps**:
- **Terminal**: Linux-style command line with config-driven commands (`conf/linux-commands.json`)
- **Browser**: URL input with confirmation, opens real browser tabs, shows favorite sites (`conf/websites.json`)
- **README**: Markdown viewer displaying usage guide (`conf/readme.md`)

### Mirror App (`js/apps/MirrorApp.js`)

Interactive mirror that shows the player's sprite reflected. Extracts idle frames from the player spritesheet as data URLs (once, cached). Mouse movement controls rotation with smooth interpolation (lerp 0.15). 4-direction blending with 30° blend zone for crossfade. Blurs the Phaser canvas behind it.

### Television App (`js/apps/TelevisionApp.js`)

Cinematic poster gallery. 3-layer visual: blurred background (crossfade every 60s), atmosphere overlay (radial gradient), marquee foreground (2 scrolling tracks). Loads from `conf/posters.json`. Control bar at bottom: play/pause toggle, volume slider (hover popup with 0-100 range, maps to scroll speed zones), mute icon swap (`volume.svg` ↔ `mute-L.svg`). Hover focuses poster; click updates background. CSS injected via static class property `TelevisionApp.CSS`.

### Bookshelf App (`js/apps/BookshelfApp.js`)

Wooden bookshelf display. Loads book data from `conf/books.json` (flat array with `title`, `url`, `category`). Groups books by category; category tabs at top for switching. Each page shows 3 shelves of 6 books each (cover images). Pagination at bottom when books exceed one page. Hover lifts book with tooltip showing title. CSS-only wood grain texture and shelf boards. Side panel edges frame the shelves.

### Window App (`js/apps/WindowApp.js`)

Window that shows random landscape images. Fetches from `https://t.alcy.cc/fj` (redirects to an image URL, cache-busted with timestamp). Full game-area size (672×576) with wooden window frame and cross pane dividers. Refresh button (↻) loads a new random image. Loading state while image fetches.

### Key Conflict Resolution

When any app overlay is open, keyboard input is isolated from the game:
1. `scene.input.keyboard.enabled = false` — Disables Phaser keyboard plugin
2. `GameScene.update()` checks `appActive` — Stops player movement
3. `InteractionManager.update()` checks `appActive` — Blocks interaction input
4. Terminal input uses `e.stopPropagation()` to prevent Phaser interference

### BGM System

- Audio loaded in `LoadingScene.preload()`, key `'bgm'`
- `GameScene.create()` plays it immediately (looping, volume from slider default 70%)
- `#bgm-toggle` icon toggles pause/play (♪/▶), respects `userPaused` state
- Volume slider (`#bgm-volume`) auto-pauses at 0, auto-resumes above 0 (unless user-paused)
- Event listeners cleaned up on scene `shutdown`

### UI Layer (HTML/CSS)

- Left panel (`#operation-guide`): Operation guide with 3D mechanical key caps
- Left panel (`#options-panel`): BGM toggle icon + volume slider + percentage
- Right panel (`#game-container`): Phaser canvas mount point + all overlay screens
- Bottom header (`#bottom-header`): Title, credits, copyright, uptime counter, attribution
- Key caps sync with game input — `GameScene.update()` toggles `.active` class on DOM elements (only on state change, not every frame). Skipped entirely when `appActive` is true.

### Fonts

- **Excalifont** — Default body font (Chinese/general text, terminal)
- **PressStart2P** — Pixel font for key caps, bottom header, computer UI
- **Pixel32_CN** — Chinese pixel font for dialogue text

### Custom Cursor

`assets/pixel-cursor.png` — Crosshair cursor, hotspot at center (8,8). Set on `body` in CSS.

## Configuration Files

| File | Purpose |
|------|---------|
| `conf/interactables.json` | Interaction data: Tiled object IDs → dialogue or app config |
| `conf/linux-commands.json` | Terminal command outputs (prompt, whoami, hostname, date, pwd, ls, cat, echo, clear, help) |
| `conf/websites.json` | Browser favorite websites list (name + url) |
| `conf/posters.json` | TelevisionApp poster data (title + image url, 73 entries) |
| `conf/books.json` | BookshelfApp book data (title + cover url + category) |
| `conf/readme.md` | README content displayed in markdown viewer |

## Key Files

| File | Purpose |
|------|---------|
| `index.html` | Entry point, loads Phaser CDN + all scripts |
| `css/style.css` | Core layout, fonts, key caps, cursor |
| `css/interaction.css` | Interaction prompt and dialogue box styles |
| `css/loading.css` | Start screen and loading screen styles |
| `css/computer.css` | Computer desktop overlay, windows, dock, terminal, browser, README styles |
| `js/main.js` | Phaser config (672×576, Arcade physics, scene registration) |
| `js/uptime.js` | Site uptime counter (start: 2026-05-30) |
| `js/scenes/BootScene.js` | Empty pass-through to StartScene |
| `js/scenes/StartScene.js` | Title screen with "Explore The World" button |
| `js/scenes/LoadingScene.js` | Asset preloading with weighted progress bar |
| `js/scenes/GameScene.js` | All game logic (map, physics, player, input, interactions, BGM) |
| `js/systems/InteractionManager.js` | Dialogue system + app dispatch for map objects |
| `js/apps/ComputerApp.js` | Windowed desktop environment with Terminal, Browser, README |
| `js/apps/BrowserApp.js` | Browser app with URL input and favorite sites |
| `js/apps/MirrorApp.js` | Interactive mirror with mouse-controlled player rotation |
| `js/apps/TelevisionApp.js` | Cinematic poster marquee with blurred background cycling |
| `js/apps/BookshelfApp.js` | Wooden bookshelf with categorized books and pagination |
| `js/apps/WindowApp.js` | Window showing random landscape images from remote API |
| `assets/map.json` | Tiled map data (tile layers + collision_boxes object layer) |

## Modifying the Map

1. Edit `assets/map.json` in Tiled Editor
2. If adding new tilesets: update `tilesetFiles` array in LoadingScene AND the `tilesetConfigs` array in GameScene (they must be kept in sync — cross-reference comments exist in both files)
3. Collision is automatic — any tileset tile with an objectgroup collision shape will be picked up dynamically
4. Custom collision regions: draw objects in the `collision_boxes` object layer in Tiled

## Adding a New Interactable App

**Top-level app** (like MirrorApp, TelevisionApp) — full-screen overlay dispatched by InteractionManager:

1. Add entry in `conf/interactables.json`: `{"name": "...", "type": "app", "appId": "myapp"}`
2. Create `js/apps/MyApp.js` with `open()` method returning a Promise (resolve when closed)
3. Add `<script src="js/apps/MyApp.js">` in `index.html` before `InteractionManager.js`
4. Add `this.myApp = null;` in InteractionManager constructor
5. Add `else if (appId === 'myapp')` branch in `InteractionManager.launchApp()`
6. In `open()`: disable Phaser keyboard, create DOM overlay; in `close()`: remove overlay, re-enable keyboard, resolve

**Sub-app within ComputerApp** (like Terminal, Browser, README):

1. Create `js/apps/MyApp.js` with `render(bodyEl)` method for window content
2. Add `<script src="js/apps/MyApp.js">` in `index.html` before `InteractionManager.js`
3. Update `ComputerApp.loadAppContent()` to dispatch to new app
4. Add app to desktop icons array, dock icons, symbol map, and title map in ComputerApp

## Adding a New Terminal Command

1. Edit `conf/linux-commands.json`
2. Add key-value pair where key is command name and value is output
3. Special values: `__DATE__` (dynamic date), `__CLEAR__` (clear screen)

## Debug Mode

Toggle physics debug in `js/main.js`:
```js
arcade: { gravity: { y: 0 }, debug: true }  // shows green collision boxes
```
