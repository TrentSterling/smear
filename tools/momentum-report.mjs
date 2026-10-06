import assert from 'node:assert/strict';import fs from 'node:fs';import {createHash} from 'node:crypto';import {spawnSync} from 'node:child_process';
const hash=b=>createHash('sha256').update(b).digest('hex'),read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const html=fs.readFileSync('index.html'),buildSHA256=hash(html),buildTime=fs.statSync('index.html').mtimeMs;
const receipt={version:'0.31.0',at:new Date().toISOString(),buildSHA256,buildBytes:html.length,checks:{},evidence:[],momentum:[],nativeProfiles:[]};
const state=s=>({tick:s.tick,v:s.v,p:s.p,gap:s.gap,thuds:s.thuds});
const trial=t=>({held:state(t.held),released:state(t.released),flight:t.flight.map(state)});
for(const browser of ['chrome','firefox']){
 const suffix=browser==='firefox'?'-firefox':'';
 const paths=[['momentum','momentum-pass/final-v31-'+browser],['handling','throw-pass/final-v31-'+browser],...['carry','impact','smudge','brush-flow','wall-contact','wall','wet','film','rivulet'].map(name=>[name,name+'-pass/final-v31'+suffix]),['evolution','liquid-evolution/final-v31'+suffix],...['joining','character','finish'].map(name=>[name,'liquid-evolution/final-v31-'+name+suffix]),['gameplay','compute-'+browser],['native','compute-native-'+browser],['wallNative','compute-native-wall-'+browser],['impactNative','impact-pass/native-'+browser],['squeegeeNative','compute-native-squeegee-'+browser]];
 for(const [name,dir]of paths){
  const path='tools/out/'+dir+'/verification.json',bytes=fs.readFileSync(path),r=JSON.parse(bytes);assert(r.result.startsWith('COMPLETE'),path);assert(Date.parse(r.startedAt)>buildTime,path+' predates final build');if(r.buildSHA256)assert.equal(r.buildSHA256,buildSHA256,path);
  receipt.evidence.push({path,sha256:hash(bytes),startedAt:r.startedAt});receipt.checks[browser+'-'+name]=r.checks;
  if(name==='momentum')receipt.momentum.push({browser,before:trial(r.before),throws:Object.fromEntries(Object.entries(r.throws).map(([k,t])=>[k,trial(t)])),delays:Object.fromEntries(Object.entries(r.delays).map(([k,t])=>[k,trial(t)])),pointer:{held:state(r.pointerHeld),released:state(r.pointerReleased),flight:r.pointerFlight.map(state)},beforePistol:r.beforePistol,pistol:r.pistol});
  if(name==='native'||name.endsWith('Native')){assert.deepEqual(r.viewport,[3000,1800]);assert(r.audio.enabled&&r.audio.state==='running');for(const p of r.profiles){assert.equal(p.audit.canvasReads,0);assert.equal(p.audit.webGLContexts,0);assert(!Object.keys(p.audit.reads).some(k=>/body inspection|pigment/.test(k)));receipt.nativeProfiles.push({browser,workload:p.label,fps:p.report.summary.fps,cpuP99MS:p.report.summary.workPercentileMs.p99,gpu:p.report.compute.summary,ticksPerSecond:p.ticksPerSecond,reads:p.audit.reads});}}
 }
}
receipt.checkCount=Object.values(receipt.checks).reduce((n,v)=>n+v.length,0);
const root='tools/out/momentum-pass/recordings',capture=read(root+'/capture.json');assert(capture.result.startsWith('COMPLETE'));assert.equal(capture.builds.find(b=>b.label==='before').sha256,read('docs/qa/handling-v30.json').buildSHA256);assert.equal(capture.builds.find(b=>b.label==='after').sha256,buildSHA256);
receipt.media={capture:root+'/capture.json',builds:capture.builds,audio:'before left, after right',cadence:capture.cadence,clips:capture.clips,files:[]};
for(const name of ['before/momentum-before.mp4','after/momentum-after.mp4',capture.comparison]){
 const path=root+'/'+name,b=fs.readFileSync(path),p=spawnSync('ffprobe',['-v','error','-show_entries','format=duration:stream=codec_name,width,height,r_frame_rate,channels','-of','json',path],{encoding:'utf8',windowsHide:true,timeout:20000});assert.ifError(p.error);assert.equal(p.status,0,p.stderr);const info=JSON.parse(p.stdout);assert(info.streams.some(s=>s.codec_name==='h264'));assert(info.streams.some(s=>s.codec_name==='aac'));assert(Math.abs(Number(info.format.duration)-13)<.2);receipt.media.files.push({path,bytes:b.length,sha256:hash(b),...info});
}
receipt.sources={};for(const path of ['gpu/handling.wgsl','gpu/compute.wgsl','gpu/film.wgsl','gpu/contact.wgsl','gpu/runtime.js','tools/compute-build.mjs','tools/momentum-fixture.mjs','tools/momentum-verify.mjs','tools/momentum-capture.mjs'])receipt.sources[path]=hash(fs.readFileSync(path));
receipt.scope=[
 'Free ragdoll velocities are limited around their mass-weighted mean with one common relative scale. This retains the existing 21 m/s per-part integration ceiling while preserving internal contraction momentum whenever the mean is below that ceiling. Higher rig speeds are still capped at 21 m/s. Held rigs and pose motors retain their previous integration limiter.',
 'The shared limiter runs before integration and contacts. It does not restore velocities after collisions. The existing short release history, cancellation/obstruction/reversal guards, impact blood, thuds, floor smudging and wall liquid solvers remain.',
 'Chaos, Reset, demo and tool changes clear pistol flash, recoil, trigger and cooldowns. Simulation-reset paths synchronize simTime and the accumulator. Add dummy does not rewind simulation time.',
 'Tests reproduce multi-metre stretching, measure the subsequent 133 ms of free flight and later wall impact, exercise actual mouse picking/sweeps/mouseup, and verify pistol recovery after each reported transition in hardware Chrome and Firefox.',
 'Comparison footage uses identical initialized clean rigs and eight matched flick targets, each advanced by two shipping 120 Hz physics ticks at native rAF cadence. Subsequent flight uses normal native frame timing and game audio. Recording and native 3000x1800 performance runs are separate. Body downloads in inspection fixtures are explicit; normal play still performs no body or pigment downloads.',
 'This release fixes handling and weapon lifecycle. It does not revise the scene art or accepted paint-brush appearance.'
];
for(const [path,expected]of [['versions/smear_v8.9_cpu.html','cff878b51eec0db9e3874f99c9fdcdbd6b9179d2f03e6374ef4726d89f1e5c44'],['versions/dragmark_v7.html','4dfe17e606b18ce7471f176b4c2afa0229b2f32e60b5b88c2971ebc6a75bc41f']])assert.equal(hash(fs.readFileSync(path)),expected);
fs.writeFileSync('docs/qa/momentum-v31.json',JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify({result:'COMPLETE V31 release evidence audit',checks:receipt.checkCount,buildSHA256,media:receipt.media.files.map(f=>f.path)},null,2));
