import {Suspense,useEffect,useMemo,useRef,useState} from 'react';
import {Canvas,useFrame,useThree} from '@react-three/fiber';
import type {ThreeEvent} from '@react-three/fiber';
import {CameraControls,useGLTF,useTexture} from '@react-three/drei';
import {EffectComposer,Bloom,ToneMapping,FXAA} from '@react-three/postprocessing';
import {ToneMappingMode} from 'postprocessing';
import type {BloomEffect} from 'postprocessing';
import * as THREE from 'three';
import {places} from '../content';
import type {PlaceId} from '../content';
import {useIsland} from '../store';
import {TIMING} from '../experience';
import Objects,{shimmerState} from './Objects';
import LibraryView from './LibraryView';
import Life from './Life';
import {sandTexture,clearSand} from '../lib/sand';
import {atmosphere,stepAtmosphere} from './atmosphere';
import {hillHeight,TRAIL} from './terrain';
import Pokes,{poke,pokeAt} from './Pokes';
import {weather,wind,now} from './sway';
import Moments,{catchMoment} from './Moments';
import {musicState} from '../lib/audio';
import {skyVertex,skyFragment,seaVertex,seaFragment,cloudVertex,cloudFragment} from './shaders';

const DRACO='/draco/';
const clock={elapsed:0};
function Atmosphere(){
 const {scene}=useThree();
 useFrame((_,dt)=>{stepAtmosphere(dt);clock.elapsed+=useIsland.getState().save.settings.reducedMotion?dt*.15:dt;
  if(scene.fog instanceof THREE.Fog){scene.fog.color.copy(atmosphere.haze);}
  if(scene.background instanceof THREE.Color)scene.background.copy(atmosphere.haze);});
 return null;
}
function PaintedSky(){
 const uniforms=useMemo(()=>({uZenith:{value:atmosphere.zenith},uHorizon:{value:atmosphere.horizon},uHaze:{value:atmosphere.haze},uSun:{value:atmosphere.sun},uSunDir:{value:atmosphere.sunDir},uSunDisc:{value:1},uStars:{value:0},uTime:{value:0}}),[]);
 const mesh=useRef<THREE.Mesh>(null);
 // Uniforms are read back from the mesh's own material: StrictMode may build a memo twice, and the frame loop must
 // drive the material that is actually on screen.
 useFrame(({camera})=>{const m=mesh.current;if(!m)return;const u=(m.material as THREE.ShaderMaterial).uniforms;u.uSunDisc.value=atmosphere.sunDisc;u.uStars.value=atmosphere.stars;u.uTime.value=clock.elapsed;m.position.copy(camera.position);});
 return <mesh ref={mesh} renderOrder={-10} frustumCulled={false}><sphereGeometry args={[400,32,16]}/><shaderMaterial side={THREE.BackSide} depthWrite={false} uniforms={uniforms} vertexShader={skyVertex} fragmentShader={skyFragment}/></mesh>;
}
// Planar reflection for the glass sea: the scene mirrored in the water plane (three.js Reflector maths), rendered
// at reduced resolution just before the main frame. Lite mode skips it and the shader mirrors the painted sky.
const SEA_Y=-.08;
// Hilltop seat facing the sunrise (eye, target).
const SUMMIT:[[number,number,number],[number,number,number]]=[[3.3,3.1,-8.6],[9.9,2.3,-18.5]];const _summit=new THREE.Vector3();
const _n=new THREE.Vector3(0,1,0),_p=new THREE.Vector3(),_c=new THREE.Vector3(),_rot=new THREE.Matrix4(),_look=new THREE.Vector3(),_view=new THREE.Vector3(),_target=new THREE.Vector3(),_plane=new THREE.Plane(),_clip=new THREE.Vector4(),_q=new THREE.Vector4();
function renderMirror(gl:THREE.WebGLRenderer,scene:THREE.Scene,camera:THREE.Camera,water:THREE.Object3D,rt:THREE.WebGLRenderTarget,mirror:THREE.PerspectiveCamera,textureMatrix:THREE.Matrix4){
 _p.set(0,SEA_Y,0);_c.setFromMatrixPosition(camera.matrixWorld);_view.subVectors(_p,_c);if(_view.dot(_n)>0)return false;
 _view.reflect(_n).negate().add(_p);_rot.extractRotation(camera.matrixWorld);_look.set(0,0,-1).applyMatrix4(_rot).add(_c);
 _target.subVectors(_p,_look).reflect(_n).negate().add(_p);
 mirror.position.copy(_view);mirror.up.set(0,1,0).applyMatrix4(_rot).reflect(_n);mirror.lookAt(_target);
 mirror.near=(camera as THREE.PerspectiveCamera).near;mirror.far=(camera as THREE.PerspectiveCamera).far;mirror.updateMatrixWorld();mirror.projectionMatrix.copy(camera.projectionMatrix);
 textureMatrix.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1).multiply(mirror.projectionMatrix).multiply(mirror.matrixWorldInverse);
 // Oblique near plane: nothing below the water is drawn into the reflection.
 _plane.setFromNormalAndCoplanarPoint(_n,_p).applyMatrix4(mirror.matrixWorldInverse);_clip.set(_plane.normal.x,_plane.normal.y,_plane.normal.z,_plane.constant);
 const e=mirror.projectionMatrix.elements;_q.set((Math.sign(_clip.x)+e[8])/e[0],(Math.sign(_clip.y)+e[9])/e[5],-1,(1+e[10])/e[14]);
 _clip.multiplyScalar(2/_clip.dot(_q));e[2]=_clip.x;e[6]=_clip.y;e[10]=_clip.z+1;e[14]=_clip.w;mirror.projectionMatrixInverse.copy(mirror.projectionMatrix).invert();
 water.visible=false;const previous=gl.getRenderTarget();
 gl.setRenderTarget(rt);gl.clear();gl.render(scene,mirror);gl.setRenderTarget(previous);
 water.visible=true;return true;
}
const sandBase=new THREE.Color('#ecdcb8'),sandLight=new THREE.Color(),tmp=new THREE.Color();
// The sea's render target, mirror camera and material are built together and travel together on the material,
// so a StrictMode double memo can never pair a material with another instance's reflection.
function makeSea(){
 const rt=new THREE.WebGLRenderTarget(4,4,{type:THREE.HalfFloatType,depthBuffer:true,generateMipmaps:false});const mirror=new THREE.PerspectiveCamera();const matrix=new THREE.Matrix4();
 const material=new THREE.ShaderMaterial({vertexShader:seaVertex,fragmentShader:seaFragment,uniforms:{uTime:{value:0},uDeep:{value:atmosphere.deep},uMid:{value:atmosphere.mid},uShallow:{value:atmosphere.shallow},uFoam:{value:atmosphere.foam},uHaze:{value:atmosphere.haze},uHorizon:{value:atmosphere.horizon},uZenith:{value:atmosphere.zenith},uSun:{value:atmosphere.sun},uSunDir:{value:atmosphere.sunDir},uSunDisc:{value:1},uRain:{value:0},
  uReflection:{value:rt.texture},uReflect:{value:0},uTextureMatrix:{value:matrix},uSand:{value:new THREE.Color()}}});
 material.userData={rt,mirror,matrix,frame:0};return material;
}
function Ocean({reflect}:{reflect:boolean}){
 const weather=useIsland(s=>s.weather),place=useIsland(s=>s.place);const {gl,scene,camera,size}=useThree();const mesh=useRef<THREE.Mesh>(null);const mobile=size.width<760;
 const material=useMemo(makeSea,[]);
 useEffect(()=>()=>{material.userData.rt.dispose();material.dispose();},[material]);
 useEffect(()=>{const m=mesh.current?.material as THREE.ShaderMaterial|undefined;if(!m)return;const k=mobile?.5:.55;m.userData.rt.setSize(Math.max(4,Math.round(size.width*k)),Math.max(4,Math.round(size.height*k)));},[size.width,size.height,gl,mobile]);
 useFrame((_,dt)=>{const water=mesh.current;if(!water)return;const m=water.material as THREE.ShaderMaterial;const u=m.uniforms;const d=m.userData;
  u.uTime.value=clock.elapsed;u.uSunDisc.value=Math.max(atmosphere.sunDisc,atmosphere.stars*.35);u.uRain.value=THREE.MathUtils.lerp(u.uRain.value,weather==='rain'?1:0,Math.min(1,dt*2));
  // The seabed is lit by the same sky and sun as the island.
  sandLight.copy(atmosphere.hemiSky).multiplyScalar(atmosphere.hemiIntensity*.5).add(tmp.copy(atmosphere.sun).multiplyScalar(atmosphere.sunIntensity*.2));u.uSand.value.copy(sandBase).multiply(sandLight);
  if(!reflect||(!['sunset','sunrise','cloud'].includes(place??'')&&weather!=='glow')){u.uReflect.value=0;return;}
  // Phones refresh the mirror every other frame.
  d.frame++;if(mobile&&d.frame%2)return;
  if(renderMirror(gl,scene,camera,water,d.rt,d.mirror,d.matrix))u.uReflect.value=1;});
 const tap=(e:ThreeEvent<MouseEvent>)=>{const s=useIsland.getState();if(!s.started||s.intro||s.object||e.delta>8)return;e.stopPropagation();poke('water',e.point);};
 return <mesh ref={mesh} material={material} rotation={[-Math.PI/2,0,0]} position={[0,SEA_Y,0]} receiveShadow={false} onClick={tap}><planeGeometry args={[900,900]}/></mesh>;
}
// Deterministic cloud banks: tall cumulus on the horizon, a few small clouds drifting over the island.
function cloudPuffs(){
 let seed=511;const rand=()=>{seed=(seed*16807)%2147483647;return (seed-1)/2147483646;};const puffs:number[][]=[];
 const bank=(angle:number,distance:number,base:number,width:number,tall:number,count:number,size:number)=>{
  const cx=Math.cos(angle)*distance,cz=Math.sin(angle)*distance,tx=-Math.sin(angle),tz=Math.cos(angle);
  for(let i=0;i<count;i++){const hf=Math.pow(rand(),1.5);const spread=width*(1-.62*hf);const u=(rand()-.5)*spread,v=(rand()-.5)*spread*.3;
   puffs.push([cx+tx*u+Math.cos(angle)*v,base+hf*tall+rand()*size*.2,cz+tz*u+Math.sin(angle)*v,size*(.75+rand()*.55)*(1-.42*hf),hf,rand()]);}
 };
 // [angle, distance, base height, width, height, puffs, puff size]
 [[-2.95,215,4,54,40,40,21],[-2.4,196,3,40,52,44,22],[-1.85,222,5,70,26,36,19],[-1.3,205,3,44,46,42,21],[-.62,218,4,62,30,34,19],[.25,222,5,58,38,36,20],[1.05,210,3,50,32,34,19],[1.95,200,4,56,44,40,21],[2.9,208,4,48,36,34,20]].forEach(b=>bank(...(b as [number,number,number,number,number,number,number])));
 [[-2.2,104,14,14,4,14,5.4],[-.9,118,17,16,4,14,6],[.6,98,13,12,3,12,5],[1.9,124,18,15,4,14,5.8],[3.0,110,15,13,3,12,5.2]].forEach(b=>bank(...(b as [number,number,number,number,number,number,number])));
 puffs.sort((a,b)=>Math.hypot(b[0],b[2])-Math.hypot(a[0],a[2]));
 return puffs;
}
function PaintedClouds(){
 const texture=useTexture('/textures/cloud.png');const group=useRef<THREE.Group>(null);
 const geometry=useMemo(()=>{const puffs=cloudPuffs();const g=new THREE.InstancedBufferGeometry();const base=new THREE.PlaneGeometry(1,1);g.index=base.index;g.attributes.position=base.attributes.position;g.attributes.uv=base.attributes.uv;
  const col=(i:number)=>new Float32Array(puffs.map(p=>p[i]));g.setAttribute('aOffset',new THREE.InstancedBufferAttribute(new Float32Array(puffs.flatMap(p=>[p[0],p[1],p[2]])),3));g.setAttribute('aScale',new THREE.InstancedBufferAttribute(col(3),1));g.setAttribute('aHeight',new THREE.InstancedBufferAttribute(col(4),1));g.setAttribute('aSeed',new THREE.InstancedBufferAttribute(col(5),1));g.instanceCount=puffs.length;return g;},[]);
 const uniforms=useMemo(()=>({map:{value:texture},uLit:{value:atmosphere.cloudLit},uShade:{value:atmosphere.cloudShade},uHaze:{value:atmosphere.haze},uSun:{value:atmosphere.sun},uSunDir:{value:atmosphere.sunDir},uOpacity:{value:.95}}),[texture]);const puffs=useRef<THREE.Mesh>(null);
 useFrame(()=>{if(group.current)group.current.rotation.y=clock.elapsed*.0008;const m=puffs.current?.material as THREE.ShaderMaterial|undefined;if(m)m.uniforms.uOpacity.value=useIsland.getState().weather==='rain'?.7:.95;});
 return <group ref={group}><mesh ref={puffs} geometry={geometry} frustumCulled={false} renderOrder={-5}><shaderMaterial uniforms={uniforms} vertexShader={cloudVertex} fragmentShader={cloudFragment} transparent depthWrite={false}/></mesh></group>;
}
// Almost nothing on the island moves, so its shadow map is redrawn every other frame (every third on phones), and at
// once whenever the sun moves; the shadow pass was the largest single cost of a frame.
const _sunWas=new THREE.Vector3();
function Lighting(){
 const sun=useRef<THREE.DirectionalLight>(null);const hemi=useRef<THREE.HemisphereLight>(null);const {scene,gl,size}=useThree();const frame=useRef(0);
 useEffect(()=>{if(sun.current){scene.add(sun.current.target);sun.current.target.position.set(0,1,0);}},[scene]);
 useEffect(()=>{gl.shadowMap.autoUpdate=false;gl.shadowMap.needsUpdate=true;return()=>{gl.shadowMap.autoUpdate=true;};},[gl]);
 useFrame(()=>{const s=sun.current,h=hemi.current;if(!s||!h)return;
  frame.current++;if(frame.current%(size.width<760?12:8)===0||_sunWas.distanceToSquared(atmosphere.sunDir)>1e-7){gl.shadowMap.needsUpdate=true;_sunWas.copy(atmosphere.sunDir);}
  s.position.copy(atmosphere.sunDir).multiplyScalar(42).setY(Math.max(atmosphere.sunDir.y*42,6));s.color.copy(atmosphere.sun);s.intensity=atmosphere.sunIntensity;
  h.color.copy(atmosphere.hemiSky);h.groundColor.copy(atmosphere.hemiGround);h.intensity=atmosphere.hemiIntensity;});
 return <><hemisphereLight ref={hemi} args={['#dcebf1','#bba986',1.15]}/><directionalLight ref={sun} position={[-23,21,28]} intensity={2.7} color="#ffe2b6" castShadow shadow-mapSize={[2048,2048]} shadow-camera-left={-24} shadow-camera-right={24} shadow-camera-top={22} shadow-camera-bottom={-22} shadow-camera-near={2} shadow-camera-far={110} shadow-radius={4} shadow-normalBias={.04} shadow-bias={-.0002}/></>;
}
function destinationFor(name:string,point:THREE.Vector3):PlaceId|null{
 if(name==='home')return 'home';if(name==='hill')return 'sunrise';if(name==='park')return 'park';
 if(name==='coast')return point.x>3?'cloud':'sunset';
 if(name==='town')return point.z>0&&point.x< -2?'flowers':point.z>0&&point.x>2?'diner':'town';
 return null;
}
export const hoverBus=new EventTarget();
// Parts of the island model that do something at their place (the bench, the sand, the pavilion, the hill path).
const _spot=new THREE.Vector3();
function spotAction(name:string,point:THREE.Vector3):(()=>void)|null{const s=useIsland.getState();
 if(s.place==='sunset'&&!s.sandPhase){if(!s.sitting&&point.distanceTo(_spot.set(-6.25,1.35,7.65))<1.15)return()=>s.setSitting(true);if(Math.hypot(point.x+7,point.z-9.15)<1.6&&point.y<1.2)return()=>s.open('sand');}
 if(s.place==='cloud'&&s.weather==='clear'&&point.distanceTo(_spot.set(8.7,2.0,3.55))<1.9)return()=>s.setCloudView('inside');
 if(s.place==='sunrise'&&s.sunriseStep===0&&name==='hill')return()=>s.setSunrise(1);
 return null;}
