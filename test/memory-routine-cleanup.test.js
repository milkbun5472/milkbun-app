"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const R=require("../js/memory-routine-cleanup.js");
const now=Date.UTC(2026,7,2,12), old=now-R.MIN_AGE_MS-1;
const row=(id,text,extra={})=>({id,text,source:"auto",ts:old,a:1,open:false,pinned:false,surfaceState:"active",...extra});

test("七天前低情绪的明确日常流水只进入人工预览",()=>{
  const r=R.analyze([row("meal","Lisa 昨晚吃了粥，然后洗澡睡觉")],now);
  assert.equal(r.groups.length,1);assert.equal(r.groups[0].archive[0].id,"meal");
});

test("open、置顶、高情绪和七天内条目永远受保护",()=>{
  const r=R.analyze([
    row("open","Lisa 今晚吃了粥",{open:true}),row("pin","Lisa 昨晚吃了粥",{pinned:true}),
    row("emo","Lisa 昨晚吃了粥",{a:2}),row("new","Lisa 昨晚吃了粥",{ts:now-1000})
  ],now);
  assert.equal(r.groups.length,0);assert.equal(r.stats.protectedOpen,1);assert.equal(r.stats.protectedPinned,1);
});

test("关系、偏好、健康、承诺和里程碑不因含日常动作被当流水",()=>{
  const texts=["Lisa 第一次和他吃了晚饭","Lisa 最喜欢晚上喝咖啡","Lisa 答应今晚一起吃饭","Lisa 生病后晚上吃了药","Lisa 昨晚吵架后回家"];
  const r=R.analyze(texts.map((x,i)=>row(String(i),x)),now);
  assert.equal(r.groups.length,0);assert.equal(r.stats.durable,texts.length);
});

test("没有真实时间锚或日常动作的普通事实不乱入",()=>{
  const r=R.analyze([row("fact","Lisa 的杯子是蓝色"),row("time","Lisa 昨晚想起一首歌")],now);
  assert.equal(r.groups.length,0);
});
