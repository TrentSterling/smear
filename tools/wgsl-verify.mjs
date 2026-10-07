// Validate the exact embedded browser modules without a GPU or desktop window.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';

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
const result=spawnSync('cargo',['run','--quiet','--locked','--manifest-path','tools/wgsl-check/Cargo.toml','--target-dir','tools/out/wgsl-check-target','--',...paths],{encoding:'utf8',windowsHide:true,timeout:180000,maxBuffer:4*1024*1024});
const receipt={at:new Date().toISOString(),input,sha256:createHash('sha256').update(html).digest('hex'),validator:'Naga 29.0.4',modules:['common + compute','common + render'],status:result.status,stdout:result.stdout,stderr:result.stderr,error:result.error?.message,passed:result.status===0&&!result.error};
fs.writeFileSync(resolve(out,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');
if(result.stdout)process.stdout.write(result.stdout);
if(result.stderr)process.stderr.write(result.stderr);
if(result.error)console.error(result.error.message);
if(!receipt.passed)process.exitCode=1;
else console.log('COMPLETE both embedded WGSL modules passed Naga validation');
