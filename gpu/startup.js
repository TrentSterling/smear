window.__smearStartup={start:performance.now(),stage:'Preparing the room',completed:0,total:60,frames:0,maxFrameMS:0,phases:[],programs:[]};
window.smearLoading=(stage,completed)=>{const s=window.__smearStartup;s.stage=stage;if(completed!==undefined)s.completed=completed;s.phases.push({stage,at:performance.now()-s.start});};
// A small loading DOM updates only when its values change, at most ten times/sec.
window.smearLoadingFrame=()=>{const s=window.__smearStartup,now=performance.now();if(s.last)s.maxFrameMS=Math.max(s.maxFrameMS,now-s.last);s.last=now;s.frames++;if(now<(s.nextUI||0))return;s.nextUI=now+100;
 const label=document.getElementById('load-stage'),clock=document.getElementById('load-clock'),bar=document.getElementById('load-progress'),stage=s.preview?'Preparing tools: '+s.completed+' / '+s.total:s.stage;
 if(label&&label.textContent!==stage)label.textContent=stage;const time=((now-s.start)/1000).toFixed(1)+' s';if(clock&&clock.textContent!==time)clock.textContent=time;const percent=Math.max(3,Math.min(98,s.completed/s.total*100))+'%';if(bar&&bar.style.width!==percent)bar.style.width=percent;
};
SmearCompute.prototype.decodeAssets=function(){
 const url=URL.createObjectURL(new Blob([window.__smearDummyMesh.worker,'\n',window.__smearStartupWorker],{type:'text/javascript'})),worker=new Worker(url);URL.revokeObjectURL(url);this.assetWorker=worker;const pending={};
 this.decodedAssets={};for(const kind of ['mesh','glyph']){this.decodedAssets[kind]=new Promise((resolve,reject)=>{pending[kind]={resolve,reject};});const m=window.__smearDummyMesh;worker.postMessage(kind==='mesh'?{kind,hash:m.sourceHash,rig:m.rig,arrays:m.arrays,bytes:m.bytes}:{kind,data:window.__smearGlyphs.data});}
 worker.onmessage=({data})=>{const p=pending[data.kind];if(data.kind==='mesh')__smearStartup.meshCached=!!data.cached;if(data.error)p.reject(Error(data.error));else p.resolve(data.buffer);delete pending[data.kind];if(!Object.keys(pending).length){worker.terminate();this.assetWorker=null;}};
 worker.onerror=e=>{for(const p of Object.values(pending))p.reject(Error(e.message));worker.terminate();};
};
