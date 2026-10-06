const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const scope = {window:{}, Date}; vm.runInNewContext(fs.readFileSync('js/call-camera.js','utf8'),scope); const camera = scope.window.CallCamera;
function fixture(getUserMedia) {
  const states = [], draws = [], canvas = {getContext:()=>({drawImage:(...args)=>draws.push(args)}),toDataURL:()=> 'data:image/jpeg;base64,YQ=='};
  const env = {isSecureContext:true,navigator:{mediaDevices:{getUserMedia}},document:{createElement:()=>canvas}};
  return {controller:camera.create(x=>states.push(x),env),states,draws,canvas};
}
function stream(facing='user') {
  let stops=0;const listeners={};const track={stop:()=>stops++,getSettings:()=>({facingMode:facing}),addEventListener:(k,fn)=>listeners[k]=fn,removeEventListener:k=>delete listeners[k]};
  return {getTracks:()=>[track],getVideoTracks:()=>[track],stops:()=>stops,listeners};
}
test('关闭或离场后迟到的摄像头权限结果立即释放，不能复活预览',async()=>{
  let resolve;const f=fixture(()=>new Promise(r=>resolve=r)),s=stream();const p=f.controller.open();f.controller.close();resolve(s);await p;
  assert.equal(s.stops(),1);assert.equal(f.states.at(-1).phase,'off');assert.equal(f.controller.snapshot(),null);
});
test('切前后镜头先释放旧流，结束事件也释放设备，始终只申请视频',async()=>{
  const requests=[],streams=[];const f=fixture(async args=>{requests.push(args);const s=stream(args.video.facingMode.ideal);streams.push(s);return s;});
  await f.controller.open();await f.controller.switch();assert.equal(streams[0].stops(),1);assert.equal(requests[1].video.facingMode.ideal,'environment');assert.equal(requests.every(r=>r.audio===false),true);
  streams[1].listeners.ended();assert.equal(streams[1].stops(),1);assert.equal(f.controller.snapshot(),null);
});
test('dispose 后迟到的错误/流不再更新 React，设备仍停止',async()=>{
  let resolve;const f=fixture(()=>new Promise(r=>resolve=r));const p=f.controller.open(),n=f.states.length;f.controller.dispose();const s=stream();resolve(s);await p;assert.equal(f.states.length,n);assert.equal(s.stops(),1);
});
test('同一时刻只有最新一次开启拥有设备，旧响应不能覆盖新镜头',async()=>{
  const resolves=[];const f=fixture(()=>new Promise(r=>resolves.push(r)));const p1=f.controller.open(),p2=f.controller.open('environment');const s1=stream(),s2=stream('environment');resolves[1](s2);await p2;resolves[0](s1);await p1;
  assert.equal(s1.stops(),1);assert.equal(s2.stops(),0);assert.equal(f.states.at(-1).facing,'environment');f.controller.close();assert.equal(s2.stops(),1);
});
test('真实截图按比例缩小到768，原图不镜像；预览没准备好不送空图',async()=>{
  const f=fixture(async()=>stream());await f.controller.open();assert.throws(()=>f.controller.snapshot(),/先留在输入框/);
  const video={videoWidth:1920,videoHeight:1080,readyState:2,play:()=>Promise.resolve()};f.controller.attach(video);const a=f.controller.snapshot();assert.equal(f.canvas.width,768);assert.equal(f.canvas.height,432);assert.equal(f.draws[0][0],video);assert.equal(a.imageDataUrl,'data:image/jpeg;base64,YQ==');
  f.controller.attach(null);assert.equal(video.srcObject,null);f.controller.close();
});
test('拒绝权限、不安全网页和旧壳都有可操作说明；旧壳不申请设备，新壳照常申请',async()=>{
  const f=fixture(async()=>{throw Object.assign(new Error('denied'),{name:'NotAllowedError'});});await f.controller.open();assert.match(f.states.at(-1).message,/允许此网页/);assert.equal(f.controller.snapshot(),null);
  assert.match(camera.environmentError({isSecureContext:false}),/https/);
  let count=0;const states=[];const c=camera.create(s=>states.push(s),{isSecureContext:true,webkit:{messageHandlers:{nativeMedia:{}}},navigator:{mediaDevices:{getUserMedia:()=>count++}}});await c.open();assert.equal(count,0);assert.match(states.at(-1).message,/Safari/);
  const plist=fs.readFileSync('tools/ios-shell/LisaPhone/LisaPhone/Info.plist','utf8');assert.match(plist,/NSCameraUsageDescription/,'新壳带摄像头权限');
  const swift=fs.readFileSync('tools/ios-shell/LisaPhone/LisaPhone/AppDelegate.swift','utf8');assert.match(swift,/window\.__qqShellCaps=\{camera:true\};/,'新壳把能力告诉网页');
  let n2=0;const s2=[];const c2=camera.create(s=>s2.push(s),{isSecureContext:true,__qqShellCaps:{camera:true},webkit:{messageHandlers:{nativeMedia:{}}},navigator:{mediaDevices:{getUserMedia:async()=>{n2++;throw Object.assign(new Error('x'),{name:'NotAllowedError'});}}}});await c2.open();assert.equal(n2,1,'新壳里照常申请');
});
test('新一轮只附当前一张图，历史和挂断转录不写像素；无画面正常发文字',()=>{
  const original=[{role:'user',content:'上一轮'},{role:'assistant',content:'收到'},{role:'user',content:'看这个'}],f={imageDataUrl:'data:image/jpeg;base64,YQ==',capturedAt:Date.now(),facing:'environment'};
  const result=camera.withFrame(original,f);assert.equal(result[0].imageDataUrls,undefined);assert.deepEqual(Array.from(result[2].imageDataUrls),[f.imageDataUrl]);assert.equal(original[2].imageDataUrls,undefined);assert.equal(result[2].content,'看这个');assert.match(camera.prompt(f),/后置/);assert.match(camera.prompt(null),/没有附上真实/);
  assert.equal(camera.validFrame({...f,capturedAt:Date.now()-40000}),null);assert.equal(camera.validFrame({...f,imageDataUrl:'https://not-a-frame.invalid'}),null);
});
test('单人和群视频通话共用当前帧发送；开麦和打字共用入口；布局钩子在缩小早退前',()=>{
  const app=fs.readFileSync('js/app.js','utf8'),comp=fs.readFileSync('js/components.js','utf8'),a=app.indexOf('  const callSend ='),b=app.indexOf('  const endCall =',a);assert.ok(a>0&&b>a);const send=app.slice(a,b);
  assert.match(send,/!opening && cur\.mode === "video"/);assert.match(send,/CallCamera\.withFrame\(hist, cameraFrame\)/);assert.equal((send.match(/CallCamera\.withFrame\(/g)||[]).length,2);assert.match(send,/callSystem, callMessages/);
  const start=comp.indexOf('function CallScreen('),end=comp.indexOf('function anonNightBg(',start);assert.ok(start>0&&end>start);const body=comp.slice(start,end),early=body.indexOf('if (minimized) {');assert.ok(early>0);
  assert.match(body.slice(0,early),/CallCamera\.create/);assert.match(body,/document\.hidden[\s\S]{0,70}cameraRef\.current\.close/);assert.match(body,/if \(bye \|\| minimized \|\| mode !== "video"\)/);assert.match(body,/onSend\(text\) === false/);assert.match(body,/onSend\(input\.trim\(\), actMode \? \{ act: true \} : undefined\) !== false/);assert.match(body,/return sendCall\(text, \{ \.\.\.\(extra \|\| \{\}\), cameraFrame: frame \}\);/);
  assert.doesNotMatch(send,/saveJSON|idbImgPut|MediaRecorder/);assert.match(body,/paddingBottom: COMPOSER_PAD_BOTTOM/);
});
