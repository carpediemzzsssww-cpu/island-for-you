import {useEffect,useRef,useState} from 'react';
import {useFrame} from '@react-three/fiber';
import {useTexture} from '@react-three/drei';
import * as THREE from 'three';
import {plop,rustle,bell,knock,sparkleSound,paperSound,chime} from '../lib/audio';
import {useIsland} from '../store';

// Small answers to a tap anywhere on the island: water rings, a shaken tree and falling leaves, petals, a puff of
// sand, a knock on a wall, a bicycle bell, a letter from the post box, a fish, a shooting star at night.
// `pokeAt` decides what was touched from where and what the tap hit; <Pokes/> draws the effects.

export type PokeKind='water'|'leaves'|'petals'|'grass'|'sand'|'wall'|'bell'|'letter'|'light'|'star'|'glint';
interface Poke{id:number;kind:PokeKind;at:THREE.Vector3;t0:number;seed:number}
const bus=new EventTarget();let nextId=1;
/** Shared with the foliage shader patch (World.tsx): the last tap position and time, so nearby leaves shake. */
export const shake={value:new THREE.Vector4(0,-99,0,-99)};
export function poke(kind:PokeKind,at:THREE.Vector3){
 const p:Poke={id:nextId++,kind,at:at.clone(),t0:performance.now()/1000,seed:Math.random()};bus.dispatchEvent(new CustomEvent('poke',{detail:p}));
 if(import.meta.env.DEV)((window as any).__pokes??=[]).push(kind);
 if(kind==='leaves'||kind==='petals')shake.value.set(at.x,at.y,at.z,p.t0);
 ({water:plop,leaves:rustle,petals:()=>{rustle();sparkleSound();},grass:sparkleSound,sand:()=>{},wall:knock,bell,letter:paperSound,light:chime,star:sparkleSound,glint:()=>{}} as Record<PokeKind,()=>void>)[kind]();
}
// Landmarks that answer in their own way (positions from scripts/build_island.py).
const BICYCLE=new THREE.Vector3(-2.05,1.6,1.7),POSTBOX=new THREE.Vector3(1.9,1.6,3.6),LIGHTHOUSE=new THREE.Vector3(0,4.2,-8.5),BEACH=new THREE.Vector3(-6.7,.9,7.9);
/** Decide what a tap on island geometry means. `material` is the hit material's name, `normal` the world normal. */
export function pokeAt(point:THREE.Vector3,normal:THREE.Vector3|null,material:string){
 if(point.distanceTo(BICYCLE)<.6)return poke('bell',point);
 if(point.distanceTo(POSTBOX)<.5)return poke('letter',point);
 if(Math.hypot(point.x-LIGHTHOUSE.x,point.z-LIGHTHOUSE.z)<.75&&point.y>3)return poke('light',point);
 if(material==='foliage')return poke('leaves',point);
 if(material==='blooms')return poke('petals',point);
 const up=normal?normal.y:1;
 const onBeach=((point.x-BEACH.x)/3.9)**2+((point.z-BEACH.z)/2.5)**2<1&&point.y<1.06;
 if(up>.75)return poke(onBeach||point.y<1.02?'sand':'grass',point);
 return poke('wall',point);
}

