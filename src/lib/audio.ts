import {tracks,records} from '../content';
import type {TrackId} from '../content';
let context:AudioContext|null=null,master:GainNode|null=null,sea:GainNode|null=null,musicGain:GainNode|null=null,nature:GainNode|null=null;
// One shared <audio> element for every song: iOS unlocks it once on the 上岛 tap, then it can switch tracks on its own.
// Volume goes through Web Audio gain because iOS ignores HTMLMediaElement.volume.
let player:HTMLAudioElement|null=null,current:TrackId|null=null,switching:ReturnType<typeof setTimeout>|null=null;
const positions:Partial<Record<TrackId,number>>={};const finished=new Set<TrackId>();
let arrivalArmed=false,endingArmed=false;
// The page shows a short "now playing" line whenever a new song begins.
export const trackBus=new EventTarget();
const announce=(id:TrackId)=>trackBus.dispatchEvent(new CustomEvent('track',{detail:tracks[id]}));
export interface Scene{muted:boolean;started:boolean;place:string|null;radio:boolean;record:number;sunriseStep:number;night:boolean;hidden:boolean;party:number}
let scene:Scene={muted:false,started:false,place:null,radio:false,record:0,sunriseStep:0,night:false,hidden:false,party:0};
function tone(f:number,delay=0,length=.6,volume=.03,type:OscillatorType='sine',destination:AudioNode|null=master){if(!context||!destination)return;const osc=context.createOscillator(),gain=context.createGain(),at=context.currentTime+delay;osc.type=type;osc.frequency.value=f;gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(volume,at+.01);gain.gain.exponentialRampToValueAtTime(.0001,at+length);osc.connect(gain).connect(destination);osc.start(at);osc.stop(at+length+.05);osc.onended=()=>{osc.disconnect();gain.disconnect();};}
function chirp(f0:number,f1:number,delay:number,length:number,volume:number){if(!context||!nature)return;const osc=context.createOscillator(),gain=context.createGain(),at=context.currentTime+delay;osc.frequency.setValueAtTime(f0,at);osc.frequency.exponentialRampToValueAtTime(f1,at+length);gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(volume,at+length*.2);gain.gain.exponentialRampToValueAtTime(.0001,at+length);osc.connect(gain).connect(nature);osc.start(at);osc.stop(at+length+.05);osc.onended=()=>{osc.disconnect();gain.disconnect();};}
// Night crickets and a few daytime birds, so the island never falls completely silent between songs.
function ambience(){
 const next=()=>setTimeout(()=>{if(!scene.started||scene.muted||scene.hidden){next();return;}
  if(scene.night){const f=4100+Math.random()*500;for(let i=0;i<3;i++)tone(f,i*.07,.05,.006,'sine',nature);}
  else if(scene.place!=='sunset'&&scene.place!=='cloud'&&Math.random()<.45){const f=2300+Math.random()*900;chirp(f,f*1.45,0,.12,.007);chirp(f*1.1,f*.85,.16,.1,.006);}
  next();},scene.night?1500+Math.random()*1400:3500+Math.random()*5500);
 next();
}
function cue():{id:TrackId|null;level:number}{
 const s=scene;
 if(s.muted||s.hidden)return {id:null,level:0};
 if(s.radio)return {id:records[s.record%records.length],level:s.place==='home'?1:.25};
 if(!s.started||s.place==='sunset')return {id:null,level:0};
 // The birthday table has its own music: the synthesized Happy Birthday below.
 if(s.place==='celebration')return {id:null,level:0};
 if(endingArmed&&!finished.has('ending'))return {id:'ending',level:1};
 if(s.place==='sunrise'&&s.sunriseStep>=1&&!finished.has('sunrise'))return {id:'sunrise',level:.9};
 if(s.place==='diner')return {id:'diner',level:.55};
 if(arrivalArmed&&!finished.has('arrival'))return {id:'arrival',level:.75};
 return {id:null,level:0};
}
function apply(){
 if(!context||!master||!player||!musicGain)return;
 const now=context.currentTime;const {id,level}=cue();
 const birthday=scene.started&&scene.place==='celebration'&&scene.party>=1;
 master.gain.setTargetAtTime(scene.muted||scene.hidden?0:.5,now,.4);
 sea?.gain.setTargetAtTime((scene.place==='sunset'?.5:scene.place==='home'?.12:.26)*(id||birthday?.6:1),now,1);
 nature?.gain.setTargetAtTime(id||birthday?.45:1,now,1);
 playBirthday(birthday?(scene.party===5?'full':'box'):null);
 if(id===current){if(id){musicGain.gain.setTargetAtTime(level*tracks[id].volume,now,.8);if(player.paused)void player.play().catch(()=>{});}return;}
 if(current)positions[current]=player.currentTime;
 musicGain.gain.setTargetAtTime(0,now,.3);
 const previous=current;current=id;
 if(switching)clearTimeout(switching);
 switching=setTimeout(()=>{switching=null;if(!player||!context||!musicGain||current!==id)return;
  if(!id){player.pause();return;}
  const t=tracks[id];const at=positions[id]??t.start??0;
  if(!player.src.endsWith(t.src))player.src=t.src;
  const go=()=>{try{player!.currentTime=at;}catch{/* seek after metadata */}void player!.play().catch(()=>{});musicGain!.gain.setTargetAtTime(level*t.volume,context!.currentTime,1);announce(id);};
  if(player.readyState>=1)go();else player.addEventListener('loadedmetadata',go,{once:true});
 },previous?1000:30);
}
export function beginAudio(){
 try{
  if(!context){
   context=new AudioContext();master=context.createGain();master.gain.value=.5;master.connect(context.destination);
   const buffer=context.createBuffer(1,context.sampleRate*4,context.sampleRate),data=buffer.getChannelData(0);let brown=0;
   for(let i=0;i<data.length;i++){brown=(brown+(Math.random()*2-1)*.02)/1.02;data[i]=brown*3.5;}
   const noise=context.createBufferSource();noise.buffer=buffer;noise.loop=true;sea=context.createGain();sea.gain.value=.3;const filter=context.createBiquadFilter();filter.type='lowpass';filter.frequency.value=750;noise.connect(filter).connect(sea).connect(master);noise.start();
   const lfo=context.createOscillator(),depth=context.createGain();lfo.frequency.value=.08;depth.gain.value=.13;lfo.connect(depth).connect(sea.gain);lfo.start();
   nature=context.createGain();nature.connect(master);musicGain=context.createGain();musicGain.gain.value=0;musicGain.connect(master);
   player=new Audio();player.preload='auto';player.setAttribute('playsinline','');
   context.createMediaElementSource(player).connect(musicGain);
   player.addEventListener('ended',()=>{if(!current||!player)return;
    // The diner radio and the record player loop; story songs play once.
    if(scene.radio||current==='diner'){player.currentTime=0;void player.play().catch(()=>{});return;}
    finished.add(current);positions[current]=0;current=null;apply();});
   ambience();setTimeout(hall,3000);
  }
  void context.resume();
  // Arriving greets her with the first song; start it inside the tap so the element counts as user-activated.
  finished.delete('arrival');delete positions.arrival;arrivalArmed=true;
  if(player&&musicGain&&!current&&!scene.radio){const t=tracks.arrival;current='arrival';player.src=t.src;try{player.currentTime=t.start??0;}catch{/* applied on load */}
   player.addEventListener('loadedmetadata',()=>{if(current==='arrival'&&player&&player.currentTime<1)player.currentTime=t.start??0;},{once:true});
   void player.play().catch(()=>{});musicGain.gain.setValueAtTime(0,context.currentTime);musicGain.gain.setTargetAtTime(.75*t.volume,context.currentTime,1.4);setTimeout(()=>announce('arrival'),2500);}
 }catch{/* Silent devices retain the complete interaction. */}
}
export function updateAudio(next:Partial<Scene>){scene={...scene,...next};apply();}
/** For diagnostics: which song is on and whether it is actually playing. */
export function musicState(){return {track:current,playing:!!player&&!player.paused,time:player?Math.round(player.currentTime):0,birthday:tune?.mode??null};}
/** After the candles, the ending song walks her home to the letter. */
export function startEndingMusic(){finished.delete('ending');delete positions.ending;endingArmed=true;apply();}

