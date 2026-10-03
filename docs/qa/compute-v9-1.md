# SMEAR 0.9.1 shader compatibility patch

The published 0.9.0 compute module failed in Firefox/Zen before the first frame because it assigned multiple vector components through a swizzle. Chrome accepted those expressions; the Firefox compiler rejected them. The four assignments now update individual components or construct the complete vector, preserving the particle owner component. Firefox also rejected the non-void wet-supply CAS function's return path. It now breaks after a successful exchange and returns the same amount after the loop.

The builder rejects multiple-component swizzle assignments. The release gate now exercises both Chrome's and Firefox's actual hardware shader compilers and GPU gameplay. Firefox runs in a dedicated headed profile because its headless mode returns no WebGPU adapter on this Windows host. Native input and performance tests keep game sound enabled and the AudioContext running; output is muted separately. Firefox audio activation is asynchronous, so the harness waits for the running state after its native click.

Verified 2026-10-03 with `npm run verify:release` and `npm run profile:firefox`, sequentially:

- Chrome GPU gameplay: `COMPLETE compute game checks passed (10 checks)`.
- Chrome native 3000x1800 workloads: `COMPLETE native GPU gameplay and 3000x1800 profiles passed (7 checks)`.
- Firefox GPU gameplay: `COMPLETE compute game checks passed (10 checks)`.
- Firefox native 3000x1800 workloads: `COMPLETE native GPU gameplay and 3000x1800 profiles passed (7 checks)`.

All native idle, pistol, Spill, drag and Chaos captures held approximately 60 FPS. The harness presentation rate is approximately 60 Hz; this is not an uncapped maximum FPS measurement. Chrome's highest workload CPU p99 was 1.50 ms and compute p99 2.03 ms. Firefox's highest workload CPU p99 was 4.00 ms and compute p99 1.93 ms. All workload audits recorded zero CPU paint pixel reads, zero body/pigment downloads during play, zero body/particle/pigment uploads and zero WebGL contexts. Both browsers passed native GPU picking, floor smearing, wall drips, full wash/heal and long finite simulation/recovery. Their gameplay checks reached 180 bodies and verified all three spawn torso sightlines at three resolutions. Firefox hides adapter vendor details but reports a non-fallback adapter.

Compact results and raw percentile values are retained in [compute-v9-1.json](compute-v9-1.json). V7 and the archived V8.9 source hashes remain unchanged. The existing OG image and portfolio card are retained. The live URL for this patch is https://tront.xyz/smear/?v=091.
