import {strike,whoosh,sparkleSound} from '../lib/audio';
import {Suspense,useEffect,useMemo,useRef,useState} from 'react';
import {Html,Line,RoundedBox,useTexture} from '@react-three/drei';
import {useFrame} from '@react-three/fiber';
import type {ThreeEvent} from '@react-three/fiber';
import * as THREE from 'three';
import {useIsland} from '../store';
import {TIMING} from '../experience';
import {scenery,photos,menu} from '../content';
import type {ObjectId,PlaceId,Vec3} from '../content';
import type {Bouquet} from '../lib/state';
import {chime} from '../lib/audio';
import {getPhoto} from '../lib/photos';
import {Cake,Fireworks,Bunting} from './Party';
import {Dish} from './Dishes';
import MemoryBoard from './MemoryBoard';
import Plaza from './Plaza';
import RedPanda from './RedPanda';
import PhotoStrings from './PhotoStrings';
import {poke} from './Pokes';
import {BouquetModel,Vase} from '../bouquet/Bouquet';

export function Box({position=[0,0,0],size,color='#eee3c7',rotation=[0,0,0],...rest}:{position?:Vec3;size:Vec3;color?:string;rotation?:Vec3}&Record<string,any>){return <mesh position={position} rotation={rotation} castShadow receiveShadow {...rest}><boxGeometry args={size}/><meshStandardMaterial color={color} roughness={.8}/></mesh>;}
// Small decorative spheres skip the shadow pass; their shadows are too small to read.
function Ball({position=[0,0,0],scale=[1,1,1],color='#fff2de'}:{position?:Vec3;scale?:Vec3;color?:string}){return <mesh position={position} scale={scale}><sphereGeometry args={[1,12,8]}/><meshStandardMaterial color={color}/></mesh>;}
function Cylinder({position,top,bottom,height,color='#92704c',...rest}:{position:Vec3;top:number;bottom:number;height:number;color?:string}&Record<string,any>){return <mesh position={position} castShadow {...rest}><cylinderGeometry args={[top,bottom,height,24]}/><meshStandardMaterial color={color} roughness={.7}/></mesh>;}
/** Things answer the pointer themselves (the blinking dots are gone): a hand cursor on hover, and a tap acts, or,
 *  seen from elsewhere on the island, first takes her to the thing's place. */
function touch(place:PlaceId|null,act:()=>void){return {
 onClick:(e:ThreeEvent<MouseEvent>)=>{const s=useIsland.getState();if(!s.started||s.intro||s.object||e.delta>8)return;e.stopPropagation();if(place&&s.place!==place){s.travel(place);return;}act();},
 onPointerOver:(e:ThreeEvent<PointerEvent>)=>{if(e.pointerType!=='mouse')return;e.stopPropagation();document.body.style.cursor='pointer';},
 onPointerOut:()=>{document.body.style.cursor='';}};}
/** An invisible button over a thing, for keyboards and screen readers (it shows only when focused by keyboard). */
function Hotspot({label,position,object,onClick}:{label:string;position:Vec3;object?:ObjectId;onClick?:()=>void}){const open=useIsland(s=>s.object);if(open)return null;return <Html center position={position} zIndexRange={[25,0]}><button aria-label={label} className="object-tag" onClick={onClick??(()=>{paperSoundLocal();useIsland.getState().open(object??null);})}><span aria-hidden="true"/></button></Html>;}
function paperSoundLocal(){chime();}
function Picture({photoId,position,scale=1,rotation=[0,0,0]}:{photoId:string;position:Vec3;scale?:number;rotation?:Vec3}){
 const p=photos.find(p=>p.id===photoId)??scenery[0];const texture=useTexture(p.thumbnail);const ratio=p.width/p.height;const w=Math.min(.85,.82*ratio),h=w/ratio;
 return <group position={position} rotation={rotation} scale={scale}><Box size={[w+.09,h+.1,.05]} color="#eee6ce"/><mesh position={[0,.008,.03]}><planeGeometry args={[w,h]}/>{/* Lit by the room, with a little self-light so faces stay readable. */}<meshStandardMaterial map={texture} emissiveMap={texture} emissive="#ffffff" emissiveIntensity={.32} roughness={.75}/></mesh></group>;
}
/** Her bouquet at home and on the birthday table stands in a vase; before she makes one, the vase waits empty. */
export function FlowerBouquet({bouquet,position=[0,0,0],scale=1}:{bouquet:Bouquet|null;position?:Vec3;scale?:number;vase?:boolean}){return <group position={position} scale={scale}><Suspense fallback={null}><Vase bouquet={bouquet}/></Suspense></group>;}
/** The flower shop's own display: a zinc bucket of stems for sale. */
const DISPLAY:Bouquet={flowers:['tulip','rose','daisy','eucalyptus'],stems:['tulip','tulip','tulip','rose','rose','daisy','daisy','eucalyptus','gypsophila'],paper:'kraft',ribbon:'pink'};
function FlowerBucket({position}:{position:Vec3}){return <group position={position}>
 <mesh position={[0,.13,0]} castShadow><cylinderGeometry args={[.16,.12,.26,24,1,true]}/><meshStandardMaterial color="#a9b3ad" metalness={.5} roughness={.45} side={THREE.DoubleSide}/></mesh>
 <mesh position={[0,.01,0]}><cylinderGeometry args={[.12,.12,.02,24]}/><meshStandardMaterial color="#9aa49e" metalness={.5} roughness={.5}/></mesh>
 <group position={[0,.3,0]} scale={1.25}><BouquetModel bouquet={DISPLAY} wrapped={false}/></group></group>;}
