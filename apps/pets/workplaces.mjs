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
export const PET_WORKPLACES=[
 {id:'bakery',title:'面包店',role:'面包店看板宠物',icon:'bread',steps:['先熟悉店里','陪一会儿客人','准备收工'],trialWage:24,wage:30,energy:.18,events:BAKERY_EVENTS},
 {id:'florist',title:'花店',role:'花店店宠',icon:'leaf',steps:['认识花香','陪着包花','带花回家'],trialWage:18,wage:24,energy:.12,events:FLORIST_EVENTS}
];
export const petWorkplace=id=>PET_WORKPLACES.find(x=>x.id===id)||PET_WORKPLACES[0];
export const workplaceInfo=id=>{const {events,...info}=petWorkplace(id);return structuredClone(info);};
