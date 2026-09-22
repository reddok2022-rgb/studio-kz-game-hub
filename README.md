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

- Status: pre-release
- First distribution channel: Web
- Current next step: implement Game Hub v0.1, landing page, and integrate the completed Web build
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
