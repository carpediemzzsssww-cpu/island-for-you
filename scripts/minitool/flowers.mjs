// Bake the same nine petal models as the florist studio, with a bounded detail
// level for the island. This runs at build time; no WASM or simplifier ships.
import fs from 'node:fs';
import {MeshoptSimplifier as simplify} from 'meshoptimizer';
import {headGeometry,hydrangeaHead,gypsophilaHead} from '../../src/bouquet/geometry.ts';
await simplify.ready;simplify.useExperimentalFeatures=true;
const heads={},report=[];
for(const type of ['tulip','rose','daisy','hydrangea','cosmos','frangipani','bougainvillea','gypsophila','eucalyptus']){
 const g=type==='hydrangea'?hydrangeaHead('#a9bfdc',32):type==='gypsophila'?gypsophilaHead(2):headGeometry(type),p=g.attributes.position.array,c=g.attributes.color.array,n=g.attributes.normal.array;
 const attributes=new Float32Array(p.length*2);
 for(let i=0;i<p.length/3;i++){attributes.set(c.slice(i*3,i*3+3),i*6);attributes.set(n.slice(i*3,i*3+3),i*6+3);}
 const [indices]=simplify.simplifyWithAttributes(new Uint32Array(g.index.array),p,3,attributes,6,[.5,.5,.5,.1,.1,.1],null,Math.min(g.index.count,1600*3),type==='gypsophila'?.018:type==='hydrangea'?.014:.008,['LockBorder']);
 const used=new Map(),data={p:[],c:[],n:[],i:[]};
 for(const i of indices){if(!used.has(i)){used.set(i,data.p.length/3);data.p.push(...p.slice(i*3,i*3+3).map(v=>Math.round(v*100000)));data.c.push(...c.slice(i*3,i*3+3).map(v=>Math.round(v*255)));data.n.push(...n.slice(i*3,i*3+3).map(v=>Math.round(v*32767)));}data.i.push(used.get(i));}
 heads[type]=data;report.push({type,before:g.index.count/3,after:indices.length/3});
}
fs.writeFileSync('public-minitool/flowers.js','window.ISLAND_FLOWERS='+JSON.stringify(heads)+';\n');
fs.writeFileSync('public-minitool/flower-budget.json',JSON.stringify(report,null,2)+'\n');console.table(report);
