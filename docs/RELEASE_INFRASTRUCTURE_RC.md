# Studio KZ Game Hub v0.1 — Release Infrastructure RC

## Scope and provenance

- Audited all initial repository files: README, handoff document and .gitignore;
  read Issue #1. Initial main: `c93eaa46077442bce1c01b24f86a121ec132c95d`.
- GAME.001 source: `/workspace/sites/before-clockout/dist`, clean source checkout,
  Public Release v1.0 commit `7bd0bb81a529a693c74bf75bc6447a17b8f78726`.
- All 33 runtime/asset/provenance files copied byte-for-byte to
  `public/001/play`. No HTML, CSS, JavaScript, asset, sound or path substitutions.
- Existing release image copied unchanged to `public/assets/game-001-release.png`.
  Original: `Release용 이미지 - Game.png` (Library ID
  `libfile_0fe3d867f0388191990528aaa4c6ea50`).
- The game description comes from the existing game's HTML description.
- Other repositories, deployed Sites, original assets and DNS were not modified.

## Architecture

The generated index lists only GAME.001 and links to its canonical landing.
The landing links to its actual Web channel. No hypothetical games or channels
are rendered. Per-game data and physical route directories keep the work address
separate from distribution channels.

Static HTML/CSS plus a standard-library Python generator was selected because
the approved game is already static and uses relative local asset paths.
No iframe, SPA routing, injected runtime, or dependency download is needed.

## Verification at implementation

- Build: PASS.
- Physical `/`, `/001/`, `/001/play/` entry points: PASS.
- All HTML local links/assets resolve within the deployment artifact: PASS.
- All 33 GAME.001 files match approved-source SHA-256 hashes: PASS.
- Local HTTP: all three routes return 200 after directory normalization on both
  direct and repeated requests; all 33 served game files match their hashes.
- GitHub Actions build, route/hash verification and artifact upload: PASS on
  implementation commit `47ef3b18f64087eb240fb3b62456bbccd2eca40e`.
- GitHub Actions deploy: BLOCKED at `actions/configure-pages@v5`:
  `Get Pages site failed` / `HttpError: Not Found` because Pages is not enabled.
  Run: https://github.com/reddok2022-rgb/studio-kz-game-hub/actions/runs/35679347453
- Default Pages root opened in Chrome: 404, "There isn't a GitHub Pages site here."
  Public `/001`, `/001/play` and browser-refresh acceptance remain unverified.
- Actual desktop and mobile/touch play: pending deployment and browser/device QA.
- Audio files preserved; audible playback and success/retry: pending browser QA.
- A static build or hash comparison is not evidence of a device playtest.
- Cloud Browser could not access the local server (`ERR_BLOCKED_BY_CLIENT`);
  no desktop/mobile visual or audible pass is claimed from local HTTP checks.

## Deployment gate and manual handoff

The initial repository reports `has_pages: false`. Its default Pages site must be
enabled with **Settings → Pages → Build and deployment → Source → GitHub Actions**.
Then open **Actions → Deploy Game Hub to GitHub Pages → Run workflow → main**
(or rerun the failed deployment after enablement).

The connected GitHub tools do not expose a Pages-settings mutation, and the
available Cloud Browser is not signed into GitHub. No login, token creation,
permission changes or DNS changes were performed to bypass this setup step.

Expected test URLs (not a claim of deployment success):

- `https://reddok2022-rgb.github.io/studio-kz-game-hub/`
- `https://reddok2022-rgb.github.io/studio-kz-game-hub/001`
- `https://reddok2022-rgb.github.io/studio-kz-game-hub/001/play`

Verify each by direct navigation and reload. Test desktop keyboard/mouse, mobile
portrait joystick/CLEAN/swipe, first gesture audio, timeout, success and retry.
Check all assets for 404s and confirm no new browser errors.

## Custom domain

**NOT READY until the preceding QA passes.** No CNAME file is shipped, no GitHub
custom domain is configured, and no Namecheap records are changed by this task.
Only after a separate approval, use the custom-domain handoff in GAME_HUB_V0.1.md
and update `SITE_URL` as documented in README. Keep apex and edition records intact.

This is not a declaration of Public Release v1.0 for the Hub.
