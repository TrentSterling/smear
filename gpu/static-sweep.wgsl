struct StaticSweep { time:f32, normal:vec3f };
// A conservative swept sample prevents crossing the far side of a thin OBB
// before discrete contacts can choose its entry face. Existing contacts still
// solve the rounded corners and resting friction at all nine iterations.
fn sweepStaticSample(previous:vec3f,current:vec3f,radius:f32,center:vec3f,q:vec4f,half:vec3f)->StaticSweep{
 let a=rotate(inverseQ(q),previous-center);let b=rotate(inverseQ(q),current-center);let h=half+vec3f(radius);let delta=b-a;
 if(all(abs(a)<=h)||length(delta)<.025||any(min(a,b)>h)||any(max(a,b)<-h)){return StaticSweep(2,vec3f(0));}
 var entry=0.0;var exit=1.0;var normal=vec3f(0);
 for(var axis=0u;axis<3u;axis++){
  if(abs(delta[axis])<1e-7){if(abs(a[axis])>h[axis]){return StaticSweep(2,vec3f(0));}continue;}
  let t0=(-h[axis]-a[axis])/delta[axis];let t1=(h[axis]-a[axis])/delta[axis];let near=min(t0,t1);let far=max(t0,t1);
  if(near>entry){entry=near;normal=vec3f(0);normal[axis]=-sign(delta[axis]);}exit=min(exit,far);
  if(entry>exit){return StaticSweep(2,vec3f(0));}
 }
 if(entry<=0||entry>1){return StaticSweep(2,vec3f(0));}return StaticSweep(entry,rotate(q,normal));
}
