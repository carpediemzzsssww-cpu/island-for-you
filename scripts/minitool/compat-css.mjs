// Expand the small set of modern declarations used by this project into Chrome 61 fallbacks.
export default function compatCSS(){return {postcssPlugin:'island-mini-css',Once(root){
 root.walkRules(rule=>{if(rule.selector.includes(':has(')){rule.remove();return}rule.selector=rule.selector.replaceAll(':focus-visible',':focus')});
 root.walkDecls(d=>{d.value=d.value.replace(/(\d*\.?\d+)(?:s|d|l)vh/g,'$1vh');
  if(d.prop==='inset'){const v=d.value.split(/\s+/);['top','right','bottom','left'].forEach((p,i)=>d.cloneBefore({prop:p,value:v[i]||v[i%2]||v[0]}));d.remove();return}
  const logical={'margin-inline':['margin-left','margin-right'],'padding-inline':['padding-left','padding-right'],'padding-block':['padding-top','padding-bottom'],'margin-block':['margin-top','margin-bottom']};if(logical[d.prop]){const v=d.value.split(/\s+/);logical[d.prop].forEach((p,i)=>d.cloneBefore({prop:p,value:v[i]||v[0]}));d.remove();return}
  if(/\b(?:clamp|min|max)\(/.test(d.value)){let v=d.value;for(let n=0;n<8;n++){const next=v.replace(/\b(clamp|min|max)\(([^()]*)\)/g,(_,fn,args)=>{const values=args.split(',').map(x=>x.trim());return fn==='clamp'?values[1]:values[0]});if(next===v)break;v=next}if(!/\b(clamp|min|max)\(/.test(v))d.cloneBefore({value:v});else d.cloneBefore({value:/width/.test(d.prop)?'90%':/height/.test(d.prop)?'80vh':'16px'})}
  if(d.prop==='gap')d.cloneBefore({prop:'grid-gap'});
  if(d.value.includes('/fonts/'))d.value=d.value.replace(/url\((['"]?)\/fonts\//g,'url($1../fonts/');
 })}}}
compatCSS.postcss=true;
