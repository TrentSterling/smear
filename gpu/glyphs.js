// Shared distance-field glyphs: room signs, curved equipment markings and UI.
window.smearInflate=async data=>{const binary=atob(data),bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);return new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();};
SmearCompute.prototype.glyphMesh=function(text,width,height,color=0xe8dfc6,radius=0,face=1){
 const T=this.THREE,font=window.__smearGlyphs.faces[face],glyphs=[...text].map(c=>font.glyphs[c]||font.glyphs['?']);
 const advance=glyphs.reduce((s,g)=>s+g.advance,0),size=Math.min(height/.85,width/Math.max(advance,.001)),positions=[],uv=[],indices=[];let pen=-advance*size/2;
 for(const g of glyphs){const [left,top,w,h]=g.box,[u0,v0,u1,v1]=g.uv,base=positions.length/3;
  for(const [x,y]of [[pen+left*size,-(top+h)*size-height*.28],[pen+(left+w)*size,-(top+h)*size-height*.28],[pen+(left+w)*size,-top*size-height*.28],[pen+left*size,-top*size-height*.28]]){if(radius)positions.push(Math.sin(x/radius)*radius,y,Math.cos(x/radius)*radius);else positions.push(x,y,0);}
  uv.push(u0,v1,u1,v1,u1,v0,u0,v0);indices.push(base,base+1,base+2,base,base+2,base+3);pen+=g.advance*size;
 }
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();
 const material=new T.MeshStandardMaterial({color,roughness:.58});material.color.convertSRGBToLinear();material.userData.glyph=true;const mesh=new T.Mesh(geometry,material);mesh.name='Glyphs: '+text;mesh.userData.glyphText=text;mesh.castShadow=false;return mesh;
};
SmearCompute.prototype.initGlyphs=async function(){
 const d=this.device,a=window.__smearGlyphs;this.glyphTexture=d.createTexture({label:'Barlow SDF glyph atlas',size:[a.width,a.height],format:'r8unorm',usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST});
 d.queue.writeTexture({texture:this.glyphTexture},await this.decodedAssets.glyph,{bytesPerRow:a.width},[a.width,a.height]);
 const canvas=document.createElement('canvas');canvas.id='gpu-glyphs';canvas.style.cssText='position:fixed;left:0;top:0;pointer-events:none;z-index:1000';document.body.append(canvas);
 const context=canvas.getContext('webgpu');context.configure({device:d,format:this.format,alphaMode:'premultiplied'});
 const module=d.createShaderModule({label:'GPU UI glyphs',code:window.__smearGlyphShader});const info=await module.getCompilationInfo();if(info.messages.some(m=>m.type==='error'))throw Error(info.messages.map(m=>m.message).join('\n'));
 const pipeline=await d.createRenderPipelineAsync({label:'GPU UI glyphs',layout:'auto',vertex:{module,entryPoint:'glyphVertex',buffers:[{arrayStride:32,attributes:[{shaderLocation:0,offset:0,format:'float32x2'},{shaderLocation:1,offset:8,format:'float32x2'},{shaderLocation:2,offset:16,format:'float32x4'}]}]},fragment:{module,entryPoint:'glyphFragment',targets:[{format:this.format,blend:{color:{srcFactor:'one',dstFactor:'one-minus-src-alpha'},alpha:{srcFactor:'one',dstFactor:'one-minus-src-alpha'}}}]}});
 const viewport=this.buffer('UI glyph crop transform',16,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST);
 this.glyphUI={canvas,context,pipeline,viewport,group:d.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:this.glyphTexture.createView()},{binding:1,resource:d.createSampler({minFilter:'linear',magFilter:'linear'})},{binding:2,resource:{buffer:viewport}}]}),buffer:this.buffer('UI glyph vertices',32*6*24000,GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST)};
};
