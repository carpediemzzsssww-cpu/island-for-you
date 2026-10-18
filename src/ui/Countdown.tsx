import {useEffect,useId,useState} from 'react';
import {Sparkles} from 'lucide-react';
import {useIsland} from '../store';
import {moment,catchMoment} from '../world/Moments';

const LABEL={sunset:'太阳慢慢入海',sunrise:'等第一缕光',rain:'听雨，等天晴'} as const;
const CALL={greenFlash:'绿光！点一下',firstLight:'第一缕光！点一下',rainbow:'彩虹！点一下'} as const;
/** A small moving seaside illustration shares the actual sky/weather clock. */
export default function Countdown(){
 const reduced=useIsland(s=>s.save.settings.reducedMotion);
 const [,tick]=useState(0);const id=useId().replaceAll(':','');
 useEffect(()=>{const t=setInterval(()=>tick(n=>n+1),160);return()=>clearInterval(t);},[]);
 const now=performance.now(),call=moment.call&&now<moment.callUntil?moment.call:null,said=now<moment.saidUntil?moment.said:'';
 if(call)return <button className="countdown calling" onClick={()=>catchMoment()}><Sparkles size={16}/><span>{CALL[call]}</span></button>;
 if(said)return <div className="countdown said" role="status"><Sparkles size={15}/><span>{said}</span></div>;
 if(!moment.kind||moment.remaining<=0)return null;
 const kind=moment.kind,p=Math.max(0,Math.min(1,moment.progress)),left=Math.ceil(moment.remaining);
 const sunY=kind==='sunset'?17+p*31:48-p*30;
 return <div className={`countdown waiting waiting-${kind}`} data-reduced={reduced} role="timer" aria-label={`${LABEL[kind]}，还有 ${left} 秒`}>
  <svg viewBox="0 0 132 68" aria-hidden="true">
   <defs><clipPath id={`${id}-sky`}><path d="M0 0H132V47H0Z"/></clipPath></defs>
   {kind==='rain'?<>
    <g opacity={Math.max(0,(p-.55)/.45)} fill="none" strokeWidth="2.5"><path d="M67 45a22 22 0 0 1 44 0" stroke="#ce8e86"/><path d="M71 45a18 18 0 0 1 36 0" stroke="#d7b36f"/><path d="M75 45a14 14 0 0 1 28 0" stroke="#89a493"/></g>
    <g className="weather-cloud" transform={`translate(${-p*16} ${-p*3})`}><path d="M30 30c-10 0-12-13-3-17 0-15 24-18 30-4 10-6 23 0 22 11 13 0 14 15 2 15H30Z" fill="#c8d6d2" stroke="#8ca59c" strokeWidth="1"/>
     {[0,1,2,3,4].map(i=><path key={i} className="waiting-drop" style={{animationDelay:`${-i*.27}s`,opacity:Math.max(0,1-p*1.15)}} d={`M${32+i*10} 39l-2 6`} stroke="#83a9ab" strokeWidth="1.8" strokeLinecap="round"/>)}</g>
   </>:<g clipPath={`url(#${id}-sky)`}>
    <circle cx="66" cy={sunY} r="17" fill={kind==='sunset'?'#efb09a':'#efd6a1'} opacity=".2"/>
    <circle cx="66" cy={sunY} r="10" fill={kind==='sunset'?'#dc9980':'#e4bc70'}/>
    {kind==='sunrise'&&[0,1,2,3,4].map(i=><path key={i} d="M66 2v5" stroke="#d5b16f" strokeLinecap="round" transform={`rotate(${(i-2)*38} 66 ${sunY})`} opacity={p*.8}/>)}
    <path d="M23 24q4-4 8 0q4-4 8 0" fill="none" stroke="#8c9a8a" strokeWidth="1" transform={`translate(${p*58} ${-p*8})`}/>
   </g>}
   <path d="M11 48q12-3 24 0t24 0t24 0t24 0t14 0M27 55q9-2 18 0t18 0t18 0t18 0M43 62q10-2 20 0t20 0" fill="none" stroke="#8da99a" strokeWidth="1" strokeLinecap="round" opacity=".7"/>
   <path className="waiting-boat" d="M16 45h14l-3 4h-8zM23 45V34l6 8h-6" fill="#a48b6c" stroke="#a48b6c" strokeWidth=".6"/>
  </svg>
  <div><span>{LABEL[kind]}</span><small>{left} 秒</small></div>
 </div>;
}
