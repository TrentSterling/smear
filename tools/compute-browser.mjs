// Run the same GPU gameplay checks against independent Tint and Naga compilers.
import {launch} from './cdp.mjs';
import {launchFirefox} from './bidi.mjs';

export async function launchComputeBrowser(options){
 if(!process.argv.includes('firefox'))return launch(options);
 // Headless Firefox exposes WebGPU but returns no adapter on this Windows host.
 // A dedicated, muted profile uses real hardware with no user session attached.
 const page=await launchFirefox({...options,headless:false});
 const bidi=page.call;
 page.call=(method,params)=>method==='Emulation.setDeviceMetricsOverride'
  ?bidi('browsingContext.setViewport',{context:page.context,viewport:{width:params.width,height:params.height},devicePixelRatio:params.deviceScaleFactor})
  :bidi(method,params);
 page.init=source=>bidi('script.addPreloadScript',{functionDeclaration:'()=>{'+source+'}'});
 return page;
}