function Effect({p,leaf,cloud}:{p:Poke;leaf:THREE.Texture;cloud:THREE.Texture}){
 const group=useRef<THREE.Group>(null);
 const parts=useRef(Array.from({length:p.kind==='leaves'||p.kind==='petals'?7:p.kind==='grass'||p.kind==='light'?10:5},(_,i)=>({v:new THREE.Vector3((Math.random()-.5)*.9,.6+Math.random()*.8,(Math.random()-.5)*.9),spin:(Math.random()-.5)*8,phase:i*1.7})));
 useFrame(()=>{const g=group.current;if(!g)return;const t=performance.now()/1000-p.t0;
  g.children.forEach((c,i)=>{const q=parts.current[i];if(!q)return;const m=(c as THREE.Mesh|THREE.Sprite).material as THREE.Material&{opacity:number};
   if(p.kind==='water'){const k=Math.max(0,t-i*.28);c.scale.setScalar(.15+k*1.1);m.opacity=Math.max(0,.55-k*.36)*(k>0?1:0);}
   else if(p.kind==='leaves'||p.kind==='petals'){const fall=Math.min(t,2.6);c.position.set(q.v.x*fall*.5+Math.sin(t*3+q.phase)*.12,(q.v.y*.4)*fall-.55*fall*fall*.5,q.v.z*fall*.5);c.rotation.set(t*q.spin*.5,t*q.spin,q.phase);m.opacity=Math.max(0,1-t/2.6);}
   else if(p.kind==='grass'||p.kind==='light'||p.kind==='star'){const k=Math.min(t/.9,1);c.position.copy(q.v).multiplyScalar(k*(p.kind==='light'?.9:.35));c.position.y=Math.abs(c.position.y);c.scale.setScalar((1-k)*(p.kind==='light'?.09:.045)+.004);m.opacity=1-k;}
   else if(p.kind==='sand'){const k=Math.min(t/1.2,1);c.position.set(q.v.x*.25*k,.05+k*.18,q.v.z*.25*k);c.scale.setScalar(.12+k*.3);m.opacity=(1-k)*.45;}
   else if(p.kind==='wall'){const k=Math.min(t/.7,1);c.position.set(q.v.x*.15*k,q.v.y*.15*k-.05,q.v.z*.15*k);c.scale.setScalar(.06+k*.12);m.opacity=(1-k)*.35;}
   else if(p.kind==='bell'){const k=Math.min(t/1.2,1);c.position.set(Math.cos(i*1.26+t)*(.12+k*.25),.25+k*.25,Math.sin(i*1.26+t)*(.12+k*.25));c.scale.setScalar(.03*(1-k)+.005);m.opacity=1-k;}
   else if(p.kind==='letter'){const k=Math.min(t/2.4,1);c.visible=i===0;c.position.set(Math.sin(t*2)*.12,.18+k*.62,.08);c.rotation.set(0,t*1.5,Math.sin(t*3)*.3);m.opacity=1-k*k;}});});
 const leafColour=p.kind==='petals'?['#e57ca7','#f2a9c4','#d6528f']:['#7da664','#a6c286','#5f8b4d'];
 return <group ref={group} position={p.at}>
  {p.kind==='water'?[0,1,2].map(i=><mesh key={i} rotation={[-Math.PI/2,0,0]} position={[0,.03,0]}><ringGeometry args={[.9,1,40]}/><meshBasicMaterial color="#ffffff" transparent opacity={0} depthWrite={false}/></mesh>)
  :p.kind==='leaves'||p.kind==='petals'?parts.current.map((_,i)=><mesh key={i}><planeGeometry args={[.07,.045]}/><meshStandardMaterial map={leaf} color={leafColour[i%3]} transparent alphaTest={.3} side={THREE.DoubleSide}/></mesh>)
  :p.kind==='sand'||p.kind==='wall'?parts.current.map((_,i)=><sprite key={i}><spriteMaterial map={cloud} color={p.kind==='sand'?'#efdcb4':'#f4efe4'} transparent depthWrite={false} opacity={0}/></sprite>)
  :p.kind==='letter'?[<mesh key="l"><planeGeometry args={[.26,.17]}/><meshStandardMaterial color="#fbf4e3" side={THREE.DoubleSide} transparent emissive="#fff4dc" emissiveIntensity={.2}/></mesh>]
  :parts.current.map((_,i)=><mesh key={i}><sphereGeometry args={[1,8,6]}/><meshBasicMaterial color={p.kind==='light'?'#ffe2a0':p.kind==='bell'?'#fff4c8':'#fff6d8'} transparent toneMapped={false} blending={THREE.AdditiveBlending} depthWrite={false}/></mesh>)}
 </group>;
}
/** A fish that jumps out of the water and back in, now and then, where she tapped the sea. */
function Fish({p}:{p:Poke}){const g=useRef<THREE.Group>(null);const dir=useRef(Math.random()*6.28);
 useFrame(()=>{const f=g.current;if(!f)return;const t=(performance.now()/1000-p.t0-.25)/1.1;f.visible=t>0&&t<1;if(!f.visible)return;const x=(t-.5)*.9;f.position.set(Math.cos(dir.current)*x,.02+Math.sin(t*Math.PI)*.42,Math.sin(dir.current)*x);f.rotation.set(0,-dir.current,-Math.cos(t*Math.PI)*1.1);});
 return <group ref={g} position={p.at} visible={false}><mesh scale={[.11,.04,.035]}><sphereGeometry args={[1,12,8]}/><meshStandardMaterial color="#e9a05a" roughness={.35}/></mesh><mesh position={[-.12,0,0]} rotation={[0,0,Math.PI/2]} scale={[.05,.04,.01]}><coneGeometry args={[1,1,3]}/><meshStandardMaterial color="#d98a48"/></mesh></group>;}
