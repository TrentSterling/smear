// SDF-authored crash-test dummy. CRITTERS' smooth union, gradient normals and
// offset-shell rendering adapted to an indexed surface and the 15-body GPU rig.
// No downloaded meshes or textures. Geometry is built once and shared by 12 dolls.
SmearCompute.prototype.prepareDummyVariants=function(){
 this.dummyVariants=['Classic','Runner','Heavy'];
 for(let i=0;i<this.sourceBodies.length;i++){
  const b=this.sourceBodies[i],variant=Math.floor(i/15)%3,part=i%15,scale=variant===1?(part===2?.92:.82):variant===2?(part===2?1.08:1.18):1,mass=variant===1?.72:variant===2?1.45:1;
  b.half.x*=scale;b.half.z*=scale;b.im/=mass;b.invI.multiplyScalar(1/(mass*scale*scale));
  for(const s of b.samples){s.p.x*=scale;s.p.z*=scale;s.r*=scale;}b.bound=Math.max(...b.samples.map(s=>s.p.length()+s.r));
 }
};
SmearCompute.prototype.meshDummy=function(){
 const T=this.THREE,parts=this.sourceBodies.slice(15,30),V=T.Vector3;
 const specifications=[];const smooth=(a,b,k)=>{const h=Math.max(0,Math.min(1,.5+.5*(b-a)/k));return b+(a-b)*h-k*h*(1-h);};
 const ellipsoid=(c,r)=>p=>{const x=(p[0]-c[0])/r[0],y=(p[1]-c[1])/r[1],z=(p[2]-c[2])/r[2];const k0=Math.hypot(x,y,z),k1=Math.hypot(x/r[0],y/r[1],z/r[2]);return k1>1e-8?k0*(k0-1)/k1:-Math.min(...r);};
 const capsule=(a,b,r)=>{const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],length2=dx*dx+dy*dy+dz*dz;return p=>{const x=p[0]-a[0],y=p[1]-a[1],z=p[2]-a[2],t=Math.max(0,Math.min(1,(x*dx+y*dy+z*dz)/length2));return Math.hypot(x-dx*t,y-dy*t,z-dz*t)-r;};};
 const roundedBox=(c,h,r)=>p=>{const x=Math.abs(p[0]-c[0])-h[0]+r,y=Math.abs(p[1]-c[1])-h[1]+r,z=Math.abs(p[2]-c[2])-h[2]+r;return Math.hypot(Math.max(0,x),Math.max(0,y),Math.max(0,z))+Math.min(Math.max(x,y,z),0)-r;};
 const cylinder=(c,r,h,axis=1)=>{const bevel=Math.min(.003,h*.4),i=(axis+1)%3,j=(axis+2)%3;return p=>{const x=Math.hypot(p[i]-c[i],p[j]-c[j])-r+bevel,y=Math.abs(p[axis]-c[axis])-h+bevel;return Math.min(Math.max(x,y),0)+Math.hypot(Math.max(x,0),Math.max(y,0))-bevel;};};
 const limb=(bottom,top,r0,r1,depth=1)=>p=>{const t=Math.max(0,Math.min(1,(p[1]-bottom)/(top-bottom))),r=r0+(r1-r0)*t+.008*Math.sin(t*Math.PI),x=Math.hypot(p[0],p[2]/depth)-r,y=Math.max(bottom-p[1],p[1]-top);return Math.min(Math.max(x,y),0)+Math.hypot(Math.max(x,0),Math.max(y,0))-.010;};
 const union=(fields,k=.02)=>p=>{let d=10;for(let i=0;i<fields.length;i++)d=smooth(d,fields[i](p),k);return d;};
 const add=(bone,name,field,bounds,material=0,blendBone=-1)=>specifications.push({bone,name,field,bounds,material,blendBone});
 // The torso has a broad rib cage, shoulder girdle, shallow sternum and tapered abdomen.
 const ribBox=roundedBox([0,-.012,-.010],[.213,.204,.143],.085);
 const chest=union([p=>ribBox([p[0]/(.85+.15*Math.max(0,Math.min(1,(p[1]+.18)/.3))),p[1],p[2]]),ellipsoid([0,.119,-.010],[.232,.078,.132]),ellipsoid([0,.171,-.009],[.135,.070,.091]),ellipsoid([0,-.117,.023],[.157,.112,.104])],.021);
 add(0,'rib cage',p=>{const pec=.011*Math.exp(-(((Math.abs(p[0])-.088)/.074)**2+((p[1]-.070)/.059)**2)),ribs=.0012*Math.cos((p[1]+.046)*58)*Math.exp(-(((p[1]+.060)/.063)**2))*Math.exp(-(((Math.abs(p[0])-.095)/.052)**2)),relief=(pec+ribs)*Math.max(0,Math.min(1,p[2]/.10));return Math.max(chest(p)-relief,-.185-p[1]);},[[-.27,-.20,-.175],[.27,.26,.18]]);
 const pelvis=union([ellipsoid([0,-.015,-.012],[.191,.153,.145]),ellipsoid([-.081,-.045,-.043],[.102,.096,.116]),ellipsoid([.081,-.045,-.043],[.102,.096,.116]),ellipsoid([0,-.081,.037],[.080,.055,.101])],.020);
 const hipCutL=ellipsoid([-.123,-.160,.024],[.083,.069,.151]),hipCutR=ellipsoid([.123,-.160,.024],[.083,.069,.151]);
 add(1,'pelvis',p=>Math.max(-smooth(smooth(-pelvis(p),hipCutL(p),.015),hipCutR(p),.015),p[1]-.105),[[-.22,-.172,-.178],[.22,.132,.16]]);
 const cranium=union([ellipsoid([0,.025,-.010],[.105,.149,.118]),ellipsoid([0,-.029,.025],[.090,.106,.085]),roundedBox([0,-.080,.018],[.070,.049,.075],.036)],.024);
 const skull=union([cranium,ellipsoid([-.101,-.006,-.011],[.016,.034,.022]),ellipsoid([.101,-.006,-.011],[.016,.034,.022])],.010);
 const bump=(x,y,sx,sy)=>Math.exp(-((x/sx)**2+(y/sy)**2));
 add(2,'molded head',p=>{
  const q=[p[0],(p[1]+.015)/.87,p[2]],[x,y,z]=q;
  // Continuous relief sculpts facial planes into the head, avoiding separate brow/lip blobs.
  const nose=.023*bump(x,y+.007,.015,.043)+.022*bump(x,y+.036,.021,.014);
  const cheeks=.009*bump(Math.abs(x)-.047,y+.033,.030,.034);
  const brow=.006*bump(Math.abs(x)-.038,y-.022,.025,.012);
  const eyes=-.008*bump(Math.abs(x)-.037,y-.006,.023,.009);
  const lips=.004*bump(x,y+.070,.027,.004)+.003*bump(x,y+.081,.025,.004)-.0015*bump(x,y+.076,.022,.002);
  const front=Math.max(0,Math.min(1,z/.08));
  const ear=.007*bump(y+.007,z+.008,.014,.009)*Math.max(0,Math.min(1,(Math.abs(x)-.097)/.016));
  return skull(q)-(nose+cheeks+brow+eyes+lips)*front+ear;
 },[[-.14,-.15,-.15],[.14,.16,.181]]);
 // Neck is a flexible, skin-weighted elastomer stack tied to torso and head.
 add(2,'neck bellows',p=>Math.hypot(p[0],p[2])-(.056+.003*Math.cos((p[1]+.18)*260)),[[-.064,-.24,-.064],[.064,-.128,.064]],1,0);
 for(let side=0;side<2;side++){
  const sign=side?1:-1,arm=3+side*6,fore=arm+1,hand=arm+2,thigh=arm+3,shin=arm+4,foot=arm+5;
  add(arm,'upper arm',limb(-.134,.122,.055,.071,.95),[[-.096,-.15,-.09],[.096,.15,.09]]);
  add(fore,'forearm',limb(-.122,.114,.041,.061,.94),[[-.085,-.14,-.082],[.085,.134,.082]]);
  const fingers=[-.041,-.014,.014,.041].map((x,i)=>capsule([x,-.046,.007],[x,-.105-(i===1||i===2?.015:0),.017],.012));
  const palm=union([ellipsoid([0,.006,0],[.057,.071,.027]),...fingers,capsule([-sign*.044,.017,.006],[-sign*.077,-.036,.025],.018)],.009);
  add(hand,'molded hand',palm,[[-.105,-.143,-.047],[.105,.09,.063]]);specifications.at(-1).rotationY=sign*.55;
  add(thigh,'thigh',limb(-.17,.154,.074,.098,1.04),[[-.127,-.19,-.13],[.127,.175,.13]]);
  add(shin,'calf and tibia',union([limb(-.173,.145,.042,.061,.95),ellipsoid([0,.022,-.014],[.066,.148,.072]),ellipsoid([0,.178,.028],[.071,.070,.065])],.014),[[-.095,-.19,-.10],[.095,.267,.113]]);
  add(foot,'molded foot',union([ellipsoid([0,0,.035],[.083,.059,.157]),ellipsoid([0,.025,-.039],[.066,.074,.077]),roundedBox([0,-.027,.041],[.075,.023,.142],.019)],.015),[[-.101,-.065,-.12],[.101,.108,.214]]);
  add(foot,'rubber sole',roundedBox([0,-.044,.044],[.078,.013,.145],.010),[[-.089,-.065,-.112],[.089,-.026,.2]],1);
  for(const [bone,y,r,w]of [[arm,.143,.065,.067],[fore,.15,.043,.062],[hand,.073,.029,.049],[thigh,.179,.066,.096],[shin,.192,.057,.078],[foot,.055,.039,.060]]){
   const cx=bone===arm?-sign*.018:0;
   add(bone,'joint housing',bone===arm?ellipsoid([cx,y,0],[w*1.05,r,r]):cylinder([0,y,0],r,w,0),[[cx-w-.012,y-r-.012,-r-.012],[cx+w+.012,y+r+.012,r+.012]],bone===fore||bone===hand||bone===shin?0:1);
   for(const s of [-1,1])add(bone,'joint hub',cylinder([cx+s*(w+.001),y,0],r*.57,.005,0),[[cx+s*w-.011,y-r*.65,-r*.65],[cx+s*w+.011,y+r*.65,r*.65]],2);
  }
 }
 // A flexible full-volume waist closes the old gap between two rigid torso chunks.
 add(1,'abdominal boot',p=>{const r=.123+.014*Math.sin((p[1]-.06)/.16*Math.PI);return Math.sqrt((p[0]/1.08)**2+p[2]**2)-r;},[[-.163,.065,-.151],[.163,.22,.151]],.25,0);
 const vertices=[],normals=[],uvs=[],bones=[],weights=[],indices=[],outlines=[],outlineNormals=[];
 const epsilon=.0002;
 const grad=(f,p)=>{const q=[p[0]+epsilon,p[1],p[2]],xp=f(q);q[0]=p[0]-epsilon;const x=xp-f(q);q[0]=p[0];q[1]=p[1]+epsilon;const yp=f(q);q[1]=p[1]-epsilon;const y=yp-f(q);q[1]=p[1];q[2]=p[2]+epsilon;const zp=f(q);q[2]=p[2]-epsilon;const z=zp-f(q),l=Math.hypot(x,y,z)||1;return[x/l,y/l,z/l];};
 const edges=[[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];
 const stats=[];
 for(const spec of specifications){
  const step=spec.name==='molded head'?.0035:/hand/.test(spec.name)?.003:/bellows/.test(spec.name)?.0045:spec.name==='joint hub'?.0035:/joint/.test(spec.name)?.005:/rib cage/.test(spec.name)?.007:/arm|thigh|tibia/.test(spec.name)?.0065:.010;
  const start=vertices.length/3,b=parts[spec.bone],origin=b.restP,rotation=b.restQ.clone().multiply(new T.Quaternion().setFromAxisAngle(new V(0,1,0),spec.rotationY||0));
  // Close open-ended bellows against their physical end planes.
  const original=spec.field;const f=spec.blendBone<0?original:p=>Math.max(original(p),spec.bounds[0][1]-p[1],p[1]-spec.bounds[1][1]);
  const lo=spec.bounds[0].map(v=>v-step*2.137),hi=spec.bounds[1].map(v=>v+step*2.137),dims=lo.map((v,i)=>Math.ceil((hi[i]-v)/step)+1),[nx,ny,nz]=dims;
  const scalar=new Float32Array(nx*ny*nz),point=id=>{const x=id%nx,y=Math.floor(id/nx)%ny,z=Math.floor(id/(nx*ny));return[lo[0]+x*step,lo[1]+y*step,lo[2]+z*step];};
  for(let i=0;i<scalar.length;i++)scalar[i]=f(point(i));
  const cells=new Int32Array((nx-1)*(ny-1)*(nz-1)).fill(-1),cell=(x,y,z)=>x+y*(nx-1)+z*(nx-1)*(ny-1);let errorMax=0;
  const vertex=initial=>{
   let p=initial;
   // CRITTERS-style bounded Newton projection onto the smooth union.
   for(let n=0;n<2;n++){const g=grad(f,p),distance=Math.max(-step,Math.min(step,f(p)));p=p.map((v,i)=>v-g[i]*distance);}
   const n=grad(f,p);errorMax=Math.max(errorMax,Math.abs(f(p)));const wp=new V(...p).applyQuaternion(rotation).add(origin),wn=new V(...n).applyQuaternion(rotation);
   const index=vertices.length/3;vertices.push(...wp.toArray());normals.push(...wn.toArray());uvs.push(spec.material,spec.bone);
   let blend=0;if(spec.blendBone>=0){const fraction=(p[1]-spec.bounds[0][1])/(spec.bounds[1][1]-spec.bounds[0][1]);blend=spec.bone===2?1-fraction:fraction;blend=Math.max(0,Math.min(1,blend));}
   bones.push(spec.bone,Math.max(0,spec.blendBone),spec.blendBone>=0?(spec.bone===2?3:1):0,0);weights.push(1-blend,blend,0,0);
   // A second isosurface supplies the inverted silhouette shell, including concavities.
   const thickness=spec.name==='joint hub'?.0007:/joint/.test(spec.name)?.0012:spec.name==='molded head'&&p[2]>.075?.0012:.002;
   let op=p.map((v,i)=>v+n[i]*thickness);for(let iteration=0;iteration<2;iteration++){const g=grad(f,op),distance=Math.max(-.004,Math.min(.004,f(op)-thickness));op=op.map((v,i)=>v-g[i]*distance);}
   outlines.push(...new V(...op).applyQuaternion(rotation).add(origin).toArray());outlineNormals.push(...wn.toArray());return index;
  };
  const triangle=(a,b,c)=>{const ai=a*3,bi=b*3,ci=c*3,qx=vertices[bi]-vertices[ai],qy=vertices[bi+1]-vertices[ai+1],qz=vertices[bi+2]-vertices[ai+2],rx=vertices[ci]-vertices[ai],ry=vertices[ci+1]-vertices[ai+1],rz=vertices[ci+2]-vertices[ai+2],nx=normals[ai]+normals[bi]+normals[ci],ny=normals[ai+1]+normals[bi+1]+normals[ci+1],nz=normals[ai+2]+normals[bi+2]+normals[ci+2];if((qy*rz-qz*ry)*nx+(qz*rx-qx*rz)*ny+(qx*ry-qy*rx)*nz<0)indices.push(a,c,b);else indices.push(a,b,c);};
  for(let z=0;z<nz-1;z++)for(let y=0;y<ny-1;y++)for(let x=0;x<nx-1;x++){
   // Reject empty cells without allocating corner arrays for the entire volume.
   const base=x+y*nx+z*nx*ny,plane=nx*ny,inside=scalar[base]<0;
   if((scalar[base+1]<0)===inside&&(scalar[base+nx+1]<0)===inside&&(scalar[base+nx]<0)===inside&&(scalar[base+plane]<0)===inside&&(scalar[base+plane+1]<0)===inside&&(scalar[base+plane+nx+1]<0)===inside&&(scalar[base+plane+nx]<0)===inside)continue;
   const ids=[base,base+1,base+nx+1,base+nx,base+plane,base+plane+1,base+plane+nx+1,base+plane+nx];
   const center=[0,0,0];let count=0;
   for(const[a,b]of edges){const ia=ids[a],ib=ids[b];if((scalar[ia]<0)===(scalar[ib]<0))continue;const pa=point(ia),pb=point(ib),t=scalar[ia]/(scalar[ia]-scalar[ib]);for(let k=0;k<3;k++)center[k]+=pa[k]+(pb[k]-pa[k])*t;count++;}
   cells[cell(x,y,z)]=vertex(center.map(v=>v/count));
  }
  // Surface nets: one projected vertex per intersected cell, four cells per sign-changing edge.
  const quad=coordinates=>{const q=coordinates.map(([x,y,z])=>cells[cell(x,y,z)]);if(q.some(v=>v<0))throw Error('Open SDF surface: '+spec.name);triangle(q[0],q[1],q[2]);triangle(q[0],q[2],q[3]);};
  for(let z=1;z<nz-1;z++)for(let y=1;y<ny-1;y++)for(let x=1;x<nx-1;x++){
   const a=x+y*nx+z*nx*ny,inside=scalar[a]<0;
   if(inside!==(scalar[a+1]<0))quad([[x,y-1,z-1],[x,y,z-1],[x,y,z],[x,y-1,z]]);
   if(inside!==(scalar[a+nx]<0))quad([[x-1,y,z-1],[x,y,z-1],[x,y,z],[x-1,y,z]]);
   if(inside!==(scalar[a+nx*ny]<0))quad([[x-1,y-1,z],[x,y-1,z],[x,y,z],[x-1,y,z]]);
  }
  stats.push({name:spec.name,bone:spec.bone,vertices:vertices.length/3-start,maxFieldError:errorMax});
 }
 return {vertices,normals,uvs,bones,weights,indices,outlines,outlineNormals,stats};
};
SmearCompute.prototype.loadDummyMesh=async function(){
 const data=window.__smearDummyMesh,raw=await this.decodedAssets.mesh;if(raw.byteLength!==data.bytes)throw Error('Dummy asset size mismatch');
 for(let i=0;i<15;i++){const b=this.sourceBodies[i+15];if(b.restP.toArray().some((v,j)=>Math.abs(v-data.rig[i].p[j])>1e-6)||b.restQ.toArray().some((v,j)=>Math.abs(v-data.rig[i].q[j])>1e-6))throw Error('Dummy rig changed; rebuild the authored mesh');}
 this.prebuiltDummy={stats:data.stats};for(const [key,a]of Object.entries(data.arrays)){this.prebuiltDummy[key]=key==='indices'?new Uint32Array(raw,a.offset,a.length):new Float32Array(raw,a.offset,a.length);}
};
SmearCompute.prototype.buildDummy=function(){
 const T=this.THREE,V=T.Vector3;
 const {vertices,normals,uvs,bones,weights,indices,outlines,outlineNormals,stats}=this.prebuiltDummy||this.meshDummy();
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geometry.setAttribute('normal',new T.Float32BufferAttribute(normals,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));geometry.setAttribute('skinIndex',new T.Float32BufferAttribute(bones,4));geometry.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));geometry.setIndex(new T.BufferAttribute(new Uint32Array(indices),1));
 const shell=geometry.clone();shell.setAttribute('position',new T.Float32BufferAttribute(outlines,3));shell.setAttribute('normal',new T.Float32BufferAttribute(outlineNormals,3));
 // Remove the former primitive mannequin only from rendering; physics and picking keep the same rig.
 for(const b of this.sourceBodies)b.mesh.visible=false;for(const j of this.joints)j.cover.visible=false;for(const d of this.sourceDolls)d.spine.visible=false;
 // Torn shell rim, sloped tissue and a recessed core. No protruding tube caps.
 const caps=Array.from({length:7},(_,seed)=>{
  const positions=[],uv=[],triangles=[],segments=24,rings=[1,.83,.52,.14];
  for(let ring=0;ring<rings.length;ring++)for(let i=0;i<segments;i++){
   const a=i/segments*Math.PI*2,tear=Math.sin(i*2.31+seed*3.7)*.065+Math.sin(i*5.19+seed)*.045,r=rings[ring]*(1+tear),depth=ring===0?-.025+tear*.22:ring===1?-.10+tear*.30:ring===2?-.25+tear*.18:-.33;
   positions.push(Math.cos(a)*r+(1-rings[ring])*.07,depth,Math.sin(a)*r);uv.push(i/segments,rings[ring]);
  }
  for(let ring=0;ring<3;ring++)for(let i=0;i<segments;i++){const a=ring*segments+i,b=ring*segments+(i+1)%segments,c=a+segments,d=b+segments;triangles.push(a,c,b,b,c,d);}
  const center=positions.length/3;positions.push(.07,-.35,0);uv.push(.5,0);for(let i=0;i<segments;i++)triangles.push(3*segments+i,center,3*segments+(i+1)%segments);
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(triangles);g.computeVertexNormals();return g;
 }),capMat=new T.MeshStandardMaterial({color:0x411019,roughness:.35,metalness:.02});
 for(const joint of this.joints){for(const [body,anchor]of [[joint.a,joint.pa],[joint.b,joint.pb]]){
  const child=(joint.b.id-1)%15,variant=Math.floor((body.id-1)/15)%3,scale=variant===1?(child===2?.92:.82):variant===2?(child===2?1.08:1.18):1;
  const radius=[.13,.13,.056,.062,.047,.032,.078,.060,.041,.062,.047,.032,.078,.060,.041][child]*scale;
  const cap=new T.Mesh(caps[(body.id+joint.b.id)%caps.length],capMat),normal=anchor.clone().normalize();
  cap.position.copy(anchor).addScaledVector(normal,-.006);cap.scale.set(radius,radius,radius);cap.quaternion.setFromUnitVectors(new V(0,1,0),normal);cap.userData.severCap={body:body.id-1,child:joint.b.id-1};cap.castShadow=true;this.scene.add(cap);
 }}
 for(let doll=0;doll<12;doll++)for(const [geo,role]of [[geometry,5],[shell,6]]){const mesh=new T.Mesh(geo,new T.MeshStandardMaterial({color:0xffffff,roughness:.54}));mesh.userData.dummyRole=role;mesh.userData.dummyBase=doll*15;mesh.castShadow=role===5;mesh.frustumCulled=false;this.scene.add(mesh);}
 const ghost=new T.Mesh(geometry,new T.MeshBasicMaterial({color:0x8cdbb9}));ghost.userData.gpuGrabRole=10;ghost.castShadow=false;this.scene.add(ghost);
 this.dummy={method:'SDF union, indexed isosurface, gradient normals, offset shell, GPU skinning',vertices:vertices.length/3,triangles:indices.length/3,bones:15,stats};
};
