import {useMemo,useRef} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import {useTexture} from '@react-three/drei';
import * as THREE from 'three';

// The diner's dishes, modelled after the real thing: a coconut chicken hotpot, coconut milk jelly in a coconut
// shell, glutinous-rice shaomai with salted egg yolk in a bamboo steamer, and a glass of milk.
// Sizes are in island units (a dinner plate is about .5 across); each dish sits on y = 0.

let seed=7;const rnd=()=>{seed=(seed*16807)%2147483647;return (seed-1)/2147483646;};
function lathe(profile:[number,number][],segments=40){return new THREE.LatheGeometry(profile.map(([r,h])=>new THREE.Vector2(r,h)),segments);}
/** A soft studio reflection used only by the dishes: steel, glaze, broth and glass need something to reflect. */
let dishEnv:THREE.Texture|null=null;
function useDishEnv(){const {gl}=useThree();return useMemo(()=>{if(!dishEnv){const pm=new THREE.PMREMGenerator(gl);dishEnv=pm.fromScene(new RoomEnvironment(),.04).texture;pm.dispose();}return dishEnv;},[gl]);}
/** An irregular rounded chunk (chicken, coconut meat), from a jittered sphere. */
function chunk(radius:number,stretch:[number,number,number],jitter=.18){const g=new THREE.SphereGeometry(radius,16,12);const p=g.attributes.position as THREE.BufferAttribute;
 for(let i=0;i<p.count;i++){const v=new THREE.Vector3().fromBufferAttribute(p,i);const k=1+(Math.sin(v.x*31+v.y*17)*.5+Math.sin(v.z*23-v.x*11)*.5)*jitter;v.multiplyScalar(k);v.set(v.x*stretch[0],v.y*stretch[1],v.z*stretch[2]);p.setXYZ(i,v.x,v.y,v.z);}
 g.computeVertexNormals();return g;}
const china=<meshPhysicalMaterial color="#fbf8f1" roughness={.18} clearcoat={.7} clearcoatRoughness={.25}/>;

function Steam({count=5,height=.5,width=.12,position=[0,0,0] as [number,number,number]}){
 const texture=useTexture('/textures/cloud.png');const group=useRef<THREE.Group>(null);
 useFrame(()=>{const g=group.current;if(!g)return;const t=performance.now()/1000;g.children.forEach((c,i)=>{const k=(t*.28+i/count)%1;c.position.set(Math.sin(k*5+i)*width*.4,k*height,Math.cos(k*4+i)*width*.3);c.scale.setScalar(width*(.5+k*1.4));((c as THREE.Sprite).material as THREE.SpriteMaterial).opacity=Math.sin(k*Math.PI)*.32;});});
 return <group ref={group} position={position}>{Array.from({length:count},(_,i)=><sprite key={i}><spriteMaterial map={texture} color="#ffffff" transparent depthWrite={false} opacity={0}/></sprite>)}</group>;
}

