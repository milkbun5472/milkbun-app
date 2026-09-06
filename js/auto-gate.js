// 自动补刷的公共闸 + 调用计数（v65.03，她 2026-09-06）。
//
// 起因：她报「api 站子 24 小时用掉 8 块，一次 call 一分钱，我昨天都在修 bug，
// 绝对没调用 800 次」。实测出来就是 800 次那个量级——
// **自动补刷失败之后没留下任何痕迹，于是每刷新一次就把所有角色重打一遍**。
// 三个角色、什么都不点、连刷四次，就是 12 枪 12 万字。
//
// 她当轮定的规矩：**这种形状一律先开公共的，已有的也搬过来；不许照着已有的再新开一个。**
// 所以查手机和日程那两份【已经写对了的】手写闸也一起搬进来了——
// 留着它们就等于同一层规则活在三个地方，下次改又得记得改三处。
//
// 闸的判据（照日程那一版，它是三处里唯一写全的）：
//   · 这个周期成过 → 不再跑
//   · 失败过 → 记一笔，隔 COOLDOWN 才准重试，累计 MAX 次就这个周期作罢
//   · 换了周期（换一天/换一周/换一月）→ 从头再来
// ⚠️「成过」必须由干活那一方说了算：genDiary 不抛异常不等于日记写下来了，
//   所以 run() 收的是【真的落盘了吗】这个答案，不是「没报错」。
(function (root) {
  "use strict";
  const KEY = "x_autoGate";
  const METER_KEY = "x_apiMeter";
  const MAX_TRIES = 3;              // 同日程那一版
  const COOLDOWN_MS = 2 * 3600000;  // 同日程那一版：两小时
  const KEEP_ROWS = 240;            // 这本账只留最近这么多行
  const KEEP_DAYS = 30;             // 计数只留最近 30 天

  const read = k => { try { const v = JSON.parse(root.localStorage.getItem(k) || "null"); return v && typeof v === "object" ? v : {}; } catch (e) { return {}; } };
  const write = (k, v) => { try { root.localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

  // ── 闸 ────────────────────────────────────────────────────────────
  const load = () => read(KEY);
  const save = box => {
    const ks = Object.keys(box);
    if (ks.length > KEEP_ROWS) {
      ks.sort((a, b) => (box[a].ts || 0) - (box[b].ts || 0)).slice(0, ks.length - KEEP_ROWS).forEach(k => delete box[k]);
    }
    write(KEY, box);
  };
  // key：一件事 + 谁（"diary|c1"）；period：这一件事这一轮的名字（"2026-09-06" / 周一那天 / "2026-09"）
  function due(key, period, opts) {
    const o = opts || {};
    const row = load()[key];
    if (!row || row.p !== String(period)) return true;   // 换周期了，从头再来
    if (row.ok) return false;                            // 这一轮成过了
    if ((row.tries || 0) >= (o.maxTries || MAX_TRIES)) return false;
    return Date.now() - (row.ts || 0) >= (o.cooldownMs || COOLDOWN_MS);
  }
  function mark(key, period, ok) {
    const box = load();
    const row = box[key];
    const same = row && row.p === String(period);
    box[key] = { p: String(period), ok: !!ok, tries: ok ? 0 : ((same && row.tries) || 0) + 1, ts: Date.now() };
    save(box);
  }
  // 她手动点了「重刷」：把这一格清掉，闸不该拦着她自己的手
  function clear(key) { const box = load(); if (box[key]) { delete box[key]; save(box); } }
  // 先占住这一轮：跑之前就记成「这一轮归我了」，成不成都不再重来。
  // 给【一次就是十几枪】的那种用（查手机全刷）：中途关掉浏览器也不该下次开机整份重跑，
  // 想补由她自己进去点刷新。跟 run() 是同一本账、同一把闸，只是认账的时机在前面。
  function claim(key, period) { mark(key, period, true); }
  // 跑一件事：过不了闸就返回 "skip"；跑完按【真成了没有】记账。
  // fn 返回 falsy 或抛异常都算没成——两种都要留痕迹，不然又回到「每次刷新重来」。
  async function run(key, period, fn, opts) {
    if (!due(key, period, opts)) return "skip";
    let ok = false;
    try { ok = !!(await tagged((opts && opts.tag) || labelOf(key), fn)); } catch (e) { ok = false; }
    mark(key, period, ok);
    return ok ? "ok" : "fail";
  }
  // 给设置页看：这一格现在是什么状态
  function rowOf(key) { return load()[key] || null; }

  // 这一格叫什么（给记账和设置页看）。名字不另立一份——直接问那十二项自动刷新
  // 自己的标题（AutoRefreshPolicy.FEATURES），不然又是同一个名字活在两处。
  function labelOf(key) {
    const head = String(key || "").split("|")[0];
    const F = root.AutoRefreshPolicy && root.AutoRefreshPolicy.FEATURES;
    const hit = F && F.filter(f => f.id === head)[0];
    return (hit && hit.title) || head || "其它";
  }
  // 正在跑的活儿。⚠️同时开着两件的时候【不猜】——记成「其它」也不许张冠李戴。
  let openJobs = [];
  function currentTag() { return openJobs.length === 1 ? openJobs[0] : ""; }
  // 只贴标签、不管闸：给「闸和干活分在两处」的那种用（查手机先占坑、再刷十五枪）
  async function tagged(label, fn) {
    openJobs.push(label);
    try { return await fn(); }
    finally { const i = openJobs.indexOf(label); if (i >= 0) openJobs.splice(i, 1); }
  }

  // ── 计数 ──────────────────────────────────────────────────────────
  // ⚠️只数在 callAI 那一处——全库所有调用都从那儿过（runProbe 也是），
  //   一处数完就是全的。各功能自己数一份的话，漏掉哪一处永远不知道。
  const dayKey = ts => {
    const d = new Date(ts == null ? Date.now() : ts);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  };
  function note(tag) {
    const box = read(METER_KEY), k = dayKey();
    const day = box[k] || { n: 0, by: {} };
    // 调用点自己报的名字最准；没报就问「此刻在跑哪件活儿」；还问不出就是「其它」
    const t = String(tag || "").trim() || currentTag() || "其它";
    day.n = (day.n || 0) + 1;
    day.by = day.by || {};
    day.by[t] = (day.by[t] || 0) + 1;
    box[k] = day;
    const ks = Object.keys(box).sort();
    if (ks.length > KEEP_DAYS) ks.slice(0, ks.length - KEEP_DAYS).forEach(x => delete box[x]);
    write(METER_KEY, box);
  }
  // 最近 n 天，新的在前：[{ day, n, by }]
  function recent(n) {
    const box = read(METER_KEY);
    return Object.keys(box).sort().reverse().slice(0, Math.max(1, n || 7))
      .map(d => ({ day: d, n: box[d].n || 0, by: box[d].by || {} }));
  }
  function today() { const box = read(METER_KEY); const d = box[dayKey()]; return { day: dayKey(), n: (d && d.n) || 0, by: (d && d.by) || {} }; }
  function reset() { write(METER_KEY, {}); }

  root.AutoGate = { KEY, METER_KEY, MAX_TRIES, COOLDOWN_MS, due, mark, claim, clear, run, tagged, labelOf, currentTag, rowOf, load };
  root.ApiMeter = { KEY: METER_KEY, note, recent, today, reset, dayKey };
  if (typeof module !== "undefined" && module.exports) module.exports = { AutoGate: root.AutoGate, ApiMeter: root.ApiMeter };
})(typeof window !== "undefined" ? window : globalThis);
