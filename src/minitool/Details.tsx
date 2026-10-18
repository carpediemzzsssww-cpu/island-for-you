import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';

type V=[number,number,number];
/** Small solid details retain their silhouette and normals, but share one draw. */
export function detailBatch(){
 const parts:THREE.BufferGeometry[]=[];
 const add=(g:THREE.BufferGeometry,color:string,p:V=[0,0,0],s:V=[1,1,1],r:V=[0,0,0])=>{
  g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...p),new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)),new THREE.Vector3(...s)));
  const q=g.index?g.toNonIndexed():g;if(q!==g)g.dispose();q.deleteAttribute('uv');
  const c=new THREE.Color(color),colors=new Float32Array(q.attributes.position.count*3);
  for(let i=0;i<colors.length;i+=3)colors.set([c.r,c.g,c.b],i);
  q.setAttribute('color',new THREE.BufferAttribute(colors,3));parts.push(q);
 };
 return {add,
  sphere:(p:V,s:V,c:string,r:V=[0,0,0])=>add(new THREE.SphereGeometry(1,10,6),c,p,s,r),
  box:(p:V,s:V,c:string,r:V=[0,0,0])=>add(new THREE.BoxGeometry(...s),c,p,[1,1,1],r),
  rod:(a:V,b:V,r:number,c:string)=>{const from=new THREE.Vector3(...a),to=new THREE.Vector3(...b),d=to.clone().sub(from);const g=new THREE.CylinderGeometry(r,r,d.length(),8);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize()));add(g,c,from.add(to).multiplyScalar(.5).toArray() as V);},
  lathe:(profile:number[][],c:string,p:V=[0,0,0],segments=40)=>add(new THREE.LatheGeometry(profile.map(([r,y])=>new THREE.Vector2(r,y)),segments),c,p),
  finish:()=>{const g=mergeGeometries(parts,false)!;parts.forEach(p=>p.dispose());return g;},
 };
}

// Four little carousel horses: body, neck, muzzle, mane, saddle and legs stay
// connected. Their poles turn with the horses instead of leaving floating ovals.
let horses:THREE.BufferGeometry;
export function carouselGeometry(){if(horses)return horses;
 for(let i=0;i<4;i++){
  const a=i*Math.PI/2,x=Math.cos(a)*.63,z=Math.sin(a)*.63;
  const h=detailBatch(),coat=i%2?'#e4c5aa':'#f6ead5',mane=i%2?'#805e51':'#b48c70';
  h.sphere([0,0,0],[.22,.105,.087],coat);
  h.sphere([.15,.115,0],[.075,.14,.065],coat,[0,0,.35]);
  h.sphere([.215,.19,0],[.095,.049,.054],coat,[0,0,-.3]);
  for(const side of [-1,1]){h.sphere([.16,.256,side*.034],[.021,.048,.017],coat,[0,0,.2]);h.sphere([.207,.222,side*.05],[.008,.008,.004],'#524638');}
  h.sphere([.095,.15,0],[.035,.123,.07],mane,[0,0,.4]);h.sphere([-.245,-.045,0],[.105,.035,.035],mane,[0,0,.75]);
  h.sphere([-.025,.085,0],[.09,.023,.1],i%2?'#bd8b8d':'#81a29b');
  for(const xx of [-.13,.13])for(const zz of [-.06,.06]){h.rod([xx,-.06,zz],[xx+(xx>0?.035:-.04),-.24,zz],.02,coat);h.sphere([xx+(xx>0?.035:-.04),-.24,zz],[.027,.025,.024],mane);}
  h.rod([0,-.33,0],[0,.9,0],.012,'#c9ad72');
  // Preserve the existing batched vertex colours while placing each horse.
  const g=h.finish();g.rotateY(-a-Math.PI/2);g.translate(x,0,z);
  if(!horses)horses=g;else{const merged=mergeGeometries([horses,g],false)!;horses.dispose();g.dispose();horses=merged;}
 }
 return horses;
}

let supports:THREE.BufferGeometry;
export function furnitureGeometry(){if(supports)return supports;const b=detailBatch();
 // Interactive tables replace the web furniture: a top also needs legs and rails.
 for(const [x,z,top,w,d,color] of [[-4.3,3.65,1.67,1.8,.75,'#a78762'],[3.6,4,1.68,1.85,.95,'#92714f'],[0,5.4,1.76,3.7,1.2,'#b59a73']] as [number,number,number,number,number,string][]){
  const floor=1.14,h=top-floor,dx=w/2-.12,dz=d/2-.09;
  for(const sx of [-1,1])for(const sz of [-1,1])b.box([x+sx*dx,floor+h/2,z+sz*dz],[.075,h,.075],color);
  for(const side of [-1,1]){b.box([x,top-.07,z+side*dz],[w-.18,.12,.045],color);b.box([x+side*dx,top-.07,z],[.045,.12,d-.12],color);}
 }
 b.rod([-2.05,1.91,1.7],[-2.05,2.02,1.7],.014,'#39554a');
 b.rod([-1.68,1.68,1.7],[-1.6,2.08,1.7],.015,'#39554a');
 b.rod([-1.6,2.08,1.56],[-1.6,2.08,1.84],.015,'#39554a');
 supports=b.finish();return supports;
}
