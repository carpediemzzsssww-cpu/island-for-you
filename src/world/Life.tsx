import {useEffect,useMemo,useRef,useState} from 'react';
import {useFrame} from '@react-three/fiber';
import {Sparkles,useTexture} from '@react-three/drei';
import * as THREE from 'three';
import {useIsland} from '../store';
import {atmosphere} from './atmosphere';
import anchors from './anchors.json';
import {horn,gullCall} from '../lib/audio';

// Ambient life: things that move or glow without asking for anything.
const ink:Record<string,string>={'diner':'#9b4235','flower-shop':'#a05a66'};
function drawSign(text:string,w:number,h:number,vertical:boolean,colour:string,glow:boolean,plate?:string){
 const canvas=document.createElement('canvas');const px=vertical?256:512;canvas.width=px;canvas.height=Math.round(px*h/w);const ctx=canvas.getContext('2d')!;
 if(glow){ctx.fillStyle='#000';ctx.fillRect(0,0,canvas.width,canvas.height);}
 // Enamel house plate: coloured ground with a thin light inner border.
 if(plate&&!glow){const r=canvas.height*.16,i=canvas.height*.09;ctx.fillStyle=plate;ctx.beginPath();ctx.roundRect(0,0,canvas.width,canvas.height,r);ctx.fill();ctx.strokeStyle='rgba(255,255,255,.85)';ctx.lineWidth=canvas.height*.035;ctx.beginPath();ctx.roundRect(i,i,canvas.width-2*i,canvas.height-2*i,r*.6);ctx.stroke();}
 ctx.fillStyle=glow?'#fff':colour;ctx.textAlign='center';ctx.textBaseline='middle';
 const family='"Noto Serif SC","Songti SC","STSong",serif';
 if(vertical){const size=Math.min(canvas.width*.62,canvas.height/(text.length+.6));ctx.font=`600 ${size}px ${family}`;[...text].forEach((c,i)=>ctx.fillText(c,canvas.width/2,canvas.height/2+(i-(text.length-1)/2)*size*1.08));}
 else{const size=Math.min(canvas.height*.66,canvas.width*.86/text.length);ctx.font=`600 ${size}px ${family}`;ctx.letterSpacing=`${size*.18}px`;ctx.fillText(text,canvas.width/2+size*.09,canvas.height/2+size*.04);}
 const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=glow?THREE.NoColorSpace:THREE.SRGBColorSpace;tex.anisotropy=4;return tex;
}
function Sign({sign}:{sign:typeof anchors.signs[number]}){
 const material=useRef<THREE.MeshStandardMaterial>(null);const [ready,setReady]=useState(0);const base=sign.id.replace(/-[lr]$/,'');
 const extra=sign as typeof sign&{vertical?:boolean;bg?:string;ink?:string;hideInside?:boolean};const indoors=useIsland(s=>!!extra.hideInside&&s.place==='home');
 const textures=useMemo(()=>ready?[drawSign(sign.text,sign.size[0],sign.size[1],!!extra.vertical,extra.ink??ink[base]??'#3e4b40',false,extra.bg),drawSign(sign.text,sign.size[0],sign.size[1],!!extra.vertical,'',true)]:null,[ready,sign,base,extra]);
 useEffect(()=>{let live=true;document.fonts.load('600 48px "Noto Serif SC"',sign.text).catch(()=>{}).finally(()=>{if(live)setReady(1);});return()=>{live=false;};},[sign.text]);
 useEffect(()=>()=>textures?.forEach(t=>t.dispose()),[textures]);
 useFrame((_,dt)=>{const m=material.current;if(!m)return;const s=useIsland.getState();const night=atmosphere.stars>.3||atmosphere.mood==='rain';
  // The diner sign lights up after the first order; at night every shop sign glows a little.
  const target=extra.bg?0:base==='diner'&&s.save.core.dinerSeen?(night?1.5:.55):night?.85:0;m.emissiveIntensity=THREE.MathUtils.lerp(m.emissiveIntensity,target,Math.min(1,dt*1.5));});
 if(!textures||indoors)return null;
 return <mesh position={sign.position as [number,number,number]} rotation={[0,sign.rotationY,0]}><planeGeometry args={sign.size as [number,number]}/><meshStandardMaterial ref={material} map={textures[0]} emissiveMap={textures[1]} emissive="#ffc987" emissiveIntensity={0} transparent roughness={.8} polygonOffset polygonOffsetFactor={-2}/></mesh>;
}
function Steam({position}:{position:number[]}){
 const texture=useTexture('/textures/cloud.png');const group=useRef<THREE.Group>(null);const puffs=6;
 useFrame(()=>{const g=group.current;if(!g)return;const t=performance.now()/1000;g.children.forEach((c,i)=>{const sprite=c as THREE.Sprite;const k=((t*.22+i/puffs)%1);sprite.position.set(Math.sin(k*5+i)*.12+k*.35,k*1.4,Math.cos(k*4+i)*.08);sprite.scale.setScalar(.22+k*.75);(sprite.material as THREE.SpriteMaterial).opacity=Math.sin(k*Math.PI)*.42*(atmosphere.mood==='rain'?.5:1);});});
 return <group ref={group} position={position as [number,number,number]}>{Array.from({length:puffs},(_,i)=><sprite key={i}><spriteMaterial map={texture} color="#fffaf2" transparent depthWrite={false} opacity={0}/></sprite>)}</group>;
}
function Chime({position}:{position:number[]}){
 const group=useRef<THREE.Group>(null);
 useFrame(()=>{if(!group.current)return;const t=performance.now()/1000;const gust=.6+.4*Math.sin(t*.37);group.current.rotation.z=Math.sin(t*1.9)*.14*gust;group.current.rotation.x=Math.cos(t*1.35)*.09*gust;});
 return <group position={position as [number,number,number]}><group ref={group}>
  <mesh position={[0,-.02,0]}><cylinderGeometry args={[.06,.06,.02,12]}/><meshStandardMaterial color="#b58d66"/></mesh>
  {[0,1,2,3,4].map(i=><mesh key={i} position={[Math.cos(i*1.26)*.042,-.1-i%2*.02,Math.sin(i*1.26)*.042]}><cylinderGeometry args={[.006,.006,.12+i%3*.03,6]}/><meshStandardMaterial color="#e9e3d2" metalness={.3} roughness={.35}/></mesh>)}
  <mesh position={[0,-.27,0]}><planeGeometry args={[.045,.14]}/><meshStandardMaterial color="#e6aab2" side={THREE.DoubleSide}/></mesh>
 </group></group>;
}
const beamVertex=`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const beamFragment=`varying vec2 vUv;uniform float uIntensity;uniform vec3 uColor;void main(){float a=pow(clamp(vUv.y,0.,1.),1.7)*uIntensity*.2;gl_FragColor=vec4(uColor*a,a);}`;
function Lighthouse({position}:{position:number[]}){
 const spin=useRef<THREE.Group>(null);const core=useRef<THREE.MeshBasicMaterial>(null);const light=useRef<THREE.PointLight>(null);
 // One beam material shared by both cones; the frame loop drives the instance that is actually mounted.
 const beam=useMemo(()=>new THREE.ShaderMaterial({uniforms:{uIntensity:{value:0},uColor:{value:new THREE.Color('#ffe2a8')}},vertexShader:beamVertex,fragmentShader:beamFragment,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide}),[]);
 const cone=useMemo(()=>{const g=new THREE.ConeGeometry(1.6,16,24,1,true);g.translate(0,-8,0);return g;},[]);
 useFrame((_,dt)=>{const t=performance.now()/1000;const m=atmosphere.mood;const dark=atmosphere.stars>.3||m==='rain'||m==='violet';const dim=m.startsWith('sunset')||m==='glow'||m==='dawn';
  // The lens glows in the model; the beam and its halo only come out once the sky is dark, and fade in slowly.
  const target=dark?1:dim?.25:0;
  const cone=spin.current?.children[0] as THREE.Mesh|undefined;const uniforms=(cone?.material as THREE.ShaderMaterial|undefined)?.uniforms;if(!uniforms)return;
  uniforms.uIntensity.value=THREE.MathUtils.lerp(uniforms.uIntensity.value,dark?1:0,Math.min(1,dt*.8));
  if(core.current)core.current.opacity=THREE.MathUtils.lerp(core.current.opacity,target,Math.min(1,dt*1.2));
  if(light.current)light.current.intensity=uniforms.uIntensity.value*3;
  if(spin.current&&!useIsland.getState().save.settings.reducedMotion)spin.current.rotation.y=t*.45;});
 return <group position={position as [number,number,number]}>
  <mesh><sphereGeometry args={[.3,16,12]}/><meshBasicMaterial ref={core} color="#fff0c4" transparent opacity={0} toneMapped={false} depthWrite={false}/></mesh>
  <pointLight ref={light} color="#ffd9a0" intensity={0} distance={9} decay={1.6}/>
  <group ref={spin}>{[0,Math.PI].map(r=><mesh key={r} geometry={cone} material={beam} rotation={[0,r,Math.PI/2]}/>)}</group>
 </group>;
}
function Sailboat({radius,speed,phase,hull,sail}:{radius:number;speed:number;phase:number;hull:string;sail:string}){
 const boat=useRef<THREE.Group>(null);const nudge=useRef(-99);
 const sailShape=useMemo(()=>{const s=new THREE.Shape();s.moveTo(0,0);s.quadraticCurveTo(.12,.9,0,1.7);s.quadraticCurveTo(.55,.7,1.05,.1);s.closePath();return new THREE.ShapeGeometry(s,8);},[]);
 const hullShape=useMemo(()=>{const s=new THREE.Shape();s.moveTo(-.26,-.7);s.lineTo(.26,-.7);s.quadraticCurveTo(.3,.3,0,.85);s.quadraticCurveTo(-.3,.3,-.26,-.7);const g=new THREE.ExtrudeGeometry(s,{depth:.26,bevelEnabled:true,bevelThickness:.05,bevelSize:.04,bevelSegments:2,curveSegments:10});g.rotateX(Math.PI/2);g.translate(0,.3,0);return g;},[]);
 useFrame(()=>{const b=boat.current;if(!b)return;const t=performance.now()/1000*(useIsland.getState().save.settings.reducedMotion?.1:1);const a=phase+t*speed;
  // A tap makes the boat answer with its horn and rock for a few seconds.
  const k=Math.max(0,1-(performance.now()/1000-nudge.current)/3.5);const rock=Math.sin(performance.now()/1000*6)*.18*k;
  b.position.set(Math.cos(a)*radius,.02+Math.sin(t*1.2+phase)*.05+Math.abs(rock)*.15,Math.sin(a)*radius*.86);b.rotation.set(Math.sin(t*.8+phase)*.03+rock*.4,-a+(speed>0?-Math.PI/2:Math.PI/2),Math.sin(t*.9+phase)*.05+rock);});
 return <group ref={boat} onClick={e=>{if(e.delta>8)return;e.stopPropagation();nudge.current=performance.now()/1000;horn();}}>
  <mesh geometry={hullShape} castShadow><meshStandardMaterial color={hull}/></mesh>
  <mesh position={[0,.31,-.05]}><boxGeometry args={[.42,.03,1.1]}/><meshStandardMaterial color="#b79270"/></mesh>
  <mesh position={[0,1.2,-.1]}><cylinderGeometry args={[.025,.03,2,6]}/><meshStandardMaterial color="#8a6f55"/></mesh>
  <mesh position={[.02,.35,-.08]} rotation={[0,-Math.PI/2,0]} geometry={sailShape}><meshStandardMaterial color={sail} side={THREE.DoubleSide}/></mesh>
  <mesh position={[0,2.25,-.1]}><boxGeometry args={[.02,.12,.22]}/><meshStandardMaterial color="#e6a5b1"/></mesh>
 </group>;
}
function Gulls(){
 const birds=useRef<THREE.Group>(null);const startle=useRef(-99);const flock=useMemo(()=>Array.from({length:5},(_,i)=>({r:15+i*1.6,h:9+i%3*1.3,speed:.07+i*.006,phase:i*.9})),[]);
 useFrame(()=>{const g=birds.current;if(!g)return;const t=performance.now()/1000*(useIsland.getState().save.settings.reducedMotion?.1:1);const asleep=atmosphere.stars>.4;g.visible=!asleep;
  // Startled gulls climb and flap hard for a few seconds.
  const scare=Math.max(0,1-(performance.now()/1000-startle.current)/4);
  g.children.forEach((bird,i)=>{const f=flock[i];const a=f.phase+t*f.speed;bird.position.set(Math.cos(a)*f.r*(1+scare*.25)-1,f.h+Math.sin(t*.5+i)*.6+scare*(2.5+i*.4),Math.sin(a)*f.r*.8*(1+scare*.25));bird.rotation.y=-a;bird.rotation.z=Math.sin(t*.5+i)*.12;
   const flap=Math.sin(t*(5+i*.4+scare*9)+i)*(.35+scare*.25)+.12;(bird.children[0] as THREE.Object3D).rotation.z=flap;(bird.children[1] as THREE.Object3D).rotation.z=-flap;});});
 return <group ref={birds} onClick={e=>{if(e.delta>8)return;e.stopPropagation();startle.current=performance.now()/1000;gullCall();}}>{flock.map((_,i)=><group key={i} scale={.9}>
  <group><mesh position={[.24,0,0]}><boxGeometry args={[.46,.02,.13]}/><meshStandardMaterial color="#f7f2e8"/></mesh><mesh position={[.5,-.02,0]}><boxGeometry args={[.1,.021,.1]}/><meshStandardMaterial color="#8f989b"/></mesh></group>
  <group><mesh position={[-.24,0,0]}><boxGeometry args={[.46,.02,.13]}/><meshStandardMaterial color="#f7f2e8"/></mesh><mesh position={[-.5,-.02,0]}><boxGeometry args={[.1,.021,.1]}/><meshStandardMaterial color="#8f989b"/></mesh></group>
  <mesh scale={[.08,.07,.22]}><sphereGeometry args={[1,10,8]}/><meshStandardMaterial color="#fbf8f0"/></mesh>
 </group>)}</group>;
}
function Fireflies(){
 const night=useIsland(s=>s.save.time==='night'||s.save.endingSeen&&s.save.time==='sunset'||s.place==='sunrise'&&s.sunriseStep<2);const reduced=useIsland(s=>s.save.settings.reducedMotion);
 if(!night)return null;
 return <><Sparkles count={30} position={[-8.4,1.9,-1.8]} scale={[5,1.6,6]} size={3.2} speed={reduced?0:.28} color="#ffe29a" opacity={.9} noise={1.2}/><Sparkles count={16} position={[7,1.8,-1.6]} scale={[4,1.2,2.4]} size={2.8} speed={reduced?0:.25} color="#ffe6a8" opacity={.85}/><Sparkles count={18} position={[0,3.4,-7.6]} scale={[6,1.4,4]} size={2.6} speed={reduced?0:.22} color="#fff0b8" opacity={.7}/></>;
}
// A flat mirror of the painted sky: the library pool, and rain puddles that catch the after-rain glow (积水反射).
const mirrorVertex=`varying vec3 vWorld;void main(){vec4 w=modelMatrix*vec4(position,1.);vWorld=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`;
const mirrorFragment=`varying vec3 vWorld;uniform vec3 uZenith;uniform vec3 uHorizon;uniform vec3 uSun;uniform vec3 uSunDir;uniform vec3 uTint;uniform float uTime;uniform float uAlpha;
void main(){vec3 v=normalize(vWorld-cameraPosition);vec3 r=reflect(v,vec3(0.,1.,0.));r.y+=sin(vWorld.x*7.+uTime*1.3)*sin(vWorld.z*6.-uTime*1.1)*.015;r=normalize(r);
 vec3 sky=mix(uHorizon,uZenith,pow(smoothstep(-.01,.42,r.y),.62));float sd=max(dot(r,uSunDir),0.);sky+=uSun*(pow(sd,40.)*.45+pow(sd,500.)*1.6);
 float fres=.52+.48*pow(1.-clamp(-v.y,0.,1.),3.);vec3 c=mix(uTint,sky,fres);gl_FragColor=vec4(c,uAlpha);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;
function roundedRect(w:number,d:number,r:number){const s=new THREE.Shape();s.moveTo(-w/2+r,-d/2);s.lineTo(w/2-r,-d/2);s.quadraticCurveTo(w/2,-d/2,w/2,-d/2+r);s.lineTo(w/2,d/2-r);s.quadraticCurveTo(w/2,d/2,w/2-r,d/2);s.lineTo(-w/2+r,d/2);s.quadraticCurveTo(-w/2,d/2,-w/2,d/2-r);s.lineTo(-w/2,-d/2+r);s.quadraticCurveTo(-w/2,-d/2,-w/2+r,-d/2);return new THREE.ShapeGeometry(s,6);}
function Mirror({position,size,circle=false,radius=0,visible=1}:{position:[number,number,number];size:[number,number];circle?:boolean;radius?:number;visible?:number}){
 const rounded=useMemo(()=>radius?roundedRect(size[0],size[1],radius):null,[radius,size[0],size[1]]);
 const uniforms=useMemo(()=>({uZenith:{value:atmosphere.zenith},uHorizon:{value:atmosphere.horizon},uSun:{value:atmosphere.sun},uSunDir:{value:atmosphere.sunDir},uTint:{value:new THREE.Color('#4f8783')},uTime:{value:0},uAlpha:{value:visible}}),[]);
 const surface=useRef<THREE.Mesh>(null);
 useFrame((_,dt)=>{const u=(surface.current?.material as THREE.ShaderMaterial|undefined)?.uniforms;if(!u)return;u.uTime.value=performance.now()/1000;u.uAlpha.value=THREE.MathUtils.lerp(u.uAlpha.value,visible,Math.min(1,dt*1.2));});
 return <mesh ref={surface} position={position} rotation={[-Math.PI/2,0,0]} renderOrder={1} geometry={rounded??undefined}>{rounded?null:circle?<circleGeometry args={[size[0],28]}/>:<planeGeometry args={size}/>}<shaderMaterial uniforms={uniforms} vertexShader={mirrorVertex} fragmentShader={mirrorFragment} transparent depthWrite={false} polygonOffset polygonOffsetFactor={-2}/></mesh>;
}
function Puddles(){const wet=useIsland(s=>s.weather!=='clear'&&s.place==='cloud');return <>{([[7.8,3.0,.42],[10.35,3.3,.33],[9.45,4.85,.3],[7.05,1.6,.3],[10.6,.6,.26]] as const).map(([x,z,r],i)=><Mirror key={i} position={[x,1.14,z]} size={[r,r]} circle visible={wet?1:0}/>)}</>;}
export default function Life(){
 return <>
  {anchors.signs.map(sign=><Sign key={sign.id} sign={sign}/>)}
  {anchors.steam.map((p,i)=><Steam key={i} position={p}/>)}
  {anchors.chimes.map((p,i)=><Chime key={i} position={p}/>)}
  {anchors.lanterns.map((p,i)=><Lighthouse key={i} position={p}/>)}
  <Sailboat radius={23} speed={.012} phase={2.2} hull="#e9e1d3" sail="#e8dfcf"/>
  <Sailboat radius={47} speed={-.006} phase={-.6} hull="#8fb5c2" sail="#e9d3cc"/>
  {anchors.pool?<Mirror position={[anchors.pool[0],anchors.pool[1],anchors.pool[2]]} size={[anchors.pool[3],anchors.pool[4]]} radius={anchors.pool[5]??0}/>:null}<Puddles/>
  <Gulls/><Fireflies/>
 </>;
}
