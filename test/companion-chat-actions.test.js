const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync('js/companion.js','utf8');
const window={addEventListener(){}};
vm.runInNewContext(src,{window,Date});
const act=window.CompanionFace.actForText;
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
test('普通称呼、名字和相似名词不误触发',()=>{
 for(const line of ['',null,'亲爱的，今天怎么样？','亲属关系','亲自处理','保证金已经交了','保证书放在桌上','阅读器很方便','听说今天下雨','他挥霍了很多钱'])assert.equal(act(line),'',String(line));
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
 const context=vm.createContext({window:root,actForText:act,useEffect(fn){cleanup=fn();}});
 vm.runInContext(src.slice(a,b)+';globalThis.bind=useChatAct;',context);
 context.bind('c1',{current:{contentWindow:{postMessage(message){messages.push(message);}}}});
 // 事件字段照 app.js 的真实发送处核对，保持 charId/text 这份协议。
 const app=fs.readFileSync('js/app.js','utf8');assert.match(app,/new CustomEvent\("companion-chat", \{ detail: \{ charId, text:/);
 on({detail:{charId:'c2',text:'亲一口'}});on({detail:{charId:'c1',text:'天气很晴朗'}});assert.equal(messages.length,0);
 on({detail:{charId:'c1',text:'他亲了一下额头。'}});assert.equal(messages.length,1);assert.equal(messages[0].kind,'emotion-kiss');
 cleanup();assert.equal(on,null);
});
