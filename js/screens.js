// ============================================================
// CAST + form
// ============================================================
// 角色卡一键导入（v48.30 搬家器；v58.46 大修）：整篇卡粘进来 → 自动拆 名字/一句话/人设/长期记忆/记忆库种子。
// 她 2026-08-30：「导入角色卡那个格式还是有点不对劲，经常导入了格式还是不对」。原来那版只认两种东西：
// 「# 名字 · 角色卡」这一种标题，和「##」这一级分节。别的一律走「整篇当人设」的兜底——
// 于是别处导出的 JSON 卡 会被原样当人设塞进去（连大括号一起），{{char}}/{{user}} 占位符原样留着，
// 例句脚手架（<START>、mes_example）也一起进去跟 app 自己的手机机制打架。

function cardFillNames(text, charName, userName) {
  return String(text || "")
    .replace(/\{\{\s*char\s*\}\}/gi, charName || "TA")
    .replace(/<\s*BOT\s*>/gi, charName || "TA")
    .replace(/\{\{\s*user\s*\}\}/gi, userName || "你")
    .replace(/<\s*USER\s*>/gi, userName || "你")
    .replace(/\{\{\s*original\s*\}\}/gi, "")
    .replace(/\{\{\s*random\s*:\s*([^,}]*)[^}]*\}\}/gi, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
