// Local regeneration of the LTC GGX fit, following Heitz et al. 2016 and
// selfshadow/ltc_code (BSD-style license retained in the delivered HTML).
// Uses correlated Smith GGX, the reference mean-direction frame, and L3 MIS.
#include <cmath>
#include <cstdio>
#include <algorithm>
#include <vector>
#include <fstream>
#include <array>
#include <omp.h>
using namespace std;
constexpr double PI=3.141592653589793;
struct V {double x,y,z; V operator+(V b)const{return{x+b.x,y+b.y,z+b.z};} V operator-(V b)const{return{x-b.x,y-b.y,z-b.z};} V operator*(double s)const{return{x*s,y*s,z*s};}};
double dot(V a,V b){return a.x*b.x+a.y*b.y+a.z*b.z;} V norm(V a){return a*(1/sqrt(max(dot(a,a),1e-40)));}
struct S {V l; double f,p;};
struct Params {double x,y,z;};
struct Fitter {
 V view,mean; double alpha,mag=0,fres=0; bool iso;
 vector<V> cosSamples; vector<S> samples;
 Fitter(double r,double ct,bool iso_):view{sqrt(max(0.,1-ct*ct)),0,ct},alpha(max(r*r,1e-5)),iso(iso_){
  V avg{0,0,0}; int avgN=128;
  for(int j=0;j<avgN;j++)for(int i=0;i<avgN;i++){
    V L=sampleGGX((i+.5)/avgN,(j+.5)/avgN); S s=eval(L); double w=s.p>0?s.f/s.p:0;
    mag+=w; V H=norm(view+L); fres+=w*pow(1-max(0.,dot(view,H)),5);avg=avg+L*w;
  }
  mag/=avgN*avgN; fres/=avgN*avgN;avg.y=0;mean=norm(avg);
  int n=32;
  for(int j=0;j<n;j++)for(int i=0;i<n;i++){
   double u=(i+.5)/n,v=(j+.5)/n;
   cosSamples.push_back({sqrt(1-u)*cos(2*PI*v),sqrt(1-u)*sin(2*PI*v),sqrt(u)});
   V L=sampleGGX(u,v); samples.push_back(eval(L));
  }
 }
 V sampleGGX(double u,double v){double radius=alpha*sqrt(v/(1-v));V H=norm({radius*cos(2*PI*u),radius*sin(2*PI*u),1});return H*(2*dot(view,H))-view;}
 S eval(V L)const{
  V H=norm(view+L); if(H.z<=0)return{L,0,0};
  double hz2=H.z*H.z, a2=alpha*alpha;
  double den=(1-hz2)+a2*hz2;double D=a2/(PI*den*den);
  double p=D*H.z/max(4*fabs(dot(view,H)),1e-20);
  if(L.z<=0)return{L,0,p};
  double lv=.5*(sqrt(1+a2*(1-view.z*view.z)/(view.z*view.z))-1);
  double ll=.5*(sqrt(1+a2*(1-L.z*L.z)/(L.z*L.z))-1);
  return{L,D/(4*view.z*(1+lv+ll)),p};
 }
 double objective(Params p)const{
  double sx=exp(p.x),sy=iso?sx:exp(p.y),sh=iso?0:p.z;
  if(sx<1e-8||sy<1e-8||sx>100||sy>100||fabs(sh)>100)return 1e100;
  double det=sx*sy; double error=0;
  // M = [Z.z 0 Z.x;0 1 0;-Z.x 0 Z.z] * [sx 0 sh;0 sy 0;0 0 1]
  auto transform=[&](V a){double x=sx*a.x+sh*a.z;return V{mean.z*x+mean.x*a.z, sy*a.y, -mean.x*x+mean.z*a.z};};
  auto pdf=[&](V L){double z=mean.x*L.x+mean.z*L.z; if(z<=0)return 0.;double x=(mean.z*L.x-mean.x*L.z-sh*z)/sx,y=L.y/sy;double len2=x*x+y*y+z*z;return z/(PI*det*len2*len2);};
  for(size_t i=0;i<samples.size();i++){
    S b=samples[i];double pl=pdf(b.l), d=abs(b.f-mag*pl);error+=d*d*d/max(pl+b.p,1e-30);
    V L=norm(transform(cosSamples[i]));b=eval(L);pl=pdf(L);d=abs(b.f-mag*pl);error+=d*d*d/max(pl+b.p,1e-30);
  }
  return error/samples.size();
 }
};
Params add(Params a,Params b,double s){return{a.x+b.x*s,a.y+b.y*s,a.z+b.z*s};}
Params sub(Params a,Params b){return{a.x-b.x,a.y-b.y,a.z-b.z};}
Params optimize(Fitter &f,Params start){
 int d=f.iso?1:3; array<Params,4> p;array<double,4> v;
 p[0]=start;p[1]=start;p[1].x+=.09;p[2]=start;p[2].y+=.09;p[3]=start;p[3].z+=.04;
 for(int i=0;i<=d;i++)v[i]=f.objective(p[i]);
 for(int it=0;it<165;it++){
  for(int i=0;i<=d;i++)for(int j=i+1;j<=d;j++)if(v[j]<v[i]){swap(v[i],v[j]);swap(p[i],p[j]);}
  double spread=0;for(int j=1;j<=d;j++)spread+=fabs(v[j]-v[0]);if(it>30&&spread<1e-8*max(1.,v[0]))break;
  Params c{0,0,0};for(int i=0;i<d;i++)c=add(c,p[i],1./d);
  Params r=add(c,sub(c,p[d]),1);double vr=f.objective(r);
  if(vr<v[0]){Params e=add(c,sub(r,c),2);double ve=f.objective(e);p[d]=ve<vr?e:r;v[d]=min(ve,vr);}
  else if(vr<v[d-1]){p[d]=r;v[d]=vr;}
  else{bool outside=vr<v[d];Params c2=add(c,sub(outside?r:p[d],c),.5);double vc=f.objective(c2);
   if(vc<(outside?vr:v[d])){p[d]=c2;v[d]=vc;}
   else{for(int i=1;i<=d;i++){p[i]=add(p[0],sub(p[i],p[0]),.5);v[i]=f.objective(p[i]);}}
  }
 }
 int best=0;for(int i=1;i<=d;i++)if(v[i]<v[best])best=i;return p[best];
}
int main(){const int N=64;vector<float> mat(N*N*4),amp(N*N*4);double t0=omp_get_wtime();
 #pragma omp parallel for schedule(dynamic)
 for(int a=0;a<N;a++){
  double r=double(a)/(N-1); Params p{log(max(2*r*r,2e-5)),log(max(2*r*r,2e-5)),0};
  for(int t=0;t<N;t++){
   double q=double(t)/(N-1),ct=max(cos(1.57),1-q*q); Fitter f(r,ct,t==0);p=optimize(f,p);if(t==0){p.y=p.x;p.z=0;}
   double sx=exp(p.x),sy=exp(p.y),sh=p.z,zx=f.mean.x,zz=f.mean.z;
   // inv(M)/inv(M)[1,1]. Packing matches reference: [m00, m20, m02, m22].
   int k=(t*N+a)*4;
   mat[k]=sy*(zz-sh*zx)/sx; mat[k+1]=sy*zx;mat[k+2]=sy*(-zx-sh*zz)/sx;mat[k+3]=sy*zz;
   amp[k]=f.mag;amp[k+1]=f.fres;amp[k+2]=0;amp[k+3]=1;
  }
  if(a%8==0){fprintf(stderr,"roughness row %d/63 completed; %.1fs\n",a,omp_get_wtime()-t0);fflush(stderr);}
 }
 ofstream o("lut.bin",ios::binary);o.write((char*)mat.data(),mat.size()*4);o.write((char*)amp.data(),amp.size()*4);o.close();
 fprintf(stderr,"DONE %.2fs, 64x64 x 2 RGBA32F\n",omp_get_wtime()-t0);
}


