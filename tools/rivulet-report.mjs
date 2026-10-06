import assert from 'node:assert/strict';
import {readFile,writeFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const hash=b=>createHash('sha256').update(b).digest('hex');
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const build=await readFile('index.html'),buildSHA256=hash(build),buildTime=(await stat('index.html')).mtimeMs;
const version=(await read('package.json')).version;assert.equal(version,'0.20.0');
const previous=await read('docs/qa/wall-motion-v19.json');
const receipt={version,status:'verified release candidate',verifiedAt:new Date().toISOString(),buildSHA256,buildBytes:build.length,checks:{},evidence:[],walls:[],rivulets:[],film:[],nativeProfiles:[]};
for(const browser of ['chrome','firefox']){
 const suffix=browser==='firefox'?'-firefox':'';
 for(const [name,path] of [
  ['rivulets',`tools/out/rivulet-pass/final-v20${suffix}/verification.json`],
  ['wall',`tools/out/wall-pass/final-v20${suffix}/verification.json`],
  ['film',`tools/out/film-pass/final-v20${suffix}/verification.json`],
  ['wet',`tools/out/wet-pass/final-v20${suffix}/verification.json`],
  ['gameplay',`tools/out/compute-${browser}/verification.json`],
  ['native',`tools/out/compute-native-${browser}/verification.json`]
 ]){
  const bytes=await readFile(path),r=JSON.parse(bytes);assert(r.result.startsWith('COMPLETE'),path);assert(Date.parse(r.startedAt)>buildTime,path+' predates build');if(r.buildSHA256)assert.equal(r.buildSHA256,buildSHA256,path);
  receipt.checks[browser+'-'+name]=r.checks;receipt.evidence.push({path,sha256:hash(bytes),startedAt:r.startedAt});
  if(name==='rivulets'){
   const compact=points=>points.map(({crossSection,...p})=>p);
   receipt.rivulets.push({browser,band:compact(r.band),beads:compact(r.beads),smallBeadDescent3Seconds:r.beads[0].halves[0].y-r.beads[2].halves[0].y,heavyBeadDescent3Seconds:r.beads[0].halves[1].y-r.beads[2].halves[1].y,bandMassError8Seconds:r.band[3].total/r.band[0].total-1,bandMassError15Seconds:r.band[4].total/r.band[0].total-1,cadence:r.cadence,shear:r.shear});
  }
  if(name==='wall'){
   assert(r.audio.enabled&&r.audio.state==='running');const before=previous.walls.find(w=>w.browser===browser);
   receipt.walls.push({browser,impact:r.impact,three:r.three,fifteen:r.fifteen,floor:r.floor,dry:r.dry,descent3Seconds:r.impact.centroidY-r.three.centroidY,descent15Seconds:r.impact.centroidY-r.fifteen.centroidY,centralPigmentRetained:r.fifteen.coreAlpha/r.impact.coreAlpha,floorLiquidChange:r.floor.mobile/before.floor.mobile-1,floorPigmentChange:r.floor.alpha/before.floor.alpha-1});
  }
  if(name==='film'){
   assert.equal(r.resources.filmBytes,29719760);assert.equal(r.resources.wetBytes,30660560);
   receipt.film.push({browser,wallDescent3Seconds:r.wall.middle.centroid[1]-r.wall.start.centroid[1],wallRunoffWindowSeconds:r.wall.elapsedSeconds,floorFraction:r.wall.floor.total/r.wall.start.total,contactTravel:r.contact.after.centroid[0]-r.contact.start.centroid[0],resources:r.resources});
  }
  if(name==='native'){
   assert.deepEqual(r.viewport,[3000,1800]);assert(r.audio.enabled&&r.audio.state==='running');
   for(const p of r.profiles){assert.equal(p.audit.canvasReads,0);assert.equal(p.audit.webGLContexts,0);assert(!Object.keys(p.audit.reads).some(k=>/body inspection|pigment/.test(k)));receipt.nativeProfiles.push({browser,workload:p.label,fps:p.report.summary.fps,cpuP99MS:p.report.summary.workPercentileMs.p99,gpu:p.report.compute.summary,ticksPerSecond:p.ticksPerSecond,reads:p.audit.reads});}
  }
 }
}
receipt.checkCount=Object.values(receipt.checks).reduce((n,c)=>n+c.length,0);assert.equal(receipt.checkCount,106);
const baseline=await read('tools/out/rivulet-pass/before/verification.json');assert.equal(baseline.buildSHA256,previous.buildSHA256);receipt.baseline={buildSHA256:baseline.buildSHA256,band:baseline.band,beads:baseline.beads};
const mediaRoot='tools/out/rivulet-pass/recordings',capture=await read(mediaRoot+'/capture.json');assert(capture.result.startsWith('COMPLETE'));assert.equal(capture.builds.find(b=>b.label==='before').sha256,previous.buildSHA256);assert.equal(capture.builds.find(b=>b.label==='after').sha256,buildSHA256);
receipt.media={capture:mediaRoot+'/capture.json',builds:capture.builds,clips:capture.clips,files:[],reviewFrames:[]};
for(const name of ['before/wall-before.mp4','after/wall-after.mp4',capture.comparison]){
 const path=mediaRoot+'/'+name,b=await readFile(path),probe=spawnSync('ffprobe',['-v','error','-show_entries','format=duration:stream=codec_name,width,height,r_frame_rate','-of','json',path],{encoding:'utf8',windowsHide:true});assert.ifError(probe.error);assert.equal(probe.status,0,probe.stderr);const info=JSON.parse(probe.stdout);assert.equal(info.streams[0].codec_name,'h264');assert(Math.abs(Number(info.format.duration)-56)<.1);receipt.media.files.push({path,sha256:hash(b),bytes:b.length,...info});
}
for(const [name,seconds] of [['impact',.6],['retained',8],['drip-early',14],['drip-late',23],['patch-early',32],['patch-late',39],['beads',55]]){const path=mediaRoot+'/'+name+'-review.png';receipt.media.reviewFrames.push({path,seconds,sha256:hash(await readFile(path))});}
receipt.sources={};for(const path of ['gpu/film.wgsl','gpu/render.wgsl','tools/rivulet-fixture.mjs','tools/rivulet-verify.mjs','tools/wall-fixture.mjs'])receipt.sources[path]=hash(await readFile(path));
receipt.scope=[
 'The wall model combines thickness-dependent mobility, local surface pinning, advancing/receding hysteresis, a wetting potential and curvature regularization. Contact forces can still push the attached liquid.',
 'The shared-edge flux gate reads only snapshot mass and precomputed contact pushes. It does not read the residue bank while that bank is being written.',
 'Surface variation is fixed in two dimensions; neither vertical channels nor time-varying noise are painted over the simulation.',
 'The model is an art-directed partial-wetting approximation on the existing 40 cells/metre film. It is not calibrated blood rheology or a volumetric capillary solver.',
 'The first two video scenes use actual GPU dummy collisions and a timed Spill pulse. The labelled finite-patch and unequal-bead scenes explicitly upload isolated test fields to reveal the flow mechanism.',
 'Floor transport, impact coating allocation, coarse pigment rivulets and ballistic droplet parameters retain their V19 settings. No additional GPU buffers, normal-play paint readbacks or CPU simulation were added.',
 'Native workloads are measured at 3000x1800 with active audio and muted output, separately from recording.'
];
receipt.research=[{title:'A Numerical Model For Partially-wetted Flow Of Thin Liquid Films',url:'https://www.witpress.com/elibrary/wit-transactions-on-engineering-sciences/70/22352',use:'Conceptual reference for partial wetting, contact-line forces and rivulets; no source code copied.'},{title:'Numerical simulation of static and sliding drop with contact angle hysteresis',url:'https://doi.org/10.1016/j.jcp.2009.07.034',use:'Conceptual reference for separate advancing and receding behaviour; no calibrated parameter claim.'}];
for(const [path,expected] of [['versions/smear_v8.9_cpu.html','cff878b51eec0db9e3874f99c9fdcdbd6b9179d2f03e6374ef4726d89f1e5c44'],['versions/dragmark_v7.html','4dfe17e606b18ce7471f176b4c2afa0229b2f32e60b5b88c2971ebc6a75bc41f']])assert.equal(hash(await readFile(path)),expected);
assert.equal(hash(await readFile('index.html')),buildSHA256);await writeFile('docs/qa/rivulets-v20.json',JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify({result:'COMPLETE V20 rivulet evidence audit',version,buildSHA256,checks:receipt.checkCount,media:receipt.media.files.map(f=>f.path)},null,2));
