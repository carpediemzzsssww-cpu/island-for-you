import {useEffect,useMemo,useRef} from 'react';
import {Html} from '@react-three/drei';
import type {ThreeEvent} from '@react-three/fiber';
import {useFrame} from '@react-three/fiber';
import * as THREE from 'three';
import {useIsland} from '../store';
import {hillHeight,TOP} from './terrain';
import {poke} from './Pokes';
import {chime,plop,rustle,sparkleSound,sneeze} from '../lib/audio';
import type {PlaceId} from '../content';

// The island's one red panda. It lives on its own: it walks a little path, stops to look around, and every so
// often turns up somewhere else on the island (often wherever she has just gone). Tap it and it answers, a little
// differently each time.

type Route={near:PlaceId[];points:[number,number][]};
const ROUTES:Route[]=[
 {near:['park'],points:[[-6.3,2.6],[-6.25,.6],[-6.3,-1.4],[-7.1,-2.5]]},
 {near:['home'],points:[[6.35,2.4],[6.6,.6],[7.5,-.6],[8.3,-1.5]]},
 {near:['town','flowers','diner','celebration'],points:[[-2.7,4.5],[-1.4,3.45],[1.4,3.45],[2.7,4.5]]},
 {near:['sunrise'],points:[[-3.0,-5.05],[-2.3,-5.7],[-.8,-5.75],[1.3,-6.45]]},
 {near:['town'],points:[[-2.7,3.0],[-1.1,3.25],[.5,3.25]]},
];
const ground=(x:number,z:number)=>Math.hypot(x,z-5.35)<2.1?1.142:Math.max(hillHeight(x,z),TOP+.012);
type Reaction='hop'|'roll'|'stand'|'sneeze'|'dash';
const REACTIONS:Reaction[]=['hop','roll','stand','sneeze','dash'];
const brown='#a8653a',rust='#b87348',cream='#eddfbd',ear='#eee0c1',dark='#34413a',paw='#514238';
function Body(){return <>
 <mesh position={[0,.27,0]} scale={[.28,.29,.4]} castShadow><sphereGeometry args={[1,14,10]}/><meshStandardMaterial color={brown}/></mesh>
 <group name="head" position={[0,.55,.28]}>
  <mesh scale={[.28,.26,.25]} castShadow><sphereGeometry args={[1,14,10]}/><meshStandardMaterial color={rust}/></mesh>
  <mesh position={[0,-.06,.18]} scale={[.24,.16,.1]}><sphereGeometry args={[1,12,8]}/><meshStandardMaterial color={cream}/></mesh>
  {[-1,1].map(side=><group key={side}><mesh position={[side*.21,.22,-.04]} scale={[.1,.11,.07]}><sphereGeometry args={[1,10,8]}/><meshStandardMaterial color={ear}/></mesh>
   <mesh position={[side*.1,.03,.22]} scale={[.034,.046,.027]}><sphereGeometry args={[1,8,6]}/><meshStandardMaterial color={dark}/></mesh></group>)}
  <mesh position={[0,-.06,.27]} scale={[.039,.027,.022]}><sphereGeometry args={[1,8,6]}/><meshStandardMaterial color={dark}/></mesh>
 </group>
 {[-1,1].map(side=><group key={side}>
  <mesh name="leg" position={[side*.17,.06,.16]} scale={[.07,.09,.08]}><sphereGeometry args={[1,8,6]}/><meshStandardMaterial color={paw}/></mesh>
  <mesh name="leg" position={[side*.17,.06,-.16]} scale={[.07,.09,.08]}><sphereGeometry args={[1,8,6]}/><meshStandardMaterial color={paw}/></mesh></group>)}
 <group name="tail" position={[0,.24,-.33]}>{Array.from({length:7},(_,i)=><mesh key={i} position={[.06*i*.5,i*.032,-i*.095]} scale={[.12-i*.008,.12-i*.008,.105]}><sphereGeometry args={[1,10,8]}/><meshStandardMaterial color={i%2?'#dfb881':'#ad6940'}/></mesh>)}</group>
</>;}
export default function RedPanda(){
 const root=useRef<THREE.Group>(null),body=useRef<THREE.Group>(null);
 const st=useRef({route:2,i:0,dir:1,pos:new THREE.Vector3(),heading:0,mode:'walk' as 'walk'|'pause'|'react',until:0,reaction:'hop' as Reaction,since:0,relocate:performance.now()+60000,speed:.32});
 const place=useIsland(s=>s.place);
 const placeAt=(route:number)=>{const s=st.current;const r=ROUTES[route];s.route=route;s.i=Math.floor(Math.random()*r.points.length);s.dir=Math.random()<.5?1:-1;const [x,z]=r.points[s.i];s.pos.set(x,ground(x,z),z);s.mode='pause';s.until=performance.now()+1200;s.relocate=performance.now()+50000+Math.random()*35000;};
 useMemo(()=>placeAt(2),[]);
 // Often it is already there when she arrives somewhere.
 useEffect(()=>{if(!place)return;const options=ROUTES.map((r,i)=>r.near.includes(place)?i:-1).filter(i=>i>=0);if(options.length&&Math.random()<.7)placeAt(options[Math.floor(Math.random()*options.length)]);},[place]);
 useFrame((_,dt)=>{const g=root.current,b=body.current;if(!g||!b)return;const s=st.current,now=performance.now(),t=now/1000,reduced=useIsland.getState().save.settings.reducedMotion;dt=Math.min(dt,.1);
  if(now>s.relocate&&s.mode!=='react'){poke('sand',s.pos);placeAt(Math.floor(Math.random()*ROUTES.length));poke('sand',s.pos);}
  const r=ROUTES[s.route];
  if(s.mode==='pause'&&now>s.until){let next=s.i+s.dir;if(next<0||next>=r.points.length){s.dir*=-1;next=s.i+s.dir;}s.i=next;s.mode='walk';s.speed=.32;}
  if(s.mode==='walk'){const [x,z]=r.points[s.i];const dx=x-s.pos.x,dz=z-s.pos.z,d=Math.hypot(dx,dz);
   if(d<.05){s.mode='pause';s.until=now+(1500+Math.random()*3500);}
   else{const step=Math.min(d,s.speed*(reduced?.5:1)*dt);s.pos.x+=dx/d*step;s.pos.z+=dz/d*step;s.pos.y=ground(s.pos.x,s.pos.z);
    const want=Math.atan2(dx,dz);let diff=want-s.heading;diff=Math.atan2(Math.sin(diff),Math.cos(diff));s.heading+=diff*Math.min(1,dt*5);}}
  g.position.copy(s.pos);g.rotation.y=s.heading;
  // Body language: a waddle while walking, a slow look around while still, and the reactions.
  const walking=s.mode==='walk';const k=(now-s.since)/1000;
  b.position.set(0,walking?Math.abs(Math.sin(t*9))*.035:0,0);b.rotation.set(0,0,walking?Math.sin(t*9)*.05:0);
  const head=b.getObjectByName('head'),tail=b.getObjectByName('tail');
  if(head)head.rotation.set(0,s.mode==='pause'?Math.sin(t*.9)*.45:0,0);if(tail)tail.rotation.set(0,Math.sin(t*(walking?6:1.4))*.25,0);
  if(s.mode==='react'){
   if(s.reaction==='hop'){b.position.y=Math.max(0,Math.sin(Math.min(1,k/.7)*Math.PI))*.38;b.rotation.y=Math.min(1,k/.7)*Math.PI*2;}
   else if(s.reaction==='roll'){b.rotation.z=Math.min(1,k/1.1)*Math.PI*2;b.position.y=Math.sin(Math.min(1,k/1.1)*Math.PI)*.15;}
   else if(s.reaction==='stand'){b.rotation.x=-Math.sin(Math.min(1,k/1.4)*Math.PI)*.95;b.position.y=Math.sin(Math.min(1,k/1.4)*Math.PI)*.1;}
   else if(s.reaction==='sneeze'){const q=k<.35?1-k*.4:k<.5?1.08:1;b.scale.set(1,q,1);}
   if(now>s.until){s.mode=s.reaction==='dash'?'walk':'pause';s.until=now+1500;b.scale.set(1,1,1);}}
 });
 const tap=(e:ThreeEvent<MouseEvent>)=>{const state=useIsland.getState();if(!state.started||state.intro||state.object||e.delta>8)return;e.stopPropagation();const s=st.current;
  state.dispatch({type:'panda'});const options=REACTIONS.filter(r=>r!==s.reaction);const r=options[Math.floor(Math.random()*options.length)];s.reaction=r;s.since=performance.now();
  const head=s.pos.clone().add(new THREE.Vector3(Math.sin(s.heading)*.4,.6,Math.cos(s.heading)*.4));
  if(r==='hop'){poke('petals',head);sparkleSound();s.mode='react';s.until=performance.now()+800;}
  else if(r==='roll'){plop();s.mode='react';s.until=performance.now()+1200;}
  else if(r==='stand'){chime();s.mode='react';s.until=performance.now()+1500;}
  else if(r==='sneeze'){sneeze();setTimeout(()=>poke('sand',head),330);s.mode='react';s.until=performance.now()+700;}
  else{rustle();s.mode='react';s.until=performance.now()+120;s.speed=1.3;let next=s.i+s.dir;if(next<0||next>=ROUTES[s.route].points.length){s.dir*=-1;next=s.i+s.dir;}s.i=next;}};
 const hover={onPointerOver:(e:ThreeEvent<PointerEvent>)=>{if(e.pointerType==='mouse'){e.stopPropagation();document.body.style.cursor='pointer';}},onPointerOut:()=>{document.body.style.cursor='';}};
 return <group ref={root} scale={.78} onClick={tap} {...hover}><group ref={body}><Body/></group>
  {/* For keyboards and screen readers: an invisible button that travels with it. */}
  <Html center position={[0,1.1,0]} zIndexRange={[25,0]}><button aria-label="咦，小熊猫" className="object-tag" onClick={()=>tap({stopPropagation(){},delta:0} as unknown as ThreeEvent<MouseEvent>)}><span aria-hidden="true"/></button></Html>
  {/* A wider, invisible hit area: a small animal should be easy to tap. */}
  <mesh position={[0,.4,0]} visible={false}><sphereGeometry args={[.62,8,6]}/><meshBasicMaterial/></mesh></group>;
}
