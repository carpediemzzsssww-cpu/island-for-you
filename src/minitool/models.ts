import * as THREE from 'three';
type Part={p:number[];c:number[];i:number[];m:any};type Node={name:string;translation?:number[];rotation?:number[];scale?:number[];parts:Part[]};
const cache=new Map<string,{scene:THREE.Group}>();
export function useMiniModel(url:string){const name=url.split('/').pop()!.split('.')[0];if(!cache.has(name)){
 const nodes=(window as any).ISLAND_MODELS[name] as Node[],scene=new THREE.Group();
 for(const n of nodes){const group=new THREE.Group();group.name=n.name;if(n.translation)group.position.fromArray(n.translation);if(n.rotation)group.quaternion.fromArray(n.rotation);if(n.scale)group.scale.fromArray(n.scale);
  // Opaque surfaces share one vertex-coloured draw; glass and luminous windows retain their own materials.
  const batches=new Map<string,{p:number[];c:number[];i:number[];m:any}>();
  for(const q of n.parts){const key=['glass','lamp'].includes(q.m.name)?q.m.name:q.m.alphaMode==='BLEND'?'glass':'opaque';let b=batches.get(key);if(!b){b={p:[],c:[],i:[],m:q.m};batches.set(key,b)}const offset=b.p.length/3;const factor=q.m.pbrMetallicRoughness?.baseColorFactor??[1,1,1,1];b.p.push(...q.p.map(v=>v/1000));b.c.push(...q.c.map((v,i)=>v/255*factor[i%3]));b.i.push(...q.i.map(v=>v+offset));}
  for(const [key,b] of batches){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(b.p,3));g.setAttribute('color',new THREE.Float32BufferAttribute(b.c,3));g.setIndex(b.i);g.computeVertexNormals();g.computeBoundingSphere();const m=new THREE.MeshStandardMaterial({name:key,vertexColors:true,roughness:.86,flatShading:true,side:THREE.DoubleSide});if(key==='glass'){m.transparent=true;m.opacity=.72}const mesh=new THREE.Mesh(g,m);group.add(mesh)}scene.add(group);
 }cache.set(name,{scene});delete (window as any).ISLAND_MODELS[name];
}return cache.get(name)!;}
