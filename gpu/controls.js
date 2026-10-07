// Lives in the retained game closure. Pointer lock is a play state, not a held button.
const fpsControl={mode:'fps',phase:'ready',freeAim:false,pending:false,error:'',inspection:false};
let controlMenuState=null;
try{if(!window.__smearDefaults&&localStorage.getItem('smear.controls.mode')==='cursor')fpsControl.mode='cursor';}catch{}
const controlOverlay=document.createElement('div');controlOverlay.id='play-menu';
controlOverlay.innerHTML='<section><small>SMEAR / PLAY</small><h1>Leave a mark.</h1><p id="play-message">Click to capture the mouse and play.</p><button id="play-resume">Enter the room</button><div class="play-keys">WASD move · Mouse look · Shift run<br>Hold C for free aim · Esc pauses<br>1 Grab · 2 Pistol · 3 Spill · 4 Spiked bat · 5 Grenade</div><button id="play-cursor">Use free cursor</button><button id="play-defaults" style="margin-top:8px;background:none;color:#c8d1c8;border-color:#536461;font-size:12px">Restart with reference defaults</button></section>';
document.body.appendChild(controlOverlay);$('play-defaults').onclick=()=>{const u=new URL(location.href);u.searchParams.set('defaults','1');location.href=u.href;};
const controlStyle=document.createElement('style');controlStyle.textContent='#play-menu{position:fixed;inset:0;z-index:3;display:none;align-items:center;justify-content:center;pointer-events:none;background:rgba(13,24,25,.22)}#play-menu section{pointer-events:auto;width:min(430px,calc(100vw - 32px));padding:30px;background:#1b2929;color:#eae2cd;border:1px solid #607270;box-shadow:0 18px 65px #0007}#play-menu small{letter-spacing:3px;color:#cda956;font:700 11px Arial}#play-menu h1{font-size:34px;margin:12px 0}#play-menu p{font-size:14px;line-height:1.5;color:#c8d1c8}#play-menu button{cursor:pointer;width:100%;padding:13px 15px;font:700 15px Arial;border:1px solid #ddc591;background:#ddc591;color:#172b2e}#play-menu button:disabled{opacity:.55;cursor:wait}#play-menu .play-keys{font:13px/1.9 Arial;color:#b5c1bb;margin:18px 0}#play-menu #play-cursor{font-size:12px;padding:8px;background:none;border-color:#536461;color:#c8d1c8}';document.head.appendChild(controlStyle);
function clearPlayInput(){
 keys.clear();mouse.left=mouse.right=false;aimDown=false;activeSlider=null;player.jump=false;player.vel.set(0,0,0);fpsControl.freeAim=false;
 releaseGrab(false);shotFlashUntil=-1;viewKick=recoilPitch=aimBlend=0;flash.visible=false;slide.position.z=0;
 if(typeof compute!=='undefined'&&compute){compute.inputAction=0;compute.pickRequested=false;compute.pickEpoch++;}cancelBat();updateScrape(0,0);
}
function syncControlMenu(){
 const visible=(fpsControl.mode==='fps'||paused)&&!fpsControl.inspection&&fpsControl.phase!=='playing'&&!panel&&!runtimeProfiler.visible;
 if(controlMenuState&&controlMenuState.visible===visible&&controlMenuState.phase===fpsControl.phase&&controlMenuState.pending===fpsControl.pending&&controlMenuState.error===fpsControl.error)return;
 controlMenuState={visible,phase:fpsControl.phase,pending:fpsControl.pending,error:fpsControl.error};
 controlOverlay.style.display=visible?'flex':'none';
 const button=$('play-resume');button.disabled=fpsControl.pending;button.textContent=fpsControl.pending?'Capturing mouse…':fpsControl.phase==='ready'?'Enter the room':'Resume';
 $('play-message').textContent=fpsControl.error||(fpsControl.phase==='ready'?'Click to capture the mouse and play.':'Paused. Your mouse is free for the menus.');
}
function pauseControls(){
 clearPlayInput();fpsControl.pending=false;fpsControl.phase='paused';paused=true;stickyLook=false;temporaryLook=false;
 if(document.pointerLockElement===canvas)document.exitPointerLock();syncControlMenu();
}
function controlLockFailed(){fpsControl.pending=false;fpsControl.phase='paused';paused=true;fpsControl.error='Mouse capture was blocked. Click Resume to retry, or use free cursor.';syncControlMenu();}
requestLook=()=>{
 if(fpsControl.pending||!compute?.ready)return;
 panel=null;activeSlider=null;clearPlayInput();fpsControl.error='';fpsControl.pending=true;fpsControl.phase='requesting';paused=true;
 try{const result=canvas.requestPointerLock();if(result?.catch)result.catch(controlLockFailed);}catch{controlLockFailed();}syncControlMenu();
};
unlockLook=()=>{clearPlayInput();stickyLook=false;temporaryLook=false;if(document.pointerLockElement===canvas)document.exitPointerLock();};
toggleLook=()=>{if(document.pointerLockElement===canvas)pauseControls();else requestLook();};
const panelWithoutLock=openPanel;
openPanel=p=>{panelWithoutLock(p);if(!fpsControl.inspection&&fpsControl.mode==='fps'){pauseControls();}syncControlMenu();};
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
 if(e.button===0&&!document.pointerLockElement){const button=(showHUD||panel)?uiAt(mouse.x,mouse.y):null;if(button){pressedUI=true;runtimeProfiler.action(button.label,button.action);return;}}
 if(panel)return;
 if(fpsControl.mode==='fps'&&!fpsControl.inspection&&document.pointerLockElement!==canvas){if(e.button===0||e.button===2){e.preventDefault();requestLook();}return;}
 if(paused)return;
 if(e.button===2){e.preventDefault();if(document.pointerLockElement===canvas){mouse.right=true;aimDown=tool===1;}else requestLook();return;}
 if(e.button!==0)return;pressedUI=false;if(demo)releaseGrab(false);mouse.left=true;
 if(tool===0)compute.pick();else if(tool===1)shoot();else if(tool===2)spill();else if(tool===3)swingBat();else throwGrenade();
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
window.addEventListener('wheel',e=>{if(e.target.closest?.('#runtime-profile,#play-menu'))return;e.preventDefault();if(grab&&!paused){grab.distance=clamp(grab.distance*Math.exp(-clamp(e.deltaY,-180,180)*.0017),.55,20);updateGrab();}},{passive:false});
window.addEventListener('keydown',e=>{
 if(e.code==='F3'){e.preventDefault();if(!e.repeat){if(!fpsControl.inspection)pauseControls();runtimeProfiler.show();syncControlMenu();}return;}
 if(e.target.closest?.('#runtime-profile,input,textarea,select'))return;
 if(['Space','Tab','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyC'].includes(e.code))e.preventDefault();if(e.repeat)return;startAudio();
 if(e.code==='Escape'){panel=null;if(fpsControl.mode==='fps'&&!fpsControl.inspection)pauseControls();else{clearPlayInput();unlockLook();paused=false;}return;}
 if(e.code==='Tab'){openPanel(panel?null:'controls');return;}
 if(e.code==='KeyP'||e.code==='KeyL'){if(paused||document.pointerLockElement!==canvas)requestLook();else pauseControls();return;}
 if(panel||paused)return;keys.add(e.code);
 if(e.code==='KeyC'&&document.pointerLockElement===canvas){const p=aimXY();mouse.x=p.x;mouse.y=p.y;fpsControl.freeAim=true;if(grab)grab.rayOffset=null;}
 if(/^Digit[1-5]$/.test(e.code))setTool(Number(e.code.at(-1))-1);
 if(e.code==='KeyF')toggleFly();if(e.code==='Space')player.jump=true;
 if(e.code==='KeyT')slow=!slow;if(e.code==='KeyH')showHUD=!showHUD;if(e.code==='KeyV')toggleRecovery();
});
window.addEventListener('keyup',e=>{keys.delete(e.code);if(e.code==='KeyC')freeAimEnd();});
window.addEventListener('blur',()=>{if(!fpsControl.inspection)pauseControls();else clearPlayInput();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&!fpsControl.inspection)pauseControls();});
document.addEventListener('pointerlockerror',controlLockFailed);
document.addEventListener('pointerlockchange',()=>{
 const locked=document.pointerLockElement===canvas;canvas.style.cursor=locked?'none':'default';fpsControl.pending=false;
 if(locked&&fpsControl.phase!=='requesting'){document.exitPointerLock();return;}
 if(locked){clearPlayInput();stickyLook=true;temporaryLook=false;fpsControl.phase='playing';paused=false;mouse.x=W/2;mouse.y=H/2;}
 else{clearPlayInput();stickyLook=false;temporaryLook=false;if(fpsControl.mode==='fps'&&!fpsControl.inspection){fpsControl.phase='paused';paused=true;}}
 syncControlMenu();
});
let batAge=10,batStrikePending=false,batSwings=0;
function cancelBat(){batAge=10;batStrikePending=false;}
function swingBat(){
 if(paused||panel||tool!==3||batAge<.64)return;batAge=0;batStrikePending=true;batSwings++;
 startAudio();if(audio&&soundOn&&noiseBuf){const s=audio.createBufferSource(),f=audio.createBiquadFilter(),g=audio.createGain(),t=audio.currentTime;s.buffer=noiseBuf;f.type='bandpass';f.frequency.setValueAtTime(300,t);f.frequency.exponentialRampToValueAtTime(1700,t+.13);f.Q.value=.7;g.gain.setValueAtTime(.001,t);g.gain.exponentialRampToValueAtTime(.17,t+.12);g.gain.exponentialRampToValueAtTime(.001,t+.25);s.connect(f);f.connect(g);g.connect(master);s.start(t);s.stop(t+.26);}
}
function tickControls(dt){
 if(fpsControl.mode==='fps'&&!fpsControl.inspection&&fpsControl.phase!=='playing')paused=true;
 if(paused||panel||tool!==3)cancelBat();else{batAge+=dt;if(batStrikePending&&batAge>=.16){batStrikePending=false;compute.melee();}}
 syncControlMenu();
}

let grenadeClock=-1;
function throwGrenade(){if(paused||panel||tool!==4||performance.now()<grenadeClock)return;grenadeClock=performance.now()+750;compute.grenade();}
function playExplosion(strength){
 startAudio();if(!audio||!soundOn||!noiseBuf)return;const t=audio.currentTime,s=audio.createBufferSource(),f=audio.createBiquadFilter(),g=audio.createGain(),o=audio.createOscillator(),low=audio.createGain();s.buffer=noiseBuf;f.type='lowpass';f.frequency.setValueAtTime(4200,t);f.frequency.exponentialRampToValueAtTime(100,t+.65);g.gain.setValueAtTime(.55*strength,t);g.gain.exponentialRampToValueAtTime(.001,t+.8);s.connect(f);f.connect(g);g.connect(master);s.start(t);s.stop(t+.85);o.frequency.setValueAtTime(85,t);o.frequency.exponentialRampToValueAtTime(27,t+.4);low.gain.setValueAtTime(.45*strength,t);low.gain.exponentialRampToValueAtTime(.001,t+.55);o.connect(low);low.connect(master);o.start(t);o.stop(t+.6);
}
