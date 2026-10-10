import {useEffect,useMemo,useState} from 'react';
import type {CSSProperties} from 'react';
import {ArrowRight,Camera,ChevronLeft,ChevronRight,CloudSun,Flower2,House,Mail,PawPrint,Rainbow,Soup,Sparkles,Sun,Sunrise,Sunset,TreePalm,Waves} from 'lucide-react';
import type {LucideIcon} from 'lucide-react';
import {useIsland} from '../store';
import {photos,portraits,flowers,menu,places,coreMemories,byCategory,today} from '../content';
import type {PlaceId} from '../content';
import type {WorldSave} from '../lib/state';
import {paperSound} from '../lib/audio';
import {Artifact,Polaroid,ShotImage} from './paper';

// The journal is a real notebook: a cloth cover, dotted paper, index tabs on the edge, washi tape and stickers.
// Its first spread is the list of five things to do on the island; ticking all five sets the table in the square.
// Below it, a diary keeps every moment in the order it happened, with the time it happened on her device.

const PAGES=[{id:'memories',name:'事件'},{id:'map',name:'地图'},{id:'shots',name:'拍立得'}] as const;
type Page=typeof PAGES[number]['id'];
let lastPage:Page='memories';
/** The five cameras on the island, in the order they appear in the journal. */
const CAMERA_SPOTS:PlaceId[]=['home','town','park','sunset','sunrise'];
const STICKER:Record<string,{icon:LucideIcon;tint:string}>={homeSeen:{icon:House,tint:'#e9b4a7'},flowerMade:{icon:Flower2,tint:'#eea7bb'},dinerSeen:{icon:Soup,tint:'#f0c983'},sunsetSeen:{icon:Sunset,tint:'#f2b08f'},sunriseReached:{icon:Sunrise,tint:'#f4d27e'},
 pandaFound:{icon:PawPrint,tint:'#d9a07a'},parkPlayed:{icon:TreePalm,tint:'#a9cf9b'},sandWritten:{icon:Waves,tint:'#9fcfd0'},cloudscapeSunset:{icon:CloudSun,tint:'#b9c4e6'},firstPhoto:{icon:Camera,tint:'#b7cdbd'},greenFlash:{icon:Sparkles,tint:'#a8d9b0'},firstLight:{icon:Sun,tint:'#f5cf7a'},rainbow:{icon:Rainbow,tint:'#c4b6e8'},endingSeen:{icon:Sparkles,tint:'#f3b7c6'},letterRead:{icon:Mail,tint:'#e7c4a8'}};
