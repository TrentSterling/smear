// Dedicated Firefox WebDriver BiDi driver. Never attaches to the user's browser.
import {spawn} from 'node:child_process';
import {mkdtempSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {sleep} from './cdp.mjs';

export async function launchFirefox({port=9595,width=1920,height=1080,headless=true}={}){
 const dir=mkdtempSync(join(tmpdir(),'smear-firefox-'));
 writeFileSync(join(dir,'user.js'),'user_pref("browser.shell.checkDefaultBrowser",false);\nuser_pref("browser.startup.homepage_override.mstone","ignore");\nuser_pref("webgl.force-enabled",true);\nuser_pref("media.volume_scale","0.0");\n');
 const proc=spawn(process.env.FIREFOX||'C:/Program Files/Mozilla Firefox/firefox.exe',[...(headless?['--headless']:[]),'--no-remote','--profile',dir,'--remote-debugging-port',String(port),'about:blank'],{windowsHide:true,stdio:['ignore','pipe','pipe']});
 let diagnostics='';for(const stream of [proc.stdout,proc.stderr])stream.on('data',b=>{diagnostics+=(b+'').slice(0,1000);});
 let ws;for(let i=0;i<60;i++){try{const socket=new WebSocket(`ws://127.0.0.1:${port}/session`);await new Promise((r,j)=>{socket.onopen=r;socket.onerror=j;});ws=socket;break;}catch{await sleep(250);}}
 if(!ws){proc.kill();throw Error('Firefox did not start: '+diagnostics);}
 let seq=0;const pending=new Map(),logs=[];
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.type==='error'?p.reject(Error(m.error+': '+m.message)):p.resolve(m.result);}else if(m.method==='log.entryAdded'){const x=m.params;logs.push((x.level||x.type)+': '+x.text);}};
 const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
 await call('session.new',{capabilities:{alwaysMatch:{acceptInsecureCerts:true}}});await call('session.subscribe',{events:['log.entryAdded']});
 // Keep synthesis and gameplay sound settings exercised, but silence the final
 // destination in every owned test tab. This is independent of system volume.
 await call('script.addPreloadScript',{functionDeclaration:`()=>{const connect=AudioNode.prototype.connect;AudioNode.prototype.connect=function(destination,output=0,input=0){if(destination instanceof AudioDestinationNode){const mute=destination.context.createGain();mute.gain.value=0;connect.call(this,mute,output,0);connect.call(mute,destination,0,input);return destination;}return connect.apply(this,arguments);};}`});
 const {context}=await call('browsingContext.create',{type:'tab'});
 await call('browsingContext.setViewport',{context,viewport:{width,height},devicePixelRatio:1});
 return{logs,proc,dir,call,context,
  goto:url=>call('browsingContext.navigate',{context,url,wait:'complete'}),
  eval:async expr=>{const r=await call('script.evaluate',{expression:`(async()=>JSON.stringify(await (0,eval)(${JSON.stringify(expr)})))()`,target:{context},awaitPromise:true});if(r.type==='exception')throw Error('Firefox eval: '+r.exceptionDetails.text);return r.result.value===undefined?undefined:JSON.parse(r.result.value);},
  shot:async file=>{const {data}=await call('browsingContext.captureScreenshot',{context,origin:'viewport',format:{type:'image/png'}});writeFileSync(file,Buffer.from(data,'base64'));},
  mouse:async(type,x,y,button='left')=>{const actions=[{type:'pointerMove',origin:'viewport',x:Math.round(x),y:Math.round(y),duration:0}];if(type==='mousePressed')actions.push({type:'pointerDown',button:button==='right'?2:button==='middle'?1:0});if(type==='mouseReleased')actions.push({type:'pointerUp',button:button==='right'?2:button==='middle'?1:0});return call('input.performActions',{context,actions:[{type:'pointer',id:'mouse',parameters:{pointerType:'mouse'},actions}]});},
  kill:()=>{ws.close();proc.kill();}
 };
}
