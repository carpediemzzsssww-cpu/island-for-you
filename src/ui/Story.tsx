import {useEffect,useRef,useState} from 'react';
import {ArrowRight,Heart,Mail,Sparkles,Sun,Sunset,Moon,Sunrise} from 'lucide-react';
import {useIsland} from '../store';
import {coreMemories,site} from '../content';
import type {TimeOfDay} from '../content';
import {chime,startEndingMusic,strike,whoosh,sparkleSound} from '../lib/audio';
import {Asterisk} from './paper';

export const progressLabel=(core:Record<string,boolean>)=>`五件小事，已经找到 ${coreMemories.filter(m=>core[m.key]).length} 件`;

/** When the fifth memory is found, the island asks her to the square. She can also come later from the journal. */
export function EveningInvite(){
 const s=useIsland();const unlocked=s.save.endingUnlocked,seen=s.save.endingSeen;const asked=useRef(false);const was=useRef(unlocked);
 useEffect(()=>{
  // Newly unlocked in this visit, or already unlocked when she comes back to the island.
  if(!s.started||s.intro||seen||asked.current)return;
  if(unlocked&&(!was.current||!s.place)){asked.current=true;const t=setTimeout(()=>{useIsland.getState().setInvite(true);chime();},was.current?1200:2600);return()=>clearTimeout(t);}
  was.current=unlocked;
 },[unlocked,seen,s.started,s.intro,s.place]);
 if(!s.invite||seen||s.object)return null;
 return <section className="evening-invite" role="dialog" aria-label="岛心的邀请"><span className="invite-star" aria-hidden="true"><Asterisk size={30} stroke={1.8}/></span><h2>五件小事，都带回来了。</h2><p>今晚，岛心的长桌上，有一张为你留的椅子。</p>
  <div><button className="ink-button" onClick={()=>s.travel('celebration')}>现在就去 <ArrowRight size={16}/></button><button className="quiet-link" onClick={()=>s.setInvite(false)}>等一会儿再去</button></div></section>;
}

/** The birthday evening, one gesture at a time: lamps, cake, candles, a wish, blowing them out, then the letter. */
export function CelebrationCard(){
 const s=useIsland();const [hold,setHold]=useState(0);const holding=useRef<number|null>(null);const [title,setTitle]=useState(false);const [ready,setReady]=useState(false);const prev=useRef(s.party);
 const reduced=s.save.settings.reducedMotion;
 useEffect(()=>{if(s.party!==1)return;const t=setTimeout(()=>s.setParty(2),reduced?400:6500);return()=>clearTimeout(t);},[s.party]);
 useEffect(()=>{if(s.party===5&&prev.current===4){setTitle(true);setReady(false);const a=setTimeout(()=>setReady(true),reduced?300:3800),b=setTimeout(()=>setTitle(false),reduced?2500:7600);prev.current=s.party;return()=>{clearTimeout(a);clearTimeout(b);};}if(s.party===5)setReady(true);prev.current=s.party;},[s.party]);
 // Press and hold to make a wish; the ring fills while she keeps holding.
 const start=()=>{if(holding.current!==null)return;const t0=performance.now();const need=reduced?500:1800;const tick=()=>{const k=Math.min(1,(performance.now()-t0)/need);setHold(k);if(k>=1){holding.current=null;sparkleSound();s.setParty(4);setHold(0);return;}holding.current=requestAnimationFrame(tick);};holding.current=requestAnimationFrame(tick);};
 const stop=()=>{if(holding.current!==null){cancelAnimationFrame(holding.current);holding.current=null;}setHold(0);};
 useEffect(()=>stop,[]);
 if(s.object)return null;
 const card=(h:string,p:string,actions?:React.ReactNode)=><div className="narrative-card celebration-card" key={s.party}><h3>{h}</h3><p>{p}</p>{actions}</div>;
 return <>{title&&<div className="birthday-title" aria-live="polite"><span>Happy Birthday</span><small>生日快乐，{site.friend}</small></div>}
 {s.party===0?card('今晚，灯为你亮。','你带回来的每一件小事，都在这张长桌上。',<button className="ink-button" onClick={()=>{s.dispatch({type:'ending'});chime();s.setParty(1);}}>把小岛的灯点亮 <Heart size={16}/></button>)
 :s.party===1?card('灯一盏一盏亮起来。','从食堂，到花店，到山上的灯塔。')
 :s.party===2?card('长桌上，有一个蛋糕。','五支蜡烛，再加一支。',<button className="ink-button" onClick={()=>{strike();s.setParty(3);}}>点上蜡烛 <Sparkles size={16}/></button>)
 :s.party===3?card('闭上眼睛，许一个愿。','不用说出来，岛会替你记着。',<button className="ink-button wish-button" style={{'--hold':hold} as React.CSSProperties} onPointerDown={start} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop} onKeyDown={e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();start();}}} onKeyUp={stop} onContextMenu={e=>e.preventDefault()}><span className="wish-ring" aria-hidden="true"/>{hold>0?'再按一会儿……':'按住，许一个愿'}</button>)
 :s.party===4?card('现在，吹灭蜡烛吧。','一口气，慢慢地。',<button className="ink-button" onClick={()=>{whoosh();s.setParty(5);}}>吹蜡烛 <Heart size={16}/></button>)
 // While the fireworks and the title are up, nothing covers them; the card comes after.
 :title?null
 :card(`生日快乐，${site.friend}。`,'还有一封信，在家里等你。',<><button className="ink-button" disabled={!ready} onClick={()=>{startEndingMusic();s.travel('home');s.open('letter');}}>回家，拆开那封信 <Mail size={16}/></button><button className="quiet-link" onClick={()=>s.setParty(2)}>再点一次蜡烛</button></>)}</>;
}

/** After the letter, time belongs to her: one button walks through the day. */
const TIMES:{id:TimeOfDay;name:string;icon:typeof Sun}[]=[{id:'afternoon',name:'午后',icon:Sun},{id:'sunset',name:'日落',icon:Sunset},{id:'night',name:'夜晚',icon:Moon},{id:'morning',name:'清晨',icon:Sunrise}];
export function TimeDial(){
 const s=useIsland();if(!s.save.letterRead)return null;const i=Math.max(0,TIMES.findIndex(t=>t.id===s.save.time));const now=TIMES[i],next=TIMES[(i+1)%TIMES.length];const Icon=now.icon;
 return <button className="time-dial" title={`现在是${now.name}`} aria-label={`现在是${now.name}，换到${next.name}`} onClick={()=>s.setTime(next.id)}><Icon size={17}/><span>{now.name}</span></button>;
}
export {TIMES};
