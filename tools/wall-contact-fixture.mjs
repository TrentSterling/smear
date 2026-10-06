// Gameplay inputs only: reset, grab and target. No pose/coating/film uploads.
export function wallContactTarget(t,mode='drag') {
 if(mode==='block'){if(t<.5)return [-.12,.13+.77*t/.5,.13];if(t<2){const u=(t-.5)/1.5;return [-.12+.22*u,.9,.13-4.43*u];}return [.1+Math.sin((t-2)*1.25)*.5,.9,-4.3];}
 if(t<.5)return [-.12, .13+1.87*t/.5,.13];
 if(t<2){const u=(t-.5)/1.5;return [-.12-3.38*u,2,.13-8.28*u];}
 const slide=mode==='press'?0:Math.sin((t-2)*1.25)*.65;
 return [-3.5+slide,2,-8.15];
}
export async function installWallContactFixture(page){
 await page.eval(`window.__contactTarget=${wallContactTarget.toString()};
 window.__contactPlay={
 async setup(mode='drag'){
  __smear.manual(true);__smear.reset();await __smear.step(0);
  __smear.tune({walking:false,recover:false,damage:1,bleeding:1.35});
  if(mode==='dry'){__smear.heal();await __smear.step(0);__smear.clean();// Explicit dry-control override; the public Tune sliders clamp above zero.
   Object.assign(__smearGPU.input().tune,{damage:0,bleeding:0});}
  await __smear.grab(0,'Torso');__smear.view([-1.0,2.7,-3.6],[-3.5,1.8,-8]);__smear.fly();
  if(mode==='block')__smear.view([2.8,2.1,-.8],[.1,.8,-4.2]);
  this.receiver=mode==='block'?__smearGPU.staticBoxes[5].faces.zp.id:16;this.mode=mode;this.tick=0;
 },
 async advance(n){const g=__smearGPU;for(let i=0;i<n;i+=2){__smear.target(__contactTarget(this.tick/120,this.mode));g.submit(Math.min(2,n-i));this.tick+=Math.min(2,n-i);}await g.device.queue.onSubmittedWorkDone();},
 start(){this.startTick=__smearGPU.steps;this.timer=setInterval(()=>__smear.target(__contactTarget((__smearGPU.steps-this.startTick)/120,this.mode)),8);__smear.manual(false);},
 stop(){clearInterval(this.timer);__smear.manual(true);}
 };`);
}
