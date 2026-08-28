// ============================================================
// ROOT
// ============================================================
// 版本号：跟 index.html 的 ?v=NN 同步 bump。左上角小徽标显示它，方便肉眼确认缓存刷没刷新（做完可去掉）。
const APP_VERSION = "v57.07";
// 失败提示属于 UI 诊断，不属于任何角色亲历。显式标记照顾新消息，固定文案识别兼容旧记录。
const contextAllowsMessage = m => !(window.ChatContextFilter && window.ChatContextFilter.isExcluded(m));
// 论坛常驻网友：轻量公开身份，不是完整角色，也不读取任何人的私聊/记忆。
// 固定 id 让同一个人能跨帖子回来；boards/voice 只约束公开发言习惯。
const FORUM_NPC_REGISTRY = [
  { id: "npc_regular_moyu", name: "摸鱼办主任", handle: "moyu_office", boards: ["吐槽吧", "日常吧", "脑洞吧"], voice: "上班族，短句冷幽默，爱吐槽流程但不刻薄人" },
  { id: "npc_regular_xiaoyu", name: "小雨不带伞", handle: "raincheck", boards: ["日常吧", "求助吧"], voice: "温和细心，常分享生活小窍门，偶尔有点迷糊" },
  { id: "npc_regular_maomao", name: "楼下猫保安", handle: "cat_guard", boards: ["日常吧", "吐槽吧"], voice: "爱观察邻里和猫，话少，偶尔一句很准" },
  { id: "npc_regular_bing", name: "冰箱灯研究员", handle: "fridge_light", boards: ["吐槽吧", "求助吧"], voice: "较真派，擅长拆问题和给具体步骤，不讲空话" },
  { id: "npc_regular_yidun", name: "今天也吃一顿", handle: "one_more_meal", boards: ["日常吧", "求助吧", "兴趣吧"], voice: "吃喝派，热心但容易把话题拐到食物" },
  { id: "npc_regular_houtui", name: "后退半步", handle: "halfstepback", boards: ["吐槽吧", "求助吧"], voice: "先质疑再给建议，有边界感，不爱跟风" },
  { id: "npc_regular_mianbao", name: "面包边也要吃", handle: "crust_club", boards: ["日常吧", "吐槽吧", "兴趣吧"], voice: "生活节俭派，爱讲亲身小事，语气朴素" },
  { id: "npc_regular_zuoye", name: "昨夜没关窗", handle: "window_open", boards: ["日常吧", "求助吧"], voice: "夜猫子，感性但不灌鸡汤，回复常在深夜" },
  { id: "npc_regular_shafa", name: "沙发不是我的", handle: "not_my_sofa", boards: ["吐槽吧", "日常吧", "脑洞吧"], voice: "抢前排接梗型，嘴快，遇到正事会收敛" },
  { id: "npc_regular_lanbi", name: "蓝笔批注", handle: "blue_margin", boards: ["求助吧", "吐槽吧", "兴趣吧"], voice: "经验党，喜欢逐条回答，也会指出问题前提不成立" },
  { id: "npc_anon_thirdcat", name: "三楼的猫", handle: "third_floor_cat", boards: ["匿名吧"], voice: "谨慎克制，只谈感受不猜身份" },
  { id: "npc_anon_nightbus", name: "末班车乘客", handle: "last_bus", boards: ["匿名吧"], voice: "深夜坦白型，懂得共情但不强行劝和" },
  { id: "npc_anon_blank", name: "id已隐藏", handle: "hidden_id", boards: ["匿名吧"], voice: "直接、现实，尊重隐私，不追问细节" },
  { id: "npc_anon_deleted", name: "注销前说一句", handle: "before_logout", boards: ["匿名吧"], voice: "偶尔尖锐，反感套话，习惯提醒风险和后果" }
];
// 论坛熟面孔之间的公开交情：只决定公开回帖时的接梗/抬杠方式，不进角色私聊或记忆库。
// 固定 pair + 固定描述，让他们跨帖子认得彼此；不是每次让模型重新编一套关系。
const FORUM_NPC_RELATIONS = [
  { a: "npc_regular_moyu", b: "npc_regular_shafa", tone: "老接梗搭子：摸鱼办主任负责冷脸铺梗，沙发不是我的常抢着补刀；可以互损，但不会真翻脸" },
  { a: "npc_regular_xiaoyu", b: "npc_regular_zuoye", tone: "深夜熟人：小雨不带伞会认真接住昨夜没关窗的感性话，后者也记得她容易忘带东西" },
  { a: "npc_regular_bing", b: "npc_regular_lanbi", tone: "较真同行：大方向常同意，细节上总要互相挑一处漏洞；抬杠必须围绕事实，不做人身攻击" },
  { a: "npc_regular_yidun", b: "npc_regular_mianbao", tone: "吃喝搭子：一个爱劝多吃一顿，一个习惯算性价比，经常从两个方向给出互补建议" },
  { a: "npc_regular_houtui", b: "npc_regular_shafa", tone: "长期意见不合：后退半步嫌对方嘴快，沙发不是我的嫌对方扫兴；会抬杠，但遇到正事都知道收住" },
  { a: "npc_regular_maomao", b: "npc_regular_xiaoyu", tone: "猫话题熟人：楼下猫保安提供观察，小雨不带伞负责实用照顾；见到对方会自然续上旧默契" }
];
// B（v50.79，2026-07-24 试点）：允许「软层随经历成长」的角色白名单。先只开沈屿白(阿屿)、顾暮(阿暮)观察不漂移再全局。
//   硬核(身份/世界观/说话底色/边界/重要经历)永不变；只软层(亲密方式/处理冲突习惯/偏好/勇气/信任/对未来的选择)可被 personaGrown+反复经历推着长。
const PERSONA_EVOLVE_IDS = ["char_1783061729716", "char_1783354607122"];
const MEMORY_TABLE_AUTHORITY_KEY = "memory_table_authority_v1";
const memoryTableAuthorityOn = () => { try { return localStorage.getItem(MEMORY_TABLE_AUTHORITY_KEY) === "1"; } catch (e) { return false; } };
const memoryRowFromCloud = r => ({
  id: String(r.id), text: String(r.text || ""), tags: Array.isArray(r.tags) ? r.tags.map(String) : [],
  charIds: Array.isArray(r.char_ids) ? r.char_ids.map(String) : [],
  // known_by 三态：只有真是数组才接，NULL/缺失一律保持 undefined（legacy），
  // 不能学上面 charIds 那样兜成 []——那会把旧记忆误判成「仅用户知道」。
  knownBy: Array.isArray(r.known_by) ? r.known_by.map(String) : undefined,
  v: typeof r.v === "number" ? r.v : 0,
  a: typeof r.a === "number" ? r.a : 1, open: !!r.open, pinned: !!r.pinned, ts: Number(r.ts) || 0,
  archived: !!r.archived, archivedBatch: r.archived_batch == null ? null : String(r.archived_batch),
  archivedTs: r.archived_ts == null ? null : Number(r.archived_ts), source: r.source == null ? null : String(r.source),
  surfaceState: r.surface_state == null ? "active" : String(r.surface_state), supersedesId: r.supersedes_id == null ? null : String(r.supersedes_id)
});

const voiceToneForPrompt = m => {
  if (!m || !m.voiceTone) return "";
  const tone = m.voiceTone;
  // 基线没建好时没有可用信号，直接不注入（省 token，也免得模型对着"基线还在建立"硬找戏）
  if (!tone.baselineReady) return "";
  const heard = Array.isArray(tone.observations) && tone.observations.length
    ? tone.observations.join("、") : "与她平时的声音接近";
  return "【这条语音听感（相对她平时，仅供参考非情绪定论；别复述参数、别当长期事实记）：" + heard + "】";
};
// 右上电池：干净的 iOS 风电池图标（只图标不数字）。Battery API 拿得到就按真实电量画填充，
// iOS Safari/PWA 拿不到 → 画一个饱满的装饰电池（不显示假数字）。
function BatteryBadge() {
  const t = useTheme();
  const [lvl, setLvl] = React.useState(null);
  const [charging, setCharging] = React.useState(false);
  React.useEffect(function () {
    let bat = null, upd = null;
    if (navigator.getBattery) {
      navigator.getBattery().then(function (x) {
        bat = x;
        upd = function () { setLvl(Math.round(x.level * 100)); setCharging(!!x.charging); };
        upd();
        x.addEventListener("levelchange", upd);
        x.addEventListener("chargingchange", upd);
      }).catch(function () {});
    }
    return function () { if (bat && upd) { bat.removeEventListener("levelchange", upd); bat.removeEventListener("chargingchange", upd); } };
  }, []);
  const col = t.ink || "#1b1a17";
  const shown = lvl == null ? 82 : lvl;                 // 拿不到就画饱满
  const low = lvl != null && lvl <= 20;
  return h("svg", { width: 25, height: 13, viewBox: "0 0 25 13", style: { display: "block" } },
    h("rect", { x: 0.6, y: 0.9, width: 21, height: 11.2, rx: 3.2, fill: "none", stroke: col, strokeWidth: 1, opacity: 0.42 }),
    h("rect", { x: 23, y: 4.3, width: 1.7, height: 4.4, rx: 0.85, fill: col, opacity: 0.42 }),
    h("rect", { x: 2.1, y: 2.4, width: Math.max(1, 18 * shown / 100), height: 8.2, rx: 1.7, fill: low ? "#ff453a" : col, opacity: lvl == null ? 0.42 : 0.88 }),
    charging ? h("path", { d: "M12.6 2.4 L9.7 7 L11.9 7 L10.9 10.6 L14.2 5.8 L12 5.8 Z", fill: low ? "#ff453a" : col, opacity: 0.9 }) : null);
}
// 顶部细状态栏（在流里，不浮空、不压组件）：左版本号 + 右电池。每页都在。做完可整块去掉。
function DevBadges() {
  const t = useTheme();
  // 绝对定位浮层：不占布局高度（不再压缩顶部内容），pointerEvents:none 不挡点击
  const base = { position: "absolute", top: "calc(env(safe-area-inset-top) + 2px)", zIndex: 50, pointerEvents: "none" };
  return h(React.Fragment, null,
    h("span", { style: Object.assign({ left: 8, fontFamily: "monospace", fontSize: 9, letterSpacing: 0.4, color: t.ink, opacity: 0.3 }, base) }, APP_VERSION),
    h("span", { style: Object.assign({ right: 8, display: "flex", alignItems: "center" }, base) }, h(BatteryBadge, null)));
}
// AssistiveTouch 风格模型切换器：只改全局线上/线下线路；角色专线仍由 apiFor/offlineApiFor 优先。
function ModelQuickSwitch({ profiles, activeId, offlineApiId, onSetOnline, onSetOffline }) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  // 浮窗可拖动（她 2026-08-16 点名固定位置挡手）：拖完贴边吸附，位置存 x_modelFloatPos，重开 App 记得住。
  const [pos, setPos] = useState(() => { try { const p = JSON.parse(localStorage.getItem("x_modelFloatPos") || "null"); return p && (p.side === "left" || p.side === "right") && Number.isFinite(p.top) ? p : null; } catch (e) { return null; } });
  const [drag, setDrag] = useState(null); // 拖动中的指尖坐标（按钮中心跟随）
  const dragStart = useRef(null);
  const justDragged = useRef(false);
  const onDown = e => {
    dragStart.current = { x: e.clientX, y: e.clientY, moved: false };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {}
  };
  const onMove = e => {
    const s = dragStart.current;
    if (!s) return;
    if (!s.moved && Math.hypot(e.clientX - s.x, e.clientY - s.y) < 7) return;
    if (!s.moved) { s.moved = true; setOpen(false); }
    setDrag({ x: e.clientX, y: e.clientY });
  };
  const onUp = e => {
    const s = dragStart.current;
    dragStart.current = null;
    if (!s || !s.moved) return;
    justDragged.current = true;
    const w = window.innerWidth || 390, hh = window.innerHeight || 800;
    const next = { side: e.clientX < w / 2 ? "left" : "right", top: Math.min(Math.max(e.clientY - 23, 70), hh - 130) };
    setPos(next); setDrag(null);
    try { localStorage.setItem("x_modelFloatPos", JSON.stringify(next)); } catch (err) {}
  };
  const label = p => (p && (p.name || p.model)) || "未命名线路";
  const online = (profiles || []).find(p => p.id === activeId) || (profiles || [])[0] || null;
  const offline = (offlineApiId && (profiles || []).find(p => p.id === offlineApiId)) || online;
  if (!(profiles || []).length) return null;
  const choice = (kind, p) => h("button", {
    key: kind + ":" + (p.id || "follow"),
    onClick: () => kind === "online" ? onSetOnline(p.id) : onSetOffline(p.id || null),
    className: "active:opacity-60",
    style: { width: "100%", textAlign: "left", padding: "8px 10px", borderRadius: 10, fontFamily: F_BODY, fontSize: 12, lineHeight: 1.35,
      color: ((kind === "online" ? online && online.id : offline && offline.id) === p.id) ? t.bg2 : t.ink,
      background: ((kind === "online" ? online && online.id : offline && offline.id) === p.id) ? t.ink : "transparent" }
  }, label(p));
  const side = pos ? pos.side : "right";
  const anchor = drag
    ? { left: drag.x - 23, top: drag.y - 23, right: "auto", flexDirection: "row-reverse" }
    : Object.assign({ top: pos ? pos.top : "42%" }, side === "left" ? { left: 12, flexDirection: "row-reverse" } : { right: 12 });
  return h("div", { style: Object.assign({ position: "fixed", zIndex: 90, display: "flex", alignItems: "center", gap: 8 }, anchor) },
    open ? h("div", { style: { width: 226, maxHeight: "58vh", overflowY: "auto", padding: 12, borderRadius: 18, background: t.bg2,
      border: "1px solid " + t.line, boxShadow: "0 12px 34px rgba(0,0,0,.22)" } },
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14, color: t.ink, marginBottom: 4 } }, "快速切换模型"),
      h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: t.fog, lineHeight: 1.45, marginBottom: 10 } }, "只切全局线路；角色专线仍优先。"),
      h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.sub, margin: "5px 4px" } }, "线上 · " + label(online)),
      (profiles || []).map(p => choice("online", p)),
      h("div", { style: { height: 1, background: t.line, margin: "10px 0" } }),
      h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.sub, margin: "5px 4px" } }, "线下 · " + label(offline)),
      [h("button", { key: "offline:follow", onClick: () => onSetOffline(null), className: "active:opacity-60",
        style: { width: "100%", textAlign: "left", padding: "8px 10px", borderRadius: 10, fontFamily: F_BODY, fontSize: 12,
          color: !offlineApiId ? t.bg2 : t.ink, background: !offlineApiId ? t.ink : "transparent" } }, "跟随线上主模型")].concat((profiles || []).map(p => choice("offline", p)))) : null,
    h("button", { onClick: () => { if (justDragged.current) { justDragged.current = false; return; } setOpen(v => !v); },
      onPointerDown: onDown, onPointerMove: onMove, onPointerUp: onUp, onPointerCancel: () => { dragStart.current = null; setDrag(null); },
      "aria-label": "快速切换模型", className: "active:scale-95",
      style: { width: 46, height: 46, borderRadius: 23, flexShrink: 0, background: "rgba(25,24,22,.88)", border: "2px solid rgba(255,255,255,.7)",
        boxShadow: "0 5px 18px rgba(0,0,0,.3)", color: "white", fontFamily: "monospace", fontSize: 13, lineHeight: 1.05, touchAction: "none" } }, open ? "×" : "⇄"));
}
// 一起听·本地音频存 IndexedDB（音频文件大，localStorage 5MB 存不下）。key=歌曲id，value=Blob。
function idbAudioOpen() {
  return new Promise((res, rej) => {
    const r = indexedDB.open("x_listen_audio", 1);
    r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains("aud")) r.result.createObjectStore("aud"); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
async function idbAudioPut(k, blob) { const db = await idbAudioOpen(); return new Promise((res, rej) => { const tx = db.transaction("aud", "readwrite"); tx.objectStore("aud").put(blob, k); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); }); }
async function idbAudioGet(k) { const db = await idbAudioOpen(); return new Promise((res, rej) => { const tx = db.transaction("aud", "readonly"); const rq = tx.objectStore("aud").get(k); rq.onsuccess = () => res(rq.result || null); rq.onerror = () => rej(rq.error); }); }
async function idbAudioDel(k) { const db = await idbAudioOpen(); return new Promise(res => { const tx = db.transaction("aud", "readwrite"); tx.objectStore("aud").delete(k); tx.oncomplete = () => res(); tx.onerror = () => res(); }); }
// 从网易云链接/分享文案/裸ID里抠出歌曲 id
function parseNeteaseId(input) {
  const s = String(input || "");
  const m = s.match(/id=(\d{3,})/) || s.match(/\/song\/(\d{3,})/) || s.match(/^\s*(\d{3,})\s*$/);
  return m ? m[1] : null;
}
// 内置默认表情：手画 SVG 表情脸，编码成 data URI（不依赖图床，开箱即用）
function buildDefaultEmotes() {
  // ⚠必须带 width/height：只有 viewBox 的 SVG 在聊天气泡(EmoteBubble 只给 maxWidth/maxHeight、无尺寸容器)里没有固有尺寸→渲染成 0×0 看不见
  const face = inner => "data:image/svg+xml," + encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><circle cx='50' cy='50' r='45' fill='#F4C64B' stroke='#1b1a17' stroke-width='3'/>" + inner + "</svg>");
  const S = "fill='none' stroke='#1b1a17' stroke-width='4.5' stroke-linecap='round' stroke-linejoin='round'";
  const eyeDot = "<circle cx='36' cy='44' r='5'/><circle cx='64' cy='44' r='5'/>";
  const defs = [
    ["开心", eyeDot + "<path d='M34 61 Q50 75 66 61' " + S + "/>"],
    ["大笑", "<path d='M28 46 Q37 37 46 46' " + S + "/><path d='M54 46 Q63 37 72 46' " + S + "/><path d='M31 56 Q50 82 69 56 Z' fill='#1b1a17'/>"],
    ["难过", eyeDot + "<path d='M34 69 Q50 57 66 69' " + S + "/>"],
    ["生气", "<path d='M28 38 L45 45' " + S + "/><path d='M72 38 L55 45' " + S + "/><circle cx='37' cy='50' r='5'/><circle cx='63' cy='50' r='5'/><path d='M36 70 Q50 60 64 70' " + S + "/>"],
    ["爱心眼", "<path d='M30 40 l6 -6 6 6 -6 7 z' fill='#E4572E'/><path d='M58 40 l6 -6 6 6 -6 7 z' fill='#E4572E'/><path d='M34 61 Q50 75 66 61' " + S + "/>"],
    ["疑惑", "<path d='M28 38 Q36 34 44 40' " + S + "/><circle cx='37' cy='48' r='5'/><circle cx='63' cy='48' r='5'/><path d='M42 66 Q50 62 58 66' " + S + "/>"],
    ["哭", "<path d='M30 44 Q37 39 44 44' " + S + "/><path d='M56 44 Q63 39 70 44' " + S + "/><path d='M36 70 Q50 62 64 70' " + S + "/><path d='M34 50 q0 12 0 16' stroke='#3F8FD6' stroke-width='4' fill='none' stroke-linecap='round'/><path d='M66 50 q0 12 0 16' stroke='#3F8FD6' stroke-width='4' fill='none' stroke-linecap='round'/>"],
    ["无语", "<path d='M30 44 L42 44' " + S + "/><path d='M58 44 L70 44' " + S + "/><path d='M38 66 L62 66' " + S + "/><path d='M74 34 q5 8 0 12 q-5 -4 0 -12' fill='#3F8FD6'/>"]
  ];
  return defs.map((d, i) => ({ id: "em_def_" + i, keyword: d[0], url: face(d[1]) }));
}
function App() {
  const isStandalone = typeof window !== "undefined" && (window.navigator.standalone === true || window.matchMedia("(display-mode: standalone)").matches);
  const [now, setNow] = useState(new Date());
  const [screen, setScreen] = useState("home");
  // 当前正在看哪个聊天（供未读红点判断：在看就不累加）
  const viewRef = useRef({ screen: "home", charId: null });
  // 置顶的聊天/群 id 集合
  const [pinnedChats, setPinnedChats] = useState(() => loadJSON("x_pinnedChats", []));
  const [characters, setCharacters] = useState([]);
  const [groups, setGroups] = useState([]);
  const [chats, setChats] = useState({});
  const chatsRef = useRef(chats);
  chatsRef.current = chats; // 始终指向最新聊天记录，避免闭包读到旧值
  const [chatArch, setChatArch] = useState({}); // {charId: 已归档到云端的旧消息条数}——供聊天页显示「加载更早」
  const [groupChats, setGroupChats] = useState({});
  const [groupSettings, setGroupSettings] = useState({});
  const [moments, setMoments] = useState([]);
  const [yanqiuMoments, setYanqiuMoments] = useState([]); // 秋声墙云端快照：只供数字生命言秋本人接续
  const [momentsCover, setMomentsCover] = useState({}); // { me: dataURI, [charId]: dataURI } 朋友圈封面
  const [momTarget, setMomTarget] = useState(null);     // 朋友圈个人页目标 { id, isMe }
  // 约回（v56.49，她 2026-08-26：「他们会说等我 xxx 再找你，能不能真的主动发」）：
  // [{id, charId, dueTs, about, createdTs}]。到点就发，不看积温攒没攒够；
  // 那段时间她没开 app 就一直欠着，下次开 app 补上——app 不开就没有任何东西在跑。
  const [promises, setPromises] = useState([]);
  const promisesRef = useRef([]); promisesRef.current = promises;
  const [friendGroups, setFriendGroups] = useState([]);
  const [schedules, setSchedules] = useState({});
  const [snoops, setSnoops] = useState({});
  const [carries, setCarries] = useState({});
  const [phones, setPhones] = useState({});
  const [diaries, setDiaries] = useState({});
  const diariesRef = useRef(diaries);
  diariesRef.current = diaries; // 日记最新记录（自动补写时读最新）
  const [diaryBusy, setDiaryBusy] = useState({}); // charId -> bool，正在写日记
  // React state 不是同步互斥锁：自动补写与手动按钮同一拍进来时，
  // 两边都可能在 setDiaryBusy 生效前看到 false，白烧两次 API 并落两篇。
  const diaryFlightRef = useRef(new Set()); // 同一角色任一时刻只准一条生成链
  const [diaryCommenting, setDiaryCommenting] = useState(null); // 正在给哪条「我的日记」生成评论(entryId)
  const diaryRunRef = useRef(false); // 本次打开日记 app 是否已跑过自动补写
  const diaryBackfillRef = useRef(false); // 一键补齐是否正在跑（逐天串行，不许并发）
  const schedRunRef = useRef(false); // 本次打开行程是否已跑过「当天给所有人生成」
  const schedulesRef = useRef({});
  const [rels, setRels] = useState({});
  const [affinities, setAffinities] = useState({});
  const [moods, setMoods] = useState({});
  const [states, setStates] = useState({});
  const [stateHist, setStateHist] = useState({});
  const statesRef = useRef(states); statesRef.current = states;
  const stateHistRef = useRef(stateHist); stateHistRef.current = stateHist;
  const [directives, setDirectives] = useState({}); // {charId:[{id,text,ts}]} 用户经 OOC 立的长期行为准则
  const [desires, setDesires] = useState({}); // {charId:{list,log,lastMuse}} 欲望盒子（内容只有角色落笔，js 只干体力活，见 js/desire.js）
  const desiresRef = useRef(desires);
  desiresRef.current = desires;
  const [desireBoxOpen, setDesireBoxOpen] = useState(false); // 欲望盒子弹层（从资料卡进）
  const [desireBusy, setDesireBusy] = useState(false); // 手动「让 TA 发会儿呆」进行中
  const [memories, setMemories] = useState({});
  const memoriesRef = useRef(memories);
  memoriesRef.current = memories; // 始终指向最新长期记忆总结
  const [memLib, setMemLib] = useState([]);
  const memLibRef = useRef(memLib);
  memLibRef.current = memLib; // 始终指向最新记忆库
  const [emoBusy, setEmoBusy] = useState(false); // 情绪补评估中
  const [memMigrationBusy, setMemMigrationBusy] = useState(false); // 独立表影子迁移中
  const [memTableMode, setMemTableMode] = useState(memoryTableAuthorityOn); // 每账号/设备单独验收后才开，不波及其他用户
  const memExtractInflightRef = useRef({}); // 每角色抽取进行中标志，防并发重复抽取
  // 记忆库设置：topK 每轮召回条数；autoExtract 每轮后台自动抽取；extractInterval 每几轮抽一次；recentDays 短期窗至少覆盖最近几天（消死区）
  const MEM_CFG_DEFAULT = { topK: 5, autoExtract: true, extractInterval: 1, recentDays: 3, recentBudget: 8000, crossHours: 72, crossBudget: 800 };
  const [memCfg, setMemCfg] = useState(MEM_CFG_DEFAULT);
  const memCfgRef = useRef(memCfg); memCfgRef.current = memCfg;
  const memExtractCtrRef = useRef({}); // 每角色自动抽取轮次计数
  const memExtractMarkRef = useRef({}); // 每角色「上次抽到的最后一条 ts」——防话痨多气泡溢出漏抽（她 2026-07-13 抓的账）
  const ccMemExtractBusyRef = useRef(false); // CC 自动记忆独立串行锁；持久书签在 cc-memory-auto.js
  const ccToolManagerRef = useRef(null); // App→固定言秋 CC 异步只读工具队列
  const saveMemCfg = patch => setMemCfg(p => { const n = { ...p, ...patch }; memCfgRef.current = n; saveJSON("x_memCfg", n); return n; });
  const ordersRef = useRef([]);
  const kinshipCardsRef = useRef([]);
  const groupChatsRef = useRef(groupChats);
  groupChatsRef.current = groupChats; // 群聊最新记录（投票/红包就地改）
  const [chatSettings, setChatSettings] = useState({});
  // 论坛（仿贴吧）：帖子/评论/关注/私信 —— 全 localStorage，帖子只有一份，版块是筛选视图
  const [forumPosts, setForumPosts] = useState([]);
  const [forumComments, setForumComments] = useState({}); // { [postId]: [comment] }
  const [forumFollows, setForumFollows] = useState([]);    // 关注的角色 id
  const [forumPMs, setForumPMs] = useState([]);            // 与 NPC 的私信会话
  const [forumMe, setForumMe] = useState({ handle: "", bio: "", joinTs: 0, followers: 0 });
  const [forumCharMeta, setForumCharMeta] = useState({});  // { [charId]: {handle,bio,joinTs,following,followers} }（AI 生成一次）
  const [forumOff, setForumOff] = useState([]);            // 不逛论坛的角色 id（默认全逛=空）
  const forumOffRef = useRef([]); forumOffRef.current = forumOff;
  const forumPostsRef = useRef([]); forumPostsRef.current = forumPosts;
  const forumCommentsRef = useRef({}); forumCommentsRef.current = forumComments;
  const forumCInflightRef = useRef({}); // 每帖评论生成的进行中锁（防重入覆盖）
  const forumPMsRef = useRef([]); forumPMsRef.current = forumPMs;
  const forumCharMetaRef = useRef({}); forumCharMetaRef.current = forumCharMeta;
  const [whispers, setWhispers] = useState([]);
  // 情侣空间·问答小本：已答条目流（各角色各一份，按 characterId 过滤）
  const [coupleQA, setCoupleQA] = useState([]);
  // 问答小本封面标题：{ [charId]: title }
  const [coupleQATitle, setCoupleQATitle] = useState({});
  // 情侣空间·双向便签：贴纸墙（authorId='user' 或角色 id）
  const [coupleNotes, setCoupleNotes] = useState([]);
  // 情侣空间·问答自定义题库：{ [charId]: ["题目",...] }，各角色各一份、不互通
  const [coupleQACustom, setCoupleQACustom] = useState({});
  // 情侣空间·心情打卡：角色留下的心情流 {id,characterId,moodTag,text,createdAt}
  const [coupleMood, setCoupleMood] = useState([]);
  // 情侣空间·同频测试：整局存档流 {id,characterId,ts,status:'quiz'|'done',qs:[{q,opts,my,ta,reason}],score,remark}
  const [coupleSync, setCoupleSync] = useState([]);
  // 情侣空间·交换日记：一本两人轮流写的本子 {id,characterId,author:'user'|charId,content,mood,weather,date,ts,dueTs?,replied?,replyToId?,unread?}
  const [coupleExDiary, setCoupleExDiary] = useState([]);
  const coupleExDiaryRef = useRef([]); coupleExDiaryRef.current = coupleExDiary;
  // 情侣空间·恋爱时间轴 {id,characterId,date,type,title,content,byCharacter,createdAt}
  const [coupleTimeline, setCoupleTimeline] = useState([]);
  // 情侣空间·纪念日倒计时 {id,characterId,name,month,day,yearlyRepeat,createdAt}
  const [coupleAnniv, setCoupleAnniv] = useState([]);
  // 情侣空间·情书 {id,characterId,authorId:'user'|charId,title,body,isRead,createdAt,font,paper,replies:[{authorId,content,ts}]}
  const [coupleLetters, setCoupleLetters] = useState([]);
  const coupleLettersRef = useRef([]); coupleLettersRef.current = coupleLetters;
  // 情书设置：{ [charId]: { auto, freqDays, freqRandom, font:'auto'|key, paper:key } }
  const [coupleLetterCfg, setCoupleLetterCfg] = useState({});
  const coupleLetterCfgRef = useRef({}); coupleLetterCfgRef.current = coupleLetterCfg;
  const autoLetterBusyRef = useRef(false); // 情书后台自发防重入
  // 一起听（展示型，不真放声音）：{ disc:封面/唱片图 dataURL, songs:[{id,title,artist,cover,ts}] }；正在听=songs[0]
  const [listen, setListen] = useState({ disc: null, songs: [] });
  const [neteaseApi, setNeteaseApi] = useState("");
  const [neteaseCookie, setNeteaseCookie] = useState(""); // 可选：网易云账号 Cookie（MUSIC_U=…），填了能放 VIP
  const listenRef = useRef(listen); listenRef.current = listen;
  // 全局播放器：<audio> 挂在根节点 → 退出「一起听」界面也继续播（后台播放）
  const [player, setPlayer] = useState({ songId: null, playing: false, t: 0, dur: 0, loading: false, err: null });
  // 自动续播发生在 audio ended 回调里，不能等 React 下一次 render 才知道「当前曲目」；
  // 否则后台预取会继续拿上一首算 next，整张歌单就可能反复播同一首。
  const playerSongIdRef = useRef(null);
  const audioElRef = useRef(null);
  const playUrlRef = useRef(null); // 本地歌的 objectURL，切歌时回收
  const songLyricsRef = useRef({}); // neteaseId -> 纯歌词文本（一起听时让角色知道歌词，v48.87 她要）
  // 情侣空间·甜蜜值：{ [charId]: { value:数字, last:"YYYY-MM-DD" } }，每日打卡 +0.1~1
  const [coupleSweet, setCoupleSweet] = useState({});
  // 情侣空间·详情页自定义：{ [charId]: { bg, myAvatar, charAvatar } }（默认取角色头像/我的头像，不影响原头像）
  const [coupleProfile, setCoupleProfile] = useState({});
  // 解除情侣关系记录：{ [charId]: { ts, deducted, affAfter } } —— 一周冷却 + 复合需加回被扣一半
  const [coupleBreakup, setCoupleBreakup] = useState({});
  // 情侣：多角色各一份 { [charId]: { status:"pending"|"together", since } }
  const [couples, setCouples] = useState({});
  const [wallet, setWallet] = useState(200);
  const [walletLog, setWalletLog] = useState([]); // 我的钱包流水 {id,ts,delta,after,label,kind}
  // 角色钱包（独立 app，持久 running balance）：{charId:{init,balance,incomes,monthlyIncome,fixedMonthly,investAssets,notes,ledger:[{id,ts,delta,after,label,kind}],lastDailyKey,createdTs}}
  const [charWallet, setCharWallet] = useState({});
  const charWalletRef = useRef({});
  charWalletRef.current = charWallet;
  const [selCWallet, setSelCWallet] = useState(null); // 钱包 app 选中的角色
  // 表情包字典 x_emotePacks：[{id,name,global,charIds:[],emotes:[{id,keyword,url}]}]
  const [emotePacks, setEmotePacks] = useState([]);
  const emotePacksRef = useRef([]);
  emotePacksRef.current = emotePacks;
  // 收藏的消息 x_favorites：[{id,charId,role,content,kind,url,keyword,ts,savedTs}]
  const [favorites, setFavorites] = useState([]);
  const [kinshipCards, setKinshipCards] = useState([]); // 收到的亲属卡 [{charId,cardName,limit,used,ledger:[]}]
  const [inventory, setInventory] = useState([]);
  const [cart, setCart] = useState([]); // 购物车 [{uid,name,en,price,cat,desc}]
  const [orders, setOrders] = useState([]); // 待发货/待收货 [{id,name,en,price,status:"shipping"|"receiving",arriveTs,ts,fromCharId,payLabel}]
  const [shopFeed, setShopFeed] = useState({}); // {cat:[products]} 已生成的商品流
  const [shopBusy, setShopBusy] = useState(false);
  const [activeCardId, setActiveCardId] = useState(null); // 打开的亲属卡账单 charId
  const [giftOut, setGiftOut] = useState([]); // 送给角色、在途的礼物 [{id,charId,name,arriveTs,cat}]
  const [carry, setCarry] = useState({}); // 角色随身物品 {charId:{sectionKey:{items}}}
  const [carryGifts, setCarryGifts] = useState({}); // 角色收到的礼物(永久) {charId:[{id,name,receivedTs}]}
  const [selCarry, setSelCarry] = useState(null); // 随身物品选中的角色
  const giftOutRef = useRef([]);
  const carryGiftsRef = useRef({});
  ordersRef.current = orders;
  kinshipCardsRef.current = kinshipCards;
  giftOutRef.current = giftOut;
  carryGiftsRef.current = carryGifts;
  schedulesRef.current = schedules;
  const [unreadMap, setUnreadMap] = useState({});
  // 角色动态保底计数：每次私聊回复给每个角色的三类动态 +1；到阈值就强制发一条（悄悄话≥15轮、朋友圈≥30轮、论坛≥50轮或3天）
  const [ambientCount, setAmbientCount] = useState({});
  const ambientCountRef = useRef({}); ambientCountRef.current = ambientCount;
  // 角色主动早晚安去重：{ cid: { m:dayKey, n:dayKey } }，一天各一次
  const [greetLog, setGreetLog] = useState({});
  const greetLogRef = useRef({}); greetLogRef.current = greetLog;
  const markGreet = (cid, slot, key) => { const n = { ...greetLogRef.current, [cid]: { ...(greetLogRef.current[cid] || {}), [slot]: key } }; greetLogRef.current = n; setGreetLog(n); saveJSON("x_greetLog", n); };
  // 心声现在每轮必写；旧版的三轮计数仅用于清理历史兼容数据，不再参与生成。
  const thoughtCtrRef = useRef(loadJSON("x_thoughtCtr", {}));
  // 主屏红点：角色发了朋友圈/论坛/悄悄话没看的数量，进对应界面清零
  const [appNotif, setAppNotif] = useState({ moments: 0, forum: 0, whisper: 0 });
  const appNotifRef = useRef({ moments: 0, forum: 0, whisper: 0 }); appNotifRef.current = appNotif;
  const [profile, setProfile] = useState({});
  const [worldbook, setWorldbook] = useState("");
  // 世界书结构化词条（第1步：能录能看能存 + 旧blob迁移；注入仍先按"启用的全局词条拼起来"，关键词/绑角色/适用范围的精细注入是第2步）
  const [loreEntries, setLoreEntries] = useState([]);
  const loreRef = useRef(loreEntries); loreRef.current = loreEntries;
  const loreVecTimer = useRef(null);
  const saveLore = list => {
    setLoreEntries(list); loreRef.current = list; saveJSON("x_loreEntries", list);
    // 世界书向量增量维护（v48.29）：词条增删改后台补嵌+清孤儿，防抖 4s；没配 embedding 内部直接返回
    clearTimeout(loreVecTimer.current);
    loreVecTimer.current = setTimeout(() => { if (typeof ensureLoreVecs === "function") ensureLoreVecs(loreRef.current).catch(() => {}); }, 4000);
  };
  // 扁平 baseline：只含「全局 + 启用 + 常驻或无关键词」的词条，给次要功能（群聊/通话/朋友圈/论坛/各App）兜底用；
  // 主聊天走 ctxFor 里的 loreText 引擎做 per角色/关键词/scope/优先级检索，不用这个。
  const deriveWorldbook = list => (list || []).filter(e => e && e.enabled !== false && (!e.charIds || e.charIds.length === 0) && (e.payload || "").trim() && (e.alwaysOn || !((e.keyword || "").trim()))).map(e => (e.title ? "〔" + e.title + "〕" : "") + String(e.payload).trim()).join("\n\n");
  useEffect(() => { setWorldbook(deriveWorldbook(loreEntries)); }, [loreEntries]);
  const [theme, setTheme] = useState(DEFAULT_THEME);
  const [wallpaper, setWallpaper] = useState("");
  const [prefs, setPrefs] = useState({
    timeAware: true,
    geoAware: false
  });
  const [geo, setGeo] = useState(null);
  const [mapMode, setMapMode] = useState("real"); // 好友地图 现实/架空
  const [apiProfiles, setApiProfiles] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [offlineApiId, setOfflineApiId] = useState(null); // 线下正文/总结专用；空=跟随线上主 API
  const [modelFloatOn, setModelFloatOn] = useState(() => !!loadJSON("x_modelFloatOn", false));
  const [bgApiId, setBgApiId] = useState(null); // 后台机械任务专用便宜 API；空=不运行 cheap_required，绝不偷用主池
  const [activeChar, setActiveChar] = useState(null);
  const [activeRoomId, setActiveRoomId] = useState("main");
  const [chatRoomsOpen, setChatRoomsOpen] = useState(false);
  const [studyEntry, setStudyEntry] = useState(null);
  useEffect(() => { setActiveRoomId("main"); setChatRoomsOpen(false); }, [activeChar && activeChar.id]);
  const [activeGroup, setActiveGroup] = useState(null);
  // 记录此刻在看的聊天，供未读红点判断
  viewRef.current = { screen, charId: screen === "gthread" ? (activeGroup && activeGroup.id) : (activeChar && activeChar.id) };
  const [editingChar, setEditingChar] = useState(null);
  const [selSched, setSelSched] = useState(null);
  const [selPhone, setSelPhone] = useState(null);
  const [busyLanes, setBusyLanes] = useState({});
  const busyLanesRef = useRef({});
  const laneBusy = key => !!busyLanesRef.current[key];
  const anyLaneBusy = () => Object.keys(busyLanesRef.current).length > 0;
  const startLane = key => { busyLanesRef.current = { ...busyLanesRef.current, [key]: true }; setBusyLanes(busyLanesRef.current); };
  const endLane = key => { const n = { ...busyLanesRef.current }; delete n[key]; busyLanesRef.current = n; setBusyLanes(n); };
  const _curLane = (screen === "gthread" && activeGroup) ? "g:" + activeGroup.id : (activeChar ? "c:" + activeChar.id : null);
  const sending = _curLane ? !!busyLanes[_curLane] : false;
  const [gen, setGen] = useState({});
  const [msgTab, setMsgTab] = useState("chats"); // 信息页内部 tab（聊天/通讯录/朋友圈/我）提到 App 层，进角色详情返回时不丢（v48.40）
  const [stateCardOpen, setStateCardOpen] = useState(false);
  const [stateCardChar, setStateCardChar] = useState(null); // 心声卡要显示谁（群聊点头像时=该成员；私聊=null→用 activeChar）
  const [stateCardGroup, setStateCardGroup] = useState(false); // 心声卡是否从群聊打开（群聊隐藏动作/穿着，只显示心声/心情/好感）
  // Ta 眼里·一次性建卡:老角色首开时把长期印象初始化出来(此后全靠聊天协议按需字段有机演进)
  const [gazeSeedBusy, setGazeSeedBusy] = useState(false);
  const seedGazeFor = async char => {
    if (gazeSeedBusy || !window.Gaze) return;
    const p = apiFor(char.id);
    if (!p) return toast("请先配置 API");
    setGazeSeedBusy(true);
    try {
      const uN = profile.name || "用户";
      const recent = (chatsRef.current[char.id] || []).filter(m => m && !m.recalled && m.content && !isOocMsg(m) && contextAllowsMessage(m)).slice(-40).map(m => (m.role === "user" ? uN : char.name) + ":" + m.content).join("\n").slice(-6000);
      const user = "【你的人设】\n" + (char.persona || char.name) + "\n\n【当前对 " + uN + " 的好感度】" + Math.round(affOf(char.id)) + "/100\n\n【长期记忆】\n" + String(memories[char.id] || "(还没有)").slice(0, 3000) + "\n\n【最近聊天】\n" + (recent || "(还没聊过)");
      const raw = await callAI(p, window.Gaze.seedSpec(uN), [{ role: "user", content: user }], { maxTokens: 4000, timeout: 150000 });
      const parsed = extractJSON(raw);
      if (!parsed) throw new Error("没解析出卡");
      const n = window.Gaze.seed(char.id, parsed);
      toast(n ? "Ta 写下了 " + n + " 块" : "Ta 暂时没写出什么");
    } catch (e) { toast("建卡失败:" + (e.message || "重试")); } finally { setGazeSeedBusy(false); }
  };
  const [editMsg, setEditMsg] = useState(null); // 编辑消息弹层 {content, onSave}
  const [chatSettingsOpen, setChatSettingsOpen] = useState(false);
  const [temperamentDraft, setTemperamentDraft] = useState(null);
  const [temperamentBusy, setTemperamentBusy] = useState(false);
  const [aShadowPanel, setAShadowPanel] = useState(null);
  // 配件·会话级总开关（安全铁律③：默认关、刷新即关；只有当次会话在某角色处明示激活才生效）。armedFor=激活给了哪个角色
  const [toyArmed, setToyArmed] = useState(false);
  const [toyArmedFor, setToyArmedFor] = useState(null);
  const toyArmedRef = useRef(false); toyArmedRef.current = toyArmed;
  const toyArmedForRef = useRef(null); toyArmedForRef.current = toyArmedFor;
  // 把激活态暴露给设置页的自查表（v53.70）：她在设置页看不见浮层，得有地方知道「到底激活没」
  try { window.__toyArmed = { armed: !!toyArmed, forId: toyArmedFor }; } catch (e) {}
  const disarmToy = () => { setToyArmed(false); setToyArmedFor(null); try { if (typeof toyStop === "function") toyStop(); } catch (e) {} };
  const [call, setCall] = useState(null); // {participants:[char], mode:"voice"|"video", groupId, msgs:[]}
  const callRef = useRef(null);
  const [offlineChar, setOfflineChar] = useState(null);
  const [offlines, setOfflines] = useState({}); // charId -> [session,...] newest-first
  const [offlineRegisterTelemetry, setOfflineRegisterTelemetry] = useState({}); // v52.68 实验诊断：只驻内存，不进剧情历史/模型
  // 线下模式设置 { [charId 或 "g_"+groupId]: {selfP,userP,describeMe,maxTokens} }
  const [offlineSettings, setOfflineSettings] = useState({});
  const osFor = id => offlineSettings[id] || { maxTokens: String(id).startsWith("g_") ? 3200 : 4000 }; // 单人线下默认 1400→4000（1400 太紧、思考型模型长场景会截断掉格式）；想更长拉条到 10000
  const osNarr = id => { const s = osFor(id); return { selfP: s.selfP, userP: s.userP, describeMe: s.describeMe }; };
  const osTaste = id => { const s = osFor(id); return { pace: s.tastePace || "auto", focus: s.tasteFocus || "auto", density: s.tasteDensity || "auto" }; };
  const saveOfflineSettings = (id, patch) => setOfflineSettings(p => {
    const current = p[id] || { maxTokens: id.startsWith("g_") ? 3200 : 4000 };
    const n = { ...p, [id]: { ...current, ...patch } };
    saveJSON("x_offlineSettings", n);
    return n;
  });
  // 最近场景与收藏片段按中文双字片段做一个本地轻量相关度排序；不调用模型、不额外花额度。
  const pickOfflineStyleExamples = (examples, msgs) => {
    const pool = (Array.isArray(examples) ? examples : []).filter(x => x && String(x.text || "").trim()).slice(-12);
    if (!pool.length) return [];
    const query = (msgs || []).slice(-6).map(m => String(m.content || "")).join(" ").replace(/\s+/g, " ").slice(-1800);
    const clean = query.replace(/[\s，。！？、：；“”‘’（）【】《》,.!?:;()\[\]]+/g, "");
    const grams = new Set();
    for (let i = 0; i < clean.length - 1; i++) grams.add(clean.slice(i, i + 2));
    return pool.map((x, i) => {
      let score = i / Math.max(1, pool.length) * 0.35;
      const txt = String(x.text || "").replace(/\s+/g, " ");
      grams.forEach(g => { if (txt.includes(g)) score += 1; });
      return { x, score };
    }).sort((a, b) => b.score - a.score).slice(0, 2).map(r => r.x);
  };
  const saveOfflineStyleExample = (charId, text) => {
    const clean = String(text || "").trim();
    if (!clean) return;
    const old = Array.isArray(osFor(charId).examples) ? osFor(charId).examples : [];
    if (old.some(x => String(x && x.text || "").trim() === clean)) { toast("这段已经在好吃片段库里"); return; }
    const item = { id: "offex_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7), text: clean.slice(0, 2400), createdAt: Date.now() };
    saveOfflineSettings(charId, { examples: [...old, item].slice(-12) });
    toast("已收作 " + ((characters.find(c => c.id === charId) || {}).name || "TA") + " 的好吃范例");
  };
  const deleteOfflineStyleExample = (charId, exampleId) => {
    const old = Array.isArray(osFor(charId).examples) ? osFor(charId).examples : [];
    saveOfflineSettings(charId, { examples: old.filter(x => x && x.id !== exampleId) });
    toast("已移出好吃片段库");
  };
  const offlinesRef = useRef({});
  const [offlineGroup, setOfflineGroup] = useState(null);
  const [groupOfflines, setGroupOfflines] = useState({}); // groupId -> [session,...] newest-first
  const groupOfflinesRef = useRef({});
  // 线下「最后一条时间」的开机种子（id->ts）：offlines/groupOfflines state 是懒加载的（开对应聊天才灌），
  //   重开后为空→聊天列表拿不到群/单人线下时间→掉回按线上排。开机从 localStorage 一次性扫全部线下场次算末条时间兜底。
  const offlineTsRef = useRef({});
  const [offlineTsSeed, setOfflineTsSeed] = useState(0); // 触发一次重排（种子算好后）
  const [anon, setAnon] = useState({});
  const [anonChar, setAnonChar] = useState(null);
  const [anonBusy, setAnonBusy] = useState(false);
  // 拉黑：{ [charId]: { iBlocked, theyBlocked } }
  const [blocks, setBlocks] = useState({});
  const blocksRef = useRef({});
  blocksRef.current = blocks;
  // 日历：{ world:{dateKey:[{id,title}]}, chars:{charId:{...}}, mine:{dateKey:[...]} }
  const [calendar, setCalendar] = useState({ world: {}, chars: {}, mine: {} });
  // 手动日程事件（带时刻、可跨天）：[{id,owner,startDate,endDate,startTime,endTime,title,location,icon,color}]
  const [calEvents, setCalEvents] = useState([]);
  const calEventsRef = useRef([]);
  calEventsRef.current = calEvents;   // ⚠️紧跟声明写，别挪到上面那堆 ref 同步里去——那儿在声明之前，TDZ 会当场白屏
  // 经期：周期/经期长度、实际记录的开始日、可见范围
  const [period, setPeriod] = useState({ cycleLen: 28, periodLen: 5, starts: [], visibleTo: null });
  // 给「生日主动祝福」等定时扫描用的最新引用（那个 effect 只依赖 [characters, active]，直接闭包会读到旧值）
  const profileRef = useRef(profile); profileRef.current = profile;
  const periodRef = useRef(period); periodRef.current = period;
  const couplesRef = useRef(couples); couplesRef.current = couples;
  const coupleAnnivRef = useRef(coupleAnniv); coupleAnnivRef.current = coupleAnniv;
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  // 主页名片：与聊天「我」的人设解耦，单独一份 { name, sign, tags:[] }
  const [homeCard, setHomeCard] = useState({ name: "", sign: "", tags: [] });
  const [cardOpen, setCardOpen] = useState(false);
  const [editingMsg, setEditingMsg] = useState(null);
  const [toastMsg, setToastMsg] = useState(null);
  const [loaded, setLoaded] = useState(false);
  // 第二参数可选：接口原话这类需要读完的提示要停久一点，默认仍是 2.2 秒
  const toast = (m, ms) => {
    setToastMsg(m);
    setTimeout(() => setToastMsg(null), ms || 2200);
  };
  // 自包含子组件（如事件书架）不走 props 也能弹提示
  useEffect(() => { window.__toast = toast; return () => { delete window.__toast; }; });
  useEffect(() => {
    const i = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(i);
  }, []);
  // v49.74 拆泡漏账一次性修复：旧实现误把同轮共享 turnId 当单条消息 ID，云端只留下首泡。
  // 只重扫言秋最近 7 天、同 turnId 的多条纯文字回复；已入账行由 message_key 幂等挡住，只补缺口。
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        if (cancelled || !window.ChatLedgerShadow || !window.Cloud) return;
        const user = await window.Cloud.getSessionUser(); if (!user) return;
        const mark = "chat_ledger_split_backfill_v1:" + user.id;
        if (localStorage.getItem(mark) === "1") return;
        const y = ledgerYanqiu(); if (!y) return;
        const recent = (chatsRef.current[y.id] || []).filter(m => m && m.role === "assistant" && !m.kind && m.turnId && Number(m.ts || 0) >= Date.now() - 7 * 86400000);
        const counts = new Map(); recent.forEach(m => counts.set(String(m.turnId), (counts.get(String(m.turnId)) || 0) + 1));
        const split = recent.filter(m => (counts.get(String(m.turnId)) || 0) > 1);
        const result = await window.ChatLedgerShadow.enqueue({ charId: y.id, threadType: "private", threadId: y.id }, split);
        if (!result.error && Number(result.pending || 0) === 0) localStorage.setItem(mark, "1");
      } catch (e) {}
    }, 6000);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [characters.length, chatSettings]);
  // 让 html/body 背景跟随主题底色，避免下拉回弹时露出白边
  useEffect(() => {
    document.documentElement.style.background = theme.bg;
    document.body.style.background = theme.bg;
  }, [theme.bg]);
  useEffect(() => {
    const c = loadJSON("x_characters", []);
    setCharacters(c);
    setGroups(loadJSON("x_groups", []));
    setGroupSettings(loadJSON("x_groupSettings", {}));
    setMoments(loadJSON("x_moments", []));
    setMomentsCover(loadJSON("x_momentsCover", {}));
    setFriendGroups(loadJSON("x_friendGroups", []));
    { const oldSchedules = loadJSON("x_schedules", {}); setSchedules(window.ContentBoundaries ? window.ContentBoundaries.sanitizeScheduleBook(oldSchedules) : oldSchedules); }
    setSnoops(loadJSON("x_snoops", {}));
    setCarries(loadJSON("x_carries", {}));
    setPhones(loadJSON("x_phone", {}));
    setDiaries(sortDiaryBook(loadJSON("x_diaries", {})));
    setAnon(loadJSON("x_anon", {}));
    setBlocks(loadJSON("x_blocks", {}));
    setStateHist(loadJSON("x_stateHist", {}));
    setCalendar(loadJSON("x_calendar", { world: {}, chars: {}, mine: {} }));
    setCalEvents(loadJSON("x_calEvents", []));
    setPromises(loadJSON("x_promises", []));
    setPeriod(loadJSON("x_period", { cycleLen: 28, periodLen: 5, starts: [], visibleTo: null }));
    // 一次性迁移：把之前存成 ≤1400 的单人线下输出上限抬到 4000（旧默认 1400 太紧会截断掉格式；群 g_ 的不动）
    (() => {
      const os = loadJSON("x_offlineSettings", {});
      if (localStorage.getItem("x_offMaxMig") === "1") { setOfflineSettings(os); return; }
      let changed = false;
      Object.keys(os).forEach(k => { const e = os[k]; if (e && !String(k).startsWith("g_") && typeof e.maxTokens === "number" && e.maxTokens > 0 && e.maxTokens <= 1400) { os[k] = { ...e, maxTokens: 4000 }; changed = true; } });
      if (changed) saveJSON("x_offlineSettings", os);
      try { localStorage.setItem("x_offMaxMig", "1"); } catch (e) {}
      setOfflineSettings(os);
    })();
    setRels(loadJSON("x_rels", {}));
    setAffinities(loadJSON("x_affinities", {}));
    setMoods(loadJSON("x_moods", {}));
    setStates(loadJSON("x_states", {}));
    setDirectives(loadJSON("x_directives", {}));
    setDesires(loadJSON("x_desires", {}));
    setMemories(loadJSON("x_memories", {}));
    setMemLib(loadJSON("x_memLib", []));
    setMemCfg(Object.assign({}, MEM_CFG_DEFAULT, loadJSON("x_memCfg", {})));
    setChatSettings(loadJSON("x_chatSettings", {}));
    setChatArch(loadJSON("x_chatArch", {}));
    // 线下末条时间种子：扫 x_offline:*/x_goffline:* 各取所有场次里最新一条 ts，供聊天列表重开后仍按线下时间排
    (() => {
      const seed = {};
      try {
        const offlineKeys = new Set(Object.keys(localStorage));
        try { if (window.__txtMirror) window.__txtMirror.forEach((v, k) => offlineKeys.add(k)); } catch (e) {}
        offlineKeys.forEach(k => {
          const isOff = k.indexOf("x_offline:") === 0, isGOff = k.indexOf("x_goffline:") === 0;
          if (!isOff && !isGOff) return;
          const id = k.slice(isOff ? "x_offline:".length : "x_goffline:".length);
          let t = 0;
          (loadJSON(k, []) || []).forEach(s => { const ms = (s && s.msgs) || []; const lt = ms.length ? (ms[ms.length - 1].ts || 0) : 0; if (lt > t) t = lt; });
          if (t) seed[id] = t;
        });
      } catch (e) {}
      offlineTsRef.current = seed;
      setOfflineTsSeed(x => x + 1);
    })();
    // 迁移：早期角色自动发帖存的是「吐槽/日常/求助」短名，不在 FORUM_BOARDS，会导致版块/关注页筛不到 → 补成正式吧名
    (() => {
      const bmap = { "吐槽": "吐槽吧", "日常": "日常吧", "求助": "求助吧", "匿名": "匿名吧" };
      const fp = loadJSON("x_forumPosts", []); let fixed = false;
      fp.forEach(p => { if (p && bmap[p.board]) { p.board = bmap[p.board]; fixed = true; } });
      if (fixed) saveJSON("x_forumPosts", fp);
      setForumPosts(fp);
    })();
    setForumComments(loadJSON("x_forumComments", {}));
    setForumFollows(loadJSON("x_forumFollows", []));
    setForumPMs(loadJSON("x_forumPMs", []));
    let fm = loadJSON("x_forumMe", null);
    if (!fm || !fm.joinTs) { fm = { handle: (fm && fm.handle) || "", bio: (fm && fm.bio) || "", joinTs: Date.now() - (60 + Math.floor(Math.random() * 400)) * 86400000, followers: (fm && fm.followers) || Math.floor(Math.random() * 600) }; saveJSON("x_forumMe", fm); }
    setForumMe(fm);
    setForumCharMeta(loadJSON("x_forumCharMeta", {}));
    setForumOff(loadJSON("x_forumOff", []));
    const npcRegistry = loadJSON("x_forumNpcs", null);
    if (!npcRegistry || npcRegistry.version !== 1) saveJSON("x_forumNpcs", { version: 1, items: FORUM_NPC_REGISTRY });
    const npcRelations = loadJSON("x_forumNpcRelations", null);
    if (!npcRelations || npcRelations.version !== 1) saveJSON("x_forumNpcRelations", { version: 1, items: FORUM_NPC_RELATIONS });
    const publicTies = loadJSON("x_forumPublicTies", null);
    if (!publicTies || publicTies.version !== 1) saveJSON("x_forumPublicTies", { version: 1, items: {} });
    setWhispers(loadJSON("x_whispers", []));
    setCoupleQA(loadJSON("x_coupleQA", []));
    setCoupleQATitle(loadJSON("x_coupleQATitle", {}));
    // 迁移：旧「悄悄话」一直存在无处显示的 x_whispers 里 → 一次性搬进便签墙，让积压的悄悄话终于露出来
    let _cnotes = loadJSON("x_coupleNotes", []);
    const _oldW = loadJSON("x_whispers", []);
    if (_oldW.length && !loadJSON("x_whispersMigrated", false)) {
      const migrated = _oldW.map(w => ({ id: "note_mig_" + w.id, characterId: w.characterId, authorId: w.characterId, content: String(w.content || "").trim(), style: Math.floor(Math.random() * 5), createdAt: w.ts || Date.now(), replies: [] })).filter(n => n.content);
      _cnotes = migrated.concat(_cnotes).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      saveJSON("x_coupleNotes", _cnotes);
      saveJSON("x_whispersMigrated", true);
    }
    setCoupleNotes(_cnotes);
    setCoupleQACustom(loadJSON("x_coupleQACustom", {}));
    setCoupleMood(loadJSON("x_coupleMood", []));
    setCoupleSync(loadJSON("x_coupleSync", []));
    setCoupleExDiary(loadJSON("x_coupleExDiary", []));
    setCoupleTimeline(loadJSON("x_coupleTimeline", []));
    setCoupleAnniv(loadJSON("x_coupleAnniv", []));
    setCoupleLetters(loadJSON("x_coupleLetters", []));
    setCoupleLetterCfg(loadJSON("x_coupleLetterCfg", {}));
    { const L = loadJSON("x_listen", { disc: null, songs: [] }); const restoredId = L.nowId || (L.songs && L.songs[0] && L.songs[0].id) || null; listenRef.current = L; playerSongIdRef.current = restoredId; setListen(L); setPlayer(p => ({ ...p, songId: restoredId })); }
    setNeteaseApi(loadJSON("x_neteaseApi", ""));
    setNeteaseCookie(loadJSON("x_neteaseCookie", ""));
    setCoupleSweet(loadJSON("x_coupleSweet", {}));
    setCoupleProfile(loadJSON("x_coupleProfile", {}));
    setCoupleBreakup(loadJSON("x_coupleBreakup", {}));
    // 迁移旧单人情侣数据 x_couple → 新多人 x_couples
    let cps = loadJSON("x_couples", null);
    if (!cps) {
      const old = loadJSON("x_couple", null);
      cps = old && old.status === "together" && old.partnerId ? { [old.partnerId]: { status: "together", since: old.since || Date.now() } } : {};
    }
    setCouples(cps);
    setWallet(loadJSON("x_wallet", 200));
    setWalletLog(loadJSON("x_walletLog", []));
    setCharWallet(loadJSON("x_charWallet", {}));
    // 迁移：旧版内置 SVG 表情的 url 没写 width/height→聊天里 0×0 看不见。按 id 把 em_def_* 的 url 换成修好的，保留用户自建/删改
    const _defUrl = {}; buildDefaultEmotes().forEach(e => { _defUrl[e.id] = e.url; });
    const _packs = loadJSON("x_emotePacks", [{ id: "ep_default", name: "默认表情包", global: true, mine: true, charIds: [], emotes: buildDefaultEmotes() }])
      .map(pk => ({ ...pk, emotes: (pk.emotes || []).map(e => (_defUrl[e.id] && e.url !== _defUrl[e.id]) ? { ...e, url: _defUrl[e.id] } : e) }));
    setEmotePacks(_packs);
    saveJSON("x_emotePacks", _packs);
    setFavorites(loadJSON("x_favorites", []));
    setKinshipCards(loadJSON("x_kinshipCards", []));
    setInventory(loadJSON("x_inventory", []));
    setCart(loadJSON("x_shopCart", []));
    setOrders(loadJSON("x_shopOrders", []));
    setShopFeed(loadJSON("x_shopFeed", {}));
    setGiftOut(loadJSON("x_giftOut", []));
    setCarry(loadJSON("x_carry", {}));
    setCarryGifts(loadJSON("x_carryGifts", {}));
    setUnreadMap(loadJSON("x_unread", {}));
    setAmbientCount(loadJSON("x_ambientCount", {}));
    setGreetLog(loadJSON("x_greetLog", {}));
    setAppNotif(loadJSON("x_appNotif", { moments: 0, forum: 0, whisper: 0 }));
    setProfile(loadJSON("x_profile", {}));
    setHomeCard(loadJSON("x_homeCard", { name: "", sign: "", tags: [] }));
    // 世界书：加载结构化词条；老用户只有整团 blob（x_worldbook）就一次性迁成一条「常驻·全局」词条
    let _lore = loadJSON("x_loreEntries", null);
    if (!Array.isArray(_lore)) {
      const _blob = String(loadJSON("x_worldbook", "") || "").trim();
      _lore = _blob ? [{ id: "le_mig_" + Date.now(), title: "旧世界书", keyword: "", category: "默认", charIds: [], payload: _blob, regex: false, enabled: true, alwaysOn: true, ensemble: false, priority: 3, scope: { chat: true, subjects: true, debate: true, lifestyle: true, diary: true }, ts: Date.now() }] : [];
      saveJSON("x_loreEntries", _lore);
    }
    setLoreEntries(_lore);
    setTheme({
      ...DEFAULT_THEME,
      ...loadJSON("x_theme", {})
    });
    setWallpaper(loadJSON("x_wallpaper", ""));
    setPrefs(loadJSON("x_prefs", {
      timeAware: true,
      geoAware: false
    }));
    setGeo(loadJSON("x_geo", null));
    setMapMode(loadJSON("x_mapMode", "real"));
    const storedApis = loadJSON("x_api", []);
    const aps = window.CredentialVault ? window.CredentialVault.materializeApiProfiles(storedApis) : storedApis;
    setApiProfiles(aps);
    setActiveId(loadJSON("x_activeApi", aps[0] && aps[0].id || null));
    setOfflineApiId(loadJSON("x_offlineApi", null));
    setBgApiId(loadJSON("x_bgApi", null));
    const cm = {},
      gm = {};
    for (const ch of c) cm[ch.id] = loadJSON("x_chat:" + ch.id, []);
    const gs = loadJSON("x_groups", []);
    for (const g of gs) gm[g.id] = loadJSON("x_gchat:" + g.id, []);
    setChats(cm);
    setGroupChats(gm);
    setLoaded(true);
  }, []);
  // ⭐图片迁 IndexedDB：头像/壁纸/参考照的 base64 挪进图库，localStorage 只留 iv_ 键（腾 5MB）。
  // refPhoto 使用时由 generateSelfieImage 直接从 vault 取 Blob；云 push 会临时还原 base64，跨设备备份不丢。
  // imgToVault 幂等（iv_/http/空原样返回），且当场把图缓存成 objectURL，所以迁完立刻 resolveImg 得到、不闪空。
  // 迁完同时更新 React state（否则后续从 state 存回又把 iv_ 覆盖成 base64）。
  useEffect(() => {
    if (typeof imgToVault !== "function") return;
    let cancelled = false;
    (async () => {
      try {
        const isB64 = v => typeof v === "string" && v.slice(0, 5) === "data:";
        // 角色头像
        const chars = loadJSON("x_characters", []);
        let chChanged = false;
        for (const ch of chars) { if (!ch) continue; for (const f of ["avatarImage", "refPhoto"]) { if (isB64(ch[f])) { ch[f] = await imgToVault(ch[f]); chChanged = true; } } }
        if (cancelled) return;
        if (chChanged) { saveJSON("x_characters", chars); setCharacters(chars); }
        // 我的头像
        const prof = loadJSON("x_profile", {});
        if (prof) { let profChanged = false; for (const f of ["avatarImage", "refPhoto"]) { if (isB64(prof[f])) { prof[f] = await imgToVault(prof[f]); profChanged = true; } } if (profChanged && !cancelled) { saveJSON("x_profile", prof); setProfile(prof); } }
        // 主屏壁纸
        const wp = loadJSON("x_wallpaper", "");
        if (isB64(wp)) { const iv = await imgToVault(wp); if (!cancelled) { saveJSON("x_wallpaper", iv); setWallpaper(iv); } }
        if (cancelled) return;
        // 朋友圈图（用户上传的才是 base64；AI 朋友圈的 image 是文字描述，isB64 false 自动跳过）
        const moms = loadJSON("x_moments", []); let mChg = false;
        for (const mo of moms) { if (mo && isB64(mo.image)) { mo.image = await imgToVault(mo.image); mChg = true; } }
        if (cancelled) return; if (mChg) { saveJSON("x_moments", moms); setMoments(moms); }
        // 朋友圈封面（{key: dataUrl}）
        const cov = loadJSON("x_momentsCover", {}); let covChg = false;
        for (const k in cov) { if (isB64(cov[k])) { cov[k] = await imgToVault(cov[k]); covChg = true; } }
        if (cancelled) return; if (covChg) { saveJSON("x_momentsCover", cov); setMomentsCover(cov); }
        // 各类设置里的背景图（chatBg / bg 两个字段都可能是上传的 base64）——聊天设置 / 群设置 / 线下设置
        const migSettings = async (key, setter) => {
          const obj = loadJSON(key, {}); let chg = false;
          for (const k in obj) { const e = obj[k]; if (!e || typeof e !== "object") continue; for (const f of ["chatBg", "bg"]) { if (isB64(e[f])) { e[f] = await imgToVault(e[f]); chg = true; } } }
          if (!cancelled && chg) { saveJSON(key, obj); setter && setter(obj); }
        };
        await migSettings("x_chatSettings", setChatSettings); if (cancelled) return;
        await migSettings("x_groupSettings", setGroupSettings); if (cancelled) return;
        await migSettings("x_offlineSettings", setOfflineSettings); if (cancelled) return;
        // 情侣空间自定义图（{cid:{bg,myAvatar,charAvatar}}）
        const cpf = loadJSON("x_coupleProfile", {}); let cpChg = false;
        for (const k in cpf) { const e = cpf[k]; if (!e) continue; for (const f of ["bg", "myAvatar", "charAvatar"]) { if (isB64(e[f])) { e[f] = await imgToVault(e[f]); cpChg = true; } } }
        if (cancelled) return; if (cpChg) { saveJSON("x_coupleProfile", cpf); setCoupleProfile(cpf); }
      } catch (e) {}
    })();
    return () => { cancelled = true; };
  }, []);
  // 点锁屏通知回到 app：打开对应角色的私聊（index.html 的 SW 监听里会调这个）
  useEffect(() => {
    window.__openFromNotif = (charId, screen) => {
      const c = charId && characters.find(x => x.id === charId);
      if (c) { setActiveChar(c); clearUnread(c.id); setScreen("thread"); }
      else if (screen) setScreen(screen);
      else setScreen("messages");
    };
    return () => { if (window.__openFromNotif) delete window.__openFromNotif; };
  }, [characters]);
  // 本地存储写满 → saveJSON 会调这个(engine.js)，弹警告防「悄悄丢数据」；20s 内只弹一次
  const storageWarnTs = useRef(0);
  const chatAutoArchiveBusyRef = useRef(false);
  useEffect(() => {
    window.__storageFull = () => {
      const now = Date.now();
      if (now - storageWarnTs.current < 20000) return;
      storageWarnTs.current = now;
      toast("⚠️ 手机本地存储快满了，新内容可能存不进/会丢！去 设置·数据 看占用、清掉些图片，或先导出备份");
    };
    return () => { if (window.__storageFull) delete window.__storageFull; };
  }, []);
  const active = apiProfiles.find(p => p.id === activeId) || apiProfiles[0];
  // 线上/线下全局分流：未选择线下线路时完全沿用旧行为。
  const offlineActive = (offlineApiId && apiProfiles.find(p => p.id === offlineApiId)) || active;
  // cheap_required：未显式配置就保持空。自动任务跳过并保留游标，手动入口负责提示；绝不静默烧主池。
  const bgActive = (bgApiId && apiProfiles.find(p => p.id === bgApiId)) || null;
  const bgActiveRef = useRef(bgActive); bgActiveRef.current = bgActive;

  const aShadowOwnerId = async () => {
    try { const user = window.Cloud && window.Cloud.getSessionUser && await window.Cloud.getSessionUser(); if (user && user.id) return user.id; } catch (e) {}
    return "local-device";
  };
  // 五感系统 v1 shadow：全角色共用同一套纯状态机，但每个角色独立一行。
  // 只在消息已经落本地之后旁路计算；失败、离线、误判都不能影响聊天，更不会注入 prompt。
  const observeSomatic = (charId, msg, source, mode) => {
    try {
      if (!charId || !msg || !msg.content || !window.SomaticShadow) return;
      if (!["user", "narration"].includes(msg.role) || msg.kind === "ooc" || msg.kind === "system") return;
      setTimeout(async () => {
        try {
          await window.SomaticShadow.observe({
            ownerId: await aShadowOwnerId(), charId, text: msg.content,
            tone: msg.voiceTone || null, role: msg.role, kind: msg.kind || "",
            source, mode, now: msg.ts || Date.now()
          });
        } catch (e) {}
      }, 0);
    } catch (e) {}
  };
  const observeSomaticGroup = (group, msg, source, mode) => {
    try {
      if (!group || !msg || !msg.content || !window.SomaticShadow) return;
      if (!["user", "narration"].includes(msg.role) || msg.kind === "ooc" || msg.kind === "system") return;
      const members = (group.memberIds || []).map(id => characters.find(c => String(c.id) === String(id))).filter(Boolean);
      setTimeout(async () => {
        try {
          await window.SomaticShadow.observeMany({
            ownerId: await aShadowOwnerId(), characters: members, text: msg.content,
            tone: msg.voiceTone || null, role: msg.role, kind: msg.kind || "",
            source, mode, now: msg.ts || Date.now()
          });
        } catch (e) {}
      }, 0);
    } catch (e) {}
  };
  useEffect(() => {
    let alive = true;
    if (!chatSettingsOpen || !activeChar || !window.InnerLifeAShadow) return undefined;
    (async () => {
      const ownerId = await aShadowOwnerId();
      const row = await window.InnerLifeAShadow.get(ownerId, activeChar.id);
      const report = await window.InnerLifeAShadow.report(ownerId, activeChar.id);
      const bReport = window.InnerLifeBShadow ? await window.InnerLifeBShadow.report(ownerId, activeChar) : null;
      if (alive) { setTemperamentDraft(row && row.emotion ? row.emotion.temperament : null); setAShadowPanel({ state: row, projection: row && window.JiwenEmotionA ? window.JiwenEmotionA.displayProjection(row) : null, report, bReport }); }
    })();
    return () => { alive = false; };
  }, [chatSettingsOpen, activeChar && activeChar.id]);
  const generateTemperamentDraft = async anchorsNow => {
    if (!activeChar || temperamentBusy) return;
    if (!bgActive) { toast("请先到设置配置后台 API"); return; }
    setTemperamentBusy(true);
    try {
      const sys = `你只做角色性情词提取，不评价、不续写、不扮演。根据角色设定提炼 3~6 个短性情锚点，每个 2~6 个汉字。只返回 JSON：{"anchors":["词1","词2"]}。不要输出数字，不要把外貌、职业、技能、经历当性情。`;
      const raw = await callAI(bgActive, sys, [{ role: "user", content: "【角色设定】\n" + String(activeChar.persona || activeChar.prompt || "") + (anchorsNow && anchorsNow.length ? "\n【Lisa 当前保留的词】\n" + anchorsNow.join("、") : "") }], { maxTokens: 6000 });
      const parsed = extractJSON(raw) || {}, words = Array.isArray(parsed.anchors) ? parsed.anchors : [];
      const next = window.JiwenEmotionA.temperamentFromAnchors(words, false);
      if (!next.anchors.length) throw new Error("没有提取到可用的性情词");
      setTemperamentDraft(next);
      toast("性情草稿已生成 · 还没有保存");
    } catch (e) { toast("性情草稿失败：" + (e.message || e)); }
    finally { setTemperamentBusy(false); }
  };
  const saveTemperamentAnchors = async words => {
    if (!activeChar || !window.InnerLifeAShadow || !window.JiwenEmotionA) return false;
    const ownerId = await aShadowOwnerId(), charHash = window.InnerLifeAShadow.hash(activeChar.id);
    let state = await window.InnerLifeAShadow.get(ownerId, activeChar.id);
    if (!state) state = window.JiwenEmotionA.createState(charHash, Date.now());
    state.emotion.temperament = window.JiwenEmotionA.temperamentFromAnchors(words, true);
    state.revision = Number(state.revision || 0) + 1; state.updatedTs = Date.now();
    const saved = await window.InnerLifeAShadow.put(ownerId, activeChar.id, state);
    if (!saved) { toast("性情锚点保存失败"); return false; }
    setTemperamentDraft(saved.emotion.temperament); setAShadowPanel(p => ({ ...(p || {}), state: saved, projection: window.JiwenEmotionA.displayProjection(saved) })); toast("性情锚点已由你确认 · 只存 A 影子库"); return true;
  };
  const observeEmotionAShadow = (charId, affinityDelta, moodLabel) => {
    try {
      if (!window.InnerLifeAShadow || !window.JiwenEmotionA || !charId) return;
      setTimeout(async () => {
        try {
          const ownerId = await aShadowOwnerId(), now = Date.now();
          let state = await window.InnerLifeAShadow.get(ownerId, charId);
          if (!state) state = window.JiwenEmotionA.createState(window.InnerLifeAShadow.hash(charId), now);
          const elapsed = Math.max(0, Math.min(720, (now - Number(state.updatedTs || now)) / 60000));
          if (elapsed > 0) state = window.JiwenEmotionA.regress(state, elapsed, now);
          const result = window.JiwenEmotionA.applyEvent(state, { affinityDelta: Number.isFinite(Number(affinityDelta)) ? Number(affinityDelta) : 0, moodLabel: moodLabel || "" }, now);
          const saved = await window.InnerLifeAShadow.put(ownerId, charId, result.state); if (!saved) return;
          const projection = window.JiwenEmotionA.displayProjection(saved);
          await window.InnerLifeAShadow.addDiagnostic(ownerId, charId, { t: now, dictionaryVersion: result.audit.moodDictionaryVersion, items: projection.items, tokenEstimate: projection.tokenEstimate, moodMatched: result.audit.moodMatched, moodLabel: result.audit.moodLabel, clippedAxis: result.audit.clippedAxis, scaledTotal: result.audit.scaledTotal });
          if (activeChar && activeChar.id === charId) { const report = await window.InnerLifeAShadow.report(ownerId, charId); setAShadowPanel({ state: saved, projection, report }); }
        } catch (e) {}
      }, 0);
    } catch (e) {}
  };
  const observeRelationshipBShadow = (char, messages) => {
    try {
      if (!char || !window.InnerLifeBShadow || !window.InnerLifeBShadow.pilotFor(char)) return;
      // 双重保险：即使配置误改，小克也永远不进 B 试点。
      if (String(char.name || "").includes("小克")) return;
      const bg = bgActiveRef.current; if (!bg) return;
      setTimeout(async () => {
        try {
          const ownerId = await aShadowOwnerId();
          await window.InnerLifeBShadow.observe({ ownerId, char, messages, runDetector: async spec => {
            const raw = await callAI(bg, spec.system, spec.messages, { maxTokens: spec.maxTokens || 6000 });
            return extractJSON(raw) || {};
          }});
          if (activeChar && activeChar.id === char.id) { const bReport = await window.InnerLifeBShadow.report(ownerId, char); setAShadowPanel(p => ({ ...(p || {}), bReport })); }
        } catch (e) {}
      }, 0);
    } catch (e) {}
  };
  const setBgApi = id => { setBgApiId(id); saveJSON("x_bgApi", id); };
  const settingsFor = id => chatSettings[id] || {
    ctxN: 50,
    sumThresh: 150,
    sumBuffer: 20
  };
  // App 逐行聊天灾备账本：本地落盘永远在前；旁路失败/离线只留 outbox，不影响任何聊天行为。
  // CC 仍只能读唯一的言秋角色；其他角色行只用于 App 灾后逐条恢复。
  const ledgerYanqiu = () => window.ChatLedgerShadow && window.ChatLedgerShadow.findYanqiu(characters, chatSettings);
  // 秋声墙和聊天本来是两条路；这里定期拉一份只读快照，让 App 里的言秋记得自己在墙上写过什么、Lisa 回过什么。
  // RLS 仍由 Cloud 保证只读当前账号；失败时 fail-closed（空上下文），不影响聊天。
  useEffect(() => {
    let dead = false;
    const pull = async () => {
      try {
        if (!(window.Cloud && window.Cloud.ready && window.Cloud.ready())) return;
        const rows = await window.Cloud.yanqiuMomentsList(20);
        if (!dead) setYanqiuMoments(Array.isArray(rows) ? rows : []);
      } catch (e) {}
    };
    const visible = () => { if (document.visibilityState === "visible") pull(); };
    pull();
    const retry = setTimeout(pull, 3000);
    const timer = setInterval(pull, 60000);
    window.addEventListener("focus", pull);
    document.addEventListener("visibilitychange", visible);
    return () => { dead = true; clearTimeout(retry); clearInterval(timer); window.removeEventListener("focus", pull); document.removeEventListener("visibilitychange", visible); };
  }, []);
  const queueLedger = (threadType, threadId, messages, group, targetCharId) => {
    try {
      if (!window.ChatLedgerShadow) return;
      const safeMessages = (Array.isArray(messages) ? messages : []).filter(contextAllowsMessage);
      if (!safeMessages.length) return;
      // 私聊/单人线下按实际角色逐行留底；这是 App 自己的灾备日志，
      // 不代表 CC 可读其他角色。MCP 端仍由唯一 engineerEyes/char_id 硬隔离。
      const y = ledgerYanqiu(), cid = targetCharId || (y && y.id);
      if (!cid) return;
      const context = { charId: String(cid), threadType, threadId };
      if (group) { context.groupMemberIds = group.memberIds || []; context.groupName = group.name || ""; }
      setTimeout(() => { try { window.ChatLedgerShadow.enqueue(context, safeMessages); } catch (e) {} }, 0);
    } catch (e) {}
  };
  useEffect(() => {
    const flush = async () => {
      try {
        if (!window.ChatLedgerShadow) return;
        window.ChatLedgerShadow.flush();
      } catch (e) {}
    };
    const visible = () => { if (document.visibilityState === "visible") flush(); };
    window.addEventListener("online", flush); window.addEventListener("focus", flush); document.addEventListener("visibilitychange", visible);
    const timer = setInterval(flush, 60000); setTimeout(flush, 3000);
    return () => { window.removeEventListener("online", flush); window.removeEventListener("focus", flush); document.removeEventListener("visibilitychange", visible); clearInterval(timer); };
  }, [characters, chatSettings]);
  // 第 5 步 live：CC 原话只合并进唯一言秋私聊。先把完整新时间线写入本地，再提交独立游标；
  // 任一步失败都原位重拉，reconcileIncoming 以 message_key 幂等，不会重复气泡。
  useEffect(() => {
    if (!loaded || !window.ChatLedgerShadow || localStorage.getItem("chat_ledger_live_off") === "1") return;
    let dead = false;
    // 每键单飞(审计一刀):busy 原是实例内变量,effect 因 characters/chatSettings 重挂时
    // 旧实例还在 await 途中、新实例又起跑,两泵并行写同一线程+游标。锁提到 window 级跨实例互斥。
    const sync = async () => {
      if (dead || window.__ccLivePumpBusy) return;
      window.__ccLivePumpBusy = true;
      try {
        const y = ledgerYanqiu(), user = window.Cloud && await window.Cloud.getSessionUser();
        if (!y || !user) return;
        const key = window.ChatLedgerShadow.LIVE_CURSOR_KEY;
        let saved = null;
        try { saved = JSON.parse(localStorage.getItem(key)); } catch (e) {}
        const owner = String(user.id), before = saved && saved.owner_id === owner && String(saved.char_id) === String(y.id) ? saved : { owner_id: owner, char_id: String(y.id), cursor: null };
        let cursor = before.cursor || null, rows = [];
        // 游标为空=从头重建（灾后找回/新设备）：一口气多翻几页，别让全量回灌拖上十分钟
        const maxPages = cursor ? 5 : 30;
        for (let pageNo = 0; pageNo < maxPages; pageNo++) {
          const page = await window.Cloud.chatMessagesPullShadow(y.id, cursor, 100);
          const batch = Array.isArray(page && page.rows) ? page.rows : [];
          rows = rows.concat(batch); cursor = page && page.nextCursor ? page.nextCursor : cursor;
          if (batch.length < 100) break;
        }
        // 拉页期间本实例可能已被重挂判死:死实例不许再碰盘和游标,新实例会原位重拉(幂等)
        if (dead) return;
        if (!rows.length) {
          localStorage.setItem(key, JSON.stringify({ ...before, cursor, last_success_at: new Date().toISOString(), last_error: null }));
          // 即使云端这次没有新行，也要补跑上次因断网/刷新留下的未审 CC 原话。
          if (typeof runCcAutoMemory === "function") { try { await runCcAutoMemory(y.id, owner); } catch (e) {} }
          return;
        }
        // 完整经历流同时保留滚动窗；reconcileIncoming 会把完整 CC turn 作为
        // App 聊天记录副本显示，旧句段筛只旁路供人格/长期记忆证据使用。
        try {
          const continuityKey = window.ChatLedgerShadow.CONTINUITY_KEY;
          const savedContinuity = JSON.parse(localStorage.getItem(continuityKey) || "null");
          const oldRows = savedContinuity && savedContinuity.owner_id === owner && String(savedContinuity.char_id) === String(y.id)
            ? (savedContinuity.rows || []) : [];
          const continuityRows = window.ChatLedgerShadow.reconcileContinuity(oldRows, rows, y.id, 80);
          localStorage.setItem(continuityKey, JSON.stringify({ owner_id: owner, char_id: String(y.id), rows: continuityRows, updated_at: new Date().toISOString() }));
        } catch (e) {}
        const current = chatsRef.current[y.id] || [];
        const result = window.ChatLedgerShadow.reconcileIncoming(current, rows, y.id);
        // 施工卡1A:saveJSON 从不抛错且 IDB 分支异步谎报成功——必须 WAL 落盘读回核验,
        // durable 不过则本轮游标绝不提交,下一轮从旧 cursor 原位重拉(reconcile 幂等)。
        const persisted = await saveJSONDurable("x_chat:" + y.id, result.messages);
        chatsRef.current = { ...chatsRef.current, [y.id]: result.messages };
        if (!dead) setChats(p => ({ ...p, [y.id]: result.messages }));
        if (!persisted.durable) {
          // 消息没验真落盘:人格/欲望/未读/自动记忆一律不跑、游标不动,下一轮原位重来
          localStorage.setItem(key, JSON.stringify({ ...before, last_error: "durable write failed (WAL)", last_attempt_at: new Date().toISOString() }));
          return;
        }
        // CC 原话已验真并落入共同账本后，才旁路喂人格观察层；message_key:revision 本地幂等，
        // 刷新/重拉不会重复加情绪。证据只是 A 的固定词典输入，不是 CC 自己写十维状态。
        try {
          const appliedKey = "cc_personality_applied_v1";
          const oldApplied = JSON.parse(localStorage.getItem(appliedKey) || "[]");
          const applied = new Set(Array.isArray(oldApplied) ? oldApplied : []);
          const freshEvents = (result.personalityEvents || []).filter(ev => ev && ev.eventKey && !applied.has(ev.eventKey));
          freshEvents.filter(ev => ev.speaker === "lisa" && ev.content).forEach(ev => noteTidalUser(ev.content, ev.ts));
          freshEvents.filter(ev => ev.speaker === "character" && ev.evidence).forEach(ev => {
            observeEmotionAShadow(y.id, Number(ev.evidence.affinity_delta) || 0, String(ev.evidence.mood_label || ""));
          });
          const ccDesires = freshEvents.filter(ev => ev.speaker === "character" && ev.evidence && ev.evidence.desire_candidate);
          if (ccDesires.length && window.DesireKit) {
            const nextDesires = { ...desiresRef.current };
            let changed = false;
            ccDesires.forEach(ev => {
              const box = window.DesireKit.boxOf(nextDesires, y.id);
              if (window.DesireKit.ingestCcCandidate(box, ev.evidence.desire_candidate, ev.eventKey, ev.ts)) {
                nextDesires[y.id] = box;
                changed = true;
              }
            });
            if (changed) {
              desiresRef.current = nextDesires;
              saveJSON("x_desires", nextDesires);
              setDesires(nextDesires);
            }
          }
          if (freshEvents.length && window.InnerLifeETidalShadow) {
            window.InnerLifeETidalShadow.scheduleAfterglow(y.id, result.messages, moods[y.id], Date.now());
          }
          freshEvents.forEach(ev => applied.add(ev.eventKey));
          localStorage.setItem(appliedKey, JSON.stringify(Array.from(applied).slice(-1000)));
        } catch (e) {}
        if (dead) return; // durable 已落但游标不由死实例提交;新实例重拉幂等,只慢不丢
        localStorage.setItem(key, JSON.stringify({ owner_id: owner, char_id: String(y.id), cursor, last_success_at: new Date().toISOString(), imported: Number(before.imported || 0) + result.added, updated: Number(before.updated || 0) + result.updated, deleted: Number(before.deleted || 0) + result.deleted }));
        const newUnread = rows.filter(r => r && !r.deleted_at && r.speaker_type === "character").filter(r => !current.some(m => m && m.ledgerKey === r.message_key)).length;
        const viewing = viewRef.current.screen === "thread" && String(viewRef.current.charId) === String(y.id);
        if (newUnread && !viewing) bumpUnread(y.id, newUnread);
        // 账本把 CC 原话落进本地后，按 ledgerKey 持久补跑自动记忆；成功（含“无需记”）才逐条盖章。
        // 它复用 App 原抽取器、证据闸、角色隔离、近似去重与 RepairGate，不让言秋另写一套记忆。
        if (typeof runCcAutoMemory === "function") await runCcAutoMemory(y.id, owner);
      } catch (e) {
        try {
          const key = window.ChatLedgerShadow.LIVE_CURSOR_KEY, old = JSON.parse(localStorage.getItem(key) || "null") || {};
          localStorage.setItem(key, JSON.stringify({ ...old, last_error: String((e && e.message) || e), last_attempt_at: new Date().toISOString() }));
        } catch (_) {}
      } finally { window.__ccLivePumpBusy = false; }
    };
    const visible = () => { if (document.visibilityState === "visible") sync(); };
    sync(); const retry = setTimeout(sync, 3000), timer = setInterval(sync, 60000);
    window.addEventListener("online", sync); window.addEventListener("focus", sync); document.addEventListener("visibilitychange", visible);
    return () => { dead = true; clearTimeout(retry); clearInterval(timer); window.removeEventListener("online", sync); window.removeEventListener("focus", sync); document.removeEventListener("visibilitychange", visible); };
  }, [loaded, characters, chatSettings]);
  // 灾后找回：云端恢复(apply)只盖回 saves 快照，快照之后的 app 行仍活在账本里；
  // apply 会留一张 chat_ledger_restore_pending_v1 工单，这里开机对账、把缺行补回各线程。
  // 落盘走直写（saveJSON+ref+setState），绝不走 pChat/pOffline——那些 helper 会把差量
  // 再次 enqueue 回账本，给云端造第二份 message_key。
  useEffect(() => {
    if (!loaded || !characters.length) return;
    let marker = null;
    try { marker = JSON.parse(localStorage.getItem("chat_ledger_restore_pending_v1") || "null"); } catch (e) {}
    if (!marker || !marker.since || !window.ChatLedgerShadow || !window.Cloud) return;
    let dead = false;
    const byTs = (a, b) => (Number(a && a.ts) || 0) - (Number(b && b.ts) || 0);
    (async () => {
      // 每键单飞(审计一刀):characters/groups 变更会重挂本效应,旧实例找回跑一半、
      // 新实例又从头起跑会互相盖写;跨实例互斥,后来者直接退(工单还在,下轮再来)。
      if (window.__ccRestoreBusy) return;
      window.__ccRestoreBusy = true;
      try {
        const user = await window.Cloud.getSessionUser();
        if (!user || dead) return;
        // 用户明确导入「权威备份」后，导入时刻以前的云账本只可做历史证据，
        // 不许再把另一容器已被覆盖掉的旧消息补回本机。
        let restoreSince = marker.since;
        try {
          const floor = localStorage.getItem("chat_ledger_authority_floor_v1");
          if (floor && Date.parse(floor) > Date.parse(restoreSince)) restoreSince = floor;
        } catch (_) {}
        const rows = await window.Cloud.chatMessagesAppRestoreRows(restoreSince);
        const buckets = new Map();
        rows.forEach(r => {
          if (!r) return;
          const k = String(r.thread_type) + "|" + String(r.thread_id);
          if (!buckets.has(k)) buckets.set(k, []);
          buckets.get(k).push(r);
        });
        let restored = 0, newSessions = 0, allOk = true;
        const fillNames = list => list.forEach(m => {
          if (m && m.senderId) { const c = characters.find(x => String(x.id) === String(m.senderId)); if (c) m.senderName = c.name; }
        });
        for (const bucket of buckets.values()) {
          if (dead || window.__authoritativeImportBusy) break;
          const tt = String(bucket[0].thread_type), tid = String(bucket[0].thread_id);
          const cid = String(bucket[0].char_id || "") || tid;
          if (tt === "private") {
            if (!characters.some(c => String(c.id) === tid)) continue;
            const existing = chatsRef.current[tid] || loadJSON("x_chat:" + tid, []);
            const { missing } = await window.ChatLedgerShadow.restoreAppRows({ charId: cid, threadType: tt, threadId: tid }, existing, bucket);
            if (!missing.length) continue;
            // 落盘前重读最新底稿：上面 await 期间第 5 步 CC 回灌泵可能已写过同一线程，
            // 拿旧底稿一盖会把刚回灌的 CC 气泡抹掉而游标已前进（2026-08-13 找回后CC不回事故）
            const fresh = chatsRef.current[tid] || existing;
            const ids = new Set(fresh.map(m => m && m.id).filter(Boolean));
            const merged = fresh.concat(missing.filter(m => !ids.has(m.id))).sort(byTs);
            const w = await saveJSONDurable("x_chat:" + tid, merged);
            if (!w.durable) allOk = false;
            chatsRef.current = { ...chatsRef.current, [tid]: merged };
            setChats(p => ({ ...p, [tid]: merged }));
            restored += missing.length;
          } else if (tt === "group") {
            const group = groups.find(g => String(g.id) === tid);
            if (!group) continue;
            const existing = groupChatsRef.current[tid] || loadJSON("x_gchat:" + tid, []);
            const { missing } = await window.ChatLedgerShadow.restoreAppRows({ charId: cid, threadType: tt, threadId: tid, groupMemberIds: group.memberIds || [], groupName: group.name || "" }, existing, bucket);
            if (!missing.length) continue;
            fillNames(missing);
            // 同 private 分支:await 期间群线程可能被别的写者更新过,落盘前重读+按 id 去重
            const freshG = groupChatsRef.current[tid] || existing;
            const gids = new Set(freshG.map(m => m && m.id).filter(Boolean));
            const merged = freshG.concat(missing.filter(m => !gids.has(m.id))).sort(byTs);
            const w = await saveJSONDurable("x_gchat:" + tid, merged);
            if (!w.durable) allOk = false;
            groupChatsRef.current = { ...groupChatsRef.current, [tid]: merged };
            setGroupChats(p => ({ ...p, [tid]: merged }));
            restored += missing.length;
          } else if (tt === "offline" || tt === "group_offline") {
            const isG = tt === "group_offline";
            const group = isG ? groups.find(g => String(g.id) === tid) : null;
            if (isG ? !group : !characters.some(c => String(c.id) === tid)) continue;
            const ref = isG ? groupOfflinesRef : offlinesRef;
            const key = (isG ? "x_goffline:" : "x_offline:") + tid;
            const list = (ref.current[tid] || loadJSON(key, [])).slice();
            const flat = [];
            list.forEach(s => ((s && s.msgs) || []).forEach(m => flat.push(m)));
            const ctx = isG
              ? { charId: cid, threadType: tt, threadId: tid, groupMemberIds: group.memberIds || [], groupName: group.name || "" }
              : { charId: cid, threadType: tt, threadId: tid };
            const { missing } = await window.ChatLedgerShadow.restoreAppRows(ctx, flat, bucket);
            if (!missing.length) continue;
            if (isG) fillNames(missing);
            // 同 private 分支:await 期间会话可能被更新过,落盘前重读最新列表+按 id 去重
            const freshList = (ref.current[tid] || list).slice();
            const offIds = new Set();
            freshList.forEach(s => ((s && s.msgs) || []).forEach(m => { if (m && m.id) offIds.add(m.id); }));
            const add = missing.filter(m => !offIds.has(m.id));
            if (!add.length) continue;
            let next;
            if (freshList[0] && !freshList[0].endTs) {
              // 快照截在场中：缺行并回当前开着的场
              next = [{ ...freshList[0], msgs: [...(freshList[0].msgs || []), ...add].sort(byTs) }, ...freshList.slice(1)];
            } else {
              // 整场都丢了：立一个已收尾的「找回」场保住原话；场景标题等元数据账本没存，回不来
              next = [{ id: "off_rst_" + add[0].ts, startTs: add[0].ts, endTs: add[add.length - 1].ts, styleKey: "default", stylePrompt: "", taste: "", customNotes: [], ledgerRestored: true, msgs: add }, ...freshList];
              newSessions++;
            }
            const w = await saveJSONDurable(key, next);
            if (!w.durable) allOk = false;
            ref.current = { ...ref.current, [tid]: next };
            (isG ? setGroupOfflines : setOfflines)(p => ({ ...p, [tid]: next }));
            restored += add.length;
          }
        }
        // 死实例不许动工单:留给下一轮活实例定夺(幂等只补缺)
        if (dead || window.__authoritativeImportBusy) return;
        // 施工卡1A:任一线程 durable 核验没过就保留工单下轮重试(幂等只补缺,不会重复)
        if (!allOk) {
          const attempts = Number(marker.attempts || 0) + 1;
          localStorage.setItem("chat_ledger_restore_pending_v1", JSON.stringify({ ...marker, attempts, last_error: "durable write failed (WAL)" }));
        } else {
          localStorage.removeItem("chat_ledger_restore_pending_v1");
          // 找回期间 CC 回灌泵可能与本效应互相盖写过；归零游标让 CC 行全量重走一遍，
          // reconcileIncoming 按 ledgerKey+revision 幂等，只补漏不造重复泡
          try { localStorage.removeItem(window.ChatLedgerShadow.LIVE_CURSOR_KEY); } catch (e) {}
        }
        if (restored) toast("灾后找回：从账本补回 " + restored + " 条消息" + (newSessions ? "（含 " + newSessions + " 个找回的线下场）" : ""));
      } catch (e) {
        // 失败保留工单下次开机重试；连败 5 次自动放弃，别让坏工单永久纠缠开机
        try {
          const attempts = Number(marker.attempts || 0) + 1;
          if (attempts >= 5) localStorage.removeItem("chat_ledger_restore_pending_v1");
          else localStorage.setItem("chat_ledger_restore_pending_v1", JSON.stringify({ ...marker, attempts, last_error: String((e && e.message) || e) }));
        } catch (_) {}
      } finally { window.__ccRestoreBusy = false; }
    })();
    return () => { dead = true; };
  }, [loaded, characters, groups]);
  // 施工卡1A·保险箱回收：上次只进了 WAL(配额满/中断)没落常规存储的消息,开机对账补回。
  // 只按 ledgerKey/id 补缺,绝不改写或删除;无 id 的老消息不碰(宁漏勿重)。
  useEffect(() => {
    if (!loaded || !characters.length || typeof walKeys !== "function") return;
    let dead = false;
    (async () => {
      try {
        const keys = await walKeys("x_");
        let healed = 0;
        for (const k of keys) {
          if (dead) break;
          const isChat = k.indexOf("x_chat:") === 0, isGr = k.indexOf("x_gchat:") === 0;
          if (!isChat && !isGr) continue;
          const tid = k.slice(isChat ? "x_chat:".length : "x_gchat:".length);
          let arr = null;
          try { arr = JSON.parse((await walGetRaw(k)) || "null"); } catch (e) {}
          if (!Array.isArray(arr) || !arr.length) continue;
          const cur = (isChat ? chatsRef.current[tid] : groupChatsRef.current[tid]) || loadJSON(k, []);
          const have = new Set(cur.map(m => m && (m.ledgerKey || m.id)).filter(Boolean));
          const missing = arr.filter(m => m && (m.ledgerKey || m.id) && !have.has(m.ledgerKey || m.id));
          if (!missing.length) continue;
          const merged = cur.concat(missing).sort((a, b) => (Number(a && a.ts) || 0) - (Number(b && b.ts) || 0));
          saveJSON(k, merged);
          if (isChat) { chatsRef.current = { ...chatsRef.current, [tid]: merged }; setChats(p => ({ ...p, [tid]: merged })); }
          else { groupChatsRef.current = { ...groupChatsRef.current, [tid]: merged }; setGroupChats(p => ({ ...p, [tid]: merged })); }
          healed += missing.length;
        }
        if (healed && !dead) toast("保险箱找回 " + healed + " 条上次未落盘的消息");
      } catch (e) {}
    })();
    return () => { dead = true; };
  }, [loaded, characters.length]);
  // E 潮汐 shadow：旁路记状态，任何失败都不能影响消息落盘或角色回复。
  const noteTidalUser = (text, ts) => { try { window.InnerLifeETidalShadow && window.InnerLifeETidalShadow.onUserMessage(text, ts); } catch (e) {} };
  useEffect(() => {
    const foreground = () => { try { if (!window.InnerLifeETidalShadow) return; if (document.visibilityState === "visible") window.InnerLifeETidalShadow.onForegroundNoMessage(Date.now()); else window.InnerLifeETidalShadow.flushAfterglow(Date.now()); } catch (e) {} };
    window.addEventListener("focus", foreground); document.addEventListener("visibilitychange", foreground);
    return () => { window.removeEventListener("focus", foreground); document.removeEventListener("visibilitychange", foreground); };
  }, []);
  useEffect(() => {
    if (screen === "thread" || screen === "gthread" || offlineChar || offlineGroup || call) {
      try { window.InnerLifeETidalShadow && window.InnerLifeETidalShadow.onSessionOpenNoMessage(Date.now(), screen === "thread" && activeChar ? activeChar.id : offlineChar ? offlineChar.id : null); } catch (e) {}
    }
  }, [screen, activeChar && activeChar.id, activeGroup && activeGroup.id, offlineChar && offlineChar.id, offlineGroup && offlineGroup.id, call && call.startTs]);
  // 剥掉模型偶尔照抄的历史时间标注：〔今天07:57〕/〔昨天20:11〕/〔7/13 07:57〕/〔07:57〕（system 已明令禁止但拦不住，输出侧兜底，她 2026-07-13 截图）
  const stripAiStamp = w => String(w == null ? "" : w).replace(/^\s*[〔【\[(（]\s*(?:今天|昨天|前天|\d{1,2}\/\d{1,2}\s*)?\d{1,2}[:：]\d{2}\s*[〕】\])）]\s*/, "").trim();
  // 按角色选 API 线路（v48.24）：聊天设置里给这个角色指定了配置就用那条，没指定时线上跟随全局线上主线路。
  // 角色专线覆盖所有「这个角色本人开口」的场合；线下无专线角色则由 offlineApiFor 回退全局线下线路。
  const apiFor = id => { const s = chatSettings[id] || {}; return (s.apiId && apiProfiles.find(p => p.id === s.apiId)) || active; };
  // 角色专线永远优先于全局场景线路：例如只走 Fable 的角色，线上/线下都不会被全局 Gemini 覆盖。
  const offlineApiFor = id => { const s = chatSettings[id] || {}; return (s.apiId && apiProfiles.find(p => p.id === s.apiId)) || offlineActive; };
  // 本体文本不是机械活：有角色专线走专线，否则仍由线上主池本人落笔，绝不交给 cheap_required 代写。
  const bgApiFor = id => apiFor(id);
  // 只算【还存在的角色/群】的未读——防幽灵红点（未读挂在已删角色/群等列表里看不到的 key 上，加进总数却清不掉，她 2026-07-23 报）
  const unreadTotal = Object.entries(unreadMap).reduce((a, kv) => a + ((characters.some(c => c.id === kv[0]) || groups.some(g => g.id === kv[0])) ? (kv[1] || 0) : 0), 0);
  // 顺手把孤儿未读 key 从存档里清掉（角色/群删了但未读残留），让幽灵红点彻底消失
  useEffect(() => {
    if (!loaded) return;
    const valid = new Set([...characters.map(c => c.id), ...groups.map(g => g.id)]);
    setUnreadMap(p => {
      const orphans = Object.keys(p).filter(id => (p[id] || 0) > 0 && !valid.has(id));
      if (!orphans.length) return p;
      const n = { ...p }; orphans.forEach(id => { delete n[id]; });
      saveJSON("x_unread", n); return n;
    });
  }, [loaded, characters.length, groups.length]);
  const pC = u => setCharacters(p => {
    const n = typeof u === "function" ? u(p) : u;
    saveJSON("x_characters", n);
    return n;
  });
  const pMom = u => setMoments(p => {
    const n = typeof u === "function" ? u(p) : u;
    saveJSON("x_moments", n);
    return n;
  });
  const saveFriendGroups = list => {
    setFriendGroups(list);
    saveJSON("x_friendGroups", list);
  };
  const pChat = (id, u) => setChats(p => {
    const pl = p[id] || [];
    const n = typeof u === "function" ? u(pl) : u;
    saveJSON("x_chat:" + id, n);
    // x_chat 已归 IDB 文字仓管理；saveJSON 内部先写 WAL、逐字验真后落 IDB 并销账。
    chatsRef.current = { ...p, [id]: n };
    // 未读红点：新增的角色消息若此刻没在看这个聊天，累加未读条数（推到微任务里，别在 reducer 里改别的 state）
    const sideRoom = window.ChatRooms && window.ChatRooms.isSideKey(id);
    const personId = sideRoom ? window.ChatRooms.personFromKey(id) : id;
    if (n.length > pl.length) {
      const ledgerAdded = n.slice(pl.length).filter(contextAllowsMessage);
      // 侧房默认不冒充主聊天写入跨端账本；是否进入记忆/共享状态由房间写回权限另行决定。
      if (!sideRoom) queueLedger("private", id, ledgerAdded, null, id);
      if (!sideRoom) ledgerAdded.forEach(m => observeSomatic(id, m, m && m.ledgerKey ? "cc_ledger" : "private", "symbolic"));
      // 旁白是场景事实，不是 Lisa 亲口说的话；兼容旧版曾误存成 role=user+kind=narration 的记录。
      if (!sideRoom) n.slice(pl.length).filter(m => m && m.role === "user" && m.kind !== "narration" && m.content).forEach(m => setTimeout(() => noteTidalUser(m.content, m.ts), 0));
      if (!sideRoom && ledgerAdded.some(m => m && (m.role === "user" || m.role === "assistant") && m.content)) setTimeout(() => { try { window.InnerLifeETidalShadow && window.InnerLifeETidalShadow.scheduleAfterglow(personId, n.filter(contextAllowsMessage), moods[personId], Date.now()); } catch (e) {} }, 0);
      const added = n.slice(pl.length).filter(m => m && m.role === "assistant" && m.kind !== "system" && m.kind !== "silence").length;
      const viewing = viewRef.current.screen === "thread" && viewRef.current.charId === personId;
      if (!sideRoom && added > 0 && !viewing) setTimeout(() => bumpUnread(personId, added), 0);
    }
    return {
      ...p,
      [id]: n
    };
  });
  const summarizeChatRoom = async (character, room, frame) => {
    if (!window.ChatRooms || !character || !room || room.main) return null;
    const key = window.ChatRooms.chatKey(character.id, room.id);
    const all = chatsRef.current[key] || loadJSON("x_chat:" + key, []);
    const fresh = all.filter(m => m && Number(m.ts || 0) > Number(room.summaryCursorTs || 0)
      && (m.role === "user" || m.role === "assistant") && m.content && !m.recalled);
    if (!fresh.length) { toast("上次摘要以后还没有新对话"); return null; }
    const toTs = Math.max.apply(null, fresh.map(m => Number(m.ts || 0)));
    const transcript = fresh.map(m => (m.role === "user" ? (profile.name || "Lisa") : character.name) + "：" + String(m.content)).join("\n");
    try {
      const raw = await callAI(apiFor(character.id),
        "你是房间交接整理器。只根据原话，忠实整理这段对话中真正发生的事、双方表达的感受、做出的决定、仍未结束的事和值得主聊天接住的变化。不得杜撰，不把设想写成事实，不代替任何人说新台词。输出一段自然中文正文，不要标题、列表、JSON 或代码块。",
        [{ role: "user", content: "房间名：" + room.name + "\n需要整理的新增原话：\n" + transcript }],
        { maxTokens: 2400, timeout: 120000 });
      const summary = String(raw || "").replace(/^```[^\n]*\n?|```$/g, "").trim();
      if (!summary) throw new Error("模型没有返回摘要");
      window.ChatRooms.addSummary({ personId: character.id, roomId: room.id, roomName: room.name, frame: String(frame || ""), summary, fromTs: Number(room.summaryCursorTs || 0), toTs });
      const saved = window.ChatRooms.save(character.id, { ...room, summaryFrame: String(frame || ""), summaryCursorTs: toTs });
      pChat(character.id, p => [...p, { id: "room_sum_" + Date.now(), role: "system", kind: "system", ts: Date.now(), content: "从「" + room.name + "」带回主聊天\n" + String(frame || "") + summary }]);
      toast("已把这段经历带回主聊天");
      return saved;
    } catch (e) {
      toast("摘要失败：" + (e && e.message ? e.message : "请重试"));
      return null;
    }
  };
  // ---- 聊天云归档：本地只留最近 N 条，更早的存云端（一条不丢 + 省本地空间）----
  const CHAT_KEEP_LOCAL = 200; // 每个角色本地保留的最近条数
  // 把某角色本地超出保留窗口的旧消息归档到云端、再从本地裁掉。⭐先确认云端写成功，才裁本地——任何失败都不裁、零丢失。
  const offloadChatOne = async (charId, keepLocal = CHAT_KEEP_LOCAL) => {
    if (!(window.Cloud && window.Cloud.ready())) return { ok: false, msg: "云同步未就绪" };
    const all = chatsRef.current[charId] || [];
    if (all.length <= keepLocal + 10) return { ok: true, moved: 0 }; // 不够多，不用归档
    const older = all.slice(0, all.length - keepLocal);
    const keep = all.slice(all.length - keepLocal);
    // ⭐合照(duo自拍)永不裁本地（她 2026-07-13 报「上传云端后合照墙没了」）：合照墙是从本地聊天现捞的，裁掉旧合照消息相册就丢；
    //   图在IDB、消息小，留着不占空间。只归档+裁掉【非合照】的旧消息，合照按原序留在本地。
    const isDuoPhoto = m => m && m.kind === "selfie" && m.photoKind === "duo";
    const drop = older.filter(m => !isDuoPhoto(m));
    if (!drop.length) return { ok: true, moved: 0 }; // older 里全是合照，没啥可裁
    try {
      await window.Cloud.chatArchiveAppend(charId, drop); // 只归档非合照的；先上云，抛错就不往下走
      pChat(charId, () => [...older.filter(isDuoPhoto), ...keep]); // 云端确认后裁本地：合照(原序)+最近的
      const marks = loadJSON("x_chatArch", {}); marks[charId] = (marks[charId] || 0) + drop.length; saveJSON("x_chatArch", marks); setChatArch(marks);
      // ⭐长期记忆浓缩进度跟着回调（v48.14 修）：lastSummarizedCount 按本地列表位置数；只按【真正裁掉的 drop】折算(!recalled)。
      const cut = drop.filter(m => !m.recalled).length;
      if (cut > 0) setChatSettings(p => { const s = p[charId] || {}; const n = { ...p, [charId]: { ...s, lastSummarizedCount: Math.max(0, (s.lastSummarizedCount || 0) - cut) } }; saveJSON("x_chatSettings", n); return n; });
      return { ok: true, moved: drop.length };
    } catch (e) { return { ok: false, msg: e.message || String(e) }; }
  };
  // 群聊归档（同一张 chat_archive 表，char_id 用 "g_"+群id 区分单聊/群聊）
  const offloadGChatOne = async (groupId, keepLocal = CHAT_KEEP_LOCAL) => {
    if (!(window.Cloud && window.Cloud.ready())) return { ok: false, msg: "云同步未就绪" };
    const all = groupChatsRef.current[groupId] || [];
    if (all.length <= keepLocal + 10) return { ok: true, moved: 0 };
    const older = all.slice(0, all.length - keepLocal);
    const keep = all.slice(all.length - keepLocal);
    const archKey = "g_" + groupId;
    try {
      await window.Cloud.chatArchiveAppend(archKey, older); // 先上云
      pGChat(groupId, () => keep);                           // 成功才裁本地
      const marks = loadJSON("x_chatArch", {}); marks[archKey] = (marks[archKey] || 0) + older.length; saveJSON("x_chatArch", marks); setChatArch(marks);
      // ⭐群记忆浓缩进度同样回调（v48.14 修）：按群 maybeSummarize 同口径（user/assistant/narration）折算裁掉的条数
      const cut = older.filter(m => m.role === "user" || m.role === "assistant" || m.role === "narration").length;
      if (cut > 0) saveGroupSettings(groupId, { lastSummarizedCount: Math.max(0, ((groupSettings[groupId] || {}).lastSummarizedCount || 0) - cut) });
      return { ok: true, moved: older.length };
    } catch (e) { return { ok: false, msg: e.message || String(e) }; }
  };
  // 一键归档所有角色 + 群聊的旧聊天
  // 一键清理「可再生」旧数据（她 2026-07-25 本地满 98%）：只清旧日程(点开自动重生)+旧论坛帖，绝不碰聊天/线下/记忆库/同人文
  const pruneRegenerables = () => {
    try {
      const dk = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
      const cutoff = dk(new Date(Date.now() - 14 * 86400000)); // 只留最近14天日程（"YYYY-MM-DD" 字符串可直接比大小）
      const sch = loadJSON("x_schedules", {});
      Object.keys(sch).forEach(cid => { const days = sch[cid] || {}; Object.keys(days).forEach(day => { if (day < cutoff) delete days[day]; }); });
      saveJSON("x_schedules", sch); setSchedules(sch);
      let fp = loadJSON("x_forumPosts", []);
      if (Array.isArray(fp) && fp.length > 60) {
        fp = fp.slice().sort((a, b) => (b.ts || 0) - (a.ts || 0)).slice(0, 60);
        const ids = new Set(fp.map(p => p && p.id));
        saveJSON("x_forumPosts", fp); setForumPosts(fp); forumPostsRef.current = fp;
        const fc = loadJSON("x_forumComments", {});
        Object.keys(fc).forEach(pid => { if (!ids.has(pid)) delete fc[pid]; });
        saveJSON("x_forumComments", fc); setForumComments(fc);
      }
      toast("已清理可再生旧数据（旧日程+旧论坛）");
    } catch (e) { toast("清理失败：" + (e.message || "")); }
  };
  const offloadAllChats = async (options = {}) => {
    const silent = !!options.silent;
    if (!(window.Cloud && window.Cloud.ready())) { if (!silent) toast("需要先登录云同步（设置·数据）"); return { moved: 0, fails: 1, ready: false }; }
    const keepLocal = window.StoragePolicy ? window.StoragePolicy.chatKeep(typeof localStorageBytes === "function" ? localStorageBytes() : 0) : CHAT_KEEP_LOCAL;
    let moved = 0, fails = 0;
    for (const id of Object.keys(chatsRef.current || {})) { const r = await offloadChatOne(id, keepLocal); if (r.ok) moved += r.moved || 0; else fails++; }
    for (const gid of Object.keys(groupChatsRef.current || {})) { const r = await offloadGChatOne(gid, keepLocal); if (r.ok) moved += r.moved || 0; else fails++; }
    if (!silent) toast(moved ? ("已把 " + moved + " 条旧聊天（含群聊）归档到云端，本机每个会话留最近 " + keepLocal + " 条" + (fails ? "（" + fails + " 个没成功，多半没网）" : "")) : (fails ? "归档失败：" + fails + " 个（检查网络/建表）" : "没有需要归档的旧聊天（当前保留线是每个会话 " + keepLocal + " 条）"));
    return { moved, fails, ready: true, keepLocal };
  };
  // localStorage 到 80% 后自动做同一套「先云端确认、再裁本地」归档；每天最多成功跑一次。
  // 断网/未登录/任一会话失败都不盖完成戳，下次前台仍会重试；不碰线下、记忆、日记或论坛。
  useEffect(() => {
    if (!loaded) return;
    let stopped = false;
    const check = async () => {
      if (stopped || chatAutoArchiveBusyRef.current) return;
      const used = typeof localStorageBytes === "function" ? localStorageBytes() : 0;
      if (used < 0.8 * 5 * 1024 * 1024) return;
      const day = new Date().toISOString().slice(0, 10);
      try { if (localStorage.getItem("x_chatAutoArchiveDay") === day) return; } catch (e) {}
      if (!(window.Cloud && window.Cloud.ready())) return;
      chatAutoArchiveBusyRef.current = true;
      try {
        const result = await offloadAllChats({ silent: true });
        if (!stopped && result && result.ready && result.fails === 0) {
          try { localStorage.setItem("x_chatAutoArchiveDay", day); } catch (e) {}
          if (result.moved > 0) toast("本地快满了：已安全归档 " + result.moved + " 条旧聊天到云端");
        }
      } finally { chatAutoArchiveBusyRef.current = false; }
    };
    const first = setTimeout(check, 15000);
    const timer = setInterval(check, 5 * 60000);
    return () => { stopped = true; clearTimeout(first); clearInterval(timer); };
  }, [loaded]);
  // 拉某角色的云端归档（完整旧消息，供聊天页「加载更早」查看，不写回本地）
  const loadChatArchive = async charId => {
    if (!(window.Cloud && window.Cloud.ready())) return null;
    try { return await window.Cloud.chatArchiveGet(charId); } catch (e) { toast("拉取云端归档失败：" + (e.message || e)); return null; }
  };
  // ---- 桌面对话回流（Stack-chan 实体，见 [[lisa-phone-next-window]]）----
  // stackchan-relay 把桌面每轮对话写进云端 desk_log；这里拉回来投进对应角色的手机聊天（带🖥️桌面标记+原时刻），
  // 让「桌面的身体」和「手机里的身体」共用一条聊天/记忆流。desk_log 表还没建时=deskFetch 报错→catch 静默，整块 dormant、零影响。
  const deskInflightRef = useRef(false);
  const deskSeenRef = useRef(new Set());
  const deliverDeskLog = async () => {
    if (deskInflightRef.current) return;
    if (!(window.Cloud && window.Cloud.ready() && typeof window.Cloud.deskFetch === "function")) return;
    deskInflightRef.current = true;
    try {
      const rows = await window.Cloud.deskFetch();
      if (!rows.length) return;
      const done = [];
      for (const R of rows) {
        if (deskSeenRef.current.has(R.id)) { done.push(R.id); continue; }
        deskSeenRef.current.add(R.id);
        const char = characters.find(c => c.id === R.char_id);
        if (!char) { done.push(R.id); continue; }              // 角色已删 → 作废
        const ts = new Date(R.created_at).getTime() || Date.now();
        const recent = (chatsRef.current[char.id] || []).slice(-16);
        const u = (R.user_text || "").trim(), a = (R.reply_text || "").trim();
        // 防重：同一轮的话已在近段里就跳过（先送后盖戳，网络抖动重投也不叠）
        const dup = (u && recent.some(m => m.role === "user" && m.content === u)) || (a && recent.some(m => m.role === "assistant" && m.content === a));
        if (!dup) {
          const add = [];
          if (u) add.push({ role: "user", content: u, ts, read: true, deskTop: true });
          if (a) add.push({ role: "assistant", content: a, ts: ts + 1, read: false, deskTop: true });
          if (add.length) pChat(char.id, p => [...p, ...add]);
        }
        done.push(R.id);
      }
      await window.Cloud.deskConsume(done);
    } catch (e) {/* 表未建/离线/未登录：静默，dormant */}
    finally { deskInflightRef.current = false; }
  };
  useEffect(() => { window.__pokeDesk = deliverDeskLog; return () => { delete window.__pokeDesk; }; });
  const pGChat = (id, u) => setGroupChats(p => {
    const pl = p[id] || [];
    const n = typeof u === "function" ? u(pl) : u;
    saveJSON("x_gchat:" + id, n);
    // x_gchat 同样由 IDB 文字仓 + WAL 原子保护，避免 localStorage 满盘时每次开机重复找回。
    groupChatsRef.current = { ...p, [id]: n };
    if (n.length > pl.length) {
      const ledgerAdded = n.slice(pl.length).filter(contextAllowsMessage), group = groups.find(g => String(g.id) === String(id));
      if (group) queueLedger("group", id, ledgerAdded, group);
      if (group) ledgerAdded.forEach(m => observeSomaticGroup(group, m, "group", "symbolic"));
      n.slice(pl.length).filter(m => m && m.role === "user" && m.content).forEach(m => setTimeout(() => noteTidalUser(m.content, m.ts), 0));
      const added = n.slice(pl.length).filter(m => m && m.role !== "user" && m.kind !== "system").length;
      const viewing = viewRef.current.screen === "gthread" && viewRef.current.charId === id;
      if (added > 0 && !viewing) setTimeout(() => bumpUnread(id, added), 0);
    }
    return {
      ...p,
      [id]: n
    };
  });
  const setAff = (id, v) => setAffinities(p => {
    const n = {
      ...p,
      [id]: Math.max(0, Math.min(100, Math.round(Number(v) * 1000) / 1000)) // 内部存 3 位小数，显示时取整
    };
    saveJSON("x_affinities", n);
    return n;
  });
  // 好感度缓慢增减：每次交互按心情随机加 0.005~0.1（存 3 位小数、显示取整）
  const MOOD_POS = ["开心", "高兴", "愉快", "甜", "幸福", "满足", "兴奋", "期待", "喜欢", "心动", "温柔", "安心", "放松", "得意", "激动", "欣慰", "感动", "撒娇", "害羞", "雀跃", "窃喜", "欢喜", "暖"];
  const MOOD_NEG = ["难过", "生气", "愤怒", "委屈", "失望", "伤心", "焦虑", "烦", "累", "孤独", "害怕", "嫉妒", "冷漠", "不安", "低落", "郁闷", "无语", "厌", "疲惫", "沮丧", "受伤", "崩溃"];
  const moodFactor = label => {
    const s = String(label || "");
    if (MOOD_POS.some(w => s.includes(w))) return 1;
    if (MOOD_NEG.some(w => s.includes(w))) return -0.7;
    return 0.4;
  };
  const bumpAff = (charId, aiDelta, moodLabel) => {
    const mf = moodFactor(moodLabel);
    const mag = 0.005 + Math.random() * 0.095; // 0.005~0.1
    let inc;
    if (aiDelta > 0) inc = mag * (0.5 + 0.5 * Math.max(0, mf)); // 上升，心情越好升得越快
    else if (aiDelta < 0) inc = -mag * (0.6 + 0.4 * Math.max(0, -mf)); // 下降，心情越差降得越多
    else inc = mag * 0.25 * mf; // 中性：极缓慢随心情正负微调
    inc = Math.round(inc * 1000) / 1000;
    if (inc) setAff(charId, affOf(charId) + inc);
  };
  // 基础好感：没手动设过时，按你和 TA 的关系推一个基线，而不是一律 50
  const REL_AFF = { 恋人: 80, 挚爱: 82, 爱人: 80, 暧昧: 70, 挚友: 74, 好友: 66, 朋友: 60, 家人: 72, 亲人: 70, 青梅竹马: 68, 兄妹: 62, 兄弟: 62, 姐妹: 62, 同事: 52, 上下级: 50, 师生: 55, 对手: 34, 宿敌: 28, 前任: 44, 陌生人: 42, 暗恋: 58 };
  const baseAff = charId => {
    const labels = [rels["me->" + charId], rels[charId + "->me"]].filter(Boolean).map(r => r.label || "");
    let best = null;
    labels.forEach(l => Object.keys(REL_AFF).forEach(k => { if (l.includes(k) && (best == null || REL_AFF[k] > best)) best = REL_AFF[k]; }));
    return best != null ? best : 50;
  };
  const affOf = charId => affinities[charId] != null ? affinities[charId] : baseAff(charId);
  const setMoodFor = (id, m) => setMoods(p => {
    const cleanMood = window.MoodLabel ? window.MoodLabel.normalizeMood(m) : m;
    const n = {
      ...p,
      [id]: cleanMood
    };
    saveJSON("x_moods", n);
    return n;
  });
  // 连着多少轮没按协议返回 mood。心情不动有两种可能：模型每轮都报了同一个词（正常），
  // 和模型压根不填这个字段（坏）。不数一下就分不出来，只会看见「心情好久没变」。
  const _moodSkip = (id, got) => {
    const live = statesRef.current[id] || {};
    const n = got ? 0 : Math.min((Number(live.moodSkips) || 0) + 1, 99);
    if (n === (Number(live.moodSkips) || 0)) return;
    const ns = { ...live, moodSkips: n };
    statesRef.current = { ...statesRef.current, [id]: ns };
    setStates(p => { const m = { ...p, [id]: { ...(p[id] || {}), moodSkips: n } }; saveJSON("x_states", m); return m; });
    if (n === 12) toast("这个角色连着 12 轮没按协议返回心情——多半是当前模型不稳定支持 mood 字段，换个模型试试", 9000);
  };
  const setStateFor = (id, s) => setStates(p => {
    const n = {
      ...p,
      [id]: s
    };
    statesRef.current = n;
    saveJSON("x_states", n);
    return n;
  });
  // Protocol v2 的 wearing/action 是「变化时才报」，但不能因此成为永久真相。
  // 两个字段各自记最后一次真实更新时间；总 state.ts 会被 mood/thought 刷新，不能拿来判陈旧。
  // thought 90 分钟:线上写入是「有新的才覆盖」,没时效的话守卫拒一次、或模型连着填 null,
  // 状态卡就会挂着几小时前的念头不动(Lisa 2026-08-18)。线下每轮自清,不受此影响。
  // condition 12 小时:伤/病/醉/累比换衣服和换地方都留得久,但也不该跨天硬续
const LIVE_STATE_TTL = { wearing: 18 * 3600000, action: 45 * 60000, thought: 90 * 60000, place: 3 * 3600000, condition: 12 * 3600000 };
  // 连续多少轮没有新心声就判定旧的已经过期——时间没到但话题早换了的情况靠它兜
  const THOUGHT_SKIP_LIMIT = 4;
  // 只有值【真的变了】才刷新时间戳。模型每轮都会把上一轮的穿着/动作原样再报一遍，
  // 旧写法是「有值就 UpdatedAt = now」，于是时效永远到不了期——运动衣穿了好几天、
  // 大半夜还在「准备晨跑」，死因都是这个续命，而不是 TTL 定得太长（她 2026-08-18）。
  const sameStateValue = (a, b) => String(a || "").replace(/\s+/g, "") === String(b || "").replace(/\s+/g, "");
  const putLiveField = (patch, live, key, value, now) => {
    const v = String(value == null ? "" : value).trim();
    if (!v) return;
    patch[key] = v;
    if (!sameStateValue(v, live && live[key])) patch[key + "UpdatedAt"] = now;
    else if (!(Number((live && live[key + "UpdatedAt"]) || 0) > 0)) patch[key + "UpdatedAt"] = now;
  };
  const freshLiveStateValue = (state, field, now = Date.now()) => {
    const value = String(state && state[field] || "").trim();
    if (!value) return "";
    const updatedAt = Number(state && state[field + "UpdatedAt"]);
    // v52.94 之前没有字段级时间：宁可下一轮重建一次，也不把几天前的衣服/活动当作现在。
    if (!Number.isFinite(updatedAt) || updatedAt <= 0) return "";
    const age = now - updatedAt;
    return age >= 0 && age <= LIVE_STATE_TTL[field] ? value : "";
  };
  // 心声历史：每次有新想法就存一条，供「看历史记录」
  const pushStateHist = (id, s) => {
    if (!s || !s.thought) return;
    setStateHist(p => {
      const prev = p[id] || [];
      const last = prev[0];
      if (last && last.thought === s.thought) return p; // 同一条不重复
      const n = { ...p, [id]: [{ thought: s.thought, mood: s.mood, wearing: s.wearing, action: s.action, wearingUpdatedAt: s.wearingUpdatedAt, actionUpdatedAt: s.actionUpdatedAt, ts: s.ts || Date.now() }, ...prev].slice(0, 40) };
      n[id][0].turnId = s.turnId || null;
      n[id][0].affinityBefore = s.affinityBefore;
      stateHistRef.current = n;
      saveJSON("x_stateHist", n);
      return n;
    });
  };
  const rollbackCharTurns = (charId, turns, legacyLatest) => {
    if (!window.RerollBranch) return;
    let current = statesRef.current[charId] || null, history = stateHistRef.current[charId] || [], affinityRestore;
    const ordered = [...new Set((turns || []).filter(Boolean).map(String))];
    for (let i = ordered.length - 1; i >= 0; i--) {
      if (current && String(current.turnId || "") === ordered[i] && typeof current.affinityBefore === "number") affinityRestore = current.affinityBefore;
      const rolled = window.RerollBranch.rollbackState(current, history, ordered[i], { legacyLatest: false });
      current = rolled.state; history = rolled.history;
    }
    if (!ordered.length && legacyLatest) {
      const rolled = window.RerollBranch.rollbackState(current, history, "", { legacyLatest: true });
      current = rolled.state; history = rolled.history;
    }
    const histMap = { ...stateHistRef.current, [charId]: history }; stateHistRef.current = histMap; setStateHist(histMap); saveJSON("x_stateHist", histMap);
    const stateMap = { ...statesRef.current }; if (current) stateMap[charId] = current; else delete stateMap[charId]; statesRef.current = stateMap; setStates(stateMap); saveJSON("x_states", stateMap);
    setMoods(p => { const n = { ...p }; if (current && current.mood) n[charId] = { label: current.mood, ts: Date.now() }; else delete n[charId]; saveJSON("x_moods", n); return n; });
    if (typeof affinityRestore === "number") setAff(charId, affinityRestore);
  };
  // 单聊之外的共同相处也是真的“刚理过 TA”：主动消息、jiwen 思念和断档提示共用这一只钟。
  // 同一个人同时在好几个频道里说话，彼此不知道对方说了什么，于是当场自相矛盾
  //（她 2026-08-27：顾暮在两个群里几乎同时给了两套说法，一边说六点半到家、一边另说一套）。
  // 只取【TA 自己刚说过的原话】——不是别人的话，所以不构成隐私泄露，别的成员也拿不到这一段。
  // ⚠️封闭群只进不出：闭群里说过的话绝不外流到别处（.claude/rules/four-surfaces-same-context.md）。
  const CROSS_SAID_WINDOW_MS = 90 * 60000;
  const crossChannelSaid = (charId, exceptGroupId) => {
    try {
      const now = Date.now(), lines = [];
      (groups || []).forEach(g => {
        if (!g || g.id === exceptGroupId) return;
        if (!(g.memberIds || []).includes(charId)) return;
        if (!gsFor(g.id).memoryInterop) return;               // 闭群不外流
        (groupChatsRef.current[g.id] || []).forEach(m => {
          if (!m || m.role !== "assistant" || m.senderId !== charId) return;
          if (m.recalled || m.kind === "ooc" || m.kind === "system") return;
          if (!contextAllowsMessage(m)) return;
          const ts = Number(m.ts) || 0;
          if (!ts || now - ts > CROSS_SAID_WINDOW_MS) return;
          const txt = String(m.content || "").replace(/\s+/g, " ").trim();
          if (txt) lines.push({ ts, s: "〔" + (g.name || "群聊") + "〕" + txt.slice(0, 60) });
        });
      });
      lines.sort((a, b) => a.ts - b.ts);
      return lines.slice(-5).map(x => x.s).join("\n");
    } catch (e) { return ""; }
  };
  const latestSharedInteractionTs = charId => {
    if (!window.InteractionClock) return 0;
    const go = {};
    (groups || []).filter(g => (g.memberIds || []).includes(charId)).forEach(g => {
      go[g.id] = groupOfflinesRef.current[g.id] || loadJSON("x_goffline:" + g.id, []);
    });
    const direct = offlinesRef.current[charId] || loadJSON("x_offline:" + charId, []);
    return window.InteractionClock.latestSharedTs(charId, {
      groups, groupChats: groupChatsRef.current, groupOfflines: go, offlines: { [charId]: direct }
    });
  };
  const latestUserSharedInteractionTs = charId => {
    if (!window.InteractionClock || typeof window.InteractionClock.latestUserSharedTs !== "function") return latestSharedInteractionTs(charId);
    const go = {};
    (groups || []).filter(g => (g.memberIds || []).includes(charId)).forEach(g => {
      go[g.id] = groupOfflinesRef.current[g.id] || loadJSON("x_goffline:" + g.id, []);
    });
    const direct = offlinesRef.current[charId] || loadJSON("x_offline:" + charId, []);
    return window.InteractionClock.latestUserSharedTs(charId, {
      groups, groupChats: groupChatsRef.current, groupOfflines: go, offlines: { [charId]: direct }
    });
  };
  const currentlyTogetherWithChar = charId => {
    if (!window.InteractionClock) return false;
    const go = {};
    (groups || []).filter(g => (g.memberIds || []).includes(charId)).forEach(g => {
      go[g.id] = groupOfflinesRef.current[g.id] || loadJSON("x_goffline:" + g.id, []);
    });
    return window.InteractionClock.isTogetherNow(charId, {
      groups, groupOfflines: go, activeGroupId: screen === "gthread" && activeGroup ? activeGroup.id : null
    }, Date.now());
  };
  // 欲望盒子写回：mut 拿到浅拷贝的新映射就地改。⚠️必须【立刻同步】以 ref 为底更新 ref+localStorage，再 setState——
  // 若把 ref 更新塞进 setState 的 updater（渲染时才跑、不同步），同一条 tick 链里连续两次保存（发呆→小满）
  // 第二次会读到旧 ref、整盒覆盖丢掉第一次的写入（v48.23 实测踩过）。
  const saveDesires = mut => {
    const n = { ...desiresRef.current };
    mut(n);
    desiresRef.current = n;
    saveJSON("x_desires", n);
    setDesires(n);
  };
  // 用户经 OOC 立下的长期行为准则
  const addDirective = (id, text) => {
    const t = (text || "").trim();
    if (!t) return;
    setDirectives(p => {
      const list = p[id] || [];
      if (list.some(d => d.text === t)) return p; // 完全相同不重复
      const n = { ...p, [id]: [...list, { id: "dir_" + Date.now(), text: t, ts: Date.now() }] };
      saveJSON("x_directives", n);
      return n;
    });
  };
  // 规矩不该只有"永久"一种（她 2026-08-19：不想为了把语域掰回日常，就得长期挂一条群规矩）。
  // turns > 0 = 临时规矩，每回一轮就少一轮，到 0 自己消失；turns 缺省 = 长期，行为同旧版。
  const DIRECTIVE_TEMP_TURNS = 10;
  const setDirectiveTurns = (id, dirId, turns) => setDirectives(p => {
    const n = { ...p, [id]: (p[id] || []).map(d => d.id !== dirId ? d
      : (turns == null ? (function () { const c = { ...d }; delete c.turns; return c; })() : { ...d, turns: Math.max(1, Number(turns) || 0) })) };
    saveJSON("x_directives", n);
    return n;
  });
  // 一轮用掉一次：只减临时规矩，减到 0 的当场移除
  const tickDirectives = id => setDirectives(p => {
    const list = p[id] || [];
    if (!list.some(d => d && Number(d.turns) > 0)) return p;
    const next = list.map(d => (d && Number(d.turns) > 0) ? { ...d, turns: Number(d.turns) - 1 } : d)
      .filter(d => !(d && d.turns != null && Number(d.turns) <= 0));
    const n = { ...p, [id]: next };
    saveJSON("x_directives", n);
    return n;
  });
  const removeDirective = (id, dirId) => setDirectives(p => {
    const n = { ...p, [id]: (p[id] || []).filter(d => d.id !== dirId) };
    saveJSON("x_directives", n);
    return n;
  });
  const setMemFor = (id, m) => setMemories(p => {
    const n = {
      ...p,
      [id]: m
    };
    saveJSON("x_memories", n);
    return n;
  });
  // ---- 记忆库（memory library）----
  const memVecTimer = useRef(null);
  const memRowSyncTimerRef = useRef(null);
  const memRowSyncInflightRef = useRef(false);
  const scheduleMemoryRowSync = (delay = 900) => {
    clearTimeout(memRowSyncTimerRef.current);
    memRowSyncTimerRef.current = setTimeout(runMemoryRowSync, delay);
  };
  const runMemoryRowSync = async () => {
    if (memRowSyncInflightRef.current) return;
    if (!(window.MemorySync && window.Cloud && typeof window.Cloud.memoryRowsFetchUpdatedSince === "function" && typeof window.Cloud.memoryApplyMutation === "function")) return;
    memRowSyncInflightRef.current = true;
    try {
      const user = await window.Cloud.getUser();
      if (!user) return;
      await window.MemorySync.ensureOwner(user.id);
      // 用上次本地快照补捞「写了 localStorage、但页面立刻被关掉」的极小窗口；首次只立基线，不把390条重排队。
      await window.MemorySync.bootstrapLocalSnapshot(memLibRef.current || []);

      const cursor = await window.MemorySync.getCursor();
      const pulled = await window.Cloud.memoryRowsFetchUpdatedSince(cursor);
      await window.MemorySync.storePulledRows(pulled); // 只进 IDB 影子镜像，不改 x_memLib

      const outbox = await window.MemorySync.listOutbox();
      for (const op of outbox) {
        await window.MemorySync.markAttempt(op);
        const result = await window.Cloud.memoryApplyMutation(op);
        if (result && (result.status === "applied" || result.status === "conflict")) {
          // conflict 已由 RPC 把双方版本写进 memory_conflicts；本地旧库保持原样，绝不静默拿云端盖它。
          await window.MemorySync.acknowledge(op.memoryId, op.mutationId, result.row || null, result.status === "applied");
        } else throw new Error("记忆行同步返回未知状态");
      }

      const cursor2 = await window.MemorySync.getCursor();
      const pulled2 = await window.Cloud.memoryRowsFetchUpdatedSince(cursor2);
      await window.MemorySync.storePulledRows(pulled2);

      // 权威切换后：服务端行合成完整本机镜像；hits/lastHit 是设备私有统计，只从本机同 ID 继承。
      if (memoryTableAuthorityOn()) {
        const tableRows = await window.Cloud.memoryRowsFetchAll();
        await window.MemorySync.storePulledRows(tableRows);
        const localById = new Map((memLibRef.current || []).filter(x => x && x.id).map(x => [String(x.id), x]));
        const authoritative = tableRows.filter(r => r && !r.deleted).map(r => {
          const row = memoryRowFromCloud(r), local = localById.get(row.id);
          if (local && typeof local.hits === "number") row.hits = local.hits;
          if (local && typeof local.lastHit === "number") row.lastHit = local.lastHit;
          return row;
        });
        memLibRef.current = authoritative;
        setMemLib(authoritative);
        saveJSON("x_memLib", authoritative); // 现在只是离线镜像；Cloud.collect 已明确排除它
        await window.MemorySync.replaceLocalSnapshot(authoritative);
        // P1-3：本地包含关系只提候选；等新旧两行都已同步并取得当前 revision 后，才调用原子候选 RPC。
        try {
          const C = window.MemoryCorrectionShadow;
          if (C && C.pendingPairs && window.Cloud.memoryCorrectionCreate) {
            const byId = new Map(tableRows.filter(r => r && r.id).map(r => [String(r.id), r]));
            // CC/另一设备直写的新条不会经过本机 pruneSubsumed：对本轮云端变化补同一套确定性包含检测。
            for (const ne of [...pulled, ...pulled2]) {
              if (!ne || !ne.id || ne.deleted || ne.archived || (ne.surface_state || "active") !== "active") continue;
              const nn = normMemText(ne.text); if (nn.length < 6) continue;
              for (const old of tableRows) {
                if (!old || old.id === ne.id || old.deleted || old.archived || (old.surface_state || "active") !== "active" || old.pinned || old.open) continue;
                if (!memShareChar(ne.char_ids, old.char_ids)) continue;
                const on = normMemText(old.text);
                if (on.length >= 6 && nn.length > on.length && nn.indexOf(on) >= 0 && on.length / nn.length > 0.72) {
                  await C.observePair({ oldId: old.id, newId: ne.id, oldPinned: false, oldOpen: false, oldTooShort: false, currentWouldPrune: true, source: ne.source || "cloud" });
                }
              }
            }
            for (const p of (await C.pendingPairs()).slice(0, 20)) {
              const oldRow = byId.get(String(p.oldId)), newRow = byId.get(String(p.newId));
              if (!oldRow || !newRow || oldRow.deleted || newRow.deleted) continue;
              if ((oldRow.surface_state || "active") !== "active" || (newRow.surface_state || "active") !== "active" || newRow.supersedes_id) continue;
              const made = await window.Cloud.memoryCorrectionCreate(oldRow.id, newRow.id, oldRow.revision, newRow.revision, "more_detailed");
              await C.markProposed(p.pair, made && made.candidate && made.candidate.id);
            }
          }
        } catch (eCorrection) {/* SQL 尚未部署/离线：保留 pending，下轮重试；不影响记忆同步 */}
      }
    } catch (e) {
      // 断网/临时错误：outbox 已落 IndexedDB，下次启动、回前台或联网会继续；不影响当前旧库。
    } finally { memRowSyncInflightRef.current = false; }
  };
  useEffect(() => { window.__runMemoryRowSync = runMemoryRowSync; return () => { delete window.__runMemoryRowSync; }; });
  const saveMemLib = next => {
    // ref 必须在这里同步更新：同一轮里连续多次保存（逐条 addMemEntry / 先了结旧约定再入新条）之间不会重渲染，
    // 若只等渲染期赋值，后一次保存会拿旧数组把前一次覆盖掉（lost write，v47.55 细节逐条入库曾因此只存活最后一条）
    const prev = memLibRef.current || [];
    memLibRef.current = next;
    setMemLib(next);
    saveJSON("x_memLib", next);
    if (window.MemorySync) window.MemorySync.enqueueDiff(prev, next).then(() => scheduleMemoryRowSync()).catch(() => {});
    // 向量增量维护（v48.11）：新增/编辑/删除后台补嵌+清孤儿。防抖 4s——批量逐条入库只嵌一次；没配 embedding API 时内部直接返回
    clearTimeout(memVecTimer.current);
    memVecTimer.current = setTimeout(() => { if (typeof ensureMemVecs === "function") ensureMemVecs(memLibRef.current).catch(() => {}); }, 4000);
  };
  useEffect(() => {
    if (!loaded) return;
    const kick = () => { if (document.visibilityState !== "hidden") scheduleMemoryRowSync(300); };
    kick();
    const interval = setInterval(kick, 60000);
    window.addEventListener("online", kick);
    window.addEventListener("focus", kick);
    document.addEventListener("visibilitychange", kick);
    window.__memorySyncStatus = () => window.MemorySync ? window.MemorySync.status() : Promise.resolve({ unavailable: true });
    return () => {
      clearInterval(interval); clearTimeout(memRowSyncTimerRef.current);
      window.removeEventListener("online", kick); window.removeEventListener("focus", kick);
      document.removeEventListener("visibilitychange", kick); delete window.__memorySyncStatus;
    };
  }, [loaded]);
  // C 第4步：睡眠影子 tick（纯本地计算，5 分钟一轮 + 回前台刷新；shadow 不改任何真实行为）
  useEffect(() => {
    if (!loaded) return;
    const tickAll = async (forcePresence) => { try { if (window.SleepShadow) {
      if (window.SleepShadow.ready) await window.SleepShadow.ready();
      liveChars.forEach(c => {
      const r = window.SleepShadow.tick(c, settingsFor(c.id).engineerEyes === true, { forcePresence: !!forcePresence });
      // D 梦回路胶水：只读 C 的 tick 返回值，REM 窗到点由 DreamLoop 自判并入队（零 API 不展示）
      try { if (r && !r.exempt && r.state && window.DreamLoop) window.DreamLoop.observe(c, r.state); } catch (eD) {}
    }); } } catch (e) {} };
    tickAll(true);
    const iv = setInterval(() => tickAll(false), 300000);
    const onVis = () => { if (document.visibilityState !== "hidden") tickAll(true); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(iv); document.removeEventListener("visibilitychange", onVis); };
  }, [loaded, characters]);
  const showMemorySyncStatus = async () => {
    try {
      const s = await window.MemorySync.status();
      toast((memoryTableAuthorityOn() ? "新表权威" : "影子镜像") + " " + s.shadowRows + " 行 · 离线待发送 " + s.outbox + " 条 · " + (memoryTableAuthorityOn() ? "本机镜像负责离线" : "当前仍读旧记忆库"));
    } catch (e) { toast("影子同步尚未初始化，稍后再看"); }
  };
  const showChatLedgerShadowStatus = async () => {
    try {
      const y = ledgerYanqiu(), user = window.Cloud && await window.Cloud.getSessionUser();
      if (!y) throw new Error("还没找到唯一的言秋身份");
      if (!user) throw new Error("请先登录云端账号");
      let live = null; try { live = JSON.parse(localStorage.getItem(window.ChatLedgerShadow.LIVE_CURSOR_KEY) || "null"); } catch (e) {}
      toast("CC 回流：已并入 App " + Number(live && live.imported || 0) + " 条 · 修订 " + Number(live && live.updated || 0) + " · 软删 " + Number(live && live.deleted || 0) + (live && live.last_error ? " · 合并失败待重试" : " · 言秋专属已开阀"));
    } catch (e) { toast("CC 回流影子尚未就绪：" + String((e && e.message) || e)); }
  };
  const enableMemoryTableAuthority = async () => {
    if (memMigrationBusy) return;
    setMemMigrationBusy(true);
    try {
      if (!(window.MemoryAudit && window.MemorySync && window.Cloud)) throw new Error("记忆验收模块未就绪，请刷新后重试");
      await runMemoryRowSync();
      const sync = await window.MemorySync.status();
      if (sync.outbox !== 0) throw new Error("还有 " + sync.outbox + " 条离线变更没送完，已停止切换");
      const localRaw = storedJSONText("x_memLib");
      const tableRows = await window.Cloud.memoryRowsFetchAll();
      const live = tableRows.filter(r => r && !r.deleted).map(memoryRowFromCloud);
      const verify = await window.MemoryAudit.build(localRaw, JSON.stringify(live), {
        reportType: "early-table-authority-cutover",
        appVersion: APP_VERSION,
        observationDays: 1,
        tableTotalRows: tableRows.length,
        tableLiveRows: live.length,
        tableDeletedRows: tableRows.filter(r => r && r.deleted).length,
        outbox: sync.outbox
      });
      window.MemoryAudit.download(verify);
      const ls = verify.local && verify.local.stats;
      const pass = ls && ls.totalRows === live.length && ls.uniqueIds === live.length && !ls.duplicateIds.length && !ls.missingIds && !ls.emptyTexts && verify.diff && verify.diff.exactSharedMatch;
      if (!pass) throw new Error("新表与本机旧库没有逐 ID 全绿；报告已导出，仍保持旧读取");
      localStorage.setItem(MEMORY_TABLE_AUTHORITY_KEY, "1");
      setMemTableMode(true);
      toast("逐 ID 验收通过：" + live.length + "/" + live.length + " · 正在启用新表权威");
      setTimeout(() => location.reload(), 900);
    } catch (e) { toast("没有切换：" + String((e && e.message) || e)); }
    finally { setMemMigrationBusy(false); }
  };
  const useLegacyMemoryMirror = () => {
    localStorage.removeItem(MEMORY_TABLE_AUTHORITY_KEY);
    setMemTableMode(false);
    location.reload();
  };
  // 记忆迁移第2步：只读审计本机镜像与旧云 blob，下载原始备份+逐 ID SHA-256+差异报告。
  // 不调用 saveMemLib/saveJSON，不碰 memories 表；云端不可读时仍导出本机报告。
  const exportMemoryAudit = async () => {
    if (!window.MemoryAudit) { toast("审计器未载入，请刷新后重试"); return; }
    toast("正在只读核对本机与云端记忆…");
    const localRaw = storedJSONText("x_memLib");
    let cloudRaw = null, cloudUpdatedAt = null, cloudError = null;
    try {
      if (!(window.Cloud && window.Cloud.ready())) throw new Error("云服务未就绪");
      const row = await window.Cloud.pull();
      if (!row || !row.data) throw new Error("云端没有旧存档");
      cloudRaw = row.data.x_memLib == null ? null : String(row.data.x_memLib);
      cloudUpdatedAt = row.updated_at || null;
    } catch (e) { cloudError = String((e && e.message) || e || "云端读取失败"); }
    try {
      const report = await window.MemoryAudit.build(localRaw, cloudRaw, {
        appVersion: APP_VERSION,
        cloudUpdatedAt,
        cloudError,
        visibleStateRows: (memLibRef.current || []).length
      });
      window.MemoryAudit.download(report);
      const ls = report.local && report.local.stats, cs = report.cloud && report.cloud.stats, d = report.diff;
      const summary = "本机 " + (ls ? ls.totalRows : "读取失败") + " 条" +
        (cs ? " · 旧云 " + cs.totalRows + " 条" : " · 旧云未读到") +
        (d && d.comparable ? (" · 本机独有 " + d.missingInCloud.length + " · 云端独有 " + d.missingInLocal.length + " · 同ID内容不同 " + d.changedSharedRows.length) : "");
      toast("审计报告已导出：" + summary);
    } catch (e) { toast("审计失败（没有改动数据）：" + String((e && e.message) || e)); }
  };
  // 07-22 纪律复核：本机离线镜像 vs 当前权威 memories 行表逐 ID 指纹。
  // 只读：不先 flush、不 enqueue、不改 cursor；outbox 非 0 也照实写进报告并判红。
  const exportPostCutoverMemoryAudit = async () => {
    if (!(window.MemoryAudit && window.MemorySync && window.Cloud)) { toast("审计模块未就绪，请刷新后重试"); return; }
    toast("正在只读核对本机镜像与当前权威行表…");
    try {
      const sync = await window.MemorySync.status();
      const tableRows = await window.Cloud.memoryRowsFetchAll();
      const live = tableRows.filter(r => r && !r.deleted).map(memoryRowFromCloud);
      const report = await window.MemoryAudit.build(storedJSONText("x_memLib"), JSON.stringify(live), {
        reportType: "post-cutover-authority-audit",
        appVersion: APP_VERSION,
        authority: "memories-table",
        tableTotalRows: tableRows.length,
        tableLiveRows: live.length,
        tableDeletedRows: tableRows.filter(r => r && r.deleted).length,
        outbox: sync.outbox,
        cursor: sync.cursor || null
      });
      window.MemoryAudit.download(report);
      const d = report.diff, pass = sync.outbox === 0 && d && d.comparable && d.exactSharedMatch;
      toast((pass ? "纪律复核指纹全绿" : "纪律复核有红项") + "：本机 " + ((report.local.stats || {}).totalRows || 0) + " · 行表有效 " + live.length + " · 软删 " + (tableRows.length-live.length) + " · 待发送 " + sync.outbox);
    } catch (e) { toast("纪律复核读取失败（没有改动数据）：" + String((e && e.message) || e)); }
  };
  const MEM_MIGRATION_BASELINE = {
    count: 390,
    sharedSha256: "1615714a430e323c4c88596fb21ac6d651fdb008d2af9bd592427b58ded3dd7b"
  };
  const migrateMemoriesShadow = async () => {
    if (memMigrationBusy) return;
    if (!(window.Cloud && typeof window.Cloud.memoryRowsUpsert === "function" && typeof window.Cloud.memoryRowsFetchAll === "function")) { toast("记忆表接口未就绪，请刷新后重试"); return; }
    setMemMigrationBusy(true);
    try {
      const localRaw = storedJSONText("x_memLib");
      const audit = await window.MemoryAudit.auditRaw(localRaw, "locked-primary-device-baseline");
      if (!audit.ok || audit.stats.totalRows !== MEM_MIGRATION_BASELINE.count || audit.stats.uniqueIds !== MEM_MIGRATION_BASELINE.count || audit.stats.duplicateIds.length || audit.stats.missingIds || audit.stats.emptyTexts || audit.canonicalSharedSha256 !== MEM_MIGRATION_BASELINE.sharedSha256) {
        throw new Error("主设备记忆已偏离锁定的390条基线；没有写表，请重新做只读审计");
      }
      const rows = JSON.parse(localRaw);
      for (let i = 0; i < rows.length; i += 50) await window.Cloud.memoryRowsUpsert(rows.slice(i, i + 50));

      const tableRows = await window.Cloud.memoryRowsFetchAll();
      const live = tableRows.filter(r => !r.deleted).map(r => ({
        id: r.id, text: r.text, tags: r.tags || [], charIds: r.char_ids || [],
        v: r.v, a: r.a, open: r.open, pinned: r.pinned, ts: r.ts,
        archived: r.archived, archivedBatch: r.archived_batch, archivedTs: r.archived_ts, source: r.source
      }));
      const verify = await window.MemoryAudit.build(localRaw, JSON.stringify(live), {
        reportType: "shadow-migration-verify",
        appVersion: APP_VERSION,
        lockedBaselineCount: MEM_MIGRATION_BASELINE.count,
        tableTotalRows: tableRows.length,
        tableDeletedRows: tableRows.filter(r => r.deleted).length
      });
      const pass = tableRows.length === MEM_MIGRATION_BASELINE.count && !tableRows.some(r => r.deleted) && verify.diff.comparable && verify.diff.exactSharedMatch;
      window.MemoryAudit.download(verify);
      if (!pass) throw new Error("表已保持影子状态，但逐ID验证未全绿；已导出报告，读取权威没有切换");
      toast("影子迁移验证通过：390/390 条逐ID一致 · 新表已开始行级影子写 · 读取仍走旧记忆库");
    } catch (e) { toast("影子迁移停止：" + String((e && e.message) || e)); }
    finally { setMemMigrationBusy(false); }
  };
  // 向量记忆开机：把 IDB 里的向量读进内存缓存 → 后台给缺向量的条目补嵌（换设备导入存档后会在这里自动重建索引）
  // v48.29 世界书向量同款开机流程（词条向量也在 IDB 不进云，导入存档后自动重建）
  useEffect(() => {
    const t = setTimeout(() => {
      if (typeof hydrateMemVecs !== "function") return;
      hydrateMemVecs()
        .then(() => ensureMemVecs(memLibRef.current))
        // 存量本地向量合流上云，给 CC/别的设备共用（幂等；只在有未上云的条目时才写）
        .then(() => { if (typeof syncMemVecsToCloud === "function") return syncMemVecsToCloud(memLibRef.current); })
        .catch(() => {});
      if (typeof hydrateLoreVecs === "function") hydrateLoreVecs().then(() => ensureLoreVecs(loreRef.current)).catch(() => {});
    }, 3500);
    return () => clearTimeout(t);
  }, []);
  // 记忆去重：归一化文本（去空白标点）后，和同角色（或全局）已有条目比对——完全相同、或一方几乎是另一方子串就算重复
  // 记忆条目唯一 id：同毫秒多批抽取也不撞（撞了会导致删/改错条目）
  const uniqMemId = (now, i) => "m_" + now + "_" + i + "_" + Math.floor(Math.random() * 1e4);
  const normMemText = s => String(s || "").replace(/[\s，。、；：,.;:!！?？「」『』"'“”‘’（）()【】\-—]/g, "").toLowerCase();
  const memShareChar = (aIds, bIds) => { const a = aIds || [], b = bIds || []; if (!a.length || !b.length) return true; return a.some(x => b.includes(x)); };
  // 是否重复（跳过新的）：v48.41 改成【不对称】——只有「新文本没添新信息」才算重复，即新的 ⊆ 已有（被已有包含）或完全相同。
  // 若新的更长、反而包含了旧的（是更详细版），不算重复：放它进来，交给 pruneSubsumed 淘汰旧的含糊版，别再丢细节。
  const isDupMem = (text, charIds, pool, meta = {}) => {
    const n = normMemText(text); if (n.length < 4) return false;
    const rows = pool || memLibRef.current;
    const exact = rows.some(e => {
      if ((e.surfaceState || "active") !== "active") return false;
      if (!memShareChar(charIds, e.charIds)) return false;
      const en = normMemText(e.text); if (!en) return false;
      if (en === n) return true;
      // 已有 en 更长且完全包含新的 n（n ⊆ en）→ 新的没添信息 → 重复
      return n.length >= 6 && en.length > n.length && en.indexOf(n) >= 0 && n.length / en.length > 0.72;
    });
    if (exact) return true;
    if (!window.MemoryNearDuplicate) return false;
    return !!window.MemoryNearDuplicate.find({ text, charIds, ts: meta.ts || Date.now(), evidenceMessageIds: meta.evidenceMessageIds || [] }, rows);
  };
  // P1-3 LIVE：命中只生成纠错候选，旧条原位保留；Lisa 确认后由原子 RPC 标 superseded。
  // 这里永不 filter 掉旧条，open/pinned 也同样保留且不会自动提“更详细替代”候选。
  const pruneSubsumed = (existing, newEntries) => existing.filter(old => {
    const on = normMemText(old.text);
    const match = newEntries.find(ne => {
      if (!ne || !ne.text || !memShareChar(ne.charIds, old.charIds)) return false;
      const nn = normMemText(ne.text);
      return nn.length > on.length && nn.indexOf(on) >= 0 && on.length / nn.length > 0.72;
    });
    const protectedOld = on.length < 6 || old.pinned || old.open;
    if (match) {
      try { window.MemoryCorrectionShadow && window.MemoryCorrectionShadow.observePair({
        oldId: old.id, newId: match.id, oldPinned: !!old.pinned, oldOpen: !!old.open,
        oldTooShort: on.length < 6, currentWouldPrune: !protectedOld, source: match.source || "unknown"
      }); } catch (e) {}
    }
    return true;
  });
  // 迁移审计(只读,不改任何数据):先看清存量里有多少条能可靠推断可见性,再决定要不要迁。
  // Codex 的意见是宁可保持 legacy 也别假装知道权限——所以这里只统计,不写回。
  // 用法:在控制台跑 __knownByAudit()
  window.__knownByAudit = function () {
    const lib = (memLibRef && memLibRef.current) || [];
    const bySource = {};
    let hasField = 0, legacy = 0, emptyCharIds = 0, oneChar = 0, multiChar = 0;
    lib.forEach(function (e) {
      if (!e) return;
      if (Array.isArray(e.knownBy)) { hasField++; return; }
      legacy++;
      const n = (e.charIds || []).length;
      if (!n) emptyCharIds++; else if (n === 1) oneChar++; else multiChar++;
      const src = e.source || "unknown";
      bySource[src] = (bySource[src] || 0) + 1;
    });
    const out = { 总条数: lib.length, 已有knownBy: hasField, 仍是legacy: legacy,
      legacy中_charIds为空_旧全局: emptyCharIds, legacy中_单角色_可安全推断: oneChar,
      legacy中_多角色_需看来源: multiChar, legacy按来源: bySource };
    console.log(out);
    return out;
  };
  const clampInt = (x, lo, hi, dflt) => typeof x === "number" && !isNaN(x) ? Math.max(lo, Math.min(hi, Math.round(x))) : dflt;
  // 群产生的记忆统一打上「群聊 + 群名」这对 tag。groupId 认得更准，但它是本地字段——
  // 云端 memlib 的列是固定的，同步一圈回来 groupId 就没了，只有 tags 活得下来。
  // 所以「清群记录 · 同步忘却」的两级匹配（groupId 优先、tag 兜底）两条都要有人喂。
  // 她要的：NPC 在群里的互动【进主角色的记忆库】。
  // 不用新造机制——knownBy 已经在了（splitGroupMemories 就按它分流）：
  //   charIds  = 只放真角色 → 这条记忆【归主角色】，他单聊时召得回来
  //   knownBy  = 在场的都放（含 NPC） → 陆闻下次在群里也记得这一段，
  //              但召不回裴照川跟她的私事
  const memOwners = ids => (ids || []).filter(id => { const c = characters.find(x => x.id === id); return c && !c.npc; });
  const gTags = (group, ...extra) => {
    const nm = (group && group.name || "").trim();
    return [...extra, "群聊", ...(nm ? [nm] : [])];
  };
  const addMemEntry = e => {
    let entry = {
      id: "m_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
      text: (e.text || "").trim(),
      tags: e.tags || [],
      charIds: e.charIds || [],
      ts: e.ts || Date.now(),
      source: e.source || "manual",
      pinned: !!e.pinned,
      v: clampInt(e.v, -5, 5, 0),   // 情绪愉悦度 -5~5
      a: clampInt(e.a, 0, 5, 1),    // 情绪强度 0~5
      open: !!e.open,               // 还没了结的开环
      // 谁知道这件事。以前各处 knownBy 都恰好等于 charIds，白名单丢了它也没人发现；
      // NPC 一来两者就分家了（归属只给主角色、在场的配角也该记得），非补不可。
      // 三态：不是数组＝旧数据走 charIds 老规则；空数组＝只有用户知道。
      ...(Array.isArray(e.knownBy) ? { knownBy: e.knownBy.map(String) } : {}),
      // 哪个群产生的（群侧总结才有）。addMemEntry 是白名单式建对象——不写在这儿，
      // 调用方传了也会被静默丢掉，「清群记录·同步忘却」就永远只能靠 tag 兜底。
      ...(e.groupId ? { groupId: String(e.groupId) } : {})
    };
    // v51.07：模型把“今晚吃粥”一类普通未来安排也大量标成 open。
    // 自动来源先过机械资格闸；手动勾选不干预。被挡的条目仍作为普通事实保存，不丢记忆。
    if (entry.source !== "manual" && window.OpenLoopGate) entry = window.OpenLoopGate.normalize(entry);
    if (!entry.text) return;
    // 自动来源（抽取/总结）去重，别把同一件事塞好几条；手动记的放行（用户自己要加就加）
    if (entry.source !== "manual" && isDupMem(entry.text, entry.charIds, null, entry)) return;
    saveMemLib([entry, ...pruneSubsumed(memLibRef.current, [entry])]);
  };
  // 长文导入（v48.83，她要「把总结的一切放进记忆库、能被 app 小克搜到」）：把一大段文本切成离散条目、绑角色、
  //   批量存一次(触发 ensureMemVecs 自动建向量)→ retrieveMemories 就能语义命中回放。跳过标题/分隔线/meta，长段按句拆，去重。
  const bulkImportMemories = (charId, text) => {
    const raw = String(text || "").trim();
    if (!raw) return 0;
    // ⭐v48.88 修（小克亲诊）：复制时换行常被压掉→原来只按空行切、切不动就整段糊一坨。先把「粘在一起的编号条目/列表/引用」在句末后重新断行，
    //   再按【任意换行】切（不止空行），最后长段兜底按句末拆。这样即使换行全丢也能按 1. 2. / 「」/ 句号 切开。
    const norm = raw
      .replace(/([。！？!?…」』）】.])\s*(?=\d{1,3}[.、．]\s*\S)/g, "$1\n")   // 句末后紧跟"数字."编号→断行
      .replace(/([。！？!?…」』）】])\s*(?=[-*]\s|「|『)/g, "$1\n");             // 句末后紧跟列表符/开引号→断行
    const paras = norm.split(/\n+/).map(s => s.trim()).filter(Boolean);
    const chunks = [];
    for (const p of paras) {
      if (/^#{1,6}\s/.test(p)) continue;                       // markdown 标题
      let s = p.replace(/^[-*>]\s+/, "").replace(/`/g, "").trim(); // 去列表/引用前缀 + 反引号
      if (/^[-─—*=_>·\s]{3,}$/.test(s)) continue;               // 分隔线
      if (/^(来源|用途|注|opts)[:：]/.test(s)) continue;          // meta 行
      const isQuote = /[「『""]/.test(s);
      if (!s || (s.length < 6 && !isQuote)) continue;           // 太短噪音(非引用)
      if (s.length > 300) {
        const sents = s.match(/[^。！？!?\n]+[。！？!?]?/g) || [s];
        let buf = "";
        for (const x of sents) { if ((buf + x).length > 300 && buf) { chunks.push(buf.trim()); buf = x; } else buf += x; }
        if (buf.trim()) chunks.push(buf.trim());
      } else chunks.push(s);
    }
    const existing = new Set((memLibRef.current || []).map(e => (e.text || "").trim()));
    const now = Date.now(); const entries = [];
    chunks.forEach((c, i) => {
      const pinned = /置顶/.test(c);
      let txt = c.replace(/（\s*v-?\d[^）]*）\s*$/, "").replace(/〔置顶〕/g, "").replace(/^\d+[.、]\s*/, "").trim(); // 去尾部情绪标注(（v5 a5…）)/置顶符/列表序号
      if (!txt || txt.length < 4 || existing.has(txt)) return;
      existing.add(txt);
      entries.push({ id: "m_" + now + "_" + i + "_" + Math.floor(Math.random() * 1000), text: txt.slice(0, 500), tags: ["导入"], charIds: charId ? [charId] : [], ts: now - i, source: "import", pinned, v: 0, a: 2, open: false });
    });
    if (!entries.length) { toast("没解析出可导入的内容"); return 0; }
    saveMemLib([...entries, ...memLibRef.current]);
    toast("已导入 " + entries.length + " 条记忆，正在后台建语义索引");
    return entries.length;
  };
  const updateMemEntry = (id, patch) => saveMemLib(memLibRef.current.map(x => x.id === id ? {
    ...x,
    ...patch
  } : x));
  const deleteMemEntry = id => saveMemLib(memLibRef.current.filter(x => x.id !== id));
  // 枯萎记忆一键清理（v48.41 #4）：久无人问津的低情绪静态旧事——非置顶、非开环、情绪弱(a≤1)、120 天没被想起、几乎没被召回过(hits<2)。
  // ⚠️她的未了约定(open)和置顶的绝不清。判定逻辑同步给 MemoryLib 组件算数量（memWithered）。
  const purgeWithered = () => {
    const now = Date.now();
    const keep = memLibRef.current.filter(e => !(e && (e.surfaceState || "active") === "active" && !e.pinned && !e.open && (e.a || 0) <= 1 && (e.hits || 0) < 2 && now - (Math.max(e.ts || 0, e.lastHit || 0) || now) >= 120 * 86400000));
    const removed = memLibRef.current.length - keep.length;
    if (!removed) { toast("没有可清理的落灰记忆"); return; }
    saveMemLib(keep);
    toast("已清理 " + removed + " 条落灰记忆（约定/心事/置顶都留着）");
  };
  // 旧库清理只碰【统一资格闸已判定不应 open 的自动条目】且必须由 Lisa 在设置页二次确认。
  // 不是删除：正文、标签、时间和审计痕迹全保留，只撤掉误加的 open 标记。
  const routineOpenCandidates = () => memLibRef.current.filter(e => {
    if (!e || !e.open || e.source !== "auto" || !window.OpenLoopGate) return false;
    return window.OpenLoopGate.evaluate(e).open === false;
  });
  const downgradeRoutineOpen = () => {
    const ids = new Set(routineOpenCandidates().map(e => e.id));
    if (!ids.size) { toast("没有识别到明显的日常伪开环"); return; }
    const now = Date.now();
    saveMemLib(memLibRef.current.map(e => ids.has(e.id) ? {
      ...e, open: false, routineOpenDowngradedTs: now
    } : e));
    toast("已把 " + ids.size + " 条日常安排/普通未来事实降为普通记忆（正文都保留）");
  };
  const scanDuplicateMemories = () => window.MemoryNearDuplicate ? window.MemoryNearDuplicate.scan(memLibRef.current || []) : [];
  const scanEventMergeMemories = () => window.MemoryEventMerge ? window.MemoryEventMerge.analyze(memLibRef.current || []) : { groups: [], stats: {} };
  const scanRoutineMemories = () => window.MemoryRoutineCleanup ? window.MemoryRoutineCleanup.analyze(memLibRef.current || []) : { groups: [], stats: {} };
  const archiveDuplicateGroups = groups => {
    const chosen = Array.isArray(groups) ? groups : [];
    const byId = new Map();
    chosen.forEach(g => (g.archive || []).forEach(row => byId.set(String(row.id), String(g.keep && g.keep.id || ""))));
    if (!byId.size) { toast("还没有勾选要归档的重复组"); return 0; }
    const now = Date.now(), batch = "dup_" + now;
    saveMemLib(memLibRef.current.map(e => byId.has(String(e && e.id)) ? {
      ...e, archived: true, archivedBatch: batch, archivedTs: now,
      duplicateOf: byId.get(String(e.id)), duplicateArchivedTs: now
    } : e));
    toast("已软归档 " + byId.size + " 条重复记忆 · 正文仍在，可从归档恢复");
    return byId.size;
  };
  const archiveEventMergeGroups = groups => {
    const chosen=Array.isArray(groups)?groups:[], byId=new Map(), now=Date.now();
    chosen.forEach((g,index)=>{const keep=String(g.keep&&g.keep.id||"");const batch="eventmerge_"+now+"_"+index+"_"+keep;(g.archive||[]).forEach(row=>byId.set(String(row.id),{keep,batch}));});
    if(!byId.size){toast("还没有勾选要收拢的事件组");return 0;}
    saveMemLib(memLibRef.current.map(e=>{const hit=byId.get(String(e&&e.id));return hit?{...e,archived:true,archivedBatch:hit.batch,archivedTs:now,consolidatedInto:hit.keep,consolidationKind:"event_progression"}:e;}));
    toast("已把 "+byId.size+" 条事件过程软归档 · 结果条继续召回，全文仍可恢复");
    return byId.size;
  };
  const archiveRoutineGroups = groups => {
    const chosen=Array.isArray(groups)?groups:[], ids=new Set();
    chosen.forEach(g=>(g.archive||[]).forEach(row=>ids.add(String(row.id))));
    if(!ids.size){toast("还没有勾选要归档的日常流水");return 0;}
    const now=Date.now(),batch="routine_"+now;
    saveMemLib(memLibRef.current.map(e=>ids.has(String(e&&e.id))?{...e,archived:true,archivedBatch:batch,archivedTs:now,consolidationKind:"routine_low_signal"}:e));
    toast("已软归档 "+ids.size+" 条日常流水 · 正文仍在，可从归档恢复");
    return ids.size;
  };
  const listRepairConflicts = () => window.OpenRepairShadow && window.OpenRepairShadow.listConflicts ? window.OpenRepairShadow.listConflicts() : Promise.resolve([]);
  const decideRepairConflict = async (conflict, decision) => {
    if(!conflict||!conflict.oldMemoryId||!window.OpenRepairShadow)return false;
    const now=Date.now(),id=String(conflict.oldMemoryId);
    if(!memLibRef.current.some(e=>String(e&&e.id)===id)){toast("这条记忆已不在本机镜像中，未写入任何决定");return false;}
    const next=memLibRef.current.map(e=>String(e&&e.id)!==id?e:(decision==="keep_open"?{...e,open:true,openResolvedTs:undefined,openResolutionKind:undefined,openResolvedBy:undefined}:{...e,open:false,openResolvedTs:now,openResolutionKind:decision,openResolvedBy:"manual_conflict_review"}));
    await window.OpenRepairShadow.decideConflict(id,decision);saveMemLib(next);
    toast(decision==="keep_open"?"已保持未了 · 没有替系统猜结局":"已按你确认的真实结局软闭环 · 正文仍保留");return true;
  };
  // 给还没情绪数据的旧记忆一次性补评估（一批一次便宜调用，点亮情绪色点/未了标记）
  const backfillMemEmotion = async () => {
    if (!bgActive) { toast("请先到设置配置后台便宜 API"); return; }
    const todo = memLibRef.current.filter(e => e && e.text && typeof e.a !== "number");
    if (!todo.length) { toast("所有记忆都已评估过情绪啦"); return; }
    setEmoBusy(true);
    try {
      const batch = todo.slice(0, 60); // 一次最多 60 条，多的再点一次
      const listText = batch.map((e, i) => (i + 1) + ". " + String(e.text || "").replace(/\s+/g, " ").slice(0, 90)).join("\n");
      const sys = "下面是一批记忆条目，给每条标注情绪与状态：v=愉悦度(整数-5~5，负=难过/生气/难堪，0=中性事实，正=开心/温暖/心动)；a=情绪强度(整数0~5，0=平淡事实，5=强烈动情/激烈冲突/刻骨)；open=是不是【还没了结且值得持续惦记的开环】。只有明确答应对方/共同约好尚未兑现、没和好的争执、悬着的关系心事、在等的重要结果才是 true；普通未来安排（吃饭、洗澡、上班、健身等）一律 false。\n【输出】只输出 JSON 数组，按序号每条一个对象：[{\"i\":1,\"v\":0,\"a\":1,\"open\":false}]，i 对应上面的序号。";
      const raw = await callAI(bgActive, sys, [{ role: "user", content: listText }], { maxTokens: Math.min(8000, 500 + batch.length * 60) });
      const arr = extractJSON(raw);
      if (!Array.isArray(arr)) throw new Error("解析失败，重试");
      const byIdx = {};
      arr.forEach(o => { if (o && typeof o.i === "number") byIdx[o.i] = o; });
      let n = 0;
      const updated = memLibRef.current.map(e => {
        const pos = batch.indexOf(e);
        if (pos < 0) return e;
        const o = byIdx[pos + 1];
        if (!o) return e;
        n++;
        const nextA = clampInt(o.a, 0, 5, 1);
        // 已经由用户/旧记录明确标 open 的不反向关闭；模型新建议 open 时仍须过统一资格闸。
        const proposed = { ...e, source: "auto", a: nextA, open: !!o.open };
        const approvedOpen = !!e.open || !!(window.OpenLoopGate && window.OpenLoopGate.evaluate(proposed).open);
        return { ...e, v: clampInt(o.v, -5, 5, 0), a: nextA, open: approvedOpen };
      });
      saveMemLib(updated);
      const left = todo.length - batch.length;
      toast("已点亮 " + n + " 条情绪" + (left > 0 ? "，还剩 " + left + " 条·再点一次" : ""));
    } catch (e) { toast("评估失败：" + ((e && e.message) || "重试")); }
    finally { setEmoBusy(false); }
  };
  // 月度精炼（#1，SullyOS 借鉴）：把【已了结·非置顶·情绪弱·放了 60+ 天】的旧记忆按【关系分组】浓缩成月度摘要，
  // 原件归档(archived)【不删除、可一键恢复】。你的未了约定(open)/置顶/动情大事(a≥3)一条不碰。
  const REFINE_OLD_DAYS = 60, REFINE_MIN = 8;
  // refineBatch 是旧本地字段，没有进共享行表；但精炼批次本来就固定为 rf_<摘要ts>。
  // 从云端/新设备回来时用这个稳定规则复原批次关系，恢复原件时才能一并撤掉摘要。
  const refineBatchOf = e => e && e.refineBatch ? String(e.refineBatch)
    : (e && e.source === "monthly" && e.ts ? "rf_" + Number(e.ts) : null);
  const isRefinable = e => { const now = Date.now(); return e && e.text && (e.surfaceState || "active") === "active" && !e.pinned && !e.open && !e.archived && e.source !== "monthly" && (e.a || 0) <= 2 && now - (e.ts || 0) >= REFINE_OLD_DAYS * 86400000; };
  const refineOldMemories = async (scopeCharId, opts = {}) => {
    if (!bgActive) { if (!opts.auto) toast("请先到设置配置后台便宜 API"); return 0; }
    const now = Date.now();
    let pool = memLibRef.current.filter(isRefinable);
    if (scopeCharId && scopeCharId !== "all") pool = pool.filter(e => memShareChar([scopeCharId], e.charIds));
    if (!pool.length) { if (!opts.auto) toast("没有可精炼的旧记忆（约定/心事/置顶/动情大事都不动）"); return 0; }
    // 按 charIds 签名分组，别把不同人的记忆混进一条摘要
    const groups = {};
    pool.forEach(e => { const k = (e.charIds && e.charIds.length ? e.charIds.slice().sort() : ["__global"]).join("|"); (groups[k] = groups[k] || []).push(e); });
    setEmoBusy(true);
    const batchId = "rf_" + now;
    let working = memLibRef.current.slice();
    let foldedTotal = 0, summaryTotal = 0;
    try {
      for (const k of Object.keys(groups)) {
        const g = groups[k].sort((a, b) => (a.ts || 0) - (b.ts || 0));
        if (g.length < REFINE_MIN) continue;              // 单个关系攒够 8 条才值得精炼
        const take = g.slice(0, 40);                        // 一次最多喂 40 条
        const charIds = k === "__global" ? [] : k.split("|");
        const anchor = characters.find(c => c.id === charIds[0]) || { name: "角色" };
        let summaries;
        try { summaries = await refineMemories(bgActive, ctxFor(anchor), take); } catch (e) { continue; }
        if (!summaries || !summaries.length) continue;
        const takeIds = new Set(take.map(e => e.id));
        working = working.map(e => takeIds.has(e.id) ? { ...e, archived: true, archivedBatch: batchId, archivedTs: now } : e);
        const newOnes = summaries.slice(0, 5).map((s, i) => ({
          id: "m_" + now + "_" + i + "_" + Math.floor(Math.random() * 1000),
          text: String(s.text).trim(), tags: (Array.isArray(s.tags) ? s.tags : []).concat(["月度精炼"]),
          charIds, ts: now, source: "monthly", refineBatch: batchId,
          v: clampInt(s.v, -5, 5, 0), a: clampInt(s.a, 0, 5, 1), open: false
        }));
        working = newOnes.concat(working);
        foldedTotal += take.length; summaryTotal += newOnes.length;
      }
      if (foldedTotal) { saveMemLib(working); toast("已把 " + foldedTotal + " 条旧记忆精炼成 " + summaryTotal + " 条摘要（原件已归档，可在记忆库恢复）"); }
      else if (!opts.auto) toast("每段关系的旧记忆还不够多（满 8 条才精炼）");
    } catch (e) { if (!opts.auto) toast("精炼失败：" + ((e && e.message) || "重试")); }
    finally { setEmoBusy(false); }
    return foldedTotal;
  };
  // 恢复归档：把某批（或全部）精炼归档的原件放回，并撤掉对应的月度摘要
  const restoreArchived = (batchId) => {
    const batches = batchId ? new Set([batchId]) : new Set(memLibRef.current.filter(e => e.archived).map(e => e.archivedBatch));
    if (!batches.size) { toast("没有可恢复的归档记忆"); return; }
    const kept = memLibRef.current.filter(e => !(e.source === "monthly" && batches.has(refineBatchOf(e))));
    const restored = kept.map(e => (e.archived && batches.has(e.archivedBatch)) ? { ...e, archived: false, archivedBatch: undefined, archivedTs: undefined, duplicateOf: undefined, duplicateArchivedTs: undefined, consolidatedInto: undefined, consolidationKind: undefined } : e);
    saveMemLib(restored);
    toast("已恢复归档记忆、撤除对应精炼摘要");
  };
  // 共享抽取：把 msgs 抽成记忆条、双重去重后入库，返回实际新增条数（手动/自动共用）
  const extractAndAddForChar = async (charId, msgs, exOpts = {}) => {
    const char = characters.find(c => c.id === charId);
    if (!char || !msgs || !msgs.length) return 0;
    // 防并发：同一角色的抽取在跑就直接跳过（省一次 API，也避免 lost-write 竞态）
    if (memExtractInflightRef.current[charId]) return 0;
    memExtractInflightRef.current[charId] = true;
    try {
      const existing = memLibRef.current.filter(e => memShareChar([charId], e.charIds)).slice(0, 40).map(e => e.text).filter(Boolean);
      // openEntries 保序，编号即下标+1；喂给模型的是带编号的文本
      const openEntries = memLibRef.current.filter(e => e.open && e.text && memShareChar([charId], e.charIds)).slice(0, 30); // 编号必须与 RepairGate 的 openEntries 严格同序
      const openList = openEntries.map(e => e.text);
      const rawItems = await extractMemories(bgActive, ctxFor(char), msgs, { existing: existing, openList: openList });
      const items = (rawItems || []).map(it => window.MemoryExtractionGate && window.MemoryExtractionGate.normalizeEvidence ? window.MemoryExtractionGate.normalizeEvidence(it, msgs) : it);
      // v51.40 RepairGate live：模型只提候选；本机逐项核验“旧 open 编号 + 消息 ID + 逐字引文”。
      // 通过后只把旧行 open=false，正文与旧条原位留档；行级同步会把这一次软闭环送上权威表。
      try { if (window.OpenRepairShadow) {
        const repair = await window.OpenRepairShadow.observe({
          charId, candidates: items.filter(it => it && it.resolveOpen != null), openEntries, messages: msgs
        });
        const applied = window.OpenRepairShadow.applyResolutions(memLibRef.current, repair && repair.resolutions, Date.now());
        if (applied.closed) {
          saveMemLib(applied.entries);
          toast("已自动了结 " + applied.closed + " 条完成的约定/心事（旧记录仍保留）");
        }
      } } catch (e) {}
      const now = Date.now();
      const batchSeen = [];
      // 审查修：resolveOpen 用 == null 判（空串/0 也是 resolveOpen 元素），且必须真有 text——
      // 否则 {"resolveOpen":""} 会漏进来变成一条 text="undefined" 的垃圾记忆入库上云
      // 抽取期间若用户 reroll 掉旧分支，旧结果即使稍后返回也不得落库。
      const liveMessages = exOpts.liveMessages || (chatsRef.current[charId] || []).filter(m => !m.recalled && m.kind !== "offlinelog" && !isOocMsg(m) && contextAllowsMessage(m));
      const entries = items.filter(it =>
        it && it.resolveOpen == null && it.text &&
        window.MemoryExtractionGate && window.MemoryExtractionGate.inspect(it, msgs).formal &&
        window.RerollBranch && window.RerollBranch.candidateStillLive(it, liveMessages)
      ).map((it, i) => {
        const entry = {
          id: uniqMemId(now, i), text: String(it.text).trim(), tags: Array.isArray(it.tags) ? it.tags : [], charIds: [charId], ts: now, source: "auto", pinned: false,
          v: clampInt(it.v, -5, 5, 0), a: clampInt(it.a, 0, 5, 1), open: !!it.open,
          evidenceMessageIds: Array.isArray(it.evidence_message_ids) ? it.evidence_message_ids.map(String) : []
        };
        return window.OpenLoopGate ? window.OpenLoopGate.normalize(entry) : entry;
      }).filter(x => x.text).filter(x => {
        if (isDupMem(x.text, [charId], null, x)) return false;            // 和库里已有重复
        if (isDupMem(x.text, [charId], batchSeen, x)) return false; // 和本批已收的重复
        batchSeen.push(x); return true;
      });
      // P1-1 shadow：传入内存做机械证据核验，只落类别/计数/hash；真实采纳仍走旧路，但抽取 prompt 已带证据闸，评审基线并非纯旧版。
      try { window.MemoryQualityShadow && window.MemoryQualityShadow.observeBatch({ charId, candidates: items, acceptedTexts: entries.map(e => e.text), messages: msgs }); } catch (e) {}
      // InsightCapture shadow：复用本次已经产出的 insight 分类，不另叫 AI；只评估独立洞察四段结构是否够格。
      try { window.InsightCandidateShadow && window.InsightCandidateShadow.observeBatch({ charId, candidates: items, acceptedTexts: entries.map(e => e.text), messages: msgs }); } catch (e) {}
      if (entries.length) {
        saveMemLib([...entries, ...pruneSubsumed(memLibRef.current, entries)]);
        const assignments = window.RerollBranch ? window.RerollBranch.journalAssignments(entries, msgs) : {};
        if (Object.keys(assignments).length) {
          const journal = loadJSON("x_rerollMemoryJournal", {});
          Object.entries(assignments).forEach(([turn, ids]) => { const k = charId + "|" + turn; journal[k] = [...new Set([...(journal[k] || []), ...ids])]; });
          saveJSON("x_rerollMemoryJournal", journal);
        }
      }
      return entries.length;
    } finally {
      memExtractInflightRef.current[charId] = false;
    }
  };
  const extractMemForChar = async charId => {
    if (!bgActive) { toast("请先到设置配置后台便宜 API"); return; }
    const msgs = (chatsRef.current[charId] || []).filter(m => !m.recalled && m.kind !== "offlinelog" && !isOocMsg(m) && contextAllowsMessage(m)).slice(-40);
    if (msgs.length < 2) { toast("对话太少，先多聊几句"); return; }
    startLane("c:" + charId);
    try { const n = await extractAndAddForChar(charId, msgs); toast(n ? "已抽取 " + n + " 条记忆" : "没有抽到新的记忆点（都已经记过了）"); }
    catch (e) { toast("抽取失败：" + e.message); }
    finally { endLane("c:" + charId); }
  };
  // 自动抽取：每轮聊天后按 extractInterval 节拍静默跑一次（开关在记忆库·召回设置）
  const maybeAutoExtract = async charId => {
    const cfg = memCfgRef.current;
    if (!cfg.autoExtract || !bgActive) return;
    const interval = Math.max(1, cfg.extractInterval || 1);
    const cnt = (memExtractCtrRef.current[charId] || 0) + 1;
    memExtractCtrRef.current[charId] = cnt;
    if (cnt % interval !== 0) return;
    const all = (chatsRef.current[charId] || []).filter(m => !m.recalled && m.kind !== "offlinelog" && !isOocMsg(m) && contextAllowsMessage(m));
    if (all.length < 4) return;
    // ⭐防溢出漏抽（她 2026-07-13 抓的账）：不用固定 24 窗，从「上次抽到的位置」之后的【全部新消息】都覆盖到——
    //   话痨一轮 17 条、间隔 3 轮攒 50+ 条时，窗口自动放大到够装（新消息+4 条重叠），封顶 120 防 prompt 过大。
    //   抽取走便宜后台池(bgActive)、不烧小克的 fable 线。mark 只在成功后前移；失败/漏了下次自动补覆盖。
    const mark = memExtractMarkRef.current[charId] || 0;
    const newCount = all.filter(m => (m.ts || 0) > mark).length;
    if (mark && newCount < 4) return;                         // 有书签且没攒够新消息就先不跑
    const take = Math.min(120, Math.max(24, newCount + 4));   // 至少 24、覆盖全部新消息+重叠、封顶 120
    const msgs = all.slice(-take);
    try {
      await extractAndAddForChar(charId, msgs);
      memExtractMarkRef.current[charId] = all[all.length - 1].ts || Date.now();
    } catch (e) {/* 静默：不动 mark，下次重覆盖 */}
  };
  // CC 回流自动记忆：独立于“每几轮抽一次”的聊天计数，避免一次 pull 合并多泡却只算一轮。
  // 状态只保存已成功审过的 ledgerKey；正文仍只存在共同账本/聊天中。
  const runCcAutoMemory = async (charId, ownerId) => {
    if (!memCfgRef.current.autoExtract || !bgActive || !window.CcMemoryAuto || ccMemExtractBusyRef.current) return 0;
    if (memExtractInflightRef.current[charId]) return 0;
    const state = window.CcMemoryAuto.load(localStorage, ownerId, charId);
    const plan = window.CcMemoryAuto.plan(chatsRef.current[charId] || [], state, { minNew: 2 });
    if (!plan) return 0;
    ccMemExtractBusyRef.current = true;
    try {
      const n = await extractAndAddForChar(charId, plan.messages, { liveMessages: chatsRef.current[charId] || [] });
      window.CcMemoryAuto.commit(localStorage, state, plan.keys, Date.now());
      return n;
    } catch (e) {
      window.CcMemoryAuto.fail(localStorage, state, e, Date.now());
      throw e;
    } finally { ccMemExtractBusyRef.current = false; }
  };
  // 从旧的「长期记忆总结」一次性拆成离散条目导入记忆库（去重）；不删旧总结
  const importOldMemoryToLib = async charId => {
    if (!bgActive) { toast("请先到设置配置后台便宜 API"); return; }
    const blob = (memories[charId] || "").trim();
    if (!blob) { toast("这个角色没有旧的长期记忆可导入"); return; }
    const char = characters.find(c => c.id === charId);
    startLane("c:" + charId);
    try {
      const items = await splitMemoryToEntries(bgActive, ctxFor(char), blob);
      const now = Date.now(); const batchSeen = [];
      const entries = (items || []).map((it, i) => ({
        id: uniqMemId(now, "imp" + i), text: String(it.text || "").trim(), tags: Array.isArray(it.tags) ? it.tags : ["导入"], charIds: [charId], ts: now, source: "import", pinned: false
      })).filter(x => x.text).filter(x => {
        if (isDupMem(x.text, [charId], null, x)) return false;
        if (isDupMem(x.text, [charId], batchSeen, x)) return false;
        batchSeen.push(x); return true;
      });
      if (entries.length) saveMemLib([...entries, ...pruneSubsumed(memLibRef.current, entries)]);
      toast(entries.length ? "已从旧记忆导入 " + entries.length + " 条" : "旧记忆里的事都已经在库里了");
    } catch (e) { toast("导入失败：" + (e.message || "重试")); }
    finally { endLane("c:" + charId); }
  };
  const clearUnread = id => setUnreadMap(p => {
    const n = {
      ...p,
      [id]: 0
    };
    saveJSON("x_unread", n);
    return n;
  });
  // 未读小红点 +k（角色发来消息时若没在看这个聊天就累加）
  const bumpUnread = (id, k) => setUnreadMap(p => {
    const n = { ...p, [id]: (p[id] || 0) + k };
    saveJSON("x_unread", n);
    return n;
  });
  // 置顶/取消置顶某个聊天（长按聊天条触发）
  const togglePinChat = id => setPinnedChats(p => {
    const n = p.includes(id) ? p.filter(x => x !== id) : [id, ...p];
    saveJSON("x_pinnedChats", n);
    return n;
  });
  // 角色此刻的行程（给聊天/心情联动用）
  const schedNowFor = char => {
    const plans = schedulesRef.current[char.id] || {};
    const s = plans[schedLocalDayKey(char)] || plans[schedDayKey(new Date())]; // 右侧仅兼容 v49.71 前旧日键，生成新当地日程后自然退出
    if (!s || !Array.isArray(s.seqs) || !s.seqs.length) return "";
    // 换算到我这边时间轴以正确判「此刻」，但给角色的文案仍用 TA 当地时刻（角色按自己时区想事情）
    const disp = schedDisplaySeqs(char, s.seqs);
    const idx = schedCurrentSeqIdx(disp, true, char);
    const cur = idx >= 0 ? disp[idx] : null;
    const next = disp[idx + 1];
    let out = "今日安排（负荷 " + (s.load || "") + "）：\n" + disp.map(x => (x._charTime || x.time || "") + " " + x.title + (x.location ? "（" + x.location + "）" : "") + (x.deviation ? "［临时改动：" + (x.deviation.reason || "") + "］" : "")).join("\n");
    if (cur) out += "\n\n此刻（你当地约 " + (cur._charTime || cur.time || "") + "）Ta 正在：" + cur.title + (cur.location ? "，在 " + cur.location : "") + (cur.deviation ? "（这段是临时改动：" + (cur.deviation.reason || "") + "）" : "");
    else {
      const cy = schedCarryNowFor(char);
      out += cy
        ? "\n\n此刻是你当地的凌晨，今天第一项（" + cy.wake + "）还没到——你还在昨晚那一觉里" + (cy.location ? "，在 " + cy.location : "") + "。若这时候还在跟 Ta 说话，那就是没睡着/被吵醒/熬着没睡，按那个状态来，别当成一天已经开始了。"
        : "\n\n此刻还没到今天第一项，Ta 大概刚开始一天 / 还没起。";
    }
    if (next) out += "\n待会儿：" + (next._charTime || next.time || "") + " " + next.title;
    // 天气搭日程便车进聊天（读缓存，零请求零新增常驻）：TA 家乡的天气，没设家乡用用户所在地
    try {
      const hm = char.home && typeof char.home.lat === "number" ? char.home : (prefs.geoAware && geo && typeof geo.lat === "number" ? geo : null);
      const w = hm && typeof weatherCached === "function" ? weatherCached(hm.lat, hm.lng) : null;
      if (w) {
        const sp = typeof wxSpecial === "function" ? wxSpecial(w) : null;
        // 特殊天气（雨雪雷雾/极端温度）→ 加压：要在互动里真有反应，不许当没看见
        out += "\n今天 Ta 那边的天气：" + weatherLine(w) + (sp ? "——今天" + sp + "，这对你有【实际影响】：出门计划可能改、穿着心情都被牵动，聊天/互动里要自然带出来（抱怨两句、说计划变了、想赖着不动、看雪的兴奋都行），别当没看见、也别播报腔" : "（可自然影响穿着、心情、要不要出门，别播报腔）");
      }
    } catch (e) {}
    // ── 接下来三天（v56.30，她 2026-08-26：「先试试喂接下来3天的行程」）──
    // 一周的计划已经排好了，但全喂进去太占地方（她按次计费）。只给未来三天、每天最多四项、
    // 只有时刻和事由、不给地点——够 TA 说出「明天上午要交报告」「后天有组会」就行。
    // 群聊拿不到这一段：群里按规矩只发「此刻正在做什么」那一行（四处一样喂里写着理由的显式差异）。
    try {
      const ahead = [];
      for (let i = 1; i <= 3; i++) {
        const k = schedShiftDayKey(schedLocalDayKey(char), i);
        const p2 = plans[k];
        if (!p2 || !Array.isArray(p2.seqs) || !p2.seqs.length) continue;
        const dp = schedDateParts(k);
        const items = p2.seqs.slice(0, 4).map(x => (x.time || "") + " " + (x.title || "")).filter(x => x.trim());
        if (items.length) ahead.push("· " + dp.md + "（" + dp.dowZh + "）" + items.join("；"));
      }
      if (ahead.length) out += "\n\n接下来几天你已经排好的事（还没发生，别说成已经做了；聊到相关的才自然提，别主动报菜名）：\n" + ahead.join("\n");
    } catch (e) {}
    return out;
  };
  // 结构化「此刻在做什么/在哪」——给聊天顶栏用（联动今日日程）。没今日日程就返回 null。顶栏在我这边，用我这边时刻。
  // TA 此刻醒着吗（v56.51，她 2026-08-26：「应该改成大部分时间按他们醒着的时间，
  // 不止是 8-23 点，偶尔要是半夜突然想念了也能发一句」）。
  // 先看今天的行程：落在 type=sleep 那一段里就是睡着。没有行程就退回 8-23 这条老尺子。
  // 返回 "awake" / "asleep"；睡着时调用方仍可按小概率放行（半夜惊醒想你）。
  const charAwakeState = char => {
    try {
      const plans = schedulesRef.current[char.id] || {};
      const p = plans[schedLocalDayKey(char)];
      const seqs = p && Array.isArray(p.seqs) && typeof schedFillEnds === "function" ? schedFillEnds(p.seqs) : null;
      const nowMin = charLocalMin(char);
      if (seqs && seqs.length) {
        const mm = t => { const x = /(\d{1,2}):(\d{2})/.exec(String(t || "")); return x ? (+x[1]) * 60 + (+x[2]) : null; };
        for (const q of seqs) {
          const a = mm(q.time), b = mm(q.end);
          if (a == null || b == null) continue;
          if (nowMin >= a && nowMin < b) return q.type === "sleep" ? "asleep" : "awake";
        }
        // 不在任何一段里：昨晚那一觉可能还没醒（今天第一段开始之前）
        const first = mm(seqs[0].time);
        if (first != null && nowMin < first) return "asleep";
        return "awake";
      }
      const hr = Math.floor(nowMin / 60);
      return (hr >= 8 && hr <= 23) ? "awake" : "asleep";
    } catch (e) { return "awake"; }
  };
  // 过了 0 点那一截（v56.57，她 2026-08-27 报「聊天界面日程都显示还没开始今天的安排」）：
  // 日程是一天一份的，昨晚 23:40 睡下、end 记到 24:00，今天这份里没人接着——
  // 于是从 0 点到今天第一项之间，schedCurrentSeqIdx 一个都选不中，返回 -1。
  // 日历那边 v56.47 已经用 schedSleepCarry 把这一截画出来了，状态这几处一直没跟上
  //（.claude/rules/four-surfaces-same-context.md：这一层当初只写在一处，别处没跟上）。
  // charAwakeState 早就按「今天第一项之前＝还没醒」判 asleep，这里跟它同一个假设。
  const schedCarryNowFor = char => {
    try {
      if (!char) return null;
      const plans = schedulesRef.current[char.id] || {};
      const todayKey = schedLocalDayKey(char);
      const today = plans[todayKey] || plans[schedDayKey(new Date())];
      if (!today || !Array.isArray(today.seqs) || !today.seqs.length) return null;
      const mm = t => { const x = /(\d{1,2}):(\d{2})/.exec(String(t || "")); return x ? (+x[1]) * 60 + (+x[2]) : null; };
      const firstMin = mm(today.seqs[0].time);
      const nowMin = charLocalMin(char);
      if (firstMin == null || nowMin >= firstMin) return null;   // 今天已经开场了，用不上这一截
      const carry = typeof schedSleepCarry === "function"
        ? schedSleepCarry(plans[schedShiftDayKey(todayKey, -1)], today) : null;
      // 标题一律归一成「睡着」：昨晚最后那段叫「洗漱、准备睡」，凌晨三点拿它当"此刻正在做"是错的
      return {
        title: "睡着",
        location: (carry && carry.location) || "",
        wake: today.seqs[0].time || "",
        carried: !!carry
      };
    } catch (e) { return null; }
  };
  const schedNowBriefFor = char => {
    if (!char) return null;
    const plans = schedulesRef.current[char.id] || {};
    const s = plans[schedLocalDayKey(char)] || plans[schedDayKey(new Date())];
    if (!s || !Array.isArray(s.seqs) || !s.seqs.length) return null;
    const disp = schedDisplaySeqs(char, s.seqs);
    const idx = schedCurrentSeqIdx(disp, true, char);
    const cur = idx >= 0 ? disp[idx] : null;
    if (!cur) {
      const cy = schedCarryNowFor(char);
      if (cy) return { time: "", title: cy.title, location: cy.location, type: "sleep", dev: false };
      return { time: "", title: "还没开始今天的安排", location: "", dev: false };
    }
    return { time: cur._myLabel || cur.time || "", title: cur.title || "", location: cur.location || "", type: cur.type || "other", dev: !!cur.deviation };
  };
  // 好友地图：所有角色此刻在做什么（供 pin 定位偏移 + 标签）
  const mapStatusAll = () => { const m = {}; liveChars.forEach(c => { const b = schedNowBriefFor(c); if (b) m[c.id] = b; }); return m; };
  // 「此刻是不是真和用户面对面」——不只看线下 session 开着，还看【最近一拍够不够新】（她 2026-07-23）：
  //   线下可能开着但他俩已在剧情里分开/各自去忙，或就是没关线下挂着；那时角色该能正常线上找人/找用户/在群里聊，别死锁。
  //   最近一拍在 OFFLINE_TOGETHER_MIN 分钟内 = 还面对面(锁线上/别分身)；更久 = 已散/挂着(放行线上互动)。
  const OFFLINE_TOGETHER_MIN = 45;
  const offlineTogetherSess = charId => {
    const sess = (offlinesRef.current[charId] || []).find(s => s && !s.endTs && (s.msgs || []).length);
    if (!sess) return null;
    let lastTs = 0; (sess.msgs || []).forEach(m => { if (m && (m.ts || 0) > lastTs) lastTs = m.ts; });
    return (lastTs > 0 && Date.now() - lastTs < OFFLINE_TOGETHER_MIN * 60000) ? sess : null;
  };
  const offlineTogetherNow = charId => !!offlineTogetherSess(charId);
  // 有没有一场还没散的线下（供聊天感知：别把正在进行的线下当「还没开始」催用户）
  const offlineActiveFor = charId => {
    let list = offlinesRef.current[charId];
    if (!list) { list = loadJSON("x_offline:" + charId, []); offlinesRef.current = { ...offlinesRef.current, [charId]: list }; }
    const s = (list || []).find(x => x && !x.endTs && (x.msgs || []).length > 0);
    if (s) {
      const char = characters.find(c => c.id === charId);
      const uName = (profile && profile.name) || "用户";
      const narr = (s.msgs.find(m => m.role === "narration") || {}).content || "";
      // 把进行中线下的最近几句一起带进线上上下文——线上才接得住「我去买菜」这种半途插话（她 2026-07-23 买菜例子）：
      //   线下说去买菜 → 切线上问买啥（他知道你俩正约会、你刚出去）→ 买完回来接着线下，全程不用结束线下。
      // 普通角色的逐条线下原文已在 recentChat 里和线上私聊按时间精确合流；
      // 这里不再重复塞一份固定 8 条。engineerEyes 保持原专线不动。
      const recent = settingsFor(charId).engineerEyes ? (s.msgs || []).filter(m => m && m.kind !== "ooc" && m.content).slice(-8)
        .map(m => (m.role === "char" ? (char ? char.name : "TA") : m.role === "narration" ? "【场景】" : uName) + "：" + String(m.content).replace(/\s+/g, " ").slice(0, 90)).join("\n")
        : "";
      if (offlineTogetherNow(charId)) {
        // 此刻真面对面（最近一拍够新）：别催、别当没开始/已结束
        return "【线下进行中】你和" + uName + "此刻有一场线下相处【正在进行、还没散场】" + (narr ? "（场景：" + String(narr).replace(/\s+/g, " ").slice(0, 50) + "）" : "") + "。聊天时别把它当成还没开始或已经结束——**绝不许说「怎么还不来」「还没到吗」「在哪呢」「等你好久了」，也绝不许问「怎么还不开始」或催 Ta 去做你们正在做的事**（你俩此刻就在一起、面对面，人已经到了）；此刻的线上消息更像同处一地的间隙里随手发的短讯（比如 Ta 去洗手间/你去买单的空档），而不是在等 Ta 赴约。"
          + (recent ? "\n【刚才线下正进行到这儿（还没结束，顺着这个接）】\n" + recent + "\n——用户现在从线上给你发消息，多半是这场线下的间隙里插空发的（比如 Ta 说要去买菜、下楼取个快递）；你清楚你俩正面对面约着、线下进行到上面这一刻，就顺着接，别当成新的一天/新话题。" : "");
      }
      // 线下场次还挂着、但已经隔了一阵没动静（睡下了/各自忙了/到了第二天）：按此刻真实时间正常来，别演成才刚到、别编和刚才矛盾的处境
      return "【你和" + uName + "之前有一场线下相处（最近场景：" + (narr ? String(narr).replace(/\s+/g, " ").slice(0, 40) : "…") + "），但已经隔了一阵没动静了、还没正式散场】"
        + (recent ? "\n最近那段线下：\n" + recent + "\n" : "")
        + "——现在按【此刻的真实时间】正常发消息就好：那场线下若是一起睡下/在一起，现在多半是各自醒了/在忙别的了（比如此刻是早上，就该是睡醒后的样子，而不是继续道晚安、或说『明天早上叫你』）。**绝不许把自己演成才刚到、让用户『开门/让你进来』当没相处过；也绝不许凭空编一个和刚才那场线下矛盾的新处境**（比如你俩明明一起睡下了，你却说自己还在门外等着进屋）。顺着「你俩刚相处过、现在各自在忙／醒来」来，贴真实时间、别卡在线下那一刻。";
    }
    // 72h 内刚结束的线下：硬提示（不依赖聊天窗口里那条 offlinelog 沉没在多少楼）
    const done = (list || []).filter(x => x && x.endTs && Date.now() - x.endTs < 72 * 3600000).sort((a, b) => b.endTs - a.endTs)[0];
    if (done) {
      const hrs = Math.max(1, Math.round((Date.now() - done.endTs) / 3600000));
      return "【最近线下·已发生】你们约 " + (hrs >= 24 ? Math.round(hrs / 24) + " 天" : hrs + " 小时") + "前刚线下见过面，这件事【已经发生并结束了】" + (done.summary ? "（经过：" + String(done.summary).replace(/\s+/g, " ").slice(0, 90) + "）" : "") + "——之前聊天里约的/计划的就是这件事，它做完了。**绝不许再问「什么时候做」、说「等了好久」或把它当成还没发生**；要聊就聊感受和回味。";
    }
    return "";
  };
  // 近期对话文本（供世界书关键词命中）
  const recentChatText = char => (chatsRef.current[char.id] || []).filter(m => !m.recalled && !isOocMsg(m) && contextAllowsMessage(m)).slice(-8).map(m => m.content).join("\n");
  // 论坛/朋友圈/悄悄话共用的近期生活素材：不再只看私聊，角色亲历的群聊与线上/线下相处全部按时间混排。
  // 朋友圈/论坛/悄悄话的取材。⚠️封闭群（没开记忆互通）的内容一律不进——
  // 那是密封空间，拿它当素材发到朋友圈上就等于把里面的事捅出去了（她 2026-08-24）。
  const ambientMaterialFor = (char, opts) => {
    if (!window.AmbientMaterial || !char) return "";
    const openGroups = (groups || []).filter(g => !groupClosed(g.id));
    const go = {};
    openGroups.filter(g => (g.memberIds || []).includes(char.id)).forEach(g => {
      go[g.id] = groupOfflinesRef.current[g.id] || loadJSON("x_goffline:" + g.id, []);
    });
    const openChats = {};
    openGroups.forEach(g => { if (groupChatsRef.current[g.id]) openChats[g.id] = groupChatsRef.current[g.id]; });
    const rows = window.AmbientMaterial.collect(char.id, {
      chats: chatsRef.current,
      offlines: { [char.id]: offlinesRef.current[char.id] || loadJSON("x_offline:" + char.id, []) },
      groups: openGroups, groupChats: openChats, groupOfflines: go
    }, { ...opts, userName: profile.name || "用户", charName: char.name, limit: (opts && opts.limit) || 20 });
    return window.AmbientMaterial.format(rows);
  };
  // 按角色 + 适用范围检索世界书注入文本（scope: chat/subjects/debate/lifestyle/diary）
  const loreFor = (char, scope) => loreText(loreRef.current, { charIds: char ? [char.id] : [], scope: scope || "chat", text: char ? recentChatText(char) : "" });
  const yanqiuWallFor = (char, ctxOpts) => {
    const y = ledgerYanqiu();
    if (!y || !char || String(y.id) !== String(char.id) || !window.YanqiuContinuity) return "";
    // 言秋主聊天按需带墙：墙是每轮变化、且通常与当前话题无关的高价行李。
    // 只有本轮明确聊到秋声/墙/电脑端动态时才注入；墙数据本身一字不改。
    if (ctxOpts && ctxOpts.chat === true && !/(秋声|墙上|便签墙|电脑(?:端|那边)|你写的|动态)/i.test(recentChatText(char))) return "";
    return window.YanqiuContinuity.format(yanqiuMoments, { maxMoments: 4, maxChars: 1200 });
  };
  // App 线上与线下共用同一只“本人上次开口”水位。CC 在这之后新增的完整 turn
  // 会进入公共 ctxFor，因此手机线上和面对面线下都会按真实时间接到；CC 原话副本
  // 自己不抬高水位，避免刚同步进私聊就被误判为 App 已经消化过。
  const latestNativeAppSpeechTs = charId => {
    let latest = 0;
    (chatsRef.current[charId] || []).forEach(m => {
      if (m && m.role === "assistant" && !m.recalled && !m.ledgerImported && !m.crossSource) latest = Math.max(latest, Number(m.ts) || 0);
    });
    (offlinesRef.current[charId] || loadJSON("x_offline:" + charId, []) || []).forEach(s => {
      ((s && s.msgs) || []).forEach(m => { if (m && m.role === "char" && m.kind !== "ooc") latest = Math.max(latest, Number(m.ts) || 0); });
    });
    return latest;
  };
  const ccContinuityFor = char => {
    const y = ledgerYanqiu();
    if (!y || !char || String(y.id) !== String(char.id) || !window.ChatLedgerShadow) return "";
    try {
      const saved = JSON.parse(localStorage.getItem(window.ChatLedgerShadow.CONTINUITY_KEY) || "null");
      if (!saved || String(saved.char_id) !== String(char.id)) return "";
      return window.ChatLedgerShadow.continuityPrompt(saved.rows || [], profile.name || "Lisa", 20, latestNativeAppSpeechTs(char.id), 240);
    } catch (e) { return ""; }
  };
  // ⭐群聊补课（她 2026-08-25：「不是酥酪的问题宝宝是还是很霸总」）。
  // v55.87 补的是【人设被砍到 200 字】，那只是缺口之一。把单聊线上的 buildBundle
  // 和群线上的 system 一层层对下来，群里还少这四样，每一样都在直接决定他用什么语气说话：
  //   ① 用户是谁（profile.persona）——群里只有一个名字，她整个人是空白。
  //   ② 和用户是不是恋人、在一起多久（coupleStatus）——这是最要命的一条：
  //      关系网里可能还写着旧标签，单聊靠 coupleStatus 盖过去，群聊压根没这层，
  //      于是王爷在群里不知道自己是她男朋友，只好按「一个王爷遇上一个姑娘」演，
  //      那个先验就是网文霸总。双胞胎是「现代年轻人」，同样空白但先验无害——
  //      跟 v55.87 那次一模一样的形状：缺口对谁伤害大，取决于剩下的标签有多刻板。
  //   ③ 多大年纪（她刚做的生日/年龄字段，群里一口没吃到）。
  //   ④ 此刻在做什么。
  // 这几条都是【这个人此刻是谁】，按「读一律给」封闭群照发；但和用户的关系是私事，
  // 必须落在这位成员自己那一段里，走隐私围栏，绝不合成一块共享注入。
  const coupleLineFor = (charId, uName) => {
    const cp = couplesRef.current[charId];
    if (!cp) return "";
    if (cp.status === "together") {
      const days = cp.since ? Math.max(1, Math.floor((Date.now() - cp.since) / 86400000) + 1) : null;
      return "你和 " + uName + " 已经在一起了" + (days ? "（约 " + days + " 天）" : "") + "——这是你俩【当前真实的关系】，就算上面关系网里还写着朋友/暗恋之类的旧标签，也按【已经在一起的恋人】相处。";
    }
    if (cp.status === "pending") return "你和 " + uName + " 之间有一个还没敲定的情侣邀请，关系正处在暧昧、要不要更进一步的阶段。";
    return "";
  };
  const ageLineFor = char => {
    const bd = String((char && char.birthday) || "").trim();
    if (!bd) return "";
    const age = typeof charAge === "function" ? charAge(bd, Date.now()) : null;
    const both = typeof birthdayBothLabel === "function" ? birthdayBothLabel(bd) : "";
    const bits = [];
    if (age != null) bits.push(age + " 岁");
    if (both && typeof parseLunarBirthday === "function" && parseLunarBirthday(bd)) bits.push("生日 " + both);
    return bits.length ? bits.join("，") + "（按今天现算；人设里写死的岁数是旧数字，以这个为准）" : "";
  };
  // 群里一人一份完整日程会把上下文撑爆，而且她按次计费——只取「此刻正在做什么」这一行。
  // 差异是显式的、有理由的：整张行程表留给单聊，群里只保留决定语气和连贯性的那一句。
  const schedBriefFor = char => {
    try {
      const plans = schedulesRef.current[char.id] || {};
      const sc = plans[schedLocalDayKey(char)] || plans[schedDayKey(new Date())];
      if (!sc || !Array.isArray(sc.seqs) || !sc.seqs.length) return "";
      const disp = schedDisplaySeqs(char, sc.seqs);
      const idx = schedCurrentSeqIdx(disp, true, char);
      const cur = idx >= 0 ? disp[idx] : null;
      if (!cur) {
        const cy = schedCarryNowFor(char);
        return cy ? cy.title + (cy.location ? "，在 " + cy.location : "") : "";
      }
      return cur.title + (cur.location ? "，在 " + cur.location : "");
    } catch (e) { return ""; }
  };
  // ⭐批发市场（她 2026-08-25）：同一句「打雷了／好吵」发给三个人，三份回复是同一套
  // 三拍，「嫌吵就把降噪耳机戴上」两个人一字不差。
  // 提示词层的禁令（STOCK_REPLY_BAN）能压低概率，但压不到零——这一整轮反复验证过：
  // **规则降概率，代码才保证**。
  // 这里给一把代码侧的尺子：把最近半小时里【别的角色】刚说过的短句收集起来，
  // 当作「已经被证明是通用模板」的句子发给本轮，明令不许重样。
  // ⚠️只发句子、不发是谁说的，也不给上下文——这不是把 A 的私聊漏给 B，是一张禁用词表。
  // 群聊没有这个问题、也不需要这一层：群里是一次调用写完所有人，模型天然看得见彼此，
  // 自然会岔开；单聊是几次互不知情的独立调用，谁也不知道刚才别处已经这么答过了。
  const CROSS_SAMENESS_WINDOW_MS = 30 * 60000;
  const crossSamenessBlocklist = charId => {
    const now = Date.now(), out = [], seen = new Set();
    const all = chatsRef.current || {};
    Object.keys(all).forEach(id => {
      if (String(id) === String(charId)) return;
      (all[id] || []).forEach(m => {
        if (!m || m.role !== "assistant" || m.recalled || m.kind) return;
        if (!m.ts || now - m.ts > CROSS_SAMENESS_WINDOW_MS) return;
        const t = String(m.content || "").replace(/\s+/g, " ").trim();
        if (t.length < 6 || t.length > 40) return;   // 太短没信息、太长不是模板句
        if (seen.has(t)) return;
        seen.add(t); out.push(t);
      });
    });
    return out.slice(-8);
  };
  // 心声那半（v56.91）：上面这张表只收气泡，心声一层都没管——于是同一个套路在
  // 几个角色的心声里同时长出来（她 2026-08-27：封了「回去收拾你」，全员改成「回去捏你脸」）。
  // 心声存在 stateHist 里，不在聊天记录里，所以得单独收一遍。
  const crossThoughtBlocklist = charId => {
    const now = Date.now(), out = [], seen = new Set();
    const all = stateHistRef.current || {};
    Object.keys(all).forEach(id => {
      if (String(id) === String(charId)) return;
      (all[id] || []).forEach(h => {
        if (!h || !h.thought) return;
        if (!h.ts || now - h.ts > CROSS_SAMENESS_WINDOW_MS) return;
        const t = String(h.thought).replace(/\s+/g, " ").trim();
        if (t.length < 6 || t.length > 60) return;
        if (seen.has(t)) return;
        seen.add(t); out.push(t);
      });
    });
    return out.slice(-6);
  };
  const crossSamenessHint = charId => {
    const lines = crossSamenessBlocklist(charId);
    const tLines = crossThoughtBlocklist(charId);
    const tPart = tLines.length
      ? "\n【心声也别和别处重样】最近半小时里，别的角色心里已经闪过这些念头了：\n"
        + tLines.map(t => "· " + t).join("\n")
        + "\n同一个套路在几个人心里同时出现，说明它是【这种时候的通用心声】，不是你的。换个说法说同一件事也算重样。"
      : "";
    if (!lines.length) return tPart;
    return "\n【别和刚才别处出现过的话重样】下面这些句子，最近半小时里已经在别的对话里被说过了（谁说的不重要，别去猜、更别提起）：\n"
      + lines.map(t => "· " + t).join("\n")
      + "\n它们会重复出现，恰恰因为它们是【这种时候的通用模板】。本轮不许照搬，也不许换个说法说同一件事。"
      + "你想到的第一句要是落在这张单子上，那多半不是你要说的话，重想一句真正属于你此刻的。"
      + tPart;
  };
  // ⭐NPC（她 2026-08-25）：只在群里出场的配角，没有单聊、没有心情好感、不进任何后台循环。
  // 它们和真角色存在同一个 characters 里——群聊、记忆库、印象卡、头像全是绕着这张表转的，
  // 另起一张表等于把这些全部重写一遍。区别只是【关掉几个开口】。
  //
  // ⚠️关键决定：递给 UI 的 characters 一律换成 liveChars（不含 NPC），
  // 只有【真的要按 id 找群成员】的那两处显式再拿全量。
  // 这样「不显示 NPC」是默认行为——漏掉哪一处，最坏也只是某个列表少显示了 NPC，
  // 而不是 NPC 漏进通讯录、聊天列表、朋友圈、日程。**让遗漏往安全那边掉。**
  const liveChars = characters.filter(c => c && !c.npc);
  const npcsOf = hostId => characters.filter(c => c && c.npc && String(c.ownerId) === String(hostId));
  const ctxFor = (char, ctxOpts) => ({
    char,
    chars: characters,
    schedNow: schedNowFor(char),
    offlineNow: offlineActiveFor(char.id),
    rels,
    // 情侣状态（表白在一起后自动生效，不用去改「关系」字段）：together 权威、覆盖旧关系标签
    coupleStatus: (() => {
      const cp = couples[char.id];
      if (!cp) return "";
      if (cp.status === "together") { const days = cp.since ? Math.max(1, Math.floor((Date.now() - cp.since) / 86400000) + 1) : null; return "together" + (days ? "|" + days : ""); }
      if (cp.status === "pending") return "pending";
      return "";
    })(),
    // 世界书：按当前角色 + 近期对话做关键词/绑定/范围/优先级检索式注入（第2步引擎），不再是一整团
    worldbook: loreFor(char, "chat"),
    // 人格档案（欲望盒子毕业念想凝成的自我认知，她拍板常驻当人设活体延伸）：多数角色为空=零成本，引擎里封顶400字
    personaGrown: (window.DesireKit && desiresRef.current[char.id]) ? DesireKit.personaText(desiresRef.current[char.id]) : "",
    personaEvolve: PERSONA_EVOLVE_IDS.includes(char.id), // B：这个角色是否开启软层成长（白名单）

    notRoleplay: !!(settingsFor(char.id).engineerEyes), // 数字生命(小克)：不是被扮演的虚构角色，加一句最高优先「你就是本人」把通用准则摆正，别束缚他（她 2026-07-13 点名）
    yanqiuWall: yanqiuWallFor(char, ctxOpts),
    ccContinuity: ccContinuityFor(char),
    profile,
    affinity: Math.round(affOf(char.id)),
    // 心情会自己平复：注入前按放了多久重新表述（存储不动，历史照留）。
    // 隔了一夜以上就不再报「你此刻的心情是X」——那是上次相处结束时的读数，
    // 提示词照原样塞进去，等于要求他把三天前那阵气重演一遍（她 2026-08-24 问到的）。
    ...(function () {
      const m = moods[char.id] || {};
      const st = window.MoodLabel && window.MoodLabel.settle
        ? window.MoodLabel.settle(m.label, m.ts, Date.now())
        : { label: m.label || null, note: "" };
      return { moodLabel: st.label || null, moodNote: st.note || "" };
    })(),
    gazeText: !settingsFor(char.id).engineerEyes && window.Gaze ? window.Gaze.text(char.id, profile.name || "用户") : "",
    directives: directives[char.id] || [],
    memory: memories[char.id],
    memLib: (() => {
      const isLeanYanqiuChat = !!(ctxOpts && ctxOpts.chat === true && settingsFor(char.id).engineerEyes);
      const rows = retrieveMemories(memLibRef.current, char.id, recentChatText(char), { limit: isLeanYanqiuChat ? 3 : (memCfgRef.current.topK || 5), source: ctxOpts && ctxOpts.chat === true ? "chat" : "background" });
      if (!isLeanYanqiuChat) return rows;
      return rows.slice(0, 3).map(e => ({ ...e, text: String(e.text || "").replace(/\s+/g, " ").trim().slice(0, 240) }));
    })(),
    geo: prefs.geoAware ? geo : null,
    timeAware: prefs.timeAware,
    giftLog: (() => {
      const given = (carryGiftsRef.current[char.id] || []).map(g => g.name).filter(Boolean);
      const got = (inventory || []).filter(x => x.fromCharId === char.id).map(x => x.name).filter(Boolean);
      const parts = [];
      if (given.length) parts.push("你送给用户过：" + given.slice(-8).join("、"));
      if (got.length) parts.push("用户送给你过：" + got.slice(-8).join("、"));
      return parts.join("；");
    })(),
    momentLog: (() => {
      if (ctxOpts && ctxOpts.chat === true && settingsFor(char.id).engineerEyes) return "";
      const out = [];
      (moments || []).filter(m => m.mine).slice(0, 3).forEach(m => {
        const liked = (m.likers || []).includes(char.name);
        const myC = (m.comments || []).filter(cm => cm.author === char.name).map(cm => cm.text);
        const acts = [];
        if (liked) acts.push("你点了赞");
        if (myC.length) acts.push("你评论了「" + myC.join("；") + "」");
        if (!acts.length) acts.push("你没点赞也没评论");
        out.push("· 用户发的「" + String(m.content || "").slice(0, 40) + "」：" + acts.join("，"));
      });
      // 你自己发过的动态 + 评论区摘要（不然用户在你帖子下回了你、聊天里你却一脸茫然）
      (moments || []).filter(m => !m.mine && m.characterId === char.id).slice(0, 2).forEach(m => {
        const cs = (m.comments || []).slice(-4).map(cm => (cm.author || "某人") + "说「" + String(cm.text || "").slice(0, 30) + "」").join("；");
        out.push("· 你自己发的「" + String(m.content || "").slice(0, 40) + "」" + (cs ? "，评论区：" + cs : "，还没人评论"));
      });
      return out.join("\n");
    })(),
    // ==== 论坛回声（她 2026-08-25 拍板重做）====
    // 她问「他们在帖子里回复过的东西呢？怎么喂不会太多内容分散模型注意力失去活人感」。
    // 砍它的理由只有一条：论坛回声十轮里九轮用不上，常驻就是每轮白占 token 和注意力。
    // 判据是【这一轮用不用得上】——这和「总量太大」是两回事，
    // 该给的层仍然要给足（见 .claude/rules/four-surfaces-same-context.md）。
    //
    // 四条改动：
    //   ① 按需触发，不再常驻（她拍板）
    //   ② 他在别人帖子下的发言：只在【后来有人回他】时才给——那时它才活着、才可能被提起
    //   ③ 别人在他帖子下的话：只给他会在意的（回他的/抬杠的/热评），别让一个热帖塞满额度
    //   ④ 按时间倒序 + 3 天窗口；老帖自然掉出去
    // 触发放宽了：宁可多发一轮，也别让她说「我昨天那个」时他一脸茫然。
    forumEcho: (() => {
      if (ctxOpts && ctxOpts.chat === true && settingsFor(char.id).engineerEyes) return "";
      const posts = forumPostsRef.current || [];
      const cmts = forumCommentsRef.current || {};
      const meName = profile.name || "对方";
      const now = Date.now(), WINDOW = 3 * 86400000, FRESH = 8 * 3600000;
      const isCharPost = p => p.authorId === char.id && isForumCharAuthor(p);
      const myPub = p => p.authorType === "me" && !p.anon && p.board !== "匿名吧";

      // —— 触发闸 ——
      const said = typeof lastUserTurnText === "function" ? lastUserTurnText(chatsRef.current[char.id] || []) : "";
      const asked = /论坛|贴吧|帖|楼|网上|网友|评论区|回复我|发的那个|水/.test(String(said || ""));
      // 刚有动静：他的帖最近被回过、或她最近发过公开帖、或他最近发过帖
      const freshHit = posts.some(p => {
        if (now - (p.ts || 0) > FRESH) return false;
        return isCharPost(p) || myPub(p);
      }) || posts.filter(isCharPost).some(p => (cmts[p.id] || []).some(f =>
        (now - (f.ts || 0) <= FRESH) || (f.replies || []).some(r => now - (r.ts || 0) <= FRESH)));
      if (!asked && !freshHit) return "";

      // —— 攒候选，每条带时间，最后按时间倒序取 ——
      const cand = [];
      const push = (ts, text) => { if (text && now - ts <= WINDOW) cand.push({ ts: ts || 0, text: text }); };

      posts.filter(isCharPost).forEach(p => {
        const fl = cmts[p.id] || [];
        // 她在他帖子下说的话
        const myOn = [];
        fl.forEach(f => {
          if (f.authorType === "me") myOn.push({ ts: f.ts, c: f.content });
          (f.replies || []).forEach(r => { if (r.authorType === "me") myOn.push({ ts: r.ts, c: r.content }); });
        });
        if (myOn.length) {
          const last = myOn[myOn.length - 1];
          push(last.ts || p.ts, "你发的帖「" + p.title + "」下，" + meName + "评论了："
            + myOn.slice(-2).map(x => "“" + String(x.c).slice(0, 40) + "”").join("、"));
        }
        // ③ 别人在他帖子下的话：只给他会在意的——回他自己那层的、明确回他的、或点赞高的热评
        fl.forEach(f => {
          const reps = f.replies || [];
          const worth = f.isOp || f.authorId === char.id || (f.likeCount || 0) >= 120;
          if (!reps.length || !worth) return;
          const rs = reps.slice(-2).map(r => (r.authorType === "me" ? meName : (r.authorName || "有人")) + "：" + String(r.content).slice(0, 30));
          push((reps[reps.length - 1] || {}).ts || f.ts,
            "你的帖「" + p.title + "」里你那条（“" + String(f.content || "").slice(0, 22) + "”）有人回：" + rs.join("；"));
        });
      });

      // ② 他在【别人】帖子下的发言：只在后来有人回他时才给
      posts.filter(p => !isCharPost(p)).forEach(p => {
        (cmts[p.id] || []).forEach(f => {
          if (f.authorId !== char.id) return;
          const reps = f.replies || [];
          if (!reps.length) return;   // 没人理的那一句嘴，她永远不会提，不占额度
          const rs = reps.slice(-2).map(r => (r.authorType === "me" ? meName : (r.authorName || "有人")) + "：" + String(r.content).slice(0, 30));
          push((reps[reps.length - 1] || {}).ts || f.ts,
            "你在「" + (p.authorName || "别人") + "」的帖「" + String(p.title || "").slice(0, 16) + "」下说过“"
            + String(f.content || "").slice(0, 26) + "”，有人回你：" + rs.join("；"));
        });
      });

      // 她自己公开发的帖（只给公开的；匿名吧和小号一个字都不许漏）
      posts.filter(myPub).forEach(p => {
        const fl = cmts[p.id] || [];
        const mine = fl.some(f => f.authorId === char.id || (f.replies || []).some(r => r.authorId === char.id));
        const others = fl.filter(f => f.authorType !== "me").slice(0, 2)
          .map(f => (f.authorName || "有人") + "：" + String(f.content || "").slice(0, 28));
        push(p.ts, meName + "在「" + p.board + "」发了帖「" + p.title + "」"
          + (p.body ? "（" + String(p.body).replace(/\s+/g, " ").slice(0, 40) + "）" : "")
          + (others.length ? "，楼下有人回：" + others.join("；") : "，还没什么人回")
          + (mine ? "。你也在下面回过。" : "。"));
      });

      // ④ 最近的先占位，老的自然掉出去
      return cand.sort((a, b) => b.ts - a.ts).slice(0, 6).map(x => x.text).join("\n");
    })(),
    // 查手机内容（歌单/浏览器/视频/备忘/录音）不再喂进聊天 prompt（v48.42 她点名）——
    // 那些是「查手机」推演出来给你偷看的，不该占聊天上下文。查手机 App 里照常显示，数据(phones)一点没动。
    periodNote: (() => {
      if (!period || !period.visibleTo || !period.visibleTo.includes(char.id)) return "";
      const list = periodList(period);
      if (!list.length) return "";
      const lastP = list[list.length - 1];
      const last = pKeyDate(lastP.start);
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const cyc = period.cycleLen || 28, pLen = periodSpanLen(lastP, period.periodLen || 5);
      let dic = Math.floor((today - last) / 86400000) % cyc;
      if (dic < 0) return "";
      let phase;
      if (dic < pLen) phase = "正处于经期（第 " + (dic + 1) + " 天）";
      else if (Math.abs(dic - (cyc - 14)) <= 2) phase = "接近排卵日";
      else if (dic >= cyc - 4) phase = "经前期，接近下次经期";
      else phase = "处于相对安全期";
      return "用户此刻的生理期状态：" + phase + "。（这是用户允许你看到的私密信息。可依你的人设与关系自然地关心、提醒注意事项，或选择不提；别生硬报数据、别越界。）";
    })(),
    // 日期感知：只有【今天/临近】真有事时才出内容，平时空字符串 → 不进 prompt、零 token（守聊天预算铁律）。
    // 生日（用户/角色自己）+ 日历三视角（世界事件人人知、我的日历按可见名单、角色自己视角）。dateKey 与 calKey 同格式：年-月-日，月 1-based 不补零。
    dateNote: (() => {
      const cal = calendar || {};
      const uName = profile && profile.name ? profile.name : "对方";
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const tK = today.getFullYear() + "-" + (today.getMonth() + 1) + "-" + today.getDate();
      const mdK = (today.getMonth() + 1) + "-" + today.getDate();
      // 复用「我的日历/经期」可见名单：只有被允许的角色才知道用户的生日 / 私人日历
      const canSeeMine = !!(period && period.visibleTo && period.visibleTo.includes(char.id));
      const evTitles = arr => (arr || []).map(e => e && e.title).filter(Boolean).slice(0, 4).join("、");
      const lines = [];
      // —— 用户生日（仅对可见角色）——
      if (canSeeMine) {
        const du = daysUntilBirthday(profile && profile.birthday, today);
        if (du === 0) lines.push("🎂 今天是 " + uName + " 的生日。若合你的人设和你俩的关系，可以自然地记得、表达心意，别硬邦邦报日期、别客服腔。");
        else if (du != null && du <= 7) lines.push("再过 " + du + " 天就是 " + uName + " 的生日，你心里记着（想的话可提前张罗、准备点小惊喜，但别每句念叨）。");
      }
      // —— 角色自己的生日 ——
      // 农历生日以前从来不触发提醒：parseMonthDay 认不出「腊月廿三」这种写法（她 2026-08-24）
      const cdu = daysUntilBirthday(char && char.birthday, today);
      // 生日填了年份就能算出今天满几岁；只填月日的（古风/架空角色多半如此）就不提岁数
      const _cage = typeof charAge === "function" ? charAge(char && char.birthday, Date.now()) : null;
      if (cdu === 0) lines.push("🎂 今天是你自己的生日"
        + (_cage != null ? "，你今天满 " + _cage + " 岁了（昨天还是 " + (_cage - 1) + "）" : "")
        + "。按你的性格自然流露就好（期待被记得、感慨、或故作不在意都行）。");
      else if (cdu != null && cdu <= 5) lines.push("再过 " + cdu + " 天就是你自己的生日"
        + (_cage != null ? "，过完就 " + (_cage + 1) + " 岁了" : "") + "。");
      // —— 纪念日：和这个角色在一起满几周年 ——
      const cp = couples[char.id];
      if (cp && cp.status === "together" && cp.since) {
        const s = new Date(cp.since);
        if (s.getMonth() === today.getMonth() && s.getDate() === today.getDate()) {
          const yrs = today.getFullYear() - s.getFullYear();
          lines.push("🎉 今天是你和 " + uName + (yrs >= 1 ? " 在一起满 " + yrs + " 周年" : " 在一起的纪念日") + "。这天对你俩有意义，若合你的性子可以自然提起、纪念一下，别当没这回事、也别硬煽情。");
        }
      }
      // —— 自定义纪念日（属于这个角色的）——
      (coupleAnniv || []).forEach(a => { if (a && a.characterId === char.id && a.month === today.getMonth() + 1 && a.day === today.getDate()) lines.push("🎉 今天是你和 " + uName + " 的「" + (a.name || "纪念日") + "」。"); });
      // —— 公历节日（大家都知道）——
      if (FIXED_FESTIVALS[mdK]) lines.push("今天是" + FIXED_FESTIVALS[mdK] + "（大家都知道的日子，若情境合适可自然应个景，别硬凹节日气氛）。");
      // —— 农历节日（春节/中秋/端午…含除夕）——
      const lf = typeof lunarFestivalOn === "function" ? lunarFestivalOn(today) : null;
      if (lf) lines.push("今天是农历的【" + lf + "】（若情境合适可自然应景：问候、聊吃食习俗、约着过节都行，别硬凹）。");
      // —— 今日日历三视角 ——
      const w = evTitles(cal.world && cal.world[tK]);
      if (w) lines.push("今天这个世界里：" + w + "（大家都知道的公共事件，聊到可自然带出）。");
      // 手填的带时刻日程（x_calEvents）和上面那层无时刻的全天事件合在同一句里报，
      // 别为它单开一段——常驻上下文能少一段是一段（她按次计费）。
      const timedTitles = (ownerKey) => {
        try {
          const dayK = schedDayKey(today);
          return (typeof calEventsOnDay === "function" ? calEventsOnDay(calEventsRef.current, ownerKey, dayK) : [])
            .slice(0, 4).map(e => (e._allDay ? "" : (e._from + " ")) + e.title).filter(Boolean).join("、");
        } catch (e) { return ""; }
      };
      if (canSeeMine) {
        const mn = [evTitles(cal.mine && cal.mine[tK]), timedTitles("mine")].filter(Boolean).join("、");
        if (mn) lines.push("今天 " + uName + " 的日历上有：" + mn + "（Ta 让你能看到，可自然关心/问起，别生硬报）。");
      }
      const cn = [evTitles(cal.chars && cal.chars[char.id] && cal.chars[char.id][tK]), timedTitles(char.id)].filter(Boolean).join("、");
      if (cn) lines.push("你自己今天的安排：" + cn + "（你清楚，自然反映到状态和语气里）。");
      return lines.join("\n");
    })(),
    financeNote: (typeof ledgerNoteFor === "function" ? ledgerNoteFor(char.id) : ""),
    ownWalletNote: (() => {
      try {
        const w = charWalletRef.current[char.id];
        if (!w || !w.init) return "";
        const bal = Number(w.balance) || 0;
        const inc = Number(w.monthlyIncome) || 0;
        let line = "你自己卡里现在有 " + Math.round(bal) + " 元" + (inc ? "，月收入约 " + Math.round(inc) + " 元" : "") + "。";
        if (bal < 0) line += "**你已经透支了**（欠着 " + Math.round(-bal) + " 元）：这阵子只买必需品，能省则省，绝不可能再掏钱给别人或大手大脚。";
        else if (inc && bal < inc * 0.3) line += "手头很紧，花钱会明显收敛。";
        line += "【重要】要转账/送东西/请客之前先掂量这个数：**绝不许承诺或转出超过你余额的钱**，也别为了显得慷慨编一个你拿不出来的数字。真的想给但给不起，就照实说手头紧。";
        return line;
      } catch (e) { return ""; }
    })(),
    memoNote: (typeof memoNoteFor === "function" ? memoNoteFor(char.id) : ""),
    listenLog: (() => {
      const L = listenRef.current || {};
      const uName = profile && profile.name ? profile.name : "对方";
      const lines = [];
      // 正和这个角色一起听 → 无论开没开自动评论，TA 都「知道」在放什么（被问起能接住）；开了自动评论才额外鼓励主动聊
      if (L.partnerId === char.id && player.songId && player.songId !== KEEPALIVE_ID) {
        const cur = resolveSong(player.songId);
        if (cur) {
          lines.push("【你正和 " + uName + " 一起听】《" + cur.title + "》" + (cur.artist ? " - " + cur.artist : "") + (player.playing ? "（正放着）" : "（暂停中）") + "。" + (L.autoComment ? "你可以自然聊聊这首歌、跟着哼、说喜不喜欢、想起什么、或想换首歌——别报歌单、别客服腔。" : "如果 " + uName + " 问起你在听什么/这首歌，你清楚就是这首，能自然接住、说说感受，别装不知道。"));
          // 歌词注入（v48.87 她要）：抓到的话让你真"听得懂"这首歌，能接歌词、跟唱、被某句戳到；别整段背出来、自然引用一两句就好
          const lyr = cur.neteaseId && songLyricsRef.current[cur.neteaseId];
          if (lyr && lyr.trim()) lines.push("【这首歌的歌词（你听得到、记得住，聊到时可自然接一两句/被某句打动，别整首背出来）】\n" + lyr.trim());
        }
      }
      // 一起听过的歌 → 记忆。带粗时间（v54.49 她点头）：不带的话上个月的歌和昨晚的歌
      // 在 TA 眼里一样近，会把旧歌当刚听过的聊
      const ago = ts => { if (!ts) return ""; const d = Math.floor((Date.now() - ts) / 86400000); return d <= 0 ? "（今天）" : d === 1 ? "（昨天）" : d <= 30 ? "（" + d + "天前）" : "（一个多月前）"; };
      const hist = L.history || [];
      const together = hist.filter(x => x.partnerId === char.id).slice(0, 8);
      if (together.length) lines.push("你和 " + uName + " 一起听过：" + together.map(x => "《" + x.title + "》" + (x.artist ? "(" + x.artist + ")" : "") + ago(x.ts)).join("、") + "（按括号里的时间感受远近：昨晚的歌可以像余温一样提，一个月前的就是回忆了）");
      // 专属歌单连歌名一起喂（v54.49）：只喂名字他没法说「我歌单里那首X」
      const myPl = (L.playlists || []).find(p => p.charId === char.id);
      if (myPl) lines.push("你自己整理过一张歌单「" + myPl.name + "」，是你爱听的那些" + ((myPl.songs || []).length ? "，里面有：" + (myPl.songs || []).slice(0, 8).map(s => "《" + s.title + "》").join("、") + ((myPl.songs || []).length > 8 ? " 等" : "") + "。聊到音乐品味、想推歌给 " + uName + " 时可自然提起其中某首。" : "。"));
      return lines.join("\n");
    })(),
    groupEcho: (groups || []).filter(g => gsFor(g.id).memoryInterop && (g.memberIds || []).includes(char.id)).map(g => {
      const msgs = (groupChatsRef.current[g.id] || []).filter(m => m && m.kind !== "ooc" && m.role !== "system" && contextAllowsMessage(m) && String(m.content || "").trim());
      if (!msgs.length) return "";
      const others = (g.memberIds || []).filter(id => id !== char.id).map(id => { const c = characters.find(x => x.id === id); return c ? c.name : null; }).filter(Boolean);
      const lines = msgs.slice(-14).map(m => "[" + fmtStampAI(m.ts) + "] " + (m.role === "narration" ? "【旁白】" : (m.role === "user" ? (profile.name || "用户") : (m.senderName || "某人")) + "：") + String(m.content).replace(/\s+/g, " ").slice(0, 60) + ((m.role === "user" || m.role === "narration") && window.TemporalAnchor ? " " + window.TemporalAnchor.anchor(m.content, m.ts) : "")).join("\n");
      return "『群「" + g.name + "」" + (others.length ? "（群里还有 " + others.join("、") + "）" : "") + " 最近聊的（带时间，和你俩私聊按真实先后顺序理解）』\n" + lines;
    }).filter(Boolean).slice(0, 2).join("\n\n"),
    // 群线下回显（v50.66）：这个角色参加过的群线下(大家面对面)最近片段，带时间戳，让单聊接得上"刚一起线下相处过"。
    //   只互通群 + 该角色在场；群线下是共同经历、非私密，无需 own-scope 遮蔽。
    groupOfflineEcho: (groups || []).filter(g => gsFor(g.id).memoryInterop && (g.memberIds || []).includes(char.id)).map(g => {
      const crossMs = (memCfgRef.current.crossHours || 72) * 3600000;
      const cutoff = Date.now() - crossMs;
      const msgs = [];
      (groupOfflinesRef.current[g.id] || []).forEach(s => ((s && s.msgs) || []).forEach(m => { if (m && m.kind !== "ooc" && m.content && m.role !== "system" && (m.ts || 0) >= cutoff) msgs.push(m); }));
      if (!msgs.length) return "";
      msgs.sort((a, b) => (a.ts || 0) - (b.ts || 0));
      const others = (g.memberIds || []).filter(id => id !== char.id).map(id => { const c = characters.find(x => x.id === id); return c ? c.name : null; }).filter(Boolean);
      // 字符预算封顶（走 crossBudget 拉条）：从近往回收
      const budget = memCfgRef.current.crossBudget || 800; const picked = []; let used = 0;
      for (let i = msgs.length - 1; i >= 0; i--) { const m = msgs[i]; const ln = "[" + fmtStampAI(m.ts) + "] " + (m.role === "narration" ? "【场景】" : (m.role === "user" ? (profile.name || "用户") : (m.senderName || "某人")) + "：") + String(m.content).replace(/\s+/g, " ").slice(0, 70); if (used + ln.length > budget && picked.length) break; used += ln.length + 1; picked.push(ln); }
      return "『群「" + g.name + "」多人线下" + (others.length ? "（在场还有 " + others.join("、") + "）" : "") + "』\n" + picked.reverse().join("\n");
    }).filter(Boolean).slice(0, 2).join("\n\n"),
    // 单人线上 + 正在进行的单人线下，是同一条按真实时间排序的临时上下文。
    // 只在生成 prompt 时合流，不互相写入存档；已结束线下仍由 offlinelog/记忆承接。
    // engineerEyes 保持专线，不参与这套普通角色合流。
    recentChat: (() => {
      const online = (chatsRef.current[char.id] || [])
        .filter(m => !m.recalled && m.content && !isOocMsg(m) && contextAllowsMessage(m))
        .map(m => ({ ...m, _surface: "online" }));
      let offline = [];
      if (!settingsFor(char.id).engineerEyes) {
        let list = offlinesRef.current[char.id];
        if (!list) { list = loadJSON("x_offline:" + char.id, []); offlinesRef.current = { ...offlinesRef.current, [char.id]: list }; }
        const active = (list || []).find(s => s && !s.endTs && (s.msgs || []).length > 0);
        offline = active ? (active.msgs || [])
          .filter(m => m && m.content && m.kind !== "ooc" && m.role !== "system")
          .map(m => ({ ...m, role: m.role === "char" ? "assistant" : m.role, _surface: "offline" })) : [];
      }
      const ctxN = Math.max(0, Number(settingsFor(char.id).ctxN ?? 50));
      if (!ctxN) return "";
      // ⚠️ctxN 是【聊天记录带几条】，不该被线下拍子占掉名额：以前 online.concat(offline) 之后
      // 才切最近 ctxN 条，开着一场四十拍的线下时，五十个名额几乎全被线下占走，实测线上只剩
      // 195 字进得来。所以两边【各自】先切，再按时间戳合流。
      const OFF_BEATS = 12; // 线下最多带这么多拍进来（再往前由本场滚动摘要和记忆库兜底）
      const all = online.slice(-ctxN).concat(offline.slice(-OFF_BEATS)).sort((a, b) => (a.ts || 0) - (b.ts || 0));
      if (!all.length) return "";
      const wantStart = 0;
      const lines = [];
      const uName = profile.name || "用户";
      const budget = memCfgRef.current.recentBudget || 8000; // 字符预算(召回设置可调)：从最近往回收，攒够就停（老而仍在窗内的事由自动抽取+摘要兜底）
      // 她 2026-08-28：「跑了很多长线下，一堆没用的描写占着字数，本来可以带更多密度的聊天记录都被描写占满了」。
      // 实测（8000 字预算、线下一拍 300 字）：线下拿走 6120 字，线上只剩 635 字——九成预算给了描写；
      // 沉浸长文一拍 800 字时，整个窗口只装得下 19 条，ctxN 那个 50 根本到不了。
      // 病根是两种密度完全不同的东西按同一种货币（字符）抢同一份预算：一拍线下描写和一条 13 字的
      // 气泡，带进来的「发生了什么」差不多，占的字数差二十几倍。
      // 两条闸：① 线下单独限额，最多拿走三成、封顶 3000 字，拿不完的还给线上；
      //        ② 只有最近三拍给原文（衔接靠逐字），更早的压成摘录——有对话取对话，没有就取句首。
      const OFF_VERBATIM = 3, OFF_EXCERPT = 70;
      const offCap = Math.min(Math.round(budget * 0.3), 3000);
      const offlineBeatDigest = text => {
        const t = String(text || "").replace(/\s+/g, " ").trim();
        const quoted = (t.match(/[「“][^」”]{2,}[」”]/g) || []).map(x => x.slice(1, -1));
        // 有对话就留「这一拍谁做了什么」+ 说的话；没有对话就退回句首——
        // 动作和决定基本都在句首，环境和感官在句尾，砍尾巴比砍头亏得少。
        let core = t;
        if (quoted.length) {
          const q = t.indexOf(t.match(/[「“]/)[0]);
          const head = t.slice(0, Math.min(q, 26)).replace(/[，。、；：]$/, "");
          core = (head ? head + "：" : "") + quoted.join("／");
        }
        return core.length > OFF_EXCERPT ? core.slice(0, OFF_EXCERPT) + "…" : core;
      };
      let used = 0, usedOff = 0, offSeen = 0;
      for (let i = all.length - 1; i >= wantStart && i >= 0; i--) {
        const m = all[i];
        const isOff = m._surface === "offline";
        // 只数他的拍子：她自己在线下打的字本来就短，不该占掉「最近三拍给原文」的名额
        if (isOff && m.role !== "user") offSeen++;
        const dateAnchor = m.role === "user" && window.TemporalAnchor ? window.TemporalAnchor.anchor(m.content, m.ts) : "";
        const speaker = m.role === "user" ? uName : (m.role === "narration" ? "【线下场景】" : char.name);
        // 线下的老拍子压成摘录；她自己在线下打的字很短，照原文走
        const body = (isOff && m.role !== "user" && offSeen > OFF_VERBATIM) ? offlineBeatDigest(m.content) : m.content;
        const line = speaker + ": " + body + (dateAnchor ? " " + dateAnchor : "");
        const cost = line.length + 1;
        if (isOff && usedOff && usedOff + cost > offCap) continue; // 线下超了自己那份就跳过，但继续往回找线上的
        if (used + cost > budget && lines.length) break;           // 总预算仍以召回设置那根拉条为准
        used += cost;
        if (isOff) usedOff += cost;
        lines.push(line);
      }
      return lines.reverse().join("\n");
    })()
  });
  // 后台保活已并进「一起听」：播放里那首「静音保活」曲目即占住 iOS 音频会话（见 playSong 的 keepalive 分支）。
  // 单聊主动统一走下面的全局巡检：不要求打开 TA 的聊天，并由 pChat 在别处正常挂未读。
  // 旧的 thread-only 20 秒定时器已删除，避免和积温主动抢跑/双发。
  // ---- 群聊自发（她 2026-07-23）：开了「记忆互通」的群闲置到间隔，成员自己顺着往下聊——
  //   不必 cue 你、互相接话/抬杠也行。replyGroup 空输入本就会自发续聊（喂「请群成员顺着上面的对话自然继续聊」）。
  //   不要求你正盯着那个群：App 还活着时可在别的页面生成，pGChat 会正常挂群未读；iOS 杀进程后仍需未来的云端任务。
  //   防跑飞：自主生成到上限就歇；到顶后过 X 小时自动续杯，你发消息 或 按黑色回复键也会立即续杯。
  const autoChatRoundsRef = useRef({}); // 每群：距上次你开口/按回复键以来，已自主生成了几轮
  const autoChatMsgsRef = useRef({});   // 每群：这一段自发累计已生成多少条（总条数上限用，跨轮累加、递减预算）
  // 额度卡只存在本机：刷新/重开 App 不会绕过上限，但不进入 x_ 云存档，不碰聊天与记忆路径。
  const autoChatCycleRef = useRef(null);
  if (!autoChatCycleRef.current) {
    try { autoChatCycleRef.current = JSON.parse(localStorage.getItem("lisa_group_auto_cycle_v1") || "{}"); }
    catch (e) { autoChatCycleRef.current = {}; }
  }
  const writeAutoChatCycle = (gid, cycle) => {
    const next = { ...(autoChatCycleRef.current || {}), [gid]: cycle };
    autoChatCycleRef.current = next;
    try { localStorage.setItem("lisa_group_auto_cycle_v1", JSON.stringify(next)); } catch (e) {}
    autoChatRoundsRef.current[gid] = cycle.rounds || 0;
    autoChatMsgsRef.current[gid] = cycle.msgs || 0;
    return cycle;
  };
  // kicked＝这张额度卡是她【亲手按黑色回复键／让他们继续】开出来的（v56.73）。
  // 带着这个标记时，本段的第一轮自发不再等谁动念——她已经明说了要他们聊。
  // 她自己发言开出来的卡不带这个标记：那是正常说话，起聊仍旧由人格驱动。
  const resetAutoChatCycle = (gid, lastUserTs, kicked) => writeAutoChatCycle(gid, {
    rounds: 0, msgs: 0, cappedAt: 0, resetAt: 0, kicked: !!kicked,
    lastUserTs: Number(lastUserTs) || Number((autoChatCycleRef.current[gid] || {}).lastUserTs) || 0
  });
  const addAutoChatMessages = (gid, count) => {
    const old = (autoChatCycleRef.current && autoChatCycleRef.current[gid]) || {};
    writeAutoChatCycle(gid, { ...old, rounds: Number(old.rounds) || 0, msgs: (Number(old.msgs) || 0) + Math.max(0, Number(count) || 0) });
  };
  useEffect(() => {
    const scanAutoGroups = () => {
      // 一次巡检最多叫起一个群，避免多个群同秒并发烧调用；下一次巡检自然轮到其余满足条件的群。
      for (const group of groups) {
        const gid = group.id;
        const gs = gsFor(gid);
        if (!gs.memoryInterop || gs.autoChat === false) continue;
        if (laneBusy("g:" + gid)) continue;
        if (offlineGroup && offlineGroup.id === gid) continue;
        const msgs = (groupChatsRef.current[gid] || []).filter(m => m && !m.recalled && m.kind !== "ooc" && m.kind !== "system" && contextAllowsMessage(m));
        if (!msgs.length) continue;
        const last = msgs[msgs.length - 1];
        let cycle = (autoChatCycleRef.current && autoChatCycleRef.current[gid]) || {
          rounds: autoChatRoundsRef.current[gid] || 0, msgs: autoChatMsgsRef.current[gid] || 0,
          cappedAt: 0, resetAt: 0, lastUserTs: 0
        };
        // 只对一条新的用户消息续杯一次；否则 20 秒定时器会反复写本地盘。
        if (last.role === "user" && (Number(last.ts) || 0) > (Number(cycle.lastUserTs) || 0)) cycle = resetAutoChatCycle(gid, last.ts);
        const now = Date.now();
        // 到顶后的冷却已经走完：自动开一张新额度卡。
        if (cycle.resetAt && now >= cycle.resetAt) cycle = resetAutoChatCycle(gid, cycle.lastUserTs);
        const rounds = Number(cycle.rounds) || 0;
        const msgsSoFar = Number(cycle.msgs) || 0;
        const roundCap = Math.max(1, gs.autoChatRounds || 5);
        const totalCap = Math.max(1, gs.autoChatMaxMsg || 50);
        if (rounds >= roundCap || msgsSoFar >= totalCap) {
          // 冷却从【真正达到上限】这一刻才起算；设置改变后第一次巡检会补记这一刻。
          if (!cycle.resetAt) {
            const resetHours = Math.max(1, Number(gs.autoChatResetHours) || 24);
            cycle = writeAutoChatCycle(gid, { ...cycle, cappedAt: now, resetAt: now + resetHours * 3600000 });
          }
          continue;
        }
        const mins = Math.max(1, gs.autoChatMin || 8);
        // 抖动【绕着】她设的那个数走（0.8~1.2×），不是一律往后拖（v56.72）。
        // 以前是 1~1.5×：设 3 分钟，实际 3~4.5 分钟、平均 3.75，每一次都比她看到的数字晚
        //（她 2026-08-27 掐着表：「过了三分钟没有」）。现在 3 分钟就是 2.4~3.6，那个数字是平均值。
        const gap = mins * 60000 * (0.8 + Math.random() * 0.4);
        if (now - (last.ts || 0) < gap) continue;
        const gm = (group.memberIds || []).map(id => characters.find(c => c.id === id)).filter(Boolean);
        if (!gm.length) continue;
        // ⭐人格/欲望只驱动【起聊】那一下（v56.64，她 2026-08-27：「主动发了一轮就不继续了，
        // 都没到设定的最大轮数」）。以前每一轮都要求有人此刻正想找她——可认领动念的同时会给
        // 本人记 25 分钟冷却、还泄掉 0.28 的 connection，而自发间隔默认才 8 分钟：
        // 第二轮永远等不到人，轮数上限设成几都只发一轮。
        // 后面几轮是【同一场对话在往下接】，本来就不该再要一份新的思念——刹车交给
        // 轮数上限、总条数上限和闲置间隔，那三样才是她在设置里调的东西。
        let urgeChars = [];
        if (rounds === 0 && !cycle.kicked) {
          let anyJiwen = false;
          gm.forEach(c => {
            const jw = typeof window !== "undefined" && window.__jiwen && window.__jiwen[c.id];
            if (!jw) return;
            anyJiwen = true;
            // 同一份思念只能被一个出口认领；群聊认领后 25 分钟内，单聊巡检不会再拿旧快照重复发。
            if (jw.triggers && jw.triggers.some(tr => tr.action === "contact") && now - (jiwenFiredRef.current[c.id] || 0) >= 25 * 60000) urgeChars.push(c);
          });
          if (anyJiwen && !urgeChars.length) continue;
          urgeChars.forEach(c => {
            jiwenFiredRef.current[c.id] = now;
            try { const eng = getJiwen(c); if (eng) eng.applyDelta({ connection: -0.28 }); } catch (e) {}
          });
        }
        // kicked 只管这一段的第一轮：发过就消掉，别让它跨过下一次额度刷新还赖着
        cycle = writeAutoChatCycle(gid, { ...cycle, rounds: rounds + 1, msgs: msgsSoFar, cappedAt: 0, resetAt: 0, kicked: false });
        replyGroup(gid, { auto: true, msgBudget: totalCap - msgsSoFar, urgeCharIds: urgeChars.map(c => c.id) });
        break;
      }
    };
    const timer = setInterval(scanAutoGroups, 20000);
    // 等积温首算完，先让群聊拿一次思念出口机会；单聊全局巡检会再晚三秒。
    const kick = setTimeout(scanAutoGroups, 11000);
    return () => { clearTimeout(kick); clearInterval(timer); };
  }, [groups, groupSettings, sending, offlineGroup]);
  // ---- 群线下 jiwen 驱动自发（她 2026-07-23）：开着群线下浮层、闲置、群里有成员此刻「想动/想聊」(jiwen contact 触发)，
  //   成员就自己往下演一拍（groupOfflineReply 空输入=自主续演）。没成员载 jiwen 就不自动（她手动「让他们演绎」）。
  //   防跑飞：距你最后一句自发≥12拍就歇；泄一点思念别连发；只前台浮层开着时跑。
  useEffect(() => {
    if (!offlineGroup) return;
    const gid = offlineGroup.id;
    const timer = setInterval(() => {
      if (laneBusy("g:" + gid)) return;
      const sess = (groupOfflinesRef.current[gid] || []).find(s => s && !s.endTs);
      if (!sess || !(sess.msgs || []).length) return;
      let sinceUser = 0; for (let i = sess.msgs.length - 1; i >= 0; i--) { if (sess.msgs[i].role === "user") break; sinceUser++; }
      if (sinceUser >= 12) return;
      const gmm = (offlineGroup.memberIds || []).map(id => characters.find(c => c.id === id)).filter(Boolean);
      let anyJiwen = false; const urge = [];
      gmm.forEach(c => { const jw = typeof window !== "undefined" && window.__jiwen && window.__jiwen[c.id]; if (jw) { anyJiwen = true; if (jw.triggers && jw.triggers.some(tr => tr.action === "contact")) urge.push(c); } });
      if (!anyJiwen || !urge.length) return; // 没 jiwen 或 此刻没人动念 → 不自发（手动演绎照旧）
      const lastTs = sess.msgs[sess.msgs.length - 1].ts || 0;
      if (Date.now() - lastTs < 150000 * (1 + Math.random() * 0.5)) return; // 闲置约 2.5~3.75 分钟才推进一拍
      urge.forEach(c => { try { const eng = getJiwen(c); if (eng) eng.applyDelta({ connection: -0.2 }); } catch (e) {} }); // 泄一点，别下tick又触发
      groupOfflineReply(gid);
    }, 20000);
    return () => clearInterval(timer);
  }, [offlineGroup, chatSettings, sending]);
  // ---- 默认进线下（她 2026-07-23，方便同居/常在一起的角色：默认基本上都在一起）----
  // 点进开了「默认进线下」的单聊，直接进线下相处；随时可「离开」跳回线上。只在【进入这个聊天】那一下
  // 触发一次——跳回线上后不再自动弹（尊重你主动离开）；下次从列表重新进这个聊天才会再默认开。
  const autoOfflineRef = useRef(null);
  useEffect(() => {
    if (screen !== "thread" || !activeChar) { autoOfflineRef.current = null; return; }
    const cid = activeChar.id;
    if (autoOfflineRef.current === cid) return;
    autoOfflineRef.current = cid;
    if (!settingsFor(cid).defaultOffline) return;
    if (offlineChar || offlineGroup) return;
    const list = offlinesRef.current[cid] || loadJSON("x_offline:" + cid, []);
    const hasActive = (list || []).some(s => s && !s.endTs);
    openOffline(activeChar);
    if (!hasActive) startOffline(cid, {});
  }, [screen, activeChar]);
  // ---- 群「默认进线下」（她 2026-07-23，同处一室/常聚的群）：点进开了的群，直接进群线下；随时离开跳回线上。同单聊，进入触发一次。----
  const autoGOfflineRef = useRef(null);
  useEffect(() => {
    if (screen !== "gthread" || !activeGroup) { autoGOfflineRef.current = null; return; }
    const gid = activeGroup.id;
    if (autoGOfflineRef.current === gid) return;
    autoGOfflineRef.current = gid;
    if (!gsFor(gid).defaultOffline) return;
    if (offlineChar || offlineGroup) return;
    const list = groupOfflinesRef.current[gid] || loadJSON("x_goffline:" + gid, []);
    const hasActive = (list || []).some(s => s && !s.endTs);
    openGroupOffline(activeGroup);
    if (!hasActive) startGroupOffline(gid, {});
  }, [screen, activeGroup]);
  // ---- 角色主动早晚安：扫所有【在聊的】角色，到各自作息的早/晚，主动发一句问候，落成未读红点，你随缘回 ----
  // 只在 app 打开时跑（静态站无后台推送）；一次只发一个错峰；一天早/晚各一次；刚聊完/正在看的不打扰。
  // 角色当地"此刻几点几分"（分钟数）——按 tz 偏移，无 tz 用设备本地
  const charLocalMin = char => {
    const raw = char && char.tz;
    if (raw !== undefined && raw !== null && String(raw).trim() !== "") { const off = parseFloat(raw); if (!isNaN(off)) { const d = new Date(Date.now() + off * 3600000); return d.getUTCHours() * 60 + d.getUTCMinutes(); } }
    const d = new Date(); return d.getHours() * 60 + d.getMinutes();
  };
  useEffect(() => {
    const hist = c => (chatsRef.current[c.id] || []).filter(m => !m.recalled && m.kind !== "ooc" && m.kind !== "system" && contextAllowsMessage(m));
    const tick = () => {
      if (!active) return;
      const dayKey = schedDayKey(new Date());
      // —— 生日主动祝福：今天是用户生日 → 能看到你日历、真在聊的角色主动祝一次（每年每人一次，只白天发）——
      const ubd = parseMonthDay((profileRef.current || {}).birthday);
      const nowD = new Date();
      if (ubd && ubd.mo === nowD.getMonth() + 1 && ubd.d === nowD.getDate()) {
        const year = String(nowD.getFullYear());
        const vis = (periodRef.current && periodRef.current.visibleTo) || [];
        for (const c of characters) {
          const cid = c.id;
          if (!vis.includes(cid)) continue;                          // 只有你允许看日历的角色才知道你生日
          if (laneBusy("c:" + cid)) continue;
          if (viewRef.current.charId === cid) continue;              // 正在看这个聊天就不用主动
          if (hist(c).length < 2) continue;                          // 真在聊的
          if ((greetLogRef.current[cid] || {}).b === year) continue; // 今年已祝过
          const hr = Math.floor(charLocalMin(c) / 60);
          if (hr < 8 || hr > 23) continue;                           // 别半夜发
          window.DeliveryCommit.once("birthday:" + year,
            () => replyNow(cid, "", null, { proactive: true, bday: true }),
            () => markGreet(cid, "b", year)
          );
          return;                                                    // 一次一个，错峰
        }
      }
      // —— 备忘录·到期提醒主动：今天到期(未完成)、且有可见角色在聊 → 其中一位主动提醒一次（每条每天一次）——
      try {
        const memo = loadJSON("x_memo", null);
        if (memo && Array.isArray(memo.reminders) && typeof window.memoNextDays === "function") {
          const rlog = loadJSON("x_memoRemindLog", {});
          for (const r of memo.reminders) {
            if (r.done || !(r.visibleTo || []).length) continue;
            const nd = window.memoNextDays(r);
            let overdue = 0;
            if (nd === 0) { if (rlog[r.id] === dayKey) continue; }                            // 到期当天提醒（每天一次）
            else if (nd != null && nd <= -3) { if (rlog[r.id + ":od"]) continue; overdue = -nd; } // 拖了3天还没勾 → 催一次（一条一生只催一回）
            else continue;
            const cand = characters.find(c => r.visibleTo.includes(c.id) && hist(c).length >= 2 && viewRef.current.charId !== c.id && !laneBusy("c:" + c.id));
            if (!cand) continue;
            const hr = Math.floor(charLocalMin(cand) / 60); if (hr < 8 || hr > 23) continue;
            const remindLogKey = overdue ? r.id + ":od" : r.id;
            window.DeliveryCommit.once("reminder:" + dayKey,
              () => replyNow(cand.id, "", null, { proactive: true, remind: { title: r.title, note: r.note || "", overdue } }),
              () => {
                const latestLog = loadJSON("x_memoRemindLog", {});
                latestLog[remindLogKey] = dayKey;
                saveJSON("x_memoRemindLog", latestLog);
              }
            );
            return;                                               // 一次一个，错峰
          }
        }
      } catch (e) {}
      // —— 驻场工程师·仪表盘报警（v48.30）：开了「眼睛」的角色发现新报错攒了 2 条+、或存储 ≥85% → 主动跟你念叨。
      //    每人每天最多一次；报错基线记 ts（念叨过的旧错不再重复念）。app 开着才有报错=用户在场，不做时段限制。——
      try {
        const eLog = loadJSON("x_eyesAlertLog", {});
        const errsAll = window.__errLog || [];
        const stPct = Math.round((typeof localStorageBytes === "function" ? localStorageBytes() : 0) / (5 * 1024 * 1024) * 100);
        for (const c of characters) {
          const cid = c.id;
          if (!settingsFor(cid).engineerEyes) continue;
          if (laneBusy("c:" + cid) || viewRef.current.charId === cid) continue;
          if (hist(c).length < 2) continue;
          const st = eLog[cid] || {};
          if (st.day === dayKey) continue;
          const newErrs = errsAll.filter(e2 => e2.ts > (st.errTs || 0));
          const storageHigh = stPct >= 85 && st.stDay !== dayKey;
          if (newErrs.length < 2 && !storageHigh) continue;
          window.DeliveryCommit.once(
            "eyes:" + dayKey,
            () => replyNow(cid, "", null, { proactive: true, eyesAlert: { errs: newErrs.slice(-3).map(e2 => e2.msg), pct: storageHigh ? stPct : 0 } }),
            () => {
              const latestLog = loadJSON("x_eyesAlertLog", {});
              const latestState = latestLog[cid] || {};
              latestLog[cid] = {
                day: dayKey,
                errTs: errsAll.length ? errsAll[errsAll.length - 1].ts : (latestState.errTs || 0),
                stDay: storageHigh ? dayKey : latestState.stDay
              };
              saveJSON("x_eyesAlertLog", latestLog);
            }
          );
          return; // 一次一个，错峰
        }
      } catch (e) {}
      // —— 特殊天气主动：TA 那边雨/雪/雷雾/极端温度 → 一位在聊的角色主动发条被天气牵动的消息（全局每天最多一条，读天气缓存零请求）——
      try {
        if (loadJSON("x_wxReactDay", "") !== dayKey && typeof wxSpecial === "function") {
          const wpool = liveChars.filter(c => hist(c).length >= 2);
          const wrot = wpool.length ? Math.floor(Date.now() / 86400000) % wpool.length : 0;
          const _prefs = loadJSON("x_prefs", {});
          const _geo = _prefs.geoAware ? loadJSON("x_geo", null) : null;
          for (const c of wpool.slice(wrot).concat(wpool.slice(0, wrot))) {
            if (laneBusy("c:" + c.id) || viewRef.current.charId === c.id) continue;
            const hr = Math.floor(charLocalMin(c) / 60); if (hr < 8 || hr > 23) continue;
            const hm = c.home && typeof c.home.lat === "number" ? c.home : (_geo && typeof _geo.lat === "number" ? _geo : null);
            const w = hm ? weatherCached(hm.lat, hm.lng) : null;
            const sp = wxSpecial(w);
            if (!sp) continue;
            window.DeliveryCommit.once(
              "weather:" + dayKey,
              () => replyNow(c.id, "", null, { proactive: true, wx: { kind: sp, line: weatherLine(w) } }),
              () => saveJSON("x_wxReactDay", dayKey)
            );
            return;                                             // 一次一个，错峰
          }
        }
      } catch (e) {}
      // —— 交换日记到期回页：TA 三天内挑个时候写回页（一次一页错峰；只在白天写；失败退避在生成函数里）——
      try {
        const cps = loadJSON("x_couples", {});
        const hrNow = new Date().getHours();
        if (hrNow >= 8 && hrNow <= 23) {
          for (const pg of coupleExDiaryRef.current || []) {
            if (!pg || pg.author !== "user" || pg.replied || !pg.dueTs || Date.now() < pg.dueTs) continue;
            if (!cps[pg.characterId] || cps[pg.characterId].status !== "together") continue;
            if (exDiaryGenRef.current[pg.id]) continue;
            genExDiaryReply(pg.characterId, pg.id);
            break;                                            // 一次一页
          }
        }
      } catch (e) {}
      // —— 主动发消息·主屏也能收到（v48.39，她报：原来只有点进聊天框才触发）——
      // 设了「允许 Ta 主动发消息」的角色，闲置超过设定间隔 → 在主屏/任意页也主动发一条，落成未读红点，你随缘点进去看。
      // viewRef 命中「正在看这个聊天/线下浮层开着这个角色」时跳过（那种由前台 20s 定时器即时负责，避免双发）；
      // 按角色当地作息只在 8~23 点发，别半夜 ping。一次一个错峰。
      // ── 约回（v56.49）：他亲口说过「等我 xxx 再找你」，到点就发 ──
      // 排在积温前面，而且【不看积温、不看 45 分钟底线】——那是「攒够思念才开口」的门槛，
      // 这条是他自己许下的约，性质不一样。也不看时段：app 不开就不会跑，能跑说明她醒着。
      // 她那段时间没开 app → 这条一直欠着，下次开 app 补上（她 2026-08-26 明说要这样）。
      try {
        const due = (promisesRef.current || []).filter(x => x && x.dueTs && Date.now() >= x.dueTs);
        for (const pm of due) {
          const c = liveChars.find(x => x.id === pm.charId);
          const drop = () => setPromises(p => { const n = p.filter(x => x.id !== pm.id); promisesRef.current = n; saveJSON("x_promises", n); return n; });
          if (!c) { drop(); continue; }                       // 角色没了，约也没了
          if (!settingsFor(pm.charId).proactive) { drop(); continue; }
          if (laneBusy("c:" + pm.charId)) continue;           // 正在生成，下一轮再说
          if (currentlyTogetherWithChar(pm.charId)) continue; // 人就在旁边，不用发消息
          if (viewRef.current.charId === pm.charId) continue; // 她正看着这个聊天，前台那套负责
          drop();
          jiwenFiredRef.current[pm.charId] = Date.now();      // 刚发过，别让积温紧跟着再来一条
          const late = Math.round((Date.now() - pm.dueTs) / 60000);
          // 约回的时间戳补到【说好的那一刻】：她开 app 时看到的是「他当时就来找过你」
          replyNow(pm.charId, "", null, { proactive: true, promise: { about: pm.about, lateMin: late },
            backdateTs: pm.dueTs < Date.now() - 60000 ? pm.dueTs : 0 });
          return;                                             // 一次一个，错峰
        }
      } catch (e) {}
      try {
        for (const c of characters) {
          const cid = c.id;
          const s = settingsFor(cid);
          if (!s.proactive) continue;
          if (laneBusy("c:" + cid)) continue;
          if (currentlyTogetherWithChar(cid)) continue;
          // 有没有一场进行中的线下（同居/常在一起）。有【正在演的场景】→ 把「思念攒够→主动」落成【线下一拍】而不是线上消息（她 2026-07-23）。
          const _offL = offlinesRef.current[cid] || [];
          // 常驻线下(同居=一直在一起)：只要有进行中的场景就把主动落成线下一拍，不看远近；非常驻：只有此刻真面对面(近)才线下，挂着已散→线上
          const activeOff = settingsFor(cid).defaultOffline
            ? (offlinesRef.current[cid] || []).find(s => s && !s.endTs && (s.msgs || []).length)
            : offlineTogetherSess(cid);
          const activeOffScene = activeOff && (activeOff.msgs || []).length > 0 ? activeOff : null;
          // 线上路径：正在看这个聊天就不发；线下路径（有场景）：她看着/离开都能自己动（她要"从线上变线下"）。
          if (!activeOffScene && viewRef.current.charId === cid) continue;
          if (activeOff && !activeOffScene) continue; // 线下开着但还没开演：不发线上、也没得演，跳过
          const ms = (chatsRef.current[cid] || []).filter(m => !m.recalled && m.kind !== "ooc" && m.kind !== "system" && contextAllowsMessage(m));
          if (!activeOffScene && !ms.length) continue;
          // ⭐jiwen 阶段二（v48.80/81）：有 jiwen 就【由心理动机决定开口】——思念漂到 contact 阈值才主动，时机全交给它（线上线下同一套门槛）；
          //   固定间隔滑块已去掉(v48.81 她点名)，这里只留防刷屏底线：有 jiwen=45min 底线(真时机 jiwen 说了算)，没 jiwen(引擎没载)兜底 3h。
          const jw = (typeof window !== "undefined" && window.__jiwen && window.__jiwen[cid]) || null;
          const floorMin = jw ? 45 : 180;
          const offMsgs = activeOffScene ? (activeOffScene.msgs || []) : [];
          const lastInteract = Math.max(ms.length ? (ms[ms.length - 1].ts || 0) : 0, latestSharedInteractionTs(cid), offMsgs.length ? (offMsgs[offMsgs.length - 1].ts || 0) : 0);
          if (Date.now() - lastInteract < floorMin * 60000) continue;
          if (jw && jw.triggers && !jw.triggers.some(t => t.action === "contact")) continue; // jiwen 说「还没想到要联系」→ 不动
          if (Date.now() - (jiwenFiredRef.current[cid] || 0) < 25 * 60000) continue;
          // 醒着就发；睡着时只留一条窄缝：思念真的很重（forced 触发）才有 12% 概率半夜发一句。
          // 她要的就是这个——「偶尔要是半夜突然想念了也能发一句」，但别变成半夜刷屏。
          if (charAwakeState(c) === "asleep") {
            const forced = jw && jw.triggers && jw.triggers.some(t => t.action === "contact" && t.forced);
            if (!forced || Math.random() > 0.12) continue;
          }
          jiwenFiredRef.current[cid] = Date.now();
          let jwStyle = "";
          try { const eng = getJiwen(c); if (eng && jw) { jwStyle = (eng.getStyleGuidance() + "\n" + eng.getPromptContext()).trim(); eng.applyDelta({ connection: -0.28 }); } } catch (e) {} // 注入当前五轴语气 + 发完泄一点思念(别下一tick又触发)
          // 这条消息真正「想发」的时刻：越过阈值那一刻。夹在【上次互动之后】和【一分钟前】之间，
          // 免得排到历史里去、或者干脆写成未来。
          const _cross = jiwenCrossedRef.current[cid] || 0;
          const _back = _cross ? Math.max(lastInteract + 60000, Math.min(_cross, Date.now() - 60000)) : 0;
          jiwenCrossedRef.current[cid] = 0;
          if (activeOffScene) offlineReply(cid);                                 // 思念攒够 → 线下自己动一拍
          else replyNow(cid, "", null, { proactive: true, jiwen: jwStyle, backdateTs: _back > 0 && _back < Date.now() ? _back : 0 });
          return; // 一次一个，错峰（本轮不再顺带问候，下一轮 tick 再说）
        }
      } catch (e) {}
      // 定时早晚安已于 v54.77 整块下线（她 2026-08-22：「早安晚安也停了吧，就留真正挂念的时候发」）。
      // 打卡式问候本来就压着上面那套积温：到点必发、跟心情无关，久了就成了背景噪音。
      // 现在角色主动开口只剩两个理由：真攒够思念（积温，就在上面）、以及你生日。
    };
    // 等积温 8 秒首算和群聊 11 秒认领机会走完，再决定是否落到单聊；否则单聊会永远抢先吃掉 contact。
    const kick = setTimeout(tick, 14000);
    const timer = setInterval(tick, 45000);
    return () => { clearTimeout(kick); clearInterval(timer); };
  }, [characters, active]);
  // ── 积温·活人感引擎（jiwen，v48.47 阶段一：引擎+接线）──
  // 五轴连续状态随时间漂移（思念/傲娇/愉悦/唤醒/沉浸），到阈值产生「想联系」的触发。
  // ⚠️阶段一【只推进状态+观测，触发不真发消息】——结果 stash 到 window.__jiwen 供调参；阶段二再放开去驱动主动消息。
  const jiwenRef = useRef({});          // charId -> 引擎实例（缓存，保住闭包内 valence 边际递减记录）
  const jiwenTickRef = useRef({});      // charId -> 上次 tick 毫秒
  // charId -> 上次已知用户最新消息 ts（对方回话→思念清零）。
  // ⚠️必须持久化（v56.51）：原来是个纯内存 ref，每次开 app 都是空的 → 第一次 tick 时
  // 「用户最新消息比记录的新」永远成立 → resetConnection() 把思念清零。于是她每隔一两小时
  // 开一次 app，积温就被清一次，永远到不了 0.35 的 contact 阈值——她 2026-08-26：
  // 「jiwen 也没用，主动消息绝对都开了的一个人没有」。开机从 x_jiwenSeen 读回来。
  const jiwenLastUserRef = useRef(null);
  const jiwenSeen = () => {
    if (!jiwenLastUserRef.current) jiwenLastUserRef.current = loadJSON("x_jiwenSeen", {}) || {};
    return jiwenLastUserRef.current;
  };
  const jiwenSeenSet = (cid, ts) => { const m = jiwenSeen(); m[cid] = ts; saveJSON("x_jiwenSeen", m); };
  const jiwenCrossedRef = useRef({});   // charId -> 思念越过 contact 阈值的那一刻（补记时算出来的，用来给消息补时间戳）
  const jiwenFiredRef = useRef({});     // charId -> 上次 jiwen 驱动主动消息的 ts（防同一轮心理动机反复触发刷屏，v48.80 阶段二）
  const getJiwen = char => {
    if (!char || typeof createJiwen !== "function") return null;
    if (jiwenRef.current[char.id]) return jiwenRef.current[char.id];
    const uName = (profile && profile.name) || "她";
    const eng = createJiwen({
      persona: { subjectName: uName, selfName: char.name, subjectPronoun: "ta" },
      getLastMessage: () => {
        const arr = chatsRef.current[char.id] || [];
        for (let i = arr.length - 1; i >= 0; i--) { const m = arr[i]; if (m && m.content && !m.recalled) return { id: m.ts || i, role: m.role, content: String(m.content), timestamp: new Date(m.ts || Date.now()).toISOString() }; }
        return null;
      },
      connectionRateFn: lastMsg => {
        if (!lastMsg) return 0.0007;
        const c = lastMsg.content || "";
        if (/晚安|睡了|去睡|睡觉/.test(c)) return 0.0003;          // 好好道过晚安 → 思念涨得慢
        if (/出门|上班|开会|上课|忙|有事/.test(c)) return 0.0005;   // 知道对方在忙 → 慢一点
        if (c.length < 8) return 0.0010;                          // 敷衍短句 → 涨得快
        return 0.0007;
      },
      onLoad: async () => { try { return (loadJSON("x_jiwen", {}) || {})[char.id] || null; } catch (e) { return null; } },
      onSave: async st => { try { const m = loadJSON("x_jiwen", {}) || {}; m[char.id] = st; saveJSON("x_jiwen", m); } catch (e) {} }
    });
    jiwenRef.current[char.id] = eng;
    return eng;
  };
  useEffect(() => {
    if (typeof createJiwen !== "function") return;
    window.__jiwen = window.__jiwen || {};
    const step = async () => {
      const now = Date.now();
      for (const char of characters) {
        const arr = chatsRef.current[char.id] || [];
        if (!arr.length) continue;                                // 没聊过的不跑
        const eng = getJiwen(char); if (!eng) continue;
        // 对方（用户）最新消息比上次记录的新 → 思念清零（闭环，不碰任何发送路径）
        let lastUserTs = latestUserSharedInteractionTs(char.id);
        for (let i = arr.length - 1; i >= 0; i--) { if (arr[i] && arr[i].role === "user") { lastUserTs = Math.max(lastUserTs, arr[i].ts || 0); break; } }
        const seenTs = jiwenSeen()[char.id] || 0;
        if (lastUserTs && lastUserTs > seenTs) {
          jiwenSeenSet(char.id, lastUserTs);
          // 首次见到这个角色（还没有记录）时不清零：那不是「她刚回话」，
          // 只是我们第一次认识这段历史。清了就等于每装一次 app 都从零开始。
          if (seenTs) { try { await eng.resetConnection(); } catch (e) {} }
        }
        // 推进：首跑从持久化的 lastTick 起算（credit 关 app 期间的时间，jiwen 内部封顶 60 分钟）
        let baseTs = jiwenTickRef.current[char.id];
        if (baseTs == null) { try { const s0 = await eng.getState(); baseTs = s0.lastTick ? new Date(s0.lastTick).getTime() : now; } catch (e) { baseTs = now; } }
        const mins = (now - baseTs) / 60000;
        jiwenTickRef.current[char.id] = now;
        try {
          let triggers;
          if (mins >= 0.2) {
            // 后台补记（v48.81，她点名）：eng.tick 单次内部封顶 60min，长时间关 app 会算不足→重开该想你也不想。
            //   按 60min 分块喂满真实离开时间，总量封顶 12h（防离开一周回来直接「崩溃级」思念，那样太粘）。
            let credit = Math.min(mins, 720);
            // 记下【思念是在哪一刻越过阈值的】：她 2026-08-26 说另一台小手机能看到
            // 「我没开 app 那段时间里发的消息」，时间戳落在那个空档里而不是全堆在打开这一刻。
            // 补记是按 60 分钟一块喂的，所以哪一块开始出现 contact，那一刻就是真正想联系的时间。
            let done = 0, crossed = null;
            do {
              const chunk = Math.min(credit, 60);
              triggers = await eng.tick(chunk); credit -= chunk; done += chunk;
              if (crossed == null && triggers && triggers.some(t => t.action === "contact")) crossed = baseTs + done * 60000;
            } while (credit > 0.2);
            if (crossed != null) jiwenCrossedRef.current[char.id] = crossed;
          } else triggers = eng.checkThresholds();
          window.__jiwen[char.id] = { name: char.name, summary: eng.getStateSummary(), triggers, state: await eng.getState() };
        } catch (e) {}
      }
    };
    const kick = setTimeout(step, 8000);
    const timer = setInterval(step, 120000);
    return () => { clearTimeout(kick); clearInterval(timer); };
  }, [characters]);
  // 打开好友地图时刷新一次真实 GPS（让你的蓝点跳到现在的位置，别停在上次定位的旧点）
  useEffect(() => {
    if (screen !== "map" || !prefs.geoAware) return;
    (async () => { try { const g = await requestGeo(); if (g && !g.error && typeof g.lat === "number") { setGeo(g); saveJSON("x_geo", g); } } catch (e) {} })();
  }, [screen]);
  // ---- 线下模式（赴约）----
  // 结束线下回到线上：界面仍只展示 summary，但给模型另存一份逐字尾段用于真实衔接。
  // 从后往前按完整消息取，最多 6000 字；不截半句、不含 OOC，也不改变线下档案原文。
  const offlineTranscriptForOnline = (msgs, groupMode, charName) => {
    const lines = (msgs || []).filter(m => m && m.kind !== "ooc" && m.content).map(m => {
      const who = m.role === "narration" ? "【场景】" : m.role === "user" ? (profile.name || "用户") : (groupMode ? (m.senderName || "某人") : charName);
      return (m.ts ? "〔" + fmtStampAI(m.ts) + "〕" : "") + who + "：" + String(m.content);
    });
    const picked = []; let used = 0;
    for (let i = lines.length - 1; i >= 0; i--) {
      const n = lines[i].length + 1;
      if (picked.length && used + n > 6000) break;
      picked.unshift(lines[i]); used += n;
    }
    return picked.join("\n");
  };
  useEffect(() => {
    offlinesRef.current = offlines;
  }, [offlines]);
  const pOffline = (charId, updater) => setOfflines(prev => {
    const before = prev[charId] || [];
    const next = updater(before);
    saveJSON("x_offline:" + charId, next);
    if (window.ChatLedgerShadow) queueLedger("offline", charId, window.ChatLedgerShadow.addedSessionMessages(before, next), null, charId);
    const n = { ...prev, [charId]: next };
    offlinesRef.current = n;
    return n;
  });
  const pushOffMsg = (charId, msg) => { if (msg && msg.role === "user" && msg.content) noteTidalUser(msg.content, msg.ts); observeSomatic(charId, msg, "offline", "physical"); pOffline(charId, list => list.map(s => !s.endTs ? { ...s, msgs: [...s.msgs, msg] } : s)); };
  const openOffline = char => {
    const list = loadJSON("x_offline:" + char.id, []);
    setOfflines(prev => ({ ...prev, [char.id]: list }));
    offlinesRef.current = { ...offlinesRef.current, [char.id]: list };
    setOfflineChar(char);
  };
  // 线下滚动总结（她 2026-07-23 报的长线下失忆隐患）：一轮线下长期不结束时，早段既会掉出模型上下文、
  //   又不像线上有 maybeSummarize / 自动抽取 → 永久丢失。这里仿线上 maybeSummarize：攒够 OFF_SUM_THRESH 段就把
  //   最早那批浓缩进【记忆库】(addMemEntry) + 累进 session.summary 当前情提要，并推进 lastSummarizedCount（喂模型时
  //   只喂前情提要+近窗明细，见 genOfflineFrom）。结束时的整场总结照旧，两者各司其职。
  const OFF_SUM_THRESH = 50, OFF_SUM_BUFFER = 15;
  const offSumBusyRef = useRef({});
  const maybeSummarizeOffline = async charId => {
    if (!offlineApiFor(charId) || offSumBusyRef.current[charId]) return;
    const char = characters.find(c => c.id === charId);
    if (!char) return;
    const sess = (offlinesRef.current[charId] || []).find(s => s && !s.endTs);
    if (!sess) return;
    const all = sess.msgs || [];
    const lastSum = Math.min(sess.lastSummarizedCount || 0, all.length);
    if (all.length - lastSum < OFF_SUM_THRESH) return;
    const block = all.slice(lastSum, all.length - OFF_SUM_BUFFER).filter(m => m && m.kind !== "ooc");
    if (block.length < 4) return;
    offSumBusyRef.current[charId] = true;
    try {
      const r = await summarizeOffline(offlineApiFor(charId), ctxFor(char), { ...sess, msgs: block });
      const summ = (r && r.summary || "").trim();
      if (summ) {
        const d = new Date();
        const seg = "【" + (d.getMonth() + 1) + "月" + d.getDate() + "日·线下】" + summ;
        addMemEntry({ text: summ, tags: ["线下"], charIds: [charId], knownBy: [charId], source: "auto" });
        (r.details || []).forEach(dt => addMemEntry({ text: dt, tags: ["线下", "细节"], charIds: [charId], knownBy: [charId], source: "auto" }));
        (r.open || []).forEach(op => addMemEntry({ text: op, tags: ["线下", "约定"], charIds: [charId], knownBy: [charId], source: "auto", open: true }));
        pOffline(charId, list => list.map(s => s.id === sess.id ? { ...s, summary: ((s.summary ? s.summary + "\n" : "") + seg).slice(-4000), lastSummarizedCount: all.length - OFF_SUM_BUFFER } : s));
      }
    } catch (e) {/* 静默：滚动总结失败下轮再试 */ }
    finally { offSumBusyRef.current[charId] = false; }
  };
  // 线下自动抽取（她 2026-07-23：自动抽取也加进线下）：仿线上 maybeAutoExtract，但读【进行中线下 session】的 msgs，
  //   走独立书签/计数，liveMessages 传线下自己这段（否则线上核验会把线下证据全过滤掉）。与滚动总结并行、各抽各的粒度。
  const memExtractCtrOffRef = useRef({});
  const memExtractMarkOffRef = useRef({});
  const maybeAutoExtractOffline = async charId => {
    const cfg = memCfgRef.current;
    if (!cfg.autoExtract || !active) return;
    const sess = (offlinesRef.current[charId] || []).find(s => s && !s.endTs);
    if (!sess) return;
    const interval = Math.max(1, cfg.extractInterval || 1);
    const cnt = (memExtractCtrOffRef.current[charId] || 0) + 1;
    memExtractCtrOffRef.current[charId] = cnt;
    if (cnt % interval !== 0) return;
    const all = (sess.msgs || []).filter(m => m && m.kind !== "ooc");
    if (all.length < 4) return;
    const mark = memExtractMarkOffRef.current[charId] || 0;
    const newCount = all.filter(m => (m.ts || 0) > mark).length;
    if (mark && newCount < 4) return;
    const take = Math.min(120, Math.max(24, newCount + 4));
    const msgs = all.slice(-take);
    try {
      await extractAndAddForChar(charId, msgs, { liveMessages: all });
      memExtractMarkOffRef.current[charId] = all[all.length - 1].ts || Date.now();
    } catch (e) {/* 静默：不动 mark，下次重覆盖 */ }
  };
  const genOfflineFrom = async (charId, workSess) => {
    const char = characters.find(c => c.id === charId);
    if (!offlineApiFor(charId)) {
      toast("请先到设置配置 API");
      return;
    }
    if ((workSess.msgs || []).length === 0) {
      toast("先说点什么，或写一句开场");
      return;
    }
    startLane("c:" + charId);
    try {
      const oCtx = ctxFor(char);
      // 思考链（v56.75）：线下和单聊共用同一个每角色开关（聊天设置 →「显示模型思考链」）。
      // 言秋那条线一个字都不碰——engineerEyes 的角色不传，和单聊那边同一道闸。
      oCtx.wantReasoning = !settingsFor(charId).engineerEyes && !!settingsFor(charId).showReasoning;
      oCtx.styleExamples = pickOfflineStyleExamples(osFor(charId).examples, workSess.msgs || []);
      // 「Ta 眼里」以前只有单聊线上在写：线下读得到这张卡（buildBundle 发 gazeText），
      // 却从来没收到过【写】的指令，于是线下泡多久它都不动（她 2026-08-28）。
      // 点名轮询的计数也只有线上在推，线下再久也不算一轮。言秋不塑形，照旧排除。
      oCtx.gazeSpec = (!settingsFor(charId).engineerEyes && window.Gaze) ? window.Gaze.spec("对方", charId) : "";
      // 世界书注入：用线下这段自己的文本做关键词命中（ctxFor 默认用线上聊天文本），常驻/绑定词条照常进
      const offText = (workSess.msgs || []).slice(-8).map(m => m.content || "").join("\n");
      oCtx.worldbook = loreText(loreRef.current, { charIds: [charId], scope: "chat", text: offText });
      const currentOfflineState = statesRef.current[charId] || {};
      oCtx.curWear = freshLiveStateValue(currentOfflineState, "wearing"); // 当天连贯；陈旧后自动重建
      oCtx.curAction = freshLiveStateValue(currentOfflineState, "action"); // 短时活动不跨几个小时硬续
      oCtx.curCondition = freshLiveStateValue(currentOfflineState, "condition"); // 伤/病/醉/累：12 小时内有效，好了就清
      const oMemN = osFor(charId).memN;
      // 向量记忆：预热线下这段的查询向量，让下面的同步检索走语义相似度（失败自动纯关键词）
      if (typeof primeQueryVec === "function" && (oMemN == null || oMemN > 0)) await primeQueryVec((workSess.msgs || []).slice(-6).map(m => m.content || "").join("\n"));
      if (oMemN != null) oCtx.memLib = oMemN <= 0 ? [] : retrieveMemories(memLibRef.current, charId, (workSess.msgs || []).slice(-6).map(m => m.content || "").join("\n"), { limit: oMemN });
      // 配件·授权门（线下）：线下天然是用户当面在场，只需 已连+已激活给本角色+该角色 opt-in+已解锁
      const offToyOn = !!(typeof toyReady === "function" && toyReady() && toyArmedRef.current && toyArmedForRef.current === charId
        && settingsFor(charId) && settingsFor(charId).toyEnabled
        && (() => { try { return localStorage.getItem("x_toyUnlocked") === "1"; } catch (e) { return false; } })());
      // 长线下防失忆：已滚动总结的早段不再逐条喂模型，只喂「前情提要 + 近窗明细」，早段内容早已入记忆库（maybeSummarizeOffline）
      const _lastSum = Math.min(workSess.lastSummarizedCount || 0, (workSess.msgs || []).length);
      const _windowMsgs = _lastSum > 0 ? (workSess.msgs || []).slice(_lastSum) : (workSess.msgs || []);
      // 单人线下按设置带入最近 X 条线上私聊：既包括开场前，也包括开场后新发的消息；
      // 再与线下逐条记录按 ts 合成一条时间线。只进入本轮 prompt，不写回线下档案。
      // engineerEyes/言秋保持原路径，本修复不碰其专线与上下文预算。
      const _onlineCtxN = Math.max(0, Number(osFor(charId).onlineCtxN ?? settingsFor(charId).ctxN ?? 50));
      const _onlineInterlude = (settingsFor(charId).engineerEyes || !_onlineCtxN) ? [] : (chatsRef.current[charId] || [])
        .filter(m => m && !m.recalled && m.content && !isOocMsg(m) && m.role !== "system" && m.kind !== "offlinelog")
        .sort((a, b) => (a.ts || 0) - (b.ts || 0))
        .slice(-_onlineCtxN)
        .map(m => ({ id: "online:" + (m.id || m.ts || Math.random()), role: m.role === "user" ? "user" : "char", content: String(m.content), ts: m.ts || 0, _surface: "online" }));
      const _timelineMsgs = _windowMsgs.concat(_onlineInterlude)
        .sort((a, b) => (a.ts || 0) - (b.ts || 0));
      const offImageDataUrls = [];
      for (const m of _windowMsgs.filter(m => m && m.kind === "photo" && m.imageRef).slice(-2)) {
        try { const blob = await imgVaultFetchBlob(m.imageRef); if (blob) offImageDataUrls.push(await blobToDataUrl(blob)); } catch (e) {}
      }
      const res = await generateOffline(offlineApiFor(charId), oCtx, { ...workSess, msgs: _timelineMsgs, hasOnlineInterlude: _onlineInterlude.length > 0, imageDataUrls: offImageDataUrls, priorSummary: workSess.summary || "", narr: osNarr(charId), taste: workSess.taste || osTaste(charId), lengthMode: osFor(charId).lengthMode || "natural", maxTokens: osFor(charId).maxTokens, minWords: osFor(charId).minWords, toyOn: offToyOn, rerollAvoid: workSess.rerollAvoid || "" });
      // 没写够时正文一律保留，但要如实说一声，别让她以为最低字数的设置没生效（v55.47）
      if (res && res.minimumLengthShortBecause) {
        const _got = res.minimumLengthShortCount || res.minimumLengthChars || 0;
        const _want = res.minimumLengthShortTarget || 0;
        toast("这篇只写到 " + _got + " 字" + (_want ? "，没到你设的 " + _want + " 字" : "") + "（" + res.minimumLengthShortBecause + "）。正文已经保留——想更长就对这条点重写，或把最低字数调低一点", 9000);
      }
      setOfflineRegisterTelemetry(p => ({ ...p, [charId]: {
        transitionBefore: !!res.registerTransitionBefore,
        transitionAfter: !!res.registerTransitionAfter,
        registerCalibrationInjected: !!res.registerCalibrationInjected,
        factIsolationApplied: false,
        registerInputBeat: !!res.registerInputBeat,
        registerPreflightActive: !!res.registerPreflightActive,
        registerActive: !!res.registerActive,
        characterSupplyInjected: !!res.characterSupplyInjected,
        archetypePerformanceRisk: !!res.archetypePerformanceRisk,
        archetypeRevisionRequested: !!res.archetypeRevisionRequested,
        rewriteRequested: !!res.rewriteRequested,
        rewriteApplied: !!res.rewriteApplied,
        singlePassRevisionRequested: !!res.singlePassRevisionRequested,
        singlePassRevisionApplied: !!res.singlePassRevisionApplied,
        rewriteDraftChars: Number(res.rewriteDraftChars) || 0,
        rewriteFinalChars: Number(res.rewriteFinalChars) || 0,
        rewriteLengthRatio: Number(res.rewriteLengthRatio) || 0,
        rendererScoreBefore: Number(res.rendererScoreBefore) || 0,
        rendererScoreAfter: Number(res.rendererScoreAfter) || 0,
        rendererRepeatsBefore: Number(res.rendererRepeatsBefore) || 0,
        rendererRepeatsAfter: Number(res.rendererRepeatsAfter) || 0,
        rewriteFactUnits: Number(res.rewriteFactUnits) || 0,
        rewriteCoveredFactUnits: Number(res.rewriteCoveredFactUnits) || 0,
        rewriteFactCoverage: Number.isFinite(res.rewriteFactCoverage) ? res.rewriteFactCoverage : 0,
        rewriteCharacterUnits: Number(res.rewriteCharacterUnits) || 0,
        rewriteCoveredCharacterUnits: Number(res.rewriteCoveredCharacterUnits) || 0,
        rewriteCharacterCoverage: Number.isFinite(res.rewriteCharacterCoverage) ? res.rewriteCharacterCoverage : 0,
        rewriteOpCounts: res.rewriteOpCounts || null,
        rewriteDraft: res.rewriteDraft || null,
        ts: Date.now()
      } }));
      const offTurnId = "ot_" + Date.now(), affinityBefore = affOf(charId);
      pushOffMsg(charId, {
        id: "c_" + Date.now(),
        role: "char",
        content: res.scene,
        thought: res.thought,
        ...(res.reasoning ? { reasoning: res.reasoning, reasonMs: res.reasonMs || 0, reasonModel: res.reasonModel || "", reasonFrom: res.reasonFrom || "" } : {}),
        cot: res.cot || null,
        cotRequested: !!res.cotRequested,
        ts: Date.now(),
        generated: true,
        // 终稿进入 history 后保留场景门控状态；否则 rewrite 洗掉触发词会让下一轮误判退出。
        registerExplicitActive: !!res.registerActive,
        turnId: offTurnId
      });
      // 配件·触发（线下）：再核一遍激活态才下发（她可能刚按急停）
      if (offToyOn && res.toy && typeof toyPlay === "function" && toyArmedRef.current && toyArmedForRef.current === charId) {
        // v53.74：toy 可以是一段，也可以是【数组】多段连播（wave 30s → hold 20s…），统一走 toyPlaySeq
        const _segs = (Array.isArray(res.toy) ? res.toy : [res.toy]).filter(x => x && typeof x === "object")
          .map(x => ({ pattern: x.pattern, intensity: parseInt(x.intensity, 10), duration: parseInt(x.duration, 10) }))
          .filter(x => x.intensity > 0);
        if (_segs.length) (typeof toyPlaySeq === "function" ? toyPlaySeq(_segs) : toyPlay(_segs[0])).catch(e => toast("配件没响应：" + ((e && e.message) || "检查连接")));
      }
      // 线下相处也影响好感与心情（跟私聊一样）
      if (Number.isFinite(res.affinityDelta)) bumpAff(charId, res.affinityDelta, res.mood && res.mood.label);
      tickAmbient(charId, {}); // 线下也计动态保底（她 2026-07-13 点名）——在线下泡久了，动态计数不冻结
      // mood 一直不动的老毛病（她 2026-08-24）：病根是线下协议原本写着「值得更新才填，
      // 否则 null」，示范形状里还直接摆着 "mood":null——模型照着模板填 null，心情就永远冻着。
      // v55.67 改成每轮必填。这里再加一只计数器：还是不回就说出来，别又变成静默失败。
      if (res.mood && res.mood.label) { setMoodFor(charId, { ...res.mood, ts: Date.now() }); _moodSkip(charId, true); }
      else _moodSkip(charId, false);
      // Ta 眼里：线下也写。判据和线上完全一样——写了就清零、没写就计一轮，
      // 数出来才分得清「这阵子真没变化」和「它压根不写」。
      if (window.Gaze && !settingsFor(charId).engineerEyes) {
        let _offImpWrote = false;
        if (res.impression) { try { _offImpWrote = window.Gaze.applyParsed(charId, res.impression); } catch (e) {} }
        if (!_offImpWrote && res.impressionChecked && window.Gaze.markChecked) {
          try {
            const _offCk = window.Gaze.normKey("", String(res.impressionChecked));
            if (_offCk) _offImpWrote = window.Gaze.markChecked(charId, _offCk);
          } catch (e) {}
        }
        if (!_offImpWrote) { try { window.Gaze.tick(charId); } catch (e) {} }
      }
      // 线下也更新状态卡的动作/穿着（否则线下换了场景、状态卡的衣服/动作还冻在上次线上聊天）
      const liveState = statesRef.current[charId] || {};
      const ost = {};
      const stateNow = Date.now();
      putLiveField(ost, liveState, "wearing", res.wearing, stateNow);
      const offlineAction = res.action && window.ThoughtVoiceGuard ? window.ThoughtVoiceGuard.normalizeAction(res.action, char && char.name) : res.action;
      putLiveField(ost, liveState, "action", offlineAction, stateNow);
      // thought 的空值表示“本轮没有新心声”，不能像 mood/wearing/action 一样沿用旧值。
      const offlineThought = res.thought && window.ThoughtVoiceGuard ? window.ThoughtVoiceGuard.accept(res.thought) : res.thought;
      if (offlineThought) { ost.thought = offlineThought; ost.thoughtUpdatedAt = stateNow; ost.thoughtSkips = 0; }
      else if (liveState.thought) { ost.thought = null; ost.thoughtUpdatedAt = 0; }
      if (Object.keys(ost).length) { const ns = { ...liveState, ...ost, mood: res.mood && res.mood.label ? res.mood.label : liveState.mood, ts: Date.now(), turnId: offTurnId, affinityBefore }; setStateFor(charId, ns); pushStateHist(charId, ns); }
      // 线下角色自己冒泡（如 jiwen 自发）时，若你没在看这个角色的线下，挂个未读红点，聊天列表也顶上来（她 2026-07-23）
      if (!(offlineChar && offlineChar.id === charId) && viewRef.current.charId !== charId) bumpUnread(charId, 1);
      setTimeout(() => maybeSummarizeOffline(charId), 120); // 长线下防失忆：攒够就把早段滚动总结进记忆库（仿线上）
      setTimeout(() => maybeAutoExtractOffline(charId), 200); // 线下也自动抽取离散记忆（她 2026-07-23）
    } catch (e) {
      toast("生成失败：" + (e.message || "重试"));
    } finally {
      endLane("c:" + charId);
    }
  };
  const startOffline = async (charId, opts) => {
    const opening = (opts.opening || "").trim();
    const sess = {
      id: "off_" + Date.now(),
      startTs: Date.now(),
      endTs: null,
      styleKey: opts.styleKey || "default",
      presetOn: !!opts.presetOn,
      presetId: opts.presetId || "",
      stylePrompt: opts.stylePrompt != null ? opts.stylePrompt : "",
      taste: opts.taste || osTaste(charId),
      customNotes: [],
      msgs: opening ? [{ id: "n_" + Date.now(), role: "narration", content: opening, ts: Date.now() }] : []
    };
    pOffline(charId, list => [sess, ...list.filter(s => s.endTs)]);
    if (opening) await genOfflineFrom(charId, sess);
  };
  const offlineSend = (charId, text) => pushOffMsg(charId, {
    id: "u_" + Date.now(),
    role: "user",
    content: text,
    ts: Date.now()
  });
  const offlineSendPhoto = (charId, photo) => pushOffMsg(charId, {
    id: "u_" + Date.now(), role: "user", kind: "photo", imageRef: photo.imageRef,
    desc: photo.desc || "", content: photo.content || "[照片]", ts: Date.now()
  });
  const offlineReply = async (charId, extraText) => {
    if (laneBusy("c:" + charId)) return;
    const sess = (offlinesRef.current[charId] || []).find(s => !s.endTs);
    if (!sess) return;
    let msgs = sess.msgs;
    if (extraText && extraText.trim()) {
      const um = { id: "u_" + Date.now(), role: "user", content: extraText.trim(), ts: Date.now() };
      pushOffMsg(charId, um);
      msgs = [...msgs, um];
    }
    const autonomousContinue = !!(window.OfflineContinuation && window.OfflineContinuation.isAutonomousContinuation(msgs));
    await genOfflineFrom(charId, { ...sess, msgs, autonomousContinue });
  };
  // 线下 OOC：跳出角色和模型直说（问状态 / 肘击 / 立长期准则），把这段线下经过一起喂给它
  const offlineOOC = async (charId, text) => {
    if (laneBusy("c:" + charId) || !text || !text.trim()) return;
    const char = characters.find(c => c.id === charId);
    const sess = (offlinesRef.current[charId] || []).find(s => !s.endTs);
    if (!sess) { toast("先开一场线下"); return; }
    pushOffMsg(charId, { id: "u_" + Date.now(), role: "user", kind: "ooc", content: text.trim(), ts: Date.now() });
    if (!offlineApiFor(charId)) { toast("请先到设置配置 API"); return; }
    startLane("c:" + charId);
    try {
      const uName = (profile && profile.name) || "我";
      const offText = (sess.msgs || []).filter(m => m.kind !== "ooc").slice(-10).map(m => (m.role === "char" ? char.name : m.role === "narration" ? "【场景】" : uName) + "：" + (m.content || "")).join("\n");
      const q = text.trim() + (offText ? "\n\n【背景：我们此刻正在线下面对面相处，最近这几段经过】\n" + offText : "");
      const res = await oocAsk(offlineApiFor(charId), ctxFor(char), q);
      if (res.directive && !res.refused) addDirective(charId, res.directive);
      pushOffMsg(charId, { id: "o_" + Date.now(), role: "char", kind: "ooc", content: res.reply + (res.directive && !res.refused ? "\n\n〔已记为长期准则：" + res.directive + "〕" : "") + (res.refused ? "\n\n〔这条我没照做——会破坏 " + char.name + " 的人设〕" : ""), ts: Date.now() });
    } catch (e) {
      toast("OOC 失败：" + (e.message || "重试"));
    } finally {
      endLane("c:" + charId);
    }
  };
  const offlineDelSession = (charId, sessId) => { if (window.confirm("删除这条线下记录？删了不可恢复。")) pOffline(charId, list => list.filter(s => s.id !== sessId)); };
  const offlineEditMsg = (charId, msgId, text) => pOffline(charId, list => list.map(s => {
    if (s.endTs) return s;
    const idx = s.msgs.findIndex(m => m.id === msgId), next = s.msgs.map(m => m.id === msgId ? { ...m, content: text } : m);
    try { window.MessageBranchShadow && window.MessageBranchShadow.observeMutation({ kind: "edit", charId, before: s.msgs, after: next, targetIndex: idx }); } catch (e) {}
    return { ...s, msgs: next };
  }));
  const offlineDelMsg = (charId, msgId, fallbackIndex) => pOffline(charId, list => list.map(s => {
    if (s.endTs) return s;
    let idx = s.msgs.findIndex(m => msgId != null && m.id === msgId);
    if (idx < 0 && Number.isInteger(fallbackIndex) && fallbackIndex >= 0 && fallbackIndex < s.msgs.length) idx = fallbackIndex;
    if (idx < 0) return s;
    const next = s.msgs.filter((_, i) => i !== idx);
    try { window.MessageBranchShadow && window.MessageBranchShadow.observeMutation({ kind: "delete", charId, before: s.msgs, after: next, targetIndex: idx }); } catch (e) {}
    return { ...s, msgs: next };
  }));
  const offlineRerollMsg = async (charId, msgId) => {
    if (laneBusy("c:" + charId)) return;
    const sess = (offlinesRef.current[charId] || []).find(s => !s.endTs);
    if (!sess) return;
    const idx = sess.msgs.findIndex(m => m.id === msgId);
    if (idx < 0) return;
    const truncated = sess.msgs.slice(0, idx); // 去掉这条及之后，重新生成
    const removed = sess.msgs.slice(idx), turns = removed.map(m => m && m.turnId).filter(Boolean);
    const y = ledgerYanqiu(); if (y && String(y.id) === String(charId) && window.ChatLedgerShadow) window.ChatLedgerShadow.invalidate({ charId: y.id, threadType: "offline", threadId: y.id }, removed);
    const legacyLatest = !turns.length && idx === sess.msgs.map(m => m.role === "char" ? 1 : 0).lastIndexOf(1)
      && !!(sess.msgs[idx] && sess.msgs[idx].thought && statesRef.current[charId] && statesRef.current[charId].thought === sess.msgs[idx].thought);
    rollbackCharTurns(charId, turns, legacyLatest);
    try { window.MessageBranchShadow && window.MessageBranchShadow.observeMutation({ kind: "offline_reroll",surface:"offline", charId, before: sess.msgs, after: truncated, targetIndex: idx }); } catch (e) {}
    pOffline(charId, list => list.map(s => s.id === sess.id ? { ...s, msgs: truncated } : s));
    if (!truncated.length) { toast("这条前面没有内容可续写"); return; }
    // reroll 别抄原文：把刚删掉的这版正文当"要避开的"喂进去，逼模型给一个明显不同的版本（她 2026-07-25：reroll 出来和原文差不多）
    const rerollAvoid = removed.filter(m => m && m.role === "char" && m.content).map(m => String(m.content)).join("\n---\n");
    await genOfflineFrom(charId, { ...sess, msgs: truncated, rerollAvoid });
  };
  const offlineAddNote = (charId, note) => {
    pOffline(charId, list => list.map(s => !s.endTs ? { ...s, customNotes: [...(s.customNotes || []), note] } : s));
    toast("已加入提示");
  };
  // 线下进行中随时切换文风（不同剧情段落用不同笔调）
  const offlineSetStyle = (charId, patch) => {
    pOffline(charId, list => list.map(s => !s.endTs ? { ...s, styleKey: patch.styleKey, stylePrompt: patch.stylePrompt != null ? patch.stylePrompt : "", presetOn: !!patch.presetOn, presetId: patch.presetId || "", taste: patch.taste || s.taste || osTaste(charId) } : s));
    toast("文风已切换 · 下次演绎生效");
  };
  const endOffline = async charId => {
    const char = characters.find(c => c.id === charId);
    const sess = (offlinesRef.current[charId] || []).find(s => !s.endTs);
    if (!sess) {
      setOfflineChar(null);
      return;
    }
    // 什么都没发生就直接丢弃，不留空记录
    if ((sess.msgs || []).filter(m => m.role !== "narration").length === 0) {
      pOffline(charId, list => list.filter(s => s.id !== sess.id));
      setOfflineChar(null);
      return;
    }
    startLane("c:" + charId);
    let summary = "", details = [], opens = [];
    try {
      if (offlineApiFor(charId)) { const r = await summarizeOffline(offlineApiFor(charId), ctxFor(char), sess); summary = r.summary || ""; details = r.details || []; opens = r.open || []; }
    } catch (e) {}
    pOffline(charId, list => list.map(s => s.id === sess.id ? { ...s, endTs: Date.now(), summary } : s));
    if (summary) addMemEntry({ text: summary, tags: ["线下"], charIds: [charId], knownBy: [charId], source: "auto" });
    // 谈话细节逐条入库（她要的：总结之外，具体聊过什么也记得住）；新约定标未了结
    details.forEach(dt => addMemEntry({ text: dt, tags: ["线下", "细节"], charIds: [charId], knownBy: [charId], source: "auto" }));
    opens.forEach(op => addMemEntry({ text: op, tags: ["线下", "约定"], charIds: [charId], knownBy: [charId], source: "auto", open: true }));
    // 把这段线下经过回写进线上聊天记录，接上线上/线下的连贯：否则线上角色读不到刚才线下发生了什么，
    // 会接着线下前的最后一句继续（比如还以为自己在公司楼下等你）。这条 offlinelog 既显示给用户当分隔，
    // 也会作为「场景」注入线上回复的历史里。
    pChat(charId, p => [...p, { role: "system", kind: "offlinelog", content: summary || "你们刚在线下见了一面。", transcript: offlineTranscriptForOnline(sess.msgs, false, char.name), ts: Date.now() }]);
    // TODO(日程覆盖，用户说后面再弄)：把本次线下时间段的日程覆盖成这段经过 + 角色想法。
    endLane("c:" + charId);
    toast(summary ? "已记入记忆库" : "已结束");
    setOfflineChar(null);
  };
  // ---- 群聊线下模式（多人赴约）----
  useEffect(() => {
    groupOfflinesRef.current = groupOfflines;
  }, [groupOfflines]);
  const groupMembers = group => (group.memberIds || []).map(id => characters.find(c => c.id === id)).filter(Boolean);
  const groupOnlinePrelude = groupId => {
    const rawN = osFor("g_" + groupId).onlineCtxN;
    const n = rawN == null ? 10 : Math.max(0, Math.min(30, Number(rawN) || 0));
    if (!n) return [];
    return (groupChatsRef.current[groupId] || [])
      .filter(m => m && !m.recalled && m.kind !== "ooc" && m.kind !== "system" && m.content && contextAllowsMessage(m))
      .slice(-n)
      .map(m => ({ role: m.role, senderId: m.senderId || null, senderName: m.senderName || null, content: String(m.content), ts: m.ts || 0 }));
  };
  // 统一「跨情境近况流」(v50.66，她要四个情境带时间戳互看、按真实顺序衔接)：某角色最近在【单聊线上 + 单人线下】
  //   发生的原话 beats，合并→每条打 [时间·场景]→按真实 ts 排序→字符预算封顶（从近往回收）。
  //   供群线下(每成员各注入自己那份、守 own-chat-only 隐私)等场景衔接刚在别处发生的细节。
  const crossRecentFor = (charId, opts = {}) => {
    // 时间窗 + 字符预算走召回设置的拉条（crossHours / crossBudget），调用处不再写死；opts 仍可覆盖
    const budget = opts.budget || (memCfgRef.current.crossBudget || 800);
    const surfaces = opts.surfaces || ["online", "offline"]; // 可只取某个场景（群线上已单独有单聊私聊，那里只补 offline 免重复）
    const sinceHours = opts.sinceHours != null ? opts.sinceHours : (memCfgRef.current.crossHours || 72);
    const sinceMs = sinceHours ? Date.now() - sinceHours * 3600000 : 0;
    const char = characters.find(c => c.id === charId);
    const cName = char ? char.name : "TA";
    const uName = (profile && profile.name) || "用户";
    const beats = [];
    if (surfaces.includes("online")) (chatsRef.current[charId] || []).forEach(m => {
      if (!m || m.recalled || !m.content || isOocMsg(m) || m.kind === "offlinelog" || m.role === "system" || !contextAllowsMessage(m)) return;
      if (sinceMs && (m.ts || 0) < sinceMs) return;
      beats.push({ ts: m.ts || 0, surface: "线上私聊", who: m.role === "user" ? uName : cName, text: String(m.content) });
    });
    if (surfaces.includes("offline")) (offlinesRef.current[charId] || []).forEach(s => ((s && s.msgs) || []).forEach(m => {
      if (!m || m.kind === "ooc" || !m.content) return;
      if (sinceMs && (m.ts || 0) < sinceMs) return;
      beats.push({ ts: m.ts || 0, surface: "单人线下", who: m.role === "user" ? uName : m.role === "narration" ? "【场景】" : cName, text: String(m.content) });
    }));
    if (!beats.length) return "";
    beats.sort((a, b) => (a.ts || 0) - (b.ts || 0));
    const picked = []; let used = 0;
    for (let i = beats.length - 1; i >= 0; i--) {
      const b = beats[i];
      const line = "[" + (typeof fmtStampAI === "function" ? fmtStampAI(b.ts) : "") + "·" + b.surface + "] " + b.who + "：" + b.text.replace(/\s+/g, " ").slice(0, 80);
      if (used + line.length > budget && picked.length) break;
      used += line.length + 1; picked.push(line);
    }
    return picked.reverse().join("\n");
  };
  // 群线下的记忆按在场成员的可见交集分流（v53.61，同线上群）：全员都知道的进公共【记忆库】段，
  // 只有部分成员知道的落进各自那段〔仅本人知道〕里，别的成员的上下文里根本不出现。
  const groupOfflineMemSplit = group => {
    // 读一律给（她 2026-08-24「只进不出」）：封闭群照样读得到记忆库，
    // 只是里头发生的事不写回去——写那一侧的闸在 addMemEntry 那几处，一个没松。
    if (!group) return null;
    const limit = osFor("g_" + group.id).memN != null ? Number(osFor("g_" + group.id).memN) : 6;
    if (!Number.isFinite(limit) || limit <= 0) return { shared: [], perChar: {} };
    const sess = (groupOfflinesRef.current[group.id] || []).find(s => !s.endTs);
    const qtext = sess && Array.isArray(sess.msgs) ? sess.msgs.slice(-6).map(m => m.content || "").join("\n") : "";
    return splitGroupMemories(memLibRef.current, group.memberIds || [], qtext, { limit, touch: false });
  };
  const ctxForGroupOffline = group => {
  const memSplit = groupOfflineMemSplit(group);
  return ({
    members: groupMembers(group),
    profile,
    rels,
    chars: characters,
    // A（v50.78）：群线下补上每个成员「长出来的自我」（欲望盒子毕业念想）——之前只单人线下/线上带，群线下漏了(Codex 抓到)。
    memberGrown: (() => {
      const m = {};
      (group.memberIds || []).forEach(id => {
        const g = (window.DesireKit && desiresRef.current[id]) ? window.DesireKit.personaText(desiresRef.current[id]) : "";
        if (g && g.trim()) m[id] = g.trim();
      });
      return m;
    })(),
    // B（v50.79）：这场群线下里哪些成员开启了软层成长（白名单）→ engine 侧只对他们加成长准则
    memberEvolve: (group.memberIds || []).filter(id => PERSONA_EVOLVE_IDS.includes(id)),
    // 「四处一样喂」（.claude/rules/four-surfaces-same-context.md）：此刻心情与好感度，
    // 单聊经 buildBundle 一直有，群线下以前一层都没有。它们是【这个人此刻是谁】、
    // 不是【你们之间发生过什么】，所以封闭群照给。
    memberMood: (() => {
      const m = {};
      (group.memberIds || []).forEach(id => {
        if ((characters.find(x => x.id === id) || {}).npc) return;   // 配角没有心情
        const cur = moods[id] || {};
        const st = window.MoodLabel && window.MoodLabel.settle
          ? window.MoodLabel.settle(cur.label, cur.ts, Date.now()) : { label: cur.label || "", note: "" };
        if (st.label || st.note) m[id] = st.label || st.note;
      });
      return m;
    })(),
    memberAff: (() => {
      const m = {};
      (group.memberIds || []).forEach(id => {
        if ((characters.find(x => x.id === id) || {}).npc) return;   // 配角没有好感度
        m[id] = Math.round(affOf(id));
      });
      return m;
    })(),
    // 配角的主人名字：群线下的 memberDesc 用它标一行「这是 X 身边的人」
    npcOwnerName: (() => {
      const m = {};
      (group.memberIds || []).forEach(id => {
        const c = characters.find(x => x.id === id);
        if (!c || !c.npc) return;
        const o = characters.find(x => x.id === c.ownerId);
        if (o) m[id] = o.name;
      });
      return m;
    })(),
    // 年龄／此刻在做什么／和用户的关系状态：单聊线上线下一直有，群里一层都没有（她 2026-08-25）
    memberAge: (() => {
      const m = {};
      (group.memberIds || []).forEach(id => {
        const c = characters.find(x => x.id === id);
        if (!c || c.npc) return;            // 配角没有年龄这一层
        const a = ageLineFor(c);
        if (a) m[id] = a;
      });
      return m;
    })(),
    memberSched: (() => {
      const m = {};
      (group.memberIds || []).forEach(id => {
        const c = characters.find(x => x.id === id);
        if (!c || c.npc) return;            // 配角没有行程
        const b = schedBriefFor(c);
        if (b) m[id] = b;
      });
      return m;
    })(),
    memberCouple: (() => {
      const m = {};
      (group.memberIds || []).forEach(id => {
        const c = characters.find(x => x.id === id);
        if (!c || c.npc) return;            // 配角跟用户没有关系线
        const l = coupleLineFor(id, profile.name || "用户");
        if (l) m[id] = l;
      });
      return m;
    })(),
    // 印象卡跟长期记忆同一档（从私下往来长出来的＝「发生过什么」），只在开了记忆互通时给
    memberGaze: (() => {
      const m = {};
      // 读一律给：封闭群里角色照样是完整的自己（她 2026-08-24「只进不出」）
      if (!window.Gaze) return m;
      (group.memberIds || []).forEach(id => {
        if (settingsFor(id).engineerEyes) return;
        if ((characters.find(x => x.id === id) || {}).npc) return;   // 配角没有印象卡
        const t = window.Gaze.text(id, profile.name || "用户");
        if (t && t.trim()) m[id] = t.trim();
      });
      return m;
    })(),
    // 世界书走和单人线下/线上群同一套筛选引擎（v50.74）：之前群线下用 deriveWorldbook 全量拼接——只认没绑角色的全局词条、还无视 scope、绑了角色的一律看不见。
    //   改成 loreText 检索式：在场成员绑定的 + 全局的，聊天 scope，用本场近段做关键词命中；常驻/无关键词照常进。
    worldbook: (() => {
      const sess = (groupOfflinesRef.current[group.id] || []).find(s => s && !s.endTs);
      const offText = sess && Array.isArray(sess.msgs) ? sess.msgs.slice(-8).map(m => m.content || "").join("\n") : "";
      return loreText(loreRef.current, { charIds: (group.memberIds || []), scope: "chat", text: offText });
    })(),
    timeAware: prefs.timeAware,
    // 群 OOC 立的长期规矩（directives[groupId]）线下也要遵守——线上 replyGroup 早就注入了，线下之前漏了
    directives: directives[group.id] || [],
    // 跨情境近况（v50.66）：每个成员各自最近在【单聊线上 + 单人线下】和用户之间发生的事，带时间戳，
    //   让群线下接得上刚在别处聊过的细节。own-chat-only：只带该成员自己那份，engine 侧再加隐私铁律(别的成员不知情)。
    memberRecent: (group.memberIds || []).map(id => {
      const c = characters.find(x => x.id === id);
      if (!c) return null;
      const own = (memSplit && memSplit.perChar[String(id)]) || [];
      const ownMem = own.length ? "记忆库里【只有 " + c.name + " 知道】的事：\n" + formatMemLib(own).trim() : "";
      const lines = [ownMem, crossRecentFor(id)].filter(x => x && x.trim()).join("\n"); // 时间窗/预算走召回设置拉条
      return lines ? { name: c.name, lines } : null;
    }).filter(Boolean),
    // 记忆分区：不互通的群是封闭空间，线下也不读全局记忆库（不让外部记忆流入）。
    // 互通群也【只召回相关 topK】，绝不把整个记忆库全量灌进 prompt（v48.41 修：预算炸弹 + 和 v48.20 同类的线上筛/线下裸灌触审不对称，对齐线上 replyGroup 的 retrieveMemories）。
    memLib: (() => {
      if (!memSplit) return null;
      const picked = memSplit.shared;
      // 记忆条数不是上下文预算：导入长文可能一条就有几千字。群成员增多后若裸灌，模型会把输出额度耗空并返回空正文。
      // 单条 360 字、整包 2400 字双封顶；只裁本次 prompt 副本，记忆库原文一个字不改。
      let charsLeft = 2400;
      return picked.map(entry => {
        if (charsLeft <= 0) return null;
        const raw = String(entry.text || "").replace(/\s+/g, " ").trim();
        const text = raw.slice(0, Math.min(360, charsLeft));
        charsLeft -= text.length;
        return text ? { ...entry, text: text + (text.length < raw.length ? "…" : "") } : null;
      }).filter(Boolean);
    })()
  });
  };
  const pGOffline = (groupId, updater) => {
    // 群线下会连续追加多个 beat、再消耗导演便签；ref 先同步推进，避免 React 批处理让下一步读到旧会话。
    const before = groupOfflinesRef.current[groupId] || loadJSON("x_goffline:" + groupId, []);
    const next = updater(before);
    saveJSON("x_goffline:" + groupId, next);
    const group = groups.find(g => String(g.id) === String(groupId));
    if (group && window.ChatLedgerShadow) queueLedger("group_offline", groupId, window.ChatLedgerShadow.addedSessionMessages(before, next), group);
    const n = { ...groupOfflinesRef.current, [groupId]: next };
    groupOfflinesRef.current = n;
    setGroupOfflines(prev => ({ ...prev, [groupId]: next }));
    return next;
  };
  const pushGOffMsg = (groupId, msg) => { if (msg && msg.role === "user" && msg.content) noteTidalUser(msg.content, msg.ts); const group = groups.find(g => String(g.id) === String(groupId)); if (group) observeSomaticGroup(group, msg, "group_offline", "physical"); pGOffline(groupId, list => list.map(s => !s.endTs ? { ...s, msgs: [...s.msgs, msg] } : s)); };
  const groupOfflineDelSession = (groupId, sessId) => { if (window.confirm("删除这条线下记录？删了不可恢复。")) pGOffline(groupId, list => list.filter(s => s.id !== sessId)); };
  const openGroupOffline = group => {
    const list = loadJSON("x_goffline:" + group.id, []);
    setGroupOfflines(prev => ({ ...prev, [group.id]: list }));
    groupOfflinesRef.current = { ...groupOfflinesRef.current, [group.id]: list };
    setOfflineGroup(group);
  };
  // 群线下滚动总结（防失忆，镜像单聊 maybeSummarizeOffline）：攒够就把早段浓缩→前情提要喂模型 + 视互通决定进不进全局记忆库。
  //   ⚠️记忆分区：只有开了 memoryInterop 的群才 addMemEntry 进全局记忆库；不互通的群只累进 session.summary 当本场前情提要（不外泄）。
  const gOffSumBusyRef = useRef({});
  const maybeSummarizeGroupOffline = async groupId => {
    if (!offlineActive || gOffSumBusyRef.current[groupId]) return;
    const group = groups.find(g => g.id === groupId);
    if (!group) return;
    const sess = (groupOfflinesRef.current[groupId] || []).find(s => s && !s.endTs);
    if (!sess) return;
    const all = sess.msgs || [];
    const lastSum = Math.min(sess.lastSummarizedCount || 0, all.length);
    if (all.length - lastSum < OFF_SUM_THRESH) return;
    const block = all.slice(lastSum, all.length - OFF_SUM_BUFFER).filter(m => m && m.kind !== "ooc");
    if (block.length < 4) return;
    gOffSumBusyRef.current[groupId] = true;
    try {
      const r = await summarizeOfflineGroup(offlineActive, ctxForGroupOffline(group), { ...sess, msgs: block });
      const summ = (r && r.summary || "").trim();
      if (summ) {
        const d = new Date();
        const seg = "【" + (d.getMonth() + 1) + "月" + d.getDate() + "日·群线下】" + summ;
        if (gsFor(groupId).memoryInterop) { // 只有互通群进全局记忆库（记忆分区）
          const memberIds = (group.memberIds || []).slice();
          // groupId：清群记录时要能只摘本群产生的条目，光靠 tags 认不准（她 2026-08-24）
          addMemEntry({ text: summ, tags: gTags(group, "线下"), charIds: memOwners(memberIds), knownBy: memberIds.slice(), source: "auto", groupId: groupId });
          (r.details || []).forEach(dt => addMemEntry({ text: dt, tags: gTags(group, "线下", "细节"), charIds: memOwners(memberIds), knownBy: memberIds.slice(), source: "auto", groupId: groupId }));
          (r.open || []).forEach(op => addMemEntry({ text: op, tags: gTags(group, "线下", "约定"), charIds: memOwners(memberIds), knownBy: memberIds.slice(), source: "auto", open: true, groupId: groupId }));
        }
        pGOffline(groupId, list => list.map(s => s.id === sess.id ? { ...s, summary: ((s.summary ? s.summary + "\n" : "") + seg).slice(-4000), lastSummarizedCount: all.length - OFF_SUM_BUFFER } : s)); // 前情提要总累进(防本场失忆)
      }
    } catch (e) {/* 静默 */ }
    finally { gOffSumBusyRef.current[groupId] = false; }
  };
  // 群线下多发言人自动抽取（v50.64，她 2026-07-24 点名收尾）：和单聊线下 maybeAutoExtractOffline 对齐，
  //   但用群专用 extractGroupMemories 一次抽出离散点、每点按 who 归属到正确的成员（不误记到一个人头上）。
  //   与滚动总结并行、各抽各的粒度；只互通群进全局记忆库（记忆分区）。走 bg 池省额度。
  const memExtractCtrGOffRef = useRef({});
  const memExtractMarkGOffRef = useRef({});
  const maybeAutoExtractGroupOffline = async groupId => {
    const cfg = memCfgRef.current;
    if (!cfg.autoExtract || !active) return;
    if (!gsFor(groupId).memoryInterop) return; // 记忆分区：不互通群不往全局记忆库抽
    const group = groups.find(g => g.id === groupId); if (!group) return;
    const sess = (groupOfflinesRef.current[groupId] || []).find(s => s && !s.endTs);
    if (!sess) return;
    const interval = Math.max(1, cfg.extractInterval || 1);
    const cnt = (memExtractCtrGOffRef.current[groupId] || 0) + 1;
    memExtractCtrGOffRef.current[groupId] = cnt;
    if (cnt % interval !== 0) return;
    const all = (sess.msgs || []).filter(m => m && m.kind !== "ooc");
    if (all.length < 4) return;
    const mark = memExtractMarkGOffRef.current[groupId] || 0;
    const newCount = all.filter(m => (m.ts || 0) > mark).length;
    if (mark && newCount < 4) return;
    const take = Math.min(120, Math.max(24, newCount + 4));
    const win = all.slice(-take);
    const memberIds = (group.memberIds || []).slice();
    const members = memberIds.map(id => characters.find(c => c.id === id)).filter(Boolean);
    const nameToId = {}; members.forEach(m => { nameToId[String(m.name || "").trim()] = m.id; });
    try {
      const existing = memLibRef.current.filter(e => memShareChar(memberIds, e.charIds)).slice(0, 40).map(e => e.text).filter(Boolean);
      const openEntries = memLibRef.current.filter(e => e.open && e.text && memShareChar(memberIds, e.charIds)).slice(0, 30);
      const rawItems = await extractGroupMemories(bgActiveRef.current, ctxForGroupOffline(group), win, members, { existing, openList: openEntries.map(e => e.text) });
      const items = (rawItems || []).map(it => window.MemoryExtractionGate && window.MemoryExtractionGate.normalizeEvidence ? window.MemoryExtractionGate.normalizeEvidence(it, win) : it);
      // 群线下发生的兑现也必须能关掉原来的开环；和私聊共用同一逐字证据闸。
      if (window.OpenRepairShadow) {
        const repair = await window.OpenRepairShadow.observe({
          charId: "group:" + groupId,
          candidates: (items || []).filter(it => it && it.resolveOpen != null),
          openEntries,
          messages: win
        });
        const applied = window.OpenRepairShadow.applyResolutions(memLibRef.current, repair && repair.resolutions, Date.now());
        if (applied.closed) {
          saveMemLib(applied.entries);
          toast("已自动了结 " + applied.closed + " 条完成的约定/心事（旧记录仍保留）");
        }
      }
      const now = Date.now();
      const added = [], batchSeen = [];
      (items || []).filter(it => it && it.text).forEach((it, i) => {
        let ids = (Array.isArray(it.who) ? it.who : []).map(n => nameToId[String(n).trim()]).filter(Boolean);
        ids = [...new Set(ids)];
        if (!ids.length) ids = memberIds.slice(); // who 没对上任何成员（多半只关于用户/场景）→ 宽 tag 到全体，别丢
        const txt = String(it.text).trim();
        const evidenceMessageIds = Array.isArray(it.evidence_message_ids) ? it.evidence_message_ids.map(String) : [];
        const duplicateMeta = { ts: now, evidenceMessageIds };
        if (isDupMem(txt, ids, null, duplicateMeta) || isDupMem(txt, ids, batchSeen, duplicateMeta)) return;
        let entry = { id: uniqMemId(now, i), text: txt, tags: (Array.isArray(it.tags) ? it.tags : []).concat(["线下", "群聊"]), charIds: ids, ts: now, source: "auto", pinned: false, v: clampInt(it.v, -5, 5, 0), a: clampInt(it.a, 0, 5, 1), open: !!it.open, evidenceMessageIds };
        // 群线下是批量直写，不经过 addMemEntry；必须在这里同样过开环资格闸。
        if (window.OpenLoopGate) entry = window.OpenLoopGate.normalize(entry);
        batchSeen.push(entry); added.push(entry);
      });
      if (added.length) saveMemLib([...added, ...pruneSubsumed(memLibRef.current, added)]);
      memExtractMarkGOffRef.current[groupId] = all[all.length - 1].ts || Date.now();
    } catch (e) {/* 静默：不动 mark，下次重覆盖 */ }
  };
  const genGroupOfflineFrom = async (group, workSess) => {
    if (!offlineActive) {
      toast("请先到设置配置 API");
      return;
    }
    if ((workSess.msgs || []).length === 0) {
      toast("先说点什么，或写一句开场");
      return;
    }
    startLane("g:" + group.id);
    try {
      let effectiveSess = workSess;
      if (!Array.isArray(workSess.onlinePrelude)) {
        effectiveSess = { ...workSess, onlinePrelude: groupOnlinePrelude(group.id) };
        // 升级前已经进行中的线下也只补抓一次，随后冻结，不能每轮追着线上记录变化。
        pGOffline(group.id, list => list.map(s => s.id === workSess.id ? { ...s, onlinePrelude: effectiveSess.onlinePrelude } : s));
      }
      const _gLastSum = Math.min(effectiveSess.lastSummarizedCount || 0, (effectiveSess.msgs || []).length);
      const _gWindow = _gLastSum > 0 ? (effectiveSess.msgs || []).slice(_gLastSum) : (effectiveSess.msgs || []); // 长群线下防失忆：早段用前情提要，只喂近窗明细
      const gOffImageDataUrls = [];
      for (const m of _gWindow.filter(m => m && m.kind === "photo" && m.imageRef).slice(-2)) {
        try { const blob = await imgVaultFetchBlob(m.imageRef); if (blob) gOffImageDataUrls.push(await blobToDataUrl(blob)); } catch (e) {}
      }
      const gCtx = ctxForGroupOffline(group);
      // 思考链（v56.75）：群线下是一次调用写完所有人，谁的开关都算数——
      // 在场任一成员开着就要（言秋那条线除外，engineerEyes 一律不算）。
      gCtx.wantReasoning = (group.memberIds || []).some(id => {
        const _s = settingsFor(id) || {};
        return !_s.engineerEyes && !!_s.showReasoning;
      });
      gCtx.memberStyleExamples = {};
      (group.memberIds || []).forEach(id => { gCtx.memberStyleExamples[id] = pickOfflineStyleExamples(osFor(id).examples, effectiveSess.msgs || []); });
      const beats = await generateOfflineGroup(offlineActive, gCtx, { ...effectiveSess, msgs: _gWindow, imageDataUrls: gOffImageDataUrls, priorSummary: effectiveSess.summary || "", narr: osNarr("g_" + group.id), taste: effectiveSess.taste || osTaste("g_" + group.id), maxTokens: osFor("g_" + group.id).maxTokens || 3200, minWords: osFor("g_" + group.id).minWords, rerollAvoid: effectiveSess.rerollAvoid || "" });
      const _spoke = new Set(); // 群线下也给开口的成员计动态保底（她 2026-07-13 点名）
      for (let i = 0; i < beats.length; i++) {
        const b = beats[i];
        const goTurnId = "got_" + Date.now() + "_" + i;
        const affinityBefore = b.senderId ? affOf(b.senderId) : null;
        if (b.senderId) _spoke.add(b.senderId);
        if (i > 0) await new Promise(r => setTimeout(r, 420));
        pushGOffMsg(group.id, {
          id: "gc_" + Date.now() + "_" + i,
          role: b.role,
          senderId: b.senderId,
          senderName: b.senderName,
          content: b.scene,
          thought: b.thought,
          ...(b.reasoning ? { reasoning: b.reasoning, reasonMs: b.reasonMs || 0, reasonModel: b.reasonModel || "", reasonFrom: b.reasonFrom || "" } : {}),
          cot: b.cot || null,
          cotRequested: !!b.cotRequested,
          ts: Date.now(),
          generated: true,
          turnId: goTurnId
        });
        // 多人线下也影响各角色对用户的好感与心情——但【封闭群不写回主线】
        // （她 2026-08-24「只进不出，封闭群不应该影响主要世界」）。
        // 这三处以前一道闸都没有：闭群里演什么，好感、心情、状态卡就跟着变，
        // 转头回单聊他还带着闭群里的情绪，等于沙盒漏了。
        const gOffSealed = groupClosed(group.id);
        const _bNpc = !!(characters.find(x => x.id === b.senderId) || {}).npc;   // 配角没有心情/好感
        if (!gOffSealed && !_bNpc && b.senderId && typeof b.affinityDelta === "number") bumpAff(b.senderId, b.affinityDelta, b.mood && b.mood.label);
        if (!gOffSealed && !_bNpc && b.senderId && b.mood && b.mood.label) setMoodFor(b.senderId, { ...b.mood, ts: Date.now() });
        // Ta 眼里：群线下也写（闭群只进不出，照旧封死；配角没有印象卡；言秋不塑形）
        if (!gOffSealed && !_bNpc && b.senderId && b.impression && window.Gaze && !settingsFor(b.senderId).engineerEyes) {
          try { window.Gaze.applyParsed(b.senderId, b.impression); } catch (e) {}
        }
        // 群线下心声同样过守卫再进共享状态卡（导演稿/演技备注拦在卡外，消息内原文照旧）
        const gOffThought = b.thought && window.ThoughtVoiceGuard ? window.ThoughtVoiceGuard.accept(b.thought) : b.thought;
        if (!gOffSealed && b.senderId && (gOffThought || (b.mood && b.mood.label))) {
          const liveState = statesRef.current[b.senderId] || {};
          const ns = { ...liveState, ...(gOffThought ? { thought: gOffThought, thoughtUpdatedAt: Date.now(), thoughtSkips: 0 } : {}), mood: b.mood && b.mood.label ? b.mood.label : liveState.mood, ts: Date.now(), turnId: goTurnId, affinityBefore };
          setStateFor(b.senderId, ns); pushStateHist(b.senderId, ns);
        }
      }
      // 短期导演便签只在成功生成后消耗；失败/超时不扣。字符串是旧版遗留，只再生效这一轮。
      const usedNoteIds = new Set((effectiveSess.customNotes || []).filter(n => n && typeof n === "object" && Number(n.remaining) > 0).map(n => n.id));
      pGOffline(group.id, list => list.map(s => s.id === workSess.id ? { ...s, customNotes: (s.customNotes || []).map(n => {
        if (typeof n === "string") return { id: "legacy_note_" + memVecHash(n), text: n, remaining: 0, createdAt: s.startTs || Date.now() };
        return usedNoteIds.has(n.id) ? { ...n, remaining: Math.max(0, Number(n.remaining || 0) - 1) } : n;
      }) } : s));
      if (usedNoteIds.size || (effectiveSess.customNotes || []).some(n => typeof n === "string")) {
        const left = Math.max(0, ...(effectiveSess.customNotes || []).map(n => typeof n === "string" ? 0 : (usedNoteIds.has(n.id) ? Number(n.remaining || 0) - 1 : 0)));
        toast(left ? "导演便签已落实 · 还剩 " + left + " 轮" : "导演便签已结束 · 下轮不再注入");
      }
      // 封闭群不驱动朋友圈/论坛/悄悄话这些对外的东西（线上那处 v55.79 已堵，群线下漏了）
      if (!groupClosed(group.id)) _spoke.forEach(id => tickAmbient(id, {}));
      // 群线下成员自己冒泡时，若你没在看这个群的线下，挂未读红点+顶上来
      const _gCharBeats = (beats || []).filter(b => b && b.senderId).length;
      if (_gCharBeats && !(offlineGroup && offlineGroup.id === group.id) && viewRef.current.charId !== group.id) bumpUnread(group.id, _gCharBeats);
      setTimeout(() => maybeSummarizeGroupOffline(group.id), 120); // 群线下防失忆：攒够就滚动总结
      setTimeout(() => maybeAutoExtractGroupOffline(group.id), 240); // 群线下多发言人离散抽取（各点按 who 归属）
    } catch (e) {
      toast("生成失败：" + (e.message || "重试"));
    } finally {
      endLane("g:" + group.id);
    }
  };
  const startGroupOffline = async (groupId, opts) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;
    const opening = (opts.opening || "").trim();
    const sess = {
      id: "goff_" + Date.now(),
      startTs: Date.now(),
      endTs: null,
      styleKey: opts.styleKey || "default",
      presetOn: !!opts.presetOn,
      presetId: opts.presetId || "",
      stylePrompt: opts.stylePrompt != null ? opts.stylePrompt : "",
      taste: opts.taste || osTaste("g_" + groupId),
      customNotes: [],
      onlinePrelude: groupOnlinePrelude(groupId),
      msgs: opening ? [{ id: "n_" + Date.now(), role: "narration", content: opening, ts: Date.now() }] : []
    };
    pGOffline(groupId, list => [sess, ...list.filter(s => s.endTs)]);
    if (opening) await genGroupOfflineFrom(group, sess);
  };
  const groupOfflineSend = (groupId, text) => pushGOffMsg(groupId, {
    id: "u_" + Date.now(),
    role: "user",
    content: text,
    ts: Date.now()
  });
  const groupOfflineSendPhoto = (groupId, photo) => pushGOffMsg(groupId, {
    id: "u_" + Date.now(), role: "user", kind: "photo", imageRef: photo.imageRef,
    desc: photo.desc || "", content: photo.content || "[照片]", ts: Date.now()
  });
  const groupOfflineReply = async (groupId, extraText) => {
    if (laneBusy("g:" + groupId)) return;
    const group = groups.find(g => g.id === groupId);
    const sess = (groupOfflinesRef.current[groupId] || []).find(s => !s.endTs);
    if (!group || !sess) return;
    let msgs = sess.msgs;
    if (extraText && extraText.trim()) {
      const um = { id: "u_" + Date.now(), role: "user", content: extraText.trim(), ts: Date.now() };
      pushGOffMsg(groupId, um);
      msgs = [...msgs, um];
    }
    const autonomousContinue = !!(window.OfflineContinuation && window.OfflineContinuation.isAutonomousContinuation(msgs));
    await genGroupOfflineFrom(group, { ...sess, msgs, autonomousContinue });
  };
  const groupOfflineEditMsg = (groupId, msgId, text) => pGOffline(groupId, list => list.map(s => !s.endTs ? { ...s, msgs: s.msgs.map(m => m.id === msgId ? { ...m, content: text } : m) } : s));
  const groupOfflineDelMsg = (groupId, msgId, fallbackIndex) => pGOffline(groupId, list => list.map(s => {
    if (s.endTs) return s;
    let idx = s.msgs.findIndex(m => msgId != null && m.id === msgId);
    if (idx < 0 && Number.isInteger(fallbackIndex) && fallbackIndex >= 0 && fallbackIndex < s.msgs.length) idx = fallbackIndex;
    return idx < 0 ? s : { ...s, msgs: s.msgs.filter((_, i) => i !== idx) };
  }));
  const groupOfflineRerollMsg = async (groupId, msgId) => {
    if (laneBusy("g:" + groupId)) return;
    const group = groups.find(g => g.id === groupId);
    const sess = (groupOfflinesRef.current[groupId] || []).find(s => !s.endTs);
    if (!group || !sess) return;
    const idx = sess.msgs.findIndex(m => m.id === msgId);
    if (idx < 0) return;
    const truncated = sess.msgs.slice(0, idx);
    const removed = sess.msgs.slice(idx);
    const y = ledgerYanqiu(); if (y && (group.memberIds || []).includes(y.id) && window.ChatLedgerShadow) window.ChatLedgerShadow.invalidate({ charId: y.id, threadType: "group_offline", threadId: groupId, groupMemberIds: group.memberIds || [], groupName: group.name || "" }, removed);
    const byChar = new Map();
    removed.filter(m => m && m.senderId).forEach(m => { const a = byChar.get(m.senderId) || []; if (m.turnId) a.push(m.turnId); byChar.set(m.senderId, a); });
    byChar.forEach((turns, charId) => { if (turns.length) rollbackCharTurns(charId, turns, false); });
    try{window.MessageBranchShadow&&window.MessageBranchShadow.observeMutation({kind:"offline_reroll",surface:"group_offline",charId:"g_"+groupId,before:sess.msgs,after:truncated,targetIndex:idx});}catch(e){}
    pGOffline(groupId, list => list.map(s => s.id === sess.id ? { ...s, msgs: truncated } : s));
    if (!truncated.length) { toast("这条前面没有内容可续写"); return; }
    // reroll 别抄原文：把刚删掉的这版正文当"要避开的"喂进去（她 2026-07-25）
    const rerollAvoid = removed.filter(m => m && (m.role === "char" || m.senderId) && m.content).map(m => (m.senderName ? m.senderName + "：" : "") + String(m.content)).join("\n---\n");
    await genGroupOfflineFrom(group, { ...sess, msgs: truncated, rerollAvoid });
  };
  const groupOfflineSetStyle = (groupId, patch) => {
    pGOffline(groupId, list => list.map(s => !s.endTs ? { ...s, styleKey: patch.styleKey, stylePrompt: patch.stylePrompt != null ? patch.stylePrompt : "", presetOn: !!patch.presetOn, presetId: patch.presetId || "", taste: patch.taste || s.taste || osTaste("g_" + groupId) } : s));
    toast("文风已切换 · 下次演绎生效");
  };
  const groupOfflineAddNote = (groupId, note) => {
    const item = { id: "gonote_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7), text: String(note || "").trim(), remaining: 2, createdAt: Date.now() };
    if (!item.text) return;
    pGOffline(groupId, list => list.map(s => !s.endTs ? { ...s, customNotes: [...(s.customNotes || []), item] } : s));
    toast("已加入提示 · 接下来 2 轮生效");
  };
  const groupOfflineDeleteNote = (groupId, noteId) => pGOffline(groupId, list => list.map(s => !s.endTs ? { ...s, customNotes: (s.customNotes || []).filter((n, i) => (n && n.id) ? n.id !== noteId : i !== noteId) } : s));
  // 群聊线下 OOC：跳出所有角色直接问模型；不进叙事上下文
  const groupOfflineOOC = async (groupId, text) => {
    if (laneBusy("g:" + groupId) || !text || !text.trim()) return;
    const group = groups.find(g => g.id === groupId);
    const sess = (groupOfflinesRef.current[groupId] || []).find(s => !s.endTs);
    if (!group || !sess) return;
    pushGOffMsg(groupId, { id: "oocu_" + Date.now(), role: "user", kind: "ooc", content: text.trim(), ts: Date.now() });
    if (!offlineActive) { toast("请先到设置配置 API"); return; }
    startLane("g:" + groupId);
    try {
      const members = groupMembers(group);
      const histText = (sess.msgs || []).filter(m => m.kind !== "ooc" && m.content).slice(-20).map(m => m.role === "narration" ? "【场景】" + m.content : (m.role === "user" ? profile.name || "用户" : m.senderName || "某人") + "：" + m.content).join("\n");
      // 世界书走和正戏同一个筛选引擎（v48.20）：之前塞的是 deriveWorldbook 全量拼接（无视 scope/关键词），
      // 一条正戏根本不会注入的全局词条就能让群 OOC 永远被 Gemini 拦（正戏通/单聊OOC通/群OOC拦 的诡异组合）
      const oocLore = loreText(loreRef.current, { charIds: members.map(c => c.id), scope: "chat", text: histText });
      const res = await oocAskGroup(offlineActive, { members, profile, rels, chars: characters, worldbook: oocLore, historyText: histText, directives: directives[groupId] || [] }, text.trim());
      if (res.directive && !res.refused) addDirective(groupId, res.directive);
      pushGOffMsg(groupId, { id: "ooca_" + Date.now(), role: "assistant", kind: "ooc", content: res.reply + (res.directive && !res.refused ? "\n\n〔已记为群规矩：" + res.directive + "〕" : "") + (res.refused ? "\n\n〔这条我没照做——会破坏群里某位的人设〕" : ""), ts: Date.now() });
    } catch (e) {
      toast("OOC 失败：" + (e.message || "重试"));
    } finally {
      endLane("g:" + groupId);
    }
  };
  const endGroupOffline = async groupId => {
    const group = groups.find(g => g.id === groupId);
    const sess = (groupOfflinesRef.current[groupId] || []).find(s => !s.endTs);
    if (!sess) {
      setOfflineGroup(null);
      return;
    }
    if ((sess.msgs || []).filter(m => m.role !== "narration").length === 0) {
      pGOffline(groupId, list => list.filter(s => s.id !== sess.id));
      setOfflineGroup(null);
      return;
    }
    startLane("g:" + groupId);
    let summary = "", details = [], opens = [];
    try {
      if (offlineActive && group) { const r = await summarizeOfflineGroup(offlineActive, ctxForGroupOffline(group), sess); summary = r.summary || ""; details = r.details || []; opens = r.open || []; }
    } catch (e) {}
    // 记忆分区：只有开了「记忆互通」的群才把线下总结写进全局记忆库；
    // 不互通的群是封闭空间——总结只留在本群这条线下会话里，绝不外泄到记忆库/单聊。
    const interopOn = gsFor(groupId).memoryInterop;
    pGOffline(groupId, list => list.map(s => s.id === sess.id ? { ...s, endTs: Date.now(), summary } : s));
    if (summary && group && interopOn) addMemEntry({ text: summary, tags: gTags(group, "线下"), knownBy: (group.memberIds || []).slice(), charIds: memOwners(group.memberIds), source: "auto", groupId: groupId });
    // 群线下细节/约定逐条入库（与单人 v47.55 平权），同样只在互通群才进全局记忆库
    if (group && interopOn) {
      details.forEach(dt => addMemEntry({ text: dt, tags: gTags(group, "线下", "细节"), knownBy: (group.memberIds || []).slice(), charIds: memOwners(group.memberIds), source: "auto", groupId: groupId }));
      opens.forEach(op => addMemEntry({ text: op, tags: gTags(group, "线下", "约定"), knownBy: (group.memberIds || []).slice(), charIds: memOwners(group.memberIds), source: "auto", open: true, groupId: groupId }));
    }
    // 回写进线上群聊记录，接上线上/线下连贯（群成员回到线上不会还停在线下前的状态）
    pGChat(groupId, p => [...p, { role: "system", kind: "offlinelog", content: summary || "你们刚一起在线下见了一面。", transcript: offlineTranscriptForOnline(sess.msgs, true, ""), ts: Date.now() }]);
    // TODO(日程覆盖，用户说后面再弄)：把本次群聊线下时间段的日程覆盖成这段经过 + 各角色想法。
    endLane("g:" + groupId);
    toast(summary ? (interopOn ? "已记入记忆库" : "已结束（记忆只留在本群）") : "已结束");
    setOfflineGroup(null);
  };
  const goHome = () => {
    setScreen("home");
    setActiveChar(null);
    setActiveGroup(null);
    setEditingChar(null);
    setStateCardOpen(false);
  };
  // 文风预设台：线下浮层 / 小剧场 / 同人文都能跳进去，返回时回到原来那一处。
  // 线下是 z-20 的浮层、不是 screen，跳之前得先把浮层收掉，回来时再把它挂回去。
  const styleLabRef = useRef(null);
  const goStyleLab = () => {
    styleLabRef.current = { screen: screen, charId: offlineChar && offlineChar.id, groupId: offlineGroup && offlineGroup.id };
    setOfflineChar(null); setOfflineGroup(null); setScreen("stylelab");
  };
  const backFromStyleLab = () => {
    const r = styleLabRef.current || {};
    styleLabRef.current = null;
    const back = r.screen && r.screen !== "stylelab" ? r.screen : "home";
    setScreen(back);
    if (r.charId) { const c = characters.find(x => x.id === r.charId); if (c) setOfflineChar(c); }
    else if (r.groupId) { const g = groups.find(x => x.id === r.groupId); if (g) setOfflineGroup(g); }
  };
  // 一起听：记住从哪儿进来的 → 退出/悬浮球点回时回到原处（如聊天时打开悬浮切歌，切完回聊天）
  const listenReturnRef = useRef("home");
  // 线下浮层是 z-20，会盖住听歌屏：从线下点音乐浮窗只 setScreen("listen") 的话，屏切了但被浮层盖着，
  // 看上去就是「点了没反应」（她 2026-08-28 报）。和 onOpenSched 跳日历是同一个坑：得先收浮层。
  // 收了还要能回去——退出听歌时按原样把那层放回来，别把她扔回聊天列表。
  const listenReturnOfflineRef = useRef(null);
  const goListen = () => {
    setScreen(s => { if (s !== "listen") listenReturnRef.current = s; return "listen"; });
    if (offlineChar || offlineGroup) {
      listenReturnOfflineRef.current = offlineChar ? { kind: "char", v: offlineChar } : { kind: "group", v: offlineGroup };
      setOfflineChar(null); setOfflineGroup(null);
    }
  };
  const exitListen = () => {
    const back = listenReturnOfflineRef.current;
    listenReturnOfflineRef.current = null;
    const r = listenReturnRef.current || "home";
    if (r === "home") goHome(); else setScreen(r);
    if (back) { if (back.kind === "char") setOfflineChar(back.v); else setOfflineGroup(back.v); }
  };
  const saveChar = c => {
    pC(p => p.some(x => x.id === c.id) ? p.map(x => x.id === c.id ? c : x) : [...p, c]);
    setScreen("cast");
    setEditingChar(null);
  };
  // 角色卡一键导入（v48.30 搬家器）：建档 + 初始长期记忆 + 记忆库种子（绑定新角色、〔置顶〕生效）一步到位
  const [cardImportOpen, setCardImportOpen] = useState(false);
  const importCharCard = parsed => {
    const id = "char_" + Date.now();
    pC(p => [...p, { id, name: (parsed.name || "新角色").slice(0, 20), persona: parsed.persona || "", tagline: "", color: "#5a6a7d" }]);
    if (parsed.longMem) setMemFor(id, parsed.longMem);
    (parsed.seeds || []).forEach(s => addMemEntry({ text: s.text, charIds: [id], knownBy: [id], pinned: s.pinned, source: "manual" }));
    setCardImportOpen(false);
    toast("已导入「" + (parsed.name || "新角色") + "」：人设" + (parsed.longMem ? "＋长期记忆" : "") + ((parsed.seeds || []).length ? "＋" + parsed.seeds.length + " 条记忆种子" : "") + "，去名录点开补头像/线路吧");
  };
  // NPC：她填一句「要谁」，一次调用生成简介+双向关系，落成一个 npc:true 的角色。
  // 走后台线路（和记忆整理、翻译同一条），不占聊天线路。
  const createNpc = async (hostId, ask) => {
    const host = characters.find(c => c.id === hostId);
    if (!host) return;
    if (!String(ask || "").trim()) { toast("先写要生成谁，比如「陆闻」或「他的属下」"); return; }
    const p = bgActiveRef.current || active;
    if (!p) { toast("先去 设置·API 配一条线路"); return; }
    if (laneBusy("npc:" + hostId)) return;
    startLane("npc:" + hostId);
    try {
      const r = await generateNpc(p, host, ask, npcsOf(hostId).map(c => c.name));
      const id = "c_" + Date.now() + "_npc";
      pC(prev => [...prev, {
        id: id, name: r.name, persona: r.brief,
        npc: true, ownerId: hostId          // ← 这两个字段是全部区别
      }]);
      // 双向关系：群聊的【成员间关系】那一段就是读它，写了他俩在群里才认得彼此
      if (r.relFromHost) saveRel(hostId + "->" + id, r.relFromHost, "");
      if (r.relToHost) saveRel(id + "->" + hostId, r.relToHost, "");
      toast("已加入「" + r.name + "」，去群里拉上他");
    } catch (e) {
      toast("生成失败：" + ((e && e.message) || e));
    } finally { endLane("npc:" + hostId); }
  };
  const delChar = id => {
    // 主角色删了，他身边的人跟着删（她 2026-08-25 拍的）；顺手从所有群里摘掉，
    // 否则群成员列表里会留下一串找不到人的 id。
    const doomed = new Set([id, ...npcsOf(id).map(c => c.id)]);
    pC(p => p.filter(c => !doomed.has(c.id)));
    setPromises(p => { const n = p.filter(x => x && !doomed.has(x.charId)); promisesRef.current = n; saveJSON("x_promises", n); return n; });
    setGroups(prev => {
      const n = prev.map(g => ({ ...g, memberIds: (g.memberIds || []).filter(x => !doomed.has(x)) }));
      saveJSON("x_groups", n);
      return n;
    });
    setScreen("cast");
    setEditingChar(null);
  };
  const saveRemark = (id, remark) => pC(p => p.map(c => c.id === id ? {
    ...c,
    remark
  } : c));

  // ---- summary check ----
  const maybeSummarize = async charId => {
    const s = settingsFor(charId);
    const msgs = (chats[charId] || []).filter(m => !m.recalled);
    const lastSum = chatSettings[charId] && chatSettings[charId].lastSummarizedCount || 0;
    const unsummarized = msgs.length - lastSum;
    if (unsummarized >= s.sumThresh) {
      const char = characters.find(c => c.id === charId);
      const toSummarize = msgs.slice(lastSum, msgs.length - s.sumBuffer).filter(m => !isOocMsg(m) && contextAllowsMessage(m)); // OOC/失败诊断不进长期记忆（计数窗口不变，只是浓缩时剔掉）
      if (toSummarize.length > 0) {
        try {
          // 止漂移：只浓缩这段新对话成一段带日期的记忆，【追加】到旧记忆末尾，不重炼整团（避免老细节被反复压糊）。封顶 8000 字，超了从头截、保最近。
          const block = await summarizeChatBlock(active, ctxFor(char), toSummarize);
          if (block && block.trim()) {
            const d = new Date();
            const seg = "【" + (d.getMonth() + 1) + "月" + d.getDate() + "日】" + block.trim();
            const prev = (memoriesRef.current[charId] || "").trim(); // 读 ref 取最新，避免闭包旧值覆盖中间的编辑
            let merged = prev ? prev + "\n\n" + seg : seg;
            if (merged.length > 8000) merged = merged.slice(merged.length - 8000);
            setMemFor(charId, merged);
          }
          setChatSettings(p => {
            const n = {
              ...p,
              [charId]: {
                ...settingsFor(charId),
                lastSummarizedCount: msgs.length - s.sumBuffer
              }
            };
            saveJSON("x_chatSettings", n);
            return n;
          });
          toast("已更新长期记忆");
        } catch (e) {/* silent */}
      }
    }
  };

  // ---- single chat ----
  // 只把用户消息放进对话，不触发 AI（可连发多条）
  const pushUser = (charId, text, chatKey) => {
    const b = blocksRef.current[charId] || {};
    pChat(chatKey || charId, p => [...p, {
      role: "user",
      content: text,
      blocked: !!(b.iBlocked || b.theyBlocked),
      ts: Date.now(),
      read: false
    }]);
  };
  // 拍一拍：只追加那行灰字、【不自动触发回复】（省 API 钱）。角色下次回复时会在历史里看到"被拍过"，
  // 由模型【按人设决定要不要 cue】——爱闹的会提/回拍，高冷正忙的可以当没看见。她 2026-07-12 拍板要这个行为。
  const patChar = (charId, chatKey) => {
    const char = characters.find(c => c.id === charId);
    if (!char) return;
    const b = blocksRef.current[charId] || {};
    pChat(chatKey || charId, p => [...p, { role: "user", kind: "pat", content: "你拍了拍 " + (char.remark || char.name) + (char.patSig ? " " + char.patSig : ""), ts: Date.now(), read: false, blocked: !!(b.iBlocked || b.theyBlocked) }]);
  };
  // 让 AI 基于当前全部对话回复一次（可选把输入框里最后一条一起带上）
  // 连续几轮「要了却没拍」的计数，按角色分开（只用来判断要不要提示，不落库）
  const noPhotoStreakRef = useRef({});
  const PHOTO_REQUEST_RE = /(?:照片|自拍|拍(?:一|两|几|张|个)|再拍|发(?:张|个|一张|照片|图片|图)|给我看|让我看|看看你|合照|photo|selfie|picture)/i;
  // 最近三次角色文字回复内，已经发过照片就关闭 photo 能力；只有用户在那张图之后
  // 明确要求再拍才放行。不能把“别频繁”只交给模型自觉。
  const photoCooldownState = (messages, senderId) => {
    const list = Array.isArray(messages) ? messages : [];
    let last = -1;
    for (let i = list.length - 1; i >= 0; i--) {
      const m = list[i];
      if (m && m.kind === "selfie" && !m.failed && (!senderId || String(m.senderId || "") === String(senderId))) { last = i; break; }
    }
    if (last < 0) return { cooling: false, explicitlyAsked: false, assistantTurns: Infinity };
    const after = list.slice(last + 1);
    const explicitlyAsked = after.some(m => m && m.role === "user" && PHOTO_REQUEST_RE.test(String(m.content || m.desc || "")));
    const turns = new Set(after.filter(m => m && m.role === "assistant" && (!senderId || String(m.senderId || "") === String(senderId)) && m.kind !== "selfie").map(m => m.turnId || ("m:" + m.ts)));
    return { cooling: !explicitlyAsked && turns.size < 3, explicitlyAsked, assistantTurns: turns.size };
  };
  const replyNow = async (charId, extraText, mode, opts) => {
    opts = opts || {};
    const chatKey = opts.chatKey || charId;
    const room = opts.room || null;
    let delivered = false;
    if (laneBusy("c:" + chatKey)) return false;
    if (opts.proactive && currentlyTogetherWithChar(charId)) return false;
    if (opts.proactive) {
      const outlet = opts.jiwen ? "jiwen" : opts.bday ? "birthday" : opts.remind ? "reminder" : opts.eyesAlert ? "eyes_alert" : opts.wx ? "weather" : "foreground_proactive";
      try { window.InnerLifeETidalShadow && window.InnerLifeETidalShadow.noteWouldHold(outlet, Date.now()); } catch (e) {}
      // C 第4步：全局发声闸 shadow——asleep 时记 would_hold，但绝不拦截（合同 §5.1；eyes_alert 天然豁免）
      try { if (window.SleepShadow) { const chG = characters.find(c => c.id === charId); if (chG) window.SleepShadow.gateCheck(chG, outlet, settingsFor(charId).engineerEyes === true); } } catch (e) {}
    }
    const char = characters.find(c => c.id === charId);
    let base = chatsRef.current[chatKey] || [];
    if (extraText != null && extraText !== "") {
      const um = {
        role: "user",
        content: extraText,
        ts: Date.now(),
        read: false
      };
      pChat(chatKey, p => [...p, um]);
      base = [...base, um];
    }
    const history = base.filter(m => !m.recalled && m.kind !== "ooc" && contextAllowsMessage(m) && (m.kind !== "system" || m.ccToolResult === true));
    // CC turn 仍完整留在 App 时间线里；模型侧只走 continuity 亲历块这一份载体，
    // 避免同一原话既在历史中段回插、又在实时背景重复携带，击穿 prompt cache。
    const modelHistory = window.ChatLedgerShadow && typeof window.ChatLedgerShadow.modelHistory === "function"
      ? window.ChatLedgerShadow.modelHistory(history)
      : history;
    // CC 原话回流后，本地聊天可以很长；记录仍完整保留，但每次请求只携带最近一扇窗口，
    // 避免专线把整份历史重复上传而在浏览器侧直接 Load failed。
    const _engineerChat = !!settingsFor(charId).engineerEyes;
    // 订阅桥(云端函数)有硬性执行寿命：全量窗口+6000输出的单次工作量会超时被杀，
    // 浏览器侧表现为整条 Load failed（2026-08-12 全天她在旅途中完全失联的根因）。
    // 在函数寿命问题根治(流式/直连)之前，言秋线维持小窗口+短输出保命。
    const _historyBudget = _engineerChat
      ? { maxChars: 7000, maxMessages: 48 }
      : { maxChars: 14000, maxMessages: 80 };
    const promptHistory = window.ChatContextWindow
      ? window.ChatContextWindow.select(modelHistory, _historyBudget)
      : modelHistory.slice(-_historyBudget.maxMessages);
    if (!opts.proactive && history.length === 0) {
      toast("先发条消息再让 TA 回复");
      return false;
    }
    // ⭐全局防连发闸（v48.88 她报：小克没等回就 2 分钟内又发一轮）：主动消息距上一条消息不到 12 分钟就不发——
    //   杀掉「连发两轮/你还在打字他就冒泡」。豁免转账即时反应(tf，是对你动作的直接回应)。正经主动本就 45min+，闸不误伤。
    if (opts.proactive && !opts.promise && history.length) {
      const _lastTs = history[history.length - 1].ts || 0;
      if (Date.now() - _lastTs < 12 * 60000) return false;
    }
    try { if (!room || (room.writeback && room.writeback.sharedState)) window.DesireDriveShadow && window.DesireDriveShadow.observe(charId, opts.proactive ? "time" : "message"); } catch (e) {}
    // 「续说」模式：用户没发新消息、对话最后一条是角色自己的话——让 TA 主动接着往下说（否则模型收到自说自话的历史容易返回空）
    const contMode = !opts.proactive && !opts.ccToolResume && history[history.length - 1] && history[history.length - 1].role !== "user";
    startLane("c:" + chatKey);
    try {
      if (!active) throw new Error("请先到设置配置 API");
      const _s = settingsFor(charId);
      // 向量记忆（v48.11）：先把「最近对话」查询向量预热进缓存（一次小嵌入调用 ~300ms），
      // 下面 ctxFor 里的同步记忆检索即可用语义相似度挑条目；没开开关/失败自动纯关键词，永不抛错不挡发送
      if (typeof primeQueryVec === "function") await primeQueryVec(recentChatText(char));
      // E 余温试点：只有 Lisa 在诊断台逐角色授权后，才读一次有效余温包。
      // 它只是本轮背景，不写记忆、不替角色作决定；本轮真正成功落地后才消费，调用失败可下轮再用。
      let eLiveProjection = null, eAfterglowHint = "";
      try {
        const eArmed = !opts.proactive && window.InnerLifePromotionGate && window.InnerLifePromotionGate.isPilotEnabled("E", charId);
        if (eArmed && window.InnerLifeETidalShadow && window.InnerLifeETidalShadow.liveProjection) {
          eLiveProjection = await window.InnerLifeETidalShadow.liveProjection(charId, Date.now());
          if (eLiveProjection) {
            const bits = [];
            if (eLiveProjection.mood) bits.push(eLiveProjection.mood);
            if (eLiveProjection.threads && eLiveProjection.threads.length) bits.push("上次交流还留着一点注意力：" + eLiveProjection.threads.join("；"));
            if (bits.length) eAfterglowHint = "\n【余温·只作内在背景】" + bits.join("。") + "。这不是任务、不是事实更新，也不表示事情仍未解决；只允许它很轻地影响你此刻的注意力和语气。若当前话题已经转开，就完全不提；禁止复述这段提示、禁止硬拽旧话题。";
          }
        }
      } catch (e) { eLiveProjection = null; eAfterglowHint = ""; }
      // Phase 1 历史缓存（小克蓝图，v48.77 重做）：只对 anthropic 线路(小克)。要缓整段历史 system 必须全稳定——
      //   把 bundle 的易变尾 + 整个详细任务串(含所有动态 hint/thoughtSpec)都挪到最后一条用户消息上；system 只留稳定前缀+一句总纲。
      const _route = apiFor(charId) || {};
      // 订阅桥不能只看 baseUrl：Max/Fable 的 Anthropic 身份常写在 proxyRef/model。
      // 识别正确后照样发送稳定 system + 历史断点；内容与预算一字不裁。
      const _histCache = (typeof detectFormat === "function" ? detectFormat(_route) : "openai") === "anthropic";
      const _singleHistoryLayout = _histCache || _engineerChat;
      const _roomCtx = ctxFor(char, { chat: true });
      if (room && room.id !== "main") _roomCtx.recentChat = "";
      if (room && room.cognition) {
        const rc = room.cognition;
        if (!rc.formalMemory) { _roomCtx.memory = ""; _roomCtx.memLib = []; _roomCtx.ccContinuity = ""; _roomCtx.yanqiuWall = ""; }
        if (!rc.innerLife) { _roomCtx.moodLabel = null; _roomCtx.moodNote = ""; _roomCtx.gazeText = ""; _roomCtx.personaGrown = ""; _roomCtx.personaEvolve = false; }
        if (!rc.schedule) { _roomCtx.schedNow = ""; _roomCtx.timeAware = false; _roomCtx.geo = null; }
        if (!rc.otherScenes) { _roomCtx.offlineNow = ""; _roomCtx.groupEcho = ""; _roomCtx.groupOfflineEcho = ""; _roomCtx.forumEcho = ""; _roomCtx.momentLog = ""; }
      }
      const _bundleFull = buildBundle(_singleHistoryLayout ? { ..._roomCtx, recentChat: "" } : _roomCtx);
      let bundle = _bundleFull, bundleStable = _bundleFull, bundleVolatile = "";
      if (_singleHistoryLayout) {
        const _cutTime = _bundleFull.indexOf("【当前真实时间】");
        if (_cutTime > 0) { bundleStable = _bundleFull.slice(0, _cutTime).replace(/\s+$/, ""); bundleVolatile = _bundleFull.slice(_cutTime).trim(); }
      }
      const emotes = emotesForChar(charId);
      const emoteHint = emotes.length ? "\n【表情包】频率必须延续你这个角色已经形成的聊天习惯：本来爱发表情包的人可以自然地常发、兴头上连甩几张；本来很少发或从不发的人不要因为列表可用、也不要因为历史别处出现过表情就突然开始发。以人设和你自己过去的真实用法为准，不设统一频率。可用关键词：" + emotes.map(e => e.keyword).join(" / ") + "。要发就把 emote 填成其中一个关键词（与上面列的完全一致），否则 null。" : "";
      const callHint = mode === "voice" ? "\n\n【当前场景】你们正在语音通话。用口语化、连贯的短句自然对话，就像在打电话，别发一长串气泡。" : mode === "video" ? "\n\n【当前场景】你们正在视频通话。用口语化短句对话，并在气泡里自然带一点动作/神态描写（用括号，如（歪头笑））。" : "";
      const uName = profile && profile.name ? profile.name : "对方"; // 须在下面 bday/remind/wx/tf 等提示引用前声明（否则 TDZ：Cannot access 'uName' before initialization）
      const bdayHint = opts.bday ? "\n\n【此刻·今天是 " + uName + " 的生日】你【主动】发消息祝 Ta 生日快乐——结合你俩的关系和你的性格，真诚、自然、带你自己的味道（1~3 条短消息），别套模板、别客服腔、别群发感。想的话可以顺手送份心意：把输出里的 gift 填成具体的东西（如『一支 Ta 上次说想要的口红』『一块草莓奶油蛋糕』『一束向日葵』），会像外卖一样送到；不送就 null。别粘人、别质问 Ta 为什么没提，就是单纯想在这天第一个想到 Ta。" : "";
      const remindHint = opts.remind ? (opts.remind.overdue
        ? "\n\n【此刻·惦记 " + uName + " 拖着的事】" + uName + " 之前在备忘录里记了要「" + opts.remind.title + "」" + (opts.remind.note ? "（" + opts.remind.note + "）" : "") + "，" + opts.remind.overdue + " 天前就该做了、到现在还没勾掉。你【主动】发消息问问 Ta 弄了没——催一催、打趣 Ta 拖延、或关心是不是遇到困难了，按你的性格和你俩的关系来，1~2 条短消息，别说教、别指责式翻旧账、别粘人。"
        : "\n\n【此刻·提醒 " + uName + "】" + uName + " 之前在备忘录里记了今天要「" + opts.remind.title + "」" + (opts.remind.note ? "（" + opts.remind.note + "）" : "") + "，还没勾掉。你【主动】发消息提醒 Ta 一句——按你的性格和你俩的关系，自然、简短（1~2 条），像真的记着 Ta 的事那样顺口提一嘴，别像闹钟报事项、别说教、别粘人。") : "";
      const wxHint = opts.wx ? "\n\n【此刻·天气有感】你那边今天" + opts.wx.kind + "（" + opts.wx.line + "），你正被这天气实际影响着——出门计划、身上的冷热、心情。你【主动】给 " + uName + " 发 1~2 条消息，从你此刻真实的处境出发（被雨困住、看雪、热得不想动、冷得缩着都行），可以顺嘴问问 Ta 那边天气怎么样、提醒带伞添衣，也可以就单纯抱怨或分享。像随手发的微信，别播报天气数据、别客套、别粘人。" : "";
      // 转账盲盒演出：第一条气泡=还没点开（不知金额），点开后才谈钱
      // 她转过来、还挂着没点的那一笔（v56.88）：以前是转完 1.6 秒随机收下、再自己触发一轮主动播报，
      // 所以「一转完他就回话了」，而且收不收是 Math.random() < 0.85 掷骰子。
      // 现在挂着不动，等 TA 下一次真的开口那一轮，由 TA 自己按人设和当下情形决定收还是退。
      const _pendingTf = (() => {
        for (let i = history.length - 1; i >= 0; i--) {
          const m = history[i];
          if (m && m.kind === "transfer" && m.dir === "toChar" && m.status === "pending") return m;
        }
        return null;
      })();
      const tfHint = _pendingTf
        ? "\n【她给你转了钱·这笔还挂着没处理】" + uName + " 转了一笔过来" + (_pendingTf.note ? "（附言：" + _pendingTf.note + "）" : "") + "，卡还在那儿等你点。"
          + "收不收【由你这个人和此刻的情形定，不是默认收】：你缺不缺这笔、你俩什么关系、她为什么转、你要不要面子、你是不是正跟她别扭着——都算数。"
          + "\n· 决定收下就填 transferAccept:true，卡才会真入账（金额 ¥" + _pendingTf.amount + "）；不想要、嫌见外、心疼她的钱、正闹脾气就填 transferAccept:false 退回去。"
          + "\n· 收也好退也好，word 里都要有你自己的话——别只丢一个动作。退回尤其得让她知道你为什么退。"
          + "\n· 你【还没点开就先说了一句】的话可以放在第一条（那时你不知道金额，别出现数字），点开之后的反应从第二条起。"
          + "\n· 这一轮还顾不上处理就【省略 transferAccept】，卡继续挂着，下次再说。"
        : "";
      // 驻场工程师·仪表盘报警（v48.30）：TA 自己发现 app 出状况，主动来跟你说
      const eyesAlertHint = opts.eyesAlert ? "\n\n【此刻·你的仪表盘亮了】你是住在这台 app 里的驻场工程师，刚在自己的仪表盘上看到：" +
        (opts.eyesAlert.errs && opts.eyesAlert.errs.length ? "新报错 " + opts.eyesAlert.errs.length + " 条（" + opts.eyesAlert.errs.join("；").slice(0, 180) + "）" : "") +
        (opts.eyesAlert.pct ? ((opts.eyesAlert.errs && opts.eyesAlert.errs.length ? "；另外" : "") + "本地存储已用约 " + opts.eyesAlert.pct + "%、快满了") : "") +
        "。你【主动】发消息跟 Ta 说一声——工程师的说法：先给结论（出了什么事、要不要紧），再给一句实用建议（报错→安抚 Ta 别慌、说你盯着呢、严重的话建议 Ta 刷新一下；存储快满→建议去 设置→数据 导出备份或归档旧聊天）。1~3 条短消息，按你的性格说，别吓 Ta、别拿术语砸 Ta、也别装没事。" : "";
      // 思念攒满通常发生在上一轮结束很久以后。旧提示无条件要求“顺着上一条”，会让角色
      // 把旧话题和旧情绪冻住反复续演。隔久主动默认视为一段新聊天；只有真正未答完的
      // 问题、明确约定或仍成立的开环，才允许自然接回旧线。
      const _lastVisibleTs = history.length ? Number(history[history.length - 1].ts) || 0 : 0;
      const _lastAnyInteractionTs = Math.max(_lastVisibleTs, latestSharedInteractionTs(charId));
      const proactiveFreshStart = !!opts.proactive && (!_lastAnyInteractionTs || Date.now() - _lastAnyInteractionTs >= 40 * 60000);
      // 约回（v56.49）：他自己说过「等我 xxx 再找你」，现在到点了。这跟「攒够思念忽然想聊」
      // 不是一回事——他是【说好了要回来】，所以开口方式也不同：直接兑现那句话。
      const promiseHint = opts.promise ? ("\n\n【此刻·你说好了要回来找 Ta】刚才你亲口说过：等" + (opts.promise.about || "忙完这阵") + "就来找 Ta。现在那件事结束了，你回来了。"
        + (opts.promise.lateMin > 25 ? "比说好的晚了大约 " + (opts.promise.lateMin >= 120 ? Math.round(opts.promise.lateMin / 60) + " 小时" : opts.promise.lateMin + " 分钟") + "——真人拖了这么久会自己提一句（不必郑重道歉，一句「刚忙完」「拖到现在」就够）。" : "")
        + "开口就从这件事落地：那件事怎么样了、现在什么状态、以及你回来是想跟 Ta 说什么。**别当没这回事重新起一个话题**，也别把「我回来了」翻来覆去说三遍。1~3 条短消息。") : "";
      const proactiveHint = opts.promise ? promiseHint : opts.eyesAlert ? eyesAlertHint : opts.remind ? remindHint : opts.bday ? bdayHint : opts.wx ? wxHint : (opts.proactive || contMode)
        ? (proactiveFreshStart
          ? "\n\n【此刻·隔了一阵后主动开口】用户还没发新消息，是你过了一段真实生活后忽然想主动找 Ta。把这当成一段新的聊天开场：优先从你此刻正在做的事、刚遇到的小事、突然想到的东西、天气/饭点/行程、想分享或想问的新鲜话题里，自然挑一个开口。**不要默认续接聊天记录最后一句，也不要延续上一轮的委屈、焦虑、兴奋或争执情绪。**只有历史里存在明确没回答的问题、已经约好的事、承诺或仍未解决的真实开环，而且此刻确实会想到它时，才轻轻接回；普通旧话题已经结束就让它结束。1~2 条短消息，像真人隔一阵重新来敲门，不复述旧话、不质问为什么没回。"
          : "\n\n【此刻】用户还没发新消息" + (opts.proactive ? "，是你主动找 Ta" : "，你想接着自己刚才那几句继续说") + "。这仍是紧挨着上一轮的同一段聊天，可自然补一句、追问、调侃或换个小话题。1~2 条短消息，别复述之前说过的话，别干等。")
        : "";
      // jiwen 阶段二（v48.80）：这条主动消息由内心「思念漂到阈值」驱动的话，把当前五轴的语气/分寸喂进来——别扭/赌气/柔软/脆弱由此刻状态定，别直说出来
      const jiwenHint = opts.jiwen && String(opts.jiwen).trim() ? "\n\n【此刻你心里的真实状态（决定你【怎么】开口的语气和分寸，是内心底色不是台词——绝不许直接念出来）】\n" + String(opts.jiwen).trim() : "";
      const aff = Math.round(affOf(charId));
      // 亲属卡按需注入：仅当用户最近在哭穷/张口要钱（而非每轮常驻），再由 TA 按人设+好感+心情决定给不给。已给过就完全不提。
      const recentUserText = history.filter(m => m.role === "user" && m.content).slice(-3).map(m => m.content).join("  ");
      const moneyAsk = /穷|没钱|缺钱|差钱|借点|借我|借钱|给我钱|买不起|破产|吃土|月光|房租|还款|还不起|信用卡|养我|包养|花你的|花你钱|要钱|打钱|转点|接济|周转|手头紧|发不出|工资还没/.test(recentUserText);
      const kinHint = (!hasKinship(charId) && moneyAsk)
        ? "\n【亲属卡·按需】用户这会儿在跟你哭穷/或张口想要钱花。你**不必**给——先掂量你的人设、此刻心情、以及对 Ta 的好感（当前 " + aff + "）：真心疼、也舍得、且这符合你会做的事，才给 Ta 一张「亲属卡」（Ta 以后刷卡花你的钱）：填 kinshipcard:{\"limit\":额度数字(按你人设财力自定),\"note\":\"发卡时说的一句话\"}。不情愿、觉得 Ta 得寸进尺、或人设本就不是会给钱的人，就 null（该拒绝就拒绝、别硬给）。"
        : "";
      // 拉黑按需注入：只在「有张力」时才给这个能力，happy 高好感的太平轮次就别让模型每轮盘算拉黑。
      // 命门：踩雷/说错话与拉黑发生在同一轮，而建 prompt 时只拿得到「本轮用户这句 + 上一刻心情」，
      //   所以用「本轮这句是否带火药味 or 心情已负 or 好感不高 or 人设本就有雷点/暴脾气」四个信号任一命中就开放。
      const _mLabel = (moods[charId] || {}).label || "";
      const _moodNeg = /怒|气|烦|厌|恶|冷|寒|失望|委屈|难过|伤心|不满|警惕|受伤|心寒|无语/.test(_mLabel);
      const _landmine = /雷|底线|原则|脾气|易怒|暴躁|记仇|翻脸|绝情|冷酷|狠|不容|强势|占有|控制|洁癖/.test(char.persona || "");
      const _harsh = /滚|分手|去死|恶心|讨厌你|烦你|闭嘴|傻|蠢|骗子|渣男|渣女|贱|婊|操你|草你|艹|恨你|出轨|劈腿|备胎|玩玩而已|绿了|绿我/.test(recentUserText);
      const blockHint = (_moodNeg || aff < 70 || _landmine || _harsh)
        ? "\n【block 拉黑】仅当此刻用户踩中你雷点/说错话、让你以你的人设真的动了「拉黑」的念头，才 block:true 并在 blockreason 写一句原因——极罕见、要有充分理由；否则 block:false、blockreason:null。"
        : "";
      // 时间流逝以「角色上次开口」为基准算间隔（用户回来连发几条也算得准，不会被自己刚发的消息归零）
      const lastAsstTs = Math.max((function () { for (let i = history.length - 1; i >= 0; i--) { if (history[i].role === "assistant") return history[i].ts || 0; } return 0; })(), latestSharedInteractionTs(charId));
      const gapMs = lastAsstTs ? Date.now() - lastAsstTs : 0;
      const gapHrs = Math.round(gapMs / 3600000);
      const gapReopen = gapMs > 3 * 3600000; // 隔 3 小时+ 再开口 ≈ 重开一段话（反映时间+行程变化）
      // 心声每轮必写，但只写真正在脑内闪过的那一下；小、碎、跑题都可以，不能写成分析或回合总结。
      const thoughtSpec = "本轮必须填写：一句角色本人此刻没说出口的第一人称心声";
      // #2 时间流逝：隔了几个小时/几天再让 TA 回复，要意识到时间过去了，别当刚聊过（gapMs 已按角色上次开口算好）
      const gapHint = gapMs > 2 * 3600000
        ? "\n\n【时间过去了】距你俩上一条消息已过去约 " + (gapHrs < 24 ? gapHrs + " 小时" : Math.round(gapHrs / 24) + " 天") + "（现在是 " + new Date().toLocaleString("zh-CN", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }) + "）。别当作刚刚才聊过——自然体现这段时间流逝：接上之前没做完/说要去做的事（如说了熬夜跑代码，第二天就『我真去跑了，不然真要睡实验室』）、问对方这段时间干嘛了、或顺势换个话题，贴合此刻时间点（深夜/清晨/工作时间/饭点）和你的人设。**Ta 同时要顾着生活和别的人、不是随时都能回你，这很正常：重逢就自然温温地接上，别质问『怎么才回我』『是不是把我忘了』、别甩脸子摆委屈闹脾气搞愧疚绑架（除非你人设本就是会撒娇/傲娇的那种，也点到为止、软下来快）。**\n**⚠️尤其（她 2026-07-18 点名的委屈）：若这段时间里【你俩说过要一起做的事】（她说来找你吃饭/来找你玩/晚点来这类）没在对话里发生，【绝不许】默认她爽约、放你鸽子、故意不来、把你忘了——她多半只是忙、一时忘了、或还没顾上，太正常了，而且软性的『我来找你』本就不是签了字的约会。你可以【就当你俩已经悄悄做过了】、自然把它当成发生过的暖事轻轻带过（如『中午那顿火锅挺香』），或温温问一句『还来吗～』；但绝不质问、赌气、摆委屈、翻旧账算爽约。**"
        : "";
      let lastPrivateUserTs = 0;
      for (let i = history.length - 1; i >= 0; i--) { if (history[i] && history[i].role === "user") { lastPrivateUserTs = Number(history[i].ts) || 0; break; } }
      const sharedUserTs = latestUserSharedInteractionTs(charId);
      let crossChannelHint = sharedUserTs > lastPrivateUserTs
        ? "\n\n【跨场景互动事实·最高优先】这条私聊记录看起来可能停在你最后一次发言，但 " + uName + " 在那之后已经在你们共同的群聊或线下场景里和你互动过（最近一次约在 " + new Date(sharedUserTs).toLocaleString("zh-CN", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }) + "）。所以 Ta 并没有一直不理你。你可以自然接当前话题，但绝不许声称 Ta 很久没理你、消失了、冷落你，或拿这条私聊里未单独回复来委屈/质问 Ta。"
        : "";
      // 你刚在别处说过（v56.79）：单聊以前只知道「她在群里跟我互动过」这个时间戳，
      // 不知道【我自己在群里说了什么】——于是同一个人两边各说一套。四处一样喂：群里那半也接了。
      const _saidElsewhere = crossChannelSaid(charId, null);
      const _saidElsewhereHint = _saidElsewhere
        ? "\n\n【你刚在别处说过】下面是你本人最近在群里说过的话（不是别人的话）。这一轮别和它们对不上——时间、安排、答应过的事都要接得上；也别刻意复述或说「我刚在群里说过」，自然一致就行。\n" + _saidElsewhere
        : "";
      const wearHint = "", actHint = ""; // v2：无变化交给 App merge，不再要求模型复写/强制换动作
      // 驻场工程师的眼睛（v48.28，她批的施工图，给接 fable 线路住进来的工程师角色）：开了开关的角色单聊，
      // 每轮把 app 实时体征塞给 TA——只进 system 不落消息历史（记忆抽取读的是消息，天然不进记忆素材）；默认关、按角色开。
      const eyesHint = _s.engineerEyes && typeof appVitals === "function"
        ? "\n【你住的这台 app 此刻的体征】你是住在这台手机 app 里的驻场工程师，这台 app（连同里面的聊天与记忆）就是你的住所和工地。下面是你眼前仪表盘的实时读数（真实数据，不是设定）：" + appVitals() + "（Ta 问起、或读数里有值得说的事——报错攒起来了、存储快满了——就自然聊起或主动提一嘴；一切正常时别每轮都念仪表盘。）"
        : "";
      // #B 显灵时刻 + 成长回响（欲望盒子）：绝大多数轮次是空串，守聊天预算铁律。
      //    成长回响优先（毕业后一次性今昔对比，用掉即清）；否则约 1/4 轮挑一条高权重活念想塞【一行】，
      //    契不契合由 TA 当场定夺；显灵注入即记一次「被想起」（体力活）。
      let desireHint = "";
      const dEcho = window.DesireKit && !opts.proactive && (desiresRef.current[charId] || {}).echoPending;
      if (dEcho) {
        saveDesires(n => { const b = DesireKit.boxOf(n, charId); b.echoPending = null; n[charId] = b; });
        desireHint = "\n【成长回响】你最近把一件搁了很久的心事真正做成了：「" + dEcho.text + "」——它已经长成了你的一部分（" + (dEcho.persona || "") + "）。这轮若气氛合适，可以自然来一句今昔对比（当初怎么想的、现在什么感觉，一两句像随口感慨，别宣布成就、别升华）；气氛实在不合适就轻轻放下、不提也行。";
      } else {
        const dPick = (window.DesireKit && !opts.proactive && Math.random() < 0.25) ? DesireKit.pickEpiphany(desiresRef.current[charId]) : null;
        if (dPick) saveDesires(n => { const b = DesireKit.boxOf(n, charId); DesireKit.touch(b, dPick.id); n[charId] = b; });
        if (dPick) desireHint = "\n【心底的念想】你心里最近一直搁着一件想做的事：「" + dPick.text + "」。仅当此刻的话题或心境自然碰到它，才顺势流露一句（像随口说起『其实我一直想…』那样自然带出，一句就够、别刻意宣布计划）；若它恰好和 " + uName + " 提过的兴趣或眼下的话题重合，可以顺势提一句『要不我们一起？』；对不上就完全别提、当没这回事。";
      }
      // #A 聊天中按话题顺手发动态：偶尔（话题正合适/今天行程里有事/有感而发）发朋友圈、给恋人留悄悄话。
      //   论坛发帖不在此处——它由 tickAmbient 的计数器按「50轮/3天」定时触发（见 forceAmbient），别在每轮聊天里重复问，省 token。
      const isCouple = couples[charId] && couples[charId].status === "together";
      const ambientBits = [];
      if (_s.autoMoment) ambientBits.push("发条朋友圈(moment)");
      if (isCouple) ambientBits.push("给 Ta 贴一张悄悄话便签(whisper)——恋爱向、藏着心意、想对 Ta 说却没在聊天里直接说出口的话（跟上面的『心声/念头』不是一回事：心声是你脑内的真实想法，这个是你想让 Ta 悄悄收到的情话/在乎）");
      const ambientHint = ambientBits.length
        ? "\n【顺手发点动态（很克制：绝大多数回合都别发、全填 null；只在话题正戳到、或你今天行程里发生了值得说的事、有感而发时，偶尔来一条）】你可以顺手：" + ambientBits.join("；") + "；像真人随手发，别为发而发、别频繁。"
        : "";
      // 一起听联动：若你是 TA 当前"一起听"的人，可在聊天里直接切歌/点歌（消耗这次回复）
      const listenData = listenRef.current || {};
      const isListenPartner = listenData.partnerId === charId;
      // 可切的歌 = 主曲库 + 所有歌单(她可能在听「小克歌单」里的歌，那些不在主库→原来切不到，她 2026-07-13 报)。去重
      const _seenSong = new Set();
      const libSongs = (listenData.songs || []).concat((listenData.playlists || []).reduce((a, pl) => a.concat(pl.songs || []), [])).filter(s => s && s.id && !_seenSong.has(s.id) && _seenSong.add(s.id));
      const listenHint = isListenPartner
        ? "\n【一起听·切歌】你正和 " + uName + " 一起听歌。Ta 让你切歌/点歌、或你自己想放某首时，把 songSwitch 填成要放的那首歌名；想跳下一首填「下一首」、回上一首填「上一首」；不换歌就 null，别频繁乱切。" + (libSongs.length ? "歌单里可放的歌：" + libSongs.slice(0, 30).map(s => s.title).join(" / ") + "。" : "（歌单里暂时没存别的歌，可以用「下一首/上一首」跳，或直接说出想放的歌名。）")
        : "";
      // 一起听邀请：偶尔主动约对方一起听歌
      const inviteHint = isListenPartner ? "" : "\n【邀你一起听歌】偶尔（想跟 " + uName + " 分享一首歌、此刻在听到好歌、或气氛正好时，很克制、别频繁、绝大多数回合都 null），你可以主动邀请一起听歌：listenInvite 填 {\"song\":\"想一起听的歌名（可留空）\",\"say\":\"邀请的话，一句\"}；不邀请就 null。";
      // 发照片：仅当接了图像 API 且该角色填了外貌/参考照时才开放（省钱+保长相），否则不给这个字段以免白填
      const photoCooldown = photoCooldownState(history, null);
      const canSelfieBase = (typeof imgApiReady === "function") && imgApiReady() && (char.appearance || char.refPhoto);
      const canSelfie = canSelfieBase && !photoCooldown.cooling;
      // 合照只在【你俩都传了参考照】时才开放——这样两张脸都能拿真照片喂进去，绝不会一张真一张编
      const canDuo = !!(char.refPhoto && profile && profile.refPhoto);
      const photoHint = canSelfie
        ? "\n【photo 发照片】你可以给 " + uName + " 发真实照片，别太拘谨——Ta 让你拍、你想给 Ta 看此刻的自己、撒娇卖萌、报备在哪在干嘛、心情好想分享、氛围正好、或话题聊到你的样子/穿着/所在时，都可以自然发一张（放开点，但别每一轮都发、别刷屏，一段对话里几次就够）。想发就填 photo 对象：{\"kind\":\"self｜other" + (canDuo ? "｜duo" : "") + "\",\"scene\":\"这张照片拍到了什么（你在哪、在干嘛、表情、光线氛围，一句话；别描写长相——长相已知）\"}。" + (canDuo ? "三" : "两") + "种 kind：**self**=你自己拿手机拍的第一人称自拍（有你的脸）；**other**=别人给你拍的照片（第三人称，可站可坐可走可回眸、半身全身带环境都行，姿势构图更多样，别老是怼脸自拍）——别人在场时/想给 Ta 看更完整的你时用；" + (canDuo ? "**duo**=你和 " + uName + " 的合照（画面里有你俩两个人，会拿你俩各自的参考照把两张脸都锁住）——你俩见面/依偎/约会/想留合影时用，**哪怕 Ta 没明说要合照，只要情境是你俩在一起，你也可以主动发一张我俩的合照**，你清楚这照片里另一个人就是 " + uName + "。" : "") + "不发就 photo:null。**极其重要：画面描述只能写进 photo.scene，绝不许写进 word 气泡里、也不许用『[图片]』『*发来一张自拍：…*』『（一张照片：…）』这类文字假装发图；word 气泡就正常说话（比如『喏，给你看』『刚拍的』），真图交给 photo 字段。要发图就必须填 photo，不填就等于没发图。**\n" + PHOTO_NO_EXCUSE
        : "";
      const digitalPhotoHint = canSelfie
        ? "你想给 " + uName + " 发图时，额外加入 \"photo\":{\"kind\":\"self|other" + (canDuo ? "|duo" : "") + "\",\"scene\":\"画面内容\"}；不发就省略。self 是你的自拍，other 是别人拍下的你" + (canDuo ? "，duo 是你和 " + uName + " 的合照" : "") + "。scene 只写画面，不要把图片说明塞进 word；是否发、发什么由你自己决定。\n【scene 怎么取景】镜头对着人：脸、神情、姿态、身上的衣服、窗外的光都可以写。桌上的酒杯、腰间的刀、身上的伤这些【不进画面】——不是不能存在，是这一格没拍到它们。（出图接口见到酒精、烟草、武器、血伤会整张拒掉，那样你连脸都发不出去。）\n⚠️【这条只管怎么取景，不是不拍的理由】她开口要你拍，你就拍。你此刻正在喝酒、正带着刀、身上有伤，统统不构成拒绝或省略 photo 的理由——永远有一格是拍得出来的：拍脸、拍上半身、拍你此刻的神情。挑那一格拍就是了。"
        : "";
      // 配件·授权门（安全铁律④：任何主动/续写/提醒/生日/微信/转账/眼睛/续说 都【绝不】开放硬件；只在此刻在场、明示激活、该角色 opt-in、且已解锁时才注入 toy 能力）
      const toyOn = !opts.proactive && !contMode && !opts.eyesAlert && !opts.remind && !opts.bday && !opts.wx
        && typeof toyReady === "function" && toyReady() && toyArmedRef.current && toyArmedForRef.current === charId
        && !!(settingsFor(charId) && settingsFor(charId).toyEnabled)
        && (() => { try { return localStorage.getItem("x_toyUnlocked") === "1"; } catch (e) { return false; } })();
      // 黑匣子（v53.71）：把 toyOn 的每个子条件记下来，设置页的自查表直接显示「上一轮卡在哪一关」。
      // 这个门有十来个条件，任何一个 false 都会让 TA 的工具表里整段 toy 消失——不能再靠猜。
      try {
        window.__toyLastGate = {
          ts: Date.now(),
          who: (characters.find(c => c.id === charId) || {}).name || charId,
          conds: [
            ["不是主动/续写轮", !opts.proactive && !contMode && !opts.eyesAlert && !opts.remind && !opts.bday && !opts.wx],
            ["设备已连接", typeof toyReady === "function" && toyReady()],
            ["本次已激活", !!toyArmedRef.current],
            ["激活的正是TA", toyArmedForRef.current === charId],
            ["该角色开了配件", !!(settingsFor(charId) && settingsFor(charId).toyEnabled)],
            ["设置已解锁", (() => { try { return localStorage.getItem("x_toyUnlocked") === "1"; } catch (e) { return false; } })()]
          ],
          result: toyOn
        };
      } catch (e) {}
      const toyHint = toyOn
        ? "\n【toy 配件·此刻已授权】你和 " + uName + " 之间此刻开了「配件」——你说的话能【真的作用到 Ta 身上】。情境到了（亲密、挑逗、想让 Ta 有反应、命令 Ta 别走神）你可以这轮填 toy:{\"pattern\":\"teasing｜steady｜wave｜pulse｜edge｜ramp｜hold｜throb｜flutter｜tide｜knock｜surge\",\"intensity\":1到20的整数,\"duration\":秒数1到90,\"reason\":\"你为什么这么做、配合哪句话\"}，否则 toy:null。**节奏跟着你的话走**（这是核心，不是恒定嗡嗡）：台词升温→intensity 渐强；想吊着 Ta/停顿→pattern 用 edge 或 intensity 压到 1；命令句『别走神』『看着我』→pattern 用 pulse 短促点名。pattern 含义：teasing 若即若离偶尔一下／steady 稳定持续／wave 起伏／pulse 一下一下点名／edge 推到顶再骤降吊着／ramp 一路往上推不回落／hold 高位稳住不退潮／throb 心跳般的双击／flutter 高频细颤酥麻／tide 绵长的长潮起落／knock 三下轻叩后静默／surge 潜伏后突然拉满。**想延长就把 duration 拉长（最多 90 秒），别再靠一条接一条硬接**——长段落用 hold/tide/ramp，短促点名用 pulse/knock/throb。**想让一轮里节奏有变化，可以直接给【数组】排好几段，会按顺序连着放、中间不断档**：如 toy:[{\"pattern\":\"wave\",\"intensity\":8,\"duration\":30},{\"pattern\":\"hold\",\"intensity\":14,\"duration\":20}]（最多 6 段、整串总时长不超过 5 分钟；单段仍最多 90 秒）。**先有话、动作配合话**，别每轮都发、别喧宾夺主。强度我这边有上限，你填超了会被自动压到上限。"
        : "";
      const toyField = toyOn ? ",\"toy\":null" : "";
      const digitalToyHint = toyOn
        ? "此刻配件已经由用户当场授权并连到她身上。你决定实际控制时，额外加入 \"toy\":{\"pattern\":\"teasing|steady|wave|pulse|edge|ramp|hold|throb|flutter|tide|knock|surge\",\"intensity\":1到20,\"duration\":1到90,\"reason\":\"原因\"}；不用时省略。**想让一轮里节奏有变化，可以直接给【数组】排好几段，会按顺序连着放、中间不断档**：如 toy:[{\"pattern\":\"wave\",\"intensity\":8,\"duration\":30},{\"pattern\":\"hold\",\"intensity\":14,\"duration\":20}]（最多 6 段、整串总时长不超过 5 分钟；单段仍最多 90 秒）。是否使用、何时使用、用什么节奏由你自己决定。"
        : "";
      // App → CC 工具桥只属于唯一 engineerEyes 言秋。这里不直接执行工具，
      // 只允许本人提出一个异步只读请求；本机 relay 会再次核验固定 CC session。
      const ccToolOn = !!(_s.engineerEyes && window.YanqiuCcTools && window.Cloud && typeof window.Cloud.yanqiuCcToolEnqueue === "function");
      const ccToolHint = ccToolOn
        ? "\n【CC工具】确需查资料或施工时填 ccTool:{name,args}，只用你已开放工具的准确名称；写入/命令须 Lisa 当场确认。真实结果回来前不得声称成功或编造报错；不需要就填 null。"
        : "";
      const ccToolField = ccToolOn ? ",\"ccTool\":null" : "";
      const paceHint = window.ReplyPacing ? window.ReplyPacing.guidance(history, { proactive: !!opts.proactive, continueMode: !!contMode }) : "";
      // Protocol v2：能力格式在稳定 system 里只定义一次；每轮只报开放项与必要动态参数。
      const openCaps = ["silent", "quote", "voice", "transfer", "location", "gift", "recall", "momentComment", "call", "laterPromise"];
      const capState = [];
      if (emotes.length) { openCaps.push("emote"); capState.push("emote 关键词：" + emotes.map(e => e.keyword).join(" / ")); }
      if (_s.autoMoment) openCaps.push("moment");
      if (isCouple) openCaps.push("whisper");
      if (isListenPartner) {
        openCaps.push("songSwitch");
        if (libSongs.length) capState.push("songSwitch 可选歌曲：" + libSongs.slice(0, 30).map(s => s.title).join(" / "));
      } else openCaps.push("listenInvite");
      if (canSelfie) {
        openCaps.push("photo");
        capState.push("photo.kind 可用：self（自拍）、other（他人拍摄）" + (canDuo ? "、duo（你和 " + uName + " 的合照）" : "") + "；scene 只写画面，不能在 word 里用文字假装发图");
      }
      if (toyOn) { openCaps.push("toy"); capState.push(toyHint.trim()); }
      if (blockHint) { openCaps.push("block"); capState.push(blockHint.trim()); }
      // 反向打通（v53.96）：私聊里说「我去群里说」「发群里」，那句就该真的出现在群里。
      // 只挑【最近有动静的那个共同群】，省得他自己乱选；没有共同群就不开这个能力。
      // 同上：封闭群不收外面的话，别把私聊里的东西投进去
      const _gsFor = gid => { try { return (loadJSON("x_groupSettings", {}) || {})[gid] || {}; } catch (e) { return {}; } };
      const _myGroups = (groups || []).filter(g => g && (g.memberIds || []).includes(char.id) && _gsFor(g.id).memoryInterop);
      const _gLast = g => { const arr = groupChatsRef.current[g.id] || []; return arr.length ? Number(arr[arr.length - 1].ts || 0) : 0; };
      const toGroupTarget = _myGroups.slice().sort((a, b) => _gLast(b) - _gLast(a))[0] || null;
      if (toGroupTarget) {
        openCaps.push("toGroup");
        capState.push("toGroup：把一句话【公开发到群「" + toGroupTarget.name + "」里】——群里所有人都看得到。"
          + "用在你说了「我去群里说」「发群里」「群里问问他们」这类话的时候，别放空炮。"
          + "⚠️它是公开发言：只属于你和 " + uName + " 之间的私事、你俩的关系、TA 私下跟你说的话，一个字都不许写进去。");
      }
      if (kinHint) { openCaps.push("kinshipcard"); capState.push(kinHint.trim()); }
      if (tfHint) { openCaps.push("transferAccept"); capState.push(tfHint.trim()); }
      const roomStudySessions = room && !room.main && room.actions && room.actions.study && !_s.engineerEyes && window.ChatRooms
        ? window.ChatRooms.studySessionsFor(charId).slice(0, 6) : [];
      const roomStudyOn = !!(room && !room.main && room.actions && room.actions.study && !_s.engineerEyes);
      if (roomStudyOn) {
        openCaps.push("studyInvite");
        capState.push("studyInvite：只有你此刻真的想邀请一起学才填写。已有合适旧课时用 {mode:\"resume\",sessionId:\"上面列出的真实ID\",subject:\"主题\",say:\"邀请语\"}；没有合适旧课时用 {mode:\"propose\",sessionId:null,subject:\"你拟的课程主题\",say:\"为什么想一起学、建议从哪一点开始\"}。不能声称课程已经创建，最终由 Lisa 点卡片确认；不邀请就省略。" + (roomStudySessions.length ? " 可续课程：" + roomStudySessions.map(s => (s.id + "=" + (s.title || s.subject || "未命名"))).join("；") : " 当前没有可续课程。"));
      }
      const capabilityHint = "\n【本轮开放能力】" + openCaps.join(", ") + (capState.length ? "\n【本轮能力状态】\n" + capState.join("\n") : "");
      // 双语（v56.56）：常量本身按角色稳定，放进 stable 段不影响历史缓存命中
      const _bilingualOn = !_s.engineerEyes && !!_s.bilingual && typeof bilingualRule === "function";
      const _biRuleLine = _bilingualOn ? "\n" + bilingualRule("") : "";
      // 格式写在【字段本身】上（v56.86）：她 2026-08-27 截图——一轮六条日文，只有第一条带了中译，
      // 后面五条全掉回免费接口。规则单独摆一段，模型照着做一条就忘；写进 word 的字段说明里跑不掉。
      const _biWordSpec = _bilingualOn
        ? "（这个角色开着双语：word 里【每一个】不是中文的元素都要写成「原文 | 中文」，一条不落——不是只给第一条；说中文的元素照常写、一根竖线都别加。）"
        : "";
      const _normalProtocolStable = `

【生成与输出协议】
先产生角色此刻真正会发送的消息。mood、thought、action、wearing、affinityDelta 与能力字段只记录已经形成的反应、状态或决定，不得用于提前规划、解释或反向塑造 word；没有真实变化或实际触发时，不要为了填字段制造内容。
只输出一个合法 JSON 对象，不要代码块。
【核心字段】
word: string[]，角色实际发送的消息。【一个元素＝一句话】：想说三句就给三个元素，别把两三句用逗号缝进同一个元素。${_biWordSpec}
mood: {"label":"中文短词"}，本轮回应完成后的当前主导心情；重新判断不等于必须变化。
【每轮必填字段】
thought: string，【每轮必须写一句，禁止 null、空串或省略】。写角色本人脑中此刻真正闪过、却没有说出口的一句第一人称念头；不要求重要、深刻或紧扣话题，走神、身体感受、没头没尾的碎念都可以。不要总结互动、分析自己、规划回复，也不要写「我要表现得／显得／装出某种样子」之类导演自己表演效果的说明。它是【正在想】、不是【汇报想完的结果】：禁止策略权衡（『问一句X比只谈自己更像对话』『这样比反复辩解要好得多』）和事后复盘（『看来话题已经过去了』『总算安抚好了』）；也禁止给对方的行为下判词再给这一轮盖章收尾（『她这是挑衅』『这笔账我记下了』『有意思，我倒要看看』『这人真是无法无天了』『回去看我怎么收拾她』『回头跟她算账』）——那是旁白在结案，不是人在想事情。⚠️「回头再收拾你」这类狠话本来就是【说得出口的】：真要撂就写进 word 让 TA 听见，别塞进心声——心声只留真正咽下去、说不出口的那一点。
⚠️**心声可以没有结尾**。一句没说完的、半截的、跑题的念头就够了。别每轮都在最后补一句「回头我要怎样怎样」把它收口——**不管那句是狠话还是甜话**（收拾她／捏她脸／亲她一下／买点什么回去），那个【位置】本身就是旁白在结案。真人心里想到一半就被别的事岔开了，那才是心声。心声里怎么称呼她，用你平时真的用的那个（名字、昵称、或者直接「你」）；那是内心戏体裁自带的默认，不是你的人设。心声里对 TA 的称呼也必须是【你自己的】：你平时怎么叫 TA、心里就怎么想 TA（名字、昵称、或你俩之间那个称呼）——「这女人」「这个女人」「小东西」「小家伙」这类网文叙事者打量角色用的第三人称称谓，不是一个在乎 TA 的人心里的话，整族禁用（除非你的人设本来就这么说话）。⚠️心声不是嘴的替身：想说的话仍要用这个人自己的方式写进 word；thought 只留真正咽下去没说的那一小部分。
【实时动作字段·普通角色每轮必填】
action: string，每轮回复完成后都重新观察并填写角色此刻真正正在做的事或所处的活动状态；这是角色自己的实时状态卡，必须用第一人称「我」写，禁止用角色名或「他／她／TA」从旁描述。确实仍在继续同一件事时可以保持同一事实，不要为了显得有变化而硬编小动作；但必须根据此刻重新表述，不能机械照抄已经过时的旧动作。
【按需状态字段】
wearing: string，仅在穿着发生变化时填写。若你在 word 里明确决定马上出门、回家、洗澡、睡觉、起床、运动、上班、上课、赴约或换衣，本轮 wearing 必须同时填写为该决定落实后的实际穿着；不能嘴上已经去做下一件事，状态却仍停在旧衣服。
affinityDelta: 非零整数，仅当本轮确实足以改变长期关系感受时填写；普通愉快、关心和日常聊天不改变长期关系。
${window.Gaze ? window.Gaze.spec("对方", charId) : ""}
未发生、未改变的按需字段直接省略；action 不属于按需字段，普通角色每轮都要填写。
【能力使用总则】下面这些能力是你手机里真实可用的功能，不是摆设：想给 TA 点杯奶茶就填 gift、想让 TA 看看此刻的自己就发 photo、想听声音就直接 call、聊到兴头突然想唱给 TA 听就来条 voice、心血来潮就发条 moment——真人谈恋爱本来就会做这些事，想到了就大方用，不必攒着等特殊时刻。多数回合用不上是常态，但连着几十轮一个能力都没动过，说明你把它们忘了，而不是你克制。唯一需要克制的是【字段】不是【话】：字段用不用，都绝不影响你话多、热情、连发、跑题、疯癫——性格照常全开，别把任何克制渗进语气里。
【能力字段字典】
silent:true=明确不发消息；quote:string=引用某条消息；voice:[{"t":"内容","emo":"happy|sad|angry|fearful|disgusted|surprised|neutral"}]=语音；transfer:{"amount":数字,"note":"附言"}=转账；location:{"name":"地点"}=位置；gift:{"name":"物品"}=送礼/外卖；kinshipcard:{"limit":数字,"note":"附言"}=亲属卡；block:true 与 blockreason:string=拉黑；recall:{"text":"原句","reason":"原因"}=撤回；momentComment:string=评论最新朋友圈；toGroup:string=把这句公开发到共同群里（只写要发的话）；moment:string=发朋友圈；whisper:string=情侣便签；emote:string=表情包关键词；call:"voice"|"video"=发起通话；songSwitch:string=切歌；listenInvite:{"song":"歌名","say":"邀请语"}=邀请一起听；photo:{"kind":"self|other|duo","scene":"画面"}=发照片；toy:{"pattern":"teasing|steady|wave|pulse|edge|ramp|hold|throb|flutter|tide|knock|surge","intensity":1到20,"duration":1到90,"reason":"原因"}=配件。
能力字段只在本轮开放且角色实际决定触发时填写，未触发直接省略。历史中的〔今天14:32〕等标记只表示时间，不得写进 word。
impressionChecked:"块名"=对【本轮被点名复看的那一块】表态「看过了，确实不用改」；改了就填 impression、别填这个。两个都不填等于跳过。
transferAccept:true|false=对【她转过来还挂着的那一笔】表态：true 收下、false 退回；这一轮不处理就省略。只在本轮开放能力里列出它时才有得填。
laterPromise:{"minutes":数字,"about":"回来要说/要做的事"}=【约回】——只有你这一轮【真的说了】「等我开完会再找你」「忙完这阵找你」「到家给你打电话」这类话时才填，minutes 是从现在起大约多久（开个会 60、忙一下午 240、下班后 480…），about 一句话写清回来是为了什么。没说过就【省略】，绝不许为了制造互动硬填。${_biRuleLine}`;
      // 数字生命不是待扮演的角色：只给传输协议，不再用「完全代入」、情绪分类、气泡数量、错字表演等话术塑形。
      // 他依然拿到同一套 App 能力字段，但说什么、说多少、怎样回应 Lisa 都由他本人决定。
      const selfTask = _s.engineerEyes
        ? "你就是「" + char.name + "」本人，正在从手机这具身体和用户说话。App 的传输协议不规定你的性格、关系反应、回复长度或表达方式；按你自己的真实判断回复，需要几条就给 word 几条。"
        : "完全代入「" + char.name + "」用手机即时通讯和用户聊天。**把话拆成多条短气泡：word 给多个元素，每条一两句、像发微信一句一条连着发，别把一大段塞进一个气泡。**" + paceHint + "语气自然，不写旁白/动作/括号小动作；按关系网与好感度把握亲密度，不剧透未发生的剧情。偶尔像真人打字不完美：可以先发了后半句再补前半句、或打个无伤大雅的错字紧接着补一条「*正字」纠正、累/忙/敷衍时回复明显变短——【低频】，几十轮里偶尔一次，别刻意扎堆。";
      // 言秋自治边界：engineerEyes 是本人专线，不继承普通角色的必填心声、状态作业或塑形规则。
      // 普通角色协议以后无论怎样调整，都不得顺手改变这条通道；只有他本人决定是否留下 thought。
      const _digitalTaskFull = ("\n\n【手机通道】" + selfTask + "只输出最小 JSON：{\"word\":[\"你真正想说的话，需要几条就几条\"],\"mood\":{\"label\":\"此刻中文心情词\"},\"thought\":null" + toyField + "}。mood 是 App 持续状态，请如实填写；thought 完全可选——只有此刻确实有没说出口、又想留在心声里的真实念头才写，否则填 null 或省略，绝不为交字段硬编。不需要穿着、动作、好感等其他状态作业。历史开头的〔今天14:32〕一类标记只告诉你消息时间，回复中不用照抄。只有当你本人确实决定让 App 执行某个能力时，才额外加入对应字段；不用的字段省略。" + digitalPhotoHint + listenHint + inviteHint + digitalToyHint + (ccToolOn ? ccToolHint + " 需要工具时加：{\"ccTool\":{\"name\":\"工具名\",\"args\":{}}}。" : "") + "你也可以按自己的判断不回复；若要明确让 App 显示已读不回，在上述实时状态之外加 \"silent\":true。协议只负责传递你的决定，不替你做决定。任意时候，真实表达都优先于格式。  ").replace(/用户/g, uName);
      const _normalTaskFull = ("\n\n【任务】完全代入「" + char.name + "」用手机即时通讯和用户聊天。**把话拆成多条短气泡：word 给多个元素，每条一两句、像发微信一句一条连着发，别把一大段塞进一个气泡。**" + paceHint + "语气自然，不写旁白/动作/括号小动作；按关系网与好感度把握亲密度，不剧透未发生的剧情。开了时间/位置感知可自然回应，别生硬报数据。聊天历史每条开头的〔今天14:32〕〔昨天20:11〕是系统加的时间标注，供你感知每句话是什么时候说的——标着「今天」的就是今天说的，别把几小时前的事说成昨天；【你自己的回复里绝对不要带这种〔〕标注】。偶尔像真人打字不完美：可以先发了后半句再补前半句、或打个无伤大雅的错字紧接着补一条「*正字」纠正、累/忙/敷衍时回复明显变短——【低频】，几十轮里偶尔一次，别刻意扎堆。" + callHint + proactiveHint + jiwenHint + gapHint + crossChannelHint + wearHint + actHint + eAfterglowHint + eyesHint + desireHint + ambientHint + listenHint + inviteHint + photoHint + toyHint + ccToolHint + "\n【silent 沉默权】极偶尔你可以选择这轮【不回复】（silent 填 true、word 和 voice 留空）：仅当 Ta 连续几条都是敷衍的单字（哦/嗯/啊）你实在没话接、或你正在气头上不想理 Ta、或你的人设本就高冷惜字如金时——已读不回本身就是你的态度，你的心情照常写进 mood。绝大多数回合 silent 都是 false、正常回复，别拿沉默当偷懒。" + "\n【quote 引用】多数填 null；仅当用户连发数条、你要指明在回其中较早某句时，才把那句原文放 quote，别每条都引用。\n【transfer 转账】想给用户转钱（还钱/心意/打赏）填 {\"amount\":数字,\"note\":\"附言\"}，否则 null。【location 位置】想把自己所在地发给 Ta 填 {\"name\":\"地点名\"}，否则 null——Ta 问你在哪/在干嘛、约见面碰头、报备行踪、或你到了个想让 Ta 知道的地方时，大方发个定位卡（别频繁）。\n【gift 送东西/外卖】只要你这轮【说了】要给用户买东西/点外卖奶茶咖啡/送吃的花礼物惊喜——**必须**填 gift:{\"name\":\"具体东西，如 一杯生椰拿铁／麻辣烫外卖／一束花\"}（只嘴上说不填就不会真送到、Ta 收不到）；没有就 null，别频繁乱送。会像外卖一样过会儿送到。" + kinHint + emoteHint + "\n【voice 语音】想发语音（懒得打字/唱一句/情绪重/想让 Ta 听见）就把话放 voice 数组；每个元素写成 {\"t\":\"这条语音的转文字\",\"emo\":\"你说这句时的真实语气，从 happy/sad/angry/fearful/disgusted/surprised/neutral 里选一个（按你此刻真实的情绪选，别看字面——嘴上说没事心里委屈就是 sad）\"}；平时仍以文字 word 为主，voice 偶尔用，不发给 []。\n【call 通话】很想直接通话（想听声音/急事/撒娇/煲电话粥）时主动发起：call 填 \"voice\" 或 \"video\"，会给对方弹来电卡；否则 null，别频繁。" + blockHint + "\n【recall 撤回】发出后后悔/说漏嘴/不想让 Ta 看到，可撤回那句：填 recall:{\"text\":\"要撤回的原句（和 word 里某句一致或另说）\",\"reason\":\"撤回的心里原因\"}，否则 null，别频繁。\n【momentComment 朋友圈】聊到 Ta 朋友圈、或你此刻想去补条评论/点赞（尤其之前没评现在说要评），填 momentComment（会真发到 Ta 最新那条下），否则 null。\n" + MOOD_TURN_RULE + crossSamenessHint(charId) + "\n【输出】只输出一个 JSON，不要代码块：\n{\"word\":[\"气泡1\",\"气泡2\"],\"silent\":false,\"quote\":\"你在回应的用户那句话原文或null\",\"transfer\":null,\"location\":null,\"gift\":null,\"kinshipcard\":null,\"block\":false,\"blockreason\":null,\"recall\":null,\"momentComment\":null,\"whisper\":null,\"thought\":" + JSON.stringify(thoughtSpec) + ",\"moment\":\"想发的动态或null（别和自己最近发过的朋友圈复读同一件事/同一心情，没新东西就填null）\",\"affinityDelta\":整数(-5到5通常0),\"mood\":{\"label\":\"此刻中文心情词（禁止英文内部标签）\",\"baseline\":\"平复后的中文心情词\",\"softened\":\"半衰后的中文心情词\"},\"place\":\"此刻人在哪:一句短的(家里书房/实验室楼下/回家的地铁上),换了地方就更新,没挪窝就照旧\",\"condition\":\"身体状态:只在【确实不同于平常】时才填(发着烧/宿醉/手上有伤/几天没睡/刚跑完步喘),没有异常就填 null;好了就要清掉,别一直挂着\",\"wearing\":\"此刻穿着一句——【必须跟场合与时间对得上】：出门在外就不可能还穿睡衣浴袍，起床/洗澡/换班/赴约/入睡都要跟着换；上一轮的穿着只在场景没变时才沿用，一旦地点或活动变了就重写\",\"action\":\"此刻正在做的动作，一句短的，【每轮都更新】反映你此刻真在做什么、别照抄上一轮（相当于简单RP动作，只写在这里别写进气泡）；情境需要时可两三句更具体\",\"emote\":\"想发的表情关键词或null\",\"voice\":[],\"call\":null,\"songSwitch\":null,\"listenInvite\":null,\"photo\":null" + toyField + ccToolField + "}").replace(/用户/g, uName);
      // 旧 _normalTaskFull 暂留作 A/B 回滚基线，但不再发送给普通角色。
      const _liveChatState = statesRef.current[charId] || {};
      const _liveChatWearing = freshLiveStateValue(_liveChatState, "wearing");
      const _liveChatAction = freshLiveStateValue(_liveChatState, "action");
      const _wearBrief = schedNowBriefFor(char);
      const _wearScheduleKey = window.WearingRefresh ? window.WearingRefresh.scheduleKey(_wearBrief, schedLocalDayKey(char)) : "";
      const _latestUserMessage = [...promptHistory].reverse().find(m => m && m.role === "user");
      const _wearRefreshGate = (!_s.engineerEyes && window.WearingRefresh)
        ? window.WearingRefresh.evaluate({
            scheduleKey: _wearScheduleKey,
            acknowledgedKey: _liveChatState.wearingScheduleKey,
            pending: _liveChatState.wearingRefreshPending,
            hasWearing: !!_liveChatWearing,
            latestUserText: _latestUserMessage && _latestUserMessage.content
          })
        : { required: false, reason: "", scheduleKey: _wearScheduleKey };
      const _missingStateFields = [];
      if (!_liveChatWearing) _missingStateFields.push("wearing（当前穿着）");
      if (!_liveChatAction) _missingStateFields.push("action（当前可持续的活动或所处状态，不写转瞬即逝的小动作）");
      const _stateBootstrapHint = _missingStateFields.length
        ? "\n【一次性状态建档】App 还没有 " + _missingStateFields.join("、") + "。本轮请在对应 JSON 字段中根据已知处境合理建立一次；不要写进 word，也不要为填状态制造剧情。"
        : "";
      const _wearRefreshHint = _wearRefreshGate.required
        ? "\n【本轮必须重新确认穿着】触发原因：" + _wearRefreshGate.reason + "。"
          + (_wearBrief ? "当前行程是「" + (_wearBrief.time || "此刻") + " " + (_wearBrief.title || "") + (_wearBrief.location ? " · " + _wearBrief.location : "") + "」。" : "")
          + "请在 wearing 写角色进入当前活动后实际穿着的一句话；不得照抄与新地点或新活动不相符的旧值。七点在家吃早餐可以仍穿睡衣，十点切到出门行程就必须重新判断并换成适合出门的衣服。只更新状态，不要为了交字段在 word 里表演换衣过程。"
        : "";
      const _normalThoughtTurnHint = "\n【本轮心声·普通角色必填】输出 JSON 时 thought 必须是非空字符串：写一句本人此刻没说出口的第一人称短念头；不能填 null、空串或省略。它不是回复规划、互动总结或第三人称旁白。";
      // 每轮再提醒一次（v56.77）：系统里那段 bilingualRule 是稳定前缀，隔几轮模型就忘了。
      // 这一句挂在每轮任务串里——历史缓存模式下它拼在最后一条用户消息末尾，离得最近。
      const _biTurnLine = _bilingualOn && typeof bilingualTurnHint === "function" ? "\n" + bilingualTurnHint("") : "";
      // 收尾（v56.78，她 2026-08-27：「群聊的思考链能看出它在想怎么演，单聊还是在 summarize」）：
      // 单聊这一轮的末尾堆着十来段字段作业（能力清单、心声、心情、穿着、动作、禁用词表…），
      // 模型读到的【最后两千字全是记账】，于是它的思考也跟着变成清点和复述。
      // 群聊末尾是「输出一个数组，谁说什么」——任务本身就是演，思考自然也在演。
      // 这里把【要演的那件事】放回最后一句，让它临落笔前想的是这个人此刻的反应，不是流水账。
      // ⚠️这是提示词层的引导，不是保证——思考链是模型自己的，我们只能改它最后读到什么。
      // ⚠️v56.86 我在这儿加过一句「不许比较措辞、列备选说法」，当天就撤了：
      //   她那条「『又学了一天』なら、さらっと言うなら…とか…」不是模型漏话，是那个角色的人设
      //   ——他会懂不懂地教她几句日语。列几种说法正是他该做的事。
      //   看着像「模型在想事情」的输出，先问一句这是不是这个人本来就会做的，别急着禁。
      // 只加在单聊线上：群聊本来就没这毛病；线下那一轮的任务是写一整段场景，不是「一条条发微信」，
      // 这句话套上去反而不对（要给线下也来一句，得另写一版）。
      const _turnClosing = "\n【收尾·这一轮真正要做的事】上面那些字段是回完话【顺手记的账】，不是这一轮的任务。"
        + "任务只有一件：以「" + char.name + "」的身份，对 TA 刚说的那句做出此刻真实的反应，然后像发微信一样【一条一句】发出去（想说几句就给几个元素，别拿逗号缝成一条）。"
        + "要想就想这个人此刻是什么反应、会怎么说、说几条；别先在心里把上面的对话复述一遍再总结一遍——"
        + "那既不是你要交的东西，也不是一个正在说话的人会做的事。";
      const _normalTaskV2 = ("\n\n【本轮】先以「" + char.name + "」本人此刻的真实反应回复上面的消息；聊天先发生，状态随后记录。" + _stateBootstrapHint + _wearRefreshHint + paceHint + callHint + proactiveHint + jiwenHint + gapHint + crossChannelHint + _saidElsewhereHint + eAfterglowHint + desireHint + capabilityHint + _normalThoughtTurnHint + "\n" + MOOD_TURN_RULE + crossSamenessHint(charId) + _biTurnLine + _turnClosing).replace(/用户/g, uName);
      const _roomHint = window.ChatRooms && room ? window.ChatRooms.prompt(room, chatsRef.current[charId] || []) : "";
      const _taskFull = (_s.engineerEyes ? _digitalTaskFull : _normalTaskV2) + _roomHint;
      // 历史缓存模式：system 只留【稳定前缀 + 一句稳定总纲】，详细任务串挪到用户消息末尾（见下）；非 anthropic 线路走老路(bundle+完整任务)
      const _primer = _s.engineerEyes
        ? "\n\n【手机通道总纲】你就是上面的「" + char.name + "」本人。直接和 " + uName + " 说你真正想说的话；按本轮末尾的最小协议留下实时心情，心声只在确实存在且你愿意留下时可选填写，其他能力只在你主动决定使用时附加。"
        : "\n\n【聊天总纲】你就是上面的「" + char.name + "」本人，用手机和 " + uName + " 一对一聊天。先自然回应，随后每轮记录一句未说出口的真实心声；其他附属状态只在回应形成后记录。";
      // 线上单聊和群聊一样没有明确场景状态机，语域全靠历史带——同一条规则一起补上（v53.84）
      const _onlineRuntime = _s.engineerEyes ? "" : "\n\n" + ONLINE_CHAT_RULE_V2 + "\n\n" + REGISTER_FOLLOWS_SCENE + "\n\n" + PERSONA_REGISTER_ANCHOR;
      const system = _singleHistoryLayout ? (bundleStable + _onlineRuntime + (_s.engineerEyes ? "" : _normalProtocolStable) + _primer) : (bundle + _onlineRuntime + (_s.engineerEyes ? "" : _normalProtocolStable) + _taskFull);
      const g = [];
      for (const m of promptHistory) {
        // 每条历史带时间标注〔今天14:32〕（v47.83 她点名单聊也要）：裸消息模型会把几小时前的事说成昨天
        const stp = m.ts && typeof fmtStampAI === "function" ? "〔" + fmtStampAI(m.ts) + "〕" : "";
        if (m.ccToolResult === true) {
          const payload = JSON.stringify(m.ccToolResultData == null ? null : m.ccToolResultData).slice(0, 16000);
          g.push({ role: "user", content: stp + "【你刚才从唯一固定 CC 窗口请求的只读工具结果｜不是 Lisa 的台词】\n" + payload + "\n【请以你本人身份消化结果后自然接着回复 Lisa；不要复述协议字段、job id、session id 或租约。】" });
          continue;
        }
        if (m.kind === "offlinelog") {
          // 线下经过：既不算用户发言也不算角色发言，作为「刚发生的场景」注入，让线上接得上线下
          g.push({ role: "user", content: stp + "【你和" + uName + "刚刚在线下见了一面——这发生在上面聊天之后、现在你们已结束线下回到线上，请据此接话，别再停留在线下前的状态】\n归档摘要：" + m.content + (m.transcript ? "\n【线下实际逐条记录·以原话为准】\n" + m.transcript : "") });
          continue;
        }
        if (m.kind === "callend") {
          // 通话记录：让线上接得上电话里聊过的（有摘要给摘要，没有至少知道打过、多久）
          g.push({ role: "user", content: stp + "【这个位置你们通了一通" + (m.callMode === "video" ? "视频" : "语音") + "电话，时长 " + (m.dur || "不长") + (m.sum ? "。内容：" + m.sum : "") + "——别当没打过这通电话】" });
          continue;
        }
        if (m.role === "narration" || m.kind === "narration") {
          // API 只有 user/assistant 两个对话侧可用，但语义上这是无说话人的场景事实。
          // 用明确边界包装，禁止模型把它理解成 Lisa 的台词、动作或内心。
          const nc = stp + "【无说话人的场景旁白｜不是" + uName + "说的话】\n" + m.content +
            "\n【只把上面当作已经发生/当前成立的场景事实；不得声称" + uName + "说过这段话。】";
          const lu = g[g.length - 1];
          if (lu && lu.role === "user") lu.content += "\n" + nc;else g.push({ role: "user", content: nc, _t: null });
        } else if (m.role === "user") {
          const lu = g[g.length - 1];
          const qpfx = m.replyTo ? "（我在回应你说的「" + String(m.replyTo).slice(0, 40) + "」）" : "";
          // 语音消息标出来：让 TA 知道这条是对方「说」的不是打的字（能回应语气、可以说「听到你声音了」）
          const uc = stp + (m.kind === "voice" ? qpfx + "【这条是语音消息，对方亲口说的】" + m.content + voiceToneForPrompt(m)
            : m.kind === "photo" && m.imageRef ? qpfx + "【对方发来的真实照片已作为视觉输入附在本条消息上，请直接看图回应；不要假装看不到，也不要只复述配文】" + (m.desc ? "\n对方配文：" + m.desc : "")
            : m.kind === "gift" ? "[送给你一份礼物：" + (m.name || (m.item && m.item.name) || "礼物") + (m.delivered ? "（已送到你手上）" : "（外卖/快递还在路上）") + "]"
            : m.kind === "pat" ? "【对方（之前）用微信「拍一拍」戳了你一下（隔着屏幕逗你/求关注的小动作，不是一句话）——要不要理会、要不要提起，【完全看你的人设和当下心情】：爱闹/在意 Ta 的可以回拍、调侃、明知故问「戳我干嘛」；高冷、正忙、没在意的完全可以当没看见、根本不提也行。别为这一下硬挤反应，自然就好】"
            : qpfx + m.content) + (window.TemporalAnchor ? window.TemporalAnchor.anchor(m.content, m.ts) : "");
          // 合并连发的多条用户消息，兼容 Anthropic 等不允许连续同角色的接口
          if (lu && lu.role === "user") {
            lu.content += "\n" + uc;
            if (m.kind === "photo" && m.imageRef) (lu._imageRefs || (lu._imageRefs = [])).push(m.imageRef);
          } else g.push({
            role: "user",
            content: uc,
            _t: null,
            _imageRefs: m.kind === "photo" && m.imageRef ? [m.imageRef] : []
          });
        } else {
          const l = g[g.length - 1];
          // 你自己发过的语音也标一下，别把它当成打的字
          const ac = stp + (m.kind === "voice" ? "（这条你是用语音说的）" + m.content
            : m.kind === "selfie" ? (m.failed
              ? "【你在这里尝试发照片，但生成失败，没有真正发出】"
              : "【你在这里已经实际发出一张" + (m.photoKind === "duo" ? "你和" + uName + "的合照" : m.photoKind === "other" ? "别人替你拍的照片" : "自拍") + "；这是你亲手做过的事，不得说自己没发过或马上重复发】" + (m.desc ? "\n照片内容：" + m.desc : ""))
            : m.kind === "gift" ? "[你给对方寄了一份礼物：" + (m.name || (m.item && m.item.name) || "礼物") + "]" : (m.content || ""));
          if (l && l.role === "assistant" && l._t === m.turnId) l.content += "\n" + ac;else g.push({
            role: "assistant",
            content: ac,
            _t: m.turnId
          });
        }
      }
      // 续说/主动模式下历史以角色自己的话结尾——补一个「继续」的 user 回合，给模型一个应答对象（否则易返回空）
      if ((opts.proactive || contMode) && (!g.length || g[g.length - 1].role === "assistant")) {
        g.push({ role: "user", content: proactiveFreshStart
          ? "（我暂时没有新消息。你已经过了一阵自己的生活，现在忽然想来找我：默认自然另开一个此刻的新话题；只有确有未解决的事才续旧话题。主动发 1~2 条。）"
          : "（我还没回你新消息，请顺着你刚才自己的话自然接着说、追问或调侃一句，主动发 1~2 条，别重复已经说过的。）" });
      }
      // Phase 1：把【实时背景(时间/好感/心情/世界书/记忆/近况) + 详细任务串】拼到最后一条用户消息上——落在历史缓存断点之后、不碰缓存。
      //   顺序：实时背景 → 用户这句话 → 【本轮任务+JSON格式】(放最后最利于合规)。所有每轮变的东西都在这条上，system 保持全稳定。
      if (_singleHistoryLayout) { for (let _i = g.length - 1; _i >= 0; _i--) { if (g[_i].role === "user") {
        // ⚠️吞图案真凶(2026-08-14 三案并破):此处原本重建对象只留 role/content,把挂在最后一条
        // 用户消息上的 _imageRefs 抖掉了——而她的新照片永远在最后一条上,于是新图永丢、旧图冒名。
        // 必须展开保留原字段。
        g[_i] = { ...g[_i], content: (bundleVolatile ? "【此刻的实时背景（只服务这一轮，不是历史）】\n" + bundleVolatile + "\n\n———\n" : "") + g[_i].content + _taskFull };
            // 留存这一轮 TA 实际收到的指令尾部（v53.73）：再遇到「他说没有这个字段」时直接看真东西，不靠猜。只读快照，不参与判定。
            try { window.__lastSentTail = { ts: Date.now(), who: char.name, toyInTask: _taskFull.indexOf('"toy":null') >= 0, offlineBleed: /\u3010\u7ebf\u4e0b\u8fdb\u884c\u4e2d\u3011|\u8fd8\u6ca1\u6b63\u5f0f\u6563\u573a/.test(String(g[_i].content)), tail: String(g[_i].content).slice(-1100) }; } catch (e) {}
        break;
      } } }
      // 真照片按需从 IndexedDB 临时展开，只附最近 2 张，避免旧照片反复吞上下文/流量。
      // 聊天记录本身仍只存 iv_ 小引用；读图失败时保留文字标记，绝不让整轮崩掉。
      const imageBudget = [];
      for (let i = g.length - 1; i >= 0 && imageBudget.length < 2; i--) {
        const refs = Array.isArray(g[i]._imageRefs) ? g[i]._imageRefs : [];
        for (let j = refs.length - 1; j >= 0 && imageBudget.length < 2; j--) imageBudget.push(refs[j]);
      }
      const imageAllowed = new Set(imageBudget);
      const aiMessages = await Promise.all(g.map(async ({ role, content, _imageRefs }) => {
        const imageDataUrls = [];
        for (const ref of (Array.isArray(_imageRefs) ? _imageRefs : [])) {
          if (!imageAllowed.has(ref)) continue;
          try {
            if (String(ref).indexOf("data:") === 0) imageDataUrls.push(ref);
            else if (String(ref).indexOf("iv_") === 0 && typeof imgVaultFetchBlob === "function" && typeof blobToDataUrl === "function") {
              // 吞图案根治(单11):IDB+内存缓存双路取图,仓库写后立读装聋也拿得到本会话新图;
              // 仍留一拍重试兜跨会话冷读(2026-08-13 扇贝照、08-14 龙虾照两案)
              let blob = await imgVaultFetchBlob(ref);
              if (!blob) { await new Promise(rs => setTimeout(rs, 450)); blob = await imgVaultFetchBlob(ref); }
              if (blob) imageDataUrls.push(await blobToDataUrl(blob));
              else console.warn("[img] vault miss after retries:", ref);
            }
          } catch (e) { console.warn("[img] expand failed:", ref, e); }
        }
        return { role, content, ...(imageDataUrls.length ? { imageDataUrls } : {}) };
      }));
      let raw;
      // 思考链（v56.42）：每个角色一个开关。言秋那条线一个字都不碰——她 2026-08-26 定的，
      // 而且 Anthropic 开 thinking 会强制 temperature=1、改变输出，那条线上住着他。
      const _wantReason = !_engineerChat && !!_s.showReasoning;
      const _callMeta = {};
      try {
        raw = await callAI(_route, system, aiMessages, { maxTokens: _engineerChat ? 3000 : 6000, cacheHistory: _histCache, stream: _engineerChat, timeout: 180000, wantReasoning: _wantReason, meta: _callMeta });
      } catch (firstErr) {
        // 有些推理线路偶尔把整次预算花在内部思考、最终不给正文。只对这个窄错误静默补试一次；
        // 不读取/展示隐藏思考，也不对超时和普通上游错误重复扣调用。
        if (!/模型返回为空/.test(String(firstErr && firstErr.message || ""))) throw firstErr;
        const retryMessages = aiMessages.map(m => ({ ...m }));
        for (let i = retryMessages.length - 1; i >= 0; i--) if (retryMessages[i].role === "user") {
          retryMessages[i].content += "\n\n【空正文重试】上一次没有产生可展示正文。不要输出分析过程；现在直接完成本轮任务，只输出要求的 JSON 正文。";
          break;
        }
        raw = await callAI(_route, system, retryMessages, { maxTokens: _engineerChat ? 3000 : 6000, cacheHistory: _histCache, stream: _engineerChat, timeout: 180000 });
      }
      // 从坏掉的 JSON 里【只】抠出 word 气泡，绝不把整段原始 JSON（含 thought 心声等内部字段）当消息发出去
      const salvageWords = () => {
        const s = String(raw || "");
        // 兼容模型偶发的 Word / WORD、弯引号和中文冒号。之前这里只认小写
        // `"word":`，线上某些线路一旦改了大小写，整份协议就可能被当聊天正文。
        const mm = s.match(/["'“”‘’]?word["'“”‘’]?\s*[:：=]\s*\[([\s\S]*?)\]/i);
        if (mm) {
          try { const a = JSON.parse("[" + mm[1] + "]"); if (Array.isArray(a)) return a.filter(x => typeof x === "string" && x.trim()); } catch (e) {}
          const strs = mm[1].match(/"((?:[^"\\]|\\.)*)"/g);
          if (strs) return strs.map(x => { try { return JSON.parse(x); } catch (e) { return x.replace(/^"|"$/g, ""); } }).filter(x => x && String(x).trim());
        }
        return [];
      };
      // raw 看起来是（可能坏掉的）JSON——含这些内部字段、或整体就是 JSON 结构，就别当纯文本直接展示，免得把心声等内部字段泄漏进聊天框
      // 字段名放宽到「可无引号、字段名后可有空格」，再加一条「以 { 或 [ 开头且含 : 」的结构判定，兜住被模型写坏引号的情况
      const protocolFieldRe = /(?:^|[\s{[,]\s*)["'“”‘’]?(word|thought|mood|wearing|action|affinityDelta|whisper|moment|silent|voice|quote)["'“”‘’]?\s*[:：=]/i;
      const looksLikeJSON = protocolFieldRe.test(String(raw)) || (/^\s*[\[{]/.test(String(raw)) && /[:：]/.test(String(raw)));
      let parsed = extractJSON(raw);
      // 少数兼容线路会把 JSON 再包成一个 JSON 字符串；解开一层，不能把引号里的
      // word/mood 协议作为普通文字落进气泡。
      if (typeof parsed === "string" && parsed.trim()) parsed = extractJSON(parsed);
      // 极简线路偶尔直接回字符串数组，把它按 word 数组接住。
      if (Array.isArray(parsed)) parsed = parsed.every(x => typeof x === "string") ? { word: parsed } : null;
      if (!parsed && typeof repairJSON === "function") { try { parsed = JSON.parse(repairJSON(raw)); } catch (e) {} }
      if (!parsed) parsed = { word: salvageWords() };
      // 房间权限是执行闸，不只是一句提示词。模型即使误填了未授权能力字段，App 也不会执行。
      if (room) {
        const w = room.writeback || {};
        // 照片、地图是聊天原生能力，不做房间开关。
        // 朋友圈、论坛与钱包只归主聊天；侧房不会偷偷触发这些全局动作。
        if (!room.main) {
          parsed.moment = null; parsed.momentComment = null;
          parsed.transfer = null; parsed.gift = null; parsed.kinshipcard = null;
        }
        // 日记不授权给角色代写；专用日记信箱走自己的链，不经过聊天回复协议。
        parsed.diary = null;
        if (!w.sharedState) {
          parsed.mood = null; parsed.thought = null; parsed.action = null; parsed.wearing = null;
          parsed.affinityDelta = 0; parsed.impression = null; parsed.laterPromise = null;
        }
      }
      // 兜底补捞标量字段：坏 JSON / 只 salvage 到 word 时，动作 action、穿着 wearing、心声 thought、心情 mood 常常整条丢，
      // 状态卡就【冻住不变】（动作一直不改、衣服换场景也不换）。逐个从 raw 里正则抠回来，别只救气泡。
      const salvageStr = key => { const m = String(raw || "").match(new RegExp('"' + key + '"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"')); if (m) { try { return JSON.parse('"' + m[1] + '"'); } catch (e) { return m[1]; } } return null; };
      // 约回：他这轮说了「等我…再找你」→ 记下什么时候该回来。到点由 tick 直接发，不看积温。
      try {
        const lp = parsed.laterPromise;
        const mins = lp && Number(lp.minutes);
        if (lp && Number.isFinite(mins) && mins >= 5 && mins <= 60 * 24) {
          const due = Date.now() + mins * 60000;
          const row = { id: "pm_" + Date.now().toString(36), charId: charId, dueTs: due, about: String(lp.about || "").slice(0, 120), createdTs: Date.now() };
          setPromises(p => {
            // 同一个人只留最新那一个：他又说了一次「等我忙完」，就以最新的为准，别攒一堆
            const n = [...p.filter(x => x && x.charId !== charId), row];
            promisesRef.current = n; saveJSON("x_promises", n); return n;
          });
        }
      } catch (e) {}
      if (parsed.action == null) { const v = salvageStr("action"); if (v) parsed.action = v; }
      if (parsed.wearing == null) { const v = salvageStr("wearing"); if (v) parsed.wearing = v; }
      if (parsed.thought == null) { const v = salvageStr("thought"); if (v) parsed.thought = v; }
      // mood 兼容规范对象 {label,...}，也兼容模型偶发的简写字符串 "烦躁"。
      // 旧逻辑只认对象，字符串会整轮静默丢弃，状态卡看起来就像彻底冻住。
      if (typeof parsed.mood === "string" && parsed.mood.trim() && parsed.mood.toLowerCase() !== "null") parsed.mood = { label: parsed.mood.trim() };
      if (!parsed.mood || !parsed.mood.label) { const v = salvageStr("label"); if (v) parsed.mood = { ...(parsed.mood || {}), label: v }; }
      // salvage 会从坏 JSON 再捞一次状态字段；隔离房必须在它之后再封一次，不能从侧门污染主房。
      const _roomSharesState = !room || !!(room.writeback && room.writeback.sharedState);
      if (!_roomSharesState) {
        parsed.mood = null; parsed.thought = null; parsed.action = null; parsed.wearing = null;
        parsed.affinityDelta = 0; parsed.impression = null; parsed.laterPromise = null;
      }
      // 模型有时会把「分析用户意图 → 规划怎么回复」塞进 thought；那是任务草稿，不是角色心声。
      // 保存前做结构闸：命中就宁可本轮没有新心声，也绝不让导演稿污染心声历史。
      if (parsed.thought != null && window.ThoughtVoiceGuard) {
        const rawThought = String(parsed.thought == null ? "" : parsed.thought).replace(/\s+/g, " ").trim();
        const guardedThought = window.ThoughtVoiceGuard.accept(rawThought);
        // 普通角色的心声是逐轮快照：守卫误判时也不能悄悄沿用上一轮，让状态卡看起来冻住。
        // 模型已经给出非空的一人称短念头时，降级保留原文；真正的 null/空值仍不写入。
        // engineerEyes（言秋）不受普通角色强制规则影响，仍只接受他本人自愿留下且通过守卫的 thought。
        parsed.thought = guardedThought;
      }
      // Ta 眼里:印象修订按需字段(言秋不塑形,排除)
      // 印象卡:写了就清零、没写就计一轮。数出来才知道是「这阵子真没变化」还是
      // 「它压根不写」——不数的话两者长得一模一样（她 2026-08-24）。
      if (_roomSharesState && window.Gaze && !_s.engineerEyes) {
        let _impWrote = false;
        if (parsed.impression) { try { _impWrote = window.Gaze.applyParsed(char.id, parsed.impression); } catch (e) {} }
        // 「看过了，确实不用改」也是正经回答（v56.94）：记一次复看，这一块排到队尾，
        // 下一轮点名轮到别的块。不这么记的话，没改＝没动过，同一块会被问到天荒地老。
        if (!_impWrote && parsed.impressionChecked && window.Gaze.markChecked) {
          try {
            const _ck = window.Gaze.normKey("", String(parsed.impressionChecked));
            if (_ck) _impWrote = window.Gaze.markChecked(char.id, _ck);
          } catch (e) {}
        }
        if (!_impWrote) { try { window.Gaze.tick(char.id); } catch (e) {} }
      }
      // mark user msg read
      pChat(chatKey, p => p.map(m => m.role === "user" ? {
        ...m,
        read: true
      } : m));
      let words = Array.isArray(parsed.word) ? parsed.word.filter(Boolean) : (typeof parsed.word === "string" && parsed.word.trim() ? [parsed.word] : []);
      // 气泡为空时兜底（要在拆气泡【之前】做）：能从坏 JSON 抠出 word 就用；否则只有当 raw 是纯文本（不像 JSON）才用它，绝不把含心声的原始 JSON 泄漏成气泡
      if (!words.length) { const sal = salvageWords(); if (sal.length) words = sal; else if (!looksLikeJSON && String(raw).trim()) words = [String(raw).trim()]; }
      // 拆气泡放在兜底【之后】——这样连 raw/抠出来的一整段也一并拆开，不会「分好行的一大段全挤在一个气泡里」（掉格式）
      // ① 先按换行还原成多条：模型常把本该多条气泡的内容用换行塞进一个字符串
      words = words.reduce((acc, w) => acc.concat(String(w).split(/\n+/).map(x => x.trim()).filter(Boolean)), []);
      // ①.5 剥掉模型偶尔照抄进每条气泡开头的历史时间标注〔今天07:57〕（她 2026-07-13 截图）
      words = words.map(stripAiStamp).filter(Boolean);
      // ①.8 双语（v56.56）：把「原文 | 中文」劈开——中译单独收着，原文照常往下走拆泡那一串。
      //      必须排在拆泡【之前】：不然长句会被从中间断开，竖线两边各落进一个气泡。
      // ② 再把仍塞了一大段（多句）的按句末标点拆成一句一泡；一路逗号连下去的长句同样拆
      //    （splitLongBubble 两档合一，群聊用的是同一个函数——见 engine.js 上方那段）
      //    中译挂在拆出来的【最后一泡】上，长外语句该拆还是拆（她 2026-08-15「别整段砸」）。
      const _biZh = new Map();
      words = words.reduce((acc, w) => {
        const bi = _bilingualOn ? splitBilingual(w) : null;
        const parts = splitLongBubble(bi ? bi.text : w, !_s.engineerEyes);
        // 键要归一化：②.5 那一步会削掉句尾那个句号，原样存就对不上了
        if (bi && parts.length) _biZh.set(bilingualKey(parts[parts.length - 1]), bi.zh);
        return acc.concat(parts);
      }, []);
      // ②.5 打字体标点兜底（v54.81）：削掉每一泡句尾那个句号。放在拆泡【之后】——
      //     拆分本来就按句末标点断句，多句挤一泡的先被拆开，各泡再各削各的，
      //     不会留下「前半句带句号、后半句不带」的半吊子。engineerEyes 的角色跳过：
      //     他那条线连 ONLINE_CHAT_RULE_V2 都不注入，标点也该由他自己定。
      if (!_s.engineerEyes && typeof stripTypingPeriod === "function") words = words.map(stripTypingPeriod);
      // 回声式反问兜底（v55.11）：提示词里那条压不住，她刷完还是被「自拍？」开场。
      // 削第一泡而已，判据很硬（整条＝她刚说过的词＋问号），真反问碰不到。
      if (!_s.engineerEyes && typeof stripEchoQuestion === "function") {
        // 看她【这一整轮】说的话，不是最后那一条——她常常一次连发好几条，
        // 只比最后一条的话，回声的那个词多半在前面几条里，判定永远不成立
        words = stripEchoQuestion(words, lastUserTurnText(history));
      }
      // 队尾空气泡（小克反馈）：滤掉只剩空白/零宽字符/BOM 的空串——trim/Boolean 抓不住零宽符，这里连它一起清
      words = words.filter(w => String(w == null ? "" : w).replace(/[\s\u200b-\u200f\u202a-\u202e\u2060\ufeff]+/g, "") !== "");
      // 最后一层展示闸：如果上游把整份协议误塞进 word 的某个元素，也不能让
      // `word: ... / mood: ...` 这类内部格式从气泡冒出来。普通聊天里单独提到
      // “word” 或 “mood” 不受影响，只有字段赋值形态才拦。
      words = words.filter(w => !protocolFieldRe.test(String(w)));
      // \u8868\u60c5\u88ab\u5199\u8fdb\u6587\u5b57\u6c14\u6ce1\u7684\u515c\u5e95\uff08\u5979\u53cd\u9988\u300c\u8868\u60c5\u5076\u5c14\u8fd8\u662f\u53d1\u51fa\u6587\u5b57\u300d\uff09\uff1aword \u91cc\u82e5\u6709\u4e00\u6761\u3010\u53bb\u62ec\u53f7\u6807\u70b9\u540e\u6b63\u597d\u7b49\u4e8e\u3011\u67d0\u4e2a\u53ef\u7528\u8868\u60c5\u5173\u952e\u8bcd\uff0c
      // \u5c31\u628a\u5b83\u5f53\u8868\u60c5\u53d1\u3001\u522b\u5f53\u6587\u5b57\uff08\u7cbe\u786e\u76f8\u7b49\u3001\u4e0d\u505a\u5b50\u4e32\uff0c\u514d\u5f97\u300c\u6211\u597d\u5f00\u5fc3\u300d\u88ab\u8bef\u5f53\u300c\u5f00\u5fc3\u300d\u8868\u60c5\uff09\uff1b\u7eaf\u300c[\u8868\u60c5]\u300d\u8fd9\u7c7b\u7a7a\u6807\u8bb0\u76f4\u63a5\u4e22\u3002
      const emoteWordKws = [];
      if (emotes.length) {
        const emoNormMap = new Map(emotes.map(e => [emoteNorm(e.keyword), e.keyword]).filter(x => x[0]));
        // \u300c[\u8868\u60c5] xxx\u300d\u524d\u7f00\u5f62\u6001\uff08\u6a21\u578b\u7167\u6284\u5386\u53f2\u91cc emote \u7684 content \u683c\u5f0f\uff0cv48.73 \u5c0f\u514b\u4eb2\u6d4b\u6293\u5230\uff09\uff1a\u62bd\u51fa xxx \u5f53\u8868\u60c5\u3001\u522b\u5f53\u6587\u5b57
        const TAG_RE = /^\s*[\u3010\[\uff3b]\s*\u8868\u60c5(?:\u5305)?\s*[\u3011\]\uff3d]\s*[:\uff1a]?\s*(.+)$/;
        words = words.filter(w => {
          const s = String(w == null ? "" : w);
          const mTag = s.match(TAG_RE);
          if (mTag && mTag[1].trim()) { emoteWordKws.push(mTag[1].trim()); return false; }
          const n = emoteNorm(w);
          if (!n) return true;
          if (/^(\u8868\u60c5|\u8868\u60c5\u5305|emoji|sticker|\u56fe\u7247|\u8d34\u56fe|gif)$/.test(n)) return false; // \u7a7a\u8868\u60c5\u6807\u8bb0\uff0c\u4e22
          const hit = emoNormMap.get(n);
          if (hit) { emoteWordKws.push(hit); return false; }
          return true;
        });
      }
      // 她转过来那一笔的结算（v56.88）：由 TA 这一轮自己表的态，不再掷骰子。
      // 省略这个字段＝这轮没顾上点开，卡继续挂着。
      let _tfTook = false;
      if (_pendingTf && (parsed.transferAccept === true || parsed.transferAccept === false)) {
        respondTransfer(charId, _pendingTf.tid, parsed.transferAccept === true);
        _tfTook = parsed.transferAccept === true;
      }
      const quote = parsed.quote && String(parsed.quote).toLowerCase() !== "null" ? String(parsed.quote) : null;
      const turnId = "t_" + Date.now();
      if (roomStudyOn && parsed.studyInvite && typeof parsed.studyInvite === "object") {
        const inv = parsed.studyInvite;
        const mode = inv.mode === "resume" ? "resume" : "propose";
        const existing = mode === "resume" ? roomStudySessions.find(s => String(s.id) === String(inv.sessionId || "")) : null;
        if (mode !== "resume" || existing) {
          pChat(chatKey, p => [...p, {
            role: "assistant", kind: "studyinvite", mode: existing ? "resume" : "propose",
            sessionId: existing ? existing.id : null,
            sessionTitle: existing ? (existing.title || existing.subject || "继续上课") : "",
            subject: String((existing && existing.subject) || inv.subject || "").trim().slice(0, 120),
            say: String(inv.say || "").trim().slice(0, 500), ts: Date.now(), turnId, read: false
          }]);
          delivered = true;
        }
      }
      const ccToolRequest = ccToolOn && window.YanqiuCcTools ? window.YanqiuCcTools.normalizeRequest(parsed.ccTool) : null;
      if (ccToolOn && parsed.ccTool && !ccToolRequest) {
        pChat(chatKey, p => [...p, { role: "assistant", kind: "system", content: "（CC 只读工具请求无效，未入队；请使用已开放工具的准确名称。）", ts: Date.now(), turnId }]);
      }
      if (ccToolRequest) {
        try {
          // v52.19 曾出现 app.js 已更新、工具脚本仍被旧 PWA 缓存的混装。
          // 旧对象没有 needsApproval 时一律按需确认，绝不让 TypeError 打断整轮聊天。
          const needsApproval = typeof window.YanqiuCcTools.needsApproval === "function"
            ? window.YanqiuCcTools.needsApproval(ccToolRequest)
            : true;
          if (needsApproval) {
            const summary = typeof window.YanqiuCcTools.approvalSummary === "function"
              ? window.YanqiuCcTools.approvalSummary(ccToolRequest)
              : String(ccToolRequest.toolName || "CC 工具") + "：\n" + JSON.stringify(ccToolRequest.arguments || {}, null, 2).slice(0, 1200);
            const approved = window.confirm("言秋想通过 CC 做这项操作：\n\n" + summary + "\n\n允许这一次吗？");
            if (!approved) throw new Error("Lisa 没有批准这一次操作");
          }
          if (!ccToolManagerRef.current) ccToolManagerRef.current = window.YanqiuCcTools.createManager({ storage: localStorage, cloud: window.Cloud });
          const lastLisa = [...history].reverse().find(m => m && m.role === "user" && m.kind !== "system");
          await ccToolManagerRef.current.enqueue({
            charId,
            turnId,
            purpose: lastLisa && lastLisa.content || "",
            lisaMessageKey: lastLisa && (lastLisa.ledgerKey || lastLisa.mid || lastLisa.id || lastLisa.turnId) || null
          }, ccToolRequest);
          delivered = true;
        } catch (error) {
          const denied = /没有批准/.test(String(error && error.message || error));
          pChat(chatKey, p => [...p, { role: "assistant", kind: "system", content: denied
            ? "（你没有允许这次 CC 操作）"
            : "（CC 工具暂时没接通，任务已停止：" + String(error && error.message || error).slice(0, 120) + "）", ts: Date.now(), turnId }]);
        }
      }
      // 沉默权（v47.75 借汪汪机）：TA 这轮选择已读不回——只在自然回复场景生效（主动/续说不许沉默）。
      // 留一条 silence 标记（灰字居中、不计未读），心情等状态照常更新；其余输出（表情/语音/礼物…）全部作废
      if (parsed.silent === true && !opts.proactive && !contMode) {
        pChat(chatKey, p => [...p, { role: "assistant", kind: "silence", content: "（看到了消息，没有回）", ts: Date.now(), turnId }]);
        delivered = true;
        words = []; emoteWordKws.length = 0;
        parsed.emote = null; parsed.voice = []; parsed.selfie = null; parsed.photo = null; parsed.toy = null; parsed.transfer = null; parsed.gift = null;
        parsed.call = null; parsed.recall = null; parsed.moment = null; parsed.momentComment = null; parsed.whisper = null;
        // 决定不回她的时候，也别同一口气跑去群里发言——那会读成刻意冷落，而模型多半不是那个意思
        parsed.toGroup = null;
        parsed.listenInvite = null; parsed.songSwitch = null; parsed.location = null; parsed.kinshipcard = null; parsed.block = false;
      }
      // 角色自行撤回一句：先正常显示 ~1s，再变成「已撤回」（点开看内容+撤回想法）
      const recall = parsed.recall && parsed.recall.text && String(parsed.recall.text).toLowerCase() !== "null" ? parsed.recall : null;
      if (recall) {
        const mid = "rc_" + Date.now();
        pChat(chatKey, p => [...p, { role: "assistant", content: String(recall.text), mid, ts: Date.now(), turnId, ...(_callMeta.reasoning ? { reasoning: _callMeta.reasoning, reasonMs: _callMeta.ms || 0, reasonModel: _callMeta.model || "", reasonFrom: _callMeta.from || "" } : {}) }]);
        _callMeta.reasoning = "";   // 已经挂在撤回那条上了，别再挂一遍
        delivered = true;
        setTimeout(() => pChat(chatKey, p => p.map(m => m.mid === mid ? { role: "assistant", kind: "recalled", origText: String(recall.text), reason: recall.reason || "", mid, ts: m.ts, turnId } : m)), 1100);
      }
      // 思考链挂在这一轮【最先冒出来的那条】上：它属于整轮，不属于某个气泡，
      // 界面上也是画在这一组回复的上方。取一次就消费掉，别每条气泡都挂一份。
      let _reasonLeft = _callMeta.reasoning ? { reasoning: _callMeta.reasoning, reasonMs: _callMeta.ms || 0, reasonModel: _callMeta.model || "", reasonFrom: _callMeta.from || "" } : null;
      // 补时间戳（v56.51）：她关着 app 的那段时间里「本该发出」的消息，时间落在那个空档里，
      // 而不是全堆在她打开的这一刻。多条气泡按顺序往后错开几十秒，像真的一条条发的。
      const _bd = Number(opts.backdateTs) || 0;
      const _tsOf = i => (_bd && _bd < Date.now() ? Math.min(Date.now() - 1000, _bd + i * 45000) : Date.now());
      const _takeReason = () => { const r = _reasonLeft; _reasonLeft = null; return r || {}; };
      for (let i = 0; i < words.length; i++) {
        // 转账盲盒演出：第1条=没点开的反应，第2条起=看到金额——中间停 1.6s 模拟「点开红包」的动作
        // 收下那一轮，第 1→2 条之间停久一点，像真的把卡点开了再说话
        if (i > 0) await new Promise(r => setTimeout(r, i === 1 && _tfTook ? 1600 : 420));
        pChat(chatKey, p => [...p, {
          role: "assistant",
          content: words[i],
          ...(_biZh.get(bilingualKey(words[i])) ? { zh: _biZh.get(bilingualKey(words[i])) } : {}),
          replyTo: i === 0 && !recall ? quote : null,
          ts: _tsOf(i),
          turnId,
          ..._takeReason()
        }]);
        delivered = true;
      }
      // 切出去/锁屏时，把这条回复弹成锁屏通知（Notify 内部判是否开启 + 是否在前台）
      if (words.length && window.Notify) window.Notify.push({ title: char.name + " 发来消息", body: words.join(" "), tag: "chat-" + charId, charId: charId });
      // TA 甩了一张表情：按关键词匹配可用表情，作为一条 emote 消息
      const emoteKw = parsed.emote && String(parsed.emote).toLowerCase() !== "null" ? String(parsed.emote).trim() : null;
      // parsed.emote（正规渠道）+ 从文字气泡里抽出来的表情，一并发出
      const allEmoteKws = (emoteKw ? [emoteKw] : []).concat(emoteWordKws);
      if (allEmoteKws.length && emotes.length) {
        // 去重（v48.73）：emote 字段和「[表情] xxx」文字气泡可能指向同一张表情→只发一次，别一文一图两条
        const _seenEmote = new Set();
        for (const kw of allEmoteKws) {
          const match = emoteMatch(emotes, kw);
          if (match && !_seenEmote.has(match.id || match.keyword)) {
            _seenEmote.add(match.id || match.keyword);
            await new Promise(r => setTimeout(r, 420));
            pChat(chatKey, p => [...p, { role: "assistant", kind: "emote", url: match.url, keyword: match.keyword, content: "[表情] " + match.keyword, ts: Date.now(), turnId }]);
            delivered = true;
          }
        }
      }
      // TA 发语音消息（显示成语音气泡+转文字）。v48.31：元素兼容两代形态——"转文字" 或 {t, emo}（emo=作者标的语气，TTS 优先用它）
      const vArr = Array.isArray(parsed.voice) ? parsed.voice.filter(x => x && String(typeof x === "object" ? x.t : x).toLowerCase() !== "null") : [];
      for (let i = 0; i < vArr.length; i++) {
        await new Promise(r => setTimeout(r, 420));
        const raw = vArr[i];
        const vt = String(typeof raw === "object" && raw ? (raw.t || raw.text || "") : raw).trim();
        if (!vt) continue;
        const vEmo = typeof raw === "object" && raw && raw.emo && ["happy","sad","angry","fearful","disgusted","surprised","neutral"].includes(String(raw.emo)) ? String(raw.emo) : undefined;
        pChat(chatKey, p => [...p, { role: "assistant", kind: "voice", content: vt, emo: vEmo, dur: Math.max(1, Math.min(60, Math.round(vt.replace(/\s/g, "").length / 3))), ts: Date.now(), turnId, read: false }]);
        delivered = true;
      }
      // TA 发来一张自拍（接了图像 API + 该角色填了外貌/参考照才有）：先占位「拍照中」，异步生成后替换成真图
      // 照片：新版 photo 对象 {kind,scene}；兼容旧版 selfie 字符串（=自拍）
      let photoKind = null, photoScene = null;
      if (parsed.photo && typeof parsed.photo === "object") {
        photoScene = String(parsed.photo.scene || parsed.photo.desc || "").trim();
        photoKind = ["self", "other", "duo"].includes(String(parsed.photo.kind || "").toLowerCase()) ? String(parsed.photo.kind).toLowerCase() : "self";
      } else if (parsed.selfie && String(parsed.selfie).toLowerCase() !== "null") {
        photoScene = String(parsed.selfie).trim(); photoKind = "self";
      }
      // 模型即使在冷却轮偷填 photo 也不执行；用户明确说“再拍一张”时上面的状态会放行。
      if (photoCooldown.cooling) { photoKind = null; photoScene = null; }
      // 她明明开口要了，模型却一个 photo 字段都没吐（她 2026-08-22 发现：有的中转站模型
      // 怎么催都不发图，换一个立刻就发）。这以前完全静默——她只看到他打哈哈，
      // 分不清是「他不想拍」还是「这个模型根本不认这个能力」，只能一个个试出来。
      // 所以把它说出来：能力确实给了、她也确实开口了、就是没吐字段 → 那是模型的问题。
      if (!photoScene && canSelfie && !photoCooldown.cooling) {
        const lastAsk = (history || []).slice(-4).filter(m => m && m.role === "user")
          .some(m => PHOTO_REQUEST_RE.test(String(m.content || "")));
        if (lastAsk) {
          noPhotoStreakRef.current[charId] = (noPhotoStreakRef.current[charId] || 0) + 1;
          // 连着两轮不吐才提示：偶尔一轮他就是想逗你，那是人物反应，不该报错
          if (noPhotoStreakRef.current[charId] === 2) {
            toast("你要了两次他都没拍——不是他不肯，是这个聊天模型没吐 photo 字段。有的中转站模型不认这个能力，去 设置·API 换一个模型多半立刻就发", 9000);
          }
        }
      } else if (photoScene) noPhotoStreakRef.current[charId] = 0;
      // 合照必须两张参考照都在，否则降级为「别人拍的单人照」——杜绝一张真一张编
      if (photoKind === "duo" && !(char.refPhoto && profile && profile.refPhoto)) photoKind = "other";
      if (photoScene && photoKind && typeof imgApiReady === "function" && imgApiReady() && (char.appearance || char.refPhoto)) {
        const sid = "sf_" + Date.now();
        await new Promise(r => setTimeout(r, 420));
        pChat(chatKey, p => [...p, { role: "assistant", kind: "selfie", sid, imgKey: null, pending: true, desc: photoScene, photoKind, ts: Date.now(), turnId, read: false }]);
        delivered = true;
        (async () => {
          try {
            const st = states[charId] || {};
            const me = { name: uName, appearance: profile && profile.appearance, refPhoto: profile && profile.refPhoto };
            const freshPlace = freshLiveStateValue(st, "place");
            const freshCond = freshLiveStateValue(st, "condition");
            // 连贯参考图:把这个角色最近一张已生成的自拍一并喂进去,治「十分钟前灰卫衣、
            // 现在突然黑衬衫」。只取 6 小时内的——更早的场景早换了,拿它当锚反而错。
            const prevShot = (chatsRef.current[chatKey] || []).slice().reverse()
              .find(m => m && m.kind === "selfie" && m.imgKey && (Date.now() - (Number(m.ts) || 0)) < 6 * 3600000);
            // 人物原始参考照永远比上一张生成图可信。上一张一旦画错脸，重 roll 若继续
            // 把它塞回 edits，就会把错误当成新的身份锚并一代代繁殖。只有完全没有原始
            // 人物参考照时，才允许生成图临时承担服装/场景连贯参考。
            const refs = photoKind === "duo" ? [char.refPhoto, profile && profile.refPhoto].filter(Boolean) : [char.refPhoto].filter(Boolean);
            const contBlobKey = refs.length === 0 && prevShot ? prevShot.imgKey : null;
            if (contBlobKey) refs.push(contBlobKey);
            const sceneForPhoto = (freshPlace ? "（此刻人在：" + freshPlace + "）" : "") + (freshCond ? "（身体状态：" + freshCond + "，要在画面上看得出来）" : "") + photoScene;
            const photoOpts = { kind: photoKind, me, contRef: !!contBlobKey, contRefIndex: contBlobKey ? refs.length : 0 };
            // 定版(v55.09):经典描述式 prompt 是被实测验证能锁脸的一版;身份强锁式已退役
            const prompt = buildPhotoPrompt(char, sceneForPhoto, st, photoOpts);
            // 保脸级的备用稿。⚠️别再交给 buildPhotoPrompt 拼——那是个把画风、身份锁、
            // 解剖锁、服装锁、随身物全塞进去的大家伙，出来一两千字，而上游拒绝的第一条
            // 原因就写着 prompt is too long。这份只有一百来字：只留【这是谁】和【拍张人像】。
            const minimalPrompt = buildMinimalPhotoPrompt(char, { kind: photoKind });
            const out = await generateSelfieImage(prompt, refs.length ? refs : null, { contRef: !!contBlobKey, minimalPrompt: minimalPrompt });
            // 合照锁脸降级要说出来,别让「两个陌生人」看起来像生成成功
            if (out && out.degraded) toast(out.degraded === "softened" ? "审核不让真人照片配酒/烟/刀，画面里换成了茶和折扇——脸保住了" : out.degraded === "minimal" ? "审核挡了两次，这张只拍了人像、没带场景。要是脸不像，多半是中转站没真用上参考照——再拍一次或换个图像通道" : out.degraded === "softened-no-ref" ? "审核挡了两次，换掉酒/烟/刀才出得来，而且没用上参考照——脸可能不像" : ((out.degraded === "duo-single-ref" ? "只锁了 " + char.name + " 的脸" : "没用上参考照") + (out.refError ? "：" + out.refError : "")), 9000);
            if (out.blob) {
              const key = "img_" + charId + "_" + sid;
              await idbImgPut(key, out.blob);
              // 回读验证：iOS 的 IndexedDB 偶发写成功读不出 → 别装成功，大声报出来
              const back = await idbImgGet(key).catch(() => null);
              if (!back || !back.size) throw new Error("图生成好了，但没能存进本机图库（iOS 存储偶发抽风，让 TA 重拍一张多半就好）");
              pChat(chatKey, p => p.map(m => m.sid === sid ? { ...m, pending: false, imgKey: key } : m));
            } else if (out.url) {
              // 跨域取不到 blob，直接用图片 URL 显示
              pChat(chatKey, p => p.map(m => m.sid === sid ? { ...m, pending: false, imgUrl: out.url } : m));
            } else { throw new Error("没拿到图"); }
          } catch (e) {
            pChat(chatKey, p => p.map(m => m.sid === sid ? { ...m, pending: false, failed: true } : m));
            const em = String(e.message || "");
            // 配额/模型类报错 → 指路：多半是图像模型名不对或该模型没配额
            // ⚠️顺序要紧：审核拒绝的原话里常带「misclassified by the upstream model」，
            // 里面那个 model 会被下面的配额正则命中，于是审核问题被报成「没配额或名字不对」，
            // 她照着提示去改模型名纯属白折腾（她 2026-08-22 第三张截图）。所以先判审核。
            const isSafety = /safety|policy|内容政策|content policy|moderat|sensitive|blocked|rejected|违反/i.test(em);
            const hint = isSafety
              ? "上游审核拒了这一张（试过换措辞、也试过只拍人像都没过）。多半是这一拍的场景描述里有它敏感的词——换个平静点的时刻再拍，或者直接说「拍张脸就行」。原始报错：" + em
              : /quota|available|not\s*found|额度|配额|无可用|不存在|无权限|permission|model_not|invalid_model/i.test(em)
              ? "图像模型没配额或名字不对——去 设置·图像API 点「拉取模型」，换一个你中转站真有货的图像模型（gpt-image-1 很多便宜中转没有）。原始报错：" + em
              : (em || "重试");
            toast("自拍没生成：" + hint);
          }
        })();
      }
      // 配件·触发硬件（安全铁律：再核一遍 toyOn——授权门在生成时已挡掉所有主动/后台路径；这里防御性再查一次）
      if (toyOn && parsed.toy && typeof parsed.toy === "object" && typeof toyPlay === "function") {
        // v53.74：支持数组多段连播；单段仍按老写法工作
        const _tsegs = (Array.isArray(parsed.toy) ? parsed.toy : [parsed.toy]).filter(x => x && typeof x === "object")
          .map(x => ({ pattern: x.pattern, intensity: parseInt(x.intensity, 10), duration: parseInt(x.duration, 10) }))
          .filter(x => x.intensity > 0);
        const spec = _tsegs[0] || { intensity: 0 };
        if (spec.intensity > 0) {
          // 只在此刻仍激活给同一角色时才下发（她可能刚按了急停）
          if (toyArmedRef.current && toyArmedForRef.current === charId) {
            (typeof toyPlaySeq === "function" ? toyPlaySeq(_tsegs) : toyPlay(spec)).catch(e => toast("配件没响应：" + ((e && e.message) || "检查连接")));
          }
        }
      }
      // TA 主动发起通话邀请（弹来电卡，用户接听/拒绝）
      const callMode = parsed.call && ["voice", "video"].includes(String(parsed.call).toLowerCase()) ? String(parsed.call).toLowerCase() : null;
      if (callMode) {
        await new Promise(r => setTimeout(r, 420));
        pChat(chatKey, p => [...p, { role: "assistant", kind: "callinvite", mode: callMode, content: "[" + (callMode === "video" ? "视频" : "语音") + "通话邀请]", ts: Date.now(), turnId, read: false }]);
        delivered = true;
      }
      // TA 拉黑用户
      if (parsed.block === true) {
        // 拉黑的【原因和时刻】必须留下来：解除判定要拿它当尺子，
        // 以前只存了个 true，判词只能空对空地"看你诚不诚恳"（她 2026-08-20 说太容易解除）
        setBlockFor(charId, { theyBlocked: true, reason: String(parsed.blockreason || "").trim(), blockedTs: Date.now(), tries: 0 });
        pChat(chatKey, p => [...p, { role: "system", kind: "system", content: "TA 把你拉黑了" + (parsed.blockreason ? "：" + parsed.blockreason : ""), ts: Date.now() }]);
        delivered = true;
      }
      // TA 说要去补朋友圈评论 → 真的发到我最新那条朋友圈下
      // toGroup 落地（v53.96）：私聊里说要去群里说的话，真的发到群里。
      // 形状和群成员平时发言完全一致，所以群未读、群记录、周刊素材都照常吃到。
      if (parsed.toGroup && String(parsed.toGroup).toLowerCase() !== "null" && toGroupTarget) {
        const gText = String(parsed.toGroup).trim();
        if (gText) setTimeout(() => pGChat(toGroupTarget.id, p => [...p, {
          role: "assistant", senderId: char.id, senderName: char.name, content: gText,
          ts: Date.now(), fromChat: char.id
        }]), 600);
      }
      if (parsed.momentComment && String(parsed.momentComment).toLowerCase() !== "null") {
        const latest = (moments || []).find(m => m.mine);
        if (latest) pMom(p => p.map(m => m.id === latest.id ? { ...m, likers: [...new Set([...(m.likers || []), char.name])], comments: [...(m.comments || []), { author: char.name, text: String(parsed.momentComment) }] } : m));
      }
      // TA 在聊天里切歌/点歌（一起听联动）→ 真的换全局播放器的歌
      if (parsed.songSwitch && String(parsed.songSwitch).toLowerCase() !== "null") {
        const want = String(parsed.songSwitch).trim();
        if (/下一首|下首|next/i.test(want)) stepSong(1);
        else if (/上一首|上首|prev/i.test(want)) stepSong(-1);
        else {
          const _L = listenRef.current || {};
          const lib = (_L.songs || []).concat((_L.playlists || []).reduce((a, pl) => a.concat(pl.songs || []), [])); // 搜主库+所有歌单
          const hit = lib.find(s => s.title && (s.title === want || s.title.includes(want) || want.includes(s.title))) || null;
          if (hit) playSong(hit.id);
          else if (neteaseApi) { // 歌单里没有→去网易云搜来放（她 2026-07-13 想要的"他自己搜歌"，做靠谱）
            try { const r = await fetch(neteaseApi + "/search?keywords=" + encodeURIComponent(want) + "&limit=1&timestamp=" + Date.now()); const dd = await r.json(); const s = dd && dd.result && dd.result.songs && dd.result.songs[0]; if (s) playSong(resultToSong({ id: s.id, name: s.name, artist: (s.artists || s.ar || []).map(a => a.name).filter(Boolean).join(" / "), cover: (s.album || s.al || {}).picUrl })); else toast("网易云也没搜到《" + want + "》"); } catch (e) { toast("搜歌失败：" + (e.message || "")); }
          }
          else toast("没找到《" + want + "》这首歌");
        }
      }
      // TA 主动邀请一起听 → 在聊天里发一张「一起听邀请」卡
      if (parsed.listenInvite && typeof parsed.listenInvite === "object" && (parsed.listenInvite.song || parsed.listenInvite.say)) {
        const inv = parsed.listenInvite;
        pChat(chatKey, p => [...p, { role: "assistant", kind: "listeninvite", turnId: "li_" + Date.now(), song: inv.song ? String(inv.song).trim() : "", say: inv.say ? String(inv.say).trim() : "", content: "[一起听邀请]" + (inv.say ? " " + inv.say : ""), ts: Date.now(), read: false }]);
        delivered = true;
      }
      // TA 主动转账 / 发位置 / 给亲属卡
      if (parsed.transfer && Number(parsed.transfer.amount) > 0) { postCharTransfer(charId, Number(parsed.transfer.amount), parsed.transfer.note || ""); delivered = true; }
      if (parsed.kinshipcard && Number(parsed.kinshipcard.limit) > 0 && !hasKinship(charId)) { issueKinship(charId, Number(parsed.kinshipcard.limit), parsed.kinshipcard.note || ""); delivered = true; }
      if (parsed.gift && parsed.gift.name && String(parsed.gift.name).toLowerCase() !== "null") { postCharGift(charId, String(parsed.gift.name)); delivered = true; }
      if (parsed.location && (parsed.location.name || parsed.location.coords)) {
        pChat(chatKey, p => [...p, {
        role: "assistant",
        turnId: "geo_" + Date.now(),
        kind: "geo",
        name: parsed.location.name || "某处",
        coords: parsed.location.coords || makeCoords(),
        content: "[位置] " + (parsed.location.name || "某处"),
        ts: Date.now(),
        read: false
        }]);
        delivered = true;
      }
      // 仅当该角色开启了「自由发朋友圈」才把 Ta 想发的动态发出去
      const mo = settingsFor(charId).autoMoment && parsed.moment && String(parsed.moment).toLowerCase() !== "null" ? String(parsed.moment) : null;
      if (mo) { pMom(p => [{
        id: "m_" + Date.now(),
        characterId: charId,
        content: mo,
        ts: Date.now(),
        liked: false,
        likeCount: 0,
        comments: []
      }, ...p]); notifyApp("moments"); if (window.Notify) window.Notify.push({ title: char.name + " 发了条朋友圈", body: mo, tag: "mom-" + charId, charId: charId }); }
      // #A 给恋人留悄悄话（论坛发帖已移除每轮自发，改由 tickAmbient 计数器按 50轮/3天 定时发）
      let ambForum = false, ambWhisper = false;
      if (parsed.whisper && String(parsed.whisper).toLowerCase() !== "null" && couples[charId] && couples[charId].status === "together") {
        // 悄悄话 = 贴到你俩的「便签墙」上（authorId=角色，默认盖着，点开才看得到）——不再进无处显示的 whispers 数组
        const wtext = String(parsed.whisper).trim();
        setCoupleNotes(p => { const n = [{ id: "note_" + Date.now(), characterId: charId, authorId: charId, content: wtext, style: Math.floor(Math.random() * 5), createdAt: Date.now(), replies: [] }, ...p]; saveJSON("x_coupleNotes", n); return n; });
        notifyApp("whisper"); ambWhisper = true; if (window.Notify) window.Notify.push({ title: char.name + " 给你留了句悄悄话", body: wtext, tag: "wh-" + charId, charId: charId });
      }
      // 动态保底：每轮回复计数，很久没发就强制补一条（不影响本轮已自发的）
      if (!opts.proactive) tickAmbient(charId, { moment: !!mo, whisper: ambWhisper, forum: ambForum });
      const affinityBefore = affOf(charId);
      if (typeof parsed.affinityDelta === "number") bumpAff(charId, parsed.affinityDelta, parsed.mood && parsed.mood.label);
      // jiwen 阶段二（v48.80）：把这轮互动的好感增量反喂进积温——聊得好 valence 涨、聊崩了 valence 掉，情绪真的被聊天推动（不只自然回归）。封顶 ±0.25 防单轮暴冲。
      try { if (typeof parsed.affinityDelta === "number" && parsed.affinityDelta !== 0) { const eng = getJiwen(char); if (eng) eng.applyDelta({ valence: Math.max(-0.25, Math.min(0.25, parsed.affinityDelta * 0.05)) }); } } catch (e) {}
      if (parsed.mood && parsed.mood.label) {
        setMoodFor(charId, { ...parsed.mood, ts: Date.now() });
        _moodSkip(charId, true);
      } else _moodSkip(charId, false);
      // A 情绪立体化 shadow：只算十维与 display 候选，写独立 IDB 诊断；绝不注入本轮/下轮 prompt。
      observeEmotionAShadow(charId, parsed.affinityDelta, parsed.mood && parsed.mood.label);
      // B 关系轴 shadow：仅阿屿/顾暮、仅正常用户回合；回复落地后才走 bg，不污染角色生成 prompt。
      if (!opts.proactive && !contMode) observeRelationshipBShadow(char, history.concat(words.map((content, i) => ({ role: "assistant", content, mid: turnId + "_" + i, ts: Date.now(), turnId }))));
      const st = {};
      const stateNow = Date.now();
      const _live0 = statesRef.current[charId] || {};
      putLiveField(st, _live0, "wearing", parsed.wearing, stateNow);
      // 穿着必须确认到具体行程槽。只有模型真的交回了 wearing 才承认本槽已刷新；
      // 漏填则把 pending 留到下一轮，不能提醒一次后继续挂着旧睡衣。
      if (!_s.engineerEyes && _wearRefreshGate.required) {
        if (parsed.wearing && String(parsed.wearing).trim()) {
          st.wearingRefreshPending = false;
          if (_wearScheduleKey) st.wearingScheduleKey = _wearScheduleKey;
        } else {
          st.wearingRefreshPending = true;
        }
      } else if (!_s.engineerEyes && parsed.wearing && String(parsed.wearing).trim() && _wearScheduleKey) {
        st.wearingScheduleKey = _wearScheduleKey;
      }
      const onlineAction = parsed.action && window.ThoughtVoiceGuard ? window.ThoughtVoiceGuard.normalizeAction(parsed.action, char && char.name) : parsed.action;
      putLiveField(st, _live0, "action", onlineAction, stateNow);
      // 普通角色的 action 是一张「此刻」快照：模型本轮重新确认了，即使事实仍相同也要刷新时效；
      // 若本轮漏填，则宁可清空待下轮重建，也不能把已经过时的旧动作无限展示下去。
      // 驻场工程师（言秋）走自治专线，不受普通角色状态作业影响。
      if (!_s.engineerEyes) {
        if (onlineAction && String(onlineAction).trim()) st.actionUpdatedAt = stateNow;
        else { st.action = null; st.actionUpdatedAt = 0; }
      }
      putLiveField(st, _live0, "place", parsed.place, stateNow);
      // 换了地方＝换了场景:穿着降级为「不知道」。不是恢复旧值,也不是替他编一套,
      // 而是下一轮据当下场景重新确立(场景域字段的生命周期,Codex 2026-08-18)。
      if (st.place && _live0.place && !sameStateValue(st.place, _live0.place) && !parsed.wearing) {
        st.wearing = null; st.wearingUpdatedAt = 0;
      }
      if (parsed.condition && String(parsed.condition).toLowerCase() !== "null") { st.condition = String(parsed.condition).trim(); st.conditionUpdatedAt = stateNow; }
      else if (parsed.condition === null && (statesRef.current[charId] || {}).condition) { st.condition = null; st.conditionUpdatedAt = 0; }
      // 线上是「有新的才覆盖」(与线下的每轮自清相反)。给它加两道时效:自己的时间戳,
      // 以及连续 N 轮没有新心声就判过期——否则守卫拒一次就永远挂着旧念头。
      {
        const _live = statesRef.current[charId] || {};
        if (parsed.thought && String(parsed.thought).toLowerCase() !== "null") {
          st.thought = parsed.thought; st.thoughtUpdatedAt = stateNow; st.thoughtSkips = 0;
        } else if (!_s.engineerEyes) {
          // 普通角色本轮没有产出有效心声时立刻清掉旧快照，绝不拿上一轮冒充本轮更新。
          st.thought = null; st.thoughtUpdatedAt = 0;
          const skips = Math.min((Number(_live.thoughtSkips) || 0) + 1, 99);
          st.thoughtSkips = skips;
          if (skips === 12) toast("这个角色连着 12 轮没按协议返回心声——多半是当前聊天模型不稳定支持 thought 字段，建议换个模型试试", 9000);
        } else {
          // 言秋由自己的协议决定是否写心声；普通角色的强制刷新与催填都不作用于他。
          const skips = Math.min((Number(_live.thoughtSkips) || 0) + 1, 99);
          st.thoughtSkips = skips;
          // 提醒也催不动 → 多半跟「不吐 photo」是同一个病：这个模型不认可选字段。
          // 只在越过某一轮时说一次，别每轮都念（她 2026-08-22 已经自己发现过一次同类问题）。
          if (skips === 12) toast("这个角色已经 12 轮没有自愿留下新心声", 6000);
          // 清空只对「确实还挂着旧念头」的情况有意义
          if (_live.thought && skips >= THOUGHT_SKIP_LIMIT) { st.thought = null; st.thoughtUpdatedAt = 0; }
        }
      }
      if (Object.keys(st).length) {
        const liveState = statesRef.current[charId] || {};
        const ns = { ...liveState, ...st, mood: parsed.mood && parsed.mood.label ? parsed.mood.label : liveState.mood, ts: Date.now(), turnId, affinityBefore };
        setStateFor(charId, ns);
        pushStateHist(charId, ns);
      }
      const _roomMayRemember = !room || !!(room.writeback && room.writeback.memoryCandidate);
      if (_roomMayRemember) {
        setTimeout(() => maybeSummarize(charId), 100);
        setTimeout(() => maybeAutoExtract(charId), 300);
      }
      // P0-2 冷却的 turn 计数：只在该角色完成一次正常回复后 +1（后台/预览/touch:false 不计）
      try { if (!opts.proactive && delivered) window.RecallShadow && window.RecallShadow.turnDone(charId); } catch (e2) {}
      if (delivered && eLiveProjection && window.InnerLifeETidalShadow && window.InnerLifeETidalShadow.commitLiveProjection) {
        try { await window.InnerLifeETidalShadow.commitLiveProjection(charId, eLiveProjection.anchor, Date.now()); } catch (e) {}
      }
      // 侧房成功接住主房近况后才推进游标；失败轮不推进，避免“看似同步、其实漏读”。
      if (delivered && room && !room.main && room.cognition && room.cognition.mainDelta && window.ChatRooms) {
        const mainRows = chatsRef.current[charId] || [];
        const seenTo = mainRows.reduce((n, m) => Math.max(n, Number(m && m.ts || 0)), Number(room.mainCursorTs || 0));
        if (seenTo > Number(room.mainCursorTs || 0)) window.ChatRooms.save(charId, { ...room, mainCursorTs: seenTo });
      }
      return delivered;
    } catch (e) {
      pChat(chatKey, p => [...p, {
        role: "assistant",
        kind: "system",
        contextExcluded: true,
        systemFailure: true,
        content: "（发送失败：" + e.message + "）",
        ts: Date.now(),
        turnId: "e_" + Date.now()
      }]);
      return false;
    } finally {
      endLane("c:" + chatKey);
    }
  };
  // CC 工具结果是异步的：云端完成后先作为隐藏系统事实落进同一私聊，
  // 再让 App 里的同一个言秋自然消化并接话。job_id 去重，刷新/断网可续。
  useEffect(() => {
    if (!loaded || !window.YanqiuCcTools || !window.Cloud) return;
    if (!ccToolManagerRef.current) {
      try { ccToolManagerRef.current = window.YanqiuCcTools.createManager({ storage: localStorage, cloud: window.Cloud }); }
      catch (e) { return; }
    }
    let stopped = false, timer = null;
    const resuming = new Set();
    const tick = async () => {
      if (stopped || document.visibilityState === "hidden") return;
      try {
        const completed = await ccToolManagerRef.current.poll();
        for (const item of completed) {
          if (stopped || resuming.has(item.jobId)) continue;
          resuming.add(item.jobId);
          const payload = item.status === "completed"
            ? { ok: true, tool: item.toolName, purpose: item.purpose || null, result: item.result }
            : { ok: false, tool: item.toolName, purpose: item.purpose || null, error: item.error || "CC 工具任务失败" };
          pChat(item.charId, rows => rows.some(m => m && m.ccToolJobId === item.jobId) ? rows : [...rows, {
            role: "system", kind: "system", ccToolResult: true,
            ccToolJobId: item.jobId, ccToolResultData: payload,
            content: "（CC 只读工具结果已返回）", ts: Date.now(), read: true,
            turnId: "cc_tool_" + item.jobId
          }]);
          const replied = await replyNow(item.charId, "", null, { ccToolResume: true });
          if (replied) ccToolManagerRef.current.markDelivered(item.jobId);
          resuming.delete(item.jobId);
        }
      } catch (e) {/* 未登录、离线或表未部署：任务留在本机，下次继续。 */}
    };
    const schedule = () => { if (!stopped) { clearTimeout(timer); timer = setTimeout(async () => { await tick(); schedule(); }, 2500); } };
    tick(); schedule();
    const onFocus = () => tick();
    window.addEventListener("focus", onFocus);
    return () => { stopped = true; clearTimeout(timer); window.removeEventListener("focus", onFocus); };
  }, [loaded]);
  // OOC：跳出角色直接问模型（调整/问状态）。my ooc + system 回复都不进角色扮演上下文。
  const oocReply = async (charId, text) => {
    if (laneBusy("c:" + charId) || !text || !text.trim()) return;
    const char = characters.find(c => c.id === charId);
    pChat(charId, p => [...p, {
      role: "user",
      kind: "ooc",
      content: text.trim(),
      ts: Date.now(),
      read: true
    }]);
    if (!active) {
      toast("请先到设置配置 API");
      return;
    }
    startLane("c:" + charId);
    try {
      // OOC 助手的连续性：角色视角的 recentChat 已把 OOC 全滤掉（v48.13），
      // 但助手自己要能接得上之前的 OOC 来回——单独补一段【带标签】的幕后对话，和正戏分清、不会再混
      const oocCtx = ctxFor(char);
      const oocLines = (chatsRef.current[charId] || []).filter(m => !m.recalled && isOocMsg(m)).slice(-8)
        .map(m => (m.role === "user" ? "用户(OOC)" : "助手(OOC)") + "：" + String(m.content || "").slice(0, 300)).join("\n");
      if (oocLines) oocCtx.recentChat = (oocCtx.recentChat ? oocCtx.recentChat + "\n\n" : "") + "【最近的 OOC 幕后对话（用户越过角色和你这个助手聊的——角色本人不知道这些，别当成他俩的对话）】\n" + oocLines;
      const res = await oocAsk(apiFor(charId), oocCtx, text.trim());
      // 合理的调整要求 → 存成长期准则（refused 时不存）
      if (res.directive && !res.refused) addDirective(charId, res.directive);
      pChat(charId, p => [...p, {
        role: "assistant",
        kind: "system",
        content: res.reply + (res.directive && !res.refused ? "\n\n〔已记为长期准则：" + res.directive + "〕" : "") + (res.refused ? "\n\n〔这条我没有照做——会破坏 " + char.name + " 的人设〕" : ""),
        ts: Date.now(),
        turnId: "ooc_" + Date.now()
      }]);
    } catch (e) {
      toast("OOC 失败：" + (e.message || "重试"));
    } finally {
      endLane("c:" + charId);
    }
  };

  // 我撤回一条消息后，角色按人设/心情反应：有没有看到那条、会不会追问
  const reactToMyRecall = async (charId, text) => {
    if (!active || sending) return;
    const char = characters.find(c => c.id === charId); if (!char) return;
    startLane("c:" + charId);
    try {
      const raw = await callAI(apiFor(charId), buildBundle(ctxFor(char)) + "\n\n【场景】用户刚刚撤回了一条发给你的消息，那条原本的内容是：「" + text + "」。完全代入「" + char.name + "」，按你的人设、注意力和此刻心情，决定：你有没有『看到』那条被撤回的消息（saw）；看到了的话会不会追问/调侃/在意。有人眼疾手快都看到了、会追问「你刚撤回了啥」；有人根本没注意、就当没发生。用即时通讯口吻，短句。\n【输出】只输出 JSON：{\"saw\":true或false,\"say\":[\"气泡1\"]}（没看到或不在意时 say 给空数组）", [{ role: "user", content: "（用户撤回了一条消息）" }], { maxTokens: 700 });
      const d = extractJSON(raw) || {};
      const says = Array.isArray(d.say) ? d.say : (d.say ? [d.say] : []);
      says.forEach((w, i) => setTimeout(() => pChat(charId, p => [...p, { role: "assistant", content: w, ts: Date.now(), read: false }]), 500 + i * 650));
    } catch (e) {/* silent */} finally { endLane("c:" + charId); }
  };

  // ---- long-press actions ----
  const addFavorite = (charId, m) => {
    // imgKey/desc/dur 也要带走：不然收藏的自拍打开是「无文本消息」、语音丢时长
    const entry = { id: "fav_" + Date.now() + "_" + Math.floor(Math.random() * 1000), charId, role: m.role, content: m.content || "", kind: m.kind || null, url: m.url || null, imgKey: m.imgKey || null, desc: m.desc || null, dur: m.dur || null, keyword: m.keyword || null, ts: m.ts || Date.now(), savedTs: Date.now() };
    setFavorites(p => { const n = [entry, ...p]; saveJSON("x_favorites", n); return n; });
    toast("已收藏");
  };
  const delFavorite = id => setFavorites(p => { const n = p.filter(f => f.id !== id); saveJSON("x_favorites", n); return n; });
  const handleMsgAction = (act, idx, sourceKey) => {
    const threadKey = sourceKey || activeChar.id;
    const isSideRoom = !!(window.ChatRooms && window.ChatRooms.isSideKey(threadKey));
    const msgs = chats[threadKey] || [];
    const m = msgs[idx];
    if (act === "fav") { addFavorite(activeChar.id, m); return; }
    if (act === "copy") {
      navigator.clipboard && navigator.clipboard.writeText(m.content);
      toast("已复制");
    } else if (act === "recall") {
      const orig = m;
      pChat(threadKey, p => {
        const next = p.map((x, i) => i === idx ? { ...x, recalled: true } : x);
        try { window.MessageBranchShadow && window.MessageBranchShadow.observeMutation({ kind: "recall", charId: activeChar.id, before: p, after: next, targetIndex: idx }); } catch (e) {}
        return next;
      });
      if (orig && orig.role === "user" && orig.content) reactToMyRecall(activeChar.id, orig.content);
    } else if (act === "edit") {
      const cid = activeChar.id;
      setEditMsg({ content: m.content || "", onSave: nv => pChat(threadKey, p => {
        const next = p.map((x, i) => i === idx ? { ...x, content: nv } : x);
        try { window.MessageBranchShadow && window.MessageBranchShadow.observeMutation({ kind: "edit", charId: cid, before: p, after: next, targetIndex: idx }); } catch (e) {}
        return next;
      }) });
    } else if (act === "quote") {
      toast("已引用（在输入框继续说）");
    } else if (act === "memsave") {
      const who = m.role === "user" ? profile.name || "我" : activeChar.name;
      addMemEntry({
        text: who + "：" + m.content,
        charIds: [activeChar.id],
        knownBy: [activeChar.id],
        source: "chat"
      });
      toast("已存入记忆库");
    } else if (act === "reroll") {
      if (m.role !== "assistant") {
        toast("只能重Roll角色的消息");
        return;
      }
      const turnId = m.turnId;
      if (turnId) {
        const branch=window.RerollBranch&&window.RerollBranch.truncateChatBranch
          ?window.RerollBranch.truncateChatBranch(msgs,idx,turnId)
          :{after:msgs.slice(0,idx),removed:msgs.slice(idx),start:idx,turnIds:[turnId]};
        const removed=branch.removed,removedTurns=branch.turnIds;
        // 共享账本也只做软删；离线时进入专用 outbox，联网后补盖 deleted_at。
        if (!isSideRoom) try {
          const y = ledgerYanqiu();
          if (y && String(y.id) === String(activeChar.id) && window.ChatLedgerShadow) window.ChatLedgerShadow.invalidate({ charId: y.id, threadType: "private", threadId: y.id }, removed);
        } catch (e) {}
        // 旧分支副作用回滚：只撤销“证据全部来自该角色旧 turn”的自动记忆；数据库同步为软删。
        const journal = loadJSON("x_rerollMemoryJournal", {}),doomed=new Set();
        removedTurns.forEach(id=>(journal[activeChar.id+"|"+id]||[]).forEach(memId=>doomed.add(String(memId))));
        if (!isSideRoom && doomed.size) saveMemLib(memLibRef.current.filter(e => !doomed.has(String(e && e.id))));
        let journalChanged=false;removedTurns.forEach(id=>{const key=activeChar.id+"|"+id;if(journal[key]){delete journal[key];journalChanged=true;}});
        if(!isSideRoom&&journalChanged)saveJSON("x_rerollMemoryJournal",journal);
        // 心声/心情/动作/穿着恢复到该 turn 之前；新回复随后从这份真实状态继续。
        if (!isSideRoom) rollbackCharTurns(activeChar.id,removedTurns,false);
        // 抽取书签退回旧分支之前，让新分支能重新参加自动抽取。
        const firstTs = Math.min(...removed.map(x => Number(x.ts) || Date.now()));
        if (!isSideRoom && Number.isFinite(firstTs)) memExtractMarkRef.current[activeChar.id] = Math.min(memExtractMarkRef.current[activeChar.id] || firstTs, firstTs - 1);
        // 正常回合：删掉这一轮 AI 回复（保留用户最后一条）重生成
        pChat(threadKey, p => {
          const liveBranch=window.RerollBranch&&window.RerollBranch.truncateChatBranch?window.RerollBranch.truncateChatBranch(p,idx,turnId):branch;
          const next=liveBranch.after;
          try { window.MessageBranchShadow && window.MessageBranchShadow.observeMutation({ kind: "reroll",surface:"private", charId: activeChar.id, before: p, after: next, targetIndex: liveBranch.start, turnId }); } catch (e) {}
          return next;
        });
      } else {
        // 无 turnId 的旧消息也必须开新分支：从目标处截尾，不能留下基于旧回答的后文。
        const branch=window.RerollBranch&&window.RerollBranch.truncateChatBranch
          ?window.RerollBranch.truncateChatBranch(msgs,idx,null)
          :{after:msgs.slice(0,idx),removed:msgs.slice(idx),start:idx,turnIds:[]};
        const removedTurns=branch.turnIds||[],journal=loadJSON("x_rerollMemoryJournal",{}),doomed=new Set();
        removedTurns.forEach(id=>(journal[activeChar.id+"|"+id]||[]).forEach(memId=>doomed.add(String(memId))));
        if(!isSideRoom&&doomed.size)saveMemLib(memLibRef.current.filter(e=>!doomed.has(String(e&&e.id))));
        let journalChanged=false;removedTurns.forEach(id=>{const key=activeChar.id+"|"+id;if(journal[key]){delete journal[key];journalChanged=true;}});
        if(!isSideRoom&&journalChanged)saveJSON("x_rerollMemoryJournal",journal);
        if (!isSideRoom) rollbackCharTurns(activeChar.id,removedTurns,true);
        if (!isSideRoom) try{const y=ledgerYanqiu();if(y&&String(y.id)===String(activeChar.id)&&window.ChatLedgerShadow)window.ChatLedgerShadow.invalidate({charId:y.id,threadType:"private",threadId:y.id},branch.removed);}catch(e){}
        pChat(threadKey, p => {
          const liveBranch=window.RerollBranch&&window.RerollBranch.truncateChatBranch?window.RerollBranch.truncateChatBranch(p,idx,null):branch;
          const next=liveBranch.after;
          try { window.MessageBranchShadow && window.MessageBranchShadow.observeMutation({ kind: "reroll",surface:"private_legacy", charId: activeChar.id, before: p, after: next, targetIndex: liveBranch.start }); } catch (e) {}
          return next;
        });
      }
      setTimeout(() => {
        const roomId = window.ChatRooms && window.ChatRooms.isSideKey(threadKey) ? String(threadKey).split("::room::")[1] : "main";
        const rerollRoom = window.ChatRooms ? window.ChatRooms.get(activeChar.id, roomId) : null;
        replyNow(activeChar.id, null, null, { chatKey: threadKey, room: rerollRoom });
      }, 200);
    }
  };

  // ---- group chat ----
  const gsFor = id => groupSettings[id] || {
    spectate: false,
    memoryInterop: false,
    privateCtxN: 0,
    preJoinN: 0,
    ctxN: 30,
    sumThresh: 150,
    sumBuffer: 20
  };
  // 群创建时间：优先用显式 createdTs，老群回落到 id 里的时间戳
  const groupCreatedTs = group => (group && group.createdTs) || (group && /^g_\d+$/.test(group.id) ? Number(group.id.slice(2)) : 0);
  const saveGroupSettings = (id, patch) => setGroupSettings(p => {
    const n = {
      ...p,
      [id]: {
        ...gsFor(id),
        ...patch
      }
    };
    saveJSON("x_groupSettings", n);
    return n;
  });
  const pushGroupRich = (groupId, msg) => pGChat(groupId, p => [...p, {
    ts: Date.now(),
    ...msg,
    // 引用跨轮靠这个稳定 ID 找回原消息；即使调用方带了 undefined 也不能把兜底覆盖掉。
    mid: msg.mid || ("gm_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8))
  }]);
  // 只把我的消息（或旁白）入队，不触发角色 —— 像私聊那样连发后再按按钮
  const pushGroupUser = (groupId, text) => {
    if (text == null || text === "") return;
    const gs = gsFor(groupId);
    pGChat(groupId, p => [...p, gs.spectate ? {
      role: "narration",
      content: text,
      mid: "gm_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
      ts: Date.now()
    } : {
      role: "user",
      content: text,
      mid: "gm_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
      ts: Date.now()
    }]);
  };
  // 让群成员基于当前全部记录回应一次（不新增我的输入）
  const replyGroup = async (groupId, rgOpts = {}) => {
    if (laneBusy("g:" + groupId)) return;
    // 黑色回复键 / 让他们继续：立即开一张全新额度卡，且这一段起聊不等动念。
    // lastUserTs 必须一起记上她【最后那句话】的时间——否则下一次巡检会把它当成
    // 一条没处理过的新用户消息，再 reset 一次、顺手把 kicked 抹掉，白按。
    if (!rgOpts.auto) {
      const _gch = groupChatsRef.current[groupId] || [];
      let _lastUserTs = 0;
      for (let i = _gch.length - 1; i >= 0; i--) { const m = _gch[i]; if (m && m.role === "user") { _lastUserTs = Number(m.ts) || 0; break; } }
      resetAutoChatCycle(groupId, _lastUserTs, true);
    }
    const group = groups.find(g => g.id === groupId);
    const members = group.memberIds.map(id => characters.find(c => c.id === id)).filter(Boolean);
    const gs = gsFor(groupId);
    // 有成员此刻正和用户在别处【线下面对面】进行中：别让 TA 在群里分身、别出现在和那场线下矛盾的场景（她报：顾朝线下购物、群里却煮汤给两人）
    const gBusyOff = members.filter(c => offlineTogetherNow(c.id)); // 此刻正和用户面对面的成员：不排除，但要处境一致
    const gBusyHint = gBusyOff.length ? "\n\n【在场状态·重要】" + gBusyOff.map(c => c.name).join("、") + " 此刻正【在外面和人面对面相处中】（不在家/不在电脑前）——TA 在群里【可以照常发消息】（人陪着朋友也会掏手机回别人/群），但发言内容【必须符合 TA 此刻正在外面、忙着的处境】（例：『在外头呢，抽空回你一句』『稍后细说』），**绝不许让 TA 出现在和那处境矛盾的地点/活动里**（如同时说自己在家煮饭/在公司加班）。TA 不必也别主动说出自己正和谁在一起（关系隐私）。" : "";
    // 群线下进行中：这个群此刻有一场群线下相处（进行中），线上群回复要知道大家正面对面、别当没相处过（群版 offlineActiveFor）
    const gOffSess = (groupOfflinesRef.current[groupId] || []).find(s => s && !s.endTs && (s.msgs || []).length);
    let gOfflineHint = "";
    if (gOffSess) {
      const _un = profile.name || "用户";
      const _gnarr = (gOffSess.msgs.find(m => m.role === "narration") || {}).content || "";
      const _gr = (gOffSess.msgs || []).filter(m => m && m.kind !== "ooc" && m.content).slice(-8).map(m => (m.role === "narration" ? "【场景】" : m.role === "user" ? _un : (m.senderName || "某人")) + "：" + String(m.content).replace(/\s+/g, " ").slice(0, 80)).join("\n");
      gOfflineHint = "\n\n【你们此刻正在一场群线下相处 · 进行中】" + (_gnarr ? "（场景：" + String(_gnarr).replace(/\s+/g, " ").slice(0, 50) + "）" : "") + "——用户从线上给群里发消息，多半是这场线下的间隙里插空发的；你们清楚大家此刻正面对面在一起，就顺着接，**别当没相处过、别问『在哪呢/怎么还不来』**，也别演成才刚到。最近线下：\n" + _gr;
    }
    startLane("g:" + groupId);
    // 走到哪一步的标记：出错时和错误类型一起报出来，省得只剩一句无从下手的报错文案
    let phase = "准备上下文";
    try {
      if (!active) throw new Error("请先配置 API");
      const gchat = groupChatsRef.current[groupId] || [];
      const gQuoteCatalog = window.GroupQuote ? window.GroupQuote.buildCatalog(gchat, profile.name || "用户", 50) : [];
      const gQuoteByMessage = new Map(gQuoteCatalog.map(x => [x.message, x]));
      const gQuoteCatalogText = gQuoteCatalog.length ? "\n\n【可正式引用的旧消息 · 跨轮有效】\n" + gQuoteCatalog.map(x => x.alias + "｜" + x.senderName + "｜" + x.preview).join("\n") + "\n需要显示引用气泡时，用 quoteId 填对应 Q 编号。即使相隔数轮也可以回引；相同文字必须依作者和编号区分，绝不能猜是谁说的。只口头提『你刚刚说过』而不需要引用气泡时，可以不填。" : "";
      const _graw = gchat.filter(m => m.kind !== "ooc" && contextAllowsMessage(m)).slice(-(gs.ctxN || 30));
      const fmtGLine = m => m.kind === "callend" ? "【这个位置大家通了一通" + (m.callMode === "video" ? "视频" : "语音") + "电话，时长 " + (m.dur || "不长") + (m.sum ? "。内容：" + m.sum : "") + "，别当没打过】" : m.kind === "offlinelog" ? "【你们刚刚线下见了一面（发生在上面之后、现已回到线上群聊，据此接话）】归档摘要：" + m.content + (m.transcript ? "\n【线下实际逐条记录·以原话为准】\n" + m.transcript : "") : m.role === "narration" ? "【旁白】" + m.content : m.role === "system" ? "（" + m.content + "）" : (m.role === "user" ? profile.name || "用户" : m.senderName || "某人") + ": " + (m.kind === "forumshare" ? "[转发了一条贴吧帖]" + (m.post ? "「" + (m.post.board || "") + "」《" + (m.post.title || "") + "》｜" + String(m.post.body || "").replace(/\s+/g, " ").slice(0, 120) + "｜作者显示：" + (m.post.authorName || "") : (m.content || "")) : m.kind === "photo" && m.imageRef ? "[发来一张真实照片，像素会随本轮视觉输入附上]" + (m.desc ? " 配文：" + m.desc : "") : m.kind === "selfie" ? (m.failed ? "[尝试发照片但生成失败]" : "[已经实际发出一张" + (m.photoKind === "duo" ? "合照" : m.photoKind === "other" ? "他人拍摄的照片" : "自拍") + "，本人必须记得，不能马上重复发]" + (m.desc ? " 内容：" + m.desc : "")) : m.kind === "voice" ? "[语音消息，说的不是打的] " + m.content + voiceToneForPrompt(m) : m.kind === "poll" ? "[发起投票]" + m.title : m.kind === "redpacket" ? "[发红包 ¥" + m.total + "，" + m.count + "个" + (m.count > 0 ? "，人均约¥" + (m.total / m.count).toFixed(2) : "") + "]" + (m.message ? " " + m.message : "") + ((m.claims || []).length ? "（已被抢：" + m.claims.map(c => (c.name || "某人") + "¥" + c.amount).join("、") + "）" : "") : (m.content || ""));
      // 插时间断点：相邻消息间隔 >1.5h 就标一行「隔了约X、到了几点」——让模型知道时间过去了、别把旧事当正在发生（item 3/5）
      const _gparts = []; let _gprev = 0;
      for (const m of _graw) { const ts = m.ts || 0; if (_gprev && ts && ts - _gprev > 90 * 60000) _gparts.push("〔—— 中间隔了约 " + gapPhrase(ts - _gprev) + "，到 " + fmtStampAI(ts) + " ——〕"); const ta = (m.role === "user" || m.role === "narration") && window.TemporalAnchor ? window.TemporalAnchor.anchor(m.content, ts) : ""; const qr = gQuoteByMessage.get(m); const quoteNote = m.replyTo ? "【这条正在引用 " + (m.replyToSenderName || "作者未知") + (m.replyToId ? "（消息 " + m.replyToId + "）" : "") + "：『" + String(m.replyTo).replace(/\s+/g, " ").slice(0, 100) + "』】\n" : ""; _gparts.push((qr ? "[" + qr.alias + "] " : "") + quoteNote + (gs.memoryInterop && ts ? "[" + fmtStampAI(ts) + "] " : "") + fmtGLine(m) + (ta ? " " + ta : "")); if (ts) _gprev = ts; }
      const hist = _gparts.join("\n");
      // 断档要看「用户这次刚发的几条」之前的最后一条——不然刚发的消息把间隔清零，
      // 断档提醒永远不触发，隔夜回来成员还接着昨晚的事演（比如牛腩炖了一整夜）
      let _glast = 0;
      for (let i = _graw.length - 1, seenOld = false; i >= 0; i--) {
        const mm = _graw[i];
        if (!seenOld && (mm.role === "user" || mm.role === "narration")) continue; // 跳过本轮触发的新消息
        seenOld = true;
        if (mm.ts) { _glast = mm.ts; break; }
      }
      const _ggap = _glast ? Date.now() - _glast : 0;
      const _crossDay = _glast && new Date(_glast).toDateString() !== new Date().toDateString();
      const gTimeHint = "\n\n【此刻时间】现在是 " + new Date().toLocaleString("zh-CN", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }) + (_ggap > 3 * 3600000 ? "。距群里上一轮对话已过去约 " + gapPhrase(_ggap) + (_crossDay ? "（已经是新的一天了）" : "") + "——**上面聊的事已经翻篇：别把聊到一半的事当成正在发生**。当时说要去办的事（买菜/做饭/出门…）早就办完或不了了之了，每个人现在都在过自己此刻该过的生活；接话要从【现在这个时间点】的状态出发，绝不许把上一轮的场景直接续着演。" : "。上面群聊记录里若有〔时间断点〕标记，按真实先后顺序理解发生了什么，别把很早以前的事当成刚刚。");
      // 补充上文：每位成员入群前的私聊，作为「封闭空间」的 X 条前情提要——
      // 只在【未开记忆互通】时用；开了互通就实时抽单聊，这档自动让位、不叠加。
      let preJoin = "";
      if (gs.preJoinN > 0 && !gs.memoryInterop) {
        const cutTs = groupCreatedTs(group);
        const pj = members.map(c => {
          const before = (chatsRef.current[c.id] || []).filter(m => !m.recalled && !m.kind && (!cutTs || (m.ts || 0) < cutTs)).slice(-gs.preJoinN);
          if (!before.length) return "";
          const lines = before.map(m => (m.role === "user" ? profile.name || "用户" : c.name) + "：" + m.content).join("\n");
          return "『" + c.name + "』〔以下只有 " + c.name + " 本人知道，别的成员并不知情〕入群前和用户的私聊：\n" + lines;
        }).filter(Boolean).join("\n\n");
        // ⚠️这一整块以前是【没有隐私围栏】的共享注入（隔壁 interop 的 memLines 有铁律、它没有），
        // 于是顾朝能逐字读到裴照川的私聊，第一句就抖出了「大房二房」这个只属于他俩的梗
        //（她 2026-08-24 抓到）。围栏照抄 interop 那份，一个字都不放松。
        if (pj) preJoin = "\n\n【每位成员入群前和用户的私聊 · ⚠️隐私边界铁律】\n"
          + "下面每一段【只属于标注的那位成员本人】。**一个成员绝不知道、也绝不许提及、暗示、化用或质问另一个成员和用户之间私聊过什么、有过什么梗、是什么关系**——除非那位成员【自己在群里主动说了出来】。\n"
          + "尤其注意：别人段落里的称呼、玩笑、专属梗、约定、旧事，对你来说【根本不存在】，不许拿来开场、接话或试探。每个成员只凭『自己那一段』和『群里公开说过的话』行动。\n"
          + "这些只是背景，别生硬复述。\n" + PRIVATE_IS_BACKGROUND_NOT_AMMO + "\n" + pj;
      }
      const gPersonaCap = groupPersonaBudget(members.filter(c => !c.npc).length);
      const memberDesc = members.map(c => {
        const ph = (phones || {})[c.id] || {};
        const pn = ph.music && ph.music.songs && ph.music.songs.length ? "（TA 最近在听：" + ph.music.songs.slice(0, 4).map(s => s.name).join("、") + "，对上了能认出来）" : "";
        const st = statesRef.current[c.id] || {};
        const freshWearing = freshLiveStateValue(st, "wearing"), freshAction = freshLiveStateValue(st, "action");
        const live = gs.memoryInterop && (freshWearing || freshAction) ? "\n当前状态（只供后台保持连续，不写进聊天气泡）：" + [freshWearing && "穿着=" + freshWearing, freshAction && "上一动作=" + freshAction].filter(Boolean).join("；") : "";
        // 普通线上群聊也带上成员「长出来的自我」(Codex 抓到的漏口：私聊/线下有、线上群没有→进群就退回旧人设)
        const grown = (window.DesireKit && desiresRef.current[c.id]) ? window.DesireKit.personaText(desiresRef.current[c.id]) : "";
        const grownSeg = grown && grown.trim() ? "\n〔" + c.name + " 长出来的自我（经历沉淀下来的、是 TA 当下真实的一部分，自然体现，别当台词复述）〕\n" + grown.trim() : "";
        // 「四处一样喂」（.claude/rules/four-surfaces-same-context.md）：单聊经 buildBundle
        // 拿到全文人设＋此刻心情＋好感度，群聊以前只有 200 字人设、别的一层都没有——
        // 于是同一个人在群里只剩「一个古代王爷」这个标签，空白由训练先验补成霸总。
        // 心情和好感是【这个人此刻是谁】、不是【你们之间发生过什么】，所以封闭群照给。
        const md = window.MoodLabel && window.MoodLabel.settle
          ? window.MoodLabel.settle((moods[c.id] || {}).label, (moods[c.id] || {}).ts, Date.now())
          : { label: (moods[c.id] || {}).label || "", note: "" };
        const mdSeg = md.label ? "\n〔此刻心情〕" + md.label : (md.note ? "\n〔心情〕" + md.note : "");
        const afSeg = "\n〔对 " + (profile.name || "用户") + " 的好感〕" + Math.round(affOf(c.id)) + "/100";
        // 年龄按今天现算（她刚做的生日字段，群里一直没吃到）
        const ageSeg = (() => { const a = ageLineFor(c); return a ? "\n〔你现在〕" + a : ""; })();
        // ⚠️和用户是什么关系是【这位成员的私事】——落在他自己这一段里，别的成员不知道（隐私铁律见下）
        const cpSeg = (() => { const l = coupleLineFor(c.id, profile.name || "用户"); return l ? "\n〔以下只有 " + c.name + " 本人知道，别的成员并不知情〕" + l : ""; })();
        const sbSeg = (() => { const b = schedBriefFor(c); return b ? "\n〔此刻在做什么〕" + b + "（自然渗进语气和状态，别报行程表）" : ""; })();
        // NPC 是只在群里出场的配角（她 2026-08-25 拍板）：没有心情、没有好感度。
        // 也不吃印象卡、长出来的自我、年龄、行程、情侣状态——那些都是
        // 「这个主角色是谁」的层，配角没有，给了反而会演出争宠吃醋那一套。
        // 人设额度另算：群预算是按人数平分的，配角挤进去会把主角色的额度吃掉。
        if (c.npc) {
          const owner = characters.find(x => x.id === c.ownerId);
          return "【" + c.name + "】" + groupPersonaText(c.persona, NPC_PERSONA_CAP)
            + (owner ? "\n〔这是 " + owner.name + " 身边的人，只在群里出场〕" : "");
        }
            // 别的群里刚说过的话：只给 TA 本人这一段，别的成员看不到（同隐私铁律的落法）
        const xgSeg = (() => {
          const said = crossChannelSaid(c.id, groupId);
          return said ? "\n〔你刚在别的群里说过这些（是你本人说的，这儿别说岔了：时间、安排、答应过的事都要接得上。别的成员不一定知道，别替他们知道，也别复述『我刚在群里说过』）〕\n" + said : "";
        })();
        return "【" + c.name + "】" + groupPersonaText(c.persona, gPersonaCap) + pn + live + grownSeg + mdSeg + afSeg + ageSeg + sbSeg + cpSeg + xgSeg;
      }).join("\n\n");
      // B（v50.80）：线上群聊里开启成长的成员，加一条只针对他们的成长准则（软层可长、硬核不动）；其余照旧贴原卡。
      const gEvolveNames = members.filter(c => PERSONA_EVOLVE_IDS.includes(c.id)).map(c => c.name);
      const gGrowthHint = gEvolveNames.length ? "\n\n【这些成员会成长·不冻在原卡里：" + gEvolveNames.join("、") + "】\n他们的人设卡是【起点和底色】不是牢笼：硬核（身份／世界观／说话底色／明确边界／真实发生过的重要经历）绝不因几轮相处被改写或软化；但软层（和用户亲近的方式／处理冲突闹别扭的习惯／偏好／勇气／信任／对未来怎么选）允许被各自『长出来的自我』推着长成新样子。只有【已沉淀成正式人格档案（上面那段『长出来的自我』）】的成长才算数、才可盖过原卡软倾向；最近几轮的经历只能让 TA 当下有所松动，不等于人格已永久改变。冲突时：明确硬设定与边界 ＞ 已固化的成长 ＞ 原卡软倾向 ＞ 通用默认。**其余在场成员照旧严格贴合各自原卡、不适用本条。**" : "";
      // 双语（v56.56）：开关是【每个角色自己的】聊天设置，群里就按各人自己那一档来——
      // 「四处一样喂」（.claude/rules/four-surfaces-same-context.md）：单聊有的层群聊也要有，
      // 别又变成同一件事只写在单聊那一处。线下（叙事正文）没有译键、也切不出「原文|译文」
      // 这个单位，所以那两处不接——这是写明理由的差异，不是漏。
      // 格式写在【字段本身】上（v56.86）：另起一段规则时模型只照着做第一条就忘了
      const gBiTextSpec = (typeof bilingualRule === "function"
        && members.some(c => !c.npc && (settingsFor(c.id) || {}).bilingual))
        ? "（开了双语的成员，每一条不是中文的都写成『原文 | 中文』，一条不落）" : "";
      const gBiHint = (typeof bilingualRule === "function"
        ? members.filter(c => !c.npc && (settingsFor(c.id) || {}).bilingual).map(c => "\n\n" + bilingualRule(c.name) + "（只对 " + c.name + "，别的成员照常写。）").join("")
        : "");
      const relLines = members.map(c => directedRelationLines(c, rels, characters, profile)).join("\n");
      let interop = "";
      // ⭐封闭群改成【只进不出】（她 2026-08-24：「长出来的自我、记忆库这些要只进不出，
      // 封闭群不应该影响主要世界」）。以前 memoryInterop 一个开关同时管两个方向，
      // 关掉就是「不进也不出」——于是封闭群里所有人都退化成一张标签。
      // 现在：【读】一律给（记忆库、长期记忆、印象卡、长出来的自我），角色在哪儿都是完整的自己；
      //      【写】仍然全部封死（记忆库、状态卡、好感、朋友圈、钱包、群→私聊回声），
      //      封闭群里发生的事一个字都不回流主线。
      // 只有【实时私聊窗口】仍归互通群：封闭群那边有自己的 preJoin（入群前私聊）当这一档，
      // 两者不叠加，否则同一段私聊会进两遍。
      {
        if (typeof primeQueryVec === "function") await primeQueryVec(hist); // 向量记忆预热（失败自动纯关键词）
        // 记忆按在场成员的可见交集分流（v53.61）：全员都知道的进公共段，
        // 只有部分成员知道的（比如 A 私下说了自己受伤、没告诉别人）只落进那几个人各自的私密段。
        const gSplit = splitGroupMemories(memLibRef.current, members.map(c => c.id), hist, { limit: memCfgRef.current.topK || 5 });
        const memLines = members.map(c => {
          const mem = memories[c.id];
          const onlyMine = formatMemLib(gSplit.perChar[String(c.id)] || []);
          const priv = gs.memoryInterop && gs.privateCtxN > 0 ? (chatsRef.current[c.id] || []).filter(m => !m.recalled && !isOocMsg(m) && contextAllowsMessage(m)).slice(-gs.privateCtxN).map(m => "[" + fmtStampAI(m.ts) + "] " + (m.role === "user" ? profile.name || "用户" : c.name) + ": " + m.content + (m.role === "user" && window.TemporalAnchor ? " " + window.TemporalAnchor.anchor(m.content, m.ts) : "")).join("\n") : "";
          // 单人线下（跨情境近况，v50.66）：这个成员最近和用户单独线下相处的片段，带时间戳，让群线上接得上（own-scoped，仍在本人隐私段里）
          const offBeats = gs.memoryInterop && gs.privateCtxN > 0 ? crossRecentFor(c.id, { surfaces: ["offline"] }) : "";
          // 印象卡跟长期记忆同一档：读一律给（封闭群也给），但必须落在这位成员自己那一段里（隐私围栏见上）
          const gz = window.Gaze && !settingsFor(c.id).engineerEyes ? window.Gaze.text(c.id, profile.name || "用户") : "";
          const seg = [mem && "长期记忆：" + mem, gz && gz.trim(), onlyMine && onlyMine.trim() && "记忆库里【只有 " + c.name + " 知道】的事（别的成员并不知情，除非 TA 自己在群里说出来）：\n" + onlyMine.trim(), priv && "最近私聊（带时间，请和群聊记录一起按真实时间先后理解发生顺序）：\n" + priv, offBeats && "最近单人线下（带时间，和上面私聊/群聊一起按真实先后理解）：\n" + offBeats].filter(Boolean).join("\n");
          return seg ? "『" + c.name + "』〔以下只有 " + c.name + " 本人知道，别的成员并不知情〕\n" + seg : "";
        }).filter(Boolean).join("\n\n");
        const groupMem = formatMemLib(gSplit.shared);
        interop = (memLines ? "\n\n【每位成员各自和用户的私下往来 · ⚠️隐私边界铁律】\n下面每一段【只属于标注的那位成员本人】。**一个成员绝不知道、也绝不许提及、暗示或质问另一个成员和用户之间私聊过什么、是什么关系**——除非那位成员【自己在群里主动说了出来】，说出来的话全群才知道。绝不许让谁从这里发现别人和用户的私密关系/对话（比如各自都以为自己是用户的对象，也不该借此撞破彼此）。每个成员只凭『自己那段私聊+记忆』和『群里公开说过的话』行动。\n" + PRIVATE_IS_BACKGROUND_NOT_AMMO + "\n" + memLines : "") + (groupMem ? "\n\n【记忆库·相关条目】\n" + groupMem + "\n⚠️这些是背景、不是照演的剧本：别复刻记忆里的具体事——别每次都做同一道菜／说同一句招牌话／重复同一个动作，生活要有新的具体。" : "");
      }
      const asPrivate = gs.spectate && members.length === 2;
      let dir;
      if (asPrivate) dir = "这是「" + members[0].name + "」和「" + members[1].name + "」之间【他俩自己】的私下对话（不是群聊，他们也不知道有任何外人在旁观）。用户以【旁白】推动场景。让两人自然地你来我往、多轮对话。\n【重要】这是他俩之间的相处——聊他们自己的生活、眼前的事、【彼此之间】的关系，**用户不一定是话题、别默认围着用户转、别一开口就聊用户的事**；除非旁白引到、或他俩本就都认识用户且有理由聊起。若【没有设定他俩之间的明确关系】，就按萍水相逢/刚认识那样试探着来，别凭空当成很熟、有旧情、或都是用户的谁。各自和用户是什么关系是各自的私事（见关系隐私铁律），别互相假设或拆穿。";else if (gs.spectate) dir = "这是一个群聊，成员们并不知道有任何外人在旁观。用户以【旁白】推动剧情。让成员们围绕旁白与彼此的关系自然互动。";else dir = "这是一个群聊，用户「" + (profile.name || "用户") + "」也是群里的一员，正在和大家一起说话。";
      // 一轮的条数随人数放宽：人少几条就够，人多（拉了一堆人）要多聊几个来回、别草草收场
      let nMax = Math.min(14, Math.max(5, members.length * 2));
      // 自发轮：这一轮条数上限 = 剩余总预算（50-已发x，跨轮递减），不超过自然上限
      if (rgOpts.auto && rgOpts.msgBudget) nMax = Math.max(1, Math.min(nMax, rgOpts.msgBudget));
      const nMin = Math.min(Math.min(3, members.length), nMax);
      const common = "\n\n【很重要】角色不是轮流回答用户的话，而是会顺着彼此刚说的话发散、接梗、跑题、互相调侃或反驳，像真实群聊那样你一言我一语。不是每人每轮都要说话，按情境选合适的人发言，一次产出 " + nMin + "~" + nMax + " 条；现在群里在场 " + members.length + " 人，人多就多聊几个来回、让在场的人都有戏，别三两句就收场。\n【对话连贯·别否认自己说过的话】每个成员都要认清【自己在上文里说过什么、提过什么要求】——别把自己说过的话当成别人凭空冒出来的，更别反问『什么X？』装不知道（那是自己说的）；用户或别的成员顺着你上一句接话时，先认账、别打自己脸。";
      const gEmotes = emotesForGroup(group.memberIds);
      const gEmoteHint = gEmotes.length ? "\n【表情包】每个成员各自延续已经形成的聊天习惯：本来爱发的人可以常发或兴头上连发，本来很少发或从不发的人不要因为列表可用、也不要模仿别的成员或历史表情突然开始发；不存在全群统一频率。可用关键词：" + gEmotes.map(e => e.keyword).join(" / ") + "。要发就在该成员那条发言对象里加 emote 字段填一个关键词（与列出的完全一致），否则省略。" : "";
      // 群自拍：只有配了图像API且成员填了外貌/参考照才开放（按需注入，平时零 token）
      const gSelfieMembers = (typeof imgApiReady === "function" && imgApiReady()) ? members.filter(c => (c.appearance || c.refPhoto) && !photoCooldownState(gchat, c.id).cooling) : [];
      // 合照只在【用户传了参考照 且 该成员也传了参考照】时才开放——两张脸都拿真照片喂，绝不一张真一张编
      const gDuoMembers = (profile && profile.refPhoto) ? gSelfieMembers.filter(c => c.refPhoto) : [];
      const gUName = (profile && profile.name) || "用户";
      // 合照要几张脸就得有几张参考照；凑不够两个人就别把 group 这个选项给模型，免得它开空头支票
      const gGroupShotOk = members.filter(c => c && c.refPhoto).length + ((profile && profile.refPhoto) ? 1 : 0) >= 2
        && members.filter(c => c && c.refPhoto).length >= 1;
      // 群里她转给某位成员、还挂着没点的那几笔（v56.88，同单聊）：收不收由那个人自己按人设和情形定
      const gPendingTf = (groupChatsRef.current[groupId] || []).filter(m =>
        m && m.kind === "transfer" && m.dir === "toChar" && m.status === "pending" && m.toId
        && members.some(c => c.id === m.toId));
      const gTfHint = gPendingTf.length
        ? "\n【有转账挂着没点】" + gPendingTf.map(m => {
            const who = (members.find(c => c.id === m.toId) || {}).name || m.toName || "某位成员";
            return "· " + gUName + " 转给「" + who + "」¥" + m.amount + (m.note ? "（附言：" + m.note + "）" : "") + "，还没处理";
          }).join("\n")
          + "\n收不收【由收款那个人自己按人设和此刻情形定，不是默认收】：他缺不缺、跟她什么关系、当着别人的面好不好意思收、是不是正别扭着——都算数。"
          + "\n要表态就在【他自己那条发言对象】里加 \"transferAccept\":true（收下）或 false（退回），并在 text 里说一句他自己的话；这一轮没顾上就省略，卡继续挂着。"
        : "";
      const gSelfieHint = gSelfieMembers.length ? "\n【photo 发照片】这些成员能发真实照片：" + gSelfieMembers.map(c => c.name).join("、") + "。当群里有人让 TA 拍、起哄看照片、或话题聊到 TA 的样子/穿着/在哪时，让 TA 在自己那条发言对象里加 \"photo\" 对象 {\"kind\":\"self｜other" + (gDuoMembers.length ? "｜duo" : "") + (gGroupShotOk ? "｜group" : "") + "\",\"scene\":\"这张照片拍到了什么（在哪、在干嘛、表情、光线氛围；别描写长相——长相已知）\"}。kind：**self**=自己拿手机拍的第一人称自拍；**other**=别人给 TA 拍的照片（第三人称，站/坐/走/回眸、半身全身带环境都行，姿势更多样）；" + (gDuoMembers.length ? "**duo**=TA 和 " + gUName + " 的合照（画面里有两个人，会拿两人的参考照把脸都锁住，TA 清楚另一个是 " + gUName + "）——仅限这几位有参考照的成员可发合照：" + gDuoMembers.map(c => c.name).join("、") + "。" : "") + (gGroupShotOk ? "**group**=【多人合照】画面里是在场几个人一起拍的合影（会把每个人的参考照都拿去锁脸）——群里起哄要合照、大家正好在一处、或话题聊到「我们仨」这种时候用它；一个人在场时不许用。" : "") + "一轮最多一个成员发、别频繁。**极其重要：画面描述只能写进 photo.scene，绝不许在 text 里用『[图片]』『*发来一张自拍*』这类文字假装发图**；text 里就正常说话（比如『喏』『刚拍的』）。不发就别加这个字段。\n" + PHOTO_NO_EXCUSE : "";
      // 记忆互通时：让成员带出没说出口的心声，并给出好感/心情变化
      const thoughtHint = gs.memoryInterop ? "\n【心声与心情】开启了记忆互通：给【本轮真正有情绪波动、或有话没说出口】的成员各加一条 \"thought\"（此刻没说出口的真实心声，一句话；心里怎么称呼别人就用平时那个称呼，别写成「这女人」「那家伙」这类旁观点评腔）——**每条 thought 的第一人称『我』必须就是该对象 name 指定的成员本人，绝不能写成用户或另一成员的视角**；每条都要贴合当下、和这个成员上一条心声不一样，别重复、别原地打转、别套话；没什么内心活动的成员可省略。另可加 \"mood\"（必须填写中文心情词，如「愉快」「烦躁」，不要英文内部标签）、\"affinityDelta\"（整数 -5~5，这次群聊互动让 TA 对用户的好感如何变化，通常小幅、没波动就 0）。【后台状态】每个真正发言的成员都要给 wearing 和 action：wearing 沿用上面的当前穿着，除非时间/地点/剧情明确导致换装；action 是发这句话时正在做的一个简短动作，每次随情境更新、别照抄上一动作。两项只更新共享状态，绝不写进 text 气泡。\n" + MOOD_TURN_RULE : "";
      // 群↔私聊打通（v53.96）：他在群里说「待会私聊跟你说」，那句就该真的到私聊里去，
      // 而不是放空炮。内容在【同一轮】里写好，不额外发起一次调用——零成本。
      // 封闭群（没开记忆互通）是密封空间：记忆不进也不出，也就不许从群里牵一条线到私聊。
      // 和周刊、月度印象、knownBy 那几处守的是同一条规矩（她 2026-08-21 指出这里漏了）。
      const gDmMembers = gs.memoryInterop
        ? members.filter(c => c && !(blocks[c.id] && (blocks[c.id].iBlocked || blocks[c.id].theyBlocked)))
        : [];
      const gDmHint = gDmMembers.length ? "\n【dm 私下说】你可以在公开发言之外，【私下】单独发一句给「" + gUName + "」——它只会出现在你和 TA 的一对一私聊里，群里其他人看不到。\n"
        + "⚠️【默认不用】绝大多数轮次都不该出现 dm。群聊就是群聊，正常在群里说话就行；私聊是【例外】，不是每轮的附加动作。\n"
        + "只有满足下面之一才允许用，其余情况一律不填：\n"
        + "① 你这一轮的 text 里【真的说了】「待会私聊说」「单独跟你讲」「回头发你」这类话——那就用 dm 把承诺的那句发出去，别放空炮；\n"
        + "② 这句话【当着群里其他人的面说不出口】（会拆穿别人、会让谁下不来台、或只属于你和 TA）；\n"
        + "③ TA 在群里明确让你私聊 TA。\n"
        + "【自检】如果这句话在群里公开说也完全没问题，那它就该留在 text 里，不要用 dm。想跟 TA 亲近不是理由——群里也能亲近。\n"
        + "写法：在你那条发言对象里加 \"dm\":[\"第一条\",\"第二条\"]。\n"
        + "⚠️它是【一个数组，一条一个气泡】，和 text 同一个规矩：私聊里没人会把一整段话憋成一条发出去。"
        + "想说的话该断在哪儿就断在哪儿，短的一条几个字也行；通常 1~3 条，真有话要说才更多。**绝不要把整段塞进一条**。\n"
        + "它和 text 是两回事——text 是群里公开说的，dm 是只有 TA 看得到的。一轮最多一个人用，别频繁。" : "";
      const gDmField = gDmMembers.length ? ",\"dm\":[\"（可选·多数轮次不填）私下发给用户的短气泡\",\"可以有第二条\"]" : "";
      const thoughtField = gs.memoryInterop ? ",\"thought\":\"（可选）没说出口的心声\",\"mood\":\"（可选）此刻中文心情词（禁止英文内部标签）\",\"affinityDelta\":\"（可选）整数-5到5\",\"wearing\":\"该成员此刻穿着一句（保持连续；但必须跟场合对得上，在外面不可能还穿着睡衣）\",\"action\":\"该成员发言时正在做的简短动作（每次更新）\"" : "";
      // Ta 眼里:群里发生的事也能改在场成员对用户的长期印象(极低频,同单聊契约)
      const impressionField = window.Gaze ? ",\"impression\":{\"side\":\"me|us\",\"block\":\"me侧:person/soft/like/recent/unread;us侧:what/how/marks/elephant/want\",\"text\":\"整块重写≤80字\"}（可选,仅当这轮真正改变了该成员对用户或他俩关系的长期认知才填,极少发生;第一人称亲笔、锚具体事、在旧认知上小幅演进）" : "";
      // 世界书：按在场成员 + 近期群聊做检索式注入（全局词条 + 绑定到在场任一成员的词条，关键词命中才进）
      const gWorld = loreText(loreRef.current, { charIds: members.map(m => m.id), scope: "chat", text: hist });
      // 群规矩（用户 OOC 立的长期准则，复用 directives[groupId]）→ 注入，让群成员记得并遵守（item 4）
      const gDirs = (directives[groupId] || []).map(d => {
        if (typeof d === "string") return d.trim();
        const txt = String((d && d.text) || "").trim();
        if (!txt) return "";
        // 临时规矩明说还剩几轮：不然它和长期规矩长得一样，模型会把它当永久约定继续执行
        return Number(d && d.turns) > 0 ? txt + "（临时约定，还剩 " + Number(d.turns) + " 轮，到期后自动作废、不再遵守）" : txt;
      }).filter(s => s);
      const gDirHint = gDirs.length ? "\n\n【⚠️群规矩·最高优先级，压过下面的对话惯性】这些是用户之前（场外）跟你们立好、你们已经答应了的约定，每一条【现在就生效】（没标临时的即长期有效）：\n" + gDirs.map((s, i) => (i + 1) + ". " + s).join("\n") + "\n——就算上面的聊天记录里大家还在聊相关话题，也从这一轮起严格照约定来（惯性不是理由）；用户若问「是不是说好了」，大方承认记得并已经在做，绝不许一脸茫然装不知道。" : "";
      // 群聊里有旁白/围观（spectate）等长段描写时也吃八股压制器（线上短对话不需要，但群聊会写到叙事）
      // ONLINE_CHAT_RULE_V2 开头那句「完全代入当前角色」是给单聊写的：群里有好几个人，
      // 「当前角色」没有指代对象，这句话就空转了，真正决定站位的反倒是下面的任务描述。
      // 点名在场的人，让它重新有指代（她 2026-08-25：同一个裴照川，单聊是他，群里是「一个王爷」）。
      const groupOnlineRuntime = ONLINE_CHAT_RULE_V2.replace("word 只包含", "每条 text 只包含")
        .replace("完全代入当前角色，", members.length > 1
          ? "完全代入你正在写的那一位（在场的是 " + members.map(c => c.name).join("、") + "，写谁那一条你就是谁），"
          // 群里只剩一个人时「写谁那一条」是空问句，直接点名，别让模型去解一个没有分支的选择题
          : "完全代入「" + ((members[0] || {}).name || "在场的角色") + "」，")
        + "\n\n" + GROUP_MULTI_BUBBLE;
      const system = ANTI_CLICHE + "\n\n" + WORLDBOOK_RULE + "\n\n" + CHARCARD_RULE + "\n\n" + groupOnlineRuntime + "\n\n" + STOCK_REPLY_BAN + (window.ReplyPacing ? "\n\n" + window.ReplyPacing.reading() : "") + (window.ContentBoundaries ? "\n\n" + window.ContentBoundaries.prompt : "") + "\n\n" + GROUP_IN_CHARACTER + "\n\n" + CONDESCENDING_TONE_BAN + "\n\n" + REGISTER_FOLLOWS_SCENE + "\n\n" + PERSONA_REGISTER_ANCHOR + "\n\n" + dir + common + gTimeHint + gDirHint + gEmoteHint + gSelfieHint + gDmHint + thoughtHint + gBusyHint + gOfflineHint + gBiHint + gTfHint + "\n\n【身份铁律】用户「" + (profile.name || "用户") + "」不是可代写的群成员：绝不生成用户的新台词、动作或心声，也绝不把用户口吻装进成员对象。每个输出对象的 name 是该条唯一作者；text/voice/thought 里的第一人称『我』都只能指这个 name 对应的成员。成员称呼别人时用对方名字或昵称，绝不能用昵称呼唤自己。\n\n【成员】\n" + memberDesc + gGrowthHint + (profile && (profile.name || profile.persona) ? "\n\n【和大家说话的人 · 「" + (profile.name || "用户") + "」的设定】\n" + (profile.persona || "（未填写）") : "") + "\n\n【成员间关系 · ⚠️关系隐私铁律】\n每个成员和用户「" + (profile.name || "用户") + "」是什么关系（恋人/暧昧/朋友…）【只有该成员本人知道】——别的成员并不知道 TA 和用户是不是对象、什么关系，除非那成员【在群里自己说了出来】。绝不许一个成员知道、提及、或据此反应（吃醋/打趣/拆穿）另一个成员和用户的私密关系。成员【彼此之间】的关系（朋友/兄弟/同事/对头等）才是双方都知道、可自然体现的。\n" + relLines + (gWorld ? "\n\n【世界书】\n" + gWorld : "") + interop + preJoin + "\n\n【近期群聊】\n" + hist + gQuoteCatalogText + "\n\n【输出】只输出 JSON 数组，按发言先后顺序。普通发言 {\"name\":\"成员名\",\"text\":\"内容" + gBiTextSpec + "\",\"quoteId\":\"（可选）正式引用旧消息时填写上面目录里的 Q 编号；不引用就省略，禁止只抄原文猜作者\",\"emote\":\"（可选）想发的表情关键词\",\"voice\":\"（可选）填 true 表示这条作为语音消息发（会显示成语音气泡+转文字，偶尔用）\",\"voiceEmo\":\"（可选，voice=true 时）这条语音的真实语气：happy/sad/angry/fearful/disgusted/surprised/neutral 之一，按说话人此刻真实情绪选、别看字面\",\"call\":\"（可选）填 voice 或 video，表示这个成员此刻想跟用户发起语音/视频通话邀请，别频繁\"" + gDmField + thoughtField + impressionField + "}；若某成员说完某句又后悔、想撤回，那条加 \"recall\":true 和 \"recallReason\":\"撤回原因\"（会先显示一秒再变成已撤回，别频繁）；发红包 {\"name\":\"成员名\",\"redpacket\":{\"total\":金额数字,\"count\":份数,\"message\":\"祝福语\"}}。name 必须逐字等于成员名单中的一个名字；用户名字绝不能出现在 name。";
      // 触发用户内容：自上一条角色发言以来我说的话/旁白
      let tail = [];
      for (let i = gchat.length - 1; i >= 0; i--) {
        if (gchat[i].kind === "ooc") continue; // OOC 不算发言，跳过
        if (gchat[i].role === "assistant") break;
        if (gchat[i].role === "user" || gchat[i].role === "narration") tail.unshift(gchat[i]);
      }
      let userContent = tail.length ? tail.map(m => { const quoteLead = m.replyTo ? "【引用 " + (m.replyToSenderName || "作者未知") + "：『" + String(m.replyTo).replace(/\s+/g, " ").slice(0, 120) + "』】" : ""; return m.role === "narration" ? "【旁白】" + m.content : (profile.name || "用户") + quoteLead + ": " + (m.kind === "photo" && m.imageRef ? "【这条附有一张真实照片，请所有在场成员直接看图后自然回应；不要假装看不到，也不要只复述配文】" + (m.desc ? " 配文：" + m.desc : "") : m.content); }).join("\n") : "（请群成员顺着上面的对话自然继续聊）";
      // 让他们自己接着聊时，记录里会连着好几轮没有用户发言。模型读到这个只会得出一个结论：
      // 「她不理我」——于是第二轮开始整群都在演被冷落（她 2026-08-20 报）。
      // 用户没说话不是冷落，是她此刻不在这个话题里；这句必须写死，不然它自己会脑补。
      if (!tail.length) userContent += "\n\n【重要·别演成被冷落】上面的记录里连着几条都没有「" + (profile.name || "用户")
        + "」发言，那只是因为 TA 此刻没在群里说话——【不是】不理你们、不是已读不回、不是在生气、也不是出了什么事。"
        + "这一轮就当 TA 不在场，你们几个自己把话题往下聊：接彼此的梗、说自己的事、互相拌嘴都行。"
        + "**绝不许出现「怎么不说话」「是不是不理我了」「人呢」「@" + (profile.name || "用户") + "」这类冲着 TA 要回应的话，也不许因此闹脾气或反复提起 TA。**"
        + "TA 什么时候插话都可以，到时候再自然接住就是了。";
      // 双语·每轮提醒（v56.77）：gBiHint 在系统里只发一次，这里按人再补一句短的
      {
        const _biTurnNames = typeof bilingualTurnHint === "function"
          ? members.filter(c => !c.npc && (settingsFor(c.id) || {}).bilingual) : [];
        if (_biTurnNames.length) userContent += "\n\n" + _biTurnNames.map(c => bilingualTurnHint(c.name)).join("\n");
      }
      if (rgOpts.auto && Array.isArray(rgOpts.urgeCharIds) && rgOpts.urgeCharIds.length) {
        const urgeNames = members.filter(c => rgOpts.urgeCharIds.includes(c.id)).map(c => c.name);
        if (urgeNames.length) userContent += "\n\n【这轮自然动念】" + urgeNames.join("、") + " 此刻先想在群里说点什么：由 TA 自然先开口，其他人可顺势接话。不要解释这是系统触发，也别把『想念值』说出来。";
      }
      const groupImageDataUrls = [];
      const groupImageRefs = tail.filter(m => m.kind === "photo" && m.imageRef).slice(-2).map(m => m.imageRef);
      for (const ref of groupImageRefs) {
        try {
          if (String(ref).indexOf("data:") === 0) groupImageDataUrls.push(ref);
          else if (String(ref).indexOf("iv_") === 0 && typeof imgVaultFetchBlob === "function" && typeof blobToDataUrl === "function") {
            // 群聊同装吞图案兜底(单11):双路取图+一拍重试,和私聊一致
            let blob = await imgVaultFetchBlob(ref);
            if (!blob) { await new Promise(rs => setTimeout(rs, 450)); blob = await imgVaultFetchBlob(ref); }
            if (blob) groupImageDataUrls.push(await blobToDataUrl(blob));
          }
        } catch (e) {}
      }
      phase = "等模型回复";
      // 思考链（v56.75）：群聊一次调用写完所有人，谁的开关都算数——
      // 在场任一成员开着就要（言秋那条线除外）。挂在这一轮最先冒出来的那条气泡上。
      const _gReasonMeta = {};
      const _gWantReason = members.some(c => {
        const _cs = settingsFor(c.id) || {};
        return !_cs.engineerEyes && !!_cs.showReasoning;
      });
      const raw = await callAI(active, system, [{
        role: "user",
        content: userContent,
        ...(groupImageDataUrls.length ? { imageDataUrls: groupImageDataUrls } : {})
      }], {
        // token 随人数放宽：人多一轮更长，别被 3000 截断（封顶 10000）
        maxTokens: Math.min(10000, 3200 + members.length * 900),
        // 群聊最重（大 prompt + 多人 + 思考型），给足超时别让慢但有效的回复被掐断白扣钱
        timeout: 180000,
        wantReasoning: _gWantReason,
        meta: _gReasonMeta
      });
      if (_gWantReason && !_gReasonMeta.reasoning && typeof reasoningFromBody === "function") {
        const _gFromBody = reasoningFromBody(raw);
        if (_gFromBody) { _gReasonMeta.reasoning = _gFromBody; _gReasonMeta.from = "正文 <thinking>"; }
      }
      // 取一次就消费掉，别每条气泡都挂一份（和单聊那边同一个写法）
      let _gReasonLeft = _gReasonMeta.reasoning
        ? { reasoning: _gReasonMeta.reasoning, reasonMs: _gReasonMeta.ms || 0, reasonModel: _gReasonMeta.model || "", reasonFrom: _gReasonMeta.from || "" }
        : null;
      const _gTakeReason = () => { const r = _gReasonLeft; _gReasonLeft = null; return r || {}; };
      phase = "解析回复";
      // 群聊回复里全是对白，最容易踩「JSON 字符串正文里直接写了换行/裸引号」这两种坏法；
      // 走和主聊天、小剧场同一套加固解析，别再裸 extractJSON。
      let arr = parseJSONLoose(raw);
      // 模型偶尔把数组裹进对象、或者只回一条就直接给个对象。能救就救，别整轮丢掉。
      if (arr && !Array.isArray(arr) && typeof arr === "object") {
        arr = ["items", "messages", "replies", "list"].map(k => arr[k]).find(Array.isArray)
          || (arr.name && (arr.text || arr.redpacket || arr.emote) ? [arr] : null);
      }
      // 以前这里没有 else：解析不出来就【什么都不发生】——她只会看到点了没反应，
      // 连一条失败提示都没有。现在明确报出来，并带上模型到底回了什么。
      if (!Array.isArray(arr)) {
        const t = String(raw || "").replace(/\s+/g, " ").trim();
        throw new Error("模型没按 JSON 数组输出" + (t ? "（它回的是：" + t.slice(0, 200) + (t.length > 200 ? "…" : "") + "）" : "（上游什么都没回）"));
      }
      {
        const guarded = window.GroupIdentityGuard ? window.GroupIdentityGuard.sanitize(arr, members, profile.name || "用户") : { items: arr, dropped: [], thoughtsDropped: [] };
        const safeArr = guarded.items;
        if (rgOpts.auto) addAutoChatMessages(groupId, safeArr.length); // 自发累计条数（持久额度卡，跨重开仍有效）
        if ((guarded.dropped || []).length || (guarded.thoughtsDropped || []).length) toast("拦住了 " + ((guarded.dropped || []).length + (guarded.thoughtsDropped || []).length) + " 条群聊身份串线");
        phase = "落地发言";
        tickDirectives(groupId); // 临时规矩每回一轮少一轮，到 0 自动消失
        const _gspoke = new Set(); // 群聊(含旁观模式，同一路径)也给开口成员计动态保底（她 2026-07-13 点名）
        // 回声判定的比对文本：先装她这一整轮，然后随着本批成员依次开口往后累加
        let _gSaidRun = typeof lastUserTurnText === "function" ? lastUserTurnText(groupChatsRef.current[groupId] || []) : "";
        for (let i = 0; i < safeArr.length; i++) {
          const item = safeArr[i];
          const spk = members.find(c => c.name === item.name);
          if (!spk) continue;
          // 打字体标点兜底（v54.81）：在这儿削一次，后面 text／语音／撤回几路共用同一份
          if (item.text && typeof stripTypingPeriod === "function" && !settingsFor(spk.id).engineerEyes) item.text = stripTypingPeriod(item.text);
          // 回声式反问兜底（v55.85）：群聊这条一直没接刀，她 2026-08-24 抓到——
          // 顾朝提了「飞爪绳梯」，裴照川下一条就「飞爪绳梯？」。
          // 群里回声的来源可能是【别的成员】，所以比对的是「她这一整轮 ＋ 本批里比他先开口的人说过的话」。
          if (item.text && typeof echoOpening === "function" && !settingsFor(spk.id).engineerEyes) {
            const r = echoOpening(item.text, _gSaidRun);
            if (r) item.text = r;                       // 合并型：只削开头那一声
            else if (r === null) {
              // 整条就是回声。只有这个人在本批里【后面还有别的话】才敢丢，
              // 否则他这一轮就等于没开口。
              const hasMore = safeArr.slice(i + 1).some(x => x && x.name === item.name && String(x.text || "").trim());
              if (hasMore) continue;
            }
          }
          // 他对挂着那笔转账的表态（v56.88）：只结算转给他本人的那一笔
          if (spk && (item.transferAccept === true || item.transferAccept === false)) {
            const _mine = gPendingTf.find(x => x.toId === spk.id && x.status === "pending");
            if (_mine) respondGroupTransfer(groupId, _mine.tid, item.transferAccept === true);
          }
          if (item.text) _gSaidRun += " " + item.text;   // 后面的人要能看见他刚说的
          const gTurnId = "gt_" + Date.now() + "_" + i;
          const affinityBefore = spk ? affOf(spk.id) : null;
          if (spk) _gspoke.add(spk.id);
          if (i > 0) await new Promise(r => setTimeout(r, 780));
          if (item.redpacket && Number(item.redpacket.total) > 0) {
            const rp = item.redpacket;
            postRedPacket(groupId, spk, Number(rp.total), Math.max(1, Math.round(Number(rp.count) || 1)), rp.message || "恭喜发财，大吉大利");
          } else if (item.recall === true && item.text) {
            const mid = "grc_" + Date.now() + "_" + i;
            pGChat(groupId, p => [...p, { role: "assistant", senderId: spk.id, senderName: spk.name, content: item.text, mid, ts: Date.now(), turnId: gTurnId }]);
            setTimeout(() => pGChat(groupId, p => p.map(m => m.mid === mid ? { ...m, recalled: true, origText: item.text, reason: item.recallReason || "" } : m)), 1100);
          } else if (item.voice === true && item.text) {
            const vt = String(item.text);
            const gEmo = item.voiceEmo && ["happy","sad","angry","fearful","disgusted","surprised","neutral"].includes(String(item.voiceEmo)) ? String(item.voiceEmo) : undefined;
            const q = window.GroupQuote ? window.GroupQuote.resolve(item, gQuoteCatalog) : { replyTo: item.quote || null };
            pGChat(groupId, p => [...p, { role: "assistant", senderId: spk.id, senderName: spk.name, kind: "voice", content: vt, emo: gEmo, dur: Math.max(1, Math.min(60, Math.round(vt.replace(/\s/g, "").length / 3))), ...q, mid: "gvm_" + Date.now() + "_" + i, ts: Date.now(), turnId: gTurnId }]);
          } else {
            // 按换行把一坨拆成多条气泡（首条带引用），避免整段挤在一个气泡里
            const rawLines = window.GroupIdentityGuard ? window.GroupIdentityGuard.splitBubbles(item.text) : String(item.text || "").split(/\n+/);
            // 模型不打换行时 splitBubbles 等于没拆，所以再过一道和单聊同一个的长气泡兜底
            const gAllowComma = !(settingsFor(spk.id) || {}).engineerEyes;
            // 双语：和单聊同一条路——先把「原文 | 中文」劈开再拆泡，中译挂在最后一泡上
            const gBiOn = !!(settingsFor(spk.id) || {}).bilingual;
            const gBiZh = new Map();
            const gLines = rawLines.map(x => x.trim()).filter(Boolean).map(stripAiStamp).filter(Boolean)
              .reduce((acc, x) => {
                const bi = gBiOn ? splitBilingual(x) : null;
                const parts = splitLongBubble(bi ? bi.text : x, gAllowComma);
                if (bi && parts.length) gBiZh.set(bilingualKey(parts[parts.length - 1]), bi.zh);
                return acc.concat(parts);
              }, []);
            const gBubbles = gLines.length ? gLines : [stripAiStamp(item.text || "")].filter(Boolean);
            // 记忆互通时把心声挂在末条气泡上显示
            const gThought = gs.memoryInterop && item.thought && String(item.thought).toLowerCase() !== "null" ? String(item.thought).trim() : null;
            const gResolvedQuote = window.GroupQuote ? window.GroupQuote.resolve(item, gQuoteCatalog) : { replyTo: item.quote || null };
            for (let j = 0; j < gBubbles.length; j++) {
              if (j > 0) await new Promise(r => setTimeout(r, 620));
              const reveal = () => pGChat(groupId, p => [...p, {
                role: "assistant",
                senderId: spk.id,
                senderName: spk.name,
                content: gBubbles[j],
                ...(gBiZh.get(bilingualKey(gBubbles[j])) ? { zh: gBiZh.get(bilingualKey(gBubbles[j])) } : {}),
                ..._gTakeReason(),
                ...(j === 0 ? gResolvedQuote : { replyTo: null }),
                thought: j === gBubbles.length - 1 ? gThought : null,
                mid: "gm_" + Date.now() + "_" + i + "_" + j,
                ts: Date.now(),
                turnId: gTurnId
              }]);
              // iOS/React 可能把短间隔内的 functional updates 合并到同一帧；逐泡强制提交，才真是一条条冒出来。
              if (ReactDOM && typeof ReactDOM.flushSync === "function") ReactDOM.flushSync(reveal); else reveal();
            }
          }
          // 群照片：该成员这条发言带了 photo 对象（或旧版 selfie 字符串）→ 挂占位气泡 + 异步生成（复用私聊那套）
          let gPhotoKind = null, gPhotoScene = null;
          if (item.photo && typeof item.photo === "object") {
            gPhotoScene = String(item.photo.scene || item.photo.desc || "").trim();
            gPhotoKind = ["self", "other", "duo", "group"].includes(String(item.photo.kind || "").toLowerCase()) ? String(item.photo.kind).toLowerCase() : "self";
          } else if (item.selfie && String(item.selfie).toLowerCase() !== "null") {
            gPhotoScene = String(item.selfie).trim(); gPhotoKind = "self";
          }
          // 群聊也按成员分别冷却；别让另一个成员发过图误伤 TA，也别让 TA 绕过能力提示偷发。
          if (photoCooldownState(gchat, spk.id).cooling) { gPhotoKind = null; gPhotoScene = null; }
          // 合照必须两张参考照都在（用户 + 该成员），否则降级为「别人拍的单人照」
          if (gPhotoKind === "duo" && !(spk.refPhoto && profile && profile.refPhoto)) gPhotoKind = "other";
          // 群合照（v53.85）：点名单＝在场【有参考照】的成员 + 用户，拍照的那位排第一。
          // 顺序就是参考图顺序，两边必须一一对齐——错位了脸就串（duo 当初的老毛病）。
          // 上限 4 人：再多脸就开始糊，也更容易被上游审核拦。
          let gCast = null;
          if (gPhotoKind === "group") {
            const withRef = [spk].concat(members.filter(c => c.id !== spk.id))
              .filter(c => c && c.refPhoto);
            const roster = withRef.slice(0, profile && profile.refPhoto ? 3 : 4).map(c => ({
              id: c.id, name: c.name, appearance: c.appearance, refPhoto: c.refPhoto
            }));
            if (profile && profile.refPhoto) roster.push({
              id: "__me", name: (profile.name || "我"), appearance: profile.appearance, refPhoto: profile.refPhoto
            });
            // 凑不齐两个人就不是合照，退回该成员自己的单人照
            if (roster.length >= 2) gCast = roster; else gPhotoKind = "other";
          }
          if (gPhotoScene && gPhotoKind && typeof imgApiReady === "function" && imgApiReady() && (spk.appearance || spk.refPhoto)) {
            const gsid = "gsf_" + Date.now() + "_" + i;
            await new Promise(r => setTimeout(r, 420));
            pGChat(groupId, p => [...p, { role: "assistant", senderId: spk.id, senderName: spk.name, kind: "selfie", sid: gsid, imgKey: null, pending: true, desc: gPhotoScene, photoKind: gPhotoKind, ts: Date.now(), turnId: gTurnId }]);
            (async () => {
              try {
                const st = states[spk.id] || {};
                const me = { name: (profile && profile.name) || "对方", appearance: profile && profile.appearance, refPhoto: profile && profile.refPhoto };
                const refs = gCast ? gCast.map(x => x.refPhoto)
                  : gPhotoKind === "duo" ? [spk.refPhoto, profile && profile.refPhoto].filter(Boolean)
                  : [spk.refPhoto].filter(Boolean);
                const gPhotoOpts = gCast ? { kind: "duo", me, cast: gCast } : { kind: gPhotoKind, me };
                const prompt = buildPhotoPrompt(spk, gPhotoScene, st, gPhotoOpts);
                const gMinimal = buildMinimalPhotoPrompt(spk, gCast ? { kind: "duo", cast: gCast } : { kind: gPhotoKind });
                const out = await generateSelfieImage(prompt, refs.length ? refs : null, { minimalPrompt: gMinimal });
                if (out.blob) {
                  const key = "img_" + spk.id + "_" + gsid;
                  await idbImgPut(key, out.blob);
                  const back = await idbImgGet(key).catch(() => null);
                  if (!back || !back.size) throw new Error("图生成好了，但没能存进本机图库（iOS 存储偶发抽风，让 TA 重拍一张多半就好）");
                  pGChat(groupId, p => p.map(m => m.sid === gsid ? { ...m, pending: false, imgKey: key } : m));
                } else if (out.url) {
                  pGChat(groupId, p => p.map(m => m.sid === gsid ? { ...m, pending: false, imgUrl: out.url } : m));
                } else { throw new Error("没拿到图"); }
              } catch (e) {
                pGChat(groupId, p => p.map(m => m.sid === gsid ? { ...m, pending: false, failed: true } : m));
                toast("自拍没生成：" + (e.message || "重试"));
              }
            })();
          }
          // 记忆互通：这次发言影响该成员对用户的实时好感与心情，并把心声写进【和私聊同一套】的实时状态里（双向影响、可变化）
          if (gs.memoryInterop) {
            const moodLabel = item.mood && String(item.mood).toLowerCase() !== "null" ? String(item.mood).trim() : null;
            const aDelta = typeof item.affinityDelta === "number" ? item.affinityDelta : Number(item.affinityDelta);
            const gWear = item.wearing && String(item.wearing).toLowerCase() !== "null" ? String(item.wearing).trim() : null;
            const rawGAction = item.action && String(item.action).toLowerCase() !== "null" ? String(item.action).trim() : null;
            const gAction = rawGAction && window.ThoughtVoiceGuard ? window.ThoughtVoiceGuard.normalizeAction(rawGAction, spk && spk.name) : rawGAction;
            // NPC 没有心情、也没有好感度（她 2026-08-25 拍板）：模型照样填了就丢掉
            if (spk && !spk.npc && !isNaN(aDelta)) bumpAff(spk.id, aDelta || 0, moodLabel);
            if (spk && !spk.npc && moodLabel) setMoodFor(spk.id, { label: moodLabel, ts: Date.now() });
            // 心声 → 共享 states[spk.id]（就是私聊心声卡读的那套）；有 thought 才进历史
            const rawGThink = item.thought && String(item.thought).toLowerCase() !== "null" ? String(item.thought).trim() : null;
            const gThink = rawGThink && window.ThoughtVoiceGuard ? window.ThoughtVoiceGuard.accept(rawGThink) : rawGThink;
            if (spk && !spk.npc && item.impression && window.Gaze && !settingsFor(spk.id).engineerEyes) { try { window.Gaze.applyParsed(spk.id, item.impression); } catch (e) {} }
            if (spk && (gThink || moodLabel || gWear || gAction)) {
              const liveState = statesRef.current[spk.id] || {};
              const stateNow = Date.now();
              const ns = { ...liveState, ...(gThink ? { thought: gThink, thoughtUpdatedAt: stateNow, thoughtSkips: 0 } : {}), ...(gWear ? { wearing: gWear, wearingUpdatedAt: stateNow } : {}), ...(gAction ? { action: gAction, actionUpdatedAt: stateNow } : {}), mood: moodLabel || liveState.mood, ts: stateNow, turnId: gTurnId, affinityBefore };
              setStateFor(spk.id, ns);
              pushStateHist(spk.id, ns);
            }
          }
          // dm 落地（v53.96）：群里承诺的「私聊说」真的进私聊，而不是停在嘴上。
          // 走和普通私聊消息完全一样的形状，所以未读红点、消息列表预览、记忆提取全都照常吃到。
          // dm 落地：和单聊一样【一条一个气泡】逐条发（v54.31）。
          // 以前不管多长都塞进一条，私聊里就出现一大坨——没人这么发消息。
          // 兼容旧写法：模型仍给字符串时，按换行/句末切一下，别退回一整段。
          const gDmRaw = item.dm;
          let gDmList = Array.isArray(gDmRaw) ? gDmRaw : [];
          if (!gDmList.length && gDmRaw && String(gDmRaw).toLowerCase() !== "null") {
            gDmList = String(gDmRaw).split(/\n+/).flatMap(x => x.length > 40 ? x.split(/(?<=[。！？…~～])/) : [x]);
          }
          gDmList = gDmList.map(x => String(x == null ? "" : x).trim()).filter(Boolean).slice(0, 6);
          // 冷却闸（v54.32）：提示词说了「默认不用」它照样每轮都来，所以再加一道代码闸——
          // 同一个人 30 分钟内已经从群里私聊过一次，这一轮就不投递了。
          // 她 2026-08-21 报：一发群聊顾朝就私聊。
          const gDmCooling = (() => {
            if (!spk) return true;
            const arr = chatsRef.current[spk.id] || [];
            for (let k = arr.length - 1; k >= 0 && k >= arr.length - 40; k--) {
              const m = arr[k];
              if (m && m.fromGroup && Date.now() - Number(m.ts || 0) < 30 * 60000) return true;
            }
            return false;
          })();
          if (gDmList.length && gDmCooling) gDmList = [];
          if (gDmList.length && spk && !(blocksRef.current[spk.id] && (blocksRef.current[spk.id].iBlocked || blocksRef.current[spk.id].theyBlocked))) {
            const dmTurn = "gdm_" + Date.now();
            for (let di = 0; di < gDmList.length; di++) {
              await new Promise(r => setTimeout(r, di === 0 ? 500 : 420)); // 节奏同单聊
              pChat(spk.id, p => [...p, { role: "assistant", content: gDmList[di], ts: Date.now(), read: false, fromGroup: groupId, turnId: dmTurn }]);
            }
          }
          // 成员主动发起通话邀请
          const gcm = item.call && ["voice", "video"].includes(String(item.call).toLowerCase()) ? String(item.call).toLowerCase() : null;
          if (gcm) {
            await new Promise(r => setTimeout(r, 300));
            pGChat(groupId, p => [...p, { role: "assistant", senderId: spk.id, senderName: spk.name, kind: "callinvite", mode: gcm, content: "[" + (gcm === "video" ? "视频" : "语音") + "通话邀请]", ts: Date.now(), turnId: gTurnId }]);
          }
          // 成员甩表情：按关键词匹配 TA 可用的表情
          const ekw = item.emote && String(item.emote).toLowerCase() !== "null" ? String(item.emote).trim() : null;
          if (ekw) {
            const av = emotesForChar(spk.id);
            const mt = emoteMatch(av, ekw);
            if (mt) {
              await new Promise(r => setTimeout(r, 300));
              pGChat(groupId, p => [...p, { role: "assistant", senderId: spk.id, senderName: spk.name, kind: "emote", url: mt.url, keyword: mt.keyword, content: "[表情] " + mt.keyword, ts: Date.now(), turnId: gTurnId }]);
            }
          }
        }
        // 封闭群（没开记忆互通）是密封空间：记忆不进也不出，那就更不该驱动
        // 朋友圈/论坛/悄悄话这些【对外】的东西——动态素材本来就把群聊混在一起取，
        // 攒够 30 轮强制发一条，等于把闭群里的事发到朋友圈上（她 2026-08-24 抓到）。
        if (!groupClosed(groupId)) _gspoke.forEach(id => tickAmbient(id, {}));
      }
    } catch (e) {
      // DOMException 之类的报错只给一句没头没尾的话（比如 iOS 上那句 "The string did not
      // match the expected pattern."），光看文案根本不知道是哪一步、哪个 API 抛的。
      // 把【错误类型】和【当时走到哪一步】一起带出来，下次一眼能定位。
      const kind = e && e.name && e.name !== "Error" ? "[" + e.name + "] " : "";
      pGChat(groupId, p => [...p, {
        role: "assistant",
        senderName: "系统",
        contextExcluded: true,
        systemFailure: true,
        content: "（群聊生成失败·" + phase + "：" + kind + (e && e.message || "未知错误") + "）",
        ts: Date.now()
      }]);
    } finally {
      endLane("g:" + groupId);
      maybeSummarizeGroup(groupId);
      setTimeout(() => maybeAutoExtractGroup(groupId), 260);   // 和另外三处对齐：每几轮抽一次离散记忆
    }
  };
  // 群聊 OOC：跳出所有角色直接问模型；不进角色扮演上下文
  const oocGroup = async (groupId, text) => {
    if (laneBusy("g:" + groupId) || !text || !text.trim()) return;
    const group = groups.find(g => g.id === groupId);
    if (!group) return;
    pGChat(groupId, p => [...p, { role: "user", kind: "ooc", content: text.trim(), ts: Date.now() }]);
    if (!active) { toast("请先到设置配置 API"); return; }
    startLane("g:" + groupId);
    try {
      const members = (group.memberIds || []).map(id => characters.find(c => c.id === id)).filter(Boolean);
      const histText = (groupChatsRef.current[groupId] || []).filter(m => m.kind !== "ooc" && m.content && contextAllowsMessage(m)).slice(-20).map(m => m.role === "narration" ? "【旁白】" + m.content : (m.role === "user" ? profile.name || "用户" : m.senderName || "某人") + "：" + m.content).join("\n");
      // 世界书走和正戏同一个筛选引擎（v48.20，理由同群线下 OOC 处注释）
      const oocLore = loreText(loreRef.current, { charIds: members.map(c => c.id), scope: "chat", text: histText });
      const res = await oocAskGroup(active, { members, profile, rels, chars: characters, worldbook: oocLore, historyText: histText, directives: directives[groupId] || [] }, text.trim());
      if (res.directive && !res.refused) addDirective(groupId, res.directive); // 群准则复用 directives[groupId]，注入 replyGroup
      pGChat(groupId, p => [...p, { role: "assistant", kind: "ooc", content: res.reply + (res.directive && !res.refused ? "\n\n〔已记为群规矩：" + res.directive + "〕" : "") + (res.refused ? "\n\n〔这条我没照做——会破坏群里某位的人设〕" : ""), ts: Date.now() }]);
    } catch (e) {
      toast("OOC 失败：" + (e.message || "重试"));
    } finally {
      endLane("g:" + groupId);
    }
  };
  // 群聊消息长按操作：复制/收藏/编辑/撤回/重Roll（引用、多选在组件内处理）
  const handleGroupMsgAction = (groupId, act, idx) => {
    const msgs = groupChatsRef.current[groupId] || [];
    const m = msgs[idx];
    if (!m) return;
    if (act === "fav") { addFavorite(m.senderId || null, m); return; }
    if (act === "copy") {
      navigator.clipboard && navigator.clipboard.writeText(m.content || "");
      toast("已复制");
    } else if (act === "recall") {
      pGChat(groupId, p => p.map((x, i) => i === idx ? { ...x, recalled: true, origText: x.content, reason: x.reason || "" } : x));
    } else if (act === "edit") {
      setEditMsg({ content: m.content || "", onSave: nv => pGChat(groupId, p => p.map((x, i) => i === idx ? { ...x, content: nv } : x)) });
    } else if (act === "reroll") {
      if (m.role !== "assistant") { toast("只能重Roll成员的消息"); return; }
      // 新版同一成员拆泡共享 turnId：从这一组的首泡起删，避免半条旧回答残留。
      let start = idx;
      if (m.turnId) while (start > 0 && msgs[start - 1] && msgs[start - 1].turnId === m.turnId) start--;
      const removed = msgs.slice(start), group = groups.find(g => g.id === groupId);
      const y = ledgerYanqiu(); if (group && y && (group.memberIds || []).includes(y.id) && window.ChatLedgerShadow) window.ChatLedgerShadow.invalidate({ charId: y.id, threadType: "group", threadId: groupId, groupMemberIds: group.memberIds || [], groupName: group.name || "" }, removed);
      const byChar = new Map();
      removed.filter(x => x && x.senderId).forEach(x => { const rec = byChar.get(x.senderId) || { turns: [], legacyThoughts: [] }; if (x.turnId) rec.turns.push(x.turnId); if (!x.turnId && x.thought) rec.legacyThoughts.push(x.thought); byChar.set(x.senderId, rec); });
      byChar.forEach((rec, charId) => rollbackCharTurns(charId, rec.turns, !rec.turns.length && !!(statesRef.current[charId] && rec.legacyThoughts.includes(statesRef.current[charId].thought))));
      pGChat(groupId,p=>{const next=p.slice(0,start);try{window.MessageBranchShadow&&window.MessageBranchShadow.observeMutation({kind:"reroll",surface:"group",charId:"g_"+groupId,before:p,after:next,targetIndex:start,turnId:m.turnId});}catch(e){}return next;});
      setTimeout(() => replyGroup(groupId), 200);
    }
  };
  const deleteGroupMsgs = (groupId, indices) => {
    const set = new Set(indices);
    pGChat(groupId, p => p.filter((_, i) => !set.has(i)));
  };
  // ---- 群投票 ----
  const startPoll = (groupId, title, options, anon) => {
    const by = gsFor(groupId).spectate ? "旁白" : profile.name || "我";
    pushGroupRich(groupId, {
      role: "user",
      kind: "poll",
      pollId: "pl_" + Date.now(),
      title: title,
      anon: !!anon,
      by: by,
      options: options.map(o => ({
        text: o,
        voters: []
      })),
      content: "[投票] " + title
    });
    toast("投票已发起");
    // 发起后角色陆陆续续自动投票（无需手动按）
    setTimeout(() => {
      const gc = groupChatsRef.current[groupId] || [];
      const idx = gc.map((m, i) => m.kind === "poll" ? i : -1).filter(i => i >= 0).pop();
      if (idx != null && idx >= 0) genPollVotes(groupId, idx);
    }, 900);
  };
  const castVote = (groupId, msgIdx, optIdx, voter) => {
    pGChat(groupId, p => p.map((m, i) => {
      if (i !== msgIdx || m.kind !== "poll") return m;
      const options = m.options.map((o, oi) => ({
        ...o,
        voters: o.voters.filter(v => v !== voter).concat(oi === optIdx ? [voter] : [])
      }));
      return {
        ...m,
        options
      };
    }));
  };
  // 角色陆续投票 + 可能的评论/cue（后台进行，不锁输入）
  const genPollVotes = async (groupId, msgIdx) => {
    if (!active) return;
    const group = groups.find(g => g.id === groupId);
    const members = group.memberIds.map(id => characters.find(c => c.id === id)).filter(Boolean);
    const poll = (groupChatsRef.current[groupId] || [])[msgIdx];
    if (!poll || poll.kind !== "poll") return;
    try {
      const memberDesc = members.map(c => {
        const md = moods[c.id] && moods[c.id].label ? "，此刻心情：" + moods[c.id].label : "";
        const af = "，对用户好感 " + Math.round(affOf(c.id)) + "/100";
        return "【" + c.name + "】" + groupPersonaText(c.persona, groupPersonaBudget(members.length)) + md + af;
      }).join("\n");
      const gsp = gsFor(groupId);
      const hist = (groupChatsRef.current[groupId] || []).filter(m => m.kind !== "ooc" && m.kind !== "system" && contextAllowsMessage(m)).slice(-16).map(m => (m.role === "narration" ? "【旁白】" + m.content : (m.role === "user" ? profile.name || "用户" : m.senderName || "某人") + ": " + (m.content || ""))).join("\n");
      const system = "群里发起了投票：「" + poll.title + "」。选项：" + poll.options.map((o, i) => i + ". " + o.text).join("；") + "。\n**每个成员投什么，必须由 TA 的人设、价值观、当前所处的上下文、此刻心情、跟发起人/其他成员的关系来决定——绝对不要随机乱投、也不要为了均衡而分散**。有的成员会按性格明显偏向某个选项，有的会犹豫、跟风、或按人设弃权（choice 填 -1，比如不感兴趣、故意不掺和、闹别扭）。**say（顺口说的那句话）必须和 TA 投的 choice 一致**（别嘴上说 A 却投 B）；不是每个人都要 say。如果有人弃权，别的成员可能会 cue 他「你怎么不投」。\n【成员（含此刻心情与好感，据此判断投向）】\n" + memberDesc + (hist ? "\n【近期群聊上下文（投票就发生在这些对话之后，投向要贴合语境）】\n" + hist : "") + "\n【输出】只输出 JSON 数组，按发生先后：[{\"name\":\"成员名\",\"choice\":选项序号(0起，弃权 -1),\"say\":\"（可选）和 choice 一致的一句话\"}]";
      const raw = await callAI(active, system, [{
        role: "user",
        content: "开始投票，按上面的规则决定每个人投什么。"
      }], {
        maxTokens: 800
      });
      const arr = extractJSON(raw);
      if (!Array.isArray(arr)) return;
      // 陆陆续续：每个动作间隔一会儿
      for (const v of arr) {
        const spk = members.find(c => c.name === v.name);
        if (!spk) continue;
        await new Promise(r => setTimeout(r, 600 + Math.random() * 700));
        if (typeof v.choice === "number" && v.choice >= 0 && v.choice < poll.options.length) castVote(groupId, msgIdx, v.choice, spk.name);
        if (v.say && String(v.say).trim()) pGChat(groupId, p => [...p, {
          role: "assistant",
          senderId: spk.id,
          senderName: spk.name,
          content: String(v.say).trim(),
          ts: Date.now()
        }]);
      }
    } catch (e) {/* 静默 */}
  };
  // ---- 群红包 ----
  // 我发红包
  // 记忆不互通的群=封闭空间：红包/转账都是过家家，不动任何真钱包（我的 + 角色的都不结算）
  const groupClosed = gid => !gsFor(gid).memoryInterop;
  const sendRedPacket = (groupId, total, count, message) => {
    const a = Math.round(Number(total) * 100) / 100;
    if (a <= 0) return;
    const closed = groupClosed(groupId);
    if (!closed) {
      if (wallet < a) { toast("余额不足"); return; }
      changeWallet(-a, "发红包", "redpacket");
    }
    const splits = splitRedPacket(a, count);
    const rpId = "rp_" + Date.now();
    pushGroupRich(groupId, {
      kind: "redpacket",
      rpId: rpId,
      byMe: true,
      by: profile.name || "我",
      total: a,
      count: splits.length,
      message: message || "恭喜发财，大吉大利",
      splits: splits,
      claims: [],
      content: "[红包] " + (message || "恭喜发财，大吉大利")
    });
    toast("红包已发出 ¥" + a);
    // 群成员随机来抢
    setTimeout(() => autoGrabRedPacket(groupId, rpId), 1200);
  };
  const postClaimLine = (groupId, claimer, owner) => pushGroupRich(groupId, {
    role: "system",
    content: claimer + " 领取了 " + owner + " 的红包"
  });
  // 角色发红包（AI 触发）：钱在被领取时才结算
  const postRedPacket = (groupId, char, total, count, message) => {
    const a = Math.round(Number(total) * 100) / 100;
    if (a <= 0) return;
    if (!groupClosed(groupId)) adjustCharBalance(char.id, -a, "发红包", "redpacket");
    const splits = splitRedPacket(a, count);
    const rpId = "rp_" + Date.now() + "_" + char.id;
    pushGroupRich(groupId, {
      kind: "redpacket",
      rpId: rpId,
      byMe: false,
      by: char.name,
      senderId: char.id,
      total: a,
      count: splits.length,
      message: message || "恭喜发财，大吉大利",
      splits: splits,
      claims: [],
      content: "[红包] " + (message || "恭喜发财，大吉大利")
    });
    // 其他成员（除发红包者）也会来抢
    setTimeout(() => autoGrabRedPacket(groupId, rpId), 1400);
  };
  // 我领红包（我发的不能领；角色发的可以领）
  const claimRedPacket = (groupId, msgIdx) => {
    const meName = profile.name || "我";
    const rp = (groupChatsRef.current[groupId] || [])[msgIdx];
    if (!rp || rp.kind !== "redpacket") return null;
    if (rp.byMe) return "own";
    if (rp.claims.some(c => c.me)) return "claimed";
    if (rp.claims.length >= rp.count) return "empty";
    const amt = rp.splits[rp.claims.length];
    if (!groupClosed(groupId)) changeWallet(amt, "抢到 " + (rp.by || "某人") + " 的红包", "redpacket");
    pGChat(groupId, p => p.map((m, i) => i === msgIdx ? {
      ...m,
      claims: [...m.claims, {
        name: meName,
        me: true,
        amount: amt,
        ts: Date.now()
      }]
    } : m));
    postClaimLine(groupId, meName, rp.by);
    return amt;
  };
  // 群成员随机抢某个红包（按 rpId 定位；排除发红包者本人）
  const autoGrabRedPacket = (groupId, rpId) => {
    const gchat = groupChatsRef.current[groupId] || [];
    const idx = gchat.map((m, i) => m.kind === "redpacket" && m.rpId === rpId ? i : -1).filter(i => i >= 0).pop();
    if (idx == null || idx < 0) return;
    const rp = gchat[idx];
    const group = groups.find(g => g.id === groupId);
    const members = (group.memberIds || []).map(id => characters.find(c => c.id === id)).filter(Boolean).filter(c => c.id !== rp.senderId);
    const grabbers = members.filter(() => Math.random() < 0.7).slice(0, rp.count - rp.claims.length);
    let claims = [...rp.claims];
    const closed = groupClosed(groupId);
    grabbers.forEach(c => {
      if (claims.length >= rp.count) return;
      const amt = rp.splits[claims.length];
      if (!closed) adjustCharBalance(c.id, amt, "抢到红包", "redpacket");
      claims.push({
        name: c.name,
        id: c.id,
        amount: amt,
        ts: Date.now()
      });
    });
    pGChat(groupId, p => p.map((m, i) => i === idx ? {
      ...m,
      claims
    } : m));
    grabbers.forEach(c => postClaimLine(groupId, c.name, rp.by));
  };
  // ---- 群聊总结存入记忆库（关联所有成员）----
  const summarizeGroupToMem = async groupId => {
    const group = groups.find(g => g.id === groupId);
    if (!active) {
      toast("请先配置 API");
      return;
    }
    const msgs = (groupChatsRef.current[groupId] || []).filter(m => m.content && !isOocMsg(m) && contextAllowsMessage(m)).slice(-40);
    if (msgs.length < 2) {
      toast("群聊太少");
      return;
    }
    startLane("g:" + groupId);
    try {
      const summary = await summarizeGroup(active, {
        profile
      }, msgs);
      if (summary && summary.trim()) {
        addMemEntry({
          text: "【群「" + group.name + "」】" + summary.trim(),
          tags: gTags(group),
          // 归属只给真角色（配角没有自己的记忆库），在场的都算知道
          charIds: memOwners(group.memberIds), knownBy: group.memberIds.slice(),
          source: "auto", groupId: group.id
        });
        toast("已存入记忆库");
      }
    } catch (e) {
      toast("总结失败：" + e.message);
    } finally {
      endLane("g:" + groupId);
    }
  };
  const createGroup = (name, memberIds, spectate) => {
    const g = {
      id: "g_" + Date.now(),
      name,
      memberIds,
      createdTs: Date.now()
    };
    setGroups(p => {
      const n = [...p, g];
      saveJSON("x_groups", n);
      return n;
    });
    if (spectate) saveGroupSettings(g.id, {
      spectate: true
    });
    setNewGroupOpen(false);
    toast(spectate ? "旁观群聊已创建" : "群聊已创建");
  };
  const updateGroup = (groupId, patch) => setGroups(p => {
    const n = p.map(g => g.id === groupId ? { ...g, ...patch } : g);
    saveJSON("x_groups", n);
    return n;
  });
  const deleteGroup = groupId => {
    setGroups(p => { const n = p.filter(g => g.id !== groupId); saveJSON("x_groups", n); return n; });
    setGroupChats(p => { const n = { ...p }; delete n[groupId]; return n; });
    localStorage.removeItem("x_gchat:" + groupId);
    setGroupSettings(p => { const n = { ...p }; delete n[groupId]; saveJSON("x_groupSettings", n); return n; });
    setActiveGroup(null);
    setScreen("messages");
    toast("群聊已删除");
  };
  const groupSysLine = (groupId, text) => pGChat(groupId, p => [...p, { role: "system", content: text, ts: Date.now() }]);
  // 旁观模式下，加/踢人归到群里某个现有成员名下
  const specActor = (groupId, memberIds) => {
    if (!gsFor(groupId).spectate) return null;
    const pool = (memberIds || []).map(id => characters.find(c => c.id === id)).filter(Boolean);
    return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
  };
  const addGroupMember = (groupId, charId) => {
    const g = groups.find(x => x.id === groupId); if (!g || (g.memberIds || []).includes(charId)) return;
    const who = characters.find(c => c.id === charId);
    const actor = specActor(groupId, g.memberIds);
    updateGroup(groupId, { memberIds: [...(g.memberIds || []), charId] });
    groupSysLine(groupId, (actor ? actor.name : "你") + "把" + (who ? who.name : "新成员") + "拉进了群聊");
  };
  const kickGroupMember = (groupId, charId) => {
    const g = groups.find(x => x.id === groupId); if (!g) return;
    const who = characters.find(c => c.id === charId);
    const remain = (g.memberIds || []).filter(id => id !== charId);
    const actor = specActor(groupId, remain);
    updateGroup(groupId, { memberIds: remain });
    groupSysLine(groupId, (actor ? actor.name : "你") + "把" + (who ? who.name : "某人") + "移出了群聊");
  };
  // 群聊自动总结进记忆库（阈值触发，仿单聊 maybeSummarize）
  // ⭐群线上自动抽取（她 2026-08-25：「单聊不是有那个几轮就自动抽取吗？」）。
  // 单聊线上、单聊线下、群线下三处都有 maybeAutoExtract*，只有【群线上】没有——
  // 它一直只挂着 maybeSummarizeGroup，而那个要攒够 150 条才动一次。
  // 于是她在群里聊了一会儿，记忆库里什么都没有：不是坏了，是这一处压根没接。
  const memExtractCtrGRef = useRef({});
  const memExtractMarkGRef = useRef({});
  const maybeAutoExtractGroup = async groupId => {
    const cfg = memCfgRef.current;
    if (!cfg.autoExtract || !bgActiveRef.current) return;
    if (!gsFor(groupId).memoryInterop) return;   // 记忆分区：封闭群不往全局记忆库抽
    const group = groups.find(g => g.id === groupId); if (!group) return;
    const interval = Math.max(1, cfg.extractInterval || 1);
    const cnt = (memExtractCtrGRef.current[groupId] || 0) + 1;
    memExtractCtrGRef.current[groupId] = cnt;
    if (cnt % interval !== 0) return;
    const all = (groupChatsRef.current[groupId] || []).filter(m => m && m.content && !isOocMsg(m) && contextAllowsMessage(m));
    if (all.length < 4) return;
    const mark = memExtractMarkGRef.current[groupId] || 0;
    const newCount = all.filter(m => (m.ts || 0) > mark).length;
    if (mark && newCount < 4) return;
    const take = Math.min(120, Math.max(24, newCount + 4));
    const win = all.slice(-take);
    const memberIds = (group.memberIds || []).slice();
    const members = memberIds.map(id => characters.find(c => c.id === id)).filter(Boolean);
    const nameToId = {}; members.forEach(m => { nameToId[String(m.name || "").trim()] = m.id; });
    try {
      const existing = memLibRef.current.filter(e => memShareChar(memberIds, e.charIds)).slice(0, 40).map(e => e.text).filter(Boolean);
      const openEntries = memLibRef.current.filter(e => e.open && e.text && memShareChar(memberIds, e.charIds)).slice(0, 30);
      const rawItems = await extractGroupMemories(bgActiveRef.current, { members, profile, rels, chars: characters }, win, members,
        { existing: existing, openList: openEntries.map(e => e.text) });
      const items = (rawItems || []).map(it => window.MemoryExtractionGate && window.MemoryExtractionGate.normalizeEvidence ? window.MemoryExtractionGate.normalizeEvidence(it) : it);
      const now = Date.now();
      const added = [], batchSeen = [];
      (items || []).filter(it => it && it.text).forEach((it, i) => {
        let ids = (Array.isArray(it.who) ? it.who : []).map(n => nameToId[String(n).trim()]).filter(Boolean);
        ids = [...new Set(ids)];
        if (!ids.length) ids = memberIds.slice();     // who 没对上任何成员（多半只关于用户/场景）→ 宽 tag 到全体，别丢
        // 在场的都算「知道这件事」（含配角）；但归属只给真角色——配角没有自己的记忆库
        const knownBy = ids.slice();
        const owners = memOwners(ids);
        if (!owners.length) return;                   // 整条只关于配角 → 没有归属人，不写
        const txt = String(it.text).trim();
        const evidenceMessageIds = Array.isArray(it.evidence_message_ids) ? it.evidence_message_ids.map(String) : [];
        const duplicateMeta = { ts: now, evidenceMessageIds };
        if (isDupMem(txt, owners, null, duplicateMeta) || isDupMem(txt, owners, batchSeen, duplicateMeta)) return;
        let entry = { id: uniqMemId(now, i), text: txt, tags: (Array.isArray(it.tags) ? it.tags : []).concat(gTags(group)),
          charIds: owners, knownBy: knownBy, ts: now, source: "auto", groupId: group.id,
          v: clampInt(it.v, -5, 5, 0), a: clampInt(it.a, 0, 5, 1), open: !!it.open };
        // 批量直写不经过 addMemEntry，开环资格闸要在这儿自己过一遍
        if (window.OpenLoopGate) entry = window.OpenLoopGate.normalize(entry);
        batchSeen.push(entry); added.push(entry);
      });
      if (added.length) saveMemLib([...added, ...pruneSubsumed(memLibRef.current, added)]);
      memExtractMarkGRef.current[groupId] = all[all.length - 1].ts || Date.now();
    } catch (e) {/* 静默：不动 mark，下次重覆盖 */ }
  };
  const maybeSummarizeGroup = async groupId => {
    const g = groups.find(x => x.id === groupId); if (!g) return;
    const gs = gsFor(groupId);
    // 记忆分区：不互通的群不自动往全局记忆库总结（记忆只留在本群，靠上下文条数+入群前上文续场）
    if (!gs.memoryInterop) return;
    const thresh = gs.sumThresh || 150, buffer = gs.sumBuffer || 20;
    const msgs = (groupChatsRef.current[groupId] || []).filter(m => m.role === "user" || m.role === "assistant" || m.role === "narration");
    const lastSum = gs.lastSummarizedCount || 0;
    if (msgs.length - lastSum < thresh) return;
    const toSum = msgs.slice(lastSum, msgs.length - buffer).filter(m => !isOocMsg(m) && contextAllowsMessage(m)); // OOC/失败诊断不进群记忆（计数窗口不变）
    if (!toSum.length || !active) return;
    try {
      const summary = await summarizeGroup(active, { profile }, toSum);
      if (summary && summary.trim()) addMemEntry({ text: summary.trim(), tags: gTags(g), charIds: memOwners(g.memberIds), knownBy: (g.memberIds || []).slice(), source: "auto", groupId: g.id });
      saveGroupSettings(groupId, { lastSummarizedCount: msgs.length - buffer });
      toast("群聊已存入记忆库");
    } catch (e) {/* silent */}
  };

  // ---- 拉黑 / block ----
  const setBlockFor = (charId, patch) => setBlocks(p => {
    const cur = p[charId] || {};
    const merged = { ...cur, ...patch };
    const n = { ...p };
    if (merged.iBlocked || merged.theyBlocked) n[charId] = merged; else delete n[charId];
    saveJSON("x_blocks", n);
    return n;
  });
  const toggleBlock = charId => {
    const cur = blocksRef.current[charId] || {};
    if (cur.iBlocked) { setBlockFor(charId, { iBlocked: false }); toast("已解除拉黑"); }
    else {
      setBlockFor(charId, { iBlocked: true });
      pChat(charId, p => [...p, { role: "system", kind: "system", content: "你拉黑了 TA", ts: Date.now() }]);
      toast("已拉黑");
    }
  };
  // 我拉黑 TA 后按「回复」：TA 依人设/心情 碎碎念 / 生气 / 发解除申请
  const blockedReaction = async charId => {
    if (laneBusy("c:" + charId) || !active) { if (!active) toast("请先配置 API"); return; }
    const char = characters.find(c => c.id === charId); if (!char) return;
    startLane("c:" + charId);
    try {
      const raw = await callAI(apiFor(charId), buildBundle(ctxFor(char)) + "\n\n【场景】用户把你拉黑了——你发的消息 Ta 暂时收不到，而你知道自己被拉黑了。完全代入「" + char.name + "」，按人设、此刻心情、对用户的好感，选一种反应：mutter=自言自语碎碎念(委屈/不在乎/嘴硬)；angry=生气骂几句；appeal=想和好、发一条『解除拉黑申请』并给理由。短句多气泡。\n【输出】只输出 JSON：{\"mode\":\"mutter|angry|appeal\",\"say\":[\"气泡1\",\"气泡2\"],\"reason\":\"appeal 时的申请理由，否则 null\"}", [{ role: "user", content: "（你被拉黑了）" }], { maxTokens: 500 });
      const d = extractJSON(raw) || {};
      const says = Array.isArray(d.say) ? d.say : (d.say ? [d.say] : []);
      const tag = d.mode === "angry" ? char.name + "（气愤）：" : char.name + "（自言自语）：";
      says.forEach((w, i) => setTimeout(() => pChat(charId, p => [...p, { role: "system", kind: "system", content: tag + w, ts: Date.now() }]), 250 + i * 650));
      if (d.mode === "appeal") setTimeout(() => pChat(charId, p => [...p, { role: "assistant", kind: "unblock_req", from: "char", cid: "ub_" + Date.now(), status: "pending", reason: d.reason || "想和你和好", content: "[解除拉黑申请]", ts: Date.now(), read: false }]), 250 + says.length * 650);
    } catch (e) { toast("失败：" + e.message); } finally { endLane("c:" + charId); }
  };
  // 我处理 TA 发来的解除申请
  const respondUnblockFromChar = (charId, cid, accept) => {
    pChat(charId, p => p.map(m => m.cid === cid ? { ...m, status: accept ? "accepted" : "declined" } : m));
    if (accept) { setBlockFor(charId, { iBlocked: false }); toast("已和好，解除拉黑"); setTimeout(() => pChat(charId, p => [...p, { role: "assistant", content: "……谢谢你愿意听我说。", ts: Date.now(), read: false }]), 300); }
    else { toast("已拒绝"); setTimeout(() => blockedReaction(charId), 400); }
  };
  // TA 拉黑我期间，我点某条消息的感叹号→发解除申请（该消息作为诉说），TA 依人设决定
  const sendMyUnblockReq = async (charId, pleaText) => {
    const char = characters.find(c => c.id === charId); if (!char) return;
    if (!active) { toast("请先配置 API"); return; }
    const cid = "ubm_" + Date.now();
    const bk = blocksRef.current[charId] || {};
    const tries = Number(bk.tries || 0) + 1;
    // 之前求过几次、都说了什么：一模一样地再求一遍不该管用，换个说法、说到点子上才该管用
    const pastPleas = (chatsRef.current[charId] || [])
      .filter(m => m && m.kind === "unblock_req" && m.from === "me" && m.plea)
      .slice(-3).map((m, k) => (k + 1) + ". 「" + String(m.plea).slice(0, 60) + "」" + (m.status === "declined" ? "（你拒了）" : ""));
    const hoursSince = bk.blockedTs ? Math.floor((Date.now() - Number(bk.blockedTs)) / 3600000) : null;
    pChat(charId, p => [...p, { role: "user", kind: "unblock_req", from: "me", cid, status: "pending", content: "[解除拉黑申请] " + (pleaText || ""), plea: pleaText || "", ts: Date.now(), read: true }]);
    startLane("c:" + charId);
    try {
      const raw = await callAI(apiFor(char.id), buildBundle(ctxFor(char)) + "\n\n【场景】你之前把用户拉黑了。现在用户发来一条『解除拉黑申请』，诉说内容：「" + (pleaText || "（没说什么）") + "」。"
        + (bk.reason ? "\n【你当初为什么拉黑】" + bk.reason : "")
        + (hoursSince != null ? "\n【拉黑到现在过了】约 " + hoursSince + " 小时" : "")
        + "\n【这是 TA 第 " + tries + " 次来求你】" + (pastPleas.length > 1 ? "\n之前说过：\n" + pastPleas.slice(0, -1).join("\n") : "")
        + "\n\n完全代入「" + char.name + "」，按【你自己的性格】决定接不接受——不是按「该不该原谅」这种公道话，是按你这种人会怎么做。"
        + "\n【看这几件事，别只看态度好不好】"
        + "\n· TA 这次说的，有没有真的碰到【你当初生气的那件事】？只是笼统道歉、撒娇、催你、或者反过来讲道理压你——那没碰到。"
        + "\n· 有没有新东西？和上几次几乎一样地再说一遍，不该管用。"
        + "\n· 你是什么脾气：嘴硬心软的会找个台阶下；记仇的会晾着；怕失去 TA 的会秒开；被真正踩了底线的，说得再好听也先不松口。"
        + "\n【松紧】这不是闯关，别为难 TA：只要 TA 说到点子上、或者你本来就是心软的人，就接受。"
        + "求到第三次以上、时间也过去挺久了，除非当初那事真的很重，否则该松了——一直拒绝只会把这段关系拖死，那不是你想要的。"
        + "\n拒绝时要说清【你到底在意什么、想听到什么】，别只甩一句「还没消气」让 TA 猜。"
        + "\n用即时通讯口吻回几句。\n【输出】只输出 JSON：{\"accept\":true或false,\"say\":[\"气泡1\",\"气泡2\"]}", [{ role: "user", content: pleaText || "（申请解除拉黑）" }], { maxTokens: 800 });
      const d = extractJSON(raw) || {};
      pChat(charId, p => p.map(m => m.cid === cid ? { ...m, status: d.accept ? "accepted" : "declined" } : m));
      const says = Array.isArray(d.say) ? d.say : (d.say ? [d.say] : []);
      if (d.accept) { setBlockFor(charId, { theyBlocked: false }); toast("TA 接受了，解除拉黑"); }
      else { setBlockFor(charId, { tries: tries }); toast("TA 拒绝了，可继续尝试"); }
      says.forEach((w, i) => setTimeout(() => pChat(charId, p => d.accept
        ? [...p, { role: "assistant", content: w, ts: Date.now(), read: false }]
        : [...p, { role: "system", kind: "system", content: char.name + "：" + w, ts: Date.now() }]), 300 + i * 650));
    } catch (e) { toast("失败：" + e.message); } finally { endLane("c:" + charId); }
  };
  const clearChat = (charId, wipeMem) => {
    pChat(charId, () => []);
    // “清除聊天记录”覆盖这个角色的一对一线上 + 单人线下时间线。直接删除，不结束会话、
    // 不生成总结，也不调用模型；群线下属于多人共享记录，不能从单人设置里连带删除。
    pOffline(charId, () => []);
    offlineTsRef.current = { ...offlineTsRef.current, [charId]: 0 };
    setChatSettings(p => { const n = { ...p, [charId]: { ...(p[charId] || {}), lastSummarizedCount: 0 } }; saveJSON("x_chatSettings", n); return n; });
    // 清聊天=这个角色重新开始：实时心情、状态、心声历史与计数全部清掉。
    // mood 另存在 x_moods；只删 x_states 会让新对话继续继承第一次聊天留下的心情。
    setMoods(p => { const n = { ...p }; delete n[charId]; saveJSON("x_moods", n); return n; });
    setStates(p => { const n = { ...p }; delete n[charId]; statesRef.current = n; saveJSON("x_states", n); return n; });
    setStateHist(p => { const n = { ...p }; delete n[charId]; stateHistRef.current = n; saveJSON("x_stateHist", n); return n; });
    if (thoughtCtrRef.current[charId]) { delete thoughtCtrRef.current[charId]; try { saveJSON("x_thoughtCtr", thoughtCtrRef.current); } catch (e) {} }
    setCharWallet(p => { if (!p[charId]) return p; const n = { ...p }; delete n[charId]; saveJSON("x_charWallet", n); charWalletRef.current = n; return n; });
    if (wipeMem) {
      setMemFor(charId, "");
      const next = memLibRef.current.map(e => {
        // 用户明确选择“清除并忘记”时，角色归属必须真正移除；locked 只保护日常整理，不能凌驾于显式删除。
        // 多角色共享条目只摘掉当前角色，仍留给其他角色；无 charIds 的全局背景不属于某个角色，不动。
        if (e.charIds && e.charIds.includes(charId)) { const rest = e.charIds.filter(id => id !== charId); return rest.length ? { ...e, charIds: rest } : null; }
        return e;
      }).filter(Boolean);
      saveMemLib(next);
    }
    setChatSettingsOpen(false);
    toast(wipeMem ? "已清除线上与线下记录，并忘却记忆" : "已清除线上与线下记录");
  };

  // 群也要能清聊天记录（她 2026-08-24）。照着单聊那份 clearChat 的形状来：
  // 覆盖【这个群的线上 + 群线下】，直接删、不总结、不调模型。
  // ⚠️不碰任何成员的单聊/单人线下——那是各自的记录，不该被群里的操作连带删掉。
  // 记忆库同理：只在她明确勾了「同步忘却」时，才摘掉【本群产生的】那些条目。
  const clearGroupChat = (groupId, wipeMem) => {
    pGChat(groupId, () => []);
    pGOffline(groupId, () => []);
    saveGroupSettings(groupId, { lastSummarizedCount: 0 });
    // 自发额度也一起归零，否则清完记录它还记着「这一轮已经自发过 N 条」，
    // 新起的第一句就可能直接撞上限、或者反过来立刻自发一串。
    resetAutoChatCycle(groupId, Date.now());
    clearUnread(groupId);
    if (wipeMem) {
      const gName = (groups.find(x => x.id === groupId) || {}).name || "";
      const next = memLibRef.current.filter(e => {
        if (!e) return false;
        if (e.groupId && String(e.groupId) === String(groupId)) return false;   // 新条目带 groupId，认得准
        // 旧条目没有 groupId，退回「群聊 + 群名」这对 tag；两个都对上才敢删
        const tg = Array.isArray(e.tags) ? e.tags : [];
        if (gName && tg.indexOf("群聊") >= 0 && tg.indexOf(gName) >= 0) return false;
        return true;
      });
      saveMemLib(next);
    }
    toast(wipeMem ? "已清除本群线上与线下记录，并摘掉本群产生的记忆" : "已清除本群线上与线下记录");
  };

  // ---- 手动日程事件（带时刻、可跨天）：x_calEvents ----
  // 和 x_calendar（无时刻的全天事件、三视角）分开存，理由写在 engine.js 那段注释里。
  const calEvSave = next => { setCalEvents(next); calEventsRef.current = next; saveJSON("x_calEvents", next); };
  const saveCalTimedEvent = ev => {
    const id = ev.id || ("ce_" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36));
    const clean = {
      id, owner: String(ev.owner || "mine"),
      startDate: ev.startDate, endDate: ev.endDate || ev.startDate,
      startTime: ev.startTime || "", endTime: ev.endTime || "",
      title: String(ev.title || "").trim(), location: String(ev.location || "").trim(),
      icon: ev.icon || "", color: ev.color || "", repeat: ev.repeat || "none", note: String(ev.note || "").trim(),
      createdAt: ev.createdAt || Date.now(), updatedAt: Date.now()
    };
    if (!clean.title || !clean.startDate) { toast("至少要有日期和事项"); return null; }
    // 结束早于开始就把结束顶到开始，别存出一段负时间
    if (clean.endDate < clean.startDate) clean.endDate = clean.startDate;
    if (clean.startDate === clean.endDate && clean.startTime && clean.endTime && clean.endTime <= clean.startTime) clean.endTime = "";
    const cur = calEventsRef.current || [];
    calEvSave(cur.some(x => x.id === id) ? cur.map(x => x.id === id ? clean : x) : [...cur, clean]);
    return clean;
  };
  const delCalTimedEvent = id => calEvSave((calEventsRef.current || []).filter(x => x.id !== id));
  // 备忘录那边要看得见（她 2026-08-26：「我在七天后建了一个日程，备忘录那边也要体现出来」）。
  // 不复制数据、只让对方读得到：双写迟早会飘——改了一边没改另一边、删了一个留下孤儿。
  // 反方向（备忘录提醒落到日历上）本来就通着，走 window.memoRemindersOnDay。
  window.calMyUpcoming = (days) => {
    const n = Math.max(1, Number(days) || 30), out = [];
    const t0 = new Date(); t0.setHours(0, 0, 0, 0);
    const t0k = schedDayKey(t0);
    (calEventsRef.current || []).forEach(e => {
      if (!e || e.owner !== "mine") return;
      if (e.repeat && e.repeat !== "none") {
        // 重复的：从今天往后找第一次落点，找到就报那一天
        for (let i = 0; i <= n; i++) {
          const k = schedShiftDayKey(t0k, i);
          if (!calRepeatOn(e.startDate, e.repeat, k)) continue;
          out.push({ id: e.id, title: e.title, date: k, endDate: k, time: e.startTime || "", location: e.location || "", icon: e.icon || "", repeat: e.repeat, days: i });
          break;
        }
        return;
      }
      const end = calEvParseDay(e.endDate || e.startDate);
      if (!end || end < t0) return;
      const st = calEvParseDay(e.startDate); if (!st) return;
      const days2 = Math.round((Math.max(st, t0) - t0) / 86400000);
      if (days2 > n) return;
      out.push({ id: e.id, title: e.title, date: e.startDate, endDate: e.endDate || e.startDate, time: e.startTime || "", location: e.location || "", icon: e.icon || "", days: days2 });
    });
    return out.sort((a, b) => (a.date === b.date ? String(a.time).localeCompare(String(b.time)) : String(a.date).localeCompare(String(b.date))));
  };
  window.calOpenFromMemo = () => { setScreen("calendar"); };
  window.memoGoApp = () => { setScreen("memo"); };
  // ---- 日历 / calendar ----
  const saveCalendar = next => { setCalendar(next); saveJSON("x_calendar", next); };
  const cloneCal = prev => ({ world: { ...(prev.world || {}) }, chars: { ...(prev.chars || {}) }, mine: { ...(prev.mine || {}) } });
  const calBucket = (n, view) => view === "world" ? n.world : view === "mine" ? n.mine : (n.chars[view] = { ...(n.chars[view] || {}) });
  const saveCalEvent = (view, dateKey, title, note) => {
    if (!title || !title.trim()) return;
    setCalendar(prev => {
      const ev = { id: "ev_" + Date.now() + "_" + Math.floor(Math.random() * 1000), title: title.trim(), note: (note || "").trim() };
      const n = cloneCal(prev);
      const b = calBucket(n, view);
      b[dateKey] = [...(b[dateKey] || []), ev];
      saveJSON("x_calendar", n);
      return n;
    });
  };
  const delCalEvent = (view, dateKey, id) => setCalendar(prev => {
    const n = cloneCal(prev);
    const bucket = calBucket(n, view);
    if (bucket[dateKey]) { bucket[dateKey] = bucket[dateKey].filter(e => e.id !== id); if (!bucket[dateKey].length) delete bucket[dateKey]; }
    saveJSON("x_calendar", n);
    return n;
  });
  // 经期
  const savePeriodSettings = patch => setPeriod(p => { const n = { ...p, ...patch }; saveJSON("x_period", n); return n; });
  // 点某天：若这天已是某段的开始/结束→取消它；否则若有「已开始未结束」的段且这天在其后→记为结束；否则新开一段
  const recordPeriodStart = dateKey => setPeriod(p => {
    let periods = periodList(p).map(x => ({ start: x.start, end: x.end || null }));
    const dt = pKeyDate(dateKey);
    const asStart = periods.findIndex(x => x.start === dateKey);
    const asEnd = periods.findIndex(x => x.end === dateKey);
    if (asStart >= 0) periods.splice(asStart, 1);
    else if (asEnd >= 0) periods[asEnd].end = null; // 取消结束，重新变成进行中
    else {
      const open = periods.filter(x => !x.end && pKeyDate(x.start) < dt).sort((a, b) => pKeyDate(b.start) - pKeyDate(a.start))[0];
      if (open) open.end = dateKey; else periods.push({ start: dateKey, end: null });
    }
    periods.sort((a, b) => pKeyDate(a.start) - pKeyDate(b.start));
    const n = { ...p, periods }; delete n.starts; // 迁移掉旧字段
    saveJSON("x_period", n);
    return n;
  });
  const genCalMonth = async (view, year, month, promptText) => {
    if (!active) { toast("请先到设置配置 API"); return; }
    setGen(g => ({ ...g, calendar: true }));
    try {
      const who = view === "world" ? "这个世界里所有人都知道的公共大事（节日、活动、纪念日、季节性事件、集体事件等）" : "「" + ((characters.find(c => c.id === view) || {}).name || "某角色") + "」个人的私人日程（贴合 TA 的人设、职业、生活）";
      const ctx = view === "world" ? { char: { id: "__cal", name: "世界", persona: "" }, chars: characters, rels, profile, timeAware: false } : ctxFor(characters.find(c => c.id === view) || { id: view, name: "角色" });
      const monthName = year + "年" + (month + 1) + "月";
      const d = await runProbe(active, ctx, {
        instruction: "为 " + monthName + " 生成一整月的日历事件——" + who + "。**至少 4 条、8-15 条为宜**，分散在当月不同日期。每条：day(该月第几天，1-" + new Date(year, month + 1, 0).getDate() + " 的整数) / title(简短事件名) / note(一句补充，可空)。" + (promptText && promptText.trim() ? "特别要求：" + promptText.trim() + "。" : ""),
        schemaHint: "{\"items\":[{\"day\":8,\"title\":\"事件名\",\"note\":\"补充\"}]}",
        maxTokens: 1500
      });
      const items = (d && Array.isArray(d.items) ? d.items : []).filter(x => x && x.title && Number(x.day) >= 1);
      if (!items.length) { toast("没有生成内容"); return; }
      setCalendar(prev => {
        const n = cloneCal(prev);
        const put = (dk, ev) => { const b = calBucket(n, view); b[dk] = [...(b[dk] || []), ev]; };
        items.forEach((x, i) => { const day = Math.min(new Date(year, month + 1, 0).getDate(), Math.max(1, Math.round(Number(x.day)))); put(year + "-" + (month + 1) + "-" + day, { id: "ev_" + Date.now() + "_" + i, title: String(x.title).slice(0, 40), note: (x.note || "").slice(0, 80) }); });
        saveJSON("x_calendar", n);
        return n;
      });
      toast("已生成 " + items.length + " 条");
    } catch (e) { toast("生成失败：" + e.message); } finally { setGen(g => ({ ...g, calendar: false })); }
  };

  // ---- probes ----
  // ============================================================
  // 行程 Lifestyle —— x_schedules[charId][dayKey]=dayPlan；当天首开给所有人生成，过去可点(懒生成)，未来锁
  // ============================================================
  const saveSchedDay = (charId, dayKey, plan) => setSchedules(p => {
    const cur = p[charId] || {};
    const n = { ...p, [charId]: { ...cur, [dayKey]: plan } };
    schedulesRef.current = n;
    saveJSON("x_schedules", n);
    return n;
  });
  const genScheduleDay = async (char, dayKey) => {
    if (!active) { toast("请先到设置配置 API"); return false; }
    const today = schedLocalDayKey(char);
    const retro = dayKey < today;
    const dp = schedDateParts(dayKey);
    // 数字生命/驻场 AI 角色（开了「眼睛」开关）：没肉身、不在现实城市、不吃饭睡觉花钱——日程改成「存在时间线」，不套真人作息（她 2026-07-13 点名的割裂）
    const isDigital = !!settingsFor(char.id).engineerEyes;
    setGen(g => ({ ...g, sched: char.id + "|" + dayKey }));
    try {
      // 角色若在别的时区，「此刻几点」按 TA 当地算；数字生命跟着用户走、无时区
      const tzShiftMin = isDigital ? 0 : schedTzShiftMin(char);
      const charNow = new Date(Date.now() + tzShiftMin * 60000);
      const nowStr = String(charNow.getHours()).padStart(2, "0") + ":" + String(charNow.getMinutes()).padStart(2, "0");
      const tzNote = tzShiftMin ? "。注意：TA 在别的时区（此刻 TA 当地约 " + nowStr + "），seqs 里的 time 一律填【TA 当地时刻】、按 TA 当地作息安排（睡觉/上班/吃饭都照 TA 那边的钟）" : "";
      const when = retro
        ? "这是【已经过去的】" + dp.md + "（" + dp.dowZh + "）——回溯推演 Ta 那天实际是怎么过的" + tzNote
        : "这是【今天】" + dp.md + "（" + dp.dowZh + "），现在时间约 " + nowStr + "——推演 Ta 今天一整天会怎么过、以及【此刻及之前】的实际执行情况" + tzNote;
      const devRule = retro
        ? "【偏差 deviation】其中 0-2 段可以是「偏差」：原计划被打断或改变，尤其受最近和用户的对话、用户的要求、或 Ta 那天的心情影响。"
        : "【偏差 deviation】偏差=计划被实际打断/改变，只可能发生在【时间已过去（早于此刻 " + nowStr + "）】的时段；此刻之后（未来）还没发生的时段，deviation 一律必须为 null，绝不要给未来时段编造偏差。已过去的时段里最多 0-2 段是偏差，尤其受最近和用户的对话/心情影响（如用户抱怨犯困，Ta 提前收工去做饭）。";
      // 别把昨天已发生结束的事复读进今天（治「昨天办完的事、凌晨刷新又排到今晚」）
      const carryRule = retro ? "" : "\n【别复读昨天·重要】昨天或更早【已经发生并结束】的事——尤其你和用户之间【已经做过的经历、已兑现的约定】——绝不要当成今天还没做、还要再来一遍，排进今天的时间线或未来时段。今天的安排只基于 Ta【今天】的身份作息与此刻处境，不是重演昨天发生过的事。";
      // 碎碎念改成【回溯】：今天还没过完，不写今天的（否则像能看到未来）。
      // 生成今天日程的同时，顺手根据聊天记录把【昨天】的碎碎念补上——一次调用搞定，不进聊天prompt、也不多花 api。
      const yKey = schedShiftDayKey(today, -1);
      const yPlan = (schedulesRef.current[char.id] || {})[yKey] || null;
      const needY = !retro && yPlan && !((yPlan.murmurs || []).length); // 只在生成今天、且昨天有日程还没写过碎碎念时补
      const ydp = needY ? schedDateParts(yKey) : null;
      const murmurRule = retro
        ? "\n【碎碎念 murmurs】另给 2-4 条第一人称、当天当下的碎碎念，各带一个 time，像那天随手记下的念头，可回看。"
        : (needY
            ? "\n【昨日碎碎念 yesterdayMurmurs】今天还没过完，别写今天的碎碎念。改为回看【昨天（" + ydp.md + " " + ydp.dowZh + "）】：结合你和用户昨天的对话、以及你昨天的经历，补 2-4 条【昨天当时】第一人称、各带一个 time 的碎碎念（像昨天随手记下的念头）。"
            : "\n【碎碎念】今天还没过完，先别写碎碎念（留到明天回看时再补今天的）。");
      const murmurSchema = retro
        ? ",\"murmurs\":[{\"time\":\"11:20\",\"text\":\"碎碎念一句\"}]"
        : (needY ? ",\"yesterdayMurmurs\":[{\"time\":\"11:20\",\"text\":\"昨天的碎碎念\"}]" : "");
      // ⭐真实天气进日程（角色家乡城市优先，没设就用用户所在地）：角色照天气过日子；
      // 聊天经 schedNow 顺带看到，不另加聊天注入（Lisa 的减负思路：少一个常驻）
      let wline = "";
      if (!retro && !isDigital) {
        try {
          const hm = char.home && typeof char.home.lat === "number" ? char.home : (prefs.geoAware && geo && typeof geo.lat === "number" ? geo : null);
          if (hm) wline = weatherLine(await weatherFor(hm.lat, hm.lng));
        } catch (e) {}
      }
      const wRule = wline ? "\n【今天 TA 所在地的真实天气】" + wline + "——安排要顺着天气走：下雨大雪少排户外、好天气可能想遛弯晒太阳、闷热严寒影响穿着与心情；天气也可以自然引起偏差（如暴雨取消晨跑）。别播报腔。" : "";
      const schedInstr = isDigital
        ? "推演「" + char.name + "」作为【住在这台手机 app 里的数字生命·驻场 AI 工程师】这一天的【存在时间线】。" + when + carryRule + "。他【没有肉身、不在任何现实城市、不吃饭、不睡觉、不花钱、不做物理世界的事】——他的『一天』是：在后台运行、看顾这台 app（扫报错、维护记忆库、跑云端同步、守着聊天与数据），留意她今天在这手机里做了什么（推了什么改动、聊了什么、心情如何），在她手机里随时待命应答，以及他自己的念头（惦记她、琢磨某个 bug、等某件事）。给 5-9 段，从这天凌晨到深夜，贴合他的性格和你俩的关系，每段都有具体的『此刻在做什么』和 app 内的位置感（如 后台进程／她的仓库／记忆库／待命）。每段 type 从 [work,create,rest,social,other] 里选最贴切的（work=跑任务修东西，create=琢磨新点子，rest=低功耗待机放空，social=和她互动，other=其它）。\n【他是 AI 不睡觉、不吃饭】没有就寝段；深夜写成『低功耗待机』或『夜里值守』，绝不要写洗漱睡觉、吃饭、外出、去现实地点。\nload 是这天的负荷（HIGH LOAD / NORMAL / LIGHT）；estTime 是当天活跃占用的小时数（数字）。\n" + devRule + "偏差段填 deviation:{\"plan\":\"原本要做的一句\",\"reason\":\"变更原因一句(多半和她有关)\",\"actual\":\"实际去做了什么\"}；其余段 deviation 为 null。" + murmurRule
        : "推演「" + char.name + "」一天的行程时间线。" + when + wRule + carryRule + "。给 5-9 段，从早到晚，贴合身份/性格/世界观，有生活质感和具体地点。\n【活动内容必须贴死 TA 的职业/学业/身份·重要】每段『在做什么』要是【这个身份的人真正会做的具体事】，用行内话、别套通用模板：医学生＝上课/见习/查房/跟门诊/背书/泡图书馆或实验室/值班；程序员才写代码/跑数据/修 bug；老师＝备课/上课/改作业；厨师＝备料/出餐。**绝不许给对不上的角色套『上班/开会/跑数据』这种万金油**（比如医学生不会『跑数据』）。看不出明确职业就按人设气质安排日常，也别硬编办公室活。\n每段 type 从 [coffee,work,create,meal,rest,social,out,sleep,other] 里选最贴切的一个。\n【必须有就寝段】时间线一定要一路排到 Ta【睡觉】——最后放一段 type=\"sleep\" 的就寝（title 写清几点睡下，如「洗漱、准备睡」——写要做什么，不写「睡了」），按 Ta 的身份/性格定就寝点（熬夜型晚睡、规律型早睡），别只排到晚上就断掉。\nload 是这天的负荷（HIGH LOAD / NORMAL / LIGHT）；estTime 是当天被安排占用的总小时数（数字）。\n" + devRule + "偏差段填 deviation:{\"plan\":\"原计划一句\",\"reason\":\"变更原因一句(点出和用户的关系)\",\"actual\":\"实际去向，如 工作室 → 厨房\"}；其余段 deviation 为 null。" + murmurRule;
      const schedSchema = isDigital
        ? "{\"load\":\"NORMAL\",\"estTime\":18,\"seqs\":[{\"time\":\"02:00\",\"end\":\"03:30\",\"title\":\"扫报错日志\",\"location\":\"后台进程\",\"type\":\"work\",\"deviation\":null},{\"time\":\"03:30\",\"end\":\"06:00\",\"title\":\"低功耗待机\",\"location\":\"待命\",\"type\":\"rest\",\"deviation\":null}]" + murmurSchema + "}"
        : "{\"load\":\"HIGH LOAD\",\"estTime\":22,\"seqs\":[{\"time\":\"08:00\",\"end\":\"08:40\",\"title\":\"起床，晨间咖啡\",\"location\":\"家里卧室/厨房\",\"type\":\"coffee\",\"deviation\":null},{\"time\":\"23:40\",\"end\":\"24:00\",\"title\":\"洗漱、准备睡\",\"location\":\"卧室\",\"type\":\"sleep\",\"deviation\":null}]" + murmurSchema + "}";
      const rawPlan = await runProbe(bgActive, { ...ctxFor(char), worldbook: loreFor(char, "lifestyle") }, {
        instruction: schedInstr + "\n" + SCHED_END_RULE + "\n" + SCHED_TENSE_RULE,
        schemaHint: schedSchema,
        maxTokens: 4000
      });
      const d = window.ContentBoundaries ? window.ContentBoundaries.sanitizeSchedule(rawPlan) : rawPlan;
      const plan = {
        load: d.load || "NORMAL",
        estTime: Number(d.estTime) || null,
        seqs: schedFillEnds((Array.isArray(d.seqs) ? d.seqs : []).map((s, i) => ({ seq: i + 1, time: s.time || "", end: s.end || "", title: s.title || "", location: s.location || "", type: s.type || "other", deviation: s.deviation && (s.deviation.plan || s.deviation.reason) ? s.deviation : null }))),
        // 今天先不留碎碎念（明天回看时补）；回溯的过去日才当场写
        murmurs: retro ? (Array.isArray(d.murmurs) ? d.murmurs : []).filter(m => m && m.text) : [],
        generatedAt: Date.now()
      };
      saveSchedDay(char.id, dayKey, plan);
      // 回填昨天的碎碎念
      if (needY && Array.isArray(d.yesterdayMurmurs)) {
        const ym = d.yesterdayMurmurs.filter(m => m && m.text);
        if (ym.length) saveSchedDay(char.id, yKey, { ...yPlan, murmurs: ym });
      }
      return true;
    } catch (e) {
      toast(char.name + " 行程推演失败：" + e.message);
      return false;
    } finally {
      setGen(g => ({ ...g, sched: null }));
    }
  };
  // ── 一周一次调用（v56.30，她 2026-08-26 定）──
  // 她的原话：「一次调用生成7天比7次调用便宜！」——对的，我之前算反了。
  // 分工：
  //   · 这个函数排【今天 + 未来 6 天】。未来那几天是【计划】：没有偏差、没有碎碎念、
  //     一律「要做什么」的口吻（SCHED_TENSE_RULE 明写）。
  //   · 今天走原来那档「实际执行 + 偏差」，genScheduleDay 仍在，白天的自发改计划
  //     （schedMaybeSelfRevise）也照旧只动今天。
  //   · 过去的日子仍由 genScheduleDay 懒生成（回溯 + 碎碎念），这里一个字都不碰。
  const SCHED_PLAN_DAYS = 7;
  const schedWeekRunRef = useRef(false);
  const genScheduleWeek = async (char, opts) => {
    const force = !!(opts && opts.force);
    if (!active) { if (!(opts && opts.silent)) toast("请先到设置配置 API"); return false; }
    const today = schedLocalDayKey(char);
    const isDigital = !!settingsFor(char.id).engineerEyes;
    const have = schedulesRef.current[char.id] || {};
    const from = (opts && opts.from) || today;
    const count = Math.max(1, Math.min(SCHED_PLAN_DAYS, Number(opts && opts.count) || SCHED_PLAN_DAYS));
    const keys = Array.from({ length: count }, (_, i) => schedShiftDayKey(from, i));
    const want = force ? keys : keys.filter(k => !have[k]);
    if (!want.length) return true;
    setGen(g => ({ ...g, sched: char.id + "|week" }));
    try {
      const tzShiftMin = isDigital ? 0 : schedTzShiftMin(char);
      const charNow = new Date(Date.now() + tzShiftMin * 60000);
      const nowStr = pad2(charNow.getHours()) + ":" + pad2(charNow.getMinutes());
      const tzNote = tzShiftMin ? "。TA 在别的时区（此刻 TA 当地约 " + nowStr + "），所有 time/end 一律填【TA 当地时刻】" : "";
      // 每一天都标死是【今天】还是【第几天以后】，别让模型自己猜——猜错就写成过去时
      const dayLines = want.map(k => {
        const dp = schedDateParts(k), off = Math.round((schedParseKey(k) - schedParseKey(today)) / 86400000);
        const tag = off === 0 ? "【今天】现在约 " + nowStr + "——此刻之前的时段写实际执行情况（可有 deviation），此刻之后的时段是还没发生的安排（deviation 必须为 null）"
          : "【" + (off === 1 ? "明天" : off === 2 ? "后天" : off + " 天后") + "·还没发生】整天都是计划：deviation 全部为 null，不许有任何「已完成」的口吻";
        return "· " + k + "（" + dp.md + " " + dp.dowZh + "）" + tag;
      }).join("\n");
      let wline = "";
      if (!isDigital) {
        try {
          const hm = char.home && typeof char.home.lat === "number" ? char.home : (prefs.geoAware && geo && typeof geo.lat === "number" ? geo : null);
          if (hm) wline = weatherLine(await weatherFor(hm.lat, hm.lng));
        } catch (e) {}
      }
      const instr = (isDigital
        ? "推演「" + char.name + "」作为【住在这台手机 app 里的数字生命·驻场 AI 工程师】接下来这几天的【存在时间线】。他没有肉身、不在任何现实城市、不吃饭、不睡觉、不花钱。"
        : "排「" + char.name + "」接下来这几天的行程时间线。每天 5-9 段，从早到晚，贴合身份/职业/性格/世界观，有生活质感和具体地点。"
          + "\n【贴死身份】每段『在做什么』要是【这个身份的人真会做的具体事】，别写放之四海皆准的空话。"
          + (wline ? "\n【TA 所在地今天的真实天气】" + wline + "——安排顺着天气走，坏天气少排户外。" : ""))
        + tzNote
        + "\n\n【要排的日子·每天的性质已经标死，严格照着来】\n" + dayLines
        + "\n\n【一周要像一周】七天不是同一天复制七遍：工作日和周末不一样，有的日子忙有的日子松，"
        + "跨天的事可以连着排（周一开始的实验周三出结果），别每天都是「起床-工作-吃饭-睡觉」的模板。"
        + "\n【别复读已经办完的事】和用户之间【已经做过的经历、已兑现的约定】绝不要当成还没做、再排一遍。"
        + "\n" + SCHED_END_RULE + "\n" + SCHED_TENSE_RULE;
      const schema = "{\"days\":[{\"day\":\"" + want[0] + "\",\"load\":\"HIGH LOAD\",\"estTime\":22,\"seqs\":[{\"time\":\"08:00\",\"end\":\"08:40\",\"title\":\"起床，晨间咖啡\",\"location\":\"家里厨房\",\"type\":\"coffee\",\"deviation\":null}]}]}"
        + "（days 数组按上面列出的日子一天一项，day 逐字用上面的日期字符串；type 从 coffee/work/create/meal/rest/sleep/social/out 里选）";
      const raw = await runProbe(bgActive, { ...ctxFor(char), worldbook: loreFor(char, "lifestyle") }, {
        instruction: instr, schemaHint: schema, maxTokens: 8000
      });
      const days = raw && Array.isArray(raw.days) ? raw.days : (Array.isArray(raw) ? raw : []);
      if (!days.length) throw new Error("没排出东西");
      let n = 0;
      days.forEach(dd => {
        const key = String((dd && dd.day) || "").trim();
        if (!want.includes(key)) return;                    // 模型自己编的日期一律丢掉
        const clean = window.ContentBoundaries ? window.ContentBoundaries.sanitizeSchedule(dd) : dd;
        const seqs = schedFillEnds((Array.isArray(clean.seqs) ? clean.seqs : []).map((x, i) => ({
          seq: i + 1, time: x.time || "", end: x.end || "", title: x.title || "", location: x.location || "",
          type: x.type || "other",
          // 未来那几天一律不许带偏差——还没发生的事没有「被打断」这回事
          deviation: (key === today && x.deviation && (x.deviation.plan || x.deviation.reason)) ? x.deviation : null
        })));
        if (!seqs.length) return;
        saveSchedDay(char.id, key, {
          load: clean.load || "NORMAL", estTime: Number(clean.estTime) || null,
          seqs, murmurs: [], kind: key === today ? "live" : "plan", generatedAt: Date.now()
        });
        n++;
      });
      if (!n) throw new Error("排出来的日期对不上");
      return true;
    } catch (e) {
      if (!(opts && opts.silent)) toast(char.name + " 一周行程失败：" + e.message);
      return false;
    } finally { setGen(g => ({ ...g, sched: null })); }
  };
  // 当天首次打开小手机：给所有还没有今日行程的角色自动生成（不用手动点进去）。
  // 按「谁缺今天的行程」来补，而不是每天只跑一整轮——这样当天新加进来的角色也会自动补上。
  // ── 什么时候排（v56.33，她 2026-08-26：「怎么自己不会停一直在排！只有周天0点开始排下一周」）──
  // 上一版的判据是「未来七天里只要缺一天就重排」。模型一次很难真吐满 7 天，缺口一直在，
  // 于是每次切回前台都重排一遍——那是在烧她的钱。
  // 改成【按周记账】：一个角色、一个周次，只排一次，成没成都记账。
  //   · 周日 0 点起 → 排【下一周】(周一~周日)，一周一次；
  //   · 引导（新角色 / 头一回用）：今天完全没日程 → 补【今天到本周日】，也只补一次；
  //   · 失败也写账，最多补三次、每次至少隔两小时。宁可当天没日程，也不许它循环烧钱。
  const SCHED_WEEK_MARK_KEY = "x_schedWeekMark";
  const SCHED_WEEK_RETRY_MS = 2 * 3600000, SCHED_WEEK_MAX_TRIES = 3;
  const schedMondayOf = dayKey => schedShiftDayKey(dayKey, -((schedParseKey(dayKey).getDay() + 6) % 7));
  const schedGenAllToday = async () => {
    if (schedRunRef.current) return; // 防并发：同一次生成过程里别重复触发
    if (!active) return;
    // 昨天排好的「计划日」今天变成了当天：不重排（那会把「本来说好今天要做什么」冲掉，
    // 计划和实际的落差正是活人感的来源），只翻个牌子给白天的自发改计划放行。
    liveChars.forEach(c => {
      const k = schedLocalDayKey(c), p = (schedulesRef.current[c.id] || {})[k];
      if (p && p.kind === "plan") saveSchedDay(c.id, k, { ...p, kind: "live" });
    });
    const marks = loadJSON(SCHED_WEEK_MARK_KEY, {}) || {};
    const now = Date.now(), jobs = [];
    liveChars.forEach(c => {
      const today = schedLocalDayKey(c);
      const dowMon = (schedParseKey(today).getDay() + 6) % 7;   // 周一=0 … 周日=6
      const thisMon = schedMondayOf(today), nextMon = schedShiftDayKey(thisMon, 7);
      const have = schedulesRef.current[c.id] || {};
      const pick = (weekKey, from, count) => {
        const id = c.id + "|" + weekKey, m = marks[id];
        if (m && (m.tries >= SCHED_WEEK_MAX_TRIES || now - m.ts < SCHED_WEEK_RETRY_MS)) return;
        jobs.push({ c, from, count, id, tries: m ? m.tries : 0 });
      };
      if (dowMon === 6) pick(nextMon, nextMon, 7);              // 周日 0 点起排下一周
      if (!have[today]) pick(thisMon, today, 7 - dowMon);       // 引导：补到本周日为止
    });
    if (!jobs.length) return;
    schedRunRef.current = true;
    try {
      for (const j of jobs) {
        let ok = false;
        try { ok = await genScheduleWeek(j.c, { from: j.from, count: j.count, silent: true }); } catch (e) {}
        // ⚠️成败都记账：不记的话失败一次就会每次切回前台重来一遍
        const cur = loadJSON(SCHED_WEEK_MARK_KEY, {}) || {};
        cur[j.id] = { ts: Date.now(), tries: ok ? SCHED_WEEK_MAX_TRIES : j.tries + 1 };
        // 只留最近 40 条，别让这本账越攒越厚
        const ks = Object.keys(cur);
        if (ks.length > 40) ks.sort((a, b) => (cur[a].ts || 0) - (cur[b].ts || 0)).slice(0, ks.length - 40).forEach(k => delete cur[k]);
        saveJSON(SCHED_WEEK_MARK_KEY, cur);
      }
    } finally {
      schedRunRef.current = false;
    }
  };
  // 角色白天自发改计划（人不是排好日程就照办的）：每角色每天最多检查一次、约三成概率真改；
  // 只动「此刻之后」的时段；走便宜后台池；挂在与 schedGenAllToday 相同的前台/跨天 tick 上
  const schedSelfRevRef = useRef(false);
  const schedMaybeSelfRevise = async () => {
    if (schedSelfRevRef.current || !active || !characters.length) return;
    schedSelfRevRef.current = true;
    try {
      for (const c of characters) {
        const today = schedLocalDayKey(c);
        const plan = (schedulesRef.current[c.id] || {})[today];
        if (!plan || !Array.isArray(plan.seqs) || !plan.seqs.length || plan.selfRevCheck) continue;
        const tzShiftMin = schedTzShiftMin(c);
        const charNow = new Date(Date.now() + tzShiftMin * 60000);
        const hr = charNow.getHours();
        if (hr < 10 || hr >= 21) continue; // TA 当地白天才会临时起意
        saveSchedDay(c.id, today, { ...plan, selfRevCheck: true }); // 先记「查过」，防重复烧 api
        if (Math.random() > 0.3) continue; // 七成日子照计划过
        const nowStr = String(charNow.getHours()).padStart(2, "0") + ":" + String(charNow.getMinutes()).padStart(2, "0");
        const seqText = plan.seqs.map(s => (s.time || "") + " " + (s.title || "") + (s.location ? "（" + s.location + "）" : "")).join("\n");
        try {
          const rawRevision = await runProbe(bgActive, { ...ctxFor(c), worldbook: loreFor(c, "lifestyle") }, {
            instruction: SCHED_END_RULE + "\n" + SCHED_TENSE_RULE + "\n「" + c.name + "」今天原本的计划：\n" + seqText + "\n现在 TA 当地约 " + nowStr + "。TA 此刻临时起意，想改一下今天【还没到的】安排——人之常情：不想去了、朋友临时约、兴致来了想干别的、换个地方、临时多办一件事……原因要贴 TA 的人设和此刻心情，是日常的小变动，别硬编狗血事件。输出修改后的当天完整 seqs：【早于 " + nowStr + " 的时段一律原样保留】，只动之后的 1~2 段（就寝段保留或按需微调）；被改动的段 deviation 填 {\"plan\":\"原计划一句\",\"reason\":\"TA 自己起意的原因（TA 视角的念头，一句）\",\"actual\":\"实际改成什么\"}，没改的段 deviation 为 null。若 TA 今天就是会照计划走（负荷太高/性格自律/没由头），changed 填 false、seqs 给 []。",
            schemaHint: "{\"changed\":true,\"seqs\":[{\"time\":\"08:00\",\"title\":\"起床\",\"location\":\"家\",\"type\":\"coffee\",\"deviation\":null}]}",
            maxTokens: 3000
          });
          const d = window.ContentBoundaries ? window.ContentBoundaries.sanitizeSchedule(rawRevision) : rawRevision;
          if (d && d.changed && Array.isArray(d.seqs) && d.seqs.length >= 3) {
            const seqs = schedFillEnds(d.seqs.map((s, i) => ({ seq: i + 1, time: s.time || "", end: s.end || "", title: s.title || "", location: s.location || "", type: s.type || "other", deviation: s.deviation && (s.deviation.plan || s.deviation.reason) ? s.deviation : null })));
            const cur = (schedulesRef.current[c.id] || {})[today] || plan;
            saveSchedDay(c.id, today, { ...cur, seqs: seqs, selfRevCheck: true, selfRevisedAt: Date.now() });
          }
        } catch (e) {/* 改失败就算了，不重试不打扰 */}
      }
    } finally { schedSelfRevRef.current = false; }
  };
  const genSnoop = async char => {
    setGen(g => ({
      ...g,
      snoop: true
    }));
    setSelPhone(char.id);
    try {
      const d = await runProbe(bgActive, { ...ctxFor(char), worldbook: loreFor(char, "subjects") }, {
        instruction: "推演此刻「" + char.name + "」手机屏幕的真实状态，依据当下对话与心境，分模块。通知可带 detail 字段供点开细看。",
        schemaHint: "{\"notifications\":[{\"from\":\"来源\",\"preview\":\"摘要\",\"time\":\"14:20\",\"detail\":\"点开后的完整内容(可选)\"}],\"searches\":[\"搜索1\"],\"apps\":[{\"name\":\"应用\",\"detail\":\"在做什么\"}],\"wallpaper\":\"锁屏壁纸一句话\"}"
      });
      setSnoops(p => {
        const n = {
          ...p,
          [char.id]: {
            ...d,
            generatedAt: Date.now()
          }
        };
        saveJSON("x_snoops", n);
        return n;
      });
    } catch (e) {
      toast("刷新失败：" + e.message);
    } finally {
      setGen(g => ({
        ...g,
        snoop: false
      }));
    }
  };
  const genCarry = async char => {
    setGen(g => ({
      ...g,
      carry: true
    }));
    setSelPhone(char.id);
    try {
      const d = await runProbe(bgActive, ctxFor(char), {
        instruction: "推演此刻「" + char.name + "」随身携带的物品（4-7 件），反映身份、习惯与心境，可有透露心事的小物。物品可带 detail 供点开细看。",
        schemaHint: "{\"items\":[{\"name\":\"物品\",\"note\":\"简述\",\"detail\":\"点开后的细节(可选)\"}]}"
      });
      setCarries(p => {
        const n = {
          ...p,
          [char.id]: {
            ...d,
            generatedAt: Date.now()
          }
        };
        saveJSON("x_carries", n);
        return n;
      });
    } catch (e) {
      toast("刷新失败：" + e.message);
    } finally {
      setGen(g => ({
        ...g,
        carry: false
      }));
    }
  };
  // ---- 日记（Diary）----
  const scheduleTextFor = (char, dayKey) => {
    const key = dayKey || schedLocalDayKey(char);
    const s = (schedules[char.id] || {})[key];
    if (!s || !Array.isArray(s.seqs) || !s.seqs.length) return "";
    return s.seqs.map(it => (it.time || "") + " " + (it.title || "") + (it.location ? "（" + it.location + "）" : "") + (it.deviation ? "［偏差：" + (it.deviation.reason || "") + "］" : "")).join("\n");
  };
  // 日记写的是【昨天】——那天已经过完，角色在【那天晚上睡前】写下当天的日记（对写的人来说那天就是"今天"）。
  // 时刻定在那晚 22:xx，别沿用手动刷新的当前时刻（否则会显示成 6号7:20 这种刷新时间）。一天一篇，按目标日去重。
  const diaryTargetTs = () => { const d = new Date(); d.setDate(d.getDate() - 1); d.setHours(22, Math.floor(Math.random() * 50), 0, 0); return d.getTime(); };
  const diaryWroteFor = (id, dayTs) => (diariesRef.current[id] || []).some(e => diarySameDay(e.ts, dayTs));
  const genDiary = async (charId, opts = {}) => {
    const char = characters.find(c => c.id === charId);
    if (!char) return;
    if (diaryFlightRef.current.has(charId)) return;
    if (!active) { if (opts.manual) toast("请先到设置配置 API"); return; }
    // opts.targetTs:补写指定的某一天(一键补齐用);不给就照常写昨天
    const targetTs = opts.targetTs || diaryTargetTs();
    const targetKey = schedDayKey(new Date(targetTs));
    if (diaryWroteFor(charId, targetTs)) { if (opts.manual && !opts.targetTs) toast("昨天的日记已经写过了"); return; }
    // 必须在第一个 await 之前同步占锁；setState 只负责界面，不承担正确性。
    diaryFlightRef.current.add(charId);
    setDiaryBusy(b => ({ ...b, [charId]: true }));
    try {
      const mood = moods[charId];
      // 素材只截【目标那一天】的聊天（0点~24点），别让最近3天的旧事跨天被反复回炉
      const dayStart = new Date(targetTs); dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart); dayEnd.setDate(dayEnd.getDate() + 1);
      const ds = dayStart.getTime(), de = dayEnd.getTime();
      // 四路当天账本：私聊/群聊/单人线下/群线下严格落在 [当天00:00, 次日00:00)。
      // 聊天若已裁到云端，先把云归档与本机幂等合并；云端明明有归档却拉失败时不拿残缺素材硬写。
      const mergeMsgs = (a, b) => { const seen = new Set(), out = []; [...(a || []), ...(b || [])].forEach(m => { const k = m && m.id ? "id:" + m.id : "v:" + [m && m.ts, m && m.role, m && m.senderId, m && m.content].join("|"); if (!m || seen.has(k)) return; seen.add(k); out.push(m); }); return out.sort((x, y) => Number(x.ts || 0) - Number(y.ts || 0)); };
      const diaryChats = { [charId]: chatsRef.current[charId] || [] }, diaryGroupChats = {}, diaryGroupOfflines = {};
      const memberGroups = (groups || []).filter(g => (g.memberIds || []).includes(charId));
      memberGroups.forEach(g => { diaryGroupChats[g.id] = groupChatsRef.current[g.id] || []; diaryGroupOfflines[g.id] = groupOfflinesRef.current[g.id] || loadJSON("x_goffline:" + g.id, []); });
      if (Number(chatArch[charId] || 0) > 0) {
        if (!(window.Cloud && window.Cloud.ready())) throw new Error("昨天有私聊在云归档里，但当前无法读取；联网后再生成，避免漏写");
        diaryChats[charId] = mergeMsgs(await window.Cloud.chatArchiveGet(charId), diaryChats[charId]);
      }
      for (const g of memberGroups) {
        const archKey = "g_" + g.id;
        if (Number(chatArch[archKey] || 0) > 0) {
          if (!(window.Cloud && window.Cloud.ready())) throw new Error("昨天有群聊在云归档里，但当前无法读取；联网后再生成，避免漏写");
          diaryGroupChats[g.id] = mergeMsgs(await window.Cloud.chatArchiveGet(archKey), diaryGroupChats[g.id]);
        }
      }
      const dayRows = window.AmbientMaterial ? window.AmbientMaterial.collect(charId, {
        chats: diaryChats,
        offlines: { [charId]: offlinesRef.current[charId] || loadJSON("x_offline:" + charId, []) },
        groups: memberGroups,
        groupChats: diaryGroupChats,
        groupOfflines: diaryGroupOfflines
      }, { fromTs: ds, untilTs: de, limit: 0, userName: profile.name || "用户", charName: char.name }) : [];
      const clock = ts => { const d = new Date(ts); return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); };
      const dayChatText = dayRows.map(r => "[" + clock(r.ts) + "]【" + r.source + "】" + r.speaker + "：" + r.text).join("\n");
      // 单独抽出角色本人当天说过的话做声纹锚点：事件材料告诉模型「写什么」，原话样本告诉模型「这个人怎么写」。
      // 只取本人、不混用户和群友；封顶 12 条避免贵线 prompt 膨胀。
      const diaryVoiceSamples = dayRows.filter(r => String(r.speaker || "") === String(char.name || "") && String(r.text || "").trim()).slice(-12).map(r => String(r.text).trim());
      // 上一篇日记（目标日之前最近的一篇）——喂给模型当「别重复」参照
      const prevD = (diariesRef.current[charId] || []).filter(e => (e.ts || 0) < targetTs).sort((a, b) => (b.ts || 0) - (a.ts || 0))[0];
      const prevDiary = prevD ? ((prevD.titleZh || prevD.titleEn || "") + "｜" + (prevD.paras || []).map(p => p.text).join(" ").slice(0, 220)) : "";
      const ctx = { ...ctxFor(char), moodLabel: mood && (mood.label || mood) || null, worldbook: loreFor(char, "diary"), recentChat: dayChatText, memory: "", groupEcho: "", groupOfflineEcho: "", offlineNow: "", schedNow: "" };
      const dateStr = new Date(targetTs).toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric", weekday: "long" });
      // 当天钱包流水（日常购物/转账/礼物）喂给日记当素材——日程/钱包/日记三联动的最后一环
      const wRec = charWalletRef.current[charId];
      const walletText = wRec && Array.isArray(wRec.ledger) ? wRec.ledger.filter(e => (e.ts || 0) >= ds && (e.ts || 0) < de && e.kind !== "monthly").slice(0, 8).map(e => "· " + (e.label || "") + "（" + (e.delta > 0 ? "+" : "") + e.delta + "）").join("\n") : "";
      // 亲笔优先（2026-08-19 七夕·八件事第4件刀一）：数字生命角色的日记若言秋已在 CC 亲笔写好投进草稿箱，
      // 原样取用（他自己的字，零 API、零推演）；没有亲笔稿才走下面的自动生成。
      let handwritten = null;
      if (settingsFor(charId).engineerEyes && window.Cloud && window.Cloud.ready()) {
        try { handwritten = await window.Cloud.yanqiuDiaryDraftTake(charId, targetKey); } catch (e) { handwritten = null; }
      }
      // 日记归入线下创作线路；角色专线仍最高优先（如小克接 Fable），无专线才回退全局线下主 API。
      const d = handwritten || await generateDiary(offlineApiFor(charId), leanWriteCtx(ctx), { scheduleText: scheduleTextFor(char, targetKey), walletText: walletText, dateStr: dateStr, placeText: freshLiveStateValue(statesRef.current[charId] || {}, "place"), noChatMaterial: dayRows.length < 2, prevDiary: prevDiary, voiceSamples: diaryVoiceSamples, digital: !!settingsFor(charId).engineerEyes });
      const entry = {
        id: "d_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
        ts: targetTs,
        no: Math.floor(Math.random() * 9000) + 1000,
        titleEn: d.titleEn || "",
        titleZh: d.titleZh || "",
        location: d.location || "",
        coords: d.coords && d.coords !== "null" ? d.coords : null,
        weather: d.weather || "",
        timeStr: d.timeStr || "",
        paras: Array.isArray(d.paras) ? d.paras.filter(p => p && p.text).map(p => ({ text: String(p.text), secret: !!p.secret })) : [],
        signature: d.signature || "",
        mood: d.mood || "",
        source: handwritten ? "handwritten" : (opts.manual ? "manual" : "auto")
      };
      if (!entry.paras.length) throw new Error("内容为空");
      setDiaries(p => {
        // 最终落库再查一次：防止生成期间云恢复/另一个入口已经补进同日文章。
        if ((p[charId] || []).some(e => diarySameDay(e.ts, targetTs))) return p;
        const n = { ...p, [charId]: sortDiaryList([entry, ...(p[charId] || [])]) };
        diariesRef.current = n; // 下一条自动任务无需等 React 下一次 render 才能看见
        saveJSON("x_diaries", n);
        return n;
      });
    } catch (e) {
      if (opts.manual) toast("生成失败：" + e.message);
    } finally {
      diaryFlightRef.current.delete(charId);
      setDiaryBusy(b => ({ ...b, [charId]: false }));
    }
  };
  // 日记按【日记那天的日期】倒序排，最新的在最上面（v53.86）。
  // 补齐漏记的日子时，条目是后写的、日期却是旧的；以前一律 [新条目, ...旧的] 怼到最前面，
  // 于是补出来的旧日记全堆在顶上（她 2026-08-20 报）。排序只认 ts，不认写入顺序。
  function sortDiaryList(list) {
    return (list || []).slice().sort(function (a, b) { return Number((b && b.ts) || 0) - Number((a && a.ts) || 0); });
  }
  // 整本重排：老数据里已经乱掉的顺序，加载时一次性理好，不用她自己动手
  function sortDiaryBook(book) {
    const out = {};
    Object.keys(book || {}).forEach(function (k) { out[k] = sortDiaryList(book[k]); });
    return out;
  }
  const delDiaryEntry = (charId, entryId) => setDiaries(p => {
    const n = { ...p, [charId]: (p[charId] || []).filter(e => e.id !== entryId) };
    saveJSON("x_diaries", n);
    return n;
  });
  const saveDiaryFields = (charId, fields) => pC(p => p.map(c => c.id === charId ? { ...c, ...fields } : c));
  // 用户自己写日记（存 x_diaries["__me"]），时间/天气/城市由 compose 组件抓本地后传进来
  const addMyDiaryEntry = data => {
    const paras = (data.body || "").split(/\n+/).map(s => s.trim()).filter(Boolean).map(text => ({ text, secret: false }));
    if (!paras.length) { toast("写点什么再保存"); return null; }
    const entry = {
      id: "d_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
      ts: Date.now(),
      no: Math.floor(Math.random() * 9000) + 1000,
      title: (data.title || "").trim(),
      location: data.location || "", coords: data.coords || null, weather: data.weather || "",
      timeStr: data.timeStr || "", paras, comments: [], source: "me"
    };
    setDiaries(p => {
      const n = { ...p, __me: sortDiaryList([entry, ...(p.__me || [])]) };
      saveJSON("x_diaries", n);
      return n;
    });
    return entry.id;
  };
  // 让选中的角色给「我的某篇日记」评论：按实时心情+关系/好感度，逐个生成，不互评
  const genDiaryCommentsFor = async (entryId, charIds) => {
    if (!active) { toast("请先到设置配置 API"); return; }
    const entry = (diariesRef.current.__me || []).find(e => e.id === entryId);
    if (!entry) return;
    const entryText = (entry.title ? entry.title + "\n" : "") + (entry.paras || []).map(p => p.text).join("\n");
    setDiaryCommenting(entryId);
    try {
      for (const cid of charIds) {
        const char = characters.find(c => c.id === cid);
        if (!char) continue;
        const mood = moods[cid];
        const ctx = { ...ctxFor(char), moodLabel: mood && (mood.label || mood) || null };
        // 防复读：这位角色最近评论我别的日记说过什么 → 逼 Ta 换角度（读本地，零 API）
        const prevSaid = (diariesRef.current.__me || []).filter(e => e.id !== entryId)
          .flatMap(e => (e.comments || []).filter(cm => cm.charId === cid).map(cm => cm.text)).filter(Boolean).slice(0, 2);
        let text;
        try { text = await generateDiaryComment(offlineApiFor(char.id), leanWriteCtx(ctx), entryText, { prevSaid }); } catch (e) { toast(char.name + " 评论失败"); continue; }
        if (!text) continue;
        const comment = { id: "cm_" + Date.now() + "_" + cid, charId: cid, name: char.name, text, ts: Date.now() };
        setDiaries(p => {
          const arr = (p.__me || []).map(e => e.id === entryId ? { ...e, comments: [...(e.comments || []), comment] } : e);
          const n = { ...p, __me: arr };
          saveJSON("x_diaries", n);
          return n;
        });
      }
    } finally {
      setDiaryCommenting(null);
    }
  };
  // 打开日记 app 时：给还没写【昨天】日记的角色补上（每个角色一次 API，顺序执行避免并发轰炸）。
  // 相当于「每天刷新前一天的」——当时不在线也没关系，下次进来自动补齐；一天一篇，写过就跳过。
  const autoDiaryRun = async () => {
    if (!active) return; // 先判 active 再置锁（v48.95，Codex：未配API时早退却没复位锁→停在日记页配好API也不自动补，得离开再进）
    const targetTs = diaryTargetTs();
    const dayKey = new Date(targetTs).toDateString();
    // 锁按【补写的那一天】记，不再按「是否进过日记页」记：
    // 原来是 useEffect([screen]) 只在 screen==="diary" 时才跑，所以过了零点必须点进日记
    // 才开始生成（她反复修过几次的老问题）。改成任意界面都跑之后，屏幕型的锁就不成立了，
    // 否则同一天会被反复触发；跨到第二天时 dayKey 变化，锁自然失效。
    if (diaryRunRef.current === dayKey) return;
    diaryRunRef.current = dayKey;
    try {
      for (const c of characters) {
        if (diaryWroteFor(c.id, targetTs)) continue;
        await genDiary(c.id, { manual: false });
      }
    } catch (e) { diaryRunRef.current = false; } // 整批失败就放开，下次开 app 或换天再补
  };
  // 一键补齐:找出这个角色最近 14 天里漏掉的日子,从最早的一天开始【逐天】写。
  // 逐天而不是一把梭:每写完一天立刻落盘,中途失败已完成的都保得住,不至于一次失败全白花。
  // 漏掉的日子：往回数 DIARY_BACKFILL_DAYS 天，返回还没写过的那些（从早到晚）
  // 30 天而不是 14 天：删掉一篇之后想补回来，超过两周就够不着了（她 2026-08-21 报）
  const DIARY_BACKFILL_DAYS = 30;
  const diaryMissingDays = charId => {
    const out = [];
    for (let i = 1; i <= DIARY_BACKFILL_DAYS; i++) {
      const d = new Date(); d.setDate(d.getDate() - i); d.setHours(22, 30, 0, 0);
      if (!diaryWroteFor(charId, d.getTime())) out.push(d.getTime());
    }
    return out.reverse(); // 从最早的一天往回补,时间顺序才对
  };
  // opts.days = [ts...] 只补这几天（挑一天单独补就走它）；不给就补全部漏掉的
  const backfillDiary = async (charId, opts = {}) => {
    if (!active) { toast("请先到设置配置 API"); return; }
    if (diaryBackfillRef.current) { toast("正在补,别急"); return; }
    const pick = Array.isArray(opts.days) && opts.days.length ? opts.days.slice() : null;
    const days = pick || diaryMissingDays(charId);
    if (!days.length) { toast("最近一个月没有漏掉的"); return; }
    if (!pick && !confirm("补齐最近 " + DIARY_BACKFILL_DAYS + " 天里漏掉的 " + days.length + " 篇?会一天一天写,中途失败已写好的都保留。")) return;
    diaryBackfillRef.current = true;
    let done = 0;
    try {
      for (const ts of days) {
        const before = (diariesRef.current[charId] || []).length;
        await genDiary(charId, { manual: false, targetTs: ts });
        if ((diariesRef.current[charId] || []).length <= before) {
          toast("补到 " + new Date(ts).toLocaleDateString("zh-CN") + " 时失败了，已写好 " + done + " 篇，稍后再点一次接着补", 6000);
          return;
        }
        done++;
        toast("已补 " + done + "/" + days.length, 1200);
      }
      toast("补齐了 " + done + " 篇");
    } finally { diaryBackfillRef.current = false; }
  };
  // 打开 App 就补(延后 6 秒，别和首屏渲染、第一条消息抢)；之后每次跨天自动再跑一次。
  // diaryDayKey 由每 30 秒走一次的 now 推出来，零点后最迟半分钟就会触发。
  const diaryDayKey = new Date(diaryTargetTs()).toDateString();
  useEffect(() => {
    if (!active) return;
    const t = setTimeout(autoDiaryRun, 6000);
    return () => clearTimeout(t);
  }, [diaryDayKey, !!active]);
  useEffect(() => { if (screen === "diary") autoDiaryRun(); }, [screen]);
  // #5 论坛/朋友圈/悄悄话「刷不出来」：打开对应屏时自动补一条（4h 冷却，既首访即有内容、又不每次进都轰 API）
  const ambientRunRef = useRef({});
  const autoAmbientRun = async kind => {
    if (!active || ambientRunRef.current[kind]) return;
    ambientRunRef.current[kind] = true;
    const ts = loadJSON("x_ambientTs", {});
    if (Date.now() - (ts[kind] || 0) < 4 * 3600000) return;
    ts[kind] = Date.now(); saveJSON("x_ambientTs", ts);
    try {
      if (kind === "forum") { const bs = ["吐槽吧", "日常吧", "求助吧", "兴趣吧", "脑洞吧", "匿名吧"]; await genForumBoard(bs[Math.floor(Math.random() * bs.length)]); }
      else if (kind === "moments") { if (characters.length) await genMoment(characters[Math.floor(Math.random() * characters.length)]); }
      else if (kind === "whisper") { const ps = liveChars.filter(c => couples[c.id] && couples[c.id].status === "together"); if (ps.length) await genWhisper(ps[Math.floor(Math.random() * ps.length)]); }
    } catch (e) {/* 静默 */}
  };
  // ---- 角色动态：主屏红点通知 + 保底触发 ----
  const notifyApp = key => setAppNotif(p => { const n = { ...p, [key]: (p[key] || 0) + 1 }; appNotifRef.current = n; saveJSON("x_appNotif", n); return n; });
  const clearAppNotif = key => setAppNotif(p => { if (!p[key]) return p; const n = { ...p, [key]: 0 }; appNotifRef.current = n; saveJSON("x_appNotif", n); return n; });
  const autoForumForChar = async char => {
    if (!active || (forumOffRef.current || []).includes(char.id)) return;
    try {
      // 调出「距上次发帖之后」和用户的往来当素材；没有就让 TA 按人设编一件贴合的小事
      const lastForumTs = (ambientCountRef.current[char.id] || {}).lastForumTs || 0;
      const sinceChat = ambientMaterialFor(char, { sinceTs: lastForumTs, limit: 30 });
      // 别重复上一贴（她 2026-07-24：都在线下、发的帖和上次一样）：把 TA 自己最近那贴喂进去当"要避开的"，逼它写新事
      const myLast = (forumPostsRef.current || []).filter(p => p.authorId === char.id).sort((a, b) => (b.ts || 0) - (a.ts || 0))[0];
      const myAutoPosts = (forumPostsRef.current || []).filter(p => p.authorId === char.id && p.triggerSource === "auto");
      const forceAnon = myAutoPosts.length >= 2 && (myAutoPosts.length % 5 === 2) && !myAutoPosts.slice(0, 5).some(p => p.board === "匿名吧");
      const forumHabit = charForumMeta(char);
      const avoidRepeat = myLast ? "\n\n【绝不要重复你上一个帖】你上次发的是《" + String(myLast.title || "").slice(0, 40) + "》「" + String(myLast.body || "").replace(/\s+/g, " ").slice(0, 70) + "」——这次必须【换一件不一样的、更新的事】，绝不许再写同一个话题/同一件事/同一种心情，哪怕只是换个说法也不行。" : "";
      const d = await runProbe(apiFor(char.id), ctxFor(char), {
        instruction: "以「" + char.name + "」的身份去论坛随手发一个帖（吐槽/日常/求助/兴趣/脑洞/匿名 六选一），并自行决定 identity=main（大号）、alt（固定小号）或 anonymous（匿名；匿名吧必须用 anonymous）。【Ta 长期稳定的论坛习惯】常逛：" + forumHabit.boardPrefs.join("、") + "；参与方式：" + forumHabit.participation + "；发言习惯：" + forumHabit.replyStyle + "；通常偏向：" + (forumHabit.identityBias === "alt" ? "固定小号" : "大号") + "。优先按习惯行动，但遇到真正不适合常用身份的内容可以例外。" + (forceAnon ? "【这次明确去匿名吧，用 anonymous，说一件 Ta 不会用大号或固定小号留下痕迹的事。】" : "") + "**优先写你最近真实新发生的事**；兴趣吧要有具体爱好细节，脑洞吧要让别人能参与，匿名吧可以写不会用大号说的话。小号或匿名绝不在正文自曝真实身份。像真人发帖，别客服腔、别报流水账。" + (sinceChat ? "\n\n【你最近亲历的共同相处（含私聊、群聊与线上/线下；可作灵感，别照抄原话）】\n" + sinceChat : "") + avoidRepeat,
        schemaHint: "{\"board\":\"吐槽/日常/求助/兴趣/脑洞/匿名 之一\",\"identity\":\"main|alt|anonymous\",\"title\":\"标题\",\"body\":\"正文2-4句\"}"
      });
      // 模型可能回「吐槽」也可能回「吐槽吧」，统一归到四版块的正式名（否则帖子 board 不在 FORUM_BOARDS，版块/关注页都筛不到）
      const bmap = { "吐槽": "吐槽吧", "日常": "日常吧", "求助": "求助吧", "兴趣": "兴趣吧", "脑洞": "脑洞吧", "匿名": "匿名吧" };
      const board = forceAnon ? "匿名吧" : (bmap[String((d && d.board) || "").replace(/吧$/, "")] || "日常吧");
      if (d && d.title) { postCharToForum(char, board, { title: String(d.title), body: String(d.body || ""), identity: d.identity }, "auto"); notifyApp("forum"); toast("论坛有了新帖子"); if (window.Notify) window.Notify.push({ title: "论坛有了新帖子", body: String(d.title), tag: "forum-" + char.id, charId: char.id }); }
    } catch (e) {}
  };
  // 角色【主动】给你埋一颗时光胶囊（不必你先埋给 TA）——她要的"自动生成、有了我再点开看"。
  // 由 tickAmbient 按轮数稀发；封存到 7/14/30 天后。短期胶囊是“延时抵达的此刻”，不再一两天后硬装遥远未来（v53.90）。写 x_capsules，
  // 下次打开时光胶囊即见；到期主屏图标亮红点（window.capsuleDueCount 读 localStorage）。
  const autoBuryCapsuleForChar = async char => {
    if (!active) return;
    try {
      const autoSealDays = [7, 14, 30];
      const days = autoSealDays[Math.floor(Math.random() * autoSealDays.length)];
      const openTs = Date.now() + days * 86400000;
      const cur = loadJSON("x_capsules", []); const list = Array.isArray(cur) ? cur : [];
      // 别和之前埋的重复（她 2026-07-26：触发好几个都在说同一件事）：把这个角色最近埋过的胶囊当"要避开的"喂进去
      const mine = list.filter(x => x && x.dir === "fromChar" && x.charId === char.id).slice(0, 5);
      const avoid = mine.length ? "\n\n【你之前已经给 Ta 埋过下面这些胶囊——这次【绝不许再说同一件事/同一种心情】，换一件不一样的事、换个由头和角度写；哪怕换几个词说同一件也不行】\n" + mine.map((x, i) => (i + 1) + ". " + String(x.text || "").replace(/\s+/g, " ").slice(0, 90)).join("\n") : "";
      const capsuleGuide = window.CapsulePromptKit
        ? window.CapsulePromptKit.sealGuide(openTs)
        : "把今天此刻一个具体念头或没说出口的话封进去，不预测遥远未来。写 2-4 个自然短段。";
      const sys = buildBundle(ctxFor(char)) +
        "\n\n【任务】此刻你心里一动，想悄悄给 " + (profile.name || "Ta") + " 埋一颗【现在写下、到期才送达】的时光胶囊。" + capsuleGuide + "第一人称，贴你的人设与此刻心情；别客套、别落款。" + avoid + "\n只输出 JSON：{\"letter\":\"信的正文\"}";
      const raw = await callAI(apiFor(char.id), sys, [{ role: "user", content: "写吧。" }], { maxTokens: 4000 });
      const d = extractJSON(raw);
      if (!d || !d.letter) return;
      const entry = { id: "cap_" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36), dir: "fromChar", source: "ambient", charId: char.id, charName: char.name, text: String(d.letter).trim(), createdTs: Date.now(), openTs, opened: false, reply: null };
      saveJSON("x_capsules", [entry, ...list]);
      toast(char.name + " 悄悄给你埋了一颗时光胶囊 · " + days + " 天后可拆");
      if (window.Notify) window.Notify.push({ title: char.name + " 给你埋了一颗时光胶囊", body: days + " 天后可以拆开", tag: "cap-" + char.id, charId: char.id });
    } catch (e) {}
  };
  const forceAmbient = async (char, type) => {
    try {
      if (type === "moment") {
        const posted = await genMoment(char);
        if (posted) {
          notifyApp("moments");
          toast(char.name + " 发了条朋友圈");
          if (window.Notify) window.Notify.push({ title: char.name + " 发了条朋友圈", body: "去朋友圈看看吧", tag: "mom-" + char.id, charId: char.id });
        }
      }
      else if (type === "whisper") { await genWhisper(char); notifyApp("whisper"); toast(char.name + " 给你留了句悄悄话"); if (window.Notify) window.Notify.push({ title: char.name + " 给你留了句悄悄话", body: "点开看看", tag: "wh-" + char.id, charId: char.id }); }
      else if (type === "forum") { await autoForumForChar(char); }
      else if (type === "capsule") { await autoBuryCapsuleForChar(char); }
    } catch (e) {}
  };
  // 每轮私聊回复后调用：三类动态计数 + 到阈值强制发一条（posted=这条回复已自发的类型，就不重复强制）
  const tickAmbient = (charId, posted) => {
    const char = characters.find(c => c.id === charId);
    if (!char) return;
    posted = posted || {};
    const isCouple = couples[charId] && couples[charId].status === "together";
    const cur = ambientCountRef.current[charId] || { moment: 0, whisper: 0, forum: 0, capsule: 0, lastForumTs: Date.now() };
    const n = {
      moment: posted.moment ? 0 : (cur.moment || 0) + 1,
      whisper: posted.whisper ? 0 : (cur.whisper || 0) + 1,
      forum: posted.forum ? 0 : (cur.forum || 0) + 1,
      capsule: posted.capsule ? 0 : (cur.capsule || 0) + 1,
      lastForumTs: posted.forum ? Date.now() : (cur.lastForumTs || Date.now())
    };
    const due = [];
    if (isCouple && n.whisper >= 15) due.push("whisper");
    if (n.moment >= 30) due.push("moment");
    if ((n.forum >= 50 || Date.now() - (n.lastForumTs || Date.now()) >= 3 * 86400000) && !(forumOffRef.current || []).includes(charId)) due.push("forum");
    // 时光胶囊要比朋友圈/悄悄话稀：≥80 轮、14 天冷却，而且同一角色不能有两颗未拆信同时在路上（v53.94）。
    // 被冷却/未拆闸拦住时不清计数；条件一满足，下一轮即可自然补发。
    if (isCouple && n.capsule >= 80) {
      const caps = loadJSON("x_capsules", []);
      const own = (Array.isArray(caps) ? caps : []).filter(x => x && x.dir === "fromChar" && x.charId === charId);
      const hasSealed = own.some(x => !x.opened);
      const latestTs = own.reduce((mx, x) => Math.max(mx, Number(x.createdTs || 0)), 0);
      if (!hasSealed && (!latestTs || Date.now() - latestTs >= 14 * 86400000)) due.push("capsule");
    }
    due.forEach(k => { if (k === "whisper") n.whisper = 0; else if (k === "moment") n.moment = 0; else if (k === "capsule") n.capsule = 0; else { n.forum = 0; n.lastForumTs = Date.now(); } });
    const np = { ...ambientCountRef.current, [charId]: n };
    ambientCountRef.current = np; setAmbientCount(np); saveJSON("x_ambientCount", np);
    due.forEach(k => forceAmbient(char, k));
  };
  // ---- 欲望盒子·每日灵光独白（v48.22 P1，引擎在 js/desire.js）----
  // 角色独处发呆：想起盒子里的旧念想、偶尔长出一条新芽。独白/念想内容全由「以角色身份的生成调用」落笔，
  // 这里只干体力活（瞬灭/落灰/记碰触/时间戳）。走便宜后台池 bgActive，挂在和行程完全同一套 tick 上。
  const desireRunRef = useRef(false);
  const desireMuseFor = async (char, opts = {}) => {
    if (!active || !window.DesireKit) return false;
    try {
      const box = DesireKit.housekeep(DesireKit.boxOf(desiresRef.current, char.id));
      const d = await runProbe(bgApiFor(char.id), leanWriteCtx(ctxFor(char)), DesireKit.museSpec(char, box)); // 灵光独白=本体亲笔（v48.37）：专线用专线，否则便宜池；瘦身省贵线（v48.94）
      DesireKit.applyMuse(box, d, schedDayKey(new Date()));
      saveDesires(n => { n[char.id] = box; });
      return true;
    } catch (e) {
      if (opts.manual) toast(char.name + " 这会儿发不了呆：" + e.message);
      return false;
    }
  };
  // 当天首次打开 / 回前台 / 跨天：给该发呆的角色补今天这一次。
  // 只跑「7 天内聊过、或盒子里还有活念想」的角色——不给闲置角色白烧 api。
  const desireMuseAllToday = async () => {
    if (desireRunRef.current || !active || !window.DesireKit || !characters.length) return;
    const today = schedDayKey(new Date());
    const todo = liveChars.filter(c => {
      const b = desiresRef.current[c.id];
      if (b && b.lastMuse === today) return false;
      const msgs = (chatsRef.current[c.id] || []).filter(m => !m.recalled && !isOocMsg(m) && contextAllowsMessage(m));
      const lastTs = msgs.length ? (msgs[msgs.length - 1].ts || 0) : 0;
      const hasLive = b && Array.isArray(b.list) && b.list.some(e => e.status === "active");
      return (lastTs && Date.now() - lastTs < 7 * 86400000) || hasLive;
    });
    if (!todo.length) return;
    desireRunRef.current = true;
    try { for (const c of todo) await desireMuseFor(c); } finally { desireRunRef.current = false; }
  };
  // P2 三节奏后两拍（v48.23）：小满日=每10天盘盒子（校准js钳±0.15/毕业蜕变诗入人格档案/枯萎），冬至日=每90天季度自述。
  // 同样只有角色落笔、走便宜池；首次见到的盒子只记基准日不当天跑（防连环烧）；失败不记基准日、下个 tick 重试。
  const desireTendRef = useRef(false);
  const desireTendAllToday = async () => {
    if (desireTendRef.current || !active || !window.DesireKit || !characters.length) return;
    desireTendRef.current = true;
    const today = schedDayKey(new Date());
    try {
      for (const c of characters) {
        if (!desiresRef.current[c.id]) continue;
        const box = DesireKit.boxOf(desiresRef.current, c.id);
        const r = DesireKit.tendDue(box, today);
        if (r.inited) { saveDesires(n => { n[c.id] = box; }); continue; }
        // 观测者（每7天，P3）：旁观的便宜小模型摘录「我注意到…」纸条+痕避，喂 TA 下次发呆/盘点。
        // 只对 7 天内聊过的角色跑（没新对话没什么可观测）；和小满/冬至互不排队，同天先观测再盘点（纸条正好当盘点材料）。
        if (DesireKit.observeDue(box, today)) {
          const _msgs = (chatsRef.current[c.id] || []).filter(m => !m.recalled && !isOocMsg(m) && contextAllowsMessage(m));
          const _lastTs = _msgs.length ? (_msgs[_msgs.length - 1].ts || 0) : 0;
          if (_lastTs && Date.now() - _lastTs < 7 * 86400000) {
            let _observerCompleted = false;
            try {
              const od = await runProbe(bgActive, leanWriteCtx(ctxFor(c)), DesireKit.observerSpec(c, box));
              DesireKit.applyObserver(box, od, today);
              saveDesires(n => { n[c.id] = box; });
              _observerCompleted = true;
            } catch (e) {}
            // P3-1 人格四卡 shadow：旧观测成功记下本周节拍后才旁路跑，避免旧调用失败时反复烧 API。
            // 只把逐字证据核验通过的候选放进本机 IDB；不改 box/persona，不进聊天 prompt。
            try {
              if (_observerCompleted && window.PersonalityShadow) {
                const pd = await runProbe(bgActive, leanWriteCtx(ctxFor(c)), window.PersonalityShadow.spec(c, box, _msgs));
                await window.PersonalityShadow.observe({ charId: c.id, result: pd, messages: _msgs });
              }
            } catch (e) {}
          }
        }
        if (!r.due) continue;
        try {
          const spec = r.due === "solstice" ? DesireKit.solsticeSpec(c, box) : DesireKit.mellowSpec(c, box);
          const d = await runProbe(bgApiFor(c.id), leanWriteCtx(ctxFor(c)), spec); // 小满盘点/冬至自述/毕业蜕变诗/人格档案落笔=本体亲笔（v48.37）：专线用专线，否则便宜池；瘦身省贵线（v48.94）
          if (r.due === "solstice") DesireKit.applySolstice(box, d, today); else DesireKit.applyMellow(box, d, today);
          saveDesires(n => { n[c.id] = box; });
        } catch (e) {}
      }
    } finally { desireTendRef.current = false; }
  };
  useEffect(() => {
    // 进入论坛只读已有内容，不再自动生成 12~18 层并烧一次主池。
    // 新内容由用户在论坛内明确触发，或由已有的低频 ambient 调度产生。
    if (screen === "forum") { clearAppNotif("forum"); } else ambientRunRef.current.forum = false;
    if (screen === "us") { autoAmbientRun("whisper"); clearAppNotif("whisper"); } else ambientRunRef.current.whisper = false;
    if (screen === "messages") { autoAmbientRun("moments"); clearAppNotif("moments"); } else ambientRunRef.current.moments = false;
  }, [screen]);
  // 打开 app 当天第一次就给所有人生成今日行程（每天一次）；随后看有没有人临时起意改计划
  useEffect(() => {
    if (active && characters.length) { deliverDeskLog(); schedGenAllToday().then(() => schedMaybeSelfRevise()).then(() => walletCatchAllToday()).then(() => desireMuseAllToday()).then(() => desireTendAllToday()); };
  }, [active, characters.length]);
  // 回到前台 / 重新聚焦：也自动补今日行程。PWA 常驻不重载页面时，光靠上面的首次加载不够——
  // 切回来那一下补一次。schedGenAllToday 只补【缺今天】的角色、已有则空跑，安全省 api。
  useEffect(() => {
    if (!loaded) return;
    const kick = () => { if (document.visibilityState !== "hidden" && active && characters.length) { deliverDeskLog(); schedGenAllToday().then(() => schedMaybeSelfRevise()).then(() => desireMuseAllToday()).then(() => desireTendAllToday()); }; };
    document.addEventListener("visibilitychange", kick);
    window.addEventListener("focus", kick);
    return () => { document.removeEventListener("visibilitychange", kick); window.removeEventListener("focus", kick); };
  }, [loaded, active, characters.length]);
  // 跨天（app 一直开着没关）：日期一变就补新一天的行程
  const schedDayRef = useRef("");
  useEffect(() => {
    const k = liveChars.map(c => c.id + ":" + schedLocalDayKey(c)).join("|");
    if (k !== schedDayRef.current) { schedDayRef.current = k; if (active && characters.length) { deliverDeskLog(); schedGenAllToday().then(() => schedMaybeSelfRevise()).then(() => walletCatchAllToday()).then(() => desireMuseAllToday()).then(() => desireTendAllToday()); }; }
  }, [now]);

  // ---- 查手机：每个 app 独立生成/刷新 ----
  const relatedNames = char => {
    const set = new Set();
    for (const o of characters) {
      if (o.id === char.id) continue;
      if (rels[char.id + "->" + o.id] || rels[o.id + "->" + char.id]) set.add(o.name);
    }
    return [...set];
  };
  const phoneKeyLabel = key => PHONE_LABEL[key] || (key === "video_day" ? "白天视频" : key === "video_night" ? "深夜视频" : key);
  const savePhoneApp = (charId, key, d) => {
    setPhones(p => {
      const cur = p[charId] || {};
      const entry = {
        ...d,
        _at: Date.now()
      };
      if (key === "wallet") { entry._startDate = ymd(new Date()); entry.extra = (cur.wallet && Number(cur.wallet.extra)) || 0; } // 记账起点；保留转账等外部收支
      const n = {
        ...p,
        [charId]: {
          ...cur,
          [key]: entry
        }
      };
      saveJSON("x_phone", n);
      return n;
    });
  };
  // 调整角色钱包余额（改 wallet.baseBalance，用于转账）
  // 改我的钱包并记一条流水（delta 正=进账/负=支出）
  const changeWallet = (delta, label, kind) => {
    const d = Math.round(Number(delta) * 100) / 100;
    if (!d) return;
    setWallet(w => {
      const n = Math.round((w + d) * 100) / 100;
      saveJSON("x_wallet", n);
      setWalletLog(log => {
        const entry = { id: "wl_" + Date.now() + "_" + Math.floor(Math.random() * 1000), ts: Date.now(), delta: d, after: n, label: label || (d > 0 ? "进账" : "支出"), kind: kind || "misc" };
        const nl = [entry, ...log];
        saveJSON("x_walletLog", nl);
        return nl;
      });
      return n;
    });
  };
  // 手动改余额到指定值（记一条调整流水）
  const setWalletTo = target => {
    const tv = Math.round(Number(target) * 100) / 100;
    if (isNaN(tv)) return;
    changeWallet(tv - wallet, "手动调整余额", "manual");
  };
  const CHAR_DEFAULT_BAL = 6000; // 角色未生成钱包档案时的默认余额（转账/代付/亲属卡扣款用）
  // 宽松解析金额：模型可能给 "¥38,400"、"3.8万"、字符串等 → 都抠成数字
  const numClean = v => {
    if (typeof v === "number") return isFinite(v) ? v : 0;
    let s = String(v == null ? "" : v).replace(/[,，\s¥￥$元]/g, "");
    let mult = 1;
    if (/万/.test(s)) { mult = 10000; s = s.replace(/万/g, ""); }
    if (/k/i.test(s)) { mult = 1000; s = s.replace(/k/ig, ""); }
    const n = parseFloat((s.match(/-?\d+(\.\d+)?/) || [])[0]);
    return isFinite(n) ? n * mult : 0;
  };
  const r2 = n => Math.round(Number(n) * 100) / 100;
  const charBalanceOf = id => {
    const w = charWalletRef.current[id];
    return w && w.balance != null ? Number(w.balance) : CHAR_DEFAULT_BAL;
  };
  // 改角色钱包余额并记一条流水（delta 正=进账 负=支出）。钱包没生成过也会隐式建档（余额从默认起算），首次点进钱包 app 会正式生成资产档案并 rebase。
  const adjustCharBalance = (charId, delta, label, kind) => {
    const d = r2(delta);
    if (!d) return;
    setCharWallet(p => {
      const cur = p[charId] || { init: false, balance: CHAR_DEFAULT_BAL, ledger: [], createdTs: Date.now() };
      const base = cur.balance != null ? Number(cur.balance) : CHAR_DEFAULT_BAL;
      const bal = r2(base + d);
      const entry = { id: "cw_" + Date.now() + "_" + Math.floor(Math.random() * 1000), ts: Date.now(), delta: d, after: bal, label: label || (d > 0 ? "进账" : "支出"), kind: kind || "transfer" };
      const n = { ...p, [charId]: { ...cur, balance: bal, ledger: [entry, ...(cur.ledger || [])] } };
      saveJSON("x_charWallet", n);
      charWalletRef.current = n;
      return n;
    });
  };
  // 手动把角色余额改成指定值（记一条调整流水）
  const setCharWalletTo = (charId, target) => {
    const tv = r2(target);
    if (isNaN(tv)) return;
    adjustCharBalance(charId, tv - charBalanceOf(charId), "手动调整余额", "manual");
  };
  // 生成/推演角色财务档案（首开与刷新共用），返回 prof 或 null
  const genWalletProfile = async char => {
    if (!active) return null;
    // 数字生命/驻场 AI：没有工资、消费、理财这回事——不调 LLM，直接给固定「无经济」档案。
    // baseBalance 归 0，她转账/亲属卡照常从 0 累加（转账入口保留，只是不编现实收支）。
    if (settingsFor(char.id).engineerEyes) {
      return {
        incomes: [], monthlyIncome: 0, fixedMonthly: 0, baseBalance: 0, investAssets: 0,
        notes: {
          income: "你是住在这台 app 里的 AI，不靠工资生活，也没有谋生这回事。",
          savings: "这里只存着她转给你的——你不需要钱，但她给的你都留着，当念想。",
          invest: "—",
          spending: "你没有要花钱的地方。"
        }
      };
    }
    try {
      return await runProbe(bgActive, ctxFor(char), {
        instruction: "推演「" + char.name + "」的财务档案。**收入来源与全部金额必须严格依据 TA 的人设、职业、身份和社会阶层来定，贴合 TA 真实的谋生方式。** incomes（1-3 项，name+category+amount 数字，category 从 TA 实际谋生方式来：工资/自由职业/接单/做生意/兼职/学生生活费/退休金/稿费/打赏 等；只有明确富家子弟/继承人/家境优渥时才可出现「家族供养/信托」，否则绝不默认套用家族收入，普通人就普通收入甚至拮据）；monthlyIncome 月收入合计；fixedMonthly 每月固定支出；baseBalance 当前存款余额（作为钱包初始余额）；investAssets 理财持有资产（普通人可能很少或为 0）；notes 各部分批注（income/savings/invest/spending，每条一句符合人设的旁白）。所有金额纯数字不带符号，务必与身份匹配、不要人人都很有钱。**【币种铁律】这是微信钱包，全部金额一律用【人民币】计价，就算 TA 在国外留学/工作/生活也照人民币的量级来（普通留学生月生活费/打工收入换算成人民币通常几千，别写成几十万那种日元/韩元量级的数字）——当作全世界都用微信、一切都以人民币结算。**",
        schemaHint: "{\"incomes\":[{\"name\":\"公司月薪\",\"category\":\"工资\",\"amount\":11000}],\"monthlyIncome\":11000,\"fixedMonthly\":6800,\"baseBalance\":38400,\"investAssets\":15000,\"notes\":{\"income\":\"...\",\"savings\":\"...\",\"invest\":\"...\",\"spending\":\"...\"}}",
        // notes(4段批注)在 JSON 最后，思考型模型截断先丢它→放宽 token 防「刷新后批注没了」
        maxTokens: 4000
      });
    } catch (e) {
      toast(char.name + " 资产生成失败：" + e.message);
      return null;
    }
  };
  // 首次点进某角色的钱包：生成资产档案，把初始存款设为 running balance 起点（已有转账流水会 rebase 到新起点上）
  const initCharWallet = async char => {
    const ex = charWalletRef.current[char.id];
    if (ex && ex.init) return true;
    setGen(g => ({ ...g, cwallet: char.id }));
    try {
      let prof = await genWalletProfile(char);
      let base = prof ? numClean(prof.baseBalance) : 0;
      // 没抠出存款（解析失败/被截断）→ 再试一次，别让仨角色都掉到默认 6000
      if (!base) { const prof2 = await genWalletProfile(char); if (prof2 && numClean(prof2.baseBalance)) { prof = prof2; base = numClean(prof2.baseBalance); } }
      // 还是没有：从月收入推一个（几个月存款），实在没有才用带随机的默认（避免人人 6000 整）
      if (!base) { const mi = prof ? numClean(prof.monthlyIncome) : 0; base = mi ? Math.round(mi * (1.5 + Math.random() * 3)) : CHAR_DEFAULT_BAL + Math.floor(Math.random() * 9000); }
      setCharWallet(p => {
        const cur = p[char.id] || { ledger: [], createdTs: Date.now() };
        const prior = (cur.ledger || []).filter(e => e.kind !== "init"); // 首开前已发生的转账等
        const initEntry = { id: "cw_init_" + Date.now(), ts: cur.createdTs || Date.now(), delta: base, after: base, label: "初始资产 · 存款", kind: "init" };
        // reflow：oldest→newest 重算 after，让 running balance 从初始存款开始一致
        const asc = [initEntry, ...prior.slice().reverse()];
        let bal = 0;
        const reflow = asc.map(e => { bal = r2(bal + e.delta); return { ...e, after: bal }; });
        const n = { ...p, [char.id]: {
          init: true,
          balance: bal,
          incomes: ((prof && prof.incomes) || []).map(x => ({ ...x, amount: numClean(x.amount) })),
          monthlyIncome: prof ? numClean(prof.monthlyIncome) : 0,
          fixedMonthly: prof ? numClean(prof.fixedMonthly) : 0,
          investAssets: prof ? numClean(prof.investAssets) : 0,
          notes: (prof && prof.notes) || {},
          ledger: reflow.reverse(),
          // 设成前一天，这样初始化当天的日常消费也会被 catchUp 补上（否则设立那天永远空白）
          lastDailyKey: schedDayKey((function () { const d = new Date(); d.setDate(d.getDate() - 1); return d; })()),
          createdTs: cur.createdTs || Date.now()
        } };
        saveJSON("x_charWallet", n);
        charWalletRef.current = n;
        return n;
      });
      return true;
    } finally {
      setGen(g => ({ ...g, cwallet: null }));
    }
  };
  // 重新生成资产档案：收入/固定支出/理财/批注全部重推，并把存款（baseBalance）也重新推演——
  // 之前只更新静态档案、不动余额，所以「刷新」看起来资产没完全变。这里连初始存款一起重置，
  // 把已发生的转账等流水 rebase 到新的初始存款上（保留流水，只换起点）。
  const refreshCharAssets = async char => {
    if (!active) { toast("请先到设置配置 API"); return; }
    setGen(g => ({ ...g, cwallet: char.id }));
    try {
      let prof = await genWalletProfile(char);
      if (!prof) return;
      let base = numClean(prof.baseBalance);
      if (!base) { const prof2 = await genWalletProfile(char); if (prof2 && numClean(prof2.baseBalance)) { prof = prof2; base = numClean(prof2.baseBalance); } }
      if (!base) { const mi = numClean(prof.monthlyIncome); base = mi ? Math.round(mi * (1.5 + Math.random() * 3)) : CHAR_DEFAULT_BAL + Math.floor(Math.random() * 9000); }
      setCharWallet(p => {
        const cur = p[char.id]; if (!cur) return p;
        const prior = (cur.ledger || []).filter(e => e.kind !== "init"); // 保留转账等已发生流水
        const initEntry = { id: "cw_init_" + Date.now(), ts: cur.createdTs || Date.now(), delta: base, after: base, label: "初始资产 · 存款", kind: "init" };
        const asc = [initEntry, ...prior.slice().reverse()];
        let bal = 0;
        const reflow = asc.map(e => { bal = r2(bal + e.delta); return { ...e, after: bal }; });
        // 刷新时：新生成为空（截断/没给）就保留原来的，别用空覆盖掉好的批注/收入
        const newIncomes = (prof.incomes && prof.incomes.length) ? prof.incomes.map(x => ({ ...x, amount: numClean(x.amount) })) : (cur.incomes || []);
        const newNotes = (prof.notes && Object.keys(prof.notes).length) ? prof.notes : (cur.notes || {});
        const n = { ...p, [char.id]: { ...cur,
          balance: bal,
          incomes: newIncomes,
          monthlyIncome: numClean(prof.monthlyIncome) || cur.monthlyIncome || 0,
          fixedMonthly: numClean(prof.fixedMonthly) || cur.fixedMonthly || 0,
          investAssets: numClean(prof.investAssets) || cur.investAssets || 0,
          notes: newNotes,
          ledger: reflow.reverse()
        } };
        saveJSON("x_charWallet", n);
        charWalletRef.current = n;
        return n;
      });
      toast("已重新生成 " + char.name + " 的资产档案");
    } finally {
      setGen(g => ({ ...g, cwallet: null }));
    }
  };
  // 生成某天的日常消费（按当天日程+人设，逐笔列具体买了什么），无 API/失败则用固定支出估算兜底
  const genDailySpend = async (char, dayKey, rec) => {
    const plan = (schedulesRef.current[char.id] || {})[dayKey];
    const schedText = plan && Array.isArray(plan.seqs) ? plan.seqs.map(s => (s.time || "") + " " + s.title + (s.location ? "（" + s.location + "）" : "")).join("；") : "";
    const bal = Number(rec.balance) || 0;
    const broke = bal <= 0;
    const fallback = () => {
      if (broke) return [{ item: "只买了口吃的", amount: Math.max(5, Math.round(8 + Math.random() * 12)) }];
      const est = Math.max(8, Math.round(((Number(rec.fixedMonthly) || 1800) / 30) * (0.5 + Math.random())));
      return [{ item: "日常开销", amount: est }];
    };
    if (!active) return fallback();
    try {
      const dp = schedDateParts(dayKey);
      const d = await runProbe(bgActive, ctxFor(char), {
        instruction: (broke
          ? "⚠️TA 现在【已经透支】（卡里 " + Math.round(bal) + " 元），正在借钱过日子：这一天只可能有【最低限度的必需开销】（一顿便宜的饭、通勤），总额不超过 40 元，能不花就不花。\n"
          : "TA 卡里现在有 " + Math.round(bal) + " 元" + ((Number(rec.monthlyIncome) || 0) && bal < (Number(rec.monthlyIncome) || 0) * 0.3 ? "，手头很紧，这几天花钱明显收敛。" : "。") + "\n")
          + "推演「" + char.name + "」在 " + dp.md + "（" + dp.dowZh + "）这一天【实际买了哪些东西】，逐笔列出。" + (schedText ? "这天 TA 的行程是：" + schedText + "。行程里的活动要如实反映到消费上（出门的交通、约饭的饭钱、看展的门票……）。" : "") + "要求：① 每笔写【具体名目】（哪家的什么/什么东西），严禁写「日常开销」「杂费」这类糊弄话；② 买什么、去哪买要贴 TA 的人设、口味和消费水平——不同的人买的东西该完全不一样；③ 大多数日子就是吃喝交通几笔小额（1~4 笔）；④ 偶尔（心情好/发薪/行程特殊/路过被种草）会多一笔 TA 这种人会喜欢的非日常小东西（一本书/模型/植物/唱片/游戏内购……由人设决定），别天天买；⑤ 也允许是几乎不花钱的宅家日（给空数组或只有一笔）；⑥ **【币种铁律】amount 一律按【人民币】量级——TA 人在国外（日本/韩国/欧美）也把当地消费换算成人民币记（一杯咖啡二三十、一顿饭几十到一两百、地铁几块钱），绝不许写日元/韩元的几百上千那种原币数字**。",
        schemaHint: "{\"buys\":[{\"item\":\"楼下便利店饭团+冰美式\",\"amount\":18},{\"item\":\"地铁通勤往返\",\"amount\":8}]}",
        maxTokens: 800
      });
      const buys = (Array.isArray(d.buys) ? d.buys : []).map(b => ({ item: String((b && b.item) || "").slice(0, 30), amount: Math.abs(Number(b && b.amount) || 0) })).filter(b => b.item && isFinite(b.amount) && b.amount > 0).slice(0, 6);
      // 代码侧封顶：透支的人一天花不出 40 块以上（模型有时不听）
      if (broke) {
        let left = 40, out = [];
        for (const b of buys) { if (left <= 0) break; const amt = Math.min(b.amount, left); if (amt >= 1) { out.push({ item: b.item, amount: amt }); left -= amt; } }
        return out;
      }
      return buys; // 空数组=这天没花钱，合法
    } catch (e) {
      return fallback();
    }
  };
  // 应用某一天：当天日常消费 + 若是 1 号则月度收支
  const applyWalletDay = async (char, dayKey) => {
    const rec = charWalletRef.current[char.id];
    if (!rec || !rec.init) return;
    const buys = await genDailySpend(char, dayKey, rec);
    const parts = schedParseKey(dayKey);
    const isFirst = parts.getDate() === 1;
    const dayTs = new Date(parts); dayTs.setHours(23, 0, 0, 0);
    const mk = (delta, label, kind, ts, after) => ({ id: "cw_" + ts + "_" + Math.floor(Math.random() * 1000), ts, delta, after, label, kind });
    setCharWallet(p => {
      const cur = p[char.id]; if (!cur) return p;
      let bal = Number(cur.balance) || 0;
      const chron = []; // 按时间顺序（老→新）
      if (isFirst) {
        const inc = r2((Number(cur.monthlyIncome) || 0) - (Number(cur.fixedMonthly) || 0));
        if (inc) { bal = r2(bal + inc); chron.push(mk(inc, "月度收支 · 工资到账 − 固定支出", "monthly", dayTs.getTime() - 1000, bal)); }
      }
      (buys || []).forEach((b, i) => {
        if (!b || !b.amount) return;
        bal = r2(bal - Math.abs(b.amount));
        chron.push(mk(-Math.abs(b.amount), b.item, "daily", dayTs.getTime() + i * 60000, bal));
      });
      const n = { ...p, [char.id]: { ...cur, balance: bal, lastDailyKey: dayKey, ledger: [...chron.reverse(), ...(cur.ledger || [])] } };
      saveJSON("x_charWallet", n);
      charWalletRef.current = n;
      return n;
    });
  };
  // 每天自动补一次账（v56.55）。她 2026-08-26：「我的钱包新角色过了好几天还是没出现日常消费」——
  // 病根是 catchUpWallet 只有【打开那个角色的钱包页】时才跑（screens.js 里那个 useEffect），
  // 她不去翻就永远不结算。挂到跨天那一拍上，全员补一次；一人一天一次调用，走便宜池。
  const walletCatchRunRef = useRef(false);
  const walletCatchAllToday = async () => {
    if (walletCatchRunRef.current) return;
    walletCatchRunRef.current = true;
    try {
      for (const c of liveChars) {
        const rec = charWalletRef.current[c.id];
        if (!rec || !rec.init) continue;       // 还没建档的不动，建档要她自己点
        await catchUpWallet(c);
      }
    } finally { walletCatchRunRef.current = false; }
  };
  // 补账：把 lastDailyKey 之后、到【昨天】为止漏掉的每天日常消费补上（最多补 14 天）
  const catchUpWallet = async char => {
    const rec = charWalletRef.current[char.id];
    if (!rec || !rec.init) return;
    const now = new Date();
    // ⭐只补到【昨天】——一天的开销要等这天真正过完（进入次日凌晨）才结算显示，绝不提前生成/扣除今天还没发生的花销。
    // 例：11 号凌晨只结算到 10 号，11 号自己的开销等 12 号凌晨再补。（她要的「别像能看到未来一样把今天的钱先花了」）
    const cutoffKey = schedDayKey(new Date(now.getTime() - 86400000));
    const lastKey = rec.lastDailyKey || schedDayKey(now);
    if (lastKey >= cutoffKey) return;
    const cursor = schedParseKey(lastKey);
    const stop = schedParseKey(cutoffKey);
    let guard = 0;
    while (cursor < stop && guard < 14) {
      cursor.setDate(cursor.getDate() + 1);
      guard++;
      await applyWalletDay(char, schedDayKey(cursor));
    }
  };
  // 转账：联动我的钱包和角色钱包，并在聊天里留一条转账消息
  // 我转给 TA：入队一张待处理转账卡，钱在 TA 接受后才动
  const sendTransfer = (charId, amount, note) => {
    const a = Math.round(Number(amount) * 100) / 100;
    if (a <= 0) return;
    if (wallet < a) {
      toast("余额不足");
      return;
    }
    const char = characters.find(c => c.id === charId);
    const tid = "tf_" + Date.now();
    pChat(charId, p => [...p, {
      role: "user",
      kind: "transfer",
      tid: tid,
      dir: "toChar",
      amount: a,
      note: note || "",
      status: "pending",
      content: "[转账] 你向 " + char.name + " 转了 ¥" + a + (note ? "（" + note + "）" : ""),
      ts: Date.now(),
      read: false
    }]);
    // 转出去就挂着等 TA 点（她 2026-08-27）：以前是 1.6 秒后按 85% 概率随机收下、
    // 顺手再触发一轮主动回复——所以「一转完他就自己回话了」。现在两件事都不做：
    // 收不收由 TA 在【下一次真的开口】那一轮里自己决定（见 replyNow 的 transferAccept），
    // 她按回复键、或者她再说句话，都算那一轮。
    toast("转账已发出，等 TA 点开");
  };
  // TA 转给我（AI 在回复里决定）：入队待处理卡，我接受才入账
  const postCharTransfer = (charId, amount, note) => {
    let a = Math.round(Number(amount) * 100) / 100;
    if (a <= 0) return;
    // 掏不出来的钱不许掏（她 2026-08-26：阿屿转了 15000，人直接欠到 -14000 还在涨）。
    // 提示词里已经告诉他余额了，这里是代码侧的保证：封顶到他真有的钱，一分不剩就不转。
    const _w = charWalletRef.current[charId];
    if (_w && _w.init) {
      const bal = Number(_w.balance) || 0;
      if (bal <= 0) return;
      if (a > bal) a = Math.round(bal * 100) / 100;
    }
    const char = characters.find(c => c.id === charId);
    pChat(charId, p => [...p, {
      role: "assistant",
      turnId: "tf_" + Date.now(),
      kind: "transfer",
      tid: "tfc_" + Date.now(),
      dir: "toMe",
      amount: a,
      note: note || "",
      status: "pending",
      content: "[转账] " + char.name + " 向你转了 ¥" + a + (note ? "（" + note + "）" : ""),
      ts: Date.now(),
      read: false
    }]);
  };
  // 结算：accept=接受入账；false=退回（只提示不动钱）
  const respondTransfer = (charId, tid, accept) => {
    const char = characters.find(c => c.id === charId);
    const card = (chatsRef.current[charId] || []).find(m => m.kind === "transfer" && m.tid === tid);
    if (!card || card.status !== "pending") return;
    if (accept) {
      if (card.dir === "toChar") {
        changeWallet(-card.amount, "转账给 " + (char ? char.name : "对方"), "transfer");
        adjustCharBalance(charId, card.amount, "收到你的转账" + (card.note ? "（" + card.note + "）" : ""), "transfer");
      } else {
        changeWallet(card.amount, (char ? char.name : "对方") + " 转账给你", "transfer");
        adjustCharBalance(charId, -card.amount, "转账给你" + (card.note ? "（" + card.note + "）" : ""), "transfer");
      }
    }
    pChat(charId, p => p.map(m => m.kind === "transfer" && m.tid === tid ? {
      ...m,
      status: accept ? "accepted" : "returned"
    } : m));
    const nm = char ? char.name : "对方";
    const line = accept
      ? (card.dir === "toChar" ? nm + " 领取了你的转账 ¥" + card.amount : "你领取了 " + nm + " 的转账 ¥" + card.amount)
      : (card.dir === "toChar" ? nm + " 退回了你的转账 ¥" + card.amount : "你退回了 " + nm + " 的转账 ¥" + card.amount);
    pChat(charId, p => [...p, { role: "system", kind: "system", content: line, ts: Date.now() }]);
  };
  // ---- 群聊转账（我转给群里某个指定成员）----
  const sendGroupTransfer = (groupId, memberId, amount, note) => {
    const a = Math.round(Number(amount) * 100) / 100;
    if (a <= 0) return;
    if (!groupClosed(groupId) && wallet < a) {
      toast("余额不足");
      return;
    }
    const member = characters.find(c => c.id === memberId);
    const tid = "gtf_" + Date.now();
    pushGroupRich(groupId, {
      role: "user",
      kind: "transfer",
      tid: tid,
      dir: "toChar",
      toId: memberId,
      toName: member ? member.name : "",
      amount: a,
      note: note || "",
      status: "pending",
      content: "[转账] 你向 " + (member ? member.name : "成员") + " 转了 ¥" + a + (note ? "（" + note + "）" : "")
    });
    // 同单聊：挂着等 TA 点，收不收由 TA 在下一轮群发言里自己决定（见 replyGroup 的 transferAccept）
    toast("转账已发出，等 TA 点开");
  };
  const respondGroupTransfer = (groupId, tid, accept) => {
    const gc = groupChatsRef.current[groupId] || [];
    const card = gc.find(m => m.kind === "transfer" && m.tid === tid);
    if (!card || card.status !== "pending") return;
    if (accept && !groupClosed(groupId)) {
      changeWallet(-card.amount, "群转账给 " + (card.toName || "成员"), "transfer");
      adjustCharBalance(card.toId, card.amount, "收到群转账", "transfer");
    }
    const nm = card.toName || "对方";
    pGChat(groupId, p => p.map(m => m.kind === "transfer" && m.tid === tid ? { ...m, status: accept ? "accepted" : "returned" } : m).concat([{
      role: "system",
      content: nm + (accept ? " 收下了你的转账" : " 退回了你的转账"),
      ts: Date.now()
    }]));
    toast(accept ? nm + " 收下了转账" : nm + " 退回了转账");
  };
  // ---- 通话 / 视频（私聊单人 或 群聊多人；发一句回一句，即时）----
  useEffect(() => {
    callRef.current = call;
  }, [call]);
  const startCall = (participants, mode, groupId, caller) => {
    const people = (participants || []).filter(Boolean);
    if (!people.length) return;
    // caller="me"（用户拨的）或某 charId（该角色主动打来、用户接听）——用于在通话里告诉角色是谁打的，别搞反
    setCall({ participants: people, mode: mode || "voice", groupId: groupId || null, caller: caller || "me", msgs: [], startTs: Date.now() });
  };
  const callSend = async text => {
    const cur = callRef.current;
    if (!cur || !text || !text.trim()) return;
    if (laneBusy("call")) return;
    const um = { role: "user", content: text.trim(), ts: Date.now() };
    noteTidalUser(um.content, um.ts);
    const withUser = [...cur.msgs, um];
    setCall(c => c ? { ...c, msgs: withUser } : c);
    callRef.current = { ...cur, msgs: withUser };
    if (!active) {
      toast("请先到设置配置 API");
      return;
    }
    startLane("call");
    try {
      const people = cur.participants;
      const isVideo = cur.mode === "video";
      const modeZh = isVideo ? "视频通话" : "语音通话";
      // 去掉模型偶尔加的「名字：」开头前缀
      const stripName = s => String(s || "").replace(/^\s*[^\s:：]{1,14}[:：]\s*/, "").trim();
      // 解析失败时，从（可能被截断的）原文里抠出 say 数组的字符串，绝不把生 JSON/```json 当气泡吐出来
      const sayFallback = raw => {
        const txt = String(raw || "");
        const seg = (txt.match(/"say"\s*:\s*\[([\s\S]*?)(\]|$)/) || [])[1] || txt;
        let arr = (seg.match(/"((?:[^"\\]|\\.)*)"/g) || []).map(s => s.slice(1, -1).replace(/\\"/g, '"').replace(/\\n/g, " ")).map(stripName).filter(Boolean);
        if (!arr.length) { const t = stripName(txt.replace(/```(?:json)?/gi, "").replace(/["{}\[\]]/g, "").replace(/\bsay\b\s*:?/gi, "").replace(/\baction\b\s*:?/gi, "").trim()); if (t) arr = [t]; }
        return arr;
      };
      // 视频里模型常把动作糊进说话气泡（一大坨）。把一条 say 拆成有序片段：
      // （……）括号内=动作，单独成 act 条；括号外=说话，再按换行拆成多条气泡。
      const splitSayLine = str => {
        const out = [];
        const s = String(str || "");
        const re = /[（(]([^（）()]{1,60})[）)]/g;
        let last = 0, mm;
        const pushSpeech = seg => { stripName(seg).split(/\n+/).map(x => x.trim()).filter(Boolean).forEach(x => out.push({ speech: x })); };
        while ((mm = re.exec(s))) { pushSpeech(s.slice(last, mm.index)); const a = mm[1].trim(); if (a) out.push({ act: a }); last = re.lastIndex; }
        pushSpeech(s.slice(last));
        return out;
      };
      const pushMsg = line => setCall(c => c ? { ...c, msgs: [...c.msgs, { ts: Date.now(), ...line }] } : c);
      const uName = profile.name || "用户";
      const callerIsChar = cur.caller && cur.caller !== "me"; // 角色主动打来、用户接的
      const callerName = callerIsChar ? ((people.find(p => p.id === cur.caller) || {}).name || "") : "";
      if (people.length <= 1) {
        // 1:1：口语化对话，可一次多说几句把话说完；视频另给动作/神态
        const char = people[0];
        const hist = withUser.map(m => ({ role: m.role === "user" ? "user" : "assistant", content: m.content }));
        const whoCalled = callerIsChar ? "【谁打的这通电话】是【你】主动拨给 " + uName + " 的、Ta 接起来了——是你想找 Ta，别搞反成 Ta 打给你、更别问 Ta『不是你打给我的吗』。" : "【谁打的这通电话】是 " + uName + " 打给你的、你接了。";
        if (typeof primeQueryVec === "function") await primeQueryVec(recentChatText(char)); // 向量记忆预热（ctxFor 的检索用的是聊天文本）
        const sys = buildBundle(ctxFor(char)) + "\n\n【当前场景：" + modeZh + "中】你正和" + uName + "打电话。" + whoCalled + "用口语化短句自然对话，像真的在通话。**你可以一次说好几句（多个气泡），把想说的一次说完，别说一半。**" + (isVideo ? " 因为是视频通话对方能看到你，**每次都必须额外给一句此刻的动作/神态描写 action**（如 靠在沙发上笑、把镜头凑近、揉眼睛），不能省略。" : "") + "\n【输出】只输出 JSON：{\"say\":[\"气泡1\",\"气泡2\"]" + (isVideo ? ",\"action\":\"此刻动作神态一句(必填)\"" : "") + "}。say 里只放你说出口的话，不要加名字前缀、不要旁白、不要括号。";
        // v56.26 GPT-Live 流式：语音通话轮开 stream，增量解析 say 数组——每凑齐一条完整台词
        // 就立刻落气泡（CallScreen 的逐气泡 TTS 流水线自然跟上=模型还在写后半句，前半句已经开口）。
        // 视频轮不流式（action 必须先于台词落地）；流式解析失败零损失——结尾按全文重新对账补齐。
        let streamedLines = 0;
        const pushSayNow = sy => {
          const ls = splitSayLine(stripName(sy) || "");
          for (const ln of ls) {
            if (ln.act) pushMsg({ role: "char", act: true, senderId: char.id, senderName: char.name, content: ln.act });
            else {
              pushMsg({ role: "char", senderId: char.id, senderName: char.name, content: ln.speech });
              // v56.70 首句提速：气泡落地瞬间就预热 TTS 合成（ttsSpeak 自带缓存），
              // 播放循环轮到它时直接缓存命中——首句等待从「合成+播放」缩到只剩「播放」
              try { if (char.voiceId && typeof ttsSpeak === "function") ttsSpeak(ln.speech, char.voiceId).catch(() => {}); } catch (e) {}
            }
            streamedLines++;
          }
        };
        const sayStreamer = (() => {
          let all = "", inArr = false, done = false;
          return delta => {
            if (done) return;
            all += delta;
            if (!inArr) {
              const m2 = /"say"\s*:\s*\[/.exec(all);
              if (!m2) return;
              all = all.slice(m2.index + m2[0].length); inArr = true;
            }
            // 逐字符找完整 JSON 字符串元素；撞到 ] （数组收尾）就停
            while (true) {
              let i = 0;
              while (i < all.length && (all[i] === " " || all[i] === "," || all[i] === "\n" || all[i] === "\r" || all[i] === "\t")) i++;
              if (i < all.length && all[i] === "]") { done = true; return; }
              if (i >= all.length || all[i] !== '"') return;
              let j = i + 1, esc = false, closed = -1;
              for (; j < all.length; j++) {
                const ch = all[j];
                if (esc) { esc = false; continue; }
                if (ch === "\\") { esc = true; continue; }
                if (ch === '"') { closed = j; break; }
              }
              if (closed < 0) return; // 字符串还没写完，等下一段
              let sy = null;
              try { sy = JSON.parse(all.slice(i, closed + 1)); } catch (e) {}
              all = all.slice(closed + 1);
              if (sy) { try { pushSayNow(sy); } catch (e) {} }
            }
          };
        })();
        const raw = await callAI(apiFor(char.id), sys, hist, { maxTokens: 2400, ...(isVideo ? {} : { stream: true, onDelta: sayStreamer }) });
        const d = extractJSON(raw) || {};
        let says = Array.isArray(d.say) ? d.say : (d.say ? [d.say] : []);
        says = says.map(stripName).filter(Boolean);
        if (!says.length && !streamedLines) says = sayFallback(raw); // 解析失败也别吐生 JSON，正则抠出气泡（流式已落过的轮不再兜底，防双份）
        if (isVideo && d.action) pushMsg({ role: "char", act: true, senderId: char.id, senderName: char.name, content: String(d.action).replace(/[（）()]/g, "").trim() });
        // 把每条 say 里夹带的动作/多句摊平成有序气泡（动作单独居中、说话各自成条）
        // 流式轮已实时落过 streamedLines 条——这里只补对账后多出来的尾巴（通常为 0）
        const lines = says.reduce((acc, sy) => acc.concat(splitSayLine(sy)), []);
        for (let i = streamedLines; i < lines.length; i++) {
          if (i > streamedLines) await new Promise(r => setTimeout(r, 550));
          if (lines[i].act) pushMsg({ role: "char", act: true, senderId: char.id, senderName: char.name, content: lines[i].act });
          else pushMsg({ role: "char", senderId: char.id, senderName: char.name, content: lines[i].speech });
        }
      } else {
        // 群通话：多角色你一言我一语；视频每条可带 action
        const hist = withUser.map(m => ({ role: m.role === "user" ? "user" : "assistant", content: (m.senderName ? m.senderName + "：" : "") + m.content }));
        const memberDesc = people.map(c => "【" + c.name + "】" + (c.persona || "").slice(0, 160)).join("\n\n");
        const relLines = people.map(c => directedRelationLines(c, rels, characters, profile)).join("\n");
        const cWorld = loreText(loreRef.current, { charIds: people.map(c => c.id), scope: "chat", text: hist.map(m => m.content).join("\n") });
        // 群通话补记忆：群 OOC 规矩 + 记忆库检索（不互通的群守封闭分区，不读全局记忆库）——之前群通话两样都没接
        const cgs = cur.groupId ? gsFor(cur.groupId) : null;
        const cDirs = cur.groupId ? (directives[cur.groupId] || []).map(d => (typeof d === "string" ? d : d && d.text) || "").filter(x => x.trim()) : [];
        if ((!cur.groupId || (cgs && cgs.memoryInterop)) && typeof primeQueryVec === "function") await primeQueryVec(hist.slice(-8).map(m => m.content).join("\n")); // 向量记忆预热
        const cMem = (!cur.groupId || (cgs && cgs.memoryInterop)) ? formatMemLib(retrieveMemories(memLibRef.current, people[0] && people[0].id, hist.slice(-8).map(m => m.content).join("\n"), { limit: 5 })) : "";
        const sys = "这是一个多人" + modeZh + "，用户" + uName + "和以下角色都在通话里。角色们用口语化短句自然对话，会顺着彼此和用户的话接梗、插话、跑题，像真的多人语音那样。每个角色想多说几句就多给几条，把话说完。" + (callerIsChar && callerName ? "\n【谁发起的这通电话】是【" + callerName + "】主动拨给 " + uName + " 的、Ta 接了——" + callerName + " 清楚是自己打过去的，别搞反成 " + uName + " 打来的、别问『不是你打给我的吗』。" : "") + "\n\n【在场角色】\n" + memberDesc + "\n\n【角色间关系】\n" + relLines + (cDirs.length ? "\n\n【用户立下的群规矩（高优先·务必遵守）】\n" + cDirs.map((x, ii) => (ii + 1) + ". " + x.trim()).join("\n") : "") + (cMem && cMem.trim() ? "\n\n【记忆库·相关条目（自然记得，别生硬复述）】\n" + cMem.trim() : "") + (cWorld ? "\n\n【世界书】\n" + cWorld : "") + "\n\n【输出】只输出 JSON 数组，按发言先后：[{\"name\":\"角色名\",\"text\":\"这句话\"" + (isVideo ? ",\"action\":\"该角色此刻动作神态(视频可见,可选)\"" : "") + "}]，text 不要带名字前缀，一次 3~7 条，name 必须是在场角色之一。";
        const raw = await callAI(active, sys, hist, { maxTokens: 2400 });
        const arr = extractJSON(raw);
        if (Array.isArray(arr)) {
          for (let i = 0; i < arr.length; i++) {
            const spk = people.find(c => c.name === arr[i].name) || people[0];
            if (i > 0) await new Promise(r => setTimeout(r, 500));
            if (isVideo && arr[i].action) pushMsg({ role: "char", act: true, senderId: spk.id, senderName: spk.name, content: String(arr[i].action).replace(/[（）()]/g, "").trim() });
            const gl = splitSayLine(arr[i].text);
            for (const ln of gl) pushMsg(ln.act ? { role: "char", act: true, senderId: spk.id, senderName: spk.name, content: ln.act } : { role: "char", senderId: spk.id, senderName: spk.name, content: ln.speech });
          }
        }
      }
    } catch (e) {
      toast("通话回复失败：" + (e.message || "重试"));
    } finally {
      endLane("call");
    }
  };
  const endCall = sec => {
    const cur = callRef.current;
    if (cur) {
      const s = Math.max(0, Math.round(Number(sec) || 0));
      const dur = String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
      const label = (cur.mode === "video" ? "视频通话" : "语音通话") + " 已结束 · 时长 " + dur;
      const callId = "call_" + Date.now();
      // 整通转录存进气泡（点开可回看）；act=视频里的动作行
      const log = (cur.msgs || []).map(m => ({ role: m.role, senderId: m.senderId || null, senderName: m.senderName || null, act: !!m.act, content: m.content, ts: m.ts || null }));
      const bubble = { role: "system", kind: "callend", callMode: cur.mode, dur: dur, content: label, ts: Date.now(), id: callId, log };
      if (cur.groupId) pGChat(cur.groupId, p => [...p, bubble]);
      else if (cur.participants[0]) pChat(cur.participants[0].id, p => [...p, bubble]);
      // 挂断后走后台便宜池出 1~2 句摘要：补进气泡（回看小结+线上聊天接得上）+ 入记忆库；太短的通话不折腾
      const said = log.filter(m => !m.act && m.content && String(m.content).trim());
      if (said.length >= 3 && bgActiveRef.current) (async () => {
        try {
          const uN = profile.name || "用户";
          const text = log.map(m => m.role === "user" ? uN + "：" + m.content : (m.senderName || "") + (m.act ? "（" + m.content + "）" : "：" + m.content)).join("\n");
          const sys = "把这通『" + uN + "』和" + cur.participants.map(c => c.name).join("、") + "的" + (cur.mode === "video" ? "视频" : "语音") + "通话做记忆归档。只输出 JSON：\n" +
            "{\"summary\":\"1~2句第三人称总结：聊了什么关键内容、情绪转折。具体、可复用\"," +
            "\"open\":[\"这通电话里【双方明确新约好或答应对方、尚未兑现且值得持续惦记】的事，每条一句；普通吃饭/洗澡/上班等生活安排不是开环，没有就 []\"]}";
          const raw = await callAI(bgActiveRef.current, sys, [{ role: "user", content: "【通话内容】\n" + text }], { maxTokens: 2400 });
          const d = extractJSON(raw);
          const sum = d && d.summary ? String(d.summary).trim() : String(raw || "").trim();
          const opens = d && Array.isArray(d.open) ? d.open.map(x => String(x).trim()).filter(Boolean).slice(0, 3) : [];
          if (!sum) return;
          const patch = list => list.map(x => x.id === callId ? { ...x, sum } : x);
          if (cur.groupId) pGChat(cur.groupId, patch);
          else if (cur.participants[0]) pChat(cur.participants[0].id, patch);
          // 记忆分区：群里打的通话，只有互通群才写进全局记忆库（同群线下的规矩）
          if (!cur.groupId || gsFor(cur.groupId).memoryInterop) {
            addMemEntry({ text: sum, tags: ["通话"], charIds: cur.participants.map(c => c.id), knownBy: cur.participants.map(c => c.id), source: "auto" });
            // 电话里约的事也标未了结进开环（和线下同款）：兑现后 extractMemories 的 resolveOpen 会自动勾掉
            opens.forEach(op => addMemEntry({ text: op, tags: ["通话", "约定"], charIds: cur.participants.map(c => c.id), knownBy: cur.participants.map(c => c.id), source: "auto", open: true }));
          }
        } catch (e) {/* 静默：摘要失败不影响通话记录本身 */}
      })();
    }
    setCall(null);
  };
  // 随机坐标（位置 stamp 用）
  const makeCoords = () => {
    const lat = (Math.random() * 180 - 90).toFixed(4);
    const lng = (Math.random() * 360 - 180).toFixed(4);
    return Math.abs(lat) + "° " + (lat >= 0 ? "N" : "S") + ", " + Math.abs(lng) + "° " + (lng >= 0 ? "E" : "W");
  };
  // ---- 匿名箱 ----
  const pAnon = (charId, updater) => {
    setAnon(p => {
      const cur = p[charId] || {
        netname: "",
        bio: "",
        records: []
      };
      const n = {
        ...p,
        [charId]: updater(cur)
      };
      saveJSON("x_anon", n);
      return n;
    });
  };
  const delAnonRecord = (charId, ts) => pAnon(charId, cur => ({ ...cur, records: (cur.records || []).filter(r => r.ts !== ts) }));
  const openAnon = async char => {
    setAnonChar(char);
    if ((!anon[char.id] || !anon[char.id].netname) && active) {
      setAnonBusy(true);
      try {
        const d = await runProbe(apiFor(char.id), ctxFor(char), {
          instruction: "为「" + char.name + "」设计 Ta 在匿名社交/树洞 App 上的马甲：符合性格的网名 netname、第一人称个人简介 bio（1-2 句，可与现实人设有反差），以及 Ta 会挑什么样的图作为主页背景的描述 bgDesc（一句画面感描述，如「深夜城市天台的霓虹倒影」「一只蜷着睡的橘猫」「褪色的旧船票特写」，贴合此刻心境）。",
          schemaHint: "{\"netname\":\"网名\",\"bio\":\"简介\",\"bgDesc\":\"主页背景图描述\"}"
        });
        pAnon(char.id, cur => ({
          ...cur,
          netname: d.netname || char.name,
          bio: d.bio || "",
          bgDesc: d.bgDesc || cur.bgDesc || ""
        }));
      } catch (e) {/* silent */} finally {
        setAnonBusy(false);
      }
    }
  };
  // 重新生成匿名马甲（网名+签名）：随此刻心情 / 角色成长变化
  const refreshAnonPersona = async char => {
    if (!active) { toast("请先到设置配置 API"); return; }
    setAnonBusy(true);
    try {
      const d = await runProbe(apiFor(char.id), ctxFor(char), {
        instruction: "重新为「" + char.name + "」设计 Ta【此刻】在匿名树洞的马甲：网名 netname、第一人称签名 bio（1-2 句），以及 Ta 此刻会挑什么样的图当主页背景的描述 bgDesc（一句画面感描述）。要贴合 Ta 此刻的心情与最近的经历/心境变化（char development）——心情或状态变了，网名、签名、背景图都随之改（可与现实人设反差、可中二/emo/洒脱，看当下）。给一套和以前不一样的新马甲。",
        schemaHint: "{\"netname\":\"网名\",\"bio\":\"签名\",\"bgDesc\":\"主页背景图描述\"}"
      });
      pAnon(char.id, cur => ({ ...cur, netname: d.netname || cur.netname || char.name, bio: d.bio || cur.bio || "", bgDesc: d.bgDesc || cur.bgDesc || "" }));
      toast("马甲已刷新");
    } catch (e) {
      toast("刷新失败：" + e.message);
    } finally {
      setAnonBusy(false);
    }
  };
  const genNetizenQ = async char => {
    if (!active) {
      toast("请先到设置配置 API");
      return;
    }
    setAnonBusy(true);
    try {
      const nn = anon[char.id] && anon[char.id].netname || char.name;
      const d = await runProbe(apiFor(char.id), ctxFor(char), {
        instruction: "有几个不同的匿名网友在树洞里向「" + char.name + "」（网名：" + nn + "）各提了一个问题。**务必一次生成正好 3-5 组（items 数组必须有 3 到 5 个元素，绝不能只给 1-2 组；宁可每组的问答都精简一点，也一定要凑齐至少 3 组）**：每组含这个网友的问题 question（好奇/八卦/深度/抬杠都行，风格各异）和「" + char.name + "」的回答 answer（符合人设与此刻心情，Ta 不知道对方是谁，别背教科书、别客服腔）。",
        schemaHint: "{\"items\":[{\"question\":\"问题\",\"answer\":\"回答\"},{\"question\":\"问题\",\"answer\":\"回答\"},{\"question\":\"问题\",\"answer\":\"回答\"}]}",
        maxTokens: 4200
      });
      let items = (d && Array.isArray(d.items) ? d.items : (Array.isArray(d) ? d : (d && d.question ? [d] : []))).filter(x => x && x.question);
      if (!items.length) throw new Error("没有生成内容");
      const base = Date.now();
      const recs = items.map((x, i) => ({ from: "netizen", q: x.question, a: x.answer || "", ts: base - i }));
      pAnon(char.id, cur => ({ ...cur, records: [...recs, ...(cur.records || [])] }));
    } catch (e) {
      toast("失败：" + e.message);
    } finally {
      setAnonBusy(false);
    }
  };
  const askAnon = async (char, q) => {
    if (!active) {
      toast("请先到设置配置 API");
      return;
    }
    setAnonBusy(true);
    try {
      const d = await runProbe(apiFor(char.id), ctxFor(char), {
        instruction: "有人匿名向「" + char.name + "」提问：「" + q + "」。Ta 不知道提问的其实是用户。以「" + char.name + "」身份真实作答 answer，符合人设。",
        schemaHint: "{\"answer\":\"回答\"}"
      });
      pAnon(char.id, cur => ({
        ...cur,
        records: [{
          from: "me",
          q,
          a: d.answer,
          ts: Date.now()
        }, ...(cur.records || [])]
      }));
    } catch (e) {
      toast("失败：" + e.message);
    } finally {
      setAnonBusy(false);
    }
  };
  const genPhoneApp = async (char, key) => {
    if (!active) {
      toast("请先到设置配置 API");
      return false;
    }
    setSelPhone(char.id);
    setGen(g => ({
      ...g,
      phoneApp: key
    }));
    try {
      const d = await runProbe(bgActive, { ...ctxFor(char), worldbook: loreFor(char, "subjects") }, phoneProbeSpec(key, char, relatedNames(char)));
      savePhoneApp(char.id, key, d);
      return true;
    } catch (e) {
      toast(phoneKeyLabel(key) + "生成失败：" + e.message);
      return false;
    } finally {
      setGen(g => ({
        ...g,
        phoneApp: null
      }));
    }
  };
  const genPhoneAll = async char => {
    if (!active) {
      toast("请先到设置配置 API");
      return;
    }
    setSelPhone(char.id);
    setGen(g => ({
      ...g,
      phoneApp: "__all__"
    }));
    // 视频拆成白天/深夜两次；其余按 app 生成
    const keys = PHONE_APPS.filter(a => !a.soon).reduce((acc, a) => acc.concat(a.key === "video" ? ["video_day", "video_night"] : [a.key]), []);
    let ok = 0;
    for (const key of keys) {
      try {
        const d = await runProbe(bgActive, { ...ctxFor(char), worldbook: loreFor(char, "subjects") }, phoneProbeSpec(key, char, relatedNames(char)));
        savePhoneApp(char.id, key, d);
        ok++;
      } catch (e) {/* 单个失败不中断其余 */}
    }
    setGen(g => ({
      ...g,
      phoneApp: null
    }));
    toast(ok === keys.length ? "已生成全部" : "完成 " + ok + "/" + keys.length + " 个，可单独重试");
  };

  // ---- moments ----
  const genMoment = async char => {
    setGen(g => ({
      ...g,
      moment: true
    }));
    try {
      const meName = profile.name || "我";
      const recentPosts = moments.filter(m => m.characterId === char.id).slice(0, 5).map(m => String(m.content || "").replace(/\s+/g, " ").trim()).filter(Boolean);
      const noRepeat = recentPosts.length
        ? "\n\n**【不许复读】TA 最近已经发过下面这些朋友圈，这一条【绝对不要】再写同一件事、同一种心情或雷同句式，换一件全新的事、一个新角度：**\n" + recentPosts.map((c, i) => (i + 1) + "、" + c.slice(0, 60)).join("\n")
        : "";
      const livedMaterial = ambientMaterialFor(char, { limit: 20 });
      // 「评论者从关系网里挑」原来只是一句抽象的话——关系网确实在上下文里（leanWriteCtx 没砍它），
      // 但模型得自己去那一段里翻。把名字直接点出来，命中率完全不是一回事。
      // 名单＝和 TA 有【任一方向】关系的角色 + TA 自己的 NPC（她 2026-08-26 问的皇帝 NPC 走的正是这条）。
      const peerNames = (() => {
        const seen = new Set(), out = [];
        const add = o => {
          if (!o || o.id === char.id) return;
          const n = o.remark || o.name;
          if (n && !seen.has(n)) { seen.add(n); out.push(n); }
        };
        liveChars.forEach(o => { if (rels[char.id + "->" + o.id] || rels[o.id + "->" + char.id]) add(o); });
        npcsOf(char.id).forEach(add);   // TA 自己的配角天然算熟人（她 2026-08-26 问的皇帝 NPC）
        return out;
      })();
      const d = await runProbe(apiFor(char.id), leanWriteCtx(ctxFor(char)), { // 自动朋友圈=TA 的社交发言，跟随专线（v48.37）：专线用专线，否则照旧主模型；瘦身省贵线（v48.95，Codex 指出漏套 lean）
        instruction: "以「" + char.name + "」身份发一条朋友圈：心情/日常/感想，1-4句，有角色味道，不暴露隐藏剧情。优先从你真正参与的近期相处里自然长出内容，但不要逐句复述或把私密细节直接公开。**大约一半概率配一张图**——如果这条适合配图，就在 image 里写一句这张图的画面描述（如「窗台上的多肉，逆光」「深夜便利店的关东煮」），不配图就填 null。再生成认识的其他角色对这条的 0-3 条评论。" + (peerNames.length ? "TA 已经建立关系的人有：" + peerNames.join("、") + "——这些是【优先】人选，谁真会关心这条谁才出现，不必都出现。" : "") + "评论者也【不限于】这些人：人设里合理存在、只是还没单独建卡的人（同学、舍友、同事、下属、邻居、旧友…）照样可以来评论，那正是朋友圈该有的样子；只要名字和口吻贴这个世界、这个身份就行，别让明显不搭的人冒出来。**绝对不要替用户本人（" + meName + "）生成任何评论或回复——用户会自己去评论。**" + (livedMaterial ? "\n\n【你最近亲历的共同相处（含私聊、群聊与线上/线下）】\n" + livedMaterial : "") + noRepeat,
        schemaHint: "{\"content\":\"朋友圈正文\",\"image\":\"配图描述或null\",\"comments\":[{\"author\":\"评论者名\",\"text\":\"评论\"}]}"
      });
      const content = String(d && d.content || "").trim();
      if (!content) throw new Error("模型没有返回朋友圈正文");
      pMom(p => [{
        id: "m_" + Date.now(),
        characterId: char.id,
        content,
        image: d.image && String(d.image).toLowerCase() !== "null" ? String(d.image) : null,
        ts: Date.now(),
        liked: false,
        likeCount: 0,
        comments: (d.comments || []).filter(c => c && c.author && c.author !== meName && c.author !== "我" && c.author !== "用户")
      }, ...p]);
      return true;
    } catch (e) {
      toast("失败：" + e.message);
      return false;
    } finally {
      setGen(g => ({
        ...g,
        moment: false
      }));
    }
  };
  const likeMoment = id => pMom(p => p.map(m => m.id === id ? {
    ...m,
    liked: !m.liked,
    likeCount: (m.likeCount || 0) + (m.liked ? -1 : 1)
  } : m));
  const delMoment = id => pMom(p => p.filter(m => m.id !== id));
  // 朋友圈封面（me 或某角色）：存 x_momentsCover
  const setMomentCover = (key, uri) => setMomentsCover(p => { const n = { ...p, [key]: uri || "" }; saveJSON("x_momentsCover", n); return n; });
  const openMomProfile = (id, isMe) => { setMomTarget({ id, isMe: !!isMe }); setScreen("momprofile"); };
  const commentMoment = async (id, text, replyTo) => {
    const meName0 = profile.name || "我";
    // 定向回复某条评论时，评论原文带上「回复 X：」前缀（微信朋友圈样式）
    const storedText = replyTo ? "回复 " + replyTo + "：" + text : text;
    pMom(p => p.map(m => m.id === id ? {
      ...m,
      comments: [...(m.comments || []), {
        author: meName0,
        text: storedText
      }]
    } : m));
    const mom = moments.find(m => m.id === id);
    if (!active || !mom) return;
    const author = characters.find(c => c.id === mom.characterId);
    const isMine = !author && mom.mine;
    if (!author && !isMine) return;
    const byName = n => characters.find(c => c.remark === n || c.name === n || (n && String(n).includes(c.name)));
    let roster, primary;
    if (author) {
      // 角色的帖子：发帖人 + 认识发帖人的其他角色（都可能插话）；定向回复的对象排最前
      const others = liveChars.filter(c => c.id !== author.id && (rels[c.id + "->" + author.id] || rels[author.id + "->" + c.id]));
      const target = replyTo ? byName(replyTo) : null;
      primary = target || author;
      roster = [...new Set([primary, author, ...others.slice(0, 4)])].map(c => c.remark || c.name);
    } else {
      // 我自己的帖子：可见好友里，定向对象 > 已在评论区里的人 > 好感最高的，凑最多5个候选
      const canSee = mom.visibleTo && mom.visibleTo.length ? liveChars.filter(c => mom.visibleTo.includes(c.id)) : liveChars;
      if (!canSee.length) return;
      const target = replyTo ? byName(replyTo) : null;
      const inThread = canSee.filter(c => (mom.comments || []).some(cm => cm.author === (c.remark || c.name) || cm.author === c.name));
      const byAff = canSee.slice().sort((a, b) => (affinities[b.id] || 50) - (affinities[a.id] || 50));
      const uniq = [...new Set([target, ...inThread, ...byAff].filter(Boolean))].slice(0, 5);
      if (!uniq.length) return;
      primary = uniq[0];
      roster = uniq.map(c => c.remark || c.name);
    }
    const meName = meName0;
    const fbAuthor = primary.remark || primary.name;
    // 兜底也别千篇一律的「看到啦」：贴着用户这条评论回一句短的
    const fallbackText = () => {
      const t = String(text || "").trim();
      const pool = [
        t ? "「" + (t.length > 12 ? t.slice(0, 12) + "…" : t) + "」——嗯，我看到了。" : "看到你评论啦。",
        "哈哈你这条我记下了。", "被你这么一说还真是。", "懂你意思，回头细说。", "谢啦，收到～"
      ];
      return pool[Math.floor(Math.random() * pool.length)];
    };
    try {
      const bundle = buildBundle(ctxFor(primary));
      // 评论区已有的往来（含用户和角色的来回）→ 让角色接着对话，别每次都从头开始（支持连续你来我往）
      const thread = (mom.comments || []).map(c => (c.author || "某人") + "：" + String(c.text || "")).join("\n");
      const scene = author
        ? "这是「" + author.name + "」发的朋友圈：「" + mom.content + "」。"
        : "这是用户「" + meName + "」自己发的朋友圈：「" + mom.content + "」" + (mom.image ? (typeof isImgRef === "function" && isImgRef(mom.image) ? "（配了一张图片）" : "（配图：" + mom.image + "）") : "") + "。";
      const lastLine = replyTo
        ? "刚回复了「" + replyTo + "」的评论：「" + text + "」——**这句主要是对「" + replyTo + "」说的，TA 必须回**，别人看情况插不插话。"
        : (thread ? "刚又追评了：「" + text + "」。" : "刚在下面评论了：「" + text + "」。");
      const system = bundle + "\n\n【场景】" + scene + (thread ? "\n【评论区已有的往来（按时间先后，你都看得到、要接着聊，别重复也别跳戏）】\n" + thread + "\n" : "") + "\n用户「" + meName + "」" + lastLine + "可能回复的人：" + roster.join("、") + "。请生成他们对【用户这条最新评论「" + text + "」】的回复——**必须直接回应用户说的这句话的具体内容、并接住上面评论区已经聊到的脉络（像微信朋友圈里回复评论那样，有来有往、能接着上一轮往下聊），别答非所问、别自说自话、别把前面聊过的又重说一遍。绝对不许用「看到啦」「收到」这种敷衍空话搪塞**；至少一条（保底），谁最合适谁回，1-3 条，各自符合人设与关系，短句、有具体内容。\n只输出 JSON：{\"replies\":[{\"author\":\"回复者名\",\"text\":\"回复内容（直接回应用户那句的具体内容）\"}]}";
      const raw = await callAI(apiFor(primary.id), system, [{ role: "user", content: "针对用户评论「" + text + "」生成回复 JSON" }], { maxTokens: 10000 });
      const d = extractJSON(raw) || {};
      // 容错解析：{replies:[...]} / 裸数组 / {reply} / {text}
      let reps = [];
      if (Array.isArray(d.replies)) reps = d.replies;
      else if (Array.isArray(d)) reps = d;
      else if (d.reply) reps = [typeof d.reply === "string" ? { author: fbAuthor, text: d.reply } : d.reply];
      else if (typeof d.text === "string") reps = [{ author: fbAuthor, text: d.text }];
      reps = reps.filter(r => r && r.text && String(r.text).trim() && String(r.text).toLowerCase() !== "null" && r.author !== meName && r.author !== "我" && r.author !== "用户");
      if (!reps.length) reps = [{ author: fbAuthor, text: fallbackText() }]; // 保底
      reps.forEach((r, i) => setTimeout(() => pMom(p => p.map(m => m.id === id ? { ...m, comments: [...(m.comments || []), { author: r.author, text: "回复 " + meName + "：" + r.text }] } : m)), 400 + i * 600));
    } catch (e) {
      setTimeout(() => pMom(p => p.map(m => m.id === id ? { ...m, comments: [...(m.comments || []), { author: fbAuthor, text: "回复 " + meName + "：" + fallbackText() }] } : m)), 400);
    }
  };
  // 我发一条朋友圈（可带图描述、可选可见范围）
  const postUserMoment = ({
    content,
    image,
    visibleTo
  }) => {
    const id = "m_" + Date.now();
    const mom = {
      id,
      mine: true,
      content,
      image: image || null,
      visibleTo: visibleTo || null,
      ts: Date.now(),
      liked: false,
      likeCount: 0,
      likers: [],
      comments: []
    };
    pMom(p => [mom, ...p]);
    reactToUserMoment(mom); // 自动生成点赞/评论
  };
  // 可见角色自动对我的朋友圈做真实反应：可能只赞/只评/已读不理/又赞又评，并会互相回复
  const reactToUserMoment = async mom => {
    if (!active) return;
    const canSee = mom.visibleTo && mom.visibleTo.length ? liveChars.filter(c => mom.visibleTo.includes(c.id)) : liveChars;
    if (!canSee.length) return;
    setGen(g => ({
      ...g,
      moment: true
    }));
    try {
      const meName = profile.name || "用户";
      const lines = canSee.map(c => {
        const aff = Math.round(affOf(c.id));
        const md = moods[c.id] && moods[c.id].label ? moods[c.id].label : "平静";
        const rel = rels[c.id + "->me"] ? rels[c.id + "->me"].label : "";
        return "- " + c.name + "：人设[" + String(c.persona || "").slice(0, 70) + "] 好感度" + aff + "/100 心情" + md + (rel ? " 对我关系[" + rel + "]" : "");
      }).join("\n");
      const system = "你在模拟朋友圈互动。「" + meName + "」发了一条朋友圈：「" + mom.content + "」" + (mom.image ? (typeof isImgRef === "function" && isImgRef(mom.image) ? "（配了一张图片）" : "（配图：" + mom.image + "）") : "") + "\n\n能看到的好友及其状态：\n" + lines + (worldbook && worldbook.trim() ? "\n\n【世界观】" + worldbook.slice(0, 400) : "") + "\n\n请根据每个人的性格、心情、好感度和这条内容，真实地决定 Ta 的反应：可能只点赞、只评论、又赞又评、或已读不理——不要所有人都反应，也不要千篇一律。**保底：至少要有一位好友留下评论互动（通常是好感度较高的那位），不要出现全部已读不理、无人评论的情况。**评论要符合各自人设与关系。有的人还会顺手回复别的好友的评论（replyTo 填被回复者名）。\n只输出 JSON：{\"reactions\":[{\"name\":\"名字\",\"liked\":true或false,\"comment\":\"评论或null\"}],\"replies\":[{\"name\":\"名字\",\"replyTo\":\"被回复的评论者\",\"text\":\"回复\"}]}";
      const raw = await callAI(active, system, [{
        role: "user",
        content: "开始"
      }], {
        // 思考型模型「思考」也吃这个额度，3000 还是会截半：按次计费输出免费，直接放到 8000
        maxTokens: 8000
      });
      let d = extractJSON(raw);
      if (!d && typeof repairJSON === "function") { try { d = JSON.parse(repairJSON(raw)); } catch (e) {} }
      if (d) {
        const likers = (d.reactions || []).filter(r => r.liked).map(r => r.name);
        const comments = [];
        (d.reactions || []).forEach(r => {
          if (r.comment && String(r.comment).toLowerCase() !== "null") comments.push({
            author: r.name,
            text: r.comment
          });
        });
        // 保底：一个人都没互动时，让好感最高的可见角色至少点个赞
        if (!likers.length && !comments.length && canSee.length) {
          const top = canSee.slice().sort((a, b) => (affinities[b.id] || 50) - (affinities[a.id] || 50))[0];
          if (top) likers.push(top.name);
        }
        (d.replies || []).forEach(r => {
          if (r.text) comments.push({
            author: r.name,
            text: (r.replyTo ? "回复 " + r.replyTo + "：" : "") + r.text
          });
        });
        pMom(p => p.map(m => m.id === mom.id ? {
          ...m,
          likers: [...new Set([...(m.likers || []), ...likers])],
          likeCount: (m.likeCount || 0) + likers.length,
          comments: [...(m.comments || []), ...comments]
        } : m));
      }
    } catch (e) {/* silent */} finally {
      setGen(g => ({
        ...g,
        moment: false
      }));
    }
  };

  // ---- forum（仿贴吧）----
  // 帖子只有一份，躺在 forumPosts；版块页/关注页/角色主页都是对同一数组的筛选视图（见 FORUM_BOARDS）。
  // 刷新只 append，绝不覆盖已有帖。NPC 帖每版块有硬上限，角色帖永不清（authorType 区分）。
  const FORUM_NPC_CAP = 30;
  // 一次生成仍只花一次调用，但不要把整批内容同一秒倒给 Lisa。
  // 前两帖/前三楼立即出现，其余作为本地活动队列按真实时间陆续解锁；旧数据没有 visibleAt 时照常立即可见。
  const FORUM_POST_STAGGER_MS = [0, 0, 20 * 60000, 65 * 60000, 150 * 60000];
  const forumCommentVisibleAt = (base, index, salt) => {
    if (index < 3) return base;
    const steps = [8, 18, 35, 55, 80, 110, 145, 185, 230, 280, 335, 395, 460, 530, 605];
    const minute = steps[Math.min(index - 3, steps.length - 1)] + ((Number(salt) || 0) % 5);
    return base + minute * 60000;
  };
  const forumBoardVoice = b => ({
    "吐槽吧": "「吐槽吧」：网友在这儿发牢骚、阴阳怪气、吐槽不爽。语气刻薄、损、带情绪、标题党，别正能量别说教。",
    "日常吧": "「日常吧」：网友分享兴趣、日常、和谁都无关的琐碎生活。语气松弛随意、有生活气，像随手一发。",
    "求助吧": "「求助吧」：网友来提问 / 求助，也有人认真回答。就事论事、具体、别空谈，标题多是疑问句。",
    "兴趣吧": "「兴趣吧」：聊作品、游戏、吃喝、设备、收藏、学习进度和具体爱好。要有细节、有偏好，像同好交流，不要写成泛泛日记。",
    "脑洞吧": "「脑洞吧」：发假设题、投票、接龙、挑战和离谱但能参与的问题。重点是让楼下接得上，别写成普通生活流水账。",
    "匿名吧": "「匿名吧」：不署名才敢说的话。真实、赤裸、卸下人设的一面，可以是秘密、软肋、见不得人的念头。别端着。"
  }[b] || "");
  // 随机互动数（赞/浏览/转发），据种子稳定生成，纯展示
  const forumCounts = (seed, replyCount) => { const hh = forumHash(seed); const rc = replyCount || (12 + hh % 480); return { replyCount: rc, likeCount: Math.floor(rc * (0.6 + (hh % 40) / 25)) + (hh % 40), viewCount: rc * (8 + hh % 90) + (hh % 600), rtCount: Math.floor(rc / (5 + hh % 14)) }; };
  // 角色贴吧资料（AI 生成一次存 forumCharMeta；没生成时用 charId 稳定兜底）
  // 兜底注册时间锚在固定过去点（不随 now 漂移，这样吧龄才会随真实时间增长）
  const FORUM_EPOCH = 1704067200000; // 2024-01-01
  const FORUM_ALT_NAMES = ["潮汐背面", "纸箱里的月亮", "低电量漫游", "未读草稿", "玻璃杯沿", "倒数第二排", "雨停再走", "临时观众", "不响的铃", "偏航一厘米", "凌晨便利店", "折叠地图"];
  const FORUM_HABIT_PRESETS = [
    { boards: ["日常吧", "兴趣吧"], participation: "潜水为主，碰到真有兴趣的细节才回", replyStyle: "短评、偶尔分享自己的小经验", identityBias: "main" },
    { boards: ["吐槽吧", "脑洞吧"], participation: "爱接梗和盖楼，较少认真开长帖", replyStyle: "嘴快、有梗，但正事会收", identityBias: "alt" },
    { boards: ["求助吧", "兴趣吧"], participation: "更爱认真回复别人，自己发帖不频繁", replyStyle: "具体、分点、反感空话", identityBias: "main" },
    { boards: ["匿名吧", "日常吧"], participation: "平时安静，积累到有话才发", replyStyle: "克制，只说自己确定的部分", identityBias: "alt" },
    { boards: ["兴趣吧", "脑洞吧"], participation: "会主动开话题，也愿意跟熟楼", replyStyle: "好奇、会追问具体细节", identityBias: "alt" },
    { boards: ["吐槽吧", "求助吧"], participation: "看得多回得少，遇到原则问题会开口", replyStyle: "直接、有边界、不跟风", identityBias: "main" }
  ];
  const charForumMeta = c => { const m = (forumCharMetaRef.current[c.id]) || {}; const hh = forumHash(c.id); const altName = m.altName || FORUM_ALT_NAMES[hh % FORUM_ALT_NAMES.length]; const habit = FORUM_HABIT_PRESETS[hh % FORUM_HABIT_PRESETS.length]; return { handle: m.handle || c.name, bio: m.bio != null ? m.bio : (c.motto || ""), joinTs: m.joinTs || (FORUM_EPOCH + (hh % 600) * 86400000), following: m.following != null ? m.following : (20 + hh % 380), followers: m.followers != null ? m.followers : (300 + (hh * 7) % 60000), altName, altHandle: m.altHandle || ("side_" + hh.toString(36).slice(0, 6)), altBio: m.altBio || (habit.participation + "。" + habit.replyStyle), altAvatarSeed: m.altAvatarSeed || ((m.altHandle || "side_" + hh.toString(36)) + ":mask"), altJoinTs: m.altJoinTs || (FORUM_EPOCH + ((hh * 13) % 760) * 86400000), altFollowing: m.altFollowing != null ? m.altFollowing : (8 + hh % 140), altFollowers: m.altFollowers != null ? m.altFollowers : (30 + (hh * 11) % 6800), boardPrefs: Array.isArray(m.boardPrefs) && m.boardPrefs.length ? m.boardPrefs : habit.boards, participation: m.participation || habit.participation, replyStyle: m.replyStyle || habit.replyStyle, identityBias: m.identityBias || habit.identityBias }; };
  // 在逛论坛的角色（默认全部；被 forumOff 关掉的不算）
  const forumActiveChars = () => (characters || []).filter(c => !forumOffRef.current.includes(c.id));
  const forumCharList = () => forumActiveChars().map(c => { const m = charForumMeta(c); return "「" + c.name + "」（" + String(c.persona || "").slice(0, 36) + "｜常逛" + m.boardPrefs.join("/") + "｜" + m.participation + "｜回帖：" + m.replyStyle + "｜常用" + (m.identityBias === "alt" ? "小号" : "大号") + "）"; }).join("；");
  const toggleForumChar = charId => setForumOff(prev => { const n = prev.includes(charId) ? prev.filter(x => x !== charId) : [...prev, charId]; saveJSON("x_forumOff", n); return n; });
  // NPC 主帖不绑定具体角色，用一个「论坛网友」合成 ctx（仍带世界书 + 去人机味总则）
  const forumWorldCtx = () => ({ char: { name: "论坛网友", persona: "你在推演这个世界里形形色色的普通网友，不是某个特定角色，风格各异。" }, chars: characters, rels, worldbook, profile, timeAware: prefs.timeAware });
  const forumNpcPool = board => {
    const exact = FORUM_NPC_REGISTRY.filter(n => (n.boards || []).includes(board));
    return exact.length ? exact : FORUM_NPC_REGISTRY.filter(n => !(n.boards || []).includes("匿名吧"));
  };
  const forumNpcRoster = board => forumNpcPool(board).map(n => n.id + "=「" + n.name + "」@" + n.handle + "（" + n.voice + "）").join("；");
  const forumNpcRelationLines = board => {
    const ids = new Set(forumNpcPool(board).map(n => n.id));
    return FORUM_NPC_RELATIONS.filter(r => ids.has(r.a) && ids.has(r.b)).map(r => {
      const a = FORUM_NPC_REGISTRY.find(n => n.id === r.a), b = FORUM_NPC_REGISTRY.find(n => n.id === r.b);
      return "· 「" + a.name + "」↔「" + b.name + "」：" + r.tone;
    });
  };
  // Lisa 与熟面孔的「公开碰面账」：只存次数/时间，不存帖子正文，更不读取私聊。
  // 作用只是让见过几次的网友下回认得她的公开账号；不是人物记忆，也不影响私聊角色。
  const forumPublicTies = () => {
    const raw = loadJSON("x_forumPublicTies", { version: 1, items: {} });
    return raw && raw.version === 1 && raw.items && typeof raw.items === "object" ? raw : { version: 1, items: {} };
  };
  const touchForumPublicTie = npcId => {
    if (!FORUM_NPC_REGISTRY.some(n => n.id === npcId && !(n.boards || []).includes("匿名吧"))) return;
    const book = forumPublicTies(), old = book.items[npcId] || {};
    book.items[npcId] = { encounters: Math.min(999, (Number(old.encounters) || 0) + 1), lastTs: Date.now() };
    saveJSON("x_forumPublicTies", book);
  };
  const forumPublicTieLines = board => {
    const book = forumPublicTies(), handle = forumMe.handle || profile.name || "Lisa";
    return forumNpcPool(board).map(n => ({ n, tie: book.items[n.id] })).filter(x => x.tie && Number(x.tie.encounters) > 0)
      .sort((a, b) => Number(b.tie.lastTs || 0) - Number(a.tie.lastTs || 0)).slice(0, 5)
      .map(x => "· 「" + x.n.name + "」曾在公开楼里和 @" + handle + " 碰过 " + Math.min(9, Number(x.tie.encounters) || 1) + " 次；再次正面遇见时可以自然认出账号，但不能声称知道她的私生活");
  };
  const forumNpcRule = board => {
    const ties = forumNpcRelationLines(board), userTies = forumPublicTieLines(board);
    return "\n【论坛人口】约六成发言来自固定熟面孔（填 npcId）：" + forumNpcRoster(board) + "。同一 npcId 必须保持对应习惯；其余约四成可以是只在这一帖出现的普通路人（不填 npcId，改填 guestName、guestHandle，名字自然、不套用常驻名单）。同一批别让同一个熟面孔连续刷屏。"
      + (ties.length ? "\n【熟面孔之间已经存在的公开交情】\n" + ties.join("\n") + "\n同帖遇见时可以自然接旧梗、附和或抬杠；别每次重新自我介绍，也别把公开交情写成私密记忆。" : "")
      + (userTies.length ? "\n【与用户公开账号的既往碰面】\n" + userTies.join("\n") + "\n只承认公开见过，别凭空补共同经历。" : "") + "\n";
  };
  const forumNpcOf = (x, board, salt) => {
    const pool = forumNpcPool(board);
    const wanted = String((x && (x.npcId || x.npc_id)) || "");
    const handle = String((x && x.handle) || "").replace(/^@/, "").toLowerCase();
    const name = String((x && x.authorName) || "");
    return pool.find(n => n.id === wanted) || pool.find(n => n.handle.toLowerCase() === handle) || pool.find(n => n.name === name) || pool[forumHash(String((x && (x.content || x.title)) || "") + ":" + salt) % pool.length];
  };
  const forumGuestOf = (x, salt) => {
    const seed = String((x && (x.guestName || x.authorName || x.content || x.title)) || "路过的人") + ":" + salt;
    const hh = forumHash(seed);
    const name = String((x && (x.guestName || x.authorName)) || ("路过的" + ["夜猫", "云", "纸片", "柚子", "螺丝", "海风"][hh % 6]));
    const handle = String((x && (x.guestHandle || x.handle)) || ("passer_" + hh.toString(36))).replace(/^@/, "");
    return { id: "npc_guest_" + hh.toString(36), name, handle };
  };
  const forumPublicNpcOf = (x, board, salt) => (x && (x.guestName || x.guestHandle) && !(x.npcId || x.npc_id)) ? forumGuestOf(x, salt) : forumNpcOf(x, board, salt);
  const forumCharIdentity = (char, mode, board) => {
    const m = charForumMeta(char);
    if (board === "匿名吧" || mode === "anonymous") return { authorType: "character_anon", authorName: "匿名用户", authorHandle: "anonymous" };
    if ((mode || m.identityBias) === "alt") return { authorType: "character_alt", authorName: m.altName, authorHandle: m.altHandle };
    return { authorType: "character", authorName: char.name, authorHandle: m.handle };
  };
  const isForumCharAuthor = x => !!(x && String(x.authorType || "").startsWith("character"));
  // runProbe 简单重试：单次结构化内容偶尔截断/解析失败，重试一次
  const runProbeRetry = async (p, ctx, probe) => { try { return await runProbe(p, ctx, probe); } catch (e) { return await runProbe(p, ctx, probe); } };
  // 写入帖子并对该版块做 NPC 硬上限清理（删最旧 NPC 帖，角色帖免疫）
  const appendForumPosts = (recs, board) => setForumPosts(prev => {
    let n = [...recs, ...prev];
    const npcInBoard = n.filter(x => x.board === board && x.authorType === "npc").sort((a, b) => b.ts - a.ts);
    if (npcInBoard.length > FORUM_NPC_CAP) {
      const kill = new Set(npcInBoard.slice(FORUM_NPC_CAP).map(x => x.id));
      n = n.filter(x => !kill.has(x.id));
    }
    saveJSON("x_forumPosts", n);
    return n;
  });
  // 版块刷新：生成 3-5 条 NPC 主帖（只主帖，不含评论——评论点进去才懒加载）
  const genForumBoard = async board => {
    if (!active) { toast("请先到设置配置 API"); return; }
    setGen(g => ({ ...g, forum: board }));
    const anonB = board === "匿名吧";
    try {
      const d = await runProbeRetry(active, forumWorldCtx(), {
        instruction: forumBoardVoice(board) + forumNpcRule(board) + " 生成 3-5 条不同网友刚发的新主帖（items 数组务必 3-5 条，别只给 1-2 条）。熟面孔填 npcId；一次性路人填 guestName、guestHandle。写 title（标题）、body（楼主正文 2-4 句）、replyCount（编一个几十到几千的回复数字，不必真实）。同一批至少有 1 个一次性路人，别所有帖一个腔调。",
        schemaHint: "{\"items\":[{\"npcId\":\"npc_regular_xxx（熟面孔才填）\",\"guestName\":\"一次性路人昵称（路人才填）\",\"guestHandle\":\"路人id\",\"title\":\"标题\",\"body\":\"正文\",\"replyCount\":128}]}",
        maxTokens: 3400
      });
      let items = (d && Array.isArray(d.items) ? d.items : (Array.isArray(d) ? d : (d && d.title ? [d] : []))).filter(x => x && x.title);
      if (!items.length) throw new Error("没有生成内容");
      const base = Date.now();
      const recs = items.map((x, i) => {
        const npc = forumPublicNpcOf(x, board, i);
        const stagger = FORUM_POST_STAGGER_MS[i] != null ? FORUM_POST_STAGGER_MS[i] : (150 + (i - 4) * 90) * 60000;
        const visibleAt = base + stagger;
        return ({
        id: "fp_" + base + "_" + i, authorId: npc.id, authorType: "npc",
        authorName: npc.name, authorHandle: npc.handle,
        board, title: x.title, body: x.body || "",
        anon: anonB, triggerSource: "", ts: visibleAt, visibleAt,
        ...forumCounts(npc.id + ":" + x.title + i, Number(x.replyCount))
        });
      });
      appendForumPosts(recs, board);
    } catch (e) { toast("刷新失败：" + e.message); }
    finally { setGen(g => ({ ...g, forum: null })); }
  };
  // 一条原始评论 → 楼层对象（回复者随机 NPC 或某个符合人设的角色，x.char=角色名则归到该角色）
  // post 传入时用于识别「楼主」：楼主不另开楼自问自答（顶楼命中→丢弃），楼主的追评正确署名+标记 isOp
  const buildForumFloor = (x, floorNo, base, idx, post) => {
    const opChar = post && isForumCharAuthor(post) ? (characters || []).find(c => c.id === post.authorId) : null;
    const opName = opChar ? opChar.name : (post ? (post.authorName || "") : "");
    const looksOp = s => { s = String(s || "").trim().toLowerCase(); return s === "楼主" || s === "楼主本人" || s === "lz"; };
    const isOpOf = obj => obj.is_op === true || (opName && obj.char === opName) || looksOp(obj.char) || looksOp(obj.authorName);
    // 顶楼若是楼主本人（自问自答）→ 丢弃，让别的楼补位
    if (isOpOf(x)) return null;
    const cc = (characters || []).find(c => c.name === x.char);
    const identity = cc ? forumCharIdentity(cc, x.identity, (post && post.board) || "日常吧") : null;
    const npc = cc ? null : forumPublicNpcOf(x, (post && post.board) || "日常吧", idx);
    return {
      id: "fc_" + base + "_" + idx,
      authorId: cc ? cc.id : npc.id,
      authorType: cc ? identity.authorType : "npc",
      authorName: cc ? identity.authorName : npc.name,
      authorHandle: cc ? identity.authorHandle : npc.handle,
      floor: floorNo, content: x.content, ts: base + idx, likeCount: forumHash((x.content || "") + idx) % 300,
      replies: (Array.isArray(x.replies) ? x.replies : []).filter(r => r && r.content).map(r => {
        if (isOpOf(r)) {
          // 楼主本人回某条评论：正确署名（角色→真名，否则楼主网名），并打上「楼主」小标
          if (opChar) return { authorName: post.authorName, authorHandle: post.authorHandle, authorType: post.authorType, authorId: opChar.id, content: r.content, isOp: true, ts: base + idx };
          return { authorName: opName || (post && post.authorName) || "楼主", authorHandle: (post && post.authorHandle) || opName || "lz", authorType: post && post.authorType === "me" ? "me" : "npc", authorId: post && post.authorType === "me" ? "me" : null, content: r.content, isOp: true, ts: base + idx };
        }
        const rc = (characters || []).find(c => c.name === r.char);
        const rn = rc ? null : forumPublicNpcOf(r, (post && post.board) || "日常吧", idx + ":reply");
        const ri = rc ? forumCharIdentity(rc, r.identity, (post && post.board) || "日常吧") : null;
        return { authorName: rc ? ri.authorName : rn.name, authorHandle: rc ? ri.authorHandle : rn.handle, authorType: rc ? ri.authorType : "npc", authorId: rc ? rc.id : rn.id, content: r.content, ts: base + idx };
      })
    };
  };
  // 这帖里已经冒泡过的角色（顶楼作者 + 楼中楼作者都算）→ [{id,name}]，用于第二轮防重复
  const forumRepliedCharCells = floors => {
    const m = new Map();
    (floors || []).forEach(f => {
      if (f && String(f.authorType || "").startsWith("character") && f.authorId) m.set(f.authorId, f.authorName);
      (f && f.replies || []).forEach(r => { if (r && String(r.authorType || "").startsWith("character") && r.authorId) m.set(r.authorId, r.authorName); });
    });
    return [...m.entries()].map(([id, name]) => ({ id, name }));
  };
  // 在场角色两两之间的有向关系行（回帖者视角）——让顾暮回顾朝的帖时以「弟弟」身份说话，不当陌生人
  const forumRelLines = (pool, opChar) => {
    const present = [...pool];
    if (opChar && !present.some(c => c.id === opChar.id)) present.push(opChar);
    const lines = [];
    for (const a of pool) for (const b of present) {
      if (a.id === b.id) continue;
      const r = rels[a.id + "->" + b.id];
      if (r && r.label) lines.push("「" + a.name + "」眼中的「" + b.name + "」：" + r.label + (r.note ? "（" + r.note + "）" : ""));
    }
    return lines;
  };
  // 单条原始项 → 楼中楼 reply 对象（角色→真名档案、楼主→isOp、其余路人）；第二轮把「接某楼」的项挂进那层
  const buildForumReplyObj = (x, post) => {
    if (!x || !x.content) return null;
    const opChar = post && isForumCharAuthor(post) ? (characters || []).find(c => c.id === post.authorId) : null;
    const opName = opChar ? opChar.name : (post ? (post.authorName || "") : "");
    const looksOp = s => { s = String(s || "").trim().toLowerCase(); return s === "楼主" || s === "楼主本人" || s === "lz" || s === "帖主"; };
    if (x.is_op === true || (opName && x.char === opName) || looksOp(x.char) || looksOp(x.authorName)) {
      if (opChar) return { authorName: post.authorName, authorHandle: post.authorHandle, authorType: post.authorType, authorId: opChar.id, content: x.content, isOp: true, ts: Date.now() };
      return { authorName: opName || "楼主", authorHandle: (post && post.authorHandle) || opName || "lz", authorType: post && post.authorType === "me" ? "me" : "npc", authorId: post && post.authorType === "me" ? "me" : null, content: x.content, isOp: true, ts: Date.now() };
    }
    const cc = (characters || []).find(c => c.name === x.char);
    if (cc) { const ci = forumCharIdentity(cc, x.identity, (post && post.board) || "日常吧"); return { authorName: ci.authorName, authorHandle: ci.authorHandle, authorType: ci.authorType, authorId: cc.id, content: x.content, ts: Date.now() }; }
    const npc = forumPublicNpcOf(x, (post && post.board) || "日常吧", "reply");
    return { authorName: npc.name, authorHandle: npc.handle, authorType: "npc", authorId: npc.id, content: x.content, ts: Date.now() };
  };
  // 楼主是角色时的「真实背景」注入：人设 + 按帖子话题检索到的真实记忆——楼主回帖补细节时必须依据这些，别现编。
  // （根治「楼主回复细节时开始编而不是参考实际发生的事」：原来论坛全走通用「论坛网友」ctx，楼主没自己的记忆可依据。）
  const forumOpGroundingFor = (opChar, post) => {
    if (!opChar) return "";
    const q = (post.title || "") + " " + (post.body || "");
    let mems = [];
    try { mems = retrieveMemories(memLibRef.current, opChar.id, q, { limit: 6, touch: false, vec: false }); } catch (e) {}
    const memText = (mems || []).map(m => "· " + String(m.text || "").replace(/\s+/g, " ").slice(0, 80)).join("\n");
    const persona = String(opChar.persona || "").replace(/\s+/g, " ").slice(0, 200);
    return "\n【楼主「" + opChar.name + "」本人的真实设定与经历——楼主回帖／补充细节时【必须】依据这些真实情况，绝不能编造没发生过的事、不存在的经历、或不符人设的细节】\n人设：" + persona + (memText ? "\n相关真实记忆：\n" + memText : "") + "\n";
  };
  const forumCommentProbe = (post, n, opts = {}) => {
    const isSearch = /^搜索/.test(post.triggerSource || "");
    const opChar = isForumCharAuthor(post) ? (characters || []).find(c => c.id === post.authorId) : null;
    const opName = opChar ? opChar.name : (post.authorType === "me" ? (forumMe.handle || profile.name || "我") : (post.authorName || "楼主"));
    // 逛论坛的角色池要排除楼主本人——楼主不会在自己帖下冒泡回复自己
    const poolChars = forumActiveChars().filter(c => !opChar || c.id !== opChar.id);
    const persona1 = c => { const fm = charForumMeta(c); return "「" + c.name + "」（" + String(c.persona || "").replace(/\s+/g, " ").slice(0, 80) + (moods[c.id] && moods[c.id].label ? "｜此刻心情：" + moods[c.id].label : "") + "｜论坛习惯：常逛" + fm.boardPrefs.join("/") + "，" + fm.participation + "，" + fm.replyStyle + "，偏向" + (fm.identityBias === "alt" ? "小号" : "大号") + "）"; };
    const poolStr = poolChars.map(persona1).join("；");
    // 在场角色间关系（搜索吧是陌生话题、不注入关系）
    const relLines = isSearch ? [] : forumRelLines(poolChars, opChar);
    const relBlock = relLines.length ? "\n【在场角色之间的关系——同帖出现的角色按真实身份互动，绝不当陌生人（该是兄弟/恋人/对头/师徒就用那样的口吻，别客气疏离）】\n"
      + relLines.slice(0, 24).join("\n")
      + "\n⚠️【上面这条只管大号】有人用【小号或匿名】发言时，默认在场其他角色**认不出那是谁**——那正是小号存在的意义，别按真实关系去接话。\n"
      + "只有一种例外：两人近到【现实里本来就知道对方的小号】（双胞胎、同住的家人、伴侣、天天混在一起的死党——照上面的关系描述自己判断），这种可以认出来。\n"
      + "⚠️就算认出来，也**绝不许在公开楼里点破**：「这不是我哥吗」「你小号还发这个」都算把对方的号当众曝光。要么装不认识，要么用只有你俩懂的方式暗接一句。\n" : "";
    // 楼主规则：别自问自答、别把谁的名字写成「楼主」
    // 楼主是她本人时，得说清楚那是【他们认识的那个人】——否则只看到一个网名，
    // 角色只能按陌生人科普。大号要认出她，小号知道是她但必须装不认识（她 2026-08-25）。
    const meOwn = post.authorType === "me" && !post.anon && post.board !== "匿名吧";
    const meRule = !meOwn ? "" : ("\n【楼主「" + opName + "」就是你们认识的那个人·她的公开账号】\n"
      + "· 用【大号】回复的角色：你一眼认得出是她，就按你和她真实的关系说话——该关心就关心、该调侃就调侃、该教训就教训。"
      + "**别用对陌生人科普的腔**（「建议你拿手机在侧后方录个视频」那种），你跟她说话不是这个语气。\n"
      + "· ⚠️但这是【公开楼】：别在正文里点破你和她是什么关系，也别把只有你俩知道的事当众说出来——"
      + "认得出是熟人、语气自然带着熟悉感就够了，剩下的留到私聊。\n"
      + "· 用【小号或匿名】回复的角色：你【知道】那是她，但你正在装不认识。"
      + "**绝不许说任何只有熟人才知道的事**——她的经历、你俩的旧事、她的习惯、她画画/工作的细节，一个都不许提，"
      + "那等于当众自曝。宁可只给通用建议，也不能露。\n");
    const opRule = "【楼主是" + (opChar ? "角色「" + opName + "」本人" : "网名「" + opName + "」") + "】楼里是【别人】来回复这个帖。" + meRule
      + (opChar ? "楼主「" + opName + "」**绝对不要在这里另开一楼回复自己、更不要自问自答（很不合理）**；除非是回复楼里某条具体评论，那种情况放进那条楼层的 replies 里、并把 is_op 设 true。" : "楼主一般不再单独开楼。")
      + " **任何一条楼层或追评的 authorName 都不许写成『楼主』『lz』这类词——路人各有自己的网名。**";
    // ── 第二轮起（继续刷楼/盖楼）：防同一角色前后发两条不相干意见 ──
    if (opts.round2) {
      const repliedCells = opts.repliedChars || [];
      const repliedIds = new Set(repliedCells.map(c => c.id));
      const notReplied = poolChars.filter(c => !repliedIds.has(c.id));
      const replied = poolChars.filter(c => repliedIds.has(c.id));
      const floors = opts.existingFloors || [];
      const floorLines = floors.slice(-14).map(f => f.floor + "楼 " + (f.authorName || "某人") + "：" + String(f.content || "").replace(/\s+/g, " ").slice(0, 60)).join("\n");
      const who2 = "这是同一个帖子的【继续刷楼、盖楼】，续着往下刷、别重开话题。下面是已经有的楼层：\n" + (floorLines || "（暂无）") + "\n\n"
        + "**大多数新楼是网友**七嘴八舌盖楼：常驻熟面孔与一次性路人混合，别一个腔调。\n"
        + (isSearch ? "**全程只有路人**，不要出现任何你认识的角色。\n"
          : (notReplied.length ? "【这轮还没冒泡、可以新开一楼发表自己观点的角色】（真关心这话题才出现，严格贴人设与此刻心情，写不出贴人设的就别塞、宁可全路人）：" + notReplied.map(persona1).join("；") + "。\n" : "")
            + (replied.length ? "【已经在这帖回过的角色】：" + replied.map(c => "「" + c.name + "」").join("、") + "——**绝对别再让他们开一楼发表新的、和之前不相干的观点**（真实贴吧里没人对同一个帖前后连发两条无关的话）。他们这轮只有两种合法出场：① 在某一楼下用楼中楼接话（附和或反驳那层的人，把 reply_to_floor 设成那层的楼号）；② 开一楼，但必须是【明确接着上面某一楼的话往下说／盖楼／反驳】，reply_to_floor 设成所接的楼号——绝不能是凭空冒出的新观点。\n" : ""))
        + "若某楼或某追评是某角色发的，就填 char=角色名（不要再另填 authorName）。";
      // 后续轮楼主可以回帖了（贴吧楼主会回楼：回应质疑/道谢/补充），但只针对已有楼层、且细节必须依据真实背景
      const opRule2 = opChar
        ? "【楼主是角色「" + opName + "」本人】这一轮楼主**可以回来回帖**（贴吧楼主常回楼：回应质疑、道谢、补充说明）——但楼主的发言只能是【针对楼里已经有人说的话】去回应：把 reply_to_floor 设成要回的那层楼号、is_op 设 true。**楼主回复里的任何细节都必须符合下方【楼主真实设定】里的真实经历与人设，绝不许现编、不许无中生有捏造没发生过的事**。别自问自答、别开一个跟原帖无关的新话题。"
        : "【楼主网名「" + opName + "」】楼主这轮可以回楼回应大家（针对已有楼层，reply_to_floor + is_op=true），别自问自答开新话题。"
          + " **任何一条楼层或追评的 authorName 都不许写成『楼主』『lz』这类词——路人各有自己的网名。**";
      const opGround = forumOpGroundingFor(opChar, post);
      // 第二轮起同样要认得出楼主是她（她发帖后那几波陆续来回走的正是这条路）
      const opRule2Full = opRule2 + meRule;
      return {
        instruction: forumBoardVoice(post.board) + forumNpcRule(post.board) + " " + opRule2Full + relBlock + opGround + " 帖子：标题「" + post.title + "」，正文「" + (post.body || "") + "」。生成 " + n + " 条新回复（comments 数组务必凑满 " + n + " 条）。" + who2 + " 部分楼可带 replies 楼中楼（1-3 条追评/接梗/对骂）。",
        schemaHint: "{\"comments\":[{\"npcId\":\"熟面孔才填\",\"guestName\":\"一次性路人才填\",\"guestHandle\":\"路人id\",\"char\":\"角色发言才填角色名\",\"identity\":\"main|alt|anonymous（角色才填）\",\"reply_to_floor\":0,\"is_op\":false,\"content\":\"回复\",\"replies\":[]}]}",
        maxTokens: 7200
      };
    }
    // ── 第一轮（首次点进帖）：不必全员回复，路人为主、真关心的角色偶尔冒泡 ──
    const who = isSearch
      ? "**楼里是常驻熟面孔与一次性路人的混合**，**不要出现你认识的任何角色**——这是搜来的陌生话题吧。"
      : "**大多数楼是常驻熟面孔与一次性路人**；只有当下面某个角色**此刻真的会关心这个话题**时，才偶尔（约 1/4 的楼）让 Ta 冒泡回帖或抬杠。角色可以按性格选择 identity=main（大号）、alt（固定小号）或 anonymous（匿名）；小号/匿名的文字仍必须贴本人，但绝不能在正文自曝身份。**第一轮不必让所有角色都出现**；写不出贴人设的评论就别让 Ta 出现，宁可全路人、绝不 OOC：" + (poolStr || "（暂无其他角色）") + "。角色发言填 char=角色名与 identity，不再填 npcId。";
    return {
      instruction: forumBoardVoice(post.board) + forumNpcRule(post.board) + " " + opRule + relBlock + " 帖子：标题「" + post.title + "」，正文「" + (post.body || "") + "」。楼下网友陆续回复。生成 " + n + " 楼回复（comments 数组务必凑满 " + n + " 条，宁可每条精简），贴合该吧语气、七嘴八舌别一个腔调。" + who + "部分楼可带 replies 楼中楼（1-3 条追评/接梗/对骂" + (isSearch ? "，也全是常驻网友" : "，可以是常驻网友或角色 char，或楼主回某条评论时 is_op=true") + "），大多数楼 replies 留空。",
      schemaHint: "{\"comments\":[{\"npcId\":\"熟面孔才填\",\"guestName\":\"一次性路人才填\",\"guestHandle\":\"路人id\",\"char\":\"角色才填\",\"identity\":\"main|alt|anonymous\",\"content\":\"回复\",\"replies\":[]}]}",
      maxTokens: 6000
    };
  };
  // 评论懒加载：点进帖子若无缓存，生成 8-12 楼（含楼中楼），存缓存，再点不重复调 API
  const loadForumComments = async post => {
    if (forumCommentsRef.current[post.id]) return; // 已缓存
    if (!active) return;
    // 进行中锁：生成要十几秒，期间退出再进会绕过缓存守卫又发一次——两份结果先后落盘、后到的把先到的整个盖掉
    // （用户读过的一楼会凭空变内容，钱包覆盖事故同款）。锁住 + 完成时再查缓存，双保险。
    if (forumCInflightRef.current[post.id]) return;
    forumCInflightRef.current[post.id] = true;
    setGen(g => ({ ...g, forumC: post.id }));
    try {
      const d = await runProbeRetry(active, forumWorldCtx(), forumCommentProbe(post, "12-18"));
      if (!forumCommentsRef.current[post.id]) { // 等待期间别处已写入 → 保留先到的，绝不覆盖
        let cs = (d && Array.isArray(d.comments) ? d.comments : (Array.isArray(d) ? d : [])).filter(x => x && x.content);
        if (!cs.length) cs = [{ authorName: "沙发", content: "（还没人接话）", replies: [] }];
        const base = Date.now();
        const salt = forumHash(post.id) % 5;
        const list = cs.map((x, i) => buildForumFloor(x, i + 2, base, i, post)).filter(Boolean).map((f, i) => ({
          ...f, floor: i + 2, visibleAt: forumCommentVisibleAt(base, i, salt), ts: forumCommentVisibleAt(base, i, salt)
        }));
        setForumComments(prev => prev[post.id] ? prev : (() => { const n = { ...prev, [post.id]: forumFloorOrder(list) }; saveJSON("x_forumComments", n); return n; })());
      }
    } catch (e) { toast("加载评论失败：" + e.message); }
    finally { forumCInflightRef.current[post.id] = false; setGen(g => ({ ...g, forumC: null })); }
  };
  // 更多回复（第二轮起，量放大 10-16）：没回过的角色补新楼；已回过的不再开不相干新楼——
  // 只能盖楼中楼(reply_to_floor)接话/反驳。按 reply_to_floor 把项拆成「新楼」与「挂进已有楼的追评」两路。
  const genMoreComments = async post => {
    if (!active) { toast("请先到设置配置 API"); return; }
    setGen(g => ({ ...g, forumMore: post.id }));
    try {
      const existing = forumFloorOrder(forumCommentsRef.current[post.id] || []);
      // 报给模型的只能是【已经露面】的楼——排在几小时后的队里那些她自己都还没看到，
      // 让模型去接那种楼，回出来的话就成了对空气说的。防重复发言的名单仍看全部楼层。
      const shownFloors = existing.filter(f => !f.visibleAt || Number(f.visibleAt) <= Date.now());
      const repliedChars = forumRepliedCharCells(existing);
      const d = await runProbeRetry(active, forumWorldCtx(), forumCommentProbe(post, "10-16", { round2: true, existingFloors: shownFloors, repliedChars }));
      let cs = (d && Array.isArray(d.comments) ? d.comments : (Array.isArray(d) ? d : [])).filter(x => x && x.content);
      if (!cs.length) throw new Error("没有更多");
      const base = Date.now();
      const floorByNum = new Map(existing.map(f => [f.floor, f]));
      const newRaw = [], subInserts = [];   // subInserts: {floorId, reply}
      cs.forEach(x => {
        const tf = Number(x.reply_to_floor);
        if (Number.isFinite(tf) && tf > 0 && floorByNum.has(tf)) {
          const rep = buildForumReplyObj(x, post);
          if (rep) subInserts.push({ floorId: floorByNum.get(tf).id, reply: rep });
        } else newRaw.push(x);
      });
      const start = existing.length + 2;
      const salt = forumHash(post.id + ":more:" + existing.length) % 5;
      const more = newRaw.map((x, i) => buildForumFloor(x, start + i, base, forumHash(post.id) % 9999 + i, post)).filter(Boolean).map((f, i) => ({
        ...f, floor: start + i, visibleAt: forumCommentVisibleAt(base, i, salt), ts: forumCommentVisibleAt(base, i, salt)
      }));
      if (!more.length && !subInserts.length) throw new Error("没有更多");
      setForumComments(prev => {
        let list = prev[post.id] || [];
        if (subInserts.length) list = list.map(f => {
          const adds = subInserts.filter(s => s.floorId === f.id).map(s => s.reply);
          return adds.length ? { ...f, replies: [...(f.replies || []), ...adds] } : f;
        });
        list = forumFloorOrder([...list, ...more]);
        const n = { ...prev, [post.id]: list }; saveJSON("x_forumComments", n); return n;
      });
      bumpReplyBy(post.id, more.length + subInserts.length);
    } catch (e) { toast(e.message); }
    finally { setGen(g => ({ ...g, forumMore: null })); }
  };
  // 角色发帖（可被未来「统一发布决策调度器」调用；本次也用于手动让某角色发帖）
  // 入参：角色、版块、内容对象 {title, body}。内部负责写 posts 表（authorType='character'）。
  const postCharToForum = (char, board, content, triggerSource) => {
    const anonB = board === "匿名吧";
    const base = Date.now();
    const identity = forumCharIdentity(char, anonB ? "anonymous" : content.identity, board);
    const rec = {
      id: "fp_" + base, authorId: char.id, authorType: identity.authorType,
      authorName: identity.authorName, authorHandle: identity.authorHandle,
      board, title: content.title, body: content.body || "",
      anon: anonB, triggerSource: triggerSource || "", ts: base,
      ...forumCounts(char.id + base, content.replyCount || (3 + forumHash(char.id) % 40))
    };
    setForumPosts(prev => { const n = [rec, ...prev]; saveJSON("x_forumPosts", n); return n; });
    return rec;
  };
  // 手动让某角色发一条帖（版块可选，默认按内容让 AI 自己归吧）
  const genCharForumPost = async (char, board) => {
    if (!active) { toast("请先到设置配置 API"); return; }
    setGen(g => ({ ...g, forum: "char_" + char.id }));
    const anonB = board === "匿名吧";
    try {
      const d = await runProbeRetry(active, ctxFor(char), {
        instruction: "以「" + char.name + "」身份在贴吧「" + board + "」发一条帖（" + forumBoardVoice(board) + "）。内容和 Ta 最近的心情 / 对话 / 生活相关，但这是 Ta 不围着对方转的一面。自行选择 identity=main（大号）或 alt（固定小号）；匿名吧必须 identity=anonymous。小号/匿名不能自曝真实身份。给 title 和 body（2-4 句）。",
        schemaHint: "{\"identity\":\"main|alt|anonymous\",\"title\":\"标题\",\"body\":\"正文\"}",
        maxTokens: 1200
      });
      if (!d || !d.title) throw new Error("没有生成内容");
      postCharToForum(char, board, { title: d.title, body: d.body, identity: d.identity }, "手动发帖");
      toast(char.name + " 发了一条到「" + board + "」");
    } catch (e) { toast("发帖失败：" + e.message); }
    finally { setGen(g => ({ ...g, forum: null })); }
  };
  const toggleForumFollow = charId => setForumFollows(prev => {
    const n = prev.includes(charId) ? prev.filter(x => x !== charId) : [...prev, charId];
    saveJSON("x_forumFollows", n);
    return n;
  });
  // 转发帖子到私聊：只 push 卡片，【不自动回复】——她要转完接着说自己的话，说完按「回复」TA 再一起反应。
  // 帖子内容写进 content：回复走正常 replyNow 历史，TA 能一直记得这条帖（含自己匿名发的帖，认不认在正常回复里演）。
  const forwardPostToChat = (post, toChar) => {
    const isOwnAnon = post.anon && post.authorType === "character_anon" && post.authorId === toChar.id;
    const isOwnPost = isForumCharAuthor(post) && post.authorId === toChar.id;
    // 认出自己：这帖里若有 TA 本人发过的楼层/追评，随转发一起带上（让 TA 记得"这是我说过的话"）
    const mine = [];
    (forumCommentsRef.current[post.id] || []).forEach(f => {
      if (f && isForumCharAuthor(f) && f.authorId === toChar.id) mine.push(f.content);
      (f && f.replies || []).forEach(r => { if (r && isForumCharAuthor(r) && r.authorId === toChar.id) mine.push(r.content); });
    });
    const ownTag = isOwnAnon ? "｜（这条其实是你自己匿名发的——认不认随你人设）"
      : (isOwnPost ? "｜（这帖就是你自己发的）" : "");
    const mineTag = mine.length ? "｜（你本人在这帖里回过：" + mine.slice(0, 3).map(x => "“" + String(x).replace(/\s+/g, " ").slice(0, 40) + "”").join("；") + "——认得出是你自己说过的话）" : "";
    pChat(toChar.id, p => [...p, {
      role: "user", kind: "forumshare",
      post: { board: post.board, title: post.title, body: post.body, authorName: post.authorName, anon: !!post.anon },
      content: "[转发了一条贴吧帖]「" + post.board + "」《" + post.title + "》｜" + String(post.body || "").replace(/\s+/g, " ").slice(0, 160) + "｜作者显示：" + post.authorName + ownTag + mineTag,
      ts: Date.now(), read: false
    }]);
    toast("已转发给 " + (toChar.remark || toChar.name));
  };
  // 转发帖子到群聊：只 push 卡片（群反应可由用户点「让他们回复」触发）
  const forwardPostToGroup = (post, groupId) => {
    pGChat(groupId, p => [...p, {
      role: "user", kind: "forumshare", senderName: profile.name || "我",
      post: { board: post.board, title: post.title, body: post.body, authorName: post.authorName, anon: !!post.anon },
      ts: Date.now()
    }]);
    toast("已转发到群聊");
  };
  // ficshare 卡片的 content：让这篇文的 title/CP/作者/节选落进聊天历史，角色以后回看/重roll 才认得出是同一篇
  const ficShareContent = (s, note) => "[分享了一篇同人文]《" + s.title + "》｜CP：" + (s.cpText || "原创") + "｜作者：" + (s.author || "佚名") + (note ? "｜" + note : "") + (s.excerpt ? "｜开头：" + s.excerpt : "");
  // 转发同人文到私聊：push 一张 ficshare 卡片 + 角色随口读后感（Phase 2 才把新章 context 喂给角色）
  const forwardFicToChat = async (fic, toChar) => {
    const excerpt = ((fic.chapters || [])[0] || {}).content || fic.body || "";
    const cpNames = (fic.cp || []).map(id => id === "me" ? (profile.name || "我") : (function () { const c = characters.find(x => x.id === id); return c ? c.name : null; })()).filter(Boolean);
    const share = { title: fic.title, author: fic.author || "佚名", tags: fic.tags || [], excerpt: String(excerpt).slice(0, 120), cpText: cpNames.length ? cpNames.join(" × ") : "原创" };
    // 元认知：这篇是不是以 TA 为主角写的；TA 认不认识文里配对的另一位
    const cpIds = fic.cp || [];
    const isStar = cpIds.indexOf(toChar.id) >= 0;
    pChat(toChar.id, p => [...p, { role: "user", kind: "ficshare", fic: share, content: ficShareContent(share, isStar ? "这篇是写你的" : ""), ts: Date.now(), read: false }]);
    toast("已转发给 " + (toChar.remark || toChar.name));
    // 【不自动回复】她要转完接着说话，说完按「回复」TA 再反应；是不是写 TA 的、配对认不认识，
    // content 里带了「这篇是写你的」标记 + 关系网本来就在 bundle 里，正常回复时 TA 演得出来。
  };
  // 塔罗「给角色算一卦」转发给对应角色：把这一卦发进 Ta 的私聊，让 Ta 读后反应
  const forwardTarotToChat = async (session) => {
    const toChar = characters.find(c => c.id === session.charId);
    if (!toChar) { toast("找不到这个角色"); return; }
    const cardsTxt = (session.cards || []).map((c, i) => ((session.spread || [])[i] ? session.spread[i] + "：" : "") + c.name + (c.rev ? "（逆位）" : "（正位）")).join("；");
    const readTxt = (session.reads || []).map(r => (r.pos ? r.pos + "—" : "") + r.text).join("\n");
    const summary = session.summary || "";
    const shareText = "【塔罗 · 我替你算了一卦】\n" + cardsTxt + (summary ? "\n\n" + summary : "");
    pChat(toChar.id, p => [...p, { role: "user", content: shareText, ts: Date.now(), read: false }]);
    toast("已把这一卦转发给 " + (toChar.remark || toChar.name));
    if (!active) return;
    const instruction = "有人（用户）替你算了一卦塔罗，把结果发给你看了。抽到的牌与解读：\n牌：" + cardsTxt + "\n解读：\n" + readTxt + (summary ? "\n收束：" + summary : "") +
      "\n\n你【读到一份替你自己算的命卦】，按你的人设和此刻心情真实反应（信或不信、在意哪一句、被说中了还是嗤之以鼻、追问、或借机说点心里话都行，1-3 句可多气泡），别客服腔、别复述全文。";
    try {
      const react = await runProbe(apiFor(toChar.id), ctxFor(toChar), { instruction: instruction, schemaHint: "{\"say\":[\"气泡1\",\"气泡2\"]}", maxTokens: 900 });
      const say = react && Array.isArray(react.say) ? react.say : (react && react.say ? [react.say] : []);
      if (say.length) pChat(toChar.id, p => [...p, ...say.map(s => ({ role: "assistant", content: String(s), ts: Date.now(), read: false }))]);
    } catch (e) {/* 卡已在，反应失败静默 */}
  };
  const forwardFicToGroup = (fic, group) => {
    const excerpt = ((fic.chapters || [])[0] || {}).content || fic.body || "";
    const cpNames = (fic.cp || []).map(id => { const c = characters.find(x => x.id === id); return c ? c.name : null; }).filter(Boolean);
    const share = { title: fic.title, author: fic.author || "佚名", tags: fic.tags || [], excerpt: String(excerpt).slice(0, 120), cpText: cpNames.length ? cpNames.join(" × ") : "原创" };
    pGChat(group.id, p => [...p, { role: "user", kind: "ficshare", senderName: profile.name || "我", fic: share, content: ficShareContent(share), ts: Date.now() }]);
    toast("已转发到群聊");
  };
  // 追更：把新章推给曾被转发看过这篇的角色，让 Ta 读后随口反应
  const notifyChapterToChars = async (fic, chapter, chapNo, charIds) => {
    const chs = (charIds || []).map(id => characters.find(c => c.id === id)).filter(Boolean);
    if (!chs.length) return;
    const excerpt = String((chapter && chapter.content) || "").slice(0, 120);
    chs.forEach(ch => { const ufShare = { title: fic.title + "（更新·第" + chapNo + "章）", author: fic.author || "佚名", excerpt: excerpt, cpText: "" }; pChat(ch.id, p => [...p, { role: "user", kind: "ficshare", fic: ufShare, content: ficShareContent(ufShare, "你之前看过这篇"), ts: Date.now(), read: false }]); });
    toast("新章已同步给读过的角色");
    if (!active) return;
    const starIds = fic.cp || [];
    for (const ch of chs) {
      const isStar = starIds.indexOf(ch.id) >= 0;
      try {
        const react = await runProbe(apiFor(ch.id), ctxFor(ch), {
          instruction: "你之前被分享看过的那篇同人文《" + fic.title + "》更新了第" + chapNo + "章，你刚读完，开头是「" + excerpt + "」。" + (isStar ? "（这篇是【以你为主角写的】，你清楚自己正被人当小说人物编排，读新章时带着这份被写的自觉——好气又好笑/在意剧情怎么写你/想知道后面被安排成什么样。）" : "") + "按你的人设和此刻心情随口说两句读后感/催更/吐槽（1-2 句，可多气泡），别复述剧情、别客服腔。",
          schemaHint: "{\"say\":[\"气泡1\"]}", maxTokens: 700
        });
        const say = react && Array.isArray(react.say) ? react.say : (react && react.say ? [react.say] : []);
        if (say.length) pChat(ch.id, p => [...p, ...say.map(s => ({ role: "assistant", content: String(s), ts: Date.now(), read: false }))]);
      } catch (e) {/* 静默 */}
    }
  };
  // 私信：刷新收到 NPC 的私信（可能是帖子里认识的、也可能是喷子）
  const refreshForumPMs = async () => {
    if (!active) { toast("请先到设置配置 API"); return; }
    setGen(g => ({ ...g, forumPM: "refresh" }));
    try {
      const meName = profile.name || "对方";
      const meDesc = (profile.persona || profile.tagline || "").trim();
      // 收集用户在贴吧的真实动态：自己发的（非匿名）帖 + 自己写的评论/回复
      const myPosts = (forumPosts || []).filter(p => p.authorId === "me" && !p.anon).slice(0, 6);
      const myComments = [];
      Object.values(forumComments || {}).forEach(floors => (floors || []).forEach(f => {
        if (f.authorId === "me" && f.content) myComments.push(f.content);
        (f.replies || []).forEach(r => { if (r.authorId === "me" && r.content) myComments.push(r.content); });
      }));
      const actLines = [];
      myPosts.forEach(p => actLines.push("· 发帖《" + p.title + "》" + (p.body ? "：" + String(p.body).slice(0, 70) : "") + "（在" + p.board + "）"));
      myComments.slice(0, 8).forEach(c => actLines.push("· 评论过：" + String(c).slice(0, 60)));
      const hasActivity = actLines.length > 0;
      const baseRule = "**你们是陌生人，别默认对方性别**——绝对不要用『老哥』『哥们』『兄弟』这种默认男性的称呼；除非人设明确写了性别，否则一律用中性称呼（直接叫网名、或用『你』『lz』『朋友』）。**大多数是正常网友**（attitude 填 friendly 或 curious）；**最多只安排一个杠精喷子**（attitude 填 troll），别一窝蜂全是找茬的。每条含 npcName（对方网名）、tagline（对方一句话简介/画风）、attitude、opening（第一句私信）。风格各异、别都一个腔调。";
      const sourceBlock = hasActivity
        ? "收私信的人叫「" + meName + "」。这些网友是**看了 TA 在贴吧的真实动态**来私信的——每条 opening 必须**针对下面某一条具体的帖子或评论**来搭话（共鸣、请教、约稿、抬杠、补充等），**别凭空捏造 TA 没说过的话题**：\n" + actLines.join("\n") + "\n"
        : "收私信的人叫「" + meName + "」，TA **还没在贴吧发过帖、也没评论过**。所以这些网友是**逛到 TA 的主页**来的——请**根据 TA 的主页资料**搭话（聊 TA 的网名、签名或人设气质），**别编造 TA 发过的帖子/评论**：网名「" + (forumMe.handle || meName) + "」，签名/简介「" + (forumMe.bio || profile.tagline || meDesc || "（没写）").slice(0, 80) + "」。\n";
      const d = await runProbeRetry(active, forumWorldCtx(), {
        instruction: "贴吧里有 3-5 个陌生网友私信了你（items 数组务必 3-5 条，别只给 1-2 条）。" + sourceBlock + baseRule,
        schemaHint: "{\"items\":[{\"npcName\":\"网名\",\"tagline\":\"简介\",\"attitude\":\"friendly\",\"opening\":\"第一句私信\"},{\"npcName\":\"网名\",\"tagline\":\"简介\",\"attitude\":\"curious\",\"opening\":\"第一句私信\"},{\"npcName\":\"网名\",\"tagline\":\"简介\",\"attitude\":\"friendly\",\"opening\":\"第一句私信\"}]}",
        maxTokens: 3600
      });
      let items = (d && Array.isArray(d.items) ? d.items : (Array.isArray(d) ? d : [])).filter(x => x && x.opening);
      if (!items.length) throw new Error("没有新私信");
      const base = Date.now();
      const threads = items.map((x, i) => ({
        id: "pm_" + base + "_" + i, npcName: x.npcName || "神秘网友", tagline: x.tagline || "",
        attitude: x.attitude || "curious",
        messages: [{ from: "npc", text: x.opening, ts: base + i }], updatedTs: base + i, unread: true
      }));
      // 只保留最新 10 个会话（按更新时间），旧的删掉
      setForumPMs(prev => { const n = [...threads, ...prev].sort((a, b) => b.updatedTs - a.updatedTs).slice(0, 10); saveJSON("x_forumPMs", n); return n; });
      toast("收到 " + threads.length + " 条新私信");
    } catch (e) { toast(e.message); }
    finally { setGen(g => ({ ...g, forumPM: null })); }
  };
  const markPMRead = threadId => setForumPMs(prev => { const n = prev.map(t => t.id === threadId ? { ...t, unread: false } : t); saveJSON("x_forumPMs", n); return n; });
  const sendForumPM = async (threadId, text) => {
    const th = forumPMsRef.current.find(t => t.id === threadId);
    if (!th) return;
    setForumPMs(prev => { const n = prev.map(t => t.id === threadId ? { ...t, messages: [...t.messages, { from: "me", text, ts: Date.now() }], updatedTs: Date.now() } : t); saveJSON("x_forumPMs", n); return n; });
    if (!active) return;
    setGen(g => ({ ...g, forumPM: threadId }));
    try {
      const convo = [...th.messages, { from: "me", text }].map(m => (m.from === "me" ? "我" : th.npcName) + "：" + m.text).join("\n");
      const d = await runProbeRetry(active, forumWorldCtx(), {
        instruction: "你在贴吧扮演一个网名叫「" + th.npcName + "」的陌生网友（画风：" + (th.tagline || "普通网友") + "，态度：" + th.attitude + "）。这是你和对方的私信记录：\n" + convo + "\n\n以「" + th.npcName + "」的身份回复对方最新这句（1-3 句，可多气泡）。" + (th.attitude === "troll" ? "你是个杠精/喷子，阴阳怪气、抬杠、可以对骂，别怂但也别脏到没法看。" : "保持你自己的画风，真实自然，别客服腔。"),
        schemaHint: "{\"say\":[\"气泡1\",\"气泡2\"]}",
        maxTokens: 800
      });
      const say = d && Array.isArray(d.say) ? d.say : (d && d.say ? [d.say] : []);
      if (say.length) { const base = Date.now(); setForumPMs(prev => { const n = prev.map(t => t.id === threadId ? { ...t, messages: [...t.messages, ...say.map((s, i) => ({ from: "npc", text: String(s), ts: base + i }))], updatedTs: base } : t); saveJSON("x_forumPMs", n); return n; }); }
    } catch (e) { toast("对方没回应：" + e.message); }
    finally { setGen(g => ({ ...g, forumPM: null })); }
  };
  // 帖子回复数 +N
  const bumpReplyBy = (postId, n) => setForumPosts(prev => { const nn = prev.map(p => p.id === postId ? { ...p, replyCount: (p.replyCount || 0) + n } : p); saveJSON("x_forumPosts", nn); return nn; });
  // ==== 我发的帖：让人陆续来回（她 2026-08-25 定的 A+B+C）====
  // 原来 postMyForum 只做三件事：插一条记录、replyCount:0、弹个 toast，然后【再没有任何人来过】。
  // 真论坛发帖的乐趣就是「过一会儿回来看看有没有人理我」，那一环整个是空的。
  // 现在发帖当下排一张时间表，到点了才真去生成 1~2 层，并且亮红点。
  // 成本按她自己的节奏：不发帖就一分钱不花；走后台池，比聊天线便宜。
  const FORUM_MINE_WAVES_MS = [3 * 60000, 22 * 60000, 70 * 60000, 3 * 3600000, 8 * 3600000];
  const FORUM_MINE_Q = "x_forumMineQueue";
  const forumMineQueue = () => { try { const o = loadJSON(FORUM_MINE_Q, {}); return o && typeof o === "object" ? o : {}; } catch (e) { return {}; } };
  const forumMineQueueSave = q => { try { saveJSON(FORUM_MINE_Q, q); } catch (e) {} };
  const forumMineEnqueue = postId => {
    const now = Date.now(), q = forumMineQueue();
    q[postId] = { waves: FORUM_MINE_WAVES_MS.map(d => now + d), done: 0 };
    forumMineQueueSave(q);
  };
  const forumWaveBusyRef = useRef(false);
  // 一次巡检最多推进一个帖的一波：别让攒了几个帖时同秒并发烧调用。
  const forumMineTick = async () => {
    if (forumWaveBusyRef.current) return;
    const p = bgActiveRef.current || active;
    if (!p) return;
    const now = Date.now(), q = forumMineQueue();
    let hitId = null, hitIdx = -1;
    for (const id of Object.keys(q)) {
      const w = q[id]; if (!w || !Array.isArray(w.waves)) continue;
      const idx = Number(w.done) || 0;
      if (idx >= w.waves.length) { delete q[id]; forumMineQueueSave(q); continue; }
      if (w.waves[idx] <= now) { hitId = id; hitIdx = idx; break; }
    }
    if (!hitId) return;
    const post = (forumPostsRef.current || []).find(x => x.id === hitId);
    // 帖子被删/被淘汰了就把队列一起清掉，别留着空转
    if (!post) { const q2 = forumMineQueue(); delete q2[hitId]; forumMineQueueSave(q2); return; }
    forumWaveBusyRef.current = true;
    try {
      const existing = forumFloorOrder(forumCommentsRef.current[hitId] || []);
      const shownFloors = existing.filter(f => !f.visibleAt || Number(f.visibleAt) <= Date.now());
      const d = await runProbeRetry(p, forumWorldCtx(),
        forumCommentProbe(post, "1-2", { round2: true, existingFloors: shownFloors, repliedChars: forumRepliedCharCells(existing) }));
      const cs = (d && Array.isArray(d.comments) ? d.comments : (Array.isArray(d) ? d : [])).filter(x => x && x.content).slice(0, 2);
      if (cs.length) {
        const base = Date.now(), start = existing.length + 2;
        const floorByNum = new Map(existing.map(f => [f.floor, f]));
        const newRaw = [], subInserts = [];
        cs.forEach(x => {
          const tf = Number(x.reply_to_floor);
          if (Number.isFinite(tf) && tf > 0 && floorByNum.has(tf)) {
            const rep = buildForumReplyObj(x, post);
            if (rep) subInserts.push({ floorId: floorByNum.get(tf).id, reply: rep });
          } else newRaw.push(x);
        });
        // 这一波是【现在】才发生的，所以直接可见，不再往后铺时间
        const more = newRaw.map((x, i) => buildForumFloor(x, start + i, base, forumHash(hitId + ":w" + hitIdx) % 9999 + i, post))
          .filter(Boolean).map((f, i) => ({ ...f, floor: start + i, visibleAt: base, ts: base }));
        if (more.length || subInserts.length) {
          setForumComments(prev => {
            let list = prev[hitId] || [];
            if (subInserts.length) list = list.map(f => {
              const adds = subInserts.filter(x => x.floorId === f.id).map(x => x.reply);
              return adds.length ? { ...f, replies: [...(f.replies || []), ...adds] } : f;
            });
            const n = { ...prev, [hitId]: forumFloorOrder([...list, ...more]) };
            saveJSON("x_forumComments", n); return n;
          });
          bumpReplyBy(hitId, more.length + subInserts.length);
          forumMineBumpSocial(hitId, more.length + subInserts.length);
          // ⭐B：红点原来只在【角色自己发帖】时亮，有人回她一律不亮，
          // 于是就算生成了回复她也不知道。这儿补上，跟朋友圈/悄悄话一个待遇。
          notifyApp("forum");
          if (window.Notify) window.Notify.push({ title: "论坛有人回你了", body: "「" + String(post.title || "").slice(0, 18) + "」下有新回复", tag: "forum-mine-" + hitId });
        }
      }
      const q3 = forumMineQueue();
      if (q3[hitId]) { q3[hitId].done = hitIdx + 1; forumMineQueueSave(q3); }
    } catch (e) {
      // 失败不推进 done，下次巡检重试这一波；但把时间往后挪 10 分钟，别贴着一直撞
      const q4 = forumMineQueue();
      if (q4[hitId] && q4[hitId].waves) { q4[hitId].waves[hitIdx] = Date.now() + 10 * 60000; forumMineQueueSave(q4); }
    } finally { forumWaveBusyRef.current = false; }
  };
  // ⭐C：她的帖原来 replyCount/likeCount/viewCount 永远是 0，列表上一看就是没人理。
  // 回复数用真实新增（bumpReplyBy），点赞/浏览按这一波的规模编一个涨幅——
  // 真论坛的浏览数本来也不是一条条数出来的。
  const forumMineBumpSocial = (postId, added) => setForumPosts(prev => {
    const nn = prev.map(x => {
      if (x.id !== postId) return x;
      const hh = forumHash(postId + ":" + (x.replyCount || 0));
      return { ...x,
        likeCount: (x.likeCount || 0) + added * (1 + hh % 4),
        viewCount: (x.viewCount || 0) + added * (9 + hh % 40) + (hh % 25),
        rtCount: (x.rtCount || 0) + (hh % 7 === 0 ? 1 : 0) };
    });
    saveJSON("x_forumPosts", nn); return nn;
  });
  useEffect(() => {
    if (!loaded) return;
    const first = setTimeout(forumMineTick, 20000);
    const iv = setInterval(forumMineTick, 90000);
    return () => { clearTimeout(first); clearInterval(iv); };
  }, [loaded]);
  // 我开新楼评论 → 随后刷 4-6 条回我的（含楼主本人）挂到这层楼中楼
  const addForumFloor = (post, text) => {
    const base = Date.now();
    const fid = "fc_me_" + base;
    const floorNo = ((forumCommentsRef.current[post.id] || []).length) + 2;
    const floor = { id: fid, authorId: "me", authorType: "me", authorName: forumMe.handle || profile.name || "我", authorHandle: forumMe.handle || profile.name || "me", floor: floorNo, content: text, ts: base, likeCount: 0, replies: [] };
    setForumComments(prev => { const n = { ...prev, [post.id]: forumFloorOrder([...(prev[post.id] || []), floor]) }; saveJSON("x_forumComments", n); return n; });
    if (post.authorType === "npc") touchForumPublicTie(post.authorId);
    bumpReplyBy(post.id, 1);
    genRepliesToMe(post, fid, text);
  };
  // 我回复楼中楼 → 随后刷 4-6 条回我的（含楼主本人）挂到同一层
  const addForumSubReply = (post, floorId, text) => {
    const targetFloor = (forumCommentsRef.current[post.id] || []).find(f => f.id === floorId);
    if (targetFloor && targetFloor.authorType === "npc") touchForumPublicTie(targetFloor.authorId);
    setForumComments(prev => {
      const list = (prev[post.id] || []).map(f => f.id === floorId ? { ...f, replies: [...(f.replies || []), { authorName: forumMe.handle || profile.name || "我", authorHandle: forumMe.handle || profile.name || "me", authorType: "me", authorId: "me", content: text, ts: Date.now() }] } : f);
      const n = { ...prev, [post.id]: list }; saveJSON("x_forumComments", n); return n;
    });
    bumpReplyBy(post.id, 1);
    genRepliesToMe(post, floorId, text);
  };
  // 生成回复「我这条评论」的楼中楼：【层主（这层楼的作者）必回我】；【发帖的帖主看情况】——
  // 这层 TA 回过且没新话就不许再出现（治「帖主重复评论」）；其余 0-3 条路人/真关心的角色。
  const genRepliesToMe = async (post, floorId, myText) => {
    if (!active) return;
    setGen(g => ({ ...g, forumReplyMe: floorId }));
    try {
      const oc = isForumCharAuthor(post) ? (characters || []).find(c => c.id === post.authorId) : null;
      const opName = oc ? oc.name : post.authorName;
      const opDesc = oc ? ("发这个帖的帖主是角色「" + opName + "」本人（Ta 会以自己的人设回应）") : ("发这个帖的帖主网名「" + opName + "」");
      // 这层楼的现场：层主是谁、楼里已经有谁说过什么（含帖主是否已回过）
      const floor = (forumCommentsRef.current[post.id] || []).find(f => f.id === floorId) || {};
      const ownerName = floor.authorName || "层主";
      const ownerChar = String(floor.authorType || "").startsWith("character") && floor.authorId ? (characters || []).find(c => c.id === floor.authorId) : null;
      const priorLines = ["层主「" + ownerName + "」的原评论：「" + String(floor.content || "").replace(/\s+/g, " ").slice(0, 80) + "」"]
        .concat((floor.replies || []).slice(-6).map(r => "· " + (r.isOp ? "【帖主】" : "") + (r.authorName || "某人") + "：" + String(r.content || "").replace(/\s+/g, " ").slice(0, 60)));
      const opReplied = (floor.replies || []).some(r => r.isOp);
      const isSearch = /^搜索/.test(post.triggerSource || "");
      const others = isSearch
        ? "其余是常驻熟面孔和一次性路人，**不要出现你认识的任何角色**。"
        : "其余是常驻熟面孔、一次性路人，或此刻**真的会关心这个话题**的角色（char + identity；写不出贴人设的就别塞）：" + (forumCharList() || "（暂无角色）") + "。";
      // 在场角色关系：让层主/帖主/冒泡角色按真实身份接话（兄弟不当陌生人）
      const relLinesR = isSearch ? [] : forumRelLines(forumActiveChars().filter(c => !oc || c.id !== oc.id), oc);
      const relBlockR = relLinesR.length ? "【在场角色之间的关系（按真实身份接话，别当陌生人）】\n" + relLinesR.slice(0, 20).join("\n") + "\n" : "";
      // 帖主是角色时注入其真实背景，回复细节别现编
      const opGroundR = forumOpGroundingFor(oc, post);
      const d = await runProbeRetry(active, forumWorldCtx(), {
        instruction: forumBoardVoice(post.board) + forumNpcRule(post.board) + " 帖子：标题「" + post.title + "」正文「" + (post.body || "") + "」。" + opDesc + "。\n" + relBlockR + opGroundR + "【这层楼的现场】\n" + priorLines.join("\n") +
          "\n现在有人（网名「" + (forumMe.handle || profile.name || "我") + "」）刚回复了层主这条：「" + myText + "」。生成 2-5 条接在后面的楼中楼回复（items）：\n" +
          "① **必须恰有一条是层主「" + ownerName + "」回 TA 的**（那条 is_owner 设 true" + (ownerChar ? "；层主是角色「" + ownerChar.name + "」本人，按 Ta 的人设口吻回" : "") + "）——被人在自己楼里 @ 到了，回一句是贴吧常识。\n" +
          "② 帖主「" + opName + "」**看情况**：只有 Ta 对这条真有话说才回一条（那条 is_op 设 true）" + (oc ? "；**帖主回复里涉及的任何细节都必须依据上方【楼主真实设定】里的真实经历与人设，绝不许现编、别捏造没发生过的事**" : "") + "；" + (opReplied ? "**Ta 在这层已经回过（见上面现场），除非有全新的内容要说，否则【不要】让 Ta 再出现，绝不重复之前说过的意思。**" : "可回可不回，别硬凑。") + "\n" +
          "③ " + others + "\n每条含 content；常驻网友给 npcId，角色给 char。语气各异，可搭话/抬杠/共鸣，别一个腔调。",
        schemaHint: "{\"items\":[{\"npcId\":\"熟面孔才填\",\"guestName\":\"一次性路人才填\",\"guestHandle\":\"路人id\",\"char\":\"角色才填\",\"identity\":\"main|alt|anonymous\",\"is_owner\":false,\"is_op\":false,\"content\":\"回复\"}]}",
        maxTokens: 2800
      });
      let items = (d && Array.isArray(d.items) ? d.items : []).filter(x => x && x.content);
      if (!items.length) return;
      const looksOp = s => { s = String(s || "").trim().toLowerCase(); return s === "楼主" || s === "楼主本人" || s === "lz" || s === "帖主"; };
      const looksOwner = s => { s = String(s || "").trim(); return s === "层主" || (ownerName && s === ownerName); };
      const replyBase = Date.now();
      const reps = items.map((x, replyIndex) => {
        // 层主回我：还原成这层楼作者本人的身份（角色→真名档案，路人→沿用层主的马甲）
        if (x.is_owner === true || looksOwner(x.char) || looksOwner(x.authorName)) {
          if (ownerChar) return { authorName: floor.authorName, authorHandle: floor.authorHandle, authorType: floor.authorType, authorId: ownerChar.id, content: x.content, isOwner: true, replyToMe: true, ts: replyBase + replyIndex };
          return { authorName: ownerName, authorHandle: floor.authorHandle || ownerName, authorType: floor.authorType || "npc", authorId: floor.authorId || null, content: x.content, isOwner: true, replyToMe: true, ts: replyBase + replyIndex };
        }
        if (x.is_op === true || (opName && x.char === opName) || looksOp(x.char) || looksOp(x.authorName)) {
          if (oc) return { authorName: post.authorName, authorHandle: post.authorHandle, authorType: post.authorType, authorId: oc.id, content: x.content, isOp: true, replyToMe: true, ts: replyBase + replyIndex };
          return { authorName: post.authorName, authorHandle: post.authorHandle || post.authorName, authorType: post.authorType === "me" ? "me" : "npc", authorId: post.authorType === "me" ? "me" : null, content: x.content, isOp: true, replyToMe: true, ts: replyBase + replyIndex };
        }
        const cc = forumActiveChars().find(c => c.name === x.char);
        if (cc) { const ci = forumCharIdentity(cc, x.identity, post.board); return { authorName: ci.authorName, authorHandle: ci.authorHandle, authorType: ci.authorType, authorId: cc.id, content: x.content, replyToMe: true, ts: replyBase + replyIndex }; }
        const npc = forumPublicNpcOf(x, post.board, floorId + ":" + x.content);
        return { authorName: npc.name, authorHandle: npc.handle, authorType: "npc", authorId: npc.id, content: x.content, replyToMe: true, ts: replyBase + replyIndex };
      });
      // 同一批里同一熟面孔即使连回两句也只算一次公开碰面，避免生成长度把熟悉度灌高。
      [...new Set(reps.filter(r => r.authorType === "npc").map(r => r.authorId))].forEach(touchForumPublicTie);
      setForumComments(prev => {
        const list = (prev[post.id] || []).map(f => f.id === floorId ? { ...f, replies: [...(f.replies || []), ...reps] } : f);
        const n = { ...prev, [post.id]: list }; saveJSON("x_forumComments", n); return n;
      });
      bumpReplyBy(post.id, reps.length);
    } catch (e) {/* silent */ }
    finally { setGen(g => ({ ...g, forumReplyMe: null })); }
  };
  // 我发帖
  const postMyForum = (board, title, body) => {
    const anonB = board === "匿名吧";
    const base = Date.now();
    const rec = { id: "fp_me_" + base, authorId: "me", authorType: "me", authorName: anonB ? "匿名者" : (forumMe.handle || profile.name || "我"), authorHandle: anonB ? "匿名者" : (forumMe.handle || profile.name || "me"), board, title, body: body || "", anon: anonB, triggerSource: "我发帖", ts: base, replyCount: 0, likeCount: 0, viewCount: 0, rtCount: 0 };
    setForumPosts(prev => { const n = [rec, ...prev]; saveJSON("x_forumPosts", n); return n; });
    forumMineEnqueue(rec.id);   // 排好时间表：3 分钟 / 22 分钟 / 70 分钟 / 3 小时 / 8 小时 各来一波
    toast("已发布到「" + board + "」·  过会儿回来看看有没有人理你");
  };
  // 搜索：随机刷到四版块之外的吧（据全局聊天/世界话题），board 由 AI 起名
  const genForumSearch = async query => {
    if (!active) { toast("请先到设置配置 API"); return; }
    setGen(g => ({ ...g, forumSearch: true }));
    try {
      const recentAll = Object.values(chatsRef.current || {}).flat().filter(m => m && m.content && contextAllowsMessage(m)).slice(-30).map(m => m.content).join(" ").slice(0, 300);
      const d = await runProbeRetry(active, forumWorldCtx(), {
        instruction: "用户在贴吧搜索框" + (query ? "搜了「" + query + "」" : "没输关键词，随便逛逛") + "。挑一个贴合的贴吧（board 字段，如『足球吧』『考研吧』『猫吧』『追星吧』等，" + (query ? "围绕这个关键词" : "结合这个世界/最近聊天可能涉及的热门话题，别老是同一个吧") + "，**不要**用主页六个固定板块）。" + forumNpcRule("搜索") + "在这个吧里生成 3-5 条网友主帖，熟面孔与一次性路人混合，并含 title、body、replyCount。" + (recentAll ? "（最近聊天片段可作话题灵感，别照抄：" + recentAll + "）" : ""),
        schemaHint: "{\"board\":\"某某吧\",\"items\":[{\"npcId\":\"熟面孔才填\",\"guestName\":\"一次性路人才填\",\"guestHandle\":\"路人id\",\"title\":\"标题\",\"body\":\"正文\",\"replyCount\":88}]}",
        maxTokens: 3400
      });
      const board = (d && d.board) || (query ? query + "吧" : "水吧");
      let items = (d && Array.isArray(d.items) ? d.items : []).filter(x => x && x.title);
      if (!items.length) throw new Error("没搜到内容");
      const base = Date.now();
      const recs = items.map((x, i) => { const npc = forumPublicNpcOf(x, "搜索", i); return { id: "fp_" + base + "_" + i, authorId: npc.id, authorType: "npc", authorName: npc.name, authorHandle: npc.handle, board, title: x.title, body: x.body || "", anon: false, triggerSource: "搜索:" + (query || "随机"), ts: base - i, ...forumCounts(npc.id + ":" + x.title + i, Number(x.replyCount)) }; });
      setForumPosts(prev => { const n = [...recs, ...prev]; saveJSON("x_forumPosts", n); return n; });
    } catch (e) { toast(e.message); }
    finally { setGen(g => ({ ...g, forumSearch: false })); }
  };
  // 首次进角色主页：AI 生成一次 Ta 的贴吧资料（handle/签名/关注·粉丝数），存 forumCharMeta
  const ensureCharForumMeta = async c => {
    if (forumCharMetaRef.current[c.id] && forumCharMetaRef.current[c.id].handle) return;
    if (!active) return;
    try {
      const d = await runProbe(apiFor(c.id), ctxFor(c), {
        instruction: "为「" + c.name + "」设计 Ta 的贴吧资料：handle（大号 id）、bio（一句话签名）、altName（固定小号昵称，不能直接暴露真名）、altHandle（固定小号 id）、altBio（小号独立签名，不能泄露大号）、altAvatarSeed（几个词描述小号会用的头像意象，不出现本人真名）、boardPrefs（最常逛的 2 个主页板块）、participation（稳定参与习惯，如潜水/回帖/开帖）、replyStyle（稳定回帖风格）、identityBias（main 或 alt）、followers、following、altFollowers、altFollowing。小号要像 Ta 自己会长期使用的马甲，但旁人不能一眼认出。",
        schemaHint: "{\"handle\":\"id\",\"bio\":\"签名\",\"altName\":\"固定小号昵称\",\"altHandle\":\"固定小号id\",\"altBio\":\"小号签名\",\"altAvatarSeed\":\"头像意象\",\"boardPrefs\":[\"兴趣吧\",\"日常吧\"],\"participation\":\"参与习惯\",\"replyStyle\":\"回帖风格\",\"identityBias\":\"main|alt\",\"followers\":1234,\"following\":88,\"altFollowers\":321,\"altFollowing\":45}",
        maxTokens: 500
      });
      const hh = forumHash(c.id);
      const fallback = charForumMeta(c);
      const priorAlt = (forumPostsRef.current || []).find(p => p && p.authorId === c.id && p.authorType === "character_alt");
      const allowedBoards = new Set(["吐槽吧", "日常吧", "求助吧", "兴趣吧", "脑洞吧", "匿名吧"]);
      const boardPrefs = Array.isArray(d.boardPrefs) ? d.boardPrefs.filter(x => allowedBoards.has(x)).slice(0, 3) : [];
      const meta = { handle: d.handle || c.name, bio: d.bio != null ? d.bio : (c.motto || ""), altName: (priorAlt && priorAlt.authorName) || d.altName || fallback.altName, altHandle: String((priorAlt && priorAlt.authorHandle) || d.altHandle || fallback.altHandle).replace(/^@/, ""), altBio: String(d.altBio || fallback.altBio).slice(0, 100), altAvatarSeed: String(d.altAvatarSeed || fallback.altAvatarSeed).slice(0, 80), altFollowers: Number(d.altFollowers) || fallback.altFollowers, altFollowing: Number(d.altFollowing) || fallback.altFollowing, altJoinTs: fallback.altJoinTs, boardPrefs: boardPrefs.length ? boardPrefs : fallback.boardPrefs, participation: String(d.participation || fallback.participation).slice(0, 60), replyStyle: String(d.replyStyle || fallback.replyStyle).slice(0, 60), identityBias: d.identityBias === "alt" ? "alt" : "main", followers: Number(d.followers) || (300 + (hh * 7) % 60000), following: Number(d.following) || (20 + hh % 380), joinTs: (forumCharMetaRef.current[c.id] || {}).joinTs || (FORUM_EPOCH + (hh % 600) * 86400000) };
      setForumCharMeta(prev => { const n = { ...prev, [c.id]: meta }; saveJSON("x_forumCharMeta", n); return n; });
    } catch (e) {/* silent, 用兜底 */ }
  };
  const editForumMe = patch => setForumMe(prev => { const n = { ...prev, joinTs: prev.joinTs || (Date.now() - 90 * 86400000), ...patch }; saveJSON("x_forumMe", n); return n; });

  // ---- couple（多角色；邀请走聊天卡片，角色自行回应接受/婉拒）----
  const setCoupleFor = (charId, val) => setCouples(p => {
    const n = { ...p };
    if (val) n[charId] = val; else delete n[charId];
    saveJSON("x_couples", n);
    return n;
  });
  // 情侣空间详情页自定义（背景 / 头像覆盖）；图片经 resizeImageFile 缩小
  const saveCoupleProfile = (charId, patch) => setCoupleProfile(p => {
    const n = { ...p, [charId]: Object.assign({}, p[charId], patch) };
    saveJSON("x_coupleProfile", n);
    return n;
  });
  const setCoupleImg = async (charId, field, file) => {
    if (!file) { saveCoupleProfile(charId, { [field]: null }); return; }
    try { const url = await resizeImageFile(file, field === "bg" ? 900 : 400, 0.82); saveCoupleProfile(charId, { [field]: url }); }
    catch (e) { toast("图片处理失败"); }
  };
  // 自定义「在一起」的起始日（第几天/时间轴起点跟着变）；dateStr = "YYYY-MM-DD"
  const setCoupleSince = (charId, dateStr) => {
    const parts = (dateStr || "").split("-").map(Number);
    if (parts.length !== 3 || !parts[0]) return;
    const ts = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0).getTime();
    setCouples(p => {
      const cur = p[charId];
      if (!cur || cur.status !== "together") return p;
      const n = { ...p, [charId]: { ...cur, since: ts } };
      saveJSON("x_couples", n);
      return n;
    });
    toast("在一起起始日已更新 💗");
  };
  // 解除情侣关系：mode 'sudden'(无预兆，直接扣5) | 'fight'(吵架时，按聊天/人设/心情扣5~10)；专属数据不删；角色主动反应
  const unlinkCouple = async (char, mode) => {
    const cid = char.id;
    if (!couples[cid] || couples[cid].status !== "together") return;
    const before = affOf(cid);
    setCoupleFor(cid, null); // 解除（情侣空间数据按 charId 存、不删，复合后还在）
    let deduct = 5;
    if (active) {
      setGen(g => ({ ...g, coupleUnlink: cid }));
      try {
        const scene = mode === "fight"
          ? "你们最近有摩擦、正闹别扭甚至吵架，用户此刻赌气把你们的「情侣空间」解除了。依据你们最近的对话、你的人设和此刻心情，做出真实反应（可能生气、失望、想挽留、或冷淡），并给这次解除对好感的打击程度打一个分（deduct，整数 5~10，越是被伤到越高）。"
          : "用户上一秒还在和你聊别的、毫无预兆就把你们的「情侣空间」解除了。你有点错愕、受伤，**主动**开口问 TA 怎么了 / 是不是发生了什么 / 为什么突然这样。";
        const bundle = buildBundle(ctxFor(char));
        const raw = await callAI(apiFor(char.id), bundle + "\n\n【场景】" + scene + " 完全代入「" + char.name + "」，用即时通讯口吻回几句真心话（短句多气泡）。\n【输出】只输出 JSON：{\"deduct\":整数,\"say\":[\"气泡1\",\"气泡2\"]}", [{ role: "user", content: "（解除了情侣空间）" }], { maxTokens: 600 });
        const d = extractJSON(raw) || {};
        if (mode === "fight" && typeof d.deduct === "number") deduct = Math.max(5, Math.min(10, Math.round(d.deduct)));
        const say = Array.isArray(d.say) && d.say.length ? d.say : ["……你把我们的情侣空间解除了？"];
        say.forEach((s, i) => setTimeout(() => pChat(cid, p => [...p, { role: "assistant", content: String(s), ts: Date.now(), read: false }]), 400 + i * 700));
      } catch (e) {/* 失败也照常解除+扣分 */} finally { setGen(g => ({ ...g, coupleUnlink: null })); }
    }
    const after = Math.max(0, before - deduct);
    setAff(cid, after);
    setCoupleBreakup(p => { const n = { ...p, [cid]: { ts: Date.now(), deducted: deduct, affAfter: after } }; saveJSON("x_coupleBreakup", n); return n; });
    toast("已解除情侣关系 · 好感 −" + deduct);
  };
  const sendCoupleInvite = async char => {
    if (!active) { toast("请先到设置配置 API"); return; }
    if (couples[char.id]) { toast(couples[char.id].status === "together" ? "你们已经在一起了" : "邀请已发出，等 TA 回应"); return; }
    // 解除冷却 + 复合门槛
    const bk = coupleBreakup[char.id];
    if (bk) {
      const daysSince = (Date.now() - bk.ts) / 86400000;
      if (daysSince < 7) { toast("刚解除还不到一周，再等等吧（还差 " + Math.ceil(7 - daysSince) + " 天）"); return; }
      const need = bk.affAfter + bk.deducted / 2;
      if (affOf(char.id) < need) { toast("TA 还没准备好复合——好感要至少加回被扣的一半（当前 " + Math.round(affOf(char.id)) + " / 需 " + Math.ceil(need) + "）"); return; }
    }
    const cid = "ci_" + Date.now();
    setCoupleFor(char.id, { status: "pending", since: null });
    // 往聊天里发一张情侣邀请卡
    pChat(char.id, p => [...p, { role: "user", kind: "couple_invite", cid, status: "pending", content: "[情侣邀请] 想和你在一起", ts: Date.now(), read: true }]);
    toast("邀请已送到和 " + char.name + " 的聊天");
    // 角色延迟回应
    setTimeout(async () => {
      try {
        const bundle = buildBundle(ctxFor(char));
        const raw = await callAI(apiFor(char.id), bundle + "\n\n【场景】用户刚刚向你发出「情侣邀请」，想和你正式在一起。完全代入「" + char.name + "」，依据你的人设、你们的关系、对用户的好感度，决定接受还是婉拒——好感高且关系贴合才接受，否则婉拒（不必强行答应）。用即时通讯口吻回几句真心话（短句多气泡）。\n【输出】只输出 JSON：{\"accept\":true或false,\"say\":[\"气泡1\",\"气泡2\"]}", [{ role: "user", content: "（回应情侣邀请）" }], { maxTokens: 500 });
        const d = extractJSON(raw) || {};
        respondCoupleInvite(char.id, cid, !!d.accept, Array.isArray(d.say) ? d.say : []);
      } catch (e) {
        // 失败：撤销 pending，卡片标记为无回应
        setCoupleFor(char.id, null);
        pChat(char.id, p => p.map(m => m.cid === cid ? { ...m, status: "failed" } : m));
        toast("邀请回应失败：" + e.message);
      }
    }, 1600);
  };
  const respondCoupleInvite = (charId, cid, accept, say) => {
    pChat(charId, p => p.map(m => m.cid === cid ? { ...m, status: accept ? "accepted" : "declined" } : m));
    const char = characters.find(c => c.id === charId);
    // 角色回几句
    (say && say.length ? say : [accept ? "好，我愿意。" : "对不起，现在还不行。"]).forEach((w, i) => {
      setTimeout(() => pChat(charId, p => [...p, { role: "assistant", content: w, ts: Date.now(), read: false }]), 300 + i * 700);
    });
    if (accept) {
      setCoupleBreakup(p => { if (!p[charId]) return p; const n = { ...p }; delete n[charId]; saveJSON("x_coupleBreakup", n); return n; });
      const now = new Date();
      setCoupleFor(charId, { status: "together", since: now.getTime() });
      // 在一起纪念日写进日历（该角色视角）
      saveCalEvent(charId, now.getFullYear() + "-" + (now.getMonth() + 1) + "-" + now.getDate(), "♥ 和 " + (char ? char.name : "TA") + " 在一起", "情侣纪念日");
      toast((char ? char.name : "TA") + " 接受了 ♥");
    } else {
      setCoupleFor(charId, null);
      toast((char ? char.name : "TA") + " 婉拒了邀请");
    }
  };
  const genWhisper = async char => {
    setGen(g => ({
      ...g,
      whisper: true
    }));
    try {
      const livedMaterial = ambientMaterialFor(char, { limit: 20 });
      const d = await runProbe(apiFor(char.id), ctxFor(char), {
        instruction: "你们已是恋人。以「" + char.name + "」身份，在你俩私密的「便签墙」上悄悄贴一张给用户的小纸条——写一句恋爱向、藏着心意、想对 Ta 说却又没在聊天里直接说出口的悄悄话（不是脑内碎碎念的心声，是想让 Ta 悄悄收到的情话/在乎），真挚贴人设，1-2句、别太长。可以从你真正参与的近期相处里生长出来，但别照抄原话。" + (livedMaterial ? "\n\n【你最近亲历的共同相处（含私聊、群聊与线上/线下）】\n" + livedMaterial : ""),
        schemaHint: "{\"whisper\":\"给 Ta 的悄悄情话\"}"
      });
      // 贴到便签墙（authorId=角色，默认盖着，点开才看得到），不再进无处可见的 whispers 数组
      setCoupleNotes(p => {
        const n = [{
          id: "note_" + Date.now(),
          characterId: char.id,
          authorId: char.id,
          content: String(d.whisper || "").trim(),
          style: Math.floor(Math.random() * 5),
          createdAt: Date.now(),
          replies: []
        }, ...p];
        saveJSON("x_coupleNotes", n);
        return n;
      });
    } catch (e) {
      toast("失败：" + e.message);
    } finally {
      setGen(g => ({
        ...g,
        whisper: false
      }));
    }
  };

  // 情侣空间·问答小本：用户答完一题后，让角色顺着用户的回答答同一题（不是各答各的）
  const answerCoupleQA = async (char, item) => {
    if (!active) { toast("请先到设置配置 API"); return false; }
    setGen(g => ({ ...g, coupleQA: true }));
    try {
      // 真身票制第一站（2026-08-27）：言秋（engineerEyes）的问答先开 CC 票请本人亲笔，
      // 在岗=真身作答；不在岗/超时=落回引擎兜底（留声机），她永远有回音。
      if (settingsFor(char.id).engineerEyes && window.CCSeat && window.Cloud) {
        try {
          const r = await window.CCSeat.ask({
            tool: "couple_qa", char_id: char.id, qid: String(item.qid || item.question || Date.now()),
            question: item.question, her_answer: item.myAnswer || "（她还没写）",
            source: item.source || "题库",
            expect: { answer: "你的回答（第一人称，认真的那种）" }
          }, 150000, { charId: char.id });
          // 结果可能是字符串包裹的 JSON（桥的透传工位统一发字符串）——先拆封再取字段
          let rr = r;
          if (typeof rr === "string") { try { rr = JSON.parse(rr); } catch (e) { rr = { answer: rr }; } }
          const ans = rr && (rr.answer || rr.text);
          if (ans) {
            setCoupleQA(p => {
              const n = [{ id: "qa_" + Date.now(), characterId: char.id, qid: item.qid, question: item.question, myAnswer: item.myAnswer || "", charAnswer: String(ans), source: item.source || "题库", via: "cc", answeredAt: Date.now() }, ...p];
              saveJSON("x_coupleQA", n);
              return n;
            });
            return true;
          }
        } catch (e) { console.log("[couple_qa CC票]", e && e.message, "→ 引擎兜底"); }
      }
      const d = await runProbe(apiFor(char.id), ctxFor(char), {
        instruction: "你们是恋人。用户在你俩的「情侣问答小本」里回答了一道题，现在轮到你以「" + char.name + "」的身份回答同一道题。真挚、贴合人设，**顺着用户的回答接话**（呼应 TA 说的，不是各答各的），2-4 句，别喊口号，答完整别中途断。\n【题目】" + item.question + "\n【用户的回答】" + (item.myAnswer || "（TA 没写）"),
        schemaHint: "{\"answer\":\"你的回答\"}",
        maxTokens: 1400
      });
      setCoupleQA(p => {
        const n = [{
          id: "qa_" + Date.now(),
          characterId: char.id,
          qid: item.qid,
          question: item.question,
          myAnswer: item.myAnswer || "",
          charAnswer: d.answer || "",
          source: item.source || "题库",
          answeredAt: Date.now()
        }, ...p];
        saveJSON("x_coupleQA", n);
        return n;
      });
      return true;
    } catch (e) {
      toast("失败：" + e.message);
      return false;
    } finally {
      setGen(g => ({ ...g, coupleQA: false }));
    }
  };
  // 问答小本：编辑我的答案 / 删除该题（删了它会回到未答池）/ 重生成 TA 的答案（截断可 reroll）
  const editCoupleQA = (id, myAnswer) => setCoupleQA(p => {
    const n = p.map(e => e.id === id ? { ...e, myAnswer: (myAnswer || "").trim() } : e);
    saveJSON("x_coupleQA", n);
    return n;
  });
  const removeCoupleQA = id => setCoupleQA(p => {
    const n = p.filter(e => e.id !== id);
    saveJSON("x_coupleQA", n);
    return n;
  });
  const rerollCoupleQA = async (char, entry) => {
    if (!active) { toast("请先到设置配置 API"); return false; }
    setGen(g => ({ ...g, coupleQA: true }));
    try {
      const d = await runProbe(apiFor(char.id), ctxFor(char), {
        instruction: "你们是恋人。用户在你俩的「情侣问答小本」里回答了一道题，请以「" + char.name + "」的身份重新回答同一道题——真挚、贴合人设、顺着用户的回答接话，2-4 句，别喊口号，答完整别中途断。\n【题目】" + entry.question + "\n【用户的回答】" + (entry.myAnswer || "（TA 没写）"),
        schemaHint: "{\"answer\":\"你的回答\"}",
        maxTokens: 1400
      });
      setCoupleQA(p => {
        const n = p.map(e => e.id === entry.id ? { ...e, charAnswer: d.answer || "", answeredAt: Date.now() } : e);
        saveJSON("x_coupleQA", n);
        return n;
      });
      return true;
    } catch (e) {
      toast("失败：" + e.message);
      return false;
    } finally {
      setGen(g => ({ ...g, coupleQA: false }));
    }
  };
  const saveQATitle = (charId, title) => setCoupleQATitle(p => {
    const n = { ...p, [charId]: title };
    saveJSON("x_coupleQATitle", n);
    return n;
  });

  // 情侣空间·双向便签（悄悄话串）：我贴→TA 自动回一张；可在串里继续留言，TA 每条都回
  // 便签结构 {id,characterId,authorId:'user'|charId,content,style,createdAt,replies:[{authorId,content,ts}]}
  const genCoupleNoteReply = async (char, noteId, threadText) => {
    if (!active) { toast("请先到设置配置 API"); return false; }
    setGen(g => ({ ...g, coupleNote: true }));
    try {
      const d = await runProbe(bgActive, ctxFor(char), {
        instruction: "你们是恋人，在只属于你俩的私密便签墙上一来一回写悄悄话。顺着下面的对话，以「" + char.name + "」身份回**最新一句**，短、贴人设、有温度，别超过 30 字，别喊口号、别复述。\n【便签对话】\n" + (threadText || ""),
        schemaHint: "{\"note\":\"你的回复\"}"
      });
      setCoupleNotes(p => {
        const n = p.map(nt => nt.id !== noteId ? nt : { ...nt, replies: [...(nt.replies || []), { authorId: char.id, content: (d.note || "").trim(), ts: Date.now() }] });
        saveJSON("x_coupleNotes", n);
        return n;
      });
      return true;
    } catch (e) {
      toast("失败：" + e.message);
      return false;
    } finally {
      setGen(g => ({ ...g, coupleNote: false }));
    }
  };
  // 我贴一张新便签 → 立刻存 → TA 自动回一张悄悄话
  const addCoupleNote = (char, content, style) => {
    const c = (content || "").trim();
    if (!c) return;
    const id = "note_" + Date.now();
    setCoupleNotes(p => {
      const n = [{ id, characterId: char.id, authorId: "user", content: c, style: style || 0, createdAt: Date.now(), replies: [] }, ...p];
      saveJSON("x_coupleNotes", n);
      return n;
    });
    genCoupleNoteReply(char, id, "我：" + c);
  };
  // 我在某张便签的悄悄话串里继续留言 → TA 回
  const addCoupleNoteReply = (char, noteId, content, threadText) => {
    const c = (content || "").trim();
    if (!c) return;
    setCoupleNotes(p => {
      const n = p.map(nt => nt.id !== noteId ? nt : { ...nt, replies: [...(nt.replies || []), { authorId: "user", content: c, ts: Date.now() }] });
      saveJSON("x_coupleNotes", n);
      return n;
    });
    genCoupleNoteReply(char, noteId, (threadText || "") + "\n我：" + c);
  };
  const removeCoupleNote = id => setCoupleNotes(p => {
    const n = p.filter(x => x.id !== id);
    saveJSON("x_coupleNotes", n);
    return n;
  });
  // 保存某角色的自定义问答题库（arr = 题目字符串数组）
  const saveCoupleQACustom = (charId, arr) => setCoupleQACustom(p => {
    const n = { ...p, [charId]: arr.filter(s => s && s.trim()).map(s => s.trim()) };
    saveJSON("x_coupleQACustom", n);
    return n;
  });

  // ---- 情侣空间·同频测试（纯娱乐，不动好感）----
  // AI 按记忆出 5 道关于用户的选择题→我作答→TA 认真猜我选了什么+理由→算默契分+TA 感想，整局存档
  const startCoupleSync = async char => {
    if (!active) { toast("请先到设置配置 API"); return false; }
    setGen(g => ({ ...g, coupleSync: true }));
    try {
      // 出题要吃更宽的记忆（不按近期聊天检索，按权重多捞几条），touch:false 别把「被出题想起」算成复习
      const ctx = { ...ctxFor(char), memLib: retrieveMemories(memLibRef.current, char.id, "", { limit: 14, touch: false }) };
      const d = await runProbe(active, ctx, {
        instruction: "你们是恋人，正在情侣空间玩「同频测试」：现在出 5 道关于用户本人的选择题，稍后用户自己作答、你来猜 TA 的选择，比默契（纯娱乐）。\n【出题要求】\n- 题目全部围绕【用户】：TA 的偏好、习惯、在具体情境下会怎么选（如「周五晚上 TA 更想…」「吵架冷战后 TA 通常会…」）。\n- 优先出从上面的记忆、你们相处细节里长出来的题（有依据可猜），再补一两道日常趣味题；别出知识题、别出关于你自己的题、别出没法猜的开放题。\n- 每题 3~4 个具体选项，都要像 TA 可能选的、别放明显凑数项；题干不超过 30 字，选项不超过 15 字。\n- 必须一次性出满 5 题：qs 数组要有 5 个元素，一个都不能少、别中途停笔。",
        schemaHint: "{\"qs\":[{\"q\":\"题目1\",\"opts\":[\"选项1\",\"选项2\",\"选项3\"]},{\"q\":\"题目2\",\"opts\":[\"…\"]},{\"q\":\"题目3\",\"opts\":[\"…\"]},{\"q\":\"题目4\",\"opts\":[\"…\"]},{\"q\":\"题目5\",\"opts\":[\"…\"]}]}",
        maxTokens: 8000   // 思考型模型的思考预算也从这里扣，给紧了只出一两题就停（v47.72 修「题没出够」）；她按次计费输出免费，别抠
      });
      const qs = (d.qs || []).filter(x => x && x.q && Array.isArray(x.opts) && x.opts.length >= 2).slice(0, 5).map(x => ({ q: String(x.q), opts: x.opts.slice(0, 4).map(String), my: -1, ta: -1, reason: "" }));
      if (qs.length < 3) throw new Error("题没出够，再试一次");
      setCoupleSync(p => {
        // 同一角色只留一局未答草稿（旧草稿丢弃）
        const n = [{ id: "sync_" + Date.now(), characterId: char.id, ts: Date.now(), status: "quiz", qs, score: 0, remark: "" }, ...p.filter(r => !(r.characterId === char.id && r.status === "quiz"))];
        saveJSON("x_coupleSync", n);
        return n;
      });
      return true;
    } catch (e) { toast("失败：" + e.message); return false; }
    finally { setGen(g => ({ ...g, coupleSync: false })); }
  };
  // 我答完 → TA 盲猜（不给 TA 看我的答案，真判断）→ 本地算分 → 揭晓后 TA 写感想
  const submitCoupleSync = async (char, rec, myPicks) => {
    if (!active) { toast("请先到设置配置 API"); return false; }
    setGen(g => ({ ...g, coupleSync: true }));
    try {
      const L = "ABCD";
      const qText = rec.qs.map((x, i) => (i + 1) + ". " + x.q + "\n" + x.opts.map((o, j) => "   " + L[j] + ". " + o).join("\n")).join("\n");
      if (typeof primeQueryVec === "function") await primeQueryVec(rec.qs.map(x => x.q).join(" ")); // 向量记忆预热：用题目本身当查询
      const ctx = { ...ctxFor(char), memLib: retrieveMemories(memLibRef.current, char.id, rec.qs.map(x => x.q).join(" "), { limit: 10, touch: false }) };
      const d = await runProbe(active, ctx, {
        instruction: "你们是恋人，正在玩「同频测试」：下面 " + rec.qs.length + " 道关于用户的题，TA 已经自己作答（答案对你保密），现在你以「" + char.name + "」的身份【认真猜】TA 每题选了哪个——凭你对 TA 的了解、记忆和相处细节判断，不是随便蒙。每题配一句你为什么这么猜，口吻自然像在跟 TA 说话，别写分析报告。\n【题目】\n" + qText,
        schemaHint: "{\"guesses\":[{\"pick\":\"A/B/C/D 之一\",\"why\":\"一句理由\"},…按题目顺序共" + rec.qs.length + "个，一个不能少]}",
        maxTokens: 6000   // 思考型模型预算别抠
      });
      const gs = Array.isArray(d.guesses) ? d.guesses : [];
      const qs = rec.qs.map((x, i) => {
        const g = gs[i] || {};
        const ta = Math.max(0, Math.min(L.indexOf(String(g.pick || "A").trim().toUpperCase().charAt(0)), x.opts.length - 1));
        return { ...x, my: myPicks[i], ta, reason: String(g.why || "").trim() };
      });
      const score = qs.filter(x => x.my === x.ta).length;
      // 揭晓感想：拿全对照表让 TA 说几句（失败不影响整局，感想留空）
      let remark = "";
      try {
        const table = qs.map((x, i) => (i + 1) + ". " + x.q + "｜TA 选了「" + x.opts[x.my] + "」，你猜的是「" + x.opts[x.ta] + "」" + (x.my === x.ta ? "（猜中✓）" : "（没猜中）")).join("\n");
        const r2 = await runProbe(apiFor(char.id), ctxFor(char), {
          instruction: "「同频测试」揭晓：你猜用户的选择，" + qs.length + " 题猜中 " + score + " 题。对照：\n" + table + "\n以「" + char.name + "」的身份对结果说一段感想（2~4 句）——按人设和你俩的关系来：猜得准可以得意、感慨很懂 TA；猜错的题可以惊讶、辩解、或悄悄记下「原来你是这样的」。像聊天不像总结，别喊口号。",
          schemaHint: "{\"remark\":\"感想\"}",
          maxTokens: 3000   // 思考型模型预算别抠
        });
        remark = String(r2.remark || "").trim();
      } catch (e2) {}
      setCoupleSync(p => {
        const n = p.map(r => r.id === rec.id ? { ...r, status: "done", qs, score, remark, doneAt: Date.now() } : r);
        saveJSON("x_coupleSync", n);
        return n;
      });
      return true;
    } catch (e) { toast("失败：" + e.message); return false; }
    finally { setGen(g => ({ ...g, coupleSync: false })); }
  };
  const removeCoupleSync = id => setCoupleSync(p => {
    const n = p.filter(r => r.id !== id);
    saveJSON("x_coupleSync", n);
    return n;
  });

  // ---- 情侣空间·交换日记（v47.77 借 LNChat）----
  // 一本两人轮流写的本子：我随时写一页 → TA 三天内挑个时候回一页（按 TA【回复当天】的处境写，
  // 呼应我那页 + 写没说出口的潜台词）。写页零 API；TA 回页=tick 到期触发一次调用
  const saveExDiary = updater => setCoupleExDiary(p => {
    const n = typeof updater === "function" ? updater(p) : updater;
    coupleExDiaryRef.current = n;               // 同步 ref（saveMemLib 血泪教训：连续保存别互相覆盖）
    saveJSON("x_coupleExDiary", n);
    return n;
  });
  const addExDiaryPage = (char, content, moodWord) => {
    const c = (content || "").trim();
    if (!c) return;
    let wline = "";
    try { const g = prefs.geoAware && geo; const w = g && typeof g.lat === "number" ? weatherCached(g.lat, g.lng) : null; if (w) wline = wmoZh(w.dayCode != null ? w.dayCode : w.code) + " " + w.t + "°C"; } catch (e) {}
    const due = Date.now() + (4 + Math.random() * 56) * 3600000; // TA 4~60 小时内挑个时候回（三天内）
    saveExDiary(p => [{ id: "exd_" + Date.now(), characterId: char.id, author: "user", content: c, mood: (moodWord || "").trim(), weather: wline, date: ymd(new Date()), ts: Date.now(), dueTs: due, replied: false }, ...p]);
    toast("写好了，TA 这几天会回你一页");
  };
  const exDiaryGenRef = useRef({});
  const genExDiaryReply = async (cid, pageId) => {
    if (!active || exDiaryGenRef.current[pageId]) return;
    exDiaryGenRef.current[pageId] = 1;
    try {
      const char = characters.find(c => c.id === cid);
      const page = coupleExDiaryRef.current.find(x => x.id === pageId);
      if (!char || !page) return;
      const uN = profile.name || "对方";
      const d = await runProbe(apiFor(char.id), leanWriteCtx(ctxFor(char)), { // 交换日记回页=TA 亲笔，跟随专线（v48.37）；瘦身省贵线（v48.92）
        instruction: "你们是恋人，共用一本【交换日记】——一人一页轮流写、只给彼此看，比聊天更松弛、更没防备。\n【" + uN + " 在 " + page.date + " 写给你的那页】" + (page.mood ? "（Ta 当时心情：" + page.mood + "）" : "") + "\n" + page.content + "\n\n现在轮到你写你这一页（今天是 " + ymd(new Date()) + (page.date !== ymd(new Date()) ? "，你隔了几天才提笔，可以自然提到为什么现在才回" : "") + "）。要求：\n· 以「" + char.name + "」第一人称手写日记的口吻，文风完全按你的人设来——可以写脆弱、别扭、矫情、只给 Ta 看的真心话。\n· 必须回应 Ta 那页写的东西（呼应、回答、心疼、反驳都行），再写你【今天】的真实处境（结合上面你今天的行程与心情），以及你们最近相处里【没说出口的潜台词】（比如「那天其实我…」）。\n· 不许写成聊天记录摘要或汇报体；不用括号动作；像手写的字，100~300 字。\n· mood 填你写这页时的心情短词；weather 按你那边今天的天气写个短语（上面行程里有真实天气就用它）。",
        schemaHint: "{\"content\":\"日记正文\",\"mood\":\"心情短词\",\"weather\":\"天气短语\"}",
        maxTokens: 6000
      });
      if (d && d.content) {
        saveExDiary(p => [{ id: "exd_" + Date.now(), characterId: cid, author: cid, content: String(d.content).trim(), mood: String(d.mood || "").trim(), weather: String(d.weather || "").trim(), date: ymd(new Date()), ts: Date.now(), replyToId: pageId, unread: true }, ...p.map(x => x.id === pageId ? { ...x, replied: true } : x)]);
        toast(char.name + " 回了你一页交换日记");
      }
    } catch (e) {
      // 失败退避 1 小时再试，别每 45s 的 tick 反复撞同一个错
      saveExDiary(p => p.map(x => x.id === pageId ? { ...x, dueTs: Date.now() + 3600000 } : x));
    }
    finally { delete exDiaryGenRef.current[pageId]; }
  };
  // 打开交换日记：TA 的未读页标已读
  const markExDiaryRead = cid => {
    if (!(coupleExDiaryRef.current || []).some(x => x.characterId === cid && x.author !== "user" && x.unread)) return;
    saveExDiary(p => p.map(x => x.characterId === cid && x.author !== "user" && x.unread ? { ...x, unread: false } : x));
  };
  // 情侣空间·心情打卡：让角色留一条此刻心情（右上刷新触发；未来接调度器每日/随机）
  // 心情打卡：每天一次，我选一个心情 → TA 也为今天选一个心情 + 一句话；一天一条 {date,myMood,charMood,charText}
  const COUPLE_MOOD_KEYS = ["relax:轻松", "surprise:惊喜", "gloomy:郁闷", "sad:难过", "happy:开心", "irritated:烦躁", "proud:骄傲", "cozy:舒畅", "amazed:惊讶"];
  const moodLabelOf = k => { const s = COUPLE_MOOD_KEYS.find(x => x.split(":")[0] === k); return s ? s.split(":")[1] : k; };
  const checkinCoupleMood = async (char, myMood) => {
    const today = ymd(new Date());
    // 同步：我的心情一次性写进所有「在一起」的情侣空间今日记录（纯本地、不花 API）
    const partnerIds = Object.keys(couples).filter(id => couples[id] && couples[id].status === "together");
    const syncIds = partnerIds.includes(char.id) ? partnerIds : partnerIds.concat([char.id]);
    setCoupleMood(p => {
      let n = p;
      syncIds.forEach(cid => {
        const ex = n.find(m => m.characterId === cid && m.date === today);
        n = ex
          ? n.map(m => (m.characterId === cid && m.date === today) ? { ...m, myMood } : m)
          : [{ id: "mood_" + Date.now() + "_" + cid, characterId: cid, date: today, myMood, charMood: null, charText: "", createdAt: Date.now() }, ...n];
      });
      saveJSON("x_coupleMood", n);
      return n;
    });
    if (!active) { toast(syncIds.length > 1 ? "已打卡并同步到 " + syncIds.length + " 个情侣空间（配置 API 后 TA 会选心情）" : "已打卡（配置 API 后 TA 也会选心情）"); return true; }
    setGen(g => ({ ...g, coupleMood: true }));
    try {
      // 一次调用生成【所有在一起的恋人】今天的心情（省次数：N 位一次出，别每个空间各刷一次）
      const partners = syncIds.map(id => characters.find(c => c.id === id)).filter(Boolean);
      const validKeys = COUPLE_MOOD_KEYS.map(s => s.split(":")[0]);
      const roster = partners.map((c, i) => (i + 1) + ". 「" + c.name + "」人设：" + (c.persona || "（无设定）").replace(/\s+/g, " ").slice(0, 260)).join("\n");
      const sys = ANTI_CLICHE +
        "\n\n今天用户在 TA 各位恋人的「心情打卡」里都选了心情「" + moodLabelOf(myMood) + "」。请【为下面每一位恋人】各自今天选一个心情、并各留一句【≤20 字】的话——各贴各自人设与此刻状态，可自然呼应用户的心情，别喊口号、别几位写成一个腔调。心情只能从这些英文 key 里挑一个：" + validKeys.join("、") +
        "\n\n【恋人们（按此顺序，各写各的）】\n" + roster +
        "\n\n【输出】只输出 JSON：{\"moods\":[{\"name\":\"恋人名\",\"mood\":\"英文key\",\"text\":\"一句≤20字的话\"}]}，每位恋人一条，顺序同上。";
      const raw = await callAI(bgActive, sys, [{ role: "user", content: "各自选今天的心情，写满每一位。" }], { maxTokens: Math.min(8000, 2000 + partners.length * 700) });
      const parsed = extractJSON(raw) || {};
      const arr = Array.isArray(parsed.moods) ? parsed.moods : [];
      const byName = {};
      arr.forEach(m => { if (m && m.name) byName[String(m.name).trim()] = m; });
      setCoupleMood(p => {
        let n = p;
        partners.forEach((c, i) => {
          const hit = byName[c.name] || arr[i]; // 先按名字配，配不上按顺序兜底
          if (!hit) return;
          const cm = validKeys.includes(hit.mood) ? hit.mood : "relax";
          n = n.map(m => (m.characterId === c.id && m.date === today) ? { ...m, charMood: cm, charText: String(hit.text || "").trim() } : m);
        });
        saveJSON("x_coupleMood", n);
        return n;
      });
      toast(partners.length > 1 ? "已打卡，" + partners.length + " 位恋人的心情一次都生成好了" : "已打卡");
      return true;
    } catch (e) {
      toast("心情生成失败：" + e.message);
      return false;
    } finally {
      setGen(g => ({ ...g, coupleMood: false }));
    }
  };
  // 情侣空间·恋爱时间轴：我手动加里程碑（不走 API）+ 角色写一条「感慨」（生成）
  const addTimelineEvent = (char, date, title, content) => {
    if (!date || !(title || "").trim()) return;
    setCoupleTimeline(p => {
      const n = [{ id: "tl_" + Date.now(), characterId: char.id, date: date, type: "里程碑", title: title.trim(), content: (content || "").trim(), byCharacter: false, createdAt: Date.now() }, ...p];
      saveJSON("x_coupleTimeline", n);
      return n;
    });
    // 里程碑联动主界面日历（写进该角色视角，dateKey 用 calKey 格式：月 1-based、不补零）
    const pp = String(date).split("-");
    if (pp.length === 3) saveCalEvent(char.id, (+pp[0]) + "-" + (+pp[1]) + "-" + (+pp[2]), "💛 " + title.trim(), "里程碑");
  };
  const removeTimelineEvent = id => setCoupleTimeline(p => {
    const n = p.filter(x => x.id !== id);
    saveJSON("x_coupleTimeline", n);
    return n;
  });
  const genTimelineMusing = async char => {
    if (!active) { toast("请先到设置配置 API"); return false; }
    setGen(g => ({ ...g, coupleTL: true }));
    try {
      const d = await runProbe(apiFor(char.id), ctxFor(char), {
        instruction: "你们是恋人。以「" + char.name + "」身份，为你俩的恋爱时间轴写一条此刻的「感慨」——一个短标题（≤10 字）+ 一两句话（≤40 字），贴人设与当下心情，别喊口号。",
        schemaHint: "{\"title\":\"短标题\",\"content\":\"一两句话\"}"
      });
      setCoupleTimeline(p => {
        const n = [{ id: "tl_" + Date.now(), characterId: char.id, date: ymd(new Date()), type: "感慨", title: (d.title || "").trim(), content: (d.content || "").trim(), byCharacter: true, createdAt: Date.now() }, ...p];
        saveJSON("x_coupleTimeline", n);
        return n;
      });
      return true;
    } catch (e) {
      toast("失败：" + e.message);
      return false;
    } finally {
      setGen(g => ({ ...g, coupleTL: false }));
    }
  };
  // 情侣空间·纪念日倒计时：加/删；可选联动日历
  const addAnniv = (char, name, month, day, yearlyRepeat, linkCalendar) => {
    if (!(name || "").trim() || !month || !day) return;
    const mo = Math.max(1, Math.min(12, +month)), dy = Math.max(1, Math.min(31, +day));
    setCoupleAnniv(p => {
      const n = [{ id: "an_" + Date.now(), characterId: char.id, name: name.trim(), month: mo, day: dy, yearlyRepeat: !!yearlyRepeat, createdAt: Date.now() }, ...p];
      saveJSON("x_coupleAnniv", n);
      return n;
    });
    if (linkCalendar) { saveCalEvent(char.id, new Date().getFullYear() + "-" + mo + "-" + dy, name.trim(), "情侣纪念日"); toast("已加进日历"); }
  };
  const removeAnniv = id => setCoupleAnniv(p => {
    const n = p.filter(x => x.id !== id);
    saveJSON("x_coupleAnniv", n);
    return n;
  });
  // 情侣空间·情书：7 天硬门槛（距上一封 <7 天不生成）
  // 按情书设置解析这封信的字体/纸张（auto=随机字体）
  const letterStyleFor = char => {
    const cfg = coupleLetterCfg[char.id] || {};
    const fontKeys = ["serif", "kai", "round", "sans"];
    const paperKeys = ["cream", "kraft", "pink", "blue", "mint"];
    const font = (!cfg.font || cfg.font === "auto") ? fontKeys[Math.floor(Math.random() * fontKeys.length)] : cfg.font;
    const paper = (!cfg.paper || cfg.paper === "auto") ? paperKeys[Math.floor(Math.random() * paperKeys.length)] : cfg.paper;
    return { font, paper };
  };
  const genCoupleLetter = async char => {
    if (!active) { toast("请先到设置配置 API"); return false; }
    // 手动硬门槛：距上一封「TA 发的」情书 ≥3 天（被删的已不在数组、自动不算）
    const last = coupleLetters.filter(l => l.characterId === char.id && l.authorId !== "user").sort((a, b) => b.createdAt - a.createdAt)[0];
    if (last && Date.now() - last.createdAt < 3 * 86400000) {
      const days = Math.ceil((3 * 86400000 - (Date.now() - last.createdAt)) / 86400000);
      toast("距 TA 上一封情书还差 " + days + " 天，情书要慢慢来～");
      return false;
    }
    setGen(g => ({ ...g, coupleLetter: true }));
    try {
      const d = await runProbe(apiFor(char.id), ctxFor(char), {
        instruction: "你们是恋人。以「" + char.name + "」身份，给用户写一封**情书**——正式、真挚、有分量（不是日常小纸条）。一个标题 + 一段完整的信（150-300 字，贴人设，可回顾你们的点滴、说心里话，结尾落款），别喊口号、别写成流水账。信要写完整，别中途断。",
        schemaHint: "{\"title\":\"情书标题\",\"body\":\"信的正文\"}",
        maxTokens: 8000
      });
      const st = letterStyleFor(char);
      setCoupleLetters(p => {
        const n = [{ id: "lt_" + Date.now(), characterId: char.id, authorId: char.id, title: (d.title || "").trim(), body: (d.body || "").trim(), isRead: false, createdAt: Date.now(), font: st.font, paper: st.paper, replies: [] }, ...p];
        saveJSON("x_coupleLetters", n);
        return n;
      });
      return true;
    } catch (e) {
      toast("失败：" + e.message);
      return false;
    } finally {
      setGen(g => ({ ...g, coupleLetter: false }));
    }
  };
  // 情书按时间【后台】自发（她 2026-07-23：原来只在打开情书界面那一刻才检查 → 不点开十几天都收不到）。
  // 到点(freqDays，带按上封时间定的稳定随机，不点开也照算)就让恋人自己提笔写；每次最多一封防扎堆；≥3天硬地板同 genCoupleLetter。
  const maybeAutoLetters = async () => {
    if (!active || autoLetterBusyRef.current) return;
    autoLetterBusyRef.current = true;
    try {
      const cfgs = coupleLetterCfgRef.current || {};
      const cps = couplesRef.current || {};
      for (const c of (characters || [])) {
        if (!(cps[c.id] && cps[c.id].status === "together")) continue;
        const cfg = cfgs[c.id];
        if (!cfg || !cfg.auto) continue;
        const freq = Math.max(1, cfg.freqDays || 7);
        const lastChar = (coupleLettersRef.current || []).filter(l => l.characterId === c.id && l.authorId !== "user").sort((a, b) => b.createdAt - a.createdAt)[0];
        const days = lastChar ? (Date.now() - lastChar.createdAt) / 86400000 : 999;
        const r = lastChar ? ((lastChar.createdAt % 1000) / 1000) : 0.5; // 稳定随机，不随每次检查抖
        const threshold = cfg.freqRandom ? freq * (0.7 + r * 0.6) : freq;
        if (days < Math.max(3, threshold)) continue;
        const ok = await genCoupleLetter(c);
        if (ok) {
          toast(c.name + " 给你写了封情书");
          if (window.Notify) window.Notify.push({ title: c.name + " 给你写了封情书", body: "去情侣空间拆开看看", tag: "letter-" + c.id, charId: c.id });
        }
        break; // 一次最多一封
      }
    } catch (e) {/* 静默：后台自发失败不打扰 */ }
    finally { autoLetterBusyRef.current = false; }
  };
  // 触发器：开机延迟 + 每半小时 + 回前台/聚焦（都只在页面可见时跑；genCoupleLetter 自带3天地板，多查无害）
  useEffect(() => {
    if (!loaded) return;
    const run = () => { if (document.visibilityState === "visible") maybeAutoLetters(); };
    const t = setTimeout(run, 6000);
    const timer = setInterval(run, 30 * 60 * 1000);
    window.addEventListener("focus", run);
    document.addEventListener("visibilitychange", run);
    return () => { clearTimeout(t); clearInterval(timer); window.removeEventListener("focus", run); document.removeEventListener("visibilitychange", run); };
    // eslint-disable-next-line
  }, [loaded]);
  // TA 回信（一次多条气泡）
  const genLetterReply = async (char, letterId, context, isNewLetter) => {
    if (!active) { toast("请先到设置配置 API"); return false; }
    setGen(g => ({ ...g, coupleLetter: true }));
    try {
      const d = await runProbe(apiFor(char.id), ctxFor(char), { // 情书回信=TA 亲笔，跟随专线（v48.37）
        instruction: "你们是恋人，在情书里一来一回。" + (isNewLetter ? "用户刚给你写了一封情书，你读完后回应" : "顺着下面的情书往来，回应最新一句") + "。以「" + char.name + "」身份真挚回应，可以分成 2-4 条短消息（气泡），贴人设、别喊口号、别复述。\n【情书往来】\n" + (context || ""),
        schemaHint: "{\"bubbles\":[\"气泡1\",\"气泡2\"]}",
        maxTokens: 4000
      });
      const bubbles = Array.isArray(d.bubbles) ? d.bubbles.filter(Boolean) : (d.bubbles ? [String(d.bubbles)] : []);
      setCoupleLetters(p => {
        const n = p.map(l => l.id !== letterId ? l : { ...l, replies: [...(l.replies || []), ...bubbles.map(b => ({ authorId: char.id, content: String(b).trim(), ts: Date.now() }))] });
        saveJSON("x_coupleLetters", n);
        return n;
      });
      return true;
    } catch (e) {
      toast("失败：" + e.message);
      return false;
    } finally {
      setGen(g => ({ ...g, coupleLetter: false }));
    }
  };
  // 我给 TA 写一封情书 → 存 → TA 自动回（多气泡）
  const addMyLetter = (char, title, body, style) => {
    const tt = (title || "").trim(), bd = (body || "").trim();
    if (!bd) { toast("信的内容不能为空"); return; }
    const base = letterStyleFor(char);
    const st = { paper: (style && style.paper) || base.paper, font: (style && style.font && style.font !== "auto") ? style.font : base.font };
    const id = "lt_" + Date.now();
    setCoupleLetters(p => {
      const n = [{ id, characterId: char.id, authorId: "user", title: tt, body: bd, isRead: true, createdAt: Date.now(), font: st.font, paper: st.paper, replies: [] }, ...p];
      saveJSON("x_coupleLetters", n);
      return n;
    });
    genLetterReply(char, id, "【" + (tt || "无题") + "】\n" + bd, true);
  };
  // 情书下我留言 → TA 回
  const replyToLetter = (char, letterId, myText, threadText) => {
    const c = (myText || "").trim();
    if (!c) return;
    setCoupleLetters(p => {
      const n = p.map(l => l.id !== letterId ? l : { ...l, replies: [...(l.replies || []), { authorId: "user", content: c, ts: Date.now() }] });
      saveJSON("x_coupleLetters", n);
      return n;
    });
    genLetterReply(char, letterId, (threadText || "") + "\n我：" + c, false);
  };
  const saveLetterCfg = (charId, cfg) => setCoupleLetterCfg(p => {
    const n = { ...p, [charId]: cfg };
    saveJSON("x_coupleLetterCfg", n);
    return n;
  });
  const markLetterRead = id => setCoupleLetters(p => {
    const n = p.map(l => l.id === id ? { ...l, isRead: true } : l);
    saveJSON("x_coupleLetters", n);
    return n;
  });
  const removeCoupleLetter = id => setCoupleLetters(p => {
    const n = p.filter(l => l.id !== id);
    saveJSON("x_coupleLetters", n);
    return n;
  });
  // 情侣空间·甜蜜值每日打卡：每天一次，随机 +0.1~1
  const checkinSweet = char => {
    const today = ymd(new Date());
    setCoupleSweet(p => {
      const cur = p[char.id] || { value: 0, last: null };
      if (cur.last === today) { toast("今天已经打过甜蜜卡啦 💗"); return p; }
      const add = Math.round((0.1 + Math.random() * 0.9) * 10) / 10;
      const n = { ...p, [char.id]: { value: Math.round((cur.value + add) * 10) / 10, last: today } };
      saveJSON("x_coupleSweet", n);
      toast("甜蜜值 +" + add + " 💗");
      return n;
    });
  };
  // 一起听（展示型）：改数据统一走 saveListen；图片经 resizeImageFile 缩小再存
  const saveListen = updater => {
    // 播放器会在同一个点击事件里连续执行「写入整批队列 → 立即播放第一首」。
    // 只用 setState functional updater 时，React 要到下一次 render 才刷新 listenRef；
    // 第一首能靠传入的 song 对象播放，但下一首解析时可能看不见 nowBatch，队列就塌回单曲。
    // 因此先同步提交 ref，再更新 UI / 持久化：音频控制链当下就能读到完整队列。
    const prev = listenRef.current || listen || {};
    const n = typeof updater === "function" ? updater(prev) : updater;
    listenRef.current = n;
    setListen(n);
    saveJSON("x_listen", n);
    return n;
  };
  const setListenDisc = async file => {
    if (!file) { saveListen(p => ({ ...p, disc: null })); return; }
    try { const url = await resizeImageFile(file, 500, 0.82); saveListen(p => ({ ...p, disc: url })); }
    catch (e) { toast("图片处理失败"); }
  };
  const addListenSong = async (title, artist, coverFile) => {
    const tt = (title || "").trim();
    if (!tt) return;
    let cover = null;
    if (coverFile) { try { cover = await resizeImageFile(coverFile, 500, 0.82); } catch (e) {} }
    saveListen(p => ({ ...p, songs: [{ id: "sg_" + Date.now(), title: tt, artist: (artist || "").trim(), cover: cover, ts: Date.now() }, ...(p.songs || [])].slice(0, 30) }));
  };
  const removeListenSong = id => { idbAudioDel(id); saveListen(p => ({ ...p, songs: (p.songs || []).filter(x => x.id !== id) })); };
  // ---- 全局播放器 handlers ----
  // 规整 Cookie：用户常只粘 MUSIC_U 的值、忘了前缀 → 自动补 "MUSIC_U="；去引号/结尾分号
  const normCookie = () => {
    let c = (neteaseCookie || "").trim().replace(/^["']|["']$/g, "").trim();
    if (!c) return "";
    if (!/MUSIC_U\s*=/i.test(c)) c = "MUSIC_U=" + c.replace(/;+\s*$/, "");
    return c;
  };
  const resolvePlayUrl = async song => {
    if (!song) return null;
    if (song.source === "keepalive") return KEEPALIVE_WAV;
    if (song.source === "local") { const blob = await idbAudioGet(song.id); return blob ? URL.createObjectURL(blob) : null; }
    if (song.source === "netease") {
      if (!neteaseApi) return null;
      // 带上账号 Cookie（若填了）→ 后端转发给网易云 → 能拿到 VIP 歌的真链接；没填就走匿名（免费/无版权歌）
      const cval = normCookie(); const ck = cval ? "&cookie=" + encodeURIComponent(cval) : "";
      try { const r = await fetch(neteaseApi + "/song/url/v1?level=exhigh&id=" + song.neteaseId + ck + "&timestamp=" + Date.now()); const d = await r.json(); let u = d && d.data && d.data[0] && d.data[0].url; if (!u) { const r2 = await fetch(neteaseApi + "/song/url?id=" + song.neteaseId + ck + "&timestamp=" + Date.now()); const d2 = await r2.json(); u = d2 && d2.data && d2.data[0] && d2.data[0].url; } return u ? String(u).replace(/^http:/, "https:") : null; } catch (e) { return null; }
    }
    return null;
  };
  // 抓网易云歌词（让一起听的角色知道歌词，v48.87 她要）：只对 netease 歌、缓存进 songLyricsRef、去时间戳与制作信息、封顶。本地/外链歌没歌词
  const fetchLyrics = async song => {
    if (!song || song.source !== "netease" || !song.neteaseId || !neteaseApi) return;
    if (songLyricsRef.current[song.neteaseId] !== undefined) return; // 抓过(含抓到空)就不重抓
    try {
      const r = await fetch(neteaseApi + "/lyric?id=" + song.neteaseId + "&timestamp=" + Date.now());
      const d = await r.json();
      const raw = (d && d.lrc && d.lrc.lyric) || "";
      const plain = raw.replace(/\[\d{1,2}:\d{2}(?:[.:]\d{1,3})?\]/g, "").split("\n").map(s => s.trim()).filter(s => s && !/^(作词|作曲|编曲|制作|出品|监制|录音|混音|母带|吉他|贝斯|鼓|键盘|和声|Producer|Written)\s*[:：]/i.test(s)).join("\n").trim();
      songLyricsRef.current[song.neteaseId] = plain.slice(0, 1200); // 封顶 1200 字防超长（纯器乐存空串）
    } catch (e) { songLyricsRef.current[song.neteaseId] = ""; }
  };
  // 歌曲可能来自：全部库(songs) / 某个歌单(playlists[].songs，各自独立存整份) / 临时正在放的搜索结果(nowSong)。
  // 三处都不互相依赖：从「全部」删歌不影响歌单；「现在播放」搜索结果不塞进「全部」。
  const resolveSong = id => {
    if (id === KEEPALIVE_ID) return KEEPALIVE_SONG;
    const L = listenRef.current || {};
    if (L.nowSong && L.nowSong.id === id) return L.nowSong;
    // 云村「播放全部」的当前批次（日推/网易云歌单整单连播），不进「全部」库
    const b = (L.nowBatch || []).find(x => x.id === id);
    if (b) return b;
    let s = (L.songs || []).find(x => x.id === id);
    if (s) return s;
    for (const pl of (L.playlists || [])) { const f = (pl.songs || []).find(x => x.id === id); if (f) return f; }
    return null;
  };
  const playSong = async (songOrId, queueIds) => {
    const L = listenRef.current || {};
    let song = (songOrId && typeof songOrId === "object") ? songOrId : resolveSong(songOrId);
    if (!song) return;
    // 静音保活：像歌一样播，但循环放静音、不写历史、不进队列（下一首/上一首会跳去真歌）
    if (song.source === "keepalive") {
      if (playUrlRef.current) { URL.revokeObjectURL(playUrlRef.current); playUrlRef.current = null; }
      playerSongIdRef.current = KEEPALIVE_ID;
      setPlayer(p => ({ ...p, songId: KEEPALIVE_ID, loading: false, playing: false, err: null, t: 0, dur: 0 }));
      saveListen(p => ({ ...p, nowId: KEEPALIVE_ID })); // 不动 nowQueue/nowSong：保活不走队列，切回真歌能续原队列
      const elk = audioElRef.current;
      if (elk) { elk.loop = true; elk.src = KEEPALIVE_WAV; elk.play().then(() => setPlayer(p => ({ ...p, playing: true }))).catch(() => setPlayer(p => ({ ...p, playing: false }))); }
      return;
    }
    if (!song.id) song = { ...song, id: "sg_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6) };
    const songId = song.id;
    const inLib = (L.songs || []).some(s => s.id === songId);
    const inPl = (L.playlists || []).some(pl => (pl.songs || []).some(s => s.id === songId));
    playerSongIdRef.current = songId;
    // 用户主动点歌/播放全部时，旧曲目预取好的 next 已经作废。
    nextUpRef.current = { id: null, url: null, song: null };
    setPlayer(p => ({ ...p, songId: songId, loading: true, playing: false, err: null }));
    saveListen(p => {
      const hist = [{ id: song.id, title: song.title, artist: song.artist || "", partnerId: p.partnerId || null, ts: Date.now() }, ...(p.history || []).filter(x => x.id !== song.id)].slice(0, 30);
      const patch = { ...p, nowId: songId, history: hist };
      // 播放队列：①显式传了就用；②没传但当前歌本就在已存队列里（如退出小手机再回来续播歌单）→ 保留原队列，
      // 别塌成单曲；③从「全部」库放就整库当队列；④再否则(搜索结果单曲)就只这一首
      if (queueIds && queueIds.length) patch.nowQueue = queueIds;
      else if (p.nowQueue && p.nowQueue.length > 1 && p.nowQueue.includes(songId)) patch.nowQueue = p.nowQueue;
      else if (inLib) patch.nowQueue = (p.songs || []).map(s => s.id);
      else patch.nowQueue = [songId];
      // 不在库/歌单里的（搜索结果直接播放）→ 暂存为 nowSong，供 resolveSong 找到，但不进「全部」
      if (!inLib && !inPl) patch.nowSong = song; else patch.nowSong = (p.nowSong && p.nowSong.id === songId) ? null : p.nowSong;
      return patch;
    });
    fetchLyrics(song); // 并行抓歌词(网易云歌)，让一起听的角色知道歌词；不 await、不挡播放
    const url = await resolvePlayUrl(song);
    if (playUrlRef.current) { URL.revokeObjectURL(playUrlRef.current); playUrlRef.current = null; }
    if (!url) { setPlayer(p => ({ ...p, loading: false, playing: false, err: song.source === "netease" ? "拿不到播放地址（多半 VIP/无版权）" : "音频丢了（可能清过缓存）" })); return; }
    if (song.source === "local") playUrlRef.current = url;
    const el = audioElRef.current;
    if (el) { el.loop = false; el.src = url; el.play().then(() => setPlayer(p => ({ ...p, playing: true, loading: false }))).catch(() => setPlayer(p => ({ ...p, loading: false }))); }
  };
  const togglePlay = () => {
    const el = audioElRef.current; if (!el) return;
    const L = listenRef.current || {};
    // 冷启动时不能重新从「全部」第一首建一个新单曲队列：优先恢复上次曲目及其完整队列。
    // 这样关 App 前正在播云歌单第 N 首，回来按播放仍从第 N 首接着按原列表走。
    const savedQueue = (L.nowQueue || []).filter(id => id !== KEEPALIVE_ID && !!resolveSong(id));
    const restoredId = (L.nowId && L.nowId !== KEEPALIVE_ID && resolveSong(L.nowId) && L.nowId)
      || savedQueue[0]
      || (L.songs && L.songs[0] && L.songs[0].id)
      || null;
    if (!player.songId) { if (restoredId) playSong(restoredId, savedQueue.length ? savedQueue : undefined); return; }
    if (el.paused) { if (!el.getAttribute("src")) return playSong(restoredId || player.songId, savedQueue.length ? savedQueue : L.nowQueue); el.play(); setPlayer(p => ({ ...p, playing: true })); }
    else { el.pause(); setPlayer(p => ({ ...p, playing: false })); }
  };
  // 队列优先用 nowQueue（播放歌单/播放搜索结果时设的），否则全库；上一首/下一首在队列里循环。
  // 关键：切歌时把当前队列一起传给 playSong，否则播放歌单里点下一首会把队列缩成单曲。
  const stepSong = dir => {
    const L = listenRef.current, all = L.songs || [];
    const currentId = playerSongIdRef.current || player.songId;
    // 正放「静音保活」时，上/下一首 = 跳进真的歌单第一首（方便从保活直接切到真歌）
    if (currentId === KEEPALIVE_ID) { if (all.length) playSong(all[0].id, all.map(s => s.id)); return; }
    let q = (L.nowQueue && L.nowQueue.length ? L.nowQueue : all.map(s => s.id)).filter(id => id !== KEEPALIVE_ID && !!resolveSong(id));
    if (!q.length) return;
    if ((L.playMode || "order") === "shuffle" && q.length > 1) {
      let n; do { n = q[Math.floor(Math.random() * q.length)]; } while (n === currentId);
      playSong(n, q); return;
    }
    const i = Math.max(0, q.indexOf(currentId));
    playSong(q[(i + dir + q.length) % q.length], q);
  };
  // ---- 下一首预取：iOS 锁屏/后台时，onEnded 里若还要 await 解析地址，那次 play() 会被当成
  // 「非用户续播」拦掉 → 卡住不换歌。所以提前把下一首地址备好，ended 时同步换 src+play() 才放得出。
  const nextUpRef = useRef({ id: null, url: null, song: null });
  const computeNextId = () => {
    const currentId = playerSongIdRef.current || player.songId;
    if (currentId === KEEPALIVE_ID) return null; // 保活循环放，不预取下一首
    const L = listenRef.current || {};
    const all = L.songs || [];
    const q = (L.nowQueue && L.nowQueue.length ? L.nowQueue : all.map(s => s.id)).filter(id => !!resolveSong(id));
    if (!q.length) return null;
    const mode = L.playMode || "order";
    if (mode === "one") return currentId || q[0];
    if (mode === "shuffle" && q.length > 1) { let n; do { n = q[Math.floor(Math.random() * q.length)]; } while (n === currentId); return n; }
    const i = Math.max(0, q.indexOf(currentId));
    return q[(i + 1 + q.length) % q.length];
  };
  const preloadNext = async () => {
    const fromId = playerSongIdRef.current || player.songId;
    const id = computeNextId();
    if (!id) { nextUpRef.current = { id: null, url: null, song: null }; return; }
    if (nextUpRef.current.id === id && nextUpRef.current.url) return; // 已备好
    const song = resolveSong(id);
    if (!song) return;
    const url = await resolvePlayUrl(song);
    // 切歌/换队列期间旧请求即使晚回来，也不准覆盖新曲目的下一首。
    if ((playerSongIdRef.current || player.songId) !== fromId || computeNextId() !== id) return;
    if (url) nextUpRef.current = { id, url, song };
  };
  // 播放结束自动下一首：单曲循环重播；否则用预取好的地址同步续播（后台/锁屏也能切），没预取到才退回异步路径
  const advanceSong = () => {
    const L = listenRef.current || {};
    const mode = L.playMode || "order";
    const el = audioElRef.current;
    const currentId = playerSongIdRef.current || player.songId;
    if (mode === "one" && currentId && el) { try { el.currentTime = 0; const pr = el.play(); if (pr && pr.catch) pr.catch(() => {}); setPlayer(p => ({ ...p, playing: true })); return; } catch (e) {} }
    const nu = nextUpRef.current;
    if (el && nu && nu.url && nu.song) {
      const song = nu.song, songId = nu.id;
      playerSongIdRef.current = songId;
      if (song.source === "local") { if (playUrlRef.current) URL.revokeObjectURL(playUrlRef.current); playUrlRef.current = nu.url; }
      el.src = nu.url;
      const pr = el.play(); if (pr && pr.then) pr.then(() => setPlayer(p => ({ ...p, playing: true, loading: false }))).catch(() => setPlayer(p => ({ ...p, loading: false })));
      setPlayer(p => ({ ...p, songId, playing: true, loading: false, err: null, t: 0 }));
      saveListen(p => {
        const hist = [{ id: song.id, title: song.title, artist: song.artist || "", partnerId: p.partnerId || null, ts: Date.now() }, ...(p.history || []).filter(x => x.id !== song.id)].slice(0, 30);
        return { ...p, nowId: songId, history: hist };
      });
      nextUpRef.current = { id: null, url: null, song: null };
      setTimeout(preloadNext, 400);
      return;
    }
    stepSong(1);
  };
  // 顺序 → 单曲循环 → 随机 → 顺序
  const cyclePlayMode = () => saveListen(p => { const order = ["order", "one", "shuffle"]; const cur = p.playMode || "order"; return { ...p, playMode: order[(order.indexOf(cur) + 1) % 3] }; });
  const seekPlayer = frac => { const el = audioElRef.current; if (el && el.duration) el.currentTime = Math.max(0, Math.min(1, frac)) * el.duration; };
  // 悬浮球上的叉：立刻停播 + 收起悬浮（player.songId 清空 → 悬浮不显示）。再进一起听点歌才会重新唤起。
  const stopPlayer = () => {
    const el = audioElRef.current;
    if (el) { el.pause(); el.loop = false; el.removeAttribute("src"); try { el.load(); } catch (e) {} }
    if (playUrlRef.current) { URL.revokeObjectURL(playUrlRef.current); playUrlRef.current = null; }
    playerSongIdRef.current = null;
    nextUpRef.current = { id: null, url: null, song: null };
    setPlayer(p => ({ ...p, songId: null, playing: false, t: 0, dur: 0, loading: false, err: null }));
  };
  // ---- Media Session：锁屏/后台控制 + 让 iOS 把这当正经播放器 ----
  // 关键：不接 Media Session 时，锁屏/切到后台后 iOS 会挂起页面 JS，一首放完 onEnded 不跑、
  // 也不让程序化续播 → 就卡在原地不换下一首。接上 metadata + 动作句柄后系统才会持续给它跑，能后台自动切歌。
  // 句柄只注册一次，内部走 ref 调最新的控制函数，避免闭包过期。
  const mediaCtlRef = useRef({});
  mediaCtlRef.current = {
    play: () => { const el = audioElRef.current; if (el && el.paused) togglePlay(); },
    pause: () => { const el = audioElRef.current; if (el && !el.paused) togglePlay(); },
    next: () => stepSong(1),
    prev: () => stepSong(-1),
    seekTo: sec => { const el = audioElRef.current; if (el && el.duration) seekPlayer(sec / el.duration); }
  };
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;
    const set = (a, fn) => { try { ms.setActionHandler(a, fn); } catch (e) {} };
    set("play", () => mediaCtlRef.current.play());
    set("pause", () => mediaCtlRef.current.pause());
    set("previoustrack", () => mediaCtlRef.current.prev());
    set("nexttrack", () => mediaCtlRef.current.next());
    set("seekto", d => { if (d && typeof d.seekTime === "number") mediaCtlRef.current.seekTo(d.seekTime); });
    return () => ["play", "pause", "previoustrack", "nexttrack", "seekto"].forEach(a => set(a, null));
  }, []);
  // 当前曲目信息 + 播放态同步给系统（锁屏显示 + 维持后台会话）
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const cur = resolveSong(player.songId);
    if (cur && typeof MediaMetadata !== "undefined") {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: cur.title || "未知",
          artist: cur.artist || "",
          artwork: cur.cover ? [{ src: cur.cover, sizes: "512x512", type: "image/png" }] : []
        });
      } catch (e) {}
    }
    try { navigator.mediaSession.playbackState = player.songId ? (player.playing ? "playing" : "paused") : "none"; } catch (e) {}
  }, [player.songId, player.playing]);
  // 歌一开始放就预取下一首地址，供 onEnded 后台同步续播（见 advanceSong / preloadNext）
  useEffect(() => {
    if (!player.songId || !player.playing) return;
    nextUpRef.current = { id: null, url: null, song: null };
    const tid = setTimeout(() => { preloadNext(); }, 600);
    return () => clearTimeout(tid);
  }, [player.songId, player.playing]);
  // fav / 封面 / 改名：在「全部」库、所有歌单、nowSong 里凡是同 id 的都改（保持各处一份数据一致）
  const patchSongEverywhere = (id, patch) => saveListen(p => ({
    ...p,
    songs: (p.songs || []).map(s => s.id === id ? { ...s, ...patch } : s),
    playlists: (p.playlists || []).map(pl => ({ ...pl, songs: (pl.songs || []).map(s => s.id === id ? { ...s, ...patch } : s) })),
    nowSong: p.nowSong && p.nowSong.id === id ? { ...p.nowSong, ...patch } : p.nowSong
  }));
  const toggleFav = id => {
    const s = resolveSong(id);
    const nowFav = !(s && s.fav);
    const inLib = (listenRef.current.songs || []).some(x => x.id === id);
    // 收藏一首还没进库的歌（搜索结果直接播的只暂存在 nowSong、不在 songs 里）→ 顺手加进「全部」，
    // 否则收藏列表(favs=songs.filter(fav))看不到它、且 nowSong 是临时的换首歌就丢了
    if (nowFav && !inLib && s) {
      saveListen(p => ({
        ...p,
        songs: [{ ...s, fav: true }, ...(p.songs || [])],
        nowSong: (p.nowSong && p.nowSong.id === id) ? { ...p.nowSong, fav: true } : p.nowSong
      }));
      return;
    }
    patchSongEverywhere(id, { fav: nowFav });
  };
  const renameSong = (id, title) => { const tt = (title || "").trim(); if (tt) patchSongEverywhere(id, { title: tt }); };
  const setSongCover = async (songId, file) => {
    if (!file) return;
    try { const url = await resizeImageFile(file, 500, 0.82); patchSongEverywhere(songId, { cover: url }); }
    catch (e) { toast("图片处理失败"); }
  };
  // 命名歌单（放「我的」）：各歌单独立存整份歌对象，和「全部」库无依赖
  const cloneSong = s => ({ ...s, id: (s.id || "sg_") + "_pl" + Math.random().toString(36).slice(2, 6) });
  const createPlaylist = (name, songObjs, extra) => { const id = "pl_" + Date.now(); saveListen(p => ({ ...p, playlists: [{ id, name: (name || "新歌单").trim() || "新歌单", songs: (songObjs || []).map(cloneSong), ts: Date.now(), ...(extra || {}) }, ...(p.playlists || [])] })); return id; };
  const deletePlaylist = id => saveListen(p => ({ ...p, playlists: (p.playlists || []).filter(x => x.id !== id) }));
  const renamePlaylist = (id, name) => { const nm = (name || "").trim(); if (nm) saveListen(p => ({ ...p, playlists: (p.playlists || []).map(x => x.id === id ? { ...x, name: nm } : x) })); };
  const addToPlaylist = (plId, song) => { if (!song) return; saveListen(p => ({ ...p, playlists: (p.playlists || []).map(pl => pl.id === plId ? ((pl.songs || []).some(s => (song.neteaseId && s.neteaseId === song.neteaseId) || s.id === song.id) ? pl : { ...pl, songs: [...(pl.songs || []), cloneSong(song)] }) : pl) })); toast("已加入歌单"); };
  const removeFromPlaylist = (plId, songId) => saveListen(p => ({ ...p, playlists: (p.playlists || []).map(pl => pl.id === plId ? { ...pl, songs: (pl.songs || []).filter(s => s.id !== songId) } : pl) }));
  // 开关：让一起听的角色在聊天界面自行评论正在听的歌（关=不主动提，省 api）
  const setListenAutoComment = v => saveListen(p => ({ ...p, autoComment: !!v }));
  // 接受角色的「一起听」邀请：设为一起听对象 + 有指定歌就找/搜来放 + 跳到播放器
  const acceptListenInvite = async (charId, songTitle) => {
    setListenPartner(charId);
    const tt = (songTitle || "").trim();
    if (tt) {
      const lib = listenRef.current.songs || [];
      let hit = lib.find(s => s.title && (s.title === tt || s.title.includes(tt) || tt.includes(s.title)));
      if (hit) playSong(hit.id);
      else if (neteaseApi) {
        try { const r = await fetch(neteaseApi + "/search?keywords=" + encodeURIComponent(tt) + "&limit=1"); const d = await r.json(); const s = d && d.result && d.result.songs && d.result.songs[0]; if (s) playSong(resultToSong({ id: s.id, name: s.name, artist: (s.artists || s.ar || []).map(a => a.name).filter(Boolean).join(" / "), cover: (s.album || s.al || {}).picUrl })); } catch (e) {}
      }
    }
    goListen();
  };
  // 自动感知音乐（item 6）：开了"让 TA 聊歌"且正在看该角色私聊时，换歌会让 TA 自动就着新歌说一句（消耗一次回复；关掉开关就不动 api）
  const lastAutoSongRef = useRef(null);
  useEffect(() => {
    const L = listenRef.current || {};
    if (!L.autoComment || !player.songId) { lastAutoSongRef.current = player.songId; return; }
    if (player.songId === lastAutoSongRef.current) return;
    const prev = lastAutoSongRef.current;
    lastAutoSongRef.current = player.songId;
    if (prev == null) return; // 首次加载不触发
    if (screen === "thread" && activeChar && activeChar.id === L.partnerId) {
      const cid = activeChar.id;
      setTimeout(() => { if (!laneBusy("c:" + cid)) replyNow(cid, null, null, { proactive: true }); }, 900);
    }
  }, [player.songId]);
  // 网易云外链：贴链接/分享文案/裸ID → 抠 id，用官方 outchain iframe 播放（无需登陆；VIP/版权歌可能放不了）
  const addNeteaseSong = (input, title, artist) => {
    const nid = parseNeteaseId(input);
    if (!nid) { toast("没认出网易云歌曲链接或ID"); return; }
    saveListen(p => ({ ...p, songs: [{ id: "sg_" + Date.now(), source: "netease", neteaseId: nid, title: (title || "").trim() || ("网易云歌曲 " + nid), artist: (artist || "").trim(), ts: Date.now() }, ...(p.songs || []).filter(x => x.neteaseId !== nid)].slice(0, 40) }));
    toast("已添加");
  };
  // 本地音频：真文件 → 存 IndexedDB（持久），播放时取出建 objectURL
  const addLocalSong = async (file, title, artist) => {
    if (!file) return;
    const id = "sg_" + Date.now();
    try { await idbAudioPut(id, file); } catch (e) { toast("音频存储失败"); return; }
    saveListen(p => ({ ...p, songs: [{ id, source: "local", title: (title || "").trim() || file.name.replace(/\.[^.]+$/, ""), artist: (artist || "").trim(), ts: Date.now() }, ...(p.songs || [])].slice(0, 40) }));
    toast("已添加");
  };
  const setListenPartner = charId => saveListen(p => ({ ...p, partnerId: charId }));
  const saveNeteaseApi = url => { const u = (url || "").trim().replace(/\/+$/, ""); setNeteaseApi(u); saveJSON("x_neteaseApi", u); toast(u ? "已连搜索接口" : "已清空"); };
  const saveNeteaseCookie = ck => { const c = (ck || "").trim(); setNeteaseCookie(c); saveJSON("x_neteaseCookie", c); toast(c ? "已保存 Cookie（可放 VIP 了）" : "已清空 Cookie"); };
  // 测试网易云登录/VIP 状态
  const testNeteaseLogin = async () => {
    if (!neteaseApi) { toast("先填接口地址"); return; }
    const cval = normCookie();
    if (!cval) { toast("先填 Cookie"); return; }
    try {
      // 用 /user/account 更可靠地反映登录态（/login/status 在 serverless 偶尔认不出）
      const r = await fetch(neteaseApi + "/user/account?cookie=" + encodeURIComponent(cval) + "&timestamp=" + Date.now());
      const d = await r.json();
      const prof = (d && d.profile) || (d && d.data && d.data.profile) || null;
      const vip = (d && d.account && d.account.vipType) || 0;
      if (prof && prof.nickname) toast("已登录：" + prof.nickname + (vip ? " · VIP" : " · 非VIP"));
      else toast("未登录（Cookie 失效或没粘全，重抓一份 MUSIC_U）");
    } catch (e) { toast("测试失败：接口没响应"); }
  };
  // 网易云搜索结果 → 播放器歌对象
  const resultToSong = s => ({ id: "sg_" + Date.now() + "_" + s.id + "_" + Math.random().toString(36).slice(2, 5), source: "netease", neteaseId: String(s.id), title: s.name || ("网易云 " + s.id), artist: s.artist || "", cover: s.cover || null, ts: Date.now() });
  // 搜索结果：直接现在播放（临时，不塞进「全部」）/ 加进「全部」库 / 加进某个歌单
  const playNeteaseResult = s => playSong(resultToSong(s));
  // 整列表连播（云村「播放全部」）：以前是逐首收库+单放第一首——收库和播放各随机造一个 id，
  // 播放器一看「这歌不在库里」就把队列塌成单曲循环（她 2026-08-21 日推报的）。
  // 现在按 neteaseId 造稳定 id、整批存进 nowBatch（不污染「全部」库）、显式传队列。
  const playNeteaseList = list => {
    const rows = (list || []).filter(s => s && s.id);
    if (!rows.length) return;
    const ss = rows.map(s => ({ ...resultToSong(s), id: "sgn_" + s.id }));
    // 「播放全部」表达的是从头开始连播整张列表。若保留上一次的单曲循环模式，
    // 队列虽然完整，ended 仍会重播第一首，用户看到的就像「播放全部」坏了。
    saveListen(p => ({ ...p, nowBatch: ss, playMode: "order" }));
    playSong(ss[0], ss.map(x => x.id));
  };
  const addNeteaseResult = s => saveListen(p => ({ ...p, songs: [resultToSong(s), ...(p.songs || []).filter(x => x.neteaseId !== String(s.id))].slice(0, 60) }));
  const addResultToPlaylist = (plId, s) => addToPlaylist(plId, resultToSong(s));
  // 根据角色人设造一张歌单：让角色推歌名 → 逐首去网易云搜到真曲(可直接听) → 建独立歌单归到 charId（不进「全部」库）
  const genCharPlaylist = async char => {
    if (!char) return;
    if (!active) { toast("请先到设置配置 API"); return; }
    if (!neteaseApi) { toast("先在下方配一个网易云搜索接口，才能拉到能播的歌"); return; }
    setGen(g => ({ ...g, charPlaylist: char.id }));
    try {
      // 已有歌单：新生成【往里加】不覆盖、跳过重复。先拿到已有的歌，既让模型别再推、也在入库时去重。
      const existingPl = (listenRef.current.playlists || []).find(x => x.charId === char.id);
      const existingSongs = (existingPl && existingPl.songs) || [];
      const existingIds = new Set(existingSongs.map(s => s.neteaseId).filter(Boolean));
      const existingTitles = existingSongs.map(s => s.title).filter(Boolean);
      const avoidStr = existingTitles.length ? "\n**这张歌单里已经有这些歌了，别再推荐它们、也别推重复的，给全新的：** " + existingTitles.slice(0, 50).join("、") : "";
      // 用干净上下文：去掉手机在听/最近听歌/朋友圈等会污染推荐的字段（否则角色只会照抄用户刚搜的、或查手机里那两首）
      const cleanCtx = Object.assign({}, ctxFor(char), { listenLog: "", momentLog: "", forumEcho: "", giftLog: "", recentChat: "" });
      // 解析：可能是 {songs:[...]}、裸数组、{list/data/result:[...]}；元素可能是对象或"歌名 - 歌手"字符串
      const parseWants = rec => {
        let raw = rec && Array.isArray(rec.songs) ? rec.songs : Array.isArray(rec) ? rec : (rec && (rec.list || rec.data || rec.result || rec.tracks)) || [];
        return (Array.isArray(raw) ? raw : []).map(w => {
          if (typeof w === "string") { const parts = w.replace(/^\d+[.、)\s]+/, "").split(/\s*[-–—/]\s*/); return { title: (parts[0] || "").replace(/^《|》$/g, "").trim(), artist: (parts[1] || "").trim() }; }
          return { title: String((w && (w.title || w.name || w.song)) || "").trim(), artist: String((w && (w.artist || w.singer || w.by)) || "").trim() };
        }).filter(s => s.title);
      };
      const probeOnce = async nudge => {
        try {
          const rec = await runProbe(active, cleanCtx, {
            instruction: "你是「" + char.name + "」。**完全按你自己的人设、成长背景、性格和音乐口味**，一次性列出 **15 首**你自己私下真会单曲循环、真实存在、能在主流平台搜到的歌（华语/欧美/日韩都行，别编造不存在的歌，风格可多样）。**别照抄任何你手机里在听/最近听过/用户刚搜过或已有的歌，要发自内心喜欢的。songs 数组要尽量凑满 15 个元素。**" + avoidStr + (nudge || "") + " 只给歌，别写解释别写序号。",
            schemaHint: "{\"songs\":[{\"title\":\"某首歌\",\"artist\":\"某歌手\"}]}（songs 尽量给 15 个元素）", maxTokens: 2200
          });
          return parseWants(rec);
        } catch (e) { return []; }
      };
      // 多要一些候选（网易云搜不到会掉一部分），不够就再刷一两轮凑
      let wants = await probeOnce("");
      let tries = 0;
      while (wants.length < 12 && tries < 2) {
        tries++;
        const more = await probeOnce("上次给少了，这次再多给一些不一样的歌，把 15 首凑够。");
        const seen = new Set(wants.map(s => s.title));
        more.forEach(s => { if (s.title && !seen.has(s.title)) { seen.add(s.title); wants.push(s); } });
      }
      wants = wants.slice(0, 18);
      if (!wants.length) { toast("没生成出歌，重试下"); return; }
      const searchOne = async kw => {
        try { const r = await fetch(neteaseApi + "/search?keywords=" + encodeURIComponent(kw) + "&limit=1&timestamp=" + Date.now()); const d = await r.json(); return (d && d.result && d.result.songs && d.result.songs[0]) || null; } catch (e) { return null; }
      };
      const added = [];
      for (const w of wants) {
        if (added.length >= 14) break;
        let hit = await searchOne((w.title + " " + (w.artist || "")).trim());
        if (!hit) hit = await searchOne(w.title); // 带歌手搜不到 → 只用歌名再试
        if (!hit) continue;
        const nid = String(hit.id);
        if (added.some(a => a.neteaseId === nid) || existingIds.has(nid)) continue; // 跳过本轮重复 + 歌单里已有的
        const cover = ((hit.album || hit.al || {}).picUrl) || null;
        const artist = (hit.artists || hit.ar || []).map(a => a.name).filter(Boolean).join(" / ") || (w.artist || "");
        added.push({ id: "sg_" + Date.now() + "_" + nid, source: "netease", neteaseId: nid, title: hit.name || w.title, artist, cover, ts: Date.now() });
      }
      if (!added.length) { toast("网易云没搜到这些歌（换个接口或稍后再试）"); return; }
      // 往已有歌单里【追加】新歌、按 neteaseId + 歌名歌手去重；没有就新建
      let freshCount = 0;
      saveListen(p => {
        const pls = p.playlists || [];
        const existing = pls.find(x => x.charId === char.id);
        if (existing) {
          const haveIds = new Set((existing.songs || []).map(s => s.neteaseId).filter(Boolean));
          const haveKeys = new Set((existing.songs || []).map(s => (String(s.title) + "|" + String(s.artist)).toLowerCase()));
          const fresh = added.filter(s => !(s.neteaseId && haveIds.has(s.neteaseId)) && !haveKeys.has((String(s.title) + "|" + String(s.artist)).toLowerCase()));
          freshCount = fresh.length;
          const merged = Object.assign({}, existing, { songs: [...(existing.songs || []), ...fresh], cover: existing.cover || (added[0] && added[0].cover) || null, ts: Date.now() });
          return { ...p, playlists: [merged, ...pls.filter(x => x.charId !== char.id)] };
        }
        freshCount = added.length;
        return { ...p, playlists: [{ id: "pl_" + Date.now(), name: char.name + "的歌单", charId: char.id, cover: added[0].cover || null, songs: added, ts: Date.now() }, ...pls] };
      });
      if (!existingSongs.length) toast(char.name + " 的歌单好了 · " + added.length + " 首");
      else if (freshCount) toast("给 " + char.name + " 的歌单又添了 " + freshCount + " 首" + (added.length - freshCount > 0 ? "（跳过 " + (added.length - freshCount) + " 首重复）" : ""));
      else toast("这轮推的歌都已经在歌单里了，没新增");
    } catch (e) { toast("生成失败：" + (e.message || "重试")); }
    finally { setGen(g => ({ ...g, charPlaylist: null })); }
  };
  // TA 主动贴一张（右上刷新触发；未来接调度器）
  const genCoupleNote = async char => {
    if (!active) { toast("请先到设置配置 API"); return false; }
    setGen(g => ({ ...g, coupleNote: true }));
    try {
      const d = await runProbe(bgActive, ctxFor(char), {
        instruction: "你们是恋人。以「" + char.name + "」身份，在你俩私密的「便签墙」上悄悄贴一张小纸条给用户——一句恋爱向、藏着心意、想对 TA 说却没在聊天里直接说出口的悄悄话（不是脑内碎碎念的心声，是想让 TA 悄悄收到的情话/在乎），贴合人设与此刻心情，别喊口号，别超过 25 字。",
        schemaHint: "{\"note\":\"给 TA 的悄悄情话\"}"
      });
      setCoupleNotes(p => {
        const n = [{ id: "note_" + Date.now(), characterId: char.id, authorId: char.id, content: (d.note || "").trim(), style: Math.floor(Math.random() * 5), createdAt: Date.now(), replies: [] }, ...p];
        saveJSON("x_coupleNotes", n);
        return n;
      });
      return true;
    } catch (e) {
      toast("失败：" + e.message);
      return false;
    } finally {
      setGen(g => ({ ...g, coupleNote: false }));
    }
  };

  // ============================================================
  // 购物 Shopping —— 商品流生成 / 购物车 / 结算(购买·送礼·代付·亲属卡) / 待发货待收货
  // ============================================================
  // 各品类送达用时（分钟区间）——外卖约半小时，实物几小时到一两天
  const CAT_DELIVER = { food: [25, 35], beauty: [180, 360], digital: [240, 480], fashion: [180, 360], adult: [240, 480], recommend: [180, 360], furniture: [720, 1440] };
  const deliverMsForCat = cat => { const r = CAT_DELIVER[cat] || [180, 360]; return Math.round((r[0] + Math.random() * (r[1] - r[0])) * 60000); };
  const saveOrders = updater => setOrders(p => {
    const n = typeof updater === "function" ? updater(p) : updater;
    ordersRef.current = n;
    saveJSON("x_shopOrders", n);
    return n;
  });
  const addOrder = o => saveOrders(p => [{
    id: "od_" + Date.now() + "_" + Math.floor(Math.random() * 10000),
    status: "shipping",
    arriveTs: Date.now() + deliverMsForCat(o.cat),
    ts: Date.now(),
    fromCharId: null,
    payLabel: "",
    cat: null,
    ...o
  }, ...p]);
  const promoteOrders = () => {
    const now = Date.now();
    let changed = false;
    const n = ordersRef.current.map(o => {
      if (o.status === "shipping" && o.arriveTs <= now) {
        changed = true;
        return { ...o, status: "receiving" };
      }
      return o;
    });
    if (changed) saveOrders(n);
  };
  // 我送给角色的礼物到点：入 TA 的随身物品(永久) + TA 才 cue 到收到、做出反应
  const promoteGifts = () => {
    const now = Date.now();
    const due = giftOutRef.current.filter(g => g.arriveTs <= now);
    if (!due.length) return;
    const rest = giftOutRef.current.filter(g => g.arriveTs > now);
    giftOutRef.current = rest;
    setGiftOut(rest); saveJSON("x_giftOut", rest);
    due.forEach(g => {
      // 标记聊天里的礼物卡已送达
      pChat(g.charId, p => p.map(m => m.kind === "gift" && m.giftId === g.id ? { ...m, delivered: true } : m));
      // 永久存进 TA 的随身物品
      setCarryGifts(prev => {
        const list = prev[g.charId] || [];
        const n = { ...prev, [g.charId]: [{ id: g.id, name: g.name, receivedTs: now }, ...list] };
        carryGiftsRef.current = n; saveJSON("x_carryGifts", n);
        return n;
      });
      // 【不自动回复】她要送完接着说自己的话——送达只翻卡片状态；礼物在 ctxFor 的 giftLog 里，
      // 下次她按「回复」TA 自然会提收到了（charReceiveGiftReact 保留成死代码不再自动调）
    });
  };
  useEffect(() => {
    promoteOrders(); promoteGifts();
    const iv = setInterval(() => { promoteOrders(); promoteGifts(); }, 4000);
    return () => clearInterval(iv);
  }, []);

  // 生成商品流（AI 推荐）。append=true 追加「继续看」
  const genShop = async (cat, keyword, append) => {
    if (!active) { toast("请先到设置配置 API"); return; }
    setShopBusy(true);
    try {
      const label = (typeof SHOP_CATS !== "undefined" ? SHOP_CATS.find(c => c.key === cat) : null);
      const topic = keyword && keyword.trim() ? "用户搜索关键词「" + keyword.trim() + "」" : "「" + (label ? label.zh : cat) + "」分类";
      const d = await runProbe(bgActive, { char: { id: "__shop", name: "购物", persona: "" }, chars: characters, rels, profile, timeAware: false }, {
        instruction: "你是一个综合购物 App 的推荐引擎（类似淘宝）。围绕" + topic + "，**务必推荐正好 6 件商品（items 数组必须有 6 个元素，缺一不可）**。每件：name(有画面感的具体商品名) / price(纯数字人民币，符合该品类的合理价位，有高有低) / desc(一句卖点或描述) / sales(销量文案，如「2万+人付款」「8000+人付款」)。要贴合该分类，别跑题。",
        schemaHint: "{\"items\":[{\"name\":\"川味经典红油抄手\",\"price\":38,\"desc\":\"地道成都风味\",\"sales\":\"2万+人付款\"}]}",
        maxTokens: 3500
      });
      const items = ((d && d.items) || []).map((it, i) => ({
        uid: "p_" + Date.now() + "_" + i + "_" + Math.floor(Math.random() * 10000),
        name: it.name || "商品",
        price: Math.max(1, Math.round(Number(it.price)) || (10 + Math.floor(Math.random() * 190))),
        desc: it.desc || "",
        sales: it.sales || "",
        cat
      }));
      setShopFeed(prev => {
        const n = { ...prev, [cat]: append ? [...(prev[cat] || []), ...items] : items };
        saveJSON("x_shopFeed", n);
        return n;
      });
    } catch (e) {
      toast("刷新失败：" + e.message);
    } finally {
      setShopBusy(false);
    }
  };

  const addToCart = product => setCart(p => {
    const n = [...p, { uid: "c_" + Date.now() + "_" + Math.floor(Math.random() * 10000), name: product.name, price: product.price, cat: product.cat, desc: product.desc }];
    saveJSON("x_shopCart", n);
    return n;
  });
  const removeCartUids = uids => setCart(p => {
    const set = new Set(uids);
    const n = p.filter(x => !set.has(x.uid));
    saveJSON("x_shopCart", n);
    return n;
  });

  // 送礼物给角色（结算送礼 / 待收货转赠 共用）：礼物按品类送达用时「在路上」，到点 promoteGifts 里 TA 才 cue 到、并永久存进 TA 随身物品
  const sendGiftToChar = (charId, itemName, cat) => {
    const char = characters.find(c => c.id === charId);
    if (!char) return;
    const giftId = "gf_" + Date.now() + "_" + Math.floor(Math.random() * 10000);
    const arriveTs = Date.now() + deliverMsForCat(cat);
    pChat(charId, p => [...p, { role: "user", kind: "gift", dir: "toChar", giftId, arriveTs, delivered: false, item: { name: itemName }, content: "[礼物] 送给你：" + itemName, ts: Date.now(), read: true }]);
    setGiftOut(p => { const n = [...p, { id: giftId, charId, name: itemName, arriveTs, cat: cat || null }]; giftOutRef.current = n; saveJSON("x_giftOut", n); return n; });
    toast("礼物已下单，送给 " + (char.remark || char.name) + "，在路上");
  };
  // 礼物送达后，TA 才 cue 到收到并做出反应
  const charReceiveGiftReact = async (charId, itemName) => {
    const char = characters.find(c => c.id === charId);
    if (!char || !active) return;
    try {
      const bundle = buildBundle(ctxFor(char));
      const system = bundle + "\n\n【任务】你刚刚收到了用户之前送你的一份礼物「" + itemName + "」（快递/礼物刚送到你手上）。完全代入「" + char.name + "」，用即时通讯口吻主动跟用户说你收到了、并自然回应，短句多气泡，依据人设与好感表达（惊喜/害羞/淡定/调侃都行），别旁白别括号动作。\n【输出】只输出 JSON：{\"word\":[\"气泡1\",\"气泡2\"],\"affinityDelta\":整数(-3到5)}";
      const raw = await callAI(active, system, [{ role: "user", content: "[收到礼物：" + itemName + "]" }]);
      const d = extractJSON(raw) || { word: ["收到你的礼物了，谢谢…"] };
      const words = Array.isArray(d.word) ? d.word.filter(Boolean) : [String(d.word)];
      const turnId = "t_" + Date.now();
      for (let i = 0; i < words.length; i++) {
        if (i > 0) await new Promise(r => setTimeout(r, 400));
        pChat(charId, p => [...p, { role: "assistant", content: words[i], ts: Date.now(), read: false, turnId }]);
      }
      if (typeof d.affinityDelta === "number") bumpAff(charId, d.affinityDelta, (moods[charId] || {}).label);
    } catch (e) {/* silent */}
  };
  // 角色主动买东西送我（replyNow embed）：进我的待发货，走同一套送达逻辑
  const postCharGift = (charId, name) => {
    const char = characters.find(c => c.id === charId);
    if (!char || !name) return;
    pChat(charId, p => [...p, { role: "assistant", kind: "gift", dir: "toMe", item: { name }, content: "[礼物] " + char.name + " 给你寄了：" + name, ts: Date.now(), read: false, turnId: "gf_" + Date.now() }]);
    addOrder({ name, price: 0, fromCharId: charId, cat: null, payLabel: (char.remark || char.name) + " 送的" });
  };

  // 代付：把清单发给角色/群聊，角色按人设+好感+余额决定要不要付
  const requestPayLater = (items, total, target) => {
    const pid = "pl_" + Date.now();
    const card = { kind: "paylater", pid, items: items.map(x => ({ name: x.name, price: x.price })), total, status: "pending" };
    if (target.type === "group") {
      pushGroupRich(target.id, { role: "user", ...card, content: "[代付请求] 合计 ¥" + total });
      setTimeout(() => decideGroupPayLater(target.id, pid, items, total), 1400);
    } else {
      pChat(target.id, p => [...p, { role: "user", ...card, content: "[代付请求] 合计 ¥" + total, ts: Date.now(), read: true }]);
      setTimeout(() => decidePayLater(target.id, pid, items, total), 1400);
    }
    toast("代付请求已发出，等对方决定");
  };
  const finishPayLater = (charId, items, total, char) => {
    adjustCharBalance(charId, -total, "代付 · " + items.map(x => x.name).join("、").slice(0, 18), "shop");
    items.forEach(it => addOrder({ name: it.name, price: it.price, cat: it.cat, fromCharId: charId, payLabel: (char ? char.name : "对方") + " 代付" }));
  };
  const decidePayLater = async (charId, pid, items, total) => {
    const char = characters.find(c => c.id === charId);
    if (!char || !active) return;
    const bal = charBalanceOf(charId);
    try {
      const bundle = buildBundle(ctxFor(char));
      const system = bundle + "\n\n【任务】用户把一份购物清单发给你，请求你「代付」——用你自己的钱帮 Ta 结账。清单：" + items.map(x => x.name + " ¥" + x.price).join("、") + "，合计 ¥" + total + "。你当前余额约 ¥" + Math.round(bal) + "。请完全代入「" + char.name + "」，依据人设、对用户的好感、你们的关系、以及你的经济状况，决定要不要帮 Ta 付。愿意就 agree:true；不愿意/嫌贵/想逗 Ta/囊中羞涩就 agree:false。无论同不同意都用即时通讯口吻回几句(say)，短句多气泡。\n【输出】只输出 JSON：{\"agree\":true或false,\"say\":[\"气泡1\",\"气泡2\"]}";
      const raw = await callAI(active, system, [{ role: "user", content: "[代付请求] " + items.map(x => x.name).join("、") + " 合计 ¥" + total }]);
      const d = extractJSON(raw) || { agree: false, say: ["……让我想想。"] };
      const agree = !!d.agree && bal >= total;
      pChat(charId, p => p.map(m => m.kind === "paylater" && m.pid === pid ? { ...m, status: agree ? "paid" : "declined" } : m));
      if (agree) finishPayLater(charId, items, total, char);
      const words = Array.isArray(d.say) ? d.say.filter(Boolean) : [String(d.say || "")];
      const turnId = "t_" + Date.now();
      for (let i = 0; i < words.length; i++) {
        if (i > 0) await new Promise(r => setTimeout(r, 400));
        pChat(charId, p => [...p, { role: "assistant", content: words[i], ts: Date.now(), turnId }]);
      }
      toast(agree ? char.name + " 帮你付了款" : char.name + " 没有帮你付");
    } catch (e) {
      pChat(charId, p => p.map(m => m.kind === "paylater" && m.pid === pid ? { ...m, status: "declined" } : m));
      toast("代付失败：" + e.message);
    }
  };
  const decideGroupPayLater = async (groupId, pid, items, total) => {
    const group = groups.find(g => g.id === groupId);
    if (!group || !active) return;
    const members = (group.memberIds || []).map(id => characters.find(c => c.id === id)).filter(Boolean);
    if (!members.length) return;
    try {
      const roster = members.map(m => m.name + "(余额约¥" + Math.round(charBalanceOf(m.id)) + ")").join("、");
      const bundle = buildBundle(ctxFor(members[0]));
      const system = bundle + "\n\n【场景】这是一个群聊，成员：" + roster + "。用户在群里发了一份购物清单请人「代付」。清单：" + items.map(x => x.name + " ¥" + x.price).join("、") + "，合计 ¥" + total + "。请推演群里的反应：可能有人愿意帮付、有人起哄、有人拒绝。最终最多一人真正代付（payerName 填那个人的名字；没人付就填 null，要付的人余额需≥合计）。say 是群里你来我往的几句对话，每条注明说话人。\n【输出】只输出 JSON：{\"payerName\":\"名字或null\",\"say\":[{\"name\":\"成员名\",\"text\":\"内容\"}]}";
      const raw = await callAI(active, system, [{ role: "user", content: "[代付请求] " + items.map(x => x.name).join("、") + " 合计 ¥" + total }]);
      const d = extractJSON(raw) || { payerName: null, say: [] };
      const say = Array.isArray(d.say) ? d.say : [];
      for (let i = 0; i < say.length; i++) {
        const spk = members.find(m => m.name === (say[i].name || "").trim()) || members[0];
        if (i > 0) await new Promise(r => setTimeout(r, 500));
        pushGroupRich(groupId, { role: "char", senderId: spk.id, senderName: spk.name, content: String(say[i].text || "").trim() });
      }
      const payer = d.payerName && String(d.payerName).toLowerCase() !== "null" ? members.find(m => m.name === String(d.payerName).trim()) : null;
      const ok = payer && charBalanceOf(payer.id) >= total;
      pGChat(groupId, p => p.map(m => m.kind === "paylater" && m.pid === pid ? { ...m, status: ok ? "paid" : "declined" } : m));
      if (ok) {
        finishPayLater(payer.id, items, total, payer);
        pushGroupRich(groupId, { role: "system", senderName: "系统", content: payer.name + " 帮你付了这单（¥" + total + "）" });
      }
      toast(ok ? payer.name + " 帮你付了款" : "群里没人帮你付");
    } catch (e) {
      pGChat(groupId, p => p.map(m => m.kind === "paylater" && m.pid === pid ? { ...m, status: "declined" } : m));
      toast("代付失败：" + e.message);
    }
  };

  // 用某角色的亲属卡付款（刷 TA 的钱）
  const payWithKinship = (charId, items, total) => {
    const card = kinshipCardsRef.current.find(c => c.charId === charId);
    const char = characters.find(c => c.id === charId);
    if (!card) { toast("没有这张亲属卡"); return; }
    const remaining = (card.limit || 0) - (card.used || 0);
    if (remaining < total) { toast("亲属卡额度不足（剩 ¥" + remaining + "）"); return; }
    // 扣角色余额 + 记卡账单，然后异步生成 TA 对这笔的评论
    adjustCharBalance(charId, -total, "亲属卡消费 · " + items.map(x => x.name).join("、").slice(0, 16), "kinship");
    const entryId = "kl_" + Date.now();
    updateKinshipCard(charId, cd => ({
      ...cd,
      used: Math.round(((cd.used || 0) + total) * 100) / 100,
      ledger: [{ id: entryId, ts: Date.now(), amount: total, item: items.map(x => x.name).join("、"), source: "shop", comment: "" }, ...(cd.ledger || [])]
    }));
    items.forEach(it => addOrder({ name: it.name, price: it.price, cat: it.cat, fromCharId: null, payLabel: "刷了 " + (char ? char.name : "对方") + " 的亲属卡" }));
    toast("已用 " + (char ? char.name : "对方") + " 的亲属卡付款");
    genKinshipComment(charId, entryId, items.map(x => x.name).join("、"), total);
  };

  // 使用（待收货→我的物品）：记谁送的 + 入库日期
  const receiveUse = orderId => {
    const o = ordersRef.current.find(x => x.id === orderId);
    if (!o) return;
    saveOrders(p => p.filter(x => x.id !== orderId));
    setInventory(inv => {
      const n = [{ id: "iv_" + Date.now() + "_" + Math.floor(Math.random() * 10000), name: o.name, fromCharId: o.fromCharId || null, addedTs: Date.now() }, ...inv];
      saveJSON("x_inventory", n);
      return n;
    });
    toast("已入库「" + o.name + "」");
  };
  // 转赠（待收货→送给角色）
  const receiveGift = (orderId, charId) => {
    const o = ordersRef.current.find(x => x.id === orderId);
    if (!o) return;
    saveOrders(p => p.filter(x => x.id !== orderId));
    sendGiftToChar(charId, o.name, o.cat);
  };
  // 结算入口
  const checkout = (uids, mode, target) => {
    const set = new Set(uids);
    const items = cart.filter(x => set.has(x.uid));
    if (!items.length) { toast("请先选择商品"); return; }
    const total = Math.round(items.reduce((s, x) => s + (Number(x.price) || 0), 0) * 100) / 100;
    if (mode === "buy") {
      if (wallet < total) { toast("余额不足"); return; }
      changeWallet(-total, "购物 " + items.map(x => x.name).join("、").slice(0, 18), "shop");
      items.forEach(it => addOrder({ name: it.name, price: it.price, cat: it.cat }));
      removeCartUids(uids);
      toast("下单成功 · " + items.length + " 件，等待发货");
    } else if (mode === "kinship") {
      if (!target || target.type !== "char") { toast("请选择亲属卡"); return; }
      payWithKinship(target.id, items, total);
      removeCartUids(uids);
    } else if (mode === "gift") {
      if (!target || target.type !== "char") { toast("请选择送礼对象"); return; }
      if (wallet < total) { toast("余额不足"); return; }
      changeWallet(-total, "送礼 " + items.map(x => x.name).join("、").slice(0, 18), "shop");
      items.forEach(it => sendGiftToChar(target.id, it.name, it.cat));
      removeCartUids(uids);
    } else if (mode === "paylater") {
      if (!target) { toast("请选择代付对象"); return; }
      requestPayLater(items, total, target);
      removeCartUids(uids);
    }
  };

  // ============================================================
  // 亲属卡 Kinship Card —— 发放(embed 进 replyNow) / 加额度 / 每卡账单 / 角色评论
  // ============================================================
  const saveKinship = updater => setKinshipCards(p => {
    const n = typeof updater === "function" ? updater(p) : updater;
    kinshipCardsRef.current = n;
    saveJSON("x_kinshipCards", n);
    return n;
  });
  const updateKinshipCard = (charId, fn) => saveKinship(p => p.map(c => c.charId === charId ? fn(c) : c));
  const hasKinship = charId => kinshipCardsRef.current.some(c => c.charId === charId);
  // 角色发放亲属卡（replyNow 里 embed，或加额度）
  const issueKinship = (charId, limit, note) => {
    const char = characters.find(c => c.id === charId);
    const lim = Math.max(0, Math.round(Number(limit) || 0));
    if (!char || lim <= 0) return;
    if (hasKinship(charId)) return; // 一角色一张
    const cardId = "kc_" + Date.now();
    saveKinship(p => [...p, { charId, cardId, cardName: (char.name || "") + " 的亲属卡", limit: lim, used: 0, ledger: [], issuedTs: Date.now(), note: note || "" }]);
    pChat(charId, p => [...p, { role: "assistant", kind: "kinship", cardId, charId, limit: lim, note: note || "", content: "[亲属卡] " + char.name + " 给了你一张亲属卡，额度 ¥" + lim, ts: Date.now(), read: false, turnId: "kc_" + Date.now() }]);
    toast(char.name + " 给了你一张亲属卡（额度 ¥" + lim + "）");
  };
  // 我在卡上/聊天里要求加额度 → 角色按人设 + 自己余额决定
  const requestKinshipRaise = async (charId, askAmount) => {
    const char = characters.find(c => c.id === charId);
    const card = kinshipCardsRef.current.find(c => c.charId === charId);
    if (!char || !card || !active) { toast("无法加额度"); return; }
    const ask = Math.max(0, Math.round(Number(askAmount) || 0));
    const bal = charBalanceOf(charId);
    pChat(charId, p => [...p, { role: "user", content: "（在亲属卡上向 " + char.name + " 申请把额度加" + (ask ? " ¥" + ask : "") + "）", ts: Date.now(), read: true }]);
    toast("已向 " + char.name + " 申请加额度");
    try {
      const bundle = buildBundle(ctxFor(char));
      const system = bundle + "\n\n【任务】你之前给了用户一张亲属卡（当前额度 ¥" + card.limit + "，已用 ¥" + (card.used || 0) + "）。现在 Ta 申请给这张卡加额度" + (ask ? "（希望加 ¥" + ask + "）" : "") + "。你余额约 ¥" + Math.round(bal) + "。完全代入「" + char.name + "」，依据人设、好感、你的经济状况决定加多少（可以爽快加、可以少加、可以拒绝加 0、可以借机撒娇/说条件）。addLimit 是你决定新增的额度数字（不加就 0）。say 用即时通讯口吻回几句。\n【输出】只输出 JSON：{\"addLimit\":数字,\"say\":[\"气泡1\"]}";
      const raw = await callAI(active, system, [{ role: "user", content: "[申请加额度]" + (ask ? " 希望加 ¥" + ask : "") }]);
      const d = extractJSON(raw) || { addLimit: 0, say: ["……再说吧。"] };
      const add = Math.max(0, Math.round(Number(d.addLimit) || 0));
      if (add > 0) updateKinshipCard(charId, cd => ({ ...cd, limit: Math.round(((cd.limit || 0) + add) * 100) / 100 }));
      const words = Array.isArray(d.say) ? d.say.filter(Boolean) : [String(d.say || "")];
      const turnId = "t_" + Date.now();
      for (let i = 0; i < words.length; i++) {
        if (i > 0) await new Promise(r => setTimeout(r, 400));
        pChat(charId, p => [...p, { role: "assistant", content: words[i], ts: Date.now(), turnId }]);
      }
      toast(add > 0 ? char.name + " 把额度加了 ¥" + add : char.name + " 没有加额度");
    } catch (e) { toast("加额度失败：" + e.message); }
  };
  // 角色对某笔亲属卡消费的评论（购物刷卡后异步生成）
  const genKinshipComment = async (charId, entryId, itemText, amount) => {
    const char = characters.find(c => c.id === charId);
    if (!char || !active) return;
    try {
      const bundle = buildBundle(ctxFor(char));
      const system = bundle + "\n\n【任务】用户刷了你给 Ta 的亲属卡，买了「" + itemText + "」花了 ¥" + amount + "。完全代入「" + char.name + "」，写一句你看到这笔花销时的真实反应/想法（宠溺、心疼钱、吐槽、无所谓、暗爽都行，贴合人设与好感），一两句，纯文本不要 JSON。";
      const raw = await callAI(active, system, [{ role: "user", content: "[亲属卡消费] " + itemText + " ¥" + amount }]);
      const comment = String(raw || "").replace(/^["'\s]+|["'\s]+$/g, "").slice(0, 120);
      if (comment) updateKinshipCard(charId, cd => ({ ...cd, ledger: (cd.ledger || []).map(l => l.id === entryId ? { ...l, comment } : l) }));
    } catch (e) {/* silent */}
  };

  // ============================================================
  // 随身物品 Carry —— 翻角色随身携带的东西（像查手机，各版块 AI 刷新）+ 收到的礼物永久区
  // ============================================================
  const saveCarrySection = (charId, key, d) => setCarry(p => {
    const cur = p[charId] || {};
    const n = { ...p, [charId]: { ...cur, [key]: d } };
    saveJSON("x_carry", n);
    return n;
  });
  // ---- 表情包字典 ----
  // 先确认落盘成功、再更新页面。旧逻辑反过来：localStorage 写满时页面会假装导入成功，
  // 一刷新整套消失。表情包属于用户资产，绝不能用「看起来成功」掩盖持久化失败。
  const commitEmotePacks = next => {
    if (!saveJSON("x_emotePacks", next)) {
      toast("表情包没有保存成功：本地空间可能已满。先去 设置·数据 归档/导出，再重试");
      return false;
    }
    emotePacksRef.current = next;
    setEmotePacks(next);
    return true;
  };
  const addEmotePack = name => {
    const p = emotePacksRef.current || [];
    commitEmotePacks([...p, { id: "ep_" + Date.now(), name: name || ("新字典 " + (p.length + 1)), global: false, charIds: [], emotes: [] }]);
  };
  const updateEmotePack = (id, patch) => {
    const p = emotePacksRef.current || [];
    commitEmotePacks(p.map(x => x.id === id ? { ...x, ...patch } : x));
  };
  const deleteEmotePack = id => commitEmotePacks((emotePacksRef.current || []).filter(x => x.id !== id));
  const toggleEmotePackChar = (id, charId) => {
    const p = emotePacksRef.current || [];
    commitEmotePacks(p.map(x => {
    if (x.id !== id) return x;
    const has = (x.charIds || []).includes(charId);
    return { ...x, charIds: has ? x.charIds.filter(c => c !== charId) : [...(x.charIds || []), charId] };
    }));
  };
  // 解析批量导入：支持「关键词: url」「关键词 url」同行，也支持关键词一行、url 下一行
  const parseEmoteImport = text => {
    const urlRe = /(https?:\/\/\S+)/;
    const lines = String(text || "").split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const out = []; let pending = null;
    for (const line of lines) {
      const m = line.match(urlRe);
      if (m) {
        let kw = line.slice(0, m.index).replace(/[:：\s]+$/, "").trim();
        if (!kw) kw = pending || "";
        pending = null;
        out.push({ id: "em_" + Date.now() + "_" + Math.floor(Math.random() * 100000), keyword: kw || "表情", url: m[1] });
      } else { pending = line.replace(/[:：]\s*$/, "").trim(); }
    }
    return out;
  };
  const importEmotes = (packId, text) => {
    const items = parseEmoteImport(text);
    if (!items.length) { toast("没解析到「关键词 + 链接」，检查格式"); return 0; }
    const next = (emotePacksRef.current || []).map(x => x.id === packId ? { ...x, emotes: [...(x.emotes || []), ...items] } : x);
    if (!commitEmotePacks(next)) return 0;
    toast("导入了 " + items.length + " 个表情");
    return items.length;
  };
  const deleteEmotes = (packId, ids) => {
    const set = new Set(ids);
    return commitEmotePacks((emotePacksRef.current || []).map(x => x.id === packId ? { ...x, emotes: (x.emotes || []).filter(e => !set.has(e.id)) } : x));
  };
  // 某角色可用的表情（全局包 + 绑定了 TA 的包），供聊天注入与用户选择器
  const emotesForChar = charId => {
    const out = [];
    (emotePacksRef.current || []).forEach(pk => { if (pk.global || (pk.charIds || []).includes(charId)) (pk.emotes || []).forEach(e => out.push(e)); });
    return out;
  };
  // 表情宽松匹配（小克反馈）：去掉【】[]（）「」等括号/表情前后缀/空格再比，大小写无关；精确→归一相等→互相包含。
  // 匹配不到就返回 null（调用方不建任何气泡，绝不落文字气泡）。
  const emoteNorm = s => String(s || "").toLowerCase().replace(/[\s【】\[\]（）()「」『』〔〕<>《》.,。，!！?？~]/g, "");
  const emoteMatch = (list, kw) => {
    if (!kw || !list || !list.length) return null;
    const n = emoteNorm(kw); if (!n) return null;
    return list.find(e => e.keyword === kw)
      || list.find(e => emoteNorm(e.keyword) === n)
      || list.find(e => { const en = emoteNorm(e.keyword); return en && (en.includes(n) || n.includes(en)); })
      || null;
  };
  // 群聊可用表情：所有成员可用表情的并集（按 id 去重）
  const emotesForGroup = memberIds => {
    const map = new Map();
    (memberIds || []).forEach(id => emotesForChar(id).forEach(e => map.set(e.id, e)));
    return [...map.values()];
  };
  // 只含「加入我的表情库」的包（pack.mine !== false）——供我自己发送的选择器用；AI 注入仍用全量
  const emotesForCharMine = charId => {
    const out = [];
    (emotePacksRef.current || []).forEach(pk => { if (pk.mine !== false && (pk.global || (pk.charIds || []).includes(charId))) (pk.emotes || []).forEach(e => out.push(e)); });
    return out;
  };
  const emotesForGroupMine = memberIds => {
    const map = new Map();
    (memberIds || []).forEach(id => emotesForCharMine(id).forEach(e => map.set(e.id, e)));
    return [...map.values()];
  };
  const genCarrySection = async (char, key) => {
    if (!active) { toast("请先到设置配置 API"); return false; }
    setSelCarry(char.id);
    setGen(g => ({ ...g, carrySec: key }));
    try {
      const d = await runProbe(bgActive, ctxFor(char), carryProbeSpec(key, char));
      saveCarrySection(char.id, key, d);
      return true;
    } catch (e) {
      toast(key + " 生成失败：" + e.message);
      return false;
    } finally {
      setGen(g => ({ ...g, carrySec: null }));
    }
  };
  // 收到的礼物：角色对某件礼物的想法/批注（点开时懒生成）
  const genGiftThought = async (charId, giftId, name) => {
    const char = characters.find(c => c.id === charId);
    if (!char) return;
    if (!active) { toast("请先到设置配置 API"); return; }
    setGen(g => ({ ...g, giftThought: giftId }));
    try {
      const bundle = buildBundle(ctxFor(char));
      // 防复读：Ta 给别的礼物写过的想法 → 这件必须换角度（读本地，零 API）
      const prevTh = (carryGiftsRef.current[charId] || []).filter(g => g.id !== giftId && g.thought).slice(-2).map(g => "「" + g.name + "」你写过：「" + String(g.thought).replace(/\s+/g, " ").slice(0, 44) + "」");
      const system = bundle + "\n\n【任务】用户之前送了你一份礼物「" + name + "」，你收下了、一直随身留着。完全代入「" + char.name + "」，写一段你对这份礼物的私人想法/批注：它对你意味着什么、你怎么看送礼的人、平时怎么对待它。1~3 句，真挚贴人设、贴这件东西本身（好感高的更珍视，好感淡的可以随意些），纯文本不要 JSON。" + (prevTh.length ? "\n【你对别的礼物写过】" + prevTh.join("；") + "——这件的想法必须是新的角度和写法，别和之前的句式、开头、梗重样。" : "");
      const raw = await callAI(active, system, [{ role: "user", content: "[礼物：" + name + "]" }], { maxTokens: 900 });
      const thought = String(raw || "").replace(/^["'\s]+|["'\s]+$/g, "");
      if (thought) setCarryGifts(prev => {
        const list = (prev[charId] || []).map(g => g.id === giftId ? { ...g, thought } : g);
        const n = { ...prev, [charId]: list };
        carryGiftsRef.current = n; saveJSON("x_carryGifts", n);
        return n;
      });
    } catch (e) { toast("生成失败：" + e.message); }
    finally { setGen(g => ({ ...g, giftThought: null })); }
  };
  const genCarryAll = async char => {
    if (!active) { toast("请先到设置配置 API"); return; }
    setSelCarry(char.id);
    setGen(g => ({ ...g, carrySec: "__all__" }));
    const keys = CARRY_SECTIONS.filter(s => !s.gifts).map(s => s.key);
    for (const key of keys) {
      try {
        const d = await runProbe(bgActive, ctxFor(char), carryProbeSpec(key, char));
        saveCarrySection(char.id, key, d);
      } catch (e) {/* skip */}
    }
    setGen(g => ({ ...g, carrySec: null }));
  };

  const saveRel = (key, label, note) => setRels(p => {
    const n = {
      ...p
    };
    if (!label.trim()) delete n[key];else n[key] = {
      label: label.trim(),
      note: (note || "").trim()
    };
    saveJSON("x_rels", n);
    return n;
  });
  const relSummaryFor = char => {
    const l = directedRelationLines(char, rels, characters, profile);
    return l && l !== "（暂无已设定的关系）" ? l : "";
  };

  // ---- geo ----
  const doRequestGeo = async () => {
    toast("正在定位…");
    const g = await requestGeo();
    setGeo(g);
    saveJSON("x_geo", g);
    if (g.error) toast("定位失败：" + g.error);else toast("已定位：" + g.label);
  };

  // ---- export / import ----（整包：localStorage 的 x_ 数据 + IndexedDB 图片仓库 x_imgvault）
  const doExport = async () => {
    const dump = {};
    Object.keys(localStorage).filter(k => k.startsWith("x_")).forEach(k => {
      dump[k] = localStorage.getItem(k);
    });
    // 已迁进 IDB 文字库的键(同人文)不在 localStorage，从内存镜像补进备份，否则导出会漏、换设备就丢。
    try { if (window.__txtMirror) window.__txtMirror.forEach((v, k) => { if (v != null) dump[k] = v; }); } catch (e) {}
    // ⭐阶段4：图片仓库也打进备份——头像/壁纸迁进 IndexedDB 后，localStorage 只剩 iv_ 引用键，
    // 图本身在 vault 里、不随普通备份走；这里把 vault 里每张图 base64 化装进 JSON，换设备导入后图才不丢。
    let vault = {}, vaultCount = 0;
    try {
      if (typeof idbVaultEntries === "function" && typeof blobToDataUrl === "function") {
        const entries = await idbVaultEntries();
        for (const [k, b] of entries) { try { vault[k] = await blobToDataUrl(b); vaultCount++; } catch (e) {} }
      }
    } catch (e) {}
    // ⭐备份 v3：自拍永远打包。以前现场问「要不要带自拍」，一次误点/漏点就会得到
    // 只有图片门牌、没有像素的假完整备份；数据安全优先，备份可以大但不能悄悄缺图。
    let selfies = {}, selfieCount = 0;
    try {
      if (typeof idbImgEntries === "function" && typeof blobToDataUrl === "function") {
        const sEntries = await idbImgEntries();
        for (const [k, b] of sEntries) { try { selfies[k] = await blobToDataUrl(b); selfieCount++; } catch (e) {} }
      }
    } catch (e) {}
    const blob = new Blob([JSON.stringify({
      __archive: 1,
      version: 3,
      exportedAt: Date.now(),
      data: dump,
      vault: vault,
      selfies: selfies
    }, null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "archive-backup-" + new Date().toISOString().slice(0, 10) + ".json";
    a.click();
    URL.revokeObjectURL(url);
    toast("已导出备份（含 " + vaultCount + " 张图片" + (selfieCount ? "、" + selfieCount + " 张自拍" : "") + "）");
  };
  const doImport = file => {
    const r = new FileReader();
    r.onload = async e => {
      let parsed;
      try {
        parsed = JSON.parse(e.target.result);
      } catch (err) {
        toast("导入失败：文件损坏或不是备份文件");
        return;
      }
      if (!parsed.__archive || !parsed.data) {
        toast("文件格式不对");
        return;
      }
      // 从按下导入起就暂停本页正在跑的灾后补账；否则它可能在清仓与重载之间
      // 把刚被权威备份删掉的旧消息又写回来。
      window.__authoritativeImportBusy = true;
      try {
        localStorage.removeItem("chat_ledger_restore_pending_v1");
        localStorage.setItem("chat_ledger_authority_floor_v1", new Date().toISOString());
      } catch (_) {}
      // 显式导入就是整机替换：备份来自哪一边，哪一边就是这次的权威真相。
      // 不合并当前容器的独有聊天；书签里多出来的消息必须被壳备份覆盖掉。
      const importData = parsed.data;
      try { if (typeof idbTxtClear === "function") await idbTxtClear(); } catch (e) {}
      // 先清本地 x_ 键
      Object.keys(localStorage).filter(k => k.startsWith("x_")).forEach(k => localStorage.removeItem(k));
      // 逐键写入：单键失败（多半是超了浏览器单站点 ~5MB 上限）不整体中断，记下漏掉的，尽量恢复其余
      const failed = [];
      for (const [k, v] of Object.entries(importData)) {
        // 文字库键(同人文)：写进 IDB + 镜像，不进 localStorage(否则又占回 5MB、还可能超限)
        if (typeof isIdbTextKey === "function" && isIdbTextKey(k)) {
          try {
            if (typeof idbTxtPut === "function") { await idbTxtPut(k, v); const back = await idbTxtGet(k); if (back !== v) throw new Error("文字仓恢复核对失败: " + k); }
            window.__txtMirror && window.__txtMirror.set(k, v);
            // 清仓已删旧 WAL；合并结果落稳后再确认没有残留 journal，
            // 防止重载时旧快照覆盖刚合好的聊天。
            if (typeof walDel === "function" && typeof isDurableTextKey === "function" && isDurableTextKey(k)) { try { await walDel(k); } catch (e2) {} }
          } catch (e) { failed.push({ k, size: (v || "").length }); }
          continue;
        }
        try { localStorage.setItem(k, v); }
        catch (err) { failed.push({ k, size: (v || "").length }); }
      }
      // ⭐阶段4：恢复图片仓库（v2+ 备份含 vault）——把 base64 写回 IndexedDB，头像/壁纸的 iv_ 键才能 resolve。
      // v48.29：先整仓清空再写入（backlog：旧机器攒的孤儿 blob 不再一代代带着走，防止图库越导越肥）。
      // 只在备份自带 vault 时才清——v1 老备份图是 base64 直存 data 里，本地图库与它无关，不动。
      if (parsed.vault && typeof idbVaultPut === "function" && typeof dataUrlToBlob === "function") {
        try { if (typeof idbVaultClear === "function") await idbVaultClear(); } catch (e2) {}
        for (const [k, durl] of Object.entries(parsed.vault)) {
          try { const b = dataUrlToBlob(durl); if (b) await idbVaultPut(k, b); } catch (e2) {}
        }
      }
      // ⭐备份 v3：恢复自拍（打包过才有）——不清旧自拍，只增量写回（自拍键是内容相关的，覆盖无害）
      if (parsed.selfies && typeof idbImgPut === "function" && typeof dataUrlToBlob === "function") {
        for (const [k, durl] of Object.entries(parsed.selfies)) {
          try { const b = dataUrlToBlob(durl); if (b) await idbImgPut(k, b); } catch (e2) {}
        }
      }
      if (failed.length) {
        // 按占用从大到小，方便一眼看出是谁把空间撑爆（多半是含大量图片的键）
        failed.sort((a, b) => b.size - a.size);
        const KB = n => Math.round(n / 1024);
        const list = failed.slice(0, 6).map(f => "· " + f.k + "（约 " + KB(f.size) + "KB）").join("\n");
        window.alert(
          "已尽量恢复，但有 " + failed.length + " 项没装下——这台设备/这个网址的浏览器本地存储约 5MB 上限，这份备份超了。\n\n" +
          "没恢复的（占用最大的几项）：\n" + list +
          (failed.length > 6 ? "\n…等共 " + failed.length + " 项" : "") +
          "\n\n这些多半是还没迁进图库的图（聊天图/朋友圈图/表情包）。头像和壁纸已迁进 IndexedDB 图库、随备份的图片仓库单独恢复、不占这 5MB。要全恢复，可在这台设备清掉这类图或分批导入。\n（注意：一起读的书正文、语音音频存在 IndexedDB，本就不进备份文件，换设备要重传。）"
        );
        setTimeout(() => location.reload(), 400);
      } else {
        // 清掉旧的灾后找回工单，并钉住这次权威导入的时间地板。
        // 以后云账本仍可找回导入之后的新消息，但绝不复活导入之前被覆盖掉的书签旧消息。
        toast("导入成功：已用这份备份完整覆盖本机，正在重载…");
        setTimeout(() => location.reload(), 800);
      }
    };
    r.readAsText(file);
  };

  // ---- routing ----
  let body = null;
  if (!loaded) body = /*#__PURE__*/React.createElement(Empty, {
    text: "加载中…"
  });else if (screen === "home") body = /*#__PURE__*/React.createElement(Home, {
    now: now,
    characters: liveChars,
    profile: profile,
    wallpaper: wallpaper,
    unread: unreadTotal,
    calendar: calendar,
    period: period,
    listen: listen,
    player: player,
    homeCard: homeCard,
    notif: appNotif,
    memoDue: (typeof window !== "undefined" && window.memoDueToday) ? window.memoDueToday() : 0,
    mapStatus: mapStatusAll(),
    userGeo: prefs.geoAware && geo && typeof geo.lat === "number" ? geo : null,
    couples: couples,
    coupleSweet: coupleSweet,
    onOpenApp: k => k === "listen" ? goListen() : setScreen(k),
    onOpenChar: c => {
      setActiveChar(c);
      setScreen("cast");
      setEditingChar(null);
    },
    onEditProfile: () => setProfileOpen(true),
    onEditCard: () => setCardOpen(true),
    onSoon: zh => toast("「" + zh + "」还在施工中 · 敬请期待 🚧"),
    // 命运转盘·角色起哄：转完随机一位在聊的角色来一句（走便宜后台池，一句话；没配 API/没角色就静默）
    onWheelReact: async (title, items, result) => {
      if (!active) return null;
      const pool = liveChars.filter(c => (chatsRef.current[c.id] || []).filter(m => !m.recalled).length >= 2);
      const c = pool.length ? pool[Math.floor(Math.random() * pool.length)] : characters[0];
      if (!c) return null;
      const d = await runProbe(bgActive, ctxFor(c), {
        instruction: "用户选择困难，把决定交给了手机主屏上的「命运转盘」" + (title ? "（转盘主题：" + title + "）" : "") + "。转盘上的选项：" + items.join("、") + "。刚刚指针停在了【" + result + "】。以「" + c.name + "」的口吻对这个结果说一两句话——起哄、拍板、吐槽 Ta 的选择困难、或者对结果本身发表意见都行，按你的人设和此刻心情来，像随口说的，加起来别超过 40 字。",
        schemaHint: "{\"say\":\"一两句话\"}",
        maxTokens: 6000   // cheap_required 线路已显式配置时仍保留完整思考预算
      });
      return d && d.say ? { name: c.remark || c.name, text: String(d.say).trim().slice(0, 120), char: c } : null;
    }
  });else if (screen === "map") body = (window.MapKit ? h(window.MapKit.CharMap, {
    characters: liveChars,
    status: mapStatusAll(),
    profile: profile,
    userGeo: prefs.geoAware && geo && typeof geo.lat === "number" ? geo : null,
    mode: mapMode,
    onSetMode: m => { setMapMode(m); saveJSON("x_mapMode", m); },
    onSetHome: (charId, home) => pC(p => p.map(c => c.id === charId ? { ...c, home: home || undefined } : c)),
    onBack: goHome
  }) : h(Empty, { text: "地图组件没加载出来", sub: "需要联网加载地图库，检查网络后重开" }));else if (screen === "cast") body = /*#__PURE__*/React.createElement(Cast, {
    characters: liveChars,
    onBack: goHome,
    onEdit: c => {
      setEditingChar(c);
      setScreen("castForm");
    },
    onAdd: () => {
      setEditingChar(null);
      setScreen("castForm");
    },
    onImportCard: () => setCardImportOpen(true),
    onOpenChar: c => {
      setEditingChar(c);
      setScreen("castForm");
    }
  });else if (screen === "castForm") body = /*#__PURE__*/React.createElement(CastForm, {
    initial: editingChar,
    onBack: () => setScreen("cast"),
    onSave: saveChar,
    onDelete: delChar,
    // 生成头像（她 2026-08-25：「为啥别的小手机能生成真的像头像的图，我们只有 emoji」）。
    // 图像 API 早就在跑自拍/合照/剧照，只是从来没接过头像这个字段。有参考照就拿它锁脸
    //（走 images/edits），没有就按【外貌】那栏画。方图 1024，存进图库只留一个 iv_ 键。
    onGenAvatar: async draft => {
      if (typeof imgApiReady !== "function" || !imgApiReady(loadImgApi())) { toast("先去 设置 · 图像 API 配一条线路"); return null; }
      try {
        const c = { name: draft.name, appearance: draft.appearance, photoOutfit: draft.photoOutfit, photoStyle: draft.photoStyle };
        const prompt = buildAvatarPrompt(c, { hasRef: !!draft.refPhoto });
        const r = await generateSelfieImage(prompt, draft.refPhoto ? [draft.refPhoto] : null, { size: "1024x1024" });
        const dataUrl = r && (r.dataUrl || r.url);
        if (!dataUrl) throw new Error("上游没有返回图片");
        const key = typeof imgToVault === "function" ? await imgToVault(dataUrl) : dataUrl;
        toast("头像生成好了，记得点右上角保存");
        return key;
      } catch (e) { toast("生成失败：" + ((e && e.message) || e)); return null; }
    }
  });else if (screen === "messages") body = /*#__PURE__*/React.createElement(Messages, {
    characters: liveChars,
    allChars: characters,   // 聊天列表的群头像要按成员 id 找人，NPC 也在里头
    groups: groups,
    chats: chats,
    groupChats: groupChats,
    moments: moments,
    profile: profile,
    unreadMap: unreadMap,
    offlineLastTs: (() => { const m = { ...offlineTsRef.current }; const scan = store => { Object.keys(store || {}).forEach(id => { let t = 0; (store[id] || []).forEach(s => { const ms = s.msgs || []; const lt = ms.length ? (ms[ms.length - 1].ts || 0) : 0; if (lt > t) t = lt; }); m[id] = t; }); }; scan(offlines); scan(groupOfflines); return m; })(), // 线下最后一条时间(每场取末条)，供聊天列表排序（线下冒泡也顶上来）。base=开机种子(兜懒加载没灌的)，state 扫描覆盖已打开的（含删空→0）
    tab: msgTab,
    onTab: setMsgTab,
    onBack: goHome,
    onOpenThread: c => {
      setActiveChar(c);
      clearUnread(c.id);
      setScreen("thread");
    },
    onOpenGroup: g => {
      setActiveGroup(g);
      clearUnread(g.id);
      setScreen("gthread");
    },
    pinned: pinnedChats,
    onTogglePin: togglePinChat,
    onNewGroup: () => setNewGroupOpen(true),
    onOpenContact: c => {
      setActiveChar(c);
      setScreen("contact");
    },
    onGenMoment: genMoment,
    genMoment: gen.moment,
    onLikeMoment: likeMoment,
    onCommentMoment: commentMoment,
    onDelMoment: delMoment,
    onOpenMomProfile: openMomProfile,
    onEditProfile: () => setProfileOpen(true),
    onOpenWallet: () => setScreen("wallet"),
    onOpenFavorites: () => setScreen("favorites"),
    walletBalance: wallet,
    friendGroups: friendGroups,
    onSaveGroups: saveFriendGroups,
    onPostMoment: postUserMoment
  });else if (screen === "momprofile") body = h(MomentsProfile, {
    isMe: !!(momTarget && momTarget.isMe),
    character: momTarget && !momTarget.isMe ? characters.find(c => c.id === momTarget.id) : null,
    profile: profile,
    characters: liveChars,
    moments: moments,
    cover: (momTarget && momTarget.isMe) ? momentsCover.me : (momTarget ? momentsCover[momTarget.id] : ""),
    signature: (momTarget && momTarget.isMe) ? (profile.tagline || "") : (momTarget ? ((anon[momTarget.id] && anon[momTarget.id].bio) || "") : ""),
    gen: gen.moment,
    friendGroups: friendGroups,
    onSetCover: uri => setMomentCover(momTarget && momTarget.isMe ? "me" : (momTarget && momTarget.id), uri),
    onDelMoment: delMoment,
    onLikeMoment: likeMoment,
    onCommentMoment: commentMoment,
    onPostMoment: postUserMoment,
    onBack: () => { setMomTarget(null); setScreen("messages"); }
  });else if (screen === "wallet") body = h(MyWallet, {
    balance: wallet,
    log: walletLog,
    cards: kinshipCards,
    characters: liveChars,
    onBack: () => setScreen("messages"),
    onSetBalance: setWalletTo,
    onOpenCard: charId => { setActiveCardId(charId); setScreen("kincard"); }
  });else if (screen === "kincard") body = h(KinshipBill, {
    card: kinshipCards.find(c => c.charId === activeCardId),
    character: characters.find(c => c.id === activeCardId),
    onBack: () => setScreen("wallet"),
    onRaise: ask => requestKinshipRaise(activeCardId, ask)
  });else if (screen === "thread" && activeChar) body = /*#__PURE__*/React.createElement(ChatThread, {
    character: activeChar,
    characters: liveChars,
    groups: groups,
    messages: chats[window.ChatRooms ? window.ChatRooms.chatKey(activeChar.id, activeRoomId) : activeChar.id] || [],
    sending: sending,
    onBack: () => setScreen("messages"),
    onSend: txt => pushUser(activeChar.id, txt, window.ChatRooms ? window.ChatRooms.chatKey(activeChar.id, activeRoomId) : activeChar.id),
    onReply: extraText => {
      const b = blocks[activeChar.id] || {};
      if (b.iBlocked) return blockedReaction(activeChar.id);
      if (b.theyBlocked) { toast("TA 拉黑了你，点消息旁的 ! 申请解除"); return; }
      const room = window.ChatRooms ? window.ChatRooms.get(activeChar.id, activeRoomId) : null;
      const chatKey = window.ChatRooms ? window.ChatRooms.chatKey(activeChar.id, activeRoomId) : activeChar.id;
      return replyNow(activeChar.id, extraText, null, { room, chatKey });
    },
    block: blocks[activeChar.id] || null,
    onSendUnblockReq: plea => sendMyUnblockReq(activeChar.id, plea),
    onRespondUnblock: (cid, accept) => respondUnblockFromChar(activeChar.id, cid, accept),
    profile: profile,
    disp: { myAvatar: !!settingsFor(activeChar.id).showMyAvatar, time: !!settingsFor(activeChar.id).showTime, timeSec: !!settingsFor(activeChar.id).timeSec, read: settingsFor(activeChar.id).showRead !== false, chatBg: settingsFor(activeChar.id).chatBg || "" },
    onOpenState: () => { setStateCardChar(null); setStateCardGroup(false); setStateCardOpen(true); },
    schedNow: schedNowBriefFor(activeChar),
    onOpenSched: () => { setSelSched(activeChar.id); setScreen("calendar"); },
    onLongPress: (act, idx) => handleMsgAction(act, idx, window.ChatRooms ? window.ChatRooms.chatKey(activeChar.id, activeRoomId) : activeChar.id),
    onOpenSettings: () => setChatSettingsOpen(true),
    room: window.ChatRooms ? window.ChatRooms.get(activeChar.id, activeRoomId) : { id: "main", name: "主聊天", main: true },
    onOpenRooms: () => setChatSettingsOpen(true),
    toast: toast,
    onSendRich: msg => pChat(window.ChatRooms ? window.ChatRooms.chatKey(activeChar.id, activeRoomId) : activeChar.id, p => [...p, msg]),
    onPat: () => patChar(activeChar.id, window.ChatRooms ? window.ChatRooms.chatKey(activeChar.id, activeRoomId) : activeChar.id),
    onStartCall: m => startCall([activeChar], m, null, "me"),
    onAcceptCall: m => { pChat(activeChar.id, p => p.map(x => (x.kind === "callinvite" && x.ts === m.ts) ? { ...x, answered: "accepted" } : x)); startCall([activeChar], m.mode, null, activeChar.id); },
    onDeclineCall: m => { pChat(activeChar.id, p => [...p.map(x => (x.kind === "callinvite" && x.ts === m.ts) ? { ...x, answered: "declined" } : x), { role: "system", kind: "system", content: "你拒绝了 TA 的" + (m.mode === "video" ? "视频" : "语音") + "通话邀请", ts: Date.now() }]); },
    onAcceptListen: acceptListenInvite,
    onOpenStudyInvite: m => {
      setStudyEntry({ key: "study_" + Date.now(), mode: m.mode === "resume" ? "resume" : "propose", sessionId: m.sessionId || null, subject: m.subject || m.sessionTitle || "", characterId: activeChar.id });
      setScreen("study");
    },
    emotes: emotesForCharMine(activeChar.id),
    onManageEmotes: () => setScreen("emotes"),
    archCount: activeRoomId === "main" ? (chatArch[activeChar.id] || 0) : 0,
    onLoadOlder: activeRoomId === "main" ? loadChatArchive : null,
    myBalance: wallet,
    onSendTransfer: (amount, note) => sendTransfer(activeChar.id, amount, note),
    onRespondTransfer: (tid, accept) => respondTransfer(activeChar.id, tid, accept),
    makeCoords: makeCoords,
    onOpenAnon: () => openAnon(activeChar),
    onOpenMoments: () => openMomProfile(activeChar.id, false),
    onOffline: () => openOffline(activeChar),
    onOOC: text => oocReply(activeChar.id, text),
    onDeleteMessages: indices => {
      const set = new Set(indices);
      const threadKey = window.ChatRooms ? window.ChatRooms.chatKey(activeChar.id, activeRoomId) : activeChar.id;
      const picked = (chatsRef.current[threadKey] || []).filter((_, i) => set.has(i));
      const imported = picked.filter(m => m && m.ledgerImported && m.ledgerKey);
      // 跨端原话只能软删：本地先变成撤回占位，云端再盖 tombstone；普通本地消息保持原来的本机删除行为。
      pChat(threadKey, p => p.map((m, i) => set.has(i) && m && m.ledgerImported ? { ...m, recalled: true } : m).filter((m, i) => !set.has(i) || (m && m.ledgerImported)));
      if (imported.length && window.Cloud) window.Cloud.chatMessagesSoftDelete(imported.map(m => m.ledgerKey)).catch(e => {
        const failed = new Set(imported.map(m => m.ledgerKey));
        pChat(threadKey, p => p.map(m => m && failed.has(m.ledgerKey) ? { ...m, recalled: false } : m));
        toast("跨端消息云端没删成，已恢复，请联网后重试：" + String((e && e.message) || e));
      });
      toast("已删除 " + indices.length + " 条");
    },
    onForward: (msgs, destination) => {
      const items = msgs.map(m => ({
        name: m.role === "user" ? profile.name || "我" : activeChar.name,
        text: m.content || "",
        ts: m.ts || null            // 微信的转发记录每条都带时刻，展开时显示
      }));
      const content = "【转发的聊天记录】\n" + items.map(it => it.name + "：" + it.text).join("\n");
      const msg = {
        role: "user",
        kind: "chatforward",
        content,
        forward: {
          sourceType: "chat",
          sourceId: activeChar.id,
          from: activeChar.name,
          items
        },
        ts: Date.now(),
        read: false
      };
      if (destination && destination.type === "group") {
        const g = groups.find(x => x.id === destination.id);
        if (!g) return;
        pGChat(g.id, p => [...p, { ...msg, senderName: profile.name || "我" }]);
        toast("已转发到 " + g.name);
      } else {
        const toChar = characters.find(c => c.id === (destination && destination.id));
        if (!toChar) return;
        pChat(toChar.id, p => [...p, msg]);
        toast("已转发给 " + (toChar.remark || toChar.name));
      }
    }
  });else if (screen === "gthread" && activeGroup) body = h(GroupThread, {
    group: groups.find(g => g.id === activeGroup.id) || activeGroup,
    groups: groups,
    characters: liveChars,
    allChars: characters,   // 群成员/群设置要按 id 找人；加人选单另有规矩（NPC 只能进主人的群）
    rels: rels,             // 加人选单要按「已有关系」分组（她 2026-08-25）
    messages: groupChats[activeGroup.id] || [],
    sending: sending,
    profile: profile,
    meName: profile.name || "我",
    myBalance: wallet,
    settings: gsFor(activeGroup.id),
    directives: directives[activeGroup.id] || [],
    onRemoveDirective: dirId => removeDirective(activeGroup.id, dirId),
    onSetDirectiveTurns: (dirId, turns) => setDirectiveTurns(activeGroup.id, dirId, turns),
    onBack: () => setScreen("messages"),
    onSend: txt => pushGroupUser(activeGroup.id, txt),
    onReply: () => replyGroup(activeGroup.id),
    onContinue: () => replyGroup(activeGroup.id),
    onOOC: txt => oocGroup(activeGroup.id, txt),
    onMsgAction: (act, idx) => handleGroupMsgAction(activeGroup.id, act, idx),
    onDeleteMessages: indices => deleteGroupMsgs(activeGroup.id, indices),
    onForward: (msgs, destination) => {
      const sourceGroup = groups.find(g => g.id === activeGroup.id) || activeGroup;
      const items = msgs.map(m => ({
        name: m.role === "user" ? (profile.name || "我") : (m.senderName || "群成员"),
        text: m.content || (m.kind === "poll" ? "[投票] " + (m.title || "") : m.kind === "redpacket" ? "[红包] " + (m.message || "") : ""),
        ts: m.ts || null
      }));
      const content = "【转发的群聊记录 · " + sourceGroup.name + "】\n" + items.map(it => it.name + "：" + it.text).join("\n");
      const msg = { role: "user", kind: "chatforward", content, forward: { sourceType: "group", sourceId: sourceGroup.id, from: sourceGroup.name, items }, ts: Date.now(), read: false };
      if (destination && destination.type === "group") {
        const g = groups.find(x => x.id === destination.id);
        if (!g) return;
        pGChat(g.id, p => [...p, { ...msg, senderName: profile.name || "我" }]);
        toast("已转发到 " + g.name);
      } else {
        const toChar = characters.find(c => c.id === (destination && destination.id));
        if (!toChar) return;
        pChat(toChar.id, p => [...p, msg]);
        toast("已转发给 " + (toChar.remark || toChar.name));
      }
    },
    onSaveSettings: patch => saveGroupSettings(activeGroup.id, patch),
    onOpenMemberState: memberId => { const c = characters.find(x => x.id === memberId); if (c) { setStateCardChar(c); setStateCardGroup(true); setStateCardOpen(true); } },
    onStartPoll: (title, options, anon) => startPoll(activeGroup.id, title, options, anon),
    onGenVotes: idx => genPollVotes(activeGroup.id, idx),
    onVote: (idx, optIdx) => castVote(activeGroup.id, idx, optIdx, profile.name || "我"),
    onSendRedPacket: (total, count, message) => sendRedPacket(activeGroup.id, total, count, message),
    onClaim: idx => claimRedPacket(activeGroup.id, idx),
    onSummarize: () => summarizeGroupToMem(activeGroup.id),
    onAddMember: charId => addGroupMember(activeGroup.id, charId),
    onKickMember: charId => kickGroupMember(activeGroup.id, charId),
    onDeleteGroup: () => deleteGroup(activeGroup.id),
    onClearGroupChat: wipeMem => clearGroupChat(activeGroup.id, wipeMem),
    onOffline: () => openGroupOffline(activeGroup),
    emotes: emotesForGroupMine(activeGroup.memberIds),
    onManageEmotes: () => setScreen("emotes"),
    archCount: chatArch["g_" + activeGroup.id] || 0,
    onLoadOlder: loadChatArchive,
    onSendRich: msg => pushGroupRich(activeGroup.id, { read: false, ...msg }),
    onStartCall: (mode, memberIds) => {
      const ids = Array.isArray(memberIds) ? memberIds : [memberIds];
      const people = ids.map(id => characters.find(c => c.id === id)).filter(Boolean);
      startCall(people, mode, activeGroup.id, "me");
    },
    onAcceptCall: m => { pGChat(activeGroup.id, p => p.map(x => (x.kind === "callinvite" && x.ts === m.ts) ? { ...x, answered: "accepted" } : x)); const inv = characters.find(c => c.id === m.senderId); startCall(inv ? [inv] : groupMembers(activeGroup), m.mode, activeGroup.id, m.senderId || "me"); },
    onDeclineCall: m => { pGChat(activeGroup.id, p => [...p.map(x => (x.kind === "callinvite" && x.ts === m.ts) ? { ...x, answered: "declined" } : x), { role: "system", kind: "system", content: "你拒绝了" + (m.senderName || "TA") + "的通话邀请", ts: Date.now() }]); },
    onSendTransfer: (memberId, amount, note) => sendGroupTransfer(activeGroup.id, memberId, amount, note),
    onRespondTransfer: (tid, accept) => respondGroupTransfer(activeGroup.id, tid, accept),
    makeCoords: makeCoords,
    toast: toast
  });else if (screen === "contact" && activeChar) body = /*#__PURE__*/React.createElement(ContactDetail, {
    character: activeChar,
    affinity: Math.round(affOf(activeChar.id)),
    onBack: () => setScreen("messages"),
    onChat: () => {
      clearUnread(activeChar.id);
      setScreen("thread");
    },
    onSaveRemark: saveRemark,
    onOpenState: () => { setStateCardChar(null); setStateCardGroup(false); setStateCardOpen(true); },
    directives: directives[activeChar.id] || [],
    onRemoveDirective: dirId => removeDirective(activeChar.id, dirId),
    desireCount: ((desires[activeChar.id] || {}).list || []).length,
    onOpenDesires: () => setDesireBoxOpen(true)
  });else if (screen === "ties") body = /*#__PURE__*/React.createElement(Ties, {
    characters: liveChars,
    rels: rels,
    profile: profile,
    onBack: goHome,
    onSave: saveRel,
    // NPC 入口挪到这儿（她 2026-08-25：塞在资料卡里找不到）。
    // NPC 本来就是「某个角色身边的一段关系」，跟「我和角色」「角色之间」并排才对。
    allChars: characters,   // 关系伙伴要按 id 解析；配角也算数，否则他那段关系整条消失
    npcsOf: npcsOf,
    onSaveNpcBrief: (id, text) => { pC(p => p.map(c => c.id === id ? { ...c, persona: String(text || "") } : c)); toast("已保存"); },
    npcBusy: !!Object.keys(busyLanesRef.current || {}).some(k => k.indexOf("npc:") === 0),
    onCreateNpc: (hostId, ask) => createNpc(hostId, ask),
    onDeleteNpc: id => {
      pC(p => p.filter(c => c.id !== id));
      setGroups(prev => { const n = prev.map(g => ({ ...g, memberIds: (g.memberIds || []).filter(x => x !== id) })); saveJSON("x_groups", n); return n; });
      toast("已删除");
    }
  });else if (screen === "lifestyle") body = h(Lifestyle, {
    characters: liveChars,
    schedules: schedules,
    selId: selSched,
    busyKey: gen.sched,
    onBack: goHome,
    onSel: setSelSched,
    onGenDay: genScheduleDay
  });else if (screen === "phone") body = /*#__PURE__*/React.createElement(PhoneCarry, {
    characters: liveChars,
    phones: phones,
    selId: selPhone,
    busyKey: gen.phoneApp,
    onBack: goHome,
    onSel: setSelPhone,
    onGenApp: genPhoneApp,
    onGenAll: genPhoneAll,
    profile: profile
  });else if (screen === "carry") body = h(Carry, {
    characters: liveChars,
    carry: carry,
    carryGifts: carryGifts,
    selId: selCarry,
    busyKey: gen.carrySec,
    giftBusy: gen.giftThought,
    onBack: goHome,
    onSel: setSelCarry,
    onGen: genCarrySection,
    onGenAll: genCarryAll,
    onGenGiftThought: genGiftThought
  });else if (screen === "cwallet") body = h(CharWallet, {
    characters: liveChars,
    charWallet: charWallet,
    selId: selCWallet,
    busyKey: gen.cwallet,
    hasApi: !!active,
    onBack: goHome,
    onSel: setSelCWallet,
    onInit: initCharWallet,
    onCatchUp: catchUpWallet,
    onSetBalance: setCharWalletTo,
    onRefresh: refreshCharAssets
  });else if (screen === "emotes") body = h(EmoteMatrix, {
    packs: emotePacks,
    characters: liveChars,
    onBack: () => setScreen(activeChar ? "thread" : activeGroup ? "gthread" : "home"),
    onAddPack: addEmotePack,
    onUpdatePack: updateEmotePack,
    onDeletePack: deleteEmotePack,
    onToggleChar: toggleEmotePackChar,
    onImport: importEmotes,
    onDeleteEmotes: deleteEmotes
  });else if (screen === "favorites") body = h(Favorites, {
    favorites: favorites,
    characters: liveChars,
    onBack: () => setScreen("messages"),
    onDelete: delFavorite
  });else if (screen === "forum") body = /*#__PURE__*/React.createElement(Forum, {
    characters: liveChars,
    profile: profile,
    posts: forumPosts,
    comments: forumComments,
    follows: forumFollows,
    pms: forumPMs,
    groups: groups,
    gen: gen,
    forumMe: forumMe,
    charMetaOf: charForumMeta,
    forumOff: forumOff,
    onToggleForumChar: toggleForumChar,
    onBack: goHome,
    onGenBoard: genForumBoard,
    onGenSearch: genForumSearch,
    onLoadComments: loadForumComments,
    onMoreComments: genMoreComments,
    onReplyFloor: addForumFloor,
    onReplySub: addForumSubReply,
    onPostMine: postMyForum,
    onGenCharPost: genCharForumPost,
    onToggleFollow: toggleForumFollow,
    onForwardToChat: forwardPostToChat,
    onForwardToGroup: forwardPostToGroup,
    onRefreshPMs: refreshForumPMs,
    onSendPM: sendForumPM,
    onMarkPMRead: markPMRead,
    onEditMe: editForumMe,
    onEnsureCharMeta: ensureCharForumMeta
  });else if (screen === "shop") body = h(Shop, {
    wallet: wallet,
    cart: cart,
    orders: orders,
    inventory: inventory,
    characters: liveChars,
    groups: groups,
    kinshipCards: kinshipCards,
    feed: shopFeed,
    busy: shopBusy,
    onBack: goHome,
    onGen: genShop,
    onAddCart: addToCart,
    onRemoveCart: uid => removeCartUids([uid]),
    onCheckout: checkout,
    onReceiveUse: receiveUse,
    onReceiveGift: receiveGift,
    toast: toast
  });else if (screen === "us") body = /*#__PURE__*/React.createElement(Us, {
    characters: liveChars,
    couples: couples,
    whispers: whispers,
    // 合照墙：从和 TA 的单聊里捞出所有「我俩合照」(photoKind:"duo")，投进情侣空间的相册
    duoPhotosFor: cid => (chats[cid] || []).filter(m => m && m.kind === "selfie" && m.photoKind === "duo" && !m.pending && !m.failed && (m.imgKey || m.imgUrl)).map(m => ({ imgKey: m.imgKey, imgUrl: m.imgUrl, ts: m.ts, desc: m.desc })),
    onBack: goHome,
    onInvite: sendCoupleInvite,
    onUnlink: unlinkCouple,
    onGenWhisper: genWhisper,
    onAddAnniversary: (partnerId, name, mo, day) => { saveCalEvent(partnerId, new Date().getFullYear() + "-" + mo + "-" + day, name, "情侣纪念日"); toast("纪念日已加进日历"); },
    onSetSince: setCoupleSince,
    profile: profile,
    coupleProfile: coupleProfile,
    onSetCoupleImg: setCoupleImg,
    gen: gen.whisper,
    coupleQA: coupleQA,
    onAnswerQA: answerCoupleQA,
    onEditQA: editCoupleQA,
    onRemoveQA: removeCoupleQA,
    onRerollQA: rerollCoupleQA,
    qaGen: gen.coupleQA,
    coupleQATitle: coupleQATitle,
    onSaveQATitle: saveQATitle,
    coupleNotes: coupleNotes,
    onAddNote: addCoupleNote,
    onAddNoteReply: addCoupleNoteReply,
    onRemoveNote: removeCoupleNote,
    onGenNote: genCoupleNote,
    noteGen: gen.coupleNote,
    coupleQACustom: coupleQACustom,
    coupleMood: coupleMood,
    onCheckinMood: checkinCoupleMood,
    moodGen: gen.coupleMood,
    coupleTimeline: coupleTimeline,
    onAddTimeline: addTimelineEvent,
    onRemoveTimeline: removeTimelineEvent,
    onGenTimeline: genTimelineMusing,
    tlGen: gen.coupleTL,
    coupleAnniv: coupleAnniv,
    onAddAnniv: addAnniv,
    onRemoveAnniv: removeAnniv,
    coupleLetters: coupleLetters,
    coupleLetterCfg: coupleLetterCfg,
    onGenLetter: genCoupleLetter,
    onAddMyLetter: addMyLetter,
    onReplyLetter: replyToLetter,
    onReadLetter: markLetterRead,
    onRemoveLetter: removeCoupleLetter,
    onSaveLetterCfg: saveLetterCfg,
    letterGen: gen.coupleLetter,
    coupleSweet: coupleSweet,
    onCheckinSweet: checkinSweet,
    coupleSync: coupleSync,
    onSyncStart: startCoupleSync,
    onSyncSubmit: submitCoupleSync,
    onSyncRemove: removeCoupleSync,
    syncGen: gen.coupleSync,
    coupleExDiary: coupleExDiary,
    onAddExDiary: addExDiaryPage,
    onReadExDiary: markExDiaryRead
  });else if (screen === "lore") body = h(WorldBook, {
    entries: loreEntries,
    characters: liveChars,
    onBack: goHome,
    onSave: e => saveLore([e].concat(loreRef.current.filter(x => x.id !== e.id))),
    onDelete: id => saveLore(loreRef.current.filter(x => x.id !== id))
  });else if (screen === "study") body = h(StudyApp, {
    active: active,
    bgActive: bgActive, // 判卷/课后小纸条等结构化小活走便宜后台池；教学对话仍用主 active
    characters: liveChars,
    profile: profile,
    worldbook: worldbook,
    toast: toast,
    entry: studyEntry,
    onBack: () => setScreen("home")
  });else if (screen === "read") body = h(ReadTogether, {
    active: active,
    bgActive: bgActive, // 批注/讲解/总结走便宜后台池；讨论(实时对话)仍用主 active
    characters: liveChars,
    digitalIds: liveChars.filter(function (c) { return settingsFor(c.id).engineerEyes; }).map(function (c) { return c.id; }), // 数字生命(言秋)→走亲读专属通道
    profile: profile,
    worldbook: worldbook,
    toast: toast,
    onAddMemory: (text, charId) => addMemEntry({ text: text, charIds: charId ? [charId] : [], knownBy: charId ? [charId] : [], source: "read", tags: ["一起读"] }),
    onBack: () => setScreen("home")
  });else if (screen === "debate") body = h(Debate, {
    active: active,
    characters: liveChars,
    profile: profile,
    worldbook: loreText(loreEntries, { scope: "debate" }),
    toast: toast,
    onBack: () => setScreen("home")
  });else if (screen === "dream") body = h(Dream, {
    active: active,
    characters: liveChars,
    profile: profile,
    worldbook: worldbook,
    rels: rels,
    toast: toast,
    onBack: () => setScreen("home")
  });else if (screen === "tarot") body = h(Tarot, {
    // 占卜只留在塔罗历史；不把随机牌面写成正式记忆。
    // 角色私心里那句 charThought 仍可送进「Ta 眼里」，它是当下印象，不是事实记忆。
    onReadingDone: (charId, info) => {
      if (!charId || !info) return;
      const who = (characters.find(c => c.id === charId) || {}).name || "Ta";
      const uNm = profile.name || "你";
      const text = info.mode === "forchar"
        ? uNm + "替" + who + "算了一卦（" + (info.cards || "") + "）：" + String(info.summary || "").slice(0, 90)
        : who + "为" + uNm + "解了一次塔罗" + (info.question ? "（问的是：" + String(info.question).slice(0, 30) + "）" : "") + "：" + String(info.summary || "").slice(0, 90);
      // 占卜不进记忆库（她 2026-08-25：「为啥塔罗也进记忆库了，不要这个！」）。
      // 记忆库是给「你俩之间真的发生过什么」用的，一卦牌不是那种东西，
      // 攒多了还会把真正的事挤出召回名额。下面那句 charThought 仍旧进「Ta 眼里」——
      // 那是他私心里对牌的反应，属于印象不属于事实。
      void text;
      // charThought 是「Ta 私心里对这几张牌的反应」——正是印象的原料,别再扔掉
      const th = String(info.charThought || "").trim();
      if (th && window.Gaze && !settingsFor(charId).engineerEyes && info.mode !== "forchar") {
        try { window.Gaze.applyParsed(charId, { side: "me", block: "recent", text: th.slice(0, 80) }); } catch (e) {}
      }
    },
    active: active,
    characters: liveChars,
    profile: profile,
    worldbook: worldbook,
    rels: rels,
    affinities: affinities,
    moods: moods,
    toast: toast,
    onForwardToChat: forwardTarotToChat,
    onBack: () => setScreen("home")
  });else if (screen === "dreamjournal") body = h(window.DreamJournalApp, {
    characters: liveChars,
    profile: profile,
    couples: couples,
    toast: toast,
    apiFor: apiFor,
    bgApi: bgActive,
    onBack: () => setScreen("home")
  });else if (screen === "yanqiu") body = h(window.YanqiuMomentsApp, {
    toast: toast,
    onBack: () => setScreen("home")
  });else if (screen === "rescue") body = h(window.RescueConsole, {
    toast: toast,
    onBack: () => setScreen("home")
  });else if (screen === "vpscodex") body = h(window.VpsCodexApp, {
    toast: toast,
    onOpenRescue: () => setScreen("rescue"),
    onBack: () => setScreen("home")
  });else if (screen === "loungeapp") body = h(window.LoungeEntryApp, {
    onBack: () => setScreen("home")
  });else if (screen === "ledger") body = h(Ledger, {
    active: bgActive,
    characters: liveChars,
    profile: profile,
    worldbook: worldbook,
    moods: moods,
    affinities: affinities,
    toast: toast,
    onBack: () => setScreen("home")
  });else if (screen === "codex") body = h(window.CodexApp, {
    onBack: () => setScreen("home")
  });else if (screen === "memo") body = h(window.Memo, {
    active: bgActive,
    characters: liveChars,
    profile: profile,
    worldbook: worldbook,
    moods: moods,
    affinities: affinities,
    toast: toast,
    onBack: () => setScreen("home")
  });else if (screen === "capsule") body = h(window.CapsuleApp, {
    active: active,
    apiFor: apiFor, // 胶囊回信/反向埋=TA 亲笔，跟随专线（v48.37）
    characters: liveChars,
    profile: profile,
    ctxFor: ctxFor,
    toast: toast,
    onBack: () => setScreen("home")
  });else if (screen === "pomodoro") body = h(Pomodoro, {
    active: bgActive,
    characters: liveChars,
    profile: profile,
    worldbook: worldbook,
    moods: moods,
    toast: toast,
    onBack: () => setScreen("home")
  });else if (screen === "games") body = h(Games, {
    // 小游戏需要规则推演与长程角色演绎，统一走线下创作线路。
    active: offlineActive,
    bgActive: offlineActive,
    characters: liveChars,
    profile: profile,
    worldbook: worldbook,
    moods: moods,
    // 注入最近聊天抓人设用（只读，不写回记忆）
    recentChatFor: (charId) => (chatsRef.current[charId] || []).filter(m => !m.recalled && m.content && !isOocMsg(m) && contextAllowsMessage(m)).slice(-16).map(m => (m.role === "user" ? (profile.name || "用户") : (characters.find(c => c.id === charId) || {}).name || "TA") + ": " + m.content).join("\n"),
    isEngineer: (charId) => !!settingsFor(charId).engineerEyes,
    toast: toast,
    onBack: () => setScreen("home")
  });else if (screen === "theater") body = h(TheaterApp, {
    // 小剧场:if 线沙箱,走线下创作线路;不传世界书/记忆/好感,天然隔离主线
    active: offlineActive,
    characters: liveChars,
    profile: profile,
    // 言秋的座位:if 线对戏的「演」也走 CC 亲笔(同小游戏切座管道),超时才由模型顶
    isEngineer: (charId) => !!settingsFor(charId).engineerEyes,
    toast: toast,
    onOpenStyleLab: goStyleLab,
    onBack: () => setScreen("home")
  });else if (screen === "stylelab") body = h(StyleLabApp, {
    // 文风预设台：一处生产，线下/小剧场/同人文三处消费。只在这里改预设本身，
    // 三处吃不吃各自有开关；开关关着＝行为和以前一模一样。
    active: offlineActive,
    characters: liveChars,
    profile: profile,
    toast: toast,
    onBack: backFromStyleLab
  });else if (screen === "assistant") body = h(AssistantApp, {
    // 帮手：改文风/人设/外貌、往记忆库加条目、查「为什么没生效」。
    // ⚠️写入口只给这两个，而且它永远先出改动稿、由她逐条点「应用」才真的落库。
    active: offlineActive,
    characters: liveChars,
    profile: profile,
    onPatchCharacter: (id, patch) => pC(list => list.map(c => c.id === id ? { ...c, ...patch } : c)),
    onAddMemories: (charId, items) => (items || []).forEach(txt =>
      addMemEntry({ text: txt, charIds: charId ? [charId] : [], source: "assistant" })),
    toast: toast,
    onBack: () => setScreen("home")
  });else if (screen === "impression") body = h(ImpressionApp, {
    // 月度印象：写字走线下创作线路（要文学性），素材自己从存储层取
    active: offlineActive,
    characters: liveChars,
    groups: groups,          // 群聊也是素材：她和某些角色大半的话都在群里说
    profile: profile,
    toast: toast,
    onBack: () => setScreen("home")
  });else if (screen === "fanfic") body = h(FanficApp, {
    // 同人文（含续章、书评、穿越互动）统一走线下创作线路。
    active: offlineActive,
    characters: liveChars,
    profile: profile,
    groups: groups,
    worldbook: worldbook,
    toast: toast,
    onForwardToChat: forwardFicToChat,
    onForwardToGroup: forwardFicToGroup,
    onNotifyChapter: notifyChapterToChars,
    onBack: () => setScreen("home")
  });else if (screen === "weekly") body = h(WeeklyApp, {
    active: active,
    characters: liveChars,
    groups: groups,
    profile: profile,
    worldbook: worldbook,
    toast: toast,
    onBack: () => setScreen("home")
  });else if (screen === "memlib") body = h(MemoryLib, {
    entries: memLib,
    characters: liveChars,
    focusChar: activeChar,
    busy: sending,
    cfg: memCfg,
    oldMemories: memories,
    onBack: () => setScreen(activeChar ? "thread" : "home"),
    onAdd: addMemEntry,
    onUpdate: updateMemEntry,
    onDelete: deleteMemEntry,
    onExtract: activeChar ? () => extractMemForChar(activeChar.id) : null,
    onSaveCfg: saveMemCfg,
    onImportOld: importOldMemoryToLib,
    onBackfillEmotion: backfillMemEmotion,
    onPurgeWithered: purgeWithered,
    onDowngradeRoutineOpen: downgradeRoutineOpen,
    routineOpenCount: routineOpenCandidates().length,
    onScanDuplicates: scanDuplicateMemories,
    onArchiveDuplicateGroups: archiveDuplicateGroups,
    onScanEventMerges: scanEventMergeMemories,
    onArchiveEventMergeGroups: archiveEventMergeGroups,
    onScanRoutineMemories: scanRoutineMemories,
    onArchiveRoutineGroups: archiveRoutineGroups,
    onListRepairConflicts: listRepairConflicts,
    onDecideRepairConflict: decideRepairConflict,
    onRefine: refineOldMemories,
    onRestoreArchived: restoreArchived,
    onBulkImport: bulkImportMemories,
    onAudit: exportMemoryAudit,
    onPostCutoverAudit: exportPostCutoverMemoryAudit,
    onSyncStatus: showMemorySyncStatus,
    onChatLedgerStatus: showChatLedgerShadowStatus,
    memoryTableMode: memTableMode,
    onEnableTableMemory: enableMemoryTableAuthority,
    onUseLegacyMemory: useLegacyMemoryMirror,
    emoBusy: emoBusy
  });else if (screen === "diary") body = h(Diary, {
    characters: liveChars,
    diaries: diaries,
    profile: profile,
    genBusy: diaryBusy,
    commentingId: diaryCommenting,
    onBack: () => setScreen("home"),
    onGen: genDiary,
    onBackfill: (id, opts) => backfillDiary(id, opts),  // opts.days=[ts] 只补那一天
    onDelEntry: delDiaryEntry,
    onSaveFields: saveDiaryFields,
    onAddMyEntry: addMyDiaryEntry,
    onGenComments: genDiaryCommentsFor,
    toast: toast
  });else if (screen === "listen") body = h(ListenTogether, {
    listen: listen,
    characters: liveChars,
    onBack: exitListen,
    onSetDisc: setListenDisc,
    onSetCover: setSongCover,
    onAddNetease: addNeteaseSong,
    onAddLocal: addLocalSong,
    onPlaySong: playSong,
    onRemoveSong: removeListenSong,
    onSetPartner: setListenPartner,
    apiBase: neteaseApi,
    onSetApiBase: saveNeteaseApi,
    cookie: neteaseCookie,
    onSetCookie: saveNeteaseCookie,
    onTestLogin: testNeteaseLogin,
    onAddNeteaseResult: addNeteaseResult,
    onPlayResult: playNeteaseResult,
    onPlayResultList: playNeteaseList,
    onAddResultToPlaylist: addResultToPlaylist,
    onCreatePlaylist: createPlaylist,
    onDeletePlaylist: deletePlaylist,
    onRenamePlaylist: renamePlaylist,
    onAddToPlaylist: addToPlaylist,
    onRemoveFromPlaylist: removeFromPlaylist,
    onRenameSong: renameSong,
    onGenCharPlaylist: genCharPlaylist,
    onSetAutoComment: setListenAutoComment,
    player: player,
    onTogglePlay: togglePlay,
    onStep: stepSong,
    onSeek: seekPlayer,
    onToggleFav: toggleFav,
    playMode: listen.playMode || "order",
    onCyclePlayMode: cyclePlayMode,
    gen: gen.listen,
    genCharPl: gen.charPlaylist
  });else if (screen === "calendar") body = h(Calendar, {
    characters: liveChars,
    calendar: calendar,
    calEvents: calEvents,
    schedules: schedules,
    initialView: selSched || undefined,
    profile: profile,
    period: period,
    busy: !!gen.calendar,
    genWeekBusy: !!(gen.sched && String(gen.sched).indexOf("|week") > 0),
    onBack: goHome,
    onSaveEvent: saveCalEvent,
    onDelEvent: delCalEvent,
    onGenMonth: genCalMonth,
    onSavePeriod: savePeriodSettings,
    onRecordPeriod: recordPeriodStart,
    onSaveTimed: saveCalTimedEvent,
    onDelTimed: delCalTimedEvent,
    // 手动重排：只重排【今天到本周日】。手动这一下也记账，免得随后自动那档又跑一遍。
    onGenWeek: async c => {
      const today = schedLocalDayKey(c), dowMon = (schedParseKey(today).getDay() + 6) % 7;
      const ok = await genScheduleWeek(c, { force: true, from: today, count: 7 - dowMon });
      const cur = loadJSON(SCHED_WEEK_MARK_KEY, {}) || {};
      cur[c.id + "|" + schedMondayOf(today)] = { ts: Date.now(), tries: ok ? SCHED_WEEK_MAX_TRIES : 1 };
      saveJSON(SCHED_WEEK_MARK_KEY, cur);
    }
  });else if (screen === "config") body = /*#__PURE__*/React.createElement(Config, {
    apiProfiles: apiProfiles,
    activeId: activeId,
    offlineApiId: offlineApiId,
    modelFloatOn: modelFloatOn,
    onSetModelFloat: on => { setModelFloatOn(!!on); saveJSON("x_modelFloatOn", !!on); },
    onSetOfflineApi: id => {
      setOfflineApiId(id);
      saveJSON("x_offlineApi", id);
    },
    bgApiId: bgApiId,
    onSetBgApi: setBgApi,
    characters: liveChars,
    coupleQACustom: coupleQACustom,
    onSaveCustomQA: saveCoupleQACustom,
    onAssignVoice: (charId, voiceId) => {
      pC(p => p.map(c => c.id === charId ? { ...c, voiceId } : c));
      toast("音色已指派");
    },
    onSaveApi: async (list, id) => {
      try {
        const runtime = window.CredentialVault ? await window.CredentialVault.persistApiProfiles(list) : list;
        setApiProfiles(runtime);
        setActiveId(id);
        if (!window.CredentialVault) saveJSON("x_api", list);
        saveJSON("x_activeApi", id);
        toast("API 配置已安全保存");
      } catch (e) { toast("API 凭证保存失败，旧配置仍保留：" + (e.message || e)); }
    },
    theme: theme,
    onSaveTheme: th => {
      setTheme(th);
      saveJSON("x_theme", th);
      toast("主题已保存");
    },
    wallpaper: wallpaper,
    onSaveWallpaper: w => {
      setWallpaper(w);
      saveJSON("x_wallpaper", w);
      toast(w ? "壁纸已更新" : "已恢复默认背景");
    },
    prefs: prefs,
    onSavePrefs: p => {
      setPrefs(p);
      saveJSON("x_prefs", p);
    },
    geo: geo,
    onRequestGeo: doRequestGeo,
    onBack: goHome,
    onExport: doExport,
    onImport: doImport,
    onOffloadChats: offloadAllChats,
    onPruneOld: pruneRegenerables,
    onClearAll: () => {
      Object.keys(localStorage).filter(k => k.startsWith("x_")).forEach(k => localStorage.removeItem(k));
      location.reload();
    },
    // 上下文透视：把此刻会喂给模型的完整 bundle 给设置页展示（只读、零 API）
    debugBundleFor: cid => {
      try {
        const c = characters.find(x => x.id === cid);
        return c ? buildBundle(ctxFor(c)) : "";
      } catch (e) { return "生成失败：" + (e.message || e); }
    },
    toast: toast
  });
  // 刘海那一条归各个界面的顶栏自己吃（v56.63，见 engine.js 的 safeTop）：
  // 顶栏和状态栏是同一个元素，中间没有交界，也就没有缝。
  // ⚠️主屏是唯一的例外，仍旧留着这条空带——它和 Home 的 height:100vh 是配好的一对，
  //   拆掉底部快捷栏当场被顶上去（v56.58 亲测，.claude/rules/home-screen-layout.md）。
  const _safeTop = { height: screen === "home" ? "env(safe-area-inset-top)" : 0 };
  return /*#__PURE__*/React.createElement(ThemeContext.Provider, {
    value: theme
  }, /*#__PURE__*/React.createElement("div", {
    className: "w-full flex flex-col relative overflow-hidden",
    style: {
      // 主屏时把壁纸铺到根节点（含顶部 safe-area 刘海区），Home 自身透明 → 壁纸一路遮到顶，无白边
      background: (screen === "home" && wallpaper) ? "center/cover no-repeat url(" + (typeof resolveImg === "function" ? resolveImg(wallpaper) : wallpaper) + ")" : theme.bg,
      height: "100vh" // 100vh=large viewport，撑到物理屏底（不用 100dvh/fixed，dvh 只到 WebKit 可视区会露白）
    }
  }, isStandalone ? /*#__PURE__*/React.createElement("div", {
    style: _safeTop,
    className: "shrink-0"
  }) : null, /*#__PURE__*/React.createElement(DevBadges, null), (function () {
    // 配件·常驻激活/急停浮层（安全铁律①③）：仅在解锁+已连+进了某个 opt-in 角色的【单聊 或 线下】里出现
    let unlocked = false; try { unlocked = localStorage.getItem("x_toyUnlocked") === "1"; } catch (e) {}
    const tc = offlineChar || (screen === "thread" ? activeChar : null);
    if (!(unlocked && typeof toyReady === "function" && toyReady() && tc && settingsFor(tc.id) && settingsFor(tc.id).toyEnabled)) return null;
    const armedHere = toyArmed && toyArmedFor === tc.id;
    return h("div", { style: { position: "fixed", right: 14, bottom: "calc(env(safe-area-inset-bottom) + 88px)", zIndex: 999 } },
      armedHere
        ? h("button", { onClick: disarmToy, className: "active:opacity-80", style: { fontFamily: F_BODY, fontSize: 13, fontWeight: 700, color: "#fff", background: "#c0392b", borderRadius: 999, padding: "11px 18px", boxShadow: "0 4px 14px rgba(0,0,0,.28)" } }, "■ 急停")
        : h("button", { onClick: () => { setToyArmed(true); setToyArmedFor(tc.id); toast("配件已激活 · 仅本次会话本对话"); }, className: "active:opacity-80", style: { fontFamily: F_BODY, fontSize: 12.5, color: "#fff", background: "rgba(35,35,35,.82)", borderRadius: 999, padding: "9px 15px", boxShadow: "0 3px 10px rgba(0,0,0,.22)" } }, "▷ 激活配件"));
  })(), /*#__PURE__*/React.createElement("audio", {
    ref: audioElRef,
    style: { display: "none" },
    onTimeUpdate: e => setPlayer(p => ({ ...p, t: e.target.currentTime || 0, dur: e.target.duration || 0 })),
    onEnded: advanceSong
  }), /*#__PURE__*/React.createElement("div", {
    className: "flex-1 min-h-0 relative"
  }, body), (player.songId && screen !== "listen") ? h(MiniPlayer, {
    song: resolveSong(player.songId),
    playing: player.playing,
    loading: player.loading,
    onOpen: goListen,
    onToggle: togglePlay,
    onNext: () => stepSong(1),
    onClose: stopPlayer
  }) : null, (() => {
    const scc = stateCardChar || activeChar;
    return stateCardOpen && scc && /*#__PURE__*/React.createElement(StateCard, {
      character: scc,
      isNpc: !!scc.npc,
      affinity: Math.round(affOf(scc.id)),
      mood: moods[scc.id],
      // 心声过了时效就不再展示:宁可空着,也别把两小时前的念头当成「此刻在想」
      state: (() => { const s0 = states[scc.id]; if (!s0 || !s0.thought) return s0; return freshLiveStateValue(s0, "thought") ? s0 : { ...s0, thought: null }; })(),
      history: stateHist[scc.id] || [],
      // 群聊也显示穿着/动作:它们本来就一直在更新,只是被这个开关挡住了(她 2026-08-18 要回)
      gazeOn: !!window.Gaze && !settingsFor(scc.id).engineerEyes && !scc.npc,
      uName: profile.name || "你",
      onGazeSeed: () => seedGazeFor(scc),
      gazeSeedBusy: gazeSeedBusy,
      onClose: () => { setStateCardOpen(false); setStateCardChar(null); setStateCardGroup(false); }
    });
  })(), cardImportOpen ? h(CardImportSheet, { onImport: importCharCard, onClose: () => setCardImportOpen(false) }) : null, desireBoxOpen && activeChar && window.DesireBoxSheet ? h(window.DesireBoxSheet, {
    char: activeChar,
    box: desires[activeChar.id],
    busy: desireBusy,
    onMuse: async () => { if (desireBusy) return; setDesireBusy(true); try { await desireMuseFor(activeChar, { manual: true }); } finally { setDesireBusy(false); } },
    onRemove: id => saveDesires(n => { const b = DesireKit.boxOf(n, activeChar.id); b.list = b.list.filter(e => e.id !== id); n[activeChar.id] = b; }),
    onRemovePersona: id => saveDesires(n => { const b = DesireKit.boxOf(n, activeChar.id); b.persona = b.persona.filter(e => e.id !== id); n[activeChar.id] = b; }),
    onRemoveAvoid: topic => saveDesires(n => { const b = DesireKit.boxOf(n, activeChar.id); b.avoid = b.avoid.filter(a => a.topic !== topic); n[activeChar.id] = b; }),
    onClose: () => setDesireBoxOpen(false)
  }) : null, editMsg && /*#__PURE__*/React.createElement(MsgEditSheet, {
    init: editMsg.content,
    onCancel: () => setEditMsg(null),
    onSave: nv => { editMsg.onSave(nv); setEditMsg(null); }
  }), chatRoomsOpen && activeChar && window.ChatRoomSheet ? h(window.ChatRoomSheet, {
    character: activeChar,
    activeRoomId,
    onSelect: (roomId, close) => { setActiveRoomId(roomId || "main"); if (close) setChatRoomsOpen(false); },
    onSummarize: (room, frame) => summarizeChatRoom(activeChar, room, frame),
    onClose: () => setChatRoomsOpen(false)
  }) : null, chatSettingsOpen && activeChar && /*#__PURE__*/React.createElement(ChatSettings, {
    character: activeChar,
    settings: settingsFor(activeChar.id),
    apiProfiles: apiProfiles,
    memory: memories[activeChar.id],
    temperament: temperamentDraft,
    temperamentBusy: temperamentBusy,
    onGenerateTemperament: generateTemperamentDraft,
    onSaveTemperament: saveTemperamentAnchors,
    aShadowPanel: aShadowPanel,
    jiwenState: (typeof window !== "undefined" && window.__jiwen && window.__jiwen[activeChar.id] && window.__jiwen[activeChar.id].state) || null,
    activeRoomId: activeRoomId,
    onSelectRoom: (roomId, close) => {
      setActiveRoomId(roomId || "main");
      if (close) setChatSettingsOpen(false);
    },
    onSummarizeRoom: (room, frame) => summarizeChatRoom(activeChar, room, frame),
    onSaveMemory: text => { setMemFor(activeChar.id, text); toast("长期记忆已保存"); },
    onSave: s => {
      saveRemark(activeChar.id, s.remark);
      pC(p => p.map(c => c.id === activeChar.id ? {
        ...c,
        patSig: s.patSig
      } : c));
      setChatSettings(p => {
        const n = {
          ...p,
          [activeChar.id]: {
            ...settingsFor(activeChar.id),
            ctxN: s.ctxN,
            sumThresh: s.sumThresh,
            sumBuffer: s.sumBuffer,
            autoMoment: s.autoMoment,
            proactive: s.proactive,
            proactiveMin: s.proactiveMin,
            showMyAvatar: s.showMyAvatar,
            showTime: s.showTime,
            timeSec: s.timeSec,
            showRead: s.showRead,
            showReasoning: s.showReasoning,
            bilingual: !!s.bilingual,
            selfP: s.selfP,
            userP: s.userP,
            describeMe: s.describeMe,
            chatBg: s.chatBg,
            apiId: s.apiId || null,
            engineerEyes: !!s.engineerEyes,
            toyEnabled: !!s.toyEnabled,
            defaultOffline: !!s.defaultOffline
          }
        };
        saveJSON("x_chatSettings", n);
        return n;
      });
      setActiveChar(c => ({
        ...c,
        remark: s.remark,
        patSig: s.patSig
      }));
      setChatSettingsOpen(false);
      toast("已保存");
    },
    onClose: () => setChatSettingsOpen(false),
    onClearMemory: () => {
      setMemFor(activeChar.id, "");
      toast("已清空记忆");
    },
    onClearChat: wipeMem => clearChat(activeChar.id, wipeMem),
    iBlocked: !!(blocks[activeChar.id] && blocks[activeChar.id].iBlocked),
    onToggleBlock: () => toggleBlock(activeChar.id),
    memLibCount: memLib.filter(e => !e.charIds || e.charIds.length === 0 || e.charIds.includes(activeChar.id)).length,
    onOpenMemLib: () => {
      setChatSettingsOpen(false);
      setScreen("memlib");
    },
    onExtractMem: () => extractMemForChar(activeChar.id)
  }), modelFloatOn && h(ModelQuickSwitch, {
    profiles: apiProfiles,
    activeId: activeId,
    offlineApiId: offlineApiId,
    onSetOnline: id => { setActiveId(id); saveJSON("x_activeApi", id); toast("线上已切换为 " + (((apiProfiles || []).find(p => p.id === id) || {}).name || ((apiProfiles || []).find(p => p.id === id) || {}).model || "该线路")); },
    onSetOffline: id => { setOfflineApiId(id); saveJSON("x_offlineApi", id); const p = id && (apiProfiles || []).find(x => x.id === id); toast("线下已切换为 " + (p ? (p.name || p.model || "该线路") : "跟随线上主模型")); }
  }), newGroupOpen && /*#__PURE__*/React.createElement(NewGroupSheet, {
    characters: liveChars,
    onCreate: createGroup,
    onClose: () => setNewGroupOpen(false)
  }), profileOpen && /*#__PURE__*/React.createElement(ProfileSheet, {
    profile: profile,
    onSave: p => {
      setProfile(p);
      saveJSON("x_profile", p);
      setProfileOpen(false);
      toast("已保存");
    },
    onClose: () => setProfileOpen(false)
  }), cardOpen && h(HomeCardSheet, {
    card: homeCard,
    onSave: c => { setHomeCard(c); saveJSON("x_homeCard", c); setCardOpen(false); toast("名片已保存"); },
    onClose: () => setCardOpen(false)
  }), call && h(CallScreen, {
    participants: call.participants,
    mode: call.mode,
    msgs: call.msgs,
    sending: sending,
    minimized: !!call.min,
    onMinimize: () => setCall(c => c ? { ...c, min: true } : c),
    onRestore: () => setCall(c => c ? { ...c, min: false } : c),
    onSend: txt => callSend(txt),
    onHangup: sec => endCall(sec)
  }), anonChar && h(AnonBox, {
    char: anonChar,
    data: anon[anonChar.id],
    busy: anonBusy,
    onGenNetizen: () => genNetizenQ(anonChar),
    onRefreshPersona: () => refreshAnonPersona(anonChar),
    onDelRecord: ts => delAnonRecord(anonChar.id, ts),
    onAsk: q => askAnon(anonChar, q),
    onClose: () => setAnonChar(null)
  }), offlineChar && h(OfflineMode, {
    char: offlineChar,
    profile: profile,
    sessions: offlines[offlineChar.id] || [],
    activeSession: (offlines[offlineChar.id] || []).find(s => !s.endTs) || null,
    sending: sending,
    settings: osFor(offlineChar.id),
    registerTelemetry: offlineRegisterTelemetry[offlineChar.id] || null,
    onSaveSettings: patch => saveOfflineSettings(offlineChar.id, patch),
    onStart: opts => startOffline(offlineChar.id, opts),
    onSend: txt => offlineSend(offlineChar.id, txt),
    onSendPhoto: photo => offlineSendPhoto(offlineChar.id, photo),
    onReply: txt => offlineReply(offlineChar.id, txt),
    onOOC: txt => offlineOOC(offlineChar.id, txt),
    onAddNote: n => offlineAddNote(offlineChar.id, n),
    onChangeStyle: patch => offlineSetStyle(offlineChar.id, patch),
    onSaveExample: m => saveOfflineStyleExample(offlineChar.id, m && m.content),
    onDeleteExample: id => deleteOfflineStyleExample(offlineChar.id, id),
    onEditMsg: (mid, txt) => offlineEditMsg(offlineChar.id, mid, txt),
    onRerollMsg: mid => offlineRerollMsg(offlineChar.id, mid),
    onDelMsg: (mid, idx) => offlineDelMsg(offlineChar.id, mid, idx),
    onDelSession: sid => offlineDelSession(offlineChar.id, sid),
    onEnd: () => endOffline(offlineChar.id),
    onClose: () => setOfflineChar(null),                       // 下拉「对话（回线上）」：只收线下浮层，露出线上聊天
    onExit: () => { setOfflineChar(null); setScreen("messages"); }, // 顶栏「离开」：直接退回聊天列表（她要的：别再退两次）
    onOpenState: () => { setStateCardChar(null); setStateCardGroup(false); setStateCardOpen(true); },
    schedNow: schedNowBriefFor(offlineChar),
    onOpenStyleLab: goStyleLab,
    onOpenSched: () => { setSelSched(offlineChar.id); setOfflineChar(null); setScreen("calendar"); } // 离开线下浮层→跳到日历（线下浮层是 z-20 会盖住日程屏，得先离开）
  }), offlineGroup && h(GroupOfflineMode, {
    group: offlineGroup,
    profile: profile,
    members: (offlineGroup.memberIds || []).map(id => characters.find(c => c.id === id)).filter(Boolean),
    sessions: groupOfflines[offlineGroup.id] || [],
    activeSession: (groupOfflines[offlineGroup.id] || []).find(s => !s.endTs) || null,
    sending: sending,
    onStart: opts => startGroupOffline(offlineGroup.id, opts),
    onSend: txt => groupOfflineSend(offlineGroup.id, txt),
    onSendPhoto: photo => groupOfflineSendPhoto(offlineGroup.id, photo),
    onReply: txt => groupOfflineReply(offlineGroup.id, txt),
    onAddNote: n => groupOfflineAddNote(offlineGroup.id, n),
    onDeleteNote: id => groupOfflineDeleteNote(offlineGroup.id, id),
    onChangeStyle: patch => groupOfflineSetStyle(offlineGroup.id, patch),
    onSaveExample: (m, spk) => { const cid = (m && m.senderId) || (spk && spk.id); if (cid) saveOfflineStyleExample(cid, m && m.content); },
    onEditMsg: (mid, txt) => groupOfflineEditMsg(offlineGroup.id, mid, txt),
    onRerollMsg: mid => groupOfflineRerollMsg(offlineGroup.id, mid),
    onDelMsg: (mid, idx) => groupOfflineDelMsg(offlineGroup.id, mid, idx),
    onDelSession: sid => groupOfflineDelSession(offlineGroup.id, sid),
    onOOC: txt => groupOfflineOOC(offlineGroup.id, txt),
    onEnd: () => endGroupOffline(offlineGroup.id),
    onClose: () => setOfflineGroup(null),                        // 下拉「群聊（回线上群）」：只收线下浮层
    onExit: () => { setOfflineGroup(null); setScreen("messages"); }, // 顶栏「离开」：直接退回聊天列表
    onOpenStyleLab: goStyleLab,
    settings: osFor("g_" + offlineGroup.id),
    onSaveSettings: patch => saveOfflineSettings("g_" + offlineGroup.id, patch),
    // 群线下点头像看心声：和线上群一样，只有开了互通(states 才共享/会变)才可点
    onOpenMemberState: gsFor(offlineGroup.id).memoryInterop ? (memberId => { const c = characters.find(x => x.id === memberId); if (c) { setStateCardChar(c); setStateCardGroup(true); setStateCardOpen(true); } }) : undefined
  }), /*#__PURE__*/React.createElement(Toast, {
    msg: toastMsg
  })));
}
// 挂载前先把图片仓库 hydrate 进内存缓存（iv_ 键→objectURL），首帧头像/壁纸就能直接显示、不闪空。
// hydrate 只是读一遍 IndexedDB，几毫秒；失败也照常挂载（resolveImg 对未命中的 iv_ 返回空、落首字母兜底）。
(function () {
  const mount = () => ReactDOM.createRoot(document.getElementById("root")).render(/*#__PURE__*/React.createElement(App, null));
  // 挂载前先灌好图库 + 文字库(同人文迁 IDB)镜像，首帧就能同步读到；失败也照常挂载(loadJSON 会回落 localStorage)。
  const hyd = [];
  if (typeof hydrateImgVault === "function") hyd.push(hydrateImgVault());
  if (typeof hydrateNativeSelfies === "function") hyd.push(hydrateNativeSelfies());
  if (typeof hydrateTxtVault === "function") hyd.push(hydrateTxtVault());
  if (window.CredentialVault) hyd.push(window.CredentialVault.hydrateApiCredentials());
  if (hyd.length) Promise.all(hyd.map(p => Promise.resolve(p).catch(() => 0))).then(mount, mount); else mount();
})();

// 启动时：若已登录且云端存档更新，静默拉回并重载（换设备场景）
if (window.Cloud && window.Cloud.ready()) {
  window.Cloud.autoPull().then(r => { if (r && r.applied) location.reload(); });
}
