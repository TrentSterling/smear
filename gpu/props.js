// Shared GPU rigid props. The six original IDs and thirty charts remain stable.
SmearCompute.prototype.buildProps=function(){
 const T=this.THREE,V=T.Vector3,Q=T.Quaternion;
 const wood=new T.MeshStandardMaterial({color:0x957244,roughness:.84}),edge=new T.MeshStandardMaterial({color:0x594730,roughness:.8}),steel=new T.MeshStandardMaterial({color:0x283a3b,roughness:.52,metalness:.65}),red=new T.MeshStandardMaterial({color:0xa04929,roughness:.46,metalness:.45}),yellow=new T.MeshStandardMaterial({color:0xe2bd50,roughness:.5,metalness:.25});
 const boxGeo=new T.BoxGeometry(1,1,1),ringGeo=new T.TorusGeometry(.415,.022,6,32);
 const defs=[['crate',[-6.45,.55,-1.8]],['crate',[6.4,.55,4.2]],['crate',[-6.4,.55,6.4]],['barrel',[5.65,.58,-6.7]],['barrel',[6.75,.58,-5.55]],['barrel',[6.6,.58,5.8]],['crate',[100,.55,100]],['barrel',[103,.58,100]]];
 for(const kind of [1,2]){const geo=kind===1?new T.BoxGeometry(1.08,1.10,1.08):new T.CylinderGeometry(.42,.42,1.16,24);const ghost=new T.Mesh(geo,new T.MeshBasicMaterial({color:0x80efba}));ghost.userData.propGhost=kind;ghost.castShadow=false;this.scene.add(ghost);}
 this.props=[];
 for(const [kind,point]of defs){
  const id=this.props.length,p=new V(...point),isBarrel=kind==='barrel',size=isBarrel?new V(.84,1.16,.84):new V(1.08,1.10,1.08);
  const b=this.propBox(p,size,new Q(),true,isBarrel?red:wood);b.propIndex=id;b.propKind=isBarrel?2:1;b.broken=false;b.mesh.visible=false;
  for(const s of Object.values(b.faces)){s.propIndex=id;s.mesh.visible=false;}
  const tag=mesh=>{mesh.userData.prop={id,box:b.id};mesh.castShadow=true;this.scene.add(mesh);return mesh;};
  const piece=(geometry,material,position,scale,rotation)=>{const m=new T.Mesh(geometry,material);m.position.copy(p).add(new V(...position));if(scale)m.scale.set(...scale);if(rotation)m.rotation.set(...rotation);return tag(m);};
  if(!isBarrel){
   piece(boxGeo,wood,[0,0,0],size.toArray());
   for(const z of [-.557,.557]){
    for(const x of [-.435,.435])piece(boxGeo,edge,[x,0,z],[.135,1.10,.045]);
    for(const y of [-.46,.46])piece(boxGeo,edge,[0,y,z],[1.08,.13,.045]);
    piece(boxGeo,edge,[0,0,z],[.105,1.23,.045],[0,0,z>0?-.72:.72]);
   }
   for(const x of [-.557,.557]){for(const y of [-.46,.46])piece(boxGeo,edge,[x,y,0],[.045,.13,1.08]);}
   for(const x of [-.49,.49])for(const z of [-.49,.49])piece(boxGeo,steel,[x,0,z],[.055,1.115,.055]);
   // Label plates are small physical pieces and receive the same surface paint.
   piece(boxGeo,yellow,[.14,.20,.586],[.32,.15,.014]);
  }else{
   const profile=[[-.58,.35],[-.56,.41],[-.48,.412],[-.45,.405],[-.25,.416],[0,.425],[.25,.416],[.45,.405],[.48,.412],[.56,.41],[.58,.35]].map(([y,r])=>new T.Vector2(r,y));
   piece(new T.LatheGeometry(profile,32),red,[0,0,0]);
   const cap=new T.CylinderGeometry(.35,.35,.018,32);for(const y of [-.572,.572])piece(cap,steel,[0,y,0]);
   for(const y of [-.49,-.27,.27,.49])piece(ringGeo,steel,[0,y,0],null,[Math.PI/2,0,0]);
   piece(new T.CylinderGeometry(.053,.053,.025,12),steel,[.14,.593,.03]);
   const badge=new T.Shape();badge.moveTo(0,.13);badge.lineTo(-.135,-.10);badge.lineTo(.135,-.10);badge.closePath();
   for(const sign of [-1,1]){const m=piece(new T.ShapeGeometry(badge),yellow,[0,.025,.433*sign]);if(sign<0)m.rotation.y=Math.PI;piece(boxGeo,steel,[0,.035,.437*sign],[.021,.09,.01]);piece(boxGeo,steel,[0,-.037,.437*sign],[.023,.022,.01]);}
  }
  this.props.push({id,kind,position:point,size:size.toArray(),box:b,faces:Object.fromEntries(Object.entries(b.faces).map(([name,s])=>[name,s.id]))});
 }
 // Append undersides after the original charts so existing receiver IDs survive.
 for(const prop of this.props){const b=prop.box,s=this.propSurface(b.p.clone().add(new V(0,-b.half.y-.003,0)),new V(1,0,0),new V(0,0,-1),b.half.x*2,b.half.z*2);s.propIndex=prop.id;s.mesh.visible=false;b.faces.yn=s;prop.faces.yn=s.id;}
};
