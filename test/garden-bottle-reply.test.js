// 花笺那一枪（她 2026-09-16：「种花那条先做吧」）。游戏内部的规则钉在
// apps/fairy-garden/seeds.test.mjs；这一份钉【提示词与调用】那一侧。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const rd = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const host = rd('js/fairy-garden.js');
const game = rd('apps/fairy-garden/game.mjs');

function service(callAI) {
  const ctx = { React: { createElement: () => null }, WeakMap, JSON, Error, Math, String, Array, Object, Number, Boolean, isFinite,
    // ⚠️桩照【真的那一份】写：engine 的 extractJSON 读不懂时返回 null，不抛
    //   （施工规则/stub-from-the-writer.md）。照 JSON.parse 写会把「读不懂」测成异常。
    extractJSON: r => { try { return JSON.parse(String(r).replace(/```(?:json)?/gi, '').trim()); } catch (e) { return null; } }, callAI, narrativeCore: () => '共同文风', CONDESCENDING_TONE_BAN: '公共规则',
    REGISTER_FOLLOWS_SCENE: '', STOCK_REPLY_BAN: '', OVERREACH_BAN: '', ECHO_QUESTION_BAN: '',
    userName: p => (p && p.name) || '用户', loadJSON: () => null, saveJSON: () => true, useTheme: () => ({}) };
  ctx.window = ctx;
  vm.runInNewContext(host, ctx);
  return ctx.FairyGardenService;
}

test('漂流瓶回信用共同角色上下文，原信放 system，只发一次',async()=>{
 let calls=0;const svc=service(async(p,sys,messages,opts)=>{calls++;assert.match(sys,/原信内容/);assert.match(sys,/角色人设内容/);assert.match(sys,/共同文风/);assert.equal(messages[0].content,'写这封回信。');assert.equal(opts.maxTokens,65535);return '{"reply":"回应内容"}';});
 const out=await svc.bottleReply({active:{},character:{name:'甲',persona:'角色人设内容'},profile:{name:'我'},world:{day:8},bottle:{original:'原信内容',from:1}});assert.equal(out.reply,'回应内容');assert.equal(out.sender,'甲');assert.equal(calls,1);
});
test('坏返回保留原文诊断，没配置线路不调用',async()=>{
 let calls=0;const svc=service(async()=>{calls++;return '格式损坏';}),args={active:{},character:{name:'甲'},profile:{},world:{},bottle:{original:'原信',from:1}};
 await assert.rejects(svc.bottleReply(args),e=>e.detail==='格式损坏');await assert.rejects(svc.bottleReply({...args,active:null}),/配置创作线路/);assert.equal(calls,1);
});
