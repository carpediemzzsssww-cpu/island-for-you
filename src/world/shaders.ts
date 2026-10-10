// Shared GLSL for the painted sky, the sea and the puff clouds. Colours arrive from atmosphere.ts.
const noise=`
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<3;i++){v+=a*vnoise(p);p=p*2.03+17.1;a*=.5;}return v;}`;

export const skyVertex=`varying vec3 vDir;void main(){vDir=position;vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position=p.xyww;}`;
export const skyFragment=`varying vec3 vDir;
uniform vec3 uZenith;uniform vec3 uHorizon;uniform vec3 uHaze;uniform vec3 uSun;uniform vec3 uSunDir;uniform float uSunDisc;uniform float uStars;uniform float uTime;
${noise}
void main(){
 vec3 d=normalize(vDir);float h=d.y;
 vec3 c=mix(uHorizon,uZenith,pow(smoothstep(-.01,.42,h),.62));
 c=mix(c,uHaze,smoothstep(.05,-.04,h));
 float sd=max(dot(d,uSunDir),0.);
 c+=uSun*(pow(sd,5.)*.2+pow(sd,40.)*.35)*(.35+.65*uSunDisc);
 c=mix(c,uSun*1.5+.18,smoothstep(.9986,.9993,sd)*uSunDisc);
 // Painted stratus streaks close to the horizon.
 float az=atan(d.z,d.x);
 float streak=vnoise(vec2(az*3.+uTime*.003,h*16.))*smoothstep(.015,.07,h)*smoothstep(.26,.08,h);
 c=mix(c,mix(uHorizon,vec3(1.),.45)+uSun*.12,smoothstep(.35,.8,streak)*.3);
 if(uStars>.01){vec2 g=floor(vec2(az,asin(clamp(h,-1.,1.)))*190.);float s=hash(g);float tw=.55+.45*sin(uTime*1.7+s*60.);c+=vec3(step(.9962,s)*tw*uStars*smoothstep(.06,.35,h))*.9;}
 gl_FragColor=vec4(c,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;

export const seaVertex=`varying vec3 vWorld;varying vec4 vRefl;uniform mat4 uTextureMatrix;
void main(){vec4 w=modelMatrix*vec4(position,1.);vWorld=w.xyz;vRefl=uTextureMatrix*w;gl_Position=projectionMatrix*viewMatrix*w;}`;
// Glass sea: a calm, clear surface. Near the shore the sandy seabed and its caustics show through; further out the
// water turns turquoise, then deep blue; at grazing angles it mirrors the island, the clouds and the sky
// (a planar reflection rendered each frame; the painted sky stands in when that is switched off).
export const seaFragment=`varying vec3 vWorld;varying vec4 vRefl;
uniform float uTime;uniform vec3 uDeep;uniform vec3 uMid;uniform vec3 uShallow;uniform vec3 uFoam;uniform vec3 uHaze;uniform vec3 uHorizon;uniform vec3 uZenith;uniform vec3 uSun;uniform vec3 uSunDir;uniform float uSunDisc;uniform float uRain;
uniform sampler2D uReflection;uniform float uReflect;uniform vec3 uSand;
${noise}
// Coastline mirrored from scripts/build_island.py (wobble, cliff and beach sectors).
float wob(float a){return 1.+.065*sin(a*3.+.5)+.045*cos(a*5.)+.025*sin(a*9.);}
float adiff(float a,float c){return mod(a-c+3.14159265,6.2831853)-3.14159265;}
float bump(float a,float c,float w){float d=abs(adiff(a,c))/w;return d>=1.?0.:.5+.5*cos(d*3.14159265);}
vec2 hash2(vec2 p){return fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*43758.5453);}
// Distance to the nearest cell edge of a slowly moving Voronoi pattern: thin bright lines where cells meet.
float cellEdge(vec2 p,float t){vec2 i=floor(p),f=fract(p);float m1=8.,m2=8.;
 for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 g=vec2(float(x),float(y));vec2 o=.5+.42*sin(t+6.2831*hash2(i+g));vec2 r=g+o-f;float d=dot(r,r);if(d<m1){m2=m1;m1=d;}else if(d<m2){m2=d;}}
 return sqrt(m2)-sqrt(m1);}
