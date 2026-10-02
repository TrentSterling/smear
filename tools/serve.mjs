import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const gameRoot=fileURLToPath(new URL('../',import.meta.url));
const portfolioRoot=process.argv[2]?resolve(process.argv[2]):null;
const port=Number(process.env.SMEAR_PORT||8198);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.json':'application/json','.xml':'application/xml'};
http.createServer(async(req,res)=>{
  try{
    let path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const root=portfolioRoot&&!path.startsWith('/smear/')&&path!=='/smear'?portfolioRoot:gameRoot;
    if(root===gameRoot&&path.startsWith('/smear'))path=path.slice('/smear'.length)||'/';
    let file=resolve(root,'.'+path);
    if(file!==resolve(root)&&!file.startsWith(resolve(root)+sep)){res.writeHead(403);res.end();return;}
    if((await stat(file)).isDirectory())file=resolve(file,'index.html');
    const body=await readFile(file);
    res.writeHead(200,{'content-type':types[extname(file)]||'application/octet-stream','cache-control':'no-store'});res.end(body);
  }catch{res.writeHead(404);res.end('Not found');}
}).listen(port,'127.0.0.1',()=>console.log(`SMEAR preview http://127.0.0.1:${port}${portfolioRoot?'/smear/':'/'}${portfolioRoot?' with portfolio /games/':''}`));
