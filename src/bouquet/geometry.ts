import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Procedural flowers for the florist's table. Every flower head is built petal by petal from bent grids, coloured
// with vertex colours and merged into one geometry, so a whole bouquet costs only a few draw calls.
// Units: metres-ish at bouquet scale (a tulip cup is about 6 cm tall). A head grows along +y from its origin.

type Geo=THREE.BufferGeometry;
const C=(hex:string)=>new THREE.Color(hex);
/** Keep only position, normal and colour, so every piece can be merged. */
function clean(g:Geo,color:THREE.Color|((p:THREE.Vector3,i:number)=>THREE.Color)){
 g.deleteAttribute('uv');if(!g.attributes.normal)g.computeVertexNormals();
 const p=g.attributes.position as THREE.BufferAttribute;const col=new Float32Array(p.count*3);const v=new THREE.Vector3();
 for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i);const c=typeof color==='function'?color(v,i):color;col.set([c.r,c.g,c.b],i*3);}
 g.setAttribute('color',new THREE.BufferAttribute(col,3));return g;
}
function merge(parts:Geo[]){const g=mergeGeometries(parts.map(p=>p.index?p:p),false)!;parts.forEach(p=>p.dispose());return g;}

interface PetalShape{len:number;wid:number;cup?:number;curl?:number;tipCurl?:number;notch?:number;teeth?:number;round?:number;widest?:number;segU?:number;segV?:number;roll?:number;twist?:number;veins?:number}
/** One petal: a grid bent into a cup across its width, curled along its length; base at the origin, tip toward +y,
 *  concave side toward -z. `roll` turns the upper edges back (a rose's outer petals), `twist` turns the petal about
 *  its own axis (a frangipani's pinwheel), `notch`/`teeth` shape the tip, `veins` draws faint lines toward the tip.
 *  Colours run from `base` to `tip` and darken slightly at the edges. */
function petal(s:PetalShape,base:THREE.Color,tip:THREE.Color,edge=.1){
 const U=s.segU??8,V=s.segV??10,teeth=s.teeth??3;const pos:number[]=[],col:number[]=[],idx:number[]=[];const c=new THREE.Color();
 for(let j=0;j<=V;j++){const v=j/V;
  // Width profile: rounded tip, narrower base; `widest` moves the widest point along the petal.
  const w=s.wid*Math.pow(Math.sin(Math.PI*Math.min(1,.12+v*.88)),s.round??.6)*(1+((s.widest??.5)-.5)*(v-.5)*1.6);
  for(let i=0;i<=U;i++){const u=i/U*2-1;
   let y=v*s.len;if(s.notch)y-=s.notch*s.len*Math.pow(v,6)*(.5+.5*Math.cos(u*Math.PI*teeth));
   let x=u*w;let z=-(s.cup??0)*u*u*w;z+=(s.curl??0)*v*v*s.len;z+=(s.tipCurl??0)*Math.pow(v,4)*s.len;z+=(s.roll??0)*Math.pow(Math.abs(u),2.2)*v*v*s.len;
   if(s.twist){const a=s.twist*v,cx=x*Math.cos(a)-z*Math.sin(a),cz=x*Math.sin(a)+z*Math.cos(a);x=cx;z=cz;}
   pos.push(x,y,z);c.copy(base).lerp(tip,Math.pow(v,.8)).multiplyScalar(1-edge*Math.abs(u)*v);
   if(s.veins)c.multiplyScalar(1-Math.pow(Math.abs(Math.cos(u*Math.PI*s.veins)),14)*(1-v*.6)*.08);
   col.push(c.r,c.g,c.b);}}
 for(let j=0;j<V;j++)for(let i=0;i<U;i++){const a=j*(U+1)+i,b=a+1,d=a+U+1,e=d+1;idx.push(a,d,b,b,d,e);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));g.setIndex(idx);g.computeVertexNormals();return g;
}
/** A surface patch from (u across, v up) to a point and colour: used for the tulip's closed cup. */
function patch(U:number,V:number,at:(u:number,v:number,c:THREE.Color)=>[number,number,number]){
 const pos:number[]=[],col:number[]=[],idx:number[]=[];const c=new THREE.Color();
 for(let j=0;j<=V;j++)for(let i=0;i<=U;i++){pos.push(...at(i/U*2-1,j/V,c));col.push(c.r,c.g,c.b);}
 for(let j=0;j<V;j++)for(let i=0;i<U;i++){const a=j*(U+1)+i,b=a+1,d=a+U+1,e=d+1;idx.push(a,d,b,b,d,e);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));g.setIndex(idx);g.computeVertexNormals();return g;
}
const m4=new THREE.Matrix4(),q=new THREE.Quaternion(),Y=new THREE.Vector3(0,1,0);
/** Place a petal around the flower axis, concave side inward: tilt it out by `tilt`, push it out by `r`, turn it to `angle`. */
function place(g:Geo,angle:number,tilt:number,r:number,y=0,twist=0){
 g.applyMatrix4(m4.makeRotationY(twist));g.applyMatrix4(m4.makeRotationX(tilt));g.applyMatrix4(m4.makeTranslation(0,y,r));g.applyMatrix4(m4.makeRotationY(angle));return g;
}
function ball(r:number,color:THREE.Color,sx=1,sy=1,sz=1,w=10,h=8){const g=new THREE.SphereGeometry(r,w,h);g.scale(sx,sy,sz);return clean(g,color);}
const jitter=(k:number,salt=0)=>Math.sin(k*12.9898+salt*78.233)*.5;

