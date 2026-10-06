import assert from 'node:assert/strict';import {readFile,writeFile,stat} from 'node:fs/promises';import {createHash} from 'node:crypto';import {spawnSync} from 'node:child_process';
const hash=b=>createHash('sha256').update(b).digest('hex'),read=async p=>JSON.parse(await readFile(p,'utf8'));
const build=await readFile('index.html'),buildSHA256=hash(build),buildTime=(await stat('index.html')).mtimeMs;assert.equal((await read('package.json')).version,'0.27.0');
const receipt={version:'0.27.0',status:'verified release candidate',verifiedAt:new Date().toISOString(),buildSHA256,buildBytes:build.length,checks:{},evidence:[],features:[],nativeProfiles:[]};
for(const browser of ['chrome','firefox']){
 const suffix=browser==='firefox'?'-firefox':'';
 const paths=[['smudge','smudge-pass'],['evolution','liquid-evolution'],['joining','liquid-evolution'],['character','liquid-evolution'],['finish','liquid-evolution'],['brush','brush-flow-pass'],['contact','wall-contact-pass'],['wall','wall-pass'],['wet','wet-pass'],['film','film-pass'],['rivulets','rivulet-pass']].map(([name,root])=>[name,root+'/final-v27'+suffix]);
 // Feature harnesses share a root; they have distinct conventional suffixes.
 for(const entry of paths)if(['joining','character','finish'].includes(entry[0]))entry[1]='liquid-evolution/final-v27'+(entry[0]==='joining'?'-joining':entry[0]==='character'?'-character':'-finish')+suffix;
 paths.push(['gameplay','compute-'+browser],['native','compute-native-'+browser],['wallNative','compute-native-wall-'+browser]);
 for(const [name,dir]of paths){
  const path='tools/out/'+dir+'/verification.json',bytes=await readFile(path),r=JSON.parse(bytes);assert(r.result.startsWith('COMPLETE'),path);assert(Date.parse(r.startedAt)>buildTime,path+' predates final build');if(r.buildSHA256)assert.equal(r.buildSHA256,buildSHA256,path);receipt.evidence.push({path,sha256:hash(bytes),startedAt:r.startedAt});receipt.checks[browser+'-'+name]=r.checks;
  if(name==='smudge')receipt.features.push({browser,tuning:r.tuning,baselineCarried:r.baselineSmudge.carried,carriedByStrength:Object.fromEntries(Object.entries(r.smudge).map(([k,v])=>[k,v.after.carried])),scrapes:r.scrapes,surfaceCount:r.surfaces.length,overlayCount:r.overlays.length,ceilingRunoff:r.ceilingRunoff});
  if(name==='brush')receipt.features.push({browser,descent3Seconds:r.samples[0].cy-r.samples[1].cy,descent15Seconds:r.samples[0].cy-r.samples[3].cy,samples:r.samples.map(({pigment,...s})=>s)});
  if(name==='film')receipt.resources=r.resources;
  if(name==='native'||name==='wallNative'){assert.deepEqual(r.viewport,[3000,1800]);assert(r.audio.enabled&&r.audio.state==='running');for(const p of r.profiles){assert.equal(p.audit.canvasReads,0);assert.equal(p.audit.webGLContexts,0);assert(!Object.keys(p.audit.reads).some(k=>/body inspection|pigment/.test(k)));receipt.nativeProfiles.push({browser,workload:p.label,fps:p.report.summary.fps,cpuP99MS:p.report.summary.workPercentileMs.p99,gpu:p.report.compute.summary,ticksPerSecond:p.ticksPerSecond});}}
 }
}
receipt.checkCount=Object.values(receipt.checks).reduce((n,v)=>n+v.length,0);
const root='tools/out/smudge-pass/recordings',capture=await read(root+'/capture.json');assert(capture.result.startsWith('COMPLETE'));assert.equal(capture.builds.find(b=>b.label==='before').sha256,(await read('docs/qa/liquid-evolution-v26.json')).buildSHA256);assert.equal(capture.builds.find(b=>b.label==='after').sha256,buildSHA256);
receipt.media={capture:root+'/capture.json',builds:capture.builds,files:[]};
for(const name of ['before/wall-before.mp4','after/wall-after.mp4',capture.comparison]){const path=root+'/'+name,b=await readFile(path),p=spawnSync('ffprobe',['-v','error','-show_entries','format=duration:stream=codec_name,width,height,r_frame_rate','-of','json',path],{encoding:'utf8',windowsHide:true});assert.ifError(p.error);assert.equal(p.status,0,p.stderr);const info=JSON.parse(p.stdout);assert.equal(info.streams[0].codec_name,'h264');assert(Math.abs(Number(info.format.duration)-46)<.1);receipt.media.files.push({path,bytes:b.length,sha256:hash(b),...info});}
receipt.sources={};for(const path of ['gpu/art.js','gpu/runtime.js','gpu/contact.wgsl','gpu/compute.wgsl','tools/compute-build.mjs','tools/smudge-verify.mjs','tools/wet-fixture.mjs','tools/smudge-capture.mjs','tools/wall-verify.mjs'])receipt.sources[path]=hash(await readFile(path));
receipt.scope=[
 'Accepted V26 preserved. New Tune controls retain old saved settings and permit stronger wet pigment transport plus faster abrasion growth. Defaults strengthen smudge without changing the film gravity solver.',
 'Smudge sums overlapping velocities before one bounded shared-edge pigment flux. Dry pigment remains fixed. No alpha pool stamps or duplicated liquid sources added.',
 'Six face-local wear values grow with loaded tangential contact travel, including rotation. Wear increases contact smudge, wound severity and supply from the finite body reserve. Wash retains it; Heal and Reset clear it.',
 'Ceiling and ramp underside are actual new paint receivers. Fifty-one thin decorative meshes project the supporting receiver paint and liquid, including trim, signs and light housings; they share the supporting collision plane and do not have independent edge reservoirs.',
 'All 77 world receivers retain 160 pigment texels/metre and 40 film cells/metre. Seven film banks, 900 particles, 54 bristles, body layout and normal-play no-body/no-pigment-readback policy remain.',
 'The first abrasion candidate increased wall supply too quickly and failed the existing drainage gate. The final wear rate passes the unchanged contact-to-drain checks in both browsers.',
 'Floor impact retention now compares to the accepted V26: liquid, pigment alpha and painted area each stay within 3%. Historical V17 wall-impact amplification checks remain in place.',
 'Videos use matching normal gameplay inputs and retain the simulated dummy for fifteen seconds after release. Actual native GPU trajectories can differ. Performance was measured separately from recording.'
];
for(const [path,expected]of [['versions/smear_v8.9_cpu.html','cff878b51eec0db9e3874f99c9fdcdbd6b9179d2f03e6374ef4726d89f1e5c44'],['versions/dragmark_v7.html','4dfe17e606b18ce7471f176b4c2afa0229b2f32e60b5b88c2971ebc6a75bc41f']])assert.equal(hash(await readFile(path)),expected);
await writeFile('docs/qa/smudge-v27.json',JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify({result:'COMPLETE V27 release evidence audit',checks:receipt.checkCount,buildSHA256,media:receipt.media.files.map(f=>f.path)},null,2));
