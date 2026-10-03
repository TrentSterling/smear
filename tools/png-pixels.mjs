// Decode the 8-bit, noninterlaced RGBA PNGs produced by owned browser canvases.
import assert from 'node:assert/strict';
import {inflateSync} from 'node:zlib';
export function decodeCanvasPNG(uri){
 const png=Buffer.from(uri.slice(uri.indexOf(',')+1),'base64');
 assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
 let width=0,height=0;const chunks=[];
 for(let offset=8;offset<png.length;){const length=png.readUInt32BE(offset),kind=png.toString('ascii',offset+4,offset+8),data=png.subarray(offset+8,offset+8+length);assert(offset+12+length<=png.length);
  if(kind==='IHDR'){width=data.readUInt32BE(0);height=data.readUInt32BE(4);assert.equal(data[8],8);assert.equal(data[9],6);assert.equal(data[12],0);}
  if(kind==='IDAT')chunks.push(data);offset+=12+length;if(kind==='IEND')break;
 }
 assert(width>0&&height>0&&width<=4096&&height<=4096);
 const stride=width*4,packed=inflateSync(Buffer.concat(chunks),{maxOutputLength:(stride+1)*height});assert.equal(packed.length,(stride+1)*height);
 const pixels=new Uint8Array(stride*height),paeth=(a,b,c)=>{const p=a+b-c,aa=Math.abs(p-a),bb=Math.abs(p-b),cc=Math.abs(p-c);return aa<=bb&&aa<=cc?a:bb<=cc?b:c;};
 for(let y=0;y<height;y++){const row=y*stride,source=y*(stride+1),filter=packed[source];assert(filter<=4);
  for(let x=0;x<stride;x++){const a=x>=4?pixels[row+x-4]:0,b=y?pixels[row-stride+x]:0,c=y&&x>=4?pixels[row-stride+x-4]:0;
   const predictor=filter===0?0:filter===1?a:filter===2?b:filter===3?Math.floor((a+b)/2):paeth(a,b,c);pixels[row+x]=(packed[source+1+x]+predictor)&255;
  }
 }
 return{width,height,pixels};
}
export function compareCanvasPNG(before,after,premultiplied=true){
 const b=decodeCanvasPNG(before),a=decodeCanvasPNG(after);assert.equal(a.width,b.width);assert.equal(a.height,b.height);
 let maxDelta=0,overTwo=0,changed=0,total=0;
 for(let i=0;i<a.pixels.length;i+=4){let delta=Math.abs(a.pixels[i+3]-b.pixels[i+3]);for(let c=0;c<3;c++)delta=Math.max(delta,Math.abs(premultiplied?a.pixels[i+c]*a.pixels[i+3]/255-b.pixels[i+c]*b.pixels[i+3]/255:a.pixels[i+c]-b.pixels[i+c]));
  if(delta>0)changed++;if(delta>2)overTwo++;maxDelta=Math.max(maxDelta,delta);total+=delta;
 }
 return{width:a.width,height:a.height,pixels:a.width*a.height,changed,overTwo,maxDelta,meanDelta:total/(a.width*a.height)};
}
