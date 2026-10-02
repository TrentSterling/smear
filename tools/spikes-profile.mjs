import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {launchFirefox} from './bidi.mjs';
import {launch,sleep,until} from './cdp.mjs';
import {createHash} from 'node:crypto';
import {cpus} from 'node:os';
const input=process.argv[2]||'index.html',label=process.argv[3]||'current',browser=process.argv[4]||'firefox';
const out=resolve('tools/out','spikes-'+label+'-'+browser);await mkdir(out,{recursive:true});
const source=await readFile(input,'utf8');
const hook=`(()=>{window.__glStage='boot';const calls={},slow=[];window.__glAudit={calls,slow,reset:()=>{for(const key in calls)delete calls[key];slow.length=0;}};
 for(const name of ['getProgramParameter','getShaderParameter','compileShader','linkProgram','getUniformLocation','getActiveUniform','getActiveAttrib','drawElements','drawArrays','drawElementsInstanced','texImage2D','texSubImage2D','bufferData','bufferSubData']){const proto=WebGL2RenderingContext.prototype,original=proto[name];if(!original)continue;proto[name]=function(...args){const t=performance.now();try{return original.apply(this,args);}finally{const ms=performance.now()-t,c=calls[name]||(calls[name]={count:0,total:0,max:0});c.count++;c.total+=ms;c.max=Math.max(c.max,ms);if(ms>=2){slow.push({stage:__glStage,name,ms,time:t});if(slow.length>256)slow.shift();}}};}
})();`;
const file=resolve(out,'runtime.html');await writeFile(file,source.replace('</head>','<script>'+hook+'</script></head>'));
const page=browser==='firefox'?await launchFirefox({port:9595,width:3000,height:1800}):await launch({port:9597,width:3000,height:1800});
const receipt={input,label,browser,sourceSha256:createHash('sha256').update(source).digest('hex'),startedAt:new Date().toISOString(),muted:true,reports:[]};
let hostBefore=cpus();
function pressure(){const after=cpus(),samples=after.map((c,i)=>{const b=hostBefore[i].times,t=c.times;const total=Object.keys(t).reduce((sum,k)=>sum+t[k]-b[k],0);return total?1-(t.idle-b.idle)/total:0;});return{logicalCPUs:samples.length,meanBusyFraction:samples.reduce((a,b)=>a+b,0)/samples.length,busiestFraction:Math.max(...samples)};}
async function capture(stage){const r=await page.eval(`({stage:'${stage}',telemetry:__smear.perf.report(),gl:__glAudit,paint:__smear.paintStatus()})`);r.hostCPU=pressure();receipt.reports.push(r);console.log(JSON.stringify({stage,summary:r.telemetry.summary,slowGL:r.gl.slow.slice(-20),paint:r.paint,hostCPU:r.hostCPU}));}
async function start(stage){await page.eval(`__glStage='${stage}';__glAudit.reset();__smear.perf.clear()`);hostBefore=cpus();}
try{
 await page.goto(pathToFileURL(file).href);await until(()=>page.eval('!!window.__smear'),{label:'render spike boot'});
 if(browser==='chrome'){await page.call('Profiler.enable');await page.call('Profiler.setSamplingInterval',{interval:500});await page.call('Profiler.start');}
 await page.eval(`__smear.tune({walking:false,recover:false});__smear.perf.show(true)`);await sleep(700);await capture('boot');
 await page.eval(`__smear.tool(1);__smear.view([3.4,3.3,4.8],[0,.3,1])`);await start('first-pistol');
 let p=await page.eval('__smear.project(0,"Torso")');await page.mouse('mousePressed',p.x,p.y);await sleep(300);await page.mouse('mouseReleased',p.x,p.y);await sleep(400);await capture('first-pistol');
 await start('sustained-pistol');p=await page.eval('__smear.project(0,"Torso")');await page.mouse('mousePressed',p.x,p.y);
 for(let i=0;i<90;i++){await sleep(100);p=await page.eval('__smear.project(0,"Torso")');await page.mouse('mouseMoved',p.x,p.y);}await page.mouse('mouseReleased',p.x,p.y);await capture('sustained-pistol');
 await page.eval(`(()=>{const a=__smear;a.reset();a.tool(0);a.view([3.4,3.3,4.8],[0,.1,1]);for(const b of a.state().parts.filter(b=>b.doll===1))for(const n of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]])a.bodyPaint(0,b.name,n,.85);})()`);await sleep(400);await start('drag');
 p=await page.eval('__smear.project(0,"Torso")');await page.mouse('mousePressed',p.x,p.y);
 for(let i=1;i<=180;i++){await page.mouse('mouseMoved',p.x+Math.sin(i/45*Math.PI*2)*360,Math.min(1660,p.y+230));await sleep(30);}await page.mouse('mouseReleased',p.x,p.y);await capture('drag');
 await page.eval('__smear.chaos()');await sleep(700);await start('chaos');await sleep(5000);await capture('chaos');
 if(browser==='chrome'){const {profile}=await page.call('Profiler.stop');await writeFile(resolve(out,'runtime.cpuprofile'),JSON.stringify(profile));}
 receipt.errors=page.logs.filter(s=>/^EXCEPTION:|^error:/i.test(s));console.log('COMPLETE native render spike profiling');
}finally{await writeFile(resolve(out,'summary.json'),JSON.stringify(receipt,null,2)+'\n');page.kill();}
