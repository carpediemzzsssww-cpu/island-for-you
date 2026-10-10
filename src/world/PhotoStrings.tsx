import {useEffect,useMemo,useRef,useState} from 'react';
import type {ThreeEvent} from '@react-three/fiber';
import {useFrame} from '@react-three/fiber';
import * as THREE from 'three';
import {photos} from '../content';
import {useIsland} from '../store';

// Home's photo wall: two strings of fairy lights across the back wall, with little polaroids clipped on by wooden
// pegs. Every few seconds one of them turns over and shows another photograph from the whole collection. A tap on
// any of them opens the gallery at that photograph.

const Z=-5.74,X0=5.62,X1=7.98;
const ROWS=[{y:3.56,sag:.11,count:5},{y:2.96,sag:.13,count:5}];
const SLOTS=ROWS.flatMap((r,ri)=>Array.from({length:r.count},(_,i)=>{const u=(i+.5)/r.count;return {x:X0+(X1-X0)*u,y:r.y-r.sag*4*u*(1-u)-.02,tilt:Math.sin(i*2.7+ri*1.3)*.09,row:ri};}));
const loader=new THREE.TextureLoader();const cache=new Map<string,Promise<THREE.Texture>>();
// Cards start with a blank map, so swapping in photographs never changes (and recompiles) the material.
const blank=new THREE.DataTexture(new Uint8Array([246,240,228,255]),1,1);blank.colorSpace=THREE.SRGBColorSpace;blank.needsUpdate=true;
/** A thumbnail cropped to a square (cover), loaded once. */
function photoTexture(src:string){if(!cache.has(src))cache.set(src,new Promise(resolve=>loader.load(src,t=>{t.colorSpace=THREE.SRGBColorSpace;const img=t.image as HTMLImageElement;const a=img.width/img.height;
 if(a>1){t.repeat.set(1/a,1);t.offset.set((1-1/a)/2,0);}else{t.repeat.set(1,a);t.offset.set(0,(1-a)/2);}t.anisotropy=4;resolve(t);})));return cache.get(src)!;}
function sag(y:number,s:number,n=40){return new THREE.CatmullRomCurve3(Array.from({length:n+1},(_,i)=>{const u=i/n;return new THREE.Vector3(X0-.2+(X1-X0+.4)*u,y-s*4*u*(1-u),Z+.012);}));}
export default function PhotoStrings({interactive}:{interactive:boolean}){
 const strings=useMemo(()=>ROWS.map(r=>new THREE.TubeGeometry(sag(r.y+.02,r.sag),60,.006,5,false)),[]);
 const bulbs=useMemo(()=>ROWS.flatMap(r=>Array.from({length:11},(_,i)=>{const u=(i+.25)/11;return [X0-.2+(X1-X0+.4)*u,r.y+.02-r.sag*4*u*(1-u)-.025,Z+.03] as [number,number,number];})),[]);
 const glow=useMemo(()=>new THREE.MeshBasicMaterial({color:new THREE.Color('#ffd79a').multiplyScalar(1.6),toneMapped:false}),[]);
 useEffect(()=>()=>{strings.forEach(g=>g.dispose());glow.dispose();},[strings,glow]);
 // Which photograph hangs in each slot; the first ones come from the start of the collection, then they wander.
 const [shown,setShown]=useState(()=>SLOTS.map((_,i)=>photos[(i*5)%photos.length].id));
 const textures=useRef<(THREE.Texture|null)[]>(SLOTS.map(()=>null));const mats=useRef<(THREE.MeshStandardMaterial|null)[]>([]);const cards=useRef<(THREE.Group|null)[]>([]);
 const flip=useRef<{slot:number;t0:number;next:string;tex:THREE.Texture}|null>(null);
 useEffect(()=>{let live=true;shown.forEach((id,i)=>{const p=photos.find(x=>x.id===id);if(!p||textures.current[i])return;photoTexture(p.thumbnail).then(t=>{if(!live)return;textures.current[i]=t;const m=mats.current[i];if(m){m.map=t;m.emissiveMap=t;}});});return()=>{live=false;};},[]);
 // Now and then, one card turns over to another photograph that is not already on the wall.
 useEffect(()=>{if(useIsland.getState().save.settings.reducedMotion)return;let timer:ReturnType<typeof setTimeout>;
  const next=()=>{timer=setTimeout(async()=>{const cur=shownRef.current;const slot=Math.floor(Math.random()*SLOTS.length);const pool=photos.filter(p=>!cur.includes(p.id));const p=pool[Math.floor(Math.random()*pool.length)];
   if(p&&!flip.current){const tex=await photoTexture(p.thumbnail);flip.current={slot,t0:performance.now(),next:p.id,tex};}next();},4200+Math.random()*2600);};
  next();return()=>clearTimeout(timer);},[]);
 const shownRef=useRef(shown);shownRef.current=shown;
 useFrame(()=>{const f=flip.current;if(!f)return;const g=cards.current[f.slot];if(!g)return;const t=(performance.now()-f.t0)/700;
  if(t>=.5&&textures.current[f.slot]!==f.tex){textures.current[f.slot]=f.tex;const m=mats.current[f.slot];if(m){m.map=f.tex;m.emissiveMap=f.tex;}setShown(s=>s.map((id,i)=>i===f.slot?f.next:id));}
  g.scale.x=Math.max(.02,Math.abs(Math.cos(Math.min(1,t)*Math.PI)));if(t>=1){g.scale.x=1;flip.current=null;}});
 const open=(i:number)=>(e:ThreeEvent<MouseEvent>)=>{const s=useIsland.getState();if(!s.started||s.object||e.delta>8)return;e.stopPropagation();(window as unknown as {__wallPhoto?:string}).__wallPhoto=shownRef.current[i];s.open('wall');};
 const hover={onPointerOver:(e:ThreeEvent<PointerEvent>)=>{if(e.pointerType==='mouse'){e.stopPropagation();document.body.style.cursor='pointer';}},onPointerOut:()=>{document.body.style.cursor='';}};
 return <group>
  {strings.map((g,i)=><mesh key={i} geometry={g}><meshStandardMaterial color="#c9b392" roughness={.9}/></mesh>)}
  {bulbs.map((p,i)=><mesh key={i} position={p} material={glow}><sphereGeometry args={[.017,8,6]}/></mesh>)}
  {SLOTS.map((sl,i)=><group key={i} position={[sl.x,sl.y,Z+.02]} rotation={[0,0,sl.tilt]} onClick={interactive?open(i):undefined} {...(interactive?hover:{})}>
   <mesh position={[0,.012,.012]}><boxGeometry args={[.03,.07,.018]}/><meshStandardMaterial color="#c79b6b" roughness={.7}/></mesh>
   <group ref={g=>{cards.current[i]=g;}}>
    <mesh position={[0,-.2,0]} castShadow><boxGeometry args={[.34,.4,.008]}/><meshStandardMaterial color="#fffaf0" roughness={.85}/></mesh>
    <mesh position={[0,-.17,.005]}><planeGeometry args={[.29,.29]}/><meshStandardMaterial ref={m=>{mats.current[i]=m;}} map={blank} emissiveMap={blank} color="#ffffff" emissive="#ffffff" emissiveIntensity={.3} roughness={.8}/></mesh>
   </group>
  </group>)}
 </group>;
}
