import {useEffect,useRef,useState} from 'react';
import {ArrowRight,Camera,Check,ChevronLeft,ChevronRight,Heart,Music2,RotateCcw,Shuffle,Sun,X,MoveUpRight,MoreHorizontal,BookOpen} from 'lucide-react';
import {useIsland} from '../store';
import {photos,scenery,sunsets,menu,places,tracks,records,phoneMessages,video,site,today} from '../content';
import type {PlaceId,ObjectId} from '../content';
import {captureWorld,savePhoto,clearPhotos} from '../lib/photos';
import {chime,kitchen,paperSound,shutterSound,resetMusic,wave} from '../lib/audio';
import {sandSurface,updateSand,clearSand} from '../lib/sand';
import {CelebrationCard,TIMES} from './Story';
import {Artifact,Asterisk} from './paper';
import Journal from './Journal';
import PhotoActions from './PhotoActions';
import Studio from '../bouquet/Studio';
import {TIMING,greenRay} from '../experience';
import {carryMorning} from '../world/atmosphere';

// The photo wall, opened: every photograph in one place (and the little video at the end). Tap the arrows or the
// sides, swipe on a phone, or pick from the strip below. No categories, captions or rules.
type WallItem={kind:'photo';p:typeof photos[number]}|{kind:'video'};
const WALL:WallItem[]=[...photos.map(p=>({kind:'photo' as const,p})),...(video?[{kind:'video' as const}]:[])];
function PhotoWall(){const s=useIsland();
 const [index,setIndex]=useState(()=>{const w=window as unknown as {__wallPhoto?:string};const i=WALL.findIndex(x=>x.kind==='photo'&&x.p.id===w.__wallPhoto);w.__wallPhoto=undefined;return Math.max(0,i);});
 const n=WALL.length,item=WALL[(index%n+n)%n];const strip=useRef<HTMLDivElement>(null);const swipe=useRef<number|null>(null);
 const go=(d:number)=>{setIndex(i=>((i+d)%n+n)%n);paperSound();};
 useEffect(()=>{if(item.kind==='photo')s.dispatch({type:'found',id:item.p.id});strip.current?.querySelector('.on')?.scrollIntoView({block:'nearest',inline:'center',behavior:'smooth'});},[index]);
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.key==='ArrowRight')go(1);if(e.key==='ArrowLeft')go(-1);};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[]);
 return <Artifact className="gallery" label="窗外的风景">
  <div className="gallery-stage" onPointerDown={e=>{swipe.current=e.clientX;}} onPointerUp={e=>{if(swipe.current!==null&&Math.abs(e.clientX-swipe.current)>40)go(e.clientX<swipe.current?1:-1);swipe.current=null;}}>
   {item.kind==='photo'?<img key={item.p.id} src={item.p.src} alt="一张照片" draggable={false}/>:<video src={video?.src} controls playsInline preload="metadata" aria-label="一段录像"/>}
   <button className="gallery-arrow prev" aria-label="上一张照片" onClick={()=>go(-1)}><ChevronLeft size={22}/></button><button className="gallery-arrow next" aria-label="下一张照片" onClick={()=>go(1)}><ChevronRight size={22}/></button>
  </div>
  <div className="gallery-strip" ref={strip}>{WALL.map((x,i)=><button key={i} className={i===(index%n+n)%n?'on':''} aria-label={x.kind==='photo'?`第 ${i+1} 张照片`:'一段录像'} onClick={()=>{setIndex(i);paperSound();}}>{x.kind==='photo'?<img src={x.p.thumbnail} alt="" loading="lazy"/>:<span className="gallery-video"><MoveUpRight size={14}/></span>}</button>)}</div>
 </Artifact>;}
