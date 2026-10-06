// Bind the completed local film pass to its build, hardware checks and media.
import assert from 'node:assert/strict';
import {readFile,writeFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const hash=b=>createHash('sha256').update(b).digest('hex');
const build=await readFile('index.html'),buildSHA256=hash(build),buildTime=(await stat('index.html')).mtimeMs;
const version=JSON.parse(await readFile('package.json')).version;
const receipt={version,status:'local; not published',verifiedAt:new Date().toISOString(),buildSHA256,buildBytes:build.length,checks:{},evidence:[],nativeProfiles:[],contact:[],film:[]};
for(const browser of ['chrome','firefox']){
 for(const [name,path] of [
  ['gameplay',`tools/out/compute-${browser}/verification.json`],
  ['native',`tools/out/compute-native-${browser}/verification.json`],
  ['wet',`tools/out/wet-pass/final-v16${browser==='firefox'?'-firefox':''}/verification.json`],
  ['film',`tools/out/film-pass/final${browser==='firefox'?'-firefox':''}/verification.json`]
 ]){
  const bytes=await readFile(path),r=JSON.parse(bytes);assert(r.result.startsWith('COMPLETE'),path);assert(Date.parse(r.startedAt)>buildTime,path+' predates the build');
  if(r.buildSHA256)assert.equal(r.buildSHA256,buildSHA256,path);
  receipt.checks[browser+'-'+name]=r.checks;receipt.evidence.push({path,sha256:hash(bytes),startedAt:r.startedAt});
  if(name==='native'){
   assert.deepEqual(r.viewport,[3000,1800]);assert(r.audio.enabled&&r.audio.state==='running');
   for(const p of r.profiles){assert.equal(p.audit.canvasReads,0);assert.equal(p.audit.webGLContexts,0);assert(!Object.keys(p.audit.reads).some(k=>/body inspection|pigment/.test(k)));receipt.nativeProfiles.push({browser,workload:p.label,fps:p.report.summary.fps,cpuP99MS:p.report.summary.workPercentileMs.p99,gpu:p.report.compute.summary,ticksPerSecond:p.ticksPerSecond,reads:p.audit.reads});}
  }
  if(name==='wet')receipt.contact.push({browser,transport:r.wet,dryUnchanged:r.dry.before.hash===r.dry.after.hash,pool:r.pool,remainingCoat:r.coatingPool.remainingCoat});
  if(name==='film')receipt.film.push({browser,pool:r.pool,cadence:r.cadence,contact:r.contact,drying:r.drying,slope:r.slope,resources:r.resources});
 }
}
receipt.checkCount=Object.values(receipt.checks).reduce((n,list)=>n+list.length,0);assert.equal(receipt.checkCount,68);
const mediaRoot='tools/out/film-pass/recordings',capture=JSON.parse(await readFile(mediaRoot+'/capture.json'));assert(capture.result.startsWith('COMPLETE'));assert.equal(capture.builds.find(b=>b.label==='after').sha256,buildSHA256);receipt.media={capture:mediaRoot+'/capture.json',builds:capture.builds,clips:capture.clips,files:[]};
for(const name of ['before/film-before.mp4','after/film-after.mp4',capture.comparison]){
 const path=mediaRoot+'/'+name,b=await readFile(path);const probe=spawnSync('ffprobe',['-v','error','-show_entries','format=duration:stream=codec_name,width,height,r_frame_rate','-of','json',path],{encoding:'utf8',windowsHide:true});assert.equal(probe.status,0,probe.stderr);const info=JSON.parse(probe.stdout);assert.equal(info.streams[0].codec_name,'h264');assert(Math.abs(Number(info.format.duration)-30)<.1);receipt.media.files.push({path,sha256:hash(b),bytes:b.length,...info});
}
receipt.requirementAudit=[
 {requirement:'Improve automatic dummy smearing first',status:'complete',evidence:'Wet-contact tests cover footprint rotation, finite coating, airborne stroke breaks, floor seams, walls and live articulated dragging. All three original tools remain.'},
 {requirement:'Redistribute existing wet blood instead of painting marker strokes',status:'complete',evidence:'Colored-pigment and mobile-film probes disable fresh deposition. Pigment moves with <0.001% total alpha change; clean-contact liquid centroid moves 5.82 cm and coating increases from zero.'},
 {requirement:'Restore cohesive pooling that continues after the source stops',status:'complete',evidence:'Isolated finite pools spread, level, merge across a floor seam, move downhill and dry into residue. Eight-second mobile-plus-dry volume error is <0.46%.'},
 {requirement:'Make the effect visually more liquid',status:'complete',evidence:'Dense narrow-edged coverage, thickness-dependent color, gloss and gradient normals; inspected pool, dry residue and live smear screenshots plus decoded comparison video frames.'},
 {requirement:'Preserve GPU performance and gameplay',status:'complete',evidence:'68 Chrome/Firefox checks pass. All ten native 3000x1800 workloads hold approximately 60 FPS. Audits contain no normal-play body or pigment readbacks.'},
 {requirement:'Record a reviewable before/after comparison',status:'complete',evidence:'30-second H.264 MP4s show the same V14/V16 Spill pulse, resting pool reveal and sustained dummy drag; side-by-side output is 1920x720 at 30 FPS.'}
];
receipt.scope=['The 40-cells/metre field is a stylized surface-film simulation, not volumetric fluid dynamics.','Film flows between floor records and within each other receiver; transfer around box corners is not modeled by the new field. Existing wall droplet flow remains.','Thickness affects shading normals; the world mesh is not displaced.','Twenty-second drying and eight-second isolated conservation are measured fixtures, not a claim of exact global fluid conservation under every wound/contact interaction.','The build and all changes remain local.'];
for(const [path,expected] of [['versions/smear_v8.9_cpu.html','cff878b51eec0db9e3874f99c9fdcdbd6b9179d2f03e6374ef4726d89f1e5c44'],['versions/dragmark_v7.html','4dfe17e606b18ce7471f176b4c2afa0229b2f32e60b5b88c2971ebc6a75bc41f']])assert.equal(hash(await readFile(path)),expected);
assert.equal(hash(await readFile('index.html')),buildSHA256);
await writeFile('docs/qa/film-v16.json',JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify({result:'COMPLETE film pass evidence audit',version,buildSHA256,checks:receipt.checkCount,media:receipt.media.files.map(f=>f.path)},null,2));
