import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const out='output/refinement';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:960}});const page=await context.newPage();const errors=[];
page.on('pageerror',e=>errors.push(e.message));
const base=process.env.ISLAND_QA_URL||'http://localhost:5174';
const state=()=>page.evaluate(()=>JSON.parse(window.render_game_to_text()));
try{
 await page.goto(base,{waitUntil:'networkidle'});await page.screenshot({path:`${out}/arrival.png`});
 await page.getByRole('button',{name:'让海风带路',exact:true}).click();await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).mode==='island',null,{timeout:15000});await page.waitForTimeout(2600);
 assert.equal(await page.locator('.pin-name').count(),0);assert.equal(await page.locator('.map-markers').innerText(),'');
 await page.mouse.move(20,900);await page.screenshot({path:`${out}/island.png`});
 // Exercise the GLB itself, with semantic overlay hit areas temporarily disabled.
 const style=await page.addStyleTag({content:'.map-markers button{pointer-events:none!important}'});
 for(const [place,point] of [['home',[7,4.75,-4.3]],['flowers',[-4.4,3.2,2.47]],['sunrise',[0,5.4,-8.5]]]){
  const xy=await page.evaluate(p=>{const camera=window.__island.camera;const v=camera.position.clone().set(...p).project(camera);return {x:(v.x*.5+.5)*innerWidth,y:(-.5*v.y+.5)*innerHeight};},point);
  await page.mouse.click(xy.x,xy.y);await page.waitForTimeout(1600);assert.equal((await state()).place,place);
  if(place==='home'){assert.equal((await page.locator('.object-tag').allTextContents()).join(''),'');await page.screenshot({path:`${out}/home.png`});}
  if(place==='flowers')await page.screenshot({path:`${out}/flowers.png`});
  await page.getByRole('button',{name:'返回整座小岛',exact:true}).click();await page.waitForTimeout(1800);
 }
 await style.evaluate(el=>el.remove());
 await page.getByRole('button',{name:/^打开手账/}).click();await page.getByRole('tab',{name:'地图',exact:true}).click();await page.getByRole('button',{name:'无所事事公园',exact:true}).click();await page.waitForTimeout(1800);assert.equal((await state()).place,'park');await page.screenshot({path:`${out}/park.png`});
 await page.getByRole('button',{name:'返回整座小岛',exact:true}).click();await page.waitForTimeout(1700);
 await page.mouse.move(980,450);await page.mouse.down();await page.mouse.move(770,460,{steps:16});await page.mouse.up();await page.waitForTimeout(1000);assert.equal((await state()).place,null);await page.screenshot({path:`${out}/rotated.png`});
 const mobile=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});const phone=await mobile.newPage();await phone.goto(base,{waitUntil:'networkidle'});await phone.getByRole('button',{name:'让海风带路',exact:true}).tap();await phone.waitForFunction(()=>JSON.parse(window.render_game_to_text()).mode==='island',null,{timeout:15000});await phone.waitForTimeout(2500);await phone.screenshot({path:`${out}/mobile.png`});assert.equal(await phone.locator('.pin-name').count(),0);
 await phone.getByRole('button',{name:'前往花慢慢开',exact:true}).tap();await phone.getByRole('button',{name:'包一束花',exact:true}).waitFor();assert.equal(await phone.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await mobile.close();
 assert.deepEqual(errors,[]);await fs.writeFile(`${out}/results.json`,JSON.stringify({errors,physicalEntry:['home','flowers','sunrise'],journalTravel:true,rotation:true,mobileTouch:true,state:await state()},null,2));console.log('Refinement verified: no floating text, physical building entry, journal navigation, rotation, mobile touch.');
}catch(e){await page.screenshot({path:`${out}/failure.png`});throw e;}finally{await browser.close();}