// ---- Happy Birthday --------------------------------------------------------------------------------------------
// "Happy Birthday to You" is a public-domain melody; it is played here by a small synthesized music box (no recording).
// While the lamps come on, the cake arrives and she makes a wish, the box plays it slowly and softly, over and over.
// When the candles are blown out it plays once more, fuller (bells, a warm pad and a bass), with the fireworks, then
// goes back to the quiet box. Leaving the table lets it fade.
// [midi note, start beat, length in beats]; 3/4 with a two-note pickup, and a held note on "dear ...".
const MELODY:[number,number,number][]=[[67,0,.75],[67,.75,.25],[69,1,1],[67,2,1],[72,3,1],[71,4,2],[67,6,.75],[67,6.75,.25],[69,7,1],[67,8,1],[74,9,1],[72,10,2],
 [67,12,.75],[67,12.75,.25],[79,13,1],[76,14,1],[72,15,1],[71,16,1],[69,17,2],[77,19,.75],[77,19.75,.25],[76,20,1],[72,21,1],[74,22,1],[72,23,3]];
// [start beat, bass, upper chord tones, length]
const CHORDS:[number,number,number[],number][]=[[1,48,[64,67],3],[4,43,[59,65],3],[7,43,[59,65],3],[10,48,[55,64],3],[13,48,[58,64],3],[16,41,[57,60],4],[20,43,[60,64],2],[22,43,[59,65],1],[23,36,[55,64],3]];
const SONG_BEATS=26.5;
type Note={at:number;play:()=>void};
let tune:{mode:'box'|'full';out:GainNode;timer:ReturnType<typeof setInterval>|null;queue:Note[];passEnd:number}|null=null;let room:ConvolverNode|null=null;let wanted:'box'|'full'|null=null;
const hz=(m:number)=>440*Math.pow(2,(m-69)/12);
/** A small hall: decaying noise as an impulse response, so the box rings a little. Built a few seconds after she
 *  arrives, long before the evening needs it. */