function Home(){
 const s=useIsland();
 const [lampOn,setLamp]=useState<boolean|null>(deskLamp.on);const night=lampOn??(s.save.time==='night');
 useEffect(()=>{deskLamp.on=lampOn;},[lampOn]);
 // Home stays built (hidden until her first visit) so it is compiled with the island; it only answers taps inside.
 const inside=s.place==='home';
 return <group><Curtain/>
 {/* Desk lamp: the room keeps a warm light after dark; a tap switches it (its light is the shared AccentLight). */}
 <group position={[5.62,1.98,-4.28]} onClick={inside?e=>{e.stopPropagation();setLamp(!night);chime();}:undefined}><Cylinder position={[0,.02,0]} top={.07} bottom={.08} height={.03} color="#b48e6b"/><Cylinder position={[0,.17,0]} top={.012} bottom={.012} height={.28} color="#8a6f55"/><mesh position={[0,.34,0]}><cylinderGeometry args={[.07,.12,.13,16,1,true]}/><meshStandardMaterial color="#f3dcc6" emissive="#ffcf94" emissiveIntensity={night?1.6:.05} side={THREE.DoubleSide}/></mesh></group>
 <group onClick={inside?e=>{e.stopPropagation();s.open('journal');}:undefined}><Box position={[5.95,2.02,-3.98]} size={[.51,.075,.38]} color="#8a9c78"/><Box position={[5.95,2.061,-3.98]} size={[.46,.008,.33]} color="#f1e7cf"/><Box position={[6.1,2.07,-3.78]} size={[.035,.01,.14]} color="#c98e9d"/></group>

 <FlowerBouquet bouquet={s.save.home.bouquet} position={[6,1.98,-4.25]} scale={1.05}/>
 {/* Things she would recognise without being told: a green copy of Atonement, a friendship bracelet, brush and ink stone, a red panda plush, a pink record sleeve. */}
 <Box position={[6.63,1.998,-4.27]} size={[.19,.036,.2]} color="#2f6b4f"/><Box position={[6.63,2.018,-4.27]} size={[.17,.006,.18]} color="#f1e8d2"/>
 <group position={[5.52,1.99,-3.74]}>{Array.from({length:14},(_,i)=><mesh key={i} position={[Math.cos(i/14*Math.PI*2)*.065,0,Math.sin(i/14*Math.PI*2)*.065]}><sphereGeometry args={[.014,6,4]}/><meshStandardMaterial color={['#e8a4b8','#fff3e6','#9cc3e0','#f1d27e'][i%4]}/></mesh>)}</group>
 <Box position={[5.35,2.78,-4.82]} size={[.17,.045,.12]} color="#2b3332"/><Cylinder castShadow={false} position={[5.35,2.79,-5.12]} top={.012} bottom={.012} height={.3} color="#b8875f" rotation={[Math.PI/2,0,0]}/><Cylinder castShadow={false} position={[5.35,2.79,-4.95]} top={.0} bottom={.018} height={.06} color="#2b2b2b" rotation={[Math.PI/2,0,0]}/><Box position={[5.35,2.79,-5.42]} size={[.045,.06,.045]} color="#b2423b"/>
<RoundedBox args={[.5,.13,.32]} radius={.05} position={[7.86,1.93,-5.12]} rotation={[-.25,.1,0]}><meshStandardMaterial color="#fbf3e6" roughness={.9}/></RoundedBox>
 <RoundedBox args={[1.06,.06,.62]} radius={.025} position={[8.13,1.9,-4.0]}><meshStandardMaterial color="#e9b9c2" roughness={.95}/></RoundedBox>
 <Plant position={[8.55,1.31,-3.12]}/>
 <Box position={[5.6,1.5,-2.69]} size={[.3,.3,.012]} color="#efb4c2" rotation={[-.22,0,0]}/>
 <group {...(inside?touch('home',()=>{chime();s.open('phone');}):{})}><Box position={[8.78,1.8,-5.22]} size={[.28,.06,.42]} color="#44605a"/><Box position={[8.78,1.835,-5.22]} size={[.22,.008,.34]} color={s.save.time==='night'?'#e8dbbf':'#738985'}/></group>
 <group onClick={inside?e=>{e.stopPropagation();s.open('radio');}:undefined}><Box position={[5.75,1.52,-2.99]} size={[.76,.28,.5]} color="#987558"/><Turntable/></group>
 <PhotoStrings interactive={inside}/>
 {/* The five things she brings back are pinned on the cork board above the desk. */}
 <MemoryBoard position={[5.245,2.62,-3.62]} interactive={inside}/>
 {s.save.shots.at(-1)&&<CapturedPrint id={s.save.shots.at(-1)!.id} position={[6.52,2.04,-3.80]} scale={.45}/>}
 {s.place==='home'&&<><Hotspot label="翻开手账" position={[5.95,2.3,-3.98]} object="journal"/><Hotspot label="我眼睛里的你" position={[7.2,3.7,-5.7]} object="wall"/><Hotspot label="唱片机" position={[5.65,2.15,-2.8]} object="radio"/><Hotspot label="床边的手机" position={[8.8,2.2,-5.2]} object="phone"/></>}
 </group>;
}
// The record turns while the radio plays.
function Turntable(){const disc=useRef<THREE.Group>(null);useFrame((_,dt)=>{const s=useIsland.getState();if(disc.current&&s.radio&&!s.save.settings.reducedMotion)disc.current.rotation.y-=dt*3.5;});
 return <group ref={disc} position={[5.75,1.68,-2.99]}><Cylinder position={[0,0,0]} top={.21} bottom={.21} height={.02} color="#293e3c"/><Cylinder position={[0,.014,0]} top={.055} bottom={.055} height={.012} color="#c69588"/><Box position={[.09,.022,0]} size={[.05,.004,.012]} color="#f3e6d2"/></group>;}
