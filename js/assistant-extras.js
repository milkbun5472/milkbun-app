// ============================================================
// 秋秋多管的几样（她 2026-10-14：「都做吧，特别是各种设置按钮和拉条可以给清楚，
//   这样别人想改说清楚它也能帮忙，包括小房间各种开关是干啥的」）
//
//   · 查毛病：这个人走哪条线路、那条线路选没选模型、哪些自动功能开着（只看不改）
//   · 记忆库：能改一条、删一条（原来只能加）
//   · 衣柜：加一身、改一身的描述、拿掉一身
//   · 日历：记一天、改一天、删一天
//   · 聊天设置：每个开关、拉条叫什么、管什么、能填什么，照名单改
//   · 小房间：每间房那几排开关叫什么、管什么，照名单拨
//
// ⚠️跟 assistant.js 里原来那几样同一个规矩：秋秋只出改动卡，她点「应用」才落库。
// ⚠️开关、拉条的名单只有这一份（下面 SETTINGS）；小房间的开关名单问 ChatRooms.GROUPS 那一份，这里不抄。
// ============================================================
(function () {
  "use strict";
  const S = v => String(v == null ? "" : v);
  const clip = (v, n) => { const s = S(v).replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n) + "…" : s; };
  const yes = v => /^(1|true|开|打开|开启|是|on|yes)$/i.test(S(v).trim());
  const no = v => /^(0|false|关|关掉|关闭|否|off|no)$/i.test(S(v).trim());

  // ── 聊天设置里能改的那几格（单聊右上角「关于 TA 的十件事」）──────────────
  //   key＝存档里的名字；where＝在设置里哪一格；type: bool / num（min-max） / pick（几个选项）
  //   what 写给她看的：这一格管什么、开了会怎样。⚠️跟攻略「聊天设置」那一条说的要对得上。
  const SETTINGS = [
    { key: "ctxN", zh: "带多少条上下文", where: "记 · 他知道什么", type: "num", min: 10, max: 300, def: 50,
      what: "每轮把最近多少条聊天带给他。越多越记得前文，也越贵、越慢。" },
    { key: "sumThresh", zh: "多少条以后自动总结", where: "记 · 他知道什么", type: "num", min: 40, max: 600, def: 150,
      what: "聊天攒到这么多条，就把早的那些压成长期记忆。" },
    { key: "sumBuffer", zh: "总结后留几条原文", where: "记 · 他知道什么", type: "num", min: 5, max: 100, def: 20,
      what: "压成总结的时候，最近这么多条保留原样不压。" },
    // 存档里存的是反的（noLoveLetter＝不许）：inv 让秋秋看到、改的都是界面上那一格「允许 Ta 主动发空间邀请」
    { key: "noLoveLetter", inv: true, zh: "允许 Ta 主动发空间邀请（申请信）", where: "动 · 主动消息 / 朋友圈 / 主动找你", type: "bool", def: true,
      what: "你们还没开空间时，他想跟你更进一步了会自己写一封申请信（聊天里一个封着的信封，拆开选答应或再想想）。关了就不会写。跟自动功能里的「情书」不是一回事：那个是已经在一起以后，空间里按频率写的信。他什么时候写由他自己定：开着也要满足这几样——你们还没开空间、也没有一封在等你回；上次写过隔了一天以上；你上次说「再想想」后过了三天；刚分开不满七天不写。" },
    { key: "autoMoment", zh: "自己发朋友圈", where: "动 · 他会主动做什么", type: "bool", def: false,
      what: "开了他会时不时自己发一条朋友圈。" },
    { key: "defaultOffline", zh: "点进来先进线下", where: "窗 · 这个聊天窗", type: "bool", def: false,
      what: "点开这个人默认直接进线下见面那一屏，适合同居或者常在一起的。" },
    { key: "actDesc", zh: "线上带动作描写", where: "窗 · 这个聊天窗", type: "bool", def: false,
      what: "线上聊天时，他的话旁边带一行括号里的动作描写（状态卡「在做什么」那一格）。" },
    { key: "actLong", zh: "动作描写写一小段", where: "窗 · 这个聊天窗", type: "bool", def: false,
      what: "关＝动作描写只写一句此刻在哪儿做什么；开＝能写两三句，神态和身边的样子也写进去。" },
    { key: "actPerson", zh: "动作描写里他怎么称呼自己", where: "窗 · 这个聊天窗", type: "pick", opts: { me: "我", ta: "他／她（第三人称）" }, def: "me",
      what: "动作描写那一行里，他用「我」还是用第三人称写自己。" },
    { key: "userPerson", zh: "动作描写里怎么称呼你", where: "窗 · 这个聊天窗", type: "pick", opts: { you: "你", ta: "她／他（第三人称）" }, def: "you",
      what: "动作描写那一行里，你是「你」还是第三人称。" },
    { key: "keepRerolls", zh: "重 Roll 留着旧的", where: "窗 · 这个聊天窗", type: "bool", def: false,
      what: "开了以后重 Roll 不扔上一版，最后一条底下左右翻着挑，最多留 5 版。" },
    { key: "showMyAvatar", zh: "显示我的头像", where: "窗 · 气泡显示", type: "bool", def: false, what: "你自己的气泡旁边要不要露头像。" },
    { key: "showTime", zh: "显示时间戳", where: "窗 · 气泡显示", type: "bool", def: false, what: "气泡底下显示几点发的。" },
    { key: "timeSec", zh: "时间精确到秒", where: "窗 · 气泡显示", type: "bool", def: false, what: "开了时间戳以后，要不要精确到秒。" },
    { key: "showRead", zh: "显示已读", where: "窗 · 气泡显示", type: "bool", def: true, what: "气泡底下显示「已读」。" },
    { key: "splitBubbles", zh: "长消息自动拆成短句", where: "窗 · 气泡显示", type: "bool", def: true,
      what: "他一句话写长了，按句号问号拆成几个气泡，像微信一句一句发。关了就整段一个气泡。" },
    { key: "autoTts", zh: "新消息自动念", where: "窗 · 气泡显示", type: "bool", def: false,
      what: "他新回的每条自动合成语音按顺序念，你一发消息就停。要先给他选了音色；每条都花一次语音额度。" },
    { key: "showReasoning", zh: "显示模型思考链", where: "听 · 思考链／译文／通话", type: "bool", def: false,
      what: "模型有思考过程的话，在回复上面能展开看。" },
    { key: "bilingual", zh: "外语消息自带中译", where: "听 · 思考链／译文／通话", type: "bool", def: false,
      what: "他说外语时每句都带中文翻译，译文显示在气泡里。" },
    { key: "callStream", zh: "通话流式字幕", where: "听 · 思考链／译文／通话", type: "bool", def: false,
      what: "打电话时字幕一个字一个字往外出，不用等整句。" },
    { key: "callAuto", zh: "通话连续播报", where: "听 · 思考链／译文／通话", type: "bool", def: null,
      what: "打电话时他说完一句自动接着念下一句，不用一条条点。没单独设过就跟着设置里的总开关。" },
    { key: "apiId", zh: "他走哪条线路（线上）", where: "动／记 页里的线路那一格", type: "route", def: "",
      what: "这个人线上聊天走哪条线路。填线路的名字；填「跟随全局」就是不单独挑、跟主模型走。" },
    { key: "offlineApiId", zh: "他线下走哪条线路", where: "线下设置", type: "route", def: "",
      what: "跟这个人线下见面时走哪条线路。填线路名字或「跟随全局」。" },
    { key: "maskId", zh: "他认你哪张面具", where: "记 · 他知道什么", type: "mask", def: "",
      what: "他把你当成哪一张面具：名字、头像、人设、在哪个世界都照这一张。填面具名字，填「主面具」回到主面具。" },
    { key: "bodyMode", zh: "本体模式", where: "性 · 他是什么脾气（最上面）", type: "bool", def: false,
      what: "一般不用开。开了他就是 AI 本人，不是 App 在演的角色：人设原样当系统提示词、不拆短气泡、不排日程不刷查手机。想让他照人设演角色就保持关着。" }
  ];
  const SET_BY = Object.fromEntries(SETTINGS.map(x => [x.key, x]));
  const showVal = (def, v, ctx) => {
    if (def.type === "route") { const r = ((ctx && ctx.apiProfiles) || []).find(p => p && p.id === v); return r ? (r.name || "（没起名的线路）") : "跟随全局"; }
    if (def.type === "mask") { const m = ((ctx && ctx.masks && ctx.masks()) || []).find(x => x && x.id === v); return m ? (S(m.label).trim() || m.name) : "主面具"; }
    if (v == null) return def.type === "bool" ? (def.def == null ? "跟着总开关" : (def.def ? "开" : "关")) : def.type === "pick" ? def.opts[def.def] : String(def.def);
    if (def.inv && def.type === "bool") v = !v;
    return def.type === "bool" ? (v ? "开" : "关") : def.type === "pick" ? (def.opts[v] || String(v)) : String(v);
  };
  // 她说的值 → 存进去的值；认不出就报错（不猜）
  function parseVal(def, raw, ctx) {
    const t = S(raw).trim();
    if (def.type === "route") {
      if (/^(跟随全局|跟随主模型|全局|默认|不单独挑)$/.test(t)) return null;
      const r = ((ctx && ctx.apiProfiles) || []).find(p => p && (S(p.name).trim() === t || S(p.id) === t));
      if (!r) throw new Error("没有叫「" + t + "」的线路；现有的：" + (((ctx && ctx.apiProfiles) || []).map(p => p.name).filter(Boolean).join("、") || "一条都没配"));
      return r.id;
    }
    if (def.type === "mask") {
      if (/^(主面具|默认|不选)$/.test(t)) return "";
      const m = ((ctx && ctx.masks && ctx.masks()) || []).find(x => x && (S(x.label).trim() === t || S(x.name).trim() === t || S(x.id) === t));
      // 面具挑选那排按钮上写的是 label（没有才用 name），她照着按钮说的名字也得认（群友 2026-10-20）
      if (!m) throw new Error("没有叫「" + t + "」的面具；现有的：" + (((ctx && ctx.masks && ctx.masks()) || []).map(x => S(x.label).trim() || x.name).join("、") || "只有主面具"));
      return m.id;
    }
    if (def.type === "bool") { if (yes(t)) return !def.inv; if (no(t)) return !!def.inv; throw new Error("「" + def.zh + "」只能是开或关"); }
    if (def.type === "num") {
      const n = Math.round(Number(t.replace(/[^\d.]/g, "")));
      if (!isFinite(n) || !t) throw new Error("「" + def.zh + "」要填一个数");
      if (n < def.min || n > def.max) throw new Error("「" + def.zh + "」只能在 " + def.min + "～" + def.max + " 之间");
      return n;
    }
    const k = Object.keys(def.opts).find(k => k === t || def.opts[k] === t || def.opts[k].indexOf(t) === 0);
    if (!k) throw new Error("「" + def.zh + "」只能是：" + Object.values(def.opts).join("、"));
    return k;
  }

  // ── 小房间那几排开关：名单问 ChatRooms.GROUPS（跟房间设置页同一份字） ───────────
  const GROUP_ZH = { cognition: "TA进这扇门带着什么", actions: "TA在这间房能主动拉你做什么", writeback: "出门时带走什么" };
  const roomGroups = () => (typeof window !== "undefined" && window.ChatRooms && window.ChatRooms.GROUPS) || {};
  const roomsOf = id => { try { return (window.ChatRooms && window.ChatRooms.list(id)) || []; } catch (e) { return []; } };
  function roomSwitchRows(room) {
    const G = roomGroups(), out = [];
    Object.keys(G).forEach(g => (G[g] || []).forEach(([k, zh, what]) => {
      const box = room && room[g] && typeof room[g] === "object" ? room[g] : {};
      const on = box[k] == null ? (k === "worldbook") : !!box[k];
      out.push({ 开关: g + "." + k, 叫什么: zh, 管什么: what, 在哪一排: GROUP_ZH[g] || g, 现在: on ? "开" : "关" });
    }));
    return out;
  }

  // ── 新的几种改动卡 ──────────────────────────────────────────
  const TARGETS = {
    // 聊天设置：id＝「角色id:设置名」，text＝新值（开／关、数字、选项）
    setting: {
      zh: "聊天设置",
      read: ctx => [],
      before: (p, ctx) => {
        const [cid, key] = S(p.id).split(":"); const def = SET_BY[key]; if (!def) return "";
        const cur = ctx.settingsOf ? (ctx.settingsOf(cid) || {})[key] : undefined;
        return def.zh + "：" + showVal(def, cur, ctx);
      },
      write: (id, patch, ctx) => {
        const [cid, key] = S(id).split(":");
        const def = SET_BY[key];
        if (!def) throw new Error("聊天设置里没有「" + key + "」这一格");
        if (!ctx.onPatchChatSetting) throw new Error("这个页面没接聊天设置的写入口");
        if (!(ctx.characters || []).some(c => c && c.id === cid)) throw new Error("找不到这个角色");
        ctx.onPatchChatSetting(cid, { [key]: parseVal(def, patch.text, ctx) });
        return 1;
      }
    },
    // 小房间开关：id＝「角色id:房间id:排.开关」，text＝开／关
    roomset: {
      zh: "小房间开关",
      read: ctx => [],
      before: (p, ctx) => {
        const [cid, rid, sw] = S(p.id).split(":"); const [g, k] = S(sw).split(".");
        const room = roomsOf(cid).find(r => r.id === rid); if (!room) return "";
        const row = roomSwitchRows(room).find(r => r.开关 === g + "." + k);
        return row ? "「" + (room.name || room.title || (room.main ? "主聊天" : rid)) + "」" + row.叫什么 + "：" + row.现在 : "";
      },
      write: (id, patch, ctx) => {
        const [cid, rid, sw] = S(id).split(":"); const [g, k] = S(sw).split(".");
        const R = window.ChatRooms; if (!R) throw new Error("这台设备没有小房间");
        const G = roomGroups();
        if (!G[g] || !(G[g] || []).some(x => x[0] === k)) throw new Error("小房间里没有「" + sw + "」这个开关");
        const room = roomsOf(cid).find(r => r.id === rid); if (!room) throw new Error("找不到这间房");
        const t = S(patch.text).trim(); if (!yes(t) && !no(t)) throw new Error("房间开关只能是开或关");
        R.save(cid, Object.assign({}, room, { [g]: Object.assign({}, room[g] || {}, { [k]: yes(t) }) }));
        if (ctx.onRoomsChanged) ctx.onRoomsChanged();
        return 1;
      }
    },
    // 记忆库：改一条＝id 照抄那条，text 是改完的；删一条＝drop:true
    memedit: {
      zh: "记忆库（改／删）",
      read: ctx => ((ctx.memList && ctx.memList()) || []).map(e => ({ id: e.id, name: "记忆", text: e.text })),
      write: (id, patch, ctx) => {
        if (!ctx.memList || !ctx.onSaveMemLib) throw new Error("这个页面没接记忆库写入口");
        const list = ctx.memList() || [];
        if (!list.some(e => S(e.id) === S(id))) throw new Error("记忆库里找不到这一条了");
        if (patch.drop) { ctx.onSaveMemLib(list.filter(e => S(e.id) !== S(id))); return 1; }
        const t = S(patch.text).trim(); if (!t) throw new Error("改完的这一条是空的");
        ctx.onSaveMemLib(list.map(e => S(e.id) === S(id) ? Object.assign({}, e, { text: t, ts: Date.now() }) : e));
        return 1;
      }
    },
    // 衣柜：id＝角色 id；occasion＝场合（哪一组），name＝这一身叫什么，text＝款式颜色料子；drop:true 拿掉这一身
    closet: {
      zh: "衣柜",
      read: ctx => [],
      write: (id, patch, ctx) => {
        if (!ctx.closetOf || !ctx.onSaveCloset) throw new Error("这个页面没接衣柜写入口");
        const name = S(patch.name).trim(); if (!name) throw new Error("这一身要有个名字");
        const box = Object.assign({}, ctx.closetOf(id) || {});
        let groups = Array.isArray(box.closet) ? box.closet.map(g => Object.assign({}, g, { sets: (g.sets || []).slice() })) : [];
        const hit = groups.find(g => (g.sets || []).some(x => S(x.name).trim() === name));
        if (patch.drop) {
          if (!hit) throw new Error("衣柜里找不到「" + name + "」");
          hit.sets = hit.sets.filter(x => S(x.name).trim() !== name);
          groups = groups.filter(g => g.sets.length);
        } else if (hit) {
          hit.sets = hit.sets.map(x => S(x.name).trim() === name ? Object.assign({}, x, { note: S(patch.text).trim() || x.note }) : x);
        } else {
          const occ = S(patch.occasion).trim() || "日常";
          let g = groups.find(x => S(x.occasion || x.name).trim() === occ);
          if (!g) { g = { occasion: occ, sets: [] }; groups.push(g); }
          g.sets.push({ name: name, note: S(patch.text).trim() });
        }
        ctx.onSaveCloset(id, Object.assign(box, { closet: groups }));
        return 1;
      }
    },
    // 日历：新建＝id 填 new（date 必填，name＝标题，text＝备注，view＝mine 我的／world 世界／角色 id）；改／删＝id 照抄那条
    cal: {
      zh: "日历",
      read: ctx => [],
      write: (id, patch, ctx) => {
        if (!ctx.calendarGet || !ctx.onSaveCalendar) throw new Error("这个页面没接日历写入口");
        const cal = JSON.parse(JSON.stringify(ctx.calendarGet() || { world: {}, chars: {}, mine: {} }));
        cal.world = cal.world || {}; cal.mine = cal.mine || {}; cal.chars = cal.chars || {};
        const bucketOf = v => v === "world" ? cal.world : (!v || v === "mine") ? cal.mine : (cal.chars[v] = cal.chars[v] || {});
        const all = [["world", cal.world], ["mine", cal.mine]].concat(Object.keys(cal.chars).map(k => [k, cal.chars[k]]));
        const find = () => { for (const [, b] of all) for (const d of Object.keys(b)) { const i = (b[d] || []).findIndex(e => S(e.id) === S(id)); if (i >= 0) return { b, d, i }; } return null; };
        if (!id || id === "new") {
          const d = S(patch.date).trim(); if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new Error("日期要写成 2026-03-14 这样");
          const title = S(patch.name).trim(); if (!title) throw new Error("这一天要有个标题");
          const b = bucketOf(S(patch.view).trim());
          b[d] = (b[d] || []).concat([{ id: "ev_" + Date.now() + "_" + Math.floor(Math.random() * 1000), title: title, note: S(patch.text).trim() }]);
        } else {
          const at = find(); if (!at) throw new Error("日历里找不到这一条了");
          if (patch.drop) { at.b[at.d].splice(at.i, 1); if (!at.b[at.d].length) delete at.b[at.d]; }
          else {
            const ev = Object.assign({}, at.b[at.d][at.i], S(patch.name).trim() ? { title: S(patch.name).trim() } : {}, S(patch.text).trim() ? { note: S(patch.text).trim() } : {});
            const nd = S(patch.date).trim();
            if (/^\d{4}-\d{2}-\d{2}$/.test(nd) && nd !== at.d) { at.b[at.d].splice(at.i, 1); if (!at.b[at.d].length) delete at.b[at.d]; at.b[nd] = (at.b[nd] || []).concat([ev]); }
            else at.b[at.d][at.i] = ev;
          }
        }
        ctx.onSaveCalendar(cal);
        return 1;
      }
    }
  };
  // 自动功能（设置 · 动 那一页每个人的开关和频率）：id＝「角色id:功能id」，text＝开／关，或者频率那一档的名字
  const FEATS = () => (typeof window !== "undefined" && window.AutoRefreshPolicy && window.AutoRefreshPolicy.FEATURES) || [];
  TARGETS.auto = {
    zh: "自动功能",
    read: ctx => [],
    write: (id, patch, ctx) => {
      const [cid, fid] = S(id).split(":"); const f = FEATS().find(x => x.id === fid);
      if (!f) throw new Error("没有「" + fid + "」这个自动功能");
      if (!ctx.onSetAuto) throw new Error("这个页面没接自动功能的写入口");
      const t = S(patch.text).trim();
      if (yes(t) || no(t)) { ctx.onSetAuto(fid, cid, yes(t)); return 1; }
      const r = (f.rates || []).find(x => x.zh === t || x.id === t);
      if (!r) throw new Error("「" + f.title + "」只能开／关" + ((f.rates || []).length ? "，或者挑频率：" + f.rates.map(x => x.zh).join("、") : ""));
      if (!ctx.onSetAutoRate) throw new Error("这个页面没接频率的写入口");
      ctx.onSetAutoRate(fid, cid, r.id); return 1;
    }
  };
  // 会让东西消失的那几样（她 2026-10-14：「没给它碰的也都给它吧，反正都是她们自己决定应不应用，最多让它多提示一句」）：
  //   id＝「delchar:角色id」删角色 / 「clearchat:角色id」清聊天记录（线上＋单人线下）/ 「clearchatmem:角色id」清聊天连记忆一起。
  //   ⚠️卡上必带「先导出」那一句（.claude/rules/never-say-delete-first.md）；删角色还会再弹 App 自己那道二次确认。
  TARGETS.danger = {
    zh: "⚠️ 会删掉东西的操作",
    read: ctx => [],
    write: (id, patch, ctx) => {
      const [op, cid] = S(id).split(":");
      if (!(ctx.characters || []).some(c => c && c.id === cid)) throw new Error("找不到这个角色");
      if (op === "delchar") { if (!ctx.onDeleteChar) throw new Error("这个页面没接删角色的入口"); ctx.onDeleteChar(cid); return 1; }
      if (op === "clearchat" || op === "clearchatmem") { if (!ctx.onClearChat) throw new Error("这个页面没接清聊天的入口"); ctx.onClearChat(cid, op === "clearchatmem"); return 1; }
      throw new Error("不认得「" + op + "」这种操作");
    }
  };
  const DANGER_WARN = "删之前先去 设置 → 数据 → 导入与导出 → 导出全部数据，存一份 json 在手机或电脑上——云端备份没有历史，被盖掉就回不来，只有你自己存的那份谁也动不了。";

  // 这几种卡 text 可以空着：删的那种（drop）、日历新建只写了标题的
  let okWithoutText = x => (x.target === "danger" && S(x.id).trim()) || (x.drop === true || x.drop === "true") && S(x.id).trim() && /^(memedit|closet|cal)$/.test(x.target)
    || (x.target === "cal" && S(x.name).trim()) || (x.target === "closet" && S(x.name).trim() && S(x.id).trim());

  // ── 快照里多给的几栏（只给这会儿在说的那几个人） ───────────────────────
  let snapshotExtra = function (ctx, hot) {
    const chars = (ctx.characters || []).filter(c => c && hot.has(c.id));
    const out = {};
    // 查毛病：线路、模型、自动功能
    out.线路和自动功能 = chars.map(c => {
      const r = ctx.routeInfo ? ctx.routeInfo(c.id) : null;
      return { 谁: c.name, id: c.id,
        线路: r ? (r.name || "（没起名的线路）") + (r.own ? "（单独挑的）" : "（跟随全局主模型）") : "（没有可用线路：设置 · 文字模型 里一条都没配）",
        模型: r ? (r.model || "（这条线路没选模型——会报「尚未指定模型」）") : "（无）",
        填了密钥: r ? !!r.hasKey : false,
        自动功能: ctx.autoInfo ? ctx.autoInfo(c.id) : "（看不到）" };
    });
    // 聊天设置现在的值
    out.聊天设置 = chars.map(c => {
      const s = (ctx.settingsOf && ctx.settingsOf(c.id)) || {};
      return { 谁: c.name, id: c.id, 现在: SETTINGS.map(d => ({ 设置名: d.key, 叫什么: d.zh, 现在: showVal(d, s[d.key], ctx) })) };
    });
    // 小房间：每间房、每个开关现在开没开
    out.小房间 = chars.map(c => ({ 谁: c.name, id: c.id, 房间: roomsOf(c.id).map(r => ({ 房间id: r.id, 名字: r.name || r.title || (r.main ? "主聊天" : r.id), 开关: roomSwitchRows(r) })) }))
      .filter(x => x.房间.length > 1 || (x.房间[0] && x.房间[0].开关.length));
    // 记忆库：这几个人名下的，最多 60 条
    const mem = (ctx.memList && ctx.memList()) || [];
    out.记忆库 = chars.map(c => ({ 谁: c.name, 条目: mem.filter(e => e && Array.isArray(e.charIds) && e.charIds.includes(c.id)).slice(-60).map(e => ({ id: e.id, text: clip(e.text, 200) })) }));
    // 衣柜
    out.衣柜 = chars.map(c => {
      const box = (ctx.closetOf && ctx.closetOf(c.id)) || {};
      const g = Array.isArray(box.closet) ? box.closet : [];
      return { 谁: c.name, id: c.id, 衣柜: g.length ? g.map(x => ({ 场合: x.occasion || x.name || "（没写场合）", 衣服: (x.sets || []).map(s => ({ 名字: s.name, 描述: clip(s.note, 160) })) })) : "（空）" };
    });
    // 日历：前后两个月
    const cal = (ctx.calendarGet && ctx.calendarGet()) || {};
    const now = Date.now(), lo = now - 62 * 864e5, hi = now + 62 * 864e5;
    const rows = [];
    const take = (who, b) => Object.keys(b || {}).forEach(d => { const t = Date.parse(d); if (isFinite(t) && t >= lo && t <= hi) (b[d] || []).forEach(e => rows.push({ id: e.id, 日期: d, 谁的: who, 标题: e.title, 备注: clip(e.note, 80) })); });
    take("我的", cal.mine); take("世界", cal.world);
    Object.keys(cal.chars || {}).forEach(k => { const c = (ctx.characters || []).find(x => x && x.id === k); take(c ? c.name : k, cal.chars[k]); });
    out.日历 = rows.length ? rows.sort((a, b) => a.日期 < b.日期 ? -1 : 1).slice(0, 80) : ["（前后两个月没有记过的日子）"];
    return out;
  }

  // ── 写给秋秋的说明：哪几种卡、各怎么填，开关和拉条各管什么 ───────────────
  let docLines = function () {
    return "· setting 某个人的【聊天设置】里的一格（id＝「角色id:设置名」，text＝新值：开／关、一个数、或者选项里的那几个字）。能改的只有下面这几格，"
      + "每格叫什么、在哪、管什么都写着——她问「这个开关是干嘛的」「拉条拉多少合适」，照这份说；她说清了要怎么改，就出卡：\n"
      + SETTINGS.map(d => "    " + d.key + "「" + d.zh + "」（" + d.where + "；" + (d.type === "bool" ? "开／关" : d.type === "num" ? d.min + "～" + d.max + "，默认 " + d.def : d.type === "route" ? "线路名字／跟随全局" : d.type === "mask" ? "面具名字／主面具" : Object.values(d.opts).join("／")) + "）：" + d.what).join("\n") + "\n"
      + "  快照【聊天设置】那一栏是这几个人现在的值。名单外的设置（线路、面具、头像、CSS 这些）不走这一栏。\n"
      + "· roomset 某个人某间【小房间】的一个开关（id＝「角色id:房间id:排.开关」，如 c1:room_x:writeback.memoryCandidate；text＝开／关）。"
      + "快照【小房间】里每间房每个开关都写着叫什么、管什么、现在开没开——她问「这个开关干嘛的」就照那几句讲给她听；三排的意思："
      + "cognition＝TA进这扇门带着什么（记不记得你们的事、知不知道今天几号）；actions＝TA在这间房能主动拉你做什么；writeback＝这间房里的事出门以后算不算数、进不进记忆。主聊天的房间 id 是 main。\n"
      + "· memedit 改或删记忆库里的一条（快照【记忆库】那一栏；id 照抄那一条；改＝text 写改完的整条；删＝\"drop\":true、text 留空）。加新记忆还是用 memory。\n"
      + "· closet 某个人的衣柜（id＝角色 id；name＝这一身叫什么；text＝款式颜色料子（写给拍照用，具体到能画出来）；occasion＝放进哪个场合那一组，不填放「日常」；"
      + "改一身＝name 跟快照里那身一字不差、text 写新的描述；拿掉一身＝name＋\"drop\":true）。\n"
      + "· cal 日历上的一天（快照【日历】是前后两个月的；新建＝id 填 new，date 写 2026-03-14 这样，name＝标题，text＝备注，view＝mine 记在我这边／world 世界的事／角色 id 记在那个人那边；"
      + "改＝id 照抄、只填要改的那几样；删＝id＋\"drop\":true）。\n"
      + "· auto 某个人的自动功能（设置 · 动 那一页；id＝「角色id:功能id」，text＝开／关，或频率那一档的名字）。功能有："
      + FEATS().map(f => f.id + "「" + f.title + "」（" + f.sub + (f.rates ? "；频率：" + f.rates.map(r => r.zh).join("／") : "") + "）").join("、") + "。快照【线路和自动功能】里写着现在开没开。\n"
      + "· danger 会删掉东西的操作（id＝delchar:角色id 删掉这个角色／clearchat:角色id 清掉跟TA的线上和单人线下聊天记录／clearchatmem:角色id 连记忆一起清；text 写一句你要删的是什么）。"
      + "只有她亲口说要删才出这张卡；出卡的同时 reply 里必须先说这一句：「" + DANGER_WARN + "」。删角色之后 App 还会再弹一道确认。\n"
      + "  她的头像、聊天背景这种图你画不出来，跟她说去哪里换；云同步（上传、从云端恢复）不在你手里，让她自己去设置里点，并且同样先提醒她导出。\n"
      + "· 【查毛病】快照【线路和自动功能】写着这几个人走哪条线路、那条线路选没选模型、填没填密钥、哪些自动功能开着关着。"
      + "她说「为什么他不回／报错了／某个功能没动静」，先看这一栏和【最近报错】，能对上就直接告诉她卡在哪、去哪改；这一栏只看不改。\n";
  }

  // ════ 第二批（她 2026-10-14「都做吧」：群聊设置、线下设置、全局开关、行程、情侣空间、表情包） ════
  //   规矩照旧：只出卡，她点「应用」才落库。名单各只有这一份，跟设置页那几格的字对得上。
  const GROUP_SETTINGS = [
    { key: "memoryInterop", zh: "记忆互通", type: "bool", def: false, what: "开了群里的事算数：会进各人的记忆、私聊里也知道；关着这个群是封闭的，里面的事不往外带。" },
    { key: "privateCtxN", zh: "带入私聊条数", type: "num", min: 0, max: 30, def: 0, what: "每人在群里开口时，顺带看自己跟你私聊的最近多少条。0＝不看。" },
    { key: "preJoinN", zh: "入群前上文条数", type: "num", min: 0, max: 50, def: 0, what: "新拉进来的人能看到进群之前的多少条。" },
    { key: "autoChat", zh: "群里自己聊起来", type: "bool", def: false, what: "开了你不说话群里也会自己聊；要「设置 · 动」里群聊那个总闸也开着。" },
    { key: "autoChatMin", zh: "自发间隔（分钟）", type: "num", min: 1, max: 60, def: 10, what: "自己聊起来时，隔多少分钟冒一次。" },
    { key: "autoChatRounds", zh: "一次聊几轮", type: "num", min: 1, max: 60, def: 3, what: "每次自己聊起来，连着说几轮就停。" },
    { key: "autoChatMaxMsg", zh: "你不在时最多攒几条", type: "num", min: 10, max: 300, def: 60, what: "你一直不回，自己聊到这么多条就停下来等你。" },
    { key: "autoChatResetHours", zh: "多久没人管就停", type: "num", min: 1, max: 48, def: 6, what: "你这么多小时没进群，自己聊就歇着。" },
    { key: "ctxN", zh: "带多少条上下文", type: "num", min: 10, max: 300, def: 50, what: "每轮把群里最近多少条带给模型。" },
    { key: "sumThresh", zh: "多少条以后自动总结", type: "num", min: 40, max: 400, def: 150, what: "群聊攒到这么多条就把早的压成总结。" },
    { key: "sumBuffer", zh: "总结后留几条原文", type: "num", min: 0, max: 60, def: 20, what: "压总结时最近这么多条留原样。" },
    { key: "drama", zh: "修罗场", type: "bool", def: false, what: "开了群里每个人都知道大家各自跟你是什么关系（会在群里落一条灰提示）；关掉那条灰提示一起撤。" },
    { key: "defaultOffline", zh: "点进来先进线下", type: "bool", def: false, what: "点开这个群直接进群线下。" },
    { key: "actDesc", zh: "线上带动作描写", type: "bool", def: false, what: "群里每句话旁边带一行括号动作。" },
    { key: "showMyAvatar", zh: "显示我的头像", type: "bool", def: true, what: "我发的消息旁边带不带头像。" },
    { key: "showMyName", zh: "显示我的名字和头衔", type: "bool", def: false, what: "我发的消息上面也写我的名字，挂着我在这个群的头衔和群主/管理员牌子。" },
    { key: "showTime", zh: "显示时间", type: "bool", def: true, what: "气泡底下显示时间。" },
    { key: "showRead", zh: "显示已读", type: "bool", def: false, what: "我发的消息底下显示已读。" }
  ];
  const OFFLINE_SETTINGS = [
    { key: "maxTokens", zh: "单次输出上限", type: "num", min: 1000, max: 65000, def: 4000, what: "一拍最多能写多长。思考型模型写长场景容易截断掉格式，就往上拉；太大不会更长，只是不会被截。" },
    { key: "minWords", zh: "最低字数目标", type: "num", min: 0, max: 20000, def: 0, what: "希望每拍至少写这么多字。0＝不要求。上限给够（大概字数×2）才写得出来。" },
    { key: "lengthMode", zh: "长度", type: "pick", opts: { natural: "自然长度", immersive: "沉浸长文" }, def: "natural", what: "自然＝该短就短；沉浸＝每拍都往长了铺。" },
    { key: "memN", zh: "带几条记忆", type: "num", min: 0, max: 20, def: 6, what: "每拍带几条相关的长期记忆。" },
    { key: "onlineCtxN", zh: "带多少条线上聊天", type: "num", min: 0, max: 100, def: 20, what: "见面时顺带看线上最近多少条，接得上刚才在微信里说的事。" },
    { key: "selfP", zh: "他称自己", type: "pick", opts: { first: "我", third: "他／她" }, def: "third", what: "叙述里他用第一人称还是第三人称。" },
    { key: "userP", zh: "称呼你", type: "pick", opts: { second: "你", third: "她／他（第三人称）" }, def: "second", what: "叙述里怎么称呼你。" },
    { key: "describeMe", zh: "替我写动作", type: "bool", def: false, what: "开了会写你的动作和反应；关着只写他，你的那份留给你。" },
    { key: "noAutoShot", zh: "不让他自己拍照", type: "bool", def: false, what: "开了他在戏里不会顺手拍照生图；她点「拍一张」照样能拍。" },
    { key: "tastePace", zh: "节奏", type: "pick", opts: { auto: "自然", slow: "慢慢磨", forward: "往前走" }, def: "auto", what: "慢慢磨＝细细地在一个场景里待着；往前走＝推剧情。" },
    { key: "tasteFocus", zh: "侧重", type: "pick", opts: { auto: "自然", dialogue: "对话", action: "动作", atmosphere: "氛围" }, def: "auto", what: "多写对白、多写动作，还是多写环境气氛。" },
    { key: "tasteDensity", zh: "密度", type: "pick", opts: { auto: "自然", airy: "留白", rich: "浓密" }, def: "auto", what: "句子松一点留白，还是写得满一点。" },
    { key: "fontSize", zh: "字号", type: "num", min: 12, max: 22, def: 15, what: "线下正文的字号。" }
  ];
  const GLOBALS = [
    { key: "timeAware", zh: "时间感知", type: "bool", def: true, what: "全局开关：角色知不知道现在几点、今天星期几。单个人的聊天设置里可以另外开关。" },
    { key: "geoAware", zh: "位置感知", type: "bool", def: false, what: "角色知不知道你在哪（现实定位或架空世界里的位置）、那边天气。" },
    { key: "msgBanner", zh: "App 内消息提醒", type: "bool", def: true, what: "在别的页面时，有人发消息顶上弹一条。" },
    { key: "bgToast", zh: "后台跑完提示我", type: "bool", def: true, what: "日记、行程这些后台活跑完了弹一句。" },
    { key: "bgApi", zh: "后台线路", type: "route", def: "", what: "记忆整理、翻译、行程、查手机这些后台活走哪条线路。填线路名字，或「跟随线上」，或「无」＝走后台线路的活（记忆整理、行程、钱包、查手机这些）不跑；主动私聊、日记、朋友圈走TA自己的线路，不受它管。" },
    { key: "musicProvider", zh: "一起听的音乐源", type: "pick", opts: { netease: "网易云", gd: "GD音乐台" }, def: "netease", what: "网易云要自己在设置里填接口地址；GD音乐台不用填，直接能搜能播。网易云接口挂了、搜不到歌，换成 GD音乐台。" }
  ];
  const byKey = L => L.reduce((o, d) => (o[d.key] = d, o), {});
  const GSET_BY = byKey(GROUP_SETTINGS), OSET_BY = byKey(OFFLINE_SETTINGS), GLOB_BY = byKey(GLOBALS);
  const valDoc = d => d.type === "bool" ? "开／关" : d.type === "num" ? d.min + "～" + d.max + "，默认 " + d.def : d.type === "route" ? "线路名字／跟随线上／无" : Object.values(d.opts).join("／");
  const routeOfGlobal = (t, ctx) => {
    t = S(t).trim();
    if (/^(无|关|不跑|off|__off__)$/i.test(t)) return "__off__";
    if (!t || /^(跟随|默认|跟随线上|跟随全局|follow)$/i.test(t)) return null;
    const r = ((ctx.apiProfiles) || []).find(x => x && (x.id === t || S(x.name).trim() === t || S(x.model).trim() === t));
    if (!r) throw new Error("没有叫「" + t + "」的线路");
    return r.id;
  };
  const groupOf = (ctx, id) => ((ctx.groupsList && ctx.groupsList()) || []).find(g => g && g.id === id);
  const keyed = (zh, L, BY, getCur, onWrite, check) => ({
    zh, read: () => [],
    before: (p, ctx) => { const i = S(p.id).lastIndexOf(":"); const def = BY[S(p.id).slice(i + 1)]; if (!def) return ""; const cur = getCur(ctx, S(p.id).slice(0, i)); return def.zh + "：" + showVal(def, cur ? cur[def.key] : undefined, ctx); },
    write: (id, patch, ctx) => {
      const i = S(id).lastIndexOf(":"), who = S(id).slice(0, i), key = S(id).slice(i + 1), def = BY[key];
      if (!def) throw new Error(zh + "里没有「" + key + "」这一格");
      check(ctx, who);
      onWrite(ctx, who, { [key]: parseVal(def, patch.text, ctx) });
      return 1;
    }
  });
  TARGETS.gsetting = keyed("群聊设置", GROUP_SETTINGS, GSET_BY, (ctx, g) => ctx.groupSettingsOf && ctx.groupSettingsOf(g),
    (ctx, g, v) => ctx.onPatchGroupSetting(g, v),
    (ctx, g) => { if (!ctx.onPatchGroupSetting) throw new Error("这个页面没接群聊设置的写入口"); if (!groupOf(ctx, g)) throw new Error("找不到这个群"); });
  TARGETS.osetting = keyed("线下设置", OFFLINE_SETTINGS, OSET_BY, (ctx, c) => ctx.offlineSettingsOf && ctx.offlineSettingsOf(c),
    (ctx, c, v) => ctx.onPatchOfflineSetting(c, v),
    (ctx, c) => { if (!ctx.onPatchOfflineSetting) throw new Error("这个页面没接线下设置的写入口"); if (!(ctx.characters || []).some(x => x && x.id === c) && !groupOf(ctx, c)) throw new Error("找不到这个人或这个群"); });
  // 全局开关：id＝开关名（timeAware / geoAware / msgBanner / bgToast / bgApi / musicProvider）
  TARGETS.global = {
    zh: "全局设置", read: () => [],
    before: (p, ctx) => { const def = GLOB_BY[S(p.id)]; if (!def) return ""; const g = (ctx.globalsGet && ctx.globalsGet()) || {};
      if (def.key === "bgApi") return def.zh + "：" + (g.bgApi === "__off__" ? "无" : (((ctx.apiProfiles || []).find(r => r.id === g.bgApi) || {}).name || "跟随线上"));
      return def.zh + "：" + showVal(def, g[def.key], ctx); },
    write: (id, patch, ctx) => {
      const def = GLOB_BY[S(id)]; if (!def) throw new Error("全局设置里没有「" + id + "」这一格");
      if (!ctx.onSetGlobal) throw new Error("这个页面没接全局设置的写入口");
      ctx.onSetGlobal(def.key, def.type === "route" ? routeOfGlobal(patch.text, ctx) : parseVal(def, patch.text, ctx));
      return 1;
    }
  };
  // 行程里的一段：id＝「角色id:日期:第几段」（日期照快照抄）；name＝做什么，text＝在哪，time＝几点（09:30）
  TARGETS.sched = {
    zh: "行程", read: () => [],
    before: (p, ctx) => { const [c, d, n] = S(p.id).split(":"); const row = (((ctx.schedOf && ctx.schedOf(c)) || {})[d] || {}).seqs; const r = Array.isArray(row) && row.find(x => x && String(x.seq) === n); return r ? (r.time || "") + " " + (r.title || "") + (r.location ? " @ " + r.location : "") : ""; },
    write: (id, patch, ctx) => {
      const [c, d, n] = S(id).split(":");
      if (!ctx.onEditSchedSeq) throw new Error("这个页面没接行程写入口");
      const fix = {};
      if (S(patch.name).trim()) fix.title = S(patch.name).trim();
      if (S(patch.text).trim()) fix.location = S(patch.text).trim();
      if (/^\d{1,2}:\d{2}$/.test(S(patch.time).trim())) fix.time = S(patch.time).trim().padStart(5, "0");
      if (!Object.keys(fix).length) throw new Error("这一段什么都没改");
      if (!ctx.onEditSchedSeq(c, d, Number(n), fix)) throw new Error("那天的行程里找不到这一段了（可能已经重排过）");
      return 1;
    }
  };
  // 情侣空间档案：id＝「角色id:栏」，text＝这一栏整段新的
  const COUPLE_FIELDS = [["nicknames", "你们怎么称呼彼此"], ["insideJokes", "只有你俩懂的梗"], ["rituals", "你俩之间的小仪式"],
    ["comfort", "难过的时候想被怎样接住，什么反而会踩雷"], ["boundaries", "你俩认真约定过、不该越过的线"], ["favorites", "你俩都喜欢的东西"], ["firsts", "你俩的那些第一次"]];
  TARGETS.couple = {
    zh: "情侣空间档案", read: () => [],
    before: (p, ctx) => { const [c, k] = S(p.id).split(":"); const f = COUPLE_FIELDS.find(x => x[0] === k); return f ? f[1] + "：" + (S((((ctx.coupleHomeOf && ctx.coupleHomeOf(c)) || {}).archive || {})[k]) || "（空）") : ""; },
    write: (id, patch, ctx) => {
      const [c, k] = S(id).split(":");
      if (!COUPLE_FIELDS.some(x => x[0] === k)) throw new Error("档案里没有「" + k + "」这一栏");
      if (!ctx.onSaveCoupleHome) throw new Error("这个页面没接情侣空间写入口");
      if (!(ctx.characters || []).some(x => x && x.id === c)) throw new Error("找不到这个角色");
      ctx.onSaveCoupleHome(c, cur => Object.assign({}, cur, { archive: Object.assign({}, (cur && cur.archive) || {}, { [k]: S(patch.text).trim().slice(0, 260) }) }));
      return 1;
    }
  };
  // 愿望板：id＝「角色id:new」新许一个／「角色id:愿望id」改或删；name＝愿望，text＝备注，type＝一起做/一起去/一起吃/一起学/想送 TA；done:true 标成做到了
  const WISH_TYPES = ["一起做", "一起去", "一起吃", "一起学", "想送 TA"];
  TARGETS.wish = {
    zh: "愿望板", read: () => [],
    write: (id, patch, ctx) => {
      const [c, w] = S(id).split(":");
      if (!ctx.onSaveCoupleHome) throw new Error("这个页面没接情侣空间写入口");
      if (!(ctx.characters || []).some(x => x && x.id === c)) throw new Error("找不到这个角色");
      const cur = ((ctx.coupleHomeOf && ctx.coupleHomeOf(c)) || {}).wishes || [];
      const now = Date.now(), type = WISH_TYPES.indexOf(S(patch.type)) >= 0 ? S(patch.type) : null;
      if (!w || w === "new") {
        const title = S(patch.name).trim(); if (!title) throw new Error("愿望要有个名字");
        ctx.onSaveCoupleHome(c, h => Object.assign({}, h, { wishes: [{ id: "wish_" + now + "_" + Math.random().toString(36).slice(2, 6), title: title.slice(0, 60), type: type || "一起做",
          note: S(patch.text).trim().slice(0, 80), status: "wish", createdAt: now, updatedAt: now }].concat((h && h.wishes) || []) }));
        return 1;
      }
      if (!cur.some(x => x && x.id === w)) throw new Error("愿望板上找不到这一条了");
      ctx.onSaveCoupleHome(c, h => Object.assign({}, h, { wishes: ((h && h.wishes) || []).filter(x => !(patch.drop && x && x.id === w)).map(x => x && x.id === w ? Object.assign({}, x,
        S(patch.name).trim() ? { title: S(patch.name).trim().slice(0, 60) } : {}, S(patch.text).trim() ? { note: S(patch.text).trim().slice(0, 80) } : {}, type ? { type } : {},
        patch.done ? { status: "done" } : {}, { updatedAt: now }) : x) }));
      return 1;
    }
  };
  // 纪念日：id＝「角色id:new」／纪念日 id（删＝drop）；name＝叫什么，date＝03-14 或 2024-03-14，yearly 默认每年重复
  TARGETS.anniv = {
    zh: "纪念日", read: () => [],
    write: (id, patch, ctx) => {
      const [c, a] = S(id).split(":");
      if (a && a !== "new") {
        if (!patch.drop) throw new Error("纪念日只能新建或删掉；要改就删了重建");
        if (!ctx.onRemoveAnniv) throw new Error("这个页面没接纪念日写入口");
        if (!((ctx.annivList && ctx.annivList()) || []).some(x => x && x.id === a)) throw new Error("找不到这个纪念日了");
        ctx.onRemoveAnniv(a); return 1;
      }
      if (!ctx.onAddAnniv) throw new Error("这个页面没接纪念日写入口");
      const ch = (ctx.characters || []).find(x => x && x.id === c); if (!ch) throw new Error("找不到这个角色");
      const m = /^(?:(\d{4})-)?(\d{1,2})-(\d{1,2})$/.exec(S(patch.date).trim()); if (!m) throw new Error("日期写成 03-14 或 2024-03-14");
      const name = S(patch.name).trim(); if (!name) throw new Error("纪念日要有个名字");
      ctx.onAddAnniv(ch, name, +m[2], +m[3], !(patch.yearly === false || patch.yearly === "false"), false, m[1] ? +m[1] : null);
      return 1;
    }
  };
  // 表情包给谁用：id＝表情包 id，text＝「全局」或者几个角色名（顿号隔开）＝只给这几个人
  TARGETS.emote = {
    zh: "表情包分配", read: () => [],
    before: (p, ctx) => { const k = ((ctx.emotePacks && ctx.emotePacks()) || []).find(x => x && x.id === S(p.id)); return k ? "「" + k.name + "」：" + (k.global ? "全局" : whoNames(ctx, k.charIds)) : ""; },
    write: (id, patch, ctx) => {
      const packs = (ctx.emotePacks && ctx.emotePacks()) || [];
      if (!ctx.onSaveEmotePacks) throw new Error("这个页面没接表情包写入口");
      const k = packs.find(x => x && x.id === S(id)); if (!k) throw new Error("找不到这套表情包");
      const t = S(patch.text).trim();
      if (/^(全局|所有人|大家|global)$/i.test(t)) { if (ctx.onSaveEmotePacks(packs.map(x => x.id === k.id ? Object.assign({}, x, { global: true }) : x)) === false) throw new Error("没存上：本地空间可能满了"); return 1; }
      const chars = ctx.characters || [];
      const ids = t.split(/[,，、\s]+/).filter(Boolean).map(n => { const c = chars.find(x => x && (x.id === n || x.name === n || x.remark === n)); if (!c) throw new Error("没有叫「" + n + "」的角色"); return c.id; });
      if (!ids.length) throw new Error("写「全局」，或者写给哪几个人");
      if (ctx.onSaveEmotePacks(packs.map(x => x.id === k.id ? Object.assign({}, x, { global: false, charIds: Array.from(new Set(ids)) }) : x)) === false) throw new Error("没存上：本地空间可能满了");
      return 1;
    }
  };
  const whoNames = (ctx, ids) => (ids || []).map(i => { const c = (ctx.characters || []).find(x => x && x.id === i); return c ? (c.remark || c.name) : null; }).filter(Boolean).join("、") || "（谁都没给）";

  function snapshotExtra2(ctx, hot) {
    const chars = (ctx.characters || []).filter(c => c && hot.has(c.id));
    const out = {};
    const groups = ((ctx.groupsList && ctx.groupsList()) || []).filter(g => g && (!hot.size || (g.memberIds || []).some(i => hot.has(i)) || hot.has(g.id))).slice(0, 8);
    if (groups.length) out.群聊设置 = groups.map(g => { const s = (ctx.groupSettingsOf && ctx.groupSettingsOf(g.id)) || {}; return { 群: g.name, id: g.id, 现在: GROUP_SETTINGS.map(d => d.key + "=" + showVal(d, s[d.key], ctx)).join("；") }; });
    out.线下设置 = chars.map(c => { const s = (ctx.offlineSettingsOf && ctx.offlineSettingsOf(c.id)) || {}; return { 谁: c.name, id: c.id, 现在: OFFLINE_SETTINGS.map(d => d.key + "=" + showVal(d, s[d.key], ctx)).join("；") }; });
    const g = (ctx.globalsGet && ctx.globalsGet()) || {};
    out.全局设置 = GLOBALS.map(d => d.key + "=" + (d.key === "bgApi" ? (g.bgApi === "__off__" ? "无" : (((ctx.apiProfiles || []).find(r => r.id === g.bgApi) || {}).name || "跟随线上")) : showVal(d, g[d.key], ctx))).join("；");
    out.行程 = chars.map(c => { const book = (ctx.schedOf && ctx.schedOf(c.id)) || {}; const days = Object.keys(book).sort().slice(-4);
      return { 谁: c.name, id: c.id, 天: days.map(d => ({ 日期: d, 段: ((book[d] || {}).seqs || []).filter(Boolean).map(r => r.seq + ". " + (r.time || "") + " " + clip(r.title, 30) + (r.location ? " @ " + clip(r.location, 20) : "")) })) }; });
    const ann = (ctx.annivList && ctx.annivList()) || [];
    out.情侣空间 = chars.map(c => { const h = (ctx.coupleHomeOf && ctx.coupleHomeOf(c.id)) || {}; const a = h.archive || {};
      // 先说开没开：没开的人，底下那些档案、愿望都是空的，别当成「已经在一起了」
      const cp = ctx.coupleOf ? ctx.coupleOf(c.id) : null, rl = cp && window.spaceRel ? window.spaceRel(cp) : null;
      return { 谁: c.name, id: c.id, 空间: !cp ? "没开（你们还不是恋人，也没有别的关系空间）" : cp.status === "together" ? "开着 · " + (rl ? rl.space + "（" + rl.zh + "）" : "情侣空间") : cp.status === "pending" ? "邀请还没回应" : "没开", 档案: COUPLE_FIELDS.map(([k, zh]) => k + "（" + zh + "）=" + (clip(a[k], 120) || "空")),
        愿望板: (h.wishes || []).filter(Boolean).slice(0, 20).map(w => ({ id: w.id, 愿望: clip(w.title, 40), 类: w.type, 状态: w.status === "done" ? "做到了" : "还没" })),
        纪念日: ann.filter(x => x && x.characterId === c.id).map(x => ({ id: x.id, 名字: x.name, 日期: (x.year ? x.year + "-" : "") + x.month + "-" + x.day })) }; });
    out.表情包 = ((ctx.emotePacks && ctx.emotePacks()) || []).slice(0, 30).map(k => ({ id: k.id, 名字: k.name, 几张: (k.emotes || []).length, 给谁: k.global ? "全局" : whoNames(ctx, k.charIds) }));
    return out;
  }

  const LORE_STAMPS = { chat: "聊天与线下", subjects: "查手机", lifestyle: "生活功能", diary: "日记", study: "共读学习", creative: "故事创作", social: "公开世界", debate: "擂台" };
  function docLines2() {
    const list = (L, pre) => L.map(d => "    " + d.key + "「" + d.zh + "」（" + valDoc(d) + "）：" + d.what).join("\n");
    return "· gsetting 某个【群】的设置（id＝「群id:设置名」，text＝新值）。快照【群聊设置】是现在的值：\n" + list(GROUP_SETTINGS) + "\n"
      + "· osetting 某个人（或某个群）的【线下设置】（见面页右上角；id＝「角色id或群id:设置名」）。快照【线下设置】是现在的值：\n" + list(OFFLINE_SETTINGS) + "\n"
      + "· global 整个 app 的开关（id＝下面的名字，text＝新值）。快照【全局设置】是现在的值：\n" + list(GLOBALS) + "\n"
      + "  她说「网易云搜不到／播不了／接口挂了」，直接出 global musicProvider → GD音乐台 的卡。\n"
      + "· sched 改某人行程里的一段（快照【行程】；id＝「角色id:日期:段号」，name＝做什么，text＝在哪，time＝几点如 09:30，只填要改的）。整周重排让她去行程页点「AI 排」。\n"
      + "· couple 情侣空间档案的一栏（id＝「角色id:栏名」，text＝这一栏改完的整段，最多 260 字）。栏名：" + COUPLE_FIELDS.map(x => x[0] + "＝" + x[1]).join("、") + "。只记她亲口给的，别替她编你俩的事。\n"
      + "· wish 愿望板（id＝「角色id:new」许一个／「角色id:愿望id」改；name＝愿望，text＝备注，type＝" + WISH_TYPES.join("/") + "；\"done\":true 标成做到了；\"drop\":true 删）。\n"
      + "· anniv 纪念日（id＝「角色id:new」，name＝叫什么，date＝03-14 或 2024-03-14，\"yearly\":false＝不每年重复；删＝「角色id:纪念日id」＋\"drop\":true）。\n"
      + "· emote 表情包给谁用（id＝表情包 id，text＝「全局」或者几个角色名用顿号隔开＝只给这几个人用）。快照【表情包】写着现在每套给了谁。\n"
      + "· 【世界书怎么起作用】（她问、或者你写 lore 卡时照这个来）：\n"
      + "    分类（cat）：世界观/地点/组织/人物/规则/共同经历/用语＝事实，他知道但不会因此去做什么；照做＝指令，被翻出来那一轮他照着做（比如提到冰箱就发一张 HTML 小卡），排在最后念、格式规矩压不住它；生图＝只拼进画图的画面要求，聊天里一个字都不带（画风、配色、服装建筑），改不动身份锁里的长相年龄；其他。\n"
      + "    什么时候出现：always:true 每次常驻（紧跟人设，他最看得见，最要紧的放这）；填 keyword＝最近聊天里出现关键词才翻出来（可当正则；生图类对的是这张图的画面描述）。\n"
      + "    给谁（bind）：不填＝所有角色共用；填几个名字＝只给他们和有他们在的群。\n"
      + "    去哪（stamps，用顿号隔开）：" + Object.values(LORE_STAMPS).join("、") + "。不填默认只去「聊天与线下」。一处没盖就发不出去。\n"
      + "    顺序（priority 1–5）：越大越靠前。\n"
      + "    他好像不读世界书：查①停用了或一处没盖 ②绑给了别人 ③关键词最近没提到 ④在小房间里聊、那间房关了世界书。都对还不认＝条目太多太长，最要紧的挪进人设。\n"
      + "    跟人设打架的要删一边，别两头写。\n"
      + "· 【生图能干啥】她问「能画什么」照攻略里「能生图的地方」那一条讲（都要先在 设置 → 图像 API 配好；要锁脸得先在人格档案馆传参考照）。照片日记绝不自动拍。\n";
  }
  const _snap1 = snapshotExtra, _doc1 = docLines;
  snapshotExtra = (ctx, hot) => Object.assign(_snap1(ctx, hot), snapshotExtra2(ctx, hot));
  docLines = () => _doc1() + docLines2();
  const okWithoutText1 = okWithoutText;
  okWithoutText = x => okWithoutText1(x) || (/^(sched|wish|anniv)$/.test(x.target) && S(x.id).trim() && (S(x.name).trim() || S(x.time).trim() || x.drop === true || x.drop === "true" || x.done === true || x.done === "true"));

  // ════ 文风台（她 2026-10-16「文风台秋秋能搞吗，比如给它文件」）════
  //   preset：新建一份预设——text 是模块清单 JSON：[{"name","hint","text"} 新写的一条 | {"use":"内置模块id"} 勾一条现成的]，name＝预设名
  //   presetmod：改已有预设里的一条——id＝「预设id:模块id」改那一条（name/text）、加 drop 从这份预设里拿掉；
  //              「预设id:new」往这份里加一条新写的；「预设id:+模块id」把一条现成的勾进来
  //   新写的模块落在「秋秋写的」那一格，跟自己写的一样能改能删、能被别的预设勾。
  const SP = () => (typeof window !== "undefined" && window.StylePresets) || null;
  const parseMods = t => { try { const a = JSON.parse(S(t)); return Array.isArray(a) ? a : (a && Array.isArray(a.mods) ? a.mods : null); } catch (e) { return null; } };
  const newMod = (m, i) => ({ id: "um_qq_" + Date.now().toString(36) + "_" + i, cat: "qiuqiu", catZh: "秋秋写的", catHint: "秋秋帮你写的模块", name: S(m.name).trim().slice(0, 24), hint: S(m.hint).trim().slice(0, 40) || "秋秋写的", text: S(m.text).trim() });
  TARGETS.preset = {
    zh: "文风台预设", read: () => [],
    write: (id, patch, ctx) => {
      const P = SP(); if (!P) throw new Error("这台设备没有文风台");
      const mods = parseMods(patch.text); if (!mods || !mods.length) throw new Error("模块清单读不出来");
      const fresh = [], ids = [];
      mods.forEach((m, i) => {
        if (m && m.use) { if (!P.moduleById(S(m.use))) throw new Error("没有「" + m.use + "」这个模块"); ids.push(S(m.use)); return; }
        const nm = newMod(m || {}, i); if (!nm.name || !nm.text) throw new Error("第 " + (i + 1) + " 条缺名字或内容");
        fresh.push(nm); if (!(m && (m.off === true || m.off === "true"))) ids.push(nm.id);
      });
      if (fresh.length) P.importBundle({ modules: fresh });
      const name = S(patch.name).trim() || "秋秋搭的预设";
      P.upsert({ id: "sp_qq_" + Date.now().toString(36), name: name.slice(0, 24), mods: ids, free: "", freePos: "after", ts: Date.now() });
      return 1;
    }
  };
  TARGETS.presetmod = {
    zh: "文风台预设里的一条", read: () => [],
    before: (p) => { const P = SP(); if (!P) return ""; const [pid, mid] = S(p.id).split(":"); const m = mid && mid !== "new" && mid[0] !== "+" ? P.moduleById(mid) : null; return m ? m.name + "：" + clip(m.text, 300) : ""; },
    write: (id, patch, ctx) => {
      const P = SP(); if (!P) throw new Error("这台设备没有文风台");
      const [pid, mid] = S(id).split(":"); const pr = P.byId(pid); if (!pr) throw new Error("文风台里找不到这份预设");
      const mods = Array.isArray(pr.mods) ? pr.mods.slice() : [];
      if (mid === "new") {
        const nm = newMod({ name: patch.name, hint: patch.occasion, text: patch.text }, 0); if (!nm.name || !nm.text) throw new Error("新的这一条要有名字和内容");
        P.importBundle({ modules: [nm] }); P.upsert(Object.assign({}, pr, { mods: mods.concat([nm.id]), ts: Date.now() })); return 1;
      }
      if (mid && mid[0] === "+") { const u = mid.slice(1); if (!P.moduleById(u)) throw new Error("没有「" + u + "」这个模块"); if (mods.indexOf(u) < 0) P.upsert(Object.assign({}, pr, { mods: mods.concat([u]), ts: Date.now() })); return 1; }
      if (mods.indexOf(mid) < 0) throw new Error("这份预设里没有这一条");
      if (patch.drop) { P.upsert(Object.assign({}, pr, { mods: mods.filter(x => x !== mid), ts: Date.now() })); return 1; }
      const cur = P.moduleById(mid) || {};
      P.saveModuleEdit(mid, { name: S(patch.name).trim() || cur.name, hint: cur.hint, text: S(patch.text).trim() });
      return 1;
    }
  };
  function snapshotStyle() {
    const P = SP(); if (!P) return {};
    const presets = (P.list() || []).slice(0, 12).map(p => ({ 预设id: p.id, 名字: p.name, 模块: (p.mods || []).map(id => { const m = P.moduleById(id); return m ? { id, 名字: m.name, 管什么: m.hint } : { id, 名字: "（找不到了）" }; }), 手写段: p.free ? clip(p.free, 120) : undefined }));
    const lib = (P.allCats() || []).map(c => ({ 分类: c.zh, 模块: (c.mods || []).map(m => m.id + "「" + m.name + "」" + (m.hint ? "：" + m.hint : "")) }));
    return { 文风台预设: presets.length ? presets : "（还没有预设）", 文风台模块库: lib };
  }
  const _snap2 = snapshotExtra, _doc2 = docLines;
  snapshotExtra = (ctx, hot) => Object.assign(_snap2(ctx, hot), snapshotStyle());
  docLines = () => _doc2() + "· preset 文风台的一份新预设（她发文风文件、别处的预设 json，或者说想要什么样的笔法时）：把内容拆成一条一条的模块，每条只管一件事（镜头／排版／节拍／去八股／对话……），"
    + "name＝预设名，text＝模块清单 JSON 数组，每项 {\"name\":\"短名\",\"hint\":\"一句管什么\",\"text\":\"给模型的那段要求\"}；快照【文风台模块库】里已有意思一样的就别重写，写 {\"use\":\"模块id\"} 勾现成的。"
    + "顺序就是喂进去的顺序，越靠后越有分量，最容易被违反的那条放最后。只拆笔法，讲人设、剧情、事实的内容不进预设。\n"
    + "· presetmod 改快照【文风台预设】里某一份的一条：id＝「预设id:模块id」，name/text 写改完的（改的是这条模块本身，别的预设勾了它也跟着变）；\"drop\":true＝只从这份预设里拿掉；"
    + "「预设id:new」加一条新写的（name、text，occasion 写一句管什么）；「预设id:+模块id」把一条现成的勾进来。她问「这份为什么写成这样」，照快照里每条管什么指给她看。\n"
    + "  原来那个 style 卡（见面的自定义文风，整篇一段）照旧在；她说文风台、预设、模块、测试台时用 preset／presetmod。\n";
  const _ok2 = okWithoutText;
  okWithoutText = x => _ok2(x) || (x.target === "presetmod" && S(x.id).trim() && (x.drop === true || x.drop === "true" || /:\+/.test(S(x.id))));

  // ════ 小世界（她 2026-10-16「小世界那些做了吧」）：只放开设置类，游戏进度一笔不碰 ════
  //   dayset：TA的一天——「角色id:thoughts」开／关此刻的念头；「角色id:clock」按TA的时间／按现实时间（走小世界自己那支 durable 写口）
  //   look：小人的颜色——id＝角色id，text＝JSON {skin, eye, hairColor, hairColor2}，都是 #六位色号；发型、衣服款式在小世界面板里挑
  //   gardenpartner：某一档换同行者——id＝存档id，text＝角色名／id，或「一个人」；庭院房那种绑死一个人的不让换
  const LS = (k, d) => { try { return typeof loadJSON === "function" ? loadJSON(k, d) : d; } catch (e) { return d; } };
  const charBy = (ctx, t) => (ctx.characters || []).find(c => c && (c.id === S(t).trim() || c.name === S(t).trim() || c.remark === S(t).trim()));
  TARGETS.dayset = {
    zh: "TA的一天设置", read: () => [],
    write: (id, patch, ctx) => {
      const K = typeof window !== "undefined" && window.CharDayKit; if (!K || !K.saveHomeChange) throw new Error("这台设备没有小世界");
      const [cid, what] = S(id).split(":"); if (!charBy(ctx, cid)) throw new Error("找不到这个角色");
      const t = S(patch.text).trim();
      if (what === "thoughts") { if (!yes(t) && !no(t)) throw new Error("念头只能开或关"); return K.saveHomeChange(cid, "thoughts", raw => Object.assign({}, raw || {}, { enabled: yes(t) })).then(() => 1); }
      if (what === "clock") { const mode = /现实|real/i.test(t) ? "real" : /TA|角色|auto|跟/i.test(t) ? "auto" : ""; if (!mode) throw new Error("活动时间只能「按TA的时间走」或「按现实时间走」"); return K.saveHomeChange(cid, "clockModes", mode).then(() => 1); }
      throw new Error("TA的一天里没有「" + what + "」这一项");
    }
  };
  const HEX = v => /^#[0-9a-f]{6}$/i.test(S(v).trim()) ? S(v).trim().toLowerCase() : null;
  TARGETS.look = {
    zh: "小人的颜色", read: () => [],
    before: p => { const l = ((LS("x_companion", {}) || {}).looks || {})[S(p.id)] || {}; return ["skin", "eye", "hairColor", "hairColor2"].filter(k => l[k]).map(k => k + "=" + l[k]).join("，") || "（还是默认的）"; },
    write: (id, patch, ctx) => {
      if (!charBy(ctx, id)) throw new Error("找不到这个角色");
      let o = null; try { o = JSON.parse(S(patch.text)); } catch (e) {}
      if (!o || typeof o !== "object") throw new Error("颜色要写成 {\"hairColor\":\"#6b4a33\"} 这样");
      const ch = {}; ["skin", "eye", "hairColor", "hairColor2"].forEach(k => { if (o[k] != null) { const v = HEX(o[k]); if (!v) throw new Error(k + " 要是 #六位色号"); ch[k] = v; } });
      if (!Object.keys(ch).length) throw new Error("这张卡什么颜色都没改");
      const cfg = LS("x_companion", {}) || {}, looks = Object.assign({}, cfg.looks || {});
      looks[id] = Object.assign({}, looks[id] || {}, ch);
      const next = Object.assign({}, cfg, { looks });
      saveJSON("x_companion", next);
      try { if (window.__companionChanged) window.__companionChanged(next); } catch (e) {}
      return 1;
    }
  };
  const GARDEN_WORLD_ZH = { garden: "微光庭院", train: "远行列车", pets: "绒绒小镇" };
  const gardenKey = id => id === "legacy" ? "x_fairyGarden" : "x_fairyGarden:" + id;
  const gardenSaves = () => (LS("x_fairyGardenSaves", []) || []).filter(x => x && x.id && String(x.id)[0] !== ":");
  TARGETS.gardenpartner = {
    zh: "小世界存档的同行者", read: () => [],
    before: (p, ctx) => { const d = LS(gardenKey(S(p.id)), null); if (!d) return ""; const c = charBy(ctx, d.partnerId); return c ? c.name : "一个人"; },
    write: (id, patch, ctx) => {
      const sid = S(id); if (sid[0] === ":" || sid.indexOf("::") >= 0) throw new Error("这一档是从小房间开的，绑定了那个人，换人请另开一档");
      if (!gardenSaves().some(x => x.id === sid) && sid !== "legacy") throw new Error("找不到这一档");
      const d = LS(gardenKey(sid), null); if (!d) throw new Error("这一档还没开始玩，进去挑同行者就好");
      const t = S(patch.text).trim(), solo = /^(一个人|没有|不要|无)$/.test(t);
      const c = solo ? null : charBy(ctx, t); if (!solo && !c) throw new Error("没有叫「" + t + "」的角色");
      saveJSON(gardenKey(sid), Object.assign({}, d, { partnerId: c ? c.id : "" }));
      return 1;
    }
  };
  function snapshotWorld(ctx, hot) {
    const chars = (ctx.characters || []).filter(c => c && hot.has(c.id)), homes = LS("x_charDayHomes", {}) || {}, looks = (LS("x_companion", {}) || {}).looks || {};
    const out = {};
    if (chars.length) out.TA的一天 = chars.map(c => ({ 谁: c.name, id: c.id, 此刻的念头: ((homes.thoughts || {})[c.id] || {}).enabled === true ? "开" : "关",
      活动时间: (homes.clockModes || {})[c.id] === "real" ? "按现实时间走" : "按TA的时间走",
      小人颜色: ["skin", "eye", "hairColor", "hairColor2"].filter(k => (looks[c.id] || {})[k]).map(k => k + "=" + looks[c.id][k]).join("，") || "默认" }));
    const saves = gardenSaves().slice(0, 12).map(x => { const d = LS(gardenKey(x.id), null) || {}; const p = charBy(ctx, d.partnerId);
      return { 存档id: x.id, 名字: x.name || "（没起名）", 世界: GARDEN_WORLD_ZH[x.world] || x.world, 同行者: p ? p.name : (d.partnerId ? "（档案里没这个人了）" : "一个人"), 开始玩了: !!LS(gardenKey(x.id), null) }; });
    if (saves.length) out.小世界存档 = saves;
    return out;
  }
  const _snap3 = snapshotExtra, _doc3 = docLines;
  snapshotExtra = (ctx, hot) => Object.assign(_snap3(ctx, hot), snapshotWorld(ctx, hot));
  docLines = () => _doc3() + "· 小世界只放开这几样设置（游戏进度、背包、花、钱、种子这些一律不改，她要改就照攻略告诉她怎么在游戏里做）：\n"
    + "  dayset TA的一天：id＝「角色id:thoughts」text 开／关＝此刻的念头；「角色id:clock」text＝按TA的时间走／按现实时间走。快照【TA的一天】是现在的样子。\n"
    + "  look 小人的颜色（陪伴、庭院、TA的一天共用一份）：id＝角色id，text＝JSON，只认 skin（肤色）、eye（眼睛）、hairColor（发色）、hairColor2（挑染）四样，都是 #六位色号，她说颜色名你换成色号；发型、衣服款式让她去小世界的「改外貌」里挑。\n"
    + "  gardenpartner 某一档换同行者：id＝快照【小世界存档】里的存档id，text＝角色名，或「一个人」。从小房间开的庭院房绑死那个人，不能换。\n"
    + "  她问小世界怎么玩，照攻略「小世界」那条讲；快照里看得到她开了哪几档、各是哪个世界、跟谁。\n";

  // ── 带她去那一页（她 2026-10-16：「不止知道东西在哪里，还可以出一个跳转卡，按了就能带到那个页面」）──
  //   id＝攻略里那一条的 id（目录里每条都有）；按了就开那条所在的 app。不改任何东西，所以不进撤回本。
  // 往里那一格的中文名：卡上「去哪儿」那一行用，也写进给秋秋的说明里
  const OPEN_SUB_ZH = { api: "接哪些模型", apiText: "文字模型", apiImage: "图像 API", apiTts: "语音 API", apiVideo: "视频 API", apiEmbed: "向量记忆", apiStt: "语音识别",
    apiEars: "真声耳朵", apiMouth: "电台嗓子", apiCache: "额度与缓存", sense: "他们知道现在几点、我在哪", cot: "创作小稿", look: "这个 app 长什么样", theme: "外观与壁纸",
    themeStudio: "主题工作台", bubble: "聊天气泡", write: "他们写出来的东西", auto: "谁会自己动", data: "我的东西存在哪", debug: "上一轮到底发了什么",
    "data/inner-life": "人格试点", "data/storage": "本地空间", "data/photos": "本机照片库", "data/cloud": "云同步", "data/backup": "导入与导出", "data/rescue": "找回失联的角色",
    real: "现实地图", story: "架空地图" };
  // 别的 app 里面那一格（她 2026-10-16「别的 app 不能都搞具体跳转吗」）：攻略那条 id/这里的键
  const OPEN_APP_SUBS = {
    fanfic: { feed: "首页刷文", shelf: "书架", publish: "自己写一篇", rp: "加笔（穿书改写）", authors: "作者", mine: "我的" },
    study: { teach: "认真教", costudy: "一起研究", nv1: "一教一学", tb: "我来教" },
    ledger: { wallet: "钱包", stats: "统计", cal: "日历", me: "我的" },
    memo: { reminders: "提醒", notes: "备忘" },
    weekly: { cover: "本期封面", issue: "翻这一期", shelf: "往期书架" },
    dreamjournal: { hers: "她的梦", theirs: "TA们的梦" },
    stylelab: { build: "做预设", test: "试写" },
    health: { today: "今天", body: "身体" },
    astro: { today: "今日", pair: "配对", chart: "星盘", group: "群榜" },
    debate: { setup: "开一场新的" }, dream: { setup: "开一场新的" }, theater: { create: "新建一出" }, trpg: { create: "开一个新团" }
  };
  // 「信息」里面那四栏：chat/me 就是「我」那一栏（面具、自己的资料都在那儿）
  OPEN_APP_SUBS.chat = { chats: "聊天", contacts: "通讯录", moments: "朋友圈", me: "我（面具、自己的资料）" };
  const COUPLE_SUBS = { studio: "照相馆", gacha: "抽卡", letters: "情书", exdiary: "交换日记", album: "合照墙", timeline: "我们的日子", anniv: "纪念日",
    qa: "问答", wishes: "心愿", pacts: "约定", trip: "旅行", garden: "花园", jar: "存钱罐", drawer: "抽屉", firsts: "第一次", capsule: "时间胶囊",
    disc: "唱片架", recall: "回忆", ifroom: "另一种我们", makeup: "和好", archive: "档案" };
  Object.keys(OPEN_APP_SUBS).forEach(a => Object.keys(OPEN_APP_SUBS[a]).forEach(k => { if (!OPEN_SUB_ZH[k]) OPEN_SUB_ZH[k] = OPEN_APP_SUBS[a][k]; }));
  Object.keys(COUPLE_SUBS).forEach(k => { if (!OPEN_SUB_ZH[k]) OPEN_SUB_ZH[k] = COUPLE_SUBS[k]; });
  // 卡上的 id 认不准时（她 2026-10-24 截图：秋秋写了「messages」，攻略里那条叫 chat）：
  //   先认攻略 id，再认 app 名、中文名，最后认几个顺手会写的英文叫法
  const OPEN_ID_ALIAS = { messages: "chat", message: "chat", msg: "chat", msgs: "chat", wechat: "chat", im: "chat", "信息": "chat",
    settings: "config", setting: "config", "设置": "config", characters: "cast", character: "cast", persona: "cast", memory: "memlib", memories: "memlib" };
  function openEntry(M, eid) {
    if (!M || !M.byId) return null;
    const k = S(eid).trim(), lo = k.toLowerCase();
    return M.byId(k) || M.byId(lo) || (OPEN_ID_ALIAS[lo] && M.byId(OPEN_ID_ALIAS[lo])) || (M.entries || []).find(x => x.app === lo) || (M.entries || []).find(x => x.zh === k) || null;
  }
  TARGETS.open = {
    zh: "带你去那一页",
    read: ctx => [],
    // id＝「攻略那条的 id」或「攻略那条的 id/往里那一格」（她 2026-10-16「搞能进那一格吧」）
    before: (p, ctx) => { const M = typeof window !== "undefined" && window.AssistantManual; const raw = S(p.id), i = raw.indexOf("/"); const e = openEntry(M, i < 0 ? raw : raw.slice(0, i)); return e ? "去「" + e.zh + "」" + (i >= 0 ? " → " + (OPEN_SUB_ZH[raw.slice(i + 1)] || raw.slice(i + 1)) : (e.where ? "（" + e.where + "）" : "")) : ""; },
    write: (id, patch, ctx) => {
      const M = typeof window !== "undefined" && window.AssistantManual;
      const raw = S(id), i = raw.indexOf("/"), eid = i < 0 ? raw : raw.slice(0, i), sub = i < 0 ? "" : raw.slice(i + 1);
      const e = openEntry(M, eid);
      if (!e) throw new Error("攻略里没有「" + eid + "」这一条");
      if (!ctx.onOpenPage) throw new Error("这个页面没接跳转的入口");
      if (!ctx.onOpenPage(e.app, e.id, sub)) throw new Error("「" + e.zh + (sub ? " → " + sub : "") + "」没法直接跳过去，照「" + (e.where || e.zh) + "」走");
      return 1;
    }
  };
  const _ok4 = okWithoutText;
  okWithoutText = x => _ok4(x) || (x.target === "open" && S(x.id).trim());
  const _doc4 = docLines;
  docLines = () => _doc4() + "  open 带她去那一页：她说想去做某件事、找某个功能（「我想搞个新世界地图」「表情包在哪」），除了告诉她在哪，再出一张 open 卡，她按一下就开到那一页。"
    + "id＝目录里那一条的 id，text 写按钮上那句话（比如「去架空地图」）。只是开页面，不改任何东西；一轮最多两张，别每句话都出。\n"
    + "    能直接进到里面那一格的，id 写成「那条的 id/那一格」：\n"
    + "    · config/页名，页名：" + Object.keys(OPEN_SUB_ZH).filter(k => k.indexOf("/") < 0 && k !== "real" && k !== "story").map(k => k + "＝" + OPEN_SUB_ZH[k]).join("、") + "；\n"
    + "      数据里那几块再往里一层：" + Object.keys(OPEN_SUB_ZH).filter(k => k.indexOf("data/") === 0).map(k => "config/" + k + "＝" + OPEN_SUB_ZH[k]).join("、") + "；\n"
    + "    · map/real＝现实地图、map/story＝架空地图（新建一个世界就在架空地图里）；\n"
    + "    · chat/角色id＝直接打开跟那个人的聊天，group/群id＝打开那个群（id 看快照，名字也认）。\n"
    + "    · couple/角色id/那一块＝跟那个人的情侣空间里直接进那一块（得是在一起的那个人）：" + Object.keys(COUPLE_SUBS).map(k => k + "＝" + COUPLE_SUBS[k]).join("、") + "；只写 couple/角色id 就停在空间首页；\n"
    + "    · 这几个 app 也能进到那一格，写「攻略那条的 id/键」（攻略那条 id 一般就是 app 名）：" + Object.keys(OPEN_APP_SUBS).map(a => a + "（" + Object.keys(OPEN_APP_SUBS[a]).map(k => k + "＝" + OPEN_APP_SUBS[a][k]).join("、") + "）").join("；") + "。\n"
    + "    别的地方只能开到那个 app 的首页，照攻略告诉她再点哪儿。\n";

  // ── 桌面布局（她 2026-10-16：「我的 xx app 在哪儿，她可以说在第几页」）────────
  //   读的就是主屏自己存的那两份（x_homeLayout 每页摆了什么、x_homeFolders 每个文件夹里装了什么），名字照主屏那张表叫
  const HOME_WIDGET_ZH = { card: "名片组件", cal: "日历组件", music: "歌单组件", map: "地图组件", us: "情侣条组件", memo: "备忘组件", weather: "天气组件",
    muyu: "木鱼组件", ledger: "账本组件", wheel: "转盘组件", recent: "最近组件", taday: "TA的一天组件" };
  function homeLayoutRows() {
    // 先问主屏此刻真画出来的那一份（含没存过时的默认布局），问不到才读盘
    const now = (typeof window !== "undefined" && typeof window.__homeNow === "function") ? window.__homeNow() : null;
    const L = now && Array.isArray(now.pages) ? Object.assign({}, now.pages) : (LS("x_homeLayout", {}) || {});
    const F = now && now.folders ? now.folders : (LS("x_homeFolders", {}) || {});
    const REG = (typeof window !== "undefined" && window.__homeReg) || {};
    const zhOf = k => { const it = REG[k]; if (it && it.zh) return it.zh; if (it && it.kind === "widget") return HOME_WIDGET_ZH[it.which] || k; if (/^d_/.test(k)) return it && it.decor && it.decor.type === "code" ? "自己写的小组件（id " + k + (Array.isArray(it.decor.imageRefs) && it.decor.imageRefs.length ? "，传了 " + it.decor.imageRefs.length + " 张图" : "") + "）" : "（你自己放的装饰）"; return k; };
    const pages = Object.keys(L).map(Number).filter(n => !isNaN(n)).sort((a, b) => a - b);
    const out = [];
    pages.forEach((n, i) => {
      const items = (L[n] || []).filter(k => !/^sp_/.test(k)).map(k => {
        if (/^f_/.test(k)) { const f = F[k] || {}; return "文件夹「" + (f.name || "没起名") + "」（里面：" + (f.keys || []).map(zhOf).join("、") + "）"; }
        return zhOf(k);
      });
      if (items.length) out.push("第" + (i + 1) + "页：" + items.join("、"));
    });
    const placed = new Set(); pages.forEach(n => (L[n] || []).forEach(k => placed.add(k)));
    Object.keys(F).forEach(fid => { if (!placed.has(fid)) out.push("没摆在任何一页上的文件夹「" + (F[fid].name || "") + "」：" + (F[fid].keys || []).map(zhOf).join("、")); });
    return out;
  }
  const _snap5 = snapshotExtra;
  snapshotExtra = (ctx, hot) => { const o = _snap5(ctx, hot); const rows = homeLayoutRows(); if (rows.length) o.桌面布局 = rows; return o; };
  const _doc5 = docLines;
  docLines = () => _doc5() + "· 快照【桌面布局】是她主屏现在真实的样子：第几页、按顺序摆了什么、每个文件夹里装着什么。她问「xx 在哪儿」就照它说（第几页、在不在哪个文件夹里）；"
    + "主屏上没有的，再照攻略说从哪儿进。页数从左往右数，第1页是最左边那页。\n";

  // ── 「自己写」小组件（她 2026-10-22：「秋秋能帮忙写不」）──────────────────
  //   id＝new 新摆一件；id＝快照【桌面布局】里那件「自己写的小组件（id d_…）」就换掉它的代码。text＝整段 HTML。name 可填尺寸 id。
  //   写进桌面走主屏那一处（window.__homePutCodeDecor），跟编辑页「放上去」同一个口子。
  TARGETS.widget = {
    zh: "桌面小组件",
    read: () => [],
    before: p => { const it = ((typeof window !== "undefined" && window.__homeReg) || {})[S(p.id)]; return it && it.decor ? "原来的代码 " + String(it.decor.detail || "").length + " 字" : "（新摆一件）"; },
    write: (id, patch) => {
      if (typeof window === "undefined" || typeof window.__homePutCodeDecor !== "function") throw new Error("主屏还没打开过，回主屏再点一次");
      window.__homePutCodeDecor(S(id) === "new" ? "" : S(id), S(patch.text), S(patch.name).trim());
      return 1;
    }
  };
  const _doc6 = docLines;
  docLines = () => _doc6() + "  widget 桌面上「自己写」的小组件：她要一个自己定样子的小组件（时钟、倒数、一句话、小动画……），你写一段 HTML 当 text（可以带 <style> 和 <script>），"
    + "id 写 new 就新摆一件；要改快照【桌面布局】里已有的那件「自己写的小组件（id d_…）」，id 就写那个 d_ 开头的 id，text 是改好后的整段代码。name 可选尺寸：short 2×1、square 2×2、wide 4×1、large 4×2、huge 4×4、three 3×1、threetall 3×2，不填就是 square。\n"
    + "    它画在一个隔开的小窗里：读不到 app 的任何数据（角色、聊天、她的名字都拿不到，要用就直接写进代码里），也不能联网取数据，不能点；背景默认透明，会透出她的壁纸。\n"
    + "    要放她自己的照片：你拿不到图，让她在那件组件的编辑页「＋ 加一张图」传上去，代码里写 {{图1}}、{{图2}}…（按她传的顺序）就是那几张，比如 <img src=\"{{图1}}\">；网上的图直接写网址也行。\n"
    + "    尽量短，一般几十行以内；字号、留白照小格子来，内容要在窄窗里也排得下。\n";

  const api = { GROUP_SETTINGS, OFFLINE_SETTINGS, GLOBALS, LORE_STAMPS, SETTINGS, SET_BY, TARGETS, okWithoutText, snapshotExtra, docLines, parseVal, roomSwitchRows, DANGER_WARN };
  if (typeof window !== "undefined") window.AssistExtras = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})();