/** A streak across the night sky. */
function ShootingStar({p}:{p:Poke}){const line=useRef<THREE.Mesh>(null);const from=useRef(new THREE.Vector3(p.at.x+18,p.at.y+8,p.at.z-10));
 useFrame(()=>{const m=line.current;if(!m)return;const t=(performance.now()/1000-p.t0)/1.1;m.visible=t<1;m.position.copy(from.current).add(new THREE.Vector3(-22*t,-7*t,6*t));(m.material as THREE.MeshBasicMaterial).opacity=Math.sin(Math.min(1,t)*Math.PI);});
 return <mesh ref={line} rotation={[0,0,.3]} scale={[3.2,.05,.05]}><boxGeometry args={[1,1,1]}/><meshBasicMaterial color="#fff7dc" transparent toneMapped={false} blending={THREE.AdditiveBlending} depthWrite={false}/></mesh>;}
// Now and then a tap brings a little more: a fish or bubbles from the water, a bird or a coconut from a palm,
// a butterfly from flowers and grass, a crab from the sand, a heart from a wall, a second shooting star.
const t=(p:Poke)=>performance.now()/1000-p.t0;
function Bubbles({p}:{p:Poke}){const g=useRef<THREE.Group>(null);useFrame(()=>{const o=g.current;if(!o)return;const k=t(p);o.children.forEach((c,i)=>{const q=Math.max(0,k-i*.18);c.position.set(Math.sin(q*6+i)*.05+(i-1.5)*.06,q*.32,Math.cos(q*5+i)*.04);c.scale.setScalar(q>1.5?0:(.02+i%2*.012)*(1+q*.4));});});
 return <group ref={g} position={p.at}>{[0,1,2,3].map(i=><mesh key={i}><sphereGeometry args={[1,10,8]}/><meshStandardMaterial color="#f4fbff" transparent opacity={.55} roughness={.1}/></mesh>)}</group>;}
function Bird({p}:{p:Poke}){const g=useRef<THREE.Group>(null);const dir=useRef(p.seed*40);useFrame(()=>{const o=g.current;if(!o)return;const k=t(p),a=dir.current;o.position.set(p.at.x+Math.cos(a)*k*1.6,p.at.y+.2+k*1.1,p.at.z+Math.sin(a)*k*1.6);o.rotation.y=-a+Math.PI/2;
  const flap=Math.sin(k*28)*.7;(o.children[1] as THREE.Object3D).rotation.z=flap;(o.children[2] as THREE.Object3D).rotation.z=-flap;o.scale.setScalar(k>2.2?Math.max(0,1-(k-2.2)*2):1);});
 return <group ref={g} position={p.at} scale={1}><mesh scale={[.05,.035,.09]}><sphereGeometry args={[1,10,8]}/><meshStandardMaterial color="#f5f1e8"/></mesh>
  <group position={[.02,.01,0]}><mesh position={[.07,0,0]} scale={[.14,.01,.06]}><boxGeometry args={[1,1,1]}/><meshStandardMaterial color="#efe9dc"/></mesh></group>
  <group position={[-.02,.01,0]}><mesh position={[-.07,0,0]} scale={[.14,.01,.06]}><boxGeometry args={[1,1,1]}/><meshStandardMaterial color="#efe9dc"/></mesh></group></group>;}
