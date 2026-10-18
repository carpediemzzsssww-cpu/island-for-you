import {useEffect,useMemo,useRef} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import {useTexture} from '@react-three/drei';
import * as THREE from 'three';
import {useIsland} from '../store';
import {detailBatch} from './Details';

const candles=Array.from({length:6},(_,i)=>{const a=Math.PI/2+i*Math.PI*2/5;return {x:i===5?0:Math.cos(a)*.148,z:i===5?-.085:Math.sin(a)*.148,h:i===5?.115:.15};});
let baked:THREE.BufferGeometry;
function cakeGeometry(){if(baked)return baked;const b=detailBatch();
 b.lathe([[0,0],[.2,0],[.2,.015],[.075,.035],[.06,.07],[.06,.12],[.44,.135],[.46,.15],[.44,.167],[0,.167]],'#f7f0e3');
 b.lathe([[0,.167],[.34,.167],[.36,.18],[.36,.35],[.353,.37],[.33,.385],[0,.385]],'#f9e8cf');
 b.lathe([[.23,.376],[.345,.376],[.365,.36],[.365,.378],[.34,.397],[.23,.397]],'#e6a4b4');
 for(let i=0;i<16;i++){const a=i*Math.PI/8,l=.03+(i*7%5)*.007;b.sphere([Math.cos(a)*.36,.367-l/2,Math.sin(a)*.36],[.014,l/2+.012,.014],'#e6a4b4');}
 b.lathe([[0,.385],[.224,.385],[.238,.396],[.238,.515],[.23,.535],[.21,.542],[0,.542]],'#efc0ca');
 for(const [count,r,y,size] of [[32,.35,.187,.018],[26,.227,.541,.014],[24,.237,.402,.013]])for(let i=0;i<count;i++){const a=i*Math.PI*2/count;b.sphere([Math.cos(a)*r,y,Math.sin(a)*r],[size,size*.9,size],'#fff6e6');}
 // Fruit has a leafy crown and a few gold seeds, all baked into this same mesh.
 for(const [x,z] of [[.095,.07],[-.1,.065],[.02,-.16]]){
  b.sphere([x,.574,z],[.039,.044,.035],'#ce5363');
  for(let k=0;k<5;k++){const a=k*Math.PI*2/5;b.sphere([x+Math.cos(a)*.016,.612,z+Math.sin(a)*.016],[.018,.003,.008],'#748f52',[0,-a,0]);b.sphere([x+Math.cos(a)*.033,.583,z+Math.sin(a)*.029],[.0025,.0035,.0025],'#f0cf91');}
 }
 for(const [x,z] of [[.175,-.04],[-.16,-.055],[-.03,.17]])b.sphere([x,.56,z],[.017,.017,.017],'#505575');
 candles.forEach(({x,z,h},i)=>{
  const y=.541,base=i===5?'#f6d791':'#fff0e5',stripe=i===5?'#c99b4c':'#ce879c';
  b.lathe([[0,0],[.018,0],[.019,.006],[.014,.016],[0,.016]],'#e8c28c',[x,y,z],16);
  b.add(new THREE.CylinderGeometry(.011,.012,h,16),base,[x,y+h/2+.009,z]);
  // A flush spiral stripe, with no texture load and no per-candle material.
  const positions:number[]=[],indices:number[]=[];
  for(let k=0;k<=40;k++){const t=k/40,a=t*Math.PI*6;for(const offset of [0,.0035])positions.push(x+Math.cos(a)*.0121,y+.013+t*(h-.008)+offset,z+Math.sin(a)*.0121);if(k<40){const j=k*2;indices.push(j,j+1,j+2,j+1,j+3,j+2);}}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();b.add(g,stripe);
  b.add(new THREE.TorusGeometry(.009,.002,4,16),base,[x,y+h+.009,z],[1,1,1],[Math.PI/2,0,0]);
  b.rod([x,y+h+.008,z],[x+.001,y+h+.023,z],.0018,'#51443b');
 });
 baked=b.finish();return baked;
}

export default function Cake({lit,out}:{lit:boolean;out:boolean}){
 const {camera}=useThree();const solid=cakeGeometry(),flames=useRef<THREE.InstancedMesh>(null),smoke=useRef<THREE.Group>(null);
 const wasLit=useRef(lit),blown=useRef(-Infinity),reduced=useIsland(s=>s.save.settings.reducedMotion),texture=useTexture('/textures/cloud.png');
 const flame=useMemo(()=>{
  const c=document.createElement('canvas');c.width=64;c.height=128;const ctx=c.getContext('2d')!;
  const gradient=ctx.createRadialGradient(32,91,3,32,82,49);gradient.addColorStop(0,'#fffff0');gradient.addColorStop(.2,'#fff3bf');gradient.addColorStop(.52,'rgba(255,192,87,.9)');gradient.addColorStop(1,'rgba(255,141,50,0)');
  ctx.fillStyle=gradient;ctx.beginPath();ctx.moveTo(32,5);ctx.bezierCurveTo(29,45,66,82,45,111);ctx.bezierCurveTo(34,128,9,113,13,91);ctx.bezierCurveTo(15,70,29,46,32,5);ctx.fill();
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
 },[]);
 const object=useMemo(()=>new THREE.Object3D(),[]);
 useEffect(()=>{if(out&&wasLit.current)blown.current=performance.now();wasLit.current=lit;},[lit,out]);
 useEffect(()=>()=>flame.dispose(),[flame]);
 useFrame(()=>{
  const now=performance.now()/1000;
  const mesh=flames.current;if(mesh){mesh.visible=lit;if(lit){
   candles.forEach(({x,z,h},i)=>{object.position.set(x,.541+h+.052,z);object.quaternion.copy(camera.quaternion);object.rotateZ(reduced?0:Math.sin(now*4+i)*.055);object.scale.set(1,reduced?1:1+Math.sin(now*17+i)*.08,1);object.updateMatrix();mesh.setMatrixAt(i,object.matrix);});mesh.instanceMatrix.needsUpdate=true;
  }}
  if(smoke.current){const t=(performance.now()-blown.current)/1000;smoke.current.visible=out&&!reduced&&t<2.4;
   if(smoke.current.visible)smoke.current.children.forEach((o,i)=>{const c=candles[i];o.position.set(c.x+Math.sin(t*3+i)*.025*t,.541+c.h+.04+t*.17,c.z);o.scale.setScalar(.025+t*.05);((o as THREE.Sprite).material as THREE.SpriteMaterial).opacity=.24*(1-t/2.4);});}
 });
 return <group name="detailed-cake"><mesh geometry={solid} dispose={null}><meshStandardMaterial vertexColors roughness={.52}/></mesh>
  <instancedMesh ref={flames} args={[undefined,undefined,6]} visible={false}><planeGeometry args={[.045,.079]}/><meshBasicMaterial map={flame} transparent depthWrite={false} toneMapped={false} side={THREE.DoubleSide}/></instancedMesh>
  <group ref={smoke} visible={false}>{candles.map((_,i)=><sprite key={i}><spriteMaterial map={texture} color="#eee7d9" transparent opacity={0} depthWrite={false}/></sprite>)}</group>
 </group>;
}