/** 椰子鸡: a steel hotpot of clear coconut-water broth with Wenchang chicken, coconut meat, red dates and goji. */
export function CoconutChicken(){
 const pieces=useMemo(()=>{seed=11;return {
  pot:lathe([[0,0],[.2,0],[.24,.012],[.27,.05],[.285,.11],[.29,.13],[.3,.135],[.29,.14],[.275,.135],[.272,.12],[.0,.12]]),
  chicken:Array.from({length:8},(_,i)=>{const a=i*2.4+rnd()*.5,r=.06+rnd()*.15;return {g:chunk(.045,[1.25,.7,1],.22),p:[Math.cos(a)*r,.118+rnd()*.012,Math.sin(a)*r] as [number,number,number],ry:rnd()*6,skin:rnd()>.35};}),
  coconut:Array.from({length:5},(_,i)=>{const a=i*1.3+1.1,r=.1+rnd()*.12;return {p:[Math.cos(a)*r,.122,Math.sin(a)*r] as [number,number,number],ry:rnd()*6};}),
  dates:Array.from({length:5},(_,i)=>{const a=i*1.9+.4,r=.08+rnd()*.15;return [Math.cos(a)*r,.122,Math.sin(a)*r] as [number,number,number];}),
  goji:Array.from({length:12},()=>{const a=rnd()*6.28,r=rnd()*.24;return [Math.cos(a)*r,.121,Math.sin(a)*r] as [number,number,number];}),
  onion:Array.from({length:10},()=>{const a=rnd()*6.28,r=rnd()*.22;return [Math.cos(a)*r,.121,Math.sin(a)*r] as [number,number,number];}),
 };},[]);
 const skinGeo=useMemo(()=>chunk(.045,[1.25,.7,1],.22),[]);const dipDish=useMemo(()=>lathe([[0,0],[.05,0],[.065,.03],[.07,.034],[.0,.03]]),[]);
 return <group>
  {/* Burner ring under the pot. */}
  <mesh position={[0,.012,0]}><cylinderGeometry args={[.2,.22,.024,32]}/><meshStandardMaterial color="#3a3d3c" metalness={.6} roughness={.45}/></mesh>
  <mesh geometry={pieces.pot} position={[0,.024,0]} castShadow><meshStandardMaterial color="#d9dcd8" metalness={.7} roughness={.3} side={THREE.DoubleSide}/></mesh>
  {[-1,1].map(s=><mesh key={s} position={[s*.305,.14,0]} rotation={[Math.PI/2,0,0]}><torusGeometry args={[.03,.008,8,16,Math.PI]}/><meshStandardMaterial color="#bfc3bf" metalness={.85} roughness={.3}/></mesh>)}
  {/* Broth: clear and slightly milky, with a glossy surface. */}
  <mesh position={[0,.142,0]} rotation={[-Math.PI/2,0,0]}><circleGeometry args={[.272,48]}/><meshPhysicalMaterial color="#ead39d" roughness={.3} clearcoat={.6} clearcoatRoughness={.1} envMapIntensity={.3}/></mesh>
  <group position={[0,.024,0]}>
   {pieces.chicken.map((c,i)=><mesh key={i} geometry={c.skin?skinGeo:c.g} position={c.p} rotation={[.2,c.ry,.1]}><meshPhysicalMaterial color={c.skin?'#efcd8a':'#f6ead0'} roughness={c.skin?.35:.6} clearcoat={c.skin?.6:.1}/></mesh>)}
   {pieces.coconut.map((c,i)=><mesh key={i} position={c.p} rotation={[-.1,c.ry,.08]}><boxGeometry args={[.11,.012,.026]}/><meshStandardMaterial color="#fdfbf4" roughness={.5}/></mesh>)}
   {pieces.dates.map((p,i)=><mesh key={i} position={p} scale={[.022,.016,.016]}><sphereGeometry args={[1,12,8]}/><meshPhysicalMaterial color="#8b2a26" roughness={.45} clearcoat={.4}/></mesh>)}
   {pieces.goji.map((p,i)=><mesh key={i} position={p} scale={[.009,.006,.006]} rotation={[0,i,0]}><sphereGeometry args={[1,8,6]}/><meshStandardMaterial color="#e2502c" roughness={.4}/></mesh>)}
   {pieces.onion.map((p,i)=><mesh key={i} position={p} rotation={[Math.PI/2,0,i]}><cylinderGeometry args={[.006,.006,.012,8,1,true]}/><meshStandardMaterial color="#6ea94f" side={THREE.DoubleSide}/></mesh>)}
  </group>
  <Steam position={[0,.16,0]} height={.55} width={.16} count={6}/>
  {/* Dip: 沙姜 and lime in a small white dish, half a lime beside it. */}
  <group position={[.42,0,.12]}>
   <mesh geometry={dipDish}>{china}</mesh>
   <mesh position={[0,.029,0]} rotation={[-Math.PI/2,0,0]}><circleGeometry args={[.058,24]}/><meshStandardMaterial color="#7b4a23" roughness={.2}/></mesh>
   {[0,1,2,3,4].map(i=><mesh key={i} position={[Math.cos(i*1.3)*.03,.032,Math.sin(i*1.3)*.03]} scale={[.008,.003,.008]}><sphereGeometry args={[1,6,4]}/><meshStandardMaterial color={i%2?'#e04a2a':'#9fc35a'}/></mesh>)}
   <mesh position={[.07,.02,-.07]} rotation={[0,0,Math.PI/2]} scale={[1,.9,1]}><sphereGeometry args={[.03,16,10,0,Math.PI]}/><meshStandardMaterial color="#9cc24a" roughness={.5}/></mesh>
  </group>
  {/* A young coconut with a straw. */}
  <group position={[-.43,0,-.1]}>
   <mesh position={[0,.1,0]} scale={[1,1.05,1]} castShadow><sphereGeometry args={[.1,20,14]}/><meshStandardMaterial color="#9fae5d" roughness={.65}/></mesh>
   <mesh position={[0,.19,0]}><cylinderGeometry args={[.045,.06,.04,16]}/><meshStandardMaterial color="#efe6cf" roughness={.6}/></mesh>
   <mesh position={[.02,.27,0]} rotation={[0,0,-.18]}><cylinderGeometry args={[.006,.006,.2,8]}/><meshStandardMaterial color="#e891a7"/></mesh>
  </group>
 </group>;
}

