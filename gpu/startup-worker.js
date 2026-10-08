// Asset decoding runs outside the page's UI thread. Buffers transfer ownership.
async function meshCache(){return new Promise(resolve=>{try{const r=indexedDB.open('smear-authored-mesh',1);r.onupgradeneeded=()=>r.result.createObjectStore('mesh');r.onsuccess=()=>resolve(r.result);r.onerror=()=>resolve(null);}catch{resolve(null);}});}
self.onmessage=async({data})=>{try{
 if(data.kind==='mesh'){
  const db=await meshCache();let cached=null;if(db)cached=await new Promise(resolve=>{const r=db.transaction('mesh').objectStore('mesh').get('current');r.onsuccess=()=>resolve(r.result);r.onerror=()=>resolve(null);});
  let buffer;if(cached?.hash===data.hash&&cached.buffer.byteLength===data.bytes){buffer=cached.buffer;}else{
   const mesh=meshAsset(data.rig);buffer=new ArrayBuffer(data.bytes);for(const [key,a]of Object.entries(data.arrays)){const view=key==='indices'?new Uint32Array(buffer,a.offset,a.length):new Float32Array(buffer,a.offset,a.length);view.set(mesh[key]);}
   if(db)await new Promise(resolve=>{const tx=db.transaction('mesh','readwrite');tx.objectStore('mesh').put({hash:data.hash,buffer},'current');tx.oncomplete=tx.onerror=tx.onabort=resolve;});
  }db?.close();postMessage({kind:data.kind,buffer,cached:cached?.hash===data.hash},[buffer]);return;
 }
 const binary=atob(data.data),bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);const buffer=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();postMessage({kind:data.kind,buffer},[buffer]);
}catch(error){postMessage({kind:data.kind,error:String(error)});}};
