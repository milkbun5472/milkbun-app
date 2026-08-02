"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const Merge=require("../js/memory-event-merge.js");
const now=Date.UTC(2026,7,2,12);
const row=(id,text,extra={})=>({id,text,ts:now,source:"auto",charIds:["a"],tags:["关东煮"],...extra});

test("同角色同主题的计划与真实结果组成候选，结果条保留",()=>{
  const groups=Merge.scan([
    row("plan","Lisa 和沈屿白今晚准备去吃关东煮",{ts:now-3600000}),
    row("result","Lisa 和沈屿白后来吃了关东煮，实际最喜欢萝卜",{ts:now})
  ]);
  assert.equal(groups.length,1);
  assert.equal(groups[0].keep.id,"result");
  assert.deepEqual(groups[0].archive.map(x=>x.id),["plan"]);
});

test("不同角色、无结果、超过七天和受保护条目不进入候选",()=>{
  const result=row("result","Lisa 后来吃了关东煮，实际最喜欢萝卜");
  const groups=Merge.scan([
    row("other","Lisa 今晚准备去吃关东煮",{charIds:["b"],ts:now-1000}),
    row("old","Lisa 准备去吃关东煮",{ts:now-Merge.WINDOW_MS-1}),
    row("open","Lisa 今晚准备去吃关东煮",{open:true,ts:now-1000}),
    row("pinned","Lisa 今晚准备去吃关东煮",{pinned:true,ts:now-1000}),
    result
  ]);
  assert.equal(groups.length,0);
});

test("同一周相邻但主题不同的生活安排不会硬并",()=>{
  const groups=Merge.scan([
    row("plan","Lisa 明天准备去牙医诊所补牙",{tags:["牙医"],ts:now-1000}),
    row("result","Lisa 后来吃了关东煮，实际最喜欢萝卜",{tags:["关东煮"]})
  ]);
  assert.equal(groups.length,0);
});

test("只有泛用同标签、正文无共同事件锚点也不会合并",()=>{
  const groups=Merge.scan([
    row("plan","Lisa 明天准备去牙医诊所补牙",{tags:["生活"],ts:now-1000}),
    row("result","Lisa 后来已经买了新的冬季羽绒服",{tags:["生活"]})
  ]);
  assert.equal(groups.length,0);
});

test("自然口语的周末打算与后来完成也能进入人工预览",()=>{
  const groups=Merge.scan([
    row("plan","Lisa 周末想去新开的陶艺店做杯子",{tags:["陶艺"],ts:now-86400000}),
    row("result","Lisa 后来去了新开的陶艺店，杯子做完了",{tags:["陶艺"],ts:now})
  ]);
  assert.equal(groups.length,1);
  assert.equal(groups[0].keep.id,"result");
});

test("诊断会解释 open 安全闸，但绝不把 open 计划列为归档候选",()=>{
  const report=Merge.analyze([
    row("plan","Lisa 今晚要去吃海胆饭",{open:true,ts:now-1000}),
    row("result","Lisa 后来吃了海胆饭",{ts:now})
  ]);
  assert.equal(report.groups.length,0);
  assert.equal(report.stats.protectedOpen,1);
  assert.equal(report.stats.resolved,1);
});

test("同角色同一天但不同主题仍不会因口语扩词误合并",()=>{
  const groups=Merge.scan([
    row("plan","Lisa 周末想去剪头发",{tags:["理发"],ts:now-1000}),
    row("result","Lisa 后来买到了演唱会门票",{tags:["演唱会"],ts:now})
  ]);
  assert.equal(groups.length,0);
});
