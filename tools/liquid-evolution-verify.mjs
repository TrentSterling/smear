import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';import {pathToFileURL} from 'node:url';import {createHash} from 'node:crypto';
import {launchComputeBrowser} from './compute-browser.mjs';import {until} from './cdp.mjs';import {installLiquidEvolutionFixture} from './liquid-evolution-fixture.mjs';
const label=process.argv.find(x=>/^(round-|final)/.test(x))||'round-01',out=resolve('tools/out/liquid-evolution',label+(process.argv.includes('firefox')?'-firefox':''));await mkdir(out,{recursive:true});
const page=await launchComputeBrowser({port:9665,width:1440,height:1080});const receipt={startedAt:new Date().toISOString(),browserProfile:page.dir,buildSHA256:createHash('sha256').update(await readFile('index.html')).digest('hex'),checks:[]};
try{
 await page.goto(pathToFileURL(resolve('index.html')).href);await until(()=>page.eval('!!window.__smearComputeReady'),{timeout:90000});await page.eval('__smear.manual(true)');await page.mouse('mousePressed',720,130);await page.mouse('mouseReleased',720,130);await installLiquidEvolutionFixture(page);
 for(const [name,setup,options]of [['rest',{height:.5},{film:false,coverage:0}],['squeeze',{height:.5,pressure:1},{film:false,coverage:0}],['spin',{height:.5,spin:12,coat:.8,pressure:1},{}],['dry',{height:0,spin:12,pressure:1},{}],['full',{height:0,spin:12,coat:.8,saturated:true},{coverage:0}]]){
  await page.eval(`__evolution.setup(${JSON.stringify(setup)})`);const before=await page.eval('__evolution.read()');await page.eval(`__evolution.advance(240,${JSON.stringify(options)})`);const after=await page.eval('__evolution.read()');receipt[name]={before,after};assert.deepEqual(after.errors,[]);await page.shot(resolve(out,name+'.png'));console.log(name+' '+JSON.stringify({...after,drops:after.drops.length}));
 }
 assert(receipt.squeeze.after.squeezed>0);assert(receipt.squeeze.after.moment>receipt.rest.after.moment*1.04);assert(receipt.squeeze.after.center<receipt.rest.after.center*.92);assert(receipt.squeeze.after.peak>receipt.rest.after.peak*1.2);receipt.checks.push('Pressure moves existing liquid out of the contact center into its perimeter');
 assert(receipt.spin.after.sprayed>20);assert(receipt.spin.after.drops.some(d=>Math.hypot(d.v[0],d.v[1])>2));assert(receipt.spin.after.airborne>0);receipt.checks.push('Spinning wet contact emits tangential ballistic droplets carrying finite liquid');
 for(const name of ['squeeze','spin'])assert(Math.abs(receipt[name].after.total/receipt[name].before.total-1)<.06,name+' conserves finite film, coating and airborne supply');receipt.checks.push('Squeeze and spray conserve combined film, residue, coating and particle volume within six percent');
 assert.equal(receipt.dry.after.sprayed,0);assert.equal(receipt.dry.after.total,0);assert.equal(receipt.full.after.sprayed,0);assert(Math.abs(receipt.full.after.coat-.8)<.00001);receipt.checks.push('Dry contact emits nothing and a full particle pool retains un-emitted coating');
 receipt.result='COMPLETE cumulative liquid evolution checks';console.log(receipt.result+' ('+receipt.checks.length+' checks)');
}catch(e){receipt.result='FAIL';receipt.error=e.stack;console.error(e.stack);process.exitCode=1;}finally{await writeFile(resolve(out,'verification.json'),JSON.stringify(receipt,null,2)+'\n');page.kill();}
