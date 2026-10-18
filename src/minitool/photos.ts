import {getMiniTool,getClientVersion,withTimeout,getLocalData,setLocalData} from './bridge';
const INDEX='island:photo-index';const memory=new Map<string,Blob>();
type Entry={path?:string;data?:string;type:string};
const toData=(b:Blob)=>new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=()=>reject(r.error);r.readAsDataURL(b)});
function fromData(data:string,type:string){const raw=atob(data.includes(',')?data.split(',')[1]:data),bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);return new Blob([bytes],{type})}
export async function savePhoto(id:string,blob:Blob){const mt=getMiniTool();const data=await toData(blob);let entry:Entry={type:blob.type};
 if(mt?.writeTempFile&&mt.saveFile&&await getClientVersion()>=9490){const tmp=await withTimeout(mt.writeTempFile({data}));const saved=await withTimeout(mt.saveFile({tempFilePath:tmp.filePath}));entry.path=saved.savedFilePath}
 else {if(data.length>950000)throw Error('照片太大，请把取景框缩小一点再拍。');entry.data=data}
 if(!await setLocalData('island:photo:'+id,entry))throw Error('照片暂时无法保存，请重试。');const ids=await getLocalData<string[]>(INDEX)||[];if(!await setLocalData(INDEX,[...ids,id]))throw Error('相册记录暂时无法保存。');memory.set(id,blob);if(memory.size>6)memory.delete(memory.keys().next().value!);
}
export async function getPhoto(id:string){if(memory.has(id))return memory.get(id);const e=await getLocalData<Entry>('island:photo:'+id);if(!e)return;let b:Blob;
 if(e.path){const mt=getMiniTool();if(!mt?.readFile||!mt.getFileStorageInfo)return;const {readChunkMaxBytes}=await withTimeout(mt.getFileStorageInfo());let pos=0;const parts:Blob[]=[];while(true){const r=await withTimeout(mt.readFile({filePath:e.path,encoding:'base64',position:pos,length:readChunkMaxBytes}));parts.push(fromData(r.data,e.type));pos+=r.bytesRead;if(r.eof||!r.bytesRead)break}b=new Blob(parts,{type:e.type})}else if(e.data)b=fromData(e.data,e.type);else return;memory.set(id,b);if(memory.size>6)memory.delete(memory.keys().next().value!);return b;
}
export async function deletePhoto(id:string){const e=await getLocalData<Entry>('island:photo:'+id),mt=getMiniTool();if(e?.path&&mt?.unlink)await withTimeout(mt.unlink({filePath:e.path}));await setLocalData('island:photo:'+id,null);memory.delete(id)}
export async function clearPhotos(){const ids=await getLocalData<string[]>(INDEX)||[];for(const id of ids)await deletePhoto(id);await setLocalData(INDEX,[])}
export async function captureWorld(frame:DOMRect):Promise<Blob>{
 const source=document.querySelector<HTMLCanvasElement>('.world canvas');if(!source)throw Error('相机还没准备好');
 const rect=source.getBoundingClientRect(),sx=source.width/rect.width,sy=source.height/rect.height;
 const crop={x:Math.max(0,(frame.left-rect.left)*sx),y:Math.max(0,(frame.top-rect.top)*sy),w:Math.min(source.width,frame.width*sx),h:Math.min(source.height,frame.height*sy)};
 const result=document.createElement('canvas');const ratio=Math.min(1,960/Math.max(crop.w,crop.h));result.width=Math.round(crop.w*ratio);result.height=Math.round(crop.h*ratio);
 result.getContext('2d')!.drawImage(source,crop.x,crop.y,crop.w,crop.h,0,0,result.width,result.height);
 return new Promise((resolve,reject)=>result.toBlob(blob=>blob?resolve(blob):reject(Error('无法冲洗照片')),'image/png'));
}
