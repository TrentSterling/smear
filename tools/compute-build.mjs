// Build a complete offline WebGPU game from the retained scene/model assets.
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {replaceIIFE} from './simulation-kernel.mjs';
const source=await readFile('versions/smear_v8.9_cpu.html','utf8');
const shaders=Object.fromEntries(await Promise.all(['common','compute','render'].map(async name=>[name,await readFile('gpu/'+name+'.wgsl','utf8')])));
shaders.compute+='\n'+await readFile('gpu/contact.wgsl','utf8')+'\n'+await readFile('gpu/film.wgsl','utf8');
// Firefox/Zen implement WGSL without the newer swizzle_assignment extension.
// Keep every assignment compatible with both browser shader compilers.
for(const [name,shader] of Object.entries(shaders)){
 const invalid=/\.[xyzwrgba]{2,4}\s*(?:=(?!=)|[+*/%-]=)/.exec(shader);
 assert(!invalid,`${name}.wgsl contains a nonportable swizzle assignment: ${invalid?.[0]}`);
}
const runtime=(await Promise.all(['runtime','art','dummy','tools'].map(name=>readFile('gpu/'+name+'.js','utf8')))).join('\n');
new Function(runtime); // Parse the injected scripts before writing a browser build.
let html=replaceIIFE(source,'const paintEngine=(()=>{',`const paintEngine={enabled:true,register:s=>{s.paintId=s.skinOwner?1000+s.skinOwner.id:s.id;s.paintEpoch=0;},remove(){},draw(){},pump(){},snapshotCanvas(){},flush:async()=>{},status:()=>({backend:'WebGPU compute',workerCount:0,queued:0,inFlight:0,recoveryPending:0,mainReplayCommands:0})};paintTelemetry=paintEngine.status;`);
// Profiler reports the asynchronous WebGPU timestamps separately from exclusive CPU phases.
html=html.replace('current.particles=dropList.length;current.paintQueue=dirtyPaint.size;current.wetQueue=dirtyWet.size;','current.particles=window.__smearGPU?.cache.particles||0;current.paintQueue=0;current.wetQueue=0;');
html=html.replace('for(const b of bodies){if(b.active)current.activeBodies++;current.wounds+=b.wounds.length;}','current.activeBodies=window.__smearGPU?.cache.activeBodies||0;current.wounds=window.__smearGPU?.cache.wounds||0;');
html=html.replace('paintWorker:paintTelemetry?.()||null,','paintWorker:null,compute:window.__smearGPU?.profile()||null,');
html=html.replace("const gpu=a.gpuMs===null?(ext?'GPU pending':'GPU timer unavailable'):('GPU '+fmt(a.gpuMs)+' ms ('+a.gpuSamples+' samples)');","const measured=s.compute?.summary;const gpu=measured?'GPU compute '+fmt(measured.computeMS.p50)+' / p99 '+fmt(measured.computeMS.p99)+' ms; render '+fmt(measured.renderMS.p50)+' / p99 '+fmt(measured.renderMS.p99)+' ms (async)': 'GPU timestamps pending';");
html=html.replace(/^  nodes\.context\.textContent=.*$/m,"  nodes.context.textContent=gpu+'\\n'+(last?last.calls+' draws / '+Math.round(last.triangles/1000)+'k tris / '+last.dolls+' dolls / '+last.activeBodies+' active / '+last.particles+' GPU drops\\n'+fmt(a.steps)+' ticks/frame; persistent GPU pigment '+fmt((window.__smearGPU?.paintBuffer.size||0)/1048576)+' MiB; no paint pixel uploads':'Collecting workload');nodes.context.style.whiteSpace='pre-wrap';");
html=html.replace("engine:'Three.js '+T.REVISION","engine:'Native WebGPU compute and rendering',adapter:window.__smearGPU?.status().adapter");
html=html.replace('GPU queries cover uploads + rendering and resolve asynchronously.','GPU compute and render timestamps resolve asynchronously and are reported separately.').replace('Upload-call CPU is nested in prep/render.','GPU pigment stays resident; CPU render measures submission.');

