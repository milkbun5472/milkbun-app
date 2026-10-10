import {EXTRA_WORKPLACES} from './temporary-work.mjs?v=fg-b8fac1ac2a1bdca7';
import {PET_CASES,DETECTIVE_EVENTS} from './detective.mjs?v=fg-b8fac1ac2a1bdca7';
export const BAKERY_EVENTS=[
 {id:'flour',title:'柜台旁落了一点面粉',text:'它凑近闻了闻，鼻尖差点碰到白白的一小堆。现在怎么安排？',options:[{id:'watch',label:'留在柜台等客人',note:'守住了自己的位置，来买面包的人多看了它几眼。',tip:4,bread:0,like:.04,trait:'social'},{id:'explore',label:'让它在安全的角落看看',note:'绕着面粉观察了一圈，发现柜台下面还有小纸袋。',tip:1,bread:1,like:.07,trait:'bold'},{id:'break',label:'陪它歇一小会儿',note:'休息以后又愿意回到柜台边，今天没那么累。',tip:0,bread:0,like:.08,energy:5}]},
 {id:'visitor',title:'门边来了一个小客人',text:'隔壁的小宠物停在店门口。它一边看着新朋友，一边听店里打包面包的声音。',options:[{id:'greet',label:'让它慢慢认识新朋友',note:'互相闻了闻，认识了附近的新朋友。',tip:2,bread:0,like:.08,trait:'social'},{id:'stay',label:'一起留在熟悉的柜台边',note:'没有勉强打招呼，它安安稳稳陪完了这一段。',tip:3,bread:0,like:.04},{id:'pause',label:'先给它一点独处时间',note:'在安静的角落缓了缓，没被店里的热闹吓着。',tip:0,bread:0,like:.06,energy:4}]},
 {id:'bag',title:'一个空纸袋滚到了脚边',text:'它盯着纸袋，明显比盯着招牌还认真。顾客的面包已经打包好，纸袋是多出来的。',options:[{id:'keep',label:'收好纸袋，等下班再玩',note:'把纸袋留到了下班，多站了一会儿柜台。',tip:4,bread:0,like:.03},{id:'play',label:'给它一小段纸袋游戏时间',note:'玩过纸袋以后，今天对店里的印象更好了。',tip:0,bread:0,like:.09,energy:-2,trait:'active'},{id:'swap',label:'把纸袋送回打包台',note:'送回了多余的纸袋，下班时多带回一个小面包。',tip:2,bread:1,like:.05}]},
 {id:'closing',title:'柜台上还剩几个小面包',text:'这一段快结束了。它看了看面包，又看了看门口的阳光。',options:[{id:'pose',label:'再陪最后一位客人',note:'耐心陪完最后一位客人，得到了一点额外酬谢。',tip:5,bread:0,like:.03,trait:'social'},{id:'pack',label:'把留给它的小面包装好',note:'收好了属于它的小面包，可以带回家留着。',tip:1,bread:1,like:.07},{id:'easy',label:'让它安安静静结束这段',note:'按自己的节奏收尾，没有被催着营业。',tip:0,bread:0,like:.08,energy:3}]}
];
export const FLORIST_EVENTS=[
 {id:'petals',title:'花桶旁落了一地花瓣',text:'打包完花束，几片粉白花瓣飘到它脚边。它轻轻闻了闻，等你拿主意。',options:[{id:'collect',label:'一起收好落下的花瓣',note:'把干净花瓣收进小纸包，准备带回家。',tip:1,petals:2,like:.07,trait:'bold'},{id:'watch',label:'让它在花桶边陪客人',note:'安静蹲在花桶旁，客人挑花时多看了它几眼。',tip:3,like:.03,trait:'social'},{id:'rest',label:'找个安静角落歇一会儿',note:'在长凳旁歇了歇，慢慢熟悉了店里的花香。',tip:0,like:.08,energy:4}]},
 {id:'ribbon',title:'包花台旁垂下一截丝带',text:'它盯着丝带末端，耳朵轻轻动了一下。这是店里正在用的包装丝带。',options:[{id:'return',label:'把丝带收回包花台',note:'收好了丝带，包花台重新整整齐齐；店里留给它一枝小花。',tip:2,flower:1,like:.04},{id:'wait',label:'陪它在矮踏台上看包花',note:'它没有扑丝带，安稳看完了这一束花的包装。',tip:3,like:.05,trait:'social'},{id:'corner',label:'先带它去安静的角落',note:'离开晃动的丝带，给它一点自己的时间。',tip:0,petals:1,like:.08,energy:3}]},
 {id:'neighbor',title:'门口的小邻居又探了探头',text:'附近的小宠物停在门垫外，想看看花桶边的新面孔。它回头望了望你。',options:[{id:'greet',label:'陪它慢慢认识小邻居',note:'隔着门垫互相闻了闻，认识了花店门口的小邻居。',tip:1,friend:true,like:.09,trait:'social'},{id:'stay',label:'留在熟悉的花桶旁',note:'先从花桶边观察新邻居，没有勉强它靠近。',tip:2,like:.04},{id:'quiet',label:'让它独自缓一缓',note:'小邻居先走了，它在安静处恢复了精神。',tip:0,like:.06,energy:4}]},
 {id:'little-flower',title:'收工前留下了一枝小花',text:'店里整理出几枝不用于出售的小花，可以留给今天来帮忙的它。',options:[{id:'take',label:'收好一枝带回家',note:'把属于它的小花包好了，回家可以插进花瓶。',tip:0,flower:1,like:.08},{id:'help',label:'再陪店里整理一会儿',note:'陪完最后一小段整理，收工时多拿到一点酬谢和花瓣。',tip:4,petals:1,like:.03,trait:'social'},{id:'easy',label:'慢慢结束这一天',note:'没有催它营业，按自己的节奏收工。',tip:0,like:.07,energy:3}]}
];
export const STORE_EVENTS=[
 {id:'price-tag',title:'货架前掉下一张价签',text:'它把价签拨到了爪边，旁边两件商品看起来几乎一样。店员正等你们帮忙辨认。',options:[{id:'return',label:'一起核对，再交给店员',note:'核对好了掉落的价签，店员送了它一张多余的小贴纸。',tip:2,sticker:1,like:.05,trait:'bold'},{id:'counter',label:'让它留在柜台陪客人',note:'它安稳守了一段柜台，店员自己收好了价签。',tip:3,like:.03,trait:'social'},{id:'quiet',label:'陪它去安静处歇歇',note:'先缓了缓，今天没有被催着在货架前忙。',tip:0,like:.08,energy:4}]},
 {id:'long-receipt',title:'收银机吐出一张长长的小票',text:'小票上只有一瓶水，却印了很长一串积分说明。店员说这张作废的小票可以留给它。',options:[{id:'keep',label:'折好收进下班的小袋子',note:'把长得离谱的作废小票折好了，准备下班带回家。',tip:0,receipt:2,like:.08},{id:'stay',label:'先陪完这位结账的客人',note:'没有追着小票跑，陪客人安稳结完了账。',tip:4,receipt:1,like:.04,trait:'social'},{id:'look',label:'让它在一旁慢慢观察',note:'盯着吐小票的机器看了好一会儿，慢慢熟悉了收银台的声音。',tip:1,receipt:1,like:.07,trait:'bold'}]},
 {id:'directions',title:'门口的客人来问路',text:'客人想找花店，它却认真望向隔壁的面包店。店员笑着等你们一起指路。',options:[{id:'help',label:'陪店员指向花店',note:'一起帮客人找到了花店方向，店员多给了它一点酬谢。',tip:4,like:.05,trait:'social'},{id:'observe',label:'让它在门内慢慢看',note:'留在门内看客人离开，没有勉强它招呼陌生人。',tip:1,sticker:1,like:.07},{id:'break',label:'先休息，交给店员招呼',note:'在安静处休息，问路的事交给店员处理。',tip:0,like:.09,energy:5}]},
 {id:'sticker-roll',title:'封箱贴纸上有一个歪歪的小脸',text:'整理货架时，店员留下几张不再使用的贴纸。其中一张的眼睛贴得一高一低。',options:[{id:'pick',label:'给它收好那张歪脸贴纸',note:'挑了歪歪小脸的贴纸，装进属于它的下班袋子。',tip:0,sticker:2,like:.08,trait:'active'},{id:'finish',label:'陪店员把最后一层货架理好',note:'陪完最后一段整理，得到了额外酬谢和一张贴纸。',tip:4,sticker:1,like:.03},{id:'easy',label:'按它的节奏收工',note:'留了一张小贴纸，没有催它继续营业。',tip:0,sticker:1,like:.07,energy:3}]}
];
export const CAFE_EVENTS=[
 {id:'counter-seat',title:'收银台旁留了一个空位置',text:'店员说今天的店长不用管账，只要愿意陪客人待一会儿。它看了看柜台，又看了看窗边。',options:[{id:'welcome',label:'陪它慢慢招呼客人',note:'陪着来结账的客人待了一会儿，店员给它多留了一点酬谢。',tip:4,like:.04,trait:'social'},{id:'window',label:'让它先在窗边熟悉店里',note:'从安静的窗边观察店里，收好了一张印着小爪子的杯垫。',tip:1,coaster:1,like:.08,trait:'bold'},{id:'break',label:'先歇歇，营业不用急',note:'店员替它招呼客人，今天按舒服的节奏开始。',tip:0,like:.09,energy:5}]},
 {id:'guest-card',title:'客人留下了一张小卡片',text:'卡片上写着「今天也见到你啦」。客人想多陪它待一会儿，它还没有决定要不要靠近。',options:[{id:'company',label:'陪它和客人待一小会儿',note:'慢慢陪完这一小段，客人把写好的留言卡留给了它。',tip:3,guestCard:1,like:.05,trait:'social'},{id:'keep',label:'收好卡片，给它留点距离',note:'留下了客人的留言卡，也给它保留了舒服的距离。',tip:0,guestCard:2,like:.09},{id:'observe',label:'让它自己决定靠不靠近',note:'没有催它营业，它在一旁慢慢认识了这位客人。',tip:1,guestCard:1,like:.07,trait:'bold'}]},
 {id:'crooked-coaster',title:'杯垫上的爪印印歪了',text:'店员整理出几张没用过的纸杯垫。其中一张爪印歪到了边上，它看得比看菜单还认真。',options:[{id:'pick',label:'把歪爪印留给它',note:'挑走了歪歪的小爪印杯垫，准备带回自己的家。',tip:0,coaster:2,like:.09,trait:'active'},{id:'counter',label:'先陪完这一段柜台',note:'陪完柜台这一段，店员把一张杯垫装进它的下班袋子。',tip:4,coaster:1,like:.03,trait:'social'},{id:'quiet',label:'陪它在安静处缓一缓',note:'杯垫收好了，剩下的时间没有再催它招呼客人。',tip:0,coaster:1,like:.08,energy:4}]},
 {id:'slow-afternoon',title:'下午的客人想多坐一会儿',text:'忙的时候过去了，窗边只剩慢慢聊天的客人。这份工作也可以安静地收尾。',options:[{id:'stay',label:'再陪最后一位客人',note:'安稳陪完最后一位客人，得到了一点额外酬谢。',tip:5,like:.03,trait:'social'},{id:'card',label:'收好今天留给它的卡片',note:'把今天的小卡片装进下班袋子，准备带回家慢慢看。',tip:1,guestCard:1,like:.08},{id:'easy',label:'就这样慢慢收工',note:'没有被催着继续营业，按自己的节奏结束了这一班。',tip:0,like:.09,energy:5}]}
];
export const PET_WORKPLACES=[
 {id:'bakery',title:'面包店',description:'柜台、纸袋与小面包',rewards:{bread:1},role:'面包店看板宠物',icon:'bread',steps:['先熟悉店里','陪一会儿客人','准备收工'],trialWage:24,wage:30,energy:.18,events:BAKERY_EVENTS},
 {id:'florist',title:'花店',description:'花香、小邻居与带回的小花',rewards:{flower:1,petals:1},role:'花店店宠',icon:'leaf',steps:['认识花香','陪着包花','带花回家'],trialWage:18,wage:24,energy:.12,events:FLORIST_EVENTS},
 {id:'store',title:'便利店',description:'值班、奇怪小票与小贴纸',rewards:{receipt:1,sticker:1},role:'便利店值班宠物',icon:'bag',steps:['熟悉货架','陪着值班','收好下班小物'],trialWage:16,wage:22,energy:.15,events:STORE_EVENTS},
 {id:'cafe',title:'咖啡店',description:'陪客人、歪爪杯垫与留言卡',rewards:{coaster:1,guestCard:1},role:'咖啡店小店长',icon:'cup',steps:['认识柜台','陪着慢慢营业','收好今天的留言'],trialWage:20,wage:26,energy:.10,events:CAFE_EVENTS},
 {id:'courier',room:'store',title:'便利店代收点',description:'送包裹、认门牌与街区路线',rewards:{deliveryReceipt:1},role:'宠物快递员',icon:'bag',steps:['核对包裹标签','沿街区送件','回代收点交回执'],trialWage:26,wage:34,energy:.20,events:[{id:'courier-pick'},{id:'courier-door'},{id:'courier-return'}]},
 {id:'stall',room:'home',title:'公园小摊',description:'自己的余货、零钱与奇怪交换',rewards:{},role:'流浪小摊老板',icon:'bag',steps:['在家装好小东西','走到公园摆摊','带着余货回家'],trialWage:0,wage:0,energy:.12,events:[{id:'stall-pack'},{id:'stall-guests'},{id:'stall-home'}]},
 {id:'alley',title:'侦探小巷',description:'找线索、拼结论与小镇卷宗',rewards:{caseCard:1},role:'宠物侦探助理',icon:'search',steps:['接下今天的小案','核对新的线索','拼起这件小事'],trialWage:22,wage:28,energy:.16,events:DETECTIVE_EVENTS,cases:PET_CASES}
].concat(EXTRA_WORKPLACES);
export const petWorkplace=id=>PET_WORKPLACES.find(x=>x.id===id)||PET_WORKPLACES[0];
export const workplaceInfo=id=>{const {events,cases,...info}=petWorkplace(id);return structuredClone(info);};

export const workRoom=id=>petWorkplace(id).room||petWorkplace(id).id;
export const professionAtRoom=(room,selected)=>workRoom(selected)===room?selected:room;

export const availableWorkplaces=species=>PET_WORKPLACES.filter(x=>!x.species||x.species===species);
