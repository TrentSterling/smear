# SMEAR V8.1 verification

Verified October 1, 2026 on Trent's RTX 5070 Ti with headless Chrome, WebGL 2, ANGLE Direct3D 11.

## Gameplay

`npm run verify` returned `COMPLETE all checks passed (17 checks)`. The [receipt](verification-v8.1.json) records real-GPU rendering, deterministic smears after reset, live simulation, wall deposits, storage migration, and absence of browser errors.

The divider is behind the starting camera, and the two central pillars are at the perimeter. Ray checks and captured views confirm all three starting dummies are visible at [1280 x 720](v8.1/spawn-1280.png), [1366 x 768](v8.1/spawn-1366.png), and [1920 x 1080](v8.1/spawn-1920.png).

The [smear demo](v8.1/smear-v8-demo.png) and [wall spill](v8.1/smear-v8-wall.png) retain visible persistent deposits. V7 remains byte-for-byte preserved. The [focused collision check](collision-preservation.json) compared exact V7 traces before changing arena placement; the final arena is checked for repeatability rather than equality to the old layout.

## Final release performance

The final rearranged arena was separately profiled. Chrome presentation was limited to 60 Hz; sampled physics CPU is not total frame time.

| Scenario | Sampled physics CPU / frame | Frame p99 | Frames over 25 ms |
|---|---:|---:|---:|
| room | 0.75 ms | 16.8 ms | 0 / 480 |
| demo | 1.33 ms | 16.8 ms | 0 / 840 |
| chaos | 5.11 ms | 16.8 ms | 2 / 597 |

Chaos had two slower frames, with a maximum of 33.4 ms. These are single local runs; they do not establish performance on other hardware. [Performance notes](../../PERFORMANCE.md) include the same-arena before/after comparison and remaining measured work. [Full release profile summary](profile-release.json).

## Publishing preview

`node tools/publish-check.mjs` returned `COMPLETE publish checks passed (12 checks)` against the combined local game and portfolio preview. The [receipt](publish-preview-v8.1.json) covers served HTML, the 1200 x 630 PNG, favicon, live game, visible dummies, card images, and category filters at [desktop](v8.1/games-1366.png) and [phone](v8.1/games-390.png) widths.

The OG image is rendered from the actual game and used by both page metadata and the portfolio card. GitHub Pages serves the game from the `smear` repository's `main` branch at its root; the user site's existing custom domain supplies the project URL. Public URLs are checked again after deployment using the same publishing harness.

## Public release

Published to [TrentSterling/smear](https://github.com/TrentSterling/smear), with Pages on `main` at the repository root and HTTPS enforcement enabled. The portfolio card was published in commit `6ebf074` of `TrentSterling/trentsterling.github.io`.

The real-browser check against [the public game](https://tront.xyz/smear/) and [games portfolio](https://tront.xyz/games/) returned `COMPLETE publish checks passed (12 checks)`. The [public receipt](publish-live-v8.1.json) confirms V8.1, successful game and image requests, all starting dummies visible, advancing simulation, category filters, and no JavaScript exceptions.

Captured after full image decoding: [live game](v8.1/live-game.png), [desktop card](v8.1/live-games-1366.png), and [phone card](v8.1/live-games-390.png).
