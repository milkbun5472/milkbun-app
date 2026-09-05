// ============================================================
// 一起读（read）—— 仿电子书架 + 邀角色一起看 + 批注 + 半屏讨论 + 总结喂记忆库
// 书的正文存 IndexedDB（本地，不进云同步，避免撑爆存档）；
// 书的元数据 + 阅读进度 + 批注存 localStorage x_read_books（随云同步）。
// 模型调用直接走全局 callAI；喂全局记忆库靠 props.onAddMemory 回调。
// ============================================================
(function () {
  // 禁烟这一层（她 2026-09-05：「你看看还有哪儿没禁烟的」）。
  // ⚠️它是【世界事实】，不是文风：这个 app 里没人抽烟，那在哪一处都得成立。
  //   原来它只挂在 buildBundle / groupBans 上，于是【凡是自己拼 sys 的地方一律没有】。
  //   不许塞进 ANTI_CLICHE 搭便车（v55.90 那条：能独立成立的规则就让它独立成立，
  //   挂在别人身上，别人不发的那一轮它就跟着消失）。
  const CB = () => (typeof ContentBoundaries !== "undefined" && ContentBoundaries.prompt ? ContentBoundaries.prompt + "\n\n" : "");
  // ---- IndexedDB：只放正文，key=bookId，value=全文字符串 ----
  const DB_NAME = "LisaReadDB", STORE = "books";
  function idb() {
    return new Promise(function (res, rej) {
      const r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = function () { if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE); };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
  }
  function idbPut(id, text) {
    return idb().then(function (db) { return new Promise(function (res, rej) {
      const tx = db.transaction(STORE, "readwrite"); tx.objectStore(STORE).put(text, id);
      tx.oncomplete = function () { res(); }; tx.onerror = function () { rej(tx.error); };
    }); });
  }
  function idbGet(id) {
    return idb().then(function (db) { return new Promise(function (res, rej) {
      const rq = db.transaction(STORE, "readonly").objectStore(STORE).get(id);
      rq.onsuccess = function () { res(rq.result || ""); }; rq.onerror = function () { rej(rq.error); };
    }); });
  }
  function idbDel(id) {
    return idb().then(function (db) { return new Promise(function (res, rej) {
      const tx = db.transaction(STORE, "readwrite"); tx.objectStore(STORE).delete(id);
      tx.oncomplete = function () { res(); }; tx.onerror = function () { rej(tx.error); };
    }); });
  }

  // ---- 元数据存取 ----
  function loadBooks() { return loadJSON("x_read_books", []); }
  function saveBooks(list) { return saveJSON("x_read_books", list); }

  const PAGE_CHARS = 1600; // 每页目标字数（按段落边界切）
  function paginate(text) {
    const raw = String(text || "").replace(/\r\n/g, "\n").split(/\n+/).map(function (s) { return s.trim(); }).filter(Boolean);
    // 把「没换行的超长大段」按句末标点切成 ~500 字的小块，保证有足够段落锚点、也能正常翻页；正常段落不动
    const paras = [];
    raw.forEach(function (p) {
      if (p.length <= PAGE_CHARS) { paras.push(p); return; }
      const sents = p.match(/[^。！？!?…]*[。！？!?…]+|[^。！？!?…]+$/g) || [p];
      let buf = "";
      sents.forEach(function (s) {
        if (buf && (buf + s).length > 500) { paras.push(buf); buf = s; } else buf += s;
      });
      if (buf) paras.push(buf);
    });
    if (!paras.length) return [[""]];
    const pages = []; let cur = []; let len = 0;
    paras.forEach(function (p) {
      cur.push(p); len += p.length;
      if (len >= PAGE_CHARS) { pages.push(cur); cur = []; len = 0; }
    });
    if (cur.length) pages.push(cur);
    return pages.length ? pages : [[""]];
  }
  const spineColor = function (id) {
    const pal = ["#5a6357", "#4f5a63", "#7a6a5a", "#6d5a78", "#33322e", "#8a5a4a"];
    let s = 0; for (let i = 0; i < id.length; i++) s = (s + id.charCodeAt(i)) % pal.length;
    return pal[s];
  };

  // ---- 主线那一整份上下文（四处一样喂 · 第九处）------------------
  // 她 2026-09-05：「这些批注是喂了全部人设和那一堆吗宝宝」。
  // 答案原来是【没有】。一起读自己拼 sys 走 callAI，不走 buildBundle 也不走 runProbe，
  // 于是只白得了它自己 push 的反陈词滥调和内容边界；心情、好感、印象卡、长期记忆、
  // 情侣状态、用户人设，还有那几条【靠调用点一条条 push】的禁令，一条都没有。
  //
  // ⚠️病因跟解梦馆（v61.47）、匿名信箱（v61.37）、穿书（v61.16）、通话（v60.27）
  //   一字不差：**它当初就没在那张名单上**。于是「几处都接上了」每次都是真的，
  //   这一处每次都漏。名单从今天起是【九处】。
  //
  // ⚠️这一处尤其吃亏，因为批注是「就着一句话说一句话」：
  //   · 最顺手的开口就是把原句反问回来（「他真的不在乎吗？」）→ 正是回声禁令要挡的；
  //   · 批注天然容易滑成「这里作者其实是想说……」的讲解腔 → 正是居高临下要挡的；
  //   · 他今天心情差、或者你俩刚吵完，批注本该不一样——读不到心情，
  //     每次读都是同一个温度，那也是她说的「单调」的一部分。
  //
  // ⚠️不改成 runProbe：那一条强制 JSON，而批注/讲解是【逐行】输出的
  //   （弱模型逐行写「正好 N 条」比塞 JSON 数组可靠得多，这是原作者写下的理由）。
  //   所以走 buildBundle 直接取那一整份料，输出格式一个字不动。
  // ⚠️buildBundle 自带的和这里要补的，别搞重：
  //   它已经带了 ANTI_CLICHE / CONDESCENDING_TONE_BAN / STOCK_REPLY_BAN / ContentBoundaries；
  //   缺的正是那三条【靠调用点一条条 push】的（回声禁令 / 语域跟场面走 / 读懂这句话在做什么）。
  //   所以 readHead 只此一份：接得上上下文就发整份 bundle，接不上才退回老那两条，
  //   两条路都在末尾补那三条——各写各的必然只改一处。
  //
  // ⚠️【写明理由的差异】不发【最近聊天】：ctxFor 本来就不带它（各聊天入口自己另加），
  //   而这一处要写的是就着书页说的话，不是把聊天接着往下说。心情、好感、印象卡都在，
  //   「他今天什么状态」这件事已经够了。
  function readHead(ctxFor, char) {
    let head = "";
    if (typeof ctxFor === "function" && typeof buildBundle === "function" && char) {
      try { head = buildBundle(ctxFor(char)) + "\n\n"; } catch (e) { head = ""; }
    }
    // 接不上的时候退回老那两条，并且【人设由这儿补】——所以底下五处提示词
    // 一律不再自己写一遍「【你的人设】」：bundle 里本来就有，写两遍等于把人设发两份。
    if (!head) head = (typeof ANTI_CLICHE !== "undefined" ? ANTI_CLICHE + "\n\n" : "") + CB()
      + "【你的人设】\n" + ((char && char.persona) || "（暂无设定）") + "\n\n";
    const more = [];
    if (typeof ECHO_QUESTION_BAN !== "undefined") more.push(ECHO_QUESTION_BAN);
    if (typeof REGISTER_FOLLOWS_SCENE !== "undefined") more.push(REGISTER_FOLLOWS_SCENE);
    if (typeof ReplyPacing !== "undefined" && ReplyPacing.reading) { try { more.push(ReplyPacing.reading()); } catch (e) {} }
    return head + (more.length ? more.join("\n\n") + "\n\n" : "");
  }

  // ---- 模型：让角色对给定段落（可跨多页）批注若干条 ----
  //   paras 是一段扁平的段落文本数组（可能跨好几页）；返回 [{i, note}]，i 是 paras 里的 0 基下标。
  //   输出走「逐行」而非 JSON 数组——弱模型逐行写「正好 N 条」比塞 JSON 数组可靠得多。
  async function genAnnotations(active, char, profile, worldbook, paras, n, prior, ctxFor) {
    const uName = (profile && profile.name) || "对方";
    const maxPara = paras.length;
    const numbered = paras.map(function (p, i) { return "[" + (i + 1) + "] " + p; }).join("\n");
    const sys = readHead(ctxFor, char) +
      "你在和「" + uName + "」一起读一本书，在书页边上写旁批。完全代入下面这个角色，用【你自己的人设、口吻、见识、脾气】去读、去反应——共鸣、吐槽、联想到自己、看穿人物心机、被某句戳到、和作者较劲都行。别写读后感八股、别复述剧情，短、有你这个人的味道。\n判据一句话：**这条批注遮住名字，还认得出是你写的吗**——认不出就是写坏了。人设是拿来定你怎么看这段的，不是拿来抄内容的。" +
      (worldbook && worldbook.trim() ? "\n\n【世界书】\n" + worldbook.trim() : "") +
      (prior && prior.length ? "\n\n【你之前已经批注过的（别重复这些）】\n" + prior.map(function (a) { return "· " + a.note; }).join("\n") : "") +
      "\n\n【正文（按段落编号，可能跨好几页）】\n" + numbered +
      "\n\n请就上面这段，写**正好 " + n + " 条**批注，可以分布在不同段落、也可多条落在同一段。\n【输出格式·务必严格遵守】只输出 " + n + " 行，每行一条批注，格式为 `段<段号>：<批注>`（段号是上面正文里的方括号编号，一行一条，冒号后直接写批注）。\n不要写 JSON、不要总起语、不要空行、不要任何多余的话——就这 " + n + " 行，一行都不能少。";
    // 开满（她 2026-09-05：「顺便 maxtoken 也放开吧 65535」）。
    // ⚠️这一处原来是 Math.min(8000, 1200 + maxPara*280)——一页只有五六段时算出来才 2900，
    //   思考型模型光想就把它吃光，于是返回空、界面上写「Ta 没讲出来，换一页再试」。
    //   而【那道 maxTokens 地板闸没抓到它】：闸的正则要求冒号后面紧跟数字，
    //   `maxTokens: Math.min(...)` 这种写法整行都匹配不上。闸自己有盲区的时候，全绿什么都不证明。
    const raw = await callAI(active, sys, [{ role: "user", content: "写满 " + n + " 条，每行一条。" }], { maxTokens: 65535 });
    // 先把「段N：」标记前都断行——兼容弱模型把多条挤在一行/一段的情况
    const norm = String(raw || "").replace(/```/g, "").replace(/\s*(段\s*\d+\s*[：:])/g, "\n$1");
    const lines = norm.split(/\n+/).map(function (s) { return s.trim(); }).filter(Boolean);
    const out = [];
    let spread = 0;
    lines.forEach(function (line) {
      if (/[：:]\s*$/.test(line)) return;                        // 以冒号结尾的开场白（如「好的，这就来：」）
      if (/^(好的|没问题|以下|如下|这就|收到|明白|ok|okay)/i.test(line) && line.length < 14) return; // 短套话
      const m = line.match(/^\s*(?:段|第)?\s*\[?\s*(\d+)\s*\]?\s*[：:.、)\-\s]+(.+)$/);
      let para, note;
      if (m) { para = Number(m[1]); note = m[2].trim(); }
      else { note = line.replace(/^[\s\d.、)\]［］【】\[\-—·•]+/, "").trim(); para = null; } // 没给段号，稍后铺开
      if (!note || note.length < 2) return;
      if (para == null) { para = Math.min(maxPara, 1 + Math.floor(spread * maxPara / Math.max(1, n))); spread++; }
      if (!(para >= 1)) para = 1;
      if (para > maxPara) para = maxPara;
      out.push({ i: para - 1, note: note });
    });
    return out.slice(0, n);
  }

  // ---- 模型：半屏讨论 ----
  async function discussReply(active, char, profile, worldbook, book, paras, anns, history, userMsg, ctxFor) {
    const uName = (profile && profile.name) || "对方";
    const passage = paras.join("\n").slice(0, 2200);
    const annText = anns.length ? anns.map(function (a) { return "· " + a.note; }).join("\n") : "";
    const hist = history.slice(-16).map(function (m) { return (m.role === "user" ? uName : char.name) + "：" + m.content; }).join("\n");
    const sys = readHead(ctxFor, char) +
      "你在和「" + uName + "」一起读《" + (book.title || "这本书") + "》，此刻你俩正就读到的这一段聊剧情。完全代入你的人设，像和朋友边读边讨论那样自然说话——有观点、会追问、会八卦人物、会和 " + uName + " 的看法碰撞，别客套别总结陈词。" +
      (worldbook && worldbook.trim() ? "\n\n【世界书】\n" + worldbook.trim() : "") +
      "\n\n【你俩正读到的这一页】\n" + passage +
      (annText ? "\n\n【你刚在这页写下的批注】\n" + annText : "") +
      (hist ? "\n\n【你俩刚才的讨论】\n" + hist : "") +
      "\n\n【输出】只输出 JSON：{\"say\":[\"气泡1\",\"气泡2\"]}。拆成 1~3 条短气泡，像即时通讯，别加名字前缀、别旁白括号、别 markdown。";
    const raw = await callAI(active, sys, [{ role: "user", content: userMsg }], { maxTokens: 65535 });
    const parsed = extractJSON(raw);
    const say = (parsed && Array.isArray(parsed.say)) ? parsed.say.filter(Boolean) : null;
    return say && say.length ? say : [String(raw || "").replace(/^\{|\}$/g, "").trim() || "……"];
  }

  // ---- 模型：结束时把这次共读总结成记忆 ----
  // ⚠️人设原来在这一枪里被 .slice(0, 300) 截掉了。这是 v55.87「群里的王爷变霸总」
  //   那次同一个数量级的病（那次 200 字）：只剩一个标签，空白由训练先验补上。
  //   而这一枪写的是【会长期记住的事实、用他的第一人称】——要进记忆库、以后一直被读到的东西。
  //   人设截成一句话，写出来的就是一份通用读后感，然后它变成他的长期记忆。
  async function summarizeSession(active, char, profile, book, anns, history, ctxFor) {
    const uName = (profile && profile.name) || "对方";
    const annText = anns.slice(-12).map(function (a) { return "· " + a.note; }).join("\n");
    const hist = history.slice(-24).map(function (m) { return (m.role === "user" ? uName : char.name) + "：" + m.content; }).join("\n");
    if (!annText && !hist) return "";
    const sys = readHead(ctxFor, char) + "把下面这次「你和 " + uName + " 一起读《" + (book.title || "一本书") + "》」的经历，浓缩成 1~3 句会长期记住的事实（用你的第一人称视角）：你们一起读了什么、你对内容/人物的关键看法、和 " + uName + " 讨论时碰出的观点或默契、Ta 让你印象深的反应。只写沉淀下来的东西，别流水账。只输出这几句话本身。";
    const u = (annText ? "【你的批注】\n" + annText + "\n\n" : "") + (hist ? "【讨论】\n" + hist : "");
    return (await callAI(active, sys, [{ role: "user", content: u }], { maxTokens: 65535 })).trim();
  }

  // ---- 模型：中译中·逐段讲解（每段都给大白话解释 + 角色看法），并回一句本页梗概续到已读脉络 ----
  async function genExplains(active, char, profile, worldbook, paras, synopsis, ctxFor) {
    const uName = (profile && profile.name) || "对方";
    const maxPara = paras.length;
    const numbered = paras.map(function (p, i) { return "[" + (i + 1) + "] " + p; }).join("\n");
    const sys = readHead(ctxFor, char) +
      "你在和「" + uName + "」一起读一本书。Ta 常常看不太懂原文，需要你【逐段讲给 Ta 听】——像给朋友中译中那样，把每一段【在讲什么】用大白话说清楚：谁做了什么、难懂的词/典故/文言/背景点破，藏在字面下的意思也挑明；再顺带一句你自己（按人设）的看法或反应。别复述原句、别掉书袋、别写读后感八股。每段 1~3 句，说人话。" +
      (worldbook && worldbook.trim() ? "\n\n【世界书】\n" + worldbook.trim() : "") +
      (synopsis && synopsis.trim() ? "\n\n【前情脉络（你俩之前已经读到这儿，接着往下讲、别自相矛盾）】\n" + synopsis.trim() : "") +
      "\n\n【本页正文（按段落编号）】\n" + numbered +
      "\n\n请给【每一段都写一条讲解】，从第 1 段到第 " + maxPara + " 段，一段都不能漏。\n【输出格式·务必严格遵守】先逐段输出，每行 `段<段号>：<讲解>`；最后单独一行 `梗概：<用一句话概括本页发生了什么，接前情往下>`（段号是上面正文里的方括号编号，一行一段，冒号后直接写讲解）。\n不要写 JSON、不要总起语、不要空行、别的话一句都别加。";
    const raw = await callAI(active, sys, [{ role: "user", content: "逐段讲，从段1讲到段" + maxPara + "，最后给一句梗概。" }], { maxTokens: 65535 });
    const norm = String(raw || "").replace(/```/g, "").replace(/\s*(段\s*\d+\s*[：:])/g, "\n$1").replace(/\s*(梗概\s*[：:])/g, "\n$1");
    const lines = norm.split(/\n+/).map(function (s) { return s.trim(); }).filter(Boolean);
    const explains = [];
    let gist = "";
    lines.forEach(function (line) {
      const gm = line.match(/^梗概\s*[：:]\s*(.+)$/);
      if (gm) { gist = gm[1].trim(); return; }
      const m = line.match(/^\s*(?:段|第)?\s*\[?\s*(\d+)\s*\]?\s*[：:.、)\-\s]+(.+)$/);
      if (!m) return;
      const para = Number(m[1]), text = m[2].trim();
      if (!(para >= 1) || para > maxPara || text.length < 2) return;
      explains.push({ i: para - 1, text: text });
    });
    return { explains: explains, gist: gist };
  }

  // ---- 模型：就划线/单段的一小截，讲清是什么意思（中译中）----
  async function genExplainSnippet(active, char, profile, worldbook, snippet, context, synopsis, ctxFor) {
    const uName = (profile && profile.name) || "对方";
    const sys = readHead(ctxFor, char) +
      "「" + uName + "」在和你一起读书时划出了下面这句/这段，说没太看懂，要你讲讲。把它【什么意思、为什么这么说、藏着什么言外之意】用大白话讲清楚（该点破的典故/文言/背景都点破），再加一句你按自己人设的看法。别复述原文、别掉书袋，2~4 句说人话。" +
      (worldbook && worldbook.trim() ? "\n\n【世界书】\n" + worldbook.trim() : "") +
      (synopsis && synopsis.trim() ? "\n\n【前情脉络】\n" + synopsis.trim() : "") +
      (context && String(context).trim() ? "\n\n【这句所在的上下文】\n" + String(context).slice(0, 600) : "") +
      "\n\n只输出讲解本身，别加前缀、别加引号、别写「好的」之类。";
    const raw = await callAI(active, sys, [{ role: "user", content: "划线的是：「" + String(snippet).slice(0, 500) + "」\n讲讲这是什么意思。" }], { maxTokens: 65535 });
    return String(raw || "").replace(/```/g, "").trim();
  }

  // ---- 懒加载 pdf.js（仅在导入 PDF 时才拉），抽取含文本层 / 已 OCR 的 PDF 文字 ----
  let _pdfjsP = null;
  function loadPdfjs() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if (_pdfjsP) return _pdfjsP;
    _pdfjsP = new Promise(function (res, rej) {
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js";
      s.onload = function () {
        try { window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js"; } catch (e) {}
        res(window.pdfjsLib);
      };
      s.onerror = function () { _pdfjsP = null; rej(new Error("pdf.js 加载失败（需要联网）")); };
      document.head.appendChild(s);
    });
    return _pdfjsP;
  }
  async function extractPdfText(file, onProg) {
    const lib = await loadPdfjs();
    const buf = await file.arrayBuffer();
    const pdf = await lib.getDocument({ data: buf }).promise;
    const pages = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const tc = await page.getTextContent();
      let line = "", lastY = null;
      const rows = [];
      tc.items.forEach(function (it) {
        if (typeof it.str !== "string") return;
        const y = it.transform ? it.transform[5] : null;
        // 换行：pdf.js 给了 EOL，或 y 坐标跳了一行
        if (lastY !== null && y !== null && Math.abs(y - lastY) > 2 && line) { rows.push(line); line = ""; }
        line += it.str;
        if (it.hasEOL) { rows.push(line); line = ""; }
        lastY = y;
      });
      if (line) rows.push(line);
      pages.push(rows.join("\n"));
      if (onProg) onProg(p, pdf.numPages);
    }
    return pages.join("\n\n");
  }

  // ============================================================
  // 组件
  // ============================================================
  function ReadTogether(props) {
    const t = useTheme();
    const [books, setBooks] = useState(loadBooks);
    const [openId, setOpenId] = useState(null);
    const fileRef = useRef(null);

    const persist = function (list) { if (saveBooks(list)) setBooks(list); else props.toast && props.toast("这次没保存成功，原书还在"); };
    const patchBook = function (id, patch) {
      persist(loadBooks().map(function (b) { return b.id === id ? Object.assign({}, b, typeof patch === "function" ? patch(b) : patch) : b; }));
    };

    const onFile = async function (e) {
      const f = e.target.files && e.target.files[0];
      e.target.value = "";
      if (!f) return;
      const isPdf = /\.pdf$/i.test(f.name) || (f.type && f.type.indexOf("pdf") >= 0);
      const isTxt = /\.txt$/i.test(f.name) || (f.type && f.type.indexOf("text") >= 0);
      if (!isPdf && !isTxt) { props.toast && props.toast("支持 .txt 或已 OCR 的 .pdf"); return; }
      try {
        let text;
        if (isPdf) {
          props.toast && props.toast("解析 PDF 中…");
          text = await extractPdfText(f, function (p, n) { if (p === 1 || p % 20 === 0 || p === n) props.toast && props.toast("解析 PDF " + p + "/" + n + " 页…"); });
          if (!text || !text.trim()) { props.toast && props.toast("没读到文字——这份 PDF 可能是没 OCR 的扫描图，先 OCR 成带文本层的 PDF 再传"); return; }
        } else {
          text = await f.text();
          if (!text.trim()) { props.toast && props.toast("这个文件是空的"); return; }
        }
        const id = "bk_" + Date.now();
        await idbPut(id, text);
        const title = f.name.replace(/\.(txt|pdf)$/i, "").slice(0, 40);
        persist([{ id: id, title: title, addedTs: Date.now(), lastReadTs: Date.now(), size: text.length, page: 0, partnerId: null, perPass: 3, annotations: [], explains: {}, synopsis: "", showExplains: true }].concat(loadBooks()));
        props.toast && props.toast("《" + title + "》已上架");
      } catch (err) { props.toast && props.toast("读取失败：" + (err.message || "重试")); }
    };

    const delBook = async function (id) {
      try { await idbDel(id); } catch (e) {}
      persist(loadBooks().filter(function (b) { return b.id !== id; }));
      if (openId === id) setOpenId(null);
    };

    if (openId) {
      const bk = books.find(function (b) { return b.id === openId; });
      if (!bk) { setOpenId(null); return null; }
      return h(Reader, {
        book: bk, characters: props.characters, profile: props.profile, worldbook: props.worldbook, worldbookFor: props.worldbookFor, active: props.active, bgActive: props.bgActive || props.active, toast: props.toast,
        digitalIds: props.digitalIds,
        // ⚠️这一层是【一条条列名字】往下传的：漏一个不会报错，只会让里头那一处
        //   静默退回兜底路（我第一版就漏了 ctxFor，浏览器里量出来 sys 只有 2544 字、
        //   心情好感一样没有，而 try/catch 把它咽下去了，什么都看不出来）。
        ctxFor: props.ctxFor,
        onBack: function () { setOpenId(null); },
        onPatch: function (patch) { patchBook(bk.id, patch); },
        onAddMemory: props.onAddMemory
      });
    }

    // ---- 书架（v62.64 重做）----------------------------------------
    // 审美审计 2026-09-04：「一块米白上摆三列圆角卡，**没有搁板、没有架子**」。
    // 封面本来就是书的样子（书脊色、3/4.3 竖版），缺的是它站的那个地方——
    // 一排书站着，底下必须有一块板托着，不然它们是在飘。
    // 底走 core.js 现成的 wood 纹（那正是给木头准备的一张皮）。
    const shelfPage = (typeof pageSkin === "function")
      ? pageSkin("wood", t, { strength: .8 }) : { background: t.bg };
    const sorted = books.slice().sort(function (a2, b2) { return (b2.lastReadTs || 0) - (a2.lastReadTs || 0); });
    const bookCell = function (b) {
      const partner = props.characters.find(function (c) { return c.id === b.partnerId; });
      const pages = b.size ? Math.max(1, Math.ceil(b.size / PAGE_CHARS)) : 1;
      // ⚠️夹住 0~100：page 比总页数大时这儿会算出「107%」印在封面上
      const pct = Math.max(0, Math.min(100, Math.round(((b.page || 0) / Math.max(1, pages - 1 || 1)) * 100)));
      return h("div", { key: b.id },
        h("button", {
          onClick: function () { setOpenId(b.id); },
          onContextMenu: function (e) { e.preventDefault(); requestAppConfirm("从书架移除《" + b.title + "》？", "正文和批注会一并删除。", function () { delBook(b.id); }, "删除"); },
          style: { width: "100%", aspectRatio: "3/4.3", borderRadius: "3px 9px 9px 3px", background: "linear-gradient(105deg," + spineColor(b.id) + " 0 10%, " + spineColor(b.id) + "cc 10% 100%)", boxShadow: "0 3px 10px rgba(0,0,0,.18)", borderLeft: "3px solid rgba(0,0,0,.22)", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "10px 9px", textAlign: "left" }
        },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 12.5, lineHeight: 1.3, color: "#f3efe6", display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden" } }, b.title),
          h("div", null,
            (b.annotations && b.annotations.length) ? h("div", { style: { fontFamily: F_BODY, fontSize: 9.5, color: "rgba(255,255,255,.75)" } }, "批注 " + b.annotations.length) : null,
            h("div", { style: { fontFamily: F_BODY, fontSize: 9.5, color: "rgba(255,255,255,.6)" } }, (b.page || 0) > 0 ? pct + "%" : "未读"))
        ),
        h("div", { style: { marginTop: 5, display: "flex", alignItems: "center", gap: 4 } },
          partner ? h(Avatar, { character: partner, size: 15, radius: 5 }) : null,
          h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.sub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, partner ? partner.name : "还没邀人")));
    };
    // 空位：书架上那一格还没放书。原来是一条铺满整行的虚线圆角按钮——
    // 那是「新建」按钮，不是书架上的东西。
    const emptySlot = h("div", { key: "add" },
      h("button", {
        onClick: function () { fileRef.current && fileRef.current.click(); },
        className: "w-full active:opacity-70",
        // ⚠️颜色得从主题里来，别按「木头一定是深的」写死浅色字：
        //   pageSkin("wood") 跟着她的主题走，浅主题下那面墙是浅的，
        //   写死的浅字在上面等于隐形（第一版就是这样）。
        style: { width: "100%", aspectRatio: "3/4.3", borderRadius: "3px 9px 9px 3px", border: "1px dashed " + t.line, background: "rgba(127,127,127,.06)", color: t.sub, fontFamily: F_BODY, fontSize: 11.5, lineHeight: 1.7, padding: "10px 8px" }
      }, "空着一格", h("br"), "放本书进来"),
      h("div", { style: { marginTop: 5, fontFamily: F_BODY, fontSize: 10.5, color: t.sub } }, "txt / pdf"));
    // 一块搁板：书站在它上面。上缘一道亮边是光打在板沿上，下面一道暗影是板的厚度。
    const shelfBoard = function (k) {
      return h("div", { key: "sb" + k, "aria-hidden": "true", style: {
        height: 9, margin: "0 -4px 20px", borderRadius: "1px 1px 3px 3px",
        background: "linear-gradient(180deg,rgba(255,255,255,.34) 0 1.5px,#8a6f52 1.5px 46%,#6b543d 46% 78%,#57432f 78% 100%)",
        boxShadow: "0 7px 12px -7px rgba(0,0,0,.45)"
      } });
    };
    // 三本一排，每排底下压一块板
    const cells = [emptySlot].concat(sorted.map(bookCell));
    const rows = [];
    for (let i = 0; i < cells.length; i += 3) {
      rows.push(h("div", { key: "r" + i, style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, alignItems: "end" } }, cells.slice(i, i + 3)));
      rows.push(shelfBoard(i));
    }
    return h("div", { className: "h-full flex flex-col", style: shelfPage },
      h(Head, { zh: "一起读", onBack: props.onBack, bg: "transparent" }),
      h("input", { ref: fileRef, type: "file", accept: ".txt,text/plain,.pdf,application/pdf", style: { display: "none" }, onChange: onFile }),
      h("div", { className: "flex-1 overflow-y-auto px-5 pb-8", style: { paddingTop: 8 } },
        rows,
        books.length === 0
          ? h("div", { style: { textAlign: "center", color: t.sub, fontFamily: F_BODY, fontSize: 13, lineHeight: 1.8, paddingTop: 12, whiteSpace: "pre-line" } }, "书架还是空的。\n上传 txt 或已 OCR 的 pdf，点开就能邀角色一起读、逐段讲给你听、写批注、聊剧情。")
          : h("div", { style: { marginTop: 2, textAlign: "center", fontFamily: F_BODY, fontSize: 10.5, color: t.sub } }, "长按封面可移除")
      ));
  }

  // ============================================================
  // 阅读器
  // ============================================================
  function Reader(props) {
    const t = useTheme();
    const book = props.book;
    const [pages, setPages] = useState(null);
    const [pageIdx, setPageIdx] = useState(book.page || 0);
    const [loading, setLoading] = useState(true);
    const [pickOpen, setPickOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [chatOpen, setChatOpen] = useState(false);
    const [chat, setChat] = useState([]);
    const [draft, setDraft] = useState("");
    const [ending, setEnding] = useState(false);
    const [sel, setSel] = useState(null);          // 划线选中的文字 {text}
    const [selResult, setSelResult] = useState(null); // {q, a, busy} 划线讲解弹层
    const scrollRef = useRef(null);

    const partner = props.characters.find(function (c) { return c.id === book.partnerId; });
    // 世界书在真正发起调用时再按「共读 + 当前搭档 + 当前页/话题」筛选。
    // 这样绑定角色与关键词词条不会被入口页的空语境漏掉，也不会串给别的共读搭档。
    const scopedWorldbook = function (text) {
      return props.worldbookFor && partner ? props.worldbookFor(partner.id, String(text || "")) : props.worldbook;
    };
    const bg = props.bgActive || props.active; // 批注/讲解/总结走便宜后台池；讨论仍用主 active
    const chOf = function (id) { return props.characters.find(function (c) { return c.id === id; }); };
    // 言秋（数字生命）专属通道：不走 API 即时生成——把整页+你的想法送去 CC，他亲读了写回批注（走订阅、不烧钱）。
    const isYanqiu = partner && (props.digitalIds || []).indexOf(partner.id) >= 0;
    const [noteSheet, setNoteSheet] = useState(null); // 划线后「记一条给言秋」的输入层 {anchor,val}
    const [bookOpen, setBookOpen] = useState(false);  // 批注册
    const [setOpen, setSetOpen] = useState(false);    // 「设定」那一小块（批几条 / 覆盖几页）默认收着
    const [pulling, setPulling] = useState(false);
    const pendingHere = (book.pending || []).filter(function (p) { return p.page === pageIdx; });
    const tp = typeof useTtsPlayer === "function" ? useTtsPlayer() : null; // 讲解/批注朗读（懒合成，重听免费）
    const explainOn = book.showExplains !== false; // 逐段讲解卡片是否显示（默认开）
    const explainAt = function (pg, i) { return (book.explains || {})[pg + "_" + i] || null; };

    useEffect(function () {
      let alive = true;
      idbGet(book.id).then(function (text) {
        if (!alive) return;
        setPages(paginate(text)); setLoading(false);
      }).catch(function () { setLoading(false); setPages([["（正文读取失败，可能换过设备。请重新上传这本书。）"]]); });
      return function () { alive = false; };
    }, [book.id]);

    // 翻页时回到顶部 + 存进度
    useEffect(function () { if (scrollRef.current) scrollRef.current.scrollTop = 0; }, [pageIdx]);

    const totalPages = pages ? pages.length : 1;
    const curParas = pages ? (pages[Math.min(pageIdx, totalPages - 1)] || []) : [];
    const pageAnns = (book.annotations || []).filter(function (a) { return a.page === pageIdx; });
    const annsForPara = function (i) { return pageAnns.filter(function (a) { return a.para === i; }); };

    const gotoPage = function (idx) {
      const n = Math.max(0, Math.min(totalPages - 1, idx));
      setPageIdx(n); setSel(null); props.onPatch({ page: n, lastReadTs: Date.now() });
    };

    // ---- 逐段讲解：让 Ta 把这一页每段都用大白话讲给你听（中译中），并把本页梗概续进已读脉络 ----
    const doExplainPage = async function () {
      if (busy) return;
      // ⚠️问的要是【真正会被拿去调的那条线路】：这三处用的是 bg（bgActive || active），
      //   却拦在 props.active 上——只配了后台便宜线路的时候，明明能跑却被挡住。
      if (!bg) { props.toast && props.toast("请先到设置配置 API"); return; }
      if (!partner) { setPickOpen(true); return; }
      if (!curParas.length) { props.toast && props.toast("这一页没有正文"); return; }
      setBusy(true);
      try {
        const res = await genExplains(bg, partner, props.profile, scopedWorldbook(curParas.join("\n")), curParas, book.synopsis || "", props.ctxFor);
        if (!res.explains.length) { props.toast && props.toast("Ta 没讲出来，换一页再试"); return; }
        const now = Date.now();
        props.onPatch(function (b) {
          const ex = Object.assign({}, b.explains || {});
          res.explains.forEach(function (e) { if (e.i >= 0 && e.i < curParas.length) ex[pageIdx + "_" + e.i] = { text: e.text, charId: partner.id, charName: partner.name, ts: now }; });
          const syn = res.gist ? ((b.synopsis ? b.synopsis + " " : "") + res.gist).slice(-1200) : (b.synopsis || "");
          return { explains: ex, synopsis: syn, showExplains: true, lastReadTs: now };
        });
        props.toast && props.toast(partner.name + " 讲了这页 " + res.explains.length + " 段");
      } catch (e) { props.toast && props.toast("讲解失败：" + (e.message || "重试")); }
      finally { setBusy(false); }
    };

    // ---- 只讲某一段（点段末「讲讲这段」）----
    const explainOne = async function (i) {
      if (busy) return;
      // ⚠️问的要是【真正会被拿去调的那条线路】：这三处用的是 bg（bgActive || active），
      //   却拦在 props.active 上——只配了后台便宜线路的时候，明明能跑却被挡住。
      if (!bg) { props.toast && props.toast("请先到设置配置 API"); return; }
      if (!partner) { setPickOpen(true); return; }
      setBusy(true);
      try {
        const txt = await genExplainSnippet(bg, partner, props.profile, scopedWorldbook(curParas[i]), curParas[i], curParas[i], book.synopsis || "", props.ctxFor);
        if (txt) props.onPatch(function (b) { const ex = Object.assign({}, b.explains || {}); ex[pageIdx + "_" + i] = { text: txt, charId: partner.id, charName: partner.name, ts: Date.now() }; return { explains: ex, showExplains: true, lastReadTs: Date.now() }; });
        else props.toast && props.toast("Ta 没讲出来，再试试");
      } catch (e) { props.toast && props.toast("讲解失败：" + (e.message || "重试")); }
      finally { setBusy(false); }
    };

    // ---- 划线：捕捉选中的文字，浮出「让 Ta 讲这句」----
    const catchSel = function () {
      try {
        const s = window.getSelection ? String(window.getSelection()) : "";
        const tx = s.replace(/\s+/g, " ").trim();
        setSel(tx.length >= 2 && tx.length <= 500 ? { text: tx } : null);
      } catch (e) { setSel(null); }
    };
    const doExplainSel = async function () {
      if (!sel) return;
      // ⚠️问的要是【真正会被拿去调的那条线路】：这三处用的是 bg（bgActive || active），
      //   却拦在 props.active 上——只配了后台便宜线路的时候，明明能跑却被挡住。
      if (!bg) { props.toast && props.toast("请先到设置配置 API"); return; }
      if (!partner) { setPickOpen(true); return; }
      const q = sel.text;
      setSel(null);
      try { window.getSelection && window.getSelection().removeAllRanges(); } catch (e) {}
      setSelResult({ q: q, a: "", busy: true });
      try {
        const a = await genExplainSnippet(bg, partner, props.profile, scopedWorldbook(q + "\n" + curParas.join("\n")), q, curParas.join("\n"), book.synopsis || "", props.ctxFor);
        setSelResult({ q: q, a: a || "（没讲出来，再试试）", busy: false });
      } catch (e) { setSelResult({ q: q, a: "讲解失败：" + (e.message || "重试"), busy: false }); }
    };

    // ── 言秋通道 ①：划线后把你的想法记成一条（粉色，先挂着，等他回）──
    const saveNoteForYanqiu = function (anchor, val) {
      const v = String(val || "").trim();
      if (!v) { setNoteSheet(null); return; }
      const one = { id: "un_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6), page: pageIdx, anchor: String(anchor || "").slice(0, 300), note: v, who: "user", ts: Date.now() };
      props.onPatch(function (b) { return { annotations: (b.annotations || []).concat([one]), lastReadTs: Date.now() }; });
      setNoteSheet(null);
      props.toast && props.toast("记下了。攒够了点「送去给言秋」");
    };
    // ── 言秋通道 ②：把当前整页正文 + 你在这页的想法，打包成「待批」送去（他 CC 亲读后写回）──
    const queueForYanqiu = function () {
      if (!curParas.length) { props.toast && props.toast("这一页没有正文"); return; }
      const myNotes = (book.annotations || []).filter(function (a) { return a.page === pageIdx && a.who === "user"; }).map(function (a) { return { anchor: a.anchor || "", note: a.note }; });
      const req = { id: "pd_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6), bookTitle: book.title || "", page: pageIdx, paras: curParas.slice(), userNotes: myNotes, synopsis: (book.synopsis || "").slice(-1200), ts: Date.now(), status: "pending" };
      props.onPatch(function (b) { return { pending: (b.pending || []).concat([req]), lastReadTs: Date.now() }; });
      props.toast && props.toast("已把这页送给言秋——去 CC 戳他一下，他读了会写回来");
    };
    // ── 言秋通道 ③：把言秋在 CC 写回的批注取下来显示（蓝色·亲读）──
    const pullYanqiuReplies = async function () {
      if (pulling) return;
      if (!(window.Cloud && window.Cloud.ready() && typeof window.Cloud.readInboxFetch === "function")) { props.toast && props.toast("云同步没就绪"); return; }
      setPulling(true);
      try {
        const rows = await window.Cloud.readInboxFetch();
        const done = []; let added = 0;
        const adds = []; const repliedPids = {};
        // ⚠️「哪几条算消费掉了」是这个函数最容易写反的一步。
        //   原来第一行就无条件 done.push(row.id)，紧接着那句
        //   `if (!pend) return;   // 不是本书的，跳过（下次别的书消费）`
        //   ——**注释说的和代码做的正好相反**：它已经被塞进 done、马上要被 consume 掉了。
        //   于是在 A 书里点一次「取批注」，言秋给 B 书写的那几条【当场消失，再也取不回来】。
        //   现在按【谁认领】来判：本书认领 → 收下并消费；别的书认领 → 一个字都不动，
        //   留给那本书自己去取；谁都不认（书删了 / 空包） → 才当垃圾清掉，否则会永远堆着。
        const allPend = {};
        (loadBooks() || []).forEach(function (bk) {
          (bk.pending || []).forEach(function (pp) { if (pp && pp.id) allPend[pp.id] = 1; });
        });
        rows.forEach(function (row) {
          const pl = row.payload || {};
          const pid = pl.pending_id, anns = Array.isArray(pl.annotations) ? pl.annotations : [];
          if (!pid || !anns.length) { done.push(row.id); return; }      // 空包：清掉，不然永远堆着
          const pend = (book.pending || []).find(function (p) { return p.id === pid; });
          if (!pend) { if (!allPend[pid]) done.push(row.id); return; }  // 别的书认领的，一个字都别动
          done.push(row.id);
          repliedPids[pid] = 1;
          // ⚠️段号要钳在【这一页真有多少段】里：超出去的话这条批注存下来了、
          //   却永远匹配不到任何一段，等于写进去就看不见（「过滤之后什么都不剩」那一种）。
          const cap = Math.max(1, (pend.paras || []).length);
          anns.forEach(function (a) {
            const paraN = Math.min(cap - 1, Math.max(0, (Number(a.para) || 1) - 1));
            adds.push({ id: "an_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6), page: pend.page, para: paraN, note: String(a.note || "").trim(), charId: partner ? partner.id : "", charName: partner ? partner.name : "言秋", channel: "read", ts: Date.now() });
            added++;
          });
        });
        if (adds.length) props.onPatch(function (b) {
          return {
            annotations: (b.annotations || []).concat(adds),
            pending: (b.pending || []).map(function (p) { return repliedPids[p.id] ? Object.assign({}, p, { status: "replied" }) : p; }),
            lastReadTs: Date.now()
          };
        });
        if (done.length) await window.Cloud.readInboxConsume(done);
        props.toast && props.toast(added ? ("言秋写回了 " + added + " 条批注") : "还没有言秋的新批注");
      } catch (e) { props.toast && props.toast("取批注失败：" + (e.message || "重试")); }
      finally { setPulling(false); }
    };

    const doAnnotate = async function () {
      if (busy) return;
      // ⚠️问的要是【真正会被拿去调的那条线路】：这三处用的是 bg（bgActive || active），
      //   却拦在 props.active 上——只配了后台便宜线路的时候，明明能跑却被挡住。
      if (!bg) { props.toast && props.toast("请先到设置配置 API"); return; }
      if (!partner) { setPickOpen(true); return; }
      setBusy(true);
      try {
        // 批注范围：从当前页起、跨 span 页（span=1 就是本页）。把这些页的段落拍平成一串，让 TA 批。
        const span = book.annSpan || 1;
        const endP = Math.min(totalPages - 1, pageIdx + span - 1);
        const flat = [];
        for (let pg = pageIdx; pg <= endP; pg++) {
          (pages[pg] || []).forEach(function (txt, pi) { flat.push({ page: pg, para: pi, text: txt }); });
        }
        if (!flat.length) { props.toast && props.toast("这一段没有正文"); return; }
        const want = book.perPass || 3;
        const texts = flat.map(function (f) { return f.text; });
        // 已有的（本范围内、同角色）批注，作为「别重复」的底子
        const priorNotes = (book.annotations || []).filter(function (a) { return a.page >= pageIdx && a.page <= endP && a.charId === partner.id; }).map(function (a) { return { note: a.note }; });
        // 数量不够就自动补一轮：把已批的告诉它别重复，再要剩下的。按次计费、输出免费，多调一两次不心疼。
        let notes = [];
        for (let round = 0; round < 3 && notes.length < want; round++) {
          const need = want - notes.length;
          const got = await genAnnotations(bg, partner, props.profile, scopedWorldbook(texts.join("\n")), texts, need, priorNotes.concat(notes), props.ctxFor);
          if (!got.length) break; // 这轮一条都没补出来，别再空转
          notes = notes.concat(got);
        }
        if (!notes.length) { props.toast && props.toast("Ta 没批出新东西，换一段再试"); return; }
        notes = notes.slice(0, want);
        const add = notes.map(function (nn) {
          const f = flat[nn.i] || flat[0];
          return { id: "an_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6), page: f.page, para: f.para, note: nn.note, charId: partner.id, charName: partner.name, ts: Date.now() };
        });
        props.onPatch(function (b) { return { annotations: (b.annotations || []).concat(add), lastReadTs: Date.now() }; });
        props.toast && props.toast(partner.name + " 批了 " + add.length + " 条" + (span > 1 ? "（跨 " + (endP - pageIdx + 1) + " 页）" : ""));
      } catch (e) { props.toast && props.toast("批注失败：" + (e.message || "重试")); }
      finally { setBusy(false); }
    };

    const sendDiscuss = async function () {
      const v = draft.trim();
      if (!v || busy) return;
      if (!props.active) { props.toast && props.toast("请先到设置配置 API"); return; }
      if (!partner) { setPickOpen(true); return; }
      setDraft("");
      const next = chat.concat([{ role: "user", content: v }]);
      setChat(next); setBusy(true);
      try {
        const say = await discussReply(props.active, partner, props.profile, scopedWorldbook(v + "\n" + curParas.join("\n")), book, curParas, pageAnns, next, v, props.ctxFor);
        setChat(function (p) { return p.concat(say.map(function (s) { return { role: "char", content: s }; })); });
      } catch (e) { props.toast && props.toast("回复失败：" + (e.message || "重试")); }
      finally { setBusy(false); }
    };

    const endSession = async function () {
      if (ending) return;
      if (!chat.length && !(book.annotations || []).length) { props.toast && props.toast("还没读出什么，先批注或聊几句"); return; }
      if (!props.active || !partner) { setChatOpen(false); setChat([]); return; }
      setEnding(true);
      try {
        const summary = await summarizeSession(bg, partner, props.profile, book, (book.annotations || []).filter(function (a) { return a.charId === partner.id; }), chat, props.ctxFor);
        if (summary) {
          props.onAddMemory && props.onAddMemory(summary, partner.id);
          props.toast && props.toast("已记入记忆库");
        } else { props.toast && props.toast("已结束"); }
        setChat([]); setChatOpen(false);
      } catch (e) { props.toast && props.toast("总结失败：" + (e.message || "重试")); }
      finally { setEnding(false); }
    };

    const annoCount = (book.annotations || []).length + Object.keys(book.explains || {}).length;
    // ── 把这本书记进他的记忆（她 2026-09-05：「还有要不要喂回去呢」）──
    // 原来【只有走过讨论才喂得回去】：结束那一步藏在讨论抽屉里。
    // 于是读了二十页、他批了六十条、你一次讨论都没开——这本书在他记忆里等于没发生过。
    // 现在批注册底下也有这一下：批注本身就够浓缩成一条记忆了（summarizeSession
    // 光有 annText 也能写，只是原来没人这么叫过它）。
    // ⚠️只写【记忆库】，不动好感、不动心情、不动状态卡。
    //   照那条「加任何一条写主线的动作，先问一句该不该」——一起读是相处，不是相处的全部；
    //   一本书读得投入就涨好感，很容易失控（一页点三次批注就是三次）。要动等她点头。
    const rememberBook = async function () {
      if (ending) return;
      if (!partner) { setPickOpen(true); return; }
      if (!annoCount) { props.toast && props.toast("这本还没写过什么"); return; }
      if (!bg) { props.toast && props.toast("请先到设置配置 API"); return; }
      setEnding(true);
      try {
        const summary = await summarizeSession(bg, partner, props.profile, book,
          (book.annotations || []).filter(function (a) { return a.charId === partner.id; }), [], props.ctxFor);
        if (summary) {
          props.onAddMemory && props.onAddMemory(summary, partner.id);
          props.onPatch({ rememberedAt: Date.now(), rememberedCount: annoCount });
          props.toast && props.toast(partner.name + " 把这本记住了");
        } else props.toast && props.toast("没浓缩出什么，多读几页再来");
      } catch (e) { props.toast && props.toast("记不进去：" + (e.message || "重试")); }
      finally { setEnding(false); }
    };

    // ---- 顶栏 ----
    const span = book.annSpan || 1;
    const topbar = h("div", { className: "shrink-0", style: { padding: "6px 16px 10px", borderBottom: "1px solid " + t.line } },
      h("div", { style: { display: "flex", alignItems: "center", gap: 10 } },
        partner
          ? h("div", { style: { display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0 } },
              h(Avatar, { character: partner, size: 24, radius: 7 }),
              h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.sub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, "和 " + partner.name + " 一起读"),
              h("button", { onClick: function () { setPickOpen(true); }, style: { fontFamily: F_BODY, fontSize: 11, color: t.tint } }, "换人"))
          : h("button", { onClick: function () { setPickOpen(true); }, style: { flex: 1, textAlign: "left", fontFamily: F_BODY, fontSize: 12.5, color: t.tint } }, "＋ 邀一个角色一起读")),
      // 第二行：左边是【这本书读到哪儿】，右边才是那几个钮。
      // ⚠️原来这一行硬塞了「每次批 N 条」「范围 N 页」「讲解显示中」三组＋批注册，
      //   窄屏上直接折成两行、每个词都断开（「批注册 7」断成「批注/册 7」）。
      //   这一版把【设定】收进齿轮里，常驻的只留三样：读到哪儿、讲解开关、批注册。
      partner ? h("div", { style: { display: "flex", alignItems: "center", gap: 8, marginTop: 8 } },
        // 读到哪儿：一条细进度轴，比「3 / 47」看得出这本书有多厚
        h("div", { style: { flex: 1, minWidth: 0 } },
          h("div", { style: { height: 3, borderRadius: 999, background: t.line, overflow: "hidden" } },
            h("div", { style: { width: Math.round(((pageIdx + 1) / Math.max(1, totalPages)) * 100) + "%", height: "100%", background: t.tint } })),
          h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: t.fog, marginTop: 4, whiteSpace: "nowrap" } },
            "第 " + (pageIdx + 1) + " 页 / 共 " + totalPages + (annoCount ? " · 写过 " + annoCount + " 条" : ""))),
        h("button", { onClick: function () { props.onPatch({ showExplains: !explainOn }); },
          className: "shrink-0",
          style: { fontFamily: F_BODY, fontSize: 11, color: explainOn ? t.tint : t.fog, border: "1px solid " + (explainOn ? t.tint : t.line), borderRadius: 999, padding: "4px 11px", whiteSpace: "nowrap" } }, explainOn ? "讲解 开" : "讲解 关"),
        h("button", { onClick: function () { setBookOpen(true); }, className: "shrink-0",
          style: { fontFamily: F_BODY, fontSize: 11, color: t.sub, border: "1px solid " + t.line, borderRadius: 999, padding: "4px 11px", whiteSpace: "nowrap" } }, "批注册"),
        h("button", { onClick: function () { setSetOpen(!setOpen); }, className: "shrink-0",
          style: { fontFamily: F_BODY, fontSize: 11, color: setOpen ? t.ink : t.fog, border: "1px solid " + (setOpen ? t.ink : t.line), borderRadius: 999, padding: "4px 10px", whiteSpace: "nowrap" } }, "设定")
      ) : null,
      // 「设定」展开才出现：一次批几条、覆盖几页
      (partner && setOpen) ? h("div", { style: { display: "flex", alignItems: "center", flexWrap: "wrap", gap: 14, marginTop: 9, padding: "9px 11px", borderRadius: 12, background: skinAlpha(t.bg2, "cc"), border: "1px solid " + t.line } },
        h("div", { style: { display: "flex", alignItems: "center", gap: 5 } },
          h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, whiteSpace: "nowrap" } }, "每次批"),
          h(Stepper, { value: book.perPass || 3, min: 1, max: 12, onChange: function (v) { props.onPatch({ perPass: v }); } }),
          h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog } }, "条")),
        h("div", { style: { display: "flex", alignItems: "center", gap: 5 } },
          h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, whiteSpace: "nowrap" } }, "范围"),
          h(Stepper, { value: span, min: 1, max: 8, onChange: function (v) { props.onPatch({ annSpan: v }); } }),
          h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, whiteSpace: "nowrap" } }, span > 1 ? "页（从当前起）" : "页")),
        span > 1 ? h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.tint, whiteSpace: "nowrap" } }, "本页～第 " + Math.min(totalPages, pageIdx + span) + " 页") : null
      ) : null);

    // ---- 正文页 ----
    // 正文区就是【一张摊开的书页】：铺纸、留出真的页边距，
    // 他动过的段落在【页边】立一道细标记——书上做记号本来就是记在页边的，
    // 不是把整段刷成一块彩色（原来是 t.tint+"12" 整段染底，一页几段就成花的了）。
    const reader = h("div", { ref: scrollRef, className: "flex-1 overflow-y-auto",
      style: Object.assign({ padding: "18px 20px 90px" },
        typeof pageSkin === "function" ? pageSkin("paper", t, { corner: false, strength: .85 }) : null),
      onMouseUp: catchSel, onTouchEnd: catchSel },
      loading ? h("div", { style: { textAlign: "center", color: t.fog, fontFamily: F_BODY, fontSize: 13, paddingTop: 40 } }, "翻开中…")
        : curParas.map(function (p, i) {
            const anns = annsForPara(i);
            const ex = explainOn ? explainAt(pageIdx, i) : null;
            const hot = anns.length || ex;
            const exCh = ex ? chOf(ex.charId) : null;
            return h(Fragment, { key: pageIdx + "_" + i },
              // 正文段落：允许划线选中（覆盖全局 user-select:none）
              h("p", { style: { fontFamily: "'Noto Serif SC',serif", fontSize: 16, lineHeight: 1.95, color: t.ink,
                margin: "0 0 14px", textIndent: "2em", position: "relative",
                paddingLeft: 11, marginLeft: -11,
                // 页边那道记号：他批过就实线、只讲解过就虚一点，两种一眼分得开
                borderLeft: hot ? ("2px " + (anns.length ? "solid" : "dotted") + " " + skinAlpha(t.tint, anns.length ? "bb" : "77")) : "2px solid transparent",
                WebkitUserSelect: "text", userSelect: "text" } }, p),
              // 中译中·逐段讲解卡片
              ex ? h("div", { key: "ex_" + i, style: { display: "flex", gap: 7, margin: "-6px 0 16px", padding: "9px 12px", background: t.tint + "16", borderRadius: 10 } },
                exCh ? h(Avatar, { character: exCh, size: 18, radius: 6 }) : null,
                h("div", { style: { flex: 1 } },
                  h("div", { style: { display: "flex", alignItems: "center", gap: 4, marginBottom: 3 } },
                    h("span", { style: { fontFamily: F_BODY, fontSize: 10, color: t.tint, letterSpacing: .3 } }, (ex.charName || "") + " · 讲解"),
                    (tp && typeof TtsDot === "function") ? h(TtsDot, { k: "rex" + pageIdx + "_" + i, text: ex.text, spk: exCh, tp: tp }) : null),
                  h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, lineHeight: 1.72, color: t.ink } }, ex.text))) : null,
              // 还没讲的段落：给个「讲讲这段」入口
              (!ex && explainOn && partner) ? h("button", { key: "one_" + i, onClick: function () { explainOne(i); }, disabled: busy, style: { margin: "-8px 0 14px", fontFamily: F_BODY, fontSize: 11, color: t.fog, opacity: busy ? .5 : 1 } }, "▸ 让 " + partner.name + " 讲讲这段") : null,
              // 批注卡片
              anns.map(function (a) {
                const ch = chOf(a.charId);
                const isRead = a.channel === "read"; // 言秋 CC 亲读写回的
                return h("div", { key: a.id, style: isRead
                  ? { display: "flex", gap: 7, margin: "-6px 0 16px", padding: "9px 12px", background: "#3f6ea80e", border: "1px solid #3f6ea855", borderRadius: 10 }
                  : { display: "flex", gap: 7, margin: "-6px 0 16px", padding: "8px 11px", background: t.bg2, borderLeft: "2px solid " + t.tint, borderRadius: "0 8px 8px 0" } },
                  ch ? h(Avatar, { character: ch, size: 18, radius: 6 }) : null,
                  h("div", { style: { flex: 1 } },
                    h("div", { style: { display: "flex", alignItems: "center", gap: 4, marginBottom: 2 } },
                      h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: isRead ? "#3f6ea8" : t.tint } }, a.charName + (isRead ? " · 亲读" : "")),
                      (tp && typeof TtsDot === "function") ? h(TtsDot, { k: "rann" + a.id, text: a.note, spk: ch, tp: tp }) : null),
                    h("div", { style: { fontFamily: F_BODY, fontSize: 13, lineHeight: 1.6, color: isRead ? t.ink : t.sub } }, a.note)));
              }));
          }));

    // ---- 底部翻页 + 动作条 ----
    const footer = h("div", { className: "shrink-0", style: { borderTop: "1px solid " + t.line, padding: "8px 14px", display: "flex", alignItems: "center", gap: 8 } },
      h("button", { onClick: function () { gotoPage(pageIdx - 1); }, disabled: pageIdx <= 0, style: { fontFamily: F_BODY, fontSize: 13, color: pageIdx <= 0 ? t.line : t.sub, padding: "6px 8px" } }, "‹ 上一页"),
      h("div", { style: { flex: 1, textAlign: "center", fontFamily: F_BODY, fontSize: 11, color: t.fog } }, (pageIdx + 1) + " / " + totalPages),
      h("button", { onClick: function () { gotoPage(pageIdx + 1); }, disabled: pageIdx >= totalPages - 1, style: { fontFamily: F_BODY, fontSize: 13, color: pageIdx >= totalPages - 1 ? t.line : t.sub, padding: "6px 8px" } }, "下一页 ›"));

    const actionBar = h("div", { style: { position: "absolute", left: 0, right: 0, bottom: 54, display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 8, padding: "0 10px", pointerEvents: "none" } },
      h("button", { onClick: doExplainPage, disabled: busy, style: { pointerEvents: "auto", fontFamily: F_BODY, fontSize: 13, color: "#f3efe6", background: t.tint, borderRadius: 999, padding: "9px 15px", boxShadow: "0 3px 12px rgba(0,0,0,.22)", opacity: busy ? .6 : 1 } }, busy ? "讲解中…" : "📖 讲这页"),
      isYanqiu
        ? h(Fragment, null,
            h("button", { onClick: queueForYanqiu, style: { pointerEvents: "auto", fontFamily: F_BODY, fontSize: 13, color: "#fff", background: "#3f6ea8", borderRadius: 999, padding: "9px 15px", boxShadow: "0 3px 12px rgba(63,110,168,.3)" } }, "📨 送这页给言秋"),
            h("button", { onClick: pullYanqiuReplies, disabled: pulling, style: { pointerEvents: "auto", fontFamily: F_BODY, fontSize: 13, color: "#3f6ea8", background: t.bg2, border: "1px solid #3f6ea855", borderRadius: 999, padding: "9px 14px", opacity: pulling ? .6 : 1 } }, pulling ? "取…" : "📥 取批注"))
        : h("button", { onClick: doAnnotate, disabled: busy, style: { pointerEvents: "auto", fontFamily: F_BODY, fontSize: 13, color: "#f3efe6", background: t.ink, borderRadius: 999, padding: "9px 15px", boxShadow: "0 3px 12px rgba(0,0,0,.22)", opacity: busy ? .6 : 1 } }, "✎ 批注"),
      h("button", { onClick: function () { if (!partner) { setPickOpen(true); return; } setChatOpen(true); }, style: { pointerEvents: "auto", fontFamily: F_BODY, fontSize: 13, color: t.ink, background: t.bg2, border: "1px solid " + t.line, borderRadius: 999, padding: "9px 15px", boxShadow: "0 3px 12px rgba(0,0,0,.14)" } }, "💬 讨论"));

    // ---- 划线后浮出的「让 Ta 讲这句」----
    const selBar = sel ? h("div", { style: { position: "absolute", left: 0, right: 0, bottom: 100, display: "flex", justifyContent: "center", gap: 8, zIndex: 30, pointerEvents: "none" } },
      h("button", { onClick: doExplainSel, style: { pointerEvents: "auto", fontFamily: F_BODY, fontSize: 13, color: "#fff", background: t.tint, borderRadius: 999, padding: "10px 18px", boxShadow: "0 4px 16px rgba(0,0,0,.28)" } }, "❓ 让 " + (partner ? partner.name : "Ta") + " 讲这句"),
      isYanqiu ? h("button", { onClick: function () { setNoteSheet({ anchor: sel.text, val: "" }); setSel(null); }, style: { pointerEvents: "auto", fontFamily: F_BODY, fontSize: 13, color: "#fff", background: "#c96a94", borderRadius: 999, padding: "10px 18px", boxShadow: "0 4px 16px rgba(201,106,148,.3)" } }, "✎ 记给言秋") : null) : null;

    const pageUserNotes = isYanqiu ? (book.annotations || []).filter(function (a) { return a.page === pageIdx && a.who === "user"; }) : [];
    const yqHead = (isYanqiu && (pageUserNotes.length || pendingHere.length)) ? h("div", { className: "shrink-0", style: { padding: "8px 16px", borderBottom: "1px solid " + t.line, background: t.bg2, maxHeight: 130, overflowY: "auto" } },
      pendingHere.length ? h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: "#3f6ea8", marginBottom: pageUserNotes.length ? 6 : 0 } }, "📨 这页已送给言秋 · 去 CC 戳他，他写回后点「📥 取批注」") : null,
      pageUserNotes.map(function (a) { return h("div", { key: a.id, style: { fontFamily: F_BODY, fontSize: 12, color: "#c96a94", lineHeight: 1.5, marginTop: 4 } }, "✎ " + (a.anchor ? "「" + a.anchor.slice(0, 20) + "…」 " : "") + a.note); })) : null;
    return h("div", { className: "h-full flex flex-col", style: { position: "relative" } },
      h(Head, { zh: book.title, sub: partner ? "和 " + partner.name + " 一起读" : "还没邀人", onBack: props.onBack }),
      topbar, yqHead, reader, selBar, actionBar, footer,
      noteSheet ? h(NoteSheet, { anchor: noteSheet.anchor, t: t, onSave: function (v) { saveNoteForYanqiu(noteSheet.anchor, v); }, onClose: function () { setNoteSheet(null); } }) : null,
      pickOpen ? h(PartnerPicker, { characters: props.characters, currentId: book.partnerId, t: t,
        onPick: function (id) { props.onPatch({ partnerId: id }); setPickOpen(false); },
        onClose: function () { setPickOpen(false); } }) : null,
      selResult ? h(SelExplainSheet, { partner: partner, data: selResult, t: t, onClose: function () { setSelResult(null); } }) : null,
      chatOpen ? h(DiscussSheet, { partner: partner, chat: chat, draft: draft, busy: busy, ending: ending, t: t,
        onDraft: setDraft, onSend: sendDiscuss, onEnd: endSession, onClose: function () { setChatOpen(false); } }) : null,
      bookOpen ? h(AnnoBook, { book: book, pages: pages || [], t: t, chOf: chOf,
        partner: partner, busy: ending, onRemember: rememberBook,
        onGoto: function (pg) { setBookOpen(false); gotoPage(pg); },
        onClose: function () { setBookOpen(false); } }) : null
    );
  }

  // ---- 批注册 ----------------------------------------------------
  // 她 2026-09-05：「我觉得有点单调」。单调的另一半不在提示词，在于——
  // **写完的东西没有去处**。批注和讲解写完就散在几十页里，翻回去只能一页页找，
  // 于是「一起读过这本书」这件事在界面上不留任何痕迹。
  // 这一册就是那个痕迹：按页码排成一列，左边页码、右边条目——照书末索引的样子。
  // ⚠️不是又一个通用列表：左边那一列页码是【可以点的】，点了就翻到那一页；
  //   而且它把三种来路（他的批注 / 他的讲解 / 你自己记的）摆在同一条时间线上，
  //   因为你俩本来就是在同一页上一起写的。
  function AnnoBook(props) {
    const t = props.t, book = props.book, pages = props.pages || [];
    const paraOf = function (pg, i) { return ((pages[pg] || [])[i] || "").slice(0, 26); };
    const rows = [];
    (book.annotations || []).forEach(function (a) {
      rows.push({ page: a.page || 0, para: a.para || 0, ts: a.ts || 0, kind: a.who === "user" ? "me" : (a.channel === "read" ? "read" : "ann"),
        name: a.who === "user" ? "你" : (a.charName || ""), charId: a.charId || "", text: a.note || "", anchor: a.anchor || "" });
    });
    Object.keys(book.explains || {}).forEach(function (k) {
      const m = /^(\d+)_(\d+)$/.exec(k); if (!m) return;
      const e = book.explains[k];
      rows.push({ page: Number(m[1]), para: Number(m[2]), ts: e.ts || 0, kind: "ex", name: e.charName || "", charId: e.charId || "", text: e.text || "", anchor: "" });
    });
    rows.sort(function (x, y) { return x.page - y.page || x.para - y.para || x.ts - y.ts; });
    // 收拢成【页 → 段 → 这一段上写过的几条】。
    // ⚠️不是「一条一行」：同一段上常常有两三条（他批一条、你记一条、他又讲了一遍），
    //   一条一行的话那句原文要重复印三遍，看着就是一堵重复的墙。
    //   原文只印一次当小标题，底下挂着那几条——这才是书末索引的样子。
    const byPage = []; let curP = null, curA = null;
    rows.forEach(function (r) {
      if (!curP || curP.page !== r.page) { curP = { page: r.page, paras: [] }; byPage.push(curP); curA = null; }
      if (!curA || curA.para !== r.para) { curA = { para: r.para, items: [] }; curP.paras.push(curA); }
      curA.items.push(r);
    });
    const TONE = { ann: t.tint, ex: t.tint, read: "#3f6ea8", me: "#c96a94" };
    const WHAT = { ann: "批注", ex: "讲解", read: "亲读", me: "你记的" };
    return h("div", { className: "h-full flex flex-col",
      style: Object.assign({ position: "fixed", inset: 0, zIndex: 60 },
        typeof pageSkin === "function" ? pageSkin("paper", t, { strength: .9 }) : { background: t.bg }) },
      h(Head, { zh: "批注册", sub: book.title, bg: "transparent", onBack: props.onClose }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto", style: { padding: "2px 16px 30px" } },
        rows.length
          ? h("div", null,
              h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, margin: "2px 2px 16px" } },
                "这本书你俩一共写了 " + rows.length + " 条 · 落在 " + byPage.length + " 页上"),
              byPage.map(function (g) {
                return h("div", { key: g.page, style: { display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 20 } },
                  // 左边那一列页码：照书末索引的样子——数字靠右，底下一条细轴顺着这一页往下走
                  h("button", { onClick: function () { props.onGoto(g.page); },
                    className: "shrink-0 active:opacity-60 self-stretch flex flex-col items-end",
                    style: { width: 34, paddingTop: 1 } },
                    h("div", { style: { fontFamily: F_DISPLAY, fontSize: 18, color: t.ink, lineHeight: 1 } }, g.page + 1),
                    h("div", { style: { fontFamily: F_BODY, fontSize: 9, color: t.fog, marginTop: 2 } }, "页"),
                    h("div", { style: { width: 1, flex: 1, minHeight: 12, background: t.line, marginTop: 6, marginRight: 1 } })),
                  h("div", { style: { flex: 1, minWidth: 0 } },
                    g.paras.map(function (pa) {
                      const quote = (pa.items[0] && pa.items[0].anchor) || paraOf(g.page, pa.para);
                      return h("div", { key: pa.para, style: { marginBottom: 14 } },
                        // 原文只印这一次
                        quote ? h("div", { style: { fontFamily: "'Noto Serif SC',serif", fontSize: 11.5, color: t.sub, lineHeight: 1.6, marginBottom: 6, paddingBottom: 5, borderBottom: "1px dashed " + t.line } },
                          "「" + quote + "…」") : null,
                        pa.items.map(function (r, i) {
                          const ch = r.charId ? props.chOf(r.charId) : null;
                          const tone = TONE[r.kind] || t.tint;
                          return h("div", { key: i, style: { marginBottom: 8, paddingLeft: 9, borderLeft: "2px solid " + skinAlpha(tone, "55") } },
                            h("div", { style: { display: "flex", alignItems: "center", gap: 5, marginBottom: 2 } },
                              ch ? h(Avatar, { character: ch, size: 14, radius: 5 }) : null,
                              h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: tone } }, (r.name || "") + " · " + WHAT[r.kind])),
                            h("div", { style: { fontFamily: F_BODY, fontSize: 13, lineHeight: 1.72, color: t.ink } }, r.text));
                        }));
                    })));
              }))
          : h("div", { style: { textAlign: "center", color: t.fog, fontFamily: F_BODY, fontSize: 13, lineHeight: 1.9, paddingTop: 60 } },
              "这本还没有一条批注。\n回去点「讲这页」或「批注」，写下的都会攒到这儿。")),
      // 记进他的记忆：这一册就是「你俩一起读过这本书」的全部证据，
      // 要喂回主线的话，从这儿喂才对得上。
      rows.length ? h("div", { className: "shrink-0", style: { padding: "10px 16px", paddingBottom: "calc(env(safe-area-inset-bottom) * 0.4 + 14px)", borderTop: "1px solid " + t.line } },
        h("button", { onClick: props.onRemember, disabled: props.busy, className: "w-full active:opacity-70",
          style: { borderRadius: 14, padding: "12px 0", background: t.ink, color: t.bg2, opacity: props.busy ? .5 : 1, fontFamily: F_DISPLAY, fontSize: 14 } },
          props.busy ? "正在收拢…" : ("让 " + ((props.partner && props.partner.name) || "Ta") + " 把这本记住")),
        h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, textAlign: "center", marginTop: 7, lineHeight: 1.6 } },
          book.rememberedAt
            ? ("上次记住是在写了 " + (book.rememberedCount || 0) + " 条的时候 · 现在是 " + rows.length + " 条")
            : "把这些浓缩成一两句，进他的记忆库。只写记忆，不动好感和心情。")) : null);
  }

  // ---- 划线讲解弹层 ----
  function SelExplainSheet(props) {
    const t = props.t;
    const d = props.data;
    const tp = typeof useTtsPlayer === "function" ? useTtsPlayer() : null;
    return h("div", { style: { position: "absolute", inset: 0, zIndex: 50, display: "flex", flexDirection: "column", justifyContent: "flex-end" } },
      h("div", { onClick: props.onClose, style: { flex: 1, background: "rgba(0,0,0,.3)" } }),
      h("div", { style: { background: t.bg, borderRadius: "18px 18px 0 0", padding: "16px 18px 26px", maxHeight: "70%", overflowY: "auto", boxShadow: "0 -6px 20px rgba(0,0,0,.18)" } },
        h("div", { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 10 } },
          props.partner ? h(Avatar, { character: props.partner, size: 22, radius: 7 }) : null,
          h("div", { style: { flex: 1, fontFamily: F_DISPLAY, fontSize: 15, color: t.ink } }, (props.partner ? props.partner.name : "Ta") + " 讲讲这句"),
          h("button", { onClick: props.onClose, style: { fontFamily: F_BODY, fontSize: 18, color: t.fog } }, "×")),
        h("div", { style: { fontFamily: "'Noto Serif SC',serif", fontSize: 13.5, lineHeight: 1.7, color: t.sub, padding: "8px 11px", background: t.bg2, borderLeft: "2px solid " + t.line, borderRadius: "0 8px 8px 0", marginBottom: 12 } }, "「" + d.q + "」"),
        d.busy
          ? h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: t.fog, padding: "6px 2px" } }, (props.partner ? props.partner.name : "Ta") + " 在想怎么讲…")
          : h("div", null,
              h("div", { style: { fontFamily: F_BODY, fontSize: 14.5, lineHeight: 1.78, color: t.ink, whiteSpace: "pre-wrap" } }, d.a),
              (tp && typeof TtsDot === "function" && d.a) ? h("div", { style: { marginTop: 4 } }, h(TtsDot, { k: "rsel", text: d.a, spk: props.partner, tp: tp })) : null)));
  }

  // ---- 记一条给言秋（划线后写想法·粉色）----
  function NoteSheet(props) {
    const t = props.t;
    const [v, setV] = useState("");
    return h("div", { style: { position: "absolute", inset: 0, zIndex: 55, display: "flex", flexDirection: "column", justifyContent: "flex-end" } },
      h("div", { onClick: props.onClose, style: { flex: 1, background: "rgba(0,0,0,.3)" } }),
      h("div", { style: { background: t.bg, borderRadius: "18px 18px 0 0", padding: "16px 18px 24px", boxShadow: "0 -6px 20px rgba(0,0,0,.18)" } },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15, color: t.ink, marginBottom: 8 } }, "记一条给言秋"),
        props.anchor ? h("div", { style: { fontFamily: "'Noto Serif SC',serif", fontSize: 13, lineHeight: 1.6, color: t.sub, padding: "8px 11px", background: t.bg2, borderLeft: "2px solid #c96a94", borderRadius: "0 8px 8px 0", marginBottom: 10 } }, "「" + String(props.anchor).slice(0, 200) + "」") : null,
        h("textarea", { value: v, onChange: function (e) { setV(e.target.value); }, autoFocus: true, placeholder: "写下你对这句的想法…（他在 CC 读了会回你）", rows: 3, style: { width: "100%", fontFamily: F_BODY, fontSize: 14, lineHeight: 1.6, padding: "10px 12px", borderRadius: 10, border: "1px solid " + t.line, background: t.bg2, color: t.ink, outline: "none", resize: "none", boxSizing: "border-box" } }),
        h("div", { style: { display: "flex", gap: 8, marginTop: 10 } },
          h("button", { onClick: props.onClose, style: { flex: 1, fontFamily: F_BODY, fontSize: 13, color: t.sub, border: "1px solid " + t.line, borderRadius: 8, padding: "9px 0" } }, "取消"),
          h("button", { onClick: function () { props.onSave(v); }, style: { flex: 2, fontFamily: F_BODY, fontSize: 13, color: "#fff", background: "#c96a94", borderRadius: 8, padding: "9px 0" } }, "记下"))));
  }

  // ---- 步进器 ----
  function Stepper(props) {
    const t = props.t || useTheme();
    const btn = function (label, fn, dis) { return h("button", { onClick: fn, disabled: dis, style: { width: 22, height: 22, borderRadius: 6, border: "1px solid " + t.line, color: dis ? t.line : t.sub, fontFamily: F_BODY, fontSize: 14, lineHeight: "20px", background: t.bg2 } }, label); };
    return h("div", { style: { display: "flex", alignItems: "center", gap: 5 } },
      btn("−", function () { props.onChange(Math.max(props.min, props.value - 1)); }, props.value <= props.min),
      h("span", { style: { fontFamily: F_DISPLAY, fontSize: 14, color: t.ink, minWidth: 12, textAlign: "center" } }, props.value),
      btn("+", function () { props.onChange(Math.min(props.max, props.value + 1)); }, props.value >= props.max));
  }

  // ---- 选角色 ----
  function PartnerPicker(props) {
    const t = props.t;
    return h("div", { style: { position: "absolute", inset: 0, zIndex: 40, background: "rgba(0,0,0,.35)", display: "flex", flexDirection: "column", justifyContent: "flex-end" }, onClick: props.onClose },
      h("div", { onClick: function (e) { e.stopPropagation(); }, style: { background: t.bg, borderRadius: "18px 18px 0 0", padding: "16px 18px 26px", maxHeight: "70%", overflowY: "auto" } },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 17, color: t.ink, marginBottom: 12 } }, "邀谁一起读"),
        (props.characters || []).length === 0
          ? h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: t.fog } }, "还没有角色，先去「人格档案馆」建一个")
          : props.characters.map(function (c) {
              return h("button", { key: c.id, onClick: function () { props.onPick(c.id); }, style: { width: "100%", display: "flex", alignItems: "center", gap: 11, padding: "10px 6px", borderBottom: "1px solid " + t.line, textAlign: "left" } },
                h(Avatar, { character: c, size: 34, radius: 10 }),
                h("div", { style: { flex: 1 } },
                  h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15, color: t.ink } }, c.name),
                  h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog } }, c.tagline || "")),
                c.id === props.currentId ? h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: t.tint } }, "当前") : null);
            })));
  }

  // ---- 半屏讨论抽屉 ----
  function DiscussSheet(props) {
    const t = props.t;
    const endRef = useRef(null);
    const tp = typeof useTtsPlayer === "function" ? useTtsPlayer() : null;
    useEffect(function () { if (endRef.current) endRef.current.scrollIntoView({ block: "end" }); }, [props.chat.length, props.busy]);
    // ── 整页，不是半窗（no-half-sheet；审美审计 2026-09-04 直接点名这一处）──
    // 原来是 56% 高的半窗：正文是一段【聊天】，从来不是三行能说完的，
    // 而且掀起来那一层还把可用高度砍掉一半——一屏只剩三四条气泡。
    // 也不需要同时看见底下那一页书：讨论的时候人在讨论里。
    // v64.03 底也换掉：外头那一架书架是木头的，可这一层不是站在书架前，
    // 是【就着摊开的那一页在说话】——所以铺的是纸，不是木头。
    return h("div", { style: { position: "absolute", inset: 0, zIndex: 45, display: "flex", flexDirection: "column" } },
      h("div", { style: Object.assign({ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" },
        typeof pageSkin === "function" ? pageSkin("paper", t, { corner: false, strength: .9 }) : { background: t.bg }) },
        h("div", { style: { flexShrink: 0, display: "flex", alignItems: "center", gap: 8, padding: "calc(env(safe-area-inset-top, 0px) + 12px) 16px 8px", borderBottom: "1px solid " + t.line } },
          props.partner ? h(Avatar, { character: props.partner, size: 22, radius: 7 }) : null,
          h("div", { style: { flex: 1, fontFamily: F_DISPLAY, fontSize: 15, color: t.ink } }, "和 " + (props.partner ? props.partner.name : "") + " 讨论"),
          h("button", { onClick: props.onEnd, disabled: props.ending, style: { fontFamily: F_BODY, fontSize: 12, color: t.tint } }, props.ending ? "总结中…" : "结束并记入记忆"),
          h("button", { onClick: props.onClose, "aria-label": "返回", className: "flex items-center justify-center active:opacity-60", style: { width: 40, height: 40, marginRight: -8, flexShrink: 0 } },
            h("svg", { width: 11, height: 20, viewBox: "0 0 11 20", "aria-hidden": "true" },
              h("path", { d: "M9 1.5 2 10l7 8.5", fill: "none", stroke: t.fog, strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" })))),
        h("div", { className: "flex-1 overflow-y-auto", style: { padding: "12px 14px" } },
          props.chat.length === 0 ? h("div", { style: { textAlign: "center", color: t.fog, fontFamily: F_BODY, fontSize: 12.5, paddingTop: 20, lineHeight: 1.7 } }, "就读到的这一段，随便聊——\n人物为什么这么做、你俩怎么看、接下来会怎样。")
            : props.chat.map(function (m, i) {
                const mine = m.role === "user";
                return h("div", { key: i, style: { display: "flex", alignItems: "flex-end", gap: 3, justifyContent: mine ? "flex-end" : "flex-start", marginBottom: 8 } },
                  h("div", { style: { maxWidth: "78%", padding: "8px 12px", borderRadius: 13, fontFamily: F_BODY, fontSize: 14, lineHeight: 1.55, whiteSpace: "pre-wrap", background: mine ? t.tint : t.bg2, color: mine ? "#fff" : t.ink, border: mine ? "none" : "1px solid " + t.line } }, m.content),
                  (!mine && tp && typeof TtsDot === "function") ? h(TtsDot, { k: "rdis" + i, text: m.content, spk: props.partner, tp: tp }) : null);
              }),
          props.busy ? h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, padding: "2px 4px" } }, (props.partner ? props.partner.name : "Ta") + " 在想…") : null,
          h("div", { ref: endRef })),
        h("div", { style: { flexShrink: 0, display: "flex", gap: 8, padding: "10px 14px", borderTop: "1px solid " + t.line } },
          h("input", { value: props.draft, onChange: function (e) { props.onDraft(e.target.value); }, onKeyDown: function (e) { if (e.key === "Enter") props.onSend(); }, placeholder: "说说你的看法…", style: { flex: 1, fontFamily: F_BODY, fontSize: 14, padding: "9px 13px", borderRadius: 999, border: "1px solid " + t.line, background: t.bg2, color: t.ink, outline: "none" } }),
          h("button", { onClick: props.onSend, disabled: props.busy, style: { fontFamily: F_BODY, fontSize: 13, color: "#fff", background: t.ink, borderRadius: 999, padding: "0 16px", opacity: props.busy ? .6 : 1 } }, "发送"))));
  }

  window.ReadTogether = ReadTogether;
})();