// 常见格式角色卡里的例句脚手架：<START> 之后那一段是「示范怎么对话」，不是这个人是谁。
// 塞进人设会让角色照着例句的格式说话，跟 app 自己的气泡/手机机制打架。
function cardStripScaffold(text) {
  let out = String(text || "");
  const at = out.search(/<\s*START\s*>/i);
  if (at >= 0) out = out.slice(0, at);
  return out.replace(/\n{3,}/g, "\n\n").trim();
}
// 一张卡里可能夹着的「跟 app 打架」的东西，导入前挑明，不偷偷吞掉
function cardWarnings(text, hadExample) {
  const w = [];
  const t = String(text || "");
  if (/\{\{\s*(char|user)\s*\}\}|<\s*(BOT|USER)\s*>/i.test(t)) w.push("卡里有 {{char}}/{{user}} 占位符，已经替换成角色名和你的名字");
  if (hadExample || /<\s*START\s*>/i.test(t)) w.push("卡里有对话示例（<START> / mes_example），没有导入——它会让 TA 照着例句的格式说话");
  if (/(手机|微信|状态栏|输出格式|回复格式|输出要求|status\s*bar)/i.test(t)) w.push("卡里像是带了「手机 / 输出格式」那种脚手架，导入后翻一眼人设，跟 app 自带的机制打架就删掉");
  return w;
}
// 常见格式的 JSON 角色卡（v1 扁平 / v2 带 data / 直接一个对象）：认出来就按字段拆，不要整坨当人设
function cardFromJSON(text) {
  const raw = String(text || "").trim();
  if (!(raw.startsWith("{") && raw.endsWith("}"))) return null;
  let o;
  try { o = JSON.parse(raw); } catch (e) { return null; }
  if (!o || typeof o !== "object") return null;
  const d = (o.data && typeof o.data === "object") ? o.data : o;
  if (!d.name && !d.description && !d.personality && !d.first_mes) return null;
  const parts = [];
  if (d.description) parts.push(String(d.description).trim());
  if (d.personality) parts.push("【性格】\n" + String(d.personality).trim());
  if (d.scenario) parts.push("【当下处境】\n" + String(d.scenario).trim());
  // 卡里自带的世界书（character_book）原来塞进记忆种子：记忆是按相关度挑几条的，大半条目这一轮根本到不了他面前，
  //   关键词、常驻全丢了，看着就是「人设不读世界书」（群友 2026-10-08）。现在原样落成世界书词条，绑这个角色：
  //   常驻的照常驻，带关键词的照关键词翻，停用的照停用。
  const book = (d.character_book && Array.isArray(d.character_book.entries)) ? d.character_book.entries : [];
  const seeds = [];
  const lore = book.map((e, i) => {
    const body = String((e && (e.content || e.text)) || "").trim();
    const keys = [].concat((e && (e.keys || e.key)) || []).map(k => String(k || "").trim()).filter(Boolean);
    return {
      title: String((e && (e.comment || e.name)) || "").trim().slice(0, 40) || ("卡内设定 " + (i + 1)),
      payload: body, keyword: keys.join(","), alwaysOn: !!(e && e.constant) || !keys.length,
      enabled: !(e && e.enabled === false), priority: 3
    };
  }).filter(x => x.payload.length > 4);
  return {
    name: String(d.name || "").trim(),
    tagline: String(d.creator_notes || "").split("\n")[0].trim().slice(0, 40),
    persona: parts.join("\n\n"),
    longMem: "",
    seeds: seeds,
    lore: lore,
    greeting: String(d.first_mes || "").trim(),
    hadExample: !!String(d.mes_example || "").trim(),
    from: "json"
  };
}
// 认得出的分节标题：# / ## / **加粗** / 【】 / [] 四种写法，外加「人设：」这种带冒号的。
// 后三种允许值写在【同一行】上（「【一句话】永安王」），那一段算这一节的正文头。
// ⚠️每一支只留一段「吃到行尾」，首尾的空格和冒号拿到外面去剥（群里 2026-10-19「角色卡复制粘贴就卡死」）：
//   原来写成 (.+?)[ \t]*[:：]?[ \t]*$，标题后面跟一长串空格时回溯是平方级以上，3000 个空格就卡一分多钟。
const CARD_SEC_RE = /^[ \t]*(?:#{1,6}[ \t]*([^\n]+)|\*\*([^\n]+?)\*\*([^\n]*)|[【\[〔]([^\n]+?)[】\]〕]([^\n]*)|[=＝─—━~*]{2,}[ \t]*([^\n=＝─—━~*]{1,30}?)[ \t]*[=＝─—━~*]{2,}|[■◆▼★※◎●□▲][ \t]*([^\n]{1,30})|([一-龥A-Za-z][一-龥A-Za-z0-9_ ]{0,13})[ \t]*[:：]([^\n]*))$/gm;
// 带冒号那一种太宽（正文里随便一行「TA说：」也像），所以只认这些词
const CARD_SEC_KWS = ["人设", "设定", "简介", "描述", "长期记忆", "初始记忆", "记忆库种子", "记忆种子", "种子", "记忆库", "开场白", "问候语", "第一句", "一句话", "标签", "外貌", "persona", "description", "memory", "greeting"];
// 把一篇文档按分节标题切开：角色卡导入和跑团剧本导入共用这一把刀（one-public-mechanism）。
// colonKws：带冒号那一支只认这些词，别把正文里的「TA说：」当成分节
function splitDocSections(text, colonKws) {
  const secs = [];
  let last = null, mm, firstAt = -1;
  const push = (sec, until) => secs.push({ title: sec.title, body: (sec.pre ? sec.pre + "\n" : "") + text.slice(sec.end, until).trim() });
  CARD_SEC_RE.lastIndex = 0;
  while ((mm = CARD_SEC_RE.exec(text))) {
    const title = (mm[1] || mm[2] || mm[4] || mm[6] || mm[7] || mm[8] || "").trim().replace(/[:：]$/, "").trim();
    const pre = (mm[3] || mm[5] || mm[9] || "").trim().replace(/^[:：]/, "").trim();
    if (mm[8] && !(colonKws || []).some(k => title.toLowerCase().includes(k))) continue;
    if (!title) continue;
    if (last) push(last, mm.index); else firstAt = mm.index;
    last = { title: title, pre: pre, end: mm.index + mm[0].length };
  }
  if (last) push(last, text.length);
  secs.lead = firstAt > 0 ? text.slice(0, firstAt).trim() : "";
  return secs;
}
function parseCharCard(raw, userName) {
  const text0 = String(raw || "").replace(/\r/g, "");
  const asJson = cardFromJSON(text0);
  const out = asJson || { name: "", tagline: "", persona: "", longMem: "", seeds: [], greeting: "", hadExample: false, from: "text" };
  if (!asJson) {
    // 整段用 <persona>…</persona> <world_info>…</world_info> 这种标签分块的卡也认：
    //   单独一行的开标签当成一节的标题，闭标签丢掉。大写的 <START> 不碰（那是对话示例的界碑）。
    const text = text0.replace(/^[ \t]*<\/[a-z][a-z0-9_-]*>[ \t]*$/gm, "")
      .replace(/^[ \t]*<([a-z][a-z0-9_-]*)>[ \t]*$/gm, (_, tag) => "## " + tag);
    // 「# X · 角色卡」「名字：X」「【姓名】X」「**姓名**：X」「名字「X」」，最后才退到第一个 # 标题
    // 「# X · 角色卡」：只在一行里找，名字里不带空格以外的分隔——原来 \s* 能跨行、又跟名字那段的空格重叠，长串空格回溯卡死
    let m = text.match(/^#[ \t]*([^\n·#|｜ \t][^\n·#|｜]{0,40}?)[ \t]*(?:[·|｜][ \t]*)?角色卡/m)
      || text.match(/^[ \t]*(?:[-*•+][ \t]*)?(?:#{1,6}[ \t]*)?(?:(?:\*\*|[【\[〔])[ \t]*)?(?:名字|姓名|角色名|人物名|name)[ \t]*(?:(?:\*\*|[】\]〕])[ \t]*)?(?:[:：][ \t]*)?[「"'\[]?([^\n」"'\]]{1,20})/im)
      || text.match(/名字[「"']([^」"']+)[」"']/)
      || text.match(/^#[ \t]*([^\n#]{1,20})[ \t]*$/m);
    if (m) out.name = m[1].trim().replace(/[*_`]/g, "");
    const secs = splitDocSections(text, CARD_SEC_KWS);
    const find = kws => secs.find(s => kws.some(k => s.title.toLowerCase().includes(k)));
    // 先挑种子再挑长期记忆：「记忆库种子」里也含着「记忆」两个字
    const sSec = find(["记忆库种子", "记忆种子", "记忆库", "种子", "memory_seed"]);
    const mSec = secs.find(s => !(sSec && s === sSec) && ["长期记忆", "初始记忆", "long_term_memory", "memory"].some(k => s.title.toLowerCase().includes(k)));
    // 一份文件里人设和世界书写在一起（群友 2026-11-01，小窝传上来的就是这种）：
    //   「世界书」这一节往下的分节，全归世界书，拿标题当关键词；不许一股脑并进人设。
    const lIdx = secs.findIndex(x => /世界书|世界观|世界设定|背景设定|补充设定|设定集|关系网|词条|lore_?book|world_?(info|book|setting)|social_circle/i.test(x.title));
    const loreSecs = lIdx < 0 ? [] : secs.slice(lIdx).filter(x => x === secs[lIdx] || !["长期记忆", "初始记忆", "开场白", "问候语", "第一句", "记忆库种子", "记忆种子"].some(k => x.title.includes(k)));
    const isLore = x => loreSecs.indexOf(x) >= 0;
    const pSec = secs.find(x => !isLore(x) && ["人设", "设定", "描述", "简介", "persona", "description", "character", "profile"].some(k => x.title.toLowerCase().includes(k)));
    const gSec = find(["开场白", "问候语", "第一句", "greeting", "first_mes", "first_message"]);
    const tSec = find(["一句话", "标签", "tagline"]);
    if (loreSecs.length) {
      // 关键词从标题里剥出来：「### 1. 老爸：陆大军」要的是「陆大军」，不是整行
      const kwOf = ttl => String(ttl).replace(/^[\d一二三四五六七八九十]+[、.．)）]\s*/, "").replace(/[（(].*$/, "").split("·")[0].split(/[:：]/).pop().trim().slice(0, 24);
      // 「世界书-社交关系网」这一节自己的正文往往只是把标题又写了一遍 + 一行 <xml 标签>，
      //   那种不成一条词条，去掉；真有正文的才留。
      const bodyOf = x => x.body.split("\n").filter(ln => {
        const l = ln.trim();
        return l && !/^<[^>]*>$/.test(l) && l !== x.title.trim();
      }).join("\n").trim();
      // 「准则/规矩」那一本管的是怎么说话，提不提到都得在场 → 常驻；
      //   「关系网/设定」那一本是提到谁才翻的 → 拿标题当关键词。
      const isHead = x => /世界书|世界观设定|设定集|词条|lorebook|world\s*info/i.test(x.title);
      const always = x => /准则|规则|守则|规范|铁律|须知/.test(x.title);
      let head = loreSecs[0];
      out.lore = (out.lore || []).concat(loreSecs.map(x => {
        if (isHead(x)) head = x;
        const payload = bodyOf(x), on = always(head);
        return payload ? { title: x.title.slice(0, 40), keyword: on ? "" : kwOf(x.title), payload: payload, category: "世界观", enabled: true, alwaysOn: on } : null;
      }).filter(Boolean));
    }
    // 人设只取「人设」那一节，卡里的【生日】【外貌】【喜好】这些就全丢了（群友 2026-11-01：
    //   一万多字的 word 传上来只剩 600 字）。没被别的栏收走的分节，一律跟着人设一起留下。
    const named = s => /名字|姓名|角色名|人物名|角色卡/.test(s.title) || /^name$/i.test(s.title);
    const keep = secs.filter(s => s !== sSec && s !== mSec && s !== gSec && s !== tSec && !named(s) && !isLore(s) && s.body.trim());
    if (pSec && keep.length <= 1) out.persona = pSec.body.trim();
    else if (keep.length) out.persona = [secs.lead || ""].concat(keep.map(s => "【" + s.title + "】\n" + s.body.trim())).filter(x => x.trim()).join("\n\n");
    // 整篇都是世界书（单独一份世界书文件）：人设留整篇兜底，但挂个记号，
    //   合并几份文件时这一份就整份当世界书，不会被当成人设正文并进去。
    else if (out.lore && out.lore.length) out.allLore = true;
    if (mSec) out.longMem = mSec.body.trim();
    if (gSec) out.greeting = gSec.body.trim();
    if (tSec) out.tagline = tSec.body.trim().split("\n")[0].slice(0, 40);
    if (sSec) {
      out.seeds = sSec.body.split(/\n(?=\d+[\.、．)]\s*)/).map(x => x.replace(/^\d+[\.、．)]\s*/, "").replace(/\s+/g, " ").trim()).filter(x => x.length > 4).map(x => {
        const pinned = /[〔\[【]\s*置顶\s*[〕\]】]/.test(x);
        return { text: x.replace(/[〔\[【]\s*置顶\s*[〕\]】]/g, "").trim(), pinned };
      });
    }
    if (!out.persona) out.persona = text0.trim(); // 没认出结构：整篇当人设，名字留给她改
  }
  out.warnings = cardWarnings(text0, out.hadExample);
  // 占位符替换和例句脚手架，两条路（JSON 和纯文本）都要走一遍
  const nm = out.name || "TA";
  out.persona = cardFillNames(cardStripScaffold(out.persona), nm, userName);
  out.longMem = cardFillNames(out.longMem, nm, userName);
  out.greeting = cardFillNames(cardStripScaffold(out.greeting), nm, userName);
  out.tagline = cardFillNames(out.tagline, nm, userName);
  out.seeds = (out.seeds || []).map(x => ({ text: cardFillNames(x.text, nm, userName), pinned: x.pinned })).filter(x => x.text);
  out.lore = (out.lore || []).map(x => Object.assign({}, x, { payload: cardFillNames(x.payload, nm, userName) }));
  return out;
}
// 整页，不是半窗（no-half-sheet.md）：这一页要装一大块粘贴框 + 解析预览 + 一串提醒，
// 半窗先扣掉一半屏幕，预览会被挤到看不见。
function CardImportSheet({ onImport, onClose, userName }) {
  const t = useTheme();
  const [txt, setTxt] = useState("");
  // 预览每一栏都能改（她 2026-10-05：「格式有时候是错的需要手动调整」）。
  // edits 里有哪一栏就以她改的为准，没有就跟着解析走；原文一改，全部回到跟解析走。
  const [edits, setEdits] = useState({});
  const [fileBusy, setFileBusy] = useState(false);
  const [fileErr, setFileErr] = useState("");
  const [extraLore, setExtraLore] = useState([]);   // 选中的文件里点成世界书的那几份
  const [picked, setPicked] = useState([]);        // 这次选的几份文件，各自是人设还是世界书
  const fileRef = useRef(null);
  const p = txt.trim() ? parseCharCard(txt, userName) : null;
  const seedsToText = arr => (arr || []).map(x => (x.pinned ? "〔置顶〕" : "") + x.text).join("\n");
  const textToSeeds = s => String(s || "").split("\n").map(x => x.trim()).filter(Boolean).map(x => {
    const pinned = /^[〔\[【]\s*置顶\s*[〕\]】]/.test(x);
    return { text: x.replace(/^[〔\[【]\s*置顶\s*[〕\]】]\s*/, "").trim(), pinned };
  }).filter(x => x.text);
  const val = k => edits[k] != null ? edits[k] : (p ? (k === "seeds" ? seedsToText(p.seeds) : (p[k] || "")) : "");
  const setVal = (k, v) => setEdits(e => Object.assign({}, e, { [k]: v }));
  const persona = val("persona");
  // 一份人设拆成好几个文件是常事（群友 2026-11-01：人设一份、自带世界书一份）。
  //   一次选上，每一份自己点是人设还是世界书：人设那几份按选中顺序接起来，
  //   世界书那几份收成只绑这个角色的词条（json 按词条拆，txt/docx 整份当一条）。
  // Word/txt 的世界书照它自己的分节拆成一条条（【地名】## 组织 **势力** 这几种都认），
  //   拆不出两节以上就整份当一条常驻。拆出来的按标题当关键词，提到才进。
  const loreFromPicked = f => {
    if (f.lore && f.lore.length) return f.lore;
    const secs = splitDocSections(f.text, []).filter(x => x.title && x.body.trim());
    if (secs.length < 2) return [{ title: f.title, payload: f.text, category: "世界观", alwaysOn: true, enabled: true }];
    return secs.map(x => ({ title: x.title.slice(0, 40), keyword: x.title.slice(0, 40), payload: x.body.trim(), category: "世界观", alwaysOn: false, enabled: true }));
  };
  const applyPicked = list => {
    const texts = [], lore = [];
    const many = list.filter(f => f.as === "persona").length > 1;
    list.forEach(f => {
      if (f.as === "lore") lore.push.apply(lore, loreFromPicked(f));
      else texts.push(many ? "【" + f.title + "】\n" + f.text : f.text);
    });
    setPicked(list); setTxt(texts.join("\n\n")); setEdits({}); setExtraLore(lore);
    setFileErr(texts.length ? "" : "这几份都点成世界书了，人设那一份点回「人设」");
  };
  const importFile = async e => {
    const input = e.target, files = Array.from(input.files || []).slice(0, 10);
    input.value = "";
    if (!files.length) return;
    setFileBusy(true); setFileErr("");
    try {
      const list = [];
      for (const file of files) {
        if (/\.doc$/i.test(file.name || "")) throw new Error("老的 .doc 读不了，在 Word 里另存为 .docx 再导");
        if (!/\.(docx|txt|md|markdown|json)$/i.test(file.name || "")) throw new Error("请选择 .docx / .txt / .md / .json 文件");
        const text = String(await readOfflineStyleDocument(file) || "").trim();
        if (!text) continue;
        let d = null; try { d = JSON.parse(text); } catch (_) {}
        const entries = d && !(d.name || d.data || d.persona || d.description) && typeof loreEntriesFromJson === "function" ? loreEntriesFromJson(d) : null;
        const hit = entries && entries.length ? entries : null;
        list.push({ title: String(file.name || "").replace(/\.[a-z0-9]+$/i, "").slice(0, 40), text: text, lore: hit, as: hit ? "lore" : "persona" });
      }
      if (!list.length) throw new Error("文件里没有可导入的文字");
      applyPicked(list);
    } catch (err) {
      setFileErr(String(err && err.message || "文件读取失败，请重新选择").replace(/文风/g, "角色卡"));
    } finally { setFileBusy(false); }
  };
  const label = zh => h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.fog, margin: "10px 0 4px" } }, zh);
  const box = (k, rows, ph) => h("textarea", {
    value: val(k), onChange: e => setVal(k, e.target.value), rows, placeholder: ph,
    style: { width: "100%", background: t.bg, border: "1px solid " + t.line, borderRadius: 10, padding: "8px 10px", fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.ink, resize: "vertical", lineHeight: 1.6 }
  });
  const count = k => { const v = val(k).trim(); return v ? "（" + v.length + " 字）" : "（无）"; };
  return h("div", { "data-wk": "cardimportpage", "data-part": "cardimportsheet", className: "absolute inset-0 z-50 h-full flex flex-col", style: DESK(t.accent || t.tint) },
    h(Head, { zh: "导入角色卡", bg: "transparent", onBack: onClose }),
    h("div", { className: "flex-1 min-h-0 overflow-y-auto px-5 pb-10" },
      h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.fog, margin: "14px 0 10px", lineHeight: 1.65 } },
        "整篇粘进来，或者直接选文件（.docx / .txt / .md / .json，一次可以选好几份，选完每一份自己点是「人设」还是「世界书」：人设那几份按顺序接起来，世界书那几份只绑给 TA）。认得出常见 JSON 角色卡（v1/v2，卡里的世界书收成只给 TA 的世界书词条），也认「# / ## / **加粗** / 【】」这几种分节。{{char}}/{{user}} 会自动换掉，<START> 之后的对话示例不导入。拆得不对就在下面的预览里直接改。"),
      h("button", {
        onClick: () => fileRef.current && fileRef.current.click(), disabled: fileBusy,
        className: "w-full active:opacity-70",
        style: { marginBottom: 10, background: "transparent", color: t.ink, border: "1px solid " + t.line, borderRadius: 12, padding: "10px 0", fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))" }
      }, fileBusy ? "正在读文件…" : "从文件导入"),
      h("input", { ref: fileRef, type: "file", accept: ANY_FILE, multiple: true, style: { display: "none" }, onChange: importFile }),
      picked.length ? h("div", { "data-wk": "block", style: { marginBottom: 10, padding: "9px 11px", borderRadius: 12, background: t.bg2, border: "1px solid " + t.line } },
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.fog, marginBottom: 6 } }, "这几份各是什么？点一下能改" + (extraLore.length ? "；世界书导入时只绑给 TA" : "")),
        picked.map((f, i) => h("div", { key: i, className: "flex items-center gap-2", style: { marginBottom: 5 } },
          h("span", { className: "flex-1 min-w-0 truncate", style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.ink } },
            f.title + (f.as === "lore" ? "（" + loreFromPicked(f).length + " 条）" : "")),
          ["persona", "lore"].map(k => h("button", {
            key: k, onClick: () => applyPicked(picked.map((x, n) => n === i ? Object.assign({}, x, { as: k }) : x)),
            className: "active:opacity-70",
            style: { padding: "3px 10px", borderRadius: 999, fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", border: "1px solid " + (f.as === k ? t.ink : t.line), background: f.as === k ? t.ink : "transparent", color: f.as === k ? t.bg2 : t.fog }
          }, k === "persona" ? "人设" : "世界书"))))) : null,
      fileErr ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.accent || t.ink, marginBottom: 8 } }, fileErr) : null,
      h("textarea", { "data-wk": "textarea", value: txt, onChange: e => { setTxt(e.target.value); setEdits({}); setExtraLore([]); setPicked([]); }, rows: 10, placeholder: "在这里粘贴整篇角色卡…", style: { width: "100%", background: t.bg2, border: "1px solid " + t.line, borderRadius: 12, padding: "11px 13px", fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.ink, resize: "none", lineHeight: 1.6 } }),
      p ? h("div", { "data-wk": "block", style: { marginTop: 12, padding: "12px 14px", borderRadius: 14, background: t.bg2, border: "1px solid " + t.line } },
        h(Eyebrow, { style: { marginBottom: 7 } }, p.from === "json" ? "解析预览 · 认出是 JSON 角色卡 · 可直接改" : "解析预览 · 可直接改"),
        h("div", { className: "flex items-center gap-2", style: { marginBottom: 5 } },
          h("span", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.fog, width: 74, flexShrink: 0 } }, "名字"),
          h("input", {
            value: val("name"), onChange: e => setVal("name", e.target.value), placeholder: "没认出来，自己写一个",
            className: "flex-1 min-w-0 bg-transparent outline-none",
            style: { fontFamily: F_DISPLAY, fontSize: "calc(17px * var(--app-fs, 1))", color: t.ink, borderBottom: "1px solid " + t.line, padding: "2px 0" }
          })),
        h("div", { className: "flex items-center gap-2", style: { marginBottom: 5 } },
          h("span", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.fog, width: 74, flexShrink: 0 } }, "一句话"),
          h("input", {
            value: val("tagline"), onChange: e => setVal("tagline", e.target.value.slice(0, 40)), placeholder: "（可空）",
            className: "flex-1 min-w-0 bg-transparent outline-none",
            style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.ink, borderBottom: "1px solid " + t.line, padding: "2px 0" }
          })),
        label("人设" + count("persona")), box("persona", 8, "人设是必填的"),
        (p.allLore ? [] : (p.lore || [])).concat(extraLore).length ? (lore => h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.fog, marginTop: 8, lineHeight: 1.7 } },
          "自带世界书 " + lore.length + " 条（" + lore.reduce((n, e) => n + String(e.payload || "").length, 0) + " 字），导入时只绑给 TA：" + lore.map(e => e.title).filter(Boolean).slice(0, 8).join("、") + (lore.length > 8 ? "…" : "")))((p.allLore ? [] : (p.lore || [])).concat(extraLore)) : null,
        label("长期记忆" + count("longMem")), box("longMem", 3, "（可空）"),
        label("记忆种子 · 一行一条，行首写〔置顶〕就置顶（" + textToSeeds(val("seeds")).length + " 条）"), box("seeds", 4, "（可空）"),
        label("开场白 · 导入后当 TA 的第一句话" + count("greeting")), box("greeting", 3, "（可空）"),
        (p.warnings || []).length ? h("div", { style: { marginTop: 10, paddingTop: 9, borderTop: "1px solid " + t.line } },
          p.warnings.map((w, n) => h("div", { key: n, style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.fog, lineHeight: 1.7 } }, "· " + w))) : null) : null,
      h("button", {
        onClick: () => {
          if (!p || !persona.trim()) return;
          onImport(Object.assign({}, p, {
            name: val("name").trim(), tagline: val("tagline").trim(), persona: persona.trim(),
            longMem: val("longMem").trim(), greeting: val("greeting").trim(), seeds: textToSeeds(val("seeds")),
            lore: (p.allLore ? [] : (p.lore || [])).concat(extraLore)
          }));
        },
        className: "w-full mt-4 active:opacity-70",
        style: { background: p && persona.trim() ? t.ink : t.line, color: t.bg2, borderRadius: 14, padding: "13px 0", fontFamily: F_BODY, fontSize: "calc(15px * var(--app-fs, 1))" }
      }, "导入并建档")));
}
// 一整页就是一份摊开的卷宗。她 2026-08-30：「编辑档案里面这几块框还是很 plain 缺少设计感，
// 背景也是纯色」——所以这一页的底、每一块分区，都按【纸】来做，不是白板摞白板。

// 这一页的桌面：中性纸底 + 两团带着TA自己颜色的光 + 两道细纸纹。
// 打底那层必须接近中性（跟主屏同一条道理），颜色只从那两团光里来。
function dossierDeskBg(accent) {
  const a = accent || "#8a8577";
  return [
    "repeating-linear-gradient(58deg, rgba(255,255,255,.16) 0px, rgba(255,255,255,.16) 1px, transparent 1px, transparent 14px)",
    "repeating-linear-gradient(-34deg, rgba(46,38,29,.012) 0px, rgba(46,38,29,.012) 1px, transparent 1px, transparent 18px)",
    "radial-gradient(84% 44% at 2% -4%, " + hexA(a, .30) + ", transparent 64%)",
    "radial-gradient(76% 42% at 102% 84%, " + hexA(a, .24) + ", transparent 68%)",
    "linear-gradient(168deg, #f2efeb 0%, #e9e6e2 52%, #dedbd6 100%)"
  ].join(", ");
}
// #rrggbb → rgba(...)，给上面那两团光调透明度用
function hexA(hex, a) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ""));
  if (!m) return "rgba(138,133,119," + a + ")";
  const n = parseInt(m[1], 16);
  return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a + ")";
}
// ── 档案馆那一族共用的那张桌子（v62.83，审美审计还债④）────────────────
// 审计的「乙组」：卡片/部件都已经从这一页是什么东西里长出来了（卷宗书脊、印章、
// 亲属卡、关系板），**唯独外壳还是 t.bg 平色**——元素合格、外壳裸着。
// 而这张桌子本来就有：编辑档案那一页（dossierDeskBg）早就铺着它。
// 「同一个 app 两张桌子」——列表页米白、编辑页桌面——是审计原话点名的一处。
// 所以这一批不新发明材质，只把现成那一张铺到同族的其余几页上，Head/顶栏一律透上来。
const DESK = accent => ({ background: dossierDeskBg(accent) });

// ============================================================
// LIFESTYLE + LORE
// ============================================================
// ============================================================
// 行程 Lifestyle —— 仿日记大图 + swipe 换角色 + 周 timeline + 每日时间线（偏差红框/碎碎念回看）
// ============================================================
function schedDayKey(d) { return window.ScheduleClock.deviceDayKey(d); }
// 日程的「哪一天、几点」都问 ScheduleClock 那一处（planDay/planMinute），这里只是转一手
function schedFollowOn(id) { return !!(window.ScheduleClock && window.ScheduleClock.planFollows({ id })); }
// 他那边「此刻」的钟面（Date，按设备时区读 getHours）：跟钟走时是虚拟时刻，不跟时是现实
function schedNowDate(char) { return char && schedFollowOn(char.id) && typeof vclockMap === "function" ? new Date(vclockMap(Date.now(), char.id)) : new Date(); }
function schedLocalDayKey(char, at) { return window.ScheduleClock.planDay(char, at || Date.now(), -new Date().getTimezoneOffset()); }
function schedShiftDayKey(key, days) { return window.ScheduleClock.shiftDayKey(key, days); }
// 他「这一刻」该照哪一天的日程（她 2026-10-21：「排好了的，换个面具那一天就没了，特别是只差了几个小时」）：
//   先找他那只钟上的这一天；没排过就找前后一天里排好的那份接着用——换了一只差几个小时的钟，日子跨了一格，
//   不该就当他今天什么都没安排。再没有才退回现实那天（v49.71 前的旧日键）。只要读「此刻在干嘛」都走这一处。
function schedPlanOf(char, plans, at) {
  if (!char || !plans) return null;
  const t = at || Date.now(), k = schedLocalDayKey(char, t);
  return plans[k] || plans[schedShiftDayKey(k, -1)] || plans[schedShiftDayKey(k, 1)] || (schedFollowOn(char.id) ? null : plans[schedDayKey(new Date(t))]) || null;
}
function schedParseKey(k) { return window.ScheduleClock.parseDayKey(k); }
const SCHED_DOW_ZH = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
// id（可选）：给了谁，就按 TA 那只虚拟时间的钟叫这一天（她 2026-10-11：「日程按现实框架排，但也用角色的时间系统」）。
//   日程还是一个现实日一份；只是说给模型、摆给她看的那个日子换了叫法。date 仍是现实那天，排序、比较照旧用它。
function schedDateParts(k, id) {
  const d = schedParseKey(k);
  const vc = id != null && typeof vclockCfg === "function" ? vclockCfg(id) : null;
  // 跟钟排的：这个键本身就是虚拟那天，不用再换算，只换年号的叫法
  if (vc && vc.schedFollow) return { date: d, md: vclockYear(d.getFullYear(), vc) + (d.getMonth() + 1) + "月" + d.getDate() + "日", dowZh: SCHED_DOW_ZH[d.getDay()], dateNum: String(d.getDate()).padStart(2, "0") };
  if (vc) {
    const v = new Date(vclockMap(d.getTime() + 12 * 3600e3, id));
    return { date: d, md: vclockYear(v.getFullYear(), vc) + (v.getMonth() + 1) + "月" + v.getDate() + "日", dowZh: SCHED_DOW_ZH[v.getDay()], dateNum: String(v.getDate()).padStart(2, "0") };
  }
  const dow = d.getDay();
  return { date: d, md: (d.getMonth() + 1) + "月" + d.getDate() + "日", dowZh: SCHED_DOW_ZH[dow], dateNum: String(d.getDate()).padStart(2, "0") };
}
// 结束时刻（v56.30）。seqs 原来只有开始时刻，苹果日历式的块要 start+end 才画得出高度。
// AI 现在会一起生成 end；旧数据和漏填的按「顶到下一段开始、最多 3 小时」补，最后一段给 60 分钟
//（不封顶的话，一个下午只排了一件事就会画成四五个小时的大块——那中间其实是没排事）。
// 跨午夜（23:40 → 次日 00:30）按同一天的 24:00 收口，不往回画成负高度。
// 聊天/线下里当场改了的安排，写回今天的日程（她 2026-09-30：「生成的日程和实际线下不一样，日程不覆盖吗」）。
//   只动【此刻到 until】这一截：此刻之前的原样留着，被盖住那段切掉中间、两头留下；
//   新插的那段带 deviation，日程页和下一轮提示词都认得出它是临时改的。
//   change = {title, location, until:"HH:MM", reason}；nowMin 是 TA 当地此刻的分钟数。
// 字数放开（她 2026-10-08「改日程会截断，直接把日程和改日程的字数放开」）：原来 title 40 / reason 60 字一刀切，
//   改日程的原因稍长一点就被砍成半句；现在只留一个防止整段正文被塞进来的大上限。
function schedSpliceNow(seqs, nowMin, change) {
  const min = t => { const m = /(\d{1,2}):(\d{2})/.exec(String(t || "")); return m ? (+m[1]) * 60 + (+m[2]) : null; };
  const hm = n => String(Math.floor(n / 60)).padStart(2, "0") + ":" + String(n % 60).padStart(2, "0");
  const title = String((change && change.title) || "").trim().slice(0, 300);
  if (!title || !Number.isFinite(nowMin)) return null;
  const full = schedFillEnds(Array.isArray(seqs) ? seqs : []);
  const n = Math.max(0, Math.min(1439, Math.floor(nowMin)));
  let u = min(change.until);
  if (u == null || u <= n) { const cur = full.find(s => min(s.time) != null && min(s.time) <= n && (min(s.end) == null || min(s.end) > n)); u = cur && min(cur.end) > n ? min(cur.end) : n + 60; }
  u = Math.min(1440, u);
  // 被盖住的原安排不删（她 2026-10-21：「原来有东西的改了之后怎么都没了」）：原样挂在改的那一块的 covered 上，日程页淡着画在底下；
  //   之后他又改了（中途走了、换去别处），改过的那一块后半截被切掉时，底下原来的安排照时间接回来。
  //   切的要是一块【本身就是改过的】，算原安排时认它底下那几段，不认它自己（不然原来的就一层层丢了）。
  const clip = (s, a, b) => { const st = Math.max(min(s.time), a), en = Math.min(min(s.end) ?? (min(s.time) + 60), b); if (!(en > st)) return null; const { covered: _c, ...rest } = s; return { ...rest, time: hm(st), end: hm(en) }; };
  const origOf = s => s.deviation && Array.isArray(s.covered) ? s.covered : [s];
  const out = [], hit = [], covered = [];
  for (const s of full) {
    const st = min(s.time), en = min(s.end);
    if (st == null || st >= u || (en != null && en <= n)) { out.push(s); continue; }
    origOf(s).forEach(o => { const c = o && clip(o, n, u); if (c) { covered.push(c); hit.push(o.title || ""); } });
    if (st < n) {
      const kept = Array.isArray(s.covered) ? s.covered.map(o => clip(o, st, n)).filter(Boolean) : null;
      out.push({ ...s, end: hm(n), ...(kept ? { covered: kept } : {}), ...(kept && s.deviation ? { deviation: { ...s.deviation, plan: kept.map(o => o.title).filter(Boolean).join("、") || "原本没排事" } } : {}) });
    }
    if (en != null && en > u) {
      if (s.deviation && Array.isArray(s.covered)) s.covered.forEach(o => { const c = clip(o, u, en); if (c) out.push(c); });
      else out.push({ ...s, time: hm(u) });
    }
  }
  out.push({ time: hm(n), end: hm(u), title: title, location: String(change.location || "").slice(0, 200), place: "", type: "other",
    ...(covered.length ? { covered: covered } : {}),
    deviation: { plan: hit.filter(Boolean).join("、") || "原本没排事", reason: String(change.reason || "跟你在一起，临时改了").slice(0, 600), actual: title } });
  out.sort((a, b) => (min(a.time) ?? 9999) - (min(b.time) ?? 9999));
  return out.map((s, i) => ({ ...s, seq: i + 1 }));
}
function schedFillEnds(seqs) {
  const arr = Array.isArray(seqs) ? seqs : [];
  const min = t => { const m = /(\d{1,2}):(\d{2})/.exec(String(t || "")); return m ? (+m[1]) * 60 + (+m[2]) : null; };
  return arr.map((s, i) => {
    if (s && s.end && min(s.end) != null) return s;
    const st = min(s && s.time);
    if (st == null) return s;
    let e = null;
    for (let j = i + 1; j < arr.length; j++) { const n = min(arr[j] && arr[j].time); if (n != null) { e = n; break; } }
    // 顶到下一段，但最多 3 小时：中间空着的是「没排事」，不是「这件事做了一下午」。
    // ⚠️就寝是唯一的例外：人本来就要睡七八个小时，封顶 3 小时会让全员只睡到凌晨四点
    //（她 2026-08-26 抓到）。睡觉一律顶到下一段；是当天最后一段就睡到 24:00 跨日。
    const isSleep = s && s.type === "sleep";
    if (isSleep) e = (e == null || e <= st) ? 1440 : e;
    else {
      e = (e == null || e <= st) ? st + 60 : Math.min(e, st + 180);
      e = Math.min(1440, e);
    }
    return Object.assign({}, s, { end: (e >= 1440 ? "24" : pad2(Math.floor(e / 60))) + ":" + pad2(e % 60), _endAuto: true });
  });
}
// 跨日的觉（v56.47）：日程是一天一份的，昨晚 23:40 睡下、end 记到 24:00，
// 到了第二天那份里就没人接着了——她 2026-08-26：「24点之后第二天凌晨也不会接上继续显示睡觉」。
// 这里按【昨天最后一段是不是睡觉、有没有睡到 24:00】现算出今天凌晨那一截，
// 睡到今天第一段开始为止（通常就是「起床」那一段）。算出来的是角色当地分钟数。
function schedSleepCarry(prevPlan, todayPlan) {
  const prev = prevPlan && Array.isArray(prevPlan.seqs) ? schedFillEnds(prevPlan.seqs) : [];
  const last = prev[prev.length - 1];
  if (!last || last.type !== "sleep") return null;
  const endMin = (() => { const m = /(\d{1,2}):(\d{2})/.exec(String(last.end || "")); return m ? (+m[1]) * 60 + (+m[2]) : null; })();
  if (endMin == null || endMin < 1440) return null;         // 没睡到跨日就没得接
  const today = todayPlan && Array.isArray(todayPlan.seqs) ? schedFillEnds(todayPlan.seqs) : [];
  let wake = null;
  for (const x of today) { const m = /(\d{1,2}):(\d{2})/.exec(String(x.time || "")); if (m) { wake = (+m[1]) * 60 + (+m[2]); break; } }
  if (wake == null) wake = 8 * 60;                           // 今天还没排：按睡到早上八点画
  if (wake <= 0) return null;
  return { from: 0, to: wake, seq: last.seq, world: last.world, title: last.title || "睡着", location: last.location || "", type: "sleep", carry: true };
}
// 角色本地时区 - 我本地 的分钟差（char.tz 如 "+8"/"-5"/"+5.5"/""跟随系统）。异地恋用。
function schedTzShiftMin(char) {
  const raw = char && char.tz != null ? String(char.tz) : "";
  if (raw === "") return 0;
  const co = parseFloat(raw);
  if (isNaN(co)) return 0;
  const myOff = -new Date().getTimezoneOffset() / 60;
  return Math.round((co - myOff) * 60);
}
function pad2(n) { return String(n).padStart(2, "0"); }
// 把角色本地日程转成「我这边的时间轴」：每段算出我这边对应时刻(_myMin/_myLabel)，保留角色当地时间(_charTime)；
// 有时差就按我这边时间重新排序（框架=我的时间，内容=角色的日程）。
function schedDisplaySeqs(char, seqs) {
  const shift = schedTzShiftMin(char);
  const arr = (seqs || []).map(s => {
    const m = /(\d{1,2}):(\d{2})/.exec(s.time || "");
    const cm = m ? (+m[1]) * 60 + (+m[2]) : null;
    const my = cm == null ? null : (((cm - shift) % 1440) + 1440) % 1440;
    return Object.assign({}, s, { _charTime: s.time || "", _myMin: my, _myLabel: my == null ? (s.time || "") : pad2(Math.floor(my / 60)) + ":" + pad2(my % 60), _shifted: shift !== 0 });
  });
  // 保留角色生活时间线原顺序；换算到我方后可能跨午夜，按钟面重排会把清晨/深夜颠倒。
  return arr;
}
function schedCurrentSeqIdx(seqs, isToday, char) {
  if (!isToday) return -1;
  if (window.ScheduleClock && char) return window.ScheduleClock.currentSeqIdx(seqs, window.ScheduleClock.planMinute(char, Date.now(), -new Date().getTimezoneOffset()));
  const now = new Date(), cur = now.getHours() * 60 + now.getMinutes();
  let idx = -1, prev = -1;
  // 单调化时间：**只有真正跨过午夜**（深夜→凌晨、回退超过 12h）才 +24h，保证末尾的「00:20 睡觉」排在最后。
  // 关键修复：模型偶尔给的【小幅乱序】（如 14:00 后冒出 13:30）绝不当跨天——否则会把乱序之后的整串时段误推到「明天」，
  // 导致 tm 永远 > cur、该灰的灰不掉、聊天顶栏 live 还错显「还没开始今天的安排」。
  // 若 seq 带了 _myMin（已换算成我这边时间），就用它比对。
  (seqs || []).forEach((s, i) => {
    let tm;
    if (s._myMin != null) tm = s._myMin;
    else { const m = /(\d{1,2}):(\d{2})/.exec(s.time || ""); if (!m) return; tm = (+m[1]) * 60 + (+m[2]); }
    if (prev >= 0 && tm < prev && (prev - tm) > 720) tm += 1440; // 只在深夜→凌晨这种真跨天时进位
    if (tm > prev) prev = tm;                                    // 只在前进时更新 prev，别被小幅乱序带偏
    if (tm <= cur) idx = i;
  });
  return idx;
}
// ============================================================
// FORUM —— 仿贴吧/推特：底部四 tab（主页/搜索/私信/我）
//  主页 = 吐槽/日常/求助/匿名 + 关注 切换；顶部刷新键在当前版块生成 NPC 帖
//  搜索 = 随机刷到四版块之外的吧（据全局聊天）；私信 = NPC 私信；我 = 我的主页
//  帖子只有一份，版块是筛选视图；评论懒加载（含楼中楼，回复者随机 NPC/角色）
// ============================================================
// ── 世界线（她 2026-10-01，群友：「char1 在论坛大号发的帖子 char2 大号回复了，理论上两个人对着的我的时间点根本不在一起」）──
// 角色分到几个「世界」里：同一个世界的人才会碰面、认得彼此；默认大家都在同一个世界（不分＝现在的样子）。
// ⚠️界面放在论坛设置里，但这份分组单独存（x_charWorlds），不写死在论坛里——以后朋友圈之类要分世界，读同一份。
const CHAR_WORLDS_KEY = "x_charWorlds";
function charWorldsLoad() {
  try {
    const v = JSON.parse(localStorage.getItem(CHAR_WORLDS_KEY) || "null");
    return { worlds: Array.isArray(v && v.worlds) ? v.worlds.filter(w => w && w.id && w.name) : [], of: (v && v.of && typeof v.of === "object") ? v.of : {} };
  } catch (e) { return { worlds: [], of: {} }; }
}
// 这个角色在哪个世界：""＝默认那个「同一个世界」
function charWorldOf(id, d) { d = d || charWorldsLoad(); const w = d.of[id]; return w && d.worlds.some(x => x.id === w) ? w : ""; }
// ── 论坛按世界分（她 2026-10-01：「如果我想路人也生成具体世界观的帖子……吐槽吧我也想让古风角色或者 npc 来发帖」）──
// 每个世界有自己一整套论坛（吐槽吧、日常吧……都在），在论坛设置里切「现在逛哪个世界」。
// 帖子落盘时记下 world；老帖没记的：角色发的算TA那个世界，其余算默认世界（一个都不用迁移）。
const FORUM_WORLD_KEY = "x_forumWorld";
// "*"＝全部（大杂烩，默认）：所有世界的帖都看得到。她 2026-10-01：「平时就是在大杂烩……只有切到世界才会看到只有那个世界的」
//   ""＝「同一个世界」那一个；其余是她开的世界 id。没存过、或者存的世界被拆了，都回到「全部」。
function forumCurWorld(d) {
  d = d || charWorldsLoad();
  let w = null; try { w = localStorage.getItem(FORUM_WORLD_KEY); } catch (e) {}
  if (w === "") return "";
  return w && w !== "*" && d.worlds.some(x => x.id === w) ? w : "*";
}
// 这一次刷出来的帖记到哪个世界：切在某个世界就是它；在「全部」里就随手挑一个世界（一批帖同一个世界，
//   每个帖子里面照旧只有一个世界的人——混的是首页，不是帖子里面）
function forumGenWorld(d) {
  d = d || charWorldsLoad();
  const cur = forumCurWorld(d);
  if (cur !== "*") return cur;
  const all = [""].concat(d.worlds.map(x => x.id));
  return all[Math.floor(Math.random() * all.length)];
}
function forumPostWorld(p, d) {
  d = d || charWorldsLoad();
  // "*"＝她在「全部」里发的：哪个世界都看得到（她 2026-10-01：「我发的全部不能让全部世界的看到吗」）
  if (p && p.world === "*") return "*";
  if (p && typeof p.world === "string") return p.world && d.worlds.some(x => x.id === p.world) ? p.world : "";
  if (p && p.authorId && /^character/.test(String(p.authorType || ""))) return charWorldOf(p.authorId, d);
  return "";
}
function charWorldLore(w, d) { d = d || charWorldsLoad(); return w ? String(((d.worlds.find(x => x.id === w) || {}).lore) || "").trim() : ""; }
const FORUM_BOARDS = ["吐槽吧", "日常吧", "求助吧", "兴趣吧", "脑洞吧", "匿名吧"];
// 每个吧自己的规矩（她 2026-09-15 问「5 呢」）。一份写在这儿：置顶那块牌子（下面 Forum 里）
// 和喂给模型的吧规（app.js 的 forumBoardRuleLines）读的是同一份——两处各抄一份必然有一处过时。
// ⚠️每个吧的规矩要带着这个吧的脾气：吐槽吧的规矩本身就该有点火气，求助吧的该像个真管事的。
//   规矩要是六个吧一个腔调，等于没写。
const FORUM_BOARD_RULES = {
  "吐槽吧": ["骂事不骂人，点名到具体的人就删", "别在这儿求安慰，要安慰去日常吧", "阴阳怪气可以，伸手要钱不行"],
  "日常吧": ["随便发，但别把这儿当朋友圈刷屏", "劝人别劝得太用力，人家只是想说说", "晒东西可以，带链接的一律删"],
  "求助吧": ["标题写清楚你到底卡在哪，「求助急」这种标题会被改", "有人认真答了就回一句，别拿了就跑", "答不上来别硬答，猜的要标明是猜的"],
  "兴趣吧": ["安利可以，踩别人的爱好不行", "报装备报价格随意，但别装内行", "连载贴请自己顶，别开新帖"],
  "脑洞吧": ["提问要给得出接的口子，没人接的自己顶", "抬杠归抬杠，别说「这不可能」就完事", "现实问题别发这儿"],
  "匿名吧": ["这儿不问你是谁，也别去问别人是谁", "扒人一律删帖", "说出来就算了，别追着要下文"]
};
// ── 她自己开的吧（她 2026-09-23 转来读者许愿：「可以许愿自定义贴吧主题吗」）──────────
// 存 x_forumBoards：[{ name: "某某吧", about: "这个吧聊什么，一句" }]。
// ⚠️「一共有哪些吧」只许有这一份：版块那排 tab、发帖选吧、搜索页「别的吧」、角色自己发帖挑吧，
//   全读 forumBoardsAll()——原来那几处各自写 FORUM_BOARDS，加一个吧就得改四处，漏一处那个吧
//   就会「tab 上有、帖子却跑去搜索页」（施工规则/one-public-mechanism.md）。
// ⚠️搜索刷出来的那些吧不进这张表：那是逛到的，不是她开的；她想留下哪个，自己开一个同名的就行。
function forumCustomBoards() {
  const v = typeof loadJSON === "function" ? loadJSON("x_forumBoards", []) : [];
  return (Array.isArray(v) ? v : []).filter(b => b && typeof b.name === "string" && b.name.trim());
}
// 吧的顺序和藏起来的（群友 2026-10-27 许愿「吧排序」）：x_forumBoardOrder = { order: [吧名…], hidden: [吧名…] }。
//   order 只管先后，没排过的（新开的吧）接在后面；hidden 只让它不出现在顶上那排，帖子、发帖选吧、角色发帖都照常。
function forumBoardPrefs() {
  const v = typeof loadJSON === "function" ? loadJSON("x_forumBoardOrder", {}) : {};
  return { order: Array.isArray(v && v.order) ? v.order : [], hidden: Array.isArray(v && v.hidden) ? v.hidden : [] };
}
function forumBoardsAll() {
  const all = FORUM_BOARDS.concat(forumCustomBoards().map(b => b.name).filter(n => FORUM_BOARDS.indexOf(n) < 0));
  const ord = forumBoardPrefs().order.filter(n => all.indexOf(n) >= 0);
  return ord.concat(all.filter(n => ord.indexOf(n) < 0));
}
// 贴吧配图（她 2026-09-24：「贴吧能不能也支持上传图片或者写假图描述跟聊天一样。然后角色也可以（不要强制）」）。
//   帖子和楼层身上挂一个 photo：{ imageRef?, desc }——跟聊天那张照片同一个形状，所以界面直接用 PhotoCard / PhotoSheet。
//   模型那头只看得见字：凡是把帖子正文、楼层内容喂给模型的地方，都过 forumWithPhoto，别各拼各的。
function forumPhotoOf(x) {
  const p = x && x.photo;
  if (!p) return null;
  const desc = String((typeof p === "string" ? p : p.desc) || "").trim().slice(0, 300);
  const imageRef = typeof p === "object" && p.imageRef ? p.imageRef : "";
  // who：发帖的人自己说的「画面里有没有人」（none/part/self）。没有就是旧数据，照旧去猜。
  // ⚠️两种形状都要认（施工规则/stub-from-the-writer：照【写进来的那一头】看字段名）：
  //   · 模型刚吐出来的那一坨：{ photo: "描述", photoWho: "none" } —— photoWho 是【兄弟字段】；
  //   · 已经落盘的帖子/楼层：  { photo: { desc, imageRef, who } }。
  //   只认其中一种的话，这条链在落盘那一步就断了，而且不报任何错。
  const raw = (typeof p === "object" && p.who) || (x && x.photoWho) || "";
  const who = ["none", "part", "self"].includes(String(raw).toLowerCase()) ? String(raw).toLowerCase() : "";
  if (!desc && !imageRef) return null;
  const out = imageRef ? { imageRef: imageRef, desc: desc } : { desc: desc };
  if (who) out.who = who;
  return out;
}
// 小红书笔记的第二张起（她 2026-10-24「多图左右滑」）：只有字，挂在 morePhotos 上；第一张照旧是 photo（封面）
//   模型刚吐出来的是一串字，落盘后是 [{ desc }]，两种都认
function forumMorePhotos(x) {
  const a = x && x.morePhotos;
  // 她自己发的多图（群友 2026-10-27）带真图：{ imageRef, desc }，没写字也算一张
  return Array.isArray(a) ? a.map(v => {
    const desc = String((typeof v === "string" ? v : v && v.desc) || "").trim().slice(0, 300);
    const imageRef = v && typeof v === "object" && v.imageRef ? v.imageRef : "";
    return imageRef ? { imageRef, desc } : desc ? { desc } : null;
  }).filter(Boolean).slice(0, 8) : [];
}
function forumWithPhoto(text, x) {
  const p = forumPhotoOf(x);
  const s = String(text || "");
  if (!p) return s;
  const more = forumMorePhotos(x);
  const line = more.length
    ? [p].concat(more).map((q, i) => "〔第" + (i + 1) + "张图：" + (q.desc || "一张照片，没写说明") + "〕").join(" ")
    : "〔配图：" + (p.desc || "一张照片，没写说明") + "〕";
  return s ? s + " " + line : line;
}
// 已有楼层喂给模型时【整段原文】：每层楼全文＋它下面每条楼中楼（谁、回谁、说了什么），不截字、不截条。
// 她 2026-09-28：TA 用小号发帖说她「过了几个星期才问押金退没退」，另一个角色评论之后，TA 回复
//   「我确实问了押金退了多少，问题是我没问这个」——把谁问的弄反了，还去驳一句没人说过的话。
//   病根不在「编」：继续刷楼时每层楼只给前 60 个字、只给最后 14 层、楼中楼一条不给，
//   模型照着半句话接，只能猜。「只针对楼里已有的话回应」那条一直在，它只是看不全那句话。
// ⚠️凡是把已有楼层递给模型的地方都走这一处（施工规则/one-public-mechanism.md）。
// 每条前面挂一个〔今天14:32〕／〔10/16 21:05〕（她 2026-10-23「论坛是不是没有时间戳，我回复上个星期的帖子他还会当成最近」）
const forumStamp = ts => (Number(ts) > 0 && typeof fmtStampAI === "function") ? "〔" + fmtStampAI(Number(ts)) + "〕" : "";
// 这帖是什么时候的、现在几点：回旧帖、刷旧楼时照真实隔了多久说，别当成刚发生的
function forumTimeLine(post) {
  const ts = Number(post && post.ts) || 0;
  if (!ts || typeof fmtStampAI !== "function") return "";
  const days = Math.floor((Date.now() - ts) / 86400000);
  const ago = days >= 1 ? "，已经是 " + days + " 天前的帖了" : "";
  return "【时间】这帖发于〔" + fmtStampAI(ts) + "〕" + ago + "；现在是〔" + fmtStampAI(Date.now()) + "〕。楼里每条前面〔〕里是它发出来的时间——隔了多久就照多久来，旧帖里的事是那时候的事，别当成刚发生的。\n";
}
function forumFloorTranscript(floors) {
  return (floors || []).filter(Boolean).map(f => {
    const head = forumStamp(f.ts || f.visibleAt) + (f.floor != null ? f.floor + "楼 " : "") + (f.isOp ? "【楼主】" : "") + (f.authorName || "某人") + "：" + forumWithPhoto(f.content, f).replace(/\s+/g, " ");
    const subs = (f.replies || []).filter(r => r && r.content).map(r => "  └ " + forumStamp(r.ts) + (r.isOp ? "【楼主】" : "") + (r.authorName || "某人") + (r.toName ? " 回 " + r.toName : "") + "：" + forumWithPhoto(r.content, r).replace(/\s+/g, " "));
    return [head].concat(subs).join("\n");
  }).join("\n");
}
// 吧规只许从这一处读（她 2026-10-17 群里许愿「自己开的吧能加吧规吗」）：自带的吧读写死的那份，她开的吧读她写的 rules。
//   置顶那块牌子和喂给模型的那份都走这里。
function forumBoardRulesOf(name) {
  if (FORUM_BOARD_RULES[name]) return FORUM_BOARD_RULES[name];
  const b = forumCustomBoards().find(x => x.name === name);
  return b && Array.isArray(b.rules) ? b.rules.map(r => String(r || "").trim()).filter(Boolean).slice(0, 8) : [];
}
// 吧主能挑的熟面孔：常驻名单里不在匿名吧的那些
function forumOwnerRegulars() { return typeof FORUM_NPC_REGISTRY !== "undefined" ? FORUM_NPC_REGISTRY.filter(n => n && !(n.boards || []).includes("匿名吧")) : []; }
// 她开的吧的吧主 → 名字；角色被删了、熟面孔对不上就当没有
function forumBoardOwnerName(name, chars) {
  const b = forumCustomBoards().find(x => x.name === name), o = b && b.owner;
  if (!o || !o.id) return "";
  if (o.kind === "char") { const c = (chars || []).find(x => x && x.id === o.id); return c ? c.name : ""; }
  const n = forumOwnerRegulars().find(x => x.id === o.id); return n ? n.name : "";
}
// 这个吧写帖的分寸（群里 2026-11-08 许愿：开吧时定楼主正文多少字、每次刷新出几条）：
//   lenMin/lenMax 是楼主正文的字数区间，batch 是一次刷出几条新帖；没填的照默认（正文 2-4 句、一次 3-5 条）
function forumBoardGenOf(name) {
  const b = forumCustomBoards().find(x => x.name === name) || {};
  const num = v => { const n = parseInt(v, 10); return n > 0 ? n : 0; };
  let lo = num(b.lenMin), hi = num(b.lenMax);
  if (lo && hi && lo > hi) { const x = lo; lo = hi; hi = x; }
  return { lenMin: Math.min(lo, 3000), lenMax: Math.min(hi, 3000), batch: Math.min(num(b.batch), 10) };
}
function forumBoardAbout(name) { const b = forumCustomBoards().find(x => x.name === name); return b ? String(b.about || "").trim() : ""; }
// FORUM_AV_EMOJI 已删（v56.12）：论坛头像不再画 emoji，改走 autoAvatarSrc。
function forumHash(str) { let h = 2166136261; str = String(str || ""); for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
// 楼号 = 到场顺序，不是「生成时排第几」。（v56.19，她 2026-08-25 报：9 楼下面直接跳 16 楼）
// 病因：楼号在生成那一刻按数组下标发死（existing.length+2），可楼层是按 visibleAt
// 分批解锁的——10-15 楼还排在几小时后的队里占着号，随后一波「现在就发生」的
// 回帖拿到 16 号却立刻可见，于是 9 楼底下冒出个 16 楼，中间全是空号。
// 号改成按真实到场时间现算：还没到点的楼层排在所有已到场楼层之后，空号不存在。
// 已看过的楼永远不会被重编号（新来的 visibleAt 一定不早于所有已可见的楼）。
const forumFloorArrivedAt = f => Number((f && (f.visibleAt || f.ts)) || 0);
function forumFloorOrder(floors) {
  return (Array.isArray(floors) ? floors : [])
    .map((f, i) => ({ f, i }))
    .sort((a, b) => (forumFloorArrivedAt(a.f) - forumFloorArrivedAt(b.f)) || (a.i - b.i))
    .map((x, n) => (x.f && x.f.floor === n + 2) ? x.f : { ...x.f, floor: n + 2 });
}
// 生成期间保留已交付的楼：同 ID 以当前版本为准（尤其是中途新增的楼中楼）。
function forumRetainFloors(current, retained) {
  const list = Array.isArray(current) ? current : [];
  const ids = new Set(list.map(f => f.id));
  return forumFloorOrder([...(retained || []).filter(f => !ids.has(f.id)), ...list]);
}
function fmtNum(n) { n = Number(n) || 0; if (n >= 10000) return (n / 10000).toFixed(n >= 100000 ? 0 : 1).replace(/\.0$/, "") + "万"; return String(n); }
// 品类标：显示命中的那个词（「咖啡」「四件套」「数码」）。它是从商品名里真读出来的，
// 不是我另贴的标签；认不出品类就不显示，别硬安一个。
// ⚠️别拿商品名的第一个字当大字——那多半是「北」「冷」「小」「高」这种修饰词，没有信息。
// 分栏（v60.44 重做）
// 她 2026-09-02：「这几样 category 改一下」，要改成我们自己的分法。
// 原来是「推荐/外卖/服饰/美妆/数码/家具/情趣」——一份通用电商品类词典，
// 原样搬进任何一个购物 app 都成立（tabs-not-plain-pills.md 那条判据）。
// 这个 app 里的购物不是「逛商城」，是【她在逛，而TA看得见、TA会买单】：
// 想要没买的会攒进心愿单喂给TA、TA能代付、TA给她开亲属卡、买回来的能拿给TA看。
// 所以分栏按【她自己会怎么说】来分，最后一栏是别的购物 app 不可能有的那一栏。
// ⚠️key 一个都不许改：商品和订单上存着 cat，改了老数据就认不回来了。
const SHOP_CATS = [
  { key: "recommend", zh: "随便逛逛" },
  { key: "fashion", zh: "穿的" },
  { key: "beauty", zh: "变好看" },
  { key: "digital", zh: "电子玩意" },
  { key: "furniture", zh: "屋里添点" },
  { key: "forhim", zh: "给TA买" },
  // 「情趣」她说留着（2026-09-02：「情趣留着，有点意思」）；
  // 「外卖」她说不要了——送外卖是TA做的事，手机里也另有一个外卖 app，这儿不必再摆一栏。
  //  ⚠️老订单里存着 cat:"food"，在途文案照旧认它（SHOP_SHIP_WORD），只是不再有这一栏可逛。
  { key: "adult", zh: "情趣" }
];
// 饭点。from/to 是钟点（to 可以跨过零点）；打开时按现在几点停在对应那一格。
// ⚠️key 一个都不许改：刷出来的店按 key 存在 x_takeoutFeed 里。
const TAKEOUT_SLOTS = [
  { key: "breakfast", zh: "早饭", from: 5, to: 10 },
  { key: "lunch", zh: "午饭", from: 10, to: 14 },
  { key: "tea", zh: "下午茶", from: 14, to: 17 },
  { key: "dinner", zh: "晚饭", from: 17, to: 21 },
  { key: "late", zh: "夜宵", from: 21, to: 29 }
];


// 情侣空间·问答小本：翻页书 —— 封面(可改标题)/翻页看过往(编辑·reroll·删除)/翻新题作答
// ── 情侣空间那几扇门的底（v62.85，审美审计还债④第二批）─────────────────
// 审计的「乙组」：这几页的部件早就合格了（布面本子、挂历页、照片、盆栽、登机牌、唱机），
// **唯独外壳还是 t.bg 平色或干脆没有 style**——元素合格、外壳裸着。
// 这一批每一页的底都从【这一页里那样东西本来待在哪儿】长出来，不是随便找个纹理：
//   本子翻开 → 内页的纸和中缝 · 挂历 → 挂它的那面墙 · 照片 → 相册的黑卡纸
//   盆栽 → 窗台的光 · 登机牌 → 行李箱的格纹内衬 · 碟 → 唱片箱的绒面内衬
// ⚠️深色/自定义主题下 t.ink 未必是六位色号，拼透明度后缀会拼出废值、整层静默消失，
//   所以一律走这个闸；验不过就退回纯色。
const cpSkin = (t, kind) => {
  const ok = /^#[0-9a-f]{6}$/i.test(String(t.ink || ""));
  if (!ok) return { background: t.bg };
  const k = t.ink;
  const layers = {
    // 本子的内页：横线纸，正中一道装订暗缝（一人一半，缝就在中间）
    page: ["repeating-linear-gradient(180deg," + k + "00 0 25px," + k + "0c 25px 26px)",
      "linear-gradient(90deg," + k + "00 calc(50% - 9px)," + k + "0e calc(50% - 3px),rgba(255,255,255,.42) 50%," + k + "0e calc(50% + 3px)," + k + "00 calc(50% + 9px))"],
    // 挂历挂着的那面墙：细颗粒 + 一大格一大格的淡影（月历的格子），不是纸
    wall: ["repeating-linear-gradient(90deg," + k + "00 0 47px," + k + "09 47px 48px)",
      "repeating-linear-gradient(180deg," + k + "00 0 47px," + k + "09 47px 48px)",
      "radial-gradient(120% 60% at 50% -10%,rgba(255,255,255,.5),rgba(255,255,255,0) 60%)"],
    // 相册的黑卡纸：暗一档、带极细的纸粒
    album: ["repeating-linear-gradient(41deg," + k + "00 0 2px," + k + "0a 2px 3px)",
      "linear-gradient(180deg," + k + "1c 0," + k + "12 100%)"],
    // 窗台：右上角斜进来一道光，加两条窗格的影
    sill: ["linear-gradient(212deg,rgba(255,250,225,.55) 0%,rgba(255,250,225,0) 46%)",
      "repeating-linear-gradient(212deg," + k + "00 0 54px," + k + "07 54px 62px)"],
    // 行李箱的格纹内衬：斜的细格子
    lining: ["repeating-linear-gradient(45deg," + k + "00 0 9px," + k + "08 9px 10px)",
      "repeating-linear-gradient(-45deg," + k + "00 0 9px," + k + "08 9px 10px)"],
    // 名册那一页是【走廊】——它自己写着「挑一扇门进去」。所以底是走廊的墙纸：
    // 细竖条 + 顶上一点漫光，跟屋里那面挂历墙（大格）一眼分得开。
    corridor: ["repeating-linear-gradient(90deg," + k + "00 0 11px," + k + "07 11px 12px)",
      "linear-gradient(180deg,rgba(255,255,255,.42) 0,rgba(255,255,255,0) 34%)"],
    // 唱片箱的绒面：短促的绒毛纹，比纸暗、比纸软
    velvet: ["repeating-linear-gradient(102deg," + k + "00 0 1px," + k + "0b 1px 2px)",
      "repeating-linear-gradient(12deg," + k + "00 0 3px," + k + "07 3px 4px)",
      "linear-gradient(160deg," + k + "16 0," + k + "0c 100%)"]
  }[kind] || [];
  return { background: t.bg, backgroundImage: layers.join(",") };
};


// 情侣空间·我们的日子：纪念日倒计时(倒数中) + 恋爱时间轴(时光轴，起点/里程碑/感慨)，二合一，都带年份
// 一张挂历页（v62.31 抽出来）：红头写月、大字写日、顶上两个挂孔。
// ⚠️一处画、三处用——倒数列表、情侣空间首页那格倒数、加纪念日那张表单，
// 全是同一张日历页。各画一份的话，改个红色就得记得改三遍（这个仓库最常犯的错）。
// blank=还没填的那一张（加纪念日用）：红头留白、日子位放输入框。
function CalPage({ month, day, dim, w, head, body }) {
  const t = useTheme();
  const W = w || 44;
  return h("div", { style: { position: "relative", width: W, flexShrink: 0, borderRadius: 7, overflow: "hidden", border: "1px solid " + t.line, boxShadow: "0 2px 6px rgba(0,0,0,.10)" } },
    h("div", { "aria-hidden": "true", style: { position: "absolute", top: 2.5, left: W * 0.2, width: 4, height: 4, borderRadius: 999, background: "rgba(255,255,255,.55)", zIndex: 1 } }),
    h("div", { "aria-hidden": "true", style: { position: "absolute", top: 2.5, right: W * 0.2, width: 4, height: 4, borderRadius: 999, background: "rgba(255,255,255,.55)", zIndex: 1 } }),
    h("div", { style: { background: dim ? "#a09890" : "#c25a5a", color: "#fff", fontSize: Math.max(8, Math.round(W * 0.2)), textAlign: "center", padding: "3px 0 2px", fontFamily: F_BODY, letterSpacing: 1 } },
      head !== undefined ? head : month + " 月"),
    h("div", { style: { background: t.bg2, textAlign: "center", fontFamily: F_DISPLAY, fontSize: Math.round(W * 0.43), color: t.ink, padding: "3px 0 4px", lineHeight: 1.1 } },
      body !== undefined ? body : day));
}



function AlbumPhoto({ photo, full, cover }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let alive = true, obj = null;
    if (photo && photo.imgKey && typeof idbImgGet === "function") {
      idbImgGet(photo.imgKey).then(b => { if (!alive) return; if (b && b.size) { obj = URL.createObjectURL(b); setUrl(obj); } }).catch(() => {});
    }
    return () => { alive = false; if (obj) URL.revokeObjectURL(obj); };
    // ts 也算（她 2026-10-24「日记照片刷新后要退出重进才能刷出新照片」）：重拍时图库里那把键不变、只是换了图，
    //   只看键就不会重读，一直摆着旧的那张
  }, [photo && photo.imgKey, photo && photo.ts]);
  const src = url || (photo && photo.imgUrl) || null;
  const desc = photo && String(photo.scene || photo.desc || "").slice(0, 300) || null;
  // 拍立得还在显影（她 2026-10-13）：一律先是一张灰白相纸，到点才显出来；长按甩一甩马上显影。
  //   放在这一处：墙上、大图、合照墙都走它，哪儿都不会提前露出来
  const [, tick] = useState(0);
  const [shaking, setShaking] = useState(false);
  const holdRef = useRef(null);
  const developing = !!(photo && photo.polaroid && Number(photo.developAt) > Date.now());
  useEffect(() => { if (!developing) return; const t2 = setInterval(() => tick(n => n + 1), 30000); return () => clearInterval(t2); }, [developing]);
  if (developing) {
    const left = Math.max(1, Math.round((Number(photo.developAt) - Date.now()) / 60000));
    const start = e => { holdRef.current = setTimeout(() => { setShaking(true); setTimeout(() => { setShaking(false); if (typeof window.__developPolaroid === "function") window.__developPolaroid(photo.id); }, 900); }, 550); };
    const stop = () => { clearTimeout(holdRef.current); };
    return h("div", { "data-wk": "polaroiddev", onPointerDown: start, onPointerUp: stop, onPointerLeave: stop, onPointerCancel: stop, onContextMenu: e => e.preventDefault(),
      className: shaking ? "animate-pulse" : "",
      style: { ...(cover ? { position: "absolute", inset: 0 } : { width: full ? "min(78vw, 360px)" : "100%", aspectRatio: "0.82", margin: full ? "0 auto" : 0 }),
        background: "#fbfaf6", padding: "6% 6% 24%", boxSizing: "border-box", borderRadius: full ? 6 : 0, boxShadow: full ? "0 6px 18px rgba(0,0,0,.15)" : "none",
        transform: shaking ? "rotate(-4deg)" : "none", transition: "transform .12s", touchAction: "none", userSelect: "none", WebkitUserSelect: "none" } },
      h("div", { style: { width: "100%", height: "100%", background: "linear-gradient(160deg,#5a5853,#7c7a73 55%,#8d8a82)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6 } },
        h("div", { style: { fontFamily: F_BODY, fontSize: cover ? 12 : 14, color: "rgba(255,255,255,.85)" } }, shaking ? "甩一甩…" : "显影中"),
        h("div", { style: { fontFamily: F_BODY, fontSize: cover ? 10 : 11.5, color: "rgba(255,255,255,.6)", textAlign: "center", padding: "0 8px" } }, "还要约 " + (left >= 60 ? Math.round(left / 60 * 10) / 10 + " 小时" : left + " 分钟") + " · 长按甩一甩")));
  }
  if (cover) return src ? h("img", { src, "data-desc": desc, style: { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" } }) : null;
  if (!src) return h("div", { style: { width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: full ? 40 : 20, opacity: 0.3 } }, "🖼");
  return h("img", { src, loading: "lazy", "data-desc": desc, style: full ? { maxWidth: "90vw", maxHeight: "72vh", borderRadius: 12, objectFit: "contain" } : { width: "100%", height: "100%", objectFit: "cover", display: "block" } });
}


// ── 全 app 的小图标（播放/红心/云…）：一处画，各处用 ──────────────────────
// ⚠️v67.51 之前它是【一起听】那个组件里的一个局部 const，于是这一份 SVG
//   别的页面一个都拿不到——情侣唱片那一行要一个播放键，只能另画一个三角，
//   或者退回 Unicode ▶（mobile-ui-layout.md 明令不许）。纯函数、只吃 h，
//   所以整块提到模块作用域；一起听那头一个字都不用改（施工规则/one-public-mechanism.md）。
const ic = (kind, c, size) => { size = size || 22;
  const svg = (children, o) => h("svg", Object.assign({ width: size, height: size, viewBox: "0 0 24 24" }, o), children);
  const stroke = { fill: "none", stroke: c, strokeWidth: 1.9, strokeLinecap: "round", strokeLinejoin: "round" };
  if (kind === "play") return svg(h("path", { d: "M8 5v14l11-7z", fill: c }));
  if (kind === "pause") return svg([h("rect", { key: 1, x: 6, y: 5, width: 4, height: 14, rx: 1, fill: c }), h("rect", { key: 2, x: 14, y: 5, width: 4, height: 14, rx: 1, fill: c })]);
  if (kind === "prev") return svg([h("rect", { key: 1, x: 6, y: 5, width: 2.4, height: 14, rx: 1, fill: c }), h("path", { key: 2, d: "M19 5v14l-10-7z", fill: c })]);
  if (kind === "next") return svg([h("path", { key: 1, d: "M5 5v14l10-7z", fill: c }), h("rect", { key: 2, x: 15.6, y: 5, width: 2.4, height: 14, rx: 1, fill: c })]);
  // 列表循环
  if (kind === "repeat") return svg([h("path", { key: 1, d: "M17 2l3 3-3 3", ...stroke }), h("path", { key: 2, d: "M20 5H8a4 4 0 0 0-4 4v1", ...stroke }), h("path", { key: 3, d: "M7 22l-3-3 3-3", ...stroke }), h("path", { key: 4, d: "M4 19h12a4 4 0 0 0 4-4v-1", ...stroke })]);
  // 单曲循环（循环+中间数字1）
  if (kind === "repeatone") return svg([h("path", { key: 1, d: "M17 2l3 3-3 3", ...stroke }), h("path", { key: 2, d: "M20 5H8a4 4 0 0 0-4 4v1", ...stroke }), h("path", { key: 3, d: "M7 22l-3-3 3-3", ...stroke }), h("path", { key: 4, d: "M4 19h12a4 4 0 0 0 4-4v-1", ...stroke }), h("text", { key: 5, x: 12, y: 15.5, fill: c, fontSize: 8, fontWeight: 700, textAnchor: "middle", fontFamily: "system-ui" }, "1")]);
  // 随机
  if (kind === "shuffle") return svg([h("path", { key: 1, d: "M16 3h5v5", ...stroke }), h("path", { key: 2, d: "M4 20L21 3", ...stroke }), h("path", { key: 3, d: "M21 16v5h-5", ...stroke }), h("path", { key: 4, d: "M15 15l6 6", ...stroke }), h("path", { key: 5, d: "M4 4l5 5", ...stroke })]);
  // 队列/列表
  if (kind === "list") return svg([h("path", { key: 1, d: "M4 6h11M4 12h11M4 18h7", ...stroke }), h("path", { key: 2, d: "M18 15l3 3-3 3", ...stroke, strokeWidth: 1.7 })]);
  // 云（网易云来源）
  if (kind === "cloud") return svg(h("path", { d: "M7 18h10a3.5 3.5 0 0 0 .5-6.96A5 5 0 0 0 8 9.5 4 4 0 0 0 7 18z", ...stroke }));
  // 音符（本地来源）
  if (kind === "note") return svg([h("path", { key: 1, d: "M9 18V6l10-2v12", ...stroke }), h("circle", { key: 2, cx: 6.5, cy: 18, r: 2.5, fill: c }), h("circle", { key: 3, cx: 16.5, cy: 16, r: 2.5, fill: c })]);
  // 搜索
  if (kind === "search") return svg([h("circle", { key: 1, cx: 11, cy: 11, r: 7, ...stroke }), h("path", { key: 2, d: "M20 20l-4-4", ...stroke })]);
  // 上传
  if (kind === "upload") return svg([h("path", { key: 1, d: "M12 16V4", ...stroke }), h("path", { key: 2, d: "M7 9l5-5 5 5", ...stroke }), h("path", { key: 3, d: "M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2", ...stroke })]);
  if (kind === "close") return svg([h("path", { key: 1, d: "M6 6l12 12", ...stroke }), h("path", { key: 2, d: "M18 6L6 18", ...stroke })]);
  if (kind === "heart") return svg(h("path", { d: "M12 21s-7-4.35-9.5-8.5C1 9 3 5.5 6.5 5.5c2 0 3.2 1.2 5.5 3.5 2.3-2.3 3.5-3.5 5.5-3.5C21 5.5 23 9 21.5 12.5 19 16.65 12 21 12 21z", fill: c === "solid" ? "#e0576b" : "none", stroke: c === "solid" ? "#e0576b" : c, strokeWidth: 1.7 }));
  // ── v62.46：行内那一排 Unicode 字符钮（♥ ♡ ＋ × ✎ ☁＋ － 🗑 🌙）全收进这儿 ──
  // 一页两种笔：走场控制是自画 SVG，行内动作是字符——审美审计点名的「同一页两套图标」。
  // 字符钮还有个更实在的毛病：它们的大小由字体决定，同一行里 ＋ 和 × 高矮不齐，
  // 而且 🗑 🌙 这类带变体选择符的在她机器上会渲成豆腐块（v61.29 记过一次）。
  if (kind === "plus") return svg([h("path", { key: 1, d: "M12 5v14", ...stroke }), h("path", { key: 2, d: "M5 12h14", ...stroke })]);
  if (kind === "minus") return svg(h("path", { d: "M5 12h14", ...stroke }));
  if (kind === "pen") return svg([h("path", { key: 1, d: "M4 20l4-1 10-10-3-3L5 16z", ...stroke }), h("path", { key: 2, d: "M14.5 5.5l3 3", ...stroke })]);
  if (kind === "trash") return svg([h("path", { key: 1, d: "M4 7h16", ...stroke }), h("path", { key: 2, d: "M9 7V5h6v2", ...stroke }), h("path", { key: 3, d: "M6 7l1 13h10l1-13", ...stroke })]);
  // 收进咱家歌库：云上加一笔
  if (kind === "cloudplus") return svg([h("path", { key: 1, d: "M7 16h8a3.2 3.2 0 0 0 .4-6.37A4.6 4.6 0 0 0 7.6 8 3.7 3.7 0 0 0 7 16z", ...stroke }), h("path", { key: 2, d: "M12 14v6M9 17h6", ...stroke })]);
  // 转给TA：一支往右上飞出去的箭（一起听的「转给TA」）
  if (kind === "regift") return svg([h("path", { key: 1, d: "M14 5h5v5M19 5l-8 8", ...stroke }), h("path", { key: 2, d: "M17 14v4a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 5 18V8.5A1.5 1.5 0 0 1 6.5 7H10", ...stroke })]);
  // 静音保活：一弯月，程序画的，不是 emoji
  if (kind === "moon") return svg(h("path", { d: "M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z", fill: c, stroke: "none" }));
  return svg(h("circle", { cx: 12, cy: 12, r: 8, fill: c }));
};


// Fish 官方接口不让网页直接调（她 2026-10-12 两台手机都报 Failed to fetch），要自己搭一个转发。
//   写在 Fish 那一格底下，点开才有；代码一键复制，不用她从截图里抄。
// 一段转发代码，换个上游就能给别家用（Fish、MiniMax 视频……官方接口不让网页直接调的都走这个）。
const relayCodeFor = host => `export default {
  async fetch(req) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "authorization, content-type, model",
    };
    if (req.method.toLowerCase() === "options") return new Response(null, { headers: cors });
    const url = new URL(req.url);
    const r = await fetch("${host}" + url.pathname + url.search, {
      method: req.method, headers: req.headers, body: req.body,
    });
    const h = new Headers(r.headers);
    for (const [k, v] of Object.entries(cors)) h.set(k, v);
    return new Response(r.body, { status: r.status, headers: h });
  },
};`;
const FISH_RELAY_CODE = relayCodeFor("https://api.fish.audio");
// hosts：[[名字, 上游地址], ...]——多于一个就先让她挑站点，复制出来的代码跟着换。
function RelayHelp({ toast, hosts, what }) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState(0);
  const list = hosts && hosts.length ? hosts : [["", "https://api.fish.audio"]];
  const code = relayCodeFor(list[Math.min(pick, list.length - 1)][1]);
  const p = { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.sub, lineHeight: 1.75 };
  return h("div", { "data-wk": "fishrelay", style: { margin: "-2px 0 12px" } },
    h("button", { onClick: () => setOpen(v => !v), className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.tint || t.ink, padding: "4px 0" } }, open ? "收起 ▴" : "没有中转？自己搭一个（免费，几分钟）▾"),
    open ? h("div", { style: { marginTop: 6, padding: "10px 12px", borderRadius: 10, border: "1px solid " + t.line, background: t.bg } },
      h("div", { style: p }, "用 Cloudflare 的免费 Worker 搭，密钥只经过你自己的号："),
      list.length > 1 ? h("div", { style: { display: "flex", flexWrap: "wrap", gap: 6, margin: "4px 0 6px" } }, list.map(([n], k) => h("button", { key: k, type: "button", onClick: () => setPick(k), className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", padding: "4px 10px", borderRadius: 999, border: "1px solid " + (k === pick ? t.accent : t.line), color: k === pick ? t.accent : t.sub } }, n))) : null,
      list.length > 1 ? h("div", { style: Object.assign({}, p, { fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog }) }, "先挑你的密钥是哪个站申请的，下面的代码会跟着换。") : null,
      h("div", { style: p }, "① 登录 Cloudflare → Workers & Pages → Create → Create Worker，随便起名，点 Deploy。"),
      h("div", { style: p }, "② 点 Edit code，把原来的代码全删掉，换成下面这段，再点 Deploy。"),
      h("pre", { style: { margin: "8px 0", padding: 10, borderRadius: 8, background: t.bg2, border: "1px solid " + t.line, fontSize: "calc(10.5px * var(--app-fs, 1))", lineHeight: 1.5, color: t.ink, overflowX: "auto", whiteSpace: "pre" } }, code),
      h("button", { onClick: async () => { const ok = typeof copyText === "function" && await copyText(code); toast && toast(ok ? "代码复制好了，去 Cloudflare 粘上" : "复制不了，长按上面那段自己选"); }, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.accent, padding: "4px 0" } }, "复制代码"),
      h("div", { style: Object.assign({}, p, { marginTop: 8 }) }, "③ 复制这个 Worker 的地址（https://名字.账号.workers.dev），填进上面「接口地址」，" + (what || "点试听") + "。"),
      h("div", { style: Object.assign({}, p, { color: t.fog, fontSize: "calc(11px * var(--app-fs, 1))" }) }, "workers.dev 在国内有时连不稳：连不上就开着梯子用，或者在 Cloudflare 里给它绑一个自己的域名。")) : null);
}
// 上下文透视（v47.75 借汪汪机的调试页思路）：把「此刻和 TA 聊天会喂给模型的完整 system prompt」
// 按【段落】拆开展示。角色变笨/OOC/忘事时来这里一眼定位是哪一段的问题。只读、零 API。
// P0-1 召回旁路仪表（只读折叠区，v49.15）：展示 shadow 观测聚合，不改任何召回行为。
function RecallShadowPanel() {
  const t = useTheme();
  const [folded, setFolded] = useState(true);
  const [rep, setRep] = useState(null);
  const [qrep, setQrep] = useState(null);
  const [more, setMore] = useState({});
  const load = async () => {
    if (window.RecallShadow) setRep(await window.RecallShadow.report(200));
    if (window.MemoryQualityShadow) setQrep(await window.MemoryQualityShadow.report(200));
    const defs = [["repair", window.OpenRepairShadow], ["correction", window.MemoryCorrectionShadow], ["experience", window.ExperienceGateShadow],
      ["resolution", window.TwoResolutionShadow], ["budget", window.ContextBudgetShadow],
      ["branch", window.MessageBranchShadow], ["insight", window.InsightCandidateShadow]];
    const vals = await Promise.all(defs.map(async ([key, mod]) => [key, mod && mod.report ? await mod.report(200) : null]));
    setMore(Object.fromEntries(vals));
  };
  useEffect(() => { if (!folded) load(); }, [folded]);
  if (!window.RecallShadow) return null;
  return h("div", { style: { marginTop: 10, border: "1px dashed " + t.line, borderRadius: 12, padding: "8px 12px" } },
    h("button", { onClick: () => setFolded(f => !f), className: "w-full flex items-center justify-between active:opacity-60" },
      h("span", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.sub } }, "🔬 召回冷却（P0-2 · 4轮）"),
      h("span", { style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.fog } }, folded ? "▸" : "▾")),
    folded ? null : (rep ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.sub, lineHeight: 1.9, marginTop: 6 } },
      rep.error ? rep.error : h(React.Fragment, null,
        "近 " + rep.observations + " 次召回观测（含后台）：", h("br"),
        "· 当前状态：" + (rep.liveEnabled ? "已转正（pinned / open / top-1 永久豁免）" : "已回滚为旧召回"), h("br"),
        "· 同分窗口：" + (rep.tieEnabled ? "已开启受控换序（同一轮稳定）" : "已关闭，保持固定排序"), h("br"),
        "· 连续重复率 " + Math.round(rep.repeatRate * 100) + "%（topK 里 4 轮内刚说过的占比——机械感来源）", h("br"),
        "· 冷却版预计替换率 " + Math.round(rep.proposedReplaceRate * 100) + "%（若开冷却会换掉的条目比例）", h("br"),
        "· 空召回率 " + Math.round(rep.emptyRate * 100) + "% · 平均每次被冷却 " + rep.avgCooledPerCall + " 条", h("br"),
        "· 同分窗口均宽 " + rep.avgWindowSize + " · 窄窗(≤1)占 " + Math.round(rep.narrowWindowRate * 100) + "%（P0-3 随机值不值得开看这行）", h("br"),
        rep.exemptionAudit ? "· 冷却豁免误伤 pinned/open/top-1：" + rep.exemptionAudit.pinnedCooledViolations + "/" + rep.exemptionAudit.openCooledViolations + "/" + rep.exemptionAudit.top1CooledViolations + "（必须全为0；v2样本 " + rep.exemptionAudit.samples + "）" : "", rep.exemptionAudit ? h("br") : null,
        "· 活跃角色环：" + (rep.rings || []).map(r => r.char + "(" + r.ring + "条/第" + r.turn + "轮)").join("、"),
        qrep && !qrep.error ? h("div", { style: { marginTop: 7, paddingTop: 7, borderTop: "1px dashed " + t.line } },
          "🧪 抽取质量 shadow：" + qrep.batches + " 批 / " + qrep.candidates + " 个候选", h("br"),
          "· 类别 " + Object.entries(qrep.kinds || {}).map(([k,v]) => k + " " + v).join(" · "), h("br"),
          "· 证据逐字核验通过 " + Math.round(qrep.evidenceValidRate * 100) + "% · 无效 " + (qrep.invalidEvidenceCount || 0) + " 条", h("br"),
          "· 里程碑误降温度 " + qrep.milestoneViolations + " · 日常温度仍被旧路入库 " + qrep.temperatureAccepted + " · 建议拒绝但旧路入库 " + qrep.proposedRejectButAccepted) : null,
        more.repair && !more.repair.error ? h("div", { style: { marginTop: 7, paddingTop: 7, borderTop: "1px dashed " + t.line } },
          "🩹 RepairGate：" + more.repair.candidates + " 份合格证据 · 实际涉及 " + Number(more.repair.uniqueOpenMemories || 0) + " 条开环", h("br"),
          "· 证据结局：兑现 " + more.repair.fulfilled + " · 修复 " + more.repair.resolved + " · 放弃 " + more.repair.abandoned, h("br"),
          "· 被重复提名 " + Number(more.repair.repeatedOpenMemories || 0) + " 条 · 重复证据行 " + Number(more.repair.duplicateEvidenceRows || 0) + " · 结局互相冲突 " + Number(more.repair.outcomeConflicts || 0) + " 条") : null,
        more.correction && !more.correction.error ? h("div", { style: { marginTop: 7, paddingTop: 7, borderTop: "1px dashed " + t.line } },
          "纠错留环：" + more.correction.pairs + " 组包含配对 · 旧规则本会硬删 " + more.correction.currentWouldPrune) : null,
        more.experience && !more.experience.error ? h("div", { style: { marginTop: 7, paddingTop: 7, borderTop: "1px dashed " + t.line } },
          "🏝️ 来源诚实性 v" + (more.experience.auditVersion || 1) + "：" + more.experience.audits + " 次上下文 · " + more.experience.callsWithRisk + " 次含真假宣称风险 · 旧版留档 " + (more.experience.legacySamples || 0), h("br"),
          "· 真正文断言 " + Number(more.experience.riskReasons&&more.experience.riskReasons.assertive_body||0) + " · 仅标题误报 " + Number(more.experience.riskReasons&&more.experience.riskReasons.header_label_only||0), h("br"),
          "· 风险块 " + (Object.entries(more.experience.riskyBlocks || {}).map(([k,v]) => k + " " + v).join(" · ") || "暂无")) : null,
        more.resolution && !more.resolution.error ? h("div", { style: { marginTop: 7, paddingTop: 7, borderTop: "1px dashed " + t.line } },
          "🌊 两分辨率：" + more.resolution.audits + " 次 · " + Object.entries(more.resolution.modes || {}).map(([k,v]) => k + " " + v).join(" · "), h("br"),
          "· 精确碎片均值 " + more.resolution.avgBaselineDetails + " → 建议 " + more.resolution.avgProposedDetails + " · 事件覆盖 " + Math.round(more.resolution.eventCoverage * 100) + "%") : null,
        more.budget && !more.budget.error ? h("div", { style: { marginTop: 7, paddingTop: 7, borderTop: "1px dashed " + t.line } },
          "📏 统一预算：" + more.budget.audits + " 次 · 平均 " + more.budget.avgTotalChars + " 字 → 建议 " + more.budget.avgProposedChars + " 字", h("br"),
          "· 超过 " + more.budget.softBudget + " 字软预算的比例 " + Math.round(more.budget.pressureRate * 100) + "%") : null,
        more.branch && !more.branch.error ? h("div", { style: { marginTop: 7, paddingTop: 7, borderTop: "1px dashed " + t.line } },
          "🌿 有效消息分支：" + more.branch.audits + " 次操作 · 异常 " + more.branch.invalid + " · 悬空后文 " + more.branch.danglingTail, h("br"),
          "· 操作 " + (Object.entries(more.branch.actions || {}).map(([k,v]) => k + " " + v).join(" · ") || "暂无")) : null,
        more.insight && !more.insight.error ? h("div", { style: { marginTop: 7, paddingTop: 7, borderTop: "1px dashed " + t.line } },
          "💎 洞察候选 v" + (more.insight.auditVersion || 1) + "：" + more.insight.candidates + " 个 · 严格五门齐全 " + Math.round(more.insight.readyRate * 100) + "% · 引文有效 " + Math.round(more.insight.validQuoteRate * 100) + "% · 旧版留档 " + (more.insight.legacySamples || 0), h("br"),
          "· 不合格却仍混入普通记忆 " + Math.round((more.insight.unsafeOrdinaryLeakRate == null ? more.insight.ordinaryMemoryLeakRate : more.insight.unsafeOrdinaryLeakRate) * 100) + "%") : null,
        h("div", { className: "flex", style: { gap: 10, marginTop: 6 } },
          h("button", { onClick: load, style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.tint } }, "刷新"),
          h("button", { onClick: () => { window.RecallShadow.setLiveEnabled(!rep.liveEnabled); load(); }, style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: rep.liveEnabled ? "#9f5149" : t.tint } }, rep.liveEnabled ? "关闭4轮冷却（立即回滚）" : "重新开启4轮冷却"),
          h("button", { onClick: () => { window.RecallShadow.setTieEnabled(!rep.tieEnabled); load(); }, style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: rep.tieEnabled ? "#9f5149" : t.tint } }, rep.tieEnabled ? "关闭同分换序" : "开启同分换序"),
          h("button", { onClick: () => { window.RecallShadow.setEnabled(!rep.enabled); load(); }, style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: rep.enabled ? "#9f5149" : t.tint } }, rep.enabled ? "暂停观测" : "恢复观测（当前已停·零写入）"),
          h("button", { onClick: () => requestAppConfirm("清空召回与抽取质量旁路诊断？", "不影响任何记忆数据。", () => { Promise.all([window.RecallShadow.clearAll(), window.MemoryQualityShadow ? window.MemoryQualityShadow.clearAll() : null, window.MemoryCorrectionShadow ? window.MemoryCorrectionShadow.clearAll() : null]).then(load); }, "清空"), style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog } }, "清空")))) :
      h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.fog, marginTop: 6 } }, "读取中…")));
}

function CtxDebug({ characters, getBundle, lockedCharId, compact }) {
  const t = useTheme();
  const initialCid = lockedCharId || null;
  // 段界记号：带记号的就照它拆（世界书、角色卡正文里的【小标题】不再被当成顶格的段），
  //   没有记号（旧路、别处调的）才退回按行首【】自己猜。显示前一律摘掉记号。
  const SEC_MARK = (typeof window !== "undefined" && window.BUNDLE_SEC_MARK) || "\u2063";
  const RULE_MARK = (typeof window !== "undefined" && window.BUNDLE_RULE_MARK) || "\u2062";
  // 出货版：App 内置的规矩那几段整段不显示，抓请求也不给（她 2026-11-13）。家里照旧全看。
  const PUB = typeof window !== "undefined" && !!window.PUBLIC_BUILD;
  const readBundle = id => String((getBundle && getBundle(id)) || "（空）");
  const stripMarks = s => String(s).split(SEC_MARK).join("").split(RULE_MARK).join("");
  const readRecall = id => typeof window !== "undefined" && window.MemoryRecallSnapshot ? window.MemoryRecallSnapshot.get(id) : null;
  const [cid, setCid] = useState(initialCid);
  const [bundleRaw, setBundleRaw] = useState(() => initialCid ? readBundle(initialCid) : "");
  const text = stripMarks(bundleRaw);
  const [recall, setRecall] = useState(() => initialCid ? readRecall(initialCid) : null);
  // 房间自己那份记忆的召回收据（ChatRooms.memRecall 只在真发出去的那一轮留）。跟主线那份分开放、分开画。
  const readRoomRecall = id => typeof window !== "undefined" && window.__roomRecallSnapshots ? window.__roomRecallSnapshots[String(id)] || null : null;
  const [roomRecall, setRoomRecall] = useState(() => initialCid ? readRoomRecall(initialCid) : null);
  // 线下那一轮的 system 原件收据（engine 在真发出去那一刻留的；只在内存，刷新即清）
  const readOffReceipt = id => typeof window !== "undefined" && window.__offlineSysReceipt ? window.__offlineSysReceipt[String(id)] || null : null;
  const [offReceipt, setOffReceipt] = useState(() => initialCid ? readOffReceipt(initialCid) : null);
  const [open, setOpen] = useState({});
  const [wireOn, setWireOn] = useState(() => typeof window !== "undefined" && !!window.__offlineWireCaptureEnabled);
  const [wireRows, setWireRows] = useState(() => typeof window !== "undefined" ? (window.__offlineWireCaptures || []).slice() : []);
  const refreshWire = () => setWireRows(typeof window !== "undefined" ? (window.__offlineWireCaptures || []).slice() : []);
  const toggleWire = () => {
    const next = !wireOn;
    if (typeof window !== "undefined") window.__offlineWireCaptureEnabled = next;
    setWireOn(next);
    refreshWire();
  };
  const clearWire = () => { if (typeof window !== "undefined") window.__offlineWireCaptures = []; setWireRows([]); };
  const exportWire = async row => {
    try {
      await saveTextFile("聊天请求-" + row.ts + ".json", JSON.stringify(row, null, 2), "application/json");
    } catch (e) { if (e.name !== "AbortError") window.__toast && window.__toast("导出失败，请重试"); }
  };
  const recallLaneLabel = lane => lane === "pinned" ? "置顶直入" : lane === "association" ? "联想专座" : lane === "main" ? "主召回" : "未过准入";
  const recallReasonLabel = reason => ({
    relevance_gate: "没有词面或足够语义证据",
    score_floor: "综合分未过线",
    cooldown: "四轮内刚浮现过",
    main_cap: "主召回名额已满",
    association_cap: "联想名额已满"
  })[reason] || reason || "未入选";
  const recallPartsText = row => {
    const p = row && row.scoreParts;
    if (!p) return "";
    const bits = ["词面 " + p.overlap, "标签 " + p.tagHit];
    if (p.cosine != null) bits.push("向量 " + p.cosine);
    bits.push("保持 " + p.retention, "新近 " + p.recency);
    if (p.arousal) bits.push("情绪 " + p.arousal);
    if (p.open) bits.push("开环 " + p.open);
    return bits.join(" · ");
  };
  const recallRowView = (row, i, missed) => h("details", {
    key: (missed ? "miss_" : "hit_") + (row.id || i),
    style: { borderTop: "1px solid " + t.line, padding: "7px 0 2px" }
  },
  h("summary", { style: { cursor: "pointer", fontFamily: F_BODY, fontSize: missed ? 11 : 11.5, color: t.ink, lineHeight: 1.5 } },
    (missed ? recallReasonLabel(row.reason) + " · " : (i + 1) + ". ") +
    String(row.text || "（空）").replace(/\s+/g, " ").slice(0, missed ? 42 : 54) +
    (String(row.text || "").length > (missed ? 42 : 54) ? "…" : "")),
  h("div", { style: { marginTop: 5, whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: F_BODY, fontSize: missed ? 10.5 : 11, color: t.sub, lineHeight: 1.65 } }, row.text || "（空）"),
  h("div", { style: { marginTop: 4, fontFamily: "monospace", fontSize: "calc(9.5px * var(--app-fs, 1))", color: t.fog, lineHeight: 1.55 } },
    recallLaneLabel(row.recallKind) + (row.pinned ? "" : " · " + (row.vectorScored ? "向量参与打分" : "关键词打分") + " · 总分 " + row.score) + (row.tags && row.tags.length ? " · " + row.tags.join(" / ") : "")),
  row.scoreParts ? h("div", { style: { marginTop: 3, fontFamily: "monospace", fontSize: "calc(9.5px * var(--app-fs, 1))", color: t.fog, lineHeight: 1.55 } }, recallPartsText(row)) : null);
  const wireDiff = (() => {
    if (wireRows.length < 2) return [];
    const a = wireRows[wireRows.length - 2].body || {}, b = wireRows[wireRows.length - 1].body || {};
    const flat = (v, p, out) => {
      if (v && typeof v === "object") {
        const keys = Array.isArray(v) ? v.map((_, i) => String(i)) : Object.keys(v);
        if (!keys.length) out[p] = JSON.stringify(v);
        keys.forEach(k => flat(v[k], p ? p + "." + k : k, out));
      } else out[p] = JSON.stringify(v);
      return out;
    };
    const fa = flat(a, "", {}), fb = flat(b, "", {});
    const lineDelta = (av, bv) => {
      let as, bs;
      try { as = JSON.parse(av); bs = JSON.parse(bv); } catch (e) { return null; }
      if (typeof as !== "string" || typeof bs !== "string" || (as.length < 120 && bs.length < 120)) return null;
      const allA = as.split("\n"), allB = bs.split("\n");
      // 超长 system 通常只有中间一小块动态变化。先剥掉共同首尾，再对真正变化区做 LCS，
      // 避免整份数百行 prompt 因超过旧上限而退回无法阅读的 A/B 整段。
      let head = 0;
      while (head < allA.length && head < allB.length && allA[head] === allB[head]) head++;
      let tail = 0;
      while (tail < allA.length - head && tail < allB.length - head && allA[allA.length - 1 - tail] === allB[allB.length - 1 - tail]) tail++;
      const aa = allA.slice(head, allA.length - tail), bb = allB.slice(head, allB.length - tail);
      if (aa.length > 1200 || bb.length > 1200) return null;
      const dp = Array.from({ length: aa.length + 1 }, () => new Uint16Array(bb.length + 1));
      for (let i = aa.length - 1; i >= 0; i--) for (let j = bb.length - 1; j >= 0; j--)
        dp[i][j] = aa[i] === bb[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
      const out = []; let i = 0, j = 0;
      while (i < aa.length || j < bb.length) {
        if (i < aa.length && j < bb.length && aa[i] === bb[j]) { i++; j++; continue; }
        if (j < bb.length && (i >= aa.length || dp[i][j + 1] >= dp[i + 1][j])) out.push({ op: "+", text: bb[j++] });
        else if (i < aa.length) out.push({ op: "-", text: aa[i++] });
      }
      return out;
    };
    return [...new Set([...Object.keys(fa), ...Object.keys(fb)])]
      .filter(k => fa[k] !== fb[k])
      .map(k => ({ path: k, before: fa[k], after: fb[k], lines: lineDelta(fa[k], fb[k]) }));
  })();
  const load = id => {
    setCid(id);
    setBundleRaw(readBundle(id));
    setRecall(readRecall(id));
    setRoomRecall(readRoomRecall(id));
    setOffReceipt(readOffReceipt(id));
    setOpen({});
  };
  // 拆段这一处线上线下共用（one-public-mechanism）：带段界记号的照记号拆，
  //   没有记号的（线下那份是在拼装那儿一长串接出来的）按【空行＋行首【】】拆——
  //   单换行的【小标题】是别人肚子里的内容，不是一段。
  const splitBundleText = src => {
    const one = String(src || "");
    if (!one) return [];
    const marked = one.includes(SEC_MARK);
    const text = stripMarks(one);
    const chunks = marked ? one.split(SEC_MARK) : text.split(/\n\n(?=【)/);
    const raw = chunks.map((p, i) => {
      const rule = String(p).startsWith(RULE_MARK);
      const body = stripMarks(p).replace(/^\n+/, "");
      const m = body.match(/^【[^】]*】/);
      return { title: m ? m[0] : (i === 0 ? "【开头】" : "【段落 " + (i + 1) + "】"), body: body, rule: rule };
    }).filter(x => x.body.trim()).filter(x => !(PUB && x.rule));
    if (marked) return raw;
    // ⚠️长期记忆自己内部就是一段一段的【7月8日】，而这儿按【行首的【】】切段，
    // 于是【一段】被切成几十条，看着像几十个各自独立的东西——她 2026-09-01 就是
    // 这么被绕进去的：「这个长期记忆是 7/8 之前的，而且一直没变过」。
    // 其实那底下所有带日期的都是它，新浓缩出来的都在后面接着，它只是【最上面那一截】。
    // 更要命的是它把这一段的【真实体量】藏了：四十条各占 1%，读出来像不值一提，
    // 可加起来是这份上下文里最肥的几段之一——而这一页存在的全部意义就是
    //「角色变笨先查最肥的那几段」。
    // 判据：真正的段头没有一个是日期（都是「世界书」「你是谁」这类），
    // 所以【以日期开头的一段】必然是别人肚子里的内容，并回上一段。
    const out = [];
    raw.forEach(sec => {
      if (out.length && /^【\d+月\d+日/.test(sec.title)) {
        const prev = out[out.length - 1];
        prev.body = prev.body + "\n" + sec.body;
        prev.inner = (prev.inner || 0) + 1;
        return;
      }
      out.push(sec);
    });
    return out;
  };
  const sumLen = list => list.reduce((a, x) => a + x.body.length, 0);
  const secs = cid ? splitBundleText(bundleRaw) : [];
  const offSecs = cid && offReceipt ? splitBundleText(offReceipt.system) : [];
  // 段列表（占比 + 肥度条 + 展开）这一处线上线下共用（one-public-mechanism）
  const secList = (list, totalLen, refresh, pre) => {
    const total = Math.max(1, totalLen);
    const pctOf = x => Math.round(x.body.length / total * 100);
    const top3 = list.slice().sort((a, b) => b.body.length - a.body.length).slice(0, 3).filter(x => x.body.length > 0);
    const barColor = p => p >= 20 ? "#c25a4a" : p >= 10 ? "#b89150" : t.line;
    return h("div", null,
      h("div", { className: "flex items-center justify-between", style: { marginBottom: 6 } },
        h("span", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog } }, list.length + " 段 · 共 " + totalLen + " 字 · 点标题展开"),
        refresh ? h("button", { onClick: refresh, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.tint } }, "刷新") : null),
      top3.length ? h("div", { "data-wk": "block", style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.sub, lineHeight: 1.7, background: t.bg2, border: "1px solid " + t.line, borderRadius: 10, padding: "7px 11px", marginBottom: 10 } },
        "最肥三段：" + top3.map(x => x.title.replace(/[【】]/g, "") + " " + pctOf(x) + "%").join(" · ") + "——变笨先查它们") : null,
      list.map((x, i) => {
        const pct = pctOf(x), k = (pre || "") + i;
        return h("div", { key: k, style: { border: "1px solid " + t.line, borderRadius: 12, marginBottom: 8, overflow: "hidden" } },
          h("button", { onClick: () => setOpen(o => ({ ...o, [k]: !o[k] })), className: "w-full active:opacity-70", style: { padding: "9px 12px 7px", background: t.bg2, textAlign: "left", display: "block" } },
            h("div", { className: "flex items-center justify-between gap-2" },
              h("span", { style: { fontFamily: F_DISPLAY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.ink, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } },
                x.title, x.inner ? h("span", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog, marginLeft: 7 } }, "含 " + x.inner + " 段") : null),
              h("span", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: pct >= 20 ? "#c25a4a" : t.fog, flexShrink: 0 } }, x.body.length + " 字 · " + pct + "% " + (open[k] ? "▾" : "▸"))),
            h("div", { style: { height: 3, borderRadius: 999, background: t.bg, marginTop: 6, overflow: "hidden" } },
              h("div", { style: { height: "100%", width: Math.max(2, pct) + "%", borderRadius: 999, background: barColor(pct) } }))),
          open[k] ? h("div", { style: { padding: "10px 12px", fontFamily: "monospace", fontSize: "calc(11px * var(--app-fs, 1))", lineHeight: 1.7, color: t.sub, whiteSpace: "pre-wrap", wordBreak: "break-all", maxHeight: 300, overflowY: "auto", background: t.bg } }, x.body) : null);
      }));
  };
  return h("div", { style: { marginTop: compact ? 2 : 10 } },
    h(Eyebrow, { style: { marginBottom: 8 } }, compact ? "本轮注入 · " + ((((characters || [])[0] || {}).remark) || (((characters || [])[0] || {}).name) || "当前角色") : "上下文透视"),
    h(React.Fragment, null,
    h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.fog, lineHeight: 1.7, marginBottom: 10 } }, compact ? "刚聊完就来这里看：上面是上一轮真正选中的记忆，下面是此刻重建的完整提示词预览。" : "看看此刻和 TA 聊天时，到底喂了什么给模型（人设 / 记忆 / 世界书 / 行程…按段拆开）。角色变笨、OOC、忘事时来这里排查是哪一段出了问题。"),
    PUB ? null : h("div", { style: { border: "1px dashed " + t.line, borderRadius: 12, padding: "10px 12px", marginBottom: 12, background: t.bg2 } },
      h("div", { className: "flex items-center justify-between gap-2" },
        h("div", null,
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.ink } }, "本轮请求诊断 · 仅本机内存"),
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog, marginTop: 2 } }, "手动开启后记录各角色单聊及线下的最近 8 次请求（含重试），不额外调用模型。省略请求地址、认证字段与图片；仍含私聊、人设和记忆，请勿公开。重开网页后自动关闭并清空。")),
        h("button", { "data-wk": "block", onClick: toggleWire, style: { flexShrink: 0, fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", padding: "6px 10px", borderRadius: 999, background: wireOn ? t.tint : "transparent", color: wireOn ? "#fff" : t.sub, border: "1px solid " + (wireOn ? t.tint : t.line) } }, wireOn ? "停止抓取" : "开始抓取")),
      h("div", { className: "flex gap-3", style: { marginTop: 8 } },
        h("button", { onClick: refreshWire, style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.tint } }, "刷新记录"),
        h("button", { onClick: clearWire, style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog } }, "清空")),
      wireRows.length >= 2 ? h("details", { style: { marginTop: 8, padding: "7px 8px", borderRadius: 8, background: t.bg } },
        h("summary", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.ink, cursor: "pointer" } }, "最近两次最终 body：" + wireDiff.length + " 个字段差异"),
        h("div", { style: { marginTop: 6, maxHeight: 240, overflow: "auto", fontFamily: "monospace", fontSize: "calc(9.5px * var(--app-fs, 1))", lineHeight: 1.55, color: t.sub } },
          wireDiff.length ? wireDiff.slice(0, 120).map((d, i) => h("div", { key: i, style: { padding: "4px 0", borderTop: i ? "1px solid " + t.line : "none" } },
            h("div", { style: { color: t.tint } }, d.path),
            d.lines ? h("div", { style: { marginTop: 3 } },
              d.lines.length ? d.lines.slice(0, 160).map((x, n) => h("div", { key: n, style: { color: x.op === "+" ? "#4a7a4a" : "#b0503f", whiteSpace: "pre-wrap" } }, x.op + " " + (x.text || "（空行）"))) : h("div", null, "仅行内字符变化"))
            : h(React.Fragment, null,
              h("div", null, "A: " + String(d.before).slice(0, 500)),
              h("div", null, "B: " + String(d.after).slice(0, 500))))) : h("div", null, "最终 body 完全一致"))) : null,
      wireRows.length ? h("div", { style: { marginTop: 8 } },
        wireRows.slice().reverse().map((r, i) => h("details", { key: r.id, style: { marginTop: 6, borderTop: i ? "1px solid " + t.line : "none", paddingTop: i ? 6 : 0 } },
          h("summary", { style: { fontFamily: "monospace", fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.sub, cursor: "pointer" } },
            new Date(r.ts).toLocaleTimeString() + " · " + (r.scope === "chat" ? "单聊" : "线下") + " · " + r.format + " · " + (r.attempt || "primary")),
          h("button", { onClick: () => exportWire(r), style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.tint, padding: "10px 0" } }, "导出这次请求"),
          h("pre", { style: { marginTop: 6, padding: 8, borderRadius: 8, background: t.bg, maxHeight: 280, overflow: "auto", whiteSpace: "pre-wrap", wordBreak: "break-all", fontFamily: "monospace", fontSize: "calc(9.5px * var(--app-fs, 1))", lineHeight: 1.55, color: t.sub } }, JSON.stringify(r, null, 2)))))
      : h("div", { style: { marginTop: 8, fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog } }, "暂无记录。开启后正常聊一轮，再回来点“刷新记录”，展开对应时间的记录导出。")),
    !compact ? h(RecallShadowPanel, null) : null,
    !lockedCharId ? h("div", { className: "flex gap-2 flex-wrap", style: { marginBottom: 10 } }, (characters || []).map(c =>
      h("button", { "data-wk": "block", key: c.id, onClick: () => load(c.id), className: "active:opacity-70", style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", padding: "6px 13px", borderRadius: 999, background: cid === c.id ? t.ink : t.bg2, color: cid === c.id ? t.bg2 : t.ink, border: "1px solid " + (cid === c.id ? t.ink : t.line) } }, c.remark || c.name))) : null,
    cid ? h("div", { style: { border: "1px solid " + t.line, borderRadius: 14, padding: "11px 12px", marginBottom: 10, background: t.bg2 } },
      h("div", { className: "flex items-start justify-between gap-2" },
        h("div", null,
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(14px * var(--app-fs, 1))", color: t.ink } }, "上一轮真实召回"),
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog, lineHeight: 1.55, marginTop: 2 } }, "只认上一轮聊天实际送进模型的选集；刷新 App 即清空。下面的上下文段落只是此刻预览。")),
        recall ? h("span", { style: { flexShrink: 0, borderRadius: 999, padding: "3px 7px", fontFamily: F_BODY, fontSize: "calc(9.5px * var(--app-fs, 1))", color: recall.mode === "hybrid" ? t.tint : t.fog, border: "1px solid " + (recall.mode === "hybrid" ? t.tint : t.line) } }, recall.mode === "hybrid" ? "向量混合" : "关键词") : null),
      recall ? h(React.Fragment, null,
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog, marginTop: 8 } },
          new Date(recall.ts).toLocaleString() + " · 可见候选 " + recall.candidateCount + " 条 · 最终 " + (recall.picked || []).length + " 条" + (recall.hiddenCount ? " · 权限隔离 " + recall.hiddenCount + " 条" : "") + (recall.model ? " · " + recall.model : "")),
        (recall.picked || []).length
          ? h("div", { style: { marginTop: 7 } }, recall.picked.map((row, i) => recallRowView(row, i, false)))
          : h("div", { style: { marginTop: 8, fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog } }, "这一轮实际没有召回任何记忆。"),
        (recall.excluded || []).length ? h("details", { style: { marginTop: 9, borderTop: "1px dashed " + t.line, paddingTop: 8 } },
          h("summary", { style: { cursor: "pointer", fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.sub, lineHeight: 1.6 } },
            "查看没进来的候选 · " + Object.entries(recall.excludedCounts || {}).map(([reason, count]) => recallReasonLabel(reason) + " " + count).join(" / ")),
          h("div", { style: { marginTop: 5 } }, (recall.excluded || []).map((row, i) => recallRowView(row, i, true)))) : null)
      : h("div", { style: { marginTop: 8, fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog, lineHeight: 1.6 } }, "还没有这一页生命周期内的真实聊天收据。先和 TA 发一轮消息，再回来刷新。")) : null,
    // 在小房间里聊的那一轮：这间房自己记下的哪几条被一起送进去了
    cid && roomRecall ? h("div", { style: { border: "1px solid " + t.line, borderRadius: 14, padding: "11px 12px", marginBottom: 10, background: t.bg2 } },
      h("div", { className: "flex items-start justify-between gap-2" },
        h("div", null,
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(14px * var(--app-fs, 1))", color: t.ink } }, "上一轮房间记忆 · 「" + (roomRecall.roomName || "小房间") + "」"),
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog, lineHeight: 1.55, marginTop: 2 } }, "这间房自己名下记的，只在这间房里送进去；主线那份在上面。刷新 App 即清空。")),
        h("span", { style: { flexShrink: 0, borderRadius: 999, padding: "3px 7px", fontFamily: F_BODY, fontSize: "calc(9.5px * var(--app-fs, 1))", color: roomRecall.mode === "hybrid" ? t.tint : t.fog, border: "1px solid " + (roomRecall.mode === "hybrid" ? t.tint : t.line) } }, roomRecall.mode === "hybrid" ? "向量混合" : "关键词")),
      h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog, marginTop: 8 } },
        new Date(roomRecall.ts).toLocaleString() + " · 这间房共 " + roomRecall.candidateCount + " 条 · 送进去 " + (roomRecall.picked || []).length + " 条"),
      (roomRecall.picked || []).length
        ? h("div", { style: { marginTop: 7 } }, roomRecall.picked.map((row, i) => h("div", { key: row.id || i, style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.sub, lineHeight: 1.65, padding: "6px 0", borderTop: i ? "1px dashed " + t.line : "none" } }, "· " + row.text)))
        : h("div", { style: { marginTop: 8, fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog } }, "这一轮这间房里没有记忆可送。")) : null,
    // 上一轮发过去的聊天记录：它不在 system 那段里，是一条条单独发的，所以单独摆一张（她 2026-11-02）
    cid && window.__histReceipt && window.__histReceipt[cid] ? (() => { const r = window.__histReceipt[cid];
      return h("div", { "data-wk": "histreceipt", style: { border: "1px solid " + t.line, borderRadius: 14, padding: "11px 12px", marginBottom: 10, background: t.bg2 } },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(14px * var(--app-fs, 1))", color: t.ink } }, "上一轮带过去的聊天记录"),
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.sub, marginTop: 4, lineHeight: 1.6 } }, r.n + " 条 · " + r.chars + " 字" + (r.first ? " · 最早一条：「" + r.first + "…」" : "")),
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog, marginTop: 3, lineHeight: 1.55 } }, new Date(r.ts).toLocaleString() + " 那一轮。聊天记录是一条条单独发的，不在下面这些段里；带多少看聊天设置的「记忆上下文条数」和召回设置的「短期窗字符预算」。刷新 App 即清空。"));
    })() : null,
    cid && PUB ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog, lineHeight: 1.6, marginBottom: 8 } },
      "这里列的是你自己那几段（人设、世界书、记忆、近况这些）。App 内置的那几段规矩不在列表里，字数和占比也按列出来的这些算。") : null,
    cid ? secList(secs, PUB ? sumLen(secs) : text.length, () => load(cid), "on") : null,
    // 线下那一轮：真发出去的 system 原件（engine 在发的那一刻留的收据），跟线上同一种拆法、同一张表
    cid && offReceipt ? h("div", { "data-wk": "offsysreceipt", style: { marginTop: 14, paddingTop: 12, borderTop: "1px dashed " + t.line } },
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(14px * var(--app-fs, 1))", color: t.ink } }, "上一轮线下真的发了什么"),
      h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog, lineHeight: 1.55, margin: "3px 0 9px" } },
        new Date(offReceipt.ts).toLocaleString() + " 那一拍线下真正发出去的原件（上面线上那张是此刻重建的预览）。线下的场景正文跟聊天记录一样是单独发的，不在这些段里。刷新 App 即清空。"),
      secList(offSecs, PUB ? sumLen(offSecs) : stripMarks(offReceipt.system).length, () => setOffReceipt(readOffReceipt(cid)), "off")) : null));
}

// ============================================================
// 日记（Diary）——角色私密手账
// ============================================================
function diarySameDay(a, b) {
  const x = new Date(a), y = new Date(b);
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate();
}
const KRAFT = t => {
  if (!/^#[0-9a-f]{6}$/i.test(String(t.ink || ""))) return { background: t.bg };
  const k = t.ink;
  return { background: [
    "repeating-linear-gradient(74deg," + k + "00 0 3px," + k + "09 3px 4px)",
    "repeating-linear-gradient(-66deg," + k + "00 0 5px," + k + "07 5px 6px)",
    "radial-gradient(130% 90% at 50% 50%," + k + "00 52%," + k + "14 100%)",
    t.bg].join(",") };
};
const CARRY_SECTIONS = [
  { key: "bag", zh: "包内", en: "Bag", stuff: true, zip: true },
  { key: "pocket", zh: "口袋", en: "Pocket", stuff: true },
  { key: "outfit", zh: "衣柜", en: "Wardrobe", closet: true },
  { key: "trinket", zh: "珍藏小物", en: "Trinkets", stuff: true },
  { key: "gifts", zh: "收到的礼物", en: "Gifts", gifts: true }
];
// 衣柜的硬边界。件数不写死在提示词里（写死了谁的衣柜都一样满），
// 但上限得由代码守着——模型高兴起来能给一个借住在别人家的人排出四十套。
// v57.85 放宽：单场合 4 套太紧——「上朝」这种场合真讲究的人就是有五六套，
// 而她要的正是「同一个场合也能多几套」。上限只是防模型排出四十套的那道闸，
// 不该反过来替角色决定TA有多少衣服。
// v67.33 再放宽（她 2026-09-12：「衣柜能不能多加可以生成多几套衣服」）：
// 有了「再添几套」那条路之后，这个数管的就不只是【模型一次能给多少】了，
// 而是【她一次次攒起来能攒多少】。⚠️这是渲染时才截的闸——给小了，
// 她刚添上的那几套会在界面上被静默砍掉，人还以为没添进去。
// 天花板是许可不是指标（她 2026-09-12 那句，v67.25 同一条）：
// 用不到的时候它一分钱不花，太低的时候才实打实掐掉她攒的东西。
const CLOSET_MAX_OCCASIONS = 30, CLOSET_MAX_SETS = 50, CLOSET_MAX_TOTAL = 120;   // 她 2026-10-13：「上限放宽点」；2026-10-30 又放到 30 类、每类 50 身（我的衣柜也读这一份）。总数 120 只管 TA 的：那份要进TA的提示词
// 读衣柜：新形状按场合分组，旧形状是一条平的 items。两种都得认得（她手机上已经有旧数据）。
function closetGroups(data) {
  if (!data) return [];
  const raw = Array.isArray(data.closet) ? data.closet : null;
  if (raw) {
    const out = [];
    let total = 0;
    raw.slice(0, CLOSET_MAX_OCCASIONS).forEach(g => {
      if (!g || typeof g !== "object") return;
      const occasion = String(g.occasion || g.name || "").trim();
      const sets = (Array.isArray(g.sets) ? g.sets : []).filter(x => x && String(x.name || "").trim());
      const room = Math.max(0, Math.min(CLOSET_MAX_SETS, CLOSET_MAX_TOTAL - total));
      // ⚠️原来这儿还有一条「没写场合名就整组丢掉」。丢的是【真有衣服的那一组】：
      //   旧的平清单（没有场合这回事）一走 closetMerge 就成了 occasion 为空的那一组，
      //   写回去再读一次，她那几身老衣服当场消失。没有场合名照样挂得出来
      //   （下面渲染那头本来就写着 g.occasion ? 标题 : null），空的是名字不是衣服。
      if (!sets.length || !room) return;
      out.push({ occasion, sets: sets.slice(0, room) });
      total += Math.min(sets.length, room);
    });
    if (out.length) return out;
  }
  // 旧数据：一条平的清单，归到一个没有场合名的组里，照样看得见
  const items = (Array.isArray(data.items) ? data.items : []).filter(x => x && String(x.name || "").trim());
  return items.length ? [{ occasion: "", sets: items.slice(0, CLOSET_MAX_TOTAL) }] : [];
}
// 衣柜里一共几套 / 还塞得下几套。数的是【真会显示出来的那些】，
// 所以一律从 closetGroups 数起，别另写一把尺子。
function closetCount(data) { return closetGroups(data).reduce((n, g) => n + g.sets.length, 0); }
// ⚠️不用再夹一次 0：closetGroups 读出来就已经截在 CLOSET_MAX_TOTAL 上了，
// 数不可能比它大（test/carry-scroll-and-closet-more-67-33 钉着这个关系）。
function closetRoom(data) { return CLOSET_MAX_TOTAL - closetCount(data); }
// 「再添几套」落进衣柜：新的那几身按场合并进老的那一柜，老的一身都不动。
// ⚠️这条路和「重新翻一遍」正相反，别把两者混成一个函数：
//   刷新走 carryEvolveMerge，是【比对着改】，一次最多真换掉两件；
//   这一条是【只添不换】——她按的那个按钮上写的就是「多几套」，不是「换几套」。
// 撞名用的是 carrySameThing（跨栏避重那同一把尺子），免得添回来一身只换了个说法的。
function closetMerge(oldData, addData) {
  const groups = closetGroups(oldData).map(g => ({ occasion: g.occasion, sets: g.sets.slice() }));
  let total = groups.reduce((n, g) => n + g.sets.length, 0);
  const has = nm => groups.some(g => g.sets.some(s => carrySameThing(s.name, nm)));
  closetGroups(addData).forEach(g => {
    let home = groups.find(x => carryNameNorm(x.occasion) === carryNameNorm(g.occasion) && carryNameNorm(g.occasion));
    g.sets.forEach(s => {
      if (total >= CLOSET_MAX_TOTAL || has(s.name)) return;
      if (!home) {
        if (groups.length >= CLOSET_MAX_OCCASIONS) return;
        home = { occasion: g.occasion, sets: [] };
        groups.push(home);
      }
      if (home.sets.length >= CLOSET_MAX_SETS) return;
      home.sets.push(s);
      total++;
    });
  });
  return { ...(oldData || {}), closet: groups };
}
// 一身衣服该怎么称呼（v61.42，她 2026-09-03 报：「陆衍的衣服写成了这个风格，
// 但是别人的都是正常描述是啥衣服，所以看陆衍状态卡就只能看到TA穿着 xx 场合的衣服」）。
//
// 病根在提示词：name 那一栏原来只说「这一身的叫法」，模型于是给了一个【场合名】
//（「日常采购与平价餐厅出行套」）。可场合已经有 occasion 那一栏了——写两遍，
// 等于 name 这一栏是空的。而 name 会顺着 carryContextText 进聊天上下文，
// 模型再照抄进 wearing，状态卡上就成了「TA穿着 xx 场合的衣服」。
//
// 提示词那头改了（说清 name 要写衣服本身）。这儿是代码这一道：
// **已经存下来的坏名字不会自己变好**（衣柜一次最多换两件，钉住的还不换），
// 所以渲染和喂上下文时都过一遍这个函数——认出场合名就退回 note 的头一句。
// 规则降概率，代码才保证。
const GARMENT_RE = /[衣裤裙衫袍褂鞋靴帽袄巾襦裳氅]|T恤|外套|夹克|卫衣|西装|毛衣|针织|大衣|风衣|背心|马甲|长衫|旗袍|衬衫|羽绒|开衫|连帽|牛仔|短打|劲装/;
function outfitLabel(set, occasion) {
  const name = String((set && set.name) || "").trim();
  const note = String((set && set.note) || "").trim();
  if (!name) return note.split(/[，。；,;]/)[0] || "";
  // 名字里有衣服，就是好名字，原样用
  if (GARMENT_RE.test(name)) return name;
  // 没有衣服：note 里要是说清了穿的是什么，拿它头一句顶上
  const first = note.split(/[，。；,;]/).filter(Boolean)[0] || "";
  if (GARMENT_RE.test(first)) return first.trim();
  // note 也说不清（少见）：原样用那个名字。
  // ⚠️别在这儿「把场合前缀切掉」——切出来是「的那套」这种残句，比原名还糟。
  //   名字怪一点是提示词那头的事，代码这一道只负责【有更好的就换上】，不负责硬修。
  return name;
}
// 随身物摘要，喂给角色本人（她 2026-08-29：这一整块以前一个字都不进上下文，
// 是「声明了、生成了、从没被引用过」那个病的原样重演——衣柜里挂着八件衣服，
// 出图时一件都用不上；包里那把伞，聊天里TA掏不出来）。
// 控长：只发【有什么】，不发 thought（那是给她看的私人批注），也不发 note 的全文。
function carryContextText(box, pins, opts) {
  const b = box || {};
  const lines = [];
  const pinOf = k => new Set((((pins || {})[k]) || []).map(x => String(x).replace(/\s+/g, "").trim()));
  const NAMES = { bag: "身上带着", pocket: "口袋里", trinket: "一直收着的" };
  ["bag", "pocket", "trinket"].forEach(k => {
    const p = pinOf(k);
    // 钉住的排前面：那几件是她认定「这个人身上绝不会没有的东西」
    const items = carryFlatItems(k, b[k]).slice()
      .sort((a, c) => (p.has(carryItemKey(c)) ? 1 : 0) - (p.has(carryItemKey(a)) ? 1 : 0));
    const names = items.slice(0, 8).map(it => String(it.name).trim()).filter(Boolean);
    if (names.length) lines.push("· " + NAMES[k] + "：" + names.join("、"));
  });
  const groups = closetGroups(b.outfit);
  if (groups.length) {
    const rows = groups.slice(0, 5).map(g => (g.occasion ? g.occasion + "：" : "") + g.sets.slice(0, 4).map(x => outfitLabel(x, g.occasion)).filter(Boolean).join("、"));
    lines.push("· 衣柜里：" + rows.join("；"));
  }
  if (!lines.length) return "";
  const cap = Math.max(120, Number(opts && opts.cap) || 700);
  const out = lines.join("\n");
  return out.length > cap ? out.slice(0, cap) + "…" : out;
}
const clothHex = h6 => {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(h6 || ""));
  if (!m) return [180, 175, 165];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
// 往白（k>0）或往黑（k<0）混，用来给同一块布做出受光面和垂坠的暗部。
// 返回 hex 而不是 rgb()，这样算出来的色还能再交给 clothRgba 兑透明度。
const clothShift = (hex, k) => {
  const [r, g, b] = clothHex(hex);
  const to = k >= 0 ? 255 : 0, a = Math.abs(k);
  const mix = c => Math.round(c + (to - c) * a).toString(16).padStart(2, "0");
  return "#" + mix(r) + mix(g) + mix(b);
};
// 布够不够深——决定钉住那个记号该用浅色还是深色画在布上
const clothIsDark = hex => {
  const [r, g, b] = clothHex(hex);
  return (r * 299 + g * 587 + b * 114) / 1000 < 150;
};
function toneOf(base) {
  const onDark = clothIsDark(base);
  return {
    base,
    light: clothShift(base, 0.22),
    dark: clothShift(base, -0.16),
    dark2: clothShift(base, -0.3),
    onDark,
    // 这块色的墨：够深到能当文字和描边用。直接拿 dark 会出事——
    // 月白、素色那种浅布的 dark 仍旧是浅的，写在浅底上根本看不见（实测踩到）。
    ink: onDark ? base : clothShift(base, -0.55)
  };
}
// 给出图端的衣柜：比聊天那份更细（要料子和颜色，出图看的就是这些），但仍要控长。
function carryClosetText(box, cap) {
  const groups = closetGroups(box && box.outfit);
  if (!groups.length) return "";
  const rows = [];
  groups.slice(0, 5).forEach(g => {
    g.sets.slice(0, 3).forEach(x => {
      const nm = String(x.name || "").trim();
      if (!nm) return;
      const note = String(x.note || "").replace(/\s+/g, " ").trim().slice(0, 60);
      rows.push("· " + (g.occasion ? "【" + g.occasion + "】" : "") + nm + (note ? "：" + note : ""));
    });
  });
  const out = rows.join("\n");
  const lim = Math.max(120, Number(cap) || 600);
  return out.length > lim ? out.slice(0, lim) + "…" : out;
}
// ── 随身物的四层（照查手机那套落，见 施工规则/phone-data-layers.md）──────
// 判据一：这一栏变了，是「TA变了」还是「系统忘了」？
// 随身物比手机更该稳：你身上带着的东西本来就是几个月不动的，
// 刷一次全换掉＝换了个人（她 2026-08-29 点名的病）。所以这里【没有 ♻️ 层】：
//   🔒 = 她亲手钉住的那几件（那块玉、那把刀）＋ 收到的礼物（本来就永久）
//   🌱 = 四栏物品，默认沿用，一次最多真换掉两件
// 钉住这件事只能由她来做：随身物没有「号码/账号 id」那种客观的硬字段，
// 唯一说得清「这件绝不许换」的人是她。
const CARRY_CHURN = 2;
const carryItemKey = it => String((it && it.name) || "").replace(/\s+/g, "").trim();
// 把一栏里的所有条目摊平（衣柜是分组的，别的是平的），改动统计和钉住共用同一把尺子
function carryFlatItems(key, data) {
  if (!data) return [];
  if (key === "outfit") return closetGroups(data).reduce((a, g) => a.concat(g.sets), []);
  return (Array.isArray(data.items) ? data.items : []).filter(x => x && String(x.name || "").trim());
}
// 🌱 收口：模型交回来的这一份，和上一份比对着改
function carryEvolveMerge(key, oldData, newData, pinned) {
  if (!oldData || !newData || typeof newData !== "object") return newData;
  const oldItems = carryFlatItems(key, oldData);
  if (!oldItems.length) return newData;
  const pins = new Set((pinned || []).map(x => String(x).replace(/\s+/g, "").trim()).filter(Boolean));
  const newKeys = new Set(carryFlatItems(key, newData).map(carryItemKey));
  // ① 钉住的那几件一件都不许掉——模型漏了就原样补回去
  const missingPins = oldItems.filter(it => pins.has(carryItemKey(it)) && !newKeys.has(carryItemKey(it)));
  // ② 一次最多真换掉 CARRY_CHURN 件；换多了的，把旧的补回来
  const gone = oldItems.filter(it => !pins.has(carryItemKey(it)) && !newKeys.has(carryItemKey(it)));
  const putBack = missingPins.concat(gone.slice(0, Math.max(0, gone.length - CARRY_CHURN)));
  if (!putBack.length) return newData;
  if (key === "outfit") {
    const groups = closetGroups(newData).map(g => ({ occasion: g.occasion, sets: g.sets.slice() }));
    // ⚠️补回来的那几身要回到【它原来挂的那一格】。原来一律塞进 groups[0]，
    //   于是刷一次，TA的朝服就挂到「在家」那一格去了；衣柜越大这事越显眼
    //   （v67.33 加了「再添几身」之后，柜子本来就会攒大）。
    const was = {};
    closetGroups(oldData).forEach(g => g.sets.forEach(it => { was[carryItemKey(it)] = g.occasion; }));
    putBack.forEach(it => {
      const occ = was[carryItemKey(it)] || "";
      let home = occ ? groups.find(g => g.occasion === occ) : null;
      if (!home) {
        // 那一格整个被模型删掉了：连格子一起补回来，别把衣服倒进别人那一格
        if (occ) { home = { occasion: occ, sets: [] }; groups.push(home); }
        else home = groups[0] || (groups[0] = { occasion: "", sets: [] });
      }
      home.sets.push(it);
    });
    return { ...newData, closet: groups };
  }
  return { ...newData, items: carryFlatItems(key, newData).concat(putBack) };
}
// 旧的那一份要喂回提示词：不说清楚「上次身上是这些」，模型每次都从零编一个人
function carryKnownBlock(key, oldData, pinned) {
  const items = carryFlatItems(key, oldData);
  if (!items.length) return "";
  const pins = new Set((pinned || []).map(x => String(x).replace(/\s+/g, "").trim()).filter(Boolean));
  const pinNames = items.filter(it => pins.has(carryItemKey(it))).map(it => it.name);
  let out = "\n\n【上一次翻TA这一栏，里面是这些】\n" + items.map(it => "· " + it.name + (it.note ? "（" + String(it.note).replace(/\s+/g, " ").slice(0, 40) + "）" : "")).join("\n")
    + "\n**默认原样照抄回来**——一个人身上带的东西本来就是几个月不变的，不是每次翻都换一套。"
    + "\n这一次最多换掉两件，而且要有理由（用完了、丢了、坏了、换季了、最近发生的事让TA添了一件）；没有理由就一件都别动。"
    + "\n照抄的那些名字要逐字一样，别改写成近义词——改了名字就等于换了一件。";
  if (pinNames.length) out += "\n\n【这几件她钉住了，绝对不许换掉、不许改名】\n" + pinNames.map(x => "· " + x).join("\n");
  return out;
}
// 「TA最近真到手的东西」：网购签收的 + 她送到的礼物。不直接塞成条目——
// 那会长成一座只进不出的数据坟场；而是当【素材】喂进去，让模型自己把该随身带的
// 那几件自然编进包里/衣柜里（她 2026-08-29：和购物/钱包接上）。
function carryMaterialBlock(key, material) {
  const bought = (material && material.bought) || [];
  const gifts = (material && material.gifts) || [];
  if (!bought.length && !gifts.length) return "";
  let out = "\n\n【TA最近真到手的东西】（这些是真花过钱、真送到手的，不是让你罗列）";
  if (bought.length) out += "\n· TA自己买的：" + bought.slice(0, 10).join("、");
  if (gifts.length) out += "\n· 她送的：" + gifts.slice(0, 8).join("、");
  out += "\n里面**如果有该随身带着 / 该挂进衣柜的**，就自然写进这一栏（用TA自己的叫法，note 里可以带上「哪儿来的」）。"
    + "\n消耗掉的、用不上的、和这一栏不搭的，就别硬塞——**没有一件对得上就一件都不写**，这不是清单核对。";
  return out;
}
// 同一件东西只能待在一个地方。四栏各自生成、谁也不知道别栏写过什么，
// 于是同一个立牌、同一枚徽章、同一个小本子在「包内」和「珍藏小物」里各出现一遍
//（她 2026-08-29 真机截图）。查手机那边一直有跨 app 的避重，这里以前一条都没有。
// 名字规范化：去掉空格和括号里的补充（「立牌（未拆封）」和「立牌」是同一件）
const carryNameNorm = n => String(n || "").replace(/[（(【\[][^）)】\]]*[）)】\]]/g, "").replace(/[\s·，,。、]/g, "").trim();
// 两件东西算不算同一件：规范化后相等，或者【长的那个包住短的】且短的够长
//（「伞」这种一个字的不做包含判断，否则「伞」会吃掉「油纸伞」和「阳伞」两件不同的东西）
function carrySameThing(a, b) {
  const x = carryNameNorm(a), y = carryNameNorm(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const short = x.length <= y.length ? x : y, long = short === x ? y : x;
  return short.length >= 4 && long.indexOf(short) >= 0;
}
// 别栏已经有的那些（含礼物——你送的东西也不该在包里再冒出来一次）
function carryElsewhere(key, box, gifts) {
  const out = [];
  Object.keys(box || {}).forEach(k => {
    if (k === key) return;
    carryFlatItems(k, box[k]).forEach(it => { if (it && it.name) out.push({ where: k, name: it.name }); });
  });
  (gifts || []).forEach(g => { if (g && g.name) out.push({ where: "gifts", name: g.name }); });
  return out;
}
function carryAvoidBlock(rows) {
  if (!rows || !rows.length) return "";
  const zh = { bag: "包内", pocket: "口袋", outfit: "衣柜", trinket: "珍藏小物", gifts: "收到的礼物" };
  const by = {};
  rows.slice(0, 40).forEach(r => { (by[r.where] = by[r.where] || []).push(r.name); });
  return "\n\n【这些东西已经在TA别处了，一件都别再写】\n"
    + Object.keys(by).map(k => "· " + (zh[k] || k) + "：" + by[k].join("、")).join("\n")
    + "\n**同一件东西只能待在一个地方。**哪怕你觉得某件更该归这一栏，也不许在这儿重写一遍——"
    + "换一件真正属于这一栏的；实在没有可换的，就少写一件。";
}
// 代码这一道：模型照样会重复，写进去之前把撞名的删掉。新生成的让步给已经在别处的。
function carryDedupe(key, data, elsewhere) {
  if (!data || !elsewhere || !elsewhere.length) return data;
  const dup = it => elsewhere.some(r => carrySameThing(r.name, it && it.name));
  if (key === "outfit") {
    const groups = closetGroups(data).map(g => ({ occasion: g.occasion, sets: g.sets.filter(x => !dup(x)) })).filter(g => g.sets.length);
    return { ...data, closet: groups };
  }
  const items = carryFlatItems(key, data).filter(x => !dup(x));
  return { ...data, items };
}
function carryProbeSpec(key, char, known, pinned, material, elsewhere) {
  const nm = char.name;
  const tail = "每件除了 name、note(一句状态/来历) 外，再写 thought：「" + nm + "」对这件东西的私人想法/批注（为什么带它、和谁有关、藏了什么心事），点开细看用，贴人设、可以更私密。**thought 每件都要写完整，别写一半。**";
  // 件数不再写死。写死了「正好 5 件」，一个身无长物的人也被逼着凑满五件——
  // 而【TA有多少东西】本身就是人物信息（她 2026-08-29：衣柜大小跟人设走）。
  const many = characterText(char, "**有几件由这个人决定**：他的身份、处境、讲究程度、有没有条件置办——揣着最后几个铜板的人和王府里的人，不该翻出一样多的东西。少也要少得有道理，别为了凑数硬编。");
  const hint = "{\"items\":[{\"name\":\"物品\",\"note\":\"备注\",\"thought\":\"TA 对这件东西的私人想法\"}]}";
  const S = {
    // ⚠️这三栏的分工必须说死。原先写的是「包里/随身携带的东西」「随身的小物件/珍藏」——
    // 界限模糊，于是同一个立牌、同一枚徽章、同一个小本子在两栏里各写了一遍
    //（她 2026-08-29 真机截图）。判据是【为什么它在TA身上】：要用 / 摸得到 / 舍不得。
    bag: {
      instruction: "推演「" + nm + "」此刻包里带着的东西。"
        + characterText(char, "\n【这一栏的判据：他【出门要用】的东西】拿走它，他今天某件事就办不成——干活的家伙、路上要吃要喝的、")
        + "要交给谁的、防着天气的。**不写那些纯粹因为舍不得才带着的**，那些归「珍藏小物」。" + many + tail,
      schemaHint: hint
    },
    pocket: {
      instruction: "推演「" + nm + "」口袋里的零碎小东西。"
        + characterText(char, "\n【这一栏的判据：伸手就摸得到】小到能一直揣着、掏出来不费事，而且他常常无意识地摸到它——")
        + "钥匙、票根、糖、揉皱的纸、硬币这一类。**不写包里那些要翻半天才拿得出来的**。" + many + tail,
      schemaHint: hint
    },
    trinket: {
      instruction: "推演「" + nm + "」一直收着的那几样小东西。"
        + characterText(char, "\n【这一栏的判据：一点用都没有，他还是带着】它办不成任何事，留着只因为它牵着一个人、一件事、一段日子。")
        + "**能派上用场的一律不写**，那些归「包内」或「口袋」。这一栏宁可只有两三件，也不许拿有用的东西凑数。" + many + tail,
      schemaHint: hint
    },
    // 衣柜按【场合】分组，同一个场合可以有好几套（她 2026-08-29）：
    // 一个人在同一种场合下反复挑中的那几套，正是「TA有偏好」的证据。
    outfit: {
      instruction: "推演「" + nm + "」的衣柜，按【场合】分组。"
        + characterText(char, "\n【衣柜有多大由这个人决定】场合分几类、每类有几套，全看他的身份、处境、有没有条件置办、讲不讲究——")
        + "王府里的人和借住在别人家的人，衣柜不该一样大。**衣柜的规模本身就是人物信息**，别把谁都排成满满一柜。"
        + characterText(char, "\n【同一个场合可以有好几套】他在同一种场合下反复挑中的那几套，彼此只有细微差别（颜色、料子、新旧、配的东西不同）——")
        + "那正是一个人有偏好的证据。真讲究的人这里就该厚，不在乎穿什么的人一个场合一套也够。"
        + characterText(char, "\n【场合怎么分】按他真过的日子分，不是按季节表分：他每天要去的地方、要见的人、要撑的场面、独自在家的时候、以及那些不常有但一定得有的场合。场合名要带上他那个世界的说法。")
        + "\n【name 写的是衣服本身，不是场合】场合已经有 occasion 那一栏了，name 再写一遍场合，这一栏就等于空的。"
        + characterText(char, "name 要让人光看它就想象得出他身上穿的是什么：主件是什么、什么颜色或料子、怎么搭的。")
        + characterText(char, "判据一句话：**把 note 盖住只看 name，能不能看出他穿的是什么？** 看不出就是写坏了。")
        + "\nnote 再补：由什么组成、什么料子颜色、什么时候穿、哪儿来的。" + tail,
      schemaHint: "{\"closet\":[{\"occasion\":\"场合\",\"sets\":[{\"name\":\"这一身穿的是什么衣服（主件+颜色或料子+怎么搭），不许写成场合名\",\"note\":\"由什么组成/料子颜色/什么时候穿/哪儿来的\",\"thought\":\"TA 对这一身的私人想法\"}]}]}"
    }
  };
  const spec = S[key] || S.bag;
  return {
    maxTokens: key === "outfit" ? 14000 : 12000,
    ...spec,
    // 🌱：上一份原样喂回去，钉住的点名不许动
    instruction: spec.instruction + carryMaterialBlock(key, material)
      + carryAvoidBlock(elsewhere) + carryKnownBlock(key, known, pinned)
  };
}
// 「再添几套」那一枪（她 2026-09-12：「衣柜能不能多加可以生成多几套衣服」）。
//
// ⚠️为什么不能拿「重新翻一遍」那一枪凑合：那一枪带的是 carryKnownBlock，
//   里头写着「**默认原样照抄回来**、这一次最多换掉两件」——照抄回来的东西
//   在这条路上全是废话，而「最多换两件」正是她要的反面。她按这个按钮的意思是
//   【多几身】，不是【换几身】，所以这一枪只要新的那几身。
// ⚠️已经挂着的那几身要点名列出来「别再写一遍」：不列的话它会把老的重写一遍，
//   撞名全被 closetMerge 挡掉，一枪白打。
function closetMoreSpec(char, known, room, material, elsewhere, keywords) {
  const nm = char.name;
  const have = closetGroups(known);
  const list = have.map(g => "· 〔" + (g.occasion || "没写场合") + "〕" + g.sets.map(x => x.name).join("、")).join("\n");
  const want = Math.max(1, Math.min(5, room));
  return {
    maxTokens: 65000,
    schemaHint: "{\"closet\":[{\"occasion\":\"场合\",\"sets\":[{\"name\":\"这一身穿的是什么衣服（主件+颜色或料子+怎么搭），不许写成场合名\",\"note\":\"由什么组成/料子颜色/什么时候穿/哪儿来的\",\"thought\":\"TA 对这一身的私人想法\"}]}]}",
    instruction: "给「" + nm + "」的衣柜再添几身衣服，**只写新添的那几身**。"
      // 她点名要的就照着配（她 2026-10-14：「比如我要生成女仆装给他们可以吗，理论上算 ooc，正常他们也不会买来穿」）——
      //   关键词说了算，不拿「像不像他会买的」去改她要的东西；不像他会自己置办的，就在 note 里写清这身是怎么进他柜子的。
      + (keywords ? "\n\n【她给的关键词】" + keywords + "\n这一次添的就照这几个词来，她要什么款式就是什么款式。"
          + characterText(char, "要是这身不像他自己会去买的，照样添，只在 note 里写清它是怎么进他柜子的（谁送的、活动发的、被起哄换上的、她给他挑的……），这样他穿上时也有个说法。") : "")
      + (list ? "\n\n【柜子里已经挂着这些】\n" + list
          + "\n新添的要和上面这些真的是两回事——不是同一件换个颜色，也不是同一句话换个说法。" : "")
      + characterText(char, "\n\n【添在哪个场合由这个人决定】可以补进上面已经有的场合——同一种场合下他反复挑中的那几身，")
      + "彼此只有细微差别（料子、新旧、配的东西不同），那正是一个人有偏好的证据；"
      + characterText(char, "也可以开一个他日子里本来就有、柜子里却还空着的场合。")
      + "\n【这一次写 1~" + want + characterText(char, " 身】他是个什么处境的人就添什么样的衣服：置办得起几身、讲不讲究、")
      + characterText(char, "最近过的日子让他多了什么。真添得出几身就写几身，添不出那么多就少写。")
      + "\n【补进老场合时，occasion 要和上面列的那个逐字一样】写岔一个字就另开一格了。"
      + characterText(char, "\n【name 写的是衣服本身，不是场合】判据一句话：**把 note 盖住只看 name，能不能看出他穿的是什么？**")
      + "\nnote 再补：由什么组成、什么料子颜色、什么时候穿、哪儿来的。"
      + "每身还要写 thought：「" + nm + "」对这一身的私人想法（什么场合会挑它、和谁有关、藏了什么心事），点开细看用，贴人设、可以更私密。"
      + carryMaterialBlock("outfit", material) + carryAvoidBlock(elsewhere)
  };
}
// 四栏【一次写完】（她 2026-08-30：「能不能全部做 1 次调用而不是每一个一次，
// 因为它每个内容确实不是很多」）。四次串行 → 一次，省四刀。
//
// ⚠️顺带解决掉一个本来就难治的病：分四次时，每一栏都不知道另外三栏写了什么，
// 只能把别栏已有的塞进 carryAvoidBlock 说「别再写一遍」——那是事后补救，
// 而且「刷新全部」那条路上 carryRef 还慢一帧，正好是最容易撞名的一条。
// 一次写完之后，四栏在【同一次思考】里分配，重复从「靠提示词拦」变成「压根不会发生」。
// 代码那道 carryDedupe 仍然留着（规则降概率，代码才保证）。
function carryProbeSpecAll(char, known, pinned, material) {
  const nm = char.name;
  const one = k => carryProbeSpec(k, char, null, null, "", null);
  const secs = ["bag", "pocket", "trinket", "outfit"];
  const body = secs.map(function (k) {
    const sec = CARRY_SECTIONS.find(function (x) { return x.key === k; }) || {};
    // 各栏的判据原样搬过来，只把「推演…」那个开头换成小标题——判据本身是防串栏的关键
    // 剥掉「推演「某某」」那个开头；衣柜那条原文是「推演「某某」的衣柜…」，
    // 不连着把「的」也剥掉就成了「〔衣柜〕的衣柜，按场合分组」
    return "\n\n〔" + sec.zh + "〕" + one(k).instruction.replace(/^推演「[^」]*」的?/, "");
  }).join("");
  return {
    // 四栏一起出，token 得给够：分开写是四次调用，合起来一次就得抵四次的量
    // （v59.96 起单栏那条是 12000/14000，见 施工规则/max-tokens-floor.md）
    maxTokens: 24000,
    schemaHint: "{\"bag\":{\"items\":[{\"name\":\"物品\",\"note\":\"备注\",\"thought\":\"TA 对这件东西的私人想法\"}]},"
      + "\"pocket\":{\"items\":[...同上]},\"trinket\":{\"items\":[...同上]},"
      + "\"outfit\":{\"closet\":[{\"occasion\":\"场合\",\"sets\":[{\"name\":\"这一身穿的是什么衣服（主件+颜色或料子+怎么搭），不许写成场合名\",\"note\":\"由什么组成/料子颜色/什么时候穿/哪儿来的\",\"thought\":\"TA 对这一身的私人想法\"}]}]}}",
    instruction: "一次推演「" + nm + "」身上和柜子里的四栏东西：包内、口袋、珍藏小物、衣柜。"
      + "\n\n⚠️【同一件东西只许出现在一栏里】四栏是一起写的，你自己分配好：一件东西是「出门要用」「伸手摸得到」"
      + "还是「没用但舍不得」，按下面每一栏的判据挑一栏放，别在两栏里各写一遍、也别换个说法写两遍。"
      + body
      + carryMaterialBlock("all", material)
      + secs.map(function (k) {
          const kn = known && known[k];
          const pn = pinned && pinned[k];
          const z = (CARRY_SECTIONS.find(function (x) { return x.key === k; }) || {}).zh || k;
          return (kn || (pn && pn.length)) ? "\n\n〔" + z + " · 上一次是这些〕" + carryKnownBlock(k, kn, pn) : "";
        }).join("")
  };
}
