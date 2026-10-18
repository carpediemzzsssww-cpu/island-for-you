import {useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import {useTexture} from '@react-three/drei';
import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {useIsland} from '../store';
import {menu} from '../content';
import {chime} from '../lib/audio';

type Vec3=[number,number,number];
type Surface='ceramic'|'matte'|'metal'|'glass';
type Parts=Partial<Record<Surface,THREE.BufferGeometry>>;
const cache=new Map<string,Parts>();
const surfaces:Record<Surface,THREE.MeshStandardMaterial>= {
 ceramic:new THREE.MeshStandardMaterial({vertexColors:true,roughness:.3}),
 matte:new THREE.MeshStandardMaterial({vertexColors:true,roughness:.78}),
 metal:new THREE.MeshStandardMaterial({vertexColors:true,metalness:.35,roughness:.28}),
 glass:new THREE.MeshStandardMaterial({vertexColors:true,roughness:.12,transparent:true,opacity:.25,depthWrite:false}),
};
const lathe=(profile:number[][],segments=32)=>new THREE.LatheGeometry(profile.map(([x,y])=>new THREE.Vector2(x,y)),segments);

/** Bake coloured ingredients into at most four draws per dish. The shared cache
 * survives leaving the diner; no canvas textures, per-ingredient materials or PMREM. */
export function dishGeometry(kind:string):Parts {
 if(cache.has(kind))return cache.get(kind)!;
 const buckets:Record<Surface,THREE.BufferGeometry[]>={ceramic:[],matte:[],metal:[],glass:[]};
 const add=(g:THREE.BufferGeometry,color:string,p:Vec3=[0,0,0],scale:Vec3=[1,1,1],rot:Vec3=[0,0,0],surface:Surface='ceramic')=>{
  g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...p),new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)),new THREE.Vector3(...scale)));
  const geom=g.index?g.toNonIndexed():g; if(geom!==g)g.dispose();geom.deleteAttribute('uv');
  const c=new THREE.Color(color),colors=new Float32Array(geom.attributes.position.count*3);
  for(let i=0;i<colors.length;i+=3){colors[i]=c.r;colors[i+1]=c.g;colors[i+2]=c.b;}
  geom.setAttribute('color',new THREE.BufferAttribute(colors,3));buckets[surface].push(geom);
 };
 const sphere=(p:Vec3,size:Vec3,c:string,rot:Vec3=[0,0,0],surface:Surface='ceramic')=>add(new THREE.SphereGeometry(1,12,8),c,p,size,rot,surface);
 const box=(p:Vec3,size:Vec3,c:string,rot:Vec3=[0,0,0],surface:Surface='matte')=>add(new THREE.BoxGeometry(...size),c,p,[1,1,1],rot,surface);
 const ring=(r:number,y:number,c:string,t=.005,surface:Surface='ceramic')=>add(new THREE.TorusGeometry(r,t,5,32),c,[0,y,0],[1,1,1],[Math.PI/2,0,0],surface);
 const plate=(r:number)=>{add(lathe([[0,0],[r*.72,0],[r,.025],[r,.035],[r*.75,.012],[0,.012]]),'#f5edda');ring(r-.012,.032,'#76968a',.003);};
 if(kind==='bowl'){
  add(new THREE.CylinderGeometry(.2,.215,.025,24),'#40544d',[0,.018,0],[1,1,1],[0,0,0],'matte');
  add(lathe([[0,0],[.19,0],[.25,.035],[.283,.1],[.29,.139],[.279,.144],[.27,.132],[.26,.065],[0,.04]]),'#c7d1ca',[0,.03,0],[1,1,1],[0,0,0],'metal');
  ring(.284,.17,'#e3e8dc',.007,'metal');
  for(const side of [-1,1])add(new THREE.TorusGeometry(.035,.008,5,16),'#687e73',[side*.304,.142,0],[1,1,1],[0,Math.PI/2,0],'metal');
  add(new THREE.CylinderGeometry(.266,.266,.008,32),'#eadbb3',[0,.154,0]);
  // Irregular golden chicken, white coconut, dates and scallions break the soup's surface.
  for(let i=0;i<7;i++){const a=i*2.399,r=.08+(i%3)*.05; sphere([Math.cos(a)*r,.17,Math.sin(a)*r],[.049,.024,.032],i%2?'#e7c993':'#f6e6bc',[0,a,.15]);}
  for(let i=0;i<5;i++){const a=i*1.3+.5;box([Math.cos(a)*.18,.17,Math.sin(a)*.18],[.085,.014,.026],'#fff8e9',[.1,a,.1],'ceramic');}
  for(let i=0;i<4;i++){const a=i*1.8+.2;sphere([Math.cos(a)*.15,.172,Math.sin(a)*.15],[.019,.012,.025],'#963f32',[0,a,0]);}
  for(let i=0;i<10;i++){const a=i*2.4,r=.07+(i%4)*.048;box([Math.cos(a)*r,.184,Math.sin(a)*r],[.016,.004,.007],i%3?'#7fa15a':'#d67540',[0,a,0]);}
  // Saucer, chopped dipping sauce and a cut lime, all part of the same batches.
  add(lathe([[0,0],[.052,0],[.075,.022],[.07,.03],[.058,.02],[0,.015]],20),'#f4e8cf',[.39,.008,.17]);
  add(new THREE.CylinderGeometry(.058,.058,.003,20),'#97673f',[.39,.03,.17]);
  for(let i=0;i<5;i++)box([.39+Math.cos(i*2.4)*.03,.034,.17+Math.sin(i*2.4)*.03],[.012,.004,.01],i%2?'#a4b77b':'#ca6b3c');
  sphere([.38,.03,.04],[.037,.023,.035],'#96ab60');
  // Young coconut with a trimmed cream crown and a bent paper straw.
  sphere([-.4,.105,-.08],[.092,.105,.092],'#b1bc77',[0,0,0],'matte');
  add(new THREE.CylinderGeometry(.042,.072,.045,16),'#eee4c8',[-.4,.194,-.08]);
  box([-.39,.27,-.08],[.01,.14,.01],'#cd8f91',[0,0,-.12]);box([-.37,.337,-.08],[.045,.01,.01],'#cd8f91',[0,0,-.25]);
 } else if(kind==='jelly'){
  plate(.213);
  add(lathe([[0,0],[.065,0],[.135,.035],[.166,.085],[.178,.146],[.168,.156],[.157,.14],[.14,.08],[.08,.035],[0,.03]]),'#946c49',[0,.03,0],[1,1,1],[0,0,0],'matte');
  ring(.164,.181,'#f6edce',.009);
  // Small facets read as coconut fibres without an extra texture or draw call.
  for(let i=0;i<16;i++){const a=i*Math.PI/8;box([Math.sin(a)*.159,.13,Math.cos(a)*.159],[.003,.06,.004],i%2?'#a47c55':'#785538',[.12*Math.sin(a),a,.12*Math.cos(a)]);}
  for(let x=-1;x<=1;x++)for(let z=-1;z<=1;z++)box([x*.063,.157,z*.063],[.057,.049,.057],(x+z)%2?'#fff9e8':'#f4eedc',[0,(x-z)*.035,0],'ceramic');
  for(let i=0;i<5;i++)box([Math.sin(i*2)*.06,.185,Math.cos(i*2)*.06],[.028,.003,.006],'#fffdf2',[0,i,0],'ceramic');
  sphere([.046,.189,-.05],[.025,.004,.012],'#7e9e65',[0,.4,0],'matte');
  box([.22,.035,.02],[.016,.009,.19],'#bea77e',[0,-.3,0]);sphere([.245,.035,-.068],[.028,.005,.04],'#bea77e');
 } else if(kind==='dumpling'){
  add(lathe([[0,0],[.22,0],[.22,.08],[.211,.09],[.204,.08],[.204,.014],[0,.014]]),'#c8a26b',[0,.02,0],[1,1,1],[0,0,0],'matte');
  add(new THREE.CylinderGeometry(.203,.203,.006,32),'#f2e7cd',[0,.04,0]);
  ring(.215,.032,'#ab8553',.006,'matte');ring(.215,.104,'#e2c18c',.007,'matte');
  for(let i=0;i<24;i++){const a=i*Math.PI/12;box([Math.sin(a)*.218,.07,Math.cos(a)*.218],[.002,.048,.003],'#b38b56',[0,a,0]);}
  for(let i=0;i<4;i++){
   const x=i%2?.075:-.075,z=i<2?-.07:.075;
   const wrapper=lathe([[0,0],[.043,0],[.054,.035],[.05,.068],[.035,.092],[.047,.112],[.06,.119]],32);
   const p=wrapper.attributes.position as THREE.BufferAttribute;
   for(let k=0;k<p.count;k++){const a=Math.atan2(p.getZ(k),p.getX(k)),y=p.getY(k),f=1+Math.sin(a*12)*(.025+y*.85);p.setXYZ(k,p.getX(k)*f,y+Math.sin(a*12)*.003*(y/.12),p.getZ(k)*f);}wrapper.computeVertexNormals();
   add(wrapper,'#efe1bc',[x,.044,z]);
   add(new THREE.CylinderGeometry(.036,.036,.005,16),'#9f7542',[x,.15,z]);
   for(let j=0;j<9;j++){const a=j*2.4,r=j%3*.012;sphere([x+Math.cos(a)*r,.157,z+Math.sin(a)*r],[.006,.0035,.009],j%2?'#c39758':'#b3844b',[0,a,0]);}
   add(new THREE.IcosahedronGeometry(.023,1),'#eca13d',[x,.174,z],[1,.65,1]);
   for(let j=0;j<3;j++)add(new THREE.IcosahedronGeometry(.006,0),'#f3b751',[x+Math.cos(j*2.1)*.02,.163,z+Math.sin(j*2.1)*.02]);
  }
 } else if(kind==='milk'){
  add(new THREE.CylinderGeometry(.085,.085,.009,24),'#c5a479',[0,.012,0],[1,1,1],[0,0,0],'matte');
  add(lathe([[0,0],[.055,0],[.061,.007],[.066,.208],[.059,.208],[.054,.012],[0,.012]]),'#e9f3e8',[0,.02,0],[1,1,1],[0,0,0],'glass');
  add(new THREE.CylinderGeometry(.059,.054,.155,24),'#f7f0db',[0,.108,0]);
  ring(.063,.23,'#e3ece2',.003);
  for(let i=0;i<7;i++){const a=i*2.4;sphere([Math.cos(a)*.04,.188,Math.sin(a)*.04],[.004,.0015,.004],'#fffbed');}
  box([.03,.123,.058],[.004,.15,.002],'#ffffff',[0,0,-.02],'glass');
 }
 const baked:Parts={};for(const surface of Object.keys(buckets) as Surface[]){const parts=buckets[surface];if(parts.length){baked[surface]=mergeGeometries(parts,false)!;parts.forEach(g=>g.dispose());}}
 cache.set(kind,baked);return baked;
}

