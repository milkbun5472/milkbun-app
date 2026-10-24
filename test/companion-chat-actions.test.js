const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync('js/companion.js','utf8');
const window={addEventListener(){}};
vm.runInNewContext(src,{window,Date});
const act=window.CompanionFace.actForText;
const prose=require('./fixtures/companion-action-prose.cjs');
test('整张聊天动作表逐项都有语言样本，新增动作不能漏掉验证',()=>{
 const actual=[...src.matchAll(/actionRule\("([^"]+)"/g)].map(m=>m[1]).sort();
 assert.deepEqual(Object.keys(prose.cases).sort(),actual);
 assert.equal(actual.length,34);
});
const allVariants=prose.variants();
for(const kind of Object.keys(prose.cases))test('全部动作的长句、倒装、修饰与招呼混用 → '+kind,()=>{
 const rows=allVariants.filter(row=>row.kind===kind);assert.equal(rows.length,256);
 for(const row of rows)assert.equal(act(row.text),kind,row.text);
});
const examples={
 'emotion-kiss':['飞吻','给你一个啵','么么哒','MUA！','啾一下','亲一口','亲了一下额头','亲亲你','吻了吻你','（亲）','亲～','KISS','😘'],
 'emotion-giggle':['偷偷笑','偷偷地笑','偷笑','捂着嘴笑','捂住嘴','掩嘴','抿着嘴笑','憋笑','忍不住笑'],
 'emotion-listen':['侧耳听','侧了侧耳','认真地听','听你说','听你慢慢讲','凑过来听','竖起耳朵','我在听呢'],
 'emotion-promise':['拍拍胸口','拍了拍胸脯','拍着胸膛','我向你保证','我发个誓','包在我身上','说到做到','一言为定'],
 'emotion-cheer':['加油呀','给你打打气','握了握拳','攥紧拳头','给你鼓劲','你一定可以的','你能行','为你鼓掌'],
 'emotion-refuse':['摇头','摇了摇头','摇摇头','轻轻摇着头','摆了摆手','摆摆手','才不要','拒绝'],
 'emotion-cozy':['抱抱','抱住你','抱一下','搂紧你','张开胳膊','张开了双臂','伸手想抱你','（抱）','HUG','🫂'],
 'emotion-chin':['托着下巴','托腮','撑住下巴','支起下巴'],
 'emotion-dance':['跳支舞','跳起小舞','扭扭腰','随着音乐摇摆'],
 'emotion-bow':['鞠个躬','鞠了个躬','欠了欠身','弯腰致意'],
 'emotion-shrug':['耸耸肩','耸了耸肩','摊开手','两手一摊'],
 'emotion-beckon':['招招手示意你过来','勾了勾手','过来一点','靠近我'],
 'emotion-peek':['探出头','探了探头','左顾右盼','左右看看'],
 'emotion-show':['展示新衣服','转个圈给你看','好看吗'],
 'emotion-five-right':['击个掌','击一下掌','high five','give me five'],
 wave:['挥挥手','挥了挥手','招了招手','拜拜','哈啰','早上好','晚安'],
 yawn:['打了个呵欠','打哈欠','困得眼睛都睁不开','想睡了','眼皮打架'],
 stretch:['伸了个懒腰','伸了一个长长的懒腰','伸伸胳膊','活动一下筋骨'],
 tea:['喝了一小口水','喝了两口茶','抿一口咖啡','端着茶杯','举起杯','喝了点奶茶'],
 read:['翻着一本书','看了本书','读一会儿书','翻了一页','写着作业','温习功课'],
 shy:['脸颊微微红','耳尖泛红','捂住脸','有点害羞'],
 hop:['蹦了一下','跳起来','好耶','太棒了'],
 stomp:['跺了跺脚','跺跺脚','气鼓鼓','哼！'],
 sigh:['叹了一口气','叹口气','叹息','长叹'],
 jolt:['吓了一跳','打了个激灵','心头一跳'],
 nod:['点了下头','点点头','轻轻颔首','收到','没问题'],
 turn:['转过身','扭过头','别开了脸','背过身'],
 sit:['坐了下来','坐好','落座','窝进沙发','盘着腿']
};
for(const [kind,lines] of Object.entries(examples))test('聊天常见说法 → '+kind,()=>{
 for(const line of lines)assert.equal(act(line),kind,line);
});
test('全角英文、长段动作与问候混用仍可命中具体动作',()=>{
 assert.equal(act('早安，给你一个飞吻，ＭＵＡ～'),'emotion-kiss');
 assert.equal(act('他看完文件，走过来张开胳膊。'),'emotion-cozy');
 assert.equal(act('嗯嗯，他侧了侧耳，认真地听。'),'emotion-listen');
});
test('点头按动作结构识别，上千种修饰和前后顺序不必逐句列词',()=>{
 const people=['他','她','TA','屏幕里的小人'];
 const modifiers=['轻轻地','慢慢地','略微迟疑地','很认真地','幅度很小地','带着几分肯定地','带着笑意地','很干脆地'];
 const verbs=['点了点','点了一下','向下点了两次','小幅度点动了一下','点低了','点了几下'];
 const heads=['头','脑袋','自己那颗毛茸茸的脑袋','略微低垂着的头','那颗还没完全睡醒的脑袋'];
 let count=0;
 for(const who of people)for(const how of modifiers)for(const verb of verbs)for(const head of heads){
  const text=who+'听完你那段很长的解释后'+how+verb+head+'，表示这件事情已经记在心里。';
  assert.equal(act(text),'nod',text);count++;
 }
 for(const who of people)for(const how of modifiers)for(const head of heads){
  const text=who+'把'+head+how+'向下点了两次。';assert.equal(act(text),'nod',text);count++;
 }
 assert.equal(count,1120);
});
test('其余动作同样接受分开的动词与部位，修饰不局限固定语气词',()=>{
 const cases={
  'emotion-kiss':'他亲了足足一大口你的脸颊。',
  'emotion-giggle':'他用手捂住自己快要绷不住的嘴。',
  'emotion-listen':'他侧了侧被碎发遮住的耳朵。',
  'emotion-promise':'他拍了两下自己挺起来的胸膛。',
  'emotion-cheer':'他握紧了垂在身体两侧的拳头。',
  'emotion-refuse':'他摇了摇那颗乱蓬蓬的脑袋。',
  'emotion-cozy':'他把两条胳膊朝你的方向慢慢张了开来。',
  'emotion-chin':'他撑住了自己微微偏向一侧的下巴。',
  'emotion-dance':'他跳了一支笨拙而欢快的小舞。',
  'emotion-bow':'他鞠了一个郑重其事的深躬。',
  'emotion-shrug':'他耸动了一下僵硬了一整天的肩膀。',
  'emotion-beckon':'他招了招高高举起的手示意你过来。',
  'emotion-peek':'他探出了藏在门后许久的脑袋。',
  'emotion-show':'他转了一个慢吞吞的圈给你看。',
  'emotion-five-right':'他等着和你击一个响亮的掌。',
  wave:'他挥了挥藏在宽大袖子里的手。',
  yawn:'他打了一个拖得长长的哈欠。',
  stretch:'他伸了一个迟到了很久的长懒腰。',
  tea:'他喝了一大口已经温了许久的红茶。',
  read:'他翻了几下摊开在膝盖上的书。',
  shy:'他的耳尖一点一点慢慢地泛起了红。',
  hop:'他从椅子旁边跳了一下站起来。',
  stomp:'他跺了两下穿着软绵绵拖鞋的脚。',
  sigh:'他叹了一口长得快要散进风里的气。',
  jolt:'他被突然的声音吓得猛地一跳。',
  turn:'他转过那颗原本望着窗外的脑袋。',
  sit:'他坐回那张铺了软垫的椅子。'
 };
 for(const [kind,text] of Object.entries(cases))assert.equal(act(text),kind,text);
});
test('长回复先识别具体动作，招呼与口头应答不抢走它',()=>{
 const filler='窗外的光落在桌角，远处车辆的声音渐渐远去。'.repeat(150);
 assert.equal(act('早安，知道啦。'+filler+'他点了点自己那颗毛茸茸的脑袋。'+filler),'nod');
 assert.equal(act('嗯嗯，没问题。他捂住自己快要笑出声的嘴。'),'emotion-giggle');
 assert.equal(act('我保证会认真考虑。他轻轻点了两下脑袋。'),'nod');
});
test('动词和部位隔着很长的同句修饰也能认，修饰没有固定字数上限',()=>{
 const description='自己那颗因为刚刚睡醒而略显蓬松又因为认真琢磨对方说过的事情而不自觉往下低垂着还带着一点懵懂神情的';
 assert.equal(act('他听完后轻轻点了点'+description+'脑袋。'),'nod');
 assert.equal(act('他把'+description+'脑袋缓缓向下点了两次。'),'nod');
 assert.equal(act('他挥了挥那只刚从宽大的外套袖口里面慢慢伸出来还被暖烘烘的布料遮住了半截指尖的手。'),'wave');
});
test('两端不跨分句硬拼，名字与普通名词不算动作部位',()=>{
 for(const text of ['他点了一杯茶，看着你的头发。','他点了一份餐。镜头切到了窗外。','他拍了张照片，胸口的挂件很漂亮。','他挥霍了很多钱，手边空空的。','他端详了片刻，杯子放在窗台。','他亲眼看到了你熟悉的脸庞。','他的头发上沾了一点糖。'])assert.equal(act(text),'',text);
});
test('普通称呼、名字和相似名词不误触发',()=>{
 for(const line of ['',null,'亲爱的，今天怎么样？','亲属关系','亲自处理','抱歉刚才没看见','保证金已经交了','保证书放在桌上','阅读器很方便','听说今天下雨','他挥霍了很多钱'])assert.equal(act(line),'',String(line));
});
test('一轮多动作按最后的动作分句选择，饮水时抿嘴不会误当偷笑',()=>{
 assert.equal(act('他先给你飞吻。随后坐回那张椅子上。'),'sit');
 assert.equal(act('早安。他把水含在嘴里抿了抿。'),'tea');
 assert.equal(act('他用手托着下巴。随后把书翻到下一页。'),'read');
});
test('整段聊天仍走原角色隔离与事件入口，没有新增模型调用',()=>{
 const a=src.indexOf('function useChatAct('),b=src.indexOf('function CompanionFloat(',a);
 assert.ok(a>0&&b>a);
 const hook=src.slice(a,b);
 assert.match(hook,/d.charId !== charId/);
 assert.match(hook,/actForText\(d.text\)/);
 assert.match(hook,/type: "pet-act"/);
 assert.doesNotMatch(hook,/callAI|runProbe/);
});
test('真正的聊天事件只驱动当前角色，清理时解绑',()=>{
 const a=src.indexOf('function useChatAct('),b=src.indexOf('function CompanionFloat(',a);assert.ok(a>0&&b>a);
 let on,cleanup;const messages=[];
 const root={addEventListener(type,fn){assert.equal(type,'companion-chat');on=fn;},removeEventListener(type,fn){assert.equal(type,'companion-chat');assert.equal(fn,on);on=null;}};
 const context=vm.createContext({window:root,actForText:act,actForChat:window.CompanionFace.actForChat,useEffect(fn){cleanup=fn();}});
 vm.runInContext(src.slice(a,b)+';globalThis.bind=useChatAct;',context);
 context.bind('c1',{current:{contentWindow:{postMessage(message){messages.push(message);}}}});
 // 事件字段照 app.js 的真实发送处核对：charId + said（说出口的话）+ act（动作描写）；旧的 text 也还认。
 const app=fs.readFileSync('js/app.js','utf8');assert.match(app,/new CustomEvent\("companion-chat", \{ detail: \{ charId, said: _said, act: _act \} \}\)/);
 on({detail:{charId:'c1',said:'你写的作业呢',act:''}});assert.equal(messages.length,0,'话里提到的动作不算');
 on({detail:{charId:'c1',said:'嗯',act:'他点了点头。'}});assert.equal(messages.length,1);assert.equal(messages[0].kind,'nod');messages.length=0;
 on({detail:{charId:'c2',text:'亲一口'}});on({detail:{charId:'c1',text:'天气很晴朗'}});assert.equal(messages.length,0);
 on({detail:{charId:'c1',text:'他亲了一下额头。'}});assert.equal(messages.length,1);assert.equal(messages[0].kind,'emotion-kiss');
 cleanup();assert.equal(on,null);
});

// 她 2026-10-24 审：说出口的话和动作描写分开认；否定、假设、问句不算
test('话里提到的动作、否定、假设、问句都不让小人动',()=>{
 const chat=window.CompanionFace.actForChat;
 const said={'你写的作业呢':'','今天学习了吗':'','你知道吗，我昨天看了本书':'','脸红什么':'','你哼什么哼':'','别跟我说再见':'','别叹气了':'','我没有拒绝你啊':'',
  '你要是敢跑，我就抱你回来':'','我们坐下来好好谈谈':'','你不准再熬夜了，晚安':'wave','早上好呀':'wave','好好好，听你的':'nod','抱抱你':'emotion-cozy','（抱住你）想你了':'emotion-cozy','*点点头*知道了':'nod'};
 for(const [t,k] of Object.entries(said))assert.equal(chat('',t),k,'说的：'+t);
 const act={'他点了杯奶茶给你':'','他转账给你520':'','他点点头':'nod','他捂着脸笑':'shy','他喝了口水，说没事':'tea','他坐在你对面没说话':'sit',
  '他回头看了你一眼':'turn','回头见':'wave','他摇头晃脑地唱歌':'emotion-dance','他别过脸':'turn','他没有点头':'','要是你再跑，他就抱住你':''};
 for(const [t,k] of Object.entries(act))assert.equal(chat(t,''),k,'动作：'+t);
});
