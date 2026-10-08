// Keep original WGSL text and equations; each pipeline receives only its reachable
// functions. Ranges avoid duplicating shared shader code in the offline HTML.
import assert from 'node:assert/strict';
export function shaderPrograms(source){
 const masked=source.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g,s=>s.replace(/[^\n]/g,' '));
 const functions=new Map(),globals=[];
 const pattern=/((?:@[a-z_]+\s*(?:\([^)]*\))?\s*)*)\bfn\s+(\w+)\s*\(/g;
 let last=0,match;
 while((match=pattern.exec(masked))){
  const start=match.index,open=masked.indexOf('{',pattern.lastIndex);let end=open+1,depth=1;
  while(depth&&end<masked.length){const c=masked[end++];if(c==='{')depth++;else if(c==='}')depth--;}
  assert.equal(depth,0,'Unclosed WGSL function '+match[2]);assert(!functions.has(match[2]),'Duplicate WGSL function '+match[2]);
  if(start>last&&masked.slice(last,start).trim())globals.push([last,start]);
  functions.set(match[2],{range:[start,end],body:masked.slice(open,end),entry:/@(compute|vertex|fragment)\b/.test(match[1])});
  last=end;pattern.lastIndex=end;
 }
 if(last<source.length&&masked.slice(last).trim())globals.push([last,source.length]);
 const programs={};
 for(const [name,fn]of functions){if(!fn.entry)continue;const used=new Set();
  const visit=name=>{if(used.has(name))return;used.add(name);for(const m of functions.get(name).body.matchAll(/\b(\w+)\s*\(/g))if(functions.has(m[1]))visit(m[1]);};visit(name);
  programs[name]=[...globals,...[...used].map(n=>functions.get(n).range)].sort((a,b)=>a[0]-b[0]);
 }
 assert(Object.keys(programs).length,'No WGSL entry points');return programs;
}
export function programSource(source,programs,entries){
 const ranges=new Map();for(const name of entries){assert(programs[name],'Missing shader entry '+name);for(const range of programs[name])ranges.set(range[0],range);}
 return [...ranges.values()].sort((a,b)=>a[0]-b[0]).map(([a,b])=>source.slice(a,b)).join('\n');
}
