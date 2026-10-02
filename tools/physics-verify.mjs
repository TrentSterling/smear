import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {launch,until} from './cdp.mjs';
import {launchFirefox} from './bidi.mjs';
const firefox=process.argv[2]==='firefox',out=resolve('tools/out','physics-'+(firefox?'firefox':'chrome'));await mkdir(out,{recursive:true});
const fixture=`async function physicsAudit(which){manual=true;preset('default');resetWorld();runtimeProfiler.show(false);
 if(which==='chaos')chaosScene();
 if(which==='pile'||which==='boundary'||which==='overflow'){applyTuning({walking:false,recover:false});while(dolls.length<12)newDoll(0,0,true,false);for(const d of dolls){knockDown(d,60);const base=which==='overflow'?new V(24,3,-24):which==='boundary'?new V(.99,3,.99):new V(0,1.5,0);for(const b of d.parts){b.p.copy(b.restP).add(base);if(which==='boundary'){b.p.x+=(hash(b.id*31)-.5)*.20;b.p.z+=(hash(b.id*53)-.5)*.20;}b.prevP.copy(b.p);b.v.set((hash(b.id*29)-.5)*9,-2,(hash(b.id*43)-.5)*9);b.w.set(hash(b.id*11)*3,hash(b.id*19)*3,0);}}}
 if(which==='recovery'){for(const d of dolls){knockDown(d,.2);d.recoveryWait=.2;d.lastImpact=simTime-10;}}
 const snapshots=[];for(let i=0;i<600;i++){physicsStep();if(i%8===7){renderNow();await __smear.paintReady(false);}if(i%120===119){const s=state();delete s.version;delete s.renderer;delete s.stats.physicsMS;delete s.stats.frameMS;delete s.stats.paintUploads;snapshots.push({state:s,velocities:bodies.map(b=>[b.v.toArray(),b.w.toArray()]),contacts:bodies.map(b=>b.contacts.map(c=>({p:c.p.toArray(),n:c.n.toArray(),si:c.si,depth:c.depth,force:c.force,closing:c.closing,receiver:c.receiver.id}))),drops:dropList.map(d=>({p:d.p.toArray(),v:d.v.toArray(),life:d.life,r:d.r,owner:d.owner}))});}}
 renderNow();await __smear.paintReady();return{snapshots,pigment:surfaces.map(s=>s.canvas.toDataURL()),skins:bodies.map(b=>b.skinCanvas?.toDataURL()||null)};}`;
const sources=[execFileSync('git',['show','f30ad99:index.html'],{encoding:'utf8',maxBuffer:2000000}),await readFile('index.html','utf8')],cases=['room','chaos','pile','boundary','overflow','recovery'],runs=[],receipt={checks:[]};
const page=firefox?await launchFirefox({width:1280,height:720}):await launch({port:9598,width:1280,height:720});
try{
 for(let n=0;n<sources.length;n++){
  const file=resolve(out,n?'candidate.html':'baseline.html');await writeFile(file,sources[n].replace('</head>','<script>window.requestAnimationFrame=()=>0;</script></head>').replace('window.__smear={state,',fixture+'\nwindow.__smear={physicsAudit,state,'));
  const results=[];for(const c of cases){await page.goto(pathToFileURL(file).href);await until(()=>page.eval('!!window.__smear'),{label:'physics audit boot'});results.push(await page.eval(`__smear.physicsAudit('${c}')`));console.log('RECORDED '+(n?'candidate':'V8.5')+' '+c);}runs.push(results);
 }
 for(let i=0;i<cases.length;i++){assert.deepEqual(runs[1][i],runs[0][i],cases[i]);receipt.checks.push({scenario:cases[i],ticks:600,sha256:createHash('sha256').update(JSON.stringify(runs[1][i])).digest('hex')});console.log('PASS exact physics, forces, droplets, surface and body pigment: '+cases[i]);}
 receipt.errors=page.logs.filter(s=>/^EXCEPTION:|^error:/i.test(s));assert.deepEqual(receipt.errors,[]);receipt.result='COMPLETE physics preservation checks passed';console.log(receipt.result+` (${cases.length} scenarios / 7200 ticks)`);
}catch(error){receipt.result='FAIL';receipt.error=error.stack;throw error;}
finally{await writeFile(resolve(out,'verification.json'),JSON.stringify(receipt,null,2)+'\n');page.kill();}
