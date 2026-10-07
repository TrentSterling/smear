SmearCompute.prototype.beginBuddy=function(base){
 if(this.buddyBusy)return false;
 this.placement={base,yaw:0};this.inputAction=0;this.releasePending=null;this.pickRequested=false;this.pickEpoch++;
 return true;
};
SmearCompute.prototype.cancelBuddy=function(){
 this.placement=null;
 if(this.ready&&!this.lost){const e=this.device.createCommandEncoder();e.clearBuffer(this.workBuffer,1006*4,4);this.device.queue.submit([e.finish()]);}
};
SmearCompute.prototype.confirmBuddy=async function(){
 if(!this.placement||this.buddyBusy)return null;
 const request={...this.placement},epoch=this.audioEpoch;this.buddyBusy=true;
 try{
  this.inputAction=9;this.submit(0);
  const b=this.buffer('one-shot buddy placement result',32,GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST),e=this.device.createCommandEncoder();
  e.copyBufferToBuffer(this.workBuffer,1006*4,b,0,32);this.device.queue.submit([e.finish()]);
  await b.mapAsync(GPUMapMode.READ);const result=new Uint32Array(b.getMappedRange().slice(0));b.unmap();b.destroy();
  if(epoch!==this.audioEpoch)return null;
  const status=result[7];if(status===1){if(!request.kind){this.bodyCount=Math.max(this.bodyCount,request.base+15);this.syncCounts();}this.cancelBuddy();}
  return {status,kind:request.kind,slot:result[1],base:request.base,adding:result[0]===1};
 }finally{this.buddyBusy=false;}
};
