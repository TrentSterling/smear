// CPU player against immutable room OBBs. Dynamic props retain their bounded
// GPU correction channel; no prop poses are downloaded for movement.
const playerRadius=.23,playerStep=.48,playerSlope=.65;
const playerProbe=new V(),playerCandidate=new V(),playerDown=new V(0,-1,0);
const playerGroundHit={p:new V(),t:0,receiver:null};
const playerFootProbes=[[0,0],[.235,0],[-.235,0],[0,.235],[0,-.235]];
function groundHeight(p,maxStep=playerStep){
 let height=0;
 for(const [x,z] of playerFootProbes){playerProbe.set(p.x+x,p.y+maxStep+.03,p.z+z);for(const b of staticBoxes){
  if(b.propIndex!==undefined||b.broken||b.p.y-b.extent.y>playerProbe.y||Math.abs(playerProbe.x-b.p.x)>b.extent.x+.01||Math.abs(playerProbe.z-b.p.z)>b.extent.z+.01)continue;
  if(rayBox(playerProbe,playerDown,Math.max(1,playerProbe.y+.05),b,playerGroundHit)&&playerGroundHit.receiver.n.y>=playerSlope&&playerGroundHit.p.y<=p.y+maxStep+.025)height=Math.max(height,playerGroundHit.p.y);
 }}
 return height;
}
function playerSamples(eye){return Math.max(2,Math.ceil((eye+.12-playerRadius*2)/.20)+1);}
function playerClearance(p,eye){
 const count=playerSamples(eye),top=Math.max(playerRadius,eye+.12-playerRadius);
 for(const b of staticBoxes){
  if(b.propIndex!==undefined||b.broken||Math.abs(p.x-b.p.x)>b.extent.x+playerRadius||Math.abs(p.z-b.p.z)>b.extent.z+playerRadius)continue;
  for(let i=0;i<count;i++){
   playerProbe.set(p.x,p.y+mix(playerRadius,top,i/(count-1)),p.z);
   if(sphereBox(playerProbe,playerRadius,b,hitTemp)&&hitTemp.depth>.006&&!(i===0&&hitTemp.n.y>=playerSlope&&hitTemp.depth<.045))return false;
  }
 }
 return true;
}
function collidePlayer(p){
 const count=playerSamples(player.eye),top=Math.max(playerRadius,player.eye+.12-playerRadius);
 for(let pass=0;pass<3;pass++)for(const b of staticBoxes){
  if(b.propIndex!==undefined||b.broken||Math.abs(p.x-b.p.x)>b.extent.x+playerRadius||Math.abs(p.z-b.p.z)>b.extent.z+playerRadius)continue;
  for(let i=0;i<count;i++){
   playerProbe.set(p.x,p.y+mix(playerRadius,top,i/(count-1)),p.z);
   if(!sphereBox(playerProbe,playerRadius,b,hitTemp)||hitTemp.depth<=0)continue;
   if(i===0&&hitTemp.n.y>=playerSlope){p.y+=Math.min(hitTemp.depth/hitTemp.n.y,.25);if(player.vel.y<=0){player.vel.y=0;player.grounded=true;}}
   else{p.addScaledVector(hitTemp.n,Math.min(hitTemp.depth,.25));const into=player.vel.dot(hitTemp.n);if(into<0)player.vel.addScaledVector(hitTemp.n,-into);}
  }
 }
 p.x=clamp(p.x,-7.74,7.74);p.z=clamp(p.z,-7.74,7.74);
}
function moveCamera(dt){
 if(panel||demo||paused)return;dt=Math.min(dt,.05);
 const f=new V(-Math.sin(yaw),0,-Math.cos(yaw)),r=new V(Math.cos(yaw),0,-Math.sin(yaw)),wish=new V();
 if(keys.has('KeyW')||keys.has('ArrowUp'))wish.add(f);if(keys.has('KeyS')||keys.has('ArrowDown'))wish.sub(f);if(keys.has('KeyD')||keys.has('ArrowRight'))wish.add(r);if(keys.has('KeyA')||keys.has('ArrowLeft'))wish.sub(r);
 const crouch=!player.fly&&(keys.has('ControlLeft')||keys.has('ControlRight')),run=keys.has('ShiftLeft')||keys.has('ShiftRight');
 const speed=player.fly?(run?7:3.5):crouch?1.45:run?5:3.1;
 if(player.fly){if(keys.has('Space'))wish.y++;if(keys.has('ControlLeft'))wish.y--;}
 if(wish.lengthSq()>0)wish.normalize();wish.multiplyScalar(speed);
 const response=1-Math.exp(-dt*(wish.lengthSq()?17:26));player.vel.x=mix(player.vel.x,wish.x,response);player.vel.z=mix(player.vel.z,wish.z,response);
 const nextEye=mix(player.eye,crouch?1.04:1.68,1-Math.exp(-dt*15));
 if(player.fly||nextEye<=player.eye||playerClearance(player.feet,nextEye))player.eye=nextEye;
 if(player.fly){player.vel.y=mix(player.vel.y,wish.y,response);player.feet.addScaledVector(player.vel,dt);player.feet.y=clamp(player.feet.y,-1.3,2.8);player.feet.x=clamp(player.feet.x,-7.7,7.7);player.feet.z=clamp(player.feet.z,-7.7,7.7);}
 else{
  if(player.jump&&player.grounded&&!crouch){player.vel.y=4.5;player.grounded=false;}player.jump=false;player.vel.y-=11.8*dt;
  const steps=Math.max(3,Math.ceil(player.vel.length()*dt/.075));
  for(let i=0;i<steps;i++){
   const grounded=player.grounded,oldY=player.feet.y;player.feet.addScaledVector(player.vel,dt/steps);
   if(grounded&&player.vel.y<=0){const ground=groundHeight(player.feet,playerStep);playerCandidate.copy(player.feet);playerCandidate.y=ground;
    if(ground>=oldY-.08&&ground<=oldY+playerStep&&playerClearance(playerCandidate,player.eye)){player.feet.y=ground;player.vel.y=0;}
   }
   collidePlayer(player.feet);const ground=groundHeight(player.feet,.025);
   if(player.feet.y<=ground+.003&&player.vel.y<=0){player.feet.y=ground;player.vel.y=0;player.grounded=true;}else if(player.feet.y>ground+.045)player.grounded=false;
  }
 }
 player.speed=Math.hypot(player.vel.x,player.vel.z);player.bob+=player.speed*dt*1.7;
 camera.position.copy(player.feet).add(new V(0,player.eye,0));recoilPitch*=Math.exp(-dt*13);camera.rotation.set(clamp(pitch+recoilPitch,-1.48,1.47),yaw,0,'YXZ');
 aimBlend=mix(aimBlend,(aimDown&&tool===1)?1:0,1-Math.exp(-dt*16));const fov=tune.fov-aimBlend*12;if(Math.abs(camera.fov-fov)>.025){camera.fov=fov;camera.updateProjectionMatrix();}
}
