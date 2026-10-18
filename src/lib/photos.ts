const DB='island-for-you-photos';
let connection:Promise<IDBDatabase>|null=null;
function database(){if(!connection)connection=new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open(DB,1);request.onupgradeneeded=()=>request.result.createObjectStore('shots');request.onsuccess=()=>resolve(request.result);request.onerror=()=>{connection=null;reject(request.error);};});return connection;}
export async function savePhoto(id:string,blob:Blob){const db=await database();return new Promise<void>((resolve,reject)=>{const tx=db.transaction('shots','readwrite');tx.objectStore('shots').put(blob,id);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}
export async function getPhoto(id:string){const db=await database();return new Promise<Blob|undefined>((resolve,reject)=>{const r=db.transaction('shots').objectStore('shots').get(id);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
export async function deletePhoto(id:string){const db=await database();return new Promise<void>((resolve,reject)=>{const tx=db.transaction('shots','readwrite');tx.objectStore('shots').delete(id);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});}
export async function clearPhotos(){const db=await database();return new Promise<void>((resolve,reject)=>{const tx=db.transaction('shots','readwrite');tx.objectStore('shots').clear();tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});}
export async function captureWorld(frame:DOMRect):Promise<Blob>{
 const source=document.querySelector<HTMLCanvasElement>('.world canvas');if(!source)throw Error('相机还没准备好');
 const rect=source.getBoundingClientRect(),sx=source.width/rect.width,sy=source.height/rect.height;
 const crop={x:Math.max(0,(frame.left-rect.left)*sx),y:Math.max(0,(frame.top-rect.top)*sy),w:Math.min(source.width,frame.width*sx),h:Math.min(source.height,frame.height*sy)};
 const result=document.createElement('canvas');const ratio=Math.min(1,1280/Math.max(crop.w,crop.h));result.width=Math.round(crop.w*ratio);result.height=Math.round(crop.h*ratio);
 result.getContext('2d')!.drawImage(source,crop.x,crop.y,crop.w,crop.h,0,0,result.width,result.height);
 return new Promise((resolve,reject)=>result.toBlob(blob=>blob?resolve(blob):reject(Error('无法冲洗照片')),'image/png'));
}
