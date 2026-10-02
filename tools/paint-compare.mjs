import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {launch} from './cdp.mjs';

const before=resolve('tools/out',`paint-${process.argv[2]||'baseline'}`),after=resolve('tools/out',`paint-${process.argv[3]||'release'}`);
const baseline=JSON.parse(await readFile(resolve(before,'summary.json'),'utf8')),candidate=JSON.parse(await readFile(resolve(after,'summary.json'),'utf8'));
const receipt={before:baseline.source,after:candidate.source,checks:[],images:[]};
function state(s){const x=structuredClone(s);delete x.version;delete x.renderer;for(const k of ['physicsMS','frameMS','paintUploads'])delete x.stats[k];return x;}
function pass(name,test){test();receipt.checks.push(name);console.log('PASS '+name);}
const page=await launch({port:9593,width:1280,height:720});
try{
 for(let i=0;i<baseline.reports.length;i++){
  const b=baseline.reports[i],a=candidate.reports[i];assert.equal(b.preset,a.preset);
  pass(`${a.preset}: exact simulation and stain statistics match V8.1`,()=>assert.deepEqual(state(a.state),state(b.state)));
  const images=await Promise.all([before,after].map(async dir=>'data:image/png;base64,'+(await readFile(resolve(dir,a.preset+'-paint.png'))).toString('base64')));
  const diff=await page.eval(`(async()=>{const imgs=await Promise.all(${JSON.stringify(images)}.map(async src=>{const i=new Image();i.src=src;await i.decode();return i;}));
    const c=document.createElement('canvas');c.width=imgs[0].width;c.height=imgs[0].height;const g=c.getContext('2d',{willReadFrequently:true}),pixels=[];
    for(const img of imgs){g.clearRect(0,0,c.width,c.height);g.drawImage(img,0,0);pixels.push(g.getImageData(0,0,c.width,c.height).data);}
    let total=0,max=0;for(let j=0;j<pixels[0].length;j+=4)for(let k=0;k<3;k++){const d=Math.abs(pixels[0][j+k]-pixels[1][j+k]);total+=d;max=Math.max(max,d);}
    return{meanChannelDelta:total/(c.width*c.height*3),maxChannelDelta:max,width:c.width,height:c.height};})()`);
  receipt.images.push({preset:a.preset,...diff});
  pass(`${a.preset}: floor pigment and coverage match V8.1 within rounding tolerance`,()=>{assert(diff.meanChannelDelta<.1,JSON.stringify(diff));assert(diff.maxChannelDelta<=12,JSON.stringify(diff));});
 }
 receipt.result='COMPLETE paint preservation checks passed';console.log(`${receipt.result} (${receipt.checks.length} checks)`);
}catch(error){receipt.result='FAIL';receipt.error=error.stack;throw error;}
finally{await writeFile(resolve(after,'preservation.json'),JSON.stringify(receipt,null,2)+'\n');page.kill();}