function Steam(){
 const texture=useTexture('/textures/cloud.png'),ref=useRef<THREE.Group>(null);
 useFrame(()=>{if(!ref.current||document.hidden)return;const t=performance.now()/1000;ref.current.children.forEach((o,i)=>{const k=(t*.36+i/3)%1;o.position.set(Math.sin(k*4+i)*.035,k*.34,Math.cos(k*3+i)*.025);o.scale.setScalar(.07+k*.12);((o as THREE.Sprite).material as THREE.SpriteMaterial).opacity=Math.sin(k*Math.PI)*.23;});});
 return <group ref={ref} position={[0,.19,0]}>{[0,1,2].map(i=><sprite key={i}><spriteMaterial map={texture} color="#fff5df" transparent opacity={0} depthWrite={false}/></sprite>)}</group>;
}
export default function Dish({kind,position}:{kind:string;position:Vec3}){
 const parts=dishGeometry(kind),group=useRef<THREE.Group>(null),tapAt=useRef(-Infinity),reduced=useIsland(s=>s.save.settings.reducedMotion);
 useFrame(()=>{if(!group.current)return;const t=(performance.now()-tapAt.current)/1000;if(t>1){group.current.scale.set(1,1,1);return;}const k=Math.sin(t*18)*Math.exp(-t*5)*.07;group.current.scale.set(1+k,1-k,1+k);});
 return <group position={position} ref={group} onClick={e=>{if(e.delta>8)return;e.stopPropagation();const dish=menu.find(m=>m.kind===kind);if(!dish)return;if(!reduced)tapAt.current=performance.now();chime();useIsland.getState().notify(dish.note);}}>
  {(Object.keys(parts) as Surface[]).map(surface=><mesh key={surface} geometry={parts[surface]} material={surfaces[surface]} dispose={null}/>)}
  {!reduced&&(kind==='bowl'||kind==='dumpling')&&<Steam/>}
 </group>;
}
