// ============================================================
// 配件（本地直连）— Lovense Standard API 本地命令，纯前端，不依赖 Mac/后端
// 架构：iPhone 上 Lovense Remote(开 Game Mode) = 蓝牙主机 + 本地 HTTPS 服务，
//       本 app 直接 POST 到 https://<域名>:<端口>/command 控制。域名带有效证书(*.lovense.club)绕过混合内容。
// UI 隐身：默认不出现，设置·数据 tab 连点「数据」7 下解锁（x_toyUnlocked）。配置只存本机、不进云同步。
// ============================================================
function loadToyCfg() {
  const DFT = { url: "", platform: "LisaPhone", enabled: false, cap: 12, fn: "Vibrate" };
  try {
    const c = JSON.parse(localStorage.getItem("x_toy") || "null");
    if (c && typeof c === "object") {
      const m = Object.assign({}, DFT, c);
      // ⚠️v53.59 回滚：v53.58 曾把默认动作设成 "All"、波形 F: 留空——文档虽合法，但实机(Ferri 等震动款)不认，
      //   直接导致「连普通调用都不行」。这里把【非用户亲手选过】的 All 一次性改回 Vibrate；
      //   用户自己在设置里点过（fnPicked）就尊重她的选择，不再回滚。
      if (m.fn === "All" && !m.fnPicked) m.fn = "Vibrate";
      if (!TOY_FN_MAX_SAFE(m.fn)) m.fn = "Vibrate";
      return m;
    }
  } catch (e) {}
  return Object.assign({}, DFT);
}
// 提前声明用的小守卫（TOY_FN_MAX 在下方定义，这里做惰性查表，避免加载顺序问题）
function TOY_FN_MAX_SAFE(f) { try { return !!(TOY_FN_MAX && TOY_FN_MAX[f]); } catch (e) { return true; } }
function toyCap() { const c = loadToyCfg(); const n = Math.round(c.cap); return isNaN(n) ? 12 : Math.max(1, Math.min(20, n)); }
function saveToyCfg(c) { const clean = Object.assign(loadToyCfg(), c || {}); try { localStorage.setItem("x_toy", JSON.stringify(clean)); } catch (e) {} return clean; }
// ── 设备功能（v53.58，照 Lovense 官方文档）──
// 只会说「震动」是不够的：抽插/旋转/气泵/吸吮款根本不吃 Vibrate，接上就「用不了」。
// All = 通吃该设备所有可用功能（默认）；Pattern 的 F: 留空同理。强度上限各不相同，必须分别钳制。
const TOY_FN_LETTER = { Vibrate: "v", Rotate: "r", Pump: "p", Thrusting: "t", Fingering: "f", Suction: "s", Depth: "d", Oscillate: "o", All: "" };
const TOY_FN_MAX = { Vibrate: 20, Rotate: 20, Pump: 3, Thrusting: 20, Fingering: 20, Suction: 20, Depth: 3, Stroke: 100, Oscillate: 20, All: 20 };
const TOY_FN_LIST = ["All", "Vibrate", "Rotate", "Thrusting", "Oscillate", "Suction", "Fingering", "Pump", "Depth", "Stroke"];
function toyFn() { const f = (loadToyCfg().fn || "All"); return TOY_FN_MAX[f] ? f : "All"; }
// 该功能下的实际强度天花板 = 用户设的 cap 与该功能物理上限取小（气泵/深度只有 0~3，发 20 会越界）
function toyEffMax() { return Math.max(1, Math.min(toyCap(), TOY_FN_MAX[toyFn()] || 20)); }
function toyReady(c) { c = c || loadToyCfg(); return !!(c.enabled && c.url); }
// 归一本地地址：削尾 /command、去尾斜杠。用户从 Lovense Remote 的 Game Mode 页面抄「域名:端口」。
function toyBase(url) {
  let u = String(url || "").trim().replace(/\s+/g, "");
  if (!u) return "";
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;      // 只填了 域名:端口 → 补 https
  return u.replace(/\/command\/?$/i, "").replace(/\/+$/, "");
}
// 发一条命令到本地服务。body=Lovense 命令对象。返回解析后的 JSON，或抛出可读报错。
async function toyCommand(body, opts) {
  const c = loadToyCfg();
  const base = toyBase(c.url);
  if (!base) throw new Error("没填本地地址（在 Lovense Remote 开 Game Mode，把「域名:端口」抄过来）");
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), (opts && opts.timeout) || 8000);
  let r, txt;
  try {
    r = await fetch(base + "/command", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-platform": c.platform || "LisaPhone" },
      body: JSON.stringify(body),
      signal: ctrl.signal
    });
    txt = await r.text();
  } catch (e) {
    throw new Error("连不上本地服务：" + (e && e.message || e) + "。（确认同一个 WiFi、Lovense Remote 开着且在 Game Mode、地址没过期）");
  } finally { clearTimeout(to); }
  let d = null; try { d = JSON.parse(txt); } catch (e) {}
  if (d && (d.code === 200 || d.code === 0 || d.result === true || /ok|success/i.test(txt))) return d;
  if (d && d.code && d.code !== 200) throw new Error("Lovense 返回错误 code " + d.code + (d.message ? "：" + d.message : "") + "（100=没有玩具连着；400/500=命令或地址问题）");
  if (!r.ok) throw new Error("HTTP " + r.status + "：" + String(txt).slice(0, 160));
  return d || { raw: txt };
}
// 常用封装：强度 0~20，时长秒（0=持续到下一条/Stop）
function toyVibrate(strength, timeSec) {
  const fn = toyFn();
  const s = Math.max(0, Math.min(TOY_FN_MAX[fn] || 20, Math.round(strength || 0)));
  return toyCommand({ command: "Function", action: fn + ":" + s, timeSec: timeSec || 0, apiVer: 1 });
}
function toyStop() { toyCancelSeq(); return toyCommand({ command: "Function", action: "Stop", timeSec: 0, apiVer: 1 }); }
function toyGetToys() { return toyCommand({ command: "GetToys" }); }