/** Tulip: six petals closing into an egg-shaped cup, three outside and three in between, pale and green at the foot. */
export function tulipHead(color='#e99aab'){
 const main=C(color),base=C('#f6e7d6'),foot=C('#c9d6a0'),parts:Geo[]=[];const H=.07,R=.026;
 for(let k=0;k<6;k++){const outer=k%2===0,th0=k*Math.PI/3+(outer?0:.07),half=outer?.66:.6,tip=outer?main:main.clone().multiplyScalar(.9);
  parts.push(patch(10,16,(u,v,c)=>{const vv=v*((outer?1:.96)-.14*u*u);
   let r=R*Math.pow(Math.sin(Math.PI*(.08+.84*vv)),.7)+R*Math.max(0,vv-.78)*.9;r*=(outer?1.05:.97)*(1+.07*(1-u*u));
   const th=th0+u*half*(.62+.38*Math.sin(Math.PI*Math.min(1,vv*1.1)));
   c.copy(vv<.18?foot.clone().lerp(base,vv/.18):base.clone().lerp(tip,Math.pow((vv-.18)/.82,.6))).multiplyScalar((1-.08*Math.abs(u)*v)*(1-Math.pow(Math.abs(Math.cos(u*Math.PI*2.5)),18)*.06*(1-vv)));
   return [Math.sin(th)*r,H*vv,Math.cos(th)*r];}));}
 parts.push(clean(new THREE.CylinderGeometry(.0028,.0034,.026,8).translate(0,.016,0),C('#e6e2ae')));
 for(let k=0;k<6;k++){const a=k*Math.PI/3+.5;parts.push(ball(.0024,C('#3a2c33'),.7,1.8,.7,6,4).translate(Math.cos(a)*.0062,.022,Math.sin(a)*.0062));}
 return merge(parts);
}
/** Rose: one spiral of petals, each a little further out than the last (as on a real rose, so none cut through
 *  each other): a tight bud in the middle, cupped petals around it, the outer ones opening and rolling their edges back. */
