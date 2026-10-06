// Assemble the original pre-art recordings and the final matching gameplay pass.
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
const label=process.argv[2]||'final-v14',root=resolve('tools/out/review-v14');await mkdir(root,{recursive:true});
const before=resolve('tools/out/art-pass/before'),after=resolve('tools/out/art-pass',label);
const a=JSON.parse(await readFile(resolve(before,'capture.json'))),b=JSON.parse(await readFile(resolve(after,'capture.json')));
assert.equal(a.result,'COMPLETE matched MP4 capture');assert.equal(b.result,a.result);assert.equal(b.version,'0.14.0');
const buildHashes={};for(const [name,path]of [['before',before],['after',after]])buildHashes[name]=createHash('sha256').update(await readFile(resolve(path,'build.html'))).digest('hex');assert.equal(buildHashes.after,b.buildSHA256);
const encode=args=>{const p=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y',...args],{windowsHide:true,encoding:'utf8'});assert.ifError(p.error);assert.equal(p.status,0,p.stderr);};
for(const [name,seconds]of [['walk',16],['drag',14],['surfaces',8]]){
 assert(a.clips.some(c=>c.name===name&&c.seconds===seconds));assert(b.clips.some(c=>c.name===name&&c.seconds===seconds));
 const filters=`[0:v]fps=30,scale=960:540,tpad=stop_mode=clone:stop_duration=1,trim=duration=${seconds},setpts=PTS-STARTPTS,pad=960:600:0:60:color=0x14282c,drawtext=font=Arial:text='BEFORE ART PASS  /  0.9.1':x=24:y=18:fontsize=24:fontcolor=white[a];[1:v]fps=30,scale=960:540,tpad=stop_mode=clone:stop_duration=1,trim=duration=${seconds},setpts=PTS-STARTPTS,pad=960:600:0:60:color=0x14282c,drawtext=font=Arial:text='SMEAR  /  0.14.0':x=24:y=18:fontsize=24:fontcolor=white[b];[a][b]hstack=inputs=2[v]`;
 encode(['-i',resolve(before,name+'.mp4'),'-i',resolve(after,name+'.mp4'),'-filter_complex',filters,'-map','[v]','-c:v','libx264','-crf','18','-preset','fast','-pix_fmt','yuv420p',resolve(root,name+'.mp4')]);
}
await writeFile(resolve(root,'clips.txt'),"file 'walk.mp4'\nfile 'drag.mp4'\nfile 'surfaces.mp4'\n");
const filename='01-smear-whole-art-pass.mp4';encode(['-f','concat','-safe','0','-i',resolve(root,'clips.txt'),'-c','copy','-movflags','+faststart',resolve(root,filename)]);
await writeFile(resolve(root,'review.json'),JSON.stringify({result:'COMPLETE whole art-pass comparison',filename,seconds:38,viewport:[1920,600],fps:30,before:'0.9.1',after:b.version,buildHashes,inputs:{before,after},note:'Original pre-art recordings retained; the same final camera and action scripts were recorded again. Each section is normalized to its original requested duration before concatenation.'},null,2)+'\n');console.log('COMPLETE '+filename);