function Region({name}:{name:string}){
 const {scene}=useGLTF(`/models/${name}.glb`,DRACO);const place=useIsland(s=>s.place);
 // Clone scene and materials together so a repeated (StrictMode) memo call can never split them apart.
 const {copy,windows}=useMemo(()=>{const copy=scene.clone(true);const found:THREE.MeshStandardMaterial[]=[];const cloned=new Map<string,THREE.Material>();copy.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=true;o.receiveShadow=true;o.userData.walkObstacle=true;const clone=(m:THREE.Material)=>{if(cloned.has(m.uuid))return cloned.get(m.uuid)!;const c=m.clone();cloned.set(m.uuid,c);weather(c);if(c instanceof THREE.MeshStandardMaterial&&(c.name==='glass'||c.name==='lamp')){c.emissive.set(c.name==='lamp'?'#ffd79a':'#ffc58b');c.emissiveIntensity=0;found.push(c);}return c;};o.material=Array.isArray(o.material)?o.material.map(clone):clone(o.material);}});return {copy,windows:found};},[scene]);
 useFrame((_,dt)=>{const s=useIsland.getState();const lit=atmosphere.stars>.3||atmosphere.mood==='rain'||(s.save.endingSeen&&atmosphere.mood==='night');const dusk=atmosphere.mood.startsWith('sunset')||atmosphere.mood==='glow';windows.forEach(m=>m.emissiveIntensity=THREE.MathUtils.lerp(m.emissiveIntensity,m.name==='lamp'?(lit?2.6:dusk?1.2:.35):lit?1.25:dusk?.35:0,Math.min(dt,0.1)*1.5));});
 useEffect(()=>{copy.traverse(o=>{if(o.name.includes('home_front')||o.name.includes('home_roof')){
  o.visible=place!=='home';
  // Three's raycaster still hits children of invisible groups. The cut-away wall and roof
  // must also release their hit tests, or they swallow clicks on the room's photographs.
  o.traverse(child=>{if(child instanceof THREE.Mesh)child.raycast=o.visible?THREE.Mesh.prototype.raycast:()=>{};});
 }});},[copy,place]);
 const enter=(e:ThreeEvent<MouseEvent>)=>{const state=useIsland.getState();if(!state.started||state.intro||state.object||e.delta>8)return;e.stopPropagation();
  const destination=destinationFor(name,e.point);if(destination&&destination!==state.place){state.travel(destination);document.body.style.cursor='';hoverBus.dispatchEvent(new CustomEvent('hover',{detail:null}));return;}
  const act=state.place?spotAction(name,e.point):null;if(act){act();return;}
  // Not a way in: the island answers the touch (leaves, petals, grass, sand, a wall, the bicycle bell...).
  const mesh=e.object as THREE.Mesh;const mat=Array.isArray(mesh.material)?mesh.material[e.face?.materialIndex??0]:mesh.material;const n=e.face?e.face.normal.clone().transformDirection(mesh.matrixWorld):null;pokeAt(e.point,n,mat?.name??'');};
 const hover=(e:ThreeEvent<PointerEvent>)=>{const s=useIsland.getState();if(!s.started||s.intro||e.pointerType!=='mouse')return;
  if(s.object)return;const destination=destinationFor(name,e.point);
  if(s.place&&(!destination||destination===s.place)){if(spotAction(name,e.point)){e.stopPropagation();document.body.style.cursor='pointer';}else document.body.style.cursor='';return;}
  if(!destination)return;e.stopPropagation();document.body.style.cursor='pointer';hoverBus.dispatchEvent(new CustomEvent('hover',{detail:{place:destination,x:e.nativeEvent.clientX,y:e.nativeEvent.clientY}}));};
 return <primitive object={copy} onClick={enter} onPointerMove={hover} onPointerOut={()=>{document.body.style.cursor='';hoverBus.dispatchEvent(new CustomEvent('hover',{detail:null}));}}/>;
}
useGLTF.preload(['terrain','town','home','park','coast','hill'].map(n=>`/models/${n}.glb`),DRACO);
// The island view orbits the island's own centre (it used to orbit a point high above it, so zooming pushed the
// island down and out of frame). There are no view buttons: drag turns and tilts, the wheel or a pinch zooms toward
// the pointer, a right-drag or two fingers slide the view. Zooming in lowers the camera toward street level, zooming
// out lifts it toward a map, and once she zooms back out the island drifts back to the middle of the frame.
const CENTRE:[number,number,number]=[-.4,1.4,.4];const centre=new THREE.Vector3(...CENTRE);
const AZIMUTH=Math.atan2(24,32);
// Where the orbit point may wander when she slides or zooms toward the pointer: the island's own footprint.
const BOUNDS=new THREE.Box3(new THREE.Vector3(-10,.9,-9.5),new THREE.Vector3(10.5,2.4,10.5));
function islandView(width:number,height:number){
 const aspect=width/height;const portrait=aspect<.8;const fov=portrait?52:aspect<1.25?46:40;
 const halfH=Math.atan(Math.tan(THREE.MathUtils.degToRad(fov/2))*aspect);
 const fit=portrait?.9:aspect<1.25?.8:.68;
 const distance=THREE.MathUtils.clamp(14/(fit*Math.tan(halfH)),26,92);
 return {fov,distance,elevation:portrait?25:aspect<1.25?19:16,portrait};
}
type IslandView=ReturnType<typeof islandView>;
const DEG=Math.PI/180;
// Preferred height for a distance (degrees above the horizon); a drag tilts away from it, a zoom moves along it.
const elevationFor=(v:IslandView,d:number)=>THREE.MathUtils.clamp(v.elevation+(d-v.distance)*.32,5,62);
const polarFor=(v:IslandView,d:number)=>(90-elevationFor(v,d))*DEG;
// How low she may tilt: almost to the street when close, never below the horizon of the whole island when far.
const lowestFor=(v:IslandView,d:number)=>(90-THREE.MathUtils.lerp(4,9,THREE.MathUtils.smoothstep(d,v.distance*.35,v.distance*1.15)))*DEG;
// camera-controls shifts the view by minus the focal offset, so a negative y raises the camera.
const focalFor=(v:IslandView,d:number)=>d*Math.tan(THREE.MathUtils.degToRad(v.fov*(v.portrait?.06:.09)));
/** Eye position, plus the same framing expressed as a plain look-at (focal offset folded in), for scripted moves. */
function islandPose(v:IslandView,d:number,azimuth=AZIMUTH){
 const el=THREE.MathUtils.degToRad(elevationFor(v,d));const sa=Math.sin(azimuth),ca=Math.cos(azimuth);
 const eye=new THREE.Vector3(CENTRE[0]+sa*Math.cos(el)*d,CENTRE[1]+Math.sin(el)*d,CENTRE[2]+ca*Math.cos(el)*d);
 const up=new THREE.Vector3(-sa*Math.sin(el),Math.cos(el),-ca*Math.sin(el)).multiplyScalar(focalFor(v,d));
 return {eye,look:new THREE.Vector3(...CENTRE).add(up),eyeShifted:eye.clone().add(up),offset:focalFor(v,d)};
}
// Scripted moves glide slowly; her own turns, tilts and zooms answer quickly.
const GLIDE=.75,HAND=.3;
const _sph=new THREE.Spherical(),_tgt=new THREE.Vector3();
function Cameras(){
 const controls=useRef<CameraControls>(null);const {size,camera,gl}=useThree();const place=useIsland(s=>s.place);const object=useIsland(s=>s.object);const intro=useIsland(s=>s.intro);const reset=useIsland(s=>s.cameraReset);const reduced=useIsland(s=>s.save.settings.reducedMotion);const step=useIsland(s=>s.sunriseStep);const started=useIsland(s=>s.started);const weather=useIsland(s=>s.weather);const party=useIsland(s=>s.party);const sitting=useIsland(s=>s.sitting);const closeUp=useIsland(s=>s.closeUp);const sandPhase=useIsland(s=>s.sandPhase);const [fireworks,setFireworks]=useState(false);const lastParty=useRef(party);const mobile=size.width<760;const cloudView=useIsland(s=>s.cloudView);
 const idle=useRef(performance.now());const view=useMemo(()=>islandView(size.width,size.height),[size.width,size.height]);const baseFov=useRef(42);
 // The direction she last looked at the island from; coming back from a place pulls back along it.
 const islandAzimuth=useRef(AZIMUTH);const wasIsland=useRef(false);const islandKey=useRef('');const flying=useRef(false);const lastD=useRef(0);const [reach,setReach]=useState(12);
 useEffect(()=>{const c=controls.current;if(!c)return;
 const fovFor=(v:number)=>{baseFov.current=v;if(camera instanceof THREE.PerspectiveCamera){camera.fov=v;camera.updateProjectionMatrix();}};
 // Opening the journal or settings over the island leaves her view exactly where she put it.
 const nowIsland=started&&!intro&&!place,key=`${view.distance}|${view.fov}|${reset}|${reduced}`;
 if(nowIsland&&wasIsland.current&&key===islandKey.current)return;
 if(wasIsland.current)islandAzimuth.current=c.azimuthAngle;islandKey.current=key;
 const glide=(t=GLIDE)=>{c.smoothTime=reduced?.0001:t;flying.current=!reduced;};
 const island=()=>{fovFor(view.fov);const pose=islandPose(view,view.distance,islandAzimuth.current);glide();lastD.current=0;c.setBoundary(BOUNDS);c.setFocalOffset(0,-pose.offset,0,!reduced);return c.setLookAt(pose.eye.x,pose.eye.y,pose.eye.z,...CENTRE,!reduced);};
 wasIsland.current=nowIsland;
 if(!place)c.setBoundary(BOUNDS);else c.setBoundary();
 // Arrival: at sea level, the island seen across the water. Entering lifts the camera over the coast and the town.
 if(!started){fovFor(mobile?50:40);c.setFocalOffset(0,0,0,false);c.setLookAt(...(mobile?[-19,2.2,36]:[-17,1.9,31]) as [number,number,number],-4,2.4,4,false);}
 else if(intro){fovFor(view.fov);const eye=new THREE.Vector3(),look=new THREE.Vector3();c.getPosition(eye);c.getTarget(look);rise.current={t0:performance.now(),eye,look};}
 else if(place){fovFor(mobile?48:42);c.setFocalOffset(0,0,0,!reduced);const p=places[place];let eye=p.camera;let target=p.target;let scripted=false;
  // After the rain the camera looks up and out to sea, so the glowing sky and its puddle reflections fill the frame.
  if(place==='cloud'&&weather==='glow'&&cloudView==='outside'){eye=[10.6,1.8,3.1];target=[4.2,3.3,10.2];scripted=true;}
  if(place==='cloud'&&cloudView==='inside'){eye=[8.65,1.96,1.28];target=[8.18,1.98,4.8];scripted=true;}
  // The birthday evening: wide while the lamps light, close on the cake, then out to sea for the fireworks.
  if(place==='celebration'){const party=useIsland.getState().party;scripted=party>=2;if(party>=2&&party<=3){eye=mobile?[.3,2.95,8.4]:[.25,2.7,7.7];target=[0,1.98,5.35];}else if(party===4){eye=mobile?[.55,2.8,7.7]:[.5,2.55,7.0];target=[0,2.0,5.35];}else if(party===5&&fireworks){eye=mobile?[.5,2.5,13.8]:[.7,2.55,11.8];target=mobile?[0,5.9,-1]:[0,5.4,-1];}else if(party===5){eye=mobile?[.8,2.9,9.4]:[.7,2.55,8.5];target=[0,1.95,5.4];}}
  // After ordering, the camera sits down at the table.
  if(place==='diner'&&useIsland.getState().closeUp&&!object){scripted=true;eye=mobile?[5.05,2.95,6.0]:[4.75,2.62,5.45];target=[3.65,1.86,3.98];}
  if(place==='sunset'){const st=useIsland.getState();if(st.sandPhase>0){scripted=true;eye=mobile?[-7,6.8,13.8]:[-7,6.2,12.8];target=[-7,1,8.95];}else if(st.sitting){scripted=true;eye=[-6.4,2.08,7.86];target=[-13.2,2.4,13.6];}}
  // Sunrise hill: the walk up is scripted below; at the top the camera turns east, where the sun will rise.
  if(place==='sunrise'){if(step===0){eye=[-4.3,5.0,-2.4];target=[-1.0,2.6,-7.0];scripted=true;}else if(step>=3){eye=SUMMIT[0];target=SUMMIT[1];scripted=true;}}
  if(object&&object!=='camera'&&object!=='settings'){
   if(place==='home'){eye=[8,5.8,.4];target=[6.9,2.0,-4.35];}
   if(object==='bouquet'){eye=[-6.8,4.4,8];target=[-4.3,1.9,3.6];}
   if(object==='menu'){eye=[6.5,4.6,8.4];target=[3.6,1.8,4];}
   if(object==='postcards'){eye=[-6.1,2.9,6];target=[-10,2.6,19];}
   if(object==='sand'){eye=[-7,5.5,12];target=[-7,1,8.8];}
  }
  if(mobile&&!scripted){eye=[target[0]+(eye[0]-target[0])*1.32,target[1]+(eye[1]-target[1])*1.32,target[2]+(eye[2]-target[2])*1.32];}
  // In a place she can turn, tilt and lean in, but not wander off: the zoom stops a little behind the place's view.
  const dist=Math.hypot(eye[0]-target[0],eye[1]-target[1],eye[2]-target[2]);setReach(Math.max(dist*1.55,dist+3));
  if(place==='sunrise'&&step===1&&reduced){useIsland.getState().setSunrise(3);}
  else if(place==='sunrise'&&step===1){const from=new THREE.Vector3(),look=new THREE.Vector3();c.getPosition(from);c.getTarget(look);walk.current={t0:performance.now(),a:0,b:1,from,look,gaze:look.clone()};}
  else{walk.current=null;glide(GLIDE);c.setLookAt(...eye,...target,!reduced);}
 }else island();
 idle.current=performance.now();
 },[place,object,intro,reset,reduced,mobile,step,view,started,weather,party,fireworks,sitting,sandPhase>0,closeUp,cloudView]);
 // A scripted glide ends at rest; from then on the camera answers her hands quickly.
 useEffect(()=>{const c=controls.current;if(!c)return;const rest=()=>{flying.current=false;c.smoothTime=HAND;};const take=()=>{flying.current=false;c.smoothTime=HAND;};
  c.addEventListener('rest',rest);c.addEventListener('controlstart',take);return()=>{c.removeEventListener('rest',rest);c.removeEventListener('controlstart',take);};},[]);
 // A second outward scroll at the scene boundary returns to the island instead of feeling stuck.
 useEffect(()=>{const el=gl.domElement;let outward=0;let last=0;
  const leave=(e:WheelEvent)=>{const s=useIsland.getState(),c=controls.current;if(!c||!s.place||s.object||s.place==='celebration'||s.sunriseStep===1||flying.current){outward=0;return;}
   if(e.deltaY<=0||c.distance<c.maxDistance*.97){outward=0;return;}
   const now=performance.now();if(now-last>650)outward=0;last=now;outward+=Math.min(e.deltaY,120);
   if(outward>=180){outward=0;s.travel(null);}
  };el.addEventListener('wheel',leave,{passive:true});return()=>el.removeEventListener('wheel',leave);
 },[gl]);
 // A trackpad pinch arrives as a wheel event with ctrlKey, which camera-controls would turn into a lens zoom.
 // Hand it on as an ordinary wheel, so pinching moves the camera like scrolling does (toward the fingers).
 useEffect(()=>{const el=gl.domElement;const pinch=(e:WheelEvent)=>{if(!e.ctrlKey||!e.isTrusted)return;e.preventDefault();e.stopImmediatePropagation();
  el.dispatchEvent(new WheelEvent('wheel',{deltaX:e.deltaX,deltaY:e.deltaY*3,deltaMode:e.deltaMode,clientX:e.clientX,clientY:e.clientY,bubbles:true,cancelable:true}));};
  el.addEventListener('wheel',pinch,{capture:true,passive:false});return()=>el.removeEventListener('wheel',pinch,{capture:true});},[gl]);
 // Blowing out the candles turns the camera to the fireworks for a while, then back to the table.
 useEffect(()=>{if(party===5&&lastParty.current===4){setFireworks(true);const t=setTimeout(()=>setFireworks(false),reduced?1500:TIMING.fireworks*1000);lastParty.current=party;return()=>clearTimeout(t);}lastParty.current=party;},[party]);
 // Development only: pose the camera from scripts for close-up review.
 useEffect(()=>{if(!import.meta.env.DEV)return;const go=(e:Event)=>{const d=(e as CustomEvent<{eye:number[];target:number[]}>).detail;const c=controls.current;if(!c)return;c.setBoundary();c.setFocalOffset(0,0,0,false);c.setLookAt(d.eye[0],d.eye[1],d.eye[2],d.target[0],d.target[1],d.target[2],false);debugPose.current=true;};window.addEventListener('island-debug-camera',go);return()=>window.removeEventListener('island-debug-camera',go);},[]);
 const debugPose=useRef(false);
 // The walk up the hill trail, at eye height on the real ground, in two stretches.
 const walk=useRef<{t0:number;a:number;b:number;from:THREE.Vector3;look:THREE.Vector3;gaze:THREE.Vector3}|null>(null);
 // One continuous walk to the seat at the top: a steady pace, no bobbing, and a gaze that follows the path smoothly
 // (filtered, so the bends never swing the view), turning to the sea where the sun will rise over the last stretch.
 const trail=useMemo(()=>new THREE.CatmullRomCurve3([...[[-3.7,-4.35],...TRAIL.slice(0,4),[2.2,-8.05]].map(([x,z])=>new THREE.Vector3(x,hillHeight(x,z)+1.55,z)),new THREE.Vector3(...SUMMIT[0])],false,'centripetal',.5),[]);
 useFrame((_,dt)=>{const w=walk.current,c=controls.current;if(!w||!c)return;const s=useIsland.getState();if(s.place!=='sunrise'){walk.current=null;return;}
  const p=Math.min(1,(performance.now()-w.t0)/(TIMING.hillWalk*1000)),e=.5-.5*Math.cos(Math.PI*p),t=w.a+(w.b-w.a)*e;
  const pos=trail.getPointAt(t),ahead=trail.getPointAt(Math.min(1,t+.28));ahead.y=pos.y-.15;
  const turn=THREE.MathUtils.smoothstep(t,.35,.95);ahead.lerp(_summit.set(...SUMMIT[1]),turn);
  w.gaze.lerp(ahead,1-Math.exp(-Math.min(dt,.1)*1.3));
  // Ease out of wherever the camera was into the walk.
  const k=THREE.MathUtils.smoothstep(p,0,.12);pos.lerp(w.from,1-k);
  c.setLookAt(pos.x,pos.y,pos.z,w.gaze.x,w.gaze.y,w.gaze.z,false);if(p>=1){walk.current=null;s.setSunrise(3);}});
 // Opening rise: a slow lift-off from sea level, faster through the middle, settling gently over the island.
 const rise=useRef<{t0:number;eye:THREE.Vector3;look:THREE.Vector3}|null>(null);
 useFrame(()=>{const r=rise.current,c=controls.current;if(!r||!c)return;if(!useIsland.getState().intro){rise.current=null;return;}
  const pose=islandPose(view,view.distance);
  const t=Math.min(1,(performance.now()-r.t0)/(TIMING.intro*1000)),e=t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2,lift=Math.sin(Math.PI*e)*2.4;
  const eye=r.eye.clone().lerp(pose.eyeShifted,e);eye.y+=lift;const look=r.look.clone().lerp(pose.look,e);
  c.setLookAt(eye.x,eye.y,eye.z,look.x,look.y,look.z,false);
  if(t>=1){rise.current=null;c.setLookAt(pose.eye.x,pose.eye.y,pose.eye.z,...CENTRE,false);c.setFocalOffset(0,-pose.offset,0,false);c.smoothTime=HAND;flying.current=false;lastD.current=0;useIsland.getState().finishIntro();}});
 // Island view by hand: a zoom also moves the camera along its preferred height (a drag tilts away from it freely),
 // the lowest tilt follows the distance, and zoomed back out the island drifts back to the middle of the frame.
 useFrame((_,dt)=>{const c=controls.current;const s=useIsland.getState();if(!c||!s.started||s.intro||s.place||debugPose.current)return;
  c.getSpherical(_sph,true);const d=_sph.radius;const lowest=lowestFor(view,d);c.maxPolarAngle=Math.max(lowest,c.minPolarAngle);
  if(!flying.current&&lastD.current>0&&Math.abs(d-lastD.current)>1e-4){const tilt=_sph.phi+polarFor(view,d)-polarFor(view,lastD.current);void c.rotatePolarTo(THREE.MathUtils.clamp(tilt,c.minPolarAngle,lowest),true);}
  lastD.current=d;
  void c.setFocalOffset(0,-focalFor(view,c.distance),0,false);
  const back=THREE.MathUtils.smoothstep(d,view.distance*.72,view.distance*1.02);
  if(back>0&&!flying.current&&c.currentAction===0){c.getTarget(_tgt,true);if(_tgt.distanceToSquared(centre)>4e-4){const f=1-Math.exp(-Math.min(dt,.1)*2.4*back);void c.moveTo(_tgt.x+(centre.x-_tgt.x)*f,_tgt.y+(centre.y-_tgt.y)*f,_tgt.z+(centre.z-_tgt.z)*f,true);}}});
 // The opening rise is interruptible: the first touch, wheel or key gives the camera to her.
 useEffect(()=>{if(!intro)return;const take=()=>{const r=rise.current,c=controls.current;if(r&&c){const pose=islandPose(view,view.distance);rise.current=null;c.smoothTime=GLIDE;flying.current=true;lastD.current=0;c.setFocalOffset(0,-pose.offset,0,true);void c.setLookAt(pose.eye.x,pose.eye.y,pose.eye.z,...CENTRE,true);}useIsland.getState().finishIntro();};const el=gl.domElement;el.addEventListener('pointerdown',take);el.addEventListener('wheel',take,{passive:true});window.addEventListener('keydown',take);return()=>{el.removeEventListener('pointerdown',take);el.removeEventListener('wheel',take);window.removeEventListener('keydown',take);};},[intro,gl,view]);
 useEffect(()=>{const wake=()=>{idle.current=performance.now();};const el=gl.domElement;el.addEventListener('pointerdown',wake);el.addEventListener('wheel',wake,{passive:true});window.addEventListener('keydown',wake);return()=>{el.removeEventListener('pointerdown',wake);el.removeEventListener('wheel',wake);window.removeEventListener('keydown',wake);};},[gl]);
 useFrame((_,dt)=>{const c=controls.current;const s=useIsland.getState();if(!c||!s.started||s.intro||s.place||s.object||reduced)return;
  // Screensaver drift: after a quiet moment the island turns slowly on its own.
  const quiet=(performance.now()-idle.current)/1000;if(quiet>9)c.rotate(Math.min(dt,.05)*.035*Math.min(1,(quiet-9)/4),0,false);});
 const islandMode=!place;const inside=place==='cloud'&&cloudView==='inside';
 // Behind the viewfinder she can also slide the view and come closer, to find her own angle.
 const photo=object==='camera';
 return <CameraControls ref={controls} makeDefault draggingSmoothTime={.12} minDistance={inside?2.8:islandMode?view.distance*.33:place==='home'?3.5:photo?1.8:3} maxDistance={inside?3.2:islandMode?view.distance*1.6:photo?reach*1.4:reach} minPolarAngle={inside?1.25:islandMode?18*DEG:.3} maxPolarAngle={inside?1.65:islandMode?Math.PI*.49:place==='home'?Math.PI*.43:Math.PI*.495} azimuthRotateSpeed={mobile?.5:.62} polarRotateSpeed={islandMode?(mobile?.42:.5):.4} dollySpeed={mobile?.6:.55} truckSpeed={islandMode?1.1:photo?.8:0} dollyToCursor={islandMode} enabled={!intro&&(!object||photo)}/>
}
// Place markers follow their buildings on screen; only re-placed when the view actually changed.
function Navigation(){const inside=useIsland(s=>s.place==='cloud'&&s.cloudView==='inside');return inside?<LibraryView/>:<Cameras/>;}
function PlaceMarkers(){
 const {camera,size}=useThree();const els=useRef<Record<string,HTMLButtonElement|null>>({});const seen=useMemo(()=>new THREE.Matrix4(),[]);const was=useRef('');const v=useMemo(()=>new THREE.Vector3(),[]);
 useFrame(()=>{const s=useIsland.getState();if(!s.started||s.intro||s.place)return;let fresh=false;
  for(const key of Object.keys(places)){const el=els.current[key];if(!el||!el.isConnected){els.current[key]=document.querySelector<HTMLButtonElement>(`[data-place="${key}"]`);fresh=fresh||!!els.current[key];}}
  const dims=`${size.width}x${size.height}`;if(!fresh&&dims===was.current&&seen.equals(camera.matrixWorld))return;seen.copy(camera.matrixWorld);was.current=dims;
  for(const [key,p] of Object.entries(places)){const el=els.current[key];if(!el)continue;
   v.set(p.position[0],p.position[1]-.7,p.position[2]).project(camera);
   el.style.transform=`translate3d(${Math.round((v.x*.5+.5)*size.width)}px,${Math.round((-.5*v.y+.5)*size.height)}px,0) translate(-50%,-50%)`;
   el.style.visibility=v.z<1?'visible':'hidden';}
 });return null;
}
// Writing in the sand: the strokes are grooves pressed into the real beach (the patch follows the beach's curve),
// and when she lets the sea take them, a wave runs up, pauses, slides back, and leaves smooth wet sand to dry.
const BEACH={x:-6.7,y:.875,z:7.9,rx:3.8,ry:.12,rz:2.35};
const beachY=(x:number,z:number)=>BEACH.y+BEACH.ry*Math.sqrt(Math.max(0,1-((x-BEACH.x)/BEACH.rx)**2-((z-BEACH.z)/BEACH.rz)**2));
const sandVertex=`attribute vec2 aWrite;varying vec2 vUv;varying vec2 vWrite;void main(){vUv=uv;vWrite=aWrite;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const sandFragment=`varying vec2 vUv;varying vec2 vWrite;uniform sampler2D uMap;uniform float uFront;uniform float uReach;uniform float uWet;uniform float uErase;uniform float uTime;uniform vec3 uSand;uniform vec3 uFoam;uniform vec3 uWater;
float h1(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h1(i),h1(i+vec2(1,0)),f.x),mix(h1(i+vec2(0,1)),h1(i+1.),f.x),f.y);}
void main(){
 float inside=step(0.,vWrite.x)*step(vWrite.x,1.)*step(0.,vWrite.y)*step(vWrite.y,1.);
 // The canvas texture is flipped on upload, so its top row (v=1) lies inland, away from the sea.
 float ink=texture2D(uMap,vWrite).a*inside;
 float rim=texture2D(uMap,vWrite+vec2(-.004,.007)).a*inside;
 float washed=smoothstep(uReach+.03,uReach-.06,vUv.y)*uErase;ink*=1.-washed;rim*=1.-washed;
 vec3 c=uSand;float a=0.;
 float g=clamp(ink,0.,1.),l=clamp(rim-ink,0.,1.);
 c=mix(c,uSand*.6,g);a=max(a,g*.95);c=mix(c,uSand*1.1,l*.85);a=max(a,l*.65);
 float wet=smoothstep(uReach+.02,uReach-.14,vUv.y)*uWet;c=mix(c,uSand*.76,wet);a=max(a,wet*.6);
 // The front is not a ruler line: it bulges and lags along the beach.
 float front=uFront+.035*sin(vUv.x*6.3+uTime*.7)+.02*sin(vUv.x*15.+1.3);
 float under=smoothstep(front+.01,front-.025,vUv.y);float film=under*(.22+.3*smoothstep(front-.32,front,vUv.y));
 float lace=vn(vec2(vUv.x*40.,vUv.y*22.-uTime*1.3))*.6+vn(vec2(vUv.x*95.,vUv.y*50.+uTime*.9))*.4;
 float foam=smoothstep(.045,0.,abs(vUv.y-front))*smoothstep(.3,.7,lace)*.95+under*smoothstep(.72,.86,lace)*smoothstep(front-.2,front,vUv.y)*.5;
 c=mix(c,uWater,film);a=max(a,film);c=mix(c,uFoam,clamp(foam,0.,1.));a=max(a,clamp(foam,0.,1.));
 float sides=smoothstep(0.,.16,vUv.x)*smoothstep(1.,.84,vUv.x);
 a*=mix(smoothstep(0.,.04,vUv.x)*smoothstep(1.,.96,vUv.x),sides,clamp(under+foam,0.,1.))*smoothstep(1.,.95,vUv.y);
 gl_FragColor=vec4(c,a);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;
function makeSandPatch(){
 const W=40,H=24,x0=-8.7,x1=-5.3,z0=7.99,z1=10.05;const pos:number[]=[],uv:number[]=[],wr:number[]=[],idx:number[]=[];
 for(let j=0;j<=H;j++)for(let i=0;i<=W;i++){const u=i/W,v=j/H,x=x0+(x1-x0)*u,z=z1-(z1-z0)*v;pos.push(x,beachY(x,z)+.007,z);uv.push(u,v);wr.push((x+8.5)/3,(9.61-z)/1.62);}
 for(let j=0;j<H;j++)for(let i=0;i<W;i++){const a=j*(W+1)+i,b=a+1,c=a+W+1,d=c+1;idx.push(a,b,d,a,d,c);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('aWrite',new THREE.Float32BufferAttribute(wr,2));g.setIndex(idx);
 const material=new THREE.ShaderMaterial({uniforms:{uMap:{value:sandTexture()},uFront:{value:-1},uReach:{value:-1},uWet:{value:0},uErase:{value:0},uTime:{value:0},uSand:{value:new THREE.Color()},uFoam:{value:new THREE.Color('#fbfaf3')},uWater:{value:new THREE.Color('#c4e8e0')}},
  vertexShader:sandVertex,fragmentShader:sandFragment,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2});
 return {geometry:g,material};
}
const sandBase2=new THREE.Color('#ead7ae'),sandLit=new THREE.Color(),sandTmp=new THREE.Color();
const ease=(t:number)=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
function SandMesh(){
 const patch=useMemo(makeSandPatch,[]);const mesh=useRef<THREE.Mesh>(null);
 useFrame(()=>{const m=mesh.current?.material as THREE.ShaderMaterial|undefined;if(!m)return;const u=m.uniforms;const s=useIsland.getState();u.uTime.value=clock.elapsed;
  sandLit.copy(atmosphere.hemiSky).multiplyScalar(atmosphere.hemiIntensity*.55).add(sandTmp.copy(atmosphere.sun).multiplyScalar(atmosphere.sunIntensity*.3));u.uSand.value.copy(sandBase2).multiply(sandLit);
  // Water and foam take the same light as the sand, so the wave belongs to the hour (golden, pink, dusk).
  u.uWater.value.copy(atmosphere.shallow).lerp(atmosphere.horizon,.35).multiply(sandLit);u.uFoam.value.copy(atmosphere.foam).multiply(sandTmp.copy(sandLit).setRGB(Math.max(sandLit.r,.62),Math.max(sandLit.g,.62),Math.max(sandLit.b,.62)));
  if(s.sandPhase!==2){u.uFront.value=-1;u.uReach.value=-1;u.uWet.value=0;u.uErase.value=0;return;}
  // Run up (0-2.4 s), pause, slide back (3.1-5.4 s), then the wet sand dries (to 8.8 s).
  const t=(performance.now()-s.sandSince)/1000*(s.save.settings.reducedMotion?3:1);const top=.94;
  const front=t<2.4?-.08+(top+.08)*(1-Math.pow(1-t/2.4,3)):t<3.1?top-.015*Math.sin((t-2.4)*9):t<5.4?top-(top+.1)*ease((t-3.1)/2.3):-.1;
  u.uFront.value=front;u.uReach.value=Math.max(u.uReach.value,front);u.uErase.value=THREE.MathUtils.clamp((t-.7)/1.6,0,1);u.uWet.value=t<5.4?1:Math.max(0,1-(t-5.4)/3.4);
  if(t>8.8){clearSand();s.setSand(0);}});
 return <mesh ref={mesh} geometry={patch.geometry} material={patch.material} renderOrder={2}/>;
}
// Tapping the empty sky at night sends a shooting star across it.
function SkyTaps(){const {camera,gl}=useThree();useEffect(()=>{const el=gl.domElement;let down:[number,number]|null=null;const d=(e:PointerEvent)=>{down=[e.clientX,e.clientY];};
 const u=(e:PointerEvent)=>{const s=useIsland.getState();if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>8||!s.started||s.intro||s.object)return;if(catchMoment()||atmosphere.stars<.3)return;const r=el.getBoundingClientRect();const ndc=new THREE.Vector3((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1,.5).unproject(camera).sub(camera.position).normalize();if(ndc.y<.08)return;poke('star',camera.position.clone().addScaledVector(ndc,60));};
 el.addEventListener('pointerdown',d);el.addEventListener('pointerup',u);return()=>{el.removeEventListener('pointerdown',d);el.removeEventListener('pointerup',u);};},[camera,gl]);return null;}
function Wind(){useFrame((_,dt)=>{now.value=performance.now()/1000;wind.value+=Math.min(dt,.1)*(useIsland.getState().save.settings.reducedMotion?.1:1);});return null;}
function Effects({mobile}:{mobile:boolean}){
 const bloom=useRef<BloomEffect>(null);
 useFrame((_,dt)=>{if(bloom.current)bloom.current.intensity=THREE.MathUtils.lerp(bloom.current.intensity,atmosphere.bloom,Math.min(1,dt*2));});
 // No saturation or contrast passes: on deep-water blues they pushed the red channel below zero, which drew a hard
 // line across the sea on phones. The palette carries the colour instead.
 return <EffectComposer multisampling={mobile?0:4}>
  <Bloom ref={bloom} mipmapBlur radius={.7} intensity={.3} luminanceThreshold={1} luminanceSmoothing={.25}/>
  <ToneMapping mode={ToneMappingMode.NEUTRAL}/>
  {mobile?<FXAA/>:<></>}
 </EffectComposer>;
}
// Hotspots are DOM buttons positioned over the canvas; focusing or clicking one that sits off-screen made the
// browser scroll the canvas wrapper (overflow hidden), which slid the whole picture up. Keep it pinned.
function PinCanvas(){const {gl}=useThree();useEffect(()=>{const wrap=gl.domElement.parentElement?.parentElement;if(!wrap)return;const pin=()=>{if(wrap.scrollTop||wrap.scrollLeft){wrap.scrollTop=0;wrap.scrollLeft=0;}};wrap.addEventListener('scroll',pin);return()=>wrap.removeEventListener('scroll',pin);},[gl]);return null;}
function Diagnostics(){const {gl,scene,camera,advance}=useThree();const count=useRef({frames:0,elapsed:0,fps:0,calls:0,triangles:0});useFrame((_,dt)=>{const c=count.current;c.frames++;c.elapsed+=dt;if(c.elapsed>1){c.fps=Math.round(c.frames/c.elapsed);c.frames=0;c.elapsed=0;}});
 // Post-processing renders several passes per frame; accumulate them and read the total after the composer (priority 1).
 useEffect(()=>{gl.info.autoReset=false;return()=>{gl.info.autoReset=true;};},[gl]);
 useFrame(()=>{count.current.calls=gl.info.render.calls;count.current.triangles=gl.info.render.triangles;gl.info.reset();},2);
 useEffect(()=>{
 const win=window as any;win.render_game_to_text=()=>{const s=useIsland.getState();return JSON.stringify({mode:!s.started?'arrival':s.intro?'intro':s.object?'object':s.place?'place':'island',place:s.place,object:s.object,shimmer:{...shimmerState},core:s.save.core,endingUnlocked:s.save.endingUnlocked,endingSeen:s.save.endingSeen,letterRead:s.save.letterRead,time:s.save.time,mood:atmosphere.mood,weather:s.weather,cloudView:s.cloudView,rainbowUntil:s.rainbowUntil,sunriseStep:s.sunriseStep,bouquet:s.save.home.bouquet,wallPhotos:s.save.home.wallPhotos,shots:s.save.shots.length,music:musicState(),fps:count.current.fps,quality:document.documentElement.dataset.quality??'full',drawCalls:count.current.calls,triangles:count.current.triangles,coordinateSystem:'Y up; island center (0,1,0); sea at Y=-0.08',camera:camera.position.toArray(),availablePlaces:Object.keys(places)});};
 win.advanceTime=async(ms:number)=>{useIsland.getState().tick(ms/1000);gl.render(scene,camera);};
 if(import.meta.env.DEV||new URLSearchParams(location.search).has('perf'))win.__island={store:useIsland,camera,renderer:gl,scene,atmosphere,__step:win.advanceTime};
 return()=>{delete win.render_game_to_text;delete win.advanceTime;delete win.__island;};
 },[gl,scene,camera,advance]);return null;}
// Safety net for slower devices: when the island runs slowly, first lower the resolution a step at a time; only at
// the lowest step drop post-processing (the renderer's own neutral tone mapping keeps colours close). `?lite` forces it.
function Quality({lite,onLite,max}:{lite:boolean;onLite:()=>void;max:number}){
 const {gl,setDpr}=useThree();const span=useRef({t:0,frames:0,ready:performance.now()+8000});const dpr=useRef(max);
 useEffect(()=>{gl.toneMapping=lite?THREE.NeutralToneMapping:THREE.NoToneMapping;document.documentElement.dataset.quality=lite?'lite':'full';},[gl,lite]);
 useFrame((_,dt)=>{const s=useIsland.getState();const w=span.current;if(!s.started||s.intro||s.object||document.hidden||performance.now()<w.ready){w.t=0;w.frames=0;return;}
  w.t+=Math.min(dt,.25);w.frames++;if(w.t<2.5)return;const fps=w.frames/w.t;w.t=0;w.frames=0;
  if(fps<42&&dpr.current>1.01){dpr.current=Math.max(1,dpr.current-.2);setDpr(dpr.current);}else if(fps<30&&!lite)onLite();});
 return null;
}
// While a paper (journal, letter, menu...) covers the island, the island behind it only needs to breathe: 30 frames a
// second instead of every frame, which leaves the page's own animations smooth.
function Breathe({on}:{on:boolean}){const {invalidate}=useThree();useEffect(()=>{if(!on)return;const t=setInterval(()=>invalidate(),1000/30);return()=>clearInterval(t);},[on,invalidate]);return null;}
// Shaders are compiled once, while the island loads: everything that appears later (the birthday table, the cake,
// the bunting, the effects of a tap) is already in the scene, hidden, and compiled here for the same render target
// type the composer uses, so nothing stops to compile in the middle of a scene.
function Warmup({lite}:{lite:boolean}){const {gl,scene,camera}=useThree();
 // Twice: once the island is in, and again after the smaller pieces (photographs, the cake) have loaded too.
 useEffect(()=>{const warm=()=>{try{const rt=lite?null:new THREE.WebGLRenderTarget(4,4,{type:THREE.HalfFloatType});const previous=gl.getRenderTarget();gl.setRenderTarget(rt);void gl.compileAsync(scene,camera).catch(()=>{});gl.setRenderTarget(previous);rt?.dispose();}catch{/* compiling later is only slower */}};
  // Textures of things still hidden (the table's photographs, the bunting) are uploaded now too.
  const upload=()=>{scene.traverse(o=>{const m=(o as THREE.Mesh).material;if(!m)return;for(const mat of Array.isArray(m)?m:[m])for(const key of ['map','emissiveMap','alphaMap']){const t=(mat as unknown as Record<string,THREE.Texture|null>)[key];if(t?.isTexture&&t.image)gl.initTexture(t);}});};
  const a=setTimeout(warm,600),b=setTimeout(()=>{warm();upload();},5000);return()=>{clearTimeout(a);clearTimeout(b);};},[gl,scene,camera,lite]);
 return null;}
// Any positive-priority frame callback (Diagnostics) switches R3F to manual rendering, so the lite path renders itself.
function PlainRender(){useFrame(({gl,scene,camera})=>{gl.render(scene,camera);},1);return null;}
export default function World(){
 const [visible,setVisible]=useState(!document.hidden);const studio=useIsland(s=>s.studio);const covered=useIsland(s=>!!s.object&&s.object!=='camera');const mobile=innerWidth<760;const [lite,setLite]=useState(()=>new URLSearchParams(location.search).has('lite'));
 useEffect(()=>{const fn=()=>setVisible(!document.hidden);document.addEventListener('visibilitychange',fn);return()=>document.removeEventListener('visibilitychange',fn);},[]);
 // Phones start as sharp as desktops; the adaptive quality steps down if one cannot keep up.
 const maxDpr=Math.min(devicePixelRatio,mobile?1.75:1.6);
 return <Canvas frameloop={visible&&!studio?(covered?'demand':'always'):'never'} shadows={{type:THREE.PCFSoftShadowMap}} dpr={lite?1:[1,maxDpr]} camera={{position:[25,20,34],fov:40,near:.1,far:900}} gl={{antialias:true,alpha:false,preserveDrawingBuffer:true,powerPreference:'high-performance',stencil:false}} onCreated={({gl})=>{gl.toneMapping=THREE.NoToneMapping;}}>
  <color attach="background" args={['#e9e1c8']}/><fog attach="fog" args={['#e9e1c8',90,260]}/>
  <Atmosphere/><Wind/><PaintedSky/><Lighting/><Ocean reflect={!lite&&!new URLSearchParams(location.search).has('noreflect')}/>
  <Suspense fallback={null}>{['terrain','town','home','park','coast','hill'].map(name=><Region key={name} name={name}/>)}<PaintedClouds/><PlaceMarkers/><Objects/><Life/><SandMesh/><Pokes/><Moments/><Warmup lite={lite}/></Suspense>
  <Navigation/><PinCanvas/><SkyTaps/><Diagnostics/><Breathe on={covered&&visible&&!studio}/><Quality lite={lite} max={maxDpr} onLite={()=>setLite(true)}/>{lite?<PlainRender/>:<Effects mobile={mobile}/>}
 </Canvas>;
}