const names=(ids:string[],list:{id:string;name:string}[],sep:string)=>ids.map(id=>list.find(f=>f.id===id)?.name).filter(Boolean).join(sep);
const DIARY:Record<string,{title:string;note:(s:WorldSave)=>string}>={
 homeSeen:{title:'一个可以回来的地方',note:()=>'窗外有大海。'},
 flowerMade:{title:'今天，花是送给你的',note:s=>names(s.home.bouquet?.flowers??[],flowers,' · ')||'一束刚包好的鲜花。'},
 dinerSeen:{title:'今天吃得很好',note:s=>names(s.optional.foodMemories,menu,'、')||'吃饱啦！'},
 sunsetSeen:{title:'把日落收藏起来',note:()=>'记忆里的每一次日落。'},
 sunriseReached:{title:'05:41 的清晨',note:()=>'很早的风，和终于亮起来的天。'},
 pandaFound:{title:'岛上的小住客',note:()=>'不知道为什么，就住下了。'},
 parkPlayed:{title:'无所事事也很好',note:()=>'在公园浪费了一点时间。'},
 sandWritten:{title:'写给大海的话',note:()=>'写下的话，大海听见了。'},
 cloudscapeSunset:{title:'雨停之后',note:()=>'大雨过后的天空好漂亮。'},
 greenFlash:{title:'看到了绿光',note:()=>'太阳落进海里的那一秒。'},
 firstLight:{title:'第一缕光',note:()=>'天亮的那一瞬，被你接住了。'},
 rainbow:{title:'雨后的彩虹',note:()=>'雨停以后，它真的出现了。'},
 firstPhoto:{title:'第一张拍立得',note:()=>'这一次，你来拍下这个世界吧。'},
 endingSeen:{title:'为你亮起的夜晚',note:()=>'灯一盏一盏亮起。'},
 letterRead:{title:'一封信',note:()=>'岛上的灯会一直亮着。'},
};
const happened:Record<string,(s:WorldSave)=>boolean>={homeSeen:s=>s.core.homeSeen,flowerMade:s=>s.core.flowerMade,dinerSeen:s=>s.core.dinerSeen,sunsetSeen:s=>s.core.sunsetSeen,sunriseReached:s=>s.core.sunriseReached,pandaFound:s=>s.optional.pandaFound,parkPlayed:s=>s.optional.parkPlayed,sandWritten:s=>s.optional.sandWritten,cloudscapeSunset:s=>s.secret.cloudscapeSunset,firstPhoto:s=>s.shots.length>0,greenFlash:s=>s.secret.greenFlash,firstLight:s=>s.secret.firstLight,rainbow:s=>s.secret.rainbow,endingSeen:s=>s.endingSeen,letterRead:s=>s.letterRead};
const two=(n:number)=>String(n).padStart(2,'0');
const when=(at:number)=>{const d=new Date(at);return `${d.getMonth()+1}/${d.getDate()} ${two(d.getHours())}:${two(d.getMinutes())}`;};
function Sticker({id,size=17}:{id:string;size?:number}){const s=STICKER[id]??STICKER.endingSeen;const Icon=s.icon;return <span className="jb-sticker" style={{'--tint':s.tint} as CSSProperties} aria-hidden="true"><Icon size={size} strokeWidth={1.7}/></span>;}
/** A pencilled box; the tick is drawn in when the thing is done (and drawn again, slowly, the first time she sees it). */
function Tickbox({done}:{done:boolean}){return <svg className="jb-box" viewBox="0 0 24 24" aria-hidden="true"><path className="frame" d="M3.6 4.1C8.4 3.2 15.6 3.7 20.6 3.9c.5 5.2.2 11 .1 16.4-5.4.7-11.6.4-16.8.2-.6-5.3-.6-11-.3-16.4z"/>{done&&<path className="tick" d="M6.2 12.4l4.1 4.6 8.4-11.3"/>}</svg>;}
function Tape({className=''}:{className?:string}){return <span className={`jb-tape ${className}`} aria-hidden="true"/>;}

