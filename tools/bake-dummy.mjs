// Validate original SDF output at build time and embed worker authoring source.
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
export async function bakeDummy(){
 const original=await readFile('versions/smear_v8.9_cpu.html','utf8');
 const library=[...original.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('REVISION')&&s.includes('BufferGeometry'));
 if(!library)throw Error('Embedded Three.js library missing');const sandbox={console};vm.createContext(sandbox);vm.runInContext(library,sandbox);const T=sandbox.THREE;
 const model=await readFile('gpu/dummy.js','utf8'),rig=JSON.parse(await readFile('assets/dummy-rig.json','utf8'));
 const start=model.indexOf(' const specifications='),end=model.indexOf(' return {vertices,normals,uvs,bones,weights,indices,outlines,outlineNormals,stats};');
 const body=model.slice(start,end)+'\nreturn {vertices,normals,uvs,bones,weights,indices,outlines,outlineNormals,stats};';
 const data=new Function('T','parts','V',body)(T,rig.map(b=>({restP:new T.Vector3(...b.p),restQ:new T.Quaternion(...b.q)})),T.Vector3);
 const arrays={},chunks=[];let offset=0;for(const key of ['vertices','normals','uvs','bones','weights','indices','outlines','outlineNormals']){const a=key==='indices'?new Uint32Array(data[key]):new Float32Array(data[key]);arrays[key]={offset,length:a.length};chunks.push(Buffer.from(a.buffer));offset+=a.byteLength;}
 const raw=Buffer.concat(chunks);
 const worker=library+'\nfunction meshAsset(rig){const T=THREE,V=T.Vector3,parts=rig.map(b=>({restP:new V(...b.p),restQ:new T.Quaternion(...b.q)}));\n'+body+'\n}';
 return {sourceHash:createHash('sha256').update(body+JSON.stringify(rig)).digest('hex'),rig,arrays,stats:data.stats,bytes:raw.length,worker};
}
