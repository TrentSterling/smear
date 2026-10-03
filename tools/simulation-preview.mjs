// Generate the experimental offline entry point without changing index.html.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createSimulationRuntime} from './simulation-runtime.mjs';
const out=resolve('tools/out/simulation-preview');await mkdir(out,{recursive:true});
const file=resolve(out,'index.html');
await writeFile(file,createSimulationRuntime(await readFile('index.html','utf8'),{pool:true}),'utf8');
console.log('Experimental threaded preview: '+file);
console.log('Open this generated HTML locally. The published entry point is unchanged.');
