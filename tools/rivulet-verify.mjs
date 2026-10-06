import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {launchComputeBrowser} from './compute-browser.mjs';
import {until} from './cdp.mjs';
import {installRivuletFixture} from './rivulet-fixture.mjs';
const before=process.argv.includes('before'),label=before?'before':process.argv.find(a=>a.startsWith('round-')||a.startsWith('final'))||'round-01';
const out=resolve('tools/out/rivulet-pass',label+(process.argv.includes('firefox')?'-firefox':''));await mkdir(out,{recursive:true});
const source=before?'tools/out/rivulet-pass/before/index.html':'index.html';await copyFile(source,resolve(out,'build.html'));
const page=await launchComputeBrowser({port:9634,width:1440,height:1080}),receipt={startedAt:new Date().toISOString(),browserProfile:page.dir,browserPID:page.proc.pid,buildSHA256:createHash('sha256').update(await readFile(source)).digest('hex'),checks:[]};
try{
 await page.goto(pathToFileURL(resolve(out,'build.html')).href);await until(async()=>{const s=await page.eval('({ready:!!window.__smearComputeReady,error:document.getElementById("failure")?.style.display==="block"?document.getElementById("failure").textContent:null})');if(s.error)throw Error(s.error);return s.ready;},{timeout:90000});
 await page.eval('__smear.manual(true)');await page.mouse('mousePressed',720,130);await page.mouse('mouseReleased',720,130);await until(()=>page.eval('__smear.compute.audio().state==="running"'),{timeout:5000});
 await installRivuletFixture(page);
 for(const kind of ['band','beads']){
  await page.eval(`__rivulet.setup('${kind}')`);const times=[];let ticks=0;
  for(const seconds of [0,1,3,8,15]){await page.eval(`__rivulet.advance(${seconds*120-ticks})`);ticks=seconds*120;times.push({seconds,...await page.eval('__rivulet.read()')});await page.shot(resolve(out,kind+'-'+seconds+'s.png'));}
  receipt[kind]=times;
 }
 receipt.state=await page.eval('__smear.compute.state()');assert.deepEqual(receipt.state.errors,[]);assert.equal(receipt.state.stampOverflow,0);receipt.checks.push('Wall wetting fixtures run on hardware GPU with finite state and no lost events');
 if(!before){
  const [small,large]=receipt.beads[0].halves.map((h,i)=>h.y-receipt.beads[2].halves[i].y);assert(small<.035,'Small wall deposits should cling');assert(large>.08,'A heavy bead must visibly drain');receipt.checks.push('Small deposits cling while a heavier bead visibly moves under gravity');
  const band=receipt.band;assert(band[2].centroidY<band[0].centroidY-.02);assert(band[2].centroidY>band[0].centroidY-.40,'Avoid whole-sheet descent');assert(band[3].frontSpread>.10,'Advancing front must have uneven fingers');assert(band[3].columnCV>.55,'Runoff must gather into separated paths');receipt.checks.push('A finite broad patch develops uneven runoff while retaining its attached mass');
  assert(band[3].core>band[0].core*.15,'Attached source should remain behind the moving heads');assert(Math.abs(band[3].total/band[0].total-1)<.025,'Partial wetting must conserve mass before reaching the floor');receipt.checks.push('Wall breakup retains source residue and conserves finite liquid plus dried mass');
  assert(Math.max(band[3].rivulets,band[4].rivulets)>=2,'The advancing patch must split into distinct runs across a horizontal cut');receipt.checks.push('A broad deposit splits into multiple separated rivulets below its source');
  await page.eval("__rivulet.setup('band')");await page.eval('__rivulet.advance(960,4)');receipt.cadence=await page.eval('__rivulet.read()');assert(Math.abs(receipt.cadence.centroidY-band[3].centroidY)<.005);assert(Math.abs(receipt.cadence.total/band[3].total-1)<.01);assert.equal(receipt.cadence.rivulets,band[3].rivulets);receipt.checks.push('Wall pinning and rivulet breakup agree at 30 Hz and 60 Hz submission cadence');
  await page.eval("__rivulet.setup('thin')");const pinned=await page.eval('__rivulet.read()');await page.eval('__rivulet.advance(120)');const rested=await page.eval('__rivulet.read()');await page.eval('__rivulet.shear(120)');const pushed=await page.eval('__rivulet.read()');receipt.shear={pinned,rested,pushed};assert(Math.abs(rested.centroidY-pinned.centroidY)<.02);assert(Math.abs(pushed.centroidX-rested.centroidX)>.025,'Contact must overcome adhesion and move attached film');assert(Math.abs(pushed.total/pinned.total-1)<.03);receipt.checks.push('Contact shear releases attached wall liquid without manufacturing supply');
 }
 receipt.errors=page.logs.filter(s=>/^EXCEPTION:|^error:/i.test(s));assert.deepEqual(receipt.errors,[]);receipt.result='COMPLETE rivulet checks';console.log(JSON.stringify({result:receipt.result,checks:receipt.checks,band:receipt.band,beads:receipt.beads},null,2));
}catch(e){receipt.result='FAIL';receipt.error=e.stack;console.error(e.stack);console.log(JSON.stringify({band:receipt.band,beads:receipt.beads}));process.exitCode=1;}
finally{await writeFile(resolve(out,'verification.json'),JSON.stringify(receipt,null,2)+'\n');page.kill();}
