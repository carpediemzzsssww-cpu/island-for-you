import {CanvasTexture} from 'three';
let surface:HTMLCanvasElement|null=null,texture:CanvasTexture|null=null;
export function sandSurface(){if(!surface){surface=document.createElement('canvas');surface.width=1000;surface.height=540;texture=new CanvasTexture(surface);}return surface;}
export function sandTexture(){sandSurface();return texture!;}
export function updateSand(){if(texture)texture.needsUpdate=true;}
export function clearSand(){surface?.getContext('2d')?.clearRect(0,0,surface.width,surface.height);updateSand();}
export function washSand(){if(!surface)return;const ctx=surface.getContext('2d')!;ctx.save();ctx.globalCompositeOperation='destination-out';ctx.fillStyle='rgba(0,0,0,.009)';ctx.fillRect(0,0,1000,540);ctx.restore();updateSand();}
