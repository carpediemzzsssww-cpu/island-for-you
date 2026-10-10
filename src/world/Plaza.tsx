import {useEffect,useMemo} from 'react';
import type {ThreeEvent} from '@react-three/fiber';
import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {useIsland} from '../store';
import {weather} from './sway';
import {poke} from './Pokes';

// The square in the middle of the island, where the birthday table stands. It used to be a terracotta compass star,
// which read like an emblem; now it is quiet: pale pink pavers laid in rings, a deeper rose border, and a few small
// petal inlays scattered as if they had fallen there. Four planters of pink bougainvillea sit at its edge, clear of the
// roads and the table. The stone kerb around it comes from the island model (scripts/build_island.py, SQUARE).

const CX=0,CZ=5.35,R=2.1,Y=1.142;
function pavingTexture(){
 const N=2048,k=N/2/R,c=document.createElement('canvas');c.width=c.height=N;const g=c.getContext('2d')!;
 let seed=23;const rnd=()=>{seed=(seed*16807)%2147483647;return (seed-1)/2147483646;};
 g.fillStyle='#dcbcb3';g.fillRect(0,0,N,N);g.translate(N/2,N/2);
 const tones=['#f1dbd4','#eed6ce','#f3dfd8','#ebd2ca','#f0d9d1'],rose=['#e7c0ba','#e3b8b2','#eac6c0'];const gap=.011*k;
 // Rings of pavers, each about 27 cm long; the outermost ring is the rose border.
 const edges=[.17,.34,.51,.68,.85,1.02,1.19,1.36,1.53,1.7,1.87,2.1];
 g.fillStyle=tones[2];g.beginPath();g.arc(0,0,edges[0]*k-gap/2,0,Math.PI*2);g.fill();
 for(let e=0;e<edges.length-1;e++){const r0=edges[e],r1=edges[e+1],border=e===edges.length-2;const n=Math.max(6,Math.round(2*Math.PI*(r0+r1)/2/(border?.22:.27)));const off=rnd()*Math.PI;
  for(let i=0;i<n;i++){const a0=off+i/n*Math.PI*2,a1=off+(i+1)/n*Math.PI*2;const list=border?rose:tones;g.fillStyle=list[Math.floor(rnd()*list.length)];
   g.beginPath();g.arc(0,0,r1*k-gap/2,a0+gap/2/(r1*k),a1-gap/2/(r1*k));g.arc(0,0,r0*k+gap/2,a1-gap/2/(r0*k),a0+gap/2/(r0*k),true);g.closePath();g.fill();}}
 // Petal inlays: small five-petal flowers, a shade lighter than the stone, with a rose heart.
 for(let i=0;i<13;i++){const a=rnd()*Math.PI*2,r=(.45+rnd()*1.2)*k,x=Math.cos(a)*r,y=Math.sin(a)*r,s=(.8+rnd()*.45)*k,turn=rnd()*Math.PI;
  for(let p=0;p<5;p++){const t=turn+p/5*Math.PI*2;g.save();g.translate(x+Math.cos(t)*.034*s,y+Math.sin(t)*.034*s);g.rotate(t);g.fillStyle='#f8e9e5';g.strokeStyle='#dfb5ae';g.lineWidth=1.6;g.beginPath();g.ellipse(0,0,.036*s,.021*s,0,0,Math.PI*2);g.fill();g.stroke();g.restore();}
  g.fillStyle='#e6b2ad';g.beginPath();g.arc(x,y,.012*s,0,Math.PI*2);g.fill();}
 // Grain, like a poured terrazzo, and a little shade where the paving meets the kerb.
 for(let i=0;i<9000;i++){const a=rnd()*Math.PI*2,r=Math.sqrt(rnd())*R*k;g.fillStyle=rnd()<.5?'rgba(255,248,244,.35)':'rgba(190,140,130,.18)';g.beginPath();g.arc(Math.cos(a)*r,Math.sin(a)*r,.6+rnd()*1.1,0,Math.PI*2);g.fill();}
 const rim=g.createRadialGradient(0,0,1.86*k,0,0,R*k);rim.addColorStop(0,'rgba(120,80,70,0)');rim.addColorStop(1,'rgba(120,80,70,.16)');g.fillStyle=rim;g.beginPath();g.arc(0,0,R*k,0,Math.PI*2);g.fill();
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t;
}
/** Four terracotta planters of bougainvillea, merged into one mesh. */
function planters(){
 let seed=5;const rnd=()=>{seed=(seed*16807)%2147483647;return (seed-1)/2147483646;};
 const tint=(g:THREE.BufferGeometry,hex:string|((i:number)=>string))=>{const p=g.attributes.position as THREE.BufferAttribute;const col=new Float32Array(p.count*3);const c=new THREE.Color();
  for(let i=0;i<p.count;i++){c.set(typeof hex==='string'?hex:hex(i));col.set([c.r,c.g,c.b],i*3);}g.setAttribute('color',new THREE.BufferAttribute(col,3));g.deleteAttribute('uv');return g;};
 const parts:THREE.BufferGeometry[]=[];
 for(const deg of [-120,-60,50,140]){const a=deg*Math.PI/180,x=CX+Math.cos(a)*1.8,z=CZ+Math.sin(a)*1.8;
  const pot=new THREE.LatheGeometry([[0,0],[.11,0],[.135,.025],[.16,.21],[.175,.22],[.175,.25],[.157,.25],[.152,.235],[0,.235]].map(([r,h])=>new THREE.Vector2(r,h)),28);
  parts.push(tint(pot,i=>{const y=(pot.attributes.position as THREE.BufferAttribute).getY(i);return y>.215?'#eab49a':'#dc9c80';}).translate(x,Y,z));
  // A loose mound of leaves, covered in papery pink bracts, a few spilling over the rim.
  const blobs:[number,number,number,number][]=[];for(let b=0;b<9;b++){const q=b/9*Math.PI*2+rnd()*.6,d=b===0?0:.06+rnd()*.07;blobs.push([Math.cos(q)*d,.33+rnd()*.12+(b===0?.1:0),Math.sin(q)*d,.065+rnd()*.045]);}
  blobs.forEach(([bx,by,bz,br],b)=>{const blob=new THREE.IcosahedronGeometry(br,1);blob.translate(bx,by,bz);parts.push(tint(blob,b%3?'#6e9d5c':'#5a8a52').translate(x,Y,z));});
  for(let f=0;f<78;f++){const [bx,by,bz,br]=blobs[Math.floor(rnd()*blobs.length)];const u=rnd()*Math.PI*2,v=Math.acos(1-rnd()*1.4);const d=new THREE.Vector3(Math.sin(v)*Math.cos(u),Math.cos(v),Math.sin(v)*Math.sin(u));
   const bloom=new THREE.IcosahedronGeometry(.018+rnd()*.016,0);bloom.translate(bx+d.x*br*1.02,by+d.y*br*1.02,bz+d.z*br*1.02);parts.push(tint(bloom,['#e27fa5','#ee9fbd','#f4bccd','#d96796','#e98bb0'][f%5]).translate(x,Y,z));}
  for(let f=0;f<9;f++){const u=rnd()*Math.PI*2,r=.15+rnd()*.04;const bloom=new THREE.IcosahedronGeometry(.02+rnd()*.01,0);bloom.translate(Math.cos(u)*r,.24-rnd()*.06,Math.sin(u)*r);parts.push(tint(bloom,['#ee9fbd','#e27fa5','#f4bccd'][f%3]).translate(x,Y,z));}}
 const merged=mergeGeometries(parts.map(p=>p.index?p.toNonIndexed():p),false)!;parts.forEach(p=>p.dispose());merged.computeVertexNormals();return merged;
}
export default function Plaza(){
 const map=useMemo(pavingTexture,[]);const pots=useMemo(planters,[]);
 const paving=useMemo(()=>{const m=new THREE.MeshStandardMaterial({map,roughness:.92});m.name='plaza';weather(m);return m;},[map]);
 const potMaterial=useMemo(()=>{const m=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.78,flatShading:true});m.name='planters';weather(m);return m;},[]);
 useEffect(()=>()=>{map.dispose();paving.dispose();pots.dispose();potMaterial.dispose();},[map,paving,pots,potMaterial]);
 // A tap on the square scatters a few petals; once the evening is ready, it takes her to the table.
 const tap=(e:ThreeEvent<MouseEvent>)=>{const s=useIsland.getState();if(!s.started||s.intro||s.object||e.delta>8)return;e.stopPropagation();
  if(!s.place&&s.save.endingUnlocked){s.travel('celebration');return;}poke('petals',e.point);};
 return <group>
  <mesh rotation={[-Math.PI/2,0,0]} position={[CX,Y,CZ]} material={paving} receiveShadow onClick={tap}><circleGeometry args={[R,96]}/></mesh>
  <mesh geometry={pots} material={potMaterial} castShadow receiveShadow onClick={e=>{const s=useIsland.getState();if(!s.started||s.intro||s.object||e.delta>8)return;e.stopPropagation();poke('petals',e.point);}}/>
 </group>;
}
