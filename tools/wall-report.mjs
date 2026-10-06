import assert from 'node:assert/strict';
import {readFile,writeFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const hash=b=>createHash('sha256').update(b).digest('hex');
const build=await readFile('index.html'),buildSHA256=hash(build),buildTime=(await stat('index.html')).mtimeMs;
const version=JSON.parse(await readFile('package.json')).version;assert.equal(version,'0.18.0');
const baseline=JSON.parse(await readFile('tools/out/wall-pass/before/verification.json'));
const v17=JSON.parse(await readFile('docs/qa/gravity-v17.json'));assert.equal(baseline.buildSHA256,v17.buildSHA256);
const receipt={version,status:'verified release candidate',verifiedAt:new Date().toISOString(),buildSHA256,buildBytes:build.length,checks:{},evidence:[],nativeProfiles:[],walls:[],film:[],baseline:{buildSHA256:baseline.buildSHA256,impact:baseline.impact,three:baseline.three,fifteen:baseline.fifteen,floor:baseline.floor}};
for(const browser of ['chrome','firefox']){
 for(const [name,path] of [
  ['wall',`tools/out/wall-pass/final-v18${browser==='firefox'?'-firefox':''}/verification.json`],
  ['film',`tools/out/film-pass/final-v18${browser==='firefox'?'-firefox':''}/verification.json`],
  ['wet',`tools/out/wet-pass/final-v18${browser==='firefox'?'-firefox':''}/verification.json`],
  ['gameplay',`tools/out/compute-${browser}/verification.json`],
  ['native',`tools/out/compute-native-${browser}/verification.json`]
 ]){
  const bytes=await readFile(path),r=JSON.parse(bytes);assert(r.result.startsWith('COMPLETE'),path);assert(Date.parse(r.startedAt)>buildTime,path+' predates the build');if(r.buildSHA256)assert.equal(r.buildSHA256,buildSHA256,path);
  receipt.checks[browser+'-'+name]=r.checks;receipt.evidence.push({path,sha256:hash(bytes),startedAt:r.startedAt});
  if(name==='wall'){assert(r.audio.enabled&&r.audio.state==='running');receipt.walls.push({browser,impact:r.impact,three:r.three,fifteen:r.fifteen,floor:r.floor,dry:r.dry,opaqueImpactRatio:r.impact.opaque/baseline.impact.opaque,impactWidthRatio:r.impact.width/baseline.impact.width,floorPigmentChange:r.floor.alpha/baseline.floor.alpha-1,floorLiquidChange:r.floor.mobile/baseline.floor.mobile-1});}
  if(name==='film'){receipt.film.push({browser,wallDescent3Seconds:r.wall.middle.centroid[1]-r.wall.start.centroid[1],v17Descent3Seconds:v17.gravity.find(g=>g.browser===browser).wall.descentIn3Seconds,wallRunoffWindowSeconds:r.wall.elapsedSeconds,floorFraction:r.wall.floor.total/r.wall.start.total,contactTravel:r.contact.after.centroid[0]-r.contact.start.centroid[0],resources:r.resources});}
  if(name==='native'){
   assert.deepEqual(r.viewport,[3000,1800]);assert(r.audio.enabled&&r.audio.state==='running');
   for(const p of r.profiles){assert.equal(p.audit.canvasReads,0);assert.equal(p.audit.webGLContexts,0);assert(!Object.keys(p.audit.reads).some(k=>/body inspection|pigment/.test(k)));receipt.nativeProfiles.push({browser,workload:p.label,fps:p.report.summary.fps,cpuP99MS:p.report.summary.workPercentileMs.p99,gpu:p.report.compute.summary,ticksPerSecond:p.ticksPerSecond,reads:p.audit.reads});}
  }
 }
}
receipt.checkCount=Object.values(receipt.checks).reduce((n,list)=>n+list.length,0);assert.equal(receipt.checkCount,90);
const mediaRoot='tools/out/wall-pass/recordings',capture=JSON.parse(await readFile(mediaRoot+'/capture.json'));assert(capture.result.startsWith('COMPLETE'));assert.equal(capture.builds.find(b=>b.label==='after').sha256,buildSHA256);assert.equal(capture.builds.find(b=>b.label==='before').sha256,baseline.buildSHA256);
receipt.media={capture:mediaRoot+'/capture.json',builds:capture.builds,clips:capture.clips,files:[],reviewFrames:[]};
for(const name of ['before/wall-before.mp4','after/wall-after.mp4',capture.comparison]){
 const path=mediaRoot+'/'+name,b=await readFile(path);const probe=spawnSync('ffprobe',['-v','error','-show_entries','format=duration:stream=codec_name,width,height,r_frame_rate','-of','json',path],{encoding:'utf8',windowsHide:true});assert.ifError(probe.error);assert.equal(probe.status,0,probe.stderr);const info=JSON.parse(probe.stdout);assert.equal(info.streams[0].codec_name,'h264');assert(Math.abs(Number(info.format.duration)-24)<.1);receipt.media.files.push({path,sha256:hash(b),bytes:b.length,...info});
}
for(const [name,seconds] of [['impact',.6],['retained',8],['drip-early',14],['drip-late',21]]){const path=mediaRoot+'/'+name+'-review.png';receipt.media.reviewFrames.push({path,seconds,sha256:hash(await readFile(path))});}
receipt.scope=[
 'Wall slams are actual 15-body GPU collisions from an explicitly uploaded matching pose, velocity and coating. Normal gameplay does not upload poses or download body/paint buffers.',
 'The wall impact effect requires existing coating, consumes it, and leaves most of the mark as persistent pigment. It does not manufacture wounds on an uncoated body.',
 'The wall effect has a per-body 0.28-second cooldown. Existing floor contact, airborne flight and pool transport code paths retain their parameters.',
 'Near-vertical film uses six times the viscous drag. The smaller mobile fraction and persistent pigment preserve the impact mark; thick liquid still drains.',
 'The finite film is a stylized surface simulation, not a globally conservative volumetric fluid solver. No new GPU buffers were added.',
 'Native profiles are presentation-capped at 60 Hz with active audio and muted browser output, recorded separately from the comparison video.'
];
for(const [path,expected] of [['versions/smear_v8.9_cpu.html','cff878b51eec0db9e3874f99c9fdcdbd6b9179d2f03e6374ef4726d89f1e5c44'],['versions/dragmark_v7.html','4dfe17e606b18ce7471f176b4c2afa0229b2f32e60b5b88c2971ebc6a75bc41f']])assert.equal(hash(await readFile(path)),expected);
assert.equal(hash(await readFile('index.html')),buildSHA256);await writeFile('docs/qa/wall-v18.json',JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify({result:'COMPLETE wall splat release evidence audit',version,buildSHA256,checks:receipt.checkCount,media:receipt.media.files.map(f=>f.path)},null,2));
