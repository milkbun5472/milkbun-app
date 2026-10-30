// ============================================================
// CAST + form
// ============================================================
// 角色卡一键导入（v48.30 搬家器；v58.46 大修）：整篇卡粘进来 → 自动拆 名字/一句话/人设/长期记忆/记忆库种子。
// 她 2026-08-30：「导入角色卡那个格式还是有点不对劲，经常导入了格式还是不对」。原来那版只认两种东西：
// 「# 名字 · 角色卡」这一种标题，和「##」这一级分节。别的一律走「整篇当人设」的兜底——
// 于是酒馆导出的 JSON 会被原样当人设塞进去（连大括号一起），{{char}}/{{user}} 占位符原样留着，
// 例句脚手架（<START>、mes_example）也一起进去跟 app 自己的手机机制打架。

// {{char}} / {{user}} 这类占位符 app 不认，导入时就换掉，不要留给她手动改
// 外语也挂「译」（她 2026-10-17：「没接上的翻译地方也都接上去」）：论坛、情侣空间、日记这些 TA 写的字，
//   跟查手机同一个壳（PTX → TransText）：探得出外语才挂「译」，中文原样返回。
// 论坛、空间里那一段是哪个角色写的：包一层 TransWho，那个人开着「自带中译」就直接摆中文（components.js TransText）
function STX(v) {
  // 已经是元素／数组（整页正文、一排按钮）就原样放过——String() 了就是一行「[object Object]」，还会挂上「译」（2026-10-17 群友截图）
  if (v && typeof v === "object") return v;
  const s = String(v == null ? "" : v);
  if (!s) return s;
  return typeof TransText === "function" ? h(TransText, { text: s, ink: "currentColor", inline: true }) : s;
}
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
// 酒馆卡里的例句脚手架：<START> 之后那一段是「示范怎么对话」，不是这个人是谁。
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
// 酒馆卡（v1 扁平 / v2 带 data / 直接一个对象）：认出来就按字段拆，不要整坨当人设
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
const CARD_SEC_RE = /^[ \t]*(?:#{1,6}[ \t]*([^\n]+)|\*\*([^\n]+?)\*\*([^\n]*)|[【\[〔]([^\n]+?)[】\]〕]([^\n]*)|([一-龥A-Za-z][一-龥A-Za-z0-9_ ]{0,13})[ \t]*[:：]([^\n]*))$/gm;
// 带冒号那一种太宽（正文里随便一行「TA说：」也像），所以只认这些词
const CARD_SEC_KWS = ["人设", "设定", "简介", "描述", "长期记忆", "初始记忆", "记忆库种子", "记忆种子", "种子", "记忆库", "开场白", "问候语", "第一句", "一句话", "标签", "外貌", "persona", "description", "memory", "greeting"];
// 把一篇文档按分节标题切开：角色卡导入和跑团剧本导入共用这一把刀（one-public-mechanism）。
// colonKws：带冒号那一支只认这些词，别把正文里的「TA说：」当成分节
function splitDocSections(text, colonKws) {
  const secs = [];
  let last = null, mm;
  const push = (sec, until) => secs.push({ title: sec.title, body: (sec.pre ? sec.pre + "\n" : "") + text.slice(sec.end, until).trim() });
  CARD_SEC_RE.lastIndex = 0;
  while ((mm = CARD_SEC_RE.exec(text))) {
    const title = (mm[1] || mm[2] || mm[4] || mm[6] || "").trim().replace(/[:：]$/, "").trim();
    const pre = (mm[3] || mm[5] || mm[7] || "").trim().replace(/^[:：]/, "").trim();
    if (mm[6] && !(colonKws || []).some(k => title.toLowerCase().includes(k))) continue;
    if (!title) continue;
    if (last) push(last, mm.index);
    last = { title: title, pre: pre, end: mm.index + mm[0].length };
  }
  if (last) push(last, text.length);
  return secs;
}
function parseCharCard(raw, userName) {
  const text0 = String(raw || "").replace(/\r/g, "");
  const asJson = cardFromJSON(text0);
  const out = asJson || { name: "", tagline: "", persona: "", longMem: "", seeds: [], greeting: "", hadExample: false, from: "text" };
  if (!asJson) {
    const text = text0;
    // 「# X · 角色卡」「名字：X」「【姓名】X」「**姓名**：X」「名字「X」」，最后才退到第一个 # 标题
    // 「# X · 角色卡」：只在一行里找，名字里不带空格以外的分隔——原来 \s* 能跨行、又跟名字那段的空格重叠，长串空格回溯卡死
    let m = text.match(/^#[ \t]*([^\n·#|｜ \t][^\n·#|｜]{0,40}?)[ \t]*(?:[·|｜][ \t]*)?角色卡/m)
      || text.match(/^[ \t]*(?:#{1,6}[ \t]*)?(?:(?:\*\*|[【\[〔])[ \t]*)?(?:名字|姓名|角色名|人物名|name)[ \t]*(?:(?:\*\*|[】\]〕])[ \t]*)?(?:[:：][ \t]*)?[「"'\[]?([^\n」"'\]]{1,20})/im)
      || text.match(/名字[「"']([^」"']+)[」"']/)
      || text.match(/^#[ \t]*([^\n#]{1,20})[ \t]*$/m);
    if (m) out.name = m[1].trim().replace(/[*_`]/g, "");
    const secs = splitDocSections(text, CARD_SEC_KWS);
    const find = kws => secs.find(s => kws.some(k => s.title.toLowerCase().includes(k)));
    // 先挑种子再挑长期记忆：「记忆库种子」里也含着「记忆」两个字
    const sSec = find(["记忆库种子", "记忆种子", "记忆库", "种子"]);
    const mSec = secs.find(s => !(sSec && s === sSec) && ["长期记忆", "初始记忆"].some(k => s.title.includes(k)));
    const pSec = find(["人设", "设定", "描述", "persona", "description"]);
    const gSec = find(["开场白", "问候语", "第一句", "greeting"]);
    const tSec = find(["一句话", "标签", "tagline"]);
    if (pSec) out.persona = pSec.body.trim();
    if (mSec) out.longMem = mSec.body.trim();
    if (gSec) out.greeting = gSec.body.trim();
    if (tSec) out.tagline = tSec.body.trim().split("\n")[0].slice(0, 40);
    if (sSec) {
      out.seeds = sSec.body.split(/\n(?=\d+[\.、．)]\s*)/).map(x => x.replace(/^\d+[\.、．)]\s*/, "").replace(/\s+/g, " ").trim()).filter(x => x.length > 4).map(x => {
        const pinned = /[〔\[【]\s*置顶\s*[〕\]】]/.test(x);
        return { text: x.replace(/[〔\[【]\s*置顶\s*[〕\]】]/g, "").trim(), pinned };
      });
    }
    if (!out.persona) out.persona = text.trim(); // 没认出结构：整篇当人设，名字留给她改
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
  const importFile = async e => {
    const input = e.target, file = input.files && input.files[0];
    input.value = "";
    if (!file) return;
    setFileBusy(true); setFileErr("");
    try {
      if (/\.doc$/i.test(file.name || "")) throw new Error("老的 .doc 读不了，在 Word 里另存为 .docx 再导");
      if (!/\.(docx|txt|md|markdown|json)$/i.test(file.name || "")) throw new Error("请选择 .docx / .txt / .md / .json 文件");
      const text = await readOfflineStyleDocument(file);
      if (!String(text || "").trim()) throw new Error("文件里没有可导入的文字");
      setTxt(text); setEdits({});
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
        "整篇粘进来，或者直接选文件（.docx / .txt / .md / .json）。认得出常见 JSON 角色卡（v1/v2，卡里的世界书收成只给 TA 的世界书词条），也认「# / ## / **加粗** / 【】」这几种分节。{{char}}/{{user}} 会自动换掉，<START> 之后的对话示例不导入。拆得不对就在下面的预览里直接改。"),
      h("button", {
        onClick: () => fileRef.current && fileRef.current.click(), disabled: fileBusy,
        className: "w-full active:opacity-70",
        style: { marginBottom: 10, background: "transparent", color: t.ink, border: "1px solid " + t.line, borderRadius: 12, padding: "10px 0", fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))" }
      }, fileBusy ? "正在读文件…" : "从文件导入"),
      h("input", { ref: fileRef, type: "file", accept: ANY_FILE, style: { display: "none" }, onChange: importFile }),
      fileErr ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.accent || t.ink, marginBottom: 8 } }, fileErr) : null,
      h("textarea", { "data-wk": "textarea", value: txt, onChange: e => { setTxt(e.target.value); setEdits({}); }, rows: 10, placeholder: "在这里粘贴整篇角色卡…", style: { width: "100%", background: t.bg2, border: "1px solid " + t.line, borderRadius: 12, padding: "11px 13px", fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.ink, resize: "none", lineHeight: 1.6 } }),
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
            longMem: val("longMem").trim(), greeting: val("greeting").trim(), seeds: textToSeeds(val("seeds"))
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
// ── 还剩那几页米白的底（v62.99，审美审计还债收尾）───────────────────────
// 先复用：导卡回档案馆那张桌子（DESK）、日记文风页回日记那张纸、随身物两个柜子页
// 回主页那块布、第一次们回情侣空间那本本子内页。真没有现成材质可搬的才新画，
// 而且新画的这三张都得跟库里已有的分得开（纸/布/皮/绒/牛皮/离型纸都占过了）。
// ⚠️深色/自定义主题下 t.ink 未必是六位色号，拼透明度后缀会拼出废值、整层静默消失。
const _hex6 = t => /^#[0-9a-f]{6}$/i.test(String(t.ink || ""));
// 情书：航空信封那圈斜条边——一道道细斜纹，跟横格的日记本、竖格的字据一眼分得开。
// ⚠️两页共用一处（我们的情书 / 情书设置）：抄成两份的话，改一处另一处就落单了。
//   斜纹用的是定死的 rgba，不吃 t.ink，所以不需要 _hex6 那道保险。
const letterSkin = t => ({ background: t.bg,
  backgroundImage: "repeating-linear-gradient(45deg,rgba(176,141,82,.055) 0 5px,rgba(0,0,0,0) 5px 13px,rgba(150,90,90,.04) 13px 18px,rgba(0,0,0,0) 18px 26px)" });
// 抽卡：一整包还没拆的卡——锡箔纸，斜着一道道会跳的反光
const foilSkin = t => {
  if (!_hex6(t)) return { background: t.bg };
  const k = t.ink;
  return { background: [
    "repeating-linear-gradient(102deg," + k + "00 0 7px," + k + "0a 7px 8px," + k + "00 8px 15px,rgba(255,255,255,.36) 15px 16px)",
    "linear-gradient(66deg,rgba(255,255,255,.30) 0%," + k + "00 22%,rgba(255,255,255,.22) 44%," + k + "00 64%,rgba(255,255,255,.26) 86%," + k + "00 100%)",
    "radial-gradient(120% 80% at 50% 45%," + k + "00 50%," + k + "18 100%)",
    t.bg].join(",") };
};
// 照相馆：影棚那张无缝背景纸——顶上一束光，底下一道弯折接到地台
const cycSkin = t => {
  if (!_hex6(t)) return { background: t.bg };
  const k = t.ink;
  return { background: [
    "linear-gradient(180deg," + k + "00 0 62%," + k + "0e 74%," + k + "04 78%," + k + "14 100%)",
    "radial-gradient(80% 52% at 50% 15%,rgba(255,255,255,.55),rgba(255,255,255,0) 70%)",
    "radial-gradient(120% 88% at 50% 40%," + k + "00 46%," + k + "1c 100%)",
    t.bg].join(",") };
};
// 配角的简介：默认收两行，点一下展开【全文】，还能就地改（她 2026-08-25：
// 「简介打不开看全部」）。配角没有自己的资料页，所以读和改都得落在这儿。
function NpcBrief({ npc, onSave, compact, defaultOpen }) {
  const t = useTheme();
  const [open, setOpen] = useState(!!defaultOpen);   // 通讯录配角详情页一进来就摊开全文
  const [draft, setDraft] = useState(null);
  const text = String(npc.persona || "").trim();
  return h("div", { style: { marginTop: compact ? 2 : 8 } },
    h("button", {
      onClick: e => { e.stopPropagation(); setOpen(o => !o); setDraft(null); },
      className: "w-full text-left active:opacity-60"
    },
      h("div", {
        style: {
          fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", lineHeight: 1.55, color: t.fog, whiteSpace: "pre-wrap",
          ...(open ? {} : { display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" })
        }
      }, text || "（还没有简介）"),
      h("span", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.tint, display: "inline-block", marginTop: 4 } },
        open ? "收起" : "展开简介")),
    open && onSave ? h("div", { style: { marginTop: 8 } },
      draft == null
        ? h("button", { onClick: e => { e.stopPropagation(); setDraft(text); }, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.tint } }, "✏️ 改简介")
        : h("div", null,
            h("textarea", {
              value: draft, onChange: e => setDraft(e.target.value), rows: 10,
              onClick: e => e.stopPropagation(),
              className: "w-full bg-transparent outline-none resize-none",
              style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", lineHeight: 1.6, color: t.ink, border: "1px solid " + t.line, borderRadius: 10, padding: "8px 10px" }
            }),
            h("div", { className: "flex gap-2", style: { marginTop: 6 } },
              h("button", { onClick: e => { e.stopPropagation(); onSave(npc.id, draft); setDraft(null); }, className: "active:opacity-70", style: { background: t.ink, color: t.bg2, border: "none", borderRadius: 9, padding: "7px 16px", fontFamily: F_DISPLAY, fontSize: "calc(13px * var(--app-fs, 1))" } }, "保存"),
              h("button", { onClick: e => { e.stopPropagation(); setDraft(null); }, style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.fog, padding: "7px 8px" } }, "取消")))) : null);
}

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
function forumBoardsShown() { const hid = forumBoardPrefs().hidden; return forumBoardsAll().filter(n => hid.indexOf(n) < 0); }
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
// 她 2026-09-02：「这几样 category 改一下，我之前是参考了别人的」。
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

// ============================================================
// US (couple)
// ============================================================
// 情侣空间·问答小本预置题库（60 条，五类+深题+日常温度）。
// id 是稳定主键：已答记录靠它对齐；以后只往后加题、不改/不复用旧 id。
// love: 1＝恋人才问的题（心动、想抱、确定是认真的……）：闺蜜 / 挚友 / 家人空间翻不到
const COUPLE_QA_BANK = [
  { id: "q01", cat: "回忆", q: "你还记得第一次见到我时，脑子里冒出的第一个念头吗？" },
  { id: "q02", cat: "回忆", q: "我们相处到现在，哪个瞬间你偷偷记了很久？" },
  { id: "q03", cat: "回忆", q: "有没有哪次我以为很普通的对话，其实被你放在心上？" },
  { id: "q04", love: 1, cat: "回忆", q: "第一次觉得「就是这个人了」是什么时候？" },
  { id: "q05", cat: "回忆", q: "我做过最让你意外的一件事是什么？" },
  { id: "q06", cat: "回忆", q: "你印象里我笑得最好看的一次是在做什么？" },
  { id: "q07", cat: "回忆", q: "有没有哪句我随口说的话，你到现在还记得？" },
  { id: "q08", love: 1, cat: "回忆", q: "我们之间第一次有点心动的时刻，你觉得是哪次？" },
  { id: "q09", cat: "假设", q: "如果明天可以一起去任何地方，你想去哪？" },
  { id: "q10", cat: "假设", q: "如果我们能养一只宠物，你想养什么、叫什么名字？" },
  { id: "q11", cat: "假设", q: "如果周末只能一起做一件事，你选什么？" },
  { id: "q12", cat: "假设", q: "如果能回到我们刚认识的那天，你想做点什么不一样的？" },
  { id: "q13", cat: "假设", q: "如果给我们的关系拍一部电影，你觉得是什么类型？" },
  { id: "q14", cat: "假设", q: "如果有一整天什么都不用管，你想怎么和我度过？" },
  { id: "q15", cat: "假设", q: "如果我们住在一起，你最想要哪个房间是我们俩的专属角落？" },
  { id: "q16", cat: "假设", q: "如果能送我一样买不到的东西，你想送什么？" },
  { id: "q17", cat: "关系", q: "你觉得我们最像的地方是什么？" },
  { id: "q18", cat: "关系", q: "我哪个小习惯让你觉得「很我」？" },
  { id: "q19", cat: "关系", q: "你觉得我们之间谁更粘人一点？" },
  { id: "q20", cat: "关系", q: "我做的哪件小事，最容易让你心软？" },
  { id: "q21", cat: "关系", q: "你觉得我们的关系里最珍贵的是什么？" },
  { id: "q22", cat: "关系", q: "有没有什么是你只在我面前才会有的样子？" },
  { id: "q23", cat: "关系", q: "你觉得我最了解你的哪一面？又有哪面还没让我看到？" },
  { id: "q24", cat: "关系", q: "我们吵架的时候，你其实心里在想什么？" },
  { id: "q25", cat: "关系", q: "你希望我们十年后是什么样子？" },
  { id: "q26", cat: "关系", q: "我身上哪一点，是你一开始没注意、后来越来越喜欢的？" },
  { id: "q27", love: 1, cat: "私密", q: "睡前最后一个念头，最近常常是什么？" },
  { id: "q28", cat: "私密", q: "有没有什么话，想对我说却一直没说出口？" },
  { id: "q29", cat: "私密", q: "你最近一次因为我偷偷高兴，是为了什么？" },
  { id: "q30", love: 1, cat: "私密", q: "有没有哪个瞬间，你突然很想抱住我？" },
  { id: "q31", love: 1, cat: "私密", q: "你会在什么时候特别想我？" },
  { id: "q32", cat: "私密", q: "有什么是你从没告诉过别人、却想让我知道的？" },
  { id: "q33", cat: "私密", q: "你觉得自己在我面前，最放松的是什么时候？" },
  { id: "q34", cat: "私密", q: "我不在的时候，你会做什么和我有关的小事吗？" },
  { id: "q35", love: 1, cat: "私密", q: "你有没有偷偷幻想过我们以后的某个画面？是什么样的？" },
  { id: "q36", cat: "轻松", q: "我做的哪件蠢事让你笑到现在？" },
  { id: "q37", cat: "轻松", q: "如果用一种食物形容我，你觉得我是什么？" },
  { id: "q38", cat: "轻松", q: "我有没有什么口头禅是你已经被传染了的？" },
  { id: "q39", love: 1, cat: "轻松", q: "你觉得我睡着的样子怎么样，能打几分？" },
  { id: "q40", cat: "轻松", q: "如果给我起个只有你能叫的外号，你想叫我什么？" },
  { id: "q41", cat: "轻松", q: "我最近让你无语的一个瞬间是什么？" },
  { id: "q42", cat: "轻松", q: "你觉得我们俩谁做饭更能吃、谁更能睡？" },
  { id: "q43", cat: "轻松", q: "如果我们组队打游戏，你觉得谁会先坑对方？" },
  { id: "q44", cat: "轻松", q: "我有没有哪个表情或动作，你觉得特别好笑又特别可爱？" },
  { id: "q45", cat: "轻松", q: "假如我突然变成一只动物，你猜会是什么？" },
  { id: "q46", love: 1, cat: "走心", q: "你害怕失去我吗？这种感觉是什么时候开始的？" },
  { id: "q47", cat: "走心", q: "在我面前，你有没有过想逞强、其实很累的时候？" },
  { id: "q48", cat: "走心", q: "你觉得我给你带来的最大的变化是什么？" },
  { id: "q49", cat: "走心", q: "有没有哪个瞬间，你觉得「有这个人真好」？" },
  { id: "q50", cat: "走心", q: "你愿意让我看到你最不堪、最脆弱的那一面吗？" },
  { id: "q51", cat: "走心", q: "我们之间，你最想守护住的是什么？" },
  { id: "q52", cat: "走心", q: "如果有一天我们必须分开一阵子，你会怎么熬过去？" },
  { id: "q53", cat: "走心", q: "你觉得我们之间，还有什么是彼此没说透的？" },
  { id: "q54", love: 1, cat: "走心", q: "什么样的时刻，会让你特别确定「我们是认真的」？" },
  { id: "q55", love: 1, cat: "走心", q: "你有没有想过，我们最后会变成什么样子？" },
  { id: "q56", cat: "日常", q: "今天有没有哪个瞬间突然想到我？" },
  { id: "q57", cat: "日常", q: "最近有什么开心的小事想第一个告诉我？" },
  { id: "q58", love: 1, cat: "日常", q: "这一周你最累的是什么？有没有想让我抱抱？" },
  { id: "q59", love: 1, cat: "日常", q: "如果现在我在你身边，你最想做的第一件事是什么？" },
  { id: "q60", love: 1, cat: "日常", q: "今天的你，想被我用哪种方式宠一下？" }
];

// 字符串稳定哈希（自定义题给个稳定 id，用于已答判重）
const qhash = s => { let x = 0; for (let i = 0; i < s.length; i++) { x = (x * 31 + s.charCodeAt(i)) | 0; } return (x >>> 0).toString(36); };
// ── 问答小本拆成三本（她 2026-09-18）────────────────────────────
// 「单开一本单独放题，可以自定义封面，然后把角色问的题显示单独一本」。
// ⚠️分法只写在这一处：哪一本收哪几条、抽题从哪个池子抽，都从这张表推
//   （one-public-mechanism.md）。界面那头不许再自己判一次「这条是谁出的」。
// ⚠️「他出的题」不是新数据：那些条目落库时就带着 byCharacter: true
//   （app.js 里 TA出的题那一路写的），这儿只是筛出来。
// 布面受光那一档：同一个色提亮一点，书脊和书签带跟着它走。
// ⚠️只吃六位色号；她自己填了别的写法就原样退回去，别拼出个废值把整块底弄没
//   （深色主题下 t.ink 那个坑同一个道理）。
const clothLift = (hex, amt) => {
  if (!/^#[0-9a-f]{6}$/i.test(String(hex || ""))) return hex;
  const n = parseInt(hex.slice(1), 16);
  const up = v => Math.max(0, Math.min(255, Math.round(v + (255 - v) * amt)));
  return "#" + [up(n >> 16 & 255), up(n >> 8 & 255), up(n & 255)].map(v => v.toString(16).padStart(2, "0")).join("");
};
// 固定的两本：题库那本和他出的那本。自己加的题是【几本】，由她自己开（见下）。
const QA_FIXED = [
  { key: "all", zh: "关于我们", hint: "题库里的那六十道", tint: "#5e2635" },
  { key: "his", zh: "他出的题", hint: "他反过来问你的", tint: "#3b3560" }
];
const QA_CUSTOM_TINTS = ["#2f4a3f", "#6b4a2a", "#2b3d52", "#5a2f4e", "#3f4a2e", "#4a3b33"];
// 自己加的题：一本一本分类放（她 2026-09-18：「我想要能多开几本自己按类型分」）。
// ⚠️存的形状变了，但【存档键不许跟着改名】（这个仓库的老规矩）：
//   x_coupleQACustom 里原来是 { charId: ["题","题"] } —— 一个扁平数组。
//   那一份照旧读得出来：没有分本数据时，就把它当成【第一本】的题目，
//   不迁移、不清掉，旧版本读回去也还是原来那个数组。
const QA_CUSTOM_FALLBACK_ID = "cx";
function qaCustomBooks(customQ, customBooks) {
  const list = (Array.isArray(customBooks) ? customBooks : []).filter(x => x && x.id);
  if (list.length) return list.map((b, i) => ({
    id: String(b.id), key: "cxb_" + b.id, zh: String(b.name || "自己加的题"),
    hint: "你写进去的", tint: b.tint || QA_CUSTOM_TINTS[i % QA_CUSTOM_TINTS.length],
    qs: (Array.isArray(b.qs) ? b.qs : []).filter(q => q && String(q).trim())
  }));
  // 老存档（或者一本都还没开）：那一份扁平数组就是第一本
  return [{ id: QA_CUSTOM_FALLBACK_ID, key: "cxb_" + QA_CUSTOM_FALLBACK_ID, zh: "自己加的题",
    hint: "你写进去的", tint: QA_CUSTOM_TINTS[0],
    qs: (Array.isArray(customQ) ? customQ : []).filter(q => q && String(q).trim()) }];
}
// 书架上的顺序：题库 → 自己加的那几本 → 他出的
function qaAllBooks(customQ, customBooks) {
  return [QA_FIXED[0]].concat(qaCustomBooks(customQ, customBooks)).concat([QA_FIXED[1]]);
}
// 一条已答记录属于哪一本。
// ⚠️自定义题的 id 一直是 "cx_" + qhash(题目原文)，跟它放在哪一本无关——
//   所以把一道题挪到别本，已经答过的那一页照旧跟着走，不会变成孤儿。
//   反过来，光看 id 说不出它现在在哪一本，得拿题目对一遍。
function qaBookOf(e, books) {
  if (e && e.byCharacter) return "his";
  const qid = String((e && e.qid) || "");
  if (qid.indexOf("cx_") !== 0) return "all";
  const cbs = books || [];
  for (let i = 0; i < cbs.length; i++) {
    if ((cbs[i].qs || []).some(q => "cx_" + qhash(q) === qid)) return cbs[i].key;
  }
  // 题目被删了、或者这条是更早的版本留下的：归到第一本，别让它凭空消失
  return (cbs[0] && cbs[0].key) || "cxb_" + QA_CUSTOM_FALLBACK_ID;
}
// 这一本的题池（还没答的）。他出的题不由她抽——那是他递过来的，没有池子。
function qaPoolOf(bookKey, bank, books, answered) {
  if (bookKey === "his") return [];
  if (String(bookKey).indexOf("cxb_") === 0) {
    const b = (books || []).find(x => x.key === bookKey);
    return (b ? b.qs : []).map(q => ({ id: "cx_" + qhash(q), cat: b.zh, q: q })).filter(x => !answered.has(x.id));
  }
  return (bank || []).filter(b => !answered.has(b.id));
}
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
function CoupleQABook({ partner, bank, customQ, customBooks, entries, title, books, onSaveBook, onSaveCustom, onSaveCustomBooks, onAnswer, onSeal, onReveal, onEdit, onRemove, onReroll, onReply, onEditReply, onSaveTitle, gen, onBack }) {
  const t = useTheme();
  const all = (entries || []).filter(e => e.characterId === partner.id).slice().sort((a, b) => a.answeredAt - b.answeredAt);
  const answered = new Set(all.map(e => e.qid));
  // 自己加的题现在是【几本】（她 2026-09-18：「我想要能多开几本自己按类型分」）
  const cbs = qaCustomBooks(customQ, customBooks);
  const shelf = qaAllBooks(customQ, customBooks);
  // 现在开着哪一本。null＝还在书架上。
  const [book, setBook] = useState(null);
  const cfgOf = k => ((books || {})[k] || (k === "all" && typeof title === "string" && title.trim() ? { title: title.trim() } : {}));
  const bookKey = book && shelf.some(x => x.key === book) ? book : (book ? "all" : "all");
  const cfg = cfgOf(bookKey);
  const spec = shelf.find(x => x.key === bookKey) || shelf[0];
  const isCustom = String(bookKey).indexOf("cxb_") === 0;
  const curCB = isCustom ? cbs.find(x => x.key === bookKey) : null;
  const mine = all.filter(e => qaBookOf(e, cbs) === bookKey);
  const pool = qaPoolOf(bookKey, bank, cbs, answered);
  // 存一本自定义题本（改名／改题／新开／删掉都从这一个出口走）
  const putCustomBooks = next => {
    if (onSaveCustomBooks) onSaveCustomBooks(partner.id, next);
    // 老存档那一份跟着走：第一本的题目回写成扁平数组，旧版本读回去还是原来的样子
    if (onSaveCustom) onSaveCustom(partner.id, (next[0] && next[0].qs) || []);
  };
  // 「已答 X / Y」的分母：自己加的题删掉之后，已答的那条还在（该在），
  // 光用池子长度会出现 X > Y。答过但已不在题库里的也算进总数。
  const bankTotal = pool.length + mine.length;
  const bookTitle = cfg.title || spec.zh;
  const cloth = cfg.tint || spec.tint;
  const [mode, setMode] = useState("cover"); // cover / pages / draw
  const [shelfOpen, setShelfOpen] = useState(false);   // 封面设置
  const [addOpen, setAddOpen] = useState(false);       // 加新题（原来在设置里）
  const [pageIdx, setPageIdx] = useState(0);
  const [cur, setCur] = useState(null);
  const [ans, setAns] = useState("");
  const [editId, setEditId] = useState(null);
  const [editText, setEditText] = useState("");
  const [titleEditing, setTitleEditing] = useState(false);
  const [titleVal, setTitleVal] = useState(bookTitle);
  // TA出的题（v62.10）她在这儿写她那半；翻到别页就清空，别把 A 题的草稿带进 B 题
  // 揭题那格的草稿【认题不认页】（她 2026-10-06：「我明明答的是A题，交上去按进B了」）：
  // 原来草稿只跟页码走——停在「最后一页」(9999) 时TA又出了一道新题，新题排到最后，
  // 同一个页码底下换成了B，框里她给A写的字还留着，一按就交进了B。
  const [revealDraft, setRevealDraft] = useState({ id: "", text: "" });
  const [qaReply, setQaReply] = useState({ id: "", text: "" });
  const [qaEdit, setQaEdit] = useState({ id: "", i: -1, text: "" });
  // 「翻到最后一页」(9999) 一落地就换成真页码：不然TA新出一题，停着的这页会自己跳到新题上
  useEffect(() => { if (mine.length && pageIdx > mine.length - 1) setPageIdx(mine.length - 1); }, [pageIdx, mine.length]);
  const swipeRef = useRef({ x: 0, y: 0 });
  const draw = () => { if (pool.length) { setCur(pool[Math.floor(Math.random() * pool.length)]); setAns(""); } else setCur(null); };
  // 交卷＝把自己那份【封起来】，一次调用都不花；TA那份等你按「让 TA 也写一份」才生成，
  // 而且那一枪看不到你写的（见 app.js 的 answerCoupleQA 注释）。
  const submit = () => {
    if (!cur || !ans.trim() || gen) return;
    const ok = onSeal(partner, { qid: cur.id, question: cur.q, myAnswer: ans.trim(), source: bookKey === "custom" ? "自己加的" : "题库" });
    if (ok) { setCur(null); setAns(""); setPageIdx(9999); setMode("pages"); }
  };

  // —— 翻一张新题作答 ——
  if (mode === "draw") {
    return h("div", { "data-wk": "uspage", "data-part": "coupleqabook", className: "h-full flex flex-col", style: cpSkin(t, "page") },
      h(Head, { zh: "翻一张题", sub: partner.remark || partner.name, bg: "transparent", onBack: () => { setCur(null); setAns(""); setMode("cover"); } }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-6 pb-8" },
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.fog, marginTop: 4, marginBottom: 14 } }, "已答 " + mine.length + " / " + bankTotal + " 题。"),
        cur ? h("div", { "data-wk": "block", style: { background: "#fdfaf1", border: "1px solid #e6dcc4", borderRadius: 4, padding: "14px 16px", animation: "qqIn .3s ease both", backgroundImage: "repeating-linear-gradient(transparent 0 27px, rgba(190,170,120,.16) 27px 28px)", boxShadow: "0 8px 20px rgba(90,70,40,.10)" } },
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10px * var(--app-fs, 1))", letterSpacing: ".18em", color: "#a3987e", marginBottom: 8 } }, cur.cat),
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(16px * var(--app-fs, 1))", lineHeight: 1.5, color: "#3a3226", marginBottom: 12 } }, cur.q),
          h("textarea", { "data-wk": "textarea", value: ans, onChange: e => setAns(e.target.value), placeholder: "写下你的答案…", rows: 3, style: { width: "100%", outline: "none", resize: "none", padding: "10px 12px", borderRadius: 6, fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", lineHeight: 1.6, background: "#fffdf6", color: "#3a3226", border: "1px solid #e6dcc4" } }),
          h("div", { className: "flex items-center gap-2 mt-3" },
            h("button", { onClick: draw, disabled: gen, className: "active:opacity-60 disabled:opacity-40", style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.fog } }, "换一题"),
            h("button", { "data-wk": "block", onClick: submit, disabled: !ans.trim() || gen, className: "ml-auto active:opacity-70 disabled:opacity-40", style: { background: "#3a3226", color: "#fdfaf1", fontFamily: F_DISPLAY, fontSize: "calc(14px * var(--app-fs, 1))", padding: "8px 18px", borderRadius: 10 } }, gen ? partner.name + " 作答中…" : "写好了 · 封起来"))) : h("button", { "data-wk": "block", onClick: draw, disabled: !pool.length, className: "w-full active:opacity-70 disabled:opacity-40", style: { background: t.ink, color: t.bg2, fontFamily: F_DISPLAY, fontSize: "calc(15px * var(--app-fs, 1))", padding: "13px 0", borderRadius: 14 } }, pool.length ? "翻一张新题" : "题库都答完啦")));
  }

  // —— 翻页看过往（编辑 / reroll / 删除）——
  if (mode === "pages") {
    const has = mine.length > 0;
    const idx = Math.max(0, Math.min(pageIdx, mine.length - 1));
    const e = has ? mine[idx] : null;
    return h("div", { "data-wk": "uspage", "data-part": "coupleqabook", className: "h-full flex flex-col", style: cpSkin(t, "page") },
      h(Head, { zh: bookTitle, sub: has ? "第 " + (idx + 1) + " 页 · 共 " + mine.length + " 页" : null, bg: "transparent", onBack: () => setMode("cover") }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-6 pb-8", style: { touchAction: "pan-y" }, onTouchStart: ev => { const tt = ev.touches[0]; swipeRef.current = { x: tt.clientX, y: tt.clientY }; }, onTouchEnd: ev => { const tt = ev.changedTouches[0]; const dx = tt.clientX - swipeRef.current.x, dy = tt.clientY - swipeRef.current.y; if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.4) { if (dx < 0) setPageIdx(Math.min(mine.length - 1, idx + 1)); else setPageIdx(Math.max(0, idx - 1)); } } },
        !has ? h("div", { "data-wk": "block", style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.fog, marginTop: 10 } }, "还没有答过的题。") : h("div", { key: e.id, style: { position: "relative", background: "#fdfaf1", border: "1px solid #e6dcc4", borderRadius: 4, padding: "16px 18px 14px", animation: "qqIn .3s ease both",
          // 纸页（v62.13）：横格淡淡铺在底上当纸纹，右下一个折角。配色整套写死——
          // 纸是写死的浅色，字色若还跟主题走，深色主题就是浅字浅纸（信纸那套的同一课）
          backgroundImage: "repeating-linear-gradient(transparent 0 27px, rgba(190,170,120,.16) 27px 28px)",
          boxShadow: "0 8px 20px rgba(90,70,40,.10)" } },
          h("div", { "aria-hidden": "true", style: { position: "absolute", right: 0, bottom: 0, width: 0, height: 0, borderLeft: "14px solid transparent", borderBottom: "14px solid rgba(190,170,120,.30)" } }),
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10px * var(--app-fs, 1))", letterSpacing: ".18em", color: "#a3987e", marginBottom: 8 } }, (e.byCharacter ? partner.name + " 出的 · " : "") + "第 " + (idx + 1) + " 题"),
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(16px * var(--app-fs, 1))", lineHeight: 1.5, color: "#3a3226", marginBottom: 12 } }, e.question),
          h("div", { style: { marginBottom: 10 } },
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: "#8a7a5c", marginBottom: 3 } }, "我"),
            // TA出的题（sealed 且她还没写）：她的那半直接在这儿写，写完两份一起打开——零调用
            (e.sealed && e.byCharacter && !e.myAnswer) ? h("div", null,
              h("textarea", { "data-wk": "textarea", value: revealDraft.id === e.id ? revealDraft.text : "", onChange: ev => setRevealDraft({ id: e.id, text: ev.target.value }), placeholder: "写下你的答案…", rows: 3, style: { width: "100%", outline: "none", resize: "none", padding: "9px 11px", borderRadius: 6, fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", lineHeight: 1.6, background: "#fffdf6", color: "#3a3226", border: "1px solid #e6dcc4" } }),
              h("button", { onClick: () => { if (revealDraft.id === e.id && onReveal && onReveal(e.id, revealDraft.text)) setRevealDraft({ id: "", text: "" }); }, disabled: !(revealDraft.id === e.id && revealDraft.text.trim()), className: "active:opacity-70 disabled:opacity-40", style: { marginTop: 8, background: "#3a3226", color: "#fdfaf1", fontFamily: F_DISPLAY, fontSize: "calc(13px * var(--app-fs, 1))", padding: "7px 16px", borderRadius: 8 } }, "写好了 · 一起打开")) :
            editId === e.id ? h("div", null,
              h("textarea", { "data-wk": "textarea", value: editText, onChange: ev => setEditText(ev.target.value), rows: 3, style: { width: "100%", outline: "none", resize: "none", padding: "9px 11px", borderRadius: 6, fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", lineHeight: 1.6, background: "#fffdf6", color: "#3a3226", border: "1px solid #e6dcc4" } }),
              h("div", { className: "flex gap-2 mt-2" },
                h("button", { onClick: () => { onEdit(e.id, editText); setEditId(null); }, className: "active:opacity-70", style: { background: "#3a3226", color: "#fdfaf1", fontFamily: F_DISPLAY, fontSize: "calc(12.5px * var(--app-fs, 1))", padding: "6px 14px", borderRadius: 8 } }, "保存"),
                h("button", { onClick: () => setEditId(null), className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.fog } }, "取消"))) : h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", lineHeight: 1.6, color: "#6a5f4b", whiteSpace: "pre-wrap" } }, e.myAnswer || "（没写）")),
          h("div", null,
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: "#a05a6a", marginBottom: 3 } }, partner.name),
            (e.sealed && e.byCharacter && !e.myAnswer)
              ? h("div", { style: { borderRadius: 6, border: "1px dashed #d8cdaf", padding: "13px 14px", textAlign: "center" } },
                  h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: "#a3987e", lineHeight: 1.7 } },
                    "这道题是 " + partner.name + " 出的，TA 那半已经写好、封着——你写完你的，两份才一起打开。"))
              : (e.sealed && !e.charAnswer)
              ? h("div", { style: { borderRadius: 6, border: "1px dashed #d8cdaf", padding: "13px 14px", textAlign: "center" } },
                  h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: "#a3987e", lineHeight: 1.7 } },
                    "你那份封着呢。" + partner.name + " 写的时候看不到你写了什么——两份都写完才一起打开。"),
                  h("button", { onClick: () => onAnswer(partner, e), disabled: gen, className: "active:opacity-70 disabled:opacity-40",
                    style: { marginTop: 10, fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: "#fdfaf1", background: "#3a3226", borderRadius: 999, padding: "8px 20px" } },
                    gen ? "写着…" : "让 " + partner.name + " 也写一份"))
              : h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", lineHeight: 1.6, color: "#3a3226", whiteSpace: "pre-wrap" } }, gen ? "…" : (e.charAnswer || "…"))),
          // 两份都打开了才能在底下聊（封着的时候聊就成了偷看）
          (!e.sealed && e.charAnswer && onReply) ? h("div", { "data-wk": "qareplies", style: { marginTop: 12, borderTop: "1px dashed #e6dcc4", paddingTop: 10 } },
            (e.replies || []).map((r, ri) => (qaEdit.id === e.id && qaEdit.i === ri)
              // 我那条点一下就能改；清空了保存＝删掉这条
              ? h("div", { key: ri, className: "flex gap-2", style: { marginBottom: 6 } },
                  h("input", { "data-wk": "input", autoFocus: true, value: qaEdit.text, onChange: ev => setQaEdit({ ...qaEdit, text: ev.target.value }), className: "flex-1 min-w-0 outline-none", style: { padding: "5px 9px", borderRadius: 6, border: "1px solid #d8cdaf", background: "#fffdf6", color: "#3a3226", fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))" } }),
                  h("button", { onClick: () => { onEditReply && onEditReply(e.id, ri, qaEdit.text); setQaEdit({ id: "", i: -1, text: "" }); }, className: "shrink-0 active:opacity-60", style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: "#3a3226" } }, qaEdit.text.trim() ? "保存" : "删掉"),
                  h("button", { onClick: () => setQaEdit({ id: "", i: -1, text: "" }), className: "shrink-0 active:opacity-60", style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: "#a3987e" } }, "取消"))
              : h("div", { key: ri, onClick: r.authorId === "user" && onEditReply ? () => setQaEdit({ id: e.id, i: ri, text: r.content }) : undefined, style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", lineHeight: 1.6, color: r.authorId === "user" ? "#6a5f4b" : "#3a3226", marginBottom: 5, whiteSpace: "pre-wrap", cursor: r.authorId === "user" ? "pointer" : "default" } },
              h("span", { style: { fontSize: "calc(10.5px * var(--app-fs, 1))", color: r.authorId === "user" ? "#8a7a5c" : "#a05a6a", marginRight: 6 } }, r.authorId === "user" ? "我" : partner.name), r.content)),
            (e.replies || []).some(r => r.authorId === "user") ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10px * var(--app-fs, 1))", color: "#b5aa90", marginBottom: 4 } }, "点自己那条可以改") : null,
            gen ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: "#a3987e", marginBottom: 5 } }, partner.name + " 在写…") : null,
            h("div", { className: "flex gap-2", style: { marginTop: 4 } },
              h("input", { "data-wk": "input", value: qaReply.id === e.id ? qaReply.text : "", onChange: ev => setQaReply({ id: e.id, text: ev.target.value }), placeholder: (e.replies || []).length ? "接着说…" : "看完两份，说两句…", className: "flex-1 min-w-0 outline-none", style: { padding: "7px 10px", borderRadius: 6, border: "1px solid #e6dcc4", background: "#fffdf6", color: "#3a3226", fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))" } }),
              h("button", { onClick: () => { const tx = qaReply.id === e.id ? qaReply.text.trim() : ""; if (!tx) return; onReply(e.id, tx); setQaReply({ id: "", text: "" }); }, disabled: gen || !(qaReply.id === e.id && qaReply.text.trim()), className: "shrink-0 active:opacity-70 disabled:opacity-40", style: { background: "#3a3226", color: "#fdfaf1", fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", padding: "6px 14px", borderRadius: 8 } }, "发"))) : null,
          h("div", { className: "flex items-center justify-between", style: { marginTop: 12, borderTop: "1px solid #e6dcc4", paddingTop: 10 } },
            h("span", { style: { fontFamily: F_BODY, fontSize: "calc(10px * var(--app-fs, 1))", color: "#a3987e" } }, timeAgo(e.answeredAt)),
            h("div", { className: "flex items-center gap-3" },
              // TA出的、她还没写的那种：我的答案就在上面那个框里写，编辑/重答都还轮不到
              (e.sealed && e.byCharacter && !e.myAnswer) ? null : h("button", { onClick: () => { setEditId(e.id); setEditText(e.myAnswer || ""); }, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: "#8a7a5c" } }, "编辑"),
              e.sealed ? null : h("button", { onClick: () => onReroll(partner, e), disabled: gen, className: "active:opacity-60 disabled:opacity-40", style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: "#8a7a5c" } }, gen ? "…" : "重答"),
              h("button", { onClick: () => { onRemove(e.id); setPageIdx(i => Math.max(0, i - (idx === mine.length - 1 ? 1 : 0))); }, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: "#c26" } }, "删除")))),
        has ? h("div", { className: "flex items-center justify-between", style: { marginTop: 16 } },
          h("button", { onClick: () => setPageIdx(Math.max(0, idx - 1)), disabled: idx === 0, className: "active:opacity-60 disabled:opacity-30", style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.ink } }, "‹ 上一题"),
          h("button", { onClick: () => { draw(); setMode("draw"); }, className: "active:opacity-70 flex flex-col items-center", style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.tint } }, "＋ 新题", h("span", { style: { fontSize: "calc(9px * var(--app-fs, 1))", color: t.fog, marginTop: 1 } }, "← 左右滑翻页 →")),
          h("button", { onClick: () => setPageIdx(Math.min(mine.length - 1, idx + 1)), disabled: idx >= mine.length - 1, className: "active:opacity-60 disabled:opacity-30", style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.ink } }, "下一题 ›")) : null));
  }

  // —— 书架：三本摆在一起，挑一本进去（她 2026-09-18）——
  // 桌上那张点阵纸不换，换的是纸上摆着几本。
  const deskSkin = { background: t.bg,
    backgroundImage: "radial-gradient(circle,rgba(120,110,80,.14) 1px,rgba(0,0,0,0) 1.2px)", backgroundSize: "17px 17px" };
  if (!book) {
    return h("div", { "data-wk": "uspage", "data-part": "coupleqabook", className: "h-full flex flex-col", style: deskSkin },
      h(Head, { zh: "问答小本", en: partner.name, onBack, bg: "transparent" }),
      h("div", { className: "flex-1 overflow-y-auto px-6 pb-10" },
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.fog, margin: "6px 0 16px", lineHeight: 1.7 } },
          characterText(partner, "三本摆在这儿：题库那本、你自己写的那本、他反过来问你的那本。")),
        shelf.map(bk => {
          const c2 = cfgOf(bk.key);
          const cl = c2.tint || bk.tint;
          const rows = all.filter(e => qaBookOf(e, cbs) === bk.key);
          const left = qaPoolOf(bk.key, bank, cbs, answered).length;
          return h("button", { key: bk.key, onClick: () => { setBook(bk.key); setMode("cover"); },
            className: "w-full text-left active:opacity-85",
            style: { position: "relative", display: "block", marginBottom: 14, minHeight: 92,
              borderRadius: "4px 12px 12px 4px", padding: "16px 16px 15px 38px", overflow: "hidden",
              backgroundImage: "repeating-linear-gradient(45deg, rgba(255,255,255,.035) 0 1px, transparent 1px 3px), linear-gradient(140deg," + clothLift(cl, 0.22) + "," + cl + ")",
              boxShadow: "0 10px 24px rgba(50,30,40,.28)" } },
            // 书脊那一条：跟大封面同一个做法，缩一号
            h("div", { "aria-hidden": "true", style: { position: "absolute", left: 0, top: 0, bottom: 0, width: 20, background: "linear-gradient(90deg,rgba(0,0,0,.26),rgba(255,255,255,.05))" } }),
            h("div", { "aria-hidden": "true", style: { position: "absolute", left: 24, top: 7, bottom: 7, borderLeft: "1px solid rgba(0,0,0,.2)" } }),
            c2.coverKey || c2.coverUrl ? h("div", { style: { position: "absolute", right: 0, top: 0, bottom: 0, width: "42%", opacity: .5,
              maskImage: "linear-gradient(to left,#000 0%,transparent 88%)", WebkitMaskImage: "linear-gradient(to left,#000 0%,transparent 88%)" } },
              h(AlbumPhoto, { photo: { imgKey: c2.coverKey, imgUrl: c2.coverUrl }, cover: true })) : null,
            h("div", { style: { position: "relative" } },
              h("div", { style: { fontFamily: F_BODY, fontSize: "calc(9.5px * var(--app-fs, 1))", letterSpacing: ".26em", color: "rgba(255,255,255,.5)" } }, bk.hint),
              h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(22px * var(--app-fs, 1))", color: "#f2e6cf", marginTop: 5, textShadow: "0 1px 1px rgba(0,0,0,.35)" } }, c2.title || bk.zh),
              h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: "rgba(255,255,255,.58)", marginTop: 7 } },
                rows.length + " 页" + (bk.key === "his" ? "" : " · 还剩 " + left + " 题没翻")))); }),
        // 再开一本（她 2026-09-18：「我想要能多开几本自己按类型分」）。
        // 长成一本【还没写字的空本子】：虚线边、没有烫金——一眼就知道它还不是书。
        h("button", { onClick: () => {
            const id = "b" + Date.now().toString(36);
            putCustomBooks(cbs.map(b => ({ id: b.id, name: b.zh, tint: b.tint, qs: b.qs }))
              .concat([{ id: id, name: "新的一本", tint: QA_CUSTOM_TINTS[cbs.length % QA_CUSTOM_TINTS.length], qs: [] }]));
            setBook("cxb_" + id); setMode("cover");
          },
          className: "w-full active:opacity-70",
          style: { display: "block", minHeight: 66, borderRadius: "4px 12px 12px 4px",
            border: "1px dashed rgba(120,100,70,.45)", background: "rgba(250,244,230,.35)",
            fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.fog, padding: "20px 16px 20px 38px", textAlign: "left" } },
          "＋ 再开一本　", h("span", { style: { fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog } }, "按类型分开放，比如「想问但没敢问的」"))));
  }

  // —— 书封面（默认）——
  // 这一本躺在【点阵纸】上（v62.44）：本子是本子，桌上那张纸是纸——
  // 底纹铺外壳、顶栏透上来（mobile-ui-layout §3.5），也不跟着滚。
  return h("div", { "data-wk": "uspage", "data-part": "coupleqabook", className: "h-full flex flex-col", style: deskSkin },
    h(Head, { zh: "问答小本", en: partner.name, onBack: () => setBook(null), bg: "transparent",
      // 加新题原来在【设置】里（她 2026-09-18：「能不能把它搬到问答小本的右上角」）。
      // ⚠️「他出的题」那本没有加题这回事——那是他递过来的，不是她写的池子。
      right: h("div", { className: "flex items-center gap-3" },
        isCustom ? h("button", { onClick: () => setAddOpen(true), className: "active:opacity-60",
          style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.tint } }, "加题") : null,
        h("button", { onClick: () => setShelfOpen(true), className: "active:opacity-60",
          style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.tint } }, "封面")) }),
    h("div", { className: "flex-1 overflow-y-auto px-6 pb-8" },
      // ── 封面重做（v62.13）：原来是粉紫渐变卡 + 「OUR Q&A」+ 白圆加号——换个 app 照样成立。
      // 它是一本【本子】，就长成一本布面精装本：织纹布面、左侧真书脊（凹槽压线）、
      // 标题烫在压印框里、右侧一条松紧系带。功能一样没动：点标题改名、右下角翻新题。
      h("div", { style: { position: "relative", marginTop: 18, borderRadius: "5px 14px 14px 5px", padding: "30px 24px 24px 44px", minHeight: 300, display: "flex", flexDirection: "column", justifyContent: "space-between", overflow: "hidden",
        // 布面：两道极淡的斜纹叠出织物经纬，底色深酒红
        backgroundImage: "repeating-linear-gradient(45deg, rgba(255,255,255,.035) 0 1px, transparent 1px 3px), repeating-linear-gradient(-45deg, rgba(0,0,0,.06) 0 1px, transparent 1px 3px), linear-gradient(140deg," + clothLift(cloth, 0.22) + "," + cloth + ")",
        boxShadow: "0 14px 34px rgba(90,45,60,0.35)" } },
        // 书脊：左侧一条受光不同的带，加一道铰线——布包过书板的那道折
        h("div", { "aria-hidden": "true", style: { position: "absolute", left: 0, top: 0, bottom: 0, width: 26, background: "linear-gradient(90deg, rgba(0,0,0,.30), rgba(0,0,0,.10) 55%, rgba(255,255,255,.07) 78%, rgba(0,0,0,.16))" } }),
        h("div", { "aria-hidden": "true", style: { position: "absolute", left: 30, top: 8, bottom: 8, borderLeft: "1px solid rgba(0,0,0,.20)", boxShadow: "1px 0 0 rgba(255,255,255,.06)" } }),
        // 松紧系带：竖着勒在右侧，像合上的手账
        h("div", { "aria-hidden": "true", style: { position: "absolute", right: 30, top: -2, bottom: -2, width: 7, background: "linear-gradient(90deg, rgba(0,0,0,.30), rgba(0,0,0,.16) 40%, rgba(255,255,255,.05))", boxShadow: "0 0 6px rgba(0,0,0,.18)" } }),
        h("div", null,
          // 压印框：一圈细金线，标题「烫」在里面（金字 + 一点内凹的影）
          h("div", { style: { border: "1px solid rgba(232,201,143,.38)", borderRadius: 3, padding: "16px 14px 14px", marginRight: 18, boxShadow: "inset 0 0 0 3px rgba(0,0,0,.10)" } },
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10px * var(--app-fs, 1))", letterSpacing: ".3em", color: "rgba(232,201,143,.66)", marginBottom: 10 } }, "一人一半 · 写完才打开"),
            titleEditing ? h("div", null,
              h("input", { "data-wk": "input", value: titleVal, onChange: e => setTitleVal(e.target.value), style: { width: "100%", outline: "none", background: "rgba(0,0,0,0.18)", border: "1px solid rgba(232,201,143,0.45)", borderRadius: 6, padding: "6px 10px", fontFamily: F_DISPLAY, fontSize: "calc(24px * var(--app-fs, 1))", color: "#e8c98f" } }),
              h("div", { className: "flex gap-2 mt-2" },
                h("button", { onClick: () => { onSaveTitle(partner.id, (titleVal || "").trim() || "关于我们"); setTitleEditing(false); }, className: "active:opacity-80", style: { background: "#e8c98f", color: "#63313f", fontFamily: F_DISPLAY, fontSize: "calc(12.5px * var(--app-fs, 1))", padding: "6px 14px", borderRadius: 6, minHeight: 32 } }, "保存"),
                h("button", { onClick: () => { setTitleVal(bookTitle); setTitleEditing(false); }, className: "active:opacity-70", style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: "rgba(232,201,143,0.8)", minHeight: 32 } }, "取消"))) : h("button", { onClick: () => { setTitleVal(bookTitle); setTitleEditing(true); }, className: "text-left active:opacity-80 flex items-baseline gap-2" },
              h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(29px * var(--app-fs, 1))", color: "#e8c98f", lineHeight: 1.25, textShadow: "0 1px 1px rgba(0,0,0,.4)" } }, bookTitle),
              h("span", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: "rgba(232,201,143,0.55)", flexShrink: 0 } }, "✎")))),
        h("div", { style: { display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginRight: 18 } },
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: "rgba(232,201,143,.7)" } }, "已答 " + mine.length + " / " + bankTotal + " 题"),
          h("button", { onClick: () => { draw(); setMode("draw"); }, "aria-label": "翻一张新题", className: "active:opacity-80", style: { width: 46, height: 46, borderRadius: 999, background: "rgba(0,0,0,.22)", border: "1px solid rgba(232,201,143,.5)", display: "flex", alignItems: "center", justifyContent: "center" } }, h(IPlus, { size: 22, color: "#e8c98f" })))),
      // 「翻开看过往」原来是一块纯黑药丸压在那本布面书下面（v62.44 换掉）：
      // 它是这本本子的一部分，就该长成本子上那条【书签带】——布面同色、烫金字、
      // 底下一个燕尾缺口。
      mine.length ? h("button", { onClick: () => { setPageIdx(0); setMode("pages"); }, className: "active:opacity-80",
        style: { position: "relative", display: "block", width: "58%", margin: "0 auto", minHeight: 44,
          background: "linear-gradient(180deg," + clothLift(cloth, 0.12) + "," + cloth + ")", color: "#e8c98a", fontFamily: F_DISPLAY, fontSize: "calc(14.5px * var(--app-fs, 1))",
          padding: "12px 0 20px", borderRadius: "0 0 2px 2px", boxShadow: "0 8px 18px rgba(60,20,32,.26)",
          clipPath: "polygon(0 0, 100% 0, 100% 100%, 50% calc(100% - 11px), 0 100%)" } }, "翻开看过往（" + mine.length + "）") : h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.fog, textAlign: "center", marginTop: 16 } }, "还没答过题——点封面右下角 ＋ 翻第一张"),
      h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog, textAlign: "center", marginTop: 14, lineHeight: 1.6 } },
        isCustom ? "想加专属题就点右上角「加题」" : bookKey === "his" ? characterText(partner, "这一本由他往里写——他哪天想问你什么，就会多一页") : "右上角可以换这本的封面"),
      // ── 加新题：原来在【设置 → 问答】里，v70.84 搬过来（她 2026-09-18）──
      // ⚠️搬＝设置那一处删掉，不是两处都留（one-public-mechanism.md：
      //   只开新的、旧的留在原地是最坏的一种，从此同一件事活在两处）。
      addOpen ? h(PageSheet, { onClose: () => setAddOpen(false), tall: true, skin: { background: "#fdfaf1", handle: "rgba(90,70,50,.3)" } },
        h(QAAddSheet, { partner, bookName: spec.zh, customQ: (curCB && curCB.qs) || [],
          onSave: arr => {
            putCustomBooks(cbs.map(b => b.key === bookKey
              ? { id: b.id, name: b.zh, tint: b.tint, qs: arr.filter(x => x && x.trim()).map(x => x.trim()) }
              : { id: b.id, name: b.zh, tint: b.tint, qs: b.qs }));
            setAddOpen(false);
          }, onClose: () => setAddOpen(false) })) : null,
      shelfOpen ? h(PageSheet, { onClose: () => setShelfOpen(false), tall: true, skin: { background: "#fdfaf1", handle: "rgba(90,70,50,.3)" } },
        h(QACoverSheet, { partner, spec, cfg,
          // 自己开的那几本：名字和布面色存在【题本自己身上】，不走封面那份配置——
          // 不然书架上那一排读的是一处、翻开读的是另一处，迟早对不上。
          ownBook: isCustom,
          // 最后一本不许删：删光了书架上就没有「自己加的题」这一档，
          // 她再想加题只能先摸索出「再开一本」在哪儿。
          onDelete: isCustom && cbs.length > 1 ? () => {
            requestAppConfirm("删掉「" + spec.zh + "」这一本？",
              "这一本里的 " + ((curCB && curCB.qs) || []).length + " 道题会一起没有；已经答过的那几页还留着，会归到第一本里。",
              () => { putCustomBooks(cbs.filter(b => b.key !== bookKey).map(b => ({ id: b.id, name: b.zh, tint: b.tint, qs: b.qs })));
                setShelfOpen(false); setBook(null); }, "删掉");
          } : null,
          onSave: patch => {
            if (isCustom) {
              putCustomBooks(cbs.map(b => b.key === bookKey
                ? { id: b.id, name: (patch.title || "").trim() || b.zh, tint: patch.tint || b.tint, qs: b.qs }
                : { id: b.id, name: b.zh, tint: b.tint, qs: b.qs }));
            } else {
              onSaveBook && onSaveBook(partner.id, bookKey, patch);
              // 「关于我们」那本改名时把老存档那份也一起写，免得它落单
              if (bookKey === "all" && patch && patch.title && onSaveTitle) onSaveTitle(partner.id, patch.title);
            }
            setShelfOpen(false); },
          onClose: () => setShelfOpen(false) })) : null));
}

// 加新题（原来在设置 → 问答那一栏，v70.84 搬来问答小本右上角）。
// ⚠️写法跟原来那一份一样：一行一题、整份存下去。她习惯的是这个，别换成一条条加。
function QAAddSheet({ partner, bookName, customQ, onSave, onClose }) {
  const t = useTheme();
  const [text, setText] = useState((customQ || []).join("\n"));
  const count = text.split("\n").filter(x => x.trim()).length;
  return h("div", { className: "px-1 pb-2" },
    h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(17px * var(--app-fs, 1))", color: "#3a3226" } }, "往「" + (bookName || "自己加的题") + "」里加题"),
    h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: "#8b8169", marginTop: 5, marginBottom: 12, lineHeight: 1.7 } },
      characterText(partner, "一行一题。只进这一本；翻到了他照常回答。")),
    h("textarea", { "data-wk": "textarea", value: text, onChange: e => setText(e.target.value), rows: 9,
      placeholder: "一行一题，例如：\n那年在车站你其实想说什么\n我们第一次吵架你在想什么",
      className: "w-full outline-none",
      style: { fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", lineHeight: 1.8, color: "#3a3226", background: "#fffdf6",
        border: "1px solid #e6dcc4", borderRadius: 6, padding: "11px 12px", resize: "vertical" } }),
    h("div", { className: "flex items-center justify-between", style: { marginTop: 10 } },
      h("span", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: "#8b8169" } }, count + " 题"),
      h("div", { className: "flex gap-2" },
        h("button", { onClick: onClose, className: "active:opacity-70", style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: "#8b8169", padding: "9px 14px" } }, "取消"),
        h("button", { onClick: () => onSave(text.split("\n")), className: "active:opacity-80",
          style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: "#fdfaf1", background: "#5e2635", borderRadius: 999, padding: "9px 20px" } }, "存起来"))),
    // ⚠️删掉的题，答过的那几页还在（该在）——说清楚，免得她以为连答案一起删了
    h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: "#a3987e", marginTop: 10, lineHeight: 1.6 } },
      "删掉一行只是不再抽到它；已经答过的那一页还留在本子里。"));
}
// 自定义封面（她 2026-09-18：「可以自定义封面」）：改名 + 换布面色 + 可选一张照片。
// ⚠️照片指向的是【已经有的那张合照】自己的 imgKey，不复制一份——跟「另一种我们」
//   那一处同一个做法，删照片那一路照旧管得到它。
const QA_CLOTHS = ["#5e2635", "#2f4a3f", "#3b3560", "#6b4a2a", "#2b3d52", "#5a2f4e", "#3f4a2e", "#4a3b33"];
function QACoverSheet({ partner, spec, cfg, ownBook, onDelete, onSave, onClose }) {
  const t = useTheme();
  // 自己开的那几本，名字和布面色存在题本自己身上（spec 就是它）；固定那两本走 cfg
  const [title, setTitle] = useState(ownBook ? spec.zh : (cfg.title || ""));
  const [tint, setTint] = useState((ownBook ? spec.tint : cfg.tint) || spec.tint);
  return h("div", { className: "px-1 pb-2" },
    h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(17px * var(--app-fs, 1))", color: "#3a3226" } }, "这一本的封面"),
    h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: "#8b8169", marginTop: 5, marginBottom: 14 } }, spec.hint),
    h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: "#8b8169", marginBottom: 6 } }, "名字"),
    h("input", { "data-wk": "input", value: title, onChange: e => setTitle(e.target.value.slice(0, 20)), placeholder: spec.zh,
      className: "w-full outline-none",
      style: { fontFamily: F_DISPLAY, fontSize: "calc(17px * var(--app-fs, 1))", color: "#3a3226", background: "#fffdf6", border: "1px solid #e6dcc4", borderRadius: 6, padding: "10px 12px" } }),
    h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: "#8b8169", margin: "16px 0 8px" } }, "布面"),
    h("div", { className: "flex flex-wrap", style: { gap: 10 } },
      QA_CLOTHS.map(c => h("button", { key: c, onClick: () => setTint(c), className: "active:opacity-70",
        style: { width: 38, height: 38, borderRadius: "3px 8px 8px 3px",
          backgroundImage: "repeating-linear-gradient(45deg, rgba(255,255,255,.05) 0 1px, transparent 1px 3px), linear-gradient(140deg," + clothLift(c, .22) + "," + c + ")",
          boxShadow: tint === c ? "0 0 0 2px #3a3226" : "0 2px 6px rgba(0,0,0,.2)" } }))),
    // 预览：改完立刻看得见，不用存了退出去才知道
    h("div", { style: { marginTop: 18, borderRadius: "4px 12px 12px 4px", padding: "18px 16px 16px 34px", minHeight: 96, position: "relative", overflow: "hidden",
      backgroundImage: "repeating-linear-gradient(45deg, rgba(255,255,255,.035) 0 1px, transparent 1px 3px), linear-gradient(140deg," + clothLift(tint, .22) + "," + tint + ")" } },
      h("div", { "aria-hidden": "true", style: { position: "absolute", left: 0, top: 0, bottom: 0, width: 20, background: "linear-gradient(90deg,rgba(0,0,0,.26),rgba(255,255,255,.05))" } }),
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(21px * var(--app-fs, 1))", color: "#f2e6cf" } }, (title || "").trim() || spec.zh)),
    h("div", { className: "flex gap-2", style: { marginTop: 16 } },
      h("button", { onClick: onClose, className: "flex-1 active:opacity-70", style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: "#8b8169", padding: "11px 0", border: "1px solid #e6dcc4", borderRadius: 999 } }, "取消"),
      h("button", { onClick: () => onSave({ title: (title || "").trim(), tint: tint }), className: "flex-1 active:opacity-80",
        style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: "#fdfaf1", background: "#5e2635", borderRadius: 999, padding: "12px 0" } }, "就这样")),
    // 删掉这一本：只有自己开的、而且不是最后一本，才给这颗
    onDelete ? h("button", { onClick: onDelete, className: "w-full active:opacity-70",
      style: { marginTop: 10, fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: "#c25a4a", padding: "10px 0" } }, "删掉这一本") : null);
}
// 情侣空间·交换日记（v47.77 借 LNChat）：一本两人轮流写的本子——我随时写一页，TA 三天内挑个时候
// 按【TA 回复当天】的处境回一页（呼应我写的+没说出口的潜台词）。头部带日期/天气/心情的仪式感
function CoupleExDiary({ partner, entries, onAdd, onRead, onBack }) {
  const t = useTheme();
  const mine = (entries || []).filter(e => e.characterId === partner.id).slice().sort((a, b) => b.ts - a.ts);
  const [writing, setWriting] = useState(false);
  const [body, setBody] = useState("");
  const [moodW, setMoodW] = useState("");
  useEffect(() => { onRead && onRead(partner.id); }, []);
  const pending = mine.find(e => e.author === "user" && !e.replied);
  const fmtD = ds => { const p = String(ds || "").split("-"); return p.length === 3 ? p[0] + " 年 " + parseInt(p[1], 10) + " 月 " + parseInt(p[2], 10) + " 日" : ds; };
  // ── v62.41（她 2026-09-04：「交换日记的里面的样式也没弄还是一张纸」）──────
  // 上一版每一页都是一个圆角框 + 一条虚线 —— 搬去任何 app 都成立。
  // 这一页现实里是【一本轮流传的本子】，所以照本子来做：
  //   · 纸上有横格，正文的行高跟格距对齐，字是真写在格子上的；
  //   · 左边一条装订边，上面是缝线；
  //   · **谁写的那一页，装订边就在哪一侧** —— 本子递到对面，就是翻过来那一面。
  //     这一条同时顶掉了「选中态只靠颜色」那个毛病：位置也变了，不只是换个纸色。
  //   · 本子在 TA 那边的时候，那一页的位置是【空的】：一个虚线框，本子真不在。
  const RULE_H = 26;                       // 格距；正文 lineHeight 必须跟它相等
  const paperOf = isMe => ({
    background: (isMe ? "#fdfaf3" : "#fdf4f2"),
    backgroundImage: "repeating-linear-gradient(180deg,rgba(0,0,0,0) 0 " + (RULE_H - 1) + "px,"
      + (isMe ? "rgba(120,105,70,.16)" : "rgba(150,100,105,.16)") + " " + (RULE_H - 1) + "px " + RULE_H + "px)",
    backgroundPosition: "0 34px"
  });
  // 装订边：一条布脊 + 五针缝线
  const seam = isMe => h("div", { "aria-hidden": "true", style: Object.assign({ position: "absolute", top: 0, bottom: 0, width: 17,
    background: isMe ? "linear-gradient(90deg,#e0d3b4,#efe6d2)" : "linear-gradient(90deg,#e8cbc8,#f4dedb)",
    display: "flex", flexDirection: "column", justifyContent: "space-evenly", alignItems: "center" }, isMe ? { left: 0 } : { right: 0 }) },
    [0, 1, 2, 3, 4].map(i2 => h("span", { key: i2, style: { width: 1.5, height: 9, borderRadius: 2, background: "rgba(90,70,50,.30)" } })));
  const page = e => {
    const isMe = e.author === "user";
    return h("div", { key: e.id, style: Object.assign({ position: "relative", borderRadius: 3, marginBottom: 15,
      padding: isMe ? "12px 15px 15px 28px" : "12px 28px 15px 15px",
      border: "1px solid " + (isMe ? "#e6dac0" : "#eed6d2"),
      boxShadow: "0 8px 20px rgba(70,52,40,.11)",
      transform: "rotate(" + (isMe ? -0.35 : 0.35) + "deg)" }, paperOf(isMe)) },
      seam(isMe),
      h("div", { className: "flex items-baseline justify-between", style: { height: 22 } },
        h("span", { style: { fontFamily: F_DISPLAY, fontSize: "calc(13.5px * var(--app-fs, 1))", color: "#6b5a45" } }, fmtD(e.date)),
        h("span", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: isMe ? "#a08a5e" : "#b0708a" } }, isMe ? "我写的" : partner.name + " 写的")),
      (e.weather || e.mood) ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: "#a1907a", marginBottom: 2 } },
        (e.weather ? "天气：" + e.weather : "") + (e.weather && e.mood ? " · " : "") + (e.mood ? "心情：" + e.mood : "")) : null,
      h("div", { style: { fontFamily: "'Noto Serif SC',serif", fontSize: "calc(13.5px * var(--app-fs, 1))", lineHeight: RULE_H + "px", color: "#4b3f33", whiteSpace: "pre-wrap" } }, STX(e.content)),
      isMe && !e.replied ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: "#a1907a", marginTop: 6, fontStyle: "italic" } }, "写完了，本子递过去了") : null);
  };
  return h("div", { "data-wk": "uspage", "data-part": "coupleexdiary", className: "h-full flex flex-col", style: { background: t.bg,
    backgroundImage: "repeating-linear-gradient(135deg,rgba(120,95,70,.03) 0 2px,rgba(0,0,0,0) 2px 7px)" } },
    h(Head, { zh: "交换日记", en: partner.name, onBack, bg: "transparent" }),
    h("div", { className: "flex-1 min-h-0 overflow-y-auto px-6 pb-8" },
      h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.fog, lineHeight: 1.7, marginTop: 4, marginBottom: 12 } }, "一本只有你俩看的本子：想写就写一页，TA 会在三天内找个时候回一页——写 TA 那天的事、和没说出口的话。"),
      writing ? h("div", { style: Object.assign({ position: "relative", borderRadius: 3, marginBottom: 15, padding: "12px 15px 14px 28px",
        border: "1px solid #e6dac0", boxShadow: "0 8px 20px rgba(70,52,40,.11)" }, paperOf(true)) },
        seam(true),
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(13.5px * var(--app-fs, 1))", color: "#6b5a45", height: 22 } }, fmtD(new Date().getFullYear() + "-" + (new Date().getMonth() + 1) + "-" + new Date().getDate())),
        // 输入框自己不上底、不描边：字要落在这一页的格子上，不是浮在纸上的另一个盒子
        h("textarea", { "data-wk": "textarea", value: body, onChange: e => setBody(e.target.value), placeholder: "写点什么给 TA 看…", rows: 6,
          style: { width: "100%", outline: "none", resize: "none", background: "transparent", border: "none", padding: 0,
            fontFamily: "'Noto Serif SC',serif", fontSize: "calc(13.5px * var(--app-fs, 1))", lineHeight: RULE_H + "px", color: "#4b3f33" } }),
        h("input", { "data-wk": "input", value: moodW, onChange: e => setMoodW(e.target.value), placeholder: "此刻心情（可空，如：有点想你）",
          style: { width: "100%", outline: "none", marginTop: 6, padding: "7px 10px", borderRadius: 8, fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))",
            background: "rgba(255,255,255,.5)", color: "#4b3f33", border: "1px dashed rgba(120,105,70,.35)" } }),
        h("div", { className: "flex items-center gap-3", style: { marginTop: 10 } },
          h("button", { onClick: () => { if (body.trim()) { onAdd(partner, body, moodW); setBody(""); setMoodW(""); setWriting(false); } }, disabled: !body.trim(), className: "active:opacity-70 disabled:opacity-40", style: { background: "#8d7440", color: "#fff", fontFamily: F_DISPLAY, fontSize: "calc(13.5px * var(--app-fs, 1))", padding: "9px 20px", borderRadius: 8 } }, "合上，递过去"),
          h("button", { onClick: () => setWriting(false), className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: "#a1907a", minHeight: 40 } }, "撕掉")))
      // 「写一页」不是一颗实心药丸，是【本子上还空着的下一页】
      : h("button", { onClick: () => setWriting(true), className: "w-full text-left active:opacity-75",
          style: Object.assign({ position: "relative", display: "block", marginBottom: 15, borderRadius: 3, padding: "16px 15px 17px 28px",
            border: "1px dashed " + (pending ? "#e0cfc9" : "#ddd0b2"), boxShadow: "none" }, paperOf(!pending)) },
          seam(!pending),
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(15px * var(--app-fs, 1))", color: "#6b5a45" } }, pending ? "本子在 TA 那边 · 还想写就再翻一页" : "翻开空着的下一页"),
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: "#a1907a", marginTop: 4 } }, pending ? "TA 这几天会写一页回给你" : "写完合上，本子就递过去了")),
      mine.length ? mine.map(page) : h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.fog, textAlign: "center", marginTop: 24 } }, "本子还是空的——写下第一页吧。")));
}

// 情侣空间·双向便签墙（悄悄话串）：我贴→TA 自动回；TA 的要点一下才看得到，再点开全屏留言互动
// 便签纸张样式：纯色 / 横线 / 格纹 / 圆点 / 带粉角，可爱多样
// 便签墙 v59.23 整个撤掉（她 2026-08-31：「便签墙有必要吗，我觉得有点鸡肋」）。
// 情书、交换日记、便签墙三样都是「TA写字给你」：情书有「一封」的分量，交换日记
// 有「轮流」，便签墙只是「短」，没有自己的形状。它唯一独有的是「TA不请自来贴的
// 那一张」——那件事抽屉本来就在做，所以悄悄话并进抽屉，这一整页删掉。
// ⚠️切的时候差点把紧跟其后的 COUPLE_MOODS / moodFaceOf 一起带走（浏览器里白屏，
// 而 node --check 和整套测试一个字都不会说）。按【下一个顶层声明】收口，别按行数。
const COUPLE_MOODS = [
  { key: "relax", label: "轻松", emoji: "😌", color: "#bcd3f0", ink: "#5b7fb0" },
  { key: "surprise", label: "惊喜", emoji: "🤩", color: "#bfe3c6", ink: "#4f9d6a" },
  { key: "gloomy", label: "郁闷", emoji: "😔", color: "#ece1b0", ink: "#a99436" },
  { key: "sad", label: "难过", emoji: "😢", color: "#c3e0b0", ink: "#6f9b57" },
  { key: "happy", label: "开心", emoji: "😄", color: "#f2cfd2", ink: "#d16b86" },
  { key: "irritated", label: "烦躁", emoji: "😣", color: "#eea3a3", ink: "#c65a5a" },
  { key: "proud", label: "骄傲", emoji: "😎", color: "#f2c88f", ink: "#c98a3e" },
  { key: "cozy", label: "舒畅", emoji: "🥰", color: "#f2c0c8", ink: "#d16f8a" },
  { key: "amazed", label: "惊讶", emoji: "😲", color: "#f0dc8f", ink: "#c2a53c" }
];
const moodBy = k => COUPLE_MOODS.find(m => m.key === k);
// 把【真心情】那套中文标签映射到这九张脸上（MoodLabel.EN_ZH 的值域）。
// v58.90 之前情侣空间里那两格看的是「心情打卡」——一次调用，模型在看不见你俩
// 今天发生过什么的情况下瞎选一个表情，跟TA真实的心情各走各的。现在两格直接读真心情。
const MOOD_FACE = {
  开心: "happy", 喜悦: "happy", 兴奋: "happy", 愉快: "happy", 欣喜: "happy",
  温柔: "cozy", 柔软: "cozy", 亲昵: "cozy", 爱意满满: "cozy", 感激: "cozy", 满足: "cozy",
  平静: "relax", 安宁: "relax", 放松: "relax", 若有所思: "relax", 如释重负: "relax",
  骄傲: "proud", 有成就感: "proud", 自信: "proud", 坚定: "proud",
  期待: "surprise", 好奇: "surprise", 专注: "surprise",
  惊讶: "amazed", 困惑: "amazed",
  难过: "sad", 受伤: "sad", 失望: "sad", 孤独: "sad", 害怕: "sad",
  疲惫: "gloomy", 困倦: "gloomy", 无聊: "gloomy", 挫败: "gloomy", 担心: "gloomy",
  焦虑: "gloomy", 紧张: "gloomy", 愧疚: "gloomy", 害羞: "gloomy", 吃醋: "gloomy",
  烦躁: "irritated", 生气: "irritated"
};
// 认不出来就不画脸，只出那几个字——瞎配一张脸比不画更糟
const moodFaceOf = label => MOOD_FACE[String(label || "").trim()] || null;
// 手绘感心情圆脸（替换系统 emoji，风格照用户「心情罐头」参考图：柔和圆脸 + 简单表情）
function MoodGlyph({ mood, size }) {
  const m = moodBy(mood) || COUPLE_MOODS[0];
  const s = size || 24;
  const ink = m.ink || "#7a6a55";
  const sk = { fill: "none", stroke: ink, strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" };
  const thin = Object.assign({}, sk, { strokeWidth: 1.3 });
  const dot = (cx, cy) => h("circle", { cx: cx, cy: cy == null ? 10.3 : cy, r: 1.45, fill: ink });
  const arcEye = cx => h("path", Object.assign({ d: "M" + (cx - 1.7) + " 10.8 Q" + cx + " 8.9 " + (cx + 1.7) + " 10.8" }, sk));
  const starEye = cx => h("path", Object.assign({ d: "M" + cx + " 8.4 L" + cx + " 12 M" + (cx - 1.6) + " 10.2 L" + (cx + 1.6) + " 10.2" }, thin));
  let eyes, mouth, extra = null;
  switch (mood) {
    case "happy": eyes = [dot(8.6), dot(15.4)]; mouth = h("path", Object.assign({ d: "M8 13.6 Q12 18.4 16 13.6" }, sk)); break;
    case "relax": eyes = [arcEye(8.6), arcEye(15.4)]; mouth = h("path", Object.assign({ d: "M9.2 14.4 Q12 16.4 14.8 14.4" }, sk)); break;
    case "cozy": eyes = [arcEye(8.6), arcEye(15.4)]; mouth = h("path", Object.assign({ d: "M9 14.4 Q12 16.9 15 14.4" }, sk)); extra = [h("circle", { cx: 6.6, cy: 13.6, r: 1.5, fill: "#ff9db0", opacity: 0.5 }), h("circle", { cx: 17.4, cy: 13.6, r: 1.5, fill: "#ff9db0", opacity: 0.5 })]; break;
    case "surprise": eyes = [starEye(8.6), starEye(15.4)]; mouth = h("path", Object.assign({ d: "M8.4 14 Q12 18 15.6 14" }, sk)); break;
    case "proud": eyes = [h("rect", { x: 6.3, y: 9, width: 4.5, height: 3, rx: 1.3, fill: ink }), h("rect", { x: 13.2, y: 9, width: 4.5, height: 3, rx: 1.3, fill: ink }), h("path", Object.assign({ d: "M10.8 10.2 L13.2 10.2" }, thin))]; mouth = h("path", Object.assign({ d: "M9 14.4 Q12.8 16.9 15.4 13.8" }, sk)); break;
    case "amazed": eyes = [dot(8.6, 10), dot(15.4, 10)]; mouth = h("ellipse", { cx: 12, cy: 15.2, rx: 1.9, ry: 2.4, fill: ink }); break;
    case "gloomy": eyes = [dot(8.6, 10.7), dot(15.4, 10.7)]; mouth = h("path", Object.assign({ d: "M9 15.7 Q12 14.5 15 15.7" }, sk)); break;
    case "sad": eyes = [dot(8.6, 10.7), dot(15.4, 10.7)]; mouth = h("path", Object.assign({ d: "M9 16 Q12 13.8 15 16" }, sk)); extra = [h("path", { d: "M8 12.4 q-1.1 2.1 0 2.9 q1.1 -0.8 0 -2.9", fill: "#8fc3e8" })]; break;
    case "irritated": eyes = [dot(8.6, 11), dot(15.4, 11), h("path", Object.assign({ d: "M6.8 8.6 L10 9.8" }, thin)), h("path", Object.assign({ d: "M17.2 8.6 L14 9.8" }, thin))]; mouth = h("path", Object.assign({ d: "M8.6 15 q1.7 -1.5 3.4 0 q1.7 1.5 3.4 0" }, sk)); break;
    default: eyes = [dot(8.6), dot(15.4)]; mouth = h("path", Object.assign({ d: "M9 14.5 Q12 16.5 15 14.5" }, sk));
  }
  const base = h("circle", { cx: 12, cy: 12, r: 10.6, fill: m.color, stroke: ink, strokeWidth: 1.4, strokeOpacity: 0.5 });
  const kids = [base].concat(eyes, [mouth], extra || []).filter(Boolean).map((el, i) => React.cloneElement(el, { key: i }));
  return h("svg", { width: s, height: s, viewBox: "0 0 24 24", style: { display: "block", overflow: "visible" } }, kids);
}
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
function CoupleDays({ partner, since, events, annivs, onAdd, onRemove, onRead, onGen, onAddAnniv, onRemoveAnniv, gen, onBack }) {
  const t = useTheme();
  // TA留下的感慨带 unread（名册红点看它）；进来看一眼就算看过——跟交换日记同一个形状
  useEffect(() => { onRead && onRead(partner.id); }, []);
  // 排序前把日期补零归一：老存档里「TA留下的」那几条是 "2026-9-4" 这种没补零的写法，
  // 直接按字符串比会被排到十月后面一整年的位置。
  const padD = s => String(s || "").split("-").map((x, i) => i ? String(x).padStart(2, "0") : x).join("-");
  const mine = (events || []).filter(e => e.characterId === partner.id).slice().sort((a, b) => { const da = padD(a.date), db = padD(b.date); return da < db ? 1 : da > db ? -1 : b.createdAt - a.createdAt; });
  // 下一次在哪天全走 annivNext（core.js）：不重复的过了就是过了，不再滚到明年倒数。
  const annivInfo = a => { const nx = annivNext(a); return { days: nx.days, y: new Date(nx.ts).getFullYear(), passed: nx.passed }; };
  // 过期的（不重复且已过）沉到最底下，像翻过去的日历页；没过的照旧按远近排
  const anns = (annivs || []).filter(a => a.characterId === partner.id).slice().sort((a, b) => {
    const ia = annivInfo(a), ib = annivInfo(b);
    if (ia.passed !== ib.passed) return ia.passed ? 1 : -1;
    return ia.passed ? ib.days - ia.days : ia.days - ib.days;
  });
  const [addMode, setAddMode] = useState(null);
  const [date, setDate] = useState(""); const [title, setTitle] = useState(""); const [content, setContent] = useState("");
  const [an, setAn] = useState(""); const [mo, setMo] = useState(""); const [dy, setDy] = useState(""); const [yearly, setYearly] = useState(true); const [link, setLink] = useState(true);
  // 年份（v62.41）：每年重复的那一档不需要它；只发生一次的那一档没有它就只能靠猜。
  const [yr, setYr] = useState("");
  const md = s => { const p = (s || "").split("-"); return p.length === 3 ? p[0] + "年" + (+p[1]) + "月" + (+p[2]) + "日" : s; };
  const startDate = since ? (function () { const d = new Date(since); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); })() : null;
  const submitMile = () => { if (date && title.trim()) { onAdd(partner, date, title, content); setDate(""); setTitle(""); setContent(""); setAddMode(null); } };
  const submitAnn = () => { if (an.trim() && mo && dy) { onAddAnniv(partner, an, mo, dy, yearly, link, yearly ? null : yr); setAn(""); setMo(""); setDy(""); setYr(""); setAddMode(null); } };
  const toggle = (on, set, label) => h("button", { "data-wk": "block", onClick: () => set(v => !v), className: "active:opacity-70 flex items-center gap-1.5", style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: on ? t.ink : t.fog } }, h("span", { style: { width: 15, height: 15, borderRadius: 4, background: on ? t.ink : "transparent", border: "1px solid " + (on ? t.ink : t.line), color: t.bg2, fontSize: "calc(11px * var(--app-fs, 1))", display: "flex", alignItems: "center", justifyContent: "center" } }, on ? "✓" : ""), label);
  // 纸上写字就是写在【线】上，不是写进一个圆角灰框里（她 2026-09-04：「很普通的框」）
  const line1 = { width: "100%", outline: "none", padding: "6px 2px 7px", fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))",
    background: "transparent", color: t.ink, border: "none", borderBottom: "1px dashed " + t.line };
  // ── 时光轴说的和名册那条「走过来的路」是同一件事，v62.15 起用同一种语言：
  // 路色 #e08aa0、今天是末端实心点、她记的是路上的实心点、TA 留的是空心环
  //（形状不同，不只色差）。每条带「第 N 天」——第一次们那册已经在用这个语言。
  const dayN = ds => {
    if (!since) return "";
    const t2 = Date.parse(padD(ds));
    if (!Number.isFinite(t2)) return "";
    const n = Math.floor((t2 - since) / 86400000) + 1;
    return n > 0 ? "第 " + n + " 天" : "";
  };
  const ROAD = "#e08aa0", ROAD_DOT = "#d16a86";
  const node = (ev, isStart) => h("div", { key: ev ? ev.id : "start", className: "flex gap-3" },
    h("div", { style: { flexShrink: 0, width: 12, display: "flex", flexDirection: "column", alignItems: "center" } },
      isStart
        ? h("div", { "data-wk": "block", style: { width: 12, height: 12, borderRadius: 999, background: ROAD_DOT, boxShadow: "0 0 0 3px rgba(224,138,160,.25)", marginTop: 4 } })
        : ev.byCharacter
        ? h("div", { "data-wk": "block", style: { width: 11, height: 11, borderRadius: 999, background: "transparent", border: "2px solid " + ROAD_DOT, marginTop: 4 } })
        : h("div", { style: { width: 9, height: 9, borderRadius: 999, background: ROAD_DOT, marginTop: 5 } }),
      isStart ? null : h("div", { "data-wk": "block", style: { flex: 1, width: 2, background: "linear-gradient(" + ROAD + ", rgba(224,138,160,.35))", marginTop: 2, borderRadius: 2 } })),
    h("div", { style: { flex: 1, paddingBottom: 18 } },
      h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog } },
        isStart ? "起点 · " + md(startDate) : md(ev.date) + (dayN(ev.date) ? " · " + dayN(ev.date) : "")),
      isStart ? h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(16px * var(--app-fs, 1))", color: t.ink, marginTop: 2 } }, "和 " + partner.name + " 在一起") : h(Fragment, null,
        h("div", { className: "flex items-center gap-2", style: { marginTop: 2 } },
          ev.byCharacter ? h("span", { style: { fontFamily: F_BODY, fontSize: "calc(10px * var(--app-fs, 1))", color: "#b06e6e", border: "1px solid #e3c3c3", borderRadius: 999, padding: "1px 7px" } }, "TA 的感慨") : null,
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(15.5px * var(--app-fs, 1))", color: t.ink } }, STX(ev.title))),
        ev.content ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", lineHeight: 1.6, color: t.sub, marginTop: 3, whiteSpace: "pre-wrap" } }, STX(ev.content)) : null,
        h("button", { onClick: () => onRemove(ev.id), className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog, marginTop: 4 } }, "删除"))));
  // 轴顶那个「今天」端点：路走到的地方（跟名册末端那个实心点同一个东西）
  const todayCap = since ? h("div", { className: "flex gap-3", style: { marginBottom: 2 } },
    h("div", { style: { flexShrink: 0, width: 12, display: "flex", flexDirection: "column", alignItems: "center" } },
      h("div", { style: { width: 7, height: 7, borderRadius: 999, background: ROAD_DOT, marginTop: 5 } }),
      h("div", { "data-wk": "block", style: { height: 14, width: 2, background: "linear-gradient(rgba(224,138,160,.35), " + ROAD + ")", marginTop: 2, borderRadius: 2 } })),
    h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: ROAD_DOT, paddingTop: 3 } },
      "今天 · 第 " + Math.max(1, Math.floor((Date.now() - since) / 86400000) + 1) + " 天")) : null;
  return h("div", { "data-wk": "uspage", "data-part": "coupledays", className: "h-full flex flex-col", style: cpSkin(t, "wall") },
    h(Head, { zh: "我们的日子", sub: partner.remark || partner.name, bg: "transparent", onBack,
      right: h("button", { onClick: () => onGen(partner), disabled: gen, className: "active:opacity-50 disabled:opacity-40" }, h(IRefresh, { size: 18, color: t.ink })) }),
    h("div", { className: "flex-1 min-h-0 overflow-y-auto px-6 pb-8" },
      // ── 两个入口不是按钮，是【那两样东西本身】（tabs-not-plain-pills.md，她 2026-09-04：
      //    「还是两颗药丸和很普通的框」）。这一页现实里是什么？一条走过来的路 + 一本挂历。
      //    所以：里程碑＝往路上钉一处（路段＋实心点，跟底下时光轴同一套颜色）；
      //         纪念日＝撕一张日历页（跟倒数那一列同一张 CalPage）。
      //    选中那一张【长进底下那张纸里】（下沿方角、纸接着往下铺），照账本索引标签那套语言。
      h("div", { className: "flex", style: { gap: 10, margin: "10px 0 0", alignItems: "stretch" } },
        [["mile", "钉一处", "路上真发生过的一天",
          h("div", { "aria-hidden": "true", className: "flex items-center", style: { height: 26, gap: 0 } },
            h("div", { style: { flex: 1, height: 2, borderRadius: 2, background: "linear-gradient(90deg,rgba(224,138,160,.25)," + ROAD + ")" } }),
            h("div", { "data-wk": "block", style: { width: 11, height: 11, borderRadius: 999, background: ROAD_DOT, boxShadow: "0 0 0 3px rgba(224,138,160,.22)" } }),
            h("div", { style: { flex: 1, height: 2, borderRadius: 2, background: "linear-gradient(90deg," + ROAD + ",rgba(224,138,160,.25))" } }))],
         ["anniv", "撕一张", "还没到、值得等的那天",
          h("div", { "aria-hidden": "true", className: "flex justify-center", style: { height: 26 } },
            h(CalPage, { w: 30, head: "", body: "" }))]
        ].map(([k, zh, sub, art]) => {
          const on = addMode === k;
          return h("button", { key: k, onClick: () => setAddMode(m => m === k ? null : k), className: "flex-1 active:opacity-80",
            style: { padding: "11px 10px 12px", textAlign: "center",
              borderRadius: on ? "14px 14px 0 0" : 14,
              background: on ? t.bg2 : "transparent",
              border: "1px solid " + (on ? t.line : "rgba(0,0,0,0)"),
              borderBottom: on ? "1px solid " + t.bg2 : "1px solid rgba(0,0,0,0)",
              marginBottom: on ? -1 : 0, position: "relative", zIndex: on ? 1 : 0,
              opacity: on || !addMode ? 1 : 0.45, transition: "opacity .15s" } },
            art,
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(14px * var(--app-fs, 1))", color: t.ink, marginTop: 7 } }, on ? "收起" : zh),
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10px * var(--app-fs, 1))", color: t.fog, marginTop: 2 } }, sub));
        })),
      // 底下那张纸：跟选中的那一格接成一体
      addMode ? h("div", { "data-wk": "block", style: { background: t.bg2, border: "1px solid " + t.line, borderRadius: addMode === "mile" ? "0 14px 14px 14px" : "14px 0 14px 14px", padding: "14px 14px 13px", marginBottom: 8 } },
        addMode === "mile" ? h("div", { className: "flex", style: { gap: 12 } },
          // 表单左边就是那条路：输入的这一处正钉在上面
          h("div", { "aria-hidden": "true", style: { width: 11, flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 6 } },
            h("div", { style: { width: 9, height: 9, borderRadius: 999, background: ROAD_DOT } }),
            h("div", { style: { flex: 1, width: 2, borderRadius: 2, background: "linear-gradient(" + ROAD + ",rgba(224,138,160,.28))", marginTop: 3 } })),
          h("div", { className: "flex-1 min-w-0 space-y-2" },
            h("input", { type: "date", value: date, onChange: e => setDate(e.target.value), style: line1 }),
            h("input", { "data-wk": "input", value: title, onChange: e => setTitle(e.target.value), placeholder: "这一天发生了什么", style: Object.assign({}, line1, { fontFamily: F_DISPLAY, fontSize: "calc(16px * var(--app-fs, 1))" }) }),
            h("textarea", { "data-wk": "textarea", value: content, onChange: e => setContent(e.target.value), rows: 2, placeholder: "想记住的细节（选填）", style: Object.assign({}, line1, { resize: "none", lineHeight: 1.6 }) }),
            h("button", { "data-wk": "block", onClick: submitMile, disabled: !date || !title.trim(), className: "active:opacity-70 disabled:opacity-40", style: { marginTop: 4, background: ROAD_DOT, color: "#fff", fontFamily: F_DISPLAY, fontSize: "calc(14px * var(--app-fs, 1))", padding: "9px 22px", borderRadius: 999 } }, "钉在这一天")))
        : h("div", null,
          // 纪念日就在这张日历页上填：名字写在红头里，月日就是那页的大字
          h("div", { style: { borderRadius: 9, overflow: "hidden", border: "1px solid " + t.line, boxShadow: "0 3px 10px rgba(0,0,0,.10)" } },
            h("div", { style: { position: "relative", background: "#c25a5a", padding: "7px 12px 8px" } },
              h("div", { "aria-hidden": "true", style: { position: "absolute", top: 3, left: "26%", width: 5, height: 5, borderRadius: 999, background: "rgba(255,255,255,.5)" } }),
              h("div", { "aria-hidden": "true", style: { position: "absolute", top: 3, right: "26%", width: 5, height: 5, borderRadius: 999, background: "rgba(255,255,255,.5)" } }),
              h("input", { "data-wk": "input", value: an, onChange: e => setAn(e.target.value), placeholder: "这一天叫什么", className: "w-full outline-none text-center",
                style: { background: "transparent", color: "#fff", fontFamily: F_DISPLAY, fontSize: "calc(14.5px * var(--app-fs, 1))", padding: "2px 0" } })),
            // 年份就写在红头底下这一条，跟挂历上年份的位置一样。
            // 每年重复的那一档不发这一行——它压根没有「哪一年」这个问题，摆着只会让人以为要填。
            yearly ? null : h("div", { className: "flex items-center justify-center", style: { background: "#b85252", gap: 5, padding: "5px 0 6px" } },
              h("input", { "data-wk": "input", type: "number", value: yr, onChange: e => setYr(e.target.value), placeholder: String(new Date().getFullYear()), className: "outline-none text-right",
                style: { width: 62, background: "transparent", color: "#fff", fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", letterSpacing: ".1em" } }),
              h("span", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: "rgba(255,255,255,.7)" } }, "年")),
            h("div", { className: "flex items-baseline justify-center", style: { background: t.bg2, gap: 4, padding: "12px 0 13px" } },
              h("input", { "data-wk": "input", type: "number", value: mo, onChange: e => setMo(e.target.value), placeholder: "—", className: "outline-none text-right",
                style: { width: 52, background: "transparent", color: t.ink, fontFamily: F_DISPLAY, fontSize: "calc(30px * var(--app-fs, 1))", lineHeight: 1 } }),
              h("span", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.fog } }, "月"),
              h("input", { "data-wk": "input", type: "number", value: dy, onChange: e => setDy(e.target.value), placeholder: "—", className: "outline-none text-right",
                style: { width: 52, background: "transparent", color: t.ink, fontFamily: F_DISPLAY, fontSize: "calc(30px * var(--app-fs, 1))", lineHeight: 1 } }),
              h("span", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.fog } }, "日"))),
          h("div", { className: "flex items-center", style: { gap: 18, marginTop: 12 } }, toggle(yearly, setYearly, "每年重复"), toggle(link, setLink, "加进日历")),
          h("button", { "data-wk": "block", onClick: submitAnn, disabled: !an.trim() || !mo || !dy, className: "active:opacity-70 disabled:opacity-40", style: { marginTop: 12, background: "#c25a5a", color: "#fff", fontFamily: F_DISPLAY, fontSize: "calc(14px * var(--app-fs, 1))", padding: "9px 22px", borderRadius: 999 } }, "挂上去"))) : null,
      anns.length ? h(Eyebrow, { style: { marginTop: 16, marginBottom: 8 } }, "倒数中") : null,
      h("div", { className: "space-y-2.5", style: { marginBottom: anns.length ? 6 : 0 } },
        // 倒数的那一天在现实里长在【日历页】上（v62.15）：左边一张小挂历——红头写月、
        // 大字写日、顶上两个挂孔；过期的整页压灰，红头也褪色。
        anns.map(a => { const info = annivInfo(a); return h("div", { "data-wk": "block", key: a.id, className: "flex items-center gap-3", style: { background: t.bg2, border: "1px solid " + t.line, borderRadius: 16, padding: "11px 15px 11px 12px", opacity: info.passed ? 0.55 : 1 } },
          h(CalPage, { month: a.month, day: a.day, dim: info.passed }),
          h("div", { className: "flex-1 min-w-0" },
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(15.5px * var(--app-fs, 1))", color: t.ink } }, a.name),
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog, marginTop: 2 } }, info.y + "年" + a.month + "月" + a.day + "日" + (a.yearlyRepeat ? " · 每年" : " · 只这一次"))),
          h("div", { style: { textAlign: "right" } },
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: info.passed ? 15 : 20, fontStyle: "italic", color: info.days === 0 ? t.accent : info.passed ? t.fog : t.ink, lineHeight: 1 } }, info.days === 0 ? "今天" : info.passed ? "已过去" : info.days),
            info.days === 0 ? null : h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10px * var(--app-fs, 1))", color: t.fog, marginTop: 2 } }, info.passed ? (-info.days) + " 天" : "天后")),
          h("button", { onClick: () => onRemoveAnniv(a.id), "aria-label": "删掉这个纪念日", className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: "calc(15px * var(--app-fs, 1))", color: t.fog, paddingLeft: 4, minHeight: 40 } }, "×")); })),
      h(Eyebrow, { style: { marginTop: anns.length ? 16 : 10, marginBottom: 10 } }, "时光轴"),
      h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog, marginBottom: 10 } }, "右上角让 " + partner.name + " 写一条此刻的感慨。"),
      gen && h(Spinner, { label: partner.name + " 正在写…" }),
      h("div", null, todayCap, mine.map(ev => node(ev, false)), startDate ? node(null, true) : null)));
}

// 情书信纸字体（iOS 系统中文字体，零成本；非 iOS 走 fallback）+ 纸张样式
const LETTER_FONTS = [
  { key: "auto", label: "🎲 智能 / 随机" },
  { key: "serif", label: "宋体信笺", css: "'Noto Serif SC','Songti SC',serif" },
  { key: "kai", label: "楷体手写", css: "'Kaiti SC','STKaiti','KaiTi',serif" },
  { key: "round", label: "圆体可爱", css: "'Yuanti SC','PingFang SC',sans-serif" },
  { key: "sans", label: "现代简洁", css: "'PingFang SC',system-ui,sans-serif" },
  // 下面这些都是 iOS 自带的中文字体，零成本；非 iOS 一路 fallback 回宋/黑
  { key: "xingkai", label: "行楷疾书", css: "'Xingkai SC','STXingkai','Kaiti SC',cursive" },
  { key: "hannotate", label: "手札随笔", css: "'Hannotate SC','HanziPen SC','Kaiti SC',cursive" },
  { key: "hanzipen", label: "翩翩细笔", css: "'HanziPen SC','Hannotate SC','Kaiti SC',cursive" },
  { key: "libian", label: "隶变旧体", css: "'Libian SC','Baoli SC','Songti SC',serif" },
  { key: "baoli", label: "报隶端方", css: "'Baoli SC','Libian SC','Songti SC',serif" },
  { key: "weibei", label: "魏碑刻痕", css: "'Weibei SC','Songti SC',serif" },
  { key: "yuppy", label: "雅痞不羁", css: "'Yuppy SC','PingFang SC',sans-serif" },
  { key: "wawa", label: "娃娃稚气", css: "'Wawati SC','Yuanti SC','PingFang SC'" },
  { key: "lanting", label: "兰亭细体", css: "'Lantinghei SC','PingFang SC',sans-serif" }
];
const letterFontCss = key => { const f = LETTER_FONTS.find(x => x.key === key && x.css); return f ? f.css : LETTER_FONTS[1].css; };
const LETTER_PAPERS = [
  { key: "cream", label: "米白", bg: "#faf6ee", ink: "#413a2e", line: "#ece2d0" },
  { key: "kraft", label: "牛皮", bg: "#e9ddc6", ink: "#4a3f2c", line: "#d6c7a8" },
  { key: "pink", label: "樱粉", bg: "#fdeef1", ink: "#5a3a44", line: "#f4d6de" },
  { key: "blue", label: "天蓝", bg: "#eef4fb", ink: "#33455a", line: "#d7e4f2" },
  { key: "mint", label: "薄荷", bg: "#eef7f0", ink: "#2f4a3a", line: "#d5ebda" },
  { key: "sepia", label: "旧信", bg: "#f0e4cf", ink: "#5b4527", line: "#dcc9a6" },
  { key: "lilac", label: "藕荷", bg: "#f3eefa", ink: "#453558", line: "#e2d7f0" },
  { key: "celadon", label: "竹青", bg: "#e8f0ea", ink: "#2c4740", line: "#cfe0d5" },
  { key: "apricot", label: "杏黄", bg: "#fdf1de", ink: "#5c4322", line: "#f0dcbb" },
  { key: "rice", label: "宣纸", bg: "#f7f4ec", ink: "#3b3a34", line: "#e6e1d3" },
  { key: "slate", label: "石青", bg: "#e6ecef", ink: "#2b3d46", line: "#ccd9de" },
  { key: "dusk", label: "暮色", bg: "#efe6e2", ink: "#513c3a", line: "#dfd0c9" },
  // 深色那两张：夜里写信的人也得有纸。ink 反过来是浅色，横格是暗一档的线
  { key: "night", label: "夜笺", bg: "#2b2f38", ink: "#e3e6ee", line: "#3d434f" },
  { key: "ink", label: "墨蓝", bg: "#232c3a", ink: "#dfe6f2", line: "#334053" }
];
const letterPaper = key => LETTER_PAPERS.find(p => p.key === key) || LETTER_PAPERS[0];

// 挑纸和挑字体这两样，四处都要用（设置页、写信页），所以做成公用的两块。
// 纸样不画成一个圆色块——画成【一小张有横格的纸】，上面用那张纸自己的墨色写个「字」：
// 一张信纸长什么样，只有把横格和墨色一起看见才知道。
function LetterPaperPick({ value, onPick, withAuto }) {
  const t = useTheme();
  const cell = (key, label, bg, ink, line) => {
    const on = value === key;
    return h("button", { key, onClick: () => onPick(key), className: "active:opacity-80 flex flex-col items-center", style: { gap: 5, width: 62, paddingTop: 2 } },
      h("div", { "data-wk": "block", style: { position: "relative", width: 46, height: 58, borderRadius: 3, background: bg, border: (on ? "1.5px solid " + t.ink : "1px solid " + t.line), boxShadow: on ? "0 3px 10px rgba(0,0,0,.16)" : "0 1px 3px rgba(0,0,0,.06)", transform: on ? "translateY(-2px)" : "none", transition: "transform .15s", overflow: "hidden" } },
        line ? h("div", { "aria-hidden": "true", style: { position: "absolute", inset: 0, backgroundImage: "repeating-linear-gradient(transparent 0 8px," + line + " 8px 9px)", opacity: 0.9 } }) : null,
        h("div", { style: { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F_DISPLAY, fontSize: "calc(17px * var(--app-fs, 1))", color: ink || t.ink } }, key === "auto" ? "🎲" : "字"),
        // 选中不只靠边框：右下角折一个角，形状也变了（色弱和阳光下只剩形状可依）
        on ? h("div", { "aria-hidden": "true", style: { position: "absolute", right: 0, bottom: 0, width: 0, height: 0, borderLeft: "12px solid transparent", borderBottom: "12px solid " + t.ink } }) : null),
      h("span", { style: { fontFamily: F_BODY, fontSize: "calc(10px * var(--app-fs, 1))", color: on ? t.ink : t.fog } }, label));
  };
  return h("div", { className: "flex flex-wrap", style: { gap: 4 } },
    withAuto ? cell("auto", "随机", "linear-gradient(135deg,#faf6ee,#fdeef1,#eef4fb,#eef7f0)", "#5a4a44", null) : null,
    LETTER_PAPERS.map(p => cell(p.key, p.label, p.bg, p.ink, p.line)));
}
// 字体：每一款都用它自己写一遍名字，不然全是一样的方块，选了也不知道选的什么
function LetterFontPick({ value, onPick, withAuto }) {
  const t = useTheme();
  const list = withAuto ? LETTER_FONTS : LETTER_FONTS.filter(f => f.css);
  return h("div", { className: "flex flex-wrap", style: { gap: 7 } },
    list.map(f => { const on = value === f.key; return h("button", { "data-wk": "block", key: f.key, onClick: () => onPick(f.key), className: "active:opacity-70 flex items-center", style: { gap: 6, minHeight: 40, padding: "8px 13px", borderRadius: 4, fontFamily: f.css || F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", background: on ? t.ink : t.bg2, color: on ? t.bg : t.sub, border: "1px solid " + (on ? t.ink : t.line) } },
      // 选中那一款左边多一道竖杠（像笔尖压下去的一道），不靠颜色一样分得清
      on ? h("span", { "aria-hidden": "true", style: { width: 2, height: 14, background: t.bg, borderRadius: 2 } }) : null,
      f.label); }));
}

// 情书设置：整页（施工规则/no-half-sheet.md）——纸样和字体加起来快三十个，
// 半窗里挤成两行滑不动；何况这一页不需要同时看见底下那一层。
function CoupleLetterSettings({ partner, cfg, onSave, onBack }) {
  const t = useTheme();
  const c = Object.assign({ auto: false, freqDays: 7, freqRandom: true, font: "auto", paper: "auto" }, cfg || {});
  const set = patch => onSave(partner.id, Object.assign({}, c, patch));
  const sect = (title, sub, body) => h("div", { style: { marginBottom: 26 } },
    h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(14.5px * var(--app-fs, 1))", color: t.ink, marginBottom: sub ? 3 : 10 } }, title),
    sub ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog, marginBottom: 10 } }, sub) : null,
    body);
  // 底跟【我们的情书】同一张信封纸（v64.24）：设置是从那一叠里翻出来的一页，
  // 不该退回米白。顶栏也换成公共 Head——原来这儿是手写的一条，
  // 于是「紧凑标题栏」那条规矩每来一页就得重新想起一次（mobile-ui-layout §1）。
  return h("div", { "data-wk": "uspage", "data-part": "couplelettersettings", className: "h-full flex flex-col", style: letterSkin(t) },
    h(Head, { zh: "情书设置", sub: partner && partner.name ? "写给 " + (partner.remark || partner.name) + " 的那一叠" : "", bg: "transparent", onBack: onBack }),
    h("div", { className: "flex-1 min-h-0 overflow-y-auto", style: { padding: "18px 22px 40px", overscrollBehavior: "contain" } },
      h("div", { className: "flex items-center justify-between", style: { marginBottom: 24 } },
        h("div", { style: { paddingRight: 14 } },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(15px * var(--app-fs, 1))", color: t.ink } }, "让 " + partner.name + " 自己写"),
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog, marginTop: 3, lineHeight: 1.6 } }, "开着的话，你进来时 TA 会不定期写一封（前台生效）")),
        h(Toggle, { on: !!c.auto, onChange: v => set({ auto: v }), label: "自动写情书" })),
      sect("多久写一封", "随机波动＝在这个天数上下浮动，不会每次都卡着同一天",
        h("div", { className: "flex items-center", style: { gap: 12 } },
          h("input", { "data-wk": "input", type: "number", value: c.freqDays, onChange: e => set({ freqDays: Math.max(1, +e.target.value || 7) }), className: "outline-none px-3 py-2 rounded-lg text-center", style: { width: 84, fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", background: t.bg2, color: t.ink, border: "1px solid " + t.line } }),
          h("span", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.fog } }, "天 / 篇"),
          h("button", { onClick: () => set({ freqRandom: !c.freqRandom }), className: "active:opacity-70", style: { minHeight: 40, fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: c.freqRandom ? t.ink : t.fog } }, (c.freqRandom ? "✓ " : "○ ") + "随机波动"))),
      sect("TA 用什么纸", "选随机的话，每一封都可能不一样",
        h(LetterPaperPick, { value: c.paper, onPick: k => set({ paper: k }), withAuto: true })),
      sect("TA 用什么笔迹", null,
        h(LetterFontPick, { value: c.font, onPick: k => set({ font: k }), withAuto: true }))));
}

// 情侣空间·情书：信封列表 + 我也能写(标「我写的」) + 信纸字体/纸张 + 信下双向回复(角色多气泡)
function CoupleLetters({ partner, letters, cfg, onGen, onAddMy, onReply, onRead, onRemove, onSaveCfg, gen, onBack }) {
  const t = useTheme();
  const mine = (letters || []).filter(l => l.characterId === partner.id);
  const [open, setOpen] = useState(null);
  const [compose, setCompose] = useState(false);
  const [cfgOpen, setCfgOpen] = useState(false);
  const [cTitle, setCTitle] = useState("");
  const [cBody, setCBody] = useState("");
  const [cPaper, setCPaper] = useState((cfg && cfg.paper && cfg.paper !== "auto") ? cfg.paper : "cream");
  const [cFont, setCFont] = useState((cfg && cfg.font && cfg.font !== "auto") ? cfg.font : "kai");
  const [reply, setReply] = useState("");
  // 自动写情书：进来时若开了自动、且距 TA 上封已超设定频率，就触发一次（前台生效）
  const autoRan = useRef(false);
  useEffect(() => {
    if (autoRan.current) return;
    autoRan.current = true;
    if (!cfg || !cfg.auto || gen) return;
    const freq = Math.max(1, cfg.freqDays || 7);
    const lastChar = mine.filter(l => l.authorId !== "user").sort((a, b) => b.createdAt - a.createdAt)[0];
    const days = lastChar ? (Date.now() - lastChar.createdAt) / 86400000 : 999;
    const threshold = cfg.freqRandom ? freq * (0.7 + Math.random() * 0.6) : freq;
    if (days >= threshold) onGen(partner);
    // eslint-disable-next-line
  }, []);
  const md = ts => { const d = new Date(ts); return d.getFullYear() + "." + (d.getMonth() + 1) + "." + d.getDate(); };
  const threadText = l => ["【" + (l.title || "无题") + "】\n" + l.body].concat((l.replies || []).map(r => (r.authorId === "user" ? "我：" : partner.name + "：") + r.content)).join("\n");
  const doCompose = () => { if (cBody.trim()) { onAddMy(partner, cTitle, cBody, { paper: cPaper, font: cFont }); setCTitle(""); setCBody(""); setCompose(false); } };
  const mdParts = ts => { const d = new Date(ts); return { md: (d.getMonth() + 1) + "." + d.getDate(), y: d.getFullYear() }; };

  // —— 阅读一封信（信纸样式 + 信下回复串）——
  if (open) {
    const l = mine.find(x => x.id === open);
    if (l) {
      const pp = letterPaper(l.paper);
      const fc = letterFontCss(l.font);
      const mineL = l.authorId === "user";
      const send = () => { if (reply.trim() && !gen) { onReply(partner, l.id, reply.trim(), threadText(l)); setReply(""); } };
      // ── 一封信就是一整张纸（v60.35）────────────────────────────────────────
      // 她 2026-09-02：「把这块『情书』框去掉然后让背景纸能透到整个页面」。
      // 原来顶上是公共 Head：t.bg 的一大块 + 30px「情书」大字，下面才是信纸——
      // 一封信被装进了一个跟信无关的抽屉里，纸只占下面那半。
      // 现在整页就是那张纸（连刘海那一条也是纸），顶栏透明浮在纸上。
      // 日期和落款不再当副标题排在标题下面，而是右上角那张【邮票 + 邮戳】——
      // 这一处换成任何别的功能都不成立：只有信才有邮票。
      const inkA = (a) => { const m = /^#(\w{2})(\w{2})(\w{2})$/.exec(pp.ink); return m ? "rgba(" + parseInt(m[1], 16) + "," + parseInt(m[2], 16) + "," + parseInt(m[3], 16) + "," + a + ")" : pp.ink; };
      const dt = new Date(l.createdAt);
      const stamp = h("div", { style: { position: "relative", flexShrink: 0, marginTop: 4 } },
        // 邮票：齿孔用一圈小圆点切出来（纸色的点压在票边上），票面写寄信人
        h("div", { "data-wk": "block", style: { position: "relative", width: 62, height: 74, transform: "rotate(-4.5deg)", background: mineL ? "linear-gradient(160deg," + inkA(0.09) + "," + inkA(0.16) + ")" : "linear-gradient(160deg," + inkA(0.13) + "," + inkA(0.07) + ")", boxShadow: "0 1px 3px " + inkA(0.14) } },
          h("div", { "aria-hidden": "true", style: { position: "absolute", inset: -4, background: "radial-gradient(circle," + pp.bg + " 3.1px, transparent 3.4px) 0 0/10.33px 10.33px", pointerEvents: "none" } }),
          h("div", { style: { position: "absolute", inset: 6, border: "1px solid " + inkA(0.28), display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, padding: 3 } },
            h(IHeart, { size: 15, color: inkA(0.5), filled: true }),
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: inkA(0.78), lineHeight: 1.25, textAlign: "center", wordBreak: "break-all" } }, mineL ? "我" : partner.name))),
        // 邮戳：盖在邮票右下角，圈里是日期，跟真的一样压过票面
        h("div", { style: { position: "absolute", right: -21, bottom: -8, width: 58, height: 58, borderRadius: 999, border: "1.5px solid " + inkA(0.34), display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", transform: "rotate(9deg)", opacity: 0.9 } },
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(8px * var(--app-fs, 1))", letterSpacing: 1.5, color: inkA(0.42) } }, "见 字 如 面"),
          h("div", { style: { width: 34, borderTop: "1px solid " + inkA(0.26), borderBottom: "1px solid " + inkA(0.26), padding: "1.5px 0", margin: "2px 0", fontFamily: F_BODY, fontSize: "calc(10px * var(--app-fs, 1))", color: inkA(0.55), textAlign: "center" } }, (dt.getMonth() + 1) + "·" + dt.getDate()),
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(8px * var(--app-fs, 1))", letterSpacing: 1, color: inkA(0.42) } }, dt.getFullYear())));
      return h("div", { "data-wk": "uspage", "data-part": "coupleletters", className: "h-full flex flex-col", style: { background: pp.bg } },
        // 顶栏：透明浮在纸上，只有返回键和一行极轻的落款；右侧等宽占位（mobile-ui-layout §1）
        // ⚠️信纸这两页【不换成公共 Head】：顶上那行不是标题，是信的落款（「寄给 X」／
        //   「X 寄来」），轻到几乎看不见才对。挂点只加属性，长相一个像素没动。
        h("div", { "data-wk": "head", className: "shrink-0 flex items-center px-3 pb-1", style: { paddingTop: safeTop(8), minHeight: 50 } },
          h("button", { onClick: () => { setOpen(null); setReply(""); }, "aria-label": "返回", "data-wk": "headink", className: "active:opacity-50 flex items-center justify-center", style: { width: 40, height: 40 } }, h(IArrow, { size: 19, color: pp.ink, wk: "headink" })),
          h("div", { "data-wk": "headdim", className: "flex-1 min-w-0 text-center", style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", letterSpacing: 2, color: inkA(0.42) } }, mineL ? "寄给 " + partner.name : partner.name + " 寄来"),
          h("div", { style: { width: 40 } })),
        h("div", { className: "flex-1 min-h-0 overflow-y-auto", style: { padding: "6px 26px 30px", overscrollBehavior: "contain" } },
          h("div", { className: "flex items-start", style: { gap: 14, marginBottom: 16 } },
            h("div", { style: { flex: 1, minWidth: 0, paddingTop: 6 } },
              h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(24px * var(--app-fs, 1))", color: pp.ink, lineHeight: 1.35, wordBreak: "break-word" } }, STX(l.title || "给你的信")),
              // 信头那两道横线：一粗一细，只有信笺会这么收头
              h("div", { style: { borderTop: "1.5px solid " + inkA(0.3), marginTop: 12 } }),
              h("div", { style: { borderTop: "1px solid " + inkA(0.14), marginTop: 2.5 } })),
            stamp),
          h("div", { style: { fontFamily: fc, fontSize: "calc(15px * var(--app-fs, 1))", lineHeight: "31px", color: pp.ink, whiteSpace: "pre-wrap", marginTop: 14, backgroundImage: "repeating-linear-gradient(transparent 0 30px," + pp.line + " 30px 31px)" } }, STX(l.body)),
          // 信后那几笔：不是聊天记录，是【又及】——写完信之后补上去的话
          (l.replies || []).length ? h("div", { style: { marginTop: 30 } },
            h("div", { className: "flex items-center", style: { gap: 10, marginBottom: 18 } },
              h("div", { style: { flex: 1, borderTop: "1px solid " + inkA(0.16) } }),
              h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10px * var(--app-fs, 1))", letterSpacing: 3, color: inkA(0.38) } }, "又 及"),
              h("div", { style: { flex: 1, borderTop: "1px solid " + inkA(0.16) } })),
            (l.replies || []).map((r, i) => { const me = r.authorId === "user"; return h("div", { key: i, className: "flex", style: { gap: 10, marginBottom: 15 } },
              // 落笔的那一点：谁写的就在谁那侧，一个实心一个空心，不靠颜色分
              h("div", { "data-wk": "block", style: { flexShrink: 0, width: 7, height: 7, borderRadius: 999, marginTop: 8, background: me ? inkA(0.55) : "transparent", border: "1.5px solid " + inkA(0.55) } }),
              h("div", { style: { flex: 1, minWidth: 0 } },
                h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10px * var(--app-fs, 1))", letterSpacing: 1.5, color: inkA(0.42), marginBottom: 3 } }, me ? "我" : partner.name),
                h("div", { style: { fontFamily: fc, fontSize: "calc(14.5px * var(--app-fs, 1))", lineHeight: 1.95, color: inkA(0.88), whiteSpace: "pre-wrap", wordBreak: "break-word" } }, STX(r.content)))); })) : null,
          gen ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: inkA(0.5), marginTop: 14 } }, partner.name + " 正在回信…") : null),
        // 写字的地方还是这张纸：一条虚线像撕口，底下一行横格，不另起一块深色输入栏
        h("div", { className: "shrink-0 flex items-end", style: { gap: 10, padding: "10px 22px calc(env(safe-area-inset-bottom) * 0.4 + 10px)", borderTop: "1px dashed " + inkA(0.22) } },
          h("input", { "data-wk": "input", value: reply, onChange: e => setReply(e.target.value), onKeyDown: e => { if (e.key === "Enter") send(); }, placeholder: "再添一笔…", style: { flex: 1, minWidth: 0, outline: "none", background: "transparent", padding: "6px 2px", fontFamily: fc, fontSize: "calc(14.5px * var(--app-fs, 1))", color: pp.ink, borderBottom: "1px solid " + inkA(0.28) } }),
          h("button", { onClick: send, disabled: !reply.trim() || gen, className: "active:opacity-60 disabled:opacity-30 flex items-center", style: { gap: 5, fontFamily: F_DISPLAY, fontSize: "calc(14px * var(--app-fs, 1))", color: pp.ink, padding: "6px 2px" } }, "附上", h("span", { style: { fontSize: "calc(15px * var(--app-fs, 1))", lineHeight: 1 } }, "↵"))));
    }
  }

  // —— 信封卡片（v60.43 重上色）——
  // 她 2026-09-02：「这个粉色略土」。原来两种糖果渐变写死在这儿：TA 的一律粉、
  // 我的一律蓝——跟这封信本身没有半点关系，而且粉配桃粉是最容易发闷的一组。
  // 现在信封【用它自己那张纸的颜色】：她挑的是牛皮就是牛皮信封，夜笺就是深色信封。
  // 一封信的外壳本来就该是它里面那张纸——顺带这一栏再也不会「换个功能照样成立」。
  // 谁写的改由【蜡封的颜色】说：TA 是暗红的火漆，我的是暗靛；都压低了彩度，不抢纸。
  const envelope = l => {
    const pp = letterPaper(l.paper);
    const mineL = l.authorId === "user";
    const unread = !l.isRead && !mineL;
    const inkA = a => { const m = /^#(\w{2})(\w{2})(\w{2})$/.exec(pp.ink); return m ? "rgba(" + parseInt(m[1], 16) + "," + parseInt(m[2], 16) + "," + parseInt(m[3], 16) + "," + a + ")" : pp.ink; };
    const sealColor = mineL ? "#3f4a6b" : "#8e3b42";   // 暗靛 / 火漆红，都不是糖果色
    const doOpen = () => { if (!l.isRead) onRead(l.id); setOpen(l.id); };
    return h("div", { "data-wk": "block", onClick: doOpen, className: "relative w-full active:opacity-95", style: { height: 122, borderRadius: 4, background: pp.bg, border: "1px solid " + inkA(0.14), boxShadow: "0 4px 14px " + inkA(0.13), overflow: "hidden", cursor: "pointer" } },
      // 三块折片：全用这张纸自己的墨色压深浅，什么纸都不会脏
      h("div", { style: { position: "absolute", top: 0, left: 0, right: 0, height: 68, background: inkA(0.05), clipPath: "polygon(0 0,100% 0,50% 100%)" } }),
      h("div", { style: { position: "absolute", top: 0, left: 0, bottom: 0, width: "50%", background: inkA(0.035), clipPath: "polygon(0 0,100% 50%,0 100%)" } }),
      h("div", { style: { position: "absolute", top: 0, right: 0, bottom: 0, width: "50%", background: inkA(0.035), clipPath: "polygon(100% 0,0 50%,100% 100%)" } }),
      h("div", { "aria-hidden": "true", style: { position: "absolute", top: 0, left: 0, right: 0, height: 68, borderBottom: "1px solid " + inkA(0.1), clipPath: "polygon(0 0,100% 0,50% 100%)" } }),
      // 火漆：还是那颗，但压暗、去掉高饱和的高光，看着像蜡不像糖
      h("div", { "data-wk": "block", style: { position: "absolute", top: 34, left: "50%", transform: "translateX(-50%)", width: 44, height: 44, borderRadius: 999, background: "radial-gradient(circle at 36% 30%," + sealColor + "," + sealColor + "d9)", boxShadow: "0 2px 7px rgba(0,0,0,.28), inset 0 1px 1px rgba(255,255,255,.18)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2 } },
        h(IHeart, { size: 18, color: "rgba(255,255,255,.82)", filled: true })),
      h("div", { style: { position: "absolute", left: 16, right: 16, bottom: 12, zIndex: 2 } },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(14.5px * var(--app-fs, 1))", color: pp.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, STX(l.title || "给你的信")),
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10px * var(--app-fs, 1))", color: inkA(0.55), marginTop: 2 } }, (mineL ? "我写的" : partner.name + " 写的") + (unread ? " · 未读" : ""))),
      h("button", { onClick: e => { e.stopPropagation(); onRemove(l.id); }, "aria-label": "删掉这封", className: "absolute active:opacity-60", style: { top: 4, right: 6, width: 30, height: 30, fontFamily: F_BODY, fontSize: "calc(15px * var(--app-fs, 1))", color: inkA(0.45), zIndex: 3 } }, "×"),
      unread ? h("span", { className: "absolute", style: { top: 11, left: 12, width: 7, height: 7, borderRadius: 999, background: "#b3452f", zIndex: 3 } }) : null);
  };
  const sorted = mine.slice().sort((a, b) => b.createdAt - a.createdAt);
  const timelineRow = (l, i) => { const dp = mdParts(l.createdAt); return h("div", { key: l.id, className: "flex gap-3", style: { animation: "qqIn .3s ease both" } },
    h("div", { style: { flexShrink: 0, width: 40, display: "flex", flexDirection: "column", alignItems: "center" } },
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(14px * var(--app-fs, 1))", color: t.ink, lineHeight: 1, marginTop: 2 } }, dp.md),
      h("div", { style: { fontFamily: F_BODY, fontSize: "calc(8.5px * var(--app-fs, 1))", color: t.fog, marginTop: 2 } }, dp.y),
      h("div", { style: { width: 9, height: 9, borderRadius: 999, background: l.authorId === "user" ? "#3f4a6b" : "#8e3b42", marginTop: 6 } }),
      i < sorted.length - 1 ? h("div", { style: { flex: 1, width: 2, background: t.line, marginTop: 2 } }) : null),
    h("div", { style: { flex: 1, minWidth: 0, paddingBottom: 18 } }, envelope(l))); };

  // —— 情书设置：整页 ——
  if (cfgOpen) return h(CoupleLetterSettings, { partner, cfg, onSave: onSaveCfg, onBack: () => setCfgOpen(false) });

  // —— 自己写一封：整页，而且整页就是那张纸（跟读信那一页同一个身子）——
  // 原来是半窗：上面糊着列表、下面挤着纸样＋字体＋标题＋正文，正文只剩八行。
  // 写信这件事最需要的就是【一整张空白的纸】，半窗把它砍掉一半。
  if (compose) {
    const pp = letterPaper(cPaper), fc = letterFontCss(cFont);
    const inkA = a => { const m = /^#(\w{2})(\w{2})(\w{2})$/.exec(pp.ink); return m ? "rgba(" + parseInt(m[1], 16) + "," + parseInt(m[2], 16) + "," + parseInt(m[3], 16) + "," + a + ")" : pp.ink; };
    const swatch = (key, bg, ink, line) => h("button", { "data-wk": "block", key, onClick: () => setCPaper(key), "aria-label": "换纸", className: "active:opacity-80 shrink-0", style: { width: 30, height: 38, borderRadius: 2.5, background: bg, border: cPaper === key ? "1.5px solid " + pp.ink : "1px solid " + inkA(0.22), position: "relative", overflow: "hidden" } },
      h("div", { "aria-hidden": "true", style: { position: "absolute", inset: 0, backgroundImage: "repeating-linear-gradient(transparent 0 6px," + line + " 6px 7px)" } }),
      cPaper === key ? h("div", { "aria-hidden": "true", style: { position: "absolute", right: 0, bottom: 0, width: 0, height: 0, borderLeft: "9px solid transparent", borderBottom: "9px solid " + ink } }) : null);
    return h("div", { "data-wk": "uspage", "data-part": "coupleletters", className: "h-full flex flex-col", style: { background: pp.bg } },
      h("div", { "data-wk": "head", className: "shrink-0 flex items-center px-3 pb-1", style: { paddingTop: safeTop(8), minHeight: 50 } },
        h("button", { onClick: () => setCompose(false), "aria-label": "返回", "data-wk": "headink", className: "active:opacity-50 flex items-center justify-center", style: { width: 40, height: 40 } }, h(IArrow, { size: 19, color: pp.ink, wk: "headink" })),
        h("div", { "data-wk": "headdim", className: "flex-1 min-w-0 text-center", style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", letterSpacing: 2, color: inkA(0.42) } }, "写给 " + partner.name),
        h("button", { onClick: doCompose, disabled: !cBody.trim(), className: "active:opacity-60 disabled:opacity-30 flex items-center justify-center", style: { minWidth: 52, height: 40, fontFamily: F_DISPLAY, fontSize: "calc(14px * var(--app-fs, 1))", color: pp.ink } }, "寄出")),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto", style: { padding: "6px 26px 24px", overscrollBehavior: "contain" } },
        h("input", { "data-wk": "input", value: cTitle, onChange: e => setCTitle(e.target.value), placeholder: "标题（选填）", style: { width: "100%", outline: "none", background: "transparent", fontFamily: F_DISPLAY, fontSize: "calc(24px * var(--app-fs, 1))", color: pp.ink, paddingTop: 6, paddingBottom: 10 } }),
        h("div", { style: { borderTop: "1.5px solid " + inkA(0.3) } }),
        h("div", { style: { borderTop: "1px solid " + inkA(0.14), marginTop: 2.5, marginBottom: 16 } }),
        h("textarea", { "data-wk": "textarea", value: cBody, onChange: e => setCBody(e.target.value), placeholder: "写下你想对 TA 说的话…", style: { width: "100%", minHeight: "46vh", outline: "none", resize: "none", background: "transparent", fontFamily: fc, fontSize: "calc(15px * var(--app-fs, 1))", lineHeight: "31px", color: pp.ink, backgroundImage: "repeating-linear-gradient(transparent 0 30px," + pp.line + " 30px 31px)" } })),
      // 底下这一条是【文具盒】：一排真的小纸样 + 一排笔迹，就在写字的那张纸边上，随手换
      h("div", { className: "shrink-0", style: { borderTop: "1px dashed " + inkA(0.22), padding: "8px 0 calc(env(safe-area-inset-bottom) * 0.4 + 8px)" } },
        h("div", { className: "flex items-center overflow-x-auto", style: { gap: 7, padding: "0 22px 8px" } },
          LETTER_PAPERS.map(p => swatch(p.key, p.bg, p.ink, p.line))),
        h("div", { className: "flex items-center overflow-x-auto", style: { gap: 7, padding: "0 22px" } },
          LETTER_FONTS.filter(f => f.css).map(f => h("button", { "data-wk": "block", key: f.key, onClick: () => setCFont(f.key), className: "active:opacity-70 shrink-0", style: { minHeight: 40, padding: "8px 12px", borderRadius: 3, fontFamily: f.css, fontSize: "calc(13.5px * var(--app-fs, 1))", whiteSpace: "nowrap", color: cFont === f.key ? pp.bg : inkA(0.7), background: cFont === f.key ? pp.ink : "transparent", border: "1px solid " + inkA(cFont === f.key ? 0.7 : 0.22) } }, f.label)))));
  }

  // 顶栏也换成紧凑标题栏（mobile-ui-layout §1）：原来那块 30px 的「我们的情书」
  // 大标题 + 「Letters」眉标，跟读信页那块被拆掉的框是同一种东西——一整屏最上面
  // 先扣掉六七十像素去说这一页叫什么，而这一页叫什么，进来的人本来就知道。
  // 底纹铺在【外壳】上（v62.44，她 2026-09-04：「收着的这些除了交换日记背景也都没做」）。
  // 情书这一叠底下垫的是【航空信封那圈斜条边】：一道道细斜纹，跟横格的日记本、
  // 竖格的字据一眼分得开。顶栏透明让它透上来（施工规则/mobile-ui-layout.md §3.5）。
  return h("div", { "data-wk": "uspage", "data-part": "coupleletters", className: "h-full flex flex-col", style: letterSkin(t) },
    h(Head, { zh: "我们的情书", bg: "transparent", onBack,
      right: h("div", { className: "flex items-center" },
        h("button", { onClick: () => setCompose(true), "aria-label": "自己写一封", className: "active:opacity-50 flex items-center justify-center", style: { width: 36, height: 40 } }, h(IPlus, { size: 19, color: t.ink })),
        h("button", { onClick: () => setCfgOpen(true), "aria-label": "情书设置", className: "active:opacity-50 flex items-center justify-center", style: { width: 36, height: 40 } }, h(GConfig, { size: 18, color: t.ink }))) }),
    h("div", { className: "flex-1 min-h-0 overflow-y-auto px-6 pb-8", style: { overscrollBehavior: "contain" } },
      h("button", { "data-wk": "block", onClick: () => onGen(partner), disabled: gen, className: "w-full active:opacity-70 disabled:opacity-40", style: { margin: "8px 0 16px", background: t.bg2, border: "1px dashed " + t.line, borderRadius: 12, padding: "10px 0", fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.tint } }, gen ? partner.name + " 提笔中…" : "让 " + partner.name + " 写一封（距上封 ≥ 3 天）"),
      mine.length === 0 && !gen ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.fog } }, "还没有情书。让 TA 写一封，或点右上角 ＋ 自己写一封给 TA。") : null,
      h("div", null, sorted.map(timelineRow))));
}

// 情侣空间·合照墙：把和 TA 的聊天里生成的「我俩合照」(photoKind:"duo") 挂成一面墙，按月分组、点开放大。
// 每月十二号有地方翻。图从 IndexedDB(x_selfies) 按 imgKey 读，读不出的静静跳过。
// 一张图里画了好几格（照相馆四宫格、日记里的照片日记）：App 自己按格子切开，点哪格放大哪格（她 2026-10-12）。
//   切的时候每格往里收一点，躲开格子之间那道白边；格子画歪了也最多带一点边，不会切到隔壁那格的脸。
//   觉得那格不够清楚，可以「把这格拍清楚」——拿这一格当参考再画一张整的，这才多花一次。
function GridCells({ photo, rows, cols, onSharpen, sharpBusy }) {
  const t = useTheme();
  const [cells, setCells] = useState([]);
  const [zoom, setZoom] = useState(-1);
  useEffect(() => {
    let alive = true, obj = null;
    (async () => {
      let src = photo && photo.imgUrl;
      if (photo && photo.imgKey && typeof idbImgGet === "function") { const b = await idbImgGet(photo.imgKey).catch(() => null); if (b && b.size) { obj = URL.createObjectURL(b); src = obj; } }
      if (!src) return;
      const im = await new Promise(ok => { const x = new Image(); x.onload = () => ok(x); x.onerror = () => ok(null); x.src = src; });
      if (!im || !alive) return;
      // 图像端画的格子常常不是等分的（她 2026-10-12 截图：胶片条三格高矮不一，按三等分切，第二格顶上带着第一格的碗）。
      //   所以先找真实的白边：逐行/逐列算亮度，白边那几行又亮又平；在每条等分线附近 ±25% 里找最像白边的一段，
      //   找不到才退回等分。每格再从白边往里收 1.5%，躲开白边的毛边。
      const IW = im.naturalWidth, IH = im.naturalHeight, out = [];
      try {
        const sw = Math.min(IW, 360), sh = Math.round(IH * sw / IW);
        const sc = document.createElement("canvas"); sc.width = sw; sc.height = sh;
        const sg = sc.getContext("2d"); sg.drawImage(im, 0, 0, sw, sh);
        const px = sg.getImageData(0, 0, sw, sh).data;
        const whiteness = (horiz, i) => {   // 这一行（或列）有多少比例的点是近白的
          let n = 0, w = 0; const len = horiz ? sw : sh;
          for (let k = 0; k < len; k += 2) { const o = horiz ? (i * sw + k) * 4 : (k * sw + i) * 4; n++; if (px[o] > 225 && px[o + 1] > 225 && px[o + 2] > 225) w++; }
          return w / n;
        };
        const cuts = (horiz, parts, len, full) => {   // 返回 [起, 止] 对，原图坐标
          const bands = [];   // 每条分界线：[白边上沿, 下沿]
          for (let p = 1; p < parts; p++) {
            const mid = len * p / parts, win = len / parts * 0.25;
            let best = -1, bestS = 0.85;
            for (let i = Math.max(1, Math.round(mid - win)); i < Math.min(len - 1, Math.round(mid + win)); i++) { const v = whiteness(horiz, i); if (v > bestS) { bestS = v; best = i; } }
            if (best < 0) { bands.push([mid, mid]); continue; }
            let a = best, z = best;
            while (a > 0 && whiteness(horiz, a - 1) > 0.85) a--;
            while (z < len - 1 && whiteness(horiz, z + 1) > 0.85) z++;
            bands.push([a, z + 1]);
          }
          const k = full / len, segs = []; let start = 0;
          bands.forEach(([a, z]) => { segs.push([start * k, a * k]); start = z; });
          segs.push([start * k, full]);
          return segs.map(([s0, s1]) => { const m = (s1 - s0) * 0.015; return [s0 + m, s1 - m]; });
        };
        const ys = cuts(true, rows, sh, IH), xs = cuts(false, cols, sw, IW);
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
          const [x0, x1] = xs[c], [y0, y1] = ys[r];
          const cv = document.createElement("canvas"); cv.width = Math.round(x1 - x0); cv.height = Math.round(y1 - y0);
          cv.getContext("2d").drawImage(im, x0, y0, x1 - x0, y1 - y0, 0, 0, cv.width, cv.height);
          out.push({ u: cv.toDataURL("image/jpeg", 0.92), ar: cv.width / cv.height });
        }
      } catch (e) { return; }   // 外链图浏览器不让切：就只看整张
      if (alive) setCells(out);
    })();
    return () => { alive = false; if (obj) URL.revokeObjectURL(obj); };
  }, [photo && (photo.imgKey || photo.imgUrl), photo && photo.ts, rows, cols]);   // ts：同一把键重拍了也要重切
  if (!cells.length) return null;
  return h("div", { "data-wk": "gridcells", style: { marginTop: 12 } },
    h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog, marginBottom: 6 } }, "点一格单独放大"),
    h("div", { style: { display: "grid", gridTemplateColumns: "repeat(" + Math.min(cols * rows, 4) + ", minmax(0,1fr))", gap: 6 } },
      cells.map((x, i) => h("button", { key: i, onClick: () => setZoom(i), className: "active:opacity-80", style: { borderRadius: 8, overflow: "hidden", border: "1px solid " + t.line, aspectRatio: "1" } },
        h("img", { src: x.u, alt: "", style: { width: "100%", height: "100%", objectFit: "cover", display: "block" } })))),
    zoom >= 0 ? h("div", { "data-wk": "gridcellzoom", onClick: () => setZoom(-1), className: "fixed inset-0 z-50 flex flex-col items-center justify-center", style: { background: "rgba(0,0,0,.88)", gap: 14, padding: 16 } },
      h("img", { src: cells[zoom].u, alt: "", style: { maxWidth: "94%", maxHeight: "70%", borderRadius: 10 } }),
      h("div", { style: { color: "rgba(255,255,255,.7)", fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))" } }, "第 " + (zoom + 1) + " 格"),
      // 长按存图在「添加到主屏幕」的网页版里不出（她 2026-10-16 截图）——给一颗明着存的键，走公共那条 saveFile
      h("button", { onClick: async e => { e.stopPropagation();
          try { const b = dataUrlToBlob(cells[zoom].u); const via = await saveFile(new File([b], "photo-" + (zoom + 1) + "-" + Date.now() + ".jpg", { type: "image/jpeg" }));
            if (window.__toast) window.__toast(via === "cancel" ? "取消了，没存" : via === "share" ? "在分享面板里选「存储图像」" : "已经存下来了"); }
          catch (er) { if (window.__toast) window.__toast("没存成，再试一次"); } },
        className: "active:opacity-70", style: { padding: "11px 22px", borderRadius: 999, border: "1px solid rgba(255,255,255,.45)", background: "rgba(255,255,255,.14)", color: "#fff", fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))" } }, "保存这一格"),
      onSharpen ? h("button", { onClick: e => { e.stopPropagation(); if (!sharpBusy) onSharpen(cells[zoom].u, zoom); }, disabled: !!sharpBusy, className: "active:opacity-70",
        style: { padding: "11px 22px", borderRadius: 999, border: "1px solid rgba(255,255,255,.45)", background: "rgba(255,255,255,.14)", color: "#fff", fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))" } },
        sharpBusy ? "在拍了…" : "把这格拍清楚（再拍一张，花一次生图）") : null) : null);
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
function CoupleAlbum({ partner, photos, onBack, onDelete, onUpload }) {
  const t = useTheme();
  const [zoom, setZoom] = useState(null);
  // 自己传一张挂上墙（群友 2026-10-14：「许愿一个可以自己传图片的地方」——自己画的、约的图也想挂）。
  //   传上去就是一张墙上的照片，不叫TA点评、不花模型钱；删法跟别的照片一样。
  const [up, setUp] = useState(null);
  const [upDesc, setUpDesc] = useState("");
  const [upBusy, setUpBusy] = useState(false);
  const upRef = useRef(null);
  const list = (photos || []).slice().sort((a, b) => (b.ts || 0) - (a.ts || 0));
  const groups = [];
  list.forEach(p => {
    const d = vDate(p.ts, partner && partner.id);
    const key = d.getFullYear() + " 年 " + (d.getMonth() + 1) + " 月";
    let g = groups.find(x => x.key === key); if (!g) { g = { key, items: [] }; groups.push(g); }
    g.items.push(p);
  });
  const isTwelfth = new Date().getDate() === 12;
  return h("div", { "data-wk": "uspage", "data-part": "couplealbum", className: "h-full flex flex-col", style: cpSkin(t, "album") },
    h(Head, { zh: "我们的合照", sub: partner.remark || partner.name, bg: "transparent", onBack: onBack,
      right: onUpload ? h("button", { onClick: () => upRef.current && upRef.current.click(), className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.accent, padding: "6px 4px" } }, "传一张") : null }),
    onUpload ? h("input", { ref: upRef, type: "file", accept: "image/*", style: { display: "none" }, onChange: e => { const f = e.target.files && e.target.files[0]; e.target.value = ""; if (f) { setUp({ file: f, url: URL.createObjectURL(f) }); setUpDesc(""); } } }) : null,
    h("div", { className: "flex-1 min-h-0 overflow-y-auto px-5 pb-12" },
      list.length === 0
        ? h(Empty, { text: "还没有你俩的合照", sub: "在和 " + partner.name + " 的聊天里，让 TA 拍张『我俩的合照』——就会挂到这面墙上。（需先在设置配好图像 API、你和 TA 都传了参考照）" + (onUpload ? "\n自己画的、约的图，点右上「传一张」也能挂上来。" : "") })
        : h(Fragment, null,
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: isTwelfth ? t.accent : t.fog, textAlign: "center", padding: "8px 0 16px", lineHeight: 1.7, whiteSpace: "pre-line" } },
              "你和 " + partner.name + " 的合照 · 共 " + list.length + " 张\n" + (isTwelfth ? "今天十二号——来翻翻我们。" : "每月十二号，来这儿翻翻。")),
            groups.map(g => h("div", { key: g.key, style: { marginBottom: 20 } },
              h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(15px * var(--app-fs, 1))", color: t.ink, marginBottom: 9 } }, g.key + " · " + g.items.length + " 张"),
              h("div", { style: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 } },
                g.items.map((p, i) => h("button", { key: i, onClick: () => setZoom(p), className: "active:opacity-80", style: { aspectRatio: "1", borderRadius: 10, overflow: "hidden", border: "1px solid " + t.line, background: t.bg2, padding: 0 } },
                  h(AlbumPhoto, { photo: p }))))))),
    zoom ? h("div", { onClick: () => setZoom(null), style: { position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,.92)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20 } },
      h(AlbumPhoto, { photo: zoom, full: true }),
      zoom.desc ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: "rgba(255,255,255,.85)", marginTop: 14, textAlign: "center", maxWidth: 320, lineHeight: 1.6 } }, STX(zoom.desc)) : null,
      h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: "rgba(255,255,255,.5)", marginTop: 8 } }, vDate(zoom.ts, partner && partner.id).toLocaleString("zh-CN")),
      // 存到手机（她 2026-10-17：「合照墙的能不能保存图片」）：主屏幕网页版长按存不了，给一颗明着的键，走公共那条 saveImgOriginal
      (zoom.imgKey || zoom.imgUrl) ? h("button", {
        onClick: e => { e.stopPropagation();
          const done = ok => window.__toast && window.__toast(ok ? "已经存下来了" : "这张取不到原图");
          if (zoom.imgKey && window.saveImgOriginal) { window.saveImgOriginal(zoom.imgKey, "合照").then(done); return; }
          fetch(zoom.imgUrl).then(r => r.blob()).then(b => typeof saveFile === "function" ? saveFile(new File([b], "合照-" + Date.now() + ".png", { type: b.type || "image/png" })) : null).then(v => done(v !== "cancel")).catch(() => done(false)); },
        className: "active:opacity-60",
        style: { marginTop: 18, padding: "8px 22px", borderRadius: 999, border: "1px solid rgba(255,255,255,.45)", background: "rgba(255,255,255,.14)", fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: "#fff" }
      }, "保存这张") : null,
      // 删除放在【看大图这一层】：小格子上挂 ✕ 会误触，而误触在这儿是不可逆的
      onDelete ? h("button", {
        onClick: e => { e.stopPropagation(); onDelete(zoom); setZoom(null); },
        className: "active:opacity-60",
        style: { marginTop: 12, padding: "7px 18px", borderRadius: 999, border: "1px solid rgba(255,255,255,.28)", background: "transparent", fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: "rgba(255,255,255,.72)" }
      }, "删掉这张") : null) : null,
    up ? h("div", { style: { position: "fixed", inset: 0, zIndex: 200, background: t.bg, display: "flex", flexDirection: "column" } },
      h(Head, { zh: "挂一张上墙", bg: "transparent", onBack: () => { URL.revokeObjectURL(up.url); setUp(null); } }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-5 pb-10" },
        h("img", { src: up.url, alt: "", style: { width: "100%", maxHeight: "52vh", objectFit: "contain", borderRadius: 12, background: t.bg2 } }),
        h("input", { "data-wk": "input", value: upDesc, onChange: e => setUpDesc(e.target.value), maxLength: 60, placeholder: "写一句（可不写）", className: "w-full outline-none", style: { marginTop: 14, padding: "11px 13px", borderRadius: 10, border: "1px solid " + t.line, background: t.bg2, color: t.ink, fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))" } }),
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.fog, marginTop: 8, lineHeight: 1.6 } }, "只挂在合照墙上，TA 不会收到也不会点评；想删的时候点开大图删。"),
        h("button", { disabled: upBusy, onClick: async () => {
          setUpBusy(true);
          try { await onUpload(up.file, upDesc); URL.revokeObjectURL(up.url); setUp(null); } catch (e) { toast("没挂上：" + ((e && e.message) || "重试")); }
          setUpBusy(false);
        }, className: "w-full active:opacity-70 disabled:opacity-50", style: { marginTop: 18, padding: "13px 0", borderRadius: 12, background: t.accent, color: "#fff", fontFamily: F_DISPLAY, fontSize: "calc(15px * var(--app-fs, 1))" } }, upBusy ? "挂上去……" : "挂上墙"))) : null));
}
const COUPLE_ARCHIVE_FIELDS = [
  ["nicknames", "彼此称呼", "你怎么叫 TA，TA 又怎么叫你"],
  ["insideJokes", "只有你俩懂的梗", "暗号、笑点、说半句就懂的事"],
  ["rituals", "小仪式", "晚安方式、见面习惯、固定的小动作"],
  ["comfort", "安慰说明书", "难过时想被怎样接住，什么反而会踩雷"],
  ["boundaries", "边界与禁区", "彼此认真约定过、不该越过的线"],
  ["favorites", "喜欢清单", "一起喜欢的食物、歌、地方和消遣"],
  ["firsts", "第一次们", "第一次见面、牵手、旅行，或别的第一次"]
];

function CoupleArchive({ partner, data, onSave, onBack }) {
  const t = useTheme();
  const [draft, setDraft] = useState(() => Object.assign({}, data || {}));
  const filled = COUPLE_ARCHIVE_FIELDS.filter(f => String(draft[f[0]] || "").trim()).length;
  // ── 档案夹（v62.16）：它叫「档案」，原来长得是设置页表单。现在是一只牛皮纸夹：
  // 夹面系着绕线扣，里面七张档案页——每张页顶伸出一枚索引标签（上圆下方，
  // 贴着页边、一页一个位置错开），照账本 TallyView 那套索引标签语言。
  // 配色整套写死：夹和纸都是写死的浅色，字色跟主题走会在深色主题下失明。
  const KRAFT = "#cdb488", PAGE = "#fbf6ea", AINK = "#4a3d28", AFOG = "#9a8a6a";
  // 索引标签错开摆的位置。⚠️位置 + 标签自己的宽度不许越过纸的右边缘：
  // 原来是 4 档 × 23%，第四档落在 69%，加上「安慰说明书」那么长的标签就整个挤到纸外面去
  //（她 2026-09-04 截图：04 那一枚顶到右边框外了）。
  // 现在 3 档 × 24%（最远 48%），而且每一枚的可用宽度由 calc 钉死在剩下那一段里——
  // 标签再长也只会省略号，**溢出这件事从形状上就不可能发生**，不是靠挑一个够小的数。
  const TAB_L = i => (i % 3) * 24;
  const TABC = ["#b0885a", "#a06a54", "#8a7a5c", "#7a8a6a", "#6a7a8a", "#8a6a7a", "#9a8a5a"];
  return h("div", { "data-wk": "uspage", "data-part": "couplearchive", className: "h-full flex flex-col", style: {
    background: KRAFT,
    backgroundImage: "repeating-linear-gradient(97deg, rgba(120,90,45,.05) 0 2px, transparent 2px 14px), radial-gradient(120% 70% at 50% -8%, rgba(255,248,230,.5), transparent 60%)",
    boxShadow: "inset 0 0 42px rgba(110,80,35,.22)" } },
    h(Head, { zh: "我们的档案", en: partner.name, onBack, bg: "transparent", ink: "#42311a" }),
    h("div", { className: "flex-1 min-h-0 overflow-y-auto px-5 pb-10" },
      // 夹面：绕线扣（两个纸扣、一圈线绕过去）——只有档案袋才有这个
      h("div", { "data-wk": "block", style: { position: "relative", marginTop: 12, borderRadius: 4, background: "rgba(255,250,238,.34)", border: "1px solid rgba(110,80,35,.28)", padding: "16px 15px 14px", marginBottom: 18 } },
        h("div", { "aria-hidden": "true", style: { position: "absolute", right: 16, top: -8, width: 17, height: 17, borderRadius: 999, background: "#b09468", border: "1.5px solid rgba(90,65,25,.5)", boxShadow: "0 1px 2px rgba(90,65,25,.3)" } }),
        h("div", { "aria-hidden": "true", style: { position: "absolute", right: 44, top: 6, width: 13, height: 13, borderRadius: 999, background: "#b09468", border: "1.5px solid rgba(90,65,25,.5)" } }),
        h("div", { "aria-hidden": "true", style: { position: "absolute", right: 22, top: -2, width: 30, height: 16, borderBottom: "1.5px solid rgba(90,65,25,.55)", borderRadius: "0 0 60% 40%", transform: "rotate(14deg)" } }),
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10px * var(--app-fs, 1))", letterSpacing: ".22em", color: "#7a6238" } }, "只由你亲手写入"),
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(22px * var(--app-fs, 1))", color: "#42311a", marginTop: 7 } }, filled ? "收好了 " + filled + " 页" : "从一张空白档案开始"),
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", lineHeight: 1.65, color: "#7a6238", marginTop: 5 } }, "这里不会从普通聊天或记忆库自动填字。你写下什么，才留下什么。")),
      COUPLE_ARCHIVE_FIELDS.map(([key, title, hint], fi) => h("label", { key, style: { display: "block", position: "relative", marginTop: fi ? 14 : 0 } },
        // 索引标签：长在页顶、一页一个位置错开——一叠翻得到的档案页
        h("div", { style: { position: "relative", zIndex: 1, marginLeft: TAB_L(fi) + "%", display: "inline-flex", alignItems: "center", gap: 5, maxWidth: "calc(100% - " + TAB_L(fi) + "%)",
          borderRadius: "8px 8px 0 0", padding: "6px 13px 5px", background: TABC[fi % TABC.length], color: "#fff",
          fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", boxShadow: "inset 0 1px 0 rgba(255,255,255,.25)" } },
          h("span", { style: { fontFamily: F_DISPLAY, fontSize: "calc(10px * var(--app-fs, 1))", opacity: 0.75 } }, "0" + (fi + 1)),
          h("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, title),
          String(draft[key] || "").trim() ? h("span", { "aria-hidden": "true", style: { width: 5, height: 5, borderRadius: 999, background: "rgba(255,255,255,.85)", flexShrink: 0 } }) : null),
        h("div", { "data-wk": "block", style: { position: "relative", background: PAGE, borderRadius: TAB_L(fi) === 0 ? "0 4px 4px 4px" : 4, border: "1px solid rgba(150,120,70,.3)", borderTopColor: TABC[fi % TABC.length], borderTopWidth: 2, padding: "11px 13px 13px", boxShadow: "0 5px 14px rgba(110,80,35,.16)" } },
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: AFOG } }, hint),
          h("textarea", { "data-wk": "textarea", value: draft[key] || "", onChange: e => setDraft(d => ({ ...d, [key]: e.target.value })), rows: 3, placeholder: "写在这里……", className: "w-full outline-none resize-none", style: { marginTop: 7, background: "transparent", borderBottom: "1px dashed rgba(150,120,70,.35)", color: AINK, padding: "4px 2px 8px", fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", lineHeight: 1.7 } })))),
      h("button", { "data-wk": "block", onClick: () => onSave(draft), className: "w-full active:opacity-70", style: { marginTop: 22, borderRadius: 10, background: "#42311a", color: "#f5ecd8", padding: "13px 16px", fontFamily: F_DISPLAY, fontSize: "calc(15px * var(--app-fs, 1))", boxShadow: "0 6px 16px rgba(66,49,26,.3)" } }, "封存这份档案")));
}

// 情侣空间·TA记得的那一版（v58.85，她 2026-08-31 的 c）。
// 这一屋子模块记的都是【她写下来的】。这一页反过来：同一件事，TA记得的那一版摆在旁边。
// TA留意到的和她记下来的往往不是同一处——那个落差才是这一页的内容，所以两版并排放，
// 不合并、不总结。
function CoupleRecall({ partner, items, busy, onGen, onRead, onDel, onBack }) {
  const t = useTheme();
  const list = (items || []).filter(x => x.characterId === partner.id);
  // 底纹（v62.44）：这一页摊的是【同一件事的两份笔迹】，所以底是一张对折过的大纸——
  // 正中一道竖折痕（暗-亮-暗三层夹出来的），两边各一半。铺在外壳、顶栏透上来。
  return h("div", { "data-wk": "uspage", "data-part": "couplerecall", className: "h-full flex flex-col", style: { background: t.bg,
    backgroundImage: "linear-gradient(90deg,rgba(0,0,0,0) calc(50% - 6px),rgba(120,95,55,.07) calc(50% - 2px),rgba(255,255,255,.30) 50%,rgba(120,95,55,.07) calc(50% + 2px),rgba(0,0,0,0) calc(50% + 6px))" } },
    h(Head, { zh: characterText(partner, "他记得的那一版"), en: partner.name, onBack: onBack, bg: "transparent" }),
    h("div", { className: "flex-1 min-h-0 overflow-y-auto px-5 pb-10" },
      h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.fog, lineHeight: 1.8, marginBottom: 14 } },
        "挑一件你俩都在场的事，让 " + partner.name + characterText(partner, " 写他记得的那一版。他留意到的，多半跟你记下来的不是同一处。")),
      // 这一页整片是纸，那颗按钮就别是一块纯黑药丸（v62.44）：一条纸带，虚线边。
      h("button", { onClick: onGen, disabled: busy, className: "w-full active:opacity-75 disabled:opacity-50",
        style: { fontFamily: F_DISPLAY, fontSize: "calc(14.5px * var(--app-fs, 1))", color: "#6b5a45", background: "#fbf6ea", border: "1px dashed rgba(140,115,70,.45)",
          borderRadius: 3, padding: "13px 0", marginBottom: 18, minHeight: 44, boxShadow: "0 4px 11px rgba(90,70,40,.08)" } },
        busy ? characterText(partner, "他在想…") : characterText(partner, "挑一件事，问问他记得的")),
      // ── 一张对折又摊开的纸（v62.17）：这一页的内容本来就是【同一件事的两份笔迹】——
      // 上半是她那面（她记下的那版），中间一道真的折缝（凹痕：暗-亮-暗三层夹出来的），
      // 下半是TA那面（TA的那版用衬线手写感）。原来是通用卡+一条分隔线，换个 app 照样成立。
      // 配色写死：纸写死浅色，字色不能再跟主题走（深色主题浅字浅纸那一课）。
      list.length ? list.map(x => h("div", { key: x.id, onClick: () => x.unread && onRead(x.id),
        style: { position: "relative", borderRadius: 5, overflow: "hidden", marginBottom: 14,
          border: "1px solid " + (x.unread ? "#c9a86a" : "rgba(150,130,90,.28)"),
          boxShadow: "0 7px 18px rgba(90,70,40,.13)" } },
        // 上半：她的那面
        h("div", { style: { background: "#fdfaf1", padding: "13px 15px 14px" } },
          h("div", { className: "flex items-center justify-between", style: { marginBottom: 4 } },
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: "#9a8a6a" } }, "你记下的"),
            x.unread ? h("span", { style: { fontFamily: F_BODY, fontSize: "calc(10px * var(--app-fs, 1))", color: "#b0812e" } }, "· 新的") : null),
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", lineHeight: 1.75, color: "#6a5f4b", whiteSpace: "pre-wrap" } }, x.mine)),
        // 折缝：上影、缝里一线亮、下影——纸对折过才有的那道凹痕
        h("div", { "aria-hidden": "true", style: { height: 8, background: "linear-gradient(rgba(90,70,40,.18), rgba(90,70,40,.03) 42%, rgba(255,255,255,.8) 52%, rgba(90,70,40,.12))" } }),
        // 下半：TA的那面（另一种纸色 + 手写感衬线）
        h("div", { style: { background: "#f6efdd", padding: "12px 15px 12px" } },
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: "#a05a6a", marginBottom: 4 } }, partner.name + " 记得的"),
          h("div", { style: { fontFamily: "'Noto Serif SC',serif", fontSize: "calc(14px * var(--app-fs, 1))", lineHeight: 1.9, color: "#3d3322", whiteSpace: "pre-wrap" } }, x.his),
          x.note ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", fontStyle: "italic", color: "#9a8a6a", lineHeight: 1.7, marginTop: 10, borderLeft: "2px solid rgba(150,130,90,.35)", paddingLeft: 10 } }, STX(x.note)) : null,
          h("div", { className: "flex items-center justify-between", style: { marginTop: 10 } },
            h("span", { style: { fontFamily: F_BODY, fontSize: "calc(10px * var(--app-fs, 1))", color: "#9a8a6a" } }, timeAgo(x.ts)),
            h("button", { onClick: e => { e.stopPropagation(); onDel(x.id); }, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: "#9a8a6a", minHeight: 32, padding: "0 4px" } }, "删掉")))))
        : h(Empty, { text: "还没问过", sub: "问一次就挑一件你俩共同经历过的事。同一件事，两个人记得的常常不是同一处。" })));
}
// 说好的事／心愿的日子，挑到【几点】（她 2026-09-13：「要时间」）。
// ⚠️原来两处各写一遍 `new Date(v + "T09:00:00")`——那个 9 点不是他俩约的时间，
//   是日期选择器没处放钟点时的占位。到点TA开口，气泡上就写着一个没发生过的九点
//   （v67.80 那次倒填错乱的一半病根就在这儿）。
// ⚠️合成一处（施工规则/one-public-mechanism.md）：两处都从这儿要时刻，
//   不填几点仍然落回 09:00——老存档和老习惯一个字不变。
const COUPLE_DUE_DEFAULT_HM = "09:00";
function coupleDueTs(day, hm) {
  const d0 = String(day || "").trim();
  if (!d0) return 0;
  const t0 = /^\d{2}:\d{2}$/.test(String(hm || "")) ? hm : COUPLE_DUE_DEFAULT_HM;
  const d = new Date(d0 + "T" + t0 + ":00");
  // ⚠️钟点不成立（「25:99」这种形状对、数不对的）不许连日子一起作废：
  //   返回 0 的意思是【她没挑日子】，可她明明挑了。落回默认钟点，别把她那一下吞掉。
  if (!isNaN(d.getTime())) return d.getTime();
  const d2 = new Date(d0 + "T" + COUPLE_DUE_DEFAULT_HM + ":00");
  return isNaN(d2.getTime()) ? 0 : d2.getTime();
}
// 挂在日子后面那一行的「几点」。⚠️照真实时刻显示，不许省：
//   她挑了晚上八点，界面上就得写八点；写着「就是今天」而不写几点，等于没挑过。
function coupleDueClock(ts) {
  const d = new Date(Number(ts) || 0);
  if (isNaN(d.getTime())) return "";
  return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}
// 情侣空间·我们说好的（v58.83，她 2026-08-31 选的第 ② 条）。
// ⚠️和「心愿单」是两回事，别混：心愿单是【她想要的】，自己往里放；
// 这一页是【你俩真说过的】——线下/通话结束时自动抽出来的开环（记忆库里 open:true 的条目）。
// 情侣空间现在整屋子都是记过去的收藏夹，这一页是唯一朝前的：给一条约定挑个日子，
// 到那天TA会自己提起（走的是已有的「约回」链，不是新机制）。
function CouplePacts({ partner, pacts, onClose, onSetDue, onAdd, onBack }) {
  const t = useTheme();
  const [txt, setTxt] = useState("");
  const [day, setDay] = useState("");
  const [dueFor, setDueFor] = useState(null);      // 正在给哪一条挑日子
  const [dueVal, setDueVal] = useState("");
  const [dueHm, setDueHm] = useState(COUPLE_DUE_DEFAULT_HM);       // 到那天【几点】
  const [dayHm, setDayHm] = useState(COUPLE_DUE_DEFAULT_HM);       // 自己记一条时的几点
  // 到那天TA【怎么来】（她 2026-09-06：「约好了打电话没做」）。
  // 原来只有一种：发消息。约好打电话的那些到点只能等来一条文字，那不叫打电话。
  const [dueVia, setDueVia] = useState("chat");
  const open = (pacts && pacts.open) || [], due = (pacts && pacts.due) || [];
  const dueOf = memId => due.find(x => x.memId === memId);
  const leftOf = ts => { const n = Math.ceil((ts - Date.now()) / 86400000); return n > 0 ? "还有 " + n + " 天" : n === 0 ? "就是今天" : "已经过了 " + (-n) + " 天"; };
  const toTs = (v, hm) => coupleDueTs(v, hm);
  // ── v62.44（她 2026-09-04：「我们说好的里面还是一条条很无聊」）────────────
  // 上一版是一条条圆角框 + 一排文字链（挑个日子／不催了／做到了／算了）——
  // 换个 app 照样成立，而且这一页真正的动作【挑哪一天】被藏成了一个小灰字。
  // 「说好的」在现实里是一张【字据】：话写在纸上，日子挂在旁边，办到了盖个印。
  // 所以：每条＝一张宣纸字据（骑缝竖线、方角、微歪）；
  //       日子＝挂在右边的那张挂历页（跟情侣空间倒数、我们的日子是同一张 CalPage，
  //             一处画、处处用）——没挑日子时它是空白的一页，**点它本身就是挑日子**；
  //       做到了＝盖一枚朱红的方印「践」，不是一个文字链。
  const PAPER = "#faf4e6", PLINE2 = "rgba(140,115,70,.28)", PINK2 = "#4c4130", PFOG = "#9b8a6c";
  const inp = { fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", color: PINK2, background: "rgba(255,255,255,.55)", border: "1px solid " + PLINE2, borderRadius: 4, padding: "10px 12px", width: "100%", outline: "none" };
  // 骑缝：字据右边那条竖线，跟纸一样高
  const creaseAt = (right, bottom) => h("span", { "aria-hidden": "true", style: { position: "absolute", top: 8, bottom: bottom, right: right, width: 1, background: "repeating-linear-gradient(180deg," + PLINE2 + " 0 4px,rgba(0,0,0,0) 4px 8px)" } });
  return h("div", { "data-wk": "uspage", "data-part": "couplepacts", className: "h-full flex flex-col", style: { background: t.bg,
    // 契纸的竖格：一条条淡淡的竖线，跟横格的日记本一眼分得开
    backgroundImage: "repeating-linear-gradient(90deg,rgba(140,115,70,.05) 0 1px,rgba(0,0,0,0) 1px 24px)" } },
    h(Head, { zh: "我们说好的", en: partner.name, onBack: onBack, bg: "transparent" }),
    h("div", { className: "flex-1 min-h-0 overflow-y-auto px-5 pb-10" },
      h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.fog, lineHeight: 1.8, marginBottom: 14 } },
        characterText(partner, "这里的每一条都是你们【真说过】的——线下和通话结束时自己攒进来的，不是你手打的愿望（那是愿望板）。给一条挂上日子，到那天他会自己提起。")),
      // 新记一条：一张还空着的字据
      h("div", { style: { position: "relative", borderRadius: 3, border: "1px dashed " + PLINE2, background: "rgba(250,244,230,.5)", padding: "13px 14px", marginBottom: 16 } },
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10px * var(--app-fs, 1))", letterSpacing: ".14em", color: PFOG, marginBottom: 8 } }, "自己先记一条"),
        h("input", { "data-wk": "input", value: txt, onChange: e => setTxt(e.target.value), placeholder: "你们说好了什么", style: inp }),
        // ⚠️日期／时间／按钮【不许挤一排】（她 2026-09-18：「这里记下也是超了的」）。
        //   input[type=date] 在 iOS 上有个缩不下去的最小宽度（要摆得下「年/月/日」），
        //   flex:1 拉不动它，于是整行被撑宽、最右边那颗按钮被顶出屏幕。
        //   日期和时间一行（日期给 minWidth:0，真的能让步），按钮自己占一行。
        h("div", { className: "flex items-center", style: { gap: 8, marginTop: 9 } },
          h("input", { type: "date", value: day, onChange: e => setDay(e.target.value), style: Object.assign({}, inp, { flex: 1, minWidth: 0 }) }),
          // 几点：填了日子才有意义，所以没填日子时它是灰的
          h("input", { type: "time", value: dayHm, disabled: !day, "aria-label": "几点", onChange: e => setDayHm(e.target.value),
            style: Object.assign({}, inp, { width: 104, flexShrink: 0, opacity: day ? 1 : .45 }) })),
        h("button", { onClick: () => { onAdd(txt.trim(), day ? toTs(day, dayHm) : 0); setTxt(""); setDay(""); setDayHm(COUPLE_DUE_DEFAULT_HM); }, disabled: !txt.trim(), className: "w-full active:opacity-70 disabled:opacity-40",
          style: { fontFamily: F_DISPLAY, fontSize: "calc(13.5px * var(--app-fs, 1))", color: "#fff", background: "#8d7440", borderRadius: 4, padding: "11px 0", minHeight: 44, marginTop: 9 } }, "记下"),
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: PFOG, marginTop: 7 } }, characterText(partner, "日子可以不填。填了到那天【那个点】他会主动来找你说这件事；不改钟点就是早上九点。"))),
      open.length ? open.map(m => {
        const d = dueOf(m.id);
        const dd = d ? new Date(d.dueTs) : null;
        const passed = !!(d && d.dueTs < Date.now() - 86400000);
        const picking = dueFor === m.id;
        return h("div", { key: m.id, style: { position: "relative", borderRadius: 3, border: "1px solid " + PLINE2, background: PAPER,
          padding: "14px 15px 12px", marginBottom: 13, transform: "rotate(-0.3deg)", boxShadow: "0 7px 18px rgba(90,70,40,.11)" } },
          creaseAt(76, 58),
          h("div", { className: "flex items-start", style: { gap: 12 } },
            h("div", { className: "flex-1 min-w-0", style: { paddingRight: 8 } },
              h("div", { style: { fontFamily: "'Noto Serif SC',serif", fontSize: "calc(14.5px * var(--app-fs, 1))", lineHeight: 1.85, color: PINK2 } }, STX(m.text)),
              d ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: passed ? "#b06a5a" : "#8a7a5c", marginTop: 7 } },
                // ⚠️几点必须写出来：只写「就是今天」的话，她挑的那个钟点等于没挑过
                leftOf(d.dueTs) + " " + coupleDueClock(d.dueTs) + " · " + (d.via === "voice" ? characterText(partner, "他会打给你") : d.via === "video" ? characterText(partner, "他会视频找你") : characterText(partner, "他会来找你说"))) : null),
            // 挂历页本身就是「挑个日子」那颗按钮：没挑过是空白的一页
            h("button", { onClick: () => { setDueFor(picking ? null : m.id); setDueVal(""); setDueHm(d ? coupleDueClock(d.dueTs) : COUPLE_DUE_DEFAULT_HM); setDueVia((d && d.via) || "chat"); }, className: "shrink-0 active:opacity-75",
              style: { width: 64, minHeight: 44, display: "flex", flexDirection: "column", alignItems: "center", padding: "0 0 2px" } },
              h(CalPage, { w: 44, dim: !d || passed,
                month: dd ? dd.getMonth() + 1 : undefined, day: dd ? dd.getDate() : undefined,
                head: dd ? undefined : "　", body: dd ? undefined : "？" }),
              h("span", { style: { fontFamily: F_BODY, fontSize: "calc(9.5px * var(--app-fs, 1))", color: PFOG, marginTop: 4 } }, d ? (picking ? "换一天" : "改日子") : "挑个日子"))),
          picking ? h("div", { style: { marginTop: 10 } },
            // 「怎么来」：三枚小印。选中那枚是【盖下去的朱印】——实底、白字、微歪、
            // 带一点压痕；没选的只是描在纸上的一个框。形状/底/字色/歪不歪四样都变，
            // 不是靠填个色区分（tabs-not-plain-pills）。
            // ⚠️「到那天他」那句原来跟三枚印挤同一排（她 2026-09-18 截图）：
            //   这张卡里侧只有三百来像素，标题占掉一截，三个四字词各自被折成两行
            //   （「来找你／说」）。把那句挪到上面单独一行，三枚印平分整宽、一律不折。
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: PFOG, marginBottom: 6 } }, characterText(partner, "到那天他")),
            h("div", { className: "flex items-stretch", style: { gap: 7, marginBottom: 9 } },
              ["chat", "voice", "video"].map(k => {
                const on = dueVia === k;
                return h("button", { key: k, onClick: () => setDueVia(k), "aria-pressed": on ? "true" : "false",
                  className: "flex-1 min-w-0 active:opacity-75",
                  style: { fontFamily: on ? F_DISPLAY : F_BODY, fontSize: on ? 13 : 12, minHeight: 40, padding: "0 4px", whiteSpace: "nowrap",
                    borderRadius: 3, transform: on ? "rotate(-3deg)" : "none",
                    background: on ? "#a83c30" : "transparent", color: on ? "#fff5f0" : PFOG,
                    border: on ? "1.5px solid #8c2f25" : "1px solid " + PLINE2,
                    boxShadow: on ? "0 2px 5px rgba(120,40,30,.24)" : "none" } },
                  k === "chat" ? "来找你说" : k === "voice" ? "打给你" : "视频找你");
              })),
            // 同上：这一行本来是【四个】挤一排，比上面那处更容易顶出去
            h("div", { className: "flex items-center", style: { gap: 8 } },
              h("input", { type: "date", value: dueVal, onChange: e => setDueVal(e.target.value), style: Object.assign({}, inp, { flex: 1, minWidth: 0 }) }),
              h("input", { type: "time", value: dueHm, "aria-label": "几点", onChange: e => setDueHm(e.target.value), style: Object.assign({}, inp, { width: 104, flexShrink: 0 }) })),
            h("div", { className: "flex items-center", style: { gap: 8, marginTop: 9 } },
              h("button", { onClick: () => { if (dueVal) { onSetDue(m.id, m.text, toTs(dueVal, dueHm), dueVia); setDueFor(null); } }, className: "flex-1 active:opacity-70",
                style: { fontFamily: F_DISPLAY, fontSize: "calc(13px * var(--app-fs, 1))", color: "#fff", background: "#8d7440", borderRadius: 4, padding: "11px 0", minHeight: 44 } }, "就这天"),
              d ? h("button", { onClick: () => { onSetDue(m.id, m.text, 0); setDueFor(null); }, className: "shrink-0 active:opacity-60",
                style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: PFOG, minHeight: 44, padding: "0 12px" } }, "不催了") : null),
            dueVia === "chat" ? null : h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: PFOG, marginTop: 7, lineHeight: 1.6 } },
              "到那天电话会直接响。接了才进通话（那一步才调模型）；没接就是一条未接来电，不花钱。")) : null,
          // 办到了＝盖一枚朱印；作罢是一句小字，不跟它抢分量
          h("div", { className: "flex items-center justify-between", style: { marginTop: 10, borderTop: "1px solid rgba(140,115,70,.16)", paddingTop: 8 } },
            h("button", { onClick: () => onClose(m.id), className: "active:opacity-60",
              style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: PFOG, minHeight: 40, padding: "0 2px" } }, "作罢"),
            h("button", { onClick: () => onClose(m.id), className: "active:opacity-75", style: { minHeight: 40, padding: "2px 0" } },
              h("span", { style: { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 3,
                background: "#a83c30", border: "1.5px solid #8c2f25", color: "#fff5f0", transform: "rotate(-7deg)",
                boxShadow: "0 2px 5px rgba(120,40,30,.26)", fontFamily: F_DISPLAY, fontSize: "calc(17px * var(--app-fs, 1))" } }, "践"),
              h("span", { style: { fontFamily: F_BODY, fontSize: "calc(10px * var(--app-fs, 1))", color: PFOG, marginLeft: 8 } }, "做到了"))));
      }) : h(Empty, { text: "还没有说好的事", sub: "跟 " + partner.name + " 线下相处或打完电话，说定的事会自己攒到这儿来。也可以自己先记一条。" }),
      due.filter(x => !x.memId).length ? h("div", { style: { marginTop: 18 } },
        h(Eyebrow, null, characterText(partner, "他说好要来找你的")),
        due.filter(x => !x.memId).map(x => h("div", { key: x.id, className: "flex items-center", style: { gap: 10, padding: "9px 0", borderBottom: "1px solid rgba(140,115,70,.18)" } },
          h("span", { "aria-hidden": "true", style: { width: 4, height: 4, borderRadius: 999, background: "#a83c30", flexShrink: 0 } }),
          h("span", { className: "flex-1 min-w-0", style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.sub, lineHeight: 1.8 } }, x.about),
          h("span", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.tint, flexShrink: 0 } }, leftOf(x.dueTs))))) : null));
}
// 我们的存钱罐（她 2026-10-10 转群友：「情侣空间能不能开个共同账户，那种互相往里放钱的」）。
//   第二版（她 2026-10-10：「存钱罐里面设计也弄好一点」）——照着它在现实里是什么来长：
//   ① 一只搁在木板上的玻璃罐：罐里是一枚枚硬币堆起来的高度（定了目标就是攒到几成），
//      最近几笔附了话的，折成小纸条塞在硬币上面；罐颈系一张牛皮纸吊牌，写着目标和进度。
//   ② 往里放、往外取是一张「存取单」：金额、附言、要不要拿去实现某个愿望。
//   ③ 流水是一本存折：日期 / 摘要 / 存入 / 支取 / 结余 五栏，按月翻页。
//   钱的进出全在 app 那头的 jarMove 一处（扣谁的钱包、落灰字、攒到目标），这一页只摆和递。
function CoupleJar({ partner, data, wishes, myWallet, myName, onMove, onGoal, onBack }) {
  const j = data || { balance: 0, goal: null, autoPct: 10, ledger: [] };
  const [amt, setAmt] = useState("");
  const [note, setNote] = useState("");
  const [wishId, setWishId] = useState("");
  const [goalEdit, setGoalEdit] = useState(null);   // null | { name, amount }
  const bal = Number(j.balance) || 0, goal = j.goal;
  const goalAmt = goal ? Number(goal.amount) || 0 : 0;
  const level = goalAmt > 0 ? Math.min(1, bal / goalAmt) : (bal > 0 ? Math.min(0.5, 0.12 + Math.log10(1 + bal) / 10) : 0);
  const openWishes = (wishes || []).filter(w => w && w.status !== "done" && w.status !== "shelved");
  const money = v => (Math.round(Number(v) * 100) / 100).toLocaleString("zh-CN");
  const n = Math.round(Number(amt) * 100) / 100;
  const go = sign => {
    if (!(n > 0)) return;
    const ok = onMove(sign * n, note.trim() || (sign < 0 && wishId ? "实现愿望：" + ((openWishes.find(w => w.id === wishId) || {}).title || "") : ""), sign < 0 ? wishId : "");
    if (ok !== false) { setAmt(""); setNote(""); setWishId(""); }
  };
  const INK = "#3d3a33", FOG = "#958d7e", PAPER = "#fbf7ee", RULE = "rgba(120,100,70,.18)", RED = "#a4473b", GREEN = "#4f7a4d";
  const field = { background: "transparent", color: INK, border: "none", borderBottom: "1px solid " + RULE, borderRadius: 0, padding: "7px 2px", outline: "none", fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))" };
  const label = s0 => h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", letterSpacing: ".18em", color: FOG } }, s0);
  // 罐子里的硬币：从底往上一层层码，层数跟着水位走；每层几枚、错开半枚
  const COIN_ROWS = 14, rows = Math.round(level * COIN_ROWS);
  const coins = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < 5; c++) {
    const x = 10 + c * 22 + (r % 2 ? 11 : 0); if (x > 112) continue;
    coins.push(h("span", { key: r + "_" + c, style: { position: "absolute", left: x, bottom: 6 + r * 9, width: 22, height: 10, borderRadius: "50%",
      background: "radial-gradient(ellipse at 40% 35%,#f8e1a0,#d8a648 60%,#a97a2c)", boxShadow: "0 1px 0 rgba(90,60,20,.35)" } }));
  }
  // 附了话的那几笔：折成小纸条塞在硬币上面（最多四张，最新的在最上面）
  const slips = (j.ledger || []).filter(r => r && r.delta > 0 && r.note).slice(0, 4);
  // 存折：按月翻
  const byMonth = [];
  (j.ledger || []).forEach(r => { const d = new Date(r.ts || 0), k = d.getFullYear() + "." + String(d.getMonth() + 1).padStart(2, "0"); let g = byMonth.find(x => x.k === k); if (!g) { g = { k, list: [] }; byMonth.push(g); } g.list.push(r); });
  const COLS = "40px minmax(0,1fr) 50px 50px 58px";
  return h("div", { "data-wk": "jarpage", className: "h-full flex flex-col", style: { background: "#efe8da", backgroundImage: "repeating-linear-gradient(0deg,rgba(255,255,255,.18) 0 1px,transparent 1px 5px)" } },
    h(Head, { zh: "我们的存钱罐", onBack, bg: "transparent", ink: INK }),
    h("div", { className: "flex-1 min-h-0 overflow-y-auto px-5", style: { paddingBottom: "calc(28px + env(safe-area-inset-bottom))" } },
      // ① 搁在木板上的罐子 + 罐颈上的吊牌
      h("div", { style: { position: "relative", height: 252, marginTop: 6 } },
        h("div", { "data-wk": "jarglass", style: { position: "absolute", left: "50%", marginLeft: -78, bottom: 18, width: 132, height: 196 } },
          // 盖子：两道铁皮
          h("div", { "aria-hidden": "true", style: { position: "absolute", left: 30, right: 30, top: 0, height: 13, borderRadius: "5px 5px 2px 2px", background: "linear-gradient(180deg,#c9ccc9,#8f9592)", boxShadow: "inset 0 -2px 0 rgba(0,0,0,.15)" } }),
          h("div", { "aria-hidden": "true", style: { position: "absolute", left: 50, right: 50, top: 4, height: 3, borderRadius: 2, background: "#4a4f4c" } }),
          // 罐颈
          h("div", { "aria-hidden": "true", style: { position: "absolute", left: 26, right: 26, top: 12, height: 14, background: "rgba(225,238,240,.55)", border: "1.5px solid rgba(120,150,155,.5)", borderTop: "none" } }),
          // 罐身
          h("div", { "data-wk": "block", style: { position: "absolute", left: 0, right: 0, top: 24, bottom: 0, borderRadius: "30px 30px 22px 22px", background: "rgba(225,238,240,.42)", border: "1.5px solid rgba(120,150,155,.55)", overflow: "hidden", boxShadow: "inset 0 -10px 18px rgba(110,140,150,.16)" } },
            coins,
            slips.map((r, i) => h("span", { key: r.id, title: r.note, style: { position: "absolute", left: 18 + (i % 2) * 44, bottom: 10 + rows * 9 + (i >> 1) * 13, width: 46, height: 12, borderRadius: 2,
              background: i % 2 ? "#f4e7c8" : "#f7efe0", border: "1px solid rgba(150,120,70,.35)", transform: "rotate(" + [-14, 9, -5, 16][i] + "deg)", boxShadow: "0 1px 2px rgba(90,60,20,.18)" } })),
            // 玻璃上的两道高光
            h("div", { "aria-hidden": "true", style: { position: "absolute", left: 12, top: 14, bottom: 26, width: 7, borderRadius: 7, background: "rgba(255,255,255,.6)" } }),
            h("div", { "aria-hidden": "true", style: { position: "absolute", left: 24, top: 18, height: 34, width: 3, borderRadius: 3, background: "rgba(255,255,255,.45)" } }))),
        // 系在罐颈上的吊牌：一根线 + 一张牛皮纸卡，点它定／改目标
        h("div", { "aria-hidden": "true", style: { position: "absolute", left: "50%", marginLeft: 46, top: 38, width: 34, height: 1.5, background: "#8b6a43", transform: "rotate(22deg)", transformOrigin: "left center" } }),
        h("button", { onClick: () => setGoalEdit({ name: goal ? goal.name : "", amount: goal ? String(goal.amount) : "" }), className: "active:opacity-80",
          style: { position: "absolute", left: "50%", marginLeft: 74, top: 46, width: 96, padding: "9px 8px 8px 14px", textAlign: "left", background: "#d9be8e", border: "1px solid #b8986a",
            borderRadius: "3px 6px 6px 3px", transform: "rotate(7deg)", boxShadow: "0 3px 7px rgba(90,60,25,.22)" } },
          h("span", { "aria-hidden": "true", style: { position: "absolute", left: 4, top: "50%", marginTop: -3, width: 6, height: 6, borderRadius: 99, background: "#efe8da", border: "1px solid #a8885a" } }),
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(9px * var(--app-fs, 1))", letterSpacing: ".14em", color: "#6f5430" } }, goal ? "攒来" : "还没定"),
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(13px * var(--app-fs, 1))", color: "#3f2e17", marginTop: 3, lineHeight: 1.35, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, goal ? goal.name : "定个目标"),
          goal ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10px * var(--app-fs, 1))", color: "#6f5430", marginTop: 3 } }, goal.hitTs ? "攒到了" : Math.round(level * 100) + "% · " + money(goalAmt)) : null),
        // 木板
        h("div", { "aria-hidden": "true", style: { position: "absolute", left: -6, right: -6, bottom: 6, height: 14, borderRadius: 3, background: "linear-gradient(180deg,#b88c5c,#94693f)", boxShadow: "0 6px 10px rgba(80,50,20,.22)" } }),
        h("div", { style: { position: "absolute", left: 0, bottom: 34, fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", letterSpacing: ".16em", color: FOG } }, "罐子里有"),
        h("div", { style: { position: "absolute", left: 0, bottom: 52, fontFamily: F_DISPLAY, fontSize: "calc(30px * var(--app-fs, 1))", color: INK, lineHeight: 1 } }, money(bal))),
      // 定目标：吊牌翻过来那一面
      goalEdit ? h("div", { "data-wk": "block", style: { marginTop: 4, background: "#e6d3ad", border: "1px solid #c3a674", borderRadius: 6, padding: "12px 14px" } },
        label("吊牌背面 · 写下要攒的"),
        h("input", { "data-wk": "input", value: goalEdit.name, onChange: e => setGoalEdit({ ...goalEdit, name: e.target.value }), maxLength: 30, placeholder: "攒来做什么，比如「一起去海边」", style: Object.assign({ width: "100%", marginTop: 6 }, field) }),
        h("div", { className: "flex items-end", style: { gap: 10, marginTop: 6 } },
          h("input", { "data-wk": "input", value: goalEdit.amount, onChange: e => setGoalEdit({ ...goalEdit, amount: e.target.value.replace(/[^\d.]/g, "") }), inputMode: "decimal", placeholder: "攒到多少", style: Object.assign({ flex: 1, minWidth: 0 }, field) }),
          h("button", { onClick: () => { onGoal(goalEdit.name, goalEdit.amount); setGoalEdit(null); }, className: "active:opacity-70", style: { padding: "8px 16px", borderRadius: 4, background: "#5a4326", color: "#f4ead6", fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", border: "none" } }, "系上"),
          goal ? h("button", { onClick: () => { onGoal("", 0); setGoalEdit(null); }, className: "active:opacity-70", style: { padding: "8px 4px", background: "transparent", color: "#6f5430", fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", border: "none" } }, "解下来") : null,
          h("button", { "data-wk": "block", onClick: () => setGoalEdit(null), className: "active:opacity-70", style: { padding: "8px 4px", background: "transparent", color: "#6f5430", fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", border: "none" } }, "算了"))) : null,
      // ② 存取单：一张横线小票
      h("div", { "data-wk": "block", style: { marginTop: 16, background: PAPER, borderRadius: 4, padding: "14px 16px 12px", boxShadow: "0 4px 12px rgba(90,70,40,.12)", position: "relative" } },
        h("div", { className: "flex items-baseline justify-between" },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(15px * var(--app-fs, 1))", color: INK, letterSpacing: 2 } }, "存 取 单"),
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: FOG } }, "你的钱包 " + money(myWallet || 0))),
        h("div", { className: "flex items-end", style: { gap: 12, marginTop: 8 } },
          h("div", { style: { width: 108 } }, label("金额"), h("input", { "data-wk": "input", value: amt, onChange: e => setAmt(e.target.value.replace(/[^\d.]/g, "")), inputMode: "decimal", placeholder: "0", style: Object.assign({ width: "100%", fontFamily: F_DISPLAY, fontSize: "calc(20px * var(--app-fs, 1))" }, field) })),
          h("div", { style: { flex: 1, minWidth: 0 } }, label("附言"), h("input", { "data-wk": "input", value: note, onChange: e => setNote(e.target.value), maxLength: 60, placeholder: "写一句（可空）", style: Object.assign({ width: "100%" }, field) }))),
        openWishes.length ? h("div", { style: { marginTop: 10 } }, label("取出来是为了"),
          h("select", { value: wishId, onChange: e => setWishId(e.target.value), style: Object.assign({ width: "100%" }, field) },
            [h("option", { key: "", value: "" }, "不为哪个愿望")].concat(openWishes.map(w => h("option", { key: w.id, value: w.id }, "实现：" + (w.title || "")))))) : null,
        h("div", { className: "flex", style: { gap: 10, marginTop: 14 } },
          h("button", { "data-wk": "block", onClick: () => go(1), disabled: !(n > 0), className: "flex-1 active:opacity-70", style: { padding: "11px 0", borderRadius: 4, background: GREEN, color: "#fff", fontFamily: F_DISPLAY, fontSize: "calc(14px * var(--app-fs, 1))", letterSpacing: 2, border: "none", opacity: n > 0 ? 1 : .4 } }, "存 进 去"),
          h("button", { "data-wk": "block", onClick: () => go(-1), disabled: !(n > 0), className: "flex-1 active:opacity-70", style: { padding: "11px 0", borderRadius: 4, background: "transparent", color: RED, fontFamily: F_DISPLAY, fontSize: "calc(14px * var(--app-fs, 1))", letterSpacing: 2, border: "1px solid " + RED, opacity: n > 0 ? 1 : .4 } }, wishId ? "取 去 实 现" : "取 出 来")),
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: FOG, marginTop: 10, lineHeight: 1.7 } },
          "存进去从你的钱包扣，取出来回到你的钱包。" + partner.name + " 也能自己存、自己取，每月发工资那天会自己存 " + (j.autoPct == null ? 10 : j.autoPct) + "%。")),
      // ③ 存折
      h("div", { "data-wk": "block", style: { marginTop: 18, background: "#f6f1e4", borderRadius: 3, boxShadow: "0 4px 12px rgba(90,70,40,.12)", overflow: "hidden" } },
        h("div", { className: "flex items-center justify-between", style: { background: "#7c2f2f", color: "#f3e3c8", padding: "10px 14px" } },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(15px * var(--app-fs, 1))", letterSpacing: 3 } }, "存 折"),
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", opacity: .8 } }, (myName || "我") + " · " + partner.name)),
        h("div", { style: { display: "grid", gridTemplateColumns: COLS, gap: 4, padding: "7px 12px", borderBottom: "1px solid " + RULE, fontFamily: F_BODY, fontSize: "calc(10px * var(--app-fs, 1))", color: FOG } },
          h("div", null, "日期"), h("div", null, "摘要"), h("div", { style: { textAlign: "right" } }, "存入"), h("div", { style: { textAlign: "right" } }, "支取"), h("div", { style: { textAlign: "right" } }, "结余")),
        !byMonth.length ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: FOG, padding: "18px 12px", textAlign: "center" } }, "还是空的。存进第一笔，这一页就有字了。") :
        byMonth.map(g => h("div", { key: g.k },
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10px * var(--app-fs, 1))", letterSpacing: ".12em", color: "#7c2f2f", padding: "8px 12px 2px" } }, g.k),
          g.list.map(r => h("div", { key: r.id, "data-wk": "jarrow", "data-who": r.who, style: { display: "grid", gridTemplateColumns: COLS, gap: 4, alignItems: "baseline", padding: "7px 12px", borderBottom: "1px dashed " + RULE, fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: INK } },
            h("div", { style: { color: FOG, fontSize: "calc(10.5px * var(--app-fs, 1))" } }, (new Date(r.ts).getMonth() + 1) + "/" + new Date(r.ts).getDate()),
            h("div", { style: { minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, (r.who === "me" ? "我" : partner.name) + (r.auto ? " · 工资日" : "") + (r.note ? " · " + r.note : "")),
            h("div", { style: { textAlign: "right", color: GREEN } }, r.delta > 0 ? money(r.delta) : ""),
            h("div", { style: { textAlign: "right", color: RED } }, r.delta < 0 ? money(-r.delta) : ""),
            h("div", { style: { textAlign: "right", fontFamily: F_DISPLAY } }, money(r.after)))))))));
}
function CoupleWishes({ partner, data, onSave, onPlan, planOf, trips, onDepart, onOpenTrips, onGenWish, wishGen, onBack }) {
  const t = useTheme();
  const wishes = Array.isArray(data) ? data : [];
  const [title, setTitle] = useState("");
  const [type, setType] = useState("一起做");
  const [note, setNote] = useState("");
  // 「已计划」的愿望可以挑个日子（v62.11）：到那天TA主动来约——走约回那条现成的链
  const [planFor, setPlanFor] = useState(null);
  const [planVal, setPlanVal] = useState("");
  const [planHm, setPlanHm] = useState(COUPLE_DUE_DEFAULT_HM);
  // ⚠️跟「说好的事」同一个形状，所以用同一份（施工规则/one-public-mechanism.md）：
  //   各写一份 `T09:00:00` 正是上一版倒填错乱的病根之一。
  const planTs = (v, hm) => coupleDueTs(v, hm);
  const planLeft = ts => { const n2 = Math.ceil((ts - Date.now()) / 86400000); const when = n2 > 0 ? "还有 " + n2 + " 天" : n2 === 0 ? "就是今天" : "过了 " + (-n2) + " 天"; return when + " " + coupleDueClock(ts); };
  const add = () => {
    const clean = title.trim(); if (!clean) return;
    const now = Date.now();
    onSave([{ id: "wish_" + now + "_" + Math.random().toString(36).slice(2, 6), title: clean, type, note: note.trim(), status: "wish", createdAt: now, updatedAt: now }, ...wishes]);
    setTitle(""); setNote("");
  };
  const patchWish = (id, patch) => onSave(wishes.map(w => w.id === id ? { ...w, ...patch, updatedAt: Date.now() } : w));
  const removeWish = id => onSave(wishes.filter(w => w.id !== id));
  const statusMeta = { wish: ["想做", "#a05a78"], planned: ["已计划", "#4a7396"], done: ["实现了", "#4c7a60"], shelved: ["先搁着", "#847a72"] };
  // ── 软木板（v62.14）：它叫「板」，原来长得是表单+列表+状态药丸——换个 app 照样成立。
  // 现在整页就是一块软木板（底纹铺外壳、顶栏透明、不跟着滚：mobile-ui-layout §3.5），
  // 每个愿望是一张钉在板上的纸条：图钉、微歪、各有各的纸色；实现了的盖一个歪章。
  // 状态切换不再是药丸，是【盖章】：选中那枚真的「盖下去」（实底、歪着、压出影）——
  // 形状和角度都变了，不只靠色差（tabs-not-plain-pills 那两条底线）。
  const CORK = "#b3905f";
  const pin = tint2 => h("div", { "aria-hidden": "true", style: { position: "absolute", top: -7, left: "50%", marginLeft: -7, width: 14, height: 14, borderRadius: 999, background: "radial-gradient(circle at 35% 30%," + (tint2 === "b" ? "#7fa3c6,#33567a" : "#e88f7a,#a63b28") + ")", boxShadow: "0 3px 4px rgba(60,30,10,.4), inset 0 -2px 3px rgba(0,0,0,.28)", zIndex: 2 } });
  const stamp = (on, label, color, onClick, big) => h("button", { key: label, onClick, className: "active:opacity-70",
    style: { minHeight: 40, padding: "4px 3px", background: "transparent" } },
    h("span", { style: { display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: big ? 56 : 46, padding: "4px 8px", borderRadius: 3,
      border: "1.5px solid " + color, color: on ? "#fff" : color, background: on ? color : "transparent",
      transform: on ? "rotate(-6deg)" : "none", boxShadow: on ? "0 2px 4px rgba(60,30,10,.3)" : "none", transition: "transform .12s",
      fontFamily: F_DISPLAY, fontSize: big ? 12 : 11 } }, label));
  const paperInk = "#4a3d2b", paperFog = "#94856a";
  const tilt = i => [-1.2, 0.8, -0.6, 1.3, -0.9, 0.5][i % 6];
  return h("div", { "data-wk": "uspage", "data-part": "couplewishes", className: "h-full flex flex-col", style: {
    background: CORK,
    // 软木的颗粒：三层大小不一的点阵叠出来，不跟着滚（铺在外壳上）
    backgroundImage: "radial-gradient(rgba(120,85,40,.16) 1px, transparent 1.6px), radial-gradient(rgba(255,240,210,.13) 1px, transparent 1.5px), radial-gradient(rgba(90,60,25,.12) 1.4px, transparent 2px)",
    backgroundSize: "9px 9px, 13px 13px, 23px 23px", backgroundPosition: "0 0, 4px 7px, 11px 3px",
    boxShadow: "inset 0 0 46px rgba(90,60,25,.30)" } },
    h(Head, { zh: "愿望板", en: partner.name, onBack, bg: "transparent", ink: "#3a2c15" }),
    h("div", { className: "flex-1 min-h-0 overflow-y-auto px-5 pb-10" },
      // 表单也是钉在板上的一张纸
      h("div", { "data-wk": "block", style: { position: "relative", marginTop: 14, padding: "16px 15px 13px", background: "#fbf5e6", borderRadius: 2, transform: "rotate(-0.5deg)", boxShadow: "0 7px 16px rgba(70,45,15,.28)" } },
        pin("b"),
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(15px * var(--app-fs, 1))", color: paperInk } }, "放进一件以后想一起做的事"),
        h("input", { "data-wk": "input", value: title, onChange: e => setTitle(e.target.value), placeholder: "去哪里、吃什么，或想完成的一件小事", className: "w-full outline-none", style: { marginTop: 10, background: "transparent", borderBottom: "1px dashed #d5c7a4", padding: "7px 2px", fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", color: paperInk } }),
        h("div", { className: "flex flex-wrap", style: { marginTop: 6 } }, ["一起做", "一起去", "一起吃", "一起学", "想送 TA"].map(x => stamp(type === x, x, "#8a6a3a", () => setType(x)))),
        h("textarea", { "data-wk": "textarea", value: note, onChange: e => setNote(e.target.value), rows: 2, placeholder: "可选：为什么想做、已经约到哪一步", className: "w-full outline-none resize-none", style: { marginTop: 4, background: "transparent", borderBottom: "1px dashed #d5c7a4", padding: "6px 2px", fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", lineHeight: 1.6, color: paperInk } }),
        h("button", { onClick: add, disabled: !title.trim(), className: "w-full active:opacity-70 disabled:opacity-40", style: { marginTop: 11, borderRadius: 8, background: "#4a3d2b", color: "#fbf5e6", padding: "10px 12px", fontFamily: F_DISPLAY, fontSize: "calc(14px * var(--app-fs, 1))" } }, "钉到板上")),
      // 走过/正走着的旅行：板上钉一张小机票当入口（v62.26 旅行不开新门，全从这儿进）
      (trips && trips.length && onOpenTrips) ? h("button", { onClick: onOpenTrips, className: "w-full text-left active:opacity-80",
        style: { position: "relative", marginTop: 14, padding: "11px 13px", background: "#f2ead6", borderRadius: 2,
          transform: "rotate(0.5deg)", boxShadow: "0 5px 12px rgba(70,45,15,.24)", minHeight: 44 } },
        pin("b"),
        h("div", { className: "flex items-center", style: { gap: 9 } },
          h("div", { className: "flex-1 min-w-0" },
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(14.5px * var(--app-fs, 1))", color: paperInk } },
              trips.some(t => t.status !== "done") ? "有一趟正走着 · 看登机牌" : "你们的登机牌"),
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: paperFog, marginTop: 2 } }, "走过 " + trips.filter(t => t.status === "done").length + " 趟")),
          h("span", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: paperFog } }, "→"))) : null,
      // ── 让 TA 也钉一条（v62.34，她 2026-09-04：「有时候还是希望能我主动让TA来写」）──
      // 一张空白的、只钉了半边的纸——它自己就是「这儿还空着，等TA写」的样子。
      // ⚠️她按这一下【单独计数】：不进「哪几档很久没出现」那本账（她点名的），
      //   也不动TA的思念——不是TA自己想起来的，凭什么替TA泄。
      onGenWish ? h("button", { onClick: () => !wishGen && onGenWish(partner), disabled: wishGen,
        className: "w-full active:opacity-80 disabled:opacity-70",
        style: { position: "relative", marginTop: 17, padding: "15px 14px 14px", borderRadius: 2, textAlign: "left",
          background: "repeating-linear-gradient(135deg,rgba(255,253,244,.92) 0 9px,rgba(246,240,224,.92) 9px 18px)",
          border: "1px dashed rgba(120,90,45,.5)", transform: "rotate(0.9deg)", boxShadow: "0 5px 13px rgba(70,45,15,.22)" } },
        pin("r"),
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(14.5px * var(--app-fs, 1))", color: paperInk } },
          wishGen ? partner.name + " 正在想…" : "让 " + partner.name + " 也钉一条"),
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: paperFog, marginTop: 4, lineHeight: 1.6 } },
          wishGen ? characterText(partner, "他在翻自己心里那件一直没做成的事") : characterText(partner, "他自己想跟你一起做、但一直没做成的那件事"))) : null,
      wishes.length ? h("div", { style: { display: "flex", flexDirection: "column", gap: 17, marginTop: 20 } }, wishes.map((w, wi) => {
        const done = w.status === "done", shelved = w.status === "shelved";
        return h("article", { key: w.id, style: { position: "relative", padding: "15px 14px 8px", borderRadius: 2,
          background: done ? "#f2ecd9" : shelved ? "#ece4d2" : "#fffdf4",
          transform: "rotate(" + tilt(wi) + "deg)", opacity: shelved ? 0.78 : 1,
          boxShadow: "0 " + (done || shelved ? 4 : 8) + "px " + (done || shelved ? 10 : 18) + "px rgba(70,45,15," + (done || shelved ? ".18" : ".3") + ")" } },
          pin(done ? "b" : "r"),
          // 实现了：一个歪盖的章压在角上——纸条自己说完了这件事的结局
          done ? h("div", { "aria-hidden": "true", style: { position: "absolute", right: 8, top: 10, transform: "rotate(-13deg)", border: "2.5px solid rgba(76,122,96,.68)", color: "rgba(76,122,96,.8)", borderRadius: 5, padding: "1px 8px", fontFamily: F_DISPLAY, fontSize: "calc(13px * var(--app-fs, 1))", letterSpacing: 3, zIndex: 1 } }, "实现了") : null,
          h("div", { className: "flex items-start justify-between gap-3" },
            h("div", { className: "min-w-0" },
              h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(17px * var(--app-fs, 1))", color: paperInk, lineHeight: 1.4, textDecoration: done ? "line-through" : "none", textDecorationColor: "rgba(76,122,96,.5)" } }, STX(w.title)),
              h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: paperFog, marginTop: 3 } }, w.type || "一起做")),
            h("button", { onClick: () => removeWish(w.id), "aria-label": "取下来", className: "active:opacity-60", style: { flexShrink: 0, color: paperFog, fontSize: "calc(12px * var(--app-fs, 1))", minHeight: 32, padding: "0 4px", fontFamily: F_BODY } }, "取下")),
          w.note ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", lineHeight: 1.65, color: "#7a6b50", marginTop: 8 } }, STX(w.note)) : null,
          h("div", { className: "flex flex-wrap items-center", style: { marginTop: 5, borderTop: "1px dashed #e0d4b4", paddingTop: 2 } },
            Object.keys(statusMeta).map(k => stamp(w.status === k, statusMeta[k][0], statusMeta[k][1], () => patchWish(w.id, { status: k })))),
          // 「一起去」的能出发（v62.26）：从这条愿望长出一趟真的旅行
          (function () {
            if (w.type !== "一起去" || w.status === "done" || w.status === "shelved" || !onDepart) return null;
            const going = trips && trips.some(t => t.status !== "done");
            return h("div", { style: { margin: "2px 0 8px" } },
              h("button", { onClick: () => going ? (onOpenTrips && onOpenTrips()) : onDepart(w), className: "active:opacity-60",
                style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: "#6a5a40", minHeight: 32 } },
                going ? "旅途中 · 看登机牌" : "出发 · 把它变成一趟真的旅行"));
          })(),
          // 已计划的可以挑个日子：到那天TA会主动来约这件事（约回链，不是提醒闹钟）
          (function () {
            if (w.status !== "planned" || !onPlan) return null;
            const pl = planOf ? planOf(w.id) : null;
            return h("div", { style: { margin: "2px 0 8px" } },
              pl ? h("div", { className: "flex items-center flex-wrap", style: { gap: 9 } },
                h("span", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: "#4a7396", border: "1px solid #cdbfa0", borderRadius: 999, padding: "3px 10px" } },
                  (new Date(pl.dueTs).getMonth() + 1) + "月" + new Date(pl.dueTs).getDate() + "日 · " + planLeft(pl.dueTs) + characterText(partner, " · 到时他来约")),
                h("button", { onClick: () => onPlan(w, 0), className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: paperFog, minHeight: 32 } }, "不定了"))
              : planFor === w.id ? h("div", { className: "flex items-center", style: { gap: 8 } },
                h("input", { type: "date", value: planVal, onChange: e => setPlanVal(e.target.value), style: { flex: 1, minWidth: 0, fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: paperInk, background: "#fffdf6", border: "1px solid #d5c7a4", borderRadius: 8, padding: "8px 10px", outline: "none" } }),
                h("input", { type: "time", value: planHm, "aria-label": "几点", onChange: e => setPlanHm(e.target.value), style: { width: 96, flexShrink: 0, fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: paperInk, background: "#fffdf6", border: "1px solid #d5c7a4", borderRadius: 8, padding: "8px 8px", outline: "none" } }),
                h("button", { onClick: () => { const ts = planTs(planVal, planHm); if (ts) { onPlan(w, ts); setPlanFor(null); } }, disabled: !planVal, className: "shrink-0 active:opacity-70 disabled:opacity-40", style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: "#fff", background: "#4a7396", borderRadius: 8, padding: "8px 12px" } }, "就这天"))
              : h("button", { onClick: () => { setPlanFor(w.id); setPlanVal(""); }, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: "#6a5a40", minHeight: 32 } }, characterText(partner, "挑个日子 · 到那天他来约")));
          })());
      })) : h("div", { style: { margin: "26px 4px 0", padding: "30px 16px", textAlign: "center", border: "1.5px dashed rgba(70,45,15,.35)", borderRadius: 6, fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: "#5c4726", lineHeight: 1.9 } }, "板上还空着。", h("br"), "先钉一件不急着完成、但不想忘记的事。")));
}

// ── 情侣空间·花房（v62.33）────────────────────────────────────────────────
// 盆栽全程序画：一只陶盆，按长势画芽/叶/苞/花——花色是TA挑的那个色。
// 打盹（一周没相处）只是姿态压淡，不掉任何东西（不惩罚，见 js/garden.js 顶上）。
function GardenPlant({ g, size }) {
  const sp = g && g.species;
  const stage = (typeof GardenKit !== "undefined" && sp) ? GardenKit.stageOf(g.fed).key : "empty";
  const doze = typeof GardenKit !== "undefined" && GardenKit.dozing(g, Date.now());
  const C = (g && g.color) || "#c98a9e";
  const kids = [];
  const leaf = (x, y, rot, len) => kids.push(h("ellipse", { key: "lf" + x + y, cx: x, cy: y, rx: len, ry: len * 0.42,
    fill: "#6f9a58", transform: "rotate(" + rot + " " + x + " " + y + ")" }));
  // 盆 + 土（一直都在）
  kids.push(h("path", { key: "pot", d: "M28 88 L72 88 L66 116 L34 116 Z", fill: "#b5764a" }));
  kids.push(h("rect", { key: "rim", x: 25, y: 84, width: 50, height: 7, rx: 2.5, fill: "#a4643c" }));
  kids.push(h("ellipse", { key: "soil", cx: 50, cy: 85, rx: 21, ry: 4.5, fill: "#5d4630" }));
  if (stage === "seed") kids.push(h("circle", { key: "seed", cx: 50, cy: 83, r: 2.4, fill: "#8a6a42" }));
  if (stage === "sprout") {
    kids.push(h("path", { key: "st", d: "M50 84 L50 72", stroke: "#6f9a58", strokeWidth: 3, strokeLinecap: "round", fill: "none" }));
    leaf(45, 71, -35, 7); leaf(55, 71, 35, 7);
  }
  if (stage === "leaf" || stage === "bud" || stage === "bloom") {
    kids.push(h("path", { key: "st", d: "M50 84 C 50 70 49 56 50 " + (stage === "leaf" ? 46 : 36), stroke: "#5f8a4a", strokeWidth: 3.4, strokeLinecap: "round", fill: "none" }));
    leaf(42, 72, -40, 9); leaf(58, 68, 40, 9); leaf(43, 58, -32, 8);
    if (stage !== "leaf") leaf(57, 52, 34, 8);
  }
  if (stage === "bud") kids.push(h("ellipse", { key: "bud", cx: 50, cy: 32, rx: 6, ry: 8.5, fill: C, opacity: 0.85 }),
    h("path", { key: "sep", d: "M46 38 Q50 44 54 38", stroke: "#5f8a4a", strokeWidth: 2.4, fill: "none", strokeLinecap: "round" }));
  if (stage === "bloom") {
    for (let i = 0; i < 6; i++) kids.push(h("ellipse", { key: "pt" + i, cx: 50, cy: 27, rx: 5.5, ry: 10,
      fill: C, opacity: 0.92, transform: "rotate(" + (i * 60) + " 50 36)" }));
    kids.push(h("circle", { key: "core", cx: 50, cy: 36, r: 4.5, fill: "#e8c26a" }));
  }
  return h("svg", { width: size || 60, height: (size || 60) * 1.2, viewBox: "0 0 100 120",
    style: { display: "block", flexShrink: 0, opacity: doze ? 0.62 : 1 } }, kids);
}

// 花房整页（no-half-sheet）。规矩就三条：花是TA挑的；它吃你们真实的相处（不靠浇水按钮，
// 没有任何数值进度条——长到哪儿看它自己）；开完一茬收一枚干花，盆空出来等下一种。
function CoupleGarden({ partner, data, gen, onPlant, onKeep, onBack }) {
  const t = useTheme();
  // 干花册里点开一枚看全文（她 2026-09-18 转小红书群里读者 ! YOLO：
  //   「干花册里面看不到完整的详情文字，能不能点开能够弹出来，或者就是直接展示区更大一些」）
  // ⚠️不另开一个弹层：册子本来就是一册一册翻的，点开那一枚就地摊开最像它自己。
  //   也不无脑全展开——那句是TA挑这种花的理由，长短不一，全摊开册子就没法一眼扫完了。
  const [openFlower, setOpenFlower] = useState(-1);
  const g = data || {};
  const kept = Array.isArray(g.kept) ? g.kept : [];
  const st = (typeof GardenKit !== "undefined" && g.species) ? GardenKit.stageOf(g.fed) : null;
  const doze = typeof GardenKit !== "undefined" && GardenKit.dozing(g, Date.now());
  const bloomed = !!g.bloomTs;
  const fmtD = ts => { const d = new Date(ts || 0); return d.getFullYear() + "." + (d.getMonth() + 1) + "." + d.getDate(); };
  return h("div", { "data-wk": "uspage", "data-part": "couplegarden", className: "h-full flex flex-col", style: cpSkin(t, "sill") },
    h(Head, { zh: "花房", sub: partner.remark || partner.name, bg: "transparent", onBack }),
    h("div", { className: "flex-1 min-h-0 overflow-y-auto px-6 pb-10", style: { overscrollBehavior: "contain" } },
      g.species ? h(Fragment, null,
        h("div", { style: { marginTop: 14, borderRadius: 20, padding: "22px 18px 18px", textAlign: "center",
          background: "linear-gradient(170deg,#f5f8f0,#eaf0e2)", border: "1px solid #dbe4cf" } },
          h("div", { style: { display: "flex", justifyContent: "center" } }, h(GardenPlant, { g: g, size: 150 })),
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(22px * var(--app-fs, 1))", color: "#43552f", marginTop: 10 } }, g.species),
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: "#7a8a62", marginTop: 4 } },
            st.zh + " · " + fmtD(g.plantedTs) + " 种下"),
          g.why ? h("div", { style: { fontFamily: F_DISPLAY, fontStyle: "italic", fontSize: "calc(13px * var(--app-fs, 1))", lineHeight: 1.7, color: "#93707c", marginTop: 10 } }, "「", (typeof TransText === "function" ? h(TransText, { text: g.why, inline: true }) : g.why), "」") : null),
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.fog, lineHeight: 1.8, textAlign: "center", marginTop: 12 } },
          doze ? "它在打盹——你们回来，它就接着长。" : "它吃你们真实的相处：聊过天、线下待过、打过卡，它就长一点。没有进度条——长到哪儿，看它自己。"),
        bloomed ? h("button", { onClick: onKeep, className: "w-full active:opacity-70",
          style: { marginTop: 14, background: t.ink, color: t.bg2, fontFamily: F_DISPLAY, fontSize: "calc(15px * var(--app-fs, 1))", padding: "13px 0", borderRadius: 14 } },
          "收一枚干花 · 让盆空出来") : null)
      : h(Fragment, null,
        h("div", { style: { marginTop: 16, borderRadius: 20, padding: "26px 18px", textAlign: "center", border: "1.5px dashed " + t.line } },
          h("div", { style: { display: "flex", justifyContent: "center" } }, h(GardenPlant, { g: {}, size: 110 })),
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.fog, lineHeight: 1.9, marginTop: 8 } },
            kept.length ? "盆空着。让 " + partner.name + " 再挑一种。" : "窗台上有一只空盆。种什么，让 " + partner.name + " 来挑。")),
        h("button", { onClick: onPlant, disabled: gen, className: "w-full active:opacity-70 disabled:opacity-40",
          style: { marginTop: 14, background: t.ink, color: t.bg2, fontFamily: F_DISPLAY, fontSize: "calc(15px * var(--app-fs, 1))", padding: "13px 0", borderRadius: 14 } },
          gen ? partner.name + " 挑着…" : "让 " + partner.name + " 挑一种花")),
      kept.length ? h("div", { style: { marginTop: 24 } },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(16px * var(--app-fs, 1))", color: t.ink, marginBottom: 9 } }, "干花册"),
        kept.map((k, i) => {
          const on = openFlower === i;
          // 没有理由那一句的，点开也没有第二层，就别做成按钮（点了没反应比不能点更糟）
          const row = h("div", { className: "flex items-center", style: { gap: 11, padding: "11px 2px", borderBottom: on ? "none" : "1px solid " + t.line } },
            h("span", { "aria-hidden": "true", style: { width: 11, height: 11, borderRadius: "50% 50% 50% 0", background: k.color || "#c98a9e", opacity: 0.8, flexShrink: 0, transform: "rotate(-45deg)" } }),
            h("div", { className: "flex-1 min-w-0 text-left" },
              h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(14px * var(--app-fs, 1))", color: t.ink } }, k.species),
              // 收起时一行带省略号；点开时整段摊开（pre-wrap + break-word，长句不撑破册子）
              k.why ? h("div", { style: on
                ? { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.sub, marginTop: 4, lineHeight: 1.85, whiteSpace: "pre-wrap", wordBreak: "break-word" }
                : { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } },
                "「", (on && typeof TransText === "function" ? h(TransText, { text: k.why, inline: true }) : k.why), "」") : null),
            h("span", { style: { fontFamily: F_BODY, fontSize: "calc(10px * var(--app-fs, 1))", color: t.fog, flexShrink: 0 } }, fmtD(k.ts) + " 收"));
          if (!k.why) return h("div", { key: i }, row);
          return h("button", { key: i, onClick: () => setOpenFlower(on ? -1 : i),
            className: "w-full active:opacity-70",
            "aria-expanded": on ? "true" : "false",
            style: on ? { display: "block", borderBottom: "1px solid " + t.line, paddingBottom: 4 } : { display: "block" } }, row);
        })) : null));
}

// ── 情侣空间·旅行（v62.26，她 2026-09-04 拍板）──────────────────────────────
// 整页（no-half-sheet）。它长成【一张登机牌 + TA手写批注的行程册】：现实里一趟旅行
// 留在手里的就是这两样。从愿望板「一起去」进来，返回也回愿望板（一层层退）。
// 配色整套写死（票纸写死浅色，字色跟主题走会在深色主题下失明——信纸那套的老课）。
const tripTodayKey = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
// 旅行里那一步「订票订房」：三班去程、三家酒店，TA 先说自己会挑哪个；你可以改，然后你付或 TA 请客
function TripBooking({ partner, trip, gen, onBook, onBookPick, onBookPay, hasKin }) {
  const t = useTheme();
  const b = trip && trip.booking;
  const name = partner.remark || partner.name;
  const card = { background: "#fdfaf1", border: "1px solid #e6dcc4", borderRadius: 6, padding: "10px 12px", marginBottom: 8 };
  if (!b) return h("button", { "data-wk": "tripbook", "data-part": "search", onClick: onBook, disabled: gen, className: "w-full active:opacity-70 disabled:opacity-40",
    style: { marginTop: 14, minHeight: 44, background: t.bg2, border: "1px dashed " + t.line, borderRadius: 12, fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", color: t.tint } },
    gen ? "在查票和房…" : "✈ 订机票和酒店");
  const pick = b.pick || { flight: b.taPick.flight, back: b.taPick.back, hotel: b.taPick.hotel };
  const backs = Array.isArray(b.back) ? b.back : [];
  const total = (b.flights[pick.flight] ? b.flights[pick.flight].price * 2 : 0) + (backs[pick.back] ? backs[pick.back].price * 2 : 0)
    + (b.hotels[pick.hotel] ? b.hotels[pick.hotel].price * (b.nights || 1) : 0);
  const seat = b.seat || { me: "window" };
  const byZh = { ta: name + " 请客", aa: "两个人 AA", kin: "刷了 " + name + " 的亲属卡", me: "你付的" };
  const paid = b.paid;
  const row = (kind, x, i) => {
    const on = pick[kind] === i, ta = b.taPick[kind] === i;
    return h("button", { key: kind + i, "data-wk": "tripbookopt", "data-on": on ? "1" : "0", onClick: () => !paid && onBookPick && onBookPick({ [kind]: i }), disabled: !!paid && !on,
      className: "w-full text-left active:opacity-80", style: Object.assign({}, card, { display: paid && !on ? "none" : "block", border: "1.5px solid " + (on ? "#43371f" : "#e6dcc4"), minHeight: 44 }) },
      h("div", { className: "flex items-baseline", style: { gap: 8 } },
        h("div", { style: { flex: 1, minWidth: 0, fontFamily: F_DISPLAY, fontSize: "calc(14.5px * var(--app-fs, 1))", color: "#3a3226" } },
          kind !== "hotel" ? [x.no, [x.from, x.to].filter(Boolean).join(" → ")].filter(Boolean).join("  ") : x.name),
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(14.5px * var(--app-fs, 1))", color: "#3a3226", flexShrink: 0 } }, "¥" + x.price + (kind === "hotel" ? "/晚" : "/人"))),
      h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: "#8f8268", marginTop: 3 } },
        kind !== "hotel" ? [x.dep, x.arr].filter(Boolean).join(" → ") : [x.area, x.room].filter(Boolean).join(" · "),
        x.note ? " · " + x.note : "", ta ? h("span", { style: { color: "#93707c", marginLeft: 6 } }, "♥ " + name + " 会挑这个") : null));
  };
  // 订好之后：一张订单票根，跟上面那张登机牌同一套纸和墨（深带 + 竖撕线 + 存根）
  if (paid) {
    const fl = b.flights[pick.flight] || {}, ho = b.hotels[pick.hotel] || {}, bk = backs[pick.back] || null;
    const TIN = "#43371f", TFOG = "#9a8a66", TP = "#f6f0df", TLINE = "rgba(140,115,65,.3)";
    return h("div", { "data-wk": "tripbookpaid", style: { position: "relative", marginTop: 16, borderRadius: 6, overflow: "hidden", background: TP, boxShadow: "0 8px 20px rgba(70,50,15,.16)", transform: "rotate(0.5deg)" } },
      h("div", { className: "flex items-center", style: { background: TIN, padding: "7px 14px", gap: 8 } },
        h("span", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", letterSpacing: ".18em", color: "rgba(246,240,223,.85)" } }, "订单"),
        h("span", { style: { flex: 1 } }),
        h("span", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: "rgba(246,240,223,.85)" } }, byZh[paid.by] || "你付的")),
      h("div", { className: "flex items-stretch" },
        h("div", { style: { flex: 1, minWidth: 0, padding: "12px 14px" } },
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10px * var(--app-fs, 1))", letterSpacing: ".2em", color: TFOG } }, "去程" + (fl.no ? " · " + fl.no : "")),
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(18px * var(--app-fs, 1))", color: TIN, marginTop: 3, wordBreak: "break-word" } }, [fl.from, fl.to].filter(Boolean).join(" → ")),
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: TFOG, marginTop: 2 } }, [fl.dep, fl.arr].filter(Boolean).join(" → ") + " · 两人 · 你" + (seat.me === "aisle" ? "靠过道" : "靠窗")),
          bk ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: TFOG, marginTop: 6 } }, "回程" + (bk.no ? " " + bk.no : "") + " · " + [bk.dep, bk.arr].filter(Boolean).join(" → ")) : null,
          h("div", { style: { borderTop: "1px dashed " + TLINE, margin: "10px 0" } }),
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10px * var(--app-fs, 1))", letterSpacing: ".2em", color: TFOG } }, "住 · " + b.nights + " 晚"),
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(16px * var(--app-fs, 1))", color: TIN, marginTop: 3, wordBreak: "break-word" } }, ho.name || ""),
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: TFOG, marginTop: 2 } }, [ho.area, ho.room].filter(Boolean).join(" · "))),
        h("div", { style: { position: "relative", width: 0, borderLeft: "1px dashed " + TLINE } },
          h("span", { "aria-hidden": "true", style: { position: "absolute", left: -6, top: -6, width: 11, height: 11, borderRadius: 999, background: t.bg } }),
          h("span", { "aria-hidden": "true", style: { position: "absolute", left: -6, bottom: -6, width: 11, height: 11, borderRadius: 999, background: t.bg } })),
        h("div", { style: { width: 72, flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4 } },
          h("span", { style: { fontFamily: F_BODY, fontSize: "calc(9px * var(--app-fs, 1))", letterSpacing: ".2em", color: TFOG } }, "共"),
          h("span", { style: { fontFamily: F_DISPLAY, fontSize: "calc(15px * var(--app-fs, 1))", color: TIN } }, "¥" + paid.total),
          h("span", { "aria-hidden": "true", style: { marginTop: 4, fontFamily: F_DISPLAY, fontSize: "calc(10px * var(--app-fs, 1))", color: TFOG, border: "1.5px solid " + TLINE, borderRadius: 4, padding: "1px 5px", transform: "rotate(-8deg)", letterSpacing: 2 } }, "已付"))));
  }
  return h("div", { "data-wk": "tripbook", style: { marginTop: 16 } },
    h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(16px * var(--app-fs, 1))", color: t.ink, marginBottom: 8 } }, "订机票和酒店"),
    b.taPick.why && !paid ? h("div", { style: { fontFamily: F_DISPLAY, fontStyle: "italic", fontSize: "calc(12.5px * var(--app-fs, 1))", lineHeight: 1.65, color: "#93707c", marginBottom: 8 } }, name + "：「", (typeof TransText === "function" ? h(TransText, { text: b.taPick.why, inline: true }) : b.taPick.why), "」") : null,
    h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog, margin: "4px 0 6px" } }, "去程"),
    b.flights.map((x, i) => row("flight", x, i)),
    backs.length ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog, margin: "8px 0 6px" } }, "回程") : null,
    backs.map((x, i) => row("back", x, i)),
    // 选座：TA 先说想让你坐哪、为什么；你点另一个就换（零调用）
    h("div", { "data-wk": "tripseat", style: { margin: "8px 0 4px" } },
      h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog, marginBottom: 6 } }, "座位 · 你们挨着坐"),
      h("div", { className: "flex", style: { gap: 8 } },
        [["window", "我靠窗"], ["aisle", "我靠过道"]].map(([k, zh]) => h("button", { key: k, "data-on": seat.me === k ? "1" : "0", onClick: () => onBookPick && onBookPick({ seat: k }), className: "flex-1 active:opacity-70",
          style: { minHeight: 40, borderRadius: 10, border: "1.5px solid " + (seat.me === k ? "#43371f" : "#e6dcc4"), background: "#fdfaf1", color: "#3a3226", fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))" } }, zh))),
      // 他说的那句一直留着（她 2026-10-19：「换了位置换回来都不见了」）——原来她点过一次就当成「她自己挑的」，那句话就再也不出了；
      //   那是他说过的话，她换不换座都不该把它抹掉
      seat.why ? h("div", { style: { fontFamily: F_DISPLAY, fontStyle: "italic", fontSize: "calc(12px * var(--app-fs, 1))", color: "#93707c", marginTop: 6 } }, name + "：「", (typeof TransText === "function" ? h(TransText, { text: seat.why, inline: true }) : seat.why), "」") : null),
    h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog, margin: "8px 0 6px" } }, "住哪 · " + b.nights + " 晚"),
    b.hotels.map((x, i) => row("hotel", x, i)),
    h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.ink, margin: "6px 0 8px", textAlign: "right" } }, "两个人" + (backs.length ? "往返" : "") + "的票 + " + b.nights + " 晚 · 共 ¥" + total),
    // 付钱这排压轻一档：底下「出发」才是这一页最重的那一下，两颗大黑键挨着会抢
    h("div", { className: "flex", style: { gap: 8 } },
        h("button", { "data-wk": "tripbook", "data-part": "me", onClick: () => onBookPay && onBookPay("me"), className: "flex-1 active:opacity-70",
          style: { minHeight: 44, borderRadius: 12, border: "1.5px solid #43371f", color: "#43371f", background: "#fdfaf1", fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))" } }, "我来付"),
        h("button", { "data-wk": "tripbook", "data-part": "ta", onClick: () => onBookPay && onBookPay("ta"), className: "flex-1 active:opacity-70",
          style: { minHeight: 44, borderRadius: 12, border: "1px solid " + t.line, color: t.ink, fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))" } }, name + " 请客")),
    h("div", { className: "flex", style: { gap: 8, marginTop: 8 } },
        h("button", { "data-wk": "tripbook", "data-part": "aa", onClick: () => onBookPay && onBookPay("aa"), className: "flex-1 active:opacity-70",
          style: { minHeight: 44, borderRadius: 12, border: "1px solid " + t.line, color: t.ink, fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))" } }, "AA · 一人 ¥" + Math.round(total / 2)),
        hasKin ? h("button", { "data-wk": "tripbook", "data-part": "kin", onClick: () => onBookPay && onBookPay("kin"), className: "flex-1 active:opacity-70",
          style: { minHeight: 44, borderRadius: 12, border: "1px solid " + t.line, color: t.ink, fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))" } }, "刷 " + name + " 的亲属卡") : null,
        h("button", { "data-wk": "tripbook", "data-part": "again", onClick: onBook, disabled: gen, className: "active:opacity-60 disabled:opacity-40",
          style: { minHeight: 44, padding: "0 10px", fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.tint } }, gen ? "查着…" : "换一批")));
}
function CoupleTrip({ partner, trips, gen, onPlan, onBook, onBookPick, onBookPay, onDate, hasKin, onDepart, onDone, onBack }) {
  const t = useTheme();
  const cur = (trips || []).find(x => x && x.status !== "done") || null;
  const done = (trips || []).filter(x => x && x.status === "done");
  const TIN = "#43371f", TFOG = "#9a8a66", TP = "#f6f0df", TLINE = "rgba(140,115,65,.3)";
  const fmtD = ts => { const d = new Date(ts || 0); return d.getFullYear() + "." + (d.getMonth() + 1) + "." + d.getDate(); };
  return h("div", { "data-wk": "uspage", "data-part": "coupletrip", className: "h-full flex flex-col", style: cpSkin(t, "lining") },
    h(Head, { zh: "旅行", sub: partner.remark || partner.name, bg: "transparent", onBack }),
    h("div", { className: "flex-1 min-h-0 overflow-y-auto px-5 pb-10", style: { overscrollBehavior: "contain" } },
      cur ? h(Fragment, null,
        // ── 登机牌：上一条深带（你们俩），主体目的地大字，右侧竖撕线 + 存根 ──
        h("div", { style: { position: "relative", marginTop: 14, borderRadius: 6, overflow: "hidden",
          background: TP, boxShadow: "0 10px 24px rgba(70,50,15,.18)", transform: "rotate(-0.6deg)" } },
          h("div", { className: "flex items-center", style: { background: "#43371f", padding: "8px 14px", gap: 8 } },
            h("span", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: "rgba(246,240,223,.85)" } }, "你"),
            h("span", { style: { flex: 1, borderTop: "1px dashed rgba(246,240,223,.4)", position: "relative" } },
              h("span", { "aria-hidden": "true", style: { position: "absolute", left: "50%", top: -4, width: 7, height: 7, borderRadius: 999, background: "#f6f0df", marginLeft: -3 } })),
            h("span", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: "rgba(246,240,223,.85)" } }, partner.remark || partner.name)),
          h("div", { className: "flex items-stretch" },
            h("div", { style: { flex: 1, minWidth: 0, padding: "14px 14px 13px" } },
              h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10px * var(--app-fs, 1))", letterSpacing: ".2em", color: TFOG } }, "这一趟去"),
              h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(27px * var(--app-fs, 1))", color: TIN, lineHeight: 1.25, marginTop: 4, wordBreak: "break-word" } }, cur.dest || "还没定"),
              h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: TFOG, marginTop: 7 } },
                "起意于 " + fmtD(cur.ts) + (cur.plan && cur.plan.title ? " · 「" + cur.plan.title + "」" : ""))),
            // 撕线 + 存根：真票根的撕线是竖的，两端各咬一个半圆
            h("div", { style: { position: "relative", width: 0, borderLeft: "1px dashed " + TLINE } },
              h("span", { "aria-hidden": "true", style: { position: "absolute", left: -6, top: -6, width: 11, height: 11, borderRadius: 999, background: t.bg } }),
              h("span", { "aria-hidden": "true", style: { position: "absolute", left: -6, bottom: -6, width: 11, height: 11, borderRadius: 999, background: t.bg } })),
            h("div", { style: { width: 56, flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3 } },
              h("span", { style: { fontFamily: F_BODY, fontSize: "calc(9px * var(--app-fs, 1))", letterSpacing: ".2em", color: TFOG } }, "存根"),
              h("span", { style: { fontFamily: F_DISPLAY, fontSize: "calc(13px * var(--app-fs, 1))", color: TIN } }, String(cur.id || "").slice(-4))))),
        // ── 行程册：TA排的，每一段带着说给你听的那句 ──
        cur.plan ? h("div", { style: { marginTop: 16 } },
          h("div", { className: "flex items-baseline justify-between", style: { marginBottom: 8 } },
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(16px * var(--app-fs, 1))", color: t.ink } }, partner.name + " 排的行程"),
            h("button", { onClick: onPlan, disabled: gen, className: "active:opacity-60 disabled:opacity-40", style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.tint, minHeight: 32 } }, gen ? "重排着…" : characterText(partner, "让他重排"))),
          cur.plan.legs.map((l, i) => h("div", { "data-wk": "block", key: i, style: { background: "#fdfaf1", border: "1px solid #e6dcc4", borderRadius: 4, padding: "11px 13px", marginBottom: 9,
            backgroundImage: "repeating-linear-gradient(transparent 0 25px, rgba(190,170,120,.14) 25px 26px)" } },
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10px * var(--app-fs, 1))", letterSpacing: ".12em", color: "#a3987e" } }, l.when || "到时候再说"),
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(15.5px * var(--app-fs, 1))", color: "#3a3226", marginTop: 3 } }, l.where),
            l.note ? h("div", { style: { fontFamily: F_DISPLAY, fontStyle: "italic", fontSize: "calc(12.5px * var(--app-fs, 1))", lineHeight: 1.65, color: "#93707c", marginTop: 5 } }, "「" + l.note + "」") : null)))
          : h("button", { onClick: onPlan, disabled: gen, className: "w-full active:opacity-70 disabled:opacity-40",
            style: { marginTop: 16, background: t.bg2, border: "1px dashed " + t.line, borderRadius: 12, padding: "13px 0", fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", color: t.tint } },
            gen ? partner.name + " 排着行程…" : "让 " + partner.name + " 来排这趟的行程"),
        // ── 订票订房（群友 2026-10-10 许愿「类携程」）：查一次花一次调用，挑和付都不花 ──
        h(TripBooking, { partner, trip: cur, gen, onBook, onBookPick, onBookPay, hasKin }),
        // ── 哪天出发：写进日历，前一晚 TA 来提醒，当天这里写「今天出发」──
        h("div", { "data-wk": "tripdate", className: "flex items-center", style: { gap: 10, marginTop: 14, padding: "10px 12px", borderRadius: 12, background: t.bg2, border: "1px solid " + t.line } },
          h("div", { style: { flex: 1, minWidth: 0 } },
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(14px * var(--app-fs, 1))", color: t.ink } },
              cur.date ? (cur.date === tripTodayKey() ? "今天出发" : "出发日 · " + cur.date.slice(5).replace("-", "月") + "日") : "哪天出发"),
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog, marginTop: 2 } },
              cur.date ? "已记进日历；出发前一晚 " + (partner.remark || partner.name) + " 会来提醒你" : "挑了日子会记进日历，前一晚 " + (partner.remark || partner.name) + " 会来提醒")),
          h("input", { type: "date", value: cur.date || "", onChange: e => onDate && onDate(e.target.value), "aria-label": "出发日",
            style: { minHeight: 40, background: t.bg, color: t.ink, border: "1px solid " + t.line, borderRadius: 10, padding: "0 8px", fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))" } })),
        // ── 两个动作：出发（带着行程开一场线下）· 收行李（零调用归档）──
        h("button", { onClick: onDepart, className: "w-full active:opacity-70",
          style: { marginTop: 14, background: t.ink, color: t.bg2, fontFamily: F_DISPLAY, fontSize: "calc(15px * var(--app-fs, 1))", padding: "13px 0", borderRadius: 14 } }, "出发 · 去线下走这一趟"),
        h("button", { onClick: onDone, className: "w-full active:opacity-60",
          style: { marginTop: 9, fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.fog, padding: "9px 0", minHeight: 40 } }, "回来了 · 收行李"),
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog, lineHeight: 1.7, textAlign: "center", marginTop: 4 } },
          "出发会把这份行程带进一场线下；收行李会把这一趟落进你们的时间轴、愿望自己翻成实现。"))
      : h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.fog, lineHeight: 1.9, textAlign: "center", padding: "30px 14px 6px" } },
          "现在没有走着的旅行。", h("br"), "去愿望板，在一条「一起去」上按出发。"),
      // ── 走过的：一叠存根 ──
      done.length ? h("div", { style: { marginTop: 22 } },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(16px * var(--app-fs, 1))", color: t.ink, marginBottom: 9 } }, "走过的"),
        done.map(x => h("div", { "data-wk": "block", key: x.id, className: "flex items-center", style: { gap: 11, padding: "11px 12px", background: TP, borderRadius: 4, marginBottom: 8, boxShadow: "0 3px 8px rgba(70,50,15,.12)", transform: "rotate(" + ((String(x.id).charCodeAt(4) % 3) - 1) * 0.7 + "deg)" } },
          h("div", { className: "flex-1 min-w-0" },
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(14.5px * var(--app-fs, 1))", color: TIN, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, x.dest + (x.plan && x.plan.title ? " · 「" + x.plan.title + "」" : "")),
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10px * var(--app-fs, 1))", color: TFOG, marginTop: 2 } }, fmtD(x.doneTs) + " 回来"
              + (x.booking && x.booking.paid ? " · " + [(x.booking.flights[x.booking.pick.flight] || {}).no, (x.booking.hotels[x.booking.pick.hotel] || {}).name].filter(Boolean).join(" · ") : ""))),
          h("span", { "aria-hidden": "true", style: { fontFamily: F_DISPLAY, fontSize: "calc(10px * var(--app-fs, 1))", color: TFOG, border: "1.5px solid " + TLINE, borderRadius: 4, padding: "2px 6px", transform: "rotate(-8deg)", letterSpacing: 2 } }, "走完")))) : null));
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

// 情侣空间·我们的唱片（她 2026-09-01）。数据形状 { songs:[{id,neteaseId,title,artist,
// cover,by,note,ts}] }。播放礼数不在这儿——落针/收针全归 app.js 的 discEnter/discLeave,
// 这一页只是唱片本体:A 面是歌,B 面是「为什么是这首」。
function CoupleDiscShelf({ partner, data, nowId, playing, onAdd, onRemove, onNote, onPlay, onPlayTop, nextId, onGen, gen, onBack, onAuto }) {
  const t = useTheme();
  const songs = (data && data.songs) || [];
  const [q, setQ] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editVal, setEditVal] = useState("");
  const spinning = String(nowId || "").indexOf("sgd_") === 0 && playing;
  const nowSong = songs.find(x => x.id === nowId);
  const coverOf = x => x && x.cover ? h("img", { src: x.cover, style: { width: "100%", height: "100%", objectFit: "cover" } }) : null;
  const nextSong = songs.find(x => x.id === nextId) || null;
  // 唱片面上显示的那一首：正在放的 > 下次会接着放的 > 第一首
  const faceSong = nowSong || nextSong || songs[0];
  return h("div", { "data-wk": "uspage", "data-part": "couplediscshelf", className: "h-full flex flex-col", style: cpSkin(t, "velvet") },
    h(Head, { zh: "我们的唱片", sub: partner.remark || partner.name, bg: "transparent", onBack }),
    h("div", { className: "flex-1 min-h-0 overflow-y-auto px-6 pb-10" },
      // ── 唱机台 ──
      h("div", { style: { margin: "14px -24px 0", padding: "26px 24px 22px", background: "linear-gradient(160deg,#241f2c 0%,#171420 70%)", textAlign: "center" } },
        h("div", { style: { position: "relative", width: 208, height: 208, margin: "0 auto" } },
          h("div", { "data-wk": "block", style: { position: "absolute", inset: 0, borderRadius: 999, background: "radial-gradient(circle at 50% 50%, #101014 0 18%, #2b2b30 19% 61%, #17171b 62%)", boxShadow: "0 18px 46px rgba(0,0,0,.45), inset 0 0 0 1px rgba(255,255,255,.04)", display: "flex", alignItems: "center", justifyContent: "center", animation: spinning ? "wk-spin 8s linear infinite" : "none" } },
            h("div", { "data-wk": "block", style: { width: 84, height: 84, borderRadius: 999, overflow: "hidden", background: "#3a3442", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid rgba(255,255,255,.12)" } },
              faceSong && faceSong.cover ? coverOf(faceSong) : h("span", { style: { fontSize: "calc(26px * var(--app-fs, 1))" } }, "♪"))),
          // 唱针:放着时压在盘上,停了抬起来
          h("div", { "data-wk": "block", style: { position: "absolute", right: -6, top: -4, width: 5, height: 92, borderRadius: 4, background: "linear-gradient(#8a8296,#565064)", transformOrigin: "50% 8px", transform: spinning ? "rotate(24deg)" : "rotate(2deg)", transition: "transform .6s ease", boxShadow: "0 4px 10px rgba(0,0,0,.4)" } },
            h("div", { style: { position: "absolute", left: -3, bottom: -8, width: 11, height: 14, borderRadius: 3, background: "#a89bb8" } }))),
        h("div", { style: { marginTop: 16, fontFamily: F_DISPLAY, fontSize: "calc(16px * var(--app-fs, 1))", color: "#ece6f6", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } },
          faceSong ? faceSong.title + (faceSong.artist ? " · " + faceSong.artist : "") : "这张唱片还是空的"),
        h("div", { style: { marginTop: 4, fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: "rgba(210,200,230,.55)", lineHeight: 1.6 } },
          spinning ? "正在转 · 离开空间会自己收针"
            : songs.length ? songs.length + " 首 · " + (data && data.noAuto ? "进空间不自己放，想听点落针" : "进空间接着上次那首往下放" + (nextSong ? "（下一首《" + nextSong.title + "》）" : ""))
            : "刻下第一首，或者让 " + partner.name + " 自己挑几首——进空间它就会响起来"),
        h("div", { className: "flex items-center justify-center flex-wrap", style: { gap: 10, marginTop: 14 } },
          // ⚠️onClick 不许直接挂 onPlay：onPlay 现在收「从哪一首起」，
          //   直接挂等于把事件对象当成歌 id 传下去。
          songs.length ? h("button", { "data-wk": "block", onClick: () => onPlay(), className: "active:opacity-70", style: { minHeight: 40, fontFamily: F_DISPLAY, fontSize: "calc(13.5px * var(--app-fs, 1))", color: "#241f2c", background: "#e6dff2", borderRadius: 999, padding: "9px 26px" } }, spinning ? "从这首重放" : nextSong && nextSong.id !== songs[0].id ? "接着放" : "落针") : null,
          songs.length ? h("button", { onClick: onPlayTop, className: "active:opacity-70", style: { minHeight: 40, fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: "rgba(230,223,242,.6)", padding: "9px 6px" } }, "从头") : null,
          // 让 TA 自己刻：跟「一起听」里的角色歌单同一条链（推歌 → 去云村搜到真曲）
          h("button", { "data-wk": "block", onClick: onGen, disabled: gen, className: "active:opacity-70 disabled:opacity-45", style: { minHeight: 40, fontFamily: F_DISPLAY, fontSize: "calc(13.5px * var(--app-fs, 1))", color: "#e6dff2", background: "transparent", border: "1px solid rgba(230,223,242,.4)", borderRadius: 999, padding: "9px 22px" } },
            gen ? partner.name + " 在挑…" : songs.length ? "让 " + partner.name + " 再刻几首" : "让 " + partner.name + " 刻几首")),
        // 进空间要不要自己响（她 2026-10-26）：每个人那张唱片各管各的
        onAuto ? h("button", { "data-wk": "discauto", "data-on": data && data.noAuto ? "0" : "1", onClick: () => onAuto(!!(data && data.noAuto)), className: "active:opacity-70",
          style: { marginTop: 12, minHeight: 40, display: "inline-flex", alignItems: "center", gap: 8, padding: "0 12px", borderRadius: 999, border: "1px solid rgba(210,200,230,.3)", background: "transparent", color: "rgba(230,223,242,.75)", fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))" } },
          h("span", { style: { width: 30, height: 18, borderRadius: 999, background: data && data.noAuto ? "rgba(210,200,230,.25)" : "#d9c9f0", position: "relative", flexShrink: 0 } },
            h("span", { style: { position: "absolute", top: 2, left: data && data.noAuto ? 2 : 14, width: 14, height: 14, borderRadius: 999, background: "#241f2c", transition: "left .15s" } })),
          "进空间自动放") : null),
      // ── A 面:歌 + B 面:刻字 ──
      songs.length ? h("div", { style: { marginTop: 18 } },
        h(Eyebrow, null, "B 面"),
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog, margin: "4px 0 10px" } }, "点歌名就从那一首落针；背面那一句是「为什么是这首」，点它可以改。"),
        // ⚠️她 2026-09-12：「唱片不能选要听哪首，点击只能编辑刻字」。
        //   discPlay(cid, fromId) 从头到尾都收得下「从哪一首起」，**只是这一页没给出口**：
        //   整行唯一能点的地方是刻字那一格。全 app 的歌行（一起听的 cloudRow、查手机那张单）
        //   都是【封面能点、歌名能点、右边还有一个圆的播放键】——这一行是唯一的例外。
        songs.map(x => h("div", { key: x.id, style: { display: "flex", gap: 11, padding: "11px 0", borderBottom: "1px solid " + t.line, alignItems: "flex-start" } },
          h("button", { onClick: () => onPlay(x.id), className: "active:opacity-70", style: { width: 40, height: 40, borderRadius: 8, overflow: "hidden", background: "#eee6f0", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 } }, x.cover ? coverOf(x) : h("span", null, "♪")),
          h("div", { className: "flex-1 min-w-0" },
            h("button", { onClick: () => onPlay(x.id), className: "block text-left w-full active:opacity-60" },
              h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(14px * var(--app-fs, 1))", color: nowId === x.id ? t.accent : t.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, x.title + (nowId === x.id ? " ♪" : (!spinning && nextId === x.id ? " ·针停在这儿" : ""))),
              h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog, marginTop: 2 } }, (x.artist || "") + (x.by === "ta" ? "　· " + partner.name + " 刻的" : ""))),
            editId === x.id
              ? h("div", { className: "flex items-center gap-2", style: { marginTop: 6 } },
                  h("input", { "data-wk": "input", value: editVal, onChange: e => setEditVal(e.target.value), placeholder: "为什么是这首", className: "flex-1 outline-none px-2 py-1.5 rounded-lg", style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", background: t.bg2, border: "1px solid " + t.line, color: t.ink, minWidth: 0 } }),
                  h("button", { onClick: () => { onNote(x.id, editVal); setEditId(null); }, className: "active:opacity-70", style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.tint, flexShrink: 0 } }, "刻上"))
              : h("button", { onClick: () => { setEditId(x.id); setEditVal(x.note || ""); }, className: "block text-left active:opacity-60 w-full", style: { marginTop: 5 } },
                  h("div", { style: { fontFamily: F_DISPLAY, fontStyle: "italic", fontSize: "calc(12.5px * var(--app-fs, 1))", lineHeight: 1.6, color: x.note ? "#93707c" : t.fog } }, x.note ? "「" + x.note + "」" : "背面还空着,刻一句？"))),
          h("button", { onClick: () => onPlay(x.id), title: "从这首落针", className: "active:opacity-60 flex items-center justify-center", style: { width: 30, height: 30, borderRadius: 999, background: nowId === x.id && spinning ? t.accent : t.ink, flexShrink: 0 } }, ic("play", t.bg2, 14)),
          h("button", { onClick: () => onRemove(x.id), className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.fog, flexShrink: 0, padding: "2px 4px" } }, "✕")))) : null,
      // ── 刻新歌 ──
      h("div", { "data-wk": "block", style: { marginTop: 20, padding: "14px 15px", borderRadius: 14, background: t.bg2, border: "1px solid " + t.line } },
        h(Eyebrow, null, "刻一首进去"),
        h("input", { "data-wk": "input", value: q, onChange: e => setQ(e.target.value), placeholder: "歌名或「歌手 歌名」", className: "w-full outline-none px-3 py-2.5 rounded-xl", style: { marginTop: 9, fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", background: t.bg, border: "1px solid " + t.line, color: t.ink } }),
        h("input", { "data-wk": "input", value: note, onChange: e => setNote(e.target.value), placeholder: "B 面刻字:为什么是这首(可空)", className: "w-full outline-none px-3 py-2.5 rounded-xl", style: { marginTop: 8, fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", background: t.bg, border: "1px solid " + t.line, color: t.ink } }),
        h("button", { disabled: busy || !q.trim(), onClick: async () => { setBusy(true); try { const ok = await onAdd(q.trim(), note); if (ok) { setQ(""); setNote(""); } } finally { setBusy(false); } },
          className: "w-full active:opacity-70 disabled:opacity-40", style: { marginTop: 10, fontFamily: F_DISPLAY, fontSize: "calc(14px * var(--app-fs, 1))", color: t.bg2, background: t.ink, borderRadius: 12, padding: "10px 0" } }, busy ? "去云村找这首…" : "刻进唱片"))))
}

// 情侣空间「最近发生」那一叠通知的尺寸（v61.31，她 2026-09-03：
// 「做小一点，每次只显示三条固定高度，然后可以 scroll 看历史 15 条」）。
// ⚠️高度必须由行高算出来，不许另拍一个像素值：一改行高就得记得同步改那个数，
// 迟早对不上，表现是第三条露出半截（「一层写在两处」那个老形状）。
const NOTIFY_ROW = 50, NOTIFY_GAP = 7, NOTIFY_SHOW = 3, NOTIFY_KEEP = 15;
const NOTIFY_H = NOTIFY_ROW * NOTIFY_SHOW + NOTIFY_GAP * (NOTIFY_SHOW - 1);
// ════ 空间门口（她 2026-10-16「567 也做了」）：门牌 / 东西在谁那儿 / 留灯 ════
//   门牌是一块挂在门上的牌子，被涂改过的那格旧字划掉、新字手写在旁边；东西是一张两栏的条子（在我这儿 | 在 TA 那儿），
//   点一下就挪到另一边；留灯是两盏小灯，亮着就是暖光。
function SpaceDoor({ partner, home, busy, lit, carryNames, tone, eyebrow, put, ta }) {
  const t = useTheme();
  const nm = (partner && (partner.remark || partner.name)) || "TA";
  const pl = home.plaque || {}, things = home.things || [], L = home.light || {};
  const [edit, setEdit] = useState(null);       // 正在改门牌哪一格
  const [val, setVal] = useState("");
  const [adding, setAdding] = useState(null);   // { name, owner, at, note }
  const [lightNote, setLightNote] = useState("");
  const PZ = [["title", "称号", "你们这一对叫什么"], ["boss", "谁说了算", "比如：吃什么她说了算"], ["guard", "护短", "谁护着谁、护到什么份上"]];
  const EDIT = [["both", "都能改"], ["me", "只有我"], ["ta", "只有 " + nm]];
  const lastMark = k => (pl.marks || []).find(m => m.field === k && m.from);
  const savePl = (k, v) => put(h0 => ({ ...h0, plaque: { ...(h0.plaque || {}), [k]: v, marks: k === "edit" ? (h0.plaque || {}).marks : [{ by: "me", field: k, from: (h0.plaque || {})[k] || "", to: v, ts: Date.now() }, ...(((h0.plaque || {}).marks) || [])].slice(0, 20) } }));
  const meCanEdit = pl.edit !== "ta", taCanEdit = pl.edit !== "me";
  const lastSay = (pl.marks || []).find(m => m.by === "ta" && m.say);
  // ── 门牌 ──
  const plaque = h("div", { "data-wk": "usplaque", style: { position: "relative", marginTop: 14, padding: "18px 16px 14px", borderRadius: 10, background: "#fffdf8", border: "1px solid " + tone, boxShadow: "inset 0 0 0 4px #fffdf8, inset 0 0 0 5px " + tone + "55, 0 4px 12px rgba(60,40,30,.08)" } },
    h("span", { "aria-hidden": "true", style: { position: "absolute", left: "50%", top: -9, marginLeft: -5, width: 10, height: 10, borderRadius: 999, background: tone, boxShadow: "0 1px 2px rgba(0,0,0,.25)" } }),
    PZ.map(([k, zh, ph]) => { const m = lastMark(k);
      return h("div", { key: k, className: "flex", style: { alignItems: "baseline", gap: 10, padding: "7px 0", borderBottom: "1px dashed " + t.line } },
        h("div", { style: { width: 58, flexShrink: 0, fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: tone, letterSpacing: ".1em" } }, zh),
        edit === k ? h("div", { className: "flex-1 flex", style: { gap: 6 } },
            h("input", { "data-wk": "input", autoFocus: true, value: val, onChange: e => setVal(e.target.value), placeholder: ph, style: { flex: 1, minWidth: 0, border: 0, borderBottom: "1px solid " + tone, background: "transparent", color: t.ink, fontFamily: F_HAND, fontSize: "calc(17px * var(--app-fs, 1))", outline: "none", padding: "2px 0" } }),
            h("button", { onClick: () => { savePl(k, val.trim()); setEdit(null); }, style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: tone, background: "transparent" } }, "写上"))
          : h("button", { onClick: () => { if (!meCanEdit) return; setEdit(k); setVal(pl[k] || ""); }, className: "flex-1 text-left", style: { background: "transparent", minWidth: 0 } },
              m && m.from && m.from !== pl[k] ? h("span", { style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.fog, textDecoration: "line-through", textDecorationColor: "#b23a2e", marginRight: 6 } }, m.from) : null,
              pl[k] ? h("span", { style: { fontFamily: m && m.by === "ta" ? F_HAND : F_DISPLAY, fontSize: m && m.by === "ta" ? 18 : 15, color: m && m.by === "ta" ? tone : t.ink } }, pl[k])
                : h("span", { style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.fog } }, meCanEdit ? "空着 · 点一下写" : "空着")));
    }),
    h("div", { className: "flex items-center", style: { gap: 6, marginTop: 10, flexWrap: "wrap" } },
      h("span", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog, marginRight: 2 } }, "门牌谁能改"),
      EDIT.map(([k, zh]) => { const on = (pl.edit || "both") === k;
        return h("button", { key: k, onClick: () => savePl("edit", k), style: { padding: "2px 9px", borderRadius: 999, fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", border: "1px solid " + (on ? tone : t.line), background: on ? tone : "transparent", color: on ? "#fff" : t.sub } }, zh); })),
    lastSay ? h("div", { style: { marginTop: 8, fontFamily: F_HAND, fontSize: "calc(16px * var(--app-fs, 1))", color: tone } }, nm + "：" + lastSay.say) : null,
    taCanEdit ? h("button", { "data-wk": "usplaqueta", onClick: () => ta("plaque"), disabled: !!busy, className: "w-full active:opacity-70", style: { marginTop: 10, padding: "8px 0", borderRadius: 999, border: "1px dashed " + tone, background: "transparent", color: tone, fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))" } },
      busy === "plaque" ? nm + " 拿着笔在看…" : "把笔递给 " + nm) : null);
  // ── 东西在谁那儿 ──
  const move = x => put(h0 => ({ ...h0, things: (h0.things || []).map(y => y.id === x.id ? { ...y, at: y.at === "me" ? "ta" : "me", ts: Date.now() } : y) }));
  const drop = x => requestAppConfirm("这样东西不记了？", "「" + x.name + "」从条子上划掉。", () => put(h0 => ({ ...h0, things: (h0.things || []).filter(y => y.id !== x.id) })), "划掉");
  const col = side => h("div", { className: "flex-1 min-w-0", style: { padding: "4px 10px 10px" } },
    h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: tone, letterSpacing: ".15em", padding: "6px 0", borderBottom: "1px solid " + t.line, marginBottom: 4 } }, side === "me" ? "在我这儿" : "在 " + nm + " 那儿"),
    things.filter(x => x.at === side).map(x => h("div", { key: x.id, "data-wk": "usthing", "data-at": side, className: "flex items-center", style: { gap: 4, padding: "5px 0" } },
      h("button", { onClick: () => move(x), className: "flex-1 text-left min-w-0", style: { background: "transparent" } },
        h("div", { style: { fontFamily: F_HAND, fontSize: "calc(17px * var(--app-fs, 1))", color: t.ink, lineHeight: 1.3 } }, (x.owner === "me" ? "我的" : nm + "的") + x.name),
        x.note ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog } }, x.note) : null),
      h("button", { onClick: () => move(x), "aria-label": "挪到另一边", style: { fontSize: "calc(14px * var(--app-fs, 1))", color: tone, background: "transparent", padding: "0 2px" } }, side === "me" ? "→" : "←"),
      h("button", { onClick: () => drop(x), "aria-label": "划掉", style: { fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog, background: "transparent", padding: "0 2px" } }, "✕"))),
    !things.some(x => x.at === side) ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.fog, padding: "6px 0" } }, "—") : null);
  const addRow = adding ? h("div", { style: { padding: "10px 12px", borderTop: "1px dashed " + t.line } },
      carryNames.length && adding.owner === "ta" ? h("div", { className: "flex flex-wrap", style: { gap: 5, marginBottom: 8 } }, carryNames.map(n => h("button", { key: n, onClick: () => setAdding(a => ({ ...a, name: n })), style: { padding: "2px 9px", borderRadius: 999, fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", border: "1px solid " + (adding.name === n ? tone : t.line), background: adding.name === n ? tone : "transparent", color: adding.name === n ? "#fff" : t.sub } }, n))) : null,
      h("div", { className: "flex", style: { gap: 6, marginBottom: 8 } },
        [["ta", nm + " 的"], ["me", "我的"]].map(([k, zh]) => h("button", { key: k, onClick: () => setAdding(a => ({ ...a, owner: k, at: k === "ta" ? "me" : "ta" })), style: { padding: "3px 10px", borderRadius: 999, fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", border: "1px solid " + (adding.owner === k ? tone : t.line), background: adding.owner === k ? tone : "transparent", color: adding.owner === k ? "#fff" : t.sub } }, zh))),
      h("input", { "data-wk": "input", value: adding.name, onChange: e => setAdding(a => ({ ...a, name: e.target.value })), placeholder: "什么东西", style: { width: "100%", boxSizing: "border-box", border: "1px solid " + t.line, borderRadius: 10, padding: "8px 10px", background: t.bg, color: t.ink, fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", outline: "none" } }),
      h("input", { "data-wk": "input", value: adding.note, onChange: e => setAdding(a => ({ ...a, note: e.target.value })), placeholder: "一句来历（可空）", style: { width: "100%", boxSizing: "border-box", marginTop: 6, border: "1px solid " + t.line, borderRadius: 10, padding: "8px 10px", background: t.bg, color: t.ink, fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", outline: "none" } }),
      h("div", { className: "flex", style: { gap: 8, marginTop: 8 } },
        h("button", { onClick: () => setAdding(null), style: { padding: "7px 14px", borderRadius: 999, border: "1px solid " + t.line, background: "transparent", color: t.sub, fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))" } }, "算了"),
        h("button", { disabled: !adding.name.trim(), onClick: () => { const a = adding; put(h0 => ({ ...h0, things: [{ id: "th_" + Date.now(), name: a.name.trim().slice(0, 30), owner: a.owner, at: a.at, note: a.note.trim().slice(0, 60), ts: Date.now() }, ...(h0.things || [])].slice(0, 40) })); setAdding(null); },
          className: "flex-1", style: { padding: "7px 0", borderRadius: 999, border: 0, background: adding.name.trim() ? tone : t.line, color: "#fff", fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))" } }, "记上")))
    : h("button", { onClick: () => setAdding({ name: "", owner: "ta", at: "me", note: "" }), className: "w-full active:opacity-70", style: { padding: "9px 0", borderTop: "1px dashed " + t.line, background: "transparent", color: tone, fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))" } }, "+ 记一样");
  const ledger = h("div", { "data-wk": "block", style: { marginTop: 4, borderRadius: 10, background: "#fffdf8", border: "1px solid " + t.line, overflow: "hidden" } },
    h("div", { className: "flex", style: { alignItems: "stretch" } }, col("me"), h("div", { style: { width: 1, background: t.line } }), col("ta")), addRow);
  // ── 留灯 ──
  const lamp = (on, who, sub, act) => h("div", { "data-wk": "uslight", "data-who": who, "data-on": on ? "1" : "0", className: "flex-1", style: { position: "relative", padding: "14px 12px 12px", borderRadius: 12, textAlign: "center", overflow: "hidden",
      background: on ? "radial-gradient(90% 70% at 50% 18%, rgba(255,214,140,.55), rgba(255,240,210,.25) 55%, #fffdf8 100%)" : "#fffdf8", border: "1px solid " + (on ? "#e9c98e" : t.line), transition: "background .4s" } },
    h("div", { "aria-hidden": "true", style: { width: 26, height: 26, margin: "0 auto", borderRadius: 999, background: on ? "radial-gradient(circle at 50% 40%, #fff6dc, #ffc46b 70%)" : "#e4ded4", boxShadow: on ? "0 0 18px 6px rgba(255,196,107,.55)" : "none" } }),
    h("div", { "aria-hidden": "true", style: { width: 2, height: 10, margin: "0 auto", background: on ? "#d8b072" : "#d8d0c4" } }),
    h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(13.5px * var(--app-fs, 1))", color: t.ink, marginTop: 4 } }, who === "me" ? "我给 " + nm + " 留的" : nm + " 给我留的"),
    h("div", { style: { fontFamily: who === "ta" && on ? F_HAND : F_BODY, fontSize: who === "ta" && on ? 15 : 11.5, color: t.sub, marginTop: 3, minHeight: 16, lineHeight: 1.4 } }, sub),
    act);
  const meOn = lit(L.me), taOn = lit(L.ta), taAsked = L.ta && lit({ on: true, ts: L.ta.ts });
  const lights = h("div", { className: "flex", style: { gap: 10, marginTop: 4 } },
    lamp(meOn, "me", meOn ? (L.me.note || "亮着，到早上六点") : "没开",
      meOn ? h("button", { onClick: () => put(h0 => ({ ...h0, light: { ...(h0.light || {}), me: { ...((h0.light || {}).me || {}), on: false } } })), style: { marginTop: 8, fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.fog, background: "transparent" } }, "关掉")
        : h("div", { style: { marginTop: 8 } },
            h("input", { "data-wk": "input", value: lightNote, onChange: e => setLightNote(e.target.value), placeholder: "留一句（可空）", style: { width: "100%", boxSizing: "border-box", border: 0, borderBottom: "1px solid " + t.line, background: "transparent", color: t.ink, fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", outline: "none", textAlign: "center", padding: "3px 0" } }),
            h("button", { onClick: () => { put(h0 => ({ ...h0, light: { ...(h0.light || {}), me: { on: true, note: lightNote.trim().slice(0, 60), ts: Date.now() } } })); setLightNote(""); }, style: { marginTop: 6, fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: "#b07a2a", background: "transparent" } }, "留灯"))),
    lamp(taOn, "ta", taAsked ? (L.ta.say || "") : "还没问",
      h("button", { onClick: () => ta("light"), disabled: !!busy, style: { marginTop: 8, fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: "#b07a2a", background: "transparent" } }, busy === "light" ? "在等 " + nm + " 回…" : taAsked ? "再问一次" : "问 " + nm + " 留不留")));
  return h(React.Fragment, null,
    eyebrow("门牌", "两个人都能涂改"), plaque,
    eyebrow("东西在谁那儿", "点一下挪到另一边"), ledger,
    eyebrow("留灯", "今晚的，早上六点熄"), lights);
}

function Us({ characters, couples, onBack, myWallet, onJarMove, onJarGoal, onInvite, onSetRel, spaceBooks, spaceBookBusy, onBookAdd, onBookReply, onBookRemove, onBookTa, spaceHome, spaceHomeBusy, lightLit, carryNamesOf, onSpaceHome, onSpaceHomeTa, onUnlink, onSetSince, profile, profileFor, coupleProfile, coupleHome, onSaveCoupleHome, onSetCoupleImg, coupleQA, onAnswerQA, onEditQA, onRemoveQA, onRerollQA, onReplyQA, onEditQAReply, qaGen, coupleQATitle, onSaveQATitle, coupleQACustom, coupleQABooks, onSaveQABook, onSaveQACustom, coupleQACustomBooks, onSaveQACustomBooks, moodOf, coupleTimeline, onAddTimeline, onRemoveTimeline, onReadTimeline, onGenTimeline, tlGen, coupleAnniv, onAddAnniv, onRemoveAnniv, coupleLetters, coupleLetterCfg, onGenLetter, onAddMyLetter, onReplyLetter, onReadLetter, onRemoveLetter, onSaveLetterCfg, letterGen, coupleSweet, onCheckinSweet, coupleDrawer, onOpenDrawer, onDropDrawer, onEditDrawer, onForwardDrawer, coupleFirstsOf, myCloset, charClosetOf, studioShots, studioBusy, fitBusy, studioCanShoot, onGenDateFit, onStudioShoot, onRollStyles, onRollThemes, onShareShot, ifLines, ifBusy, ifBgBusy, onIfOpen, onIfAdvance, onIfBg, onIfShot, onIfBgPick, onIfEnd, onIfDrop, makeupOf, makeupSignalFor, makeupBusy, onMakeupOpen, onMakeupSay, onMakeupClose, gachaPts, gachaCards, gachaLuck, gachaBusy, onGachaPull, onGachaRedeem, onGachaShow, onGachaPin, onGachaDelete, onGachaTitle, onGachaShoot, onGachaCarve, land, onLanded, coupleExDiary, onAddExDiary, onReadExDiary, duoPhotosFor, onDeletePhoto, onUploadPhoto, couplePactsOf, onClosePact, onSetPactDue, onAddPact, onSealQA, onRevealQA, onPlanWish, wishPlanOf, coupleGarden, onGardenPlant, onGardenKeep, gardenGen, coupleTrips, onTripStart, onTripPlan, onTripBook, onTripBookPick, onTripBookPay, onTripDate, kinCardFrom, onTripDepart, onTripDone, tripGen, coupleRecall, onGenRecall, onReadRecall, onDelRecall, recallGen, onGenWish, charWishGen, outletLedger, outletKinds, capsuleProps, coupleDisc, onDiscAdd, onDiscRemove, onDiscNote, onDiscAuto, onDiscPlay, onDiscEnter, onDiscLeave, onDiscGen, discGen, discNextIdOf, discNowId, discPlaying, onPartnerView }) {
  const t = useTheme();
  const [view, setView] = useState(null); // null=名册 / charId=某段情侣详情
  const [sub, setSub] = useState(null); // 情侣空间子模块：null / 'qa'（后续加 timeline/mood/notes/letters）
  // 从别处直接落到某个人的某一扇门（她 2026-09-14：「叫他刻歌然后从聊天点进去是
  // 全部已有情侣空间汇总那一页，而不是他自己的情侣空间」）。
  // 病根：聊天那张唱片卡只做了 setScreen("us")——**没说是谁**，于是落在名册页上。
  // ⚠️落点只消费一次：消费完就还回去（onLanded），不然她手动退回名册，
  //   一渲染又被送回去，等于退不出来。
  React.useEffect(() => {
    if (!land || !land.view) return;
    // ⚠️已经分手／还没在一起的，那几扇门本来就不成立（下面每一处都要 status==="together"）。
    //   硬送进去会落在一张空详情上——那时候老老实实停在名册页，别把她扔进一个空房间。
    const ok = ((couples || {})[land.view] || {}).status === "together";
    // ⚠️开子页一律走 openSub，落点这一路也不例外（couple-space-62-26 那条规矩当场把我
    //   直接 setSub 的那一版揪出来了）：主页还没挂着时 bodyRef 是 null，openSub 自己
    //   会保留上一次记着的位置而不是清成 0，所以从外面落进来也照走它。
    if (ok) { setView(land.view); if (land.sub) openSub(land.sub); else setSub(null); }
    if (onLanded) onLanded();
  }, [land]);
  // ── 进子页记位置、回来放回去（mobile-ui-layout.md §3；她 2026-09-04：
  //    「情侣空间从任何页面出来都会跳回最上面」）──────────────────────────────
  // 病：每个子页都是 `return h(XxxPage…)` 的早退，详情页整个卸载，滚动位置跟着没了。
  // 所以【所有开子页的地方一律走 openSub】，别再直接 openSub("…")——
  // 漏一处就是那一扇门回来会跳顶，而且看不出来（一层写在两处那个老形状）。
  const bodyRef = useRef(null);
  const subScrollRef = useRef(0);
  // ⚠️子页切子页（愿望板→旅行）时主页没挂着、bodyRef 是 null——这时要【保留】记着的
  // 位置，不能清成 0，不然从旅行一路退回主页就跳顶。所以只有真拿得到滚动位置才记。
  const openSub = k => { if (bodyRef.current) subScrollRef.current = bodyRef.current.scrollTop; setSub(k); };
  React.useLayoutEffect(() => {
    if (sub === null && bodyRef.current && subScrollRef.current > 0) bodyRef.current.scrollTop = subScrollRef.current;
  }, [sub]);
  const [pick, setPick] = useState(false);
  const [pickWho, setPickWho] = useState(null);   // 选好了人，正在挑这个空间是什么关系
  const [annOpen, setAnnOpen] = useState(false);
  const [annName, setAnnName] = useState("");
  const [annMo, setAnnMo] = useState("");
  const [annDay, setAnnDay] = useState("");
  const [sinceEdit, setSinceEdit] = useState(false);
  const [sinceVal, setSinceVal] = useState("");
  const [cpEdit, setCpEdit] = useState(false);
  const [usFrost, setUsFrost] = useState(() => typeof loadJSON === "function" ? loadJSON("x_usFrost", false) === true : false);
  // 底纸有多实：0.2–1，默认 0.88（原来写死的那个数）。跟磨砂开关各管各的。
  const [usPaperA, setUsPaperA] = useState(() => { const v = typeof loadJSON === "function" ? Number(loadJSON("x_usPaperA", 0.88)) : 0.88; return v >= 0.2 && v <= 1 ? v : 0.88; });
  const bgRef = useRef(null); const myAvRef = useRef(null); const chAvRef = useRef(null);
  const [unlinkChar, setUnlinkChar] = useState(null); // 待确认解除的角色
  // 情侣唱片:进空间自动落针、离开自动收针——礼数全在 app.js 的 discEnter/discLeave
  // 里(进来就落针/走时只带走自己),这里只负责喊人。依赖只挂 view:切到别的子模块不重触。
  useEffect(() => {
    const cid = view && (couples || {})[view] && (couples || {})[view].status === "together" ? view : null;
    if (cid && onDiscEnter) onDiscEnter(cid);
    return () => { if (cid && onDiscLeave) onDiscLeave(); };
  }, [view]);
  const cp = couples || {};
  // 每段情侣「有没有你没看的东西」——名册那行的红点和「新的XX」就看这张单子。
  // ⚠️抽屉刻意不在这里：它那页自己写着「这儿不会提醒你——想起来了就来看看」，是设计。
  //（原来这儿还有个 noteSeen——便签墙 v59.23 撤掉后没人再读它，v62.08 清掉。）
  const unreadLettersFor = cid => (coupleLetters || []).some(l => l.characterId === cid && !l.isRead);
  const unreadExDiaryFor = cid => (coupleExDiary || []).some(e => e.characterId === cid && e.author !== "user" && e.unread);
  const pactDueSoonFor = cid => { const p2 = couplePactsOf ? couplePactsOf(cid) : null; return !!(p2 && (p2.due || []).some(x => x.dueTs && Date.now() >= x.dueTs - 86400000)); };
  const unreadTagsFor = cid => {
    const a = [];
    if (unreadLettersFor(cid)) a.push(window.spaceRel ? window.spaceRel(cp[cid]).letter : "情书");
    if (unreadExDiaryFor(cid)) a.push("交换日记");
    if ((coupleQA || []).some(e => e.characterId === cid && e.sealed && e.byCharacter && !e.myAnswer)) a.push("问答小本");
    if ((coupleRecall || []).some(x => x.characterId === cid && x.unread)) a.push(characterText(characters.find(c => c.id === cid), "他记得的"));
    if ((coupleTimeline || []).some(x => x.characterId === cid && x.byCharacter && x.unread)) a.push("时光轴");
    if (pactDueSoonFor(cid)) a.push("说好的");
    try { if (typeof window !== "undefined" && window.capsuleDueCount && window.capsuleDueCount(cid, (characters.find(c => c.id === cid) || {}).name) > 0) a.push("时光胶囊"); } catch (e) {}
    return a;
  };
  const entries = Object.keys(cp)
    .map(id => ({ char: characters.find(c => c.id === id), st: cp[id] }))
    .filter(e => e.char)
    .sort((a, b) => (b.st.status === "together" ? 1 : 0) - (a.st.status === "together" ? 1 : 0));
  const invitable = characters.filter(c => !cp[c.id]);
  const daysWith = since => since ? Math.max(1, Math.floor((Date.now() - since) / 86400000) + 1) : 1;

  // 挑关系（她 2026-10-16）：恋人 / 闺蜜 / 挚友 / 家人，一行说清开了以后 TA 会怎么当
  const REL_NOTE = { lover: "TA 接了就当你们在一起了，信是情书。", bestie: "最铁的那种朋友，什么都能说，不往恋爱那头走。", friend: "一辈子的朋友，信写的是交情。", family: "家里人那一层，TA 是你的谁、怎么相处照人设。" };
  // 家人再细分（她 2026-10-16）：点「家人」先展开一排「TA 是你的谁」，挑了才算数；不细分也行
  const FAM_ROLES = ["哥哥", "姐姐", "弟弟", "妹妹", "爸妈", "长辈", "孩子"];
  const famPick = (nowRole, onPick) => h("div", { "data-wk": "usfamrole", style: { margin: "2px 0 4px 4px" } },
    h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.fog, marginBottom: 6 } }, "TA 是你的谁"),
    h("div", { className: "flex flex-wrap", style: { gap: 6 } },
      FAM_ROLES.concat([""]).map(r => h("button", { key: r || "_none", "data-on": (nowRole || "") === r ? "1" : "0", onClick: () => onPick("family", r), className: "active:opacity-70",
        style: { padding: "4px 11px", borderRadius: 999, fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", border: "1px solid " + ((nowRole || "") === r ? t.ink : t.line), background: (nowRole || "") === r ? t.ink : "transparent", color: (nowRole || "") === r ? t.bg2 : t.sub } }, r || "不细分")),
      h("input", { "data-wk": "input", placeholder: "自己写…", defaultValue: FAM_ROLES.indexOf(nowRole || "") < 0 ? (nowRole || "") : "", onKeyDown: e => { if (e.key === "Enter" && e.target.value.trim()) onPick("family", e.target.value.trim()); }, onBlur: e => { const v = e.target.value.trim(); if (v && v !== nowRole) onPick("family", v); },
        style: { width: 86, padding: "4px 10px", borderRadius: 999, border: "1px dashed " + t.line, background: "transparent", color: t.ink, fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", outline: "none" } })));
  const [famOpen, setFamOpen] = useState(false);
  // 挑关系是四枚火漆（她 2026-10-16「每个 ui 都弄好看点」）：一层关系一个封口、一个颜色，跟 TA 寄来的申请信封口是同一枚
  const relSeal = (r, size) => h("span", { "aria-hidden": "true", style: { flexShrink: 0, width: size, height: size, borderRadius: 999, display: "inline-flex", alignItems: "center", justifyContent: "center",
    background: "radial-gradient(circle at 35% 30%, rgba(255,255,255,.35), transparent 45%), " + r.tone, boxShadow: "0 1px 0 rgba(255,255,255,.25) inset, 0 2px 5px rgba(0,0,0,.18)",
    color: "rgba(255,255,255,.95)", fontFamily: "'Noto Serif SC','Songti SC',serif", fontSize: Math.round(size * .42) } }, r === window.SPACE_RELS.lover ? h(IHeart, { size: Math.round(size * .42), color: "#fff", filled: true }) : r.seal);
  const relRows = (now, onPick, nowRole) => { const R = window.SPACE_RELS;
    return h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 } }, Object.keys(R).map(k => { const r = R[k], on = now === k;
      return h(React.Fragment, { key: k },
        h("button", { "data-wk": "usrel", "data-on": on ? "1" : "0", "data-kind": k, onClick: () => k === "family" ? setFamOpen(true) : (setFamOpen(false), onPick(k)), className: "text-left active:scale-[.98]",
          style: { position: "relative", padding: "12px 12px 11px", borderRadius: 14, border: "1.5px solid " + (on ? r.tone : t.line), background: on ? "color-mix(in srgb, " + r.tone + " 9%, " + t.bg2 + ")" : t.bg2, transition: "all .15s", display: "flex", flexDirection: "column", gap: 8 } },
          h("div", { className: "flex items-center", style: { gap: 9 } }, relSeal(r, 30),
            h("div", null, h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(15px * var(--app-fs, 1))", color: on ? r.tone : t.ink } }, r.zh), h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog } }, r.space))),
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.sub, lineHeight: 1.5 } }, REL_NOTE[k] || "")),
        k === "family" && (famOpen || now === "family") ? h("div", { style: { gridColumn: "1 / -1" } }, famPick(now === "family" ? nowRole : null, onPick)) : null);
    }));
  };
  const pickSheet = pickWho ? h(Sheet, { onClose: () => setPickWho(null) },
    h(Eyebrow, { style: { marginBottom: 12 } }, "跟 " + pickWho.name + " 开一个什么样的空间"),
    relRows("", (k, role) => { const c = pickWho; setPickWho(null); setFamOpen(false); onInvite(c, k, role); })) : pick && h(Sheet, { onClose: () => setPick(false) },
    h(Eyebrow, { style: { marginBottom: 12 } }, "邀请谁"),
    invitable.length === 0
      ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.fog, paddingBottom: 8 } }, "没有可邀请的对象了。")
      : h("div", { className: "space-y-1 max-h-72 overflow-y-auto" },
          invitable.map(c => h("button", { key: c.id, onClick: () => { setPick(false); setPickWho(c); }, className: "w-full flex items-center gap-3 py-2.5 active:opacity-60" },
            h(Avatar, { character: c, size: 34, radius: 8 }),
            h("span", { style: { fontFamily: F_DISPLAY, fontSize: "calc(16px * var(--app-fs, 1))", color: t.ink } }, c.name)))));

  // —— 单段情侣详情（仅 together 可进）——
  const partner = view ? characters.find(c => c.id === view) : null;
  // 空间里是哪个人：告诉外面一声，外面那层 TransWho 就按他开没开「自带中译」决定「译」要不要直接展开
  useEffect(() => { if (onPartnerView) onPartnerView(partner ? partner.id : null); }, [partner && partner.id]);
  // 情侣空间子模块：问答小本
  if (partner && cp[view] && cp[view].status === "together" && sub === "qa") {
    return h(CoupleQABook, { partner, bank: window.spaceLover && cp[partner.id] && !window.spaceLover(cp[partner.id]) ? COUPLE_QA_BANK.filter(x => !x.love) : COUPLE_QA_BANK, customQ: (coupleQACustom || {})[partner.id] || [], entries: coupleQA, title: (coupleQATitle || {})[partner.id], books: (coupleQABooks || {})[partner.id] || {}, customBooks: (coupleQACustomBooks || {})[partner.id] || [], onSaveBook: onSaveQABook, onSaveCustom: onSaveQACustom, onSaveCustomBooks: onSaveQACustomBooks, onAnswer: onAnswerQA, onSeal: onSealQA, onReveal: (id, text) => onRevealQA(partner.id, id, text), onEdit: onEditQA, onRemove: onRemoveQA, onReroll: onRerollQA, onReply: onReplyQA ? (eid, txt) => onReplyQA(partner, eid, txt) : null, onEditReply: onEditQAReply, onSaveTitle: onSaveQATitle, gen: qaGen, onBack: () => setSub(null) });
  }
  // 情侣空间子模块：双向便签
  // 情侣空间子模块：我们的日子（时间轴 + 纪念日 二合一）
  if (partner && cp[view] && cp[view].status === "together" && (sub === "timeline" || sub === "anniv")) {
    return h(CoupleDays, { partner, since: cp[view].since, events: coupleTimeline, annivs: coupleAnniv, onAdd: onAddTimeline, onRemove: onRemoveTimeline, onRead: onReadTimeline, onGen: onGenTimeline, onAddAnniv: onAddAnniv, onRemoveAnniv: onRemoveAnniv, gen: tlGen, onBack: () => setSub(null) });
  }
  // 情侣空间子模块：和好间
  if (partner && cp[view] && cp[view].status === "together" && sub === "makeup") {
    return h(MakeupRoom, {
      partner, data: makeupOf ? makeupOf(partner.id) : null,
      signal: makeupSignalFor ? makeupSignalFor(partner.id) : { on: false, why: "" },
      busy: makeupBusy === partner.id,
      onOpen: () => onMakeupOpen(partner), onSay: line => onMakeupSay(partner, line),
      onClose: how => onMakeupClose(partner.id, how), onBack: () => setSub(null)
    });
  }
  // 情侣空间子模块：如果馆
  if (partner && cp[view] && cp[view].status === "together" && sub === "ifroom") {
    // 小剧场 if 线也戴这个人认识的那张面具（她 2026-10-03 问「情侣空间的面具名字也是对的吧」
    //   顺着查出来的：封面那儿认了面具，这两处还认着主面具的名字）
    return h(IfRoom, { partner, lines: ifLines, uName: ((typeof profileFor === "function" && profileFor(partner.id)) || profile || {}).name || "我", busy: ifBusy, bgBusy: ifBgBusy,
      onOpen: hint => onIfOpen(partner, hint), onAdvance: onIfAdvance, onBg: onIfBg, onEnd: onIfEnd, onDrop: onIfDrop,
      shotBusy: studioBusy, onShot: onIfShot,
      // 背景也能从已经有的合照里挑一张（她 2026-09-18）。名单跟合照墙是同一份，
      // 不在这儿另攒一个列表——duoPhotosFor 已经把聊天/线下/照相馆/情侣空间四处合流了。
      photos: duoPhotosFor ? duoPhotosFor(partner.id) : [], onBgPick: onIfBgPick,
      onBack: () => setSub(null) });
  }
  // 情侣空间子模块：照相馆
  if (partner && cp[view] && cp[view].status === "together" && sub === "studio") {
    return h(PhotoStudio, { partner, myCloset: myCloset, charCloset: charClosetOf ? charClosetOf(partner.id) : null,
      shots: studioShots, busy: studioBusy, fitBusy: fitBusy, canShoot: !!(studioCanShoot && studioCanShoot(partner)),
      onGenFit: hint => onGenDateFit(partner, hint), onShoot: o => onStudioShoot(partner, o), onRollStyles: onRollStyles, onRollThemes: onRollThemes,
      onShare: shot => onShareShot(partner, shot), onBack: () => setSub(null),
      onDelete: onDeletePhoto ? shot => onDeletePhoto(partner.id, { ...shot, src: "studio" }) : null });
  }
  // 情侣空间子模块：里程碑册
  if (partner && cp[view] && cp[view].status === "together" && sub === "firsts") {
    return h(CoupleFirstsBook, { partner, items: coupleFirstsOf ? coupleFirstsOf(partner.id) : [], onBack: () => setSub(null) });
  }
  // 情侣空间子模块：惊喜抽屉
  if (partner && cp[view] && cp[view].status === "together" && sub === "drawer") {
    return h(CoupleDrawer, { partner, items: coupleDrawer, onOpen: onOpenDrawer, onDrop: onDropDrawer, onEdit: onEditDrawer, onForward: onForwardDrawer ? x => onForwardDrawer(partner.id, x) : null,
      ledger: (outletLedger || {})[partner.id] || {}, kinds: outletKinds || [], onBack: () => setSub(null) });
  }
  // 情侣空间子模块：我们的唱片
  if (partner && cp[view] && cp[view].status === "together" && sub === "disc") {
    return h(CoupleDiscShelf, { partner, data: (coupleDisc || {})[partner.id] || {}, nowId: discNowId, playing: discPlaying,
      onAdd: (q, note) => onDiscAdd(partner.id, q, note), onRemove: id => onDiscRemove(partner.id, id),
      onNote: (id, note) => onDiscNote(partner.id, id, note),
      // 落针＝从针位那首接着放（进空间也走这一条）；「从头」才是回第一首
      // id 是「从这一首起」（B 面那一行点的）；不给就照旧接着上次那首往下放
      onPlay: id => onDiscPlay(partner.id, id || (discNextIdOf && discNextIdOf(partner.id))),
      onPlayTop: () => onDiscPlay(partner.id),
      nextId: discNextIdOf && discNextIdOf(partner.id),
      onGen: () => onDiscGen && onDiscGen(partner), gen: discGen === partner.id, onBack: () => setSub(null),
      onAuto: onDiscAuto ? on => onDiscAuto(partner.id, on) : null });
  }
  // 情侣空间子模块：抽卡（她 2026-08-31：「抽卡是情侣空间的功能，每个恋爱角色单独一份，不是主页」）
  if (partner && cp[view] && cp[view].status === "together" && sub === "gacha") {
    return h(Gacha, { partner, pts: gachaPts, cards: gachaCards, luck: gachaLuck, busy: gachaBusy,
      onPull: onGachaPull, onRedeem: onGachaRedeem, onShow: onGachaShow, onPin: onGachaPin,
      onDelete: onGachaDelete,
      onTitle: onGachaTitle, onShoot: onGachaShoot, onCarve: onGachaCarve, shooting: !!studioBusy, onBack: () => setSub(null) });
  }
  // 情侣空间子模块：交换日记
  if (partner && cp[view] && cp[view].status === "together" && sub === "exdiary") {
    return h(CoupleExDiary, { partner, entries: coupleExDiary, onAdd: onAddExDiary, onRead: onReadExDiary, onBack: () => setSub(null) });
  }
  // 情侣空间子模块：合照墙
  if (partner && cp[view] && cp[view].status === "together" && sub === "album") {
    return h(CoupleAlbum, { partner, photos: duoPhotosFor ? duoPhotosFor(partner.id) : [], onBack: () => setSub(null), onDelete: onDeletePhoto ? p => onDeletePhoto(partner.id, p) : null, onUpload: onUploadPhoto ? (file, desc) => onUploadPhoto(partner.id, file, desc) : null });
  }
  // 情侣空间子模块：情书
  if (partner && cp[view] && cp[view].status === "together" && sub === "letters") {
    return h(CoupleLetters, { partner, letters: coupleLetters, cfg: (coupleLetterCfg || {})[partner.id], onGen: onGenLetter, onAddMy: onAddMyLetter, onReply: onReplyLetter, onRead: onReadLetter, onRemove: onRemoveLetter, onSaveCfg: onSaveLetterCfg, gen: letterGen, onBack: () => setSub(null) });
  }
  // 情侣空间子模块：共同档案（手动写）与愿望板（手动维护）
  if (partner && cp[view] && cp[view].status === "together" && sub === "archive") {
    const home = (coupleHome || {})[partner.id] || {};
    return h(CoupleArchive, { partner, data: home.archive || {}, onSave: archive => onSaveCoupleHome(partner.id, cur => ({ ...cur, archive })), onBack: () => setSub(null) });
  }
  if (partner && cp[view] && cp[view].status === "together" && sub === "recall") {
    // ⚠️旁边每一格都有自己那一个 busy（qaGen / tlGen / letterGen / studioBusy…）。
    // 这一格原来写 `gen && gen.coupleRecall`，可传进来的 gen 是【悄悄话那个布尔】，
    // 不是整个 gen 对象——于是永远是 undefined，按下去一点动静都没有。
    return h(CoupleRecall, { partner, items: coupleRecall, busy: recallGen,
      onGen: () => onGenRecall(partner), onRead: onReadRecall, onDel: onDelRecall, onBack: () => setSub(null) });
  }
  if (partner && cp[view] && cp[view].status === "together" && sub === "pacts") {
    return h(CouplePacts, { partner, pacts: couplePactsOf ? couplePactsOf(partner.id) : null,
      onClose: onClosePact, onSetDue: (mid, about, ts, via) => onSetPactDue(mid, partner.id, about, ts, via),
      onAdd: (txt, ts) => onAddPact(partner.id, txt, ts), onBack: () => setSub(null) });
  }
  if (partner && cp[view] && cp[view].status === "together" && sub === "jar") {
    const home = (coupleHome || {})[partner.id] || {};
    return h(CoupleJar, { partner, data: home.jar, wishes: home.wishes || [], myWallet, myName: ((typeof profileFor === "function" && profileFor(partner.id)) || profile || {}).name,
      onMove: (delta, note, wishId) => onJarMove && onJarMove(partner.id, delta, note, wishId), onGoal: (name, amount) => onJarGoal && onJarGoal(partner.id, name, amount), onBack: () => setSub(null) });
  }
  if (partner && cp[view] && cp[view].status === "together" && sub === "wishes") {
    const home = (coupleHome || {})[partner.id] || {};
    return h(CoupleWishes, { partner, data: home.wishes || [], onSave: wishes => onSaveCoupleHome(partner.id, cur => ({ ...cur, wishes })),
      onPlan: (wish, ts) => onPlanWish && onPlanWish(partner.id, wish, ts), planOf: wishPlanOf,
      trips: (coupleTrips || []).filter(t => t && t.charId === partner.id),
      onDepart: wish => { onTripStart && onTripStart(partner.id, wish); openSub("trip"); },
      onOpenTrips: () => openSub("trip"),
      onGenWish: onGenWish, wishGen: charWishGen,
      onBack: () => setSub(null) });
  }
  // 情侣空间子模块：花房（v62.33）
  if (partner && cp[view] && cp[view].status === "together" && sub === "garden") {
    return h(CoupleGarden, { partner, data: (coupleGarden || {})[partner.id] || {}, gen: gardenGen === partner.id,
      onPlant: () => onGardenPlant && onGardenPlant(partner), onKeep: () => onGardenKeep && onGardenKeep(partner.id),
      onBack: () => setSub(null) });
  }
  // 情侣空间子模块：时光胶囊（v62.41）
  // ⚠️它原来不是子页，是 setScreen("capsule") 跳去【另一个屏】。于是从里面退出来，
  //   Us 整个重挂：view 和 sub 全归零，人直接被扔回情侣名册
  //  （她 2026-09-04：「时光胶囊点进去退出会整个页面退出」）。
  //   跟这一页别的十几扇门做成同一个形状就好了——退一层就是退一层，滚动位置也跟着回来。
  if (partner && cp[view] && cp[view].status === "together" && typeof sub === "string" && sub.indexOf("book:") === 0 && window.SPACE_BOOKS && window.SPACE_BOOKS[sub.slice(5)] && onBookAdd) {
    const bk = sub.slice(5), book = Object.assign({ key: bk }, window.SPACE_BOOKS[bk]);
    return h(SpaceBook, { partner, book, entries: ((spaceBooks || {})[partner.id] || {})[bk] || [], busy: spaceBookBusy,
      onAdd: entry => onBookAdd(partner.id, bk, entry), onReply: (id, line) => onBookReply(partner.id, bk, id, line), onRemove: id => onBookRemove(partner.id, bk, id),
      onTa: id => onBookTa(partner.id, bk, id), onBack: () => setSub(null) });
  }
  if (partner && cp[view] && cp[view].status === "together" && sub === "capsule" && typeof window !== "undefined" && window.CapsuleApp) {
    return h(window.CapsuleApp, Object.assign({}, capsuleProps || {}, {
      characters: characters, characterId: partner.id, profile: ((typeof profileFor === "function" && profileFor(partner.id)) || profile), onBack: () => setSub(null) }));
  }
  // 情侣空间子模块：旅行（v62.26，从愿望板进，返回也回愿望板——一层层退）
  if (partner && cp[view] && cp[view].status === "together" && sub === "trip") {
    return h(CoupleTrip, { partner, trips: (coupleTrips || []).filter(t => t && t.charId === partner.id),
      gen: tripGen === partner.id, onPlan: () => onTripPlan && onTripPlan(partner),
      onBook: () => onTripBook && onTripBook(partner), onBookPick: pk => onTripBookPick && onTripBookPick(partner, pk), onBookPay: who => onTripBookPay && onTripBookPay(partner, who),
      onDate: d => onTripDate && onTripDate(partner, d), hasKin: !!(kinCardFrom && kinCardFrom(partner.id)),
      onDepart: () => onTripDepart && onTripDepart(partner), onDone: () => onTripDone && onTripDone(partner),
      onBack: () => openSub("wishes") });
  }
  if (partner && cp[view] && cp[view].status === "together") {
    const days = daysWith(cp[view].since);
    const cprof = (coupleProfile || {})[partner.id] || {};
    const sweet = (coupleSweet || {})[partner.id] || { value: 0, last: null };
    const todayK = (function () { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); })();
    const sweetDone = sweet.last === todayK;
    // 没单独设「我在这儿的头像」时，跟单聊一样认这个人绑的那张面具
    const mp = (typeof profileFor === "function" && profileFor(partner.id)) || profile;
    const myChar = cprof.myAvatar ? { name: (mp && mp.name) || "我", avatarImage: cprof.myAvatar } : { name: (mp && mp.name) || "我", avatarImage: mp && mp.avatarImage, color: (mp && mp.color) || t.accent };
    const paChar = cprof.charAvatar ? { name: partner.name, avatarImage: cprof.charAvatar } : partner;
    // —— bento 拼贴素材：每格露一点自己的活内容（全本地算，零 API）——
    const bCid = partner.id;
    const bPhotos = (duoPhotosFor ? duoPhotosFor(bCid) : []).slice().sort((a, b) => (b.ts || 0) - (a.ts || 0));
    const bLetters = (coupleLetters || []).filter(l => l.characterId === bCid);
    const bUnread = bLetters.filter(l => !l.isRead).length;
    // TA【真实】的心情（跟着真的聊过的天走，会自己平复）。v58.90 之前这儿看的是
    // 「心情打卡」——一次调用让模型在看不见你俩今天发生过什么的情况下瞎选一个表情。
    const bMood = moodOf ? moodOf(bCid) : null;
    const bQaN = (coupleQA || []).filter(e => e.characterId === bCid).length;

    const bTlN = (coupleTimeline || []).filter(e => e.characterId === bCid).length;
    // 「下一件值得等的事」走 annivNext（core.js）：不重复且已经过了的，不再是「值得等的事」
    const bAnn = (coupleAnniv || []).filter(a => a.characterId === bCid)
      // month/day 也带上：首页那一格现在真的画一张日历页（v62.31），要它俩才写得出那一天
      .map(a => { const nx = annivNext(a); return nx.passed ? null : { name: a.name, days: nx.days, month: a.month, day: a.day }; })
      .filter(Boolean).sort((x, y) => x.days - y.days)[0];
    const bHome = (coupleHome || {})[bCid] || {};
    const bArchive = bHome.archive || {};
    const bWishes = Array.isArray(bHome.wishes) ? bHome.wishes : [];
    const bArchiveN = COUPLE_ARCHIVE_FIELDS.filter(f => String(bArchive[f[0]] || "").trim()).length;
    const _gp = (gachaPts || {})[bCid];
    const bGachaPts = _gp && typeof _gp === "object" ? (Number(_gp.pts) || 0) : 0;
    const bGachaOpen = (gachaCards || []).filter(c => c.charId === bCid && !c.redeemedTs).length;
    const bFirstsN = coupleFirstsOf ? coupleFirstsOf(bCid).length : 0;
    const bShotsN = (studioShots || []).filter(x => x.charId === bCid).length;
    const bIfN = (ifLines || []).filter(x => x.charId === bCid).length;
    const bWishOpen = bWishes.filter(w => w.status !== "done" && w.status !== "shelved").length;
    const bCapsuleDue = typeof window !== "undefined" && window.capsuleDueCount ? window.capsuleDueCount(bCid, partner.name) : 0;
    // ── v59.22 她 2026-08-31：「还是差点意思不知道怎么搞」──────────────
    // 上一版把长相修好了，可每一格说的还是【几件】：「3 封」「4 个走过的第一次」
    // 「已答 5 题」「2 条想过的如果」。那是【目录语言】——一面真正的墙上你看见的
    // 是东西本身：一张照片、TA写的那行字、一个日期，不是「合照墙 · 还没有」。
    // 整页最有意思的那一格是和好间，因为它写的是「TA从 3 小时前开始，心情一直是
    // 「闷」」——一件具体发生的事。那不是巧合。
    // **把「几件」换成「哪一件」。** 数量只留给数量本身就是内容的那两处
    //（在一起第几天、抽卡点数）。
    const one = (v, n) => { const t = String(v == null ? "" : v).replace(/\s+/g, " ").trim(); return t.length > (n || 20) ? t.slice(0, n || 20) + "…" : t; };
    const bRecallLast = (coupleRecall || []).filter(x => x.characterId === bCid)[0];
    const _pacts = couplePactsOf ? couplePactsOf(bCid) : null;
    const bPactLast = _pacts ? (_pacts.open || [])[0] : null;
    const bFirstLast = coupleFirstsOf ? coupleFirstsOf(bCid)[0] : null;
    // ⚠️QA 记录的字段是 myAnswer/charAnswer，从来没有 e.answer——原来这个 filter 永远空，
    //   书脊上永远是「关于我们」（跟情书那行同一个病，v62.10 一起修）。
    //   TA出的、她还没答的那道排最前——那是这一格此刻真正的事。
    const bQaAsk = (coupleQA || []).filter(e => e.characterId === bCid && e.sealed && e.byCharacter && !e.myAnswer)[0];
    const bQaLast = bQaAsk || (coupleQA || []).filter(e => e.characterId === bCid && (e.myAnswer || e.charAnswer))[0];
    const bIfLast = (ifLines || []).filter(x => x.charId === bCid)[0];
    const bShotLast = (studioShots || []).filter(x => x.charId === bCid)[0];
    const itemTs = x => {
      if (!x) return 0;
      const direct = Number(x.updatedAt || x.createdAt || x.ts || x.answeredAt || 0);
      if (direct) return direct;
      if (x.date) { const parsed = Date.parse(x.date); if (Number.isFinite(parsed)) return parsed; }
      return 0;
    };
    // ⚠️这一行必须排在 itemTs 【之后】：它用 itemTs 当比较器，而 const 是有 TDZ 的。
    // v59.22 我把它写在 itemTs 前面，看着一直没事——因为 .sort() 只有【两条以上】
    // 才会调比较器，我的桩里只放了一封信，从没触发。她有两封以上，一进情侣空间
    // 就 ReferenceError 整页崩。桩太干净会把这类错藏得严严实实。
    const bLetterLast = bLetters.slice().sort((a, b) => itemTs(b) - itemTs(a))[0];
    const cleanSnippet = value => String(value || "").replace(/\s+/g, " ").trim().slice(0, 56);
    const recentItems = [];
    // ⚠️这几行原来各挂一个 emoji（💌📔📅🖼️✦），装在一个圆角小方块里。她 2026-09-03 报
    //   「有些有 emoji 有些还是一个方框」——两件事一起坏了：彩色 emoji 和单色符号（✦）
    //   混在一排里本来就不是一套；而 🖼️ 这类带变体选择符的字，在她机器上直接渲染成豆腐块。
    //   这一页底下「收着的」那一列书脊已经有一套现成的语言了：一条色带认一样东西。
    //   所以这里改用同一条色带，一个字符都不放——不放字符，就不会有字体渲不出来这回事。
    const BAND = { letters: "#b08d52", exdiary: "#b08a66", timeline: "#7f8ea6", album: "#a8735e", wishes: "#b0728e", qa: "#6a9a74" };
    // 通知卡左边那枚小图标上写的字（v61.29，她 2026-09-03：「最近发生也是一排线，
    // 跟收着的重复了，改成做个小 notification 样式吧」）。一个汉字，不是 emoji——
    // 汉字一定渲得出来，也跟「档」「愿」那两张水印是同一套写法。
    const APPCH = { letters: "信", exdiary: "记", timeline: "日", album: "照", wishes: "愿", qa: "问" };
    // 通知右上角那个时刻：通知栏从来不写「8月29日」，写的是「刚刚」「12分钟前」。
    // 隔了一天以上才退回日期——那时候「多久以前」已经不好数了。
    const notifyAgo = ts => {
      const d = Number(ts) || 0; if (!d) return "";
      const m = Math.floor((Date.now() - d) / 60000);
      if (m < 1) return "刚刚";
      if (m < 60) return m + " 分钟前";
      if (m < 24 * 60) return Math.floor(m / 60) + " 小时前";
      if (m < 48 * 60) return "昨天";
      return vDate(d, bCid).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
    };
    (coupleLetters || []).filter(x => x.characterId === bCid).forEach(x => recentItems.push({ id: "l_" + x.id, ts: itemTs(x), sub: "letters", label: "情书", text: cleanSnippet(x.title || x.body) }));
    (coupleExDiary || []).filter(x => x.characterId === bCid).forEach(x => recentItems.push({ id: "d_" + x.id, ts: itemTs(x), sub: "exdiary", label: "交换日记", text: cleanSnippet(x.content) }));
    (coupleTimeline || []).filter(x => x.characterId === bCid).forEach(x => recentItems.push({ id: "t_" + x.id, ts: itemTs(x), sub: "timeline", label: "我们的日子", text: cleanSnippet(x.title || x.content) }));
    bPhotos.forEach((x, i) => recentItems.push({ id: "p_" + (x.imgKey || x.ts || i), ts: itemTs(x), sub: "album", label: "合照墙", text: cleanSnippet(x.desc) || "收进了一张我俩的合照" }));
    bWishes.forEach(x => recentItems.push({ id: "w_" + x.id, ts: itemTs(x), sub: "wishes", label: x.status === "done" ? "愿望实现" : "愿望板", text: cleanSnippet(x.title) }));
    // TA出的题（v62.10）也是「刚发生的事」——她自己翻题答题不算，那是她自己干的
    (coupleQA || []).filter(x => x.characterId === bCid && x.byCharacter).forEach(x => recentItems.push({ id: "q_" + x.id, ts: itemTs(x), sub: "qa", label: characterText(partner, "他出的题"), text: cleanSnippet(x.question) }));
    recentItems.sort((a, b) => b.ts - a.ts);
    // 15 条＝能往回翻一阵，又不至于把整页撑长（她 2026-09-03：「固定高度，
    // 可以 scroll 看历史 15 条」）。看得见的永远只有三条，剩下的靠滚。
    const bRecent = recentItems.slice(0, NOTIFY_KEEP);
    const sameDay = ts => { const d = new Date(ts || 0); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0") === todayK; };
    const bToday = recentItems.filter(x => sameDay(x.ts)).slice(0, 2);
    const bTodayRows = bToday.length ? h("div", { style: { borderTop: "1px solid #eadde3", padding: "9px 13px" } },
      bToday.map(x => h("button", {
        key: x.id,
        onClick: () => openSub(x.sub),
        className: "w-full flex items-center gap-2 active:opacity-60",
        style: { textAlign: "left", padding: "5px 0" }
      },
        h("span", { "aria-hidden": "true", style: { width: 4, height: 13, borderRadius: 99, background: BAND[x.sub] || "#d9c8d0", flexShrink: 0 } }),
        h("span", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: "#765865", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, STX(x.text))))) : null;
    const imgRow = (label, ref, field, has) => h("div", { className: "flex items-center justify-between", style: { marginBottom: 12 } },
      h("span", { style: { fontFamily: F_DISPLAY, fontSize: "calc(14.5px * var(--app-fs, 1))", color: t.ink } }, label),
      h("div", { className: "flex items-center gap-3" },
        has ? h("button", { onClick: () => onSetCoupleImg(partner.id, field, null), className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.fog } }, "恢复默认") : null,
        h("button", { onClick: () => ref.current && ref.current.click(), className: "active:opacity-70", style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.tint } }, has ? "更换" : "上传")));
    // ── 封面就是这一页的底（v60.58，她 2026-09-02）─────────────────────────
    // 「让整页都吃到背景，然后下滑的时候背景不会漂移」。
    // 原来封面是【滚动区里的第一块 208px】：往下滑它就跟着跑掉，页面剩下一片素底。
    // 现在把它贴在【不滚动的那一层】上（root），内容浮在上面滚——所以它一动不动，
    // 也一路铺到刘海和页底。上面盖一层渐变：最顶上压暗一点让白色的键看得见，
    // 中段透空给照片，到两百多像素处收成 t.bg，底下那些卡片照旧看得清。
    const coverBg = cprof.bg ? "center/cover no-repeat url(" + (typeof resolveImg === "function" ? resolveImg(cprof.bg) : cprof.bg) + ")" : "linear-gradient(135deg,#f3c6d3,#c8b0e0)";
    const ST = "env(safe-area-inset-top, 0px)";
    // ⚠️收口那一段不许拼 t.bg+"00"：主题色可能被她在主题工坊改成 rgb()/hsl()，
    // 那种拼法会让整条渐变作废——整页背景直接没了。要透明就写 transparent，
    // 要半透明走 bgA()（认不出来的格式就退回不透明，宁可挡住也不能整条失效）。
    const bgA = a2 => {
      const c = String(t.bg || "").trim();
      let m = /^#([0-9a-f]{6})$/i.exec(c);
      if (m) { const n = parseInt(m[1], 16); return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a2 + ")"; }
      m = /^#([0-9a-f]{3})$/i.exec(c);
      if (m) { const q = m[1].split("").map(x => parseInt(x + x, 16)); return "rgba(" + q[0] + "," + q[1] + "," + q[2] + "," + a2 + ")"; }
      m = /^rgba?\(([^)]+)\)$/i.exec(c);
      if (m) { const q = m[1].split(",").map(x => x.trim()); if (q.length >= 3) return "rgba(" + q[0] + "," + q[1] + "," + q[2] + "," + a2 + ")"; }
      return c;
    };
    // 她 2026-09-02 第二遍：「背景还是不是一整页。是固定住了。」——整页封面这件事保留。
    // v62.26 她 2026-09-04：「背景现在有点空……原来是有封面的，后来我又想让封面覆盖整页
    // 结果就没有这个边界了」。两件事其实不冲突，冲突的是【把两件事交给同一层去做】：
    // 上一版让这层纱既当遮光罩、又当内容的底（收成 .86 一直铺到页底），
    // 于是整页糊成一片，照片露不出来、纸也没有边。
    //   现在拆开：**纱只管顶上那一截**（把封面压暗，好让白色顶栏字读得清），
    //   到封面带结束就彻底透明；**内容自己是一张纸**（底下那张 sheet），
    //   纸有圆角上沿、有一道向上的投影——那就是她要的那条边界，而且它跟着滚。
    // 结果：封面带里照片是满强度的，纸底下照片仍旧透着（纸是半透明的 .88，跟原来那层等价），
    // 整页封面没丢，边界回来了。
    const veil = "linear-gradient(180deg,rgba(0,0,0,.34) 0px,rgba(0,0,0,.08) calc(" + ST + " + 76px),transparent calc(" + ST + " + 150px))";
    // ── 两枚扣在一起的环（v60.61 修细节）───────────────────────────────────
    // 上一版那道交叠弧是照着 74px 画的，可环实际是 72px——差这 2px，弧就飘到环外面，
    // 变成一道没来由的橙线。这一版尺寸全由 A/RING/GAP/OVER 算出来，不再手填：
    //   环外径 D = A + 2*(RING+GAP)，右边那枚往左压 OVER，
    //   交叠带的起点就是 (D-OVER)/D，弧只取上半圈 → 上半左压右、下半右压左＝扣住了。
    // 首页那几句跟着关系走（她 2026-10-16「改改吧让每种都有点不一样」）：数日子的说法、那颗值叫什么、打卡怎么说、颜色。
    //   甜蜜值底下是同一份数据，只是换个叫法；恋人那套原样不动。
    //   家人不数「做家人第几天」——家人不是哪天开始做的（她：「什么叫做家人第n天」），只数这个空间开了几天。
    const HOME_REL = {
      lover: null,
      bestie: { days: ["闺蜜盖章", "天"], val: "默契值", act: "碰一下", fg: "#6d4f91", bg: "#efe6f7", btn: "#e3d5f1" },
      friend: { days: ["挚友结盟", "天"], val: "交情", act: "报个到", fg: "#3d6656", bg: "#e3efe8", btn: "#d2e6da" },
      family: { days: ["空间开了", "天"], val: "暖度", act: "回家", fg: "#7d5a2e", bg: "#f4ead9", btn: "#ecdcc0" }
    };
    const hr = HOME_REL[window.spaceRelKey ? window.spaceRelKey(cp[view]) : "lover"] || null;
    // 这一页不许拿字符当图标（couple-home-icons）：恋人用 IHeart，别的关系不放图标，只靠颜色和字
    const relMark = (sz, col) => hr ? null : h(IHeart, { size: sz, color: col, filled: true });
    const A = 62, RING = 3, GAP = 2, OVER = 18;
    const D = A + 2 * (RING + GAP);
    const ringA = t.accent || "#c26b7a", ringB = t.tint || "#6f7fb0";
    // 挂点（她 2026-10-09）：美化时能把两枚拉开——拉开了就是两个整圆；我那枚的左边距写在行内，CSS 要加 !important。
    const ringed = (ch, ring, ml, who) => h("div", { "data-wk": "usavatar", "data-who": who, style: { marginLeft: ml || 0, width: D, height: D, borderRadius: 999, background: ring, boxShadow: "0 3px 12px rgba(0,0,0,.26)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 } },
      // 环和照片之间留一圈极浅的缝：封面再花，这两张脸也分得开
      h("div", { style: { width: A + 2 * GAP, height: A + 2 * GAP, borderRadius: 999, background: "rgba(255,255,255,.92)", display: "flex", alignItems: "center", justifyContent: "center" } },
        h("div", { style: { borderRadius: 999, overflow: "hidden", lineHeight: 0 } }, h(Avatar, { character: ch, size: A, radius: 999 }))));
    return h("div", { "data-wk": "uspage", "data-part": "us", className: "h-full flex flex-col", style: { position: "relative", background: coverBg } },
      h("div", { "aria-hidden": "true", style: { position: "absolute", inset: 0, background: veil, pointerEvents: "none" } }),
      // 顶栏浮在封面上，不跟着滚（返回键任何时候都够得着）
      h(Head, { zh: "我和 " + partner.name, bg: "transparent", noLine: true, ink: "#fff",
        inkShadow: "0 1px 6px rgba(0,0,0,.5)", onBack: () => setView(null),
        barStyle: { position: "relative", zIndex: 2, paddingBottom: 0, height: "calc(" + ST + " + 48px)" },
        right: onSetCoupleImg
          ? h("button", { onClick: () => setCpEdit(true), "aria-label": "自定义封面", className: "active:opacity-60 flex items-center justify-center", style: { width: 40, height: 40 } }, h(IPencil, { size: 18, color: "#fff" }))
          : null }),
      h("div", { ref: bodyRef, className: "flex-1 min-h-0 overflow-y-auto", style: { position: "relative", zIndex: 1, overscrollBehavior: "contain" } },
        // 这一块只是留出封面的位置（背景在下面那一层，不跟着滚）
        h("div", { style: { position: "relative", height: 150 } },
          h("div", { "data-wk": "uspair", style: { position: "absolute", left: 22, bottom: -30, zIndex: 2, display: "flex", alignItems: "flex-end" } },
            ringed(paChar, ringA, 0, "ta"),
            ringed(myChar, ringB, -OVER, "me"))),
            // 原来这儿还画了一道「两枚扣住」的交叠弧；她 2026-10-07 转来截图说串了（那道弧压在右边那张脸上），拿掉，两枚就是并排压着
        // ⭐这就是那条边界：一张有上沿的纸，从封面带底下探出来、盖着往上滚。
        //   paddingTop 让正文避开压在沿上的那两枚头像；纸是半透明的，封面照样透着。
        //   「纸做成磨砂」是个选项（✎ 里开，默认关）：开了封面透过来是糊开的一片颜色。
        h("div", { "data-wk": "uspaper", className: "px-6", style: Object.assign({ position: "relative", background: bgA(usPaperA),
          borderRadius: "26px 26px 0 0", borderTop: "1px solid rgba(255,255,255,.45)",
          boxShadow: "0 -9px 26px rgba(60,40,50,.15)", paddingTop: 46, paddingBottom: 32,
          minHeight: "calc(100% - 150px)" }, usFrost ? { backdropFilter: "blur(18px) saturate(1.2)", WebkitBackdropFilter: "blur(18px) saturate(1.2)" } : null) },
          h("div", { className: "flex items-end justify-between" },
            h("div", { className: "min-w-0" },
              h("div", { "data-wk": "usdays", className: "flex items-baseline gap-2" },
                h("span", { style: { fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", color: t.fog } }, hr ? hr.days[0] + (hr.days[0] === "空间开了" ? "" : " 第") : "在一起"),
                h("span", { style: { fontFamily: F_DISPLAY, fontStyle: "italic", fontSize: "calc(40px * var(--app-fs, 1))", color: hr ? hr.fg : t.accent, lineHeight: 1 } }, days),
                h("span", { style: { fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", color: t.fog } }, hr ? hr.days[1] : "天")),
              h("div", { className: "flex items-center gap-2.5", style: { marginTop: 8 } },
                h("span", { className: "flex items-center gap-1", style: { background: hr ? hr.bg : "#ffe1ea", color: hr ? hr.fg : "#c02a52", borderRadius: 999, padding: "3px 12px" } },
                  relMark(12, hr ? hr.fg : "#e0528a"),
                  h("span", { style: { fontFamily: F_DISPLAY, fontSize: "calc(13.5px * var(--app-fs, 1))" } }, (hr ? hr.val : "甜蜜值") + " " + (Math.round((sweet.value || 0) * 10) / 10))),
                onSetSince ? h("button", { onClick: () => { const d = new Date(cp[view].since || Date.now()); setSinceVal(d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0")); setSinceEdit(v => !v); }, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.tint } }, sinceEdit ? "收起" : h("span", { className: "flex items-center", style: { gap: 4 } }, h(IPencil, { size: 11, color: t.tint }), "起始日")) : null)),
            h("button", { "data-wk": "block", onClick: () => onCheckinSweet(partner), disabled: sweetDone, className: "active:opacity-70 disabled:opacity-100", style: { background: sweetDone ? t.line : hr ? hr.btn : "#ffd0dc", color: sweetDone ? t.fog : hr ? hr.fg : "#c02a52", fontFamily: F_DISPLAY, fontSize: "calc(14.5px * var(--app-fs, 1))", padding: "9px 20px", borderRadius: 999, flexShrink: 0 } },
              sweetDone ? (hr ? "今天" + hr.act + "过了" : "已打卡") : h("span", { className: "flex items-center", style: { gap: 5 } }, ...(hr ? [hr.act] : [h(IHeart, { size: 13, color: "#c02a52", filled: true }), "打卡"])))),
          // 同「我们说好的」那两处：日期框缩不下去，挤一排会把最右边顶出屏幕。
          // 日期＋保存一行（日期 minWidth:0 才真让得动），那句说明自己一行。
          sinceEdit ? h("div", { style: { marginTop: 10 } },
            h("div", { className: "flex items-center gap-2" },
              h("input", { type: "date", value: sinceVal, onChange: e => setSinceVal(e.target.value), className: "outline-none px-3 py-2 rounded-lg", style: { flex: 1, minWidth: 0, fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", background: t.bg2, color: t.ink, border: "1px solid " + t.line } }),
              h("button", { onClick: () => { if (sinceVal) { onSetSince(partner.id, sinceVal); setSinceEdit(false); } }, className: "shrink-0 active:opacity-70", style: { background: t.ink, color: t.bg2, fontFamily: F_DISPLAY, fontSize: "calc(13.5px * var(--app-fs, 1))", padding: "8px 18px", borderRadius: 10 } }, "保存")),
            h("span", { style: { display: "block", fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog, marginTop: 6 } }, "第几天 / 时间轴起点跟着变")) : null,
          // —— 情侣空间首页：把已有模块重新织成「今天 / 最近 / 长期共同层」——
          h("section", { style: { marginTop: 22 } },
            h("div", { className: "flex items-end justify-between", style: { marginBottom: 10 } },
              h("div", null,
                h(Eyebrow, null, "今天 · " + todayK.slice(5).replace("-", ".")),
                h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(22px * var(--app-fs, 1))", color: t.ink, marginTop: 3 } }, "今天的我们")),
              h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog } }, bToday.length ? "今天留下 " + bToday.length + " 件事" : "安静的一天也算一天")),
            // ── 这两格原来是同一个圆角框劈成两半、只靠一条竖线分开（她 2026-09-04：
            //    「很无聊的框」）。两边说的本来就不是一件事，所以给两样不同的东西：
            //    左边【TA此刻】＝一张贴上去的便签（顶上一段胶带，纸微微歪）；
            //    右边【下一件值得等的事】＝那本挂历的一页——跟「我们的日子」里倒数那一列
            //    是同一张 CalPage，一处画两处用。
            h("div", { style: { borderRadius: 22, overflow: "hidden", border: "1px solid #eadde3", background: "linear-gradient(135deg,#fff8f7 0%,#f6f0f7 100%)" } },
              h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, padding: 12 } },
                h("div", { "data-wk": "usnow", style: { position: "relative", minHeight: 96, background: "#fffdf5", borderRadius: 3, padding: "16px 12px 12px",
                  transform: "rotate(-1deg)", boxShadow: "0 3px 9px rgba(92,60,74,.14)" } },
                  h("div", { "aria-hidden": "true", style: { position: "absolute", left: "50%", top: -7, marginLeft: -21, width: 42, height: 14, background: "rgba(214,196,168,.5)", border: "1px solid rgba(180,158,124,.35)", transform: "rotate(-3deg)" } }),
                  h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: "#927280" } }, partner.name + " 此刻"),
                  bMood && bMood.label ? h("div", { className: "flex items-center gap-2", style: { marginTop: 9 } },
                    moodFaceOf(bMood.label) ? h(MoodGlyph, { mood: moodFaceOf(bMood.label), size: 30 }) : null,
                    h("div", { className: "min-w-0" },
                      h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(17px * var(--app-fs, 1))", color: "#765865", lineHeight: 1.2 } }, bMood.label),
                      bMood.ago ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10px * var(--app-fs, 1))", color: "#a08795", marginTop: 2 } }, bMood.ago) : null))
                    : h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(17px * var(--app-fs, 1))", color: "#765865", marginTop: 11 } }, "还没聊过天")),
                // ⚠️那行小标题放【整格的顶上】，不要跟日历页并排：并排的话它只剩七十来像素，
                //   「下一件值得等的事」会折成「…值得等的 / 事」（浏览器里当场看出来的）。
                h("button", { onClick: () => openSub("timeline"), className: "active:opacity-70",
                  style: { minHeight: 96, padding: "12px 10px", textAlign: "left" } },
                  h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: "#927280" } }, bAnn ? "下一件值得等的事" : "日历上等你们写"),
                  h("div", { className: "flex items-center", style: { gap: 10, marginTop: 9 } },
                    h(CalPage, { w: 40, month: bAnn && bAnn.month, day: bAnn && bAnn.day, dim: !bAnn,
                      head: bAnn ? undefined : "　", body: bAnn ? undefined : "＋" }),
                    h("div", { className: "min-w-0 flex-1" },
                      bAnn ? h(Fragment, null,
                        h("div", { className: "flex items-baseline gap-1" },
                          h("span", { style: { fontFamily: F_DISPLAY, fontStyle: "italic", fontSize: "calc(25px * var(--app-fs, 1))", color: "#a74d70", lineHeight: 1 } }, bAnn.days === 0 ? "今天" : bAnn.days),
                          bAnn.days ? h("span", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: "#927280" } }, "天后") : null),
                        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: "#765865", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, bAnn.name))
                        : h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(16px * var(--app-fs, 1))", color: "#765865" } }, "添一个纪念日"))))),
              bTodayRows)),
          h("section", { style: { marginTop: 20 } },
            h("div", { className: "flex items-center justify-between", style: { marginBottom: 9 } },
              h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(19px * var(--app-fs, 1))", color: t.ink } }, "最近发生"),
              h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog } }, "从你俩的角落里捞出来")),
            // ── 通知中心那一叠（v61.29 立，v61.31 收成固定高度）──
            // 上一版这里是「一条色带＋一行字」，跟底下「收着的」那一列书脊长得一模一样
            // ——她 2026-09-03 说「跟收着的重复了」。两处说的本来就不是一件事：
            // 书脊是【一直在那儿的东西】（一本一本翻），这里是【刚发生的事】。
            // 刚发生的事在手机上长什么样，是有现成答案的：一叠通知卡。
            //
            // v61.31（她：「做小一点，每次只显示三条固定高度，然后可以 scroll 看历史 15 条」）：
            // 卡片整体收小一号，容器钉死三条的高度、里面自己滚。
            // ⚠️越往下越淡越窄那一层【必须去掉】：那是给「只有五条、一眼看全」做的。
            //   一旦能滚，第 8 条会淡到看不见、窄得对不齐——同一个效果换个前提就成了 bug。
            h("div", { style: { position: "relative" } },
              bRecent.length ? h(Fragment, null,
                h("div", { style: { height: NOTIFY_H, overflowY: "auto", overscrollBehavior: "contain",
                  display: "flex", flexDirection: "column", gap: NOTIFY_GAP, paddingRight: 2,
                  WebkitOverflowScrolling: "touch" } },
                  bRecent.map(x => h("button", { key: x.id, onClick: () => openSub(x.sub),
                    className: "w-full active:opacity-70 shrink-0", style: { display: "flex", alignItems: "center", gap: 9,
                      height: NOTIFY_ROW, padding: "0 11px", textAlign: "left", borderRadius: 14,
                      background: "rgba(255,255,255,.8)", border: "1px solid rgba(146,114,128,.16)",
                      backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                      boxShadow: "0 3px 10px rgba(92,60,74,.07)" } },
                    h("span", { "aria-hidden": "true", style: { width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                      background: BAND[x.sub] || t.line, color: "#fff", display: "flex", alignItems: "center",
                      justifyContent: "center", fontFamily: F_DISPLAY, fontSize: "calc(13px * var(--app-fs, 1))",
                      boxShadow: "inset 0 -5px 9px rgba(0,0,0,.10)" } }, APPCH[x.sub] || "·"),
                    h("div", { className: "min-w-0 flex-1" },
                      h("div", { className: "flex items-baseline", style: { gap: 6 } },
                        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(9.5px * var(--app-fs, 1))", letterSpacing: ".04em", color: "#96788a", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, x.label),
                        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(9px * var(--app-fs, 1))", color: "#b09aa6", flexShrink: 0 } }, notifyAgo(x.ts))),
                      h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: "#4b3b44", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, STX(x.text))))))
                ,
                // 底下压一层渐隐：不写「往下还有」也看得出这一叠没到头
                bRecent.length > NOTIFY_SHOW ? h("div", { "aria-hidden": "true", style: { position: "absolute",
                  left: 0, right: 0, bottom: 0, height: 22, borderRadius: "0 0 14px 14px", pointerEvents: "none",
                  background: "linear-gradient(transparent," + bgA(0.9) + ")" } }) : null)
                : h("div", { style: { borderRadius: 16, border: "1px dashed rgba(146,114,128,.28)", padding: "18px 14px", fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.fog, textAlign: "center", lineHeight: 1.8 } }, "还没有推送。", h("br"), "便签、情书、日记、合照和实现了的愿望都会推到这儿。"))),
          h("section", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 20 } },
            // ── 这两张不再是「圆角框 + 一个大水印字」（她 2026-09-04：「还是有点平淡」）。
            //    判据照 tabs-not-plain-pills.md：原样搬到别的 app 里还成立吗？成立就是写坏了。
            //    档案是一只【牛皮纸档案夹】：夹面、伸出来的索引标签、右边一叠纸的侧边、
            //      右上角那枚绕线扣——跟点进去那一页是同一套语言（一处的东西，两处长得一样）。
            //    愿望板是【软木板上钉着的一张便签】：软木底、便签微微歪着、顶上一枚真的图钉。
            //    两张不再靠「一个汉字」凑成一对，靠的是各自真的是那样东西。
            h("button", { onClick: () => openSub("archive"), className: "active:opacity-70",
              style: { minHeight: 132, borderRadius: "4px 4px 10px 10px", padding: 0, textAlign: "left",
                background: "#cdb488", backgroundImage: "repeating-linear-gradient(97deg,rgba(120,90,45,.06) 0 2px,transparent 2px 13px)",
                border: "1px solid #b49a70", position: "relative", overflow: "hidden", boxShadow: "0 5px 14px rgba(110,80,35,.16)" } },
              // 右边露出来的那一叠纸边
              h("div", { "aria-hidden": "true", style: { position: "absolute", right: 5, top: 12, bottom: 12, width: 9, borderRadius: 2, background: "linear-gradient(90deg,#fbf6ea,#efe6d2)", boxShadow: "0 1px 4px rgba(110,80,35,.22)" } }),
              h("div", { "aria-hidden": "true", style: { position: "absolute", right: 11, top: 16, bottom: 16, width: 7, borderRadius: 2, background: "#fbf6ea", opacity: 0.75 } }),
              // 绕线扣
              h("div", { "aria-hidden": "true", style: { position: "absolute", right: 26, top: 9, width: 12, height: 12, borderRadius: 999, background: "#b09468", border: "1.5px solid rgba(90,65,25,.5)" } }),
              // 伸出来的索引标签
              h("div", { "data-wk": "block", style: { display: "inline-block", marginLeft: 12, borderRadius: "0 0 7px 7px", padding: "5px 11px 5px", background: "#b0885a", color: "#fff", fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", boxShadow: "inset 0 -1px 0 rgba(255,255,255,.22)" } }, "只由你亲手写"),
              h("div", { style: { padding: "10px 14px 14px" } },
                h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(19px * var(--app-fs, 1))", color: "#42311a" } }, "我们的档案"),
                h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: "#6d5836", marginTop: 20, lineHeight: 1.5 } },
                  bArchiveN ? "已封存 " + bArchiveN + "/" + COUPLE_ARCHIVE_FIELDS.length + " 页" : "称呼、梗与小仪式"))),
            h("button", { onClick: () => openSub("wishes"), className: "active:opacity-70",
              style: { minHeight: 132, borderRadius: 12, padding: 10, textAlign: "left",
                background: "#c8a878", backgroundImage: "radial-gradient(rgba(120,88,48,.24) 0.9px,transparent 1px), radial-gradient(rgba(255,240,214,.34) 0.9px,transparent 1px)",
                backgroundSize: "7px 7px, 11px 11px", backgroundPosition: "0 0, 4px 5px",
                border: "1px solid #ab8c5e", position: "relative", overflow: "hidden", boxShadow: "inset 0 0 22px rgba(110,80,35,.2)" } },
              h("div", { "data-wk": "block", style: { position: "relative", height: "100%", background: "#fdf6ea", borderRadius: 3, padding: "16px 12px 12px", transform: "rotate(-1.4deg)", boxShadow: "0 4px 11px rgba(90,62,28,.28)" } },
                // 图钉：帽子 + 高光 + 底下那一点影
                h("div", { "aria-hidden": "true", style: { position: "absolute", left: "50%", top: -6, marginLeft: -7, width: 14, height: 14, borderRadius: 999, background: "radial-gradient(circle at 34% 30%,#f0899f,#b83b5c)", boxShadow: "0 3px 5px rgba(80,30,45,.4)" } }),
                h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10px * var(--app-fs, 1))", color: "#a46d7e", letterSpacing: ".14em" } }, "以后想一起做的"),
                h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(19px * var(--app-fs, 1))", color: "#8e4960", marginTop: 6 } }, "愿望板"),
                h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: "#a46d7e", marginTop: 14, lineHeight: 1.5 } },
                  bWishes.length ? bWishOpen + " 件还在等 · " + bWishes.filter(w => w.status === "done").length + " 件实现" : "把以后钉在这里")))),
          // —— 情侣空间 app 拼贴：六列做出宽窄、高低与转角层级；顺序固定，刷新不乱跳。——
          h("div", { className: "flex items-end justify-between", style: { marginTop: 24, marginBottom: 10 } },
            h("div", null,
                            h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(21px * var(--app-fs, 1))", color: t.ink, marginTop: 3 } }, "我们的小房间")),
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog } }, "挑一扇门进去")),
          (() => {
            const PAPER = "#fffdfa", PLINE = "rgba(92,72,62,.13)";
            // ── v59.24 整个换掉网格（她 2026-09-01：「我觉得是网格和颜色还有背景的问题，
            //    还有太条条框框了都是方框，混着一个圆的。后续我打算继续加内容进去的，
            //    再继续叠罗汉好无聊」）──
            // 前两版是在 bento 里修装饰：换配色、改圆角、加水印字。可病在结构——
            // **六列网格每加一格就更糟**，而她明说了以后还要往里加东西。
            // 现在改成【三个面】，每个面有自己的底和自己的规矩：
            //   ① 今天   一块深的，只放此刻的事（第几天、TA这会儿怎么样）
            //   ② 墙上   贴着的东西：照片、票根、卡片——**不对齐**，各自宽度不同、
            //            轻微歪着，用 flex-wrap 不用 grid，所以加一样就是多贴一张
            //   ③ 收着的 一列书脊：情书、日记、约定……加一样就是多一本，不撑版面
            // 形状不再是「一堆方框混一个圆」，而是【跟内容对应的形状】：照片是照片、
            // 票根是票根、册子是书脊。那个孤零零的圆去掉了——它是唯一一个，
            // 读起来就是随机。
            const wall = (k, o) => h("button", { key: k, "data-wk": "uswall", "data-kind": k, onClick: o.onClick || (() => openSub(k)), className: "active:opacity-75",
              style: { position: "relative", textAlign: "left", width: o.w, flexGrow: o.grow || 0, minWidth: 0, overflow: "hidden",
                borderRadius: o.radius == null ? 5 : o.radius, padding: o.pad || "12px 13px",
                background: o.bg || PAPER, border: o.border || ("1px solid " + PLINE),
                transform: o.tilt ? "rotate(" + o.tilt + "deg)" : null,
                boxShadow: o.flat ? "none" : "0 8px 20px rgba(68,45,58,.10)" } },
              o.deco || null,
              o.dot ? h("span", { style: { position: "absolute", top: 9, right: 10, width: 7, height: 7, borderRadius: 999, background: "#e0524a" } }) : null,
              o.kids);
            // 书脊：左边一条色带 + 一行字 + 右边一句近况。加一本就是多一行，不撑版面。
            //   （试过一版书架上竖着的书——她 2026-10-16：「不要这个 原来那个列表好」。）
            const spine = (k, o) => h("button", { key: k, "data-wk": "usspine", "data-kind": k, "data-new": o.dot ? "1" : "0", onClick: o.onClick || (() => openSub(k)), className: "w-full text-left active:opacity-70",
              style: { display: "flex", alignItems: "center", gap: 11, padding: "13px 4px 13px 0", borderBottom: "1px solid " + PLINE, position: "relative" } },
              h("span", { "aria-hidden": "true", style: { width: 3, height: 26, borderRadius: 3, background: o.band, flexShrink: 0 } }),
              h("div", { style: { width: 58, flexShrink: 0, fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: o.band } }, o.zh),
              h("div", { className: "flex-1 min-w-0", style: { fontFamily: F_DISPLAY, fontSize: "calc(14px * var(--app-fs, 1))", lineHeight: 1.5, color: t.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, STX(o.say)),
              o.dot ? h("span", { style: { width: 7, height: 7, borderRadius: 999, background: "#e0524a", flexShrink: 0 } }) : null);
            const shelf = list => h("div", { style: { borderTop: "1px solid " + PLINE } }, list.flat());
            const mkSig = makeupSignalFor ? makeupSignalFor(bCid) : { on: false, why: "" };
            const mkCur = makeupOf ? makeupOf(bCid) : null;
            // 英文眉标 v62.12 清掉（no-english-titles）：ON THE WALL / KEPT 换任何 app 都成立，
            // 「墙上」「收着的」本来就在——那行英文纯属装饰。
            const eyebrow = (zh, right) => h("div", { "data-wk": "useyebrow", className: "flex items-end justify-between", style: { marginTop: 26, marginBottom: 11 } },
              h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(19px * var(--app-fs, 1))", color: t.ink } }, zh),
              right ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog } }, right) : null);
            // ── ① 今天：一页挂历 ──────────────────────────────
            // v62.40（她 2026-09-04：「这两个从这里开始和和好馆的外观也好无聊」）。
            // 上一版是一块紫色渐变圆角卡——按 tabs-not-plain-pills 那条判据问一句
            // 「原样搬去另一个 app 还成立吗」：成立，所以它没从这一格是什么东西里长出来。
            // 这一整页本来就是【一面墙】：底下贴着拍立得、票根、软木板卡片。
            // 那么「时间轴与纪念日」在墙上是什么？——**一本挂历**。
            // 所以它就长成挂历页：顶上两个打穿的孔、跨过顶边的两个铁环、一条红头写月份，
            // 纸上有淡淡的竖格线，日子是那一页上最大的字，底边一道撕线。
            const _cal = new Date();
            const CAL_M = bAnn && bAnn.month ? Number(bAnn.month) : _cal.getMonth() + 1;
            const CAL_RED = "#8d3f56";
            const calRing = left => h("span", { "aria-hidden": "true", key: "r" + left,
              style: { position: "absolute", left: left, top: -8, width: 11, height: 23, borderRadius: 6,
                border: "2px solid rgba(120,96,86,.55)", borderBottomColor: "rgba(160,140,130,.28)", zIndex: 2 } });
            const calHole = left => h("span", { "aria-hidden": "true", key: "h" + left,
              style: { position: "absolute", left: left, marginLeft: 1, top: 2, width: 9, height: 9, borderRadius: 999,
                background: "rgba(70,44,54,.34)", boxShadow: "inset 0 1px 2px rgba(0,0,0,.38)", zIndex: 1 } });
            return h(Fragment, null,
              h("div", { style: { position: "relative", paddingTop: 7 } },
                calRing("33%"), calRing("67%"),
                h("button", { onClick: () => openSub("timeline"), className: "w-full text-left active:opacity-85",
                  style: { position: "relative", display: "block", overflow: "hidden", borderRadius: "4px 4px 2px 2px",
                    background: "#fdf8ee", boxShadow: "0 14px 30px rgba(68,32,52,.20)" } },
                  // 红头：月份在左，年份在右——挂历页上就是这么写的
                  h("div", { style: { position: "relative", background: "linear-gradient(180deg," + CAL_RED + " 0%,#77324a 100%)",
                    padding: "13px 16px 9px", display: "flex", alignItems: "baseline", justifyContent: "space-between" } },
                    calHole("33%"), calHole("67%"),
                    h("span", { style: { fontFamily: F_DISPLAY, fontSize: "calc(15px * var(--app-fs, 1))", color: "#fff", letterSpacing: 1 } }, CAL_M + " 月"),
                    h("span", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: "rgba(255,255,255,.66)", letterSpacing: ".18em" } },
                      String(bAnn && bAnn.month ? (new Date()).getFullYear() : _cal.getFullYear()))),
                  // 纸面：淡淡的竖格线（挂历那七道格子），字压在上面
                  h("div", { style: { position: "relative", padding: "16px 16px 15px" } },
                    h("div", { "aria-hidden": "true", style: { position: "absolute", inset: 0, opacity: .5,
                      backgroundImage: "repeating-linear-gradient(90deg,rgba(140,110,120,.16) 0 1px,rgba(0,0,0,0) 1px 14.28%)" } }),
                    bAnn ? h("div", { "aria-hidden": "true", style: { position: "absolute", right: 15, top: 8,
                      fontFamily: F_DISPLAY, fontSize: "calc(44px * var(--app-fs, 1))", lineHeight: 1, color: "rgba(122,77,99,.13)" } },
                      Number(bAnn.day)) : null,
                    bAnn
                      ? h("div", { style: { position: "relative" } },
                          h("div", { className: "flex items-baseline", style: { gap: 7 } },
                            h("span", { style: { fontFamily: F_DISPLAY, fontSize: "calc(52px * var(--app-fs, 1))", lineHeight: 1, color: "#5b2f46" } }, bAnn.days === 0 ? "今天" : bAnn.days),
                            bAnn.days > 0 ? h("span", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: "#9b7d8b" } }, "天后") : null),
                          h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(14.5px * var(--app-fs, 1))", color: "#7a4d63", marginTop: 7 } }, "「" + bAnn.name + "」"))
                      : h("div", { style: { position: "relative", fontFamily: F_DISPLAY, fontSize: "calc(24px * var(--app-fs, 1))", color: "#5b2f46", lineHeight: 1.35, padding: "6px 0 4px" } },
                          bTlN ? "记了 " + bTlN + " 个瞬间" : "从这里开始"),
                    h("div", { className: "flex items-center justify-between", style: { position: "relative", marginTop: 14 } },
                      h("span", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: "#a68b98" } }, "时间轴与纪念日"),
                      h("span", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: "#c0a3af" } }, "翻开"))),
                  // 撕线：挂历页撕下来的那一道
                  h("div", { "aria-hidden": "true", style: { height: 6, borderTop: "1px dashed rgba(140,110,120,.42)",
                    background: "repeating-linear-gradient(90deg,rgba(0,0,0,.05) 0 3px,rgba(0,0,0,0) 3px 7px)" } }))),
              // 纪念日当天的仪式（v62.11）：就今天这一天露出来——让TA写一条「走到今天」的感慨，
              // 落进时光轴（还是那条 genTimelineMusing 链，只是带上了是哪个日子）。一年就那么几次。
              bAnn && bAnn.days === 0 ? h("button", { onClick: () => !tlGen && onGenTimeline(partner, bAnn.name), disabled: tlGen,
                className: "w-full text-left active:opacity-75 disabled:opacity-60",
                style: { display: "block", marginTop: 10, borderRadius: 13, padding: "12px 15px", minHeight: 44,
                  background: "#fdf3e3", border: "1px solid #ecd9b8" } },
                h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(14.5px * var(--app-fs, 1))", color: "#8a6a3a", lineHeight: 1.5 } },
                  tlGen ? partner.name + " 写着…" : "今天是「" + bAnn.name + "」——让 " + partner.name + " 写写走到今天")) : null,
              // ── 和好间：一张折起来的字条 ───────────────────────
              // v62.40（她 2026-09-04：「和好馆的外观也好无聊」）。上一版是一个圆角
              // 药丸框换个底色——同样过不了那句「搬去别的 app 还成立吗」。
              // 这一格凭什么存在，makeup.js 开头写死了：**TA没说出口的那一半**。
              // 那句话在现实里就是一张【折起来的字条】：外头看得见一行，剩下的折在里面。
              // 所以有事的时候它是折过的——右上角一个真的折角、当中一道折痕、纸微微歪；
              // 没事的时候它就是一张没折过的空白纸条，平平地压在那儿。
              (() => {
                const lit = !!(mkSig.on || mkCur);
                const line = mkCur ? "还没了结的那一段" : mkSig.on ? mkSig.why : "这会儿没什么事";
                const EAR = 22;   // 折角边长
                return h("button", { onClick: () => openSub("makeup"), className: "w-full text-left active:opacity-80",
                  style: { position: "relative", display: "block", marginTop: lit ? 14 : 10, minHeight: 44,
                    borderRadius: 2, padding: lit ? "12px 15px 22px" : "12px 14px",
                    background: lit ? "linear-gradient(180deg,#fcefe9 0%,#fae8e1 46%,#f6e2da 100%)" : "rgba(255,253,250,.42)",
                    border: "1px solid " + (lit ? "#e9cdc3" : PLINE),
                    transform: lit ? "rotate(-0.7deg)" : null,
                    boxShadow: lit ? "0 11px 24px rgba(120,70,60,.15)" : "none",
                    clipPath: lit ? "polygon(0 0, calc(100% - " + EAR + "px) 0, 100% " + EAR + "px, 100% 100%, 0 100%)" : null } },
                  // 折角：翻起来那一小片纸的背面
                  lit ? h("span", { "aria-hidden": "true", style: { position: "absolute", top: 0, right: 0, width: EAR, height: EAR,
                    background: "linear-gradient(225deg,#e2c2b6 0%,#f2ddd5 70%)", clipPath: "polygon(0 0, 100% 100%, 0 100%)",
                    boxShadow: "-1px 1px 2px rgba(120,70,60,.18)" } }) : null,
                  h("div", { className: "flex items-baseline", style: { gap: 8 } },
                    h("span", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", letterSpacing: ".14em", color: lit ? "#bd9082" : t.fog, flexShrink: 0 } }, "和好间"),
                    !lit ? h("span", { style: { fontFamily: F_DISPLAY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.fog, lineHeight: 1.5 } }, line) : null),
                  lit ? h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(15.5px * var(--app-fs, 1))", lineHeight: 1.55, color: "#8d5a4f", marginTop: 7, paddingRight: 4 } }, line) : null,
                  // 底边那一道是【折上来的那一小条】，不是分隔线。
                  // ⚠️上一版把折痕横在正文上面，结果读起来是「一条标题栏压着一条内容栏」——
                  //   两个方块摞着，正是要躲开的那种长相。折在【底边】才像一张折过的纸。
                  lit ? h("span", { "aria-hidden": "true", style: { position: "absolute", left: 0, right: 0, bottom: 0, height: 11,
                    background: "linear-gradient(180deg,#eed3c9 0%,#e6c4b8 100%)",
                    borderTop: "1px solid rgba(255,255,255,.55)", boxShadow: "0 -3px 7px -5px rgba(120,70,60,.45)" } }) : null);
              })(),
              // ── ② 墙上：贴着的东西，不对齐 ──────────────────────
              eyebrow("墙上", "贴着的"),
              h("div", { className: "flex flex-wrap", style: { gap: 12, alignItems: "flex-start" } },
                // 合照：一张真照片，白边、歪着
                h("button", { key: "album", onClick: () => openSub("album"), className: "active:opacity-80",
                  style: { position: "relative", width: "44%", padding: 7, paddingBottom: 26, background: "#fff", border: "none", borderRadius: 3,
                    transform: "rotate(-2.2deg)", boxShadow: "0 12px 26px rgba(68,45,58,.20)" } },
                  h("div", { style: { position: "relative", width: "100%", paddingTop: "96%", overflow: "hidden", background: bPhotos.length ? "#20141f" : "#efece6" } },
                    h("div", { style: { position: "absolute", inset: 0 } },
                      bPhotos.length ? h(AlbumPhoto, { photo: bPhotos[0], cover: true }) : null)),
                  h("div", { style: { position: "absolute", left: 9, right: 9, bottom: 7, fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: "#8b8177", textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } },
                    bPhotos.length ? "合照 · " + bPhotos.length + " 张" : "还没有合照")),
                // 拍立得旁边：照相馆＝【冲出来的那一条胶片】（v62.41 她：「墙上这一堆还是很无聊」）。
                // 上一版是一个淡紫圆角框——搬去任何 app 都成立，所以它没长出来。
                // 旁边已经是拍立得了，照相馆就换它自己那样东西：三格片窗 + 上下两排齿孔。
                (function () {
                  const holes = k => h("div", { "aria-hidden": "true", key: k, className: "flex", style: { gap: 4, justifyContent: "space-between" } },
                    [0, 1, 2, 3, 4, 5, 6].map(i => h("span", { key: i, style: { width: 5, height: 3.5, borderRadius: 1, background: "rgba(226,216,238,.38)" } })));
                  return wall("studio", { w: "48%", grow: 1, tilt: 1.8, pad: 0, radius: 3, bg: "#efe9f4", border: "1px solid #ded2ea",
                    kids: h("div", null,
                      h("div", { style: { background: "#2b2437", padding: "5px 7px 6px" } },
                        holes("t"),
                        h("div", { className: "flex", style: { gap: 4, margin: "4px 0" } },
                          [0, 1, 2].map(i => h("div", { key: i, style: { flex: 1, height: 26, borderRadius: 1,
                            background: i === 0 && bShotsN ? "#6d5390" : "rgba(226,216,238,.13)",
                            border: "1px solid rgba(226,216,238,.16)" } }))),
                        holes("b")),
                      h("div", { style: { padding: "9px 11px 11px" } },
                        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10px * var(--app-fs, 1))", letterSpacing: ".14em", color: "#a692bd" } },
                          bShotsN > 1 ? "照相馆 · 拍过 " + bShotsN + " 张" : "照相馆"),
                        h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(14.5px * var(--app-fs, 1))", lineHeight: 1.5, color: "#6d5390", marginTop: 6 } },
                          bShotLast ? one(bShotLast.scene, 16) : "挑身衣服拍一张"))) });
                })(),
                // 票根：整宽一条，虚线横贯
                wall("firsts", { w: "100%", radius: 8, tilt: -0.5, pad: "14px 15px", bg: "#faf7f0", border: "1px solid #e6ddca",
                  // ⚠️虚线不能横穿：它会正好压在字上。真票根的撕线是【竖的】，
                  // 在存根那一头，两端各咬一个半圆缺口。
                  deco: h(Fragment, null,
                    // 真票根的撕线是【一排齿孔】，不是一条虚线（她 2026-09-04：「存根有点样子了但还不够」）
                    h("div", { "aria-hidden": "true", style: { position: "absolute", right: 71, top: 6, bottom: 6, width: 6,
                      display: "flex", flexDirection: "column", justifyContent: "space-around", alignItems: "center" } },
                      [0, 1, 2, 3, 4, 5].map(i => h("span", { key: i, style: { width: 3, height: 3, borderRadius: 999, background: "rgba(150,125,80,.45)" } }))),
                    h("div", { "aria-hidden": "true", style: { position: "absolute", right: 74, top: 6, bottom: 6, borderLeft: "1px dashed rgba(150,125,80,.4)" } }),
                    h("div", { "aria-hidden": "true", style: { position: "absolute", right: 69, top: -6, width: 11, height: 11, borderRadius: 999, background: t.bg } }),
                    h("div", { "aria-hidden": "true", style: { position: "absolute", right: 69, bottom: -6, width: 11, height: 11, borderRadius: 999, background: t.bg } })),
                  kids: h("div", { className: "flex items-center", style: { gap: 12, position: "relative" } },
                    h("div", { className: "flex-1 min-w-0" },
                      h("div", { style: { fontFamily: F_BODY, fontSize: "calc(9.5px * var(--app-fs, 1))", letterSpacing: ".16em", color: "#a89877" } }, "第一次"),
                      h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(15.5px * var(--app-fs, 1))", color: "#7d6f5a", marginTop: 5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } },
                        bFirstLast ? one(bFirstLast.zh || bFirstLast.title || bFirstLast.note, 18) : "还没走过第一次")),
                    h("div", { style: { width: 58, flexShrink: 0, textAlign: "center" } },
                      h("div", { style: { fontFamily: F_DISPLAY, fontStyle: "italic", fontSize: "calc(24px * var(--app-fs, 1))", lineHeight: 1, color: "#7d6f5a" } }, bFirstsN || 0),
                      h("div", { style: { fontFamily: F_BODY, fontSize: "calc(8.5px * var(--app-fs, 1))", letterSpacing: ".05em", color: "#a89877", marginTop: 3 } }, "存根"))) }),
                // 另一种我们（旧名如果馆）：墙上唯一一块深的。
                // ⚠️那个空心圆是【装饰】，换成任何图案都一样成立（v62.41 换掉）。
                //   这一格说的是「同样的我们，换掉当初的一样东西」——现实里那就是【一个岔路口】：
                //   走过的那条实线，没走的那条虚着散进暗处。这一整页本来就有路这套语言
                //  （我们的日子那条时光轴），所以它不是新发明的图案，是接着说的。
                wall("ifroom", { w: "100%", radius: 16, pad: "16px 16px 15px", bg: "linear-gradient(140deg,#241f36,#141222)", border: "1px solid #332c4a",
                  deco: h("svg", { "aria-hidden": "true", viewBox: "0 0 120 90", preserveAspectRatio: "none",
                    style: { position: "absolute", right: 0, top: 0, width: 128, height: "100%", opacity: .85 } },
                    h("path", { d: "M0 78 C34 78 44 62 60 46", fill: "none", stroke: "rgba(169,156,203,.5)", strokeWidth: 1.6, strokeLinecap: "round" }),
                    h("path", { d: "M60 46 C74 32 86 26 118 22", fill: "none", stroke: "rgba(169,156,203,.5)", strokeWidth: 1.6, strokeLinecap: "round" }),
                    h("path", { d: "M60 46 C76 48 92 56 118 70", fill: "none", stroke: "rgba(169,156,203,.42)", strokeWidth: 1.4, strokeDasharray: "3 5", strokeLinecap: "round" }),
                    h("circle", { cx: 60, cy: 46, r: 3.2, fill: "#a99ccb" })),
                  kids: h("div", { style: { position: "relative" } },
                    h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10px * var(--app-fs, 1))", letterSpacing: ".16em", color: "rgba(169,156,203,.66)" } }, "另一种我们"),
                    h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(17px * var(--app-fs, 1))", color: "#e0d6f5", lineHeight: 1.4, marginTop: 7 } },
                      bIfLast ? "「" + one(bIfLast.title, 14) + "」" : "同样的我们，换掉当初的一样东西"),
                    bIfLast ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: "rgba(200,188,230,.6)", marginTop: 5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, one(bIfLast.premise, 24)) : null) }),
                // 抽卡：一【叠】卡（v62.41）。原来是一张，跟旁边几块一样是个圆角方框；
                // 真正在墙上的是压着的那两张——底下露出来的边才让人一眼看出这是可以抽的。
                // ⚠️压在底下那两张不能用 z-index 往按钮背后塞：按钮自己的底色画在所有子元素
                //   下面，负 z-index 的子元素只会被它盖住，什么都看不见。所以这一格是
                //   【外面一个壳装三张】——底下两张先画、各转一点角度，最上面那张才是按钮。
                h("div", { key: "gacha", style: { position: "relative", width: "46%", minWidth: 0 } },
                  h("span", { "aria-hidden": "true", style: { position: "absolute", inset: 0, borderRadius: 10, background: "#eed9e8",
                    border: "1px solid #e2c7dc", transform: "rotate(3.4deg)" } }),
                  h("span", { "aria-hidden": "true", style: { position: "absolute", inset: 0, borderRadius: 10, background: "#f5e3f0",
                    border: "1px solid #e8d4e4", transform: "rotate(1.7deg)" } }),
                  h("button", { onClick: () => openSub("gacha"), className: "w-full text-left active:opacity-75",
                    style: { position: "relative", display: "block", borderRadius: 10, padding: "13px 13px 14px",
                      background: "linear-gradient(150deg,#fbf1f7,#f3e3ee)", border: "1px solid #e8d4e4",
                      boxShadow: "0 8px 20px rgba(68,45,58,.10)" } },
                    bGachaOpen > 0 ? h("span", { style: { position: "absolute", top: 9, right: 10, width: 7, height: 7, borderRadius: 999, background: "#e0524a" } }) : null,
                    h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10px * var(--app-fs, 1))", letterSpacing: ".14em", color: "#b78bad" } }, "抽卡"),
                    h("div", { className: "flex items-baseline", style: { gap: 4, marginTop: 7 } },
                      h("span", { style: { fontFamily: F_DISPLAY, fontSize: "calc(27px * var(--app-fs, 1))", lineHeight: 1, color: "#96678c" } }, bGachaPts || 0),
                      h("span", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: "#b78bad" } }, "点")),
                    h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: "#b78bad", marginTop: 5 } },
                      bGachaOpen ? bGachaOpen + " 张还没兑" : characterText(partner, "陪着他就有点数")))),
                // 抽屉：真拉开一条缝的那一格（v62.41）。
                // 上一版只有底下一条把手，别的还是个圆角方框。抽屉之所以是抽屉，
                // 靠的是【顶上那道暗缝】（里面是黑的）和【两侧的木边】——把手只是最后一笔。
                wall("drawer", { w: "46%", grow: 1, radius: "3px 3px 15px 15px", pad: "16px 15px 19px", bg: "linear-gradient(180deg,#f6eddb,#faf3e4 34%)", border: "1px solid #e2d2b0",
                  deco: h(Fragment, null,
                    h("span", { "aria-hidden": "true", style: { position: "absolute", left: 0, right: 0, top: 0, height: 5,
                      background: "linear-gradient(180deg,rgba(74,56,22,.42),rgba(74,56,22,0))" } }),
                    h("span", { "aria-hidden": "true", style: { position: "absolute", left: 0, top: 5, bottom: 0, width: 3, background: "rgba(150,122,66,.20)" } }),
                    h("span", { "aria-hidden": "true", style: { position: "absolute", right: 0, top: 5, bottom: 0, width: 3, background: "rgba(150,122,66,.20)" } }),
                    h("span", { "aria-hidden": "true", style: { position: "absolute", left: "50%", bottom: 8, width: 44, height: 5, marginLeft: -22, borderRadius: 99,
                      background: "linear-gradient(180deg,#b79c66,#8d7440)", boxShadow: "0 1px 0 rgba(255,255,255,.55)" } })),
                  kids: h("div", null,
                    h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10px * var(--app-fs, 1))", letterSpacing: ".14em", color: "#b09a68" } }, "抽屉"),
                    h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(15.5px * var(--app-fs, 1))", color: "#7a6338", marginTop: 8 } }, "拉开看看")) }),
                // 窗台（v62.33）：一条浅绿横卡，盆栽小图 + 长势。花是活的，每天进来长势微变
                (function () {
                  const g3 = (coupleGarden || {})[bCid] || {};
                  const st3 = (typeof GardenKit !== "undefined" && g3.species) ? GardenKit.stageOf(g3.fed) : null;
                  const keptN = Array.isArray(g3.kept) ? g3.kept.length : 0;
                  return wall("garden", { w: "47%", grow: 1, radius: 10, tilt: -0.4, pad: "10px 12px", bg: "#f2f6ec", border: "1px solid #dbe4cf",
                    kids: h("div", { className: "flex items-center", style: { gap: 12 } },
                      h(GardenPlant, { g: g3, size: 40 }),
                      h("div", { className: "flex-1 min-w-0" },
                        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10px * var(--app-fs, 1))", letterSpacing: ".14em", color: "#8a9a72" } }, "窗台"),
                        h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(14.5px * var(--app-fs, 1))", color: "#54663e", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } },
                          g3.species ? st3.zh + " · " + g3.species : keptN ? "盆空着 · 收过 " + keptN + " 枚干花" : "还空着一只盆"),
                        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: "#8a9a72", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } },
                          g3.species ? (g3.why ? "「" + one(g3.why, 24) + "」" : "它吃你们真实的相处") : "让 " + partner.name + " 挑一种来养"))) });
                })(),
                // 存钱罐（她 2026-10-10）：一只小玻璃罐，水位就是离目标还差多少，跟窗台并排（她 2026-10-10：「存钱罐跟花盆两个一排」）
                (function () {
                  const jj = ((coupleHome || {})[bCid] || {}).jar || {};
                  const jb = Number(jj.balance) || 0, jg = jj.goal, jl = jg && Number(jg.amount) > 0 ? Math.min(1, jb / Number(jg.amount)) : (jb > 0 ? 0.18 : 0);
                  return wall("jar", { w: "47%", grow: 1, radius: 14, tilt: 0.7, pad: "12px 13px", bg: "#eef5f4", border: "1px solid #d3e2e2",
                    kids: h("div", { className: "flex items-center", style: { gap: 10 } },
                      h("div", { "aria-hidden": "true", style: { position: "relative", width: 30, height: 38, flexShrink: 0 } },
                        h("div", { style: { position: "absolute", left: 7, right: 7, top: 0, height: 5, borderRadius: 2, background: "#b8935a" } }),
                        h("div", { style: { position: "absolute", left: 0, right: 0, top: 5, bottom: 0, borderRadius: "9px 9px 7px 7px", border: "1.5px solid rgba(110,140,150,.55)", background: "rgba(214,232,238,.6)", overflow: "hidden" } },
                          h("div", { style: { position: "absolute", left: 0, right: 0, bottom: 0, height: (jl * 100) + "%", background: "#e0b45c" } }))),
                      h("div", { className: "flex-1 min-w-0" },
                        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10px * var(--app-fs, 1))", letterSpacing: ".14em", color: "#7f9a9c" } }, "存钱罐"),
                        h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(15px * var(--app-fs, 1))", color: "#3e5458", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, jb ? (Math.round(jb * 100) / 100).toLocaleString("zh-CN") : "还空着"),
                        jg ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: "#7f9a9c", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, "「" + jg.name + "」") : null)) });
                })(),
                // 唱机:整宽一条——小唱片在转,是这面墙上唯一会动的东西
                (function () {
                  const dSongs = (((coupleDisc || {})[bCid] || {}).songs || []);
                  const dOn = String(discNowId || "").indexOf("sgd_") === 0 && discPlaying;
                  // 正在转的时候露的是【正在放的那首】和它 B 面的刻字（v62.11）——
                  // 那句本来就是说给她听的，落针的这一刻正该被看见；停着才退回最近刻的那首。
                  const dNow = dOn ? dSongs.find(s => s.id === discNowId) : null;
                  const dFace = dNow || dSongs[0];
                  return wall("disc", { w: "100%", radius: 14, tilt: 0.6, pad: "12px 14px", bg: "linear-gradient(140deg,#2c2732,#1d1a24)", border: "1px solid #3d3648",
                    kids: h("div", { className: "flex items-center", style: { gap: 13 } },
                      h("div", { "data-wk": "block", style: { position: "relative", width: 46, height: 46, flexShrink: 0, borderRadius: 999, background: "radial-gradient(circle at 50% 50%, #101014 0 30%, #2b2b30 31% 61%, #17171b 62%)", boxShadow: "0 6px 16px rgba(0,0,0,.4)", display: "flex", alignItems: "center", justifyContent: "center", animation: dOn ? "wk-spin 6s linear infinite" : "none" } },
                        dFace && dFace.cover ? h("img", { src: dFace.cover, style: { width: 22, height: 22, borderRadius: 999, objectFit: "cover" } }) : h("span", { "aria-hidden": "true", style: { width: 9, height: 9, borderRadius: 999, background: "#0d0d10", boxShadow: "0 0 0 3px rgba(230,223,242,.16)" } })),
                      h("div", { className: "flex-1 min-w-0" },
                        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(9.5px * var(--app-fs, 1))", letterSpacing: ".18em", color: "rgba(200,190,215,.55)" } }, "我们的唱片"),
                        h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(14.5px * var(--app-fs, 1))", color: "#e6dff2", marginTop: 5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } },
                          dOn ? (dNow ? "《" + dNow.title + "》正在转" : "唱片正在转") : dSongs.length ? "刻了 " + dSongs.length + " 首" : "还没刻歌"),
                        dFace && dFace.note ? h("div", { style: { fontFamily: F_DISPLAY, fontStyle: "italic", fontSize: "calc(10.5px * var(--app-fs, 1))", color: "rgba(200,190,215,.62)", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, "「" + one(dFace.note, 24) + "」") : null)) });
                })()),
              // ── ③ 收着的：一列书脊 ─────────────────────────────
              onSpaceHome ? h(SpaceDoor, { partner, home: (spaceHome || {})[bCid] || {}, busy: spaceHomeBusy, lit: lightLit || (() => false), carryNames: carryNamesOf ? carryNamesOf(bCid) : [],
                tone: window.spaceRel ? window.spaceRel(cp[bCid]).tone : "#a8505f", eyebrow, put: fn => onSpaceHome(bCid, fn), ta: kind => onSpaceHomeTa(bCid, kind) }) : null,
              eyebrow("收着的", "一本一本翻"),
              shelf([
                // 这层关系自己的几本（闺蜜：黑历史案卷、军师观察簿；挚友：人生选择册；家人：报平安簿）排在最前
                (window.spaceBooksFor ? window.spaceBooksFor(cp[bCid]) : []).map(bk => {
                  const l = ((spaceBooks || {})[bCid] || {})[bk.key] || [], last = l[0];
                  const open = bk.closeKind ? l.filter(e => !e.closed).length : 0;
                  return spine("book:" + bk.key, { zh: bk.zh.length > 4 ? bk.zh.slice(0, 4) : bk.zh, band: bk.band, dot: false,
                    say: last ? (open ? open + " 条还没收尾 · " : "") + one(last.title || last.body, 18) : bk.say });
                }),
                // ⚠️信这条记录的正文叫 body（title 可空）。跟底下「TA记得的」那行同一个病：
                //   原来读 content/text——两个都不存在，没标题的信在书脊上永远是空白。
                spine("letters", { zh: window.spaceRel ? window.spaceRel(cp[bCid]).letter : "情书", band: "#b08d52", dot: bUnread > 0,
                  say: bLetterLast ? one(bLetterLast.title || bLetterLast.body, 22) : "写给彼此" }),
                (function () {
                  const ex = (coupleExDiary || []).filter(e => e.characterId === bCid);
                  const last = ex[0];
                  const waiting = last && last.author === "user" && !last.replied;   // 字段叫 replied，不是 reply
                  return spine("exdiary", { zh: "交换日记", band: "#b08a66", dot: !!(last && last.author !== "user" && last.unread),
                    say: !ex.length ? "写下第一页" : waiting ? "本子在 TA 那边" : one((last && (last.title || last.content)) || "", 22) });
                })(),
                spine("qa", { zh: "问答小本", band: "#6a9a74", dot: !!bQaAsk,
                  say: bQaAsk ? "TA 出了道题等你答" : bQaLast ? one(bQaLast.question, 22) : "关于我们" }),
                // ⚠️这一行读的必须是【这条记录真有的字段】。原来写的是
                // title / topic / text——一个都不存在（这条记录是 {mine,his,note}），
                // 所以书脊上永远是空的，可红点又亮着：看着就像「一直是空的」。
                // 摆出来的该是【TA记得的那一版】，那才是这一格的内容。
                spine("recall", { zh: characterText(partner, "他记得的"), band: "#93707c",
                  dot: (coupleRecall || []).some(function (x) { return x.characterId === bCid && x.unread; }),
                  say: bRecallLast ? one(bRecallLast.his || bRecallLast.mine, 22) : "同一件事，两个人" }),
                spine("pacts", { zh: "说好的", band: "#8f7d5c",
                  dot: (function () { const p2 = couplePactsOf ? couplePactsOf(bCid) : null; return !!(p2 && (p2.due || []).some(function (x) { return x.dueTs && Date.now() >= x.dueTs - 86400000; })); })(),
                  say: bPactLast ? one(bPactLast.text || bPactLast.title, 22) : "还没说好什么" }),
                spine("capsule", { zh: "时光胶囊", band: "#7d7396", dot: bCapsuleDue > 0,
                  say: bCapsuleDue ? bCapsuleDue + " 封等你拆" : "写给以后的我们" })])
            );
})(),
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog, textAlign: "center", marginTop: 14 } }, "只属于你俩的私密层。"))),
      cpEdit && h(PageSheet, { onClose: () => setCpEdit(false), tall: true },
        h(Eyebrow, { style: { marginBottom: 16 } }, "自定义" + (window.spaceRel ? window.spaceRel(cp[partner.id]).space : "情侣空间")),
        onSetRel ? h("div", { "data-wk": "usrelbox", style: { marginBottom: 16 } },
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", color: t.ink, marginBottom: 8 } }, "你们是什么关系"),
          relRows(window.spaceRelKey ? window.spaceRelKey(cp[partner.id]) : "lover", (k, role) => onSetRel(partner.id, k, role), (cp[partner.id] || {}).role || ""),
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog, lineHeight: 1.6 } }, "开错了在这儿改就行，不用解除。改了以后 TA 下一句就照新的关系来，信、悄悄话、纪念日也跟着变；以前写过的不动。")) : null,
        imgRow("背景图", bgRef, "bg", !!cprof.bg),
        imgRow("我的头像", myAvRef, "myAvatar", !!cprof.myAvatar),
        imgRow("TA 的头像", chAvRef, "charAvatar", !!cprof.charAvatar),
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog, marginTop: 4, lineHeight: 1.6 } }, "这里的头像只用于情侣空间，不影响角色原本的头像。图片会自动压缩。"),
        h("div", { className: "flex items-center justify-between", style: { marginTop: 16, paddingTop: 12, borderTop: "1px solid " + t.line } },
          h("div", null,
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", color: t.ink } }, "内容底纸做成磨砂"),
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog, marginTop: 2 } }, "背景图透过来糊成一片颜色；配上透明度一起调")),
          h(Toggle, { on: usFrost, onChange: v => { setUsFrost(v); saveJSON("x_usFrost", v); } })),
        h("div", { style: { marginTop: 14 } },
          h("div", { className: "flex items-baseline justify-between" },
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", color: t.ink } }, "底纸透明度"),
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.fog } }, Math.round((1 - usPaperA) * 100) + "% 透")),
          h("input", { type: "range", min: 20, max: 100, step: 1, value: Math.round(usPaperA * 100),
            onChange: e => { const v = Number(e.target.value) / 100; setUsPaperA(v); saveJSON("x_usPaperA", v); },
            style: { width: "100%", marginTop: 8, accentColor: t.ink } }),
          h("div", { className: "flex justify-between", style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog, marginTop: 2 } },
            h("span", null, "更透"), h("span", null, "更实"))),
        h("input", { ref: bgRef, type: "file", accept: "image/*", onChange: e => { const f = e.target.files && e.target.files[0]; if (f) onSetCoupleImg(partner.id, "bg", f); e.target.value = ""; }, style: { display: "none" } }),
        h("input", { ref: myAvRef, type: "file", accept: "image/*", onChange: e => { const f = e.target.files && e.target.files[0]; if (f) onSetCoupleImg(partner.id, "myAvatar", f); e.target.value = ""; }, style: { display: "none" } }),
        h("input", { ref: chAvRef, type: "file", accept: "image/*", onChange: e => { const f = e.target.files && e.target.files[0]; if (f) onSetCoupleImg(partner.id, "charAvatar", f); e.target.value = ""; }, style: { display: "none" } })),
      pickSheet);
  }

  // —— 名册视图（默认，v60.55 重做）——
  // 她 2026-09-02：「这个界面也修一修，当时也是参考了别人的。不一定要这种一个框一个框，
  //                 显示的文字也不一定要这些。」
  // 原来是一框一框的卡：每张里都摆一遍【她自己的】头像、每张都写一遍「恋爱中」、
  // 「有新的情书」是个粉药丸、解除是个 💔 emoji。三样都犯规，而且信息全是重复的。
  //
  // 这一页真正的内容是：【好几段关系同时在走，各自走了多远】——那个对比才是她要看的。
  // 所以不画框，一段就是一条【走过来的路】：按 30 天钉一个刻度，满三个月的刻度高一截，
  // 末端那个实心点是今天。312 天就是十个刻度那么长，59 天就是短短两个——
  // 一眼看得出谁走得久。换个 app 这条线不成立（别处没有「同时好几段、各自多久」这回事）。
  const dayFmt = ts => { const d = new Date(ts); return (d.getMonth() + 1) + "月" + d.getDate() + "日"; };
  const maxDays = Math.max(1, ...entries.filter(x => x.st.status === "together").map(x => daysWith(x.st.since) || 0));
  const trail = n => {
    // 刻度：每 30 天一根；满 90 天那根高一截（三个月是真的会被记住的那种坎）
    const ticks = [];
    for (let d = 30; d <= n; d += 30) ticks.push({ at: d / maxDays, big: d % 90 === 0 });
    return h("div", { style: { position: "relative", height: 16, marginTop: 7 } },
      // 底下那条发丝：整页共用一个长度尺，短的那几段才看得出短
      h("div", { style: { position: "absolute", left: 0, right: 0, top: 7.5, height: 1, background: t.line } }),
      h("div", { "data-wk": "block", style: { position: "absolute", left: 0, top: 7, height: 2, width: (n / maxDays * 100) + "%", background: "#e08aa0", borderRadius: 2 } }),
      ticks.map((tk, i) => h("div", { key: i, style: { position: "absolute", left: (tk.at * 100) + "%",
        top: tk.big ? 3 : 5, width: 1, height: tk.big ? 10 : 6, background: "#e08aa0", opacity: tk.big ? 0.85 : 0.5 } })),
      h("div", { style: { position: "absolute", left: "calc(" + (n / maxDays * 100) + "% - 3px)", top: 5,
        width: 6, height: 6, borderRadius: 999, background: "#d16a86" } }));
  };
  return h("div", { "data-wk": "uspage", "data-part": "us", className: "h-full flex flex-col", style: cpSkin(t, "corridor") },
    // 紧凑标题栏（mobile-ui-layout 第 1 条）：原来那个 30px 大标题 + US/COUPLE 占掉小半屏
    // 列表里不全是恋人时，标题不叫「情侣」（她 2026-10-16 截图「这里还是显示情侣」）
    h(Head, { zh: entries.some(e => window.spaceRelKey && window.spaceRelKey(e.st) !== "lover") ? "我们的空间" : "情侣", sub: entries.length ? entries.length + " 段 · 最久的走了 " + maxDays + " 天" : "",
      bg: "transparent", noLine: true, onBack,
      right: characters.length > 0 ? h("button", { onClick: () => setPick(true), className: "active:opacity-50 flex items-center justify-center", style: { width: 34, height: 38 } }, h(IHeart, { size: 19, color: t.ink })) : null }),
    h("div", { className: "flex-1 min-h-0 overflow-y-auto px-6 pb-8" },
      entries.length === 0
        ? h("div", { className: "pt-8" },
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", lineHeight: 1.8, color: t.fog } }, "还没有情侣关系。点右上角 ♥ 选一位角色发送邀请——邀请会出现在你和 TA 的聊天里，TA 会依据关系与好感决定接不接受。"),
            characters.length > 0 && h("button", { onClick: () => setPick(true), className: "mt-4 active:opacity-70", style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.ink, borderBottom: "1.5px solid " + t.ink, paddingBottom: 2 } }, "♥ 发送情侣邀请"))
        : h(Fragment, null,
            entries.map((e, idx) => {
              const tog = e.st.status === "together";
              const n = tog ? (daysWith(e.st.since) || 0) : 0;
              const tags = tog ? unreadTagsFor(e.char.id) : [];
              return h("div", { key: e.char.id, "data-wk": "uscouple", "data-on": tog ? "1" : "0", "data-new": tags.length ? "1" : "0", className: "flex items-start", style: { gap: 13, padding: "16px 0",
                borderTop: idx === 0 ? "none" : "1px solid " + t.line, opacity: tog ? 1 : 0.6 } },
                // 她自己的头像原来每张卡里都摆一遍——她知道自己是谁，删掉
                h("div", { className: "shrink-0", style: { position: "relative" } },
                  h(Avatar, { character: e.char, size: 52, radius: 14 }),
                  // 有新情书＝头像上一个红点，跟聊天列表的未读同一套语汇，不是粉药丸
                  tags.length ? h("span", { style: { position: "absolute", top: -2, right: -2, width: 10, height: 10,
                    borderRadius: 999, background: "#e0524a", boxShadow: "0 0 0 2px " + t.bg } }) : null),
                h("button", { onClick: () => tog && setView(e.char.id), className: "flex-1 min-w-0 text-left active:opacity-75" },
                  h("div", { className: "flex items-baseline", style: { gap: 8 } },
                    h("div", { "data-wk": "usname", className: "truncate", style: { fontFamily: F_DISPLAY, fontSize: "calc(17px * var(--app-fs, 1))", color: t.ink } }, e.char.name),
                    // 不是恋人的那几行，名字边上一枚小火漆写着是什么空间
                    window.spaceRel && window.spaceRelKey(e.st) !== "lover" ? h("span", { "data-wk": "usrelchip", className: "shrink-0 flex items-center", style: { gap: 4, fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: window.spaceRel(e.st).tone } },
                      h("span", { style: { width: 15, height: 15, borderRadius: 999, background: window.spaceRel(e.st).tone, color: "#fff", fontSize: "calc(9px * var(--app-fs, 1))", display: "inline-flex", alignItems: "center", justifyContent: "center" } }, window.spaceRel(e.st).seal),
                      window.spaceRel(e.st).space) : null,
                    // 项目多了别把名字挤没：最多点两样，剩下的归成「等」
                    tags.length ? h("span", { className: "shrink-0", style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: "#c02a52" } }, "新的" + tags.slice(0, 2).join("、") + (tags.length > 2 ? "等" : "")) : null),
                  tog
                    ? h(Fragment, null,
                        h("div", { className: "flex items-baseline", style: { gap: 6, marginTop: 3 } },
                          h("span", { "data-wk": "uscount", style: { fontFamily: F_DISPLAY, fontSize: "calc(26px * var(--app-fs, 1))", lineHeight: 1, color: window.spaceRelKey && window.spaceRelKey(e.st) !== "lover" ? window.spaceRel(e.st).tone : "#d16a86" } }, String(n)),
                          h("span", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog } }, "天 · 从 " + dayFmt(e.st.since) + " 起")),
                        trail(n))
                    : h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.fog, marginTop: 4 } }, "邀请还没有回应")),
                tog && onUnlink ? h("button", { onClick: ev => { ev.stopPropagation(); setUnlinkChar(e.char); },
                  "aria-label": "解除" + (window.spaceRel ? window.spaceRel(e.st).space : "情侣关系"), className: "shrink-0 active:opacity-60 flex items-start justify-center",
                  style: { width: 34, height: 34, marginTop: -2 } }, h(CGlyph, { k: "heartbreak", size: 17, color: t.fog })) : null);
            }))),
    unlinkChar && onUnlink ? h(Sheet, { onClose: () => setUnlinkChar(null) },
      h(Eyebrow, { style: { marginBottom: 10 } }, "解除和 " + unlinkChar.name + " 的" + (window.spaceRel ? window.spaceRel(cp[unlinkChar.id]).space : "情侣关系")),
      h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", lineHeight: 1.7, color: t.fog, marginBottom: 14 } }, "情侣空间的记录会全部保留（复合后还在）。解除会降低好感。一周内想复合要写一封信，TA 读完自己决定；被退回来要过一天才能再写。你想怎么解除？"),
      h("button", { onClick: () => { onUnlink(unlinkChar, "sudden"); setUnlinkChar(null); }, className: "w-full text-left active:opacity-70", style: { background: t.bg2, border: "1px solid " + t.line, borderRadius: 14, padding: "13px 15px", marginBottom: 10 } },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(15px * var(--app-fs, 1))", color: t.ink } }, "直接解除"),
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.fog, marginTop: 2 } }, "毫无预兆 · TA 会错愕地主动问你 · 好感 −5")),
      h("button", { onClick: () => { onUnlink(unlinkChar, "fight"); setUnlinkChar(null); }, className: "w-full text-left active:opacity-70", style: { background: t.bg2, border: "1px solid " + t.line, borderRadius: 14, padding: "13px 15px", marginBottom: 10 } },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(15px * var(--app-fs, 1))", color: t.ink } }, "带着情绪解除"),
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.fog, marginTop: 2 } }, "吵架 / 闹别扭时 · 按近期聊天+人设+心情扣 5~10 好感 · TA 会有情绪地回应")),
      h("button", { onClick: () => setUnlinkChar(null), className: "w-full active:opacity-60", style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.fog, padding: "8px 0" } }, "算了，不解除")) : null,
    pickSheet);
}
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
  const readBundle = id => String((getBundle && getBundle(id)) || "（空）");
  const readRecall = id => typeof window !== "undefined" && window.MemoryRecallSnapshot ? window.MemoryRecallSnapshot.get(id) : null;
  const [cid, setCid] = useState(initialCid);
  const [text, setText] = useState(() => initialCid ? readBundle(initialCid) : "");
  const [recall, setRecall] = useState(() => initialCid ? readRecall(initialCid) : null);
  // 房间自己那份记忆的召回收据（ChatRooms.memRecall 只在真发出去的那一轮留）。跟主线那份分开放、分开画。
  const readRoomRecall = id => typeof window !== "undefined" && window.__roomRecallSnapshots ? window.__roomRecallSnapshots[String(id)] || null : null;
  const [roomRecall, setRoomRecall] = useState(() => initialCid ? readRoomRecall(initialCid) : null);
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
    setText(readBundle(id));
    setRecall(readRecall(id));
    setRoomRecall(readRoomRecall(id));
    setOpen({});
  };
  const secs = (() => {
    if (!cid || !text) return [];
    const raw = text.split(/\n(?=【)/).map((p, i) => {
      const m = p.match(/^【[^】]*】/);
      return { title: m ? m[0] : (i === 0 ? "【开头】" : "【段落 " + (i + 1) + "】"), body: p };
    });
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
  })();
  return h("div", { style: { marginTop: compact ? 2 : 10 } },
    h(Eyebrow, { style: { marginBottom: 8 } }, compact ? "本轮注入 · " + ((((characters || [])[0] || {}).remark) || (((characters || [])[0] || {}).name) || "当前角色") : "上下文透视"),
    h(React.Fragment, null,
    h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.fog, lineHeight: 1.7, marginBottom: 10 } }, compact ? "刚聊完就来这里看：上面是上一轮真正选中的记忆，下面是此刻重建的完整提示词预览。" : "看看此刻和 TA 聊天时，到底喂了什么给模型（人设 / 记忆 / 世界书 / 行程…按段拆开）。角色变笨、OOC、忘事时来这里排查是哪一段出了问题。"),
    h("div", { style: { border: "1px dashed " + t.line, borderRadius: 12, padding: "10px 12px", marginBottom: 12, background: t.bg2 } },
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
    cid ? (() => {
      // 每段占比 + 肥度条（v47.84 她要的「谁肥一眼看穿」）：≥20% 红、≥10% 金、其余灰
      const total = Math.max(1, text.length);
      const pctOf = s => Math.round(s.body.length / total * 100);
      const top3 = secs.slice().sort((a, b) => b.body.length - a.body.length).slice(0, 3).filter(s => s.body.length > 0);
      const barColor = p => p >= 20 ? "#c25a4a" : p >= 10 ? "#b89150" : t.line;
      return h("div", null,
        h("div", { className: "flex items-center justify-between", style: { marginBottom: 6 } },
          h("span", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog } }, secs.length + " 段 · 共 " + text.length + " 字 · 点标题展开"),
          h("button", { onClick: () => load(cid), className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.tint } }, "刷新")),
        top3.length ? h("div", { "data-wk": "block", style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.sub, lineHeight: 1.7, background: t.bg2, border: "1px solid " + t.line, borderRadius: 10, padding: "7px 11px", marginBottom: 10 } },
          "最肥三段：" + top3.map(s => s.title.replace(/[【】]/g, "") + " " + pctOf(s) + "%").join(" · ") + "——变笨先查它们") : null,
        secs.map((s, i) => {
          const pct = pctOf(s);
          return h("div", { key: i, style: { border: "1px solid " + t.line, borderRadius: 12, marginBottom: 8, overflow: "hidden" } },
            h("button", { onClick: () => setOpen(o => ({ ...o, [i]: !o[i] })), className: "w-full active:opacity-70", style: { padding: "9px 12px 7px", background: t.bg2, textAlign: "left", display: "block" } },
              h("div", { className: "flex items-center justify-between gap-2" },
                h("span", { style: { fontFamily: F_DISPLAY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.ink, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } },
                  s.title, s.inner ? h("span", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog, marginLeft: 7 } }, "含 " + s.inner + " 段") : null),
                h("span", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: pct >= 20 ? "#c25a4a" : t.fog, flexShrink: 0 } }, s.body.length + " 字 · " + pct + "% " + (open[i] ? "▾" : "▸"))),
              h("div", { style: { height: 3, borderRadius: 999, background: t.bg, marginTop: 6, overflow: "hidden" } },
                h("div", { style: { height: "100%", width: Math.max(2, pct) + "%", borderRadius: 999, background: barColor(pct) } }))),
            open[i] ? h("div", { style: { padding: "10px 12px", fontFamily: "monospace", fontSize: "calc(11px * var(--app-fs, 1))", lineHeight: 1.7, color: t.sub, whiteSpace: "pre-wrap", wordBreak: "break-all", maxHeight: 300, overflowY: "auto", background: t.bg } }, s.body) : null);
        }));
    })() : null));
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

// ═══ 抽卡（她 2026-08-31）═══
// 形状是她定的：**抽是抽，兑是兑**。抽卡永远 0 次调用——抽到的是一张兑换券，
// 点了兑换才真的发生。票根永不删（「票根永远留痕有时间戳是什么时候抽到的（r sr ssr都留）」）：
// 兑换只是给卡盖个戳，卡本身连同抽到的时间戳一直留在册子里。
// 整页，不用半窗（施工规则/no-half-sheet.md）。
const GACHA_SKIN = {
  R:   { zh: "R",   bg: "#f1f2f5", bd: "#dcdfe6", ink: "#6b7280", tag: "#8b93a1" },
  SR:  { zh: "SR",  bg: "#f4eefb", bd: "#e0d0f2", ink: "#7c5aa6", tag: "#9a78c4" },
  SSR: { zh: "SSR", bg: "linear-gradient(135deg,#fdf3df,#f8e7c4)", bd: "#e8cf9a", ink: "#9a7325", tag: "#c09a45" }
};
const gachaWhen = ts => {
  if (!ts) return "";
  const d = new Date(ts);
  const p = n => (n < 10 ? "0" : "") + n;
  return (d.getFullYear() + "").slice(2) + "." + p(d.getMonth() + 1) + "." + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes());
};
function GachaCard({ card, busy, onRedeem, onShow, onTitle, onShoot, onCarve, shooting, fresh, character, stackLeft, onDelete }) {
  const t = useTheme();
  const sk = GACHA_SKIN[card.r] || GACHA_SKIN.R;
  const done = !!card.redeemedTs;
  const res = card.result || {};
  // 券面来自应用卡池；兑换结果是角色原文，不经称呼替换。
  const template = window.GachaKit && window.GachaKit.byId && window.GachaKit.byId[card.poolId];
  const cardName = template ? characterText(character, template.name) : card.name;
  const cardHint = template ? characterText(character, template.hint) : card.hint;
  return h("div", {
    style: {
      borderRadius: 16, border: "1px solid " + sk.bd, background: sk.bg, padding: "12px 13px",
      boxShadow: fresh ? "0 0 0 2px " + sk.tag : "none", transition: "box-shadow .4s ease"
    }
  },
    h("div", { className: "flex items-center gap-2" },
      h("span", { style: { fontFamily: "'Archivo',sans-serif", fontWeight: 700, fontSize: "calc(10px * var(--app-fs, 1))", letterSpacing: ".1em", color: "#fff", background: sk.tag, borderRadius: 5, padding: "2px 6px" } }, sk.zh),
      h("div", { className: "flex-1 min-w-0", style: { fontFamily: F_DISPLAY, fontSize: "calc(15.5px * var(--app-fs, 1))", color: sk.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, cardName),
      // 同款叠着的时候，角上标一句「后面还有几张」——不然收起来看着像卡少了
      stackLeft ? h("span", { style: { fontFamily: F_BODY, fontSize: "calc(10px * var(--app-fs, 1))", color: "#fff", background: sk.tag, borderRadius: 999, padding: "2px 7px", flexShrink: 0 } }, "+" + stackLeft) : null,
      // 票根：什么时候抽到的。兑掉了也留着，这一行永远在
      h("span", { style: { fontFamily: "'Archivo',sans-serif", fontSize: "calc(9.5px * var(--app-fs, 1))", color: sk.tag, flexShrink: 0 } }, (card.byTa ? "TA 抽的 · " : "") + gachaWhen(card.ts))),
    done
      ? h("div", { style: { marginTop: 9 } },
          res.title ? h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(14px * var(--app-fs, 1))", color: t.ink } }, STX(res.title)) : null,
          // ⚠️相册那张 R 卡一直老老实实把 imageRef 取出来了，然后【从来没人画它】
          //   （Codex 2026-09-14 一眼看出来的）。一张照片奖励只给一行说明，等于没给。
          res.img ? h("img", { src: typeof phoneImage === "function" ? phoneImage(res.img) : res.img, alt: "",
            style: { display: "block", width: "100%", maxHeight: 300, objectFit: "cover", borderRadius: 12, marginTop: 7 } }) : null,
          res.body ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", lineHeight: 1.7, color: t.sub, marginTop: 3, whiteSpace: "pre-wrap" } }, STX(res.body)) : null,
          // 幕后评论音轨：跟正文分开摆。它俩是【场里的他】和【场外的他】，
          // 混成一段就把这张券最好玩的那层落差抹平了。
          res.track ? h("div", { style: { marginTop: 8, borderLeft: "2px solid " + sk.tag, paddingLeft: 9 } },
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10px * var(--app-fs, 1))", color: sk.tag } }, "幕后"),
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", lineHeight: 1.7, color: t.sub, marginTop: 2, whiteSpace: "pre-wrap" } }, res.track)) : null,
          // 掉马券：兑完故事还没结束——这一下把东西摆到TA面前（走翻手机那条现成的链）
          // 秘密筹备到日子了：第二枪由她按，绝不在后台背着她打
          // 合照券：兑出来的是【他想拍的那一张】，真画不真画由她再按一下。
          // ⚠️没配图像 API / 少一张参考照时也照样摆着——这张券的文字那半本来就完整。
          res.where === "duo" && res.scene ? h("div", { style: { marginTop: 9 } },
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", lineHeight: 1.7, color: t.sub, whiteSpace: "pre-wrap",
              borderLeft: "2px solid " + sk.tag, paddingLeft: 9 } }, res.scene),
            onShoot ? h("button", { onClick: () => onShoot(card), disabled: !!shooting, className: "active:opacity-60",
              style: { marginTop: 9, fontFamily: F_DISPLAY, fontSize: "calc(12.5px * var(--app-fs, 1))", padding: "6px 14px", borderRadius: 999,
                background: shooting ? t.line : sk.ink, color: shooting ? t.fog : "#fff" } },
              shooting ? "在拍了…" : "真拍出来") : null,
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10px * var(--app-fs, 1))", color: t.fog, marginTop: 6, lineHeight: 1.6 } },
              "真拍要用一次图像生成，而且你俩都得设了参考照——照相馆那条链会自己把关。")) : null,
          // 称呼那张：抽出来只是候选，三个口子都在这儿。没点「收下」之前它不进提示词。
          res.where === "title" && res.pending ? h("div", { style: { marginTop: 9 } },
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: sk.tag, marginBottom: 6, lineHeight: 1.6 } },
              characterText(character, "收下之后他往后真的会这么叫你。「换一个」要再花一次调用。")),
            h("div", { className: "flex items-center", style: { gap: 7, flexWrap: "wrap" } },
              h("button", { onClick: () => onTitle && onTitle(card, "take"), disabled: !!busy, className: "active:opacity-60",
                style: { fontFamily: F_DISPLAY, fontSize: "calc(12.5px * var(--app-fs, 1))", padding: "6px 14px", borderRadius: 999, background: sk.ink, color: "#fff" } }, "收下"),
              h("button", { onClick: () => onRedeem({ ...card, act: "titleAgain" }), disabled: !!busy, className: "active:opacity-60",
                style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", padding: "6px 12px", borderRadius: 999, border: "1px solid " + sk.bd, color: sk.tag } },
                busy === card.id ? "重想中…" : "换一个"),
              h("button", { onClick: () => requestAppPrompt("自己改一个", "他起的那个不顺耳的话，你自己定。", String(res.title || ""),
                  v => { const t0 = String(v || "").trim(); if (t0) onTitle && onTitle(card, "edit", t0); }, "就这个", { maxLength: 12 }),
                className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.fog, padding: "6px 6px" } }, "自己改"),
              h("button", { onClick: () => onTitle && onTitle(card, "drop"), className: "active:opacity-60",
                style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.fog, padding: "6px 6px" } }, "不要"))) : null,
          // 收下之后仍然能反悔——「随时能改能删」那一条要真的随时
          res.where === "title" && res.taken ? h("button", { onClick: () => onTitle && onTitle(card, "drop"),
            className: "active:opacity-60", style: { marginTop: 8, fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.fog } }, "不用这个称呼了") : null,
          // 盒子打开之后，两样东西才第一次同时摆出来（在那之前卡面上一个字都不露）
          res.where === "box" && res.opened ? h("div", { style: { marginTop: 9, display: "flex", flexDirection: "column", gap: 7 } },
            [[characterText(character, "他放的"), String((res.his || {}).title || "") + (res.his && res.his.body ? "｜" + res.his.body : "")],
             ["你放的", String(res.mine || "")]].filter(x => x[1]).map(([zh, tx]) =>
              h("div", { "data-wk": "block", key: zh, style: { borderRadius: 11, background: t.bg, border: "1px solid " + t.line, padding: "8px 10px" } },
                h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10px * var(--app-fs, 1))", color: sk.tag } }, zh),
                h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", lineHeight: 1.7, color: t.sub, marginTop: 2, whiteSpace: "pre-wrap" } }, tx)))) : null,
          res.where === "box" && res.ready ? h("button", {
            onClick: () => onRedeem({ ...card, act: "boxOpen" }), disabled: !!busy, className: "active:opacity-60",
            style: { marginTop: 9, fontFamily: F_DISPLAY, fontSize: "calc(12.5px * var(--app-fs, 1))", padding: "6px 14px", borderRadius: 999, background: busy === card.id ? t.line : sk.ink, color: busy === card.id ? t.fog : "#fff" }
          }, busy === card.id ? "打开中…" : "到日子了 · 一起打开") : null,
          res.where === "plan" && res.ready ? h("button", {
            onClick: () => onRedeem({ ...card, act: "planOpen" }), disabled: !!busy, className: "active:opacity-60",
            style: { marginTop: 9, fontFamily: F_DISPLAY, fontSize: "calc(12.5px * var(--app-fs, 1))", padding: "6px 14px", borderRadius: 999, background: busy === card.id ? t.line : sk.ink, color: busy === card.id ? t.fog : "#fff" }
          }, busy === card.id ? "拆开中…" : "到日子了 · 拆开") : null,
          res.where === "drop" && onShow ? h("button", {
            onClick: () => onShow(card), className: "active:opacity-60",
            style: { marginTop: 9, fontFamily: F_DISPLAY, fontSize: "calc(12.5px * var(--app-fs, 1))", padding: "6px 14px", borderRadius: 999, background: sk.ink, color: "#fff" }
          }, characterText(character, "摆到他面前问问")) : null,
          // 点歌那张券：刻进你俩的唱片（她 2026-09-18：「点歌也没接网易云，应该要可以刻到情侣空间唱片」）。
          // ⚠️刻过了就不再给按钮，改成一行小字——同一首刻两遍，唱片架上会去重，
          //   按钮却还亮着，看着像没生效。
          res.song && !res.carved && onCarve ? h("button", {
            onClick: () => onCarve(card), disabled: !!busy, className: "active:opacity-60",
            style: { marginTop: 9, marginRight: 7, fontFamily: F_DISPLAY, fontSize: "calc(12.5px * var(--app-fs, 1))", padding: "6px 14px", borderRadius: 999,
              background: busy === card.id ? t.line : sk.ink, color: busy === card.id ? t.fog : "#fff" }
          }, busy === card.id ? "刻着…" : "刻进我们的唱片") : null,
          res.carved ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: sk.tag, marginTop: 8 } },
            "已刻进你俩的唱片 · " + res.carved.title + (res.carved.artist ? " · " + res.carved.artist : "")) : null,
          // 拿去跟他说（她 2026-09-18：「用了这些券之后没办法发到他聊天啊」）。
          // ⚠️原来只有掉马券那一张有出口，别的券兑完就停在这张卡片上，角色完全不知道
          //   发生过——尤其双面券最怪：券是他给的，他却不认。
          // ⚠️只在【真有正文可说】的时候出现：没有正文还摆一颗按钮，点下去发出去的是空话。
          //   有些券本来就落在别处（进了记忆库／线下开了／情书），那几张也照样给——
          //   「落了档」和「现在就想跟他说这个」是两件事。
          res.where !== "drop" && onShow && (res.title || res.body || res.track || res.scene) ? h("button", {
            onClick: () => onShow(card), className: "active:opacity-60",
            style: { marginTop: 9, fontFamily: F_DISPLAY, fontSize: "calc(12.5px * var(--app-fs, 1))", padding: "6px 14px", borderRadius: 999,
              border: "1px solid " + sk.bd, background: "transparent", color: sk.ink }
          }, characterText(character, "拿去跟他说")) : null,
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(9.5px * var(--app-fs, 1))", color: sk.tag, marginTop: 7 } },
            "已兑 " + gachaWhen(card.redeemedTs)
            + (res.where === "memlib" ? characterText(character, " · 已进记忆库，以后他会提起") : res.where === "pacts" ? " · 已进「我们说好的」" : res.where === "offline" ? " · 线下已经开了" : res.where === "date" ? " · 这张券已经用掉了，线下开了" : res.where === "letters" ? " · 已进情书" : res.where === "gaze" ? " · 印象卡已改，旧版进了修订史"
            // ⚠️种子这一行要【说实话】：后台不跑代码，它不是半夜自己到的，
            //   是到点之后她打开 App 的那一下才落地的（施工规则/phone-data-layers.md）。
            : res.where === "seed" ? (res.arrived ? characterText(character, " · 已经送到他手里了")
              : " · 还在路上" + (res.dueTs ? "，约 " + Math.max(1, Math.ceil((res.dueTs - Date.now()) / 86400000)) + " 天后到" : "") + "（下次打开就看得到）")
            : res.where === "drop" ? " · 这东西还没给你看过"
            : res.where === "dual" ? (res.side === "tease" ? " · 你挑了皮的那一面" : " · 你挑了甜的那一面")
            : res.where === "flow" ? " · 只这一次看得到"
            : res.where === "replay" ? " · 这一幕是你俩真的有过的"
            : res.where === "truth" ? " · 这道题他得正面答"
            : res.where === "duo" ? characterText(character, " · 他想拍的那一张")
            : res.where === "title" ? (res.taken ? characterText(character, " · 他往后会这么叫你")
              : res.pending ? " · 还没定，你说了算" : " · 你没要这个")
            : res.where === "pocket" ? characterText(character, " · 已经放进你俩的抽屉，封着")
            : res.where === "box" ? (res.opened ? " · 已经一起打开了" : res.ready ? " · 到日子了，可以开了"
              : " · 封着" + (res.dueTs ? "，约 " + Math.max(1, Math.ceil((res.dueTs - Date.now()) / 86400000)) + " 天后" : "") + "（下次打开就看得到）")
            // ⚠️同上：不许假装它是那天自己弹出来的——到点之后她打开 App 才解得开
            : res.where === "plan" ? (res.opened ? " · 已经拆开了，线下开了" : res.ready ? " · 到日子了，可以拆了"
              : " · 还没到日子" + (res.dueTs ? "，约 " + Math.max(1, Math.ceil((res.dueTs - Date.now()) / 86400000)) + " 天后" : "") + "（下次打开就看得到）")
            : "")))
      : h("div", { className: "flex items-end justify-between gap-3", style: { marginTop: 8 } },
          h("div", { className: "flex-1 min-w-0", style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", lineHeight: 1.6, color: sk.tag } }, cardHint),
          // 双面券：两个口子，选了就定了（她 2026-09-14「两种都放」——甜的留着，皮的抽到就想去闹）
          // 秘密筹备：你只说出门还是在家，别的TA自己安排
          // 秘密盒：先问她往里面放什么，拿到了才去问TA（TA那一枪不知道她放了什么）
          // 真心话：题目是她出的，先问了才去花那一枪
          card.act === "truth"
            ? h("button", { onClick: () => requestAppPrompt("你想问他什么？",
                "这一张他必须正面答，不许打太极。问一个你平时不太好意思问的。",
                "", v => { const q = String(v || "").trim(); if (q) onRedeem({ ...card, q: q }); }, "问他", { multiline: true, maxLength: 120 }),
                disabled: !!busy, className: "active:opacity-60 shrink-0",
                style: { fontFamily: F_DISPLAY, fontSize: "calc(13px * var(--app-fs, 1))", padding: "6px 15px", borderRadius: 999, background: busy === card.id ? t.line : sk.ink, color: busy === card.id ? t.fog : "#fff" } },
                busy === card.id ? "问了…" : "出一道题")
          : card.act === "box"
            ? h("button", { onClick: () => requestAppPrompt("你往盒子里放什么？",
                "一句话就行：一样东西、一句没说过的话、一件想让TA知道的事。放进去就封上了，到日子才打得开。",
                "", v => { const t0 = String(v || "").trim(); if (!t0) return; onRedeem({ ...card, mine: t0 }); }, "放进去", { multiline: true, maxLength: 200 }),
                disabled: !!busy, className: "active:opacity-60 shrink-0",
                style: { fontFamily: F_DISPLAY, fontSize: "calc(13px * var(--app-fs, 1))", padding: "6px 15px", borderRadius: 999, background: busy === card.id ? t.line : sk.ink, color: busy === card.id ? t.fog : "#fff" } },
                busy === card.id ? "放进去…" : "放一样进去")
          : card.act === "plan"
            ? h("div", { className: "flex gap-2 shrink-0" }, ["out", "home"].map(side => h("button", {
                key: side, onClick: () => onRedeem({ ...card, side: side }), disabled: !!busy, className: "active:opacity-60",
                style: { fontFamily: F_DISPLAY, fontSize: "calc(12.5px * var(--app-fs, 1))", padding: "6px 13px", borderRadius: 999, background: busy === card.id ? t.line : sk.ink, color: busy === card.id ? t.fog : "#fff" }
              }, busy === card.id ? "…" : side === "out" ? "那天出门" : "那天在家")))
          : card.act === "dual"
            ? h("div", { className: "flex gap-2 shrink-0" }, ["sweet", "tease"].map(side => h("button", {
                key: side, onClick: () => onRedeem({ ...card, side: side }), disabled: !!busy, className: "active:opacity-60",
                style: { fontFamily: F_DISPLAY, fontSize: "calc(12.5px * var(--app-fs, 1))", padding: "6px 13px", borderRadius: 999, background: busy === card.id ? t.line : sk.ink, color: busy === card.id ? t.fog : "#fff" }
              }, busy === card.id ? "…" : side === "sweet" ? "甜的" : "皮的")))
            : h("button", { onClick: () => onRedeem(card), disabled: !!busy, className: "active:opacity-60 shrink-0", style: { fontFamily: F_DISPLAY, fontSize: "calc(13px * var(--app-fs, 1))", padding: "6px 15px", borderRadius: 999, background: busy === card.id ? t.line : sk.ink, color: busy === card.id ? t.fog : "#fff" } },
              busy === card.id ? "兑换中…" : card.r === "R" ? "翻开" : "兑换")),
    // 撕掉这一张（她 2026-09-29 转来的：「抽卡那个兑换了的不能删吗」）。
    // ⚠️加在卡自己身上：券夹和纪念册走的是同一个组件，两处各画一颗就是同一件事写两遍。
    // ⚠️不抢眼——小字、靠右、和「兑换」拉开距离，省得手滑；真删走确认弹窗。
    onDelete ? h("div", { className: "flex justify-end", style: { marginTop: 6 } },
      h("button", { onClick: () => onDelete(card), className: "active:opacity-50",
        style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog, background: "transparent", border: "none", padding: "4px 2px" } }, "撕掉")) : null);
}
// ═══ 扭蛋机（她 2026-09-14：「ui 能不能也做好看高级点的扭蛋机可以互动的，
//     扭的时候里面东西会动有出货动画，参考图上但是画我们之间的形状」）═══
//
// ⚠️蛋里装的不是寿司，是**你们之间的形状**：一张照片、一句没说出口的话、一首歌、
//   一件他带在身上的、一封信、一张还在路上的票……全是这副奖池里真有的东西。
//   参考图给的是【机器的样子】，不是内容——内容照抄就成了别人家的机器。
// ⚠️动画只演【已经定好的结果】：抽本来就是 0 调用、纯本地掷的，所以先转再算和
//   先算再转对她没有任何区别；这儿选的是【转完才把卡摆出来】，那一下才有「出货」。
const GACHA_SHAPES = [
  // 每一枚蛋里那个小形状，对应奖池里真有的那几样东西
  { k: "photo", c: "#e8b6c4" },   // 相册里的一张
  { k: "note",  c: "#d8c9a8" },   // 一张便签
  { k: "song",  c: "#b8c6e0" },   // 想放给你听的
  { k: "heart", c: "#e2a0a8" },   // 还记得的一件事
  { k: "book",  c: "#c3cfae" },   // 书架上的一本
  { k: "mail",  c: "#e3cbb0" },   // 写给你的一封信
  { k: "tick",  c: "#c9b4d8" },   // 一张约会券
  { k: "eye",   c: "#a9c3c9" },   // 他眼里的你
  { k: "box",   c: "#d6b9a0" },   // 还在路上的那件
  { k: "ring",  c: "#e6c9a0" },   // 说好的那件
  { k: "star",  c: "#cbd6ea" }    // 没点开的那些
];
// 一枚蛋：外壳半透明，里头那个小形状。cx/cy 是蛋心，r 是蛋的半径。
function gachaCapsule(s, cx, cy, r, key, extra) {
  const g = s.k, c = s.c, u = r * 0.46;
  const inner = g === "photo" ? h("g", null,
      h("rect", { x: cx - u, y: cy - u * 0.78, width: u * 2, height: u * 1.56, rx: 2.4, fill: c }),
      h("path", { d: "M" + (cx - u * 0.72) + " " + (cy + u * 0.5) + " L" + cx + " " + (cy - u * 0.24) + " L" + (cx + u * 0.72) + " " + (cy + u * 0.5) + " Z", fill: "#fff", opacity: .72 }))
    : g === "note" ? h("path", { d: "M" + (cx - u * 0.8) + " " + (cy - u) + " h" + (u * 1.6) + " v" + (u * 1.4) + " l" + (-u * 0.6) + " " + (u * 0.6) + " h" + (-u) + " Z", fill: c })
    : g === "song" ? h("g", null,
      h("circle", { cx: cx - u * 0.35, cy: cy + u * 0.6, r: u * 0.5, fill: c }),
      h("rect", { x: cx + u * 0.05, y: cy - u, width: u * 0.28, height: u * 1.7, rx: .6, fill: c }),
      h("path", { d: "M" + (cx + u * 0.3) + " " + (cy - u) + " q" + (u * 0.7) + " " + (u * 0.18) + " " + (u * 0.7) + " " + (u * 0.6), stroke: c, strokeWidth: u * 0.3, fill: "none", strokeLinecap: "round" }))
    : g === "heart" ? h("path", { d: "M" + cx + " " + (cy + u * 0.85) + " C" + (cx - u * 1.5) + " " + (cy - u * 0.15) + " " + (cx - u * 0.55) + " " + (cy - u * 1.15) + " " + cx + " " + (cy - u * 0.3) + " C" + (cx + u * 0.55) + " " + (cy - u * 1.15) + " " + (cx + u * 1.5) + " " + (cy - u * 0.15) + " " + cx + " " + (cy + u * 0.85) + " Z", fill: c })
    : g === "book" ? h("g", null,
      h("rect", { x: cx - u * 0.9, y: cy - u * 0.85, width: u * 1.8, height: u * 1.7, rx: 2, fill: c }),
      h("rect", { x: cx - u * 0.15, y: cy - u * 0.85, width: u * 0.3, height: u * 1.7, fill: "#fff", opacity: .6 }))
    : g === "mail" ? h("g", null,
      h("rect", { x: cx - u, y: cy - u * 0.7, width: u * 2, height: u * 1.4, rx: 1.8, fill: c }),
      h("path", { d: "M" + (cx - u) + " " + (cy - u * 0.7) + " L" + cx + " " + (cy + u * 0.16) + " L" + (cx + u) + " " + (cy - u * 0.7), stroke: "#fff", strokeWidth: u * 0.24, fill: "none", opacity: .8 }))
    : g === "tick" ? h("g", null,
      h("rect", { x: cx - u, y: cy - u * 0.62, width: u * 2, height: u * 1.24, rx: 2.2, fill: c }),
      h("circle", { cx: cx, cy: cy - u * 0.62, r: u * 0.24, fill: "#fff", opacity: .85 }),
      h("circle", { cx: cx, cy: cy + u * 0.62, r: u * 0.24, fill: "#fff", opacity: .85 }))
    : g === "eye" ? h("g", null,
      h("path", { d: "M" + (cx - u) + " " + cy + " q" + u + " " + (-u * 0.95) + " " + (u * 2) + " 0 q" + (-u) + " " + (u * 0.95) + " " + (-u * 2) + " 0 Z", fill: c }),
      h("circle", { cx: cx, cy: cy, r: u * 0.34, fill: "#fff", opacity: .85 }))
    : g === "box" ? h("g", null,
      h("rect", { x: cx - u * 0.9, y: cy - u * 0.8, width: u * 1.8, height: u * 1.6, rx: 2, fill: c }),
      h("rect", { x: cx - u * 0.16, y: cy - u * 0.8, width: u * 0.32, height: u * 1.6, fill: "#fff", opacity: .62 }),
      h("rect", { x: cx - u * 0.9, y: cy - u * 0.16, width: u * 1.8, height: u * 0.32, fill: "#fff", opacity: .62 }))
    : g === "ring" ? h("g", null,
      h("circle", { cx: cx, cy: cy + u * 0.2, r: u * 0.72, fill: "none", stroke: c, strokeWidth: u * 0.34 }),
      h("path", { d: "M" + cx + " " + (cy - u * 0.95) + " l" + (u * 0.34) + " " + (u * 0.4) + " l" + (-u * 0.34) + " " + (u * 0.36) + " l" + (-u * 0.34) + " " + (-u * 0.36) + " Z", fill: c }))
    : h("path", { d: "M" + cx + " " + (cy - u) + " l" + (u * 0.3) + " " + (u * 0.66) + " l" + (u * 0.72) + " " + (u * 0.1)
        + " l" + (-u * 0.52) + " " + (u * 0.52) + " l" + (u * 0.13) + " " + (u * 0.72) + " l" + (-u * 0.63) + " " + (-u * 0.35)
        + " l" + (-u * 0.63) + " " + (u * 0.35) + " l" + (u * 0.13) + " " + (-u * 0.72) + " l" + (-u * 0.52) + " " + (-u * 0.52)
        + " l" + (u * 0.72) + " " + (-u * 0.1) + " Z", fill: c });
  return h("g", Object.assign({ key: key }, extra || {}),
    h("circle", { cx: cx, cy: cy, r: r, fill: "rgba(255,255,255,.34)", stroke: "rgba(255,255,255,.9)", strokeWidth: 1.1 }),
    h("circle", { cx: cx, cy: cy, r: r, fill: "url(#gm-glass)" }),
    inner,
    // 蛋壳上那一点高光——没有它就是一个平圆片
    h("ellipse", { cx: cx - r * 0.34, cy: cy - r * 0.42, rx: r * 0.3, ry: r * 0.19, fill: "#fff", opacity: .78, transform: "rotate(-24 " + (cx - r * 0.34) + " " + (cy - r * 0.42) + ")" }));
}

// 玻璃罩里那一堆蛋的位置（viewBox 240×326）。手摆的，不是网格——
// 整整齐齐排成格子的是货架，不是扭蛋机。
const GACHA_BALLS = [
  // 手摆的，不是网格：蛋是**堆在罐底**的，彼此压着、大小不一。
  // 排成整整齐齐的格子那是货架，不是扭蛋机（第一版就是这么画的，一眼假）。
  [58, 150, 23], [101, 154, 25], [146, 150, 24], [186, 152, 21],
  [74, 110, 24], [119, 113, 26], [163, 110, 23], [42, 122, 18],
  [63, 71, 21], [108, 66, 23], [152, 70, 22], [188, 76, 19]
];
// 三步：**选这次抽多少 → 一张点数卡滑进投币口 → 扳拉杆才真的转**
// （她 2026-09-14：「不然现在这俩还是摆设」——投币口和拉杆原来只是画上去的）。
// ⚠️点数在【真的转完】那一刻才扣（onPull 在动画末尾才调）：选了还没扳的时候反悔、
//   或者中途退出这一页，一点都不该少。
function GachaMachine({ have, costOne, costTen, armed, armSeq, spin, onArm, onSpin, partner }) {
  const dim = n => have < n;
  const ready = !!armed && !spin;
  return h("div", { style: { display: "flex", flexDirection: "column", alignItems: "center" } },
    h("style", null,
      // 摇：整罐蛋一起晃，每一枚再各自错开一点相位，不然像一整块在动
      "@keyframes gm-shake{0%,100%{transform:translate(0,0) rotate(0)}"
      + "15%{transform:translate(-1.8px,1.2px) rotate(-3deg)}35%{transform:translate(2px,-1px) rotate(2.6deg)}"
      + "55%{transform:translate(-1.4px,-1.6px) rotate(-2deg)}78%{transform:translate(1.6px,1.4px) rotate(1.8deg)}}"
      // 拉杆：转一圈，中间顿一下（真机就是这个手感）
      + "@keyframes gm-lever{0%{transform:rotate(0)}45%{transform:rotate(168deg)}62%{transform:rotate(182deg)}100%{transform:rotate(360deg)}}"
      // 出货：从罐底滚下来，掉进取物口那个圆洞，落底再弹一下
      + "@keyframes gm-drop{0%{opacity:0;transform:translate(0,0) scale(.72)}"
      + "14%{opacity:1;transform:translate(4px,16px) scale(.92)}"
      + "44%{transform:translate(26px,74px) scale(1)}"
      + "70%{transform:translate(51px,124px) scale(1)}"
      + "82%{transform:translate(51px,114px) scale(1.05)}"
      + "100%{transform:translate(51px,122px) scale(1)}}"
      + "@keyframes gm-glow{0%,58%{opacity:0}72%{opacity:.9}100%{opacity:.4}}"
      // 投点数：一张小卡片从上面滑下来，插进投币口那道缝里，越插越窄，最后没进去
      + "@keyframes gm-coin{0%{opacity:0;transform:translate(0,-26px) rotate(-8deg) scaleY(1)}"
      + "22%{opacity:1;transform:translate(0,-12px) rotate(-3deg) scaleY(1)}"
      + "62%{opacity:1;transform:translate(0,-1px) rotate(0) scaleY(1)}"
      + "100%{opacity:.15;transform:translate(0,7px) rotate(0) scaleY(.06)}}"
      // 投完了：拉杆自己轻轻点两下，告诉她该扳的是这儿
      + "@keyframes gm-wait{0%,100%{transform:rotate(0)}40%{transform:rotate(11deg)}70%{transform:rotate(-5deg)}}"
      + "@keyframes gm-halo{0%,100%{opacity:.3;transform:scale(1)}50%{opacity:.85;transform:scale(1.14)}}"),
    h("svg", { viewBox: "0 0 240 330", width: "100%", style: { maxWidth: 272, display: "block" }, "aria-hidden": "true" },
      h("defs", null,
        h("linearGradient", { id: "gm-body", x1: "0", y1: "0", x2: ".35", y2: "1" },
          h("stop", { offset: "0", stopColor: "#fffafb" }), h("stop", { offset: ".55", stopColor: "#f7ecf1" }), h("stop", { offset: "1", stopColor: "#e8d6e0" })),
        // 蛋壳：左上亮、右下几乎透明——这一道是「玻璃球」和「白圆片」的全部区别
        h("linearGradient", { id: "gm-glass", x1: ".15", y1: "0", x2: ".8", y2: "1" },
          h("stop", { offset: "0", stopColor: "#fff", stopOpacity: ".82" }), h("stop", { offset: ".5", stopColor: "#fff", stopOpacity: ".26" }), h("stop", { offset: "1", stopColor: "#cfd9e6", stopOpacity: ".3" })),
        h("linearGradient", { id: "gm-case", x1: "0", y1: "0", x2: ".25", y2: "1" },
          h("stop", { offset: "0", stopColor: "#ffffff", stopOpacity: ".62" }), h("stop", { offset: "1", stopColor: "#dbe6ef", stopOpacity: ".42" })),
        // ⚠️洞口是【凹进去的口】，不是一颗深色球：上浅下深、底下压一道暗边。
        //   第一版用的是球心亮的径向渐变，画出来就是一颗紫褐色的球，整台机器最脏的一块。
        // ⚠️洞要【上暗下亮】。画反了就是一颗球：光从上面进来、亮面在顶上、
        //   再描一道白圈，人眼读出来的一定是个球体（前两版都栽在这儿）。
        //   真正的凹口是顶上最暗（被自己的边压着），底下反而有一点回光。
        h("linearGradient", { id: "gm-hole", x1: "0", y1: "0", x2: "0", y2: "1" },
          h("stop", { offset: "0", stopColor: "#7d6474" }), h("stop", { offset: ".62", stopColor: "#9d8494" }), h("stop", { offset: "1", stopColor: "#c0a8b6" })),
        h("clipPath", { id: "gm-clip" }, h("rect", { x: 28, y: 36, width: 184, height: 146, rx: 18 }))),
      // 机身
      h("rect", { x: 10, y: 8, width: 220, height: 314, rx: 32, fill: "url(#gm-body)", stroke: "#e2ccd7", strokeWidth: 1.4 }),
      h("rect", { x: 19, y: 17, width: 202, height: 296, rx: 26, fill: "none", stroke: "#fff", strokeWidth: 1.3, opacity: .85 }),
      // 顶上那块铭牌。⚠️中文——眉标一律不留英文（施工规则/no-english-titles.md），
      //   参考图上那几行日文是【那台机器的样子】，不是这台的名字。
      h("rect", { x: 74, y: 14, width: 92, height: 17, rx: 8.5, fill: "#fff", opacity: .82 }),
      h("text", { x: 120, y: 26, textAnchor: "middle", fill: "#b0708a", style: { fontFamily: F_BODY, fontSize: 10, letterSpacing: "0.22em" } }, "我们之间"),
      // 玻璃罐
      h("rect", { x: 28, y: 36, width: 184, height: 146, rx: 18, fill: "url(#gm-case)", stroke: "#e7d6e0", strokeWidth: 1.3 }),
      h("g", { clipPath: "url(#gm-clip)" },
        h("g", { style: spin ? { animation: "gm-shake .4s ease-in-out " + (spin === 1 ? 3 : 4), transformOrigin: "120px 110px" } : null },
          GACHA_BALLS.map(([cx, cy, r], i) => gachaCapsule(GACHA_SHAPES[i % GACHA_SHAPES.length], cx, cy, r, "b" + i,
            spin ? { style: { animation: "gm-shake .4s ease-in-out " + (spin === 1 ? 3 : 4) + " " + (i % 5) * 0.055 + "s", transformOrigin: cx + "px " + cy + "px" } } : null))),
        // 玻璃上那一道斜光。它压在蛋上面，所以罐子才像有一层玻璃。
        h("path", { d: "M28 72 L96 36 L136 36 L28 114 Z", fill: "#fff", opacity: .3 }),
        h("path", { d: "M150 36 L176 36 L28 158 L28 142 Z", fill: "#fff", opacity: .16 })),
      h("rect", { x: 28, y: 36, width: 184, height: 146, rx: 18, fill: "none", stroke: "#fff", strokeWidth: 2, opacity: .7 }),
      // 罐口那条压边
      h("rect", { x: 30, y: 188, width: 180, height: 9, rx: 4.5, fill: "#e9d8e2" }),
      // ── 面板：左边投点数、中间拉杆 ──
      h("g", null,
        h("rect", { x: 30, y: 200, width: 84, height: 34, rx: 11, fill: "#fff",
          stroke: armed ? "#d79ab8" : "#e7d6e0", strokeWidth: armed ? 1.8 : 1.2 }),
        h("rect", { x: 58, y: 213, width: 28, height: 6, rx: 3, fill: armed ? "#b0708a" : "#c9aebb" }),
        // 那张点数卡：每选一次重放一遍（靠 armSeq 换 key），所以改主意也看得见它又投了一张
        armed ? h("g", { key: "coin" + armSeq, style: { animation: "gm-coin .72s cubic-bezier(.4,.05,.3,1) both", transformOrigin: "72px 216px" } },
          h("rect", { x: 57, y: 206, width: 30, height: 15, rx: 3, fill: "#f6dfe8", stroke: "#d79ab8", strokeWidth: 1 }),
          h("text", { x: 72, y: 217, textAnchor: "middle", fill: "#a74d70", style: { fontFamily: F_BODY, fontSize: 9 } }, armed === 1 ? "单" : "十")) : null,
        h("text", { x: 72, y: 249, textAnchor: "middle", fill: armed ? "#a74d70" : "#b58aa2",
          style: { fontFamily: F_BODY, fontSize: "calc(9.5px * var(--app-fs, 1))" } }, armed ? (armed === 1 ? "已投 " + costOne : "已投 " + costTen) : "投点数")),
      // 投完了才亮起来、才扳得动。⚠️热区是另画的一枚透明大圆（r=30≈60px 直径），
      //   不是那根细杆——手指按不准细杆（施工规则/mobile-ui-layout.md 那条 40px 热区）。
      // ⚠️这一圈画成【实心】的话就是一坨粉色糊在面板上，还会漫到取物口上去。
      //   它要的是「这儿可以按」，所以只描一道圈。
      ready ? h("circle", { cx: 166, cy: 217, r: 25, fill: "none", stroke: "#d79ab8", strokeWidth: 2.4,
        style: { animation: "gm-halo 1.5s ease-in-out infinite", transformOrigin: "166px 217px" } }) : null,
      h("g", { style: { transformOrigin: "166px 217px",
        animation: spin ? "gm-lever 1.3s cubic-bezier(.4,.1,.2,1) both" : ready ? "gm-wait 1.6s ease-in-out infinite" : "none" } },
        h("circle", { cx: 166, cy: 217, r: 21, fill: "#fff", stroke: ready ? "#d79ab8" : "#e2ccd7", strokeWidth: ready ? 1.9 : 1.5 }),
        h("circle", { cx: 166, cy: 217, r: 6, fill: ready ? "#edd8e3" : "#e4d1dc" }),
        h("rect", { x: 163.2, y: 199, width: 5.6, height: 20, rx: 2.8, fill: ready ? "#a74d70" : "#c9aebb" }),
        h("circle", { cx: 166, cy: 198, r: 7, fill: ready ? "#a74d70" : "#cdb4c2" })),
      h("circle", { cx: 166, cy: 217, r: 30, fill: "transparent",
        role: "button", tabIndex: ready ? 0 : -1, "aria-label": ready ? "扳一下拉杆" : "先投点数",
        style: { cursor: ready ? "pointer" : "default", pointerEvents: ready ? "auto" : "none" },
        onClick: () => { if (ready) onSpin(); } }),
      // ⚠️这一行原来压在拉杆下面，拉杆一转就叠上去了。挪到面板右侧竖着摆，转多少圈都不碰。
      h("text", { x: 203, y: 213, textAnchor: "middle", fill: "#c39cb2", style: { fontFamily: F_BODY, fontSize: 9 } }, "转"),
      h("text", { x: 203, y: 224, textAnchor: "middle", fill: "#c39cb2", style: { fontFamily: F_BODY, fontSize: 9 } }, "一"),
      h("text", { x: 203, y: 235, textAnchor: "middle", fill: "#c39cb2", style: { fontFamily: F_BODY, fontSize: 9 } }, "下"),
      // ── 取物口：一个真的圆洞，不是一条槽 ──
      h("rect", { x: 30, y: 256, width: 180, height: 56, rx: 18, fill: "#fff", stroke: "#e7d6e0", strokeWidth: 1.2 }),
      h("circle", { cx: 171, cy: 284, r: 25, fill: "url(#gm-hole)" }),
      // 顶上那道压边：洞口的边把光挡住了，所以最暗的一条在【上面】
      h("path", { d: "M146 284 a25 25 0 0 1 50 0 a25 17 0 0 0 -50 0 Z", fill: "#5f4a58", opacity: .32 }),
      // 底下那一点回光
      h("path", { d: "M153 296 q18 9 36 0", stroke: "#e2d0dc", strokeWidth: 2.2, fill: "none", opacity: .45 }),
      // 洞沿。⚠️只描外圈，不许在洞里再画白弧——那一笔正是把洞画成球的那一笔。
      h("circle", { cx: 171, cy: 284, r: 25, fill: "none", stroke: "#fff", strokeWidth: 2.6, opacity: .95 }),
      // 翻盖那一片
      h("path", { d: "M44 268 h74 a10 10 0 0 1 10 10 v14 a10 10 0 0 1 -10 10 h-74 a10 10 0 0 1 -10 -10 v-14 a10 10 0 0 1 10 -10 Z", fill: "#f3e6ee" }),
      h("path", { d: "M44 276 q37 -8 74 0", stroke: "#fff", strokeWidth: 2.4, fill: "none", opacity: .8 }),
      spin ? h("circle", { cx: 171, cy: 284, r: 25, fill: "#f7dce8", style: { animation: "gm-glow 1.8s ease-out both" } }) : null,
      // 正在出的那一枚：从罐底滚下来，掉进那个圆洞
      spin ? h("g", { style: { animation: "gm-drop 1.2s cubic-bezier(.34,.9,.36,1) .55s both" } },
        gachaCapsule(GACHA_SHAPES[(spin * 7) % GACHA_SHAPES.length], 120, 162, 17, "out")) : null),
    h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: ready ? "#a74d70" : "#b0708a", marginTop: 2 } },
      spin ? (spin > 1 ? "一口气转了十下…" : "转起来了…")
        : ready ? "点数投进去了 · 扳一下那个拉杆"
          : "跟 " + (partner.remark || partner.name) + " 之间的那些，都在里头"),
    h("div", { className: "flex gap-2 w-full", style: { marginTop: 11 } },
      [[1, "单抽", costOne], [10, "十连", costTen]].map(([n, zh, cost]) =>
        h("button", { key: zh, onClick: () => onArm(n), disabled: dim(cost) || !!spin, className: "flex-1 active:opacity-70",
          style: { borderRadius: 14, padding: "11px 0",
            background: (dim(cost) || spin) ? "#e6d8de" : armed === n ? "#7e3a54" : "#a74d70",
            color: (dim(cost) || spin) ? "#b09aa2" : "#fff",
            boxShadow: armed === n && !spin ? "inset 0 0 0 2px rgba(255,255,255,.55)" : "none",
            fontFamily: F_DISPLAY, fontSize: "calc(15px * var(--app-fs, 1))" } },
          zh, h("span", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", opacity: .78, marginLeft: 6 } }, cost + " 点")))));
}
function Gacha({ partner, pts, cards, luck, busy, onPull, onRedeem, onShow, onPin, onTitle, onShoot, onCarve, shooting, onBack, onDelete }) {
  const t = useTheme();
  const [tab, setTab] = useState("open");     // open=券夹（还没兑的）/ all=纪念册（兑过的）
  const [tone, setTone] = useState("all");   // 甜的／皮的
  const [order, setOrder] = useState("new"); // 最近抽到／最早抽到
  const [openStack, setOpenStack] = useState({});   // 哪几叠摊开了
  const [closedMonth, setClosedMonth] = useState({});
  const [fresh, setFresh] = useState([]);     // 刚抽到的那几张，描一圈金边
  const K = window.GachaKit || {};
  const mine = (cards || []).filter(c => c.charId === partner.id);
  const open = mine.filter(c => !c.redeemedTs);
  // 叠放、按月收、置顶——三样都在 GachaKit 那一份纯函数里，这儿只负责画
  const stacks = K.stackOpen ? K.stackOpen(mine, { tone: tone, order: order }) : [];
  const album = K.albumOf ? K.albumOf(mine) : [];
  const p = (pts || {})[partner.id];
  const have = p && typeof p === "object" ? (Number(p.pts) || 0) : 0;
  // 转起来的那一下（她 2026-09-14 要的「扭的时候里面东西会动、有出货动画」）。
  // ⚠️抽本来就是 0 调用、纯本地掷的，所以先转再算和先算再转对她没区别——
  //   这儿选【转完才把卡摆出来】，那一下才叫出货。
  // ⚠️点数不够、或者正在转，按钮自己是禁用的；这儿再挡一道，免得连点两下扣两次。
  const [spin, setSpin] = useState(0);
  // armed＝这次说好要抽几发（点数卡已经投进去了，但还没扳拉杆）。
  // ⚠️armed 只是【说好】，一点都还没扣：反悔、改主意、退出这一页，点数一分不少。
  //   真正扣点是 onPull，而 onPull 在转完那一刻才调。
  const [armed, setArmed] = useState(0);
  const [armSeq, setArmSeq] = useState(0);     // 每选一次 +1，让投卡那一下重新播
  const spinTimer = useRef(null);
  useEffect(() => () => { if (spinTimer.current) clearTimeout(spinTimer.current); }, []);
  const arm = n => { if (spin) return; setArmed(n); setArmSeq(x => x + 1); };
  // 谁扳拉杆（她 2026-10-17 转群友：「许愿让对方也能抽，我手气太差了」）：TA扳的那一发走TA自己那条运气线（保底各算各的），券照样进你的券夹
  const [byTa, setByTa] = useState(false);
  const doSpin = () => {
    if (spin || !armed) return;
    const n = armed;
    setArmed(0);
    setSpin(n);
    spinTimer.current = setTimeout(() => {
      spinTimer.current = null;
      setSpin(0);
      const made = onPull(partner, n, byTa);
      if (made && made.length) { setFresh(made.map(x => x.id)); setTab("open"); }
    }, 1750);
  };
  return h("div", { "data-wk": "uspage", "data-part": "gacha", className: "h-full flex flex-col", style: foilSkin(t) },
    // 紧凑标题栏（施工规则/mobile-ui-layout.md §1）
    h(Head, { zh: "抽卡", bg: "transparent", noLine: true, onBack }),
    h("div", { className: "flex-1 min-h-0 overflow-y-auto px-4 pb-10" },
      // 扭蛋机本体 + 点数。跟谁攒的点数就抽谁的卡——这一份只属于你和 TA
      h("div", { style: { borderRadius: 24, border: "1px solid #eadde3", background: "linear-gradient(135deg,#fff8f7 0%,#f6f0f7 100%)", padding: "14px 15px 16px" } },
        h("div", { className: "flex items-end justify-between", style: { marginBottom: 4 } },
          h("div", null,
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", letterSpacing: ".04em", color: "#b0708a" } }, "跟 " + (partner.remark || partner.name) + " 攒的"),
            h("div", { className: "flex items-baseline gap-1", style: { marginTop: 3 } },
              h("span", { style: { fontFamily: F_DISPLAY, fontStyle: "italic", fontSize: "calc(34px * var(--app-fs, 1))", lineHeight: 1, color: "#a74d70" } }, have),
              h("span", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: "#b0708a" } }, "点"))),
          h("div", { style: { textAlign: "right", fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: "#b0708a", lineHeight: 1.6 } },
            (() => { const lk2 = (luck || {})[byTa ? partner.id + "|ta" : partner.id] || { pulls: 0, sinceSSR: 0 };
              return [h("div", { key: "a" }, (byTa ? "TA 已抽 " : "已抽 ") + (lk2.pulls || 0) + " 次"),
                h("div", { key: "b" }, "还有 " + Math.max(0, (K.PITY_SSR || 50) - (lk2.sinceSSR || 0)) + " 抽保底 SSR"),
                h("div", { key: "c" }, "还有 " + Math.max(1, 10 - (lk2.sinceSR || 0)) + " 抽保底 SR")]; })())),
        h("div", { "data-wk": "gachawho", className: "flex items-center", style: { gap: 6, margin: "8px 0 2px", fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: "#a1808e" } }, "谁来扳拉杆",
          [[false, "我"], [true, partner.remark || partner.name]].map(([v, zh]) => h("button", { key: zh, onClick: () => !spin && setByTa(v), className: "active:opacity-70",
            style: { minHeight: 36, padding: "0 14px", borderRadius: 999, border: "1px solid " + (byTa === v ? "#a74d70" : "#eadde3"), background: byTa === v ? "#a74d7014" : "transparent", color: byTa === v ? "#a74d70" : "#a1808e", fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))" } }, zh))),
        h(GachaMachine, { have: have, costOne: K.COST_ONE || 50, costTen: K.COST_TEN || 450,
          armed: armed, armSeq: armSeq, spin: spin, onArm: arm, onSpin: doSpin, partner: partner }),
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: "#a1808e", marginTop: 10, lineHeight: 1.6 } },
          "先挑这次抽几发，点数卡会投进机器；**扳一下拉杆才真的转**，没扳之前一点都不扣。"
          + "抽卡不花任何调用，十连也是。抽到的是兑换券——点「兑换」才真的发生。和 " + (partner.remark || partner.name) + " 好好待一会儿就攒点数，发几条不影响。")),
      // 券夹 / 纪念册（她 2026-09-14 第三刀：券一多，真正想用的那张就被同款淹了）
      h("div", { className: "flex gap-2", style: { marginTop: 16, marginBottom: 10 } },
        [["open", "券夹 " + open.length], ["all", "纪念册 " + (mine.length - open.length)]].map(([k, zh]) =>
          h("button", { key: k, onClick: () => setTab(k), className: "active:opacity-70", style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", padding: "5px 14px", borderRadius: 999, border: "1px solid " + (tab === k ? t.ink : t.line), background: tab === k ? t.ink : "transparent", color: tab === k ? t.bg2 : t.sub } }, zh))),
      tab === "open" ? h(React.Fragment, null,
        // 筛一筛、换个顺序。⚠️不做「快到期」那种催促——券不设到期（她要的是留着，不是待办）。
        h("div", { className: "flex items-center", style: { gap: 6, flexWrap: "wrap", marginBottom: 10 } },
          [["all", "全部"], ["sweet", "甜的"], ["tease", "皮的"]].map(([k, zh]) =>
            h("button", { key: k, onClick: () => setTone(k), className: "active:opacity-70",
              style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", padding: "4px 11px", borderRadius: 999, border: "1px solid " + (tone === k ? "#a74d70" : t.line), background: tone === k ? "#a74d70" : "transparent", color: tone === k ? "#fff" : t.sub } }, zh)),
          h("div", { style: { flex: 1 } }),
          h("button", { onClick: () => setOrder(o => o === "old" ? "new" : "old"), className: "active:opacity-70",
            style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.sub, padding: "4px 2px" } },
            order === "old" ? "最早抽到 ⇅" : "最近抽到 ⇅")),
        stacks.length
          ? h("div", { style: { display: "flex", flexDirection: "column", gap: 10 } }, stacks.map(g => {
              const on = !!openStack[g.key];
              // 同一款只有一张就别摆叠放那一条——那一条是为了收，不是为了多一行字
              return h("div", { key: g.key, style: { display: "flex", flexDirection: "column", gap: 6 } },
                // 他挑给你的那一张，券夹上要看得出来——不然它跟你自己抽的混在一起，
                // 反向扭蛋券最值钱的那一点（是他挑的）就没了
                g.first && g.first.fromHim ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: "#a74d70", padding: "0 3px" } },
                  characterText(partner, "他挑了这一张给你") + (g.first.fromWhy ? "：" + String(g.first.fromWhy).slice(0, 40) : "")) : null,
                (g.n > 1 || g.pinned) ? h("div", { className: "flex items-center", style: { gap: 8, padding: "0 3px" } },
                  g.n > 1 ? h("button", { onClick: () => setOpenStack(p => ({ ...p, [g.key]: !on })), className: "active:opacity-60",
                    style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.sub } },
                    "同款 " + g.n + " 张 · " + (on ? "收起" : "摊开")) : null,
                  h("div", { style: { flex: 1 } }),
                  h("button", { onClick: () => onPin(g.poolId, !g.pinned), className: "active:opacity-60",
                    style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: g.pinned ? "#a74d70" : t.fog } },
                    g.pinned ? "已别在最上面 · 取下" : "留到下次")) : null,
                // 摊开＝每张各一格；收着＝只摆最早那张（先进先出），后面还剩几张写在角上
                (on ? g.cards : [g.first]).map(c => h(GachaCard, { key: c.id, card: c, onDelete: onDelete,
                  stackLeft: (!on && g.n > 1) ? g.n - 1 : 0,
                  busy: busy, onRedeem: onRedeem, onShow: onShow, onTitle: onTitle, onShoot: onShoot, onCarve: onCarve, shooting: shooting, fresh: fresh.indexOf(c.id) >= 0, character: partner })));
            }))
          : h("div", { style: { border: "1px dashed " + t.line, borderRadius: 16, padding: "26px 16px", textAlign: "center", fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.fog, lineHeight: 1.8 } },
              open.length ? "这一档下面没有券。" : "手上没有还没兑的券。",
              h("div", { style: { marginTop: 4 } }, "券不会过期，留多久都行。")))
      : album.length
        ? h("div", { style: { display: "flex", flexDirection: "column", gap: 14 } }, album.map((m, i) => {
            const on = closedMonth[m.key] == null ? i === 0 : !closedMonth[m.key];
            return h("div", { key: m.key },
              h("button", { onClick: () => setClosedMonth(p => ({ ...p, [m.key]: on })), className: "w-full active:opacity-60 flex items-center",
                style: { gap: 8, padding: "2px 3px 8px" } },
                h("span", { style: { fontFamily: F_DISPLAY, fontSize: "calc(15px * var(--app-fs, 1))", color: t.ink } }, m.year + " 年 " + m.zh),
                h("span", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog } }, m.n + " 件"),
                h("div", { style: { flex: 1, height: 1, background: t.line } }),
                h("span", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog } }, on ? "收起" : "摊开")),
              on ? h("div", { style: { display: "flex", flexDirection: "column", gap: 10 } },
                    m.cards.map(c => h(GachaCard, { key: c.id, card: c, onDelete: onDelete, busy: busy, onRedeem: onRedeem, onShow: onShow, onTitle: onTitle, onShoot: onShoot, onCarve: onCarve, shooting: shooting, fresh: false, character: partner })))
                // 收着的时候只露【真的发生了什么】那一行，不是券名——券名你已经看过了
                : h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.fog, lineHeight: 1.9, padding: "0 3px" } },
                    m.cards.slice(0, 4).map(c => String((c.result || {}).title || c.name || "").slice(0, 22)).filter(Boolean).join("、")
                    + (m.n > 4 ? " 等 " + m.n + " 件" : "")));
          }))
        : h("div", { style: { border: "1px dashed " + t.line, borderRadius: 16, padding: "26px 16px", textAlign: "center", fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.fog, lineHeight: 1.8 } },
            "还没兑过什么。",
            h("div", { style: { marginTop: 4 } }, "兑过的券会按月收在这儿，票根一直留着。"))));
}

// ═══ 情侣空间·惊喜抽屉（言秋提，她 2026-08-31 拍板）═══
// TA想你的时候有时不发消息，而是往你俩的抽屉里放一样东西，等你自己发现。
// ⚠️这一格【故意不报红点、不显示还有几件没拆】——报了就跟 App 里其余通知一个样，
// 惊喜就没了。代价是可能白开一次；补偿是拆过的都留在里头，所以从来不会空手而归。
// ⚠️封面上【一个字的内容都不许露】（v61.33，她 2026-09-03：「这个还没拆不应该显示
//   说的话的一部分，就是要拆开了才看到」）。原来封着的那张会把 x.title 印在外面，
//   而悄悄话那一路的 title 就是正文头 16 个字（drawerWhisper 那儿切的）——
//   等于封面上直接印着TA要说的话，拆不拆都一样。
//   所以封着的时候只有：还没拆、放进来的时刻。别的一律等拆开。
const DRAWER_KIND = {
  thing:   { zh: "TA捡到的",   ch: "拾", band: "#8a7a52" },
  word:    { zh: "半句话",     ch: "半", band: "#7d6a86" },
  draw:    { zh: "TA画的",     ch: "画", band: "#7a8a6e" },
  // 悄悄话从 v59.23 起也落这儿（便签墙撤掉，并进来的）
  whisper: { zh: "一句悄悄话", ch: "悄", band: "#a4736f" },
  // 抽卡掉落（v68.35）：TA口袋里的一件。它和「TA捡到的」不是一回事——
  // 那是路上拾的，这是TA一直带在身上的。
  drop:    { zh: "TA身上带的", ch: "带", band: "#6e7f8a" }
};
function CoupleDrawer({ partner, items, onOpen, onDrop, onEdit, onForward, ledger, kinds, onBack }) {
  const t = useTheme();
  // 拿掉一样（她 2026-09-20：「抽屉里的能不能单个删除，有些不想要的」）。
  // ⚠️不做成长按：她 2026-09-19 为论坛删帖定过同一件事——「算了长按删除去掉不要了，就留叉」。
  //   理由写在那儿：长按是隐形的（她「这里也没有删除」），而且在一条条滑过去的列表里，
  //   长按十次有八次被当成滚动。抽屉正是这种列表，所以照那次的结论来：一颗看得见的 ✕。
  const askDrop = function (x) {
    const what = x.openedTs
      ? "「" + String(x.title || x.text || "").replace(/\s+/g, " ").slice(0, 24) + "…」"
      : "这样还没拆的东西";
    requestAppConfirm("从抽屉里拿掉" + what + "？",
      x.openedTs ? "拿掉之后就没有了。" : "它还封着——拿掉就再也不知道里面是什么了。",
      function () { onDrop && onDrop(x.id); }, "拿掉");
  };
  // 那颗 ✕：压在右上角，跟纸面同色系、不抢眼，但一直看得见
  const dropX = function (x) {
    return h("button", { onClick: function (e) { e.stopPropagation(); askDrop(x); },
      "aria-label": "拿掉这一样", className: "active:opacity-60",
      // ⚠️往上提（她 2026-09-20：「这个❌有点太下了」）：30×30 是为了指头点得到的热区，
      //   可热区一居中，那个叉看起来就掉到卡片中间去了。所以热区不动，用负 top 把它
      //   提到跟第一行字齐平——纸是歪着的，再靠下一点就压到正文上了。
      style: { position: "absolute", right: 0, top: -7, width: 30, height: 30, zIndex: 2,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: F_BODY, fontSize: "calc(15px * var(--app-fs, 1))", lineHeight: 1, color: "rgba(122,99,56,.5)" } }, "✕");
  };
  const mine = (items || []).filter(x => x.characterId === partner.id);
  const unopened = mine.filter(x => !x.openedTs).length;
  const nm = partner.remark || partner.name;
  // 每一样歪一点点，按序号定死（随机的话每次重画都在动）
  const tilt = i => [-1.1, .7, -.5, 1.2, -.8, .4][i % 6];
  return h("div", { "data-wk": "uspage", "data-part": "coupledrawer", className: "h-full flex flex-col", style: {
    // 这一页就是【拉开的抽屉，从上往下看】：衬纸打底，四边压一圈内阴影——
    // 有了那圈内阴影，一眼就知道自己是在一个盒子里面，不用画木框去说明。
    background: "#efe6d3",
    backgroundImage: "repeating-linear-gradient(102deg,rgba(140,116,74,.035) 0 2px,transparent 2px 16px),"
      + "radial-gradient(120% 80% at 50% -10%,rgba(255,250,238,.75),transparent 60%)",
    boxShadow: "inset 0 0 46px rgba(96,72,40,.26), inset 0 2px 0 rgba(255,255,255,.35)" } },
    h(Head, { zh: "抽屉", bg: "transparent", noLine: true, ink: "#5d4c31", onBack }),
    h("div", { className: "flex-1 min-h-0 overflow-y-auto px-4 pb-10" },
      // 抽屉里侧那张标签：贴在衬纸上，不是一张圆角卡
      h("div", { style: { position: "relative", background: "#fbf5e6", padding: "14px 15px 13px",
        borderRadius: 3, boxShadow: "0 5px 14px rgba(96,72,40,.16)", transform: "rotate(-.4deg)" } },
        h("div", { "aria-hidden": "true", style: { position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: "#c9a86a" } }),
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(20px * var(--app-fs, 1))", color: "#6d5730" } },
          unopened ? "有 " + unopened + " 样还没拆" : mine.length ? "都拆过了" : "现在是空的"),
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", lineHeight: 1.75, color: "#9b8659", marginTop: 5 } },
          nm + "想你的时候，有时不发消息，就往这儿放一样东西。什么时候放、放什么，你打开才知道。"),
        // 她 2026-09-03 问「这里除了悄悄话还会放啥」——那就写在这儿，不用她来问
        h("div", { className: "flex flex-wrap", style: { gap: 6, marginTop: 11 } },
          Object.keys(DRAWER_KIND).map(k => h("span", { key: k, className: "flex items-center",
            style: { gap: 5, background: "rgba(201,168,106,.14)", borderRadius: 999, padding: "3px 10px 3px 4px" } },
            h("span", { "aria-hidden": "true", style: { width: 17, height: 17, borderRadius: 5, background: DRAWER_KIND[k].band,
              color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F_DISPLAY, fontSize: "calc(10px * var(--app-fs, 1))" } }, DRAWER_KIND[k].ch),
            h("span", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: "#8d7745" } }, characterText(partner, DRAWER_KIND[k].zh))))),
        // ── 各档上次是什么时候（v62.34）────────────────────────────────────────
        // 她 2026-09-04 问「模型真的会 follow through 吗」。真正防复发的不是硬配额，
        // 是【看得见】：**「从来没出现过」和「本来就少」在界面上长得一模一样**——
        // 一起学那条从上线起一次都没出现过、几个月没人发现，就是这个形状。
        // ⚠️报的是【TA自己走的那次】。她按按钮叫出来的单独记（她点名的：「我调用的
        //   就是单独自己算的」），另算一列，免得按几下就把某一档「喂饱」看不出问题。
        (kinds || []).length ? h("div", { style: { marginTop: 12, paddingTop: 10, borderTop: "1px dashed rgba(201,168,106,.5)" } },
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10px * var(--app-fs, 1))", letterSpacing: ".08em", color: "#a89066" } }, characterText(partner, "他自己走过的那几档 · 上次")),
          h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3px 12px", marginTop: 6 } },
            kinds.map(([k, zh]) => {
              const row = (ledger || {})[k] || {};
              const a = Number(row.a) || 0, mn = Number(row.mn) || 0;
              const d = a ? Math.floor((Date.now() - a) / 86400000) : -1;
              return h("div", { key: k, className: "flex items-baseline justify-between", style: { gap: 6 } },
                h("span", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: "#8d7745" } }, zh),
                h("span", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: a ? "#9b8659" : "#c07a52", flexShrink: 0 } },
                  (a ? (d <= 0 ? "今天" : d === 1 ? "昨天" : d + " 天前") : "还没有过")
                  + (mn ? "（你叫过 " + mn + " 次）" : "")));
            }))) : null),
      mine.length
        ? h("div", { style: { display: "flex", flexDirection: "column", gap: 13, marginTop: 16 } },
            mine.map((x, i) => {
              const k = DRAWER_KIND[x.kind] || DRAWER_KIND.thing;
              const sealed = !x.openedTs;
              if (sealed) {
                // 封着的：一个折起来、封了口的纸包。正面什么都没写。
                return h("div", { key: x.id, style: { position: "relative" } }, dropX(x),
                  h("button", { onClick: () => onOpen(x.id),
                  className: "w-full text-left active:opacity-80", style: { position: "relative", padding: "17px 16px 16px",
                    background: "linear-gradient(158deg,#f8f0dc,#efe3c6)", borderRadius: 2,
                    boxShadow: "0 7px 16px rgba(96,72,40,.20)", transform: "rotate(" + tilt(i) + "deg)", overflow: "hidden" } },
                  // 折痕：纸是折过才塞进来的
                  // 两道折痕：纸条是折成三折塞进来的。⚠️只画一道会正好横在字中间，
                  //   读起来是条分割线不是折痕——两道就没有这个歧义了。
                  // ⚠️折痕的位置要避开字：它横穿一行字的时候，那行字就像被划掉了。
                  ["17%", "85%"].map(top => h("div", { key: top, "aria-hidden": "true", style: { position: "absolute",
                    left: 0, right: 0, top: top, borderTop: "1px solid rgba(150,120,70,.18)",
                    boxShadow: "0 1px 0 rgba(255,255,255,.75)" } })),
                  // 右上角掀起来的一角
                  h("div", { "aria-hidden": "true", style: { position: "absolute", right: 0, top: 0, width: 26, height: 26,
                    background: "linear-gradient(225deg,#e2d4b0 50%,transparent 50%)" } }),
                  // 封蜡
                  h("div", { "aria-hidden": "true", style: { position: "absolute", right: 15, top: "50%", marginTop: -11,
                    width: 22, height: 22, borderRadius: 999, background: "radial-gradient(circle at 36% 32%,#c2705f,#8d3f36)",
                    boxShadow: "0 2px 4px rgba(80,30,24,.34), inset 0 0 0 3px rgba(255,255,255,.10), inset 0 -3px 5px rgba(60,20,16,.35)" } }),
                  h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(17px * var(--app-fs, 1))", color: "#7a6338", paddingRight: 44 } }, "还没拆"),
                  h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: "#a08b5d", marginTop: 5, paddingRight: 44 } },
                    nm + "在 " + gachaWhen(x.ts) + " 放进来的")));
              }
              // 拆开的：摊平的那张纸
              return h("div", { key: x.id, style: { position: "relative", padding: "13px 15px 15px",
                background: "#fffdf6", borderRadius: 2, boxShadow: "0 3px 9px rgba(96,72,40,.11)",
                transform: "rotate(" + (tilt(i) / 2) + "deg)" } },
                dropX(x),
                // 抬头右边空出一截：时间戳原来正好落在叉底下，两个叠着谁都看不清
                h("div", { className: "flex items-center", style: { gap: 7, paddingRight: 22 } },
                  h("span", { "aria-hidden": "true", style: { width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                    background: k.band, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: F_DISPLAY, fontSize: "calc(11.5px * var(--app-fs, 1))" } }, k.ch),
                  h("div", { className: "flex-1 min-w-0", style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: "#a08b5d" } }, characterText(partner, k.zh)),
                  h("span", { style: { fontFamily: F_BODY, fontSize: "calc(9.5px * var(--app-fs, 1))", color: "#b9a785" } }, gachaWhen(x.ts))),
                // ⚠️悄悄话的 title 就是正文头一截，两行一样等于把同一句摆两遍
                (x.title && String(x.title).replace(/…$/, "") !== String(x.text || "").slice(0, String(x.title).replace(/…$/, "").length))
                  ? h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(15.5px * var(--app-fs, 1))", color: "#4e4030", marginTop: 8 } }, STX(x.title)) : null,
                // TA画的那张（v75.479，她 2026-10-12：「原来是文字描述，现在可以让他用代码画」）：
                //   当图片挂，不当 DOM 插——svg 里就算混进脚本，<img> 也一行都不跑
                x.kind === "draw" && x.svg ? h("img", { "data-wk": "drawerdrawing", alt: "", src: "data:image/svg+xml;charset=utf-8," + encodeURIComponent(x.svg),
                  style: { display: "block", width: "100%", maxWidth: 300, margin: "8px auto 2px", background: "#fffdf7", borderRadius: 4, border: "1px solid rgba(91,76,58,.15)" } }) : null,
                h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", lineHeight: 1.85, color: "#5b4c3a", marginTop: 6, whiteSpace: "pre-wrap" } }, STX(x.text)),
                // 改字（她 2026-10-05）：拆开的那张纸可以改；跟 ✕ 一样一直看得见，不藏在长按里
                (onEdit || onForward) ? h("div", { className: "flex justify-end", style: { marginTop: 4, gap: 10 } },
                  onForward ? h("button", { "data-wk": "drawerforward", onClick: () => requestAppConfirm("发给" + partner.name + "？", "这一张会作为你发的一条消息落进你们的聊天，" + (x.kind === "draw" ? "画也带上，" : "") + "他等你说话了再回。", () => onForward(x), "发过去"),
                    className: "active:opacity-60", style: { minHeight: 32, padding: "0 4px", background: "transparent", border: "none", fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: "rgba(122,99,56,.65)" } }, "发给他") : null,
                  onEdit && h("button", { onClick: () => requestAppPrompt("改这一张", "改完就照新的留着。", x.text || "", v => { if (String(v || "").trim()) onEdit(x.id, v); }, "改好了", { multiline: true }),
                    "aria-label": "改这一样的字", className: "active:opacity-60",
                    style: { minHeight: 32, padding: "0 4px", background: "transparent", border: "none", fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: "rgba(122,99,56,.65)" } }, x.edited ? "改过 · 再改" : "改一改")) : null);
            }))
        : h("div", { style: { border: "1px dashed rgba(150,120,70,.32)", borderRadius: 4, padding: "30px 16px", marginTop: 16, textAlign: "center", fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: "#a08b5d", lineHeight: 1.8 } },
            characterText(partner, "他还没往里放过东西。"), h("div", { style: { marginTop: 4 } }, "这儿不会提醒你——想起来了就来看看。"))));
}

// ═══ 情侣空间·里程碑册（言秋提，她 2026-08-31 拍板）═══
// 全部从已有数据【推】出来，一个钩子都不挂，零调用（理由见 js/couple-firsts.js 顶上那段）。
// 每一条底下那句注是【引原物】——第一封信就引信的标题，不是现编一句角色口吻的话。
// 「我们的空间」里的一本本子（她 2026-10-16「本子的 1234 可以做」）：黑历史案卷、军师观察簿、人生选择册、报平安簿……
//   本子长什么样只有这一份；哪本记什么、TA 怎么接，全在 engine.js 的 SPACE_BOOKS 里。
function SpaceBook({ partner, book, entries, busy, onAdd, onReply, onRemove, onTa, onBack }) {
  const t = useTheme();
  const [form, setForm] = useState(null);          // 正在记的那一条
  const [draft, setDraft] = useState({});           // 每条下面那一行：{ [entryId]: { kind, text } }
  const [openId, setOpenId] = useState(null);       // 卷宗 / 诉状 / 车票 点开的那一份
  const [flip, setFlip] = useState({});             // 嘴硬对照卡翻到背面的那几张
  const nm = (partner && (partner.remark || partner.name)) || "TA";
  const list = entries || [];
  const startForm = () => { const f = {}; book.fields.forEach(x => { if (x.pick) f[x.k] = x.pick[0][0]; }); setForm(f); };
  const submit = async () => {
    if (!String(form.body || "").trim()) return;
    const e = await onAdd(form); setForm(null);
    if (book.autoAsk && e && e.id) onTa(e.id);
  };
  const who = by => by === "ta" ? nm : "我";
  const field = (f, val, set) => f.pick
    ? h("div", { key: f.k, className: "flex", style: { gap: 6, marginTop: 8 } }, h("span", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.fog, alignSelf: "center", marginRight: 4 } }, f.zh),
        f.pick.map(o => h("button", { key: o[0], onClick: () => set(o[0]), className: "active:opacity-70", style: { padding: "4px 11px", borderRadius: 999, fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", border: "1px solid " + (val === o[0] ? book.band : t.line), background: val === o[0] ? book.band : "transparent", color: val === o[0] ? "#fff" : t.sub } }, o[1] === "TA 的" ? nm + " 的" : o[1])))
    : h(f.long ? "textarea" : "input", { key: f.k, value: val || "", onChange: e => set(e.target.value), placeholder: f.zh + (f.ph ? "：" + f.ph : ""), rows: f.long ? 3 : undefined,
        style: { width: "100%", boxSizing: "border-box", marginTop: 8, border: "1px solid " + t.line, borderRadius: 10, padding: "9px 11px", background: t.bg, color: t.ink, fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", outline: "none", resize: "none" } });
  // ════ 长成那样东西（她 2026-10-16「你这只是换了个颜色喂」）════
  //   卷宗是一叠档案袋、点开是夹着纸的卷宗；诉状点开是原告席被告席分两边；对照卡是一张张能翻面的卡；报平安是一张张车票。
  //   不是同一张卡换配色——摆法、点法、接话的方式都跟着那样东西走。
  const OBJ = { blackcase: 1, complain: 1, mouth: 1, safe: 1, advisor: 1, choices: 1, credit: 1, favor: 1 };
  // 每本摆在它自己的地方（她 2026-10-16「但是背景都还是这种纸张」）：卷宗摊在深色木办公桌上、诉状在木墙板的小法庭里、
  //   对照卡钉在软木板上、车票在夜里的站台上。字色跟着底走（Head 的 ink 口子）。
  const SCENE = {
    // 第一版照字面铺了木桌、法庭木墙、软木板、夜站台——她：「这又是个极端，它不好看」。
    //   收成浅底：只从那样东西里借一点颜色和极淡的纹理，跟 app 其余的纸感站在一起；东西本身（档案袋、诉状、卡、车票）才是主角。
    blackcase: { ink: "#3d2f1f", sub: "rgba(61,47,31,.55)", page: { background: "radial-gradient(120% 80% at 50% 0%, #f6efe2 0%, #ece0c9 100%)" } },
    complain: { ink: "#3d2a22", sub: "rgba(61,42,34,.55)", page: { background: "linear-gradient(180deg, #f5ece6 0%, #ecdfd5 100%)" } },
    mouth: { ink: "#3a3048", sub: "rgba(58,48,72,.55)", page: { background: "radial-gradient(circle, rgba(122,106,160,.10) 1px, transparent 1.3px) 0 0/16px 16px, linear-gradient(180deg,#f4f1f8,#ebe6f2)" } },
    safe: { ink: "#2c3a44", sub: "rgba(44,58,68,.55)", page: { background: "linear-gradient(180deg, #eef2f4 0%, #e1e8ec 100%)" } },
    advisor: { ink: "#43262f", sub: "rgba(67,38,47,.55)", page: { background: "linear-gradient(180deg, #f8eff1 0%, #f0e3e7 100%)" } },
    choices: { ink: "#26343b", sub: "rgba(38,52,59,.55)", page: { background: "linear-gradient(180deg, #eef3f5 0%, #e2eaee 100%)" } },
    credit: { ink: "#22352d", sub: "rgba(34,53,45,.55)", page: { background: "linear-gradient(180deg, #eff4f0 0%, #e2ebe5 100%)" } },
    favor: { ink: "#3d3020", sub: "rgba(61,48,32,.55)", page: { background: "linear-gradient(180deg, #f7f1e4 0%, #eee4cf 100%)" } }
  };
  const sc = SCENE[book.key] || null;
  // 顶上那两颗也照那样东西说话：立案、递诉状、拍卡、报平安
  const VERB = { advisor: ["递一份情报", ""], choices: ["摆一个岔路口", "让 {n} 摆一个"], credit: ["写一张证书", "让 {n} 写一张"], favor: ["记一笔", "让 {n} 记一笔"], blackcase: ["立一桩案", "让 {n} 举报一桩"], complain: ["递一份诉状", "让 {n} 告你一状"], mouth: ["拍一张卡", "让 {n} 拍一张"], safe: ["报个平安", "让 {n} 报个平安"] }[book.key] || ["记一条", "让 {n} 开一条"];
  const INK = "#2f2a24", RED = "#b23a2e";
  const dOf = e => draft[e.id] || { kind: book.kinds[0], text: "" };
  const setDOf = (e, v) => setDraft(o => Object.assign({}, o, { [e.id]: Object.assign({}, dOf(e), v) }));
  const sendOf = e => { const d = dOf(e); if (!d.text.trim()) return; onReply(e.id, { kind: d.kind, text: d.text.trim() }); setDOf(e, { text: "" }); };
  const whoTxtOf = e => { const f = book.fields.find(x => x.pick); return f && e[f.k] ? (e[f.k] === "ta" ? nm : "我") : ""; };
  const dateOf = ts => (dd => (dd.getMonth() + 1) + "." + dd.getDate())(new Date(ts));
  const timeOf = ts => (dd => String(dd.getHours()).padStart(2, "0") + ":" + String(dd.getMinutes()).padStart(2, "0"))(new Date(ts));
  const noOf = e => String(list.length - list.indexOf(e)).padStart(3, "0");
  // 接话那一栏：卷宗是一排墨章，诉状是庭上的几个动作，车票和对照卡是一行小字
  const replyBar = (e, look) => {
    const d = dOf(e);
    const kinds = look === "stamp"
      ? h("div", { className: "flex", style: { gap: 10, justifyContent: "center", marginBottom: 10 } }, book.kinds.map((k, i) => h("button", { key: k, onClick: () => setDOf(e, { kind: k }), className: "active:scale-95",
          style: { width: 52, height: 52, borderRadius: 999, border: "2px solid " + RED, background: d.kind === k ? RED : "transparent", color: d.kind === k ? "#fff" : RED, fontFamily: F_DISPLAY, fontSize: "calc(14px * var(--app-fs, 1))", transform: "rotate(" + ((i % 2 ? 1 : -1) * (4 + i * 2)) + "deg)", opacity: d.kind === k ? 1 : .75 } }, k)))
      : h("div", { className: "flex", style: { gap: 14, justifyContent: "center", marginBottom: 8, flexWrap: "wrap" } }, book.kinds.map(k => h("button", { key: k, onClick: () => setDOf(e, { kind: k }),
          style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: d.kind === k ? book.band : "#9a8f80", background: "transparent", borderBottom: "2px solid " + (d.kind === k ? book.band : "transparent"), padding: "2px 2px" } }, k)));
    return h("div", { "data-wk": "spacebookreply", style: { marginTop: 14 } }, kinds,
      h("div", { className: "flex", style: { gap: 6 } },
        h("input", { "data-wk": "input", value: d.text, onChange: ev => setDOf(e, { text: ev.target.value }), placeholder: look === "stamp" ? "盖「" + d.kind + "」，写一句…" : d.kind + "：…", style: { flex: 1, minWidth: 0, border: 0, borderBottom: "1px solid " + INK, padding: "8px 2px", background: "transparent", color: INK, fontFamily: F_HAND, fontSize: "calc(17px * var(--app-fs, 1))", outline: "none" } }),
        h("button", { onClick: () => sendOf(e), disabled: !d.text.trim(), style: { padding: "6px 12px", border: 0, background: "transparent", color: d.text.trim() ? book.band : "#c4b9a6", fontFamily: F_DISPLAY, fontSize: "calc(15px * var(--app-fs, 1))" } }, "落笔")),
      h("button", { "data-wk": "spacebookask", onClick: () => onTa(e.id), disabled: !!busy, className: "w-full active:opacity-70", style: { marginTop: 10, padding: "9px 0", border: "1px dashed " + book.band, borderRadius: 999, background: "transparent", color: book.band, fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))" } },
        busy === book.key + ":" + e.id ? nm + " 在写…" : look === "court" ? "请 " + nm + " 答辩" : look === "stamp" ? "叫 " + nm + " 来录口供" : "让 " + nm + " 接"),
      h("button", { onClick: () => requestAppConfirm("撕掉这一份？", "这一份和底下的话都没了。", () => { onRemove(e.id); setOpenId(null); }, "撕掉"), style: { display: "block", margin: "12px auto 0", fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: "#a99f90", background: "transparent" } }, "撕掉"));
  };
  const openE = openId ? list.find(e => e.id === openId) : null;
  const objView = () => {
    // ── 黑历史案卷：一叠牛皮纸档案袋，标签错开露在上面 ──
    if (book.key === "blackcase") {
      if (openE) { const e = openE, ws = whoTxtOf(e);
        return h("div", { "data-wk": "spacebookopen", style: { position: "relative", background: "linear-gradient(170deg,#d9bb8c,#c9a370)", borderRadius: 6, padding: "18px 14px 16px", boxShadow: "0 6px 16px rgba(80,55,20,.22)" } },
          h("button", { onClick: () => setOpenId(null), style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: "#5a4325", background: "transparent", marginBottom: 10 } }, "← 合上卷宗"),
          h("div", { "data-wk": "block", style: { position: "relative", background: "#fffdf7", padding: "18px 16px 14px", boxShadow: "0 2px 6px rgba(0,0,0,.15)", transform: "rotate(-.6deg)" } },
            h("span", { style: { position: "absolute", left: 22, top: -12, width: 12, height: 36, border: "3px solid #8e98a3", borderRadius: 8 } }),
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", letterSpacing: ".2em", color: "#8a7f70", textAlign: "right" } }, "黑历史 · 第 " + noOf(e) + " 号"),
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(21px * var(--app-fs, 1))", color: INK, marginTop: 6 } }, "《" + (e.title || "无名案") + "》"),
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: "#7a6a55", marginTop: 4 } }, "当事人：" + (ws || "—") + "　举报人：" + who(e.by) + "　" + dateOf(e.ts) + " 立案"),
            h("div", { style: { fontFamily: F_HAND, fontSize: "calc(18px * var(--app-fs, 1))", lineHeight: 1.7, color: INK, marginTop: 10, whiteSpace: "pre-wrap" } }, STX(e.body)),
            (e.thread || []).some(x => x.kind === "翻案") ? h("div", { style: { position: "absolute", right: 14, bottom: 12, transform: "rotate(-12deg)", border: "3px double " + RED, color: RED, padding: "2px 10px", fontFamily: F_DISPLAY, fontSize: "calc(16px * var(--app-fs, 1))", letterSpacing: ".2em", opacity: .85 } }, "申请翻案") : null),
          h("div", { style: { background: "#fffdf7", marginTop: 12, padding: "12px 16px", backgroundImage: "repeating-linear-gradient(transparent 0 29px,#e4dccd 29px 30px)", minHeight: 90 } },
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(13px * var(--app-fs, 1))", letterSpacing: ".4em", color: "#8a7f70", marginBottom: 4 } }, "笔　录"),
            (e.thread || []).length ? e.thread.map((x, i) => h("div", { key: i, "data-wk": "spacebookline", "data-me": x.by === "me" ? "1" : "0", style: { lineHeight: "30px", fontFamily: F_HAND, fontSize: "calc(17px * var(--app-fs, 1))", color: INK } },
              h("span", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: RED, border: "1px solid " + RED, borderRadius: 3, padding: "0 4px", marginRight: 6, verticalAlign: "middle" } }, x.kind), who(x.by) + "：" + x.text))
              : h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: "#a99f90", lineHeight: "30px" } }, "还没人开口。")),
          h("div", { style: { background: "#fffdf7", marginTop: 12, padding: "12px 14px" } }, replyBar(e, "stamp")));
      }
      return h("div", { style: { paddingTop: 16 } }, list.map((e, i) => { const ws = whoTxtOf(e);
        return h("button", { key: e.id, "data-wk": "spacebookitem", "data-kind": "blackcase", onClick: () => setOpenId(e.id), className: "w-full text-left active:opacity-90", style: { position: "relative", display: "block", marginTop: i ? -6 : 0, marginBottom: 22, background: "transparent" } },
          h("span", { style: { position: "absolute", top: -16, left: 18 + (i % 3) * 92, width: 84, height: 20, borderRadius: "6px 6px 0 0", background: "#cfae7c", fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: "#5a4325", textAlign: "center", lineHeight: "20px", letterSpacing: ".1em" } }, "No." + noOf(e)),
          h("div", { "data-wk": "block", style: { position: "relative", background: "linear-gradient(175deg,#dcc093,#cfae7c)", borderRadius: 4, padding: "16px 16px 14px", boxShadow: "0 3px 8px rgba(80,55,20,.2)" } },
            h("div", { style: { fontFamily: F_HAND, fontSize: "calc(22px * var(--app-fs, 1))", color: "#3a2c18" } }, STX(e.title || "无名案")),
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: "#6b5332", marginTop: 4 } }, "当事人 " + (ws || "—") + " · 笔录 " + (e.thread || []).length + " 条"),
            (e.thread || []).some(x => x.kind === "翻案") ? h("span", { style: { position: "absolute", right: 14, top: 14, transform: "rotate(-10deg)", border: "2px solid " + RED, color: RED, padding: "0 6px", fontFamily: F_DISPLAY, fontSize: "calc(12px * var(--app-fs, 1))" } }, "翻案中") : null));
      }));
    }
    // ── 家里告状台：诉状一份份摞着；点开是原告席、被告席分坐两边 ──
    if (book.key === "complain") {
      if (openE) { const e = openE, plaintiff = e.by, ws = whoTxtOf(e);
        const side = by => by === plaintiff ? "left" : "right";
        const bubble = (txt, by, kind, key) => h("div", { key, "data-wk": "spacebookline", "data-me": by === "me" ? "1" : "0", className: "flex", style: { justifyContent: side(by) === "left" ? "flex-start" : "flex-end", marginTop: 10 } },
          h("div", { style: { maxWidth: "78%", padding: "8px 11px", borderRadius: side(by) === "left" ? "2px 12px 12px 12px" : "12px 2px 12px 12px", background: side(by) === "left" ? "#f3e4da" : "#e3e6ee", fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", lineHeight: 1.6, color: INK, whiteSpace: "pre-wrap" } },
            kind ? h("div", { style: { fontSize: "calc(10.5px * var(--app-fs, 1))", color: "#8a7f70", marginBottom: 2 } }, who(by) + " · " + kind) : null, txt));
        return h("div", { "data-wk": "spacebookopen", style: { background: "#fbf7f0", border: "1px solid #e4d8c5", borderRadius: 8, padding: "14px 14px 16px" } },
          h("button", { onClick: () => setOpenId(null), style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: "#7a6a55", background: "transparent" } }, "← 退庭"),
          h("div", { style: { textAlign: "center", fontFamily: F_DISPLAY, fontSize: "calc(18px * var(--app-fs, 1))", color: INK, marginTop: 6 } }, STX(e.title || "一桩家事")),
          h("div", { className: "flex", style: { marginTop: 12, fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", letterSpacing: ".2em", color: "#8a7f70" } },
            h("div", { className: "flex-1", style: { borderBottom: "2px solid #c98f6f", paddingBottom: 3 } }, "原告席 · " + who(plaintiff)),
            h("div", { style: { width: 30, textAlign: "center" } }, "⚖"),
            h("div", { className: "flex-1", style: { borderBottom: "2px solid #8f9ab8", paddingBottom: 3, textAlign: "right" } }, (ws || "—") + " · 被告席")),
          bubble(e.body, plaintiff, "诉称", "b"),
          (e.thread || []).map((x, i) => bubble(x.text, x.by, x.kind, i)),
          e.closed ? h("div", { style: { textAlign: "center", marginTop: 16, fontFamily: F_DISPLAY, fontSize: "calc(15px * var(--app-fs, 1))", color: "#4f7a5a", letterSpacing: ".3em" } }, "— 本案已和解 —") : replyBar(e, "court"));
      }
      return h("div", null, list.map(e => { const ws = whoTxtOf(e);
        return h("button", { "data-wk": "block", key: e.id, "data-wk": "spacebookitem", "data-kind": "complain", onClick: () => setOpenId(e.id), className: "w-full text-left active:opacity-90", style: { display: "block", position: "relative", marginBottom: 14, padding: "14px 16px", background: "#fffdf8", border: "1px solid #e4d8c5", boxShadow: "3px 3px 0 #efe6d6, 6px 6px 0 #e4d8c5" } },
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: "#8a7f70", letterSpacing: ".1em" } }, "家诉字第 " + noOf(e) + " 号 · " + dateOf(e.ts)),
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(19px * var(--app-fs, 1))", color: INK, marginTop: 6 } }, who(e.by), h("span", { style: { fontSize: "calc(13px * var(--app-fs, 1))", color: "#8a7f70", margin: "0 8px" } }, "诉"), ws || "—"),
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: "#5a5045", marginTop: 4 } }, "诉由：" + (e.title || "")),
          h("span", { style: { position: "absolute", right: 14, top: 14, transform: "rotate(-8deg)", border: "2px solid " + (e.closed ? "#4f7a5a" : RED), color: e.closed ? "#4f7a5a" : RED, borderRadius: 4, padding: "0 6px", fontFamily: F_DISPLAY, fontSize: "calc(13px * var(--app-fs, 1))" } }, e.closed ? "已和解" : "待审"));
      }));
    }
    // ── 嘴硬对照卡：一张张卡，正面是当时的狠话，点一下翻过来是后来 ──
    if (book.key === "mouth") {
      return h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 } }, list.map(e => { const f = !!flip[e.id], ws = whoTxtOf(e), wide = f;
        const tilt = f ? 0 : ((list.indexOf(e) % 3) - 1) * 1.6;
        return h("div", { key: e.id, "data-wk": "spacebookitem", "data-kind": "mouth", "data-flip": f ? "1" : "0", style: { position: "relative", gridColumn: wide ? "1 / -1" : "auto", perspective: 900, transform: "rotate(" + tilt + "deg)", marginTop: 6 } },
          // 钉在软木板上的那颗图钉
          h("span", { "aria-hidden": "true", style: { position: "absolute", left: "50%", top: -6, zIndex: 2, width: 14, height: 14, marginLeft: -7, borderRadius: 999, background: "radial-gradient(circle at 35% 30%, #f08a7e, #b3372b 70%)", boxShadow: "0 2px 3px rgba(0,0,0,.35)" } }),
          h("div", { style: { position: "relative", transition: "transform .5s", transformStyle: "preserve-3d", transform: f ? "rotateY(180deg)" : "none", minHeight: wide ? 300 : 170 } },
            h("button", { onClick: () => setFlip(o => Object.assign({}, o, { [e.id]: true })), className: "text-left", style: { position: "absolute", inset: 0, backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", background: "#fff", border: "1px solid #ddd5ea", borderRadius: 12, padding: "14px 12px", boxShadow: "0 3px 8px rgba(60,40,90,.1)", display: "flex", flexDirection: "column" } },
              h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: book.band } }, (ws || "谁") + " 说过"),
              h("div", { className: "flex-1", style: { fontFamily: F_HAND, fontSize: "calc(19px * var(--app-fs, 1))", lineHeight: 1.4, color: INK, marginTop: 6, overflow: "hidden" } }, "「" + e.body + "」"),
              h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: "#a99fb5", textAlign: "right" } }, "翻过来看 ↻")),
            h("div", { "data-wk": "block", style: { position: "absolute", inset: 0, backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", transform: "rotateY(180deg)", background: "#efe9f6", border: "1px solid #ddd5ea", borderRadius: 12, padding: "14px 14px", overflowY: "auto" } },
              h("div", { className: "flex justify-between" }, h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: book.band } }, "后来"), h("button", { onClick: () => setFlip(o => Object.assign({}, o, { [e.id]: false })), style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: "#8a7fa0", background: "transparent" } }, "翻回去 ↻")),
              h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(16px * var(--app-fs, 1))", color: INK, marginTop: 4 } }, e.after || "还没对上"),
              (e.thread || []).map((x, i) => h("div", { key: i, "data-wk": "spacebookline", "data-me": x.by === "me" ? "1" : "0", style: { marginTop: 6, fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: INK } }, h("span", { style: { color: book.band, marginRight: 4 } }, who(x.by) + "·" + x.kind), x.text)),
              replyBar(e, "line"))));
      }));
    }
    // ── 报平安簿：一张张车票，左边存根是时间，右边是去向，底下一条路走到「到了」 ──
    if (book.key === "safe") {
      return h("div", null, list.map(e => {
        const stage = e.closed ? 2 : (e.thread || []).some(x => x.kind === "路上") ? 1 : 0, open = openId === e.id;
        return h("div", { key: e.id, "data-wk": "spacebookitem", "data-kind": "safe", style: { marginBottom: 14 } },
          h("button", { onClick: () => setOpenId(open ? null : e.id), className: "w-full text-left flex active:opacity-90", style: { background: "transparent", filter: "drop-shadow(0 3px 6px rgba(90,60,20,.15))" } },
            h("div", { "data-wk": "block", style: { width: 76, flexShrink: 0, background: book.band, color: "#fff", borderRadius: "10px 0 0 10px", padding: "12px 8px", textAlign: "center" } },
              h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10px * var(--app-fs, 1))", opacity: .8 } }, who(e.by)),
              h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(20px * var(--app-fs, 1))", marginTop: 4 } }, timeOf(e.ts)),
              h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", opacity: .85, marginTop: 2 } }, dateOf(e.ts))),
            h("div", { style: { width: 0, borderLeft: "2px dashed #f7efe0", position: "relative" } }),
            h("div", { "data-wk": "block", className: "flex-1", style: { background: "#fbf3e3", borderRadius: "0 10px 10px 0", padding: "12px 14px" } },
              h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(16px * var(--app-fs, 1))", color: INK, lineHeight: 1.4 } }, STX(e.body)),
              h("div", { className: "flex items-center", style: { marginTop: 10 } }, ["出门", "路上", "到了"].map((st, k) => h(React.Fragment, { key: st },
                k ? h("div", { className: "flex-1", style: { height: 2, background: k <= stage ? book.band : "#e3d4b8" } }) : null,
                h("div", { style: { display: "flex", flexDirection: "column", alignItems: "center", fontFamily: F_BODY, fontSize: "calc(10px * var(--app-fs, 1))", color: k <= stage ? book.band : "#b9ab90" } },
                  h("span", { style: { width: 10, height: 10, borderRadius: 999, background: k <= stage ? book.band : "#fbf3e3", border: "2px solid " + (k <= stage ? book.band : "#d9c9a8") } }), st)))))),
          open ? h("div", { "data-wk": "block", style: { margin: "0 10px", padding: "10px 14px 12px", background: "#fffaf0", borderRadius: "0 0 10px 10px", border: "1px solid #eadcc0", borderTop: 0 } },
            (e.thread || []).map((x, i) => h("div", { key: i, "data-wk": "spacebookline", "data-me": x.by === "me" ? "1" : "0", style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: INK, marginTop: 6 } }, h("span", { style: { fontSize: "calc(11px * var(--app-fs, 1))", color: book.band, marginRight: 6 } }, timeOf(x.ts || e.ts) + " " + who(x.by) + " · " + x.kind), x.text)),
            e.closed ? h("div", { style: { textAlign: "center", fontFamily: F_DISPLAY, fontSize: "calc(14px * var(--app-fs, 1))", color: "#4f7a5a", marginTop: 10, letterSpacing: ".2em" } }, "平安到了") : replyBar(e, "line")) : null);
      }));
    }
    // 点开后底下那一串（后四本共用）：mine 是墨笔、TA 的是 band 色
    const threadOf = (e, red) => (e.thread || []).map((x, i) => h("div", { key: i, "data-wk": "spacebookline", "data-me": x.by === "me" ? "1" : "0", style: { marginTop: 8, fontFamily: red && x.by === "ta" ? F_HAND : F_BODY, fontSize: red && x.by === "ta" ? 17 : 13, lineHeight: 1.6, color: red && x.by === "ta" ? book.band : INK } },
      h("span", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: book.band, marginRight: 6 } }, who(x.by) + " · " + x.kind), x.text));
    // ── 军师观察簿：一页横线本，左边一道红边线；TA 的判断是红笔批在页边 ──
    if (book.key === "advisor") {
      return h("div", null, list.map(e => { const open = openId === e.id, last = (e.thread || []).filter(x => x.by === "ta").slice(-1)[0];
        return h("div", { "data-wk": "block", key: e.id, "data-wk": "spacebookitem", "data-kind": "advisor", style: { position: "relative", marginBottom: 14, background: "#fffdfb", borderRadius: 3, boxShadow: "0 2px 6px rgba(90,40,55,.10)", padding: "12px 14px 12px 40px", backgroundImage: "linear-gradient(90deg, transparent 30px, rgba(196,80,96,.45) 30px 31px, transparent 31px), repeating-linear-gradient(transparent 0 27px, #f0e2e6 27px 28px)" } },
          h("button", { onClick: () => setOpenId(open ? null : e.id), className: "w-full text-left", style: { background: "transparent", display: "block" } },
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: "#a88c94" } }, dateOf(e.ts) + " · 关于"),
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(17px * var(--app-fs, 1))", color: INK, marginTop: 2 } }, STX(e.title || "一件事")),
            h("div", { style: { fontFamily: F_HAND, fontSize: "calc(17px * var(--app-fs, 1))", lineHeight: "28px", color: INK, marginTop: 4, whiteSpace: "pre-wrap", maxHeight: open ? "none" : 84, overflow: "hidden" } }, STX(e.body)),
            last && !open ? h("div", { style: { marginTop: 6, fontFamily: F_HAND, fontSize: "calc(17px * var(--app-fs, 1))", color: book.band, transform: "rotate(-1.2deg)", borderLeft: "2px solid " + book.band, paddingLeft: 8 } }, "批：" + last.text) : null),
          open ? h("div", null, threadOf(e, true), replyBar(e, "line")) : null);
      }));
    }
    // ── 人生选择册：一个岔路口，几条路分出去，当时倾向那条是亮的，有了结果就在路尽头立一块牌 ──
    if (book.key === "choices") {
      return h("div", null, list.map(e => { const open = openId === e.id;
        const opts = String(e.body || "").split(/\n|；|;|\/|、|还是/).map(x => x.trim()).filter(Boolean).slice(0, 4);
        const lean = String(e.lean || "").trim(), res = (e.thread || []).filter(x => x.kind === "结果").slice(-1)[0];
        const lit = o => lean && (o.indexOf(lean) >= 0 || lean.indexOf(o) >= 0);
        return h("div", { "data-wk": "block", key: e.id, "data-wk": "spacebookitem", "data-kind": "choices", "data-closed": e.closed ? "1" : "0", style: { marginBottom: 14, background: "#fbfdfe", border: "1px solid #d8e2e7", borderRadius: 14, padding: "14px 14px 12px" } },
          h("button", { onClick: () => setOpenId(open ? null : e.id), className: "w-full text-left", style: { background: "transparent", display: "block" } },
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: "#8a9aa2" } }, who(e.by) + " 的岔路口 · " + dateOf(e.ts)),
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(18px * var(--app-fs, 1))", color: INK, marginTop: 4 } }, STX(e.title || "要决定的事")),
            h("div", { style: { position: "relative", marginTop: 10, paddingLeft: 22 } },
              h("span", { "aria-hidden": "true", style: { position: "absolute", left: 6, top: 0, bottom: 14, width: 2, background: "#c3d0d6" } }),
              (opts.length ? opts : [e.body]).map((o, i) => h("div", { key: i, style: { position: "relative", padding: "5px 0" } },
                h("span", { "aria-hidden": "true", style: { position: "absolute", left: -16, top: 14, width: 14, height: 2, background: lit(o) ? book.band : "#c3d0d6" } }),
                h("span", { style: { display: "inline-block", padding: "4px 10px", borderRadius: 999, fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", lineHeight: 1.5, border: "1px solid " + (lit(o) ? book.band : "#d3dde2"), background: lit(o) ? book.band : "#fff", color: lit(o) ? "#fff" : INK } }, o)))),
            res ? h("div", { style: { marginTop: 8, marginLeft: 22, padding: "6px 10px", background: "#eef3f5", borderLeft: "3px solid " + book.band, fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: INK } }, "后来：" + res.text)
              : lean ? h("div", { style: { marginTop: 6, marginLeft: 22, fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: "#8a9aa2" } }, "当时倾向：" + lean) : null),
          open ? h("div", null, threadOf(e), e.closed ? null : replyBar(e, "line")) : null);
      }));
    }
    // ── 共同署名：一张证书，底下两条签名线，谁认了谁的名字就落上去；两个都签了盖章 ──
    if (book.key === "credit") {
      return h("div", null, list.map(e => { const open = openId === e.id, signed = by => (e.thread || []).some(x => x.by === by && x.kind === "署名");
        const line = by => h("div", { className: "flex-1", style: { textAlign: "center" } },
          h("div", { style: { height: 30, fontFamily: F_HAND, fontSize: "calc(22px * var(--app-fs, 1))", color: signed(by) ? INK : "transparent", borderBottom: "1px solid #9fb5aa" } }, signed(by) ? who(by) : "·"),
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10px * var(--app-fs, 1))", color: "#8aa096", marginTop: 3 } }, by === "me" ? "我" : nm));
        return h("div", { "data-wk": "block", key: e.id, "data-wk": "spacebookitem", "data-kind": "credit", "data-closed": e.closed ? "1" : "0", style: { position: "relative", marginBottom: 16, background: "#fffffb", padding: 6, border: "1px solid #c9d8cf", borderRadius: 4, boxShadow: "0 3px 10px rgba(40,70,55,.08)" } },
          h("button", { "data-wk": "block", onClick: () => setOpenId(open ? null : e.id), className: "w-full text-center", style: { background: "transparent", display: "block", border: "1px solid #dbe6df", padding: "16px 16px 14px" } },
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(11px * var(--app-fs, 1))", letterSpacing: ".5em", color: book.band } }, "兹 证 明"),
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(20px * var(--app-fs, 1))", color: INK, marginTop: 8 } }, STX(e.title || "一件做成的事")),
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", lineHeight: 1.7, color: "#4f5f57", marginTop: 6, whiteSpace: "pre-wrap", maxHeight: open ? "none" : 64, overflow: "hidden" } }, STX(e.body)),
            e.share ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: "#7a8f84", marginTop: 6 } }, "我出的力：" + e.share) : null,
            h("div", { className: "flex", style: { gap: 24, marginTop: 14 } }, line("me"), line("ta")),
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10px * var(--app-fs, 1))", color: "#9fb0a6", marginTop: 8 } }, dateOf(e.ts))),
          e.closed ? h("span", { "data-wk": "spacebookstamp", style: { position: "absolute", right: 16, top: 14, width: 54, height: 54, borderRadius: 999, border: "2px solid " + RED, color: RED, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F_DISPLAY, fontSize: "calc(13px * var(--app-fs, 1))", transform: "rotate(-14deg)", opacity: .8 } }, "共同") : null,
          open ? h("div", { style: { padding: "0 10px 8px" } }, threadOf(e), e.closed ? null : replyBar(e, "line")) : null);
      }));
    }
    // ── 偏心小账：一本账簿，一行一笔，日期｜那件事｜谁偏谁｜回了几句 ──
    if (book.key === "favor") {
      const col = { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: "#9a8763", letterSpacing: ".1em" };
      return h("div", { "data-wk": "block", style: { background: "#fffcf4", border: "1px solid #e3d5b5", borderRadius: 6, boxShadow: "0 2px 8px rgba(90,70,30,.08)", overflow: "hidden" } },
        h("div", { className: "flex", style: { padding: "8px 12px", borderBottom: "2px double #d9c79f", background: "#f8f0dd" } },
          h("div", { style: Object.assign({ width: 42 }, col) }, "日期"), h("div", { className: "flex-1", style: col }, "摘要"), h("div", { style: Object.assign({ width: 58, textAlign: "right" }, col) }, "谁偏谁")),
        list.map(e => { const open = openId === e.id, f = e.who || "ta";
          return h("div", { key: e.id, "data-wk": "spacebookitem", "data-kind": "favor", style: { borderBottom: "1px solid #efe4cc" } },
            h("button", { onClick: () => setOpenId(open ? null : e.id), className: "w-full text-left flex", style: { background: "transparent", padding: "10px 12px", alignItems: "baseline" } },
              h("div", { style: { width: 42, fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: "#9a8763" } }, dateOf(e.ts)),
              h("div", { className: "flex-1", style: { fontFamily: F_HAND, fontSize: "calc(17px * var(--app-fs, 1))", lineHeight: 1.45, color: INK } }, e.title || e.body,
                (e.thread || []).length ? h("span", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: book.band, marginLeft: 6 } }, "+" + e.thread.length) : null),
              h("div", { style: { width: 58, textAlign: "right", fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: book.band } }, f === "ta" ? nm + "→我" : "我→" + nm)),
            open ? h("div", { style: { padding: "0 12px 12px 54px" } },
              e.title && e.body ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: "#6b5a3d", whiteSpace: "pre-wrap" } }, STX(e.body)) : null,
              threadOf(e), replyBar(e, "line")) : null);
        }));
    }
    return null;
  };
  return h("div", { "data-wk": "spacebook", "data-kind": book.key, "data-scene": sc ? "1" : "0", className: "h-full flex flex-col", style: sc ? sc.page : cpSkin(t, "page") },
    h(Head, { zh: book.zh, bg: "transparent", noLine: true, onBack, ink: sc ? sc.ink : undefined }),
    h("div", { className: "flex-1 min-h-0 overflow-y-auto px-4 pb-10" },
      h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: sc ? sc.sub : t.fog, margin: "2px 2px 12px" } }, STX(book.say)),
      !form ? h("div", { className: "flex", style: { gap: 8, marginBottom: 14 } },
        h("button", { "data-wk": "spacebooknew", onClick: startForm, className: "flex-1 active:opacity-70", style: { padding: "11px 0", borderRadius: 12, border: 0, background: book.band, color: "#fff", fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))" } }, VERB[0]),
        book.taNew ? h("button", { "data-wk": "spacebookta", onClick: () => onTa(null), disabled: !!busy, className: "flex-1 active:opacity-70", style: { padding: "11px 0", borderRadius: 12, border: "1px solid " + (sc ? sc.sub : book.band), background: sc ? "rgba(255,255,255,.55)" : "transparent", color: sc ? sc.ink : book.band, fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))" } }, busy === book.key + ":new" ? nm + " 在写…" : VERB[1].replace("{n}", nm)) : null) :
      h("div", { "data-wk": "spacebookform", style: { marginBottom: 14, padding: "12px 13px", borderRadius: 14, background: t.bg2, border: "1px solid " + t.line } },
        book.fields.map(f => field(f, form[f.k], v => setForm(o => Object.assign({}, o, { [f.k]: v })))),
        h("div", { className: "flex", style: { gap: 8, marginTop: 10 } },
          h("button", { onClick: () => setForm(null), className: "active:opacity-70", style: { padding: "9px 14px", borderRadius: 999, border: "1px solid " + t.line, background: "transparent", color: t.sub, fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))" } }, "算了"),
          h("button", { onClick: submit, disabled: !String(form.body || "").trim(), className: "flex-1 active:opacity-70", style: { padding: "9px 0", borderRadius: 999, border: 0, background: String(form.body || "").trim() ? book.band : t.line, color: "#fff", fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))" } }, book.autoAsk ? "记下，让 " + nm + " 看看" : "记下"))),
      OBJ[book.key] && list.length ? objView() : list.length ? list.map(e => {
        const d = draft[e.id] || { kind: book.kinds[0], text: "" };
        const setD = v => setDraft(o => Object.assign({}, o, { [e.id]: Object.assign({}, d, v) }));
        const send = () => { if (!d.text.trim()) return; onReply(e.id, { kind: d.kind, text: d.text.trim() }); setD({ text: "" }); };
        // 每本长成它自己那样东西（她 2026-10-16「判据是如果在别的 app 成立那就是做坏了」）：
        //   案卷是卷宗、观察簿是批注页、对照卡是两面、选择册是岔路、署名是签名页、报平安是一路的站、告状是诉状、小账是账本。
        //   接话那一行、撕掉都共用；长相按 book.key 分。
        const no = list.length - list.indexOf(e);
        const ink = "#2f2a24", paper = "#f6f0e2", red = "#b4463a";
        const tagOf = f => f.tag.replace("{who}", e[f.k] === "ta" ? nm : "我");
        const whoF = book.fields.find(f => f.pick), whoTxt = whoF && e[whoF.k] ? (e[whoF.k] === "ta" ? nm : "我") : "";
        const otherF = book.fields.filter(f => !f.pick && f.k !== "title" && f.k !== "body" && e[f.k]);
        const stamp = (txt, color) => h("div", { "data-wk": "spacebookstamp", style: { position: "absolute", right: 12, top: 10, transform: "rotate(-9deg)", border: "2px solid " + color, color: color, borderRadius: 6, padding: "1px 8px", fontFamily: F_DISPLAY, fontSize: "calc(13px * var(--app-fs, 1))", letterSpacing: ".15em", opacity: .82 } }, txt);
        const date = (dd => (dd.getMonth() + 1) + "." + dd.getDate())(new Date(e.ts));
        const lineOf = (x, i) => {
          const mine = x.by === "me", nmx = who(x.by);
          if (book.key === "safe") return h("div", { key: i, "data-wk": "spacebookline", "data-me": mine ? "1" : "0", style: { position: "relative", paddingLeft: 20, marginTop: 10, fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", lineHeight: 1.6, color: ink } },
            h("span", { style: { position: "absolute", left: 3, top: 5, width: 9, height: 9, borderRadius: 999, background: x.kind === "到了" ? book.band : "#fff", border: "2px solid " + book.band } }),
            h("span", { style: { fontSize: "calc(11px * var(--app-fs, 1))", color: book.band, marginRight: 6 } }, nmx + " · " + x.kind), x.text);
          if (book.key === "advisor" && !mine) return h("div", { key: i, "data-wk": "spacebookline", "data-me": "0", style: { marginTop: 10, padding: "6px 10px", borderLeft: "2px solid " + red, fontFamily: F_HAND, fontSize: "calc(15.5px * var(--app-fs, 1))", lineHeight: 1.6, color: red, transform: "rotate(-.4deg)" } }, h("span", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", marginRight: 6, opacity: .8 } }, "军师批 · " + x.kind), x.text);
          if (book.key === "blackcase" || book.key === "complain") return h("div", { key: i, "data-wk": "spacebookline", "data-me": mine ? "1" : "0", style: { marginTop: 8, fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", lineHeight: 1.7, color: ink } },
            h("span", { style: { color: book.band, fontWeight: 600 } }, nmx), h("span", { style: { color: "#8a7f70" } }, (book.key === "complain" ? " 当庭" : " ") + "【" + x.kind + "】"), x.text);
          if (book.key === "favor") return h("div", { key: i, "data-wk": "spacebookline", "data-me": mine ? "1" : "0", className: "flex", style: { gap: 8, marginTop: 6, paddingTop: 6, borderTop: "1px solid #e6dcc6", fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", lineHeight: 1.6, color: ink } },
            h("span", { style: { width: 42, flexShrink: 0, fontSize: "calc(11px * var(--app-fs, 1))", color: book.band } }, nmx), h("span", { className: "flex-1" }, h("span", { style: { fontSize: "calc(11px * var(--app-fs, 1))", color: "#8a7f70", marginRight: 4 } }, x.kind), x.text));
          return h("div", { key: i, "data-wk": "spacebookline", "data-me": mine ? "1" : "0", style: { marginTop: 8, paddingTop: 8, borderTop: "1px dashed #ddd2bd", fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", lineHeight: 1.65, color: ink, whiteSpace: "pre-wrap" } },
            h("span", { style: { fontSize: "calc(11px * var(--app-fs, 1))", color: book.band, marginRight: 6 } }, nmx + " · " + x.kind), x.text);
        };
        // ── 各本的上半张 ──
        let head;
        if (book.key === "blackcase") head = [
          h("div", { key: "n", style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", letterSpacing: ".2em", color: "#8a7f70" } }, "黑历史 · 第 " + String(no).padStart(3, "0") + " 号 · " + date + " 立案"),
          h("div", { key: "t", style: { fontFamily: F_DISPLAY, fontSize: "calc(19px * var(--app-fs, 1))", color: ink, marginTop: 4, paddingRight: 64 } }, "《" + (e.title || "无名案") + "》"),
          whoTxt ? h("div", { key: "w", style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: book.band, marginTop: 4 } }, "当事人：" + whoTxt + "　·　举报人：" + who(e.by)) : null,
          h("div", { "data-wk": "block", key: "b", style: { fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", lineHeight: 1.8, color: ink, marginTop: 10, padding: "10px 12px", background: "rgba(255,255,255,.55)", borderRadius: 6, whiteSpace: "pre-wrap" } }, h("span", { style: { fontSize: "calc(11px * var(--app-fs, 1))", color: "#8a7f70", marginRight: 6 } }, "案情"), e.body),
          stamp((e.thread || []).some(x => x.kind === "翻案") ? "翻案中" : "在案", red)];
        else if (book.key === "complain") head = [
          h("div", { key: "n", style: { fontFamily: F_DISPLAY, fontSize: "calc(13px * var(--app-fs, 1))", letterSpacing: ".3em", color: "#8a7f70", textAlign: "center" } }, "诉　状"),
          h("div", { key: "p", style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: ink, marginTop: 8, lineHeight: 1.8 } }, "原告：" + who(e.by) + "　被告：" + (whoTxt || "—")),
          h("div", { key: "t", style: { fontFamily: F_DISPLAY, fontSize: "calc(17px * var(--app-fs, 1))", color: ink, marginTop: 2, paddingRight: 64 } }, "诉由：" + (e.title || "")),
          h("div", { key: "b", style: { fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", lineHeight: 1.8, color: ink, marginTop: 6, whiteSpace: "pre-wrap" } }, STX(e.body)),
          e.closed ? stamp("已和解", "#4f7a5a") : stamp("待审", red)];
        else if (book.key === "advisor") head = [
          h("div", { key: "n", style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", letterSpacing: ".15em", color: "#8a7f70" } }, "观察记录 · " + date),
          h("div", { key: "t", style: { fontFamily: F_DISPLAY, fontSize: "calc(17px * var(--app-fs, 1))", color: ink, marginTop: 4 } }, STX(e.title || "一件事")),
          h("div", { key: "b", style: { fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", lineHeight: "26px", color: ink, marginTop: 6, whiteSpace: "pre-wrap", backgroundImage: "repeating-linear-gradient(transparent 0 25px, #e3d8c2 25px 26px)" } }, STX(e.body))];
        else if (book.key === "mouth") head = [
          h("div", { key: "t", style: { fontFamily: F_DISPLAY, fontSize: "calc(16px * var(--app-fs, 1))", color: ink, paddingRight: 64 } }, STX(e.title || "对照卡")),
          whoTxt ? h("div", { key: "w", style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: book.band, marginTop: 2 } }, whoTxt + " 嘴硬") : null,
          h("div", { key: "c", className: "flex", style: { gap: 0, marginTop: 10, borderRadius: 10, overflow: "hidden", border: "1px solid #ddd2bd" } },
            h("div", { style: { flex: 1, padding: "9px 10px", background: "#fff", borderRight: "1px dashed #ccbfa6" } }, h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: "#8a7f70", marginBottom: 4 } }, "当时说的"), h("div", { style: { fontFamily: F_HAND, fontSize: "calc(16px * var(--app-fs, 1))", lineHeight: 1.5, color: ink, whiteSpace: "pre-wrap" } }, "「" + e.body + "」")),
            h("div", { style: { flex: 1, padding: "9px 10px", background: "#efe9f6" } }, h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: book.band, marginBottom: 4 } }, "后来做的"), h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", lineHeight: 1.6, color: e.after ? ink : "#a99f90", whiteSpace: "pre-wrap" } }, e.after || "还没对上"))),
          (e.thread || []).some(x => x.kind === "认领") ? stamp("认了", book.band) : null];
        else if (book.key === "choices") {
          const opts = String(e.body || "").split(/\n|；|;|／|\/|、/).map(x => x.trim()).filter(Boolean);
          const res = (e.thread || []).filter(x => x.kind === "结果").slice(-1)[0];
          head = [
            h("div", { key: "t", style: { fontFamily: F_DISPLAY, fontSize: "calc(17px * var(--app-fs, 1))", color: ink, paddingRight: 64 } }, STX(e.title || "一个决定")),
            h("div", { key: "o", style: { marginTop: 10, display: "flex", flexDirection: "column", gap: 6 } }, (opts.length > 1 ? opts : [e.body]).map((o, k) => h("div", { key: k, className: "flex items-center", style: { gap: 8 } },
              h("span", { style: { width: 18, height: 18, borderRadius: 999, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F_DISPLAY, fontSize: "calc(11px * var(--app-fs, 1))", color: "#fff", background: book.band } }, String.fromCharCode(65 + k)),
              h("span", { style: { fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", color: ink, lineHeight: 1.5 } }, o)))),
            e.lean ? h("div", { key: "l", style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: "#8a7f70", marginTop: 8 } }, who(e.by) + " 当时倾向：" + e.lean) : null,
            res ? h("div", { key: "r", style: { marginTop: 10, padding: "8px 10px", borderRadius: 8, background: "#e5eef0", fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: ink } }, h("span", { style: { fontSize: "calc(11px * var(--app-fs, 1))", color: book.band, marginRight: 6 } }, "后来选了"), res.text) : null,
            e.closed ? stamp("已定", book.band) : null];
        } else if (book.key === "credit") {
          const signed = e.closed;
          head = [
            h("div", { key: "n", style: { fontFamily: F_DISPLAY, fontSize: "calc(11px * var(--app-fs, 1))", letterSpacing: ".35em", color: "#8a7f70", textAlign: "center" } }, "共 同 署 名"),
            h("div", { key: "t", style: { fontFamily: F_DISPLAY, fontSize: "calc(19px * var(--app-fs, 1))", color: ink, textAlign: "center", marginTop: 6 } }, STX(e.title || "一件事")),
            h("div", { key: "b", style: { fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", lineHeight: 1.8, color: ink, marginTop: 8, whiteSpace: "pre-wrap" } }, STX(e.body)),
            otherF.length ? h("div", { key: "s", style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: "#8a7f70", marginTop: 6 } }, who(e.by) + " 出的力：" + e.share) : null,
            h("div", { key: "g", className: "flex", style: { gap: 18, marginTop: 14 } }, ["我", nm].map(n => h("div", { key: n, className: "flex-1", style: { borderBottom: "1px solid " + ink, paddingBottom: 2, textAlign: "center", fontFamily: signed ? F_HAND : F_BODY, fontSize: signed ? 20 : 11, color: signed ? ink : "#a99f90" } }, signed ? n : n + " 签名处")))];
        } else if (book.key === "safe") head = [
          h("div", { key: "t", className: "flex items-center", style: { gap: 8 } },
            h("span", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: "#fff", background: e.closed ? "#4f7a5a" : book.band, borderRadius: 999, padding: "2px 9px" } }, e.closed ? "到了" : "在路上"),
            h("span", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: "#8a7f70" } }, who(e.by) + " · " + date)),
          h("div", { key: "b", style: { position: "relative", paddingLeft: 20, marginTop: 10, fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", lineHeight: 1.6, color: ink, whiteSpace: "pre-wrap" } },
            h("span", { style: { position: "absolute", left: 3, top: 5, width: 9, height: 9, borderRadius: 999, background: book.band } }), e.body)];
        else if (book.key === "favor") head = [
          h("div", { key: "r", className: "flex", style: { gap: 8, fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", color: ink } },
            h("span", { style: { width: 42, flexShrink: 0, fontSize: "calc(11px * var(--app-fs, 1))", color: "#8a7f70", paddingTop: 2 } }, date),
            h("div", { className: "flex-1" },
              h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(16px * var(--app-fs, 1))" } }, STX(e.title || "一笔")),
              whoTxt ? h("div", { style: { fontSize: "calc(11.5px * var(--app-fs, 1))", color: book.band, marginTop: 2 } }, whoTxt + " 偷偷偏心") : null,
              e.body ? h("div", { style: { marginTop: 4, lineHeight: 1.7, whiteSpace: "pre-wrap" } }, STX(e.body)) : null))];
        else head = [h("div", { key: "t", style: { fontFamily: F_DISPLAY, fontSize: "calc(16px * var(--app-fs, 1))", color: ink } }, STX(e.title || "")), h("div", { key: "b", style: { fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", lineHeight: 1.7, color: ink, marginTop: 6, whiteSpace: "pre-wrap" } }, STX(e.body)),
          otherF.map(f => h("div", { key: f.k, style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: "#8a7f70", marginTop: 4 } }, f.zh + "：" + e[f.k])), whoF && e[whoF.k] && whoF.tag ? h("div", { key: "w", style: { fontSize: "calc(11.5px * var(--app-fs, 1))", color: book.band } }, tagOf(whoF)) : null];
        const card = book.key === "favor" ? { background: "linear-gradient(90deg, transparent 49px, #e9c9b5 49px 50px, transparent 50px), #fbf6ea", border: "1px solid #e6dcc6", borderRadius: 4 }
          : book.key === "credit" ? { background: "#fbf8f0", border: "1px solid #d9cfba", borderRadius: 4, boxShadow: "inset 0 0 0 5px #fbf8f0, inset 0 0 0 6px #d9cfba" }
          : book.key === "mouth" ? { background: "#f7f4fb", border: "1px solid #ddd5ea", borderRadius: 14 }
          : book.key === "safe" ? { background: "#fbf7ef", border: "1px solid #e8dcc4", borderRadius: 14 }
          : { background: paper, border: "1px solid #e1d6bf", borderRadius: 6, boxShadow: "0 1px 0 #e1d6bf, 0 3px 0 -1px #f6f0e2, 0 4px 0 -1px #e1d6bf" };
        return h("div", { key: e.id, "data-wk": "spacebookitem", "data-kind": book.key, "data-closed": e.closed ? "1" : "0", style: Object.assign({ position: "relative", marginBottom: 16, padding: "14px 15px" }, card) },
          head,
          (e.thread || []).length ? h("div", { style: { marginTop: book.key === "safe" ? 0 : 10, position: "relative" } },
            book.key === "safe" ? h("span", { style: { position: "absolute", left: 7, top: -14, bottom: 6, width: 1, background: "#d9c9a8" } }) : null,
            e.thread.map(lineOf)) : null,
          h("div", { className: "flex", style: { gap: 5, marginTop: 12, flexWrap: "wrap" } },
            book.kinds.map(k => h("button", { key: k, onClick: () => setD({ kind: k }), className: "active:opacity-70", style: { padding: "3px 9px", borderRadius: 999, fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", border: "1px solid " + (d.kind === k ? book.band : "#ddd2bd"), background: d.kind === k ? book.band : "transparent", color: d.kind === k ? "#fff" : "#8a7f70" } }, k))),
          h("div", { className: "flex", style: { gap: 6, marginTop: 6 } },
            h("input", { "data-wk": "input", value: d.text, onChange: ev => setD({ text: ev.target.value }), placeholder: "接一句…", style: { flex: 1, minWidth: 0, border: "1px solid #ddd2bd", borderRadius: 999, padding: "8px 12px", background: "rgba(255,255,255,.7)", color: ink, fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", outline: "none" } }),
            h("button", { onClick: send, disabled: !d.text.trim(), style: { padding: "8px 12px", borderRadius: 999, border: 0, background: d.text.trim() ? book.band : "#ddd2bd", color: "#fff", fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))" } }, "写上"),
            h("button", { "data-wk": "spacebookask", onClick: () => onTa(e.id), disabled: !!busy, style: { padding: "8px 10px", borderRadius: 999, border: "1px solid " + book.band, background: "transparent", color: book.band, fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", whiteSpace: "nowrap" } }, busy === book.key + ":" + e.id ? "在写…" : "让 " + nm + " 接")),
          h("button", { onClick: () => requestAppConfirm("撕掉这一条？", "这一条和底下接过的话都没了。", () => onRemove(e.id), "撕掉"), className: "active:opacity-60", style: { marginTop: 8, fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: "#a99f90", background: "transparent" } }, "撕掉这一条"));
      }) : h("div", { style: { textAlign: "center", fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.fog, padding: "30px 0" } }, "还是空的。")));
}

function CoupleFirstsBook({ partner, items, onBack }) {
  const t = useTheme();
  const rows = items || [];
  const days = ts => {
    const s = rows[0] && rows[0].key === "since" ? rows[0].ts : 0;
    return s && ts > s ? "第 " + (Math.floor((ts - s) / 86400000) + 1) + " 天" : "";
  };
  return h("div", { "data-wk": "uspage", "data-part": "couplefirstsbook", className: "h-full flex flex-col", style: cpSkin(t, "page") },
    h(Head, { zh: "第一次们", bg: "transparent", noLine: true, onBack }),
    h("div", { className: "flex-1 min-h-0 overflow-y-auto px-4 pb-10" },
      h("div", { style: { borderRadius: 20, border: "1px solid #dfd7ca", background: "#f4f0e8", padding: "15px 15px" } },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(21px * var(--app-fs, 1))", color: "#5e4c38" } }, rows.length ? "走过 " + rows.length + " 个第一次" : "还没有第一次"),
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", lineHeight: 1.7, color: "#8a745e", marginTop: 4 } },
          rows.length ? "这一册不用你记——发生过的事它自己看得见。" : "和 " + (partner.remark || partner.name) + " 一起做点什么，这一册就开始了。")),
      rows.length ? h("div", { style: { marginTop: 16, borderLeft: "1px solid " + t.line, marginLeft: 6, paddingLeft: 16 } },
        rows.map(x => h("div", { key: x.key, style: { position: "relative", paddingBottom: 18 } },
          h("span", { style: { position: "absolute", left: -21, top: 5, width: 9, height: 9, borderRadius: 999, background: /^day/.test(x.key) ? "#c9a227" : t.ink } }),
          h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: "calc(9.5px * var(--app-fs, 1))", letterSpacing: ".1em", color: t.fog } },
            vDate(x.ts, partner.id).toLocaleDateString("zh-CN", { year: "numeric", month: "numeric", day: "numeric" })
            + (days(x.ts) ? " · " + days(x.ts) : "")),
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(17px * var(--app-fs, 1))", color: t.ink, marginTop: 2 } }, x.zh),
          x.note ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", lineHeight: 1.65, color: t.sub, marginTop: 3 } }, "「" + x.note + "」") : null))) : null));
}

// ═══ 情侣空间·照相馆（她 2026-08-31）═══
// 「合照可以单独做一项情侣空间页面叫照相馆。可以引进角色随身物里的衣柜，
//  或者选择重新生成一套约会装放进衣柜然后给我也弄一套衣柜可以生成合照？」
// 我的衣柜跟角色衣柜同一个形状（closetGroups 两边共用），所以这一页两侧的挑衣服
// 是同一套渲染。挑好的两身会【显式写进画面描述】——只挂在衣柜里图像端读不到。
// ⚠️可以挑好几件（她 2026-09-06：「照相馆能不能多选衣服。。。有时候衣服和鞋子
//   都被拆成单件了」）。衣柜里挂的本来就不一定是「一整身」——外套是一件、鞋是一件，
//   只能单选等于逼她二选一，出图那头就永远少一半。
//   value 是一个数组；点一下加进来、再点一下拿掉。
function StudioPicker({ zh, groups, value, onPick, tint, character }) {
  const t = useTheme();
  const picked = Array.isArray(value) ? value : (value ? [value] : []);   // 老调用传字符串也认
  const on = n => picked.indexOf(n) >= 0;
  const toggle = n => onPick(on(n) ? picked.filter(x => x !== n) : picked.concat([n]));
  const sets = [];
  (groups || []).forEach(g => (g.sets || []).forEach(x => sets.push({ occasion: g.occasion, name: x.name, note: x.note })));
  return h("div", { style: { marginTop: 12 } },
    h("div", { className: "flex items-baseline justify-between" },
      h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.sub } },
        zh, picked.length ? h("span", { style: { color: tint, marginLeft: 6 } }, "挑了 " + picked.length + " 件") : null,
        // ⚠️多选是【拼一整套】不是【挑好几套】（她 2026-09-14：模型常把外套/内衫/裤子/
        //   鞋帽各写一条）。不写这一句，多选看着像「挑哪一身都行」。
        picked.length ? null : h("span", { style: { color: t.fog, marginLeft: 6 } }, "可多选，拼成一整套")),
      picked.length ? h("button", { onClick: () => onPick([]), className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog } }, "不指定") : null),
    sets.length
      ? h("div", { className: "flex gap-2 overflow-x-auto", style: { marginTop: 7, paddingBottom: 3 } },
          sets.slice(0, 24).map((x, i) => h("button", {
            key: i, onClick: () => toggle(x.name), className: "active:opacity-70 shrink-0 text-left",
            style: { maxWidth: 176, padding: "7px 11px", borderRadius: 13, border: "1px solid " + (on(x.name) ? tint : t.line), background: on(x.name) ? tint : "transparent" }
          },
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: on(x.name) ? "#fff" : t.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } },
              (x.occasion ? x.occasion + " · " : "") + x.name),
            x.note ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10px * var(--app-fs, 1))", color: on(x.name) ? "rgba(255,255,255,.8)" : t.fog, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, x.note) : null)))
      : h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog, marginTop: 6 } }, characterText(character, "衣柜里还没有——不指定也能拍，或者让他配一套")));
}
function PhotoStudio({ partner, myCloset, charCloset, shots, busy, fitBusy, canShoot, onGenFit, onShoot, onShare, onDelete, onRollStyles, onRollThemes, onBack }) {
  const t = useTheme();
  // 「补一句」写了一大段，退出照相馆再进来就没了（群友 2026-10-17：「我刚写了那么多，一下子全没」）：
  //   跟聊天输入框同一个做法，没拍出去的那段留在本机，拍完也不清（下一张常常还想照着改）
  const sceneKey = "qq_draft:studio:" + ((partner && partner.id) || "");
  const [scene, setSceneRaw] = useState(() => { try { return localStorage.getItem(sceneKey) || ""; } catch (e) { return ""; } });
  const setScene = v => { setSceneRaw(v); try { v ? localStorage.setItem(sceneKey, v) : localStorage.removeItem(sceneKey); } catch (e) {} };
  // 两边都是【一组】衣服，不是一件（v64.34）：衣柜里外套和鞋常常分开挂着
  const [mine, setMine] = useState([]);
  const [theirs, setTheirs] = useState([]);
  const [big, setBig] = useState(null);
  const [grid, setGrid] = useState(false);   // 这一张拍成四宫格大头贴
  const [shotSize, setShotSize] = useState(() => loadJSON("x_studioSize", ""));   // 这一张画多大（她 2026-10-25 群友问）：空＝跟设置里生图那个尺寸
  const [polaroid, setPolaroid] = useState(false);   // 拍立得：白边相框＋他写一行，两小时后才显影（她 2026-10-13）
  const [expand, setExpand] = useState(() => !!loadJSON("x_studioExpand", false));   // 场景加成开关：记住上次怎么选的
  const [theme, setTheme] = useState("");    // 平行时空题材／封面／海报（她 2026-10-12）
  const [themeTick, setThemeTick] = useState(0);
  const themes = typeof window.__studioThemes === "function" ? window.__studioThemes(partner && partner.id) : [];
  const [themeEdit, setThemeEdit] = useState(null);   // { k?, zh, line } 正在写的自定义题材
  // 预设画风（她 2026-10-13：「还有啥有意思的画风」）＋她自己写的（存 x_studioStyles）
  const STYLES = ["漫画", "日系动画", "3D 动画", "水彩", "油画", "铅笔素描", "彩铅绘本", "蜡笔涂鸦", "水墨", "浮世绘", "像素", "Q版", "手办", "黏土", "毛毡", "剪纸", "美式漫画", "复古港风", "蒸汽波"];
  const [myStyles, setMyStyles] = useState(() => { try { const a = loadJSON("x_studioStyles", []); return Array.isArray(a) ? a.filter(x => typeof x === "string" && x.trim()) : []; } catch (e) { return []; } });
  const saveStyles = a => { setMyStyles(a); saveJSON("x_studioStyles", a); };
  // 自己写的画风可以带一段描述（关键词、像谁的画、什么质感），拍和重画时跟着名字一起送去
  const [styleDesc, setStyleDescRaw] = useState(() => { try { return loadJSON("x_studioStyleDesc", {}) || {}; } catch (e) { return {}; } });
  const [styleDescDraft, setStyleDescDraft] = useState("");
  const [rolled, setRolled] = useState([]);
  const [rolledT, setRolledT] = useState([]);    // 模型想出来的题材，还没收下
  const [rollingT, setRollingT] = useState(false);       // 模型想出来、还没收下的那几种
  const [rolling, setRolling] = useState(false);
  const [editOld, setEditOld] = useState("");      // 正在改的是哪一种（改名时把旧的拿掉）
  const keepStyle = (nm, desc) => { if (!myStyles.includes(nm) && !STYLES.includes(nm)) saveStyles(myStyles.concat(nm).slice(-20));
    const n = { ...styleDesc }; if (String(desc || "").trim()) n[nm] = String(desc).trim().slice(0, 300); else delete n[nm]; setStyleDescRaw(n); saveJSON("x_studioStyleDesc", n); };
  // 改名：把旧名字拿掉（描述跟着新名字走）
  const renameStyle = (from, to) => { if (!from || from === to) return; const list = myStyles.filter(x => x !== from); saveStyles(list); const n = { ...styleDesc }; delete n[from]; setStyleDescRaw(n); saveJSON("x_studioStyleDesc", n); };
  const dropStyle = nm => { saveStyles(myStyles.filter(x => x !== nm)); const n = { ...styleDesc }; delete n[nm]; setStyleDescRaw(n); saveJSON("x_studioStyleDesc", n); };
  const [styleDraft, setStyleDraft] = useState(null);
  const [paint, setPaint] = useState("");   // 拍之前就挑画风（空＝照片），一次出图，不用先拍再转
  const [reText, setReText] = useState(true);   // 杂志封面／电影海报换画风后把字照原样印回去
  const doRestyle = async st => {
    const src = bigStack.find(y => !y.style) || big;
    // 有不带字的那一份就拿它去重画（带着字去画，字会被画糊或者干脆没了）
    const ref = (src.rawKey ? await photoDataUrl({ imgKey: src.rawKey }) : "") || await photoDataUrl(src) || await photoDataUrl(big);
    if (!ref) return;
    setSharp(true);
    const row = await onShoot({ scene: src.scene || "", restyle: { ref, style: st, parent: stackKey(big), ...(src.overlay && reText ? { overlay: src.overlay } : {}), ...(src.comicPanels && reText ? { comic: src.comicPanels } : {}) } });
    setSharp(false); if (row) setBig(row);
  };
  const photoDataUrl = async ph => {
    let b = ph && ph.imgKey && typeof idbImgGet === "function" ? await idbImgGet(ph.imgKey).catch(() => null) : null;
    if (!b && ph && ph.imgUrl) { try { b = await (await fetch(ph.imgUrl)).blob(); } catch (e) { b = null; } }
    if (!b) return "";
    return await new Promise(ok => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => ok(""); r.readAsDataURL(b); });
  };
  const [sharp, setSharp] = useState(false);
  const mySets = closetGroups(myCloset);
  const hisSets = closetGroups(charCloset && charCloset.outfit);
  const allRows = (shots || []).filter(x => x.charId === partner.id);
  // 没拍成的那几张（她 2026-10-17）：留在墙上一张卡，能改描述重拍、原样重拍、不要了就删
  const [failTick, setFailTick] = useState(0);
  useEffect(() => { const f = () => setFailTick(x => x + 1); window.addEventListener("lisa-studiofailed", f); return () => window.removeEventListener("lisa-studiofailed", f); }, []);
  const failed = (() => { void failTick; return (loadJSON("x_studioFailed", []) || []).filter(x => x && x.charId === partner.id); })();
  const dropFailed = id => { saveJSON("x_studioFailed", (loadJSON("x_studioFailed", []) || []).filter(x => x && x.id !== id)); setFailTick(x => x + 1); };
  const [failEdit, setFailEdit] = useState(null);   // { id, txt }
  const retryFailed = (f, scene) => { dropFailed(f.id); setFailEdit(null); onShoot(Object.assign({}, f.opt || {}, scene != null ? { scene: scene } : {})); };
  // 一摞（她 2026-10-13）：换画风出来的挂在原图名下。新的带 parentId；旧的没有，就找同一句场景、在它之前、不是换画风的那张
  const stackKey = x => {
    if (x.parentId) return x.parentId;
    if (!x.style) return x.id;
    const src = allRows.filter(y => !y.style && (y.ts || 0) <= (x.ts || 0) && (y.scene || "") === (x.scene || "")).sort((a, b) => (b.ts || 0) - (a.ts || 0))[0];
    return src ? src.id : x.id;
  };
  const stacks = {};
  allRows.forEach(x => { const k = stackKey(x); (stacks[k] = stacks[k] || []).push(x); });
  Object.keys(stacks).forEach(k => stacks[k].sort((a, b) => (a.id === k ? -1 : b.id === k ? 1 : (a.ts || 0) - (b.ts || 0))));
  // 墙上每摞露一张：原图还在就是原图，删了就是下一张顶上
  const covers = Object.keys(stacks).map(k => stacks[k][0]).sort((a, b) => (b.ts || 0) - (a.ts || 0));
  // 分类：合照／四宫格／题材／漫画（她 2026-10-13：图一多会很乱）
  const kindOf = x => x.comic ? "comic" : x.grid ? "grid" : x.theme ? "theme" : x.paint ? "paint" : "photo";
  const KINDS = [["all", "全部"], ["photo", "合照"], ["grid", "四宫格"], ["theme", "题材"], ["paint", "画风"], ["comic", "漫画"]];
  const [kind, setKind] = useState("all");
  const [themeF, setThemeF] = useState("");
  const themeName = k => { const f = themes.find(y => y.k === k); return f ? f.zh : "题材"; };
  const usedThemes = [...new Set(covers.filter(x => x.theme).map(x => x.theme))];
  const rows = covers.filter(x => kind === "all" || (kindOf(x) === kind && (kind !== "theme" || !themeF || x.theme === themeF)));
  const bigStack = big ? (stacks[stackKey(big)] || [big]) : [];
  const stackRef = useRef(null);
  useEffect(() => {   // 点开时滚到点的那一张
    const el = stackRef.current; if (!el || !big) return;
    const i = bigStack.findIndex(y => y.id === big.id);
    if (i >= 0 && Math.abs(el.scrollLeft - i * el.clientWidth) > 4) el.scrollLeft = i * el.clientWidth;
  }, [big && big.id]);
  // 自己写画风的那一块（写名字＋描述、自己的画风列表、让 AI 想几种）：拍之前那排和换画风那排共用这一份
  //   （她 2026-10-17：「为什么只给了换画风那里，还没开拍的时候不能自定义」）。redraw＝在换画风那里（多一颗「存下并重画」）
  const styleEditor = redraw => h(Fragment, null,
          styleDraft !== null ? h("div", { "data-wk": "studiostyleedit", className: "flex items-center", style: { gap: 8, marginTop: 8, border: "1px solid " + t.line, borderRadius: 12, padding: "6px 10px" } },
      h("div", { style: { flex: 1, minWidth: 0 } },
        h("input", { "data-wk": "input", value: styleDraft, onChange: e => { setStyleDraft(e.target.value); if (styleDesc[e.target.value.trim()]) setStyleDescDraft(styleDesc[e.target.value.trim()]); }, maxLength: 40, placeholder: "画风名（如：赛博朋克插画、老式明信片）",
          style: { width: "100%", border: "none", outline: "none", background: "transparent", fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.ink } }),
        h("textarea", { "data-wk": "studiostyledesc", value: styleDescDraft, onChange: e => setStyleDescDraft(e.target.value), rows: 2, maxLength: 300, placeholder: "描述/关键词（可空）：像谁的画、线条、上色、质感、配色……写得越具体越像",
          style: { width: "100%", border: "none", borderTop: "1px dashed " + t.line, outline: "none", resize: "none", background: "transparent", fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.sub, marginTop: 4, paddingTop: 4 } })),
      h("button", { onClick: () => { setStyleDraft(null); setStyleDescDraft(""); setEditOld(""); }, style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.fog } }, "取消"),
      // 只存下、先不画（群友 2026-10-17：「必须重画一张才能保存画风名，好浪费」）
      h("button", { disabled: !styleDraft.trim(), onClick: () => { const v = styleDraft.trim(); renameStyle(editOld, v); keepStyle(v, styleDescDraft); setStyleDraft(null); setStyleDescDraft(""); setEditOld(""); if (!redraw) setPaint(v); },
        className: "disabled:opacity-40", style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: redraw ? "#8a76a0" : "#6d4d8f" } }, redraw ? "只存下" : "存下并选上"),
      redraw && h("button", { disabled: !styleDraft.trim(), onClick: () => { const v = styleDraft.trim(); renameStyle(editOld, v); keepStyle(v, styleDescDraft); setStyleDraft(null); setStyleDescDraft(""); setEditOld(""); doRestyle(v); },
        className: "disabled:opacity-40", style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: "#6d4d8f" } }, "存下并重画")) : null,
    // 自己的画风：点名字改（名字和描述），✕ 删掉；还能让模型想几种，喜欢的收下（收下前也能改）
    styleDraft !== null ? h("div", { "data-wk": "studiomystyles", style: { marginTop: 8 } },
      myStyles.length ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog, marginBottom: 4 } }, "自己的画风：点名字改，点 ✕ 删") : null,
      myStyles.map(st => h("div", { key: st, className: "flex items-start", style: { gap: 8, padding: "6px 0", borderBottom: "1px dashed " + t.line } },
        h("button", { onClick: () => { setStyleDraft(st); setStyleDescDraft(styleDesc[st] || ""); setEditOld(st); }, className: "flex-1 min-w-0 text-left active:opacity-60" },
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.ink } }, st),
          styleDesc[st] ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog, lineHeight: 1.5, marginTop: 2 } }, styleDesc[st]) : null),
        h("button", { onClick: () => dropStyle(st), "aria-label": "删掉 " + st, className: "shrink-0 active:opacity-60", style: { fontSize: "calc(13px * var(--app-fs, 1))", color: t.fog, padding: "0 4px" } }, "✕"))),
      onRollStyles ? h("button", { "data-wk": "studiostyleroll", disabled: rolling, onClick: async () => { setRolling(true); const r = await onRollStyles(STYLES.concat(myStyles, rolled.map(x => x.name)), styleDraft); setRolled(r || []); setRolling(false); },
        className: "active:opacity-70 disabled:opacity-40", style: { marginTop: 8, padding: "6px 12px", borderRadius: 999, border: "1px dashed #b9a6cc", color: "#8a76a0", fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))" } },
        rolling ? "在想…" : rolled.length ? "再想几种" : "让 AI 想几种" + (styleDraft && styleDraft.trim() ? "（照上面写的方向）" : "")) : null,
      rolled.map((x, k) => h("div", { key: x.name + k, className: "flex items-start", style: { gap: 8, padding: "6px 0", borderBottom: "1px dashed " + t.line } },
        h("div", { className: "flex-1 min-w-0" },
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.ink } }, x.name),
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog, lineHeight: 1.5, marginTop: 2 } }, x.desc)),
        h("button", { onClick: () => { keepStyle(x.name, x.desc); setRolled(rolled.filter((_, i2) => i2 !== k)); }, className: "shrink-0 active:opacity-60", style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: "#6d4d8f" } }, "收下"),
        h("button", { onClick: () => { setStyleDraft(x.name); setStyleDescDraft(x.desc); setEditOld(""); setRolled(rolled.filter((_, i2) => i2 !== k)); }, className: "shrink-0 active:opacity-60", style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.sub } }, "改了再收"),
        h("button", { onClick: () => setRolled(rolled.filter((_, i2) => i2 !== k)), "aria-label": "不要", className: "shrink-0 active:opacity-60", style: { fontSize: "calc(13px * var(--app-fs, 1))", color: t.fog, padding: "0 4px" } }, "✕")))) : null);
  return h("div", { "data-wk": "uspage", "data-part": "photostudio", className: "h-full flex flex-col", style: cycSkin(t) },
    h(Head, { zh: big ? "" : "照相馆", bg: "transparent", noLine: true, onBack: () => big ? setBig(null) : onBack() }),
    big
      ? h("div", { className: "flex-1 min-h-0 overflow-y-auto px-4 pb-10" },
          bigStack.length > 1
            ? h("div", null,
                h("div", { ref: stackRef, "data-wk": "studiostack", onScroll: e => { const el = e.currentTarget; const i = Math.round(el.scrollLeft / Math.max(1, el.clientWidth)); const y = bigStack[i]; if (y && y.id !== big.id) setBig(y); },
                  style: { display: "flex", overflowX: "auto", scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch", scrollbarWidth: "none" } },
                  bigStack.map(y => h("div", { key: y.id, style: { flex: "0 0 100%", scrollSnapAlign: "center", display: "flex", justifyContent: "center" } }, h(AlbumPhoto, { photo: y, full: true })))),
                h("div", { style: { textAlign: "center", fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.fog, marginTop: 8 } },
                  (big.style ? big.style : big.paint ? "原图 · " + big.paint : "原图") + " · " + (bigStack.findIndex(y => y.id === big.id) + 1) + " / " + bigStack.length + " · 左右划看这一摞"))
            : h("div", { className: "flex justify-center" }, h(AlbumPhoto, { photo: big, full: true })),
          big.grid === "2x2" ? h(GridCells, { photo: big, rows: 2, cols: 2, sharpBusy: sharp || busy,
            onSharpen: async (cell, i) => { setSharp(true);
              const row = await onShoot({ scene: (big.scene || "") + "（四宫格第 " + (i + 1) + " 格，拍成单张）", mine: big.mine, theirs: big.theirs, cellRef: cell });
              setSharp(false); if (row) setBig(row); } }) : null,
          // 换画风：拿这张当底，整张重画成另一种画法（花一次生图，拍好是新的一张，原来那张还在）
          h("div", { "data-wk": "studiorestyle", className: "flex items-center flex-wrap", style: { gap: 6, marginTop: 12 } },
            h("span", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.fog } }, sharp ? "在重画…" : "换画风："),
            STYLES.concat(myStyles).map(st => h("button", { key: st, disabled: !!(sharp || busy), onClick: () => doRestyle(st),
              className: "active:opacity-70 disabled:opacity-40", style: { padding: "5px 11px", borderRadius: 999, border: "1px " + (myStyles.includes(st) ? "dashed " : "solid ") + t.line, fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.sub } }, st)),
            h("button", { "data-wk": "studiostyleadd", disabled: !!(sharp || busy), onClick: () => setStyleDraft(""), className: "active:opacity-70 disabled:opacity-40",
              style: { padding: "5px 11px", borderRadius: 999, border: "1px dashed #b9a6cc", color: "#8a76a0", fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))" } }, "＋自己写")),
          ((bigStack.find(y => !y.style) || big).overlay || (bigStack.find(y => !y.style) || big).comicPanels) ? h("button", { "data-wk": "studioretext", "data-on": reText ? "1" : "0", onClick: () => setReText(v => !v), className: "active:opacity-70",
            style: { marginTop: 8, display: "flex", alignItems: "center", gap: 8, fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.sub } },
            h("span", { style: { width: 16, height: 16, borderRadius: 4, border: "1.5px solid " + t.ink, background: reText ? t.ink : "transparent", color: t.bg2, fontSize: "calc(11px * var(--app-fs, 1))", lineHeight: "13px", textAlign: "center" } }, reText ? "✓" : ""),
            (bigStack.find(y => !y.style) || big).comicPanels ? "重画后把四格台词照原样排回去" : "重画后把封面上的字照原样印回去") : null,
          styleEditor(true),

          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", lineHeight: 1.75, color: t.sub, marginTop: 12 } }, typeof clipAtSentence === "function" ? clipAtSentence(big.scene || "") : (big.scene || "")),
          h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: "calc(10px * var(--app-fs, 1))", color: t.fog, marginTop: 6 } }, gachaWhen(big.ts)),
          // 发过去时把 desc 一起带上：拍的时候就写好了（场景 + 两身衣服），
          // 所以聊天历史里自带上下文，以后她说「上次那张」TA接得上
          h("button", { onClick: () => onShare(big), className: "w-full active:opacity-70", style: { marginTop: 16, borderRadius: 14, padding: "12px 0", background: "#6d4d8f", color: "#fff", fontFamily: F_DISPLAY, fontSize: "calc(15px * var(--app-fs, 1))" } },
            "发给 " + (partner.remark || partner.name)),
          onDelete ? h("button", { onClick: () => { onDelete(big); setBig(null); }, className: "w-full active:opacity-70", style: { marginTop: 8, borderRadius: 14, padding: "10px 0", background: "transparent", border: "1px solid " + t.line, color: t.fog, fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))" } },
            "删掉这张") : null)
      : h("div", { className: "flex-1 min-h-0 overflow-y-auto px-4 pb-10" },
          h("div", { style: { borderRadius: 20, border: "1px solid #e2d9ea", background: "linear-gradient(140deg,#faf6fd,#f2ecf7)", padding: "15px 15px" } },
            themes.length ? h("div", { "data-wk": "studiothemes", className: "flex flex-wrap", style: { gap: 6, marginBottom: 10 } },
              h("span", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: "#8a76a0", alignSelf: "center" } }, "题材"),
              themes.map(x => h("button", { key: x.k, "data-on": theme === x.k ? "1" : "0", onClick: () => setTheme(v => v === x.k ? "" : x.k), className: "active:opacity-70",
                style: { padding: "5px 11px", borderRadius: 999, border: "1px solid " + (theme === x.k ? "#6d4d8f" : "#e2d9ea"), background: theme === x.k ? "#6d4d8f" : "#fff", color: theme === x.k ? "#fff" : "#8a76a0", fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))" } }, x.zh + (x.custom && theme === x.k ? " ✎" : ""))),
              h("button", { "data-wk": "studiothemeadd", onClick: () => { const cur = themes.find(x => x.k === theme && x.custom); setThemeEdit(cur ? { k: cur.k, zh: cur.zh, line: cur.line || "" } : { zh: "", line: "" }); }, className: "active:opacity-70",
                style: { padding: "5px 11px", borderRadius: 999, border: "1px dashed #b9a6cc", background: "transparent", color: "#8a76a0", fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))" } }, themes.some(x => x.k === theme && x.custom) ? "改这个题材" : "＋自己写")) : null,
            themeEdit ? h("div", { "data-wk": "studiothemeedit", style: { border: "1px solid #e2d9ea", borderRadius: 12, padding: 10, marginBottom: 10, background: "#fff" } },
              h("input", { "data-wk": "input", value: themeEdit.zh, onChange: e => setThemeEdit({ ...themeEdit, zh: e.target.value }), placeholder: "题材名（如：赛博朋克、民国、同桌）", maxLength: 12,
                style: { width: "100%", border: "none", borderBottom: "1px solid #eee", padding: "4px 0", fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", outline: "none", background: "transparent" } }),
              h("textarea", { "data-wk": "textarea", value: themeEdit.line, onChange: e => setThemeEdit({ ...themeEdit, line: e.target.value }), rows: 2, maxLength: 300, placeholder: "这个世界里你们是什么样（穿什么、在哪、什么身份），可空",
                style: { width: "100%", border: "none", padding: "6px 0", fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", outline: "none", resize: "none", background: "transparent" } }),
              h("div", { className: "flex", style: { gap: 8, justifyContent: "flex-end" } },
                themeEdit.k ? h("button", { onClick: () => { window.__studioThemeDel(themeEdit.k); if (theme === themeEdit.k) setTheme(""); setThemeEdit(null); setThemeTick(n => n + 1); }, style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: "#c25a4a" } }, "删掉") : null,
                h("button", { onClick: () => setThemeEdit(null), style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: "#8a76a0" } }, "取消"),
                h("button", { onClick: () => { const k = window.__studioThemeSave(themeEdit.zh, themeEdit.line, themeEdit.k); if (k) { setTheme(k); setThemeEdit(null); setThemeTick(n => n + 1); } }, disabled: !themeEdit.zh.trim(), className: "disabled:opacity-40", style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: "#6d4d8f" } }, "存下"))) : null,
            onRollThemes ? h("div", { "data-wk": "studiothemeroll", style: { marginBottom: 10 } },
              h("button", { disabled: rollingT, onClick: async () => { setRollingT(true); const r = await onRollThemes(themes.map(x => x.zh), themeEdit && themeEdit.zh); setRolledT(r || []); setRollingT(false); },
                className: "active:opacity-70 disabled:opacity-40", style: { padding: "5px 11px", borderRadius: 999, border: "1px dashed #b9a6cc", background: "transparent", color: "#8a76a0", fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))" } },
                rollingT ? "在想…" : rolledT.length ? "再想几个题材" : "让 AI 想几个题材"),
              rolledT.map((x, k) => h("div", { key: x.zh + k, className: "flex items-start", style: { gap: 8, padding: "6px 0", borderBottom: "1px dashed #e2d9ea" } },
                h("div", { className: "flex-1 min-w-0" },
                  h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: "#5a4670" } }, x.zh),
                  h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: "#8a76a0", lineHeight: 1.5, marginTop: 2 } }, x.line)),
                h("button", { onClick: () => { const k2 = window.__studioThemeSave && window.__studioThemeSave(x.zh, x.line); if (k2) { setThemeTick(n => n + 1); } setRolledT(rolledT.filter((_, i2) => i2 !== k)); }, className: "shrink-0 active:opacity-60", style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: "#6d4d8f" } }, "收下"),
                h("button", { onClick: () => { setThemeEdit({ zh: x.zh, line: x.line }); setRolledT(rolledT.filter((_, i2) => i2 !== k)); }, className: "shrink-0 active:opacity-60", style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: "#8a76a0" } }, "改了再收"),
                h("button", { onClick: () => setRolledT(rolledT.filter((_, i2) => i2 !== k)), "aria-label": "不要", className: "shrink-0 active:opacity-60", style: { fontSize: "calc(13px * var(--app-fs, 1))", color: "#b9a6cc", padding: "0 4px" } }, "✕")))) : null,
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: "#8a76a0" } }, theme === "magazine" ? "封面大标题（会排在封面上）" : theme === "movie" ? "片名（会排在海报上）" : theme ? "补一句（可空：在哪儿、什么表情）" : "这张要拍什么"),
            h("textarea", {
              value: scene, onChange: e => setScene(e.target.value), rows: 2,
              placeholder: "在哪儿、什么时候、你俩在做什么",
              className: "w-full outline-none resize-none",
              style: { marginTop: 7, borderRadius: 13, border: "1px solid #e2d9ea", background: "#fff", color: t.ink, padding: "10px 11px", fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", lineHeight: 1.6 }
            }),
            h(StudioPicker, { zh: partner.remark || partner.name + " 穿", groups: hisSets, value: theirs, onPick: setTheirs, tint: "#7c5aa6", character: partner }),
            h(StudioPicker, { zh: "我穿", groups: mySets, value: mine, onPick: setMine, tint: "#a74d70", character: partner }),
            // 两行（她 2026-10-13：「这个按键太挤了重做排版」——四颗挤一行，「拍一张四宫格」被挤成竖排）：
            //   上一行挑拍成什么（三选一、等宽）；下一行左边「让他配一对」、右边整条的拍摄键
            // 画风一排：横着划，第一个「照片」就是不换；挑了别的就一次直接画成那样（只花一次生图）
            h("div", { "data-wk": "studiopaint", className: "flex items-center", style: { gap: 6, marginTop: 12, overflowX: "auto", WebkitOverflowScrolling: "touch", paddingBottom: 2 } },
              h("span", { className: "shrink-0", style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: "#8a76a0" } }, "画风"),
              [""].concat(STYLES, myStyles.filter(x => !STYLES.includes(x))).map(st => h("button", { key: st || "_photo", "data-on": paint === st ? "1" : "0", onClick: () => setPaint(st), className: "shrink-0 active:opacity-70",
                style: { padding: "5px 11px", borderRadius: 999, whiteSpace: "nowrap", border: "1px solid " + (paint === st ? "#6d4d8f" : "#e2d9ea"), background: paint === st ? "#6d4d8f" : "#fff", color: paint === st ? "#fff" : "#8a76a0", fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))" } }, st || "照片")),
              h("button", { "data-wk": "studiostyleadd", onClick: () => setStyleDraft(v => v === null ? "" : null), className: "shrink-0 active:opacity-70",
                style: { padding: "5px 11px", borderRadius: 999, whiteSpace: "nowrap", border: "1px dashed #b9a6cc", background: "transparent", color: "#8a76a0", fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))" } }, "＋自己写")),
            !big ? styleEditor(false) : null,
            h("div", { "data-wk": "studiomodes", className: "flex", style: { marginTop: 14, padding: 3, borderRadius: 13, border: "1px solid " + t.line, gap: 3 } },
              h("button", { "data-wk": "studiosingle", "data-on": !grid && !polaroid ? "1" : "0", onClick: () => { setGrid(false); setPolaroid(false); }, className: "flex-1 active:opacity-70",
                style: { borderRadius: 10, padding: "8px 0", whiteSpace: "nowrap", background: !grid && !polaroid ? "#6d4d8f" : "transparent", color: !grid && !polaroid ? "#fff" : t.sub, fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))" } }, "单张"),
              h("button", { "data-wk": "studiogrid", "data-on": grid ? "1" : "0", onClick: () => { setGrid(true); setPolaroid(false); }, className: "flex-1 active:opacity-70",
                style: { borderRadius: 10, padding: "8px 0", whiteSpace: "nowrap", background: grid ? "#6d4d8f" : "transparent", color: grid ? "#fff" : t.sub, fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))" } }, "四宫格"),
              h("button", { "data-wk": "studiopolaroid", "data-on": polaroid ? "1" : "0", onClick: () => { setPolaroid(true); setGrid(false); }, className: "flex-1 active:opacity-70",
                style: { borderRadius: 10, padding: "8px 0", whiteSpace: "nowrap", background: polaroid ? "#6d4d8f" : "transparent", color: polaroid ? "#fff" : t.sub, fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))" } }, "拍立得")),
            !grid ? h("div", { "data-wk": "studiosize", className: "flex items-center", style: { gap: 6, marginTop: 10 } },
              h("span", { className: "shrink-0", style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: "#8a76a0" } }, "尺寸"),
              [["", "跟设置"], ["1024x1536", "竖"], ["1024x1024", "方"], ["1536x1024", "横"]].map(([v, zh]) => h("button", { key: v || "_def", "data-on": shotSize === v ? "1" : "0", onClick: () => { setShotSize(v); saveJSON("x_studioSize", v); }, className: "flex-1 active:opacity-70",
                style: { padding: "5px 0", borderRadius: 999, whiteSpace: "nowrap", border: "1px solid " + (shotSize === v ? "#6d4d8f" : "#e2d9ea"), background: shotSize === v ? "#6d4d8f" : "#fff", color: shotSize === v ? "#fff" : "#8a76a0", fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))" } }, zh))) : null,
            h("button", { "data-wk": "studioexpand", "data-on": expand ? "1" : "0", onClick: () => { const v = !expand; setExpand(v); saveJSON("x_studioExpand", v); }, className: "w-full flex items-center gap-2 active:opacity-70",
                style: { marginTop: 10, padding: "8px 2px", textAlign: "left", background: "transparent" } },
              h("span", { style: { width: 16, height: 16, borderRadius: 5, flexShrink: 0, border: "1.5px solid " + (expand ? "#6d4d8f" : "#cbbfd8"), background: expand ? "#6d4d8f" : "transparent", color: "#fff", fontSize: "calc(11px * var(--app-fs, 1))", lineHeight: "13px", textAlign: "center" } }, expand ? "✓" : ""),
              h("span", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.sub, lineHeight: 1.5 } }, "让他先把这一句写成画面",
                h("span", { style: { color: t.fog, fontSize: "calc(11px * var(--app-fs, 1))" } }, "（补上光、环境、你们在做什么和他此刻在哪，像线下那样；每张多一次文字调用。题材、换画风不管这个）"))),
            h("div", { className: "flex gap-2", style: { marginTop: 10 } },
              h("button", { onClick: () => onGenFit(scene), disabled: !!fitBusy, className: "active:opacity-70 shrink-0", style: { borderRadius: 13, padding: "11px 14px", whiteSpace: "nowrap", border: "1px solid " + t.line, background: "transparent", color: t.sub, fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))" } },
                fitBusy ? "配着…" : characterText(partner, "让他配一对")),
              h("button", { onClick: () => onShoot({ scene, mine: mine.join("、"), theirs: theirs.join("、"), grid, theme, polaroid, paint, expand, ...(shotSize && !grid ? { size: shotSize } : {}) }), disabled: !!busy || !(scene.trim() || theme || polaroid || grid), className: "flex-1 active:opacity-70", style: { borderRadius: 13, padding: "11px 0", whiteSpace: "nowrap", background: (busy || !(scene.trim() || theme || polaroid || grid)) ? "#e0d6e8" : "#6d4d8f", color: (busy || !(scene.trim() || theme || polaroid || grid)) ? "#a897b4" : "#fff", fontFamily: F_DISPLAY, fontSize: "calc(15px * var(--app-fs, 1))" } },
                busy ? "在拍了…" : grid ? "拍一张四宫格" : polaroid ? "咔嚓" : "拍一张")),
            !canShoot ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: "#a0708a", marginTop: 9, lineHeight: 1.6 } },
              "合照要你俩都设了参考照才锁得住脸——去人格档案馆和「我」那边各传一张；图像 API 也要在设置里配好。") : null),
          failed.length ? h("div", { "data-wk": "studiofailed", style: { marginTop: 16, display: "flex", flexDirection: "column", gap: 8 } },
            failed.map(f => h("div", { key: f.id, "data-wk": "studiofailcard", style: { borderRadius: 14, border: "1px dashed #c9a0b4", background: "rgba(255,255,255,.55)", padding: "11px 13px" } },
              h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: "#7a4a62" } }, "这张没拍成"),
              h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: "#a0708a", marginTop: 3, lineHeight: 1.6 } }, "原因：" + (f.err || "没拿到图")),
              failEdit && failEdit.id === f.id
                ? h("div", { style: { marginTop: 8 } },
                    h("textarea", { "data-wk": "textarea", value: failEdit.txt, onChange: e => setFailEdit({ id: f.id, txt: e.target.value }), rows: 3, autoFocus: true, className: "w-full outline-none p-2.5 rounded-lg", style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", lineHeight: 1.7, color: "#4a3040", background: "#fff", border: "1px solid #e6d3dc" } }),
                    h("div", { className: "flex gap-4 mt-2 justify-end" },
                      h("button", { onClick: () => setFailEdit(null), style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: "#a0708a" } }, "算了"),
                      h("button", { disabled: !!busy, onClick: () => retryFailed(f, failEdit.txt), className: "disabled:opacity-40", style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: "#a8505f" } }, "照这个重拍")))
                : h("div", { className: "flex gap-4 mt-2 justify-end" },
                    h("button", { onClick: () => dropFailed(f.id), style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: "#a0708a" } }, "不要了"),
                    h("button", { onClick: () => setFailEdit({ id: f.id, txt: String((f.opt && f.opt.scene) || "") }), style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: "#7a4a62" } }, "改描述再拍"),
                    h("button", { disabled: !!busy, onClick: () => retryFailed(f), className: "disabled:opacity-40", style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: "#a8505f" } }, "原样重拍"))))) : null,
          covers.length ? h("div", { "data-wk": "studiokinds", className: "flex flex-wrap", style: { gap: 6, marginTop: 16 } },
            KINDS.filter(([k]) => k === "all" || covers.some(x => kindOf(x) === k)).map(([k, zh]) => h("button", { key: k, "data-on": kind === k ? "1" : "0", onClick: () => { setKind(k); setThemeF(""); }, className: "active:opacity-70",
              style: { padding: "5px 12px", borderRadius: 999, border: "1px solid " + (kind === k ? "#6d4d8f" : t.line), background: kind === k ? "#6d4d8f" : "transparent", color: kind === k ? "#fff" : t.sub, fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))" } },
              zh + " " + (k === "all" ? covers.length : covers.filter(x => kindOf(x) === k).length)))) : null,
          kind === "theme" && usedThemes.length > 1 ? h("div", { className: "flex flex-wrap", style: { gap: 6, marginTop: 8 } },
            [""].concat(usedThemes).map(k => h("button", { key: k || "_", onClick: () => setThemeF(k), className: "active:opacity-70",
              style: { padding: "4px 10px", borderRadius: 999, border: "1px solid " + (themeF === k ? "#a74d70" : t.line), color: themeF === k ? "#a74d70" : t.fog, fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))" } }, k ? themeName(k) : "都看"))) : null,
          rows.length
            ? h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 } },
                // AlbumPhoto(cover) 是 absolute；卡片必须自己当定位边界。漏掉 relative 时，
                // 图片一从 IDB 加载完就会铺满整页，还会把顶栏返回键的点击截成「打开大图」。
                rows.map(x => h("button", { key: x.id, onClick: () => setBig(x), className: "active:opacity-80", style: { position: "relative", borderRadius: 15, overflow: "hidden", border: "1px solid " + t.line, background: "#20141f", aspectRatio: "3/4", padding: 0 } },
                  h(AlbumPhoto, { photo: x, cover: true }),
                  // 一摞：右上角叠出两道纸边＋张数
                  (stacks[stackKey(x)] || []).length > 1 ? h("span", { "data-wk": "studiostackbadge", style: { position: "absolute", top: 8, right: 8, minWidth: 22, height: 22, padding: "0 6px", borderRadius: 11, background: "rgba(255,255,255,.9)", boxShadow: "3px 3px 0 rgba(255,255,255,.55), 6px 6px 0 rgba(255,255,255,.3)", color: "#6d4d8f", fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", lineHeight: "22px", textAlign: "center" } }, (stacks[stackKey(x)] || []).length) : null)))
            : h("div", { style: { border: "1px dashed " + t.line, borderRadius: 16, padding: "28px 16px", marginTop: 16, textAlign: "center", fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.fog, lineHeight: 1.8 } },
                covers.length ? "这一类还没有。" : "还没在这儿拍过。", h("div", { style: { marginTop: 4 } }, "拍出来的会同时挂上合照墙。"))));
}

// ═══ 情侣空间·另一种我们（她 2026-08-31 提；v64.05 改的名）═══
// ⚠️改名只改【看得见的字】：存档键、组件名 IfRoom、IF_* 那几个常量、sub === "ifroom"
//   一律不动——改了她的旧存档就读不出来了。
// 为什么不叫「如果馆」了（她 2026-09-05 定）：「如果」是谁都能用的词，
// 换个 app、换个角色照样成立，等于没说这是什么（tabs-not-plain-pills.md 那条判据）。
// 「另一种我们」搬不走：它得先真有你俩这段关系（在一起第几天、关系网上写着什么）
// 才立得住，而这正是这一处比别家多的那样东西。
// 「可以做这种游戏对话框样式（不要照抄，我们自己设计一下样式）」——所以这一页
// 走【暗色】：情侣空间其余都是米白纸感，一进来就知道这不是主线，是平行时空。
// 一个框一口气读完，点一下出下一个；右边一条侧栏翻已经过去的（照跑团那个），
// 免得点完就忘。她的回合能先攒几条再一起发。
const IF_INK = "#e8e4ee", IF_DIM = "rgba(232,228,238,.52)", IF_LINE = "rgba(232,228,238,.16)";
const IF_ACCENT = "#8d76c9";
// mine＝这一框是她说的。她 2026-08-31：「我发的消息没有名字，做跟角色名字一样，
// 他们名字在框左上边我的在右上边」。
// ⚠️她那几框存下来的时候 who 是空的（跟旁白一个样），光看 box 分不出来——
// 要看这一拍的 role。所以名字从外面传进来，别在这儿猜。
//
// v59.14 重做长相。原来的框是【圆角 + 一圈细描边 + 半透明底】，跟它正下方那个
// 输入框长得一模一样——同样的圆角、同样的描边、同样的暗底，一屏上三种东西
// （旁白框、对话框、输入框）全是同一个观感，看着就不像「一个游戏对话框」。
// 现在按视觉小说那套来：
//   · 台词框＝实心底 + 上沿一条高光 + 名字牌是实心小牌 + 右下角一个会跳的小三角；
//   · 旁白框＝没有高光、没有名字牌、底更透、居中斜体——一眼就跟台词分得开；
function IfBox({ box, charName, uName, mine, tick }) {
  const narr = !mine && !box.who;
  const name = mine ? (uName || "我") : charName;
  return h("div", {
    style: {
      position: "relative", marginTop: narr ? 0 : 13,
      borderRadius: 16, overflow: "hidden",
      background: narr ? "rgba(16,13,26,.55)" : "rgba(23,19,38,.93)",
      backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
      border: narr ? "1px solid rgba(232,228,238,.09)" : "1px solid rgba(141,118,201,.34)",
      boxShadow: narr ? "none" : "0 10px 30px rgba(0,0,0,.45)",
      padding: narr ? "19px 22px" : "20px 19px 22px"
    }
  },
    // 上沿那条高光：只有台词框有，是它跟旁白/输入框最直接的一处区别
    narr ? null : h("div", {
      key: "lit",
      style: {
        position: "absolute", top: 0, left: 0, right: 0, height: 1,
        background: mine
          ? "linear-gradient(270deg,rgba(141,118,201,.9),rgba(141,118,201,0))"
          : "linear-gradient(90deg,rgba(141,118,201,.9),rgba(141,118,201,0))"
      }
    }),
    narr ? null : h("div", {
      key: "who",
      className: "flex",
      style: { justifyContent: mine ? "flex-end" : "flex-start", marginBottom: 9 }
    }, h("span", {
      style: {
        padding: "3px 12px", borderRadius: 8, maxWidth: "62%",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        background: "rgba(141,118,201,.22)", border: "1px solid rgba(141,118,201,.34)",
        fontFamily: F_DISPLAY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: "#cdbdf0", letterSpacing: ".04em"
      }
    }, name)),
    h("div", {
      key: "t",
      style: {
        fontFamily: F_BODY, fontSize: "calc(15.5px * var(--app-fs, 1))", lineHeight: 2.05,
        color: narr ? IF_DIM : IF_INK,
        fontStyle: narr ? "italic" : "normal",
        textAlign: narr ? "center" : mine ? "right" : "left"
      }
    }, STX(box.text)),
    // 「点一下继续」原来是底下一行灰字，几乎看不见。游戏里这个位置本来就该有个会动的角标。
    tick ? h("div", {
      key: "tk",
      style: {
        position: "absolute", right: 13, bottom: 9, width: 0, height: 0,
        borderLeft: "5px solid transparent", borderRight: "5px solid transparent",
        borderTop: "6px solid " + IF_ACCENT, animation: "if-tick 1.15s ease-in-out infinite"
      }
    }) : null);
}
// 收线时那三个去处。列表上收和线里收用的是同一份——一层只写一处。
const IF_ENDINGS = [
  ["keep", "只留在馆里", "主线一个字都不知道"],
  ["mem", "记进记忆库", "TA会记得你俩一起想过这条线——标着这是个如果，不会当成真发生过"],
  ["seed", "留成一个念头", "进TA的心上当一张观测纸条，发不发芽TA自己定"]
];
function IfEndPick({ onPick, onClose, character }) {
  return h("div", { onClick: onClose, style: { position: "absolute", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 30, display: "flex", alignItems: "center", justifyContent: "center", padding: 22 } },
    h("div", { onClick: e => e.stopPropagation(), style: { width: "100%", borderRadius: 18, border: "1px solid " + IF_LINE, background: "#15121e", padding: "18px 17px" } },
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(18px * var(--app-fs, 1))", color: IF_INK } }, "这条就到这儿"),
      h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: IF_DIM, lineHeight: 1.8, marginTop: 5 } }, "它要留在哪儿？"),
      IF_ENDINGS.map(([k, zh, sub]) =>
        h("button", { key: k, onClick: () => onPick(k), className: "w-full text-left active:opacity-70", style: { marginTop: 10, borderRadius: 13, border: "1px solid " + IF_LINE, padding: "11px 13px" } },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(15px * var(--app-fs, 1))", color: IF_INK } }, zh),
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: IF_DIM, lineHeight: 1.6, marginTop: 3 } }, characterText(character, sub))))));
}
// 和好间（v59.19）。整页，不用半窗（施工规则/no-half-sheet.md）。
// ⚠️这一页只做两件事：摆出【TA没说出口的那一半】，和让她递一句过去。
// 别把聊天记录再列一遍——那是「同一份数据换个地方摆第二遍」，她刚因为这个
// 撤掉了外卖那栏「写给陌生人」。
const MK_INK = "#3a2f2c", MK_DIM = "#93857f", MK_LINE = "rgba(58,47,44,.12)", MK_ACC = "#a0685c";
function MakeupRoom({ partner, data, signal, busy, onOpen, onSay, onClose, onBack }) {
  const [typing, setTyping] = useState("");
  const [ending, setEnding] = useState(false);
  const bodyRef = useRef(null);
  const name = partner.remark || partner.name;
  React.useEffect(function () { if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight; }, [data && (data.turns || []).length, busy]);
  const send = () => { const v = typing.trim(); if (!v || busy) return; setTyping(""); onSay(v); };
  const head = h(Head, { zh: "和好间", bg: "transparent", noLine: true, ink: MK_INK, onBack,
    right: data ? h("button", { onClick: () => setEnding(true), className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: MK_DIM, padding: "8px 4px" } }, "过去了") : null });
  if (!data) {
    return h("div", { "data-wk": "uspage", "data-part": "makeuproom", className: "h-full flex flex-col", style: { background: "#faf7f5" } }, head,
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-5 pb-10" },
        h("div", { style: { borderRadius: 18, border: "1px solid " + MK_LINE, background: "#fff", padding: "20px 18px", marginTop: 6 } },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(17px * var(--app-fs, 1))", lineHeight: 1.6, color: MK_INK } },
            signal && signal.on ? signal.why : "这会儿看着没什么事"),
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", lineHeight: 1.9, color: MK_DIM, marginTop: 12 } },
            characterText(partner, "推开这扇门，先看他心里那一半——不是他会讲给你听的那一半。他可能还在气头上，也可能只是说不出口。看完你再决定要不要递一句过去。")),
          h("button", { onClick: onOpen, disabled: !!busy, className: "w-full active:opacity-70", style: { marginTop: 16, borderRadius: 12, padding: "12px 0", background: busy ? "rgba(58,47,44,.1)" : MK_ACC, color: busy ? MK_DIM : "#fff", fontFamily: F_DISPLAY, fontSize: "calc(15px * var(--app-fs, 1))" } },
            busy ? characterText(partner, "他在想……") : "推开门")),
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", lineHeight: 1.9, color: MK_DIM, padding: "16px 4px 0" } },
          characterText(partner, "⚠️这里说的话不会替你在聊天里说出去。要真的和好，还得你自己去跟他讲。"))));
  }
  const turns = data.turns || [];
  return h("div", { "data-wk": "uspage", "data-part": "makeuproom", className: "h-full flex flex-col", style: { background: "#faf7f5" } }, head,
    h("div", { ref: bodyRef, className: "flex-1 min-h-0 overflow-y-auto px-5", style: { paddingBottom: 12 } },
      data.why ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: MK_DIM, padding: "2px 2px 12px" } }, data.why) : null,
      // TA心里那一半：刻意做成【手写的一页】，不是聊天气泡——它不是说给她听的
      h("div", { "data-wk": "block", style: { borderRadius: 4, background: "#fffdfa", border: "1px solid " + MK_LINE, borderLeft: "3px solid " + MK_ACC, padding: "18px 17px", boxShadow: "0 2px 12px rgba(58,47,44,.05)" } },
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", letterSpacing: ".04em", color: MK_DIM, marginBottom: 10 } }, characterText(partner, "他心里那半句")),
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(14.5px * var(--app-fs, 1))", lineHeight: 2.05, color: MK_INK, whiteSpace: "pre-wrap", wordBreak: "break-word" } }, data.his),
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: MK_DIM, marginTop: 12, paddingTop: 10, borderTop: "1px dashed " + MK_LINE } },
          name + "没打算让你看见这一段")),
      turns.map((t, i) => h("div", { key: i, style: { marginTop: 16 } },
        h("div", { className: "flex justify-end" },
          h("div", { style: { maxWidth: "82%", borderRadius: "14px 14px 4px 14px", background: MK_ACC, color: "#fff", padding: "11px 14px", fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", lineHeight: 1.8, wordBreak: "break-word" } }, t.me)),
        t.his ? h("div", { className: "flex", style: { marginTop: 10 } },
          h("div", { "data-wk": "block", style: { maxWidth: "82%", borderRadius: "14px 14px 14px 4px", background: "#fff", border: "1px solid " + MK_LINE, color: MK_INK, padding: "11px 14px", fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", lineHeight: 1.8, wordBreak: "break-word" } }, t.his)) : null)),
      busy ? h("div", { style: { textAlign: "center", fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: MK_DIM, marginTop: 14 } }, characterText(partner, "他在想怎么回……")) : null),
    h("div", { className: "shrink-0 px-4", style: { paddingBottom: "calc(env(safe-area-inset-bottom) * 0.4 + 10px)" } },
      h("div", { className: "flex items-end gap-2" },
        h("textarea", {
          value: typing, onChange: e => setTyping(e.target.value), rows: 1,
          placeholder: turns.length ? "还想说点什么" : "递一句过去——不一定是道歉",
          className: "flex-1 outline-none resize-none",
          style: { minHeight: 42, maxHeight: 104, borderRadius: 12, border: "1px solid " + MK_LINE, background: "#fff", color: MK_INK, padding: "11px 13px", fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", lineHeight: 1.55 }
        }),
        h("button", { onClick: send, disabled: !!busy || !typing.trim(), className: "active:opacity-70 shrink-0 flex items-center justify-center", "aria-label": "递过去",
          style: { width: 42, height: 42, borderRadius: 12, background: (busy || !typing.trim()) ? "rgba(58,47,44,.08)" : MK_ACC, color: (busy || !typing.trim()) ? MK_DIM : "#fff" } },
          h("div", { style: { width: 0, height: 0, borderTop: "7px solid transparent", borderBottom: "7px solid transparent", borderLeft: "10px solid currentColor", marginLeft: 3 } }))),
      h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: MK_DIM, textAlign: "center", marginTop: 8 } },
        "这儿说的话不会替你在聊天里说出去")),
    ending ? h("div", { onClick: () => setEnding(false), style: { position: "absolute", inset: 0, background: "rgba(0,0,0,.4)", zIndex: 30, display: "flex", alignItems: "center", justifyContent: "center", padding: 22 } },
      h("div", { onClick: e => e.stopPropagation(), style: { width: "100%", borderRadius: 18, background: "#fff", padding: "18px 17px" } },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(17px * var(--app-fs, 1))", color: MK_INK } }, "这一段过去了？"),
        [["mem", characterText(partner, "过去了，让他记着"), "写一条进记忆库，好感回一点点。和好本来就该算数。"],
         ["drop", "先收起来", "主线一个字都不知道，这一页也不留。"]].map(([k, zh, sub]) =>
          h("button", { key: k, onClick: () => { onClose(k); setEnding(false); }, className: "w-full text-left active:opacity-70",
            style: { display: "block", marginTop: 12, borderRadius: 13, border: "1px solid " + MK_LINE, padding: "13px 14px" } },
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(15px * var(--app-fs, 1))", color: MK_INK } }, zh),
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: MK_DIM, lineHeight: 1.7, marginTop: 4 } }, sub))),
        h("button", { onClick: () => setEnding(false), className: "w-full active:opacity-70", style: { marginTop: 12, borderRadius: 12, padding: "10px 0", fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: MK_DIM } }, "还没完"))) : null);
}
function IfRoom({ partner, lines, uName, busy, bgBusy, shotBusy, photos, onOpen, onAdvance, onBg, onShot, onBgPick, onEnd, onDrop, onBack }) {
  const t = useTheme();
  const mine = (lines || []).filter(x => x.charId === partner.id);
  const [openId, setOpenId] = useState(null);
  const [hint, setHint] = useState("");
  const [at, setAt] = useState({ beat: 0, box: 0 });   // 读到第几拍第几框
  const [drafts, setDrafts] = useState([]);            // 我攒着还没发的几条
  const [typing, setTyping] = useState("");
  const [side, setSide] = useState(false);
  const [pick, setPick] = useState(false);   // 从合照里挑一张当背景
  const [ending, setEnding] = useState(false);
  const [endId, setEndId] = useState(null);    // 在列表上收哪一条
  const [dropId, setDropId] = useState(null);  // 删哪一条（删是不可逆的，问一句）
  const line = mine.find(x => x.id === openId) || null;
  const beats = (line && line.beats) || [];
  // 每次这条线长出新的一拍，就把光标推到最新那一拍的第一框
  React.useEffect(function () {
    if (!line) return;
    setAt(function (p) { return p.beat >= beats.length - 1 ? p : { beat: beats.length - 1, box: 0 }; });
  }, [line && line.id, beats.length]);
  if (!line) {
    // ── 馆里那一列 ──
    return h("div", { "data-wk": "uspage", "data-part": "ifroom", className: "h-full flex flex-col", style: { background: "#141220" } },
      h(Head, { zh: "另一种我们", bg: "transparent", noLine: true, ink: IF_INK, onBack }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-4 pb-10" },
        h("div", { style: { borderRadius: 18, border: "1px solid " + IF_LINE, background: "rgba(24,21,36,.7)", padding: "16px 15px" } },
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: IF_DIM, lineHeight: 1.8 } },
            characterText(partner, "同样的我们、同样这段关系，只换掉当初的一样东西。留空就让他自己想一条。")),
          h("textarea", {
            value: hint, onChange: e => setHint(e.target.value), rows: 2,
            placeholder: characterText(partner, "想走哪个方向？留空他自己想"),
            className: "w-full outline-none resize-none",
            style: { marginTop: 10, borderRadius: 12, border: "1px solid " + IF_LINE, background: "rgba(0,0,0,.28)", color: IF_INK, padding: "10px 11px", fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", lineHeight: 1.6 }
          }),
          h("button", { onClick: () => onOpen(hint).then(l => { if (l) { setHint(""); setOpenId(l.id); setAt({ beat: 0, box: 0 }); } }), disabled: !!busy, className: "w-full active:opacity-70", style: { marginTop: 11, borderRadius: 12, padding: "11px 0", background: busy ? "rgba(255,255,255,.12)" : "#6d5a9c", color: busy ? IF_DIM : "#fff", fontFamily: F_DISPLAY, fontSize: "calc(15px * var(--app-fs, 1))" } },
            busy ? characterText(partner, "他在想……") : "开一条")),
        mine.length
          // ── 变化图（她 2026-09-05 定的形状）──────────────────────────
          // 这个东西在现实里就是【复盘时的变化图】：同一盘棋，某一手换掉，往下摆一遍。
          // 所以不是一列卡片（那换个 app 照样成立），是【一条主干 + 岔出去的几条虚线】：
          //   主干实线＝你俩真走的这条，一直往下走，不会停在最后一条如果那儿；
          //   每一条如果从主干上一个岔点虚着拐出去。
          // ⚠️状态不只靠颜色分（tabs-not-plain-pills.md 第 2 条）：没收的那条岔点是空心、
          //   线是虚的；已收的岔点填实、末端多一道横杠——形状本身就不一样。
          ? h("div", { style: { position: "relative", marginTop: 16, paddingLeft: 30, paddingBottom: 22 } },
              // 主干：你俩真走的这条。从上面那张卡底下一路穿到最后，两头都不收口。
              h("div", { "aria-hidden": "true", style: { position: "absolute", left: 9, top: 0, bottom: 0, width: 0, borderLeft: "1.5px solid rgba(232,228,238,.34)" } }),
              h("div", { className: "flex items-center", style: { gap: 7, marginBottom: 12, marginLeft: -30 } },
                h("span", { "aria-hidden": "true", style: { width: 7, height: 7, borderRadius: 999, background: IF_INK, marginLeft: 6, flexShrink: 0 } }),
                h("span", { style: { fontFamily: F_BODY, fontSize: "calc(10px * var(--app-fs, 1))", letterSpacing: ".14em", color: IF_DIM } }, "我们真走的这条")),
              h("div", { style: { display: "flex", flexDirection: "column", gap: 10 } },
              // ⚠️操作行必须是卡片按钮的【兄弟】，不能塞进按钮里——按钮里不许再嵌按钮。
              // 所以每一条外面套一个 div，里头一个卡片按钮 + 一行操作。
              mine.map(x => h("div", { key: x.id, style: { position: "relative", borderRadius: 15, border: "1px solid " + IF_LINE, background: "rgba(24,21,36,.7)" } },
                // 从主干上岔出去的那一笔：拐个弯接到这张卡的左边
                h("svg", { "aria-hidden": "true", viewBox: "0 0 30 34", width: 30, height: 34, style: { position: "absolute", left: -30, top: 6 } },
                  h("path", { d: "M9 0 V10 C9 22 17 22 30 22", fill: "none", stroke: x.endedAt ? "rgba(169,156,203,.85)" : "rgba(169,156,203,.5)",
                    strokeWidth: 1.4, strokeLinecap: "round", strokeDasharray: x.endedAt ? "" : "3 4" }),
                  h("circle", { cx: 9, cy: 10, r: 3.1, fill: x.endedAt ? "#a99ccb" : "#181524", stroke: "#a99ccb", strokeWidth: 1.3 })),
                h("button", { onClick: () => { setOpenId(x.id); setAt({ beat: Math.max(0, (x.beats || []).length - 1), box: 0 }); }, className: "w-full text-left active:opacity-70", style: { padding: "13px 14px 9px" } },
                  h("div", { className: "flex items-center gap-2" },
                    h("div", { className: "flex-1 min-w-0", style: { fontFamily: F_DISPLAY, fontSize: "calc(16.5px * var(--app-fs, 1))", color: IF_INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, STX(x.title)),
                    h("span", { style: { fontFamily: "'Archivo',sans-serif", fontSize: "calc(9.5px * var(--app-fs, 1))", color: IF_DIM } }, (x.beats || []).length + " 拍")),
                  h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: IF_DIM, lineHeight: 1.6, marginTop: 4 } }, x.premise),
                  x.about ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: "#a99ccb", marginTop: 5, lineHeight: 1.6 } }, "探的是：" + x.about) : null,
                  x.dim && (window.IfKit || {}).dimZh ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10px * var(--app-fs, 1))", color: IF_DIM, marginTop: 3, opacity: .75 } }, "动的是：" + window.IfKit.dimZh(x.dim)) : null,
                  x.endedAt ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10px * var(--app-fs, 1))", color: IF_DIM, marginTop: 5 } },
                    "已收 · " + (x.outcome === "mem" ? "记进了记忆库" : x.outcome === "seed" ? "留成了一个念头" : "只留在馆里")) : null),
                // 她 2026-08-31：「我怎么结束这拍，或者删掉记录啊」——原来只有进到线里
                // 才收得了，删更是压根没有。列表这一行上直接给。
                h("div", { className: "flex items-center", style: { padding: "0 14px 11px" } },
                  x.endedAt ? null : h("button", { onClick: () => setEndId(x.id), className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: IF_DIM } }, "就到这儿"),
                  h("button", { onClick: () => setDropId(x.id), className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: "rgba(214,140,150,.78)", marginLeft: "auto" } }, "删掉"))))))
          : h("div", { style: { border: "1px dashed " + IF_LINE, borderRadius: 16, padding: "30px 16px", marginTop: 16, textAlign: "center", fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: IF_DIM, lineHeight: 1.9 } },
              "还没有想过另一种。")),
      // 在列表上收一条：跟线里那个「就到这儿」是同一套三选一，一层只写一处不好写成组件，
      // 就把去处那三项抽出来共用
      endId ? h(IfEndPick, { character: partner, onPick: k => { onEnd(endId, k); setEndId(null); }, onClose: () => setEndId(null) }) : null,
      // 删是不可逆的，问一句
      dropId ? h("div", { onClick: () => setDropId(null), style: { position: "absolute", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 30, display: "flex", alignItems: "center", justifyContent: "center", padding: 22 } },
        h("div", { onClick: e => e.stopPropagation(), style: { width: "100%", borderRadius: 18, border: "1px solid " + IF_LINE, background: "#15121e", padding: "18px 17px" } },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(17px * var(--app-fs, 1))", color: IF_INK } }, "删掉这一种？"),
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: IF_DIM, lineHeight: 1.8, marginTop: 5 } }, "整条连同里头说过的话一起没了，找不回来。已经记进记忆库或留成念头的那一份不受影响。"),
          h("div", { className: "flex gap-2", style: { marginTop: 14 } },
            h("button", { onClick: () => setDropId(null), className: "flex-1 active:opacity-70", style: { borderRadius: 12, padding: "10px 0", border: "1px solid " + IF_LINE, color: IF_INK, fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))" } }, "算了"),
            h("button", { onClick: () => { onDrop(dropId); setDropId(null); }, className: "flex-1 active:opacity-70", style: { borderRadius: 12, padding: "10px 0", background: "#8c4a58", color: "#fff", fontFamily: F_DISPLAY, fontSize: "calc(14px * var(--app-fs, 1))" } }, "删掉")))) : null);
  }
  // ── 一条线里头 ──
  const bt = beats[at.beat] || { boxes: [] };
  const box = (bt.boxes || [])[at.box] || null;
  const more = at.box < (bt.boxes || []).length - 1;
  const lastBeat = at.beat >= beats.length - 1;
  // ⚠️最后一拍是她的、TA那一拍没写出来（模型拒了／中转拦了，toast 一闪就过）时，原来这里不算她的回合：
  //   底下写着「点一下继续」，点了却什么都不会发生——整条线就停死在那儿（群友 2026-10-07：「不是卡了也没有报错」）。
  //   现在照样算她的回合，不用再写字，直接点发出就让TA接着这一拍重写。
  const stuck = lastBeat && !more && bt.role === "user" && !line.endedAt;
  const myTurn = lastBeat && !more && (bt.role === "char" || stuck);
  const bg = line.bgKey || line.bgUrl;
  const tap = () => { if (more) setAt({ beat: at.beat, box: at.box + 1 }); else if (!lastBeat) setAt({ beat: at.beat + 1, box: 0 }); };
  const send = () => { const all = typing.trim() ? drafts.concat([typing.trim()]) : drafts; if (!all.length && !stuck) return; setDrafts([]); setTyping(""); onAdvance(line.id, all); };
  return h("div", { "data-wk": "uspage", "data-part": "ifroom", className: "h-full flex flex-col", style: { position: "relative", background: "#0e0c16" } },
    bg ? h("div", { style: { position: "absolute", inset: 0, opacity: 0.4 } }, h(AlbumPhoto, { photo: { imgKey: line.bgKey, imgUrl: line.bgUrl }, cover: true })) : null,
    // 还没生成背景图时原来是一整片死黑。给一层很淡的光晕当底衬——不抢正文，
    // 但至少看着像个场景，不像没加载完。
    bg ? null : h("div", { style: { position: "absolute", inset: 0, background: "radial-gradient(130% 68% at 50% 4%,rgba(141,118,201,.3),rgba(90,70,140,.1) 46%,rgba(141,118,201,0) 74%)" } }),
    h("div", { style: { position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(14,12,22,.55),rgba(14,12,22,.92))" } }),
    // ⚠️这一条压在场景图上，字色是夜色那一档——不换 Head，只加属性
    h("div", { "data-wk": "head", className: "shrink-0 flex items-center px-4 pb-2", style: { position: "relative", paddingTop: safeTop(10) } },
      h("button", { onClick: () => setOpenId(null), "aria-label": "返回", "data-wk": "headink", className: "active:opacity-50 flex items-center justify-center", style: { width: 40, height: 40, marginLeft: -8 } }, h(IArrow, { size: 19, color: IF_INK, wk: "headink" })),
      h("div", { className: "flex-1 min-w-0 text-center" },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(15.5px * var(--app-fs, 1))", color: IF_INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, STX(line.title)),
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10px * var(--app-fs, 1))", color: IF_DIM, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, line.premise),
        // 进度原来是「3 / 3」一行小字，跟上面两行挤成三层。改成一排点：
        // 拍数不多的时候一眼看得出走到哪儿了，多了再退回数字。
        beats.length <= 12
          ? h("div", { className: "flex items-center justify-center", style: { gap: 4, marginTop: 5 } },
              beats.map((b, i) => h("span", {
                key: b.id,
                style: {
                  width: i === at.beat ? 13 : 4, height: 4, borderRadius: 99,
                  background: i === at.beat ? IF_ACCENT : i < at.beat ? "rgba(141,118,201,.42)" : IF_LINE
                }
              })))
          : h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: "calc(9px * var(--app-fs, 1))", color: IF_DIM, marginTop: 3 } }, (at.beat + 1) + " / " + beats.length)),
      h("button", { onClick: () => setSide(true), "aria-label": "看看前面", className: "active:opacity-50 flex items-center justify-center", style: { width: 40, height: 40 } },
        h("div", { style: { width: 15, height: 11, borderTop: "2px solid " + IF_INK, borderBottom: "2px solid " + IF_INK, opacity: .85 } }))),
    // 正文：点一下出下一框
    // ⚠️这儿【不要】把说过的话堆成余影往上排。v59.14 试过，她当天就报：
    // 「余影太多的话会把后面的话对话框显示不出来，而且太挡住后面的图了」——
    // 堆到五条就把当前那一框顶出屏幕，背景图也被字糊死。上面那片空的本来就是
    // 留给背景图的，往前翻走侧栏。
    h("div", { onClick: tap, className: "flex-1 min-h-0 overflow-y-auto px-5", style: { position: "relative", display: "flex", flexDirection: "column", justifyContent: "flex-end", paddingBottom: 12 } },
      box ? h(IfBox, {
        box: box, charName: partner.remark || partner.name, uName: uName,
        mine: bt.role === "user",
        // 还能往下点的时候才亮那个小三角；轮到她说话了就不亮，免得像还没说完
        tick: !busy && (more || !lastBeat)
      }) : null,
      busy ? h("div", { style: { textAlign: "center", fontFamily: F_BODY, fontSize: "calc(10px * var(--app-fs, 1))", color: IF_DIM, marginTop: 10 } }, "……") : null),
    // 我的回合：先攒几条再一起发。
    // v59.14 重做（她 2026-08-31：「回复键的样式也改一下」）：
    //   ① 原来三个控件三种形状——输入框是圆角矩形、攒着是正圆、发出是胶囊，
    //      挤在一行像三件不相干的东西。现在统一成【同高同圆角】的一套。
    //   ② 还没轮到她的时候，那一整条输入区照样占着地方、placeholder 写「TA还没说完」——
    //      占了半屏高度只为说一句话。改成收起来，只留一行提示。
    h("div", { className: "shrink-0 px-4", style: { position: "relative", paddingBottom: "calc(env(safe-area-inset-bottom) * 0.4 + 10px)" } },
      myTurn ? [
        drafts.length ? h("div", { key: "dr", style: { display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 } },
          drafts.map((d, i) => h("div", { "data-wk": "block", key: i, className: "flex items-center gap-2", style: { borderRadius: 12, background: "rgba(141,118,201,.13)", border: "1px solid rgba(141,118,201,.26)", padding: "8px 12px" } },
            h("div", { className: "flex-1 min-w-0", style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: IF_INK, opacity: .82 } }, d),
            h("button", { onClick: () => setDrafts(drafts.filter((_, j) => j !== i)), className: "active:opacity-60 shrink-0", "aria-label": "撤掉这条", style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: IF_DIM } }, "撤")))) : null,
        h("div", { key: "row", className: "flex items-end gap-2" },
          h("textarea", {
            value: typing, onChange: e => setTyping(e.target.value), rows: 1,
            placeholder: drafts.length ? "还想说点什么" : stuck ? characterText(partner, "他这一拍没接上——直接点发出，让他接着写") : "你说点什么，或先攒几条",
            className: "flex-1 outline-none resize-none",
            style: { minHeight: 42, maxHeight: 104, borderRadius: 12, border: "1px solid " + IF_LINE, background: "rgba(0,0,0,.34)", color: IF_INK, padding: "11px 13px", fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", lineHeight: 1.55 }
          }),
          // 攒一条：跟发出同高同圆角，只是空心。满了就灰掉（原来是默默不响应）
          h("button", {
            onClick: () => { const v = typing.trim(); if (!v || drafts.length >= (window.IfKit || {}).MY_BOXES_MAX) return; setDrafts(drafts.concat([v])); setTyping(""); },
            disabled: !typing.trim() || drafts.length >= ((window.IfKit || {}).MY_BOXES_MAX || 8),
            className: "active:opacity-70 shrink-0 flex items-center justify-center", "aria-label": "再攒一条",
            style: { width: 42, height: 42, borderRadius: 12, border: "1px solid " + (typing.trim() ? "rgba(141,118,201,.5)" : IF_LINE), color: typing.trim() ? "#cdbdf0" : IF_DIM, fontFamily: F_DISPLAY, fontSize: "calc(20px * var(--app-fs, 1))", lineHeight: 1 }
          }, "+"),
          h("button", {
            onClick: send, disabled: !!busy || (!drafts.length && !typing.trim() && !stuck),
            className: "active:opacity-70 shrink-0 flex items-center justify-center", "aria-label": "发出去",
            style: { width: 42, height: 42, borderRadius: 12, background: (busy || (!drafts.length && !typing.trim() && !stuck)) ? "rgba(255,255,255,.08)" : IF_ACCENT, color: (busy || (!drafts.length && !typing.trim() && !stuck)) ? IF_DIM : "#fff" }
          }, busy
            ? h("span", { style: { fontFamily: F_DISPLAY, fontSize: "calc(14px * var(--app-fs, 1))" } }, "…")
            // 送出：一个朝右的小三角，跟对话框右下角那个是同一个形状
            : h("div", { style: { width: 0, height: 0, borderTop: "7px solid transparent", borderBottom: "7px solid transparent", borderLeft: "10px solid currentColor", marginLeft: 3 } })))
      ] : h("div", { style: { textAlign: "center", fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: IF_DIM, padding: "12px 0 6px" } },
        busy ? characterText(partner, "他在写……") : line.endedAt ? "这条已经收了" : "点一下继续"),
      h("div", { className: "flex items-center justify-between", style: { marginTop: myTurn ? 9 : 2 } },
        h("div", { className: "flex items-center", style: { gap: 14 } },
          h("button", { onClick: () => onBg(line.id), disabled: !!bgBusy, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: IF_DIM } },
            bgBusy ? "画着…" : bg ? "换张背景" : "生成背景图"),
          // ⚠️跟上面那颗是两件事：背景图是【纯空景】（这一页要压字的底板，没有人是对的），
          //   这一颗才是你俩的脸。她 2026-09-06 问「为什么生图不出脸」，问的是那一张。
          h("button", { onClick: () => onShot(line.id), disabled: !!shotBusy, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: IF_DIM } },
            shotBusy ? "拍着…" : "拍张我俩"),
          // 背景也能从已经有的合照里挑（她 2026-09-18）。没合照就不摆这颗，
          // 免得点开是一片空——「还没有」这件事上一层（墙上那张拍立得）已经说了。
          (photos || []).length ? h("button", { onClick: () => setPick(true), className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: IF_DIM } }, "用合照当背景") : null),
        line.endedAt ? h("span", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: IF_DIM } }, "这条已经收了")
          : h("button", { onClick: () => setEnding(true), className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: IF_DIM } }, "就到这儿"))),
    // 从合照里挑一张当背景（她 2026-09-18：「另一个我们的背景也能用合照」）。
    // ⚠️名单就是合照墙那一份（duoPhotosFor 已经把聊天/线下/照相馆/情侣空间四处合流），
    //   不在这儿另攒一个列表。点一张就换，不确认——换错了再点一张就是。
    pick ? h("div", { onClick: () => setPick(false), style: { position: "absolute", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 24 } },
      h("div", { "data-wk": "uspage", "data-part": "ifroom", onClick: e => e.stopPropagation(), className: "h-full flex flex-col", style: { position: "absolute", left: 0, right: 0, bottom: 0, maxHeight: "72%", background: "#1b1726", borderTop: "1px solid " + IF_LINE, borderTopLeftRadius: 18, borderTopRightRadius: 18 } },
        h("div", { className: "shrink-0 flex items-center justify-between px-4", style: { paddingTop: 14, paddingBottom: 10, borderBottom: "1px solid " + IF_LINE } },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(15px * var(--app-fs, 1))", color: IF_INK } }, "挑一张当这条线的底"),
          h("button", { onClick: () => setPick(false), style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: IF_DIM } }, "关掉")),
        h("div", { className: "flex-1 min-h-0 overflow-y-auto px-4 py-3" },
          h("div", { style: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 } },
            (photos || []).map((x, i) => h("button", {
              key: (x.imgKey || x.imgUrl || i) + "",
              onClick: () => { onBgPick && onBgPick(line.id, x); setPick(false); },
              className: "active:opacity-70",
              style: { position: "relative", paddingTop: "100%", borderRadius: 8, overflow: "hidden", border: "1px solid " + IF_LINE, background: "#0f0d17" }
            },
              h("div", { style: { position: "absolute", inset: 0 } }, h(AlbumPhoto, { photo: x, cover: true })),
              (x.imgKey && x.imgKey === line.bgKey) || (x.imgUrl && x.imgUrl === line.bgUrl)
                ? h("div", { style: { position: "absolute", inset: 0, border: "2px solid " + IF_ACCENT, borderRadius: 8 } }) : null))),
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: IF_DIM, textAlign: "center", marginTop: 12, lineHeight: 1.7 } },
            "换的只是这一条线的底，照片本身不动"))) ) : null,
    // 侧栏：翻已经过去的那些拍
    side ? h("div", { onClick: () => setSide(false), style: { position: "absolute", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 20 } },
      h("div", { "data-wk": "uspage", "data-part": "ifroom", onClick: e => e.stopPropagation(), className: "h-full flex flex-col", style: { position: "absolute", right: 0, top: 0, bottom: 0, width: "78%", background: "#15121e", borderLeft: "1px solid " + IF_LINE } },
        h("div", { "data-wk": "head", className: "shrink-0 px-4", style: { paddingTop: safeTop(12), paddingBottom: 10, borderBottom: "1px solid " + IF_LINE } },
          h("div", { className: "flex items-center justify-between" },
            h("div", { className: "flex-1 min-w-0", style: { fontFamily: F_DISPLAY, fontSize: "calc(16px * var(--app-fs, 1))", color: IF_INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, STX(line.title)),
            h("button", { onClick: () => setSide(false), className: "active:opacity-60 shrink-0", style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: IF_DIM, marginLeft: 10 } }, "收起")),
          // 侧栏里也要看得见这条线是什么——她 2026-08-31：「一进去一脸懵」
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: IF_DIM, lineHeight: 1.7, marginTop: 4 } }, line.premise),
          line.about ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: "#a99ccb", lineHeight: 1.7, marginTop: 5 } }, "探的是：" + line.about) : null,
          line.dim && (window.IfKit || {}).dimZh ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10px * var(--app-fs, 1))", color: IF_DIM, marginTop: 4, opacity: .8 } },
            "这条动的是：" + window.IfKit.dimZh(line.dim)) : null,
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(9.5px * var(--app-fs, 1))", color: IF_DIM, letterSpacing: ".05em", marginTop: 8 } }, "前面说过的")),
        h("div", { className: "flex-1 min-h-0 overflow-y-auto px-4 pb-8" },
          beats.map((b, i) => h("button", { key: b.id, onClick: () => { setAt({ beat: i, box: 0 }); setSide(false); }, className: "w-full text-left active:opacity-70", style: { display: "block", padding: "10px 0", borderBottom: "1px solid " + IF_LINE } },
            h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: "calc(9px * var(--app-fs, 1))", color: IF_DIM } }, b.role === "user" ? "你" : (partner.remark || partner.name)),
            (b.boxes || []).map((x, j) => h("div", { key: j, style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", lineHeight: 1.8, color: i === at.beat ? IF_INK : IF_DIM, fontStyle: (!x.who && b.role !== "user") ? "italic" : "normal", marginTop: 2 } }, STX(x.text)))))))) : null,
    // 收线：三个去处
    ending ? h(IfEndPick, { character: partner, onPick: k => { onEnd(line.id, k); setEnding(false); }, onClose: () => setEnding(false) }) : null);
}
