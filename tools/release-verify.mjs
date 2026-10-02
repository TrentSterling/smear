// Run GPU-owning harnesses sequentially; keep every browser isolated and muted.
import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const checks=[
 ['gameplay',['tools/verify.mjs']],
 ['paint',['tools/paint-verify.mjs']],
 ['paint compatibility',['tools/paint-verify.mjs','fallback']],
 ['paint Firefox',['tools/paint-verify.mjs','firefox']],
 ['worker',['tools/worker-verify.mjs']],
 ['worker Firefox',['tools/worker-verify.mjs','firefox']],
 ['particles',['tools/particles-verify.mjs']],
 ['HUD',['tools/hud-verify.mjs']],
 ['HUD Firefox',['tools/hud-verify.mjs','firefox']],
 ['details',['tools/details-verify.mjs']],
 ['native context',['tools/context-verify.mjs']],
 ['native context Firefox',['tools/context-verify.mjs','firefox']],
 ['native input Firefox',['tools/firefox-verify.mjs']],
 ['runtime profiler',['tools/runtime-verify.mjs']],
 ['runtime profiler overhead',['tools/runtime-profile.mjs']],
];
const out=resolve('tools/out');await mkdir(out,{recursive:true});
const receipt={version:JSON.parse(await readFile('package.json','utf8')).version,sourceSha256:createHash('sha256').update(await readFile('index.html')).digest('hex'),checks:[],startedAt:new Date().toISOString()};
let start=0;if(process.argv[2]){start=checks.findIndex(([name])=>name===process.argv[2]);if(start<0)throw Error('Unknown starting harness');const prior=JSON.parse(await readFile(resolve(out,'release-verification.json'),'utf8'));if(prior.sourceSha256!==receipt.sourceSha256)throw Error('Source changed; rerun the complete suite');receipt.checks=prior.checks.filter(c=>c.exitCode===0&&!checks.slice(start).some(([name])=>name===c.name));receipt.startedAt=prior.startedAt;receipt.continuedAt=new Date().toISOString();}
try{for(const [name,args]of checks.slice(start)){console.log('RUN '+name);const started=Date.now(),code=await new Promise((resolve,reject)=>{const p=spawn(process.execPath,args,{stdio:'inherit',windowsHide:true});p.on('error',reject);p.on('exit',resolve);});receipt.checks.push({name,exitCode:code,seconds:(Date.now()-started)/1000});if(code!==0)throw Error(name+' failed ('+code+')');}receipt.result='COMPLETE release checks passed';console.log(receipt.result+` (${receipt.checks.length} harnesses)`);}
catch(error){receipt.result='FAIL';receipt.error=error.stack;process.exitCode=1;}
finally{receipt.finishedAt=new Date().toISOString();await writeFile(resolve(out,'release-verification.json'),JSON.stringify(receipt,null,2)+'\n');}
