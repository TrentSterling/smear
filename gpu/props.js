// Shared GPU rigid props. The six original IDs and thirty charts remain stable.
SmearCompute.prototype.buildProps=function(){
 const T=this.THREE,V=T.Vector3,Q=T.Quaternion;
 const wood=new T.MeshStandardMaterial({color:0x957244,roughness:.84}),edge=new T.MeshStandardMaterial({color:0x594730,roughness:.8}),steel=new T.MeshStandardMaterial({color:0x283a3b,roughness:.52,metalness:.65}),red=new T.MeshStandardMaterial({color:0xa04929,roughness:.46,metalness:.45}),yellow=new T.MeshStandardMaterial({color:0xe2bd50,roughness:.5,metalness:.25});
 const blood=new T.MeshStandardMaterial({color:0x780d19,roughness:.13,metalness:.02});blood.color.convertSRGBToLinear();
 const enamel=new T.MeshStandardMaterial({color:0x385659,roughness:.72,metalness:.18}),chrome=new T.MeshStandardMaterial({color:0x9faead,roughness:.19,metalness:.92}),black=new T.MeshStandardMaterial({color:0x172629,roughness:.75}),safety=new T.MeshStandardMaterial({color:0xd3a735,roughness:.65}),switchRed=new T.MeshStandardMaterial({color:0xb33223,roughness:.40});for(const m of [enamel,chrome,black,safety,switchRed])m.color.convertSRGBToLinear();
 const boxGeo=new T.BoxGeometry(1,1,1),ringGeo=new T.TorusGeometry(.415,.022,6,32);
 const names=['','crate','barrel','bucket','fan','conveyor','glass','ceramic','can','crusher','platen','post','launcher','spinner'];
 const glass=new T.MeshStandardMaterial({color:0x76c8bf,roughness:.10,metalness:.38}),ceramic=new T.MeshStandardMaterial({color:0xdacdb4,roughness:.23}),tin=new T.MeshStandardMaterial({color:0x9eaaa5,roughness:.28,metalness:.88});
 const defs=[['crate',[-6.45,.55,-1.8]],['crate',[6.4,.55,4.2]],['crate',[-6.4,.55,6.4]],['barrel',[5.65,.58,-6.7]],['barrel',[6.75,.58,-5.55]],['barrel',[6.6,.58,5.8]],['crate',[100,.55,100]],['barrel',[103,.58,100]],['bucket',[106,.33,100]],['bucket',[109,.33,100]],['fan',[112,.55,100]],['conveyor',[115,.20,100]],...['glass','glass','ceramic','ceramic','can','can','crusher','platen','post','post','launcher','spinner'].map((kind,i)=>[kind,[118+i*3,.5,100]])];
 const sizes={crate:[1.08,1.10,1.08],barrel:[.84,1.16,.84],bucket:[.60,.66,.60],fan:[.8,1.1,.6],conveyor:[2.2,.4,1.4],glass:[1.02,.86,.10],ceramic:[.54,.72,.54],can:[.46,.66,.46],crusher:[2.10,.30,1.55],platen:[1.60,.22,1.34],post:[.18,2.20,1.55],launcher:[1.35,.32,1.10],spinner:[2.40,.32,.36]};
 for(const name of ['crate','barrel','bucket','fan','conveyor','glass','ceramic','can','crusher','launcher','spinner']){const kind=names.indexOf(name);const geo=new T.BoxGeometry(...(name==='crusher'?[2.10,2.50,1.55]:sizes[name]));const ghost=new T.Mesh(geo,new T.MeshBasicMaterial({color:0x80efba}));if(name==='crusher')ghost.position.y=1.10;ghost.userData.propGhost=kind;ghost.castShadow=false;this.scene.add(ghost);}
 this.props=[];
 const underside=prop=>{const b=prop.box,s=this.propSurface(b.p.clone().add(new V(0,-b.half.y-.003,0)),new V(1,0,0),new V(0,0,-1),b.half.x*2,b.half.z*2);s.propIndex=prop.id;s.mesh.visible=false;b.faces.yn=s;prop.faces.yn=s.id;};
 for(const [kind,point]of defs){
  const id=this.props.length,p=new V(...point),isBarrel=kind==='barrel',size=new V(...sizes[kind]);
  const b=this.propBox(p,size,new Q(),true,isBarrel?red:wood);b.propIndex=id;b.propKind=names.indexOf(kind);b.broken=false;b.mesh.visible=false;
  for(const s of Object.values(b.faces)){s.propIndex=id;s.mesh.visible=false;}
  const tag=mesh=>{mesh.userData.prop={id,box:b.id};mesh.castShadow=true;this.scene.add(mesh);return mesh;};
  const piece=(geometry,material,position,scale,rotation)=>{const m=new T.Mesh(geometry,material);m.position.copy(p).add(new V(...position));if(scale)m.scale.set(...scale);if(rotation)m.rotation.set(...rotation);return tag(m);};
  if(kind==='glass'){
   piece(boxGeo,glass,[0,0,0],[.98,.82,.09]);for(const x of [-.50,.50])piece(boxGeo,steel,[x,0,0],[.025,.86,.10]);for(const y of [-.42,.42])piece(boxGeo,steel,[0,y,0],[1.02,.025,.10]);piece(boxGeo,yellow,[.30,-.28,.056],[.16,.035,.009]);
  }else if(kind==='ceramic'){
   piece(new T.LatheGeometry([new T.Vector2(.17,-.36),new T.Vector2(.25,-.30),new T.Vector2(.27,.08),new T.Vector2(.21,.22),new T.Vector2(.115,.27),new T.Vector2(.115,.36)],24),ceramic,[0,0,0]);piece(new T.TorusGeometry(.116,.025,6,24),steel,[0,.35,0],null,[Math.PI/2,0,0]);piece(new T.TorusGeometry(.12,.035,6,16,Math.PI),ceramic,[.22,.15,0]);
  }else if(kind==='can'){
   piece(new T.CylinderGeometry(.23,.23,.64,24),tin,[0,0,0]);for(const y of [-.32,.32])piece(new T.TorusGeometry(.22,.018,5,24),steel,[0,y,0],null,[Math.PI/2,0,0]);piece(boxGeo,red,[0,0,.229],[.27,.29,.012]);piece(boxGeo,yellow,[0,.05,.242],[.18,.04,.009]);
  }else if(kind==='crusher'){
   piece(boxGeo,enamel,[0,0,0],size.toArray());piece(boxGeo,chrome,[0,.155,0],[1.70,.026,1.32]);
   piece(boxGeo,enamel,[0,2.24,0],[2.10,.24,1.55]);piece(boxGeo,black,[0,2.24,.787],[1.66,.15,.026]);
   for(const x of [-.82,.82])for(const z of [-.59,.59])piece(boxGeo,black,[x,-.11,z],[.34,.10,.38]);
   for(const x of [-.52,.52]){piece(new T.CylinderGeometry(.12,.12,.24,20),enamel,[x,2.15,0]);piece(new T.CylinderGeometry(.14,.14,.04,20),chrome,[x,2.04,0]);piece(boxGeo,enamel,[x,2.02,0],[.30,.055,.30]);}
   for(const x of [-.93,.93])for(const y of [0,2.24]){piece(new T.CylinderGeometry(.033,.033,.035,6),chrome,[x,y,.793],null,[Math.PI/2,0,0]);}
   // A restrained hazard lip and inset name plate keep the working gap readable.
   piece(boxGeo,safety,[0,.06,.785],[1.72,.095,.022]);for(const x of [-.7,-.35,0,.35,.7])piece(boxGeo,black,[x,.06,.80],[.045,.085,.012],[0,0,-.5]);
   for(let i=0;i<3;i++)piece(boxGeo,safety,[-.20+i*.20,2.24,.805],[.11,.032,.009]);
  }else if(kind==='platen'){
   piece(boxGeo,enamel,[0,0,0],size.toArray());piece(boxGeo,chrome,[0,-.099,0],[1.58,.025,1.32]);
   piece(boxGeo,safety,[0,0,.682],[1.60,.155,.025]);for(const x of [-.6,-.3,0,.3,.6])piece(boxGeo,black,[x,0,.699],[.055,.15,.009],[0,0,-.45]);
   for(const x of [-.52,.52]){piece(new T.CylinderGeometry(.115,.115,.055,16),enamel,[x,.13,0]);const rod=piece(new T.CylinderGeometry(.058,.058,1,20),chrome,[x,.61,0]);rod.userData.hydraulicRod=true;}
   for(const x of [-.77,.77])piece(boxGeo,black,[x,.03,0],[.06,.30,.34]);
  }else if(kind==='post'){
   piece(boxGeo,enamel,[0,0,0],[.10,2.20,1.55]);for(const z of [-.70,.70]){piece(boxGeo,enamel,[0,0,z],[.18,2.20,.15]);piece(boxGeo,chrome,[0,0,z+.085],[.085,1.99,.013]);}
  }else if(kind==='launcher'){
   piece(boxGeo,steel,[0,0,0],size.toArray());piece(boxGeo,red,[0,.125,0],[1.22,.07,.97]);for(const x of [-.44,.44])for(const z of [-.32,.32]){for(let y=-.1;y<.15;y+=.07)piece(new T.TorusGeometry(.09,.018,5,12),tin,[x,y,z],null,[Math.PI/2,0,0]);}piece(boxGeo,yellow,[0,.165,0],[.12,.01,.65]);for(const x of [-1,1])piece(boxGeo,yellow,[x*.10,.168,.22],[.24,.012,.035],[0,x*.8,0]);
  }else if(kind==='spinner'){
   piece(boxGeo,steel,[0,0,0],size.toArray());piece(new T.CylinderGeometry(.20,.20,.28,20),red,[0,0,0]);for(const x of [-1,1]){piece(boxGeo,yellow,[x*1.02,0,0],[.25,.22,.38]);piece(boxGeo,edge,[x*.65,.105,0],[.035,.012,.37]);}
  }else if(kind==='bucket'){
   piece(new T.CylinderGeometry(.30,.25,.62,24,1,true),steel,[0,0,0]);piece(new T.CylinderGeometry(.26,.26,.025,24),steel,[0,-.30,0]);piece(new T.TorusGeometry(.30,.025,6,24),yellow,[0,.31,0],null,[Math.PI/2,0,0]);piece(new T.TorusGeometry(.31,.018,6,20,Math.PI),steel,[0,.15,0]);
   const fill=piece(new T.CylinderGeometry(.27,.27,.014,24),blood,[0,.23,0]);fill.userData.bucketFill=id;
  }else if(kind==='fan'){
   piece(boxGeo,steel,[0,-.43,0],[.72,.20,.55]);piece(boxGeo,yellow,[0,-.12,0],[.12,.6,.18]);piece(new T.TorusGeometry(.35,.055,8,28),steel,[0,.14,.10]);piece(new T.CylinderGeometry(.08,.08,.25,12),yellow,[0,.14,.1],null,[Math.PI/2,0,0]);
   for(let n=0;n<4;n++){const a=n*Math.PI/2;piece(boxGeo,steel,[0,.14,.18],[.70,.018,.035],[0,0,a]);const blade=piece(boxGeo,yellow,[Math.cos(a)*.17,.14+Math.sin(a)*.17,.09],[.29,.11,.045],[0,0,a+.35]);blade.userData.fanBlade=id;}
  }else if(kind==='conveyor'){
   piece(boxGeo,steel,[0,0,0],size.toArray());piece(boxGeo,edge,[0,.21,0],[2.06,.04,1.24]);for(const x of [-.98,.98])piece(new T.CylinderGeometry(.14,.14,1.32,18),yellow,[x,.1,0],null,[Math.PI/2,0,0]);for(let n=0;n<12;n++){const slat=piece(boxGeo,steel,[-.94+n*.17,.24,0],[.06,.02,1.22]);slat.userData.beltSlat=id;}for(const x of [-.7,0,.7])for(const z of [-1,1])piece(boxGeo,yellow,[x,.245,z*.047],[.17,.018,.022],[0,z*.55,0]);for(const z of [-.67,.67])piece(boxGeo,yellow,[0,.22,z],[2.2,.09,.05]);
  }else if(!isBarrel){
   piece(boxGeo,wood,[0,0,0],size.toArray());
   // Butt the rails together and mount the diagonal on their outer face.
   // Overlapping boards at the same depth flicker as the camera moves.
   for(const z of [-.557,.557]){
    for(const x of [-.435,.435])piece(boxGeo,edge,[x,0,z],[.135,.79,.045]);
    for(const y of [-.46,.46])piece(boxGeo,edge,[0,y,z],[1.159,.13,.045]);
    piece(boxGeo,edge,[0,0,z+Math.sign(z)*.045],[.105,1.23,.045],[0,0,z>0?-.72:.72]);
   }
   for(const x of [-.557,.557]){for(const y of [-.46,.46])piece(boxGeo,edge,[x,y,0],[.045,.13,1.069]);}
   for(const x of [-.49,.49])for(const z of [-.49,.49])piece(boxGeo,steel,[x,0,z],[.055,1.115,.055]);
   // Label plates are small physical pieces and receive the same surface paint.
   piece(boxGeo,yellow,[.14,.20,.632],[.32,.15,.014]);
  }else{
   const profile=[[-.58,.35],[-.56,.41],[-.48,.412],[-.45,.405],[-.25,.416],[0,.425],[.25,.416],[.45,.405],[.48,.412],[.56,.41],[.58,.35]].map(([y,r])=>new T.Vector2(r,y));
   piece(new T.LatheGeometry(profile,32),red,[0,0,0]);
   const cap=new T.CylinderGeometry(.35,.35,.018,32);for(const y of [-.572,.572])piece(cap,steel,[0,y,0]);
   for(const y of [-.49,-.27,.27,.49])piece(ringGeo,steel,[0,y,0],null,[Math.PI/2,0,0]);
   piece(new T.CylinderGeometry(.053,.053,.025,12),steel,[.14,.593,.03]);
   const badge=new T.Shape();badge.moveTo(0,.13);badge.lineTo(-.135,-.10);badge.lineTo(.135,-.10);badge.closePath();
   for(const sign of [-1,1]){const m=piece(new T.ShapeGeometry(badge),yellow,[0,.025,.433*sign]);if(sign<0)m.rotation.y=Math.PI;piece(boxGeo,steel,[0,.035,.437*sign],[.021,.09,.01]);piece(boxGeo,steel,[0,-.037,.437*sign],[.023,.022,.01]);}
  }
  if(['crusher','fan','conveyor','launcher','spinner'].includes(kind)){
   const at=({crusher:[.96,.85,.89],fan:[.30,-.12,.35],conveyor:[.95,.42,.74],launcher:[.57,.40,.59],spinner:[0,.62,0]})[kind];
   const fixed=(g,m,off,scale,rot,role=16)=>{const mesh=piece(g,m,at.map((v,i)=>v+off[i]),scale,rot);mesh.userData.machineControl=role;return mesh;};
   fixed(boxGeo,enamel,[0,-.12,-.065],[.24,.40,.12]);fixed(boxGeo,safety,[0,0,0],[.23,.30,.045]);
   fixed(new T.CylinderGeometry(.062,.062,.025,24),black,[0,0,.031],null,[Math.PI/2,0,0]);
   fixed(new T.CylinderGeometry(.045,.052,.04,24),switchRed,[0,0,.056],null,[Math.PI/2,0,0],17);
   fixed(new T.CylinderGeometry(.023,.023,.012,16),black,[0,.105,.032],null,[Math.PI/2,0,0],18);
   if(kind==='spinner'||kind==='launcher'||kind==='conveyor')fixed(boxGeo,enamel,[0,-at[1]*.5,-.065],[.07,at[1],.07]);
   // Physical white power mark remains readable when the machine gets painted.
   fixed(boxGeo,chrome,[0,-.098,.028],[.045,.012,.009]);
  }
  this.props.push({id,kind,position:point,size:size.toArray(),box:b,faces:Object.fromEntries(Object.entries(b.faces).map(([name,s])=>[name,s.id]))});
  if(id===7)for(const prop of this.props)underside(prop);
  if(id===11)for(const prop of this.props.filter(p=>p.id>=8))underside(prop);
 }
 // Append undersides after the original charts so existing receiver IDs survive.
 for(const prop of this.props.filter(p=>p.id>=12))underside(prop);
};