// Ordering: tap a dish, the kitchen gets busy, then the menu folds away and she sits down at the table with the dish
// in front of her. Everything ordered stays on the table; the menu (on the table, or 今日菜单) orders more.
function Menu(){const s=useIsland();const [cooking,setCooking]=useState<string|null>(null);const timer=useRef<ReturnType<typeof setTimeout>|null>(null);useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current);},[]);
 const order=(id:string)=>{if(cooking)return;setCooking(id);kitchen();timer.current=setTimeout(()=>{s.dispatch({type:'food',id});chime();setCooking(null);s.setCloseUp(true);s.open(null);},s.save.settings.reducedMotion?500:2300);};
 return <Artifact className="menu-paper" label="今日菜单"><div className="menu-seal">好吃<br/>认证</div><h2>今天吃点什么</h2><div className="menu-rule"/>{menu.map(item=>{const had=s.save.optional.foodMemories.includes(item.id);return <button key={item.id} disabled={!!cooking} className={`menu-item ${cooking===item.id?'cooking':''} ${had?'served':''}`} onClick={()=>order(item.id)}><div><h3>{item.name}</h3><p>{item.note}</p></div><span>{cooking===item.id?<span className="steam-dots" aria-label="正在做"><i/><i/><i/></span>:had?<Check size={18}/>:item.price}</span></button>;})}<button className="random-evil" disabled={!!cooking} onClick={()=>order(menu[Math.floor(Math.random()*menu.length)].id)}><Shuffle size={15}/> 交给厨师 · 帮我选一道</button><div className="order-status" role="status">{cooking?'厨房里传来了好香的声音……':''}</div></Artifact>;
}
function Postcards(){const s=useIsland();const index=s.sunsetIndex%sunsets.length,p=sunsets[index];useEffect(()=>{s.dispatch({type:'found',id:p.id});},[p.id]);return <Artifact className="postcard-artifact" label="一起看过的日落 / 日出"><div className="postcard-stamp">POSTCARD<br/><Sun size={26} strokeWidth={1}/><span>FROM THE SEA</span></div><h2>一起看过的日落 / 日出 · {index+1}</h2><figure className="postcard-photo"><img src={p.src} alt="一起看过的天空"/></figure><div className="paper-pagination"><button aria-label="上一张" onClick={()=>s.setSunset((index-1+sunsets.length)%sunsets.length)}><ChevronLeft size={20}/></button><span>{p.date?p.date.slice(0,10).replaceAll('-',' / '):''}</span><button aria-label="下一张" onClick={()=>s.setSunset((index+1)%sunsets.length)}><ChevronRight size={20}/></button></div><button className="ink-button" onClick={()=>{s.dispatch({type:'sunset'});chime();s.open(null);}}>把这一张放进手账 <Heart size={16}/></button></Artifact>;}
function Sand(){const drawing=useRef(false);const previous=useRef<[number,number]|null>(null);const display=useRef<HTMLCanvasElement>(null);const s=useIsland();useEffect(()=>{const t=setInterval(()=>{const ctx=display.current?.getContext('2d');if(ctx){ctx.clearRect(0,0,1000,540);ctx.drawImage(sandSurface(),0,0);}},50);return()=>clearInterval(t);},[]);
 const draw=(event:React.PointerEvent<HTMLCanvasElement>)=>{if(!drawing.current)return;const r=event.currentTarget.getBoundingClientRect();const p:[number,number]=[(event.clientX-r.left)/r.width*1000,(event.clientY-r.top)/r.height*540];if(p[0]<70||p[0]>930||p[1]<60||p[1]>480){previous.current=null;return;}const ctx=sandSurface().getContext('2d')!;ctx.strokeStyle='#7d6343';ctx.lineWidth=13;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();ctx.moveTo(...(previous.current??p));ctx.lineTo(...p);ctx.stroke();previous.current=p;updateSand();};
 return <Artifact className="sand-artifact" label="在沙滩上写字"><h2>写点什么，海会听见。</h2><p>用手指或鼠标写写画画。写在虚线框里，就能完整留在沙滩上。</p><div className="sand-surface"><span className="sand-safe-area" aria-hidden="true"/><canvas ref={display} width={1000} height={540} aria-label="沙滩写字区域" onPointerDown={e=>{drawing.current=true;previous.current=null;e.currentTarget.setPointerCapture(e.pointerId);draw(e);}} onPointerMove={draw} onPointerUp={()=>{drawing.current=false;previous.current=null;s.dispatch({type:'sand'});}} onPointerCancel={()=>{drawing.current=false;previous.current=null;}}/></div><div className="sand-actions"><button className="ink-button" onClick={()=>{s.dispatch({type:'sand'});s.open(null);s.setSand(1);}}>留在沙滩上 <ArrowRight size={16}/></button><button className="quiet-link" onClick={clearSand}><RotateCcw size={15}/> 擦掉重写</button></div></Artifact>;
}
// The viewfinder: drag anywhere in the picture to find the angle (wheel or pinch to come closer, right-drag or two
// fingers to slide), drag the frame's corners or edges to any size. Whatever shape the frame has is the photograph.
type Box={x:number;y:number;w:number;h:number};
const EDGES=['n','s','e','w','ne','nw','se','sw'] as const;
function startFrame():Box{const vw=innerWidth,vh=innerHeight,phone=vw<760;const top=phone?150:100,bottom=phone?150:140;const w=Math.min(phone?vw*.86:Math.min(vw*.6,760),(vh-top-bottom)*4/3),h=w*3/4;return {x:(vw-w)/2,y:top+(vh-top-bottom-h)/2,w,h};}
function CameraView(){const s=useIsland();const [box,setBox]=useState<Box>(startFrame);const [saving,setSaving]=useState(false);const [flash,setFlash]=useState(false);const [shot,setShot]=useState<{id:string;blob:Blob;url:string;aspect:number}|null>(null);const [hint,setHint]=useState(true);const frame=useRef<HTMLDivElement>(null);
 useEffect(()=>()=>{if(shot)URL.revokeObjectURL(shot.url);},[shot]);
 useEffect(()=>{const t=setTimeout(()=>setHint(false),4200);return()=>clearTimeout(t);},[]);
 useEffect(()=>{const fit=()=>setBox(startFrame());window.addEventListener('resize',fit);return()=>window.removeEventListener('resize',fit);},[]);
 const resize=(edge:typeof EDGES[number])=>(e:React.PointerEvent)=>{e.preventDefault();e.stopPropagation();const el=e.currentTarget as HTMLElement;el.setPointerCapture(e.pointerId);setHint(false);
  const from=box,x0=e.clientX,y0=e.clientY,vw=innerWidth,vh=innerHeight,phone=vw<760,min=phone?90:120,top=phone?118:84,bottom=phone?132:118;
  const move=(m:PointerEvent)=>{const dx=m.clientX-x0,dy=m.clientY-y0;let {x,y,w,h}=from;
   if(edge.includes('w')){const nx=Math.min(Math.max(12,x+dx),x+w-min);w+=x-nx;x=nx;}if(edge.includes('e'))w=Math.min(Math.max(min,w+dx),vw-12-x);
   if(edge.includes('n')){const ny=Math.min(Math.max(top,y+dy),y+h-min);h+=y-ny;y=ny;}if(edge.includes('s'))h=Math.min(Math.max(min,h+dy),vh-bottom-y);
   setBox({x,y,w,h});};
  const up=()=>{el.removeEventListener('pointermove',move);el.removeEventListener('pointerup',up);el.removeEventListener('pointercancel',up);};
  el.addEventListener('pointermove',move);el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up);};
 const shoot=async()=>{if(!frame.current||saving)return;setSaving(true);try{const r=frame.current.getBoundingClientRect(),blob=await captureWorld(r),id=crypto.randomUUID(),aspect=r.width/r.height;await savePhoto(id,blob);
  s.dispatch({type:'photo',shot:{id,place:s.place??'cloud',orientation:aspect>=1?'landscape':'portrait',aspect,createdAt:Date.now()}});
  if(s.place==='park'&&scenery[0])s.dispatch({type:'found',id:scenery[0].id});setShot({id,blob,url:URL.createObjectURL(blob),aspect});shutterSound();setFlash(true);setTimeout(()=>setFlash(false),200);}
  catch{ s.notify('这次没能保存照片，请允许浏览器存储后再试。');}finally{setSaving(false);}};
 return <section className="camera-view" aria-label="相机取景"><button className="camera-close" onClick={()=>s.open(null)} aria-label="收起相机"><X size={20}/></button>
  <div className="viewfinder-frame" ref={frame} style={{left:box.x,top:box.y,width:box.w,height:box.h}}><span className="frame-corner tl"/><span className="frame-corner tr"/><span className="frame-corner bl"/><span className="frame-corner br"/><span className="viewfinder-cross">+</span><div className="frame-caption">ISLAND FILM CLUB <span>{s.place?places[s.place].name:''}</span></div>
   {EDGES.map(edge=><span key={edge} className={`vf-handle ${edge}`} onPointerDown={resize(edge)} aria-hidden="true"/>)}</div>
  <div className="camera-controls"><button className="shutter-button" aria-label="按下快门" disabled={saving} onClick={shoot}><span/></button></div>
  {hint&&<p className="camera-hint">拖动画面换角度 · 拉动边框改大小</p>}
  {shot&&<div className="photo-receipt" role="dialog" aria-label="照片已收进手账"><div className="photo-receipt-paper"><span className="receipt-eyebrow">ISLAND FILM CLUB</span><img src={shot.url} alt="刚刚拍下的小岛" style={{aspectRatio:String(shot.aspect)}}/><h2>已收进手账</h2><p>这一刻，也可以带走。</p><PhotoActions id={shot.id} blob={shot.blob}/><div className="receipt-links"><button onClick={()=>setShot(null)}>继续拍照</button><button onClick={()=>{(window as unknown as {__journalPage:string}).__journalPage='shots';s.open('journal');}}>翻开相册 <ArrowRight size={14}/></button></div></div></div>}{flash&&<div className="shutter-flash"/>}</section>;
}
function Radio(){const s=useIsland();const t=tracks[records[s.record%records.length]];return <Artifact className="radio-paper" label="唱片机"><h2>让音乐陪你逛小岛</h2><p className="radio-note">顺序播放 · 离开房间也会接着放</p><div className={`record ${s.radio?'spinning':''}`}><div>{site.brand}<br/><small>ISLAND RADIO</small></div></div><h3>{t.title}</h3><p>{t.artist}</p><button className="ink-button" onClick={s.toggleRadio}><Music2 size={17}/>{s.radio?'暂停音乐':'继续播放'}</button><button className="quiet-link" onClick={s.nextRecord}>换一张唱片 <Shuffle size={14}/></button></Artifact>;}
function Phone(){const [index,setIndex]=useState(0);return <Artifact className="phone-artifact" label="床边的手机"><div className="phone-camera"/><span className="phone-clock">{['23:47','00:13','01:26'][index%3]}</span><span className="phone-date">{today.month} 月 {today.day} 日，今天也有好多想分享的事</span><div className="phone-notification"><div className="phone-avatar"><Asterisk size={18} stroke={2}/></div><div><span>{site.from} <small>刚刚</small></span><p>{phoneMessages[index%phoneMessages.length]}</p></div></div><button onClick={()=>setIndex(index+1)} className="phone-next">还有一条想发给你</button><div className="phone-home"/></Artifact>;}
function Settings(){const s=useIsland();const [confirm,setConfirm]=useState(false);return <Artifact className="settings-paper" label="小岛设置"><h2>照你的习惯来。</h2><div className="setting-row"><label htmlFor="sound">小岛的声音</label><input id="sound" type="checkbox" checked={!s.save.settings.muted} onChange={e=>s.setting('muted',!e.target.checked)}/></div><div className="setting-row"><label htmlFor="motion">减少镜头与动画</label><input id="motion" type="checkbox" checked={s.save.settings.reducedMotion} onChange={e=>s.setting('reducedMotion',e.target.checked)}/></div>{s.save.endingSeen&&<div className="time-options"><p>现在，时间属于你。</p>{TIMES.map(t=><button key={t.id} className={s.save.time===t.id?'selected':''} onClick={()=>s.setTime(t.id)}>{t.name}</button>)}</div>}<p className="settings-note">小岛会记得这台设备上的花束、照片和回忆。<br/>换一台设备，会从初见开始。</p>{confirm?<div className="reset-confirm"><h3>让小岛回到初见？</h3><p>这会清除本机的探索记录和拍立得。</p><div><button onClick={()=>setConfirm(false)}>留着这些回忆</button><button onClick={async()=>{try{await clearPhotos();s.reset();resetMusic();}catch{s.notify('还没能清除照片，小岛保持原样。请稍后再试。');}}}>确认重置小岛</button></div></div>:<button className="reset-link" onClick={()=>setConfirm(true)}><RotateCcw size={14}/> 重新认识这座小岛</button>}</Artifact>;}
// Sunrise hill: two stretches of trail, then the dawn comes by itself while she waits at the top.
// Sunrise hill: one walk up the path, then the dawn comes by itself while she waits at the top (with a countdown).
function GreenRay(){return <Artifact className="green-ray-paper" label="海边的一页绿光"><span className="green-ray-mark" aria-hidden="true">✧</span><h2>{greenRay.title}</h2><p className="green-ray-note">{greenRay.note}</p><div className="book-sources">{greenRay.sources.map(source=><a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.label} ↗</a>)}</div></Artifact>;}
function SunriseCard(){const s=useIsland();const [light,setLight]=useState(false);
 useEffect(()=>{setLight(false);if(s.sunriseStep<3)return;const left=Math.max(0,(s.save.settings.reducedMotion?2000:TIMING.dawn*1000)-(performance.now()-s.sunriseSince));const t=setTimeout(()=>{setLight(true);chime();},left+200);return()=>clearTimeout(t);},[s.sunriseStep,s.sunriseSince]);
 if(s.sunriseStep===1||s.sunriseStep===2)return <p className="scene-whisper" role="status">海在身后，灯塔还亮着。</p>;
 if(s.sunriseStep>=3&&!light)return null;
 return <div className="narrative-card compact-card"><h3>{s.sunriseStep===0?'走进天亮以前':'天亮了。'}</h3><p>{s.sunriseStep===0?'有些抵达，要从很早的清晨开始。':'把这束光，也带回家。'}</p>
 {s.sunriseStep===0?<button className="ink-button" onClick={()=>{s.setSunrise(1);chime();}}>沿着山路出发 <ArrowRight size={16}/></button>:<button className="ink-button" onClick={()=>{s.dispatch({type:'sunrise'});carryMorning();s.travel(null);}}>带着晨光回去 <ArrowRight size={16}/></button>}</div>;
}
function CloudCard(){const s=useIsland();
 if(s.weather==='rain')return null;
 if(s.weather==='glow')return <div className="narrative-card compact-card"><h3>云层之后原来这么漂亮！</h3><button className="ink-button" onClick={()=>s.viewRainbow()}>看看雨后的整座岛 <ArrowRight size={16}/></button></div>;
 if(s.cloudView==='inside')return <button className="scene-whisper whisper-button" onClick={()=>s.open('green-ray')}><BookOpen size={15}/>窗边有一本《绿光》</button>;
 return <div className="narrative-card compact-card"><h3>如果下雨，就在这里待一会儿。</h3><button className="ink-button" onClick={()=>s.setCloudView('inside')}>进图书馆坐坐 <ArrowRight size={16}/></button></div>;
}
export function SceneActions(){const s=useIsland();const [more,setMore]=useState(false);
 useEffect(()=>setMore(false),[s.place,s.object]);
 if(!s.started||s.intro||s.object||!s.place)return null;
 const actions:Partial<Record<PlaceId,[ObjectId,string][]>>={home:[['wall','照片墙'],['journal','手账'],['radio','唱片机'],['phone','手机']],flowers:[['bouquet','包一束花']],diner:[['menu','今日菜单']],sunset:[['postcards','日落 / 日出'],['sand','沙滩写字'],['green-ray','绿光的故事']],town:[['journal','随身手账']]};
 const list=actions[s.place]??[];
 return <><div className={`scene-actions ${more?'expanded':''}`}>
 {list.map(([id,label],i)=><button key={id} className={i>1?'secondary-scene-action':''} onClick={()=>s.open(id)}>{label}<MoveUpRight size={13}/></button>)}
 {list.length>2&&<button className="scene-more-toggle" aria-label={more?'收起其他操作':'更多操作'} aria-expanded={more} onClick={()=>setMore(!more)}><MoreHorizontal size={18}/></button>}
 {s.place==='cloud'&&<>{s.cloudView==='inside'&&<button onClick={()=>s.setCloudView('outside')}>走到屋外</button>}{s.weather==='clear'&&<button onClick={()=>s.setWeather('rain')}>在这里待一会儿</button>}</>}
 {['home','park','sunset','town','sunrise','cloud','celebration'].includes(s.place)&&<button className="scene-camera" aria-label="拿起相机" title="拍张照" onClick={()=>s.open('camera')}><Camera size={18}/><span>拍张照</span></button>}</div>
 {s.place==='sunrise'&&<SunriseCard/>}{s.place==='celebration'&&<CelebrationCard/>}
 {s.place==='sunset'&&(s.sandPhase===1?<div className="narrative-card compact-card"><h3>字留在沙滩上了。</h3><button className="ink-button" onClick={()=>{wave();s.setSand(2);}}>让这阵海浪带走 <ArrowRight size={16}/></button><button className="quiet-link" onClick={()=>{s.setSand(0);s.open('sand');}}>再写一次</button></div>
 :s.sandPhase===2?<p className="scene-whisper" role="status">海浪来了，把字轻轻收走。</p>
 :s.sitting?<div className="narrative-card compact-card"><h3>坐一会儿。</h3><button className="quiet-link" onClick={()=>s.setSitting(false)}>站起来走走</button></div>:null)}
 {s.place==='cloud'&&<CloudCard/>}</>;
}
export function RainbowOverview(){const s=useIsland();if(!s.started||s.place||s.object||s.weather!=='glow')return null;return <div className="rainbow-overview"><span>雨后的岛</span><button aria-label="拍下雨后的小岛" onClick={()=>s.open('camera')}><Camera size={17}/></button><button aria-label="收起雨后天色" onClick={()=>s.setWeather('clear')}><X size={16}/></button></div>;}
// Papers open with a small lift and fold away when put back: the last one stays a moment after it is closed.
// Behind every paper but the viewfinder, a soft shade; tapping it puts the paper back.
export default function Artifacts(){const object=useIsland(s=>s.object);const reduced=useIsland(s=>s.save.settings.reducedMotion);const [shown,setShown]=useState<ObjectId>(object);const [leaving,setLeaving]=useState(false);
 useEffect(()=>{if(object){setShown(object);setLeaving(false);return;}setLeaving(true);const t=setTimeout(()=>{setShown(null);setLeaving(false);},reduced?0:260);return()=>clearTimeout(t);},[object,reduced]);
 const current=object??shown;if(!current)return null;
 return <div className={`artifact-layer for-${current} ${leaving&&!object?'leaving':''}`} key={current}>{current!=='camera'&&<button className="artifact-shade" aria-label="放回去" tabIndex={-1} onClick={()=>{if(!useIsland.getState().object)return;paperSound();useIsland.getState().open(null);}}/>}{current==='green-ray'?<GreenRay/>:current==='journal'?<Journal/>:current==='wall'?<PhotoWall/>:current==='menu'?<Menu/>:current==='bouquet'?<Studio/>:current==='postcards'?<Postcards/>:current==='sand'?<Sand/>:current==='camera'?<CameraView/>:current==='radio'?<Radio/>:current==='phone'?<Phone/>:current==='settings'?<Settings/>:current==='video'&&video?<Artifact className="video-artifact" label="樱花树下的录像"><h2>樱花树下</h2><video src={video.src} controls playsInline preload="metadata"/><p>{video.caption}</p></Artifact>:null}</div>;}