function Food({kind,position,scale=1}:{kind:string;position:Vec3;scale?:number}){return <group position={position} scale={scale}><Dish kind={kind}/></group>;}
// Where each dish sits on the diner table (everything she has ordered stays on the table).
const DINER_SPOTS:Record<string,Vec3>={bowl:[3.62,1.8,3.98],jelly:[2.98,1.8,4.13],dumpling:[4.24,1.8,3.8],milk:[4.3,1.8,4.24]};
function Tables(){const s=useIsland();const served=s.save.optional.foodMemories.map(id=>menu.find(m=>m.id===id)?.kind).filter(Boolean) as string[];return <>
 <Box position={[3.6,1.74,4]} size={[1.75,.12,.8]} color="#8e7051"/>{[-.65,.65].map(x=><Box key={x} position={[3.6+x,1.42,4]} size={[.09,.6,.6]} color="#786244"/>)}
 <Box position={[2.95,1.815,3.72]} size={[.36,.012,.47]} rotation={[0,.18,0]} color="#e9dac0" {...touch('diner',()=>{chime();s.open('menu');})}/><Suspense fallback={null}>{served.map(kind=><Food key={kind} position={DINER_SPOTS[kind]} kind={kind}/>)}</Suspense>
 {s.place==='diner'&&<Hotspot label="今日菜单" position={[3.6,2.3,4]} object="menu"/>}
 <Box position={[-4.3,1.73,3.65]} size={[1.8,.12,.75]} color="#ad8f68"/>{[-.65,.65].map(x=><Box key={x} position={[-4.3+x,1.42,3.65]} size={[.1,.6,.65]} color="#ad8f68"/>)}
 <group {...touch('flowers',()=>{chime();s.open('bouquet');})}><FlowerBucket position={[-4.3,1.79,3.65]}/></group>
 {s.place==='flowers'&&<Hotspot label="包一束喜欢的花" position={[-4.4,2.8,3.65]} object="bouquet"/>}
 </>;}
