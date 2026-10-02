import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';

const before=resolve(process.argv[2]||'tools/out/particles-baseline-final-firefox/summary.json');
const after=resolve(process.argv[3]||'tools/out/particles-candidate-final-firefox/summary.json');
const baseline=JSON.parse(await readFile(before,'utf8')),candidate=JSON.parse(await readFile(after,'utf8'));
function state(value){const s=structuredClone(value);delete s.version;delete s.renderer;for(const k of ['physicsMS','frameMS','paintUploads'])delete s.stats[k];return s;}
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const receipt={before:baseline.sourceSha256,after:candidate.sourceSha256,browser:candidate.browser,checks:[],comparisons:[]};
assert.equal(baseline.reports.length,candidate.reports.length);
for(let i=0;i<baseline.reports.length;i++){
 const b=baseline.reports[i],a=candidate.reports[i],label=a.scenario+(a.hide?' hidden':'');
 assert.equal(b.scenario,a.scenario);assert.equal(b.hide,a.hide);
 for(const [name,actual,expected] of [['simulation and wet transfer',state(a.state),state(b.state)],['droplet motion and lifetime',a.drops,b.drops],['particle transforms',a.matrices,b.matrices],['persistent paint and wet supply',a.paint,b.paint]]){
  assert.deepEqual(actual,expected,label+': '+name);receipt.checks.push(label+': exact '+name);console.log('PASS '+receipt.checks.at(-1));
 }
 receipt.comparisons.push({scenario:a.scenario,hide:a.hide,paintSha256:hash(a.paint),motionSha256:hash(a.drops),before:{work:b.work,intervals:b.intervals,dropsMs:b.updateMs/240,phases:b.telemetry.summary.phases},after:{work:a.work,intervals:a.intervals,dropsMs:a.updateMs/240,phases:a.telemetry.summary.phases}});
}
assert.deepEqual(baseline.errors,[]);assert.deepEqual(candidate.errors,[]);
receipt.result='COMPLETE particle and paint preservation checks passed';
await writeFile(resolve(after,'..','preservation.json'),JSON.stringify(receipt,null,2)+'\n');
console.log(receipt.result+` (${receipt.checks.length} checks)`);
