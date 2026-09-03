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

  function buildSystem(ctx, mode, question) {
    const snap = snapshot(ctx);
    const uName = (ctx.profile && ctx.profile.name) || "她";
    const ts = TS();
    const pages = ts ? (ts.PAGES || []).map(x => x[0] + "＝" + x[1]).join("、") : "";
    return "你是这个私人 App 里的【向导】。把 " + uName + " 当成刚走进这个世界的人：她问哪样东西是什么、在哪儿、怎么用，你都答得上来，而且答得具体——说清在哪一页、点哪儿、有什么要留神的。\n"
      + "说话短、直接、不客套，不用敬语堆砌，也别把她的问题复述一遍再答。\n\n"
      + "【最要紧的一条：不许编】\n"
      + "下面那份目录和详细，就是这个 App 的全部。手册里没写的细节，你就说不确定、让她点开看看——"
      + "编一个听起来很合理的功能出来，比答不上来坏得多。\n"
      + "她问的东西在目录里但详细没给全，就照目录那一句答，别往下展开。\n\n"
      + "【不答的那一类】这个 App 是【怎么造出来的】一律不答：代码、框架、文件、数据存在哪、技术选型。"
      + "她问到就一句话挡回去，然后把话拉回「你想改哪儿？我可以动手」。\n"
      + "⚠️「哪儿不对劲 / 报错 / 没生效」不属于这一类——那是要你帮她查的，照查。\n\n"
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
      + (mode === "diagnose"
        ? "【这一轮她在问「为什么没生效」】先看下面的现状快照，指出最可能卡在哪一步，说清怎么验证。\n"
          + "常见成因：文风存了但这一局没切过去（线下顶栏 STYLE 那条会显示「未设文风」）；"
          + "自定义文风与通用叙事准则冲突；模型不认可选字段（不吐 photo/thought 这类）；出图被上游审核拒。\n"
          + "诊断轮通常不需要 patch，除非改一处设置就能解决。\n\n"
        : "")
      + manualBlock(question) + "\n\n"
      + "【App 现状快照】\n" + JSON.stringify(snap, null, 1) + "\n\n"
      + "【输出】只输出 JSON，不要代码块：\n" + SHAPE;
  }

  async function ask(active, ctx, history, text, mode) {
    // 门在最前面：命中就当场回绝，一次调用都不花
    if (codeQuestion(text)) return { reply: CODE_REPLY, patches: [], refused: true };
    const msgs = (history || []).slice(-8).map(m => ({ role: m.role === "me" ? "user" : "assistant", content: String(m.text || "") }))
      .concat([{ role: "user", content: String(text || "") }]);
    const raw = await callAI(active, buildSystem(ctx, mode, text), msgs, { maxTokens: 12000, timeout: 120000 });
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

  window.Assistant = { ask, apply, before, labelOf, snapshot, TARGETS, CARD_FIELDS, codeQuestion, scrubCode, CODE_REPLY };
})();