function Park(){const s=useIsland();const swing=useRef<THREE.Group>(null),carousel=useRef<THREE.Group>(null),ducks=useRef<THREE.Group>(null);
 useFrame(({clock})=>{if(s.save.settings.reducedMotion)return;const t=clock.elapsedTime;if(swing.current)swing.current.rotation.x=Math.sin(t*(s.toy==='swing'?2.2:.65))*(s.toy==='swing'?.45:.055);if(carousel.current&&s.toy==='carousel')carousel.current.rotation.y=t*.4;if(ducks.current)ducks.current.rotation.y=t*.075;});
 return <><group position={[-8.6,3.33,1.6]} ref={swing} {...touch('park',()=>{s.playToy('swing');chime();})}><Box position={[0,-1.42,0]} size={[.7,.1,.38]} color="#b47f59"/>{[-.28,.28].map(x=><Cylinder key={x} position={[x,-.7,0]} top={.012} bottom={.012} height={1.4} color="#ddd3b1"/>)}</group>
 <group position={[-8.0,1.35,-4.4]} ref={carousel} {...touch('park',()=>{s.playToy('carousel');chime();})}>{Array.from({length:4},(_,i)=><group key={i} position={[Math.cos(i*1.57)*.63,.35,Math.sin(i*1.57)*.63]} rotation={[0,-i*1.57,0]}><Ball scale={[.24,.13,.10]} color={i%2?'#ebc4b2':'#ecdfb7'}/><Ball position={[.16,.16,0]} scale={[.075,.15,.085]} color="#ecdfb7"/></group>)}</group>
 <group ref={ducks} position={[-8.7,1.24,-1.6]} {...touch('park',()=>{s.playToy('pond');plopLocal();})}>{[-1,1].map((v,i)=><group key={i} position={[v*.7,0,.15]}><Ball scale={[.17,.08,.11]} color="#eee8d3"/><Ball position={[.10,.10,0]} scale={[.075,.075,.07]} color="#eee8d3"/><Box position={[.18,.10,0]} size={[.09,.035,.06]} color="#c99957"/></group>)}</group>
 {s.place==='park'&&<><Hotspot label="荡一会儿秋千" position={[-8.6,2.4,1.7]} onClick={()=>{s.playToy('swing');chime();}}/><Hotspot label="旋转木马" position={[-8.0,3.35,-4.4]} onClick={()=>s.playToy('carousel')}/><Hotspot label="和鸭子打个招呼" position={[-8.6,1.65,-1.4]} onClick={()=>{s.playToy('pond');chime();}}/></>}
 </>;
}
// Street lamps stand beside the roads (scripts/build_island.py ROADS), never on them. They carry no real lights:
// adding a light recompiles every material on the island, which is what made the birthday evening stutter as the
// lamps came on one by one. Each lamp glows instead (bloom picks it up) and lays a soft pool of light on the ground.
const lampPositions:Vec3[]=[[-7.4,1.1,5.55],[-3.4,1.1,5.3],[3.4,1.1,5.3],[7.15,1.1,1.6],[-7.0,1.1,-.8],[-.5,2.25,-7.0],[7.05,1.11,3.35],[-4.2,1.1,6.95]];
let poolTexture:THREE.CanvasTexture|null=null;
function lightPool(){if(poolTexture)return poolTexture;const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d')!;const r=g.createRadialGradient(64,64,0,64,64,64);
 r.addColorStop(0,'rgba(255,221,160,1)');r.addColorStop(.3,'rgba(255,204,135,.55)');r.addColorStop(.65,'rgba(255,190,120,.16)');r.addColorStop(1,'rgba(255,180,110,0)');g.fillStyle=r;g.fillRect(0,0,128,128);
 poolTexture=new THREE.CanvasTexture(c);poolTexture.colorSpace=THREE.SRGBColorSpace;return poolTexture;}
