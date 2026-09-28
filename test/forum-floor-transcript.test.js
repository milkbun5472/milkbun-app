const test=require('node:test');const assert=require('node:assert/strict');const fs=require('fs');
const scr=fs.readFileSync('js/screens.js','utf8'),app=fs.readFileSync('js/app.js','utf8');
test('继续刷楼、回层主时给模型的楼层是整段原文（不截 60/80 字、不只给最后几层、楼中楼也在）',()=>{
 const i=scr.indexOf('function forumFloorTranscript'),j=scr.indexOf('\n}\n',i)+3;
 const forumWithPhoto=(t)=>String(t||'');const fn=new Function('forumWithPhoto',scr.slice(i,j)+';return forumFloorTranscript;')(forumWithPhoto);
 const long='知足吧你，没结清的时候问他怎么还不回家，'.repeat(5);
 const out=fn([{floor:2,authorName:'江识',content:long,replies:[{authorName:'小号',isOp:true,toName:'江识',content:'她那是过了几个星期才问押金退没退'}]}]);
 assert.ok(out.includes(long),'原文一个字不少');assert.match(out,/└ 【楼主】小号 回 江识：她那是过了几个星期才问押金退没退/);
 assert.ok(!/floors\.slice\(-14\)/.test(app));assert.match(app,/const floorLines = forumFloorTranscript\(floors\)/);assert.match(app,/forumFloorTranscript\(\[\{ \.\.\.floor, floor: null \}\]\)/);
});
test('论坛里提到她说过的话只能是真说过的意思；不再写「别照抄原话」（会被读成要自己转述、一转就走样）',()=>{const i=app.indexOf('const forumCharGrounding');const blk=app.slice(i,app.indexOf('const forumCommentProbe',i));assert.ok(!blk.includes('你本来就知道这些事；别照抄原话'));assert.match(blk,/别把她没说过的话安到她头上当论据/);assert.match(blk,/记不清她原话就别引她/);});