function hall(){if(room||!context||!master)return room;const ctx=context;const len=Math.round(ctx.sampleRate*2.4);const ir=ctx.createBuffer(2,len,ctx.sampleRate);
 for(let ch=0;ch<2;ch++){const d=ir.getChannelData(ch);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,3.2);}
 room=ctx.createConvolver();room.buffer=ir;const wet=ctx.createGain();wet.gain.value=.32;room.connect(wet).connect(master);return room;}
/** One tine of a music box: a bright attack and a long ring, with two faint higher partials. */
function tine(m:number,at:number,vol:number,out:AudioNode,ring=2.2){if(!context)return;const f=hz(m);
 for(const [ratio,amp,decay] of [[1,1,ring],[2,.16,ring*.35],[5.4,.06,.16]] as const){const o=context.createOscillator(),g=context.createGain();o.frequency.value=f*ratio;
  g.gain.setValueAtTime(0,at);g.gain.linearRampToValueAtTime(vol*amp,at+.005);g.gain.exponentialRampToValueAtTime(.0001,at+decay);o.connect(g).connect(out);o.start(at);o.stop(at+decay+.05);o.onended=()=>{o.disconnect();g.disconnect();};}}
/** A soft sustained voice (for the full version's melody and pad). */
function pad(m:number,at:number,length:number,vol:number,out:AudioNode,bright=900){if(!context)return;const ctx=context;const f=ctx.createBiquadFilter();f.type='lowpass';f.frequency.value=bright;const g=ctx.createGain();
 g.gain.setValueAtTime(0,at);g.gain.linearRampToValueAtTime(vol,at+.18);g.gain.setValueAtTime(vol,at+Math.max(.2,length-.1));g.gain.exponentialRampToValueAtTime(.0001,at+length+.7);f.connect(g).connect(out);
 const oscs=[-6,6].map(cents=>{const o=ctx.createOscillator();o.type='triangle';o.frequency.value=hz(m);o.detune.value=cents;o.connect(f);o.start(at);o.stop(at+length+.8);return o;});
 oscs[0].onended=()=>{oscs.forEach(o=>o.disconnect());f.disconnect();g.disconnect();};}
