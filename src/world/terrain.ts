// Ground shapes shared with scripts/build_island.py (keep in step with it): the coastline wobble, the sunrise hill
// profile and the hill trail, so scripted cameras can walk on the real ground.
export const TOP=1.10;
export const wob=(a:number)=>1+.065*Math.sin(a*3+.5)+.045*Math.cos(a*5)+.025*Math.sin(a*9);
const HILL:[number,number][]=[[1.0,TOP-.03],[.96,1.36],[.9,1.76],[.84,2.06],[.78,2.25]];
export function hillHeight(x:number,z:number,cx=0,cz=-8,rx=4.1,rz=3.0){
 const a=Math.atan2((z-cz)/rz,(x-cx)/rx);const r=Math.hypot((x-cx)/rx,(z-cz)/rz)/wob(a);
 if(r>=1)return TOP;
 for(let i=0;i<HILL.length-1;i++){const [f0,y0]=HILL[i],[f1,y1]=HILL[i+1];if(r>=f1)return y0+(y1-y0)*(f0-r)/(f0-f1);}
 return HILL[HILL.length-1][1];
}
/** The hill trail (ROADS in build_island.py), from the park lane up to the lighthouse door. */
export const TRAIL:[number,number][]=[[-3.0,-5.05],[-2.3,-5.7],[-.8,-5.75],[1.3,-6.45],[.7,-7.35],[0,-7.75]];
