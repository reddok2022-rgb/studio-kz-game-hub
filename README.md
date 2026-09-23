# Studio KZ Game Hub

Studio KZ의 Game을 발견하고, 각 Game의 영구 페이지와 배포 플랫폼으로 이동하기 위한 독립 Game Hub repository.

## Canonical domain

- Active custom domain: `https://game.kimbyeonggwan.xyz`
- Hosting: GitHub Pages; custom domain active.

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

- Hub version: **Studio KZ Game Hub v0.1**
- First distribution channel: Web
- Completed Web build: Public Release v1.0 / **Production V16**, copied byte-for-byte from source commit `c5b597d40b8d961cf8aa870644f1243f371476b1`
- Final hotfix: First-Time Context Guide Persistence Hotfix v0.2
- Canonical: `https://game.kimbyeonggwan.xyz/001/`
- Play: `https://game.kimbyeonggwan.xyz/001/play/`
- Custom domain: **active**
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

The `main` push / manual workflow publishes only `dist/` through GitHub Actions.
The active custom domain is `https://game.kimbyeonggwan.xyz`.
Actions uses `SITE_URL` for canonical URLs. The workflow does not change DNS.

Real `index.html` files serve `/`, `/001/`, and `/001/play/`.
Pages adds a trailing slash to directory URLs; relative assets remain valid
after direct access and refresh.

The prior game's BEST remains on its prior origin; this release does not migrate
localStorage to the new origin. At official Public Release, the Personal Best key
changes once from `clockout-core-best-v01` to `studio-kz-game-001-best-v1`.
The old key is ignored and preserved; no migration or fallback read occurs.
Both origins use the new key independently. Future patches retain this key.
Rollback reference: Production V15 / `6305e9b0e4996ff3c3bfc50c6e52a04435b08933`.

See `docs/RELEASE_INFRASTRUCTURE_RC.md` for provenance, QA limits and handoff.
