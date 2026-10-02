import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {launch,until} from './cdp.mjs';

const out=resolve('tools/out/particle-collisions');await mkdir(out,{recursive:true});
const fixture=`async function particleCollisionProbe(which){manual=true;preset('default');applyTuning({walking:false,recover:false});resetWorld();
 for(let i=0;i<9;i++)addDummy();if(dolls.length!==12)throw Error('Expected the 180-body limit');
 if(which==='overflow'){for(let i=0;i<bodies.length;i++)bodies[i].p.set(22+(i%15)*.7,4+Math.floor(i/15)*.65,-24);}
 if(which==='ties'){for(const b of bodies){b.p.set(0,3,0);b.q.identity();b.iq.identity();}}
 for(let i=0;i<900;i++){const b=bodies[i%bodies.length],axis=new V(hash(i*31)-.5,hash(i*53)-.5,hash(i*71)-.5).normalize(),speed=which==='fast'?280:8;
  emitDrop(b.p.clone().addScaledVector(axis,which==='fast'?1.7:.6),axis.multiplyScalar(-speed),.004+hash(i*29)*.02,i%3===0?b.id:0);dropList.at(-1).life=i%4===0?.219:0;}
 for(let i=0;i<36;i++)updateDrops(STEP);drawDrops();renderNow();await window.__smear.paintReady?.();
 const s=state();delete s.version;delete s.renderer;delete s.stats.physicsMS;delete s.stats.frameMS;delete s.stats.paintUploads;
 return{state:s,drops:dropList.map(d=>({p:d.p.toArray(),prev:d.prev.toArray(),v:d.v.toArray(),r:d.r,life:d.life,owner:d.owner})),matrices:Array.from(dropMesh.instanceMatrix.array.slice(0,dropList.length*16)),pigment:surfaces.map(s=>s.canvas.toDataURL()),skins:bodies.map(b=>b.skinCanvas?.toDataURL()||null),pool:typeof dropPool==='undefined'?null:dropPool.length+dropList.length};}
`;
const sources=[execFileSync('git',['show','3129459:index.html'],{encoding:'utf8',maxBuffer:2000000}),await readFile('index.html','utf8')];
const page=await launch({port:9598,width:1280,height:720}),receipt={checks:[]},runs=[];
try{
 for(let n=0;n<sources.length;n++){
  const file=resolve(out,n?'candidate.html':'baseline.html');await writeFile(file,sources[n].replace('</head>','<script>window.requestAnimationFrame=()=>0;</script></head>').replace('window.__smear={state,',fixture+'\nwindow.__smear={particleCollisionProbe,state,'));
  await page.goto(pathToFileURL(file).href);await until(()=>page.eval('!!window.__smear&&!document.getElementById("loading")'),{label:'collision fixture boot'});
  const result=[];for(const which of ['crowded','overflow','ties','fast'])result.push(await page.eval(`__smear.particleCollisionProbe('${which}')`));runs.push(result);
 }
 for(let i=0;i<4;i++){
  const a=runs[1][i],b=runs[0][i];assert.equal(a.pool,900);delete a.pool;delete b.pool;assert.deepEqual(a,b);
  const name=['180-body room','out-of-grid body collisions','equal-distance collision ordering','fast segments across multiple cells'][i];receipt.checks.push(name);console.log('PASS exact original particle results: '+name);
 }
 receipt.errors=page.logs.filter(s=>/^EXCEPTION:|^error:/i.test(s));assert.deepEqual(receipt.errors,[]);
 receipt.result='COMPLETE particle collision checks passed';console.log(receipt.result+` (${receipt.checks.length} checks)`);
}catch(error){receipt.result='FAIL';receipt.error=error.stack;throw error;}
finally{await writeFile(resolve(out,'verification.json'),JSON.stringify(receipt,null,2)+'\n');page.kill();}
