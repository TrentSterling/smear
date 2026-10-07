import fs from 'node:fs';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {launch,until,sleep} from './cdp.mjs';
const label=process.argv[2]||'development',out=resolve('tools/out/toybox-pass/'+label);
fs.mkdirSync(out,{recursive:true});
const r={at:new Date().toISOString(),buildSHA256:createHash('sha256').update(fs.readFileSync('index.html')).digest('hex'),checks:[]};
let page;
const check=s=>{r.checks.push(s);console.log('PASS '+s);};
try{
 page=await launch({port:9758,width:1600,height:1000,headless:true});r.profile=page.dir;
 await page.goto(pathToFileURL(resolve('index.html')).href+'?defaults=1');
 await until(async()=>{const s=await page.eval('({ready:!!window.__smearComputeReady,error:document.getElementById("failure")?.style.display==="block"?document.getElementById("failure").textContent:null})');if(s.error)throw Error(s.error);return s.ready;},{timeout:90000,label:'movable props GPU boot'});
 await page.eval('__smear.manual(true)');await page.mouse('mousePressed',800,120);await page.mouse('mouseReleased',800,120);await page.eval('__smear.release(false)');
 const boot=await page.eval('__smear.state()');assert.equal(boot.adapter.isFallbackAdapter,false);assert.deepEqual(boot.errors,[]);check('Movable-prop shaders boot on hardware WebGPU');
 await page.eval('__smear.tune({walking:false,recover:false});__smear.step(360)');
 r.rest=await page.eval('__smear.props().then(p=>p.filter(x=>x.active))');assert(r.rest.every(p=>[...p.p,...p.q,...p.v].every(Number.isFinite)&&!p.broken));assert(r.rest.every(p=>Math.abs(p.p[1]-(p.kind==='barrel'?.58:.55))<.04));assert(r.rest.every(p=>Math.hypot(...p.v)<.15));check('All six props rest on the floor for three seconds without creep, explosions or nonfinite state');
 await page.shot(resolve(out,'rest.png'));
 // Real picking and pointer motion, with deterministic GPU ticks between events.
 await page.eval('__smear.reset();__smear.step(0)');await page.eval('__smear.controls.mode("cursor");__smear.manual(true);__smear.tool(0);__smear.view([-6.45,1.5,1.5],[-6.45,.55,-1.8])');
 await page.mouse('mousePressed',800,500);await page.eval('__smear.render()');await until(async()=>(await page.eval('__smear.state()')).grab==='crate',{timeout:5000,label:'native prop pick'});
 for(let i=1;i<=16;i++){await page.mouse('mouseMoved',800+i*15,500-i*10);await page.eval('__smear.step(2)');}
 r.held=(await page.eval('__smear.props()'))[0];assert(r.held.p[1]>.75);assert(r.held.p[0]>-6.0);check('Native grab and mouse motion lift and carry the GPU crate');
 await page.mouse('mouseReleased',1040,340);r.release=(await page.eval('__smear.props()'))[0];await page.eval('__smear.step(8)');r.flight=(await page.eval('__smear.props()'))[0];
 assert(Math.hypot(...r.release.v)>2);assert(r.flight.p[0]>r.release.p[0]+.15);assert(Math.hypot(...r.flight.v)>Math.hypot(...r.release.v)*.70);check('Mouse release preserves crate momentum through free flight');
 await page.shot(resolve(out,'throw.png'));
 // Spawn through the visible menu and commit on a real upward-facing receiver.
 await page.eval('__smear.reset();__smear.step(0)');await page.eval('__smear.controls.mode("cursor");__smear.manual(true)');
 await page.call('Input.dispatchKeyEvent',{type:'keyDown',code:'KeyB',key:'b'});await page.call('Input.dispatchKeyEvent',{type:'keyUp',code:'KeyB',key:'b'});assert(await page.eval('!document.getElementById("toybox").hidden'));
 await page.eval('document.getElementById("toy-search").focus()');await page.call('Input.insertText',{text:'crate'});assert(await page.eval(`document.querySelector('#toy-items [data-kind="2"]').hidden`));
 const menu=await page.eval(`(()=>{const b=document.querySelector('#toy-items [data-kind="1"]').getBoundingClientRect();return{x:b.x+b.width/2,y:b.y+b.height/2}})()`);await page.mouse('mousePressed',menu.x,menu.y);await page.mouse('mouseReleased',menu.x,menu.y);
 assert.equal((await page.eval('__smear.toybox.state()')).placement.kind,1);
 await page.eval('__smear.view([0,2,1],[0,2,-8]);__smear.pointer(800,500);__smear.render();__smear.buddy.confirm()');assert((await page.eval('__smear.toybox.state()')).placement);assert.equal((await page.eval('__smear.props()')).filter(p=>p.active).length,6);check('A vertical wall cannot accept a prop placement');
 await page.eval('__smear.view([-3,3,7],[-3,0,5]);__smear.pointer(800,500);__smear.manual(false)');await page.call('Input.dispatchKeyEvent',{type:'keyDown',code:'KeyE',key:'e'});await sleep(300);await page.call('Input.dispatchKeyEvent',{type:'keyUp',code:'KeyE',key:'e'});await page.eval('__smear.manual(true);__smear.render()');assert((await page.eval('__smear.toybox.state()')).placement.yaw>.25);check('Native Q/E input rotates the placement preview during real-time play');
 // Walking gravity moves the camera during the rotation check; re-aim the
 // fixed placement target while keeping the yaw produced by native E input.
 await page.eval('__smear.view([-3,3,7],[-3,0,5]);__smear.pointer(800,500);__smear.render()');
 await page.shot(resolve(out,'preview.png'));await page.mouse('mousePressed',800,500);await page.mouse('mouseReleased',800,500);await until(async()=>!(await page.eval('__smear.toybox.state()')).placement,{timeout:5000,label:'crate placement commit'});
 r.placed=(await page.eval('__smear.props()'))[6];assert(r.placed.active);assert(Math.abs(r.placed.p[0]+3)<.02&&Math.abs(r.placed.p[2]-5)<.02);check('Searchable toybox and native click place the spare crate on the floor');
 await page.eval('__smear.toybox.place(1);__smear.view([-3,3,7],[-3,1.11,5]);__smear.pointer(800,500);__smear.render()');await page.eval('__smear.buddy.confirm()');assert((await page.eval('__smear.toybox.state()')).placement);check('Occupied four-crate capacity refuses another spawn');
 await page.eval('__smear.buddy.cancel();__smear.toybox.remove()');await page.eval('__smear.step(2)');assert(!(await page.eval('__smear.props()'))[6].active);check('Remove selected prop frees its slot without an explosion');
 await page.eval('__smear.toybox.place(1);__smear.view([-3,3,7],[-3,0,5]);__smear.pointer(800,500);__smear.render();__smear.buddy.confirm()');
 await page.eval('__smear.toybox.place(2);__smear.view([-3,3.5,7],[-3,1.11,5]);__smear.pointer(800,500);__smear.render();__smear.buddy.confirm()');assert.equal((await page.eval('__smear.toybox.state()')).placement,null);await page.eval('__smear.step(360)');
 r.stack=await page.eval('__smear.props()');assert(r.stack[7].active&&!r.stack[7].broken);assert(r.stack[7].p[1]>1.6&&r.stack[7].p[1]<1.8);assert(Math.hypot(...r.stack[7].v)<.2);await page.shot(resolve(out,'stack.png'));check('A barrel placed on the crate stays stacked under GPU gravity');
 await page.eval('__smearGPU.removeToy(6);__smear.step(180)');r.unsupported=(await page.eval('__smear.props()'))[7];assert(r.unsupported.p[1]<.7);check('A sleeping stacked barrel wakes and falls when its support is removed');
 await page.eval('__smear.toybox.restore()');r.restored=await page.eval('__smear.props()');assert.equal(r.restored.filter(p=>p.active).length,6);assert(r.restored.every(p=>p.damage===0&&!p.broken));assert.deepEqual(r.restored[0].p.map(n=>Math.round(n*100)),[-645,55,-180]);check('Restore prop layout resets the original six toys and frees spare slots');
 r.audio=await page.eval('__smear.compute.audio()');assert.equal(r.audio.state,'running');assert(r.audio.enabled);
 r.errors=page.logs.filter(s=>/^EXCEPTION:|^error:/i.test(s));assert.deepEqual(r.errors,[]);r.passed=true;console.log('COMPLETE '+r.checks.length+' prop motion checks passed');
}catch(e){r.error=e.stack;console.error(e.stack);process.exitCode=1;}finally{if(page){r.logs=page.logs;page.kill();}fs.writeFileSync(resolve(out,'receipt.json'),JSON.stringify(r,null,2)+'\n');}
