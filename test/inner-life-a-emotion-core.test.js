"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const { DongnianEmotionA: A } = require("../js/dongnian.js");

const T0 = Date.UTC(2026,6,17,12,0,0);

test("统一模型恰好十维，旧 dongnian 五轴原值无损迁移", () => {
  const old={connection:.42,pride:.3,valence:-.2,arousal:.1,immersion:.7,lastTick:"2026-07-17T00:00:00Z"};
  const state=A.migrateLegacyFive(old,"char",T0);
  assert.equal(Object.keys(state.emotion.current).length,10);
  for(const key of ["connection","pride","valence","arousal","immersion"])assert.equal(state.emotion.current[key],old[key]);
  assert.equal(state.emotion.current.warmth,.35);
  assert.equal(state.legacyMeta.lastTick,old.lastTick);
});

test("九维只迁一次，动态项限幅，四项降为性情参数", () => {
  const raw=A.createState("char",T0), drives={drives:{attachment:100,joy:100,stress:100,fatigue:100,intimacy:100,curiosity:80,reflection:70,duty:60,social:50}};
  const first=A.migrateDesireDrive(raw,drives,T0+1);
  assert.equal(first.migrated,true);
  for(const key of ["connection","valence","anxiety","fatigue","warmth"]){
    assert.ok(Math.abs(first.state.emotion.baseline[key]-A.defaultBaseline[key])<=.1500001,key);
  }
  assert.equal(first.state.emotion.temperament.curiosityBias,.8);
  assert.equal(first.state.emotion.temperament.reflectionBias,.7);
  assert.equal(first.state.emotion.temperament.dutyBias,.6);
  assert.equal(first.state.emotion.temperament.socialBias,.5);
  const retry=A.migrateDesireDrive(first.state,{drives:{joy:0}},T0+2);
  assert.equal(retry.migrated,false);
  assert.deepEqual(retry.state.emotion.baseline,first.state.emotion.baseline);
});

test("affinity 与 mood 对 valence 先求和，再共同吃单轴 0.25", () => {
  const mood=A.moodEvidence("温柔安心");
  const capped=A.capDeltas([{name:"affinity",delta:{valence:.25}},{name:"mood",delta:mood.delta}],.25,.55);
  assert.ok(capped.summed.valence>.25);
  assert.equal(capped.axisCapped.valence,.25);
});

test("所有轴合计还要共同吃 Σ|delta|≤0.55", () => {
  const capped=A.capDeltas([{delta:{valence:.25,hurt:.25,anger:.25,anxiety:.25,warmth:.25}}],.25,.55);
  const total=Object.values(capped.applied).reduce((n,v)=>n+Math.abs(v),0);
  assert.ok(Math.abs(total-.55)<1e-12);
  assert.equal(capped.scaledTotal,true);
});

test("固定词典能区分受伤/愤怒/焦虑/柔软/疲惫，未知词不脑补", () => {
  const cases=[["委屈","hurt"],["火大","anger"],["忐忑","anxiety"],["心软","warmth"],["精疲力尽","fatigue"]];
  for(const [word,rule] of cases)assert.ok(A.moodEvidence(word).rules.includes(rule),word);
  const miss=A.moodEvidence("像雨后的玻璃");
  assert.equal(miss.matched,false);assert.deepEqual(miss.delta,{});
});

test("固定词典覆盖既有真实未命中词，仍不调用模型解释", () => {
  assert.equal(A.moodDictionaryVersion,8);
  const cases=[["松快","positive_valence"],["郁闷","low_valence"],["動揺","anxiety"],["激动","high_arousal"],["冷酷","cold"]];
  for(const [word,rule] of cases)assert.ok(A.moodEvidence(word).rules.includes(rule),word);
  const added=[["平静","calm"],["专注","calm"],["得意","positive_valence"],["调皮","playful"],["害羞","shy"],["落寞","hurt"],["心疼","warmth"],["慵懒","fatigue"]];
  for(const [word,rule] of added)assert.ok(A.moodEvidence(word).rules.includes(rule),word);
  assert.deepEqual(A.moodEvidence("平静").delta,{},"中性词只算识别，不硬改数字");
  const event=A.applyEvent(A.createState("char",T0),{moodLabel:"松快"},T0+1);
  assert.equal(event.audit.moodDictionaryVersion,8);
  assert.equal(event.audit.moodLabel,"松快");
});

