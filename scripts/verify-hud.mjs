import {chromium} from 'playwright';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
const out='output/web-hud-v101';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),errors=[],records=[];let page;
const tap=name=>page.getByRole('button',{name,exact:true}).click();
async function check(label,{shot=false}={}){
 await page.waitForTimeout(220);
 const result=await page.evaluate(()=>{
  const visible=el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(el).visibility!=='hidden'&&getComputedStyle(el).display!=='none'&&el.getAttribute('aria-hidden')!=='true'};
  const rect=el=>{const r=el.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,name:el.className}};
  const regions=[...document.querySelectorAll('.topbar,.scene-navigation>.place-heading,.scene-navigation>.countdown,.scene-dock>*:not(.birthday-title)')].filter(visible).map(rect),collisions=[];
  for(let i=0;i<regions.length;i++)for(let j=i+1;j<regions.length;j++){const a=regions[i],b=regions[j];if(Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)>1&&Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)>1)collisions.push([a.name,b.name]);}
  const unreachable=[],outside=[];const bottom=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--mt-safe-bottom'))||0;
  for(const el of [...document.querySelectorAll('.topbar button,.scene-navigation button,.scene-actions button,.scene-whisper,.rainbow-overview button')].filter(visible)){
   const r=el.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2,hit=document.elementFromPoint(x,y),name=el.getAttribute('aria-label')||el.textContent;
   if(r.x<0||r.right>innerWidth+.5||r.y<0||r.bottom>innerHeight-bottom+.5)outside.push(name);
   if(!hit||!el.contains(hit))unreachable.push(name);
  }
  return{regions,collisions,unreachable,outside,horizontalOverflow:document.documentElement.scrollWidth>innerWidth};
 });
 records.push({label,...result});
 assert.deepEqual(result.collisions,[],label+' overlapping HUD');assert.deepEqual(result.unreachable,[],label+' covered controls');assert.deepEqual(result.outside,[],label+' unsafe controls');assert.equal(result.horizontalOverflow,false,label+' overflow');
 if(shot)await page.screenshot({path:`${out}/${label}.png`});
}
try{
 for(const [port,edition] of [[5196,'public'],[5197,'private']])for(const [width,height] of [[390,844],[844,390],[1440,960]]){
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,isMobile:width<900,hasTouch:width<900});page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${port}/?perf`);await tap('让海风带路');await page.waitForFunction(()=>window.__island);await page.evaluate(()=>{const s=window.__island.store.getState();s.finishIntro();s.setting('muted',true)});await page.waitForTimeout(700);
  const prefix=`${edition}-${width}x${height}`;await check(prefix+'-overview',{shot:true});
  if(edition==='private'){await tap('去岛上走走');await page.getByRole('button',{name:'向前走'}).waitFor();await tap('退出步行');}
  for(const place of ['home','cloud','sunset','diner','sunrise']){await page.evaluate(place=>window.__island.store.getState().travel(place),place);await page.waitForTimeout(800);await check(prefix+'-'+place,{shot:true});
   if(place==='home'){if(await page.getByRole('button',{name:'更多操作',exact:true}).isVisible())await tap('更多操作');await check(prefix+'-home-more');await tap('照片墙');await page.getByAltText('一张照片',{exact:true}).waitFor();await tap('轻轻放回去');}
   if(place==='cloud'){await tap('进图书馆坐坐');await check(prefix+'-library-inside');await tap('窗边有一本《绿光》');await tap('轻轻放回去');}
   if(place==='diner'){await page.locator('.scene-actions').getByRole('button',{name:'今日菜单',exact:true}).click();await page.getByRole('button',{name:/^椰子鸡/}).click();await page.waitForTimeout(2800);await check(prefix+'-diner-close');await tap('看看食堂');await tap('看看餐桌');await tap('拿起相机');await tap('按下快门');await page.getByRole('dialog',{name:'照片已收进手账'}).waitFor();await tap('收起相机');}
  }
  await context.close();
 }
 assert.deepEqual(errors,[]);await fs.writeFile(`${out}/results.json`,JSON.stringify({status:'PASS',checks:records,errors},null,2));await fs.rm(`${out}/failure.json`,{force:true});await fs.rm(`${out}/failure.png`,{force:true});console.log('PASS',records.length,'web HUD checks');
}catch(e){if(page)await page.screenshot({path:`${out}/failure.png`}).catch(()=>{});await fs.writeFile(`${out}/failure.json`,JSON.stringify({error:String(e),errors,last:records.slice(-3)},null,2));throw e}finally{await browser.close()}
