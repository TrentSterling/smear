# Changelog

## 0.19.0 / V19 (restore lively wall flow)

- Restored V17 surface-film dynamics and rivulet timing while keeping the broad V18 wall-impact prints. Reversed the reduced mobile supply on wall trails and resting contacts.
- Raised the mobile fraction of impact liquid from 28% to 75%, allowing visible runoff beneath the persistent splat. Pigment-only rivulets still avoid duplicating liquid supply.
- Added a wall-slam motion gate that requires liquid to descend and leave the impact footprint within three seconds while its stain remains. Recorded matched comparisons with both V17 and V18.

## 0.18.0 / V18 (wall splats and slower drips)

- Wet wall contact now leaves a broad, persistent impact print and radial splatter, scaled by incoming contact-point speed and debited from coating. A short cooldown prevents repeated splats while pressing against a wall.
- Reduced the mobile fraction of wall contact deposits and increased near-vertical viscosity. The adhered print stays readable while excess liquid drains. Coarse wetness rivulets add pigment without creating more liquid.
- Kept floor pooling, pool dragging, airborne gravity and GPU storage unchanged. Added matched wall/floor impact checks and V17/V18 review MP4s.

## 0.17.0 / V17 (gravity, runoff and pool dragging)

- Added persistent surface velocity with tangential gravity, viscous drag and bounded film substeps. Wall and ramp blood now drains visibly; runoff crosses elevated edges as ballistic droplets and reaches the floor. Carried runoff volume deposits once, and a full particle pool retains pending liquid.
- Expanded contact pickup from five to nine samples and increased its rate. World-space contact displacement drives film momentum independently from the bounded high-resolution pigment transport, with more continuous liquid between bristles.
- Wound and impact droplets inherit substantially more linear and angular body motion. Fast coated bodies fling droplets while consuming coating, without manufacturing a new wound.
- Added gravity, edge conservation, particle-capacity, inherited velocity and coating-shedding checks; preserved the GPU-only runtime path, 120 Hz rig, 900 particles and existing pigment resolution.

## 0.16.0 / V16 (liquid film and accumulated art release)

- Added a finite 40-cells/metre mobile layer over the persistent pigment, with conservative leveling and contact transport, in-plane gravity, cross-floor-seam flow and persistent dried residue. Pools can expand and coalesce after deposition stops.
- Dummy contacts pick up and move liquid even outside the original high-resolution stain; the existing dry-pigment and bristle behavior remains intact. No extra hand tool.
- Dense optical coverage, thickness-dependent color, gloss and gradient normals give pools a cohesive surface.
- Adds 20.25 MiB of GPU storage and up to three compute dispatches per submitted frame, without normal-play body or pigment downloads. Existing simulation, particle, brush, rig and pigment resolutions are unchanged.
- Added focused film checks and a matched V14/V16 MP4 containing a finite Spill pulse, resting pools and live dragging.

## 0.15.0 / V15 (local wet contact pass)

- Replaced the single-point, velocity-aligned contact stroke with a footprint computed from contacting collision samples and projected body axes. Body rotation sweeps the material even when its center stays still.
- Restored accumulated-distance bristle variation, thinning as supply runs out, thin film between bristles, and growing pools under resting wet wounds or saturated coatings, debited from their available supply. Wet supply deposits over the footprint and is consumed by travel.
- Wet contacts redistribute existing pigment using bounded conservative flux from an immutable GPU snapshot. Dry stains remain fixed. Snapshots copy only active paint tiles and handle floor-record seams; no runtime pigment or body-pose readback is introduced.
- Added nine dedicated contact checks, including colored-pigment transport with fresh deposition disabled, and paired V14/V15 MP4 capture.

## 0.14.0 / V14 (local dummy finish)

