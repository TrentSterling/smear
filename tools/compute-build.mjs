// Build a complete offline WebGPU game from the retained scene/model assets.
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {replaceIIFE} from './simulation-kernel.mjs';
const source=await readFile('versions/smear_v8.9_cpu.html','utf8');
const shaders=Object.fromEntries(await Promise.all(['common','compute','render'].map(async name=>[name,await readFile('gpu/'+name+'.wgsl','utf8')])));
shaders.compute+='\n'+await readFile('gpu/contact.wgsl','utf8')+'\n'+await readFile('gpu/film.wgsl','utf8');
shaders.compute+='\n'+await readFile('gpu/handling.wgsl','utf8')+'\n'+await readFile('gpu/melee.wgsl','utf8');
shaders.compute+='\n'+await readFile('gpu/destruction.wgsl','utf8')+'\n'+await readFile('gpu/props.wgsl','utf8')+'\n'+await readFile('gpu/buddy.wgsl','utf8');
shaders.render+='\n'+await readFile('gpu/ltc.wgsl','utf8')+'\n'+await readFile('gpu/destruction-render.wgsl','utf8');
const ltcData=await readFile('vendor/ltc/ggx.bin');
const ltcNotice=await readFile('vendor/ltc/NOTICE.txt','utf8');
const ltcFit=await readFile('vendor/ltc/fit.cpp','utf8');
// Firefox/Zen implement WGSL without the newer swizzle_assignment extension.
// Keep every assignment compatible with both browser shader compilers.
for(const [name,shader] of Object.entries(shaders)){
 const invalid=/\.[xyzwrgba]{2,4}\s*(?:=(?!=)|[+*/%-]=)/.exec(shader);
 assert(!invalid,`${name}.wgsl contains a nonportable swizzle assignment: ${invalid?.[0]}`);
}
const runtime=(await Promise.all(['runtime','art','dummy','tools','props','buddy'].map(name=>readFile('gpu/'+name+'.js','utf8')))).join('\n');
new Function(runtime); // Parse the injected scripts before writing a browser build.
let html=replaceIIFE(source,'const paintEngine=(()=>{',`const paintEngine={enabled:true,register:s=>{s.paintId=s.skinOwner?1000+s.skinOwner.id:s.id;s.paintEpoch=0;},remove(){},draw(){},pump(){},snapshotCanvas(){},flush:async()=>{},status:()=>({backend:'WebGPU compute',workerCount:0,queued:0,inFlight:0,recoveryPending:0,mainReplayCommands:0})};paintTelemetry=paintEngine.status;`);
// Extend saved V8 tuning in place; old saved values retain the new defaults.
const tuneEdit=(from,to)=>{assert(html.includes(from),'Missing tuning source: '+from);html=html.replace(from,to);};
tuneEdit('grab.distance*Math.exp(delta*.0017)','grab.distance*Math.exp(-delta*.0017)');
tuneEdit('if(grab&&!grab.manual)releaseGrab();}', 'if(grab&&!grab.manual)releaseGrab(true);}');
tuneEdit('coverage:1.12,damage:1,look:1','coverage:1.12,damage:1,smudge:1.6,abrasion:1,splatSize:1,ceilingDrips:1,carry:2,blastPower:1,fragility:1,look:1');
tuneEdit('damage:[.25,2.5],look:','damage:[.25,2.5],smudge:[0,4],abrasion:[0,4],splatSize:[.4,1.5],ceilingDrips:[0,1],carry:[1,4],blastPower:[.4,1.8],fragility:[.25,2],look:');
tuneEdit('drying:170,transfer:1.35','drying:170,transfer:1.35,smudge:2.6,abrasion:1.5');
tuneEdit("['Handling','Blood','Camera']","['Handling','Blood','Smudge','Effects','Camera']");
tuneEdit(":[['Mouse sensitivity','look'],['Field of view','fov']]",":tunePage==='smudge'?[['Smudge strength','smudge'],['Carry distance','carry'],['Scrape damage','abrasion'],['Wet transfer','transfer']]:tunePage==='effects'?[['Impact size','splatSize'],['Ceiling drips','ceilingDrips'],['Blast power','blastPower'],['Joint fragility','fragility']]:[['Mouse sensitivity','look'],['Field of view','fov']]");
tuneEdit("  }else{\n   button(player.fly?","  }else if(tunePage==='smudge'){\n   button('Heal dummies',x+26,yy+6,132,35,healAll);button('Wash dummies',x+166,yy+6,138,35,washBodies);\n   text('Smudge strength pushes existing wet paint along the drag.',x+26,yy+66,14,'#bcc7b7');\n   text('Repeated loaded scrapes wear the contact face and bleed more.',x+26,yy+91,14,'#bcc7b7');\n   text('Heal clears wear. Washing leaves injuries in place.',x+26,yy+116,14,'#bcc7b7');\n  }else{\n   button(player.fly?");
tuneEdit('x+26+i*111,y+69,104,34','x+26+i*104,y+69,98,34');
tuneEdit("  }else if(tunePage==='smudge'){","  }else if(tunePage==='effects'){\n   button('Gentler effects',x+26,yy+6,160,35,()=>{applyTuning({splatSize:.8,ceilingDrips:.35});saveTuning();notify('Smaller impacts and fewer ceiling drips.');});\n   button('V28 effects',x+198,yy+6,135,35,()=>{applyTuning({splatSize:1,ceilingDrips:1});saveTuning();notify('Original V28 impact and drip values.');});\n   text('Impact size changes spread, without changing injury or supply.',x+26,yy+66,14,'#bcc7b7');\n   text('Ceiling drips controls overhead runoff. Zero keeps it attached.',x+26,yy+91,14,'#bcc7b7');\n  }else if(tunePage==='smudge'){");
tuneEdit('Repeated loaded scrapes wear the contact face and bleed more.','Carry distance moves wet pigment farther along each stroke.');
tuneEdit("text('Heal clears wear. Washing leaves injuries in place.',x+26,yy+116,14,'#bcc7b7');",'');
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
// A reference session ignores persistence and leaves stored preferences intact.
html=html.replace('function saveTuning(){try{','function saveTuning(){if(window.__smearDefaults)return true;try{');
html=html.replace('try{const saved=localStorage.getItem(TUNING_KEY)', 'try{if(!window.__smearDefaults){const saved=localStorage.getItem(TUNING_KEY)').replace('if(saved===null&&legacy!==null)saveTuning();}catch(_){}','if(saved===null&&legacy!==null)saveTuning();}}catch(_){}');
html=html.replace("visible=localStorage.getItem(KEY)==='true'","visible=!window.__smearDefaults&&localStorage.getItem(KEY)==='true'").replace('localStorage.setItem(KEY,String(visible))','if(!window.__smearDefaults)localStorage.setItem(KEY,String(visible))');
const controlSource=await readFile('gpu/controls.js','utf8')+'\n'+await readFile('gpu/buddy-controls.js','utf8');
const inputStart=html.indexOf("canvas.addEventListener('contextmenu'");const inputEnd=html.indexOf("canvas.addEventListener('webglcontextlost'",inputStart);assert(inputStart>0&&inputEnd>inputStart);html=html.slice(0,inputStart)+controlSource+'\n'+html.slice(inputEnd);
html=html.replace('if(panel||demo)return;dt=', 'if(panel||demo||paused)return;dt=');
html=html.replaceAll("||keys.has('KeyC')",'');
html=html.replace('tool=clamp(t,0,2)','tool=clamp(t,0,4)').replace("'Spill wet blood. Clean bodies pick it up on contact.'][tool]","'Spill wet blood. Clean bodies pick it up on contact.','Spiked bat: close in and swing.','Grenade: throw, then stand back.'][tool]");
html=html.replace('const bw=105,gap=6,start=(W-(bw*3+gap*2))/2;','const bw=Math.min(105,(W-40)/5-6),gap=6,start=(W-(bw*5+gap*4))/2;').replace("for(let i=0;i<3;i++)button((i+1)+'  '+['Grab','Pistol','Spill'][i]","for(let i=0;i<5;i++)button((i+1)+'  '+['Grab','Pistol','Spill','Spiked bat','Grenade'][i]");
html=html.replace("Mouse look \u00b7 Right mouse aim \u00b7 Esc frees cursor","Mouse look | Hold C: free aim | Right mouse: aim | Esc: pause").replace("Right-drag look \u00b7 WASD move \u00b7 L locks mouse \u00b7 Tab controls","Click to play | WASD move | Hold C: free aim | Tab: controls");
html=html.replace("['Right mouse','Hold to look. In FPS mouse mode: aim the pistol.']","['Right mouse / C','Aim pistol / hold C for free aim and dragging.']").replace("['L / Esc','Lock the FPS mouse / release it safely.']","['Click / Esc','Capture mouse to play / pause and free cursor.']").replace("['1 / 2 / 3','Grab / Pistol / Spill. No separate shove tool.']","['1 / 2 / 3 / 4 / 5','Grab / Pistol / Spill / Spiked bat / Grenade.']").replace("Aim at the cursor, or press L for FPS mouse. Hold fire is supported.","Pistol: aim at the reticle. Hold C for free aim.");
html=html.replace('Left mouse interacts. Right mouse looks. WASD moves. Tab opens controls.','Click to play. Mouse looks. Hold C for free aim. WASD moves. Esc pauses. 4 equips the spiked bat.');
// Destroyed prop flags arrive with existing telemetry, never body poses.
html=html.replace('for(const b of staticBoxes){if(b.p.y-b.half.y>p.y+maxStep+.05)continue;','for(const b of staticBoxes){if(b.broken||b.p.y-b.half.y>p.y+maxStep+.05)continue;').replace('for(let pass=0;pass<2;pass++)for(const b of staticBoxes){','for(let pass=0;pass<2;pass++)for(const b of staticBoxes){if(b.broken)continue;');
html=html.replace("['Add dummy',106,addDummy]","['Add dummy',106,addDummy],['Restore buddy',118,()=>beginBuddyPlacement(true)]");
html=html.replace("['Q / E'", "['N / R','Place a new buddy / restore the last grabbed buddy.'],['Q / E'");
const hook=String.raw`
let computeLive=null,computeAccumulator=0,computeClock=performance.now(),computePulse=0,computeBooting=true;
const sourceRelease=releaseGrab,sourceSetTool=setTool;let grabSerial=0;
function resetToolTransient(){mouse.left=false;aimDown=false;shotClock=spillClock=computePulse=0;viewKick=recoilPitch=0;shotFlashUntil=-1;flash.visible=false;slide.position.z=0;cancelBat();}
setTool=t=>{cancelBuddyPlacement();sourceSetTool(t);resetToolTransient();};let thudsPlayed=0,lastThud=null;
const computeSpots=[[-4.9,-4.6],[-1.9,-4.8],[1.4,-4.5],[4.6,-4.2],[-5.2,-1.2],[-2.6,-.5],[2.8,-1.0],[5,.2],[-4.6,2.3]];
for(let i=dolls.length;i<12;i++){const p=computeSpots[i-3];newDoll(p[0],p[1],false,false);}
const fullBodies=[...bodies],fullDolls=[...dolls];let compute=null;
function computeInput(){getRay();if(grab&&!grab.manual){grab.desired.copy(raycaster.ray.direction).multiplyScalar(grab.distance).add(raycaster.ray.origin);grab.desired.y=clamp(grab.desired.y,-1.6,6.3);}return{grabID:grab?.serial||0,audioActive:soundOn&&audioUnlocked&&audio?.state==='running'&&!paused&&!panel&&!document.hidden,twist:(keys.has('KeyE')?1:0)-(keys.has('KeyQ')?1:0),rayO:raycaster.ray.origin.toArray(),rayD:raycaster.ray.direction.toArray(),left:mouse.left,tool,body:grab?grab.body.id-1:0,held:!!grab,local:grab?.local.toArray()||[0,0,0],target:grab?.desired.toArray()||[0,0,0],tune};}
function computeCounts(){dolls.length=bodies.length=0;dolls.push(...fullDolls.slice(0,compute.bodyCount/15));bodies.push(...fullBodies.slice(0,compute.bodyCount));lastHUDKey='';}
function computeFailure(error){$('failure').style.display='block';$('failure').textContent='SMEAR Compute: '+error.message;console.error(error);}
async function computeBoot(){
 compute=new SmearCompute({THREE:T,canvas,scene,camera,gun,slide,flash,grip,spillCan:null,dropMesh,brushes,bodies:fullBodies,dolls:fullDolls,joints,staticBoxes,surfaces,propBox:staticBox,input:computeInput,syncCounts:computeCounts,fail:computeFailure,impact:hit=>{if(!computeInput().audioActive)return;if(hit.melee){hitMarkerUntil=simTime+.16;hitMarkerColor=hit.body===255?'#c0c8bd':'#ead5a5';}if(hit.explosion)playExplosion(hit.strength);else playThud(hit.strength);thudsPlayed++;lastThud=hit;},picked:hit=>{if(!mouse.left||tool!==0||paused||panel)return;const b=fullBodies[hit.body];grab={serial:++grabSerial,body:b,local:new V(...hit.local),desired:new V(...hit.point),target:new V(...hit.point),distance:hit.distance,manual:false};if(selected?.doll!==b.doll)notify('Buddy '+b.doll.id+' selected. R: restore | N: add');selected=b;}});
 window.__smearGPU=compute;await compute.init();
 resetWorld=(resetCamera=true)=>{sourceRelease();selected=null;resetToolTransient();paused=false;demo=null;computeAccumulator=0;simTime=0;compute.reset();if(resetCamera)defaultView();};chaosScene=()=>{sourceRelease();selected=null;resetToolTransient();computeAccumulator=0;simTime=0;compute.reset(true);};cleanSurfaces=()=>compute.clean(false);washBodies=()=>{compute.clean(true);notify('Dummies washed; wounds remain.');};healAll=()=>{compute.heal();notify('Wounds healed; detached parts stay detached. R restores one buddy.');};stopBleeding=()=>{compute.stop();notify('Bleeding stopped.');};addDummy=()=>beginBuddyPlacement(false);startDemo=()=>{sourceRelease();selected=null;resetToolTransient();computeAccumulator=0;simTime=0;compute.reset();tool=0;viewAt(new V(4.3,4.2,6.1),new V(.1,.25,.6));demo={start:compute.steps/120,oldBlood:bloodScale};grab={serial:++grabSerial,body:fullBodies[14],local:new V(0,0,.1),target:new V(),desired:new V(),distance:4,manual:true};selected=grab.body;};
 shoot=()=>{if(simTime<shotClock)return;shotClock=simTime+.14;compute.shoot();stats.shots++;playShot();shotFlashUntil=simTime+.045;viewKick=Math.min(.23,viewKick+.14);};spill=()=>{if(simTime<spillClock)return;spillClock=simTime+.065;compute.spill();};releaseGrab=(fling=false)=>{if(grab&&fling&&!paused&&!panel&&!document.hidden){compute.release(computeInput());}const buddy=selected;sourceRelease();selected=buddy;};updateGrab=()=>computeInput();
 __smear.manual=v=>{manual=v;compute.manual=v;computeAccumulator=0;if(v){fpsControl.inspection=true;paused=false;syncControlMenu();}};__smear.step=n=>compute.step(n);__smear.rawStep=__smear.step;__smear.state=async()=>({...await compute.state(),name:'SMEAR',version:'0.35.0',simTime:compute.steps/120,grab:grab?.body.name||null,tool,paused,slow,tune:{...tune},player:{p:player.feet.toArray(),mode:player.fly?'fly':'walk'}});__smear.paintReady=()=>compute.device.queue.onSubmittedWorkDone();__smear.chaos=()=>chaosScene();__smear.reset=()=>resetWorld(true);__smear.add=()=>compute.add();__smear.buddy={begin:restore=>beginBuddyPlacement(!!restore),confirm:confirmBuddyPlacement,cancel:cancelBuddyPlacement,state:()=>({placement:compute.placement,busy:!!compute.buddyBusy,selected:selected?Math.floor((selected.id-1)/15):null})};__smear.clean=cleanSurfaces;__smear.wash=washBodies;__smear.heal=healAll;__smear.stopBleeding=stopBleeding;__smear.demo=startDemo;__smear.shoot=shoot;__smear.tool=setTool;__smear.melee=swingBat;__smear.props=()=>compute.propsState();__smear.grenade=throwGrenade;__smear.blast=p=>compute.blast(p);__smear.defaults=()=>{const u=new URL(location.href);u.searchParams.set("defaults","1");location.href=u.href;};__smear.controls={state:()=>({...fpsControl,locked:document.pointerLockElement===canvas,paused,tool,aim:aimXY(),yaw,pitch,batAge,batSwings,shots:stats.shots,aimDown,eye:player.eye,velocity:player.vel.toArray(),keys:[...keys],left:mouse.left}),mode:mode=>setControlMode(mode,false),pause:pauseControls,resume:requestLook};
 __smear.project=async(d,name)=>{const s=await compute.state(),i=fullBodies.findIndex(b=>b.doll.id===d+1&&b.name===name),p=new V(...s.parts[i].p).project(camera);return{x:(p.x*.5+.5)*W,y:(.5-p.y*.5)*H,world:s.parts[i].p};};
 __smear.grab=async(d,name,local=[0,0,0])=>{const s=await compute.state(),b=fullBodies.find(b=>b.doll.id===d+1&&b.name===name),p=new V(...local).applyQuaternion(new Q(...s.parts[b.id-1].q)).add(new V(...s.parts[b.id-1].p));grab={serial:++grabSerial,body:b,local:new V(...local),target:p.clone(),desired:p.clone(),distance:4,manual:true};selected=b;return p.toArray();};for(const key of ['velocity','agePaint','clearance','knock','bodyPaint','puddle','moveDoll','pose','hit','wallSpill','paintDump','sampleFloor','trace','paintFaces'])delete __smear[key];__smear.render=()=>compute.submit(0);__smear.view=(p,t)=>{viewAt(new V(...p),new V(...t));compute.submit(0);};__smear.target=p=>{if(grab)grab.desired.fromArray(p);};__smear.release=(fling=true)=>releaseGrab(fling);
 __smear.compute={status:()=>compute.status(),state:()=>compute.state(),paintHash:i=>compute.pigmentHash(i),audio:()=>({enabled:soundOn,state:audio?.state||'uninitialized',thuds:thudsPlayed,lastThud}),audioTap:()=>{startAudio();const tap=audio.createMediaStreamDestination();master.connect(tap);return tap;}};
 dirtyPaint.clear();dirtyWet.clear();
 computeBooting=false;computeClock=performance.now();$('loading')?.remove();window.__smearComputeReady=true;if(fpsControl.mode==='fps'){paused=true;fpsControl.phase='ready';}syncControlMenu();
}
frame=function(now){frameRequest=0;if(!running)return;const wall=performance.now(),elapsed=Math.max(0,(wall-computeClock)/1000);computeClock=wall;if(!compute?.ready){frameRequest=requestAnimationFrame(frame);return;}
 if(manual){runtimeProfiler.breakInterval();drawUI();runtimeProfiler.refresh();frameRequest=requestAnimationFrame(frame);return;}
 runtimeProfiler.begin(now,wall);let t=performance.now();const dt=Math.min(.075,elapsed);stats.frameMS=mix(stats.frameMS,dt*1000,.035);moveCamera(dt);tickControls(dt);if(compute.placement&&!paused)compute.placement.yaw+=((keys.has('KeyE')?1:0)-(keys.has('KeyQ')?1:0))*dt*1.8;updateTools(dt);compute.updateToolPresentation(dt,{tool,panel,time:simTime,left:mouse.left,batAge});computePulse-=dt;
 if(mouse.left&&!paused&&!panel&&!compute.placement&&tool!==0&&computePulse<=0){if(tool===1)shoot();else if(tool===2)spill();else if(tool===3)swingBat();else throwGrenade();computePulse=tool===1?.14:tool===2?.065:.08;}
 if(demo&&grab){const phase=compute.steps/120-demo.start;grab.desired.set(Math.sin(phase*.65)*1.6,.16+Math.max(0,Math.sin((phase-8)*.8))*1.8,.6+Math.cos(phase*.8));if(phase>14){releaseGrab();demo=null;}}
 runtimeProfiler.add('input',performance.now()-t);let steps=0;if(!paused&&!document.hidden){computeAccumulator+=dt*(slow?.25:1);steps=Math.min(10,Math.floor(computeAccumulator/STEP));computeAccumulator-=steps*STEP;}else computeAccumulator=0;
 t=performance.now();compute.submit(steps);simTime=compute.steps/120;stats.steps=compute.steps;renderer.info.render.calls=compute.draws.length*2+1;renderer.info.render.triangles=compute.triangles;computeLive=compute.status();runtimeProfiler.add('render',performance.now()-t);runtimeProfiler.add('steps',steps);
 t=performance.now();drawUI();updateScrape(compute.cache.scraping||0,0);runtimeProfiler.add('hud',performance.now()-t);runtimeProfiler.refresh();runtimeProfiler.finish(wall);frameRequest=requestAnimationFrame(frame);
};
computeBoot().catch(computeFailure);
`;
assert(html.includes('frameRequest=requestAnimationFrame(frame);\n})();'));
html=html.replace('frameRequest=requestAnimationFrame(frame);\n})();',hook+'\nframeRequest=requestAnimationFrame(frame);\n})();');
const shadersScript='window.__smearDefaults=new URLSearchParams(location.search).get("defaults")==="1";window.__smearLTC='+JSON.stringify(ltcData.toString('base64'))+';window.__smearComputeShaders='+JSON.stringify(shaders).replaceAll('<','\\u003c')+';';
html=html.replace('</body>','<script type="text/plain" id="ltc-notices">'+ltcNotice.replaceAll('<','&lt;')+'</script><script type="text/plain" id="ltc-fit-source">'+ltcFit.replaceAll('</script','<\\/script')+'</script></body>');
html=html.replace('</head>','<script>'+shadersScript+'\n'+stub+'\n'+runtime+'</script></head>');
html=html.replace("Six dummies. No runtime downloads. Three.js r140 embedded.","Twelve dummies. GPU simulation and rendering. Offline.").replace("World-planted procedural feet; physically assisted posing.","Compute driven ragdolls, droplets, smears and wall drips.");
html=html.replaceAll("version:'0.8.9'","version:'0.35.0'").replaceAll('08.9','35.0');
await writeFile('index.html',html,'utf8');console.log('Built offline index.html ('+Buffer.byteLength(html)+' bytes)');
