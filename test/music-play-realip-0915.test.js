const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const app=fs.readFileSync('js/app.js','utf8');
test('网易云主播放与兜底请求均读取词法 MusicSource 的 realIP',async()=>{
 const start=app.indexOf('  const resolvePlayUrl = async song => {'),end=app.indexOf('\n  };',start)+5;
 const calls=[];const ctx={window:{},musicReady:true,musicProvider:'netease',normCookie:()=>'',neteaseApi:'https://music.invalid',fetch:async url=>{calls.push(new URL(url));return {json:async()=>({data:[{url:calls.length===1?null:'http://music.invalid/audio'}]})}}};
 vm.createContext(ctx);vm.runInContext('const MusicSource = {realIP:()=>"116.25.146.177"};\n'+app.slice(start,end)+'\nthis.play=resolvePlayUrl;',ctx);
 assert.equal(ctx.window.MusicSource,undefined);
 assert.equal(await ctx.play({source:'netease',neteaseId:'123'}),'https://music.invalid/audio');
 assert.equal(calls.length,2);for(const url of calls)assert.equal(url.searchParams.get('realIP'),'116.25.146.177');
});
