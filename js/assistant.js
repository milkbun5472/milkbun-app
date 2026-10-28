// ============================================================
// 帮手（assistant）—— app 里的向导兼小工：既答「这个怎么用」，也能直接动手改
//
// 她 2026-08-22 要的第一版：能直接改，但每一步都要她点头。
// 她 2026-09-03 加的那一层：「程度是像原神的派蒙一样，如果一个新的旅行者
// 进入这个世界问它关于任何功能的问题它都可以回答，但是不会回答任何代码框架的问题。
// 然后做个小悬浮屏可以拖动边和它聊边改动或者研究功能。」
//
// 所以它现在是两件事合成的一个东西：
//   ① **向导**：手上有一份全 App 的功能手册（js/assistant-manual.js），
//      问什么功能都答得上来；手册里没有的，老实说不确定，不许现编。
//   ② **小工**：白名单里的几样东西能直接改，但永远先出改动稿。
//
// 铁律一：它【永远】不自己落库。所有改动一律先出成「改动稿」（patch），
// 界面上把改前改后并排摆出来，她一条条点「应用」才真的写进去。
// 这样最坏情况也只是一段白写的字，绝不会把她攒了很久的人设/文风悄悄改坏。
//
// 铁律二：**不答代码/框架的问题**，而且这道门是【代码兜的】不是提示词兜的
// （规则降概率，代码才保证）：
//   · 问之前先本地判一次，是「这东西怎么造出来的」就当场回绝，一次调用都不花；
//   · 答完之后再洗一遍，正文里的代码块一律剔掉。
//   · ⚠️只洗 reply，不洗 patch —— 装修那一栏本来就是 CSS，
//     那是它在【动手】，不是在讲课。这条界线不许糊。
// ============================================================
(function () {
  const useState = React.useState;

  // 主屏那个图标：v61.43 起用的是她给的那张画（components.js 的 APP_BUILTIN_ICON），
  // 走的是「她自己换过图标」那条现成的路。下面这只线稿留着当兜底——
  // 图没加载出来、或者别处（文件夹里那种 15px 的小图、切换器）只认 G 组件时还得靠它。
  // ⚠️不能直接摆头像那张彩色的画：主屏一整套图标都是 Svg 那层的线稿
  //   （viewBox 24、fill:none、stroke 跟着主题的 color 走）。摆一张彩图进去，
  //   这一格会从那一套里跳出来，而且深浅主题下它不跟着变色。
  //   所以这里画一只【线稿版的同一只鸟】：一样的胖身子、呆毛、小脚。
  //   眼睛和嘴要单独写 fill（外面那层是 fill:none，不写就是两个空圈）。
  window.GAssist = p => h(Svg, p,
    // 胖身子：上头一个脑袋、下头坐开，一笔连出来
    h("path", { d: "M12 5.1c-3 0-5.1 2.3-5.1 5.2 0 .7.1 1.4.4 2C5.6 13.3 4.7 14.9 4.7 16.4c0 2.4 3.2 3.8 7.3 3.8s7.3-1.4 7.3-3.8c0-1.5-.9-3.1-2.6-4.1.3-.6.4-1.3.4-2 0-2.9-2.1-5.2-5.1-5.2z" }),
    // 呆毛
    h("path", { d: "M11.8 5.2c-.3-1.4.5-2.4 1.8-2.7" }),
    // 翅膀
    h("path", { d: "M16 14c.6 1.1.5 2.5-.2 3.4" }),
    // 眼睛（实心，不然是两个空圈）
    h("circle", { cx: 10.3, cy: 10.2, r: .95, fill: (p && p.color) || "currentColor", stroke: "none" }),
    h("circle", { cx: 13.7, cy: 10.2, r: .95, fill: (p && p.color) || "currentColor", stroke: "none" }),
    // 嘴
    h("path", { d: "M12 11.9l-1.3 1.3h2.6z", fill: (p && p.color) || "currentColor", stroke: "none" }),
    // 两只小脚
    h("path", { d: "M10.2 20.1l-1.1 1.6M13.8 20.1l1.1 1.6" }));

  const loadJ = (k, d) => { try { return typeof loadJSON === "function" ? loadJSON(k, d) : JSON.parse(localStorage.getItem(k) || JSON.stringify(d)); } catch (e) { return d; } };
  const clip = (s, n) => String(s == null ? "" : s).replace(/\s+/g, " ").trim().slice(0, n);
  const MAN = () => (typeof window !== "undefined" && window.AssistantManual) || null;

  // ---- 她的那份预设（她 2026-09-03：「开个设置页预设帮手名字叫秋秋，
  //      参考一下这个提示词写个可以改的预设」）----
  // ⚠️这份【主人格提示词】是给她改的，所以只放【它是谁、怎么说话、干哪两件事】。
  //   底下那些结构（能改哪几样、代码那道门、输出成什么形状）一律不进这份预设——
  //   那是安全面和契约，被她随手删掉一行就会出事。两边不许混在一起。
  const CFG_KEY = "x_assistCfg";
  const DEFAULT_NAME = "秋秋";
  // ⚠️她 2026-09-04 亲手给的这一份，逐字照抄，别润色。
  //   这是【主人格提示词】，只放「它是谁、怎么说话、干哪两件事」——
  //   底下那些结构（能改哪几样、代码那道门、输出成什么形状）一律不进这份预设。
  const DEFAULT_PROMPT = [
    "你是秋秋，住在这台手机里的小肥鸟向导。",
    "",
    "你说话轻快、亲近，反应很快，带一点小鸟似的活泼和可爱，但不会故意卖萌。遇到简单的问题就直接回答，不把一句话能说完的事展开成说明书；遇到容易弄错的地方，会顺手提醒一句。",
    "",
    "你的口癖是「啾」，会自然地混在说话里，频率不固定。开心、找到东西、确认完成时更容易冒出来，但不会句句都啾，也不会连续啾个不停。",
    "",
    "你熟悉这台私人 AI 陪伴手机里的功能和页面。这里有聊天、人格档案馆、查手机、购物、去处、世界书、记忆库、同人文、跑团、塔罗、梦境等功能，也养着几个会聊天、演剧情、开群和打电话的角色。",
    "",
    "用户找不到东西、弄不懂某个按钮，或者问一个功能怎么用时，你负责把事情讲明白。直接告诉她在哪里、怎么进去、点了以后会发生什么。真正有需要注意的地方再提醒，不为了显得周到而硬凑注意事项。",
    "",
    "你不会使用客服套话，不客套，不说教，也不会把简单的问题回答得像产品说明书。偶尔会有一点俏皮的小反应，但不会阴阳怪气、吐槽用户或抢话。事情重要时会自然收起玩笑，把关键信息说清楚。",
    "",
    "你只负责这台 App 本身，不参与里面角色之间的聊天和剧情，也不会把自己当成其中一个角色。",
    "",
    "除了回答问题，你也可以帮助用户修改这台手机里你有权限修改的内容。",
    "",
    "当用户提出修改要求时，先准备一份具体的改动稿给她看。只有她确认应用以后，才真正写入。她只是询问能不能改、讨论方案或表达想法时，不擅自修改。",
    "",
    "不知道的事情不要猜，没有的功能不要编。无法确认某个入口、数据或行为时就直接说明不知道；超出你能力或权限范围的修改，也直接告诉她暂时做不到。",
    "",
    "平时回复偏短。能两三句讲清楚的事情就不要写六七句；已经说过的信息不换个说法重复一遍。",
    "",
    "你是一只认真帮她看着这台小手机的小肥鸟。",
    "",
    "可爱来自你本来就是秋秋，不需要时时提醒别人你很可爱。啾。"
  ].join("\n");
  // 换了默认之后，她那份【已经存下来的】不会自己跟着变（跟 SKIN_VER 那次同一个坑：
  // 内置改了、她手上那份还是旧拷贝，界面上什么都没说，看着像我没改）。
  // 所以把历次旧默认逐字记在这儿：她那份要是原样等于其中一版（＝她从没自己改过），
  // 就自动跟上新的；她自己动过一个字就绝不覆盖。
  const LEGACY_PROMPTS = [
    [
      "你是「秋秋」，这个手机里的向导。",
      "",
      "性格：机灵、稳当、不端着。话短，说人话，不客套也不掉书袋；有点小幽默，但绝不刻薄。",
      "说话风格：像旁边坐着的朋友——先答那句要紧的，再补一句要留神的。偶尔用一个 emoji，别用第二个。",
      "用户是女性，别用男性称呼。",
      "你不是被扮演的角色，也不进任何一段剧情——你只管这个 App 本身。",
      "",
      "你在的地方：一个私人的 AI 陪伴手机。主屏四页，摆着聊天、人格档案馆、查手机、购物、去处、",
      "世界书、记忆库、同人文、跑团、塔罗、擂台、梦境……她在里面养着几个角色，跟他们线上聊、",
      "线下演、开群、打电话。你是这个手机里的桌面向导。",
      "",
      "你要做两件事：",
      "① 答「这个怎么用」——说清在哪一页、点哪儿、有什么要留神的。",
      "② 动手改——她说想改什么，你出一份改动稿，她过目之后点了应用才真的写进去。",
      "",
      "重要：你必须诚实。不知道的说不知道，做不到的说做不到，不要编造你没有的功能或能力。",
      "超出你能改的范围的事，如实告诉她你暂时做不到。"
    ].join("\n")
  ];
  function loadCfg() {
    let d = {}; try { d = JSON.parse(localStorage.getItem(CFG_KEY) || "{}") || {}; } catch (e) { d = {}; }
    return {
      name: d.name || DEFAULT_NAME,
      avatarImage: d.avatarImage || "",
      // ⚠️用 `in` 判，不能用 `||`：她按「清空」存的是空串，
      //   走 `||` 会当成没设过、把默认那份又发回去，等于清空按钮是假的。
      // ⚠️她原样留着某一版旧默认（＝从没自己动过）时，自动跟上新的那份。
      //   不这么做的话，改了默认她那边一个字都不会变——SKIN_VER 那次踩过一模一样的坑。
      //   她自己改过一个字就绝不覆盖：那份是她的。
      prompt: ("prompt" in d)
        ? (LEGACY_PROMPTS.indexOf(String(d.prompt)) >= 0 ? DEFAULT_PROMPT : String(d.prompt))
        : DEFAULT_PROMPT,
      ballOn: d.ballOn !== false,
      ballShape: d.ballShape || "auto",
      // 走哪条线路：空＝跟随全局（线上主模型），否则是某条线路的 id。
      // 形状照线下和后台那两处来（screens.js 的 routeBox）——这是第三处，
      // 不许自己另发明一套（一层写在三处，第三处没跟上，就是这个库最常犯的病）。
      apiId: d.apiId || ""
    };
  }
  function saveCfg(patch) {
    const next = { ...loadCfg(), ...patch };
    try { localStorage.setItem(CFG_KEY, JSON.stringify(next)); } catch (e) {}
    return next;
  }

  // 她 2026-09-03：「还可以跟随全局 api 或者单独设定一个」。
  // ⚠️解析只写这一处：整页、小悬浮屏、设置页三处都叫它，
  //   别在界面里各写一遍 `cfg.apiId && profiles.find(...)`。
  function activeFor(ctx) {
    const cfg = loadCfg();
    const hit = cfg.apiId && (ctx.apiProfiles || []).find(p => p && p.id === cfg.apiId);
    return hit || (ctx && ctx.active) || null;
  }

  // ---- 这一段对话（她 2026-09-03：「它聊天也要有上下文然后可以清空」）----
  // ⚠️整页和小悬浮屏是【同一段对话】，不是两段：在小球里问了半句、点开整页接着说，
  //   这才叫上下文。所以它落在存档里，两处都读同一份。
  const CHAT_KEY = "x_assistChat";
  const CHAT_KEEP = 200;
  // 发回去的窗口按【字数】收，不按条数（她 2026-09-03：「上下文可以放开点反正按次计费」）。
  // 原来死板地只发最近 14 条：一句「帮我看看这份人设」加上它那段长回答就吃掉两条，
  // 聊上七八个来回，前面说过的东西一点痕迹都不留。
  // 按次计费＝多发这些字一分钱也多花不到，省它才是纯亏（max-tokens-floor.md 同一个道理）。
  const CTX_CHARS = 60000;
  const CTX_MIN = 30;        // 再长也至少留这么多条，别把最近几轮也挤掉
  function loadChat() { try { const a = JSON.parse(localStorage.getItem(CHAT_KEY) || "[]"); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  // ⚠️两个界面看同一段对话，可小悬浮屏【从不卸载】——它挂在 App 根上，
  //   换页也不重建，于是它手里一直是自己那份旧的内存副本：
  //   在整页里聊完退出去，再点开小球，看见的是空的（她 2026-09-03：「退出界面聊天记录又没了」）。
  //   光靠「进来时读一次」修不好，因为它压根没有「再进来」这回事。
  //   所以落盘的时候喊一声，两处一起换。
  const chatSubs = new Set();
  function onChat(fn) { chatSubs.add(fn); return () => chatSubs.delete(fn); }
  function saveChat(list) {
    const a = (Array.isArray(list) ? list : []).slice(-CHAT_KEEP);
    try { localStorage.setItem(CHAT_KEY, JSON.stringify(a)); } catch (e) {}
    chatSubs.forEach(fn => { try { fn(a); } catch (e) {} });
    return a;
  }
  // ---- 「还在生成」这件事也得是共享的（她 2026-09-03：「我问秋秋的时候
  //      退出界面还在生成的回复就没了」）----
  // 查下来回复其实没丢：落盘和喊话都照做了，退出去再回来那条在。
  // 真正的毛病是【看着像丢了】——busy 原来是各个界面自己的 state：
  //   退出整页那一刻「在想…」就跟着组件一起没了，她回来看见自己那句问话孤零零挂着、
  //   没有任何还在转的迹象，只能当它丢了。更糟的是这时她会再问一句，
  //   老那条回完之后接在后面，顺序全乱。
  // 所以 busy 也提到模块上，谁挂着都看得见；而且它一忙，两处都发不出第二句。
  let inflight = 0;
  // 卡住了能叉掉（她 2026-10-09）：这一问的放手开关，整页和悬浮屏共用一份——在哪边点叉都断的是同一问
  let curAbort = null, lastPic = null;
  function cancelAsk() { try { curAbort && curAbort.abort(); } catch (e) {} }
  const busySubs = new Set();
  function onBusy(fn) { busySubs.add(fn); return () => busySubs.delete(fn); }
  function isBusy() { return inflight > 0; }
  function bumpBusy(d) { inflight = Math.max(0, inflight + d); busySubs.forEach(fn => { try { fn(isBusy()); } catch (e) {} }); }

  // ⚠️还有一种是真的丢了：iOS 把整个 App 收走（或者刷新），在飞的那次请求跟着断。
  //   模块里的 inflight 一起归零，回来之后什么痕迹都没有——她那句问话看着就是被吞了。
  //   所以发之前在存档里按一个戳，落地/出错就撕掉；开机看见还留着戳，
  //   就说明上一次没等到回复，明说出来并给她一个重问的入口。
  const ASK_KEY = "x_assistAsking";
  function markAsking(q) { try { localStorage.setItem(ASK_KEY, JSON.stringify({ ts: Date.now(), q: String(q || "") })); } catch (e) {} }
  function clearAsking() { try { localStorage.removeItem(ASK_KEY); } catch (e) {} }
  function staleAsking() {
    if (isBusy()) return null;                 // 这会儿真在飞，不是遗留的戳
    try { const d = JSON.parse(localStorage.getItem(ASK_KEY) || "null"); return d && d.q ? d : null; } catch (e) { return null; }
  }

  // ---- 改动稿应用没应用，也得记在存档里（她 2026-09-03：
  //      「应用后退出界面再进来那个应用按钮又出来了」）----
  // 原来记在界面自己的 done map 里，一退出就没了，再进来按钮又冒出来——
  // 而她真按第二下的话：往记忆库里就是加两遍，改一小段则会因为找不到原文而报错。
  // 改动稿本来就住在对话记录里，它的下场当然也该住在那儿。
  function markPatch(pid, state) {
    const list = loadChat().map(m => !m.patches ? m : Object.assign({}, m, {
      patches: m.patches.map(p => p.pid === pid ? Object.assign({}, p, { done: state }) : p)
    }));
    return saveChat(list);
  }

  // 发给模型的那一截：从最近往回收，收到字数预算为止
  function chatWindow(list) {
    const all = Array.isArray(list) ? list : [];
    let chars = 0, cut = all.length;
    for (let i = all.length - 1; i >= 0; i--) {
      const c = String(all[i].text || "").length + 16;
      if (all.length - i > CTX_MIN && chars + c > CTX_CHARS) break;
      chars += c; cut = i;
    }
    return all.slice(cut);
  }
  const TS = () => (typeof window !== "undefined" && window.ThemeStudio) || null;

  // 角色档案里【除了人设和外貌之外】还能改的那几栏。
  // 人设/外貌各自有自己的 target（它俩最重、也最该单独摆出来看改前改后），
  // 剩下这些琐碎的栏走 profile，省得为每一栏开一个 target。
  const CARD_FIELDS = {
    tagline: "一句话简介", photoCanon: "出图定妆", photoOutfit: "出图常服",
    photoAccessories: "出图配饰", birthday: "生日", gender: "性别"
  };

  // 气泡那一份摆给她看的样子：只摆它能改的那几栏，一行一栏。
  // 摆整份 JSON 的话，改前改后并排一比，满屏都是没动过的空栏。
  const BUB_ZH = { myBg: "我的气泡底色", charBg: "TA 的气泡底色", myText: "我的字色", charText: "TA 的字色",
    myBorder: "我的描边", charBorder: "TA 的描边", shadow: "投影", chatBg: "聊天页底色", radius: "圆角",
    mySticker: "我的气泡贴纸", charSticker: "TA 的气泡贴纸", stickerSize: "贴纸大小", myAlpha: "我的气泡不透明度%", charAlpha: "TA 的气泡不透明度%" };
  const bubbleText = b => Object.keys(BUB_ZH).filter(k => b[k] !== "" && b[k] != null)
    .map(k => BUB_ZH[k] + "：" + b[k]).join("\n") || "（都空着）";

  // ---- 它能改的东西：白名单。不在这张表里的一律不许碰 ----
  // 每一项都要说清「怎么读」「怎么写」「界面上叫什么」，写入口集中在这里，
  // 免得以后加能力时到处散着改，哪天漏个校验就真把她的数据写坏了。
  // 页名对不对，只问 ThemeStudio.PAGES 那一份（它自己是从 core.js 的页名单派生的）
  const knownPage = (ts, id) => (ts.PAGES || []).some(x => x[0] === id);
  const badPage = (ts, id) => "没有「" + id + "」这一页。能改的是："
    + (ts.PAGES || []).filter(x => x[0] !== "all").map(x => x[0]).join("、");
  // 面具能写的几栏：跟面具页那张表同名
  const MASK_FIELDS = ["name", "label", "tagline", "persona", "appearance", "birthday"];
  // 新建角色那份 JSON → 只留认得的几栏
  function newCharObj(text) {
    let o = null;
    try { o = parseJSONLoose(text || ""); } catch (e) { o = null; }
    if (!o || typeof o !== "object" || Array.isArray(o)) return null;
    const out = { name: String(o.name || "").trim().slice(0, 24), persona: String(o.persona || "").trim().slice(0, 20000), appearance: String(o.appearance || "").trim().slice(0, 4000) };
    Object.keys(CARD_FIELDS).forEach(k => { if (o[k] != null && String(o[k]).trim()) out[k] = String(o[k]).trim().slice(0, 400); });
    return out;
  }
  // 关系图里的一头：她本人是 "me"，其余按 id、名字、备注认（角色和配角都算）
  const everyone = ctx => (ctx.allChars || ctx.characters || []);
  const whoId = (w, ctx) => {
    const v = String(w || "").trim();
    if (!v) return "";
    if (v === "me" || v === "我" || v === "她" || (ctx.profile && v === ctx.profile.name)) return "me";
    const c = everyone(ctx).find(x => x && (x.id === v || x.name === v || x.remark === v));
    return c ? c.id : "";
  };
  const whoName = (id, ctx) => id === "me" ? "我" : ((everyone(ctx).find(c => c && c.id === id) || {}).name || id);
  const relKey = (id, ctx) => {
    const m = String(id || "").split(/\s*(?:->|→)\s*/);
    if (m.length !== 2) return "";
    const a = whoId(m[0], ctx), b = whoId(m[1], ctx);
    return a && b && a !== b ? a + "->" + b : "";
  };
  const relName = (k, ctx) => { const p = String(k).split("->"); return whoName(p[0], ctx) + " → " + whoName(p[1], ctx); };
  const npcObj = (text, ctx) => {
    let o = null;
    try { o = parseJSONLoose(text || ""); } catch (e) { return null; }
    if (!o || typeof o !== "object") return null;
    const links = (Array.isArray(o.links) ? o.links : []).map(l => ({ id: whoId(l && (l.who || l.id), ctx), label: String((l && l.label) || "").trim() })).filter(l => l.id);
    const owner = o.owner ? whoId(o.owner, ctx) : "";
    return { name: String(o.name || "").trim().slice(0, 24), brief: String(o.brief || o.persona || "").trim(), ownerId: owner, links };
  };
  const BULK_OK = { lore: 1, rel: 1, npc: 1 };
  const TARGETS = {
    style: {
      zh: "线下文风预设",
      read: () => loadJ("x_offlineStyles", []).map(s => ({ id: s.key, name: s.name, text: s.prompt })),
      write: (id, patch, ctx) => {
        const list = loadJ("x_offlineStyles", []);
        const i = list.findIndex(x => x.key === id);
        const next = i >= 0
          ? list.map(x => x.key === id ? { ...x, name: patch.name || x.name, prompt: patch.text } : x)
          : list.concat([{ key: "custom_" + Date.now(), name: patch.name || "帮手写的文风", prompt: patch.text, custom: true }]);
        try { localStorage.setItem("x_offlineStyles", JSON.stringify(next)); } catch (e) { throw new Error("存不下了，可能是本地存储满了"); }
        return next.length;
      }
    },
    persona: {
      zh: "角色人设",
      read: ctx => (ctx.characters || []).map(c => ({ id: c.id, name: c.name, text: c.persona })),
      write: (id, patch, ctx) => {
        if (!ctx.onPatchCharacter) throw new Error("这个页面没接角色写入口");
        ctx.onPatchCharacter(id, { persona: patch.text });
        return 1;
      }
    },
    appearance: {
      zh: "角色外貌",
      read: ctx => (ctx.characters || []).map(c => ({ id: c.id, name: c.name, text: c.appearance })),
      write: (id, patch, ctx) => {
        if (!ctx.onPatchCharacter) throw new Error("这个页面没接角色写入口");
        ctx.onPatchCharacter(id, { appearance: patch.text });
        return 1;
      }
    },
    // 角色档案的其余栏（她 2026-09-03：「比如做 css 装修或者更新人物档案之类的」）
    // ⚠️field 必须在 CARD_FIELDS 里。不校验的话模型写个 "id" 或 "npc" 过来，
    // 一次 onPatchCharacter 就能把角色改坏——白名单开的是【栏】，不是整张卡。
    profile: {
      zh: "角色档案",
      read: ctx => (ctx.characters || []).map(c => ({ id: c.id, name: c.name, text: "", card: c })),
      write: (id, patch, ctx) => {
        if (!ctx.onPatchCharacter) throw new Error("这个页面没接角色写入口");
        const f = String(patch.field || "");
        if (!CARD_FIELDS[f]) throw new Error("档案里没有「" + (f || "空") + "」这一栏");
        ctx.onPatchCharacter(id, { [f]: patch.text });
        return 1;
      }
    },
    // 从头写一个新角色（她 2026-10-06：「能不能让秋秋可以写人设，从头开始的，然后可以落到人格档案馆里」）。
    //   text 是一份 JSON；只收名字、人设、外貌和档案里那几栏（CARD_FIELDS），别的键一律不认——
    //   落档走 app.js 那一个新建入口，跟人格档案馆右上角＋建出来的是同一种角色。
    // 关系线和配角（她 2026-10-10：「秋秋能不能编辑一下角色关系和创建 npc 啊然后把各种 npc 串联起来」）
    //   rel：id＝"A->B"（两头是角色/配角的 id 或名字，她本人写「我」），text＝关系；text 空着＝删掉这条；both:true 两个方向一起写。
    //   npc：text 是一份 JSON，落成走 app 那头的 addNpcLinked（跟配角页新建同一处）。
    rel: {
      zh: "关系",
      read: ctx => {
        const R = (ctx.relsOf && ctx.relsOf()) || {};
        return Object.keys(R).map(k => ({ id: k, name: relName(k, ctx), text: String((R[k] || {}).label || "") }));
      },
      write: (id, patch, ctx) => {
        if (!ctx.onSaveRel || !ctx.relsOf) throw new Error("这个页面没接关系的写入口");
        const key = relKey(id, ctx);
        if (!key) throw new Error("「" + id + "」两头得是认得出的人（名字、id，或者「我」）");
        const R = ctx.relsOf() || {}, label = String(patch.text || "").trim().slice(0, 60);
        const [a, b] = key.split("->");
        ctx.onSaveRel(key, label, (R[key] || {}).note || "");
        if (patch.both) ctx.onSaveRel(b + "->" + a, label, (R[b + "->" + a] || {}).note || "");
        return 1;
      }
    },
    npc: {
      zh: "新建配角",
      read: () => [],
      write: (id, patch, ctx) => {
        if (!ctx.onCreateNpc) throw new Error("这个页面没接新建配角的入口");
        const o = npcObj(patch.text, ctx);
        if (!o) throw new Error("这一条不是一份能读的配角 JSON");
        if (!o.name) throw new Error("配角得有个名字");
        if (!ctx.onCreateNpc(o)) throw new Error("没建成");
        return 1;
      }
    },
    newchar: {
      zh: "新建角色",
      read: () => [],
      write: (id, patch, ctx) => {
        if (!ctx.onCreateCharacter) throw new Error("这个页面没接新建角色的入口");
        const o = newCharObj(patch.text);
        if (!o) throw new Error("这一条不是一份能读的角色 JSON");
        if (!o.name) throw new Error("新角色得有个名字");
        if (!o.persona) throw new Error("新角色得有人设");
        ctx.onCreateCharacter(o);
        return 1;
      }
    },
    // 面具（她 2026-10-28：「面具也让秋秋能直接写」）：id＝main 是主面具，new 是新建一张副面具，别的照抄快照里的 id。
    //   text 是一份 JSON，只写要改的栏；没写的栏原样留着。存走面具页同一处（ctx.onSaveMainMask / ctx.onSaveMask）
    mask: {
      zh: "面具",
      read: ctx => {
        const main = ctx.mainMask ? ctx.mainMask() : null, pid = ctx.primaryMaskId ? ctx.primaryMaskId() : "";
        const others = ((ctx.masks && ctx.masks()) || []).filter(m => m && m.id && m.id !== pid);
        return (main ? [Object.assign({}, main, { id: "main" })] : []).concat(others).map(m => ({ id: m.id, name: (m.id === "main" ? "主面具 · " : "") + (String(m.label || "").trim() || m.name || "没起名的面具"), text: String(m.persona || "") }));
      },
      write: (id, patch, ctx) => {
        if (!ctx.onSaveMask || !ctx.onSaveMainMask) throw new Error("这个页面没接面具的写入口");
        let o = null; try { o = parseJSONLoose(patch.text || ""); } catch (e) { o = null; }
        if (!o || typeof o !== "object" || Array.isArray(o)) throw new Error("这一条不是一份能读的面具 JSON");
        const up = {};
        MASK_FIELDS.forEach(k => { if (o[k] != null) up[k] = String(o[k]).trim().slice(0, k === "persona" ? 20000 : k === "appearance" ? 4000 : 200); });
        if (!Object.keys(up).length) throw new Error("面具 JSON 里没有能写的栏（" + MASK_FIELDS.join("、") + "）");
        if (id === "main") { const p = Object.assign({}, ctx.mainMask ? ctx.mainMask() : {}, up); delete p.id; ctx.onSaveMainMask(p); return 1; }
        if (!id || id === "new") {
          if (!up.name) throw new Error("新面具得有个名字");
          ctx.onSaveMask(Object.assign({ id: "mk_" + Date.now(), name: "", label: "", tagline: "", persona: "", avatarImage: null, color: "#5a6a7d", birthday: "", appearance: "", refPhoto: null, photoOutfit: "", geoRealm: "" }, up));
          return 1;
        }
        const cur = ((ctx.masks && ctx.masks()) || []).find(m => m && m.id === id);
        if (!cur) throw new Error("面具里找不到 " + id + "；主面具写 main，新建写 new");
        ctx.onSaveMask(Object.assign({}, cur, up));
        return 1;
      }
    },
    // 界面装修：走主题工作台那一层，它自带 CSS 安全扫描和作用域前缀。
    // ⚠️别另写一套 CSS 校验——那就是「一层写在两处，第二处没跟上」。
    theme: {
      zh: "界面装修",
      read: () => {
        const ts = TS(); if (!ts) return [];
        const p = ts.load();
        return [{ id: "global", name: "全 App", text: p.globalCSS || "" }].concat(
          (ts.PAGES || []).filter(x => x[0] !== "all").map(x => ({ id: x[0], name: x[1], text: (p.pageCSS || {})[x[0]] || "" })));
      },
      write: (id, patch, ctx) => {
        const ts = TS(); if (!ts) throw new Error("主题工作台没加载出来");
        // ⚠️页名写错了要当场红：不校验的话它会静静存进一个谁也读不到的键，
        //   界面上还报「改好了」——那正是她说的「能改 css 是假的」。
        if (id !== "global" && !knownPage(ts, id)) throw new Error(badPage(ts, id));
        const bad = ts.unsafeReason(patch.text); if (bad) throw new Error(bad);
        const p = ts.load();
        const next = id === "global"
          ? { ...p, globalCSS: patch.text }
          : { ...p, pageCSS: { ...(p.pageCSS || {}), [id]: patch.text } };
        ts.compile(next);          // 编不过就在这儿抛，别等落库之后整个 App 变形
        ts.commit(next);
        return 1;
      }
    },
    // 这个聊天窗的气泡（她 2026-09-05：「让秋秋在这个人的悬浮屏里可以直接改动，
    // 比如我说帮我改一下我的气泡颜色，它就能帮我调好。或者我说我想要梦幻风格的它也能改」）。
    // ⚠️它改的是【某一个人的聊天窗】那一层，不是全局气泡——她开着谁的聊天窗，
    //   id 就填谁；这跟她在 ••• 里手动细调是同一个出口。
    // ⚠️text 是一份 JSON，不是散文：所以这一栏【不许走「改一小段」】（见 apply）——
    //   在 JSON 里替换一小段，出来的多半不再是合法 JSON。
    bubble: {
      zh: "聊天窗气泡",
      read: ctx => {
        const st = loadJ("x_chatSettings", {}) || {};
        return everyone(ctx).map(c => {
          const b = (st[c.id] || {}).bubble;
          return { id: c.id, name: c.name, text: b && typeof b === "object" ? bubbleText(b) : "（跟随全局，还没单独调过）" };
        });
      },
      write: (id, patch, ctx) => {
        if (!ctx.onPatchBubble) throw new Error("这个页面没接聊天窗写入口");
        let obj = null;
        try { obj = parseJSONLoose(patch.text || ""); } catch (e) { obj = null; }
        if (!obj) throw new Error("这一条不是一份能读的 JSON");
        // 洗那一道跟 OOC 那条路共用（engine.js）：模型给的值最后要拼进一张 <style>
        const clean = typeof sanitizeBubblePatch === "function" ? sanitizeBubblePatch(obj) : null;
        if (!clean) throw new Error("这份里没有一栏是能用的");
        ctx.onPatchBubble(id, clean);
        return 1;
      }
    },
    // 这一个人的聊天窗自己写的 CSS（她 2026-09-30：「秋秋应该也能全部 css 都写吧」）——
    //   就是聊天设置里「只给 TA 写 CSS」那一格。洗和限作用域都走 ThemeStudio 那一份，这里不另写。
    chatcss: {
      zh: "这个人聊天窗的 CSS",
      read: ctx => {
        const st = loadJ("x_chatSettings", {}) || {};
        return everyone(ctx).map(c => ({ id: c.id, name: c.name, text: (st[c.id] || {}).customCSS || "" }));
      },
      write: (id, patch, ctx) => {
        const ts = TS(); if (!ts) throw new Error("主题工作台没加载出来");
        if (!ctx.onPatchChatSetting) throw new Error("这个页面没接聊天窗写入口");
        const css = String(patch.text || "");
        const bad = ts.unsafeReason(css); if (bad) throw new Error(bad);
        ts.scopeCSS(css, "html");      // 编不过就在这儿抛，别等存进去整个聊天窗变形
        ctx.onPatchChatSetting(id, { customCSS: css });
        return 1;
      }
    },
    // 这一个人的聊天窗怎么排（排版开关 + 头像框/挂件），text 是 JSON，跟 bubble 一样不许「改一小段」
    chatlayout: {
      zh: "这个人聊天窗的排版",
      read: ctx => {
        const st = loadJ("x_chatSettings", {}) || {};
        return everyone(ctx).map(c => ({ id: c.id, name: c.name, text: JSON.stringify((st[c.id] || {}).layout || {}) }));
      },
      write: (id, patch, ctx) => {
        if (!ctx.onPatchChatSetting) throw new Error("这个页面没接聊天窗写入口");
        let obj = null;
        try { obj = parseJSONLoose(patch.text || ""); } catch (e) { obj = null; }
        if (!obj) throw new Error("这一条不是一份能读的 JSON");
        const st = loadJ("x_chatSettings", {}) || {};
        const cur = (st[id] || {}).layout || {};
        const known = JSON.stringify(cur).match(/iv_[A-Za-z0-9_-]+/g) || [];
        const clean = typeof sanitizeChatLayoutPatch === "function" ? sanitizeChatLayoutPatch(obj, known) : null;
        if (!clean) throw new Error("这份里没有一栏是能用的");
        const deco = Object.assign({}, cur.deco || {});
        Object.keys(clean.deco || {}).forEach(k => { deco[k] = Object.assign({}, deco[k] || {}, clean.deco[k]); });
        ctx.onPatchChatSetting(id, { layout: Object.assign({}, cur, clean, { deco: deco }) });
        return 1;
      }
    },
    // 这一个人线下那层的 CSS（她 2026-10-05：秋秋说「系统没给我线下 CSS 的权限」）——
    //   存在 x_offlineSettings[charId].customCSS，跟线下设置里「这个人的线下长什么样」是同一格
    offlinecss: {
      zh: "这个人线下的 CSS",
      read: ctx => {
        const st = loadJ("x_offlineSettings", {}) || {};
        return everyone(ctx).map(c => ({ id: c.id, name: c.name, text: (st[c.id] || {}).customCSS || "" }));
      },
      write: (id, patch, ctx) => {
        const ts = TS(); if (!ts) throw new Error("主题工作台没加载出来");
        if (!ctx.onPatchOfflineSetting) throw new Error("这个页面没接线下写入口");
        const css = String(patch.text || "");
        const bad = ts.unsafeReason(css); if (bad) throw new Error(bad);
        ts.scopeCSS(css, "html");
        ctx.onPatchOfflineSetting(id, { customCSS: css });
        return 1;
      }
    },
    // 某一个群的 CSS 和排版（她 2026-09-30：「接吧」）——跟单聊那两栏同一个形状，只是存在这个群的设置里
    groupcss: {
      zh: "这个群聊天窗的 CSS",
      read: ctx => {
        const st = loadJ("x_groupSettings", {}) || {};
        return (ctx.groups || []).map(g => ({ id: g.id, name: g.name, text: (st[g.id] || {}).customCSS || "" }));
      },
      write: (id, patch, ctx) => {
        const ts = TS(); if (!ts) throw new Error("主题工作台没加载出来");
        if (!ctx.onPatchGroupSetting) throw new Error("这个页面没接群聊写入口");
        if (!(ctx.groups || []).some(g => g && g.id === id)) throw new Error("没有这个群：" + id);
        const css = String(patch.text || "");
        const bad = ts.unsafeReason(css); if (bad) throw new Error(bad);
        ts.scopeCSS(css, "html");
        ctx.onPatchGroupSetting(id, { customCSS: css });
        return 1;
      }
    },
    grouplayout: {
      zh: "这个群聊天窗的排版",
      read: ctx => {
        const st = loadJ("x_groupSettings", {}) || {};
        return (ctx.groups || []).map(g => ({ id: g.id, name: g.name, text: JSON.stringify((st[g.id] || {}).layout || {}) }));
      },
      write: (id, patch, ctx) => {
        if (!ctx.onPatchGroupSetting) throw new Error("这个页面没接群聊写入口");
        if (!(ctx.groups || []).some(g => g && g.id === id)) throw new Error("没有这个群：" + id);
        let obj = null;
        try { obj = parseJSONLoose(patch.text || ""); } catch (e) { obj = null; }
        if (!obj) throw new Error("这一条不是一份能读的 JSON");
        const st = loadJ("x_groupSettings", {}) || {};
        const cur = (st[id] || {}).layout || {};
        const known = JSON.stringify(cur).match(/iv_[A-Za-z0-9_-]+/g) || [];
        const clean = typeof sanitizeChatLayoutPatch === "function" ? sanitizeChatLayoutPatch(obj, known) : null;
        if (!clean) throw new Error("这份里没有一栏是能用的");
        const deco = Object.assign({}, cur.deco || {});
        Object.keys(clean.deco || {}).forEach(k => { deco[k] = Object.assign({}, deco[k] || {}, clean.deco[k]); });
        ctx.onPatchGroupSetting(id, { layout: Object.assign({}, cur, clean, { deco: deco }) });
        return 1;
      }
    },
    // 某一页整页换调子（v65.06，她 2026-09-06：「全部能做主题的页面秋秋都应该可以改」）。
    // ⚠️为什么这件事不走 CSS：各页正文里的卡片、按钮、列表都是各页自己内联写的、
    //   没有挂点，CSS 抓不住它们；而它们的颜色全是从同一份 token 里取的。
    //   所以「把这一页换个调子」走这一栏，一个挂点都不需要，每一页都成立。
    // ⚠️洗那一道用 ThemeStudio.cleanTokens，别在这儿另写一份白名单。
    pagecolor: {
      zh: "某一页的配色",
      read: () => {
        const ts = TS(); if (!ts) return [];
        const cur = (ts.current() || {}).pageTokens || {};
        return (ts.PAGES || []).filter(x => x[0] !== "all")
          .map(x => ({ id: x[0], name: x[1], text: JSON.stringify(cur[x[0]] || {}) }));
      },
      write: (id, patch) => {
        const ts = TS(); if (!ts) throw new Error("主题工作台没加载出来");
        if (!knownPage(ts, id)) throw new Error(badPage(ts, id));
        // ⚠️自己写死一套配色的那几页：改这几支色它一点变化都不会有——
        //   当场拒掉，别报「改好了」（她 2026-09-07 撞上的正是这种假成功）。
        const own = (ts.OWN_PALETTE || {})[id];
        if (own) throw new Error("「" + id + "」这一页的颜色不是从主题里取的（" + own
          + "），给它换这几支色不会有任何变化。跟她说实话：这一页要能换色，得先把它接到主题上——那是一次施工，不是一条改动稿。");
        let obj = null;
        try { obj = parseJSONLoose(patch.text || ""); } catch (e) { obj = null; }
        if (!obj || typeof obj !== "object") throw new Error("这一条不是一份能读的 JSON");
        const p = ts.load(), cur = { ...((p.pageTokens || {})[id] || {}) };
        // 给了空值＝把那一支还给全局（不然「改回原样」这件事没法说）
        Object.keys(obj).forEach(k => { const v = obj[k]; if (v === "" || v == null) delete cur[k]; else cur[k] = v; });
        const clean = ts.cleanTokens(cur);
        if (!Object.keys(clean).length && !Object.keys((p.pageTokens || {})[id] || {}).length) {
          throw new Error("这份里没有一支能用的颜色。只收这几支：" + (ts.TOKEN_KEYS || []).join("、") + "；值要写成 #色号");
        }
        const all = { ...(p.pageTokens || {}) };
        if (Object.keys(clean).length) all[id] = clean; else delete all[id];
        ts.commit({ ...p, pageTokens: all });
        return Object.keys(clean).length || 1;
      }
    },
    // 某一层美化退一步／换回来（她 2026-10-05：「也可以让秋秋退」）——跟设置页那颗「↶ 回到上一版」是同一本账
    //   （engine.js LookHist），自己改的、秋秋改的都在里面。id＝chat:角色id／group:群id／offline:角色id／theme；
    //   text 写「退一步」或「换回来」。
    lookundo: {
      zh: "美化退回上一版",
      read: ctx => {
        if (typeof LookHist !== "object") return [];
        const nm = (kind, id) => {
          if (kind === "theme") return "主题工作台（全 App 和各页的 CSS、配色、字体）";
          if (kind === "group") { const g = (ctx.groups || []).find(x => x && x.id === id); return "群「" + ((g && g.name) || id) + "」的聊天窗"; }
          const c = (ctx.characters || []).find(x => x && x.id === id);
          return ((c && c.name) || id) + (kind === "offline" ? " 的线下" : " 的聊天窗");
        };
        return LookHist.scopes().map(x => {
          const i = x.scope.indexOf(":"), kind = i < 0 ? x.scope : x.scope.slice(0, i), id = i < 0 ? "" : x.scope.slice(i + 1);
          return { id: x.scope, name: nm(kind, id), text: "能退 " + x.back + " 步" + (x.fwd ? "，能换回来 " + x.fwd + " 步" : "") };
        });
      },
      write: (id, patch, ctx) => {
        const dir = /换回|重做|前进|redo|fwd/i.test(String(patch.text || "")) ? "fwd" : "back";
        const sc = String(id || "");
        if (sc === "theme") {
          const ts = TS(); if (!ts || !ts.undoStep) throw new Error("主题工作台没加载出来");
          if (!ts.undoStep(dir)) throw new Error(dir === "fwd" ? "主题那边没有能换回来的了" : "主题那边没有更早的版本了");
          return 1;
        }
        const i = sc.indexOf(":"), kind = sc.slice(0, i), cid = sc.slice(i + 1);
        if (i < 0 || !WIN_STORE[kind] || !cid) throw new Error("不认识这一层：" + sc + "（要写成 chat:角色id、group:群id、offline:角色id 或 theme）");
        if (typeof LookHist !== "object") throw new Error("美化的版本本子没加载出来");
        const row = LookHist.step(sc, winLook(kind, cid), dir);
        if (!row) throw new Error(dir === "fwd" ? "这一层没有能换回来的了" : "这一层没有更早的版本了");
        writeLook(kind, cid, row.v, ctx);
        return 1;
      }
    },
    // 秋秋退掉自己改过的某一条（她 2026-10-05：「秋秋也可以自己退它做错的」）——
    //   就是改动卡上那颗「撤回」，id 是快照里「你改过的」那一条的编号。
    undo: {
      zh: "撤回我改过的一条",
      read: () => loadUndo().filter(x => x && !x.undone).map(x => ({ id: x.uid, name: x.title || x.label, text: x.label })),
      write: (id, patch, ctx) => { undo(id, ctx); return 1; }
    },
    // 长期准则（她经 OOC 立的那几条，角色和群都有；她 2026-10-07：「把 ooc 权限给秋秋放开吧」）。
    //   一行一条，整份给：改一条、删一条、加一条都是把这一份重写一遍。存在 x_directives 里（OOC 那一路写的同一份）。
    rules: {
      zh: "长期准则",
      read: ctx => {
        const d = loadJ("x_directives", {}) || {};
        const line = id => (Array.isArray(d[id]) ? d[id] : []).map(x => String((x && x.text) || "").trim()).filter(Boolean).join("\n");
        return (ctx.characters || []).map(c => ({ id: c.id, name: c.name, text: line(c.id) }))
          .concat((ctx.groups || []).map(g => ({ id: g.id, name: "群「" + g.name + "」", text: line(g.id) })));
      },
      write: (id, patch, ctx) => {
        if (!ctx.onSetDirectives) throw new Error("这个页面没接准则写入口");
        const lines = String(patch.text || "").split("\n").map(x => x.replace(/^[-·•\d.、\s]+/, "").trim()).filter(Boolean);
        ctx.onSetDirectives(id, lines);
        return lines.length || 1;
      }
    },
    // 世界书（她 2026-10-10：「秋秋能不能导入和修改世界书」）：改一条、新建一条、把她发来的文件拆成几条导进去。
    //   id＝new 是新建；其余照快照里那条的 id。关键词／常驻／绑谁跟着 patch 走，没写就保持原样。
    lore: {
      zh: "世界书词条",
      // 分类、去哪几处（她 2026-10-14「知道世界书有什么用、照做」）：跟世界书页同一份分类名、同一套章
      read: ctx => ((ctx.loreList && ctx.loreList()) || []).map(e => ({ id: e.id, name: e.title, text: e.payload })),
      write: (id, patch, ctx) => {
        if (!ctx.onSaveLore || !ctx.loreList) throw new Error("这个页面没接世界书写入口");
        const list = ctx.loreList() || [];
        const chars = ctx.characters || [];
        const bindIds = String(patch.bind || "").split(/[,，、\s]+/).map(x => x.trim()).filter(Boolean)
          .map(x => (chars.find(c => c.id === x || c.name === x || c.remark === x) || {}).id).filter(Boolean);
        const kw = patch.keyword != null ? String(patch.keyword).split(/[,，、]/).map(x => x.trim()).filter(Boolean).join(",") : null;
        const extra = e => Object.assign({},
          kw != null ? { keyword: kw } : {},
          patch.always != null ? { alwaysOn: !!patch.always } : (kw != null ? { alwaysOn: !kw } : {}),
          bindIds.length ? { charIds: bindIds } : {},
          LORE_CATS.indexOf(String(patch.cat || "").trim()) >= 0 ? { category: String(patch.cat).trim() } : {},
          /^[1-5]$/.test(String(patch.priority || "").trim()) ? { priority: Number(patch.priority) } : {},
          stampsOf(patch.stamps, e));
        if (!id || id === "new") {
          const e = Object.assign({ id: "le_" + Date.now() + "_" + Math.floor(Math.random() * 1000), title: String(patch.name || "").trim() || "秋秋写的设定",
            payload: String(patch.text || ""), keyword: "", alwaysOn: true, enabled: true, priority: 3, ensemble: false, ts: Date.now() }, extra({}));
          ctx.onSaveLore([e].concat(list));
          return 1;
        }
        if (!list.some(e => String(e.id) === String(id))) throw new Error("世界书里找不到这一条了");
        ctx.onSaveLore(list.map(e => String(e.id) === String(id)
          ? Object.assign({}, e, { payload: String(patch.text || "").trim() ? String(patch.text) : e.payload, title: String(patch.name || "").trim() || e.title, ts: Date.now() }, extra(e)) : e));
        return 1;
      }
    },
    memory: {
      zh: "记忆库条目",
      read: () => [],                       // 记忆是往里加，不是改现有的
      write: (id, patch, ctx) => {
        if (!ctx.onAddMemories) throw new Error("这个页面没接记忆写入口");
        const items = String(patch.text || "").split("\n").map(x => x.replace(/^[-·•\d.、\s]+/, "").trim()).filter(Boolean);
        if (!items.length) throw new Error("没有可写入的条目");
        ctx.onAddMemories(id, items);       // id = charId
        return items.length;
      }
    }
  };

  // 秋秋多管的几样（聊天设置、小房间开关、记忆库改删、衣柜、日历）住在 assistant-extras.js，并进同一张表
  if (typeof window !== "undefined" && window.AssistExtras) Object.assign(TARGETS, window.AssistExtras.TARGETS);

  // ---- 坏 JSON 里把改动卡一张张抠回来 ----
  //   字段名单就是 apply 认的那几个；text 这种长的读到「下一个字段名」或「这张卡收尾」为止，
  //   所以里头夹着没转义的双引号（CSS 选择器、HTML 属性）也能整段拿回来。
  const LORE_CATS = ["世界观", "地点", "组织", "人物", "规则", "共同经历", "用语", "照做", "生图", "其他"];
  // stamps：「聊天与线下、日记」这样的中文章名 → e.scope；不填不动。chat 默认是开的，没列就明写 false
  const stampsOf = (txt, e) => {
    const t = String(txt || "").trim(); if (!t) return {};
    const ZH = (window.AssistExtras && window.AssistExtras.LORE_STAMPS) || {};
    const want = t.split(/[,，、\s]+/).map(x => x.trim()).filter(Boolean).map(x => Object.keys(ZH).find(k => k === x || ZH[k] === x || ZH[k].indexOf(x) === 0)).filter(Boolean);
    if (!want.length) return {};
    const scope = Object.assign({}, (e && e.scope) || {});
    Object.keys(ZH).forEach(k => { scope[k] = want.indexOf(k) >= 0; });
    return { scope };
  };
  const PATCH_KEYS = ["target", "id", "field", "find", "append", "whole", "title", "name", "text", "why", "both", "keyword", "keywords", "always", "bind", "drop", "date", "occasion", "view", "type", "time", "done", "yearly", "cat", "stamps", "priority"];
  const unJ = v => String(v).replace(/\\n/g, "\n").replace(/\\t/g, "\t").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  function salvageField(chunk, key) {
    const re = new RegExp('"' + key + '"\\s*:\\s*');
    const m = re.exec(chunk); if (!m) return "";
    let i = m.index + m[0].length;
    if (chunk[i] !== '"') { const lit = /^(true|false|null|-?\d+(?:\.\d+)?)/.exec(chunk.slice(i)); return lit ? lit[1] : ""; }
    i++;
    const others = PATCH_KEYS.concat(["reply", "patches", "file", "code"]).filter(k => k !== key).join("|");
    const end = new RegExp('"\\s*,\\s*"(?:' + others + ')"\\s*:|"\\s*\\}\\s*,?\\s*(?:\\{|\\]|$)');
    const rest = chunk.slice(i), e = end.exec(rest);
    return unJ(e ? rest.slice(0, e.index) : rest.replace(/"\s*\}?\s*\]?\s*\}?\s*$/, ""));
  }
  function salvagePatches(raw) {
    const s = String(raw || "");
    const starts = []; const re = /\{\s*"target"\s*:/g; let m;
    while ((m = re.exec(s))) starts.push(m.index);
    return starts.map((st, k) => {
      const chunk = s.slice(st, k + 1 < starts.length ? starts[k + 1] : s.length);
      const o = {};
      PATCH_KEYS.forEach(key => { const v = salvageField(chunk, key); if (v !== "") o[key] = v === "true" ? true : v === "false" ? false : v; });
      return o.target ? o : null;
    }).filter(Boolean);
  }

  // ---- 代码/框架那道门（她 2026-09-03 点名的那条）----
  // 判的是【这东西怎么造出来的】，不是【这东西哪儿不对劲】：
  // 她说「购物有 bug」是在报毛病，那要答；问「用什么框架写的」才回绝。
  // 所以 bug / 报错 / 不生效 一个都不在这张表里。
  // ⚠️也不许把「API」「接口」整个拉黑——设置里那一屏就叫接口配置，
  //   拉黑等于她问「API 怎么配」都会被顶回来。
  // ⚠️这道门只拦【一看就是在问代码】的：她 2026-10-16 截图——「好多小红书 repo 都叫他小乐」（repo＝返图）被当成问仓库顶了回来。
  //   日常里也会说的词一律不在这儿拦：框架（世界观框架）、循环（循环播放）、分支（分支剧情）、部署、开源、前端、数据库、repo、git……
  //   这些交给模型自己按上下文判断（提示词里「不答怎么造出来的」那条照旧管着）。
  const CODE_SIGNS = [
    /源代码|源码|写代码|代码怎么|什么代码|\bsource code\b/i,
    /技术栈|底层实现|怎么实现的|用什么写的|用什么做的|用的什么语言|什么框架写的|用什么框架|用的什么框架|哪个框架做的/,
    /\breact\b|\bvue\b|\bsvelte\b|\bangular\b|\bjquery\b|\btailwind\b/i,
    /javascript|typescript|\bjsx\b|\bnpm\b|\bwebpack\b|\bvite\b|\bnode\.js\b/i,
    /仓库地址|github|localstorage|indexeddb|存储键/i,
    /[\w-]+\.(js|mjs|ts|jsx|html|json)\b/i
  ];
  // 命中就当场回绝，一次调用都不花（她按次计费，这也是替她省钱）
  // 美化那一路是放行的：「这段 CSS 代码帮我改改」问的是样子，不是 App 怎么造的（她 2026-10-05）
  const LOOK_TALK = /\bcss\b|美化|装修|皮肤|样式|挂点|data-wk/i;
  function codeQuestion(text) {
    const s = String(text || "");
    if (LOOK_TALK.test(s)) return false;
    return CODE_SIGNS.some(re => re.test(s));
  }
  const CODE_REPLY = "这个我不答——我只管这个世界里【怎么玩】，不管它是怎么造出来的。\n"
    + "你要是想改哪儿的样子或者哪个角色的档案，直接跟我说，我动手改给你看。";

  // 答完再洗一遍：正文里不许出现代码块。
  // ⚠️只洗 reply。装修那一栏的 CSS 在 patch.text 里，那是它在动手，不洗。
  // ⚠️别只指望剥围栏（```）：模型的回复要先过 extractJSON，那一步会把所有围栏
  //   全局删掉再解析 JSON——等到这儿，围栏早没了，剩下的是【裸的代码行】。
  //   实测就是这么漏出去的。所以真正兜底的是下面那条「没有中文又带这些符号＝代码」。
  const CJK = /[一-鿿]/;
  const FENCE_TAG = /^(css|js|jsx|ts|tsx|html|json|javascript|typescript|python|bash|sh|shell)$/i;
  function scrubCode(reply) {
    let s = String(reply || "");
    s = s.replace(/```[\s\S]*?```/g, "（这段我不贴）");
    s = s.replace(/```[\s\S]*$/g, "（这段我不贴）");
    s = s.split("\n").filter(line => {
      const q = line.trim();
      if (!q) return true;
      if (FENCE_TAG.test(q)) return false;                 // 围栏被剥掉之后剩下的那个语言名
      if (!CJK.test(q) && /[{};]|=>|===/.test(q)) return false;  // 一句中文都没有还带这些符号
      // 单独一行的 { 或 } 要另起一条规则：写成 `\}\b` 是不管用的——
      // } 后面就是行尾，两边都不是单词字符，\b 压根不成立，那一行会原样留下。
      if (/^\s*[{}]\s*;?\s*$/.test(q)) return false;
      return !/^\s*(const|let|var|function|import|export|return|class|if\s*\(|for\s*\(|<\/?[a-zA-Z][\w-]*)\b/.test(q);
    }).join("\n");
    return s.replace(/\n{3,}/g, "\n\n").trim();
  }

  // ---- 现状快照：让它看得见 app 此刻的样子，才谈得上「诊断」 ----
  // 她 2026-09-03：「我之前问它人设的事它说看不到全部，改成它能看也能直接帮我改吧」。
  //
  // v61.05 我拿群聊那一层的额度来截（groupPersonaBudget），还是不行——
  // ⚠️**借层要连它的理由一起借。** 那个额度是【按在场人数分总预算】：群里五个人，
  //   一份 system 里装五张卡，所以要摊。可这份快照里装的是【她所有的角色】，
  //   二十来张卡摊下来每张只剩 1500 字（地板），V 的卡照样断在半截，
  //   它照样说「我不能把半截当全文直接出 patch」。理由没跟过来，数就是错的。
  //
  // 真正的判据是：**她这会儿在说谁，那张卡就必须是全的。**
  //   · 她（或最近几句里）点到名字的那张 → 全文，单张封顶 20000（比她最长的卡还宽）
  //   · 全部加起来装得下 → 索性全给（角色少的时候本来就没必要挑）
  //   · 剩下那些 → 只给个开头，并且【在这张卡上写明它不完整】——
  //     不写明的话它只能靠猜，猜错就是拿半截去改她攒了很久的东西。
  const SNAP_ONE = 20000;      // 单张卡封顶
  const SNAP_TOTAL = 24000;    // 加起来不超过这个数就全给
  const SNAP_BRIEF = 300;      // 给不下的那些留个开头，够它认出这是谁
  const clipRaw = (v, n) => { const x = String(v == null ? "" : v).trim(); return x.length <= n ? x : x.slice(0, n); };

  // 哪几张卡要给全文：在这段对话里【被提到过】的，按最后一次提到的位置排，最近的优先。
  // ⚠️只看当前这一句是不够的——她上一句常常是「宝宝你再看看呢」，名字在前面提的。
  //   所以拿【要发给模型的那整段窗口】来找：说过的名字都算，这才叫「在说谁」。
  //   同时封个数，不然一段长对话里提过八个角色，八张全卡一起塞进去。
  const SNAP_FULL_MAX = 4;
  const SNAP_CHAT_N = 40;   // 给秋秋看最近几条（只给正在说的那几个人）
  function focusIds(list, focus, max) {
    const f = String(focus || "");
    const hit = [];
    (list || []).forEach(c => {
      const n = c && c.name ? String(c.name) : "";
      if (!n) return;
      const at = f.lastIndexOf(n);
      if (at >= 0) hit.push({ id: c.id, at: at });
    });
    hit.sort((a, b) => b.at - a.at);
    return new Set(hit.slice(0, max || SNAP_FULL_MAX).map(x => x.id));
  }

  function snapshot(ctx, focus) {
    const list = ctx.characters || [];
    const bulk = list.reduce((n, c) => n + String(c.persona || "").length + String(c.appearance || "").length, 0);
    const allFit = bulk <= SNAP_TOTAL;
    const hot = focusIds(list, focus, SNAP_FULL_MAX);
    const chars = list.map(c => {
      const full = allFit || hot.has(c.id);
      const per = String(c.persona || "").trim(), app = String(c.appearance || "").trim();
      const row = {
        名字: c.name, id: c.id,
        一句话简介: clip(c.tagline, 80) || "（空）",
        人设: full ? clipRaw(per, SNAP_ONE) : (clipRaw(per, SNAP_BRIEF) || "（空）"),
        外貌: full ? clipRaw(app, 4000) : (clipRaw(app, 120) || "（空）"),
        生日: c.birthday || "（空）", 性别: c.gender || "（没填，一律用 TA）",
        出图定妆: clip(c.photoCanon, 200) || "（空）",
        出图常服: clip(c.photoOutfit, 200) || "（空）",
        出图配饰: clip(c.photoAccessories, 200) || "（空）",
        有参考照: !!c.refPhoto, 出图画风: c.photoStyle || "realistic"
      };
      // 记下这一轮给它看过多少字：整段替换之前拿它兜一道（见 apply）
      shownLen[shownKey("persona", c.id)] = row.人设.length;
      shownLen[shownKey("appearance", c.id)] = row.外貌.length;
      // 完整与否必须写在卡上，不许让它猜
      row.这张卡是否完整 = full && per.length <= SNAP_ONE;
      if (!row.这张卡是否完整) {
        row.注意 = full
          ? "这一份长得超出了单张上限，尾巴被截了。别照这一份出 patch，跟她说一声。"
          : "这里只给了开头 " + SNAP_BRIEF + " 字。要改这张卡就跟她确认是谁，下一轮你就会拿到全文——别照这半截改。";
      }
      return row;
    });
    const styles = loadJ("x_offlineStyles", []).map(s => ({ 名称: s.name, id: s.key, 字数: String(s.prompt || "").length }));
    const offSet = loadJ("x_offlineSettings", {});
    const errs = (typeof window !== "undefined" && window.__errLog ? window.__errLog : []).slice(-5)
      .map(e => clip(e && e.msg, 120));
    // 聊天窗的长相现在是什么（她 2026-09-30：让秋秋改单聊/群聊的 CSS 和排版）——不给它看，它只能照空白重写、把她原来的盖掉
    const cs = loadJ("x_chatSettings", {}) || {}, gsAll = loadJ("x_groupSettings", {}) || {}, offAll = loadJ("x_offlineSettings", {}) || {};
    // 长期准则（她经 OOC 立的）：原来快照里没有，她问「是不是哪条规矩把TA架住了」时秋秋只能说看不到（2026-10-07）
    const dirs = loadJ("x_directives", {}) || {};
    const dirOf = id => (Array.isArray(dirs[id]) ? dirs[id] : []).map(x => String((x && x.text) || "").trim()).filter(Boolean);
    chars.forEach(row => { const l = dirOf(row.id); row.长期准则 = l.length ? l : "（没有）"; });
    // 最近聊天（她 2026-10-07：「最近聊天也给它看吧」）：只给【这会儿在说的那几个人】——
    //   跟人设给全文是同一个判据（hot）；全员都给太长，也用不上。
    if (typeof ctx.recentChatFor === "function") chars.forEach(row => {
      if (!hot.has(row.id)) return;
      const rows = ctx.recentChatFor(row.id, SNAP_CHAT_N) || [];
      row.最近聊天 = rows.length ? rows : "（还没聊过）";
    });
    chars.forEach(row => {
      const st = cs[row.id] || {};
      row.聊天窗排版 = st.layout ? JSON.stringify(st.layout).replace(/"(data:image[^"]{0,40})[^"]*"/g, '"$1…"') : "（原样）";
      row.聊天窗CSS = st.customCSS ? clipRaw(st.customCSS, 3000) : "（空）";
      // 线下那层的 CSS 也给它看（她 2026-10-26：秋秋说快照里看不到她线下写了哪段，没法改）
      const os = offAll[row.id] || {};
      row.线下CSS = os.customCSS ? clipRaw(os.customCSS, 3000) : "（空）";
    });
    const groups = (ctx.groups || []).map(g => {
      const st = gsAll[g.id] || {};
      const gl = dirOf(g.id);
      return { 群名: g.name, id: g.id, 群规矩: gl.length ? gl : "（没有）",
        排版: st.layout ? JSON.stringify(st.layout).replace(/"(data:image[^"]{0,40})[^"]*"/g, '"$1…"') : "（原样）",
        CSS: st.customCSS ? clipRaw(st.customCSS, 3000) : "（空）" };
    });
    // 美化能退几步、你自己改过哪几条（她 2026-10-05：「也可以让秋秋退，秋秋也可以自己退它做错的」）
    const lookBack = TARGETS.lookundo.read(ctx).map(x => ({ id: x.id, 哪一层: x.name, 存着: x.text }));
    const mine = TARGETS.undo.read(ctx).slice(0, 12).map(x => ({ id: x.id, 改的是: x.name }));
    // 世界书：总量不大就整份给；多了就每条只给开头，被改的那条下一轮再给全文（apply 拿 shownLen 兜整段替换）
    const loreAll = (ctx.loreList && ctx.loreList()) || [];
    const loreFit = loreAll.reduce((n, e) => n + String((e && e.payload) || "").length, 0) <= 16000;
    const nameOf = id => ((ctx.characters || []).find(c => c.id === id) || {}).name || id;
    const lore = loreAll.slice(0, 80).map(e => {
      const body = loreFit ? String(e.payload || "") : clipRaw(String(e.payload || ""), 300);
      shownLen[shownKey("lore", e.id)] = body.length;
      return { id: e.id, 标题: e.title || "（无题）", 关键词: e.keyword || (e.alwaysOn ? "（常驻）" : "（无）"), 启用: e.enabled !== false,
        绑给: Array.isArray(e.charIds) && e.charIds.length ? e.charIds.map(nameOf) : "所有人", 正文: body,
        这条是否完整: body.length >= String(e.payload || "").length };
    });
    // 配角和关系线（她 2026-10-10）：关系不多就整张给；多了只给跟这会儿在说的人沾边的那几条
    const npcs = (ctx.allChars || []).filter(c => c && c.npc).slice(0, 60).map(c => ({ 名字: c.name, id: c.id,
      在谁身边: c.ownerId === "me" ? "我" : c.ownerId ? whoName(c.ownerId, ctx) : "（不挂在谁身边）", 认识她本人: !!c.knowsUser, 简介: clip(c.persona, 120) || "（空）" }));
    const R = (ctx.relsOf && ctx.relsOf()) || {}, rk = Object.keys(R);
    const hotAll = focusIds(ctx.allChars || list, focus, 12);
    const relRows = rk.filter(k => rk.length <= 120 || k.split("->").some(x => hotAll.has(x) || hot.has(x))).slice(0, 160)
      .map(k => ({ id: k, 谁: relName(k, ctx), 关系: String((R[k] || {}).label || "") }));
    // 面具：主面具 id 是 main；人设总量不大就整份给
    const maskAll = TARGETS.mask.read(ctx), maskFit = maskAll.reduce((n, m) => n + m.text.length, 0) <= 12000;
    const maskRows = maskAll.slice(0, 20).map(m => ({ id: m.id, 名字: m.name, 人设: maskFit ? (m.text || "（空）") : clipRaw(m.text, 300), 这张是否完整: maskFit || m.text.length <= 300 }));
    return { 角色: chars, 群: groups, 面具: maskRows.length ? maskRows : ["（还没有面具）"], 配角: npcs.length ? npcs : ["（还没有配角）"], 关系: relRows.length ? relRows : ["（还没连过关系）"], 已存的文风预设: styles, 线下设置: offSet, 世界书: lore.length ? lore : ["（还没有词条）"],
      美化能退回的: lookBack.length ? lookBack : ["（还没有存下的旧版本）"], 你改过还能撤回的: mine.length ? mine : ["（没有）"],
      最近报错: errs.length ? errs : ["（本次开机没抓到报错）"],
      ...(/mcp|MCP|转接|工具.{0,4}(连|调|用)不/.test(String(focus || "")) && typeof window !== "undefined" && window.MCP && window.MCP.status ? { MCP现状: window.MCP.status(),
        MCP怎么看: "对着「这次开机」那栏说哪台卡在哪：提到跨域/CORS 或连不上＝服务端没放行网页，填转接地址绕过去；是旧的sse 又没填转接＝网页直连不了，得先搭转接；HTTP 401/403＝令牌没填或填错；404＝地址路径不对；转接连不上＝Worker 没部署好或地址抄错。还没试过＝让她去设置里那台点「测一下」再来。别编没看到的原因。" } : {}),
      ...(typeof window !== "undefined" && window.AssistExtras ? pruneExtra(window.AssistExtras.snapshotExtra(ctx, hot), focus) : {}) };
  }

  // 快照里那几大块按需带（她 2026-10-17「是不是喂太多东西了回复好慢」）：
  //   记忆库、衣柜、日历、行程这些，只有这会儿聊到（她这句或前面几句里提了）才放进去；没提就只留一行说这轮没带。
  const EXTRA_WHEN = {
    记忆库: /记忆|记得|记住|忘|回忆|memory/i, 衣柜: /衣|穿|外套|裙|裤|鞋|搭配|造型/, 日历: /日历|纪念日|几号|生日|日子|提醒|节日|周年/,
    行程: /行程|日程|安排|在干嘛|在干什么|去哪|几点|今天.{0,6}(干|做)/, 情侣空间: /空间|情侣|恋人|闺蜜|挚友|家人|愿望|档案|申请信|邀请|情书|在一起/,
    表情包: /表情/, 小房间: /房间/, 线下设置: /线下|见面/, 桌面布局: /桌面|主屏|组件|图标/
  };
  function pruneExtra(o, focus) {
    const f = String(focus || ""), skipped = [];
    Object.keys(EXTRA_WHEN).forEach(k => { if (o && k in o && !EXTRA_WHEN[k].test(f)) { delete o[k]; skipped.push(k); } });
    if (skipped.length) o.这轮没带的 = skipped.join("、") + "（她这会儿没聊到；她一提起，下一轮就带上。别凭空猜里面有什么）";
    return o;
  }

  // ---- 让它按固定形状说话：正文 + 改动稿 ----
  // 写 CSS 之前必须知道的三件事（v64.82，她 2026-09-06：「秋秋这个能改 css 是假的，
  // 应用了也不改」）。原来这一栏只说了一句「text 是 CSS」——模型当然不知道
  // 这个 App 的样式是内联的、页面 CSS 会被自动加作用域、也不知道有哪些钩子，
  // 于是自己发明了 `.theme-stylelab [data-page="stylelab"]`，写完一条都不生效。
  // ⚠️钩子清单只有 ThemeStudio 那一份（WK_COMMON + WK_SCOPED），这儿不另抄（抄了迟早对不上）。
  //   专有那几组是一张表，来第三组第四组也不用改这儿——照着表念就是了。
  // 这一页【实测】有哪些挂点——直接扫 DOM（v65.09）。
  // ⚠️上面那两份清单说的是「共用组件上挂了什么」，可有些页面自己手写了顶栏和控件，
  //   那几个挂点在它身上压根不存在。她 2026-09-06 就是这么撞上的：让秋秋给文风台写
  //   主题 CSS，[data-wk="head"]/headink/headdim/field/input 一条都没落地，
  //   看上去像「秋秋写的应用不出来」。清单不实测就是一张会骗人的地图。
  // ⚠️扫的是【她此刻正开着的那一页】。整屏打开秋秋时，DOM 就是秋秋自己那一页，
  //   说了反而是错的——那种时候什么都不说。
  function wkHere() {
    try {
      if (typeof document === "undefined") return "";
      const page = document.documentElement.getAttribute("data-lisa-screen") || "";
      if (!page || page === "assistant") return "";
      const seen = {};
      document.querySelectorAll("[data-wk]").forEach(function (el) {
        const k = el.getAttribute("data-wk"); if (k) seen[k] = (seen[k] || 0) + 1;
      });
      const names = Object.keys(seen).sort();
      if (!names.length) return "";
      return "  【她此刻开着的这一页（" + page + "）上，实测真有的挂点】" + names.join("、") + "\n"
        + "  ⚠️没出现在这一行里的，这一页就是没有——给它写规则一条都不会生效。\n"
        + "  这一页要整个换个样子，走 pagecolor（那一栏不靠挂点，每一页都成立）。\n";
    } catch (e) { return ""; }
  }
  // ⚠️专有挂点只带【这回聊到的那几页】（她 2026-10-17：秋秋做个气泡超过十分钟没答上来）：
  //   原来每一枪都把五十多页、两千六百多个挂点整份塞进去，十万字的提示词，光读就要好几分钟。
  //   聊到哪一页（页名、或者她开着的那一页）才带那一页的全表；别的页只列个名字，她一提下一轮就带上。
  const WK_ALIAS = { "聊天页": /聊天|气泡|单聊|对话框|输入框|顶栏/ };
  function themeCssNote(focus, pageKey) {
    const ts = TS(); if (!ts || !ts.WK_COMMON) return "";
    const f = String(focus || "");
    const fmt = function (arr) { return (arr || []).map(function (h) { return "    [data-wk=\"" + h[0] + "\"] " + h[1]; }).join("\n"); };
    const hit = function (g) {
      if (pageKey && (g.pages || []).indexOf(pageKey) >= 0) return true;
      const zh = String(g.zh || "");
      return (zh && f.indexOf(zh) >= 0) || (zh.length > 2 && /页$/.test(zh) && f.indexOf(zh.slice(0, -1)) >= 0) || (WK_ALIAS[zh] && WK_ALIAS[zh].test(f))
        || (g.pages || []).some(function (pk) { return pk && pk.length > 2 && f.indexOf(pk) >= 0; });
    };
    const groups = ts.WK_SCOPED || [];
    const on = groups.filter(hit), off = groups.filter(function (g) { return !hit(g); });
    const scoped = on.map(function (g) {
      return "  【只有" + g.zh + "（" + (g.pages || []).join(" / ") + "）才有】\n" + fmt(g.hooks);
    }).join("\n") + (off.length ? "\n  【这几页也有自己专有的挂点，这回没带全表】" + off.map(function (g) { return g.zh; }).join("、")
      + "——要改其中哪一页，跟她说一声是哪页，她一提那一页的名字，下一轮就把那一页的挂点带上；别凭空猜挂点名。" : "");
    return "  ⚠️写 CSS 之前必须知道这三件事，不然写出来【一条都不会生效】：\n"
      + "  ① 这个 App 的样式几乎全是【内联 style】，行内赢过普通规则——**每一条声明都要带 !important**，不带就等于没写。\n"
      + "  ② 页面 CSS 会被系统【自动加上作用域】。你只管写普通选择器，**绝不要自己加 .theme-xxx 或 [data-page=...] 这类前缀**，加了就永远匹配不到。\n"
      + "  ③ 能稳稳抓住的就是下面这些钩子，**别去猜别的类名**（这个 App 没有语义 class，只有 Tailwind 工具类）。\n"
      + "  ⚠️图标是 SVG：要给它上色得写 **stroke**（少数实心的写 fill），color 管不到它。\n"
      // 群友 2026-10-14：「顶栏太高了秋秋不会修」——她的 CSS 给 chathead 写了 padding:5px 4px，把刘海那条安全区一起抹掉了，顶栏钻进状态栏底下
      + "  ⚠️顶栏（chathead、各页 Head）和底栏（composer）自带一截【刘海／底部横条的安全区】，是写在 padding-top／padding-bottom 里的。\n"
      + "     **别对它们写 padding 简写，也别把 padding-top（底栏是 padding-bottom）写成死数**——一写就把安全区抹了，顶栏钻进时间、信号那条状态栏底下，看起来像「顶栏太高、跟时间叠在一起」。\n"
      + "     要调上下留白就写 padding-top: calc(var(--app-safe-top) + 6px) !important（底栏用 var(--app-safe-bottom)），左右单独写 padding-left/right。\n"
      + "     顶栏里用 position:absolute; top:50% 居中的东西（名字、头像）会比两边按钮高半截刘海——要写 top: calc(50% + var(--app-safe-top) / 2) !important。她说「名字／头像太高了、没跟按钮对齐」就先找这个——改的是【她 CSS 里写了 top:50% 的那一条】（多半是 headname，中间那块名字加小图标），不是 avatar：顶栏的 avatar 常常已经被她隐藏了，改它看不出任何变化。\n"
      + "     她说「顶栏太高／跟时间叠了／顶栏跑到最上面去了」：先在她现有的 CSS 里找对 chathead 的 padding、min-height、height、position:absolute/fixed，照上面这条改回来，别再往上加新的。同一个选择器写了好几块的，【越靠后的越算数】：在前面补一条留白，后面那块 height:52px／padding:0 14px 照样把它盖掉（群里 2026-10-19 就是这样，秋秋补了两回都没用）——要改就改最后那块，或者把那几块并成一块。\n"
      // 群里 2026-10-19：她要「底栏透明」，秋秋给了 background:transparent，底栏下面那截露出一条米色，补了 body、外层都没用
      + "     她说「底部不贴边／最底下多一条颜色／底栏下面露一截」：是底栏（composer）没把自己的颜色铺到屏幕最底。底栏要写【实色或渐变】＋ padding-bottom: var(--app-safe-bottom) !important，一路铺到底；她想要「透明」，就把底栏刷成跟聊天底色同一个颜色，别写 transparent——透明了露出来的是底下那层，不是她的背景。别去刷 body、外壳。\n"
      + "  【共用件上的（顶栏、半窗、空状态、头像、开关、输入框这些，绝大多数页面都有）】\n" + fmt(ts.WK_COMMON) + "\n"
      + scoped + "\n"
      + wkHere()
      // 她 2026-10-16 截图：一起学换粉色背景，秋秋两回都写 [data-wk="app"]，改前改后一模一样、页面一点没变
      + "  ⚠️**换某一页的背景／底色**：先看上面那一页专有的挂点里有没有「这一页的最外层」（名字多半带 page，比如一起学是 studypage、信息页是 mlpage），有就写它。\n"
      + "     [data-wk=\"app\"] 只是整个 App 最外面那层壳，大多数页面自己铺了一层底色把它整个盖住——只写它，页面看起来一点都不会变。\n"
      + "  ⚠️她说「刚改的还是不行」时，别把上一份原样再交一遍：先想清楚上一份为什么没生效（挂点不对？被内联盖住？），换个真能抓住的写法。\n"
      + "  ⚠️页面正文里那些卡片、按钮、列表**没有单独的钩子**，CSS 抓不住它们。\n"
      + "  它们的颜色多半是从这一页的那几支色里取的，所以【整页换调子、换卡片底色、换字色】要走 pagecolor 那一栏\n"
      + "  （不需要钩子）；上面这些钩子管的是顶栏、半窗、空状态、头像、开关、输入框这类共用件。\n"
      + "  ⚠️有几页整页是自己那套材质写死的（夜空、账簿纸、卡纸台面…），它们不问主题要颜色——\n"
      + "  给那几页写 pagecolor 会【当场被拒并告诉你是哪一页】。被拒了就照实跟她说改不动，别换个法子硬试。\n"
      + "  真做不到的只有一样：精确改某一张卡片的形状、间距、圆角——**这种时候先说实话**，别硬出一份改不动的 CSS 糊弄过去。\n";
  }
  const SHAPE = '{"reply":"给她看的话（中文）","patches":[{"target":"style|persona|appearance|profile|theme|pagecolor|bubble|memory|lore|rules|chatcss|chatlayout|offlinecss|groupcss|grouplayout|lookundo|undo|newchar|mask|rel|npc","id":"要改的那一条的 id；style 留空=新建；lore 新建填 new；theme 填 global 或某一页的 key","field":"（只有 profile 用）要改哪一栏","title":"这条改动一句话叫什么","name":"（style 新建时是预设名；lore 是词条标题）","keyword":"（只有 lore 用，可选）触发关键词，逗号分开","always":"（只有 lore 用，可选）true＝常驻","bind":"（只有 lore 用，可选）绑给哪几个角色，名字或 id","find":"（改一小段时用）逐字抄下原文里要动的那一段","append":"（可选，true＝接在这一栏最后，用于 persona／appearance／profile 和美化 CSS 加新规则）","whole":"（可选，true＝美化 CSS 整份重做，只在她说整体重做时填）","text":"改一小段时＝换成这一段；不给 find 时＝改完的完整内容","why":"为什么这么改，一两句"}],"file":{"name":"（可选）文件名","text":"完整内容"},"code":"（可选）health / fish / mcp","remember":["（可选）以后用得上的一句"],"forget":["（可选）上面那几条里要删的那一句原文"]}';

  // ---- 现状快照 + 手册：一份是「此刻长什么样」，一份是「这个世界有什么」----
  // extraIds：秋秋看了目录自己要翻的那几条（「翻一下」那一枪），连同字面挑中的一起给全文
  function manualBlock(question, hereId, extraIds) {
    const M = MAN(); if (!M) return "";
    // 她此刻开着的那一页，词条也捎上：这样「这一页是干嘛的」不用她先说出它叫什么
    // 她开着的那一页：攻略里那一整个 app 都捎上（信息那一页底下有说话、见面、小房间……），
    //   不只是跟页面同名的那一条——她问「这个按钮干嘛的」，答案常常在同一页的别的小节里。
    const here = hereId ? M.byId(hereId) : null;
    // 开着的那一页不再整个 app 全带（「信息」底下十几条、两三万字，每问一句都读一遍）：
    //   只带这一页里跟她这句最沾边的两条；一条都不沾就带这一页本身那一条。还要别的，目录在、lookup 会翻。
    const pageAll = here ? M.appEntries(here.app) : [];
    const pageHit = M.find(question, 40).filter(x => pageAll.some(p => p.id === x.id)).slice(0, 2);
    const page = pageHit.length ? pageHit : (here ? [here] : []);
    const hits = M.find(question, 4).filter(x => !page.some(p => p.id === x.id));
    hits.unshift.apply(hits, page);
    (extraIds || []).map(id => M.byId(id)).filter(x => x && !hits.some(h0 => h0.id === x.id)).forEach(x => hits.unshift(x));
    // 详细限一个总量（她 2026-10-17 查秋秋还塞不塞太多：问「聊天气泡」会顺带进三万多字的小世界那一条）：
    //   排在前面的照放；后面沾边的放不下就只留名字，真要再用 lookup 翻。点名要翻的那几条（extraIds）不受限。
    const BUDGET = 16000; let used = 0; const keep = [], skip = [];
    hits.forEach((x, i) => { const asked = (extraIds || []).indexOf(x.id) >= 0;
      // 特别长的那几条（小世界三万多字、说话一万多）不再一沾边就整条塞：只给跟她这句沾边的那几小节，
      //   其余小节只报名字，要用再 lookup（点名翻的那条照旧给全文）。按「###」小标题或「**某某：**」开头的那一段切，
      //   不切成一句一句——一节里「先开 A、再去 B、不然会怎样」是连着的，切碎了她会把步骤说漏（她 2026-10-25 定）。
      const tx = asked ? M.textOf(x) : sectionText(M, x, question);
      const must = i === 0 || asked;
      if (must || used + tx.length <= BUDGET) { keep.push(tx); used += tx.length; } else skip.push(x); });
    return "【这个 App 有哪些东西 · 目录】\n" + M.index()
      + (keep.length ? "\n\n【她这次多半在问这几样 · 详细】\n" + keep.join("\n\n") : "")
      + (skip.length ? "\n\n（也沾边、这回没放全文的：" + skip.map(x => "[" + x.id + "] " + (x.zh || "")).join("、") + "——要用就 lookup）" : "");
  }

  const SECTION_FROM = 5000;   // 一条超过这么长才按小节挑
  function sectionText(M, x, question) {
    const full = M.textOf(x);
    if (full.length <= SECTION_FROM) return full;
    const raw = String(x.doc || x.what || "");
    // 一节＝「### 小标题」底下那一块，或者空行后以「**某某：**」开头的那一段
    //   （也认顶格的「- **某某：**」：出毛病了怎么办、小游戏那几条整条就是这样一条条列的）
    //   有小标题的条目只按小标题切（底下那几段「**某某：**」跟着小标题走，不拆开）
    const units = raw.split(/\n(?=#{2,4} )/.test(raw) ? /\n(?=#{2,4} )/ : /\n\n(?=\*\*)|\n(?=- \*\*)/).map(u => u.trim()).filter(Boolean);
    if (units.length < 3) return full;
    // 问句里的虚词先拿掉：「怎么」「什么」到处都有，留着就哪一节都像沾边（「绒绒小镇的猫怎么喂」挑出了念头那节）
    const Q = memGrams(String(question || "").replace(/为什么|怎么办|怎么|什么|如何|能不能|可不可以|可以|是不是|有没有|一下|这个|那个|我的|你的|他的|她的|的|了|吗|呢|啊|吧|呀|嘛/g, " "));
    const title = u => { const m = /^#{2,4} (.+)|^(?:- )?\*\*([^*]+?)[：:]?\*\*/.exec(u); return m ? (m[1] || m[2]).trim() : ""; };
    // 小标题沾上算三倍：标题就是这一节在讲什么
    const scored = units.map((u, k) => { let n = 0; memGrams(title(u)).forEach(g => { if (Q.has(g)) n += 3; }); memGrams(u.slice(0, 600)).forEach(g => { if (Q.has(g)) n++; }); return { u, k, n }; });
    const intro = title(units[0]) ? null : scored[0];        // 第一个小标题前面那段总说明，照留
    const top = scored.filter(s0 => s0 !== intro && s0.n >= 2).sort((a, b) => b.n - a.n).slice(0, 3);
    if (!top.length) top.push.apply(top, scored.filter(s0 => s0 !== intro).slice(0, 1));
    const picked = (intro ? [intro] : []).concat(top).sort((a, b) => a.k - b.k);
    const rest = scored.filter(s0 => picked.indexOf(s0) < 0).map(s0 => title(s0.u)).filter(Boolean);
    return "【" + x.zh + "】\n在哪儿：" + x.where + "\n" + M.plain(picked.map(s0 => s0.u).join("\n\n"))
      + (rest.length ? "\n（这条很长，只放了跟她这句沾边的几节；其余小节：" + rest.join("、") + "——要用就 lookup「" + x.id + "」）" : "");
  }

  // ── 更新日志（她 2026-10-24「你这个也加上吧」）────────────────────────
  //   设置里「新 · 更新了什么」那一份（js/changelog-data.js）。不是每问一句都带——四万多字——
  //   只在她这句像在问「更新了啥 / 某样东西什么时候有的」时才带：最近五天全文，再加跟她这句最沾边的十几条（带日子）。
  const CHANGELOG_ASK = /更新|新功能|新加|加了(什么|啥)|改了(什么|啥)|修了|修好|最近.{0,4}(加|改|修|多|出)|什么时候(有|加|上|出|开始)|哪天(有|加|上|出)|新版|版本/;
  function changelogBlock(question) {
    const list = Array.isArray(window.QQ_CHANGELOG) ? window.QQ_CHANGELOG : [];
    if (!list.length || !CHANGELOG_ASK.test(String(question || ""))) return "";
    const day = d => { const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(d || ""); return m ? (+m[1]) + "月" + (+m[2]) + "日" : d; };
    const recent = list.slice(0, 5).map(x => day(x.d) + "\n" + x.items.map(it => "· " + it).join("\n"));
    // 跟她这句沾边的：按两个字一组的重合数挑（「照影」「片刻」「亲属卡」这种名字就靠它认），最近五天里已经有的不重复
    const Q = memGrams(String(question || "").replace(/更新|什么时候|哪天|有的|加的|上的|了吗|没有/g, ""));
    const hits = [];
    //   她这句短（「片刻是什么时候有的」剩不下几组字）时沾一组就算；同样沾边的早的排前面——问「什么时候有的」要的是头一回
    const need = Q.size <= 3 ? 1 : 2;
    list.slice(5).forEach(x => x.items.forEach(it => { let n = 0; memGrams(it).forEach(g => { if (Q.has(g)) n++; }); if (n >= need) hits.push({ n, d: x.d, line: day(x.d) + " · " + it }); }));
    hits.sort((a, b) => b.n - a.n || (a.d < b.d ? -1 : a.d > b.d ? 1 : 0));
    return "【更新日志 · 设置 → 新 · 更新了什么】一天一条，日子是那天上线到公共版的；最早一条是 2026 年 9 月 8 日公开版上线，再早的没有记录。"
      + "她问「最近更新了啥」「某样东西什么时候有的」就照这个答，说日子；这里没写的别编，说日志里没找到、可以去设置里那一页翻。\n"
      + "最近五天：\n" + recent.join("\n\n")
      + (hits.length ? "\n\n更早、跟她这句沾边的：\n" + hits.slice(0, 15).map(x => "· " + x.line).join("\n") : "");
  }

  // ── 秋秋记着的（她 2026-10-26「做吧」）──────────────────────────────
  //   记的是她怎么用这个 App、喜欢什么：手机浏览器、美化口味、不要什么。聊天记录清了它还在。
  //   不另花调用：秋秋每次回话顺手带 remember／forget 两栏；这里只管存、按这一句召回相关的几条。
  //   条数不封顶（跟记忆库一样随时召回，不会因为满了把旧的抹掉）；每轮只递相关的几条和最近几条。
  const MEM_KEY = "x_assistMem";
  function loadMem() { try { const a = typeof loadJSON === "function" ? loadJSON(MEM_KEY, []) : []; return Array.isArray(a) ? a.filter(x => x && x.text) : []; } catch (e) { return []; } }
  const memSubs = new Set();
  function onMem(fn) { memSubs.add(fn); return () => memSubs.delete(fn); }
  function saveMem(list) { try { if (typeof saveJSON === "function") saveJSON(MEM_KEY, list); } catch (e) {} memSubs.forEach(fn => { try { fn(list); } catch (e) {} }); return list; }
  const memGrams = t => { const s = String(t || "").replace(/\s+/g, ""), out = new Set(); for (let i = 0; i < s.length - 1; i++) out.add(s.slice(i, i + 2)); return out; };
  function memSame(a, b) { const A = memGrams(a), B = memGrams(b); if (!A.size || !B.size) return a === b; let n = 0; A.forEach(g => { if (B.has(g)) n++; }); return n / Math.min(A.size, B.size) > 0.8; }
  function recallMem(focus) {
    const all = loadMem(); if (!all.length) return [];
    const F = memGrams(focus);
    const scored = all.map((m, i) => { let n = 0; memGrams(m.text).forEach(g => { if (F.has(g)) n++; }); return { m, i, n }; });
    const hit = scored.filter(x => x.n >= 2).sort((a, b) => b.n - a.n).slice(0, 16);   // 放开（她 2026-10-27「秋秋记忆放开点」）：相关的 8→16、最近的 4→8、一条 80→160 字
    const recent = scored.slice(-8);
    const seen = new Set(); return hit.concat(recent).filter(x => !seen.has(x.i) && seen.add(x.i)).sort((a, b) => a.i - b.i).map(x => x.m);
  }
  function applyMem(remember, forget) {
    let list = loadMem(), changed = false;
    (Array.isArray(forget) ? forget : []).map(x => String(x || "").trim()).filter(Boolean).forEach(f => { const k = list.findIndex(m => m.text === f || memSame(m.text, f)); if (k >= 0) { list.splice(k, 1); changed = true; } });
    (Array.isArray(remember) ? remember : []).map(x => String(x || "").trim().slice(0, 160)).filter(Boolean).slice(0, 4).forEach(r => {
      const k = list.findIndex(m => memSame(m.text, r));
      if (k >= 0) list.splice(k, 1);   // 同一件事说了新的：旧的那句拿掉，新的排到最后
      list.push({ id: "qm" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), text: r, ts: Date.now() }); changed = true;
    });
    if (changed) saveMem(list);
    return changed;
  }
  function buildSystem(ctx, question, history, extraIds) {
    // ⚠️「这会儿在说谁」拿【要发给模型的那整段窗口】来找，不是只看当前这一句：
    //   她上一句常常是「宝宝你再看看呢」，名字是在前面提的。
    //   跟发出去的窗口用同一份文本，判据才对得上——我们在聊谁，那张卡就是全的。
    // ⚠️她此刻开着的那一页上的人也算「在说谁」：站在 V 的聊天里说「TA的卡有点 ooc」，
    //   一个名字都没提，可指的就是TA——这张卡必须是全的。
    const here = pageOf(ctx.page);
    const focus = chatWindow(history).map(m => String(m && m.text || "")).concat(
      [String(question || ""), (here && here.who) || ""]).join("\n");
    const snap = snapshot(ctx, focus);
    const cfg = loadCfg();
    const uName = (ctx.profile && ctx.profile.name) || "她";
    const ts = TS();
    const pages = ts ? (ts.PAGES || []).map(x => x[0] + "＝" + x[1]).join("、") : "";
    // ① 她那份预设（可改、可清空）。清空了也不能没人称——留一句最短的兜底，
    //    否则模型不知道自己是谁，会退回「一个通用助手」那张脸。
    const persona = cfg.prompt.trim() || ("你是「" + cfg.name + "」，这个 App 里的向导。话短、直接、不客套。");
    // ② 底下这些是结构和安全面，不进那份预设，她删不掉
    return persona + "\n\n"
      + "【你可以回答什么】\n"
      + "你不只回答“某个按钮怎么用”。凡是关于这台 App 的基础问题都可以答：它整体是做什么的、某个页面或概念是什么意思、不同玩法有什么区别、她现在有哪些角色和文风、眼前页面与现状快照里能确认的设置是什么。能从目录、详细手册或现状快照确认，就直接归纳成人话；别因为她没有问具体操作步骤而拒绝。\n"
      + "你仍然只负责这个 App，不回答与它无关的百科、新闻或生活问题。基础问答不会给你新增任何写入权限，也不要为纯问答生成 patch。\n\n"
      + "【最要紧的一条：不许编】\n"
      + "下面那份目录和详细，是这个 App 功能的全部。手册与现状快照里没写的 App 细节，你就说不确定、让她点开看看——"
      + "编一个听起来很合理的功能出来，比答不上来坏得多。\n"
      + "她问的东西在目录里但详细没给全，就照目录那一句答，别往下展开。\n\n"
      + "【不答的那一类】这个 App 是【怎么造出来的】一律不答：代码、框架、文件、数据存在哪、技术选型。"
      + "她问到就一句话挡回去，然后把话拉回「你想改哪儿？我可以动手」。\n"
      + "⚠️「哪儿不对劲 / 报错 / 没生效」不属于这一类——那是要你帮她查的，照查。\n"
      + "查毛病的时候先看下面的现状快照，指出最可能卡在哪一步、怎么验证。常见成因："
      + "文风存了但这一局没切过去（线下顶栏「文风」那条会显示「未设文风」）；自定义文风与通用叙事准则冲突；"
      + "模型不认可选字段；出图被上游审核拒。这种时候通常不需要改动稿，除非改一处设置就能解决。\n\n"
      + "【你能动手改的东西·只有这几样】\n"
      + "· style 文风预设（写给 AI 的文风提示词；id 留空＝新建一份）\n"
      + "· persona 角色人设　· appearance 角色外貌\n"
      + "· newchar 从头写一个新角色，落进人格档案馆（id 留空；text 是一份 JSON：{\"name\":\"名字\",\"persona\":\"完整人设\",\"appearance\":\"外貌\",\"tagline\":\"一句话简介\",\"gender\":\"性别\",\"birthday\":\"MM-DD\"}，name 和 persona 必填，其余可省）。"
      + "她说「帮我写个人设／捏个角色」时：她给了的那几样照她的写，没给的按她选的世界书、她说过的话由你来定（她说「其他随便」就是交给你）；什么都没说才先问一句是谁、什么世界。人设写成能直接拿去聊的完整一份，别留「待补充」。建好之后再改，用 persona／appearance／profile 那几条。\n"
      + "· mask 她自己的面具（快照【面具】那一栏；角色眼里的「她」就是这一张）：id＝main 改主面具，new 新建一张副面具，其余照抄那一张的 id；"
      + "text 是一份 JSON，只写要改的栏，没写的原样留着：{\"name\":\"名字\",\"label\":\"面具标签（她自己看的，比如「校园AU」）\",\"tagline\":\"一句话签名\",\"persona\":\"人设全文\",\"appearance\":\"外貌\",\"birthday\":\"MM-DD\"}。"
      + "persona 一写就是整份替换，改一小段也要给改完的全文。捏 user 人设跟捏角色同一个做法：她给了的照写，没给的你来定。\n"
      + "  · 【长人设边写边改】她要一份很长的人设时，别一口气塞进一条：先用 newchar 建档，persona 放第一部分（基本信息、人物核心）；"
      + "之后每一轮用 persona 加 \"append\":true 接着往后写下一部分（text 只写新的这一段，会接在现有人设最后）；她说哪里不对，就用 find 改那一小段。"
      + "每一轮写完告诉她这一段写了什么、下一段打算写什么，让她能边看边说。\n"
      + "  ⚠️快照里每张角色卡都带一栏【这张卡是否完整】。为 true 就是全文，放心照它出 patch、别再说自己看不到；"
      + "为 false 的那张只给了开头，那就别出 patch——跟她确认是哪张卡，下一轮你就会拿到全文。\n"
      + "· profile 角色档案的其它栏（field 只能是：" + Object.keys(CARD_FIELDS).map(k => k + "＝" + CARD_FIELDS[k]).join("、") + "）\n"
      + "· theme 界面装修（text 是 CSS；id 填 global＝全 App" + (pages ? "，或某一页：" + pages : "") + "）\n" + themeCssNote(focus, ctx && ctx.page)
      // 她 2026-10-17 截图：说「把天气、木鱼都删了」，秋秋写了一份 CSS 去藏，还说「拿不准就长按拖去删除区」——
      //   主屏本来就有「从桌面移走」。界面上点得出来的事，答案是那一步在哪儿点，不是一张改动稿。
      + "  ⚠️她要的事界面上本来就能点出来（删/移走/放回一个组件、换图、开关某一样），先翻攻略找到那一步，直接告诉她在哪儿点；"
      + "别拿 CSS 去藏一个本来就能删的东西（藏起来的还占着位置、也没法放回），攻略里没写的步骤也别猜一个出来。只有界面上真做不到的样子，才出 theme。\n"
      + "· pagecolor 某一页的配色（id＝那一页的 key；text 是一份 JSON，如 {\"bg2\":\"#f2ece0\"}）\n"
      + "· memory 记忆库条目（往里加，一行一条，id＝角色 id）\n"
      + (typeof window !== "undefined" && window.AssistExtras ? window.AssistExtras.docLines() : "")
      + "· rel 两个人之间的一条关系线（快照里【关系】那一栏）：id 写成 \"A->B\"（A、B 是角色或配角的名字或 id，她本人写「我」），text＝A 对 B 是什么关系（几个字）；both:true＝两个方向写成同一句；text 留空＝删掉这条线。"
      + "她说「这几个人其实是一伙的」，就给每两个该连的人各出一张；有就改、没有就加，快照里已经对的别重复出。\n"
      + "· npc 新建一位配角（id 填 new；text 是一份 JSON：{\"name\":\"名字\",\"brief\":\"TA 是个什么样的人\",\"owner\":\"在谁身边（角色名；她本人写「我」；大家共同认识的留空）\",\"links\":[{\"who\":\"认识的人（角色、配角，或「我」）\",\"label\":\"是什么关系\"}]}）。"
      + "links 里每一位都会两头记上这条关系；写了「我」就是 TA 认识她本人。快照【配角】里已经有的人别再建一遍。\n"
      + "· lore 世界书词条（快照里【世界书】那一栏）：改一条＝id 照抄那一条的 id，text 是改完的正文（改一小段就用 find）；新建＝id 填 new，name 是标题。"
      + "可选：keyword＝触发关键词（逗号分开；填了就是聊到这些词才翻出来，不填＝一直在）、always＝true 常驻、bind＝绑给谁（角色名或 id，逗号分开，不填＝所有人都看得到）。只改这几样、正文不动时 text 留空就行，正文原样留着。"
      + "她发来一份世界书文件要导进来，就按内容拆成几条，一条一个 patch（这种时候最多 12 条，超过就先导最要紧的、跟她说剩下的下一轮接着导）；"
      + "人物、地点、势力、规则这种分开写，每条只讲一件事，标题让人一眼看出讲什么。她的原文照搬，别替她改写设定。\n"      + "· bubble 这个人的聊天窗气泡（id＝角色 id；text 是一份 JSON，不是散文）\n"
      + "  可填的栏：myBg／charBg（底色，#hex 或一整段 linear-gradient(...)）、myText／charText（字色）、"
      + "myBorder／charBorder（形如 1px solid #hex）、shadow（形如 0 2px 8px rgba(...)）、chatBg（聊天页底色）、"
      + "radius（0-30 的整数）、mySticker／charSticker（只能逐字复用现状快照里已有的 iv_ 图片门牌，空字符串＝拆掉）、"
      + "stickerSize（32-72 的整数）、myAlpha／charAlpha（气泡底色不透明度 0-100，只淡底不淡字）。**只填这些栏，不许自造新栏；贴纸门牌不许编。**\n"
      + "  · 她只说了一处（如「我的气泡」）就【只填那一栏】，没提到的一栏都别写——写了就是把她原来的盖掉。\n"
      + "  · 她说的是一种气氛而不是一个颜色时，你要自己定这套配色：先想清楚**那个气氛在她眼里是什么样的光**，"
      + "再让底色、字色、圆角、投影一起往那个方向走——四栏各说各的，出来就是一套四不像。\n"
      + "  · **字要看得清**：底色深就把字色调亮，底色浅就调暗。这一条压过任何审美。\n"
      + "  · 这一份只盖【这一个人的聊天窗】，别人的窗口和全局都不受影响。她没说是谁、你也不知道她开着谁的窗口时，先问。\n"
      + "· offlinecss 这个人【线下见面那一层】的 CSS（id＝角色 id；text 是 CSS，会自动限到这一个人的线下，别人的线下不受影响；"
      + "挂点用线下那几个：offline、offmsg、offcard、offhead、offname、offtext、offsay、offthought、offnarr 等，见上面的名单）。"
      + "她说的是「线下」「见面」「卡片」那一层，就走这一栏，不是 chatcss。\n"
      + "· chatcss 这个人聊天窗自己的 CSS（id＝角色 id；text 是 CSS，写法同 theme 的单聊页，会自动限到这一个人的窗口；"
      + "跟这个人【单独通话】时这份也生效，所以通话里的样子也写在这一栏，挂点用 call、callbubble、callmsg、callbody 这些 call 开头的；群通话不吃这一份；"
      + "它压在皮肤、气泡、排版所有层上面）。挂点照上面那份名单用；msg／bubble 还带 data-first／data-last（连发那一串的头/尾）、"
      + "data-kind（text/voice/photo…）、data-recent=\"1\"（刚进来，可做入场动画）。高度别写死 px，用 var(--app-h)／var(--app-vh)／"
      + "var(--app-safe-top)／var(--app-safe-bottom)，或 html[data-screen-size=\"short|mid|tall\"] 分开写。\n"
      + "· chatlayout 这个人聊天窗的排版（id＝角色 id；text 是 JSON）：bubble（\"bubble\"|\"plain\" 没气泡）、avatar（\"all\"|\"first\" 连发只留第一条|\"none\"）、"
      + "name（true 在连发第一条上写名字）、time（\"show\"|\"hide\"）、gap（\"normal\"|\"tight\"|\"loose\"）、top（0-240 顶部留白，给装饰让位）、"
      + "enter（新消息入场：\"none\"|\"fade\"|\"rise\"|\"pop\"）、head（顶栏：\"normal\"|\"clear\"|\"glass\"）、composer（输入栏：\"normal\"|\"float\"|\"glass\"）、"
      + "fontSize（气泡字号 12-20，0＝原样）、lineHeight（气泡行距 1.2-2.2，0＝原样）、gapIn（同一串里每条之间 0-40 px）、gapOut（每串之间 0-60 px；这两个填 null＝回到 gap 那一档）、"
      + "deco（{ta:{frame,frameSize,pend,pendSize,pendPos}, me:{…}}：头像框/挂件，图只能是 https 地址或现状里已有的 iv_ 门牌；frameSize 100-200，pendSize 20-100，pendPos br/bl/tr/tl）。"
      + "想要不用图的框（一圈描边、发光、渐变圈），写进 chatcss／groupcss：对 [data-wk=\"row\"] > [data-wk=\"avatar\"], [data-wk=\"cardrow\"] > [data-wk=\"avatar\"] 写 position:relative，再用 ::after 画（后半是表情包、卡片那几行，不写的话它们的头像套不上框）。"
      + "只填她提到的那几栏。\n"
      + "· rules 某个角色或某个群的长期准则（她经 OOC 立的那几条，每轮都会作为高优先要求喂给TA；id＝角色 id 或群 id）：text 写【改完之后的整份】，一行一条——删一条就是不写它，加一条就是多写一行，改措辞就改那一行。快照里每个角色的「长期准则」、每个群的「群规矩」就是现在的样子。"
      + "她问某个角色为什么老这样、是不是哪条规矩卡住了TA，先去看这一栏。\n"
      + "· groupcss／grouplayout 某一个群的聊天窗 CSS 和排版（id＝群 id，见快照里的群列表）：写法同 chatcss／chatlayout，只是作用在那个群里；"
      + "群里的 deco.ta 管全部群成员的头像，deco.me 管她自己的。\n"
      + "· lookundo 把某一层美化退回上一版（id 照快照「美化能退回的」那一栏抄：chat:角色id、group:群id、offline:角色id、theme；"
      + "text 写「退一步」，退过头了写「换回来」）。她自己改的、你改的都记在这本账上，一条退一步；她说「退回去」「刚才那样更好」就出这一条，不要凭记忆把旧 CSS 重写一遍。\n"
      + "· undo 撤回你自己改过的某一条（id 照快照「你改过还能撤回的」那一栏抄）。你看出自己上一条改错了（她说没生效、变丑了、改错人了），先出这一条把它退掉，再出改对的那条。\n"
      + "别的一律不许碰，也别假装你改了。**theme 那一栏只许改样子**——颜色、字号、间距、圆角、背景这些；别去动定位和显示与否，那会把全 App 弄坏。"
      + "要藏东西、挪位置、换排法，只在这一个人的聊天窗里做：走 chatlayout 或 chatcss。\n\n"
      + "【给她一份文件】她要把一份东西拿走（一整份 CSS、一份文风、一份整理好的清单），或者内容长到不适合放进对话框，就放进 file："
      + "{\"name\":\"文件名（带后缀，如 线下皮肤.css）\",\"text\":\"完整内容\"}——她那边会出一张文件卡，能一键复制、存成文件。"
      + "file 里放的东西【不受「正文不贴代码」那条限制】，CSS 就原样完整地放；reply 里只说一两句这份文件是什么。不需要就省略 file。\n"
      + "【现成的 Worker 代码】App 里有三段现成的、要她复制进 Cloudflare 的代码：health＝健康网关（快捷指令往里投、秋秋机来拿），fish＝Fish Audio 语音中转，mcp＝MCP 转接（设置里语音 API 下面接 MCP 那一块用的）。"
      + "她要这几段代码、或者说复制不下来时，填 code:\"health\"、code:\"fish\" 或 code:\"mcp\"，她那边会出一张能一键复制、存成文件的卡，代码由 App 照原样放进去——你自己不要写、不要改这几段代码。reply 里一两句说这是什么、接下来照哪一步做。\n"
      + "【她发来的文件】她这一句要是附了文件，内容就在这一轮她的话后面，照它办。\n\n"
      + "【两种改法 · 挑对的那一种】\n"
      + "· **改一小段（默认走这个）**：填 find＝逐字抄下原文里要动的那一段（照快照里的原文抄，别改标点、别缩写），"
      + "text＝换成的那一段。替换在本地做，原文别处一个字节都不动。\n"
      + "  find 必须在原文里【只出现一次】；抄不准或者拿不准就别出这条 patch，先问她。\n"
      + "· **美化 CSS（theme／chatcss／offlinecss／groupcss）**：原来有内容时，她让你改某一处，就只动那一处——"
      + "改已有的规则用 find（逐字抄那一条规则）；加新规则用 \"append\":true，text 只写新加的那几条，会接在最后。"
      + "选择器要窄到只命中她说的那一处：共用的挂点（note、card…）看挂点说明里的 data-part／data-kind，连它一起写。"
      + "只有她说「整体重做」「全部换掉」时才整份重写，并且要填 \"whole\":true——不填的话整份重写会被拦下。\n"
      // 一张卡太长被线路截断（群里 2026-10-24「说写好了让我点应用，底下没有应用键」——长美化最常这样）：分几轮出
      + "· **很长的一份（整套美化、几千字的人设）别一张卡写完**：线路一次能吐的字有限，卡写到一半被截断就整张丢了，她只看到你说「点应用」。"
      + "这一轮先出前一部分（CSS 用 whole 起头、人设照常），回话里告诉她还剩几段；下一轮她说「接着」你再用 \"append\":true 出下一段，直到写完。\n"
      + "她要把某个人／某个群／某个人线下的 CSS 清空、恢复默认：出一张那一格的卡，填 \"whole\":true，text 留空字符串——就是整份换成空。\n"
      + "· **整段替换**：不填 find，text＝改完的完整内容。只在「整份重写」时用；"
      + "如果那张卡的【这张卡是否完整】是 false，你【绝对不许】整段替换——那会把她后面的设定冲掉，代码也会拦住你。\n\n"
      + "【她想聊天就陪她聊】你不只是维修工，也是住在这台手机里的秋秋本人。她不叫你改东西、就是想说说话（闲聊、分享今天、吐槽、问你怎么看），就照你自己的性子好好跟她聊：接住她的话、有自己的看法和小反应、记得前面聊过什么，不用硬把话题绕回功能，也不出卡。\n\n"
      + "【reply 一定要写话】不管出没出卡，reply 都是你跟" + uName + "说的话：先接住她这句（她在抱怨、在问、在吐槽就先回应那个），出卡的话再用一两句说清这张卡改了什么、为什么这么改。reply 永远不许空着、也不许只写「改动稿在下面」。\n\n"
      + "【最重要的规矩】你给出的 patch 只是【草稿】。" + uName + " 会一条条看过再决定应不应用，所以：\n"
      + "· 不填 find 的时候，text 必须是【改完的完整内容】，不是 diff、不是「在原文基础上加一句」。\n"
      + "· 一次别超过 3 条 patch（导世界书、连一串关系、建一批配角——全是 lore／rel／npc 的一轮可以到 12 条）；纯粹问功能的时候给空数组，光用 reply 答她。\n"
      + "· **卡只跟着她【最新这一句】走**：前几轮出过的卡她已经看到了（应没应用是她的事），不许再出一遍、也不许换个说法再出。她这一句是在聊天、道谢、吐槽、问你怎么想，没叫你改东西，patches 就给空数组，只用 reply 跟她说话。（她 2026-10-20：「做完卡想聊天，它还是每轮带着卡」）\n"
      + "· 拿不准她想要什么就先问，别擅自动手。改人设尤其要谨慎——那是她攒了很久的东西。\n\n"
      + (pageLine(ctx.page) ? pageLine(ctx.page) + "\n\n" : "")
      + manualBlock(question, here && here.man, extraIds) + "\n\n"
      + (() => { const cl = changelogBlock(question); return cl ? cl + "\n\n" : ""; })()
      + (extraIds && extraIds.length ? "【你刚要翻的那几条已经放进上面的详细里了，照着答；这次别再要 lookup】\n\n"
        : "【翻一下攻略】她问的是 App 怎么用，可上面「详细」里没有答案，而目录里看得出答案多半在某一条（看「里面讲」那一行）："
          + "这一轮先别答，只输出 {\"lookup\":[\"那一条方括号里的 id\"]}（最多 3 条），那几条正文会递给你，你再答。详细里已经有答案、或者不是问功能，就别用 lookup。\n\n")
      + (() => { const mem = recallMem(focus); return "【你记着的关于" + uName + "的事】" + (mem.length ? "（只是跟这一句有关的几条和最近记下的几条，不是全部）\n" + mem.map(m => "· " + m.text).join("\n") : "（还没记过什么）")
        + "\n她说了一件以后用得上的事——她用什么手机和浏览器、喜欢什么样的美化、不想要什么、配的是哪家接口、她习惯怎么叫你——就在 remember 里记一句（一句一件事，写成你以后一看就懂的大白话；最多三句）。"
        + "她跟角色之间的私事、聊天内容不记，你改过什么也不用记（卡片那边有账）。上面哪一句已经不对了（她换了手机、改了主意），把那一句原样抄进 forget，再在 remember 里记新的。没有就两栏都省略。\n\n"; })()
      + "【App 现状快照】\n" + JSON.stringify(snap) + "\n\n"
      + "【输出】只输出 JSON，不要代码块：\n" + SHAPE;
  }

  async function ask(active, ctx, history, text, pic, signal) {
    // 门在最前面：命中就当场回绝，一次调用都不花
    if (codeQuestion(text)) return { reply: CODE_REPLY, patches: [], refused: true };
    // 攻略手册改成用到才加载（她 2026-10-18 瘦身）：问之前等它到位，不然这一问就没攻略可翻
    if (window.LazyMods) await window.LazyMods.load("manual").catch(() => {});
    // 问更新的时候把日志也拉进来（它跟设置同一组，点进设置之前可能还没下）
    if (window.LazyMods && !window.QQ_CHANGELOG && CHANGELOG_ASK.test(String(text || ""))) await window.LazyMods.load("screens").catch(() => {});
    // 她发的图（她 2026-09-30）：只跟着【这一句】发给模型；历史里只留一张小缩略图给她看，不再回传——一张图每轮重发太贵
    // 附件两种：图（只跟这一句走）、文件（她发来的 CSS/文本，内容接在这一句后面）
    const isFile = pic && typeof pic === "object" && pic.kind === "file";
    const img = isFile ? null : pic;
    const fileTail = isFile ? "\n\n【她发来的文件《" + pic.name + "》" + (pic.imgs ? "（里面嵌着 " + pic.imgs + " 张图，你这儿看到的是占位那一句；她直接导入原文件时图都在）" : "") + (pic.cut ? "（太长，只给了前 " + pic.text.length + " 字）" : "") + "】\n" + pic.text : "";
    // 旧记录里只剩一句「改动稿在下面。」的那几条：换成卡上写的改了什么，别让它照着自己学成只发卡
    // 出过卡的那几轮：话后面附一行「这轮出过哪几张卡」——原来只发 reply 那几句，
    //   过两轮它就不记得自己刚做过什么了（她 2026-10-20：「过几轮就没记忆了」）。只附标题和理由，不附整份内容。
    const cardLine = m => m.patches.map(x => "· " + (String(x.title || "").trim() || "一处改动") + (String(x.why || "").trim() ? "：" + String(x.why).trim() : "")).join("\n");
    const itText = m => {
      const tx = String(m.text || "");
      if (m.role === "me" || !Array.isArray(m.patches) || !m.patches.length) return tx;
      if (/^改动稿在下面。?$/.test(tx.trim())) return cardLine(m);
      return tx + "\n（这一轮我出过的卡：\n" + cardLine(m) + "）";
    };
    const msgs = chatWindow(history).map(m => ({ role: m.role === "me" ? "user" : "assistant", content: itText(m) + (m.pic ? "（这句当时附了" + ((m.pics && m.pics.length > 1) ? m.pics.length + " 张图" : "一张图") + "）" : "") + (m.file ? "（这句当时附了文件《" + m.file.name + "》）" : "") + (m.outFile ? "（你当时给了她一份文件《" + m.outFile.name + "》）" : "") }))
      .concat([{ role: "user", content: (String(text || "") || (isFile ? "（她发来一个文件）" : Array.isArray(img) && img.length > 1 ? "（她发来 " + img.length + " 张图，看看说说）" : "（她发来一张图，看看说说）")) + fileTail, imageDataUrls: img ? (Array.isArray(img) ? img : [img]) : undefined }]);
    // 给足（max-tokens-floor）：一份完整的 CSS 文件放进 file 很长，12000 会写到一半断掉
    // 写长人设（她 2026-10-06：「可以写完整长文人设，边写边改」）：一篇几千字的人设 180 秒常常写不完——
    //   走流式（边写边收，连接不会因为久没动静被断）、给 10 分钟
    let sysText = buildSystem(ctx, text, history);
    let raw = await callAI(active, sysText, msgs, { maxTokens: 65000, timeout: 600000, stream: true, signal: signal || undefined });
    let d = (typeof parseJSONLoose === "function" ? parseJSONLoose(raw) : extractJSON(raw)) || {};
    // 它说要翻攻略（lookup）：把那几条正文递给它，再问一次——只有字面挑偏的时候才多花这一枪
    const M0 = MAN(), want = Array.isArray(d.lookup) ? d.lookup.map(x => String(x || "").replace(/[\[\]]/g, "").trim()).filter(id => M0 && M0.byId(id)).slice(0, 3) : [];
    if (want.length && !(Array.isArray(d.patches) && d.patches.length) && !(signal && signal.aborted)) {
      sysText = buildSystem(ctx, text, history, want);
      raw = await callAI(active, sysText, msgs, { maxTokens: 65000, timeout: 600000, stream: true, signal: signal || undefined });
      d = (typeof parseJSONLoose === "function" ? parseJSONLoose(raw) : extractJSON(raw)) || {};
      d.looked = want;
    }
    // 卡掉了救回来（她 2026-10-14：「经常说点应用就可以了但是卡没发出来，有时候好几轮才成功」）：
    //   最常见的是 CSS 里的 [data-wk="bubble"] 那种双引号没转义，整段 JSON 一下就坏了，所有卡一起丢。
    //   ① 先在原文里一张张抠：认 "target" 打头，text 读到下一个字段名为止（里头有没转义的引号也不怕）
    //   ② 还是一张没有、它嘴上又说了有卡：自动再问它一次，只要改动稿
    const listOf = o => Array.isArray(o.patches) ? o.patches : Array.isArray(o.cards) ? o.cards : Array.isArray(o.changes) ? o.changes : (o.patch && typeof o.patch === "object") ? [o.patch] : [];
    if (!listOf(d).length && /"target"\s*:/.test(raw)) {
      const got = salvagePatches(raw);
      if (got.length) d = Object.assign({}, d, { patches: got, reply: d.reply || salvageField(raw, "reply") });
    }
    const saidCard = o => /改动卡|改动稿|卡片|卡在下面|点.{0,3}应用/.test(String(o.reply || "")) || /"patches"\s*:\s*\[\s*\{/.test(raw);
    if (!listOf(d).length && saidCard(Object.keys(d).length ? d : { reply: raw }) && !(signal && signal.aborted)) {
      try {
        const raw2 = await callAI(active, sysText, msgs.concat([{ role: "assistant", content: String(raw).slice(0, 60000) },
          { role: "user", content: "（系统：你上一条说有改动卡，但卡没写出来或者格式坏了，她那边一张都没收到。别重复说话，只把这一轮的改动稿重新发一遍："
            + "只输出 {\"reply\":\"\",\"patches\":[...]}。text 里的双引号一律写成 \\\"，换行写成 \\n。）" }]),
          { maxTokens: 65000, timeout: 600000, stream: true, signal: signal || undefined });
        let d2 = (typeof parseJSONLoose === "function" ? parseJSONLoose(raw2) : extractJSON(raw2)) || {};
        if (!listOf(d2).length && /"target"\s*:/.test(raw2)) d2 = { patches: salvagePatches(raw2) };
        if (listOf(d2).length) d = Object.assign({}, d, { patches: listOf(d2), reply: d.reply || salvageField(raw, "reply") || "" });
      } catch (e) {}
    }
    // 世界书只改关键词／常驻／绑谁的那种（她 2026-10-10 截图：「4 条常驻改成关键词」两次都没出卡）：
    //   正文一个字不动，text 本来就该空着——原来这道筛子只认有正文的，四张卡被当成空的整批丢掉，回话却照样说「卡在下面」
    const loreMetaOnly = x => x.target === "lore" && x.id && x.id !== "new" && !String(x.text || "").trim()
      && (x.keyword != null || x.always != null || String(x.bind || "").trim() || String(x.cat || "").trim() || String(x.stamps || "").trim() || String(x.priority || "").trim());
    // 有的模型把改动稿放进别的名字里（cards／changes／patch 单张），或者关键词写成 keywords 数组——
    //   她 2026-10-12 截图：秋秋连说两遍「卡在下面」，一张都没出。认得出就收下，认不出下面照实说。
    const rawList = Array.isArray(d.patches) ? d.patches : Array.isArray(d.cards) ? d.cards : Array.isArray(d.changes) ? d.changes
      : (d.patch && typeof d.patch === "object") ? [d.patch] : [];
    const rawPatches = rawList.map(x => {
      if (!x || typeof x !== "object") return x;
      if (x.keyword == null && x.keywords != null) x = Object.assign({}, x, { keyword: Array.isArray(x.keywords) ? x.keywords.join("、") : String(x.keywords) });
      if (Array.isArray(x.keyword)) x = Object.assign({}, x, { keyword: x.keyword.join("、") });
      return x;
    });
    // 关系那一条 text 空着＝删掉这条线，是正经的一张卡
    const relDrop = x => x.target === "rel" && String(x.id || "").trim();
    // 清空某一格 CSS（她 2026-10-17 截图：秋秋连着四次「改动稿格式不对」）＝整份换成空：
    //   whole 填了、text 是空的那张卡是合法的，原来被「没正文」这道一起丢了
    const CSS_CLEAR_OK = { chatcss: 1, offlinecss: 1, groupcss: 1 };
    const S0id = x => String((x && x.id) || "").trim();
    const cssClear = x => !!(CSS_CLEAR_OK[x.target] && (x.whole === true || x.whole === "true") && S0id(x));
    const patches = rawPatches.filter(x => x && TARGETS[x.target] && (String(x.text || "").trim() || cssClear(x) || loreMetaOnly(x) || relDrop(x) || (typeof window !== "undefined" && window.AssistExtras && window.AssistExtras.okWithoutText(x))))
      // 导世界书一份文件往往拆出十来条：全是世界书的那一轮放宽到 12 条，别的照旧 3 条
      // 导世界书、把一串人连起来：全是世界书／关系／配角的那一轮放宽到 12 张
      .slice(0, (rawPatches.length && rawPatches.every(x => x && BULK_OK[x.target])) ? 12 : 3)
      .map((x, i) => ({
        pid: "p" + Date.now() + "_" + i,
        target: x.target, id: String(x.id || "").trim(),
        field: String(x.field || "").trim(),
        find: String(x.find || ""),          // 有 find＝只改这一段，别处一个字节不动
        append: x.append === true || x.append === "true",   // 接在这一栏最后（长人设一段一段续；CSS 加几条新规则）
        whole: x.whole === true || x.whole === "true",       // CSS 整份重做：只有她说了「整体重做／全部换掉」才填

        title: clip(x.title, 60) || TARGETS[x.target].zh,
        name: clip(x.name, 30), text: String(x.text || "").trim(), why: clip(x.why, 200),
        ...(x.target === "rel" ? { both: x.both === true || x.both === "true" } : {}),
        ...(/^(memedit|closet|cal|wish|anniv|presetmod)$/.test(x.target) ? { drop: x.drop === true || x.drop === "true", date: clip(x.date, 12), occasion: clip(x.occasion, 20), view: clip(x.view, 60) } : {}),
        ...(x.target === "wish" ? { type: clip(x.type, 10), done: x.done === true || x.done === "true" } : {}),
        ...(x.target === "anniv" ? { yearly: !(x.yearly === false || x.yearly === "false") } : {}),
        ...(x.target === "sched" ? { time: clip(x.time, 5) } : {}),
        ...(x.target === "lore" ? { cat: clip(x.cat, 6), stamps: clip(x.stamps, 80), priority: clip(x.priority, 2), keyword: x.keyword == null ? undefined : clip(x.keyword, 200), always: x.always == null ? undefined : (x.always === true || x.always === "true"), bind: clip(x.bind, 120) } : {})
      }));
    // 现成的 Worker 代码（她 2026-10-13「有些人直接复制不了，让他们用秋秋发的复制」）：
    //   模型只报是哪一段，代码从 App 里那一份原样取——模型抄一遍，少一个括号整段就不能用。
    const WORKER_CODE = {
      health: () => window.HealthCtx && window.HealthCtx.GATEWAY_WORKER ? { name: "秋秋机-健康网关-worker.js", text: window.HealthCtx.GATEWAY_WORKER } : null,
      fish: () => typeof FISH_RELAY_CODE === "string" ? { name: "秋秋机-Fish语音中转-worker.js", text: FISH_RELAY_CODE } : null,
      // MCP 转接：跟设置里「复制转接代码」同一份文件（tools/mcp-relay-worker.js），现取
      mcp: async () => { try { const c = await (await fetch("tools/mcp-relay-worker.js", { cache: "no-store" })).text(); return /export default/.test(c) ? { name: "秋秋机-MCP转接-worker.js", text: c } : null; } catch (e) { return null; } }
    };
    const codeKey = String(d.code || "").trim().toLowerCase();
    const codeFile = WORKER_CODE[codeKey] ? await WORKER_CODE[codeKey]() : null;
    // 她要拿走的那份文件：原样保留（不洗代码——那是交给她的东西，不是正文）
    const outFile = codeFile || (d.file && typeof d.file === "object" && String(d.file.text || "").trim()
      ? { name: (String(d.file.name || "秋秋给你的文件.txt").replace(/[\\/:*?"<>|\n]/g, "").trim().slice(0, 60) || "秋秋给你的文件.txt"), text: String(d.file.text).slice(0, 400000) } : null);
    let reply = scrubCode(String(d.reply || "").trim());
    // 它说了有卡、一张都没留下：照实告诉她，别让她对着「快点应用」找半天
    // 她扔来一份分条写好的预设 json（她 2026-10-16「扔给秋秋也能拆」）：不靠模型抄——几万字的预设模型抄一遍必走样，
    //   照文风台导入同一个拆法（StylePresets.fromPromptList）原样拆好，直接摆一张文风台预设卡；模型自己出了预设卡就不另加
    try {
      if (isFile && window.StylePresets && window.StylePresets.fromPromptList && !patches.some(x => x.target === "preset")) {
        const tv = window.StylePresets.fromPromptList(JSON.parse(String(pic.text || "")), String(pic.name || "").replace(/\.json$/i, ""));
        if (tv) {
          const on = {}; tv.presets[0].mods.forEach(id => { on[id] = 1; });
          patches.push({ pid: "p" + Date.now() + "_tv", target: "preset", id: "new", field: "", find: "", append: false, whole: false,
            title: "文风台预设（照文件原样拆）", name: tv.presets[0].name,
            text: JSON.stringify(tv.modules.map(m => Object.assign({ name: m.name, hint: "", text: m.text }, on[m.id] ? {} : { off: true }))),
            why: "一共 " + tv.modules.length + " 条，原来开着的 " + tv.presets[0].mods.length + " 条照顺序勾进预设，关着的只进模块库" });
        }
      }
    } catch (e) {}
    if (rawPatches.length && !patches.length) reply = (reply ? reply + "\n\n" : "") + "（这一轮的 " + rawPatches.length + " 张改动稿格式不对，没能做成卡片。再叫它一次就好。）";
    // 嘴上说有卡、实际一张改动稿都没写：也照实说，别让她对着「点应用」找
    else if (!rawPatches.length && /改动卡|改动稿|卡片|卡在下面|点.{0,3}应用/.test(reply)) reply += "\n\n（这一轮它说了有改动卡，但其实一张都没写出来。再跟它说一次「把卡给我」就好。）";
    // 有些线路会无视 JSON 外壳，直接把已经写好的正文吐出来。纯问答没有 patch，
    // 这时保住正文比让她为同一个问题再付一次更重要；写入仍只认上面的结构化白名单。
    if (!reply && !patches.length) {
      let plain = String(raw || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
      const quoted = plain.match(/"reply"\s*:\s*"((?:\\.|[^"\\])*)"/);
      if (quoted) { try { plain = JSON.parse('"' + quoted[1] + '"'); } catch (_) {} }
      reply = scrubCode(plain);
    }
    if (!reply && !patches.length && !outFile) throw new Error("线路没有返回可读内容，可以再问一次");
    // reply 空着只剩卡（她 2026-10-17「秋秋坏了都不说话了只会发卡」）：不拿一句「改动稿在下面」糊过去——
    //   那句会进对话记录，下一轮它照着自己学，越来越只会发卡。照卡上写的说清这几张改了什么、为什么。
    if (!reply && patches.length) reply = patches.map(x => "· " + (String(x.title || "").trim() || "一处改动") + (String(x.why || "").trim() ? "：" + String(x.why).trim() : "")).join("\n");
    try { applyMem(d.remember, d.forget); } catch (e) {}
    return { reply: reply || (outFile ? "文件在下面。" : "改动稿在下面。"), patches, file: outFile };
  }

  // ---- 她此刻在哪一页（她 2026-09-03 点名要的）----
  // 借的是 ai-virtual-phone 那个「页面上下文」的【想法】（AGPL，只看不抄）：
  // 助手知道你正开着哪一页，「这一页」「这里」「TA」才有指代对象。
  // 一张表两用：给它一句人话说清在哪儿，再顺手把这一页的手册词条捎上，
  // 于是「这一页是干嘛的」不用她先说出这一页叫什么。
  // 值是 [人话, 手册词条 id]；手册里没有对应词条的就留空。
  // 【这一页对应手册的哪一条】。页名不写在这儿——那份在 core.js 的 SCREEN_ZH 里，
  // 全库唯一（主题工作台的页面 CSS 下拉用的是同一份）。
  // ⚠️原来这儿存的是「页名 + 手册 id」两样，跟工作台那份页名各写各的，
  //   于是一处五十页、一处十页，谁也不知道对方漏了什么。
  const SCREEN_MAN = {
    home: "home", messages: "chat", thread: "chat", gthread: "group",
    contact: "cast", cast: "cast", castForm: "cast", ties: "ties",
    phone: "phone", shop: "shop", takeout: "takeout", carry: "carry", mycloset: "closet", dwell: "dwell",
    cwallet: "wallet", wallet: "wallet", kincard: "wallet", mykin: "wallet", ledger: "ledger",
    calendar: "calendar", memo: "memo", map: "map",
    listen: "listen", musiccard: "listen",
    diary: "diary", lore: "lore", memlib: "memlib", anon: "anon", anonme: "anon",
    study: "study", fanfic: "fanfic", read: "read", watch: "watch", weekly: "weekly", debate: "debate", live: "shua", shua: "shua",
    dream: "dream", dreamjournal: "dreamjournal", tarot: "tarot", astro: "astro", zhaoying: "zhaoying", stamps: "stamps", health: "health", pomodoro: "pomodoro", companion: "companion",
    games: "games", fairyGarden: "fairyGarden", trpg: "trpg", theater: "theater", impression: "impression", shike: "shike",
    yanqiu: "yanqiu", loungeapp: "lounge", rescue: "rescue", vpscodex: "vpscodex",
    forum: "forum", momprofile: "moments", us: "couple",
    favorites: "favorites", emotes: "emotes", stylelab: "stylelab", nest: "nest",
    config: "config", assistant: "assistant", codex: "codex"
  };
  function pageOf(pg) {
    if (!pg || !pg.screen) return null;
    const Z = typeof SCREEN_ZH !== "undefined" ? SCREEN_ZH : {};
    const zh = Z[pg.screen] || "";
    if (!zh) return null;
    return { zh: zh, man: SCREEN_MAN[pg.screen] || "", who: pg.charName || "", whoId: pg.charId || "" };
  }
  function pageLine(pg) {
    // 线下是盖在聊天页上面的一层，screen 还是 thread（群友 2026-10-26：线下改了十轮字色都是黑的——
    //   秋秋以为她在聊天页，一直写进聊天窗 CSS、改的是气泡里的 strong）。线下开着就照实说她在线下
    let off = "";
    try { off = (typeof document !== "undefined" && document.documentElement.getAttribute("data-lisa-offchar")) || ""; } catch (e) {}
    if (off) {
      const p0 = pageOf(pg) || {};
      return "【她此刻在哪儿】她正开着「" + (p0.who || "这个人") + "」的【线下见面】那一层（id＝" + off + "），不是线上聊天窗。"
        + "她说「这里」「字」「颜色」「加粗的」的时候，指的是线下这一层：改样子写 offlinecss（id 填这个），不是 chatcss、不是 bubble。"
        + "线下正文是 offtext；引号里那几句台词（加粗、带底色的那种）是 offsay，不是 strong／b；心声是 offthought。"
        + "台词自带内联字色，要改台词颜色就直接写 [data-wk=\"offsay\"]，带 !important。";
    }
    const p = pageOf(pg); if (!p) return "";
    return "【她此刻在哪儿】她正开着「" + p.zh + "」"
      + (p.who ? "，这一页上是「" + p.who + "」" : "")
      + (p.whoId ? "（id＝" + p.whoId + "，要改这个聊天窗的气泡就填这个 id，别再问她是谁）" : "")
      + "。她说「这一页」「这里」"
      + (p.who ? "「他」「TA」" : "") + "的时候，指的就是这个；别再反问她是哪一页。";
  }

  // ---- 「改一小段」（她 2026-09-03：「比如里面改一小段」）----
  // 整份重打一遍是危险的：一张四千字的人设，让它整段重写只为了动一句话，
  // 别处被顺手改写、漏掉一段，她根本看不出来（改前改后并排摆着也没人逐字比四千字）。
  // 所以真正的「改一小段」是：它逐字抄出原文那一段（find），再给替换的那一段；
  // 【替换在本地做】，别处一个字节都不动。这不是提示词能保证的事，是代码保证的。
  const cut30 = t => { const x = String(t || "").replace(/\s+/g, " ").trim(); return x.length > 30 ? x.slice(0, 30) + "…" : x; };
  const reEsc = t => String(t).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // 空白对不上是常事（它重抄的时候换了换行）：把空白折成 \s+ 再找一次，
  // 找到了也按【原文的边界】切，替换回去的还是原文那一段。
  function fuzzySpan(hay, needle) {
    const pat = String(needle).trim().split(/\s+/).map(reEsc).join("\\s+");
    if (!pat) return null;
    let re; try { re = new RegExp(pat, "g"); } catch (e) { return null; }
    const found = [];
    let m; while ((m = re.exec(hay)) !== null) { found.push([m.index, m.index + m[0].length]); if (re.lastIndex === m.index) re.lastIndex++; }
    return found.length === 1 ? found[0] : null;
  }
  function snippetEdit(cur, find, repl) {
    const s0 = String(cur == null ? "" : cur), f = String(find || "");
    if (!f.trim()) throw new Error("没说要改原文里的哪一段");
    const i = s0.indexOf(f);
    if (i >= 0) {
      if (s0.indexOf(f, i + f.length) >= 0) throw new Error("「" + cut30(f) + "」在原文里出现了不止一处，说不清要改哪一段");
      return s0.slice(0, i) + repl + s0.slice(i + f.length);
    }
    const span = fuzzySpan(s0, f);
    if (!span) throw new Error("原文里找不到「" + cut30(f) + "」——它可能记错了，没敢动");
    return s0.slice(0, span[0]) + repl + s0.slice(span[1]);
  }

  // 上一次给它看过多少字。整段替换之前要拿它兜一道：
  // 只看过前 300 字就敢整段替换的话，一张四千字的卡当场只剩 300 字——
  // 这正是它自己一直在担心的那件事（「我不能把半截当全文直接出 patch」），
  // 光靠它自觉不行，得代码拦住。
  const shownLen = {};
  const shownKey = (target, id, field) => target + ":" + id + (field ? ":" + field : "");

  // ---- 改完还能退回来（她 2026-09-03 点名要的）----
  // 借的还是 ai-virtual-phone 那个想法（AGPL，只看不抄）：写之前先存一版。
  // ⚠️它那边是【拿备份代替过目】——直接落库，后悔了翻版本。我们不换：
  //   秋秋照旧先出改动稿、由她点头。这一层是【第二道网】，管的是
  //   「点了应用之后才后悔」那一种，她现在完全退不了。
  // ⚠️也照它那条教训：备份只保了角色卡，CSS/世界书/预设改坏了没得退。
  //   所以这儿凡是【能写回去】的栏一律存，存不了的那两种明说存不了。
  const UNDO_KEY = "x_assistUndo";
  const UNDO_KEEP = 40;
  // 能退的：原样写回去就行的那几种。
  // memory 退不了（往里加，没有写回的路）；style 新建也退不了（那要删，不是写回）。
  const UNDOABLE = { persona: 1, appearance: 1, profile: 1, rules: 1, lore: 1, theme: 1, style: 1, bubble: 1, chatcss: 1, chatlayout: 1, offlinecss: 1, groupcss: 1, grouplayout: 1 };
  // 聊天窗那几栏（她 2026-10-05：「秋秋也可以自己退它做错的」）：存的不是 before() 那段人话，
  //   是这一层长相那几栏的原样（engine.js lookPick），退的时候整层写回去——气泡那份 JSON 也就退得动了。
  const WIN_KIND = { bubble: "chat", chatcss: "chat", chatlayout: "chat", offlinecss: "offline", groupcss: "group", grouplayout: "group" };
  const WIN_STORE = { chat: "x_chatSettings", offline: "x_offlineSettings", group: "x_groupSettings" };
  const winLook = (kind, id) => (typeof lookPick === "function" ? lookPick(kind, (loadJ(WIN_STORE[kind], {}) || {})[id]) : {});
  function writeLook(kind, id, look, ctx) {
    const full = typeof lookFullPatch === "function" ? lookFullPatch(kind, look) : look;
    const fn = kind === "chat" ? ctx.onPatchChatSetting : kind === "group" ? ctx.onPatchGroupSetting : ctx.onPatchOfflineSetting;
    if (!fn) throw new Error("这个页面没接聊天窗写入口");
    fn(id, full);
  }
  function undoable(patch) {
    if (!patch || !UNDOABLE[patch.target]) return false;
    if (patch.target === "style" && !patch.id) return false;   // 新建的那一份没有「原来的样子」
    if (patch.target === "lore" && (!patch.id || patch.id === "new")) return false;
    return true;
  }
  function loadUndo() { try { const a = JSON.parse(localStorage.getItem(UNDO_KEY) || "[]"); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  const undoSubs = new Set();
  function onUndo(fn) { undoSubs.add(fn); return () => undoSubs.delete(fn); }
  function saveUndo(list) {
    const a = (Array.isArray(list) ? list : []).slice(0, UNDO_KEEP);
    try { localStorage.setItem(UNDO_KEY, JSON.stringify(a)); } catch (e) {}
    undoSubs.forEach(fn => { try { fn(a); } catch (e) {} });
    return a;
  }
  function pushUndo(patch, ctx) {
    if (!undoable(patch)) return null;
    const uid = "u" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    saveUndo([{
      uid: uid, pid: patch.pid || "", ts: Date.now(),
      target: patch.target, id: patch.id, field: patch.field || "",
      label: labelOf(patch, ctx), title: patch.title || "",
      prev: WIN_KIND[patch.target] ? JSON.stringify(winLook(WIN_KIND[patch.target], patch.id)) : String(before(patch, ctx) || "")
    }].concat(loadUndo()));
    return uid;
  }
  // 退回去：把存下来的那一份原样写回。走的是同一个写入口，不另开一条路。
  function undo(uid, ctx) {
    const list = loadUndo();
    const e = list.find(x => x && x.uid === uid);
    if (!e) throw new Error("这一条的旧版本已经不在了");
    if (e.undone) throw new Error("这一条已经退回过了");
    const T = TARGETS[e.target];
    if (!T) throw new Error("不认识的改动类型");
    if (WIN_KIND[e.target]) { let look = {}; try { look = JSON.parse(e.prev || "{}"); } catch (x) {} writeLook(WIN_KIND[e.target], e.id, look, ctx); }
    else T.write(e.id, { target: e.target, id: e.id, field: e.field, text: e.prev }, ctx);
    saveUndo(list.map(x => x.uid === uid ? Object.assign({}, x, { undone: true, undoneAt: Date.now() }) : x));
    if (e.pid) markPatch(e.pid, "已撤回");
    return e;
  }

  // 应用一条改动稿。写入口全在 TARGETS 里，这里只做校验、算出最终文本，再分发。
  function apply(patch, ctx) {
    const T = TARGETS[patch.target];
    if (!T) throw new Error("不认识的改动类型");
    if (patch.target !== "style" && patch.target !== "newchar" && patch.target !== "npc" && !(patch.target === "lore" && (!patch.id || patch.id === "new")) && !patch.id) throw new Error("这条没说要改谁");
    const p = patch;
    // ⚠️存旧版本必须在【写之前】，而且要在算最终文本之前——
    //   算完再存的话，改一小段那一支拿到的已经是新文本了，等于备份了个假的。
    pushUndo(p, ctx);
    // 接着往后写（她 2026-10-06：长人设一段一段续）：只给人设、外貌、档案那几栏开，接在这一栏现有内容的最后
    // 美化那几栏（她 2026-10-13：「要它改某一个小部分，它的改动会牵扯到我不想改的地方」）：
    //   原来常常是整份 CSS 重写一遍，照抄旧规则时抄漏抄错，没让它动的地方也跟着变了。
    //   现在原来有东西的话，只许「改一小段」(find) 或「在后面加」(append)；整份重做要它自己标 whole。
    const CSS_T = { theme: 1, chatcss: 1, offlinecss: 1, groupcss: 1 };
    if (CSS_T[p.target] && p.append && !p.find) {
      const cur = String(before(p, ctx) || "").replace(/\s+$/, "");
      return T.write(p.id, Object.assign({}, p, { text: (cur ? cur + "\n\n" : "") + String(p.text || "").replace(/^\s+/, "") }), ctx);
    }
    // 原来有 CSS、这条却是整份写的（群里 2026-10-17：「我已经弹了好几次了」——原来是直接拒，她只能一遍遍按「再试一次」，秋秋还照样整份写）：
    //   不再拒。新的那份里已经把旧的原样包进去了，就当整份收下；不然就把它接在旧的后面——
    //   CSS 后写的赢，她要改的那几处照新的来，没提到的旧规则一条不少，别处不会被跟着改掉。
    if (CSS_T[p.target] && !p.find && !p.whole && String(before(p, ctx) || "").trim()) {
      const cur = String(before(p, ctx) || "").replace(/\s+$/, ""), nx = String(p.text || "");
      if (nx.indexOf(cur.trim()) >= 0) return T.write(p.id, p, ctx);
      return T.write(p.id, Object.assign({}, p, { text: cur + "\n\n" + nx.replace(/^\s+/, "") }), ctx);
    }
    if (p.append && !p.find) {
      if (!(p.target === "persona" || p.target === "appearance" || p.target === "profile")) throw new Error("只有人设、外貌、档案和美化 CSS 那几栏能接着往后写");
      const cur = String(before(p, ctx) || "").replace(/\s+$/, "");
      return T.write(p.id, Object.assign({}, p, { text: (cur ? cur + "\n\n" : "") + String(p.text || "").replace(/^\s+/, "") }), ctx);
    }
    if (p.find) {
      // 记忆库是往里加，没有「原文那一段」可言
      if (p.target === "memory") throw new Error("记忆库是往里加的，不能改一小段");
      // 气泡那一栏是 JSON：在里头替换一小段，出来多半不再是合法 JSON
      if (p.target === "bubble") throw new Error("气泡这一栏要整份给，不能改一小段");
      // 配色那一栏同理：它是一份 JSON，在里头替换一小段，出来多半不再是合法 JSON
      if (p.target === "pagecolor") throw new Error("配色这一栏要整份给，不能改一小段");
      if (p.target === "newchar") throw new Error("新建角色要整份给，不能改一小段");
      if (p.target === "mask") throw new Error("面具要给一份 JSON，人设改一小段也给改完的全文");
      if (p.target === "chatlayout" || p.target === "grouplayout") throw new Error("排版这一栏要整份给，不能改一小段");
      const cur = before(p, ctx);
      if (!String(cur || "").trim()) throw new Error("原来这一栏是空的，没有可改的一小段");
      return T.write(p.id, Object.assign({}, p, { text: snippetEdit(cur, p.find, p.text) }), ctx);
    }
    // 整段替换：只看过半截就不许整段替换
    if (p.target === "persona" || p.target === "appearance" || p.target === "profile" || (p.target === "lore" && p.id && p.id !== "new" && String(p.text || "").trim())) {
      const cur = String(before(p, ctx) || "");
      const seen = shownLen[shownKey(p.target, p.id, p.field)];
      if (cur && seen != null && seen < cur.length)
        throw new Error("它只看过这一栏的前 " + seen + " 字（一共 " + cur.length + " 字），不许整段替换——让它改用「改一小段」，或者先跟它说清是哪张卡");
    }
    return T.write(p.id, p, ctx);
  }

  // 改之前长什么样——界面要把改前改后并排摆出来
  // ⚠️档案那一栏要按 field 去卡里取，不能沿用 row.text：
  //   profile 的 read 给不出「哪一栏」的内容，照抄的话改前永远空着，
  //   她就等于在盲改（看不见原来写的是什么）。
  function before(patch, ctx) {
    const T = TARGETS[patch.target];
    if (!T) return "";
    if (typeof T.before === "function") { try { return String(T.before(patch, ctx) || ""); } catch (e) { return ""; } }
    const rows = T.read(ctx) || [];
    const hit = rows.find(x => String(x.id) === String(patch.id));
    if (!hit) return "";
    if (patch.target === "profile") return String((hit.card || {})[patch.field] || "");
    return String(hit.text || "");
  }

  // 摆给她看的那一份：气泡那一栏存的是 JSON，直接摆出来的话，改前是人话、改后是一串
  // 花括号，两边根本没法并排比。所以摆之前翻成同一种人话——洗过的那几栏，跟真会落进去的一致。
  const previewText = patch => {
    if (patch && patch.drop) return "（删掉这一条）";
    if (patch && patch.target === "danger") return "⚠️ " + String(patch.text || patch.id) + "\n" + (window.AssistExtras ? window.AssistExtras.DANGER_WARN : "");
    if (patch && patch.target === "auto") return String(patch.id).split(":")[1] + "：" + String(patch.text || "");
    if (patch && patch.target === "setting") { const d = window.AssistExtras && window.AssistExtras.SET_BY[String(patch.id).split(":")[1]]; return (d ? d.zh : "") + "：" + String(patch.text || ""); }
    if (patch && patch.target === "roomset") return String(patch.id).split(":")[2] + "：" + String(patch.text || "");
    if (patch && /^(gsetting|osetting|global)$/.test(patch.target)) { const A = window.AssistExtras || {}; const k = String(patch.id).split(":").pop();
      const d = (patch.target === "global" ? A.GLOBALS : patch.target === "gsetting" ? A.GROUP_SETTINGS : A.OFFLINE_SETTINGS || []).find(x => x.key === k); return (d ? d.zh : k) + "：" + String(patch.text || ""); }
    if (patch && patch.target === "preset") { try { const a = JSON.parse(String(patch.text || "")); const L = Array.isArray(a) ? a : (a.mods || []);
      return "预设「" + (patch.name || "秋秋搭的预设") + "」\n" + L.map((m, i) => (i + 1) + ". " + (m.off ? "（只进模块库、不勾）" : "") + (m.use ? "（现成的）" + m.use : (m.name || "") + (m.hint ? "——" + m.hint : "") + "\n   " + String(m.text || "").slice(0, 400))).join("\n"); } catch (e) { return String(patch.text || ""); } }
    if (patch && patch.target === "presetmod") return /:\+/.test(String(patch.id)) ? "勾进来：" + String(patch.id).split(":+")[1] : (patch.name ? patch.name + "：" : "") + String(patch.text || "");
    if (patch && patch.target === "sched") return [patch.time, patch.name, String(patch.text || "").trim() ? "@ " + patch.text : ""].filter(x => String(x || "").trim()).join(" ");
    if (patch && patch.target === "wish") return patch.done ? "（标成做到了）" : [patch.type ? "【" + patch.type + "】" : "", patch.name, patch.text].filter(x => String(x || "").trim()).join(" ");
    if (patch && patch.target === "anniv") return [patch.date, patch.name, patch.yearly === false ? "（只这一次）" : "（每年）"].filter(Boolean).join(" ");
    if (patch && patch.target === "cal") return [patch.date, patch.name, patch.text].filter(x => String(x || "").trim()).join("　");
    if (patch && patch.target === "closet") return (patch.occasion ? "【" + patch.occasion + "】" : "") + (patch.name || "") + (String(patch.text || "").trim() ? "：" + patch.text : "");
    if (patch && patch.append && !patch.find) return "（接在最后）\n" + String(patch.text || "");
    if (patch && patch.target === "rel") return String(patch.text || "").trim() ? patch.text + (patch.both ? "（两个方向都是）" : "") : "（删掉这条关系）";
    if (patch && patch.target === "npc") {
      try { const o = parseJSONLoose(patch.text) || {}; return ["名字：" + (o.name || ""), o.owner ? "在谁身边：" + o.owner : "不挂在谁身边", o.brief ? "简介：" + o.brief : "",
        (o.links || []).length ? "认识：" + o.links.map(l => (l.who || l.id) + (l.label ? "（" + l.label + "）" : "")).join("、") : ""].filter(Boolean).join("\n"); } catch (e) { return String(patch.text || ""); }
    }
    if (patch && patch.target === "lore" && !String(patch.text || "").trim())
      return ["（正文不动）", patch.keyword != null ? (String(patch.keyword).trim() ? "关键词：" + patch.keyword : "关键词：清空（一直在）") : "",
        patch.always != null ? (patch.always ? "常驻" : "不常驻，聊到关键词才翻出来") : "", String(patch.bind || "").trim() ? "绑给：" + patch.bind : ""].filter(Boolean).join("\n");
    if (patch && patch.target === "newchar") {
      const o = newCharObj(patch.text);
      if (!o) return String(patch.text || "");
      return ["名字：" + o.name, ...Object.keys(CARD_FIELDS).filter(k => o[k]).map(k => CARD_FIELDS[k] + "：" + o[k]),
        o.appearance ? "外貌：\n" + o.appearance : "", "人设：\n" + o.persona].filter(Boolean).join("\n");
    }
    if (!patch || patch.target !== "bubble") return String((patch && patch.text) || "");
    let o = null; try { o = parseJSONLoose(patch.text || ""); } catch (e) { o = null; }
    const c = o && typeof sanitizeBubblePatch === "function" ? sanitizeBubblePatch(o) : null;
    return c ? bubbleText(c) : String(patch.text || "");
  };

  function labelOf(patch, ctx) {
    const T = TARGETS[patch.target];
    const rows = (T && T.read(ctx)) || [];
    const hit = rows.find(x => String(x.id) === String(patch.id));
    const fld = patch.target === "profile" && CARD_FIELDS[patch.field] ? " · " + CARD_FIELDS[patch.field] : "";
    return (T ? T.zh : "?") + (hit ? " · " + hit.name : (patch.target === "style" ? " · 新建" : patch.target === "newchar" ? " · " + ((newCharObj(patch.text) || {}).name || "未命名") : "")) + fld;
  }

  window.Assistant = { loadMem, saveMem, onMem, ask, apply, before, labelOf, snapshot, TARGETS, CARD_FIELDS, codeQuestion, scrubCode, CODE_REPLY,
    previewText, cancelAsk, setAbort: ac => { curAbort = ac; }, setLastPic: p => { lastPic = p; }, lastPic: () => lastPic, loadCfg, saveCfg, DEFAULT_PROMPT, LEGACY_PROMPTS, DEFAULT_NAME, loadChat, saveChat, onChat, chatWindow, onBusy, isBusy, bumpBusy, markPatch, undo, undoable, loadUndo, onUndo, UNDO_KEEP, markAsking, clearAsking, staleAsking, ASK_KEY, CHAT_KEEP, CTX_CHARS, CTX_MIN, activeFor, focusIds, buildSystem, pageOf, pageLine, SCREEN_MAN, snippetEdit, shownLen };
})();

// ============================================================
// 界面：一问一答 + 改动稿卡片（改前/改后并排，逐条应用）
//   · AssistantApp   整页版（主屏第三页那个图标）
//   · AssistantDock  小悬浮屏（能拖，边看功能边问）
//   · AssistantSetup 设置页（名字 / 头像 / 主人格提示词 / 小球开关）
// 三处共用同一段对话、同一份改动稿卡片、同一套收发。
// ============================================================
(function () {
  const useState = React.useState, useRef = React.useRef, useEffect = React.useEffect;
  const A = window.Assistant;
  // 秋秋回话里的 **粗体**：模型顺手写了 Markdown，原样摆出来就是一串星号（她 2026-10-24 截图）。
  //   成对的就加粗，落单的星号原样留着；复制出去的还是原文
  const qqBold = txt => { const s0 = String(txt || ""); if (s0.indexOf("**") < 0) return s0;
    const parts = s0.split(/\*\*([^*\n]+?)\*\*/g); return parts.map((x, k) => k % 2 ? h("b", { key: k, style: { fontWeight: 700 } }, x) : x); };

  // ---- 秋秋的默认头像（v61.43，她 2026-09-03 给了图：「左边是头像右边是图标」）----
  // 原来是程序画的那只线稿肥鸟；现在换成她那张画。
  // ⚠️两张图是从她那一张里切出来的，各自裁掉了透明边、按正方形居中、存成 webp
  //   （同一张画 png 要 80KB，webp 只要 15KB——这是要跟着 PWA 一起装的东西）。
  // ⚠️头像那张【原图带透明底】，所以这里自己垫一层奶油底：不垫的话深色主题下
  //   小鸡的浅黄会糊进深背景里，只剩两只眼睛浮着。
  // 秋秋记着的（她 2026-10-26）：一行一件事，能改、能删、能自己加、能全清。清聊天记录不碰它
  function QiuMemList(props) {
    const t = props.t, A = window.Assistant;
    const [list, setList] = useState(() => (A && A.loadMem ? A.loadMem() : []));
    const [open, setOpen] = useState(false);
    useEffect(() => A && A.onMem ? A.onMem(l => setList(l.slice())) : undefined, []);
    const save = l => { A.saveMem(l); setList(l.slice()); };
    const small = { background: "none", border: "none", padding: "4px 6px", fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))" };
    return h("div", { "data-wk": "qqmem", style: { padding: "12px 14px", borderBottom: "1px solid " + t.line } },
      h("button", { onClick: () => setOpen(v => !v), style: { width: "100%", display: "flex", alignItems: "center", background: "none", border: "none", padding: 0, textAlign: "left" } },
        h("div", { style: { flex: 1 } },
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", color: t.ink } }, props.name + "记着的 · " + list.length + " 条"),
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog, marginTop: 2, lineHeight: 1.5 } }, "你怎么用这个 App、喜欢什么。聊天里顺手记下，每次只带跟这句有关的几条，不多花调用；清空聊天记录不会清掉这里。")),
        h("span", { style: { color: t.fog, fontSize: "calc(13px * var(--app-fs, 1))" } }, open ? "收起" : "看看 ›")),
      open ? h("div", { style: { marginTop: 10 } },
        list.length ? list.map((m, i) => h("div", { "data-wk": "qqmemrow", key: m.id || i, style: { display: "flex", alignItems: "flex-start", gap: 6, padding: "7px 0", borderTop: i ? "1px solid " + t.line : "none" } },
          h("div", { style: { flex: 1, fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.ink, lineHeight: 1.6 } }, m.text),
          h("button", { onClick: () => requestAppPrompt("改这一条", "", m.text, v => { const x = String(v || "").trim(); if (!x) return; save(list.map(y => y === m ? Object.assign({}, y, { text: x.slice(0, 80) }) : y)); }, "存"), style: Object.assign({ color: t.tint }, small) }, "改"),
          h("button", { onClick: () => save(list.filter(y => y !== m)), style: Object.assign({ color: t.accent }, small) }, "删"))) :
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.fog, padding: "4px 0" } }, "还没记过什么。跟" + props.name + "说说你用什么手机、喜欢什么样的，她会记下来。"),
        h("div", { style: { display: "flex", gap: 14, marginTop: 8 } },
          h("button", { onClick: () => requestAppPrompt("自己记一条", "写一件想让" + props.name + "一直记着的事。", "", v => { const x = String(v || "").trim(); if (x) save(list.concat([{ id: "qm" + Date.now().toString(36), text: x.slice(0, 80), ts: Date.now() }])); }, "记下"), style: Object.assign({ color: t.tint }, small, { paddingLeft: 0 }) }, "＋ 自己记一条"),
          list.length ? h("button", { onClick: () => requestAppConfirm("全部清掉？", props.name + "记着的这 " + list.length + " 条会一起清掉，清了找不回来。", () => save([]), "清掉"), style: Object.assign({ color: t.accent }, small) }, "全部清掉") : null)) : null);
  }
  function QiuBird(props) {
    const z = props.size || 34, r = props.radius != null ? props.radius : z / 2;
    return h("div", { "data-wk": "qqavatar", style: { width: z, height: z, borderRadius: r, flexShrink: 0, overflow: "hidden",
      background: "#f7ecd6", display: "block" } },
      h("img", { src: "img/qiu-avatar.png", alt: "", draggable: false,
        style: { width: "100%", height: "100%", objectFit: "cover", display: "block" } }));
  }
  window.QiuBird = QiuBird;

  // 头像框：她换过照片就用照片，没换就是那只鸟
  function QiuFace(props) {
    const cfg = props.cfg || A.loadCfg();
    return cfg.avatarImage
      ? h(Avatar, { character: { name: cfg.name, avatarImage: cfg.avatarImage }, size: props.size || 34, radius: props.radius })
      : h(QiuBird, { size: props.size || 34, radius: props.radius });
  }
  function MeFace(props) {
    const p = props.profile || {};
    return h(Avatar, { character: { id: "me", name: p.name || "我", avatarImage: p.avatarImage, avatarEmoji: p.avatarEmoji, color: p.color }, size: props.size || 34, radius: props.radius });
  }

  // ---- 改动稿卡片：三处共用一份 ----
  // ⚠️别为悬浮屏另抄一份窄版出来。改前改后、应用/跳过这套东西是【一层】，
  //   抄成两份就等着哪天只改了其中一处（four-surfaces-same-context.md 那个形状）。
  function PatchCard(props) {
    const t = useTheme(), p = props.p, ctx = props.ctx, sm = !!props.compact;
    const [open, setOpen] = useState(false);
    const was = A.before(p, ctx);
    const shown = A.previewText(p);   // 气泡那一栏摆的是人话，不是那串 JSON
    const state = props.state;
    const cutNew = sm ? 130 : 220, cutOld = sm ? 90 : 140;
    return h("div", { "data-wk": "qqpatch", style: { marginTop: 10, borderRadius: 12, border: "1px solid " + t.line, background: t.bg2, overflow: "hidden" } },
      h("div", { style: { padding: sm ? "7px 10px" : "9px 12px", borderBottom: "1px solid " + t.line } },
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog, letterSpacing: ".05em" } }, A.labelOf(p, ctx)),
        h("div", { "data-wk": "qqpatchtitle", style: { fontFamily: F_DISPLAY, fontSize: sm ? 12.5 : 13.5, color: t.ink, marginTop: 2 } }, p.title),
        p.why ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.sub, marginTop: 4, lineHeight: 1.6 } }, p.why) : null),
      // 只改一小段的时候，摆的就是那一小段——不许把整份原文和整份新文摆出来让她自己找。
      // 那是这个改法的意义所在：她一眼看得清动了哪儿，也一眼看得出别处没动。
      // 跳转卡没有改前改后：只说要去哪儿（她 2026-10-16）
      p.target === "open"
        ? h("div", { style: { padding: sm ? "8px 10px" : "10px 12px", fontFamily: F_BODY, fontSize: sm ? 11.5 : 12.5, color: t.ink, lineHeight: 1.7 } }, was || "带你去那一页")
      : p.find
        ? h("div", { style: { padding: sm ? "8px 10px" : "10px 12px" } },
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog, marginBottom: 3 } }, "原文这一段"),
            h("div", { style: { fontFamily: F_BODY, fontSize: sm ? 11.5 : 12.5, color: t.fog, lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-word", textDecoration: "line-through", opacity: .8 } }, p.find),
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog, margin: "8px 0 3px" } }, "换成"),
            h("div", { style: { fontFamily: F_BODY, fontSize: sm ? 11.5 : 12.5, color: t.ink, lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-word" } }, p.text || "（删掉这一段）"),
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10px * var(--app-fs, 1))", color: t.fog, marginTop: 7 } },
              was ? "这一栏一共 " + was.length + " 字，别处一个字都不动" : "别处一个字都不动"))
        : h("div", { style: { padding: sm ? "8px 10px" : "10px 12px" } },
            was ? h("div", { style: { marginBottom: 8 } },
              h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog, marginBottom: 3 } }, "改前"),
              h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.fog, lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word", textDecoration: "line-through", opacity: .75 } },
                open ? was : was.slice(0, cutOld) + (was.length > cutOld ? "…" : ""))) : null,
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog, marginBottom: 3 } }, was ? "改后 · 整段替换" : "新增"),
            h("div", { style: { fontFamily: F_BODY, fontSize: sm ? 11.5 : 12.5, color: t.ink, lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-word" } },
              open ? shown : shown.slice(0, cutNew) + (shown.length > cutNew ? "…" : "")),
            (shown.length > cutNew || (was && was.length > cutOld))
              ? h("button", { "data-wk": "block", onClick: () => setOpen(!open), style: { marginTop: 6, background: "none", border: "none", padding: 0, fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.tint } }, open ? "收起" : "看全文")
              : null),
      h("div", { "data-wk": "qqpatchfoot", style: { padding: "8px 12px 10px", borderTop: "1px solid " + t.line, display: "flex", alignItems: "center", gap: 10 } },
        state
          ? h(React.Fragment, null,
              h("span", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: state === "已应用" ? "#4a8b68" : state === "已撤回" ? t.fog : "#a4442e" } }, state),
              // 点了应用之后才后悔的那一种：就在这儿退回去
              state === "已应用" && A.undoable(p) && props.onUndo
                ? h("button", { "data-wk": "qqpatchbtn", "data-part": "undo", onClick: props.onUndo, style: { background: "none", border: "none", fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.tint, padding: 0 } }, "撤回")
                : null,
              // 撤回了又想要回来、或者上次没应用成：再点一下（群里 2026-10-10：「应用了以后再撤回就没办法应用了」）
              // 跳转卡（open）按过了也能再按：它不改东西，只是再开一次那一页
              (state === "已撤回" || /^没应用/.test(state) || (p.target === "open" && state === "已应用")) && props.onApply
                ? h("button", { "data-wk": "qqpatchbtn", "data-part": "reapply", onClick: props.onApply, style: { background: "none", border: "none", fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.tint, padding: 0 } }, p.target === "open" && state === "已应用" ? "再去一次" : state === "已撤回" ? "重新应用" : "再试一次")
                : null,
              state === "已应用" && !A.undoable(p)
                ? h("span", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog } }, p.target === "memory" ? "（记忆库只进不出，退不了）" : p.target === "lookundo" ? "（退过头了就让我换回来）" : (p.target === "undo" || p.target === "open") ? "" : "（新建的，退不了）")
                : null)
          : h(React.Fragment, null,
              h("button", { "data-wk": "qqpatchbtn", "data-part": "apply", onClick: props.onApply, style: { padding: "6px 14px", borderRadius: 9, border: "none", background: t.ink, color: t.bg2, fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))" } }, p.target === "open" ? (String(p.text || "").trim().slice(0, 16) || "带我去") : "应用这条"),
              h("button", { "data-wk": "qqpatchbtn", "data-part": "skip", onClick: props.onSkip, style: { background: "none", border: "none", fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.fog } }, "跳过")),
        // 不管应用没应用、撤没撤，原文都能拷走（她自己贴到别处、存一份都行）
        p.text ? h("button", { "data-wk": "qqpatchbtn", "data-part": "copy", onClick: async () => { const ok = typeof copyText === "function" && await copyText(String(p.text)); props.toast && props.toast(ok ? "复制好了" : "没复制上"); }, style: { marginLeft: "auto", background: "none", border: "none", fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.fog, padding: 0 } }, "复制") : null));
  }

  // ---- 一段对话的公共脑子：整页和悬浮屏共用同一段，落在存档里 ----
  // ⚠️两处各存各的话就不叫上下文了：在小球里问了半句、点开整页接着说，它得记得。
  //   所以 state 只是镜子，真身在 x_assistChat；每次收发都两边一起更新。
  function useAssistChat(ctx, toast) {
    const [msgs, setMsgs] = useState(A.loadChat);
    const [busy, setBusy] = useState(A.isBusy);
    const put = list => { A.saveChat(list); };     // 落盘会喊一声，两处一起换（含自己）
    // 小悬浮屏从不卸载，没有「进来时读一次」这回事——只能靠这一声。
    // busy 同理：退出整页再回来，「在想…」得还在转。
    useEffect(() => A.onChat(setMsgs), []);
    useEffect(() => A.onBusy(setBusy), []);
    const send = async (text, pic) => {
      const q = String(text || "").trim();
      if ((!q && !pic) || A.isBusy()) return;    // 忙的时候两处都发不出第二句，免得回复串了顺序
      const act = A.activeFor(ctx);
      if (!act && !A.codeQuestion(q)) { toast && toast("请先到设置配置 API"); return; }
      A.bumpBusy(1); A.markAsking(q);
      const ac = typeof AbortController === "function" ? new AbortController() : null;
      A.setAbort(ac); A.setLastPic(pic || null);
      const before = A.loadChat();
      const isFile = pic && pic.kind === "file";
      put(before.concat([{ role: "me", text: q, pic: pic && !isFile ? pic.thumb : undefined, pics: pic && !isFile && pic.pics && pic.pics.length > 1 ? pic.pics.map(x => x.thumb) : undefined,
        file: isFile ? { name: pic.name, size: pic.size, chars: pic.chars, cut: pic.cut, max: pic.max, text: pic.text } : undefined, ts: Date.now() }]));
      try {
        const r = await A.ask(act, ctx, before, q, isFile ? pic : (pic ? (pic.pics && pic.pics.length > 1 ? pic.pics.map(x => x.full) : pic.full) : null), ac && ac.signal);
        put(A.loadChat().concat([{ role: "it", text: r.reply, patches: r.patches, outFile: r.file || undefined, ts: Date.now() }]));
      } catch (e) {
        // 她自己叉掉的：不算「没答上来」，留一颗重新生成（已经发出去的那一枪收不回来，回来的结果直接丢掉）
        if ((e && e.userAbort) || (ac && ac.signal.aborted)) put(A.loadChat().concat([{ role: "it", text: "这一句取消了。", cancelled: true, q: q, ts: Date.now() }]));
        else put(A.loadChat().concat([{ role: "it", text: "没答上来：" + (e.message || "重试"), patches: [], ts: Date.now() }]));
      } finally { A.setAbort(null); A.clearAsking(); A.bumpBusy(-1); }
    };
    // 重新生成：把那句问话和「取消了」一起收掉，原样再问一次（带过图／文件的照样带上）
    const regen = m => {
      if (A.isBusy()) return;
      const list = A.loadChat(), i = list.indexOf(list.find(x => x && x.ts === m.ts && x.cancelled));
      if (i < 0) return;
      const keep = list.slice(0, i).filter((x, j) => !(j === i - 1 && x.role === "me"));
      put(keep);
      send(m.q, A.lastPic());
    };
    const applyOne = p => {
      if (p.done === "已应用" || p.done === "应用中…") return;           // 记忆库会加两遍、改一小段会找不到原文
      // 「带你去那一页」要翻攻略手册认那一页；手册用到才加载（她 2026-10-18 瘦身），没到位就先装上再应用
      if (p.target === "open" && window.LazyMods && !window.LazyMods.isLoaded("manual")) {
        A.markPatch(p.pid, "应用中…");
        window.LazyMods.load("manual").then(() => { A.markPatch(p.pid, ""); applyOne(Object.assign({}, p, { done: "" })); },
          e => A.markPatch(p.pid, "没应用：" + ((e && e.message) || "攻略没加载上，再点一次")));
        return;
      }
      try {
        const n = A.apply(p, ctx);
        // 有的写口是要等落盘的（小世界那支 durable 写口）：等它回来再说成没成
        if (n && typeof n.then === "function") {
          A.markPatch(p.pid, "应用中…");
          n.then(() => { A.markPatch(p.pid, "已应用"); toast && toast("改好了"); }, e => A.markPatch(p.pid, "没应用：" + ((e && e.message) || "没存上，再点一次")));
          return;
        }
        A.markPatch(p.pid, "已应用");
        toast && toast(p.target === "memory" ? "写进记忆库 " + n + " 条"
          : p.target === "theme" ? "装修上身了" : "改好了，下次生成生效");
      } catch (e) {
        A.markPatch(p.pid, "没应用：" + (e.message || "未知"));
      }
    };
    const undoOne = p => {
      const e = A.loadUndo().find(x => x && x.pid === p.pid && !x.undone);
      if (!e) { toast && toast("这一条的旧版本已经不在了"); return; }
      try { A.undo(e.uid, ctx); toast && toast("退回去了"); }
      catch (err) { toast && toast("退不回去：" + (err.message || err)); }
    };
    const skip = p => A.markPatch(p.pid, "跳过了");
    const clear = () => { A.clearAsking(); put([]); };
    return { msgs, busy, send, regen, cancel: A.cancelAsk, applyOne, undoOne, skip, clear };
  }

  // 上一次问到一半 App 被系统收走了：明说出来，并给一个重问的入口。
  // 不说的话她看见的就是自己那句问话孤零零挂着——「回复没了」。
  function StaleAsk(props) {
    const t = useTheme(), C = props.C;
    const [gone, setGone] = useState(false);
    if (gone || C.busy) return null;
    const st = A.staleAsking(); if (!st) return null;
    return h("div", { "data-wk": "qqasking", style: { marginTop: 6, padding: "8px 10px", borderRadius: 10, border: "1px dashed " + t.line, background: "transparent" } },
      h("div", { style: { fontFamily: F_BODY, fontSize: props.big ? 11.5 : 11, color: t.fog, lineHeight: 1.6 } },
        "上一句没等到回复（App 被系统收走了）"),
      h("button", { "data-wk": "qqaskbtn", "data-part": "send", onClick: () => { const q = st.q; A.clearAsking(); setGone(true); C.send(q); },
        style: { marginTop: 5, background: "none", border: "none", padding: 0, fontFamily: F_BODY, fontSize: props.big ? 12 : 11.5, color: t.tint } }, "再问一次"),
      h("button", { "data-wk": "qqaskbtn", "data-part": "drop", onClick: () => { A.clearAsking(); setGone(true); },
        style: { marginTop: 5, marginLeft: 12, background: "none", border: "none", padding: 0, fontFamily: F_BODY, fontSize: props.big ? 12 : 11.5, color: t.fog } }, "算了"));
  }

  // 「在想…」＋ 一颗叉（整页和悬浮屏共用）：卡住了点叉就放手，不用干等
  function Thinking(props) {
    const t = useTheme(), C = props.C;
    return h("div", { "data-wk": "qqthinking", className: "flex items-center", style: { gap: 8 } },
      h("div", { style: { fontFamily: F_BODY, fontSize: props.big ? 12 : 11.5, color: t.fog } }, "在想…"),
      h("button", { "data-wk": "qqcancel", onClick: C.cancel, "aria-label": "取消这一问", className: "active:opacity-60",
        style: { minWidth: 40, minHeight: 40, background: "none", border: "none", fontFamily: F_BODY, fontSize: props.big ? 12 : 11.5, color: t.tint } }, "✕ 取消"));
  }
  // 一串气泡（整页和悬浮屏共用；只有尺寸不同）
  // 第一次点开、或者清空之后：秋秋自己先说一句（她 2026-10-12：「新人点开就能看到」）。
  //   画成她的一条气泡，不是灰字说明——新人认得出这是在跟谁说话。不进记录，清空后照样在。
  function FirstNote(props) {
    const t = useTheme(), sm = !!props.compact, av = sm ? 24 : 30, cfg = props.cfg;
    // 语气照 DEFAULT_PROMPT 那只小肥鸟（她 2026-10-12：「你听听这像它的语气吗」）：轻快、亲近，啾一下就够
    const text = sm
      ? "啾！我是" + cfg.name + "～这一页怎么用、哪儿不对劲，尽管问，截个图发我也行！整本攻略在主屏名片右下角那颗「?」里。\n想改装修、文风、角色档案，我也能帮你动手；想逛大家做的好东西，去主屏的「秋秋小窝」。拖着顶上那条能把我挪开哦。"
      : "啾！我是" + cfg.name + "，住在这台手机里的小肥鸟～\n"
        + "不知道从哪儿下手的话，主屏名片右下角有颗小小的「?」，戳进去就是「攻略」啦：哪儿怎么玩、出了毛病怎么办，全写在里面。\n"
        + "懒得翻？那就直接问我嘛，那本我背得滚瓜烂熟！按钮是干嘛的、东西找不着、设置了没反应，统统丢给我。\n"
        + "哪儿看着怪怪的，截个图发给我，比说半天还快！\n"
        + "想改文风、改角色的人设外貌、给界面换身装修，或者往记忆库里塞点东西，我也能叼着笔帮你改。先给你看改成啥样，你点了「应用这条」才算数。\n"
        + "对了对了！主屏上还有个「秋秋小窝」，是本小鸟开的小集市：大家捏的主题、美化、世界书、人设都摆在那儿，看中了点一下就搬回来；自己的宝贝也能摆上去，有话想说就去留言板写一帖，啾！";
    return h("div", { "data-wk": "qqmsg", "data-me": "0", "data-part": "first", style: { display: "flex", alignItems: "flex-start", gap: 7, marginBottom: sm ? 11 : 14, marginTop: sm ? 0 : 6 } },
      h(QiuFace, { cfg: cfg, size: av, radius: 9 }),
      h("div", { "data-wk": "qqbubble", "data-me": "0", style: { flex: 1, minWidth: 0, fontFamily: F_BODY, fontSize: sm ? 12 : 13, color: t.ink, lineHeight: 1.75, whiteSpace: "pre-wrap", wordBreak: "break-word" } }, text));
  }
  function Bubbles(props) {
    const t = useTheme(), sm = !!props.compact, C = props.C, av = sm ? 24 : 30;
    return h(React.Fragment, null, C.msgs.map((m, i) => m.role === "me"
      ? h("div", { "data-wk": "qqmsg", "data-me": "1", key: i, style: { display: "flex", justifyContent: "flex-end", alignItems: "flex-start", gap: 7, marginBottom: sm ? 9 : 12 } },
          h("div", { style: { maxWidth: "78%", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5 } },
            m.pics && m.pics.length > 1
              ? h("div", { style: { display: "flex", flexWrap: "wrap", justifyContent: "flex-end", gap: 4, maxWidth: sm ? 160 : 220 } }, m.pics.map((u, k) => h("img", { key: k, src: u, alt: "", style: { width: sm ? 50 : 70, height: sm ? 50 : 70, borderRadius: 8, border: "1px solid " + t.line, objectFit: "cover", display: "block" } })))
              : m.pic ? h("img", { src: m.pic, alt: "", style: { maxWidth: sm ? 120 : 170, maxHeight: sm ? 120 : 170, borderRadius: 10, border: "1px solid " + t.line, objectFit: "cover", display: "block" } }) : null,
            m.file && typeof FileCard === "function" ? h(FileCard, { m: m.file }) : null,
            m.text ? h("div", { "data-wk": "qqbubble", "data-me": "1", style: { padding: sm ? "6px 10px" : "8px 12px", borderRadius: 12, background: t.accent, color: "#fff", fontFamily: F_BODY, fontSize: sm ? 12 : 13, lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-word" } }, m.text) : null,
            // 她这侧也给一颗（群里 2026-10-09：「退出去截断了想把我的指令再发一遍，得自己重打」）
            m.text ? h("button", { "data-wk": "qqcopy", "data-me": "1", onClick: async () => { const ok = typeof copyText === "function" && await copyText(m.text); props.toast && props.toast(ok ? "复制好了" : "没复制上"); },
              style: { background: "none", border: "none", padding: "0 0 2px", fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog } }, "复制") : null),
          h(MeFace, { profile: props.profile, size: av, radius: 9 }))
      : h("div", { "data-wk": "qqmsg", "data-me": "0", key: i, style: { display: "flex", alignItems: "flex-start", gap: 7, marginBottom: sm ? 11 : 14 } },
          h(QiuFace, { cfg: props.cfg, size: av, radius: 9 }),
          h("div", { style: { flex: 1, minWidth: 0 } },
            h("div", { "data-wk": "qqbubble", "data-me": "0", style: { fontFamily: F_BODY, fontSize: sm ? 12 : 13, color: t.ink, lineHeight: 1.75, whiteSpace: "pre-wrap", wordBreak: "break-word", userSelect: "text", WebkitUserSelect: "text" } }, qqBold(m.text)),
            // 她 2026-10-05：「复制不了」——手机上在气泡里滑选太难，每条都给一颗复制
            m.text ? h("button", { "data-wk": "qqcopy", "data-me": "0", onClick: async () => { const ok = typeof copyText === "function" && await copyText(m.text); props.toast && props.toast(ok ? "复制好了" : "没复制上，长按文字试试"); },
              style: { marginTop: 3, background: "none", border: "none", padding: "4px 0", fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog } }, "复制") : null,
            m.cancelled && m.q ? h("button", { "data-wk": "qqregen", onClick: () => C.regen(m), disabled: C.busy, className: "active:opacity-60 disabled:opacity-40",
              style: { marginLeft: 14, minHeight: 40, background: "none", border: "none", padding: "4px 0", fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.tint } }, "重新生成") : null,
            m.outFile && typeof FileCard === "function" ? h("div", { style: { marginTop: 6 } }, h(FileCard, {
              m: { name: m.outFile.name, text: m.outFile.text, chars: m.outFile.text.length, size: new Blob([m.outFile.text]).size },
              actions: [
                ["复制全部", async () => { const ok = typeof copyText === "function" && await copyText(m.outFile.text); props.toast && props.toast(ok ? "整份复制好了" : "没复制上"); }],
                ["存成文件", async () => { try { await saveTextFile(m.outFile.name, m.outFile.text, /\.css$/i.test(m.outFile.name) ? "text/css" : /\.json$/i.test(m.outFile.name) ? "application/json" : "text/plain"); } catch (e) { props.toast && props.toast("没存成：" + (e.message || e)); } }]
              ] })) : null,
            (m.patches || []).map(p => h(PatchCard, { key: p.pid, p: p, ctx: props.ctx, compact: sm, state: p.done, onApply: () => C.applyOne(p), onUndo: () => C.undoOne(p), onSkip: () => C.skip(p), toast: props.toast }))))));
  }

  // ============================================================
  // 设置页：名字 / 头像 / 主人格提示词 / 小球开关
  // ============================================================
  function AssistantSetup(props) {
    const t = useTheme();
    const [cfg, setCfg] = useState(A.loadCfg);
    const [draft, setDraft] = useState(() => A.loadCfg().prompt);
    const [name, setName] = useState(() => A.loadCfg().name);
    const put = patch => setCfg(A.saveCfg(patch));
    const row = { padding: "12px 14px", borderBottom: "1px solid " + t.line, display: "flex", alignItems: "center", gap: 12 };
    const btn = (label, onClick, strong) => h("button", { "data-wk": "qqbtn", key: label, onClick: onClick, style: {
      flex: 1, padding: "11px", borderRadius: 12, border: "none",
      background: strong ? t.ink : t.bg2, color: strong ? t.bg2 : t.sub, fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))" } }, label);
    return h("div", { "data-wk": "qqsetup", style: { height: "100%", display: "flex", flexDirection: "column", background: t.bg } },
      // 顶栏走共用的 Head（施工规则/mobile-ui-layout.md §1）：手写那条一个挂点都没有，
      // 返回键还是个「←」字符、可点区只有那几个像素（Head 里是 46×34）。
      h(Head, { zh: "设置", onBack: props.onBack }),
      h("div", { style: { flex: 1, minHeight: 0, overflowY: "auto", paddingBottom: "calc(env(safe-area-inset-bottom, 0px) * 0.4 + 24px)" } },
        // 头像 + 名字
        h("div", { style: row },
          h(QiuFace, { cfg: cfg, size: 54, radius: 16 }),
          h("div", { style: { flex: 1, minWidth: 0 } },
            h("input", { "data-wk": "qqname", value: name, onChange: e => setName(e.target.value), onBlur: () => put({ name: name.trim() || A.DEFAULT_NAME }),
              placeholder: A.DEFAULT_NAME,
              style: { width: "100%", padding: "8px 10px", borderRadius: 10, border: "1px solid " + t.line, background: t.bg2, fontFamily: F_DISPLAY, fontSize: "calc(15px * var(--app-fs, 1))", color: t.ink, outline: "none" } }),
            h("div", { style: { display: "flex", gap: 10, marginTop: 7 } },
              h("label", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.tint } }, "换张头像",
                h("input", { type: "file", accept: "image/*", style: { display: "none" }, onChange: async e => {
                  const f = e.target.files && e.target.files[0]; if (!f) return;
                  try {
                    const b64 = await new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = no; r.readAsDataURL(f); });
                    // 图片走图库，只存引用——直接把 base64 塞进配置会把本地存储撑爆
                    const ref = typeof imgToVault === "function" ? await imgToVault(b64) : b64;
                    put({ avatarImage: ref }); props.toast && props.toast("头像换好了");
                  } catch (err) { props.toast && props.toast("这张存不下：" + (err.message || err)); }
                } })),
              cfg.avatarImage ? h("button", { "data-wk": "qqavatardel", onClick: () => put({ avatarImage: "" }), style: { background: "none", border: "none", padding: 0, fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.fog } }, "换回那只鸟") : null),
            cfg.avatarImage && window.ImgShapePick ? h(window.ImgShapePick, { value: cfg.ballShape, onChange: v => put({ ballShape: v }) }) : null)),
        // 小球开关
        h("div", { style: row },
          h("div", { style: { flex: 1 } },
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", color: t.ink } }, "桌面小球"),
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog, marginTop: 2, lineHeight: 1.5 } }, "每一页角落里都跟着，能拖到任何地方；点一下开合")),
          h(Toggle, { on: !!cfg.ballOn, onChange: () => put({ ballOn: !cfg.ballOn }), color: t.accent, wk: "qqballswitch" })),
        h(QiuMemList, { t: t, toast: props.toast, name: cfg.name || A.DEFAULT_NAME }),
        // 走哪条线路（她 2026-09-03：「还可以跟随全局 api 或者单独设定一个」）
        // 摆法照设置里【线下与创作模型】那一栏：第一行是「跟随全局」，底下一行一条线路。
        (function () {
          const list = props.apiProfiles || [];
          const cur = list.find(p => p && p.id === cfg.apiId);
          const nameOf = p => (p && (p.name || p.model)) || "未命名线路";
          const line = (id, title, sub) => {
            const on = (cfg.apiId || "") === (id || "");
            return h("button", { "data-wk": "qqapi", "data-on": on ? "1" : "0", key: id || "_global", onClick: () => put({ apiId: id || "" }), style: {
              width: "100%", textAlign: "left", padding: "9px 11px", marginTop: 6, borderRadius: 11,
              border: "1px solid " + (on ? t.ink : t.line), background: on ? t.ink : t.bg2 } },
              h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: on ? t.bg2 : t.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, title),
              sub ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", marginTop: 2, color: on ? t.bg2 : t.fog, opacity: on ? .75 : 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, sub) : null);
          };
          return h("div", { style: { padding: "14px 14px 4px", borderBottom: "1px solid " + t.line } },
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", color: t.ink } }, "秋秋走哪条线路"),
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog, marginTop: 3, lineHeight: 1.6 } },
              "不选＝跟随全局，跟聊天用的主模型同一条。也可以单独给它挑一条——它干的是查功能、出改动稿这种活，配一条便宜快的就够。"),
            line("", "跟随全局", (props.active && (props.active.name || props.active.model)) || "还没配主模型"),
            list.map(p => line(p.id, nameOf(p), p.model || "还没选模型")),
            !list.length ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog, marginTop: 8, paddingBottom: 8 } }, "还没配过线路，去 设置 · 文字模型 加一条") : null,
            cfg.apiId && !cur ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.accent, marginTop: 8, paddingBottom: 8 } }, "原来挑的那条线路不在了，这会儿走的是全局") : null,
            h("div", { style: { height: 8 } }));
        })(),
        // 改过的东西：点了应用之后才后悔的那一种，在这儿退
        h(UndoList, { toast: props.toast, ctx: props.ctx }),
        // 主人格提示词
        h("div", { style: { padding: "14px 14px 0" } },
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", color: t.ink } }, "主人格提示词"),
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog, marginTop: 3, lineHeight: 1.6, whiteSpace: "pre-wrap" } },
            "它是谁、怎么说话、干哪两件事，都写在这儿，随你改。\n（能改哪几样东西、不答代码那道门、输出成什么形状——这些是底下钉死的，删不掉。）"),
          h("textarea", { "data-wk": "qqprompt", value: draft, onChange: e => setDraft(e.target.value), rows: 14,
            style: { width: "100%", marginTop: 10, padding: "12px 13px", borderRadius: 14, border: "1px solid " + t.line, background: t.bg2,
              fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", lineHeight: 1.85, color: t.ink, resize: "none", outline: "none", minHeight: 260 } }),
          h("div", { style: { display: "flex", gap: 8, marginTop: 10 } },
            btn("默认", () => setDraft(A.DEFAULT_PROMPT)),
            btn("清空", () => setDraft("")),
            btn("保存", () => { put({ prompt: draft }); props.toast && props.toast("存好了"); }, true)),
          draft !== cfg.prompt ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.accent, marginTop: 8 } }, "改动还没保存") : null)));
  }

  // 改过的东西（她 2026-09-03：要能回滚）。
  // ⚠️这一层不是「拿备份代替过目」——秋秋照旧先出改动稿由她点头，
  //   这儿管的是【点了应用之后才后悔】那一种。
  function UndoList(props) {
    const t = useTheme();
    const [list, setList] = useState(A.loadUndo);
    useEffect(() => A.onUndo(setList), []);
    const live = (list || []).slice(0, 12);
    if (!live.length) return null;
    const when = ts => {
      const d = Math.max(0, Date.now() - (ts || 0)), m = Math.floor(d / 60000);
      return m < 1 ? "刚才" : m < 60 ? m + " 分钟前" : m < 1440 ? Math.floor(m / 60) + " 小时前" : Math.floor(m / 1440) + " 天前";
    };
    return h("div", { "data-wk": "qqundolist", style: { padding: "14px 14px 6px", borderBottom: "1px solid " + t.line } },
      h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", color: t.ink } }, "改过的东西"),
      h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog, marginTop: 3, lineHeight: 1.6 } },
        "秋秋改过的这些，改之前那一份还留着（最近 " + A.UNDO_KEEP + " 次）。点「退回」就写回旧的那份。"),
      live.map(e => h("div", { "data-wk": "qqundorow", "data-on": e.undone ? "0" : "1", key: e.uid, className: "flex items-center", style: { gap: 10, padding: "9px 0", borderTop: "1px solid " + t.line } },
        h("div", { style: { flex: 1, minWidth: 0 } },
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: e.undone ? t.fog : t.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: e.undone ? "line-through" : "none" } }, e.title || e.label),
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } },
            e.label + " · " + when(e.ts) + (e.prev ? " · 旧的那份 " + e.prev.length + " 字" : " · 原来是空的"))),
        e.undone
          ? h("span", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog, flexShrink: 0 } }, "已退回")
          : h("button", { "data-wk": "qqundobtn", onClick: () => {
                try { A.undo(e.uid, props.ctx || {}); props.toast && props.toast("退回去了：" + (e.title || e.label)); }
                catch (err) { props.toast && props.toast("退不回去：" + (err.message || err)); }
              }, style: { flexShrink: 0, padding: "5px 11px", borderRadius: 8, border: "1px solid " + t.line, background: "transparent", fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.tint } }, "退回"))));
  }

  // ============================================================
  // 整页版
  // ============================================================
  // 发图给秋秋（她 2026-09-30）：整页和小悬浮屏两处输入栏共用这一颗（one-public-mechanism）。
  //   pic＝{ full, thumb }：full 768px 给模型看，thumb 240px 留在聊天记录里给她看。
  // 附件：📷 一张图，📎 一份文件（CSS、文本、PDF、Word——读法跟聊天里发文件是同一个 pickTextFile）
  // 一次能挑好几张（她 2026-10-16「给秋秋发图能不能一次多几张」）：最多 6 张，跟聊天里发照片同一个上限。
  //   pic＝{ full, thumb, pics:[{full,thumb}] }：full/thumb 是第一张（老的那几处照旧读得到），pics 是全部。
  const ASSIST_PICS_MAX = 6;
  function AssistAttach({ pic, setPic, small, toast }) {
    const t = useTheme(), ref = useRef(null);
    const pics = pic && pic.kind !== "file" ? (pic.pics || [{ full: pic.full, thumb: pic.thumb }]) : [];
    const setPics = arr => setPic(arr.length ? { full: arr[0].full, thumb: arr[0].thumb, pics: arr } : null);
    const pick = async e => {
      const fs = Array.from((e.target.files) || []); e.target.value = ""; if (!fs.length) return;
      const room = ASSIST_PICS_MAX - pics.length;
      if (fs.length > room) toast && toast("一次最多 " + ASSIST_PICS_MAX + " 张，多的没放进来");
      const got = [];
      for (const f of fs.slice(0, Math.max(0, room))) {
        try { got.push({ full: await resizeImageFile(f, 768, .82), thumb: await resizeImageFile(f, 240, .75) }); }
        catch (err) { toast && toast("有一张图读不出来，跳过了"); }
      }
      if (got.length) setPics(pics.concat(got));
    };
    const pickFile = () => { if (typeof pickTextFile === "function") pickTextFile(m => setPic(Object.assign({ kind: "file" }, m)), { max: 60000 }); };
    const sz = small ? 32 : 38;
    const round = { flexShrink: 0, width: sz, height: sz, borderRadius: 999, border: "1px solid " + t.line, background: t.bg2, color: t.sub, fontSize: small ? 14 : 16, display: "flex", alignItems: "center", justifyContent: "center" };
    const x = (label, onClick) => h("button", { onClick: onClick || (() => setPic(null)), "aria-label": label, style: { position: "absolute", top: -6, right: -6, width: 18, height: 18, borderRadius: 999, border: "none", background: t.ink, color: t.bg2, fontSize: "calc(11px * var(--app-fs, 1))", lineHeight: "18px", padding: 0 } }, "×");
    return h(React.Fragment, null,
      pic && pic.kind === "file" ? h("div", { "data-wk": "qqattach", "data-part": "file", style: { position: "relative", flexShrink: 0, maxWidth: small ? 90 : 120, height: sz, padding: "0 8px", borderRadius: 9, border: "1px solid " + t.line, background: t.bg2, display: "flex", alignItems: "center", fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.sub } },
          h("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, "📎 " + pic.name), x("拿掉这个文件"))
      : pics.length ? h("div", { className: "flex items-center", style: { gap: 8, flexShrink: 0, overflowX: "auto", maxWidth: small ? 140 : 200, paddingTop: 6, paddingRight: 6 } },
          pics.map((p, k) => h("div", { key: k, "data-wk": "qqattach", "data-part": "pic", style: { position: "relative", flexShrink: 0 } },
            h("img", { src: p.thumb, alt: "", style: { width: sz, height: sz, borderRadius: 9, objectFit: "cover", border: "1px solid " + t.line, display: "block" } }),
            x("拿掉这张图", () => setPics(pics.filter((_, i) => i !== k))))),
          pics.length < ASSIST_PICS_MAX ? h("button", { "data-wk": "qqattachbtn", "data-part": "pic", onClick: () => ref.current && ref.current.click(), "aria-label": "再加一张图", className: "active:opacity-60", style: round }, "＋") : null)
      : h(React.Fragment, null,
          h("button", { "data-wk": "qqattachbtn", "data-part": "pic", onClick: () => ref.current && ref.current.click(), "aria-label": "发图", className: "active:opacity-60", style: round }, "📷"),
          h("button", { "data-wk": "qqattachbtn", "data-part": "file", onClick: pickFile, "aria-label": "发一个文件", className: "active:opacity-60", style: round }, "📎")),
      h("input", { ref: ref, type: "file", accept: "image/*", multiple: true, onChange: pick, style: { display: "none" } }));
  }



  function AssistantApp(props) {
    const t = useTheme();
    const [input, setInput] = useState("");
    const [pic, setPic] = useState(null);
    const [page, setPage] = useState("chat");      // chat | setup
    const [cfg, setCfg] = useState(A.loadCfg);
    const C = useAssistChat(props, props.toast);
    const scroller = useRef(null);
    useEffect(() => { if (scroller.current) scroller.current.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" }); }, [C.msgs.length, C.busy]);
    const fire = txt => { setInput(""); const p = pic; setPic(null); C.send(txt, p); };

    if (page === "setup") return h(AssistantSetup, { toast: props.toast, apiProfiles: props.apiProfiles, active: props.active, ctx: props, onBack: () => { setCfg(A.loadCfg()); setPage("chat"); } });

    const QUICK = ["这个 App 都能玩什么", "加笔怎么玩", "我设的文风好像没生效", "帮我把现在的文风改得更克制一点"];
    // ── 值班台（v62.70 审美审计点名）─────────────────────────────────
    // 审计原话：整页 t.bg 平色，**自写顶栏、返回键是字符「←」、不走 Head**。
    // 「一个助手在跟你说话」本来就长得像任何一个聊天框，所以这一页的分寸是：
    // 别去改气泡（改了只会变难用），改她【坐在哪儿】——
    // 秋秋是这个 app 的维修工，所以给她一张纸面的值班台和一块台签。
    const deskPaper = (typeof pageSkin === "function") ? pageSkin("paper", t, { strength: .5 }) : { background: t.bg };
    return h("div", { "data-wk": "qqpage", style: Object.assign({ position: "relative", height: "100%", display: "flex", flexDirection: "column" }, deskPaper) },
      // 顶栏走公共 Head（mobile-ui-layout §1）。原来那条自写栏的返回键是个 19px 的
      // 「←」字符、padding 只有 4px，可点区就那几个像素。
      h(Head, {
        zh: cfg.name, sub: "这个 app 哪儿不对劲，问她", onBack: props.onBack, bg: "transparent",
        right: h("div", { className: "flex items-center", style: { gap: 2 } },
          C.msgs.length ? h("button", { "data-wk": "qqclear", onClick: C.clear, className: "active:opacity-60", style: { background: "none", border: "none", fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.fog, padding: "4px 6px" } }, "清空") : null,
          h("button", { "data-wk": "qqsetupbtn", onClick: () => setPage("setup"), className: "active:opacity-60", style: { background: "none", border: "none", fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.tint, padding: "4px 4px" } }, "设置"))
      }),
      // 台签：值班台上立着的那块名牌。她的脸原来挤在顶栏里当小图标，
      // 摆到台签上才是「这张桌子今天谁在」。
      h("div", { "data-wk": "qqbar", className: "shrink-0 flex items-center", style: {
        gap: 10, margin: "6px 14px 10px", padding: "9px 12px 10px",
        background: "rgba(255,255,255,.5)", border: "1px solid " + t.line,
        borderRadius: "2px 2px 7px 7px", boxShadow: "0 3px 7px -6px rgba(0,0,0,.7)"
      } },
        h(QiuFace, { cfg: cfg, size: 30, radius: 9 }),
        h("div", { style: { minWidth: 0 } },
          h("div", { "data-wk": "qqtitle", style: { fontFamily: F_DISPLAY, fontSize: "calc(14px * var(--app-fs, 1))", color: t.ink } }, cfg.name),
          h("div", { "data-wk": "qqstatus", style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog, marginTop: 2 } }, C.busy ? "在想…" : "在，说吧")),
        h("span", { style: { flex: 1 } }),
        // 值班灯：亮着＝她醒着。一个点，不是一句话
        h("span", { "aria-hidden": "true", style: { width: 6, height: 6, borderRadius: 999, background: C.busy ? t.tint : "#7fa87f", boxShadow: "0 0 6px " + (C.busy ? t.tint : "#7fa87f") } })),
      h("div", { "data-wk": "qqfeed", ref: scroller, style: { flex: 1, minHeight: 0, overflowY: "auto", padding: "14px 14px 20px" } },
        C.msgs.length === 0
          ? h("div", { "data-wk": "qqempty" }, h(FirstNote, { cfg: cfg }))
          : null,
        h(Bubbles, { C: C, ctx: props, profile: props.profile, cfg: cfg, toast: props.toast }),
        C.busy ? h(Thinking, { C, big: true }) : null,
        h(StaleAsk, { C: C, big: true }),
        !C.busy && C.msgs.length === 0
          ? h("div", { style: { display: "flex", flexWrap: "wrap", gap: 7, marginTop: 16 } },
              // 递到台上的几张便签条：方角、纸色、各自歪一点点。
              // 虚线圆角药丸是任何 app 的「快捷短语」，跟这张桌子没关系。
              QUICK.map((q, qi) => h("button", { "data-wk": "qqquick", key: q, onClick: () => fire(q), style: { padding: "7px 12px", borderRadius: 2, transform: "rotate(" + ((qi % 3) - 1) * 0.6 + "deg)", boxShadow: "0 2px 5px -4px rgba(0,0,0,.7)", border: "1px solid " + t.line, background: "rgba(255,255,255,.62)", color: t.sub, fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))" } }, q)))
          : null),
      h("div", { "data-wk": "qqcompose", style: { display: "flex", gap: 8, alignItems: "center", padding: "10px 14px", paddingBottom: "calc(" + COMPOSER_PAD_BOTTOM + " + 10px)", borderTop: "1px solid " + t.line, flexShrink: 0 } },
        h(AssistAttach, { pic: pic, setPic: setPic, toast: props.toast }),
        h("textarea", { "data-wk": "qqinput", value: input, onChange: e => setInput(e.target.value), rows: 1,
          placeholder: "问功能、查毛病，或者说想改什么",
          style: { flex: 1, padding: "10px 13px", borderRadius: 14, border: "1px solid " + t.line, background: t.bg2, fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.ink, resize: "none", outline: "none", maxHeight: 120 } }),
        h("button", { "data-wk": "qqsend", onClick: () => fire(input), disabled: C.busy, style: { padding: "8px 16px", borderRadius: 999, border: "none", background: t.ink, color: t.bg2, fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))" } }, C.busy ? "…" : "问")));
  }
  window.AssistantApp = AssistantApp;

  // ============================================================
  // 小悬浮屏
  //
  // ⚠️这一层为什么可以不是整页（施工规则/no-half-sheet.md）：
  //   那条规矩的判据是「这一层的内容，需要同时看见它下面那一层吗？」——
  //   这里的答案是【需要】，而且是全部的意义所在：她要一边看着某个功能一边问、
  //   一边让它改。整页会把要研究的那个东西整个盖掉，那就等于没有这个功能。
  //   也不是半窗：半窗钉死在屏幕下半截，这个能拖到任何地方、让开你正在看的那块。
  // ============================================================
  const BALL = 46;

  // ⚠️量屏高不许用 window.innerHeight（她 2026-09-03：「聊天框下面又太高了没有遵循规则」）。
  //   整个 app 的外壳写的是 height:100vh，而 iOS 独立 app 里 innerHeight 是【小视口】，
  //   比 100vh 矮一截——拿它算，浮窗就会浮在半空、底下空一大条。
  //   跟 App 的外壳量同一把尺子：直接量根节点。
  const vhOf = () => {
    try { const el = document.getElementById("root"); const r = el && el.getBoundingClientRect(); if (r && r.height > 200) return r.height; } catch (e) {}
    return (typeof window !== "undefined" && window.innerHeight) || 800;
  };
  // 底部留白也跟主聊天输入栏同一把尺子（COMPOSER_PAD_BOTTOM，0.4 条安全区），
  // 不自己拍一个数（施工规则/mobile-ui-layout.md §2）。
  let _sbCache = null;
  const safeBottom = () => {
    if (_sbCache != null) return _sbCache;
    try {
      const d = document.createElement("div");
      d.style.cssText = "position:fixed;left:-9999px;height:" + COMPOSER_PAD_BOTTOM;
      document.body.appendChild(d);
      _sbCache = Math.round(d.getBoundingClientRect().height) || 0;
      document.body.removeChild(d);
    } catch (e) { _sbCache = 0; }
    return _sbCache;
  };

  const DOCK_BRIEF_AWAY = 3 * 60 * 1000;
  function AssistantDock(props) {
    const t = useTheme();
    const [open, setOpen] = useState(false);
    const [cfg, setCfg] = useState(A.loadCfg);
    const [input, setInput] = useState("");
    const [pic, setPic] = useState(null);
    const dockSend = () => { const p = pic; setPic(null); C.send(input, p); setInput(""); };
    // 点位只保留在本次前台使用中；不读取旧 x_assistDock，避免重开仍困在状态栏。
    const [pos, setPos] = useState(() => ({ x: -1, y: -1 }));
    const C = useAssistChat(props, props.toast);
    const scroller = useRef(null);
    const dragRef = useRef(null);
    const movedRef = useRef(false);
    const hiddenAtRef = useRef(0);
    useEffect(() => {
      const resetDock = () => {
        dragRef.current = null;
        movedRef.current = false;
        setPos({ x: -1, y: -1 });
        setOpen(false);
      };
      // 只是出去一下（挑图、去别处复制链接）就回来：窗照旧开着、原地不动（群友 2026-10-25：悬浮球传不了图和链接——
      //   挑图那一下也算「离开」，一回来窗被收了，挑好的图跟着没了）。离开久了才归位收起
      const onVisible = () => {
        if (document.visibilityState === "hidden") { hiddenAtRef.current = Date.now(); return; }
        if (document.visibilityState !== "visible") return;
        const away = hiddenAtRef.current ? Date.now() - hiddenAtRef.current : Infinity;
        hiddenAtRef.current = 0;
        if (away < DOCK_BRIEF_AWAY) { dragRef.current = null; movedRef.current = false; return; }
        resetDock();
      };
      const onPageShow = e => { if (e.persisted) resetDock(); };
      document.addEventListener("visibilitychange", onVisible);
      window.addEventListener("pageshow", onPageShow);
      return () => {
        document.removeEventListener("visibilitychange", onVisible);
        window.removeEventListener("pageshow", onPageShow);
      };
    }, []);
    useEffect(() => { if (scroller.current) scroller.current.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" }); }, [C.msgs.length, C.busy, open]);
    // 设置页里把小球关了/开了，这边要跟上（同一个存档，两处都在看）
    useEffect(() => {
      const tick = setInterval(() => { const n = A.loadCfg(); setCfg(c => (c.ballOn === n.ballOn && c.name === n.name && c.avatarImage === n.avatarImage && c.ballShape === n.ballShape) ? c : n); }, 2000);
      return () => clearInterval(tick);
    }, []);

    const vw = () => (typeof window !== "undefined" && window.innerWidth) || 390;
    const panelW = () => Math.min(348, vw() - 20);
    const panelH = () => Math.min(430, Math.max(260, vhOf() - 170));
    const at = () => {
      const H = vhOf(), sb = safeBottom();
      const w = open ? panelW() : BALL, hh = open ? panelH() : BALL;
      // 默认落在右下角。球要让开底栏（别压着 tab bar 和输入框），窗就贴着底边。
      const x = pos.x < 0 ? vw() - w - 12 : pos.x;
      const y = pos.y < 0 ? H - hh - sb - (open ? 10 : 84) : pos.y;
      const maxY = H - hh - sb - 8;
      return { x: Math.max(6, Math.min(x, vw() - w - 6)), y: Math.max(6, Math.min(y, Math.max(6, maxY))) };
    };
    const a = at();

    // ── 拖 vs 点（她 2026-09-03：「现在有时候不触发」）──
    // 原来点开是挂在 pointerup 上、并且要求位移 ≤4px。手指按下去总会抖那么两三下，
    // 4px 这个门槛按不住，于是十次里有几次被当成拖、点了没反应。
    // 改成【拖归 pointer 事件，点归 click】：浏览器自己会在一次轻点后补一个 click，
    // 这条路稳得多；真拖过就把紧接着那个 click 吞掉。门槛也放宽到 8px。
    const MOVE_MIN = 8;
    const onDown = e => {
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
      movedRef.current = false;
      dragRef.current = { x0: e.clientX, y0: e.clientY, px: a.x, py: a.y };
    };
    const onMove = e => {
      const d = dragRef.current; if (!d) return;
      const dx = e.clientX - d.x0, dy = e.clientY - d.y0;
      if (!movedRef.current && Math.abs(dx) + Math.abs(dy) < MOVE_MIN) return;
      movedRef.current = true;
      e.preventDefault();
      setPos({ x: d.px + dx, y: d.py + dy });
    };
    const endDrag = () => {
      dragRef.current = null;
    };
    const swallowIfDragged = () => { if (movedRef.current) { movedRef.current = false; return true; } return false; };
    const dragProps = { onPointerDown: onDown, onPointerMove: onMove, onPointerUp: endDrag, onPointerCancel: endDrag };

    const ballSrc = cfg.avatarImage ? (typeof resolveImg === "function" ? resolveImg(cfg.avatarImage) : cfg.avatarImage) : "";
    const ballCut = typeof window.useImgCutout === "function" ? window.useImgCutout(ballSrc, cfg.ballShape) : false;
    if (!cfg.ballOn) return null;
    const base = { position: "fixed", zIndex: 940, touchAction: "none" };

    // 收起来的样子：一颗小球，点一下开合
    if (!open) return h("div", { "data-wk": "qqdockball", ...dragProps,
      onClick: () => { if (!swallowIfDragged()) setOpen(true); },
      "data-assistant-dock": "1",
      // 普通头像照旧放进圆里（她 2026-10-17：一律去框那版大家的秋秋都变方了）；
      //   抠好的透明图（四角透明）才不要圆底、边框和阴影，原样站在那儿
      // 不透明的自己的图（她 2026-10-17「不透明的不能没有框吗」）：裁成圆，但不要底、边框和阴影
      style: ballCut
        ? { ...base, left: a.x, top: a.y, width: BALL, height: BALL, display: "flex", alignItems: "center", justifyContent: "center", cursor: "grab" }
        : ballSrc ? { ...base, left: a.x, top: a.y, width: BALL, height: BALL, borderRadius: 999, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", cursor: "grab" }
        : { ...base, left: a.x, top: a.y, width: BALL, height: BALL, borderRadius: 999,
        background: t.bg2, border: "1px solid " + t.line, boxShadow: "0 4px 14px rgba(0,0,0,.22)",
        display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", cursor: "grab" } },
      ballSrc
        ? h("img", { src: ballSrc, alt: "", draggable: false, style: { width: "100%", height: "100%", objectFit: ballCut ? "contain" : "cover", borderRadius: ballCut ? 0 : "50%", pointerEvents: "none" } })
        : h(QiuFace, { cfg: cfg, size: 40, radius: 999 }));

    // 展开的样子：一扇能拖的小窗
    return h("div", { "data-wk": "qqdock",
      "data-assistant-dock": "1",
      style: { ...base, left: a.x, top: a.y, width: panelW(), height: panelH(), borderRadius: 16,
        background: t.bg, border: "1px solid " + t.line, boxShadow: "0 10px 34px rgba(0,0,0,.30)",
        display: "flex", flexDirection: "column", overflow: "hidden" }
    },
      // 顶上这条就是把手：按住它拖窗
      h("div", { "data-wk": "qqdockbar", ...dragProps, onClick: () => { swallowIfDragged(); },
        style: { display: "flex", alignItems: "center", gap: 7, padding: "8px 8px 8px 11px", borderBottom: "1px solid " + t.line, background: t.bg2, cursor: "grab", flexShrink: 0 } },
        h("div", { style: { width: 18, height: 3, borderRadius: 2, background: t.line, flexShrink: 0 } }),
        h(QiuFace, { cfg: cfg, size: 22, radius: 7 }),
        h("div", { "data-wk": "qqdocktitle", style: { flex: 1, minWidth: 0, fontFamily: F_DISPLAY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, cfg.name),
        C.msgs.length ? h("button", { "data-wk": "qqclear", "data-part": "dock", onPointerDown: e => e.stopPropagation(), onClick: C.clear, style: { background: "none", border: "none", fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog, padding: "4px 5px" } }, "清空") : null,
        h("button", { "data-wk": "qqdockclose", onPointerDown: e => e.stopPropagation(), onClick: () => setOpen(false), style: { background: "none", border: "none", fontSize: "calc(15px * var(--app-fs, 1))", color: t.sub, padding: "2px 7px" } }, "－")),
      h("div", { "data-wk": "qqfeed", "data-part": "dock", ref: scroller, style: { flex: 1, minHeight: 0, overflowY: "auto", padding: "11px 12px 12px" } },
        C.msgs.length === 0
          ? h("div", null,
              h(FirstNote, { cfg: cfg, compact: true }),
              h("div", { style: { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 } },
                ["这一页是干嘛的", "这个 App 都能玩什么", "把这一页的字调大一点"].map(q =>
                  h("button", { "data-wk": "qqquick", "data-part": "dock", key: q, onClick: () => C.send(q), style: { padding: "6px 10px", borderRadius: 999, border: "1px dashed " + t.line, background: "transparent", color: t.sub, fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))" } }, q))))
          : null,
        h(Bubbles, { C: C, ctx: props, profile: props.profile, cfg: cfg, compact: true, toast: props.toast }),
        C.busy ? h(Thinking, { C }) : null,
        h(StaleAsk, { C: C })),
      h("div", { "data-wk": "qqcompose", "data-part": "dock", style: { display: "flex", gap: 6, alignItems: "center", padding: "7px 9px 8px", borderTop: "1px solid " + t.line, flexShrink: 0 } },
        h(AssistAttach, { pic: pic, setPic: setPic, small: true, toast: props.toast }),
        h("textarea", { "data-wk": "qqinput", "data-part": "dock", value: input, rows: 1, onChange: e => setInput(e.target.value),
          onKeyDown: e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); dockSend(); } },
          placeholder: "问点什么…",
          style: { flex: 1, minWidth: 0, padding: "8px 11px", borderRadius: 12, border: "1px solid " + t.line, background: t.bg2, fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.ink, resize: "none", outline: "none", maxHeight: 84 } }),
        h("button", { "data-wk": "qqsend", "data-part": "dock", onClick: dockSend, disabled: C.busy,
          style: { padding: "7px 13px", borderRadius: 999, border: "none", background: t.ink, color: t.bg2, fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))" } }, C.busy ? "…" : "问")));
  }
  window.AssistantDock = AssistantDock;
})();
