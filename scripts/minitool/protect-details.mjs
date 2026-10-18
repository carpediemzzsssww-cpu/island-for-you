/** Find connected physical pieces across colour seams. Long, narrow pieces
 * (poles, chair legs, railings, ropes) must survive regional simplification. */
export function protectDetails(positions, indices) {
 const n=positions.length/3,parent=Array.from({length:n},(_,i)=>i);
 const find=i=>parent[i]===i?i:(parent[i]=find(parent[i]));
 const join=(a,b)=>{parent[find(a)]=find(b)};
 const spatial=new Map();
 for(let i=0;i<n;i++){const key=positions.slice(i*3,i*3+3).join(',');if(spatial.has(key))join(i,spatial.get(key));else spatial.set(key,i);}
 for(let i=0;i<indices.length;i+=3){join(indices[i],indices[i+1]);join(indices[i],indices[i+2]);}
 const parts=new Map();
 for(let i=0;i<n;i++){const key=find(i);if(!parts.has(key))parts.set(key,[]);parts.get(key).push(i);}
 const locks=new Uint8Array(n);let protectedParts=0;
 for(const ids of parts.values()){
  const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
  for(const i of ids)for(let a=0;a<3;a++){lo[a]=Math.min(lo[a],positions[i*3+a]);hi[a]=Math.max(hi[a],positions[i*3+a]);}
  const dims=hi.map((v,a)=>v-lo[a]).sort((a,b)=>a-b);
  // Also catch diagonal rods: an axis-aligned box makes a sloping rope look wide.
  const farthest=from=>ids.reduce((best,i)=>{const distance=[0,1,2].reduce((sum,a)=>sum+(positions[i*3+a]-positions[from*3+a])**2,0);return distance>best.d?{i,d:distance}:best;},{i:from,d:0});
  const a=farthest(ids[0]).i,b=farthest(a),axis=[0,1,2].map(k=>positions[b.i*3+k]-positions[a*3+k]);
  let radial=0;
  if(b.d>0)for(const i of ids){const v=[0,1,2].map(k=>positions[i*3+k]-positions[a*3+k]),dot=v.reduce((sum,x,k)=>sum+x*axis[k],0)/b.d;radial=Math.max(radial,Math.sqrt(v.reduce((sum,x,k)=>sum+(x-dot*axis[k])**2,0)));}
  if(dims[1]<.12&&dims[2]>.12&&dims[2]>dims[1]*3||radial<.07&&b.d>.08**2&&Math.sqrt(b.d)>radial*4){ids.forEach(i=>locks[i]=1);protectedParts++;}
 }
 return {locks,protectedParts};
}
