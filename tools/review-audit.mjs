// Preserve compact evidence for the complete local art and motion pass.
import {readFile,writeFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const hash=async p=>createHash('sha256').update(await readFile(p)).digest('hex');
const buildSHA256=await hash('index.html');
const model=await read('tools/out/dummy-pass/final-v14/inspect.json');
const motion=await read('tools/out/motion-pass/final-v14/motion.json');
const art=await read('tools/out/art-pass/final-v14/art-gauntlet.json');
const tools=await read('tools/out/presentation-pass/final-v14/inspection.json');
const chrome=await read('tools/out/compute-chrome/verification.json');
const firefox=await read('tools/out/compute-firefox/verification.json');
const native=await read('tools/out/compute-native-chrome/verification.json');
const capture=await read('tools/out/art-pass/final-v14/capture.json');
const finish=await read('tools/out/dummy-pass/finish/capture.json');
const full=await read('tools/out/dummy-pass/full-review/capture.json');
const review=await read('tools/out/review-v14/review.json');
for(const r of [model,motion,art,tools,chrome,firefox,native,capture,finish,full,review])assert(r.result.startsWith('COMPLETE'),r.result);
assert.equal(motion.cases.length,6);assert.equal(art.surfaces.length,75);
assert(art.surfaces.every(s=>s.pixels.every((p,i)=>Math.abs(p-s.metres[i]*160)<=.500001)));
assert.equal(model.geometry.bones.length,15);
for(const key of ['badWeights','inverted','degenerate','nonManifoldEdges'])assert.equal(model.geometry[key],0);
for(const file of ['tools/out/dummy-pass/final-v14/build.html','tools/out/motion-pass/final-v14/build.html'])assert.equal(buildSHA256,await hash(file));
for(const value of [art.buildSHA256,capture.buildSHA256,finish.builds.find(b=>b.label==='after').sha256,full.builds.find(b=>b.label==='after').sha256,review.buildHashes.after])assert.equal(buildSHA256,value);
assert(native.profiles.every(p=>p.report.version==='0.14.0'));
const archiveHashes={};
for(const [path,expected]of [['versions/smear_v8.9_cpu.html','cff878b51eec0db9e3874f99c9fdcdbd6b9179d2f03e6374ef4726d89f1e5c44'],['versions/dragmark_v7.html','4dfe17e606b18ce7471f176b4c2afa0229b2f32e60b5b88c2971ebc6a75bc41f']]){archiveHashes[path]=await hash(path);assert.equal(archiveHashes[path],expected);}
const png=await readFile('og-image.png');assert.equal(png.readUInt32BE(16),1200);assert.equal(png.readUInt32BE(20),630);
const shader=await readFile('gpu/compute.wgsl','utf8'),runtime=await readFile('gpu/runtime.js','utf8');
assert(shader.includes('it<9u'));assert(shader.includes('j<54u'));assert(shader.includes('%900u'));assert(shader.includes('1.0/120.0'));assert(runtime.includes(':336,height=surface?'));assert(runtime.includes(':224;'));
const densities=art.surfaces.flatMap(s=>s.density);
const receipt={
 version:'0.14.0',status:'local candidate; not published',verifiedAt:new Date().toISOString(),build:{sha256:buildSHA256,bytes:(await stat('index.html')).size},
 model:{vertices:model.model.vertices,triangles:model.model.triangles,bootMS:model.bootMS,...model.geometry},
 motion:motion.cases.map(({samples,...c})=>c),
 mapping:{receivers:art.surfaces.length,targetTexelsPerMetre:160,rounding:'nearest whole texture pixel on each axis',actualDensityRange:[Math.min(...densities),Math.max(...densities)],skin:[336,224],gait:art.gait},
 checks:{chrome:chrome.checks,firefox:firefox.checks,native:native.checks,presentation:tools.checks,art:art.checks},
 profiles:native.profiles.map(p=>({label:p.label,fps:p.report.summary.fps,cpu:p.report.summary.workPercentileMs,gpu:p.report.compute.summary,ticksPerSecond:p.ticksPerSecond,audit:p.audit})),
 videos:[{file:'tools/out/review-v14/00-full-dummy-transformation.mp4',before:'0.10.0',after:'0.14.0',seconds:34,size:[1920,1080],fps:30},{file:'tools/out/review-v14/01-smear-whole-art-pass.mp4',before:'0.9.1',after:'0.14.0',seconds:38,size:[1920,600],fps:30},{file:'tools/out/review-v14/02-dummy-finish.mp4',before:'0.13.0',after:'0.14.0',seconds:34,size:[1920,1080],fps:30},{file:'tools/out/review-v14/03-walking-recovery-v12.mp4',before:'0.11.1',after:'0.12.0',seconds:28,note:'Earlier gait comparison retained. The unchanged motion solver was retested on V14.'}],
 archiveHashes,ogImage:{path:'og-image.png',size:[1200,630]},
 notes:['Original indexed SDF skin and offset shell, with all 15 physics bodies used as a GPU skinning rig. Neck and waist have blended weights.','Molded fingers move with their hand body. SDF extraction happens at startup; there is no per-frame raymarching or re-meshing.','Hand-support tests measure position near the floor, not measured support forces.','Performance is presentation-capped on the local hardware, not maximum uncapped throughput.']
};
await writeFile('docs/qa/dummy-v14.json',JSON.stringify(receipt,null,2)+'\n');
const requirements=[
 {requirement:'Improve the ragdoll walking and get-up motion',status:'verified',evidence:['tools/out/motion-pass/final-v14/motion.json','tools/out/review-v14/03-walking-recovery-v12.mp4'],finding:'Six cases pass; walking arm/leg correlation -0.943. All recovery cases finish upright, including grab interruption.'},
 {requirement:'Heavy game art pass with more stylization',status:'verified',evidence:['gpu/art.js','gpu/render.wgsl','gpu/tools.js','tools/out/review-v14/01-smear-whole-art-pass.mp4'],finding:'Original and final rendered gameplay were visually reviewed: amber/teal lab, station markings, hazard edges, shell silhouette, remodeled tools and material finish.'},
 {requirement:'Correct cube mapping and texel density on all surfaces',status:'verified',evidence:['tools/out/art-pass/final-v14/art-gauntlet.json'],finding:'All 75 room paint receivers target 160 texels/metre on both axes, to the nearest whole texture pixel. Native paint hits pass on wall, all bench faces, barrier and tilted ramp. Oversized wall bars are removed.'},
 {requirement:'Fully figured, rigged, SDF-based crash-test dummy using CRITTERS shell techniques',status:'verified',evidence:['gpu/dummy.js','gpu/render.wgsl','THIRD_PARTY_NOTICES.md','tools/out/dummy-pass/final-v14/inspect.json','tools/out/review-v14/dummy-front.png','tools/out/review-v14/dummy-head.png','tools/out/review-v14/dummy-hand.png','tools/out/review-v14/dummy-crouch.png','tools/out/review-v14/02-dummy-finish.mp4'],finding:'SDF sculpt includes face/ears, chest, pelvis, hands/fingers, limbs, covered joints, bellows, shoes, fasteners and calibration targets. Smooth unions, gradient projection and offset shell follow the CRITTERS approach. Closed geometry with 15-bone normalized skinning passes rest, reach, crouch, neck/waist flex and live rig inspection.'},
 {requirement:'Gameplay/performance gauntlet and before/after MP4s',status:'verified',evidence:['docs/qa/dummy-v14.json','tools/out/review-v14/review.json','tools/out/dummy-pass/finish/capture.json'],finding:'Chrome 10/10, Firefox 10/10, native GPU 7/7, art 3/3, tool input 5/5 and six motion scenarios. Both new H.264 comparisons decode at 30 fps and were inspected.'},
 {requirement:'Preserve gameplay, GPU residency and technical invariants',status:'verified',evidence:['gpu/compute.wgsl','gpu/runtime.js','docs/qa/dummy-v14.json'],finding:'120 Hz solver, nine iterations, 900-drop pool, 54-bristle smears and original skin/floor resolution retained. Runtime audits show only asynchronous telemetry/timing reads, no normal-play body/pigment reads and no WebGL context. Archived V7/V8.9 hashes and 1200x630 OG image verified.'},
 {requirement:'Open the comparison folder in Explorer (supersedes VLC request)',status:'pending Explorer confirmation',evidence:['tools/out/review-v14/'],finding:'Two current comparison videos, the earlier gait comparison and close-up renders are collected in one folder.'}
];
requirements[3].evidence.push('tools/out/review-v14/00-full-dummy-transformation.mp4');
requirements[4].evidence.push('tools/out/dummy-pass/full-review/capture.json');
requirements[4].finding='Chrome 10/10, Firefox 10/10, native GPU 7/7, art 3/3, tool input 5/5 and six motion scenarios. All three current H.264 comparisons decode at 30 fps and were visually inspected.';
try {
 const explorer=await read('tools/out/review-v14/explorer.json');
 if(explorer.selected==='00-full-dummy-transformation.mp4'&&explorer.folder.replaceAll('\\','/').toLowerCase().endsWith('/smear/tools/out/review-v14')){
  Object.assign(requirements.at(-1),{status:'verified',evidence:['tools/out/review-v14/explorer.json'],finding:'Explorer opened the review folder with the full dummy comparison MP4 selected. Three current comparisons, the earlier gait comparison and close-up renders are collected here.'});
 }
}catch(error){if(error.code!=='ENOENT')throw error;}
for(const video of receipt.videos)assert((await stat(video.file)).size>0);
await writeFile('docs/qa/art-pass-audit.json',JSON.stringify({objective:'make smear good',buildSHA256,version:'0.14.0',requirements,publication:'No deployment requested; live remains unchanged.'},null,2)+'\n');
const owned=[model,motion,art,tools,chrome,firefox,native,capture].map(r=>r.browserProfile).filter(Boolean);
for(const label of ['finish-01','finish-02','finish-03','finish-04'])owned.push((await read('tools/out/dummy-pass/'+label+'/inspect.json')).browserProfile);
owned.push(...finish.browsers.map(b=>b.profile));
owned.push(...full.browsers.map(b=>b.profile));
await writeFile('tools/out/review-v14/owned-profiles.json',JSON.stringify([...new Set(owned)],null,2));
console.log(JSON.stringify({version:receipt.version,build:receipt.build,checks:Object.fromEntries(Object.entries(receipt.checks).map(([k,v])=>[k,v.length])),motion:receipt.motion.length,densityRange:receipt.mapping.actualDensityRange},null,2));
