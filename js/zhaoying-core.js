// 照影（她 2026-10-22「就照影吧，做吧」）：让角色做性格小测，看着他一题题选，心声就是选的理由，留档在题目下面。
// 这一份是开机就在的那一半：题库、计分、存档、给聊天用的那一行。页面在 zhaoying.js（点开才装）。
//
// ⚠️题目是我们自己写的（她：「这个我们自己研究一下」）。几条规矩：
//   · 题面是日常场景，不出现术语（不说「外向」「依恋」），选项不让人一眼看出在测什么；
//   · 计分全在代码里：模型只管选，结果不交给它判——不然谁测都是同一个热门类型；
//   · 结果只是「他做过这套、那次选了这些」这件事，不是贴在他身上的标签（她一直不喜欢标签顶掉人设）。
(function (g) {
  "use strict";
  const KEY = "x_zhaoying";

  // ── 题库 ─────────────────────────────────────────────────
  // 每题 opts：[{ t: 选项文字, s: { 维度: 分 } }]
  const T = [];

  // 1. 四个字母那套：每个维度 4 题，两两相对
  T.push({
    id: "mbti", name: "四个字母", sub: "常说的 MBTI，十六种里的哪一种",
    axes: [["E", "I"], ["S", "N"], ["T", "F"], ["J", "P"]],
    qs: [
      { q: "难得空出一整个周末，你最想", opts: [{ t: "约几个朋友出去，热闹一点", s: { E: 1 } }, { t: "谁也不约，一个人待着把电充满", s: { I: 1 } }] },
      { q: "聚会上来了一群不认识的人", opts: [{ t: "挺好，正好认识几个新朋友", s: { E: 1 } }, { t: "找个认识的人待在旁边，等着差不多了就走", s: { I: 1 } }] },
      { q: "心里有事没想通的时候", opts: [{ t: "找人说出来，说着说着就理清了", s: { E: 1 } }, { t: "自己先闷着想清楚，想好了再说", s: { I: 1 } }] },
      { q: "一整天都在跟人打交道，晚上回到家", opts: [{ t: "还挺来劲，想再跟谁聊两句", s: { E: 1 } }, { t: "累，只想关门谁都别找我", s: { I: 1 } }] },
      { q: "照着说明书组装一样东西", opts: [{ t: "一步一步照着来，心里踏实", s: { S: 1 } }, { t: "扫一眼大概，剩下的边装边琢磨", s: { N: 1 } }] },
      { q: "跟人讲一件刚发生的事，你更常", opts: [{ t: "从头到尾讲清楚：几点、在哪、谁说了什么", s: { S: 1 } }, { t: "直接说这件事让你想到了什么", s: { N: 1 } }] },
      { q: "发呆的时候脑子里多半是", opts: [{ t: "待会儿要做的事、今天吃什么", s: { S: 1 } }, { t: "要是当初怎样、以后会怎样", s: { N: 1 } }] },
      { q: "你更信", opts: [{ t: "亲眼见过、亲手试过的", s: { S: 1 } }, { t: "直觉，说不上来但就是觉得对", s: { N: 1 } }] },
      { q: "朋友哭着跟你说被人欺负了，你第一反应", opts: [{ t: "先弄清楚怎么回事，帮他想怎么办", s: { T: 1 } }, { t: "先抱住他，让他哭完", s: { F: 1 } }] },
      { q: "要做一个对别人有影响的决定，你更看重", opts: [{ t: "道理上站不站得住", s: { T: 1 } }, { t: "大家心里好不好受", s: { F: 1 } }] },
      { q: "有人当面说你做错了", opts: [{ t: "他说得对就改，没什么", s: { T: 1 } }, { t: "嘴上不说，心里会难受一阵", s: { F: 1 } }] },
      { q: "吵架吵到最后，你更想要", opts: [{ t: "把对错掰扯清楚", s: { T: 1 } }, { t: "两个人别再难受了", s: { F: 1 } }] },
      { q: "出门旅行之前", opts: [{ t: "行程、住哪、几点出发都排好", s: { J: 1 } }, { t: "订个票就走，到了再说", s: { P: 1 } }] },
      { q: "有件事明天截止", opts: [{ t: "早几天就弄完了", s: { J: 1 } }, { t: "最后一晚上爆发", s: { P: 1 } }] },
      { q: "你的桌面／房间", opts: [{ t: "东西都有固定位置", s: { J: 1 } }, { t: "看着乱，但我知道东西在哪", s: { P: 1 } }] },
      { q: "计划好的事临时被打乱", opts: [{ t: "有点烦，得重新安排一下", s: { J: 1 } }, { t: "无所谓，换一个也挺好", s: { P: 1 } }] }
    ]
  });

  // 2. 靠近与退开（依恋）：焦虑 A、回避 V 两条轴
  T.push({
    id: "attach", name: "靠近与退开", sub: "在亲近的人面前，是往前靠还是往后退",
    qs: [
      { q: "喜欢的人半天没回消息", opts: [{ t: "该干嘛干嘛，他忙完会回", s: {} }, { t: "隔一会儿看一眼手机", s: { A: 1 } }, { t: "开始想是不是我说错话了", s: { A: 2 } }, { t: "那我也不回了", s: { V: 1, A: 1 } }] },
      { q: "对方说「我们聊聊」", opts: [{ t: "好啊，聊什么", s: {} }, { t: "心一下子提起来", s: { A: 2 } }, { t: "第一反应是想躲开", s: { V: 2 } }] },
      { q: "跟一个人越来越近的时候", opts: [{ t: "挺开心的，自然而然", s: {} }, { t: "怕哪天他就不这样了", s: { A: 2 } }, { t: "会想往后退一点，留点地方给自己", s: { V: 2 } }] },
      { q: "很难过的那天晚上", opts: [{ t: "会找最亲的那个人说", s: {} }, { t: "想找他，又怕打扰他", s: { A: 1, V: 1 } }, { t: "自己扛过去，不想让人看见", s: { V: 2 } }] },
      { q: "对方说想每天都见你", opts: [{ t: "好啊", s: {} }, { t: "心里很高兴，又有点不敢信", s: { A: 1 } }, { t: "有点喘不过气", s: { V: 2 } }] },
      { q: "吵完架冷了两天", opts: [{ t: "我会先去找他说开", s: {} }, { t: "一直在等他来找我，等得很煎熬", s: { A: 2 } }, { t: "过一阵就淡了，不太想去碰", s: { V: 2 } }] },
      { q: "「你对我是真心的吗」这种话", opts: [{ t: "很少问，也不太需要问", s: {} }, { t: "会想反复确认", s: { A: 2 } }, { t: "被问到会有点不自在", s: { V: 1 } }] },
      { q: "把自己最狼狈的一面给对方看", opts: [{ t: "可以，他是自己人", s: {} }, { t: "怕他看到了就不喜欢我了", s: { A: 2 } }, { t: "不会，那是我自己的事", s: { V: 2 } }] },
      { q: "一个人过一辈子", opts: [{ t: "也能过，但有人陪更好", s: {} }, { t: "想想就害怕", s: { A: 2 } }, { t: "好像也挺自在", s: { V: 2 } }] },
      { q: "对方说「我需要一点自己的时间」", opts: [{ t: "好，你忙", s: {} }, { t: "是不是我哪里不好", s: { A: 2 } }, { t: "正好，我也是", s: { V: 1 } }] }
    ]
  });

  // 3. 心意怎么给：五种（陪伴 Q、言语 W、礼物 G、行动 D、触碰 K）
  T.push({
    id: "love", name: "心意怎么给", sub: "你最会用哪一种方式对人好，也最吃哪一种",
    qs: [
      { q: "对方生日，你最想", opts: [{ t: "空出一整天只陪他", s: { Q: 1 } }, { t: "写一段很长的话给他", s: { W: 1 } }, { t: "挑一样他念叨很久的东西", s: { G: 1 } }] },
      { q: "累了一天回家，最想对方", opts: [{ t: "把饭做好了等你", s: { D: 1 } }, { t: "什么都不说先抱一下", s: { K: 1 } }, { t: "坐下来听你说今天", s: { Q: 1 } }] },
      { q: "最让你心里一软的是", opts: [{ t: "他说「你今天很好看」", s: { W: 1 } }, { t: "他顺路给你带了你爱吃的", s: { G: 1 } }, { t: "他牵了你的手", s: { K: 1 } }] },
      { q: "道歉的时候你更会", opts: [{ t: "把要说的话认认真真说出来", s: { W: 1 } }, { t: "默默把惹他不高兴的事做好", s: { D: 1 } }, { t: "买点什么哄他", s: { G: 1 } }] },
      { q: "最受不了的是", opts: [{ t: "在一起却各玩各的手机", s: { Q: 1 } }, { t: "他从来不夸你", s: { W: 1 } }, { t: "很久没抱过了", s: { K: 1 } }] },
      { q: "他生病了，你会", opts: [{ t: "请假陪在旁边", s: { Q: 1 } }, { t: "跑去买药煮粥", s: { D: 1 } }, { t: "一直握着他的手", s: { K: 1 } }] },
      { q: "收到哪样最开心", opts: [{ t: "一张手写的小纸条", s: { W: 1 } }, { t: "一个他记得你随口提过的小东西", s: { G: 1 } }, { t: "他帮你把一直拖着的事办了", s: { D: 1 } }] },
      { q: "异地的晚上", opts: [{ t: "开着视频一起做各自的事", s: { Q: 1 } }, { t: "睡前发一大段想你", s: { W: 1 } }, { t: "寄个包裹给他", s: { G: 1 } }] },
      { q: "看电影的时候", opts: [{ t: "靠在一起", s: { K: 1 } }, { t: "看完要聊很久", s: { Q: 1 } }, { t: "提前把零食饮料都买好", s: { D: 1 } }] },
      { q: "你心里「他很爱我」的证据是", opts: [{ t: "他说过的那些话", s: { W: 1 } }, { t: "他为我做过的那些事", s: { D: 1 } }, { t: "他留下的那些东西", s: { G: 1 } }, { t: "他抱我的样子", s: { K: 1 } }] }
    ]
  });

  // 4. 三观：四条轴（自我 Me／大家 Us、守规矩 R／看情况 X、求稳 St／敢闯 Ad、理想 Id／现实 Re）
  T.push({
    id: "values", name: "心里那杆秤", sub: "三观：什么事在你这儿更重",
    axes: [["Me", "Us"], ["R", "X"], ["St", "Ad"], ["Id", "Re"]],
    qs: [
      { q: "家里希望你回老家，你自己想留在外面", opts: [{ t: "留下，日子是自己的", s: { Me: 1 } }, { t: "回去，家里人更要紧", s: { Us: 1 } }] },
      { q: "团队拿了奖，大半是你的功劳", opts: [{ t: "该是我的就说清楚", s: { Me: 1 } }, { t: "算大家的，不提也行", s: { Us: 1 } }] },
      { q: "深夜没车的路口，红灯", opts: [{ t: "等绿灯", s: { R: 1 } }, { t: "看没车就过", s: { X: 1 } }] },
      { q: "朋友求你帮个小忙，但这忙有点违规", opts: [{ t: "不帮，规矩就是规矩", s: { R: 1 } }, { t: "看情况，伤不着人就帮", s: { X: 1 } }] },
      { q: "一份稳定的工作，一个前途很好但可能失败的机会", opts: [{ t: "稳的", s: { St: 1 } }, { t: "去试试", s: { Ad: 1 } }] },
      { q: "手里有一笔闲钱", opts: [{ t: "存起来", s: { St: 1 } }, { t: "拿去做点什么", s: { Ad: 1 } }] },
      { q: "一件事很有意义但不赚钱", opts: [{ t: "值得做", s: { Id: 1 } }, { t: "先把饭吃饱再说", s: { Re: 1 } }] },
      { q: "「人应该为了喜欢的事活着」", opts: [{ t: "对", s: { Id: 1 } }, { t: "说得轻巧", s: { Re: 1 } }] }
    ]
  });

  // 5. 像哪种动物：猫 Ca、狗 Do、狼 Wo、狐 Fo、兔 Ra、熊 Be
  T.push({
    id: "animal", name: "像哪种动物", sub: "动物塑：要是变成一只动物，你是哪只",
    qs: [
      { q: "到了一个新地方", opts: [{ t: "先找个角落观察", s: { Ca: 1, Ra: 1 } }, { t: "到处跑跑看看", s: { Do: 1 } }, { t: "先认清谁说了算", s: { Wo: 1, Fo: 1 } }] },
      { q: "有人来摸你的头", opts: [{ t: "看心情，可能躲开", s: { Ca: 1 } }, { t: "开心，再来", s: { Do: 1, Ra: 1 } }, { t: "你谁啊", s: { Wo: 1 } }] },
      { q: "你更擅长", opts: [{ t: "察言观色，见机行事", s: { Fo: 1 } }, { t: "护着自己人", s: { Wo: 1, Be: 1 } }, { t: "让人想抱抱", s: { Ra: 1, Be: 1 } }] },
      { q: "一个人的下午", opts: [{ t: "晒太阳睡觉", s: { Ca: 1, Be: 1 } }, { t: "等谁回来", s: { Do: 1 } }, { t: "琢磨点小心思", s: { Fo: 1 } }] },
      { q: "被惹毛了", opts: [{ t: "冷着脸走开", s: { Ca: 1 } }, { t: "当场咬回去", s: { Wo: 1 } }, { t: "表面笑笑，记着", s: { Fo: 1 } }, { t: "缩起来，自己难受", s: { Ra: 1 } }] },
      { q: "喜欢一个人的时候", opts: [{ t: "绕着他转，藏不住", s: { Do: 1 } }, { t: "嘴上不说，但会出现在他附近", s: { Ca: 1 } }, { t: "认定了就一直守着", s: { Wo: 1 } }] },
      { q: "朋友眼里的你", opts: [{ t: "靠得住，像座山", s: { Be: 1 } }, { t: "聪明，有点难猜", s: { Fo: 1 } }, { t: "软软的，容易受惊", s: { Ra: 1 } }] },
      { q: "冬天", opts: [{ t: "囤好吃的，窝起来", s: { Be: 1 } }, { t: "照样出去跑", s: { Do: 1, Wo: 1 } }, { t: "找最暖的那块地方", s: { Ca: 1, Ra: 1 } }] },
      { q: "一群人里，你通常是", opts: [{ t: "带头的", s: { Wo: 1 } }, { t: "气氛组", s: { Do: 1 } }, { t: "出主意的", s: { Fo: 1 } }, { t: "被照顾的", s: { Ra: 1 } }] },
      { q: "最怕", opts: [{ t: "被关起来", s: { Wo: 1, Ca: 1 } }, { t: "被丢下", s: { Do: 1, Ra: 1 } }, { t: "被看穿", s: { Fo: 1 } }, { t: "没吃的", s: { Be: 1 } }] }
    ]
  });

  // ── 结果 ─────────────────────────────────────────────────
  const MBTI_NAME = {
    INTJ: "安静的谋划家", INTP: "爱钻牛角尖的思考者", ENTJ: "天生带队的人", ENTP: "爱抬杠的点子王",
    INFJ: "看得很深的守望者", INFP: "心里有片海的理想派", ENFJ: "照顾所有人的那个", ENFP: "停不下来的热情鬼",
    ISTJ: "说到做到的老实人", ISFJ: "默默把事做好的守护者", ESTJ: "把日子管得井井有条的人", ESFJ: "热络周到的张罗者",
    ISTP: "动手比说话快的人", ISFP: "安静的感受派", ESTP: "说走就走的行动派", ESFP: "走到哪热闹到哪"
  };
  const ATTACH = {
    secure: ["安心型", "靠得近也站得稳：信得过对方，也信得过自己"],
    anxious: ["想要确认型", "很在乎，所以常常想再确认一次"],
    avoid: ["留一扇门型", "亲近可以，但心里要给自己留个地方"],
    fearful: ["想靠近又怕型", "想要人陪，又怕靠得太近会受伤"]
  };
  const LOVE = { Q: "陪着你", W: "说给你听", G: "带给你", D: "替你做", K: "抱住你" };
  const VALUES = { Me: "先顾好自己", Us: "先顾好大家", R: "守规矩", X: "看情况", St: "求稳", Ad: "敢闯", Id: "信理想", Re: "看现实" };
  const ANIMAL = {
    Ca: ["猫", "有自己的脾气，愿意靠近的时候才靠近"], Do: ["狗", "热乎乎的，喜欢就绕着转"], Wo: ["狼", "认定了就守着，对外人冷"],
    Fo: ["狐狸", "聪明，心思多，不太好猜"], Ra: ["兔子", "软，容易受惊，被护着会很乖"], Be: ["熊", "慢吞吞的，可靠，抱起来很暖"]
  };
  function tally(test, picks) {
    const sc = {};
    (picks || []).forEach((p, i) => { const q = test.qs[i]; const o = q && q.opts[p]; if (o) Object.keys(o.s).forEach(k => { sc[k] = (sc[k] || 0) + o.s[k]; }); });
    return sc;
  }
  // 平分时取前一个（题数是偶数的那几套才可能平）
  const pickAxis = (sc, a, b) => ((sc[a] || 0) >= (sc[b] || 0) ? a : b);
  function resultOf(testId, picks) {
    const test = byId(testId); if (!test) return null;
    const sc = tally(test, picks);
    if (testId === "mbti") {
      const code = test.axes.map(([a, b]) => pickAxis(sc, a, b)).join("");
      return { code, title: MBTI_NAME[code] || code, line: code };
    }
    if (testId === "attach") {
      const n = test.qs.length, A = (sc.A || 0) / n, V = (sc.V || 0) / n;
      const k = A >= 0.7 && V >= 0.5 ? "fearful" : A >= 0.7 ? "anxious" : V >= 0.6 ? "avoid" : "secure";
      return { code: k, title: ATTACH[k][0], line: ATTACH[k][1] };
    }
    if (testId === "love") {
      const order = Object.keys(LOVE).sort((a, b) => (sc[b] || 0) - (sc[a] || 0));
      return { code: order[0], title: "最会" + LOVE[order[0]], line: "其次是" + LOVE[order[1]] };
    }
    if (testId === "values") {
      const tags = test.axes.map(([a, b]) => VALUES[pickAxis(sc, a, b)]);
      return { code: test.axes.map(([a, b]) => pickAxis(sc, a, b)).join("-"), title: tags.join(" · "), line: "" };
    }
    if (testId === "animal") {
      const order = Object.keys(ANIMAL).sort((a, b) => (sc[b] || 0) - (sc[a] || 0));
      return { code: order[0], title: "像一只" + ANIMAL[order[0]][0], line: ANIMAL[order[0]][1] };
    }
    return null;
  }
  function byId(id) { return T.find(t => t.id === id) || null; }

  // ── 存档：{ [who]: [{ id, testId, ts, picks:[], whys:[], code, title, line }] }，who＝角色 id 或 "me" ──
  const loadAll = () => { try { const v = typeof loadJSON === "function" ? loadJSON(KEY, {}) : JSON.parse(localStorage.getItem(KEY) || "{}"); return v && typeof v === "object" ? v : {}; } catch (e) { return {}; } };
  const saveAll = v => { try { if (typeof saveJSON === "function") saveJSON(KEY, v); else localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {} };
  function recordsOf(who, testId) {
    const l = (loadAll()[who] || []).slice().sort((a, b) => b.ts - a.ts);
    return testId ? l.filter(r => r.testId === testId) : l;
  }
  function addRecord(who, rec) {
    const all = loadAll();
    all[who] = [Object.assign({ id: "zy_" + Date.now().toString(36) }, rec), ...(all[who] || [])].slice(0, 60);
    saveAll(all);
  }
  function delRecord(who, id) { const all = loadAll(); all[who] = (all[who] || []).filter(r => r.id !== id); saveAll(all); }

  const dateZh = ts => { const d = new Date(ts); return (d.getMonth() + 1) + "月" + d.getDate() + "日"; };
  const optText = (test, i, p) => { const o = test.qs[i] && test.qs[i].opts[p]; return o ? o.t : ""; };

  // 聊天时他知道的那一行（她 2026-10-22：「就他能看到结果并且知道自己选了啥」）：
  //   每套只摆最近一次，带上那次每题选了什么；更早的只报个结果。写的是「你做过这些」，不是「你是谁」。
  function chatNote(charId) {
    const l = recordsOf(charId); if (!l.length) return "";
    const seen = {};
    const lines = [];
    l.forEach(r => {
      const t = byId(r.testId); if (!t) return;
      if (seen[r.testId]) { seen[r.testId].push(dateZh(r.ts) + "「" + r.title + "」"); return; }
      seen[r.testId] = [];
      const picks = (r.picks || []).map((p, i) => (i + 1) + "." + optText(t, i, p).slice(0, 14)).join("；");
      lines.push({ t, r, picks });
    });
    return "你做过照影里的小测（这是你自己做过的事，结果只是那次测出来的，不用照着它演）：\n" + lines.map(x =>
      "·「" + x.t.name + "」" + dateZh(x.r.ts) + " 测出「" + x.r.title + "」" + (seen[x.t.id].length ? "（更早几次：" + seen[x.t.id].slice(0, 3).join("、") + "）" : "") + "。那次你选的：" + x.picks).join("\n");
  }

  // 让他做一套题的那一段（照影页里调 runProbe）
  function askInstruction(test, meName, prev) {
    return "你在手机上做一套小测「" + test.name + "」（" + test.sub + "）。一题一题照你自己真实的样子选——不是挑看起来好的那个，也不是猜出题人想要什么。"
      + "每题选一个选项，why 写你选的时候心里冒出来的那一句：第一人称，短，照你平时想事情的样子。"
      + (meName ? "这是「" + meName + "」让你做的，她会看到你每一题选了什么、为什么。" : "")
      + (prev && prev.length ? "\n你以前做过这套：" + prev.slice(0, 3).map(r => dateZh(r.ts) + "测出「" + r.title + "」").join("；") + "。这次照你现在的样子答，变了就变了，没变也不用硬改。" : "")
      + "\n题目：\n" + test.qs.map((q, i) => (i + 1) + ". " + q.q + "\n" + q.opts.map((o, j) => "   " + j + ") " + o.t).join("\n")).join("\n");
  }
  const ASK_SCHEMA = "{\"answers\":[{\"i\":1,\"pick\":0,\"why\":\"选的时候心里那句\"}]}";
  function readAnswers(test, d) {
    const arr = Array.isArray(d && d.answers) ? d.answers : Array.isArray(d) ? d : [];
    const picks = [], whys = [];
    test.qs.forEach((q, i) => {
      const a = arr.find(x => x && Number(x.i) === i + 1) || arr[i] || {};
      let p = Number(a.pick); if (!(p >= 0 && p < q.opts.length)) p = Math.floor(Math.random() * q.opts.length);
      picks.push(p); whys.push(String(a.why || "").trim().slice(0, 80));
    });
    return { picks, whys };
  }

  // 聊天里那张卡（转发过去的）
  function card(m) {
    const h = g.React && g.React.createElement; if (!h) return null;
    const z = (m && m.zy) || {};
    return h("div", { "data-wk": "zyshare", style: { width: 210, borderRadius: 10, overflow: "hidden", background: "#f6f1ea", border: "1px solid #d9cdbd", fontFamily: "inherit" } },
      h("div", { style: { padding: "10px 12px 4px", fontSize: 10.5, letterSpacing: ".2em", color: "#9a8a76" } }, "照影 · " + (z.testName || "")),
      h("div", { style: { padding: "0 12px", fontSize: 17, color: "#3b332a", lineHeight: 1.4 } }, z.title || ""),
      z.line ? h("div", { style: { padding: "4px 12px 0", fontSize: 12, color: "#6d6255", lineHeight: 1.5 } }, z.line) : null,
      h("div", { style: { padding: "8px 12px 10px", fontSize: 11, color: "#9a8a76" } }, "—— " + (z.who || "") + " 测的"));
  }

  g.Zhaoying = { TESTS: T, byId, resultOf, recordsOf, addRecord, delRecord, chatNote, askInstruction, ASK_SCHEMA, readAnswers, dateZh, optText };
  g.ZhaoyingCard = function (p) { return card(p && p.m); };
  // 主屏图标：一面小圆镜
  g.GZhaoying = function (p) {
    const h = g.React && g.React.createElement; if (!h) return null;
    const kids = [h("circle", { key: 1, cx: 12, cy: 10, r: 6.5 }), h("path", { key: 2, d: "M12 16.5V21M9 21h6M9.5 8.2a3 3 0 0 1 2.5-1.2" })];
    if (typeof g.Svg === "function") return h(g.Svg, p, kids);
    return h("svg", { width: (p && p.size) || 24, height: (p && p.size) || 24, viewBox: "0 0 24 24", fill: "none", stroke: (p && p.color) || "currentColor", strokeWidth: 1.6, strokeLinecap: "round" }, kids);
  };
})(typeof window !== "undefined" ? window : globalThis);
