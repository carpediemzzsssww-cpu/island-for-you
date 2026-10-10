import {useEffect,useState} from 'react';
import type {ReactNode} from 'react';
import {X} from 'lucide-react';
import {useIsland} from '../store';
import {getPhoto} from '../lib/photos';
import {paperSound} from '../lib/audio';

// Shared pieces of paper: the frame every opened object sits in, a polaroid, and a print she took herself.

export function Close({label='轻轻放回去'}:{label?:string}){return <button className="artifact-close" onClick={()=>{paperSound();useIsland.getState().open(null);}} aria-label={label}><X size={18}/></button>;}
export function Artifact({children,className='',label}:{children:ReactNode;className?:string;label:string}){return <section className={`artifact ${className}`} role="dialog" aria-modal="false" aria-label={label}><Close/>{children}</section>;}
export function Polaroid({src,caption,className='',onClick}:{src:string;caption:string;className?:string;onClick?:()=>void}){const child=<><img src={src} alt={caption} loading="lazy"/><span>{caption}</span></>;return onClick?<button className={`polaroid ${className}`} onClick={onClick}>{child}</button>:<figure className={`polaroid ${className}`}>{child}</figure>;}
export function ShotImage({id}:{id:string}){const [url,setUrl]=useState<string|null>(null);useEffect(()=>{let disposed=false;let objectUrl:string|null=null;getPhoto(id).then(blob=>{if(blob&&!disposed){objectUrl=URL.createObjectURL(blob);setUrl(objectUrl);}}).catch(()=>{});return()=>{disposed=true;if(objectUrl)URL.revokeObjectURL(objectUrl);};},[id]);return url?<img src={url} alt="你拍下的小岛"/>:<div className="missing-shot">这张照片暂时找不到了</div>;}
/** The eight-spoked asterisk of the brand and the invitation, drawn (as a character, phones show it as an emoji). */
export function Asterisk({size=16,stroke=2.1}:{size?:number;stroke?:number}){return <svg className="asterisk" width={size} height={size} viewBox="-12 -12 24 24" aria-hidden="true"><g stroke="currentColor" strokeWidth={stroke} strokeLinecap="round">{[0,45,90,135].map(a=><line key={a} x1="-9.5" y1="0" x2="9.5" y2="0" transform={`rotate(${a})`}/>)}</g></svg>;}
/** A five-petalled flower pressed into the wax seal. */
export function SealFlower({size=26}:{size?:number}){return <svg width={size} height={size} viewBox="-12 -12 24 24" aria-hidden="true"><g fill="currentColor">{[0,72,144,216,288].map(a=><ellipse key={a} cx="0" cy="-5.6" rx="3.6" ry="5.4" transform={`rotate(${a})`}/>)}</g><circle r="2.6" fill="#f6dfc9" opacity=".75"/></svg>;}
