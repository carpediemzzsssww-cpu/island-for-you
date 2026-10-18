import {photos} from '../content';
import type { PlaceId,TimeOfDay } from '../content';
export interface Bouquet { flowers:string[]; paper:string; ribbon:string; stems?:string[] }
export interface Shot { id:string;place:PlaceId;orientation:'portrait'|'landscape';aspect?:number;createdAt:number }
/** A moment for the journal's diary, in the order it happened (`at` is the time on her device). */
export interface Moment { id:string;at:number }
export interface WorldSave {
 occasion:string;version:1; core:{homeSeen:boolean;dinerSeen:boolean;flowerMade:boolean;sunsetSeen:boolean;sunriseReached:boolean};
 home:{wallViewed:boolean;journalOpened:boolean;bouquet:Bouquet|null;wallPhotos:string[];deskObjects:string[];thingsSeen:string[]};
 optional:{parkPlayed:boolean;pandaFound:boolean;sandWritten:boolean;photoSpots:PlaceId[];foodMemories:string[];photosFound:string[];lamps:string[]};
 secret:{cloudscapeSunset:boolean;greenFlash:boolean;firstLight:boolean;rainbow:boolean};shots:Shot[];log:Moment[];time:TimeOfDay;elapsed:number;endingUnlocked:boolean;endingSeen:boolean;letterRead:boolean;
 settings:{muted:boolean;reducedMotion:boolean};
}
export const freshSave=():WorldSave=>({occasion:'今天',version:1,core:{homeSeen:false,dinerSeen:false,flowerMade:false,sunsetSeen:false,sunriseReached:false},home:{wallViewed:false,journalOpened:false,bouquet:null,wallPhotos:[],deskObjects:[],thingsSeen:[]},optional:{parkPlayed:false,pandaFound:false,sandWritten:false,photoSpots:[],foodMemories:[],photosFound:[],lamps:[]},secret:{cloudscapeSunset:false,greenFlash:false,firstLight:false,rainbow:false},shots:[],log:[],time:'afternoon',elapsed:0,endingUnlocked:false,endingSeen:false,letterRead:false,settings:{muted:false,reducedMotion:typeof matchMedia!=='undefined'&&matchMedia('(prefers-reduced-motion: reduce)').matches}});
export type Event={type:'wall'}|{type:'journal'}|{type:'food';id:string}|{type:'bouquet';bouquet:Bouquet}|{type:'sunset'}|{type:'sunrise'}|{type:'park'}|{type:'panda'}|{type:'sand'}|{type:'secret'}|{type:'photo';shot:Shot}|{type:'found';id:string}|{type:'pin';id:string}|{type:'lamp';id:string}|{type:'ending'}|{type:'letter'}|{type:'seen'}|{type:'surprise';id:'greenFlash'|'firstLight'|'rainbow'};
const add=<T,>(a:T[],v:T)=>a.includes(v)?a:[...a,v];
/** Everything the journal's diary records, each the first time it happens. */
const moments:[string,(s:WorldSave)=>boolean][]=[['homeSeen',s=>s.core.homeSeen],['flowerMade',s=>s.core.flowerMade],['dinerSeen',s=>s.core.dinerSeen],['sunsetSeen',s=>s.core.sunsetSeen],['sunriseReached',s=>s.core.sunriseReached],
 ['pandaFound',s=>s.optional.pandaFound],['parkPlayed',s=>s.optional.parkPlayed],['sandWritten',s=>s.optional.sandWritten],['cloudscapeSunset',s=>s.secret.cloudscapeSunset],['greenFlash',s=>s.secret.greenFlash],['firstLight',s=>s.secret.firstLight],['rainbow',s=>s.secret.rainbow],['firstPhoto',s=>s.shots.length>0],['endingSeen',s=>s.endingSeen],['letterRead',s=>s.letterRead]];
