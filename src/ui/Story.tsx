import {useEffect,useRef,useState} from 'react';
import {ArrowRight,Heart,Camera,Sparkles,Sun,Sunset,Moon,Sunrise} from 'lucide-react';
import {useIsland} from '../store';
import {TIMING} from '../experience';
import {coreMemories} from '../content';
import type {TimeOfDay} from '../content';
import {chime,strike,whoosh,sparkleSound} from '../lib/audio';
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
 const s=useIsland();const [title,setTitle]=useState(false);const [ready,setReady]=useState(false);const prev=useRef(s.party);
 const reduced=s.save.settings.reducedMotion;
 useEffect(()=>{if(s.party!==1)return;const t=setTimeout(()=>s.setParty(2),reduced?400:TIMING.lamps*1000);return()=>clearTimeout(t);},[s.party]);
 useEffect(()=>{if(s.party===5&&prev.current===4){setTitle(true);setReady(false);const a=setTimeout(()=>setReady(true),reduced?300:2400),b=setTimeout(()=>setTitle(false),reduced?2500:TIMING.fireworks*1000);prev.current=s.party;return()=>{clearTimeout(a);clearTimeout(b);};}if(s.party===5)setReady(true);prev.current=s.party;},[s.party]);
 if(s.object)return null;
 const card=(h:string,p:string,actions?:React.ReactNode)=><div className="narrative-card celebration-card" key={s.party}><h3>{h}</h3><p>{p}</p>{actions}</div>;
 return <>{title&&<div className="birthday-title" aria-live="polite"><span>Here's to you</span><small>{s.save.occasion.trim()||'今天'}，值得庆祝</small></div>}
 {s.party===0?card('今晚，灯为你亮。','生日、重逢，或者一个普通的好日子。',<><label className="occasion-field">想庆祝什么？<input maxLength={24} value={s.save.occasion} onChange={e=>s.setOccasion(e.target.value)} placeholder="今天"/></label><button className="ink-button" onClick={()=>{s.dispatch({type:'ending'});chime();s.setParty(1);}}>把小岛的灯点亮 <Heart size={16}/></button></>)
 :s.party===1?card('灯一盏一盏亮起来。','从食堂，到花店，到山上的灯塔。')
 :s.party===2?card('长桌上，有一个蛋糕。','点一下蛋糕，让烛光亮起来。',<button className="ink-button" onClick={()=>{strike();s.setParty(3);}}>点上蜡烛 <Sparkles size={16}/></button>)
 :s.party===3?card('闭上眼睛，许一个愿。','不用说出来，岛会替你记着。',<button className="ink-button" onClick={()=>{sparkleSound();s.setParty(4);}}>许好了 <Sparkles size={16}/></button>)
 :s.party===4?card('现在，吹灭蜡烛吧。','再点一下蛋糕，轻轻吹灭。',<button className="ink-button" onClick={()=>{whoosh();s.setParty(5);}}>吹蜡烛 <Heart size={16}/></button>)
 // While the fireworks and the title are up, nothing covers them; the card comes after.
 :title?null
 :card('愿你常常有好事发生。','这一刻，可以拍下来带走。',<><button className="ink-button" disabled={!ready} onClick={()=>s.open('camera')}>把这一刻拍下来 <Camera size={16}/></button><button className="quiet-link" onClick={()=>s.travel(null)}>再去岛上走走</button><button className="quiet-link" onClick={()=>s.setParty(0)}>再庆祝一件事</button></>)}</>;
}

/** After the letter, time belongs to her: one button walks through the day. */
const TIMES:{id:TimeOfDay;name:string;icon:typeof Sun}[]=[{id:'afternoon',name:'午后',icon:Sun},{id:'sunset',name:'日落',icon:Sunset},{id:'night',name:'夜晚',icon:Moon},{id:'morning',name:'清晨',icon:Sunrise}];
export function TimeDial(){
 const s=useIsland();if(!s.save.endingSeen)return null;const i=Math.max(0,TIMES.findIndex(t=>t.id===s.save.time));const now=TIMES[i],next=TIMES[(i+1)%TIMES.length];const Icon=now.icon;
 return <button className="time-dial" title={`现在是${now.name}`} aria-label={`现在是${now.name}，换到${next.name}`} onClick={()=>s.setTime(next.id)}><Icon size={17}/><span>{now.name}</span></button>;
}
export {TIMES};
