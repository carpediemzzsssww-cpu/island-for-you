import {useEffect,useState} from 'react';
import type {CSSProperties} from 'react';
import {CloudRain,Sparkles,Sunrise,Sunset} from 'lucide-react';
import {moment,catchMoment} from '../world/Moments';

// The small pill for the three waits (sunset, sunrise, rain): how long is left, a thin line filling up, and when the
// moment comes, a call to catch it (a tap on the pill or anywhere on the picture).
const LABEL={sunset:'日落',sunrise:'日出',rain:'雨停'} as const;
const CALL={greenFlash:'绿光！点一下',firstLight:'第一缕光！点一下',rainbow:'彩虹！点一下'} as const;
export default function Countdown(){
 const [,tick]=useState(0);useEffect(()=>{const t=setInterval(()=>tick(n=>n+1),120);return()=>clearInterval(t);},[]);
 const now=performance.now();const call=moment.call&&now<moment.callUntil?moment.call:null;const said=now<moment.saidUntil?moment.said:'';
 if(call)return <button className="countdown calling" onClick={()=>catchMoment()}><Sparkles size={16}/><span>{CALL[call]}</span></button>;
 if(said)return <div className="countdown said" role="status"><Sparkles size={15}/><span>{said}</span></div>;
 if(!moment.kind||moment.remaining<=0)return null;
 const Icon=moment.kind==='sunset'?Sunset:moment.kind==='sunrise'?Sunrise:CloudRain;const left=Math.ceil(moment.remaining);
 return <div className="countdown" role="timer" aria-label={`${LABEL[moment.kind]}还有 ${left} 秒`}><Icon size={16}/><span>{LABEL[moment.kind]}</span><b>{Math.floor(left/60)}:{String(left%60).padStart(2,'0')}</b><i style={{'--p':moment.progress} as CSSProperties}/></div>;
}
