import {useEffect,useMemo,useRef} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {useIsland} from '../store';
import {TIMING,SUNSET_RATE} from '../experience';
import {atmosphere,sunsetClock,sunriseDawn} from './atmosphere';
import {poke} from './Pokes';
import {chime,gullCall,sparkleSound,thunder} from '../lib/audio';

// Waiting is part of three places: the sunset coast, the sunrise hill and the rain at the library. Each wait has a
// countdown (the pill in src/ui/Countdown.tsx reads `moment`), a few things that happen on the way, and one moment at
// the end that she can catch with a tap: the green flash as the sun goes into the sea, the first ray of the morning,
// a rainbow after the rain. The green flash is recorded on observation, without a timed tap.

export type Catch='greenFlash'|'firstLight'|'rainbow';
export const moment={kind:null as null|'sunset'|'sunrise'|'rain',remaining:0,progress:0,call:null as null|Catch,callUntil:0,said:'',saidUntil:0};
const SUNSET_TOUCH=48,DAWN=TIMING.dawn,RAIN=TIMING.rain,WINDOW=5000;
const fired=new Set<string>();let rainSince=0;
const say=(text:string,ms=3800)=>{moment.said=text;moment.saidUntil=performance.now()+ms;};
/** A tap anywhere on the world while a moment is open catches it. Called by the world's tap handler. */
export function catchMoment(){const c=moment.call;if(!c||performance.now()>moment.callUntil)return false;moment.call=null;
 const s=useIsland.getState();s.dispatch({type:'surprise',id:c});sparkleSound();chime();burst.at=performance.now();burst.kind=c;
 say({greenFlash:'凡尔纳《绿光》',firstLight:'今天的第一缕光。',rainbow:'彩虹被你看见了。'}[c],4500);return true;}