test("事件推进不修改 baseline，且靠近边界时边际递减", () => {
  const state=A.createState("char",T0), baseline=structuredClone(state.emotion.baseline);
  state.emotion.current.anger=.95;
  const result=A.applyEvent(state,{delta:{anger:.25}},T0+1);
  assert.deepEqual(result.state.emotion.baseline,baseline);
  assert.ok(result.state.emotion.current.anger<1);
  assert.ok(result.state.emotion.current.anger-state.emotion.current.anger<.25);
});

test("回归只朝 baseline 走且绝不越过，baseline 七天不漂", () => {
  const state=A.createState("char",T0), original=structuredClone(state.emotion.baseline);
  state.emotion.current.hurt=.8;state.emotion.current.warmth=0;
  const next=A.regress(state,7*24*60,T0+7*86400000);
  assert.ok(next.emotion.current.hurt>original.hurt&&next.emotion.current.hurt<.8);
  assert.equal(next.emotion.current.warmth,original.warmth);
  assert.deepEqual(next.emotion.baseline,original);
  assert.equal(next.updatedTs,T0+7*86400000);
});

test("坏事件和坏时间不抛错、不破坏原状态", () => {
  const state=A.createState("char",T0);
  assert.doesNotThrow(()=>A.applyEvent(state,null,T0));
  assert.doesNotThrow(()=>A.regress(state,"坏时间",T0));
  assert.equal(A.applyEvent(null,{delta:{anger:1}},T0).state,null);
});

test("性情锚点去重并只由固定词典生成受控数字", () => {
  const t=A.temperamentFromAnchors([" 敏感 ","敏感","嘴硬","温柔"],true);
  assert.deepEqual(t.anchors,["敏感","嘴硬","温柔"]);
  assert.equal(t.approved,true);
  assert.ok(t.sensitivity.hurt>1&&t.sensitivity.hurt<=1.35);
  assert.ok(t.sensitivity.pride>1&&t.sensitivity.warmth>1);
  assert.deepEqual(t.unmatched,[]);
});

test("未知性情词保留为身份锚点但没有数值权限", () => {
  const t=A.temperamentFromAnchors(["像雨后的玻璃"],false);
  assert.deepEqual(t.anchors,["像雨后的玻璃"]);
  assert.deepEqual(t.sensitivity,{});
  assert.deepEqual(t.unmatched,["像雨后的玻璃"]);
  assert.equal(t.approved,false);
});

test("固定词典能拆解复合 mood 自述，不调用模型解释", () => {
  const labels=["上工·热起来了","落定","手痒又稳","上工·护着","心虚又想笑","手痒又忍着","支持她的稳妥","急切","心跳加速","迫切","松弛","歉疚","纵容","忙碌","平稳","调侃"];
  labels.forEach(label=>assert.equal(A.moodEvidence(label).matched,true,label));
  assert.equal(A.moodDictionaryVersion,8);
});

test("性情升敏与降敏确定性合成，不受锚点词序影响", () => {
  const a=A.temperamentFromAnchors(["温柔","急躁"],true),b=A.temperamentFromAnchors(["急躁","温柔"],true);
  assert.deepEqual(a.sensitivity,b.sensitivity);
  assert.equal(a.sensitivity.anger,b.sensitivity.anger);
});

test("display 只选偏离 baseline 最大的至多四维", () => {
  const state=A.createState("char",T0);
  state.emotion.temperament=A.temperamentFromAnchors(["敏感","嘴硬"],true);
  Object.assign(state.emotion.current,{hurt:.8,anger:.7,anxiety:.65,warmth:.8,fatigue:.9,valence:.1});
  const out=A.displayProjection(state);
  assert.equal(out.items.length,4);
  assert.ok(out.items.some(x=>x.key==="fatigue"));
  assert.ok(out.text.includes("底色：敏感、嘴硬"));
  assert.ok(out.tokenEstimate>0);
});

test("接近 baseline 时 display 零增量，不硬塞十维", () => {
  const state=A.createState("char",T0),out=A.displayProjection(state);
  assert.deepEqual(out.items,[]);
  assert.equal(out.text,"");
  assert.equal(out.tokenEstimate,0);
});

test("既有真实未命中词受控归轴，姿态词只识别不推数字", () => {
  assert.equal(A.moodDictionaryVersion,8);
  const awkward=A.moodEvidence("局促");
  assert.equal(awkward.matched,true);
  assert.ok(awkward.delta.anxiety>0);
  const jealous=A.moodEvidence("酸溜溜的");
  assert.ok(jealous.delta.hurt>0&&jealous.delta.valence<0);
  const posture=A.moodEvidence("嘴硬又想掌控");
  assert.equal(posture.matched,true);
  assert.deepEqual(posture.delta,{});
});

