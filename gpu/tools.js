// Original, procedural lab tools. Geometry is packed once; only their transforms move.
SmearCompute.prototype.buildTools=function(){
 const T=this.THREE,V=T.Vector3;
 const mat=(color,roughness=.55,metalness=.08)=>{const m=new T.MeshStandardMaterial({color,roughness,metalness});m.color.convertSRGBToLinear();return m;};
 const ink=mat(0x253a3e,.5),steel=mat(0x778887,.3,.72),ceramic=mat(0xd9d2b7,.43),amber=mat(0xd09a32,.5),rubber=mat(0x18292c,.85),glove=mat(0x8c7060,.83),seam=mat(0x54463e,.8);
 const add=(parent,geometry,material,p=[0,0,0])=>{const m=new T.Mesh(geometry,material);m.position.set(...p);m.castShadow=false;parent.add(m);return m;};
 const shapes=new Map();
 const box=(parent,size,p,material,r=.004)=>{
  const key=size.join(',')+':'+r;let geo=shapes.get(key);
  if(!geo){const [w,h,d]=size,x=w/2-r,y=h/2-r,s=new T.Shape();s.moveTo(-x,-y);s.lineTo(x,-y);s.lineTo(x,y);s.lineTo(-x,y);s.closePath();geo=new T.ExtrudeGeometry(s,{depth:Math.max(.0001,d-r*2),bevelEnabled:true,bevelThickness:r,bevelSize:r,bevelSegments:r>.008?3:1,steps:1});geo.translate(0,0,-(d-r*2)/2);shapes.set(key,geo);}
  return add(parent,geo,material,p);
 };
 const cylinder=(parent,radius,length,p,material)=>{const m=add(parent,new T.CylinderGeometry(radius,radius,length,20),material,p);m.rotation.x=Math.PI/2;return m;};
 const segment=(parent,a,b,r,material)=>{const from=new V(...a),to=new V(...b),delta=to.clone().sub(from),m=add(parent,new T.CapsuleGeometry(r,Math.max(.001,delta.length()-2*r),4,10),material,from.add(to).multiplyScalar(.5).toArray());m.quaternion.setFromUnitVectors(new V(0,1,0),delta.normalize());return m;};
 const label=(parent,text,p,size,rotation,radius=0)=>{const c=document.createElement('canvas');c.width=512;c.height=256;const ctx=c.getContext('2d');ctx.fillStyle='#d9d2b7';ctx.fillRect(0,0,512,256);ctx.fillStyle='#253a3e';ctx.font='900 92px Arial';ctx.textAlign='center';ctx.fillText(text,256,119);ctx.font='bold 35px Arial';ctx.fillText('MATERIAL RESPONSE LAB',256,190);const m=add(parent,radius?new T.CylinderGeometry(radius,radius,size[1],24,1,true,-size[0]/radius/2,size[0]/radius):new T.PlaneGeometry(...size),new T.MeshStandardMaterial({map:new T.CanvasTexture(c),roughness:.65}),p);m.rotation.set(...rotation);return m;};
 const makeHand=(parent)=>{
  const root=new T.Group();parent.add(root);
  const palm=box(root,[.063,.091,.047],[.023,-.103,.094],glove,.014);palm.rotation.z=-.18;
  const pad=box(root,[.045,.046,.005],[.022,-.091,.120],seam,.002);pad.rotation.z=-.18;
  for(let i=0;i<3;i++)segment(root,[.004,-.091+i*.011,.125],[.036,-.097+i*.011,.125],.0014,glove);
  segment(root,[.030,-.13,.104],[.043,-.195,.153],.030,glove);
  const sleeve=add(root,new T.CylinderGeometry(.030,.048,.23,18),ink,[.060,-.268,.210]);sleeve.rotation.x=-.62;
  const cuff=box(root,[.079,.042,.072],[.042,-.176,.152],rubber,.006);cuff.rotation.x=-.65;
  box(root,[.050,.008,.022],[.043,-.159,.183],amber,.003).rotation.x=-.65;
  for(let i=0;i<3;i++){
   const y=-.076-i*.022;
   segment(root,[.027,y,.056],[-.037,y-.007,.061],.012,glove);
   segment(root,[-.037,y-.007,.061],[-.031,y-.011,.098],.012,glove);
   segment(root,[-.032,y+.006,.071],[-.031,y+.005,.085],.002,seam);
  }
  segment(root,[.038,-.074,.084],[.038,-.043,.039],.015,glove);
  segment(root,[.038,-.043,.039],[.032,-.041,.014],.014,glove);
  segment(root,[.018,-.071,.031],[-.007,-.063,.020],.010,glove);
  return root;
 };
 // Retain the live slide and flash groups referenced by the input/recoil code.
 for(const child of [...this.gun.children])if(child!==this.slide&&child!==this.flash)this.gun.remove(child);
 this.slide.clear();this.gun.userData.viewTool=true;this.gun.scale.setScalar(.9);
 box(this.slide,[.068,.061,.242],[0,.021,-.008],ink,.006);
 box(this.slide,[.059,.020,.213],[0,.053,-.015],ceramic,.005);
 box(this.slide,[.048,.004,.147],[0,.065,-.011],steel,.0015);
 for(const x of [-.026,.026])box(this.slide,[.006,.006,.17],[x,.059,-.014],amber,.0015);
 for(const x of [-1,1])for(let i=0;i<7;i++){const ridge=box(this.slide,[.004,.035,.004],[x*.034,.024,.039+i*.009],steel,.001);ridge.rotation.x=-.22;}
 box(this.slide,[.002,.027,.059],[.034,.024,-.034],rubber,.0006);
 box(this.slide,[.002,.017,.037],[.0355,.023,-.029],steel,.0006);
 box(this.slide,[.039,.015,.018],[0,.066,.096],ink,.003);
 box(this.slide,[.038,.034,.003],[0,.020,.115],steel,.001);
 box(this.slide,[.031,.027,.004],[0,.020,.117],rubber,.001);
 cylinder(this.slide,.006,.003,[0,.020,.120],steel);
 for(const x of [-.014,.014])box(this.slide,[.005,.005,.002],[x,.072,.107],amber,.0007);
 box(this.slide,[.009,.013,.014],[0,.074,-.111],ink,.002);
 box(this.slide,[.004,.008,.003],[0,.077,-.103],amber,.001);
 cylinder(this.gun,.015,.192,[0,.018,-.073],steel);
 cylinder(this.gun,.0105,.002,[0,.018,-.170],rubber);
 box(this.gun,[.061,.036,.148],[0,-.028,.022],ink,.005);
 box(this.gun,[.049,.012,.065],[0,-.049,-.045],rubber,.003);
 for(let i=0;i<4;i++)box(this.gun,[.052,.005,.004],[0,-.055,-.065+i*.014],steel,.001);
 const grip=box(this.gun,[.053,.125,.065],[0,-.104,.066],ink,.009);grip.rotation.x=-.22;
 for(const x of [-1,1]){const panel=box(this.gun,[.006,.078,.044],[x*.027,-.104,.072],rubber,.002);panel.rotation.x=-.22;for(let i=0;i<6;i++)box(this.gun,[.007,.003,.033],[x*.030,-.078-i*.010,.074],steel,.001);}
 box(this.gun,[.058,.014,.074],[0,-.166,.080],steel,.004);
 segment(this.gun,[-.022,-.042,-.027],[-.022,-.087,-.014],.005,ink);
 segment(this.gun,[-.022,-.087,-.014],[-.022,-.086,.039],.005,ink);
 segment(this.gun,[.022,-.042,-.027],[.022,-.087,-.014],.005,ink);
 segment(this.gun,[.022,-.087,-.014],[.022,-.086,.039],.005,ink);
 segment(this.gun,[0,-.044,.009],[0,-.069,.020],.005,steel);
 label(this.slide,'SM / 09',[0,.068,.004],[.039,.021],[-Math.PI/2,0,0]);
 makeHand(this.gun);this.flash.position.z=-.177;
 // Spill has its own visible pressure bottle and pump instead of an empty viewport.
 this.spillCan=new T.Group();this.spillCan.userData.viewTool=true;this.spillCan.visible=false;this.camera.add(this.spillCan);
 this.spillCan.scale.setScalar(.82);
 add(this.spillCan,new T.CylinderGeometry(.060,.055,.19,24),ceramic,[0,-.079,.015]);
 add(this.spillCan,new T.CylinderGeometry(.061,.059,.018,24),rubber,[0,-.18,.015]);
 add(this.spillCan,new T.CylinderGeometry(.031,.06,.024,24),amber,[0,.027,.015]);
 add(this.spillCan,new T.CylinderGeometry(.029,.029,.025,24),ink,[0,.049,.015]);
 box(this.spillCan,[.047,.026,.115],[0,.073,-.029],ink,.006);
 cylinder(this.spillCan,.017,.039,[0,.073,-.098],steel);cylinder(this.spillCan,.010,.002,[0,.073,-.119],rubber);
 box(this.spillCan,[.029,.016,.064],[0,.095,-.012],amber,.005);
 label(this.spillCan,'PIGMENT',[0,-.065,.015],[.082,.080],[0,0,0],.061);
 const spillHand=makeHand(this.spillCan);spillHand.position.set(.034,-.010,.009);spillHand.rotation.z=-.12;
 // Turned timber, wrapped grip and staggered steel spikes; a single rigid tool.
 this.bat=new T.Group();this.bat.userData.viewTool=true;this.bat.visible=false;this.camera.add(this.bat);
 const timber=mat(0xa57a45,.72,.01),endgrain=mat(0x735035,.8),tape=mat(0x3a4240,.93);
 const wood=document.createElement('canvas');wood.width=wood.height=512;const wg=wood.getContext('2d');wg.fillStyle='#e2cba5';wg.fillRect(0,0,512,512);
 for(let i=0;i<150;i++){wg.strokeStyle=`rgba(76,47,22,${.04+(i%7)*.009})`;wg.lineWidth=.5+(i%3)*.4;wg.beginPath();for(let y=0;y<=512;y+=8){const x=i*512/150+Math.sin(y*.007+i*.8)*(2+i%9);if(y===0)wg.moveTo(x,y);else wg.lineTo(x,y);}wg.stroke();}timber.map=new T.CanvasTexture(wood);
 const shaft=new T.Group();shaft.position.z=.075;this.bat.add(shaft);
 const profile=[[-.22,0],[-.215,.032],[-.20,.036],[-.184,.031],[-.174,.025],[.075,.025],[.19,.035],[.32,.052],[.45,.067],[.71,.071],[.78,.060],[.818,.033],[.826,0]];
 add(shaft,new T.LatheGeometry(profile.map(([y,r])=>new T.Vector2(r,y)),28),timber);
 add(shaft,new T.CylinderGeometry(.028,.028,.24,20),tape,[0,-.056,0]);
 for(let i=0;i<15;i++){const ring=add(shaft,new T.TorusGeometry(.028,.0018,5,20),rubber,[0,-.17+i*.016,0]);ring.rotation.x=Math.PI/2;ring.rotation.z=.14;}
 add(shaft,new T.CylinderGeometry(.035,.035,.015,20),endgrain,[0,-.209,0]);
 for(let row=0;row<3;row++){
  const y=.42+row*.135,r=.066+row*.002;
  add(shaft,new T.CylinderGeometry(r+.003,r+.003,.035,24),ink,[0,y,0]);
  for(let i=0;i<4;i++){
   const a=i*Math.PI/2+row*.52,n=new V(Math.cos(a),0,Math.sin(a));
   const spike=add(shaft,new T.ConeGeometry(.015,.145,7),steel,[n.x*(r+.063),y,n.z*(r+.063)]);spike.quaternion.setFromUnitVectors(new V(0,1,0),n);
   const rivet=add(shaft,new T.SphereGeometry(.020,8,6),steel,[n.x*r,y,n.z*r]);rivet.scale.y=.7;
  }
 }
 label(shaft,'SM / IMPACT',[0,.23,0],[.07,.065],[0,0,0],.042);
 makeHand(this.bat);
 // A segmented grenade, safety lever, pin ring and the same gloved grip.
 this.grenadeTool=new T.Group();this.grenadeTool.userData.viewTool=true;this.grenadeTool.visible=false;this.camera.add(this.grenadeTool);
 const olive=mat(0x637138,.55,.35);add(this.grenadeTool,new T.SphereGeometry(.066,16,12),olive,[0,-.045,0]).scale.y=1.25;
 for(let j=0;j<5;j++){const y=-.10+j*.028,r=Math.sqrt(Math.max(.0001,.066**2-((y+.045)/1.25)**2));const ring=add(this.grenadeTool,new T.TorusGeometry(r,.003,5,24),ink,[0,y,0]);ring.rotation.x=Math.PI/2;}
 add(this.grenadeTool,new T.CylinderGeometry(.023,.026,.030,12),steel,[0,.043,0]);box(this.grenadeTool,[.023,.010,.089],[0,.063,.013],steel,.002);box(this.grenadeTool,[.023,.12,.008],[0,.01,.058],steel,.002);
 add(this.grenadeTool,new T.TorusGeometry(.025,.003,6,18),steel,[.035,.045,0],[0,Math.PI/2,0]);
 label(this.grenadeTool,'SM / FRAG',[0,-.047,0],[.065,.033],[0,0,0],.065);makeHand(this.grenadeTool).position.set(.025,-.028,.015);
 // Shoulder launcher: open muzzle, reinforced tube, heat shield and folding sight.
 this.rocketTool=new T.Group();this.rocketTool.userData.viewTool=true;this.rocketTool.visible=false;this.camera.add(this.rocketTool);
 cylinder(this.rocketTool,.086,.78,[0,.06,-.13],ink);
 for(const z of [-.50,-.30,.12,.23])cylinder(this.rocketTool,.096,.035,[0,.06,z],steel);
 cylinder(this.rocketTool,.080,.008,[0,.06,-.526],rubber);cylinder(this.rocketTool,.063,.010,[0,.06,-.532],ink);
 for(let i=0;i<5;i++)box(this.rocketTool,[.12,.035,.065],[0,.146,-.37+i*.08],ceramic,.005);
 for(const x of [-.078,.078])box(this.rocketTool,[.018,.045,.37],[x,.057,-.13],amber,.004);
 box(this.rocketTool,[.072,.13,.085],[0,-.066,.08],rubber,.008);
 box(this.rocketTool,[.10,.025,.13],[0,.181,-.11],ink,.004);box(this.rocketTool,[.014,.075,.024],[-.035,.216,-.11],steel,.002);box(this.rocketTool,[.014,.075,.024],[.035,.216,-.11],steel,.002);box(this.rocketTool,[.08,.010,.024],[0,.258,-.11],amber,.002);
 label(this.rocketTool,'SM / ROCKET',[.088,.08,-.10],[.30,.067],[0,Math.PI/2,0]);
 // A compact trigger hand and a mirrored support grip. Forearms run back
 // toward their own shoulders rather than duplicating the pistol wrist pose.
 const launcherHand=(side,origin,wrist,elbow)=>{
  const root=new T.Group();root.position.set(...origin);this.rocketTool.add(root);
  box(root,[.062,.083,.054],[side*.012,-.073,.002],glove,.014);
  box(root,[.050,.040,.006],[side*.014,-.065,.032],seam,.004);
  for(let i=0;i<4;i++){const y=-.038-i*.017;segment(root,[side*.038,y,-.023],[-side*.032,y-.004,-.028],.0105,glove);segment(root,[-side*.032,y-.004,-.028],[-side*.035,y-.010,.013],.0105,glove);}
  segment(root,[side*.044,-.070,.020],[side*.042,-.020,-.004],.013,glove);
  segment(root,[side*.042,-.020,-.004],[side*.012,-.014,-.022],.012,glove);
  const joint=[origin[0]+side*.012,origin[1]-.115,origin[2]+.012];
  segment(this.rocketTool,joint,wrist,.034,glove);segment(this.rocketTool,wrist,elbow,.043,ink);
  const cuff=new T.Group();cuff.position.set(...wrist);cuff.quaternion.setFromUnitVectors(new V(0,1,0),new V(...elbow).sub(new V(...wrist)).normalize());this.rocketTool.add(cuff);add(cuff,new T.CylinderGeometry(.046,.046,.045,16),rubber);
 };
 launcherHand(1,[0,.008,.075],[.055,-.17,.16],[.18,-.32,.50]);
 // The support hand has a real foregrip to close around, below the tube.
 box(this.rocketTool,[.050,.104,.055],[0,-.061,-.285],rubber,.008);
 launcherHand(-1,[0,.002,-.285],[-.065,-.14,-.20],[-.34,-.28,.22]);
 // Cleanup tools share the same grip language, with distinct working ends.
 this.utilityTools=[];
 const makeUtility=()=>{const g=new T.Group();g.userData.viewTool=true;g.visible=false;this.camera.add(g);this.utilityTools.push(g);return g;};
 const mop=makeUtility();segment(mop,[0,-.13,.07],[0,-.10,-.87],.019,steel);cylinder(mop,.026,.20,[0,-.11,-.02],rubber);box(mop,[.42,.045,.14],[0,-.13,-.88],amber,.009);
 for(let i=0;i<22;i++){const x=(i/21-.5)*.39;segment(mop,[x,-.15,-.87],[x+Math.sin(i*2.7)*.014,-.22,-.91-(i%4)*.022],.009,ceramic);segment(mop,[x,-.15,-.87],[x,-.22,-.80+(i%3)*.014],.009,ceramic);}makeHand(mop);
 const blower=makeUtility();add(blower,new T.SphereGeometry(.105,20,12),amber,[0,-.025,.035]).scale.set(1,1,1.25);cylinder(blower,.057,.16,[0,-.017,-.095],ink);cylinder(blower,.038,.40,[0,-.012,-.34],steel);box(blower,[.10,.025,.025],[0,.098,.02],ink);for(let i=0;i<6;i++)box(blower,[.018,.085,.004],[.104,-.019,-.004+i*.013],rubber,.001);makeHand(blower);
 const washer=makeUtility();box(washer,[.065,.055,.18],[0,.012,.015],amber);box(washer,[.05,.11,.054],[0,-.072,.067],ink);cylinder(washer,.011,.65,[0,.018,-.36],steel);cylinder(washer,.025,.07,[0,.018,-.70],ink);cylinder(washer,.012,.008,[0,.018,-.741],ceramic);segment(washer,[0,-.13,.08],[.10,-.25,.19],.013,rubber);makeHand(washer);
 const vacuum=makeUtility();cylinder(vacuum,.076,.25,[0,-.01,-.025],ceramic);for(const z of [-.14,.095])cylinder(vacuum,.079,.032,[0,-.01,z],ink);cylinder(vacuum,.036,.28,[0,-.015,-.28],steel);box(vacuum,[.24,.045,.065],[0,-.028,-.44],ink);for(let i=0;i<8;i++)box(vacuum,[.010,.044,.055],[-.08+i*.023,-.043,-.443],rubber,.001);box(vacuum,[.017,.082,.14],[.08,-.016,-.03],amber);makeHand(vacuum);
 const magnet=makeUtility();box(magnet,[.105,.095,.19],[0,.0,-.025],ink,.012);for(const x of [-.083,.083]){box(magnet,[.045,.08,.26],[x,.016,-.18],steel);box(magnet,[.047,.082,.055],[x,.016,-.294],x<0?amber:ceramic);for(let i=0;i<7;i++)box(magnet,[.05,.088,.009],[x,.016,-.22+i*.018],amber,.002);}box(magnet,[.062,.11,.062],[0,-.087,.052],rubber);makeHand(magnet);
 const sticky=makeUtility();add(sticky,new T.CylinderGeometry(.073,.073,.035,18),ink,[0,-.014,-.012],null);box(sticky,[.075,.028,.066],[0,.016,-.012],amber);box(sticky,[.040,.011,.029],[0,.037,-.012],ceramic);for(const x of [-.057,.057])segment(sticky,[x,.007,-.056],[x,.007,.033],.005,steel);makeHand(sticky).position.set(.021,-.025,.025);
 // Keep moving subassemblies independent and pack the rest by material.
 const merge=(root,exclude=[])=>{
  root.updateWorldMatrix(true,true);const inverse=root.matrixWorld.clone().invert(),groups=new Map();
  root.traverse(o=>{if(!o.isMesh)return;for(let p=o;p&&p!==root;p=p.parent)if(exclude.includes(p))return;const g=o.geometry.clone().applyMatrix4(inverse.clone().multiply(o.matrixWorld));let group=groups.get(o.material);if(!group){group={positions:[],normals:[],uvs:[],indices:[]};groups.set(o.material,group);}const base=group.positions.length/3;for(const [name,key]of [['position','positions'],['normal','normals'],['uv','uvs']])for(const v of g.attributes[name].array)group[key].push(v);if(g.index)for(const index of g.index.array)group.indices.push(base+index);else for(let i=0;i<g.attributes.position.count;i++)group.indices.push(base+i);g.dispose();});
  for(const child of [...root.children])if(!exclude.includes(child))root.remove(child);
  for(const [material,data]of groups){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(data.positions,3));g.setAttribute('normal',new T.Float32BufferAttribute(data.normals,3));g.setAttribute('uv',new T.Float32BufferAttribute(data.uvs,2));g.setIndex(data.indices);add(root,g,material);}
 };
 merge(this.gun,[this.slide,this.flash]);merge(this.slide);merge(this.spillCan);merge(this.bat);merge(this.grenadeTool);merge(this.rocketTool);for(const root of this.utilityTools)merge(root);
 this.toolPresentation={pistol:'beveled receiver, articulated slide, sights, gloved grip',spill:'pressure bottle and pump',bat:'turned wooden bat, wrapped grip, twelve steel spikes and gloved hand',meshes:0};
 this.toolPresentation.rocket='shouldered tube, trigger grip, forward support grip and correctly sided gloved forearms';
 for(const root of [this.gun,this.spillCan,this.bat,this.grenadeTool,this.rocketTool])root.traverse(o=>{if(o.isMesh)this.toolPresentation.meshes++;});
};
SmearCompute.prototype.updateToolPresentation=function(dt,{tool,panel,time,left,batAge=10,rocketAge=10}){
 for(let i=0;i<this.utilityTools.length;i++){const g=this.utilityTools[i];g.visible=tool===i+6&&!panel;if(g.visible){const active=left?Math.sin(time*35)*.003:0;g.position.set(i===0?.18:.27,-.20+active,-.51);g.rotation.set(i===0?-.18:-.06,-.09,-.09);}}
 this.rocketTool.visible=tool===5&&!panel;if(this.rocketTool.visible){const kick=Math.exp(-rocketAge*19)*Math.sin(Math.min(1,rocketAge*32)*Math.PI/2);this.rocketTool.position.set(.26,-.235,-.46+kick*.065);this.rocketTool.rotation.set(-.025+kick*.055,.035,-.025-kick*.02);}
 this.grenadeTool.visible=tool===4&&!panel;if(this.grenadeTool.visible){this.grenadeTool.position.set(.25,-.15,-.52);this.grenadeTool.rotation.set(-.14,-.1,-.18);}
 this.spillCan.visible=tool===2&&!panel;
 if(this.spillCan.visible){this.spillCan.position.set(.255,-.13,-.54);this.spillCan.rotation.set(-.1,0,-.14);if(left)this.spillCan.position.y+=Math.sin(time*38)*.003;}
 this.bat.visible=tool===3&&!panel;
 if(this.bat.visible){
  const t=batAge,ease=x=>x*x*(3-2*x);let sweep=0,wind=0;
  if(t<.10)wind=ease(t/.10);else if(t<.23){const p=ease((t-.10)/.13);wind=1-p;sweep=p;}else if(t<.64)sweep=1-ease((t-.23)/.41);
  this.bat.position.set(.29+wind*.10-sweep*.47,-.40+wind*.025+sweep*.10,-.85-wind*.03-sweep*.11);
  this.bat.rotation.set(.17+wind*.12-sweep*.56,-.15+wind*.28-sweep*.58,-.23-wind*.48+sweep*1.65);
 }
};
