# Studio KZ Game Hub v0.1 — Work Handoff

## 1. Purpose

Build the first permanent Game entry point for Studio KZ.

This is not a GAME.001-only microsite.
It is a small Game Hub that currently contains only one released Game.

The Hub should be structurally ready for GAME.002 and later works without visually pretending that multiple Games already exist.

## 2. Locked information architecture

### Root
`/`

Role:
- Studio KZ Game index
- Currently displays GAME.001 only
- Minimal, quiet, release-oriented
- Must remain useful when more Games are added later

### GAME.001 canonical page
`/001`

Role:
- Permanent page for GAME.001 〈퇴근 전〉
- This URL belongs to the work, not to a specific platform
- Should contain the minimum information needed to understand the Game and choose a platform

Current platform:
- Web only

Future platform buttons may be added later without changing this URL.

### GAME.001 Web build
`/001/play`

Role:
- Actual playable Web build
- The existing completed build should be integrated without changing gameplay, UI, copy, assets, sound, or runtime unless a technical packaging change is strictly required for hosting

## 3. Invariants

- Do not merge this repository with `kimbyeonggwan-site`.
- Do not change the existing Poem Series site.
- Do not redesign GAME.001 gameplay during deployment.
- Do not add speculative Steam / Roblox / App buttons before those versions exist.
- Do not turn the Hub into a large “Studio KZ platform” announcement.
- Preserve a simple release grammar: GAME.001 first, infrastructure second.

## 4. Public release logic

The public-facing hierarchy should be:

```
GAME
001
〈퇴근 전〉
[brief descriptor if needed]
[PLAY ON WEB]
```

Exact copy and visuals may be refined during implementation, but avoid excessive explanation of future plans.

## 5. Deployment target

First verify the project on GitHub Pages using the repository's default Pages URL.

Only after the following pass:
- root loads
- `/001` loads directly
- `/001/play` loads directly
- mobile access works
- refresh/direct-link behavior works
- GAME.001 build functions correctly

then connect:

`game.kimbyeonggwan.xyz`

## 6. Custom domain handoff

After GitHub Pages deployment is healthy:

GitHub repository:
- Settings → Pages
- Custom domain: `game.kimbyeonggwan.xyz`

Namecheap DNS:
- Type: CNAME Record
- Host: `game`
- Value: `reddok2022-rgb.github.io.`
- TTL: Automatic

Do not modify the existing apex A records for `kimbyeonggwan.xyz`.
Do not modify the existing `edition` CNAME.

## 7. Acceptance check

Release candidate passes only if:

1. `/` is a Game Hub, not an accidental direct boot into GAME.001.
2. `/001` is a permanent GAME.001 landing page.
3. `/001/play` launches the Web build.
4. Direct URLs survive refresh.
5. Mobile portrait use is not broken.
6. Existing GAME.001 behavior is preserved.
7. Adding GAME.002 later does not require changing the meaning of `/001`.
8. Custom-domain connection can be added after Pages validation without rebuilding the information architecture.

## 8. Current handoff state

Repository scaffold: READY
GAME.001 build integration: TODO in Work
Hub implementation: TODO in Work
GitHub Pages deployment setup: TODO in Work
Custom domain: WAIT until Pages QA passes
