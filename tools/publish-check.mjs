import assert from 'node:assert/strict';
import { mkdir,writeFile,readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { launch,sleep,until } from './cdp.mjs';

const game=process.argv[2]||'http://127.0.0.1:8198/smear/';
const games=process.argv[3]||'http://127.0.0.1:8198/games/';
const label=process.argv[4]||'preview';
const release=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
const out=resolve('tools/out',`publish-${label}`);
await mkdir(out,{recursive:true});
const receipts={game,games,checks:[]};
function pass(name,fn){fn();receipts.checks.push(name);console.log('PASS '+name);}
const html=await fetch(game);pass('game HTTP 200',()=>assert.equal(html.status,200));
const source=await html.text();pass('served game is '+release.version,()=>assert(source.includes(`version:'${release.version}'`)));
const imageURL=new URL('og-image.png?v=081',game);
const response=await fetch(imageURL);pass('OG image HTTP 200 and image/png',()=>{assert.equal(response.status,200);assert(response.headers.get('content-type').startsWith('image/png'));});
const png=Buffer.from(await response.arrayBuffer());pass('OG image is 1200 x 630',()=>{assert.equal(png.readUInt32BE(16),1200);assert.equal(png.readUInt32BE(20),630);});
const favicon=await fetch(new URL('favicon.svg',game));pass('favicon HTTP 200',()=>assert.equal(favicon.status,200));
const page=await launch({port:9590,width:1366,height:768});
try{
  await page.goto(game);
  await until(()=>page.eval('!!window.__smear&&!document.getElementById("loading")'),{label:'published game boot'});
  const start=await page.eval('({version:window.__smear.state().version,visible:window.__smear.visibility(),time:window.__smear.state().simTime})');
  pass('served game boots with all dummies visible',()=>{assert.equal(start.version,release.version);assert(start.visible.every(d=>d.visible),JSON.stringify(start.visible));});
  await sleep(800);
  const next=await page.eval('window.__smear.state().simTime');pass('served simulation advances',()=>assert(next>start.time));
  await page.shot(resolve(out,'game.png'));
  const dragStart=await page.eval(`(()=>{const a=window.__smear;a.reset();a.tune({recover:false,walking:false});a.view([3.4,3.3,4.8],[0,.1,1]);for(const name of ['Torso','Hips','Head'])for(const n of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]])a.bodyPaint(0,name,n,.85);return{point:a.project(0,'Torso'),stats:a.state().stats};})()`);
  await page.mouse('mouseMoved',dragStart.point.x,dragStart.point.y);await page.mouse('mousePressed',dragStart.point.x,dragStart.point.y);
  const held=await page.eval('window.__smear.state().grab');
  for(let i=1;i<=48;i++){await page.mouse('mouseMoved',dragStart.point.x+Math.sin(i/48*Math.PI)*250,Math.min(720,dragStart.point.y+75));await sleep(16);}
  await page.mouse('mouseReleased',dragStart.point.x,dragStart.point.y);
  const dragged=await page.eval('window.__smear.state()');
  pass('served game paints floor smears during a native mouse drag',()=>{assert(held);assert.equal(dragged.grab,null);assert(dragged.stats.smearMeters>dragStart.stats.smearMeters+.1);});
  const glError=await page.eval('document.getElementById("world").getContext("webgl2").getError()');pass('no WebGL errors after live drag uploads',()=>assert.equal(glError,0));
  await page.shot(resolve(out,'mouse-drag.png'));
  for(const [width,height]of [[1366,768],[390,844]]){
    await page.call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
    await page.goto(games);
    await until(()=>page.eval('!!document.body?.classList.contains("fonts-loaded")'),{label:'portfolio fonts'});
    await page.eval('document.querySelector("a[href=\\"https://tront.xyz/smear/\\"]").scrollIntoView({block:"center"})');
    await until(()=>page.eval('(()=>{const i=document.querySelector("a[href=\\"https://tront.xyz/smear/\\"] img");return i.complete&&i.naturalWidth===1200;})()'),{label:'portfolio card image'});
    await page.eval('document.querySelector("a[href=\\"https://tront.xyz/smear/\\"] img").decode().then(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))');
    await until(()=>page.eval('getComputedStyle(document.body).opacity==="1"'),{label:'portfolio reveal'});
    const card=await page.eval('(()=>{const cards=document.querySelectorAll("a[href=\\"https://tront.xyz/smear/\\"]"),c=cards[0];return {count:cards.length,text:c.innerText,width:document.documentElement.scrollWidth,viewport:innerWidth,visible:getComputedStyle(c).display,image:c.querySelector("img").naturalWidth};})()');
    pass(`SMEAR card and OG image render at ${width}px`,()=>{assert.equal(card.count,1);assert(card.text.includes('SMEAR'));assert.notEqual(card.visible,'none');assert.equal(card.image,1200);assert(card.width<=card.viewport+1);});
    await page.shot(resolve(out,`games-${width}.png`));
    const filters=await page.eval('(()=>{const c=document.querySelector("a[href=\\"https://tront.xyz/smear/\\"]"),r={};for(const key of ["prototype","game","tool","all"]){document.getElementById("filter-"+key).click();r[key]=getComputedStyle(c).display;}return r;})()');
    pass(`portfolio category filters work at ${width}px`,()=>{assert.notEqual(filters.prototype,'none');assert.notEqual(filters.all,'none');assert.equal(filters.game,'none');assert.equal(filters.tool,'none');});
  }
  receipts.errors=page.logs.filter(s=>/^EXCEPTION:|^error:/i.test(s));
  // Existing third-party resources on the portfolio can fail independently.
  pass('no JavaScript exceptions on game or portfolio',()=>assert(!receipts.errors.some(s=>s.startsWith('EXCEPTION:')),receipts.errors.join('\n')));
  receipts.result='COMPLETE publish checks passed';console.log(`${receipts.result} (${receipts.checks.length} checks)`);
}catch(error){receipts.result='FAIL';receipts.error=error.stack;await page.shot(resolve(out,'failure.png')).catch(()=>{});throw error;}
finally{await writeFile(resolve(out,'verification.json'),JSON.stringify(receipts,null,2)+'\n');page.kill();}
