import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, dirname } from 'node:path';
import { launch, sleep, until } from './cdp.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'tools/out');
await mkdir(out, { recursive: true });
const release = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
const receipts = { version: release.version, checks: [], browserErrors: [] };
function check(name, fn) {
  fn();
  receipts.checks.push(name);
  console.log(`PASS ${name}`);
}
function finiteBodies(state) {
  assert(state.parts.length > 0);
  for (const part of state.parts) {
    assert(part.p.every(Number.isFinite), `${part.name} position`);
    assert(part.q.every(Number.isFinite), `${part.name} rotation`);
    assert(Number.isFinite(part.speed), `${part.name} speed`);
  }
}
function deterministic(state) {
  const copy = structuredClone(state);
  delete copy.name;
  delete copy.version;
  delete copy.stats.physicsMS;
  delete copy.stats.frameMS;
  delete copy.renderer;
  return copy;
}
function brief(state) {
  const { physicsMS, frameMS, ...stats } = state.stats;
  return { version: state.version, simTime: state.simTime, dolls: state.dolls, bodies: state.bodies, particles: state.particles, wetSupply: state.wetSupply, stats };
}
const original = await readFile(resolve(root, 'versions/dragmark_v7.html'));
check('original V7 preserved byte for byte', () => assert.equal(createHash('sha256').update(original).digest('hex'), '4dfe17e606b18ce7471f176b4c2afa0229b2f32e60b5b88c2971ebc6a75bc41f'));
const gameSource=await readFile(resolve(root,'index.html'),'utf8');
check('UTF-8 UI symbols retain their original codepoints',()=>assert.deepEqual([...new Set([...gameSource].map(c=>c.codePointAt(0)).filter(c=>c>127))].sort((a,b)=>a-b),[176,183,215,8594]));

