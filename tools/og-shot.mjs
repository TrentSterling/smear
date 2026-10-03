import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { launch,until } from './cdp.mjs';

const destination=resolve(process.argv[2]||'og-image.png');
const page=await launch({port:9589,width:1200,height:630});
try{
  await page.init('window.requestAnimationFrame=()=>0');
  await page.goto(pathToFileURL(resolve('index.html')).href);
  await until(()=>page.eval('!!window.__smear&&!document.getElementById("loading")'),{label:'SMEAR boot'});
  await page.eval(`(async()=>{
    const a=window.__smear;a.manual(true);a.preset('default');
    if(window.__smearGPU){a.reset();await a.step(45);await a.grab(0,'Right foot');for(let i=0;i<55;i++){a.target([Math.sin(i*.13)*1.6,.16,.6+Math.cos(i*.16)]);await a.step(16);}a.release();await a.step(30);}else a.trace(60,14);
    a.view([3.4,3.25,4.2],[-.4,.12,.65]);
    for(let i=0;i<16;i++)a.render();
    for(const c of document.querySelectorAll('canvas'))if(c.id!=='world')c.style.display='none';if(a.perf)a.perf.show(false);
    const brand=document.createElement('div');brand.style.cssText='position:fixed;inset:0;pointer-events:none;color:#25312e;font-family:Arial,sans-serif';
    brand.innerHTML='<div style="position:absolute;left:72px;top:42px;font-weight:900;font-size:112px;letter-spacing:-7px;line-height:1;color:#8f211e">SMEAR</div><div style="position:absolute;left:78px;top:157px;font-size:25px;font-weight:700">Leave a mark.</div><div style="position:absolute;right:64px;bottom:34px;font:700 17px monospace;letter-spacing:1px">TRONT.XYZ / SMEAR</div>';
    document.body.append(brand);
  })()`);
  await page.shot(destination);
  const errors=page.logs.filter(s=>/^EXCEPTION:|^error:/i.test(s));
  if(errors.length)throw new Error(errors.join('\n'));
  console.log(`OG image rendered from SMEAR: ${destination} (1200 x 630)`);
}finally{page.kill();}
