SmearCompute.prototype.beginToy=function(kind){
 if(this.buddyBusy)return false;
 this.cancelBuddy();this.placement={kind,yaw:0};this.inputAction=0;this.releasePending=null;this.pickRequested=false;this.pickEpoch++;return true;
};
SmearCompute.prototype.removeToy=async function(id=-1){
 if(this.buddyBusy)return false;this.cancelBuddy();this.pickRequested=false;this.pickEpoch++;this.toyRemove=id;this.inputAction=10;const epoch=this.audioEpoch;this.submit(0);this.toyRemove=null;
 const b=this.buffer('one-shot prop removal result',16,GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST),e=this.device.createCommandEncoder();e.copyBufferToBuffer(this.workBuffer,1013*4,b,0,4);this.device.queue.submit([e.finish()]);await b.mapAsync(GPUMapMode.READ);const result=new Uint32Array(b.getMappedRange())[0];b.unmap();b.destroy();return epoch===this.audioEpoch&&result===1;
};
SmearCompute.prototype.restoreToys=function(){this.cancelBuddy();this.pickRequested=false;this.pickEpoch++;this.inputAction=11;this.submit(0);};
