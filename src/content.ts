import manifest from '../assets-manifest.json';
export type PlaceId = 'home'|'town'|'diner'|'flowers'|'park'|'sunset'|'sunrise'|'cloud'|'celebration';
export type TimeOfDay = 'afternoon'|'sunset'|'night'|'morning';
export type ObjectId = 'journal'|'wall'|'menu'|'bouquet'|'postcards'|'sand'|'camera'|'letter'|'radio'|'phone'|'video'|'settings'|null;
export type Vec3 = [number,number,number];
// Who the island is for and who it is from. `friend` is how the island addresses her: on the house, the cake card,
// the envelope and the phone. `brand` is the word next to the star in the top-left corner.
export const site={friend:'岛主',from:'你的朋友',brand:'Hi'};
/** The island's "today" is the day she visits: the journal, the phone and the welcome all show it. */
export const today=(()=>{const d=new Date();return {month:d.getMonth()+1,day:d.getDate()};})();
export const places:Record<PlaceId,{name:string;en:string;description:string;position:Vec3;camera:Vec3;target:Vec3}> = {
 home:{name:`${site.friend}的家`,en:'A LITTLE PLACE OF YOUR OWN',description:'窗外有大海。桌上有人给你留下了一封信。',position:[7,4.9,-4.3],camera:[10.4,7.7,1.9],target:[7,1.85,-4.2]},
 town:{name:'转角慢街',en:'THE SLOW STREETS',description:'拐个弯，也许正好闻到面包的香气。',position:[-.6,5,-1],camera:[-1,7.6,10],target:[-.3,2,-.6]},
 diner:{name:'好好吃饭食堂',en:'SOMETHING DELICIOUS',description:'今日也宜一本正经地，吃点好吃的。',position:[3.7,4.9,1.7],camera:[6.9,4.6,8.4],target:[3.7,2.1,3.4]},
 flowers:{name:'花慢慢开',en:'THE FLOWER CORNER',description:'选几枝喜欢的花，把它们包成漂亮的花束。',position:[-4.2,4.9,1.1],camera:[-7.8,6.5,9],target:[-4.4,1.8,2.9]},
 park:{name:'无所事事公园',en:'NOWHERE TO RUSH',description:'可以什么也不做，也可以再荡一会儿秋千。',position:[-8.4,4.2,-1.6],camera:[-13.2,7.6,5.6],target:[-8.3,1.5,-1.5]},
 sunset:{name:'日落收藏处',en:'KEEP A LITTLE SUNSET',description:'那些一起看过的天空，收藏在这里。',position:[-7,2.3,8.7],camera:[-4.7,3.5,5.8],target:[-10.6,1.4,12.2]},
 sunrise:{name:'等天亮的山坡',en:'BEFORE THE WORLD WAKES',description:'从这里出发，回到起得很早很早的清晨。',position:[0,6.9,-8.5],camera:[6,9,-.5],target:[0,3,-8]},
 cloud:{name:'白房子与海',en:'AFTER THE RAIN',description:'如果下雨就在这里待一会儿。',position:[9,3.4,1.6],camera:[13.8,4.9,8.2],target:[8.7,1.9,2.4]},
 celebration:{name:'为你亮起的夜晚',en:'A TABLE FOR YOU',description:'和你有关的都在这里。',position:[0,2,5.2],camera:[.4,6.5,14],target:[0,1.8,5.2]}
};
// The five core memories. Finding all five opens the birthday evening; the journal and its button show how far she is.
export const coreMemories=[
 {key:'homeSeen',name:'回家看看',place:'home',hint:'家里照片墙，桌上有一本手账。'},
 {key:'flowerMade',name:'包一束花',place:'flowers',hint:'花店的风铃在响，去选几枝喜欢的吧。'},
 {key:'dinerSeen',name:'吃点好吃的',place:'diner',hint:'好好吃饭食堂今天也开着。'},
 {key:'sunsetSeen',name:'收藏一次日落',place:'sunset',hint:'傍晚的海边，坐下来等日落。'},
 {key:'sunriseReached',name:'等一次天亮',place:'sunrise',hint:'沿着山路上去，回到很早的清晨。'},
] as const;
// Photographs, listed in assets-manifest.json by scripts/photos.py. Until real ones are added they are painted
// placeholders. The category decides where a photo can appear: portraits on the desk and at the birthday table, skies
// on the sunset postcards; every photo hangs on the photo strings and opens in the gallery.
export type MemoryPhoto={id:string;category:string;width:number;height:number;caption:string;src:string;thumbnail:string;date?:string|null};
export const photos:MemoryPhoto[]=manifest.photos;
export const portraits=photos.filter(p=>p.category==='portrait');
export const sunsets=photos.filter(p=>p.category==='sunset');
export const byCategory=(category:string)=>photos.filter(p=>p.category===category);
/** An optional short video at the end of the gallery (null when there is none). */
export const video:{src:string;caption:string}|null=manifest.video;
// Flowers for the 3D florist's table (src/bouquet). `note` is the line shown when she picks it.
export const flowers=[
 {id:'tulip',name:'郁金香',color:'#e99aab',note:'粉色的，杯子一样合着。'},
 {id:'rose',name:'玫瑰',color:'#cf6680',note:'一层一层，慢慢打开。'},
 {id:'daisy',name:'小雏菊',color:'#fff6e4',note:'白色的小太阳。'},
 {id:'hydrangea',name:'绣球',color:'#a9bfdc',note:'一大朵里，藏着好多小花。'},
 {id:'cosmos',name:'波斯菊',color:'#f0a7bd',note:'风一吹就晃。'},
 {id:'gypsophila',name:'满天星',color:'#f4f2ea',note:'细细碎碎的，配什么都好。'},
 {id:'frangipani',name:'鸡蛋花',color:'#fbf3df',note:'白瓣黄心，落在地上也是香的。'},
 {id:'bougainvillea',name:'三角梅',color:'#d64f8f',note:'花瓣像纸一样薄，一开就是一大片。'},
 {id:'eucalyptus',name:'尤加利叶',color:'#97b3a3',note:'一点灰绿，衬着花。'},
];
export const papers=[{id:'ivory',name:'奶油纸',color:'#efe3cb'},{id:'kraft',name:'牛皮纸',color:'#c7a57a'},{id:'rose',name:'雾粉纸',color:'#e2bcb6'},{id:'mist',name:'雾蓝纸',color:'#bccbd6'},{id:'tissue',name:'雪梨纸',color:'#f7f4ee'}];
export const ribbons=[{id:'pink',name:'粉色',color:'#d68fa1'},{id:'green',name:'墨绿',color:'#4f7466'},{id:'cream',name:'米白',color:'#eadfc4'},{id:'wine',name:'酒红',color:'#97404f'}];
export const menu=[{id:'chicken',name:'椰子鸡',note:'热气腾腾，慢一点吃。',price:'一整个好心情',kind:'bowl'},{id:'jelly',name:'椰奶冻',note:'留一点甜，给今天。',price:'一小口夏天',kind:'jelly'},{id:'shaomai',name:'咸蛋黄烧卖',note:'刚出笼，咸蛋黄的香。',price:'一份惦记',kind:'dumpling'},{id:'milk',name:'牛奶',note:'和烧卖一起，刚刚好。',price:'一杯刚刚好',kind:'milk'}];
// A sample letter. Replace it with your own words (see README: "Make it yours"). `isPreview` shows a "draft" label.
export const letter={isPreview:false,title:'To you',salutation:`亲爱的${site.friend}：`,paragraphs:[
 '生日快乐！',
 '这座小岛是送给你的。海边可以等日落，山坡上可以等天亮；下雨了，就去白房子旁边躲一会儿，雨停以后的天空很好看。',
 '岛上的一切都不着急。花可以慢慢挑，菜可以一道一道点，那只小熊猫也总是自己走来走去。想待多久，就待多久。',
 '照片会在墙上悄悄翻面，手账会记下你走过的地方。你拍下的小岛，也会一直留在这里。',
 '新的一岁，愿你常常被惦记，也常常有好吃的。'
],signature:site.from,date:''};
export type TrackId='arrival'|'home'|'diner'|'sunrise'|'ending';
// Music-box arrangements of public-domain melodies, rendered by scripts/render_music.mjs (no recordings).
// `start` skips into a song (seconds).
export const tracks:Record<TrackId,{src:string;title:string;artist:string;start?:number;volume:number}>={
 arrival:{src:'/music/minuet-in-g.mp3',title:'Minuet in G',artist:'Petzold · music box',volume:.85},
 home:{src:'/music/prelude-in-c.mp3',title:'Prelude in C',artist:'Bach · music box',volume:.9},
 diner:{src:'/music/twinkle.mp3',title:'Twinkle, Twinkle, Little Star',artist:'Traditional · music box',volume:.8},
 sunrise:{src:'/music/ode-to-joy.mp3',title:'Ode to Joy',artist:'Beethoven · music box',volume:.85},
 ending:{src:'/music/auld-lang-syne.mp3',title:'Auld Lang Syne',artist:'Traditional · music box',volume:.95}
};
// Records on Home's player, in order; the first is on the turntable.
export const records:TrackId[]=['home','ending','diner','arrival','sunrise'];
export const phoneMessages=[`@${site.friend} 快看这个`,'笑死','哈哈哈哈哈哈','想吃','去不去','？'];
