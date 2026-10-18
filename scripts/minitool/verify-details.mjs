import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const out='output/minitool-details-v102';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});const errors=[],records=[];
const context=await browser.newContext({viewport:{width:402,height:874},isMobile:true,hasTouch:true,deviceScaleFactor:2});const page=await context.newPage();
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.addInitScript(()=>document.addEventListener('DOMContentLoaded',()=>{document.documentElement.style.setProperty('--safe-area-inset-top','59px');document.documentElement.style.setProperty('--safe-area-inset-bottom','34px');window.dispatchEvent(new Event('resize'));}));
const state=(code,arg)=>page.evaluate(({code,arg})=>Function('s','arg',code)(window.__island.store.getState(),arg),{code,arg});
const travel=async p=>{await state('s.travel(arg)',p);await page.waitForTimeout(1800)};
async function shot(name){await page.waitForTimeout(400);await page.screenshot({path:`${out}/${name}.png`});const stat=await page.evaluate(()=>JSON.parse(window.render_game_to_text()));records.push({name,...stat});assert.ok(stat.triangles<100000,name+': triangles '+stat.triangles);assert.ok(stat.drawCalls<100,name+': draws '+stat.drawCalls);}
// A separate render from a close inspection angle; normal user camera is restored immediately.
async function close(name,eye,target){const png=await page.evaluate(({eye,target})=>{const {camera,renderer,scene}=window.__island;const p=camera.position.clone(),q=camera.quaternion.clone(),f=camera.fov;camera.position.set(...eye);camera.lookAt(...target);camera.fov=35;camera.updateProjectionMatrix();renderer.render(scene,camera);const result=renderer.domElement.toDataURL('image/png');camera.position.copy(p);camera.quaternion.copy(q);camera.fov=f;camera.updateProjectionMatrix();return result;},{eye,target});await fs.writeFile(`${out}/${name}.png`,Buffer.from(png.split(',')[1],'base64'));}
try{
 await page.goto('http://127.0.0.1:5195/nested/app/?perf');await page.getByRole('button',{name:'让海风带路'}).tap();await page.waitForFunction(()=>window.__island);await state("s.finishIntro();s.setting('muted',true);window.__island.store.setState({save:{...s.save,endingSeen:true,time:'afternoon'}})");
 await page.waitForTimeout(1700);await shot('00-overview');
 await state("s.dispatch({type:'bouquet',bouquet:{flowers:['tulip','rose','daisy','hydrangea','eucalyptus'],stems:['tulip','tulip','rose','rose','daisy','daisy','hydrangea','eucalyptus'],paper:'ivory',ribbon:'pink'}})");
 await travel('home');await shot('01-home-bouquet');await close('02-bouquet-detail',[7.06,2.64,-3.06],[6.48,2.34,-4.16]);
 const found=await page.evaluate(()=>{const g=window.__island.scene.getObjectByName('saved-bouquet');return g?.children[0]?.children.filter(o=>o.isMesh).length});assert.equal(found,2,'saved bouquet has merged flower heads and stems');
 await travel('flowers');await shot('03-florist');
 await state("s.dispatch({type:'bouquet',bouquet:{flowers:['hydrangea','gypsophila','rose'],stems:[...Array(4).fill('hydrangea'),...Array(4).fill('gypsophila'),...Array(4).fill('rose')],paper:'mist',ribbon:'green'}})");await shot('03a-full-bouquet');await travel('home');await shot('03b-full-bouquet-home');await state("s.dispatch({type:'bouquet',bouquet:{flowers:['hydrangea','tulip','rose'],stems:[...Array(4).fill('hydrangea'),...Array(4).fill('tulip'),...Array(4).fill('rose')],paper:'ivory',ribbon:'pink'}})");await travel('flowers');await shot('03c-petal-bouquet');

 await travel('park');await shot('04-park');await close('05-carousel-detail',[-6.2,2.65,-1.2],[-8,1.95,-4.4]);await state("s.playToy('carousel')");await page.waitForTimeout(800);await shot('06-carousel-running');
 await travel('town');await shot('07-town');
 await travel('diner');await state("window.__island.store.setState({save:{...s.save,optional:{...s.save.optional,foodMemories:['chicken','jelly','shaomai','milk']}}});s.setCloseUp(true)");await page.waitForTimeout(1800);await shot('08-diner');
 await travel('cloud');await shot('09-library');await state("s.setCloudView('inside')");await page.waitForTimeout(1600);await shot('10-library-inside');
 await travel('sunrise');await shot('11-hill');await close('12-lighthouse-detail',[2.5,5,-4.6],[0,5.4,-8.5]);await page.getByRole('button',{name:'沿着山路出发'}).tap();for(let i=0;i<4;i++){await page.waitForTimeout(1400);await shot('12-walk-'+i);}await page.waitForTimeout(9500);await shot('12-dawn');
 await travel('sunset');await shot('13-sunset');await close('14-parasol-detail',[-2.1,2.5,9.2],[-2.8,2.35,6.55]);
 await page.locator('.countdown.said').filter({hasText:'凡尔纳《绿光》'}).waitFor({timeout:30000});await shot('15-green-ray');assert.equal(await page.getByRole('button',{name:'绿光！点一下'}).count(),0);assert.equal(await page.getByText(/接住了/).count(),0);assert.equal(await state('return s.save.secret.greenFlash'),true);
 await travel('celebration');await state('s.setParty(0)');await page.getByRole('button',{name:'把小岛的灯点亮'}).tap();await page.getByRole('button',{name:'点上蜡烛',exact:true}).waitFor();await page.waitForTimeout(1600);await shot('16-cake-unlit');await close('17-candles-detail',[.65,2.95,6.7],[0,2.4,5.4]);
 await page.getByRole('button',{name:'点上蜡烛',exact:true}).tap();await page.waitForTimeout(1400);await shot('18-cake-lit');await close('19-flames-detail',[.65,2.95,6.7],[0,2.4,5.4]);
 await page.getByRole('button',{name:'许好了',exact:true}).tap();await page.getByRole('button',{name:'吹蜡烛',exact:true}).tap();await page.waitForTimeout(7600);await shot('20-cake-out');assert.equal(await page.locator('.scene-camera').count(),0);await close('21-cake-out-detail',[.65,2.95,6.7],[0,2.4,5.4]);
 assert.deepEqual(errors,[]);console.log(records.map(({name,drawCalls,triangles})=>({name,drawCalls,triangles})));await fs.writeFile(`${out}/verification.json`,JSON.stringify({records,errors,scope:'Strict CSP localhost approximation; native simulator and phones pending'},null,2));
}finally{if(errors.length)console.error(errors);await browser.close();}