const LAMP_STEP=1.25,lampOff=new THREE.Color('#ddcd98'),lampOn=new THREE.Color('#ffdb91');
function Lamps(){
 const endingSeen=useIsland(s=>s.save.endingSeen);const reduced=useIsland(s=>s.save.settings.reducedMotion);
 // The lamps come on one by one only when the evening begins in this visit; after a reload they are simply lit.
 const since=useRef<number|null>(null);const was=useRef(endingSeen);
 useEffect(()=>{if(endingSeen&&!was.current)since.current=performance.now();was.current=endingSeen;},[endingSeen]);
 const heads=useRef<(THREE.MeshStandardMaterial|null)[]>([]);const pools=useRef<(THREE.MeshBasicMaterial|null)[]>([]);const level=useRef(lampPositions.map(()=>0));
 useFrame((_,dt)=>{const s=useIsland.getState();const t0=since.current;const step=(reduced?.03:LAMP_STEP)*1000;
  lampPositions.forEach((_,i)=>{const on=(s.save.endingSeen?(t0===null||performance.now()-t0>i*step):s.save.time==='night')||s.save.optional.lamps.includes(String(i));
   const k=level.current[i]=THREE.MathUtils.lerp(level.current[i],on?1:0,Math.min(1,dt*(on?3.2:5)));const head=heads.current[i],pool=pools.current[i];
   if(head){head.emissiveIntensity=k*2;head.color.copy(lampOff).lerp(lampOn,k);}if(pool){pool.opacity=k*.5;pool.visible=k>.01;}});});
 const texture=lightPool();
 return <>{lampPositions.map((p,i)=><group key={i} position={p} onClick={e=>{e.stopPropagation();useIsland.getState().dispatch({type:'lamp',id:String(i)});chime();}}><Cylinder position={[0,.8,0]} top={.033} bottom={.07} height={1.6} color="#4f6453"/><Box position={[0,1.72,0]} size={[.24,.32,.24]} color="#f4d8a3"/><mesh position={[0,1.72,0]}><boxGeometry args={[.23,.30,.23]}/><meshStandardMaterial ref={m=>{heads.current[i]=m;}} color="#ddcd98" emissive="#ffd081" emissiveIntensity={0}/></mesh><Cylinder position={[0,1.93,0]} top={0} bottom={.22} height={.17} color="#52725c"/>
  <mesh position={[0,.06,0]} rotation={[-Math.PI/2,0,0]} renderOrder={1} visible={false}><planeGeometry args={i===5?[1.7,1.7]:[2.5,2.5]}/><meshBasicMaterial ref={m=>{pools.current[i]=m;}} map={texture} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} polygonOffset polygonOffsetFactor={-4}/></mesh></group>)}</>;}
/** The island keeps one fixed set of lights (sun, sky, the lighthouse lamp and this one), so no material ever has to
 *  recompile in the middle of a scene. This warm light goes wherever the evening needs it: the birthday table or
 *  Home's desk lamp. */
export const deskLamp={on:null as boolean|null};
const accentWarm=new THREE.Color('#ffcf9a'),accentDesk=new THREE.Color('#ffc98a');
function AccentLight(){const light=useRef<THREE.PointLight>(null);
 useFrame(()=>{const l=light.current;if(!l)return;const s=useIsland.getState();const t=performance.now()/1000;
  if(s.place==='home'){const on=deskLamp.on??(s.save.time==='night');l.position.set(5.62,2.3,-4.23);l.color.copy(accentDesk);l.distance=4.6;l.decay=1.4;l.intensity=on?3.2:0;return;}
  const table=s.save.endingSeen&&(s.place==='celebration'||s.save.time==='night');
  if(table){const lit=s.place==='celebration'&&(s.party===3||s.party===4);l.position.set(0,2.5,6.55);l.color.copy(accentWarm);l.distance=6;l.decay=1.4;
   l.intensity=(s.place==='celebration'?5:2.6)+(lit?1.8+Math.sin(t*19)*.25+Math.sin(t*31)*.14:0);return;}
  l.intensity=0;});
 return <pointLight ref={light} intensity={0} distance={4} decay={1.5}/>;}
