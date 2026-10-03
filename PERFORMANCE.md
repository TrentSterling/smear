# SMEAR performance

V9 / 0.9.0 uses native WebGPU compute and rendering. The verified 3000x1800 Chrome workloads average approximately 60 FPS at the harness's presentation cadence. CPU p99 is 1.5 to 1.6 ms; GPU compute p99 is 1.05 to 2.03 ms and GPU rendering p99 is 0.66 to 1.25 ms. Actual GPU simulation advances near 120 Hz. Audio runs during tests with browser output muted.

See [the architecture, exact measurements and checks](docs/qa/compute-v9.md) and [the compact receipt](docs/qa/compute-v9.json). Run npm run verify:release to reproduce. Historical CPU/Canvas measurements remain in docs/qa/legacy-v8-performance.md and the prior release documents.
