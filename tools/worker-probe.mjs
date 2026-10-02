import {launch,until} from './cdp.mjs';
import {launchFirefox} from './bidi.mjs';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const browser=process.argv[2]||'firefox';
const page=browser==='firefox'?await launchFirefox({port:9595,width:1366,height:768}):await launch({port:9597,width:1366,height:768});
try{
 await page.goto(pathToFileURL(resolve('index.html')).href);await until(()=>page.eval('!!window.__smear'),{label:'worker paint boot'});
 console.log(await page.eval(`(async()=>{__smear.manual(true);__smear.puddle([0,0,0],.5);await __smear.paintReady();return{paint:__smear.paintStatus(),pixel:__smear.sampleFloor(0,0),webgpu:!!navigator.gpu,adapter:!!(await navigator.gpu?.requestAdapter()),gl:document.getElementById('world').getContext('webgl2').getError()};})()`));
 console.log(page.logs.filter(s=>/^EXCEPTION:|^error:/i.test(s)));
}finally{page.kill();}
