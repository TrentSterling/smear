// Lives in the retained game closure. Pointer lock is a play state, not a held button.
const fpsControl={mode:'fps',phase:'ready',freeAim:false,pending:false,error:'',inspection:false};
let controlMenuState=null;
try{if(!window.__smearDefaults&&localStorage.getItem('smear.controls.mode')==='cursor')fpsControl.mode='cursor';}catch{}
const controlOverlay=document.createElement('div');controlOverlay.id='play-menu';
controlOverlay.innerHTML='<section><small>SMEAR / 45</small><h1>Ready to make a mess?</h1><p id="play-message">Click to capture the mouse and play.</p><button id="play-resume">Enter the room</button><button id="play-cursor">Use free cursor</button><button id="play-defaults" style="margin-top:8px;background:none;color:#c8d1c8;border-color:#536461;font-size:12px">Restart with reference defaults</button></section>';
document.body.appendChild(controlOverlay);$('play-defaults').onclick=()=>{const u=new URL(location.href);u.searchParams.set('defaults','1');location.href=u.href;};
const controlStyle=document.createElement('style');controlStyle.textContent='#play-menu{position:fixed;inset:0;z-index:3;display:none;align-items:center;justify-content:center;pointer-events:none;background:rgba(13,24,25,.22)}#play-menu section{pointer-events:auto;width:min(430px,calc(100vw - 32px));padding:30px;background:#1b2929;color:#eae2cd;border:1px solid #607270;box-shadow:0 18px 65px #0007}#play-menu small{letter-spacing:3px;color:#cda956;font:700 11px Arial}#play-menu h1{font-size:34px;margin:12px 0}#play-menu p{font-size:14px;line-height:1.5;color:#c8d1c8}#play-menu button{cursor:pointer;width:100%;padding:13px 15px;font:700 15px Arial;border:1px solid #ddc591;background:#ddc591;color:#172b2e}#play-menu button:disabled{opacity:.55;cursor:wait}#play-menu .play-keys{font:13px/1.9 Arial;color:#b5c1bb;margin:18px 0}#play-menu #play-cursor{font-size:12px;padding:8px;background:none;border-color:#536461;color:#c8d1c8}';document.head.appendChild(controlStyle);
function clearPlayInput(keepPlacement=false){
 if(!keepPlacement)cancelBuddyPlacement();
 keys.clear();mouse.left=mouse.right=false;aimDown=false;activeSlider=null;player.jump=false;player.vel.set(0,0,0);fpsControl.freeAim=false;
 releaseGrab(false);shotFlashUntil=-1;viewKick=recoilPitch=aimBlend=0;flash.visible=false;slide.position.z=0;
 if(typeof compute!=='undefined'&&compute){compute.inputAction=0;compute.pickRequested=false;compute.pickEpoch++;}cancelBat();cancelBrawl();updateScrape(0,0);
}
function syncControlMenu(){
 const visible=(fpsControl.mode==='fps'||paused)&&!fpsControl.inspection&&!['playing','cursor','menu'].includes(fpsControl.phase)&&!compute?.placement&&!panel&&!runtimeProfiler.visible&&toybox.hidden;
 if(controlMenuState&&controlMenuState.visible===visible&&controlMenuState.phase===fpsControl.phase&&controlMenuState.pending===fpsControl.pending&&controlMenuState.error===fpsControl.error)return;
 controlMenuState={visible,phase:fpsControl.phase,pending:fpsControl.pending,error:fpsControl.error};
 controlOverlay.style.display=visible?'flex':'none';
 const button=$('play-resume');button.disabled=fpsControl.pending;button.textContent=fpsControl.pending?'Capturing mouse…':fpsControl.phase==='ready'?'Enter the room':'Resume';
 $('play-message').textContent=fpsControl.error||(fpsControl.phase==='ready'?'Click to capture the mouse and play.':'Paused. Your mouse is free for the menus.');
}
// Intentional cursor release is distinct from browser Escape/focus loss.
// Only a subsequent click or Tab requests capture; menu dismissal never does.
function freeCursor(){
 clearPlayInput(true);fpsControl.pending=false;fpsControl.error='';fpsControl.phase='cursor';paused=false;stickyLook=temporaryLook=false;
 if(document.pointerLockElement===canvas)document.exitPointerLock();syncControlMenu();
}
function pauseControls(){
 clearPlayInput();fpsControl.pending=false;fpsControl.phase='paused';paused=true;stickyLook=false;temporaryLook=false;
 if(document.pointerLockElement===canvas)document.exitPointerLock();syncControlMenu();
}
function controlLockFailed(){fpsControl.pending=false;fpsControl.phase='paused';paused=true;fpsControl.error='Mouse capture was blocked. Click Resume to retry, or use free cursor.';syncControlMenu();}
requestLook=()=>{
 if(fpsControl.pending||!compute?.ready)return;
 panel=null;activeSlider=null;clearPlayInput(true);fpsControl.error='';fpsControl.pending=true;fpsControl.phase='requesting';paused=true;
 try{const result=canvas.requestPointerLock();if(result?.catch)result.catch(controlLockFailed);}catch{controlLockFailed();}syncControlMenu();
};
unlockLook=()=>{clearPlayInput();stickyLook=false;temporaryLook=false;if(document.pointerLockElement===canvas)document.exitPointerLock();};
toggleLook=()=>{if(document.pointerLockElement===canvas)freeCursor();else requestLook();};
const panelWithoutLock=openPanel;
openPanel=p=>{panelWithoutLock(p);if(!fpsControl.inspection&&fpsControl.mode==='fps'){if(p){pauseControls();fpsControl.phase='menu';}else pauseControls();}syncControlMenu();};
const profilerWithoutLock=runtimeProfiler.show;
runtimeProfiler.show=value=>{if(!fpsControl.inspection&&(value===true||(value===undefined&&!runtimeProfiler.visible)))pauseControls();profilerWithoutLock(value);syncControlMenu();};
aimXY=()=>{
 if(document.pointerLockElement===canvas){
  if(fpsControl.freeAim)return{x:mouse.x,y:mouse.y};
  if(grab?.rayOffset)return{x:(grab.rayOffset.x*.5+.5)*W,y:(.5-grab.rayOffset.y*.5)*H};
  return{x:W/2,y:H/2};
 }
 return{x:mouse.x,y:mouse.y};
};
function freeAimEnd(){
 if(!fpsControl.freeAim)return;
 // Keep a carried body's ray at the same point on the screen until release.
 // Recentring it abruptly would manufacture a throw on the C-key transition.
 if(grab)grab.rayOffset={x:mouse.x/W*2-1,y:1-mouse.y/H*2};
 fpsControl.freeAim=false;if(!grab){mouse.x=W/2;mouse.y=H/2;}
}
function setControlMode(mode,persist=true){
 clearPlayInput();fpsControl.mode=mode==='cursor'?'cursor':'fps';fpsControl.inspection=false;fpsControl.error='';
 if(persist&&!window.__smearDefaults)try{localStorage.setItem('smear.controls.mode',fpsControl.mode);}catch{}
 if(fpsControl.mode==='fps'){pauseControls();}else{fpsControl.phase='playing';paused=false;unlockLook();}syncControlMenu();
}
$('play-resume').onclick=()=>{startAudio();if(fpsControl.mode==='cursor')setControlMode('cursor');else requestLook();};$('play-cursor').onclick=()=>setControlMode('cursor');
canvas.addEventListener('contextmenu',e=>e.preventDefault());
window.addEventListener('pointerdown',e=>{
 if(e.target!==canvas&&e.target!==hud)return;canvas.focus({preventScroll:true});if(!document.pointerLockElement){mouse.x=e.clientX;mouse.y=e.clientY;}startAudio();
 if(e.button===0&&(!document.pointerLockElement||fpsControl.freeAim)){const button=(showHUD||panel)?uiAt(mouse.x,mouse.y):null;if(button){if(document.pointerLockElement===canvas)freeCursor();pressedUI=true;runtimeProfiler.action(button.label,button.action);return;}}
 if(panel)return;
 if(fpsControl.mode==='fps'&&!fpsControl.inspection&&!compute.placement&&document.pointerLockElement!==canvas){if(e.button===0||e.button===2){e.preventDefault();requestLook();}return;}
 if(paused)return;
 if(e.button===2){e.preventDefault();if(document.pointerLockElement===canvas||tool>=6){mouse.right=true;aimDown=tool===1;if(tool===10)compute.secondary();if(tool===11)compute.detonateCharges();}else requestLook();return;}
 if(e.button!==0)return;if(compute.placement){confirmBuddyPlacement();return;}pressedUI=false;if(demo)releaseGrab(false);mouse.left=true;
 if(tool===0&&(compute.cache.control&255)&&!grab){mouse.left=false;compute.interactMachine();}else if(tool===0)compute.pick();else if(tool===1)shoot();else if(tool===2)spill();else if(tool===3)swingBat();else if(tool===4)throwGrenade();else if(tool===5)fireRocket();else if(tool===11)throwSticky();else if(tool===12)fireShotgun();else if(tool===13)fireSaw();
});
window.addEventListener('pointerup',e=>{
 if(e.button===0){if(activeSlider){saveTuning();activeSlider=null;}mouse.left=false;pressedUI=false;if(grab&&!grab.manual)releaseGrab(true);if(!fpsControl.freeAim&&document.pointerLockElement===canvas){mouse.x=W/2;mouse.y=H/2;}}
 if(e.button===2){mouse.right=false;aimDown=false;}
});
window.addEventListener('pointermove',e=>{
 if(activeSlider){mouse.x=e.clientX;mouse.y=e.clientY;slideAt(mouse.x);return;}
 if(document.pointerLockElement===canvas){
  if(paused||panel)return;
  if(fpsControl.freeAim){mouse.x=clamp(mouse.x+e.movementX,4,W-4);mouse.y=clamp(mouse.y+e.movementY,4,H-4);}
  else{const sensitivity=.00215*tune.look*(aimDown?.74:1);yaw-=e.movementX*sensitivity;pitch=clamp(pitch-e.movementY*sensitivity,-1.48,1.46);camera.rotation.set(clamp(pitch+recoilPitch,-1.48,1.47),yaw,0,'YXZ');}
  updateGrab();return;
 }
 mouse.x=e.clientX;mouse.y=e.clientY;if(!paused)updateGrab();
});
window.addEventListener('wheel',e=>{if(e.target.closest?.('#runtime-profile,#play-menu,#toybox,input,textarea,select')||panel||paused)return;e.preventDefault();if(grab&&!paused){grab.distance=clamp(grab.distance*Math.exp(-clamp(e.deltaY,-180,180)*.0017),.55,20);updateGrab();}else if(!compute.placement&&e.deltaY!==0)setTool((tool+(e.deltaY>0?1:13))%14);},{passive:false});
window.addEventListener('keydown',e=>{
 if(e.code==='F3'){e.preventDefault();if(!e.repeat){if(!fpsControl.inspection)pauseControls();runtimeProfiler.show();syncControlMenu();}return;}
 if(!toybox.hidden){if(e.code==='Escape'||(e.code==='KeyB'&&e.target!==$('toy-search'))){e.preventDefault();closeToybox();}return;}
 if(e.target.closest?.('#runtime-profile,input,textarea,select'))return;
 if(['Space','Tab','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyC'].includes(e.code))e.preventDefault();if(e.repeat)return;startAudio();
 if(e.code==='Escape'){if(compute?.placement){cancelBuddyPlacement();notify('Placement cancelled.');return;}panel=null;if(fpsControl.mode==='fps'&&!fpsControl.inspection)pauseControls();else{clearPlayInput();unlockLook();paused=false;}return;}
 if(e.code==='Tab'){if(panel)openPanel(null);else toggleLook();return;}
 if(e.code==='KeyP'||e.code==='KeyL'){if(paused||document.pointerLockElement!==canvas)requestLook();else pauseControls();return;}
 if(e.code==='KeyB'&&!panel){openToybox();return;}if(panel||paused)return;keys.add(e.code);
 if(e.code==='KeyE'&&!grab&&!compute.placement){compute.interactMachine();return;}
 if(e.code==='KeyB'){openToybox();return;}if(e.code==='Delete'){removeSelectedToy();return;}
 if(e.code==='KeyN'){beginBuddyPlacement(false);return;}if(e.code==='KeyR'){beginBuddyPlacement(true);return;}
 if(e.code==='KeyC'&&document.pointerLockElement===canvas){const p=aimXY();mouse.x=p.x;mouse.y=p.y;fpsControl.freeAim=true;if(grab)grab.rayOffset=null;}
 if(/^Digit[0-9]$/.test(e.code))setTool((Number(e.code.at(-1))+9)%10);
 if(e.code==='Minus')setTool(10);if(e.code==='Equal')setTool(11);if(e.code==='KeyZ')setTool(12);if(e.code==='KeyJ')setTool(13);
 if(e.code==='BracketLeft')setTool((tool+13)%14);if(e.code==='BracketRight')setTool((tool+1)%14);
 if(e.code==='KeyK')swingBrawl(true);if(e.code==='KeyU')swingBrawl(false);if(e.code==='KeyG')compute.detonateCharges();if(e.code==='KeyX')compute.toggleDevice(selectedProp??-1);
 if(e.code==='KeyF')toggleFly();if(e.code==='Space')player.jump=true;
 if(e.code==='KeyT'){slow=!slow;notify(slow?'Slow motion: 0.25x | T: normal speed':'Normal speed | T: slow motion');}if(e.code==='KeyH')showHUD=!showHUD;if(e.code==='KeyV')toggleRecovery();
});
window.addEventListener('keyup',e=>{keys.delete(e.code);if(e.code==='KeyC')freeAimEnd();});
window.addEventListener('blur',()=>{if(!fpsControl.inspection)pauseControls();else clearPlayInput();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&!fpsControl.inspection)pauseControls();});
document.addEventListener('pointerlockerror',controlLockFailed);
document.addEventListener('pointerlockchange',()=>{
 const locked=document.pointerLockElement===canvas;canvas.style.cursor=locked?'none':'default';
 // A menu release can still have its change event queued when the player
 // deliberately presses Tab again. That older event cannot cancel the request.
 if(!locked&&fpsControl.pending&&fpsControl.phase==='requesting')return;
 if(locked&&fpsControl.phase==='playing')return;
 fpsControl.pending=false;
 if(locked&&fpsControl.phase!=='requesting'){document.exitPointerLock();return;}
 if(locked){clearPlayInput(true);stickyLook=true;temporaryLook=false;fpsControl.phase='playing';paused=false;mouse.x=W/2;mouse.y=H/2;}
 else{const intentional=['cursor','menu','placing'].includes(fpsControl.phase);clearPlayInput(intentional);stickyLook=false;temporaryLook=false;if(fpsControl.mode==='fps'&&!fpsControl.inspection&&!intentional){fpsControl.phase='paused';paused=true;}}
 syncControlMenu();
});
let batAge=10,batStrikePending=false,batSwings=0;
function cancelBat(){batAge=10;batStrikePending=false;}
function swingBat(){
 if(paused||panel||tool!==3||batAge<.64)return;batAge=0;batStrikePending=true;batSwings++;
 startAudio();if(audio&&soundOn&&noiseBuf){const s=audio.createBufferSource(),f=audio.createBiquadFilter(),g=audio.createGain(),t=audio.currentTime;s.buffer=noiseBuf;f.type='bandpass';f.frequency.setValueAtTime(300,t);f.frequency.exponentialRampToValueAtTime(1700,t+.13);f.Q.value=.7;g.gain.setValueAtTime(.001,t);g.gain.exponentialRampToValueAtTime(.17,t+.12);g.gain.exponentialRampToValueAtTime(.001,t+.25);s.connect(f);f.connect(g);g.connect(master);s.start(t);s.stop(t+.26);}
}
let brawlAge=10,brawlKick=true,brawlPending=false;
function cancelBrawl(){brawlAge=10;brawlPending=false;}
function swingBrawl(kick){if(paused||panel||compute.placement||brawlAge<.60)return;releaseGrab(false);mouse.left=false;cancelBat();brawlAge=0;brawlKick=kick;brawlPending=true;startAudio();weaponNoise(360,1100,.18,.10);}
function tickControls(dt){
 if(paused||panel)cancelBrawl();else{brawlAge+=dt;if(brawlPending&&brawlAge>=.14){brawlPending=false;compute.inputAction=brawlKick?21:22;}}
 if(fpsControl.mode==='fps'&&!fpsControl.inspection&&!['playing','cursor'].includes(fpsControl.phase)&&!compute?.placement)paused=true;
 if(paused||panel||tool!==3)cancelBat();else{batAge+=dt;if(batStrikePending&&batAge>=.16){batStrikePending=false;compute.melee();}}
 syncControlMenu();
 updateControlHints();
 tickUtilityAudio();
}

