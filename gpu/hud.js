// A single quiet gameplay HUD. Actions live in the menu; machines have real switches.
const playHUD=document.createElement('div');playHUD.id='play-hud';playHUD.hidden=true;playHUD.innerHTML='<div id="tool-readout"><div id="equipped-tool"></div><div id="weapon-ammo"></div></div><div id="play-state"></div><div id="interaction-hint"></div><div id="play-toast" role="status"></div>';document.body.appendChild(playHUD);
const menuLinks=document.createElement('div');menuLinks.className='menu-links';
for(const [id,title,action]of [['play-toys','Toybox',openToybox],['play-tune','Settings',()=>openPanel('tune')],['play-help','Controls',()=>{$('play-help-content').hidden=!$('play-help-content').hidden;}],['play-about','About',()=>openPanel('about')],['play-sound','Sound: on',()=>{soundOn=!soundOn;$('play-sound').textContent='Sound: '+(soundOn?'on':'off');updateScrape(0,0);} ]]){const b=document.createElement('button');b.id=id;b.textContent=title;b.onclick=action;menuLinks.append(b);}
$('play-resume').after(menuLinks);
const help=document.createElement('div');help.id='play-help-content';help.hidden=true;help.innerHTML='<p>WASD move · Shift run · Space jump · F fly<br>Right mouse: grab with any weapon<br>Y: alternate action / pistol aim<br>Mouse wheel: change tool · B: Toybox<br>E: use machine switch · 1: grab<br>While holding: wheel moves, Q/E rotates<br>R: reload (Grab: restore buddy) · I: inspect<br>K: kick · U: shove · T: slow motion<br>Tab: free mouse / capture · Esc: pause<br>Hold C: move aim without turning<br>F3: profiler · H: hide HUD</p>';$('play-cursor').before(help);help.append($('play-cursor'),$('play-defaults'));
controlStyle.textContent+=`#play-menu{background:#0b191a80}#play-menu section{box-sizing:border-box;width:min(390px,calc(100vw - 32px));padding:26px;max-height:calc(100vh - 40px);overflow:auto;box-shadow:none}#play-menu h1{font-size:30px;margin:10px 0}#play-menu .menu-links{display:grid;grid-template-columns:1fr 1fr;margin:10px 0 16px;gap:6px}#play-menu .menu-links button{background:none;color:#d9e1d7;border-color:#425a58;text-align:left;font-size:14px;padding:11px}#play-menu button:hover{filter:brightness(1.16)}#play-menu button:focus-visible{outline:2px solid #eee0bd;outline-offset:3px}#play-menu #play-defaults{font-size:11px!important}#play-help-content[hidden]{display:none}
#play-hud{pointer-events:none;color:#fff5df;font:16px Arial;--aim-x:50vw;--aim-y:50vh}#play-hud[hidden]{display:none}
#tool-readout{position:fixed;left:calc(var(--aim-x) + 30px);top:calc(var(--aim-y) - 18px);padding:8px 12px;background:#0c181dea;border-left:2px solid #e2c585;min-width:90px}
#play-hud #equipped-tool{position:static;transform:none;font-size:22px;line-height:1.2;letter-spacing:.2px;text-align:left}
#weapon-ammo{font-size:16px;line-height:1.4;color:#f4d69a}
#play-state{position:fixed;left:var(--aim-x);top:calc(var(--aim-y) + 65px);transform:translateX(-50%);padding:6px 10px;background:#0c181dea;color:#e6ece9;font-size:16px;white-space:nowrap;transition:opacity .35s}
#play-state:empty{display:none}#interaction-hint{position:fixed;top:calc(var(--aim-y) + 108px);left:var(--aim-x);transform:translateX(-50%);padding:6px 10px;background:#0c181dea;font-size:18px}#interaction-hint:empty{display:none}
#play-toast{position:fixed;top:calc(var(--aim-y) + 150px);left:var(--aim-x);transform:translateX(-50%);max-width:min(560px,75vw);text-align:center;font-size:16px;line-height:1.5}

`;
function hudText(id,value){const element=$(id);if(element.textContent!==value)element.textContent=value;}
function hudFade(id,remaining){const element=$(id),alpha=String(Math.round(clamp(remaining/350,0,1)*20)/20);if(element.style.opacity!==alpha)element.style.opacity=alpha;}
drawHUDLive=()=>{
 hideHUDLayer(badgeLayer);hideHUDLayer(demoLayer);if(footerHUD.style.display!=='none')footerHUD.style.display='none';
 const visible=window.__smearComputeReady&&showHUD&&!panel&&!paused&&toybox.hidden&&!runtimeProfiler.visible;if(playHUD.hidden===visible)playHUD.hidden=!visible;
 if(!visible){hideHUDLayer(aimLayer);return;}
 const aim=aimXY(),gap=tool===1?4+viewKick*19:4,hit=simTime<hitMarkerUntil;
 drawHUDLayer(aimLayer,[aim.x-16,aim.y-16,aim.x+16,aim.y+16],[aim.x,aim.y,gap,hit,hitMarkerColor],g=>{g.fillStyle='#f3ead6';g.strokeStyle='#132322';g.lineWidth=2;g.beginPath();g.arc(aim.x,aim.y,1.5,0,TAU);g.stroke();g.fill();if(hit){g.strokeStyle=hitMarkerColor;g.lineWidth=1.5;g.beginPath();for(const [x,y]of [[1,1],[-1,1],[1,-1],[-1,-1]]){g.moveTo(aim.x+x*6,aim.y+y*6);g.lineTo(aim.x+x*11,aim.y+y*11);}g.stroke();}});
 if(playHUD.dataset.aim!==aim.x+','+aim.y){playHUD.dataset.aim=aim.x+','+aim.y;playHUD.style.setProperty('--aim-x',aim.x+'px');playHUD.style.setProperty('--aim-y',aim.y+'px');}
 const words=compute.cache.toolbox||[],reloading=reloadAge<reloadDuration;let ammo=[1,4,5,11,12,13].includes(tool)?'Unlimited ammo':'';
 if(tool===6)ammo=Math.min(100,Math.round((words[0]||0)/16777216/.25*100))+'% soaked';if(tool===9)ammo=Math.min(100,Math.round((words[1]||0)/16777216/2*100))+'% full';if(tool===2)ammo='Unlimited blood';
 if(reloading)ammo='Reloading '+Math.round(reloadAge/reloadDuration*100)+'%';
 hudText('equipped-tool',toolLibrary[tool][0]);hudText('weapon-ammo',ammo);
 const remaining=toolHintUntil-performance.now(),hint=slow?'0.25x speed | T to restore':remaining>0?(fpsControl.phase==='cursor'?'Tab to capture mouse':'RMB Grab | Y Alt | B Toybox'):'';
 hudText('play-state',hint);hudFade('play-state',slow?350:remaining);
 const target=compute.cache.control||0;const name=target?toyNames[compute.props[(target&255)-1]?.box.propKind]||'machine':'';
 hudText('interaction-hint',!grab&&!compute.placement&&target?'E · '+(target&256?'Stop ':'Start ')+name:'');
 hudText('play-toast',grab?(remaining>0?'Wheel: move held object · Q/E: rotate':''):performance.now()/1000<toastUntil?toast:'');hudFade('play-toast',grab?remaining:toastUntil*1000-performance.now());
};