function Butterfly({p,colour}:{p:Poke;colour:string}){const g=useRef<THREE.Group>(null);useFrame(()=>{const o=g.current;if(!o)return;const k=t(p),a=p.seed*30;o.position.set(p.at.x+Math.cos(a)*k*.5+Math.sin(k*3)*.15,p.at.y+.1+k*.42+Math.sin(k*7)*.05,p.at.z+Math.sin(a)*k*.5);
  const flap=Math.abs(Math.sin(k*18))*1.1;(o.children[0] as THREE.Object3D).rotation.y=flap;(o.children[1] as THREE.Object3D).rotation.y=-flap;o.scale.setScalar(k>2.6?Math.max(0,1-(k-2.6)*2.5):1);});
 return <group ref={g} position={p.at}>{[1,-1].map(side=><group key={side}><mesh position={[side*.035,0,0]} scale={[.04,.05,1]}><circleGeometry args={[1,12]}/><meshStandardMaterial color={colour} side={THREE.DoubleSide} roughness={.6}/></mesh></group>)}</group>;}
function Crab({p}:{p:Poke}){const g=useRef<THREE.Group>(null);useFrame(()=>{const o=g.current;if(!o)return;const k=t(p),a=p.seed*50;const run=Math.min(k,1.8);o.position.set(p.at.x+Math.cos(a)*run*.4,p.at.y+.03+Math.abs(Math.sin(k*22))*.012,p.at.z+Math.sin(a)*run*.4);o.rotation.y=-a;o.scale.setScalar(k>2.1?Math.max(0,1-(k-2.1)*3):1);});
 return <group ref={g} position={p.at}><mesh scale={[.075,.035,.055]}><sphereGeometry args={[1,12,8]}/><meshStandardMaterial color="#e2714f" roughness={.5}/></mesh>{[1,-1].map(side=><group key={side}><mesh position={[.02,.01,side*.075]} scale={.025}><sphereGeometry args={[1,8,6]}/><meshStandardMaterial color="#e2714f"/></mesh><mesh position={[.05,.04,side*.02]} scale={.011}><sphereGeometry args={[1,6,4]}/><meshStandardMaterial color="#2f3532"/></mesh></group>)}</group>;}
function Coconut({p}:{p:Poke}){const g=useRef<THREE.Mesh>(null);const landed=useRef(false);useFrame(()=>{const o=g.current;if(!o)return;const k=t(p),floor=1.15,fall=p.at.y-floor;const tf=Math.sqrt(2*fall/9.8);
  if(k<tf)o.position.set(p.at.x,p.at.y-4.9*k*k,p.at.z);else{if(!landed.current){landed.current=true;plop();}const b=k-tf;o.position.set(p.at.x+b*.25,floor+Math.max(0,Math.sin(Math.min(b/.35,1)*Math.PI))*.12,p.at.z);o.rotation.z=-b*3;}o.scale.setScalar(k>2.4?Math.max(0,1-(k-2.4)*3):1);});
 return <mesh ref={g} position={p.at} castShadow><sphereGeometry args={[.075,12,10]}/><meshStandardMaterial color="#7d5a3c" roughness={.85}/></mesh>;}
function spriteTexture(draw:(g:CanvasRenderingContext2D)=>void){const c=document.createElement('canvas');c.width=c.height=64;draw(c.getContext('2d')!);const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;return tex;}
let starTex:THREE.Texture|null=null,heartTex:THREE.Texture|null=null;
const glintTexture=()=>starTex??=spriteTexture(g=>{const r=g.createRadialGradient(32,32,0,32,32,32);r.addColorStop(0,'rgba(255,250,230,1)');r.addColorStop(.25,'rgba(255,236,190,.45)');r.addColorStop(1,'rgba(255,230,180,0)');g.fillStyle=r;g.fillRect(0,0,64,64);
 g.fillStyle='rgba(255,252,240,.95)';g.beginPath();g.moveTo(32,2);g.quadraticCurveTo(35,29,62,32);g.quadraticCurveTo(35,35,32,62);g.quadraticCurveTo(29,35,2,32);g.quadraticCurveTo(29,29,32,2);g.fill();});
const heartTexture=()=>heartTex??=spriteTexture(g=>{g.fillStyle='#f08fa8';g.beginPath();g.moveTo(32,56);g.bezierCurveTo(4,36,8,8,32,20);g.bezierCurveTo(56,8,60,36,32,56);g.fill();});
function Glint({p}:{p:Poke}){const m=useRef<THREE.Sprite>(null);useFrame(()=>{const o=m.current;if(!o)return;const k=t(p)/1.2;o.visible=k<1;const s=Math.sin(Math.min(1,k)*Math.PI);o.scale.setScalar(.06+s*.3);(o.material as THREE.SpriteMaterial).opacity=s;(o.material as THREE.SpriteMaterial).rotation=k*1.4;});
 return <sprite ref={m} position={p.at}><spriteMaterial map={glintTexture()} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} opacity={0}/></sprite>;}
