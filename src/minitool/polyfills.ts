// Only APIs used by this island. This runs before React and Three are evaluated.
const array=Array.prototype as any;
if(!array.flat)array.flat=function(depth=1):any[]{return depth?this.reduce((a:any[],v:any)=>a.concat(Array.isArray(v)?v.flat(depth-1):v),[]):this.slice()};
if(!array.flatMap)array.flatMap=function(fn:any,that:any){return this.map(fn,that).flat()};
if(!array.at)array.at=function(i:number){return this[i<0?this.length+i:i]};
if(!Object.fromEntries)(Object as any).fromEntries=(pairs:any[])=>{const o:any={};for(const [k,v] of pairs)o[k]=v;return o};
if(!Object.hasOwn)(Object as any).hasOwn=(o:any,k:any)=>Object.prototype.hasOwnProperty.call(o,k);
if(!globalThis.structuredClone)(globalThis as any).structuredClone=(v:any)=>JSON.parse(JSON.stringify(v));
if(!String.prototype.replaceAll)(String.prototype as any).replaceAll=function(a:any,b:any){return a instanceof RegExp?this.replace(a,b):this.split(a).join(b)};
if(!Promise.prototype.finally)(Promise.prototype as any).finally=function(f:any){return this.then((v:any)=>Promise.resolve(f()).then(()=>v),(e:any)=>Promise.resolve(f()).then(()=>{throw e}))};
if(!CanvasRenderingContext2D.prototype.roundRect)CanvasRenderingContext2D.prototype.roundRect=function(x:number,y:number,w:number,h:number,r:any){const rr=Math.min(Array.isArray(r)?r[0]:r,w/2,h/2);this.moveTo(x+rr,y);this.arcTo(x+w,y,x+w,y+h,rr);this.arcTo(x+w,y+h,x,y+h,rr);this.arcTo(x,y+h,x,y,rr);this.arcTo(x,y,x+w,y,rr);this.closePath()};
if(!window.ResizeObserver){class Resize{cb:any;els=new Set<Element>();timer:any;constructor(cb:any){this.cb=cb;this.timer=setInterval(()=>{if(!document.hidden)this.cb(Array.from(this.els).map(target=>({target,contentRect:target.getBoundingClientRect()})))},250)}observe(el:Element){this.els.add(el)}unobserve(el:Element){this.els.delete(el)}disconnect(){this.els.clear();clearInterval(this.timer)}}(window as any).ResizeObserver=Resize}
