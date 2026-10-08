// Validate the exact embedded browser modules without a GPU or desktop window.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {programSource} from './shader-programs.mjs';

const input=resolve(process.argv[2]||'index.html');
const out=resolve('tools/out/wgsl-validation',process.argv[3]||'current');
fs.mkdirSync(out,{recursive:true});
const html=fs.readFileSync(input,'utf8');
const match=html.match(/window\.__smearComputeShaders=(\{[^\r\n]+\});/);
assert(match,'No embedded compute shaders in '+input);
const shaders=JSON.parse(match[1]);
const paths=['compute','render'].map(name=>{
 const file=resolve(out,name+'.wgsl');
 fs.writeFileSync(file,shaders.common+'\n'+shaders[name]);
 return file;
});
// Validate the exact smaller modules supplied to the browser as well as the
// complete source used by the explicit inspection harnesses.
if(shaders.programs){
 for(const entry of Object.keys(shaders.programs.compute)){
  const file=resolve(out,'compute-'+entry+'.wgsl');
  fs.writeFileSync(file,programSource(shaders.common+'\n'+shaders.compute,shaders.programs.compute,[entry]));paths.push(file);
 }
 const pairs=[['vertex','visibilityFragment'],...['particleVertex','debrisVertex','boardVertex','sawVertex'].map(v=>[v,'solidVisibilityFragment']),
  ...[...html.matchAll(/module:render\('([^']+)','([^']+)'\)/g)].map(m=>[m[1],m[2]])];
 const unique=new Map(pairs.map(p=>[p.join('-'),p]));
 assert.equal(unique.size,13,'Render pipeline list changed; audit the exact validation modules');
 for(const [key,entries]of unique){const file=resolve(out,'render-'+key+'.wgsl');fs.writeFileSync(file,programSource(shaders.common+'\n'+shaders.render,shaders.programs.render,entries));paths.push(file);}
}
const glyph=html.match(/window\.__smearGlyphShader=("(?:[^"\\]|\\.)*");/);if(glyph){const path=resolve(out,'glyph.wgsl');fs.writeFileSync(path,JSON.parse(glyph[1]));paths.push(path);}
const result=spawnSync('cargo',['run','--quiet','--locked','--manifest-path','tools/wgsl-check/Cargo.toml','--target-dir','tools/out/wgsl-check-target','--',...paths],{encoding:'utf8',windowsHide:true,timeout:180000,maxBuffer:4*1024*1024});
const receipt={at:new Date().toISOString(),input,sha256:createHash('sha256').update(html).digest('hex'),validator:'Naga 29.0.4',modules:paths,status:result.status,stdout:result.stdout,stderr:result.stderr,error:result.error?.message,passed:result.status===0&&!result.error};
fs.writeFileSync(resolve(out,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');
if(result.stdout)process.stdout.write(result.stdout);
if(result.stderr)process.stderr.write(result.stderr);
if(result.error)console.error(result.error.message);
if(!receipt.passed)process.exitCode=1;
else console.log('COMPLETE '+paths.length+' embedded WGSL modules passed Naga validation');