// ── 波形预设（语义绑定：台词跟着节奏走，别只发恒定值）──
// 每个预设吃「峰值强度 I(1~20)」，吐一串强度序列；Pattern 命令按 interval 逐格播放、循环填满 timeSec。
// 非静默档一律保底 1（避免低强度时被 round 成 0 变哑）；故意归零的静默段保留 0。
const _lv = (I, f) => Math.max(1, Math.round(I * f));
const TOY_STRENGTH = {
  teasing: I => [2, 2, _lv(I, 0.5), 2, I, 2, 2],                // 若即若离，偶尔一下
  steady: I => [I],                                             // 恒定（实际走 Function）
  wave: I => [1, _lv(I, 0.4), _lv(I, 0.7), I, _lv(I, 0.7), _lv(I, 0.4), 1], // 起伏
  pulse: I => [I, 0, I, 0],                                     // 一下一下点名
  edge: I => [_lv(I, 0.4), _lv(I, 0.6), _lv(I, 0.85), I, I, 1], // 推到顶再骤降（吊着）
  // ↓ v53.57 新增：她要「多点花样」，都按语义取名，角色能照台词挑
  ramp: I => [1, _lv(I, 0.2), _lv(I, 0.35), _lv(I, 0.5), _lv(I, 0.65), _lv(I, 0.8), I], // 一路往上推、不回落
  hold: I => [_lv(I, 0.85), I, I, _lv(I, 0.95)],                // 高位稳住几乎不退潮（「稳稳一条长线」）
  throb: I => [I, _lv(I, 0.6), 0, 0],                           // 心跳双击：咚哒—停
  flutter: I => [_lv(I, 0.55), I, _lv(I, 0.55), I],             // 高频细颤，酥麻
  tide: I => [1, 2, _lv(I, 0.3), _lv(I, 0.5), _lv(I, 0.7), _lv(I, 0.85), I, I, _lv(I, 0.85), _lv(I, 0.7), _lv(I, 0.5), _lv(I, 0.3), 2], // 长潮汐：绵长起落
  knock: I => [I, 0, I, 0, I, 0, 0, 0, 0],                      // 叩门：三下轻叩后静默
  surge: I => [1, 1, 1, 1, I, I, _lv(I, 0.3), 1]                // 突袭：潜伏后猛地拉满
};
const TOY_INTERVAL = {
  teasing: 800, steady: 1000, wave: 600, pulse: 400, edge: 700,
  ramp: 700, hold: 1200, throb: 300, flutter: 150, tide: 900, knock: 350, surge: 500
};
const TOY_PATTERNS = ["teasing", "steady", "wave", "pulse", "edge", "ramp", "hold", "throb", "flutter", "tide", "knock", "surge"];
// 波形人话说明（UI 与 prompt 共用一份，改这里两边同步）
const TOY_PATTERN_DESC = {
  teasing: "若即若离偶尔一下", steady: "稳定持续", wave: "起伏", pulse: "一下一下点名", edge: "推到顶再骤降吊着",
  ramp: "一路往上推不回落", hold: "高位稳住不退潮", throb: "心跳般的双击", flutter: "高频细颤酥麻",
  tide: "绵长的长潮起落", knock: "三下轻叩后静默", surge: "潜伏后突然拉满"
};
// 按语义规格播放。强度【一律封顶 toyCap()】，角色越不过；时长封顶 90s（v53.57 从 30s 放宽，她点名）。返回 promise。
function toyPlay(spec) {
  spec = spec || {};
  const cap = toyEffMax();   // 用户上限 ∩ 该功能物理上限
  const I = Math.max(1, Math.min(cap, Math.round(spec.intensity || 0) || 1));   // ⚠️用户上限封顶，角色不可越
  const D = Math.max(1, Math.min(90, Math.round(spec.duration || 3) || 3));
  const pat = TOY_PATTERNS.includes(String(spec.pattern || "").toLowerCase()) ? String(spec.pattern).toLowerCase() : "steady";
  if (pat === "steady") return toyVibrate(I, D);
  const seq = TOY_STRENGTH[pat](I).map(x => Math.max(0, Math.min(cap, Math.round(x)))).join(";");
  const interval = TOY_INTERVAL[pat] || 600;
  const F = TOY_FN_LETTER[toyFn()];   // "" = 该设备全部可用功能
  return toyCommand({ command: "Pattern", rule: "V:1;F:" + F + ";S:" + interval + "#", strength: seq, timeSec: D, apiVer: 1 });
}

