import {useEffect,useMemo,useState} from 'react';
import * as THREE from 'three';
import {useIsland} from '../store';
import {flowers,menu,photos,portraits,coreMemories,places,today} from '../content';

// A cork board above Home's desk: the five things she brings back are pinned here as they happen, so the house
// itself shows how far she has come (家本身就是进度条). Empty places wait with a pencilled hint.

const FONT='"Noto Serif SC","Songti SC","STSong",serif';
function useImage(src:string){const [img,setImg]=useState<HTMLImageElement|null>(null);useEffect(()=>{const i=new Image();i.onload=()=>setImg(i);i.src=src;},[src]);return img;}
function texture(w:number,h:number,draw:(g:CanvasRenderingContext2D)=>void){const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d')!;draw(g);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;}
function cover(g:CanvasRenderingContext2D,img:HTMLImageElement,x:number,y:number,w:number,h:number){const r=Math.max(w/img.width,h/img.height),sw=w/r,sh=h/r;g.drawImage(img,(img.width-sw)/2,(img.height-sh)/2,sw,sh,x,y,w,h);}
const cork=()=>texture(512,352,g=>{g.fillStyle='#c79a6b';g.fillRect(0,0,512,352);for(let i=0;i<5200;i++){g.fillStyle=`rgba(${90+Math.random()*80},${55+Math.random()*50},${25+Math.random()*30},${.12+Math.random()*.25})`;g.fillRect(Math.random()*512,Math.random()*352,1+Math.random()*2.4,1+Math.random()*2.4);}});
function emptyCard(label:string,hint:string){return texture(256,192,g=>{g.clearRect(0,0,256,192);g.setLineDash([9,7]);g.strokeStyle='rgba(255,247,232,.75)';g.lineWidth=3;g.beginPath();g.roundRect(10,10,236,172,14);g.stroke();
 g.fillStyle='rgba(255,247,232,.92)';g.textAlign='center';g.font=`600 30px ${FONT}`;g.fillText(label,128,86);g.font=`22px ${FONT}`;g.fillStyle='rgba(255,247,232,.75)';g.fillText(hint,128,128);});}
export default function MemoryBoard({position,rotationY=Math.PI/2,interactive=true}:{position:[number,number,number];rotationY?:number;interactive?:boolean}){
 const s=useIsland();const c=s.save.core;const sunsetPhoto=photos.find(p=>p.category==='sunset');const portrait=portraits[0]??photos[0];
 const sunsetImg=useImage(sunsetPhoto?.thumbnail??portrait.thumbnail);const portraitImg=useImage(portrait.thumbnail);
 const board=useMemo(cork,[]);
 const bouquetNames=(s.save.home.bouquet?.flowers??[]).map(id=>flowers.find(f=>f.id===id)?.name).filter(Boolean).join(' · ');
 const dishes=s.save.optional.foodMemories.map(id=>menu.find(m=>m.id===id)?.name).filter(Boolean) as string[];
 const cards=useMemo(()=>({
  homeSeen:c.homeSeen&&portraitImg?texture(256,300,g=>{g.fillStyle='#fffdf6';g.fillRect(0,0,256,300);cover(g,portraitImg,16,16,224,224);g.fillStyle='#6f6a5d';g.font=`24px ${FONT}`;g.textAlign='center';g.fillText('回家了',128,276);}):null,
  flowerMade:c.flowerMade?texture(256,192,g=>{g.fillStyle='#d9c3a0';g.fillRect(0,0,256,192);
   // A pressed tulip.
   g.strokeStyle='#6f8f58';g.lineWidth=4;g.beginPath();g.moveTo(70,170);g.quadraticCurveTo(76,110,84,70);g.stroke();g.fillStyle='#7d9d63';g.beginPath();g.ellipse(64,130,9,30,-.5,0,6.3);g.fill();
   g.fillStyle='#e48ea3';g.beginPath();g.moveTo(84,72);g.bezierCurveTo(58,64,62,26,74,22);g.lineTo(84,40);g.lineTo(94,22);g.bezierCurveTo(106,26,110,64,84,72);g.fill();
   g.fillStyle='#55473a';g.font=`600 26px ${FONT}`;g.textAlign='left';g.fillText('今天的花',124,70);g.font=`19px ${FONT}`;g.fillStyle='#6b5d4c';
   const words=bouquetNames||'郁金香';words.split(' · ').slice(0,4).forEach((w,i)=>g.fillText(w,126,104+i*24));}):null,
  dinerSeen:c.dinerSeen?texture(220,300,g=>{g.fillStyle='#fbf8f1';g.fillRect(0,0,220,300);g.fillStyle='#3d3d3a';g.textAlign='center';g.font=`600 26px ${FONT}`;g.fillText(places.diner.name,110,42);g.font=`18px ${FONT}`;g.fillText('今日份',110,70);
   g.setLineDash([4,4]);g.strokeStyle='#99958a';g.beginPath();g.moveTo(18,86);g.lineTo(202,86);g.stroke();g.textAlign='left';g.font=`19px ${FONT}`;
   (dishes.length?dishes:['椰子鸡']).slice(0,5).forEach((d,i)=>{g.fillText(d,22,118+i*30);g.textAlign='right';g.fillText('✓',198,118+i*30);g.textAlign='left';});
   g.beginPath();g.moveTo(18,262);g.lineTo(202,262);g.stroke();g.textAlign='center';g.fillText('吃饱了，很满足。',110,288);}):null,
  sunsetSeen:c.sunsetSeen&&sunsetImg?texture(300,210,g=>{g.fillStyle='#fffaf0';g.fillRect(0,0,300,210);cover(g,sunsetImg,12,12,276,150);g.fillStyle='#6f6a5d';g.font=`20px ${FONT}`;g.textAlign='left';g.fillText('一起看过的日落',16,192);g.strokeStyle='#d9a7a0';g.strokeRect(246,170,40,30);}):null,
  sunriseReached:c.sunriseReached?texture(300,140,g=>{g.fillStyle='#f3d9a8';g.beginPath();g.roundRect(0,0,300,140,10);g.fill();g.setLineDash([5,5]);g.strokeStyle='#b88b55';g.lineWidth=2;g.beginPath();g.moveTo(220,8);g.lineTo(220,132);g.stroke();
   g.fillStyle='#6b4a2a';g.textAlign='left';g.font=`600 26px ${FONT}`;g.fillText('等天亮的山坡',18,50);g.font=`20px ${FONT}`;g.fillText(`单程 · ${today.month} 月 ${today.day} 日`,18,84);g.fillText('05:41 天亮',18,114);g.strokeStyle='#6b4a2a';g.fillStyle='#6b4a2a';g.lineWidth=3;g.lineCap='round';g.setLineDash([]);g.beginPath();g.arc(260,74,9,0,Math.PI*2);g.fill();for(let k=0;k<8;k++){const a=k*Math.PI/4;g.beginPath();g.moveTo(260+Math.cos(a)*14,74+Math.sin(a)*14);g.lineTo(260+Math.cos(a)*20,74+Math.sin(a)*20);g.stroke();}}):null,
 }),[c.homeSeen,c.flowerMade,c.dinerSeen,c.sunsetSeen,c.sunriseReached,portraitImg,sunsetImg,bouquetNames,dishes.join()]);
 const empties=useMemo(()=>Object.fromEntries(coreMemories.map(m=>[m.key,emptyCard(m.name,'还空着')])),[]);
 useEffect(()=>()=>{Object.values(cards).forEach(t=>t?.dispose());},[cards]);
 // Slots on the board (x across, y up, in board space), sizes in metres, and a slight tilt each.
 const slots:{key:typeof coreMemories[number]['key'];x:number;y:number;w:number;h:number;r:number}[]=[
  {key:'homeSeen',x:-.4,y:.06,w:.2,h:.235,r:.05},{key:'flowerMade',x:-.12,y:.13,w:.25,h:.19,r:-.04},{key:'sunsetSeen',x:.25,y:.12,w:.3,h:.21,r:.03},
  {key:'dinerSeen',x:-.1,y:-.16,w:.17,h:.23,r:.06},{key:'sunriseReached',x:.26,y:-.15,w:.3,h:.14,r:-.05}];
 const open=()=>{(window as any).__journalPage='memories';s.open('journal');};
 return <group position={position} rotation={[0,rotationY,0]} onClick={interactive?e=>{e.stopPropagation();open();}:undefined}>
  <mesh position={[0,0,-.012]} castShadow receiveShadow><boxGeometry args={[1.18,.8,.03]}/><meshStandardMaterial color="#8f6b4a" roughness={.7}/></mesh>
  <mesh position={[0,0,.005]}><planeGeometry args={[1.1,.72]}/><meshStandardMaterial map={board} roughness={.95}/></mesh>
  {slots.map(sl=>{const t=cards[sl.key as keyof typeof cards];const done=!!t;return <group key={sl.key} position={[sl.x,sl.y,.012]} rotation={[0,0,sl.r]}>
   <mesh><planeGeometry args={[sl.w,sl.h]}/><meshStandardMaterial map={t??empties[sl.key]} transparent={!done} roughness={.85}/></mesh>
   {done&&<mesh position={[0,sl.h/2-.025,.012]}><sphereGeometry args={[.012,10,8]}/><meshStandardMaterial color={['#d9566d','#3f7fb8','#e6b33c','#5a9a6a','#d9566d'][slots.indexOf(sl)]} roughness={.3}/></mesh>}
  </group>;})}
 </group>;
}
