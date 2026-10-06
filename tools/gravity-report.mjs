// Bind V17 measurements and review media to the exact tested offline build.
import assert from 'node:assert/strict';
import {readFile,writeFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const hash=b=>createHash('sha256').update(b).digest('hex');
const build=await readFile('index.html'),buildSHA256=hash(build),buildTime=(await stat('index.html')).mtimeMs;
const version=JSON.parse(await readFile('package.json')).version;
assert.equal(version,'0.17.0');
const baseline=JSON.parse(await readFile('docs/qa/film-v16.json'));
const receipt={version,status:'verified release candidate',verifiedAt:new Date().toISOString(),buildSHA256,buildBytes:build.length,checks:{},evidence:[],nativeProfiles:[],contact:[],gravity:[]};
for(const browser of ['chrome','firefox']){
 for(const [name,path] of [
  ['gameplay',`tools/out/compute-${browser}/verification.json`],
  ['native',`tools/out/compute-native-${browser}/verification.json`],
  ['wet',`tools/out/wet-pass/final-v17${browser==='firefox'?'-firefox':''}/verification.json`],
  ['gravity',`tools/out/film-pass/final-v17${browser==='firefox'?'-firefox':''}/verification.json`]
 ]){
  const bytes=await readFile(path),r=JSON.parse(bytes);assert(r.result.startsWith('COMPLETE'),path);assert(Date.parse(r.startedAt)>buildTime,path+' predates the build');
  if(r.buildSHA256)assert.equal(r.buildSHA256,buildSHA256,path);
  receipt.checks[browser+'-'+name]=r.checks;receipt.evidence.push({path,sha256:hash(bytes),startedAt:r.startedAt});
  if(name==='native'){
   assert.deepEqual(r.viewport,[3000,1800]);assert(r.audio.enabled&&r.audio.state==='running');
   for(const p of r.profiles){assert.equal(p.audit.canvasReads,0);assert.equal(p.audit.webGLContexts,0);assert(!Object.keys(p.audit.reads).some(k=>/body inspection|pigment/.test(k)));receipt.nativeProfiles.push({browser,workload:p.label,fps:p.report.summary.fps,cpuP99MS:p.report.summary.workPercentileMs.p99,gpu:p.report.compute.summary,ticksPerSecond:p.ticksPerSecond,reads:p.audit.reads});}
  }
  if(name==='wet')receipt.contact.push({browser,dryUnchanged:r.dry.before.hash===r.dry.after.hash,pigmentAlphaChangeFraction:r.wet.after.sum/r.wet.before.sum-1,carriedPixels:r.wet.after.carried,remainingCoat:r.coatingPool.remainingCoat});
  if(name==='gravity'){
   const previous=baseline.film.find(f=>f.browser===browser).contact;
   const travel=r.contact.after.centroid[0]-r.contact.start.centroid[0],oldTravel=previous.after.centroid[0]-previous.start.centroid[0];
   receipt.gravity.push({browser,
    contact:{centroidTravelMetres:travel,v16TravelMetres:oldTravel,travelRatio:travel/oldTravel,coatFromZero:r.contact.wet,filmAndCoatSupplyFraction:(r.contact.after.total+r.contact.wet*.02)/r.contact.start.total},
    wall:{descentIn3Seconds:r.wall.middle.centroid[1]-r.wall.start.centroid[1],floorFractionAfter15Seconds:r.wall.floor.total/r.wall.start.total,supplyChangeFraction:(r.wall.total.total+r.wall.airborne.volume)/r.wall.start.total-1},
    edge:{floorFractionAfter6Seconds:r.edge.floor.total/r.edge.start.total,supplyChangeFraction:(r.edge.total.total+r.edge.airborne.volume)/r.edge.start.total-1,emitted:r.edge.airborne.runoff,landed:r.edge.airborne.landed},
    fullParticlePool:r.saturated,ballistics:r.ballistics,shedding:r.shedding,resources:r.resources,
    isolatedPool:r.pool,cadence:r.cadence,slope:r.slope
   });
  }
 }
}
receipt.checkCount=Object.values(receipt.checks).reduce((n,list)=>n+list.length,0);assert.equal(receipt.checkCount,78);
const mediaRoot='tools/out/gravity-pass/recordings',capture=JSON.parse(await readFile(mediaRoot+'/capture.json'));assert(capture.result.startsWith('COMPLETE'));assert.equal(capture.builds.find(b=>b.label==='after').sha256,buildSHA256);assert.equal(capture.builds.find(b=>b.label==='before').sha256,baseline.buildSHA256);
receipt.media={capture:mediaRoot+'/capture.json',builds:capture.builds,clips:capture.clips,files:[]};
for(const name of ['before/gravity-before.mp4','after/gravity-after.mp4',capture.comparison]){
 const path=mediaRoot+'/'+name,b=await readFile(path);const probe=spawnSync('ffprobe',['-v','error','-show_entries','format=duration:stream=codec_name,width,height,r_frame_rate','-of','json',path],{encoding:'utf8',windowsHide:true});assert.ifError(probe.error);assert.equal(probe.status,0,probe.stderr);const info=JSON.parse(probe.stdout);assert.equal(info.streams[0].codec_name,'h264');assert(Math.abs(Number(info.format.duration)-40)<.1);receipt.media.files.push({path,sha256:hash(b),bytes:b.length,...info});
}
receipt.scope=[
 'Surface film is a stylized finite field, not volumetric fluid dynamics. Gravity, contact momentum and droplet simulation run on the GPU.',
 'Measured supply conservation covers isolated world-receiver fixtures and carried runoff. Wounds, abrasion, skin paint and body interception do not form a globally conservative fluid solver.',
 'World-impact runoff returns carried liquid once. Receiver edges detach drops; adjacent box faces do not share a continuous film grid.',
 'Two velocity banks add 8.10 MiB over V16. Film advances at at most 1/60 second per substep. Existing 120 Hz rig physics, 900 particles, 54 bristles and pigment resolution remain.',
 'Native profiles are presentation-capped at 60 Hz, measured separately from video recording with audio running and browser output muted.'
];
receipt.media.reviewFrames=[];
for(const [name,seconds] of [['wall',7],['edge',17],['smear',27],['fling',36]]){
 const path=mediaRoot+'/'+name+'-review.png';receipt.media.reviewFrames.push({path,seconds,sha256:hash(await readFile(path))});
}
for(const [path,expected] of [['versions/smear_v8.9_cpu.html','cff878b51eec0db9e3874f99c9fdcdbd6b9179d2f03e6374ef4726d89f1e5c44'],['versions/dragmark_v7.html','4dfe17e606b18ce7471f176b4c2afa0229b2f32e60b5b88c2971ebc6a75bc41f']])assert.equal(hash(await readFile(path)),expected);
assert.equal(hash(await readFile('index.html')),buildSHA256);
await writeFile('docs/qa/gravity-v17.json',JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify({result:'COMPLETE gravity pass evidence audit',version,buildSHA256,checks:receipt.checkCount,media:receipt.media.files.map(f=>f.path)},null,2));
