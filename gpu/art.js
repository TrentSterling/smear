// Original procedural test-lab art. Runs once before the GPU scene is packed.
SmearCompute.prototype.artDirection=function(){
 const T=this.THREE,ink=0x183b44,cream=0xf0dfb5,amber=0xe5a636;
 this.scene.traverse(mesh=>{const map=mesh.material?.map;if(!map?.userData.glyphLabel)return;const text=map.userData.glyphLabel;if(text==='SMEAR'||text==='by Tront'){mesh.visible=false;return;}const g=this.glyphMesh(text,mesh.geometry.parameters.width,mesh.geometry.parameters.height*.70,0xeef0dc);mesh.geometry=g.geometry;mesh.material=g.material;mesh.userData.glyphText=text;});
 const material=(color,roughness=.6)=>{const m=new T.MeshStandardMaterial({color,roughness,metalness:.06});m.color.convertSRGBToLinear();return m;};
 for(const s of this.surfaces){s.mesh.material=s.mesh.material.clone();s.mesh.material.map=null;s.mesh.material.color.setHex(s.grid?0x829c9d:s.w>15?0xe3dbc3:0xb8c9c1).convertSRGBToLinear();s.mesh.material.roughness=s.grid?(s.center.x<0?.29:.49):.39;s.mesh.material.metalness=s.grid?.12:.07;
  if(!s.grid&&s.w<15&&s.n.y>.7){s.mesh.material.roughness=s.center.x<0?.18:.88;s.mesh.material.metalness=s.center.x<0?.72:.03;}
 }
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
  const group=new T.Group();group.position.set(...p);this.scene.add(group);const back=new T.Mesh(new T.PlaneGeometry(width,height),dark);group.add(back);
  const title=this.glyphMesh(text,width*.90,height*.52,0xf3e8cd);title.position.set(0,height*.13,.004);group.add(title);
  const subtitle=this.glyphMesh(sub,width*.89,height*.15,0xa6c4c1,0,0);subtitle.position.set(0,-height*.30,.005);group.add(subtitle);
 };
 sign('SMEAR','MATERIAL RESPONSE LAB / TRONT', [0,2.65,-7.955],4.4,1.1);
 sign('01','IMPACT / TRANSFER',[-5.7,2.5,-7.95],2.05,.5125);
 sign('02','SURFACE / FLOW',[5.7,2.5,-7.95],2.05,.5125);
 // A visible spindle and crossarm explain the moving emitter paths.
 this.lightRig=new T.Group();this.lightRig.position.fromArray(window.__smearLightMotion.pivot);this.scene.add(this.lightRig);
 const moving=mesh=>{mesh.userData.movingLight=true;this.lightRig.attach(mesh);return mesh;};
 add(new T.CylinderGeometry(.065,.065,.64,12),dark,[0,4.66,1.6]);
 moving(add(new T.CylinderGeometry(.17,.17,.18,16),dark,[0,4.32,1.6]));
 moving(add(new T.BoxGeometry(4.94,.10,.12),dark,[0,4.32,1.6]));
 for(const x of [-2.4,2.4])moving(add(new T.CylinderGeometry(.034,.034,.48,10),dark,[x,4.04,1.6]));
 // Actual polygon fixtures, using the exact vertices integrated by LTC.
 for(const light of window.__smearLights.filter(l=>l.build)){
  const points=light.vertices.map(p=>new T.Vector3(...p));
  const center=points.reduce((p,v)=>p.add(v),new T.Vector3()).multiplyScalar(.25);
  const normal=points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0])).normalize();
  for(const backing of [true,false]){
   const positions=points.flatMap(p=>p.clone().sub(center).multiplyScalar(backing?1.065:1).add(center).addScaledVector(normal,backing?-.018:0).toArray());
   const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new T.Float32BufferAttribute([0,0,1,0,1,1,0,1],2));geo.setIndex([0,1,2,0,2,3]);geo.computeVertexNormals();
   // Visible colored diffuser faces use a lower display exposure than the
   // emitted radiance, retaining their hue through the scene tone mapper.
   const level=Math.max(...light.radiance),violet=light.name.includes('violet');const face=new T.MeshBasicMaterial({color:new T.Color(...light.radiance.map(c=>violet?Math.pow(c/level,2.0)*.8:c/level*3))});
   const mesh=add(geo,backing?dark:face,[0,0,0]);mesh.castShadow=false;mesh.name=light.name+(backing?' frame':'');if(!backing)mesh.userData.ltcEmitter=light.name;if(light.moving)moving(mesh);
  }
 }
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
  if(!mesh.isMesh||mesh.userData.movingLight||mesh.userData.surface||boxes.has(mesh)||mesh===this.dropMesh)return;
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

// Both the rendered fixture matrices and LTC polygon coordinates use this same
// rigid transform and simulation clock. Pause and slow motion stay coherent.
SmearCompute.prototype.updateLights=function(time){
 if(this.lightTime===time)return;this.lightTime=time;
 this.lightRig.rotation.y=time*window.__smearLightMotion.speed;this.lightRig.updateMatrixWorld(true);
 for(const lamp of this.movingLights){
  for(let i=0;i<4;i++){lamp.point.copy(lamp.local[i]).applyMatrix4(this.lightRig.matrixWorld);lamp.data.set(lamp.point.toArray(),i*4);}
  this.device.queue.writeBuffer(this.constantBuffer,lamp.offset,lamp.data);
 }
};
