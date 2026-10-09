// DOM retains accessible text, keyboard navigation and hit targets. All visible
// lettering after GPU init is emitted as SDF quads, including canvas panels.
let glyphDirty=true,glyphDOM=[],glyphCanvas=[],glyphSignature='',glyphFontReady=false;
const glyphNodeCache=new WeakMap();
const glyphCharts=new Map(),canvasFill=CanvasRenderingContext2D.prototype.fillText,canvasClear=CanvasRenderingContext2D.prototype.clearRect;
CanvasRenderingContext2D.prototype.clearRect=function(...args){if(this.canvas.id?.startsWith('perf-'))glyphCharts.delete(this.canvas);return canvasClear.apply(this,args);};
CanvasRenderingContext2D.prototype.fillText=function(text,x,y){
 if(!this.canvas.id?.startsWith('perf-')||!window.__smearGPU?.glyphUI||!glyphFontReady)return canvasFill.apply(this,arguments);
 let rows=glyphCharts.get(this.canvas);if(!rows){rows=[];glyphCharts.set(this.canvas,rows);}rows.push({text,x,y,size:Number(/([\d.]+)px/.exec(this.font)?.[1]||12),color:glyphColor(this.fillStyle),align:this.textAlign});
};
const glyphFaces=window.__smearGlyphs.faces;
const glyphFonts=glyphFaces.map((face,i)=>new FontFace(i?'Smear Display':'Smear Text',Uint8Array.from(atob(face.woff),c=>c.charCodeAt(0))));
Promise.all(glyphFonts.map(async f=>{await f.load();document.fonts.add(f);})).then(()=>{glyphFontReady=true;glyphDirty=true;});
const glyphStyle=document.createElement('style');glyphStyle.textContent=`body,button,input,select,textarea{font-family:'Smear Text',sans-serif!important;font-kerning:none!important;font-variant-ligatures:none!important}h1,h2,h3,#equipped-tool{font-family:'Smear Display',sans-serif!important}#toybox strong{font-family:'Smear Text',sans-serif!important}body.gpu-letters *{-webkit-text-fill-color:transparent!important;text-shadow:none!important}#runtime-profile{left:50%!important;right:auto!important;top:50%!important;bottom:auto!important;transform:translate(-50%,-50%);max-width:calc(100vw - 40px);max-height:calc(100vh - 40px)}`;document.head.append(glyphStyle);
new MutationObserver(records=>{if(records.some(r=>r.target.id!=='gpu-glyphs'&&r.target.nodeName!=='CANVAS'&&(r.type!=='attributes'||r.oldValue!==r.target.getAttribute(r.attributeName))))glyphDirty=true;}).observe(document.body,{subtree:true,characterData:true,childList:true,attributes:true,attributeOldValue:true,attributeFilter:['style','class','hidden','value']});
window.addEventListener('resize',()=>{glyphDirty=true;});window.addEventListener('scroll',()=>{glyphDirty=true;},true);document.addEventListener('input',()=>{glyphDirty=true;});
function glyphColor(value){if(typeof value!=='string')return[.953,.918,.839,1];if(value[0]==='#'){let h=value.slice(1);if(h.length===3||h.length===4)h=[...h].map(c=>c+c).join('');return[0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255).concat(h.length===8?parseInt(h.slice(6,8),16)/255:1);}const parts=value.match(/[\d.]+/g)?.map(Number)||[243,234,214];return[parts[0]/255,parts[1]/255,parts[2]/255,parts[3]??1];}
function glyphQuad(list,g,x,baseline,size,color,clip=[0,0,W,H]){
 const [a,b,w,h]=g.box;let x0=x+a*size,y0=baseline+b*size,x1=x0+w*size,y1=y0+h*size;let [u0,v0,u1,v1]=g.uv;
 if(x1<=clip[0]||x0>=clip[2]||y1<=clip[1]||y0>=clip[3])return;
 const ox=x0,oy=y0,ow=x1-x0,oh=y1-y0,du=u1-u0,dv=v1-v0;
 x0=Math.max(x0,clip[0]);x1=Math.min(x1,clip[2]);y0=Math.max(y0,clip[1]);y1=Math.min(y1,clip[3]);u1=u0+(x1-ox)/ow*du;v1=v0+(y1-oy)/oh*dv;u0+=(x0-ox)/ow*du;v0+=(y0-oy)/oh*dv;
 for(const [x,y,u,v]of [[x0,y0,u0,v0],[x1,y0,u1,v0],[x1,y1,u1,v1],[x0,y0,u0,v0],[x1,y1,u1,v1],[x0,y1,u0,v1]])list.push(x/W*2-1,1-y/H*2,u,v,...color);
}
function glyphLine(list,text,x,baseline,size,color,face=0,align='left'){
 const f=glyphFaces[face],glyphs=[...String(text)].map(c=>f.glyphs[c]||f.glyphs['?']);let pen=x;const width=glyphs.reduce((sum,g)=>sum+g.advance*size,0);if(align==='center')pen-=width/2;if(align==='right'||align==='end')pen-=width;
 for(const g of glyphs){glyphQuad(list,g,pen,baseline,size,color);pen+=g.advance*size;}
}
const originalFillText=ctx.fillText.bind(ctx);
ctx.fillText=function(text,x,y){if(!window.__smearGPU?.glyphUI||!glyphFontReady)return originalFillText(text,x,y);const size=Number(/([\d.]+)px/.exec(this.font)?.[1]||14),face=/bold|[6-9]00/.test(this.font)?1:0;let baseline=y;if(this.textBaseline==='middle')baseline+=size*.32;if(this.textBaseline==='top')baseline+=size*.8;glyphLine(glyphCanvas,text,x,baseline,size,glyphColor(this.fillStyle),face,this.textAlign);};
function collectDOMGlyphs(){
 const result=[],walk=document.createTreeWalker(document.body,NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_TEXT,{acceptNode(node){if(node.nodeType===3)return NodeFilter.FILTER_ACCEPT;return node.matches('script,style,canvas,textarea,select,[hidden]')||getComputedStyle(node).display==='none'?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_SKIP;}}),range=document.createRange(),styles=new Map();let node;
 const styled=el=>{let s=styles.get(el);if(!s){s=getComputedStyle(el);styles.set(el,s);}return s;};
 while(node=walk.nextNode()){
  const parent=node.parentElement;if(!parent||parent.closest('script,style,canvas,textarea,select')||!node.textContent.trim())continue;
  const style=styled(parent);if(style.visibility!=='visible'||!parent.getClientRects().length)continue;
  let clip=[0,0,W,H],opacity=1;for(let el=parent;el&&el!==document.body;el=el.parentElement){const cs=styled(el);opacity*=Number(cs.opacity);if(cs.display==='none'){opacity=0;break;}if(/auto|scroll|hidden|clip/.test(cs.overflow)){const r=el.getBoundingClientRect();clip=[Math.max(clip[0],r.left),Math.max(clip[1],r.top),Math.min(clip[2],r.right),Math.min(clip[3],r.bottom)];}}
  if(!opacity)continue;const size=parseFloat(style.fontSize),face=style.fontFamily.includes('Smear Display')?1:0,f=glyphFaces[face],color=glyphColor(style.color);color[3]*=opacity;
  range.selectNodeContents(node);const bounds=range.getBoundingClientRect(),key=[node.textContent,size,face,...color,...clip,W,H,bounds.x,bounds.y,bounds.width,bounds.height,style.textTransform].join('|'),cached=glyphNodeCache.get(node);
  if(cached?.key===key){result.push(...cached.vertices);continue;}const first=result.length;
  for(let i=0;i<node.length;i++){const char=style.textTransform==='uppercase'?node.textContent[i].toUpperCase():node.textContent[i];if(/\s/.test(char))continue;range.setStart(node,i);range.setEnd(node,i+1);const r=range.getBoundingClientRect();if(!r.width||!r.height)continue;const g=f.glyphs[char]||f.glyphs['?'];if(parent.closest('#play-hud'))glyphQuad(result,g,r.x+.8,r.y+1+r.height*f.ascent/(f.ascent+f.descent),size,[0,0,0,.85],clip);glyphQuad(result,g,r.x,r.y+r.height*f.ascent/(f.ascent+f.descent),size,color,clip);}
  glyphNodeCache.set(node,{key,vertices:result.slice(first)});
 }
 // Search fields retain native caret, selection and editing; only their visible
 // text is supplied by the atlas.
 for(const input of document.querySelectorAll('input[type="text"],input[type="search"],input:not([type]),select')){if(!input.getClientRects().length)continue;const s=getComputedStyle(input),r=input.getBoundingClientRect();glyphLine(result,input.selectedOptions?.[0]?.text||input.value||input.placeholder,r.x+parseFloat(s.paddingLeft)+2,r.y+r.height*.5+parseFloat(s.fontSize)*.32,parseFloat(s.fontSize),glyphColor(s.color));}
 return result;
}
function drawGlyphUI(){
 const ui=window.__smearGPU?.glyphUI;if(!ui||!glyphFontReady)return;
 if(!document.body.classList.contains('gpu-letters')){document.body.classList.add('gpu-letters');glyphDirty=true;}
 const signature=[W,H,panel,paused,showHUD,tool,fpsControl.phase].join('|');if(signature!==glyphSignature){glyphSignature=signature;glyphDirty=true;}
 if(glyphDirty){glyphDOM=collectDOMGlyphs();glyphDirty=false;}
 const charts=[];for(const [canvas,rows]of glyphCharts){if(!canvas.getClientRects().length)continue;const r=canvas.getBoundingClientRect(),scale=r.width/canvas.width;for(const row of rows)glyphLine(charts,row.text,r.x+row.x*scale,r.y+row.y*scale,row.size*scale,row.color,0,row.align);}
 const data=new Float32Array([...glyphDOM,...glyphCanvas,...charts]);if(data.byteLength>ui.buffer.size)throw Error('GPU glyph capacity exceeded');
 // Bound the transparent swapchain to actual letters. A fullscreen transparent
 // WebGPU surface otherwise incurs a second native-resolution composite.
 let minX=1,minY=1,maxX=-1,maxY=-1;for(let i=0;i<data.length;i+=48){minX=Math.min(minX,data[i]);maxX=Math.max(maxX,data[i+16]);minY=Math.min(minY,data[i+17]);maxY=Math.max(maxY,data[i+1]);}
 const left=Math.max(0,Math.floor(((minX+1)*W/2-4)/16)*16),top=Math.max(0,Math.floor(((1-maxY)*H/2-4)/16)*16),right=Math.min(W,Math.ceil(((maxX+1)*W/2+4)/16)*16),bottom=Math.min(H,Math.ceil(((1-minY)*H/2+4)/16)*16),width=Math.max(1,right-left),height=Math.max(1,bottom-top);
 const scale=window.devicePixelRatio||1,pixelWidth=Math.round(width*scale),pixelHeight=Math.round(height*scale);if(ui.canvas.width!==pixelWidth||ui.canvas.height!==pixelHeight){ui.canvas.width=pixelWidth;ui.canvas.height=pixelHeight;ui.canvas.style.width=width+'px';ui.canvas.style.height=height+'px';}
 ui.canvas.style.left=left+'px';ui.canvas.style.top=top+'px';compute.device.queue.writeBuffer(ui.viewport,0,new Float32Array([W/width,H/height,(W-2*left)/width-1,1-(H-2*top)/height]));
 compute.device.queue.writeBuffer(ui.buffer,0,data);const encoder=compute.device.createCommandEncoder({label:'GPU text'}),pass=encoder.beginRenderPass({colorAttachments:[{view:ui.context.getCurrentTexture().createView(),clearValue:[0,0,0,0],loadOp:'clear',storeOp:'store'}]});pass.setPipeline(ui.pipeline);pass.setBindGroup(0,ui.group);pass.setVertexBuffer(0,ui.buffer);pass.draw(data.length/8);pass.end();compute.device.queue.submit([encoder.finish()]);ui.glyphCount=data.length/48;
}
const drawBeforeGlyphs=drawUI;
const drawStaticBeforeGlyphs=drawStaticUI;
drawStaticUI=()=>{glyphCanvas=[];drawStaticBeforeGlyphs();};
drawUI=()=>{drawBeforeGlyphs();drawGlyphUI();};
