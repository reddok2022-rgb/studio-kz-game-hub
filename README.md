# Studio KZ Game Hub

Studio KZ의 Game을 발견하고, 각 Game의 영구 페이지와 배포 플랫폼으로 이동하기 위한 독립 Game Hub repository.

## Canonical domain

- Planned: `https://game.kimbyeonggwan.xyz`
- Domain connection is performed after the first GitHub Pages build is verified.

## URL contract

- `/` — Game Hub
- `/001` — GAME.001 〈퇴근 전〉 canonical landing page
- `/001/play` — GAME.001 〈퇴근 전〉 Web build

The canonical game page and the playable build are intentionally separate.

## Platform model

A Game is the work itself. Web, Steam, Roblox, and App are distribution channels attached to that Game.

Example:

```
GAME.001 〈퇴근 전〉
├─ Web
├─ Steam      (future, if applicable)
├─ Roblox     (future, if applicable)
└─ App        (future, if applicable)
```

The permanent page `/001` should remain valid even if the distribution platform changes later.

## Current release

### GAME.001 〈퇴근 전〉

- Hub version: **Studio KZ Game Hub v0.1 — Release Infrastructure RC**
- First distribution channel: Web
- Completed Web build: Public Release v1.0, copied without changes from source commit `7bd0bb81a529a693c74bf75bc6447a17b8f78726`
- Current gate: GitHub Pages activation and public/browser QA; custom domain remains WAIT
- Public copy should describe the current work, not announce hypothetical future platforms.

## Repository boundary

This repository is independent from the existing `kimbyeonggwan-site`.

Do not move Poem Series or existing main-site code into this repository.
Do not modify `kimbyeonggwan.xyz` merely to host the Game build.

The main site and Game Hub may be connected later through navigation or public links, but they remain independently deployable.

## Initial release architecture

```
game.kimbyeonggwan.xyz
├─ /
│  └─ Game Hub
├─ /001
│  └─ GAME.001 〈퇴근 전〉 landing
└─ /001/play
   └─ Web game
```

See `docs/GAME_HUB_V0.1.md` for the implementation handoff.

## Build and deployment

Plain static HTML/CSS, generated with Python's standard library. No framework,
package installation, client-side router, or game wrapper is required.

```sh
python3 scripts/build.py
python3 scripts/verify.py
python3 -m http.server 8000 --directory dist
```

`data/games.json` owns the index and canonical landing metadata. Add a new work
there and its build under `public/<id>/play/`; the meaning of `/001` stays fixed.
Only actual channels belong in `platforms`. Existing GAME.001 runtime lives under
`public/001/play/`, with every original file checksum recorded in
`docs/GAME_001_BUILD_MANIFEST.json`.

The `main` push / manual workflow publishes only `dist/`. Enable repository
**Settings → Pages → Build and deployment → Source → GitHub Actions** first.
The workflow deliberately does not configure a custom domain or change DNS.

Expected default Pages base: `https://reddok2022-rgb.github.io/studio-kz-game-hub/`.
During this stage the repository prefix precedes `/001/` and `/001/play/`.
Real `index.html` files serve all three routes. Pages adds a trailing slash to
directory URLs; relative assets remain valid after direct access and refresh.

Canonical tags use the default Pages base during RC. After approved domain setup,
set repository Actions variable `SITE_URL` to `https://game.kimbyeonggwan.xyz`
and rerun the workflow. Do not do this before the public QA gate passes.

The prior game's BEST remains on its prior origin; this release does not migrate
localStorage to the new origin. No storage key or game behavior was changed.

See `docs/RELEASE_INFRASTRUCTURE_RC.md` for provenance, QA limits and handoff.