// The birthday table on the square: everything she brought back, the cake, and (after the candles) fireworks.
/** The cake is carried out: it rises a little and settles on the table, with a small bounce. */
function CakeStand({show,children}:{show:boolean;children:React.ReactNode}){const g=useRef<THREE.Group>(null);const k=useRef(show?1:0);const since=useRef(0);
 useEffect(()=>{since.current=performance.now();},[show]);
 useFrame(()=>{const o=g.current;if(!o)return;const t=Math.min(1,(performance.now()-since.current)/900);k.current=show?t:Math.max(0,k.current-.08);
  const e=show?1+2.2*Math.pow(t-1,3)+1.2*Math.pow(t-1,2):k.current;o.visible=k.current>.01;o.scale.setScalar(Math.max(.001,show?Math.min(1.04,e):e));o.position.y=.7575+(show?(1-t)*.25:0);});
 return <group ref={g} position={[0,.7575,-.05]} visible={show}>{children}</group>;}
// It is built (hidden) from the start, so its shaders are compiled with everything else while the island loads and
// nothing new has to be prepared when the lamps come on.
function Celebration(){const s=useIsland();const party=s.party;const [boom,setBoom]=useState(false);const last=useRef(party);
 useEffect(()=>{if(party===5&&last.current===4){setBoom(true);const t=setTimeout(()=>setBoom(false),TIMING.fireworks*1000);last.current=party;return()=>clearTimeout(t);}last.current=party;},[party]);
 const here=s.place==='celebration';
 // Arriving at the square she finds the table already laid with her things; the cake comes out after the lamps.
 return <group visible={s.save.endingSeen||here}><group position={[0,1.12,5.4]}>
 <Box position={[0,.66,0]} size={[3.7,.13,1.2]} color="#937357"/><Box position={[0,.745,0]} size={[3.55,.025,1.08]} color="#eadbbd"/>{[-1.4,1.4].map(x=><Box key={x} position={[x,.31,0]} size={[.13,.64,1]} color="#7e644b"/>)}
 <group onClick={e=>{if(!here||s.object||e.delta>8||party<2||party>4)return;e.stopPropagation();if(party===2){strike();s.setParty(3);}else if(party===3){sparkleSound();s.setParty(4);}else{whoosh();s.setParty(5);}}}><CakeStand show={!here||party>=2}><Suspense fallback={null}><Cake lit={here&&(party===3||party===4)} out={!(here&&(party===3||party===4))}/></Suspense></CakeStand></group>
 <FlowerBouquet position={[-1.13,.7575,0]} bouquet={s.save.home.bouquet} scale={1.15}/>
 <Suspense fallback={null}><Food kind="dumpling" position={[1.02,.7575,-.02]}/><Food kind="milk" position={[1.42,.7575,.2]}/></Suspense>
 <Suspense fallback={null}>{scenery.slice(0,2).map((p,i)=><Picture key={p.id} photoId={p.id} position={[-.8+i*.65,.78,.36]} rotation={[-Math.PI/2,0,.1]} scale={.48}/>)}</Suspense>
 {s.save.shots.at(-1)&&<CapturedPrint id={s.save.shots.at(-1)!.id} position={[.55,.78,.35]} scale={.4}/>}
 </group><Bunting show={party>=5||s.save.endingSeen}/><Fireworks active={boom}/></group>;}
