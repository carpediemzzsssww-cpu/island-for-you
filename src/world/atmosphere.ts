import {Color,MathUtils,Vector3} from 'three';
import {useIsland} from '../store';

// One palette per narrative light. Everything in the world (sky, sea, clouds, sun, fog, bloom) eases toward the current one.
type Mood={zenith:string;horizon:string;haze:string;sun:string;sunIntensity:number;sunDir:[number,number,number];hemiSky:string;hemiGround:string;hemiIntensity:number;
 deep:string;mid:string;shallow:string;foam:string;cloudLit:string;cloudShade:string;stars:number;bloom:number;sunDisc:number;exposure:number};
const m=(o:Mood)=>o;
export const moods={
 afternoon:m({zenith:'#78b6dc',horizon:'#f8e4c0',haze:'#dbe6e0',sun:'#ffe2b6',sunIntensity:2.25,sunDir:[-.56,.5,.66],hemiSky:'#dcebf1',hemiGround:'#bba986',hemiIntensity:1.0,
  deep:'#2a7a9c',mid:'#38a6b6',shallow:'#82dfcb',foam:'#f7fbf1',cloudLit:'#fffaf1',cloudShade:'#d5dce6',stars:0,bloom:.28,sunDisc:.9,exposure:1}),
 afternoonGold:m({zenith:'#86b6d6',horizon:'#fde0b4',haze:'#e8dcc6',sun:'#ffd49a',sunIntensity:2.3,sunDir:[-.72,.3,.63],hemiSky:'#e6e6dc',hemiGround:'#b39d7c',hemiIntensity:1,
  deep:'#2b7193',mid:'#55a3b0',shallow:'#a6dcc3',foam:'#fbf7ea',cloudLit:'#fff1d8',cloudShade:'#cfcfd8',stars:0,bloom:.4,sunDisc:1,exposure:1}),
 sunset:m({zenith:'#6a82b5',horizon:'#ffb487',haze:'#efc0a2',sun:'#ffa872',sunIntensity:2.3,sunDir:[-.78,.11,.62],hemiSky:'#f0c5b8',hemiGround:'#94826f',hemiIntensity:.95,
  deep:'#355c89',mid:'#7d7fa6',shallow:'#eaae92',foam:'#fff1e1',cloudLit:'#ffc49c',cloudShade:'#9784ad',stars:0,bloom:.55,sunDisc:1,exposure:1}),
 sunsetPink:m({zenith:'#6e76ae',horizon:'#f8a5a6',haze:'#e8b3b6',sun:'#ff9f8c',sunIntensity:2.1,sunDir:[-.8,.08,.6],hemiSky:'#efbfc4',hemiGround:'#8d7a7c',hemiIntensity:.95,
  deep:'#3d568a',mid:'#8b7aa8',shallow:'#eea5a4',foam:'#ffeae6',cloudLit:'#ffb9b4',cloudShade:'#8e7fae',stars:0,bloom:.55,sunDisc:1,exposure:1}),
 sunsetGold:m({zenith:'#7b93bd',horizon:'#ffcf86',haze:'#f2d09e',sun:'#ffc06e',sunIntensity:2.5,sunDir:[-.76,.14,.64],hemiSky:'#f4d6b0',hemiGround:'#9a8768',hemiIntensity:1,
  deep:'#2f6590',mid:'#6f97a8',shallow:'#f0c48f',foam:'#fff5e0',cloudLit:'#ffd59c',cloudShade:'#a18fa6',stars:0,bloom:.55,sunDisc:1,exposure:1}),
 sunsetDusk:m({zenith:'#3f4a86',horizon:'#e58a8e',haze:'#b98a9e',sun:'#ff8c78',sunIntensity:1.0,sunDir:[-.8,-.03,.6],hemiSky:'#9a8aae',hemiGround:'#5a5060',hemiIntensity:.8,
  deep:'#2a3a6a',mid:'#5a5a8a',shallow:'#b48a9a',foam:'#f0d8de',cloudLit:'#f6a0a0',cloudShade:'#6a5a8a',stars:.25,bloom:.7,sunDisc:.4,exposure:1.02}),
 night:m({zenith:'#0b1c3a',horizon:'#34507a',haze:'#1f3252',sun:'#b7cbf2',sunIntensity:.42,sunDir:[.35,.62,-.7],hemiSky:'#5c73a0',hemiGround:'#2b3446',hemiIntensity:.72,
  deep:'#0c2341',mid:'#15395b',shallow:'#2c6479',foam:'#9eb5c8',cloudLit:'#4a5e88',cloudShade:'#233050',stars:1,bloom:.9,sunDisc:0,exposure:1.05}),
 rain:m({zenith:'#7b8c97',horizon:'#aab5b4',haze:'#9eaaa9',sun:'#dfe6e6',sunIntensity:.55,sunDir:[-.3,.8,.3],hemiSky:'#b8c4c5',hemiGround:'#7d887f',hemiIntensity:1.1,
  deep:'#44636e',mid:'#5d7d85',shallow:'#86a3a0',foam:'#dfe7e4',cloudLit:'#c2cacf',cloudShade:'#7c8793',stars:0,bloom:.15,sunDisc:0,exposure:1}),
 glow:m({zenith:'#5a5a94',horizon:'#ff7a5c',haze:'#e8977f',sun:'#ffa27e',sunIntensity:1.55,sunDir:[-.72,.13,.68],hemiSky:'#f2b0a4',hemiGround:'#8c7474',hemiIntensity:1.05,
  deep:'#4a4576',mid:'#b25e78',shallow:'#f59a82',foam:'#ffe0cf',cloudLit:'#ff9474',cloudShade:'#84578a',stars:0,bloom:.7,sunDisc:1,exposure:1}),
 predawn:m({zenith:'#15244c',horizon:'#4c5486',haze:'#39436b',sun:'#a9b7e6',sunIntensity:.5,sunDir:[.82,-.12,-.55],hemiSky:'#56699b',hemiGround:'#2a3244',hemiIntensity:.88,
  deep:'#10213f',mid:'#1c3558',shallow:'#34587a',foam:'#8fa3c2',cloudLit:'#5a6594',cloudShade:'#2a3154',stars:.8,bloom:.8,sunDisc:0,exposure:1.05}),
 violet:m({zenith:'#2c3468',horizon:'#9a7cae',haze:'#6c6594',sun:'#c7a4d6',sunIntensity:.7,sunDir:[.82,-.05,-.55],hemiSky:'#7c77a6',hemiGround:'#3a3a4f',hemiIntensity:.8,
  deep:'#1f2d55',mid:'#4c4e80',shallow:'#8a7fae',foam:'#c4b8da',cloudLit:'#a38dbd',cloudShade:'#4b4775',stars:.35,bloom:.6,sunDisc:0,exposure:1.02}),
 dawn:m({zenith:'#5566a0',horizon:'#f6a7a2',haze:'#d8a6ad',sun:'#ffbe9e',sunIntensity:1.5,sunDir:[.82,.0,-.55],hemiSky:'#d7b1bf',hemiGround:'#6e6572',hemiIntensity:.9,
  deep:'#34507e',mid:'#8a7aa3',shallow:'#eea9a2',foam:'#ffe6e0',cloudLit:'#ffc0b2',cloudShade:'#8b7ca4',stars:0,bloom:.6,sunDisc:1,exposure:1}),
 sunrise:m({zenith:'#80aad6',horizon:'#ffd697',haze:'#f2d6b1',sun:'#ffd497',sunIntensity:2.5,sunDir:[.8,.16,-.56],hemiSky:'#f2dfc2',hemiGround:'#a39373',hemiIntensity:1.05,
  deep:'#2e6f96',mid:'#6fa0b0',shallow:'#f4cf98',foam:'#fff6e4',cloudLit:'#ffe0b0',cloudShade:'#a8a1b6',stars:0,bloom:.5,sunDisc:1,exposure:1})
};
export type MoodId=keyof typeof moods;
// Coming back from the sunrise hill, the island keeps the morning light for a moment, then slowly returns to the day.
export const carry={mood:null as MoodId|null,until:0,slowUntil:0};
export function carryMorning(){const now=performance.now();carry.mood='sunrise';carry.until=now+5500;carry.slowUntil=now+17000;}
/** On the hilltop the dawn arrives by itself; 0 → 1 over the wait. */
export function sunriseDawn(){const s=useIsland.getState();if(s.place!=='sunrise'||s.sunriseStep<3)return 0;return Math.min(1,(performance.now()-s.sunriseSince)/(s.save.settings.reducedMotion?2000:14000));}
export function currentMood():MoodId{
 const s=useIsland.getState();
 if(carry.mood&&!s.place&&performance.now()<carry.until)return carry.mood;
 if(s.place==='sunrise')return (['predawn','violet','dawn','sunrise'] as const)[s.sunriseStep]??'predawn';
 if(s.weather==='rain')return 'rain';
 if(s.weather==='glow')return 'glow';
 if(s.place==='sunset')return (['sunset','sunsetPink','sunsetGold'] as const)[s.sunsetIndex%3];
 if(s.save.time==='sunset')return 'sunset';
 if(s.save.time==='night')return 'night';
 if(s.save.time==='morning')return 'sunrise';
 return 'afternoon';
}
const colourKeys=['zenith','horizon','haze','sun','hemiSky','hemiGround','deep','mid','shallow','foam','cloudLit','cloudShade'] as const;
const numberKeys=['sunIntensity','hemiIntensity','stars','bloom','sunDisc','exposure'] as const;
type Live={[K in typeof colourKeys[number]]:Color}&{[K in typeof numberKeys[number]]:number}&{sunDir:Vector3;mood:MoodId};
function fromMood(id:MoodId):Live{const p=moods[id];const live:any={mood:id,sunDir:new Vector3(...p.sunDir).normalize()};colourKeys.forEach(k=>live[k]=new Color(p[k]));numberKeys.forEach(k=>live[k]=p[k]);return live;}
export const atmosphere:Live=fromMood('afternoon');
const targets=Object.fromEntries(Object.keys(moods).map(id=>[id,fromMood(id as MoodId)])) as Record<MoodId,Live>;
// Sunset coast: arriving starts a slow sunset instead of a cut. The sky follows these keys (seconds); sitting on
// the bench speeds it up, and browsing the postcards pauses it on each photograph's own palette.
const SUNSET:[number,MoodId][]=[[0,'afternoonGold'],[10,'sunsetGold'],[24,'sunset'],[38,'sunsetPink'],[54,'sunsetDusk']];
export const sunsetClock={progress:0,place:null as string|null};
const blend:Live=fromMood('afternoon');
function blendTo(a:MoodId,b:MoodId,f:number){const x=targets[a],y=targets[b];colourKeys.forEach(k=>blend[k].copy(x[k]).lerp(y[k],f));numberKeys.forEach(k=>blend[k]=MathUtils.lerp(x[k],y[k],f));blend.sunDir.copy(x.sunDir).lerp(y.sunDir,f).normalize();blend.mood=f<.5?a:b;return blend;}
function sunsetTarget(dt:number){
 const s=useIsland.getState();
 if(sunsetClock.place!=='sunset')sunsetClock.progress=0;
 if(s.object!=='postcards')sunsetClock.progress=Math.min(SUNSET[SUNSET.length-1][0],sunsetClock.progress+dt*(s.save.settings.reducedMotion?6:s.sitting?2.6:1));
 const p=sunsetClock.progress;let i=0;while(i<SUNSET.length-2&&p>SUNSET[i+1][0])i++;
 const [t0,a]=SUNSET[i],[t1,b]=SUNSET[i+1];const f=MathUtils.smoothstep(p,t0,t1);return blendTo(a,b,f);
}
/** Ease the shared atmosphere toward the narrative mood. Call once per frame. */
export function stepAtmosphere(dt:number){
 const s=useIsland.getState();const dawn=s.place==='sunrise'&&s.sunriseStep>=3;const scripted=dawn||s.place==='sunset'&&s.object!=='postcards'&&s.weather==='clear';
 const id=currentMood();const t=dawn?blendTo('dawn','sunrise',MathUtils.smoothstep(sunriseDawn(),0,1)):scripted?sunsetTarget(Math.min(dt,.1)):targets[id];sunsetClock.place=s.place;
 const slow=id==='predawn'||id==='violet'||id==='dawn'||id==='sunrise'||id==='glow';
 const k=1-Math.exp(-Math.min(dt,.1)*(scripted?1.6:performance.now()<carry.slowUntil&&!s.place?.3:slow?.55:.9));atmosphere.mood=scripted?t.mood:id;
 colourKeys.forEach(key=>atmosphere[key].lerp(t[key],k));numberKeys.forEach(key=>atmosphere[key]=MathUtils.lerp(atmosphere[key],t[key],k));
 atmosphere.sunDir.lerp(t.sunDir,k).normalize();
}
