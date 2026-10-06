import assert from 'node:assert/strict';
import {readFile,writeFile,copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const root=resolve('tools/out/art-pass');
const read=async path=>JSON.parse(await readFile(path,'utf8'));
const run=(cmd,args)=>{const r=spawnSync(cmd,args,{windowsHide:true,encoding:'utf8',maxBuffer:8*1024*1024});assert.equal(r.status,0,r.stderr);return r.stdout;};
const before=resolve(root,'before/smear-before.mp4'),after=resolve(root,'after/smear-after.mp4'),comparison=resolve(root,'smear-comparison.mp4');
const font="fontfile='C\\:/Windows/Fonts/arialbd.ttf'";
run('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',before,'-i',after,'-filter_complex',`[0:v]scale=960:540,setpts=PTS-STARTPTS[l];[1:v]scale=960:540,setpts=PTS-STARTPTS[r];[l][r]hstack=inputs=2:shortest=1,pad=1920:600:0:60:color=0x102c32,drawtext=${font}:text='BEFORE  0.9.1':x=28:y=17:fontsize=24:fontcolor=white,drawtext=${font}:text='AFTER  0.10.0':x=988:y=17:fontsize=24:fontcolor=white`,'-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',comparison]);
const videos=[];
for(const path of [before,after,comparison]){
 const probe=JSON.parse(run('ffprobe',['-v','error','-show_entries','format=duration:stream=codec_name,width,height,r_frame_rate','-of','json',path]));
 assert.equal(probe.streams[0].codec_name,'h264');assert.equal(probe.streams[0].r_frame_rate,'30/1');assert(Number(probe.format.duration)>37);
 run('ffmpeg',['-v','error','-i',path,'-f','null','-']);videos.push({path,probe});
}
run('ffmpeg',['-hide_banner','-loglevel','error','-y','-ss','7','-i',comparison,'-frames:v','1',resolve(root,'comparison.png')]);
for(const [from,to]of [['compute-chrome','chrome-verification'],['compute-native-chrome','chrome-profile'],['compute-firefox','firefox-verification'],['compute-native-firefox','firefox-profile']])await copyFile(resolve('tools/out',from,'verification.json'),resolve(root,'after',to+'.json'));
const summary={version:'0.10.0',status:'Local candidate, not published',verifiedAt:new Date().toISOString(),buildSHA256:createHash('sha256').update(await readFile('index.html')).digest('hex'),videos,profiles:{},checks:{},gait:{},surfaceCount:75,texelsPerMetre:160};
for(const label of ['before','after']){
 const art=await read(resolve(root,label,'art-gauntlet.json'));assert.match(art.result,/COMPLETE/);
 const grounded=art.samples.slice(80).flatMap(s=>s.parts.filter(p=>p.doll>0&&/foot$/.test(p.name)&&p.p[1]<.09).map(p=>Math.hypot(p.v[0],p.v[2]))).sort((a,b)=>a-b);
 summary.gait[label]={...art.gait,groundedFootSpeed:{samples:grounded.length,p50:grounded[Math.floor(grounded.length*.5)],p95:grounded[Math.floor(grounded.length*.95)],mean:grounded.reduce((a,b)=>a+b)/grounded.length}};
 summary.checks[label]={art:art.checks};
 for(const browser of ['chrome','firefox']){
  const gameplay=await read(resolve(root,label,browser+'-verification.json'));assert.match(gameplay.result,/COMPLETE/);summary.checks[label][browser]={result:gameplay.result,count:gameplay.checks.length};
  if(label==='before'&&browser==='firefox')continue;
  const profile=await read(resolve(root,label,browser+'-profile.json'));assert.match(profile.result,/COMPLETE/);
  summary.profiles[label+'-'+browser]={result:profile.result,checks:profile.checks,viewport:profile.viewport,audio:profile.audio,paintMiB:profile.profiles[0].state.paintBytes/1048576,workloads:profile.profiles.map(x=>({label:x.label,fps:x.report.summary.fps,cpuP99:x.report.summary.workPercentileMs.p99,gpu:x.report.compute.summary,ticksPerSecond:x.ticksPerSecond,audit:x.audit}))};
 }
}
summary.notes=['Profiles run sequentially without video capture, with running WebAudio and independently muted browser output.','60 Hz browser presentation is not an uncapped maximum FPS result.','Grounded-foot speed uses both standing dummies after four seconds, with foot centres below 9 cm; it is a comparative slip indicator, not a force/contact measurement.','Recordings are silent 1080p30 canvas captures using the same cameras, resets, clip durations and inputs.','The art/mapping harness uses explicit GPU readback; normal gameplay audits retain zero body/pigment downloads.'];
await writeFile('docs/qa/art-v10.json',JSON.stringify(summary,null,2)+'\n','utf8');
console.log('COMPLETE three H.264 MP4s decoded and comparison receipt saved');
