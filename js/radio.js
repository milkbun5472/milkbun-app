// ============================================================
// 电台 —— 手机外面那个还在运行的世界（她 2026-09-10 定案，第一版范围见仓库根
// `电台-第一版范围-2026-09-10.md`）
//
// 这个功能的命根子是一句话：**世界在她不开 app 的时候照样在播。**
// 所以骨架上有一条铁的分工，别的都可以商量，这一条不行：
//
//   ┌ 代码定：今天哪个频率有台、信号多强、此刻播到第几圈第几条、一条多长、一圈什么顺序
//   └ 模型定：台叫什么、播什么、广告是什么
//
// 反过来做（生成的时候顺便决定「今天有没有」、存一个 lastIndex 记「上次听到哪」）
// 就会得到一台【她一打开才开始播、她一关就停】的收音机——那不是电台，那是点播。
//
// ⚠️第二条铁的：**电台里所有「现在几点」只许问 `radioNow()`。**
// 打磨期要把时间调快（她：不可能等好几个小时才体验到下一条），做法是
// 只改「现在几点」这一个输入、逻辑一个字都不改——能做到这件事的前提就是入口只有一个。
//
// ⚠️第三条：**掷约束，不掷答案**（施工规则/bans-make-it-dumber.md）。
// 临时台不许由代码从一张写死的表里挑（旧货交易／气象海况／戏曲选段…）——
// 她 2026-09-10 当场拦下来的就是这个：「如果只是我们写的很杂，那还是有想不到的层面，
// 可能模型本身能写出很出色的随机台。」那张表等于用代码顶替想象力，天花板永远是我们
// 当天能想到的那十几个词。改成掷几条互相独立的轴：地板是代码的，天花板是模型的。
// ============================================================
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.Radio = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const S = v => String(v == null ? "" : v);
  const N = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
  const LS = (() => { try { return typeof localStorage !== "undefined" ? localStorage : null; } catch (e) { return null; } })();

  // ------------------------------------------------------------
  // 一、时间：整个电台唯一的「现在几点」
  // ------------------------------------------------------------
  // 🔴 打磨期把它改成 60（一分钟顶一小时），打磨完改回 1。登记在 屎山台账-2026-09-06.md。
  const RADIO_TIME_SCALE = 1;
  // 🔴 打磨期：时间遥控器那一栏（跳一小时／跳一天／读数）画在电台页底下。
  //   她 2026-09-10：「实验期间肯定得把所有时间段都开放给我，不然我不可能要等好几个小时
  //   才能体验到下一条找 bug。等打磨差不多再把时间顺序给我放回来。」
  //   打磨完改成 false 就收起来。同样登记在 屎山台账-2026-09-06.md。
  const RADIO_DEV = true;
  const CLOCK_KEY = "x_radioClock";
  // 虚拟钟的锚。刷新一次页面也要接得上——不存的话，加速期每次重开都把虚拟时刻打回原形。
  let _anchor = null;
  function _saveAnchor() { try { if (LS) LS.setItem(CLOCK_KEY, JSON.stringify(_anchor)); } catch (e) {} }
  function clockAnchor() {
    if (_anchor) return _anchor;
    let s = null;
    try { s = JSON.parse((LS && LS.getItem(CLOCK_KEY)) || "null"); } catch (e) {}
    if (s && Number.isFinite(s.real) && Number.isFinite(s.virt)) { _anchor = { real: s.real, virt: s.virt }; return _anchor; }
    const t = Date.now();
    _anchor = { real: t, virt: t };
    _saveAnchor();
    return _anchor;
  }
  function radioNow() {
    const a = clockAnchor();
    return Math.round(a.virt + (Date.now() - a.real) * RADIO_TIME_SCALE);
  }
  // 遥控器三个键。跳完立刻重新落锚，所以跳过之后时间照样自己往前走（不是停在那一刻）。
  function devJump(ms) { _anchor = { real: Date.now(), virt: radioNow() + N(ms, 0) }; _saveAnchor(); return radioNow(); }
  function devSet(ms) { _anchor = { real: Date.now(), virt: N(ms, Date.now()) }; _saveAnchor(); return radioNow(); }
  function devReset() { const t = Date.now(); _anchor = { real: t, virt: t }; try { if (LS) LS.removeItem(CLOCK_KEY); } catch (e) {} return t; }
  const devShifted = () => { const a = clockAnchor(); return Math.abs(a.virt - a.real) > 60000 || RADIO_TIME_SCALE !== 1; };

  const dayKey = t => new Date(N(t, Date.now())).toDateString();
  const hourOf = t => new Date(N(t, Date.now())).getHours();

  // ------------------------------------------------------------
  // 二、种子：同一个台、同一天，问几次都是同一个答案
  // ------------------------------------------------------------
  // ⚠️不许用 Math.random。她中午拧到 98.7 有台，晚上再拧还得是同一件事；
  //   重渲染一次换一个答案的话，这个世界就没有「在」这回事了。
  // ⚠️也不许跟 calEvAutoColor / avatarSeedHash / ttsCacheKey 那几个哈希合并：
  //   那几个的输出是【冻住的契约】（日历颜色、头像长相、缓存键），换个算法全库变样；
  //   这一个的输出没人看得见，只用来决定「今天有没有」。形状像，契约不是同一件事。
  // ⚠️搬去公共那一层了（js/axes.js）。同一个哈希活在两处，改一处必然漏一处——
  //   2026-09-10 那次 fmix32 的漏收尾就是在这儿修的，公共之后只修得起一遍。
  const seed01 = function () { return Axes.seed01.apply(null, arguments); };
  const seedPick = (list, ...parts) => (Array.isArray(list) && list.length) ? list[Math.floor(seed01.apply(null, parts) * list.length) % list.length] : null;

  // ------------------------------------------------------------
  // 三、频段：槽位比台多
  // ------------------------------------------------------------
  // 她和 gpt 都点了这一条：**空频率也应该存在**。一拧就是台、台台有人说话，
  // 那是频道列表，不是收音机。空的那几格是这台机器可信的一半。
  const SLOTS = [87.6, 89.1, 90.4, 92.0, 93.7, 95.2, 96.8, 98.7, 100.1, 101.5, 103.3, 105.6, 107.4];
  const freqText = f => N(f, 0).toFixed(1);

  // ------------------------------------------------------------
  // 四、今天这个台在不在、信号多强
  // ------------------------------------------------------------
  // 三种台：
  //   resident 常驻——这片地方常年就在的，天天都在
  //   window   时段——一天里只有某几个小时才在，别的时候那一格就是空的
  //   drift    漂移——来来去去。**不销毁**：今天在不在还是问种子，
  //            所以六天以后你在 98.7 可能又听到那个声音（她要的就是这件事）
  const KIND = { RESIDENT: "resident", WINDOW: "window", DRIFT: "drift" };
  const DRIFT_DENSITY = 0.3;

  function inWindow(st, now) {
    const w = (st && st.window) || {};
    const from = N(w.from, 0), to = N(w.to, 24), hr = hourOf(now);
    if (from === to) return true;
    return from < to ? (hr >= from && hr < to) : (hr >= from || hr < to);
  }
  function onAirToday(st, now) {
    if (!st || !st.id) return false;
    if (st.kind === KIND.WINDOW) return inWindow(st, now);
    if (st.kind === KIND.DRIFT) {
      if (N(st.bornAt, 0) > N(now, 0)) return false;
      return seed01(st.id, dayKey(now), "onair") < N(st.density, DRIFT_DENSITY);
    }
    return true;
  }
  // 0..1。低于 SIGNAL_ROUGH 就该整句整句地丢字——那一层是代码做的质感，不花钱也不用模型编。
  const SIGNAL_ROUGH = 0.45;
  function signalToday(st, now) {
    if (!st || !onAirToday(st, now)) return 0;
    const r = seed01(st.id, dayKey(now), "sig");
    if (st.kind === KIND.RESIDENT) return 0.75 + r * 0.25;
    if (st.kind === KIND.WINDOW) return 0.6 + r * 0.4;
    return 0.25 + r * 0.75;
  }

  // 整条频段今天长什么样。槽位是固定的，台挂在槽位上，剩下的就是空频。
  function dialToday(world, now) {
    const list = (world && Array.isArray(world.stations)) ? world.stations : [];
    return SLOTS.map(f => {
      const st = list.filter(x => x && Math.abs(N(x.freq, -1) - f) < 0.05).find(x => onAirToday(x, now)) || null;
      return { freq: f, station: st, signal: st ? signalToday(st, now) : 0 };
    });
  }
  // 这一格今天是空的，但种子说「这儿本来该有东西」——就是该去掷一个临时台的时候。
  function driftDue(world, freq, now) {
    const list = (world && Array.isArray(world.stations)) ? world.stations : [];
    if (list.some(x => x && Math.abs(N(x.freq, -1) - N(freq, -1)) < 0.05)) return false;
    return seed01("slot", freqText(freq), dayKey(now)) < 0.34;
  }

  // ------------------------------------------------------------
  // 五、一圈：顺序和位置都由代码定
  // ------------------------------------------------------------
  // ⚠️位置**永远从时间算出来**，一处都不许存 lastIndex。
  //   存了就等于「她关掉的时候它停在那儿等她」——电台不会等人。
  //   漂移台隔六天回来也走同一条路，所以它自然是「一直在播」，不是「暂停了六天」。
  const CPS = 4.2;   // 中文 TTS 大约每秒四个字多一点
  function secOf(text) {
    const n = S(text).replace(/\s/g, "").length;
    if (!n) return 3;
    return Math.max(3, Math.round(n / CPS + 1.4));
  }
  // 报时那一条要说【真的几点】，所以模型给的是模板、代码来填。填不了就退回一句能用的。
  function timeText(st, now) {
    const d = new Date(N(now, Date.now()));
    const hh = d.getHours(), mm = d.getMinutes();
    const tpl = S(st && st.timeCall);
    if (tpl && tpl.indexOf("{时}") >= 0) return tpl.replace(/\{时\}/g, String(hh)).replace(/\{分\}/g, String(mm));
    return "现在时间，" + hh + "点" + (mm < 10 ? "零" : "") + mm + "分。";
  }

  // 报时格子的量尺：随便挑一个两位数时刻，只为算长度用（见 assembleLoop 里那段）
  const TIME_GAUGE = new Date(2000, 0, 1, 12, 34, 0, 0).getTime();
  // 广告的出场顺序：每天洗一次牌，然后一圈一条按顺序转。
  // ⚠️不许用「按圈数掷种子」挑广告——那样一圈总长就没有周期了，
  //   而下面那个「此刻在第几圈」正是靠周期才能一步算出来（否则要从零点一圈一圈数到现在）。
  function adOrder(st, dayK, n) {
    const idx = [];
    for (let i = 0; i < n; i++) idx.push(i);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(seed01(st && st.id, dayK, "adshuffle", i) * (i + 1));
      const t = idx[i]; idx[i] = idx[j]; idx[j] = t;
    }
    return idx;
  }
  // 每圈顺序**只部分浮动**：整圈打乱的话，「每天这个点都是它」这件事就没了，
  // 而那件事正是重复带来的唯一好处。所以只做两件事：整体转一格、再换一对相邻的。
  function floatOrder(items, st, dayK, round) {
    const a = (Array.isArray(items) ? items : []).slice();
    if (a.length < 2) return a;
    const rot = round % a.length;
    const out = a.slice(rot).concat(a.slice(0, rot));
    const j = Math.floor(seed01(st && st.id, dayK, round, "swap") * (out.length - 1));
    const t = out[j]; out[j] = out[j + 1]; out[j + 1] = t;
    return out;
  }
  // 一圈的骨架是代码写死的：片头 → 内容 → 广告 → 内容 → 报时。
  // 广告插在节目【中间】，不是攒在一起播——攒在一起的那种是播客，不是电台。
  function assembleLoop(st, items, dayK, round, now) {
    const content = floatOrder((Array.isArray(items) ? items : []).map(S).filter(Boolean), st, dayK, round);
    const ads = (st && Array.isArray(st.ads) ? st.ads : []).map(S).filter(Boolean);
    const out = [];
    const push = (kind, text) => { const t = S(text).trim(); if (t) out.push({ kind: kind, text: t, sec: secOf(t) }); };
    push("sign", st && st.signOn);
    const half = Math.ceil(content.length / 2);
    content.slice(0, half).forEach(t => push("talk", t));
    if (ads.length) push("ad", ads[adOrder(st, dayK, ads.length)[round % ads.length]]);
    content.slice(half).forEach(t => push("talk", t));
    // ⚠️报时那一格的【时长】按一个固定长度的样子算，不按此刻这句真有多少字。
    //   报时的字数一天里是变的（「9点5分」和「23点47分」差好几个字），
    //   跟着它变的话一圈总长就跟着此刻变，而位置又是从一圈总长算出来的——
    //   于是「此刻在哪儿」会依赖「此刻在哪儿」。念的还是真时间，只有格子是固定的。
    out.push({ kind: "time", text: timeText(st, now), sec: secOf(timeText(st, TIME_GAUGE)) });
    return out;
  }
  // 一天里这个台是几点开播的。常驻/漂移从零点起；时段台从它自己那个钟点起，
  // 跨午夜的（23→5）在凌晨要往回退一天，否则算出来的位置是负的。
  function anchorFor(st, now) {
    const d = new Date(N(now, Date.now()));
    d.setHours(0, 0, 0, 0);
    let a = d.getTime();
    if (st && st.kind === KIND.WINDOW && st.window) {
      a += N(st.window.from, 0) * 3600000;
      if (N(now, 0) < a) a -= 86400000;
    }
    return a;
  }
  // 此刻播到哪儿。一圈的总长每圈都可能不一样（广告不一样长），所以老老实实一圈一圈往前走——
  // 一天七十来圈，这点循环不值一提，换来的是「不会慢慢错开」。
  function whereIs(st, items, now, dayK) {
    const day = dayK || dayKey(now);
    const list = (Array.isArray(items) ? items : []).map(S).filter(Boolean);
    if (!st || !list.length) return null;
    // 一圈总长每圈不一样（广告不一样长），但**每 ads.length 圈重复一次**——
    // 所以拿这一叠圈当一个大周期，一步就能除出来在第几个大周期、再往里走最多几圈。
    // （一圈一圈从零点数到现在也算得对，但那是每次渲染跑上千次循环。）
    const cyc = Math.max(1, (st.ads && st.ads.filter(Boolean).length) || 0);
    const anchor = anchorFor(st, now);
    const totals = [];
    for (let r = 0; r < cyc; r++) totals.push(assembleLoop(st, list, day, r, now).reduce((a, x) => a + Math.max(1, N(x.sec, 3)), 0));
    const superTotal = totals.reduce((a, b) => a + b, 0);
    if (superTotal <= 0) return null;
    const el = Math.max(0, (N(now, 0) - anchor) / 1000);
    const big = Math.floor(el / superTotal);
    let pos = el - big * superTotal, r = 0;
    while (r < cyc - 1 && pos >= totals[r]) { pos -= totals[r]; r++; }
    const round = big * cyc + r;
    const loop = assembleLoop(st, list, day, round, now);
    let startedAt = anchor + (big * superTotal + totals.slice(0, r).reduce((a, b) => a + b, 0)) * 1000;
    for (let i = 0; i < loop.length; i++) {
      const sec = Math.max(1, N(loop[i].sec, 3));
      if (pos < sec) return { round: round, i: i, into: pos, item: loop[i], loop: loop, startedAt: startedAt };
      pos -= sec;
    }
    const last = loop.length - 1;
    return { round: round, i: last, into: 0, item: loop[last], loop: loop, startedAt: startedAt };
  }

  // 信号差就该丢字。这一层是代码做的质感：不花钱、不用模型编，而且丢在哪儿也是种子定的——
  // 同一句话这一分钟丢的地方，下一分钟还是那儿（闪来闪去的杂讯是动画，不是信号）。
  function roughen(text, signal, seedKey) {
    const s = S(text);
    const sig = N(signal, 1);
    if (!s || sig >= SIGNAL_ROUGH) return s;
    const bad = Math.min(1, (SIGNAL_ROUGH - sig) / SIGNAL_ROUGH);
    let out = "", i = 0;
    while (i < s.length) {
      if (seed01(seedKey, i) < bad * 0.14) {
        out += "…";
        i += 1 + Math.floor(seed01(seedKey, i, "run") * 4);
      } else { out += s.charAt(i); i++; }
    }
    return out;
  }

  // 空频不是没有声音。偶尔漏进来的那一秒，用的是【已经生成过的】某一句——
  // 不多花一分钱，而且它听起来就该像是从别处飘过来的。
  function leakLine(days, freq, now) {
    const pool = [];
    const d = days && typeof days === "object" ? days : {};
    Object.keys(d).forEach(k => {
      const st = d[k] && d[k].st;
      if (st) Object.keys(st).forEach(id => (Array.isArray(st[id]) ? st[id] : []).forEach(x => pool.push(S(x))));
    });
    if (!pool.length) return "";
    const minute = Math.floor(N(now, 0) / 60000);
    if (seed01("leak", freqText(freq), minute) > 0.22) return "";
    const line = seedPick(pool, "leakpick", freqText(freq), minute) || "";
    const cut = Math.floor(seed01("leakcut", freqText(freq), minute) * Math.max(1, line.length - 6));
    return line.slice(cut, cut + 9);
  }

  // ------------------------------------------------------------
  // 六、写台的那一半：轴、地板、三张单子
  // ------------------------------------------------------------
  // 这一段一个字都不许写成「今天的台是 XX 类型」。见文件开头第三条铁的。
  // ⚠️「允许无聊——电台大部分时间是无聊的，那正是它可信的原因」这一句**删掉了**，
  //   不是在后面补一句「但也要好听」（施工规则/no-yes-unless.md：说错了就删掉重写）。
  //   言秋 2026-09-10 一句话点破：**可信≠想听，第一版只做了前一个**。
  //   模型很听话，于是我得到了一台忠实执行「可信的无聊」的收音机。
  //   真正该说的是下面那句：平淡可以，空转不行——每一条都得有个具体的东西钩着人。
  const RADIO_FLOOR = [
    "【这是要被念出口的话，不是写在纸上的文案】",
    "念的人对着话筒，不知道有几个人在听，也不打算讨好谁。所以：一句话说完就说完；",
    "允许废话、允许重复、允许说到一半改口、允许念错一个字再纠回来。",
    "**但每一条都得有一个具体的东西**——一个数字、一个地名、一件今天真发生的事、",
    "一个没说完的缺口。平淡可以，空转不行：通篇都是「今天也是平常的一天」那种句子，",
    "听的人没有任何理由再拧回来。",
    "",
    "【最容易替这个台开口的那一族】所有电台文案的公摊部分：夜色、城市的某个角落、",
    "愿你、如果你也还醒着、我们下期再见。认它只靠一句判据：**这句话换到任何一个台都成立吗？**",
    "成立的话它就不是这个台的。那就说这个台今天真正要说的那句——一件具体的事、一个具体的数字、",
    "一个地名、一家店、一个门牌号、一件说了也没用的小事。",
    "",
    "⚠️拦的是「电台该说什么」替这个台开口，不是拦煽情本身。这个台本来就爱押韵、爱说漂亮话、",
    "爱骂人、爱插科打诨的，那就照它本来的样子写足。"
  ].join("\n");

  // 四条轴。物理的那条可以列举，内容的三条只许写【形状】——
  // 写成类别（渔民/货车司机/睡不着的人）就等于替它想好了答案，她 2026-09-10 点名不要这个。
  const AXES = [
    { key: "who", zh: "谁在说话", opts: [
      "一个把这件事当职业在做的人，做了很多年",
      "一个根本不该拿着话筒的人",
      "不止一个人，而且他们并不合拍",
      "没有人在说话，只有一台机器在念稿",
      "说话的人不知道有人在听",
      "稿子在念，人不在——他今天心不在焉"
    ] },
    { key: "for", zh: "这东西为谁存在", opts: [
      "为一小撮必须听到它才能干活的人",
      "为某一个具体的人，其余人只是恰好听见",
      "为一件早就结束了的事，只是还没人来关掉",
      "为了把东西卖出去，而且它并不掩饰这一点",
      "谁也不为，只是有人想说话",
      "为了让某些人知道另一些人还在"
    ] },
    { key: "use", zh: "有没有用", opts: [
      "听的人靠它决定今天怎么办",
      "听了也没用，但不听会更难熬",
      "全是真的，可是对谁都没用",
      "明显是编的，还是有人在听",
      "有用，但有用的那段日子已经过去了"
    ] },
    { key: "sig", zh: "信号", opts: [
      "清楚干净",
      "底噪很大，句子还听得清",
      "时断时续，整句整句地丢",
      "底下压着另一台的声音",
      "只有片头和报时是清楚的"
    ] }
  ];
  // ⚠️掷轴这个形状已经搬去公共那一层了（js/axes.js）：它在同人文「角色来写」上出现了第二次，
  //   规矩是**开公共的，而且把已有的这一处也搬过去**——只开公共的、旧的留在原地是最坏的一种
  //   （施工规则/one-public-mechanism.md）。这儿只剩「电台这一处的分寸」：
  //   轴表是电台自己的，概率也是电台自己的，掷法是公共的。
  const AXIS_FREE = (typeof Axes !== "undefined" && Axes.FREE) || "（这一轴你自己想一个，别用上面那种）";
  function rollAxes() {
    const parts = Array.prototype.slice.call(arguments);
    return Axes.roll(AXES, parts, { allFree: 0.08, skip: 0.15, free: 0.20 });
  }
  function axesText(rolled) {
    return Axes.text(rolled, {
      on: "【今天这一台要同时满足下面这几条】它们互相独立，别挑一条顺手的做、把别的糊过去；没列出来的方面你自己拿主意。",
      off: "【今天这一台没有给你任何限制】造一个你认为这片频段里可能存在的台，"
        + "**不要沿用已经有的那几个台的结构**，也不要挑一个最像电台的样子来做。"
    });
  }

  // 出现过的台名长期记着，只存名字，一年也就几百字节。这样这个机制越用越好，不是越用越旧。
  const AVOID_CAP = 400;
  function avoidPush(seen, names) {
    const old = (seen && Array.isArray(seen.names)) ? seen.names.map(S) : [];
    const add = (Array.isArray(names) ? names : [names]).map(S).map(x => x.trim()).filter(Boolean);
    const out = old.concat(add.filter(x => old.indexOf(x) < 0));
    return { names: out.slice(-AVOID_CAP) };
  }
  function avoidText(seen) {
    const list = (seen && Array.isArray(seen.names)) ? seen.names.map(S).filter(Boolean) : [];
    if (!list.length) return "";
    return "\n\n【这些名字这片频段上已经出现过了，换一个】" + list.slice(-120).join("、")
      + "\n不只是别重名：**别重形状**——名字的取法、台的路数，跟上面任何一个像的都不要。";
  }

  // 广告一周滚一次，留 70% 换 30%。全换＝每周都是一批新广告，那就跟节目一样是新鲜内容了；
  // 一条不换＝听三个月还是这几条。留下来的那七成才是「这个台一直是这个台」的证据。
  const ADS_KEEP = 0.7;
  function rollAds(oldAds, freshAds) {
    const old = (Array.isArray(oldAds) ? oldAds : []).map(S).filter(Boolean);
    const fresh = (Array.isArray(freshAds) ? freshAds : []).map(S).filter(Boolean);
    if (!old.length) return fresh;
    const target = Math.max(old.length, 6);
    const keep = Math.max(1, Math.round(target * ADS_KEEP));
    const kept = old.slice(-keep);
    return kept.concat(fresh.filter(x => kept.indexOf(x) < 0).slice(0, Math.max(0, target - kept.length)));
  }

  // ---- 三个距离（言秋 + gpt 2026-09-10，第一版之后当场拉回来的那一次）----
  //
  // 第一版把中心放在「造一个可信的、独立于 char 的世界」上，做出来的东西是对的，
  // 可它回答不了一个很致命的问题：**所以我为什么要打开它？**
  // 秋秋机不是世界模拟器；跟角色完全无关的内容，再精致也是 NPC 噪音。
  //
  // 但反过来做成「顾朝彩蛋机」更糟。真正缺的是中间那一层——
  // gpt 的原话：**「这个世界不是围着我男朋友转，但因为我认识他，所以我听什么都可能联想到他。」**
  //
  //   远景     跟他完全无关。这一档负责让世界不围着他转。       ~25%
  //   生活半径 不写他，但内容自然经过他的地方、他碰过的事物。   ~60%  ← 命根子在这一层
  //   痕迹     他真的在这个台上留下过一点东西。                ~15%，且一天一个台最多一条
  //
  // ⚠️距离由**代码**掷（跟「今天哪个频率有台」同一条道理）。
  //   写成「今天他出现的概率是 15%」交给模型自己拿捏，它会塌到一边去——
  //   要么天天是他，要么一次都没有。
  // ⚠️**不许判定**。痕迹那一条不署名、不标注，界面上也永远不写「这是谁」。
  //   「到底是不是他」这个悬着的问号就是这一档的全部价值；一旦坐实，它就死了。
  const DISTANCE = { FAR: "far", ORBIT: "orbit", TRACE: "trace" };
  const DIST_ZH = { far: "远景", orbit: "生活半径", trace: "他留下的痕迹" };
  function rollDistances(n, ...parts) {
    const k = Math.max(1, N(n, 1));
    const out = [];
    let traced = false;
    for (let i = 0; i < k; i++) {
      const r = seed01.apply(null, parts.concat(["dist", i]));
      let d = r < 0.25 ? DISTANCE.FAR : (r < 0.85 ? DISTANCE.ORBIT : DISTANCE.TRACE);
      // 一天一个台最多一条痕迹。多了就不是「诶，这个跟他有关」，是蹲男朋友告白
      if (d === DISTANCE.TRACE) { if (traced) d = DISTANCE.ORBIT; else traced = true; }
      out.push(d);
    }
    // 一条远景都没有＝整个台都在围着他转，那正是要防的另一头
    if (k >= 6 && out.indexOf(DISTANCE.FAR) < 0) out[k - 1] = DISTANCE.FAR;
    return out;
  }
  const DISTANCE_RULE = [
    "【三个距离】下面那张单子上每一条都标了它离【那个人】有多远。这不是三种题材，是三种**距离**：",
    "",
    "· **远景**——跟他完全无关。照常写这片地方自己的事，这一档就是让这个世界不围着他转的那一档。",
    "· **生活半径**——⚠️**不要写关于他的内容**。写的还是这片地方的事，只是让它自然**经过**下面",
    "  「他的生活半径」里那些东西：他常在的地方、他最近碰过的事物、他那一行的活儿、他听的那类歌。",
    "  播的人不认识他，也不知道有他这个人；是**听的人自己**会「诶，这个跟他有关」。",
    "  判据一句：**把那个人整个删掉，这一条还成立吗？**成立才算写对了。",
    "· **他留下的痕迹**——他真的在这个台上留下过一点东西（点了首歌、丢了样东西、留了句话、",
    "  某个地方被人顺口提到）。两条要紧的：",
    "  ① **不署名、不点名、也不在话里暗示「你懂的」。**听的人自己怀疑是不是他，那是这一条的全部价值；",
    "     一旦坐实，它就从「可能是他」变成「系统通知你是他」，两回事。",
    "  ② 写成那种**本来就会一整天反复播**的东西——寻物启事、一次点播、一条转告。",
    "     它越小越好：越小，听的人越会自己往下想。写成告白、写成他专门讲给谁听的话，就全塌了。"
  ].join("\n");

  // ---- 这片地方 + 他的生活半径 ----
  // 她 2026-09-10：「太完全和 char 世界无关那也不好听」。
  // 电台是【公共设施】，不是一个角色。所以接进来的不是任何一个人，是他脚下这片地方，
  // 以及**他生活半径上那些东西**——地方、店、楼、活儿、歌、这几天正在传的事。
  // ⚠️人名一个都不进来（调用方那头就滤掉了）：电台知道的是【那家店、那栋楼、那条路】，
  //   不是【谁去过】。这两件事差一个字，差的是整个世界的逻辑。
  function worldBedText(bed) {
    const b = bed && typeof bed === "object" ? bed : {};
    const list = k => (Array.isArray(b[k]) ? b[k] : []).map(S).map(x => x.trim()).filter(Boolean);
    const places = list("places").slice(0, 8), orbit = list("orbit").slice(0, 14), hotline = list("hotline").slice(0, 6);
    const lore = S(b.lore).trim();
    if (!places.length && !lore && !orbit.length && !hotline.length) return "";
    const rows = ["\n\n【这片地方】这几个台就架在这儿，播的也是这儿的事。"];
    if (places.length) rows.push("· 常听得到的地名：" + places.join("、"));
    if (lore) rows.push("· 这个世界本来的样子：\n" + lore.slice(0, 1600));
    if (orbit.length) rows.push("\n【他的生活半径】这些是那个人这几天真的沾过的地方和事物："
      + "\n" + orbit.map(x => "· " + x.slice(0, 60)).join("\n")
      + "\n⚠️这一份**不是让你写他**，是让「生活半径」那一档的内容从这些东西旁边经过。别整份用完，挑得上的那几样就够。");
    if (hotline.length) rows.push("\n【今天有人打进来说的话】这几句是真有人说的，可以当热线、留言、来信的料，"
      + "也可以一句都不用：\n" + hotline.map(x => "· " + x.slice(0, 90)).join("\n"));
    rows.push("\n上面没写到的，按同一片地方的调子往下推——**别换成另一个地方、另一个年代**。");
    rows.push("⚠️这些台是公共设施，**不认识任何具体的人**：不许提某个人的名字、不许说他的私事和行踪，"
      + "也不许对着谁说话、问谁、等谁回答。它播的是这片地方本身——路、天气、物价、活儿、丢的东西、谁家开门谁家关门。");
    return rows.join("\n");
  }

  // ---- 三张单子：建台（一次）／排今天的节目（每天）／造一个临时台（掷轴）----
  const NAME_RULE = "台名要像这片地方**真的会有**的那种名字，不是给一个功能起的名"
    + "（一看就知道是干嘛用的那种名字全都不要）。呼号另给，短。";
  const TIME_RULE = "timeCall 是报时的说法，里面必须留 {时} 和 {分} 两个占位，真实时间由程序填进去。";

  function buildWorldInstruction(seen, bed) {
    return [
      "你在给一片频段建台。这几个台从今天起就一直在那儿了，往后每天都在播，所以现在定下来的东西以后不会再改。",
      "",
      "建 4 个台：3 个**常年都在**的，1 个**一天里只有某几个小时才在**的（那几个小时之外，那个频率上什么都没有）。",
      "四个台要彼此不像：不像在同一个人手里，也不像为同一批人存在。",
      NAME_RULE,
      TIME_RULE,
      "signOn 是每一圈开头都会念的那一句，一直不变，所以它得经得起听一百遍。",
      "habit 用一句话说清这个台平时在播什么、什么调子——它是往后每天排节目的依据。",
      "ads 是这个台会接到的广告，6 条，每条一小段口播。**广告要跟这个台对得上**：",
      "谁在听这个台，广告就是卖给那些人的东西。",
      "windowFrom / windowTo 只有那个时段台要填（0-23 的整点，可以跨午夜）。",
      "",
      RADIO_FLOOR,
      worldBedText(bed),
      avoidText(seen)
    ].join("\n");
  }
  const worldSchemaHint = '{"stations":[{"name":"台名","callSign":"呼号","area":"覆盖到哪儿，一句话",'
    + '"habit":"这个台平时播什么、什么调子，一句话","signOn":"每圈开头念的那一句","timeCall":"报时的说法，含{时}{分}",'
    + '"ads":["一段广告口播"],"windowFrom":null,"windowTo":null}]}';

  const DAY_ITEMS = 12;
  function buildScheduleInstruction(st, now, seen, bed, dists, thread) {
    const d = new Date(N(now, Date.now()));
    const list = (Array.isArray(dists) && dists.length) ? dists : rollDistances(DAY_ITEMS, st && st.id, dayKey(now));
    const hang = S(thread).trim();
    return [
      "你在给下面这个台排今天一天的内容。",
      "",
      "【这个台】" + S(st && st.name) + "（呼号 " + S(st && st.callSign) + "，" + freqText(st && st.freq) + "）",
      "覆盖：" + S(st && st.area),
      "路数：" + S(st && st.habit),
      "今天是 " + (d.getMonth() + 1) + " 月 " + d.getDate() + " 日。",
      "",
      "今天要 " + list.length + " 条内容，**一条对一条**照下面这张单子来：",
      list.map((x, i) => " " + (i + 1) + ". " + (DIST_ZH[x] || x)).join("\n"),
      "",
      DISTANCE_RULE,
      "",
      "每一条是**会被完整念出口的一整段话**，不是标题、不是提要。",
      "长短要差得很开：有的两句就完了，有的能念上一分钟。",
      "",
      "⚠️不要写片头、不要写报时、不要写广告——那三样是这个台自己的东西，程序会插进去。",
      "⚠️这些内容会**循环播**，中午听到的晚上可能还是它。所以**同一天里的几条之间不许前后咬死**：",
      "没有「接下来」「刚才那位」「下面继续」，每一条单独拎出来都要立得住。",
      // ⚠️「每一条都要能单独立住」第一版是写死的一条通则，结果**把全部钩子一起拆了**
      //   （言秋 2026-09-10：真电台让人回来的从来不是内容，是牵挂——追着听的连载、明天才揭晓的下文）。
      //   现在只管【同一天里】：跨天照样接得上，而且必须接。这是循环播唯一放得下钩子的地方。
      "⚠️但**跨天是可以接的、而且该接**——「昨天说的那件事今天怎么样了」正是让人第二天还想拧回来的东西。",
      "⚠️也不要每条都是同一件事的不同说法。这个台一天里本来就该有几件不相干的事。",
      hang ? "\n【你手上还悬着这件事】" + hang
        + "\n今天它得往前走一步，或者今天就揭晓。别原地把昨天那句重说一遍。" : "",
      "\n最后给一个 thread：今天播完，这个台手上还悬着、明天该有下文的那件事，一句话。"
        + "**没有就留空字符串，别为了交这个字段硬造一件事。**",
      "",
      RADIO_FLOOR,
      worldBedText(bed),
      avoidText(seen)
    ].join("\n");
  }
  const scheduleSchemaHint = '{"items":["一整段会被念出口的话"],"thread":"今天播完还悬着的那件事，一句话；没有就空字符串"}';

  function buildDriftInstruction(rolled, freq, seen, bed) {
    return [
      "这片频段上今天多出来一个台，在 " + freqText(freq) + "。它不是常驻的：过几天可能就没了，再过几天可能又回来。",
      "把它造出来，顺便排好它今天在播的内容。",
      "",
      axesText(rolled),
      "",
      // ⚠️临时台**故意不掷三个距离**（不是漏）：它是从别处飘过来的一台，
      //   凭什么知道这儿住着谁。它天然就是「远景」那一档，那正是它存在的意义——
      //   常驻台把她拉近，漂移台提醒她这个世界比她认识的那点大。
      "",
      NAME_RULE,
      TIME_RULE,
      "signOn 是每圈开头那一句。ads 给 3 到 5 条——**一个台接得到什么广告，本身就说明了谁在听它**。",
      "items 给 8 到 14 条，每条是会被完整念出口的一整段话，长短差得很开。",
      "不要写片头、报时和广告进 items，那三样程序会插。内容会循环播，所以每条都要能单独立住。",
      "",
      RADIO_FLOOR,
      worldBedText(bed),
      avoidText(seen)
    ].join("\n");
  }
  const driftSchemaHint = '{"name":"台名","callSign":"呼号","area":"覆盖到哪儿，一句话",'
    + '"habit":"这个台的路数，一句话","signOn":"每圈开头念的那一句","timeCall":"报时的说法，含{时}{分}",'
    + '"ads":["一段广告口播"],"items":["一整段会被念出口的话"]}';


  // ------------------------------------------------------------
  // 七、存档
  // ------------------------------------------------------------
  // 世界只建一次，永久存；节目单按天存、只留三天；出现过的台名长期存。
  // ⚠️加速期（时间遥控器动过）生成的节目单盖一个 dev 戳，退出测试模式时能一次清干净——
  //   打磨期的痕迹不该混进她真正的存档里。
  const K_WORLD = "x_radioWorld", K_DAYS = "x_radioDays", K_SEEN = "x_radioSeen";
  const KEEP_DAYS = 3;
  const _has = () => typeof loadJSON === "function" && typeof saveJSON === "function";
  const readWorld = () => (_has() ? loadJSON(K_WORLD, { builtAt: 0, stations: [] }) : { builtAt: 0, stations: [] });
  const writeWorld = w => { if (_has()) saveJSON(K_WORLD, w); return w; };
  const readDays = () => (_has() ? loadJSON(K_DAYS, {}) : {});
  const readSeen = () => (_has() ? loadJSON(K_SEEN, { names: [] }) : { names: [] });
  const writeSeen = x => { if (_has()) saveJSON(K_SEEN, x); return x; };
  function itemsFor(days, dayK, stId) {
    const d = days && days[dayK] && days[dayK].st;
    return (d && Array.isArray(d[stId])) ? d[stId] : [];
  }
  function writeDay(dayK, stId, items) {
    const box = readDays();
    const row = box[dayK] && typeof box[dayK] === "object" ? box[dayK] : { dev: false, st: {} };
    row.st = row.st && typeof row.st === "object" ? row.st : {};
    row.st[stId] = (Array.isArray(items) ? items : []).map(S).filter(Boolean);
    if (devShifted()) row.dev = true;
    box[dayK] = row;
    Object.keys(box).sort((a, b) => new Date(a) - new Date(b)).slice(0, Math.max(0, Object.keys(box).length - KEEP_DAYS)).forEach(k => delete box[k]);
    if (_has()) saveJSON(K_DAYS, box);
    return box;
  }
  // 「这段测试留下的痕迹要不要清掉」——退出测试模式时问的那一句，答应了就走这儿
  function clearDev() {
    const box = readDays();
    Object.keys(box).forEach(k => { if (box[k] && box[k].dev) delete box[k]; });
    if (_has()) saveJSON(K_DAYS, box);
    return box;
  }
  // 拆了重装的时候连节目单一起清：旧台没了，挂在它名下的节目单就是一堆认不了领的孤儿
  // 台上悬着的那件事写回去（thread）。整份 world 重写太重，而且会把别的台一起卷进来
  function patchStation(id, patch) {
    const w = readWorld();
    w.stations = (Array.isArray(w.stations) ? w.stations : []).map(x => (x && x.id === id) ? Object.assign({}, x, patch) : x);
    return writeWorld(w);
  }
  function wipeDays() { if (_has()) saveJSON(K_DAYS, {}); return {}; }
  function addStation(st) {
    const w = readWorld();
    w.stations = (Array.isArray(w.stations) ? w.stations : []).filter(x => x && x.id !== st.id).concat([st]);
    return writeWorld(w);
  }

  return {
    RADIO_TIME_SCALE, RADIO_DEV, radioNow, devJump, devSet, devReset, devShifted, clockAnchor, dayKey, hourOf,
    seed01, seedPick,
    SLOTS, freqText,
    KIND, DRIFT_DENSITY, SIGNAL_ROUGH, inWindow, onAirToday, signalToday, dialToday, driftDue,
    CPS, secOf, timeText, floatOrder, assembleLoop, anchorFor, whereIs, roughen, leakLine,
    RADIO_FLOOR, DISTANCE, DIST_ZH, rollDistances, DISTANCE_RULE, worldBedText, AXES, AXIS_FREE, rollAxes, axesText, AVOID_CAP, avoidPush, avoidText, ADS_KEEP, rollAds,
    buildWorldInstruction, worldSchemaHint, DAY_ITEMS, buildScheduleInstruction, scheduleSchemaHint, buildDriftInstruction, driftSchemaHint,
    K_WORLD, K_DAYS, K_SEEN, KEEP_DAYS, readWorld, writeWorld, readDays, writeDay, itemsFor, readSeen, writeSeen, clearDev, wipeDays, addStation, patchStation
  };
});