function updateControlHints(){}

let utilityAudio=null;
function tickUtilityAudio(){
 const working=tool>=6&&tool<=10&&(mouse.left||mouse.right)&&!paused&&!panel&&!document.hidden&&soundOn;
 if(!audio||audio.state!=='running')return;
 if(!utilityAudio&&working&&noiseBuf){const noise=audio.createBufferSource(),filter=audio.createBiquadFilter(),gain=audio.createGain(),motor=audio.createOscillator(),motorGain=audio.createGain();noise.buffer=noiseBuf;noise.loop=true;filter.type='lowpass';noise.connect(filter);filter.connect(gain);gain.connect(master);motor.type='triangle';motor.connect(motorGain);motorGain.connect(master);gain.gain.value=motorGain.gain.value=0;noise.start();motor.start();utilityAudio={filter,gain,motor,motorGain};}
 if(!utilityAudio)return;const t=audio.currentTime;utilityAudio.filter.frequency.setTargetAtTime(tool===8?3700:tool===6?900:1500,t,.04);utilityAudio.motor.frequency.setTargetAtTime(tool===10?105:tool===9?170:80,t,.05);utilityAudio.gain.gain.setTargetAtTime(working?(tool===6?.055:.10):0,t,.03);utilityAudio.motorGain.gain.setTargetAtTime(working&&tool!==6?.035:0,t,.03);
}