function Heart({p}:{p:Poke}){const m=useRef<THREE.Sprite>(null);useFrame(()=>{const o=m.current;if(!o)return;const k=t(p)/1.5;o.visible=k<1;o.position.set(p.at.x,p.at.y+.1+k*.5,p.at.z);o.scale.setScalar(.12+Math.sin(Math.min(1,k)*Math.PI)*.08);(o.material as THREE.SpriteMaterial).opacity=1-k*k;});
 return <sprite ref={m} position={p.at}><spriteMaterial map={heartTexture()} transparent depthWrite={false} opacity={0}/></sprite>;}
let leafTexture:THREE.CanvasTexture|null=null;
/** A small leaf (or petal) silhouette with a midrib, white so it can be tinted. */
function leafShape(){if(leafTexture)return leafTexture;const c=document.createElement('canvas');c.width=64;c.height=40;const g=c.getContext('2d')!;g.fillStyle='#ffffff';g.beginPath();g.moveTo(4,20);g.bezierCurveTo(18,2,46,2,60,20);g.bezierCurveTo(46,38,18,38,4,20);g.fill();g.strokeStyle='rgba(0,0,0,.18)';g.lineWidth=2;g.beginPath();g.moveTo(6,20);g.lineTo(58,20);g.stroke();leafTexture=new THREE.CanvasTexture(c);leafTexture.colorSpace=THREE.SRGBColorSpace;return leafTexture;}
/** Which little surprise (if any) comes with this tap. */
function extra(p:Poke){const r=p.seed;switch(p.kind){
 case 'water':return r<.35?<Fish p={p}/>:r<.6?<Bubbles p={p}/>:null;
 case 'leaves':return r<.3?<Bird p={p}/>:r<.45&&p.at.y>2.6?<Coconut p={p}/>:null;
 case 'petals':return r<.35?<Butterfly p={p} colour="#f3a6c0"/>:null;
 case 'grass':return r<.3?<Butterfly p={p} colour={r<.15?'#fff4c8':'#f6c1d2'}/>:null;
 case 'sand':return r<.35?<Crab p={p}/>:null;
 case 'wall':return r<.25?<Heart p={p}/>:null;
 default:return null;}}
// One of each, hidden, so their materials are compiled with the island rather than on the first tap.
const SAMPLE:Poke={id:0,kind:'water',at:new THREE.Vector3(0,-50,0),t0:-1e6,seed:0};
function Warm(){return <group visible={false}><Fish p={SAMPLE}/><Bubbles p={SAMPLE}/><Bird p={SAMPLE}/><Butterfly p={SAMPLE} colour="#f3a6c0"/><Crab p={SAMPLE}/><Coconut p={SAMPLE}/><Glint p={SAMPLE}/><Heart p={SAMPLE}/></group>;}
export default function Pokes(){
 const [list,setList]=useState<Poke[]>([]);const cloud=useTexture('/textures/cloud.png');const leaf=leafShape();
 useEffect(()=>{const on=(e:Event)=>{const p=(e as CustomEvent<Poke>).detail;setList(l=>[...l.slice(-11),p]);setTimeout(()=>setList(l=>l.filter(x=>x.id!==p.id)),3200);};bus.addEventListener('poke',on);return()=>bus.removeEventListener('poke',on);},[]);
 const reduced=useIsland(s=>s.save.settings.reducedMotion);if(reduced)return null;
 return <><Warm/>{list.map(p=>p.kind==='star'?<group key={p.id}><ShootingStar p={p}/>{p.seed<.35&&<ShootingStar p={{...p,at:p.at.clone().add(new THREE.Vector3(-6,4,3)),t0:p.t0+.5}}/>}</group>
  :p.kind==='glint'?<Glint key={p.id} p={p}/>:<group key={p.id}><Effect p={p} leaf={leaf} cloud={cloud}/>{extra(p)}</group>)}</>;
}
