// Prove prewarming stays silent, reuses the graph on native input, and frees voices.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {launch,until,sleep} from './cdp.mjs';
import {launchFirefox} from './bidi.mjs';

const firefox=process.argv[2]==='firefox',out=resolve('tools/out','audio-verify-'+(firefox?'firefox':'chrome'));
await mkdir(out,{recursive:true});
const source=await readFile('index.html','utf8');
const hook=`window.requestAnimationFrame=()=>0;window.audioAudit={constructors:0,sources:0,oscillators:0,disconnects:0};
 const NativeAudioContext=window.AudioContext||window.webkitAudioContext;
 const CountedAudioContext=function(...a){audioAudit.constructors++;return new NativeAudioContext(...a);};CountedAudioContext.prototype=NativeAudioContext.prototype;
 if(window.AudioContext)window.AudioContext=CountedAudioContext;else window.webkitAudioContext=CountedAudioContext;
 for(const [name,key]of [['createBufferSource','sources'],['createOscillator','oscillators']]){const original=BaseAudioContext.prototype[name];BaseAudioContext.prototype[name]=function(...a){audioAudit[key]++;return original.apply(this,a);};}
 const disconnect=AudioNode.prototype.disconnect;AudioNode.prototype.disconnect=function(...a){audioAudit.disconnects++;return disconnect.apply(this,a);};`;
const fixture=`const audioQA={
 state:()=>({enabled:soundOn,unlocked:audioUnlocked,state:audio?.state||'uninitialized',master:master?.gain.value,wet:scrapeGain?.gain.value,dry:dryGain?.gain.value,audit:{...audioAudit}}),
 voices:()=>{noiseSound(.025,.08,720);tone(.025,.08,120);},
 scrape:(wet,dry)=>updateScrape(wet,dry),
};`;
const file=resolve(out,'runtime.html');
await writeFile(file,source.replace('</head>','<script>'+hook+'</script></head>').replace('window.__smear={state,',fixture+'\nwindow.__smear={audioQA,state,'));
const page=firefox?await launchFirefox({port:9595,width:1280,height:720}):await launch({port:9597,width:1280,height:720});
const receipt={browser:firefox?'Firefox':'Chrome',sourceSha256:createHash('sha256').update(source).digest('hex'),outputMuted:true,checks:[]};
const pass=(name,fn)=>{fn();receipt.checks.push(name);console.log('PASS '+name);};
try{
 await page.goto(pathToFileURL(file).href);await until(()=>page.eval('!!window.__smear&&!document.getElementById("loading")'));
 receipt.boot=await page.eval('__smear.audioQA.state()');
 pass('audio graph initialized once while loading',()=>{assert.equal(receipt.boot.enabled,true);assert.equal(receipt.boot.audit.constructors,1);assert.equal(receipt.boot.audit.sources,2);assert.equal(receipt.boot.audit.oscillators,0);});
 pass('continuous layers remain silent and locked before input',()=>{assert.equal(receipt.boot.unlocked,false);assert.equal(receipt.boot.wet,0);assert.equal(receipt.boot.dry,0);});
 await page.eval('__smear.manual(true);__smear.rawStep(300);__smear.audioQA.voices();__smear.audioQA.scrape(1,1)');
 receipt.locked=await page.eval('__smear.audioQA.state()');
 pass('pre-input simulation and sound requests cannot create audible layers',()=>{assert.deepEqual(receipt.locked.audit,receipt.boot.audit);assert.equal(receipt.locked.wet,0);assert.equal(receipt.locked.dry,0);});
 await page.mouse('mousePressed',640,360);await page.mouse('mouseReleased',640,360);
 await until(()=>page.eval('__smear.audioQA.state().state==="running"'));
 receipt.unlocked=await page.eval('__smear.audioQA.state()');
 pass('native input unlocks the running original audio graph',()=>{assert.equal(receipt.unlocked.enabled,true);assert.equal(receipt.unlocked.unlocked,true);assert.equal(receipt.unlocked.audit.constructors,1);assert.equal(receipt.unlocked.master,receipt.boot.master);});
 await sleep(400);
 const before=await page.eval('__smear.audioQA.state()');await page.eval('__smear.audioQA.voices()');
 receipt.voices=await page.eval('__smear.audioQA.state()');
 pass('noise and tone processing remains enabled after unlock',()=>{assert.equal(receipt.voices.audit.sources,before.audit.sources+1);assert.equal(receipt.voices.audit.oscillators,before.audit.oscillators+1);});
 await sleep(400);receipt.ended=await page.eval('__smear.audioQA.state()');
 pass('finished noise and tone disconnect their five transient nodes',()=>assert.equal(receipt.ended.audit.disconnects,before.audit.disconnects+5));
 receipt.errors=page.logs.filter(s=>/^EXCEPTION:|^error:/i.test(s));pass('no audio browser errors',()=>assert.deepEqual(receipt.errors,[]));
 receipt.result='COMPLETE audio lifecycle checks passed';console.log(receipt.result+` (${receipt.checks.length} checks)`);
}catch(error){receipt.result='FAIL';receipt.error=error.stack;throw error;}
finally{await writeFile(resolve(out,'verification.json'),JSON.stringify(receipt,null,2)+'\n');page.kill();}
