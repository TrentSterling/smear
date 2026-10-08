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
  const forearm=new V(.115,-.33,.34),wrist=new V(.043,-.195,.153);const sleeve=add(root,new T.CylinderGeometry(.034,.048,forearm.distanceTo(wrist),18),ink,wrist.clone().add(forearm).multiplyScalar(.5).toArray());sleeve.quaternion.setFromUnitVectors(new V(0,1,0),wrist.clone().sub(forearm).normalize());
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
 label(this.grenadeTool,'SM / FRAG',[0,-.047,0],[.065,.033],[0,0,0],.065);
 // A cupped power grip around the grenade, with the thumb over the lever.
 // The wrist follows the right forearm instead of reusing the pistol grip.
 const grenadeHand=new T.Group();this.grenadeTool.add(grenadeHand);
 const grenadePalm=add(grenadeHand,new T.SphereGeometry(1,16,12),glove,[.029,-.061,.073]);grenadePalm.scale.set(.038,.050,.022);grenadePalm.rotation.z=-.22;
 for(let i=0;i<3;i++)segment(grenadeHand,[.027,-.036-i*.016,.097],[.050,-.043-i*.016,.092],.0016,seam);
 for(let i=0;i<4;i++){
  const y=-.012-i*.027,r=Math.sqrt(Math.max(.0005,.071**2-((y+.045)/1.25)**2));
  segment(grenadeHand,[.044,y,.065],[-r*.75,y,.048],.011,glove);
  segment(grenadeHand,[-r*.75,y,.048],[-r,y-.004,.004],.012,glove);
  segment(grenadeHand,[-r,y-.004,.004],[-r*.72,y-.010,-.038],.011,glove);
  segment(grenadeHand,[-r*.84,y+.007,.027],[-r*.90,y+.006,.006],.0015,seam);
 }
 segment(grenadeHand,[.066,-.048,.060],[.067,.006,.030],.017,glove);
 segment(grenadeHand,[.067,.006,.030],[.018,.029,.047],.015,glove);
 segment(grenadeHand,[.034,-.105,.065],[.071,-.169,.135],.032,glove);
 const grenadeCuff=box(grenadeHand,[.083,.044,.078],[.073,-.163,.141],rubber,.007);grenadeCuff.rotation.set(-.65,0,-.25);
 segment(grenadeHand,[.078,-.180,.154],[.176,-.330,.300],.047,ink);
 box(grenadeHand,[.045,.010,.024],[.079,-.142,.173],amber,.003).rotation.x=-.65;
 // Shoulder launcher: open muzzle, reinforced tube, heat shield and folding sight.
 this.rocketTool=new T.Group();this.rocketTool.userData.viewTool=true;this.rocketTool.visible=false;this.camera.add(this.rocketTool);
 const tube=add(this.rocketTool,new T.CylinderGeometry(.086,.086,.78,32,1,true),ink,[0,.06,-.13]);tube.rotation.x=Math.PI/2;
 for(const z of [-.50,-.30,.12,.23])cylinder(this.rocketTool,.096,.035,[0,.06,z],steel);
 const muzzle=add(this.rocketTool,new T.TorusGeometry(.082,.009,8,32),steel,[0,.06,-.525]);const bore=add(this.rocketTool,new T.CylinderGeometry(.076,.076,.13,32,1,true),rubber,[0,.06,-.46]);bore.rotation.x=Math.PI/2;cylinder(this.rocketTool,.075,.008,[0,.06,-.391],rubber);
 box(this.rocketTool,[.095,.020,.37],[0,.151,-.14],ink,.006);for(let i=0;i<7;i++)box(this.rocketTool,[.073,.008,.017],[0,.165,-.29+i*.045],steel,.002);
 for(const x of [-.078,.078])box(this.rocketTool,[.018,.045,.37],[x,.057,-.13],amber,.004);
 box(this.rocketTool,[.072,.13,.085],[0,-.066,.08],rubber,.008);
 box(this.rocketTool,[.10,.025,.13],[0,.181,-.11],ink,.004);box(this.rocketTool,[.014,.075,.024],[-.035,.216,-.11],steel,.002);box(this.rocketTool,[.014,.075,.024],[.035,.216,-.11],steel,.002);box(this.rocketTool,[.08,.010,.024],[0,.258,-.11],amber,.002);
 label(this.rocketTool,'SM / ROCKET',[.088,.08,-.10],[.30,.067],[0,Math.PI/2,0]);
 // A compact trigger hand and a mirrored support grip. Forearms run back
 // toward their own shoulders rather than duplicating the pistol wrist pose.
 const launcherHand=(side,origin,wrist,elbow,parent=this.rocketTool)=>{
  const root=new T.Group();root.position.set(...origin);parent.add(root);
  const palm=add(root,new T.SphereGeometry(1,16,12),glove,[side*.021,-.073,.019]);palm.scale.set(.037,.049,.025);palm.rotation.z=side*-.13;
  box(root,[.050,.040,.006],[side*.014,-.065,.032],seam,.004);
  for(let i=side>0?1:0;i<4;i++){const y=-.038-i*.017;segment(root,[side*.038,y,-.023],[-side*.032,y-.004,-.028],.0105,glove);segment(root,[-side*.032,y-.004,-.028],[-side*.035,y-.010,.013],.0105,glove);}
  if(side>0){segment(root,[.046,-.037,.014],[.044,-.027,-.039],.0105,glove);segment(root,[.044,-.027,-.039],[.009,-.035,-.048],.010,glove);}
  segment(root,[side*.044,-.070,.020],[side*.042,-.020,-.004],.013,glove);
  segment(root,[side*.042,-.020,-.004],[side*.012,-.014,-.022],.012,glove);
  const joint=[origin[0]+side*.012,origin[1]-.115,origin[2]+.012];
  segment(parent,joint,wrist,.034,glove);segment(parent,wrist,elbow,.043,ink);
  const cuff=new T.Group();cuff.position.set(...wrist);cuff.quaternion.setFromUnitVectors(new V(0,1,0),new V(...elbow).sub(new V(...wrist)).normalize());parent.add(cuff);add(cuff,new T.CylinderGeometry(.046,.046,.045,16),rubber);
 };
 launcherHand(1,[0,.008,.075],[.055,-.17,.16],[.18,-.32,.50]);
 // The support hand has a real foregrip to close around, below the tube.
 box(this.rocketTool,[.050,.104,.055],[0,-.061,-.285],rubber,.008);
 launcherHand(-1,[0,.002,-.285],[-.065,-.14,-.20],[-.34,-.28,.22]);
 // Pump shotgun with a moving fore-end, magazine tube and a stock tucked back.
 this.shotgunTool=new T.Group();this.shotgunTool.userData.viewTool=true;this.camera.add(this.shotgunTool);
 const shotgun=this.shotgunTool;shotgun.scale.setScalar(.9);box(shotgun,[.085,.10,.24],[0,.025,-.015],ink,.010);
 cylinder(shotgun,.025,.55,[0,.049,-.32],steel);cylinder(shotgun,.018,.008,[0,.049,-.599],rubber);
 cylinder(shotgun,.022,.45,[0,-.010,-.30],ink);cylinder(shotgun,.024,.028,[0,-.010,-.535],amber);
 box(shotgun,[.065,.09,.25],[0,-.015,.22],timber,.019);box(shotgun,[.078,.10,.025],[0,-.02,.354],rubber,.009);
 box(shotgun,[.045,.11,.068],[0,-.064,.074],rubber,.008);box(shotgun,[.009,.018,.017],[0,.084,-.49],amber,.002);
 box(shotgun,[.003,.045,.093],[.044,.025,.007],steel,.002);
 this.shotgunPump=new T.Group();shotgun.add(this.shotgunPump);box(this.shotgunPump,[.085,.065,.18],[0,-.038,-.34],timber,.012);
 for(let i=0;i<9;i++)box(this.shotgunPump,[.089,.067,.005],[0,-.038,-.412+i*.018],rubber,.001);
 this.shotgunFlash=add(shotgun,new T.SphereGeometry(.055,6,4),new T.MeshBasicMaterial({color:0xffd17e}),[0,.049,-.66]);this.shotgunFlash.scale.z=2.5;this.shotgunFlash.visible=false;
 label(shotgun,'SM / 12',[0,.079,-.010],[.054,.086],[-Math.PI/2,0,0]);
 launcherHand(1,[0,.016,.085],[.07,-.17,.17],[.23,-.31,.47],shotgun);
 launcherHand(-1,[0,-.020,-.31],[-.075,-.18,-.21],[-.32,-.30,.20],this.shotgunPump);
 // Open twin guide rails frame the visibly toothed blade instead of a gun barrel.
 this.sawTool=new T.Group();this.sawTool.userData.viewTool=true;this.camera.add(this.sawTool);const saw=this.sawTool;saw.scale.setScalar(.86);
 box(saw,[.16,.15,.25],[0,.025,.015],ink,.016);box(saw,[.17,.055,.20],[0,.112,.015],amber,.008);
 for(const x of [-.065,.065]){box(saw,[.033,.056,.43],[x,-.040,-.26],steel,.006);box(saw,[.037,.06,.032],[x,-.040,-.47],amber,.003);}
 this.loadedSaw=add(saw,this.sawGeometry(),steel,[0,.058,-.25]);this.loadedSaw.scale.setScalar(.15);this.loadedSaw.rotation.z=Math.PI/2;
 for(const x of [-.083,.083])cylinder(saw,.045,.07,[x,.021,.095],steel);
 box(saw,[.055,.115,.072],[0,-.10,.095],rubber,.009);box(saw,[.055,.10,.052],[0,-.096,-.21],rubber,.006);
 label(saw,'SM / SAW',[.087,.06,.015],[.18,.074],[0,Math.PI/2,0]);
 launcherHand(1,[0,-.030,.095],[.08,-.22,.18],[.24,-.34,.46],saw);
 launcherHand(-1,[0,-.027,-.21],[-.07,-.19,-.14],[-.33,-.31,.21],saw);
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
 this.brawlTools=[];
 const boot=new T.Group();boot.userData.viewTool=true;boot.visible=false;this.camera.add(boot);this.brawlTools.push(boot);
 box(boot,[.15,.14,.32],[0,0,-.10],rubber,.025);box(boot,[.16,.035,.34],[0,-.072,-.10],ink,.01);box(boot,[.14,.105,.085],[0,.009,-.225],steel,.015);segment(boot,[0,.065,.016],[0,.25,.32],.077,ink);
 for(let n=0;n<5;n++)segment(boot,[-.045,.072,-.15+n*.035],[.045,.072,-.13+n*.035],.004,amber);
 const palms=new T.Group();palms.userData.viewTool=true;palms.visible=false;this.camera.add(palms);this.brawlTools.push(palms);
 for(const side of [-1,1]){const x=side*.19;box(palms,[.085,.10,.038],[x,0,0],glove,.015);for(let n=0;n<4;n++){const fx=x+(n-1.5)*.022;segment(palms,[fx,.025,0],[fx,.105-Math.abs(n-1.4)*.012,-.009],.009,glove);}segment(palms,[x-side*.047,-.028,0],[x-side*.075,.025,-.012],.014,glove);segment(palms,[x,-.045,.015],[x+side*.075,-.18,.30],.037,ink);box(palms,[.09,.032,.06],[x,-.067,.045],rubber,.008);}
 // Keep moving subassemblies independent and pack the rest by material.
 const merge=(root,exclude=[])=>{
  root.updateWorldMatrix(true,true);const inverse=root.matrixWorld.clone().invert(),groups=new Map();
  root.traverse(o=>{if(!o.isMesh)return;for(let p=o;p&&p!==root;p=p.parent)if(exclude.includes(p))return;const g=o.geometry.clone().applyMatrix4(inverse.clone().multiply(o.matrixWorld));let group=groups.get(o.material);if(!group){group={positions:[],normals:[],uvs:[],indices:[]};groups.set(o.material,group);}const base=group.positions.length/3;for(const [name,key]of [['position','positions'],['normal','normals'],['uv','uvs']])for(const v of g.attributes[name].array)group[key].push(v);if(g.index)for(const index of g.index.array)group.indices.push(base+index);else for(let i=0;i<g.attributes.position.count;i++)group.indices.push(base+i);g.dispose();});
  for(const child of [...root.children])if(!exclude.includes(child))root.remove(child);
  for(const [material,data]of groups){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(data.positions,3));g.setAttribute('normal',new T.Float32BufferAttribute(data.normals,3));g.setAttribute('uv',new T.Float32BufferAttribute(data.uvs,2));g.setIndex(data.indices);add(root,g,material);}
 };
 merge(this.gun,[this.slide,this.flash]);merge(this.slide);merge(this.spillCan);merge(this.bat);merge(this.grenadeTool);merge(this.rocketTool);merge(this.shotgunTool,[this.shotgunPump,this.shotgunFlash]);merge(this.shotgunPump);merge(this.sawTool,[this.loadedSaw]);for(const root of [...this.utilityTools,...this.brawlTools])merge(root);
 this.toolPresentation={pistol:'beveled receiver, articulated slide, sights, gloved grip',spill:'pressure bottle and pump',bat:'turned wooden bat, wrapped grip, twelve steel spikes and gloved hand',meshes:0};
 this.toolPresentation.rocket='shouldered tube, trigger grip, forward support grip and correctly sided gloved forearms';
 for(const root of [this.gun,this.spillCan,this.bat,this.grenadeTool,this.rocketTool])root.traverse(o=>{if(o.isMesh)this.toolPresentation.meshes++;});
};
SmearCompute.prototype.sawGeometry=function(){
 const T=this.THREE,g=new T.CylinderGeometry(1,1,.09,64,1),p=g.attributes.position;
 for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i);if(Math.hypot(x,z)<.5)continue;const tooth=Math.round((Math.atan2(z,x)+Math.PI)*32/Math.PI),r=tooth%2===0?1:.82;p.setXYZ(i,x*r,p.getY(i),z*r);}g.computeVertexNormals();return g;
};
SmearCompute.prototype.updateToolPresentation=function(dt,{tool,panel,time,left,batAge=10,brawlAge=10,brawlKick=true,rocketAge=10,arsenalAge=10}){
 const brawling=brawlAge<.60&&!panel;const thrust=brawlAge<.14?brawlAge/.14:Math.max(0,1-(brawlAge-.14)/.46);for(let i=0;i<2;i++){const g=this.brawlTools[i];g.visible=brawling&&(i===0)===brawlKick;if(i===0){g.position.set(.10,-.59+thrust*.23,-.35-thrust*.52);g.rotation.set(-.35+thrust*.25,0,-.10);}else{g.position.set(0,-.32+thrust*.19,-.26-thrust*.48);g.rotation.set(.14,0,0);}}
 for(const [id,g]of [[12,this.shotgunTool],[13,this.sawTool]]){g.visible=tool===id&&!panel;if(g.visible){const kick=Math.exp(-arsenalAge*15)*Math.sin(Math.min(1,arsenalAge*35)*Math.PI/2);g.position.set(.245,-.21,-.48+kick*.095);g.rotation.set(-.035+kick*.095,-.015,-.035);}}
 this.shotgunFlash.visible=arsenalAge<.065;
 this.shotgunPump.position.z=arsenalAge>.24&&arsenalAge<.58?Math.sin((arsenalAge-.24)/.34*Math.PI)*.08:0;
 this.loadedSaw.rotation.set(0,0,Math.PI/2);this.loadedSaw.rotateY(time*25);this.loadedSaw.visible=arsenalAge>.17;
 for(let i=0;i<this.utilityTools.length;i++){const g=this.utilityTools[i];g.visible=tool===i+6&&!panel;if(g.visible){const active=left?Math.sin(time*35)*.003:0;g.position.set(i===0?.18:.27,-.20+active,-.51);g.rotation.set(i===0?-.18:-.06,-.09,-.09);}}
 this.rocketTool.visible=tool===5&&!panel;if(this.rocketTool.visible){const kick=Math.exp(-rocketAge*19)*Math.sin(Math.min(1,rocketAge*32)*Math.PI/2);this.rocketTool.position.set(.255,-.255,-.47+kick*.065);this.rocketTool.rotation.set(-.025+kick*.055,.035,-.025-kick*.02);}
 this.grenadeTool.visible=tool===4&&!panel;if(this.grenadeTool.visible){this.grenadeTool.position.set(.24,-.22,-.48);this.grenadeTool.rotation.set(-.08,-.24,.12);}
 this.spillCan.visible=tool===2&&!panel;
 if(this.spillCan.visible){this.spillCan.position.set(.255,-.13,-.54);this.spillCan.rotation.set(-.1,0,-.14);if(left)this.spillCan.position.y+=Math.sin(time*38)*.003;}
 this.bat.visible=tool===3&&!panel;
 if(this.bat.visible){
  const t=batAge,ease=x=>x*x*(3-2*x);let sweep=0,wind=0;
  if(t<.10)wind=ease(t/.10);else if(t<.23){const p=ease((t-.10)/.13);wind=1-p;sweep=p;}else if(t<.64)sweep=1-ease((t-.23)/.41);
  this.bat.position.set(.29+wind*.10-sweep*.47,-.40+wind*.025+sweep*.10,-.85-wind*.03-sweep*.11);
  this.bat.rotation.set(.17+wind*.12-sweep*.56,-.15+wind*.28-sweep*.58,-.23-wind*.48+sweep*1.65);
 }
 if(brawling)for(const g of [this.gun,this.spillCan,this.bat,this.grenadeTool,this.rocketTool,this.shotgunTool,this.sawTool,...this.utilityTools])g.visible=false;
};