export function roseHead(color='#d9798f'){
 const main=C(color),deep=main.clone().multiplyScalar(.72),light=main.clone().lerp(C('#f8dfe4'),.38),base=C('#f3ddca');const parts:Geo[]=[];const N=34;
 for(let k=0;k<N;k++){const t=k/(N-1),j=jitter(k,7);
  const r=.0045+.0195*Math.pow(t,.8),w=.0075+.0155*Math.pow(t,.7),len=.021+.018*Math.pow(t,.6);
  const tilt=.04+.86*Math.pow(t,1.7)+j*.06,cup=.62-.26*t,roll=.34*Math.pow(t,1.5),tip=-.06+.2*t;
  const inner=deep.clone().lerp(main,Math.min(1,t*1.3)),outer=main.clone().lerp(light,t);
  parts.push(place(petal({len:len*(1+j*.1),wid:w,cup,curl:.02,tipCurl:tip,roll,round:.42,widest:.72,notch:.025,teeth:1,segU:9,segV:10,veins:2.5},base.clone().lerp(inner,.62),outer,.1),k*2.39996,tilt,r,.012*(1-t)));}
 for(let k=0;k<5;k++)parts.push(place(petal({len:.028,wid:.0065,cup:.3,curl:.25,round:.8,segU:3,segV:6},C('#4b7a42'),C('#6f9a58'),0),k*1.2566+.3,2.0,.008,-.002));
 parts.push(ball(.0085,C('#5d8a4c'),1,.8,1,10,8).translate(0,-.003,0));
 return merge(parts);
}
/** Daisy: two layers of narrow white rays around a domed golden heart. */
export function daisyHead(){
 const parts:Geo[]=[];
 for(let layer=0;layer<2;layer++){const n=layer?17:19;for(let k=0;k<n;k++){const j=jitter(k,layer+3);
  parts.push(place(petal({len:.035*(1+j*.16),wid:.0064,cup:.3,curl:-.05,notch:.08,teeth:2,round:.85,segU:4,segV:7},C('#f2e8d8'),C('#ffffff'),.05),(k+layer*.5)*Math.PI*2/n,1.38-layer*.12+j*.08,.0095,layer*.0012));}}
 const dome=new THREE.SphereGeometry(.0128,28,12,0,Math.PI*2,0,Math.PI/2);dome.scale(1,.58,1);
 parts.push(clean(dome,(p,i)=>C('#d48f1c').lerp(C('#f4c63f'),Math.min(1,p.y/.0074*1.1)).multiplyScalar(.9+(Math.sin(i*2.399963*7)*.5+.5)*.18)).translate(0,.001,0));
 parts.push(clean(new THREE.CylinderGeometry(.012,.006,.005,16).translate(0,-.002,0),C('#6e9450')));
 return merge(parts);
}
/** Cosmos: eight broad petals with toothed tips, a deeper blush at their base, and a small golden heart. */
export function cosmosHead(color='#f0a7bd'){
 const main=C(color),base=main.clone().lerp(C('#b8336a'),.35);const parts:Geo[]=[];
 for(let k=0;k<8;k++)parts.push(place(petal({len:.046,wid:.019,cup:.16,curl:-.06,notch:.15,teeth:3,round:.42,widest:.78,segU:8,segV:8,veins:3.5},base,main,.05),k*Math.PI/4+jitter(k,9)*.1,1.25+jitter(k,4)*.12,.0085));
 parts.push(ball(.0085,C('#e3b53a'),1,.55,1,14,8).translate(0,.002,0));
 for(let k=0;k<14;k++){const a=k*2.39996,r=.004+(k%3)*.0012;parts.push(ball(.0012,C('#a26b16')).translate(Math.cos(a)*r,.0055,Math.sin(a)*r));}
 return merge(parts);
}
/** Hydrangea: a dome of small four-petalled florets in blues and lilacs. */
export function hydrangeaHead(color='#a9bfdc'){
 const parts:Geo[]=[];const palette=[C(color),C('#c3b2dc'),C('#cfdcee'),C('#9db3d4'),C('#b9c9e6')];const N=64;
 for(let i=0;i<N;i++){const t=(i+.5)/N,pol=Math.acos(1-t*1.2)*.92,az=i*2.39996;const n=new THREE.Vector3(Math.sin(pol)*Math.cos(az),Math.cos(pol),Math.sin(pol)*Math.sin(az));
  const col=palette[i%5].clone().multiplyScalar(.94+((i*37)%7)/60);const floret:Geo[]=[];
  for(let k=0;k<4;k++)floret.push(place(petal({len:.0105,wid:.0085,cup:.22,curl:-.04,round:.75,widest:.6,segU:4,segV:4},col.clone().lerp(C('#f2f0f6'),.25),col,.06),k*Math.PI/2+i*.7,1.38,.0012));
  floret.push(ball(.0013,C('#f4f0e8'),1,1,1,6,4));
  const f=merge(floret);q.setFromUnitVectors(Y,n);f.applyMatrix4(m4.compose(n.clone().multiplyScalar(.043).add(new THREE.Vector3(0,-.014,0)),q,new THREE.Vector3(1,1,1)));parts.push(f);}
 return merge(parts);
}
/** Frangipani: five thick petals turned like a pinwheel, golden at the heart. */
export function frangipaniHead(){
 const parts:Geo[]=[];for(let k=0;k<5;k++)parts.push(place(petal({len:.042,wid:.02,cup:.32,curl:-.05,tipCurl:-.05,round:.42,widest:.86,twist:.55,segU:9,segV:11},C('#f2bf45'),C('#fffaf0'),.05),k*Math.PI*2/5,1.0,.0045));
 parts.push(ball(.003,C('#e9b236'),1,.6,1,8,6).translate(0,.001,0));
 return merge(parts);
}
/** Bougainvillea: clusters of three papery, veined bracts around tiny white flowers, with a few leaves. */
export function bougainvilleaHead(color='#d64f8f'){
 const main=C(color),light=main.clone().lerp(C('#f6c2d8'),.35);const parts:Geo[]=[];
 const clusters:[number,number,number][]=[[0,0,0],[.024,-.012,.012],[-.022,-.01,.017],[.004,-.019,-.024],[-.012,-.024,-.008]];
 clusters.forEach(([x,y,z],ci)=>{for(let k=0;k<3;k++)parts.push(place(petal({len:.023,wid:.019,cup:.5,curl:-.04,round:.5,widest:.5,notch:.06,teeth:1,segU:6,segV:7,veins:3},main.clone().multiplyScalar(.82),light,.06),k*Math.PI*2/3+ci,.85,.002).translate(x,y,z));
  for(let k=0;k<3;k++){const a=k*Math.PI*2/3+ci+.5;parts.push(clean(new THREE.CylinderGeometry(.0009,.0011,.012,5).translate(Math.cos(a)*.002,.007,Math.sin(a)*.002),C('#f6efe3')).translate(x,y,z));parts.push(ball(.0018,C('#fffaf2'),1,.6,1,6,4).translate(x+Math.cos(a)*.002,y+.0135,z+Math.sin(a)*.002));}});
 for(let k=0;k<5;k++)parts.push(place(petal({len:.032,wid:.013,cup:.25,curl:-.1,round:.6,segU:4,segV:6,veins:1},C('#3f6b3c'),C('#5f8c4e'),0),k*1.257+.6,1.55,.013,-.024));
 return merge(parts);
}
/** Gypsophila: a spray of tiny white florets on fine, branching stems. */
export function gypsophilaHead(){
 const parts:Geo[]=[];const stem=C('#7d9a64'),white=C('#fbfbf6'),cream=C('#f0ede2');let seed=3;const rnd=()=>{seed=(seed*16807)%2147483647;return (seed-1)/2147483646;};
 const twig=(a:THREE.Vector3,b:THREE.Vector3,r:number)=>{const d=b.clone().sub(a);const g=new THREE.CylinderGeometry(r*.8,r,d.length(),4);g.translate(0,d.length()/2,0);q.setFromUnitVectors(Y,d.clone().normalize());g.applyQuaternion(q);g.translate(a.x,a.y,a.z);return clean(g,stem);};
 for(let b=0;b<6;b++){const a=b*1.05+rnd()*.3,len=.03+rnd()*.015,tip=new THREE.Vector3(Math.cos(a)*len*.7,len,Math.sin(a)*len*.7);parts.push(twig(new THREE.Vector3(),tip,.0011));
  for(let k=0;k<4;k++){const a2=a+(rnd()-.5)*1.6,l2=.012+rnd()*.01,end=tip.clone().add(new THREE.Vector3(Math.cos(a2)*l2*.8,l2*.8,Math.sin(a2)*l2*.8));parts.push(twig(tip,end,.0007));
   for(let f=0;f<5;f++){const o=new THREE.Vector3((rnd()-.5)*.009,(rnd()-.3)*.007,(rnd()-.5)*.009);parts.push(ball(.0022+rnd()*.0012,f%3?white:cream,1,1,1,6,4).translate(end.x+o.x,end.y+o.y,end.z+o.z));}}}
 return merge(parts);
}
/** Eucalyptus: pairs of round, silvery leaves along a twig, smaller toward the tip. */
export function eucalyptusHead(){
 const parts:Geo[]=[];const leaf=C('#9db8ab'),dark=C('#7c9a8c'),bloom=C('#c6d6cd');
 parts.push(clean(new THREE.CylinderGeometry(.0011,.0018,.13,5).translate(0,-.005,0),C('#8c7a68')));
 for(let k=0;k<6;k++){const y=-.055+k*.022,s=1-k*.11;for(const side of [0,1]){const a=k*1.2+side*Math.PI;
  const disc=petal({len:.03*s,wid:.017*s,cup:.22,round:.32,widest:.5,segU:6,segV:6},dark,leaf.clone().lerp(bloom,.3),.12);
  disc.translate(0,-.003,0);disc.applyMatrix4(m4.makeRotationX(Math.PI/2*.62));disc.applyMatrix4(m4.makeRotationY(a));disc.translate(0,y,0);parts.push(disc);}}
 return merge(parts);
}
const HEADS:Record<string,()=>Geo>={tulip:()=>tulipHead(),rose:()=>roseHead(),daisy:daisyHead,hydrangea:()=>hydrangeaHead(),cosmos:()=>cosmosHead(),frangipani:frangipaniHead,bougainvillea:()=>bougainvilleaHead(),gypsophila:gypsophilaHead,eucalyptus:eucalyptusHead};
const headCache=new Map<string,Geo>();
/** Shared head geometry per flower type (never disposed; there are only nine). */
export function headGeometry(type:string){if(!headCache.has(type))headCache.set(type,(HEADS[type]??HEADS.tulip)());return headCache.get(type)!;}

