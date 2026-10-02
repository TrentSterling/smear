import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {launch,until} from './cdp.mjs';
import {launchFirefox} from './bidi.mjs';

const firefox=process.argv[2]==='firefox',out=resolve('tools/out','hud-'+(firefox?'firefox':'chrome'));
await mkdir(out,{recursive:true});
const scenarios=[
 ['initial HUD','manual=true;resetWorld();runtimeProfiler.show(false);'],
 ['button hover',"const b=buttons.find(b=>b.label==='Chaos');mouse.x=b.x+b.w/2;mouse.y=b.y+b.h/2;"],
 ['button hover cleared','mouse.x=W*.5;mouse.y=H*.5;'],
 ['pistol reticle','tool=1;'],
 ['reticle moved','mouse.x+=143;mouse.y+=41;'],
 ['recoil and hit marker',"viewKick=.21;hitMarkerUntil=simTime+1;hitMarkerColor='#c7eeb0';"],
 ['hit marker expired','hitMarkerUntil=simTime-1;viewKick=0;'],
 ['grab hint and reticle',"tool=0;const b=dolls[0].byName.Torso,p=b.p.clone();grab={body:b,local:new V(),target:p.clone(),desired:p.clone(),distance:4,manual:true};"],
 ['released grab','releaseGrab();'],
 ['paused HUD','paused=true;'],
 ['slow HUD','paused=false;slow=true;'],
 ['HUD hidden','showHUD=false;'],
 ['HUD restored','showHUD=true;slow=false;'],
 ['controls panel',"openPanel('controls');"],
 ['tuning panel',"openPanel('tune');tunePage='blood';"],
 ['live tuning change','tune.bleeding=1.7;tune.drying=43;'],
 ['about panel',"openPanel('about');"],
 ['reset panel',"openPanel('reset');"],
 ['close panel and change modes','openPanel(null);player.fly=true;soundOn=false;stickyLook=true;'],
 ['profiler panel open','runtimeProfiler.show(true);'],
 ['toast expired','toastUntil=0;'],
 ['resize','W=1100;H=700;hud.width=W*DPR;hud.height=H*DPR;lastHUDKey="";']
];
const fixture=`const hudChecks={${scenarios.map(([name,code])=>JSON.stringify(name)+':()=>{'+code+'}').join(',')}};
 function hudAudit(name){hudChecks[name]();renderNow();renderNow();const a=ctx.getImageData(0,0,hud.width,hud.height).data;lastHUDKey='';drawUI();const b=ctx.getImageData(0,0,hud.width,hud.height).data;let different=0,maxDelta=0;const samples=[];for(let i=0;i<a.length;i++)if(a[i]!==b[i]){different++;maxDelta=Math.max(maxDelta,Math.abs(a[i]-b[i]));if(samples.length<10)samples.push({x:Math.floor(i/4)%hud.width,y:Math.floor(i/4/hud.width),channel:i%4,a:a[i],b:b[i]});}return{different,maxDelta,samples,width:hud.width,height:hud.height,buttons:buttons.length};}`;
// Keep the pixel comparison on one raster backend, including after canvas resize.
// Production native-input checks separately exercise the default accelerated HUD.
const init=`window.requestAnimationFrame=()=>0;const getContext=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,options){return getContext.call(this,type,this.id==='hud'&&type==='2d'?{...options,willReadFrequently:true}:options);};`;
const html=(await readFile('index.html','utf8')).replace('</head>','<script>'+init+'</script></head>').replace('window.__smear={state,',fixture+'\nwindow.__smear={hudAudit,state,');
const runtime=resolve(out,'runtime.html');await writeFile(runtime,html);
const page=firefox?await launchFirefox({width:1920,height:1080}):await launch({width:1920,height:1080,port:9597});
const receipt={browser:firefox?'Firefox':'Chrome',checks:[],audits:[]};
try{
 await page.goto(pathToFileURL(runtime).href);await until(()=>page.eval('!!window.__smear&&!document.getElementById("loading")'),{label:'HUD audit boot'});
 for(const [name] of scenarios){const r=await page.eval(`__smear.hudAudit(${JSON.stringify(name)})`);receipt.audits.push({name,...r});assert.equal(r.different,0,name);receipt.checks.push(name);console.log('PASS retained HUD matches complete redraw: '+name);}
 receipt.errors=page.logs.filter(s=>/^EXCEPTION:|^error:/i.test(s));assert.deepEqual(receipt.errors,[]);
 receipt.result='COMPLETE retained HUD checks passed';console.log(receipt.result+` (${receipt.checks.length} checks)`);
}catch(error){receipt.result='FAIL';receipt.error=error.stack;throw error;}
finally{await writeFile(resolve(out,'verification.json'),JSON.stringify(receipt,null,2)+'\n');page.kill();}
