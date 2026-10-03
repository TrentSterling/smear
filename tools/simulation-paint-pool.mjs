// Preserve the existing rasterizer in four nested workers. The simulation owns
// ordered commands and bounded queues; only cropped pigment reaches the renderer.
import assert from 'node:assert/strict';

export function createSimulationPaintPool(html){
 const start=html.indexOf('const code=`const PI=Math.PI'),end=html.indexOf('try{if(typeof Worker',start);
 assert(start>=0&&end>start,'Existing embedded paint worker required');
 const rasterCode=html.slice(start,end).replace('const job=e.data,t=performance.now();',`if(e.data.inspect){const images=[];for(const [id,s]of records)images.push([id,new FileReaderSync().readAsDataURL(await s.canvas.convertToBlob({type:'image/png'}))]);postMessage({inspect:images});return;}const job=e.data,t=performance.now();`);
 assert(rasterCode.includes('if(e.data.inspect)'),'Paint inspection hook required');
 return String.raw`
 const simulationPaintPool=(()=>{
  const rasterOptions={willReadFrequently:/Firefox\//.test(navigator.userAgent)},streamRecords=false,pixelTransport=/Firefox\//.test(navigator.userAgent),atlasTransport=false;
  `+rasterCode+String.raw`
  const descriptors=window.__simulationPaintRecords,slots=[],CAP=8192,BATCH=1024;
  let error=null,totalRaster=0,totalTransfer=0,maxPending=0,jobs=0;
  const url=URL.createObjectURL(new Blob([code],{type:'text/javascript'}));
  for(let i=0;i<(pixelTransport?4:1);i++){
   const slot={worker:new Worker(url),busy:null,queue:[],known:new Set(),removed:[],inspect:null};slots.push(slot);
   slot.worker.onerror=e=>{error=Error(e.message);};
   slot.worker.onmessage=e=>{
    if(e.data.inspect){slot.inspect?.(e.data.inspect);slot.inspect=null;return;}
    if(e.data.error){error=Error(e.data.error);return;}
    const job=slot.busy;if(!job){error=Error('Unexpected paint worker reply');return;}
    const byID=new Map(job.records.map(d=>[d.id,d])),patches=e.data.patches.map(p=>{const d=byID.get(p.id);return{...p,revision:d.revision,surface:d.surface,body:d.body,generation:job.generation};});
    totalRaster+=e.data.rasterMS;totalTransfer+=e.data.bitmapMS;jobs++;slot.busy=null;
    if(patches.length)postMessage({paint:true,generation:job.generation,patches},patches.map(p=>p.pixels?p.pixels.buffer:p.bitmap));
    dispatch(slot);
   };
  }
  URL.revokeObjectURL(url);
  const union=(a,b)=>({x0:Math.min(a.x0,b.x0),y0:Math.min(a.y0,b.y0),x1:Math.max(a.x1,b.x1),y1:Math.max(a.y1,b.y1)});
  function region(s){const bounds=s.simulationBounds||(s.simulationBounds=[]);if(s.simulationDirty){const r=s.dirtyRect||{x0:0,y0:0,x1:s.canvas.width,y1:s.canvas.height};bounds.push({revision:s.simulationRevision||0,rect:{...r}});s.simulationDirty=false;s.dirtyRect=null;}while(bounds.length>16){const a=bounds.shift(),b=bounds.shift();bounds.unshift({revision:b.revision,rect:union(a.rect,b.rect)});}return bounds.length?bounds.map(b=>b.rect).reduce(union):null;}
  function descriptor(s){return{id:s.paintId,epoch:s.paintEpoch,revision:s.simulationRevision||0,width:s.canvas.width,height:s.canvas.height,w:s.w,h:s.h,res:s.res,rect:region(s),surface:s.skinOwner?null:s.id,body:s.skinOwner?.id||null};}
  function dispatch(slot){
   if(error||slot.busy||!slot.queue.length&&!slot.removed.length)return;
   const ops=slot.queue.splice(0,BATCH).filter(o=>{const s=descriptors.get(o[0]);return s&&s.paintEpoch===o[1];}),ids=new Set(ops.map(o=>o[0]));
   if(!ops.length&&!slot.removed.length){dispatch(slot);return;}
   const records=Array.from(ids,id=>{const d=descriptor(descriptors.get(id));d.revision=Math.max(...ops.filter(o=>o[0]===id).map(o=>o.revision));return d;}),removed=slot.removed.splice(0);
   slot.busy={ops,records,removed,generation:simulationGeneration};for(const id of ids)slot.known.add(id);
   slot.worker.postMessage(slot.busy);
  }
  function pending(){return slots.reduce((n,s)=>n+s.queue.length+(s.busy?.ops.length||0),0);}
  async function drain(){while(slots.some(s=>s.busy||s.queue.length||s.removed.length)){if(error)throw error;for(const slot of slots)dispatch(slot);await new Promise(r=>setTimeout(r,1));}if(error)throw error;}
  async function enqueue(full=false){
   if(error)throw error;
   // A simulation tick is indivisible. Drain before accepting the next cohort,
   // retaining the original ordered operations instead of discarding pigment.
   const events=simulationPaint.splice(0);
   for(const op of events){if(pending()>=CAP-BATCH)await drain();const s=descriptors.get(op[0]);if(!s||op[1]!==s.paintEpoch)continue;const slot=slots[(op[0]-1)%slots.length];slot.queue.push(op);maxPending=Math.max(maxPending,pending());}
   for(const slot of slots)for(const id of slot.known)if(!descriptors.has(id)){slot.known.delete(id);slot.removed.push(id);}
   if(full){await drain();for(const s of descriptors.values()){s.simulationDirty=true;s.dirtyRect={x0:0,y0:0,x1:s.canvas.width,y1:s.canvas.height};const op=[s.paintId,s.paintEpoch,'present',[]];op.revision=s.simulationRevision||0;slots[(s.paintId-1)%slots.length].queue.push(op);}}
   for(const slot of slots)dispatch(slot);
  }
  async function snapshot(){await enqueue();await drain();const result=await Promise.all(slots.map(s=>new Promise(resolve=>{s.inspect=resolve;s.worker.postMessage({inspect:true});})));return new Map(result.flat());}
  return{enqueue,drain,snapshot,status:()=>({workerCount:slots.length,transport:pixelTransport?'RGBA':'ImageBitmap',jobs,totalRaster,totalTransfer,pending:pending(),maxPending,error:error?.message||null})};
 })();
 `;
}