function Coast(){const s=useIsland();return <>{s.place==='sunset'&&<><Box position={[-5.5,1.0,7.7]} size={[.45,.04,.3]} color="#f1e4c8"/>{!s.sitting&&!s.sandPhase&&<Hotspot label="坐下，看一会儿日落" position={[-6.4,2.45,7.6]} onClick={()=>s.setSitting(true)}/>}{!s.sandPhase&&<Hotspot label="在沙滩上写点什么" position={[-7,1.0,9.2]} object="sand"/>}</>}{s.place==='cloud'&&s.cloudView==='outside'&&s.weather==='clear'&&<Hotspot label="走进云洞图书馆" position={[8.7,2.1,3.55]} onClick={()=>s.setCloudView('inside')}/>}</>;}
function Rain(){const points=useRef<THREE.Points>(null);const weather=useIsland(s=>s.weather);const reduced=useIsland(s=>s.save.settings.reducedMotion);const vertices=useMemo(()=>new Float32Array(Array.from({length:420*3},(_,i)=>i%3===0?Math.random()*11+4:i%3===1?Math.random()*12:Math.random()*10-2.5)),[]);
 useFrame((_,dt)=>{if(!points.current||weather!=='rain'||reduced)return;const a=points.current.geometry.attributes.position;for(let i=0;i<a.count;i++){a.setY(i,a.getY(i)-dt*5);if(a.getY(i)<1)a.setY(i,12);}a.needsUpdate=true;});
 if(weather!=='rain')return null;return <points ref={points}><bufferGeometry><bufferAttribute attach="attributes-position" args={[vertices,3]}/></bufferGeometry><pointsMaterial color="#dce2df" size={.07} transparent opacity={.65}/></points>;
}
function CameraProps(){const s=useIsland();const spots:Partial<Record<PlaceId,Vec3>>={home:[7.7,1.72,-1.35],park:[-9.0,1.73,-3.0],sunset:[-8.3,1.04,8.2],town:[1.9,2.1,3.6],sunrise:[1.7,2.88,-8]};return <>{Object.entries(spots).map(([id,p])=><group key={id} position={p} {...touch(id as PlaceId,()=>{chime();s.open('camera');})}><Box size={[.36,.23,.14]} color="#eed9b6"/><mesh position={[0,0,.09]} rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[.068,.068,.10,16]}/><meshStandardMaterial color="#253f3d"/></mesh>{s.place===id&&<Hotspot label="借这台相机看看" position={[0,.4,0]} object="camera"/>}</group>)}</>;}
/** A print lying on a table, in the shape it was taken (the viewfinder can be any shape). */
function PrintTexture({url,w,h}:{url:string;w:number;h:number}){const tex=useTexture(url);return <mesh position={[0,0,.018]}><planeGeometry args={[w,h]}/><meshBasicMaterial map={tex} toneMapped={false}/></mesh>;}
function CapturedPrint({id,position,scale=1}:{id:string;position:Vec3;scale?:number}){const shotInfo=useIsland(s=>s.save.shots.find(p=>p.id===id));const aspect=shotInfo?.aspect??(shotInfo?.orientation==='portrait'?3/4:4/3);const w=aspect>=1?.75:.66*aspect,h=aspect>=1?.75/aspect:.66;const [url,setUrl]=useState<string|null>(null);useEffect(()=>{let active=true;let src:string|undefined;getPhoto(id).then(blob=>{if(blob&&active){src=URL.createObjectURL(blob);setUrl(src);}}).catch(()=>{});return()=>{active=false;if(src)URL.revokeObjectURL(src);};},[id]);if(!url)return null;return <group position={position} rotation={[-Math.PI/2,0,.1]} scale={scale}><Box size={[w+.1,h+.18,.025]} position={[0,-.04,0]} color="#fff1db"/><Suspense fallback={null}><PrintTexture url={url} w={w} h={h}/></Suspense></group>;}
function Curtain(){const mesh=useRef<THREE.Mesh>(null);const reduced=useIsland(s=>s.save.settings.reducedMotion);useFrame(({clock})=>{if(!mesh.current||reduced)return;const a=mesh.current.geometry.attributes.position;for(let i=0;i<a.count;i++){const y=a.getY(i);a.setZ(i,Math.sin(a.getX(i)*22+clock.elapsedTime*1.1)*.025+(1-y)*Math.sin(clock.elapsedTime*.8)*.027);}a.needsUpdate=true;});return <mesh ref={mesh} position={[8.36,2.65,-5.7]}><planeGeometry args={[.52,1.06,12,12]}/><meshStandardMaterial color="#d49b9f" side={THREE.DoubleSide} roughness={.9}/></mesh>;}
function Festoon(){const night=useIsland(s=>s.save.time==='night'||s.save.endingSeen&&s.save.time==='sunset'||s.place==='celebration'&&s.party>0);const geometry=useMemo(()=>{const points:Vec3[]=[];for(let i=0;i<=20;i++){const x=-5+i*.5;points.push([x,3.9-Math.sin(i/20*Math.PI)*.8,5.4]);}return points;},[]);return <group>{[-5,5].map(x=><Cylinder key={x} position={[x,2.52,5.4]} top={.035} bottom={.05} height={2.84} color="#4f6453"/>)}<Line points={geometry} color="#657054" lineWidth={1}/>{geometry.filter((_,i)=>i%2===0).map((p,i)=><mesh key={i} position={p}><sphereGeometry args={[.063,8,6]}/><meshStandardMaterial color="#eaddb0" emissive="#ffc77e" emissiveIntensity={night?4:0} toneMapped={!night}/></mesh>)}</group>;}
export default function Objects(){const s=useIsland();useEffect(()=>{if(s.weather!=='rain')return;const timer=setTimeout(()=>{s.setWeather('glow');s.dispatch({type:'secret'});chime();},s.save.settings.reducedMotion?2000:TIMING.rain*1000);return()=>clearTimeout(timer);},[s.weather]);return <><AccentLight/><Plaza/><Lamps/><Festoon/><Tables/><Park/><Coast/><CameraProps/><Celebration/><Rain/><group visible={s.place==='home'||s.save.core.homeSeen}><Home/></group><RedPanda/><ArrivalShimmer/>{s.place==='sunrise'&&s.sunriseStep===0&&<Hotspot label="走进 05:11 的清晨" position={[.6,3.2,-6.3]} onClick={()=>s.setSunrise(1)}/>}</>;}
/** Interactive objects are revealed in a slow sequence while she lingers. */
const GLINTS:Partial<Record<PlaceId,Vec3[]>>={home:[[7.7,1.86,-1.25],[5.95,2.2,-3.98],[6.8,3.25,-5.66],[5.75,1.85,-2.99],[8.78,1.95,-5.22]],diner:[[2.95,1.95,3.72]],flowers:[[-4.3,2.3,3.65]],
 park:[[-8.6,2.0,1.6],[-8.0,1.9,-4.4],[-8.7,1.45,-1.6],[-9.0,2.0,-3.0]],sunset:[[-6.3,1.7,7.65],[-7,1.15,9.2],[-8.3,1.3,8.2]],cloud:[[8.7,2.3,3.55]],town:[[1.9,2.35,3.6]],sunrise:[[-.6,3.0,-7.2],[1.7,3,-7.9]]};
