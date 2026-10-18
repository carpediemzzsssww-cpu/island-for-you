import {useEffect,useMemo,useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import {useTexture} from '@react-three/drei';
import * as THREE from 'three';
import {pop} from '../lib/audio';

// The birthday evening on the island square: a two-tier cake with 5 + 1 candles, smoke when they are blown out,
// soft fireworks over the glass sea, and a HAPPY BIRTHDAY bunting on the festoon line.
// Stages live in the store as `party`: 0 arrive · 1 lamps · 2 cake · 3 candles lit · 4 wish made · 5 blown out.

function canvasTexture(w:number,h:number,draw:(ctx:CanvasRenderingContext2D)=>void){
 const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d')!);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;
}
const flameTexture=()=>canvasTexture(64,128,ctx=>{const g=ctx.createRadialGradient(32,92,2,32,80,44);g.addColorStop(0,'rgba(255,255,236,1)');g.addColorStop(.25,'rgba(255,214,140,.95)');g.addColorStop(.6,'rgba(255,150,70,.45)');g.addColorStop(1,'rgba(255,120,40,0)');
 ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(32,6);ctx.bezierCurveTo(52,54,60,92,32,124);ctx.bezierCurveTo(4,92,12,54,32,6);ctx.fill();});
const stripeTexture=(a:string,b:string)=>{const t=canvasTexture(32,128,ctx=>{ctx.fillStyle=a;ctx.fillRect(0,0,32,128);ctx.strokeStyle=b;ctx.lineWidth=7;for(let y=-40;y<170;y+=22){ctx.beginPath();ctx.moveTo(-4,y);ctx.lineTo(36,y-30);ctx.stroke();}});t.wrapS=t.wrapT=THREE.RepeatWrapping;return t;};
const plaqueTexture=()=>canvasTexture(256,128,ctx=>{ctx.fillStyle='#fbf3e3';ctx.beginPath();ctx.roundRect(4,4,248,120,34);ctx.fill();ctx.strokeStyle='#e7c9b6';ctx.lineWidth=5;ctx.beginPath();ctx.roundRect(14,14,228,100,26);ctx.stroke();
 ctx.fillStyle='#b8606f';ctx.font='600 44px "Island Song","Songti SC",serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('好日子',128,66);});

function Lathe({profile,color,y=0,segments=48,rough=.55,clearcoat=0}:{profile:[number,number][];color:string;y?:number;segments?:number;rough?:number;clearcoat?:number}){
 const geometry=useMemo(()=>new THREE.LatheGeometry(profile.map(([r,h])=>new THREE.Vector2(r,h)),segments),[profile,segments]);
 return <mesh geometry={geometry} position={[0,y,0]} castShadow receiveShadow><meshPhysicalMaterial color={color} roughness={rough} clearcoat={clearcoat} clearcoatRoughness={.4}/></mesh>;
}
function Ring({count,radius,y,size,color,jitter=0}:{count:number;radius:number;y:number;size:number;color:string;jitter?:number}){
 const ref=useRef<THREE.InstancedMesh>(null);
 useEffect(()=>{const m=ref.current;if(!m)return;const o=new THREE.Object3D();for(let i=0;i<count;i++){const a=i/count*Math.PI*2;o.position.set(Math.cos(a)*radius,y+(i%2)*jitter,Math.sin(a)*radius);o.scale.setScalar(size*(1+(i%3)*.08));o.updateMatrix();m.setMatrixAt(i,o.matrix);}m.instanceMatrix.needsUpdate=true;},[count,radius,y,size,jitter]);
 return <instancedMesh ref={ref} args={[undefined,undefined,count]}><sphereGeometry args={[1,10,8]}/><meshPhysicalMaterial color={color} roughness={.45} clearcoat={.3}/></instancedMesh>;
}
/** Strawberry glaze dripping over the lower tier's edge. */
function Drips({radius,y}:{radius:number;y:number}){
 const drips=useMemo(()=>Array.from({length:22},(_,i)=>({a:i/22*Math.PI*2+Math.sin(i*7.1)*.06,len:.035+((i*37)%11)/11*.06})),[]);
 return <group>{drips.map((d,i)=><mesh key={i} position={[Math.cos(d.a)*radius,y-d.len/2,Math.sin(d.a)*radius]} scale={[.022,d.len/2+.012,.016]} rotation={[0,-d.a,0]}><sphereGeometry args={[1,10,8]}/><meshPhysicalMaterial color="#efa3b6" roughness={.25} clearcoat={.8}/></mesh>)}</group>;
}
function Strawberry({position,rotation=0}:{position:[number,number,number];rotation?:number}){
 return <group position={position} rotation={[0,rotation,0]}>
  <mesh scale={[.045,.055,.045]} castShadow><sphereGeometry args={[1,14,10]}/><meshPhysicalMaterial color="#d8414f" roughness={.3} clearcoat={.7}/></mesh>
  {[0,1,2,3,4].map(k=><mesh key={k} position={[Math.cos(k*1.26)*.02,.05,Math.sin(k*1.26)*.02]} rotation={[Math.sin(k*1.26)*.9,0,-Math.cos(k*1.26)*.9]} scale={[.012,.004,.026]}><sphereGeometry args={[1,8,6]}/><meshStandardMaterial color="#5f8f4e"/></mesh>)}
 </group>;
}
const CANDLES:[number,number,number,number][]=[...[0,1,2,3,4].map(k=>{const a=Math.PI/2+k*Math.PI*2/5;return [Math.cos(a)*.155,Math.sin(a)*.155,.15,0] as [number,number,number,number];}),[0,-.1,.1,1]];
function Candle({x,z,height,gold,lit,out,phase}:{x:number;z:number;height:number;gold:boolean;lit:boolean;out:boolean;phase:number}){
 const stripes=useMemo(()=>stripeTexture(gold?'#f5d58c':'#fbe7ec',gold?'#e2a84f':'#e48aa0'),[gold]);const flame=useMemo(flameTexture,[]);
 const flameRef=useRef<THREE.Group>(null);const smoke=useRef<THREE.Group>(null);const blown=useRef(-1e9);const glow=useRef(0);const wasLit=useRef(lit);
 const smokeTex=useTexture('/textures/cloud.png');
 // Smoke only when a lit candle is blown out, not when the table is revisited with cold candles.
 useEffect(()=>{if(out&&wasLit.current)blown.current=performance.now();wasLit.current=lit;},[lit,out]);
 useFrame((_,dt)=>{const t=performance.now()/1000+phase;const f=flameRef.current;glow.current=THREE.MathUtils.lerp(glow.current,lit?1:0,Math.min(1,dt*(lit?4:9)));
  if(f){f.visible=glow.current>.02;f.scale.set(glow.current*(1+Math.sin(t*23)*.04),glow.current*(1+Math.sin(t*17)*.12+Math.sin(t*41)*.05),1);f.rotation.z=Math.sin(t*3.1)*.06+Math.sin(t*7.3)*.03;}
  const s=smoke.current;if(s){const age=(performance.now()-blown.current)/1000;s.visible=out&&age<3.2;if(s.visible)s.children.forEach((c,i)=>{const k=Math.max(0,age-i*.12);c.position.set(Math.sin(k*2+i)*.025*k,k*.28,0);c.scale.setScalar(.03+k*.05);((c as THREE.Sprite).material as THREE.SpriteMaterial).opacity=Math.max(0,.42*(1-k/2.6));});}});
 return <group position={[x,0,z]}>
  <mesh position={[0,height/2,0]} castShadow><cylinderGeometry args={[.011,.012,height,12]}/><meshStandardMaterial map={stripes} roughness={.6}/></mesh>
  <mesh position={[0,height+.008,0]}><cylinderGeometry args={[.002,.002,.018,4]}/><meshBasicMaterial color="#3b302a"/></mesh>
  <group ref={flameRef} position={[0,height+.012,0]}>{[0,Math.PI/2].map(r=><mesh key={r} position={[0,.03,0]} rotation={[0,r,0]}><planeGeometry args={[.034,.068]}/><meshBasicMaterial map={flame} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} side={THREE.DoubleSide}/></mesh>)}</group>
  <group ref={smoke} position={[0,height+.03,0]} visible={false}>{[0,1,2,3,4,5].map(i=><sprite key={i}><spriteMaterial map={smokeTex} color="#efe9e2" transparent depthWrite={false} opacity={0}/></sprite>)}</group>
 </group>;
}
// The candlelight itself is the island's shared AccentLight (Objects.tsx), which flickers while the candles burn.
export function Cake({lit,out}:{lit:boolean;out:boolean}){
 const plaque=useMemo(plaqueTexture,[]);
 return <group>
  {/* Porcelain cake stand */}
  <Lathe profile={[[0,0],[.2,0],[.2,.012],[.07,.03],[.045,.06],[.045,.12],[.12,.135],[.5,.14],[.5,.16],[.0,.16]]} color="#f8f4ec" rough={.22} clearcoat={.6}/>
  <group position={[0,.16,0]}>
   <Lathe profile={[[0,0],[.36,0],[.36,.2],[.352,.214],[.33,.22],[0,.22]]} color="#fbf2e2" rough={.62}/>
   <Lathe profile={[[.24,.218],[.33,.218],[.358,.21],[.364,.198],[.34,.226],[.24,.226]]} color="#f2b2c2" rough={.25} clearcoat={.7}/>
   <Drips radius={.362} y={.205}/>
   <Ring count={40} radius={.362} y={.018} size={.02} color="#fdf7ee"/>
   <Lathe profile={[[0,.22],[.245,.22],[.245,.37],[.238,.378],[.222,.38],[0,.38]]} color="#f6c9d2" rough={.55}/>
   <Ring count={30} radius={.236} y={.383} size={.017} color="#fffaf3" jitter={.003}/>
   <Ring count={26} radius={.248} y={.232} size={.015} color="#fffaf3"/>
   <Strawberry position={[.12,.43,.1]} rotation={.4}/><Strawberry position={[-.13,.43,.08]} rotation={1.2}/><Strawberry position={[.02,.43,-.15]} rotation={2.3}/>
   {[[.17,-.06],[-.16,-.09],[-.05,.17],[.08,.16]].map(([x,z],i)=><mesh key={i} position={[x,.392,z]} scale={.02}><sphereGeometry args={[1,10,8]}/><meshPhysicalMaterial color="#39466f" roughness={.35} clearcoat={.5}/></mesh>)}
   <mesh position={[0,.44,.14]} rotation={[-.4,0,0]}><planeGeometry args={[.2,.1]}/><meshStandardMaterial map={plaque} roughness={.5} side={THREE.DoubleSide}/></mesh>
   <group position={[0,.38,0]}>{CANDLES.map(([x,z,h,gold],i)=><Candle key={i} x={x} z={z} height={h} gold={!!gold} lit={lit} out={out} phase={i*1.7}/>)}</group>
  </group>
 </group>;
}

/** Soft pastel fireworks over the town, seen from the sea side above the table and the bunting. Each spark leaves two fading trail points. */
const BURSTS=9,PER=96,TRAIL=3;
const fwVertex=`attribute vec3 tint;attribute float size;uniform float uScale;varying vec3 vTint;
void main(){vTint=tint;vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=size*uScale/max(-mv.z,1.);gl_Position=projectionMatrix*mv;}`;
const fwFragment=`varying vec3 vTint;void main(){float d=length(gl_PointCoord-.5);float a=smoothstep(.5,0.,d);a*=a;if(a<.01)discard;gl_FragColor=vec4(vTint*a,a);}`;
export function Fireworks({active}:{active:boolean}){
 const n=BURSTS*PER*TRAIL;
 const geometry=useMemo(()=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(n*3),3));g.setAttribute('tint',new THREE.BufferAttribute(new Float32Array(n*3),3));const sz=new Float32Array(n);for(let i=0;i<n;i++)sz[i]=[.62,.38,.24][i%TRAIL];g.setAttribute('size',new THREE.BufferAttribute(sz,1));return g;},[n]);
 const material=useMemo(()=>new THREE.ShaderMaterial({uniforms:{uScale:{value:900}},vertexShader:fwVertex,fragmentShader:fwFragment,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}),[]);
 const points=useRef<THREE.Points>(null);const dirty=useRef(false);
 const plan=useRef<{t0:number;bursts:{at:number;c:THREE.Vector3;col:THREE.Color;col2:THREE.Color;v:THREE.Vector3[];popped:boolean}[]}|null>(null);
 useEffect(()=>{if(!active){plan.current=null;return;}const palette=['#ffb3c6','#ffd98c','#b9f2dc','#fff4e0','#f59ab5','#d2bfff'];
  plan.current={t0:performance.now()/1000,bursts:Array.from({length:BURSTS},(_,b)=>({at:b*.66+(b%3)*.14,c:new THREE.Vector3(-9+((b*7)%9)*2.2,9.8+((b*5)%4)*1.4,-7-((b*3)%5)*2.1),col:new THREE.Color(palette[b%palette.length]).multiplyScalar(2.6),col2:new THREE.Color(palette[(b+2)%palette.length]).multiplyScalar(2.2),popped:false,
   v:Array.from({length:PER},(_,i)=>{const u=(i+.5)/PER,phi=Math.acos(1-2*u),th=i*2.399963;const sp=3.4+((i*13)%7)*.2;return new THREE.Vector3(Math.sin(phi)*Math.cos(th)*sp,Math.cos(phi)*sp,Math.sin(phi)*Math.sin(th)*sp);})}))};},[active]);
 useFrame(({camera,gl})=>{const p=plan.current;const pos=geometry.attributes.position as THREE.BufferAttribute,col=geometry.attributes.tint as THREE.BufferAttribute;
  const m=points.current?.material as THREE.ShaderMaterial|undefined;if(m&&camera instanceof THREE.PerspectiveCamera)m.uniforms.uScale.value=gl.domElement.height*.5/Math.tan(THREE.MathUtils.degToRad(camera.fov/2));
  if(!p){if(dirty.current){(col.array as Float32Array).fill(0);col.needsUpdate=true;dirty.current=false;}return;}dirty.current=true;
  const now=performance.now()/1000-p.t0;
  p.bursts.forEach((b,bi)=>{const base=now-b.at;if(base>0&&!b.popped){b.popped=true;pop(.5+bi%3*.2);}
   for(let i=0;i<PER;i++)for(let k=0;k<TRAIL;k++){const idx=(bi*PER+i)*TRAIL+k;const t=base-k*.07;if(t<0||t>3.4){col.setXYZ(idx,0,0,0);continue;}
    const drag=(1-Math.exp(-t*1.5))/1.5;const v=b.v[i];pos.setXYZ(idx,b.c.x+v.x*drag,b.c.y+v.y*drag-.85*t*t,b.c.z+v.z*drag);
    const fade=Math.max(0,1-t/3.4)**1.5*(t<.06?t/.06:1)*(1-k*.32)*(.8+.2*Math.sin(t*28+i));const c=t>1.2?b.col2:b.col;col.setXYZ(idx,c.r*fade,c.g*fade,c.b*fade);}});
  pos.needsUpdate=true;col.needsUpdate=true;});
 return <points ref={points} geometry={geometry} material={material} frustumCulled={false}/>;
}