float caustics(vec2 p,float t){float e=min(cellEdge(p,t),cellEdge(p*1.31+vec2(3.1,1.7),t*1.17+1.3));return 1.-smoothstep(.02,.16,e);}
vec3 skyColour(vec3 d){
 float h=d.y;vec3 c=mix(uHorizon,uZenith,pow(smoothstep(-.01,.42,h),.62));c=mix(c,uHaze,smoothstep(.05,-.04,h));
 float sd=max(dot(d,uSunDir),0.);c+=uSun*(pow(sd,5.)*.2+pow(sd,40.)*.35)*(.35+.65*uSunDisc);return c;}
void main(){
 vec2 p=vWorld.xz;
 vec2 q=p/vec2(13.3,11.1);float a=atan(q.y,q.x);
 float cliff=min(1.,bump(a,-1.25,1.2)+.9*bump(a,.28,.36));float beach=bump(a,2.05,.8);
 float wl=(1.-cliff-beach)*1.065+cliff*1.036+beach*1.135;
 float d=(length(q)/wob(a)-wl)*12.2;
 vec2 q2=(p-vec2(-18.,-8.))/vec2(2.9,2.1);float a2=atan(q2.y,q2.x);
 float c2=bump(a2,-2.3,.9),b2=bump(a2,.9,1.);float d2=(length(q2)/wob(a2)-((1.-c2-b2)*1.065+c2*1.036+b2*1.135))*2.5;
 if(d2<d){d=d2;cliff=c2;beach=b2;}
 float dd=max(d,0.);float t=uTime;
 float dist=length(vWorld.xz-cameraPosition.xz);float detail=1.-smoothstep(20.,150.,dist);
 // Calm surface: slow swells and a fine ripple; rain roughens it.
 float rough=1.+uRain*1.6;
 vec2 r=p*.17;float n1=fbm(r+vec2(t*.03,t*.02));float n2=fbm(r*1.6-vec2(t*.025,-t*.035));
 float f1=vnoise(p*1.7+vec2(t*.23,-t*.19));float f2=vnoise(p*2.3-vec2(t*.17,t*.25));
 vec3 N=normalize(vec3(((n1-.5)*.13+(f1-.5)*.06)*detail*rough,1.,((n2-.5)*.13+(f2-.5)*.06)*detail*rough));
 vec3 V=normalize(cameraPosition-vWorld);
 float fres=.04+.96*pow(1.-max(dot(N,V),0.),5.);
 // Water body over a sandy shelf: clear first (seabed and caustics), then turquoise, then deep blue.
 vec3 water=mix(uDeep,uMid,exp(-dd/9.));
 float shelf=exp(-dd/(1.5+3.4*beach-.6*cliff));
 water=mix(water,uShallow,shelf*.88);
 float bed=exp(-dd/(.7+1.9*beach))*(1.-cliff*.65);
 if(bed>.02&&detail>.01){float cau=caustics(p*.62+N.xz*1.4,t*.6)*detail;water=mix(water,mix(uSand,uShallow,.42)+uSand*cau*.28,bed*.82);}
 // Reflection: the planar mirror (island, clouds, sky) with a slight ripple; the painted sky without it.
 vec3 R=reflect(-V,N);vec3 refl=skyColour(normalize(vec3(R.x,abs(R.y),R.z)));
 // The mirror is softened with four taps, and fades out where she looks steeply down: from high above, a flat
 // island's reflection would only show its underside, which reads as a hard band on the water.
 vec2 uv=vRefl.xy/vRefl.w+N.xz*.05;
 // ...and toward the edges of the mirror's own view, where it has nothing to show.
 float mirrorK=uReflect*(1.-smoothstep(.26,.46,V.y))*smoothstep(0.,.08,uv.x)*smoothstep(1.,.92,uv.x)*smoothstep(0.,.1,uv.y)*smoothstep(1.,.9,uv.y);
 if(mirrorK>.01){vec2 o=vec2(.0016,.0022);
  vec3 m=(texture2D(uReflection,uv+o).rgb+texture2D(uReflection,uv-o).rgb+texture2D(uReflection,uv+vec2(o.x,-o.y)).rgb+texture2D(uReflection,uv+vec2(-o.x,o.y)).rgb)*.25;
  refl=mix(refl,m,mirrorK);}
 vec3 c=mix(water,refl,clamp(fres*1.15,0.,.92));
 c*=.97+.03*sin(dot(p,vec2(.19,.11))+t*.18);
 // Sun glints on the ripples.
 vec3 H=reflect(-uSunDir,N);float spec=pow(max(dot(H,V),0.),260.);
 float glitter=step(.64,vnoise(p*3.1+t*.4))*spec*detail;
 c+=uSun*(spec*.35+glitter*2.)*uSunDisc;
 // Shore foam: a broken lace at the waterline and a few soft rings; spray at the cliffs.
 float lace=smoothstep(.42,.0,abs(d-.06))*smoothstep(.3,.64,fbm(p*1.6+vec2(t*.12,-t*.08)));
 float rings=smoothstep(.88,1.,sin((d*.9+t*.3)*6.2831)*.5+.5)*exp(-dd/1.4)*step(.2,d)*smoothstep(.34,.58,fbm(p*.9-t*.05));
 float crash=cliff*smoothstep(.55,.0,abs(d-.05))*(.6+.4*sin(t*1.3+a*9.));
 float foam=clamp(lace*(1.+cliff)+rings*.42+crash*.7,0.,1.);
 c=mix(c,uFoam,foam*.8);
 if(uRain>.01){float drops=step(.985,vnoise(p*6.+floor(t*8.)*3.7));c=mix(c,uFoam,drops*uRain*.35);}
 c=mix(c,uHaze,smoothstep(120.,440.,dist)*.85);
 gl_FragColor=vec4(c,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;

// Instanced, camera-facing puffs; tinted by height inside each cloud so every cloud has a lit crown and a cool belly.
export const cloudVertex=`attribute vec3 aOffset;attribute float aScale;attribute float aHeight;attribute float aSeed;
varying vec2 vUv;varying float vHeight;varying vec3 vCentre;varying float vNear;
void main(){
 vec3 centre=(modelMatrix*vec4(aOffset,1.)).xyz;vec4 mv=viewMatrix*vec4(centre,1.);
 float r=aSeed*6.2831;vec2 v=mat2(cos(r),-sin(r),sin(r),cos(r))*position.xy;
 mv.xy+=v*aScale;gl_Position=projectionMatrix*mv;vUv=uv;vHeight=aHeight;vCentre=centre;
 // Puffs dissolve before the camera can pass through them.
 vNear=smoothstep(aScale*1.2,aScale*3.5,length(centre-cameraPosition));
}`;
export const cloudFragment=`uniform sampler2D map;uniform vec3 uLit;uniform vec3 uShade;uniform vec3 uHaze;uniform vec3 uSun;uniform vec3 uSunDir;uniform float uOpacity;
varying vec2 vUv;varying float vHeight;varying vec3 vCentre;varying float vNear;
void main(){
 vec4 t=texture2D(map,vUv);if(t.a<.01)discard;
 float h=clamp(vHeight+(t.r-.9)*.9+(.5-vUv.y)*.18,0.,1.);
 vec3 c=mix(uShade,uLit,smoothstep(.0,.8,h));
 vec3 view=normalize(vCentre-cameraPosition);float toward=max(dot(view,uSunDir),0.);
 c+=uSun*pow(toward,6.)*(1.-t.a*.6)*.55;
 float dist=length(vCentre-cameraPosition);c=mix(c,uHaze,smoothstep(180.,420.,dist)*.35);
 gl_FragColor=vec4(c,t.a*uOpacity*vNear);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;
