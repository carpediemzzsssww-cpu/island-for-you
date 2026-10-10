import {Suspense,useEffect,useMemo,useState} from 'react';
import {Canvas,useThree} from '@react-three/fiber';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import {ContactShadows,OrbitControls} from '@react-three/drei';
import * as THREE from 'three';
import {ArrowRight,Check,Minus,RotateCcw,X} from 'lucide-react';
import {useIsland} from '../store';
import {flowers,papers,ribbons} from '../content';
import {arrange} from './geometry';
import {GrowingStem,Wrapping,stemsOf} from './Bouquet';
import {chime,paperSound,rustle} from '../lib/audio';

// The florist's table: pick stems one at a time and watch them settle into the bouquet; choose the paper and
// the ribbon; turn it around by dragging. The finished bouquet goes home to the vase and to the birthday table.
// While this table is open the island itself stops rendering (see `studio` in the store).

const MAX=12,PER_KIND=4;
/** A soft room to reflect: sheen on the petals and satin on the ribbon need something around them. */
function Room(){const {gl,scene}=useThree();useEffect(()=>{const pm=new THREE.PMREMGenerator(gl);const env=pm.fromScene(new RoomEnvironment(),.04).texture;pm.dispose();scene.environment=env;scene.environmentIntensity=.5;return()=>{scene.environment=null;env.dispose();};},[gl,scene]);return null;}
function Table({stems,paper,ribbon,tied}:{stems:string[];paper:string;ribbon:string;tied:boolean}){
 const places=useMemo(()=>arrange(stems),[stems.join(',')]);
 return <>
  <Room/>
  <hemisphereLight args={['#fff6ea','#d9c3a7',.95]}/>
  <directionalLight position={[.6,1.2,.9]} intensity={2.1} color="#fff1dc" castShadow shadow-mapSize={[1024,1024]} shadow-camera-left={-.5} shadow-camera-right={.5} shadow-camera-top={.5} shadow-camera-bottom={-.5}/>
  <directionalLight position={[-.8,.5,-.6]} intensity={.8} color="#e3ecff"/>
  <group position={[0,-.02,0]}>
   {places.map((p,i)=><GrowingStem key={`${i}-${p.type}`} place={p}/>)}
   <Wrapping paper={paper} ribbon={ribbon} open={tied?1:1.04}/>
  </group>
  <ContactShadows position={[0,-.23,0]} opacity={.35} scale={1.1} blur={2.6} far={.6}/>
  <OrbitControls enablePan={false} enableZoom minDistance={.55} maxDistance={1.75} zoomSpeed={.6} enableDamping dampingFactor={.08} minPolarAngle={.75} maxPolarAngle={1.72} autoRotate autoRotateSpeed={.6} target={[0,.1,0]}/>
 </>;
}
export default function Studio(){
 const s=useIsland();const saved=s.save.home.bouquet;
 const [stems,setStems]=useState<string[]>(()=>stemsOf(saved).slice(0,MAX));const [paper,setPaper]=useState(saved?.paper??'kraft');const [ribbon,setRibbon]=useState(saved?.ribbon??'pink');
 const [step,setStep]=useState<0|1|2>(0);const [done,setDone]=useState(false);const [note,setNote]=useState('先选一枝花。郁金香在最前面。');
 useEffect(()=>{s.setStudio(true);return()=>s.setStudio(false);},[]);
 const count=(id:string)=>stems.filter(t=>t===id).length;
 const add=(id:string)=>{const f=flowers.find(f=>f.id===id)!;if(stems.length>=MAX){setNote('花束已经很满了，换一枝试试？');return;}if(count(id)>=PER_KIND){setNote(`${f.name}已经有${PER_KIND}枝了。`);return;}setStems([...stems,id]);setDone(false);setNote(f.note);rustle();};
 const remove=(id:string)=>{const i=stems.lastIndexOf(id);if(i<0)return;setStems(stems.filter((_,k)=>k!==i));setDone(false);paperSound();};
 const tie=()=>{if(stems.length<3)return;s.dispatch({type:'bouquet',bouquet:{flowers:[...new Set(stems)],stems,paper,ribbon}});setDone(true);chime();};
 return <section className="studio" role="dialog" aria-label="花店的工作台">
  <div className="studio-stage"><Canvas shadows camera={{position:[0,.24,1.28],fov:31}} dpr={[1,Math.min(2,devicePixelRatio)]} gl={{antialias:true,alpha:true}} onCreated={({gl})=>{gl.toneMapping=THREE.NeutralToneMapping;}}>
   <Suspense fallback={null}><Table stems={stems} paper={paper} ribbon={ribbon} tied={done}/></Suspense></Canvas>
   <p className="studio-hint">拖动转着看 · 滚轮或双指凑近看</p>
   {stems.length>0&&<div className="studio-count">{stems.length} 枝{stems.length<3?` · 至少 3 枝`:''}</div>}
  </div>
  <div className="studio-panel">
   <button className="artifact-close" aria-label="轻轻放回去" onClick={()=>{paperSound();s.open(null);}}><X size={18}/></button>
   <h2>今天，花送给你。</h2>
   <div className="studio-steps" role="tablist">{['选花','包装纸','丝带'].map((n,i)=><button key={n} role="tab" aria-selected={step===i} className={step===i?'on':''} onClick={()=>setStep(i as 0|1|2)}>{i+1}. {n}</button>)}</div>
   {step===0?<><p className="studio-note" aria-live="polite">{note}</p>
    <div className="studio-flowers">{flowers.map(f=>{const n=count(f.id);return <div key={f.id} className={`studio-flower ${n?'picked':''}`}>
     <button className="add" onClick={()=>add(f.id)} aria-label={`加一枝${f.name}`}><i style={{background:f.color}}/><span>{f.name}</span>{n>0&&<b>{n}</b>}</button>
     {n>0&&<button className="minus" onClick={()=>remove(f.id)} aria-label={`拿掉一枝${f.name}`}><Minus size={12}/></button>}</div>;})}</div>
    <div className="studio-row"><button className="quiet-link" disabled={!stems.length} onClick={()=>{setStems([]);setDone(false);setNote('重新开始，慢慢选。');}}><RotateCcw size={14}/> 全部拿掉</button><button className="ink-button" disabled={stems.length<3} onClick={()=>setStep(1)}>选包装纸 <ArrowRight size={16}/></button></div></>
   :step===1?<><p className="studio-note">包装纸决定了花束的样子。</p><div className="studio-swatches">{papers.map(p=><button key={p.id} className={p.id===paper?'on':''} onClick={()=>{setPaper(p.id);setDone(false);paperSound();}}><i style={{background:p.color}}/>{p.name}</button>)}</div>
    <div className="studio-row"><button className="quiet-link" onClick={()=>setStep(0)}>回去加花</button><button className="ink-button" onClick={()=>setStep(2)}>系一条丝带 <ArrowRight size={16}/></button></div></>
   :<><p className="studio-note">最后，系一条丝带。</p><div className="studio-swatches">{ribbons.map(r=><button key={r.id} className={r.id===ribbon?'on':''} onClick={()=>{setRibbon(r.id);setDone(false);paperSound();}}><i style={{background:r.color}}/>{r.name}</button>)}</div>
    {/* One next step at a time: tie it, then take it home (it waits in the vase there). */}
    {done?<div className="studio-row"><button className="quiet-link" onClick={()=>{setStems([]);setDone(false);setStep(0);setNote('重新开始，慢慢选。');}}><RotateCcw size={14}/> 再包一束</button><button className="ink-button" onClick={()=>s.travel('home')}>带回家 <ArrowRight size={16}/></button></div>
    :<div className="studio-row"><button className="quiet-link" onClick={()=>setStep(1)}>换张纸</button><button className="ink-button" disabled={stems.length<3} onClick={tie}>系好丝带 <Check size={16}/></button></div>}</>}
  </div>
 </section>;
}
