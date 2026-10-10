import {create} from 'zustand';
import type {PlaceId,ObjectId,TimeOfDay} from './content';
import {records} from './content';
import {applyEvent,freshSave,restoreSave} from './lib/state';
import type {WorldSave,Event} from './lib/state';
export const SAVE_KEY='island-for-you:save:v1';
let error=false;let saved:WorldSave;
try{saved=restoreSave(localStorage.getItem(SAVE_KEY));}catch{saved=freshSave();error=true;}
interface IslandStore {
 save:WorldSave;started:boolean;intro:boolean;place:PlaceId|null;object:ObjectId;notice:string|null;storageError:boolean;
 cameraReset:number;party:number;invite:boolean;sitting:boolean;closeUp:boolean;studio:boolean;sandPhase:number;sandSince:number;sunriseStep:number;sunriseSince:number;weather:'clear'|'rain'|'glow';sunsetIndex:number;toy:string|null;radio:boolean;record:number;photoMode:boolean;
 start:()=>void;finishIntro:()=>void;travel:(p:PlaceId|null)=>void;open:(o:ObjectId)=>void;dispatch:(e:Event)=>void;notify:(s:string|null)=>void;
 setTime:(t:TimeOfDay)=>void;setParty:(n:number)=>void;setInvite:(v:boolean)=>void;setSitting:(v:boolean)=>void;setCloseUp:(v:boolean)=>void;setStudio:(v:boolean)=>void;setSand:(phase:number)=>void;setWeather:(w:'clear'|'rain'|'glow')=>void;setSunrise:(n:number)=>void;setSunset:(n:number)=>void;playToy:(s:string)=>void;toggleRadio:()=>void;nextRecord:()=>void;
 setting:(key:'muted'|'reducedMotion',value:boolean)=>void;tick:(seconds:number)=>void;reset:()=>void;
}
export const useIsland=create<IslandStore>((set,get)=>({
 save:saved,started:false,intro:false,place:null,object:null,notice:null,storageError:error,cameraReset:0,party:0,invite:false,sitting:false,closeUp:false,studio:false,sandPhase:0,sandSince:0,sunriseStep:0,sunriseSince:0,weather:'clear',sunsetIndex:0,toy:null,radio:false,record:0,photoMode:false,
 start:()=>set(s=>({started:true,intro:!s.save.letterRead&&!s.save.settings.reducedMotion})),
 finishIntro:()=>set({intro:false}),
 travel:(place)=>set(s=>({place,object:null,intro:false,weather:'clear',sunriseStep:0,photoMode:false,invite:false,sitting:false,closeUp:false,sandPhase:0,party:place==='celebration'?(s.save.endingSeen?5:0):0,cameraReset:s.cameraReset+1})),
 open:(object)=>{set({object,photoMode:object==='camera'});if(object==='wall')get().dispatch({type:'wall'});if(object==='journal')get().dispatch({type:'journal'});},
 dispatch:(event)=>set(s=>({save:applyEvent(s.save,event)})),notify:notice=>set({notice}),
 setParty:party=>set({party}),setInvite:invite=>set({invite}),setSitting:sitting=>set({sitting}),setCloseUp:closeUp=>set({closeUp}),setStudio:studio=>set({studio}),setSand:sandPhase=>set({sandPhase,sandSince:performance.now()}),
 setTime:time=>{if(get().save.letterRead)set(s=>({save:{...s.save,time}}));},
 setWeather:weather=>set({weather}),setSunrise:sunriseStep=>set({sunriseStep,sunriseSince:performance.now()}),setSunset:sunsetIndex=>set({sunsetIndex}),
 playToy:toy=>{get().dispatch({type:'park'});set({toy});},toggleRadio:()=>set(s=>({radio:!s.radio})),nextRecord:()=>set(s=>({record:(s.record+1)%records.length,radio:true})),
 setting:(key,value)=>set(s=>({save:{...s.save,settings:{...s.save.settings,[key]:value}}})),
 tick:seconds=>set(s=>{
  // Returning the same state notifies nobody (an empty object would re-render every subscriber every five seconds).
  if(!s.started||s.intro||s.object||s.place==='sunrise'||s.place==='sunset'||s.place==='celebration'||s.weather!=='clear'||s.save.letterRead)return s;
  const elapsed=s.save.elapsed+seconds,cores=Object.values(s.save.core).filter(Boolean).length;
  const time:TimeOfDay=elapsed>720||cores>=4?'night':elapsed>300||cores>=2?'sunset':'afternoon';
  return {save:{...s.save,elapsed,time}};
 }),
 reset:()=>set({save:freshSave(),place:null,object:null,weather:'clear',sunriseStep:0,started:false,intro:false,notice:'小岛回到了初见的样子。',radio:false,photoMode:false,party:0,invite:false})
}));
let lastSave=saved;
useIsland.subscribe(s=>{if(lastSave===s.save)return;lastSave=s.save;try{localStorage.setItem(SAVE_KEY,JSON.stringify(s.save));}catch{if(!s.storageError)useIsland.setState({storageError:true});}});
