import assert from 'node:assert/strict';import fs from 'node:fs';import {createHash} from 'node:crypto';import {spawnSync} from 'node:child_process';
const hash=b=>createHash('sha256').update(b).digest('hex'),read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const html=fs.readFileSync('index.html'),buildSHA256=hash(html),buildTime=fs.statSync('index.html').mtimeMs;
const receipt={version:'0.30.0',at:new Date().toISOString(),buildSHA256,buildBytes:html.length,checks:{},evidence:[],handling:[],nativeProfiles:[],drainage:[]};
for(const browser of ['chrome','firefox']){
 const suffix=browser==='firefox'?'-firefox':'';
 const paths=[['handling','throw-pass/final-v30-'+browser],...['carry','impact','smudge','brush-flow','wall-contact','wall','wet','film','rivulet'].map(name=>[name,name+'-pass/final-v30'+suffix]),['evolution','liquid-evolution/final-v30'+suffix],...['joining','character','finish'].map(name=>[name,'liquid-evolution/final-v30-'+name+suffix]),['gameplay','compute-'+browser],['native','compute-native-'+browser],['wallNative','compute-native-wall-'+browser],['impactNative','impact-pass/native-'+browser],['squeegeeNative','compute-native-squeegee-'+browser]];
 for(const [name,dir]of paths){
  const path='tools/out/'+dir+'/verification.json',bytes=fs.readFileSync(path),r=JSON.parse(bytes);assert(r.result.startsWith('COMPLETE'),path);assert(Date.parse(r.startedAt)>buildTime,path+' predates final build');if(r.buildSHA256)assert.equal(r.buildSHA256,buildSHA256,path);
  receipt.evidence.push({path,sha256:hash(bytes),startedAt:r.startedAt});receipt.checks[browser+'-'+name]=r.checks;
  if(name==='handling'){const {logs,checks,...data}=r;receipt.handling.push({browser,...data});}
  if(name==='brush-flow')receipt.drainage.push({browser,descent3Seconds:r.samples[0].cy-r.samples[1].cy,descent15Seconds:r.samples[0].cy-r.samples[3].cy,massRetained:r.samples[3].mass/r.samples[0].mass});
  if(name==='native'||name.endsWith('Native')){assert.deepEqual(r.viewport,[3000,1800]);assert(r.audio.enabled&&r.audio.state==='running');for(const p of r.profiles){assert.equal(p.audit.canvasReads,0);assert.equal(p.audit.webGLContexts,0);assert(!Object.keys(p.audit.reads).some(k=>/body inspection|pigment/.test(k)));receipt.nativeProfiles.push({browser,workload:p.label,fps:p.report.summary.fps,cpuP99MS:p.report.summary.workPercentileMs.p99,gpu:p.report.compute.summary,ticksPerSecond:p.ticksPerSecond,reads:p.audit.reads});}}
 }
}
receipt.checkCount=Object.values(receipt.checks).reduce((n,v)=>n+v.length,0);
const root='tools/out/throw-pass/recordings',capture=read(root+'/capture.json');assert(capture.result.startsWith('COMPLETE'));assert.equal(capture.builds.find(b=>b.label==='before').sha256,read('docs/qa/carry-v29.json').buildSHA256);assert.equal(capture.builds.find(b=>b.label==='after').sha256,buildSHA256);
receipt.media={capture:root+'/capture.json',builds:capture.builds,audio:'before left, after right',files:[]};
const audioLog=fs.readFileSync(root+'/audio-analysis.txt','utf8'),levels=[...audioLog.matchAll(/RMS level dB: (-?[\d.]+)/g)].map(m=>Number(m[1]));assert(levels.length>=2);assert(levels[1]>levels[0]+15);
receipt.media.impactAudio={startSeconds:13.5,durationSeconds:.8,lowpassHz:180,beforeRMSdB:levels[0],afterRMSdB:levels[1],evidenceSHA256:hash(audioLog)};
for(const name of ['before/handling-before.mp4','after/handling-after.mp4',capture.comparison]){
 const path=root+'/'+name,b=fs.readFileSync(path),p=spawnSync('ffprobe',['-v','error','-show_entries','format=duration:stream=codec_name,width,height,r_frame_rate,channels','-of','json',path],{encoding:'utf8',windowsHide:true});assert.ifError(p.error);assert.equal(p.status,0,p.stderr);const info=JSON.parse(p.stdout);assert(info.streams.some(s=>s.codec_name==='h264'));assert(info.streams.some(s=>s.codec_name==='aac'));assert(Math.abs(Number(info.format.duration)-21)<.2);receipt.media.files.push({path,bytes:b.length,sha256:hash(b),...info});
}
receipt.sources={};for(const path of ['gpu/handling.wgsl','gpu/contact.wgsl','gpu/compute.wgsl','gpu/film.wgsl','gpu/runtime.js','tools/compute-build.mjs','tools/handling-fixture.mjs','tools/handling-verify.mjs','tools/handling-capture.mjs','tools/compute-profile.mjs'])receipt.sources[path]=hash(fs.readFileSync(path));
receipt.scope=[
 'GPU throw assistance retains recently achieved mass-weighted rig velocity. Eight samples cover about 100 ms. Stops, reversals, fresh grabs, obstruction and cancellation reject stale motion. The existing 21 m/s simulation stability bound remains. Scroll up pushes away; down pulls closer.',
 'GPU impacts independently drive the retained procedural thud synthesizer through an eight-byte asynchronous event, with four reusable staging buffers. Strength depends on lost normal contact speed and part mass, independent of blood. Per-rig cooldowns coalesce collisions; muted/hidden/paused events and stale results are discarded.',
 'Held floor contacts debit real liquid cells and return them at leading contact edges, with outward ridge transport during rotation. Existing strength/carry settings apply. Pickup is reduced while squeegeeing so more supply is pushed. No circular alpha stamps were introduced; wall brushing/drainage remains unchanged.',
 'The isolated squeegee test checks finite transfer with under 0.2% fixed-point error. The older combined floor coating/pickup/deposition system is not a calibrated conservation model; gameplay tests separately measure actual Q/E input, outward buildup, dry/hover/zero controls and native performance.',
 'Comparison scenes use matched diagnostic pool or clean launch states, followed by native simulation and real game audio. The throw clip uses matching grab targets with a 67 ms release delay. The existing-pool clip disables new injury/deposition to expose transport. Performance measurements are separate from recording.'
];
for(const [path,expected]of [['versions/smear_v8.9_cpu.html','cff878b51eec0db9e3874f99c9fdcdbd6b9179d2f03e6374ef4726d89f1e5c44'],['versions/dragmark_v7.html','4dfe17e606b18ce7471f176b4c2afa0229b2f32e60b5b88c2971ebc6a75bc41f']])assert.equal(hash(fs.readFileSync(path)),expected);
fs.writeFileSync('docs/qa/handling-v30.json',JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify({result:'COMPLETE V30 release evidence audit',checks:receipt.checkCount,buildSHA256,media:receipt.media.files.map(f=>f.path)},null,2));
