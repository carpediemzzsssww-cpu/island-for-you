import {useEffect,useState} from 'react';
import {Download,Share2} from 'lucide-react';
import {getPhoto} from '../lib/photos';
import {useIsland} from '../store';

/** Prepare the File before the tap: mobile sharing requires the original user gesture. */
export default function PhotoActions({id,blob}:{id:string;blob?:Blob}){
 const [asset,setAsset]=useState<{url:string;file:File}|null>(null);
 const [missing,setMissing]=useState(false);
 useEffect(()=>{let alive=true,url:string|undefined;setAsset(null);setMissing(false);
  (blob?Promise.resolve(blob):getPhoto(id)).then(data=>{if(!alive)return;if(!data){setMissing(true);return;}
   const ext=data.type==='image/png'?'png':data.type==='image/jpeg'?'jpg':'webp';
   url=URL.createObjectURL(data);setAsset({url,file:new File([data],`island-${id.slice(0,8)}.${ext}`,{type:data.type})});
  }).catch(()=>{if(alive)setMissing(true);});
  return()=>{alive=false;if(url)URL.revokeObjectURL(url);};
 },[id,blob]);
 const share=async()=>{if(!asset)return;try{await navigator.share({files:[asset.file],title:'我眼睛里的小岛'});}catch(e){if(!(e instanceof Error&&e.name==='AbortError'))useIsland.getState().notify('分享暂时没有打开，可以先保存图片。');}};
 const shareable=asset&&typeof navigator.canShare==='function'&&navigator.canShare({files:[asset.file]});
 return <div className="photo-actions">{asset?<><a href={asset.url} download={asset.file.name}><Download size={15}/>保存图片</a>{shareable&&<button onClick={share}><Share2 size={15}/>分享</button>}</>:<span>{missing?'原图暂时无法读取':'正在准备图片…'}</span>}</div>;
}
