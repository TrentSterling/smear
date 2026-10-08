// Presentation uses simulation-scaled elapsed time. Hands and held reload parts
// share a transform, so magazines, shells and rounds stay seated in the grip.
SmearCompute.prototype.animateHandling=function({tool,time,reloadAge,reloadDuration,grenadeAge,inspectAge}){
 const T=this.THREE,root=this.toolRoots[tool];if(!root)return;
 const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
 const beat=(t,a,b,c,d)=>smooth((t-a)/(b-a))*(1-smooth((t-c)/(d-c)));
 for(const hand of this.handRigs){const r=hand.userData.restPose;hand.position.copy(r.p);hand.quaternion.copy(r.q);}
 this.pistolMagazine.position.set(0,0,0);this.pistolMagazine.rotation.set(0,0,0);this.pistolSupport.visible=false;
 this.rocketRound.visible=this.reloadShell.visible=this.reloadBlade.visible=false;
 const reload=reloadAge<reloadDuration,t=reloadAge/reloadDuration;
 if(reload){
  const tilt=beat(t,0,.16,.82,1),reach=beat(t,.08,.27,.71,.92),seat=beat(t,.24,.43,.51,.76);
  root.position.add(new T.Vector3(-.075*tilt,.055*tilt,.065*tilt));root.rotation.x-=.13*tilt;root.rotation.z-=.38*tilt;root.rotation.y+=.24*tilt;
  if(tool===1){
   this.pistolSupport.visible=true;this.pistolMagazine.position.y=-.16*seat;this.pistolMagazine.position.x=-.025*seat;this.pistolMagazine.rotation.z=.12*seat;
   const hand=this.pistolSupport;hand.position.y-=.16*seat;hand.position.x-=.025*seat;hand.position.z+=.025*reach;
   this.slide.position.z=.045*beat(t,.76,.83,.88,.96);
  }else if(tool===12){
   const hand=this.shotgunSupport;hand.position.x-=.08*reach;hand.position.z+=.30*reach;hand.position.y-=.065*reach;hand.rotation.z-=.40*reach;
   this.reloadShell.visible=t>.14&&t<.72;this.shotgunPump.position.z=.075*beat(t,.77,.84,.87,.98);
  }else if(tool===5){
   const hand=this.rocketSupport,insert=smooth((t-.40)/.28);hand.position.x-=.14*reach*(1-insert);hand.position.z+=(-.43+.18*insert)*reach;hand.position.y+=.14*reach;
   this.rocketRound.visible=t>.19&&t<.80;
  }else if(tool===13){
   const hand=this.sawSupport;hand.position.x-=.12*reach;hand.position.y+=.12*reach;hand.rotation.z-=.65*reach;
   this.loadedSaw.visible=t<.17||t>.79;this.reloadBlade.visible=t>.20&&t<.79;
  }else{
   // Grip adjustment / tool priming: the wrist rolls, then positively seats.
   root.rotation.x+=.21*Math.sin(t*Math.PI*2)*tilt;root.position.y-=.045*seat;
  }
 }
 if(tool===4&&grenadeAge<.65){const wind=beat(grenadeAge,0,.05,.10,.18),throwing=beat(grenadeAge,.06,.17,.21,.55);root.position.add(new T.Vector3(-.09*throwing,.13*wind+.12*throwing,-.20*throwing));root.rotation.x-=.95*throwing;root.rotation.z+=.32*wind;
  for(const child of root.children)if(!child.userData.handRig)child.visible=grenadeAge<.09||grenadeAge>.40;
 }else if(tool===4){for(const child of root.children)child.visible=true;}
 if(inspectAge<3){const a=beat(inspectAge,0,.45,2.45,3);root.position.add(new T.Vector3(-.16*a,.065*a,.025*a));root.rotation.z+=.50*a;root.rotation.y+=Math.sin(inspectAge*1.6)*.62*a;root.rotation.x-=.16*a;}
 // Test-only view rotation is local to the complete held assembly. It never
 // moves the world camera or changes any physics state.
 if(this.handlingReview){const r=this.handlingReview;root.position.add(new T.Vector3(...(r.offset||[0,0,0])));root.rotation.x+=r.pitch||0;root.rotation.y+=r.yaw||0;root.rotation.z+=r.roll||0;}
 // Reloads move the wrist, while each sleeve continues offscreen toward its
 // shoulder. Rotating a rigid forearm with the grip exposed a floating end.
 root.updateWorldMatrix(true,true);
 for(const hand of this.handRigs){const f=hand.userData.forearm;if(!f)continue;let owner=hand;while(owner&&owner!==root)owner=owner.parent;if(!owner)continue;
  const end=hand.worldToLocal(this.camera.localToWorld(f.anchor.clone())),axis=end.clone().sub(f.wrist),length=axis.length();f.arm.position.copy(f.wrist).add(end).multiplyScalar(.5);f.arm.scale.y=length;f.arm.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),axis.normalize());f.cuff.quaternion.copy(f.arm.quaternion);
 }
 this.handlingState={tool,reloading:reload,progress:Math.min(1,t),inspecting:inspectAge<3};
};