// ── 多段连播（v53.74 她点名）：一轮里把好几种波形接起来，例如 wave 30s → hold 20s，中间不断档 ──
// 每段仍各自受 toyCap 与 90s 单段上限约束；整串另有段数与总时长封顶，且随时可被急停掐断。
const TOY_SEQ_MAX_SEGS = 6;      // 最多 6 段
const TOY_SEQ_MAX_TOTAL = 300;   // 整串总时长上限 5 分钟
let _toySeqToken = 0;
let _toySeqTimer = null;
// 取消当前串：换 token 让在途循环自己退出，并清掉正在等待的计时器
function toyCancelSeq() { _toySeqToken++; if (_toySeqTimer) { clearTimeout(_toySeqTimer); _toySeqTimer = null; } }
// 依次播放。每段发完等它自己跑完 duration 秒，再接下一段（Lovense 的 timeSec 到点自停，接缝就在这里焊）。
async function toyPlaySeq(list) {
  const segs = (Array.isArray(list) ? list : [list]).filter(x => x && typeof x === "object");
  if (!segs.length) return 0;
  toyCancelSeq();
  const token = _toySeqToken;
  let used = 0, played = 0;
  const n = Math.min(segs.length, TOY_SEQ_MAX_SEGS);
  for (let i = 0; i < n; i++) {
    if (token !== _toySeqToken) return played;          // 被急停或被新的一串取代
    const d = Math.max(1, Math.min(90, Math.round(segs[i].duration || 3) || 3));
    if (used + d > TOY_SEQ_MAX_TOTAL) break;            // 总时长封顶
    used += d;
    await toyPlay(segs[i]);
    played++;
    if (i < n - 1) await new Promise(res => { _toySeqTimer = setTimeout(res, d * 1000); });
  }
  return played;
}
// ── 设置 UI（只在解锁后渲染；藏在 设置·数据 tab）──
function ToyConfig({ toast }) {
  const t = useTheme();
  const [c, setC] = useState(loadToyCfg());
  const [busy, setBusy] = useState(false);
  const [str, setStr] = useState(10);
  const [diag, setDiag] = useState("");
  const [showTail, setShowTail] = useState(false);
  const set = patch => setC(p => { const n = Object.assign({}, p, patch); saveToyCfg(n); return n; });
  const inSt = { fontFamily: F_BODY, fontSize: 13, color: t.ink, background: t.bg2, border: "1px solid " + t.line, borderRadius: 8, padding: "8px 12px", width: "100%", outline: "none" };
  const row = (label, node) => h("div", { style: { marginBottom: 10 } },
    h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, marginBottom: 4 } }, label), node);
  // 专用检测（v53.58）：把 GetToys 解析成人话——型号/昵称/在线状态/id，并附完整原始返回。
  // 「接了新玩意就用不了」多半是新设备不吃 Vibrate（抽插/旋转/气泵款），得先看清它到底是什么。
  // 专用检测（v53.70 修）：Lovense 的 GetToys 把设备表放在 data.toys，而且是【JSON 字符串】不是对象——
  // 旧写法直接遍历 data 的键，拿到的全是字符串，永远「没解析到设备」。这里二次 parse，并兼容旧格式。
  // 顺带读设备自报的 fullFunctionNames 自动设定功能（Ferri 自报 ["Vibrate"]），不用再手动猜。
  const detect = async () => {
    setBusy(true); setDiag("");
    try {
      const d = await toyGetToys();
      const data = (d && d.data !== undefined) ? d.data : d;
      let toys = (data && data.toys !== undefined) ? data.toys : data;   // 新格式在 data.toys，旧格式 data 本身就是表
      if (typeof toys === "string") { try { toys = JSON.parse(toys); } catch (e) {} }
      const list = (toys && typeof toys === "object") ? Object.keys(toys).map(k => toys[k]).filter(x => x && typeof x === "object" && (x.id || x.name)) : [];
      if (!list.length) { setDiag("✗ 没解析到设备。原始返回：\n" + JSON.stringify(d)); return; }
      const lines = list.map(x => {
        const fns = Array.isArray(x.fullFunctionNames) ? x.fullFunctionNames.join("/") : "?";
        return "· " + (x.nickName || x.name || "?") + "｜" + (String(x.status) === "1" ? "在线" : "离线")
          + (x.battery != null ? "｜电量 " + x.battery + "%" : "") + "｜支持 " + fns;
      });
      // 自动对齐功能：设备只支持一种就直接用它；支持多种且当前选的不在其中，退回它的第一种
      const all = list.flatMap(x => Array.isArray(x.fullFunctionNames) ? x.fullFunctionNames : []);
      let note = "";
      if (all.length) {
        const cur = (loadToyCfg().fn) || "Vibrate";
        if (!all.includes(cur) && TOY_FN_MAX[all[0]]) { set({ fn: all[0], fnPicked: true }); note = "\n\n已自动把「设备功能」设成 " + all[0] + "（这是设备自己报的）。"; }
        else note = "\n\n当前「设备功能」= " + cur + "，和设备自报的对得上。";
      }
      setDiag("✓ 连着 " + list.length + " 个设备：\n" + lines.join("\n") + note);
    } catch (e) { setDiag("✗ " + (e && e.message || e)); }
    finally { setBusy(false); }
  };
  const run = async (fn, okMsg) => {
    setBusy(true); setDiag("");
    try { const d = await fn(); setDiag("✓ " + (okMsg || "成功") + (d && d.data ? "：" + JSON.stringify(d.data).slice(0, 200) : "")); }
    catch (e) { setDiag("✗ " + (e && e.message || e)); }
    finally { setBusy(false); }
  };
  return h("div", { style: { marginTop: 26, paddingTop: 18, borderTop: "1px dashed " + t.line } },
    h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: t.ink, marginBottom: 4 } }, "配件 · 本地"),
    h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, lineHeight: 1.5, color: t.fog, marginBottom: 12 } },
      "在 iPhone 上打开 Lovense Remote → 连上设备 → 开「Game Mode」，把页面上的「域名:端口」原样抄进下面。要和手机同一个 WiFi。只存本机、不进云。"),
    row("本地地址（域名:端口）", h("input", { value: c.url, onChange: e => set({ url: e.target.value }), placeholder: "192-168-1-44.lovense.club:30010", style: inSt })),
    row("标识（X-platform，随便起）", h("input", { value: c.platform, onChange: e => set({ platform: e.target.value }), placeholder: "LisaPhone", style: inSt })),
    h("div", { className: "flex items-center justify-between", style: { padding: "10px 0" } },
      h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, color: t.ink } }, "启用"),
      h("button", { onClick: () => set({ enabled: !c.enabled }), style: { width: 50, height: 29, borderRadius: 999, background: c.enabled ? t.ink : t.line, position: "relative" } },
        h("span", { style: { position: "absolute", top: 3, left: c.enabled ? 24 : 3, width: 23, height: 23, borderRadius: 999, background: "#fff", transition: "left .2s" } }))),
    // 强度上限（角色越不过这个值）——安全铁律②
    h("div", { style: { padding: "6px 0" } },
      h("div", { className: "flex items-center justify-between", style: { marginBottom: 4 } },
        h("span", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog } }, "强度上限（TA 越不过）"),
        h("span", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: t.ink } }, (c.cap == null ? 12 : c.cap))),
      h("input", { type: "range", min: 1, max: 20, step: 1, value: c.cap == null ? 12 : c.cap, onChange: e => set({ cap: +e.target.value }), style: { width: "100%" } })),
    // 设备功能（v53.58）：新玩意不吃震动时在这儿切
    h("div", { style: { padding: "6px 0" } },
      h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, marginBottom: 6 } }, "设备功能（Ferri 等震动款用 Vibrate；换了别的设备没反应再试其他）"),
      h("div", { style: { display: "flex", flexWrap: "wrap", gap: 6 } },
        TOY_FN_LIST.map(f => h("button", { key: f,
          onClick: () => set({ fn: f, fnPicked: true }),
          style: { fontFamily: F_BODY, fontSize: 12, padding: "5px 11px", borderRadius: 999,
            background: (c.fn || "All") === f ? t.ink : "transparent",
            color: (c.fn || "All") === f ? t.bg2 : t.fog,
            border: "1px solid " + ((c.fn || "All") === f ? t.ink : t.line) } },
          f === "All" ? "自动（全部）" : f)))),
    // 授权自查（v53.70）：言秋说「眼前没有选项」= 下面三关没全过。三关缺一，他的 prompt 里就没有 toy 这个能力。
    (() => {
      let unlocked = false, chars = [], cs = {};
      try { unlocked = localStorage.getItem("x_toyUnlocked") === "1"; } catch (e) {}
      try { chars = JSON.parse(localStorage.getItem("x_characters") || "[]"); } catch (e) {}
      try { cs = JSON.parse(localStorage.getItem("x_chatSettings") || "{}"); } catch (e) {}
      const optIn = chars.filter(x => cs[x.id] && cs[x.id].toyEnabled).map(x => x.remark || x.name);
      const ai = (typeof window !== "undefined" && window.__toyArmed) || {};
      const armedName = ai.armed && ai.forId ? (((chars.find(x => x.id === ai.forId) || {}).remark) || ((chars.find(x => x.id === ai.forId) || {}).name) || "某位") : "";
      const line = (ok, label, detail) => h("div", { style: { display: "flex", gap: 8, alignItems: "baseline", padding: "3px 0" } },
        h("span", { style: { color: ok ? "#3c7a4a" : "#c0392b", fontSize: 12 } }, ok ? "✓" : "✗"),
        h("span", { style: { fontFamily: F_BODY, fontSize: 12, color: t.ink } }, label),
        h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog } }, detail));
      return h("div", { style: { marginTop: 14, paddingTop: 12, borderTop: "1px solid " + t.line } },
        h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, marginBottom: 6 } }, "TA 那边能不能用 · 三关自查"),
        line(unlocked && toyReady(), "① 已连接", toyReady() ? "地址与启用都就绪" : "地址没填 / 没启用"),
        line(optIn.length > 0, "② 角色已开配件", optIn.length ? "已开：" + optIn.join("、") : "去 TA 的聊天设置里打开「配件」"),
        line(!!armedName, "③ 本次已激活", armedName ? "当前授权给 " + armedName : "去 TA 的单聊页点右下「▷ 激活配件」"),
        (() => {
          // 上一轮实况（v53.71）：跟 TA 说一句话再回来看，这里直接指出卡在哪一关
          const g = (typeof window !== "undefined" && window.__toyLastGate) || null;
          if (!g) return h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 8, lineHeight: 1.5 } },
            "▸ 还没有实况：去跟 TA 说一句话，再回来这里，会显示那一轮到底开没开成。");
          const bad = (g.conds || []).filter(x => !x[1]).map(x => x[0]);
          const mm = Math.max(0, Math.round((Date.now() - g.ts) / 60000));
          return h("div", { style: { marginTop: 8, padding: "8px 10px", borderRadius: 8, background: g.result ? "rgba(60,122,74,.08)" : "rgba(192,57,43,.07)", border: "1px solid " + (g.result ? "rgba(60,122,74,.3)" : "rgba(192,57,43,.25)") } },
            h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: g.result ? "#3c7a4a" : "#c0392b", lineHeight: 1.6 } },
              g.result
                ? "✓ 上一轮（" + g.who + "，" + mm + " 分钟前）已把 toy 能力给到 TA 了。"
                : "✗ 上一轮（" + g.who + "，" + mm + " 分钟前）没开成，卡在：" + (bad.join("、") || "未知")),
            !g.result ? h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 4, lineHeight: 1.5 } },
              "※「不是主动/续写轮」这条的意思是：点【让 TA 回复】续写、或 TA 主动发的那种轮次，按安全设计一律不开放硬件——要你【真发一句话】给 TA，那一轮才算数。") : null);
        })(),
        (() => {
          const p = (typeof window !== "undefined" && window.__lastSentTail) || null;
          if (!p) return null;
          return h("div", { style: { marginTop: 8 } },
            h("button", { onClick: () => setShowTail(v => !v), className: "active:opacity-60",
              style: { fontFamily: F_BODY, fontSize: 11.5, color: t.tint } },
              (showTail ? "\u25be \u6536\u8d77 " : "\u25b8 \u770b ") + "TA \u4e0a\u4e00\u8f6e\u5b9e\u9645\u6536\u5230\u7684\u6307\u4ee4"),
            h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 3, lineHeight: 1.5 } },
              "\u00b7 \u6307\u4ee4\u91cc\u542b toy \u5b57\u6bb5\uff1a" + (p.toyInTask ? "\u6709 \u2713" : "\u6ca1\u6709 \u2717")
              + "\u3000\u00b7 \u7ebf\u4e0b\u672a\u6563\u573a\u5e72\u6270\uff1a" + (p.offlineBleed ? "\u6709\uff08\u4f1a\u76d6\u8fc7\u7ebf\u4e0a\u80fd\u529b\uff0c\u5efa\u8bae\u5148\u7ed3\u675f\u7ebf\u4e0b\uff09" : "\u65e0")),
            showTail ? h("div", { style: { marginTop: 6, maxHeight: 200, overflowY: "auto", padding: "8px 10px", borderRadius: 8, background: t.bg2, border: "1px solid " + t.line, fontFamily: "monospace", fontSize: 10, lineHeight: 1.55, color: t.sub, whiteSpace: "pre-wrap", wordBreak: "break-all" } }, p.tail) : null);
        })(),
        h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 6, lineHeight: 1.5 } },
          "③ 是【一次会话】的授权：刷新页面或重开 app 会自动解除，需要重点一次——这是当初定的安全设计，不是坏了。三关全绿，TA 的选项才会出现。"));
    })(),
    // 测试面板
    h("div", { style: { marginTop: 8, paddingTop: 12, borderTop: "1px solid " + t.line } },
      h("div", { className: "flex items-center justify-between", style: { marginBottom: 6 } },
        h("span", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog } }, "测试 · 强度"),
        h("span", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: t.ink } }, str)),
      h("input", { type: "range", min: 0, max: 20, step: 1, value: str, onChange: e => setStr(+e.target.value), style: { width: "100%" } }),
      h("div", { className: "flex gap-2", style: { marginTop: 10 } },
        h("button", { onClick: () => run(() => toyVibrate(str, 0), "已发送"), disabled: busy, className: "flex-1", style: { fontFamily: F_BODY, fontSize: 13, color: "#fff", background: t.tint, borderRadius: 8, padding: "9px 0" } }, busy ? "…" : "测试"),
        h("button", { onClick: () => run(() => toyStop(), "已停止"), disabled: busy, className: "flex-1", style: { fontFamily: F_BODY, fontSize: 13, color: t.ink, border: "1px solid " + t.line, borderRadius: 8, padding: "9px 0" } }, "停止"),
        h("button", { onClick: detect, disabled: busy, style: { fontFamily: F_BODY, fontSize: 13, color: t.sub, border: "1px solid " + t.line, borderRadius: 8, padding: "9px 14px" } }, "检测")),
      diag ? h("div", { style: { maxHeight: 220, overflowY: "auto", fontFamily: "monospace", fontSize: 11, color: diag[0] === "✓" ? "#3c7a4a" : t.accent, marginTop: 10, whiteSpace: "pre-wrap", wordBreak: "break-all", lineHeight: 1.5 } }, diag) : null),
    h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 12, lineHeight: 1.5 } },
      "地址会随网络变，重连后回来重抄一次即可。人不在同一 WiFi 时本地直连用不了（那要走 Lovense 云端 API，得先搭一小截后端）。"));
}
if (typeof window !== "undefined") { window.ToyConfig = ToyConfig; window.toyVibrate = toyVibrate; window.toyStop = toyStop; window.toyReady = toyReady; window.toyCommand = toyCommand; window.toyPlay = toyPlay; window.toyPlaySeq = toyPlaySeq; window.toyCancelSeq = toyCancelSeq; window.toyCap = toyCap; window.TOY_PATTERNS = TOY_PATTERNS; window.TOY_PATTERN_DESC = TOY_PATTERN_DESC; window.toyFn = toyFn; window.toyEffMax = toyEffMax; window.TOY_FN_LIST = TOY_FN_LIST; }
