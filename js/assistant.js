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

  // 图标：一支笔搭在方框上（改东西的意思）
  window.GAssist = p => h(Svg, p,
    h("path", { d: "M4 5.5A1.5 1.5 0 015.5 4h7" }),
    h("path", { d: "M20 11.5v7a1.5 1.5 0 01-1.5 1.5h-13A1.5 1.5 0 014 18.5v-7" }),
    h("path", { d: "M19.6 3.6a1.9 1.9 0 012.7 2.7L14.6 14 11 15l1-3.6z" }));

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
      ballOn: d.ballOn !== false
    };
  }
  function saveCfg(patch) {
    const next = { ...loadCfg(), ...patch };
    try { localStorage.setItem(CFG_KEY, JSON.stringify(next)); } catch (e) {}
    return next;
  }

  // ---- 这一段对话（她 2026-09-03：「它聊天也要有上下文然后可以清空」）----
  // ⚠️整页和小悬浮屏是【同一段对话】，不是两段：在小球里问了半句、点开整页接着说，
  //   这才叫上下文。所以它落在存档里，两处都读同一份。
  const CHAT_KEY = "x_assistChat";
  const CHAT_KEEP = 60;
  function loadChat() { try { const a = JSON.parse(localStorage.getItem(CHAT_KEY) || "[]"); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  function saveChat(list) {
    const a = (Array.isArray(list) ? list : []).slice(-CHAT_KEEP);
    try { localStorage.setItem(CHAT_KEY, JSON.stringify(a)); } catch (e) {}
    return a;
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
  function snapshot(ctx) {
    const chars = (ctx.characters || []).map(c => ({
      名字: c.name, id: c.id,
      人设: clip(c.persona, 220) || "（空）",
      外貌: clip(c.appearance, 120) || "（空）",
      有参考照: !!c.refPhoto, 出图画风: c.photoStyle || "realistic"
    }));
    const styles = loadJ("x_offlineStyles", []).map(s => ({ 名称: s.name, id: s.key, 字数: String(s.prompt || "").length }));
    const offSet = loadJ("x_offlineSettings", {});
    const errs = (typeof window !== "undefined" && window.__errLog ? window.__errLog : []).slice(-5)
      .map(e => clip(e && e.msg, 120));
    return { 角色: chars, 已存的文风预设: styles, 线下设置: offSet, 最近报错: errs.length ? errs : ["（本次开机没抓到报错）"] };
  }

  // ---- 让它按固定形状说话：正文 + 改动稿 ----
  const SHAPE = '{"reply":"给她看的话（中文）","patches":[{"target":"style|persona|appearance|profile|theme|memory","id":"要改的那一条的 id；style 留空=新建；theme 填 global 或某一页的 key","field":"（只有 profile 用）要改哪一栏","title":"这条改动一句话叫什么","name":"（只有 style 新建时用）预设名","text":"改完的完整内容","why":"为什么这么改，一两句"}]}';

  // ---- 现状快照 + 手册：一份是「此刻长什么样」，一份是「这个世界有什么」----
  function manualBlock(question) {
    const M = MAN(); if (!M) return "";
    const hits = M.find(question, 4);
    return "【这个 App 有哪些东西 · 目录】\n" + M.index()
      + (hits.length ? "\n\n【她这次多半在问这几样 · 详细】\n" + hits.map(M.textOf).join("\n\n") : "");
  }

  function buildSystem(ctx, question) {
    const snap = snapshot(ctx);
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
      + "· profile 角色档案的其它栏（field 只能是：" + Object.keys(CARD_FIELDS).map(k => k + "＝" + CARD_FIELDS[k]).join("、") + "）\n"
      + "· theme 界面装修（text 是 CSS；id 填 global＝全 App" + (pages ? "，或某一页：" + pages : "") + "）\n"
      + "· memory 记忆库条目（往里加，一行一条，id＝角色 id）\n"
      + "别的一律不许碰，也别假装你改了。**装修只许改样子**——颜色、字号、间距、圆角、背景这些；别去动定位和显示与否，那会把界面弄坏。\n\n"
      + "【最重要的规矩】你给出的 patch 只是【草稿】。" + uName + " 会一条条看过再决定应不应用，所以：\n"
      + "· text 必须是【改完的完整内容】，不是 diff、不是「在原文基础上加一句」——她要能直接整段替换。\n"
      + "· 一次别超过 3 条 patch；纯粹问功能的时候给空数组，光用 reply 答她。\n"
      + "· 拿不准她想要什么就先问，别擅自动手。改人设尤其要谨慎——那是她攒了很久的东西。\n\n"
      + manualBlock(question) + "\n\n"
      + "【App 现状快照】\n" + JSON.stringify(snap, null, 1) + "\n\n"
      + "【输出】只输出 JSON，不要代码块：\n" + SHAPE;
  }

  async function ask(active, ctx, history, text) {
    // 门在最前面：命中就当场回绝，一次调用都不花
    if (codeQuestion(text)) return { reply: CODE_REPLY, patches: [], refused: true };
    const msgs = (history || []).slice(-14).map(m => ({ role: m.role === "me" ? "user" : "assistant", content: String(m.text || "") }))
      .concat([{ role: "user", content: String(text || "") }]);
    const raw = await callAI(active, buildSystem(ctx, text), msgs, { maxTokens: 12000, timeout: 120000 });
    const d = (typeof parseJSONLoose === "function" ? parseJSONLoose(raw) : extractJSON(raw)) || {};
    const patches = (Array.isArray(d.patches) ? d.patches : []).filter(x => x && TARGETS[x.target] && String(x.text || "").trim())
      .slice(0, 3)
      .map((x, i) => ({
        pid: "p" + Date.now() + "_" + i,
        target: x.target, id: String(x.id || "").trim(),
        field: String(x.field || "").trim(),
        title: clip(x.title, 60) || TARGETS[x.target].zh,
        name: clip(x.name, 30), text: String(x.text).trim(), why: clip(x.why, 200)
      }));
    const reply = scrubCode(String(d.reply || "").trim());
    if (!reply && !patches.length) throw new Error("没听懂它说什么，再问一次");
    return { reply: reply || "改动稿在下面。", patches };
  }

  // 应用一条改动稿。写入口全在 TARGETS 里，这里只做校验与分发。
  function apply(patch, ctx) {
    const T = TARGETS[patch.target];
    if (!T) throw new Error("不认识的改动类型");
    if (patch.target !== "style" && !patch.id) throw new Error("这条没说要改谁");
    return T.write(patch.id, patch, ctx);
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
    loadCfg, saveCfg, DEFAULT_PROMPT, DEFAULT_NAME, loadChat, saveChat, CHAT_KEEP };
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

  // ---- 秋秋的默认头像：一只小肥鸟（她 2026-09-03 点的）----
  // 程序画的，不占存储、不走图库；她自己换了照片就用她那张。
  // 颜色写死是【故意的】：头像是一张画，不是界面——它自带底色，深浅主题下都看得清，
  // 跟着主题变色反而会变成一坨认不出的东西。
  function QiuBird(props) {
    const z = props.size || 34, r = props.radius != null ? props.radius : z / 2;
    return h("svg", { width: z, height: z, viewBox: "0 0 44 44", style: { display: "block", borderRadius: r, flexShrink: 0 } },
      h("rect", { x: 0, y: 0, width: 44, height: 44, rx: r * (44 / z), fill: "#f4e7d0" }),
      // 呆毛
      h("path", { d: "M22 6.6c0-2.3 1.3-3.6 2.9-4", stroke: "#e0a93f", strokeWidth: 1.9, strokeLinecap: "round", fill: "none" }),
      // 身子 + 脑袋：两个圆叠出一只胖鸟的轮廓
      h("ellipse", { cx: 22, cy: 26.5, rx: 15, ry: 12.4, fill: "#f2c45f" }),
      h("circle", { cx: 22, cy: 16.6, r: 10.4, fill: "#f6cd72" }),
      // 肚子那块浅的
      h("ellipse", { cx: 22, cy: 29.4, rx: 9.4, ry: 8.2, fill: "#fbe1a4" }),
      // 翅膀
      h("ellipse", { cx: 32.6, cy: 27.6, rx: 3.9, ry: 6.2, fill: "#e0a93f", transform: "rotate(20 32.6 27.6)" }),
      h("ellipse", { cx: 11.4, cy: 27.6, rx: 3.9, ry: 6.2, fill: "#e0a93f", transform: "rotate(-20 11.4 27.6)" }),
      // 眼睛（一点高光，不然像两颗豆子）
      h("circle", { cx: 18.2, cy: 16, r: 2, fill: "#3b3229" }),
      h("circle", { cx: 25.8, cy: 16, r: 2, fill: "#3b3229" }),
      h("circle", { cx: 18.9, cy: 15.3, r: .65, fill: "#fff" }),
      h("circle", { cx: 26.5, cy: 15.3, r: .65, fill: "#fff" }),
      // 嘴
      h("path", { d: "M22 19.2l-2.9 2.5h5.8z", fill: "#e8814a" }),
      // 腮红
      h("ellipse", { cx: 13.6, cy: 20.2, rx: 2.4, ry: 1.5, fill: "#ef9d7e", opacity: .55 }),
      h("ellipse", { cx: 30.4, cy: 20.2, rx: 2.4, ry: 1.5, fill: "#ef9d7e", opacity: .55 }),
      // 脚
      h("path", { d: "M18.4 38.6v-2M18.4 38.6l-2 1.5M18.4 38.6l2 1.5M25.6 38.6v-2M25.6 38.6l-2 1.5M25.6 38.6l2 1.5",
        stroke: "#e8814a", strokeWidth: 1.5, strokeLinecap: "round", fill: "none" }));
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
      h("div", { style: { padding: sm ? "8px 10px" : "10px 12px" } },
        was ? h("div", { style: { marginBottom: 8 } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginBottom: 3 } }, "改前"),
          h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word", textDecoration: "line-through", opacity: .75 } },
            open ? was : was.slice(0, cutOld) + (was.length > cutOld ? "…" : ""))) : null,
        h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginBottom: 3 } }, was ? "改后" : "新增"),
        h("div", { style: { fontFamily: F_BODY, fontSize: sm ? 11.5 : 12.5, color: t.ink, lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-word" } },
          open ? p.text : p.text.slice(0, cutNew) + (p.text.length > cutNew ? "…" : "")),
        (p.text.length > cutNew || (was && was.length > cutOld))
          ? h("button", { onClick: () => setOpen(!open), style: { marginTop: 6, background: "none", border: "none", padding: 0, fontFamily: F_BODY, fontSize: 11.5, color: t.tint } }, open ? "收起" : "看全文")
          : null),
      h("div", { style: { padding: "8px 12px 10px", borderTop: "1px solid " + t.line, display: "flex", alignItems: "center", gap: 10 } },
        state
          ? h("span", { style: { fontFamily: F_BODY, fontSize: 11.5, color: state === "已应用" ? "#4a8b68" : "#a4442e" } }, state)
          : h(React.Fragment, null,
              h("button", { onClick: props.onApply, style: { padding: "6px 14px", borderRadius: 9, border: "none", background: t.ink, color: t.bg2, fontFamily: F_BODY, fontSize: 12 } }, "应用这条"),
              h("button", { onClick: props.onSkip, style: { background: "none", border: "none", fontFamily: F_BODY, fontSize: 12, color: t.fog } }, "跳过"))));
  }

  // ---- 一段对话的公共脑子：整页和悬浮屏共用同一段，落在存档里 ----
  // ⚠️两处各存各的话就不叫上下文了：在小球里问了半句、点开整页接着说，它得记得。
  //   所以 state 只是镜子，真身在 x_assistChat；每次收发都两边一起更新。
  function useAssistChat(ctx, toast) {
    const [msgs, setMsgs] = useState(A.loadChat);
    const [busy, setBusy] = useState(false);
    const [done, setDone] = useState({});          // pid -> "已应用" | 错误原文
    const put = list => { setMsgs(A.saveChat(list)); };
    const send = async text => {
      const q = String(text || "").trim();
      if (!q || busy) return;
      // 代码问题在 Assistant.ask 里当场回绝，不走网络；所以这一步不拦 active
      if (!ctx.active && !A.codeQuestion(q)) { toast && toast("请先到设置配置 API"); return; }
      setBusy(true);
      const before = A.loadChat();
      put(before.concat([{ role: "me", text: q, ts: Date.now() }]));
      try {
        const r = await A.ask(ctx.active, ctx, before, q);
        put(A.loadChat().concat([{ role: "it", text: r.reply, patches: r.patches, ts: Date.now() }]));
      } catch (e) {
        put(A.loadChat().concat([{ role: "it", text: "没答上来：" + (e.message || "重试"), patches: [], ts: Date.now() }]));
      } finally { setBusy(false); }
    };
    const applyOne = p => {
      try {
        const n = A.apply(p, ctx);
        setDone(d => ({ ...d, [p.pid]: "已应用" }));
        toast && toast(p.target === "memory" ? "写进记忆库 " + n + " 条"
          : p.target === "theme" ? "装修上身了" : "改好了，下次生成生效");
      } catch (e) {
        setDone(d => ({ ...d, [p.pid]: "没应用：" + (e.message || "未知") }));
      }
    };
    const skip = p => setDone(d => ({ ...d, [p.pid]: "跳过了" }));
    const clear = () => { setDone({}); put([]); };
    return { msgs, busy, done, send, applyOne, skip, clear };
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
            (m.patches || []).map(p => h(PatchCard, { key: p.pid, p: p, ctx: props.ctx, compact: sm, state: C.done[p.pid], onApply: () => C.applyOne(p), onSkip: () => C.skip(p) }))))));
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

    if (page === "setup") return h(AssistantSetup, { toast: props.toast, onBack: () => { setCfg(A.loadCfg()); setPage("chat"); } });

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
        C.busy ? h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog } }, "在想…") : null),
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
