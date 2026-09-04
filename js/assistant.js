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
  const DEFAULT_PROMPT = [
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
  ].join("\n");
  function loadCfg() {
    let d = {}; try { d = JSON.parse(localStorage.getItem(CFG_KEY) || "{}") || {}; } catch (e) { d = {}; }
    return {
      name: d.name || DEFAULT_NAME,
      avatarImage: d.avatarImage || "",
      // ⚠️用 `in` 判，不能用 `||`：她按「清空」存的是空串，
      //   走 `||` 会当成没设过、把默认那份又发回去，等于清空按钮是假的。
      prompt: ("prompt" in d) ? String(d.prompt) : DEFAULT_PROMPT,
      ballOn: d.ballOn !== false,
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

  // ---- 它能改的东西：白名单。不在这张表里的一律不许碰 ----
  // 每一项都要说清「怎么读」「怎么写」「界面上叫什么」，写入口集中在这里，
  // 免得以后加能力时到处散着改，哪天漏个校验就真把她的数据写坏了。
  const TARGETS = {
    style: {
      zh: "文风预设",
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

  // ---- 代码/框架那道门（她 2026-09-03 点名的那条）----
  // 判的是【这东西怎么造出来的】，不是【这东西哪儿不对劲】：
  // 她说「购物有 bug」是在报毛病，那要答；问「用什么框架写的」才回绝。
  // 所以 bug / 报错 / 不生效 一个都不在这张表里。
  // ⚠️也不许把「API」「接口」整个拉黑——设置里那一屏就叫接口配置，
  //   拉黑等于她问「API 怎么配」都会被顶回来。
  const CODE_SIGNS = [
    /源代码|源码|代码|码农/i, /\bcode\b/i,
    /框架|技术栈|架构|底层实现|怎么实现的|用什么写的|用什么做的|用的什么语言/,
    /\breact\b|\bvue\b|\bsvelte\b|\bangular\b|\bjquery\b|\btailwind\b/i,
    /javascript|typescript|\bjsx\b|\bnpm\b|\bwebpack\b|\bvite\b|\bnode\.js\b/i,
    /函数|变量|数组|循环|正则表达式|算法复杂度|设计模式/,
    /仓库地址|\brepo\b|\bgit\b|\bcommit\b|分支|部署|开源/i,
    /前端|后端|数据库|\bsql\b|localstorage|indexeddb|存储键/i,
    /[\w-]+\.(js|mjs|ts|jsx|html|json)\b/i
  ];
  // 命中就当场回绝，一次调用都不花（她按次计费，这也是替她省钱）
  function codeQuestion(text) {
    const s = String(text || "");
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
    return { 角色: chars, 已存的文风预设: styles, 线下设置: offSet, 最近报错: errs.length ? errs : ["（本次开机没抓到报错）"] };
  }

  // ---- 让它按固定形状说话：正文 + 改动稿 ----
  const SHAPE = '{"reply":"给她看的话（中文）","patches":[{"target":"style|persona|appearance|profile|theme|memory","id":"要改的那一条的 id；style 留空=新建；theme 填 global 或某一页的 key","field":"（只有 profile 用）要改哪一栏","title":"这条改动一句话叫什么","name":"（只有 style 新建时用）预设名","find":"（改一小段时用）逐字抄下原文里要动的那一段","text":"改一小段时＝换成这一段；不给 find 时＝改完的完整内容","why":"为什么这么改，一两句"}]}';

  // ---- 现状快照 + 手册：一份是「此刻长什么样」，一份是「这个世界有什么」----
  function manualBlock(question, hereId) {
    const M = MAN(); if (!M) return "";
    // 她此刻开着的那一页，词条也捎上：这样「这一页是干嘛的」不用她先说出它叫什么
    const here = hereId ? M.byId(hereId) : null;
    const hits = M.find(question, 4);
    if (here && !hits.some(x => x.id === here.id)) hits.unshift(here);
    return "【这个 App 有哪些东西 · 目录】\n" + M.index()
      + (hits.length ? "\n\n【她这次多半在问这几样 · 详细】\n" + hits.map(M.textOf).join("\n\n") : "");
  }

  function buildSystem(ctx, question, history) {
    // ⚠️「这会儿在说谁」拿【要发给模型的那整段窗口】来找，不是只看当前这一句：
    //   她上一句常常是「宝宝你再看看呢」，名字是在前面提的。
    //   跟发出去的窗口用同一份文本，判据才对得上——我们在聊谁，那张卡就是全的。
    // ⚠️她此刻开着的那一页上的人也算「在说谁」：站在 V 的聊天里说「他的卡有点 ooc」，
    //   一个名字都没提，可指的就是他——这张卡必须是全的。
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
      + "【最要紧的一条：不许编】\n"
      + "下面那份目录和详细，就是这个 App 的全部。手册里没写的细节，你就说不确定、让她点开看看——"
      + "编一个听起来很合理的功能出来，比答不上来坏得多。\n"
      + "她问的东西在目录里但详细没给全，就照目录那一句答，别往下展开。\n\n"
      + "【不答的那一类】这个 App 是【怎么造出来的】一律不答：代码、框架、文件、数据存在哪、技术选型。"
      + "她问到就一句话挡回去，然后把话拉回「你想改哪儿？我可以动手」。\n"
      + "⚠️「哪儿不对劲 / 报错 / 没生效」不属于这一类——那是要你帮她查的，照查。\n"
      + "查毛病的时候先看下面的现状快照，指出最可能卡在哪一步、怎么验证。常见成因："
      + "文风存了但这一局没切过去（线下顶栏 STYLE 那条会显示「未设文风」）；自定义文风与通用叙事准则冲突；"
      + "模型不认可选字段；出图被上游审核拒。这种时候通常不需要改动稿，除非改一处设置就能解决。\n\n"
      + "【你能动手改的东西·只有这几样】\n"
      + "· style 文风预设（写给 AI 的文风提示词；id 留空＝新建一份）\n"
      + "· persona 角色人设　· appearance 角色外貌\n"
      + "  ⚠️快照里每张角色卡都带一栏【这张卡是否完整】。为 true 就是全文，放心照它出 patch、别再说自己看不到；"
      + "为 false 的那张只给了开头，那就别出 patch——跟她确认是哪张卡，下一轮你就会拿到全文。\n"
      + "· profile 角色档案的其它栏（field 只能是：" + Object.keys(CARD_FIELDS).map(k => k + "＝" + CARD_FIELDS[k]).join("、") + "）\n"
      + "· theme 界面装修（text 是 CSS；id 填 global＝全 App" + (pages ? "，或某一页：" + pages : "") + "）\n"
      + "· memory 记忆库条目（往里加，一行一条，id＝角色 id）\n"
      + "别的一律不许碰，也别假装你改了。**装修只许改样子**——颜色、字号、间距、圆角、背景这些；别去动定位和显示与否，那会把界面弄坏。\n\n"
      + "【两种改法 · 挑对的那一种】\n"
      + "· **改一小段（默认走这个）**：填 find＝逐字抄下原文里要动的那一段（照快照里的原文抄，别改标点、别缩写），"
      + "text＝换成的那一段。替换在本地做，原文别处一个字节都不动。\n"
      + "  find 必须在原文里【只出现一次】；抄不准或者拿不准就别出这条 patch，先问她。\n"
      + "· **整段替换**：不填 find，text＝改完的完整内容。只在「整份重写」时用；"
      + "如果那张卡的【这张卡是否完整】是 false，你【绝对不许】整段替换——那会把她后面的设定冲掉，代码也会拦住你。\n\n"
      + "【最重要的规矩】你给出的 patch 只是【草稿】。" + uName + " 会一条条看过再决定应不应用，所以：\n"
      + "· 不填 find 的时候，text 必须是【改完的完整内容】，不是 diff、不是「在原文基础上加一句」。\n"
      + "· 一次别超过 3 条 patch；纯粹问功能的时候给空数组，光用 reply 答她。\n"
      + "· 拿不准她想要什么就先问，别擅自动手。改人设尤其要谨慎——那是她攒了很久的东西。\n\n"
      + (pageLine(ctx.page) ? pageLine(ctx.page) + "\n\n" : "")
      + manualBlock(question, here && here.man) + "\n\n"
      + "【App 现状快照】\n" + JSON.stringify(snap, null, 1) + "\n\n"
      + "【输出】只输出 JSON，不要代码块：\n" + SHAPE;
  }

  async function ask(active, ctx, history, text) {
    // 门在最前面：命中就当场回绝，一次调用都不花
    if (codeQuestion(text)) return { reply: CODE_REPLY, patches: [], refused: true };
    const msgs = chatWindow(history).map(m => ({ role: m.role === "me" ? "user" : "assistant", content: String(m.text || "") }))
      .concat([{ role: "user", content: String(text || "") }]);
    const raw = await callAI(active, buildSystem(ctx, text, history), msgs, { maxTokens: 12000, timeout: 120000 });
    const d = (typeof parseJSONLoose === "function" ? parseJSONLoose(raw) : extractJSON(raw)) || {};
    const patches = (Array.isArray(d.patches) ? d.patches : []).filter(x => x && TARGETS[x.target] && String(x.text || "").trim())
      .slice(0, 3)
      .map((x, i) => ({
        pid: "p" + Date.now() + "_" + i,
        target: x.target, id: String(x.id || "").trim(),
        field: String(x.field || "").trim(),
        find: String(x.find || ""),          // 有 find＝只改这一段，别处一个字节不动

        title: clip(x.title, 60) || TARGETS[x.target].zh,
        name: clip(x.name, 30), text: String(x.text).trim(), why: clip(x.why, 200)
      }));
    const reply = scrubCode(String(d.reply || "").trim());
    if (!reply && !patches.length) throw new Error("没听懂它说什么，再问一次");
    return { reply: reply || "改动稿在下面。", patches };
  }

  // ---- 她此刻在哪一页（她 2026-09-03 点名要的）----
  // 借的是 ai-virtual-phone 那个「页面上下文」的【想法】（AGPL，只看不抄）：
  // 助手知道你正开着哪一页，「这一页」「这里」「他」才有指代对象。
  // 一张表两用：给它一句人话说清在哪儿，再顺手把这一页的手册词条捎上，
  // 于是「这一页是干嘛的」不用她先说出这一页叫什么。
  // 值是 [人话, 手册词条 id]；手册里没有对应词条的就留空。
  const SCREEN_INFO = {
    home: ["主屏", "home"], messages: ["消息列表", "chat"],
    thread: ["和某个角色的单聊", "chat"], gthread: ["一个群聊", "group"],
    contact: ["某个角色的资料页", "cast"], cast: ["人格档案馆", "cast"],
    castForm: ["正在编一张角色卡", "cast"], ties: ["关系", "ties"],
    phone: ["查手机", "phone"], shop: ["购物", "shop"], carry: ["随身物", "carry"],
    mycloset: ["我的衣柜", "closet"], dwell: ["去处", "dwell"],
    cwallet: ["钱包", "wallet"], wallet: ["我的钱包", "wallet"], kincard: ["亲属卡账单", "wallet"],
    ledger: ["记账", "ledger"], calendar: ["日历", "calendar"], memo: ["备忘录", "memo"],
    map: ["好友地图", "map"], listen: ["一起听", "listen"], diary: ["日记", "diary"],
    lore: ["世界书", "lore"], memlib: ["记忆库", "memlib"], anon: ["匿名问答", "anon"],
    study: ["一起学", "study"], fanfic: ["同人文", "fanfic"], read: ["一起读", "read"],
    weekly: ["周刊", "weekly"], debate: ["擂台", "debate"], dream: ["梦境", "dream"],
    dreamjournal: ["解梦馆", "dreamjournal"], tarot: ["塔罗", "tarot"],
    pomodoro: ["番茄钟", "pomodoro"], games: ["小游戏", "games"], trpg: ["跑团", "trpg"],
    theater: ["小剧场", "theater"], impression: ["月度印象", "impression"],
    yanqiu: ["秋声", "yanqiu"], loungeapp: ["三席会客", "lounge"],
    rescue: ["互救台", "rescue"], vpscodex: ["值班室", "vpscodex"],
    forum: ["论坛", "forum"], momprofile: ["朋友圈", "moments"],
    us: ["情侣空间", "couple"], capsule: ["时光胶囊", "couple"],
    favorites: ["收藏", "favorites"], emotes: ["表情包", "emotes"],
    lifestyle: ["生活方式", ""], stylelab: ["文风台", "stylelab"],
    config: ["设置", "config"], assistant: ["你自己这一页", "assistant"],
    codex: ["", ""]
  };
  function pageOf(pg) {
    if (!pg || !pg.screen) return null;
    const row = SCREEN_INFO[pg.screen];
    const zh = (row && row[0]) || "";
    if (!zh) return null;
    return { zh: zh, man: (row && row[1]) || "", who: pg.charName || "" };
  }
  function pageLine(pg) {
    const p = pageOf(pg); if (!p) return "";
    return "【她此刻在哪儿】她正开着「" + p.zh + "」"
      + (p.who ? "，这一页上是「" + p.who + "」" : "")
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
  const UNDOABLE = { persona: 1, appearance: 1, profile: 1, theme: 1, style: 1 };
  function undoable(patch) {
    if (!patch || !UNDOABLE[patch.target]) return false;
    if (patch.target === "style" && !patch.id) return false;   // 新建的那一份没有「原来的样子」
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
      prev: String(before(patch, ctx) || "")
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
    T.write(e.id, { target: e.target, id: e.id, field: e.field, text: e.prev }, ctx);
    saveUndo(list.map(x => x.uid === uid ? Object.assign({}, x, { undone: true, undoneAt: Date.now() }) : x));
    if (e.pid) markPatch(e.pid, "已撤回");
    return e;
  }

  // 应用一条改动稿。写入口全在 TARGETS 里，这里只做校验、算出最终文本，再分发。
  function apply(patch, ctx) {
    const T = TARGETS[patch.target];
    if (!T) throw new Error("不认识的改动类型");
    if (patch.target !== "style" && !patch.id) throw new Error("这条没说要改谁");
    const p = patch;
    // ⚠️存旧版本必须在【写之前】，而且要在算最终文本之前——
    //   算完再存的话，改一小段那一支拿到的已经是新文本了，等于备份了个假的。
    pushUndo(p, ctx);
    if (p.find) {
      // 记忆库是往里加，没有「原文那一段」可言
      if (p.target === "memory") throw new Error("记忆库是往里加的，不能改一小段");
      const cur = before(p, ctx);
      if (!String(cur || "").trim()) throw new Error("原来这一栏是空的，没有可改的一小段");
      return T.write(p.id, Object.assign({}, p, { text: snippetEdit(cur, p.find, p.text) }), ctx);
    }
    // 整段替换：只看过半截就不许整段替换
    if (p.target === "persona" || p.target === "appearance" || p.target === "profile") {
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
    const rows = T.read(ctx) || [];
    const hit = rows.find(x => String(x.id) === String(patch.id));
    if (!hit) return "";
    if (patch.target === "profile") return String((hit.card || {})[patch.field] || "");
    return String(hit.text || "");
  }

  function labelOf(patch, ctx) {
    const T = TARGETS[patch.target];
    const rows = (T && T.read(ctx)) || [];
    const hit = rows.find(x => String(x.id) === String(patch.id));
    const fld = patch.target === "profile" && CARD_FIELDS[patch.field] ? " · " + CARD_FIELDS[patch.field] : "";
    return (T ? T.zh : "?") + (hit ? " · " + hit.name : (patch.target === "style" ? " · 新建" : "")) + fld;
  }

  window.Assistant = { ask, apply, before, labelOf, snapshot, TARGETS, CARD_FIELDS, codeQuestion, scrubCode, CODE_REPLY,
    loadCfg, saveCfg, DEFAULT_PROMPT, DEFAULT_NAME, loadChat, saveChat, onChat, chatWindow, onBusy, isBusy, bumpBusy, markPatch, undo, undoable, loadUndo, onUndo, UNDO_KEEP, markAsking, clearAsking, staleAsking, ASK_KEY, CHAT_KEEP, CTX_CHARS, CTX_MIN, activeFor, focusIds, buildSystem, pageOf, pageLine, SCREEN_INFO, snippetEdit, shownLen };
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

  // ---- 秋秋的默认头像（v61.43，她 2026-09-03 给了图：「左边是头像右边是图标」）----
  // 原来是程序画的那只线稿肥鸟；现在换成她那张画。
  // ⚠️两张图是从她那一张里切出来的，各自裁掉了透明边、按正方形居中、存成 webp
  //   （同一张画 png 要 80KB，webp 只要 15KB——这是要跟着 PWA 一起装的东西）。
  // ⚠️头像那张【原图带透明底】，所以这里自己垫一层奶油底：不垫的话深色主题下
  //   小鸡的浅黄会糊进深背景里，只剩两只眼睛浮着。
  function QiuBird(props) {
    const z = props.size || 34, r = props.radius != null ? props.radius : z / 2;
    return h("div", { style: { width: z, height: z, borderRadius: r, flexShrink: 0, overflow: "hidden",
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
    const state = props.state;
    const cutNew = sm ? 130 : 220, cutOld = sm ? 90 : 140;
    return h("div", { style: { marginTop: 10, borderRadius: 12, border: "1px solid " + t.line, background: t.bg2, overflow: "hidden" } },
      h("div", { style: { padding: sm ? "7px 10px" : "9px 12px", borderBottom: "1px solid " + t.line } },
        h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, letterSpacing: ".05em" } }, A.labelOf(p, ctx)),
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: sm ? 12.5 : 13.5, color: t.ink, marginTop: 2 } }, p.title),
        p.why ? h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.sub, marginTop: 4, lineHeight: 1.6 } }, p.why) : null),
      // 只改一小段的时候，摆的就是那一小段——不许把整份原文和整份新文摆出来让她自己找。
      // 那是这个改法的意义所在：她一眼看得清动了哪儿，也一眼看得出别处没动。
      p.find
        ? h("div", { style: { padding: sm ? "8px 10px" : "10px 12px" } },
            h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginBottom: 3 } }, "原文这一段"),
            h("div", { style: { fontFamily: F_BODY, fontSize: sm ? 11.5 : 12.5, color: t.fog, lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-word", textDecoration: "line-through", opacity: .8 } }, p.find),
            h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, margin: "8px 0 3px" } }, "换成"),
            h("div", { style: { fontFamily: F_BODY, fontSize: sm ? 11.5 : 12.5, color: t.ink, lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-word" } }, p.text || "（删掉这一段）"),
            h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: t.fog, marginTop: 7 } },
              was ? "这一栏一共 " + was.length + " 字，别处一个字都不动" : "别处一个字都不动"))
        : h("div", { style: { padding: sm ? "8px 10px" : "10px 12px" } },
            was ? h("div", { style: { marginBottom: 8 } },
              h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginBottom: 3 } }, "改前"),
              h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word", textDecoration: "line-through", opacity: .75 } },
                open ? was : was.slice(0, cutOld) + (was.length > cutOld ? "…" : ""))) : null,
            h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginBottom: 3 } }, was ? "改后 · 整段替换" : "新增"),
            h("div", { style: { fontFamily: F_BODY, fontSize: sm ? 11.5 : 12.5, color: t.ink, lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-word" } },
              open ? p.text : p.text.slice(0, cutNew) + (p.text.length > cutNew ? "…" : "")),
            (p.text.length > cutNew || (was && was.length > cutOld))
              ? h("button", { onClick: () => setOpen(!open), style: { marginTop: 6, background: "none", border: "none", padding: 0, fontFamily: F_BODY, fontSize: 11.5, color: t.tint } }, open ? "收起" : "看全文")
              : null),
      h("div", { style: { padding: "8px 12px 10px", borderTop: "1px solid " + t.line, display: "flex", alignItems: "center", gap: 10 } },
        state
          ? h(React.Fragment, null,
              h("span", { style: { fontFamily: F_BODY, fontSize: 11.5, color: state === "已应用" ? "#4a8b68" : state === "已撤回" ? t.fog : "#a4442e" } }, state),
              // 点了应用之后才后悔的那一种：就在这儿退回去
              state === "已应用" && A.undoable(p) && props.onUndo
                ? h("button", { onClick: props.onUndo, style: { background: "none", border: "none", fontFamily: F_BODY, fontSize: 11.5, color: t.tint, padding: 0 } }, "撤回")
                : null,
              state === "已应用" && !A.undoable(p)
                ? h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog } }, p.target === "memory" ? "（记忆库只进不出，退不了）" : "（新建的，退不了）")
                : null)
          : h(React.Fragment, null,
              h("button", { onClick: props.onApply, style: { padding: "6px 14px", borderRadius: 9, border: "none", background: t.ink, color: t.bg2, fontFamily: F_BODY, fontSize: 12 } }, "应用这条"),
              h("button", { onClick: props.onSkip, style: { background: "none", border: "none", fontFamily: F_BODY, fontSize: 12, color: t.fog } }, "跳过"))));
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
    const send = async text => {
      const q = String(text || "").trim();
      if (!q || A.isBusy()) return;              // 忙的时候两处都发不出第二句，免得回复串了顺序
      const act = A.activeFor(ctx);
      if (!act && !A.codeQuestion(q)) { toast && toast("请先到设置配置 API"); return; }
      A.bumpBusy(1); A.markAsking(q);
      const before = A.loadChat();
      put(before.concat([{ role: "me", text: q, ts: Date.now() }]));
      try {
        const r = await A.ask(act, ctx, before, q);
        put(A.loadChat().concat([{ role: "it", text: r.reply, patches: r.patches, ts: Date.now() }]));
      } catch (e) {
        put(A.loadChat().concat([{ role: "it", text: "没答上来：" + (e.message || "重试"), patches: [], ts: Date.now() }]));
      } finally { A.clearAsking(); A.bumpBusy(-1); }
    };
    const applyOne = p => {
      if (p.done === "已应用") return;           // 记忆库会加两遍、改一小段会找不到原文
      try {
        const n = A.apply(p, ctx);
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
    return { msgs, busy, send, applyOne, undoOne, skip, clear };
  }

  // 上一次问到一半 App 被系统收走了：明说出来，并给一个重问的入口。
  // 不说的话她看见的就是自己那句问话孤零零挂着——「回复没了」。
  function StaleAsk(props) {
    const t = useTheme(), C = props.C;
    const [gone, setGone] = useState(false);
    if (gone || C.busy) return null;
    const st = A.staleAsking(); if (!st) return null;
    return h("div", { style: { marginTop: 6, padding: "8px 10px", borderRadius: 10, border: "1px dashed " + t.line, background: "transparent" } },
      h("div", { style: { fontFamily: F_BODY, fontSize: props.big ? 11.5 : 11, color: t.fog, lineHeight: 1.6 } },
        "上一句没等到回复（App 被系统收走了）"),
      h("button", { onClick: () => { const q = st.q; A.clearAsking(); setGone(true); C.send(q); },
        style: { marginTop: 5, background: "none", border: "none", padding: 0, fontFamily: F_BODY, fontSize: props.big ? 12 : 11.5, color: t.tint } }, "再问一次"),
      h("button", { onClick: () => { A.clearAsking(); setGone(true); },
        style: { marginTop: 5, marginLeft: 12, background: "none", border: "none", padding: 0, fontFamily: F_BODY, fontSize: props.big ? 12 : 11.5, color: t.fog } }, "算了"));
  }

  // 一串气泡（整页和悬浮屏共用；只有尺寸不同）
  function Bubbles(props) {
    const t = useTheme(), sm = !!props.compact, C = props.C, av = sm ? 24 : 30;
    return h(React.Fragment, null, C.msgs.map((m, i) => m.role === "me"
      ? h("div", { key: i, style: { display: "flex", justifyContent: "flex-end", alignItems: "flex-start", gap: 7, marginBottom: sm ? 9 : 12 } },
          h("div", { style: { maxWidth: "78%", padding: sm ? "6px 10px" : "8px 12px", borderRadius: 12, background: t.accent, color: "#fff", fontFamily: F_BODY, fontSize: sm ? 12 : 13, lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-word" } }, m.text),
          h(MeFace, { profile: props.profile, size: av, radius: 9 }))
      : h("div", { key: i, style: { display: "flex", alignItems: "flex-start", gap: 7, marginBottom: sm ? 11 : 14 } },
          h(QiuFace, { cfg: props.cfg, size: av, radius: 9 }),
          h("div", { style: { flex: 1, minWidth: 0 } },
            h("div", { style: { fontFamily: F_BODY, fontSize: sm ? 12 : 13, color: t.ink, lineHeight: 1.75, whiteSpace: "pre-wrap", wordBreak: "break-word" } }, m.text),
            (m.patches || []).map(p => h(PatchCard, { key: p.pid, p: p, ctx: props.ctx, compact: sm, state: p.done, onApply: () => C.applyOne(p), onUndo: () => C.undoOne(p), onSkip: () => C.skip(p) }))))));
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
    const btn = (label, onClick, strong) => h("button", { key: label, onClick: onClick, style: {
      flex: 1, padding: "11px", borderRadius: 12, border: "none",
      background: strong ? t.ink : t.bg2, color: strong ? t.bg2 : t.sub, fontFamily: F_BODY, fontSize: 13 } }, label);
    return h("div", { style: { height: "100%", display: "flex", flexDirection: "column", background: t.bg } },
      h("div", { style: { display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", paddingTop: safeTop(10), borderBottom: "1px solid " + t.line, flexShrink: 0 } },
        h("button", { onClick: props.onBack, style: { background: "none", border: "none", color: t.ink, fontSize: 19, padding: "2px 6px" } }, "←"),
        h("div", { style: { flex: 1, fontFamily: F_DISPLAY, fontSize: 17, color: t.ink } }, "设置")),
      h("div", { style: { flex: 1, minHeight: 0, overflowY: "auto", paddingBottom: "calc(env(safe-area-inset-bottom, 0px) * 0.4 + 24px)" } },
        // 头像 + 名字
        h("div", { style: row },
          h(QiuFace, { cfg: cfg, size: 54, radius: 16 }),
          h("div", { style: { flex: 1, minWidth: 0 } },
            h("input", { value: name, onChange: e => setName(e.target.value), onBlur: () => put({ name: name.trim() || A.DEFAULT_NAME }),
              placeholder: A.DEFAULT_NAME,
              style: { width: "100%", padding: "8px 10px", borderRadius: 10, border: "1px solid " + t.line, background: t.bg2, fontFamily: F_DISPLAY, fontSize: 15, color: t.ink, outline: "none" } }),
            h("div", { style: { display: "flex", gap: 10, marginTop: 7 } },
              h("label", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.tint } }, "换张头像",
                h("input", { type: "file", accept: "image/*", style: { display: "none" }, onChange: async e => {
                  const f = e.target.files && e.target.files[0]; if (!f) return;
                  try {
                    const b64 = await new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = no; r.readAsDataURL(f); });
                    // 图片走图库，只存引用——直接把 base64 塞进配置会把本地存储撑爆
                    const ref = typeof imgToVault === "function" ? await imgToVault(b64) : b64;
                    put({ avatarImage: ref }); props.toast && props.toast("头像换好了");
                  } catch (err) { props.toast && props.toast("这张存不下：" + (err.message || err)); }
                } })),
              cfg.avatarImage ? h("button", { onClick: () => put({ avatarImage: "" }), style: { background: "none", border: "none", padding: 0, fontFamily: F_BODY, fontSize: 11.5, color: t.fog } }, "换回那只鸟") : null))),
        // 小球开关
        h("div", { style: row },
          h("div", { style: { flex: 1 } },
            h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, color: t.ink } }, "桌面小球"),
            h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginTop: 2, lineHeight: 1.5 } }, "每一页角落里都跟着，能拖到任何地方；点一下开合")),
          h("button", { onClick: () => put({ ballOn: !cfg.ballOn }), style: {
            width: 46, height: 27, borderRadius: 999, border: "none", padding: 0, flexShrink: 0,
            background: cfg.ballOn ? t.accent : t.line, position: "relative", transition: "background .18s" } },
            h("div", { style: { position: "absolute", top: 3, left: cfg.ballOn ? 22 : 3, width: 21, height: 21, borderRadius: 999, background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,.25)", transition: "left .18s" } }))),
        // 走哪条线路（她 2026-09-03：「还可以跟随全局 api 或者单独设定一个」）
        // 摆法照设置里【线下与创作模型】那一栏：第一行是「跟随全局」，底下一行一条线路。
        (function () {
          const list = props.apiProfiles || [];
          const cur = list.find(p => p && p.id === cfg.apiId);
          const nameOf = p => (p && (p.name || p.model)) || "未命名线路";
          const line = (id, title, sub) => {
            const on = (cfg.apiId || "") === (id || "");
            return h("button", { key: id || "_global", onClick: () => put({ apiId: id || "" }), style: {
              width: "100%", textAlign: "left", padding: "9px 11px", marginTop: 6, borderRadius: 11,
              border: "1px solid " + (on ? t.ink : t.line), background: on ? t.ink : t.bg2 } },
              h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: on ? t.bg2 : t.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, title),
              sub ? h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, marginTop: 2, color: on ? t.bg2 : t.fog, opacity: on ? .75 : 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, sub) : null);
          };
          return h("div", { style: { padding: "14px 14px 4px", borderBottom: "1px solid " + t.line } },
            h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, color: t.ink } }, "秋秋走哪条线路"),
            h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginTop: 3, lineHeight: 1.6 } },
              "不选＝跟随全局，跟聊天用的主模型同一条。也可以单独给它挑一条——它干的是查功能、出改动稿这种活，配一条便宜快的就够。"),
            line("", "跟随全局", (props.active && (props.active.name || props.active.model)) || "还没配主模型"),
            list.map(p => line(p.id, nameOf(p), p.model || "还没选模型")),
            !list.length ? h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginTop: 8, paddingBottom: 8 } }, "还没配过线路，去 设置 · 文字模型 加一条") : null,
            cfg.apiId && !cur ? h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.accent, marginTop: 8, paddingBottom: 8 } }, "原来挑的那条线路不在了，这会儿走的是全局") : null,
            h("div", { style: { height: 8 } }));
        })(),
        // 改过的东西：点了应用之后才后悔的那一种，在这儿退
        h(UndoList, { toast: props.toast, ctx: props.ctx }),
        // 主人格提示词
        h("div", { style: { padding: "14px 14px 0" } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, color: t.ink } }, "主人格提示词"),
          h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginTop: 3, lineHeight: 1.6, whiteSpace: "pre-wrap" } },
            "它是谁、怎么说话、干哪两件事，都写在这儿，随你改。\n（能改哪几样东西、不答代码那道门、输出成什么形状——这些是底下钉死的，删不掉。）"),
          h("textarea", { value: draft, onChange: e => setDraft(e.target.value), rows: 14,
            style: { width: "100%", marginTop: 10, padding: "12px 13px", borderRadius: 14, border: "1px solid " + t.line, background: t.bg2,
              fontFamily: F_BODY, fontSize: 12.5, lineHeight: 1.85, color: t.ink, resize: "none", outline: "none", minHeight: 260 } }),
          h("div", { style: { display: "flex", gap: 8, marginTop: 10 } },
            btn("默认", () => setDraft(A.DEFAULT_PROMPT)),
            btn("清空", () => setDraft("")),
            btn("保存", () => { put({ prompt: draft }); props.toast && props.toast("存好了"); }, true)),
          draft !== cfg.prompt ? h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.accent, marginTop: 8 } }, "改动还没保存") : null)));
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
    return h("div", { style: { padding: "14px 14px 6px", borderBottom: "1px solid " + t.line } },
      h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, color: t.ink } }, "改过的东西"),
      h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginTop: 3, lineHeight: 1.6 } },
        "秋秋改过的这些，改之前那一份还留着（最近 " + A.UNDO_KEEP + " 次）。点「退回」就写回旧的那份。"),
      live.map(e => h("div", { key: e.uid, className: "flex items-center", style: { gap: 10, padding: "9px 0", borderTop: "1px solid " + t.line } },
        h("div", { style: { flex: 1, minWidth: 0 } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: e.undone ? t.fog : t.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: e.undone ? "line-through" : "none" } }, e.title || e.label),
          h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } },
            e.label + " · " + when(e.ts) + (e.prev ? " · 旧的那份 " + e.prev.length + " 字" : " · 原来是空的"))),
        e.undone
          ? h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, flexShrink: 0 } }, "已退回")
          : h("button", { onClick: () => {
                try { A.undo(e.uid, props.ctx || {}); props.toast && props.toast("退回去了：" + (e.title || e.label)); }
                catch (err) { props.toast && props.toast("退不回去：" + (err.message || err)); }
              }, style: { flexShrink: 0, padding: "5px 11px", borderRadius: 8, border: "1px solid " + t.line, background: "transparent", fontFamily: F_BODY, fontSize: 11.5, color: t.tint } }, "退回"))));
  }

  // ============================================================
  // 整页版
  // ============================================================
  function AssistantApp(props) {
    const t = useTheme();
    const [input, setInput] = useState("");
    const [page, setPage] = useState("chat");      // chat | setup
    const [cfg, setCfg] = useState(A.loadCfg);
    const C = useAssistChat(props, props.toast);
    const scroller = useRef(null);
    useEffect(() => { if (scroller.current) scroller.current.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" }); }, [C.msgs.length, C.busy]);
    const fire = txt => { setInput(""); C.send(txt); };

    if (page === "setup") return h(AssistantSetup, { toast: props.toast, apiProfiles: props.apiProfiles, active: props.active, ctx: props, onBack: () => { setCfg(A.loadCfg()); setPage("chat"); } });

    const QUICK = ["这个 App 都能玩什么", "穿书怎么玩", "我设的文风好像没生效", "帮我把现在的文风改得更克制一点"];
    return h("div", { style: { position: "relative", height: "100%", display: "flex", flexDirection: "column", background: t.bg } },
      h("div", { style: { display: "flex", alignItems: "center", gap: 9, padding: "10px 14px", paddingTop: safeTop(10), borderBottom: "1px solid " + t.line, flexShrink: 0 } },
        h("button", { onClick: props.onBack, style: { background: "none", border: "none", color: t.ink, fontSize: 19, padding: "2px 4px" } }, "←"),
        h(QiuFace, { cfg: cfg, size: 28, radius: 9 }),
        h("div", { style: { flex: 1, fontFamily: F_DISPLAY, fontSize: 17, color: t.ink } }, cfg.name),
        C.msgs.length ? h("button", { onClick: C.clear, style: { background: "none", border: "none", fontFamily: F_BODY, fontSize: 12, color: t.fog, padding: "4px 6px" } }, "清空") : null,
        h("button", { onClick: () => setPage("setup"), style: { background: "none", border: "none", fontFamily: F_BODY, fontSize: 12, color: t.tint, padding: "4px 4px" } }, "设置")),
      h("div", { ref: scroller, style: { flex: 1, minHeight: 0, overflowY: "auto", padding: "14px 14px 20px" } },
        C.msgs.length === 0
          ? h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.fog, lineHeight: 1.9, marginTop: 6 } },
              "这个 App 里任何一样东西是什么、在哪儿、怎么用，都可以问我。哪儿不对劲、没生效，也一并问。\n我还能动手改五样：文风预设、角色人设、角色外貌、角色档案的其它栏、界面装修，也能往记忆库加条目。\n改之前一定先给你看改前改后，你点了「应用这条」才真的写进去。\n（我不答这个 App 是怎么造出来的——代码、框架那一类。）")
          : null,
        h(Bubbles, { C: C, ctx: props, profile: props.profile, cfg: cfg }),
        C.busy ? h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog } }, "在想…") : null,
        h(StaleAsk, { C: C, big: true }),
        !C.busy && C.msgs.length === 0
          ? h("div", { style: { display: "flex", flexWrap: "wrap", gap: 7, marginTop: 16 } },
              QUICK.map(q => h("button", { key: q, onClick: () => fire(q), style: { padding: "7px 12px", borderRadius: 999, border: "1px dashed " + t.line, background: "transparent", color: t.sub, fontFamily: F_BODY, fontSize: 12 } }, q)))
          : null),
      h("div", { style: { display: "flex", gap: 8, padding: "10px 14px", paddingBottom: "calc(" + COMPOSER_PAD_BOTTOM + " + 10px)", borderTop: "1px solid " + t.line, flexShrink: 0 } },
        h("textarea", { value: input, onChange: e => setInput(e.target.value), rows: 1,
          placeholder: "问功能、查毛病，或者说想改什么",
          style: { flex: 1, padding: "10px 13px", borderRadius: 14, border: "1px solid " + t.line, background: t.bg2, fontFamily: F_BODY, fontSize: 13, color: t.ink, resize: "none", outline: "none", maxHeight: 120 } }),
        h("button", { onClick: () => fire(input), disabled: C.busy, style: { padding: "8px 16px", borderRadius: 999, border: "none", background: t.ink, color: t.bg2, fontFamily: F_BODY, fontSize: 13 } }, C.busy ? "…" : "问")));
  }
  window.AssistantApp = AssistantApp;

  // ============================================================
  // 小悬浮屏
  //
  // ⚠️这一层为什么可以不是整页（.claude/rules/no-half-sheet.md）：
  //   那条规矩的判据是「这一层的内容，需要同时看见它下面那一层吗？」——
  //   这里的答案是【需要】，而且是全部的意义所在：她要一边看着某个功能一边问、
  //   一边让它改。整页会把要研究的那个东西整个盖掉，那就等于没有这个功能。
  //   也不是半窗：半窗钉死在屏幕下半截，这个能拖到任何地方、让开你正在看的那块。
  // ============================================================
  const DOCK_KEY = "x_assistDock";
  const BALL = 46;
  const loadDock = () => { try { return JSON.parse(localStorage.getItem(DOCK_KEY) || "{}") || {}; } catch (e) { return {}; } };
  const saveDock = d => { try { localStorage.setItem(DOCK_KEY, JSON.stringify(d)); } catch (e) {} };

  // ⚠️量屏高不许用 window.innerHeight（她 2026-09-03：「聊天框下面又太高了没有遵循规则」）。
  //   整个 app 的外壳写的是 height:100vh，而 iOS 独立 app 里 innerHeight 是【小视口】，
  //   比 100vh 矮一截——拿它算，浮窗就会浮在半空、底下空一大条。
  //   跟 App 的外壳量同一把尺子：直接量根节点。
  const vhOf = () => {
    try { const el = document.getElementById("root"); const r = el && el.getBoundingClientRect(); if (r && r.height > 200) return r.height; } catch (e) {}
    return (typeof window !== "undefined" && window.innerHeight) || 800;
  };
  // 底部留白也跟主聊天输入栏同一把尺子（COMPOSER_PAD_BOTTOM，0.4 条安全区），
  // 不自己拍一个数（.claude/rules/mobile-ui-layout.md §2）。
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

  function AssistantDock(props) {
    const t = useTheme();
    const [open, setOpen] = useState(false);
    const [cfg, setCfg] = useState(A.loadCfg);
    const [input, setInput] = useState("");
    const [pos, setPos] = useState(() => {
      const d = loadDock();
      return { x: Number.isFinite(d.x) ? d.x : -1, y: Number.isFinite(d.y) ? d.y : -1 };
    });
    const C = useAssistChat(props, props.toast);
    const scroller = useRef(null);
    const dragRef = useRef(null);
    const movedRef = useRef(false);
    useEffect(() => { if (scroller.current) scroller.current.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" }); }, [C.msgs.length, C.busy, open]);
    // 设置页里把小球关了/开了，这边要跟上（同一个存档，两处都在看）
    useEffect(() => {
      const tick = setInterval(() => { const n = A.loadCfg(); setCfg(c => (c.ballOn === n.ballOn && c.name === n.name && c.avatarImage === n.avatarImage) ? c : n); }, 2000);
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
      const d = dragRef.current; dragRef.current = null;
      if (d && movedRef.current) { const now = at(); saveDock({ ...loadDock(), x: now.x, y: now.y }); }
    };
    const swallowIfDragged = () => { if (movedRef.current) { movedRef.current = false; return true; } return false; };
    const dragProps = { onPointerDown: onDown, onPointerMove: onMove, onPointerUp: endDrag, onPointerCancel: endDrag };

    if (!cfg.ballOn) return null;
    const base = { position: "fixed", zIndex: 940, touchAction: "none" };

    // 收起来的样子：一颗小球，点一下开合
    if (!open) return h("div", { ...dragProps,
      onClick: () => { if (!swallowIfDragged()) setOpen(true); },
      style: { ...base, left: a.x, top: a.y, width: BALL, height: BALL, borderRadius: 999,
        background: t.bg2, border: "1px solid " + t.line, boxShadow: "0 4px 14px rgba(0,0,0,.22)",
        display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", cursor: "grab" } },
      h(QiuFace, { cfg: cfg, size: 40, radius: 999 }));

    // 展开的样子：一扇能拖的小窗
    return h("div", {
      style: { ...base, left: a.x, top: a.y, width: panelW(), height: panelH(), borderRadius: 16,
        background: t.bg, border: "1px solid " + t.line, boxShadow: "0 10px 34px rgba(0,0,0,.30)",
        display: "flex", flexDirection: "column", overflow: "hidden" }
    },
      // 顶上这条就是把手：按住它拖窗
      h("div", { ...dragProps, onClick: () => { swallowIfDragged(); },
        style: { display: "flex", alignItems: "center", gap: 7, padding: "8px 8px 8px 11px", borderBottom: "1px solid " + t.line, background: t.bg2, cursor: "grab", flexShrink: 0 } },
        h("div", { style: { width: 18, height: 3, borderRadius: 2, background: t.line, flexShrink: 0 } }),
        h(QiuFace, { cfg: cfg, size: 22, radius: 7 }),
        h("div", { style: { flex: 1, minWidth: 0, fontFamily: F_DISPLAY, fontSize: 13, color: t.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, cfg.name),
        C.msgs.length ? h("button", { onPointerDown: e => e.stopPropagation(), onClick: C.clear, style: { background: "none", border: "none", fontFamily: F_BODY, fontSize: 11, color: t.fog, padding: "4px 5px" } }, "清空") : null,
        h("button", { onPointerDown: e => e.stopPropagation(), onClick: () => setOpen(false), style: { background: "none", border: "none", fontSize: 15, color: t.sub, padding: "2px 7px" } }, "－")),
      h("div", { ref: scroller, style: { flex: 1, minHeight: 0, overflowY: "auto", padding: "11px 12px 12px" } },
        C.msgs.length === 0
          ? h("div", null,
              h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, lineHeight: 1.85 } },
                "这一页的东西怎么用，问我。哪儿不对劲也问。想改的话我直接动手：装修、文风、角色档案。\n拖着顶上那条能把我挪开。"),
              h("div", { style: { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 } },
                ["这一页是干嘛的", "这个 App 都能玩什么", "把这一页的字调大一点"].map(q =>
                  h("button", { key: q, onClick: () => C.send(q), style: { padding: "6px 10px", borderRadius: 999, border: "1px dashed " + t.line, background: "transparent", color: t.sub, fontFamily: F_BODY, fontSize: 11.5 } }, q))))
          : null,
        h(Bubbles, { C: C, ctx: props, profile: props.profile, cfg: cfg, compact: true }),
        C.busy ? h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog } }, "在想…") : null,
        h(StaleAsk, { C: C })),
      h("div", { style: { display: "flex", gap: 6, padding: "7px 9px 8px", borderTop: "1px solid " + t.line, flexShrink: 0 } },
        h("textarea", { value: input, rows: 1, onChange: e => setInput(e.target.value),
          onKeyDown: e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); C.send(input); setInput(""); } },
          placeholder: "问点什么…",
          style: { flex: 1, minWidth: 0, padding: "8px 11px", borderRadius: 12, border: "1px solid " + t.line, background: t.bg2, fontFamily: F_BODY, fontSize: 12, color: t.ink, resize: "none", outline: "none", maxHeight: 84 } }),
        h("button", { onClick: () => { C.send(input); setInput(""); }, disabled: C.busy,
          style: { padding: "7px 13px", borderRadius: 999, border: "none", background: t.ink, color: t.bg2, fontFamily: F_BODY, fontSize: 12 } }, C.busy ? "…" : "问")));
  }
  window.AssistantDock = AssistantDock;
})();