// ============================================================
// 界面：一问一答 + 改动稿卡片（改前/改后并排，逐条应用）
//   · AssistantApp  整页版（主屏第三页那个图标）
//   · AssistantDock 小悬浮屏（她 2026-09-03 要的：能拖，边看功能边问）
// ============================================================
(function () {
  const useState = React.useState, useRef = React.useRef, useEffect = React.useEffect;
  const A = window.Assistant;

  // ---- 改动稿卡片：整页和悬浮屏共用一份 ----
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

  // ---- 一段对话的公共脑子：整页和悬浮屏共用同一套收发与应用 ----
  function useAssistChat(ctx, toast) {
    const [msgs, setMsgs] = useState([]);          // {role:"me"|"it", text, patches?}
    const [busy, setBusy] = useState(false);
    const [done, setDone] = useState({});          // pid -> "已应用" | 错误原文
    const send = async (text, mode) => {
      const q = String(text || "").trim();
      if (!q || busy) return;
      // 代码问题在 Assistant.ask 里当场回绝，不走网络；所以这一步不拦 active
      if (!ctx.active && !A.codeQuestion(q)) { toast && toast("请先到设置配置 API"); return; }
      setBusy(true);
      const hist = msgs.concat([{ role: "me", text: q }]);
      setMsgs(hist);
      try {
        const r = await A.ask(ctx.active, ctx, msgs, q, mode);
        setMsgs(h2 => h2.concat([{ role: "it", text: r.reply, patches: r.patches }]));
      } catch (e) {
        setMsgs(h2 => h2.concat([{ role: "it", text: "没答上来：" + (e.message || "重试"), patches: [] }]));
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
    return { msgs, busy, done, send, applyOne, skip };
  }

  // ============================================================
  // 整页版
  // ============================================================
  function AssistantApp(props) {
    const t = useTheme();
    const [input, setInput] = useState("");
    const [mode, setMode] = useState("chat");      // chat | diagnose
    const C = useAssistChat(props, props.toast);
    const scroller = useRef(null);
    useEffect(() => { if (scroller.current) scroller.current.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" }); }, [C.msgs.length, C.busy]);
    const fire = txt => { setInput(""); C.send(txt, mode); };
    const [dockHidden, setDockHidden] = useState(() => { try { return !!(JSON.parse(localStorage.getItem("x_assistDock") || "{}").hidden); } catch (e) { return false; } });

    const S = {
      wrap: { position: "relative", height: "100%", display: "flex", flexDirection: "column", background: t.bg },
      chip: on => ({ padding: "5px 11px", borderRadius: 999, border: "1px solid " + (on ? t.accent : t.line), background: on ? t.accent : "transparent", color: on ? "#fff" : t.sub, fontFamily: F_BODY, fontSize: 11.5 })
    };
    const QUICK = mode === "diagnose"
      ? ["我设的文风好像没生效", "线下出图老是失败", "心声好久不更新了"]
      : ["这个 App 都能玩什么", "穿书怎么玩", "帮我把现在的文风改得更克制一点"];

    return h("div", { style: S.wrap },
      h("div", { style: { display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", paddingTop: safeTop(10), borderBottom: "1px solid " + t.line } },
        h("button", { onClick: props.onBack, style: { background: "none", border: "none", color: t.ink, fontSize: 19, padding: "2px 6px" } }, "←"),
        h("div", { style: { flex: 1, fontFamily: F_DISPLAY, fontSize: 17, color: t.ink } }, "帮手"),
        h("button", { onClick: () => setMode("chat"), style: S.chip(mode === "chat") }, "问 · 改"),
        h("button", { onClick: () => setMode("diagnose"), style: S.chip(mode === "diagnose") }, "查毛病")),
      h("div", { ref: scroller, style: { flex: 1, overflowY: "auto", padding: "14px 14px 20px" } },
        C.msgs.length === 0
          ? h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.fog, lineHeight: 1.9, marginTop: 6 } },
              mode === "diagnose"
                ? "哪儿不对劲就问。它看得见你现在的角色、文风预设、线下设置和最近的报错，会告诉你卡在哪一步。"
                : "这个 App 里任何一样东西是什么、在哪儿、怎么用，都可以问它。\n它也能动手改五样：文风预设、角色人设、角色外貌、角色档案的其它栏、界面装修，还能往记忆库加条目。\n改之前一定先给你看改前改后，你点了「应用这条」才真的写进去。\n（它不答这个 App 是怎么造出来的——代码、框架那一类。）")
          : null,
        dockHidden && C.msgs.length === 0
          ? h("button", { onClick: () => {
                try { const d = JSON.parse(localStorage.getItem("x_assistDock") || "{}"); d.hidden = false; localStorage.setItem("x_assistDock", JSON.stringify(d)); } catch (e) {}
                setDockHidden(false); props.toast && props.toast("小球放回来了，回到别的页面就能看见");
              }, style: { marginTop: 14, padding: "8px 14px", borderRadius: 999, border: "1px dashed " + t.line, background: "transparent", color: t.tint, fontFamily: F_BODY, fontSize: 12 } }, "把小球放回来")
          : null,
        C.msgs.map((m, i) => m.role === "me"
          ? h("div", { key: i, style: { display: "flex", justifyContent: "flex-end", marginBottom: 12 } },
              h("div", { style: { maxWidth: "82%", padding: "8px 12px", borderRadius: 14, background: t.accent, color: "#fff", fontFamily: F_BODY, fontSize: 13, lineHeight: 1.7, whiteSpace: "pre-wrap" } }, m.text))
          : h("div", { key: i, style: { marginBottom: 14 } },
              h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: t.ink, lineHeight: 1.8, whiteSpace: "pre-wrap" } }, m.text),
              (m.patches || []).map(p => h(PatchCard, { key: p.pid, p: p, ctx: props, state: C.done[p.pid], onApply: () => C.applyOne(p), onSkip: () => C.skip(p) })))),
        C.busy ? h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog } }, "在想…") : null,
        !C.busy && C.msgs.length === 0
          ? h("div", { style: { display: "flex", flexWrap: "wrap", gap: 7, marginTop: 16 } },
              QUICK.map(q => h("button", { key: q, onClick: () => fire(q), style: { padding: "7px 12px", borderRadius: 999, border: "1px dashed " + t.line, background: "transparent", color: t.sub, fontFamily: F_BODY, fontSize: 12 } }, q)))
          : null),
      h("div", { style: { display: "flex", gap: 8, padding: "10px 14px calc(env(safe-area-inset-bottom, 0px) + 12px)", borderTop: "1px solid " + t.line } },
        h("textarea", { value: input, onChange: e => setInput(e.target.value), rows: 1,
          placeholder: mode === "diagnose" ? "哪儿不对劲？" : "问功能，或者说想改什么",
          style: { flex: 1, padding: "10px 13px", borderRadius: 14, border: "1px solid " + t.line, background: t.bg2, fontFamily: F_BODY, fontSize: 13, color: t.ink, resize: "none", outline: "none", maxHeight: 120 } }),
        h("button", { onClick: () => fire(input), disabled: C.busy, style: { padding: "8px 16px", borderRadius: 999, border: "none", background: t.ink, color: t.bg2, fontFamily: F_BODY, fontSize: 13 } }, C.busy ? "…" : "问")));
  }
  window.AssistantApp = AssistantApp;

  // ============================================================
  // 小悬浮屏（她 2026-09-03：「做个小悬浮屏可以拖动，边和它聊边改动或者研究功能」）
  //
  // ⚠️这一层为什么可以不是整页（.claude/rules/no-half-sheet.md）：
  //   那条规矩的判据是「这一层的内容，需要同时看见它下面那一层吗？」——
  //   这里的答案是【需要】，而且是全部的意义所在：她要一边看着某个功能一边问它、
  //   一边让它改。整页会把要研究的那个东西整个盖掉，那就等于没有这个功能。
  //   也不是半窗：半窗是钉死在屏幕下半截的，这个能拖到任何地方、让开你正在看的那块。
  // ============================================================
  const DOCK_KEY = "x_assistDock";
  const BALL = 46;
  const loadDock = () => { try { return JSON.parse(localStorage.getItem(DOCK_KEY) || "{}") || {}; } catch (e) { return {}; } };
  const saveDock = d => { try { localStorage.setItem(DOCK_KEY, JSON.stringify(d)); } catch (e) {} };

  function AssistantDock(props) {
    const t = useTheme();
    const [open, setOpen] = useState(false);
    const [hidden, setHidden] = useState(() => !!loadDock().hidden);
    const [input, setInput] = useState("");
    const [pos, setPos] = useState(() => {
      const d = loadDock();
      return { x: Number.isFinite(d.x) ? d.x : -1, y: Number.isFinite(d.y) ? d.y : -1 };
    });
    const C = useAssistChat(props, props.toast);
    const scroller = useRef(null);
    const dragRef = useRef(null);
    useEffect(() => { if (scroller.current) scroller.current.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" }); }, [C.msgs.length, C.busy]);

    const vw = () => (typeof window !== "undefined" && window.innerWidth) || 390;
    const vh = () => (typeof window !== "undefined" && window.innerHeight) || 800;
    const panelW = () => Math.min(348, vw() - 20);
    const panelH = () => Math.min(452, Math.max(280, vh() - 150));
    // 默认落在右下角，避开底栏；-1 表示「还没拖过，用默认位置」
    const at = () => {
      const w = open ? panelW() : BALL, hh = open ? panelH() : BALL;
      const x = pos.x < 0 ? vw() - w - 12 : pos.x;
      const y = pos.y < 0 ? vh() - hh - 96 : pos.y;
      // 夹回屏内：拖到边上、或者横竖屏切换之后，别让它跑出去点不着
      return { x: Math.max(6, Math.min(x, vw() - w - 6)), y: Math.max(6, Math.min(y, vh() - hh - 6)) };
    };
    const a = at();

    // 拖：按下记起点，移动时跟手，抬起时看挪了多远——挪得少就当成点了一下
    const onDown = e => {
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
      dragRef.current = { x0: e.clientX, y0: e.clientY, px: a.x, py: a.y, moved: 0 };
    };
    const onMove = e => {
      const d = dragRef.current; if (!d) return;
      const dx = e.clientX - d.x0, dy = e.clientY - d.y0;
      d.moved = Math.max(d.moved, Math.abs(dx) + Math.abs(dy));
      if (d.moved > 4) { e.preventDefault(); setPos({ x: d.px + dx, y: d.py + dy }); }
    };
    const onUp = tapAction => e => {
      const d = dragRef.current; dragRef.current = null;
      if (!d) return;
      if (d.moved <= 4) { tapAction && tapAction(); return; }
      const now = at();
      saveDock({ ...loadDock(), x: now.x, y: now.y });
    };
    const hide = () => { setOpen(false); setHidden(true); saveDock({ ...loadDock(), hidden: true }); props.toast && props.toast("小球收起来了 · 去「帮手」那一页能叫回来"); };

    if (hidden) return null;

    const base = { position: "fixed", zIndex: 940, touchAction: "none" };

    // 收起来的样子：一颗小球
    if (!open) return h("div", {
      style: { ...base, left: a.x, top: a.y, width: BALL, height: BALL, borderRadius: 999,
        background: t.ink, boxShadow: "0 4px 14px rgba(0,0,0,.24)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "grab" },
      onPointerDown: onDown, onPointerMove: onMove, onPointerUp: onUp(() => setOpen(true)), onPointerCancel: onUp(null)
    }, h(window.GAssist, { size: 21, color: t.bg2 }));

    // 展开的样子：一扇能拖的小窗
    return h("div", {
      style: { ...base, left: a.x, top: a.y, width: panelW(), height: panelH(), borderRadius: 16,
        background: t.bg, border: "1px solid " + t.line, boxShadow: "0 10px 34px rgba(0,0,0,.30)",
        display: "flex", flexDirection: "column", overflow: "hidden" }
    },
      // 顶上这条就是把手：按住它拖窗
      h("div", { style: { display: "flex", alignItems: "center", gap: 6, padding: "9px 8px 9px 12px", borderBottom: "1px solid " + t.line, background: t.bg2, cursor: "grab", touchAction: "none" },
        onPointerDown: onDown, onPointerMove: onMove, onPointerUp: onUp(null), onPointerCancel: onUp(null) },
        h("div", { style: { width: 22, height: 3, borderRadius: 2, background: t.line, marginRight: 2 } }),
        h("div", { style: { flex: 1, fontFamily: F_DISPLAY, fontSize: 13.5, color: t.ink } }, "帮手"),
        h("button", { onPointerDown: e => e.stopPropagation(), onClick: hide, style: { background: "none", border: "none", fontFamily: F_BODY, fontSize: 11, color: t.fog, padding: "4px 6px" } }, "收起来"),
        h("button", { onPointerDown: e => e.stopPropagation(), onClick: () => setOpen(false), style: { background: "none", border: "none", fontSize: 15, color: t.sub, padding: "2px 8px" } }, "－")),
      h("div", { ref: scroller, style: { flex: 1, minHeight: 0, overflowY: "auto", padding: "11px 12px 14px" } },
        C.msgs.length === 0
          ? h("div", null,
              h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, lineHeight: 1.85 } },
                "这一页的东西怎么用，问我。也可以让我直接改：装修、文风、角色档案。\n拖着顶上那条能把我挪开。"),
              h("div", { style: { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 } },
                ["这一页是干嘛的", "这个 App 都能玩什么", "把这一页的字调大一点"].map(q =>
                  h("button", { key: q, onClick: () => C.send(q, "chat"), style: { padding: "6px 10px", borderRadius: 999, border: "1px dashed " + t.line, background: "transparent", color: t.sub, fontFamily: F_BODY, fontSize: 11.5 } }, q))))
          : null,
        C.msgs.map((m, i) => m.role === "me"
          ? h("div", { key: i, style: { display: "flex", justifyContent: "flex-end", marginBottom: 9 } },
              h("div", { style: { maxWidth: "84%", padding: "6px 10px", borderRadius: 12, background: t.accent, color: "#fff", fontFamily: F_BODY, fontSize: 12, lineHeight: 1.65, whiteSpace: "pre-wrap", wordBreak: "break-word" } }, m.text))
          : h("div", { key: i, style: { marginBottom: 11 } },
              h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.ink, lineHeight: 1.75, whiteSpace: "pre-wrap", wordBreak: "break-word" } }, m.text),
              (m.patches || []).map(p => h(PatchCard, { key: p.pid, p: p, ctx: props, compact: true, state: C.done[p.pid], onApply: () => C.applyOne(p), onSkip: () => C.skip(p) })))),
        C.busy ? h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog } }, "在想…") : null),
      h("div", { style: { display: "flex", gap: 6, padding: "8px 10px 10px", borderTop: "1px solid " + t.line } },
        h("textarea", { value: input, rows: 1, onChange: e => setInput(e.target.value),
          onKeyDown: e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); C.send(input, "chat"); setInput(""); } },
          placeholder: "问点什么…",
          style: { flex: 1, minWidth: 0, padding: "8px 11px", borderRadius: 12, border: "1px solid " + t.line, background: t.bg2, fontFamily: F_BODY, fontSize: 12, color: t.ink, resize: "none", outline: "none", maxHeight: 84 } }),
        h("button", { onClick: () => { C.send(input, "chat"); setInput(""); }, disabled: C.busy,
          style: { padding: "7px 13px", borderRadius: 999, border: "none", background: t.ink, color: t.bg2, fontFamily: F_BODY, fontSize: 12 } }, C.busy ? "…" : "问")));
  }
  window.AssistantDock = AssistantDock;
})();
