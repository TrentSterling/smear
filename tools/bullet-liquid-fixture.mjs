import {installUtilityFixture} from './utility-fixture.mjs';
export async function installBulletLiquidFixture(page){
 await installUtilityFixture(page);
 await page.eval(`(()=>{const g=__smearGPU,d=g.device,read=__destructionFixture.read.bind(__destructionFixture);window.__bulletTest={
 async setup({point=[-3,0,5],radius=.65,mass=.65,dry=0,full=false,prop=false}={}){
  await __utilityTest.reset();if(prop)await __utilityTest.pose(0,[point[0],.55,point[2]]);this.point=point;this.ids=[];
  for(let id=0;id<g.surfaces.length;id++){const s=g.surfaces[id],r=g.records[id],p=new g.THREE.Vector3(...point);if(Math.abs(p.clone().sub(s.center).dot(s.n))>.01)continue;this.ids.push(id);
   for(const [bank,value]of [[0,mass],[1,mass],[2,dry]]){const a=new Uint32Array(r.filmWidth*r.filmHeight);for(let y=0;y<r.filmHeight;y++)for(let x=0;x<r.filmWidth;x++){const q=s.center.clone().addScaledVector(s.u,((x+.5)/r.filmWidth-.5)*s.w).addScaledVector(s.v,((y+.5)/r.filmHeight-.5)*s.h);if(q.distanceTo(p)<radius)a[x+y*r.filmWidth]=Math.round(value*65536);}d.queue.writeBuffer(g.wetBuffer,(g.surfaces.length*3136+bank*g.filmCells+r.filmOffset)*4,a);}
   const a=new Uint32Array(r.width*r.height);for(let y=0;y<r.height;y++)for(let x=0;x<r.width;x++){const q=s.center.clone().addScaledVector(s.u,((x+.5)/r.width-.5)*s.w).addScaledVector(s.v,((y+.5)/r.height-.5)*s.h);if(q.distanceTo(p)<radius)a[x+y*r.width]=0xaa070747;}d.queue.writeBuffer(g.paintBuffer,r.pixelOffset*4,a);
  }
  if(full){d.queue.writeBuffer(g.workBuffer,64*4,new Uint32Array(900).fill(1));d.queue.writeBuffer(g.workBuffer,9*4,new Uint32Array([900]));d.queue.writeBuffer(g.particleBuffer,0,new Float32Array(900*16));}
 },
 async field(){const a=new Uint32Array(await read(g.wetBuffer,g.surfaces.length*3136*4,g.filmCells*4));let center=0,moment=0,mass=0,cx=0,cz=0;for(const id of this.ids){const s=g.surfaces[id],r=g.records[id],area=s.w*s.h/(r.filmWidth*r.filmHeight);for(let y=0;y<r.filmHeight;y++)for(let x=0;x<r.filmWidth;x++){const m=a[r.filmOffset+x+y*r.filmWidth]/65536*area;if(!m)continue;const p=s.center.clone().addScaledVector(s.u,((x+.5)/r.filmWidth-.5)*s.w).addScaledVector(s.v,((y+.5)/r.filmHeight-.5)*s.h),dist=p.distanceTo(new g.THREE.Vector3(...this.point));mass+=m;moment+=m*dist*dist;cx+=m*p.x;cz+=m*p.z;if(dist<.12)center+=m;}}return{center,moment,mass,x:cx/mass,z:cz/mass,liquid:await __destructionFixture.liquid()};},
 async fire(tool=1,eye=[-3,1.68,6.8],aim=this.point){__smear.view(eye,aim);__smear.pointer(800,500);__smear.tool(tool);g[tool===12?'shotgun':'shoot']();g.submit(0);await d.queue.onSubmittedWorkDone();}
 };})()`);
}
