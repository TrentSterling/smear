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
 ['hover tooltip',"tool=0;hovered=dolls[0].byName['Left upper arm'];"],
 ['subpixel tooltip moved','mouse.x+=.37;mouse.y+=.61;'],
 ['tooltip clamped','mouse.x=W-5;mouse.y=H-5;'],
 ['tooltip removed','hovered=null;mouse.x=W/2;mouse.y=H/2;'],
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
const baseline=JSON.parse(await readFile('tools/fixtures/hud-v8.5.json','utf8'));
// Version typography intentionally follows the release; all drawing stays frozen.
const release=JSON.parse(await readFile('package.json','utf8'));baseline.draw=baseline.draw.replaceAll('08.5',release.version.replace(/^0\.(\d+)\.(\d+)$/,'0$1.$2'));
const reference=`function originalHUD(){const c=document.createElement('canvas');c.id='hud-reference';c.width=hud.width;c.height=hud.height;const ctx=c.getContext('2d');let buttons=[],lastHUDKey='';${baseline.helpers}\n${baseline.slider}\n${baseline.draw}\ndrawUI();return{pixels:ctx.getImageData(0,0,c.width,c.height).data,buttons:buttons.map(({label,x,y,w,h})=>({label,x,y,w,h}))};}`;
const fixture=`const hudChecks={${scenarios.map(([name,code])=>JSON.stringify(name)+':()=>{'+code+'}').join(',')}};
 ${reference}
 function hudPixels(){const c=document.createElement('canvas');c.id='hud-composite';c.width=hud.width;c.height=hud.height;const g=c.getContext('2d');g.drawImage(hud,0,0);for(const l of [badgeLayer,aimLayer,demoLayer])if(l.c.style.display!=='none')g.drawImage(l.c,l.left,l.top);return g.getImageData(0,0,c.width,c.height).data;}
 function hudAudit(name){hudChecks[name]();renderNow();renderNow();const a=hudPixels();lastHUDKey='';drawUI();const b=hudPixels(),ref=originalHUD();let different=0,maxDelta=0,referenceDifferent=0,referenceMax=0;const samples=[];for(let i=0;i<a.length;i++){if(a[i]!==b[i]){different++;maxDelta=Math.max(maxDelta,Math.abs(a[i]-b[i]));}if(a[i]!==ref.pixels[i]){referenceDifferent++;referenceMax=Math.max(referenceMax,Math.abs(a[i]-ref.pixels[i]));if(samples.length<10)samples.push({x:Math.floor(i/4)%hud.width,y:Math.floor(i/4/hud.width),channel:i%4,a:a[i],b:ref.pixels[i]});}}return{different,maxDelta,referenceDifferent,referenceMax,samples,width:hud.width,height:hud.height,buttons:buttons.map(({label,x,y,w,h})=>({label,x,y,w,h})),referenceButtons:ref.buttons};}`;
// Keep the pixel comparison on one raster backend, including after canvas resize.
// Production native-input checks separately exercise the default accelerated HUD.
const init=`window.requestAnimationFrame=()=>0;const getContext=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,options){return getContext.call(this,type,this.id.startsWith('hud')&&type==='2d'?{...options,willReadFrequently:true}:options);};`;
const html=(await readFile('index.html','utf8')).replace('</head>','<script>'+init+'</script></head>').replace('window.__smear={state,',fixture+'\nwindow.__smear={hudAudit,state,');
const runtime=resolve(out,'runtime.html');await writeFile(runtime,html);
const page=firefox?await launchFirefox({width:1920,height:1080}):await launch({width:1920,height:1080,port:9597});
const receipt={browser:firefox?'Firefox':'Chrome',checks:[],audits:[]};
try{
 await page.goto(pathToFileURL(runtime).href);await until(()=>page.eval('!!window.__smear&&!document.getElementById("loading")'),{label:'HUD audit boot'});
 for(const [name] of scenarios){const r=await page.eval(`__smear.hudAudit(${JSON.stringify(name)})`);receipt.audits.push({name,...r});assert.equal(r.different,0,name);assert.ok(r.referenceMax<=2,name+': V8.5 pixel comparison '+JSON.stringify(r.samples));assert.deepEqual(r.buttons,r.referenceButtons,name+': logical hit targets');receipt.checks.push(name);console.log('PASS retained composite matches V8.5: '+name);}
 receipt.errors=page.logs.filter(s=>/^EXCEPTION:|^error:/i.test(s));assert.deepEqual(receipt.errors,[]);
 receipt.result='COMPLETE retained HUD checks passed';console.log(receipt.result+` (${receipt.checks.length} checks)`);
}catch(error){receipt.result='FAIL';receipt.error=error.stack;throw error;}
finally{await writeFile(resolve(out,'verification.json'),JSON.stringify(receipt,null,2)+'\n');page.kill();}