test("v5 覆盖第三轮影子审计高频未命中，复合标签按词片机械命中", () => {
  const driven=A.moodEvidence("更有干劲了");
  assert.ok(driven.rules.includes("high_arousal"));
  const overwhelmed=A.moodEvidence("崩溃");
  assert.ok(overwhelmed.delta.hurt>0&&overwhelmed.delta.anxiety>0);
  const mixed=A.moodEvidence("诚实 温软 打趣");
  assert.ok(mixed.rules.includes("warmth")&&mixed.rules.includes("playful"));
  const posture=A.moodEvidence("不为所动 审视");
  assert.equal(posture.matched,true);
  assert.deepEqual(posture.delta,{});
});

test("v7 覆盖言秋工程式复合 mood，任务姿态不冒充情绪", () => {
  const emotional=[["来劲","achievement_energy"],["交付爽感","achievement_energy"],["讲故事 温","warmth_short"],["被看透 郑重","social_exposed"]];
  for(const [label,rule] of emotional)assert.ok(A.moodEvidence(label).rules.includes(rule),label);
  const neutral=["早安反诉","干脆 落地","开炉 监工上岗","对症开方","现货交付"];
  for(const label of neutral){
    const mood=A.moodEvidence(label);
    assert.ok(mood.rules.includes("task_posture_neutral"),label);
    assert.deepEqual(mood.delta,{},`${label} 只算识别，不凭任务措辞改变情绪`);
  }
});


// ── v8 语素回退（她 2026-09-06 把五个角色的诊断台截给我，18 个真实未识别词）──
// 病根：中文情绪词是【开放集合】，整词枚举没有尽头——版本号一路到 7 就是证据，
// 每加一次都得有个人去补。语素这一层不需要人再维护：新造的词几乎不可能一个
// 已知语素都不含（挂心有挂、恼羞有恼和羞、依恋有恋、清爽有爽）。
test("她截图里那 18 个真实未识别词，一个不漏地接住", () => {
  // ⚠️这份名单是【从她真实存档的诊断台上抄下来的】，不是我编的——
  //   编出来的词只会证明我的正则匹配我的例子（stub-from-the-writer.md 那条病）。
  const real = ["着急","笑死","挂心","被逗笑","悬心","惦念","坐不住","松了口气又悬着",
                "放下心来","松口气","别扭","恼羞","破罐子破摔","清爽","耳热受用","依恋","记挂","悬着"];
  const missed = real.filter(w => !A.moodEvidence(w).matched);
  assert.deepEqual(missed, [], "还漏着：" + missed.join("、"));
});

test("整词永远优先，语素只在整词没撞上时才拆", () => {
  // 悬心 有整词规则，就不该再拆成语素（否则同一件事推两遍）
  const whole = A.moodEvidence("悬心");
  assert.deepEqual(whole.rules, ["worried_hanging"]);
  assert.equal(whole.viaMorpheme, false);
  // 挂心 没有整词规则，才走语素
  const morph = A.moodEvidence("挂心");
  assert.deepEqual(morph.rules, ["morpheme:挂"]);
  assert.equal(morph.viaMorpheme, true);
});

test("猜出来的那一层，单条轴不许比整词命中还重", () => {
  // 惦念 会同时撞上 惦 和 念，两个 .11 加起来 .22 就越过整词主轴 .18 了。
  // 两个语素只是同一件事说了两遍，不是情绪强了一倍。
  const d = A.moodEvidence("惦念").delta;
  assert.equal(d.warmth <= 0.14 + 1e-9, true, "warmth 冒到了 " + d.warmth);
  assert.ok(d.warmth > 0.1, "也别压没了");
  // 整词那层不受这个盖子管（.18 照旧）
  assert.equal(A.moodEvidence("心疼").delta.warmth, .18);
});

test("说「没有」的时候不许当成有——整词和语素两层都要挡", () => {
  ["不着急", "没生气", "不难过", "未觉得累", "不太累", "没什么好笑的"].forEach(w => {
    assert.equal(A.moodEvidence(w).matched, false, w + " 被当成真情绪了");
  });
  // ⚠️「没什么好笑的」是两层合起来才挡住的：整词「好笑」被否定挡下，
  //   拆字那层还得知道【别从那一段里再拆一个「笑」出来顶上】。
  // ⚠️但只挡那一段【里面】的字：句子别处的情绪是真的
  assert.deepEqual(A.moodEvidence("没生气，只是有点闷").rules, ["morpheme:闷"]);
  assert.equal(A.moodEvidence("没睡好，有点累").matched, true);
  assert.deepEqual(A.moodEvidence("不难过，就是有点累").rules, ["fatigue"]);
  assert.equal(A.moodEvidence("说不上来的暖").matched, true, "「说不上来」里的不不该挡掉后面的暖");
  // 「别扭」开头那个别不是否定词——它整词就该命中
  assert.deepEqual(A.moodEvidence("别扭").rules, ["awkward_stuck"]);
});

