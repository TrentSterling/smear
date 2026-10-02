# Changelog

## 0.8.2 / V8.2

- Cached deterministic bristle shapes and colors, removed per-bristle point allocations, and used numeric opacity instead of parsing a new RGBA string for each stroke.
- Tracked conservative dirty rectangles and uploaded only changed canvas regions through WebGL 2. Kept complete initialization/clearing and a bounded region-copy fallback for WebGL 1.
- Preserved all smear samples, bristles, wet transfer, contact physics, and pigment density; added exact simulation and reference-image comparisons.
- Added sustained floor-drag profiling, GPU-to-canvas pixel audits, and native mouse-drag verification locally and on the public website.

## 0.8.1 / V8.1

- Moved central pillars to the perimeter and the divider behind spawn, opening sightlines to all three starting dummies and the central drag area.
- Cached static collision bounds, rejected distant world contacts using those bounds, avoided square roots for missed sphere/box contacts, and rejected droplet segments outside box bounds.
- Reset wet-cell timestamps and flow clocks when cleaning surfaces, making a fresh smear demo repeatable after earlier live play.
- Added the repeatable 1200 x 630 OG image, canonical URL, Open Graph and Twitter metadata, and a favicon.
- Added Chrome CPU profiling, three-resolution spawn checks, and desktop/mobile portfolio publishing checks.
- Set up GitHub Pages for `tront.xyz/smear/` and the SMEAR card in the games portfolio.

## 0.8.0 / V8

- Renamed DRAGMARK to SMEAR in the page metadata, loading and error screens, accessibility label, HUD, About panel, and room wall sign.
- Updated the inspection API to `window.__smear` and the reported version to `0.8.0`.
- Added `smear.tune.v8` storage with migration of available V7 tuning from the same browser origin. Existing SMEAR settings take precedence.
- Moved the starting camera in front of V7's divider so the room and dummies are visible immediately.
- Preserved the supplied V7 HTML byte for byte in `versions/`.
- Added a local Git repository, instructions, and Chrome verification with captured receipts.

The deterministic smear demo retains V7's body motion, contacts, wound behavior, wet transfer, and persistent surface paint.