// A quiet round of single glints, then a pause. Papers and hidden tabs suspend the reminders.
export const shimmerState={place:null as PlaceId|null,index:-1,count:0};
function ArrivalShimmer(){const place=useIsland(s=>s.place),object=useIsland(s=>s.object),reduced=useIsland(s=>s.save.settings.reducedMotion);
 useEffect(()=>{shimmerState.place=place;shimmerState.index=-1;if(!place||object||reduced)return;const list=GLINTS[place];if(!list?.length)return;
  let index=0,timer:ReturnType<typeof setTimeout>;const shine=()=>{const s=useIsland.getState();if(s.place!==place||s.object)return;
   if(!document.hidden){const p=list[index];poke('glint',new THREE.Vector3(...p));shimmerState.index=index;shimmerState.count++;index=(index+1)%list.length;}
   timer=setTimeout(shine,index===0?8500:2300);
  };timer=setTimeout(shine,1800);return()=>clearTimeout(timer);
 },[place,object,reduced]);return null;}
/** A potted plant with broad leaves, for the corner of the room. */
function Plant({position}:{position:Vec3}){const leaves=useMemo(()=>Array.from({length:9},(_,i)=>({a:i*2.4,tilt:.5+(i%3)*.22,h:.32+(i%4)*.07})),[]);
 return <group position={position}><mesh position={[0,.14,0]} castShadow><cylinderGeometry args={[.15,.11,.28,20]}/><meshStandardMaterial color="#e3c2a4" roughness={.8}/></mesh>
  {leaves.map((l,i)=><group key={i} position={[0,.26,0]} rotation={[0,l.a,0]}><mesh position={[0,l.h*.5,.08]} rotation={[l.tilt,0,0]}><cylinderGeometry args={[.006,.008,l.h,4]}/><meshStandardMaterial color="#5d8a52"/></mesh>
   <mesh position={[0,l.h*.9,.08+Math.sin(l.tilt)*l.h*.55]} rotation={[-Math.PI/2+l.tilt*.6,0,0]} scale={[.11,.16,1]}><circleGeometry args={[1,14]}/><meshStandardMaterial color={i%2?'#5f9a5a':'#4f8650'} side={THREE.DoubleSide} roughness={.7}/></mesh></group>)}</group>;}
function plopLocal(){chime();}