/** 椰奶冻: set coconut milk cut into cubes, served in half a coconut shell. */
export function CoconutJelly(){
 const shell=useMemo(()=>lathe([[0,0],[.06,.0],[.13,.03],[.165,.08],[.175,.13],[.17,.15],[.16,.15],[.155,.135],[.145,.09],[.11,.045],[.0,.04]]),[]);
 const cubes=useMemo(()=>{const out:[number,number,number][]=[];for(let x=-1;x<=1;x++)for(let z=-1;z<=1;z++)out.push([x*.066,.118-Math.abs(x*z)*.006,z*.066]);return out;},[]);
 const fibre=useMemo(()=>{const c=document.createElement('canvas');c.width=128;c.height=128;const g=c.getContext('2d')!;g.fillStyle='#6d4a2c';g.fillRect(0,0,128,128);for(let i=0;i<260;i++){g.strokeStyle=['#5b3c22','#7f5a37','#4c311b'][i%3];g.lineWidth=1+Math.random()*1.5;g.beginPath();const x=Math.random()*128,y=Math.random()*128;g.moveTo(x,y);g.lineTo(x+(Math.random()-.5)*18,y+10+Math.random()*16);g.stroke();}const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(3,1);return t;},[]);
 return <group>
  <mesh position={[0,.012,0]}><cylinderGeometry args={[.19,.2,.012,32]}/>{china}</mesh>
  <group position={[0,.018,0]}>
   <mesh geometry={shell} castShadow><meshStandardMaterial map={fibre} roughness={.9} side={THREE.FrontSide}/></mesh>
   {/* The white flesh lining the rim. */}
   <mesh position={[0,.148,0]} rotation={[Math.PI/2,0,0]}><torusGeometry args={[.163,.007,8,40]}/><meshStandardMaterial color="#f7f2e6" roughness={.6}/></mesh>
   {cubes.map((p,i)=><mesh key={i} position={p} castShadow><boxGeometry args={[.06,.05,.06]}/><meshPhysicalMaterial color="#fffdf8" roughness={.2} clearcoat={1} clearcoatRoughness={.12} sheen={.5} sheenColor="#ffffff"/></mesh>)}
   {[0,1,2,3,4,5].map(i=><mesh key={i} position={[Math.cos(i*1.1)*.05,.147,Math.sin(i*1.7)*.05]} rotation={[0,i,0]}><boxGeometry args={[.018,.003,.004]}/><meshStandardMaterial color="#ffffff"/></mesh>)}
  </group>
  <mesh position={[.2,.015,.05]} rotation={[0,-.5,0]}><boxGeometry args={[.025,.006,.16]}/><meshStandardMaterial color="#c9b28b" metalness={.4} roughness={.35}/></mesh>
 </group>;
}

