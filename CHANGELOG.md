# Changelog

## 0.8.0 / V8

- Renamed DRAGMARK to SMEAR in the page metadata, loading and error screens, accessibility label, HUD, About panel, and room wall sign.
- Updated the inspection API to `window.__smear` and the reported version to `0.8.0`.
- Added `smear.tune.v8` storage with migration of available V7 tuning from the same browser origin. Existing SMEAR settings take precedence.
- Moved the starting camera in front of V7's divider so the room and dummies are visible immediately.
- Preserved the supplied V7 HTML byte for byte in `versions/`.
- Added a local Git repository, instructions, and Chrome verification with captured receipts.

The deterministic smear demo retains V7's body motion, contacts, wound behavior, wet transfer, and persistent surface paint.