const burst={at:0,kind:null as Catch|null};
function glowTexture(inner:string,outer:string){const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d')!;const r=g.createRadialGradient(64,64,0,64,64,64);r.addColorStop(0,inner);r.addColorStop(.35,outer);r.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=r;g.fillRect(0,0,128,128);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;}
// A flat band; the colour runs across it from red (outside) to violet (inside), and it fades toward both feet.
const R0=24,R1=27;
const rainbowVertex=`varying vec2 vP;void main(){vP=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const rainbowFragment=`varying vec2 vP;uniform float uShow;
vec3 hue(float h){return clamp(abs(fract(h+vec3(0.,2.,1.)/3.)*6.-3.)-1.,0.,1.);}
void main(){float x=(length(vP)-${R0}.)/(${R1}.-${R0}.);float a=atan(vP.y,vP.x);float feet=smoothstep(0.,.35,a)*smoothstep(3.1416,2.8,a);
 vec3 c=mix(vec3(1.),hue(.78*(1.-x)),.8);float alpha=smoothstep(0.,.18,x)*smoothstep(1.,.82,x)*feet*uShow*.38;gl_FragColor=vec4(c*alpha,alpha);}`;
export default function Moments(){
 const {camera}=useThree();const sun=useRef<THREE.Sprite>(null);const flock=useRef<THREE.Group>(null);const rainbow=useRef<THREE.Mesh>(null);
 const green=useMemo(()=>glowTexture('rgba(150,255,170,.95)','rgba(70,220,120,.55)'),[]),gold=useMemo(()=>glowTexture('rgba(255,250,225,1)','rgba(255,214,140,.5)'),[]);
 const arc=useMemo(()=>new THREE.RingGeometry(R0,R1,96,1,0,Math.PI),[]);
 const arcMat=useMemo(()=>new THREE.ShaderMaterial({uniforms:{uShow:{value:0}},vertexShader:rainbowVertex,fragmentShader:rainbowFragment,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide}),[]);
 useEffect(()=>()=>{green.dispose();gold.dispose();arc.dispose();arcMat.dispose();},[green,gold,arc,arcMat]);
 const weather=useIsland(s=>s.weather);const place=useIsland(s=>s.place);const flockStart=useRef(-1e9),flash=useRef(-1e9);
 useEffect(()=>{if(weather==='rain'){rainSince=performance.now();fired.delete('thunder');fired.delete('rainbow');}},[weather]);
 useEffect(()=>{const glowing=useIsland.getState().weather==='glow';if(!glowing){fired.clear();burst.kind=null;burst.at=0;moment.call=null;moment.said='';moment.saidUntil=0;}},[place]);
 const dir=useMemo(()=>new THREE.Vector3(),[]),rainbowAnchor=useMemo(()=>new THREE.Vector3(),[]);
 useFrame((_,dt)=>{const s=useIsland.getState(),now=performance.now(),reduced=s.save.settings.reducedMotion;moment.kind=null;
  // Sunset: the countdown runs on the same clock as the sky (faster while she sits on the bench).
  if(s.place==='sunset'&&s.weather==='clear'&&!s.object){const rate=reduced?6:(s.sitting?1.5:1)*SUNSET_RATE,p=sunsetClock.progress;moment.kind='sunset';moment.remaining=Math.max(0,(SUNSET_TOUCH-p)/rate);moment.progress=Math.min(1,p/SUNSET_TOUCH);
   if(p>17&&!fired.has('birds')){fired.add('birds');flockStart.current=now;gullCall();}
   if(p>38&&!fired.has('path')){fired.add('path');dir.copy(atmosphere.sunDir).setY(0).normalize();for(let i=0;i<5;i++)setTimeout(()=>poke('glint',camera.position.clone().addScaledVector(dir,9+i*3.5).setY(-.02).add(new THREE.Vector3((Math.random()-.5)*1.5,0,(Math.random()-.5)*1.5))),i*260);}
   if(p>=SUNSET_TOUCH&&!fired.has('touch')){fired.add('touch');s.dispatch({type:'surprise',id:'greenFlash'});burst.at=now;burst.kind='greenFlash';say('凡尔纳《绿光》',4500);}}
  // Sunrise: fourteen seconds of dawn once she is at the top.
  else if(s.place==='sunrise'&&s.sunriseStep>=3){const d=sunriseDawn();moment.kind='sunrise';moment.remaining=(1-d)*(reduced?2:DAWN);moment.progress=d;
   if(d>.3&&!fired.has('birds')){fired.add('birds');flockStart.current=now;gullCall();}
   if(d>=1&&!fired.has('first')){fired.add('first');moment.call='firstLight';moment.callUntil=now+WINDOW;}}
  // Rain at the library, then the glow and a rainbow.
  else if(s.weather==='glow'||s.place==='cloud'&&s.weather==='rain'){const k=Math.min(1,(now-rainSince)/((reduced?2:RAIN)*1000));moment.kind='rain';moment.remaining=s.weather==='rain'?(1-k)*(reduced?2:RAIN):0;moment.progress=s.weather==='rain'?k:1;
   if(s.weather==='rain'&&k>.4&&!fired.has('thunder')){fired.add('thunder');thunder();flash.current=now;}
   if(s.weather==='glow'&&!fired.has('rainbow')){fired.add('rainbow');moment.call='rainbow';moment.callUntil=now+WINDOW+1800;}}
  if(moment.call&&now>moment.callUntil){const missed=moment.call;moment.call=null;say({greenFlash:'绿光一闪就没了。',firstLight:'光已经铺满海面了。',rainbow:'彩虹还在，可以慢慢看。'}[missed],3000);}
  // The sun's own sprite: the green flash on the horizon, or the first gold of the morning.
  const sp=sun.current;if(sp){const call=moment.call,sinceBurst=(now-burst.at)/1000;const showing=call==='greenFlash'||call==='firstLight'||sinceBurst<(burst.kind==='greenFlash'?2.8:1.2)&&(burst.kind==='greenFlash'||burst.kind==='firstLight');
   sp.visible=showing;if(showing){dir.copy(atmosphere.sunDir);dir.y=Math.max(dir.y,.004);dir.normalize();sp.position.copy(camera.position).addScaledVector(dir,360);
    const isGreen=(call??burst.kind)==='greenFlash';const m=sp.material as THREE.SpriteMaterial;m.map=isGreen?green:gold;m.blending=isGreen?THREE.NormalBlending:THREE.AdditiveBlending;const pulse=.75+.25*Math.sin(now/120);const pop=!isGreen&&sinceBurst<1.2?1+(1.2-sinceBurst)*1.5:1;sp.scale.setScalar((isGreen?16:34)*pulse*pop);m.opacity=Math.min(1,showing?.95:0);}}
  // A flock crossing the sky toward the sun.
  const f=flock.current;if(f){const k=(now-flockStart.current)/1000/9;f.visible=k>0&&k<1;if(f.visible){dir.copy(atmosphere.sunDir).setY(0).normalize();const side=new THREE.Vector3(-dir.z,0,dir.x);
   f.position.copy(camera.position).addScaledVector(dir,55).addScaledVector(side,(k-.5)*70);f.position.y=camera.position.y+9+Math.sin(k*Math.PI)*3;f.lookAt(f.position.clone().add(side));
   f.children.forEach((b,i)=>{const w=Math.sin(now/90+i)*.6;(b.children[0] as THREE.Object3D).rotation.z=w;(b.children[1] as THREE.Object3D).rotation.z=-w;});}}
  // Lightning: a soft flash of the whole sky.
  if(now-flash.current<240)atmosphere.haze.lerp(new THREE.Color('#e8eef2'),.4*(1-(now-flash.current)/240));
  const rb=rainbow.current;if(rb){const show=s.weather==='glow';const u=(rb.material as THREE.ShaderMaterial).uniforms.uShow;u.value=THREE.MathUtils.lerp(u.value,show?1:0,Math.min(1,dt*.6));rb.visible=u.value>.01;rb.scale.setScalar(!s.place&&(camera as THREE.PerspectiveCamera).aspect>1?.78:1);if(!s.place){rainbowAnchor.copy(camera.position).setY(0).normalize().multiplyScalar(-46).setY(-3);}else rainbowAnchor.set(-14,-3,30);rb.position.lerp(rainbowAnchor,Math.min(1,dt*2));rb.rotation.y=Math.atan2(camera.position.x-rb.position.x,camera.position.z-rb.position.z);}
 });
 return <group>
  <sprite ref={sun} visible={false} renderOrder={5}><spriteMaterial map={green} transparent depthWrite={false} depthTest={false} blending={THREE.AdditiveBlending} toneMapped={false} fog={false}/></sprite>
  <group ref={flock} visible={false}>{Array.from({length:7},(_,i)=><group key={i} position={[(i%2?-1:1)*Math.ceil(i/2)*1.4,-Math.ceil(i/2)*.7,-Math.ceil(i/2)*1.1]}>
   <mesh position={[.45,0,0]} scale={[.9,.06,.32]}><boxGeometry args={[1,1,1]}/><meshBasicMaterial color="#3b3a44" fog={false}/></mesh>
   <mesh position={[-.45,0,0]} scale={[.9,.06,.32]}><boxGeometry args={[1,1,1]}/><meshBasicMaterial color="#3b3a44" fog={false}/></mesh></group>)}</group>
  {/* The rainbow stands over the sea west of the library, where the camera looks after the rain. */}
  <mesh ref={rainbow} geometry={arc} material={arcMat} position={[-14,-3,30]} rotation={[0,-.75,0]} visible={false}/>
 </group>;
}