const page = await launch({ port: Number(process.env.SMEAR_CDP_PORT || 9587), width: 1366, height: 768 });
try {
  // Start both deterministic traces before any real-time animation frames.
  // V7's surface reset retains wet-cell timestamps from prior live frames.
  await page.init(`(() => {
    window.__qaDrawnTexts=new Set();const fillText=CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText=function(text,...args){window.__qaDrawnTexts.add(String(text));return fillText.call(this,text,...args);};
    const raf=requestAnimationFrame.bind(window),queued=[];
    let hold=true;
    window.requestAnimationFrame=fn=>hold?queued.push(fn):raf(fn);
    window.__qaReleaseFrames=()=>{hold=false;for(const fn of queued.splice(0))raf(fn);};
  })()`);
  await page.goto(pathToFileURL(resolve(root, 'versions/dragmark_v7.html')).href);
  await until(() => page.eval('!!window.__dragmark && !document.getElementById("loading")'), { label: 'V7 boot' });
  const baseline = await page.eval('(() => {const a=window.__dragmark;a.manual(true);a.preset("default");return a.trace(60,14);})()');
  check('V7 reference demo produces contact smears', () => {
    assert(baseline.stats.smearMeters > 0);
    assert(baseline.stats.strokeSegments > 0);
    finiteBodies(baseline);
  });
  receipts.v7 = brief(baseline);

  await page.goto(pathToFileURL(resolve(root, 'index.html')).href);
  await until(() => page.eval('!!window.__smear && !document.getElementById("loading")'), { label: 'SMEAR V8 boot' });
  const initial = await page.eval('window.__smear.state()');
  check('SMEAR V8 reports the new name and version', () => {
    assert.equal(initial.name, 'SMEAR');
    assert.equal(initial.version, release.version);
  });
  const branding = await page.eval('({title:document.title,label:document.getElementById("world").getAttribute("aria-label"),description:document.querySelector("meta[name=description]").content})');
  check('page and accessibility branding updated', () => {
    assert.equal(branding.title, 'SMEAR | Blood & Ragdoll Playground');
    assert(branding.label.startsWith('SMEAR'));
    assert(branding.description.startsWith('SMEAR:'));
  });
  const gpu = await page.eval('(() => {const c=document.getElementById("world"),g=c.getContext("webgl2")||c.getContext("webgl"),e=g.getExtension("WEBGL_debug_renderer_info");return {version:g.getParameter(g.VERSION),renderer:e?g.getParameter(e.UNMASKED_RENDERER_WEBGL):g.getParameter(g.RENDERER)};})()');
  receipts.gpu = gpu;
  console.log(`GPU ${gpu.renderer}`);
  check('hardware WebGL renderer', () => assert(!/swiftshader|llvmpipe|software/i.test(gpu.renderer)));
  const candidate = await page.eval('(() => {const a=window.__smear;a.manual(true);a.preset("default");return a.trace(60,14);})()');
  const repeated = await page.eval('window.__smear.trace(60,14)');
  check('V8 smear demo repeats deterministically after reset', () => assert.deepEqual(deterministic(candidate), deterministic(repeated)));
  check('demo leaves splashes, smears, and landed droplets', () => {
    assert(candidate.stats.splats > 0);
    assert(candidate.stats.smearMeters > 0);
    assert(candidate.stats.dropletsLanded > 0);
    finiteBodies(candidate);
  });
  receipts.v8 = brief(candidate);
  await page.eval('for(let i=0;i<16;i++)window.__smear.render()');
  await page.shot(resolve(out, 'smear-v8-demo.png'));
  await page.eval('window.__smear.panel("about")');
  const drawnTexts=await page.eval('Array.from(window.__qaDrawnTexts)');
  const [,minor,patch]=release.version.split('.'),visibleRelease=minor.padStart(2,'0')+'.'+patch;
  check('HUD and About show the current release version',()=>{assert(drawnTexts.includes(visibleRelease));assert(drawnTexts.includes('SMEAR '+visibleRelease));});
  await page.shot(resolve(out, 'smear-v8-about.png'));

  const liveStart = await page.eval('(() => {const a=window.__smear;a.panel(null);a.reset();a.manual(false);window.__qaReleaseFrames();return a.state();})()');
  await sleep(1000);
  const live = await page.eval('window.__smear.state()');
  check('live simulation advances without non-finite bodies', () => {
    assert(live.simTime > liveStart.simTime);
    finiteBodies(live);
  });
  check('starting view is in front of the relocated divider', () => {
    assert(live.player.p[2] < 5.8 - .17 - .23);
    assert.equal(live.player.mode, 'walk');
  });
  await page.shot(resolve(out, 'smear-v8-room.png'));

  for(const [width,height] of [[1280,720],[1366,768],[1920,1080]]){
    await page.call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
    await until(()=>page.eval(`window.__smear.quality().canvas[0]===${width}&&window.__smear.quality().canvas[1]===${height}`),{label:`canvas resize ${width}x${height}`});
    const visible=await page.eval('(()=>{const a=window.__smear;a.manual(true);a.reset();for(let i=0;i<16;i++)a.render();return a.visibility();})()');
    check(`all starting dummies visible at ${width}x${height}`,()=>{
      assert.equal(visible.length,3);
      assert(visible.every(d=>d.visible),JSON.stringify(visible));
    });
    await page.shot(resolve(out,`spawn-${width}.png`));
  }
  await page.call('Emulation.setDeviceMetricsOverride',{width:1366,height:768,deviceScaleFactor:1,mobile:false});
  await until(()=>page.eval('window.__smear.quality().canvas[0]===1366'),{label:'restore capture size'});

  const social=await page.eval('({canonical:document.querySelector("link[rel=canonical]").href,image:document.querySelector("meta[property=\\"og:image\\"]").content,twitter:document.querySelector("meta[name=\\"twitter:card\\"]").content})');
  check('canonical and social sharing metadata point to SMEAR',()=>{
    assert.equal(social.canonical,'https://tront.xyz/smear/');
    assert.equal(social.image,'https://tront.xyz/smear/og-image.png?v=081');
    assert.equal(social.twitter,'summary_large_image');
  });

  const wall = await page.eval('(() => {const a=window.__smear;a.panel(null);a.reset();a.manual(true);a.wallSpill("front");const deposited=a.state();a.step(180);a.view([3,2.8,-3],[.1,2,-7.8]);return {deposited,after:a.state(),wetWalls:a.paintFaces().filter(s=>Math.abs(s.n[1])<.2&&s.wet>0)};})()');
  check('wall spill creates persistent wet wall deposits', () => {
    assert(wall.deposited.stats.splats > 0);
    assert(wall.wetWalls.length > 0);
    assert(wall.after.wetSupply > 0);
    finiteBodies(wall.after);
  });
  receipts.wall = { wetWalls: wall.wetWalls, state: brief(wall.after) };
  await page.eval('for(let i=0;i<16;i++)window.__smear.render()');
  await page.shot(resolve(out, 'smear-v8-wall.png'));

  const dragStart=await page.eval(`(()=>{const a=window.__smear;a.preset('default');a.panel(null);a.reset();a.tune({recover:false,walking:false});a.view([3.4,3.3,4.8],[0,.1,1]);for(const name of ['Torso','Hips','Head'])for(const n of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]])a.bodyPaint(0,name,n,.85);a.manual(false);return{point:a.project(0,'Torso'),stats:a.state().stats};})()`);
  await page.mouse('mouseMoved',dragStart.point.x,dragStart.point.y);
  await page.mouse('mousePressed',dragStart.point.x,dragStart.point.y);
  const held=await page.eval('window.__smear.state().grab');
  for(let i=1;i<=48;i++){
    await page.mouse('mouseMoved',dragStart.point.x+Math.sin(i/48*Math.PI)*250,Math.min(720,dragStart.point.y+75));
    await sleep(16);
  }
  await page.mouse('mouseReleased',dragStart.point.x,dragStart.point.y);
  const dragged=await page.eval('window.__smear.state()');
  check('native mouse drag paints persistent floor smears and releases the body',()=>{
    assert(held,'mouse must grab a physical body');assert.equal(dragged.grab,null);
    assert(dragged.stats.strokeSegments>dragStart.stats.strokeSegments);
    assert(dragged.stats.smearMeters>dragStart.stats.smearMeters+.1);
    finiteBodies(dragged);
  });
  receipts.mouseDrag={held,state:brief(dragged)};
  await page.shot(resolve(out,'smear-v8-mouse-drag.png'));

  await page.eval('localStorage.removeItem("smear.tune.v8");localStorage.setItem("dragmark.tune.v7",JSON.stringify({grab:1.9,bleeding:1.7,fov:76,walking:false}))');
  await page.goto(pathToFileURL(resolve(root, 'index.html')).href);
  await until(() => page.eval('!!window.__smear && !document.getElementById("loading")'), { label: 'tuning migration boot' });
  const migration = await page.eval('({tune:window.__smear.state().tune,saved:JSON.parse(localStorage.getItem("smear.tune.v8")),legacy:JSON.parse(localStorage.getItem("dragmark.tune.v7"))})');
  check('legacy V7 tuning migrates into SMEAR V8 storage', () => {
    for (const [key,value] of Object.entries({grab:1.9,bleeding:1.7,fov:76,walking:false})) {
      assert.equal(migration.tune[key],value);
      assert.equal(migration.saved[key],value);
      assert.equal(migration.legacy[key],value);
    }
  });
  await page.eval('localStorage.setItem("smear.tune.v8",JSON.stringify({grab:1.1,fov:66}));localStorage.setItem("dragmark.tune.v7",JSON.stringify({grab:2.6,fov:89}))');
  await page.goto(pathToFileURL(resolve(root, 'index.html')).href);
  await until(() => page.eval('!!window.__smear && !document.getElementById("loading")'), { label: 'existing SMEAR settings boot' });
  const retained = await page.eval('window.__smear.state().tune');
  check('existing SMEAR tuning takes precedence over legacy settings', () => {
    assert.equal(retained.grab,1.1);
    assert.equal(retained.fov,66);
  });
  receipts.browserErrors = page.logs.filter(s => /^EXCEPTION:|^error:/i.test(s));
  check('no browser exceptions or console errors', () => assert.deepEqual(receipts.browserErrors, []));
  receipts.result = 'COMPLETE all checks passed';
  console.log(`${receipts.result} (${receipts.checks.length} checks)`);
} catch (error) {
  receipts.result = 'FAIL';
  receipts.error = error.stack;
  receipts.browserErrors = page.logs;
  await page.shot(resolve(out, 'failure.png')).catch(() => {});
  throw error;
} finally {
  await writeFile(resolve(out, 'verification.json'), JSON.stringify(receipts, null, 2) + '\n');
  page.kill();
}