/** One pass of the song as a list of notes in time order (nothing is built until a note is due). */
function plan(mode:'box'|'full',out:GainNode,t0:number){
 const beat=mode==='box'?60/80:60/96,notes:Note[]=[];const at=(t:number,play:()=>void)=>notes.push({at:t,play});
 for(const [m,b,l] of MELODY){const t=t0+b*beat;if(mode==='box')at(t,()=>tine(m+12,t,.12,out,1.6+l*beat));else at(t,()=>{tine(m+12,t,.07,out,1.4+l*beat);pad(m,t,l*beat*.92,.075,out,1500);});}
 for(const [b,bass,upper,l] of CHORDS){const t=t0+b*beat;
  if(mode==='box'){at(t,()=>tine(bass+24,t,.06,out,2.4));for(let k=1;k<Math.min(3,l);k++)at(t+k*beat,()=>upper.forEach(u=>tine(u+12,t+k*beat,.03,out,1.2)));if(l>3)at(t+3*beat,()=>upper.forEach(u=>tine(u+12,t+3*beat,.03,out,1.2)));}
  else{at(t,()=>{pad(bass,t,l*beat,.09,out,420);upper.forEach(u=>pad(u,t,l*beat,.035,out,900));});for(let k=1;k<l;k++)at(t+k*beat,()=>upper.forEach(u=>tine(u+12,t+k*beat,.025,out,1)));}}
 // The full version ends on a little rising sparkle.
 if(mode==='full')[72,76,79,84,88,91,96].forEach((m,i)=>{const t=t0+(SONG_BEATS-1)*beat+i*.07;at(t,()=>tine(m,t,.05,out,1.8));});
 notes.sort((x,y)=>x.at-y.at);return {notes,length:SONG_BEATS*beat};}
function playBirthday(mode:'box'|'full'|null){
 // Only a change of what the evening asks for does anything (apply() runs for many reasons).
 if(!context||!master||mode===wanted)return;const ctx=context;wanted=mode;
 const stop=(t:NonNullable<typeof tune>,fade:number)=>{if(t.timer)clearInterval(t.timer);t.out.gain.setTargetAtTime(0,ctx.currentTime,fade);setTimeout(()=>t.out.disconnect(),4000);};
 if(!mode){if(tune){stop(tune,.6);tune=null;}return;}
 if(tune&&mode==='box')return;
 // Starting, or going from the box to the full version: a fresh voice, the old one fades.
 if(tune)stop(tune,.25);
 const out=ctx.createGain();out.gain.value=0;out.gain.setTargetAtTime(1,ctx.currentTime,mode==='box'?1.2:.1);out.connect(master);const r=hall();if(r)out.connect(r);
 const current:NonNullable<typeof tune>={mode,out,timer:null,queue:[],passEnd:0};tune=current;
 const queuePass=(m:'box'|'full',t0:number)=>{const p=plan(m,out,t0);current.queue=p.notes;current.passEnd=t0+p.length;current.mode=m;};
 queuePass(mode,ctx.currentTime+(mode==='box'?.4:.15));
 // A look-ahead scheduler: every 150 ms the notes of the next 0.7 s go to the audio clock, so no single frame has to
 // build a whole song's worth of oscillators. Notes that fell behind (a hidden tab) are skipped, never bunched.
 current.timer=setInterval(()=>{if(tune!==current)return;const now=ctx.currentTime,horizon=now+.7;
  while(current.queue.length&&current.queue[0].at<horizon){const n=current.queue.shift()!;if(n.at>now-.05)n.play();}
  // After the full version, the quiet box carries on until she leaves the table.
  if(!current.queue.length&&now>current.passEnd-.8){const wasFull=current.mode==='full';if(wasFull)out.gain.setTargetAtTime(.75,now,1);queuePass('box',Math.max(current.passEnd+(wasFull?1.6:1.2),now+.3));}},150);}