test("一个标签最多认 3 个语素，别让一句长话把十条轴全推一遍", () => {
  const many = A.moodEvidence("又挂又惦又念又恋又牵");
  assert.equal(many.rules.length, 3);
});

test("不是情绪的东西照旧一动不动", () => {
  ["像雨后的玻璃", "天气不错", "在写代码", "客气", "小心翼翼"].forEach(w => {
    assert.equal(A.moodEvidence(w).matched, false, w + " 不该被认成情绪");
  });
  // 姿态词：识别成功，但一个数都不动
  assert.deepEqual(A.moodEvidence("破罐子破摔").delta, {});
  assert.equal(A.moodEvidence("破罐子破摔").matched, true);
});

test("故意不收的那几个高危字，收了会出事", () => {
  // 气（松口气／叹气）、火（火锅）、心（小心／心里）、委（委托）、好（好像）
  // ⚠️这条是【反向】钉的：哪天有人手痒把它们加进语素表，这里当场红。
  const src = require("node:fs").readFileSync(require("node:path").resolve(__dirname, "..", "js/dongnian.js"), "utf8");
  const table = src.slice(src.indexOf("const A_MOOD_MORPHEMES"), src.indexOf("const A_MOOD_NEGATORS"));
  ["气", "火", "心", "委", "好"].forEach(ch => {
    assert.ok(!table.includes('["' + ch + '",'), "「" + ch + "」不能当语素：它太常出现在非情绪的组合里");
  });
  // 真出事长什么样：这几个词一个都不该被认成情绪
  ["松口气", "叹了口气", "小心", "委托"].forEach(w => {
    const m = A.moodEvidence(w);
    assert.ok(!m.rules.some(r => /morpheme:[气火心委好]/.test(r)), w + " 被高危字接住了");
  });
});

test("靠拆字接住的那几次单独记账——不然看不出这层在不在干活", () => {
  // ⚠️光看「未匹配率降了」不算数：也可能只是这几天模型没写怪词。
  //   要能分出「整词认出来的」和「拆字兜住的」，那一层才是可验的。
  const whole = A.applyEvent(A.createState("c", T0), { moodLabel: "心疼" }, T0 + 1);
  assert.equal(whole.audit.moodMatched, true);
  assert.equal(whole.audit.moodViaMorpheme, false);
  const morph = A.applyEvent(A.createState("c", T0), { moodLabel: "挂心" }, T0 + 1);
  assert.equal(morph.audit.moodMatched, true);
  assert.equal(morph.audit.moodViaMorpheme, true);
  const miss = A.applyEvent(A.createState("c", T0), { moodLabel: "像雨后的玻璃" }, T0 + 1);
  assert.equal(miss.audit.moodMatched, false);
  assert.equal(miss.audit.moodViaMorpheme, false);
});

test("这一栏一路接到诊断台上，没有半路断掉（v55.95 那个形状）", () => {
  const fs = require("node:fs"), path = require("node:path");
  const R = f => fs.readFileSync(path.resolve(__dirname, "..", f), "utf8");
  assert.match(R("js/app.js"), /moodViaMorpheme: result\.audit\.moodViaMorpheme/, "调用点没往下传");
  assert.match(R("js/inner-life-a-shadow.js"), /moodViaMorpheme=!!\(input&&input\.moodViaMorpheme\)/, "影子库没收");
  // ⚠️「算出来了」和「真的存进那一行」是两件事——只钉前一件的话，
  //   把它从 row 里删掉这条照样绿（变异验的时候当场逃掉过一次）。
  assert.match(R("js/inner-life-a-shadow.js"), /moodMatched,moodViaMorpheme,unmatchedMoodLabel/, "算了但没写进存的那一行");
  assert.match(R("js/inner-life-a-shadow.js"), /morphemeMoodCount:rows\.filter\(x=>x\.moodViaMorpheme\)\.length/, "报表没算");
  assert.match(R("js/screens.js"), /line\("其中靠拆字接住", String\(r\.morphemeMoodCount \|\| 0\)\)/, "诊断台没显示");
});