let grenadeClock=-1,rocketClock=-1,rocketFiredAt=-1e9,stickyClock=-1;
function throwSticky(){if(paused||panel||tool!==11||performance.now()<stickyClock)return;stickyClock=performance.now()+450;compute.sticky();}
function fireRocket(){if(paused||panel||tool!==5||performance.now()<rocketClock)return;rocketFiredAt=performance.now();rocketClock=rocketFiredAt+320;compute.rocket();startAudio();if(audio&&soundOn&&noiseBuf){const t=audio.currentTime,s=audio.createBufferSource(),f=audio.createBiquadFilter(),g=audio.createGain();s.buffer=noiseBuf;f.type="bandpass";f.frequency.setValueAtTime(650,t);f.frequency.exponentialRampToValueAtTime(140,t+.3);g.gain.setValueAtTime(.40,t);g.gain.exponentialRampToValueAtTime(.001,t+.45);s.connect(f);f.connect(g);g.connect(master);s.start(t);s.stop(t+.46);}}
function throwGrenade(){if(paused||panel||tool!==4||performance.now()<grenadeClock)return;grenadeClock=performance.now()+750;compute.grenade();}
let shotgunClock=-1,sawClock=-1,arsenalFiredAt=-1e9;
function weaponNoise(frequency,end,duration,volume,delay=0){
 if(!audio||!soundOn||!noiseBuf)return;const t=audio.currentTime+delay,s=audio.createBufferSource(),f=audio.createBiquadFilter(),g=audio.createGain();s.buffer=noiseBuf;f.type='bandpass';f.Q.value=.7;f.frequency.setValueAtTime(frequency,t);f.frequency.exponentialRampToValueAtTime(end,t+duration);g.gain.setValueAtTime(volume,t);g.gain.exponentialRampToValueAtTime(.001,t+duration);s.connect(f);f.connect(g);g.connect(master);s.start(t);s.stop(t+duration+.01);
}
function weaponTone(start,end,duration,volume,type='triangle'){
 if(!audio||!soundOn)return;const t=audio.currentTime,o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.setValueAtTime(start,t);o.frequency.exponentialRampToValueAtTime(end,t+duration);g.gain.setValueAtTime(volume,t);g.gain.exponentialRampToValueAtTime(.001,t+duration);o.connect(g);g.connect(master);o.start(t);o.stop(t+duration+.01);
}
function fireShotgun(){
 const now=performance.now();if(paused||panel||tool!==12||now<shotgunClock)return;shotgunClock=now+700;arsenalFiredAt=now;compute.shotgun();startAudio();weaponNoise(3500,110,.25,.55);weaponTone(105,31,.28,.30);weaponNoise(1800,650,.06,.10,.28);weaponNoise(900,2200,.08,.09,.40);
}
function fireSaw(){
 const now=performance.now();if(paused||panel||tool!==13||now<sawClock)return;sawClock=now+480;arsenalFiredAt=now;compute.saw();startAudio();weaponTone(160,820,.20,.07,'sawtooth');weaponNoise(1800,4300,.23,.17);weaponTone(85,40,.10,.12);
}
function playSawImpact(strength,solid){
 if(solid){weaponTone(2400,770,.17,.08*strength,'square');weaponNoise(5200,1300,.11,.14*strength);}else{weaponNoise(720,130,.18,.24*strength);weaponTone(170,47,.13,.08*strength,'sawtooth');}
}
function playExplosion(strength){
 startAudio();if(!audio||!soundOn||!noiseBuf)return;const t=audio.currentTime,s=audio.createBufferSource(),f=audio.createBiquadFilter(),g=audio.createGain(),o=audio.createOscillator(),low=audio.createGain();s.buffer=noiseBuf;f.type='lowpass';f.frequency.setValueAtTime(4200,t);f.frequency.exponentialRampToValueAtTime(100,t+.65);g.gain.setValueAtTime(.55*strength,t);g.gain.exponentialRampToValueAtTime(.001,t+.8);s.connect(f);f.connect(g);g.connect(master);s.start(t);s.stop(t+.85);o.frequency.setValueAtTime(85,t);o.frequency.exponentialRampToValueAtTime(27,t+.4);low.gain.setValueAtTime(.45*strength,t);low.gain.exponentialRampToValueAtTime(.001,t+.55);o.connect(low);low.connect(master);o.start(t);o.stop(t+.6);
}

function playMachineImpact(strength,kind){if(kind===1){weaponTone(160,570,.22,.14*strength);weaponNoise(1900,300,.16,.15*strength);}else{weaponTone(65,25,.32,.3*strength);weaponNoise(900,90,.30,.24*strength);}}
function playJunkImpact(strength,material){
 const level=.12+.13*strength;
 if(material===0){for(let i=0;i<6;i++)weaponTone(1800+i*421,700+i*283,.10+i*.035,level/(i+2),'sine');weaponNoise(7000,2400,.23,level);}
 else if(material===1){weaponNoise(3400,450,.19,level*1.3);weaponTone(620,210,.22,level,'triangle');}
 else{weaponTone(870,160,.34,level,'triangle');weaponTone(1320,480,.16,level*.5,'sine');weaponNoise(5200,1400,.10,level*.6);}
}