export function resetMusic(){arrivalArmed=false;endingArmed=false;playBirthday(null);finished.clear();for(const k of Object.keys(positions))delete positions[k as TrackId];apply();}
export const chime=()=>{tone(783.99,0,.7,.04);tone(1046.5,.12,1,.03);};
export const kitchen=()=>{tone(220,0,.08,.08,'triangle');tone(180,.2,.08,.06,'triangle');tone(880,1.2,.9,.06);};
export const paperSound=()=>tone(1900,0,.05,.015,'triangle');
export const shutterSound=()=>{tone(420,0,.04,.07,'square');tone(220,.05,.045,.04,'triangle');};
function noise(length:number,filter:BiquadFilterType,frequency:number,volume:number,decay=9,delay=0){if(!context||!master)return;const buffer=context.createBuffer(1,Math.round(context.sampleRate*length),context.sampleRate),d=buffer.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.exp(-i/d.length*decay);
 const src=context.createBufferSource(),f=context.createBiquadFilter(),g=context.createGain();src.buffer=buffer;f.type=filter;f.frequency.value=frequency;g.gain.value=volume;src.connect(f).connect(g).connect(master);src.start(context.currentTime+delay);src.onended=()=>{src.disconnect();f.disconnect();g.disconnect();};}
/** A distant firework: a soft thump and a crackle. */
export const pop=(pitch=1)=>{noise(.6,'lowpass',700*pitch,.09,7);tone(80*pitch,0,.4,.05,'sine');noise(.5,'highpass',3200,.012,5,.18);};
/** Breath over the candles. */
export const whoosh=()=>noise(.7,'bandpass',900,.12,4);
/** A match catching. */
export const strike=()=>{noise(.18,'highpass',2400,.05,10);tone(660,.05,.5,.02,'sine');};
/** Water, leaves, a small bell: the island answers a touch. */
export const plop=()=>{if(!context||!master)return;const at=context.currentTime,o=context.createOscillator(),g=context.createGain();o.frequency.setValueAtTime(900,at);o.frequency.exponentialRampToValueAtTime(240,at+.12);g.gain.setValueAtTime(.05,at);g.gain.exponentialRampToValueAtTime(.0001,at+.18);o.connect(g).connect(master);o.start(at);o.stop(at+.2);o.onended=()=>{o.disconnect();g.disconnect();};noise(.25,'lowpass',1200,.025,8);};
export const rustle=()=>noise(.45,'bandpass',3200,.05,3);
export const bell=()=>{tone(1568,0,1.1,.03);tone(2093,.0,1.0,.018);tone(1568,.18,.9,.022);tone(2093,.18,.8,.012);};
export const knock=()=>{tone(180,0,.08,.05,'triangle');tone(240,.11,.07,.04,'triangle');};
export const horn=()=>{tone(147,0,.9,.035,'sawtooth');tone(220,0,.9,.02,'sine');};
/** A wave running up the sand and sliding back. */
export const wave=()=>{noise(3.4,'lowpass',520,.18,1.6);noise(2.2,'highpass',2600,.025,2.5,1.5);};
/** Gulls: two falling cries. */
export const gullCall=()=>{chirp(1900,1150,0,.28,.012);chirp(1750,1050,.32,.3,.01);chirp(1800,1100,.7,.22,.008);};
/** Far-off thunder over the sea. */
export const thunder=()=>{noise(2.8,'lowpass',160,.24,2.2);noise(1.4,'lowpass',420,.07,4,.15);};
/** A very small sneeze. */
export const sneeze=()=>{noise(.1,'bandpass',2400,.05,5);noise(.16,'highpass',3600,.035,7,.14);tone(1250,.14,.08,.012,'triangle');};
export const sparkleSound=()=>{[0,1,2].forEach(i=>tone(1800+i*420,i*.06,.35,.012));};
