const test = require('node:test'), assert = require('node:assert/strict'), vm = require('node:vm'), fs = require('node:fs'), path = require('node:path');
const src = fs.readFileSync(path.join(__dirname, '../js/video-api.js'), 'utf8');
function load(fetch) {
 const store = {}, ctx = {window:{}, cleanBaseUrl:v=>String(v||'').trim().replace(/\/+$/,''), loadJSON:(k,d)=>store[k]??d, saveJSON:(k,v)=>{store[k]=JSON.parse(JSON.stringify(v));return true;}, fetch, setTimeout,clearTimeout,AbortController,DOMException,URL,Blob,Uint8Array,TypeError,console};
 vm.createContext(ctx);vm.runInContext(src,ctx);return {api:ctx.window.VideoApi,store};
}
const response = data => ({ok:true,status:200,text:async()=>JSON.stringify(data)});
test('视频配置独立，三类模型的画质时长组合合法',()=>{
 const {api,store}=load();api.save({model:'MiniMax-Hailuo-2.3-Fast',enabled:true,apiKey:'fixture',baseUrl:' https://api.minimaxi.com/v1/video_generation ',resolution:'1080P',duration:10});
 assert.equal(api.load().baseUrl,'https://api.minimaxi.com');assert.equal(api.load().duration,6);assert.equal(store.x_ttsApi,undefined);
 assert.equal(api.normalize({model:'I2V-01-live',resolution:'1080P',duration:10}).resolution,'720P');
 assert.equal(api.normalize({model:'MiniMax-Hailuo-02',resolution:'512P',duration:10}).duration,10);
 assert.equal(api.normalize({model:'MiniMax-Hailuo-2.3-Fast',resolution:'512P'}).resolution,'768P');
});
test('三个站点按同一视频协议提交，任务记录不含密钥；禁止重复创建',async()=>{
 for(const baseUrl of ['https://api.minimax.io','https://api.minimaxi.com','https://api.minimax.chat']){
  const sent=[],{api,store}=load(async(url,init)=>{sent.push({url,init});return response({task_id:'1234567890123456789',base_resp:{status_code:0}})});
  api.save({model:'MiniMax-Hailuo-2.3-Fast',enabled:true,apiKey:'fixture',baseUrl});await api.create('c','data:image/png;base64,fixture','轻轻眨眼');
  assert.equal(sent[0].url,baseUrl+'/v1/video_generation');assert.equal(JSON.parse(sent[0].init.body).first_frame_image,'data:image/png;base64,fixture');
  assert.equal(api.job('c').taskId,'1234567890123456789');assert.equal(api.job('c').apiKey,undefined);await assert.rejects(api.create('c','data:image/png;base64,fixture','动作'),/已有视频任务/);assert.equal(sent.length,1);
 }
});
test('恢复任务只查询，不重发；换站阻止查询并保留原任务',async()=>{
 const sent=[],{api}=load(async(url,init)=>{sent.push({url,init});return response({status:'Processing',base_resp:{status_code:0}})});api.save({apiKey:'fixture'});
 api.patchMap(api.keys.JOBS,'a',{taskId:'123',baseUrl:'https://api.minimax.io'});await api.query('a');assert.equal(sent[0].init.method,'GET');assert.match(sent[0].url,/query\/video_generation\?task_id=123/);
 api.save({baseUrl:'https://api.minimaxi.com'});await assert.rejects(api.query('a'),/切回/);assert.equal(sent.length,1);assert.equal(api.job('a').taskId,'123');
});
test('创建超时、网络错误留待核对，不能静默重试收费',async()=>{
 let count=0;const {api}=load(async()=>{count++;throw new TypeError('Failed to fetch')});api.save({enabled:true,apiKey:'fixture'});
 await assert.rejects(api.create('a','data:image/png;base64,fixture','动作'),/连接失败/);assert.equal(api.job('a').status,'Submitting');await assert.rejects(api.create('a','data:image/png;base64,fixture','动作'),/已有视频任务/);assert.equal(count,1);
});
test('接口业务失败、生成失败都明确返回，不冒充生成成功',async()=>{
 const {api}=load(async()=>response({status:'Fail',base_resp:{status_code:0,status_msg:'生成失败'}}));api.save({apiKey:'fixture'});api.patchMap(api.keys.JOBS,'a',{taskId:'123',baseUrl:'https://api.minimax.io'});await assert.rejects(api.query('a'),/生成失败/);assert.equal(api.job('a').status,'Fail');
});
test('大整数任务编号保持原值',async()=>{
 const {api}=load(async()=>({ok:true,status:200,text:async()=>' {"task_id":1234567890123456789,"base_resp":{"status_code":0}}'}));api.save({enabled:true,apiKey:'fixture'});await api.create('a','data:image/png;base64,fixture','动作');assert.equal(api.job('a').taskId,'1234567890123456789');
});
test('新编辑页标准 Head/单滚动区与安全区，语音点播不创建视频',()=>{
 assert.match(src,/h\(Head, \{ zh: "动态形象"/);assert.match(src,/flex-1 min-h-0 overflow-y-auto px-5/);assert.match(src,/safe-area-inset-bottom\) \* 0\.4/);
 const pom=fs.readFileSync(path.join(__dirname,'../js/pomodoro.js'),'utf8');assert.match(pom,/戳一戳陪伴画面/);assert.match(pom,/tp\.toggle\("pmd-note-/);assert.doesNotMatch(pom,/VideoApi\.(create|poll)\(/);
 const screens=fs.readFileSync(path.join(__dirname,'../js/screens.js'),'utf8');assert.match(screens,/page === "apiVideo"/);assert.match(screens,/MINIMAX_API_SITES\.map/);
});

test('H3 每个整数时长与画质；旧配置保留，新配置默认4秒',()=>{
 const {api}=load();assert.equal(api.load().model,'MiniMax-H3');assert.equal(api.load().duration,4);
 for(let n=4;n<=15;n++)assert.equal(api.normalize({model:'MiniMax-H3',duration:n,resolution:'2K'}).duration,n);
 assert.equal(api.normalize({model:'MiniMax-H3',duration:3}).duration,4);
 assert.equal(api.normalize({model:'MiniMax-H3-Max',duration:4,resolution:'2K'}).duration,5);
 assert.equal(api.normalize({model:'MiniMax-H3-Max',resolution:'480P'}).resolution,'480P');
 assert.equal(api.normalize({model:'MiniMax-Hailuo-2.3-Fast',duration:10}).duration,10);
});
test('H3三站V2首帧提交，改模型后原任务仍查询V2',async()=>{
 for(const baseUrl of ['https://api.minimax.io','https://api.minimaxi.com','https://api.minimax.chat']){
  const sent=[],{api}=load(async(url,init)=>{sent.push({url,init});return response(init.method==='POST'?{task_id:'h3-task'}:{task:{status:'running'}})});
  api.save({enabled:true,apiKey:'fixture',baseUrl,model:'MiniMax-H3',duration:4});await api.create('a','data:image/png;base64,fixture','动作');
  const b=JSON.parse(sent[0].init.body);assert.equal(sent[0].url,baseUrl+'/v2/video_generation');assert.equal(b.duration,4);assert.equal(b.content[1].role,'first_frame');assert.equal(b.content[1].image_url.url,'data:image/png;base64,fixture');assert.equal(b.first_frame_image,undefined);
  api.save({model:'MiniMax-Hailuo-2.3-Fast'});await api.query('a');assert.equal(sent[1].url,baseUrl+'/v2/query/video_generation/h3-task');assert.equal(api.job('a').status,'running');assert.equal(sent.length,2);
 }
});
test('H3失败取消及成功缺URL均保留任务、不重复收费',async()=>{
 for(const status of ['failed','cancelled','succeeded']){
  const sent=[],{api}=load(async(url)=>{sent.push(url);return response({task:{status,error:{message:'fixture failure'}}})});api.save({apiKey:'fixture'});api.patchMap(api.keys.JOBS,'a',{taskId:'h3',protocol:'v2',baseUrl:'https://api.minimax.io'});
  await assert.rejects(api.query('a'),status==='succeeded'?/下载地址/:/fixture failure/);assert.equal(api.job('a').taskId,'h3');assert.equal(sent.length,1);
 }
});

test('任务状态区分未确认、排队、失败与生成完成但下载中断',()=>{
 const {api}=load();assert.match(api.taskState({status:'Submitting'},false).title,/提交未确认/);assert.match(api.taskState({status:'Submitting'},true).title,/正在提交/);
 assert.match(api.taskState({taskId:'a',status:'queued'},true).title,/排队/);assert.match(api.taskState({taskId:'a',status:'running'},true).title,/生成动作/);
 assert.equal(api.taskState({taskId:'a',status:'failed'},false).title,'生成失败');assert.equal(api.taskState({taskId:'a',status:'cancelled'},false).title,'任务已取消');
 assert.match(api.taskState({taskId:'a',status:'succeeded',lastError:'下载失败'},false).title,/视频尚未保存/);
 assert.match(api.taskState({taskId:'a',status:'running',lastError:'断网'},false).title,/生成结果未确认/);
 assert.match(api.taskState({taskId:'a',draftRef:'pvideo_a'},false).title,/生成完成/);
});
test('提交连接失败的提示持久化，刷新仍是未确认且禁止重复提交',async()=>{
 const {api}=load(async()=>{throw new TypeError('Failed to fetch')});api.save({enabled:true,apiKey:'fixture'});await assert.rejects(api.create('a','data:image/png;base64,fixture','动作'));
 assert.match(api.job('a').lastError,/连接失败/);assert.match(api.taskState(api.job('a'),false).title,/提交未确认/);await assert.rejects(api.create('a','data:image/png;base64,fixture','动作'),/已有视频任务/);
});

test('下载连接失败保留原URL和任务，只查询GET，不重复生成',async()=>{
 const sent=[],{api}=load(async(url,init)=>{sent.push({url,init});if(url.includes('/v2/query/'))return response({task:{status:'succeeded',content:{url:'https://cdn.fixture.invalid/video.mp4'}}});throw new TypeError('Load failed');});api.save({apiKey:'fixture'});api.patchMap(api.keys.JOBS,'a',{taskId:'original',protocol:'v2',baseUrl:'https://api.minimax.io'});
 await assert.rejects(api.query('a'),/视频下载连接失败/);assert.equal(api.job('a').downloadUrl,'https://cdn.fixture.invalid/video.mp4');assert.equal(api.job('a').taskId,'original');assert.equal(api.job('a').status,'succeeded');assert.equal(sent[0].init.method,'GET');assert.equal(sent[1].init.headers,undefined);assert.match(api.job('a').lastError,/手动保存/);
});
test('导入原任务只接受已完成任务和真实视频内容',async()=>{
 const {api}=load();await assert.rejects(api.importTaskVideo('a',new Blob(['fake'])),/还没有确认/);api.patchMap(api.keys.JOBS,'a',{taskId:'original',status:'succeeded'});await assert.rejects(api.importTaskVideo('a',new Blob(['this is not a video'])),/文件内容不是/);assert.equal(api.job('a').draftRef,undefined);
});

test('复制下载链接留在编辑页，复用公共复制，不再导航原生壳',()=>{assert.match(src,/await copyText\(record.downloadUrl\)/);assert.doesNotMatch(src,/href: record.downloadUrl/);assert.match(src,/aria-label": "原视频下载链接"/);});
