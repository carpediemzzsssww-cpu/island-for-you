import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const base=process.env.ISLAND_QA_URL||'http://localhost:5174';
const out='output/playwright';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:960},deviceScaleFactor:1});
const page=await context.newPage(),errors=[];let activePage=page;page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const click=async name=>page.getByRole('button',{name,exact:true}).click({timeout:20000});
const state=()=>page.evaluate(()=>JSON.parse(window.render_game_to_text()));
const screenshot=async name=>{await page.waitForTimeout(650);await page.screenshot({path:`${out}/${name}.png`});};
const close=()=>click('轻轻放回去');
const travel=async name=>{await click('返回整座小岛');await click(`前往${name}`);await page.waitForTimeout(1700);};
try{
 if(!process.env.ONLY_MOBILE){
 await page.goto(base,{waitUntil:'networkidle'});await page.waitForFunction(()=>typeof window.render_game_to_text==='function');await screenshot('arrival');
 await click('让海风带路');await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).mode==='island',null,{timeout:15000});await page.waitForTimeout(2000);await screenshot('island');
 await travel('岛主的家');await click('照片墙');await page.getByRole('dialog',{name:'我眼睛里的你'}).waitFor();await screenshot('home-photos');await close();
 await click('手账');await page.getByRole('dialog',{name:'小岛手账'}).waitFor();await screenshot('journal');await close();assert.equal((await state()).core.homeSeen,true);
 await click('信封');assert.equal(await page.getByText('Not yet.',{exact:true}).count(),1);await close();
 await travel('花慢慢开');await click('包一束花');for(const f of ['郁金香','小雏菊','玫瑰'])await click(`加一枝${f}`);await click('选包装纸');await click('系一条丝带');await click('系好丝带');assert.equal((await state()).bouquet.flowers.length,3);await screenshot('flowers');await close();
 await travel('好好吃饭食堂');await page.locator('.scene-actions button',{hasText:'今日菜单'}).click();await page.getByRole('button',{name:/^椰子鸡 热气腾腾/}).click();await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).object===null,null,{timeout:10000});await screenshot('diner');assert.equal((await state()).core.dinerSeen,true);
 await travel('日落收藏处');await click('日落 / 日出');await click('下一张');await screenshot('sunset');await click('把这一张放进手账');assert.equal((await state()).core.sunsetSeen,true);
 await click('沙滩写字');const pad=await page.getByLabel('沙滩写字区域').boundingBox();await page.mouse.move(pad.x+30,pad.y+80);await page.mouse.down();await page.mouse.move(pad.x+130,pad.y+160,{steps:15});await page.mouse.move(pad.x+210,pad.y+70,{steps:15});await page.mouse.up();await screenshot('sand');await close();
 await click('拿起相机');await click('按下快门');await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).shots===1);await screenshot('camera');await click('收起相机');
 await travel('等天亮的山坡');const oldTime=(await state()).time;await click('沿着山路出发');await page.getByRole('button',{name:'带着晨光回去',exact:true}).waitFor({timeout:45000});await screenshot('sunrise');await click('带着晨光回去');assert.equal((await state()).time,oldTime);assert.equal((await state()).endingUnlocked,true);assert.equal((await state()).endingSeen,false);
 // The fifth memory brings an invitation to the square.
 await page.getByRole('dialog',{name:'岛心的邀请'}).waitFor({timeout:15000});await screenshot('invitation');await click('现在就去');await page.waitForTimeout(1700);await click('把小岛的灯点亮');await page.waitForTimeout(6800);assert.equal((await state()).music.birthday,'box');assert.equal((await state()).music.track,null);await screenshot('celebration');
 // The birthday evening: candles, a held wish, blowing them out, then the letter.
 await click('点上蜡烛');{const wish=page.getByRole('button',{name:/许一个愿/});await wish.waitFor();const b=await wish.boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.waitForTimeout(2200);await page.mouse.up();}
 await click('吹蜡烛');await page.waitForTimeout(1500);await screenshot('birthday');await click('回家，拆开那封信');assert.equal((await state()).music.track,'ending');assert.equal((await state()).music.birthday,null);await click('拆开信封');await page.waitForTimeout(1800);await screenshot('letter');await click('把信轻轻收好');assert.equal((await state()).letterRead,true);
 await click('设置');await click('午后');await close();assert.equal((await state()).time,'afternoon');
 await page.reload({waitUntil:'networkidle'});await click('让海风带路');await page.waitForTimeout(1500);assert.equal((await state()).letterRead,true);assert.equal((await state()).shots,1);assert.equal((await state()).bouquet.flowers.length,3);
 await travel('岛主的家');await screenshot('home-grown');await click('手账');await page.getByRole('tab',{name:'拍立得',exact:true}).click();await screenshot('saved-photos');assert.equal(await page.getByAltText('你拍下的小岛').count(),1);await close();
 await travel('白房子与海');await click('在这里待一会儿');await page.waitForTimeout(14500);assert.equal((await state()).weather,'glow');await screenshot('cloud-after-rain');
 await travel('无所事事公园');await click('荡一会儿秋千');await click('旋转木马');await page.getByRole('button',{name:'咦，小熊猫',exact:true}).dispatchEvent('click');/* it wanders, so tap its proxy wherever it is */await screenshot('park');
 await page.evaluate(()=>{window.__qaFrames=[];let last=performance.now();let n=0;const measure=now=>{window.__qaFrames.push(now-last);last=now;if(++n<120)requestAnimationFrame(measure);};requestAnimationFrame(measure);});await page.waitForTimeout(3000);const perf=await page.evaluate(()=>({state:JSON.parse(window.render_game_to_text()),frames:window.__qaFrames,renderer:window.__island?window.__island.renderer.getContext().getParameter(window.__island.renderer.getContext().RENDERER):null /* only in development or with ?perf */}));
 await fs.writeFile(`${out}/desktop-results.json`,JSON.stringify({errors,perf},null,2));assert.deepEqual(errors,[]);console.log('Desktop: full story, reload, stored photo, optional interactions passed.');
 }
 const mobile=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});const phone=await mobile.newPage();activePage=phone;const mobileErrors=[];phone.on('pageerror',e=>mobileErrors.push(e.message));await phone.goto(base,{waitUntil:'networkidle'});await phone.screenshot({path:`${out}/mobile-arrival.png`});
 await phone.getByRole('button',{name:'让海风带路',exact:true}).tap();await phone.waitForFunction(()=>JSON.parse(window.render_game_to_text()).mode==='island',null,{timeout:15000});await phone.waitForTimeout(2200);await phone.screenshot({path:`${out}/mobile-island.png`});
 await phone.getByRole('button',{name:'前往花慢慢开',exact:true}).tap();await phone.waitForTimeout(1600);await phone.getByRole('button',{name:'包一束花',exact:true}).tap();for(const f of ['郁金香','小雏菊','玫瑰'])await phone.getByRole('button',{name:`加一枝${f}`,exact:true}).tap();await phone.getByRole('button',{name:'选包装纸',exact:true}).tap();await phone.getByRole('button',{name:'系一条丝带',exact:true}).tap();await phone.getByRole('button',{name:'系好丝带',exact:true}).tap();await phone.screenshot({path:`${out}/mobile-flowers.png`});
 const overflow=await phone.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert.equal(overflow,false);await phone.getByRole('button',{name:'轻轻放回去',exact:true}).tap();await phone.getByRole('button',{name:'返回整座小岛',exact:true}).tap();await phone.getByRole('button',{name:'前往岛主的家',exact:true}).tap();await phone.waitForTimeout(1600);await phone.getByRole('button',{name:'照片墙',exact:true}).tap();await phone.screenshot({path:`${out}/mobile-wall.png`});await phone.getByRole('button',{name:'轻轻放回去',exact:true}).tap();await phone.getByRole('button',{name:'手账',exact:true}).tap();await phone.screenshot({path:`${out}/mobile-journal.png`});await phone.getByRole('button',{name:'轻轻放回去',exact:true}).tap();
 await phone.setViewportSize({width:844,height:390});await phone.waitForTimeout(1000);await phone.screenshot({path:`${out}/mobile-landscape.png`});assert.equal(await phone.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await fs.writeFile(`${out}/mobile-results.json`,JSON.stringify({errors:mobileErrors,state:await phone.evaluate(()=>JSON.parse(window.render_game_to_text())),realDevice:false},null,2));assert.deepEqual(mobileErrors,[]);await mobile.close();console.log('Mobile emulation: touch, bouquet, photo wall, journal, portrait / landscape passed.');
}catch(e){await activePage.screenshot({path:`${out}/failure.png`}).catch(()=>{});await fs.writeFile(`${out}/failure.json`,JSON.stringify({error:String(e),errors,state:await state().catch(()=>null)},null,2));throw e;}finally{await browser.close();}
