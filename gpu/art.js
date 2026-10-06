// Original procedural test-lab art. Runs once before the GPU scene is packed.
SmearCompute.prototype.artDirection=function(){
 const T=this.THREE,ink=0x183b44,cream=0xf0dfb5,amber=0xe5a636;
 const material=(color,roughness=.6)=>{const m=new T.MeshStandardMaterial({color,roughness,metalness:.06});m.color.convertSRGBToLinear();return m;};
 for(const s of this.surfaces){s.mesh.material=s.mesh.material.clone();s.mesh.material.map=null;s.mesh.material.color.setHex(s.grid?0x829c9d:s.w>15?0xe3dbc3:0xb8c9c1).convertSRGBToLinear();s.mesh.material.roughness=s.grid?.7:.64;}
 for(const b of this.staticBoxes){b.mesh.material=material(b.half.y>2?0xe3dbc3:ink);}
 for(const b of this.sourceBodies){
  const color=b.name==='Torso'||/thigh|upper arm/.test(b.name)?amber:b.name==='Hips'||/foot/.test(b.name)?ink:cream;
  b.mesh.traverse(o=>{if(!o.isMesh||o.material.isMeshBasicMaterial)return;o.material=o.material.clone();o.material.color.setHex(color).convertSRGBToLinear();o.material.roughness=.43;});
 }
 for(const j of this.joints){j.cover.material=material(ink,.45);}
 for(const d of this.sourceDolls)d.spine.material=material(ink);
 const add=(geo,mat,p)=>{const m=new T.Mesh(geo,mat);m.position.set(...p);m.castShadow=true;this.scene.add(m);return m;};
 const dark=material(ink),yellow=material(amber),lamp=new T.MeshBasicMaterial({color:0xa5e8df});
 // Frame the existing light wells and give each side of the room a clear rhythm.
 for(const x of [-7.8,7.8])for(const z of [-6,-2,2,6]){
  add(new T.BoxGeometry(.08,2.4,.11),dark,[x,2.7,z]);
  add(new T.BoxGeometry(.09,.7,.045),lamp,[x,3.2,z+.065]).castShadow=false;
 }
 for(const x of [-7.94,7.94])add(new T.BoxGeometry(.045,.085,15.8),yellow,[x,1.25,0]);
 for(const z of [-7.94,7.94])add(new T.BoxGeometry(15.8,.085,.045),yellow,[0,1.25,z]);
 const sign=(text,sub,p,width,height)=>{
  const c=document.createElement('canvas');c.width=1024;c.height=256;const g=c.getContext('2d');g.fillStyle='#183b44';g.fillRect(0,0,1024,256);g.fillStyle='#edb645';g.fillRect(0,0,14,256);g.font='900 136px Arial';g.fillStyle='#f3e8cd';g.fillText(text,42,154);g.font='bold 26px Arial';g.fillStyle='#a6c4c1';g.fillText(sub,48,217);
  const tex=new T.CanvasTexture(c);const mat=new T.MeshBasicMaterial({map:tex});add(new T.PlaneGeometry(width,height),mat,p).castShadow=false;
 };
 sign('SMEAR','MATERIAL RESPONSE LAB  /  09', [0,2.65,-7.955],4.4,1.1);
 sign('01','IMPACT / TRANSFER',[-5.7,2.5,-7.95],2.05,.5125);
 sign('02','SURFACE / FLOW',[5.7,2.5,-7.95],2.05,.5125);
 this.completePaintReceivers();
};

// Structural undersides need real collision receivers. Thin decorative trim
// shares its supporting surface's pigment and liquid instead of hiding it.
SmearCompute.prototype.completePaintReceivers=function(){
 const T=this.THREE;
 for(const box of this.staticBoxes){
  if(box.faces.yn)continue;
  const n=new T.Vector3(0,-1,0).applyQuaternion(box.q),u=new T.Vector3(1,0,0).applyQuaternion(box.q),v=new T.Vector3(0,0,-1).applyQuaternion(box.q);
  const center=box.p.clone().addScaledVector(n,box.half.y+.003);
  if(center.y<.045)continue;
  const s={id:this.surfaces.length,center,u,v,n,w:box.half.x*2,h:box.half.z*2,grid:false};
  const mesh=new T.Mesh(new T.PlaneGeometry(s.w,s.h),box.mesh.material.clone());
  mesh.position.copy(center);mesh.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(u,v.clone().negate(),n));mesh.userData.surface=s;mesh.castShadow=false;s.mesh=mesh;
  this.scene.add(mesh);this.surfaces.push(s);box.faces.yn=s;
 }
 this.scene.updateMatrixWorld(true);const boxes=new Set(this.staticBoxes.map(b=>b.mesh));this.paintOverlays=[];
 this.scene.traverse(mesh=>{
  if(!mesh.isMesh||mesh.userData.surface||boxes.has(mesh)||mesh===this.dropMesh)return;
  for(let p=mesh;p;p=p.parent)if(p.userData.body||p===this.gun||p===this.spillCan||p===this.grip)return;
  if(!['BoxGeometry','PlaneGeometry'].includes(mesh.geometry?.type))return;
  const point=mesh.getWorldPosition(new T.Vector3());let receiver=null,best=.23;
  for(const s of this.surfaces){
   const delta=point.clone().sub(s.center),distance=delta.dot(s.n);
   if(distance<-.012||distance>best||Math.abs(delta.dot(s.u))>s.w*.5+.01||Math.abs(delta.dot(s.v))>s.h*.5+.01)continue;
   best=distance;receiver=s;
  }
  if(receiver){mesh.userData.paintReceiver=receiver.id;this.paintOverlays.push({mesh,receiver:receiver.id});}
 });
};