/** 咸蛋黄烧卖: four glutinous-rice shaomai with frilled open tops and salted egg yolk, in a bamboo steamer. */
export function Shaomai(){
 const body=useMemo(()=>{const g=lathe([[0,0],[.042,0],[.052,.02],[.055,.05],[.05,.075],[.038,.095],[.034,.104],[.044,.116],[.056,.122],[.058,.124]],36);
  // Pleats: the wrapper gathers in folds that open into a frill at the top.
  const p=g.attributes.position as THREE.BufferAttribute;for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i);const a=Math.atan2(z,x);const k=1+Math.sin(a*16)*.06*THREE.MathUtils.smoothstep(y,.06,.124)+Math.sin(a*16)*.015;p.setX(i,x*k);p.setZ(i,z*k);p.setY(i,y+Math.sin(a*16)*.004*THREE.MathUtils.smoothstep(y,.1,.124));}
  g.computeVertexNormals();return g;},[]);
 const grains=useMemo(()=>{seed=29;return Array.from({length:14},()=>{const a=rnd()*6.28,r=rnd()*.028;return [Math.cos(a)*r,.112+rnd()*.008,Math.sin(a)*r] as [number,number,number];});},[]);
 const slats=useMemo(()=>{const c=document.createElement('canvas');c.width=128;c.height=32;const g=c.getContext('2d')!;for(let x=0;x<128;x+=8){g.fillStyle=x%16?'#d8b67a':'#caa465';g.fillRect(x,0,8,32);}g.fillStyle='#b48d50';g.fillRect(0,0,128,3);g.fillRect(0,29,128,3);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=THREE.RepeatWrapping;t.repeat.set(6,1);return t;},[]);
 return <group>
  {/* Bamboo steamer with a paper liner. */}
  <mesh position={[0,.045,0]} castShadow><cylinderGeometry args={[.21,.21,.09,40,1,true]}/><meshStandardMaterial map={slats} roughness={.8} side={THREE.DoubleSide}/></mesh>
  <mesh position={[0,.012,0]}><cylinderGeometry args={[.205,.205,.012,40]}/><meshStandardMaterial color="#cfac6f" roughness={.85}/></mesh>
  <mesh position={[0,.02,0]} rotation={[-Math.PI/2,0,0]}><circleGeometry args={[.19,40]}/><meshStandardMaterial color="#f3ead6" roughness={.9}/></mesh>
  {[[-.07,-.06],[.07,-.06],[-.07,.07],[.07,.07]].map(([x,z],i)=><group key={i} position={[x,.02,z]} rotation={[0,i*.7,0]} scale={1.08}>
   <mesh geometry={body} castShadow><meshPhysicalMaterial color="#f1e8cf" roughness={.38} clearcoat={.3} sheen={.6} sheenColor="#fff6dc" side={THREE.DoubleSide}/></mesh>
   {/* Soy-glazed glutinous rice showing in the open top, crowned with crumbled salted egg yolk. */}
   <mesh position={[0,.108,0]} rotation={[-Math.PI/2,0,0]}><circleGeometry args={[.036,20]}/><meshStandardMaterial color="#a7743f" roughness={.55}/></mesh>
   {grains.map((g,k)=><mesh key={k} position={g} scale={[.006,.003,.004]} rotation={[0,k,0]}><sphereGeometry args={[1,6,4]}/><meshStandardMaterial color="#b9844b" roughness={.4}/></mesh>)}
   <mesh position={[0,.122,0]} scale={[.022,.014,.022]}><icosahedronGeometry args={[1,1]}/><meshPhysicalMaterial color="#ee8a1f" roughness={.5} clearcoat={.3}/></mesh>
   {[0,1,2].map(k=><mesh key={k} position={[Math.cos(k*2.1)*.016,.118,Math.sin(k*2.1)*.016]} scale={.006}><icosahedronGeometry args={[1,0]}/><meshStandardMaterial color="#f29b2e"/></mesh>)}
  </group>)}
  <Steam position={[0,.16,0]} height={.4} width={.11} count={4}/>
 </group>;
}

/** 牛奶: a straight glass tumbler of milk. */
export function MilkGlass(){
 const glass=useMemo(()=>lathe([[0,0],[.052,0],[.056,.004],[.062,.2],[.058,.2],[.054,.008],[0,.008]],32),[]);
 return <group>
  <mesh position={[0,.02,0]}><cylinderGeometry args={[.075,.075,.008,24]}/><meshStandardMaterial color="#d7c3a0" roughness={.8}/></mesh>
  <mesh geometry={glass} position={[0,.024,0]}><meshPhysicalMaterial color="#ffffff" roughness={.04} transparent opacity={.28} clearcoat={1} side={THREE.DoubleSide} depthWrite={false}/></mesh>
  <mesh position={[0,.024+.085,0]}><cylinderGeometry args={[.0565,.0525,.155,28]}/><meshPhysicalMaterial color="#fbf8f0" roughness={.35} sheen={.5} sheenColor="#ffffff"/></mesh>
  <mesh position={[0,.024+.163,0]} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[.05,.0575,28]}/><meshStandardMaterial color="#ffffff" roughness={.2}/></mesh>
 </group>;
}

export function Dish({kind}:{kind:string}){
 const env=useDishEnv();const group=useRef<THREE.Group>(null);
 // Hand the studio reflection to every material of the dish once it is mounted.
 useFrame(()=>{const g=group.current;if(!g||g.userData.env)return;g.traverse(o=>{const m=(o as THREE.Mesh).material as THREE.MeshStandardMaterial|undefined;if(m&&'envMap' in m&&!(m instanceof THREE.SpriteMaterial)){m.envMap=env;m.envMapIntensity=.55;m.needsUpdate=true;}});g.userData.env=true;});
 return <group ref={group}>{kind==='bowl'?<CoconutChicken/>:kind==='jelly'?<CoconutJelly/>:kind==='dumpling'?<Shaomai/>:kind==='milk'?<MilkGlass/>:null}</group>;}
