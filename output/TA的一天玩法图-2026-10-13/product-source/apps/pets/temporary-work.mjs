// New careers use the same three-stage work/choice/wage engine and real rooms.
const choice=(id,label,note,extra={})=>({id,label,note,tip:0,like:.06,...extra});
const story=(id,title,text,help,quiet,reward={})=>({id,title,text,options:[
 choice('help',help[0],help[1],{tip:4,like:.025,trait:'social',...reward}),
 choice('own',quiet[0],quiet[1],{like:.09,trait:'bold'}),
 choice('break','陪它缓一会儿','没有催它营业，歇好以后再慢慢继续。',{like:.08,energy:5})
]});
const MODEL=[
 story('model-light','灯光有点亮','摄影师把柔光灯挪近了一点，它眯眼看了看。',['请摄影师把灯调柔','灯光柔和了，舒服地陪完了这一段。'],['换到窗边的自然光','窗边留了一块安静的位置，它愿意慢慢看看镜头。']),
 story('model-cloth','小方巾系歪了','广告用的小方巾滑到了胸前，拍摄还没有开始。',['一起把方巾理好','理好小方巾，拍完后摄影师把属于它的一条装进袋子。'],['按它舒服的样子拍','不勉强穿戴，今天拍了没有小方巾的自然样子。'],{bandana:1}),
 story('model-sneeze','镜头前打了一个小喷嚏','摄影师停下来笑了笑，这个表情也可以留下。',['留住这张自然的表情','大家喜欢这个小喷嚏，留下了今天的真实拍摄。'],['等它准备好再拍','它慢慢重新看向镜头，没有被催着摆姿势。']),
 story('model-wrap','拍完还想看窗外','这一段已经拍得差不多了，它把头转向窗边。',['再陪最后一张','耐心陪完最后一张，拿到额外的酬谢。'],['让看窗外的样子做结尾','今天以它自己喜欢的样子收尾。'])
];
const ACTOR=[
 story('actor-role','今天演一位很严肃的小客人','咖啡店借了一个角落拍小短片，导演说只要自然地待着。',['先熟悉自己的小位置','认真闻过地面的标记，准备做今天的小演员。'],['让导演顺着它的样子拍','导演改了走位，保留它本来的小脾气。']),
 story('actor-cue','把开拍口令听成了自己的名字','导演刚说开始，它却望向你，像在等你叫它。',['陪它重新认认口令','慢慢试了一次，没有催它赶上别人的节奏。'],['把这次回头也留在片子里','导演觉得这次回头很可爱，保留在小短片里。']),
 story('actor-prop','布景里的空盒子更有吸引力','道具只是一个空纸盒，它盯着盒子比盯着镜头认真。',['先陪完这一段再去闻闻','给它留好盒子，拍完再自由探索。'],['把闻盒子写进这场戏','导演顺着它的好奇，把这一段改成了闻盒子。']),
 story('actor-bow','收工的小领结留给它','道具师留了一只小小的莓果领结，问它要不要带回家。',['把属于它的小领结收好','领结装进了下班袋，回家后再决定戴不戴。'],['今天先轻轻松松收尾','没有勉强穿道具，今天的小片子仍按时收好了。'],{bow:1})
];
const WEDDING=[
 story('wedding-basket','花篮歪到了一边','花店正在为小型婚礼布花，留给它的是一只矮矮的小花篮。',['一起扶正花篮','花篮摆稳了，它在旁边慢慢熟悉。'],['先在花篮旁闻闻','没有催它拿东西，先从安静的布花角落认识这份工作。']),
 story('wedding-petals','几片花瓣落在脚边','准备散花时，干净的花瓣落到门垫上。',['帮忙拨拢干净花瓣','花瓣收进纸包，下班可以带回自己的家。'],['留一点距离看大家布花','站在舒服的位置，没有被花篮和人群挤着。'],{petals:2}),
 story('wedding-step','彩排时慢了半拍','音乐已经响起来了，它还在仔细看地面的小标记。',['陪它按自己的步子走','大家等它走好这一小段，花童不用赶路。'],['让它留在布花台陪客人','调整了今天的分工，它安静待着也很受欢迎。']),
 story('wedding-wreath','留下了一只小花环','布花师把干净的小花环放到它面前，今天的帮忙快结束了。',['收好花环带回家','自己的小花环收进袋子，回家再试着戴。'],['收一枝小花就好','它今天不想戴花环，留下了一枝自己的小花。'],{wreath:1})
];
const BOOKS=[
 story('books-shelf','书架旁空出一个小位置','咖啡店整理窗边的小书架，猫咪可以在低低的平台旁帮忙陪看。',['安静守在书架旁','像一位小管理员，安稳陪完了这一段。'],['先慢慢闻闻书边','熟悉了纸张气味，再决定要不要陪客人。']),
 story('books-bookmark','书签夹到了空白页','客人把小爪书签夹错了位置，店员正在找。',['把露出的书签指出来','找到了小爪书签，店员送给它一张多余的。'],['把这件事交给店员','没有催它帮忙，安静陪着看完了这一段。'],{bookmark:1}),
 story('books-nap','有人把它当成了睡着的书挡','客人轻轻说话，它在书架旁眯起了眼睛。',['先陪完借书的客人','留在熟悉的位置，客人看完书才慢慢结束。'],['今天就当一位安静的管理员','不用不停招呼人，猫咪按自己喜欢的节奏待着。']),
 story('books-print','归还的小卡上有歪爪印','咖啡店留了几张作废的小阅读卡，爪印印到了边上。',['收好小爪书签','收好了今天的阅读小纪念，准备带回家。'],['慢慢结束今天的书架值班','按舒服的节奏收尾，不再催它营业。'],{bookmark:1})
];
const SCENT=[
 story('scent-label','两束花的标签弄反了','花店请寻香助手在两束花旁仔细闻闻，再让店员核对标签。',['和店员一起核对','停下来慢慢辨认，帮店员把标签理好了。'],['先从熟悉的淡花香开始','从舒服的气味认识这份工作，没有要求它一次全会。']),
 story('scent-strong','新花束的香气有点浓','它退开了半步，店员也注意到了。',['请店员把花束挪远','保持舒服的距离，再闻另一束淡淡的小花。'],['给它换一段安静任务','到门垫旁陪看，不勉强继续闻浓花香。']),
 story('scent-trail','小花瓣一路落到了门垫','店员整理花束时掉了几片花瓣，想找到原来的花桶。',['一起闻闻这条小痕迹','找到花桶旁，留下了一张香气小卡做纪念。'],['让店员收拾，它在一旁观察','没有追着花瓣跑，慢慢认识了花店的忙碌。'],{scentCard:1}),
 story('scent-wrap','店员夸它鼻子很认真','今天的核对结束了，店员给它准备了一枝小花。',['收好属于它的小花','带回一枝自己的小花，下班袋里也留下了香气小卡。'],['轻轻松松结束今天','安静收尾，今天没有被催着一直帮忙。'],{flower:1,scentCard:1})
];
export const EXTRA_WORKPLACES=[
 {id:'model',room:'cafe',title:'宠物模特',description:'窗边拍广告，留下今天的照片',role:'窗边广告模特',icon:'paw',temporary:true,photo:true,rewards:{bandana:1},steps:['熟悉镜头','陪着拍摄','收好今天的照片'],trialWage:28,wage:36,energy:.17,events:MODEL},
 {id:'actor',room:'cafe',title:'临时小演员',description:'咖啡店小短片与歪歪的道具',role:'临时小演员',icon:'book',temporary:true,photo:true,rewards:{bow:1},steps:['认识小角色','陪完这一场','收好拍摄纪念'],trialWage:26,wage:34,energy:.18,events:ACTOR},
 {id:'wedding',room:'florist',title:'婚礼花童',description:'在花店帮忙布花和彩排',role:'婚礼花童',icon:'leaf',temporary:true,photo:true,rewards:{wreath:1},steps:['认识小花篮','陪着布花彩排','带回花环'],trialWage:30,wage:38,energy:.15,events:WEDDING},
 {id:'books',room:'cafe',title:'书架小管理员',description:'猫咪专属 · 安静守书架、收书签',role:'猫咪书架管理员',species:'cat',icon:'book',rewards:{bookmark:1},steps:['认识书架','陪客人看书','收好小书签'],trialWage:18,wage:24,energy:.09,events:BOOKS},
 {id:'scent',room:'florist',title:'花店寻香助手',description:'狗狗专属 · 闻花香、找小痕迹',role:'狗狗寻香助手',species:'dog',icon:'search',rewards:{scentCard:1},steps:['熟悉淡花香','核对小痕迹','收好香气卡'],trialWage:22,wage:30,energy:.14,events:SCENT}
];
const text=(v,n)=>typeof v==='string'?v.slice(0,n):'';
export function restoreWorkPhotos(raw){const seen=new Set();return (Array.isArray(raw)?raw:[]).filter(x=>EXTRA_WORKPLACES.some(p=>p.photo&&p.id===x?.profession)&&text(x.id,80)&&!seen.has(x.id)&&seen.add(x.id)&&Number.isFinite(x.day)).map(x=>({id:text(x.id,80),profession:x.profession,day:Math.max(1,Math.floor(x.day)),name:text(x.name,24),caption:text(x.caption,180),image:typeof x.image==='string'&&x.image.length<=60000&&/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(x.image)?x.image:''}));}