/** Where each stem goes: a domed spiral of heads, stems gathered at the binding point (origin) and splayed below. */
/** Flower heads are drawn at life size times this, so a hand-tied bouquet reads from a distance. */
export const HEAD_SCALE=1.6;
export interface StemPlace{type:string;head:THREE.Vector3;tilt:THREE.Quaternion;lean:number}
export function arrange(stems:string[]):StemPlace[]{
 const n=stems.length;const R=.06+.03*Math.sqrt(n);
 // Larger heads toward the middle, fillers to the rim.
 const order=stems.map((t,i)=>({t,i,w:t==='hydrangea'||t==='rose'?0:t==='gypsophila'||t==='eucalyptus'?2:1})).sort((a,b)=>a.w-b.w||a.i-b.i);
 return order.map((o,k)=>{const r=R*Math.sqrt((k+.4)/n)*(o.w===2?1.15:1),a=k*2.39996+.6;const h=.3-.11*(r/R)**2+(o.w===2?.025:0)+(o.t==='tulip'?.012:0);
  const head=new THREE.Vector3(Math.cos(a)*r,h,Math.sin(a)*r);const dir=head.clone().normalize();const tilt=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(dir.x*1.6,1,dir.z*1.6).normalize());
  return {type:o.t,head,tilt,lean:r/R};});
}
/** Stems: from below the binding, through it, up to each head; tulips get two long strap leaves. */
export function stemGeometry(p:StemPlace){
 const bottom=new THREE.Vector3(p.head.x*-.35,-.2,p.head.z*-.35),bind=new THREE.Vector3(p.head.x*.05,-.02,p.head.z*.05);
 const curve=new THREE.CatmullRomCurve3([bottom,bind,p.head.clone().multiplyScalar(.55).setY(p.head.y*.45),p.head.clone().setY(p.head.y-.004)]);
 const parts:Geo[]=[clean(new THREE.TubeGeometry(curve,14,p.type==='gypsophila'?.0018:.0032,5),(v)=>C('#6e9a54').lerp(C('#4f7a42'),THREE.MathUtils.clamp(-v.y*4,0,1)))];
 if(p.type==='rose'){for(const [t,side] of [[.42,1],[.6,-1]] as const){const at=curve.getPoint(t);const dir=Math.atan2(p.head.x,p.head.z)+side*1.4;
  for(let l=0;l<3;l++){const leaf=petal({len:.03-l*.004,wid:.014,cup:.35,curl:-.12,round:.5,widest:.45,notch:.03,teeth:6,segU:5,segV:6,veins:1},C('#3e6b3a'),C('#5d8a4b'),.05);
   leaf.applyMatrix4(m4.makeRotationX(.9+l*.15));leaf.applyMatrix4(m4.makeRotationY(dir+(l-1)*.7));leaf.translate(at.x,at.y,at.z);parts.push(leaf);}}}
 if(p.type==='daisy'||p.type==='cosmos'){const at=curve.getPoint(.45);const leaf=petal({len:.05,wid:.006,cup:.4,curl:-.15,round:.5,widest:.4,segU:3,segV:6},C('#4f7d48'),C('#76a061'),.05);leaf.applyMatrix4(m4.makeRotationX(.7));leaf.applyMatrix4(m4.makeRotationY(Math.atan2(p.head.x,p.head.z)+1.9));leaf.translate(at.x,at.y,at.z);parts.push(leaf);}
 if(p.type==='tulip'){for(const s of [-1,1]){const leaf=petal({len:.13,wid:.014,cup:.6,curl:-.18*s,round:.35,widest:.3,segU:4,segV:8},C('#4f7d48'),C('#7fa66a'),.05);leaf.applyMatrix4(m4.makeRotationY(s*1.2+Math.atan2(p.head.x,p.head.z)));const at=curve.getPoint(.35);leaf.translate(at.x,at.y-.02,at.z);parts.push(leaf);}}
 return merge(parts);
}
/** Wrapping paper: an inner tissue and an outer sheet, open and lower at the front so the flowers show. */
export function wrapGeometry(layer:0|1){
 const segA=56,segT=12,pos:number[]=[],idx:number[]=[];const flare=layer?.19:.17,tall=layer?.24:.2,base=layer?.03:.034;
 for(let j=0;j<=segT;j++){const t=j/segT;for(let i=0;i<=segA;i++){const a=i/segA*Math.PI*2;
  const front=.5+.5*Math.cos(a-Math.PI/2);  // 1 at +z (front), 0 at the back
  const top=tall*(1-.42*front)+.012*Math.sin(a*5+layer*1.3);const y=-.17+t*(top+.17);
  const r=(base+(flare-base)*Math.pow(t,1.25))*(1+.08*Math.sin(a*7+layer*2)*t)*(1+.05*(1-front));
  pos.push(Math.cos(a)*r,y,Math.sin(a)*r);}}
 for(let j=0;j<segT;j++)for(let i=0;i<segA;i++){const a=j*(segA+1)+i,b=a+1,c=a+segA+1,d=c+1;idx.push(a,c,b,b,c,d);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();return g;
}
/** Satin ribbon: a band around the binding and a bow with two tails. */
export function ribbonGeometry(){
 const parts:Geo[]=[];const white=C('#ffffff');
 const band=new THREE.TorusGeometry(.057,.007,6,40);band.rotateX(Math.PI/2);band.scale(1,1.6,1);band.translate(0,-.12,0);parts.push(clean(band,white));
 for(const s of [-1,1]){const loop=new THREE.TorusGeometry(.024,.006,6,24,Math.PI*1.7);loop.scale(1.2,.75,1);loop.rotateZ(s>0?-.4:Math.PI+.4);loop.translate(s*.03,-.112,.062);parts.push(clean(loop,white));
  const tail=petal({len:.075,wid:.008,cup:.3,curl:.1,notch:.25,round:.2,segU:3,segV:6},white,white,0);tail.applyMatrix4(m4.makeRotationZ(Math.PI+s*.35));tail.translate(s*.006,-.12,.064);parts.push(tail);}
 parts.push(ball(.009,white,1.2,1,1).translate(0,-.115,.064));
 return merge(parts.map(p=>p.attributes.color?p:clean(p,white)));
}
