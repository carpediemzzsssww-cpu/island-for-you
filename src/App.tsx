import {Component,Suspense,useEffect,useRef,useState} from 'react';
import type {ReactNode} from 'react';
import {useProgress} from '@react-three/drei';
import {ArrowUpRight,ArrowLeft,Volume2,VolumeX,BookOpen,Settings2} from 'lucide-react';
import World,{hoverBus} from './world/World';
import {useIsland} from './store';
import {places,coreMemories,site,today} from './content';
import type {PlaceId} from './content';
import Artifacts,{SceneActions,RainbowOverview} from './ui/Artifacts';
import Countdown from './ui/Countdown';
import {EveningInvite,TimeDial,progressLabel} from './ui/Story';
import {beginAudio,updateAudio,trackBus} from './lib/audio';
import {Asterisk} from './ui/paper';
class WorldBoundary extends Component<{children:ReactNode},{failed:boolean}>{state={failed:false};static getDerivedStateFromError(){return {failed:true};}render(){if(this.state.failed)return <div className="recovery"><h2>海风暂时停了一下</h2><p>场景没有成功加载。请检查网络，再试一次。</p><button onClick={()=>location.reload()}>重新来到小岛</button></div>;return this.props.children;}}
function Loading(){const {progress,active}=useProgress();const started=useIsland(s=>s.started);return active&&!started?<div className="loading"><span className="loading-wave">≈</span><span>大海正在靠岸</span><div><i style={{width:`${progress}%`}}/></div></div>:null;}
// A place name that follows the pointer over a building; never shown on touch screens.
function HoverLabel(){
 const [place,setPlace]=useState<PlaceId|null>(null);const el=useRef<HTMLDivElement>(null);
 useEffect(()=>{const on=(e:Event)=>{const d=(e as CustomEvent<{place:PlaceId;x:number;y:number}|null>).detail;setPlace(d?.place??null);if(d&&el.current)el.current.style.transform=`translate(${Math.round(d.x+16)}px,${Math.round(d.y-34)}px)`;};hoverBus.addEventListener('hover',on);return()=>hoverBus.removeEventListener('hover',on);},[]);
 return <div ref={el} className={`hover-label ${place?'show':''}`} aria-hidden="true">{place?places[place].name:''}</div>;
}
function NowPlaying(){
 // The words stay while the pill fades out, so it never shrinks to an empty bubble.
 const [song,setSong]=useState<{title:string;artist:string}|null>(null);const [show,setShow]=useState(false);
 useEffect(()=>{let timer:ReturnType<typeof setTimeout>;const on=(e:Event)=>{setSong((e as CustomEvent).detail);setShow(true);clearTimeout(timer);timer=setTimeout(()=>setShow(false),4200);};trackBus.addEventListener('track',on);return()=>{clearTimeout(timer);trackBus.removeEventListener('track',on);};},[]);
 return <div className={`now-playing ${show?'show':''}`} role="status" aria-live="polite" aria-hidden={!show}>{song?<>♪ {song.title}<span> · {song.artist}</span></>:null}</div>;
}
export default function App(){
 const s=useIsland();const {active}=useProgress();const [lingering,setLingering]=useState(false);
 useEffect(()=>{const update=()=>updateAudio({muted:s.save.settings.muted,started:s.started,place:s.place,radio:s.radio,record:s.record,sunriseStep:s.sunriseStep,night:s.save.time==='night'||s.place==='sunrise'&&s.sunriseStep<2,hidden:document.hidden,party:s.party});update();document.addEventListener('visibilitychange',update);return()=>document.removeEventListener('visibilitychange',update);},[s.save.settings.muted,s.place,s.radio,s.record,s.started,s.sunriseStep,s.save.time,s.party]);
 useEffect(()=>{const t=setInterval(()=>useIsland.getState().tick(5),5000);return()=>clearInterval(t);},[]);
 useEffect(()=>{if(!s.notice)return;const t=setTimeout(()=>s.notify(null),5000);return()=>clearTimeout(t);},[s.notice]);
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){if(s.object)s.open(null);else s.travel(null);}if(e.key==='f'&&!['INPUT','TEXTAREA'].includes((e.target as HTMLElement)?.tagName)){if(document.fullscreenElement)document.exitFullscreen?.();else document.documentElement.requestFullscreen?.();}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[s.object,s.place]);
 // Soft guidance: after a long quiet moment on the island view, a small star appears on the journal.
 useEffect(()=>{setLingering(false);if(!s.started||s.intro||s.place||s.object||s.save.endingSeen)return;let timer=setTimeout(()=>setLingering(true),45000);const wake=()=>{clearTimeout(timer);setLingering(false);timer=setTimeout(()=>setLingering(true),45000);};window.addEventListener('pointerdown',wake);return()=>{clearTimeout(timer);window.removeEventListener('pointerdown',wake);};},[s.started,s.intro,s.place,s.object,s.save.endingSeen]);
 useEffect(()=>{const next=()=>useIsland.getState().nextRecord();trackBus.addEventListener('ended',next);return()=>trackBus.removeEventListener('ended',next);},[]);
 useEffect(()=>{if(s.weather!=='glow')return;const timer=setTimeout(()=>useIsland.getState().setWeather('clear'),Math.max(0,s.rainbowUntil-performance.now()));return()=>clearTimeout(timer);},[s.weather,s.rainbowUntil]);
 const firstSteps=!Object.values(s.save.core).some(Boolean);
 // The journal calls softly until she has opened it, and again whenever there is something new to tick off.
 const calling=s.started&&!s.intro&&(!s.save.home.journalOpened||coreMemories.some(m=>s.save.core[m.key]&&!s.save.home.thingsSeen.includes(m.key))||s.save.endingUnlocked&&!s.save.endingSeen);
 const touch=typeof matchMedia!=='undefined'&&matchMedia('(pointer: coarse)').matches;
 const hoverPlace=(id:PlaceId)=>(e:React.MouseEvent)=>hoverBus.dispatchEvent(new CustomEvent('hover',{detail:{place:id,x:e.clientX,y:e.clientY}}));
 return <main className={`island-app ${s.place?'at-'+s.place:''} time-${s.save.time} ${s.started?'entered':'arrival'}`}><div className="world"><WorldBoundary><Suspense fallback={null}><World/></Suspense></WorldBoundary></div><div className="vignette"/>
 <header className="topbar">
  <button className="brand" onClick={()=>s.travel(null)} aria-label="返回整座小岛"><span className="brand-number">{site.brand}<span className="brand-star"><Asterisk size={17} stroke={1.9}/></span></span><span className="brand-word">ISLAND</span></button>
  {s.started&&<nav className="tools" aria-label="小岛工具"><button title="声音" aria-label={s.save.settings.muted?'开启声音':'关闭声音'} onClick={()=>s.setting('muted',!s.save.settings.muted)}>{s.save.settings.muted?<VolumeX size={18}/>:<Volume2 size={18}/>}</button><TimeDial/><button title={calling?'手账里有新的东西':'手账与地图'} aria-label={`打开手账，${progressLabel(s.save.core)}${calling?'，有新的内容':''}`} onClick={()=>s.open('journal')} className={`journal-button ${calling?'calling':lingering?'journal-hint':''}`}><BookOpen size={18}/></button><button title="设置" aria-label="设置" onClick={()=>s.open('settings')}><Settings2 size={18}/></button></nav>}
 </header>
 {!s.started&&!active&&<section className="welcome"><span className="welcome-date">{today.month} · {today.day}</span><h1>小岛终于等到你啦！</h1><button id="enter-island" className="enter-button" aria-label="让海风带路" onClick={()=>{beginAudio();s.start();}}>上岛 <ArrowUpRight size={18}/></button><span className="welcome-sound">打开声音，会听见大海</span></section>}
 {s.started&&!s.intro&&!s.place&&<><div className="map-markers">{Object.entries(places).map(([id,p])=><button key={id} data-place={id} style={{visibility:'hidden'}} className="place-hit" aria-label={`前往${p.name}`} onMouseMove={hoverPlace(id as PlaceId)} onMouseLeave={()=>hoverBus.dispatchEvent(new CustomEvent('hover',{detail:null}))} onClick={()=>{hoverBus.dispatchEvent(new CustomEvent('hover',{detail:null}));s.travel(id as PlaceId);}}><span aria-hidden="true"/></button>)}</div></>}
 <div className="scene-navigation">
 {s.started&&s.place&&!s.object&&<section className="place-heading"><button className="back-link" aria-label="回到小岛" title="退出场景，回到整座小岛（Esc）" onClick={()=>s.travel(null)}><ArrowLeft size={18}/>退出场景</button></section>}
 {s.started&&!s.object&&(s.place==='sunset'||s.place==='sunrise'||s.place==='cloud'||s.weather==='glow')&&<Countdown/>}
 </div>
 <HoverLabel/>
 <div className={`scene-dock ${!s.started||s.intro||s.object?'inactive':''}`}><NowPlaying/>{s.started&&!s.intro&&!s.place&&firstSteps&&s.weather!=='glow'&&<p className="island-hint">{touch?'点建筑进入 · 单指环顾 · 双指缩放':'点建筑进入 · 拖动环顾 · 滚轮缩放'}</p>}<SceneActions/><RainbowOverview/>{s.notice&&!s.object&&<div role="status" className="toast">{s.notice}</div>}</div>
 <EveningInvite/><Artifacts/>{s.notice&&s.object&&<div role="status" className="toast">{s.notice}</div>}{s.storageError&&<div role="alert" className="storage-warning">浏览器暂时无法保存探索记录，请允许网站存储。</div>}<Loading/>
 </main>;
}
