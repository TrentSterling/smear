# SMEAR V8 recovery and verification

The baseline is Trent's `dragmark_v7.html`, supplied from `D:\BACKUP AND OLD OLD SCREENSHOTS IN HERE`. The file is 757,836 bytes, titled `DRAGMARK 07`, and reports version `0.7`. It embeds Three.js r140 and has no external script or asset references.

The original is preserved in `versions/dragmark_v7.html`. SHA-256:

```
4dfe17e606b18ce7471f176b4c2afa0229b2f32e60b5b88c2971ebc6a75bc41f
```

## Validation

`npm run verify` completed on October 1, 2026:

```
COMPLETE all checks passed (13 checks)
```

Chrome used WebGL 2 through ANGLE Direct3D 11 on the NVIDIA GeForce RTX 5070 Ti at 1366 x 768. No browser exceptions or console errors were recorded.

The deterministic 14-second V7 and V8 smear demos match exactly after excluding the changed name/version and real-time CPU/frame measurements. Both ran 1,725 physics steps, produced 1,708 splats and 9,292 stroke segments, and landed 1,058 droplets. Body positions, rotations, wounds, wear, wet transfer, and surface supply are included in the comparison.

The comparison begins before real-time animation frames in both builds. V7's surface reset retains wet-cell timestamps, so a trace begun after a live run is not an equivalent initial condition. The test harness holds animation frames during the comparison, then releases them for the live simulation check. It drains queued paint uploads before captures.

Wall spills produced wet vertical deposits, visible splashes and downward streaks. V7 tuning migrated into the new SMEAR storage key; existing SMEAR settings remained authoritative. The original V7 checksum is checked on every run.

Screenshot review found the original camera obscured by V7's new divider. V8 changes its starting Z position from 4.1 to 2.4, placing the camera in front of that wall. The corrected starting view shows the dummies and bloodied body.

Raw receipt: [verification.json](verification.json).

- [Starting room](smear-v8-room.png)
- [Smear demo](smear-v8-demo.png)
- [Wall spill](smear-v8-wall.png)
- [About panel](smear-v8-about.png)

This validates the recovered build and focused V8 changes. It does not establish performance across browsers or add new physics features.
