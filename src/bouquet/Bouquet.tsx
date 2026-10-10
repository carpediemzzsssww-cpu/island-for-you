import {useEffect,useMemo,useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {headGeometry,arrange,stemGeometry,wrapGeometry,ribbonGeometry,HEAD_SCALE} from './geometry';
import type {StemPlace} from './geometry';
import {papers,ribbons} from '../content';
import type {Bouquet} from '../lib/state';

// Bouquet models shared by the florist's table (one stem at a time, animated) and the island (merged, cheap).

/** Every stem of a bouquet; bouquets saved before the florist's table had three kinds and no stem list. */
export const stemsOf=(b:Bouquet|null)=>b?(b.stems?.length?b.stems:b.flowers.flatMap(t=>[t,t,t])):[];
// Petals have a soft sheen, and a little of their own colour glows through them, as light does through a real petal.
export const petalMaterial=new THREE.MeshPhysicalMaterial({vertexColors:true,roughness:.52,sheen:.55,sheenRoughness:.45,sheenColor:new THREE.Color('#fff3f5'),side:THREE.DoubleSide});
petalMaterial.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\n totalEmissiveRadiance+=diffuseColor.rgb*.09;');};
petalMaterial.customProgramCacheKey=()=>'petal-glow';
export const greenMaterial=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.62,side:THREE.DoubleSide});
let fibres:THREE.CanvasTexture|null=null;
/** A faint paper grain shared by every wrapping sheet. */
export function paperGrain(){if(fibres)return fibres;const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d')!;g.fillStyle='#ffffff';g.fillRect(0,0,256,256);
 for(let i=0;i<900;i++){g.strokeStyle=`rgba(${120+Math.random()*60},${110+Math.random()*50},${90+Math.random()*40},${.04+Math.random()*.06})`;g.lineWidth=Math.random()*1.2+.3;g.beginPath();const x=Math.random()*256,y=Math.random()*256,a=Math.random()*6.28,l=4+Math.random()*14;g.moveTo(x,y);g.lineTo(x+Math.cos(a)*l,y+Math.sin(a)*l);g.stroke();}
 fibres=new THREE.CanvasTexture(c);fibres.wrapS=fibres.wrapT=THREE.RepeatWrapping;fibres.repeat.set(3,2);fibres.colorSpace=THREE.SRGBColorSpace;return fibres;}
export const paperColour=(id:string)=>papers.find(p=>p.id===id)?.color??'#efe3cb';
export const ribbonColour=(id:string)=>ribbons.find(r=>r.id===id)?.color??'#d68fa1';

/** Head and stem of one stem, placed in bouquet space. */
export function headMatrix(p:StemPlace){return new THREE.Matrix4().compose(p.head,p.tilt,new THREE.Vector3(HEAD_SCALE,HEAD_SCALE,HEAD_SCALE));}

export function Wrapping({paper,ribbon,open=1}:{paper:string;ribbon:string;open?:number}){
 const outer=useMemo(()=>wrapGeometry(0),[]),inner=useMemo(()=>wrapGeometry(1),[]),bow=useMemo(()=>ribbonGeometry(),[]);
 const tissue=paper==='tissue';
 return <group scale={[open,1,open]}>
  <mesh geometry={inner} castShadow><meshStandardMaterial color={tissue?'#fffdf8':'#fdf8ef'} map={paperGrain()} roughness={.9} side={THREE.DoubleSide} transparent opacity={.86}/></mesh>
  <mesh geometry={outer} castShadow scale={[1.04,1,1.04]}><meshStandardMaterial color={paperColour(paper)} map={paperGrain()} roughness={.86} side={THREE.DoubleSide} transparent={tissue} opacity={tissue?.8:1}/></mesh>
  <mesh geometry={bow} castShadow><meshPhysicalMaterial color={ribbonColour(ribbon)} roughness={.36} sheen={1} sheenColor="#ffffff" sheenRoughness={.4}/></mesh>
 </group>;
}

/** The whole bouquet merged into two meshes (flowers, greens) plus its wrapping: for the island. */
export function BouquetModel({bouquet,wrapped=true}:{bouquet:Bouquet;wrapped?:boolean}){
 const stems=stemsOf(bouquet);const key=stems.join(',');
 const geo=useMemo(()=>{const places=arrange(stems);
  const heads=mergeGeometries(places.map(p=>headGeometry(p.type).clone().applyMatrix4(headMatrix(p))),false)!;
  const greens=mergeGeometries(places.map(stemGeometry),false)!;return {heads,greens};},[key]);
 useEffect(()=>()=>{geo.heads.dispose();geo.greens.dispose();},[geo]);
 return <group>
  <mesh geometry={geo.heads} material={petalMaterial} castShadow/>
  <mesh geometry={geo.greens} material={greenMaterial}/>
  {wrapped&&<Wrapping paper={bouquet.paper} ribbon={bouquet.ribbon}/>}
 </group>;
}

/** One stem that settles into its place when it is added: used on the florist's table. */
export function GrowingStem({place,delay=0}:{place:StemPlace;delay?:number}){
 const group=useRef<THREE.Group>(null);const born=useRef(performance.now()+delay*1000);const stem=useMemo(()=>stemGeometry(place),[place]);
 useEffect(()=>()=>stem.dispose(),[stem]);
 useFrame(()=>{const g=group.current;if(!g)return;const t=THREE.MathUtils.clamp((performance.now()-born.current)/650,0,1);const e=1-Math.pow(1-t,3);
  g.position.y=(1-e)*.22;g.scale.setScalar(.35+.65*e);g.rotation.y=(1-e)*.6;});
 return <group ref={group}>
  <mesh geometry={headGeometry(place.type)} material={petalMaterial} position={place.head} quaternion={place.tilt} scale={HEAD_SCALE} castShadow/>
  <mesh geometry={stem} material={greenMaterial} castShadow/>
 </group>;
}

/** A glazed ceramic vase (about 32 cm); the bouquet stands in it, unwrapped. */
const vaseProfile:[number,number][]=[[0,0],[.075,0],[.1,.05],[.112,.15],[.09,.24],[.062,.29],[.066,.31],[.072,.32],[.066,.322],[.058,.3],[.0,.29]];
export function Vase({bouquet,colour='#efe4d6'}:{bouquet:Bouquet|null;colour?:string}){
 const geo=useMemo(()=>new THREE.LatheGeometry(vaseProfile.map(([r,h])=>new THREE.Vector2(r,h)),36),[]);
 return <group>
  <mesh geometry={geo} castShadow receiveShadow><meshPhysicalMaterial color={colour} roughness={.28} clearcoat={.6} clearcoatRoughness={.2}/></mesh>
  {bouquet&&<group position={[0,.33,0]} scale={1.15}><BouquetModel bouquet={bouquet} wrapped={false}/></group>}
 </group>;
}