const stub=`class GPUSceneGraph {
 constructor({canvas}){this.domElement=canvas;this.pixelRatio=1;this.shadowMap={};this.capabilities={isWebGL2:false,getMaxAnisotropy:()=>8};this.info={programs:[],memory:{textures:0,geometries:0},render:{calls:0,triangles:0}};const properties=new WeakMap();this.properties={get:o=>{if(!properties.has(o))properties.set(o,{});return properties.get(o);}};this.gl={getExtension:()=>null,getParameter:()=> 'WebGPU',isContextLost:()=>false};}
 setPixelRatio(n){this.pixelRatio=n;}setSize(w,h){this.domElement.width=Math.round(w*this.pixelRatio);this.domElement.height=Math.round(h*this.pixelRatio);this.domElement.style.width=w+'px';this.domElement.style.height=h+'px';}getContext(){return this.gl;}render(scene){scene.updateMatrixWorld();}compile(){}initTexture(){}copyTextureToTexture(){}dispose(){}
}
window.GPUSceneGraph=GPUSceneGraph;`;
html=html.replace('new T.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:\'high-performance\'})','new GPUSceneGraph({canvas})');
html=html.replace('\nenvironment();','\nscene.environment=null;');
// Preserve the source physics for historical study, but never execute it here.
html=html.replace('function physicsStep(dt=STEP){','function cpuPhysicsReference(dt=STEP){');
html=html.replace('const STEP=1/120;','const STEP=1/120;function physicsStep(){}');
html=html.replace("detailBatching=new URLSearchParams(location.search).get('detailMeshes')!=='1'",'detailBatching=false');
html=html.replace('mouse.left=true;currentHit=cast();',"mouse.left=true;if(window.__smearGPU?.ready){if(tool===0)__smearGPU.pick();else if(tool===1)shoot();else spill();return;}currentHit=cast();");
html=html.replace('gun.position.set(mix(.25,0,aimBlend),mix(-.218,-.078,aimBlend),-.44+viewKick*.23);','gun.position.set(mix(.25,0,aimBlend),mix(-.165,-.070,aimBlend),-.55+viewKick*.23);');
html=html.replace("$('loading').remove();",'/* Loading remains until the compute device and pipelines are ready. */');
const hook=String.raw`
let computeLive=null,computeAccumulator=0,computeClock=performance.now(),computePulse=0,computeBooting=true;
const sourceRelease=releaseGrab;
const computeSpots=[[-4.9,-4.6],[-1.9,-4.8],[1.4,-4.5],[4.6,-4.2],[-5.2,-1.2],[-2.6,-.5],[2.8,-1.0],[5,.2],[-4.6,2.3]];
for(let i=dolls.length;i<12;i++){const p=computeSpots[i-3];newDoll(p[0],p[1],false,false);}
const fullBodies=[...bodies],fullDolls=[...dolls];let compute=null;
function computeInput(){getRay();if(grab&&!grab.manual){grab.desired.copy(raycaster.ray.direction).multiplyScalar(grab.distance).add(raycaster.ray.origin);grab.desired.y=clamp(grab.desired.y,-1.6,6.3);}return{twist:(keys.has('KeyE')?1:0)-(keys.has('KeyQ')?1:0),rayO:raycaster.ray.origin.toArray(),rayD:raycaster.ray.direction.toArray(),left:mouse.left,tool,body:grab?grab.body.id-1:0,held:!!grab,local:grab?.local.toArray()||[0,0,0],target:grab?.desired.toArray()||[0,0,0],tune};}
function computeCounts(){dolls.length=bodies.length=0;dolls.push(...fullDolls.slice(0,compute.bodyCount/15));bodies.push(...fullBodies.slice(0,compute.bodyCount));lastHUDKey='';}
function computeFailure(error){$('failure').style.display='block';$('failure').textContent='SMEAR Compute: '+error.message;console.error(error);}
async function computeBoot(){
 compute=new SmearCompute({THREE:T,canvas,scene,camera,gun,slide,flash,grip,spillCan:null,dropMesh,brushes,bodies:fullBodies,dolls:fullDolls,joints,staticBoxes,surfaces,input:computeInput,syncCounts:computeCounts,fail:computeFailure,picked:hit=>{if(!mouse.left||tool!==0)return;const b=fullBodies[hit.body];grab={body:b,local:new V(...hit.local),desired:new V(...hit.point),target:new V(...hit.point),distance:hit.distance,manual:false};selected=b;}});
 window.__smearGPU=compute;await compute.init();
 resetWorld=(resetCamera=true)=>{sourceRelease();mouse.left=false;paused=false;demo=null;computeAccumulator=0;simTime=0;shotClock=spillClock=0;viewKick=recoilPitch=0;shotFlashUntil=-1;compute.reset();if(resetCamera)defaultView();};chaosScene=()=>{sourceRelease();compute.reset(true);};cleanSurfaces=()=>compute.clean(false);washBodies=()=>{compute.clean(true);notify('Dummies washed; wounds remain.');};healAll=()=>{compute.heal();notify('Dummies healed; stains remain.');};stopBleeding=()=>{compute.stop();notify('Bleeding stopped.');};addDummy=()=>compute.add();startDemo=()=>{compute.reset();tool=0;viewAt(new V(4.3,4.2,6.1),new V(.1,.25,.6));demo={start:compute.steps/120,oldBlood:bloodScale};grab={body:fullBodies[14],local:new V(0,0,.1),target:new V(),desired:new V(),distance:4,manual:true};selected=grab.body;};
 shoot=()=>{if(simTime<shotClock)return;shotClock=simTime+.14;compute.shoot();stats.shots++;playShot();shotFlashUntil=simTime+.045;viewKick=Math.min(.23,viewKick+.14);};spill=()=>{if(simTime<spillClock)return;spillClock=simTime+.065;compute.spill();};releaseGrab=()=>{sourceRelease();};updateGrab=()=>computeInput();
 __smear.manual=v=>{manual=v;compute.manual=v;computeAccumulator=0;};__smear.step=n=>compute.step(n);__smear.rawStep=__smear.step;__smear.state=async()=>({...await compute.state(),name:'SMEAR',version:'0.17.0',simTime:compute.steps/120,grab:grab?.body.name||null,tool,paused,slow,tune:{...tune},player:{p:player.feet.toArray(),mode:player.fly?'fly':'walk'}});__smear.paintReady=()=>compute.device.queue.onSubmittedWorkDone();__smear.chaos=()=>chaosScene();__smear.reset=()=>resetWorld(true);__smear.add=addDummy;__smear.clean=cleanSurfaces;__smear.wash=washBodies;__smear.heal=healAll;__smear.stopBleeding=stopBleeding;__smear.demo=startDemo;__smear.shoot=shoot;
 __smear.project=async(d,name)=>{const s=await compute.state(),i=fullBodies.findIndex(b=>b.doll.id===d+1&&b.name===name),p=new V(...s.parts[i].p).project(camera);return{x:(p.x*.5+.5)*W,y:(.5-p.y*.5)*H,world:s.parts[i].p};};
 __smear.grab=async(d,name,local=[0,0,0])=>{const s=await compute.state(),b=fullBodies.find(b=>b.doll.id===d+1&&b.name===name),p=new V(...local).applyQuaternion(new Q(...s.parts[b.id-1].q)).add(new V(...s.parts[b.id-1].p));grab={body:b,local:new V(...local),target:p.clone(),desired:p.clone(),distance:4,manual:true};selected=b;return p.toArray();};for(const key of ['velocity','agePaint','clearance','knock','bodyPaint','puddle','moveDoll','pose','hit','wallSpill','paintDump','sampleFloor','trace','paintFaces'])delete __smear[key];__smear.render=()=>compute.submit(0);__smear.view=(p,t)=>{viewAt(new V(...p),new V(...t));compute.submit(0);};__smear.target=p=>{if(grab)grab.desired.fromArray(p);};__smear.release=releaseGrab;
 __smear.compute={status:()=>compute.status(),state:()=>compute.state(),paintHash:i=>compute.pigmentHash(i),audio:()=>({enabled:soundOn,state:audio?.state||'uninitialized'})};
 dirtyPaint.clear();dirtyWet.clear();
 computeBooting=false;computeClock=performance.now();$('loading')?.remove();window.__smearComputeReady=true;
}
frame=function(now){frameRequest=0;if(!running)return;const wall=performance.now(),elapsed=Math.max(0,(wall-computeClock)/1000);computeClock=wall;if(!compute?.ready){frameRequest=requestAnimationFrame(frame);return;}
 if(manual){runtimeProfiler.breakInterval();drawUI();runtimeProfiler.refresh();frameRequest=requestAnimationFrame(frame);return;}
 runtimeProfiler.begin(now,wall);let t=performance.now();const dt=Math.min(.075,elapsed);stats.frameMS=mix(stats.frameMS,dt*1000,.035);moveCamera(dt);updateTools(dt);compute.updateToolPresentation(dt,{tool,panel,time:simTime,left:mouse.left});computePulse-=dt;
 if(mouse.left&&!panel&&tool!==0&&computePulse<=0){if(tool===1)shoot();else spill();computePulse=tool===1?.14:.065;}
 if(demo&&grab){const phase=compute.steps/120-demo.start;grab.desired.set(Math.sin(phase*.65)*1.6,.16+Math.max(0,Math.sin((phase-8)*.8))*1.8,.6+Math.cos(phase*.8));if(phase>14){releaseGrab();demo=null;}}
 runtimeProfiler.add('input',performance.now()-t);let steps=0;if(!paused&&!document.hidden){computeAccumulator+=dt*(slow?.25:1);steps=Math.min(10,Math.floor(computeAccumulator/STEP));computeAccumulator-=steps*STEP;}else computeAccumulator=0;
 t=performance.now();compute.submit(steps);simTime=compute.steps/120;stats.steps=compute.steps;renderer.info.render.calls=compute.draws.length*2+1;renderer.info.render.triangles=compute.triangles;computeLive=compute.status();runtimeProfiler.add('render',performance.now()-t);runtimeProfiler.add('steps',steps);
 t=performance.now();drawUI();updateScrape(compute.cache.scraping||0,0);runtimeProfiler.add('hud',performance.now()-t);runtimeProfiler.refresh();runtimeProfiler.finish(wall);frameRequest=requestAnimationFrame(frame);
};
computeBoot().catch(computeFailure);
`;
assert(html.includes('frameRequest=requestAnimationFrame(frame);\n})();'));
html=html.replace('frameRequest=requestAnimationFrame(frame);\n})();',hook+'\nframeRequest=requestAnimationFrame(frame);\n})();');
const shadersScript='window.__smearComputeShaders='+JSON.stringify(shaders).replaceAll('<','\\u003c')+';';
html=html.replace('</head>','<script>'+shadersScript+'\n'+stub+'\n'+runtime+'</script></head>');
html=html.replace("Six dummies. No runtime downloads. Three.js r140 embedded.","Twelve dummies. GPU simulation and rendering. Offline.").replace("World-planted procedural feet; physically assisted posing.","Compute driven ragdolls, droplets, smears and wall drips.");
html=html.replaceAll("version:'0.8.9'","version:'0.17.0'").replaceAll('08.9','17.0');
await writeFile('index.html',html,'utf8');console.log('Built offline index.html ('+Buffer.byteLength(html)+' bytes)');
