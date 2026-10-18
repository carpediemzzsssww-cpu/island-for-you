import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const out='output/minitool-layout-v102';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});const errors=[],records=[];let page;
const tap=(name)=>page.getByRole('button',{name,exact:true}).tap();
const state=async(fn,arg)=>page.evaluate(({code,arg})=>Function('s','arg',code)(window.__island.store.getState(),arg),{code:fn,arg});
async function check(label,{shot=false}={}){
 await page.waitForTimeout(220);
 const result=await page.evaluate(()=>{
  const visible=el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(el).visibility!=='hidden'&&getComputedStyle(el).display!=='none'&&el.getAttribute('aria-hidden')!=='true'};
  const rect=el=>{const r=el.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,name:el.className}};
  const regions=[...document.querySelectorAll('.topbar,.scene-navigation>.place-heading,.scene-navigation>.countdown,.scene-dock>*:not(.birthday-title)')].filter(visible).map(rect),collisions=[];
  for(let i=0;i<regions.length;i++)for(let j=i+1;j<regions.length;j++){const a=regions[i],b=regions[j];if(Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)>1&&Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)>1)collisions.push([a.name,b.name]);}
  const unreachable=[],outside=[];const bottom=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--mt-safe-bottom'))||0;
  for(const el of [...document.querySelectorAll('.topbar button,.scene-navigation button,.scene-actions button,.scene-whisper,.rainbow-overview button,.narrative-card .ink-button')].filter(visible)){
   const r=el.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2,hit=document.elementFromPoint(x,y),name=el.getAttribute('aria-label')||el.textContent;
   if(r.x<0||r.right>innerWidth+.5||r.y<0||r.bottom>document.querySelector('.island-app').getBoundingClientRect().height-bottom+.5)outside.push(name);
   if(!hit||!el.contains(hit))unreachable.push(name);
  }
  return{regions,collisions,unreachable,outside,horizontalOverflow:document.documentElement.scrollWidth>innerWidth};
 });
 records.push({label,...result});
 assert.deepEqual(result.collisions,[],label+' overlapping HUD');assert.deepEqual(result.unreachable,[],label+' covered controls');assert.deepEqual(result.outside,[],label+' unsafe controls');assert.equal(result.horizontalOverflow,false,label+' overflow');
 if(shot)await page.screenshot({path:`${out}/${label}.png`});
}
try{
 for(const [width,height,top,bottom] of [[390,844,47,34],[320,568,20,0],[375,667,20,0],[430,932,59,34],[568,320,0,20],[844,390,0,21]]){
  const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,deviceScaleFactor:2});page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  await page.addInitScript(({top,bottom})=>{document.addEventListener('DOMContentLoaded',()=>{document.documentElement.style.setProperty('--safe-area-inset-top',top+'px');document.documentElement.style.setProperty('--safe-area-inset-bottom',bottom+'px');window.dispatchEvent(new Event('resize'))},{once:true})},{top,bottom});
  await page.goto('http://127.0.0.1:5195/nested/app/?perf');await tap('让海风带路');await page.waitForFunction(()=>window.__island);await state("s.finishIntro();s.setting('muted',true)");await page.waitForTimeout(700);
  assert.equal(await page.evaluate(()=>parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--mt-safe-bottom'))),bottom);assert.equal(await page.evaluate(()=>parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--mt-top'))),Math.max(68,top+44));const prefix=`${width}x${height}`;await check(prefix+'-overview');
  const travel=async(place)=>{await state('s.travel(arg);s.nextRecord()',place);await page.waitForTimeout(400)};
  await travel('home');await check(prefix+'-home');if(await page.getByRole('button',{name:'更多操作',exact:true}).isVisible())await tap('更多操作');await check(prefix+'-home-more');await tap('唱片机');await page.getByRole('dialog').waitFor();await tap('轻轻放回去');
  await travel('cloud');await check(prefix+'-library-outside');await tap('进图书馆坐坐');await state('s.nextRecord()');await page.waitForTimeout(700);await check(prefix+'-library-inside',{shot:true});await tap('窗边有一本《绿光》');await tap('轻轻放回去');await tap('在这里待一会儿');await page.waitForTimeout(600);await check(prefix+'-rain',{shot:true});
  await travel('sunset');await page.waitForTimeout(700);await check(prefix+'-sunset',{shot:true});if(await page.getByRole('button',{name:'更多操作',exact:true}).isVisible())await tap('更多操作');await check(prefix+'-sunset-more');
  if(width===390){
   await page.locator('.countdown.said').filter({hasText:'凡尔纳《绿光》'}).waitFor({timeout:30000});await check(prefix+'-green-attribution',{shot:true});assert.equal(await state('return s.save.secret.greenFlash'),true);
  }
  await travel('sunrise');await check(prefix+'-dawn-start');await tap('沿着山路出发');await check(prefix+'-dawn-path');
  await travel('celebration');await page.getByLabel('想庆祝什么？').fill('今天完成了一件一直想做的小事');await check(prefix+'-celebration',{shot:true});
  if(width===390){await page.getByLabel('想庆祝什么？').focus();await page.evaluate(()=>{Object.defineProperty(window.visualViewport,'height',{configurable:true,value:390});window.visualViewport.dispatchEvent(new Event('resize'))});await check(prefix+'-keyboard',{shot:true});await page.evaluate(()=>{document.activeElement.blur();delete window.visualViewport.height;window.visualViewport.dispatchEvent(new Event('resize'))});}
  await tap('把小岛的灯点亮');await page.getByRole('button',{name:'点上蜡烛',exact:true}).waitFor();await check(prefix+'-candles');
  await travel('diner');await state("s.setTime('afternoon')");await check(prefix+'-diner');
  if(width===390){
   for(const food of ['椰子鸡','椰奶冻','咸蛋黄烧卖','牛奶']){await tap('今日菜单');await page.getByRole('button',{name:new RegExp(food)}).tap();await page.waitForTimeout(2700);}
   await check(prefix+'-all-dishes');await page.waitForTimeout(2000);await page.screenshot({path:`${out}/diner-all-dishes.png`});
   const perf=await page.evaluate(()=>JSON.parse(window.render_game_to_text()));records.push({label:'diner-performance',...perf});assert.ok(perf.triangles<100000);assert.ok(perf.drawCalls<150);
   // Project the soup into the viewport, then deliver a real touch to the food.
   const point=await page.evaluate(()=>{const d=window.__island,p=d.camera.position.clone().set(3.62,1.99,3.98).project(d.camera);return{x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2}});
   await page.touchscreen.tap(point.x,point.y);await page.getByText('热气腾腾，慢一点吃。',{exact:true}).waitFor();await check(prefix+'-food-tap');
   await tap('看看食堂');await tap('看看餐桌');await tap('拿起相机');await tap('按下快门');await page.getByRole('dialog',{name:'照片已收进手账'}).waitFor();await page.screenshot({path:`${out}/diner-photo.png`});await tap('收起相机');
  }
  await context.close();
 }
 assert.deepEqual(errors,[]);await fs.writeFile(`${out}/results.json`,JSON.stringify({status:'PASS',checks:records,errors,scope:'Local Chrome touch emulation + strict offline CSP. Platform simulator and physical devices still pending.'},null,2));await fs.rm(`${out}/failure.json`,{force:true});await fs.rm(`${out}/failure.png`,{force:true});console.log('PASS',records.length,'layout/interaction checks');
}catch(e){if(page)await page.screenshot({path:`${out}/failure.png`}).catch(()=>{});await fs.writeFile(`${out}/failure.json`,JSON.stringify({error:String(e),errors,last:records.slice(-3)},null,2));throw e}finally{await browser.close()}
