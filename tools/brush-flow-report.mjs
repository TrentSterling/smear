import assert from 'node:assert/strict';
import {readFile,writeFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const hash=b=>createHash('sha256').update(b).digest('hex');
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const build=await readFile('index.html'),buildSHA256=hash(build),buildTime=(await stat('index.html')).mtimeMs;
const version=(await read('package.json')).version;assert.equal(version,'0.22.0');
const baseline=await read('tools/out/brush-flow-pass/contact-before/verification.json');assert(baseline.result.startsWith('COMPLETE'));assert.equal(baseline.buildSHA256,(await read('docs/qa/rivulets-v20.json')).buildSHA256);
const receipt={version,status:'verified release candidate',verifiedAt:new Date().toISOString(),buildSHA256,buildBytes:build.length,checks:{},evidence:[],contacts:[],walls:[],nativeProfiles:[],closedSupply:[]};
for(const browser of ['chrome','firefox']){
 const suffix=browser==='firefox'?'-firefox':'';
 for(const [name,path]of [
  ['brushFlow',`tools/out/brush-flow-pass/final-v22${suffix}/verification.json`],
  ['contact',`tools/out/wall-contact-pass/final-v22${suffix}/verification.json`],
  ['wall',`tools/out/wall-pass/final-v22${suffix}/verification.json`],
  ['rivulets',`tools/out/rivulet-pass/final-v22${suffix}/verification.json`],
  ['film',`tools/out/film-pass/final-v22${suffix}/verification.json`],
  ['wet',`tools/out/wet-pass/final-v22${suffix}/verification.json`],
  ['gameplay',`tools/out/compute-${browser}/verification.json`],
  ['native',`tools/out/compute-native-${browser}/verification.json`],
  ['wallNative',`tools/out/compute-native-wall-${browser}/verification.json`]
 ]){
  const bytes=await readFile(path),r=JSON.parse(bytes);assert(r.result.startsWith('COMPLETE'),path);assert(Date.parse(r.startedAt)>buildTime,path+' predates build');if(r.buildSHA256)assert.equal(r.buildSHA256,buildSHA256,path);
  receipt.checks[browser+'-'+name]=r.checks;receipt.evidence.push({path,sha256:hash(bytes),startedAt:r.startedAt});
  if(name==='contact'){
   const scenes={};for(const mode of ['press','drag','block']){const a=r.scenes[mode][1],b=baseline.scenes[mode][1];scenes[mode]={twoSecondsAfterContact:{before:b.patch,after:a.patch,opaqueRatio:a.patch.opaque/b.patch.opaque,connectedRatio:a.patch.largest/b.patch.largest},samples:r.scenes[mode]};}
   receipt.contacts.push({browser,scenes,dry:r.scenes.dry.at(-1)});
  }
  if(name==='brushFlow'){receipt.brushFlow??=[];receipt.brushFlow.push({browser,samples:r.samples.map(({pigment,...sample})=>sample),descent3Seconds:r.samples[0].cy-r.samples[1].cy,descent15Seconds:r.samples[0].cy-r.samples[3].cy});}
  if(name==='wet')receipt.closedSupply.push({browser,...r.wallSupply,initialCoat:.95,initialVolume:.019});
  if(name==='wall')receipt.walls.push({browser,impact:r.impact,three:r.three,fifteen:r.fifteen,floor:r.floor,descent3Seconds:r.impact.centroidY-r.three.centroidY,centralPigmentRetained:r.fifteen.coreAlpha/r.impact.coreAlpha});
  if(name==='film'){assert.equal(r.resources.filmBytes,29719760);assert.equal(r.resources.wetBytes,30660560);receipt.resources=r.resources;}
  if(name==='native'||name==='wallNative'){
   assert.deepEqual(r.viewport,[3000,1800]);assert(r.audio.enabled&&r.audio.state==='running');
   for(const p of r.profiles){assert.equal(p.audit.canvasReads,0);assert.equal(p.audit.webGLContexts,0);assert(!Object.keys(p.audit.reads).some(k=>/body inspection|pigment/.test(k)));receipt.nativeProfiles.push({browser,workload:p.label,fps:p.report.summary.fps,cpuP99MS:p.report.summary.workPercentileMs.p99,gpu:p.report.compute.summary,ticksPerSecond:p.ticksPerSecond});}
  }
 }
}
const firstFirefox=await readFile('tools/out/brush-flow-pass/firefox-native-first-run.json');receipt.rechecks=[{path:'tools/out/brush-flow-pass/firefox-native-first-run.json',sha256:hash(firstFirefox),result:JSON.parse(firstFirefox).result,error:JSON.parse(firstFirefox).error,reason:'The first native Firefox floor-drag timing run hit CPU p99 5 ms. Its receipt is retained; the final native run and separate wall-contact profiles are audited below.'}];
receipt.checkCount=Object.values(receipt.checks).reduce((n,c)=>n+c.length,0);
const root='tools/out/brush-flow-pass/recordings',capture=await read(root+'/capture.json');assert(capture.result.startsWith('COMPLETE'));assert.equal(capture.builds.find(b=>b.label==='before').sha256,(await read('docs/qa/wall-contact-v21.json')).buildSHA256);assert.equal(capture.builds.find(b=>b.label==='after').sha256,buildSHA256);
receipt.media={capture:root+'/capture.json',builds:capture.builds,clips:capture.clips,files:[]};
for(const name of ['before/wall-before.mp4','after/wall-after.mp4',capture.comparison]){
 const path=root+'/'+name,b=await readFile(path),probe=spawnSync('ffprobe',['-v','error','-show_entries','format=duration:stream=codec_name,width,height,r_frame_rate','-of','json',path],{encoding:'utf8',windowsHide:true});assert.ifError(probe.error);assert.equal(probe.status,0,probe.stderr);const info=JSON.parse(probe.stdout);assert.equal(info.streams[0].codec_name,'h264');assert(Math.abs(Number(info.format.duration)-46)<.1);receipt.media.files.push({path,sha256:hash(b),bytes:b.length,...info});
}
receipt.sources={};for(const path of ['gpu/contact.wgsl','gpu/compute.wgsl','gpu/film.wgsl','gpu/render.wgsl','tools/brush-flow-fixture.mjs','tools/brush-flow-verify.mjs','tools/wall-contact-fixture.mjs','tools/wall-contact-verify.mjs','tools/wet-verify.mjs'])receipt.sources[path]=hash(await readFile(path));
receipt.scope=[
 'Removes the V21 oval contact-pool stamp and the soft ellipse fill behind wall bristles. Actual impact prints require incoming normal speed above 1.4 m/s; slow brushing cannot fire them.',
 'Finite coating volume deposits directly along the existing 54 material bristles at a 25 ms cadence. Half wets those tracks; half gathers at two irregular points on the lower contact edge. No alpha pool shape is drawn.',
 'The existing V20 film gravity, pinning, buffers and rendering remain unchanged. Film and pigment are inspected together for coverage; raw pigment opacity is no longer treated as the sole art quality metric.',
 'The integrated test uses a real torso surface-point grab followed by source removal only for explicit drainage measurement. The comparison videos use actual release with the dummy remaining simulated for fifteen more seconds.',
 'The original V21 opaque-pixel ratio gate was replaced because maximizing solid fill favored the rejected dabs. Coverage gates still require a connected body-sized wet mark and sustained coverage, alongside separate conservation, no-false-impact and drainage checks.',
 'Preserves floor brush behavior, 120 Hz physics, 900 particles, 54 bristles and the normal-play no-body-or-pigment-readback rule. Native performance is recorded separately from MP4 capture.',
 'This is an art-directed gameplay approximation. Visual brush character is reviewed in the full comparison; passing numerical gates alone does not establish aesthetic quality.'
];
for(const [path,expected]of [['versions/smear_v8.9_cpu.html','cff878b51eec0db9e3874f99c9fdcdbd6b9179d2f03e6374ef4726d89f1e5c44'],['versions/dragmark_v7.html','4dfe17e606b18ce7471f176b4c2afa0229b2f32e60b5b88c2971ebc6a75bc41f']])assert.equal(hash(await readFile(path)),expected);
await writeFile('docs/qa/brush-flow-v22.json',JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify({result:'COMPLETE V22 integrated brush and drainage evidence audit',version,buildSHA256,checks:receipt.checkCount,media:receipt.media.files.map(f=>f.path)},null,2));
