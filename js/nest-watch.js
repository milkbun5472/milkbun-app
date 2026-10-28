// ============================================================
// 秋秋小窝 · 管理员的新消息提醒（她 2026-10-18：「小窝管理员能不能搞个提醒我有新消息，
//   通知里面有，app 外面也有红点，就是新发的都会提醒」）
// ============================================================
// 只在【这台手机记着管理口令】时才看（没口令的人什么都不发、什么都不亮）。
//   看的是两面墙最新那一页：作品墙（「全部」）和留言板。比上次看过的那一刻新的，就是「新发的」。
//   app 那头（app.js 的 nestWatchRun）拿到新发的那几条：主屏小窝图标挂红点、顶上弹一条横幅；
//   点进小窝就算看过了（markSeen）。
//
// 为什么要单独一份、开机就加载：小窝那一页（js/nest.js）是点进去才加载的（js/lazy-mods.js），
//   可提醒要在她还没点进去的时候就响。地址和管理口令也只写在这一份，nest.js 从这儿拿，不各抄一份
//   （施工规则/one-public-mechanism.md）。
//
// 记「看到哪儿了」的两个键都是 qq_ 开头：本机的游标，不进存档、不上云、不跟着导出走
//   （施工规则/no-small-warehouse.md 第 5 条）——换台手机重新从「现在」算起，不会一开机把旧的全报一遍。
(function (g) {
  // 公共版走【自己这个站】的前门（换地址那几天新旧两个站都通）；家里那版不在 pages.dev 上，走公共版的前门
  const NEST = (g.location && /\.pages\.dev$/.test(g.location.hostname || "") ? g.location.origin : "https://autumn-drawer.pages.dev") + "/nest";
  const ADMIN_KEY = "qq_nestAdmin";
  const SEEN_KEY = "qq_nestAdminSeen";   // 她点进小窝那一刻看到的最新一条的时间
  const TOLD_KEY = "qq_nestAdminTold";   // 已经弹过横幅的最新一条的时间（同一批不弹第二遍）
  // 页面里就是 window.localStorage；测试沙盒会把它当参数递进来，有就用那一份
  const store = () => (typeof localStorage !== "undefined" ? localStorage : g.localStorage);
  const ls = {
    get: k => { try { return store().getItem(k) || ""; } catch (e) { return ""; } },
    set: (k, v) => { try { store().setItem(k, String(v)); } catch (e) {} },
    del: k => { try { store().removeItem(k); } catch (e) {} }
  };
  const adminToken = () => ls.get(ADMIN_KEY);
  const num = k => { const n = Number(ls.get(k)); return isFinite(n) && n > 0 ? n : 0; };
  let newest = 0;   // 这一轮拉到的最新一条的时间（点进去时记成「看过了」）
  // 最近一次查的结果，摆在小窝顶上给她看（她 2026-10-19「我还是收不到小窝提醒」：先得看得见它到底查没查）
  let last = null;   // { at, ok, err, fresh, top }

  async function pull(qs) {
    const headers = { "x-qq-device": typeof qqDeviceId === "function" ? qqDeviceId() : "", "x-qq-admin": adminToken() };
    const r = await fetch(NEST + "/list" + qs, { headers });
    if (!r.ok) throw new Error("小窝没接住（" + r.status + "）");
    const d = await r.json();
    return Array.isArray(d && d.items) ? d.items : [];
  }

  // 返回 { fresh: 比上次点进去还新的那几条（新的在前）, untold: 其中还没弹过横幅的 }
  //   没口令 → 什么都不拉；第一次（这台手机刚填上口令）→ 只把「现在」记下，不把墙上原有的当新的报
  async function check() {
    if (!adminToken()) return { fresh: [], untold: [] };
    let lists;
    try { lists = await Promise.all([pull("?sort=new&off=0"), pull("?sort=new&kind=post&off=0")]); }
    catch (e) { last = { at: Date.now(), ok: false, err: String((e && e.message) || e || "连不上") }; throw e; }
    const seenIds = {};
    const all = [].concat(lists[0], lists[1]).filter(it => it && it.id && !seenIds[it.id] && (seenIds[it.id] = 1))
      .sort((a, b) => (Number(b.created) || 0) - (Number(a.created) || 0));
    newest = Math.max(newest, Number(all[0] && all[0].created) || 0);
    let seen = num(SEEN_KEY);
    if (!seen) { seen = newest || Date.now(); ls.set(SEEN_KEY, seen); ls.set(TOLD_KEY, seen); }
    const fresh = all.filter(it => (Number(it.created) || 0) > seen);
    const told = Math.max(num(TOLD_KEY), seen);
    const untold = fresh.filter(it => (Number(it.created) || 0) > told);
    if (untold.length) ls.set(TOLD_KEY, Number(untold[0].created) || told);
    last = { at: Date.now(), ok: true, err: "", fresh: fresh.length, top: newest };
    return { fresh, untold };
  }
  // 点进小窝：墙上最新那条之前的都算看过了
  function markSeen() {
    if (!adminToken()) return;
    const v = Math.max(newest, num(SEEN_KEY));
    if (v) { ls.set(SEEN_KEY, v); ls.set(TOLD_KEY, Math.max(v, num(TOLD_KEY))); }
  }
  // 撤掉口令：游标一起清掉，下次再填从那一刻重新算
  function forget() { ls.del(SEEN_KEY); ls.del(TOLD_KEY); newest = 0; }

  const lastCheck = () => last;
  g.NestWatch = { NEST, ADMIN_KEY, adminToken, check, markSeen, forget, lastCheck };
})(typeof window !== "undefined" ? window : globalThis);