export function applyEvent(save:WorldSave,event:Event):WorldSave {
 const s=structuredClone(save);
 switch(event.type){
 case 'wall':s.home.wallViewed=true;break;
 case 'journal':s.home.journalOpened=true;break;
 case 'food':s.core.dinerSeen=true;s.optional.foodMemories=add(s.optional.foodMemories,event.id);s.home.deskObjects=add(s.home.deskObjects,'menu');break;
 case 'bouquet':{const b=event.bouquet;
  // Bouquets from the florist's table list every stem (3 to 12); older saves list three kinds.
  if(b.stems?(b.stems.length<3||b.stems.length>12):(b.flowers.length!==3||new Set(b.flowers).size!==3))return save;
  s.home.bouquet=b.stems?{...b,flowers:[...new Set(b.stems)]}:b;}s.core.flowerMade=true;s.home.deskObjects=add(s.home.deskObjects,'pressed-flower');break;
 case 'sunset':s.core.sunsetSeen=true;s.home.deskObjects=add(s.home.deskObjects,'postcard');break;
 case 'sunrise':s.core.sunriseReached=true;s.home.deskObjects=add(s.home.deskObjects,'sunrise-ticket');break;
 case 'park':s.optional.parkPlayed=true;break;
 case 'panda':s.optional.pandaFound=true;s.home.deskObjects=add(s.home.deskObjects,'panda-sticker');break;
 case 'sand':s.optional.sandWritten=true;break;
 // A moment she caught at the end of a wait (the green flash, the first light, the rainbow).
 case 'surprise':s.secret[event.id]=true;break;
 case 'secret':s.secret.cloudscapeSunset=true;s.home.deskObjects=add(s.home.deskObjects,'after-rain');break;
 // Every shutter press is a memory. Existing one-per-place saves remain valid.
 case 'photo':if(s.shots.some(p=>p.id===event.shot.id))return save;s.shots.push(event.shot);s.optional.photoSpots=add(s.optional.photoSpots,event.shot.place);break;
 case 'found':s.optional.photosFound=add(s.optional.photosFound,event.id);break;
 // The photo wall only changes when she pins or unpins a photograph; up to five of her own picks beside the first three.
 case 'pin':s.home.wallPhotos=s.home.wallPhotos.includes(event.id)?s.home.wallPhotos.filter(id=>id!==event.id):[...s.home.wallPhotos,event.id].slice(-5);break;
 case 'lamp':s.optional.lamps=s.optional.lamps.includes(event.id)?s.optional.lamps.filter(id=>id!==event.id):[...s.optional.lamps,event.id];break;
 case 'ending':s.endingSeen=true;s.time='night';break;
 case 'letter':return save;
 // She has looked at the journal's page of five things: the stamps found so far are no longer new.
 case 'seen':{const found=Object.entries(s.core).filter(([,v])=>v).map(([k])=>k);if(found.every(k=>s.home.thingsSeen.includes(k)))return save;s.home.thingsSeen=found;break;}
 }
 s.core.homeSeen=s.home.wallViewed&&s.home.journalOpened;
 s.endingUnlocked=Object.values(s.core).every(Boolean);
 const now=Date.now();for(const [id,happened] of moments)if(happened(s)&&!happened(save)&&!s.log.some(m=>m.id===id))s.log.push({id,at:now});
 return s;
}
export function restoreSave(raw:string|null):WorldSave {
 if(!raw)return freshSave();
 try{const p=JSON.parse(raw);if(p.version!==1||!p.core||!p.home||!p.optional||!p.settings)return freshSave();
 const base=freshSave();const merged={...base,...p,core:{...base.core,...p.core},home:{...base.home,...p.home},optional:{...base.optional,...p.optional},secret:{...base.secret,...p.secret},settings:{...base.settings,...p.settings}};
 if(!Array.isArray(merged.shots)||!Array.isArray(merged.home.wallPhotos)||!Array.isArray(merged.optional.foodMemories)||!['afternoon','sunset','night','morning'].includes(merged.time))return freshSave();
 if(!Array.isArray(merged.log))merged.log=[];if(!Array.isArray(merged.home.thingsSeen))merged.home.thingsSeen=[];
 const ids=new Set(photos.map(p=>p.id));merged.home.wallPhotos=merged.home.wallPhotos.filter((id:string)=>ids.has(id)).slice(-5);merged.optional.photosFound=merged.optional.photosFound.filter((id:string)=>ids.has(id));merged.occasion=typeof p.occasion==='string'?p.occasion.slice(0,24):'今天';merged.letterRead=false;merged.log=merged.log.filter((m:Moment)=>m.id!=='letterRead');
 merged.endingUnlocked=Object.values(merged.core).every(Boolean);return merged;
 }catch{return freshSave();}
}
