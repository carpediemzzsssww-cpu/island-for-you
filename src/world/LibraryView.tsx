import {useEffect,useRef} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {useIsland} from '../store';

/** Seated in the existing hollow reading room: turn your head without orbiting through its walls. */
export default function LibraryView(){
 const {camera,gl}=useThree(),object=useIsland(s=>s.object);
 const angle=useRef({yaw:2.98,pitch:-.025}),pointer=useRef<{id:number;x:number;y:number}|null>(null);
 const pose=()=>{camera.position.set(8.65,1.96,1.28);camera.rotation.set(angle.current.pitch,angle.current.yaw,0,'YXZ');camera.updateMatrixWorld();};
 useEffect(()=>{const c=camera as THREE.PerspectiveCamera,old={fov:c.fov,near:c.near},el=gl.domElement,touch=el.style.touchAction;c.fov=78;c.near=.035;c.updateProjectionMatrix();el.style.touchAction='none';pose();
  const down=(e:PointerEvent)=>{if(e.button===0&&(!useIsland.getState().object||useIsland.getState().object==='camera'))pointer.current={id:e.pointerId,x:e.clientX,y:e.clientY};};
  const move=(e:PointerEvent)=>{const p=pointer.current;if(!p||p.id!==e.pointerId)return;angle.current.yaw-=.004*(e.clientX-p.x);angle.current.pitch=THREE.MathUtils.clamp(angle.current.pitch-.004*(e.clientY-p.y),-.5,.65);p.x=e.clientX;p.y=e.clientY;};
  const up=()=>{pointer.current=null;};el.addEventListener('pointerdown',down);window.addEventListener('pointermove',move);window.addEventListener('pointerup',up);window.addEventListener('pointercancel',up);window.addEventListener('blur',up);
  return()=>{c.fov=old.fov;c.near=old.near;c.updateProjectionMatrix();el.style.touchAction=touch;el.removeEventListener('pointerdown',down);window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',up);window.removeEventListener('blur',up);};
 },[camera,gl]);
 useEffect(()=>{pointer.current=null;},[object]);
 useFrame(()=>{if(!object||object==='camera')pose();});return null;
}