// The journal map is drawn from the same coastline formula as the island model and the sea shader.
const mapX=(x:number)=>180+x*10.08,mapY=(z:number)=>139.2+z*8.7;
const wob=(a:number)=>1+.065*Math.sin(a*3+.5)+.045*Math.cos(a*5)+.025*Math.sin(a*9);
const bump=(a:number,c:number,w:number)=>{const d=Math.abs(((a-c+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI)/w;return d>=1?0:.5+.5*Math.cos(d*Math.PI);};
const coast=(k:'water'|'lip')=>Array.from({length:120},(_,i)=>{const a=i/120*Math.PI*2,c=Math.min(1,bump(a,-1.25,1.2)+.9*bump(a,.28,.36)),b=bump(a,2.05,.8),f=k==='water'?(1-c-b)*1.065+c*1.036+b*1.135:(1-c-b)*.87+c*.985+b*.82,r=f*wob(a);return {x:mapX(Math.cos(a)*13.3*r),y:mapY(Math.sin(a)*11.1*r),c,b,a};});
const outline=(pts:{x:number;y:number}[])=>'M'+pts.map(p=>`${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('L')+'Z';
function IslandMap(){const s=useIsland();const water=useMemo(()=>coast('water'),[]),lip=useMemo(()=>coast('lip'),[]);
 const cliffs=water.filter((_,i)=>i%2===0&&water[i].c>.55).map(p=>{const nx=Math.cos(p.a),ny=Math.sin(p.a);return `M${(p.x-nx*1.5).toFixed(1)} ${(p.y-ny*1.3).toFixed(1)}l${(nx*5).toFixed(1)} ${(ny*4.4).toFixed(1)}`;}).join('');
 const sand=water.filter((_,i)=>i%3===0&&water[i].b>.35).map(p=>({x:(p.x*2+lip[water.indexOf(p)].x)/3,y:(p.y*2+lip[water.indexOf(p)].y)/3}));
 const lane=(pts:number[][])=>'M'+pts.map(([x,z])=>`${mapX(x).toFixed(1)} ${mapY(z).toFixed(1)}`).join('L');
 const palms=[[-9,3],[-10,-4],[10.6,-5.2],[12,2.2],[3.8,8.6],[9,4.6],[-3,-7],[5,-7],[11.6,-2.8],[2.4,8.7],[-9.6,-6.2],[-11.2,-2.4]];
 const houses=[[-4.2,1.1,2.65,2.7],[3.7,1.7,3,2.9],[-1.25,-1.1,2.35,2.5],[1.15,-1.25,2.1,2.45],[-4.1,-2.35,2.7,2.65],[4.1,-2.25,2.7,2.3],[7,-4.3,3.7,3.1]];
 return <div className="journal-map"><svg viewBox="0 0 360 290" role="img" aria-label="小岛手绘地图">
  <g fill="none" stroke="#a9bcb3" strokeWidth="1.2" strokeLinecap="round"><path d="M18 244q12-8 24 0t24 0M300 40q10-7 20 0t20 0M22 60q10-7 20 0M318 252q10-7 20 0"/></g>
  <path d={outline(water)} fill="#f0e2c2" stroke="#b9a37f" strokeWidth="1.1"/>
  <path d={outline(water)} fill="none" stroke="#dcebe3" strokeWidth="5" opacity=".7"/>
  <path d={outline(lip)} fill="#dfe6c5" stroke="#9aac80" strokeWidth=".9" strokeDasharray="2.5 2.5"/>
  <path d={cliffs} stroke="#8f7f6a" strokeWidth="1.1" strokeLinecap="round"/>
  {sand.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r=".9" fill="#c8ad82"/>)}
  <ellipse cx={mapX(0)} cy={mapY(-8)} rx={4.1*10.08*.9} ry={3*8.7*.9} fill="none" stroke="#98ab7f" strokeWidth=".8"/><ellipse cx={mapX(0)} cy={mapY(-8)} rx={4.1*10.08*.62} ry={3*8.7*.62} fill="none" stroke="#98ab7f" strokeWidth=".8"/>
  <path d={[lane([[-8,5],[-4,4.1],[0,4.5],[4,4.1],[8,6]]),lane([[0,4],[1,0],[4,-2.9],[7,-2.2]]),lane([[-4,4],[-5,0],[-8,-3],[-6,-6]]),lane([[-3,4],[-5,6],[-7.6,8]]),lane([[-3.2,-5.1],[-.8,-5.7],[1.5,-6.5],[-.2,-8.2]])].join('')} fill="none" stroke="#fbf4df" strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round"/>
  <circle cx={mapX(0)} cy={mapY(5.35)} r={2.1*9.4} fill="#f4dcd8" stroke="#d9aaa8" strokeWidth=".8"/>
  {houses.map(([x,z,w,d],i)=><rect key={i} x={mapX(x-w/2)} y={mapY(z-d/2)} width={w*10.08} height={d*8.7} rx="1.5" fill={i===6?'#e7c4bf':'#efe4cf'} stroke="#a8977a" strokeWidth=".8"/>)}
  <path d={`M${mapX(-1)} ${mapY(-8.1)}l1-12h2l1 12z`} fill="#fbf4e6" stroke="#9c7f6d" strokeWidth=".8"/><path d={`M${mapX(-1.4)} ${mapY(-8.1)-12}h9l-4.5-4z`} fill="#dc9a8a"/>
  {palms.map(([x,z],i)=><g key={i} transform={`translate(${mapX(x)} ${mapY(z)-3})`} stroke="#7f9a6c" strokeWidth="1.1" strokeLinecap="round">{[0,45,90,135].map(a=><line key={a} x1="-3.4" y1="0" x2="3.4" y2="0" transform={`rotate(${a})`}/>)}</g>)}
  <ellipse cx={mapX(8.4)} cy={mapY(8.2)} rx="12" ry="5" fill="#cfe3e0" stroke="#a5c0bb" strokeWidth=".7"/>
  <path d={`M${mapX(-1)-6} ${mapY(9.2)}h12v26h-12z`} fill="none" stroke="#a88a6a" strokeWidth="1"/>
  <ellipse cx={mapX(-18)} cy={mapY(-8)} rx="29" ry="18" fill="#f0e2c2" stroke="#b9a37f" strokeWidth="1"/>
  <g transform="translate(330 222)" fill="#8e9d86"><path d="M0-15l3.5 11h-7z"/><text y="11" fontSize="8" textAnchor="middle" letterSpacing="1">N</text></g>
  <text x="258" y="276" fontSize="9" fill="#7e9486" letterSpacing="4">THE SEA</text>
 </svg>{Object.entries(places).filter(([id])=>id!=='celebration'||s.save.endingUnlocked).map(([id,p])=>{const x=50+p.position[0]*2.8,y=48+p.position[2]*3;return <button key={id} className={`journal-map-pin ${id==='celebration'?'special':''}`} style={{left:`${x}%`,top:`${y}%`}} onClick={()=>s.travel(id as PlaceId)}><i/>{p.name}</button>;})}</div>;}

function ThingsSpread({fresh}:{fresh:Set<string>}){
 const s=useIsland();const save=s.save;const all=coreMemories.every(m=>save.core[m.key]);
 const at=(id:string)=>save.log.find(l=>l.id===id)?.at;
 // Diary: things that happened before the diary existed first (no time), then everything in the order it happened.
 const diary=Object.keys(DIARY).filter(id=>happened[id](save)).map(id=>({id,at:at(id)??0})).sort((a,b)=>a.at-b.at);
 return <>
  <div className="jb-page jb-left">
   <Tape className="tape-corner"/>
   <h2 className="jb-title"><span>记得这些小事</span></h2>
   <p className="jb-date">{today.month} · {today.day} · 晴，有海风</p>
   <p className="jb-lead">今天要做的五件小事：</p>
   <ol className="jb-checklist">{coreMemories.map((m,i)=>{const ok=save.core[m.key];const t=at(m.key);
    return <li key={m.key} className={`${ok?'done':''} ${fresh.has(m.key)?'fresh':''}`} style={{'--i':i} as CSSProperties}>
     <button onClick={()=>s.travel(m.place as PlaceId)} aria-label={`${m.name}：${ok?'已经完成':'还没完成'}，前往${places[m.place as PlaceId].name}`}>
      <Tickbox done={ok}/>
      <span className="jb-task">{m.name}</span>
      {ok?<span className="jb-when">{t?when(t):'做到了'}</span>:<span className="jb-hint">{m.hint}</span>}
      {ok&&<span className="jb-stamp"><Sticker id={m.key} size={15}/></span>}
     </button></li>;})}</ol>
   {all&&!save.endingSeen?<div className="jb-ticket"><span className="jb-ticket-head">ADMIT ONE · {today.month}/{today.day}</span><h3>岛心的长桌</h3><p>五件小事都打上勾了。今晚，那里有一张为你留的椅子。</p><button className="ink-button" onClick={()=>s.travel('celebration')}>去岛心看看 <ArrowRight size={16}/></button></div>
   :save.endingSeen?<p className="jb-pencil">长桌上的蜡烛，已经吹过了。{save.letterRead?'信也读过了。':'还有一封信，在家里等你。'}</p>
   :<p className="jb-pencil">五件都打上勾，岛心会为你摆一张长桌。</p>}
   <span className="jb-folio">— 1 —</span>
  </div>
  <div className="jb-page jb-right">
   <h2 className="jb-title small"><span>这些日子</span></h2>
   {diary.length?<div className="jb-diary">{diary.map(d=><article key={d.id}><Sticker id={d.id}/><div>{d.at>0&&<time>{when(d.at)}</time>}<h3>{DIARY[d.id].title}</h3><p>{DIARY[d.id].note(save)}</p></div></article>)}</div>
   :<p className="jb-pencil empty">先出去走走，<br/>这本手账会慢慢越来越厚。</p>}
   {save.letterRead&&<p className="jb-pencil forever">岛上的灯会一直亮着。<br/>花朵还在。</p>}
   <span className="jb-folio">— 2 —</span>
  </div>
 </>;
}
function MapSpread(){
 const s=useIsland();const [index,setIndex]=useState(0);const collection=photos.filter(p=>s.save.optional.photosFound.includes(p.id));const p=collection.length?collection[index%collection.length]:null;
 return <>
  <div className="jb-page jb-left"><h2 className="jb-title"><span>岛上慢行指南</span></h2><p className="jb-date">点一个地名走过去</p><IslandMap/><span className="jb-folio">— 3 —</span></div>
  <div className="jb-page jb-right">
   <h2 className="jb-title small"><span>收集的照片</span></h2>
   <div className="jb-photo"><Tape className="tape-top"/>{p?<Polaroid src={p.src} caption={p.caption}/>:<Polaroid src={byCategory('journal')[0]?.src??portraits[0]?.src??photos[0].src} caption="认真保存生活的人。"/>}</div>
   {collection.length>1?<div className="paper-pagination"><button aria-label="上一张" onClick={()=>setIndex((index-1+collection.length)%collection.length)}><ChevronLeft size={18}/></button><span>{index%collection.length+1} / {collection.length}</span><button aria-label="下一张" onClick={()=>setIndex(index+1)}><ChevronRight size={18}/></button></div>
   :<p className="jb-pencil">照片墙和日落明信片里看过的照片，会收在这里。</p>}
   <span className="jb-folio">— 4 —</span>
  </div>
 </>;
}
/** One frame per camera, in the shape it was taken (landscape or portrait), taped to the page. */
function Frame({id,i}:{id:PlaceId;i:number}){const s=useIsland();const shot=s.save.shots.find(p=>p.place===id);const tilt={'--r':`${[-2.5,1.8,-1.2,2.4,-1.8][i]}deg`} as CSSProperties;
 return shot?<figure className={`polaroid shot-${shot.orientation}`} style={{...tilt,'--aspect':String(shot.aspect??(shot.orientation==='portrait'?3/4:4/3))} as CSSProperties}><Tape className="tape-top"/><ShotImage id={shot.id}/><span>{places[id].name}</span></figure>
 :<button className="polaroid empty-shot" onClick={()=>s.travel(id)} style={tilt} aria-label={`${places[id].name}的相机还没拍，去看看`}><Camera size={20} strokeWidth={1.2}/><span>{places[id].name}<small>还没拍</small></span></button>;}
function ShotsSpread(){
 return <>
  <div className="jb-page jb-left">
   <h2 className="jb-title"><span>你眼睛里的小岛</span></h2>
   <p className="jb-lead">岛上有几台相机，你可以拍下这个世界。</p>
   <div className="jb-shots">{CAMERA_SPOTS.slice(0,2).map((id,i)=><Frame key={id} id={id} i={i}/>)}</div>
   <span className="jb-folio">— 5 —</span>
  </div>
  <div className="jb-page jb-right">
   <div className="jb-shots">{CAMERA_SPOTS.slice(2).map((id,i)=><Frame key={id} id={id} i={i+2}/>)}</div>
   <span className="jb-folio">— 6 —</span>
  </div>
 </>;
}
export default function Journal(){
 const s=useIsland();
 // Stamps found since she last looked are pressed in (once) when the page of five things opens.
 const fresh=useMemo(()=>new Set(coreMemories.filter(m=>s.save.core[m.key]&&!s.save.home.thingsSeen.includes(m.key)).map(m=>m.key as string)),[]);
 const [page,setPage]=useState<Page>(()=>{const w=window as any;const asked=w.__journalPage as Page|undefined;w.__journalPage=undefined;return asked??(fresh.size?'memories':lastPage);});
 useEffect(()=>{lastPage=page;if(page!=='memories')return;const t=setTimeout(()=>useIsland.getState().dispatch({type:'seen'}),1600);return()=>clearTimeout(t);},[page]);
 const unseen=coreMemories.some(m=>s.save.core[m.key]&&!s.save.home.thingsSeen.includes(m.key));
 return <Artifact className="journal-book" label="小岛手账">
  <div className="jb-cover">
   <nav className="jb-tabs" role="tablist" aria-label="手账分页">{PAGES.map(p=><button key={p.id} role="tab" aria-selected={page===p.id} className={`jb-tab tab-${p.id} ${page===p.id?'on':''} ${p.id==='memories'&&page!=='memories'&&(unseen||!s.save.endingSeen&&s.save.endingUnlocked)?'calling':''}`} onClick={()=>{if(p.id!==page){paperSound();setPage(p.id);}}}>{p.name}</button>)}</nav>
   <div className="jb-spread" key={page}>{page==='memories'?<ThingsSpread fresh={fresh}/>:page==='map'?<MapSpread/>:<ShotsSpread/>}<span className="jb-spine" aria-hidden="true"/></div>
   <span className="jb-ribbon" aria-hidden="true"/>
  </div>
 </Artifact>;
}
