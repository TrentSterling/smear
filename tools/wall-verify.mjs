import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {launchComputeBrowser} from './compute-browser.mjs';
import {until} from './cdp.mjs';
import {installWallFixture} from './wall-fixture.mjs';
const before=process.argv.includes('before'),browser=process.argv.includes('firefox')?'firefox':'chrome';
const label=before?'before':process.argv.find(a=>a.startsWith('round-')||a.startsWith('final'))||'round-01';
const out=resolve('tools/out/wall-pass',label+(browser==='firefox'?'-firefox':''));await mkdir(out,{recursive:true});
const build=before?'tools/out/wall-pass/before/index.html':'index.html';await copyFile(build,resolve(out,'build.html'));
const page=await launchComputeBrowser({port:9630,width:1440,height:1080});
const receipt={startedAt:new Date().toISOString(),browserProfile:page.dir,browserPID:page.proc.pid,buildSHA256:createHash('sha256').update(await readFile(build)).digest('hex'),checks:[]};
try{
 await page.goto(pathToFileURL(resolve(out,'build.html')).href);await until(async()=>{const s=await page.eval('({ready:!!window.__smearComputeReady,error:document.getElementById("failure")?.style.display==="block"?document.getElementById("failure").textContent:null})');if(s.error)throw Error(s.error);return s.ready;},{timeout:90000});
 await page.eval('__smear.manual(true)');await page.mouse('mousePressed',720,130);await page.mouse('mouseReleased',720,130);await until(()=>page.eval('__smear.compute.audio().state==="running"'),{timeout:5000,label:'Audio activation'});receipt.audio=await page.eval('__smear.compute.audio()');assert(receipt.audio.enabled&&receipt.audio.state==='running');
 await installWallFixture(page);
 await page.eval('__wallTest.setup()');await page.eval('__wallTest.advance(28)');receipt.impact=await page.eval('__wallTest.read()');receipt.rig=await page.eval('__smear.compute.state()');await page.eval('__wallTest.hide()');await page.shot(resolve(out,'wall-impact.png'));
 assert(receipt.impact.painted>0);assert.equal(receipt.impact.overflow,0);assert.deepEqual(receipt.rig.errors,[]);assert(receipt.rig.maxJoint<.15);receipt.checks.push('Actual articulated GPU wall impact leaves paint with finite joints and no lost events');
 await page.eval('__wallTest.advance(360)');receipt.three=await page.eval('__wallTest.read()');await page.shot(resolve(out,'wall-3s.png'));
 await page.eval('__wallTest.advance(1440)');receipt.fifteen=await page.eval('__wallTest.read()');receipt.floorRunoff=await page.eval('__wallTest.read(false)');await page.shot(resolve(out,'wall-15s.png'));
 if(!before){const baseline=JSON.parse(await readFile('tools/out/wall-pass/before/verification.json'));
  assert(receipt.impact.opaque>baseline.impact.opaque*2,'Wall slam must leave a substantially stronger opaque splat');assert(receipt.impact.width>1,'Wall impact should spread laterally beyond a narrow drip');receipt.checks.push('Wall slam creates a broad opaque print and radial splatter instead of a small contact dab');
  assert(receipt.three.coreAlpha>=receipt.impact.coreAlpha*.95);assert(receipt.fifteen.coreAlpha>=receipt.impact.coreAlpha*.95);receipt.checks.push('The impact silhouette stays on the wall after 3 and 15 seconds of drainage');
  assert(receipt.three.mobile>0);assert(receipt.fifteen.mobile<receipt.three.mobile);receipt.checks.push('Retained splat still contains wet liquid that gradually drains or dries');
  const descent=receipt.impact.centroidY-receipt.three.centroidY;assert(descent>.02&&descent<.25,'Wall-slam liquid must visibly creep without translating as a sheet');assert(receipt.impact.centroidY-receipt.fifteen.centroidY>.08,'Wall runoff must continue after its first motion');assert(receipt.three.coreMobile>receipt.impact.coreMobile*.5,'Most impact liquid must still cling after three seconds');receipt.checks.push('Wall-slam liquid moves visibly within three seconds while retaining the broad pigment print');
 }
 await page.eval('__wallTest.setup(false)');await page.eval('__wallTest.advance(28)');receipt.floor=await page.eval('__wallTest.read(false)');await page.eval('__wallTest.hide()');await page.shot(resolve(out,'floor-impact.png'));
 if(!before){const baseline=JSON.parse(await readFile('tools/out/wall-pass/before/verification.json'));assert(Math.abs(receipt.floor.mobile/baseline.floor.mobile-1)<.03);// V25 anatomical brush tracks deliberately alter pigment coverage; liquid keeps the original 3% gate.
 assert(Math.abs(receipt.floor.alpha/baseline.floor.alpha-1)<.10);assert(Math.abs(receipt.floor.painted/baseline.floor.painted-1)<.10);receipt.checks.push('The matched floor impact retains liquid within 3% and anatomical brush coverage within 10%');}
 await page.eval('__wallTest.setup(true,8,0)');await page.eval('__wallTest.advance(28)');receipt.dry=await page.eval('__wallTest.read()');assert.equal(receipt.dry.splats,0);assert.equal(receipt.dry.painted,0);receipt.checks.push('An uncoated unwounded body does not manufacture a wet wall splat');
 receipt.errors=page.logs.filter(s=>/^EXCEPTION:|^error:/i.test(s));assert.deepEqual(receipt.errors,[]);receipt.result='COMPLETE wall impact checks';console.log(JSON.stringify({result:receipt.result,checks:receipt.checks,impact:receipt.impact,three:receipt.three,fifteen:receipt.fifteen,floor:receipt.floor},null,2));
}catch(e){receipt.result='FAIL';receipt.error=e.stack;console.error(e.stack);console.log(JSON.stringify({impact:receipt.impact,three:receipt.three,fifteen:receipt.fifteen,floor:receipt.floor}));process.exitCode=1;}
finally{await writeFile(resolve(out,'verification.json'),JSON.stringify(receipt,null,2)+'\n');page.kill();}
