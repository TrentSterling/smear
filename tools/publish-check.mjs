import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {until,sleep} from './cdp.mjs';
import {launchComputeBrowser} from './compute-browser.mjs';
const game=process.argv[2]||'https://tront.xyz/smear/',games=process.argv[3]||'https://tront.xyz/games/',label=process.argv[4]||'live';
const release=JSON.parse(await readFile('package.json','utf8')),out=resolve('tools/out','publish-'+label);await mkdir(out,{recursive:true});
const receipt={game,games,version:release.version,checks:[],portfolioLayout:[],audioOutputMuted:true};
const response=await fetch(game);assert.equal(response.status,200);const html=Buffer.from(await response.arrayBuffer()),local=await readFile('index.html');assert.equal(createHash('sha256').update(html).digest('hex'),createHash('sha256').update(local).digest('hex'));receipt.sha256=createHash('sha256').update(html).digest('hex');assert(html.toString('utf8').includes(`version:'${release.version}'`));receipt.checks.push('Live HTTP 200, release version and HTML SHA-256 equal local build');
const image=await fetch(new URL('og-image.png?v=081',game));assert.equal(image.status,200);assert(image.headers.get('content-type').startsWith('image/png'));const png=Buffer.from(await image.arrayBuffer());assert.equal(png.readUInt32BE(16),1200);assert.equal(png.readUInt32BE(20),630);assert.equal((await fetch(new URL('favicon.svg',game))).status,200);receipt.checks.push('Live OG 1200x630 PNG and favicon load');
const page=await launchComputeBrowser({port:9590,width:1366,height:768});const watchdog=setTimeout(()=>{page.kill();process.exit(1);},120000);
try{
 await page.goto(game);await until(()=>page.eval('!!window.__smearComputeReady'),{timeout:60000,label:'Published GPU game'});await page.eval('__smear.perf.show(false)');
 const initial=await page.eval('__smear.state()');assert.equal(initial.version,release.version);assert.equal(initial.backend,'WebGPU compute');assert.equal(initial.adapter.isFallbackAdapter,false);assert.deepEqual(initial.errors,[]);receipt.adapter=initial.adapter;
 receipt.browser=await page.eval('navigator.userAgent');
 await sleep(1000);const advanced=await page.eval('__smear.state()');assert(advanced.steps>initial.steps+90);receipt.checks.push('Published hardware WebGPU boot and 120 Hz simulation advances');
 await page.mouse('mousePressed',680,120);await page.mouse('mouseReleased',680,120);await until(()=>page.eval('__smear.compute.audio().state==="running"'),{timeout:5000,label:'Published audio activation'});const audio=await page.eval('__smear.compute.audio()');assert.equal(audio.state,'running');assert.equal(audio.enabled,true);receipt.audio=audio;
 await page.eval('__smear.manual(true);__smear.reset();__smear.step(45)');const target=await page.eval('__smear.project(0,"Right foot")');await page.mouse('mouseMoved',target.x,target.y);await page.mouse('mousePressed',target.x,target.y);await page.eval('__smear.step(0)');await sleep(100);assert.equal(await page.eval('__smearGPU.input().held'),true);
 await page.eval('__smear.manual(false)');for(let i=0;i<30;i++){await page.mouse('mouseMoved',target.x+Math.sin(i/12)*230,target.y-i*1.1);await sleep(16);}await page.mouse('mouseReleased',target.x+210,target.y-32);await page.eval('__smear.manual(true)');const dragged=await page.eval('__smear.state()');assert.equal(dragged.grab,null);assert.deepEqual(dragged.errors,[]);receipt.checks.push('Published native GPU pick, drag and release with audio running');await page.shot(resolve(out,'game.png'));
 for(const [width,height]of [[1366,768],[390,844]]){
  await page.call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await page.goto(games);
  await until(()=>page.eval('!!document.body?.classList.contains("fonts-loaded")'),{label:'Portfolio fonts'});
  await page.eval('document.querySelector("a[href=\\"https://tront.xyz/smear/\\"]").scrollIntoView({block:"center"})');
  await until(()=>page.eval('(()=>{const i=document.querySelector("a[href=\\"https://tront.xyz/smear/\\"] img");return i.complete&&i.naturalWidth===1200;})()'),{label:'Portfolio OG image'});await sleep(350);
  const card=await page.eval('(()=>{const cards=document.querySelectorAll("a[href=\\"https://tront.xyz/smear/\\"]"),c=cards[0],r=c.getBoundingClientRect();return{count:cards.length,text:c.innerText,left:r.left,right:r.right,viewport:innerWidth,image:c.querySelector("img").naturalWidth};})()');assert.equal(card.count,1);assert(card.text.includes('SMEAR'));assert.equal(card.image,1200);assert(card.left>=-1&&card.right<=card.viewport+1);receipt.portfolioLayout.push({width,...card});await page.shot(resolve(out,'games-'+width+'.png'));receipt.checks.push('Portfolio card and image fit '+width+'px viewport');
 }
 receipt.errors=page.logs.filter(s=>s.startsWith('EXCEPTION:'));assert.deepEqual(receipt.errors,[]);receipt.result='COMPLETE publish checks passed';console.log(receipt.result+' ('+receipt.checks.length+' checks)');
}catch(error){receipt.result='FAIL';receipt.error=error.stack;console.error(error.stack);process.exitCode=1;}
finally{clearTimeout(watchdog);await writeFile(resolve(out,'verification.json'),JSON.stringify(receipt,null,2)+'\n','utf8');page.kill();}
