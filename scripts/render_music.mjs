// The island's songs: music-box arrangements of public-domain melodies, synthesized here sample by sample (a comb
// tine with a bright attack and a long ring, a soft pad, a round bass and a small hall), then normalised and encoded
// by ffmpeg. No recordings are involved, so every file in public/music can be shared with the code.
//   node scripts/render_music.mjs            (needs ffmpeg with libmp3lame)
import {writeFileSync,mkdirSync,mkdtempSync,rmSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

const ROOT=join(dirname(fileURLToPath(import.meta.url)),'..');
const SR=44100;
const NAMES={C:0,D:2,E:4,F:5,G:7,A:9,B:11};
/** 'C5', 'F#4', 'Bb3' -> MIDI number (C4 = 60). */
const midi=n=>{const m=/^([A-G])([#b]?)(-?\d)$/.exec(n);if(!m)throw Error(`Bad note ${n}`);return 12*(+m[3]+1)+NAMES[m[1]]+(m[2]==='#'?1:m[2]==='b'?-1:0);};
const hz=m=>440*2**((m-69)/12);
/** A melody written as 'note:beats' words ('r' rests): 'E5:1 E5:1 F5:1 G5:1'. */
function line(text,from=0){let t=from;const notes=[];for(const w of text.trim().split(/\s+/)){const [n,b]=w.split(':');const len=+(b??1);if(n!=='r')notes.push({m:midi(n),at:t,len});t+=len;}return {notes,end:t};}
/** Chords written as 'beats:bass:tone,tone,...' words: '3:C3:E4,G4'. */
function chords(text,from=0){let t=from;const out=[];for(const w of text.trim().split(/\s+/)){const [b,bass,tones]=w.split(':');out.push({at:t,len:+b,bass:midi(bass),tones:tones.split(',').map(midi)});t+=+b;}return out;}

// ---- Instruments --------------------------------------------------------------------------------------------
let L,R;
const put=(i,v,pan)=>{if(i<0||i>=L.length)return;L[i]+=v*(1-pan)*.5*2**.5;R[i]+=v*(1+pan)*.5*2**.5;};
/** A music-box tine: the fundamental rings long; the octave and an inharmonic partial give the metallic attack. */
function tine(m,t,vel,pan=0){const f=hz(m),tau=Math.min(2.4,Math.max(.7,1.7*(523/f)**.45)),n=Math.round(Math.min(5*tau,7)*SR),i0=Math.round(t*SR);
 const parts=[[1,1,tau],[2,.22,tau*.3],[3,.06,tau*.18],[5.4,.07,.11],[8.9,.025,.05]],detune=1+(Math.random()-.5)*.0012;
 for(let k=0;k<n;k++){const s=k/SR,a=Math.min(1,k/(.003*SR));let v=0;for(const [r,amp,d] of parts){if(s>d*7)continue;v+=amp*Math.exp(-s/d)*Math.sin(2*Math.PI*f*r*detune*s);}put(i0+k,v*a*vel,pan);}}
/** A soft pad: two slightly detuned voices with a few harmonics, slow in and slow out. */
function pad(m,t,len,vel){const f=hz(m),i0=Math.round(t*SR),n=Math.round((len+1.2)*SR),att=.35,rel=1.1;
 for(let k=0;k<n;k++){const s=k/SR;const e=s<att?s/att:s<len?1:Math.max(0,1-(s-len)/rel);if(e<=0)continue;let v=0;
  for(const [c,p] of [[-5,-.6],[5,.6]]){const g=f*2**(c/1200);const w=Math.sin(2*Math.PI*g*s)+.3*Math.sin(4*Math.PI*g*s)+.1*Math.sin(6*Math.PI*g*s);put(i0+k,w*e*e*vel*.5,p);}}}
/** A round, plucked bass. */
function bass(m,t,len,vel){const f=hz(m),i0=Math.round(t*SR),n=Math.round(Math.min(len+.4,3.5)*SR);
 for(let k=0;k<n;k++){const s=k/SR,a=Math.min(1,k/(.012*SR)),e=Math.exp(-s/1.3)*(s>len?Math.max(0,1-(s-len)/.4):1);put(i0+k,(Math.sin(2*Math.PI*f*s)+.18*Math.sin(4*Math.PI*f*s))*a*e*vel,0);}}

// ---- A small hall (Freeverb) ----------------------------------------------------------------------------------
function reverb(wet=.28){const combs=[1116,1188,1277,1356,1422,1491,1557,1617],alls=[556,441,341,225];
 for(const [buf,spread] of [[L,0],[R,23]]){const cs=combs.map(n=>({b:new Float32Array(n+spread),i:0,z:0})),as=alls.map(n=>({b:new Float32Array(n+spread),i:0}));const out=new Float32Array(buf.length);
  for(let k=0;k<buf.length;k++){const x=buf[k]*.015;let y=0;for(const c of cs){const o=c.b[c.i];c.z=o*.75+c.z*.25;c.b[c.i]=x+c.z*.86;if(++c.i>=c.b.length)c.i=0;y+=o;}
   for(const a of as){const b=a.b[a.i];const o=-y+b;a.b[a.i]=y+b*.5;if(++a.i>=a.b.length)a.i=0;y=o;}out[k]=y;}
  for(let k=0;k<buf.length;k++)buf[k]=buf[k]*(1-wet*.5)+out[k]*wet*3;}}

// ---- Arrangements ---------------------------------------------------------------------------------------------
/** Two passes: first the music box alone (with low tines on the chords), then again with a broken-chord
 *  accompaniment, a pad and a bass; a last chord rings out. */
function arrange({bpm,melody,harmony,passes=2,pickup=0,arpeggio=true}){
 const beat=60/bpm,{notes,end}=line(melody),ch=chords(harmony,pickup),total=end;let t0=.6;
 for(let p=0;p<passes;p++){const full=p>0;
  for(const n of notes)tine(n.m+(full&&p===passes-1&&passes>2?12:0),t0+n.at*beat,full?.34:.42,Math.max(-.5,Math.min(.5,(n.m-74)/24)));
  for(const c of ch){const at=t0+c.at*beat,len=c.len*beat;
   if(!full){tine(c.bass+12,at,.2,-.25);continue;}
   bass(c.bass,at,len,.22);for(const m of c.tones)pad(m,at,len,.035);
   if(arpeggio){const steps=Math.round(c.len*2);for(let k=0;k<steps;k++){const m=[c.bass+12,...c.tones][k%(c.tones.length+1)];tine(m,at+k*beat/2,.12,-.3);}}}
  t0+=total*beat+(p<passes-1?beat:0);}
 // Final chord.
 const last=ch[ch.length-1];tine(last.bass,t0+.1,.25,-.2);for(const m of last.tones)tine(m+12,t0+.1+.06*last.tones.indexOf(m),.18,.2);pad(last.tones[0],t0,2.5,.03);
 return t0+6;}

/** Bach's Prelude in C (BWV 846, bars 1-11): each bar is one chord broken in the same figure, twice. */
function prelude(){const bpm=64,beat=60/bpm,bars=[['C4','E4','G4','C5','E5'],['C4','D4','A4','D5','F5'],['B3','D4','G4','D5','F5'],['C4','E4','G4','C5','E5'],['C4','E4','A4','E5','A5'],['C4','D4','F#4','A4','D5'],['B3','D4','G4','D5','G5'],['B3','C4','E4','G4','C5'],['A3','C4','E4','G4','C5'],['D3','A3','D4','F#4','C5'],['G3','B3','D4','G4','B4']].map(b=>b.map(midi));
 let t0=.6;for(let p=0;p<2;p++){for(const b of bars){for(let h=0;h<2;h++){const at=t0+h*2*beat;const fig=[b[0],b[1],b[2],b[3],b[4],b[2],b[3],b[4]];fig.forEach((m,k)=>tine(m+12,at+k*beat/4,k<2?.3:.36,(m-70)/30));}
   if(p>0){bass(b[0]-12,t0,4*beat,.2);pad(b[1],t0,4*beat,.03);pad(b[4],t0,4*beat,.02);}t0+=4*beat;}}
 for(const [k,m] of ['C3','G3','C4','E4','G4','C5'].map(midi).entries())tine(m+12,t0+.1+k*.09,.26,(m-66)/30);pad(midi('C4'),t0,3,.03);bass(midi('C2'),t0,3,.22);return t0+7;}

const SONGS={
 // Minuet in G (Petzold, from the Notebook for Anna Magdalena Bach), first part, repeated.
 'minuet-in-g':()=>arrange({bpm:108,passes:2,
  melody:'D5:1 G4:.5 A4:.5 B4:.5 C5:.5 D5:1 G4:1 G4:1 E5:1 C5:.5 D5:.5 E5:.5 F#5:.5 G5:1 G4:1 G4:1 C5:1 D5:.5 C5:.5 B4:.5 A4:.5 B4:1 C5:.5 B4:.5 A4:.5 G4:.5 F#4:1 G4:.5 A4:.5 B4:.5 G4:.5 A4:3 '+
   'D5:1 G4:.5 A4:.5 B4:.5 C5:.5 D5:1 G4:1 G4:1 E5:1 C5:.5 D5:.5 E5:.5 F#5:.5 G5:1 G4:1 G4:1 C5:1 D5:.5 C5:.5 B4:.5 A4:.5 B4:1 C5:.5 B4:.5 A4:.5 G4:.5 A4:1 B4:.5 A4:.5 G4:.5 F#4:.5 G4:3',
  harmony:'3:G2:B3,D4 3:G2:B3,D4 3:C3:E4,G4 3:G2:B3,D4 3:C3:E4,A4 3:G2:B3,D4 3:D3:F#4,A4 3:D3:F#4,C5 '+
   '3:G2:B3,D4 3:G2:B3,D4 3:C3:E4,G4 3:G2:B3,D4 3:C3:E4,A4 3:G2:B3,D4 3:D3:F#4,C5 3:G2:B3,D4'}),
 // Twinkle, Twinkle, Little Star (the French "Ah ! vous dirai-je, maman").
 'twinkle':()=>arrange({bpm:100,passes:3,
  melody:'C5 C5 G5 G5 A5 A5 G5:2 F5 F5 E5 E5 D5 D5 C5:2 G5 G5 F5 F5 E5 E5 D5:2 G5 G5 F5 F5 E5 E5 D5:2 C5 C5 G5 G5 A5 A5 G5:2 F5 F5 E5 E5 D5 D5 C5:2',
  harmony:'2:C3:E4,G4 2:C3:E4,G4 2:F3:A4,C5 2:C3:E4,G4 2:F3:A4,C5 2:C3:E4,G4 2:G2:B3,D4 2:C3:E4,G4 '+
   '2:C3:E4,G4 2:G2:B3,F4 2:C3:E4,G4 2:G2:B3,D4 2:C3:E4,G4 2:G2:B3,F4 2:C3:E4,G4 2:G2:B3,D4 '+
   '2:C3:E4,G4 2:C3:E4,G4 2:F3:A4,C5 2:C3:E4,G4 2:F3:A4,C5 2:C3:E4,G4 2:G2:B3,D4 2:C3:E4,G4'}),
 // Ode to Joy (Beethoven, Symphony No. 9), slow, for the dawn.
 'ode-to-joy':()=>arrange({bpm:76,passes:2,
  melody:'E5 E5 F5 G5 G5 F5 E5 D5 C5 C5 D5 E5 E5:1.5 D5:.5 D5:2 E5 E5 F5 G5 G5 F5 E5 D5 C5 C5 D5 E5 D5:1.5 C5:.5 C5:2 '+
   'D5 D5 E5 C5 D5 E5:.5 F5:.5 E5 C5 D5 E5:.5 F5:.5 E5 D5 C5 D5 G4:2 E5 E5 F5 G5 G5 F5 E5 D5 C5 C5 D5 E5 D5:1.5 C5:.5 C5:2',
  harmony:'4:C3:E4,G4 4:G2:B3,D4 4:C3:E4,G4 2:G2:B3,D4 2:G2:B3,F4 4:C3:E4,G4 4:G2:B3,D4 4:C3:E4,G4 2:G2:B3,F4 2:C3:E4,G4 '+
   '4:G2:B3,D4 2:G2:B3,D4 2:C3:E4,G4 2:G2:B3,D4 2:C3:E4,G4 2:A2:C4,E4 2:G2:B3,D4 4:C3:E4,G4 4:G2:B3,D4 4:C3:E4,G4 2:G2:B3,F4 2:C3:E4,G4'}),
 // Auld Lang Syne (Scottish traditional): "should auld acquaintance be forgot".
 'auld-lang-syne':()=>arrange({bpm:72,passes:2,pickup:1,
  melody:'C5:1 F5:1.5 F5:.5 F5:1 A5:1 G5:1.5 F5:.5 G5:1 A5:1 F5:1.5 F5:.5 A5:1 C6:1 D6:3 D6:1 C6:1.5 A5:.5 A5:1 F5:1 G5:1.5 F5:.5 G5:1 A5:1 F5:1.5 D5:.5 D5:1 C5:1 F5:3',
  harmony:'4:F2:A3,C4 4:C3:E4,Bb4 4:F2:A3,C4 4:Bb2:D4,F4 4:F2:A3,C4 4:C3:E4,Bb4 2:D3:F4,A4 2:C3:E4,Bb4 3:F2:A3,C4'}),
 'prelude-in-c':prelude,
};

const tmp=mkdtempSync(join(tmpdir(),'island-music-'));mkdirSync(join(ROOT,'public/music'),{recursive:true});
try{
 for(const [name,make] of Object.entries(SONGS)){
  L=new Float32Array(SR*200);R=new Float32Array(SR*200);const seconds=make();L=L.subarray(0,Math.ceil(seconds*SR));R=R.subarray(0,Math.ceil(seconds*SR));reverb();
  let peak=0;for(let k=0;k<L.length;k++)peak=Math.max(peak,Math.abs(L[k]),Math.abs(R[k]));
  const n=L.length,wav=Buffer.alloc(44+n*4);wav.write('RIFF',0);wav.writeUInt32LE(36+n*4,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(2,22);wav.writeUInt32LE(SR,24);wav.writeUInt32LE(SR*4,28);wav.writeUInt16LE(4,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(n*4,40);
  // Fade the tail so the hall never stops abruptly.
  for(let k=0;k<n;k++){const fade=Math.min(1,(n-k)/(SR*1.5));wav.writeInt16LE(Math.round(Math.max(-1,Math.min(1,L[k]/peak*.9*fade))*32767),44+k*4);wav.writeInt16LE(Math.round(Math.max(-1,Math.min(1,R[k]/peak*.9*fade))*32767),46+k*4);}
  const src=join(tmp,`${name}.wav`),out=join(ROOT,'public/music',`${name}.mp3`);writeFileSync(src,wav);
  execFileSync('ffmpeg',['-v','error','-y','-i',src,'-af','loudnorm=I=-17:TP=-1.5:LRA=11','-ar','44100','-ac','2','-codec:a','libmp3lame','-b:a','112k','-map_metadata','-1',out]);
  console.log(`${name}.mp3: ${seconds.toFixed(1)} s`);}
}finally{rmSync(tmp,{recursive:true,force:true});}