/** HAPPY BIRTHDAY pennants along the festoon line between the two lamp posts on the square. */
export function Bunting({show}:{show:boolean}){
 const word='CHEERS TO YOU';const colours=['#f2b9c7','#f8ecd4','#bfe0cf','#f6d38e'];
 const textures=useMemo(()=>[...word].map((ch,i)=>canvasTexture(128,148,ctx=>{ctx.fillStyle=colours[i%4];ctx.beginPath();ctx.moveTo(4,4);ctx.lineTo(124,4);ctx.lineTo(64,144);ctx.closePath();ctx.fill();
  ctx.fillStyle=i%4===0?'#ffffff':'#8b5a63';ctx.font='600 54px "Island Song","Songti SC",serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(ch,64,48);})),[]);
 // Backs stay plain: seen from behind, letters would read mirrored.
 const blank=useMemo(()=>colours.map(c=>canvasTexture(128,148,ctx=>{ctx.fillStyle=c;ctx.beginPath();ctx.moveTo(4,4);ctx.lineTo(124,4);ctx.lineTo(64,144);ctx.closePath();ctx.fill();})),[]);
 const group=useRef<THREE.Group>(null);const grow=useRef(0);
 // Always mounted, hidden until shown, so its materials are compiled with the rest of the island.
 useFrame((_,dt)=>{const g=group.current;if(!g)return;grow.current=THREE.MathUtils.lerp(grow.current,show?1:0,Math.min(1,dt*2.2));g.visible=grow.current>.005;if(!g.visible)return;const t=performance.now()/1000;
  g.children.forEach((c,i)=>{const k=THREE.MathUtils.clamp(grow.current*1.6-i*.04,0,1);c.scale.set(k,k,k);c.rotation.x=Math.sin(t*1.4+i*.7)*.12;});});
 return <group ref={group} visible={false}>{[...word].map((ch,i)=>{if(ch===' ')return <group key={i}/>;const u=(i+3)/20;const x=-5+u*10;const y=3.9-Math.sin(u*Math.PI)*.8;
  return <group key={i} position={[x,y-.02,5.4]}><mesh position={[0,-.2,.002]}><planeGeometry args={[.34,.4]}/><meshStandardMaterial map={textures[i]} emissiveMap={textures[i]} emissive="#ffffff" emissiveIntensity={.35} transparent alphaTest={.4} roughness={.8}/></mesh>
   <mesh position={[0,-.2,-.002]} rotation={[0,Math.PI,0]}><planeGeometry args={[.34,.4]}/><meshStandardMaterial map={blank[i%4]} emissiveMap={blank[i%4]} emissive="#ffffff" emissiveIntensity={.3} transparent alphaTest={.4} roughness={.8}/></mesh></group>;})}</group>;
}
