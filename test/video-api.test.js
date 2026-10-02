const test = require('node:test'), assert = require('node:assert/strict'), vm = require('node:vm'), fs = require('node:fs'), path = require('node:path');
const src = fs.readFileSync(path.join(__dirname, '../js/video-api.js'), 'utf8');
function load(fetch) {
 const store = {}, ctx = {window:{}, cleanBaseUrl:v=>String(v||'').trim().replace(/\/+$/,''), loadJSON:(k,d)=>store[k]??d, saveJSON:(k,v)=>{store[k]=JSON.parse(JSON.stringify(v));return true;}, fetch, setTimeout,clearTimeout,AbortController,DOMException,URL,Blob,Uint8Array,TypeError,console};
 vm.createContext(ctx);vm.runInContext(src,ctx);return {api:ctx.window.VideoApi,store};
}
const response = data => ({ok:true,status:200,text:async()=>JSON.stringify(data)});
test('视频配置独立，三类模型的画质时长组合合法',()=>{
 const {api,store}=load();api.save({enabled:true,apiKey:'fixture',baseUrl:' https://api.minimaxi.com/v1/video_generation ',resolution:'1080P',duration:10});
 assert.equal(api.load().baseUrl,'https://api.minimaxi.com');assert.equal(api.load().duration,6);assert.equal(store.x_ttsApi,undefined);
 assert.equal(api.normalize({model:'I2V-01-live',resolution:'1080P',duration:10}).resolution,'720P');
 assert.equal(api.normalize({model:'MiniMax-Hailuo-02',resolution:'512P',duration:10}).duration,10);
 assert.equal(api.normalize({model:'MiniMax-Hailuo-2.3-Fast',resolution:'512P'}).resolution,'768P');
});
test('三个站点按同一视频协议提交，任务记录不含密钥；禁止重复创建',async()=>{
 for(const baseUrl of ['https://api.minimax.io','https://api.minimaxi.com','https://api.minimax.chat']){
  const sent=[],{api,store}=load(async(url,init)=>{sent.push({url,init});return response({task_id:'1234567890123456789',base_resp:{status_code:0}})});
  api.save({enabled:true,apiKey:'fixture',baseUrl});await api.create('c','data:image/png;base64,fixture','轻轻眨眼');
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
 assert.match(src,/h\(Head, \{ zh: "动态陪伴图"/);assert.match(src,/flex-1 min-h-0 overflow-y-auto px-5/);assert.match(src,/safe-area-inset-bottom\) \* 0\.4/);
 const pom=fs.readFileSync(path.join(__dirname,'../js/pomodoro.js'),'utf8');assert.match(pom,/点击陪伴画面听语音/);assert.match(pom,/tp\.toggle\("pmd-note-/);assert.doesNotMatch(pom,/VideoApi\.(create|poll)\(/);
 const screens=fs.readFileSync(path.join(__dirname,'../js/screens.js'),'utf8');assert.match(screens,/page === "apiVideo"/);assert.match(screens,/MINIMAX_API_SITES\.map/);
});
