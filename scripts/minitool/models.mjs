// Decode and simplify the public GLBs at build time only. Runtime receives plain, bounded geometry.
import fs from 'node:fs';import path from 'node:path';import draco from 'draco3d';import {MeshoptSimplifier as simplify} from 'meshoptimizer';
const root=process.cwd(),out=path.join(root,'public-minitool');fs.mkdirSync(out,{recursive:true});const d=await draco.createDecoderModule({});await simplify.ready;simplify.useExperimentalFeatures=true;
const all={},report=[];
for(const region of ['terrain','town','home','park','coast','hill']){
 const b=fs.readFileSync(path.join(root,'public/models',region+'.glb'));const len=b.readUInt32LE(12),j=JSON.parse(b.subarray(20,20+len).toString()),bin=b.subarray(28+len);const nodes=[];let before=0,after=0;
 for(const node of j.nodes.filter(n=>n.mesh!==undefined)){
  const mesh=j.meshes[node.mesh];const parts=[];
  for(const pr of mesh.primitives){const ext=pr.extensions.KHR_draco_mesh_compression,bv=j.bufferViews[ext.bufferView];const raw=bin.subarray(bv.byteOffset||0,(bv.byteOffset||0)+bv.byteLength);const decoder=new d.Decoder(),buffer=new d.DecoderBuffer();buffer.Init(new Int8Array(raw),raw.length);const dm=new d.Mesh();const st=decoder.DecodeBufferToMesh(buffer,dm);if(!st.ok())throw Error(st.error_msg());
   const read=id=>{const attr=decoder.GetAttributeByUniqueId(dm,id),size=attr.num_components(),a=new d.DracoFloat32Array();decoder.GetAttributeFloatForAllPoints(dm,attr,a);const v=Array.from({length:dm.num_points()*size},(_,i)=>a.GetValue(i));d.destroy(a);return {v,size}};
   const pos=read(ext.attributes.POSITION),color=ext.attributes.COLOR_0!==undefined?read(ext.attributes.COLOR_0):null;
   const map=new Map(),remap=[],p=[],c=[];for(let i=0;i<dm.num_points();i++){
    const pp=pos.v.slice(i*3,i*3+3).map(x=>Math.round(x*1000)/1000),cc=color?color.v.slice(i*color.size,i*color.size+3).map(x=>Math.round(x*255)/255):[1,1,1];const k=pp.join(',')+'/'+cc.join(',');if(!map.has(k)){map.set(k,p.length/3);p.push(...pp);c.push(...cc)}remap.push(map.get(k));
   }
   const face=new d.DracoInt32Array(),ix=[];for(let i=0;i<dm.num_faces();i++){decoder.GetFaceFromMesh(dm,i,face);ix.push(remap[face.GetValue(0)],remap[face.GetValue(1)],remap[face.GetValue(2)])}before+=ix.length/3;
   const target=Math.max(12,Math.floor(ix.length*.28/3)*3);let [indices,error]=simplify.simplifyWithAttributes(new Uint32Array(ix),new Float32Array(p),3,new Float32Array(c),3,[.25,.25,.25],null,target,.035,[]);
   // Remove vertices made redundant by simplification; three's flat-shading derives clean face normals.
   const used=new Map(),np=[],nc=[],ni=[];for(const i of indices){if(!used.has(i)){used.set(i,np.length/3);np.push(...p.slice(i*3,i*3+3).map(x=>Math.round(x*1000)));nc.push(...c.slice(i*3,i*3+3).map(x=>Math.round(x*255)))}ni.push(used.get(i))}
   const mat=j.materials[pr.material];parts.push({p:np,c:nc,i:ni,m:mat});after+=ni.length/3;
   d.destroy(face);d.destroy(dm);d.destroy(buffer);d.destroy(decoder);
  }
  nodes.push({name:node.name,translation:node.translation,rotation:node.rotation,scale:node.scale,parts});
 }
 all[region]=nodes;report.push({region,before,after});console.log(region,before,'→',after);
}
fs.writeFileSync(path.join(out,'models.js'),'window.ISLAND_MODELS='+JSON.stringify(all)+';\n');fs.writeFileSync(path.join(out,'model-budget.json'),JSON.stringify(report,null,2));console.log('Geometry text bytes',fs.statSync(path.join(out,'models.js')).size);