- Added molded elbow, wrist and knee coverage to match crash-dummy construction more closely. Rounded limb ends, refined metal hub sampling and narrowed their silhouette shells.
- Sculpted subtle chest relief and softened the vinyl finish; added restrained shoe seams and laces. Calibration targets, small fasteners and metal rims now use derivative antialiasing.
- Kept the 15-body rig, flexible neck/waist, collision solver, locomotion and GPU paint behavior intact. The shared skin is 173,174 vertices and 346,128 triangles, plus its offset shell.
- Added a preserved V13 checkpoint and a dedicated model-finish comparison; reran the full browser, model, motion, mapping and tool-input checks.

## 0.13.0 / V13 (local startup and tools candidate)

- Removed per-sample array allocation from SDF primitives and empty mesher cells. Skin and outline attribute/index SHA-256 hashes match V12 exactly.
- Compile independent WebGPU pipelines concurrently, overlapping GPU compilation with CPU mesh generation; create bind groups after all resources are ready.
- Rebuilt the pistol with beveled surfaces, sights, slide details, recoil and a gloved grip. Added a labeled pressure bottle for Spill and corrected first-person framing.
- Added dedicated view-tool depth treatment so the weapon stays visible against nearby walls. Static tool pieces merge by material; slide and flash retain independent transforms.
- Added actual input checks for firing, FPS aiming and tool switching, plus matched before/after MP4 capture.

## 0.12.0 / V12 (local motion candidate)

- Synchronized arm swing and torso counter-rotation to the planted-foot gait. Added swing-foot pitch and reduced foot lift; hip height follows available leg reach instead of a constant walking crouch.
- Rebuilt recovery around the fallen pose and heading: roll onto the front when needed, gather, support on the hands, then rise. Recovery finishes only after the dummy is upright and can be interrupted by grabbing.
- Increased hip flexion to 2.1 radians for the supported crouch and kept torso lean within its existing joint limit. Reused the two reserved body vectors for recovery pose snapshots; no per-frame CPU pose reads or extra body-buffer storage.
- Added six motion scenarios, fall-heading and floor-support checks, and paired walking/recovery MP4 capture.

## 0.11.1 / V11 (local dummy refinement)

- Resculpted the face as continuous brow, cheek, nose and lip relief, replacing the separate rounded features. Tapered the chest, shaped the pelvis around the leg openings and added a flexible tan abdominal boot.
- Rounded and seated the shoulder joints, covered the fronts of the knees, added finger creases and increased sampling around the limb and joint contours.
- Adjusted shell depth to reduce internal outline artifacts. Added reach, crouch and neck/waist flex inspection views and a separate 0.11.0/0.11.1 MP4 comparison.
- The offline builder now checks the combined JavaScript syntax before writing the generated game.

## 0.11.0 / V11 (local SDF dummy candidate)

- Replaced the mannequin render meshes with an original SDF crash-test dummy, iterated through six multi-angle reviews. Added molded anatomy, fingers and thumbs, articulated joint housings, metal fasteners, rubber bellows and shoes, seam lines, a rear service panel, and crash-test targets.
- Adapted CRITTERS' smooth unions, SDF gradient projection and offset shell rendering. Indexed surface nets generate the mesh once at startup; a shared mesh and outline are skinned directly from the 15 resident GPU physics bodies for every dummy.
- Added flexible two-bone neck/waist weights while preserving the existing physics, picking, walking, persistent skin pigment, and 120 Hz solver.
- Added topology and skin-weight audits, six-view screenshots, and before/after MP4 capture. Fixed heel boundary holes and finger pinches found during close-up inspection.

## 0.10.0 / V10 (local art candidate)

- Added alternating world-planted feet, leg IK using the physical joint anchors, smooth acceleration and turning, arm swing, and a staged rise during recovery. Bounded pose motors still drive the 120 Hz rigid-body solver.
- Fixed zero normal components being replaced by mesh-packing defaults. Paint now projects through each receiver's world-space basis, with 160 texels per metre on both axes across all 75 room surfaces.
- Fixed wall-drip widths being interpreted as approximately 0.6 metres; added narrow, uneven rivulets.
- Added a procedural amber/teal lab, mannequin materials, signage, floor station markings, consistent hazard stripes and surface grain.
- Added hardware gait/mapping checks and repeatable 1080p MP4 captures. Performance profiles run separately from video encoding.

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
