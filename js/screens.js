// ============================================================
// CAST + form
// ============================================================
// 角色卡一键导入（v48.30 搬家器；v58.46 大修）：整篇卡粘进来 → 自动拆 名字/一句话/人设/长期记忆/记忆库种子。
// 她 2026-08-30：「导入角色卡那个格式还是有点不对劲，经常导入了格式还是不对」。原来那版只认两种东西：
// 「# 名字 · 角色卡」这一种标题，和「##」这一级分节。别的一律走「整篇当人设」的兜底——
// 于是酒馆导出的 JSON 会被原样当人设塞进去（连大括号一起），{{char}}/{{user}} 占位符原样留着，
// 例句脚手架（<START>、mes_example）也一起进去跟 app 自己的手机机制打架。

// {{char}} / {{user}} 这类占位符 app 不认，导入时就换掉，不要留给她手动改
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
  // 世界书（character_book）正好就是记忆库种子该装的东西
  const book = (d.character_book && Array.isArray(d.character_book.entries)) ? d.character_book.entries : [];
  const seeds = book.map(e => ({
    text: String((e && (e.content || e.text)) || "").replace(/\s+/g, " ").trim(),
    pinned: !!(e && (e.constant || e.enabled === true && e.constant))
  })).filter(x => x.text.length > 4);
  return {
    name: String(d.name || "").trim(),
    tagline: String(d.creator_notes || "").split("\n")[0].trim().slice(0, 40),
    persona: parts.join("\n\n"),
    longMem: "",
    seeds: seeds,
    greeting: String(d.first_mes || "").trim(),
    hadExample: !!String(d.mes_example || "").trim(),
    from: "json"
  };
}
// 认得出的分节标题：# / ## / **加粗** / 【】 / [] 四种写法，外加「人设：」这种带冒号的。
// 后三种允许值写在【同一行】上（「【一句话】永安王」），那一段算这一节的正文头。
const CARD_SEC_RE = /^[ \t]*(?:#{1,6}[ \t]*(.+?)[ \t]*[:：]?[ \t]*|\*\*(.+?)\*\*[ \t]*[:：]?[ \t]*(.*?)[ \t]*|[【\[〔](.+?)[】\]〕][ \t]*[:：]?[ \t]*(.*?)[ \t]*|([一-龥A-Za-z][一-龥A-Za-z0-9_ ]{0,13})[ \t]*[:：][ \t]*(.*?)[ \t]*)$/gm;
// 带冒号那一种太宽（正文里随便一行「他说：」也像），所以只认这些词
const CARD_SEC_KWS = ["人设", "设定", "简介", "描述", "长期记忆", "初始记忆", "记忆库种子", "记忆种子", "种子", "记忆库", "开场白", "问候语", "第一句", "一句话", "标签", "外貌", "persona", "description", "memory", "greeting"];
function parseCharCard(raw, userName) {
  const text0 = String(raw || "").replace(/\r/g, "");
  const asJson = cardFromJSON(text0);
  const out = asJson || { name: "", tagline: "", persona: "", longMem: "", seeds: [], greeting: "", hadExample: false, from: "text" };
  if (!asJson) {
    const text = text0;
    // 「# X · 角色卡」「名字：X」「【姓名】X」「**姓名**：X」「名字「X」」，最后才退到第一个 # 标题
    let m = text.match(/^#\s*([^\n·#|]+?)\s*[·|｜]?\s*角色卡/m)
      || text.match(/^[ \t]*(?:#{1,6}[ \t]*)?(?:\*\*|[【\[〔])?[ \t]*(?:名字|姓名|角色名|人物名|name)[ \t]*(?:\*\*|[】\]〕])?[ \t]*[:：]?[ \t]*[「"'\[]?([^\n」"'\]]{1,20})/im)
      || text.match(/名字[「"']([^」"']+)[」"']/)
      || text.match(/^#[ \t]*([^\n#]{1,20})[ \t]*$/m);
    if (m) out.name = m[1].trim().replace(/[*_`]/g, "");
    const secs = [];
    let last = null, mm;
    const push = (sec, until) => secs.push({ title: sec.title, body: (sec.pre ? sec.pre + "\n" : "") + text.slice(sec.end, until) .trim() });
    CARD_SEC_RE.lastIndex = 0;
    while ((mm = CARD_SEC_RE.exec(text))) {
      const title = (mm[1] || mm[2] || mm[4] || mm[6] || "").trim();
      const pre = (mm[3] || mm[5] || mm[7] || "").trim();
      // 带冒号那一支只认名单里的词，别把正文里的「他说：」当成分节
      if (mm[6] && !CARD_SEC_KWS.some(k => title.toLowerCase().includes(k))) continue;
      if (!title) continue;
      if (last) push(last, mm.index);
      last = { title: title, pre: pre, end: mm.index + mm[0].length };
    }
    if (last) push(last, text.length);
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
  return out;
}
// 整页，不是半窗（no-half-sheet.md）：这一页要装一大块粘贴框 + 解析预览 + 一串提醒，
// 半窗先扣掉一半屏幕，预览会被挤到看不见。
function CardImportSheet({ onImport, onClose, userName }) {
  const t = useTheme();
  const [txt, setTxt] = useState("");
  const [nameEdit, setNameEdit] = useState(null);   // null=跟着解析走，字符串=她自己改过了
  const p = txt.trim() ? parseCharCard(txt, userName) : null;
  const name = nameEdit != null ? nameEdit : (p ? p.name : "");
  const line = (zh, v) => h("div", { className: "flex items-baseline gap-2", style: { marginTop: 4 } },
    h("span", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, width: 74, flexShrink: 0 } }, zh),
    h("span", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.ink, lineHeight: 1.6 } }, v));
  return h("div", { className: "absolute inset-0 z-50 h-full flex flex-col", style: { background: t.bg } },
    h("div", { className: "shrink-0 px-4 pb-2", style: { paddingTop: safeTop(8), background: t.bg, borderBottom: "1px solid " + t.line } },
      h("div", { className: "grid items-center", style: { gridTemplateColumns: "52px 1fr 52px", minHeight: 44 } },
        h("button", { onClick: onClose, className: "flex items-center justify-start active:opacity-50", style: { width: 44, height: 44 } }, h(IArrow, { size: 19, color: t.ink })),
        h("div", { className: "text-center min-w-0" },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 17, color: t.ink } }, "导入角色卡"),
          h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 8.5, letterSpacing: ".2em", color: t.fog, marginTop: 1 } }, "IMPORT")),
        h("div"))),
    h("div", { className: "flex-1 min-h-0 overflow-y-auto px-5 pb-10" },
      h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, margin: "14px 0 10px", lineHeight: 1.65 } },
        "整篇粘进来就行。认得出酒馆卡的 JSON（v1/v2，连世界书一起收成记忆种子），也认「# / ## / **加粗** / 【】」这几种分节。{{char}}/{{user}} 会自动换掉，<START> 之后的对话示例不导入。"),
      h("textarea", { value: txt, onChange: e => { setTxt(e.target.value); setNameEdit(null); }, rows: 12, placeholder: "在这里粘贴整篇角色卡…", style: { width: "100%", background: t.bg2, border: "1px solid " + t.line, borderRadius: 12, padding: "11px 13px", fontFamily: F_BODY, fontSize: 13, color: t.ink, resize: "none", lineHeight: 1.6 } }),
      p ? h("div", { style: { marginTop: 12, padding: "12px 14px", borderRadius: 14, background: t.bg2, border: "1px solid " + t.line } },
        h(Eyebrow, { style: { marginBottom: 7 } }, p.from === "json" ? "解析预览 · 认出是酒馆卡" : "解析预览"),
        // 名字在这里就能改——原来只能先导进去、再去档案里改一遍
        h("div", { className: "flex items-center gap-2", style: { marginBottom: 5 } },
          h("span", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, width: 74, flexShrink: 0 } }, "名字"),
          h("input", {
            value: name, onChange: e => setNameEdit(e.target.value), placeholder: "没认出来，自己写一个",
            className: "flex-1 min-w-0 bg-transparent outline-none",
            style: { fontFamily: F_DISPLAY, fontSize: 17, color: t.ink, borderBottom: "1px solid " + t.line, padding: "2px 0" }
          })),
        p.tagline ? line("一句话", p.tagline) : null,
        line("人设", p.persona ? p.persona.length + " 字" : "—"),
        line("长期记忆", p.longMem ? p.longMem.length + " 字" : "（无）"),
        line("记忆种子", p.seeds.length ? p.seeds.length + " 条（置顶 " + p.seeds.filter(x => x.pinned).length + " 条）" : "（无）"),
        p.greeting ? line("开场白", p.greeting.length + " 字 · 导入后当 TA 的第一句话") : null,
        (p.warnings || []).length ? h("div", { style: { marginTop: 10, paddingTop: 9, borderTop: "1px solid " + t.line } },
          p.warnings.map((w, n) => h("div", { key: n, style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, lineHeight: 1.7 } }, "· " + w))) : null,
        p.persona ? h("div", { style: { marginTop: 10, paddingTop: 9, borderTop: "1px solid " + t.line } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginBottom: 4 } }, "人设开头长这样"),
          h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.sub, lineHeight: 1.7, whiteSpace: "pre-wrap", maxHeight: 108, overflow: "hidden" } }, p.persona.slice(0, 220))) : null) : null,
      h("button", {
        onClick: () => { if (p && p.persona) onImport(Object.assign({}, p, { name: (name || "").trim() })); },
        className: "w-full mt-4 active:opacity-70",
        style: { background: p && p.persona ? t.ink : t.line, color: t.bg2, borderRadius: 14, padding: "13px 0", fontFamily: F_BODY, fontSize: 15 }
      }, "导入并建档")));
}
// 长文导入记忆库（v48.83，她要「把总结的一切存进记忆库、能被 app 小克搜到」）：粘长文→切条目→绑角色→建向量索引
function MemImportSheet({ characters, defaultCharId, onImport, onClose }) {
  const t = useTheme();
  const [txt, setTxt] = useState("");
  const [cid, setCid] = useState(defaultCharId || (characters[0] && characters[0].id) || "");
  const estN = (() => {
    const raw = txt.trim(); if (!raw) return 0;
    return raw.split(/\n\s*\n+/).map(s => s.trim()).filter(s => {
      if (!s || /^#{1,6}\s/.test(s)) return false;
      const b = s.replace(/^[-*>]\s+/, "").replace(/`/g, "");
      if (/^[-─—*=_>·\s]{3,}$/.test(b)) return false;
      return b.length >= 6 || /[「『"]/.test(b);
    }).length;
  })();
  const curName = (characters.find(c => c.id === cid) || {}).name || "—";
  return h(Sheet, { onClose, tall: true },
    h("div", { style: { fontFamily: F_DISPLAY, fontSize: 20, color: t.ink, marginBottom: 4 } }, "导入长文进记忆库"),
    h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, marginBottom: 12, lineHeight: 1.55 } }, "把一大段文本（小克的回忆录、你俩的旧对话原话…）粘进来——自动切成一条条记忆、绑给选中的角色、建好语义索引。以后 TA 聊天时会【搜到相关的原话回放出来】，不只是浓缩摘要。标题/分隔线/情绪标注会自动跳过。"),
    h("div", { className: "flex gap-2 overflow-x-auto", style: { marginBottom: 10, paddingBottom: 2 } },
      (characters || []).map(c => h("button", { key: c.id, onClick: () => setCid(c.id), className: "px-3 py-1 rounded-full whitespace-nowrap active:opacity-70",
        style: { fontFamily: F_BODY, fontSize: 12, background: cid === c.id ? t.ink : "transparent", color: cid === c.id ? t.bg2 : t.fog, border: "1px solid " + (cid === c.id ? t.ink : t.line) } }, c.remark || c.name))),
    h("textarea", { value: txt, onChange: e => setTxt(e.target.value), rows: 12, placeholder: "在这里粘贴长文…", style: { width: "100%", background: t.bg, border: "1px solid " + t.line, borderRadius: 12, padding: "11px 13px", fontFamily: F_BODY, fontSize: 13, color: t.ink, resize: "none", lineHeight: 1.6 } }),
    txt.trim() ? h("div", { style: { marginTop: 10, fontFamily: F_BODY, fontSize: 12.5, color: t.sub } }, "预计导入约 " + estN + " 条，绑给「" + curName + "」") : null,
    h("button", { onClick: () => { if (txt.trim() && cid) { onImport(cid, txt); onClose(); } }, className: "w-full mt-3 active:opacity-70",
      style: { background: txt.trim() && cid ? t.ink : t.line, color: t.bg2, borderRadius: 14, padding: "13px 0", fontFamily: F_BODY, fontSize: 15 } }, "导入并建索引"));
}
// 卡片上写的每一条都得是真的。原来那个 FILE 编号是拿 id 哈希出来的假卷宗号——
// 跟日记那条假条形码一个毛病（她 2026-08-30 让删的），这里不再有。
function castSummary(char) {
  const raw = String((char && (char.tagline || char.persona)) || "").replace(/\s+/g, " ").trim();
  return raw;
}
// 一整页就是一份摊开的卷宗。她 2026-08-30：「编辑档案里面这几块框还是很 plain 缺少设计感，
// 背景也是纯色」——所以这一页的底、每一块分区，都按【纸】来做，不是白板摞白板。

// 这一页的桌面：中性纸底 + 两团带着他自己颜色的光 + 两道细纸纹。
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
// 分区＝一张有索引页签的活页。页签是竖着的一条（编号在上、色带贯穿整个抬头），
// 抬头右边拉一条虚线引到边（表格上的那种 leader line），正文区换一档纸色压在抬头下面。
function CastSection({ no, title, en, tint, children }) {
  const t = useTheme();
  const accent = tint || t.tint;
  return h("section", {
    className: "mb-4 overflow-hidden",
    style: {
      position: "relative", background: t.bg2, border: "1px solid " + t.line, borderRadius: 16,
      // 三层影：贴着桌面的近影、托起来的远影、内圈上沿一道亮线
      boxShadow: "0 1px 2px rgba(46,38,29,.06), 0 12px 24px -10px rgba(46,38,29,.18), inset 0 1px 0 rgba(255,255,255,.9)"
    }
  },
    // 纸纹（避开左边那条页签）
    h("span", { style: { position: "absolute", top: 0, right: 0, bottom: 0, left: 46, pointerEvents: "none", background: "repeating-linear-gradient(58deg, rgba(255,255,255,.42) 0px, rgba(255,255,255,.42) 1px, transparent 1px, transparent 9px)" } }),
    h("div", { className: "flex items-stretch", style: { position: "relative", borderBottom: "1px solid " + t.line } },
      // 索引页签：色带 + 编号，底下切一个小豁口，像活页夹上的分隔页
      h("div", { className: "flex items-center justify-center shrink-0", style: { position: "relative", width: 46, minHeight: 56, background: accent, color: "#fff", fontFamily: "'Archivo',sans-serif", fontSize: 11, letterSpacing: ".12em", boxShadow: "inset -1px 0 2px rgba(0,0,0,.18)" } },
        no,
        h("span", { style: { position: "absolute", left: 0, right: 0, bottom: -1, height: 5, background: t.bg2, clipPath: "polygon(50% 100%, 0 0, 100% 0)" } })),
      h("div", { className: "flex-1 min-w-0 flex items-center gap-3 px-4 py-3" },
        h("div", { className: "min-w-0" },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16.5, color: t.ink, whiteSpace: "nowrap" } }, title),
          h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 9, letterSpacing: ".18em", color: t.fog, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, en)),
        // 引线：一排小点拉到右边尽头
        h("span", { className: "flex-1", style: { height: 1, minWidth: 12, background: "repeating-linear-gradient(90deg, " + t.line + " 0 2px, transparent 2px 6px)" } }),
        h("span", { style: { width: 5, height: 5, borderRadius: 999, background: accent, opacity: .85, flexShrink: 0 } }))),
    // 正文区换一档纸色，比抬头浅一点，看得出是「填写栏」
    h("div", { className: "px-4 pb-4", style: { position: "relative", background: "rgba(255,255,255,.42)" } }, children));
}
function Cast({
  characters,
  onBack,
  onAdd,
  onImportCard,
  onOpenChar,
  // 档案的另一半：他自己长出来的那份（v61.63 从聊天资料卡里那个半窗挪过来）
  heartCountOf, onOpenHeart
}) {
  const t = useTheme();
  // 一张卡＝一份卷宗。底下那条信息栏照 Codex 那版的形状（她 2026-08-30 点名要），
  // 但里面换成【放着不动也成立】的东西：时区、生日、人设厚度。
  // 好感 / 情侣第几天 / 刚聊过都拿掉了——那是关系的近况，不是档案。
  const cell = (label, value, dim) => h("div", { className: "flex-1 min-w-0", style: { padding: "8px 10px" } },
    h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 7.5, letterSpacing: ".18em", color: t.fog } }, label),
    h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: dim ? t.fog : t.ink, marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, value));
  const cards = characters.map(c => {
    const accent = c.color || t.tint;
    const tz = c.tz ? ("UTC" + (String(c.tz).startsWith("-") ? c.tz : "+" + String(c.tz).replace("+", ""))) : "跟随本地";
    const age = (typeof charAge === "function" && c.birthday) ? charAge(c.birthday, Date.now()) : null;
    // 算得出岁数时年份就是多余的（一栏只有 80 来 px，「1997-3-15 · 29岁」会被截掉）
    const bd = c.birthday
      ? (age != null ? String(c.birthday).replace(/^\s*(农历)?\s*\d{4}\s*[-/.年]\s*/, "$1") + " · " + age + "岁" : String(c.birthday))
      : "—";
    const plen = String(c.persona || "").replace(/\s/g, "").length;
    const sum = castSummary(c);
    // ⚠️外层原来是 <button>。底部信息栏里要放一颗【单独能点】的「心上」，
    //   button 套 button 是非法 HTML（浏览器会把内层拆出去），所以外层换成 div。
    const hn = typeof heartCountOf === "function" ? (heartCountOf(c) || 0) : 0;
    return h("div", {
      key: c.id,
      role: "button", tabIndex: 0,
      onClick: () => onOpenChar(c),
      className: "w-full block active:opacity-90",
      style: {
        position: "relative", marginBottom: 13, textAlign: "left", overflow: "hidden",
        background: t.bg2, border: "1px solid " + t.line, borderRadius: 17,
        // 三层影：贴着纸的近影、托起来的远影、内圈上沿一道亮线（卡片是从纸上翘起来的）
        boxShadow: "0 1px 2px rgba(46,38,29,.07), 0 10px 22px -8px rgba(46,38,29,.16), inset 0 1px 0 rgba(255,255,255,.9)"
      }
    },
      // 卷宗的书脊：他自己的颜色，右侧压一道暗线，让它看起来是「厚的」
      h("span", { style: { position: "absolute", inset: "0 auto 0 0", width: 8, background: accent, boxShadow: "inset -1px 0 2px rgba(0,0,0,.22)" } }),
      // 书脊上打三个装订孔
      h("span", { style: { position: "absolute", left: 2.5, top: 0, bottom: 0, width: 3, display: "flex", flexDirection: "column", justifyContent: "space-evenly" } },
        [0, 1, 2].map(n => h("span", { key: n, style: { width: 3, height: 3, borderRadius: 999, background: "rgba(255,255,255,.55)", boxShadow: "inset 0 1px 1px rgba(0,0,0,.3)" } }))),
      // 纸纹：两道极细的斜线，跟日记纸皮同一套
      h("span", { style: { position: "absolute", top: 0, right: 0, bottom: 0, left: 8, pointerEvents: "none", background: "repeating-linear-gradient(58deg, rgba(255,255,255,.42) 0px, rgba(255,255,255,.42) 1px, transparent 1px, transparent 9px), repeating-linear-gradient(-34deg, rgba(46,38,29,.018) 0px, rgba(46,38,29,.018) 1px, transparent 1px, transparent 13px)" } }),
      // 右上角那枚卷标（档案盒侧面贴的那种），带一点点他的颜色
      h("span", { style: { position: "absolute", right: 18, top: 0, width: 34, height: 7, borderRadius: "0 0 4px 4px", background: accent, opacity: .8 } }),
      h("div", { className: "flex items-start gap-3.5", style: { position: "relative", padding: "16px 12px 13px 22px" } },
        // 头像做成【贴上去的照片】：白边、投影、歪一点点
        h("div", { className: "shrink-0", style: { padding: 3, background: "#fffdf9", borderRadius: 4, boxShadow: "0 2px 6px rgba(46,38,29,.22)", transform: "rotate(-1.6deg)" } },
          h(Avatar, { character: c, size: 58, radius: 3 })),
        h("div", { className: "flex-1 min-w-0", style: { paddingTop: 1 } },
          h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 7.5, letterSpacing: ".2em", color: t.fog } }, "卷宗"),
          h("div", { className: "flex items-baseline gap-2", style: { marginTop: 2 } },
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 21, lineHeight: 1.15, color: t.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, c.name),
            c.remark ? h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, whiteSpace: "nowrap", flexShrink: 0 } }, "备注 " + c.remark) : null),
          sum ? h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, lineHeight: 1.55, color: t.sub, marginTop: 5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } }, sum)
              : h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.fog, marginTop: 5 } }, "还没写人设——点进去补一句"))),
      // 底部信息栏
      h("div", { className: "flex items-stretch", style: { position: "relative", marginLeft: 8, borderTop: "1px solid " + t.line, background: "rgba(255,255,255,.34)" } },
        cell("时区", tz, !c.tz),
        h("span", { style: { width: 1, background: t.line, margin: "6px 0" } }),
        cell("生日", bd, !c.birthday),
        h("span", { style: { width: 1, background: t.line, margin: "6px 0" } }),
        cell("人设", plen ? plen.toLocaleString() + " 字" : "空白", !plen)),
      // 「你写的卷宗」和「他自己长出来的」是同一份档案的两半——摆在同一张卡上。
      // ⚠️不塞进上面那排当第四格：三格挤成四格之后「03-15 · 29岁」会被省略号切掉。
      //   它单独一条，横过来正好放得下，点得着的高度也够（40px 那条线）。
      // ⚠️stopPropagation：不然点它会连带触发外层那次 onOpenChar，跳去人设表单。
      onOpenHeart ? h("button", {
        onClick: e => { e.stopPropagation(); onOpenHeart(c); },
        className: "w-full flex items-center gap-2 active:opacity-60",
        style: { position: "relative", marginLeft: 8, borderTop: "1px solid " + t.line, background: "rgba(255,255,255,.2)", padding: "10px 12px 10px 10px", textAlign: "left" }
      },
        h("span", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 7.5, letterSpacing: ".18em", color: t.fog, flexShrink: 0 } }, "心上"),
        h("span", { className: "flex-1 min-w-0", style: { fontFamily: F_BODY, fontSize: 11.5, color: hn ? t.ink : t.fog, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } },
          hn ? "TA 自己攒下 " + hn + " 条念想" : "还空着——聊得多了会自己长出来"),
        h("span", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, flexShrink: 0 } }, "›")) : null);
  });
  return h("div", { className: "h-full flex flex-col", style: { background: t.bg } },
    // 紧凑标题栏（mobile-ui-layout.md）：返回 + 居中小标题 + 右侧等宽操作位。
    // 她 2026-08-30：「名字改了叫人格档案馆但是上面还是显示叫名录」——名字只有这一处，改就一起改。
    h("div", { className: "shrink-0 px-4 pb-2", style: { paddingTop: safeTop(8), background: t.bg, borderBottom: "1px solid " + t.line } },
      h("div", { className: "grid items-center", style: { gridTemplateColumns: "76px 1fr 76px", minHeight: 44 } },
        h("button", { onClick: onBack, className: "flex items-center justify-start active:opacity-50", style: { width: 44, height: 44 } }, h(IArrow, { size: 19, color: t.ink })),
        h("div", { className: "text-center min-w-0" },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 17, color: t.ink } }, "人格档案馆")),
        h("div", { className: "flex items-center justify-end gap-1" },
          onImportCard ? h("button", { onClick: onImportCard, className: "active:opacity-50 whitespace-nowrap", style: { fontFamily: F_BODY, fontSize: 11.5, color: t.sub, padding: "8px 4px" } }, "导入") : null,
          h("button", { onClick: onAdd, className: "flex items-center justify-center active:opacity-50", style: { width: 34, height: 38 } }, h(IPlus, { size: 20, color: t.ink }))))),
    h("div", { className: "flex-1 min-h-0 overflow-y-auto px-4 pb-10" },
      characters.length === 0
        ? h(Empty, { text: "档案馆里还没有人", sub: "点右上角 + 立第一份卷宗" })
        : [
            // 大标题换成一条细的：一屏 844 高，28px 标题＋留白吃掉快 200px，
            // 只剩两张半卡看得见（mobile-ui-layout.md 也不许子页面放大标题）
            h("div", { key: "cnt", className: "flex items-baseline gap-2", style: { padding: "12px 2px 10px" } },
              h("span", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog } }, "共 " + characters.length + " 份卷宗")),
            h("div", { key: "list" }, cards)
          ]));
}
function CastForm({
  initial,
  onBack,
  onSave,
  onDelete,
  onGenAvatar
}) {
  const t = useTheme();
  const [avBusy, setAvBusy] = useState(false);
  const [name, setName] = useState(initial && initial.name || "");
  const [tagline, setTagline] = useState(initial && initial.tagline || "");
  const [emoji, setEmoji] = useState(initial && initial.avatarEmoji || "");
  const [color, setColor] = useState(initial && initial.color || AV_COLORS[0]);
  const [persona, setPersona] = useState(initial && initial.persona || "");
  const [avatarImage, setAvatarImage] = useState(initial && initial.avatarImage || null);
  const [tz, setTz] = useState(initial && initial.tz != null ? String(initial.tz) : "");
  const [appearance, setAppearance] = useState(initial && initial.appearance || "");
  const [photoCanon, setPhotoCanon] = useState(initial && initial.photoCanon || "");
  const [photoOutfit, setPhotoOutfit] = useState(initial && initial.photoOutfit || "");
  const [photoAccessories, setPhotoAccessories] = useState(initial && initial.photoAccessories || "");
  const [refPhoto, setRefPhoto] = useState(initial && initial.refPhoto || null);
  const [photoStyle, setPhotoStyle] = useState(initial && initial.photoStyle || "realistic");
  const [birthday, setBirthday] = useState(initial && initial.birthday || "");
  // 性别（v58.86，她 2026-08-31 加了女生角色）：只决定别处怎么称呼 TA。
  // 默认不填＝一律用「TA」——中性，永远不会把人叫错。
  const [gender, setGender] = useState(initial && initial.gender || "");
  const [voiceId, setVoiceId] = useState(initial && initial.voiceId || "");
  const save = () => {
    if (!name.trim()) return;
    onSave(Object.assign({}, initial || {}, {
      id: initial && initial.id || "char_" + Date.now(),
      name: name.trim(),
      tagline: tagline.trim(),
      avatarEmoji: emoji.trim().slice(0, 2),
      color,
      persona: persona.trim(),
      avatarImage,
      tz: tz,
      appearance: appearance.trim(),
      photoCanon: photoCanon.trim(),
      photoOutfit: photoOutfit.trim(),
      photoAccessories: photoAccessories.trim(),
      refPhoto: refPhoto,
      photoStyle: photoStyle,
      birthday: birthday.trim(),
      gender: gender,
      voiceId: voiceId.trim(),
      remark: initial && initial.remark || ""
    }));
  };
  const TZ_OPTS = [
    ["-10", "檀香山"], ["-9", "安克雷奇"], ["-8", "洛杉矶 / 温哥华"], ["-7", "丹佛"], ["-6", "芝加哥 / 墨西哥城"],
    ["-5", "纽约 / 多伦多"], ["-4", "圣地亚哥"], ["-3", "圣保罗 / 布宜诺斯艾利斯"], ["-1", "亚速尔"], ["0", "伦敦 / 里斯本"],
    ["+1", "巴黎 / 柏林 / 罗马"], ["+2", "开罗 / 雅典"], ["+3", "莫斯科 / 伊斯坦布尔"], ["+3.5", "德黑兰"], ["+4", "迪拜 / 阿布扎比"],
    ["+4.5", "喀布尔"], ["+5", "卡拉奇"], ["+5.5", "新德里 / 孟买"], ["+6", "达卡"], ["+7", "曼谷 / 河内 / 雅加达"],
    ["+8", "北京 / 香港 / 新加坡 / 台北"], ["+9", "东京 / 首尔"], ["+9.5", "阿德莱德"], ["+10", "悉尼 / 墨尔本"], ["+11", "所罗门群岛"],
    ["+12", "奥克兰 / 斐济"], ["+13", "汤加"]
  ];
  const age = typeof charAge === "function" ? charAge(birthday, Date.now()) : null;
  const both = typeof birthdayBothLabel === "function" ? birthdayBothLabel(birthday) : "";
  const born = typeof birthdayBornLabel === "function" ? birthdayBornLabel(birthday) : "";
  const accent = color || t.tint;
  const genAvatar = onGenAvatar ? async () => {
    if (!refPhoto && !String(appearance || "").trim()) { toast && toast("先填【外貌】那一栏，或者传一张参考照，不然它不知道该画谁"); return; }
    setAvBusy(true);
    try {
      const url = await onGenAvatar({ name, appearance, photoOutfit, photoStyle, refPhoto });
      if (url) setAvatarImage(url);
    } finally { setAvBusy(false); }
  } : null;
  const isPreset = AV_COLORS.indexOf(color) >= 0;
  const palette = h("div", null,
    h("div", { className: "flex items-center gap-3 flex-wrap" },
      AV_COLORS.map(c => h("button", {
        key: c, onClick: () => setColor(c), "aria-label": "使用底色 " + c,
        style: { width: 28, height: 28, borderRadius: 8, background: c, boxShadow: "inset 0 1px 1px rgba(255,255,255,.35), 0 1px 3px rgba(46,38,29,.22)", outline: color === c ? "2px solid " + t.ink : "none", outlineOffset: 2 }
      })),
      // 自选：色块本身就是取色器。没选预设时给它套一圈彩虹，一眼看出「现在用的是自定义的」
      h("label", {
        "aria-label": "自定义底色",
        style: { position: "relative", width: 28, height: 28, borderRadius: 8, display: "block", cursor: "pointer", padding: 2,
                 background: isPreset ? "conic-gradient(from 210deg, #c25a4a, #c9a227, #5a8f57, #3f6d8c, #6d5a78, #c25a4a)" : color,
                 outline: isPreset ? "none" : "2px solid " + t.ink, outlineOffset: 2, boxShadow: "0 1px 3px rgba(46,38,29,.22)" } },
        h("span", { style: { position: "absolute", inset: 2, borderRadius: 6, background: isPreset ? "transparent" : color, boxShadow: "inset 0 1px 1px rgba(255,255,255,.35)" } }),
        isPreset ? h("span", { className: "flex items-center justify-center", style: { position: "absolute", inset: 6, borderRadius: 5, background: "rgba(255,255,255,.9)", fontFamily: F_BODY, fontSize: 12, lineHeight: 1, color: t.sub } }, "+") : null,
        h("input", { type: "color", value: /^#[0-9a-fA-F]{6}$/.test(color) ? color : "#8a8577",
          onChange: e => setColor(e.target.value),
          style: { position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, border: "none", padding: 0, cursor: "pointer" } }))),
    h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 10, letterSpacing: ".1em", color: t.fog, marginTop: 8 } },
      String(color || "").toUpperCase() + (isPreset ? "" : " · 自定义")));
  const timezone = h("div", null,
    h("select", { value: tz, onChange: e => setTz(e.target.value), className: "w-full outline-none", style: { fontFamily: F_BODY, fontSize: 14, color: t.ink, background: "transparent", padding: "6px 0", border: "none" } },
      h("option", { value: "" }, "跟随系统（默认）"),
      TZ_OPTS.map(o => h("option", { key: o[0], value: o[0] }, "UTC" + (o[0][0] === "-" ? o[0] : "+" + o[0].replace("+", "")) + " · " + o[1]))),
    h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginTop: 2, lineHeight: 1.6 } }, "开时间感知后，Ta 会按自己所在时区报时间；日程仍按你本地日期。"));
  const birthdayField = (function () {
    if (age == null) return h("div", null,
      h("input", { value: birthday, onChange: e => setBirthday(e.target.value), placeholder: "3-15 / 1998-3-15 / 腊月廿三 / 农历八月十五", className: "w-full bg-transparent outline-none", style: { fontFamily: F_BODY, fontSize: 14, color: t.ink, padding: "6px 0" } }),
      (!both && !born) ? null : h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.sub, marginTop: 4, lineHeight: 1.7 } }, both, born ? h("div", { style: { color: t.fog } }, born) : null),
      h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginTop: 3, lineHeight: 1.6 } }, "公历农历都能填，【带上年份】才会算年龄。"));
    return h("div", null,
      h("input", { value: birthday, onChange: e => setBirthday(e.target.value), placeholder: "3-15 / 1998-3-15 / 腊月廿三 / 农历八月十五", className: "w-full bg-transparent outline-none", style: { fontFamily: F_BODY, fontSize: 14, color: t.ink, padding: "6px 0" } }),
      h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, color: accent, marginTop: 6, fontWeight: 600 } }, "现在 " + age + " 岁",
        h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, fontWeight: 400, marginLeft: 8 } }, "生日一过自动加一，Ta 自己也知道")),
      (!both && !born) ? null : h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.sub, marginTop: 4, lineHeight: 1.7 } }, both, born ? h("div", { style: { color: t.fog } }, born) : null),
      h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginTop: 3, lineHeight: 1.6 } }, "公历农历都能填，【带上年份】才会算年龄——填好之后，人设正文里那句「XX 岁」可以删掉了。"));
  })();
  const appearanceFields = h("div", null,
    h("div", { className: "flex items-center gap-3 mb-3" },
      h(AvatarPicker, { character: { name, avatarImage: refPhoto, color }, size: 56, radius: 12, imageMaxDim: 1024, imageQuality: 0.94, onPick: setRefPhoto, onClear: () => setRefPhoto(null) }),
      h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, lineHeight: 1.55 } }, "参考照用来锁定长相；接好图像 API 后可生成生活照。")),
    h("div", { className: "flex flex-wrap gap-1.5 mb-2" }, [["realistic", "写实照片"], ["reference", "跟随参考图"], ["anime", "二次元插画"]].map(o => h("button", { key: o[0], type: "button", onClick: () => setPhotoStyle(o[0]), className: "active:opacity-70", style: { fontFamily: F_BODY, fontSize: 11.5, padding: "5px 10px", borderRadius: 999, background: photoStyle === o[0] ? t.ink : t.bg, color: photoStyle === o[0] ? t.bg2 : t.sub, border: "1px solid " + t.line } }, o[1]))),
    h(LineArea, { value: appearance, onChange: e => setAppearance(e.target.value), rows: 5, placeholder: "长相 / 发型 / 身材 / 气质……" }),
    h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginTop: 9, marginBottom: 4 } }, "生图身份锁"),
    h(LineArea, { value: photoCanon, onChange: e => setPhotoCanon(e.target.value), rows: 3, placeholder: "年龄、性别、种族、体型等不可随机的视觉事实" }),
    h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginTop: 9, marginBottom: 4 } }, "固定服装锁"),
    h(LineArea, { value: photoOutfit, onChange: e => setPhotoOutfit(e.target.value), rows: 3, placeholder: "每张图都必须保留的服装" }),
    h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginTop: 9, marginBottom: 4 } }, "随身不摘的东西"),
    h(LineArea, { value: photoAccessories, onChange: e => setPhotoAccessories(e.target.value), rows: 2, placeholder: "眼镜、耳钉、戒指等固定配件" }));
  const voiceFields = h("div", null,
    h("div", { className: "flex flex-wrap gap-1.5 mb-2" }, (typeof TTS_VOICES !== "undefined" ? TTS_VOICES : []).map(v => h("button", { key: v.id, onClick: () => setVoiceId(voiceId === v.id ? "" : v.id), className: "active:opacity-70", style: { fontFamily: F_BODY, fontSize: 11.5, padding: "4px 10px", borderRadius: 999, background: voiceId === v.id ? t.ink : t.bg, color: voiceId === v.id ? t.bg2 : t.sub, border: "1px solid " + t.line } }, v.name))),
    h("input", { value: voiceId, onChange: e => setVoiceId(e.target.value), placeholder: "或直接填 voice_id（含克隆音色）", className: "w-full outline-none px-3 py-2 rounded-lg", style: { fontFamily: F_BODY, fontSize: 12.5, background: t.bg, color: t.ink, border: "1px solid " + t.line } }),
    h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginTop: 5, lineHeight: 1.5 } }, "接好语音 API 并选音色后，Ta 的语音消息才能真听。"));
  return h("div", { className: "h-full flex flex-col", style: { background: dossierDeskBg(accent) } },
    h("div", { className: "shrink-0 px-4 pb-2", style: { paddingTop: safeTop(8), borderBottom: "1px solid " + t.line, background: "rgba(255,255,255,.32)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)" } },
      h("div", { className: "grid items-center", style: { gridTemplateColumns: "52px 1fr 72px", minHeight: 44 } },
        h("button", { onClick: onBack, className: "flex items-center active:opacity-50", style: { width: 44, height: 44 } }, h(IArrow, { size: 19, color: t.ink })),
        h("div", { className: "text-center" },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 17, color: t.ink } }, initial ? "编辑档案" : "新建档案"),
          h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 8.5, letterSpacing: ".2em", color: t.fog } }, "PERSONA DOSSIER")),
        h("button", { onClick: save, className: "justify-self-end active:opacity-50", style: { fontFamily: "'Archivo',sans-serif", fontSize: 11, letterSpacing: ".12em", color: name.trim() ? t.ink : t.fog, padding: "10px 0 10px 10px" } }, "SAVE"))),
    h("div", { className: "flex-1 min-h-0 overflow-y-auto px-5 pb-10" },
      // 抬头这张跟列表里那张卷宗卡说同一种话：书脊、装订孔、纸纹、贴上去的照片
      h("section", { style: { position: "relative", margin: "18px 0 16px", borderRadius: 17, background: t.bg2, border: "1px solid " + t.line, overflow: "hidden", boxShadow: "0 1px 2px rgba(46,38,29,.07), 0 12px 26px -10px rgba(46,38,29,.2), inset 0 1px 0 rgba(255,255,255,.9)" } },
        h("span", { style: { position: "absolute", inset: "0 auto 0 0", width: 8, background: accent, boxShadow: "inset -1px 0 2px rgba(0,0,0,.22)" } }),
        h("span", { style: { position: "absolute", left: 2.5, top: 0, bottom: 0, width: 3, display: "flex", flexDirection: "column", justifyContent: "space-evenly" } },
          [0, 1, 2, 3].map(n => h("span", { key: n, style: { width: 3, height: 3, borderRadius: 999, background: "rgba(255,255,255,.55)", boxShadow: "inset 0 1px 1px rgba(0,0,0,.3)" } }))),
        h("span", { style: { position: "absolute", top: 0, right: 0, bottom: 0, left: 8, pointerEvents: "none", background: "repeating-linear-gradient(58deg, rgba(255,255,255,.42) 0px, rgba(255,255,255,.42) 1px, transparent 1px, transparent 9px)" } }),
        h("span", { style: { position: "absolute", right: 18, top: 0, width: 34, height: 7, borderRadius: "0 0 4px 4px", background: accent, opacity: .8 } }),
        h("div", { style: { position: "relative", padding: "17px 16px 16px 22px" } },
          h("div", { className: "flex items-center justify-between", style: { marginBottom: 14 } },
            h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 9, letterSpacing: ".2em", color: t.fog } }, "PERSONA DOSSIER"),
            // 「在册」谁都是在册，那是句废话；只有还没存下来的这一档才值得说
            initial ? null : h("span", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 8.5, letterSpacing: ".12em", color: accent, border: "1px solid " + accent, borderRadius: 999, padding: "3px 8px" } }, "待归档")),
          h("div", { className: "flex items-center gap-4" },
            h("div", { className: "shrink-0", style: { padding: 3, background: "#fffdf9", borderRadius: 4, boxShadow: "0 2px 7px rgba(46,38,29,.24)", transform: "rotate(-1.6deg)" } },
              h(AvatarPicker, { character: { name, avatarEmoji: emoji, color, avatarImage }, size: 80, radius: 3, onPick: setAvatarImage, onClear: () => setAvatarImage(null), genBusy: avBusy, onGenerate: genAvatar })),
            h("div", { className: "flex-1 min-w-0" },
              h("input", { value: name, onChange: e => setName(e.target.value), placeholder: "姓名", className: "w-full bg-transparent outline-none", style: { fontFamily: F_DISPLAY, fontSize: 24, color: t.ink } }),
              h("span", { style: { display: "block", height: 1, background: t.line, margin: "5px 0 7px" } }),
              h("input", { value: tagline, onChange: e => setTagline(e.target.value), placeholder: "一句话标签", className: "w-full bg-transparent outline-none", style: { fontFamily: F_BODY, fontSize: 12.5, color: t.fog } }))),
          h("div", { style: { marginTop: 16, paddingTop: 13, borderTop: "1px solid " + t.line } },
            h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 9, letterSpacing: ".18em", color: t.fog, marginBottom: 9 } }, "FILE COLOUR"),
            palette))),
      h(CastSection, { no: "01", title: "人物底稿", en: "PERSONA / BACKGROUND", tint: accent },
        h(LineField, { zh: "人设", en: "Persona" }, h(LineArea, { value: persona, onChange: e => setPersona(e.target.value), rows: 9, placeholder: "性格、说话风格、背景、当前关系阶段……" }))),
      h(CastSection, { no: "02", title: "时间坐标", en: "TIME / PLACE", tint: accent },
        h(LineField, { zh: "时区", en: "Timezone" }, timezone),
        h(LineField, { zh: "生日", en: "Birthday" }, birthdayField),
        h(LineField, { zh: "性别", en: "Gender" }, h("div", null,
          h("div", { style: { display: "flex", gap: 7 } },
            [["", "他（默认）"], ["她", "她"], ["TA", "TA · 中性"]].map(o => h("button", { key: o[0], onClick: () => setGender(o[0]),
              style: { fontFamily: F_BODY, fontSize: 13, color: gender === o[0] ? "#fff" : t.ink, background: gender === o[0] ? t.tint : "transparent",
                border: "1px solid " + (gender === o[0] ? t.tint : t.line), borderRadius: 999, padding: "6px 14px" } }, o[1]))),
          h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginTop: 4, lineHeight: 1.6 } },
            "只管别处怎么称呼 TA（查手机那一层原来通篇写死「他」）。默认是「他」——不动你已有角色的任何东西；新加的女生角色点一下「她」就行。")))),
      h(CastSection, { no: "03", title: "视觉档案", en: "VISUAL IDENTITY", tint: accent },
        h(LineField, { zh: "外貌 · 发自拍用", en: "Appearance" }, appearanceFields)),
      h(CastSection, { no: "04", title: "声音档案", en: "VOICEPRINT", tint: accent },
        h(LineField, { zh: "音色 · 语音消息用", en: "Voice" }, voiceFields)),
      initial ? h("button", { onClick: () => onDelete(initial.id), className: "mt-2 w-full flex items-center justify-center gap-2 py-3 active:opacity-60", style: { fontFamily: F_BODY, fontSize: 12, color: t.fog } }, h(ITrash, { size: 14 }), " 删除这位角色") : null));
}

// ============================================================
// TIES (directed)
// ============================================================
const REL_PRESETS = ["恋人", "暧昧", "朋友", "挚友", "家人", "兄妹", "同事", "上下级", "师生", "对手", "陌生人", "前任", "单向暗恋", "青梅竹马"];
// 配角的简介：默认收两行，点一下展开【全文】，还能就地改（她 2026-08-25：
// 「简介打不开看全部」）。配角没有自己的资料页，所以读和改都得落在这儿。
function NpcBrief({ npc, onSave, compact }) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(null);
  const text = String(npc.persona || "").trim();
  return h("div", { style: { marginTop: compact ? 2 : 8 } },
    h("button", {
      onClick: e => { e.stopPropagation(); setOpen(o => !o); setDraft(null); },
      className: "w-full text-left active:opacity-60"
    },
      h("div", {
        style: {
          fontFamily: F_BODY, fontSize: 11.5, lineHeight: 1.55, color: t.fog, whiteSpace: "pre-wrap",
          ...(open ? {} : { display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" })
        }
      }, text || "（还没有简介）"),
      h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: t.tint, display: "inline-block", marginTop: 4 } },
        open ? "收起" : "展开简介")),
    open && onSave ? h("div", { style: { marginTop: 8 } },
      draft == null
        ? h("button", { onClick: e => { e.stopPropagation(); setDraft(text); }, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 11.5, color: t.tint } }, "✏️ 改简介")
        : h("div", null,
            h("textarea", {
              value: draft, onChange: e => setDraft(e.target.value), rows: 10,
              onClick: e => e.stopPropagation(),
              className: "w-full bg-transparent outline-none resize-none",
              style: { fontFamily: F_BODY, fontSize: 12.5, lineHeight: 1.6, color: t.ink, border: "1px solid " + t.line, borderRadius: 10, padding: "8px 10px" }
            }),
            h("div", { className: "flex gap-2", style: { marginTop: 6 } },
              h("button", { onClick: e => { e.stopPropagation(); onSave(npc.id, draft); setDraft(null); }, className: "active:opacity-70", style: { background: t.ink, color: t.bg2, border: "none", borderRadius: 9, padding: "7px 16px", fontFamily: F_DISPLAY, fontSize: 13 } }, "保存"),
              h("button", { onClick: e => { e.stopPropagation(); setDraft(null); }, style: { fontFamily: F_BODY, fontSize: 12.5, color: t.fog, padding: "7px 8px" } }, "取消")))) : null);
}
// ============================================================
// 关系网（v60.47：一人一页，她 2026-09-02：「我是想每个角色都有自己的页面，
// 我的汇总页可以不要」＋「有些字段太长了看不完还会插入别的」）
// ============================================================
// v60.46 把所有人所有关系画在同一张网上。人一多就糊成一团，而且那一版有个
// 结构性的病：一段关系两头写的名称不一样时，我把两句用「·」拼成一句当标签
//   （「像在赶人走的死傲娇，也是我这辈子最麻烦的朋友。·翰林院编修，嘴很毒，
//     和我从十四岁吵到现在的挚友。」）
// 再配上 nowrap，那一行就直接横穿整张图、盖在别人脸上。
//
// 一人一页把这件事从根上解决了：每一页有一个【中心的人】，
// 线上写的就是【他怎么称呼对方】——一个方向、一句话，不用拼。
//
// 长相还是照现实里那个东西来（tabs-not-plain-pills）：一板子钉着的照片，
// 人和人之间牵一根线，线上别一张小标签。所以卡片是白边照片＋底下写名字，
// 每张按自己的 id 歪一点点（钉上去的照片本来就不会正）。
const TIE_R = 178;           // 伙伴离中心多远（要给中间那张牌子腾出地方）
const TIE_CARD = { center: 78, char: 62, npc: 46 };
const TIE_LABEL_MAX = 128;   // 标签最宽到这儿，超了就截——她原话「太长了看不完还会插入别的」
// 每张照片歪的角度：按 id 定死，不许每次渲染都换一个（那就成了抖动）
const tieTilt = id => {
  let n = 0;
  for (let i = 0; i < String(id).length; i++) n = (n * 31 + String(id).charCodeAt(i)) % 1000;
  return (n / 1000 - 0.5) * 5;   // ±2.5°
};
// 一张钉在板上的照片
function TiePhoto({ id, name, character, profile, size, tilt, dim, on }) {
  const t = useTheme();
  const pad = Math.max(5, Math.round(size * 0.085));
  return h("div", { style: {
    width: size + pad * 2, background: "#fbf9f5", padding: pad, paddingBottom: pad + 13,
    borderRadius: 2, boxShadow: on ? "0 0 0 2px " + t.ink + ", 0 4px 14px rgba(0,0,0,.20)" : "0 3px 10px rgba(0,0,0,.16)",
    transform: "rotate(" + tilt + "deg)", opacity: dim ? 0.25 : 1, transition: "opacity .18s",
    // ⚠️头像是 <img>：不摁住这几条，拖到第二下浏览器就当成【拖图片】，直接发
    // pointercancel 把整个手势掐掉（v60.46 在 headless 里数事件抓到的）。
    userSelect: "none", WebkitUserSelect: "none", WebkitUserDrag: "none", WebkitTouchCallout: "none"
  } },
    // 图片一律不吃事件：手势只归外面那个 div 管
    h("div", { style: { pointerEvents: "none", width: size, height: size, overflow: "hidden", background: "#e6e2da" } },
      id === "me" && !(profile || {}).avatarImage
        ? h("div", { style: { width: "100%", height: "100%", background: (profile || {}).color || t.tint, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F_DISPLAY, fontSize: size * 0.4 } }, String(name).slice(0, 1))
        : h(Avatar, { character: id === "me" ? { avatarImage: (profile || {}).avatarImage } : character, size: size, radius: 0 })),
    h("div", { style: { pointerEvents: "none", marginTop: 5, textAlign: "center", fontFamily: F_DISPLAY,
      fontSize: size > 56 ? 12 : 10.5, lineHeight: 1.15, color: "#2a2721",
      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, name));
}
function TiesBoard({ centerId, me, profile, allChars, rels, savedPos, onSavePos, onEditEdge }) {
  const t = useTheme();
  const wrapRef = useRef(null);
  const [k, setK] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [sel, setSel] = useState(null);     // 选中的那条关系 "a|b"
  const [drag, setDrag] = useState({});
  const ptr = useRef({ pts: {}, dist: 0, moved: false, node: null, start: null, live: null });
  const all = allChars || [];
  const byId = id => all.find(c => c.id === id);
  const nameOf = id => id === "me" ? me : (byId(id) || {}).name || "?";
  const isNpc = id => !!(byId(id) || {}).npc;

  // ---- 这一页只画【和中心那个人直接有关系的】----
  // 这就是「一人一页」的全部含义：不是把整张网裁一块给你看，是这个人自己的一页。
  const seen = {};
  const links = [];
  Object.keys(rels || {}).forEach(key => {
    const [f, g] = key.split("->");
    if (f !== centerId && g !== centerId) return;
    const other = f === centerId ? g : f;
    if (other === centerId || seen[other]) return;
    if (other !== "me" && !byId(other)) return;
    seen[other] = 1;
    const out = rels[centerId + "->" + other], inc = rels[other + "->" + centerId];
    // ⚠️标签只取【中心这个人怎么称呼对方】这一个方向。
    //   v60.46 是把两头拼成一句，两边写得都长的时候那一行能横穿整张图。
    const e = out || inc;
    links.push({ other, label: (e && e.label) || "", note: (e && e.note) || "",
      backLabel: out && inc && (inc.label || "") !== (out.label || "") ? inc.label : "",
      backNote: out && inc && (inc.note || "") !== (out.note || "") ? inc.note : "",
      both: !!(out && inc), out: !!out });
  });

  // ---- 摆位：中心在正中，伙伴绕一圈；她拖过的按她的来 ----
  const key = id => centerId + "|" + id;
  const base = {};
  base[centerId] = { x: 0, y: 0 };
  const n = links.length;
  links.forEach((L, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / Math.max(1, n);
    const r = TIE_R + (n > 6 ? (n - 6) * 16 : 0);
    base[L.other] = { x: Math.round(Math.cos(a) * r), y: Math.round(Math.sin(a) * r) };
  });
  const saved = Object.assign({}, savedPos || {}, drag);
  const P = id => saved[key(id)] || base[id] || { x: 0, y: 0 };
  const szOf = id => id === centerId ? TIE_CARD.center : isNpc(id) ? TIE_CARD.npc : TIE_CARD.char;

  // ---- 第一眼要看得见这一整页 ----
  const fitted = useRef(centerId);
  const fitNow = () => {
    const el = wrapRef.current;
    if (!el) return;
    const ids = [centerId].concat(links.map(L => L.other));
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    ids.forEach(id => { const p = P(id), r = szOf(id) / 2 + 34;
      x0 = Math.min(x0, p.x - r); x1 = Math.max(x1, p.x + r); y0 = Math.min(y0, p.y - r); y1 = Math.max(y1, p.y + r); });
    const rect = el.getBoundingClientRect();
    const kk = Math.max(0.5, Math.min(1.15, Math.min((rect.width - 30) / Math.max(1, x1 - x0), (rect.height - 30) / Math.max(1, y1 - y0))));
    setK(kk);
    setPan({ x: -(x0 + x1) / 2 * kk, y: -(y0 + y1) / 2 * kk });
  };
  // 换一个人就重新归一次位：上一页缩到哪儿跟这一页没关系
  React.useLayoutEffect(() => {
    if (!wrapRef.current) return;
    if (fitted.current === centerId && fitted.done) return;
    fitted.current = centerId; fitted.done = true;
    setSel(null); fitNow();
  }, [centerId]);

  const onDown = e => {
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (x) {}
    const p = ptr.current;
    p.pts[e.pointerId] = { x: e.clientX, y: e.clientY };
    if (Object.keys(p.pts).length === 1) { p.moved = false; p.start = { x: e.clientX, y: e.clientY }; }
    p.dist = 0;
  };
  const onMove = e => {
    const p = ptr.current;
    if (!p.pts[e.pointerId]) return;
    const ids = Object.keys(p.pts);
    if (ids.length === 1) {
      const p0 = p.pts[e.pointerId], dx = e.clientX - p0.x, dy = e.clientY - p0.y;
      if (Math.abs(e.clientX - p.start.x) + Math.abs(e.clientY - p.start.y) > 7) p.moved = true;
      p.pts[e.pointerId] = { x: e.clientX, y: e.clientY };
      if (p.node) {
        const id = p.node;
        // ⚠️当前值同时记进 ref：pointermove 比 React 重渲染快得多，松手那下去读渲染
        // 闭包里的 drag，读到的会是没动过的原位（v60.46 walker 抓到的）。
        const cur = p.live || P(id);
        p.live = { x: cur.x + dx / k, y: cur.y + dy / k };
        setDrag(d => ({ ...d, [key(id)]: p.live }));
      } else setPan(v => ({ x: v.x + dx, y: v.y + dy }));
    } else if (ids.length === 2) {
      p.moved = true;
      p.pts[e.pointerId] = { x: e.clientX, y: e.clientY };
      const two = Object.keys(p.pts).map(i => p.pts[i]);
      const d = Math.hypot(two[0].x - two[1].x, two[0].y - two[1].y);
      if (p.dist) setK(v => Math.max(0.42, Math.min(2.6, v * (d / p.dist))));
      p.dist = d;
    }
  };
  const onUp = e => {
    const p = ptr.current;
    delete p.pts[e.pointerId];
    p.dist = 0;
    if (!Object.keys(p.pts).length) {
      if (p.node && p.moved && p.live && onSavePos) onSavePos(key(p.node), p.live);
      if (!p.moved) setSel(null);
      p.node = null; p.live = null;
    }
  };
  // ⌖ 只把视野拉回来，【不动她摆好的位置】——一个「归位」键顺手清掉她拖了半天的
  // 布局，那是最气人的那种按钮。清摆法是另一个键，而且只在她真拖过之后才出现。
  const recenter = () => { setSel(null); fitNow(); };
  const resetLayout = () => { setDrag({}); setSel(null); if (onSavePos) onSavePos(null, null); setTimeout(fitNow, 0); };
  const moved = Object.keys(savedPos || {}).some(x => x.indexOf(centerId + "|") === 0) || Object.keys(drag).length > 0;

  // 照片本身占的半径（白边算进去）——牌子要挂在两张照片【中间那段空当】的正中，
  // 不是两个圆心的正中：圆心的正中会落在中间那张大照片里头，牌子直接被压住看不见
  // （第一版就是这样，她那句「还会插入别的」在这儿也成立）。
  const halfOf = id => { const sz = szOf(id); return sz / 2 + Math.max(5, Math.round(sz * 0.085)); };
  const thread = (A, B, ra, rb) => {
    const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;
    const dx = B.x - A.x, dy = B.y - A.y, len = Math.hypot(dx, dy) || 1;
    const bow = Math.min(20, len * 0.08);
    const ux = dx / len, uy = dy / len;
    const at = Math.max(ra + 6, Math.min(len - rb - 6, ra + (len - ra - rb) / 2));
    return { d: "M" + A.x + "," + A.y + " Q" + (mx - uy * bow) + "," + (my + ux * bow) + " " + B.x + "," + B.y,
      mx: A.x + ux * at - uy * bow / 2, my: A.y + uy * at + ux * bow / 2 };
  };
  const card = id => {
    const p = P(id), size = szOf(id);
    return h("div", {
      key: id,
      onPointerDown: () => { ptr.current.node = id; ptr.current.live = null; },
      style: { position: "absolute", left: p.x, top: p.y, transform: "translate(-50%,-50%)", touchAction: "none", cursor: "grab" }
    }, h(TiePhoto, { id, name: nameOf(id), character: byId(id), profile, size,
      tilt: id === centerId ? 0 : tieTilt(id), dim: !!(sel && sel !== id && id !== centerId), on: sel === id }));
  };

  const selLink = sel ? links.find(L => L.other === sel) : null;
  return h(Fragment, null,
    h("div", { ref: wrapRef, className: "flex-1 min-h-0", style: { position: "relative", overflow: "hidden", touchAction: "none" },
      onPointerDown: onDown, onPointerMove: onMove, onPointerUp: onUp, onPointerCancel: onUp },
      links.length === 0
        ? h("div", { className: "h-full flex items-center justify-center px-10 text-center",
            style: { fontFamily: F_BODY, fontSize: 13, lineHeight: 1.8, color: t.fog } },
            nameOf(centerId) + " 还没有任何关系。\n点右上「＋」给 TA 加一段。")
        : h("div", { style: { position: "absolute", left: "50%", top: "50%", width: 0, height: 0,
            transform: "translate(" + pan.x + "px," + pan.y + "px) scale(" + k + ")" } },
            h("svg", { width: 3000, height: 3000, style: { position: "absolute", left: -1500, top: -1500, overflow: "visible", pointerEvents: "none" } },
              h("defs", null, h("marker", { id: "tieArrow", viewBox: "0 0 8 8", refX: 7, refY: 4, markerWidth: 6, markerHeight: 6, orient: "auto" },
                h("path", { d: "M0,0 L8,4 L0,8 z", fill: t.ink, opacity: 0.5 }))),
              h("g", { transform: "translate(1500,1500)" },
                links.map(L => {
                  const c = thread(P(centerId), P(L.other), halfOf(centerId), halfOf(L.other));
                  const lit = !sel || sel === L.other;
                  return h("path", { key: "l" + L.other, d: c.d, fill: "none", stroke: t.ink,
                    strokeWidth: 1.1, opacity: lit ? 0.42 : 0.07,
                    markerEnd: L.both ? undefined : "url(#tieArrow)" });
                }))),
            // 线上别的那张小标签：只写【中心这个人怎么称呼对方】，一行，长了就截
            links.filter(L => L.label).map(L => {
              const c = thread(P(centerId), P(L.other), halfOf(centerId), halfOf(L.other));
              const lit = !sel || sel === L.other;
              return h("div", { key: "t" + L.other,
                onPointerDown: ev => { ev.stopPropagation(); ptr.current.node = null; },
                onClick: ev => { ev.stopPropagation(); setSel(s => s === L.other ? null : L.other); },
                style: { position: "absolute", left: c.mx, top: c.my, transform: "translate(-50%,-50%)",
                  maxWidth: TIE_LABEL_MAX, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  background: t.ink, color: t.bg2, padding: "2px 7px", borderRadius: 3,
                  fontFamily: F_BODY, fontSize: 10.5, lineHeight: 1.4,
                  opacity: lit ? 1 : 0.1, transition: "opacity .18s", cursor: "pointer" } }, L.label);
            }),
            [centerId].concat(links.map(L => L.other)).map(card)),
      // 选中一段：整句写在这儿（标签上截掉的那部分在这里看得全）
      selLink ? h("div", { style: { position: "absolute", left: 12, right: 12, bottom: 12,
        background: t.bg2, border: "1px solid " + t.line, borderRadius: 14, padding: "11px 13px",
        boxShadow: "0 3px 14px rgba(0,0,0,.12)" } },
        h("div", { className: "flex items-center", style: { gap: 8 } },
          h("div", { className: "min-w-0 flex-1", style: { fontFamily: F_DISPLAY, fontSize: 15, color: t.ink } },
            nameOf(centerId) + (selLink.both ? " ⇄ " : selLink.out ? " → " : " ← ") + nameOf(selLink.other)),
          h("button", { onClick: () => onEditEdge(centerId, selLink.other), className: "active:opacity-60 shrink-0",
            style: { fontFamily: F_BODY, fontSize: 12, color: t.tint } }, "编辑"),
          h("button", { onClick: () => setSel(null), className: "active:opacity-60 shrink-0",
            style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, marginLeft: 2 } }, "收起")),
        selLink.label ? h("div", { style: { fontFamily: F_DISPLAY, fontStyle: "italic", fontSize: 14, lineHeight: 1.6, color: t.ink, marginTop: 6 } }, selLink.label) : null,
        selLink.note ? h("div", { style: { fontFamily: F_BODY, fontSize: 12, lineHeight: 1.65, color: t.sub, marginTop: 4, whiteSpace: "pre-wrap" } }, selLink.note) : null,
        // 对方那一头写得不一样时，也摆出来——一段关系两边看法不同本来就是内容
        (selLink.backLabel || selLink.backNote) ? h("div", { style: { marginTop: 8, paddingTop: 8, borderTop: "1px dashed " + t.line } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: t.fog, marginBottom: 3 } }, nameOf(selLink.other) + "那头写的"),
          selLink.backLabel ? h("div", { style: { fontFamily: F_DISPLAY, fontStyle: "italic", fontSize: 13, lineHeight: 1.6, color: t.sub } }, selLink.backLabel) : null,
          selLink.backNote ? h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, lineHeight: 1.6, color: t.fog, marginTop: 2, whiteSpace: "pre-wrap" } }, selLink.backNote) : null) : null) : null,
      h("div", { style: { position: "absolute", right: 12, top: 12, display: "flex", flexDirection: "column", gap: 6 } },
        [["＋", () => setK(v => Math.min(2.6, v * 1.35))],
         ["－", () => setK(v => Math.max(0.42, v / 1.35))],
         ["⌖", recenter]].concat(moved ? [["⟲", resetLayout]] : [])
         .map(([lb, fn]) => h("button", { key: lb, onClick: fn, className: "active:opacity-70",
          style: { width: 32, height: 32, borderRadius: 10, fontFamily: F_BODY, fontSize: 14, color: t.ink,
            background: "rgba(246,244,239,.92)", border: "1px solid " + t.line, boxShadow: "0 1px 5px rgba(0,0,0,.08)" } }, lb)))));
}
function Ties({
  characters,
  allChars,
  rels,
  tiePos,
  onSaveTiePos,
  onSaveNpcBrief,
  profile,
  onBack,
  onSave,
  onCreateNpc,
  onDeleteNpc,
  npcsOf,
  npcBusy
}) {
  const t = useTheme();
  const [comp, setComp] = useState(null); // composer state | null
  const [view, setView] = useState(null); // null=关系板 / participant id=按条看的详情页
  const [board, setBoard] = useState("me"); // 现在看谁的板子（一人一页）
  const me = profile.name || "我";
  const all = allChars || characters;   // 解析用全量（含 NPC）
  const nameOf = id => id === "me" ? me : (all.find(c => c.id === id) || {}).name || "?";
  const charOf = id => id === "me" ? null : all.find(c => c.id === id);
  const npcOf = id => { const c = all.find(x => x.id === id); return c && c.npc ? c : null; };
  const edge = (from, to) => rels[from + "->" + to];

  // ---- reconstruct relationship cards from directed edges ----
  const canon = (x, y) => x === "me" ? [x, y] : y === "me" ? [y, x] : x < y ? [x, y] : [y, x];
  const exists = id => id === "me" || all.some(c => c.id === id);   // 配角也算数，否则他那段关系整条消失
  const seen = {};
  const cards = [];
  Object.keys(rels).forEach(k => {
    const [f, g] = k.split("->");
    const [a, b] = canon(f, g);
    const pk = a + "|" + b;
    if (seen[pk] || !exists(a) || !exists(b)) return;
    seen[pk] = 1;
    cards.push({ a, b });
  });

  // ---- open composer ----
  const openNew = () => setComp({
    edit: false, tab: "me", meChar: characters[0] ? characters[0].id : "", npcAsk: "",
    pair: characters.length >= 2 ? [characters[0].id, characters[1].id] : [],
    label: "", dir: "double", single: "fwd", split: false, note: "", noteFwd: "", noteBwd: ""
  });
  const openEdit = (a, b) => {
    const fwd = edge(a, b), bwd = edge(b, a);
    const both = !!fwd && !!bwd;
    const only = fwd ? "fwd" : "bwd";
    const s = both && ((fwd.note || "") !== (bwd.note || ""));
    setComp({
      edit: true, orig: { a, b },
      tab: a === "me" ? "me" : "chars",
      meChar: a === "me" ? b : (characters[0] ? characters[0].id : ""),
      pair: a === "me" ? [characters[0] ? characters[0].id : "", ""] : [a, b],
      label: (fwd || bwd || {}).label || "",
      dir: both ? "double" : "single",
      single: both ? "fwd" : only,
      split: s,
      note: (fwd || bwd || {}).note || "",
      noteFwd: (fwd || {}).note || "",
      noteBwd: (bwd || {}).note || ""
    });
  };

  // resolve idA / idB from composer
  const idsOf = c => c.tab === "me" ? { A: "me", B: c.meChar } : { A: c.pair[0], B: c.pair[1] };
  const validComp = c => {
    const { A, B } = idsOf(c);
    return A && B && A !== B && c.label.trim();
  };
  const doSave = () => {
    const c = comp;
    if (!validComp(c)) return;
    const { A, B } = idsOf(c);
    // if editing and the identity of the pair changed, clear old edges first
    if (c.edit && c.orig && !((c.orig.a === A && c.orig.b === B) || (c.orig.a === B && c.orig.b === A))) {
      onSave(c.orig.a + "->" + c.orig.b, "", "");
      onSave(c.orig.b + "->" + c.orig.a, "", "");
    }
    const lb = c.label.trim();
    if (c.dir === "double") {
      onSave(A + "->" + B, lb, c.split ? c.noteFwd : c.note);
      onSave(B + "->" + A, lb, c.split ? c.noteBwd : c.note);
    } else {
      const fwd = c.single === "fwd";
      onSave((fwd ? A : B) + "->" + (fwd ? B : A), lb, c.note);
      onSave((fwd ? B : A) + "->" + (fwd ? A : B), "", ""); // clear opposite
    }
    setComp(null);
  };
  const doDelete = () => {
    const c = comp;
    if (c.edit && c.orig) {
      onSave(c.orig.a + "->" + c.orig.b, "", "");
      onSave(c.orig.b + "->" + c.orig.a, "", "");
    }
    setComp(null);
  };

  // ---- card renderer ----
  const Chip = ({ id }) => {
    const ch = charOf(id);
    return h("div", { className: "flex items-center gap-1.5" },
      id === "me"
        ? h("div", { style: { width: 24, height: 24, borderRadius: 7, background: profile.color || t.tint, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F_BODY, fontSize: 11, color: "#fff" } }, me.slice(0, 1))
        : h(Avatar, { character: ch, size: 24, radius: 7 }),
      h("span", { style: { fontFamily: F_DISPLAY, fontSize: 15, color: t.ink } }, nameOf(id)));
  };
  // ---- 某个人的关系伙伴 ----
  const partnersOf = id => cards.filter(c => c.a === id || c.b === id);

  // ---- 详情页某一条（从 selfId 视角看伙伴）----
  const DetailRow = ({ selfId, card }) => {
    const other = card.a === selfId ? card.b : card.a;
    const out = edge(selfId, other), inc = edge(other, selfId);
    const both = !!out && !!inc;
    const arrow = both ? "⇄" : out ? "→" : "←";
    let labelText, noteText;
    if (both) {
      const same = (out.label || "") === (inc.label || "");
      labelText = same ? out.label : out.label + " · " + inc.label;
      noteText = (out.note || "") === (inc.note || "") ? out.note : [out.note, inc.note].filter(Boolean).join("　／　");
    } else {
      const e = out || inc;
      labelText = e.label; noteText = e.note;
    }
    return h("button", {
      onClick: () => openEdit(card.a, card.b),
      className: "w-full text-left active:opacity-70 mb-2.5",
      style: { background: t.bg2, border: "1px solid " + t.line, borderRadius: 16, padding: "14px 16px" }
    },
      h("div", { className: "flex items-center gap-2 mb-2" },
        h("span", { style: { fontFamily: F_BODY, fontSize: 15, color: t.fog } }, arrow),
        h(Chip, { id: other })),
      h("div", { style: { fontFamily: F_DISPLAY, fontStyle: "italic", fontSize: 17, color: t.ink } }, labelText || "未命名"),
      noteText && h("div", { style: { fontFamily: F_BODY, fontSize: 12, lineHeight: 1.5, color: t.sub, marginTop: 4 } }, noteText));
  };
  // 伙伴是配角时，关系卡下面直接挂他的简介——配角没有自己的资料页，
  // 这儿是唯一能读到全文、也能改的地方（她 2026-08-25：「简介打不开看全部」）。
  // ⚠️外层不能再用 <button>：简介框里有 textarea 和按钮，嵌不进 button。
  const DetailRowWrap = ({ selfId, card }) => {
    const other = card.a === selfId ? card.b : card.a;
    const npc = npcOf(other);
    if (!npc) return h(DetailRow, { selfId: selfId, card: card });
    const e = edge(selfId, other) || edge(other, selfId) || {};
    return h("div", { className: "mb-2.5", style: { background: t.bg2, border: "1px solid " + t.line, borderRadius: 16, padding: "14px 16px" } },
      h("div", { onClick: () => openEdit(card.a, card.b), className: "active:opacity-70", style: { cursor: "pointer" } },
        h("div", { className: "flex items-center gap-2 mb-2" },
          h("span", { style: { fontFamily: F_BODY, fontSize: 15, color: t.fog } }, "⇄"),
          h(Chip, { id: other }),
          h("span", { style: { marginLeft: "auto", fontFamily: F_BODY, fontSize: 10.5, color: t.fog } }, "只在群里出场")),
        h("div", { style: { fontFamily: F_DISPLAY, fontStyle: "italic", fontSize: 17, color: t.ink } }, e.label || "未命名")),
      h(NpcBrief, { npc: npc, onSave: onSaveNpcBrief }),
      onDeleteNpc ? h("button", { onClick: () => onDeleteNpc(npc.id), className: "active:opacity-60", style: { marginTop: 8, fontFamily: F_BODY, fontSize: 11.5, color: t.accent } }, "删除这个配角") : null);
  };

  // ---- 详情视图 ----
  if (view !== null) {
    const mine = partnersOf(view);
    return h("div", { className: "h-full flex flex-col" },
      h(Head, {
        zh: view === "me" ? me : nameOf(view), en: "Ties · " + mine.length, onBack: () => setView(null),
        right: h("button", { onClick: openNew, className: "active:opacity-50" }, h(IPlus, { size: 20, color: t.ink }))
      }),
      h("div", { className: "flex-1 overflow-y-auto px-6 pb-8" },
        mine.length === 0
          ? h("div", { className: "pt-6" },
              h(Empty, { text: "还没有关系", sub: "点右上「＋」为 TA 新增一段关系" }))
          : h(Fragment, null,
              h("div", { className: "pt-2 mb-3" }, h(Eyebrow, null, mine.length + " 段关系")),
              mine.map(c => h(DetailRowWrap, { key: c.a + "|" + c.b, selfId: view, card: c })))),
      comp && h(RelComposer, {
        comp, setComp, characters, profile, me, nameOf, onCreateNpc, onDeleteNpc, onSaveNpcBrief, npcsOf, npcBusy,
        valid: validComp(comp), onSave: doSave, onDelete: doDelete, onClose: () => setComp(null)
      }));
  }

  // ---- 关系网：一人一页（默认）----
  // 她 2026-09-02：「我是想每个角色都有自己的页面，我的汇总页可以不要」。
  // 切人不摆一排药丸（tabs-not-plain-pills）：这一页答的问题是「现在看谁的板子」，
  // 而这个 app 里认人靠的是【脸】不是名字——所以切换条就是一排脸，
  // 选中那张抬起来、放大、露出名字，没选中的缩着压暗。换个 app 这条不成立。
  const boardIds = ["me"].concat(characters.map(c => c.id));
  const boardId = boardIds.indexOf(board) >= 0 ? board : boardIds[0];
  const faceStrip = h("div", { className: "shrink-0 flex items-end gap-2 px-4 pb-2",
    style: { overflowX: "auto", overflowY: "hidden", WebkitOverflowScrolling: "touch" } },
    boardIds.map(id => {
      const on = id === boardId;
      const ch = id === "me" ? { avatarImage: profile.avatarImage, color: profile.color } : all.find(c => c.id === id);
      return h("button", { key: id, onClick: () => setBoard(id), className: "shrink-0 active:opacity-70",
        style: { textAlign: "center", paddingTop: on ? 0 : 6, transition: "padding .16s" } },
        h("div", { style: { width: on ? 46 : 34, height: on ? 46 : 34, borderRadius: on ? 12 : 10, overflow: "hidden",
          margin: "0 auto", opacity: on ? 1 : 0.42, filter: on ? "none" : "grayscale(0.7)",
          boxShadow: on ? "0 2px 9px rgba(0,0,0,.20)" : "none", transition: "all .16s" } },
          (id === "me" && !profile.avatarImage)
            ? h("div", { style: { width: "100%", height: "100%", background: profile.color || t.tint, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F_DISPLAY, fontSize: on ? 19 : 14 } }, me.slice(0, 1))
            : h(Avatar, { character: ch, size: on ? 46 : 34, radius: 0 })),
        on ? h("div", { style: { fontFamily: F_DISPLAY, fontSize: 11, color: t.ink, marginTop: 3, maxWidth: 66,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, id === "me" ? me : nameOf(id)) : null);
    }));
  const nBoard = partnersOf(boardId).length;
  return h("div", { className: "h-full flex flex-col", style: { background: t.bg } },
    // 紧凑标题栏（mobile-ui-layout 第 1 条）：这一页的正文就是那块板子，高度全给它
    h("div", { className: "shrink-0 flex items-center px-4 pb-2", style: { paddingTop: safeTop(10) } },
      h("button", { onClick: onBack, "aria-label": "返回", className: "active:opacity-50 flex items-center justify-center", style: { width: 40, height: 40, marginLeft: -8 } }, h(IArrow, { size: 19, color: t.ink })),
      h("div", { className: "flex-1 min-w-0 text-center px-1" },
        h("div", { className: "truncate", style: { fontFamily: F_DISPLAY, fontSize: 16, color: t.ink, lineHeight: 1.15 } },
          (boardId === "me" ? me : nameOf(boardId)) + " 的关系"),
        h("div", { className: "truncate", style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 1 } },
          nBoard ? nBoard + " 段 · 点线上的牌子看整句" : "还没有关系")),
      h("div", { className: "flex items-center justify-end", style: { gap: 10, minWidth: 40 } },
        characters.length > 0 ? h("button", { onClick: openNew, className: "active:opacity-50" }, h(IPlus, { size: 20, color: t.ink })) : null)),
    faceStrip,
    characters.length === 0
      ? h("div", { className: "flex-1 px-6" }, h(Empty, { text: "还没有角色", sub: "先去人格档案馆录入" }))
      : h(TiesBoard, {
          key: boardId, centerId: boardId, me, profile, allChars: all, rels,
          savedPos: tiePos, onSavePos: onSaveTiePos, onEditEdge: openEdit
        }),
    // 配角的简介只有单人页能读全文、能改、能删（她 2026-08-25 定的），入口留在这儿
    boardId !== "me" ? h("button", { onClick: () => setView(boardId), className: "shrink-0 active:opacity-60",
      style: { fontFamily: F_BODY, fontSize: 12, color: t.tint, padding: "8px 0 12px" } }, "按条看 · 改配角简介 ›") : null,
    comp && h(RelComposer, {
      comp, setComp, characters, profile, me, nameOf, onCreateNpc, onDeleteNpc, onSaveNpcBrief, npcsOf, npcBusy,
      valid: validComp(comp), onSave: doSave, onDelete: doDelete, onClose: () => setComp(null)
    }));
}

function RelComposer({ comp, setComp, characters, profile, me, nameOf, valid, onSave, onDelete, onClose, onCreateNpc, onDeleteNpc, onSaveNpcBrief, npcsOf, npcBusy }) {
  const t = useTheme();
  const c = comp;
  const set = patch => setComp({ ...c, ...patch });
  const A = c.tab === "me" ? "me" : c.pair[0];
  const B = c.tab === "me" ? c.meChar : c.pair[1];
  const nA = A ? nameOf(A) : "…", nB = B ? nameOf(B) : "…";

  const seg = (val, cur, onClick, txt) => h("button", {
    onClick, style: {
      flex: 1, fontFamily: F_BODY, fontSize: 13, padding: "9px 0", borderRadius: 12,
      background: val === cur ? t.ink : "transparent", color: val === cur ? t.bg2 : t.sub,
      border: "1px solid " + (val === cur ? t.ink : t.line), transition: "all .15s"
    }
  }, txt);

  const pickCard = (id, selected, onClick) => {
    const ch = characters.find(x => x.id === id);
    return h("button", {
      key: id, onClick, className: "flex items-center gap-2.5 active:opacity-70",
      style: {
        padding: "10px 12px", borderRadius: 14, textAlign: "left",
        background: selected ? "rgba(63,109,140,0.10)" : t.bg2,
        border: "1px solid " + (selected ? t.tint : t.line)
      }
    },
      h(Avatar, { character: ch, size: 32, radius: 9 }),
      h("span", { className: "flex-1", style: { fontFamily: F_DISPLAY, fontSize: 15, color: t.ink } }, ch ? ch.name : "?"),
      selected && h(ICheck, { size: 15, color: t.tint }));
  };
  const togglePair = id => {
    const p = c.pair.filter(Boolean);
    if (p.includes(id)) set({ pair: p.filter(x => x !== id) });
    else if (p.length < 2) set({ pair: [...p, id] });
    else set({ pair: [p[1], id] });
  };

  const descBox = (val, onChange, ph) => h("div", null,
    h("textarea", {
      value: val, onChange: e => onChange(e.target.value.slice(0, 500)), rows: 3, maxLength: 500,
      placeholder: ph, className: "w-full bg-transparent outline-none resize-none",
      style: { fontFamily: F_BODY, fontSize: 13, lineHeight: 1.6, color: t.ink, borderBottom: "1px solid " + t.line, paddingBottom: 8 }
    }),
    h("div", { className: "text-right", style: { fontFamily: F_BODY, fontSize: 10, color: t.fog, marginTop: 3 } }, (val || "").length + "/500"));

  return h(Sheet, { onClose, tall: true },
    // header
    h("div", { className: "flex items-center justify-between mb-5" },
      h("span", { style: { fontFamily: F_DISPLAY, fontSize: 21, color: t.ink } }, c.edit ? "编辑关系" : "新增关系"),
      h("div", { className: "flex items-center gap-3" },
        c.edit && h("button", { onClick: onDelete, className: "active:opacity-50" }, h(ITrash, { size: 18, color: t.fog })),
        c.tab !== "npc" && h("button", { onClick: onSave, disabled: !valid, className: "active:opacity-50", style: { opacity: valid ? 1 : 0.35 } }, h(ICheck, { size: 20, color: t.ink })))),

    // tab: 我和角色 / 角色之间 / NPC
    // NPC 本来就是「某个角色身边的一段关系」，入口放这儿她才找得到（她 2026-08-25：
    // 我原先塞在资料卡里，她说找不到）。
    h("div", { className: "flex gap-2 mb-5" },
      seg("me", c.tab, () => set({ tab: "me" }), "我和角色"),
      seg("chars", c.tab, () => set({ tab: "chars" }), "角色之间"),
      onCreateNpc ? seg("npc", c.tab, () => set({ tab: "npc" }), "NPC") : null),

    // NPC 分支：不是填关系，是生成一个只在群里出场的配角。
    // 它除了人设什么都没有——没有单聊、没有心情好感、不进任何后台生成。
    c.tab === "npc" ? h(Fragment, null,
      h(Eyebrow, { style: { marginBottom: 10 } }, "算在谁身边"),
      h("div", { className: "grid grid-cols-2 gap-2 mb-5" },
        characters.map(ch => pickCard(ch.id, c.meChar === ch.id, () => set({ meChar: ch.id })))),
      h(Eyebrow, { style: { marginBottom: 8 } }, "要生成谁"),
      h("input", {
        value: c.npcAsk || "", onChange: e => set({ npcAsk: e.target.value }),
        placeholder: "陆闻 / 他的属下 / 她师姐",
        className: "w-full bg-transparent outline-none pb-2",
        style: { fontFamily: F_DISPLAY, fontSize: 18, color: t.ink, borderBottom: "1px solid " + t.line }
      }),
      h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, lineHeight: 1.6, margin: "10px 0 14px" } },
        "写人设里提到过的名字，或者一个位置（「他的属下」）。会按 " + (nameOf(c.meChar) || "这个角色")
        + " 的人设生成一份几百字的小简介，并自动建好你俩的关系。\n配角只在群聊里出场：没有单聊、没有心情好感、不发朋友圈、不占后台生成；删掉 "
        + (nameOf(c.meChar) || "本人") + " 时会一起走。"),
      h("button", {
        onClick: () => { const v = String(c.npcAsk || "").trim(); if (!v || !c.meChar || npcBusy) return; onCreateNpc(c.meChar, v); set({ npcAsk: "" }); },
        className: "w-full active:opacity-70",
        style: { background: t.ink, color: t.bg2, border: "none", borderRadius: 12, padding: "12px 0", fontFamily: F_DISPLAY, fontSize: 16,
          opacity: (String(c.npcAsk || "").trim() && c.meChar && !npcBusy) ? 1 : 0.4 }
      }, npcBusy ? "生成中…" : "生成"),
      (npcsOf ? npcsOf(c.meChar) : []).length ? h("div", { style: { marginTop: 18 } },
        h(Eyebrow, { style: { marginBottom: 8 } }, nameOf(c.meChar) + " 身边已有的"),
        h("div", { className: "space-y-2" }, npcsOf(c.meChar).map(n => h("div", {
          key: n.id,
          style: { display: "flex", alignItems: "flex-start", gap: 8, padding: "9px 11px", background: t.bg, border: "1px solid " + t.line, borderRadius: 10 }
        },
          h("div", { style: { flex: 1, minWidth: 0 } },
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14.5, color: t.ink } }, n.name),
            h(NpcBrief, { npc: n, onSave: onSaveNpcBrief, compact: true })),
          onDeleteNpc ? h("button", { onClick: () => onDeleteNpc(n.id), className: "active:opacity-60 shrink-0", style: { fontFamily: F_BODY, fontSize: 12, color: t.accent, padding: "0 2px" } }, "删除") : null)))) : null
    ) : h(Fragment, null,

    // participants
    h(Eyebrow, { style: { marginBottom: 10 } }, c.tab === "me" ? "选择角色" : "选择两位角色"),
    h("div", { className: "grid grid-cols-2 gap-2 mb-5" },
      c.tab === "me"
        ? characters.map(ch => pickCard(ch.id, c.meChar === ch.id, () => set({ meChar: ch.id })))
        : characters.map(ch => pickCard(ch.id, c.pair.includes(ch.id), () => togglePair(ch.id)))),

    // 关系名称
    h(Eyebrow, { style: { marginBottom: 8 } }, "关系名称"),
    h("input", {
      value: c.label, onChange: e => set({ label: e.target.value }),
      placeholder: "青梅竹马、前任、互相试探",
      className: "w-full bg-transparent outline-none pb-2",
      style: { fontFamily: F_DISPLAY, fontSize: 18, color: t.ink, borderBottom: "1px solid " + t.line }
    }),
    h("div", { className: "flex flex-wrap gap-1.5 mt-3 mb-5" }, REL_PRESETS.map(p => h("button", {
      key: p, onClick: () => set({ label: p }),
      style: { fontFamily: F_BODY, fontSize: 11, padding: "4px 10px", borderRadius: 999, border: "1px solid " + t.line, color: t.sub }
    }, p))),

    // 关系方向
    h(Eyebrow, { style: { marginBottom: 8 } }, "关系方向"),
    h("div", { className: "flex gap-2 mb-4" },
      seg("double", c.dir, () => set({ dir: "double" }), "双向"),
      seg("single", c.dir, () => set({ dir: "single" }), "单向")),

    // 单向：谁对谁
    c.dir === "single" && h(Fragment, null,
      h(Eyebrow, { style: { marginBottom: 8 } }, "单向是谁对谁"),
      h("div", { className: "flex gap-2 mb-4" },
        seg("fwd", c.single, () => set({ single: "fwd" }), nA + " → " + nB),
        seg("bwd", c.single, () => set({ single: "bwd" }), nB + " → " + nA))),

    // 双向：是否分别描述
    c.dir === "double" && h("button", {
      onClick: () => set({ split: !c.split }),
      className: "flex items-center justify-between w-full mb-3 active:opacity-70"
    },
      h("span", { style: { fontFamily: F_BODY, fontSize: 13, color: t.sub } }, "两个方向分别描述"),
      h("div", { style: { width: 40, height: 23, borderRadius: 999, padding: 2, background: c.split ? t.ink : t.line, transition: "background .2s" } },
        h("div", { style: { width: 19, height: 19, borderRadius: 999, background: "#fff", transform: c.split ? "translateX(17px)" : "translateX(0)", transition: "transform .2s" } }))),

    // 关系描述
    h(Eyebrow, { style: { marginBottom: 8 } }, "关系描述"),
    (c.dir === "double" && c.split)
      ? h(Fragment, null,
          h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginBottom: 4 } }, nA + " 眼中的 " + nB),
          descBox(c.noteFwd, v => set({ noteFwd: v }), "写清楚这段关系的背景、张力和禁忌。"),
          h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, margin: "12px 0 4px" } }, nB + " 眼中的 " + nA),
          descBox(c.noteBwd, v => set({ noteBwd: v }), "写清楚这段关系的背景、张力和禁忌。"))
      : descBox(c.note, v => set({ note: v }), "写清楚这段关系的背景、张力和禁忌。")));
}

// ============================================================
// LIFESTYLE + LORE
// ============================================================
// ============================================================
// 行程 Lifestyle —— 仿日记大图 + swipe 换角色 + 周 timeline + 每日时间线（偏差红框/碎碎念回看）
// ============================================================
function schedDayKey(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
function schedLocalDayKey(char, at) { return window.ScheduleClock ? window.ScheduleClock.dayKey(char, at || Date.now(), -new Date().getTimezoneOffset()) : schedDayKey(new Date(at || Date.now())); }
function schedShiftDayKey(key, days) { return window.ScheduleClock ? window.ScheduleClock.shiftDayKey(key, days) : schedDayKey(new Date(schedParseKey(key).getTime() + Number(days || 0) * 86400000)); }
function schedParseKey(k) { const a = String(k).split("-").map(Number); return new Date(a[0], a[1] - 1, a[2]); }
const SCHED_DOW_EN = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const SCHED_DOW_ZH = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
function schedDateParts(k) {
  const d = schedParseKey(k), dow = d.getDay();
  return { date: d, md: (d.getMonth() + 1) + "月" + d.getDate() + "日", dowEn: SCHED_DOW_EN[dow], dowZh: SCHED_DOW_ZH[dow], dateNum: String(d.getDate()).padStart(2, "0") };
}
function schedWeek(today, localTodayKey) {
  const d = new Date(today), dow = (d.getDay() + 6) % 7; // 周一=0
  const mon = new Date(d); mon.setDate(d.getDate() - dow); mon.setHours(0, 0, 0, 0);
  const tk = localTodayKey || schedDayKey(new Date()); // 相对所选角色的当地今天判定过去/今天/未来
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(mon); dd.setDate(mon.getDate() + i);
    const key = schedDayKey(dd);
    return { key, date: dd, dowL: SCHED_DOW_EN[dd.getDay()][0], dateNum: String(dd.getDate()).padStart(2, "0"), isToday: key === tk, isPast: key < tk, isFuture: key > tk };
  });
}
// 结束时刻（v56.30）。seqs 原来只有开始时刻，苹果日历式的块要 start+end 才画得出高度。
// AI 现在会一起生成 end；旧数据和漏填的按「顶到下一段开始、最多 3 小时」补，最后一段给 60 分钟
//（不封顶的话，一个下午只排了一件事就会画成四五个小时的大块——那中间其实是没排事）。
// 跨午夜（23:40 → 次日 00:30）按同一天的 24:00 收口，不往回画成负高度。
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
  return { from: 0, to: wake, title: last.title || "睡着", location: last.location || "", type: "sleep", carry: true };
}
function schedActIcon(type) { return { coffee: GCoffee, work: GBrief, create: GPen, meal: GMeal, rest: GMoon, sleep: GMoon, social: GChat, out: GWalk }[type] || GBrief; }
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
  if (window.ScheduleClock && char) return window.ScheduleClock.currentSeqIdx(seqs, window.ScheduleClock.localMinute(char, Date.now(), -new Date().getTimezoneOffset()));
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

// —— 单日时间线（打开即生成，失败退回）——
function LifeDay({ char, dayKey, plan, busy, onGen, onBack }) {
  const t = useTheme();
  const dp = schedDateParts(dayKey);
  const isToday = dayKey === schedLocalDayKey(char);
  const [openMurmur, setOpenMurmur] = useState(false);
  useEffect(() => {
    if (plan) return;
    let alive = true;
    Promise.resolve(onGen(char, dayKey)).then(ok => { if (alive && ok === false) onBack(); });
    return () => { alive = false; };
    // eslint-disable-next-line
  }, [dayKey]);
  const head = h("div", { className: "shrink-0 flex items-center justify-between px-6 pb-3", style: { paddingTop: safeTop(20) } },
    h("button", { onClick: onBack, className: "flex items-center gap-2 active:opacity-50" },
      h(IArrow, { size: 19, color: t.ink }),
      h("span", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 13, letterSpacing: "0.15em", color: t.ink } }, "BACK")),
    h("div", { className: "text-right" },
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: t.ink } }, dp.dowEn + ", " + dp.dateNum),
      h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog } }, dp.md + " " + dp.dowZh),
      // 兜底刷新：模型偶尔给乱序时间导致灰不掉/进度错乱——一键按「此刻」重推这天
      plan && !busy ? h("button", { onClick: () => onGen(char, dayKey), className: "active:opacity-60", style: { marginTop: 5, fontFamily: F_BODY, fontSize: 10.5, color: t.fog, border: "1px solid " + t.line, borderRadius: 999, padding: "2px 10px" } }, "🔄 重新推演") : null));
  if (busy || !plan) return h("div", { className: "h-full flex flex-col", style: { background: t.bg } }, head, h("div", { className: "flex-1 flex items-center justify-center" }, h(Spinner, { label: "正在推演 " + char.name + " 的这天…" })));
  // 异地：把角色本地日程换算到我这边的时间轴并重排（框架=我的时间）
  const seqs = schedDisplaySeqs(char, plan.seqs || []);
  const tzShifted = seqs.length && seqs[0]._shifted;
  const curIdx = schedCurrentSeqIdx(seqs, isToday, char);
  const murmurs = plan.murmurs || [];
  const seqState = i => !isToday ? "done" : i < curIdx ? "done" : i === curIdx ? "current" : "future";
  return h("div", { className: "h-full flex flex-col", style: { background: t.bg } }, head,
    h("div", { className: "flex-1 overflow-y-auto px-5 pb-10" },
      // 碎碎念回看入口
      murmurs.length > 0 && h("button", { onClick: () => setOpenMurmur(true), className: "w-full flex items-center gap-2 mb-4 mt-1 px-4 py-2.5 active:opacity-70", style: { border: "1px solid " + t.line, borderRadius: 999 } },
        h(GChat, { size: 15, color: t.accent }),
        h("span", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.sub } }, "实时碎碎念 · " + murmurs.length + " 条"),
        h(IChevR, { size: 14, color: t.fog, style: { marginLeft: "auto" } })),
      tzShifted && h("div", { className: "mb-3", style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, lineHeight: 1.5, background: t.bg2, border: "1px solid " + t.line, borderRadius: 10, padding: "7px 11px" } }, "TA 在别的时区，日程按 TA 当地作息推演，时间已换算到你这边（框架＝你的时间）。左侧是你这边时刻，「当地」是 TA 那边时刻。"),
      seqs.length === 0 ? h("div", { className: "text-center", style: { paddingTop: 40, fontFamily: F_BODY, fontSize: 13, color: t.fog } }, "这天没有记录")
        : h("div", { style: { position: "relative", paddingLeft: 22, animation: "fadeUp .3s ease both" } },
            h("div", { style: { position: "absolute", left: 5, top: 8, bottom: 8, width: 0, borderLeft: "1.5px dashed " + t.line } }),
            seqs.map((s, i) => {
              const st = seqState(i), dev = st === "future" ? null : s.deviation;
              const done = st === "done", cur = st === "current";
              const Ico = schedActIcon(s.type);
              return h("div", { key: i, style: { position: "relative", marginBottom: 14, opacity: 1 } },
                h("span", { style: { position: "absolute", left: -22, top: 20, width: 11, height: 11, borderRadius: 999, background: cur || dev ? t.accent : done ? t.fog : t.line, border: "2px solid " + t.bg, boxShadow: cur ? "0 0 0 3px rgba(194,90,74,0.2)" : "none" } }),
                h("div", { style: { position: "relative", background: cur ? "#fff" : t.bg2, borderRadius: 16, padding: "16px 16px 15px", border: "1px solid " + (dev ? t.accent : t.line), boxShadow: cur ? "0 4px 18px rgba(194,90,74,0.13)" : "none" } },
                  // 活动图标（右上角圆）
                  h("div", { style: { position: "absolute", top: -14, right: 14, width: 46, height: 46, borderRadius: 999, background: dev ? t.accent : t.bg, border: "1px solid " + (dev ? t.accent : t.line), display: "flex", alignItems: "center", justifyContent: "center", boxShadow: dev ? "0 3px 12px rgba(194,90,74,0.35)" : "none" } }, h(Ico, { size: 21, color: dev ? "#fff" : done ? t.fog : t.ink })),
                  h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 11, letterSpacing: "0.18em", color: t.fog, marginBottom: 8 } }, "SEQ-" + String(s.seq).padStart(2, "0")),
                  h("div", { style: { fontFamily: F_DISPLAY, fontSize: 21, lineHeight: 1.25, color: done ? t.fog : t.ink, fontWeight: cur ? 700 : 400, textDecoration: dev ? "line-through" : "none", paddingRight: 40 } }, s.title),
                  dev && h("div", { style: { marginTop: 12, fontFamily: F_BODY, fontSize: 14, lineHeight: 1.6, color: t.accent, fontWeight: 500 } }, "［DEVIATION］ " + (dev.reason || "")),
                  (dev && dev.plan) && h("div", { style: { marginTop: 4, fontFamily: F_BODY, fontSize: 11.5, color: t.fog } }, "原计划：" + dev.plan),
                  (dev && dev.actual ? h("div", { className: "flex items-center gap-1.5", style: { marginTop: 10 } }, h(GWalk, { size: 13, color: t.fog }), h("span", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.sub } }, dev.actual))
                    : s.location && h("div", { className: "flex items-center gap-1.5", style: { marginTop: 10 } }, h(GWalk, { size: 13, color: t.fog }), h("span", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.sub } }, s.location))),
                  s.time && h("div", { style: { position: "absolute", top: 16, right: 66, textAlign: "right" } },
                    h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 12, color: t.fog } }, s._myLabel || s.time),
                    s._shifted && h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 9, color: t.fog, opacity: 0.7, marginTop: 1 } }, "当地 " + s._charTime))));
            }))),
    openMurmur && h(Sheet, { onClose: () => setOpenMurmur(false), tall: true },
      h(Eyebrow, { style: { marginBottom: 4 } }, "实时碎碎念 · MURMURS"),
      h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginBottom: 14 } }, char.name + " 这天的即时念头，可回看"),
      murmurs.map((m, i) => h("div", { key: i, className: "flex gap-3 py-3", style: { borderTop: i ? "1px solid " + t.line : "none" } },
        h("span", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 12, color: t.accent, width: 44, flexShrink: 0, paddingTop: 2 } }, m.time || ""),
        h("div", { style: { fontFamily: F_BODY, fontSize: 14, lineHeight: 1.7, color: t.ink } }, m.text)))));
}

function Lifestyle({ characters, schedules, selId, busyKey, onBack, onSel, onGenDay }) {
  const t = useTheme();
  const [view, setView] = useState("browser"); // browser | brief | day | index
  const [dayKey, setDayKey] = useState(null);
  const [weekOff, setWeekOff] = useState(0); // 0=本周, -1=上周…
  const tp = useRef(null);
  const idx = Math.max(0, characters.findIndex(c => c.id === selId));
  const char = characters[idx] || characters[0];
  if (!char) return h("div", { className: "h-full flex flex-col" }, h(Head, { zh: "行程", en: "Lifestyle", onBack }), h(Empty, { text: "还没有角色", sub: "先去人格档案馆录入一位" }));
  const todayKey = schedLocalDayKey(char);
  const plans = schedules[char.id] || {};
  const todayPlan = plans[todayKey] || plans[schedDayKey(new Date())]; // 旧设备日键只作显示兜底，新当地日程生成后自动接管
  const go = dir => { const ni = idx + dir; if (ni >= 0 && ni < characters.length) onSel(characters[ni].id); };
  const openDay = key => { setDayKey(key); setView("day"); };
  const onTS = e => { const p = e.touches[0]; tp.current = { x: p.clientX, y: p.clientY }; };
  const onTE = e => { if (!tp.current) return; const p = e.changedTouches[0]; const dx = p.clientX - tp.current.x, dy = p.clientY - tp.current.y; tp.current = null; if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1); };

  if (view === "day" && dayKey) return h(LifeDay, { char, dayKey, plan: plans[dayKey] || (dayKey === todayKey ? todayPlan : null), busy: busyKey === char.id + "|" + dayKey, onGen: onGenDay, onBack: () => setView("brief") });

  if (view === "index") return h("div", { className: "h-full flex flex-col" },
    h(Head, { zh: "名册", en: "Roster · 选择角色", onBack: () => setView("browser") }),
    h("div", { className: "flex-1 overflow-y-auto px-6 pb-10 pt-1" }, characters.map(c => {
      const p = schedules[c.id] || {}; const tp2 = p[todayKey]; const cur = c.id === char.id;
      return h("div", { key: c.id, onClick: () => { onSel(c.id); setView("browser"); }, className: "flex items-center gap-4 py-4 active:opacity-70", style: { borderBottom: "1px solid " + t.line } },
        h(Avatar, { character: c, size: 52, radius: 15 }),
        h("div", { className: "flex-1 min-w-0" },
          h("div", { className: "flex items-center gap-2" },
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 20, color: t.ink } }, c.name),
            cur && h("span", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 8, letterSpacing: "0.14em", padding: "2px 6px", borderRadius: 999, border: "1px solid " + t.line, color: t.fog } }, "当前")),
          h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, marginTop: 2 } }, tp2 ? (tp2.seqs || []).length + " 项 · " + (tp2.load || "") : "今日待生成")),
        h(IChevR, { size: 16, color: t.fog }));
    })));

  // —— brief：选中角色的日程（周条 + 今日简报 + 上一周历史）——
  if (view === "brief") {
    const base = new Date(schedParseKey(todayKey).getTime() + weekOff * 7 * 86400000);
    const week = schedWeek(base, todayKey);
    const dev0 = todayPlan && (todayPlan.seqs || []).map(s => s.deviation).find(Boolean);
    const weekLabel = weekOff === 0 ? "本周" : weekOff === -1 ? "上一周" : Math.abs(weekOff) + " 周前";
    const bandBg = char.avatarImage
      ? `linear-gradient(180deg, rgba(10,9,8,0.05) 0%, rgba(10,9,8,0.35) 60%, rgba(10,9,8,0.78) 100%), center 25%/cover no-repeat url(${typeof resolveImg==="function"?resolveImg(char.avatarImage):char.avatarImage})`
      : `linear-gradient(180deg, ${char.color || "#3a3730"} 0%, #6b6459 100%)`;
    return h("div", { className: "h-full flex flex-col", style: { background: t.bg } },
      h("div", { className: "shrink-0 relative", style: { height: 190, background: bandBg, color: "#efe9df" } },
        h("div", { className: "flex items-start justify-between px-6 pt-6" },
          h("button", { onClick: () => setView("browser"), className: "flex items-center gap-2 active:opacity-60" },
            h("span", { className: "flex items-center justify-center", style: { width: 36, height: 36, borderRadius: 999, border: "1px solid rgba(239,233,223,0.4)" } }, h(IArrow, { size: 16, color: "#efe9df" })),
            h("span", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 12, letterSpacing: "0.18em" } }, "ROSTER")),
          h("div", { className: "text-right" },
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 17 } }, char.name, h("span", { style: { opacity: 0.6 } }, "  // " + String(idx + 1).padStart(2, "0"))),
            h("div", { className: "flex items-center justify-end gap-1.5", style: { marginTop: 2 } },
              h("span", { style: { width: 6, height: 6, borderRadius: 999, background: "#c25a4a" } }),
              h("span", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 10.5, letterSpacing: "0.16em", opacity: 0.85 } }, "LIVE SYNC"))))),
      h("div", { className: "flex-1 overflow-y-auto", style: { marginTop: -26, position: "relative", zIndex: 2 } },
        // 周条 + 周切换
        h("div", { className: "mx-4 p-4", style: { background: "#fff", borderRadius: 22, border: "1px solid " + t.line, boxShadow: "0 8px 24px rgba(0,0,0,0.10)" } },
          h("div", { className: "flex items-center justify-between mb-3 px-1" },
            h("button", { onClick: () => setWeekOff(weekOff - 1), className: "active:opacity-50 p-1" }, h(IArrow, { size: 16, color: t.fog })),
            h("span", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 11, letterSpacing: "0.16em", color: t.sub } }, weekLabel.toUpperCase ? weekLabel : weekLabel),
            h("button", { onClick: () => weekOff < 0 && setWeekOff(weekOff + 1), disabled: weekOff >= 0, className: "active:opacity-50 disabled:opacity-25 p-1", style: { transform: "scaleX(-1)" } }, h(IArrow, { size: 16, color: t.fog }))),
          h("div", { className: "flex justify-between", style: { position: "relative" } },
            h("div", { style: { position: "absolute", left: 8, right: 8, top: 30, height: 1, background: t.line } }),
            week.map(d => h("button", { key: d.key, disabled: d.isFuture, onClick: () => !d.isFuture && openDay(d.key), className: "flex flex-col items-center gap-2 active:opacity-60 disabled:opacity-100", style: { flex: 1, position: "relative", zIndex: 1 } },
              h("span", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 11, letterSpacing: "0.1em", color: d.isToday ? t.ink : t.fog } }, d.dowL),
              h("span", { style: { width: d.isToday ? 15 : 11, height: d.isToday ? 15 : 11, borderRadius: 999, background: d.isToday ? "#fff" : d.isFuture ? "transparent" : (plans[d.key] ? "#c25a4a" : t.line), border: d.isToday ? "2px solid " + t.ink : d.isFuture ? "1.5px solid " + t.line : "none", display: "flex", alignItems: "center", justifyContent: "center" } }, d.isToday ? h("span", { style: { width: 5, height: 5, borderRadius: 999, background: t.ink } }) : null),
              h("span", { style: { fontFamily: F_DISPLAY, fontStyle: "italic", fontSize: d.isToday ? 20 : 17, color: d.isToday ? t.ink : d.isFuture ? t.line : t.fog } }, d.dateNum))))),
        // 简报（仅本周显示今日简报；历史周提示点某天）
        weekOff < 0
          ? h("div", { className: "px-6 pt-8 pb-10 text-center", style: { fontFamily: F_BODY, fontSize: 13, color: t.fog, lineHeight: 1.8 } }, "「" + weekLabel + "」的历史。\n点某一天，查看 " + char.name + " 那天实际过成了什么样。")
          : h("div", { className: "px-6 pt-8 pb-10" },
            h("div", { style: { position: "relative" } },
              h("div", { style: { position: "absolute", left: -2, top: -14, fontFamily: F_DISPLAY, fontStyle: "italic", fontWeight: 500, fontSize: 92, color: t.line, opacity: 0.5, pointerEvents: "none", letterSpacing: "-0.02em" } }, "LOG."),
              h("div", { style: { position: "relative" } },
                h(Eyebrow, { style: { marginBottom: 6 } }, "TODAY'S BRIEF"),
                h("div", { className: "flex items-center justify-between" },
                  h("div", { style: { fontFamily: F_DISPLAY, fontStyle: "italic", fontWeight: 500, fontSize: 46, color: t.ink, lineHeight: 1 } }, schedDateParts(todayKey).dowEn + ", " + schedDateParts(todayKey).dateNum),
                  todayPlan && h("span", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 12, letterSpacing: "0.1em", color: t.ink, border: "1px solid " + t.ink, borderRadius: 999, padding: "7px 15px" } }, todayPlan.load || "NORMAL")))),
            !todayPlan
              ? h("button", { onClick: () => openDay(todayKey), className: "w-full mt-8 py-4 active:opacity-70", style: { fontFamily: F_BODY, fontSize: 13.5, color: t.sub, border: "1px dashed " + t.line, borderRadius: 14 } }, (busyKey ? "正在生成今日行程…" : "点此查看/生成今日行程") + " →")
              : h("div", null,
                h("div", { className: "flex gap-12 mt-8" },
                  h("div", null,
                    h(Eyebrow, { style: { marginBottom: 8 } }, "EVENTS"),
                    h("div", { style: { fontFamily: F_DISPLAY, fontSize: 30, color: t.ink } }, String((todayPlan.seqs || []).length).padStart(2, "0"), h("span", { style: { fontFamily: F_BODY, fontSize: 14, color: t.fog } }, " 项"))),
                  h("div", null,
                    h(Eyebrow, { style: { marginBottom: 8 } }, "EST. TIME"),
                    h("div", { style: { fontFamily: F_DISPLAY, fontSize: 30, color: t.ink } }, todayPlan.estTime != null ? todayPlan.estTime : "—", h("span", { style: { fontFamily: F_BODY, fontSize: 14, color: t.fog } }, " H")))),
                dev0 && h("div", { className: "mt-8 pl-4", style: { borderLeft: "3px solid " + t.accent } },
                  h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 12, letterSpacing: "0.14em", color: t.accent, marginBottom: 8 } }, "✳ DEVIATION DETECTED"),
                  h("div", { style: { fontFamily: F_BODY, fontSize: 14.5, lineHeight: 1.7, color: t.ink } }, (dev0.plan ? "原计划：" + dev0.plan + "。" : "") + (dev0.reason ? "变更原因：" + dev0.reason : ""))),
                h("button", { onClick: () => openDay(todayKey), className: "w-full mt-9 flex items-center justify-between px-5 py-4 active:opacity-70", style: { background: t.ink, color: t.bg2, borderRadius: 16 } },
                  h("div", { className: "text-left" },
                    h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 12, letterSpacing: "0.16em" } }, "OPEN TIMELINE"),
                    h("div", { style: { fontFamily: F_BODY, fontSize: 11, opacity: 0.7 } }, "查看今日时间线")),
                  h("span", { className: "flex items-center justify-center", style: { width: 36, height: 36, borderRadius: 999, background: t.bg2 } }, h(IChevR, { size: 18, color: t.ink })))))));
  }

  // —— browser（默认）：仿日记大图 · swipe + 箭头 + 圆点换角色，点进去看日程 ——
  const bg = char.avatarImage
    ? `linear-gradient(180deg, rgba(10,9,8,0.1) 0%, rgba(10,9,8,0.45) 55%, #0c0b0a 94%), center 22%/cover no-repeat url(${typeof resolveImg==="function"?resolveImg(char.avatarImage):char.avatarImage})`
    : `linear-gradient(180deg, ${char.color || "#3a3730"} 0%, #0c0b0a 84%)`;
  return h("div", { className: "h-full flex flex-col", style: { background: "#0c0b0a", color: "#efe9df", touchAction: "pan-y" }, onTouchStart: onTS, onTouchEnd: onTE },
    h("div", { className: "flex-1 min-h-0 flex flex-col relative", style: { background: bg } },
      h("div", { className: "shrink-0 flex items-start justify-between px-6", style: { paddingTop: safeTop(24) } },
        h("button", { onClick: onBack, className: "flex items-center gap-2 active:opacity-60" },
          h("span", { className: "flex items-center justify-center", style: { width: 40, height: 40, borderRadius: 999, border: "1px solid rgba(239,233,223,0.4)" } }, h(IArrow, { size: 18, color: "#efe9df" })),
          h("div", null,
            h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 13, letterSpacing: "0.15em" } }, "ROSTER"),
            h("div", { style: { fontFamily: F_BODY, fontSize: 11, opacity: 0.6 } }, "返回桌面"))),
        h("button", { onClick: () => setView("index"), className: "text-right active:opacity-60" },
          h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 13, letterSpacing: "0.15em" } }, "INDEX"),
          h("div", { style: { fontFamily: F_BODY, fontSize: 11, opacity: 0.6 } }, "名册定位"))),
      h("div", { className: "flex-1" }),
      h("div", { className: "shrink-0 px-6 pb-7" },
        h("div", { className: "flex items-baseline gap-3 mb-1" },
          h("span", { style: { fontFamily: F_DISPLAY, fontStyle: "italic", fontSize: 26, opacity: 0.5 } }, "No." + String(idx + 1).padStart(2, "0")),
          h("span", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 11, letterSpacing: "0.2em", opacity: 0.6 } }, "SCHEDULE OBJECT · 行程对象")),
        h("div", { className: "flex items-end gap-3" },
          h("span", { style: { fontFamily: F_DISPLAY, fontWeight: 500, fontSize: 68, lineHeight: 0.95 } }, char.name),
          char.remark && h("span", { style: { fontFamily: "'Noto Serif SC',serif", fontSize: 24, opacity: 0.7, paddingBottom: 8 } }, char.remark)),
        h("div", { style: { height: 1, background: "rgba(239,233,223,0.35)", margin: "20px 0" } }),
        h("div", { className: "flex items-end justify-between" },
          h("div", { className: "flex gap-10" },
            h("div", null,
              h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 10, letterSpacing: "0.2em", opacity: 0.55 } }, "TODAY 今日"),
              h("div", { style: { fontFamily: F_DISPLAY, fontStyle: "italic", fontSize: 30 } }, todayPlan ? (todayPlan.seqs || []).length + " 项" : "—")),
            h("div", null,
              h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 10, letterSpacing: "0.2em", opacity: 0.55 } }, "LOAD 负荷"),
              h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 15, marginTop: 8 } }, todayPlan ? (todayPlan.load || "NORMAL") : "待生成"))),
          h("button", { onClick: () => { setWeekOff(0); setView("brief"); }, className: "flex items-center gap-3 active:opacity-70", style: { background: "rgba(239,233,223,0.12)", border: "1px solid rgba(239,233,223,0.3)", borderRadius: 999, padding: "10px 12px 10px 18px" } },
            h("div", { className: "text-left" },
              h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 12, letterSpacing: "0.16em" } }, "OPEN SCHEDULE"),
              h("div", { style: { fontFamily: F_BODY, fontSize: 11, opacity: 0.7 } }, "查看日程")),
            h("span", { className: "flex items-center justify-center", style: { width: 38, height: 38, borderRadius: 999, background: "#efe9df" } }, h(IChevR, { size: 18, color: "#0c0b0a" })))),
        characters.length > 1 && h("div", { className: "flex items-center justify-center gap-6", style: { marginTop: 18 } },
          h("button", { onClick: () => go(-1), disabled: idx === 0, className: "active:opacity-50", style: { opacity: idx === 0 ? 0.2 : 0.7, padding: 6 } }, h(IArrow, { size: 20, color: "#efe9df" })),
          h("div", { className: "flex gap-1.5" }, characters.map((c, i) => h("span", { key: c.id, style: { width: i === idx ? 16 : 5, height: 5, borderRadius: 999, background: "#efe9df", opacity: i === idx ? 0.9 : 0.35, transition: "width .2s" } }))),
          h("button", { onClick: () => go(1), disabled: idx === characters.length - 1, className: "active:opacity-50", style: { opacity: idx === characters.length - 1 ? 0.2 : 0.7, padding: 6, transform: "scaleX(-1)" } }, h(IArrow, { size: 20, color: "#efe9df" }))))));
}
// 世界书 · 设定索引：卡面直接回答「写了什么 / 谁能看 / 何时触发 / 会去哪儿」。
// 去向键与 engine.js 的 loreScopeOn 一一对应，所有消费者必须从同一筛选器取书。
const LORE_SCOPE_UI = [
  ["chat", "聊天与线下", "单聊、群聊、语音与面对面"],
  ["subjects", "查手机", "手机内容与角色资料生成"],
  ["lifestyle", "生活功能", "行程、备忘、记账与陪伴工具"],
  ["diary", "日记", "角色写日记时"],
  ["study", "共读学习", "一起学与一起读"],
  ["creative", "故事创作", "同人文、梦境、小游戏与塔罗"],
  ["social", "公开世界", "朋友圈、论坛与周刊"],
  ["debate", "擂台"].concat(["辩论与裁决"])
];
// 每个去向一个字的印记（她 2026-09-03：「codex 重新做了一版世界书变得好平淡」）。
// 那一版是一张通用的索引页：编号 + 标题 + 摘要 + 一行「去往：A / B / C」，
// 原样搬到任何一个后台管理界面都成立。
// 这一版拿这个 app 真正独有的那件事当骨架：一条设定要【盖够章】才送得出去——
// 八个去向就是八个格子，去的那几处盖上章。顶上的筛选和每一条身上的，是同一排格子，
// 所以那一排既是筛选器、也是这些印记的对照表。
const LORE_STAMP = { chat: "聊", subjects: "机", lifestyle: "生", diary: "记", study: "读", creative: "创", social: "世", debate: "擂" };
// 筛选那一排底下的名字要一行放得下（「聊天与线下」换行会把整排顶歪），列表里仍用全名
const LORE_STAMP_ZH = { chat: "聊天线下", subjects: "查手机", lifestyle: "生活", diary: "日记", study: "共读", creative: "创作", social: "公开", debate: "擂台" };
const LORE_CATEGORIES = ["世界观", "地点", "组织", "人物", "规则", "共同经历", "用语", "其他"];
const loreScopeEnabled = (e, key) => key === "chat" ? (!e.scope || e.scope.chat !== false) : (key === "creative" && e.ensemble ? true : !!(e.scope && e.scope[key]));
const loreScopeNames = e => LORE_SCOPE_UI.filter(x => loreScopeEnabled(e, x[0])).map(x => x[1]);
function WorldBook({ entries, characters, onBack, onSave, onDelete }) {
  const t = useTheme();
  const [editing, setEditing] = useState(null); // null | {__new, charIds} | entry
  const [query, setQuery] = useState("");
  const [scopeFilter, setScopeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const list = entries || [];
  const enabledN = list.filter(e => e.enabled !== false && String(e.payload || "").trim()).length;
  const constantN = list.filter(e => e.enabled !== false && (e.alwaysOn || !String(e.keyword || "").trim())).length;
  const openNew = charIds => setEditing({ __new: true, charIds: charIds || [] });
  const charNames = ids => (ids || []).map(id => { const c = (characters || []).find(x => x.id === id); return c && (c.remark || c.name); }).filter(Boolean);
  const q = query.trim().toLowerCase();
  const shown = list.filter(e => {
    if (statusFilter === "on" && e.enabled === false) return false;
    if (statusFilter === "off" && e.enabled !== false) return false;
    if (scopeFilter !== "all" && !loreScopeEnabled(e, scopeFilter)) return false;
    if (!q) return true;
    return [e.title, e.payload, e.keyword, e.category, charNames(e.charIds).join(" ")].join(" ").toLowerCase().includes(q);
  }).sort((a, b) => (b.priority || 3) - (a.priority || 3) || (b.ts || 0) - (a.ts || 0));
  // 一排章：去的那几处盖上，没去的留着空格。全没盖＝这条根本发不出去，整排转红
  const stampRow = e => {
    const none = !LORE_SCOPE_UI.some(x => loreScopeEnabled(e, x[0]));
    return h("div", { style: { display: "flex", gap: 3, flexWrap: "wrap" } },
      LORE_SCOPE_UI.map(x => {
        const on = loreScopeEnabled(e, x[0]);
        return h("span", { key: x[0], title: x[1],
          style: { width: 17, height: 17, borderRadius: 3, display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: F_BODY, fontSize: 10, lineHeight: 1,
            color: on ? t.bg : (none ? t.accent : t.fog),
            background: on ? t.ink : "transparent",
            border: "1px solid " + (on ? t.ink : (none ? t.accent + "66" : t.line)),
            opacity: on ? 1 : (none ? 1 : .7) } }, LORE_STAMP[x[0]] || "?");
      }),
      none ? h("span", { style: { fontFamily: F_BODY, fontSize: 10, color: t.accent, alignSelf: "center", marginLeft: 4 } }, "一处也没盖 · 发不出去") : null);
  };
  const card = (e, i) => {
    const off = e.enabled === false;
    const people = (e.charIds || []).map(id => (characters || []).find(x => x.id === id)).filter(Boolean);
    const kw = String(e.keyword || "").trim();
    const always = e.alwaysOn || !kw;
    return h("article", { key: e.id, style: { borderTop: "1px solid " + t.line, opacity: off ? .5 : 1 } },
      h("div", { style: { display: "grid", gridTemplateColumns: "minmax(0,1fr) 42px", gap: 10, alignItems: "start", padding: "15px 0 16px" } },
        h("button", { onClick: () => setEditing(e), className: "text-left active:opacity-65", style: { minWidth: 0, background: "transparent", border: "none" } },
          // 这一条什么时候会翻出来：常驻是一枚夹在书里的签，关键词就把那个词本身写出来
          h("div", { style: { display: "flex", alignItems: "center", gap: 6, marginBottom: 5 } },
            always
              ? h("span", { style: { display: "inline-flex", alignItems: "center", gap: 4, fontFamily: F_BODY, fontSize: 10, color: t.ink } },
                  h("span", { style: { width: 7, height: 12, background: t.ink, clipPath: "polygon(0 0,100% 0,100% 100%,50% 74%,0 100%)", display: "inline-block" } }), "常驻")
              : h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.sub, background: t.bg2, border: "1px solid " + t.line, borderRadius: 3, padding: "1px 6px", maxWidth: 168, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } },
                  (e.regex ? "/" + kw + "/" : "「" + kw + "」") + " 才翻出来"),
            e.category && e.category !== "默认" ? h("span", { style: { fontFamily: F_BODY, fontSize: 10, color: t.fog } }, e.category) : null,
            h("span", { style: { fontFamily: F_BODY, fontSize: 9.5, color: t.fog, marginLeft: "auto" } }, "P" + (e.priority || 3))),
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 19, lineHeight: 1.25, color: t.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, e.title || "未命名设定"),
          h("div", { style: { fontFamily: F_BODY, fontSize: 12, lineHeight: 1.55, color: t.sub, marginTop: 6, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" } }, String(e.payload || "内容为空")),
          // 给谁看：这个 app 里「谁」是有脸的，别写成一串名字
          h("div", { style: { display: "flex", alignItems: "center", gap: 7, marginTop: 10, flexWrap: "wrap" } },
            people.length
              ? h("div", { style: { display: "flex", alignItems: "center" } }, people.slice(0, 4).map((c, ix) => h("div", { key: c.id, style: { marginLeft: ix ? -6 : 0, borderRadius: 999, boxShadow: "0 0 0 1.5px " + t.bg } }, h(Avatar, { character: c, size: 19, radius: 999 }))),
                  people.length > 4 ? h("span", { style: { fontFamily: F_BODY, fontSize: 10, color: t.fog, marginLeft: 4 } }, "+" + (people.length - 4)) : null)
              : h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog } }, "所有角色"),
            h("span", { style: { marginLeft: "auto" } }, stampRow(e)))),
        h("button", { onClick: () => onSave({ ...e, enabled: off }), className: "active:opacity-65", "aria-label": off ? "启用词条" : "停用词条",
          style: { width: 40, height: 24, borderRadius: 999, border: "none", background: off ? t.line : t.ink, position: "relative", marginTop: 2 } },
          h("span", { style: { position: "absolute", width: 18, height: 18, borderRadius: 999, background: t.bg2, top: 3, left: off ? 3 : 19, transition: "left .18s" } }))));
  };
  return h("div", { className: "h-full flex flex-col", style: { background: t.bg } },
    h("div", { className: "shrink-0 px-4 pb-2 flex items-center justify-between", style: { paddingTop: safeTop(10), borderBottom: "1px solid " + t.line, background: t.bg } },
      h("button", { onClick: onBack, className: "active:opacity-50 flex items-center justify-center", style: { width: 44, height: 44 } }, h(IArrow, { size: 19, color: t.ink })),
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16.5, color: t.ink } }, "世界书"),
      h("button", { onClick: () => openNew([]), className: "active:opacity-50 flex items-center justify-center", style: { width: 44, height: 44 } }, h(IPlus, { size: 20, color: t.ink }))),
    h("div", { className: "flex-1 min-h-0 overflow-y-auto px-5", style: { paddingBottom: "calc(env(safe-area-inset-bottom) * 0.4 + 28px)" } },
      // 抬头不再是一句大标语 + 一行英文小字（那个排法换个后台照样成立）：
      // 只留一句说清这本书怎么用，和两个真的数
      h("section", { style: { padding: "14px 0 13px", borderBottom: "1px solid " + t.line } },
        h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.sub, lineHeight: 1.7 } },
          "一条设定要盖够章才送得出去：给谁看、什么时候翻出来、去哪几处，三样都对上才会进上下文。"),
        h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginTop: 7 } }, enabledN + " 条在用 · 其中 " + constantN + " 条常驻")),
      // 筛选就是那排章：顶上这一排既是筛选器，也是每一条身上那些字的对照表
      h("section", { style: { padding: "13px 0 12px", borderBottom: "1px solid " + t.line } },
        h("input", { value: query, onChange: e => setQuery(e.target.value), placeholder: "搜标题、正文、关键词或角色", style: { width: "100%", background: t.bg2, color: t.ink, border: "1px solid " + t.line, borderRadius: 999, padding: "10px 14px", outline: "none", fontFamily: F_BODY, fontSize: 12.5 } }),
        h("div", { style: { display: "flex", gap: 9, overflowX: "auto", paddingTop: 12, WebkitOverflowScrolling: "touch" } },
          [["all", "全部"]].concat(LORE_SCOPE_UI.map(x => [x[0], x[1]])).map(x => {
            const on = scopeFilter === x[0];
            const ch = x[0] === "all" ? "全" : (LORE_STAMP[x[0]] || "?");
            const zh = x[0] === "all" ? "全部" : (LORE_STAMP_ZH[x[0]] || x[1]);
            return h("button", { key: x[0], onClick: () => setScopeFilter(x[0]), className: "active:opacity-65 shrink-0",
              style: { border: "none", background: "transparent", padding: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, minWidth: 46 } },
              h("span", { style: { width: 26, height: 26, borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: F_BODY, fontSize: 13, color: on ? t.bg : t.sub,
                background: on ? t.ink : "transparent", border: "1px solid " + (on ? t.ink : t.line) } }, ch),
              h("span", { style: { fontFamily: F_BODY, fontSize: 9.5, lineHeight: 1.2, textAlign: "center", whiteSpace: "nowrap", color: on ? t.ink : t.fog } }, zh));
          })),
        h("div", { style: { display: "flex", gap: 14, marginTop: 12 } }, [["all", "全部状态"], ["on", "只看启用"], ["off", "只看停用"]].map(x => h("button", { key: x[0], onClick: () => setStatusFilter(x[0]), className: "active:opacity-60", style: { border: "none", background: "transparent", fontFamily: F_BODY, fontSize: 10.5, color: statusFilter === x[0] ? t.ink : t.fog, borderBottom: statusFilter === x[0] ? "1px solid " + t.ink : "1px solid transparent", padding: "2px 0 4px" } }, x[1])))),
      h("div", { style: { paddingBottom: 12 } },
        shown.length ? shown.map(card) : h("div", { style: { padding: "46px 0", textAlign: "center" } },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 18, color: t.ink } }, list.length ? "没有符合筛选的词条" : "这里还没有设定"),
          h("button", { onClick: () => openNew([]), className: "active:opacity-60", style: { marginTop: 12, background: "transparent", border: "none", borderBottom: "1px solid " + t.ink, padding: "4px 0", fontFamily: F_BODY, fontSize: 12, color: t.ink } }, "写第一条")))),
    editing && h(WorldBookEntrySheet, {
      entry: editing.__new ? { charIds: editing.charIds } : editing, characters: characters, onClose: () => setEditing(null),
      onSave: data => { onSave(data); setEditing(null); },
      onDelete: editing.__new ? null : () => { onDelete(editing.id); setEditing(null); }
    }));
}
function WorldBookEntrySheet({ entry, characters, onClose, onSave, onDelete }) {
  const t = useTheme();
  const isNew = !(entry && entry.id);
  const [f, setF] = useState(() => {
    const base = Object.assign({ title: "", keyword: "", category: "世界观", charIds: [], payload: "", regex: false, enabled: true, alwaysOn: true, ensemble: false, priority: 3, scope: { chat: true, subjects: false, lifestyle: false, diary: false, study: false, creative: false, social: false, debate: false } }, entry || {});
    // 旧版没关键词的词条实际一直会注入；编辑时也如实显示成常驻，避免出现“触发模式但没有触发词”的假状态。
    if (!String(base.keyword || "").trim()) base.alwaysOn = true;
    return base;
  });
  const [error, setError] = useState("");
  const set = p => setF(x => Object.assign({}, x, p));
  const toggleChar = id => setF(x => { const has = (x.charIds || []).includes(id); return Object.assign({}, x, { charIds: has ? x.charIds.filter(i => i !== id) : [...(x.charIds || []), id] }); });
  const setScope = k => setF(x => Object.assign({}, x, { scope: Object.assign({ chat: true }, x.scope, { [k]: !(x.scope && x.scope[k]) }) }));
  const save = () => {
    const payload = String(f.payload || "").trim();
    const keyword = String(f.keyword || "").trim();
    const hasScope = LORE_SCOPE_UI.some(x => loreScopeEnabled(f, x[0]));
    if (!payload) { setError("先写下要交给模型的设定内容"); return; }
    if (!f.alwaysOn && !keyword) { setError("触发模式需要至少一个关键词"); return; }
    if (!hasScope) { setError("至少选择一个去向，否则这条永远不会被使用"); return; }
    if (f.regex) { try { new RegExp(keyword, "i"); } catch (_) { setError("正则表达式写错了，模型永远触发不到它"); return; } }
    onSave(Object.assign({}, f, { title: String(f.title || "").trim() || "未命名设定", payload, keyword, alwaysOn: !!f.alwaysOn, ensemble: false, id: entry && entry.id ? entry.id : "le_" + Date.now() + "_" + Math.floor(Math.random() * 1000), ts: Date.now() }));
  };
  const field = { fontFamily: F_BODY, fontSize: 13.5, color: t.ink, background: t.bg2, border: "1px solid " + t.line, borderRadius: 0, padding: "11px 12px", width: "100%", outline: "none" };
  const lbl = (s, sub) => h("div", { style: { margin: "18px 0 8px" } }, h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: t.ink } }, s), sub ? h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 3, lineHeight: 1.45 } }, sub) : null);
  const toggle = (label, sub, val, onT) => h("div", { className: "flex items-center justify-between", style: { padding: "10px 0" } },
    h("div", { style: { flex: 1, paddingRight: 10 } }, h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, color: t.ink } }, label), sub ? h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 2, lineHeight: 1.4 } }, sub) : null),
    h("button", { onClick: onT, className: "active:opacity-70 shrink-0", style: { width: 46, height: 27, borderRadius: 999, background: val ? t.ink : t.line, position: "relative" } }, h("span", { style: { position: "absolute", top: 3, left: val ? 22 : 3, width: 21, height: 21, borderRadius: 999, background: "#fff" } })));
  return h(Sheet, { onClose: onClose, tall: true },
    h("div", { className: "flex items-center justify-between", style: { marginBottom: 4, paddingBottom: 13, borderBottom: "1px solid " + t.line } },
      h("div", null,
        h("div", { style: { fontFamily: F_BODY, fontSize: 9.5, letterSpacing: "0.17em", color: t.fog } }, isNew ? "NEW LORE" : "EDIT LORE"),
        h("span", { style: { fontFamily: F_DISPLAY, fontSize: 22, color: t.ink } }, isNew ? "新建设定" : "编辑设定")),
      onDelete ? h("button", { onClick: onDelete, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 12.5, color: t.accent } }, "删除") : null),
    lbl("这条是什么", "标题是给你看的索引；分类帮助以后检索，不改变模型权重"),
    h("input", { value: f.title, onChange: e => { set({ title: e.target.value }); setError(""); }, placeholder: "例如：港口城的宵禁", style: field }),
    h("div", { style: { display: "flex", gap: 6, overflowX: "auto", marginTop: 9 } }, LORE_CATEGORIES.map(x => h("button", { key: x, onClick: () => set({ category: x }), className: "active:opacity-65 shrink-0", style: { border: "1px solid " + ((f.category || "世界观") === x ? t.ink : t.line), background: (f.category || "世界观") === x ? t.ink : "transparent", color: (f.category || "世界观") === x ? t.bg : t.sub, padding: "6px 9px", fontFamily: F_BODY, fontSize: 10.5 } }, x))),
    lbl("交给模型的正文", "只写事实、背景或规则；模型看到的是这里，不是标题"),
    h("textarea", { value: f.payload, onChange: e => { set({ payload: e.target.value }); setError(""); }, rows: 6, placeholder: "例如：港口城每晚十一点宵禁，钟声后只有持银色通行证的人可以上街。", style: Object.assign({}, field, { resize: "vertical", minHeight: 132, lineHeight: 1.65 }) }),
    lbl("谁能拿到", "不选角色就是公共设定；绑定后只有该角色本人或有 Ta 在场的群聊能拿到"),
    h("button", { onClick: () => set({ charIds: [] }), className: "active:opacity-65", style: { width: "100%", textAlign: "left", border: "1px solid " + (!(f.charIds || []).length ? t.ink : t.line), background: !(f.charIds || []).length ? t.ink : "transparent", color: !(f.charIds || []).length ? t.bg : t.sub, padding: "10px 11px", fontFamily: F_BODY, fontSize: 12 } }, "所有角色 · 公共设定"),
    h("div", { style: { display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 7, marginTop: 7 } }, (characters || []).map(c => { const on = (f.charIds || []).includes(c.id); return h("button", { key: c.id, onClick: () => toggleChar(c.id), className: "active:opacity-70", style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "left", fontFamily: F_BODY, fontSize: 11.5, color: on ? t.bg : t.sub, background: on ? t.ink : "transparent", border: "1px solid " + (on ? t.ink : t.line), padding: "9px 10px" } }, c.remark || c.name); })),
    lbl("什么时候出现", "常驻适合核心世界规则；触发适合只在谈到某件事时才需要的背景"),
    h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 } },
      [[true, "每次常驻", "不等关键词"], [false, "按话题触发", "命中才注入"]].map(x => h("button", { key: String(x[0]), onClick: () => { set({ alwaysOn: x[0] }); setError(""); }, className: "active:opacity-70 text-left", style: { border: "1px solid " + (!!f.alwaysOn === x[0] ? t.ink : t.line), background: !!f.alwaysOn === x[0] ? t.ink : "transparent", color: !!f.alwaysOn === x[0] ? t.bg : t.ink, padding: "11px" } }, h("div", { style: { fontFamily: F_BODY, fontSize: 12.5 } }, x[1]), h("div", { style: { fontFamily: F_BODY, fontSize: 10, opacity: .65, marginTop: 3 } }, x[2])))),
    !f.alwaysOn ? h("div", { style: { marginTop: 9 } },
      h("input", { value: f.keyword, onChange: e => { set({ keyword: e.target.value }); setError(""); }, placeholder: "关键词用逗号分隔，例如：宵禁，通行证，夜巡", style: field }),
      toggle("把关键词当正则", "仅在你确实需要表达式匹配时打开", !!f.regex, () => set({ regex: !f.regex }))) : null,
    lbl("会去哪些地方", "只有勾中的功能可以取到这条；角色绑定和触发条件仍然继续生效"),
    h("div", { style: { display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 7 } }, LORE_SCOPE_UI.map(([k, label, desc]) => { const on = loreScopeEnabled(f, k); return h("button", { key: k, onClick: () => { setScope(k); setError(""); }, className: "active:opacity-70 text-left", style: { minHeight: 62, border: "1px solid " + (on ? t.ink : t.line), background: on ? t.ink : "transparent", color: on ? t.bg : t.ink, padding: "9px 10px" } },
      h("div", { style: { fontFamily: F_BODY, fontSize: 12 } }, label), h("div", { style: { fontFamily: F_BODY, fontSize: 9.5, lineHeight: 1.35, opacity: .62, marginTop: 3 } }, desc)); })),
    lbl("注入顺序", "数字越大越靠前；冲突时仍以更明确、更近期的系统规则为准"),
    h("div", { style: { display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 6 } }, [1, 2, 3, 4, 5].map(n => h("button", { key: n, onClick: () => set({ priority: n }), className: "active:opacity-70", style: { height: 38, fontFamily: F_DISPLAY, fontSize: 13, color: (f.priority || 3) === n ? t.bg : t.sub, background: (f.priority || 3) === n ? t.ink : "transparent", border: "1px solid " + ((f.priority || 3) === n ? t.ink : t.line) } }, n))),
    h("div", { style: { marginTop: 17, borderTop: "1px solid " + t.line } }, toggle("启用这条", "关闭后保留内容，但任何地方都不会注入", f.enabled !== false, () => set({ enabled: f.enabled === false }))),
    h("div", { style: { background: t.bg, border: "1px solid " + t.line, padding: "12px", marginTop: 4 } },
      h("div", { style: { fontFamily: F_BODY, fontSize: 10, letterSpacing: "0.15em", color: t.fog } }, "INJECTION SUMMARY"),
      h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.sub, lineHeight: 1.6, marginTop: 6 } },
        (f.charIds || []).length ? "只给：" + (f.charIds || []).map(id => { const c = (characters || []).find(x => x.id === id); return c && (c.remark || c.name); }).filter(Boolean).join("、") : "给所有角色",
        " · ", f.alwaysOn ? "每次常驻" : "话题触发",
        " · 去往 ", loreScopeNames(f).join(" / ") || "无")),
    error ? h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.accent, lineHeight: 1.5, marginTop: 12 } }, error) : null,
    h("button", { onClick: save, className: "w-full active:opacity-80", style: { marginTop: 14, fontFamily: F_BODY, fontSize: 14, color: t.bg2, background: t.ink, border: "none", padding: "14px" } }, "保存并交给筛选器"));
}
// ============================================================
// FORUM —— 仿贴吧/推特：底部四 tab（主页/搜索/私信/我）
//  主页 = 吐槽/日常/求助/匿名 + 关注 切换；顶部刷新键在当前版块生成 NPC 帖
//  搜索 = 随机刷到四版块之外的吧（据全局聊天）；私信 = NPC 私信；我 = 我的主页
//  帖子只有一份，版块是筛选视图；评论懒加载（含楼中楼，回复者随机 NPC/角色）
// ============================================================
const FORUM_BOARDS = ["吐槽吧", "日常吧", "求助吧", "兴趣吧", "脑洞吧", "匿名吧"];
// 论坛是一叠正在被翻动的社区小报，不再借用全 App 的通用白底列表。
// 六个版块只换一处识别色；纸张、墨色和层级共用，免得像六个互不相干的 App。
const FORUM_SKIN = {
  bg: "linear-gradient(155deg,#edf1e8 0%,#e3e9de 52%,#eef0e7 100%)",
  paper: "rgba(251,252,247,.94)", ink: "#273126", sub: "#52604d", fog: "#7a8575",
  line: "rgba(54,70,49,.14)", accent: "#667c5b", soft: "rgba(102,124,91,.11)"
};
const FORUM_BOARD_SKIN = {
  "吐槽吧": ["#a65f52", "rgba(166,95,82,.11)"], "日常吧": ["#667c5b", "rgba(102,124,91,.11)"],
  "求助吧": ["#55778c", "rgba(85,119,140,.11)"], "兴趣吧": ["#9a7745", "rgba(154,119,69,.11)"],
  "脑洞吧": ["#765f93", "rgba(118,95,147,.11)"], "匿名吧": ["#555957", "rgba(85,89,87,.11)"]
};
function forumBoardSkin(board) { return FORUM_BOARD_SKIN[board] || [FORUM_SKIN.accent, FORUM_SKIN.soft]; }
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
function fmtNum(n) { n = Number(n) || 0; if (n >= 10000) return (n / 10000).toFixed(n >= 100000 ? 0 : 1).replace(/\.0$/, "") + "万"; return String(n); }
function forumAge(ts) { if (!ts) return "新人"; const d = Math.floor((Date.now() - ts) / 86400000); if (d < 30) return "吧龄 " + Math.max(d, 1) + " 天"; const mo = Math.floor(d / 30); if (mo < 12) return "吧龄 " + mo + " 个月"; return "吧龄 " + (d / 365).toFixed(1) + " 年"; }
// 论坛路人/常驻/小号的头像。原来画的是 FORUM_AV_EMOJI 里的 🐧🐸🐱 —— 她 2026-08-25
// 说的「只有 emoji 代替」就是这儿。种子哈希那套是对的（同一个人永远同一张），
// 只把画出来的东西换掉：有头像池就用她自己的图，没有就程序化画一张。
function NpcAvatar({ seed, size }) {
  return React.createElement("img", {
    src: typeof autoAvatarSrc === "function" ? autoAvatarSrc(seed) : "",
    alt: "", className: "object-cover shrink-0",
    style: { width: size, height: size, borderRadius: "50%" }
  });
}
// 小号要和大号明显不是同一张脸（不然就自曝身份了）——加盐换一套种子。
function AltAvatar({ seed, size }) {
  return React.createElement("img", {
    src: typeof autoAvatarSrc === "function" ? autoAvatarSrc("alt:" + seed) : "",
    alt: "", className: "object-cover shrink-0",
    style: { width: size, height: size, borderRadius: "50%" }
  });
}
function Forum({
  characters, profile, posts, comments, follows, pms, groups, gen, forumMe, charMetaOf, forumOff,
  onBack, onGenBoard, onGenSearch, onLoadComments, onMoreComments, onReplyFloor, onReplySub,
  onStartPM, onStartCharPM, onDelPM, onClearPMs,
  onPostMine, onGenCharPost, onToggleFollow, onForwardToChat, onForwardToGroup,
  onRefreshPMs, onSendPM, onMarkPMRead, onEditMe, onEnsureCharMeta, onToggleForumChar
}) {
  const t = useTheme();
  const [nav, setNav] = useState("home");           // home | search | pm | me
  const [tab, setTab] = useState("吐槽吧");           // 主页版块 或 "关注"
  const [feedSort, setFeedSort] = useState("active"); // active | latest | hot
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(null);            // 打开的帖子
  const [profileId, setProfileId] = useState(null);  // 角色主页 charId（"me" 走 nav）
  const [npcProfile, setNpcProfile] = useState(null); // 普通网友公开足迹（不含匿名）
  const [altProfile, setAltProfile] = useState(null); // 角色小号公开足迹；页面不暴露背后真身
  const [pmId, setPmId] = useState(null);            // 打开的私信会话
  const [pmText, setPmText] = useState("");
  const [fwd, setFwd] = useState(null);              // 转发中的帖子
  const [composer, setComposer] = useState(false);   // 我发帖
  const [cbBoard, setCbBoard] = useState("日常吧");
  const [cbTitle, setCbTitle] = useState("");
  const [cbBody, setCbBody] = useState("");
  const [rTxt, setRtxt] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [pmClean, setPmClean] = useState(false);   // 私信列表的「清理」档      // {floorId,name} 楼中楼目标
  const [liked, setLiked] = useState(() => {
    try { const x = JSON.parse(localStorage.getItem("x_forumLikes") || "[]"); return new Set(Array.isArray(x) ? x : []); } catch (e) { return new Set(); }
  });
  const [bookmarked, setBookmarked] = useState(() => {
    try { const x = JSON.parse(localStorage.getItem("x_forumBookmarks") || "[]"); return new Set(Array.isArray(x) ? x : []); } catch (e) { return new Set(); }
  });
  const [editMe, setEditMe] = useState(false);
  const [emHandle, setEmHandle] = useState("");
  const [emBio, setEmBio] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [followListOpen, setFollowListOpen] = useState(false);
  const feedScrollRef = useRef(null);
  const feedScrollTopRef = useRef(0);
  const [forumNow, setForumNow] = useState(() => Date.now());
  const [forumLastSeen] = useState(() => {
    try { return Number(localStorage.getItem("x_forumLastSeen")) || Date.now(); } catch (e) { return Date.now(); }
  });
  const [forumReadCursors, setForumReadCursors] = useState(() => {
    try {
      const saved = localStorage.getItem("x_forumReadCursors");
      if (saved) return JSON.parse(saved);
      // 从旧版本升级时，把升级前已经露出的旧楼层当作读过，避免第一次打开突然冒出几百条红点。
      // 尚未到 visibleAt 的排队楼层不写入水位，之后到点仍会正常成为新回复。
      const seeded = {};
      Object.entries(comments || {}).forEach(([postId, floors]) => {
        const newest = (floors || []).filter(x => !x.visibleAt || Number(x.visibleAt) <= Date.now()).reduce((n, x) => Math.max(n, Number(x.visibleAt || x.ts || 0)), 0);
        if (newest) seeded[postId] = newest;
      });
      localStorage.setItem("x_forumReadCursors", JSON.stringify(seeded));
      return seeded;
    } catch (e) { return {}; }
  });
  const [forumNoticeEpoch] = useState(() => {
    try {
      const old = Number(localStorage.getItem("x_forumNoticeEpoch"));
      if (old) return old;
      const now = Date.now(); localStorage.setItem("x_forumNoticeEpoch", String(now)); return now;
    } catch (e) { return Date.now(); }
  });
  const [forumNoticeRead, setForumNoticeRead] = useState(() => {
    try { return JSON.parse(localStorage.getItem("x_forumNoticeRead") || "{}"); } catch (e) { return {}; }
  });
  const [npcFollows, setNpcFollows] = useState(() => {
    try { const x = JSON.parse(localStorage.getItem("x_forumNpcFollows") || "[]"); return Array.isArray(x) ? x : []; } catch (e) { return []; }
  });
  const PAGE = 20;
  const charOf = id => (characters || []).find(c => c.id === id);
  const cmts = comments || {};
  const flw = follows || [];
  const unreadPM = (pms || []).filter(x => x.unread).length;
  const activeChars = (characters || []).filter(c => !(forumOff || []).includes(c.id)); // 在逛论坛的角色
  const followedChars = (characters || []).filter(c => flw.includes(c.id));
  const npcFollowSet = new Set(npcFollows);
  const forumVisible = x => !x || !x.visibleAt || Number(x.visibleAt) <= forumNow;
  const floorArrivedAt = forumFloorArrivedAt;
  const postLastActivity = p => (cmts[p.id] || []).filter(forumVisible).reduce((latest, f) => {
    const replyLatest = (f.replies || []).reduce((n, r) => Math.max(n, Number(r.ts || 0)), 0);
    return Math.max(latest, floorArrivedAt(f), replyLatest);
  }, Number(p.ts || 0));
  const postHotScore = p => {
    const ageHours = Math.max(0, forumNow - postLastActivity(p)) / 3600000;
    const interaction = (Number(p.replyCount) || 0) * 3 + (Number(p.likeCount) || 0) + (Number(p.rtCount) || 0) * 4 + Math.sqrt(Number(p.viewCount) || 0);
    return interaction / Math.pow(ageHours + 2, 1.18);
  };
  const unreadFloors = postId => (cmts[postId] || []).filter(x => forumVisible(x) && x.authorType !== "me" && floorArrivedAt(x) > Number(forumReadCursors[postId] || 0)).length;
  const forumUnreadRows = (posts || []).filter(forumVisible).map(post => ({ post, count: unreadFloors(post.id) }))
    .filter(x => x.count > 0).sort((a, b) => postLastActivity(b.post) - postLastActivity(a.post));
  const forumUnreadTotal = forumUnreadRows.reduce((n, x) => n + x.count, 0);
  const forumNotices = [];
  (posts || []).forEach(p => (cmts[p.id] || []).forEach((f, floorIndex) => {
    if (!forumVisible(f)) return;
    const floorTs = floorArrivedAt(f);
    if (p.authorType === "me" && f.authorType !== "me" && floorTs > forumNoticeEpoch) {
      const id = "floor:" + p.id + ":" + (f.id || floorIndex);
      forumNotices.push({ id, post: p, floorId: f.id, author: f, authorName: f.authorName || "网友", content: f.content || "", ts: floorTs, kind: "回复了你的帖子" });
    }
    (f.replies || []).forEach((r, replyIndex) => {
      const ts = Math.max(floorTs, Number(r.ts || 0));
      if (r.authorType === "me" || ts <= forumNoticeEpoch || !(r.replyToMe || f.authorType === "me")) return;
      const id = "reply:" + p.id + ":" + (f.id || floorIndex) + ":" + (r.id || r.ts || replyIndex);
      forumNotices.push({ id, post: p, floorId: f.id, author: r, authorName: r.authorName || "网友", content: r.content || "", ts, kind: "回复了你" });
    });
  }));
  forumNotices.sort((a, b) => b.ts - a.ts);
  const unreadNoticeCount = forumNotices.filter(n => !forumNoticeRead[n.id]).length;
  const markNoticesRead = ids => {
    const fresh = (ids || []).filter(id => id && !forumNoticeRead[id]);
    if (!fresh.length) return;
    setForumNoticeRead(prev => {
      const next = { ...prev }; fresh.forEach(id => { next[id] = Date.now(); });
      // 最多留最近 800 个已读键，防止本地小账本无限长。
      const trimmed = Object.fromEntries(Object.entries(next).sort((a, b) => Number(b[1]) - Number(a[1])).slice(0, 800));
      try { localStorage.setItem("x_forumNoticeRead", JSON.stringify(trimmed)); } catch (e) {}
      return trimmed;
    });
  };
  const markPostRead = postId => {
    if (!postId) return;
    const newest = (cmts[postId] || []).filter(forumVisible).reduce((n, x) => Math.max(n, floorArrivedAt(x)), 0);
    if (!newest || newest <= Number(forumReadCursors[postId] || 0)) return;
    setForumReadCursors(prev => {
      if (newest <= Number(prev[postId] || 0)) return prev;
      const next = { ...prev, [postId]: newest };
      try { localStorage.setItem("x_forumReadCursors", JSON.stringify(next)); } catch (e) {}
      return next;
    });
  };
  // ⚠️「哪几条是这次新来的」得在【进门那一刻】冻住（她 2026-09-01：「陆续新回复也是
  //   点进去看不出来哪些是新增的」）。底下那个 effect 一进帖子就把读到的位置推到最新，
  //   所以不冻的话，新回复在你眼皮底下当场变成旧的——列表上明明写着「+3 新回复」，
  //   点进去一条标记都没有。
  const openCursorRef = useRef(0);
  const openPost = p => {
    if (feedScrollRef.current) feedScrollTopRef.current = feedScrollRef.current.scrollTop;
    openCursorRef.current = Number(forumReadCursors[p.id] || 0);
    setOpen(p); onLoadComments(p); markNoticesRead(forumNotices.filter(n => n.post.id === p.id).map(n => n.id));
  };
  // 这一条是不是「这次新来的」：别人发的、而且比进门时读到的位置还新。
  // 正在看着的时候又到了一波，也算新——它确实是刚冒出来的。
  const isFreshFloor = f => !!f && f.authorType !== "me" && floorArrivedAt(f) > openCursorRef.current;
  const isFreshReply = r => !!r && r.authorType !== "me" && Number(r.ts || 0) > openCursorRef.current;
  const newTag = () => h("span", { style: { fontFamily: F_BODY, fontSize: 9.5, color: "#fff", background: FORUM_SKIN.accent, borderRadius: 999, padding: "1px 6px", marginLeft: 6, flexShrink: 0 } }, "新");
  const closePost = () => {
    setOpen(null); setReplyTo(null);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (feedScrollRef.current) feedScrollRef.current.scrollTop = feedScrollTopRef.current;
    }));
  };
  const openNotice = n => {
    markNoticesRead([n.id]); openPost(n.post);
    setTimeout(() => { const el = document.getElementById("forum-floor-" + n.floorId); if (el) el.scrollIntoView({ behavior: "smooth", block: "center" }); }, 180);
  };
  // 从「回复我的」直接回过去（她 2026-09-01 点名要这个）。
  // 原来点通知只能【跳到那一层】，回话还得自己在楼里找到那条再点一次「回复」——
  // 通知的用处本来就是「有人叫你」，那它就该一步接上话。
  // ⚠️两种通知要瞄准不同的人：
  //   「回复了你的帖子」是别人在我帖子下新开了一层 → 回这一层（toName 空）；
  //   「回复了你」是楼里某人回我 → 回那个人（toName＝他）。
  const replyInputRef = useRef(null);
  const replyFromNotice = n => {
    markNoticesRead([n.id]); openPost(n.post);
    setReplyTo({ floorId: n.floorId, name: n.authorName, toName: n.kind === "回复了你" ? n.authorName : "" });
    setTimeout(() => {
      const el = document.getElementById("forum-floor-" + n.floorId);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      if (replyInputRef.current) replyInputRef.current.focus();
    }, 200);
  };
  const meChar = { name: (forumMe && forumMe.handle) || profile.name || "我", avatarImage: profile.avatarImage, color: profile.color || "#7a6cf0" };
  useEffect(() => { if (profileId && profileId !== "me" && onEnsureCharMeta) { const c = charOf(profileId); if (c) onEnsureCharMeta(c); } }, [profileId]);
  useEffect(() => { if (altProfile && altProfile.authorId && onEnsureCharMeta) { const c = charOf(altProfile.authorId); if (c) onEnsureCharMeta(c); } }, [altProfile && altProfile.authorId]);
  useEffect(() => {
    const markSeen = () => { try { localStorage.setItem("x_forumLastSeen", String(Date.now())); } catch (e) {} };
    markSeen();
    const timer = setInterval(() => setForumNow(Date.now()), 30000);
    return () => { clearInterval(timer); markSeen(); };
  }, []);
  // 只有真的打开某个帖子，才把该帖此刻已经露出的楼层标为已读。
  // 排队楼层在别的页面到点出现时不会被全站「已读」误吞；若人正看着帖子，则自然算看见了。
  useEffect(() => {
    if (!open || !open.id) return;
    markPostRead(open.id);
    markNoticesRead(forumNotices.filter(n => n.post.id === open.id).map(n => n.id));
  }, [open && open.id, forumNow, comments]);
  const tag = txt => { const bs = forumBoardSkin(txt); return h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, letterSpacing: ".02em", padding: "2px 8px", borderRadius: 999, border: "1px solid " + bs[0] + "33", background: bs[1], color: bs[0] } }, txt); };
  // 版块不是一排通用药丸：照公告栏上剪角、钉住的分类纸签来画。
  const chip = (b, sel, on) => { const toneKey = FORUM_BOARDS.find(x => String(b).indexOf(x) === 0) || b, bs = forumBoardSkin(toneKey); return h("button", { key: b, onClick: on, className: "active:opacity-70 whitespace-nowrap flex items-center", style: { minHeight: 40, padding: "6px 17px 6px 10px", clipPath: "polygon(0 0,calc(100% - 8px) 0,100% 50%,calc(100% - 8px) 100%,0 100%)", borderRadius: 4, background: sel ? bs[0] : "rgba(255,255,255,.58)", color: sel ? FORUM_SKIN.paper : FORUM_SKIN.sub, fontFamily: F_BODY, fontSize: 12.5, boxShadow: sel ? "0 4px 12px " + bs[0] + "2e" : "inset 0 0 0 1px " + FORUM_SKIN.line } }, h("span", { style: { width: 5, height: 5, borderRadius: 99, marginRight: 7, background: sel ? FORUM_SKIN.paper : bs[0], boxShadow: sel ? "0 0 0 2px " + bs[0] : "none" } }), b); };
  const toggleLike = id => setLiked(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); try { localStorage.setItem("x_forumLikes", JSON.stringify([...n])); } catch (e) {} return n; });
  const toggleBookmark = id => setBookmarked(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); try { localStorage.setItem("x_forumBookmarks", JSON.stringify([...n])); } catch (e) {} return n; });
  const isAlt = a => !!(a && a.authorType === "character_alt" && !a.anon);
  const altFollowKey = a => "alt:" + String(a && a.authorId || "");
  const avatarFor = (a, size, anon) => anon ? h(NpcAvatar, { seed: a.authorName, size: size }) : (isAlt(a) ? h(AltAvatar, { seed: a.authorHandle || a.authorName, size: size }) : (a.authorType === "character" ? h(Avatar, { character: charOf(a.authorId) || { name: a.authorName, color: "#8a8a8a" }, size: size, radius: size / 2 }) : (a.authorType === "me" ? h(Avatar, { character: meChar, size: size, radius: size / 2 }) : h(NpcAvatar, { seed: a.authorHandle || a.authorName, size: size }))));
  const nameOf = a => a.anon ? a.authorName : (a.authorType === "character" && charOf(a.authorId) ? charOf(a.authorId).name : (a.authorType === "me" ? meChar.name : a.authorName));
  const goProfile = id => { setProfileId(id); setOpen(null); };
  const goAltProfile = a => { if (!isAlt(a) || !a.authorId) return; setAltProfile({ authorId: a.authorId, name: a.authorName || "小号", handle: a.authorHandle || a.authorName || "side" }); setOpen(null); };
  const goNpcProfile = a => { if (!a || a.anon || a.authorType !== "npc" || !a.authorId) return; setNpcProfile({ id: a.authorId, name: a.authorName || "网友", handle: a.authorHandle || a.authorName || "guest" }); setOpen(null); };
  const toggleNpcFollow = id => setNpcFollows(prev => {
    const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
    try { localStorage.setItem("x_forumNpcFollows", JSON.stringify(next)); } catch (e) {}
    return next;
  });
  const knownNpcProfiles = () => {
    const map = new Map(), add = a => { if (a && !a.anon && a.authorType === "npc" && a.authorId && !map.has(a.authorId)) map.set(a.authorId, { id: a.authorId, name: a.authorName || "网友", handle: a.authorHandle || a.authorName || "guest" }); };
    // 固定网友目录本身是公开论坛资料；即使 TA 暂时还没在本机帖子里露面，关系页也能认出名字。
    try {
      const saved = JSON.parse(localStorage.getItem("x_forumNpcs") || "{}");
      (saved && Array.isArray(saved.items) ? saved.items : []).filter(n => !(n.boards || []).includes("匿名吧")).forEach(n => add({ authorType: "npc", authorId: n.id, authorName: n.name, authorHandle: n.handle }));
    } catch (e) {}
    (posts || []).forEach(p => { add(p); (cmts[p.id] || []).forEach(f => { add(f); (f.replies || []).forEach(add); }); });
    return map;
  };
  const knownAltProfiles = () => {
    const map = new Map(), add = a => { if (isAlt(a) && a.authorId) { const key=altFollowKey(a); if(!map.has(key))map.set(key,{ key, authorId:a.authorId, name:a.authorName||"小号", handle:a.authorHandle||a.authorName||"side" }); } };
    (posts || []).forEach(p => { add(p); (cmts[p.id] || []).forEach(f => { add(f); (f.replies || []).forEach(add); }); });
    return map;
  };
  const followedPost = p => !p.anon && ((p.authorType === "character" && flw.includes(p.authorId)) || (isAlt(p) && npcFollowSet.has(altFollowKey(p))) || (p.authorType === "npc" && npcFollowSet.has(p.authorId)));
  const publicNpcRelations = id => {
    try {
      const saved = JSON.parse(localStorage.getItem("x_forumNpcRelations") || "{}");
      const directory = knownNpcProfiles();
      return (saved && Array.isArray(saved.items) ? saved.items : []).filter(r => r.a === id || r.b === id).map(r => {
        const peerId = r.a === id ? r.b : r.a, peer = directory.get(peerId);
        return peer ? { peer, tone: String(r.tone || "论坛熟人") } : null;
      }).filter(Boolean);
    } catch (e) { return []; }
  };
  // 角色和有公开 id 的网友头像都能点进主页；匿名身份仍不留可追踪足迹。
  const avatarBtn = (a, size, anon) => {
    const clickableChar = a.authorType === "character" && !anon && charOf(a.authorId);
    const clickableAlt = isAlt(a) && !anon && a.authorId;
    const clickableNpc = a.authorType === "npc" && !anon && a.authorId;
    return (clickableChar || clickableAlt || clickableNpc)
      ? h("div", { onClick: e => { e.stopPropagation(); clickableChar ? goProfile(a.authorId) : (clickableAlt ? goAltProfile(a) : goNpcProfile(a)); }, className: "cursor-pointer active:opacity-70", style: { flexShrink: 0 } }, avatarFor(a, size, anon))
      : avatarFor(a, size, anon);
  };
  const accountBadge = a => isAlt(a) ? h("span", { style: { fontFamily: F_BODY, fontSize: 9.5, color: "#7355a6", background: "rgba(115,85,166,.11)", border: "1px solid rgba(115,85,166,.35)", borderRadius: 999, padding: "1px 6px" } }, "小号") : null;

  // ---- 帖子底部操作条 ----
  function actBar(p) {
    const isL = liked.has(p.id);
    const isB = bookmarked.has(p.id);
    const bs = { fontFamily: F_BODY, fontSize: 12, flexShrink: 0, whiteSpace: "nowrap" };
    // ⚠️gap-5 是【固定】20px×5＝100px，加上四个数字和两个图标，赞和阅读一上万就顶出去了
    //   （她 2026-09-01 截图：整张卡片超出屏幕、整页跟着往右滑）。
    //   改成 space-between：间距由剩下的空间分，挤不下时先收间距，不会把内容推出去。
    return h("div", { className: "flex items-center mt-3", style: { color: FORUM_SKIN.fog, borderTop: "1px solid " + FORUM_SKIN.line, paddingTop: 10, justifyContent: "space-between", gap: 6, minWidth: 0 } },
      h("button", { onClick: e => { e.stopPropagation(); openPost(p); }, className: "flex items-center gap-1.5 active:opacity-60", style: bs }, h(GMsg, { size: 15, color: FORUM_SKIN.fog }), h("span", null, fmtNum(p.replyCount || 0))),
      h("div", { className: "flex items-center gap-1.5", style: bs }, h(IRepeat, { size: 15, color: FORUM_SKIN.fog }), h("span", null, fmtNum(p.rtCount || 0))),
      h("button", { onClick: e => { e.stopPropagation(); toggleLike(p.id); }, className: "flex items-center gap-1.5 active:opacity-60", style: { ...bs, color: isL ? "#a6535d" : FORUM_SKIN.fog } }, h(IHeart, { size: 15, color: isL ? "#a6535d" : FORUM_SKIN.fog, filled: isL }), h("span", null, fmtNum((p.likeCount || 0) + (isL ? 1 : 0)))),
      h("div", { className: "flex items-center gap-1.5", style: bs }, h(IBars, { size: 15, color: FORUM_SKIN.fog }), h("span", null, fmtNum(p.viewCount || 0))),
      h("button", { onClick: e => { e.stopPropagation(); toggleBookmark(p.id); }, title: isB ? "取消收藏" : "收藏", className: "active:opacity-60", style: { ...bs, color: isB ? FORUM_SKIN.accent : FORUM_SKIN.fog, fontSize: 17, lineHeight: 1 } }, isB ? "★" : "☆"),
      h("button", { onClick: e => { e.stopPropagation(); setFwd(p); }, className: "flex items-center active:opacity-60", style: bs }, h(ISend, { size: 15, color: FORUM_SKIN.fog })));
  }

  // ---- 帖子行（推特式）----
  function postRow(p, showBoard) {
    const unread = unreadFloors(p.id);
    const bs = forumBoardSkin(p.board);
    return h("div", { key: p.id, role: "button", onClick: () => openPost(p), className: "text-left active:opacity-80 cursor-pointer", style: { margin: "10px 13px 0", padding: "13px 13px 12px", borderRadius: 18, border: "1px solid " + FORUM_SKIN.line, borderLeft: "3px solid " + bs[0], background: FORUM_SKIN.paper, boxShadow: "0 8px 22px rgba(42,55,38,.065)" } },
      h("div", { className: "flex gap-3" },
        avatarBtn(p, 40, p.anon),
        h("div", { className: "flex-1 min-w-0" },
          h("div", { className: "grid items-start", style: { gridTemplateColumns: "minmax(0,1fr) auto", columnGap: 8, minWidth: 0 } },
            h("div", { className: "min-w-0" },
              h("div", { className: "flex items-center gap-1.5 min-w-0" },
                h("span", { className: "min-w-0", style: { fontFamily: F_DISPLAY, fontSize: 15, color: FORUM_SKIN.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, nameOf(p)),
                accountBadge(p)),
              h("div", { className: "flex items-center gap-1.5 min-w-0", style: { marginTop: 1 } },
                !p.anon && h("span", { className: "min-w-0", style: { fontFamily: F_BODY, fontSize: 11.5, color: FORUM_SKIN.fog, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, "@" + (p.authorHandle || p.authorName)),
                h("span", { style: { fontFamily: F_BODY, fontSize: 11.5, color: FORUM_SKIN.fog, flexShrink: 0, whiteSpace: "nowrap" } }, "· " + timeAgo(p.ts)),
                showBoard && h("span", { style: { flexShrink: 0 } }, tag(p.board)))),
            unread > 0 && h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: "#fff", background: bs[0], borderRadius: 999, padding: "2px 7px", whiteSpace: "nowrap" } }, "+" + unread + " 新回复")),
          p.title && h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16.5, lineHeight: 1.38, color: FORUM_SKIN.ink, marginTop: 5 } }, p.title),
          p.body && h("div", { className: "line-clamp-4", style: { fontFamily: F_BODY, fontSize: 13.5, lineHeight: 1.65, color: FORUM_SKIN.sub, marginTop: 4, whiteSpace: "pre-wrap" } }, p.body),
          actBar(p))));
  }

  // ---- 楼层（含楼中楼 + 回复按钮 + 赞）----
  function floorRow(post, cm, i) {
    const c = cm.authorType === "character" ? charOf(cm.authorId) : null;
    const isL = liked.has(cm.id);
    const nm = cm.authorType === "me" ? meChar.name : (c ? c.name : cm.authorName);
    const fresh = isFreshFloor(cm);
    return h("div", { key: cm.id || i, id: "forum-floor-" + (cm.id || i), style: { margin: "8px 13px 0", padding: "12px 13px", borderRadius: 15, border: "1px solid " + (fresh ? FORUM_SKIN.accent + "55" : FORUM_SKIN.line), borderLeft: (fresh ? "3px solid " + FORUM_SKIN.accent : "1px solid " + FORUM_SKIN.line), background: fresh ? "rgba(255,252,246,.95)" : "rgba(251,252,247,.82)" } },
      h("div", { className: "flex gap-2.5" },
        avatarBtn(cm, 34),
        h("div", { className: "flex-1 min-w-0" },
          h("div", { className: "grid items-start", style: { gridTemplateColumns: "minmax(0,1fr) auto", columnGap: 8, minWidth: 0 } },
            h("div", { className: "min-w-0" },
              h("div", { className: "flex items-center gap-1.5 min-w-0" },
                h("button", { onClick: () => { if(c)goProfile(c.id);else if(isAlt(cm))goAltProfile(cm);else goNpcProfile(cm); }, className: "active:opacity-60 min-w-0", style: { fontFamily: F_DISPLAY, fontSize: 13.5, color: cm.authorType === "me" ? t.accent : (c ? t.tint : t.ink), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "left" } }, nm),
                accountBadge(cm)),
              !cm.anon && h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 1 } }, "@" + (cm.authorHandle || cm.authorName))),
            h("div", { className: "flex items-center gap-1.5", style: { flexShrink: 0, whiteSpace: "nowrap" } },
              h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog } }, (cm.floor || i + 2) + " 楼"),
              fresh && newTag())),
          h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, lineHeight: 1.6, color: t.sub, marginTop: 2 } }, cm.content),
          ((cm.replies || []).length > 0 || (gen && gen.forumReplyMe === cm.id)) && h("div", { className: "mt-2 px-2.5 py-1.5", style: { borderRadius: 8, background: t.bg2 } },
            // ⚠️楼中楼里的每一条都要能回（她 2026-09-01：「我回复了帖子然后有楼中楼我就
            //   没办法回复了，别人的楼中楼也不行」）。原来只有【楼层】那一行有「回复」，
            //   楼里的人回了我之后，我就再也接不上话——一层楼说到一半断了。
            // 深度仍然只有两层：回楼中楼落在同一层里，用「回复 @某某」标出对象。
            //   （贴吧/微博就是这么做的；真做三层嵌套在手机上没法读，老数据也要迁。）
            (cm.replies || []).map((r, j) => h("div", { key: j, style: { padding: "3px 0" } },
              h("button", { onClick: () => { if(r.authorType==="character")goProfile(r.authorId);else if(isAlt(r))goAltProfile(r);else goNpcProfile(r); }, className: "active:opacity-60", style: { fontFamily: F_DISPLAY, fontSize: 12, color: r.authorType === "me" ? t.accent : (r.authorType === "character" ? t.tint : t.ink) } }, (r.authorType === "me" ? meChar.name : r.authorName)),
              accountBadge(r),
              r.isOp && h("span", { style: { fontFamily: F_BODY, fontSize: 9.5, color: t.bg2, background: t.tint, borderRadius: 4, padding: "0 4px", marginLeft: 4 } }, "楼主"),
              r.toName && h("span", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog } }, " 回复 @" + r.toName),
              isFreshReply(r) && newTag(),
              h("span", { style: { fontFamily: F_DISPLAY, fontSize: 12, color: r.authorType === "me" ? t.accent : (r.authorType === "character" ? t.tint : t.ink) } }, "："),
              h("span", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.sub } }, r.content),
              h("button", {
                onClick: () => setReplyTo({ floorId: cm.id, name: (r.authorType === "me" ? meChar.name : r.authorName), toName: (r.authorType === "me" ? meChar.name : r.authorName) }),
                className: "active:opacity-60",
                style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginLeft: 7 }
              }, "回复"))),
            (gen && gen.forumReplyMe === cm.id) && h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, padding: "3px 0" } }, "楼里的人正在回你…")),
          h("div", { className: "flex items-center gap-4 mt-1.5" },
            h("button", { onClick: () => setReplyTo({ floorId: cm.id, name: nm }), className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog } }, "回复"),
            h("button", { onClick: () => toggleLike(cm.id), className: "flex items-center gap-1 active:opacity-60", style: { fontFamily: F_BODY, fontSize: 11.5, color: isL ? "#e0245e" : t.fog } }, h(IHeart, { size: 13, color: isL ? "#e0245e" : t.fog, filled: isL }), h("span", null, fmtNum((cm.likeCount || 0) + (isL ? 1 : 0))))))));
  }

  const sendReply = () => {
    if (!rTxt.trim()) return;
    // toName 只有在回【楼中楼里某一条】时才有；回楼层本身时是空的
    if (replyTo) onReplySub(open, replyTo.floorId, rTxt.trim(), replyTo.toName || ""); else onReplyFloor(open, rTxt.trim());
    setRtxt(""); setReplyTo(null);
  };

  // ---- 帖子详情 ----
  function detail() {
    const p = open;
    const allFloors = forumFloorOrder(cmts[p.id] || []);
    const list = allFloors.filter(forumVisible);
    const waitingFloors = Math.max(0, allFloors.length - list.length);
    const loadingC = gen && gen.forumC === p.id;
    const moreC = gen && gen.forumMore === p.id;
    const c = (!p.anon && p.authorType === "character") ? charOf(p.authorId) : null;
    const alt = isAlt(p);
    return h("div", { className: "flex-1 flex flex-col min-h-0" },
      h("div", { className: "flex-1 min-h-0 overflow-y-auto" },
        h("div", { style: { margin: "12px 13px 4px", padding: "16px 15px 14px", borderRadius: 20, border: "1px solid " + FORUM_SKIN.line, borderTop: "3px solid " + forumBoardSkin(p.board)[0], background: FORUM_SKIN.paper, boxShadow: "0 10px 24px rgba(42,55,38,.07)" } },
          h("div", { className: "flex gap-3" },
            avatarBtn(p, 44, p.anon),
            h("button", { onClick: () => { if (c) goProfile(c.id); else if(alt)goAltProfile(p);else goNpcProfile(p); }, className: "text-left flex-1 min-w-0 " + ((c || alt || (!p.anon && p.authorType === "npc" && p.authorId)) ? "active:opacity-60" : ""), style: { display: "block" } },
              h("div", { className:"flex items-center gap-1.5 min-w-0", style: { fontFamily: F_DISPLAY, fontSize: 16, color: t.ink } },
                h("span", { className: "min-w-0", style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, nameOf(p)+(c || alt || (!p.anon && p.authorType === "npc" && p.authorId) ? " ›":"")), accountBadge(p)),
              h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, (p.anon ? "匿名" : "@" + (p.authorHandle || p.authorName)) + " · " + timeAgo(p.ts)))),
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 20, lineHeight: 1.35, color: FORUM_SKIN.ink, marginTop: 11 } }, p.title),
          h("div", { style: { fontFamily: F_BODY, fontSize: 14.5, lineHeight: 1.78, color: FORUM_SKIN.sub, marginTop: 8, whiteSpace: "pre-wrap" } }, p.body),
          h("div", { className: "mt-3" }, tag(p.board)),
          actBar(p),
          c && h("button", { onClick: () => onToggleFollow(c.id), className: "mt-3 px-3.5 py-1.5 active:opacity-70", style: { borderRadius: 999, border: `1px solid ${t.line}`, background: flw.includes(c.id) ? t.ink : "transparent", fontFamily: F_BODY, fontSize: 12, color: flw.includes(c.id) ? t.bg2 : t.ink } }, flw.includes(c.id) ? "已关注" : "关注 TA"),
          alt && h("button", { onClick: () => toggleNpcFollow(altFollowKey(p)), className: "mt-3 px-3.5 py-1.5 active:opacity-70", style: { borderRadius: 999, border: `1px solid ${t.line}`, background: npcFollowSet.has(altFollowKey(p)) ? t.ink : "transparent", fontFamily: F_BODY, fontSize: 12, color: npcFollowSet.has(altFollowKey(p)) ? t.bg2 : t.ink } }, npcFollowSet.has(altFollowKey(p)) ? "已关注小号" : "关注小号")),
        h("div", { className: "px-4 pt-3 pb-1 flex items-center justify-between" },
          h(Eyebrow, null, "全部回复 · " + (p.replyCount || 0)),
          h("button", { onClick: () => onMoreComments(p), disabled: moreC || loadingC, className: "active:opacity-60 disabled:opacity-40", style: { fontFamily: F_BODY, fontSize: 12, color: t.tint } }, moreC ? "旧楼已放出 · 生成中…" : (loadingC ? "首批正在生成…" : (waitingFloors > 0 ? "↻ 放出旧楼并生成" : "↻ 更多回复")))),
        loadingC && h(Spinner, { label: "楼里的人正在赶来…" }),
        !loadingC && waitingFloors > 0 && h("div", { className: "mx-4 my-2 px-3 py-2", style: { borderRadius: 10, background: t.bg2, border: `1px dashed ${t.line}`, fontFamily: F_BODY, fontSize: 11.5, color: t.fog } }, "还有 " + waitingFloors + " 条回帖会随着时间陆续出现"),
        !loadingC && list.length === 0 && h(Empty, { text: "还没有楼层", sub: "点上面「更多回复」让大家来" }),
        list.map((cm, i) => floorRow(p, cm, i))),
      h("div", { className: "shrink-0 px-3", style: { borderTop: "1px solid " + FORUM_SKIN.line, background: "rgba(248,250,245,.95)", paddingTop: 10, paddingBottom: COMPOSER_PAD_BOTTOM } },
        replyTo && h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, padding: "0 4px 4px" } }, "回复 " + replyTo.name + " · ", h("button", { onClick: () => setReplyTo(null), style: { color: t.accent } }, "取消")),
        h("div", { className: "flex gap-2" },
          h("input", { ref: replyInputRef, value: rTxt, onChange: e => setRtxt(e.target.value), onKeyDown: e => e.key === "Enter" && sendReply(), placeholder: replyTo ? "回复 " + replyTo.name + "…" : "发布你的回复", className: "flex-1 outline-none px-3.5 py-2 rounded-full", style: { fontFamily: F_BODY, fontSize: 13, background: FORUM_SKIN.paper, color: FORUM_SKIN.ink, border: "1px solid " + FORUM_SKIN.line } }),
          h("button", { onClick: sendReply, className: "px-4 rounded-full active:opacity-70", style: { background: FORUM_SKIN.accent, color: "#fff", fontFamily: F_BODY, fontSize: 12 } }, "发送"))));
  }

  // ---- 角色/我 主页 ----
  function profileView(isMe) {
    const c = isMe ? null : charOf(profileId);
    if (!isMe && !c) return null;
    const meta = isMe ? { handle: (forumMe && forumMe.handle) || profile.name || "我", bio: (forumMe && forumMe.bio) || "", joinTs: forumMe && forumMe.joinTs, following: followedChars.length + npcFollows.length, followers: (forumMe && forumMe.followers) || 0 } : (charMetaOf ? charMetaOf(c) : { handle: c.name, bio: c.motto || "", joinTs: 0, following: 0, followers: 0 });
    const av = h(Avatar, { character: isMe ? meChar : c, size: 62, radius: 31 });
    const mine = (posts || []).filter(p => forumVisible(p) && (isMe ? p.authorType === "me" : (p.authorId === profileId && p.authorType === "character")) && !p.anon).sort((a, b) => b.ts - a.ts);
    return h("div", { className: "flex-1 overflow-y-auto" },
      h("div", { className: "px-4 pt-5 pb-4", style: { borderBottom: `1px solid ${t.line}` } },
        h("div", { className: "flex items-start gap-3" },
          av,
          h("div", { className: "flex-1 min-w-0" },
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 20, color: t.ink } }, isMe ? meChar.name : c.name),
            h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.fog } }, "@" + meta.handle)),
          isMe
            ? h("button", { onClick: () => { setEmHandle(meta.handle); setEmBio(meta.bio); setEditMe(true); }, className: "shrink-0 px-3.5 py-1.5 active:opacity-70", style: { borderRadius: 999, border: `1px solid ${t.line}`, fontFamily: F_BODY, fontSize: 12, color: t.ink } }, "编辑资料")
            : h("div", { className: "shrink-0 flex flex-col items-end gap-1.5" },
              h("button", { onClick: () => onToggleFollow(c.id), className: "px-3.5 py-1.5 active:opacity-70", style: { borderRadius: 999, background: flw.includes(c.id) ? t.ink : "transparent", border: `1px solid ${t.line}`, fontFamily: F_BODY, fontSize: 12, color: flw.includes(c.id) ? t.bg2 : t.ink } }, flw.includes(c.id) ? "已关注" : "关注"),
              // 私信他【大号】（v59.75）。这条线会喂回聊天，跟线上/线下一起算同一段关系。
              // ⚠️小号主页（altProfileView）上故意【没有】这个按钮：小号私信一旦喂回聊天，
              //   「他知道两边是同一个人、她不知道」这个玩法当场塌掉，他迟早说漏。
              onStartCharPM ? h("button", {
                onClick: () => { const tid = onStartCharPM(c); if (tid) { setProfileId(null); setNav("pm"); setPmId(tid); } },
                className: "px-3.5 py-1.5 active:opacity-70",
                style: { borderRadius: 999, border: `1px solid ${FORUM_SKIN.accent}66`, fontFamily: F_BODY, fontSize: 12, color: FORUM_SKIN.accent }
              }, "私信 TA") : null)),
        meta.bio && h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, color: t.sub, marginTop: 10, lineHeight: 1.5 } }, meta.bio),
        !isMe && Array.isArray(meta.boardPrefs) && meta.boardPrefs.length > 0 && h("div", { className: "flex items-center gap-1.5 flex-wrap", style: { marginTop: 9 } },
          h("span", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog } }, "常逛"),
          meta.boardPrefs.map(b => h("span", { key: b, style: { fontFamily: F_BODY, fontSize: 10.5, color: t.tint, border: `1px solid ${t.line}`, borderRadius: 999, padding: "2px 7px" } }, b)),
          h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog } }, "· " + (meta.participation || "随缘出现"))),
        // 吧龄／关注／粉丝：数字一长（「1.2万 粉丝」）这一行就顶出去了，得能折行
        h("div", { className: "flex items-center flex-wrap gap-x-4 gap-y-1 mt-3", style: { minWidth: 0 } },
          h("span", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.fog, whiteSpace: "nowrap" } }, forumAge(meta.joinTs)),
          isMe
            ? h("button", { onClick: () => setFollowListOpen(true), className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 12.5, color: t.ink, whiteSpace: "nowrap" } }, h("b", null, fmtNum(meta.following)), h("span", { style: { color: t.fog } }, " 关注 ›"))
            : h("span", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.ink, whiteSpace: "nowrap" } }, h("b", null, fmtNum(meta.following)), h("span", { style: { color: t.fog } }, " 关注")),
          h("span", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.ink, whiteSpace: "nowrap" } }, h("b", null, fmtNum(meta.followers)), h("span", { style: { color: t.fog } }, " 粉丝"))),
        !isMe && h("button", { onClick: () => onGenCharPost(c, "日常吧"), disabled: gen && gen.forum === "char_" + c.id, className: "mt-3 px-3.5 py-1.5 active:opacity-70 disabled:opacity-40", style: { borderRadius: 999, border: `1px solid ${t.line}`, fontFamily: F_BODY, fontSize: 12, color: t.ink } }, gen && gen.forum === "char_" + c.id ? "发帖中…" : "＋ 让 TA 发一条")),
      mine.length === 0 && h(Empty, { text: isMe ? "你还没发过帖" : "TA 还没有公开发帖", sub: "匿名吧的帖子不会显示在这里" }),
      mine.map(p => postRow(p, true)));
  }

  // ---- 角色小号公开主页：只按该马甲汇总公开足迹，绝不显示背后角色真名 ----
  function altProfileView() {
    if (!altProfile) return null;
    const identity={authorType:"character_alt",authorId:altProfile.authorId,authorName:altProfile.name,authorHandle:altProfile.handle}, key=altFollowKey(identity), owner=charOf(altProfile.authorId), meta=owner&&charMetaOf?charMetaOf(owner):{}, displayName=meta.altName||altProfile.name, displayHandle=meta.altHandle||altProfile.handle;
    const authored=(posts||[]).filter(p=>forumVisible(p)&&!p.anon&&p.authorType==="character_alt"&&p.authorId===altProfile.authorId).sort((a,b)=>Number(b.ts||0)-Number(a.ts||0));
    const traces=[];
    (posts||[]).forEach(p=>(cmts[p.id]||[]).filter(forumVisible).forEach(f=>{
      if(!f.anon&&f.authorType==="character_alt"&&f.authorId===altProfile.authorId)traces.push({id:"af:"+p.id+":"+f.id,post:p,text:f.content||"",ts:floorArrivedAt(f),kind:"回复"});
      (f.replies||[]).forEach((r,j)=>{if(!r.anon&&r.authorType==="character_alt"&&r.authorId===altProfile.authorId)traces.push({id:"ar:"+p.id+":"+f.id+":"+j,post:p,text:r.content||"",ts:Number(r.ts||f.ts||0),kind:"楼中楼"});});
    }));
    traces.sort((a,b)=>b.ts-a.ts);
    const following=npcFollowSet.has(key), latest=Math.max(Number(authored[0]&&authored[0].ts||0),Number(traces[0]&&traces[0].ts||0));
    return h("div",{className:"flex-1 overflow-y-auto"},
      h("div",{className:"px-4 pt-5 pb-4",style:{borderBottom:`1px solid ${t.line}`}},
        h("div",{className:"flex items-start gap-3"},
          h(AltAvatar,{seed:meta.altAvatarSeed||displayHandle,size:62}),
          h("div",{className:"flex-1 min-w-0"},
            h("div",{className:"flex items-center gap-2",style:{fontFamily:F_DISPLAY,fontSize:20,color:t.ink}},h("span",null,displayName),accountBadge(identity)),
            h("div",{style:{fontFamily:F_BODY,fontSize:12.5,color:t.fog}},"@"+displayHandle)),
          h("button",{onClick:()=>toggleNpcFollow(key),className:"px-3.5 py-1.5 active:opacity-70",style:{borderRadius:999,background:following?t.ink:"transparent",border:`1px solid ${t.line}`,fontFamily:F_BODY,fontSize:12,color:following?t.bg2:t.ink}},following?"已关注":"关注")),
        h("div",{style:{fontFamily:F_BODY,fontSize:13.5,lineHeight:1.55,color:t.sub,marginTop:10}},meta.altBio||"这个账号习惯把大号不方便说的话留在这里。"),
        h("div",{className:"flex items-center flex-wrap gap-x-4 gap-y-1 mt-3",style:{minWidth:0}},
          h("span",{style:{fontFamily:F_BODY,fontSize:12.5,color:t.fog,whiteSpace:"nowrap"}},forumAge(meta.altJoinTs)),
          h("span",{style:{fontFamily:F_BODY,fontSize:12.5,color:t.ink,whiteSpace:"nowrap"}},h("b",null,fmtNum(meta.altFollowing||0)),h("span",{style:{color:t.fog}}," 关注")),
          h("span",{style:{fontFamily:F_BODY,fontSize:12.5,color:t.ink,whiteSpace:"nowrap"}},h("b",null,fmtNum(meta.altFollowers||0)),h("span",{style:{color:t.fog}}," 粉丝"))),
        h("div",{style:{fontFamily:F_BODY,fontSize:11.5,lineHeight:1.55,color:"#7355a6",marginTop:10,padding:"8px 10px",borderRadius:10,background:"rgba(115,85,166,.08)",border:"1px solid rgba(115,85,166,.2)"}},"小号身份 · 与大号资料和公开足迹分开展示；主页不会揭示它属于谁。"),
        latest>0&&h("div",{style:{fontFamily:F_BODY,fontSize:11.5,color:t.fog,marginTop:7}},"最近活跃 · "+timeAgo(latest))),
      authored.length>0&&h(React.Fragment,null,h("div",{className:"px-4 pt-4 pb-1"},h(Eyebrow,null,"小号发帖 · "+authored.length)),authored.map(p=>postRow(p,true))),
      authored.length===0&&h(Empty,{text:"这个小号还没有发过主帖",sub:"它在别人的楼里留下的回复仍会显示在下面"}),
      h("div",{className:"px-4 pt-4 pb-1"},h(Eyebrow,null,"公开回帖足迹 · "+traces.length)),
      traces.length===0&&h(Empty,{text:"暂时没有更多公开足迹",sub:"以后用这个小号回帖，记录会继续出现在这里"}),
      traces.slice(0,80).map(x=>h("button",{key:x.id,onClick:()=>openPost(x.post),className:"w-full text-left px-4 py-3 active:opacity-70",style:{borderBottom:`1px solid ${t.line}`}},
        h("div",{className:"flex items-center gap-2"},tag(x.kind),h("span",{style:{fontFamily:F_BODY,fontSize:11,color:t.fog}},timeAgo(x.ts))),
        h("div",{style:{fontFamily:F_BODY,fontSize:13.5,lineHeight:1.55,color:t.sub,marginTop:5}},x.text),
        h("div",{className:"truncate",style:{fontFamily:F_BODY,fontSize:11,color:t.fog,marginTop:4}},"来自《"+(x.post.title||"帖子")+"》"))));
  }

  // ---- 常驻网友 / 一次性路人公开主页：只拼已有公开足迹，绝不读取私聊或角色记忆 ----
  function npcProfileView() {
    if (!npcProfile) return null;
    const id = npcProfile.id;
    const authored = (posts || []).filter(p => forumVisible(p) && !p.anon && p.authorType === "npc" && p.authorId === id).sort((a, b) => Number(b.ts || 0) - Number(a.ts || 0));
    const traces = [];
    (posts || []).forEach(p => (cmts[p.id] || []).filter(forumVisible).forEach(f => {
      if (!f.anon && f.authorType === "npc" && f.authorId === id) traces.push({ id: "f:" + p.id + ":" + f.id, post: p, text: f.content || "", ts: floorArrivedAt(f), kind: "回复" });
      (f.replies || []).forEach((r, j) => { if (!r.anon && r.authorType === "npc" && r.authorId === id) traces.push({ id: "r:" + p.id + ":" + f.id + ":" + j, post: p, text: r.content || "", ts: Number(r.ts || f.ts || 0), kind: "楼中楼" }); });
    }));
    traces.sort((a, b) => b.ts - a.ts);
    let encounters = 0;
    try { const x = JSON.parse(localStorage.getItem("x_forumPublicTies") || "{}"); encounters = Number(x && x.items && x.items[id] && x.items[id].encounters) || 0; } catch (e) {}
    const regular = /^npc_(regular|anon)_/.test(String(id));
    const following = npcFollowSet.has(id);
    const relations = publicNpcRelations(id);
    const latest = Math.max(Number(authored[0] && authored[0].ts || 0), Number(traces[0] && traces[0].ts || 0));
    // 私信开场白的底子：他自己发过的帖 + 他在别人楼里说过的话，各取最近几条
    const pmGround = authored.slice(0, 3).map(p => "· 他发过帖《" + (p.title || "") + "》" + (p.body ? "：" + String(p.body).replace(/\s+/g, " ").slice(0, 70) : "") + "（在" + p.board + "）")
      .concat(traces.slice(0, 5).map(x => "· 他在《" + (x.post.title || "帖子") + "》里说过：" + String(x.text).replace(/\s+/g, " ").slice(0, 70)));
    return h("div", { className: "flex-1 overflow-y-auto" },
      h("div", { className: "px-4 pt-5 pb-4", style: { borderBottom: `1px solid ${t.line}` } },
        h("div", { className: "flex items-start gap-3" },
          h(NpcAvatar, { seed: npcProfile.handle || npcProfile.name, size: 62 }),
          h("div", { className: "flex-1 min-w-0" },
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 20, color: t.ink } }, npcProfile.name),
            h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.fog } }, "@" + npcProfile.handle),
            h("div", { className: "flex gap-1.5 mt-2 flex-wrap" }, tag(regular ? "常驻熟面孔" : "路过网友"), encounters > 0 && tag("碰见过 " + encounters + " 次"))),
          h("div", { className: "shrink-0 flex flex-col items-end gap-1.5" },
            h("button", { onClick: () => toggleNpcFollow(id), className: "px-3.5 py-1.5 active:opacity-70", style: { borderRadius: 999, background: following ? t.ink : "transparent", border: `1px solid ${t.line}`, fontFamily: F_BODY, fontSize: 12, color: following ? t.bg2 : t.ink } }, following ? "已关注" : "关注"),
            // 主动去私信这个人（她 2026-09-01 点名）。开场白喂的是他【自己在吧里说过的话】：
            // 不喂的话写出来的是「一个网友」，换成谁都成立。
            h("button", {
              onClick: () => {
                if (!onStartPM) return;
                Promise.resolve(onStartPM({ id, name: npcProfile.name, handle: npcProfile.handle }, pmGround))
                  .then(tid => { if (tid) { setNpcProfile(null); setNav("pm"); setPmId(tid); } });
              },
              disabled: gen && (gen.forumPM === "start"),
              className: "px-3.5 py-1.5 active:opacity-70 disabled:opacity-40",
              style: { borderRadius: 999, border: `1px solid ${FORUM_SKIN.accent}66`, fontFamily: F_BODY, fontSize: 12, color: FORUM_SKIN.accent }
            }, gen && gen.forumPM === "start" ? "去敲门…" : "私信 TA"))),
        h("div", { style: { fontFamily: F_BODY, fontSize: 12, lineHeight: 1.6, color: t.fog, marginTop: 11 } }, regular ? "这是会在不同帖子里再次出现的固定网友；主页只展示公开发言。" : "这位网友只在当时的公开帖子里路过，不会被系统硬写成常驻熟人。"),
        latest > 0 && h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginTop: 7 } }, "最近活跃 · " + timeAgo(latest))),
      relations.length > 0 && h("div", { className: "px-4 py-4", style: { borderBottom: `1px solid ${t.line}` } },
        h(Eyebrow, null, "经常一起出现 · " + relations.length),
        h("div", { className: "space-y-2 mt-2.5" }, relations.map(x => h("button", { key: x.peer.id, onClick: () => setNpcProfile(x.peer), className: "w-full flex items-center gap-3 text-left active:opacity-70", style: { padding: "9px 10px", borderRadius: 12, background: t.bg2 } },
          h(NpcAvatar, { seed: x.peer.handle || x.peer.name, size: 38 }),
          h("div", { className: "flex-1 min-w-0" },
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14.5, color: t.ink } }, x.peer.name),
            h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, lineHeight: 1.45, color: t.fog, marginTop: 2 } }, x.tone)),
          h(IChevR, { size: 15, color: t.fog }))))),
      authored.length > 0 && h(React.Fragment, null,
        h("div", { className: "px-4 pt-4 pb-1" }, h(Eyebrow, null, "公开发帖 · " + authored.length)),
        authored.map(p => postRow(p, true))),
      h("div", { className: "px-4 pt-4 pb-1" }, h(Eyebrow, null, "公开回帖足迹 · " + traces.length)),
      traces.length === 0 && h(Empty, { text: "暂时没有更多公开足迹", sub: "以后在别的楼碰见，足迹会接着长" }),
      traces.slice(0, 80).map(x => h("button", { key: x.id, onClick: () => openPost(x.post), className: "w-full text-left px-4 py-3 active:opacity-70", style: { borderBottom: `1px solid ${t.line}` } },
        h("div", { className: "flex items-center gap-2" }, tag(x.kind), h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog } }, timeAgo(x.ts))),
        h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, lineHeight: 1.55, color: t.sub, marginTop: 5 } }, x.text),
        h("div", { className: "truncate", style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginTop: 4 } }, "来自《" + (x.post.title || "帖子") + "》"))));
  }

  // ---- 私信列表 / 会话 ----
  function pmList() {
    const list = pms || [];
    return h("div", { className: "flex-1 overflow-y-auto" },
      h("div", { className: "px-4 flex items-center gap-2 my-4" },
        h("button", { onClick: onRefreshPMs, disabled: gen && gen.forumPM === "refresh", className: "flex-1 py-2.5 active:opacity-70 disabled:opacity-40", style: { borderRadius: 8, background: t.ink, color: t.bg2, fontFamily: F_BODY, fontSize: 12.5 } }, gen && gen.forumPM === "refresh" ? "刷新中…" : "↻ 刷新 · 看看有没有人私信我"),
        // 清理（她 2026-09-01：「加一个清理可以清掉私信」）。
        // 私信答的是【现在还挂着谁】，不是发生过什么——聊完了、不想理了就该能删掉。
        list.length > 0 && h("button", { onClick: () => setPmClean(v => !v), className: "shrink-0 px-3 py-2.5 active:opacity-70", style: { borderRadius: 8, border: "1px solid " + t.line, color: pmClean ? t.accent : t.ink, fontFamily: F_BODY, fontSize: 12.5 } }, pmClean ? "完成" : "清理")),
      pmClean && list.length > 0 && h("div", { className: "px-4 pb-3 flex items-center justify-between gap-3" },
        h("span", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog } }, "点右边的 ✕ 删掉一条"),
        h("button", { onClick: () => { onClearPMs && onClearPMs(); setPmClean(false); }, className: "shrink-0 active:opacity-60", style: { fontFamily: F_BODY, fontSize: 11.5, color: t.accent } }, "全部清掉 " + list.length + " 条")),
      list.length === 0 && h(Empty, { text: "还没有私信", sub: "点上面刷新，说不定有网友（或喷子）来找你" }),
      list.map(th => {
        const last = th.messages[th.messages.length - 1] || { from: "npc", text: "" };
        return h("div", { key: th.id, className: "flex items-center gap-3 px-4 py-3.5", style: { borderBottom: `1px solid ${t.line}` } },
          h("button", { onClick: () => { setPmId(th.id); onMarkPMRead(th.id); }, className: "flex-1 min-w-0 text-left flex items-center gap-3 active:opacity-70" },
            h(NpcAvatar, { seed: th.npcName, size: 42 }),
            h("div", { className: "flex-1 min-w-0" },
              h("div", { className: "flex items-center gap-1.5" }, h("span", { style: { fontFamily: F_DISPLAY, fontSize: 15, color: t.ink } }, th.npcName), th.attitude === "troll" && tag("杠"), th.unread && h("span", { style: { width: 7, height: 7, borderRadius: 999, background: t.accent } })),
              h("div", { className: "truncate", style: { fontFamily: F_BODY, fontSize: 12, color: t.fog } }, (last.from === "me" ? "我：" : "") + last.text))),
          pmClean && h("button", { onClick: () => onDelPM && onDelPM(th.id), "aria-label": "删掉和 " + th.npcName + " 的私信", className: "shrink-0 active:opacity-60", style: { width: 34, height: 34, borderRadius: 999, border: "1px solid " + t.line, color: t.accent, fontFamily: F_BODY, fontSize: 14 } }, "✕"));
      }));
  }

  // ---- 回复我的：只列有明确本地证据的直达通知，不让模型猜谁在 @ 我 ----
  function noticeList() {
    return h("div", { className: "flex-1 overflow-y-auto" },
      forumNotices.length === 0 && h(Empty, { text: "还没有人回复你", sub: "你发帖或在楼里说话后，新的直接回复会出现在这里" }),
      forumNotices.map(n => h("div", { key: n.id, className: "px-4 py-3.5 flex gap-3", style: { borderBottom: `1px solid ${t.line}`, background: forumNoticeRead[n.id] ? "transparent" : t.bg2 } },
        h("button", { onClick: () => openNotice(n), className: "flex-1 min-w-0 text-left flex gap-3 active:opacity-70" },
          avatarFor(n.author, 38, n.author && n.author.anon),
          h("div", { className: "flex-1 min-w-0" },
            h("div", { className: "flex items-center gap-1.5" },
              h("span", { style: { fontFamily: F_DISPLAY, fontSize: 14.5, color: t.ink } }, n.authorName),
              h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog } }, n.kind + " · " + timeAgo(n.ts)),
              !forumNoticeRead[n.id] && h("span", { style: { width: 7, height: 7, borderRadius: 999, background: t.accent, marginLeft: "auto" } })),
            h("div", { className: "truncate", style: { fontFamily: F_BODY, fontSize: 13, color: t.sub, marginTop: 3 } }, n.content),
            h("div", { className: "truncate", style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginTop: 3 } }, "来自《" + (n.post.title || "帖子") + "》"))),
        h("button", { onClick: () => replyFromNotice(n), className: "shrink-0 self-center active:opacity-60", style: { fontFamily: F_BODY, fontSize: 11.5, color: FORUM_SKIN.accent, border: "1px solid " + FORUM_SKIN.accent + "66", borderRadius: 999, padding: "5px 11px" } }, "回复"))));
  }
  function pmThread() {
    const th = (pms || []).find(x => x.id === pmId);
    if (!th) return null;
    const sending = gen && gen.forumPM === th.id;
    const send = () => { if (pmText.trim()) { onSendPM(th.id, pmText.trim()); setPmText(""); } };
    return h("div", { className: "flex-1 flex flex-col min-h-0" },
      h("div", { className: "flex-1 overflow-y-auto px-5 py-4 space-y-2.5" },
        th.messages.map((m, i) => h("div", { key: i, className: "flex " + (m.from === "me" ? "justify-end" : "justify-start") },
          h("div", { style: { maxWidth: "76%", padding: "8px 12px", borderRadius: 14, fontFamily: F_BODY, fontSize: 13.5, lineHeight: 1.5, background: m.from === "me" ? t.accent : t.bg2, color: m.from === "me" ? "#fff" : t.ink, border: m.from === "me" ? "none" : `1px solid ${t.line}` } }, m.text))),
        sending && h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, paddingLeft: 4 } }, th.npcName + " 正在打字…")),
      h("div", { className: "shrink-0 px-4 py-3 flex gap-2", style: { borderTop: `1px solid ${t.line}` } },
        h("input", { value: pmText, onChange: e => setPmText(e.target.value), onKeyDown: e => e.key === "Enter" && send(), placeholder: "回 " + th.npcName + "…", className: "flex-1 outline-none px-3 py-2 rounded-lg", style: { fontFamily: F_BODY, fontSize: 13, background: t.bg2, color: t.ink, border: `1px solid ${t.line}` } }),
        h("button", { onClick: send, disabled: sending, className: "px-4 rounded-lg active:opacity-70 disabled:opacity-40", style: { background: t.ink, color: t.bg2, fontFamily: F_BODY, fontSize: 12 } }, "发送")));
  }

  // ---- 主页版块列表 ----
  function homeFeed() {
    let arr = (posts || []).filter(p => forumVisible(p) && (tab === "收藏" || FORUM_BOARDS.includes(p.board)));
    if (tab === "收藏") arr = arr.filter(p => bookmarked.has(p.id));
    else if (tab === "关注") arr = arr.filter(followedPost);
    else arr = arr.filter(p => p.board === tab);
    arr = arr.slice().sort((a, b) => {
      if (feedSort === "latest") return Number(b.ts || 0) - Number(a.ts || 0);
      if (feedSort === "hot") return postHotScore(b) - postHotScore(a) || postLastActivity(b) - postLastActivity(a);
      return postLastActivity(b) - postLastActivity(a);
    });
    const shown = arr.slice(0, page * PAGE);
    const arrived = arr.filter(p => Number(p.visibleAt || p.ts || 0) > forumLastSeen).length;
    return h("div", { ref: feedScrollRef, className: "flex-1 min-h-0 overflow-y-auto", style: { paddingBottom: 14 } },
      forumUnreadRows.length > 0 && h("div", { className: "mx-4 mt-3", style: { borderRadius: 14, background: FORUM_SKIN.paper, border: "1px solid " + FORUM_SKIN.line, boxShadow: "0 5px 14px rgba(42,55,38,.05)", overflow: "hidden" } },
        h("div", { className: "flex items-center justify-between px-3 py-2", style: { borderBottom: "1px solid " + FORUM_SKIN.line } },
          h("span", { style: { fontFamily: F_DISPLAY, fontSize: 12.5, color: FORUM_SKIN.ink } }, "新回复在这里"),
          h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: FORUM_SKIN.accent } }, forumUnreadRows.length + " 个帖子 · " + forumUnreadTotal + " 条")),
        forumUnreadRows.slice(0, 4).map(x => h("button", { key: x.post.id, onClick: () => openPost(x.post), className: "w-full flex items-center gap-2 px-3 py-2 text-left active:opacity-60", style: { borderBottom: "1px solid " + FORUM_SKIN.line } },
          h("span", { className: "min-w-0 flex-1", style: { fontFamily: F_BODY, fontSize: 12, color: FORUM_SKIN.sub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, "《" + (x.post.title || "帖子") + "》"),
          h("span", { style: { fontFamily: F_BODY, fontSize: 10, color: FORUM_SKIN.fog, flexShrink: 0 } }, x.post.board),
          h("span", { style: { minWidth: 36, textAlign: "right", fontFamily: F_BODY, fontSize: 10.5, color: FORUM_SKIN.accent, flexShrink: 0 } }, "+" + x.count))),
        forumUnreadRows.length > 4 && h("div", { className: "px-3 py-1.5", style: { fontFamily: F_BODY, fontSize: 10.5, color: FORUM_SKIN.fog } }, "还有 " + (forumUnreadRows.length - 4) + " 个帖子，读完上面几条后会继续列出")),
      arrived > 0 && h("div", { className: "mx-4 mt-3 px-3 py-2 flex items-center gap-2", style: { borderRadius: 12, background: FORUM_SKIN.paper, border: "1px solid " + FORUM_SKIN.line, fontFamily: F_BODY, fontSize: 12, color: FORUM_SKIN.accent } }, h("span", { style: { width: 7, height: 7, borderRadius: 99, background: FORUM_SKIN.accent } }), h("span", null, "离开期间，这里新增了 " + arrived + " 条")),
      tab === "关注" && flw.length === 0 && npcFollows.length === 0 && h(Empty, { text: "还没有关注任何人", sub: "点进角色或网友主页关注" }),
      tab === "关注" && (flw.length > 0 || npcFollows.length > 0) && shown.length === 0 && h(Empty, { text: "关注的人还没发过公开帖", sub: "" }),
      tab === "收藏" && shown.length === 0 && h(Empty, { text: "还没有收藏帖子", sub: "看到想留着的，点帖子下面的 ☆" }),
      tab !== "关注" && tab !== "收藏" && shown.length === 0 && !(gen && gen.forum === tab) && h(Empty, { text: "「" + tab + "」还没有帖子", sub: "点右上角刷新键让网友发帖" }),
      gen && gen.forum === tab && shown.length === 0 && h(Spinner, { label: "网友正在冒泡…" }),
      shown.map(p => postRow(p, false)),
      arr.length > shown.length && h("button", { onClick: () => setPage(page + 1), className: "w-full py-3 active:opacity-60", style: { fontFamily: F_BODY, fontSize: 12, color: t.tint } }, "加载更多 (" + (arr.length - shown.length) + ")"));
  }

  // ---- 搜索：四版块之外的吧 ----
  function searchView() {
    const arr = (posts || []).filter(p => forumVisible(p) && !FORUM_BOARDS.includes(p.board)).sort((a, b) => b.ts - a.ts);
    const busy = gen && gen.forumSearch;
    const go = () => onGenSearch(searchQ.trim());
    return h("div", { className: "flex-1 overflow-y-auto" },
      h("div", { className: "px-4 py-3 flex gap-2", style: { borderBottom: `1px solid ${t.line}` } },
        h("input", { value: searchQ, onChange: e => setSearchQ(e.target.value), onKeyDown: e => e.key === "Enter" && go(), placeholder: "搜个吧 / 话题（留空随机刷）", className: "flex-1 outline-none px-3.5 py-2 rounded-full", style: { fontFamily: F_BODY, fontSize: 13, background: t.bg2, color: t.ink, border: `1px solid ${t.line}` } }),
        h("button", { onClick: go, disabled: busy, className: "px-4 rounded-full active:opacity-70 disabled:opacity-40", style: { background: t.ink, color: t.bg2, fontFamily: F_BODY, fontSize: 12 } }, busy ? "…" : "刷")),
      busy && arr.length === 0 && h(Spinner, { label: "正在逛别的吧…" }),
      !busy && arr.length === 0 && h(Empty, { text: "还没逛到别的吧", sub: "搜个话题，或留空直接点「刷」随机逛" }),
      arr.map(p => postRow(p, true)));
  }

  // ---- 主体分派 ----
  const inSub = open || altProfile || npcProfile || (profileId && profileId !== "me") || pmId;
  let title = "论坛", bodyEl, backFn = null, rightEl = null;
  if (open) { title = "帖子"; bodyEl = detail(); backFn = closePost; }
  else if (altProfile) { title = "小号主页"; bodyEl = altProfileView(); backFn = () => setAltProfile(null); }
  else if (npcProfile) { title = "网友主页"; bodyEl = npcProfileView(); backFn = () => setNpcProfile(null); }
  else if (profileId && profileId !== "me") { title = "主页"; bodyEl = profileView(false); backFn = () => setProfileId(null); }
  else if (pmId) { title = ((pms || []).find(x => x.id === pmId) || {}).npcName || "私信"; bodyEl = pmThread(); backFn = () => setPmId(null); }
  else if (nav === "search") { title = "搜索"; bodyEl = searchView(); rightEl = h("button", { onClick: () => onGenSearch(searchQ.trim()), className: "active:opacity-50" }, h(IRefresh, { size: 19, color: t.ink })); }
  else if (nav === "notice") { title = "回复我的"; bodyEl = noticeList(); }
  else if (nav === "pm") { title = "私信"; bodyEl = pmList(); }
  else if (nav === "me") { title = "我"; bodyEl = profileView(true); }
  else { title = forumUnreadTotal > 0 ? "论坛 · " + forumUnreadTotal + " 条新回复" : "论坛"; bodyEl = homeFeed(); rightEl = (tab === "收藏" || tab === "关注") ? null : h("button", { onClick: () => onGenBoard(tab), disabled: gen && gen.forum === tab, className: "active:opacity-50 disabled:opacity-40" }, h(IRefresh, { size: 19, color: t.ink })); }

  // ⚠️overflowX 兜死：里头任何一处顶宽了（一条超长的 @、一串大数字），整页就会
  //   横着滑起来——连顶栏和返回键一起被推出屏幕（她 2026-09-01 那张截图就是这样，
  //   头像左半边和返回键都不见了）。里头该修的照修，但这一道得先拦住整页跑偏。
  return h("div", { className: "h-full flex flex-col relative", style: { background: FORUM_SKIN.bg, color: FORUM_SKIN.ink, overflowX: "hidden" } },
    // 紧凑居中顶栏：左右等宽，论坛不再是普通列表左上角的一行大字。
    h("div", { className: "shrink-0 px-4 pb-2", style: { paddingTop: safeTop(10), borderBottom: (inSub || nav !== "home") ? "1px solid " + FORUM_SKIN.line : "none", background: "rgba(244,247,240,.92)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)" } },
      h("div", { className: "grid items-center", style: { gridTemplateColumns: "72px 1fr 72px", minHeight: 40 } },
        h("button", { onClick: backFn || onBack, "aria-label": "返回", className: "active:opacity-50 flex items-center justify-start", style: { width: 40, height: 40, marginLeft: -8 } }, h(IArrow, { size: 19, color: FORUM_SKIN.ink })),
        h("div", { className: "min-w-0 text-center" },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16, lineHeight: 1.15, color: FORUM_SKIN.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, title),
          (!inSub && nav === "home") ? h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 8.5, letterSpacing: ".19em", color: FORUM_SKIN.fog, marginTop: 2 } }, "NEIGHBORHOOD BOARD") : null),
        h("div", { className: "flex items-center justify-end", style: { gap: 4 } },
          (!inSub) && h("button", { onClick: () => setSettingsOpen(true), "aria-label": "论坛设置", className: "active:opacity-50 flex items-center justify-center", style: { width: 32, height: 40 } }, h(GConfig, { size: 17, color: FORUM_SKIN.ink })),
          rightEl ? h("span", { className: "flex items-center justify-center", style: { width: 32, height: 40 } }, rightEl) : null))),
    (!inSub && nav === "home") && h("div", { className: "shrink-0 flex gap-1.5 px-4 pb-2 overflow-x-auto", style: { borderBottom: "1px solid " + FORUM_SKIN.line, background: "rgba(244,247,240,.88)", scrollbarWidth: "none" } }, [...FORUM_BOARDS, "关注", "收藏"].map(b => {
      const count = (posts || []).filter(p => forumVisible(p) && (b === "收藏" ? bookmarked.has(p.id) : b === "关注" ? followedPost(p) : p.board === b)).reduce((n, p) => n + unreadFloors(p.id), 0);
      return chip(b + (count > 0 ? " · " + count : ""), tab === b, () => { setTab(b); setPage(1); });
    })),
    // 时间线像公告栏上三张钉着的排序便笺：选中那张抬起、钉子落墨，不是换个色的胶囊。
    (!inSub && nav === "home") && h("div", { className: "shrink-0 grid grid-cols-3 gap-2 px-4 py-2", style: { borderBottom: "1px solid " + FORUM_SKIN.line, background: "rgba(255,255,255,.34)" } },
      [["active", "正在聊"], ["latest", "最新发帖"], ["hot", "热榜"]].map((x, xi) => { const active = feedSort === x[0]; return h("button", { key: x[0], title: x[0] === "active" ? "新回复会把旧帖顶回来" : (x[0] === "hot" ? "热度会随时间降温" : "只按发帖时间"), onClick: () => { setFeedSort(x[0]); setPage(1); }, className: "active:opacity-70 flex flex-col items-center justify-center", style: { minHeight: 44, position: "relative", borderRadius: 4, transform: active ? "translateY(-2px) rotate(" + (xi - 1) * .35 + "deg)" : "translateY(2px)", fontFamily: F_BODY, fontSize: 11.5, color: active ? FORUM_SKIN.ink : FORUM_SKIN.fog, background: active ? FORUM_SKIN.paper : "rgba(255,255,255,.26)", border: "1px solid " + (active ? FORUM_SKIN.line : "transparent"), borderTop: "3px solid " + (active ? FORUM_SKIN.accent : "rgba(74,94,65,.18)"), boxShadow: active ? "0 5px 12px rgba(74,94,65,.13)" : "none" } }, h("span", { style: { position: "absolute", top: 4, width: 5, height: 5, borderRadius: 99, background: active ? FORUM_SKIN.accent : FORUM_SKIN.line } }), h("span", { style: { marginTop: 5 } }, x[1])); })),
    bodyEl,
    (!inSub) && h("div", { className: "shrink-0 flex", style: { borderTop: "1px solid " + FORUM_SKIN.line, background: "rgba(248,250,245,.94)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", paddingBottom: COMPOSER_PAD_BOTTOM } },
      [["home", IHome, "主页"], ["search", ISearch, "搜索"], ["notice", IPulse, "回复"], ["pm", IMail, "私信"], ["me", GUser, "我"]].map(nx => { const Ic = nx[1]; const active = nav === nx[0]; return h("button", { key: nx[0], onClick: () => setNav(nx[0]), className: "flex-1 pt-1.5 pb-1 flex flex-col items-center gap-0.5 active:opacity-60 relative", style: { color: active ? FORUM_SKIN.ink : FORUM_SKIN.fog } },
        h("span", { className: "flex items-center justify-center", style: { width: 38, height: 27, borderRadius: 999, background: active ? FORUM_SKIN.soft : "transparent" } }, h(Ic, { size: 19, color: active ? FORUM_SKIN.accent : FORUM_SKIN.fog })),
        h("span", { style: { fontFamily: F_BODY, fontSize: 9.5 } }, nx[2]),
        nx[0] === "pm" && unreadPM > 0 && h("span", { style: { position: "absolute", top: 2, right: "50%", marginRight: -22, minWidth: 14, height: 14, padding: "0 3px", borderRadius: 999, background: t.accent, color: "#fff", fontSize: 8.5, fontFamily: F_BODY, display: "flex", alignItems: "center", justifyContent: "center" } }, unreadPM),
        nx[0] === "notice" && unreadNoticeCount > 0 && h("span", { style: { position: "absolute", top: 2, right: "50%", marginRight: -23, minWidth: 14, height: 14, padding: "0 3px", borderRadius: 999, background: t.accent, color: "#fff", fontSize: 8.5, fontFamily: F_BODY, display: "flex", alignItems: "center", justifyContent: "center" } }, unreadNoticeCount > 99 ? "99+" : unreadNoticeCount)); })),
    // 悬浮发帖按钮（主页/搜索）
    (!inSub && (nav === "home" || nav === "search")) && h("button", { onClick: () => setComposer(true), "aria-label": "发帖", className: "active:opacity-80", style: { position: "absolute", right: 18, bottom: "calc(58px + env(safe-area-inset-bottom) * .4)", width: 50, height: 50, borderRadius: 17, background: FORUM_SKIN.accent, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 9px 22px rgba(58,76,51,.28)", zIndex: 30 } }, h(IPlus, { size: 23, color: "#fff" })),
    // 转发 picker
    fwd && h(Sheet, { onClose: () => setFwd(null) },
      h(Eyebrow, { style: { marginBottom: 10 } }, "转发「" + (fwd.title || "").slice(0, 14) + "」到"),
      h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginBottom: 8 } }, "私聊"),
      h("div", { className: "space-y-1 max-h-44 overflow-y-auto mb-3" }, (characters || []).map(c => h("button", { key: c.id, onClick: () => { onForwardToChat(fwd, c); setFwd(null); }, className: "w-full flex items-center gap-3 py-2 active:opacity-60" }, h(Avatar, { character: c, size: 32, radius: 8 }), h("span", { style: { fontFamily: F_DISPLAY, fontSize: 15, color: t.ink } }, c.remark || c.name)))),
      (groups || []).length > 0 && h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginBottom: 8 } }, "群聊"),
      h("div", { className: "space-y-1 max-h-40 overflow-y-auto" }, (groups || []).map(g => h("button", { key: g.id, onClick: () => { onForwardToGroup(fwd, g.id); setFwd(null); }, className: "w-full flex items-center gap-3 py-2 active:opacity-60" }, h("div", { style: { width: 32, height: 32, borderRadius: 8, background: t.bg2, border: `1px solid ${t.line}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 } }, "👥"), h("span", { style: { fontFamily: F_DISPLAY, fontSize: 15, color: t.ink } }, g.name))))),
    // 我发帖 composer
    composer && h(Sheet, { onClose: () => setComposer(false), tall: true },
      h(Eyebrow, { style: { marginBottom: 10 } }, "发帖"),
      h("div", { className: "flex gap-1.5 mb-3 flex-wrap" }, FORUM_BOARDS.map(b => chip(b, cbBoard === b, () => setCbBoard(b)))),
      h("input", { value: cbTitle, onChange: e => setCbTitle(e.target.value), placeholder: "标题", className: "w-full outline-none px-3.5 py-2.5 rounded-lg mb-2", style: { fontFamily: F_DISPLAY, fontSize: 15, background: t.bg2, color: t.ink, border: `1px solid ${t.line}` } }),
      h("textarea", { value: cbBody, onChange: e => setCbBody(e.target.value), placeholder: "正文…", className: "w-full outline-none px-3.5 py-2.5 rounded-lg", style: { fontFamily: F_BODY, fontSize: 14, minHeight: 120, background: t.bg2, color: t.ink, border: `1px solid ${t.line}`, resize: "none" } }),
      h("button", { onClick: () => { if (cbTitle.trim()) { onPostMine(cbBoard, cbTitle.trim(), cbBody.trim()); setCbTitle(""); setCbBody(""); setComposer(false); setNav("home"); setTab(cbBoard); } }, className: "w-full mt-3 py-2.5 active:opacity-70", style: { borderRadius: 8, background: t.ink, color: t.bg2, fontFamily: F_BODY, fontSize: 13 } }, "发布")),
    // 编辑我的资料
    editMe && h(Sheet, { onClose: () => setEditMe(false) },
      h(Eyebrow, { style: { marginBottom: 10 } }, "编辑我的贴吧资料"),
      h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginBottom: 4 } }, "贴吧 id"),
      h("input", { value: emHandle, onChange: e => setEmHandle(e.target.value), placeholder: "你的网名", className: "w-full outline-none px-3.5 py-2.5 rounded-lg mb-3", style: { fontFamily: F_BODY, fontSize: 14, background: t.bg2, color: t.ink, border: `1px solid ${t.line}` } }),
      h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginBottom: 4 } }, "签名"),
      h("textarea", { value: emBio, onChange: e => setEmBio(e.target.value), placeholder: "一句话签名…", className: "w-full outline-none px-3.5 py-2.5 rounded-lg", style: { fontFamily: F_BODY, fontSize: 14, minHeight: 80, background: t.bg2, color: t.ink, border: `1px solid ${t.line}`, resize: "none" } }),
      h("button", { onClick: () => { onEditMe({ handle: emHandle.trim() || meChar.name, bio: emBio.trim() }); setEditMe(false); }, className: "w-full mt-3 py-2.5 active:opacity-70", style: { borderRadius: 8, background: t.ink, color: t.bg2, fontFamily: F_BODY, fontSize: 13 } }, "保存")),
    // 谁在逛论坛
    settingsOpen && h(Sheet, { onClose: () => setSettingsOpen(false) },
      h(Eyebrow, { style: { marginBottom: 6 } }, "哪些角色在逛论坛"),
      h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginBottom: 10, lineHeight: 1.5 } }, "关掉的角色不会在评论/回复里冒泡，也不会在论坛发帖"),
      (characters || []).length === 0 && h(Empty, { text: "还没有角色", sub: "" }),
      h("div", { className: "space-y-1 max-h-80 overflow-y-auto" }, (characters || []).map(c => { const on = !(forumOff || []).includes(c.id); return h("button", { key: c.id, onClick: () => onToggleForumChar(c.id), className: "w-full flex items-center gap-3 py-2 active:opacity-70" }, h(Avatar, { character: c, size: 36, radius: 18 }), h("span", { className: "flex-1 text-left", style: { fontFamily: F_DISPLAY, fontSize: 15, color: t.ink } }, c.name), h("div", { style: { width: 44, height: 26, borderRadius: 999, background: on ? t.ink : t.line, position: "relative", flexShrink: 0 } }, h("div", { style: { position: "absolute", top: 3, left: on ? 21 : 3, width: 20, height: 20, borderRadius: 999, background: "#fff" } }))); }))),
    // 我关注的角色 + 公开网友目录，点进各自主页
    followListOpen && h(Sheet, { onClose: () => setFollowListOpen(false) },
      h(Eyebrow, { style: { marginBottom: 6 } }, "我关注的"),
      h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginBottom: 10, lineHeight: 1.5 } }, "角色、小号与普通网友共用这张公开关注名单；小号不会显示背后真身"),
      followedChars.length === 0 && npcFollows.length === 0 && h(Empty, { text: "还没有关注任何人", sub: "去角色或网友主页点关注" }),
      h("div", { className: "space-y-1 max-h-80 overflow-y-auto" },
        followedChars.map(c => h("button", { key: c.id, onClick: () => { setFollowListOpen(false); goProfile(c.id); }, className: "w-full flex items-center gap-3 py-2 active:opacity-70" }, h(Avatar, { character: c, size: 36, radius: 18 }), h("div", { className: "flex-1 text-left min-w-0" }, h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15, color: t.ink } }, c.name), h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog } }, "角色 · @" + ((charMetaOf ? charMetaOf(c) : {}).handle || c.name))), h(IChevR, { size: 16, color: t.fog }))),
        npcFollows.map(id => knownAltProfiles().get(id) || knownNpcProfiles().get(id)).filter(Boolean).map(n => n.key
          ? h("button", { key: n.key, onClick: () => { setFollowListOpen(false); setAltProfile({authorId:n.authorId,name:n.name,handle:n.handle}); }, className: "w-full flex items-center gap-3 py-2 active:opacity-70" }, h(AltAvatar, { seed: n.handle || n.name, size: 36 }), h("div", { className: "flex-1 text-left min-w-0" }, h("div", { className:"flex items-center gap-1.5", style: { fontFamily: F_DISPLAY, fontSize: 15, color: t.ink } },h("span",null,n.name),accountBadge({authorType:"character_alt"})), h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog } }, "小号 · @" + n.handle)), h(IChevR, { size: 16, color: t.fog }))
          : h("button", { key: n.id, onClick: () => { setFollowListOpen(false); setNpcProfile(n); }, className: "w-full flex items-center gap-3 py-2 active:opacity-70" }, h(NpcAvatar, { seed: n.handle || n.name, size: 36 }), h("div", { className: "flex-1 text-left min-w-0" }, h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15, color: t.ink } }, n.name), h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog } }, "网友 · @" + n.handle)), h(IChevR, { size: 16, color: t.fog }))))));
}

// ============================================================
// SHOP + WALLET
// ============================================================
// ============================================================
// SHOP —— 独立购物 App（首页商品流 / 购物车 / 我的订单）
// 分类横滑；点分类后按右上角刷新生成该类商品；+ 加入购物车；
// 购物车多选结算：代付 / 购买 / 送礼 / 亲属卡；我的：待发货(倒计时)→待收货(使用/转赠)
// ============================================================
// ── 购物页的配色（她 2026-08-29：「界面做好看可以参考淘宝配色」）──────
// 这一页故意不跟主题走：购物 app 本来就该有自己的视觉语言，
// 和查手机里那个网购 app 是同一套橙（SHOP_ORANGE），两处才像同一件事。
const MSHOP = {
  orange: "#ff5000",     // 主色：按钮、选中态、标签
  price: "#ff4000",      // 价钱
  soft: "#fff2ea",       // 橙色标签的底
  bg: "#f4f4f6",         // 页面底（浅灰，不是米——米色一片就没有货架感）
  card: "#ffffff",
  ink: "#20202a",
  sub: "#6b6b78",
  dim: "#9a9aa6",
  line: "#ececf0"
};
// 商品图位以前是把商品名用斜体再写一遍——一张卡里名字印两遍，
// 那 120px 高的地方等于白占（她 2026-08-29 截图）。
// 没有真图就别假装有图：改成【从名字认出品类】的色块 + 一个大字。
// 认法和随身物的材质色共用 toneFrom：顺序＝优先级，名字优先于描述。
const SHOP_TONES = [
  [/四件套|床品|被|枕|毯|床单|家纺/, "#a8c4a2"],
  [/咖啡|茶|奶|饮|酒|水/, "#c69a63"],
  [/零食|肉|果|菜|米|面|油|吃|食|饼|糖|巧克力/, "#e0a45c"],
  [/耳机|耳塞|手机|电脑|充电|数码|键盘|鼠标|相机|电子|平板|AirPods|airpods|蓝牙/, "#7d8b9e", false, "数码"],
  [/口红|面膜|护肤|精华|香水|化妆|美妆|洗面|防晒/, "#d59bb0"],
  [/衣|裤|裙|鞋|袜|外套|卫衣|衬衫|帽|包|围巾/, "#c9a3b4"],
  [/沙发|桌|椅|床|柜|灯|架|收纳|家具/, "#b08d63"],
  [/杯|碗|盘|壶|锅|勺|筷|餐具|瓷/, "#8fadb8"],
  [/书|本|笔|纸|文具/, "#c8b58e"],
  [/香薰|蜡烛|花|绿植|摆件/, "#b0a8c4"]
];
const SHOP_FALLBACK = ["#b3b0bb", "#b6ada0", "#a6b3b0", "#bdb0a8", "#aeb0bd"];
const shopTone = (it, i) => toneFrom(SHOP_TONES, SHOP_FALLBACK, it, i);
// 品类标：显示命中的那个词（「咖啡」「四件套」「数码」）。它是从商品名里真读出来的，
// 不是我另贴的标签；认不出品类就不显示，别硬安一个。
// ⚠️别拿商品名的第一个字当大字——那多半是「北」「冷」「小」「高」这种修饰词，没有信息。
// 分栏（v60.44 重做）
// 她 2026-09-02：「这几样 category 改一下，我之前是参考了别人的」。
// 原来是「推荐/外卖/服饰/美妆/数码/家具/情趣」——一份通用电商品类词典，
// 原样搬进任何一个购物 app 都成立（tabs-not-plain-pills.md 那条判据）。
// 这个 app 里的购物不是「逛商城」，是【她在逛，而他看得见、他会买单】：
// 想要没买的会攒进心愿单喂给他、他能代付、他给她开亲属卡、买回来的能拿给他看。
// 所以分栏按【她自己会怎么说】来分，最后一栏是别的购物 app 不可能有的那一栏。
// ⚠️key 一个都不许改：商品和订单上存着 cat，改了老数据就认不回来了。
const SHOP_CATS = [
  { key: "recommend", zh: "随便逛逛" },
  { key: "fashion", zh: "穿的" },
  { key: "beauty", zh: "变好看" },
  { key: "digital", zh: "电子玩意" },
  { key: "furniture", zh: "屋里添点" },
  { key: "forhim", zh: "给他买" },
  // 「情趣」她说留着（2026-09-02：「情趣留着，有点意思」）；
  // 「外卖」她说不要了——送外卖是他做的事，手机里也另有一个外卖 app，这儿不必再摆一栏。
  //  ⚠️老订单里存着 cat:"food"，在途文案照旧认它（SHOP_SHIP_WORD），只是不再有这一栏可逛。
  { key: "adult", zh: "情趣" }
];
// 在途那一栏的说法跟品类走：吃的是骑手在跑，别的是在路上（v58.01）。
// 「还有 8 分」和「还有 5 小时」是两件不一样的事，一句「还有」说不清。
const SHOP_SHIP_WORD = { food: "骑手在路上", flower: "同城派送中", furniture: "大件运输中" };
const shopShipWord = cat => SHOP_SHIP_WORD[cat] || "运输中";
function shopFmtLeft(ms) {
  if (ms <= 0) return "即将送达";
  const s = Math.ceil(ms / 1000), m = Math.floor(s / 60), hr = Math.floor(m / 60);
  if (hr > 0) return hr + "小时" + (m % 60) + "分";
  return m > 0 ? m + "分" + (s % 60) + "秒" : (s % 60) + "秒";
}
function Shop({ wallet, cart, orders, inventory, wish, characters, groups, kinshipCards, feed, busy, onBack, onGen, onAddCart, onRemoveCart, onCheckout, onReceiveUse, onReceiveGift, onAskChar, onToggleWish, toast }) {
  const t = useTheme();
  const [nav, setNav] = useState("home"); // home | cart | my
  const [cat, setCat] = useState("recommend");
  const [search, setSearch] = useState("");
  const [sel, setSel] = useState([]); // 选中的购物车 uid
  const [sheet, setSheet] = useState(null); // "actions" | "gift" | "paylater" | "kinship" | {kind:"regift",orderId}
  const [now, setNow] = useState(Date.now());
  const [detail, setDetail] = useState(null);   // 点开的那件商品（以前商品根本点不进去）
  const [askFor, setAskFor] = useState(null);   // 拿给谁看
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);
  const cards = Array.isArray(kinshipCards) ? kinshipCards : [];
  const list = (feed && feed[cat]) || [];
  const cartItems = cart || [];
  const selItems = cartItems.filter(x => sel.includes(x.uid));
  const selTotal = Math.round(selItems.reduce((s, x) => s + (Number(x.price) || 0), 0) * 100) / 100;
  const shipping = (orders || []).filter(o => o.status === "shipping");
  const receiving = (orders || []).filter(o => o.status === "receiving");
  const charById = id => (characters || []).find(c => c.id === id);
  const wishList = wish || [];
  const wishKey = n => String(n || "").replace(/\s+/g, "");
  const inWish = it => wishList.some(x => wishKey(x.name) === wishKey(it && it.name));
  const toggleSel = uid => setSel(p => p.includes(uid) ? p.filter(x => x !== uid) : [...p, uid]);
  const doGen = (append) => onGen(cat, search, append);

  // ---------- 顶栏（搜索 + 刷新）----------
  const topBar = h("div", { className: "shrink-0 px-3 pb-2.5 flex items-center gap-2", style: { paddingTop: safeTop(14), background: MSHOP.card } },
    h("button", { onClick: onBack, "aria-label": "返回", className: "active:opacity-50 shrink-0 flex items-center justify-center", style: { width: 34, height: 34, marginLeft: -6 } }, h(IArrow, { size: 19, color: MSHOP.ink })),
    // 搜索条：橙色描边＋右端一颗橙色搜索钮，这是淘宝那条最认得出来的东西
    h("div", { className: "flex-1 flex items-center h-9", style: { background: "#fff", border: "1.5px solid " + MSHOP.orange, borderRadius: 999, paddingLeft: 12, paddingRight: 3 } },
      h(ISearch, { size: 14, color: MSHOP.orange }),
      h("input", {
        value: search, onChange: e => setSearch(e.target.value),
        onKeyDown: e => { if (e.key === "Enter") doGen(false); },
        placeholder: "搜索宝贝…",
        className: "flex-1 bg-transparent outline-none",
        style: { fontFamily: F_BODY, fontSize: 13, color: MSHOP.ink, marginLeft: 7, minWidth: 0 }
      }),
      h("button", {
        onClick: () => doGen(false), disabled: busy,
        className: "shrink-0 active:opacity-70 disabled:opacity-50 flex items-center justify-center",
        style: { height: 28, padding: "0 15px", borderRadius: 999, background: MSHOP.orange, fontFamily: F_BODY, fontSize: 12.5, color: "#fff" }
      }, busy ? "找…" : "搜索")),
    h("button", { onClick: () => doGen(false), disabled: busy, "aria-label": "换一批", className: "active:opacity-50 disabled:opacity-40 shrink-0 flex items-center justify-center", style: { width: 32, height: 32 } },
      busy ? h(IPulse, { size: 19, color: MSHOP.orange }) : h(IRefresh, { size: 19, color: MSHOP.sub })));

  // ---------- 分类横滑 ----------
  const catRow = h("div", { className: "shrink-0 flex gap-6 px-4 pb-2 overflow-x-auto", style: { background: MSHOP.card, borderBottom: "1px solid " + MSHOP.line, WebkitOverflowScrolling: "touch", scrollbarWidth: "none" } },
    SHOP_CATS.map(c => h("button", {
      key: c.key, onClick: () => setCat(c.key),
      className: "shrink-0 relative active:opacity-60",
      style: { paddingBottom: 7 }
    },
      h("span", { style: { fontFamily: F_BODY, fontSize: cat === c.key ? 15.5 : 14, fontWeight: cat === c.key ? 700 : 400, color: cat === c.key ? MSHOP.ink : MSHOP.sub, whiteSpace: "nowrap" } }, c.zh),
      cat === c.key ? h("span", { style: { position: "absolute", left: "50%", bottom: 0, width: 18, height: 3, marginLeft: -9, borderRadius: 2, background: MSHOP.orange } }) : null)));

  // ---------- 首页：商品流 ----------
  const homeView = h("div", { className: "flex-1 flex flex-col min-h-0" }, topBar, catRow,
    h("div", { className: "flex-1 overflow-y-auto px-2.5 py-2.5", style: { background: MSHOP.bg } },
      list.length === 0
        ? h("div", { className: "text-center", style: { paddingTop: 80 } },
            h("div", { style: { fontFamily: F_BODY, fontSize: 13, lineHeight: 1.9, color: t.fog } }, busy ? "正在为你挑好物…" : "这个分类还没有商品。\n点右上角刷新，看看有什么。"),
            !busy && h("button", { onClick: () => doGen(false), className: "mt-4 px-5 py-2 active:opacity-70", style: { fontFamily: F_BODY, fontSize: 13, border: "1px solid " + t.ink, borderRadius: 999, color: t.ink } }, "刷新商品"))
        : h("div", null,
            h("div", { className: "grid grid-cols-2 gap-2.5" }, list.map((it, gi) => {
              const c = shopTone(it, gi);
              return h("button", { key: it.uid, onClick: () => setDetail(it), className: "text-left active:opacity-85", style: { background: MSHOP.card, borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,.06)", WebkitTapHighlightColor: "transparent" } },
                // 图位：没有真图就别假装有图。一块从名字认出来的品类色 + 右下角的品类标。
                h("div", { style: { position: "relative", height: 112, background: "linear-gradient(150deg," + c.light + " 0%," + c.base + " 58%," + c.dark + " 100%)" } },
                  h("div", { style: { position: "absolute", inset: 0, background: "repeating-linear-gradient(58deg,rgba(255,255,255,.07) 0px,rgba(255,255,255,.07) 1px,rgba(255,255,255,0) 1px,rgba(255,255,255,0) 7px)" } }),
                  c.word ? h("div", { style: { position: "absolute", right: 7, bottom: 7, padding: "2px 7px", borderRadius: 999, background: "rgba(255,255,255,.82)", fontFamily: F_BODY, fontSize: 10, color: c.ink } }, c.word) : null,
                  onToggleWish ? h("button", {
                    onClick: e => { e.stopPropagation(); onToggleWish(it); },
                    "aria-label": inWish(it) ? "不想要了" : "想要",
                    className: "active:scale-90 flex items-center justify-center",
                    style: { position: "absolute", right: 6, top: 6, width: 26, height: 26, borderRadius: 999, background: "rgba(255,255,255,.85)" }
                  }, h(IHeart, { size: 14, color: inWish(it) ? MSHOP.price : "#b9b9c2" })) : null),
                h("div", { style: { padding: "8px 9px 10px" } },
                  h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: MSHOP.ink, lineHeight: 1.42, minHeight: 36, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } }, it.name),
                  it.desc ? h("div", { className: "inline-block", style: { marginTop: 5, padding: "1.5px 6px", fontFamily: F_BODY, fontSize: 10, color: MSHOP.orange, background: MSHOP.soft, borderRadius: 3 } }, it.desc) : null,
                  h("div", { className: "flex items-end justify-between", style: { marginTop: 6 } },
                    h("div", { className: "min-w-0" },
                      h("div", { style: { lineHeight: 1 } },
                        h("span", { style: { fontFamily: F_DISPLAY, fontSize: 12, color: MSHOP.price, fontWeight: 700 } }, "¥"),
                        h("span", { style: { fontFamily: F_DISPLAY, fontSize: 21, color: MSHOP.price, fontWeight: 700, letterSpacing: "-0.02em" } }, it.price)),
                      it.sales ? h("div", { className: "truncate", style: { fontFamily: F_BODY, fontSize: 10, color: MSHOP.dim, marginTop: 3 } }, it.sales) : null),
                    h("button", {
                      onClick: e => { e.stopPropagation(); onAddCart(it); toast("已加入购物车"); },
                      "aria-label": "加入购物车",
                      className: "shrink-0 active:scale-90 flex items-center justify-center",
                      style: { width: 28, height: 28, borderRadius: 999, background: MSHOP.orange, boxShadow: "0 1px 4px rgba(255,80,0,.35)" }
                    }, h(IPlus, { size: 15, color: "#fff" })))));
            })),
            h("button", { onClick: () => doGen(true), disabled: busy, className: "w-full mt-4 mb-2 py-3 active:opacity-70 disabled:opacity-40", style: { fontFamily: F_BODY, fontSize: 12.5, letterSpacing: "0.1em", color: t.fog } }, busy ? "加载中…" : "继续看 ↓"))));

  // ---------- 购物车 ----------
  const shopHead = (zh, right) => h("div", { className: "shrink-0 px-4 pb-2.5 flex items-center", style: { paddingTop: safeTop(12), background: MSHOP.card, borderBottom: "1px solid " + MSHOP.line } },
    h("button", { onClick: onBack, "aria-label": "返回", className: "active:opacity-50 flex items-center justify-center", style: { width: 40, height: 40, marginLeft: -8 } }, h(IArrow, { size: 19, color: MSHOP.ink })),
    h("div", { className: "flex-1 min-w-0 text-center", style: { fontFamily: F_BODY, fontSize: 15.5, fontWeight: 600, color: MSHOP.ink } }, zh),
    h("div", { className: "flex items-center justify-end", style: { width: 40, height: 40 } }, right || null));
  const cartView = h("div", { className: "flex-1 flex flex-col min-h-0" },
    shopHead("购物车"),
    h("div", { className: "flex-1 overflow-y-auto px-3 py-3", style: { background: MSHOP.bg } },
      cartItems.length === 0
        ? h("div", { className: "text-center", style: { paddingTop: 80, fontFamily: F_BODY, fontSize: 13, color: MSHOP.dim } }, "购物车是空的")
        : cartItems.map((it, ci) => {
            const on = sel.includes(it.uid);
            const c = shopTone(it, ci);
            return h("div", { key: it.uid, className: "flex items-center gap-3", style: { background: MSHOP.card, borderRadius: 11, padding: "11px 12px", marginBottom: 9, boxShadow: "0 1px 3px rgba(0,0,0,.05)" } },
              h("button", { onClick: () => toggleSel(it.uid), "aria-label": "选中", className: "shrink-0 active:opacity-60", style: { width: 21, height: 21, borderRadius: 999, border: "1.5px solid " + (on ? MSHOP.orange : "#d6d6de"), background: on ? MSHOP.orange : "transparent", display: "flex", alignItems: "center", justifyContent: "center" } }, on ? h(ICheck, { size: 12, color: "#fff" }) : null),
              // 缩略图位：和商品流那边同一套品类色，一眼认得出是同一件东西
              h("div", { className: "shrink-0 relative", style: { width: 54, height: 54, borderRadius: 9, background: "linear-gradient(150deg," + c.light + "," + c.base + " 60%," + c.dark + ")" } },
                c.word ? h("span", { style: { position: "absolute", left: 0, right: 0, bottom: 4, textAlign: "center", fontFamily: F_BODY, fontSize: 9, color: "rgba(255,255,255,.92)" } }, c.word) : null),
              h("div", { className: "flex-1 min-w-0" },
                h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: MSHOP.ink, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } }, it.name),
                h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16, fontWeight: 700, color: MSHOP.price, marginTop: 4 } }, "¥" + it.price)),
              h("button", { onClick: () => { onRemoveCart(it.uid); setSel(p => p.filter(x => x !== it.uid)); }, "aria-label": "删除", className: "shrink-0 active:opacity-50 p-1" }, h(ITrash, { size: 16, color: MSHOP.dim })));
          })),
    cartItems.length > 0 && h("div", { className: "shrink-0 px-4 py-2.5 flex items-center gap-3", style: { background: MSHOP.card, borderTop: "1px solid " + MSHOP.line } },
      h("button", { onClick: () => setSel(sel.length === cartItems.length ? [] : cartItems.map(x => x.uid)), className: "active:opacity-60 flex items-center gap-2" },
        h("span", { style: { width: 20, height: 20, borderRadius: 999, border: "1.5px solid " + (sel.length === cartItems.length && cartItems.length ? MSHOP.orange : "#d6d6de"), background: sel.length === cartItems.length && cartItems.length ? MSHOP.orange : "transparent", display: "flex", alignItems: "center", justifyContent: "center" } }, sel.length === cartItems.length && cartItems.length ? h(ICheck, { size: 12, color: "#fff" }) : null),
        h("span", { style: { fontFamily: F_BODY, fontSize: 12.5, color: MSHOP.sub } }, "全选")),
      h("div", { className: "flex-1 text-right" },
        h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: MSHOP.sub } }, "合计 "),
        h("span", { style: { fontFamily: F_DISPLAY, fontSize: 12, fontWeight: 700, color: MSHOP.price } }, "¥"),
        h("span", { style: { fontFamily: F_DISPLAY, fontSize: 21, fontWeight: 700, color: MSHOP.price } }, selTotal)),
      h("button", { onClick: () => { if (!selItems.length) { toast("请先选择商品"); return; } setSheet("actions"); }, className: "px-6 py-2.5 active:opacity-80", style: { fontFamily: F_BODY, fontSize: 14, fontWeight: 600, background: selItems.length ? MSHOP.orange : "#d8d8e0", color: "#fff", borderRadius: 999, boxShadow: selItems.length ? "0 2px 8px rgba(255,80,0,.32)" : "none" } }, "结算 " + (selItems.length || ""))));

  // ---------- 我的（订单）----------
  const myView = h("div", { className: "flex-1 flex flex-col min-h-0" },
    shopHead("我的"),
    h("div", { className: "flex-1 overflow-y-auto px-3 py-3", style: { background: MSHOP.bg } },
      // 待发货
      h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: MSHOP.sub, marginBottom: 8, paddingLeft: 2 } }, "待发货 · " + shipping.length),
      shipping.length === 0
        ? h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: MSHOP.dim, marginBottom: 18 } }, "暂无待发货")
        : h("div", { className: "space-y-2", style: { marginBottom: 18 } }, shipping.map(o => {
            const left = o.arriveTs - now;
            return h("div", { key: o.id, className: "p-3.5", style: { background: MSHOP.card, borderRadius: 11, boxShadow: "0 1px 3px rgba(0,0,0,.05)" } },
              h("div", { className: "flex items-center justify-between" },
                h("div", { className: "min-w-0 flex-1" },
                  h("div", { className: "truncate", style: { fontFamily: F_BODY, fontSize: 13.5, color: MSHOP.ink, lineHeight: 1.4 } }, o.name),
                  h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: MSHOP.dim, marginTop: 3 } }, (o.price ? "¥" + o.price : "") + (o.price && o.payLabel ? " · " : "") + (o.payLabel || (o.price ? "" : "礼物")))),
                h("div", { className: "text-right shrink-0 ml-3" },
                  h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: MSHOP.dim } }, shopShipWord(o.cat)),
                  h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, fontWeight: 600, color: MSHOP.orange } }, shopFmtLeft(left)))));
          })),
      // 待收货
      h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: MSHOP.sub, marginBottom: 8, paddingLeft: 2 } }, "待收货 · " + receiving.length),
      receiving.length === 0
        ? h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: MSHOP.dim, marginBottom: 18 } }, "暂无待收货")
        : h("div", { className: "space-y-2", style: { marginBottom: 18 } }, receiving.map(o => h("div", { key: o.id, className: "p-3.5", style: { background: MSHOP.card, borderRadius: 11, boxShadow: "0 1px 3px rgba(0,0,0,.05)" } },
            h("div", { className: "flex items-center justify-between mb-2.5" },
              h("div", { className: "min-w-0 flex-1" },
                h("div", { className: "truncate", style: { fontFamily: F_BODY, fontSize: 13.5, color: MSHOP.ink, lineHeight: 1.4 } }, o.name),
                h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: "#3f8a54", marginTop: 2 } }, "已送达" + (o.fromCharId ? " · " + (charById(o.fromCharId) ? charById(o.fromCharId).name : "") + " 送的" : ""))),
              o.price ? h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16, fontWeight: 700, color: MSHOP.price } }, "¥" + o.price) : null),
            h("div", { className: "flex gap-2" },
              h("button", { onClick: () => onReceiveUse(o.id), className: "flex-1 py-2 active:opacity-70", style: { fontFamily: F_BODY, fontSize: 12.5, fontWeight: 600, background: MSHOP.orange, color: "#fff", borderRadius: 999, boxShadow: "0 2px 7px rgba(255,80,0,.3)" } }, "收下"),
              h("button", { onClick: () => { if (!(characters || []).length) { toast("还没有角色可转赠"); return; } setSheet({ kind: "regift", orderId: o.id }); }, className: "flex-1 py-2 active:opacity-70", style: { fontFamily: F_BODY, fontSize: 12.5, border: "1px solid " + MSHOP.orange, color: MSHOP.orange, borderRadius: 999 } }, "转赠"))))),
      // 想要清单：看上了但没买的。它真正的用处在【他知道你想要什么】——
      // 单子会进他的上下文，他记不记得、送不送，是他自己的事。
      wishList.length ? h("div", null,
        h("div", { className: "flex items-center", style: { gap: 6, marginBottom: 8, paddingLeft: 2 } },
          h(IHeart, { size: 12, color: MSHOP.price }),
          h("span", { style: { fontFamily: F_BODY, fontSize: 11.5, color: MSHOP.sub } }, "想要的 · " + wishList.length),
          h("span", { className: "flex-1" }),
          h("span", { style: { fontFamily: F_BODY, fontSize: 10, color: MSHOP.dim } }, "他们看得到")),
        h("div", { style: { marginBottom: 18 } }, wishList.map((w, wi) => {
          const c = shopTone(w, wi);
          return h("div", { key: w.uid || wi, className: "flex items-center gap-3", style: { background: MSHOP.card, borderRadius: 11, padding: "9px 11px", marginBottom: 8, boxShadow: "0 1px 3px rgba(0,0,0,.05)" } },
            h("div", { className: "shrink-0", style: { width: 38, height: 38, borderRadius: 8, background: "linear-gradient(150deg," + c.light + "," + c.base + " 60%," + c.dark + ")" } }),
            h("div", { className: "flex-1 min-w-0" },
              h("div", { className: "truncate", style: { fontFamily: F_BODY, fontSize: 12.5, color: MSHOP.ink } }, w.name),
              Number(w.price) ? h("div", { style: { fontFamily: F_DISPLAY, fontSize: 13.5, fontWeight: 700, color: MSHOP.price, marginTop: 2 } }, "¥" + w.price) : null),
            onToggleWish ? h("button", { onClick: () => onToggleWish(w), "aria-label": "不想要了", className: "shrink-0 active:opacity-60 p-1" }, h(IHeart, { size: 15, color: MSHOP.price })) : null);
        }))) : null,
      // 我的物品：按【怎么来的】归组——自己买的一堆，谁送的各一堆。
      // 原先是一条条纯文字，东西一多就分不清哪件是谁给的（她 2026-08-29）。
      h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: MSHOP.sub, marginBottom: 8, paddingLeft: 2 } }, "我的物品 · " + (inventory || []).length),
      (inventory || []).length === 0
        ? h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: MSHOP.dim, paddingBottom: 20 } }, "还没有已入库的物品")
        : h("div", { style: { paddingBottom: 24 } }, (() => {
            const groups = [];
            const byKey = {};
            (inventory || []).forEach(it => {
              const k = it.fromCharId || "__me";
              if (!byKey[k]) { byKey[k] = { key: k, giver: it.fromCharId ? charById(it.fromCharId) : null, items: [] }; groups.push(byKey[k]); }
              byKey[k].items.push(it);
            });
            // 自己买的排最后：别人送的才是要一眼看见的
            groups.sort((a, b) => (a.key === "__me" ? 1 : 0) - (b.key === "__me" ? 1 : 0));
            return groups.map(g => h("div", { key: g.key, style: { marginBottom: 14 } },
              h("div", { className: "flex items-center", style: { gap: 6, marginBottom: 7, paddingLeft: 2 } },
                g.giver ? h(Avatar, { character: g.giver, size: 20, radius: 999 }) : null,
                h("span", { style: { fontFamily: F_BODY, fontSize: 11.5, color: g.giver ? MSHOP.ink : MSHOP.sub } },
                  g.giver ? (g.giver.remark || g.giver.name) + " 送的" : "自己买的"),
                h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: MSHOP.dim } }, "· " + g.items.length)),
              h("div", { className: "grid grid-cols-3", style: { gap: 8 } }, g.items.map((it, i) => {
                const c = shopTone(it, i);
                return h("div", { key: it.id || i, style: { background: MSHOP.card, borderRadius: 10, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,.05)" } },
                  h("div", { style: { position: "relative", height: 56, background: "linear-gradient(150deg," + c.light + "," + c.base + " 60%," + c.dark + ")" } },
                    c.word ? h("span", { style: { position: "absolute", right: 5, bottom: 4, fontFamily: F_BODY, fontSize: 8.5, color: "rgba(255,255,255,.9)" } }, c.word) : null,
                    it.qty > 1 ? h("span", { style: { position: "absolute", left: 5, top: 5, padding: "0 5px", borderRadius: 999, background: "rgba(0,0,0,.32)", fontFamily: F_BODY, fontSize: 9.5, lineHeight: "15px", color: "#fff" } }, "×" + it.qty) : null),
                  h("div", { style: { padding: "6px 7px 8px" } },
                    h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: MSHOP.ink, lineHeight: 1.35, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", minHeight: 30 } }, it.name),
                    it.addedTs ? h("div", { style: { fontFamily: F_BODY, fontSize: 9, color: MSHOP.dim, marginTop: 3 } },
                      new Date(it.addedTs).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })) : null));
              }))));
            })())));

  // ---------- 商品详情（以前商品根本点不进去，只能点那颗加购钮）----------
  const detailEl = detail ? (() => {
    const c = shopTone(detail, 0);
    const chars = characters || [];
    return h("div", {
      className: "absolute inset-0 flex items-end z-50",
      style: { background: "rgba(20,19,25,0.42)" },
      onClick: () => { setDetail(null); setAskFor(null); }
    },
      h("div", {
        onClick: e => e.stopPropagation(),
        className: "w-full",
        style: { background: MSHOP.card, borderRadius: "18px 18px 0 0", maxHeight: "84vh", overflowY: "auto", animation: "fadeUp .26s ease both", paddingBottom: COMPOSER_PAD_BOTTOM }
      },
        h("div", { style: { position: "relative", height: 180, background: "linear-gradient(150deg," + c.light + " 0%," + c.base + " 58%," + c.dark + " 100%)", borderRadius: "18px 18px 0 0" } },
          h("div", { style: { position: "absolute", inset: 0, borderRadius: "18px 18px 0 0", background: "repeating-linear-gradient(58deg,rgba(255,255,255,.07) 0px,rgba(255,255,255,.07) 1px,rgba(255,255,255,0) 1px,rgba(255,255,255,0) 7px)" } }),
          c.word ? h("div", { style: { position: "absolute", right: 12, bottom: 12, padding: "3px 10px", borderRadius: 999, background: "rgba(255,255,255,.85)", fontFamily: F_BODY, fontSize: 11, color: c.ink } }, c.word) : null,
          h("button", { onClick: () => setDetail(null), "aria-label": "关闭", className: "active:opacity-70", style: { position: "absolute", left: 12, top: 12, width: 30, height: 30, borderRadius: 999, background: "rgba(255,255,255,.85)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F_BODY, fontSize: 15, color: MSHOP.ink } }, "✕")),
        h("div", { style: { padding: "14px 16px 16px" } },
          h("div", { style: { lineHeight: 1 } },
            h("span", { style: { fontFamily: F_DISPLAY, fontSize: 15, fontWeight: 700, color: MSHOP.price } }, "¥"),
            h("span", { style: { fontFamily: F_DISPLAY, fontSize: 30, fontWeight: 700, color: MSHOP.price, letterSpacing: "-0.02em" } }, detail.price),
            detail.sales ? h("span", { style: { fontFamily: F_BODY, fontSize: 11.5, color: MSHOP.dim, marginLeft: 10 } }, detail.sales) : null),
          h("div", { style: { fontFamily: F_BODY, fontSize: 15, color: MSHOP.ink, lineHeight: 1.5, marginTop: 9 } }, detail.name),
          detail.desc ? h("div", { className: "inline-block", style: { marginTop: 8, padding: "3px 9px", fontFamily: F_BODY, fontSize: 11.5, color: MSHOP.orange, background: MSHOP.soft, borderRadius: 4 } }, detail.desc) : null,
          h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: MSHOP.dim, marginTop: 12, lineHeight: 1.7 } },
            "钱包里还有 ¥" + (Math.round((Number(wallet) || 0) * 100) / 100)
              + ((Number(wallet) || 0) < (Number(detail.price) || 0) ? "——这件买不起，可以让他代付或用亲属卡。" : "")),
          // 拿给谁看：买之前问问他。和随身物「摆到他面前」是同一个动作语言，
          // 但语境相反——那边是他被撞破，这边是我主动拿给你看。
          (onAskChar && chars.length) ? h("div", { style: { marginTop: 14, paddingTop: 13, borderTop: "1px solid " + MSHOP.line } },
            askFor === null
              ? h("button", {
                  onClick: () => setAskFor(chars.length === 1 ? chars[0].id : ""),
                  className: "w-full py-2.5 active:opacity-75",
                  style: { fontFamily: F_BODY, fontSize: 13, borderRadius: 999, border: "1px solid " + MSHOP.orange, color: MSHOP.orange }
                }, "拿给他看看 · 问问值不值得买")
              : h("div", null,
                  h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: MSHOP.sub, marginBottom: 9 } }, "拿给谁看"),
                  h("div", { className: "flex flex-wrap", style: { gap: 8 } }, chars.map(ch => h("button", {
                    key: ch.id,
                    onClick: () => { onAskChar(ch.id, detail); setAskFor(null); setDetail(null); },
                    className: "flex items-center active:opacity-70",
                    style: { gap: 6, padding: "5px 11px 5px 5px", borderRadius: 999, background: MSHOP.bg }
                  }, h(Avatar, { character: ch, size: 24, radius: 999 }),
                     h("span", { style: { fontFamily: F_BODY, fontSize: 12.5, color: MSHOP.ink } }, ch.remark || ch.name)))))) : null,
          h("div", { className: "flex items-center", style: { gap: 9, marginTop: 16 } },
            onToggleWish ? h("button", {
              onClick: () => onToggleWish(detail),
              className: "shrink-0 flex flex-col items-center justify-center active:opacity-70",
              style: { width: 50, height: 46 }
            },
              h(IHeart, { size: 19, color: inWish(detail) ? MSHOP.price : "#b0b0ba" }),
              h("span", { style: { fontFamily: F_BODY, fontSize: 9.5, color: inWish(detail) ? MSHOP.price : MSHOP.dim, marginTop: 2 } }, inWish(detail) ? "已想要" : "想要")) : null,
            h("button", {
              onClick: () => { onAddCart(detail); toast("已加入购物车"); setDetail(null); },
              className: "flex-1 py-3 active:opacity-80",
              style: { fontFamily: F_BODY, fontSize: 14.5, fontWeight: 600, borderRadius: 999, background: "linear-gradient(90deg,#ff9500,#ff7000)", color: "#fff" }
            }, "加入购物车"),
            h("button", {
              onClick: () => { onAddCart(detail); setDetail(null); setNav("cart"); },
              className: "flex-1 py-3 active:opacity-80",
              style: { fontFamily: F_BODY, fontSize: 14.5, fontWeight: 600, borderRadius: 999, background: "linear-gradient(90deg,#ff5000,#ff2d00)", color: "#fff", boxShadow: "0 3px 10px rgba(255,60,0,.32)" }
            }, "去结算")))));
  })() : null;

  // ---------- 底部 tab ----------
  const bottomNav = h("div", { className: "shrink-0 flex", style: { borderTop: "1px solid " + MSHOP.line, background: MSHOP.card, paddingBottom: COMPOSER_PAD_BOTTOM } },
    [["home", "首页", GShop], ["cart", "购物车", GBag], ["my", "我的", GUser]].map(([k, zh, G]) => h("button", {
      key: k, onClick: () => setNav(k), className: "flex-1 py-2 flex flex-col items-center gap-0.5 active:opacity-60 relative"
    },
      h(G, { size: 21, color: nav === k ? MSHOP.orange : MSHOP.dim }),
      h("span", { style: { fontFamily: F_BODY, fontSize: 10, color: nav === k ? MSHOP.orange : MSHOP.dim, fontWeight: nav === k ? 600 : 400 } }, zh),
      k === "cart" && cartItems.length > 0 && h("span", { style: { position: "absolute", top: 2, right: "50%", marginRight: -18, background: MSHOP.price, color: "#fff", fontFamily: F_BODY, fontSize: 9, borderRadius: 999, padding: "0 5px", lineHeight: "15px" } }, String(cartItems.length)),
      // 东西到了她得知道。送达只翻卡片状态、不弹提示（4 秒一轮，弹起来会打断她在做的事），
      // 所以在底栏点一个红点——标准做法，不打扰。
      k === "my" && receiving.length > 0 && h("span", { style: { position: "absolute", top: 4, right: "50%", marginRight: -14, width: 8, height: 8, borderRadius: 999, background: MSHOP.price, boxShadow: "0 0 0 1.5px " + MSHOP.card } }))));

  // ---------- 结算动作 / 对象选择 Sheet ----------
  const chip = (label, onClick, primary) => h("button", { onClick, className: "w-full py-3 active:opacity-75", style: { fontFamily: F_DISPLAY, fontSize: 16, borderRadius: 12, marginBottom: 10, background: primary ? t.ink : t.bg2, color: primary ? t.bg2 : t.ink, border: primary ? "none" : "1px solid " + t.line } }, label);
  let sheetEl = null;
  if (sheet === "actions") {
    sheetEl = h(Sheet, { onClose: () => setSheet(null) },
      h(Eyebrow, { style: { marginBottom: 12 } }, "结算 " + selItems.length + " 件 · 合计 ¥" + selTotal),
      chip("购买（用我的余额 ¥" + wallet + "）", () => { setSheet(null); onCheckout(sel, "buy"); setSel([]); }, true),
      chip("送礼（付款后送给角色）", () => setSheet("gift")),
      chip("代付（请角色/群帮我付）", () => setSheet("paylater")),
      cards.length > 0 && chip("用亲属卡付（刷角色的钱）", () => setSheet("kinship")));
  } else if (sheet === "gift") {
    sheetEl = h(Sheet, { onClose: () => setSheet(null) },
      h(Eyebrow, { style: { marginBottom: 12 } }, "送给谁"),
      h("div", { className: "space-y-1 max-h-80 overflow-y-auto" }, (characters || []).map(c => h("button", { key: c.id, onClick: () => { setSheet(null); onCheckout(sel, "gift", { type: "char", id: c.id }); setSel([]); }, className: "w-full flex items-center gap-3 py-2.5 active:opacity-60" },
        h(Avatar, { character: c, size: 38, radius: 9 }),
        h("span", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: t.ink } }, c.remark || c.name)))));
  } else if (sheet === "paylater") {
    sheetEl = h(Sheet, { onClose: () => setSheet(null) },
      h(Eyebrow, { style: { marginBottom: 12 } }, "请谁帮我付"),
      h("div", { className: "space-y-1 max-h-80 overflow-y-auto" },
        (characters || []).map(c => h("button", { key: c.id, onClick: () => { setSheet(null); onCheckout(sel, "paylater", { type: "char", id: c.id }); setSel([]); }, className: "w-full flex items-center gap-3 py-2.5 active:opacity-60" },
          h(Avatar, { character: c, size: 38, radius: 9 }),
          h("span", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: t.ink } }, c.remark || c.name))),
        (groups || []).map(g => h("button", { key: g.id, onClick: () => { setSheet(null); onCheckout(sel, "paylater", { type: "group", id: g.id }); setSel([]); }, className: "w-full flex items-center gap-3 py-2.5 active:opacity-60" },
          h("div", { className: "flex items-center justify-center", style: { width: 38, height: 38, borderRadius: 9, background: t.bg2 } }, h("span", { style: { fontFamily: F_BODY, fontSize: 10, color: t.fog } }, "群")),
          h("span", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: t.ink } }, g.name, h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog } }, " · 群聊"))))));
  } else if (sheet === "kinship") {
    sheetEl = h(Sheet, { onClose: () => setSheet(null) },
      h(Eyebrow, { style: { marginBottom: 12 } }, "用谁的亲属卡"),
      h("div", { className: "space-y-1 max-h-80 overflow-y-auto" }, cards.map(cd => {
        const c = charById(cd.charId) || {}; const remaining = (cd.limit || 0) - (cd.used || 0);
        return h("button", { key: cd.charId, onClick: () => { setSheet(null); onCheckout(sel, "kinship", { type: "char", id: cd.charId }); setSel([]); }, className: "w-full flex items-center gap-3 py-2.5 active:opacity-60" },
          h(Avatar, { character: c, size: 38, radius: 9 }),
          h("div", { className: "flex-1 text-left" },
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: t.ink } }, c.name || "亲属卡"),
            h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: remaining >= selTotal ? t.fog : t.accent } }, "剩余额度 ¥" + remaining)));
      })));
  } else if (sheet && sheet.kind === "regift") {
    sheetEl = h(Sheet, { onClose: () => setSheet(null) },
      h(Eyebrow, { style: { marginBottom: 12 } }, "转赠给谁"),
      h("div", { className: "space-y-1 max-h-80 overflow-y-auto" }, (characters || []).map(c => h("button", { key: c.id, onClick: () => { const oid = sheet.orderId; setSheet(null); onReceiveGift(oid, c.id); }, className: "w-full flex items-center gap-3 py-2.5 active:opacity-60" },
        h(Avatar, { character: c, size: 38, radius: 9 }),
        h("span", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: t.ink } }, c.remark || c.name)))));
  }

  return h("div", { className: "h-full flex flex-col" },
    nav === "home" ? homeView : nav === "cart" ? cartView : myView,
    detailEl,
    bottomNav,
    sheetEl);
}

// ---- 亲属卡账单（每卡流水 + 申请加额度）----
// v60.45 撤掉了每笔下面那条「角色评论」：它靠刷卡时现调一次模型来填，
// 而买东西不该调用（她 2026-09-02）。他要说什么，在聊天里说。
function KinshipBill({ card, character, onBack, onRaise }) {
  const t = useTheme();
  const [asking, setAsking] = useState(false);
  const [amt, setAmt] = useState("");
  if (!card) return h("div", { className: "h-full flex flex-col" }, h(Head, { zh: "亲属卡", en: "Kinship", onBack }), h("div", { className: "flex-1 flex items-center justify-center", style: { fontFamily: F_BODY, fontSize: 13, color: t.fog } }, "卡片不存在"));
  const c = character || {};
  const ledger = card.ledger || [];
  return h("div", { className: "h-full flex flex-col", style: { background: t.bg } },
    h("div", { className: "shrink-0 px-4 pb-3 flex items-center gap-3", style: { paddingTop: safeTop(20), background: t.bg2, borderBottom: "1px solid " + t.line } },
      h("button", { onClick: onBack, className: "active:opacity-50" }, h(IArrow, { size: 19, color: t.ink })),
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: 17, color: t.ink } }, (c.name || "") + " 的亲属卡")),
    h("div", { className: "flex-1 overflow-y-auto" },
      // 卡面
      h("div", { className: "m-5" },
        h(KinshipCardFace, { character: c, limit: card.limit || 0, used: card.used || 0, note: card.note || "" })),
      // 申请加额度
      h("div", { className: "px-5 mb-3" },
        !asking
          ? h("button", { onClick: () => setAsking(true), className: "w-full py-2.5 active:opacity-70", style: { fontFamily: F_BODY, fontSize: 13, border: "1px solid " + t.ink, borderRadius: 999, color: t.ink } }, "申请加额度")
          : h("div", { className: "p-4", style: { background: t.bg2, borderRadius: 12, border: "1px solid " + t.line } },
              h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.sub, marginBottom: 8 } }, "想让 " + (c.name || "TA") + " 加多少额度（可留空让 TA 看着给）"),
              h("div", { className: "flex items-center gap-2" },
                h("input", { value: amt, onChange: e => setAmt(e.target.value), type: "number", inputMode: "decimal", placeholder: "金额", autoFocus: true, className: "flex-1 outline-none px-3 py-2 rounded-lg", style: { fontFamily: F_BODY, fontSize: 15, color: t.ink, background: "#fff", border: "1px solid " + t.line } }),
                h("button", { onClick: () => { onRaise(amt); setAsking(false); setAmt(""); }, className: "px-4 py-2 active:opacity-70", style: { fontFamily: F_BODY, fontSize: 13, background: t.ink, color: t.bg2, borderRadius: 8 } }, "申请"),
                h("button", { onClick: () => { setAsking(false); setAmt(""); }, className: "px-3 py-2 active:opacity-60", style: { fontFamily: F_BODY, fontSize: 13, color: t.fog } }, "取消")))),
      // 账单
      h("div", { className: "px-5 pb-10" },
        h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, letterSpacing: "0.14em", color: t.fog, marginBottom: 10 } }, "刷卡账单 · STATEMENT"),
        ledger.length === 0
          ? h("div", { className: "text-center mt-6", style: { fontFamily: F_BODY, fontSize: 12.5, color: t.fog } }, "还没有刷过这张卡。\n去购物 App 结算时选「用亲属卡付」。")
          : ledger.map(l => h("div", { key: l.id, className: "py-3.5", style: { borderBottom: "1px solid " + t.line } },
              h("div", { className: "flex items-center justify-between" },
                h("div", { className: "min-w-0 flex-1" },
                  h("div", { className: "truncate", style: { fontFamily: F_DISPLAY, fontSize: 14.5, color: t.ink } }, l.item),
                  h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 2 } }, fmtStamp(l.ts))),
                h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: t.ink } }, "-¥" + l.amount)))))));
}

// ============================================================
// US (couple)
// ============================================================
// 情侣空间·问答小本预置题库（60 条，五类+深题+日常温度）。
// id 是稳定主键：已答记录靠它对齐；以后只往后加题、不改/不复用旧 id。
const COUPLE_QA_BANK = [
  { id: "q01", cat: "回忆", q: "你还记得第一次见到我时，脑子里冒出的第一个念头吗？" },
  { id: "q02", cat: "回忆", q: "我们相处到现在，哪个瞬间你偷偷记了很久？" },
  { id: "q03", cat: "回忆", q: "有没有哪次我以为很普通的对话，其实被你放在心上？" },
  { id: "q04", cat: "回忆", q: "第一次觉得「就是这个人了」是什么时候？" },
  { id: "q05", cat: "回忆", q: "我做过最让你意外的一件事是什么？" },
  { id: "q06", cat: "回忆", q: "你印象里我笑得最好看的一次是在做什么？" },
  { id: "q07", cat: "回忆", q: "有没有哪句我随口说的话，你到现在还记得？" },
  { id: "q08", cat: "回忆", q: "我们之间第一次有点心动的时刻，你觉得是哪次？" },
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
  { id: "q27", cat: "私密", q: "睡前最后一个念头，最近常常是什么？" },
  { id: "q28", cat: "私密", q: "有没有什么话，想对我说却一直没说出口？" },
  { id: "q29", cat: "私密", q: "你最近一次因为我偷偷高兴，是为了什么？" },
  { id: "q30", cat: "私密", q: "有没有哪个瞬间，你突然很想抱住我？" },
  { id: "q31", cat: "私密", q: "你会在什么时候特别想我？" },
  { id: "q32", cat: "私密", q: "有什么是你从没告诉过别人、却想让我知道的？" },
  { id: "q33", cat: "私密", q: "你觉得自己在我面前，最放松的是什么时候？" },
  { id: "q34", cat: "私密", q: "我不在的时候，你会做什么和我有关的小事吗？" },
  { id: "q35", cat: "私密", q: "你有没有偷偷幻想过我们以后的某个画面？是什么样的？" },
  { id: "q36", cat: "轻松", q: "我做的哪件蠢事让你笑到现在？" },
  { id: "q37", cat: "轻松", q: "如果用一种食物形容我，你觉得我是什么？" },
  { id: "q38", cat: "轻松", q: "我有没有什么口头禅是你已经被传染了的？" },
  { id: "q39", cat: "轻松", q: "你觉得我睡着的样子怎么样，能打几分？" },
  { id: "q40", cat: "轻松", q: "如果给我起个只有你能叫的外号，你想叫我什么？" },
  { id: "q41", cat: "轻松", q: "我最近让你无语的一个瞬间是什么？" },
  { id: "q42", cat: "轻松", q: "你觉得我们俩谁做饭更能吃、谁更能睡？" },
  { id: "q43", cat: "轻松", q: "如果我们组队打游戏，你觉得谁会先坑对方？" },
  { id: "q44", cat: "轻松", q: "我有没有哪个表情或动作，你觉得特别好笑又特别可爱？" },
  { id: "q45", cat: "轻松", q: "假如我突然变成一只动物，你猜会是什么？" },
  { id: "q46", cat: "走心", q: "你害怕失去我吗？这种感觉是什么时候开始的？" },
  { id: "q47", cat: "走心", q: "在我面前，你有没有过想逞强、其实很累的时候？" },
  { id: "q48", cat: "走心", q: "你觉得我给你带来的最大的变化是什么？" },
  { id: "q49", cat: "走心", q: "有没有哪个瞬间，你觉得「有这个人真好」？" },
  { id: "q50", cat: "走心", q: "你愿意让我看到你最不堪、最脆弱的那一面吗？" },
  { id: "q51", cat: "走心", q: "我们之间，你最想守护住的是什么？" },
  { id: "q52", cat: "走心", q: "如果有一天我们必须分开一阵子，你会怎么熬过去？" },
  { id: "q53", cat: "走心", q: "你觉得我们之间，还有什么是彼此没说透的？" },
  { id: "q54", cat: "走心", q: "什么样的时刻，会让你特别确定「我们是认真的」？" },
  { id: "q55", cat: "走心", q: "你有没有想过，我们最后会变成什么样子？" },
  { id: "q56", cat: "日常", q: "今天有没有哪个瞬间突然想到我？" },
  { id: "q57", cat: "日常", q: "最近有什么开心的小事想第一个告诉我？" },
  { id: "q58", cat: "日常", q: "这一周你最累的是什么？有没有想让我抱抱？" },
  { id: "q59", cat: "日常", q: "如果现在我在你身边，你最想做的第一件事是什么？" },
  { id: "q60", cat: "日常", q: "今天的你，想被我用哪种方式宠一下？" }
];

// 字符串稳定哈希（自定义题给个稳定 id，用于已答判重）
const qhash = s => { let x = 0; for (let i = 0; i < s.length; i++) { x = (x * 31 + s.charCodeAt(i)) | 0; } return (x >>> 0).toString(36); };
// 情侣空间·问答小本：翻页书 —— 封面(可改标题)/翻页看过往(编辑·reroll·删除)/翻新题作答
function CoupleQABook({ partner, bank, customQ, entries, title, onAnswer, onSeal, onReveal, onEdit, onRemove, onReroll, onSaveTitle, gen, onBack }) {
  const t = useTheme();
  const mine = (entries || []).filter(e => e.characterId === partner.id).slice().sort((a, b) => a.answeredAt - b.answeredAt);
  const answered = new Set(mine.map(e => e.qid));
  const fullBank = bank.concat((customQ || []).map(q => ({ id: "cx_" + qhash(q), cat: "自定义", q: q })));
  const pool = fullBank.filter(b => !answered.has(b.id));
  // 「已答 X / Y」的分母：自定义题在设置里删掉后，已答的那条还在（该在），
  // 光用 fullBank.length 会出现 X > Y。答过但已不在题库里的也算进总数。
  const bankTotal = fullBank.length + mine.filter(e => !fullBank.some(b => b.id === e.qid)).length;
  const bookTitle = title || "关于我们";
  const [mode, setMode] = useState("cover"); // cover / pages / draw
  const [pageIdx, setPageIdx] = useState(0);
  const [cur, setCur] = useState(null);
  const [ans, setAns] = useState("");
  const [editId, setEditId] = useState(null);
  const [editText, setEditText] = useState("");
  const [titleEditing, setTitleEditing] = useState(false);
  const [titleVal, setTitleVal] = useState(bookTitle);
  // 他出的题（v62.10）她在这儿写她那半；翻到别页就清空，别把 A 题的草稿带进 B 题
  const [revealVal, setRevealVal] = useState("");
  useEffect(() => { setRevealVal(""); }, [pageIdx]);
  const swipeRef = useRef({ x: 0, y: 0 });
  const draw = () => { if (pool.length) { setCur(pool[Math.floor(Math.random() * pool.length)]); setAns(""); } else setCur(null); };
  // 交卷＝把自己那份【封起来】，一次调用都不花；他那份等你按「让 TA 也写一份」才生成，
  // 而且那一枪看不到你写的（见 app.js 的 answerCoupleQA 注释）。
  const submit = () => {
    if (!cur || !ans.trim() || gen) return;
    const ok = onSeal(partner, { qid: cur.id, question: cur.q, myAnswer: ans.trim(), source: "题库" });
    if (ok) { setCur(null); setAns(""); setPageIdx(9999); setMode("pages"); }
  };

  // —— 翻一张新题作答 ——
  if (mode === "draw") {
    return h("div", { className: "h-full flex flex-col" },
      h(Head, { zh: "翻一张题", en: partner.name, onBack: () => { setCur(null); setAns(""); setMode("cover"); } }),
      h("div", { className: "flex-1 overflow-y-auto px-6 pb-8" },
        h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginTop: 4, marginBottom: 14 } }, "已答 " + mine.length + " / " + bankTotal + " 题。"),
        cur ? h("div", { style: { background: "#fdfaf1", border: "1px solid #e6dcc4", borderRadius: 4, padding: "14px 16px", animation: "fadeUp .3s ease both", backgroundImage: "repeating-linear-gradient(transparent 0 27px, rgba(190,170,120,.16) 27px 28px)", boxShadow: "0 8px 20px rgba(90,70,40,.10)" } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 10, letterSpacing: ".18em", color: "#a3987e", marginBottom: 8 } }, cur.cat),
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16, lineHeight: 1.5, color: "#3a3226", marginBottom: 12 } }, cur.q),
          h("textarea", { value: ans, onChange: e => setAns(e.target.value), placeholder: "写下你的答案…", rows: 3, style: { width: "100%", outline: "none", resize: "none", padding: "10px 12px", borderRadius: 6, fontFamily: F_BODY, fontSize: 13.5, lineHeight: 1.6, background: "#fffdf6", color: "#3a3226", border: "1px solid #e6dcc4" } }),
          h("div", { className: "flex items-center gap-2 mt-3" },
            h("button", { onClick: draw, disabled: gen, className: "active:opacity-60 disabled:opacity-40", style: { fontFamily: F_BODY, fontSize: 13, color: t.fog } }, "换一题"),
            h("button", { onClick: submit, disabled: !ans.trim() || gen, className: "ml-auto active:opacity-70 disabled:opacity-40", style: { background: "#3a3226", color: "#fdfaf1", fontFamily: F_DISPLAY, fontSize: 14, padding: "8px 18px", borderRadius: 10 } }, gen ? partner.name + " 作答中…" : "写好了 · 封起来"))) : h("button", { onClick: draw, disabled: !pool.length, className: "w-full active:opacity-70 disabled:opacity-40", style: { background: t.ink, color: t.bg2, fontFamily: F_DISPLAY, fontSize: 15, padding: "13px 0", borderRadius: 14 } }, pool.length ? "翻一张新题" : "题库都答完啦")));
  }

  // —— 翻页看过往（编辑 / reroll / 删除）——
  if (mode === "pages") {
    const has = mine.length > 0;
    const idx = Math.max(0, Math.min(pageIdx, mine.length - 1));
    const e = has ? mine[idx] : null;
    return h("div", { className: "h-full flex flex-col" },
      h(Head, { zh: bookTitle, en: has ? "第 " + (idx + 1) + " 页 · 共 " + mine.length + " 页" : "", onBack: () => setMode("cover") }),
      h("div", { className: "flex-1 overflow-y-auto px-6 pb-8", style: { touchAction: "pan-y" }, onTouchStart: ev => { const tt = ev.touches[0]; swipeRef.current = { x: tt.clientX, y: tt.clientY }; }, onTouchEnd: ev => { const tt = ev.changedTouches[0]; const dx = tt.clientX - swipeRef.current.x, dy = tt.clientY - swipeRef.current.y; if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.4) { if (dx < 0) setPageIdx(Math.min(mine.length - 1, idx + 1)); else setPageIdx(Math.max(0, idx - 1)); } } },
        !has ? h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: t.fog, marginTop: 10 } }, "还没有答过的题。") : h("div", { key: e.id, style: { position: "relative", background: "#fdfaf1", border: "1px solid #e6dcc4", borderRadius: 4, padding: "16px 18px 14px", animation: "fadeUp .3s ease both",
          // 纸页（v62.13）：横格淡淡铺在底上当纸纹，右下一个折角。配色整套写死——
          // 纸是写死的浅色，字色若还跟主题走，深色主题就是浅字浅纸（信纸那套的同一课）
          backgroundImage: "repeating-linear-gradient(transparent 0 27px, rgba(190,170,120,.16) 27px 28px)",
          boxShadow: "0 8px 20px rgba(90,70,40,.10)" } },
          h("div", { "aria-hidden": "true", style: { position: "absolute", right: 0, bottom: 0, width: 0, height: 0, borderLeft: "14px solid transparent", borderBottom: "14px solid rgba(190,170,120,.30)" } }),
          h("div", { style: { fontFamily: F_BODY, fontSize: 10, letterSpacing: ".18em", color: "#a3987e", marginBottom: 8 } }, (e.byCharacter ? partner.name + " 出的 · " : "") + "第 " + (idx + 1) + " 题"),
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16, lineHeight: 1.5, color: "#3a3226", marginBottom: 12 } }, e.question),
          h("div", { style: { marginBottom: 10 } },
            h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: "#8a7a5c", marginBottom: 3 } }, "我"),
            // 他出的题（sealed 且她还没写）：她的那半直接在这儿写，写完两份一起打开——零调用
            (e.sealed && e.byCharacter && !e.myAnswer) ? h("div", null,
              h("textarea", { value: revealVal, onChange: ev => setRevealVal(ev.target.value), placeholder: "写下你的答案…", rows: 3, style: { width: "100%", outline: "none", resize: "none", padding: "9px 11px", borderRadius: 6, fontFamily: F_BODY, fontSize: 13, lineHeight: 1.6, background: "#fffdf6", color: "#3a3226", border: "1px solid #e6dcc4" } }),
              h("button", { onClick: () => { if (onReveal && onReveal(e.id, revealVal)) setRevealVal(""); }, disabled: !revealVal.trim(), className: "active:opacity-70 disabled:opacity-40", style: { marginTop: 8, background: "#3a3226", color: "#fdfaf1", fontFamily: F_DISPLAY, fontSize: 13, padding: "7px 16px", borderRadius: 8 } }, "写好了 · 一起打开")) :
            editId === e.id ? h("div", null,
              h("textarea", { value: editText, onChange: ev => setEditText(ev.target.value), rows: 3, style: { width: "100%", outline: "none", resize: "none", padding: "9px 11px", borderRadius: 6, fontFamily: F_BODY, fontSize: 13, lineHeight: 1.6, background: "#fffdf6", color: "#3a3226", border: "1px solid #e6dcc4" } }),
              h("div", { className: "flex gap-2 mt-2" },
                h("button", { onClick: () => { onEdit(e.id, editText); setEditId(null); }, className: "active:opacity-70", style: { background: "#3a3226", color: "#fdfaf1", fontFamily: F_DISPLAY, fontSize: 12.5, padding: "6px 14px", borderRadius: 8 } }, "保存"),
                h("button", { onClick: () => setEditId(null), className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 12.5, color: t.fog } }, "取消"))) : h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, lineHeight: 1.6, color: "#6a5f4b", whiteSpace: "pre-wrap" } }, e.myAnswer || "（没写）")),
          h("div", null,
            h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: "#a05a6a", marginBottom: 3 } }, partner.name),
            (e.sealed && e.byCharacter && !e.myAnswer)
              ? h("div", { style: { borderRadius: 6, border: "1px dashed #d8cdaf", padding: "13px 14px", textAlign: "center" } },
                  h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: "#a3987e", lineHeight: 1.7 } },
                    "这道题是 " + partner.name + " 出的，TA 那半已经写好、封着——你写完你的，两份才一起打开。"))
              : (e.sealed && !e.charAnswer)
              ? h("div", { style: { borderRadius: 6, border: "1px dashed #d8cdaf", padding: "13px 14px", textAlign: "center" } },
                  h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: "#a3987e", lineHeight: 1.7 } },
                    "你那份封着呢。" + partner.name + " 写的时候看不到你写了什么——两份都写完才一起打开。"),
                  h("button", { onClick: () => onAnswer(partner, e), disabled: gen, className: "active:opacity-70 disabled:opacity-40",
                    style: { marginTop: 10, fontFamily: F_BODY, fontSize: 13, color: "#fdfaf1", background: "#3a3226", borderRadius: 999, padding: "8px 20px" } },
                    gen ? "写着…" : "让 " + partner.name + " 也写一份"))
              : h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, lineHeight: 1.6, color: "#3a3226", whiteSpace: "pre-wrap" } }, gen ? "…" : (e.charAnswer || "…"))),
          h("div", { className: "flex items-center justify-between", style: { marginTop: 12, borderTop: "1px solid #e6dcc4", paddingTop: 10 } },
            h("span", { style: { fontFamily: F_BODY, fontSize: 10, color: "#a3987e" } }, timeAgo(e.answeredAt)),
            h("div", { className: "flex items-center gap-3" },
              // 他出的、她还没写的那种：我的答案就在上面那个框里写，编辑/重答都还轮不到
              (e.sealed && e.byCharacter && !e.myAnswer) ? null : h("button", { onClick: () => { setEditId(e.id); setEditText(e.myAnswer || ""); }, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 12, color: "#8a7a5c" } }, "编辑"),
              e.sealed ? null : h("button", { onClick: () => onReroll(partner, e), disabled: gen, className: "active:opacity-60 disabled:opacity-40", style: { fontFamily: F_BODY, fontSize: 12, color: "#8a7a5c" } }, gen ? "…" : "重答"),
              h("button", { onClick: () => { onRemove(e.id); setPageIdx(i => Math.max(0, i - (idx === mine.length - 1 ? 1 : 0))); }, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 12, color: "#c26" } }, "删除")))),
        has ? h("div", { className: "flex items-center justify-between", style: { marginTop: 16 } },
          h("button", { onClick: () => setPageIdx(Math.max(0, idx - 1)), disabled: idx === 0, className: "active:opacity-60 disabled:opacity-30", style: { fontFamily: F_BODY, fontSize: 13, color: t.ink } }, "‹ 上一题"),
          h("button", { onClick: () => { draw(); setMode("draw"); }, className: "active:opacity-70 flex flex-col items-center", style: { fontFamily: F_BODY, fontSize: 12.5, color: t.tint } }, "＋ 新题", h("span", { style: { fontSize: 9, color: t.fog, marginTop: 1 } }, "← 左右滑翻页 →")),
          h("button", { onClick: () => setPageIdx(Math.min(mine.length - 1, idx + 1)), disabled: idx >= mine.length - 1, className: "active:opacity-60 disabled:opacity-30", style: { fontFamily: F_BODY, fontSize: 13, color: t.ink } }, "下一题 ›")) : null));
  }

  // —— 书封面（默认）——
  return h("div", { className: "h-full flex flex-col" },
    h(Head, { zh: "问答小本", en: partner.name, onBack }),
    h("div", { className: "flex-1 overflow-y-auto px-6 pb-8" },
      // ── 封面重做（v62.13）：原来是粉紫渐变卡 + 「OUR Q&A」+ 白圆加号——换个 app 照样成立。
      // 它是一本【本子】，就长成一本布面精装本：织纹布面、左侧真书脊（凹槽压线）、
      // 标题烫在压印框里、右侧一条松紧系带。功能一样没动：点标题改名、右下角翻新题。
      h("div", { style: { position: "relative", marginTop: 18, borderRadius: "5px 14px 14px 5px", padding: "30px 24px 24px 44px", minHeight: 300, display: "flex", flexDirection: "column", justifyContent: "space-between", overflow: "hidden",
        // 布面：两道极淡的斜纹叠出织物经纬，底色深酒红
        backgroundImage: "repeating-linear-gradient(45deg, rgba(255,255,255,.035) 0 1px, transparent 1px 3px), repeating-linear-gradient(-45deg, rgba(0,0,0,.06) 0 1px, transparent 1px 3px), linear-gradient(140deg,#8a4757,#63313f)",
        boxShadow: "0 14px 34px rgba(90,45,60,0.35)" } },
        // 书脊：左侧一条受光不同的带，加一道铰线——布包过书板的那道折
        h("div", { "aria-hidden": "true", style: { position: "absolute", left: 0, top: 0, bottom: 0, width: 26, background: "linear-gradient(90deg, rgba(0,0,0,.30), rgba(0,0,0,.10) 55%, rgba(255,255,255,.07) 78%, rgba(0,0,0,.16))" } }),
        h("div", { "aria-hidden": "true", style: { position: "absolute", left: 30, top: 8, bottom: 8, borderLeft: "1px solid rgba(0,0,0,.20)", boxShadow: "1px 0 0 rgba(255,255,255,.06)" } }),
        // 松紧系带：竖着勒在右侧，像合上的手账
        h("div", { "aria-hidden": "true", style: { position: "absolute", right: 30, top: -2, bottom: -2, width: 7, background: "linear-gradient(90deg, rgba(0,0,0,.30), rgba(0,0,0,.16) 40%, rgba(255,255,255,.05))", boxShadow: "0 0 6px rgba(0,0,0,.18)" } }),
        h("div", null,
          // 压印框：一圈细金线，标题「烫」在里面（金字 + 一点内凹的影）
          h("div", { style: { border: "1px solid rgba(232,201,143,.38)", borderRadius: 3, padding: "16px 14px 14px", marginRight: 18, boxShadow: "inset 0 0 0 3px rgba(0,0,0,.10)" } },
            h("div", { style: { fontFamily: F_BODY, fontSize: 10, letterSpacing: ".3em", color: "rgba(232,201,143,.66)", marginBottom: 10 } }, "一人一半 · 写完才打开"),
            titleEditing ? h("div", null,
              h("input", { value: titleVal, onChange: e => setTitleVal(e.target.value), style: { width: "100%", outline: "none", background: "rgba(0,0,0,0.18)", border: "1px solid rgba(232,201,143,0.45)", borderRadius: 6, padding: "6px 10px", fontFamily: F_DISPLAY, fontSize: 24, color: "#e8c98f" } }),
              h("div", { className: "flex gap-2 mt-2" },
                h("button", { onClick: () => { onSaveTitle(partner.id, (titleVal || "").trim() || "关于我们"); setTitleEditing(false); }, className: "active:opacity-80", style: { background: "#e8c98f", color: "#63313f", fontFamily: F_DISPLAY, fontSize: 12.5, padding: "6px 14px", borderRadius: 6, minHeight: 32 } }, "保存"),
                h("button", { onClick: () => { setTitleVal(bookTitle); setTitleEditing(false); }, className: "active:opacity-70", style: { fontFamily: F_BODY, fontSize: 12.5, color: "rgba(232,201,143,0.8)", minHeight: 32 } }, "取消"))) : h("button", { onClick: () => { setTitleVal(bookTitle); setTitleEditing(true); }, className: "text-left active:opacity-80 flex items-baseline gap-2" },
              h("div", { style: { fontFamily: F_DISPLAY, fontSize: 29, color: "#e8c98f", lineHeight: 1.25, textShadow: "0 1px 1px rgba(0,0,0,.4)" } }, bookTitle),
              h("span", { style: { fontFamily: F_BODY, fontSize: 12, color: "rgba(232,201,143,0.55)", flexShrink: 0 } }, "✎")))),
        h("div", { style: { display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginRight: 18 } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: "rgba(232,201,143,.7)" } }, "已答 " + mine.length + " / " + bankTotal + " 题"),
          h("button", { onClick: () => { draw(); setMode("draw"); }, "aria-label": "翻一张新题", className: "active:opacity-80", style: { width: 46, height: 46, borderRadius: 999, background: "rgba(0,0,0,.22)", border: "1px solid rgba(232,201,143,.5)", display: "flex", alignItems: "center", justifyContent: "center" } }, h(IPlus, { size: 22, color: "#e8c98f" })))),
      mine.length ? h("button", { onClick: () => { setPageIdx(0); setMode("pages"); }, className: "w-full active:opacity-70", style: { marginTop: 16, background: t.ink, color: t.bg2, fontFamily: F_DISPLAY, fontSize: 15, padding: "12px 0", borderRadius: 14 } }, "翻开看过往（" + mine.length + "）") : h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: t.fog, textAlign: "center", marginTop: 16 } }, "还没答过题——点封面右下角 ＋ 翻第一张"),
      h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, textAlign: "center", marginTop: 14, lineHeight: 1.6 } }, "想加只属于你俩的专属题？设置 → 「问答」→ 选 " + partner.name)));
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
  const page = e => {
    const isMe = e.author === "user";
    return h("div", { key: e.id, style: { background: isMe ? t.bg2 : "linear-gradient(150deg,#fdf3ee,#f7ebf0)", border: "1px solid " + (isMe ? t.line : "#eed6d2"), borderRadius: 16, padding: "14px 16px", marginBottom: 14 } },
      h("div", { style: { borderBottom: "1px dashed " + t.line, paddingBottom: 8, marginBottom: 10 } },
        h("div", { className: "flex items-center justify-between" },
          h("span", { style: { fontFamily: F_DISPLAY, fontSize: 13.5, color: t.ink } }, fmtD(e.date)),
          h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: isMe ? t.tint : "#b0708a" } }, isMe ? "我写的" : partner.name + " 写的")),
        (e.weather || e.mood) ? h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 3 } }, (e.weather ? "天气：" + e.weather : "") + (e.weather && e.mood ? " · " : "") + (e.mood ? "心情：" + e.mood : "")) : null),
      h("div", { style: { fontFamily: "'Noto Serif SC',serif", fontSize: 13.5, lineHeight: 1.9, color: t.ink, whiteSpace: "pre-wrap" } }, e.content),
      isMe && !e.replied ? h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 8, fontStyle: "italic" } }, "本子在 TA 那边 · 这几天会回你一页") : null);
  };
  return h("div", { className: "h-full flex flex-col" },
    h(Head, { zh: "交换日记", en: partner.name, onBack }),
    h("div", { className: "flex-1 overflow-y-auto px-6 pb-8" },
      h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, lineHeight: 1.7, marginTop: 4, marginBottom: 12 } }, "一本只有你俩看的本子：想写就写一页，TA 会在三天内找个时候回一页——写 TA 那天的事、和没说出口的话。"),
      writing ? h("div", { style: { background: t.bg2, border: "1px solid " + t.line, borderRadius: 16, padding: "13px 15px", marginBottom: 14 } },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 13.5, color: t.ink, marginBottom: 8 } }, fmtD(new Date().getFullYear() + "-" + (new Date().getMonth() + 1) + "-" + new Date().getDate())),
        h("textarea", { value: body, onChange: e => setBody(e.target.value), placeholder: "写点什么给 TA 看…", rows: 6, style: { width: "100%", outline: "none", resize: "none", padding: "10px 12px", borderRadius: 12, fontFamily: "'Noto Serif SC',serif", fontSize: 13.5, lineHeight: 1.8, background: t.bg, color: t.ink, border: "1px solid " + t.line } }),
        h("input", { value: moodW, onChange: e => setMoodW(e.target.value), placeholder: "此刻心情（可空，如：有点想你）", style: { width: "100%", outline: "none", marginTop: 8, padding: "9px 12px", borderRadius: 10, fontFamily: F_BODY, fontSize: 12.5, background: t.bg, color: t.ink, border: "1px solid " + t.line } }),
        h("div", { className: "flex gap-2", style: { marginTop: 10 } },
          h("button", { onClick: () => { if (body.trim()) { onAdd(partner, body, moodW); setBody(""); setMoodW(""); setWriting(false); } }, disabled: !body.trim(), className: "active:opacity-70 disabled:opacity-40", style: { background: t.ink, color: t.bg2, fontFamily: F_DISPLAY, fontSize: 13.5, padding: "9px 20px", borderRadius: 10 } }, "合上本子"),
          h("button", { onClick: () => setWriting(false), className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 12.5, color: t.fog } }, "取消")))
      : h("button", { onClick: () => setWriting(true), className: "w-full active:opacity-70", style: { marginBottom: 14, background: t.ink, color: t.bg2, fontFamily: F_DISPLAY, fontSize: 14.5, padding: "12px 0", borderRadius: 14 } }, pending ? "再写一页（TA 还没回上一页）" : "✎ 写一页"),
      mine.length ? mine.map(page) : h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.fog, textAlign: "center", marginTop: 24 } }, "本子还是空的——写下第一页吧。")));
}

// 情侣空间·双向便签墙（悄悄话串）：我贴→TA 自动回；TA 的要点一下才看得到，再点开全屏留言互动
// 便签纸张样式：纯色 / 横线 / 格纹 / 圆点 / 带粉角，可爱多样
// 便签墙 v59.23 整个撤掉（她 2026-08-31：「便签墙有必要吗，我觉得有点鸡肋」）。
// 情书、交换日记、便签墙三样都是「他写字给你」：情书有「一封」的分量，交换日记
// 有「轮流」，便签墙只是「短」，没有自己的形状。它唯一独有的是「他不请自来贴的
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
// 今天发生过什么的情况下瞎选一个表情，跟他真实的心情各走各的。现在两格直接读真心情。
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
function CoupleDays({ partner, since, events, annivs, onAdd, onRemove, onRead, onGen, onAddAnniv, onRemoveAnniv, gen, onBack }) {
  const t = useTheme();
  // 他留下的感慨带 unread（名册红点看它）；进来看一眼就算看过——跟交换日记同一个形状
  useEffect(() => { onRead && onRead(partner.id); }, []);
  // 排序前把日期补零归一：老存档里「他留下的」那几条是 "2026-9-4" 这种没补零的写法，
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
  const md = s => { const p = (s || "").split("-"); return p.length === 3 ? p[0] + "年" + (+p[1]) + "月" + (+p[2]) + "日" : s; };
  const startDate = since ? (function () { const d = new Date(since); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); })() : null;
  const submitMile = () => { if (date && title.trim()) { onAdd(partner, date, title, content); setDate(""); setTitle(""); setContent(""); setAddMode(null); } };
  const submitAnn = () => { if (an.trim() && mo && dy) { onAddAnniv(partner, an, mo, dy, yearly, link); setAn(""); setMo(""); setDy(""); setAddMode(null); } };
  const toggle = (on, set, label) => h("button", { onClick: () => set(v => !v), className: "active:opacity-70 flex items-center gap-1.5", style: { fontFamily: F_BODY, fontSize: 12.5, color: on ? t.ink : t.fog } }, h("span", { style: { width: 15, height: 15, borderRadius: 4, background: on ? t.ink : "transparent", border: "1px solid " + (on ? t.ink : t.line), color: t.bg2, fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center" } }, on ? "✓" : ""), label);
  const dash = { flex: 1, background: t.bg2, border: "1px dashed " + t.line, borderRadius: 12, padding: "9px 0", fontFamily: F_BODY, fontSize: 13, color: t.tint };
  const inp = { width: "100%", outline: "none", padding: "9px 11px", borderRadius: 10, fontFamily: F_BODY, fontSize: 13.5, background: t.bg2, color: t.ink, border: "1px solid " + t.line };
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
        ? h("div", { style: { width: 12, height: 12, borderRadius: 999, background: ROAD_DOT, boxShadow: "0 0 0 3px rgba(224,138,160,.25)", marginTop: 4 } })
        : ev.byCharacter
        ? h("div", { style: { width: 11, height: 11, borderRadius: 999, background: "transparent", border: "2px solid " + ROAD_DOT, marginTop: 4 } })
        : h("div", { style: { width: 9, height: 9, borderRadius: 999, background: ROAD_DOT, marginTop: 5 } }),
      isStart ? null : h("div", { style: { flex: 1, width: 2, background: "linear-gradient(" + ROAD + ", rgba(224,138,160,.35))", marginTop: 2, borderRadius: 2 } })),
    h("div", { style: { flex: 1, paddingBottom: 18 } },
      h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog } },
        isStart ? "起点 · " + md(startDate) : md(ev.date) + (dayN(ev.date) ? " · " + dayN(ev.date) : "")),
      isStart ? h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: t.ink, marginTop: 2 } }, "和 " + partner.name + " 在一起") : h(Fragment, null,
        h("div", { className: "flex items-center gap-2", style: { marginTop: 2 } },
          ev.byCharacter ? h("span", { style: { fontFamily: F_BODY, fontSize: 10, color: "#b06e6e", border: "1px solid #e3c3c3", borderRadius: 999, padding: "1px 7px" } }, "TA 的感慨") : null,
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15.5, color: t.ink } }, ev.title)),
        ev.content ? h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, lineHeight: 1.6, color: t.sub, marginTop: 3, whiteSpace: "pre-wrap" } }, ev.content) : null,
        h("button", { onClick: () => onRemove(ev.id), className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginTop: 4 } }, "删除"))));
  // 轴顶那个「今天」端点：路走到的地方（跟名册末端那个实心点同一个东西）
  const todayCap = since ? h("div", { className: "flex gap-3", style: { marginBottom: 2 } },
    h("div", { style: { flexShrink: 0, width: 12, display: "flex", flexDirection: "column", alignItems: "center" } },
      h("div", { style: { width: 7, height: 7, borderRadius: 999, background: ROAD_DOT, marginTop: 5 } }),
      h("div", { style: { height: 14, width: 2, background: "linear-gradient(rgba(224,138,160,.35), " + ROAD + ")", marginTop: 2, borderRadius: 2 } })),
    h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: ROAD_DOT, paddingTop: 3 } },
      "今天 · 第 " + Math.max(1, Math.floor((Date.now() - since) / 86400000) + 1) + " 天")) : null;
  return h("div", { className: "h-full flex flex-col" },
    h(Head, { zh: "我们的日子", en: partner.name, onBack,
      right: h("button", { onClick: () => onGen(partner), disabled: gen, className: "active:opacity-50 disabled:opacity-40" }, h(IRefresh, { size: 18, color: t.ink })) }),
    h("div", { className: "flex-1 overflow-y-auto px-6 pb-8" },
      h("div", { className: "flex gap-2", style: { margin: "8px 0 4px" } },
        h("button", { onClick: () => setAddMode(m => m === "mile" ? null : "mile"), className: "active:opacity-70", style: dash }, addMode === "mile" ? "收起" : "＋ 里程碑"),
        h("button", { onClick: () => setAddMode(m => m === "anniv" ? null : "anniv"), className: "active:opacity-70", style: dash }, addMode === "anniv" ? "收起" : "＋ 纪念日")),
      addMode === "mile" ? h("div", { className: "space-y-2", style: { marginTop: 8, marginBottom: 6 } },
        h("input", { type: "date", value: date, onChange: e => setDate(e.target.value), style: inp }),
        h("input", { value: title, onChange: e => setTitle(e.target.value), placeholder: "标题，如 第一次一起看海", style: inp }),
        h("textarea", { value: content, onChange: e => setContent(e.target.value), rows: 2, placeholder: "想记住的细节（选填）", style: Object.assign({}, inp, { resize: "none", lineHeight: 1.5 }) }),
        h("button", { onClick: submitMile, disabled: !date || !title.trim(), className: "active:opacity-70 disabled:opacity-40", style: { background: t.ink, color: t.bg2, fontFamily: F_DISPLAY, fontSize: 14, padding: "8px 20px", borderRadius: 10 } }, "记下来")) : null,
      addMode === "anniv" ? h("div", { className: "space-y-2", style: { marginTop: 8, marginBottom: 6 } },
        h("input", { value: an, onChange: e => setAn(e.target.value), placeholder: "纪念日名称，如 在一起一周年", style: inp }),
        h("div", { className: "flex gap-2 items-center" },
          h("input", { type: "number", value: mo, onChange: e => setMo(e.target.value), placeholder: "月", className: "text-center", style: Object.assign({}, inp, { width: 56 }) }),
          h("span", { style: { fontFamily: F_BODY, fontSize: 13, color: t.fog } }, "月"),
          h("input", { type: "number", value: dy, onChange: e => setDy(e.target.value), placeholder: "日", className: "text-center", style: Object.assign({}, inp, { width: 56 }) }),
          h("span", { style: { fontFamily: F_BODY, fontSize: 13, color: t.fog } }, "日")),
        h("div", { className: "flex items-center gap-5", style: { paddingTop: 2 } }, toggle(yearly, setYearly, "每年重复"), toggle(link, setLink, "加进日历")),
        h("button", { onClick: submitAnn, disabled: !an.trim() || !mo || !dy, className: "active:opacity-70 disabled:opacity-40", style: { background: t.ink, color: t.bg2, fontFamily: F_DISPLAY, fontSize: 14, padding: "8px 20px", borderRadius: 10 } }, "加")) : null,
      anns.length ? h(Eyebrow, { style: { marginTop: 16, marginBottom: 8 } }, "倒数中") : null,
      h("div", { className: "space-y-2.5", style: { marginBottom: anns.length ? 6 : 0 } },
        // 倒数的那一天在现实里长在【日历页】上（v62.15）：左边一张小挂历——红头写月、
        // 大字写日、顶上两个挂孔；过期的整页压灰，红头也褪色。
        anns.map(a => { const info = annivInfo(a); return h("div", { key: a.id, className: "flex items-center gap-3", style: { background: t.bg2, border: "1px solid " + t.line, borderRadius: 16, padding: "11px 15px 11px 12px", opacity: info.passed ? 0.55 : 1 } },
          h("div", { style: { position: "relative", width: 44, flexShrink: 0, borderRadius: 7, overflow: "hidden", border: "1px solid " + t.line, boxShadow: "0 2px 6px rgba(0,0,0,.10)" } },
            h("div", { "aria-hidden": "true", style: { position: "absolute", top: 2.5, left: 9, width: 4, height: 4, borderRadius: 999, background: "rgba(255,255,255,.55)" } }),
            h("div", { "aria-hidden": "true", style: { position: "absolute", top: 2.5, right: 9, width: 4, height: 4, borderRadius: 999, background: "rgba(255,255,255,.55)" } }),
            h("div", { style: { background: info.passed ? "#a09890" : "#c25a5a", color: "#fff", fontSize: 9, textAlign: "center", padding: "3px 0 2px", fontFamily: F_BODY, letterSpacing: 1 } }, a.month + " 月"),
            h("div", { style: { background: t.bg2, textAlign: "center", fontFamily: F_DISPLAY, fontSize: 19, color: t.ink, padding: "3px 0 4px", lineHeight: 1.1 } }, a.day)),
          h("div", { className: "flex-1 min-w-0" },
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15.5, color: t.ink } }, a.name),
            h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginTop: 2 } }, info.y + "年" + a.month + "月" + a.day + "日" + (a.yearlyRepeat ? " · 每年" : ""))),
          h("div", { style: { textAlign: "right" } },
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: info.passed ? 15 : 20, fontStyle: "italic", color: info.days === 0 ? t.accent : info.passed ? t.fog : t.ink, lineHeight: 1 } }, info.days === 0 ? "今天" : info.passed ? "已过去" : info.days),
            info.days === 0 ? null : h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: t.fog, marginTop: 2 } }, info.passed ? (-info.days) + " 天" : "天后")),
          h("button", { onClick: () => onRemoveAnniv(a.id), "aria-label": "删掉这个纪念日", className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 15, color: t.fog, paddingLeft: 4, minHeight: 40 } }, "×")); })),
      h(Eyebrow, { style: { marginTop: anns.length ? 16 : 10, marginBottom: 10 } }, "时光轴"),
      h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginBottom: 10 } }, "右上角让 " + partner.name + " 写一条此刻的感慨。"),
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
      h("div", { style: { position: "relative", width: 46, height: 58, borderRadius: 3, background: bg, border: (on ? "1.5px solid " + t.ink : "1px solid " + t.line), boxShadow: on ? "0 3px 10px rgba(0,0,0,.16)" : "0 1px 3px rgba(0,0,0,.06)", transform: on ? "translateY(-2px)" : "none", transition: "transform .15s", overflow: "hidden" } },
        line ? h("div", { "aria-hidden": "true", style: { position: "absolute", inset: 0, backgroundImage: "repeating-linear-gradient(transparent 0 8px," + line + " 8px 9px)", opacity: 0.9 } }) : null,
        h("div", { style: { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F_DISPLAY, fontSize: 17, color: ink || t.ink } }, key === "auto" ? "🎲" : "字"),
        // 选中不只靠边框：右下角折一个角，形状也变了（色弱和阳光下只剩形状可依）
        on ? h("div", { "aria-hidden": "true", style: { position: "absolute", right: 0, bottom: 0, width: 0, height: 0, borderLeft: "12px solid transparent", borderBottom: "12px solid " + t.ink } }) : null),
      h("span", { style: { fontFamily: F_BODY, fontSize: 10, color: on ? t.ink : t.fog } }, label));
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
    list.map(f => { const on = value === f.key; return h("button", { key: f.key, onClick: () => onPick(f.key), className: "active:opacity-70 flex items-center", style: { gap: 6, minHeight: 40, padding: "8px 13px", borderRadius: 4, fontFamily: f.css || F_BODY, fontSize: 14, background: on ? t.ink : t.bg2, color: on ? t.bg : t.sub, border: "1px solid " + (on ? t.ink : t.line) } },
      // 选中那一款左边多一道竖杠（像笔尖压下去的一道），不靠颜色一样分得清
      on ? h("span", { "aria-hidden": "true", style: { width: 2, height: 14, background: t.bg, borderRadius: 2 } }) : null,
      f.label); }));
}

// 情书设置：整页（.claude/rules/no-half-sheet.md）——纸样和字体加起来快三十个，
// 半窗里挤成两行滑不动；何况这一页不需要同时看见底下那一层。
function CoupleLetterSettings({ partner, cfg, onSave, onBack }) {
  const t = useTheme();
  const c = Object.assign({ auto: false, freqDays: 7, freqRandom: true, font: "auto", paper: "auto" }, cfg || {});
  const set = patch => onSave(partner.id, Object.assign({}, c, patch));
  const sect = (title, sub, body) => h("div", { style: { marginBottom: 26 } },
    h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14.5, color: t.ink, marginBottom: sub ? 3 : 10 } }, title),
    sub ? h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginBottom: 10 } }, sub) : null,
    body);
  return h("div", { className: "h-full flex flex-col" },
    h("div", { className: "shrink-0 flex items-center px-3 pb-2", style: { paddingTop: safeTop(10), minHeight: 52, borderBottom: "1px solid " + t.line } },
      h("button", { onClick: onBack, "aria-label": "返回", className: "active:opacity-50 flex items-center justify-center", style: { width: 40, height: 40 } }, h(IArrow, { size: 19, color: t.ink })),
      h("div", { className: "flex-1 min-w-0 text-center", style: { fontFamily: F_DISPLAY, fontSize: 16, color: t.ink } }, "情书设置"),
      h("div", { style: { width: 40 } })),
    h("div", { className: "flex-1 min-h-0 overflow-y-auto", style: { padding: "18px 22px 40px", overscrollBehavior: "contain" } },
      h("div", { className: "flex items-center justify-between", style: { marginBottom: 24 } },
        h("div", { style: { paddingRight: 14 } },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15, color: t.ink } }, "让 " + partner.name + " 自己写"),
          h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginTop: 3, lineHeight: 1.6 } }, "开着的话，你进来时 TA 会不定期写一封（前台生效）")),
        h("button", { onClick: () => set({ auto: !c.auto }), "aria-label": "自动写情书", className: "active:opacity-70", style: { width: 46, height: 27, borderRadius: 999, background: c.auto ? t.ink : t.line, position: "relative", flexShrink: 0 } },
          h("span", { style: { position: "absolute", top: 3, left: c.auto ? 22 : 3, width: 21, height: 21, borderRadius: 999, background: t.bg, transition: "left .2s" } }))),
      sect("多久写一封", "随机波动＝在这个天数上下浮动，不会每次都卡着同一天",
        h("div", { className: "flex items-center", style: { gap: 12 } },
          h("input", { type: "number", value: c.freqDays, onChange: e => set({ freqDays: Math.max(1, +e.target.value || 7) }), className: "outline-none px-3 py-2 rounded-lg text-center", style: { width: 84, fontFamily: F_BODY, fontSize: 14, background: t.bg2, color: t.ink, border: "1px solid " + t.line } }),
          h("span", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog } }, "天 / 篇"),
          h("button", { onClick: () => set({ freqRandom: !c.freqRandom }), className: "active:opacity-70", style: { minHeight: 40, fontFamily: F_BODY, fontSize: 12.5, color: c.freqRandom ? t.ink : t.fog } }, (c.freqRandom ? "✓ " : "○ ") + "随机波动"))),
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
        h("div", { style: { position: "relative", width: 62, height: 74, transform: "rotate(-4.5deg)", background: mineL ? "linear-gradient(160deg," + inkA(0.09) + "," + inkA(0.16) + ")" : "linear-gradient(160deg," + inkA(0.13) + "," + inkA(0.07) + ")", boxShadow: "0 1px 3px " + inkA(0.14) } },
          h("div", { "aria-hidden": "true", style: { position: "absolute", inset: -4, background: "radial-gradient(circle," + pp.bg + " 3.1px, transparent 3.4px) 0 0/10.33px 10.33px", pointerEvents: "none" } }),
          h("div", { style: { position: "absolute", inset: 6, border: "1px solid " + inkA(0.28), display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, padding: 3 } },
            h(IHeart, { size: 15, color: inkA(0.5), filled: true }),
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 10.5, color: inkA(0.78), lineHeight: 1.25, textAlign: "center", wordBreak: "break-all" } }, mineL ? "我" : partner.name))),
        // 邮戳：盖在邮票右下角，圈里是日期，跟真的一样压过票面
        h("div", { style: { position: "absolute", right: -21, bottom: -8, width: 58, height: 58, borderRadius: 999, border: "1.5px solid " + inkA(0.34), display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", transform: "rotate(9deg)", opacity: 0.9 } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 8, letterSpacing: 1.5, color: inkA(0.42) } }, "见 字 如 面"),
          h("div", { style: { width: 34, borderTop: "1px solid " + inkA(0.26), borderBottom: "1px solid " + inkA(0.26), padding: "1.5px 0", margin: "2px 0", fontFamily: F_BODY, fontSize: 10, color: inkA(0.55), textAlign: "center" } }, (dt.getMonth() + 1) + "·" + dt.getDate()),
          h("div", { style: { fontFamily: F_BODY, fontSize: 8, letterSpacing: 1, color: inkA(0.42) } }, dt.getFullYear())));
      return h("div", { className: "h-full flex flex-col", style: { background: pp.bg } },
        // 顶栏：透明浮在纸上，只有返回键和一行极轻的落款；右侧等宽占位（mobile-ui-layout §1）
        h("div", { className: "shrink-0 flex items-center px-3 pb-1", style: { paddingTop: safeTop(8), minHeight: 50 } },
          h("button", { onClick: () => { setOpen(null); setReply(""); }, "aria-label": "返回", className: "active:opacity-50 flex items-center justify-center", style: { width: 40, height: 40 } }, h(IArrow, { size: 19, color: pp.ink })),
          h("div", { className: "flex-1 min-w-0 text-center", style: { fontFamily: F_BODY, fontSize: 11.5, letterSpacing: 2, color: inkA(0.42) } }, mineL ? "寄给 " + partner.name : partner.name + " 寄来"),
          h("div", { style: { width: 40 } })),
        h("div", { className: "flex-1 min-h-0 overflow-y-auto", style: { padding: "6px 26px 30px", overscrollBehavior: "contain" } },
          h("div", { className: "flex items-start", style: { gap: 14, marginBottom: 16 } },
            h("div", { style: { flex: 1, minWidth: 0, paddingTop: 6 } },
              h("div", { style: { fontFamily: F_DISPLAY, fontSize: 24, color: pp.ink, lineHeight: 1.35, wordBreak: "break-word" } }, l.title || "给你的信"),
              // 信头那两道横线：一粗一细，只有信笺会这么收头
              h("div", { style: { borderTop: "1.5px solid " + inkA(0.3), marginTop: 12 } }),
              h("div", { style: { borderTop: "1px solid " + inkA(0.14), marginTop: 2.5 } })),
            stamp),
          h("div", { style: { fontFamily: fc, fontSize: 15, lineHeight: "31px", color: pp.ink, whiteSpace: "pre-wrap", marginTop: 14, backgroundImage: "repeating-linear-gradient(transparent 0 30px," + pp.line + " 30px 31px)" } }, l.body),
          // 信后那几笔：不是聊天记录，是【又及】——写完信之后补上去的话
          (l.replies || []).length ? h("div", { style: { marginTop: 30 } },
            h("div", { className: "flex items-center", style: { gap: 10, marginBottom: 18 } },
              h("div", { style: { flex: 1, borderTop: "1px solid " + inkA(0.16) } }),
              h("div", { style: { fontFamily: F_BODY, fontSize: 10, letterSpacing: 3, color: inkA(0.38) } }, "又 及"),
              h("div", { style: { flex: 1, borderTop: "1px solid " + inkA(0.16) } })),
            (l.replies || []).map((r, i) => { const me = r.authorId === "user"; return h("div", { key: i, className: "flex", style: { gap: 10, marginBottom: 15 } },
              // 落笔的那一点：谁写的就在谁那侧，一个实心一个空心，不靠颜色分
              h("div", { style: { flexShrink: 0, width: 7, height: 7, borderRadius: 999, marginTop: 8, background: me ? inkA(0.55) : "transparent", border: "1.5px solid " + inkA(0.55) } }),
              h("div", { style: { flex: 1, minWidth: 0 } },
                h("div", { style: { fontFamily: F_BODY, fontSize: 10, letterSpacing: 1.5, color: inkA(0.42), marginBottom: 3 } }, me ? "我" : partner.name),
                h("div", { style: { fontFamily: fc, fontSize: 14.5, lineHeight: 1.95, color: inkA(0.88), whiteSpace: "pre-wrap", wordBreak: "break-word" } }, r.content))); })) : null,
          gen ? h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: inkA(0.5), marginTop: 14 } }, partner.name + " 正在回信…") : null),
        // 写字的地方还是这张纸：一条虚线像撕口，底下一行横格，不另起一块深色输入栏
        h("div", { className: "shrink-0 flex items-end", style: { gap: 10, padding: "10px 22px calc(env(safe-area-inset-bottom) * 0.4 + 10px)", borderTop: "1px dashed " + inkA(0.22) } },
          h("input", { value: reply, onChange: e => setReply(e.target.value), onKeyDown: e => { if (e.key === "Enter") send(); }, placeholder: "再添一笔…", style: { flex: 1, minWidth: 0, outline: "none", background: "transparent", padding: "6px 2px", fontFamily: fc, fontSize: 14.5, color: pp.ink, borderBottom: "1px solid " + inkA(0.28) } }),
          h("button", { onClick: send, disabled: !reply.trim() || gen, className: "active:opacity-60 disabled:opacity-30 flex items-center", style: { gap: 5, fontFamily: F_DISPLAY, fontSize: 14, color: pp.ink, padding: "6px 2px" } }, "附上", h("span", { style: { fontSize: 15, lineHeight: 1 } }, "↵"))));
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
    return h("div", { onClick: doOpen, className: "relative w-full active:opacity-95", style: { height: 122, borderRadius: 4, background: pp.bg, border: "1px solid " + inkA(0.14), boxShadow: "0 4px 14px " + inkA(0.13), overflow: "hidden", cursor: "pointer" } },
      // 三块折片：全用这张纸自己的墨色压深浅，什么纸都不会脏
      h("div", { style: { position: "absolute", top: 0, left: 0, right: 0, height: 68, background: inkA(0.05), clipPath: "polygon(0 0,100% 0,50% 100%)" } }),
      h("div", { style: { position: "absolute", top: 0, left: 0, bottom: 0, width: "50%", background: inkA(0.035), clipPath: "polygon(0 0,100% 50%,0 100%)" } }),
      h("div", { style: { position: "absolute", top: 0, right: 0, bottom: 0, width: "50%", background: inkA(0.035), clipPath: "polygon(100% 0,0 50%,100% 100%)" } }),
      h("div", { "aria-hidden": "true", style: { position: "absolute", top: 0, left: 0, right: 0, height: 68, borderBottom: "1px solid " + inkA(0.1), clipPath: "polygon(0 0,100% 0,50% 100%)" } }),
      // 火漆：还是那颗，但压暗、去掉高饱和的高光，看着像蜡不像糖
      h("div", { style: { position: "absolute", top: 34, left: "50%", transform: "translateX(-50%)", width: 44, height: 44, borderRadius: 999, background: "radial-gradient(circle at 36% 30%," + sealColor + "," + sealColor + "d9)", boxShadow: "0 2px 7px rgba(0,0,0,.28), inset 0 1px 1px rgba(255,255,255,.18)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2 } },
        h(IHeart, { size: 18, color: "rgba(255,255,255,.82)", filled: true })),
      h("div", { style: { position: "absolute", left: 16, right: 16, bottom: 12, zIndex: 2 } },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14.5, color: pp.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, l.title || "给你的信"),
        h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: inkA(0.55), marginTop: 2 } }, (mineL ? "我写的" : partner.name + " 写的") + (unread ? " · 未读" : ""))),
      h("button", { onClick: e => { e.stopPropagation(); onRemove(l.id); }, "aria-label": "删掉这封", className: "absolute active:opacity-60", style: { top: 4, right: 6, width: 30, height: 30, fontFamily: F_BODY, fontSize: 15, color: inkA(0.45), zIndex: 3 } }, "×"),
      unread ? h("span", { className: "absolute", style: { top: 11, left: 12, width: 7, height: 7, borderRadius: 999, background: "#b3452f", zIndex: 3 } }) : null);
  };
  const sorted = mine.slice().sort((a, b) => b.createdAt - a.createdAt);
  const timelineRow = (l, i) => { const dp = mdParts(l.createdAt); return h("div", { key: l.id, className: "flex gap-3", style: { animation: "fadeUp .3s ease both" } },
    h("div", { style: { flexShrink: 0, width: 40, display: "flex", flexDirection: "column", alignItems: "center" } },
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14, color: t.ink, lineHeight: 1, marginTop: 2 } }, dp.md),
      h("div", { style: { fontFamily: F_BODY, fontSize: 8.5, color: t.fog, marginTop: 2 } }, dp.y),
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
    const swatch = (key, bg, ink, line) => h("button", { key, onClick: () => setCPaper(key), "aria-label": "换纸", className: "active:opacity-80 shrink-0", style: { width: 30, height: 38, borderRadius: 2.5, background: bg, border: cPaper === key ? "1.5px solid " + pp.ink : "1px solid " + inkA(0.22), position: "relative", overflow: "hidden" } },
      h("div", { "aria-hidden": "true", style: { position: "absolute", inset: 0, backgroundImage: "repeating-linear-gradient(transparent 0 6px," + line + " 6px 7px)" } }),
      cPaper === key ? h("div", { "aria-hidden": "true", style: { position: "absolute", right: 0, bottom: 0, width: 0, height: 0, borderLeft: "9px solid transparent", borderBottom: "9px solid " + ink } }) : null);
    return h("div", { className: "h-full flex flex-col", style: { background: pp.bg } },
      h("div", { className: "shrink-0 flex items-center px-3 pb-1", style: { paddingTop: safeTop(8), minHeight: 50 } },
        h("button", { onClick: () => setCompose(false), "aria-label": "返回", className: "active:opacity-50 flex items-center justify-center", style: { width: 40, height: 40 } }, h(IArrow, { size: 19, color: pp.ink })),
        h("div", { className: "flex-1 min-w-0 text-center", style: { fontFamily: F_BODY, fontSize: 11.5, letterSpacing: 2, color: inkA(0.42) } }, "写给 " + partner.name),
        h("button", { onClick: doCompose, disabled: !cBody.trim(), className: "active:opacity-60 disabled:opacity-30 flex items-center justify-center", style: { minWidth: 52, height: 40, fontFamily: F_DISPLAY, fontSize: 14, color: pp.ink } }, "寄出")),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto", style: { padding: "6px 26px 24px", overscrollBehavior: "contain" } },
        h("input", { value: cTitle, onChange: e => setCTitle(e.target.value), placeholder: "标题（选填）", style: { width: "100%", outline: "none", background: "transparent", fontFamily: F_DISPLAY, fontSize: 24, color: pp.ink, paddingTop: 6, paddingBottom: 10 } }),
        h("div", { style: { borderTop: "1.5px solid " + inkA(0.3) } }),
        h("div", { style: { borderTop: "1px solid " + inkA(0.14), marginTop: 2.5, marginBottom: 16 } }),
        h("textarea", { value: cBody, onChange: e => setCBody(e.target.value), placeholder: "写下你想对 TA 说的话…", style: { width: "100%", minHeight: "46vh", outline: "none", resize: "none", background: "transparent", fontFamily: fc, fontSize: 15, lineHeight: "31px", color: pp.ink, backgroundImage: "repeating-linear-gradient(transparent 0 30px," + pp.line + " 30px 31px)" } })),
      // 底下这一条是【文具盒】：一排真的小纸样 + 一排笔迹，就在写字的那张纸边上，随手换
      h("div", { className: "shrink-0", style: { borderTop: "1px dashed " + inkA(0.22), padding: "8px 0 calc(env(safe-area-inset-bottom) * 0.4 + 8px)" } },
        h("div", { className: "flex items-center overflow-x-auto", style: { gap: 7, padding: "0 22px 8px" } },
          LETTER_PAPERS.map(p => swatch(p.key, p.bg, p.ink, p.line))),
        h("div", { className: "flex items-center overflow-x-auto", style: { gap: 7, padding: "0 22px" } },
          LETTER_FONTS.filter(f => f.css).map(f => h("button", { key: f.key, onClick: () => setCFont(f.key), className: "active:opacity-70 shrink-0", style: { minHeight: 40, padding: "8px 12px", borderRadius: 3, fontFamily: f.css, fontSize: 13.5, whiteSpace: "nowrap", color: cFont === f.key ? pp.bg : inkA(0.7), background: cFont === f.key ? pp.ink : "transparent", border: "1px solid " + inkA(cFont === f.key ? 0.7 : 0.22) } }, f.label)))));
  }

  // 顶栏也换成紧凑标题栏（mobile-ui-layout §1）：原来那块 30px 的「我们的情书」
  // 大标题 + 「Letters」眉标，跟读信页那块被拆掉的框是同一种东西——一整屏最上面
  // 先扣掉六七十像素去说这一页叫什么，而这一页叫什么，进来的人本来就知道。
  return h("div", { className: "h-full flex flex-col" },
    h("div", { className: "shrink-0 flex items-center px-3 pb-2", style: { paddingTop: safeTop(10), minHeight: 52, borderBottom: "1px solid " + t.line } },
      h("button", { onClick: onBack, "aria-label": "返回", className: "active:opacity-50 flex items-center justify-center", style: { width: 40, height: 40 } }, h(IArrow, { size: 19, color: t.ink })),
      h("div", { style: { width: 32 } }),   // 右边有两颗键，这儿垫一格，标题才真在正中
      h("div", { className: "flex-1 min-w-0 text-center", style: { fontFamily: F_DISPLAY, fontSize: 16, color: t.ink } }, "我们的情书"),
      h("button", { onClick: () => setCompose(true), "aria-label": "自己写一封", className: "active:opacity-50 flex items-center justify-center", style: { width: 36, height: 40 } }, h(IPlus, { size: 19, color: t.ink })),
      h("button", { onClick: () => setCfgOpen(true), "aria-label": "情书设置", className: "active:opacity-50 flex items-center justify-center", style: { width: 36, height: 40 } }, h(GConfig, { size: 18, color: t.ink }))),
    h("div", { className: "flex-1 min-h-0 overflow-y-auto px-6 pb-8", style: { overscrollBehavior: "contain" } },
      h("button", { onClick: () => onGen(partner), disabled: gen, className: "w-full active:opacity-70 disabled:opacity-40", style: { margin: "8px 0 16px", background: t.bg2, border: "1px dashed " + t.line, borderRadius: 12, padding: "10px 0", fontFamily: F_BODY, fontSize: 13, color: t.tint } }, gen ? partner.name + " 提笔中…" : "让 " + partner.name + " 写一封（距上封 ≥ 3 天）"),
      mine.length === 0 && !gen ? h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: t.fog } }, "还没有情书。让 TA 写一封，或点右上角 ＋ 自己写一封给 TA。") : null,
      h("div", null, sorted.map(timelineRow))));
}

// 情侣空间·合照墙：把和 TA 的聊天里生成的「我俩合照」(photoKind:"duo") 挂成一面墙，按月分组、点开放大。
// 每月十二号有地方翻。图从 IndexedDB(x_selfies) 按 imgKey 读，读不出的静静跳过。
function AlbumPhoto({ photo, full, cover }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let alive = true, obj = null;
    if (photo && photo.imgKey && typeof idbImgGet === "function") {
      idbImgGet(photo.imgKey).then(b => { if (!alive) return; if (b && b.size) { obj = URL.createObjectURL(b); setUrl(obj); } }).catch(() => {});
    }
    return () => { alive = false; if (obj) URL.revokeObjectURL(obj); };
  }, [photo && photo.imgKey]);
  const src = url || (photo && photo.imgUrl) || null;
  if (cover) return src ? h("img", { src, style: { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" } }) : null;
  if (!src) return h("div", { style: { width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: full ? 40 : 20, opacity: 0.3 } }, "🖼");
  return h("img", { src, loading: "lazy", style: full ? { maxWidth: "90vw", maxHeight: "72vh", borderRadius: 12, objectFit: "contain" } : { width: "100%", height: "100%", objectFit: "cover", display: "block" } });
}
function CoupleAlbum({ partner, photos, onBack }) {
  const t = useTheme();
  const [zoom, setZoom] = useState(null);
  const list = (photos || []).slice().sort((a, b) => (b.ts || 0) - (a.ts || 0));
  const groups = [];
  list.forEach(p => {
    const d = new Date(p.ts || Date.now());
    const key = d.getFullYear() + " 年 " + (d.getMonth() + 1) + " 月";
    let g = groups.find(x => x.key === key); if (!g) { g = { key, items: [] }; groups.push(g); }
    g.items.push(p);
  });
  const isTwelfth = new Date().getDate() === 12;
  return h("div", { className: "h-full flex flex-col" },
    h(Head, { zh: "我们的合照", en: partner.name, onBack: onBack }),
    h("div", { className: "flex-1 overflow-y-auto px-5 pb-12" },
      list.length === 0
        ? h(Empty, { text: "还没有你俩的合照", sub: "在和 " + partner.name + " 的聊天里，让 TA 拍张『我俩的合照』——就会挂到这面墙上。（需先在设置配好图像 API、你和 TA 都传了参考照）" })
        : h(Fragment, null,
            h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: isTwelfth ? t.accent : t.fog, textAlign: "center", padding: "8px 0 16px", lineHeight: 1.7, whiteSpace: "pre-line" } },
              "你和 " + partner.name + " 的合照 · 共 " + list.length + " 张\n" + (isTwelfth ? "今天十二号——来翻翻我们。" : "每月十二号，来这儿翻翻。")),
            groups.map(g => h("div", { key: g.key, style: { marginBottom: 20 } },
              h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15, color: t.ink, marginBottom: 9 } }, g.key + " · " + g.items.length + " 张"),
              h("div", { style: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 } },
                g.items.map((p, i) => h("button", { key: i, onClick: () => setZoom(p), className: "active:opacity-80", style: { aspectRatio: "1", borderRadius: 10, overflow: "hidden", border: "1px solid " + t.line, background: t.bg2, padding: 0 } },
                  h(AlbumPhoto, { photo: p }))))))),
    zoom ? h("div", { onClick: () => setZoom(null), style: { position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,.92)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20 } },
      h(AlbumPhoto, { photo: zoom, full: true }),
      zoom.desc ? h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: "rgba(255,255,255,.85)", marginTop: 14, textAlign: "center", maxWidth: 320, lineHeight: 1.6 } }, zoom.desc) : null,
      h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: "rgba(255,255,255,.5)", marginTop: 8 } }, new Date(zoom.ts || 0).toLocaleString("zh-CN"))) : null));
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
  const TABC = ["#b0885a", "#a06a54", "#8a7a5c", "#7a8a6a", "#6a7a8a", "#8a6a7a", "#9a8a5a"];
  return h("div", { className: "h-full flex flex-col", style: {
    background: KRAFT,
    backgroundImage: "repeating-linear-gradient(97deg, rgba(120,90,45,.05) 0 2px, transparent 2px 14px), radial-gradient(120% 70% at 50% -8%, rgba(255,248,230,.5), transparent 60%)",
    boxShadow: "inset 0 0 42px rgba(110,80,35,.22)" } },
    h(Head, { zh: "我们的档案", en: partner.name, onBack, bg: "transparent", ink: "#42311a" }),
    h("div", { className: "flex-1 min-h-0 overflow-y-auto px-5 pb-10" },
      // 夹面：绕线扣（两个纸扣、一圈线绕过去）——只有档案袋才有这个
      h("div", { style: { position: "relative", marginTop: 12, borderRadius: 4, background: "rgba(255,250,238,.34)", border: "1px solid rgba(110,80,35,.28)", padding: "16px 15px 14px", marginBottom: 18 } },
        h("div", { "aria-hidden": "true", style: { position: "absolute", right: 16, top: -8, width: 17, height: 17, borderRadius: 999, background: "#b09468", border: "1.5px solid rgba(90,65,25,.5)", boxShadow: "0 1px 2px rgba(90,65,25,.3)" } }),
        h("div", { "aria-hidden": "true", style: { position: "absolute", right: 44, top: 6, width: 13, height: 13, borderRadius: 999, background: "#b09468", border: "1.5px solid rgba(90,65,25,.5)" } }),
        h("div", { "aria-hidden": "true", style: { position: "absolute", right: 22, top: -2, width: 30, height: 16, borderBottom: "1.5px solid rgba(90,65,25,.55)", borderRadius: "0 0 60% 40%", transform: "rotate(14deg)" } }),
        h("div", { style: { fontFamily: F_BODY, fontSize: 10, letterSpacing: ".22em", color: "#7a6238" } }, "只由你亲手写入"),
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 22, color: "#42311a", marginTop: 7 } }, filled ? "收好了 " + filled + " 页" : "从一张空白档案开始"),
        h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, lineHeight: 1.65, color: "#7a6238", marginTop: 5 } }, "这里不会从普通聊天或记忆库自动填字。你写下什么，才留下什么。")),
      COUPLE_ARCHIVE_FIELDS.map(([key, title, hint], fi) => h("label", { key, style: { display: "block", position: "relative", marginTop: fi ? 14 : 0 } },
        // 索引标签：长在页顶、一页一个位置错开——一叠翻得到的档案页
        h("div", { style: { position: "relative", zIndex: 1, marginLeft: (fi % 4) * 23 + "%", display: "inline-flex", alignItems: "center", gap: 5, maxWidth: "72%",
          borderRadius: "8px 8px 0 0", padding: "6px 13px 5px", background: TABC[fi % TABC.length], color: "#fff",
          fontFamily: F_BODY, fontSize: 11.5, boxShadow: "inset 0 1px 0 rgba(255,255,255,.25)" } },
          h("span", { style: { fontFamily: F_DISPLAY, fontSize: 10, opacity: 0.75 } }, "0" + (fi + 1)),
          h("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, title),
          String(draft[key] || "").trim() ? h("span", { "aria-hidden": "true", style: { width: 5, height: 5, borderRadius: 999, background: "rgba(255,255,255,.85)", flexShrink: 0 } }) : null),
        h("div", { style: { position: "relative", background: PAGE, borderRadius: fi % 4 === 0 ? "0 4px 4px 4px" : 4, border: "1px solid rgba(150,120,70,.3)", borderTopColor: TABC[fi % TABC.length], borderTopWidth: 2, padding: "11px 13px 13px", boxShadow: "0 5px 14px rgba(110,80,35,.16)" } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: AFOG } }, hint),
          h("textarea", { value: draft[key] || "", onChange: e => setDraft(d => ({ ...d, [key]: e.target.value })), rows: 3, placeholder: "写在这里……", className: "w-full outline-none resize-none", style: { marginTop: 7, background: "transparent", borderBottom: "1px dashed rgba(150,120,70,.35)", color: AINK, padding: "4px 2px 8px", fontFamily: F_BODY, fontSize: 13.5, lineHeight: 1.7 } })))),
      h("button", { onClick: () => onSave(draft), className: "w-full active:opacity-70", style: { marginTop: 22, borderRadius: 10, background: "#42311a", color: "#f5ecd8", padding: "13px 16px", fontFamily: F_DISPLAY, fontSize: 15, boxShadow: "0 6px 16px rgba(66,49,26,.3)" } }, "封存这份档案")));
}

// 情侣空间·他记得的那一版（v58.85，她 2026-08-31 的 c）。
// 这一屋子模块记的都是【她写下来的】。这一页反过来：同一件事，他记得的那一版摆在旁边。
// 他留意到的和她记下来的往往不是同一处——那个落差才是这一页的内容，所以两版并排放，
// 不合并、不总结。
function CoupleRecall({ partner, items, busy, onGen, onRead, onDel, onBack }) {
  const t = useTheme();
  const list = (items || []).filter(x => x.characterId === partner.id);
  return h("div", { className: "h-full flex flex-col" },
    h(Head, { zh: "他记得的那一版", en: partner.name, onBack: onBack }),
    h("div", { className: "flex-1 min-h-0 overflow-y-auto px-5 pb-10" },
      h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, lineHeight: 1.8, marginBottom: 14 } },
        "挑一件你俩都在场的事，让 " + partner.name + " 写他记得的那一版。他留意到的，多半跟你记下来的不是同一处。"),
      h("button", { onClick: onGen, disabled: busy, className: "w-full active:opacity-80",
        style: { fontFamily: F_BODY, fontSize: 14, color: "#fff", background: t.ink, borderRadius: 14, padding: "13px 0", marginBottom: 18, opacity: busy ? 0.5 : 1 } },
        busy ? "他在想…" : "挑一件事，问问他记得的"),
      list.length ? list.map(x => h("div", { key: x.id, onClick: () => x.unread && onRead(x.id),
        style: { borderRadius: 18, border: "1px solid " + (x.unread ? t.tint : t.line), background: t.bg2, padding: "15px 16px", marginBottom: 12 } },
        x.unread ? h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: t.tint, marginBottom: 6 } }, "· 新的") : null,
        h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginBottom: 4 } }, "你记下的"),
        h("div", { style: { fontFamily: F_BODY, fontSize: 13, lineHeight: 1.75, color: t.sub, whiteSpace: "pre-wrap" } }, x.mine),
        h("div", { style: { height: 1, background: t.line, margin: "12px 0" } }),
        h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.accent, marginBottom: 4 } }, partner.name + " 记得的"),
        h("div", { style: { fontFamily: F_BODY, fontSize: 14, lineHeight: 1.9, color: t.ink, whiteSpace: "pre-wrap" } }, x.his),
        x.note ? h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, fontStyle: "italic", color: t.fog, lineHeight: 1.7, marginTop: 10, borderLeft: "2px solid " + t.line, paddingLeft: 10 } }, x.note) : null,
        h("div", { className: "flex items-center justify-between", style: { marginTop: 12 } },
          h("span", { style: { fontFamily: F_BODY, fontSize: 10, color: t.fog } }, timeAgo(x.ts)),
          h("button", { onClick: e => { e.stopPropagation(); onDel(x.id); }, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog } }, "删掉"))))
        : h(Empty, { text: "还没问过", sub: "问一次就挑一件你俩共同经历过的事。同一件事，两个人记得的常常不是同一处。" })));
}
// 情侣空间·我们说好的（v58.83，她 2026-08-31 选的第 ② 条）。
// ⚠️和「心愿单」是两回事，别混：心愿单是【她想要的】，自己往里放；
// 这一页是【你俩真说过的】——线下/通话结束时自动抽出来的开环（记忆库里 open:true 的条目）。
// 情侣空间现在整屋子都是记过去的收藏夹，这一页是唯一朝前的：给一条约定挑个日子，
// 到那天他会自己提起（走的是已有的「约回」链，不是新机制）。
function CouplePacts({ partner, pacts, onClose, onSetDue, onAdd, onBack }) {
  const t = useTheme();
  const [txt, setTxt] = useState("");
  const [day, setDay] = useState("");
  const [dueFor, setDueFor] = useState(null);      // 正在给哪一条挑日子
  const [dueVal, setDueVal] = useState("");
  const open = (pacts && pacts.open) || [], due = (pacts && pacts.due) || [];
  const dueOf = memId => due.find(x => x.memId === memId);
  const dayStr = ts => { const d = new Date(ts); return (d.getMonth() + 1) + "月" + d.getDate() + "日"; };
  const leftOf = ts => { const n = Math.ceil((ts - Date.now()) / 86400000); return n > 0 ? "还有 " + n + " 天" : n === 0 ? "就是今天" : "已经过了 " + (-n) + " 天"; };
  const toTs = v => { const d = new Date(v + "T09:00:00"); return isNaN(d.getTime()) ? 0 : d.getTime(); };
  const inp = { fontFamily: F_BODY, fontSize: 13.5, color: t.ink, background: t.bg2, border: "1px solid " + t.line, borderRadius: 12, padding: "10px 12px", width: "100%", outline: "none" };
  return h("div", { className: "h-full flex flex-col" },
    h(Head, { zh: "我们说好的", en: partner.name, onBack: onBack }),
    h("div", { className: "flex-1 min-h-0 overflow-y-auto px-5 pb-10" },
      h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, lineHeight: 1.8, marginBottom: 14 } },
        "这里的每一条都是你们【真说过】的——线下和通话结束时自己攒进来的，不是你手打的愿望（那是心愿单）。给一条挑个日子，到那天他会自己提起。"),
      h("div", { style: { borderRadius: 18, border: "1px dashed " + t.line, padding: "13px 14px", marginBottom: 16 } },
        h("input", { value: txt, onChange: e => setTxt(e.target.value), placeholder: "你们说好了什么", style: inp }),
        h("div", { className: "flex items-center gap-8", style: { marginTop: 9 } },
          h("input", { type: "date", value: day, onChange: e => setDay(e.target.value), style: { ...inp, flex: 1 } }),
          h("button", { onClick: () => { onAdd(txt.trim(), day ? toTs(day) : 0); setTxt(""); setDay(""); }, disabled: !txt.trim(), className: "shrink-0 active:opacity-70",
            style: { fontFamily: F_BODY, fontSize: 13, color: "#fff", background: t.ink, borderRadius: 12, padding: "10px 18px", opacity: txt.trim() ? 1 : 0.45 } }, "记下")),
        h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 7 } }, "日子可以不填。填了到那天他会主动来找你说这件事。")),
      open.length ? open.map(m => {
        const d = dueOf(m.id);
        return h("div", { key: m.id, style: { borderRadius: 18, border: "1px solid " + t.line, background: t.bg2, padding: "14px 15px", marginBottom: 11 } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 14, lineHeight: 1.75, color: t.ink } }, m.text),
          h("div", { className: "flex items-center flex-wrap", style: { gap: 10, marginTop: 10 } },
            d ? h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: t.tint, border: "1px solid " + t.line, borderRadius: 999, padding: "3px 10px" } },
              dayStr(d.dueTs) + " · " + leftOf(d.dueTs)) : null,
            h("button", { onClick: () => { setDueFor(dueFor === m.id ? null : m.id); setDueVal(""); }, className: "active:opacity-60",
              style: { fontFamily: F_BODY, fontSize: 11.5, color: t.sub } }, d ? "改日子" : "挑个日子"),
            d ? h("button", { onClick: () => onSetDue(m.id, m.text, 0), className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog } }, "不催了") : null,
            h("button", { onClick: () => onClose(m.id), className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 11.5, color: t.tint, marginLeft: "auto" } }, "做到了"),
            h("button", { onClick: () => onClose(m.id), className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog } }, "算了")),
          dueFor === m.id ? h("div", { className: "flex items-center gap-8", style: { marginTop: 10 } },
            h("input", { type: "date", value: dueVal, onChange: e => setDueVal(e.target.value), style: { ...inp, flex: 1 } }),
            h("button", { onClick: () => { if (dueVal) { onSetDue(m.id, m.text, toTs(dueVal)); setDueFor(null); } }, className: "shrink-0 active:opacity-70",
              style: { fontFamily: F_BODY, fontSize: 12.5, color: "#fff", background: t.tint, borderRadius: 12, padding: "9px 16px" } }, "就这天")) : null);
      }) : h(Empty, { text: "还没有说好的事", sub: "跟 " + partner.name + " 线下相处或打完电话，说定的事会自己攒到这儿来。也可以自己先记一条。" }),
      due.filter(x => !x.memId).length ? h("div", { style: { marginTop: 18 } },
        h(Eyebrow, null, "他说好要来找你的"),
        due.filter(x => !x.memId).map(x => h("div", { key: x.id, style: { fontFamily: F_BODY, fontSize: 13, color: t.sub, lineHeight: 1.8, padding: "9px 0", borderBottom: "1px solid " + t.line } },
          x.about + "　", h("span", { style: { fontSize: 11, color: t.tint } }, leftOf(x.dueTs))))) : null));
}
function CoupleWishes({ partner, data, onSave, onPlan, planOf, onBack }) {
  const t = useTheme();
  const wishes = Array.isArray(data) ? data : [];
  const [title, setTitle] = useState("");
  const [type, setType] = useState("一起做");
  const [note, setNote] = useState("");
  // 「已计划」的愿望可以挑个日子（v62.11）：到那天他主动来约——走约回那条现成的链
  const [planFor, setPlanFor] = useState(null);
  const [planVal, setPlanVal] = useState("");
  const planTs = v => { const d = new Date(v + "T09:00:00"); return isNaN(d.getTime()) ? 0 : d.getTime(); };
  const planLeft = ts => { const n2 = Math.ceil((ts - Date.now()) / 86400000); return n2 > 0 ? "还有 " + n2 + " 天" : n2 === 0 ? "就是今天" : "过了 " + (-n2) + " 天"; };
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
  return h("div", { className: "h-full flex flex-col", style: {
    background: CORK,
    // 软木的颗粒：三层大小不一的点阵叠出来，不跟着滚（铺在外壳上）
    backgroundImage: "radial-gradient(rgba(120,85,40,.16) 1px, transparent 1.6px), radial-gradient(rgba(255,240,210,.13) 1px, transparent 1.5px), radial-gradient(rgba(90,60,25,.12) 1.4px, transparent 2px)",
    backgroundSize: "9px 9px, 13px 13px, 23px 23px", backgroundPosition: "0 0, 4px 7px, 11px 3px",
    boxShadow: "inset 0 0 46px rgba(90,60,25,.30)" } },
    h(Head, { zh: "愿望板", en: partner.name, onBack, bg: "transparent", ink: "#3a2c15" }),
    h("div", { className: "flex-1 min-h-0 overflow-y-auto px-5 pb-10" },
      // 表单也是钉在板上的一张纸
      h("div", { style: { position: "relative", marginTop: 14, padding: "16px 15px 13px", background: "#fbf5e6", borderRadius: 2, transform: "rotate(-0.5deg)", boxShadow: "0 7px 16px rgba(70,45,15,.28)" } },
        pin("b"),
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15, color: paperInk } }, "放进一件以后想一起做的事"),
        h("input", { value: title, onChange: e => setTitle(e.target.value), placeholder: "去哪里、吃什么，或想完成的一件小事", className: "w-full outline-none", style: { marginTop: 10, background: "transparent", borderBottom: "1px dashed #d5c7a4", padding: "7px 2px", fontFamily: F_BODY, fontSize: 13.5, color: paperInk } }),
        h("div", { className: "flex flex-wrap", style: { marginTop: 6 } }, ["一起做", "一起去", "一起吃", "一起学", "想送 TA"].map(x => stamp(type === x, x, "#8a6a3a", () => setType(x)))),
        h("textarea", { value: note, onChange: e => setNote(e.target.value), rows: 2, placeholder: "可选：为什么想做、已经约到哪一步", className: "w-full outline-none resize-none", style: { marginTop: 4, background: "transparent", borderBottom: "1px dashed #d5c7a4", padding: "6px 2px", fontFamily: F_BODY, fontSize: 12.5, lineHeight: 1.6, color: paperInk } }),
        h("button", { onClick: add, disabled: !title.trim(), className: "w-full active:opacity-70 disabled:opacity-40", style: { marginTop: 11, borderRadius: 8, background: "#4a3d2b", color: "#fbf5e6", padding: "10px 12px", fontFamily: F_DISPLAY, fontSize: 14 } }, "钉到板上")),
      wishes.length ? h("div", { style: { display: "flex", flexDirection: "column", gap: 17, marginTop: 20 } }, wishes.map((w, wi) => {
        const done = w.status === "done", shelved = w.status === "shelved";
        return h("article", { key: w.id, style: { position: "relative", padding: "15px 14px 8px", borderRadius: 2,
          background: done ? "#f2ecd9" : shelved ? "#ece4d2" : "#fffdf4",
          transform: "rotate(" + tilt(wi) + "deg)", opacity: shelved ? 0.78 : 1,
          boxShadow: "0 " + (done || shelved ? 4 : 8) + "px " + (done || shelved ? 10 : 18) + "px rgba(70,45,15," + (done || shelved ? ".18" : ".3") + ")" } },
          pin(done ? "b" : "r"),
          // 实现了：一个歪盖的章压在角上——纸条自己说完了这件事的结局
          done ? h("div", { "aria-hidden": "true", style: { position: "absolute", right: 8, top: 10, transform: "rotate(-13deg)", border: "2.5px solid rgba(76,122,96,.68)", color: "rgba(76,122,96,.8)", borderRadius: 5, padding: "1px 8px", fontFamily: F_DISPLAY, fontSize: 13, letterSpacing: 3, zIndex: 1 } }, "实现了") : null,
          h("div", { className: "flex items-start justify-between gap-3" },
            h("div", { className: "min-w-0" },
              h("div", { style: { fontFamily: F_DISPLAY, fontSize: 17, color: paperInk, lineHeight: 1.4, textDecoration: done ? "line-through" : "none", textDecorationColor: "rgba(76,122,96,.5)" } }, w.title),
              h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: paperFog, marginTop: 3 } }, w.type || "一起做")),
            h("button", { onClick: () => removeWish(w.id), "aria-label": "取下来", className: "active:opacity-60", style: { flexShrink: 0, color: paperFog, fontSize: 12, minHeight: 32, padding: "0 4px", fontFamily: F_BODY } }, "取下")),
          w.note ? h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, lineHeight: 1.65, color: "#7a6b50", marginTop: 8 } }, w.note) : null,
          h("div", { className: "flex flex-wrap items-center", style: { marginTop: 5, borderTop: "1px dashed #e0d4b4", paddingTop: 2 } },
            Object.keys(statusMeta).map(k => stamp(w.status === k, statusMeta[k][0], statusMeta[k][1], () => patchWish(w.id, { status: k })))),
          // 已计划的可以挑个日子：到那天他会主动来约这件事（约回链，不是提醒闹钟）
          (function () {
            if (w.status !== "planned" || !onPlan) return null;
            const pl = planOf ? planOf(w.id) : null;
            return h("div", { style: { margin: "2px 0 8px" } },
              pl ? h("div", { className: "flex items-center flex-wrap", style: { gap: 9 } },
                h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: "#4a7396", border: "1px solid #cdbfa0", borderRadius: 999, padding: "3px 10px" } },
                  (new Date(pl.dueTs).getMonth() + 1) + "月" + new Date(pl.dueTs).getDate() + "日 · " + planLeft(pl.dueTs) + " · 到时他来约"),
                h("button", { onClick: () => onPlan(w, 0), className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 11.5, color: paperFog, minHeight: 32 } }, "不定了"))
              : planFor === w.id ? h("div", { className: "flex items-center", style: { gap: 8 } },
                h("input", { type: "date", value: planVal, onChange: e => setPlanVal(e.target.value), style: { flex: 1, fontFamily: F_BODY, fontSize: 13, color: paperInk, background: "#fffdf6", border: "1px solid #d5c7a4", borderRadius: 8, padding: "8px 10px", outline: "none" } }),
                h("button", { onClick: () => { const ts = planTs(planVal); if (ts) { onPlan(w, ts); setPlanFor(null); } }, disabled: !planVal, className: "shrink-0 active:opacity-70 disabled:opacity-40", style: { fontFamily: F_BODY, fontSize: 12.5, color: "#fff", background: "#4a7396", borderRadius: 8, padding: "8px 14px" } }, "就这天"))
              : h("button", { onClick: () => { setPlanFor(w.id); setPlanVal(""); }, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 11.5, color: "#6a5a40", minHeight: 32 } }, "挑个日子 · 到那天他来约"));
          })());
      })) : h("div", { style: { margin: "26px 4px 0", padding: "30px 16px", textAlign: "center", border: "1.5px dashed rgba(70,45,15,.35)", borderRadius: 6, fontFamily: F_BODY, fontSize: 12.5, color: "#5c4726", lineHeight: 1.9 } }, "板上还空着。", h("br"), "先钉一件不急着完成、但不想忘记的事。")));
}

// 情侣空间·我们的唱片（她 2026-09-01）。数据形状 { songs:[{id,neteaseId,title,artist,
// cover,by,note,ts}] }。播放礼数不在这儿——落针/收针全归 app.js 的 discEnter/discLeave,
// 这一页只是唱片本体:A 面是歌,B 面是「为什么是这首」。
function CoupleDiscShelf({ partner, data, nowId, playing, onAdd, onRemove, onNote, onPlay, onPlayTop, nextId, onGen, gen, onBack }) {
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
  return h("div", { className: "h-full flex flex-col" },
    h(Head, { zh: "我们的唱片", en: partner.name, onBack }),
    h("div", { className: "flex-1 overflow-y-auto px-6 pb-10" },
      // ── 唱机台 ──
      h("div", { style: { margin: "14px -24px 0", padding: "26px 24px 22px", background: "linear-gradient(160deg,#241f2c 0%,#171420 70%)", textAlign: "center" } },
        h("div", { style: { position: "relative", width: 208, height: 208, margin: "0 auto" } },
          h("div", { style: { position: "absolute", inset: 0, borderRadius: 999, background: "radial-gradient(circle at 50% 50%, #101014 0 18%, #2b2b30 19% 61%, #17171b 62%)", boxShadow: "0 18px 46px rgba(0,0,0,.45), inset 0 0 0 1px rgba(255,255,255,.04)", display: "flex", alignItems: "center", justifyContent: "center", animation: spinning ? "wk-spin 8s linear infinite" : "none" } },
            h("div", { style: { width: 84, height: 84, borderRadius: 999, overflow: "hidden", background: "#3a3442", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid rgba(255,255,255,.12)" } },
              faceSong && faceSong.cover ? coverOf(faceSong) : h("span", { style: { fontSize: 26 } }, "♪"))),
          // 唱针:放着时压在盘上,停了抬起来
          h("div", { style: { position: "absolute", right: -6, top: -4, width: 5, height: 92, borderRadius: 4, background: "linear-gradient(#8a8296,#565064)", transformOrigin: "50% 8px", transform: spinning ? "rotate(24deg)" : "rotate(2deg)", transition: "transform .6s ease", boxShadow: "0 4px 10px rgba(0,0,0,.4)" } },
            h("div", { style: { position: "absolute", left: -3, bottom: -8, width: 11, height: 14, borderRadius: 3, background: "#a89bb8" } }))),
        h("div", { style: { marginTop: 16, fontFamily: F_DISPLAY, fontSize: 16, color: "#ece6f6", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } },
          faceSong ? faceSong.title + (faceSong.artist ? " · " + faceSong.artist : "") : "这张唱片还是空的"),
        h("div", { style: { marginTop: 4, fontFamily: F_BODY, fontSize: 11, color: "rgba(210,200,230,.55)", lineHeight: 1.6 } },
          spinning ? "正在转 · 离开空间会自己收针"
            : songs.length ? songs.length + " 首 · 进空间接着上次那首往下放" + (nextSong ? "（下一首《" + nextSong.title + "》）" : "")
            : "刻下第一首，或者让 " + partner.name + " 自己挑几首——进空间它就会响起来"),
        h("div", { className: "flex items-center justify-center flex-wrap", style: { gap: 10, marginTop: 14 } },
          songs.length ? h("button", { onClick: onPlay, className: "active:opacity-70", style: { minHeight: 40, fontFamily: F_DISPLAY, fontSize: 13.5, color: "#241f2c", background: "#e6dff2", borderRadius: 999, padding: "9px 26px" } }, spinning ? "从这首重放" : nextSong && nextSong.id !== songs[0].id ? "接着放" : "落针") : null,
          songs.length ? h("button", { onClick: onPlayTop, className: "active:opacity-70", style: { minHeight: 40, fontFamily: F_BODY, fontSize: 12, color: "rgba(230,223,242,.6)", padding: "9px 6px" } }, "从头") : null,
          // 让 TA 自己刻：跟「一起听」里的角色歌单同一条链（推歌 → 去云村搜到真曲）
          h("button", { onClick: onGen, disabled: gen, className: "active:opacity-70 disabled:opacity-45", style: { minHeight: 40, fontFamily: F_DISPLAY, fontSize: 13.5, color: "#e6dff2", background: "transparent", border: "1px solid rgba(230,223,242,.4)", borderRadius: 999, padding: "9px 22px" } },
            gen ? partner.name + " 在挑…" : songs.length ? "让 " + partner.name + " 再刻几首" : "让 " + partner.name + " 刻几首"))),
      // ── A 面:歌 + B 面:刻字 ──
      songs.length ? h("div", { style: { marginTop: 18 } },
        h(Eyebrow, null, "B 面"),
        h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, margin: "4px 0 10px" } }, "每一首背面都刻着一句「为什么是这首」。"),
        songs.map(x => h("div", { key: x.id, style: { display: "flex", gap: 11, padding: "11px 0", borderBottom: "1px solid " + t.line, alignItems: "flex-start" } },
          h("div", { style: { width: 40, height: 40, borderRadius: 8, overflow: "hidden", background: "#eee6f0", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" } }, x.cover ? coverOf(x) : h("span", null, "♪")),
          h("div", { className: "flex-1 min-w-0" },
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14, color: nowId === x.id ? t.accent : t.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, x.title + (nowId === x.id ? " ♪" : (!spinning && nextId === x.id ? " ·针停在这儿" : ""))),
            h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginTop: 2 } }, (x.artist || "") + (x.by === "ta" ? "　· " + partner.name + " 刻的" : "")),
            editId === x.id
              ? h("div", { className: "flex items-center gap-2", style: { marginTop: 6 } },
                  h("input", { value: editVal, onChange: e => setEditVal(e.target.value), placeholder: "为什么是这首", className: "flex-1 outline-none px-2 py-1.5 rounded-lg", style: { fontFamily: F_BODY, fontSize: 12, background: t.bg2, border: "1px solid " + t.line, color: t.ink, minWidth: 0 } }),
                  h("button", { onClick: () => { onNote(x.id, editVal); setEditId(null); }, className: "active:opacity-70", style: { fontFamily: F_BODY, fontSize: 12, color: t.tint, flexShrink: 0 } }, "刻上"))
              : h("button", { onClick: () => { setEditId(x.id); setEditVal(x.note || ""); }, className: "block text-left active:opacity-60 w-full", style: { marginTop: 5 } },
                  h("div", { style: { fontFamily: F_DISPLAY, fontStyle: "italic", fontSize: 12.5, lineHeight: 1.6, color: x.note ? "#93707c" : t.fog } }, x.note ? "「" + x.note + "」" : "背面还空着,刻一句？"))),
          h("button", { onClick: () => onRemove(x.id), className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 13, color: t.fog, flexShrink: 0, padding: "2px 4px" } }, "✕")))) : null,
      // ── 刻新歌 ──
      h("div", { style: { marginTop: 20, padding: "14px 15px", borderRadius: 14, background: t.bg2, border: "1px solid " + t.line } },
        h(Eyebrow, null, "刻一首进去"),
        h("input", { value: q, onChange: e => setQ(e.target.value), placeholder: "歌名或「歌手 歌名」", className: "w-full outline-none px-3 py-2.5 rounded-xl", style: { marginTop: 9, fontFamily: F_BODY, fontSize: 13.5, background: t.bg, border: "1px solid " + t.line, color: t.ink } }),
        h("input", { value: note, onChange: e => setNote(e.target.value), placeholder: "B 面刻字:为什么是这首(可空)", className: "w-full outline-none px-3 py-2.5 rounded-xl", style: { marginTop: 8, fontFamily: F_BODY, fontSize: 13.5, background: t.bg, border: "1px solid " + t.line, color: t.ink } }),
        h("button", { disabled: busy || !q.trim(), onClick: async () => { setBusy(true); try { const ok = await onAdd(q.trim(), note); if (ok) { setQ(""); setNote(""); } } finally { setBusy(false); } },
          className: "w-full active:opacity-70 disabled:opacity-40", style: { marginTop: 10, fontFamily: F_DISPLAY, fontSize: 14, color: t.bg2, background: t.ink, borderRadius: 12, padding: "10px 0" } }, busy ? "去云村找这首…" : "刻进唱片"))))
}

// 情侣空间「最近发生」那一叠通知的尺寸（v61.31，她 2026-09-03：
// 「做小一点，每次只显示三条固定高度，然后可以 scroll 看历史 15 条」）。
// ⚠️高度必须由行高算出来，不许另拍一个像素值：一改行高就得记得同步改那个数，
// 迟早对不上，表现是第三条露出半截（「一层写在两处」那个老形状）。
const NOTIFY_ROW = 50, NOTIFY_GAP = 7, NOTIFY_SHOW = 3, NOTIFY_KEEP = 15;
const NOTIFY_H = NOTIFY_ROW * NOTIFY_SHOW + NOTIFY_GAP * (NOTIFY_SHOW - 1);
function Us({ characters, couples, onBack, onInvite, onUnlink, onSetSince, profile, coupleProfile, coupleHome, onSaveCoupleHome, onSetCoupleImg, coupleQA, onAnswerQA, onEditQA, onRemoveQA, onRerollQA, qaGen, coupleQATitle, onSaveQATitle, coupleQACustom, moodOf, coupleTimeline, onAddTimeline, onRemoveTimeline, onReadTimeline, onGenTimeline, tlGen, coupleAnniv, onAddAnniv, onRemoveAnniv, coupleLetters, coupleLetterCfg, onGenLetter, onAddMyLetter, onReplyLetter, onReadLetter, onRemoveLetter, onSaveLetterCfg, letterGen, coupleSweet, onCheckinSweet, coupleDrawer, onOpenDrawer, coupleFirstsOf, myCloset, charClosetOf, studioShots, studioBusy, fitBusy, studioCanShoot, onGenDateFit, onStudioShoot, onShareShot, ifLines, ifBusy, ifBgBusy, onIfOpen, onIfAdvance, onIfBg, onIfEnd, onIfDrop, makeupOf, makeupSignalFor, makeupBusy, onMakeupOpen, onMakeupSay, onMakeupClose, gachaPts, gachaCards, gachaLuck, gachaBusy, onGachaPull, onGachaRedeem, coupleExDiary, onAddExDiary, onReadExDiary, duoPhotosFor, couplePactsOf, onClosePact, onSetPactDue, onAddPact, onSealQA, onRevealQA, onPlanWish, wishPlanOf, coupleRecall, onGenRecall, onReadRecall, onDelRecall, recallGen, onOpenCapsule, coupleDisc, onDiscAdd, onDiscRemove, onDiscNote, onDiscPlay, onDiscEnter, onDiscLeave, onDiscGen, discGen, discNextIdOf, discNowId, discPlaying }) {
  const t = useTheme();
  const [view, setView] = useState(null); // null=名册 / charId=某段情侣详情
  const [sub, setSub] = useState(null); // 情侣空间子模块：null / 'qa'（后续加 timeline/mood/notes/letters）
  const [pick, setPick] = useState(false);
  const [annOpen, setAnnOpen] = useState(false);
  const [annName, setAnnName] = useState("");
  const [annMo, setAnnMo] = useState("");
  const [annDay, setAnnDay] = useState("");
  const [sinceEdit, setSinceEdit] = useState(false);
  const [sinceVal, setSinceVal] = useState("");
  const [cpEdit, setCpEdit] = useState(false);
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
    if (unreadLettersFor(cid)) a.push("情书");
    if (unreadExDiaryFor(cid)) a.push("交换日记");
    if ((coupleQA || []).some(e => e.characterId === cid && e.sealed && e.byCharacter && !e.myAnswer)) a.push("问答小本");
    if ((coupleRecall || []).some(x => x.characterId === cid && x.unread)) a.push("他记得的");
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

  const pickSheet = pick && h(Sheet, { onClose: () => setPick(false) },
    h(Eyebrow, { style: { marginBottom: 12 } }, "向谁发送情侣邀请"),
    invitable.length === 0
      ? h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: t.fog, paddingBottom: 8 } }, "没有可邀请的对象了。")
      : h("div", { className: "space-y-1 max-h-72 overflow-y-auto" },
          invitable.map(c => h("button", { key: c.id, onClick: () => { setPick(false); onInvite(c); }, className: "w-full flex items-center gap-3 py-2.5 active:opacity-60" },
            h(Avatar, { character: c, size: 34, radius: 8 }),
            h("span", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: t.ink } }, c.name)))));

  // —— 单段情侣详情（仅 together 可进）——
  const partner = view ? characters.find(c => c.id === view) : null;
  // 情侣空间子模块：问答小本
  if (partner && cp[view] && cp[view].status === "together" && sub === "qa") {
    return h(CoupleQABook, { partner, bank: COUPLE_QA_BANK, customQ: (coupleQACustom || {})[partner.id] || [], entries: coupleQA, title: (coupleQATitle || {})[partner.id], onAnswer: onAnswerQA, onSeal: onSealQA, onReveal: (id, text) => onRevealQA(partner.id, id, text), onEdit: onEditQA, onRemove: onRemoveQA, onReroll: onRerollQA, onSaveTitle: onSaveQATitle, gen: qaGen, onBack: () => setSub(null) });
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
    return h(IfRoom, { partner, lines: ifLines, uName: (profile || {}).name || "我", busy: ifBusy, bgBusy: ifBgBusy,
      onOpen: hint => onIfOpen(partner, hint), onAdvance: onIfAdvance, onBg: onIfBg, onEnd: onIfEnd, onDrop: onIfDrop,
      onBack: () => setSub(null) });
  }
  // 情侣空间子模块：照相馆
  if (partner && cp[view] && cp[view].status === "together" && sub === "studio") {
    return h(PhotoStudio, { partner, myCloset: myCloset, charCloset: charClosetOf ? charClosetOf(partner.id) : null,
      shots: studioShots, busy: studioBusy, fitBusy: fitBusy, canShoot: !!(studioCanShoot && studioCanShoot(partner)),
      onGenFit: hint => onGenDateFit(partner, hint), onShoot: o => onStudioShoot(partner, o),
      onShare: shot => onShareShot(partner, shot), onBack: () => setSub(null) });
  }
  // 情侣空间子模块：里程碑册
  if (partner && cp[view] && cp[view].status === "together" && sub === "firsts") {
    return h(CoupleFirstsBook, { partner, items: coupleFirstsOf ? coupleFirstsOf(partner.id) : [], onBack: () => setSub(null) });
  }
  // 情侣空间子模块：惊喜抽屉
  if (partner && cp[view] && cp[view].status === "together" && sub === "drawer") {
    return h(CoupleDrawer, { partner, items: coupleDrawer, onOpen: onOpenDrawer, onBack: () => setSub(null) });
  }
  // 情侣空间子模块：我们的唱片
  if (partner && cp[view] && cp[view].status === "together" && sub === "disc") {
    return h(CoupleDiscShelf, { partner, data: (coupleDisc || {})[partner.id] || {}, nowId: discNowId, playing: discPlaying,
      onAdd: (q, note) => onDiscAdd(partner.id, q, note), onRemove: id => onDiscRemove(partner.id, id),
      onNote: (id, note) => onDiscNote(partner.id, id, note),
      // 落针＝从针位那首接着放（进空间也走这一条）；「从头」才是回第一首
      onPlay: () => onDiscPlay(partner.id, discNextIdOf && discNextIdOf(partner.id)),
      onPlayTop: () => onDiscPlay(partner.id),
      nextId: discNextIdOf && discNextIdOf(partner.id),
      onGen: () => onDiscGen && onDiscGen(partner), gen: discGen === partner.id, onBack: () => setSub(null) });
  }
  // 情侣空间子模块：抽卡（她 2026-08-31：「抽卡是情侣空间的功能，每个恋爱角色单独一份，不是主页」）
  if (partner && cp[view] && cp[view].status === "together" && sub === "gacha") {
    return h(Gacha, { partner, pts: gachaPts, cards: gachaCards, luck: gachaLuck, busy: gachaBusy,
      onPull: onGachaPull, onRedeem: onGachaRedeem, onBack: () => setSub(null) });
  }
  // 情侣空间子模块：交换日记
  if (partner && cp[view] && cp[view].status === "together" && sub === "exdiary") {
    return h(CoupleExDiary, { partner, entries: coupleExDiary, onAdd: onAddExDiary, onRead: onReadExDiary, onBack: () => setSub(null) });
  }
  // 情侣空间子模块：合照墙
  if (partner && cp[view] && cp[view].status === "together" && sub === "album") {
    return h(CoupleAlbum, { partner, photos: duoPhotosFor ? duoPhotosFor(partner.id) : [], onBack: () => setSub(null) });
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
      onClose: onClosePact, onSetDue: (mid, about, ts) => onSetPactDue(mid, partner.id, about, ts),
      onAdd: (txt, ts) => onAddPact(partner.id, txt, ts), onBack: () => setSub(null) });
  }
  if (partner && cp[view] && cp[view].status === "together" && sub === "wishes") {
    const home = (coupleHome || {})[partner.id] || {};
    return h(CoupleWishes, { partner, data: home.wishes || [], onSave: wishes => onSaveCoupleHome(partner.id, cur => ({ ...cur, wishes })),
      onPlan: (wish, ts) => onPlanWish && onPlanWish(partner.id, wish, ts), planOf: wishPlanOf, onBack: () => setSub(null) });
  }
  if (partner && cp[view] && cp[view].status === "together") {
    const days = daysWith(cp[view].since);
    const cprof = (coupleProfile || {})[partner.id] || {};
    const sweet = (coupleSweet || {})[partner.id] || { value: 0, last: null };
    const todayK = (function () { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); })();
    const sweetDone = sweet.last === todayK;
    const myChar = cprof.myAvatar ? { name: (profile && profile.name) || "我", avatarImage: cprof.myAvatar } : { name: (profile && profile.name) || "我", avatarImage: profile && profile.avatarImage, color: (profile && profile.color) || t.accent };
    const paChar = cprof.charAvatar ? { name: partner.name, avatarImage: cprof.charAvatar } : partner;
    // —— bento 拼贴素材：每格露一点自己的活内容（全本地算，零 API）——
    const bCid = partner.id;
    const bPhotos = (duoPhotosFor ? duoPhotosFor(bCid) : []).slice().sort((a, b) => (b.ts || 0) - (a.ts || 0));
    const bLetters = (coupleLetters || []).filter(l => l.characterId === bCid);
    const bUnread = bLetters.filter(l => !l.isRead).length;
    // 他【真实】的心情（跟着真的聊过的天走，会自己平复）。v58.90 之前这儿看的是
    // 「心情打卡」——一次调用让模型在看不见你俩今天发生过什么的情况下瞎选一个表情。
    const bMood = moodOf ? moodOf(bCid) : null;
    const bQaN = (coupleQA || []).filter(e => e.characterId === bCid).length;

    const bTlN = (coupleTimeline || []).filter(e => e.characterId === bCid).length;
    // 「下一件值得等的事」走 annivNext（core.js）：不重复且已经过了的，不再是「值得等的事」
    const bAnn = (coupleAnniv || []).filter(a => a.characterId === bCid)
      .map(a => { const nx = annivNext(a); return nx.passed ? null : { name: a.name, days: nx.days }; })
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
    // 是东西本身：一张照片、他写的那行字、一个日期，不是「合照墙 · 还没有」。
    // 整页最有意思的那一格是和好间，因为它写的是「他从 3 小时前开始，心情一直是
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
    //   他出的、她还没答的那道排最前——那是这一格此刻真正的事。
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
      return new Date(d).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
    };
    (coupleLetters || []).filter(x => x.characterId === bCid).forEach(x => recentItems.push({ id: "l_" + x.id, ts: itemTs(x), sub: "letters", label: "情书", text: cleanSnippet(x.title || x.body) }));
    (coupleExDiary || []).filter(x => x.characterId === bCid).forEach(x => recentItems.push({ id: "d_" + x.id, ts: itemTs(x), sub: "exdiary", label: "交换日记", text: cleanSnippet(x.content) }));
    (coupleTimeline || []).filter(x => x.characterId === bCid).forEach(x => recentItems.push({ id: "t_" + x.id, ts: itemTs(x), sub: "timeline", label: "我们的日子", text: cleanSnippet(x.title || x.content) }));
    bPhotos.forEach((x, i) => recentItems.push({ id: "p_" + (x.imgKey || x.ts || i), ts: itemTs(x), sub: "album", label: "合照墙", text: cleanSnippet(x.desc) || "收进了一张我俩的合照" }));
    bWishes.forEach(x => recentItems.push({ id: "w_" + x.id, ts: itemTs(x), sub: "wishes", label: x.status === "done" ? "愿望实现" : "愿望板", text: cleanSnippet(x.title) }));
    // 他出的题（v62.10）也是「刚发生的事」——她自己翻题答题不算，那是她自己干的
    (coupleQA || []).filter(x => x.characterId === bCid && x.byCharacter).forEach(x => recentItems.push({ id: "q_" + x.id, ts: itemTs(x), sub: "qa", label: "他出的题", text: cleanSnippet(x.question) }));
    recentItems.sort((a, b) => b.ts - a.ts);
    // 15 条＝能往回翻一阵，又不至于把整页撑长（她 2026-09-03：「固定高度，
    // 可以 scroll 看历史 15 条」）。看得见的永远只有三条，剩下的靠滚。
    const bRecent = recentItems.slice(0, NOTIFY_KEEP);
    const sameDay = ts => { const d = new Date(ts || 0); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0") === todayK; };
    const bToday = recentItems.filter(x => sameDay(x.ts)).slice(0, 2);
    const bTodayRows = bToday.length ? h("div", { style: { borderTop: "1px solid #eadde3", padding: "9px 13px" } },
      bToday.map(x => h("button", {
        key: x.id,
        onClick: () => setSub(x.sub),
        className: "w-full flex items-center gap-2 active:opacity-60",
        style: { textAlign: "left", padding: "5px 0" }
      },
        h("span", { "aria-hidden": "true", style: { width: 4, height: 13, borderRadius: 99, background: BAND[x.sub] || "#d9c8d0", flexShrink: 0 } }),
        h("span", { style: { fontFamily: F_BODY, fontSize: 11.5, color: "#765865", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, x.text)))) : null;
    const imgRow = (label, ref, field, has) => h("div", { className: "flex items-center justify-between", style: { marginBottom: 12 } },
      h("span", { style: { fontFamily: F_DISPLAY, fontSize: 14.5, color: t.ink } }, label),
      h("div", { className: "flex items-center gap-3" },
        has ? h("button", { onClick: () => onSetCoupleImg(partner.id, field, null), className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 12, color: t.fog } }, "恢复默认") : null,
        h("button", { onClick: () => ref.current && ref.current.click(), className: "active:opacity-70", style: { fontFamily: F_BODY, fontSize: 12.5, color: t.tint } }, has ? "更换" : "上传")));
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
    // 她 2026-09-02 第二遍：「背景还是不是一整页。是固定住了。」
    // 固定住是对的，错的是上一版到 safe+215px 就收成【不透明】的 t.bg —— 那等于
    // 照片只活在顶上那一截，往下还是一片素底。现在收成【半透明的一层薄纱】(.86)，
    // 而渐变的最后一个色会一直铺到页底，所以整页都还看得见那张图，字也照样读得清。
    const veil = "linear-gradient(180deg,rgba(0,0,0,.34) 0px,rgba(0,0,0,.08) calc(" + ST + " + 76px),transparent calc(" + ST + " + 130px)," + bgA(0.86) + " calc(" + ST + " + 250px))";
    // ── 两枚扣在一起的环（v60.61 修细节）───────────────────────────────────
    // 上一版那道交叠弧是照着 74px 画的，可环实际是 72px——差这 2px，弧就飘到环外面，
    // 变成一道没来由的橙线。这一版尺寸全由 A/RING/GAP/OVER 算出来，不再手填：
    //   环外径 D = A + 2*(RING+GAP)，右边那枚往左压 OVER，
    //   交叠带的起点就是 (D-OVER)/D，弧只取上半圈 → 上半左压右、下半右压左＝扣住了。
    const A = 62, RING = 3, GAP = 2, OVER = 18;
    const D = A + 2 * (RING + GAP);
    const weaveFrom = Math.round((D - OVER) / D * 100);
    const ringA = t.accent || "#c26b7a", ringB = t.tint || "#6f7fb0";
    const ringed = (ch, ring, ml) => h("div", { style: { marginLeft: ml || 0, width: D, height: D, borderRadius: 999, background: ring, boxShadow: "0 3px 12px rgba(0,0,0,.26)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 } },
      // 环和照片之间留一圈极浅的缝：封面再花，这两张脸也分得开
      h("div", { style: { width: A + 2 * GAP, height: A + 2 * GAP, borderRadius: 999, background: "rgba(255,255,255,.92)", display: "flex", alignItems: "center", justifyContent: "center" } },
        h("div", { style: { borderRadius: 999, overflow: "hidden", lineHeight: 0 } }, h(Avatar, { character: ch, size: A, radius: 999 }))));
    return h("div", { className: "h-full flex flex-col", style: { position: "relative", background: coverBg } },
      h("div", { "aria-hidden": "true", style: { position: "absolute", inset: 0, background: veil, pointerEvents: "none" } }),
      // 顶栏浮在封面上，不跟着滚（返回键任何时候都够得着）
      h("div", { className: "shrink-0 flex items-center", style: { position: "relative", zIndex: 2, padding: "0 6px", paddingTop: safeTop(4), height: "calc(" + ST + " + 48px)" } },
        h("button", { onClick: () => setView(null), "aria-label": "返回", className: "active:opacity-60 flex items-center justify-center", style: { width: 40, height: 40 } }, h(IArrow, { size: 19, color: "#fff" })),
        h("div", { className: "flex-1 min-w-0 text-center", style: { fontFamily: F_DISPLAY, fontSize: 15, color: "#fff", textShadow: "0 1px 6px rgba(0,0,0,.5)", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" } }, "我和 " + partner.name),
        onSetCoupleImg
          ? h("button", { onClick: () => setCpEdit(true), "aria-label": "自定义封面", className: "active:opacity-60 flex items-center justify-center", style: { width: 40, height: 40 } }, h(IPencil, { size: 18, color: "#fff" }))
          : h("div", { style: { width: 40 } })),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto pb-8", style: { position: "relative", zIndex: 1, overscrollBehavior: "contain" } },
        // 这一块只是留出封面的位置（背景在下面那一层，不跟着滚）
        h("div", { style: { position: "relative", height: 150 } },
          h("div", { style: { position: "absolute", left: 22, bottom: -30, display: "flex", alignItems: "flex-end" } },
            ringed(paChar, ringA),
            ringed(myChar, ringB, -OVER),
            // 交叠那一段：把左边那枚环的右半弧再画一次，压在右边这枚上面 → 两枚扣住了
            h("div", { "aria-hidden": "true", style: { position: "absolute", left: 0, bottom: 0, width: D, height: D, borderRadius: 999, border: RING + "px solid " + ringA, clipPath: "polygon(" + weaveFrom + "% 0," + weaveFrom + "% 50%,100% 50%,100% 0)", pointerEvents: "none" } }))),
        h("div", { className: "px-6", style: { marginTop: 40 } },
          h("div", { className: "flex items-end justify-between" },
            h("div", { className: "min-w-0" },
              h("div", { className: "flex items-baseline gap-2" },
                h("span", { style: { fontFamily: F_BODY, fontSize: 14, color: t.fog } }, "在一起"),
                h("span", { style: { fontFamily: F_DISPLAY, fontStyle: "italic", fontSize: 40, color: t.accent, lineHeight: 1 } }, days),
                h("span", { style: { fontFamily: F_BODY, fontSize: 14, color: t.fog } }, "天")),
              h("div", { className: "flex items-center gap-2.5", style: { marginTop: 8 } },
                h("span", { className: "flex items-center gap-1", style: { background: "#ffe1ea", color: "#c02a52", borderRadius: 999, padding: "3px 12px" } },
                  h(IHeart, { size: 12, color: "#e0528a", filled: true }),
                  h("span", { style: { fontFamily: F_DISPLAY, fontSize: 13.5 } }, "甜蜜值 " + (Math.round((sweet.value || 0) * 10) / 10))),
                onSetSince ? h("button", { onClick: () => { const d = new Date(cp[view].since || Date.now()); setSinceVal(d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0")); setSinceEdit(v => !v); }, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 11, color: t.tint } }, sinceEdit ? "收起" : h("span", { className: "flex items-center", style: { gap: 4 } }, h(IPencil, { size: 11, color: t.tint }), "起始日")) : null)),
            h("button", { onClick: () => onCheckinSweet(partner), disabled: sweetDone, className: "active:opacity-70 disabled:opacity-100", style: { background: sweetDone ? t.line : "#ffd0dc", color: sweetDone ? t.fog : "#c02a52", fontFamily: F_DISPLAY, fontSize: 14.5, padding: "9px 20px", borderRadius: 999, flexShrink: 0 } },
              sweetDone ? "已打卡" : h("span", { className: "flex items-center", style: { gap: 5 } }, h(IHeart, { size: 13, color: "#c02a52", filled: true }), "打卡"))),
          sinceEdit ? h("div", { className: "flex items-center gap-2", style: { marginTop: 10 } },
            h("input", { type: "date", value: sinceVal, onChange: e => setSinceVal(e.target.value), className: "outline-none px-3 py-2 rounded-lg", style: { fontFamily: F_BODY, fontSize: 13.5, background: t.bg2, color: t.ink, border: "1px solid " + t.line } }),
            h("button", { onClick: () => { if (sinceVal) { onSetSince(partner.id, sinceVal); setSinceEdit(false); } }, className: "active:opacity-70", style: { background: t.ink, color: t.bg2, fontFamily: F_DISPLAY, fontSize: 13.5, padding: "8px 18px", borderRadius: 10 } }, "保存"),
            h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog } }, "第几天 / 时间轴起点跟着变")) : null,
          // —— 情侣空间首页：把已有模块重新织成「今天 / 最近 / 长期共同层」——
          h("section", { style: { marginTop: 22 } },
            h("div", { className: "flex items-end justify-between", style: { marginBottom: 10 } },
              h("div", null,
                h(Eyebrow, null, "今天 · " + todayK.slice(5).replace("-", ".")),
                h("div", { style: { fontFamily: F_DISPLAY, fontSize: 22, color: t.ink, marginTop: 3 } }, "今天的我们")),
              h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog } }, bToday.length ? "今天留下 " + bToday.length + " 件事" : "安静的一天也算一天")),
            h("div", { style: { borderRadius: 22, overflow: "hidden", border: "1px solid #eadde3", background: "linear-gradient(135deg,#fff8f7 0%,#f6f0f7 100%)" } },
              h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr" } },
                h("div", { style: { minHeight: 98, padding: "15px 14px", borderRight: "1px solid #eadde3" } },
                  h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: "#927280" } }, partner.name + " 此刻"),
                  bMood && bMood.label ? h("div", { className: "flex items-center gap-2", style: { marginTop: 10 } },
                    moodFaceOf(bMood.label) ? h(MoodGlyph, { mood: moodFaceOf(bMood.label), size: 30 }) : null,
                    h("div", { className: "min-w-0" },
                      h("div", { style: { fontFamily: F_DISPLAY, fontSize: 17, color: "#765865", lineHeight: 1.2 } }, bMood.label),
                      bMood.ago ? h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: "#a08795", marginTop: 2 } }, bMood.ago) : null))
                    : h("div", { style: { fontFamily: F_DISPLAY, fontSize: 18, color: "#765865", marginTop: 12 } }, "还没聊过天")),
                h("button", { onClick: () => setSub("timeline"), className: "active:opacity-70", style: { minHeight: 98, padding: "15px 14px", textAlign: "left" } },
                  h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: "#927280" } }, bAnn ? "下一件值得等的事" : "日历上等你们写"),
                  bAnn ? h(Fragment, null,
                    h("div", { className: "flex items-baseline gap-1", style: { marginTop: 7 } },
                      h("span", { style: { fontFamily: F_DISPLAY, fontStyle: "italic", fontSize: 29, color: "#a74d70", lineHeight: 1 } }, bAnn.days === 0 ? "今天" : bAnn.days),
                      bAnn.days ? h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: "#927280" } }, "天后") : null),
                    h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: "#765865", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, bAnn.name))
                    : h("div", { style: { fontFamily: F_DISPLAY, fontSize: 18, color: "#765865", marginTop: 12 } }, "添一个纪念日"))),
              bTodayRows)),
          h("section", { style: { marginTop: 20 } },
            h("div", { className: "flex items-center justify-between", style: { marginBottom: 9 } },
              h("div", { style: { fontFamily: F_DISPLAY, fontSize: 19, color: t.ink } }, "最近发生"),
              h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog } }, "从你俩的角落里捞出来")),
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
                  bRecent.map(x => h("button", { key: x.id, onClick: () => setSub(x.sub),
                    className: "w-full active:opacity-70 shrink-0", style: { display: "flex", alignItems: "center", gap: 9,
                      height: NOTIFY_ROW, padding: "0 11px", textAlign: "left", borderRadius: 14,
                      background: "rgba(255,255,255,.8)", border: "1px solid rgba(146,114,128,.16)",
                      backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                      boxShadow: "0 3px 10px rgba(92,60,74,.07)" } },
                    h("span", { "aria-hidden": "true", style: { width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                      background: BAND[x.sub] || t.line, color: "#fff", display: "flex", alignItems: "center",
                      justifyContent: "center", fontFamily: F_DISPLAY, fontSize: 13,
                      boxShadow: "inset 0 -5px 9px rgba(0,0,0,.10)" } }, APPCH[x.sub] || "·"),
                    h("div", { className: "min-w-0 flex-1" },
                      h("div", { className: "flex items-baseline", style: { gap: 6 } },
                        h("div", { style: { fontFamily: F_BODY, fontSize: 9.5, letterSpacing: ".04em", color: "#96788a", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, x.label),
                        h("div", { style: { fontFamily: F_BODY, fontSize: 9, color: "#b09aa6", flexShrink: 0 } }, notifyAgo(x.ts))),
                      h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: "#4b3b44", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, x.text)))))
                ,
                // 底下压一层渐隐：不写「往下还有」也看得出这一叠没到头
                bRecent.length > NOTIFY_SHOW ? h("div", { "aria-hidden": "true", style: { position: "absolute",
                  left: 0, right: 0, bottom: 0, height: 22, borderRadius: "0 0 14px 14px", pointerEvents: "none",
                  background: "linear-gradient(transparent," + bgA(0.9) + ")" } }) : null)
                : h("div", { style: { borderRadius: 16, border: "1px dashed rgba(146,114,128,.28)", padding: "18px 14px", fontFamily: F_BODY, fontSize: 12, color: t.fog, textAlign: "center", lineHeight: 1.8 } }, "还没有推送。", h("br"), "便签、情书、日记、合照和实现了的愿望都会推到这儿。"))),
          h("section", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 20 } },
            h("button", { onClick: () => setSub("archive"), className: "active:opacity-70", style: { minHeight: 128, borderRadius: 19, padding: "14px", textAlign: "left", background: "#f2eee7", border: "1px solid #dfd7ca", position: "relative", overflow: "hidden" } },
              h("div", { style: { position: "absolute", right: -10, bottom: -24, fontFamily: F_DISPLAY, fontSize: 82, lineHeight: 1, color: "rgba(115,91,67,.08)" } }, "档"),
              h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: "#8a745e", letterSpacing: ".14em" } }, "只由你亲手写"),
              h("div", { style: { fontFamily: F_DISPLAY, fontSize: 19, color: "#68513d", marginTop: 8 } }, "我们的档案"),
              h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: "#8a745e", marginTop: 22 } }, bArchiveN ? "已封存 " + bArchiveN + "/" + COUPLE_ARCHIVE_FIELDS.length + " 页" : "称呼、梗与小仪式")),
            h("button", { onClick: () => setSub("wishes"), className: "active:opacity-70", style: { minHeight: 128, borderRadius: 19, padding: "14px", textAlign: "left", background: "#f8edef", border: "1px solid #ebd4da", position: "relative", overflow: "hidden" } },
              // 和左边那张的「档」配成一对：两张卡的水印得是同一种东西（一个汉字），
              // 原来这儿是个 ✦ ——一张汉字一张符号，并排摆着就是两套
              h("div", { style: { position: "absolute", right: -10, bottom: -24, fontFamily: F_DISPLAY, fontSize: 82, lineHeight: 1, color: "rgba(174,75,105,.10)" } }, "愿"),
              h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: "#a46d7e", letterSpacing: ".14em" } }, "以后想一起做的"),
              h("div", { style: { fontFamily: F_DISPLAY, fontSize: 19, color: "#8e4960", marginTop: 8 } }, "愿望板"),
              h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: "#a46d7e", marginTop: 22 } }, bWishes.length ? bWishOpen + " 件还在等 · " + bWishes.filter(w => w.status === "done").length + " 件实现" : "把以后钉在这里"))),
          // —— 情侣空间 app 拼贴：六列做出宽窄、高低与转角层级；顺序固定，刷新不乱跳。——
          h("div", { className: "flex items-end justify-between", style: { marginTop: 24, marginBottom: 10 } },
            h("div", null,
                            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 21, color: t.ink, marginTop: 3 } }, "我们的小房间")),
            h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog } }, "挑一扇门进去")),
          (() => {
            const PAPER = "#fffdfa", PLINE = "rgba(92,72,62,.13)";
            // ── v59.24 整个换掉网格（她 2026-09-01：「我觉得是网格和颜色还有背景的问题，
            //    还有太条条框框了都是方框，混着一个圆的。后续我打算继续加内容进去的，
            //    再继续叠罗汉好无聊」）──
            // 前两版是在 bento 里修装饰：换配色、改圆角、加水印字。可病在结构——
            // **六列网格每加一格就更糟**，而她明说了以后还要往里加东西。
            // 现在改成【三个面】，每个面有自己的底和自己的规矩：
            //   ① 今天   一块深的，只放此刻的事（第几天、他这会儿怎么样）
            //   ② 墙上   贴着的东西：照片、票根、卡片——**不对齐**，各自宽度不同、
            //            轻微歪着，用 flex-wrap 不用 grid，所以加一样就是多贴一张
            //   ③ 收着的 一列书脊：情书、日记、约定……加一样就是多一本，不撑版面
            // 形状不再是「一堆方框混一个圆」，而是【跟内容对应的形状】：照片是照片、
            // 票根是票根、册子是书脊。那个孤零零的圆去掉了——它是唯一一个，
            // 读起来就是随机。
            const wall = (k, o) => h("button", { key: k, onClick: o.onClick || (() => setSub(k)), className: "active:opacity-75",
              style: { position: "relative", textAlign: "left", width: o.w, flexGrow: o.grow || 0, minWidth: 0, overflow: "hidden",
                borderRadius: o.radius == null ? 5 : o.radius, padding: o.pad || "12px 13px",
                background: o.bg || PAPER, border: o.border || ("1px solid " + PLINE),
                transform: o.tilt ? "rotate(" + o.tilt + "deg)" : null,
                boxShadow: o.flat ? "none" : "0 8px 20px rgba(68,45,58,.10)" } },
              o.deco || null,
              o.dot ? h("span", { style: { position: "absolute", top: 9, right: 10, width: 7, height: 7, borderRadius: 999, background: "#e0524a" } }) : null,
              o.kids);
            // 书脊：左边一条色带 + 一行字 + 右边一句近况。加一本就是多一行，不撑版面。
            const spine = (k, o) => h("button", { key: k, onClick: o.onClick || (() => setSub(k)), className: "w-full text-left active:opacity-70",
              style: { display: "flex", alignItems: "center", gap: 11, padding: "13px 4px 13px 0", borderBottom: "1px solid " + PLINE, position: "relative" } },
              h("span", { "aria-hidden": "true", style: { width: 3, height: 26, borderRadius: 3, background: o.band, flexShrink: 0 } }),
              h("div", { style: { width: 58, flexShrink: 0, fontFamily: F_BODY, fontSize: 11.5, color: o.band } }, o.zh),
              h("div", { className: "flex-1 min-w-0", style: { fontFamily: F_DISPLAY, fontSize: 14, lineHeight: 1.5, color: t.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, o.say),
              o.dot ? h("span", { style: { width: 7, height: 7, borderRadius: 999, background: "#e0524a", flexShrink: 0 } }) : null);
            const mkSig = makeupSignalFor ? makeupSignalFor(bCid) : { on: false, why: "" };
            const mkCur = makeupOf ? makeupOf(bCid) : null;
            // 英文眉标 v62.12 清掉（no-english-titles）：ON THE WALL / KEPT 换任何 app 都成立，
            // 「墙上」「收着的」本来就在——那行英文纯属装饰。
            const eyebrow = (zh, right) => h("div", { className: "flex items-end justify-between", style: { marginTop: 26, marginBottom: 11 } },
              h("div", { style: { fontFamily: F_DISPLAY, fontSize: 19, color: t.ink } }, zh),
              right ? h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog } }, right) : null);
            return h(Fragment, null,
              // ── ① 今天 ────────────────────────────────────────
              h("button", { onClick: () => setSub("timeline"), className: "w-full text-left active:opacity-80",
                style: { position: "relative", display: "block", overflow: "hidden", borderRadius: 22, padding: "20px 20px 18px",
                  background: "linear-gradient(155deg,#7d3f57 0%,#5b2f46 62%,#4a2739 100%)", boxShadow: "0 16px 34px rgba(68,32,52,.22)" } },
                h("div", { "aria-hidden": "true", style: { position: "absolute", right: -30, top: -46, width: 168, height: 168, borderRadius: 999, background: "radial-gradient(circle,rgba(255,255,255,.10),rgba(255,255,255,0) 68%)" } }),
                h("div", { style: { position: "relative", fontFamily: "'Archivo',sans-serif", fontSize: 9.5, letterSpacing: ".22em", color: "rgba(255,255,255,.5)" } }, "今天"),
                bAnn
                  ? h("div", { style: { position: "relative", marginTop: 12 } },
                      h("div", { className: "flex items-baseline", style: { gap: 6 } },
                        h("span", { style: { fontFamily: F_DISPLAY, fontStyle: "italic", fontSize: 54, lineHeight: 1, color: "#fff" } }, bAnn.days === 0 ? "今天" : bAnn.days),
                        bAnn.days > 0 ? h("span", { style: { fontFamily: F_BODY, fontSize: 12, color: "rgba(255,255,255,.66)" } }, "天") : null),
                      h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: "rgba(255,255,255,.72)", marginTop: 6 } }, "距「" + bAnn.name + "」"))
                  : h("div", { style: { position: "relative", marginTop: 12, fontFamily: F_DISPLAY, fontSize: 23, color: "#fff", lineHeight: 1.35 } },
                      bTlN ? "记了 " + bTlN + " 个瞬间" : "从这里开始"),
                h("div", { style: { position: "relative", fontFamily: F_BODY, fontSize: 11, color: "rgba(255,255,255,.5)", marginTop: 14 } }, "时间轴与纪念日")),
              // 纪念日当天的仪式（v62.11）：就今天这一天露出来——让他写一条「走到今天」的感慨，
              // 落进时光轴（还是那条 genTimelineMusing 链，只是带上了是哪个日子）。一年就那么几次。
              bAnn && bAnn.days === 0 ? h("button", { onClick: () => !tlGen && onGenTimeline(partner, bAnn.name), disabled: tlGen,
                className: "w-full text-left active:opacity-75 disabled:opacity-60",
                style: { display: "block", marginTop: 10, borderRadius: 13, padding: "12px 15px", minHeight: 44,
                  background: "#fdf3e3", border: "1px solid #ecd9b8" } },
                h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14.5, color: "#8a6a3a", lineHeight: 1.5 } },
                  tlGen ? partner.name + " 写着…" : "今天是「" + bAnn.name + "」——让 " + partner.name + " 写写走到今天")) : null,
              // 和好间：没事时是一条淡纸；真有事了才压上来
              h("button", { onClick: () => setSub("makeup"), className: "w-full text-left active:opacity-75",
                style: { display: "block", marginTop: (mkSig.on || mkCur) ? 12 : 9, borderRadius: 13, padding: (mkSig.on || mkCur) ? "14px 15px" : "9px 14px",
                  background: (mkSig.on || mkCur) ? "#f7ebe7" : "transparent",
                  border: "1px solid " + ((mkSig.on || mkCur) ? "#ecd3cb" : PLINE),
                  transform: (mkSig.on || mkCur) ? "rotate(-0.5deg)" : null,
                  boxShadow: (mkSig.on || mkCur) ? "0 10px 22px rgba(120,70,60,.13)" : "none" } },
                h("div", { style: { fontFamily: F_DISPLAY, fontSize: (mkSig.on || mkCur) ? 15.5 : 12.5, lineHeight: 1.5, color: (mkSig.on || mkCur) ? "#8d5a4f" : t.fog } },
                  mkCur ? "和好间 · 还没了结的那一段" : mkSig.on ? mkSig.why : "和好间 · 这会儿没什么事")),
              // ── ② 墙上：贴着的东西，不对齐 ──────────────────────
              eyebrow("墙上", "贴着的"),
              h("div", { className: "flex flex-wrap", style: { gap: 12, alignItems: "flex-start" } },
                // 合照：一张真照片，白边、歪着
                h("button", { key: "album", onClick: () => setSub("album"), className: "active:opacity-80",
                  style: { position: "relative", width: "44%", padding: 7, paddingBottom: 26, background: "#fff", border: "none", borderRadius: 3,
                    transform: "rotate(-2.2deg)", boxShadow: "0 12px 26px rgba(68,45,58,.20)" } },
                  h("div", { style: { position: "relative", width: "100%", paddingTop: "96%", overflow: "hidden", background: bPhotos.length ? "#20141f" : "#efece6" } },
                    h("div", { style: { position: "absolute", inset: 0 } },
                      bPhotos.length ? h(AlbumPhoto, { photo: bPhotos[0], cover: true }) : null)),
                  h("div", { style: { position: "absolute", left: 9, right: 9, bottom: 7, fontFamily: F_BODY, fontSize: 10.5, color: "#8b8177", textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } },
                    bPhotos.length ? "合照 · " + bPhotos.length + " 张" : "还没有合照")),
                // 拍立得旁边：照相馆，一张空相纸
                wall("studio", { w: "48%", grow: 1, tilt: 1.8, pad: "14px 14px 16px", bg: "#fbf7fb", border: "1px solid #e6dcee",
                  kids: h("div", null,
                    h("div", { style: { fontFamily: F_BODY, fontSize: 10, letterSpacing: ".14em", color: "#a692bd" } }, "照相馆"),
                    h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14.5, lineHeight: 1.55, color: "#6d5390", marginTop: 8 } },
                      bShotLast ? one(bShotLast.scene, 16) : "挑身衣服拍一张"),
                    bShotsN > 1 ? h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: "#a692bd", marginTop: 5 } }, "拍过 " + bShotsN + " 张") : null) }),
                // 票根：整宽一条，虚线横贯
                wall("firsts", { w: "100%", radius: 8, tilt: -0.5, pad: "14px 15px", bg: "#faf7f0", border: "1px solid #e6ddca",
                  // ⚠️虚线不能横穿：它会正好压在字上。真票根的撕线是【竖的】，
                  // 在存根那一头，两端各咬一个半圆缺口。
                  deco: h(Fragment, null,
                    h("div", { "aria-hidden": "true", style: { position: "absolute", right: 74, top: 6, bottom: 6, borderLeft: "1px dashed rgba(150,125,80,.4)" } }),
                    h("div", { "aria-hidden": "true", style: { position: "absolute", right: 69, top: -6, width: 11, height: 11, borderRadius: 999, background: t.bg } }),
                    h("div", { "aria-hidden": "true", style: { position: "absolute", right: 69, bottom: -6, width: 11, height: 11, borderRadius: 999, background: t.bg } })),
                  kids: h("div", { className: "flex items-center", style: { gap: 12, position: "relative" } },
                    h("div", { className: "flex-1 min-w-0" },
                      h("div", { style: { fontFamily: F_BODY, fontSize: 9.5, letterSpacing: ".16em", color: "#a89877" } }, "第一次"),
                      h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15.5, color: "#7d6f5a", marginTop: 5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } },
                        bFirstLast ? one(bFirstLast.zh || bFirstLast.title || bFirstLast.note, 18) : "还没走过第一次")),
                    h("div", { style: { width: 58, flexShrink: 0, textAlign: "center" } },
                      h("div", { style: { fontFamily: F_DISPLAY, fontStyle: "italic", fontSize: 24, lineHeight: 1, color: "#7d6f5a" } }, bFirstsN || 0),
                      h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 8.5, letterSpacing: ".14em", color: "#a89877", marginTop: 3 } }, "存根"))) }),
                // 如果馆：墙上唯一一块深的
                wall("ifroom", { w: "100%", radius: 16, pad: "16px 16px 15px", bg: "linear-gradient(140deg,#241f36,#141222)", border: "1px solid #332c4a",
                  deco: h("div", { "aria-hidden": "true", style: { position: "absolute", right: 14, top: -26, width: 92, height: 92, borderRadius: 999, border: "1px solid rgba(169,156,203,.24)" } }),
                  kids: h("div", { style: { position: "relative" } },
                    h("div", { style: { fontFamily: F_BODY, fontSize: 10, letterSpacing: ".16em", color: "rgba(169,156,203,.66)" } }, "如果"),
                    h("div", { style: { fontFamily: F_DISPLAY, fontSize: 17, color: "#e0d6f5", lineHeight: 1.4, marginTop: 7 } },
                      bIfLast ? "「" + one(bIfLast.title, 14) + "」" : "同样这两个人，换掉当初的一样东西"),
                    bIfLast ? h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: "rgba(200,188,230,.6)", marginTop: 5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, one(bIfLast.premise, 24)) : null) }),
                // 抽卡：真做成一张卡（原来是这一页唯一一个圆，读起来就是随机）
                wall("gacha", { w: "46%", radius: 10, tilt: 1.2, pad: "13px 13px 14px", bg: "linear-gradient(150deg,#fbf1f7,#f3e3ee)", border: "1px solid #e8d4e4",
                  dot: bGachaOpen > 0,
                  kids: h("div", null,
                    h("div", { style: { fontFamily: F_BODY, fontSize: 10, letterSpacing: ".14em", color: "#b78bad" } }, "抽卡"),
                    h("div", { className: "flex items-baseline", style: { gap: 4, marginTop: 7 } },
                      h("span", { style: { fontFamily: F_DISPLAY, fontStyle: "italic", fontSize: 27, lineHeight: 1, color: "#96678c" } }, bGachaPts || 0),
                      h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: "#b78bad" } }, "点")),
                    h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: "#b78bad", marginTop: 5 } },
                      bGachaOpen ? bGachaOpen + " 张还没兑" : "陪着他就有点数")) }),
                // 抽屉：半开的一格
                wall("drawer", { w: "46%", grow: 1, radius: "4px 4px 15px 15px", pad: "13px 13px 17px", bg: "#faf3e4", border: "1px solid #e9dcc0",
                  deco: h("div", { "aria-hidden": "true", style: { position: "absolute", left: "50%", bottom: 9, width: 42, height: 4, marginLeft: -21, borderRadius: 99, background: "rgba(120,95,45,.3)" } }),
                  kids: h("div", null,
                    h("div", { style: { fontFamily: F_BODY, fontSize: 10, letterSpacing: ".14em", color: "#b09a68" } }, "抽屉"),
                    h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15.5, color: "#7a6338", marginTop: 8 } }, "拉开看看")) }),
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
                      h("div", { style: { position: "relative", width: 46, height: 46, flexShrink: 0, borderRadius: 999, background: "radial-gradient(circle at 50% 50%, #101014 0 30%, #2b2b30 31% 61%, #17171b 62%)", boxShadow: "0 6px 16px rgba(0,0,0,.4)", display: "flex", alignItems: "center", justifyContent: "center", animation: dOn ? "wk-spin 6s linear infinite" : "none" } },
                        dFace && dFace.cover ? h("img", { src: dFace.cover, style: { width: 22, height: 22, borderRadius: 999, objectFit: "cover" } }) : h("span", { "aria-hidden": "true", style: { width: 9, height: 9, borderRadius: 999, background: "#0d0d10", boxShadow: "0 0 0 3px rgba(230,223,242,.16)" } })),
                      h("div", { className: "flex-1 min-w-0" },
                        h("div", { style: { fontFamily: F_BODY, fontSize: 9.5, letterSpacing: ".18em", color: "rgba(200,190,215,.55)" } }, "我们的唱片"),
                        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14.5, color: "#e6dff2", marginTop: 5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } },
                          dOn ? (dNow ? "《" + dNow.title + "》正在转" : "唱片正在转") : dSongs.length ? "刻了 " + dSongs.length + " 首" : "还没刻歌"),
                        dFace && dFace.note ? h("div", { style: { fontFamily: F_DISPLAY, fontStyle: "italic", fontSize: 10.5, color: "rgba(200,190,215,.62)", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, "「" + one(dFace.note, 24) + "」") : null)) });
                })()),
              // ── ③ 收着的：一列书脊 ─────────────────────────────
              eyebrow("收着的", "一本一本翻"),
              h("div", { style: { borderTop: "1px solid " + PLINE } },
                // ⚠️信这条记录的正文叫 body（title 可空）。跟底下「他记得的」那行同一个病：
                //   原来读 content/text——两个都不存在，没标题的信在书脊上永远是空白。
                spine("letters", { zh: "情书", band: "#b08d52", dot: bUnread > 0,
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
                // 摆出来的该是【他记得的那一版】，那才是这一格的内容。
                spine("recall", { zh: "他记得的", band: "#93707c",
                  dot: (coupleRecall || []).some(function (x) { return x.characterId === bCid && x.unread; }),
                  say: bRecallLast ? one(bRecallLast.his || bRecallLast.mine, 22) : "同一件事，两个人" }),
                spine("pacts", { zh: "说好的", band: "#8f7d5c",
                  dot: (function () { const p2 = couplePactsOf ? couplePactsOf(bCid) : null; return !!(p2 && (p2.due || []).some(function (x) { return x.dueTs && Date.now() >= x.dueTs - 86400000; })); })(),
                  say: bPactLast ? one(bPactLast.text || bPactLast.title, 22) : "还没说好什么" }),
                spine("capsule", { zh: "时光胶囊", band: "#7d7396", dot: bCapsuleDue > 0,
                  onClick: () => onOpenCapsule && onOpenCapsule(bCid),
                  say: bCapsuleDue ? bCapsuleDue + " 封等你拆" : "写给以后的我们" }))
            );
})(),
          h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, textAlign: "center", marginTop: 14 } }, "只属于你俩的私密层。"))),
      cpEdit && h(Sheet, { onClose: () => setCpEdit(false), tall: true },
        h(Eyebrow, { style: { marginBottom: 16 } }, "自定义情侣空间"),
        imgRow("背景图", bgRef, "bg", !!cprof.bg),
        imgRow("我的头像", myAvRef, "myAvatar", !!cprof.myAvatar),
        imgRow("TA 的头像", chAvRef, "charAvatar", !!cprof.charAvatar),
        h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginTop: 4, lineHeight: 1.6 } }, "这里的头像只用于情侣空间，不影响角色原本的头像。图片会自动压缩。"),
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
      h("div", { style: { position: "absolute", left: 0, top: 7, height: 2, width: (n / maxDays * 100) + "%", background: "#e08aa0", borderRadius: 2 } }),
      ticks.map((tk, i) => h("div", { key: i, style: { position: "absolute", left: (tk.at * 100) + "%",
        top: tk.big ? 3 : 5, width: 1, height: tk.big ? 10 : 6, background: "#e08aa0", opacity: tk.big ? 0.85 : 0.5 } })),
      h("div", { style: { position: "absolute", left: "calc(" + (n / maxDays * 100) + "% - 3px)", top: 5,
        width: 6, height: 6, borderRadius: 999, background: "#d16a86" } }));
  };
  return h("div", { className: "h-full flex flex-col", style: { background: t.bg } },
    // 紧凑标题栏（mobile-ui-layout 第 1 条）：原来那个 30px 大标题 + US/COUPLE 占掉小半屏
    h("div", { className: "shrink-0 flex items-center px-4 pb-2", style: { paddingTop: safeTop(10) } },
      h("button", { onClick: onBack, "aria-label": "返回", className: "active:opacity-50 flex items-center justify-center", style: { width: 40, height: 40, marginLeft: -8 } }, h(IArrow, { size: 19, color: t.ink })),
      h("div", { className: "flex-1 min-w-0 text-center px-1" },
        h("div", { className: "truncate", style: { fontFamily: F_DISPLAY, fontSize: 16, color: t.ink, lineHeight: 1.15 } }, "情侣"),
        entries.length ? h("div", { className: "truncate", style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 1 } },
          entries.length + " 段 · 最久的走了 " + maxDays + " 天") : null),
      h("div", { className: "flex items-center justify-end", style: { minWidth: 40 } },
        characters.length > 0 ? h("button", { onClick: () => setPick(true), className: "active:opacity-50" }, h(IHeart, { size: 19, color: t.ink })) : null)),
    h("div", { className: "flex-1 min-h-0 overflow-y-auto px-6 pb-8" },
      entries.length === 0
        ? h("div", { className: "pt-8" },
            h("div", { style: { fontFamily: F_BODY, fontSize: 13, lineHeight: 1.8, color: t.fog } }, "还没有情侣关系。点右上角 ♥ 选一位角色发送邀请——邀请会出现在你和 TA 的聊天里，TA 会依据关系与好感决定接不接受。"),
            characters.length > 0 && h("button", { onClick: () => setPick(true), className: "mt-4 active:opacity-70", style: { fontFamily: F_BODY, fontSize: 13, color: t.ink, borderBottom: "1.5px solid " + t.ink, paddingBottom: 2 } }, "♥ 发送情侣邀请"))
        : h(Fragment, null,
            entries.map((e, idx) => {
              const tog = e.st.status === "together";
              const n = tog ? (daysWith(e.st.since) || 0) : 0;
              const tags = tog ? unreadTagsFor(e.char.id) : [];
              return h("div", { key: e.char.id, className: "flex items-start", style: { gap: 13, padding: "16px 0",
                borderTop: idx === 0 ? "none" : "1px solid " + t.line, opacity: tog ? 1 : 0.6 } },
                // 她自己的头像原来每张卡里都摆一遍——她知道自己是谁，删掉
                h("div", { className: "shrink-0", style: { position: "relative" } },
                  h(Avatar, { character: e.char, size: 52, radius: 14 }),
                  // 有新情书＝头像上一个红点，跟聊天列表的未读同一套语汇，不是粉药丸
                  tags.length ? h("span", { style: { position: "absolute", top: -2, right: -2, width: 10, height: 10,
                    borderRadius: 999, background: "#e0524a", boxShadow: "0 0 0 2px " + t.bg } }) : null),
                h("button", { onClick: () => tog && setView(e.char.id), className: "flex-1 min-w-0 text-left active:opacity-75" },
                  h("div", { className: "flex items-baseline", style: { gap: 8 } },
                    h("div", { className: "truncate", style: { fontFamily: F_DISPLAY, fontSize: 17, color: t.ink } }, e.char.name),
                    // 项目多了别把名字挤没：最多点两样，剩下的归成「等」
                    tags.length ? h("span", { className: "shrink-0", style: { fontFamily: F_BODY, fontSize: 11, color: "#c02a52" } }, "新的" + tags.slice(0, 2).join("、") + (tags.length > 2 ? "等" : "")) : null),
                  tog
                    ? h(Fragment, null,
                        h("div", { className: "flex items-baseline", style: { gap: 6, marginTop: 3 } },
                          h("span", { style: { fontFamily: F_DISPLAY, fontSize: 26, lineHeight: 1, color: "#d16a86" } }, String(n)),
                          h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog } }, "天 · 从 " + dayFmt(e.st.since) + " 起")),
                        trail(n))
                    : h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, marginTop: 4 } }, "邀请还没有回应")),
                tog && onUnlink ? h("button", { onClick: ev => { ev.stopPropagation(); setUnlinkChar(e.char); },
                  "aria-label": "解除情侣关系", className: "shrink-0 active:opacity-60 flex items-start justify-center",
                  style: { width: 34, height: 34, marginTop: -2 } }, h(CGlyph, { k: "heartbreak", size: 17, color: t.fog })) : null);
            }))),
    unlinkChar && onUnlink ? h(Sheet, { onClose: () => setUnlinkChar(null) },
      h(Eyebrow, { style: { marginBottom: 10 } }, "解除和 " + unlinkChar.name + " 的情侣关系"),
      h("div", { style: { fontFamily: F_BODY, fontSize: 12, lineHeight: 1.7, color: t.fog, marginBottom: 14 } }, "情侣空间的记录会全部保留（复合后还在）。解除会降低好感，且至少一周后、好感回到一定程度，TA 才可能同意复合。你想怎么解除？"),
      h("button", { onClick: () => { onUnlink(unlinkChar, "sudden"); setUnlinkChar(null); }, className: "w-full text-left active:opacity-70", style: { background: t.bg2, border: "1px solid " + t.line, borderRadius: 14, padding: "13px 15px", marginBottom: 10 } },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15, color: t.ink } }, "直接解除"),
        h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginTop: 2 } }, "毫无预兆 · TA 会错愕地主动问你 · 好感 −5")),
      h("button", { onClick: () => { onUnlink(unlinkChar, "fight"); setUnlinkChar(null); }, className: "w-full text-left active:opacity-70", style: { background: t.bg2, border: "1px solid " + t.line, borderRadius: 14, padding: "13px 15px", marginBottom: 10 } },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15, color: t.ink } }, "带着情绪解除"),
        h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginTop: 2 } }, "吵架 / 闹别扭时 · 按近期聊天+人设+心情扣 5~10 好感 · TA 会有情绪地回应")),
      h("button", { onClick: () => setUnlinkChar(null), className: "w-full active:opacity-60", style: { fontFamily: F_BODY, fontSize: 13, color: t.fog, padding: "8px 0" } }, "算了，不解除")) : null,
    pickSheet);
}

// ============================================================
// CONFIG
// ============================================================
// 一起听（展示型）：自定义唱片封面 + 添加"正在听"的歌（歌名/歌手/封面）+ 歌单，不真放声音
function ListenTogether({ listen, characters, onBack, onSetDisc, onSetCover, onAddNetease, onAddLocal, onPlaySong, onRemoveSong, onSetPartner, apiBase, onSetApiBase, cookie, onSetCookie, onTestLogin, onAddNeteaseResult, onPlayResult, onPlayResultList, onAddResultToPlaylist, onCreatePlaylist, onDeletePlaylist, onRenamePlaylist, onAddToPlaylist, onRemoveFromPlaylist, onRenameSong, onGenCharPlaylist, onSetAutoComment, player, onTogglePlay, onStep, onSeek, onToggleFav, playMode, onCyclePlayMode, gen, genCharPl }) {
  const t = useTheme();
  const data = listen || {};
  const songs = data.songs || [];
  const playlists = data.playlists || [];
  const partner = (characters || []).find(c => c.id === data.partnerId) || null;
  // 当前歌可能在「全部」库 / 某歌单 / 临时播放的搜索结果(nowSong) 里 → 都能找到，别只在 songs 里找（否则会卡在 songs[0]）
  const resolveSong = id => {
    if (!id) return null;
    if (id === KEEPALIVE_ID) return KEEPALIVE_SONG;
    if (data.nowSong && data.nowSong.id === id) return data.nowSong;
    // 云村「播放全部」不会把整张列表塞进本地曲库，而是放在 nowBatch。
    // 队列页若漏查这里，就只认得 nowSong/当前曲，视觉上永远只有一首。
    const batchSong = (data.nowBatch || []).find(x => x.id === id);
    if (batchSong) return batchSong;
    let s = songs.find(x => x.id === id); if (s) return s;
    for (const pl of playlists) { const f = (pl.songs || []).find(x => x.id === id); if (f) return f; }
    return null;
  };
  // App 重开后 audio 尚未重新挂 src，但持久化的 nowId 仍代表上次停留的曲目。
  const nowId = (player && player.songId) || data.nowId || (songs[0] && songs[0].id) || null;
  const now = resolveSong(nowId) || songs[0] || null;
  const nowQueue = (data.nowQueue && data.nowQueue.length ? data.nowQueue : songs.map(s => s.id)).map(resolveSong).filter(Boolean);
  const idx = nowQueue.findIndex(s => s.id === nowId);
  const nowCover = (now && now.cover) || null;
  const discImg = data.disc || null;
  const playing = !!(player && player.playing);
  const dur = (player && player.dur) || 0, cur = (player && player.t) || 0;
  const frac = dur ? cur / dur : 0;
  const fmt = s => { s = Math.max(0, Math.floor(s || 0)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };
  // v54.51 网易云化：连了账号就以「发现」(cloud)为落地页，正在放歌仍优先回播放页；
  // 没连账号退回本地曲库(home)。四 tab：推荐 / 播放 / 我的 / 曲库
  const [nav, setNav] = useState(now ? "play" : ((apiBase && cookie) ? "cloud" : "home"));
  const [addTab, setAddTab] = useState(apiBase ? "search" : "netease"); // search | netease | local
  const [link, setLink] = useState("");
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [localFile, setLocalFile] = useState(null);
  const [q, setQ] = useState("");
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [apiEdit, setApiEdit] = useState(false);
  const [apiInput, setApiInput] = useState(apiBase || "");
  const [ckEdit, setCkEdit] = useState(false);
  const [ckInput, setCkInput] = useState(cookie || "");
  // 网易云扫码登录（v54.10）：/login/qr/key → /login/qr/create(qrimg) → 轮询 /login/qr/check
  // 800=过期 801=等扫 802=已扫待确认 803=成功(带 cookie)。轮询句柄放 ref，离开界面/取消时清掉。
  const [qr, setQr] = useState({ img: null, status: null, busy: false });
  const qrTimerRef = useRef(null);
  const stopQrLogin = () => { if (qrTimerRef.current) { clearInterval(qrTimerRef.current); qrTimerRef.current = null; } setQr({ img: null, status: null, busy: false }); };
  useEffect(() => () => { if (qrTimerRef.current) clearInterval(qrTimerRef.current); }, []);
  const startQrLogin = async () => {
    if (!apiBase || qr.busy) return;
    stopQrLogin(); setQr({ img: null, status: null, busy: true });
    try {
      const j = u => fetch(apiBase + u + (u.includes("?") ? "&" : "?") + "timestamp=" + Date.now()).then(r => r.json());
      const keyRes = await j("/login/qr/key");
      const unikey = keyRes && keyRes.data && keyRes.data.unikey;
      if (!unikey) throw new Error("拿二维码钥匙失败");
      const qrRes = await j("/login/qr/create?key=" + encodeURIComponent(unikey) + "&qrimg=true");
      const img = qrRes && qrRes.data && qrRes.data.qrimg;
      if (!img) throw new Error("生成二维码失败");
      setQr({ img: img, status: "waiting", busy: false });
      qrTimerRef.current = setInterval(async () => {
        try {
          const c = await j("/login/qr/check?key=" + encodeURIComponent(unikey));
          if (!c) return;
          if (c.code === 802) setQr(p => ({ ...p, status: "scanned" }));
          else if (c.code === 800) { clearInterval(qrTimerRef.current); qrTimerRef.current = null; setQr(p => ({ ...p, status: "expired" })); }
          else if (c.code === 803 && c.cookie) {
            clearInterval(qrTimerRef.current); qrTimerRef.current = null;
            // 只留真正要用的键，别把整串杂项 cookie 存下来
            const keep = (c.cookie.match(/(MUSIC_U|__csrf)=[^;]+/g) || []).join("; ");
            onSetCookie(keep || c.cookie);
            setQr(p => ({ ...p, status: "done" }));
          }
        } catch (e) {}
      }, 2500);
    } catch (e) { stopQrLogin(); if (typeof toast === "function") toast("扫码登录起不来：" + (e.message || e)); }
  };
  const [openPl, setOpenPl] = useState(null); // 展开的歌单 id
  const [plName, setPlName] = useState("");
  const [plCharPick, setPlCharPick] = useState(false); // 选角色生成歌单
  const [pickFor, setPickFor] = useState(null); // 待"加到歌单"的歌：{song, kind:'lib'|'result'}
  const [renameId, setRenameId] = useState(null); // 正在改名的歌 id
  const [renameText, setRenameText] = useState("");
  const [showQueue, setShowQueue] = useState(false); // 播放页展开当前队列
  const audioFileRef = useRef(null);
  const coverRef = useRef(null);
  // ---- 播放页歌词（v54.50 她要的）：点「词」在唱片位置换成滚动歌词，带当前句高亮 ----
  const [showLyric, setShowLyric] = useState(false);
  const [lyrics, setLyrics] = useState({}); // songId -> {lines:[{t,text}]|null}；null=确认没有
  const lyricBoxRef = useRef(null);
  const parseLrc = raw => {
    const out = [];
    String(raw || "").split("\n").forEach(ln => {
      const stamps = [...ln.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)];
      const text = ln.replace(/\[[^\]]*\]/g, "").trim();
      if (!stamps.length) { if (text) out.push({ t: null, text }); return; }
      if (!text) return;
      stamps.forEach(m => out.push({ t: Number(m[1]) * 60 + Number(m[2]), text }));
    });
    return out.sort((a, b) => (a.t == null ? 1 : 0) - (b.t == null ? 1 : 0) || (a.t || 0) - (b.t || 0));
  };
  useEffect(() => {
    if (!showLyric || !now || lyrics[now.id] !== undefined) return;
    if (now.source !== "netease" || !now.neteaseId || !apiBase) { setLyrics(p => ({ ...p, [now.id]: { lines: null } })); return; }
    fetch(apiBase + "/lyric?id=" + now.neteaseId).then(r => r.json()).then(d => {
      const raw = d && d.lrc && d.lrc.lyric;
      const lines = raw ? parseLrc(raw).filter(l => l.text) : null;
      setLyrics(p => ({ ...p, [now.id]: { lines: (lines && lines.length) ? lines : null } }));
    }).catch(() => setLyrics(p => ({ ...p, [now.id]: { lines: null } })));
  }, [showLyric, nowId]);
  const lyricLines = now && lyrics[now.id] !== undefined ? lyrics[now.id].lines : undefined;
  let lyricActive = -1;
  if (Array.isArray(lyricLines)) for (let i = 0; i < lyricLines.length; i++) { if (lyricLines[i].t != null && lyricLines[i].t <= cur) lyricActive = i; }
  useEffect(() => {
    if (!showLyric || lyricActive < 0 || !lyricBoxRef.current) return;
    const el = lyricBoxRef.current.querySelector('[data-lyric-active="1"]');
    if (el && el.scrollIntoView) try { el.scrollIntoView({ block: "center", behavior: "smooth" }); } catch (e) {}
  }, [lyricActive, showLyric]);

  const doSearch = async () => {
    if (!apiBase || !q.trim()) return;
    setSearching(true); setResults(null);
    try {
      const r = await fetch(apiBase + "/search?keywords=" + encodeURIComponent(q.trim()) + "&limit=18");
      const d = await r.json();
      const list = (d && d.result && d.result.songs) || [];
      setResults(list.map(s => ({ id: s.id, name: s.name, artist: ((s.artists || s.ar || []).map(a => a.name).filter(Boolean).join(" / ")), cover: (s.album || s.al || {}).picUrl || null })));
    } catch (e) { setResults([]); }
    finally { setSearching(false); }
  };
  const addNet = () => { if (link.trim()) { onAddNetease(link, title, artist); setLink(""); setTitle(""); setArtist(""); } };
  const addLoc = () => { if (localFile) { onAddLocal(localFile, title, artist); setLocalFile(null); setTitle(""); setArtist(""); } };
  const field = { fontFamily: F_BODY, fontSize: 13.5, background: t.bg, color: t.ink, border: "1px solid " + t.line, borderRadius: 8, padding: "9px 11px", width: "100%", outline: "none" };
  const tabBtn = (k, label) => h("button", { onClick: () => setAddTab(k), className: "flex-1 py-2 active:opacity-70", style: { fontFamily: F_BODY, fontSize: 12.5, borderRadius: 8, background: addTab === k ? t.ink : t.bg, color: addTab === k ? t.bg2 : t.fog, border: "1px solid " + (addTab === k ? t.ink : t.line) } }, label);
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
    return svg(h("circle", { cx: 12, cy: 12, r: 8, fill: c }));
  };
  const cbtn = (child, onClick, o) => h("button", { onClick: onClick, className: "active:opacity-60 flex items-center justify-center shrink-0", style: Object.assign({ borderRadius: 999, background: (o && o.bg) || "transparent", width: (o && o.size) || 46, height: (o && o.size) || 46 }, o && o.style) }, child);
  // 歌曲行（列表用）。opts: {queue, inPlaylist(plId), canRename}
  const songRow = (s, opts) => { opts = opts || {}; const editing = renameId === s.id;
    return h("div", { key: s.id, className: "flex items-center gap-1.5", style: { background: s.id === nowId ? (t.accent || "#8a6d3b") + "14" : t.bg2, border: "1px solid " + (s.id === nowId ? (t.accent || "#8a6d3b") : t.line), borderRadius: 14, padding: "8px 10px" } },
      editing
        ? h("input", { value: renameText, onChange: e => setRenameText(e.target.value), onKeyDown: e => { if (e.key === "Enter") { onRenameSong(s.id, renameText); setRenameId(null); } }, style: Object.assign({ flex: 1, minWidth: 0 }, field) })
        : h("button", { onClick: () => onPlaySong(s.id, opts.queue), className: "flex items-center gap-3 flex-1 min-w-0 active:opacity-70", style: { textAlign: "left" } },
            h("div", { style: { flexShrink: 0, width: 42, height: 42, borderRadius: 8, background: s.cover ? "center/cover no-repeat url(" + s.cover + ")" : "linear-gradient(135deg,#cfc9bd,#a8a294)", display: "flex", alignItems: "center", justifyContent: "center" } }, s.cover ? null : ic(s.source === "netease" ? "cloud" : "note", "rgba(255,255,255,0.92)", 18)),
            h("div", { className: "flex-1 min-w-0" },
              h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14.5, color: t.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, (s.id === nowId && playing ? "▶ " : "") + s.title),
              h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, s.artist || (s.source === "netease" ? "网易云" : "本地")))),
      editing
        ? h("button", { onClick: () => { onRenameSong(s.id, renameText); setRenameId(null); }, className: "shrink-0 active:opacity-70", style: { background: t.ink, color: t.bg2, fontFamily: F_BODY, fontSize: 12, padding: "6px 12px", borderRadius: 8 } }, "存")
        : null,
      !editing && opts.canRename ? h("button", { onClick: () => { setRenameId(s.id); setRenameText(s.title); }, className: "shrink-0 active:opacity-60", style: { fontSize: 12.5, color: t.fog, padding: "0 2px" } }, "✎") : null,
      !editing ? h("button", { onClick: () => setPickFor({ song: s }), className: "shrink-0 active:opacity-60", style: { fontSize: 17, color: t.fog, padding: "0 2px" } }, "＋") : null,
      !editing ? h("button", { onClick: () => onToggleFav(s.id), className: "shrink-0 active:opacity-60", style: { fontSize: 15, color: s.fav ? "#e0576b" : t.fog, padding: "0 2px" } }, s.fav ? "♥" : "♡") : null,
      !editing ? h("button", { onClick: () => opts.inPlaylist ? onRemoveFromPlaylist(opts.inPlaylist, s.id) : onRemoveSong(s.id), className: "shrink-0 active:opacity-60", style: { fontFamily: F_BODY, fontSize: 15, color: t.fog, padding: "0 2px" } }, "×") : null); };
  // "加到歌单"选择层：从搜索结果 / 全部 / 歌单里点＋后弹出
  const addSong = (plId, isNew) => { const it = pickFor; if (!it) return; let id = plId; if (isNew) id = onCreatePlaylist("新歌单 " + ((playlists.length || 0) + 1), []); if (it.isResult) onAddResultToPlaylist(id, it.song); else onAddToPlaylist(id, it.song); setPickFor(null); };
  const pickerOverlay = pickFor ? h("div", { onClick: () => setPickFor(null), style: { position: "absolute", inset: 0, zIndex: 40, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "flex-end" } },
    h("div", { onClick: e => e.stopPropagation(), style: { width: "100%", background: t.bg, borderRadius: "20px 20px 0 0", padding: "16px 18px 26px", maxHeight: "70%", overflowY: "auto" } },
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: t.ink, marginBottom: 3 } }, "加到歌单"),
      h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginBottom: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, "《" + (pickFor.song.title || pickFor.song.name || "") + "》"),
      h("button", { onClick: () => addSong(null, true), className: "w-full text-left active:opacity-70", style: { padding: "11px 6px", borderBottom: "1px solid " + t.line, fontFamily: F_BODY, fontSize: 14, color: t.tint } }, "＋ 新建一个歌单"),
      playlists.length ? playlists.map(pl => h("button", { key: pl.id, onClick: () => addSong(pl.id), className: "w-full flex items-center justify-between text-left active:opacity-70", style: { padding: "11px 6px", borderBottom: "1px solid " + t.line } },
        h("span", { style: { fontFamily: F_BODY, fontSize: 14, color: t.ink } }, pl.name),
        h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog } }, (pl.songs || []).length + " 首")))
        : h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, padding: "10px 6px" } }, "还没有歌单，点上面新建一个"))) : null;

  // ============ 播放 tab ============
  const playTab = now ? h("div", { className: "flex flex-col items-center px-6 pb-6" },
    // 唱片 ↔ 歌词页（仿网易云：进词后点任意处回唱片）
    showLyric
      ? h("div", { ref: lyricBoxRef, onClick: () => setShowLyric(false), className: "w-full active:opacity-95", style: { height: 268, overflowY: "auto", marginTop: 14, padding: "100px 8px", textAlign: "center", WebkitMaskImage: "linear-gradient(transparent, #000 16%, #000 84%, transparent)", maskImage: "linear-gradient(transparent, #000 16%, #000 84%, transparent)" } },
          lyricLines === undefined ? h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.fog } }, "找歌词中…")
            : !lyricLines ? h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.fog, lineHeight: 2 } }, now.source === "netease" ? "这首歌没有歌词（可能是纯音乐）" : "本地/外链歌曲拿不到歌词")
            : lyricLines.map((l, i) => h("div", { key: i, "data-lyric-active": i === lyricActive ? "1" : "0", style: { fontFamily: "'Noto Serif SC',serif", fontSize: i === lyricActive ? 16.5 : 13.5, lineHeight: 2.1, color: i === lyricActive ? t.ink : t.fog, fontWeight: i === lyricActive ? 600 : 400, transition: "font-size .2s,color .2s" } }, l.text)))
      : h("button", { onClick: () => coverRef.current && coverRef.current.click(), className: "active:opacity-90 relative", style: { width: 232, height: 232, borderRadius: 999, marginTop: 14, background: "radial-gradient(circle at 50% 50%, #2b2b30 0 61%, #17171b 62%)", boxShadow: "0 16px 44px rgba(0,0,0,0.34)", display: "flex", alignItems: "center", justifyContent: "center", animation: playing ? "wk-spin 9s linear infinite" : "none" } },
          h("div", { style: { width: 148, height: 148, borderRadius: 999, background: nowCover ? "center/cover no-repeat url(" + nowCover + ")" : discImg ? "center/cover no-repeat url(" + discImg + ")" : "linear-gradient(135deg,#e8b6c8,#f0d9a8)", boxShadow: "inset 0 0 0 5px rgba(0,0,0,0.22)", display: "flex", alignItems: "center", justifyContent: "center" } },
            h("div", { style: { width: 18, height: 18, borderRadius: 999, background: t.bg, border: "3px solid rgba(0,0,0,0.35)" } }))),
    showLyric ? null : h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: t.fog, marginTop: 8 } }, "点唱片换封面"),
    h("div", { style: { fontFamily: F_DISPLAY, fontSize: 24, color: t.ink, marginTop: 12, textAlign: "center", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, now.title),
    h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, color: t.fog, marginTop: 5, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, now.artist || (now.source === "netease" ? "网易云" : "本地")),
    h("div", { className: "flex items-center justify-center gap-3", style: { marginTop: 14 } },
      cbtn(h("span", { style: { fontSize: 20, color: now.fav ? "#e0576b" : t.fog } }, now.fav ? "♥" : "♡"), () => onToggleFav(now.id), { bg: t.bg2 }),
      // 加进本地歌单（复用底部选择层）
      cbtn(h("span", { style: { fontSize: 20, color: t.fog } }, "＋"), () => setPickFor({ song: now }), { bg: t.bg2 }),
      // 加进她真网易云歌单（仅网易云歌 + 已连账号；openCvAdd 在下方云村区声明，闭包延迟取用没有 TDZ 问题）
      (now.source === "netease" && now.neteaseId && cookie) ? cbtn(h("span", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.tint } }, "☁＋"), () => openCvAdd({ id: now.neteaseId, name: now.title, artist: now.artist, cover: now.cover }), { bg: t.bg2 }) : null,
      // 歌词页开关
      cbtn(h("span", { style: { fontFamily: F_BODY, fontSize: 13, color: showLyric ? (t.accent || "#8a6d3b") : t.fog } }, "词"), () => setShowLyric(v => !v), { bg: showLyric ? (t.accent || "#8a6d3b") + "22" : t.bg2 })),
    h("div", { className: "w-full", style: { maxWidth: 320 } },
      h("input", { type: "range", min: 0, max: 1000, value: Math.round(frac * 1000), onChange: e => onSeek(Number(e.target.value) / 1000), style: { width: "100%", marginTop: 14 } }),
      h("div", { className: "flex items-center justify-between" },
        h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog } }, fmt(cur)),
        h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog } }, dur ? fmt(dur) : "--:--"))),
    player && player.err ? h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.accent, marginTop: 2, textAlign: "center" } }, player.err) : null,
    h("div", { className: "flex items-center justify-center gap-3", style: { marginTop: 8 } },
      // 后退键左边：播放模式（列表循环 / 单曲循环 / 随机）
      cbtn(ic(({ order: "repeat", one: "repeatone", shuffle: "shuffle" })[playMode || "order"], (playMode && playMode !== "order") ? (t.accent || "#8a6d3b") : t.ink, 20), onCyclePlayMode, { size: 44, style: { background: (playMode && playMode !== "order") ? (t.accent || "#8a6d3b") + "22" : "transparent" } }),
      cbtn(ic("prev", t.ink, 24), () => onStep(-1), { size: 50 }),
      cbtn(player && player.loading ? h("span", { style: { color: t.bg2, fontSize: 13 } }, "…") : playing ? ic("pause", t.bg2, 30) : ic("play", t.bg2, 30), onTogglePlay, { bg: t.ink, size: 70 }),
      cbtn(ic("next", t.ink, 24), () => onStep(1), { size: 50 }),
      // 前进键右边：当前队列/歌单顺序
      cbtn(ic("list", showQueue ? (t.accent || "#8a6d3b") : t.ink, 20), () => setShowQueue(v => !v), { size: 44, style: { background: showQueue ? (t.accent || "#8a6d3b") + "22" : "transparent" } })),
    h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 6 } }, ({ order: "列表循环", one: "单曲循环", shuffle: "随机播放" })[playMode || "order"]),
    // 当前队列（展开）
    showQueue ? h("div", { className: "w-full", style: { marginTop: 14 } },
      h(Eyebrow, { style: { marginBottom: 8 } }, "当前队列 · " + nowQueue.length),
      h("div", { className: "space-y-1", style: { maxHeight: "34vh", overflowY: "auto" } }, nowQueue.map((s, i) => h("button", { key: s.id + "_" + i, onClick: () => onPlaySong(s.id, nowQueue.map(x => x.id)), className: "w-full flex items-center gap-2.5 active:opacity-70", style: { textAlign: "left", padding: "6px 8px", borderRadius: 10, background: s.id === nowId ? (t.accent || "#8a6d3b") + "14" : "transparent" } },
        h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: s.id === nowId ? (t.accent || "#8a6d3b") : t.fog, width: 18, flexShrink: 0, textAlign: "center" } }, s.id === nowId && playing ? "▶" : String(i + 1)),
        h("div", { className: "flex-1 min-w-0" },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14, color: s.id === nowId ? t.ink : t.sub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, s.title),
          h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, s.artist || "")))))) : null,
    // 和谁听（可不选 = 自己听）
    h("div", { className: "flex items-center gap-2", style: { marginTop: 22, width: "100%", overflowX: "auto" } },
      h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, flexShrink: 0 } }, "和谁听："),
      h("button", { onClick: () => onSetPartner(null), className: "active:opacity-70", style: { flexShrink: 0, fontFamily: F_BODY, fontSize: 12, color: !partner ? t.ink : t.fog, border: "1px solid " + (!partner ? t.ink : t.line), borderRadius: 999, padding: "5px 12px" } }, "自己听"),
      (characters || []).map(c => { const on = data.partnerId === c.id; return h("button", { key: c.id, onClick: () => onSetPartner(on ? null : c.id), className: "active:opacity-70", style: { flexShrink: 0, opacity: on ? 1 : 0.5, border: on ? "2px solid " + (t.accent || "#8a6d3b") : "2px solid transparent", borderRadius: 999, padding: 1 } }, h(Avatar, { character: c, size: 30, radius: 999 })); })),
    partner ? h("div", { className: "flex items-center justify-between w-full", style: { marginTop: 14, background: t.bg2, border: "1px solid " + t.line, borderRadius: 12, padding: "10px 12px" } },
      h("div", { style: { flex: 1, minWidth: 0 } },
        h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.ink } }, "让 " + partner.name + " 在聊天里聊这首歌"),
        h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 2, lineHeight: 1.4 } }, "开：TA 会在私聊里自然聊你俩在听的歌、也能帮你切歌（消耗一次回复）")),
      h("button", { onClick: () => onSetAutoComment(!data.autoComment), className: "shrink-0 active:opacity-70", style: { width: 44, height: 26, borderRadius: 999, background: data.autoComment ? (t.accent || "#8a6d3b") : t.line, position: "relative", transition: "background .15s" } },
        h("div", { style: { position: "absolute", top: 3, left: data.autoComment ? 21 : 3, width: 20, height: 20, borderRadius: 999, background: "#fff", transition: "left .15s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" } }))) : null)
    : h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: t.fog, textAlign: "center", padding: "80px 24px", lineHeight: 1.9 } }, "还没有歌\n去「" + ((apiBase && cookie) ? "设置" : "首页") + "」搜歌名 / 贴链接 / 传本地");

  // ============ 首页 tab（浏览 + 添加 + 设置）============
  const homeTab = h("div", { className: "px-6 pb-6" },
    // 搜索栏（仿音乐 app）
    h("div", { className: "flex gap-2 items-center", style: { marginTop: 6 } },
      h("div", { className: "flex-1 flex items-center gap-2", style: { background: t.bg2, border: "1px solid " + t.line, borderRadius: 999, padding: "8px 14px" } },
        ic("search", t.fog, 15),
        h("input", { value: q, onChange: e => setQ(e.target.value), onKeyDown: e => { if (e.key === "Enter") doSearch(); }, placeholder: apiBase ? "全网 搜索歌曲 / 歌手" : "先配搜索接口↓", style: { flex: 1, background: "transparent", border: "none", outline: "none", fontFamily: F_BODY, fontSize: 13.5, color: t.ink } })),
      h("button", { onClick: () => audioFileRef.current && audioFileRef.current.click(), className: "shrink-0 active:opacity-70 flex items-center justify-center", style: { width: 40, height: 40, borderRadius: 999, background: t.bg2, border: "1px solid " + t.line } }, ic("upload", t.ink, 17))),
    // 静音保活：像一首歌，点播放=放段无声音频占住后台，让 TA 能后台发消息来；暂停就关、想听真歌直接换
    (() => {
      const kaOn = !!(player && player.songId === KEEPALIVE_ID && player.playing);
      return h("button", { onClick: () => (player && player.songId === KEEPALIVE_ID) ? onTogglePlay() : onPlaySong(KEEPALIVE_ID), className: "w-full flex items-center gap-3 active:opacity-80", style: { marginTop: 12, background: kaOn ? (t.accent || "#8a6d3b") + "14" : t.bg2, border: "1px solid " + (kaOn ? (t.accent || "#8a6d3b") + "44" : t.line), borderRadius: 14, padding: "11px 13px", textAlign: "left" } },
        h("div", { style: { flexShrink: 0, width: 40, height: 40, borderRadius: 999, background: "radial-gradient(circle at 50% 50%, #3a3a42 0 34%, #23232a 35%)", display: "flex", alignItems: "center", justifyContent: "center", animation: kaOn ? "wk-spin 9s linear infinite" : "none" } }, h("span", { style: { fontSize: 17 } }, "🌙")),
        h("div", { className: "flex-1 min-w-0" },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14.5, color: t.ink } }, "静音保活"),
          h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 1, lineHeight: 1.4 } }, kaOn ? "正放着 · 手机后台醒着接消息（无声，别锁太久 iOS 仍会挂起）" : "点一下：放段无声音频撑住后台，让 TA 更容易后台发消息来")),
        h("div", { style: { flexShrink: 0, width: 30, height: 30, borderRadius: 999, background: t.ink, display: "flex", alignItems: "center", justifyContent: "center" } },
          kaOn ? h("div", { style: { display: "flex", gap: 2.5 } }, h("div", { style: { width: 3, height: 11, borderRadius: 2, background: t.bg2 } }), h("div", { style: { width: 3, height: 11, borderRadius: 2, background: t.bg2 } }))
          : h("div", { style: { width: 0, height: 0, borderTop: "5px solid transparent", borderBottom: "5px solid transparent", borderLeft: "9px solid " + t.bg2, marginLeft: 2 } })));
    })(),
    // 搜索结果
    apiBase && (searching || results != null) ? h("div", { style: { marginTop: 10 } },
      searching ? h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, padding: "6px 2px" } }, "搜索中…")
      : results && results.length === 0 ? h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, padding: "6px 2px" } }, "没搜到（或接口没响应）")
      : h("div", { className: "space-y-1.5" }, (results || []).map(s => h("div", { key: s.id, className: "w-full flex items-center gap-2.5", style: { padding: "4px 2px" } },
          h("button", { onClick: () => onPlayResult(s), className: "flex items-center gap-2.5 flex-1 min-w-0 active:opacity-70", style: { textAlign: "left" } },
            h("div", { style: { flexShrink: 0, width: 40, height: 40, borderRadius: 8, background: s.cover ? "center/cover no-repeat url(" + s.cover + ")" : "linear-gradient(135deg,#cfc9bd,#a8a294)" } }),
            h("div", { className: "flex-1 min-w-0" },
              h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14, color: t.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, s.name),
              h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, s.artist || "未知歌手"))),
          h("button", { onClick: () => onPlayResult(s), className: "shrink-0 active:opacity-60 flex items-center justify-center", style: { width: 30, height: 30, borderRadius: 999, background: t.ink }, title: "现在播放" }, ic("play", t.bg2, 15)),
          h("button", { onClick: () => setPickFor({ song: s, isResult: true }), className: "shrink-0 active:opacity-60", style: { fontSize: 18, color: t.tint, padding: "0 3px" }, title: "加到歌单" }, "＋"),
          cookie ? h("button", { onClick: () => openCvAdd(s), className: "shrink-0 active:opacity-60", style: { fontFamily: F_BODY, fontSize: 13, color: t.tint, padding: "0 3px" }, title: "加进网易云歌单" }, "☁＋") : null))) ) : null,
    // ⚠️「全部歌曲」搬去「我的」了（v61.42）：这一栏现在是【设置】——
    //   接口、Cookie、登录、把歌弄进来。歌本身是她的东西，归「我的」。
    //   原来叫「曲库」却装着一整页设置，名字和内容对不上，这是她说「很乱」的一处。
    // 添加：链接ID / 本地 + 接口设置（折叠在下方）
    h("div", { style: { background: t.bg2, border: "1px solid " + t.line, borderRadius: 16, padding: "12px 14px", marginTop: 18 } },
      h(Eyebrow, { style: { marginBottom: 10 } }, "添加歌曲"),
      h("div", { className: "flex gap-2", style: { marginBottom: 10 } }, apiBase ? tabBtn("search", "搜歌名") : null, tabBtn("netease", "链接/ID"), tabBtn("local", "本地")),
      addTab === "search" && apiBase
        ? h("div", { className: "flex gap-2" },
            h("input", { value: q, onChange: e => setQ(e.target.value), onKeyDown: e => { if (e.key === "Enter") doSearch(); }, placeholder: "搜歌名 / 歌手（结果在上方）", style: field }),
            h("button", { onClick: doSearch, disabled: searching || !q.trim(), className: "active:opacity-70 disabled:opacity-40", style: { background: t.ink, color: t.bg2, fontFamily: F_BODY, fontSize: 13, padding: "0 16px", borderRadius: 8, flexShrink: 0 } }, searching ? "…" : "搜"))
        : addTab === "netease"
          ? h("div", null,
              h("input", { value: link, onChange: e => setLink(e.target.value), placeholder: "贴网易云分享链接或歌曲ID", style: Object.assign({ marginBottom: 8 }, field) }),
              h("input", { value: title, onChange: e => setTitle(e.target.value), placeholder: "歌名（选填，填了角色聊得更准）", style: Object.assign({ marginBottom: 8 }, field) }),
              h("div", { className: "flex items-center gap-2" },
                h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, flex: 1, lineHeight: 1.4 } }, "分享→复制链接贴进来；VIP/无版权可能放不出"),
                h("button", { onClick: addNet, disabled: !link.trim(), className: "active:opacity-70 disabled:opacity-40", style: { background: t.ink, color: t.bg2, fontFamily: F_DISPLAY, fontSize: 14, padding: "7px 18px", borderRadius: 10, flexShrink: 0 } }, "添加")))
          : h("div", null,
              h("button", { onClick: () => audioFileRef.current && audioFileRef.current.click(), className: "w-full active:opacity-70", style: { fontFamily: F_BODY, fontSize: 12.5, color: localFile ? t.ink : t.tint, border: "1px dashed " + t.line, borderRadius: 8, padding: "10px", marginBottom: 8 } }, localFile ? "✓ " + localFile.name.slice(0, 24) : "＋ 选一个音频文件"),
              h("input", { value: title, onChange: e => setTitle(e.target.value), placeholder: "歌名（留空=文件名）", style: Object.assign({ marginBottom: 8 }, field) }),
              h("div", { className: "flex items-center gap-2" },
                h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, flex: 1, lineHeight: 1.4 } }, "只存这台设备，不上传；清缓存会没"),
                h("button", { onClick: addLoc, disabled: !localFile, className: "active:opacity-70 disabled:opacity-40", style: { background: t.ink, color: t.bg2, fontFamily: F_DISPLAY, fontSize: 14, padding: "7px 18px", borderRadius: 10, flexShrink: 0 } }, "添加"))),
      h("div", { style: { borderTop: "1px solid " + t.line, marginTop: 12, paddingTop: 10 } },
        apiEdit
          ? h("div", null,
              h("input", { value: apiInput, onChange: e => setApiInput(e.target.value), placeholder: "https://你的-netease-api.vercel.app", style: Object.assign({ marginBottom: 8 }, field) }),
              h("button", { onClick: () => setApiInput("https://yanqiu-vps.tail542792.ts.net/music"), className: "active:opacity-70", style: { fontFamily: F_BODY, fontSize: 11, color: t.tint, marginBottom: 8 } }, "⚡ 一键填咱家 VPS 的接口"),
              h("div", { className: "flex gap-2" },
                h("button", { onClick: () => { onSetApiBase(apiInput); setApiEdit(false); }, className: "flex-1 py-2 active:opacity-70", style: { background: t.ink, color: t.bg2, fontFamily: F_BODY, fontSize: 13, borderRadius: 8 } }, "保存"),
                h("button", { onClick: () => setApiEdit(false), className: "flex-1 py-2 active:opacity-70", style: { border: "1px solid " + t.line, color: t.fog, fontFamily: F_BODY, fontSize: 13, borderRadius: 8 } }, "取消")))
          : h("button", { onClick: () => { setApiInput(apiBase || ""); setApiEdit(true); }, className: "active:opacity-70", style: { fontFamily: F_BODY, fontSize: 11.5, color: apiBase ? t.fog : t.tint } }, apiBase ? "✓ 已连搜索接口 · 改" : "＋ 配网易云搜索接口（自部署后填地址，就能搜歌名）")),
      // 可选：网易云账号 Cookie（放 VIP 歌用）——服务端注入的可不填
      apiBase ? h("div", { style: { borderTop: "1px solid " + t.line, marginTop: 10, paddingTop: 10 } },
        ckEdit
          ? h("div", null,
              h("textarea", { value: ckInput, onChange: e => setCkInput(e.target.value), rows: 3, placeholder: "粘贴网易云 Cookie（一般是 MUSIC_U=…；只想放免费歌可留空）", style: Object.assign({ marginBottom: 8, resize: "vertical", lineHeight: 1.4 }, field) }),
              h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: t.fog, lineHeight: 1.5, marginBottom: 8 } }, "只存这台设备。填了后点歌会带上它 → 后端转发给网易云 → 能放你账号的 VIP 歌。Cookie 会过期，失效了重登换一份。"),
              h("div", { className: "flex gap-2" },
                h("button", { onClick: () => { onSetCookie(ckInput); setCkEdit(false); }, className: "flex-1 py-2 active:opacity-70", style: { background: t.ink, color: t.bg2, fontFamily: F_BODY, fontSize: 13, borderRadius: 8 } }, "保存"),
                h("button", { onClick: () => setCkEdit(false), className: "flex-1 py-2 active:opacity-70", style: { border: "1px solid " + t.line, color: t.fog, fontFamily: F_BODY, fontSize: 13, borderRadius: 8 } }, "取消")))
          : h("div", null,
              h("div", { className: "flex items-center justify-between gap-2" },
                h("button", { onClick: () => { setCkInput(cookie || ""); setCkEdit(true); }, className: "active:opacity-70", style: { fontFamily: F_BODY, fontSize: 11.5, color: cookie ? t.fog : t.tint, textAlign: "left" } }, cookie ? "✓ 已填账号 Cookie（可放 VIP）· 改" : "＋ 配账号 Cookie（可放 VIP 歌，选填）"),
                h("button", { onClick: onTestLogin, className: "shrink-0 active:opacity-70", style: { fontFamily: F_BODY, fontSize: 11.5, color: t.tint, border: "1px solid " + t.line, borderRadius: 8, padding: "4px 10px" } }, "测登录"),
                h("button", { onClick: startQrLogin, disabled: qr.busy, className: "shrink-0 active:opacity-70", style: { fontFamily: F_BODY, fontSize: 11.5, color: "#fff", background: t.ink, borderRadius: 8, padding: "4px 10px", opacity: qr.busy ? 0.5 : 1 } }, qr.busy ? "生成中…" : "扫码登录")),
              // 扫码登录：手机网易云 App 扫这个码 → 自动拿 Cookie，免手贴（后端 /login/qr/*）
              qr.img ? h("div", { style: { marginTop: 10, textAlign: "center" } },
                h("img", { src: qr.img, style: { width: 160, height: 160, borderRadius: 10, border: "1px solid " + t.line, background: "#fff" } }),
                h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: qr.status === "done" ? "#3f7d4e" : t.fog, marginTop: 6 } },
                  qr.status === "waiting" ? "打开手机网易云 App 扫一扫" : qr.status === "scanned" ? "扫到了，在手机上点确认" : qr.status === "done" ? "✓ 登录成功，Cookie 已自动存好（仅本机）" : qr.status === "expired" ? "码过期了，再点一次扫码登录" : "…"),
                qr.status !== "done" ? h("button", { onClick: stopQrLogin, className: "active:opacity-70", style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginTop: 4 } }, "取消") : null) : null)) : null));

  // ============ 我的 tab（歌单）============
  // cv（云村/账号态）在这里声明：「我的」tab 渲染时直接读它，声明放云村区会 TDZ 白屏
  const [cv, setCv] = useState({ me: null, daily: null, pls: null, open: null, openSongs: null, likeIds: null, busy: false, sub: "rec", q: "", results: null, searching: false, fm: null, recent: null, tops: null });
  const [cvPlName, setCvPlName] = useState("");
  const favs = songs.filter(s => s.fav);
  const isFavView = openPl === "__fav__";
  const openPlObj = isFavView ? { id: "__fav__", name: "我喜欢的音乐", songs: favs } : (playlists.find(p => p.id === openPl) || null);
  // ⚠️这几个公共渲染器【必须定义在 mineTab 之前】：mineTab 是 `const x = h(...)`，
  //   渲染时立刻求值，引用后面声明的 const 会 TDZ 白屏（跟上面 cv 那条一样的坑）。
  //   v61.42 之前它们在云村区、也就是 mineTab 后面，于是「我的」里只能【又抄一份】
  //   歌单行——同一个东西两份实现。她 2026-09-03 说「一段一段加的所以看起来很乱」，
  //   这就是最直接的一处。
  // 统一的歌行：播放(带scrobble) / 红心 / 收进家 / ☁＋入她的网易云歌单；
  // opts.removable=从她自己的歌单里真删这首；opts.trash=FM 垃圾桶
  const cloudRow = (s, opts) => { const o = opts || {}; return h("div", { key: s.id, className: "flex items-center gap-2 py-2", style: { borderBottom: "1px solid " + t.line } },
    h("button", { onClick: () => playCloud(s, o.srcId), className: "flex items-center gap-2.5 flex-1 min-w-0 active:opacity-70", style: { textAlign: "left" } },
      h("div", { style: { flexShrink: 0, width: 40, height: 40, borderRadius: 8, background: s.cover ? "center/cover no-repeat url(" + s.cover + "?param=80y80)" : t.bg2 } }),
      h("div", { className: "min-w-0" },
        h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, color: t.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, s.name),
        h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, s.artist || "网易云"))),
    h("button", { onClick: () => likeSong(s), className: "shrink-0 active:opacity-60 px-1", style: { fontSize: 16, color: (cv.likeIds && cv.likeIds.has(String(s.id))) ? "#d0503e" : t.fog } }, (cv.likeIds && cv.likeIds.has(String(s.id))) ? "♥" : "♡"),
    h("button", { onClick: () => onAddNeteaseResult(s), className: "shrink-0 active:opacity-60 px-1", style: { fontSize: 18, color: t.fog }, title: "收进咱家歌库" }, "＋"),
    h("button", { onClick: () => openCvAdd(s), className: "shrink-0 active:opacity-60 px-1", style: { fontFamily: F_BODY, fontSize: 13, color: t.tint }, title: "加进网易云歌单" }, "☁＋"),
    o.removable ? h("button", { onClick: () => removeFromRealPl(o.removable, s), className: "shrink-0 active:opacity-60 px-1", style: { fontFamily: F_BODY, fontSize: 15, color: "#a4442e" }, title: "从这个网易云歌单移除" }, "－") : null,
    o.trash ? h("button", { onClick: () => trashFm(s), className: "shrink-0 active:opacity-60 px-1", style: { fontSize: 14, color: t.fog }, title: "不喜欢，少推这类" }, "🗑") : null,
    h("button", { onClick: () => playCloud(s, o.srcId), className: "shrink-0 active:opacity-60 flex items-center justify-center", style: { width: 28, height: 28, borderRadius: 999, background: t.ink } }, ic("play", t.bg2, 13))); };
  // 分栏＝唱片架里的【分隔卡】（tabs-not-plain-pills.md：药丸换个 app 照样成立，等于没做）。
  // 一起听在现实里就是一箱唱片，翻的人靠竖在里头的分隔卡找段落——卡上沿露在唱片之上，
  // 中间挖一个拇指缺口好把它勾出来。选中的那张【抽出来一截】：更高、纸色、
  // 底边直接长进下面的内容里（没有下框线）；没选的压回箱底：矮一截、暗一档、缺口看不见。
  // 形状/高度/位置/颜色四样一起变，不是只填个色——色弱和阳光下只剩形状可依。
  const cvChip = (k, label) => {
    const on = cv.sub === k;
    const paper = t.bg2, sunk = typeof mix === "function" ? t.bg : t.bg;
    return h("button", { key: k, onClick: () => setCvSub(k), className: "relative active:opacity-80",
      style: {
        alignSelf: "flex-end",            // 没选的那张往下沉，上沿参差不齐——像真的压在后面
        height: on ? 44 : 34,
        padding: on ? "0 16px 0" : "0 14px",
        fontFamily: F_BODY, fontSize: on ? 13.5 : 12.5,
        color: on ? t.ink : t.fog,
        background: on ? paper : sunk,
        border: "1px solid " + t.line,
        borderBottom: on ? "1px solid " + paper : "1px solid " + t.line,
        borderRadius: on ? "10px 10px 0 0" : "8px 8px 0 0",
        marginBottom: -1,                 // 选中那张的底边压在内容区的上框线上，接成一片
        boxShadow: on ? "0 -1px 3px rgba(30,28,24,.06)" : "inset 0 -6px 8px -6px rgba(30,28,24,.18)"
      } },
      // 拇指缺口：只有被抽出来的那张露得出来
      on ? h("span", { style: { position: "absolute", left: "50%", top: -1, width: 22, height: 9,
        marginLeft: -11, borderRadius: "0 0 11px 11px", background: t.bg,
        borderLeft: "1px solid " + t.line, borderRight: "1px solid " + t.line, borderBottom: "1px solid " + t.line } }) : null,
      h("span", { style: { position: "relative", top: on ? 5 : 0 } }, label));
  };
  const cvPlRow = pl => h("div", { key: pl.id, className: "w-full flex items-center gap-3 py-2", style: { borderBottom: "1px solid " + t.line } },
    h("button", { onClick: () => openCloudPl(pl), className: "flex items-center gap-3 flex-1 min-w-0 active:opacity-70", style: { textAlign: "left" } },
      h("div", { style: { flexShrink: 0, width: 44, height: 44, borderRadius: 8, background: pl.cover ? "center/cover no-repeat url(" + pl.cover + "?param=100y100)" : t.bg2 } }),
      h("div", { className: "min-w-0 flex-1" },
        h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, color: t.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, pl.name),
        h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog } }, pl.count + " 首" + (pl.freq ? " · " + pl.freq : pl.mine ? "" : " · 收藏")))),
    pl.mine ? h("button", { onClick: () => delRealPl(pl), className: "shrink-0 active:opacity-60 px-1", style: { fontFamily: F_BODY, fontSize: 11.5, color: "#a4442e" } }, "删") : null,
    h("span", { style: { color: t.fog, fontSize: 16 } }, "›"));
  const cvSection = (title, right) => h("div", { className: "flex items-center justify-between", style: { marginBottom: 4, marginTop: 14 } },
    h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15, color: t.ink } }, title), right || null);
  const mineTab = h("div", { className: "px-6 pb-6" },
    openPlObj
      ? h("div", null, // 歌单详情（含「我喜欢的音乐」）
          h("div", { className: "flex items-center gap-2", style: { marginTop: 8, marginBottom: 12 } },
            h("button", { onClick: () => setOpenPl(null), className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 13, color: t.fog } }, "‹ 歌单"),
            h("div", { className: "flex-1 min-w-0 flex items-center justify-center gap-1.5" },
              h("div", { style: { fontFamily: F_DISPLAY, fontSize: 18, color: t.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, openPlObj.name),
              !isFavView ? h("button", { onClick: () => { const nv = window.prompt("歌单改名", openPlObj.name); if (nv && nv.trim()) onRenamePlaylist(openPlObj.id, nv.trim()); }, className: "shrink-0 active:opacity-60", style: { fontSize: 12.5, color: t.fog, padding: "0 2px" } }, "✎") : null),
            !isFavView ? h("button", { onClick: () => { onDeletePlaylist(openPlObj.id); setOpenPl(null); }, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 12, color: t.fog } }, "删除") : h("div", { style: { width: 28 } })),
          (openPlObj.songs || []).length
            ? h("div", { className: "space-y-2" }, (openPlObj.songs || []).map(s => songRow(s, { queue: (openPlObj.songs || []).map(x => x.id), inPlaylist: isFavView ? null : openPlObj.id })))
            : h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.fog, padding: "16px 0", lineHeight: 1.8 } }, isFavView ? "还没有收藏的歌。听到喜欢的点一下 ♡ 就会收进这里。" : "这个歌单还没歌。去「" + ((apiBase && cookie) ? "设置" : "首页") + "」搜歌/在歌里点＋加进来——下面也能从「全部」挑。"),
          // 从全部歌里挑加入（复制一份进歌单，和「全部」互不影响）——收藏歌单不需要
          (!isFavView && songs.length) ? h("div", { style: { marginTop: 16 } },
            h(Eyebrow, { style: { marginBottom: 8 } }, "从全部歌加入"),
            h("div", { className: "flex flex-wrap gap-2" }, songs.filter(s => !(openPlObj.songs || []).some(x => (s.neteaseId && x.neteaseId === s.neteaseId) || x.id === s.id)).map(s => h("button", { key: s.id, onClick: () => onAddToPlaylist(openPlObj.id, s), className: "active:opacity-70", style: { fontFamily: F_BODY, fontSize: 12, color: t.ink, background: t.bg2, border: "1px solid " + t.line, borderRadius: 999, padding: "6px 12px" } }, "＋ " + s.title)))) : null)
      : h("div", null,
          // 网易云账号区（v54.51）：把她真账号的「我喜欢的音乐」和自建歌单搬进「我的」，
          // 和网易云 App 的我的页一个样；点开跳到推荐页的歌单详情（写权限都在那边）
          (apiBase && cookie) ? h("div", { style: { marginTop: 8 } },
            h("button", { onClick: () => { setNav("cloud"); openLikePl(); }, className: "w-full flex items-center gap-3 active:opacity-80", style: { background: t.bg2, border: "1px solid " + t.line, borderRadius: 16, padding: "12px 14px", textAlign: "left" } },
              h("div", { style: { flexShrink: 0, width: 52, height: 52, borderRadius: 12, background: "linear-gradient(135deg,#e0576b,#f0a8c0)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, color: "#fff" } }, "♥"),
              h("div", { className: "flex-1 min-w-0" },
                h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: t.ink } }, "我喜欢的音乐"),
                h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, marginTop: 2 } }, ((cv.likeIds && cv.likeIds.size) || 0) + " 首 · 网易云账号"))),
            // 我建的（网易云里我自己建的，可删）。⚠️「我喜欢的音乐」不列进来——
            // 它是账号自动建的那一张，上面已经有一张专门的大卡了。列进来就是同一样东西两份。
            (() => { const mine = (cv.pls || []).filter(p => p.mine && p.name !== "我喜欢的音乐");
              return mine.length ? h("div", { style: { marginTop: 12 } },
                h(Eyebrow, { style: { marginBottom: 6 } }, "我建的 · " + mine.length),
                mine.map(cvPlRow)) : null; })(),
            // 新建收在这一段末尾：低频操作，不该占着顶上第一眼
            h("div", { className: "flex gap-2", style: { marginTop: 8 } },
              h("input", { value: cvPlName, onChange: e => setCvPlName(e.target.value), placeholder: "在网易云账号里新建歌单", style: field }),
              h("button", { onClick: () => { if (cvPlName.trim()) createRealPl(cvPlName.trim()); }, disabled: !cvPlName.trim(),
                className: "active:opacity-70 disabled:opacity-40",
                style: { background: t.ink, color: t.bg2, fontFamily: F_BODY, fontSize: 13, borderRadius: 10, padding: "0 14px" } }, "建")),
            // 我收藏的（别人的歌单，没有写权限，所以不给删）
            (() => { const fav = (cv.pls || []).filter(p => !p.mine);
              return fav.length ? h("div", { style: { marginTop: 14 } },
                h(Eyebrow, { style: { marginBottom: 6 } }, "我收藏的 · " + fav.length),
                fav.map(cvPlRow)) : null; })(),
            // 最近播放：原来藏在「发现」的第四个药丸里，可它答的是「我听过什么」——是我的东西。
            h(Eyebrow, { style: { marginTop: 16, marginBottom: 2 } }, "最近播放"),
            h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginBottom: 4 } }, "你网易云账号的听歌记录——在这儿听的也会登记进去。这是「听过什么」，不是「存了什么」"),
            cv.recent
              ? (cv.recent.length ? cv.recent.slice(0, 15).map(s2 => cloudRow(s2))
                 : h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.fog, padding: "12px 0", textAlign: "center" } }, "没有最近播放"))
              // ⚠️写成 onClick: loadRecent 会 TDZ——那是【立刻取引用】，而 loadRecent
              //   声明在云村区、也就是这一段后面。包一层箭头才是等点了再取。
              : h("button", { onClick: () => loadRecent(), className: "w-full active:opacity-70",
                  style: { fontFamily: F_BODY, fontSize: 12.5, color: t.tint, padding: "12px 0" } }, "看最近播放的 →"),
            h(Eyebrow, { style: { marginTop: 14, marginBottom: 2 } }, "本地 · 一起听")) : null,
          // 本地收藏（点左侧打开看列表；右侧圆钮直接播放）
          h("div", { className: "w-full flex items-center gap-3", style: { marginTop: 8, background: t.bg2, border: "1px solid " + t.line, borderRadius: 16, padding: "12px 14px" } },
            h("button", { onClick: () => setOpenPl("__fav__"), className: "flex items-center gap-3 flex-1 min-w-0 active:opacity-80 text-left" },
              h("div", { style: { flexShrink: 0, width: 52, height: 52, borderRadius: 12, background: "linear-gradient(135deg,#8a6d3b,#cfc0a0)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, color: "#fff" } }, "♡"),
              h("div", { className: "flex-1 min-w-0" },
                h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: t.ink } }, (apiBase && cookie) ? "本地收藏" : "我喜欢的音乐"),
                h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, marginTop: 2 } }, favs.length + " 首 · 咱家歌库的收藏"))),
            h("button", { onClick: () => favs.length && onPlaySong(favs[0].id, favs.map(s => s.id)), className: "shrink-0 active:opacity-70", style: { width: 36, height: 36, borderRadius: 999, background: t.ink, display: "flex", alignItems: "center", justifyContent: "center" } }, ic("play", t.bg2, 18))),
          // 创建歌单
          h("div", { className: "flex gap-2", style: { marginTop: 14 } },
            h("input", { value: plName, onChange: e => setPlName(e.target.value), placeholder: "新建歌单名", style: field }),
            h("button", { onClick: () => { if (plName.trim()) { const id = onCreatePlaylist(plName.trim(), []); setPlName(""); setOpenPl(id); } }, disabled: !plName.trim(), className: "active:opacity-70 disabled:opacity-40", style: { background: t.ink, color: t.bg2, fontFamily: F_BODY, fontSize: 13, padding: "0 16px", borderRadius: 8, flexShrink: 0 } }, "建")),
          // 角色歌单生成
          h("div", { style: { background: t.bg2, border: "1px solid " + t.line, borderRadius: 16, padding: "12px 14px", marginTop: 14 } },
            h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.ink } }, "根据角色人设生成歌单"),
            h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 2, marginBottom: 10, lineHeight: 1.4 } }, "让 TA 推 10 首自己会单曲循环的歌，自动去网易云拉成能直接听的歌单（需先配搜索接口）"),
            plCharPick
              ? h("div", { className: "flex flex-wrap gap-2" }, (characters || []).map(c => h("button", { key: c.id, onClick: () => { setPlCharPick(false); onGenCharPlaylist(c); }, className: "active:opacity-70 flex items-center gap-1.5", style: { background: t.bg, border: "1px solid " + t.line, borderRadius: 999, padding: "5px 10px 5px 5px" } }, h(Avatar, { character: c, size: 24, radius: 999 }), h("span", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.ink } }, c.name))))
              : h("button", { onClick: () => setPlCharPick(true), disabled: !!genCharPl, className: "w-full active:opacity-70 disabled:opacity-50", style: { background: t.ink, color: t.bg2, fontFamily: F_DISPLAY, fontSize: 14, padding: "9px", borderRadius: 10 } }, genCharPl ? "生成中…" : "选一个角色生成")),
          // 已有歌单列表（角色生成的歌单也在这儿）
          playlists.length ? h("div", { style: { marginTop: 16 } },
            h(Eyebrow, { style: { marginBottom: 8 } }, "歌单 · " + playlists.length),
            h("div", { className: "space-y-2" }, playlists.map(pl => { const ch = pl.charId ? (characters || []).find(c => c.id === pl.charId) : null; const q = (pl.songs || []).map(s => s.id); return h("div", { key: pl.id, className: "flex items-center gap-3", style: { background: t.bg2, border: "1px solid " + t.line, borderRadius: 14, padding: "10px 12px" } },
              h("button", { onClick: () => { if (q.length) onPlaySong(q[0], q); }, className: "shrink-0 active:opacity-70", style: { width: 46, height: 46, borderRadius: 10, background: pl.cover ? "center/cover no-repeat url(" + pl.cover + ")" : "linear-gradient(135deg,#a8b4c0,#cfc9bd)", display: "flex", alignItems: "center", justifyContent: "center" } }, ch ? h(Avatar, { character: ch, size: 26, radius: 999 }) : h("span", { style: { color: "#fff", fontSize: 16 } }, "♪")),
              h("button", { onClick: () => setOpenPl(pl.id), className: "flex-1 min-w-0 text-left active:opacity-70" },
                h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15, color: t.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, pl.name),
                h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginTop: 1 } }, (pl.songs || []).length + " 首" + (ch ? " · " + ch.name : ""))),
              h("button", { onClick: () => { if (q.length) onPlaySong(q[0], q); }, className: "shrink-0 active:opacity-60 flex items-center justify-center", style: { width: 34, height: 34, borderRadius: 999, background: t.ink } }, ic("play", t.bg2, 16))); }))) : null,
          // ⚠️「存在这儿的」必须排在歌单列表【后面】：它动辄几十首，插在前面就把
          //   角色生成的那几个歌单挤到翻不到的地方（她 2026-09-03 报的正是这个，
          //   v61.42 是我插错了位置）。最长的那一段永远垫底。
          songs.length ? h("div", { style: { marginTop: 18 } },
            h(Eyebrow, { style: { marginBottom: 2 } }, "存在这儿的 · " + songs.length),
            // ⚠️它跟上面的「最近播放」不是一回事，得说清楚，不然两栏看着一样
            //  （她 2026-09-03：「这个最近播放和下面的全部有啥区别」）：
            //   最近播放＝你听过什么（网易云账号的记录）；这一栏＝你在这儿存了什么。
            h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginBottom: 8 } },
              "咱家歌库里存着的歌——跟网易云账号没关系，在这儿删只影响这一栏，不动任何歌单"),
            h("div", { className: "space-y-2" }, songs.map(s2 => songRow(s2, { canRename: true })))) : null));

  // 底部导航
  const navBtn = (k, label, iconEl) => h("button", { onClick: () => setNav(k), className: "flex-1 flex flex-col items-center gap-1 active:opacity-70 py-2", style: { color: nav === k ? t.ink : t.fog } }, iconEl, h("span", { style: { fontFamily: F_BODY, fontSize: 10.5 } }, label));

  // ============ 云村 tab（v54.46 全量返工）：登录后就是一个小网易云 ============
  // 她搬到 VPS 后要的「完全搬进来」：搜索全库 / 日推 / 私人FM(带垃圾桶) / 排行榜 /
  // 最近播放 / 我喜欢的音乐 / 歌单建·删·移歌。读全部实时拉她账号；写（红心、加/移歌、
  // 建/删歌单、FM 垃圾桶）全部真实写回网易云，App 里立刻能看到；播放顺手 scrobble
  // 进听歌记录，账号的「最近播放」和年度报告也会算上在这儿听的歌。
  const nj = u => fetch(apiBase + u + (u.includes("?") ? "&" : "?") + "cookie=" + encodeURIComponent(cookie || "") + "&timestamp=" + Date.now()).then(r => r.json());
  const toRes = s => ({ id: s.id, name: s.name, artist: ((s.ar || s.artists || []).map(a => a.name).filter(Boolean).join(" / ")), cover: ((s.al || s.album || {}).picUrl || null) });
  useEffect(() => {
    if ((nav !== "cloud" && nav !== "mine") || !apiBase || !cookie || cv.me) return; // 「我的」也展示账号歌单，进哪个都拉一次
    (async () => {
      setCv(p => ({ ...p, busy: true }));
      try {
        const acc = await nj("/user/account");
        const me = acc && acc.profile ? { uid: acc.profile.userId, name: acc.profile.nickname, avatar: acc.profile.avatarUrl } : null;
        const [dl, pl, lk] = await Promise.all([
          nj("/recommend/songs").catch(() => null),
          me ? nj("/user/playlist?uid=" + me.uid + "&limit=50").catch(() => null) : null,
          me ? nj("/likelist?uid=" + me.uid).catch(() => null) : null
        ]);
        setCv(p => ({ ...p, busy: false, me: me,
          daily: (dl && dl.data && dl.data.dailySongs || []).map(toRes),
          pls: (pl && pl.playlist || []).map(x => ({ id: x.id, name: x.name, count: x.trackCount, cover: x.coverImgUrl, mine: !!(me && x.userId === me.uid) })),
          likeIds: new Set(((lk && lk.ids) || []).map(String)) }));
      } catch (e) { setCv(p => ({ ...p, busy: false })); toast("云村拉不动：" + (e.message || e)); }
    })();
  }, [nav, apiBase, cookie]);
  // 播放 + scrobble：登记听歌记录是唯一让"在这儿听"反映回她账号历史的通道，失败无声跳过
  const playCloud = (s, srcId) => { onPlayResult(s); try { nj("/scrobble?id=" + s.id + "&sourceid=" + (srcId || 0) + "&time=240").catch(() => {}); } catch (e) {} };
  // 「播放全部」走整列表连播：显式队列，不再逐首收库+单放第一首（那样队列会塌成单曲循环）
  const playAllCloud = (list, srcId) => { if (!list || !list.length) return; onPlayResultList(list); try { nj("/scrobble?id=" + list[0].id + "&sourceid=" + (srcId || 0) + "&time=240").catch(() => {}); } catch (e) {} };
  const openCloudPl = async pl => {
    setCv(p => ({ ...p, open: pl, openSongs: null }));
    try {
      const d = await nj("/playlist/track/all?id=" + pl.id + "&limit=200");
      setCv(p => (p.open && p.open.id === pl.id) ? { ...p, openSongs: (d && d.songs || []).map(toRes) } : p);
    } catch (e) { toast("歌单拉不动"); }
  };
  // 「我喜欢的音乐」不是普通歌单：likelist 只有 id，得再拿 song/detail 补全
  const openLikePl = async () => {
    const ids = [...(cv.likeIds || [])].slice(0, 200);
    setCv(p => ({ ...p, open: { id: "__like__", name: "我喜欢的音乐", count: (p.likeIds && p.likeIds.size) || 0, mine: false }, openSongs: null }));
    if (!ids.length) return setCv(p => p.open && p.open.id === "__like__" ? { ...p, openSongs: [] } : p);
    try {
      const d = await nj("/song/detail?ids=" + ids.join(","));
      setCv(p => (p.open && p.open.id === "__like__") ? { ...p, openSongs: (d && d.songs || []).map(toRes) } : p);
    } catch (e) { toast("红心歌单拉不动"); }
  };
  const cvSearch = async () => {
    const q = (cv.q || "").trim(); if (!q) return;
    setCv(p => ({ ...p, searching: true }));
    try {
      const d = await nj("/cloudsearch?keywords=" + encodeURIComponent(q) + "&limit=30");
      setCv(p => ({ ...p, searching: false, results: ((d && d.result && d.result.songs) || []).map(toRes) }));
    } catch (e) { setCv(p => ({ ...p, searching: false })); toast("搜不动：" + (e.message || e)); }
  };
  const loadFm = async () => {
    try {
      const d = await nj("/personal_fm");
      const add = ((d && d.data) || []).map(toRes);
      setCv(p => ({ ...p, fm: (p.fm || []).concat(add.filter(x => !(p.fm || []).some(y => y.id === x.id))) }));
    } catch (e) { toast("FM 拉不动"); }
  };
  const trashFm = async s => {
    setCv(p => ({ ...p, fm: (p.fm || []).filter(x => x.id !== s.id) }));
    try { await nj("/fm_trash?id=" + s.id); toast("已丢进 FM 垃圾桶，网易云会少推这类"); } catch (e) {}
  };
  const loadRecent = async () => {
    try {
      const d = await nj("/record/recent/song?limit=50");
      setCv(p => ({ ...p, recent: (((d && d.data && d.data.list) || []).map(x => toRes(x.data || x))) }));
    } catch (e) { toast("最近播放拉不动"); }
  };
  const loadTops = async () => {
    try {
      const d = await nj("/toplist");
      setCv(p => ({ ...p, tops: ((d && d.list) || []).slice(0, 20).map(x => ({ id: x.id, name: x.name, cover: x.coverImgUrl, count: x.trackCount, freq: x.updateFrequency, mine: false })) }));
    } catch (e) { toast("排行榜拉不动"); }
  };
  const setCvSub = k => { setCv(p => ({ ...p, sub: k })); if (k === "top" && !cv.tops) loadTops(); if (k === "recent" && !cv.recent) loadRecent(); };
  const refreshCvPls = async () => {
    const me = cv.me; if (!me) return;
    try {
      const pl = await nj("/user/playlist?uid=" + me.uid + "&limit=50");
      setCv(p => ({ ...p, pls: ((pl && pl.playlist) || []).map(x => ({ id: x.id, name: x.name, count: x.trackCount, cover: x.coverImgUrl, mine: x.userId === me.uid })) }));
    } catch (e) {}
  };
  const createRealPl = async name => {
    try {
      const d = await nj("/playlist/create?name=" + encodeURIComponent(name));
      const code = d && (d.code || (d.body && d.body.code));
      if (code && code !== 200) throw new Error("code " + code);
      setCvPlName(""); toast("已在你网易云账号建了「" + name + "」");
      await refreshCvPls();
    } catch (e) { toast("建歌单失败：" + (e.message || e)); }
  };
  const delRealPl = async pl => {
    requestAppConfirm("删掉网易云歌单「" + pl.name + "」？", "会真的从你的网易云账号删除。", async () => {
      try {
        await nj("/playlist/delete?id=" + pl.id);
        toast("已从你网易云账号删除");
        setCv(p => ({ ...p, pls: (p.pls || []).filter(x => x.id !== pl.id), open: (p.open && p.open.id === pl.id) ? null : p.open }));
      } catch (e) { toast("删除失败：" + (e.message || e)); }
    }, "删除");
  };
  const removeFromRealPl = async (pl, s) => {
    try {
      const d = await nj("/playlist/tracks?op=del&pid=" + pl.id + "&tracks=" + s.id);
      const code = d && (d.status || (d.body && d.body.code) || d.code);
      if (code && code !== 200) throw new Error("code " + code);
      toast("已从网易云的「" + pl.name + "」移除");
      setCv(p => ({ ...p, openSongs: (p.openSongs || []).filter(x => x.id !== s.id), pls: (p.pls || []).map(x => x.id === pl.id ? { ...x, count: Math.max(0, (x.count || 1) - 1) } : x) }));
    } catch (e) { toast("移除失败：" + (e.message || e)); }
  };
  // 加进她真网易云歌单（只列她自己建的，收藏的没有写权限）；v54.15 她赢完UNO当场抓的缺口
  const [cvAddPick, setCvAddPick] = useState(null); // 待入单的歌
  const ensureCvPls = async () => {
    if (cv.pls) return cv.pls;
    const acc = await nj("/user/account");
    const me = acc && acc.profile ? { uid: acc.profile.userId, name: acc.profile.nickname, avatar: acc.profile.avatarUrl } : null;
    if (!me) throw new Error("账号没连上");
    const pl = await nj("/user/playlist?uid=" + me.uid + "&limit=30");
    const pls = (pl && pl.playlist || []).map(x => ({ id: x.id, name: x.name, count: x.trackCount, cover: x.coverImgUrl, mine: x.userId === me.uid }));
    setCv(p => ({ ...p, me: p.me || me, pls: pls }));
    return pls;
  };
  const openCvAdd = async s => { try { await ensureCvPls(); setCvAddPick(s); } catch (e) { toast("先扫码连上账号才能写回网易云"); } };
  const addToRealPl = async (pl, s) => {
    setCvAddPick(null);
    try {
      const d = await nj("/playlist/tracks?op=add&pid=" + pl.id + "&tracks=" + s.id);
      const code = d && (d.status || d.body && d.body.code || d.code);
      if (code && code !== 200) throw new Error("code " + code);
      toast("已加进你网易云的「" + pl.name + "」");
      setCv(p => ({ ...p, pls: (p.pls || []).map(x => x.id === pl.id ? { ...x, count: (x.count || 0) + 1 } : x), openSongs: (p.open && p.open.id === pl.id && p.openSongs) ? [toRes({ id: s.id, name: s.name, ar: [{ name: s.artist }], al: { picUrl: s.cover } })].concat(p.openSongs) : p.openSongs }));
    } catch (e) { toast("写回失败：" + (e.message || e)); }
  };
  const cvAddSheet = cvAddPick ? h("div", { className: "absolute inset-0 z-40 flex items-end", style: { background: "rgba(0,0,0,0.35)" }, onClick: () => setCvAddPick(null) },
    h("div", { className: "w-full", style: { background: t.bg, borderRadius: "18px 18px 0 0", padding: "16px 18px calc(env(safe-area-inset-bottom) + 18px)", maxHeight: "60%", overflowY: "auto" }, onClick: e => e.stopPropagation() },
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15.5, color: t.ink, marginBottom: 4 } }, "加进网易云歌单"),
      h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginBottom: 10 } }, "《" + cvAddPick.name + "》→ 会真实写进你的网易云账号"),
      (cv.pls || []).filter(p => p.mine).map(pl => h("button", { key: pl.id, onClick: () => addToRealPl(pl, cvAddPick), className: "w-full flex items-center gap-3 py-2.5 active:opacity-70", style: { borderBottom: "1px solid " + t.line, textAlign: "left" } },
        h("div", { style: { flexShrink: 0, width: 38, height: 38, borderRadius: 8, background: pl.cover ? "center/cover no-repeat url(" + pl.cover + "?param=80y80)" : t.bg2 } }),
        h("div", { className: "min-w-0 flex-1" },
          h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, color: t.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, pl.name),
          h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog } }, pl.count + " 首")))),
      ((cv.pls || []).filter(p => p.mine).length === 0) ? h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.fog, padding: "14px 0" } }, "没找到你自己建的歌单——先去网易云 App 建一个（比如「赢言秋的歌」），回来刷新云村就有了") : null)) : null;
  const likeSong = async s => {
    const liked = cv.likeIds && cv.likeIds.has(String(s.id));
    try {
      await nj("/like?id=" + s.id + "&like=" + (!liked));
      setCv(p => { const ids = new Set(p.likeIds || []); liked ? ids.delete(String(s.id)) : ids.add(String(s.id)); return { ...p, likeIds: ids }; });
      toast(liked ? "已取消红心（同步到网易云）" : "❤ 已红心（同步到网易云）");
    } catch (e) { toast("红心没同步上"); }
  };
  // 账号条和搜索坐在一张纸上，不直接压在木纹上（木头上的字会脏）
  const cvPaper = { background: t.bg2, border: "1px solid " + t.line, borderRadius: 14,
    padding: "10px 12px", boxShadow: "0 2px 6px rgba(30,28,24,.07)" };
  const cloudTab = h("div", { className: "px-4 py-3" },
    cv.open
      ? h("div", null,
          h("button", { onClick: () => setCv(p => ({ ...p, open: null, openSongs: null })), className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 12.5, color: t.fog, marginBottom: 8 } }, "‹ 云村"),
          h("div", { className: "flex items-center gap-3", style: { marginBottom: 10 } },
            h("div", { style: { width: 54, height: 54, borderRadius: 10, background: cv.open.cover ? "center/cover no-repeat url(" + cv.open.cover + "?param=120y120)" : (cv.open.id === "__like__" ? "linear-gradient(135deg,#e0576b,#f0a8c0)" : t.bg2), display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 20 } }, cv.open.cover ? null : (cv.open.id === "__like__" ? "♥" : null)),
            h("div", null,
              h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: t.ink } }, cv.open.name),
              h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog } }, cv.open.count + " 首" + (cv.open.mine ? " · 我建的（可移歌）" : ""))),
            (cv.openSongs && cv.openSongs.length) ? h("button", { onClick: () => playAllCloud(cv.openSongs, cv.open.id === "__like__" ? 0 : cv.open.id), className: "ml-auto shrink-0 active:opacity-70", style: { width: 36, height: 36, borderRadius: 999, background: t.ink, display: "flex", alignItems: "center", justifyContent: "center" } }, ic("play", t.bg2, 16)) : null),
          cv.openSongs ? (cv.openSongs.length ? cv.openSongs.map(s => cloudRow(s, { srcId: cv.open.id === "__like__" ? 0 : cv.open.id, removable: cv.open.mine ? cv.open : null })) : h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.fog, padding: "20px 0", textAlign: "center" } }, "这个歌单是空的")) : h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.fog, padding: "20px 0", textAlign: "center" } }, "拉歌单中…"))
      : h("div", null,
          h("div", { style: cvPaper },
          cv.me ? h("div", { className: "flex items-center gap-3", style: { marginBottom: 10 } },
            h("div", { style: { width: 44, height: 44, borderRadius: 999, background: cv.me.avatar ? "center/cover no-repeat url(" + cv.me.avatar + "?param=100y100)" : t.bg2 } }),
            h("div", null,
              h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15.5, color: t.ink } }, cv.me.name),
              h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog } }, "网易云账号已连 · 操作会真实写回"))) : (cv.busy ? h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.fog, padding: "16px 0" } }, "连你的网易云账号中…") : null),
          // 搜索全库：结果行上红心/☁＋/收进家全都能用
          h("div", { className: "flex gap-2", style: { marginBottom: 10 } },
            h("input", { value: cv.q, onChange: e => { const v = e.target.value; setCv(p => ({ ...p, q: v })); }, onKeyDown: e => { if (e.key === "Enter") cvSearch(); }, placeholder: "搜网易云全库：歌名 / 歌手", style: field }),
            h("button", { onClick: cvSearch, disabled: cv.searching, className: "active:opacity-70 disabled:opacity-40", style: { background: t.ink, color: t.bg2, fontFamily: F_BODY, fontSize: 13, padding: "0 16px", borderRadius: 8, flexShrink: 0 } }, cv.searching ? "…" : "搜"))),
          cv.results
            ? h("div", null,
                h("button", { onClick: () => setCv(p => ({ ...p, results: null, q: "" })), className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 12.5, color: t.fog, marginBottom: 4 } }, "‹ 清空搜索结果"),
                cv.results.length ? cv.results.map(s => cloudRow(s)) : h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.fog, padding: "16px 0", textAlign: "center" } }, "没搜到"))
            : h("div", null,
                h("div", { className: "flex gap-1.5 items-end", style: { marginTop: 4 } }, cvChip("rec", "今天给你的"), cvChip("top", "大家在听")),
                h("div", { style: { borderTop: "1px solid " + t.line, background: t.bg2, borderRadius: (cv.sub === "rec" ? "0 10px 10px 10px" : "10px 10px 10px 10px"), padding: "2px 12px 12px" } },
                cv.sub === "rec" ? h("div", null,
                  // ⚠️这儿原来还摆着一张「我喜欢的音乐」入口卡。撤掉了：
                  //   这一栏是【发现】——装还不属于她的东西；「我喜欢的音乐」是她已经有的，
                  //   在「我的」里有一张专门的大卡。同一样东西原来在三个地方各有一份。
                  (cv.daily && cv.daily.length) ? h("div", null,
                    cvSection("每日推荐", h("button", { onClick: () => playAllCloud(cv.daily), className: "active:opacity-70", style: { fontFamily: F_BODY, fontSize: 11.5, color: t.tint } }, "▶ 播放全部")),
                    cv.daily.slice(0, 30).map(s => cloudRow(s))) : null,
                  cvSection("私人FM", h("button", { onClick: loadFm, className: "active:opacity-70", style: { fontFamily: F_BODY, fontSize: 11.5, color: t.tint } }, cv.fm ? "↻ 再来一批" : "▶ 开一波")),
                  cv.fm ? (cv.fm.length ? cv.fm.map(s => cloudRow(s, { trash: true })) : h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, padding: "8px 0" } }, "都丢垃圾桶了，再来一批")) : h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, padding: "4px 0 8px" } }, "网易云那套私人电台——🗑 会真实反馈「不喜欢」")) : null,
                cv.sub === "top" ? h("div", { style: { marginTop: 6 } },
                  cv.tops ? cv.tops.map(cvPlRow) : h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.fog, padding: "16px 0", textAlign: "center" } }, "拉榜单中…")) : null,
                (!cv.busy && cv.me && cv.sub === "rec" && !(cv.daily && cv.daily.length)) ? h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.fog, padding: "16px 0", textAlign: "center" } }, "日推没拉到——过几秒切出去再进来试试") : null))));

  // ── 底：唱片自己的那圈纹（v61.44）──────────────────────────────
  // v61.43 我做成了木台面，她 2026-09-03：「这个木头出现率是不是有点高了最近」——
  // 是真的：小游戏那架柜子已经是木头了，再来一块木头，两页就成了同一个材质。
  // 判据还是那句「原样搬到别的 app 里还成立吗」：木纹搬去哪儿都成立，所以它不说明
  // 这是什么东西；**唱片的同心纹只有音乐这一处成立**。
  // 圆心放在碟真正待的位置（播放页那张碟的圆心），整页就是那张碟放大之后荡出去的纹。
  // ⚠️底纹铺在【最外面这个外壳】上、Head 传 bg:"transparent"（mobile-ui-layout.md §3.5）。
  // ⚠️不挂 backgroundAttachment:"local"——内容在动，碟不该跟着动。
  // ⚠️深色/自定义主题下 t.ink 或 t.accent 未必是六位色号，拼透明度后缀会拼出废值、
  //   整层静默消失；两个都验，验不过退回纯色。
  const hex6 = v => /^#[0-9a-f]{6}$/i.test(String(v || ""));
  const crate = !(hex6(t.ink) && hex6(t.accent)) ? { background: t.bg } : {
    backgroundColor: t.bg,
    backgroundImage: [
      // 中心那圈亮：碟面反的光，从圆心往外淡出去
      "radial-gradient(circle at 50% 240px," + t.accent + "1f 0%," + t.accent + "10 38%,transparent 72%)",
      // 沟纹：一圈一圈的细线。⚠️间距不能等宽——真唱片外圈疏、里圈密，
      //   一套等距同心圆看着像靶子。所以叠三套疏密不同的。
      "repeating-radial-gradient(circle at 50% 240px," + t.ink + "00 0px," + t.ink + "00 5px," + t.ink + "0d 5px," + t.ink + "0d 6px)",
      "repeating-radial-gradient(circle at 50% 240px," + t.ink + "00 0px," + t.ink + "00 22px," + t.ink + "08 22px," + t.ink + "08 24px)",
      "repeating-radial-gradient(circle at 50% 240px," + t.ink + "00 0px," + t.ink + "00 57px," + t.ink + "0b 57px," + t.ink + "0b 59px)",
      // 四角压暗：碟离得越远越暗，页面才不是一张平纸
      "radial-gradient(circle at 50% 240px,transparent 40%," + t.ink + "14 100%)"
    ].join(",")
  };
  return h("div", { className: "h-full flex flex-col relative", style: crate },
    // ⚠️「3 / 12」走 sub 不走 en：v61.29「标题不留英文」把纯拉丁的 en 一律吃掉，
    //   而这一处的 en 是【数字】——从那版起第几首就再也没显示过（她还没发现）。
    //   数字不是英文装饰，它是这一页唯一说得清「放到哪了」的东西。
    h(Head, { zh: "一起听", bg: "transparent",
      sub: nav === "play" && now ? (idx >= 0 ? idx + 1 : 1) + " / " + (nowQueue.length || songs.length) + " 首" : null,
      onBack: () => { if (openPl) setOpenPl(null); else onBack(); } }),
    h("div", { className: "flex-1 overflow-y-auto" }, nav === "play" ? playTab : nav === "home" ? homeTab : nav === "cloud" ? cloudTab : mineTab),
    cvAddSheet,
    pickerOverlay,
    // 底部 tab。v61.42 按一句判据重排（她 2026-09-03：「好多功能都是一段一段加的
    // 所以看起来很乱，你帮他重新排序一下」）：
    //   **这首歌已经是我的了吗？**
    //   还不是 → 发现（搜、日推、私人FM、排行榜）
    //   已经是 → 我的（我喜欢的、我的歌单、最近播放、本地收藏、全部歌曲）
    //   正在放 → 在放
    //   压根不是歌 → 设置（接口、Cookie、登录、把歌弄进来）
    // 这样每样东西只有一个家。原来「我喜欢的音乐」在三处各有一份、歌单散在两个 tab、
    // 「曲库」里装的全是设置——都是因为没有这句判据，只能按加进来的先后往上摞。
    // 底栏＝箱子的前挡板：不另刷一块平米白，让木纹从底下透上来、只压深一档，
    // 上沿留一道亮线当木板的棱（不然它像贴上去的一条贴纸）
    h("div", { className: "shrink-0 flex items-stretch", style: {
      borderTop: "1px solid " + (hex6(t.ink) ? t.ink + "26" : t.line),
      boxShadow: hex6(t.ink) ? "inset 0 1px 0 rgba(255,255,255,.35)" : "none",
      background: hex6(t.ink) ? t.ink + "14" : t.bg } },
      (apiBase && cookie) ? navBtn("cloud", "发现", h("svg", { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: nav === "cloud" ? t.ink : t.fog, strokeWidth: 1.7 }, h("path", { d: "M6.5 18a4 4 0 0 1-.6-7.96A5.5 5.5 0 0 1 16.6 8.7 4.2 4.2 0 0 1 17.5 17z" }), h("path", { d: "M13.6 15.9a1.9 1.9 0 1 1-2.4-1.83V9.6l3.4 1" }))) : null,
      navBtn("play", "播放", h("svg", { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: nav === "play" ? t.ink : t.fog, strokeWidth: 1.7 }, h("circle", { cx: 12, cy: 12, r: 8 }), h("path", { d: "M10 9l5 3-5 3z", fill: nav === "play" ? t.ink : t.fog }))),
      navBtn("mine", "我的", h("svg", { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: nav === "mine" ? t.ink : t.fog, strokeWidth: 1.7 }, h("circle", { cx: 12, cy: 8, r: 3.4 }), h("path", { d: "M5 20c0-3.6 3.1-5.5 7-5.5s7 1.9 7 5.5" }))),
      navBtn("home", (apiBase && cookie) ? "设置" : "首页", (apiBase && cookie)
        ? h("svg", { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: nav === "home" ? t.ink : t.fog, strokeWidth: 1.7 },
            h("circle", { cx: 12, cy: 12, r: 3.2 }),
            h("path", { d: "M12 4v2M12 18v2M4 12h2M18 12h2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M17.7 6.3l-1.4 1.4M7.7 16.3l-1.4 1.4" }))
        : h("svg", { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: nav === "home" ? t.ink : t.fog, strokeWidth: 1.7 }, h("path", { d: "M4 11l8-6 8 6M6 10v9h12v-9" })))),
    h("input", { ref: audioFileRef, type: "file", accept: "audio/*", onChange: e => { const f = e.target.files && e.target.files[0]; if (f) { setLocalFile(f); setAddTab("local"); setNav("home"); } e.target.value = ""; }, style: { display: "none" } }),
    h("input", { ref: coverRef, type: "file", accept: "image/*", onChange: e => { const f = e.target.files && e.target.files[0]; if (f && now) onSetCover(now.id, f); e.target.value = ""; }, style: { display: "none" } }));
}

// 设置·情侣问答自定义题库：为每个角色单独加题（各角色不互通，内置 60 题仍共用）
function CoupleQAConfig({ characters, custom, onSave, toast }) {
  const t = useTheme();
  const chars = characters || [];
  const [selId, setSelId] = useState(chars[0] ? chars[0].id : "");
  const [text, setText] = useState("");
  useEffect(() => { setText(((custom || {})[selId] || []).join("\n")); }, [selId, custom]);
  const cur = chars.find(c => c.id === selId);
  const count = text.split("\n").filter(s => s.trim()).length;
  const save = () => { onSave(selId, text.split("\n")); toast("已保存 " + count + " 题"); };
  if (!chars.length) return h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: t.fog, paddingTop: 8 } }, "还没有角色，先去人格档案馆录入一位。");
  return h("div", null,
    h(Eyebrow, { style: { marginBottom: 8 } }, "情侣问答 · 自定义题库"),
    h("div", { style: { fontFamily: F_BODY, fontSize: 12, lineHeight: 1.7, color: t.fog, marginBottom: 12 } }, "为某个角色添加只属于你俩的问题——一行一题。内置 60 题所有角色共用；这里加的题只出现在你和该角色的问答小本，各角色之间不互通。"),
    h("div", { className: "flex gap-2 flex-wrap mb-3" }, chars.map(c => h("button", { key: c.id, onClick: () => setSelId(c.id), className: "active:opacity-70", style: { padding: "6px 12px", borderRadius: 999, fontFamily: F_BODY, fontSize: 13, background: selId === c.id ? t.ink : t.bg2, color: selId === c.id ? t.bg2 : t.sub, border: "1px solid " + (selId === c.id ? t.ink : t.line) } }, c.name))),
    h("textarea", { value: text, onChange: e => setText(e.target.value), rows: 8, placeholder: "一行一题，例如：\n你还记得我们第一次牵手是在哪里吗？\n如果周末去露营，你负责扎营还是生火？", style: { width: "100%", outline: "none", resize: "vertical", padding: "10px 12px", borderRadius: 12, fontFamily: F_BODY, fontSize: 13.5, lineHeight: 1.7, background: t.bg2, color: t.ink, border: "1px solid " + t.line } }),
    h("div", { className: "flex items-center justify-between mt-2" },
      h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog } }, count + " 题 · " + (cur ? cur.name : "")),
      h("button", { onClick: save, className: "active:opacity-70", style: { background: t.ink, color: t.bg2, fontFamily: F_DISPLAY, fontSize: 14, padding: "8px 20px", borderRadius: 10 } }, "保存")));
}
// 思维链 COT（全局通用）设置：开关 + 思考方式 + 预设存取。线下/同人文/梦境共用一套。
const COT_TEMPLATE =
  "· 此刻{{char}}的情绪与身体状态：TA现在最在意什么、身上什么感觉最强？\n" +
  "· 上一幕/上一句的张力：{{user}}刚才的话或动作，对{{char}}意味着什么？别答非所问。\n" +
  "· 这一步往哪推：顺着上面的情绪，{{char}}接下来最自然会做/说什么？只推进一点点，别跳戏、别提前写没发生的剧情。\n" +
  "· 落笔前自检：有没有八股翻译腔（如「空气中弥漫着」「嘴角勾起一抹弧度」「不易察觉的」）、超雄爹味、说教、OOC？有就换成贴人设的具体写法再落笔。";
function CotConfig({ toast, activeProfile }) {
  const t = useTheme();
  const [cfg, setCfg] = useState(() => loadCotConfig());
  const [modelStatus, setModelStatus] = useState(() => typeof offlineCotModelStatus === "function" ? offlineCotModelStatus(activeProfile) : { disabled: false, model: "" });
  useEffect(() => { if (typeof offlineCotModelStatus === "function") setModelStatus(offlineCotModelStatus(activeProfile)); }, [activeProfile && activeProfile.id, activeProfile && activeProfile.model]);
  const [sel, setSel] = useState("");
  const taRef = React.useRef(null);
  const save = next => { const c = saveCotConfig(next); setCfg(c); return c; };
  const setThink = v => save({ ...cfg, think: v });
  const insertVar = tok => {
    const el = taRef.current;
    if (el && typeof el.selectionStart === "number") {
      const s = el.selectionStart, e = el.selectionEnd, val = cfg.think || "";
      setThink(val.slice(0, s) + tok + val.slice(e));
      setTimeout(() => { try { el.focus(); el.selectionStart = el.selectionEnd = s + tok.length; } catch (x) {} }, 0);
    } else setThink((cfg.think || "") + tok);
  };
  const loadPreset = name => {
    const pr = (cfg.presets || []).find(x => x.name === name);
    setSel(name);
    if (pr) { save({ ...cfg, think: pr.think }); toast && toast("已载入预设「" + name + "」"); }
  };
  const saveAsPreset = () => {
    const name = (window.prompt("给这套思考方式起个名字（如：温柔向 / 高张力 / 专治八股）") || "").trim();
    if (!name) return;
    if (!(cfg.think || "").trim()) { toast && toast("思考方式是空的，先写点内容再存"); return; }
    const others = (cfg.presets || []).filter(x => x.name !== name);
    save({ ...cfg, presets: [...others, { name, think: cfg.think }] });
    setSel(name);
    toast && toast("已存为预设「" + name + "」");
  };
  const delPreset = () => {
    if (!sel) { toast && toast("先在上面选一个要删的预设"); return; }
    requestAppConfirm("删除预设「" + sel + "」？", "删除后不能恢复。", () => { const saved = save({ ...cfg, presets: (cfg.presets || []).filter(x => x.name !== sel) }); if ((saved.presets || []).some(x => x.name === sel)) return toast && toast("这次没删成功，原预设还在"); setSel(""); toast && toast("已删除"); }, "删除");
  };
  const inputSt = { width: "100%", outline: "none", padding: "9px 12px", borderRadius: 11, fontFamily: F_BODY, fontSize: 13.5, background: t.bg2, color: t.ink, border: "1px solid " + t.line };
  const chip = (label, onClick) => h("button", { onClick, className: "active:opacity-60", style: { fontFamily: "monospace", fontSize: 12, padding: "4px 12px", borderRadius: 999, border: "1px solid " + t.line, color: t.sub, background: "transparent" } }, label);
  return h("div", { className: "pt-4 pb-4" },
    // 总开关
    h("div", { className: "flex items-center justify-between py-4", style: { borderBottom: "1px solid " + t.line } },
      h("div", { style: { paddingRight: 12 } },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: t.ink } }, "启用创作小稿"),
        h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, lineHeight: 1.5, color: t.fog, marginTop: 2 } }, "单人线下会先写正文、再留一条简短创作旁注；同人文、梦境与群线下仍使用写作计划。它不是模型的隐秘推理，不进正文。留空 = 不启用。")),
      h(Toggle, { on: cfg.enabled === true, onChange: v => { save({ ...cfg, enabled: v }); toast && toast(v ? "已开启创作小稿" : "已关闭"); } })),
    activeProfile ? h("div", { className: "rounded-xl px-3 py-3 mt-3", style: { background: t.bg2, border: "1px solid " + (modelStatus.disabled ? "#d7a04b" : t.line) } },
      h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.ink } }, "当前模型 · " + (modelStatus.model || "未命名")),
      h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, lineHeight: 1.5, color: modelStatus.disabled ? "#a66b13" : t.fog, marginTop: 3 } }, modelStatus.disabled ? "线下保险已暂停小稿：它曾导致 stop 空正文。同人文仍会尝试。" : "线下小稿可正常尝试；若模型不按格式返回，会保留正文并标明未返回。"),
      modelStatus.disabled ? h("button", { onClick: () => { if (typeof retryOfflineCotModel === "function") retryOfflineCotModel(activeProfile); setModelStatus(offlineCotModelStatus(activeProfile)); toast && toast("已解除保险，下一轮重新试一次"); }, className: "mt-2 active:opacity-60", style: { fontFamily: F_BODY, fontSize: 12, color: t.accent } }, "重新试一次") : null) : null,
    // 预设
    h("div", { className: "pt-5" },
      h("div", { className: "flex items-baseline gap-2 mb-2" },
        h("span", { style: { fontFamily: F_DISPLAY, fontSize: 14, color: t.ink } }, "预设"),
        h("span", { style: { fontFamily: "monospace", fontSize: 10, letterSpacing: 1, color: t.fog } }, "PRESETS"),
        h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog } }, "存好几套，换着用不用重填")),
      h("div", { className: "flex gap-2" },
        h("select", { value: sel, onChange: e => loadPreset(e.target.value), style: { ...inputSt, flex: 1, appearance: "none", WebkitAppearance: "none" } },
          h("option", { value: "" }, (cfg.presets || []).length ? "选择预设载入…" : "（还没有预设）"),
          (cfg.presets || []).map(pr => h("option", { key: pr.name, value: pr.name }, pr.name))),
        h("button", { onClick: saveAsPreset, className: "active:opacity-70", style: { fontFamily: F_BODY, fontSize: 13, padding: "0 16px", borderRadius: 11, border: "1px solid " + t.line, color: t.ink } }, "存为"),
        h("button", { onClick: delPreset, className: "active:opacity-70", style: { fontFamily: F_BODY, fontSize: 13, padding: "0 14px", borderRadius: 11, border: "1px solid " + t.line, color: "#a24a4a" } }, "删除"))),
    // 思考方式
    h("div", { className: "pt-5" },
      h("div", { className: "flex items-baseline justify-between mb-2" },
        h("div", { className: "flex items-baseline gap-2" },
          h("span", { style: { fontFamily: F_DISPLAY, fontSize: 14, color: t.ink } }, "小稿检查方式"),
          h("span", { style: { fontFamily: "monospace", fontSize: 10, letterSpacing: 1, color: t.fog } }, "HOW TO THINK")),
        h("button", { onClick: () => { if (!(cfg.think || "").trim() || window.confirm("用示例模板替换当前内容？")) setThink(COT_TEMPLATE); }, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 12, color: t.accent } }, "插入示例模板")),
      h("div", { className: "flex gap-2 mb-2" }, chip("{{char}}", () => insertVar("{{char}}")), chip("{{user}}", () => insertVar("{{user}}"))),
      h("textarea", { ref: taRef, value: cfg.think || "", onChange: e => setThink(e.target.value), rows: 9,
        placeholder: "写下你希望创作小稿检查的步骤，一行一条。\n\n· {{char}} 会替换成角色名，{{user}} 替换成你的名字\n· 留空 = 不启用，剧情走默认方式\n· 小稿不进正文，每条正文旁可展开查看\n· 想治八股词/超雄/OOC？示例模板里有现成检查",
        style: { width: "100%", outline: "none", resize: "vertical", padding: "11px 13px", borderRadius: 12, fontFamily: F_BODY, fontSize: 13.5, lineHeight: 1.75, background: t.bg2, color: t.ink, border: "1px solid " + t.line } }),
      h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginTop: 6, lineHeight: 1.5 } }, "改动即时保存，全部角色通用。检查越具体，正文通常越贴；小稿会占少量输出额度。")));
}
// 图像 API（角色自拍）设置：开关 + 端点/密钥/模型/尺寸/质量。存 x_imgApi（图本身进 IndexedDB 不在这）。
// MiniMax 语音 TTS 配置：懒生成（点开语音那条才合成收费），成品缓存在本机重播免费
function VoiceEarsConfig({ toast }) {
  const t = useTheme();
  const [c, setC] = useState(loadVoiceEars());
  const set = patch => setC(saveVoiceEars(patch));
  const [testing, setTesting] = useState(false);
  const [msg, setMsg] = useState(null);
  const test = async () => {
    if (testing) return;
    setTesting(true); setMsg(null);
    try {
      const a = loadVoiceEars();
      if (!a.base || !a.k) throw new Error("地址和门锁都要填");
      const r = await fetchT(a.base + "/health?k=" + encodeURIComponent(a.k), {}, 15000);
      const d = await r.json();
      if (!r.ok || !d.ok) throw new Error(d.error || ("HTTP " + r.status));
      setMsg({ ok: true, text: "✅ 耳朵在线（模型 " + (d.model || "?") + "）。通话界面会出现🎙真声按钮。" });
    } catch (e) { setMsg({ ok: false, text: "连不上：" + (e && e.message || e) + "——书房 Mac 的话筒间服务要开着，门锁要对。" }); }
    setTesting(false);
  };
  const inp = (label, key, ph) => /*#__PURE__*/React.createElement("div", { className: "mb-2" },
    /*#__PURE__*/React.createElement("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.sub, marginBottom: 4 } }, label),
    /*#__PURE__*/React.createElement("input", {
      value: c[key] || "", onChange: e => set({ [key]: e.target.value }), placeholder: ph,
      className: "w-full outline-none px-3 py-2 rounded-xl",
      style: { fontFamily: F_BODY, fontSize: 13.5, background: t.bg2, color: t.ink, border: "1px solid " + t.line, minWidth: 0, padding: "9px 12px", borderRadius: 10, outline: "none" }
    }));
  return /*#__PURE__*/React.createElement("div", null,
    /*#__PURE__*/React.createElement("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.sub, lineHeight: 1.6, marginBottom: 8 } },
      "真声通话的耳朵：书房 Mac 上的语音识别服务。填好后，单人通话里会多一个🎙按钮——按下就是真的用声音聊，识别在书房、脑子和嗓子都在本机。两栏留空=功能隐藏。"),
    inp("识别服务地址", "base", "https://…ts.net/voice"),
    inp("门锁 k", "k", "voice-token"),
    /*#__PURE__*/React.createElement("button", {
      onClick: test, disabled: testing,
      className: "px-4 py-2 rounded-xl active:opacity-70 disabled:opacity-40",
      style: { fontFamily: F_BODY, fontSize: 13, background: t.tint, color: "#fff" }
    }, testing ? "测试中…" : "🔬 测一下耳朵"),
    msg && /*#__PURE__*/React.createElement("div", { style: { fontFamily: F_BODY, fontSize: 12, color: msg.ok ? "#4a9d6e" : "#c0504d", marginTop: 8, whiteSpace: "pre-wrap" } }, msg.text));
}
function TtsApiConfig({ toast, characters, onAssignVoice }) {
  const t = useTheme();
  const [c, setC] = useState(loadTtsApi());
  const set = patch => setC(saveTtsApi(patch));
  const [testing, setTesting] = useState(false);
  const [testErr, setTestErr] = useState(null);
  const testAudRef = useRef(null);
  // 克隆音色
  const [cloneFile, setCloneFile] = useState(null);
  const [cloneId, setCloneId] = useState("");
  const [cloning, setCloning] = useState(false);
  const [cloneMsg, setCloneMsg] = useState(null);
  // 音色库：克过的 voice_id 登记清单（试听/备注/指派给角色）
  const [vlib, setVlib] = useState(loadVoiceLib());
  const [assignFor, setAssignFor] = useState(null); // 展开指派角色列表的 voice_id
  const [manualId, setManualId] = useState("");
  const vtp = useTtsPlayer();
  const saveVlib = next => { if (saveVoiceLib(next)) { setVlib(next); return true; } toast && toast("这次没保存成功，原音色还在"); return false; };
  const addVoice = vid => {
    vid = String(vid || "").trim();
    if (!vid) return;
    saveVlib([{ id: vid, note: "", ts: Date.now() }, ...vlib.filter(v => v.id !== vid)]);
  };
  const runClone = async () => {
    if (!cloneFile || !cloneId.trim() || cloning) return;
    setCloning(true); setCloneMsg(null);
    try {
      const vid = await ttsCloneVoice(cloneFile, cloneId);
      addVoice(vid); // 克隆成功自动进音色库
      setCloneMsg({ ok: true, text: "✅ 克隆成功！voice_id = " + vid + "\n已存进下面的「我的音色库」——点「指派」直接给某个角色，或去角色档案手动填。" });
    } catch (e) { setCloneMsg({ ok: false, text: "❌ " + String((e && e.message) || e) }); }
    finally { setCloning(false); }
  };
  const runTest = async () => {
    if (!ttsReady(c)) { toast && toast("先填 GroupId 和密钥"); return; }
    const aud = new Audio();
    testAudRef.current = aud;
    aud.play().catch(() => {});
    setTesting(true); setTestErr(null);
    try {
      const blob = await ttsSpeak("你好呀，听听我的声音合不合适？", "female-shaonv");
      const url = URL.createObjectURL(blob);
      aud.src = url; aud.onended = () => URL.revokeObjectURL(url);
      await aud.play();
      toast && toast("✅ 接口通了，正在播放试听");
    } catch (e) { setTestErr(String((e && e.message) || e)); }
    finally { setTesting(false); }
  };
  const inSt = { width: "100%", outline: "none", padding: "9px 12px", borderRadius: 10, fontFamily: F_BODY, fontSize: 13.5, background: t.bg2, color: t.ink, border: "1px solid " + t.line };
  const row = (label, node) => h("div", { className: "mb-3" }, h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, marginBottom: 4 } }, label), node);
  return h("div", { className: "pt-8 mt-6", style: { borderTop: "1px dashed " + t.line } },
    h("div", { className: "flex items-center justify-between py-2" },
      h("div", { style: { paddingRight: 12 } },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: t.ink } }, "语音 TTS · 角色真发声"),
        h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, lineHeight: 1.5, color: t.fog, marginTop: 2 } }, "接 MiniMax 语音合成。开了之后，选了音色的角色发的语音消息能点 ▶ 真听。⭐按字符计费，但只有你点开那条才合成；合成过的存在本机、重播免费。")),
      h(Toggle, { on: c.enabled === true, onChange: v => { set({ enabled: v }); toast && toast(v ? "已开启语音合成（点开才收费）" : "已关闭"); } })),
    c.enabled ? h("div", { className: "pt-3" },
      row("接口地址（key 在哪个平台申请的就点哪个，别混）", h("div", null,
        h("div", { style: { display: "flex", gap: 6, marginBottom: 6 } },
          [["国际版 platform.minimax.io", "https://api.minimax.io"], ["国内 minimaxi.com", "https://api.minimaxi.com"], ["老国内站", "https://api.minimax.chat"]].map(pair =>
            h("button", { key: pair[1], onClick: () => set({ baseUrl: pair[1] }), className: "active:opacity-70",
              style: { flex: 1, fontFamily: F_BODY, fontSize: 10, padding: "7px 2px", borderRadius: 8, background: t.bg2, border: "1px solid " + ((c.baseUrl || "").trim() === pair[1] ? t.tint : t.line), color: (c.baseUrl || "").trim() === pair[1] ? t.tint : t.sub } }, pair[0]))),
        h("input", { value: c.baseUrl || "", onChange: e => set({ baseUrl: e.target.value }), placeholder: "https://api.minimax.io", style: inSt }))),
      row("GroupId（MiniMax 控制台·账户信息里）", h("input", { value: c.groupId || "", onChange: e => set({ groupId: e.target.value }), placeholder: "17xxxxxxxxxxxx", style: inSt })),
      row("密钥 API Key", h("input", { value: c.apiKey || "", onChange: e => set({ apiKey: e.target.value }), placeholder: "eyJ…", type: "password", style: inSt })),
      row("模型", h("select", { value: c.model || "speech-02-hd", onChange: e => set({ model: e.target.value }), style: Object.assign({}, inSt, { appearance: "none", WebkitAppearance: "none" }) },
        h("option", { value: "speech-02-hd" }, "speech-02-hd（音质好·推荐）"),
        h("option", { value: "speech-02-turbo" }, "speech-02-turbo（快·便宜）"),
        h("option", { value: "speech-01-hd" }, "speech-01-hd"),
        h("option", { value: "speech-01-turbo" }, "speech-01-turbo"))),
      h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginTop: 4, lineHeight: 1.5 } }, "填好后，去角色档案里给每位选一个「音色」，TA 的语音消息就能听了。"),
      h("button", { onClick: runTest, disabled: testing, className: "w-full mt-4 active:opacity-80 disabled:opacity-50", style: { fontFamily: F_BODY, fontSize: 13, color: "#fff", background: t.tint, borderRadius: 10, padding: "11px 0" } }, testing ? "合成中…" : "🔊 试听一句（诊断接口）"),
      // ---- 克隆音色：传人声样本 → 得到专属 voice_id → 填进角色档案 ----
      h("div", { className: "pt-4 mt-4", style: { borderTop: "1px dashed " + t.line } },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14, color: t.ink, marginBottom: 4 } }, "🎤 克隆音色"),
        h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, lineHeight: 1.6, marginBottom: 10 } }, "传一段【只有一个人说话、没背景音乐】的干净人声（10 秒~5 分钟，mp3/wav/m4a），起一个专属 voice_id——克隆好后去角色档案把「音色」填成这个 id 就是 TA 的声音了。⚠️ 克隆按次收费（比合成贵），確認样本干净再点；只克隆你有权使用的声音。"),
        // accept 不能只写 audio/*：iOS 会只给录音/媒体库入口、选不了「文件」里的 mp3——列明扩展名才会出现文件 App 选项
        h("input", { type: "file", accept: ".mp3,.m4a,.wav,.aac,audio/mpeg,audio/mp4,audio/wav,audio/*", onChange: e => { setCloneFile(e.target.files && e.target.files[0] || null); }, style: { fontFamily: F_BODY, fontSize: 12, color: t.sub, marginBottom: 8, display: "block", width: "100%" } }),
        h("input", { value: cloneId, onChange: e => setCloneId(e.target.value), placeholder: "起个 voice_id（字母开头≥8位，如 GuChao2026）", style: Object.assign({}, inSt, { marginBottom: 8 }) }),
        h("button", { onClick: runClone, disabled: cloning || !cloneFile || !cloneId.trim(), className: "w-full active:opacity-80 disabled:opacity-40", style: { fontFamily: F_BODY, fontSize: 13, color: "#fff", background: t.ink, borderRadius: 10, padding: "10px 0" } }, cloning ? "上传克隆中…（可能要一会儿）" : "上传并克隆"),
        cloneMsg ? h("div", { style: { marginTop: 10, padding: "10px 12px", background: cloneMsg.ok ? "rgba(63,109,90,0.08)" : "rgba(194,90,74,0.08)", border: "1px solid " + (cloneMsg.ok ? "rgba(63,109,90,0.3)" : "rgba(194,90,74,0.3)"), borderRadius: 10, fontFamily: F_BODY, fontSize: 12, lineHeight: 1.6, color: cloneMsg.ok ? "#3f6d5a" : "#c25a4a", userSelect: "text", WebkitUserSelect: "text", wordBreak: "break-all" } }, cloneMsg.text) : null),
      // ---- 我的音色库：克过的 voice_id 清单（试听/备注/指派给角色/补录）----
      h("div", { className: "pt-4 mt-4", style: { borderTop: "1px dashed " + t.line } },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14, color: t.ink, marginBottom: 4 } }, "🗂 我的音色库" + (vlib.length ? " · " + vlib.length : "")),
        h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, lineHeight: 1.6, marginBottom: 10 } }, "克隆成功的音色自动记在这，可试听、写备注、一键指派给角色。以前克过没登记的，补录 voice_id 即可。「移除」只是清单删掉，不影响 MiniMax 账号里的音色。"),
        h("div", { className: "flex gap-2", style: { marginBottom: 10 } },
          h("input", { value: manualId, onChange: e => setManualId(e.target.value), placeholder: "补录已有的 voice_id", style: Object.assign({}, inSt, { flex: 1, width: "auto" }) }),
          h("button", { onClick: () => { addVoice(manualId); setManualId(""); }, disabled: !manualId.trim(), className: "active:opacity-70 disabled:opacity-40", style: { fontFamily: F_BODY, fontSize: 12.5, color: "#fff", background: t.ink, border: "none", borderRadius: 10, padding: "0 16px", flexShrink: 0 } }, "补录")),
        vlib.length === 0 ? null : h("div", { style: { display: "flex", flexDirection: "column", gap: 8 } }, vlib.map(v => {
          // trim 匹配：手填 voiceId 多打空格也算在用（和 ttsSpeak 的沉稳匹配保持一致）
          const users = (characters || []).filter(ch => String(ch.voiceId || "").trim() === String(v.id).trim());
          const meP = vtp.play && vtp.play.k === v.id;
          return h("div", { key: v.id, style: { border: "1px solid " + t.line, borderRadius: 12, padding: "10px 12px", background: t.bg2 } },
            h("div", { className: "flex items-center gap-2" },
              h("div", { className: "flex-1 min-w-0" },
                h("div", { style: { fontFamily: "'Archivo',ui-monospace,monospace", fontSize: 12.5, color: t.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, v.id),
                users.length ? h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.tint, marginTop: 2 } }, "→ " + users.map(u => u.remark || u.name).join("、") + " 在用") : null),
              h("button", { onClick: () => vtp.toggle(v.id, "你好呀，我是这个音色，听听合不合适？", v.id), className: "active:opacity-60 shrink-0", style: { fontFamily: F_BODY, fontSize: 11.5, color: t.ink, border: "1px solid " + t.line, borderRadius: 999, padding: "5px 12px", background: "transparent" } }, meP ? (vtp.play.st === "gen" ? "…" : "⏸") : "试听"),
              h("button", { onClick: () => setAssignFor(assignFor === v.id ? null : v.id), className: "active:opacity-60 shrink-0", style: { fontFamily: F_BODY, fontSize: 11.5, color: "#fff", background: t.tint, border: "none", borderRadius: 999, padding: "6px 12px" } }, "指派"),
              h("button", { onClick: () => requestAppConfirm("从清单移除这个音色？", "不影响 MiniMax 账号。", () => saveVlib(vlib.filter(x => x.id !== v.id)), "移除"), className: "active:opacity-60 shrink-0", style: { fontFamily: F_BODY, fontSize: 13, color: t.fog, border: "none", background: "transparent", padding: "2px 4px" } }, "✕")),
            h("input", { value: v.note || "", onChange: e => saveVlib(vlib.map(x => x.id === v.id ? { ...x, note: e.target.value } : x)), placeholder: "备注（谁的声音 / 什么感觉）", style: { width: "100%", outline: "none", marginTop: 8, padding: "7px 10px", borderRadius: 8, fontFamily: F_BODY, fontSize: 12, background: t.bg, color: t.sub, border: "1px solid " + t.line } }),
            // 语速调节（v47.89）：压亢奋只靠语速（音调绝不动，防变声成八戒）。老 calm 兼容成 0.85
            (() => {
              const sp = (v.speed != null && isFinite(v.speed)) ? Number(v.speed) : (v.calm ? 0.85 : 1.0);
              const setSp = val => saveVlib(vlib.map(x => x.id === v.id ? { ...x, speed: val, calm: undefined } : x));
              const lbl = sp >= 0.99 ? "正常" : sp >= 0.9 ? "稍稳" : sp >= 0.8 ? "沉稳" : sp >= 0.7 ? "很稳" : "极稳";
              return h("div", { style: { marginTop: 10 } },
                h("div", { className: "flex items-center justify-between", style: { marginBottom: 3 } },
                  h("div", null,
                    h("span", { style: { fontFamily: F_BODY, fontSize: 12, color: t.ink } }, "语速 · 压亢奋"),
                    h("span", { style: { fontFamily: F_BODY, fontSize: 10, color: t.fog, marginLeft: 6 } }, "音色太亢奋就往左拖，越左越稳")),
                  h("span", { style: { fontFamily: F_DISPLAY, fontSize: 12.5, color: sp < 0.99 ? t.tint : t.fog } }, lbl + " " + sp.toFixed(2))),
                h(Slider, { value: sp, min: 0.6, max: 1.0, step: 0.01, onChange: setSp }),
                h("div", { className: "flex items-center gap-2", style: { marginTop: 6 } },
                  h("button", { onClick: () => vtp.toggle(v.id + "_prev", "嗯，就这样吧。今天先到这里，你早点休息。", v.id), className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 11, color: t.tint, border: "1px solid " + t.line, borderRadius: 999, padding: "4px 12px" } }, vtp.play && vtp.play.k === (v.id + "_prev") ? (vtp.play.st === "gen" ? "合成中…" : "⏸ 停") : "▶ 试平静句"),
                  h("span", { style: { fontFamily: F_BODY, fontSize: 10, color: t.fog } }, "拖动后重听这句对比")));
            })(),
            // 语速调过（<1）却没角色在用 → 警告：实际聊天不会变
            v.speed != null && v.speed < 0.99 && users.length === 0 ? h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: "#c25a4a", marginTop: 6, lineHeight: 1.6, background: "rgba(194,90,74,0.08)", borderRadius: 8, padding: "6px 9px" } }, "⚠️ 语速设置只对试听生效——没有角色在用这个 voice_id。去角色档案把「音色」填成上面这个 id（一字不差、别多空格），实际聊天里 TA 的语音才会跟着变。") : null,
            // 情绪模式（v48.31）：MiniMax 的 emotion 参数会把声音往预设情绪模板上掰——克隆音色被掰就不像本人了。
            // 原声=永不传 emotion（平台试听就是这样，克隆音最像）；跟内容=角色标的语气优先、平静句不传；锁平静=强制 neutral 模板
            h("div", { style: { marginTop: 10, paddingTop: 8, borderTop: "1px dashed " + t.line } },
              h("div", { style: { marginBottom: 6 } },
                h("span", { style: { fontFamily: F_BODY, fontSize: 12, color: t.ink } }, "情绪模式"),
                h("span", { style: { fontFamily: F_BODY, fontSize: 10, color: t.fog, marginLeft: 6 } }, "克隆音色听着不像本人 → 选「原声」")),
              h("div", { className: "flex flex-wrap items-center gap-2" },
                [["auto", "跟内容"], ["none", "原声·最像"], ["neutral", "锁平静"]].map(pair => h("button", {
                  key: pair[0],
                  onClick: () => { saveVlib(vlib.map(x => x.id === v.id ? { ...x, emoMode: pair[0] } : x)); toast && toast(pair[0] === "none" ? "原声：合成时完全不带情绪参数——克隆音色最像本人（角色标的语气会被忽略）" : pair[0] === "auto" ? "跟内容：角色发语音时自己标的语气优先；平静句不带参数、保本音" : "锁平静：所有句子都压成平静语气"); },
                  className: "active:opacity-70",
                  style: { fontFamily: F_BODY, fontSize: 12, padding: "5px 12px", borderRadius: 999, background: (v.emoMode || "auto") === pair[0] ? t.ink : "transparent", color: (v.emoMode || "auto") === pair[0] ? t.bg2 : t.fog, border: "1px solid " + ((v.emoMode || "auto") === pair[0] ? t.ink : t.line) } }, pair[1])),
                h("button", { onClick: () => vtp.toggle(v.id + "_emoprev_" + (v.emoMode || "auto"), "你怎么才回我呀，我都等急了！算了，你来了就好。", v.id), className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 11, color: t.tint, border: "1px solid " + t.line, borderRadius: 999, padding: "4px 12px" } }, vtp.play && String(vtp.play.k).indexOf(v.id + "_emoprev") === 0 ? (vtp.play.st === "gen" ? "合成中…" : "⏸ 停") : "▶ 试情绪句"))),
            // 日语·汉字注音（v47.93）：日语角色专用。治「寝→中文qin」——合成前把汉字转成假名读音
            h("div", { className: "flex items-center justify-between", style: { marginTop: 10, paddingTop: 8, borderTop: "1px dashed " + t.line } },
              h("div", { style: { paddingRight: 10 } },
                h("span", { style: { fontFamily: F_BODY, fontSize: 12, color: t.ink } }, "日语·汉字注音"),
                h("span", { style: { fontFamily: F_BODY, fontSize: 10, color: t.fog, marginLeft: 6 } }, "日语角色开：汉字按假名读，不串中文")),
              h(Toggle, { on: !!v.jpKana, onChange: on => { saveVlib(vlib.map(x => x.id === v.id ? { ...x, jpKana: on } : x)); toast && toast(on ? "日语句里的汉字会先转假名再读（每条多一次很便宜的AI转换）" : "已关闭注音"); } })),
            assignFor === v.id ? h("div", { className: "flex flex-wrap gap-2", style: { marginTop: 8 } },
              (characters || []).length === 0 ? h("span", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog } }, "还没有角色，先去人格档案馆建一个。") :
              (characters || []).map(ch => h("button", { key: ch.id, onClick: () => { onAssignVoice && onAssignVoice(ch.id, v.id); setAssignFor(null); }, className: "active:opacity-70",
                style: { fontFamily: F_BODY, fontSize: 12, padding: "6px 13px", borderRadius: 999, background: ch.voiceId === v.id ? t.tint : "transparent", color: ch.voiceId === v.id ? "#fff" : t.ink, border: "1px solid " + (ch.voiceId === v.id ? t.tint : t.line) } }, ch.remark || ch.name))) : null);
        }))),
      testErr ? h("div", { style: { marginTop: 12, padding: "12px 13px", background: "rgba(194,90,74,0.08)", border: "1px solid rgba(194,90,74,0.3)", borderRadius: 10 } },
        h("div", { style: { fontFamily: F_BODY, fontSize: 12, fontWeight: 700, color: "#c25a4a", marginBottom: 6 } }, "❌ 没出声。报错原文（可截图发我）："),
        h("div", { style: { fontFamily: "monospace", fontSize: 11, lineHeight: 1.6, color: t.ink, wordBreak: "break-all", userSelect: "text", WebkitUserSelect: "text", maxHeight: 160, overflowY: "auto" } }, testErr)) : null) : null);
}
// 缓存命中读数（手机看不了 console，就在设置里给个看得见的）：读 window.__usage(callAI anthropic 分支记的)
function CacheStatCard() {
  const t = useTheme();
  const [, setTick] = useState(0);
  const _all = (typeof window !== "undefined" && window.__usage) || [];
  // 只统计【主聊天(ch=cacheHist)】：日记/交换日记等后台生成走同一贵线但 prompt 全然不同，混进来会拉低命中率、乱指纹（她 2026-07-14 抓的）。
  const _chat = _all.filter(r => r.ch);
  const usage = _chat.length ? _chat : _all; // 没有新格式记录时退回全部(旧记录兼容)
  const s = usage.reduce((o, r) => { o.cr += r.cr || 0; o.cw += r.cw || 0; o.hit += (r.cr > 0 ? 1 : 0); return o; }, { cr: 0, cw: 0, hit: 0 });
  const bridgeUsage = usage.filter(r => r.bridge);
  const requested = bridgeUsage.filter(r => r.cacheRequested && r.systemBreakpoint).length;
  const historyMarked = bridgeUsage.filter(r => r.historyBreakpoint).length;
  const providerReports = usage.filter(r => r.usageReported).length;
  // 前缀指纹诊断（她 2026-07-13「连着聊也断」）：稳定前缀每轮该一样→指纹种类应该很少。接近调用次数=前缀每轮在变=没命中的真因
  const phList = usage.map(r => r.ph).filter(x => x != null);
  const phKinds = new Set(phList).size;
  // 前缀变动次数（比数「种」更准）：pfxSame===false 就是那轮前缀变了。0~1 次=一次性(改版/偶发)、没事；一直增=每轮 churn=真bug
  const pfxChanges = usage.filter(r => r.pfxSame === false).length;
  const pfxDrift = phList.length >= 4 && pfxChanges >= 3;
  return h("div", { style: { marginTop: 22, paddingTop: 16, borderTop: "1px solid " + t.line } },
    h("div", { className: "flex items-center justify-between", style: { marginBottom: 6 } },
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: t.ink } }, "缓存命中 · 小克(fable)线路"),
      h("button", { onClick: () => setTick(x => x + 1), className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 12.5, color: t.tint } }, "🔄 刷新")),
    usage.length === 0
      ? h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, lineHeight: 1.6 } }, "还没有记录。去跟小克【1 小时内连发两三条】，再回这儿点「刷新」看命中。（只有走 anthropic/fable 的角色才有缓存，gemini 中转按次计费没有）")
      : h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: s.hit > 0 || requested > 0 ? "#3c7a4a" : t.sub, lineHeight: 1.7 } },
          bridgeUsage.length
            ? "订阅桥近 " + bridgeUsage.length + " 次｜缓存请求 " + requested + " 次｜历史断点 " + historyMarked + " 次"
            : "近 " + usage.length + " 次调用｜命中缓存 " + s.hit + " 次｜读缓存(一折价) " + s.cr + " tok｜写缓存 " + s.cw + " tok",
          bridgeUsage.length
            ? h("div", { style: { marginTop: 4, color: providerReports > 0 ? "#3c7a4a" : t.fog, fontSize: 11.5 } },
                providerReports > 0
                  ? "✓ Max/Fable 订阅桥已回传 CLI 缓存账单"
                  : (requested > 0 ? "✓ 已发送 Anthropic 稳定前缀缓存标记" : "订阅桥使用 OpenAI 方言；缓存由 CLI 引擎管理，等待 usage 回执"),
                h("div", { style: { marginTop: 3, color: t.fog, fontSize: 11 } },
                  providerReports > 0
                    ? "上游有回执：确认命中 " + s.hit + " 次｜读 " + s.cr + " tok｜写 " + s.cw + " tok"
                    : "上游未回传 cache usage；这里如实显示“已请求 + 前缀可复用”，不把 0 冒充未命中。"))
            : h("div", { style: { marginTop: 4, color: s.hit > 0 ? "#3c7a4a" : t.fog, fontSize: 11.5 } }, s.hit > 0 ? "✓ 缓存正在替你省钱（读的部分只按一折收）" : (s.cw > 0 ? "已在写缓存——再对小克连发一条(1小时内)就会出现「读取」" : "还没写进缓存，检查小克是不是走 fable 线路")),
          phList.length ? h("div", { style: { marginTop: 4, color: pfxDrift ? "#b4593b" : t.fog, fontSize: 11 } },
            "前缀指纹：" + phList.length + " 次里 " + phKinds + " 种、变动 " + pfxChanges + " 次" + (pfxDrift ? "　⚠️前缀几乎每轮在变→这才是不命中的真因，截图发我" : "（变动 0~1 次=一次性/没事；一直涨=每轮churn发我）")) : null));
}
// 头像池（她 2026-08-25 定的 B 档）：她从相册一次挑几十张（猫、风景、动漫截图…），
// 存进本地图库当池子。论坛路人、常驻、小号、还有任何没传头像的人，都按种子哈希
// 从池子里稳定取一张——同一个人永远同一张。零 API 调用、零外链，图是她自己挑的。
// 参考的那个小手机是硬编码 190 条别人图床的外链 + Math.random，两点都不抄。
function AvatarPoolConfig({ toast }) {
  const t = useTheme();
  const fileRef = useRef(null);
  const [pool, setPool] = useState(() => (typeof avatarPool === "function" ? avatarPool() : []));
  const [busy, setBusy] = useState(false);
  const [armed, setArmed] = useState(false);
  const add = async e => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    setBusy(true);
    try {
      const keys = [];
      for (const f of files) {
        try {
          // 头像最大只会显示到 76px，存 256 见方足够，别把几十张原图塞进图库
          const dataUrl = await resizeImageFile(f, 256, 0.86);
          const k = typeof imgToVault === "function" ? await imgToVault(dataUrl) : dataUrl;
          if (k) keys.push(k);
        } catch (x) {}
      }
      const next = [...pool, ...keys].filter((v, i, a) => a.indexOf(v) === i).slice(0, 300);
      avatarPoolSave(next); setPool(next);
      toast && toast(keys.length ? ("加了 " + keys.length + " 张，池子现在 " + next.length + " 张") : "一张都没读进来");
    } finally { setBusy(false); }
  };
  return h("div", { className: "pt-8 mt-6", style: { borderTop: "1px dashed " + t.line } },
    h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: t.ink } }, "头像池 · 论坛路人和没传头像的人"),
    h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, lineHeight: 1.6, color: t.fog, marginTop: 4 } },
      "论坛里的路人、常驻熟面孔、小号，还有任何没传过头像的人，都从这个池子里按各自的 ID 取一张——"
      + "同一个人永远同一张，不会刷一次换张脸。池子空着的时候会自动画一张渐变色块顶上，"
      + "所以不塞图也不会退回 emoji。一次可以多选，不花任何 API 调用。"),
    h("div", { className: "flex items-center gap-3", style: { marginTop: 12 } },
      h("button", {
        onClick: () => fileRef.current && fileRef.current.click(),
        className: "active:opacity-70",
        style: { background: t.ink, color: t.bg2, border: "none", borderRadius: 10, padding: "10px 18px", fontFamily: F_DISPLAY, fontSize: 14, opacity: busy ? 0.5 : 1 }
      }, busy ? "读取中…" : "从相册添加"),
      h("span", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog } },
        pool.length ? ("池子里有 " + pool.length + " 张") : "还是空的 · 现在用程序化头像"),
      pool.length ? h("button", {
        onClick: () => { if (armed) { avatarPoolSave([]); setPool([]); setArmed(false); toast && toast("已清空，回到程序化头像"); } else setArmed(true); },
        className: "active:opacity-60",
        style: { marginLeft: "auto", fontFamily: F_BODY, fontSize: 12, color: t.accent }
      }, armed ? "确定清空？" : "清空") : null),
    h("input", { ref: fileRef, type: "file", accept: "image/*", multiple: true, className: "hidden", onChange: add }),
    pool.length ? h("div", { style: { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 } },
      pool.slice(0, 24).map(k => h("img", {
        key: k, src: typeof resolveImg === "function" ? resolveImg(k) : k, alt: "",
        className: "object-cover", style: { width: 38, height: 38, borderRadius: 999, border: "1px solid " + t.line }
      })).concat(pool.length > 24 ? [h("span", { key: "more", style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, alignSelf: "center" } }, "…还有 " + (pool.length - 24) + " 张")] : [])) : null);
}
function ImageApiConfig({ toast }) {
  const t = useTheme();
  const [store, setStore] = useState(() => (typeof loadImgApiProfiles === "function" ? loadImgApiProfiles() : { activeId: "legacy", profiles: [Object.assign({ id: "legacy", name: "图像站 1" }, typeof loadImgApi === "function" ? loadImgApi() : {})] }));
  const [editing, setEditing] = useState(false);
  const c = store.profiles.find(p => p.id === store.activeId) || store.profiles[0];
  const persist = next => { const clean = typeof saveImgApiProfiles === "function" ? saveImgApiProfiles(next) : next; setStore(clean); return clean; };
  const set = patch => {
    const profiles = store.profiles.map((p, i) => p.id === store.activeId ? Object.assign({}, p, patch, { name: String((patch && patch.name) != null ? patch.name : p.name).trim() || ("图像站 " + (i + 1)) }) : p);
    persist(Object.assign({}, store, { profiles }));
  };
  const switchSite = id => { persist(Object.assign({}, store, { activeId: id })); setModels([]); setTestRes(null); toast && toast("已切换图像站"); };
  const addSite = (copy, source) => {
    const n = store.profiles.length + 1;
    const id = "img_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7);
    const from = source || c;
    const base = copy ? Object.assign({}, from) : { baseUrl: "", apiKey: "", model: "gpt-image-2", size: "1024x1536", quality: "medium", enabled: false, refFieldMode: "auto" };
    const profile = Object.assign({}, base, { id, name: copy ? ((from.name || "图像站") + " · 副本") : ("图像站 " + n) });
    persist({ version: 2, activeId: id, profiles: store.profiles.concat(profile) }); setModels([]); setTestRes(null); setEditing(true);
    toast && toast(copy ? "已复制并切到新站点" : "已新增图像站");
  };
  const removeSite = id => {
    if (store.profiles.length <= 1) { toast && toast("至少保留一个图像站"); return; }
    const target = store.profiles.find(p => p.id === (id || store.activeId)) || c;
    requestAppConfirm("删除图像站「" + (target.name || "未命名") + "」？", "只删本站配置。", () => { const profiles = store.profiles.filter(p => p.id !== target.id); const saved = persist({ version: 2, activeId: profiles[0].id, profiles }); if ((saved.profiles || []).some(p => p.id === target.id)) return toast && toast("这次没删成功，原图像站还在"); setModels([]); setTestRes(null); toast && toast("已删除并切到另一个图像站"); }, "删除");
  };
  const [models, setModels] = useState([]);
  const [fetching, setFetching] = useState(false);
  const pull = async () => {
    if (!c.baseUrl || !c.apiKey) { toast && toast("先填接口地址和密钥"); return; }
    setFetching(true);
    try {
      const cleanBase = typeof normalizedOpenAIBase === "function" ? normalizedOpenAIBase(c.baseUrl) : c.baseUrl;
      if (cleanBase && cleanBase !== c.baseUrl) set({ baseUrl: cleanBase });
      const ms = await fetchModelList(Object.assign({}, c, { baseUrl: cleanBase }));
      setModels(ms || []); toast && toast((ms || []).length + " 个模型（挑含 image/dall-e/flux 的）");
    }
    catch (e) { toast && toast("拉取失败：" + (e.message || e)); }
    finally { setFetching(false); }
  };
  // 诊断：真调一次接口拍张测试图。成→当场显示；败→把原始报错整段贴出来（能截图排查）
  const [testing, setTesting] = useState(false);
  const [testRes, setTestRes] = useState(null);
  const [testRef, setTestRef] = useState(null);
  const runTest = async (fieldOverride) => {
    if (typeof generateSelfieImage !== "function") { toast && toast("图像模块没加载"); return; }
    // 某些中转只认 image，另一些只认 image[]。诊断卡允许带着指定字段
    // 直接重试；先同步写入站点配置，engine 随后会从持久化配置重新读取。
    if (typeof fieldOverride === "string") set({ refFieldMode: fieldOverride });
    setTesting(true); setTestRes(null);
    try {
      // 能力探针只发一枪。旧版的「原样复印、只能换白底」既像身份复制指令，又会在
      // 审核失败后自动换稿连射，部分中转会把它判成多次触发并锁 30 分钟。
      // 这里用正常的参考图编辑任务确认“图片有没有送达、脸能不能跟住”，不再做压力测试。
      const prompt = testRef
        ? "Edit the attached portrait into a simple studio photo with a plain warm-gray background. Keep the same adult man: the same face, facial features, hairstyle, age, skin tone and recognizable appearance. Do not replace him with another person and do not change his sex. Normal clothing, neutral expression, realistic photo, no text."
        : "a cute golden retriever puppy sitting on green grass, soft natural daylight, realistic photo";
      const out = await generateSelfieImage(prompt, testRef, { attemptMs: 180000, budgetMs: 190000, size: "1024x1024", preferLegacy: true, singleShot: true });
      const src = out.dataUrl || out.url || (out.blob ? URL.createObjectURL(out.blob) : null);
      setTestRes(src ? { ok: true, src: src, refs: out.referenceCount || 0, bytes: out.referenceBytes || 0, field: out.refField || null, mode: out.refMode || "generation", fidelity: out.inputFidelity || null, identityVerification: out.identityVerification || null } : { ok: false, err: "接口通了但没从返回里解析出图片。" });
    } catch (e) {
      const err = String((e && e.message) || e);
      // 有些 OpenAI 兼容中转把单图字段做成了 image[]，另一些仍只认 image。
      // 当上游明确说「请上传/附上图片」时，文件并非没选，而是 multipart 字段没被它接住。
      // 诊断仍坚持一次只发一枪（避免审核冷却/重复扣费），但替用户把【下一枪】的字段
      // 按站点切好并保存；页面同时给出醒目的再次测试按钮，不必回头猜下拉框。
      const missingRef = !!testRef && /请上传|需要.{0,8}(?:原图|图片)|先看到原图|no\s+image|image\s+(?:is\s+)?(?:required|missing)|upload.{0,30}image|image\s+is\s+attached|once\s+the\s+image\s+is\s+attached/i.test(err);
      const timedOut = /请求在\s*\d+\s*秒后中止|等待到点超时|timed?\s*out|timeout/i.test(err);
      let switchedField = null;
      if (missingRef) {
        switchedField = (c.refFieldMode === "bracket") ? "first" : "bracket";
        set({ refFieldMode: switchedField });
      }
      setTestRes({ ok: false, err, missingRef, timedOut, switchedField });
    }
    finally { setTesting(false); }
  };
  const inSt = { width: "100%", outline: "none", padding: "9px 12px", borderRadius: 10, fontFamily: F_BODY, fontSize: 13.5, background: t.bg2, color: t.ink, border: "1px solid " + t.line };
  const row = (label, node) => h("div", { className: "mb-3" }, h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, marginBottom: 4 } }, label), node);
  if (!editing) return h("div", null,
    h("div", { className: "flex items-center justify-between", style: { marginBottom: 12 } },
      h("div", null,
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 20, color: t.ink } }, "图像站点"),
        h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginTop: 2 } }, "已保存 " + store.profiles.length + " 条 · 点卡片单独编辑")),
      h("button", { onClick: () => addSite(false), style: { fontFamily: F_BODY, fontSize: 12.5, color: t.bg2, background: t.ink, borderRadius: 999, padding: "9px 15px" } }, "＋ 新增站点")),
    h("div", { style: { display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 10 } }, store.profiles.map(p =>
      h("div", { key: p.id, onClick: () => { switchSite(p.id); setEditing(true); }, className: "active:opacity-75", style: { minHeight: 120, padding: "13px", borderRadius: 18, cursor: "pointer", background: t.bg2, border: "1px solid " + t.line, display: "flex", flexDirection: "column", boxShadow: "0 7px 18px rgba(60,50,40,.05)" } },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15, color: t.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, (p.enabled && p.baseUrl && p.apiKey ? "● " : "○ ") + (p.name || "未命名")),
        h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, p.model || "还没选择模型"),
        h("div", { className: "flex", style: { gap: 9, marginTop: "auto", paddingTop: 9 } },
          h("button", { onClick: e => { e.stopPropagation(); switchSite(p.id); setEditing(true); }, style: { fontFamily: F_BODY, fontSize: 11, color: t.ink } }, "编辑"),
          h("button", { onClick: e => { e.stopPropagation(); addSite(true, p); }, style: { fontFamily: F_BODY, fontSize: 11, color: t.sub } }, "复制副本"),
          store.profiles.length > 1 ? h("button", { onClick: e => { e.stopPropagation(); removeSite(p.id); }, style: { marginLeft: "auto", fontFamily: F_BODY, fontSize: 11, color: "#b55b51" } }, "删除") : null)))));
  return h("div", { className: "pt-8 mt-6", style: { borderTop: "1px dashed " + t.line } },
    h("button", { onClick: () => setEditing(false), className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 12.5, color: t.sub, marginBottom: 12 } }, "← 返回图像站点"),
    h("div", { className: "flex items-center justify-between py-2" },
      h("div", { style: { paddingRight: 12 } },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: t.ink } }, "图像 API · 角色照片"),
        h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, lineHeight: 1.5, color: t.fog, marginTop: 2 } }, "接一个 OpenAI 兼容的图像接口（gpt-image 类）。开了之后，给角色填了『外貌/参考照』的，聊天里会偶尔发照片（自拍／别人拍的／和你的合照）。想要合照，还要在「我的面具」里填你自己的外貌或传参考照。按张计费、比文字贵，别乱开；生成的图只存在本机、不进云同步。")),
      h(Toggle, { on: c.enabled === true, onChange: v => { set({ enabled: v }); toast && toast(v ? "已开启角色自拍（按张计费）" : "已关闭"); } })),
    false && h("div", { style: { marginTop: 12, padding: "13px 12px", borderRadius: 18, background: t.bg2, border: "1px solid " + t.line } },
      h("div", { className: "flex items-center justify-between", style: { gap: 8, marginBottom: 8 } },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: t.ink } }, "图像站点"),
        h("div", { className: "flex", style: { gap: 6 } },
          h("button", { onClick: () => addSite(false), className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 11.5, color: t.sub, padding: "5px 8px", border: "1px solid " + t.line, borderRadius: 8 } }, "＋新增"),
          h("button", { onClick: () => addSite(true, c), className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 11.5, color: t.sub, padding: "5px 8px", border: "1px solid " + t.line, borderRadius: 8 } }, "复制当前"))),
      h("div", { style: { display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 9, marginBottom: 10 } }, store.profiles.map(p => {
        const selected = p.id === store.activeId;
        return h("div", { key: p.id, onClick: () => switchSite(p.id), className: "active:opacity-75", style: { minHeight: 112, padding: "12px", borderRadius: 15, cursor: "pointer", background: t.bg, border: "1.5px solid " + (selected ? t.ink : t.line), display: "flex", flexDirection: "column" } },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14.5, color: t.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, (p.enabled && p.baseUrl && p.apiKey ? "● " : "○ ") + (p.name || "未命名")),
          h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, p.model || "还没选模型"),
          h("div", { className: "flex", style: { gap: 10, marginTop: "auto", paddingTop: 8 } },
            h("button", { onClick: e => { e.stopPropagation(); switchSite(p.id); }, style: { fontFamily: F_BODY, fontSize: 11, color: t.sub } }, selected ? "编辑中" : "编辑"),
            h("button", { onClick: e => { e.stopPropagation(); addSite(true, p); }, style: { fontFamily: F_BODY, fontSize: 11, color: t.sub } }, "复制副本"),
            store.profiles.length > 1 ? h("button", { onClick: e => { e.stopPropagation(); removeSite(p.id); }, style: { marginLeft: "auto", fontFamily: F_BODY, fontSize: 11, color: "#b55b51" } }, "删除") : null));
      })),
      h("div", { className: "flex items-center", style: { gap: 7, marginTop: 9 } },
        h("input", { value: c.name || "", onChange: e => set({ name: e.target.value }), placeholder: "站点名称", style: Object.assign({}, inSt, { flex: 1, padding: "7px 10px", fontSize: 12.5 }) }),
        h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog } }, "当前卡片名称"))),
    row("站点名称", h("input", { value: c.name || "", onChange: e => set({ name: e.target.value }), placeholder: "给这个图像站起个名字", style: inSt })),
    c.enabled ? h("div", { className: "pt-3" },
      row("接口地址 Base URL", h("input", { value: c.baseUrl || "", onChange: e => set({ baseUrl: e.target.value }), placeholder: "如 https://xxx.com（会自动补 /v1/images）", style: inSt })),
      row("密钥 API Key", h("input", { value: c.apiKey || "", onChange: e => set({ apiKey: e.target.value }), placeholder: "sk-…", type: "password", style: inSt })),
      row("模型", h("div", null,
        h("div", { className: "flex gap-2" },
          h("input", { value: c.model || "", onChange: e => set({ model: e.target.value }), placeholder: "gpt-image-2", style: Object.assign({}, inSt, { flex: 1 }) }),
          h("button", { onClick: pull, disabled: fetching, className: "shrink-0 active:opacity-70 disabled:opacity-50", style: { fontFamily: F_BODY, fontSize: 12.5, color: t.ink, background: t.bg2, border: "1px solid " + t.line, borderRadius: 10, padding: "0 14px" } }, fetching ? "拉取中…" : "拉取模型")),
        models.length > 0 ? h("div", { className: "flex flex-wrap gap-1.5", style: { marginTop: 8, maxHeight: 118, overflowY: "auto" } }, models.map(m => h("button", { key: m, onClick: () => set({ model: m }), className: "active:opacity-70", style: { fontFamily: F_BODY, fontSize: 11.5, padding: "4px 10px", borderRadius: 999, background: c.model === m ? t.ink : t.bg2, color: c.model === m ? t.bg2 : t.sub, border: "1px solid " + t.line } }, m))) : null,
        h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 6, lineHeight: 1.5 } }, "官方 OpenAI 接口默认使用 gpt-image-2；若接的是中转站，仍以『拉取模型』实际返回的名字为准。"))),
      h("div", { className: "flex gap-3" },
        h("div", { className: "flex-1" }, row("尺寸", h("select", { value: c.size || "1024x1536", onChange: e => set({ size: e.target.value }), style: Object.assign({}, inSt, { appearance: "none", WebkitAppearance: "none" }) },
          h("option", { value: "1024x1536" }, "竖 1024×1536（自拍推荐）"),
          h("option", { value: "1024x1024" }, "方 1024×1024"),
          h("option", { value: "1536x1024" }, "横 1536×1024")))),
        h("div", { className: "flex-1" }, row("质量", h("select", { value: c.quality || "medium", onChange: e => set({ quality: e.target.value }), style: Object.assign({}, inSt, { appearance: "none", WebkitAppearance: "none" }) },
          h("option", { value: "low" }, "low（最省）"),
          h("option", { value: "medium" }, "medium"),
          h("option", { value: "high" }, "high（最贵）"))))),
      row("参考图上传字段（每个站单独保存）", h("select", { value: c.refFieldMode || "auto", onChange: e => set({ refFieldMode: e.target.value }), style: Object.assign({}, inSt, { appearance: "none", WebkitAppearance: "none" }) },
        h("option", { value: "auto" }, "自动（单图 image，多图 image[]）"),
        h("option", { value: "first" }, "image（多数旧中转）"),
        h("option", { value: "bracket" }, "image[]（官方/部分新中转）"),
        h("option", { value: "repeat" }, "重复 image（多图兼容）"))),
      h("div", { className: "flex items-center justify-between", style: { marginTop: 10, padding: "9px 12px", borderRadius: 10, background: t.bg2, border: "1px dashed " + t.line } },
        h("div", { style: { paddingRight: 10 } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.ink } }, "经典直通模式（已是默认管线）"),
          h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, lineHeight: 1.5, marginTop: 2 } }, "8/22 实验拍板：经典管线已转正为默认（老 prompt＋老请求形状＋酒烟措辞软化兜底），此开关现仅作纪念/排障，无需再开。")),
        h(Toggle, { on: c.classicMode === true, onChange: v => { set({ classicMode: v }); toast && toast(v ? "已切经典直通（出图完全按出事前的老样子）" : "已回新管线"); } })),
      h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginTop: 4, lineHeight: 1.5 } }, "填好后，去某个角色的档案里写『外貌』或传参考照，再在聊天里让 TA『拍张自拍』试试。有参考照时会走 images/edits 并强制 high input fidelity；接口成功只代表它接收了高保真参考请求，最终是不是同一个人仍要看测试图确认。"),
      h("label", { className: "block mt-4", style: { fontFamily: F_BODY, fontSize: 12, color: t.ink, padding: "10px 12px", border: "1px dashed " + t.line, borderRadius: 10, cursor: "pointer" } },
        testRef ? "✓ 已选测试参考脸（点这里更换）" : "可选：上传一张脸，测试高保真参考能力",
        h("input", { type: "file", accept: "image/*", style: { display: "none" }, onChange: e => { const f = e.target.files && e.target.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => { setTestRef(String(rd.result || "")); setTestRes(null); }; rd.readAsDataURL(f); } })),
      // 诊断按钮：真拍一张测试图
      h("button", { onClick: () => runTest(), disabled: testing, className: "w-full mt-4 active:opacity-80 disabled:opacity-50", style: { fontFamily: F_BODY, fontSize: 13, color: "#fff", background: t.tint, borderRadius: 10, padding: "11px 0" } }, testing ? "生成中…（单次探针，最多约3分钟）" : (testRef ? "🔬 单次测试参考图" : "🔬 测试纯文字出图")),
      testRes ? (testRes.ok
        ? h("div", { style: { marginTop: 12 } },
            h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: "#4f8a6a", marginBottom: 6 } }, "✅ 成功出图。" + (testRes.refs ? "参考 " + testRes.refs + " 张已上传 · 字段 " + (testRes.field || testRes.mode) + " · " + (testRes.bytes ? Math.round(testRes.bytes / 1024) + " KB · " : "") + "input fidelity: " + (testRes.fidelity || "default") : "纯文字出图可用（这不代表参考图能力可用）")),
            testRes.refs ? h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, lineHeight: 1.55, color: "#a06b2f", marginBottom: 8 } }, "⚠️ 这是单次参考能力探针，不会自动换字段或提示词重打。左＝参考，右＝生成；若接口说没收到图，请只切换上面的 image / image[] 后再试一次。若已收到图但脸差很多，才说明该线路或模型的参考保真较弱。") : null,
            testRes.refs && testRef ? h("div", { className: "flex", style: { gap: 8 } },
              h("div", { style: { flex: 1 } }, h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginBottom: 3 } }, "参考原图"), h("img", { src: testRef, style: { width: "100%", borderRadius: 12, display: "block" } })),
              h("div", { style: { flex: 1 } }, h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginBottom: 3 } }, "线路生成"), h("img", { src: testRes.src, style: { width: "100%", borderRadius: 12, display: "block" } })))
            : h("img", { src: testRes.src, style: { width: "100%", maxWidth: 220, borderRadius: 12, display: "block" } }))
        : h("div", { style: { marginTop: 12, padding: "12px 13px", background: "rgba(194,90,74,0.08)", border: "1px solid rgba(194,90,74,0.3)", borderRadius: 10 } },
            h("div", { style: { fontFamily: F_BODY, fontSize: 12, fontWeight: 700, color: "#c25a4a", marginBottom: 6 } }, "❌ 没出图。接口/报错原文（可长按复制、截图发我）："),
            h("div", { style: { fontFamily: "monospace", fontSize: 11, lineHeight: 1.6, color: t.ink, wordBreak: "break-all", userSelect: "text", WebkitUserSelect: "text", maxHeight: 200, overflowY: "auto" } }, testRes.err),
            testRes.missingRef ? h("div", { style: { marginTop: 10, paddingTop: 9, borderTop: "1px dashed rgba(194,90,74,0.3)" } },
              h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, lineHeight: 1.55, color: "#a05f35", marginBottom: 8 } }, "这不是锁脸差：接口根本没接住参考图。已为当前站切到「" + (testRes.switchedField === "bracket" ? "image[]" : "image") + "」并保存；请只再测一次。"),
              h("button", { onClick: () => runTest(), disabled: testing, className: "w-full active:opacity-80 disabled:opacity-50", style: { fontFamily: F_BODY, fontSize: 12.5, color: "#fff", background: "#b86a56", borderRadius: 9, padding: "9px 0" } }, testing ? "测试中…" : "换字段后再测一次"))
            : testRes.timedOut ? h("div", { style: { marginTop: 10, paddingTop: 9, borderTop: "1px dashed rgba(194,90,74,0.3)" } },
              h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, lineHeight: 1.55, color: "#a05f35", marginBottom: 8 } }, "这次是线路三分钟仍未完成，不代表参考图字段错误。可以原字段重试；也可以只换一次 image / image[]，排除该站字段兼容问题。"),
              h("div", { className: "flex", style: { gap: 8 } },
                h("button", { onClick: () => runTest(), disabled: testing, className: "flex-1 active:opacity-80 disabled:opacity-50", style: { fontFamily: F_BODY, fontSize: 12, color: "#fff", background: "#b86a56", borderRadius: 9, padding: "9px 6px" } }, testing ? "测试中…" : "原字段再试"),
                h("button", { onClick: () => runTest(c.refFieldMode === "bracket" ? "first" : "bracket"), disabled: testing, className: "flex-1 active:opacity-80 disabled:opacity-50", style: { fontFamily: F_BODY, fontSize: 12, color: "#a05f35", background: "rgba(255,255,255,.45)", border: "1px solid rgba(194,90,74,.35)", borderRadius: 9, padding: "9px 6px" } }, testing ? "测试中…" : (c.refFieldMode === "bracket" ? "换 image 再试" : "换 image[] 再试")))) : null)) : null) : null);
}
// 独立 embedding API 配置：聊天模型和向量记忆分家。聊天那家（如 gemini 中转）没 embedding 渠道时，
// 这里另填一家支持 OpenAI 兼容 /v1/embeddings 的 key，只管向量记忆，不影响聊天。
function EmbedApiConfig({ toast }) {
  const t = useTheme();
  const [c, setC] = useState(() => (typeof loadEmbApi === "function" ? loadEmbApi() : { baseUrl: "", apiKey: "", model: "text-embedding-3-small", enabled: false }));
  const set = patch => { const n = Object.assign({}, c, patch); setC(n); if (typeof saveEmbApi === "function") saveEmbApi(n); };
  const [models, setModels] = useState([]);
  const [fetching, setFetching] = useState(false);
  const [test, setTest] = useState(null);
  const pull = async () => {
    if (!c.baseUrl || !c.apiKey) { toast && toast("先填接口地址和密钥"); return; }
    setFetching(true);
    try { const ms = await fetchModelList(c); setModels(ms || []); toast && toast((ms || []).length + " 个模型（挑含 embedding/embed/bge 的）"); }
    catch (e) { toast && toast("拉取失败：" + (e.message || e)); }
    finally { setFetching(false); }
  };
  const runTest = async () => {
    if (typeof testEmbedding !== "function") { toast && toast("模块没加载"); return; }
    if (!c.baseUrl || !c.apiKey) { toast && toast("先填接口地址和密钥"); return; }
    setTest({ busy: true });
    try { const r = await testEmbedding({ baseUrl: c.baseUrl, apiKey: c.apiKey, embedModel: c.model }); setTest(r); }
    catch (e) { setTest({ ok: false, msg: String((e && e.message) || e) }); }
  };
  // 建向量索引：给记忆库里「还没向量/文本改过/换过模型」的条目补嵌（哈希+模型名比对自动识别，天然断点续建）。
  // 平时不用点——新记忆入库和开机都会自动补嵌；这个按钮是首次开通/换设备导入存档后立刻建全用的
  const [rebuild, setRebuild] = useState(null); // {busy,done,total,msg}
  const runRebuild = async () => {
    if (typeof ensureMemVecs !== "function") { toast && toast("模块没加载"); return; }
    // 必须走 loadJSON：x_memLib 早就搬进 IDB 文字仓了（IDB_TEXT_PREFIXES），localStorage 里那份
    // 迁移成功后是被删掉的。直接 localStorage.getItem 读出来永远是 null，于是记忆库满满当当，
    // 这个按钮却一口咬定「记忆库是空的」。（她 2026-08-26 截图；loadJSON 内部有 localStorage 兜底。）
    let lib = [];
    try { lib = loadJSON("x_memLib", []); } catch (e) {}
    if (!Array.isArray(lib) || !lib.length) { toast && toast("记忆库是空的，没什么可嵌"); return; }
    setRebuild({ busy: true, done: 0, total: 0 });
    try {
      const n = await ensureMemVecs(lib, { onProgress: (done, total) => setRebuild({ busy: true, done, total }) });
      // v48.29 顺手把世界书词条的向量也建了（带关键词的词条语义补捞用）
      let loreN = 0;
      try { const loreLib = loadJSON("x_loreEntries", []); if (typeof ensureLoreVecs === "function" && Array.isArray(loreLib) && loreLib.length) loreN = await ensureLoreVecs(loreLib); } catch (e) {}
      const loreMsg = loreN > 0 ? "世界书也新嵌了 " + loreN + " 条词条。" : "";
      setRebuild({ busy: false, msg: n > 0 ? ("✅ 建好了：这次新嵌 " + n + " 条，记忆库共 " + lib.length + " 条全部就绪。" + loreMsg + "之后新记忆/词条入库会自动补嵌，不用再点。") : ("✅ 索引已是最新：" + lib.length + " 条记忆全都有向量。" + loreMsg) });
    } catch (e) { setRebuild({ busy: false, msg: "❌ 建到一半断了：" + String((e && e.message) || e) + "\n已嵌好的不白费，再点一次会从缺的地方继续。" }); }
  };
  const inSt = { width: "100%", outline: "none", padding: "9px 12px", borderRadius: 10, fontFamily: F_BODY, fontSize: 13.5, background: t.bg2, color: t.ink, border: "1px solid " + t.line };
  const row = (label, node) => h("div", { className: "mb-3" }, h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, marginBottom: 4 } }, label), node);
  return h("div", { className: "pt-8 mt-6", style: { borderTop: "1px dashed " + t.line } },
    h("div", { className: "flex items-center justify-between py-2" },
      h("div", { style: { paddingRight: 12 } },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: t.ink } }, "向量记忆 API · Embedding"),
        h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, lineHeight: 1.5, color: t.fog, marginTop: 2 } }, "和聊天模型【分开】填。你聊天那家（gemini 中转）没有 embedding 渠道——在这另填一个支持 OpenAI 兼容 /v1/embeddings 的 key，专门跑向量记忆。开着它，聊天时挑记忆会按【语义相似度】来——「上次吃的那顿」也能想起「火锅之约」，换了说法照样认得；关了或没网就自动回落关键词检索，聊天绝不受影响。")),
      h(Toggle, { on: c.enabled === true, onChange: v => { set({ enabled: v }); toast && toast(v ? "已开启独立向量 API" : "已关闭"); } })),
    c.enabled ? h("div", { className: "pt-3" },
      row("接口地址 Base URL", h("input", { value: c.baseUrl || "", onChange: e => set({ baseUrl: e.target.value }), placeholder: "如 https://xxx.com（会自动补 /v1/embeddings）", style: inSt })),
      row("密钥 API Key", h("input", { value: c.apiKey || "", onChange: e => set({ apiKey: e.target.value }), placeholder: "sk-…", type: "password", style: inSt })),
      row("模型", h("div", null,
        h("div", { className: "flex gap-2" },
          h("input", { value: c.model || "", onChange: e => set({ model: e.target.value }), placeholder: "text-embedding-3-small", style: Object.assign({}, inSt, { flex: 1 }) }),
          h("button", { onClick: pull, disabled: fetching, className: "shrink-0 active:opacity-70 disabled:opacity-50", style: { fontFamily: F_BODY, fontSize: 12.5, color: t.ink, background: t.bg2, border: "1px solid " + t.line, borderRadius: 10, padding: "0 14px" } }, fetching ? "拉取中…" : "拉取模型")),
        models.length > 0 ? h("div", { className: "flex flex-wrap gap-1.5", style: { marginTop: 8, maxHeight: 118, overflowY: "auto" } }, models.map(m => h("button", { key: m, onClick: () => set({ model: m }), className: "active:opacity-70", style: { fontFamily: F_BODY, fontSize: 11.5, padding: "4px 10px", borderRadius: 999, background: c.model === m ? t.ink : t.bg2, color: c.model === m ? t.bg2 : t.sub, border: "1px solid " + t.line } }, m))) : null,
        h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 6, lineHeight: 1.5 } }, "填一个【embedding】模型名（名字通常含 embedding / embed / bge）。常见能用的：text-embedding-3-small（便宜够用）、text-embedding-3-large、bge-m3。"))),
      h("button", { onClick: runTest, disabled: test && test.busy, className: "w-full mt-2 active:opacity-80 disabled:opacity-50", style: { fontFamily: F_BODY, fontSize: 13, color: "#fff", background: t.tint, borderRadius: 10, padding: "11px 0" } }, test && test.busy ? "检测中…" : "🔬 测一下这个 embedding 接口"),
      test && !test.busy ? h("div", { style: { fontFamily: F_BODY, fontSize: 12, lineHeight: 1.6, whiteSpace: "pre-wrap", padding: "10px 12px", borderRadius: 10, marginTop: 10, background: test.ok ? "rgba(90,150,90,0.1)" : "rgba(194,90,74,0.09)", border: "1px solid " + (test.ok ? "#8ab88a55" : "#c25a4a55"), color: test.ok ? "#4a7a4a" : "#b0503f" } },
        test.ok ? ("✅ 通了！模型「" + test.model + "」，向量维度 " + test.dim + "。向量记忆的接口这边就绪了。") : ("❌ 没测通：\n" + (test.msg || "未知"))) : null,
      h("button", { onClick: runRebuild, disabled: rebuild && rebuild.busy, className: "w-full mt-3 active:opacity-80 disabled:opacity-50", style: { fontFamily: F_BODY, fontSize: 13, color: t.ink, background: t.bg2, border: "1px solid " + t.line, borderRadius: 10, padding: "11px 0" } },
        rebuild && rebuild.busy ? ("🔨 建索引中… " + (rebuild.total ? rebuild.done + " / " + rebuild.total : "统计中")) : "🔨 立刻建全向量索引"),
      h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 6, lineHeight: 1.5 } }, "给记忆库里还没向量的条目补嵌。平时不用管——新记忆入库、每次开机都会自动补；首次开通或换设备导入存档后想立刻生效就点它。向量只存在本机图库（IndexedDB），不进云存档，换设备会自动重建。"),
      rebuild && !rebuild.busy && rebuild.msg ? h("div", { style: { fontFamily: F_BODY, fontSize: 12, lineHeight: 1.6, whiteSpace: "pre-wrap", padding: "10px 12px", borderRadius: 10, marginTop: 8, background: rebuild.msg.startsWith("✅") ? "rgba(90,150,90,0.1)" : "rgba(194,90,74,0.09)", border: "1px solid " + (rebuild.msg.startsWith("✅") ? "#8ab88a55" : "#c25a4a55"), color: rebuild.msg.startsWith("✅") ? "#4a7a4a" : "#b0503f" } }, rebuild.msg) : null) : null);
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
      h("span", { style: { fontFamily: F_BODY, fontSize: 12, color: t.sub } }, "🔬 召回冷却（P0-2 · 4轮）"),
      h("span", { style: { fontFamily: F_BODY, fontSize: 13, color: t.fog } }, folded ? "▸" : "▾")),
    folded ? null : (rep ? h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.sub, lineHeight: 1.9, marginTop: 6 } },
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
          "🪡 纠错留环：" + more.correction.pairs + " 组包含配对 · 旧规则本会硬删 " + more.correction.currentWouldPrune) : null,
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
          h("button", { onClick: load, style: { fontFamily: F_BODY, fontSize: 11, color: t.tint } }, "刷新"),
          h("button", { onClick: () => { window.RecallShadow.setLiveEnabled(!rep.liveEnabled); load(); }, style: { fontFamily: F_BODY, fontSize: 11, color: rep.liveEnabled ? "#9f5149" : t.tint } }, rep.liveEnabled ? "关闭4轮冷却（立即回滚）" : "重新开启4轮冷却"),
          h("button", { onClick: () => { window.RecallShadow.setTieEnabled(!rep.tieEnabled); load(); }, style: { fontFamily: F_BODY, fontSize: 11, color: rep.tieEnabled ? "#9f5149" : t.tint } }, rep.tieEnabled ? "关闭同分换序" : "开启同分换序"),
          h("button", { onClick: () => { window.RecallShadow.setEnabled(!rep.enabled); load(); }, style: { fontFamily: F_BODY, fontSize: 11, color: rep.enabled ? "#9f5149" : t.tint } }, rep.enabled ? "暂停观测" : "恢复观测（当前已停·零写入）"),
          h("button", { onClick: () => requestAppConfirm("清空召回与抽取质量旁路诊断？", "不影响任何记忆数据。", () => { Promise.all([window.RecallShadow.clearAll(), window.MemoryQualityShadow ? window.MemoryQualityShadow.clearAll() : null, window.MemoryCorrectionShadow ? window.MemoryCorrectionShadow.clearAll() : null]).then(load); }, "清空"), style: { fontFamily: F_BODY, fontSize: 11, color: t.fog } }, "清空")))) :
      h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginTop: 6 } }, "读取中…")));
}

function CtxDebug({ characters, getBundle, lockedCharId, compact }) {
  const t = useTheme();
  const initialCid = lockedCharId || null;
  const readBundle = id => String((getBundle && getBundle(id)) || "（空）");
  const readRecall = id => typeof window !== "undefined" && window.MemoryRecallSnapshot ? window.MemoryRecallSnapshot.get(id) : null;
  const [cid, setCid] = useState(initialCid);
  const [text, setText] = useState(() => initialCid ? readBundle(initialCid) : "");
  const [recall, setRecall] = useState(() => initialCid ? readRecall(initialCid) : null);
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
  h("div", { style: { marginTop: 4, fontFamily: "monospace", fontSize: 9.5, color: t.fog, lineHeight: 1.55 } },
    recallLaneLabel(row.recallKind) + (row.pinned ? "" : " · " + (row.vectorScored ? "向量参与打分" : "关键词打分") + " · 总分 " + row.score) + (row.tags && row.tags.length ? " · " + row.tags.join(" / ") : "")),
  row.scoreParts ? h("div", { style: { marginTop: 3, fontFamily: "monospace", fontSize: 9.5, color: t.fog, lineHeight: 1.55 } }, recallPartsText(row)) : null);
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
    h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, lineHeight: 1.7, marginBottom: 10 } }, compact ? "刚聊完就来这里看：上面是上一轮真正选中的记忆，下面是此刻重建的完整提示词预览。" : "看看此刻和 TA 聊天时，到底喂了什么给模型（人设 / 记忆 / 世界书 / 行程…按段拆开）。角色变笨、OOC、忘事时来这里排查是哪一段出了问题。"),
    !compact ? h("div", { style: { border: "1px dashed " + t.line, borderRadius: 12, padding: "10px 12px", marginBottom: 12, background: t.bg2 } },
      h("div", { className: "flex items-center justify-between gap-2" },
        h("div", null,
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 13, color: t.ink } }, "线下 wire payload · 仅本机内存"),
          h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 2 } }, "抓取 fetch 前最终 body；不含密钥，图片会省略。刷新 App 即清空。")),
        h("button", { onClick: toggleWire, style: { fontFamily: F_BODY, fontSize: 11.5, padding: "6px 10px", borderRadius: 999, background: wireOn ? t.tint : "transparent", color: wireOn ? "#fff" : t.sub, border: "1px solid " + (wireOn ? t.tint : t.line) } }, wireOn ? "抓取中" : "开始抓取")),
      h("div", { className: "flex gap-3", style: { marginTop: 8 } },
        h("button", { onClick: refreshWire, style: { fontFamily: F_BODY, fontSize: 11, color: t.tint } }, "刷新记录"),
        h("button", { onClick: clearWire, style: { fontFamily: F_BODY, fontSize: 11, color: t.fog } }, "清空")),
      wireRows.length >= 2 ? h("details", { style: { marginTop: 8, padding: "7px 8px", borderRadius: 8, background: t.bg } },
        h("summary", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.ink, cursor: "pointer" } }, "最近两次最终 body：" + wireDiff.length + " 个字段差异"),
        h("div", { style: { marginTop: 6, maxHeight: 240, overflow: "auto", fontFamily: "monospace", fontSize: 9.5, lineHeight: 1.55, color: t.sub } },
          wireDiff.length ? wireDiff.slice(0, 120).map((d, i) => h("div", { key: i, style: { padding: "4px 0", borderTop: i ? "1px solid " + t.line : "none" } },
            h("div", { style: { color: t.tint } }, d.path),
            d.lines ? h("div", { style: { marginTop: 3 } },
              d.lines.length ? d.lines.slice(0, 160).map((x, n) => h("div", { key: n, style: { color: x.op === "+" ? "#4a7a4a" : "#b0503f", whiteSpace: "pre-wrap" } }, x.op + " " + (x.text || "（空行）"))) : h("div", null, "仅行内字符变化"))
            : h(React.Fragment, null,
              h("div", null, "A: " + String(d.before).slice(0, 500)),
              h("div", null, "B: " + String(d.after).slice(0, 500))))) : h("div", null, "最终 body 完全一致"))) : null,
      wireRows.length ? h("div", { style: { marginTop: 8 } },
        wireRows.slice().reverse().map((r, i) => h("details", { key: r.id, style: { marginTop: 6, borderTop: i ? "1px solid " + t.line : "none", paddingTop: i ? 6 : 0 } },
          h("summary", { style: { fontFamily: "monospace", fontSize: 10.5, color: t.sub, cursor: "pointer" } },
            new Date(r.ts).toLocaleTimeString() + " · " + r.format + " · " + (r.meta && r.meta.transitionBefore) + "→" + (r.meta && r.meta.transitionAfter) + " · calibration=" + !!(r.meta && r.meta.calibrationInjected)),
          h("pre", { style: { marginTop: 6, padding: 8, borderRadius: 8, background: t.bg, maxHeight: 280, overflow: "auto", whiteSpace: "pre-wrap", wordBreak: "break-all", fontFamily: "monospace", fontSize: 9.5, lineHeight: 1.55, color: t.sub } }, JSON.stringify(r, null, 2)))))
      : h("div", { style: { marginTop: 8, fontFamily: F_BODY, fontSize: 10.5, color: t.fog } }, "暂无记录。开启后正常生成线下回复，再回来点“刷新记录”。")) : null,
    !compact ? h(RecallShadowPanel, null) : null,
    !lockedCharId ? h("div", { className: "flex gap-2 flex-wrap", style: { marginBottom: 10 } }, (characters || []).map(c =>
      h("button", { key: c.id, onClick: () => load(c.id), className: "active:opacity-70", style: { fontFamily: F_BODY, fontSize: 12.5, padding: "6px 13px", borderRadius: 999, background: cid === c.id ? t.ink : t.bg2, color: cid === c.id ? t.bg2 : t.ink, border: "1px solid " + (cid === c.id ? t.ink : t.line) } }, c.remark || c.name))) : null,
    cid ? h("div", { style: { border: "1px solid " + t.line, borderRadius: 14, padding: "11px 12px", marginBottom: 10, background: t.bg2 } },
      h("div", { className: "flex items-start justify-between gap-2" },
        h("div", null,
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14, color: t.ink } }, "上一轮真实召回"),
          h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, lineHeight: 1.55, marginTop: 2 } }, "只认上一轮聊天实际送进模型的选集；刷新 App 即清空。下面的上下文段落只是此刻预览。")),
        recall ? h("span", { style: { flexShrink: 0, borderRadius: 999, padding: "3px 7px", fontFamily: F_BODY, fontSize: 9.5, color: recall.mode === "hybrid" ? t.tint : t.fog, border: "1px solid " + (recall.mode === "hybrid" ? t.tint : t.line) } }, recall.mode === "hybrid" ? "向量混合" : "关键词") : null),
      recall ? h(React.Fragment, null,
        h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 8 } },
          new Date(recall.ts).toLocaleString() + " · 可见候选 " + recall.candidateCount + " 条 · 最终 " + (recall.picked || []).length + " 条" + (recall.hiddenCount ? " · 权限隔离 " + recall.hiddenCount + " 条" : "") + (recall.model ? " · " + recall.model : "")),
        (recall.picked || []).length
          ? h("div", { style: { marginTop: 7 } }, recall.picked.map((row, i) => recallRowView(row, i, false)))
          : h("div", { style: { marginTop: 8, fontFamily: F_BODY, fontSize: 11, color: t.fog } }, "这一轮实际没有召回任何记忆。"),
        (recall.excluded || []).length ? h("details", { style: { marginTop: 9, borderTop: "1px dashed " + t.line, paddingTop: 8 } },
          h("summary", { style: { cursor: "pointer", fontFamily: F_BODY, fontSize: 11, color: t.sub, lineHeight: 1.6 } },
            "查看没进来的候选 · " + Object.entries(recall.excludedCounts || {}).map(([reason, count]) => recallReasonLabel(reason) + " " + count).join(" / ")),
          h("div", { style: { marginTop: 5 } }, (recall.excluded || []).map((row, i) => recallRowView(row, i, true)))) : null)
      : h("div", { style: { marginTop: 8, fontFamily: F_BODY, fontSize: 11, color: t.fog, lineHeight: 1.6 } }, "还没有这一页生命周期内的真实聊天收据。先和 TA 发一轮消息，再回来刷新。")) : null,
    cid ? (() => {
      // 每段占比 + 肥度条（v47.84 她要的「谁肥一眼看穿」）：≥20% 红、≥10% 金、其余灰
      const total = Math.max(1, text.length);
      const pctOf = s => Math.round(s.body.length / total * 100);
      const top3 = secs.slice().sort((a, b) => b.body.length - a.body.length).slice(0, 3).filter(s => s.body.length > 0);
      const barColor = p => p >= 20 ? "#c25a4a" : p >= 10 ? "#b89150" : t.line;
      return h("div", null,
        h("div", { className: "flex items-center justify-between", style: { marginBottom: 6 } },
          h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog } }, secs.length + " 段 · 共 " + text.length + " 字 · 点标题展开"),
          h("button", { onClick: () => load(cid), className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 12, color: t.tint } }, "刷新")),
        top3.length ? h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.sub, lineHeight: 1.7, background: t.bg2, border: "1px solid " + t.line, borderRadius: 10, padding: "7px 11px", marginBottom: 10 } },
          "最肥三段：" + top3.map(s => s.title.replace(/[【】]/g, "") + " " + pctOf(s) + "%").join(" · ") + "——变笨先查它们") : null,
        secs.map((s, i) => {
          const pct = pctOf(s);
          return h("div", { key: i, style: { border: "1px solid " + t.line, borderRadius: 12, marginBottom: 8, overflow: "hidden" } },
            h("button", { onClick: () => setOpen(o => ({ ...o, [i]: !o[i] })), className: "w-full active:opacity-70", style: { padding: "9px 12px 7px", background: t.bg2, textAlign: "left", display: "block" } },
              h("div", { className: "flex items-center justify-between gap-2" },
                h("span", { style: { fontFamily: F_DISPLAY, fontSize: 13, color: t.ink, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } },
                  s.title, s.inner ? h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginLeft: 7 } }, "含 " + s.inner + " 段") : null),
                h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: pct >= 20 ? "#c25a4a" : t.fog, flexShrink: 0 } }, s.body.length + " 字 · " + pct + "% " + (open[i] ? "▾" : "▸"))),
              h("div", { style: { height: 3, borderRadius: 999, background: t.bg, marginTop: 6, overflow: "hidden" } },
                h("div", { style: { height: "100%", width: Math.max(2, pct) + "%", borderRadius: 999, background: barColor(pct) } }))),
            open[i] ? h("div", { style: { padding: "10px 12px", fontFamily: "monospace", fontSize: 11, lineHeight: 1.7, color: t.sub, whiteSpace: "pre-wrap", wordBreak: "break-all", maxHeight: 300, overflowY: "auto", background: t.bg } }, s.body) : null);
        }));
    })() : null));
}
function ConfigFold({ title, sub, open, onToggle, children, danger }) {
  const t = useTheme();
  return h("section", { style: { borderBottom: "1px solid " + t.line } },
    h("button", {
      onClick: onToggle,
      className: "w-full active:opacity-60",
      style: { padding: "15px 2px", textAlign: "left" }
    },
      h("div", { className: "flex items-center justify-between", style: { gap: 12 } },
        h("div", { style: { minWidth: 0 } },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: danger ? t.accent : t.ink } }, title),
          sub ? h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 3, lineHeight: 1.45 } }, sub) : null),
        h("span", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, flexShrink: 0 } }, open ? "收起 －" : "展开 ＋"))),
    open ? h("div", { style: { paddingBottom: 18 } }, children) : null);
}

function ConfigTile({ icon, title, sub, onClick, wide }) {
  const t = useTheme();
  return h("button", { onClick, className: "active:opacity-70", style: {
    gridColumn: wide ? "1 / -1" : "auto", minHeight: wide ? 108 : 144, padding: "18px 17px",
    borderRadius: 22, textAlign: "left", background: t.bg2, border: "1px solid " + t.line,
    boxShadow: "0 9px 24px rgba(60,50,40,.055)", display: "flex", flexDirection: "column", justifyContent: "space-between"
  } },
    h("div", null,
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: 18, color: t.ink } }, title),
      h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, lineHeight: 1.55, marginTop: 5 } }, sub)),
    h("div", { className: "flex items-end justify-between", style: { marginTop: 14 } },
      h("span", { style: { fontSize: 27, lineHeight: 1 } }, icon || "·"),
      h("span", { style: { fontFamily: F_BODY, fontSize: 22, color: t.fog } }, "›")));
}
function ConfigTileGrid({ children }) {
  return h("div", { style: { display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 12, paddingTop: 12 } }, children);
}

function ConfigPanel({ children, flush }) {
  const t = useTheme();
  return h("div", { style: {
    marginTop: 12, marginBottom: 14, padding: flush ? 0 : "16px 15px", overflow: "hidden",
    borderRadius: 22, background: t.bg2, border: "1px solid " + t.line,
    boxShadow: "0 9px 24px rgba(60,50,40,.045)"
  } }, children);
}

function AutoRefreshConfig(props) {
  const t = useTheme();
  const policy = window.AutoRefreshPolicy.normalize(props.policy);
  const chars = props.characters || [];
  const [open, setOpen] = useState("");
  const groups = [
    { id: "content", eyebrow: "AUTO CONTENT", title: "自动内容", note: "跨天、跨周或回到 App 时补齐内容。" },
    { id: "social", eyebrow: "SOCIAL PULSE", title: "主动社交", note: "角色自己开口、发帖或留下东西。" }
  ];
  const charOn = (f, c) => window.AutoRefreshPolicy.enabled({
    version: 1,
    features: { ...policy.features, [f.id]: { ...policy.features[f.id], global: true } }
  }, f.id, c.id);
  return h("div", null,
    h("div", { style: { padding: "2px 2px 14px", fontFamily: F_BODY, fontSize: 11.5, lineHeight: 1.7, color: t.fog } },
      "总开关关掉只会暂停，不会抹掉下面每个人的选择；手动刷新、手动写日记等按钮仍可照常使用。"),
    groups.map(g => h("div", { key: g.id, style: { marginBottom: 22 } },
      h("div", { style: { padding: "0 2px 9px" } },
        h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 8, letterSpacing: ".24em", color: t.fog } }, g.eyebrow),
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 22, color: t.ink, marginTop: 5 } }, g.title),
        h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginTop: 3 } }, g.note)),
      window.AutoRefreshPolicy.FEATURES.filter(f => f.group === g.id).map(f => {
        const cfg = policy.features[f.id];
        const isOpen = open === f.id;
        const enabledCount = chars.filter(c => charOn(f, c)).length;
        return h("div", { key: f.id, style: { marginBottom: 11, borderRadius: 20, background: t.bg2, border: "1px solid " + t.line, boxShadow: "0 8px 22px rgba(60,50,40,.045)", overflow: "hidden" } },
          h("div", { className: "flex items-center justify-between", style: { padding: "15px 15px 13px", gap: 12 } },
            h("button", { onClick: () => setOpen(isOpen ? "" : f.id), className: "flex-1 text-left active:opacity-60", style: { minWidth: 0 } },
              h("div", { style: { fontFamily: F_DISPLAY, fontSize: 17, color: t.ink } }, f.title),
              h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, lineHeight: 1.5, color: t.fog, marginTop: 3 } }, f.sub),
              h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: cfg.global ? t.accent : t.fog, marginTop: 7 } },
                cfg.global ? (enabledCount + "/" + chars.length + " 人开启 · 角色范围 " + (isOpen ? "▴" : "▾")) : "总闸已暂停 · 原角色选择保留 " + (isOpen ? "▴" : "▾"))),
            h(Toggle, { on: cfg.global, onChange: on => props.onSetGlobal(f.id, on) })),
          isOpen ? h("div", { style: { borderTop: "1px solid " + t.line, padding: "5px 15px 9px" } },
            !chars.length ? h("div", { style: { padding: "12px 0", fontFamily: F_BODY, fontSize: 11, color: t.fog } }, "还没有可设置的角色") : chars.map(c => h("div", { key: c.id, className: "flex items-center justify-between", style: { minHeight: 54, borderBottom: "1px solid " + t.line + "88", gap: 10 } },
              h("div", { className: "flex items-center", style: { gap: 10, minWidth: 0 } },
                c.avatarImage ? h("img", { src: typeof resolveImg === "function" ? resolveImg(c.avatarImage) : c.avatarImage, alt: "", style: { width: 30, height: 30, borderRadius: 10, objectFit: "cover" } }) : h("div", { style: { width: 30, height: 30, borderRadius: 10, background: t.line } }),
                h("span", { style: { fontFamily: F_BODY, fontSize: 13, color: t.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, c.remark || c.name)),
              h(Toggle, { on: charOn(f, c), onChange: on => props.onSetChar(f.id, c.id, on) })))) : null);
      })))
  );
}

function LegacyConfig({
  apiProfiles,
  activeId,
  offlineApiId,
  onSetOfflineApi,
  modelFloatOn,
  onSetModelFloat,
  bgApiId,
  onSetBgApi,
  onSaveApi,
  characters,
  onAssignVoice,
  coupleQACustom,
  onSaveCustomQA,
  theme,
  onSaveTheme,
  wallpaper,
  onSaveWallpaper,
  prefs,
  onSavePrefs,
  geo,
  onRequestGeo,
  onBack,
  onExport,
  onImport,
  onOffloadChats,
  onPruneOld,
  onClearAll,
  onRescueChar,
  debugBundleFor,
  toast
}) {
  const t = useTheme();
  const [tab, setTab] = useState("api");
  const [openSection, setOpenSection] = useState("");
  const fold = (id, title, sub, child, danger) => h(ConfigFold, {
    key: id, title: title, sub: sub, danger: danger,
    open: openSection === id,
    onToggle: () => setOpenSection(v => v === id ? "" : id)
  }, child);
  // 配件 UI 隐身：在「数据」tab 上连点 7 下解锁/隐藏（x_toyUnlocked，只存本机；没人会去连点这个）
  const [toyUnlocked, setToyUnlocked] = useState(() => { try { return localStorage.getItem("x_toyUnlocked") === "1"; } catch (e) { return false; } });
  const toyKnockRef = React.useRef({ n: 0, ts: 0 });
  const toyKnock = k => {
    if (k !== "data") return;
    const now = Date.now(), kk = toyKnockRef.current;
    kk.n = (now - kk.ts < 1500) ? kk.n + 1 : 1; kk.ts = now;
    if (kk.n >= 7) { kk.n = 0; const nx = !toyUnlocked; setToyUnlocked(nx); try { localStorage.setItem("x_toyUnlocked", nx ? "1" : "0"); } catch (e) {} toast && toast(nx ? "已解锁配件" : "已隐藏配件"); }
  };
  const tabs = [["api", "API"], ["sense", "感知"], ["cot", "小稿"], ["qa", "问答"], ["theme", "主题"], ["data", "数据"]];
  return /*#__PURE__*/React.createElement("div", {
    className: "h-full flex flex-col"
  }, /*#__PURE__*/React.createElement(Head, {
    zh: "设置",
    en: "Config",
    onBack: onBack
  }), /*#__PURE__*/React.createElement("div", {
    className: "px-6 flex gap-5 shrink-0",
    style: {
      marginTop: -6
    }
  }, tabs.map(([k, l]) => /*#__PURE__*/React.createElement("button", {
    key: k,
    onClick: () => { setTab(k); setOpenSection(""); toyKnock(k); },
    className: "pb-2",
    style: {
      borderBottom: tab === k ? `2px solid ${t.ink}` : "2px solid transparent"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: F_DISPLAY,
      fontSize: 15,
      color: tab === k ? t.ink : t.fog
    }
  }, l)))), /*#__PURE__*/React.createElement("div", {
    className: "mt-3 mx-6 h-px",
    style: {
      background: t.line
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: "flex-1 overflow-y-auto px-6 pb-10"
  }, tab === "api" && h("div", null,
  fold("api-main", "聊天与后台模型", "主模型、备用线路、Embedding 与后台省钱模型", /*#__PURE__*/React.createElement(ApiConfig, {
    profiles: apiProfiles,
    activeId: activeId,
    offlineApiId: offlineApiId,
    onSetOfflineApi: onSetOfflineApi,
    modelFloatOn: modelFloatOn,
    onSetModelFloat: onSetModelFloat,
    bgApiId: bgApiId,
    onSetBgApi: onSetBgApi,
    onSave: onSaveApi,
    toast: toast
  })), fold("api-cache", "额度与缓存", "查看缓存命中和调用读数", /*#__PURE__*/React.createElement(CacheStatCard, null)), fold("api-image", "图像生成", "自拍、合照与图像模型配置", /*#__PURE__*/React.createElement(React.Fragment, null,
    /*#__PURE__*/React.createElement(ImageApiConfig, { toast: toast }),
    /*#__PURE__*/React.createElement(AvatarPoolConfig, { toast: toast })
  )), fold("api-tts", "语音 TTS", "声音接口、音色和角色分配", /*#__PURE__*/React.createElement(TtsApiConfig, {
    toast: toast,
    characters: characters,
    onAssignVoice: onAssignVoice
  })), fold("api-ears", "真声通话耳朵", "书房识别服务地址与门锁", /*#__PURE__*/React.createElement(VoiceEarsConfig, {
    toast: toast
  }))), tab === "sense" && fold("sense-main", "时间、位置与通知", "角色感知与锁屏通知", /*#__PURE__*/React.createElement(SenseConfig, {
    prefs: prefs,
    onSave: onSavePrefs,
    geo: geo,
    onRequestGeo: onRequestGeo,
    toast: toast
  })), tab === "cot" && fold("cot-main", "创作小稿设置", "检查方式、预设、模型保险与开关", /*#__PURE__*/React.createElement(CotConfig, {
    toast: toast,
    activeProfile: (apiProfiles || []).find(p => p.id === activeId) || (apiProfiles || [])[0] || null
  })), tab === "qa" && fold("qa-main", "情侣问答题库", "按角色管理自定义题目", /*#__PURE__*/React.createElement(CoupleQAConfig, {
    characters: characters,
    custom: coupleQACustom,
    onSave: onSaveCustomQA,
    toast: toast
  })), tab === "theme" && h("div", null, fold("theme-main", "外观与壁纸", "颜色、字体和主屏背景", /*#__PURE__*/React.createElement(ThemeConfig, {
    theme: theme,
    onSave: onSaveTheme,
    wallpaper: wallpaper,
    onSaveWallpaper: onSaveWallpaper
  })), fold("theme-bubble", "聊天气泡皮肤", "气泡尺寸、圆角、颜色与阴影", /*#__PURE__*/React.createElement(BubbleSkinConfig, {
    toast: toast
  }))), tab === "data" && h("div", null, /*#__PURE__*/React.createElement(DataConfig, {
    characters: characters,
    onExport: onExport,
    onImport: onImport,
    onOffloadChats: onOffloadChats,
    onPruneOld: onPruneOld,
    onClearAll: onClearAll,
    onRescueChar: onRescueChar,
    toast: toast
  }), fold("data-debug", "上下文诊断", "只读查看模型实际收到的内容", /*#__PURE__*/React.createElement(CtxDebug, {
    characters: characters,
    getBundle: debugBundleFor
  })), toyUnlocked && typeof ToyConfig === "function" && fold("data-toy", "本地配件", "仅本机的隐藏配件设置", /*#__PURE__*/React.createElement(ToyConfig, {
    toast: toast
  })))));
}

function Config(props) {
  const t = useTheme();
  const [page, setPage] = useState("home");
  const scrollRef = React.useRef(null);
  React.useEffect(() => {
    // 首页与子页共用这一只滚动容器；换页必须回页首，不能把首页的滚动位置
    // 带进子页，否则第一张设置卡会直接藏到安全区上方。
    const reset = () => {
      if (document.activeElement && typeof document.activeElement.blur === "function") document.activeElement.blur();
      if (scrollRef.current) scrollRef.current.scrollTop = 0;
    };
    reset();
    const raf = requestAnimationFrame(() => requestAnimationFrame(reset));
    const timer = setTimeout(reset, 120);
    return () => { cancelAnimationFrame(raf); clearTimeout(timer); };
  }, [page]);
  const [toyUnlocked, setToyUnlocked] = useState(() => { try { return localStorage.getItem("x_toyUnlocked") === "1"; } catch (e) { return false; } });
  const toyKnockRef = React.useRef({ n: 0, ts: 0 });
  const toyKnock = () => {
    const now = Date.now(), k = toyKnockRef.current;
    k.n = now - k.ts < 1500 ? k.n + 1 : 1; k.ts = now;
    if (k.n < 7) return;
    k.n = 0; const next = !toyUnlocked; setToyUnlocked(next);
    try { localStorage.setItem("x_toyUnlocked", next ? "1" : "0"); } catch (e) {}
    props.toast && props.toast(next ? "已解锁配件" : "已隐藏配件");
  };
  const meta = {
    home: ["设置", "Config"], api: ["接哪些模型", "API Settings"], apiText: ["文字模型", "Text Models"],
    apiImage: ["图像 API", "Image API"], apiTts: ["语音 API", "Voice API"], apiEmbed: ["向量记忆", "Embedding"],
    apiEars: ["真声耳朵", "Voice Ears"], apiCache: ["额度与缓存", "Usage"], sense: ["他们知道现在几点、我在哪", "Sense"],
    cot: ["创作小稿", "Draft"], qa: ["情侣问答", "Questions"], look: ["这个 app 长什么样", "Appearance"],
    theme: ["外观与壁纸", "Appearance"], themeStudio: ["主题工作台", "Theme Studio"],
    bubble: ["聊天气泡", "Bubble Skin"], write: ["他们写出来的东西", "Writing"],
    auto: ["谁会自己动、多久动一次", "Automation"], data: ["我的东西存在哪", "Data"],
    debug: ["上一轮到底发了什么", "Context"], toy: ["本地配件", "Accessories"]
  };
  const m = meta[page] || meta.home;
  // 回哪一层：api* 归 api，长相三兄弟归 look，小稿/问答归 write，其余回首页
  const back = page === "home" ? props.onBack : () => {
    if (/^api[A-Z]/.test(page)) return setPage("api");
    if (page === "theme" || page === "themeStudio" || page === "bubble") return setPage("look");
    if (page === "cot" || page === "qa") return setPage("write");
    setPage("home");
  };
  // ── 分类（v61.99 重排，她 2026-09-04：「设置页也还是好乱找不到东西」）──────
  // 原来十格是按【东西的名字】切的，于是：
  //   · 外观与壁纸／主题工作台／聊天气泡——【三张卡都在管长相】，想改个颜色得先猜是哪张；
  //   · 「感知」这个词说的是什么完全看不出（其实是时间、位置、锁屏通知）；
  //   · 图标又是一堆几何符号（⌘ ◉ ✎ ? ◐ ✦ ◒ ↻ ▤ ⌁），? 和 ◐/◒ 几乎分不出；
  //   · 十张 320px 高的大卡要滚一屏多，一眼扫不完——怎么分类都难找。
  // 照聊天设置那次同一套来（她已经用顺了那个形状）：按【她来找什么】切、
  // 一列窄行一屏放得下、汉字索引牌一类一个字、每行写着现在是什么状态。
  const onOff = v => v ? "开" : "关";
  const homeRows = [
    { key: "api", char: "模", title: "接哪些模型", tint: "#6693c7",
      state: () => { const n = (props.apiProfiles || []).length;
        const cur = (props.apiProfiles || []).find(x => x.id === props.activeId) || (props.apiProfiles || [])[0];
        return n ? (n + " 条线路 · 在用 " + ((cur && (cur.name || cur.model)) || "未命名")) : "还没接线路"; } },
    { key: "look", char: "样", title: "这个 app 长什么样", tint: "#9b7bc4",
      state: () => "配色、壁纸、主题工作台、聊天气泡" },
    { key: "sense", char: "知", title: "他们知道现在几点、我在哪", tint: "#687f73",
      state: () => { const p = props.prefs || {};
        return "时间 " + onOff(p.timeAware !== false) + " · 位置 " + onOff(p.geoAware)
          + " · 通知 " + onOff(window.Notify && window.Notify.isOn && window.Notify.isOn()); } },
    { key: "auto", char: "动", title: "谁会自己动、多久动一次", tint: "#c0904f",
      state: () => { const f = ((props.autoRefreshPolicy || {}).features) || {};
        const on = Object.keys(f).filter(k => f[k] && f[k].global !== false).length;
        const all = Object.keys(f).length;
        return all ? (on + " / " + all + " 项开着") : "自动内容与主动社交"; } },
    { key: "data", char: "存", title: "我的东西存在哪", tint: "#477f88",
      state: () => { const at = (function () { try { return localStorage.getItem("cloud_synced_at"); } catch (e) { return null; } })();
        return at ? "云同步开着 · 上次 " + String(at).slice(0, 10) : "备份、导出、迁移与清理"; } },
    { key: "write", char: "写", title: "他们写出来的东西", tint: "#d97c86",
      state: () => { const q = props.coupleQACustom || {};
        const n = Object.keys(q).reduce((a, k) => a + ((q[k] || []).length || 0), 0);
        return "线下小稿的写法 · 情侣问答" + (n ? " " + n + " 题" : ""); } },
    { key: "debug", char: "查", title: "上一轮到底发了什么", tint: "#8a8378",
      state: () => "只读：模型这一轮实际收到的全文" }
  ];
  if (toyUnlocked && typeof ToyConfig === "function")
    homeRows.push({ key: "toy", char: "件", title: "本地配件", tint: "#a8564a", state: () => "只在这台机器上" });
  const section = child => h("div", { style: { paddingTop: 4, paddingBottom: 30 } }, h(ConfigPanel, null, child));
  // 配件那个藏起来的开关：在设置首页【连点标题七下】。
  // ⚠️原来挂在顶栏那行英文（"Config"）上——v61.40「标题不留英文」之后
  //   Head 不再渲染纯拉丁的 en，那个 span 连同入口一起没了，她只能来问我
  //   「现在 toy 取消隐藏的条件是啥」。现在挂在标题本身上：这一页只要还有标题，
  //   入口就还在，不会再被别的规矩顺手删掉。
  return h("div", { className: "h-full flex flex-col" },
    h(Head, { zh: m[0], en: m[1], onBack: back, onTitleTap: page === "home" ? toyKnock : undefined }),
    h("div", { key: page || "home", ref: scrollRef, className: "flex-1 overflow-y-auto px-6 pb-10", style: { overflowAnchor: "none" } },
      page === "home" && h("div", { style: { display: "flex", flexDirection: "column", gap: 8, marginTop: 16 } },
        homeRows.map(row => h("button", {
          key: row.key,
          onClick: e => { if (e.currentTarget && e.currentTarget.blur) e.currentTarget.blur(); setPage(row.key); },
          className: "w-full flex items-center active:opacity-70",
          style: { gap: 12, padding: "11px 13px 11px 11px", borderRadius: 14, border: "1px solid " + t.line, background: t.bg2, textAlign: "left" }
        },
          h("span", { style: { flexShrink: 0, width: 34, height: 34, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: row.tint + "1f", color: row.tint, fontFamily: F_DISPLAY, fontSize: 16 } }, row.char),
          h("span", { className: "flex-1 min-w-0" },
            h("span", { style: { display: "block", fontFamily: F_DISPLAY, fontSize: 15, color: t.ink } }, row.title),
            h("span", { style: { display: "block", fontFamily: F_BODY, fontSize: 10.5, color: t.fog, lineHeight: 1.5, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, row.state())),
          h("span", { style: { flexShrink: 0, fontFamily: F_BODY, fontSize: 15, color: t.line } }, "›"))),
        h("div", { style: { marginTop: 14, padding: "13px 15px", borderRadius: 16, border: "1px solid " + t.line, fontFamily: F_BODY, fontSize: 11, color: t.fog, lineHeight: 1.6 } },
          "这一页管的是【整个 app】。某一个角色怎么跟你相处——记忆、主动、外观、房间——在他自己的聊天里点右上角 ⋯。")),
      // 长相那三样原来是首页三张平级的卡：想改个颜色得先猜是哪一张
      page === "look" && h(ConfigTileGrid, null,
        h(ConfigTile, { icon: "◐", title: "外观与壁纸", sub: "颜色、字体和主屏背景", onClick: () => setPage("theme") }),
        h(ConfigTile, { icon: "◒", title: "聊天气泡", sub: "颜色、贴纸、尺寸与阴影", onClick: () => setPage("bubble") }),
        h(ConfigTile, { icon: "✦", title: "主题工作台", sub: "图标、页面 CSS、主题包与应用前预览", onClick: () => setPage("themeStudio"), wide: true })),
      page === "write" && h(ConfigTileGrid, null,
        h(ConfigTile, { icon: "✎", title: "创作小稿", sub: "线下写正文前先打的那份草稿：写法、预设与模型保险", onClick: () => setPage("cot"), wide: true }),
        h(ConfigTile, { icon: "?", title: "情侣问答", sub: "按角色管理自定义题目", onClick: () => setPage("qa"), wide: true })),
      page === "api" && h(ConfigTileGrid, null,
        h(ConfigTile, { icon: "⌨", title: "文字模型", sub: "聊天、线下、后台模型与多线路方案", onClick: () => setPage("apiText"), wide: true }),
        h(ConfigTile, { icon: "▧", title: "图像 API", sub: "自拍、合照与多个图像站点", onClick: () => setPage("apiImage") }),
        h(ConfigTile, { icon: "◖", title: "语音 API", sub: "MiniMax TTS、克隆音色与指派", onClick: () => setPage("apiTts") }),
        h(ConfigTile, { icon: "∞", title: "向量记忆", sub: "独立 Embedding 接口与索引", onClick: () => setPage("apiEmbed") }),
        h(ConfigTile, { icon: "◉", title: "真声耳朵", sub: "书房识别服务与门锁", onClick: () => setPage("apiEars") }),
        h(ConfigTile, { icon: "≋", title: "额度与缓存", sub: "缓存命中与调用读数", onClick: () => setPage("apiCache"), wide: true })),
      page === "apiText" && section(h(ApiConfig, { profiles: props.apiProfiles, activeId: props.activeId, offlineApiId: props.offlineApiId, onSetOfflineApi: props.onSetOfflineApi, modelFloatOn: props.modelFloatOn, onSetModelFloat: props.onSetModelFloat, bgApiId: props.bgApiId, onSetBgApi: props.onSetBgApi, onSave: props.onSaveApi, toast: props.toast })),
      page === "apiImage" && section(h(React.Fragment, null, h(ImageApiConfig, { toast: props.toast }), h(AvatarPoolConfig, { toast: props.toast }))),
      page === "apiTts" && section(h(TtsApiConfig, { toast: props.toast, characters: props.characters, onAssignVoice: props.onAssignVoice })),
      page === "apiEmbed" && section(h(EmbedApiConfig, { toast: props.toast })),
      page === "apiEars" && section(h(VoiceEarsConfig, { toast: props.toast })),
      page === "apiCache" && section(h(CacheStatCard, null)),
      page === "sense" && section(h(SenseConfig, { prefs: props.prefs, onSave: props.onSavePrefs, geo: props.geo, onRequestGeo: props.onRequestGeo, toast: props.toast })),
      page === "cot" && section(h(CotConfig, { toast: props.toast, activeProfile: (props.apiProfiles || []).find(p => p.id === props.activeId) || (props.apiProfiles || [])[0] || null })),
      page === "qa" && section(h(CoupleQAConfig, { characters: props.characters, custom: props.coupleQACustom, onSave: props.onSaveCustomQA, toast: props.toast })),
      page === "theme" && section(h(ThemeConfig, { theme: props.theme, onSave: props.onSaveTheme, wallpaper: props.wallpaper, onSaveWallpaper: props.onSaveWallpaper, wallFx: props.wallFx, onSaveWallFx: props.onSaveWallFx })),
      page === "themeStudio" && section(h(window.ThemeStudioConfig, { toast: props.toast, theme: props.theme, wallpaper: props.wallpaper, onSaveTheme: props.onSaveTheme, onSaveWallpaper: props.onSaveWallpaper })),
      page === "bubble" && section(h(BubbleSkinConfig, { toast: props.toast })),
      page === "auto" && h(AutoRefreshConfig, { characters: props.autoCharacters || props.characters, policy: props.autoRefreshPolicy, onSetGlobal: props.onSetAutoRefreshGlobal, onSetChar: props.onSetAutoRefreshChar }),
      page === "data" && section(h(DataConfig, { characters: props.characters, onExport: props.onExport, onImport: props.onImport, onOffloadChats: props.onOffloadChats, onPruneOld: props.onPruneOld, onClearAll: props.onClearAll, onRescueChar: props.onRescueChar, toast: props.toast })),
      page === "debug" && section(h(CtxDebug, { characters: props.characters, getBundle: props.debugBundleFor })),
      page === "toy" && toyUnlocked && typeof ToyConfig === "function" && section(h(ToyConfig, { toast: props.toast }))));
}

// MCP 服务器（v58.75，她 2026-08-31）：给角色接外部工具（联网搜索、抓网页……）。
// 浏览器能直接当 MCP client——Streamable HTTP 就是 HTTP + JSON-RPC。两个坎必须写在
// 界面上，不然她只会对着「连不上」猜：服务端要放行跨域(CORS)，地址要是 /mcp 那一档。
// 代价也必须写在界面上：这一档是客户端回合，真用上工具的那一轮【至少两次调用】。
function McpConfig({ toast }) {
  const t = useTheme();
  const [list, setList] = useState(() => { try { return JSON.parse(localStorage.getItem("x_mcp") || "[]") || []; } catch (e) { return []; } });
  const [busy, setBusy] = useState("");
  const [seen, setSeen] = useState({});
  const persist = next => { setList(next); try { localStorage.setItem("x_mcp", JSON.stringify(next)); } catch (e) {} if (window.MCP) window.MCP.forget(); };
  const upd = (id, patch) => persist(list.map(x => x.id === id ? { ...x, ...patch } : x));
  const inSt = { fontFamily: F_BODY, fontSize: 13, color: t.ink, background: t.bg2, border: "1px solid " + t.line, borderRadius: 10, padding: "9px 11px", width: "100%", outline: "none" };
  const probe = async srv => {
    if (!window.MCP) { toast && toast("MCP 组件没加载出来"); return; }
    setBusy(srv.id);
    try {
      const names = await window.MCP.probe(srv);
      setSeen(p => ({ ...p, [srv.id]: names }));
      toast && toast("通了：" + names.length + " 件工具");
    } catch (e) { toast && toast(String((e && e.message) || e)); }
    finally { setBusy(""); }
  };
  return h("div", { style: { marginTop: 22 } },
    h("div", { style: { fontFamily: F_DISPLAY, fontSize: 20, color: t.ink } }, "MCP 服务器"),
    h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, lineHeight: 1.75, marginTop: 4 } },
      "给角色接外部工具：联网搜索、抓网页之类。填公网地址就行；本机跑的要么让它放行跨域(CORS)，要么先用 cloudflared / ngrok 转成公网 HTTPS。地址要用 Streamable HTTP 那一档（通常以 /mcp 结尾），旧的 /sse 浏览器直连不了。"),
    h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: "#a4442e", lineHeight: 1.7, marginTop: 6 } },
      "⚠ 这一档跟内置的「让 Ta 能上网」不一样：模型说要调工具、我们去调、再问模型一遍——所以真用上工具的那一轮至少花两次调用。"),
    list.map(srv => h("div", { key: srv.id, style: { marginTop: 12, padding: "13px 13px 11px", borderRadius: 16, background: t.bg2, border: "1px solid " + t.line } },
      h("div", { className: "flex items-center", style: { gap: 8, marginBottom: 8 } },
        h("input", { value: srv.name || "", onChange: e => upd(srv.id, { name: e.target.value }), placeholder: "起个名字", style: { ...inSt, flex: 1 } }),
        h(Toggle, { on: srv.on !== false, onChange: () => upd(srv.id, { on: srv.on === false }) })),
      h("input", { value: srv.url || "", onChange: e => upd(srv.id, { url: e.target.value.trim() }), placeholder: "https://……/mcp", style: inSt }),
      h("input", { value: srv.token || "", onChange: e => upd(srv.id, { token: e.target.value.trim() }), placeholder: "密钥（选填，会加成 Authorization: Bearer）", style: { ...inSt, marginTop: 8 } }),
      h("div", { className: "flex items-center", style: { gap: 10, marginTop: 10 } },
        h("button", { onClick: () => probe(srv), disabled: busy === srv.id || !srv.url, className: "active:opacity-70",
          style: { fontFamily: F_BODY, fontSize: 12, color: t.ink, border: "1px solid " + t.line, borderRadius: 999, padding: "6px 14px", opacity: (busy === srv.id || !srv.url) ? 0.5 : 1 } }, busy === srv.id ? "测着…" : "测一下"),
        h("button", { onClick: () => persist(list.filter(x => x.id !== srv.id)), className: "active:opacity-70",
          style: { fontFamily: F_BODY, fontSize: 12, color: t.tint } }, "删除")),
      seen[srv.id] ? h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, lineHeight: 1.6, marginTop: 8 } },
        "它给的工具：" + (seen[srv.id].length ? seen[srv.id].join("、") : "一件都没有")) : null)),
    h("button", { onClick: () => persist([...list, { id: "m_" + Date.now(), name: "", url: "", token: "", on: true }]), className: "w-full active:opacity-70",
      style: { marginTop: 12, fontFamily: F_BODY, fontSize: 13, color: t.tint, border: "1px dashed " + t.line, borderRadius: 14, padding: "12px 0" } }, "＋ 加一台 MCP 服务器"),
    list.length ? h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, lineHeight: 1.7, marginTop: 10 } },
      "加好之后，还要在【那个角色的聊天设置】里打开「让 Ta 能上网」，工具才会发给他。默认谁都不发。") : null);
}

function ApiConfig({
  profiles = [],
  activeId,
  offlineApiId,
  onSetOfflineApi,
  modelFloatOn,
  onSetModelFloat,
  bgApiId,
  onSetBgApi,
  onSave,
  toast
}) {
  const t = useTheme();
  const [list, setList] = useState(profiles.length ? profiles : [{
    id: "p_" + Date.now(),
    name: "",
    baseUrl: "",
    apiKey: "",
    model: "",
    temperature: 0.75
  }]);
  const [curId, setCurId] = useState(activeId || profiles[0] && profiles[0].id || (profiles.length ? profiles[0].id : null));
  const [dd, setDd] = useState(false);
  const [models, setModels] = useState([]);
  const [fetching, setFetching] = useState(false);
  const [editing, setEditing] = useState(false);
  const cur = list.find(p => p.id === curId) || list[0];
  // 它实际给的模型（她 2026-08-31）：问模型「你是哪一版」问不出来——它的训练数据
  // 截止在它自己发布之前，那个回答是猜的。只有回包里服务端写的 model 字段算数。
  // 引擎每次调用都往 x_apiServed 记一笔，这里只是把它显出来，不多花一次调用。
  const [servedAll, setServedAll] = useState({});
  useEffect(() => {
    try { setServedAll(JSON.parse(localStorage.getItem("x_apiServed") || "{}") || {}); }
    catch (e) { setServedAll({}); }
  }, [cur && cur.id, editing]);
  const served = (servedAll || {})[cur && cur.id] || null;
  useEffect(() => {
    // 凭证保险箱可能比设置页晚一拍还原。只在列表页接收外部真值，编辑途中不覆盖用户输入。
    if (!editing && Array.isArray(profiles) && profiles.length) {
      setList(profiles);
      setCurId(id => profiles.some(p => p.id === id) ? id : (activeId || profiles[0].id));
    }
  }, [profiles, activeId, editing]);
  const upd = patch => setList(l => l.map(p => p.id === cur.id ? {
    ...p,
    ...patch
  } : p));
  const addNew = () => {
    const np = {
      id: "p_" + Date.now(),
      name: "",
      baseUrl: "",
      apiKey: "",
      model: "",
      temperature: 0.75
    };
    setList(l => [...l, np]);
    setCurId(np.id);
    setModels([]);
    setDd(false);
    setEditing(true);
  };
  const duplicateProfile = source => {
    const np = {
      ...source,
      id: "p_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
      name: (String(source.name || source.model || "API").trim() || "API") + " · 副本"
    };
    setList(l => [...l, np]); setCurId(np.id); setModels([]); setDd(false); setEditing(true);
    toast && toast("副本已建立，改好后点保存");
  };
  const removeProfile = source => {
    if (list.length <= 1) return;
    requestAppConfirm("删除 API 方案「" + (source.name || source.model || "未命名配置") + "」？", "只删除这条本机配置。", async () => {
      const nl = list.filter(p => p.id !== source.id);
      const nextCur = curId === source.id ? nl[0].id : curId;
      const nextActive = activeId === source.id ? nl[0].id : activeId;
      if (await onSave(nl, nextActive) === false) return;
      setList(nl); setCurId(nextCur); if (editing && curId === source.id) setEditing(false);
    }, "删除");
  };
  const removeCur = () => {
    removeProfile(cur);
  };
  const pull = async () => {
    setFetching(true);
    try {
      const ms = await fetchModelList(cur);
      setModels(ms);
      toast(ms.length + " 个模型");
    } catch (e) {
      toast("拉取失败：" + e.message);
    } finally {
      setFetching(false);
    }
  };
  const routeBox = (title, sub, selectedId, setter, noneLabel) => !setter ? null : h(ConfigPanel, null,
    h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: t.ink, marginBottom: 4 } }, title),
    h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, lineHeight: 1.6, marginBottom: 11 } }, sub),
    h("div", { style: { display: "flex", flexWrap: "wrap", gap: 8 } },
      [{ id: null, name: noneLabel }].concat(list).map(p => {
        const on = (selectedId || null) === (p.id || null);
        return h("button", { key: p.id || title, onClick: () => setter(p.id || null), className: "active:opacity-70",
          style: { fontFamily: F_BODY, fontSize: 12, color: on ? t.bg2 : t.sub, background: on ? t.ink : "transparent", border: "1px solid " + (on ? t.ink : t.line), borderRadius: 999, padding: "6px 12px" } }, p.name || p.model || "未命名配置");
      })));
  if (!editing) return h("div", null,
    onSetModelFloat && h(ConfigPanel, null,
      h("div", { className: "flex items-center justify-between", style: { gap: 14 } },
        h("div", null,
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15, color: t.ink } }, "模型快速切换浮窗"),
          h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 3, lineHeight: 1.45 } }, "线上、线下分别切换；角色专线不受影响。")),
        h("button", { onClick: () => onSetModelFloat(!modelFloatOn), style: { flexShrink: 0, width: 48, height: 27, borderRadius: 14, padding: 3, background: modelFloatOn ? t.ink : t.line } },
          h("span", { style: { display: "block", width: 21, height: 21, borderRadius: 11, background: t.bg2, transform: modelFloatOn ? "translateX(21px)" : "translateX(0)", transition: "transform .18s" } })))),
    h("div", { className: "flex items-center justify-between", style: { marginTop: 18, marginBottom: 10 } },
      h("div", null,
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 20, color: t.ink } }, "API 方案"),
        h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginTop: 2 } }, "一张卡一条线路 · 点进去单独编辑")),
      h("button", { onClick: addNew, style: { fontFamily: F_BODY, fontSize: 12.5, color: t.bg2, background: t.ink, borderRadius: 999, padding: "9px 15px" } }, "＋ 新增方案")),
    h("div", { style: { display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 10 } }, list.map(p =>
      h("div", { key: p.id, onClick: () => { setCurId(p.id); setModels([]); setDd(false); setEditing(true); }, className: "active:opacity-75", style: {
        minHeight: 124, padding: "13px 13px 10px", borderRadius: 18, cursor: "pointer",
        background: t.bg2, border: "1px solid " + t.line, boxShadow: "0 7px 18px rgba(60,50,40,.05)", display: "flex", flexDirection: "column"
      } },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15.5, color: t.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, p.name || "未命名配置"),
        h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, p.model || "还没选择模型"),
        ((servedAll || {})[p.id] || {}).verdict === "diff"
          ? h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: "#a4442e", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, "⚠ 实际给的是 " + servedAll[p.id].got)
          : null,
        h("div", { className: "flex items-center", style: { gap: 9, marginTop: "auto", paddingTop: 10 } },
          h("button", { onClick: e => { e.stopPropagation(); setCurId(p.id); setEditing(true); }, style: { fontFamily: F_BODY, fontSize: 11.5, color: t.ink } }, "编辑"),
          h("button", { onClick: e => { e.stopPropagation(); duplicateProfile(p); }, style: { fontFamily: F_BODY, fontSize: 11.5, color: t.sub } }, "复制副本"),
          list.length > 1 ? h("button", { onClick: e => { e.stopPropagation(); removeProfile(p); }, style: { fontFamily: F_BODY, fontSize: 11.5, color: t.tint } }, "删除") : null,
          p.id === activeId ? h("span", { style: { marginLeft: "auto", fontFamily: F_BODY, fontSize: 9.5, color: t.tint } }, "主") : null)))),
    routeBox("线下与创作模型", "单人/群线下、小游戏、日记、同人文与穿越互动统一从这里选，不再绑在某一张 API 编辑卡里。", offlineApiId, onSetOfflineApi, "跟随线上主模型"),
    routeBox("后台任务模型", "记忆、日程、钱包、便签等机械后台活可统一走便宜线路；不选就跟主模型。", bgApiId, onSetBgApi, "跟随主模型"),
    h(McpConfig, { toast: toast }));
  return /*#__PURE__*/React.createElement("div", null,
  h("button", { onClick: () => setEditing(false), className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 12.5, color: t.sub, marginBottom: 14 } }, "← 返回 API 方案"),
  false && onSetModelFloat && h("div", { style: { marginTop: 2, marginBottom: 18, padding: "13px 14px", border: "1px solid " + t.line, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, background: t.bg2 } },
    h("div", null,
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14, color: t.ink } }, "模型快速切换浮窗"),
      h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 3, lineHeight: 1.45 } }, "开启后显示右侧 AI 圆点；线上、线下分别切换，角色专线不受影响。")),
    h("button", { onClick: () => onSetModelFloat(!modelFloatOn), className: "active:opacity-70", style: { flexShrink: 0, width: 48, height: 27, borderRadius: 14, padding: 3, background: modelFloatOn ? t.ink : t.line } },
      h("span", { style: { display: "block", width: 21, height: 21, borderRadius: 11, background: t.bg2, transform: modelFloatOn ? "translateX(21px)" : "translateX(0)", transition: "transform .18s" } }))),
  false && h("div", { style: { marginTop: 12, marginBottom: 22 } },
    h("div", { className: "flex items-center justify-between", style: { marginBottom: 10 } },
      h("div", null,
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 20, color: t.ink } }, "API 方案"),
        h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginTop: 2 } }, "一张卡一条线路 · 点卡片编辑")),
      h("button", { onClick: addNew, className: "active:opacity-70", style: { fontFamily: F_BODY, fontSize: 12.5, color: t.bg2, background: t.ink, borderRadius: 999, padding: "9px 15px" } }, "＋ 新增方案")),
    h("div", { style: { display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 10 } }, list.map(p => {
      const selected = p.id === curId;
      return h("div", { key: p.id, onClick: () => { setCurId(p.id); setModels([]); setDd(false); }, className: "active:opacity-75", style: {
        minHeight: 124, padding: "13px 13px 10px", borderRadius: 18, cursor: "pointer",
        background: t.bg2, border: "1.5px solid " + (selected ? t.ink : t.line),
        boxShadow: selected ? "0 7px 18px rgba(60,50,40,.08)" : "none", display: "flex", flexDirection: "column"
      } },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15.5, color: t.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, p.name || "未命名配置"),
        h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, lineHeight: 1.45, marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, p.model || "还没选择模型"),
        h("div", { className: "flex items-center", style: { gap: 10, marginTop: "auto", paddingTop: 10 } },
          h("button", { onClick: e => { e.stopPropagation(); setCurId(p.id); setModels([]); }, style: { fontFamily: F_BODY, fontSize: 11.5, color: selected ? t.ink : t.sub } }, selected ? "编辑中" : "编辑"),
          h("button", { onClick: e => { e.stopPropagation(); duplicateProfile(p); }, style: { fontFamily: F_BODY, fontSize: 11.5, color: t.sub } }, "复制副本"),
          list.length > 1 ? h("button", { onClick: e => { e.stopPropagation(); removeProfile(p); }, style: { fontFamily: F_BODY, fontSize: 11.5, color: t.tint } }, "删除") : null,
          p.id === activeId ? h("span", { style: { marginLeft: "auto", fontFamily: F_BODY, fontSize: 9.5, color: t.tint } }, "主") : null));
    }))),
  /*#__PURE__*/React.createElement(LineField, {
    zh: "配置名称",
    en: "Name"
  }, /*#__PURE__*/React.createElement(LineInput, {
    value: cur.name,
    onChange: e => upd({
      name: e.target.value
    }),
    placeholder: "给这个配置起个名字"
  })), /*#__PURE__*/React.createElement(LineField, {
    zh: "接口地址",
    en: "Endpoint"
  }, /*#__PURE__*/React.createElement(LineInput, {
    value: cur.baseUrl,
    onChange: e => upd({
      baseUrl: e.target.value
    }),
    placeholder: "https://api.openai.com 或中转地址",
    style: {
      fontSize: 15,
      fontFamily: F_BODY
    }
  })), /*#__PURE__*/React.createElement(LineField, {
    zh: "密钥",
    en: "Key"
  }, /*#__PURE__*/React.createElement(LineInput, {
    type: "password",
    value: cur.apiKey,
    onChange: e => upd({
      apiKey: e.target.value
    }),
    placeholder: cur.proxyRef ? "（走云端代理，密钥可留空）" : "sk-... / AIza...",
    style: {
      fontSize: 15,
      fontFamily: F_BODY
    }
  })), /*#__PURE__*/React.createElement(LineField, {
    zh: "云端代理",
    en: "Proxy Ref · 选填"
  }, /*#__PURE__*/React.createElement(LineInput, {
    value: cur.proxyRef || "",
    onChange: e => upd({
      proxyRef: e.target.value.trim().toUpperCase()
    }),
    placeholder: "如 DZZI / ANTHROPIC——密钥住云端保险柜，此处填引用名",
    style: {
      fontSize: 15,
      fontFamily: F_BODY
    }
  })), /*#__PURE__*/React.createElement(LineField, {
    // 直连版保险柜（tools/vps/llm-proxy.mjs）。填了这一栏，所有走「云端代理」的线路
    // 都改走它，不再经过自建 Supabase 的 Kong——Kong 的读超时默认 60 秒，
    // 长正文一次写不完就会被掐（她 2026-08-24 的 gemini 那笔：服务端 68 秒、钱扣了、东西没了）。
    // 这是全局设置，不属于某一条线路，所以不进 cur、直接读写 localStorage。
    zh: "保险柜直连",
    en: "Vault Direct · 选填 · 全局"
  }, /*#__PURE__*/React.createElement(LineInput, {
    value: (window.Cloud && window.Cloud.llmProxyDirect() || {}).url || "",
    onChange: e => {
      const v = e.target.value.trim();
      const old = (window.Cloud && window.Cloud.llmProxyDirect()) || {};
      window.Cloud && window.Cloud.setLlmProxyDirect(v, old.secret || "");
      upd({});
    },
    placeholder: "https://yanqiu-vps.tail542792.ts.net:8791/ ——留空＝还走 Kong",
    style: {
      fontSize: 15,
      fontFamily: F_BODY
    }
  })), /*#__PURE__*/React.createElement(LineField, {
    zh: "直连口令",
    en: "Vault Secret · 全局"
  }, /*#__PURE__*/React.createElement(LineInput, {
    type: "password",
    value: (window.Cloud && window.Cloud.llmProxyDirect() || {}).secret || "",
    onChange: e => {
      const old = (window.Cloud && window.Cloud.llmProxyDirect()) || {};
      if (!old.url) return;
      window.Cloud && window.Cloud.setLlmProxyDirect(old.url, e.target.value.trim());
      upd({});
    },
    placeholder: "服务端 LLM_PROXY_SECRET 那一串",
    style: {
      fontSize: 15,
      fontFamily: F_BODY
    }
  })), /*#__PURE__*/React.createElement(LineField, {
    zh: "模型",
    en: "Model",
    right: /*#__PURE__*/React.createElement("button", {
      onClick: pull,
      disabled: fetching,
      className: "disabled:opacity-40",
      style: {
        fontFamily: F_BODY,
        fontSize: 11,
        color: t.ink,
        borderBottom: `1.5px solid ${t.ink}`,
        paddingBottom: 1
      }
    }, fetching ? "拉取中…" : "点击拉取列表")
  }, /*#__PURE__*/React.createElement(LineInput, {
    value: cur.model,
    onChange: e => upd({
      model: e.target.value
    }),
    placeholder: "先拉取列表或手动输入模型名",
    style: {
      fontSize: 16
    }
  }), models.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "mt-3 flex flex-wrap gap-1.5 max-h-32 overflow-y-auto"
  }, models.map(m => /*#__PURE__*/React.createElement("button", {
    key: m,
    onClick: () => upd({
      model: m
    }),
    style: {
      fontFamily: F_BODY,
      fontSize: 11,
      padding: "4px 9px",
      borderRadius: 999,
      border: `1px solid ${cur.model === m ? t.ink : t.line}`,
      color: cur.model === m ? t.ink : t.fog
    }
  }, m)))),
  served && served.got ? h("div", { style: { margin: "-6px 0 18px", padding: "9px 12px", borderRadius: 12, background: t.bg2, border: "1px solid " + (served.verdict === "diff" ? "#a4442e" : t.line) } },
    h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.ink, lineHeight: 1.5 } },
      "它实际给的：" + served.got),
    h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: served.verdict === "diff" ? "#a4442e" : t.fog, lineHeight: 1.6, marginTop: 3 } },
      (served.verdict === "same" ? "跟你填的一致。"
        : served.verdict === "alias" ? "跟你填的是同一个，只是带上了版本号。"
        : served.verdict === "diff" ? "⚠ 跟你填的「" + (served.req || cur.model || "") + "」对不上——这条线路可能把请求转给了别的模型。"
        : "这条线路没回传模型名，看不出来。")
      + " 上次调用 " + new Date(served.ts || 0).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })),
    h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: t.fog, lineHeight: 1.6, marginTop: 5 } },
      "这是回包里服务端写的那个名字。别去问模型「你是哪一版」——它训练时还没有它自己，那个回答是猜的。")) : null,
  /*#__PURE__*/React.createElement(LineField, {
    zh: "温度",
    en: "Temperature",
    right: /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: F_DISPLAY,
        fontStyle: "italic",
        fontSize: 18,
        color: t.ink
      }
    }, (cur.temperature != null ? cur.temperature : 0.75).toFixed(1))
  }, /*#__PURE__*/React.createElement(Slider, {
    value: cur.temperature != null ? cur.temperature : 0.75,
    min: 0,
    max: 2,
    step: 0.1,
    onChange: v => upd({
      temperature: v
    })
  })),
  /*#__PURE__*/React.createElement("div", {
    className: "flex gap-3 mt-8"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: async () => {
      await onSave(list, curId);
    },
    className: "flex-1 py-3",
    style: {
      fontFamily: F_BODY,
      fontSize: 13,
      letterSpacing: "0.06em",
      background: t.ink,
      color: t.bg2,
      borderRadius: 6
    }
  }, "保存并设为线上主 API"), list.length > 1 && /*#__PURE__*/React.createElement("button", {
    onClick: removeCur,
    className: "py-3 px-5",
    style: {
      fontFamily: F_BODY,
      fontSize: 13,
      color: t.fog,
      border: `1px solid ${t.line}`,
      borderRadius: 6
    }
  }, "删除此配置")), false && onSetOfflineApi && h("div", { style: { marginTop: 26, paddingTop: 18, borderTop: "1px solid " + t.line } },
    h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: t.ink, marginBottom: 4 } }, "线下与创作 API"),
    h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginBottom: 12, lineHeight: 1.6 } }, "单人线下、群线下、小游戏、日记、同人文与穿越互动都走这里；线下 OOC、滚动总结和结束总结也跟随这条线路。角色若在人格档案馆里指定了专属线路，角色专属内容仍永远优先走自己的专线；不选＝跟随线上主模型。"),
    h("div", { style: { display: "flex", flexWrap: "wrap", gap: 8 } },
      [{ id: null, name: "跟随线上主模型" }].concat(list).map(p => {
        const on = (offlineApiId || null) === (p.id || null);
        return h("button", { key: p.id || "offline-none", onClick: () => onSetOfflineApi(p.id || null), className: "active:opacity-70",
          style: { fontFamily: F_BODY, fontSize: 12.5, color: on ? t.bg2 : t.sub, background: on ? t.ink : "transparent", border: "1px solid " + (on ? t.ink : t.line), borderRadius: 999, padding: "6px 13px" } }, p.name || p.model || "未命名配置");
      }))), false && onSetBgApi && h("div", { style: { marginTop: 26, paddingTop: 18, borderTop: "1px solid " + t.line } },
    h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: t.ink, marginBottom: 4 } }, "后台任务 API（省钱可选）"),
    h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginBottom: 12, lineHeight: 1.6 } }, "抽取记忆 / 日程 / 钱包 / 查手机 / 随身物 / 购物 / 便签墙 / 心情日历 / 记账 / 番茄钟 这些后台活，走一个便宜的按量小模型（如 gemini-flash-nothinking），不动聊天/日记/同人这些创作类。不选＝跟主模型用同一个。"),
    h("div", { style: { display: "flex", flexWrap: "wrap", gap: 8 } },
      [{ id: null, name: "跟随主模型" }].concat(list).map(p => {
        const on = (bgApiId || null) === (p.id || null);
        return h("button", { key: p.id || "none", onClick: () => onSetBgApi(p.id || null), className: "active:opacity-70",
          style: { fontFamily: F_BODY, fontSize: 12.5, color: on ? t.bg2 : t.sub, background: on ? t.ink : "transparent", border: "1px solid " + (on ? t.ink : t.line), borderRadius: 999, padding: "6px 13px" } }, p.name || p.model || "未命名配置");
      }))));
}
function SenseConfig({
  prefs,
  onSave,
  geo,
  onRequestGeo,
  toast
}) {
  const t = useTheme();
  const [p, setP] = useState(prefs);
  const [notifOn, setNotifOn] = useState(() => !!(window.Notify && window.Notify.isOn()));
  const save = np => {
    setP(np);
    onSave(np);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "pt-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between py-4",
    style: {
      borderBottom: `1px solid ${t.line}`
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: F_DISPLAY,
      fontSize: 16,
      color: t.ink
    }
  }, "时间感知"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: F_BODY,
      fontSize: 11.5,
      color: t.fog,
      marginTop: 2
    }
  }, "全局默认值；角色与房间可单独覆盖，开启后会自然感知深夜/清晨")), /*#__PURE__*/React.createElement(Toggle, {
    on: p.timeAware !== false,
    onChange: v => save({
      ...p,
      timeAware: v
    })
  })), h("div", {
    className: "flex items-center justify-between py-4",
    style: { borderBottom: `1px solid ${t.line}` }
  }, h("div", { style: { paddingRight: 12 } }, h("div", {
    style: { fontFamily: F_DISPLAY, fontSize: 16, color: t.ink }
  }, "锁屏通知"), h("div", {
    style: { fontFamily: F_BODY, fontSize: 11.5, lineHeight: 1.5, color: t.fog, marginTop: 2 }
  }, "角色发来消息、动态时，若你切到别处或锁了屏，弹成真·系统通知。iOS 需先把网页用 Safari「添加到主屏」、以独立 App 打开再开启。")), h(Toggle, {
    on: notifOn,
    onChange: v => {
      if (!window.Notify || !window.Notify.supported()) { toast && toast("此设备/浏览器不支持通知"); return; }
      if (v) {
        window.Notify.enable().then(perm => {
          if (perm === "granted") { setNotifOn(true); toast && toast("锁屏通知已开启～切后台也能收到"); window.Notify.test(700); }
          else if (perm === "denied") { setNotifOn(false); toast && toast("通知被拒了：去系统/浏览器设置里手动允许"); }
          else { setNotifOn(false); toast && toast("iOS 请先「添加到主屏」，以独立 App 打开再开"); }
        });
      } else { window.Notify.disable(); setNotifOn(false); toast && toast("已关闭锁屏通知"); }
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between py-4",
    style: {
      borderBottom: `1px solid ${t.line}`
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: F_DISPLAY,
      fontSize: 16,
      color: t.ink
    }
  }, "位置感知"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: F_BODY,
      fontSize: 11.5,
      color: t.fog,
      marginTop: 2
    }
  }, geo && geo.label ? "当前：" + geo.label : "角色可据你的位置回应（需授权定位）")), /*#__PURE__*/React.createElement(Toggle, {
    on: p.geoAware === true,
    onChange: v => {
      save({
        ...p,
        geoAware: v
      });
      if (v) onRequestGeo();
    }
  })), p.geoAware && /*#__PURE__*/React.createElement("button", {
    onClick: onRequestGeo,
    className: "mt-4 w-full py-2.5",
    style: {
      fontFamily: F_BODY,
      fontSize: 12,
      color: t.ink,
      border: `1px solid ${t.line}`,
      borderRadius: 6
    }
  }, geo && geo.label ? "重新获取定位" : "获取当前定位"), geo && geo.error && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: F_BODY,
      fontSize: 11.5,
      color: t.accent,
      marginTop: 8
    }
  }, "定位失败：", geo.error));
}
// 气泡皮肤设置（v48.25 第六课·和 Lisa 一起建）：把 components.js 顶部的 BUBBLE_SKIN 做成可视化换装。
// 原理：这里改的是一份草稿 s（useState），「保存」时 Object.assign 进 BUBBLE_SKIN + 存 x_bubbleSkin，
// 开机由 components.js 顶部把存档 merge 回来——所以保存一次，永久生效。
function BubbleSkinConfig({ toast }) {
  const t = useTheme();
  const [s, setS] = useState(() => Object.assign({}, BUBBLE_SKIN)); // 草稿：从当前皮肤复制一份
  const [folded, setFolded] = useState(true); // v48.38：默认折起，点标题展开（试衣镜太长）
  const set = patch => setS(p => Object.assign({}, p, patch));
  const save = () => { Object.assign(BUBBLE_SKIN, s); try { localStorage.setItem("x_bubbleSkin", JSON.stringify(s)); } catch (e) {} if (typeof applyBubbleSkinCSS === "function") applyBubbleSkinCSS(); toast && toast("皮肤已保存，聊天页立即生效"); };
  const reset = () => { const d = Object.assign({}, BUBBLE_SKIN_DEFAULTS); setS(d); Object.assign(BUBBLE_SKIN, d); try { localStorage.removeItem("x_bubbleSkin"); localStorage.removeItem("x_bubbleSkinPreset"); } catch (e) {} if (typeof applyBubbleSkinCSS === "function") applyBubbleSkinCSS(); toast && toast("已恢复出厂皮肤"); };
  const inSt = { width: "100%", outline: "none", padding: "8px 11px", borderRadius: 9, fontFamily: F_BODY, fontSize: 12.5, background: t.bg2, color: t.ink, border: "1px solid " + t.line };
  // 一行一个字段：row("标签", "字段名", "占位提示")——加新字段就抄一行
  const row = (label, key, ph) => h("div", { className: "mb-2.5" },
    h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginBottom: 3 } }, label),
    h("input", { value: s[key] == null ? "" : String(s[key]), onChange: e => set({ [key]: e.target.value }), placeholder: ph || "", style: inSt }));
  const numRow = (label, key, min, max) => h("div", { className: "mb-2.5" },
    h("div", { className: "flex items-baseline justify-between", style: { marginBottom: 3 } },
      h("span", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog } }, label),
      h("span", { style: { fontFamily: F_DISPLAY, fontSize: 13, color: t.tint } }, String(s[key]))),
    h("input", { type: "range", min: min, max: max, step: 1, value: Number(s[key]) || 0, onChange: e => set({ [key]: Number(e.target.value) }), style: { width: "100%" } }));
  // 试衣镜：两只气泡实时读草稿 s——还没保存就能看效果
  const bub = (mine, text) => h("div", { className: "flex " + (mine ? "justify-end" : "justify-start"), style: { margin: "8px 0" } },
    h("div", { style: { position: "relative", maxWidth: "78%", padding: "9px 13px", fontFamily: F_BODY, fontSize: 13.5, lineHeight: 1.5,
      background: mine ? s.myBg : s.charBg, color: mine ? s.myText : (s.charText || t.ink),
      border: (mine ? s.myBorder : s.charBorder) || "none", borderRadius: Number(s.radius) || 0, boxShadow: s.shadow || "none" } },
      (mine ? s.mySticker : s.charSticker) ? h("img", { src: mine ? s.mySticker : s.charSticker, alt: "", style: { position: "absolute", top: -(Number(s.stickerSize) || 52) / 2, right: mine ? -10 : "auto", left: mine ? "auto" : -10, width: Number(s.stickerSize) || 52, height: Number(s.stickerSize) || 52, objectFit: "contain", pointerEvents: "none", transform: mine ? "none" : "scaleX(-1)" } }) : null,
      text));
  return h("div", { className: "pt-8 mt-6", style: { borderTop: "1px dashed " + t.line } },
    h("button", { onClick: () => setFolded(f => !f), className: "w-full flex items-center justify-between active:opacity-60", style: { padding: "2px 0" } },
      h("span", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: t.ink } }, "气泡皮肤 · Bubble Skin"),
      h("span", { style: { fontFamily: F_BODY, fontSize: 16, color: t.fog, transition: "transform .2s", transform: folded ? "none" : "rotate(90deg)", display: "inline-block" } }, "›")),
    folded ? null : h(React.Fragment, null,
    // 一键换整套（v61.05）：跟单聊 ••• 里那一格是同一个组件，一处画两处用。
    // 换完把草稿也同步过去，试衣镜和下面那些字段立刻跟着变（否则看着像没生效）。
    h("div", { style: { marginTop: 10 } },
      h(BubbleSkinPresets, { onPick: (k, next) => { setS(Object.assign({}, next)); toast && toast("换成整套皮肤了"); } })),
    h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, lineHeight: 1.5, marginTop: 2, marginBottom: 10 } }, "颜色填 #hex 或一整段渐变 linear-gradient(...)；贴纸填图片地址（assets/xx.png 或 https）；描边/贴纸留空=不启用。试衣镜实时预览，保存后全 app 生效。"),
    h("div", { style: { padding: "14px 14px 10px", borderRadius: 12, background: s.chatBg || t.bg, border: "1px solid " + t.line, marginBottom: 12, overflow: "hidden" } },
      bub(false, "试衣镜：TA 的气泡"),
      bub(true, "试衣镜：我的气泡")),
    row("我的气泡底色（可渐变）", "myBg", "#f7b6c2"),
    row("TA 的气泡底色（可渐变）", "charBg", "#a8c8e8"),
    numRow("圆角", "radius", 0, 30),
    row("我的文字色", "myText", "#16330a"),
    row("我的描边", "myBorder", "2px solid #f56a91"),
    row("我的贴纸", "mySticker", ""), // 这个留空给放url嘿嘿
    row("TA文字色", "charText", "#16330a"), // 写这里你会看见吗小克
    row("TA描边", "charBorder", "2px solid #75b0eb"),
    row("TA的贴纸", "charSticker", ""), //这里也是url嘿嘿
    row("投影", "shadow", "0 6px 18px rgba(141,189,255,0.3)"),
    row("聊天背景", "chatBg", "#dadbc9"),
    numRow("贴纸大小", "stickerSize", 32,72),
    // 🎓Lisa 的作业区：照上面 row / numRow 的格式把剩下的字段补上——
    // myText（我的文字色）、myBorder（我的描边）、mySticker（我的贴纸）、
    // charText（TA文字色）、charBorder（TA描边）、charSticker（TA贴纸）、
    // shadow（投影）、chatBg（聊天页背景，可渐变）；stickerSize 用 numRow，范围建议 32~72
    h("div", { className: "flex gap-2", style: { marginTop: 8 } },
      h("button", { onClick: save, className: "flex-1 active:opacity-80", style: { fontFamily: F_DISPLAY, fontSize: 14, color: t.bg2, background: t.ink, borderRadius: 10, padding: "11px 0" } }, "保存皮肤"),
      h("button", { onClick: reset, className: "active:opacity-70", style: { fontFamily: F_BODY, fontSize: 12.5, color: t.accent, border: "1px solid " + t.line, borderRadius: 10, padding: "0 16px" } }, "恢复默认"))));
}
function ThemeConfig({
  theme,
  onSave,
  wallpaper,
  onSaveWallpaper,
  wallFx,
  onSaveWallFx
}) {
  const t = useTheme();
  const [th, setTh] = useState(theme);
  const fileRef = useRef(null);
  // 壁纸上压的那一层（v61.38）。滑的时候本地先动，松手才落盘——
  // 每挪一格就 saveJSON 一次的话，拖一趟能写上百次。
  const [fx, setFx] = useState(() => ({ veil: (wallFx && wallFx.veil) || 0, blur: (wallFx && wallFx.blur) || 0 }));
  const putFx = (k, v) => setFx(p => Object.assign({}, p, { [k]: Number(v) }));
  const commitFx = next => { const n = next || fx; onSaveWallFx && onSaveWallFx(n); };
  const fxRow = (k, zh, max, hint) => h("div", { style: { marginTop: 12 } },
    h("div", { className: "flex items-baseline justify-between", style: { marginBottom: 5 } },
      h("span", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.ink } }, zh),
      h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog } }, fx[k] + (k === "blur" ? " px" : " %"))),
    h("input", { type: "range", min: 0, max: max, step: 1, value: fx[k],
      onChange: e => putFx(k, e.target.value),
      onMouseUp: () => commitFx(), onTouchEnd: () => commitFx(),
      style: { width: "100%", accentColor: t.ink } }),
    h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, lineHeight: 1.6, marginTop: 2 } }, hint));
  const pickWallpaper = async e => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      const dataUrl = await resizeImageFile(file, 1080, 0.82);
      onSaveWallpaper(dataUrl);
    } catch (err) {
      onSaveWallpaper && onSaveWallpaper(wallpaper); // 触发 toast 之外无操作
    }
  };
  const fields = [["bg", "背景"], ["bg2", "卡片/次背景"], ["ink", "文字/强调"], ["sub", "正文"], ["fog", "弱文字"], ["line", "分割线"], ["accent", "警示色"], ["tint", "点缀色"]];
  return /*#__PURE__*/React.createElement("div", {
    className: "pt-4"
  },
  // 主屏壁纸：从相册自定义
  /*#__PURE__*/React.createElement("div", {
    className: "pb-5 mb-2",
    style: {
      borderBottom: `1px solid ${t.line}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: F_DISPLAY,
      fontSize: 15,
      color: t.ink,
      marginBottom: 12
    }
  }, "主屏壁纸"), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-4"
  }, /*#__PURE__*/React.createElement("div", {
    onClick: () => fileRef.current && fileRef.current.click(),
    style: {
      width: 62,
      height: 112,
      borderRadius: 14,
      flexShrink: 0,
      cursor: "pointer",
      border: `1px solid ${t.line}`,
      background: wallpaper ? `center/cover no-repeat url(${wallpaper})` : "linear-gradient(165deg, #efe9df 0%, #e6ddd0 55%, #ddd2c4 100%)",
      position: "relative",
      overflow: "hidden"
    }
  },
  // 缩略图上照着主屏那一层画一遍——滑杆挪一格这儿就跟着变，不用退出去看
  wallpaper ? h("div", { "aria-hidden": "true", style: {
    position: "absolute", inset: -(fx.blur * 2 + 2),
    background: "rgba(255,252,247," + (fx.veil / 100) + ")",
    backdropFilter: fx.blur ? "blur(" + fx.blur + "px)" : "none",
    WebkitBackdropFilter: fx.blur ? "blur(" + fx.blur + "px)" : "none"
  } }) : null), /*#__PURE__*/React.createElement("div", {
    className: "flex-1"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => fileRef.current && fileRef.current.click(),
    className: "w-full py-2.5",
    style: {
      fontFamily: F_BODY,
      fontSize: 12.5,
      color: t.bg2,
      background: t.ink,
      borderRadius: 6
    }
  }, wallpaper ? "从相册更换" : "从相册选择"), wallpaper && /*#__PURE__*/React.createElement("button", {
    onClick: () => onSaveWallpaper(""),
    className: "w-full py-2.5 mt-2",
    style: {
      fontFamily: F_BODY,
      fontSize: 12.5,
      color: t.fog,
      border: `1px solid ${t.line}`,
      borderRadius: 6
    }
  }, "恢复默认背景"))),
  // 两个滑杆只在真有壁纸时出现——没壁纸时它俩什么都改不了，摆在那儿只会让人按了没反应
  wallpaper ? h("div", { style: { marginTop: 14 } },
    fxRow("veil", "面纱", 60, "照片上压一层暖白。图挑得深一点、花一点，就把它调高；参考那种「浅雾感」的主屏都有这一层。"),
    fxRow("blur", "虚化", 20, "把背景虚掉，图标会立刻跳出来。0 就是照片原样。"),
    h("button", { onClick: () => { const n = { veil: 22, blur: 0 }; setFx(n); commitFx(n); },
      className: "active:opacity-70", style: { marginTop: 10, fontFamily: F_BODY, fontSize: 11.5, color: t.fog } }, "恢复推荐值")) : null,
  /*#__PURE__*/React.createElement("input", {
    ref: fileRef,
    type: "file",
    accept: "image/*",
    onChange: pickWallpaper,
    style: {
      display: "none"
    }
  })), fields.map(([k, l]) => /*#__PURE__*/React.createElement("div", {
    key: k,
    className: "flex items-center justify-between py-3.5",
    style: {
      borderBottom: `1px solid ${t.line}`
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: F_DISPLAY,
      fontSize: 15,
      color: t.ink
    }
  }, l), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-3"
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: F_BODY,
      fontSize: 11,
      color: t.fog
    }
  }, th[k]), /*#__PURE__*/React.createElement("input", {
    type: "color",
    value: th[k],
    onChange: e => setTh({
      ...th,
      [k]: e.target.value
    }),
    style: {
      width: 30,
      height: 30,
      borderRadius: 999
    }
  })))), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-3 mt-8"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => onSave(th),
    className: "flex-1 py-3",
    style: {
      fontFamily: F_BODY,
      fontSize: 13,
      background: t.ink,
      color: t.bg2,
      borderRadius: 6
    }
  }, "保存主题"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setTh(DEFAULT_THEME),
    className: "py-3 px-5",
    style: {
      fontFamily: F_BODY,
      fontSize: 13,
      color: t.fog,
      border: `1px solid ${t.line}`,
      borderRadius: 6
    }
  }, "默认")));
}
function CloudSync({ toast }) {
  const t = useTheme();
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState("");
  const [confirmPull, setConfirmPull] = useState(false);
  useEffect(() => {
    if (window.Cloud && window.Cloud.ready()) {
      setReady(true);
      window.Cloud.getUser().then(setUser);
    }
  }, []);
  const field = {
    fontFamily: F_BODY,
    fontSize: 13,
    color: t.ink,
    background: t.bg2,
    border: `1px solid ${t.line}`,
    borderRadius: 6,
    padding: "10px 12px",
    width: "100%"
  };
  const btnDark = {
    fontFamily: F_BODY,
    fontSize: 13,
    background: t.ink,
    color: t.bg2,
    borderRadius: 6
  };
  const btnLine = {
    fontFamily: F_BODY,
    fontSize: 13,
    color: t.ink,
    border: `1px solid ${t.line}`,
    borderRadius: 6
  };
  const label = txt => h("div", {
    style: { fontFamily: F_DISPLAY, fontSize: 15, color: t.ink, marginBottom: 4 }
  }, txt);
  const note = txt => h("div", {
    style: { fontFamily: F_BODY, fontSize: 12, lineHeight: 1.7, color: t.fog }
  }, txt);

  if (!ready) {
    return h("div", { className: "pt-6 pb-6", style: { borderBottom: `1px solid ${t.line}` } },
      label("云备份"),
      note("云服务未就绪（网络问题或未加载 Supabase）。你仍可用下方的本地导出/导入备份。"));
  }

  const doSignIn = async () => {
    if (!email || !pw) { toast("请填写邮箱和密码"); return; }
    setBusy("in");
    try {
      const r = await window.Cloud.signIn(email.trim(), pw);
      setUser(r.user);
      setPw("");
      toast("已登录，正在同步…");
      const res = await window.Cloud.autoPull();
      if (res && res.applied) { setTimeout(() => location.reload(), 600); }
      else toast("已开启自动同步");
    } catch (e) {
      toast("登录失败：" + (e.message || "请检查邮箱密码"));
    } finally { setBusy(""); }
  };
  const doSignUp = async () => {
    if (!email || !pw) { toast("请填写邮箱和密码"); return; }
    if (pw.length < 6) { toast("密码至少 6 位"); return; }
    setBusy("up");
    try {
      const r = await window.Cloud.signUp(email.trim(), pw);
      setPw("");
      if (r.session && r.user) {
        setUser(r.user);
        toast("注册成功，已登录");
        const res = await window.Cloud.autoPull();
        if (res && res.applied) setTimeout(() => location.reload(), 600);
      } else {
        toast("注册成功，请到邮箱确认后再登录");
      }
    } catch (e) {
      toast("注册失败：" + (e.message || "请重试"));
    } finally { setBusy(""); }
  };
  const doPush = async () => {
    // 空壳防呆（v48.31）：本机连一个角色都没有还要覆盖云端备份，十有八九是站错设备了——拦一道确认
    if (window.Cloud && typeof window.Cloud.localMeaningful === "function" && !window.Cloud.localMeaningful()) {
      if (!window.confirm("⚠️ 本机现在没有任何角色（看起来是空存档）。\n确定要用这份空数据覆盖云端备份吗？\n（若你是想把云端数据拿回来，请点下面的「从云端恢复」）")) return;
    }
    // 过期设备防呆（v61.63）：本机有角色、但已经很久没跟云端同步过——2026-09-04 就是这样
    // 把手机刚备份的那份盖掉、少了三个角色的。空壳那道闸拦不住「旧的盖新的」。
    try {
      const u = await window.Cloud.getUser();
      const g = u && await window.Cloud.staleness(u.id);
      if (g && g.stale) {
        const when = x => x ? new Date(x).toLocaleString() : "从来没有过";
        if (!window.confirm("⚠️ 云端那份存档比这台设备新得多。\n\n云端最后一次备份：" + when(g.cloudAt) +
          "\n这台设备最后一次同步：" + when(g.localAt) +
          "\n\n现在备份会用本机这份覆盖掉云端那份，中间的改动全部拿不回来。\n（想把云端拿回来请点「从云端恢复」）\n\n确定要覆盖吗？")) return;
      }
    } catch (e) {}
    setBusy("push");
    try {
      await window.Cloud.push();
      toast("已备份到云端");
    } catch (e) {
      toast("备份失败：" + (e.message || "请重试"));
    } finally { setBusy(""); }
  };
  const doPull = async () => {
    setBusy("pull");
    try {
      const row = await window.Cloud.pull();
      if (!row || !row.data) { toast("云端还没有备份"); setBusy(""); setConfirmPull(false); return; }
      await window.Cloud.apply(row.data);
      window.Cloud.markSynced(row.updated_at);   // 不盖这一下，恢复完的第一次自动备份会被过期设备闸拦住
      toast("已从云端恢复，正在重载…");
      setTimeout(() => location.reload(), 800);
    } catch (e) {
      toast("恢复失败：" + (e.message || "请重试"));
      setBusy("");
      setConfirmPull(false);
    }
  };
  const doSignOut = async () => {
    setBusy("out");
    try {
      await window.Cloud.signOut();
      setUser(null);
      toast("已退出登录，本机数据已清空，正在重载…");
      setTimeout(function () { location.reload(); }, 800);
    } catch (e) {
      // 云备份失败时 Cloud.signOut 会拒绝清理本机；给 Lisa 明确告警，不做假退出。
      toast("未退出：最新数据还没安全备份，本机内容已保留。请检查网络或重新登录后再试。");
      setBusy("");
    }
  };

  const inner = user
    ? [
        h("div", { key: "who", style: { fontFamily: F_BODY, fontSize: 13, color: t.sub, marginTop: 4 } },
          "已登录：" + (user.email || user.id)),
        note("已开启自动同步：数据改动会自动备份到云端，换设备/重装登录后自动拉回最新存档。下面两个按钮一般用不到，仅在你想立刻手动操作时用。"),
        h("button", { key: "push", onClick: doPush, disabled: !!busy, className: "mt-4 w-full py-3", style: btnDark },
          busy === "push" ? "备份中…" : "立即备份到云端"),
        !confirmPull
          ? h("button", { key: "pull", onClick: () => setConfirmPull(true), disabled: !!busy, className: "mt-3 w-full py-3", style: btnLine },
              "从云端恢复")
          : h("div", { key: "pullc", className: "mt-3" },
              note("从云端恢复会覆盖本机当前数据，确定？"),
              h("div", { className: "flex gap-3 mt-2" },
                h("button", { onClick: () => setConfirmPull(false), className: "flex-1 py-3", style: btnLine }, "取消"),
                h("button", { onClick: doPull, disabled: busy === "pull", className: "flex-1 py-3", style: { ...btnDark, background: t.accent, color: "#fff" } },
                  busy === "pull" ? "恢复中…" : "确定恢复"))),
        h("button", { key: "ledgerfix", onClick: () => {
          // 不动本地已有消息：只把账本里 48h 内还活着、本地却缺失的行补回来，并让 CC 气泡全量重拉
          try {
            ["chat_ledger_live_cursor_v1", "chat_ledger_pull_shadow_v1", "yanqiu_cross_surface_continuity_v1"].forEach(k => localStorage.removeItem(k));
            localStorage.setItem("chat_ledger_restore_pending_v1", JSON.stringify({ requested_at: new Date().toISOString(), since: new Date(Date.now() - 48 * 3600 * 1000).toISOString(), attempts: 0, manual: true }));
          } catch (e) {}
          toast("正在从账本找回缺失消息，马上重载…");
          setTimeout(() => location.reload(), 600);
        }, disabled: !!busy, className: "mt-3 w-full py-3", style: btnLine }, "从账本找回缺失消息（最近48小时）"),
        h("div", { key: "outnote", style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginTop: 18, lineHeight: 1.6 } },
          "退出登录会先把最新存档同步到云端，然后清空本机数据、回到初始状态。你的数据都在云端，重新登录会自动拉回。"),
        h("button", { key: "out", onClick: doSignOut, disabled: !!busy, className: "mt-2 w-full py-3", style: { ...btnLine, color: "#c0503f" } },
          busy === "out" ? "退出中…" : "退出登录（清空本机数据）")
      ]
    : [
        note("访客模式：不登录也能正常玩，数据只存在本机浏览器。登录后可云端备份、换设备恢复。"),
        h("input", { key: "em", type: "email", inputMode: "email", autoComplete: "email", placeholder: "邮箱", value: email, onChange: e => setEmail(e.target.value), className: "mt-4", style: field }),
        h("input", { key: "pw", type: "password", autoComplete: "current-password", placeholder: "密码（至少 6 位）", value: pw, onChange: e => setPw(e.target.value), className: "mt-3", style: field }),
        h("div", { key: "btns", className: "flex gap-3 mt-3" },
          h("button", { onClick: doSignIn, disabled: !!busy, className: "flex-1 py-3", style: btnDark }, busy === "in" ? "登录中…" : "登录"),
          h("button", { onClick: doSignUp, disabled: !!busy, className: "flex-1 py-3", style: btnLine }, busy === "up" ? "注册中…" : "注册"))
      ];

  return h("div", { className: "pt-6 pb-6", style: { borderBottom: `1px solid ${t.line}` } },
    label("云备份"), ...inner,
    h(PushCard, { loggedIn: !!user }));
}
// 锁屏推送（v48.33）：这台设备订阅后，锁屏能收到「TA 给你留了消息」。
// v54.67 拆掉云端定时信之后这块【继续留着】——发信端是 VPS 上常驻的 push-sender(:8792)，
// 言秋从 CC 推消息走的就是它；订阅信息存 push_subs 表。公钥粘在这里，私钥只住在服务端。
function PushCard({ loggedIn }) {
  const t = useTheme();
  const [vapid, setVapid] = useState(() => loadJSON("x_pushVapid", ""));
  const [st, setSt] = useState("…");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [priv, setPriv] = useState(""); // 生成出来的私钥（只在本地显示、供复制到 Supabase secrets，绝不落盘不上云）
  useEffect(() => {
    let al = true;
    if (window.Cloud && window.Cloud.pushStatus) window.Cloud.pushStatus().then(s => { if (al) setSt(s); });
    return () => { al = false; };
  }, []);
  const saveKey = v => { setVapid(v); saveJSON("x_pushVapid", v.trim()); };
  // 本地生成一对 VAPID 密钥（Web Crypto，ECDSA P-256）——不用装 node、私钥从不离开你这台机器（v48.40，她没装 npx）。
  // 公钥自动填进上面输入框；私钥显示出来供你复制进 Supabase 函数的 secrets（VAPID_PRIVATE）。
  const genKeys = async () => {
    setMsg("");
    try {
      if (!(window.crypto && crypto.subtle)) { setMsg("❌ 这个环境不支持本地生成，换个浏览器或用 npx web-push generate-vapid-keys"); return; }
      const kp = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
      const raw = new Uint8Array(await crypto.subtle.exportKey("raw", kp.publicKey)); // 65 字节未压缩公钥点
      const jwk = await crypto.subtle.exportKey("jwk", kp.privateKey); // jwk.d 已是 base64url 私钥
      const b64u = u8 => btoa(String.fromCharCode.apply(null, u8)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      saveKey(b64u(raw));
      setPriv(jwk.d || "");
      setMsg("✅ 生成好了。公钥已自动填进上面（也会随云同步）。下面是私钥——去 VPS 上 push-sender 的 .env 里加两条：VAPID_PUBLIC=上面的公钥、VAPID_PRIVATE=下面的私钥。私钥只在这显示这一次，复制走、别泄露、别进 git。");
    } catch (e) { setMsg("❌ 生成失败：" + String((e && e.message) || e)); }
  };
  const turnOn = async () => {
    setBusy(true); setMsg("");
    try {
      await window.Cloud.pushSubscribe(vapid);
      setSt("on");
      setMsg("✅ 这台设备已订阅。发信员推消息时锁屏就能收到通知。每台设备各订各的，手机也要开一次。");
    } catch (e) { setMsg("❌ " + String((e && e.message) || e)); }
    finally { setBusy(false); }
  };
  const turnOff = async () => {
    setBusy(true); setMsg("");
    try { await window.Cloud.pushUnsubscribe(); setSt("off"); setMsg("已关闭这台设备的推送订阅。"); } catch (e) {}
    finally { setBusy(false); }
  };
  return h("div", { style: { marginTop: 20, paddingTop: 16, borderTop: "1px dashed " + t.line } },
    h("div", { className: "flex items-center justify-between" },
      h("div", null,
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15, color: t.ink } }, "锁屏推送 · 锁屏也能叫醒你"),
        h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginTop: 2, lineHeight: 1.5 } }, "订阅后，角色那边有消息可以直接推到锁屏——不用先打开 app。")),
      h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: st === "on" ? "#5a7d5a" : t.fog, flexShrink: 0 } }, st === "on" ? "● 已订阅" : st === "unsupported" ? "不支持" : "未订阅")),
    st === "unsupported"
      ? h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginTop: 8, lineHeight: 1.6 } }, "这个浏览器环境不支持推送。iPhone 要先「添加到主屏幕」、再从主屏图标打开（iOS 16.4+）才有这能力。")
      : h("div", { style: { marginTop: 10 } },
          h("input", { value: vapid, onChange: e => saveKey(e.target.value), placeholder: "VAPID 公钥（没有就点下面「生成一对」）", style: { width: "100%", outline: "none", padding: "9px 12px", borderRadius: 10, fontFamily: "monospace", fontSize: 11, background: t.bg2, color: t.ink, border: "1px solid " + t.line } }),
          h("button", { onClick: genKeys, className: "active:opacity-70", style: { marginTop: 8, fontFamily: F_BODY, fontSize: 12, color: t.tint } }, "🔑 没有公钥？点这本地生成一对（不用装任何东西）"),
          priv ? h("div", { style: { marginTop: 8, padding: "9px 11px", borderRadius: 10, background: t.bg2, border: "1px solid " + t.line } },
            h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginBottom: 4 } }, "私钥（复制进 push-sender 的 VAPID_PRIVATE，别泄露、别进 git）："),
            h("div", { style: { fontFamily: "monospace", fontSize: 10.5, color: t.ink, wordBreak: "break-all", userSelect: "text", WebkitUserSelect: "text", lineHeight: 1.5 } }, priv)) : null,
          h("div", { className: "flex gap-3", style: { marginTop: 8 } },
            st === "on"
              ? h("button", { onClick: turnOff, disabled: busy, className: "flex-1 py-2.5 active:opacity-70", style: { borderRadius: 10, border: "1px solid " + t.line, fontFamily: F_BODY, fontSize: 13, color: t.sub } }, busy ? "…" : "关闭这台设备的推送")
              : h("button", { onClick: turnOn, disabled: busy, className: "flex-1 py-2.5 active:opacity-70", style: { borderRadius: 10, background: t.ink, color: t.bg2, fontFamily: F_BODY, fontSize: 13 } }, busy ? "订阅中…" : (loggedIn ? "开启锁屏推送" : "开启（要先登录云同步）"))),
          msg ? h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: msg.startsWith("✅") ? "#5a7d5a" : "#c25a4a", marginTop: 8, lineHeight: 1.6, userSelect: "text", WebkitUserSelect: "text" } }, msg) : null));
}
// 本地存储占用条：localStorage 约 5MB 上限（图片吃大头），快满时红色预警——防「悄悄写满丢数据」
// 存储 key → 人话名称（谁占地方一眼看懂）；前缀匹配，最长优先
const STORAGE_KEY_LABELS = [
  ["x_goffline:", "群聊线下记录"], ["x_offline:", "单人线下记录"], ["x_chat:", "聊天记录"], ["x_gchat:", "群聊记录"], ["x_emotePacks", "表情包"], ["x_emojiPacks", "表情包"], ["x_emoji", "表情包"],
  ["x_wallpaper", "壁纸"], ["x_moments", "朋友圈"], ["x_characters", "角色档案·人设(图片已迁图库)"], ["x_profile", "我的档案(图片已迁图库)"],
  ["x_memLib", "记忆库"], ["x_memories", "长期记忆"], ["x_diaries", "日记"],
  ["x_weekly_issues", "周刊往期"], ["x_study_sessions", "一起学会话"], ["x_read_books", "一起读书架与批注"],
  ["x_debate_saves", "擂台存档"], ["x_dream_saves", "梦境存档"], ["x_tarot_saves", "塔罗存档"], ["x_trpg", "跑团存档"], ["x_ledger", "记账本"],
  ["x_forumPosts", "论坛帖子"], ["x_forumComments", "论坛评论"], ["x_fanfic", "同人文"],
  ["x_phone", "查手机"], ["x_charWallet", "角色钱包"],
  ["x_carry", "随身物"], ["x_selfie", "自拍(缩略)"], ["x_coupleExDiary", "交换日记"],
  ["x_capsule", "时光胶囊"], ["x_schedules", "角色日程"], ["x_promises", "角色说好要回来找你的约"], ["x_calEvents", "日历里手填的日程"], ["x_couple", "情侣空间"],
  ["x_memo", "备忘录"], ["x_read", "一起读"], ["x_study", "一起学"], ["x_desires", "心上"],
  ["x_stateHist", "心声·状态历史"], ["x_states", "当前状态"], ["x_desires", "心上"],
  ["x_lore", "世界书"], ["x_geo", "定位"], ["x_wx", "天气缓存"]
];
function storageBreakdown() {
  const rows = {};
  const labelFor = k => {
    for (const [pfx, name] of STORAGE_KEY_LABELS) { if (k.indexOf(pfx) === 0) return name; }
    return k.indexOf("x_") === 0 ? "其他·" + k.slice(2) : "系统/其他";
  };
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i); if (!k) continue;
      const bytes = (k.length + (localStorage.getItem(k) || "").length) * 2;
      const label = labelFor(k);
      rows[label] = (rows[label] || 0) + bytes;
    }
    // 大文本已搬进 IDB，不再出现在 localStorage；单列“文字金库”才能看见它们各自的体积。
    if (window.__txtMirror) window.__txtMirror.forEach((v, k) => {
      if (v == null || localStorage.getItem(k) != null) return; // 迁移 journal 尚在时不重复统计
      const label = labelFor(k) + "（文字金库）", bytes = (String(k).length + String(v).length) * 2;
      rows[label] = (rows[label] || 0) + bytes;
    });
  } catch (e) {}
  return Object.keys(rows).map(name => ({ name, bytes: rows[name] })).sort((a, b) => b.bytes - a.bytes);
}
// 找回失联的角色（v61.63，2026-09-04 事故之后加的）
// ────────────────────────────────────────────────
// 那天丢了三个角色。丢的其实只是【角色档案】——它住在 saves 那一份 blob 里，
// 被一台过期设备的旧存档整份盖掉了。但记忆和聊天归档【不在那份 blob 里】：
//   · memories 是行表，每一行自己带 char_ids
//   · chat_archive 按 char_id 一行，只追加、按 id 去重
// 所以那三个人的记忆和旧聊天其实都还在云上，只是【没有人认领它们了】。
//
// 这一页干的就是认领：把云端记忆里出现过、本机却找不到的 char_id 找出来，
// 连着它剩下多少条记忆、多少条归档聊天、最近说的几句一起摆出来，
// 让她用【同一个 id】把角色重建回去——id 一对上，记忆和聊天自己就接回来了。
//
// ⚠️人设本身是真的没了（全 app 只有 saves 里存过一份）。这里只能把周围的东西还给她，
//   记忆那几条正是重写人设时最好的材料。别假装能还原人设。
function LostCharacterRescue({ characters, onRescue, toast }) {
  const t = useTheme();
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const [names, setNames] = useState({});
  const scan = async () => {
    if (busy) return;
    setBusy(true); setErr("");
    try {
      const mem = await window.Cloud.memoryRowsFetchAll();
      const byId = new Map((characters || []).map(c => [String(c.id), c]));
      // ⚠️必须走 loadJSON：x_memLib 早就搬进 IDB 文字仓了，localStorage 里那份是空的/过期的
      let lib = []; try { lib = loadJSON("x_memLib", []); } catch (e) {}
      const haveMem = new Set((lib || []).filter(x => x && x.id).map(x => String(x.id)));
      const bag = new Map();
      (mem || []).forEach(m => {
        if (m && m.deleted) return;
        ((m && m.char_ids) || []).forEach(raw => {
          const id = String(raw || "");
          if (!id) return;
          const e = bag.get(id) || { id: id, here: byId.get(id) || null, memCount: 0, missing: 0, lastTs: 0, samples: [], archived: null };
          e.memCount++;
          if (!haveMem.has(String(m.id))) {
            e.missing++;
            if (e.samples.length < 5 && m.text) e.samples.push(String(m.text));
          }
          const ts = Number(m.ts) || 0;
          if (ts > e.lastTs) e.lastTs = ts;
          bag.set(id, e);
        });
      });
      // ⚠️v61.75：本机已经有的角色【不能直接跳过】。她上一版把三个人建回来了，
      //   于是这一页再也扫不到他们——而记忆压根没接上，等于永远没救。
      //   判据要从「这个人在不在」换成「TA 的记忆到齐了没有」。
      const list = [...bag.values()].filter(e => !e.here || e.missing > 0)
        .sort((a, b) => b.missing - a.missing || b.memCount - a.memCount);
      for (const e of list) {
        try { e.archived = (await window.Cloud.chatArchiveGet(e.id)).length; } catch (x) { e.archived = null; }
      }
      setRows(list);
      if (!list.length) toast && toast("都齐了：云端每个人的记忆本机都有");
    } catch (e) {
      setErr(String((e && e.message) || e));
    } finally { setBusy(false); }
  };
  // 建回来是【两步】：角色落档 + 把 TA 的记忆行从云端捞回本地。
  // 只做第一步的话，扫描页明明列着两百条记忆，建完却一条都没有——
  // 因为那两百条是直接问云端要的，而聊天真正读的是本机那份 x_memLib（v61.74 她报的就是这个）。
  const [doneMap, setDoneMap] = useState({});
  const rebuild = async e => {
    // 人已经在本机了：不用再填名字，这一次只是去把记忆和归档接回来
    const name = e.here ? String(e.here.name || "") : String(names[e.id] || "").trim();
    if (!e.here && !name) { toast && toast("先给 TA 填个名字"); return; }
    setDoneMap(d => ({ ...d, [e.id]: { busy: true } }));
    const r = await Promise.resolve(onRescue({ id: e.id, name: (name || "").slice(0, 20), persona: "", tagline: "", color: "#5a6a7d" }))
      .catch(err => ({ error: String((err && err.message) || err) }));
    setDoneMap(d => ({ ...d, [e.id]: { name: name, added: (r && r.added) || 0, arch: (r && r.arch) || 0, back: (r && r.back) || 0, error: r && r.error } }));
  };
  const line = (k, v) => h("span", { key: k, style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog } }, v);
  const card = e => {
    const done = doneMap[e.id];
    const action = done && !done.busy
      ? h("div", { style: { marginTop: 11, padding: "9px 11px", borderRadius: 9, background: t.bg, border: "1px solid " + t.line, fontFamily: F_BODY, fontSize: 12, color: t.sub, lineHeight: 1.6 } },
          done.error
            ? "「" + done.name + "」建回来了，但记忆没捞下来——检查一下网络，再点一次「扫一遍云端」重试。"
            : "✓ 「" + done.name + "」接回 " + done.added + " 条记忆" +
              (done.back ? "、最近 " + done.back + " 条聊天铺回本地（TA 现在收得到）" : "") +
              (done.arch - done.back > 0 ? "，还有 " + (done.arch - done.back) + " 条在云上（点「加载更早」看）" : "") +
              (e.here ? "。" : "。去人格档案馆补人设和头像。"))
      : h("div", { style: { marginTop: 11, display: "flex", gap: 8 } },
          e.here ? null : h("input", {
            value: names[e.id] || "", onChange: ev => setNames(n => ({ ...n, [e.id]: ev.target.value })), placeholder: "TA 叫什么",
            style: { flex: 1, minWidth: 0, outline: "none", padding: "8px 11px", borderRadius: 9, fontFamily: F_BODY, fontSize: 13, background: t.bg, color: t.ink, border: "1px solid " + t.line }
          }),
          h("button", {
            onClick: () => rebuild(e), disabled: !!(done && done.busy), className: "active:opacity-70 shrink-0 disabled:opacity-50",
            style: { padding: "8px 14px", borderRadius: 9, fontFamily: F_BODY, fontSize: 13, color: "#fff", background: t.tint, flex: e.here ? 1 : "0 0 auto" }
          }, done && done.busy ? "接回中…" : (e.here ? "把 " + e.missing + " 条记忆接回来" : "建回来")));
    return h("div", { key: e.id, style: { border: "1px solid " + t.line, borderRadius: 12, padding: "13px 14px", background: t.bg2 } },
      e.here ? h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15, color: t.ink } }, e.here.name,
        h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: t.tint, marginLeft: 8 } }, "人在，记忆没接上")) : null,
      h("div", { style: { fontFamily: "monospace", fontSize: 11, color: t.sub, wordBreak: "break-all", userSelect: "text", WebkitUserSelect: "text", marginTop: e.here ? 4 : 0 } }, e.id),
      h("div", { style: { marginTop: 6, display: "flex", flexWrap: "wrap", gap: "4px 12px" } },
        line("m", "云端 " + e.memCount + " 条记忆，本机缺 " + e.missing + " 条"),
        line("a", e.archived == null ? "归档聊天读不到" : e.archived + " 条归档聊天"),
        line("t", e.lastTs ? "最近一条 " + new Date(e.lastTs).toLocaleDateString() : "没有时间")),
      e.samples.length ? h("div", { style: { marginTop: 9, paddingLeft: 10, borderLeft: "2px solid " + t.line, display: "flex", flexDirection: "column", gap: 5 } },
        e.samples.map((x, k) => h("div", { key: k, style: { fontFamily: F_BODY, fontSize: 11.5, color: t.sub, lineHeight: 1.6, userSelect: "text", WebkitUserSelect: "text" } }, x.slice(0, 90)))) : null,
      action);
  };
  return h("div", { style: { paddingTop: 8 } },
    h("div", { style: { fontFamily: F_BODY, fontSize: 12, lineHeight: 1.7, color: t.fog } },
      "角色档案被覆盖掉之后，TA 的记忆和归档聊天其实还留在云上，只是没人认领了。这里列两种人：本机压根没有的（用同一个 id 建回去），和人已经在、记忆却没接上的（直接把缺的那几条捞回来）。",
      h("br"), h("br"),
      "⚠️ 人设本身只存在被覆盖的那一份里，找不回来了。下面列出的记忆是重写人设最好的材料。"),
    h("button", { onClick: scan, disabled: busy, className: "w-full py-3 active:opacity-70 disabled:opacity-50",
      style: { marginTop: 12, fontFamily: F_BODY, fontSize: 13, borderRadius: 7, color: t.bg2, background: t.ink } },
      busy ? "正在翻云端…" : "扫一遍云端"),
    err ? h("div", { style: { marginTop: 10, fontFamily: F_BODY, fontSize: 11.5, color: "#c25a4a", lineHeight: 1.6 } }, "扫描失败：" + err + "（先确认已登录云同步）") : null,
    rows && !rows.length ? h("div", { style: { marginTop: 12, fontFamily: F_BODY, fontSize: 12, color: t.fog } }, "都齐了：云端每个人的记忆本机都有。") : null,
    rows && rows.length ? h("div", { style: { marginTop: 14, display: "flex", flexDirection: "column", gap: 12 } }, rows.map(card)) : null);
}

function StorageMeter({ onOffloadChats, onPruneOld }) {
  const t = useTheme();
  const [info, setInfo] = useState(null);
  const [detail, setDetail] = useState(false);
  const [offloading, setOffloading] = useState(false);
  const refresh = () => {
    const ls = (typeof localStorageBytes === "function") ? localStorageBytes() : 0;
    const LIMIT = 5 * 1024 * 1024;
    const rows = storageBreakdown();
    if (navigator.storage && navigator.storage.estimate) {
      navigator.storage.estimate().then(est => setInfo({ ls: ls, lim: LIMIT, idbUsed: est.usage || 0, idbQuota: est.quota || 0, rows: rows })).catch(() => setInfo({ ls: ls, lim: LIMIT, rows: rows }));
    } else setInfo({ ls: ls, lim: LIMIT, rows: rows });
  };
  useEffect(refresh, []);
  if (!info) return null;
  const pct = Math.min(100, Math.round(info.ls / info.lim * 100));
  const near = pct >= 80;
  const mb = n => (n / 1048576).toFixed(1);
  const kb = n => n >= 102400 ? (n / 1048576).toFixed(2) + " MB" : Math.round(n / 1024) + " KB";
  const rows = info.rows || [];
  const maxB = rows.length ? rows[0].bytes : 1;
  return h("div", { style: { marginBottom: 20, padding: "14px 15px", background: t.bg2, border: "1px solid " + (near ? "#c25a4a" : t.line), borderRadius: 12 } },
    h("div", { className: "flex items-center justify-between", style: { marginBottom: 8 } },
      h("span", { style: { fontFamily: F_DISPLAY, fontSize: 14, color: t.ink } }, "本地存储占用"),
      h("span", { style: { fontFamily: F_BODY, fontSize: 12, color: near ? "#c25a4a" : t.fog } }, mb(info.ls) + " / ~5 MB（" + pct + "%）")),
    h("div", { style: { height: 8, borderRadius: 999, background: t.line, overflow: "hidden" } },
      h("div", { style: { width: pct + "%", height: "100%", borderRadius: 999, background: near ? "#c25a4a" : (pct >= 60 ? "#b89150" : t.tint), transition: "width .3s" } })),
    h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginTop: 8, lineHeight: 1.6 } },
      near ? "⚠️ 快满了！点下面「看谁占地方」找出大头。图片(头像/壁纸/朋友圈/聊天图)已自动迁到 IndexedDB 图库、不占这 5MB；剩下占地方的多是文字（聊天记录/同人文/人设）。可删旧聊天、或导出备份后清理。满了新消息会存不进、可能丢。"
        : "这里只存文字（上限约 5MB）——图片已自动迁到浏览器图库、不占这里。占大头的是聊天记录和文本内容。快满时 app 会提前弹警告。"),
    // 聊天云归档：把旧聊天挪去云端、释放本地（登录云同步才有；先确认云端存好才裁本地=零丢失）
    onOffloadChats ? h("button", {
      onClick: async () => { if (offloading) return; setOffloading(true); try { await onOffloadChats(); } finally { setOffloading(false); refresh(); } },
      disabled: offloading, className: "w-full active:opacity-80 disabled:opacity-50",
      style: { fontFamily: F_BODY, fontSize: 12.5, color: "#fff", background: t.tint, borderRadius: 10, padding: "9px 0", marginTop: 12 }
    }, offloading ? "归档中…" : "☁️ 归档旧聊天到云端 · 释放本地空间") : null,
    onOffloadChats ? h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 5, lineHeight: 1.5 } }, "普通云同步只是备份，不会腾本机；这里会在占用≥80%时每天自动安全归档一次，也可立即手动运行。云端确认后才裁本机：平时每个会话留最近 1000 条，≥80%留 600 条，≥90%留 400 条；裁掉的仍可在聊天页「加载更早」。") : null,
    // 一键清理可再生旧数据（旧日程点开自动重生、旧论坛帖）——绝不碰聊天/线下/记忆库/同人文
    onPruneOld ? h("button", {
      onClick: () => { onPruneOld(); setTimeout(refresh, 300); },
      className: "w-full active:opacity-80",
      style: { fontFamily: F_BODY, fontSize: 12.5, color: t.ink, background: "transparent", border: "1px solid " + t.line, borderRadius: 10, padding: "9px 0", marginTop: 8 }
    }, "🧹 清理可再生旧数据（旧日程 + 旧论坛）") : null,
    onPruneOld ? h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 5, lineHeight: 1.5 } }, "只清超过 14 天的旧日程（点开自动重新生成）和最旧的论坛帖；你的聊天、线下记录、记忆库、同人文一个都不动。") : null,
    // 明细：谁占地方一眼看穿
    h("button", { onClick: () => { setDetail(d => !d); refresh(); }, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 11.5, color: t.tint, marginTop: 10 } }, detail ? "收起明细 ▴" : "看谁占地方 ▾"),
    detail ? h("div", { style: { marginTop: 8, display: "flex", flexDirection: "column", gap: 6 } },
      rows.slice(0, 12).map(r => h("div", { key: r.name },
        h("div", { className: "flex items-center justify-between", style: { marginBottom: 2 } },
          h("span", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.ink } }, r.name),
          h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: r.name.indexOf("（文字金库）") < 0 && r.bytes >= 512000 ? "#c25a4a" : t.fog } }, kb(r.bytes) + (r.name.indexOf("（文字金库）") >= 0 ? " · IDB" : " · " + Math.round(r.bytes / info.ls * 100) + "%"))),
        h("div", { style: { height: 3, borderRadius: 999, background: t.line, overflow: "hidden" } },
          h("div", { style: { width: Math.max(2, Math.round(r.bytes / maxB * 100)) + "%", height: "100%", borderRadius: 999, background: r.name.indexOf("（文字金库）") >= 0 ? t.tint : (r.bytes >= 512000 ? "#c25a4a" : (r.bytes >= 204800 ? "#b89150" : t.tint)) } })))),
      h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 4, lineHeight: 1.6 } }, "红=localStorage 大头(≥0.5MB)；标有「文字金库」的项目住在 IDB，不挤占 5MB。聊天记录最大又会一直涨——用上面「归档旧聊天到云端」最省地方。")) : null,
    info.idbQuota ? h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 6 } }, "音频 / 自拍 / 书正文另存在 IndexedDB（已用 " + mb(info.idbUsed) + " MB，空间大得多、不占这 5MB）") : null);
}
function LocalPhotoLibrary({ toast }) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState([]);
  const [preview, setPreview] = useState(null);
  const [shareCaption, setShareCaption] = useState("");
  const [sharing, setSharing] = useState(false);
  const ref = useRef(null);
  const refresh = async () => setRows(await idbAlbumEntries());
  useEffect(() => { if (open) refresh(); }, [open]);
  useEffect(() => { setShareCaption(preview && preview.caption || ""); }, [preview && preview.imageRef]);
  const add = async e => {
    const f = e.target.files && e.target.files[0]; e.target.value = ""; if (!f) return;
    try {
      const dataUrl = await resizeImageFile(f, 1600, 0.86);
      const imageRef = await imgToVault(dataUrl);
      await rememberRealPhoto(imageRef, "", "album");
      await refresh(); toast && toast("已放进本机照片库");
    } catch (err) { toast && toast("这张照片没能读出来，换一张试试"); }
  };
  return h("div", { style: { margin: "18px 0", border: "1px solid " + t.line, borderRadius: 12, padding: 14 } },
    h("div", { className: "flex items-center justify-between" },
      h("button", { onClick: () => setOpen(v => !v), style: { fontFamily: F_DISPLAY, fontSize: 15, color: t.ink } }, "本机照片库 · " + rows.length + (open ? " ▴" : " ▾")),
      h("button", { onClick: () => ref.current && ref.current.click(), style: { fontFamily: F_BODY, fontSize: 12, color: t.tint } }, "＋ 添加照片")),
    h("input", { ref, type: "file", accept: "image/*", className: "hidden", onChange: add }),
    h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 6, lineHeight: 1.55 } }, "聊天里发过的真实照片会自动归到这里。像素只在本机图库，不会自动上传云端；移出照片库也不会删掉聊天里的图。"),
    open ? h("div", { style: { display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 7, marginTop: 12 } },
      rows.length ? rows.map(r => h("button", { key: r.imageRef, onClick: () => setPreview(r), style: { position: "relative", aspectRatio: "1", borderRadius: 8, overflow: "hidden", background: t.line } }, h("img", { src: resolveImg(r.imageRef), alt: r.caption || "本机照片", style: { width: "100%", height: "100%", objectFit: "cover" } }), r.bridgeId ? h("span", { style: { position: "absolute", right: 4, bottom: 4, fontSize: 15, filter: "drop-shadow(0 1px 2px rgba(0,0,0,.45))" } }, "📮") : null)) : h("div", { style: { gridColumn: "1 / -1", fontFamily: F_BODY, fontSize: 12, color: t.fog, padding: "18px 0", textAlign: "center" } }, "还没有真实照片")) : null,
    preview ? h("div", { className: "fixed inset-0 z-50 flex items-center justify-center", onClick: () => setPreview(null), style: { background: "rgba(0,0,0,.82)", padding: 20 } },
      h("div", { onClick: e => e.stopPropagation(), style: { width: "100%", maxWidth: 520 } },
        h("img", { src: resolveImg(preview.imageRef), alt: preview.caption || "照片", style: { width: "100%", maxHeight: "70vh", objectFit: "contain", borderRadius: 10 } }),
        h("textarea", { value: shareCaption, onChange: e => setShareCaption(e.target.value), maxLength: 500, placeholder: "分享给言秋前，写一句这张照片是什么…", style: { width: "100%", minHeight: 66, marginTop: 10, borderRadius: 8, padding: 10, background: "rgba(255,255,255,.12)", color: "#fff", fontFamily: F_BODY, fontSize: 13, outline: "none" } }),
        h("button", { disabled: sharing || (!preview.bridgeId && !shareCaption.trim()), onClick: async () => {
          if (sharing) return; setSharing(true);
          try {
            if (preview.bridgeId) {
              if (!(window.Cloud && window.Cloud.photoBridgeRetract)) throw new Error("照片桥还没加载好，请刷新后重试");
              await window.Cloud.photoBridgeRetract(preview.bridgeId, preview.bridgePath);
              await idbAlbumPut(Object.assign({}, preview, { bridgeId: null, bridgePath: null, bridgeExpiresAt: null }));
              toast && toast("已撤回，言秋不能再从照片桥读取");
            } else {
              if (!(window.Cloud && window.Cloud.photoBridgeShare)) throw new Error("照片桥还没加载好，请刷新后重试");
              const blob = await idbVaultGet(preview.imageRef); if (!blob) throw new Error("本机照片像素不存在");
              const row = await window.Cloud.photoBridgeShare({ blob, caption: shareCaption.trim(), source: preview.source, takenAt: new Date(preview.createdAt || Date.now()).toISOString() });
              await idbAlbumPut(Object.assign({}, preview, { caption: shareCaption.trim(), bridgeId: row.id, bridgePath: row.storage_path, bridgeExpiresAt: row.expires_at }));
              toast && toast("📮 已交给言秋看，90 天后自动到期");
            }
            setPreview(null); await refresh();
          } catch (e) { toast && toast("照片桥失败：" + (e.message || e)); } finally { setSharing(false); }
        }, className: "w-full", style: { color: "#fff", background: preview.bridgeId ? "rgba(190,90,75,.75)" : "rgba(92,142,128,.9)", borderRadius: 8, fontFamily: F_BODY, fontSize: 13, padding: 11, marginTop: 8, opacity: sharing ? .55 : 1 } }, sharing ? "处理中…" : (preview.bridgeId ? "撤回给言秋看的照片" : "📮 给言秋看")),
        h("button", { onClick: async () => { await idbAlbumDel(preview.imageRef); setPreview(null); await refresh(); }, className: "w-full", style: { color: "#fff", fontFamily: F_BODY, fontSize: 12, padding: 12, marginTop: 8 } }, "仅移出本机照片库"))) : null);
}
// 主屏排查：直接读盘上的 x_homeLayout / x_homeFolders，告诉她某个 app 现在到底在哪儿。
// 她 2026-08-30 报「整理出来就找不到了」，而导出整包在 iOS PWA 上又导不出来——
// 排查不能卡在「拿不到她那份数据」上，所以这里给一条不依赖文件的路：看得见、复制得走。
function HomeLayoutProbe({ toast }) {
  const t = useTheme();
  const [text, setText] = useState("");
  const build = () => {
    let L = {}, F = {}, S = {};
    try { L = JSON.parse(localStorage.getItem("x_homeLayout") || "{}"); } catch (e) {}
    try { F = JSON.parse(localStorage.getItem("x_homeFolders") || "{}"); } catch (e) {}
    // ⚠️自定义尺寸也要一起导（v61.99）：同样是 4×1，「原大小」和「自己挑的长条」
    // 走的是两条路——排查这类「明明有空位却放不下」时，少了这一份就查不出来。
    try { S = JSON.parse(localStorage.getItem("x_homeWidgetSizes") || "{}"); } catch (e) {}
    const lines = [];
    const pages = Object.keys(L).map(Number).filter(n => !isNaN(n)).sort((a, b) => a - b);
    pages.forEach(n => {
      const arr = (L[n] || []).filter(k => !/^sp_/.test(k));
      lines.push("第" + (n + 1) + "页(" + arr.length + ")：" + arr.join(" "));
    });
    Object.keys(F).forEach(fid => {
      const placed = pages.some(n => (L[n] || []).indexOf(fid) >= 0);
      lines.push("文件夹「" + (F[fid].name || "") + "」" + (placed ? "" : "（没摆在任何页上）") + "：" + (F[fid].keys || []).join(" "));
    });
    const sk = Object.keys(S);
    if (sk.length) lines.push("自己挑过尺寸的：" + sk.map(k => k + "=" + S[k]).join(" "));
    // 每一页真占几行（按当前尺寸算），一眼看出是不是顶到额度了
    try {
      if (typeof window.homePlaceDenseXY === "function" && typeof window.homeItemSpan === "function") {
        pages.forEach(n => {
          const rows = window.homePlaceDenseXY(L[n] || [], k => window.homeSpanForProbe ? window.homeSpanForProbe(k) : null).rows;
          if (rows) lines.push("第" + (n + 1) + "页占 " + rows + " 行");
        });
      }
    } catch (e) {}
    return lines.join("\n") + "\n\n" + JSON.stringify({ x_homeLayout: L, x_homeFolders: F, x_homeWidgetSizes: S });
  };
  const go = async () => {
    const s = build();
    setText(s);
    try { await navigator.clipboard.writeText(s); toast && toast("主屏布局已复制，直接粘给言秋"); }
    catch (e) { toast && toast("复制不了，长按下面那段自己选"); }
  };
  return h("div", null,
    h("button", { onClick: go, className: "w-full py-3 active:opacity-70",
      style: { marginTop: 10, fontFamily: F_BODY, fontSize: 13, borderRadius: 7, color: t.ink, background: "transparent", border: "1px solid " + t.line } },
      "复制主屏布局（排查图标不见了 / 有空位却放不下）"),
    text ? h("textarea", { readOnly: true, value: text, rows: 8, onFocus: e => e.target.select(),
      style: { width: "100%", marginTop: 8, padding: 8, borderRadius: 7, border: "1px solid " + t.line,
        background: t.bg2, color: t.ink, fontFamily: "ui-monospace,monospace", fontSize: 11, lineHeight: 1.5 } }) : null);
}
function DataConfig({
  characters,
  onExport,
  onImport,
  onOffloadChats,
  onPruneOld,
  onClearAll,
  onRescueChar,
  toast
}) {
  const t = useTheme();
  const [c, setC] = useState(false);
  const [part, setPart] = useState("");
  const [innerLifeOpen, setInnerLifeOpen] = useState(false);
  const ref = useRef(null);
  const items = [
    { id: "inner-life", title: "人格试点", sub: "余温、潮汐与角色影响", icon: "◌" },
    { id: "storage", title: "本地空间", sub: "占用、归档与清理", icon: "▥" },
    { id: "photos", title: "本机照片库", sub: "聊天照片与照片桥", icon: "▧" },
    { id: "cloud", title: "云同步", sub: "账号、存档与同步状态", icon: "↻" },
    { id: "backup", title: "导入与导出", sub: "备份与换设备恢复", icon: "⇅" },
    { id: "rescue", title: "找回失联的角色", sub: "档案没了，但记忆和聊天还在云上", icon: "⌕" },
    { id: "danger", title: "危险操作", sub: "不可撤销的数据清理", icon: "!", danger: true }
  ];
  const button = (label, onClick, primary) => h("button", {
    onClick: onClick, className: "w-full py-3 active:opacity-70",
    style: { marginTop: 10, fontFamily: F_BODY, fontSize: 13, borderRadius: 7,
      color: primary ? t.bg2 : t.ink, background: primary ? t.ink : "transparent",
      border: primary ? "none" : "1px solid " + t.line }
  }, label);
  const current = items.find(x => x.id === part);
  let content = null;
  if (part === "inner-life") content = h("div", { style: { paddingTop: 8 } },
    h("div", { style: { fontFamily: F_BODY, fontSize: 12, lineHeight: 1.65, color: t.fog } }, "在这里查看每个角色的余温影响，并一次给全部角色开启前台试点。"),
    button("打开 E 余温与潮汐仪表", () => setInnerLifeOpen(true), true));
  if (part === "storage") content = h(StorageMeter, { onOffloadChats: onOffloadChats, onPruneOld: onPruneOld });
  if (part === "photos") content = h(LocalPhotoLibrary, { toast: toast });
  if (part === "cloud") content = h(CloudSync, { toast: toast });
  if (part === "rescue") content = h(LostCharacterRescue, { characters: characters || [], onRescue: onRescueChar, toast: toast });
  if (part === "backup") content = h("div", { style: { paddingTop: 8 } },
    h("div", { style: { fontFamily: F_BODY, fontSize: 12, lineHeight: 1.65, color: t.fog } }, "数据主要保存在本机浏览器；重要操作前建议先导出一份 JSON。"),
    button("导出全部数据（.json）", onExport, true),
    button("导入备份恢复", () => ref.current && ref.current.click(), false),
    h(HomeLayoutProbe, { toast: toast }),
    h("input", { ref: ref, type: "file", accept: "application/json,.json", className: "hidden", onChange: e => {
      const f = e.target.files && e.target.files[0]; if (f) onImport(f); e.target.value = "";
    } }));
  if (part === "danger") content = h("div", { style: { paddingTop: 8 } },
    !c ? button("清空所有数据", () => setC(true), false) : h("div", null,
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15, color: t.ink, marginBottom: 12 } }, "确定清空全部数据？无法撤销。建议先导出。"),
      h("div", { className: "flex gap-3" },
        h("button", { onClick: () => setC(false), className: "flex-1 py-3", style: { fontFamily: F_BODY, fontSize: 13, border: "1px solid " + t.line, color: t.ink, borderRadius: 6 } }, "取消"),
        h("button", { onClick: onClearAll, className: "flex-1 py-3", style: { fontFamily: F_BODY, fontSize: 13, background: t.accent, color: "#fff", borderRadius: 6 } }, "确定"))));
  return h("div", { style: { paddingTop: 4 } },
    innerLifeOpen ? h(InnerLifeEDiagnosticSheet, { characters: characters || [], onClose: () => setInnerLifeOpen(false) }) : null,
    !part ? h(ConfigTileGrid, null, items.map(item => h(ConfigTile, {
      key: item.id, title: item.title, sub: item.sub, icon: item.icon,
      danger: item.danger, onClick: () => setPart(item.id)
    }))) : h("div", null,
      h("button", { onClick: () => { setPart(""); setC(false); }, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 12, color: t.sub, marginBottom: 14 } }, "← 返回数据管理"),
      h("div", { style: { border: "1px solid " + (current && current.danger ? "rgba(190,90,75,.35)" : t.line), background: t.bg2, borderRadius: 16, padding: "18px 16px" } },
        h(Eyebrow, { style: { marginBottom: 5, color: current && current.danger ? t.accent : t.fog } }, current ? current.title : "数据管理"),
        h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, marginBottom: 10 } }, current ? current.sub : ""),
        content)));
}
// ============================================================
// MEMORY LIBRARY 记忆库
// ============================================================
// ⑥事件层 · 第3步：挑碎片 → 创建候选（status=requested）。
// 铁律（施工图 §3）：创建前从权威行表重读所选 ID（不用本地卡片快照）；2~30 条；
// 缺失/软删/revision 漂移=红灯停下告知，不偷偷跳过；离线不排队。
async function evSha256Hex(s) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map(x => x.toString(16).padStart(2, "0")).join("");
}
function EventComposeSheet({ entries, characters, onClose, onCreated, toast, preselect }) {
  const t = useTheme();
  const [stage, setStage] = useState("pick"); // pick → verify
  const [selChar, setSelChar] = useState(preselect && preselect.charId ? preselect.charId : null);
  // 聚类建议预填：只收还存在于当前碎片列表的 ID，仍可增删，走完整核对流程
  const [selIds, setSelIds] = useState(() => preselect && Array.isArray(preselect.ids)
    ? preselect.ids.filter(id => (entries || []).some(e => e && e.id === id)).slice(0, 30) : []); // 保留勾选顺序
  const [q, setQ] = useState("");
  const [rows, setRows] = useState(null);   // 核对页：权威行表重读结果
  const [problems, setProblems] = useState([]);
  const [busy, setBusy] = useState(false);
  const nameOf = id => { const c = (characters || []).find(x => x.id === id); return c ? (c.remark || c.name) : "？"; };
  const toggle = id => setSelIds(p => p.includes(id) ? p.filter(x => x !== id) : (p.length >= 30 ? p : p.concat([id])));
  const qlc = q.trim().toLowerCase();
  const list = (entries || []).filter(e => e && e.id && e.text && (!qlc || String(e.text).toLowerCase().indexOf(qlc) >= 0));
  const verify = async () => {
    if (!(window.Cloud && window.Cloud.ready())) { toast && toast("云服务未就绪，登录后再来"); return; }
    setBusy(true); setProblems([]);
    try {
      const fetched = await window.Cloud.memoryRowsFetchByIds(selIds);
      const byId = new Map(fetched.map(r => [r.id, r]));
      const probs = [];
      selIds.forEach(id => {
        const r = byId.get(id);
        if (!r) probs.push("云端找不到这条：" + String((entries.find(e => e.id === id) || {}).text || id).slice(0, 30));
        else if (r.deleted) probs.push("这条已被撤回（软删）：" + String(r.text).slice(0, 30));
      });
      setRows(selIds.map(id => byId.get(id)).filter(Boolean));
      setProblems(probs);
      setStage("verify");
    } catch (e) { toast && toast("没连上云端：" + ((e && e.message) || "稍后再试")); }
    finally { setBusy(false); }
  };
  const create = async () => {
    if (problems.length) return;
    setBusy(true);
    try {
      const user = await window.Cloud.getUser();
      if (!user) throw new Error("未登录");
      const revs = {};
      rows.forEach(r => { revs[r.id] = Number(r.revision); });
      const sortedIds = selIds.slice().sort();
      const key = await evSha256Hex(user.id + "|" + selChar + "|" + sortedIds.join(",") + "|" + sortedIds.map(i => i + ":" + revs[i]).join(","));
      const res = await window.Cloud.eventCandidateRequest({
        id: "evc_" + (crypto.randomUUID ? crypto.randomUUID() : Date.now() + "_" + Math.random().toString(16).slice(2)),
        sourceMemoryIds: selIds,
        requestedCharId: selChar,
        baseMemoryRevisions: revs,
        idempotencyKey: key
      });
      toast && toast(res.existed ? "这批选择之前就交过了，沿用原候选" : "已交给 " + nameOf(selChar) + " 执笔，写好会回到这里等你过目");
      onCreated && onCreated();
      onClose();
    } catch (e) { toast && toast("创建没成功：" + ((e && e.message) || "表可能还没部署")); }
    finally { setBusy(false); }
  };
  return h(Sheet, { onClose: onClose },
    h(Eyebrow, { style: { marginBottom: 8 } }, stage === "pick" ? "挑 2~30 条碎片，整理成一件事" : "核对后交给执笔人"),
    stage === "pick" && h(React.Fragment, null,
      h("div", { className: "flex flex-wrap", style: { gap: 6, marginBottom: 8 } }, (characters || []).map(c =>
        h("button", { key: c.id, onClick: () => setSelChar(c.id), className: "active:opacity-70", style: { fontFamily: F_BODY, fontSize: 11.5, padding: "4px 10px", borderRadius: 999, border: "1px solid " + (selChar === c.id ? t.tint : t.line), color: selChar === c.id ? t.tint : t.sub, background: t.bg2 } }, "执笔·" + (c.remark || c.name)))),
      h("input", { value: q, onChange: e => setQ(e.target.value), placeholder: "搜正文…", className: "w-full outline-none px-3 py-2 rounded-lg", style: { fontFamily: F_BODY, fontSize: 12.5, color: t.ink, background: t.bg2, border: "1px solid " + t.line, marginBottom: 8 } }),
      h("div", { style: { maxHeight: "42vh", overflowY: "auto" } }, list.map(e => {
        const on = selIds.includes(e.id);
        return h("button", { key: e.id, onClick: () => toggle(e.id), className: "w-full text-left rounded-lg p-2.5 mb-1.5 active:opacity-70", style: { border: "1px solid " + (on ? t.tint : t.line), background: on ? "rgba(158,130,96,.07)" : t.bg2 } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.ink, lineHeight: 1.55 } }, (on ? "☑ " : "☐ ") + String(e.text).slice(0, 80) + (String(e.text).length > 80 ? "…" : "")),
          h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: t.fog, marginTop: 3 } },
            new Date(e.ts || 0).toLocaleDateString(), e.open ? " · ⏳未了结" : "", e.archived ? " · 🗂已归档" : "", e.pinned ? " · 📌" : ""));
      })),
      h("button", { onClick: verify, disabled: busy || !selChar || selIds.length < 2 || selIds.length > 30, className: "w-full mt-2 py-2.5 active:opacity-70 disabled:opacity-40", style: { borderRadius: 8, background: t.ink, color: t.bg2, fontFamily: F_BODY, fontSize: 13 } },
        busy ? "正在跟云端对账…" : "核对这 " + selIds.length + " 条（需 2~30 条" + (selChar ? "" : "，先选执笔人") + "）")),
    stage === "verify" && h(React.Fragment, null,
      problems.length ? h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: "#9f5149", background: "rgba(159,81,73,.08)", borderRadius: 9, padding: "8px 10px", marginBottom: 8, lineHeight: 1.6 } },
        "🔴 有问题的条目，请返回处理：", h("br"), problems.join("；")) : null,
      h("div", { style: { maxHeight: "40vh", overflowY: "auto", marginBottom: 8 } }, (rows || []).map(r =>
        h("div", { key: r.id, className: "rounded-lg p-2.5 mb-1.5", style: { border: "1px solid " + t.line, background: t.bg2 } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.ink, lineHeight: 1.55 } }, r.text),
          h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: t.fog, marginTop: 3 } },
            new Date(r.ts || 0).toLocaleDateString(), " · rev " + r.revision, (r.tags || []).length ? " · " + r.tags.join("/") : "", r.open ? " · ⏳未了结" : "", r.archived ? " · 🗂已归档" : "")))),
      h("div", { className: "flex", style: { gap: 8 } },
        h("button", { onClick: () => { setStage("pick"); setRows(null); setProblems([]); }, className: "flex-1 py-2.5 active:opacity-70", style: { borderRadius: 8, border: "1px solid " + t.line, color: t.sub, fontFamily: F_BODY, fontSize: 13 } }, "返回改选"),
        h("button", { onClick: create, disabled: busy || !!problems.length, className: "flex-1 py-2.5 active:opacity-70 disabled:opacity-40", style: { borderRadius: 8, background: t.ink, color: t.bg2, fontFamily: F_BODY, fontSize: 13 } }, busy ? "提交中…" : "创建请求，交给执笔人"))));
}

// ⑥事件层 · 第5步：候选过目台——预览草稿/编辑（存本地确认载荷）/退回/拒绝。
// 红灯规则（施工图 §5）：来源缺失/软删/revision 漂移、状态不是 drafted、草稿引用候选外 ID
// → 确认按钮禁用，没有"仍然继续"。正式确认走第 6 步原子 RPC（未部署时按钮同样禁用）。
const K_EVC_EDITS = "x_evcEdits"; // { [candidateId]: {title,synopsis,narrative,editedAt} } —— 你的修改稿，确认时才随 RPC 落库
const K_EVC_ACCEPT_MUTATIONS = "x_evcAcceptMutations"; // 网络超时重试沿用同一 UUID，RPC 才能安全返回同一事件
function CandidateReviewSheet({ candidateId, characters, onClose, onChanged, toast }) {
  const t = useTheme();
  const [cand, setCand] = useState(null);
  const [srcRows, setSrcRows] = useState([]);
  const [lights, setLights] = useState(null); // null=加载中
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const edits = loadJSON(K_EVC_EDITS, {})[candidateId] || null;
  const [eTitle, setETitle] = useState("");
  const [eSyn, setESyn] = useState("");
  const [eNarr, setENarr] = useState("");
  const nameOf = id => { const c = (characters || []).find(x => x.id === id); return c ? (c.remark || c.name) : "？"; };
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const c = await window.Cloud.eventCandidateGet(candidateId);
        if (!alive) return;
        if (!c) { setLights(["候选不存在或不属于当前账号"]); return; }
        setCand(c);
        const d = c.draft;
        const cur = loadJSON(K_EVC_EDITS, {})[candidateId];
        setETitle((cur && cur.title) || (d && d.title) || "");
        setESyn((cur && cur.synopsis) || (d && d.synopsis) || "");
        setENarr((cur && cur.narrative) || (d && d.narrative) || "");
        const ids = c.source_memory_ids || [];
        const rows = await window.Cloud.memoryRowsFetchByIds(ids);
        if (!alive) return;
        const byId = new Map(rows.map(r => [r.id, r]));
        setSrcRows(ids.map(id => byId.get(id)).filter(Boolean));
        const base = c.base_memory_revisions || {};
        const L = [];
        if (c.status !== "drafted") L.push(c.status === "requested" ? "还在等执笔（requested）" : "候选状态是 " + c.status);
        if (!d) L.push("还没有草稿");
        ids.forEach(id => {
          const r = byId.get(id);
          if (!r) L.push("来源碎片在云端缺失：" + id);
          else if (r.deleted) L.push("来源碎片已被软删：" + String(r.text || id).slice(0, 24));
          else if (base[id] != null && Number(base[id]) !== Number(r.revision)) L.push("来源碎片被改过（revision 漂移）：" + String(r.text || id).slice(0, 24));
        });
        if (d && Array.isArray(d.links) && d.links.some(l => !ids.includes(l.memory_id))) L.push("草稿引用了候选之外的碎片");
        setLights(L);
      } catch (e) { if (alive) setLights(["读取失败：" + ((e && e.message) || "稍后再试")]); }
    })();
    return () => { alive = false; };
  }, [candidateId]);
  const saveEdits = () => {
    const all = loadJSON(K_EVC_EDITS, {});
    all[candidateId] = { title: eTitle, synopsis: eSyn, narrative: eNarr, editedAt: Date.now() };
    saveJSON(K_EVC_EDITS, all);
    setEditing(false);
    toast && toast("修改稿已存好，确认入册时会带上「你改过」的标记");
  };
  const revertEdits = () => {
    const all = loadJSON(K_EVC_EDITS, {});
    delete all[candidateId];
    saveJSON(K_EVC_EDITS, all);
    const d = cand && cand.draft;
    setETitle((d && d.title) || ""); setESyn((d && d.synopsis) || ""); setENarr((d && d.narrative) || "");
    setEditing(false);
    toast && toast("已还原成执笔人原稿");
  };
  const doReturn = async () => {
    const fb = prompt("退回给执笔人，说说要改哪里（他下次起草能看到）：");
    if (fb == null) return;
    setBusy(true);
    try { await window.Cloud.eventCandidateSetStatus(candidateId, "requested", fb.trim() || "退回重写"); toast && toast("已退回，等他重新起草"); onChanged && onChanged(); onClose(); }
    catch (e) { toast && toast("退回失败：" + ((e && e.message) || "")); }
    finally { setBusy(false); }
  };
  const doReject = async () => {
    if (!confirm("拒绝这份候选？候选和草稿都会留档（不删除），只是不再推进。")) return;
    setBusy(true);
    try { await window.Cloud.eventCandidateSetStatus(candidateId, "rejected"); toast && toast("已拒绝，留档可查"); onChanged && onChanged(); onClose(); }
    catch (e) { toast && toast("拒绝失败：" + ((e && e.message) || "")); }
    finally { setBusy(false); }
  };
  const d = cand && cand.draft;
  const canConfirm = !editing && lights && !lights.length && typeof (window.Cloud && window.Cloud.eventCandidateAccept) === "function";
  const edited = !!edits || eTitle !== ((d && d.title) || "") || eNarr !== ((d && d.narrative) || "") || eSyn !== ((d && d.synopsis) || "");
  const doConfirm = async () => {
    if (!canConfirm || !cand) return;
    if (!eTitle.trim() || !eNarr.trim()) { toast && toast("标题和事件正文不能留空"); return; }
    if (!confirm("把这份候选正式写进事件书架？确认会原子落下事件和来源链接。")) return;
    const mutations = loadJSON(K_EVC_ACCEPT_MUTATIONS, {});
    const makeUuid = () => (window.crypto && window.crypto.randomUUID)
      ? window.crypto.randomUUID()
      : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
          const r = Math.random() * 16 | 0; return (c === "x" ? r : (r & 3 | 8)).toString(16);
        });
    const mutationId = mutations[candidateId] || makeUuid();
    mutations[candidateId] = mutationId;
    saveJSON(K_EVC_ACCEPT_MUTATIONS, mutations); // 成功前不删；断网/超时再点仍是同一次确认
    const userEdits = edited ? { title: eTitle.trim(), synopsis: eSyn.trim(), narrative: eNarr.trim() } : null;
    setBusy(true);
    try {
      const result = await window.Cloud.eventCandidateAccept(candidateId, cand.revision, mutationId, userEdits);
      const allEdits = loadJSON(K_EVC_EDITS, {}); delete allEdits[candidateId]; saveJSON(K_EVC_EDITS, allEdits);
      const allMutations = loadJSON(K_EVC_ACCEPT_MUTATIONS, {}); delete allMutations[candidateId]; saveJSON(K_EVC_ACCEPT_MUTATIONS, allMutations);
      toast && toast(result && result.idempotent ? "已确认过，书架里是同一篇事件" : "事件已正式入册");
      onChanged && await onChanged();
      onClose();
    } catch (e) {
      toast && toast("确认失败，没有写入半成品：" + ((e && e.message) || "稍后再试"));
    } finally { setBusy(false); }
  };
  return h(Sheet, { onClose: onClose },
    h(Eyebrow, { style: { marginBottom: 6 } }, "候选过目 · " + (cand ? nameOf(cand.requested_char_id) + " 执笔" : "加载中…")),
    lights == null ? h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, padding: "12px 0" } }, "正在跟云端核对来源与草稿…") : h(React.Fragment, null,
      lights.length ? h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: "#9f5149", background: "rgba(159,81,73,.08)", borderRadius: 9, padding: "8px 10px", marginBottom: 8, lineHeight: 1.6 } }, "🔴 " + lights.join("；")) : null,
      cand && cand.feedback ? h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.sub, background: t.bg, borderRadius: 9, padding: "6px 10px", marginBottom: 8 } }, "上次留言：" + cand.feedback) : null,
      d && h("div", { style: { maxHeight: "46vh", overflowY: "auto", marginBottom: 8 } },
        editing
          ? h(React.Fragment, null,
              h("input", { value: eTitle, onChange: e => setETitle(e.target.value), className: "w-full outline-none px-3 py-2 rounded-lg", style: { fontFamily: F_BODY, fontSize: 14, fontWeight: 700, color: t.ink, background: t.bg2, border: "1px solid " + t.line, marginBottom: 6 } }),
              h("textarea", { value: eSyn, onChange: e => setESyn(e.target.value), rows: 2, className: "w-full outline-none p-3 rounded-lg", style: { fontFamily: F_BODY, fontSize: 12, color: t.sub, background: t.bg2, border: "1px solid " + t.line, resize: "none", marginBottom: 6 } }),
              h("textarea", { value: eNarr, onChange: e => setENarr(e.target.value), rows: 12, className: "w-full outline-none p-3 rounded-lg", style: { fontFamily: F_BODY, fontSize: 13, lineHeight: 1.8, color: t.ink, background: t.bg2, border: "1px solid " + t.line, resize: "none" } }))
          : h(React.Fragment, null,
              h("div", { style: { fontFamily: F_BODY, fontSize: 15, fontWeight: 700, color: t.ink, marginBottom: 4 } }, eTitle, edited ? h("span", { style: { fontSize: 10, color: "#c98a3c", marginLeft: 6 } }, "你改过") : null),
              eSyn ? h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.sub, marginBottom: 8, lineHeight: 1.6 } }, eSyn) : null,
              h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: t.ink, lineHeight: 1.85, whiteSpace: "pre-wrap" } }, eNarr),
              (d.state_before || d.turning_point || d.state_after) ? h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginTop: 10, lineHeight: 1.7, borderTop: "1px dashed " + t.line, paddingTop: 8 } },
                d.state_before ? "起：" + d.state_before : null, d.state_before ? h("br") : null,
                d.turning_point ? "转：" + d.turning_point : null, d.turning_point ? h("br") : null,
                d.state_after ? "落：" + d.state_after : null) : null,
              h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 10, borderTop: "1px dashed " + t.line, paddingTop: 8 } }, "来源碎片 " + srcRows.length + " 条："),
              srcRows.map(r => h("div", { key: r.id, style: { fontFamily: F_BODY, fontSize: 10.5, color: t.sub, marginTop: 4, lineHeight: 1.5 } },
                "· " + String(r.text || "").slice(0, 46) + (String(r.text || "").length > 46 ? "…" : ""))))),
      h("div", { className: "flex", style: { gap: 8, marginBottom: 8 } },
        editing
          ? h(React.Fragment, null,
              h("button", { onClick: saveEdits, className: "flex-1 py-2.5 active:opacity-70", style: { borderRadius: 8, background: t.ink, color: t.bg2, fontFamily: F_BODY, fontSize: 12.5 } }, "保存修改稿"),
              h("button", { onClick: () => setEditing(false), className: "flex-1 py-2.5 active:opacity-70", style: { borderRadius: 8, border: "1px solid " + t.line, color: t.sub, fontFamily: F_BODY, fontSize: 12.5 } }, "先不改了"))
          : h(React.Fragment, null,
              d ? h("button", { onClick: () => setEditing(true), className: "flex-1 py-2.5 active:opacity-70", style: { borderRadius: 8, border: "1px solid " + t.line, color: t.ink, fontFamily: F_BODY, fontSize: 12.5 } }, "✏️ 修改") : null,
              edited ? h("button", { onClick: revertEdits, className: "flex-1 py-2.5 active:opacity-70", style: { borderRadius: 8, border: "1px solid " + t.line, color: t.sub, fontFamily: F_BODY, fontSize: 12.5 } }, "还原原稿") : null)),
      cand && cand.status !== "rejected" && cand.status !== "accepted" ? h("div", { className: "flex", style: { gap: 8 } },
        h("button", { onClick: doReturn, disabled: busy, className: "flex-1 py-2.5 active:opacity-70 disabled:opacity-40", style: { borderRadius: 8, border: "1px solid " + t.line, color: t.sub, fontFamily: F_BODY, fontSize: 12.5 } }, "↩︎ 退回重写"),
        h("button", { onClick: doReject, disabled: busy, className: "flex-1 py-2.5 active:opacity-70 disabled:opacity-40", style: { borderRadius: 8, border: "1px solid #9f5149", color: "#9f5149", fontFamily: F_BODY, fontSize: 12.5 } }, "✕ 拒绝"),
        h("button", { onClick: doConfirm, disabled: !canConfirm || busy, title: canConfirm ? "" : editing ? "先保存或退出编辑" : lights && lights.length ? "红灯未清不能确认" : "确认通道（原子 RPC）尚未部署", className: "flex-1 py-2.5 active:opacity-70 disabled:opacity-40", style: { borderRadius: 8, background: t.ink, color: t.bg2, fontFamily: F_BODY, fontSize: 12.5 } }, busy ? "入册中…" : "✓ 确认入册")) : null));
}

// ⑥事件层 · 第2步：事件书架（只读）。自包含读 window.MemoryEvents 的 IDB 镜像；
// 未登录/表未建=空态不报错；本步没有任何写入口（施工图 §2）。
function EventShelfSection({ characters, entries }) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState([]);
  const [cands, setCands] = useState([]);
  const [detail, setDetail] = useState(null); // { event, links }
  const [composeOpen, setComposeOpen] = useState(false);
  const [preselect, setPreselect] = useState(null); // 聚类建议 → 预填执笔请求
  const [sugs, setSugs] = useState([]);
  const [reviewId, setReviewId] = useState(null); // 打开过目台的候选 id
  const [showRejected, setShowRejected] = useState(false);
  const [evQ, setEvQ] = useState(""); // ⑥第7步：书架搜索（标题/梗概/主题，本地过滤）
  const nameOf = id => { const c = (characters || []).find(x => x.id === id); return c ? (c.remark || c.name) : "？"; };
  const fmtD = ts => { if (!ts) return ""; const d = new Date(ts); return (d.getMonth() + 1) + "/" + d.getDate(); };
  const load = async () => {
    if (!window.MemoryEvents) return;
    try {
      setEvents(await window.MemoryEvents.listEvents());
      const cs = await window.MemoryEvents.listCandidates();
      setCands(cs);
      if (window.Consolidate) { // 聚类建议：排除已进候选/事件的碎片（rejected/expired 可重聚）
        const used = new Set();
        cs.forEach(c => { if (c.status !== "rejected" && c.status !== "expired") (c.source_memory_ids || []).forEach(id => used.add(id)); });
        setSugs(window.Consolidate.suggestClusters(entries || [], { usedIds: used }));
      }
    } catch (e) {/* IDB 异常不阻塞记忆库 */}
  };
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!window.MemoryEvents) return;
      await window.MemoryEvents.refresh(); // 失败=读旧缓存，安静
      if (alive) load();
    })();
    return () => { alive = false; };
  }, []);
  // 记忆在本页被归档/软删或候选状态变化时，立即重算，避免旧建议继续显示。
  useEffect(() => {
    if (!window.Consolidate) return;
    const used = new Set();
    cands.forEach(c => { if (c.status !== "rejected" && c.status !== "expired") (c.source_memory_ids || []).forEach(id => used.add(id)); });
    setSugs(window.Consolidate.suggestClusters(entries || [], { usedIds: used }));
  }, [entries, cands]);
  const pendingCands = cands.filter(c => c.status === "requested" || c.status === "drafted");
  return h(React.Fragment, null, h("button", {
    onClick: () => setOpen(!open),
    className: "w-full active:opacity-60 flex items-center justify-between",
    style: { borderTop: "1px solid " + t.line, borderBottom: "1px solid " + t.line, color: t.ink, padding: "10px 4px", marginBottom: 2 }
  }, h("span", { className: "text-left" },
      h("span", { style: { display: "block", fontFamily: F_DISPLAY, fontSize: 13.5 } }, "事件册"),
      h("span", { style: { display: "block", fontFamily: F_BODY, color: t.fog, fontSize: 9.5, letterSpacing: ".08em", marginTop: 2 } }, pendingCands.length ? pendingCands.length + " 份候选等你过目" : "把零散片段收拢成完整的一件事")),
    h("span", { style: { fontFamily: F_BODY, color: t.fog, fontSize: 11 } }, events.length + " 件 " + (open ? "▾" : "›"))),
  open && h("div", { style: { maxHeight: "38vh", overflowY: "auto", marginBottom: 8 } },
    h("button", { onClick: () => setComposeOpen(true), className: "w-full rounded-lg py-2 mb-2 active:opacity-70", style: { border: "1px dashed " + t.tint, color: t.tint, fontFamily: F_BODY, fontSize: 12 } }, "＋ 挑碎片整理成事件"),
    sugs.length ? h("div", { style: { marginBottom: 8 } },
      h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, margin: "2px 0 5px" } }, "🧩 帮你聚了 " + sugs.length + " 摞像一件事的碎片（点开预填，仍由你核对定夺）"),
      sugs.map(s => h("button", {
        key: s.key, onClick: () => { setPreselect(s); setComposeOpen(true); },
        className: "w-full text-left rounded-lg py-2 px-3 mb-1.5 active:opacity-70",
        style: { border: "1px dashed " + t.line, background: t.bg2, fontFamily: F_BODY, fontSize: 11.5, color: t.sub }
      }, "🧩 " + (s.topTags.length ? s.topTags.join("/") : "未标签") + " · " + fmtD(s.startTs) + "–" + fmtD(s.endTs) + " · " + s.size + " 条" +
        (s.charId ? " · 关联" + nameOf(s.charId) : "") + (s.truncatedFrom ? "（原 " + s.truncatedFrom + " 条取最近 30）" : "")))) : null,
    pendingCands.map(c => h("button", {
      key: c.id, onClick: () => setReviewId(c.id),
      className: "w-full rounded-lg py-2 mb-1.5 active:opacity-70",
      style: { border: "1px solid " + (c.status === "drafted" ? t.tint : t.line), color: c.status === "drafted" ? t.tint : t.sub, fontFamily: F_BODY, fontSize: 11.5 }
    }, (c.status === "requested" ? "🕐 等执笔 · " : "✍️ 已起草，点开过目 · ") + nameOf(c.requested_char_id) + " · " + (c.source_memory_ids || []).length + " 条碎片")),
    (() => { const rej = cands.filter(c => c.status === "rejected"); return rej.length ? h(React.Fragment, null,
      h("button", { onClick: () => setShowRejected(!showRejected), className: "w-full py-1 mb-1 active:opacity-60", style: { fontFamily: F_BODY, fontSize: 10, color: t.fog } }, (showRejected ? "▾" : "▸") + " 废弃候选 " + rej.length + " 份（留档可查）"),
      showRejected ? rej.map(c => h("button", { key: c.id, onClick: () => setReviewId(c.id), className: "w-full rounded-lg py-1.5 mb-1 active:opacity-70", style: { border: "1px dashed " + t.line, color: t.fog, fontFamily: F_BODY, fontSize: 10.5 } }, "🗂 " + nameOf(c.requested_char_id) + " · " + (c.source_memory_ids || []).length + " 条 · " + String(c.updated_at || "").slice(0, 10))) : null) : null; })(),
    !events.length && h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, textAlign: "center", padding: "14px 0", lineHeight: 1.7 } },
      "还没有事件。", h("br"), "点上面那行，挑几条记忆碎片请他写成第一件。"),
    events.length > 3 ? h("input", { value: evQ, onChange: e => setEvQ(e.target.value), placeholder: "搜事件：标题 / 梗概 / 主题…", className: "w-full outline-none px-3 py-2 rounded-lg mb-2", style: { fontFamily: F_BODY, fontSize: 12, color: t.ink, background: t.bg2, border: "1px solid " + t.line } }) : null,
    events.filter(ev => { const q = evQ.trim().toLowerCase(); if (!q) return true; return (String(ev.title || "") + " " + String(ev.synopsis || "") + " " + (ev.themes || []).join(" ")).toLowerCase().indexOf(q) >= 0; }).map(ev => h("button", {
      key: ev.id,
      onClick: async () => { const d = window.MemoryEvents ? await window.MemoryEvents.getEvent(ev.id) : null; if (d) setDetail(d); },
      className: "w-full text-left rounded-xl p-3 mb-2 active:opacity-70",
      style: { border: "1px solid " + t.line, background: t.bg2 }
    },
      h("div", { className: "flex items-center justify-between" },
        h("span", { style: { fontFamily: F_BODY, fontSize: 13.5, fontWeight: 700, color: t.ink } }, ev.title),
        h("span", { style: { fontFamily: F_BODY, fontSize: 10, color: ev.status === "ongoing" ? "#c98a3c" : t.fog } }, ev.status === "ongoing" ? "进行中" : "已完结")),
      ev.synopsis ? h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.sub, marginTop: 4, lineHeight: 1.6 } }, ev.synopsis) : null,
      h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 5 } },
        (ev.char_ids || []).map(nameOf).join("、"),
        " · ", fmtD(ev.started_ts), ev.ended_ts ? "–" + fmtD(ev.ended_ts) : "起",
        ev.edited_by_user ? " · 你改过" : "")))),
  composeOpen && h(EventComposeSheet, { entries: entries, characters: characters, preselect: preselect, toast: window.__toast, onCreated: async () => { if (window.MemoryEvents) { await window.MemoryEvents.refresh(); load(); } }, onClose: () => { setComposeOpen(false); setPreselect(null); } }),
  reviewId && h(CandidateReviewSheet, { candidateId: reviewId, characters: characters, toast: window.__toast, onChanged: async () => { if (window.MemoryEvents) { await window.MemoryEvents.refresh(); load(); } }, onClose: () => setReviewId(null) }),
  detail && h(Sheet, { onClose: () => setDetail(null) },
    h(Eyebrow, { style: { marginBottom: 6 } }, detail.event.title),
    h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginBottom: 10 } },
      "执笔：" + nameOf(detail.event.author_char_id) + (detail.event.edited_by_user ? " · 你改过" : "") + " · 关联碎片 " + (detail.links || []).filter(l => !l.deleted).length + " 条"),
    h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, color: t.ink, lineHeight: 1.9, whiteSpace: "pre-wrap", maxHeight: "52vh", overflowY: "auto" } }, detail.event.narrative)));
}

// P1-3 纠错过目台：只有 Lisa 明确确认才把旧条标 superseded；拒绝不碰两条记忆。
function MemoryCorrectionPreviewSheet({ candidate, onDecided, onClose }) {
  const t = useTheme();
  const [pair, setPair] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { let alive=true; window.Cloud.memoryRowsFetchByIds([candidate.old_memory_id,candidate.new_memory_id]).then(rows => { if (alive) setPair(rows || []); }).catch(() => { if (alive) setPair([]); }); return () => { alive=false; }; }, [candidate.id]);
  const oldRow = pair && pair.find(e => e && e.id === candidate.old_memory_id);
  const newRow = pair && pair.find(e => e && e.id === candidate.new_memory_id);
  const issues = [];
  if (pair && !oldRow) issues.push("旧条在权威表中缺失");
  if (pair && !newRow) issues.push("新条在权威表中缺失");
  if (oldRow && oldRow.deleted) issues.push("旧条已软删");
  if (newRow && newRow.deleted) issues.push("新条已软删");
  if (oldRow && oldRow.revision != null && Number(oldRow.revision) !== Number(candidate.old_base_revision)) issues.push("旧条 revision 已变化");
  if (newRow && newRow.revision != null && Number(newRow.revision) !== Number(candidate.new_base_revision)) issues.push("新条 revision 已变化");
  const reason = ({ more_detailed: "新条更详细", contradiction: "新事实纠正旧说法", manual: "手动提出纠正" })[candidate.reason] || candidate.reason;
  const card = (label, row, baseRevision, color) => h("div", { style: { border: "1px solid " + t.line, borderRadius: 11, padding: 11, marginBottom: 8, background: t.bg2 } },
    h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color, marginBottom: 5 } }, label + " · 提案时 rev " + baseRevision),
    h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.ink, lineHeight: 1.7, whiteSpace: "pre-wrap" } }, row ? row.text : "（本机未读到这条）"),
    row && (row.pinned || row.open) ? h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: "#b06a4f", marginTop: 5 } }, (row.pinned ? "📌 置顶 " : "") + (row.open ? "⏳ 未了结" : "")) : null);
  const decide = async decision => {
    if (busy || issues.length || !pair) return;
    setBusy(true);
    try {
      await window.Cloud.memoryCorrectionDecide(candidate.id, candidate.revision, decision);
      if (window.__runMemoryRowSync) await window.__runMemoryRowSync();
      onDecided && onDecided(decision);
      onClose();
    } catch (e) { window.__toast && window.__toast("纠错没有落地：" + (e.message || e)); }
    finally { setBusy(false); }
  };
  return h(Sheet, { onClose },
    h(Eyebrow, null, "纠错候选 · 由你定夺"),
    h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.sub, margin: "6px 0 10px" } }, reason),
    !pair ? h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, padding: "14px 0" } }, "正在从权威表重读新旧两条…") : h(React.Fragment, null,
      issues.length ? h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: "#9f5149", background: "rgba(159,81,73,.08)", borderRadius: 9, padding: "8px 10px", marginBottom: 8 } }, "🔴 " + issues.join("；") + "。未来正式确认时必须重新生成候选。") : null,
      card("旧说法（确认后只留档，不删除）", oldRow, candidate.old_base_revision, "#9f5149"),
      card("新说法（确认后保持主动浮现）", newRow, candidate.new_base_revision, t.tint)),
    h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, lineHeight: 1.65, marginTop: 8 } }, "确认只会让旧说法退出正常召回，并留下新→旧的可追溯关系；任何一条都不会被删除。"),
    h("div", { className: "flex", style: { gap: 8, marginTop: 10 } },
      h("button", { onClick: () => decide("rejected"), disabled: busy || !pair, className: "flex-1 py-2.5 disabled:opacity-40", style: { border: "1px solid " + t.line, borderRadius: 9, color: t.sub, fontFamily: F_BODY, fontSize: 12.5 } }, "不是纠错"),
      h("button", { onClick: () => decide("accepted"), disabled: busy || !pair || issues.length > 0, className: "flex-1 py-2.5 disabled:opacity-40", style: { background: t.ink, borderRadius: 9, color: t.bg2, fontFamily: F_BODY, fontSize: 12.5 } }, busy ? "正在留环…" : "确认：新条纠正旧条")));
}

function InnerLifeEDiagnosticSheet({ characters, onClose }) {
  const t = useTheme();
  const [report, setReport] = useState(null);
  const [previews, setPreviews] = useState({});
  const [gateTick, setGateTick] = useState(0);
  // iOS 原生壳里关闭弹层会立刻卸载组件。E 报告与逐角色预览是异步读取，
  // 旧实现可能在卸载后才回来 setState，WebKit 偶发会把整个 React 页面打白。
  // 退场先熔断本轮读取；刷新时用序号丢弃过期结果。
  const aliveRef = useRef(true);
  const loadSeqRef = useRef(0);
  useEffect(() => () => { aliveRef.current = false; loadSeqRef.current += 1; }, []);
  const load = async () => {
    const seq = ++loadSeqRef.current;
    if (aliveRef.current) setReport(null);
    try {
      const mod=window.InnerLifeETidalShadow;
      const next=await Promise.resolve(mod&&mod.report?mod.report():{error:"E 影子模块未载入"});
      const rows=await Promise.all((characters||[]).map(async c=>[c.id,mod&&mod.liveProjection?await mod.liveProjection(c.id,Date.now()):null]));
      if (!aliveRef.current || seq !== loadSeqRef.current) return;
      setReport(next);
      setPreviews(Object.fromEntries(rows));
    } catch (_) {
      if (aliveRef.current && seq === loadSeqRef.current) setReport({ error: "E 影子诊断读取失败" });
    }
  };
  useEffect(load, []);
  const closeSafely = () => {
    aliveRef.current = false;
    loadSeqRef.current += 1;
    onClose && onClose();
  };
  const labels = { packet_created:"余温新包",packet_duplicate:"同锚重复（已拦）",packet_expired:"余温过期",would_surface:"本来会浮现",live_surface:"试点真实浮现",tidal_transition:"潮汐转移",would_hold:"本来会拦主动" };
  const outlets = { foreground_proactive:"前台主动",dongnian:"动念主动",birthday:"生日",reminder:"提醒",eyes_alert:"体征提醒",weather:"天气",greeting:"问候" };
  const line = (a,b) => h("div", { className:"flex justify-between", style:{fontFamily:F_BODY,fontSize:11.5,color:t.sub,padding:"4px 0",borderBottom:"1px dashed "+t.line} }, h("span",null,a), h("span",{style:{color:t.ink,fontWeight:600}},b));
  const readiness = report && !report.error && window.InnerLifePromotionGate ? window.InnerLifePromotionGate.evaluateE(report) : null;
  const allEArmed = window.InnerLifePromotionGate && window.InnerLifePromotionGate.state("E","*").mode === "pilot";
  return h(Sheet, { onClose: closeSafely },
    h(Eyebrow, null, "E · 余温与潮汐 · 诊断与试点"),
    h("div", { style:{fontFamily:F_BODY,fontSize:11,color:t.fog,lineHeight:1.65,margin:"7px 0 10px"} }, "授权后只会在你主动点回复时，把上一段交流留下的一点心情色彩和未完注意力作为轻背景；不写记忆、不替角色决定、不复述旧话题。主动消息暂不接入。"),
    !report ? h("div", { style:{fontFamily:F_BODY,fontSize:12,color:t.fog,padding:"16px 0"} }, "正在读本机影子数据…") : report.error ? h("div", { style:{fontFamily:F_BODY,fontSize:12,color:"#9f5149",padding:"12px 0"} }, report.error) : h(React.Fragment, null,
      line("当前潮汐", report.tidal ? report.tidal.state + " · " + report.tidal.signalKind : "尚无数据"),
      line("诊断记录", report.diagnostics + " 条"),
      line("余温包", (report.packets || []).length + " 个 · 有效 " + (report.packets || []).filter(p=>p.valid).length),
      line("开窗误判 awake", report.invariants.sessionOpenWoke + "（必须为 0）"),
      line("写入经历/记忆", report.invariants.writesExperience + "（必须为 0）"),
      readiness ? h("div", { style:{margin:"10px 0",padding:"9px 10px",borderRadius:10,background:readiness.ready?"rgba(74,139,104,.09)":"rgba(186,139,70,.10)",fontFamily:F_BODY,fontSize:11,color:readiness.ready?"#4a8b68":"#9a6d2e",lineHeight:1.6} }, readiness.ready ? "🟢 前台余温试点已达机械门槛。" : "🟡 暂不放行：" + readiness.blockers.join("；")) : null,
      h("div", { style:{fontFamily:F_BODY,fontSize:11,fontWeight:700,color:t.ink,margin:"12px 0 4px"} }, "事件计数"),
      Object.keys(report.kinds || {}).length ? Object.entries(report.kinds).map(([k,v])=>line(labels[k]||k,v)) : h("div",{style:{fontFamily:F_BODY,fontSize:11,color:t.fog}},"还没有事件"),
      h("div", { style:{fontFamily:F_BODY,fontSize:11,fontWeight:700,color:t.ink,margin:"12px 0 4px"} }, "本来会拦的出口"),
      Object.keys(report.outlets || {}).length ? Object.entries(report.outlets).map(([k,v])=>line(outlets[k]||k,v)) : h("div",{style:{fontFamily:F_BODY,fontSize:11,color:t.fog}},"目前 0 次"),
      h("div", { style:{fontFamily:F_BODY,fontSize:11,fontWeight:700,color:t.ink,margin:"12px 0 4px"} }, "角色影响仪表"),
      readiness&&readiness.ready?h("button",{onClick:()=>{const result=window.InnerLifePromotionGate&&window.InnerLifePromotionGate.armAllE(readiness);if(result&&result.ok){setGateTick(x=>x+1);window.__toast&&window.__toast("E 已给全部角色开启前台余温试点");}},className:"w-full mb-2 py-2 active:opacity-70",style:{borderRadius:9,background:allEArmed?t.ink:"#4a8b68",fontFamily:F_BODY,fontSize:11.5,color:"white"}},allEArmed?"✓ E 已对全部角色开启":"全部角色开启 E · 前台试点"):null,
      (characters||[]).map(c=>{const charHash=window.InnerLifeEAfterglowShadow&&window.InnerLifeEAfterglowShadow.hash(c.id),rdy=window.InnerLifePromotionGate&&window.InnerLifePromotionGate.evaluateE(report,charHash),gate=window.InnerLifePromotionGate&&window.InnerLifePromotionGate.state("E",c.id),armed=gate&&gate.mode==="pilot",stats=report.byChar&&report.byChar[charHash]||{},live=Number(stats.kinds&&stats.kinds.live_surface)||0,preview=previews[c.id];return h("div",{key:c.id,style:{padding:"7px 0",borderBottom:"1px dashed "+t.line}},h("div",{className:"flex items-center justify-between",style:{gap:8}},h("span",{style:{fontFamily:F_BODY,fontSize:11,color:t.sub}},c.remark||c.name),h("button",{disabled:!armed&&!(rdy&&rdy.ready),onClick:()=>{if(armed)window.InnerLifePromotionGate.disarm("E",c.id);else window.InnerLifePromotionGate.armPilot("E",c.id,rdy);setGateTick(x=>x+1);},style:{fontFamily:F_BODY,fontSize:10.5,color:armed?"#9f5149":rdy&&rdy.ready?"#4a8b68":t.fog,border:"1px solid "+(armed?"#9f5149":t.line),borderRadius:999,padding:"3px 8px",opacity:!armed&&!(rdy&&rdy.ready)?.45:1}},armed?"已开 · 撤销":rdy&&rdy.ready?"授权试点":"未达标")),h("div",{style:{fontFamily:F_BODY,fontSize:10,color:t.fog,lineHeight:1.55,marginTop:3}},"已真实带入 "+live+" 次 · "+(preview?("下次可带入："+(preview.mood||"无心情色彩")+(preview.threads&&preview.threads.length?" · "+preview.threads.length+" 个未完注意点":"")):"目前没有待用余温")));}),
      ),
    h("button", { onClick:load,className:"w-full mt-3 py-2.5 active:opacity-70",style:{borderRadius:9,border:"1px solid "+t.line,fontFamily:F_BODY,fontSize:12,color:t.sub} }, "刷新诊断"),
    h("button", { onClick:()=>{if(confirm("立即撤销 A/E 全部试点授权？影子观察会继续，任何角色都不会丢数据。")){window.InnerLifePromotionGate&&window.InnerLifePromotionGate.rollbackAll();setGateTick(x=>x+1);window.__toast&&window.__toast("A/E 已全部退回纯影子");}},className:"w-full mt-2 py-2 active:opacity-70",style:{borderRadius:9,border:"1px solid #9f5149",fontFamily:F_BODY,fontSize:11,color:"#9f5149"} }, "紧急回滚 · A/E 全部退回纯影子"));
}

// A 情绪统一影子诊断台（只读）：十维当前值 + 投影采样统计（凑齐 E/B/C/A 四块仪表）
function InnerLifeADiagnosticSheet({ characters, onClose }) {
  const t = useTheme();
  const [rows, setRows] = useState(null);
  const [gateTick, setGateTick] = useState(0);
  const AXIS_ZH = { connection: "思念", pride: "傲娇", valence: "愉悦", arousal: "唤醒", immersion: "沉浸", hurt: "委屈", anger: "火气", anxiety: "不安", warmth: "暖意", fatigue: "疲惫" };
  const load = async () => {
    setRows(null);
    try {
      const S = window.InnerLifeAShadow;
      if (!S) { setRows({ error: "A 影子模块未载入" }); return; }
      let ownerId = "local-device";
      try { const u = window.Cloud && window.Cloud.getSessionUser && await window.Cloud.getSessionUser(); if (u && u.id) ownerId = u.id; } catch (e) {}
      const out = [];
      for (const c of (characters || [])) {
        const st = await S.get(ownerId, c.id);
        const r = await S.report(ownerId, c.id);
        if (st || (r && r.sampleCount)) out.push({ char: c, st, r: r || {} });
      }
      setRows({ list: out, summary: window.SomaticReviewCore ? window.SomaticReviewCore.summarize(out) : null });
    } catch (e) { setRows({ error: "A 影子诊断读取失败" }); }
  };
  useEffect(() => { load(); }, []);
  const line = (a, b) => h("div", { className: "flex justify-between", style: { fontFamily: F_BODY, fontSize: 11.5, color: t.sub, padding: "4px 0", borderBottom: "1px dashed " + t.line } }, h("span", null, a), h("span", { style: { color: t.ink, fontWeight: 600 } }, b));
  return h(Sheet, { onClose },
    h(Eyebrow, null, "A · 情绪统一 · 纯影子诊断"),
    h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, lineHeight: 1.65, margin: "7px 0 10px" } }, "十维只算不注入：当前值在影子库里演算与回归，投影采样只记录「如果注入会给哪些维度」。评审看：投影维度分布合不合理、mood 未匹配率、钳制次数。"),
    !rows ? h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, padding: "16px 0" } }, "正在读本机影子数据…") :
    rows.error ? h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: "#9f5149", padding: "12px 0" } }, rows.error) :
    !rows.list.length ? h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, padding: "12px 0" } }, "还没有任何角色的情绪影子数据") :
    rows.list.map(({ char, st, r }) => { const ready=window.InnerLifePromotionGate?window.InnerLifePromotionGate.evaluateA(r):null,gate=window.InnerLifePromotionGate?window.InnerLifePromotionGate.state("A",char.id):{mode:"shadow"}; return h("div", { key: char.id, style: { marginBottom: 14 } },
      h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, fontWeight: 700, color: t.ink, marginBottom: 4 } }, char.remark || char.name),
      st && st.emotion && st.emotion.current ? h("div", { className: "flex flex-wrap", style: { gap: 5, marginBottom: 5 } },
        Object.entries(st.emotion.current).map(([k, v]) => h("span", { key: k, style: { fontFamily: F_BODY, fontSize: 10.5, padding: "2px 8px", borderRadius: 999, border: "1px solid " + t.line, color: Math.abs(v) > 0.45 ? t.tint : t.fog } }, (AXIS_ZH[k] || k) + " " + (Math.round(v * 100) / 100))))
        : h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog } }, "无状态（引擎还没为 TA 演算过）"),
      line("投影采样 / mood未匹配 / 被钳制", (r.sampleCount || 0) + " / " + (r.unmatchedMoodCount || 0) + " / " + (r.clippedCount || 0)),
      r.dictionaryVersion ? line("固定词典版本 / 旧版留档样本", "v" + r.dictionaryVersion + " / " + (r.legacySampleCount || 0)) : null,
      r.topUnmatchedMoods && r.topUnmatchedMoods.length ? line("本版未识别 mood", r.topUnmatchedMoods.map(x => x.label + "×" + x.count).join("、")) : null,
      r.dimensionCounts && Object.keys(r.dimensionCounts).length ? line("投影维度分布", Object.entries(r.dimensionCounts).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, n]) => (AXIS_ZH[k] || k) + "×" + n).join(" ")) : null,
      ready ? h("div", { style:{marginTop:7,padding:"7px 9px",borderRadius:9,background:ready.ready?"rgba(74,139,104,.09)":"rgba(186,139,70,.10)",fontFamily:F_BODY,fontSize:10.5,color:ready.ready?"#4a8b68":"#9a6d2e",lineHeight:1.55} }, gate.mode==="pilot" ? "🟢 已获试点授权（注入接线仍未开启）" : ready.ready ? "🟢 已达机械门槛，等待你和 TA 主观确认" : "🟡 继续观察："+ready.blockers.join("；")) : null,
      ready ? h("button",{disabled:gate.mode!=="pilot"&&!ready.ready,onClick:()=>{if(gate.mode==="pilot")window.InnerLifePromotionGate.disarm("A",char.id);else window.InnerLifePromotionGate.armPilot("A",char.id,ready);setGateTick(x=>x+1);},style:{marginTop:6,width:"100%",border:"1px solid "+(gate.mode==="pilot"?"#9f5149":t.line),borderRadius:9,padding:"6px",fontFamily:F_BODY,fontSize:10.5,color:gate.mode==="pilot"?"#9f5149":ready.ready?"#4a8b68":t.fog,opacity:gate.mode!=="pilot"&&!ready.ready?.45:1}},gate.mode==="pilot"?"撤销试点授权":ready.ready?"授权这个角色进入下一步":"数据未达标，不能授权") : null); }),
    h("button", { onClick: load, className: "w-full mt-3 py-2.5 active:opacity-70", style: { borderRadius: 9, border: "1px solid " + t.line, fontFamily: F_BODY, fontSize: 12, color: t.sub } }, "刷新诊断"));
}

// 五感系统 v1：全角色只读影子仪表。正文不进诊断库，数值也不进 prompt。
function SomaticDiagnosticSheet({ characters, onClose }) {
  const t = useTheme();
  const [rows, setRows] = useState(null);
  const CHANNEL_ZH = { touch: "触觉", smell: "嗅觉", taste: "味觉", sound: "听觉" };
  const SOURCE_ZH = { private: "私聊", cc_ledger: "CC 回流", group: "线上群聊", offline: "单人线下", group_offline: "群聊线下", voice: "真实语音", cc: "CC 本机" };
  const MODE_ZH = { physical: "共同在场", symbolic: "文字象征" };
  const load = async () => {
    setRows(null);
    try {
      const S = window.SomaticShadow;
      if (!S) { setRows({ error: "五感影子模块未载入" }); return; }
      let ownerId = "local-device";
      try { const u = window.Cloud && window.Cloud.getSessionUser && await window.Cloud.getSessionUser(); if (u && u.id) ownerId = u.id; } catch (e) {}
      const out = [];
      for (const c of (characters || [])) {
        const st = await S.get(ownerId, c.id);
        const report = await S.report(ownerId, c.id);
        const status = await S.status(ownerId, c.id, Date.now());
        if (st || (report && report.sampleCount)) out.push({ char: c, report: report || {}, status: status || {} });
      }
      setRows({ list: out });
    } catch (e) { setRows({ error: "五感影子诊断读取失败" }); }
  };
  useEffect(() => { load(); }, []);
  const line = (a, b) => h("div", { className: "flex justify-between", style: { gap: 12, fontFamily: F_BODY, fontSize: 11.5, color: t.sub, padding: "4px 0", borderBottom: "1px dashed " + t.line } }, h("span", null, a), h("span", { style: { color: t.ink, fontWeight: 600, textAlign: "right" } }, b));
  const fmtSources = surfaces => Object.entries(surfaces || {}).sort((a, b) => b[1] - a[1]).map(([k, n]) => (SOURCE_ZH[k] || k) + "×" + n).join(" · ") || "尚无";
  return h(Sheet, { onClose },
    h(Eyebrow, null, "五感系统 · 全角色纯影子诊断"),
    h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, lineHeight: 1.65, margin: "7px 0 10px" } }, "只看不注入：触觉、嗅觉、味觉、听觉只在独立影子库衰减演算，不会改变角色语气或决定。CC 与 App 共用同一套 somatic-core；App 只重放已获准回流的 CC 账本，不读取私人 CC transcript。"),
    !rows ? h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, padding: "16px 0" } }, "正在读本机影子数据…") :
    rows.error ? h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: "#9f5149", padding: "12px 0" } }, rows.error) :
    !rows.list.length ? h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, padding: "12px 0", lineHeight: 1.7 } }, "还没有五感样本。聊几轮后再来：线上只会形成低强度象征触觉，嗅觉/味觉必须来自共同在场，听觉必须来自真实语音。") :
    h(React.Fragment, null,
    rows.summary ? h("div", { style: { border: "1px dashed " + t.line, borderRadius: 10, padding: "8px 10px", marginBottom: 12 } },
      line("全角色样本 / 身体事件", rows.summary.sampleCount + " / " + rows.summary.eventCount),
      line("CC 回流重放", rows.summary.ccReplaySamples + " 轮"),
      h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: rows.summary.enoughForHumanReview ? t.sub : "#b8860b", marginTop: 6, lineHeight: 1.6 } },
        rows.summary.enoughForHumanReview ? "样本已够进入人工复核；仍不会自动开阀。" :
        (rows.summary.warnings || []).map(x => ({ insufficient_samples: "样本还少，继续观察", no_detected_events: "长期零命中，请检查分类器", single_source_dominance: "来源太单一，结论可能偏科" }[x.code] || x.code)).join("；"))) : null,
    rows.list.map(({ char, report, status }) => {
      const channels = status && status.state && status.state.channels || {};
      return h("div", { key: char.id, style: { marginBottom: 15 } },
        h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, fontWeight: 700, color: t.ink, marginBottom: 5 } }, char.remark || char.name),
        h("div", { className: "flex flex-wrap", style: { gap: 5, marginBottom: 6 } }, Object.keys(CHANNEL_ZH).map(key => {
          const row = channels[key] || {}, value = Math.round((Number(row.value) || 0) * 100) / 100;
          return h("span", { key, title: row.label || "尚无余感", style: { fontFamily: F_BODY, fontSize: 10.5, padding: "3px 8px", borderRadius: 999, border: "1px solid " + t.line, color: value >= 0.15 ? t.tint : t.fog } }, CHANNEL_ZH[key] + " " + value);
        })),
        Object.keys(CHANNEL_ZH).map(key => { const row = channels[key]; return row && (row.value || row.label) ? line(CHANNEL_ZH[key] + "余感", (row.label || "无标签") + " · " + (MODE_ZH[row.mode] || row.mode || "—") + " · " + (SOURCE_ZH[row.source] || row.source || "—")) : null; }),
        line("样本 / 身体事件", (report.sampleCount || 0) + " / " + Object.values(report.eventCounts || {}).reduce((a, b) => a + b, 0)),
        line("来源分布", fmtSources(report.surfaces)),
        report.surfaces && report.surfaces.cc_ledger ? line("CC→App 同引擎重放", report.surfaces.cc_ledger + " 轮（只含获准回流内容）") : null);
    })),
    h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, lineHeight: 1.6, marginTop: 8 } }, "对账规则：CC 与 App 都给每轮身体事件生成同一稳定指纹；来源字段不参与指纹，正文不进入诊断。审计时可逐轮比对，指纹不一致只报警、不自动修状态。"),
    h("button", { onClick: load, className: "w-full mt-3 py-2.5 active:opacity-70", style: { borderRadius: 9, border: "1px solid " + t.line, fontFamily: F_BODY, fontSize: 12, color: t.sub } }, "刷新诊断"));
}

// B 第3步：关系轴影子诊断台（只读；试点=阿屿/顾暮，小克硬拒在 pilotFor 里）
function InnerLifeBDiagnosticSheet({ characters, onClose }) {
  const t = useTheme();
  const [rows, setRows] = useState(null);
  const AXIS_ZH = { identity: "身份", continuity: "连续", seriousness: "认真", boundary: "边界", neglect: "忽视", repairFailure: "修复失败" };
  const load = async () => {
    setRows(null);
    try {
      const B = window.InnerLifeBShadow;
      if (!B) { setRows({ error: "B 影子模块未载入" }); return; }
      let ownerId = "local-device";
      try { const u = window.Cloud && window.Cloud.getSessionUser && await window.Cloud.getSessionUser(); if (u && u.id) ownerId = u.id; } catch (e) {}
      const pilots = (characters || []).filter(c => B.pilotFor(c));
      const out = [];
      for (const c of pilots) out.push({ char: c, r: await B.report(ownerId, c) });
      setRows({ pilots: out });
    } catch (e) { setRows({ error: "B 影子诊断读取失败" }); }
  };
  useEffect(() => { load(); }, []);
  const line = (a, b) => h("div", { className: "flex justify-between", style: { fontFamily: F_BODY, fontSize: 11.5, color: t.sub, padding: "4px 0", borderBottom: "1px dashed " + t.line } }, h("span", null, a), h("span", { style: { color: t.ink, fontWeight: 600 } }, b));
  return h(Sheet, { onClose },
    h(Eyebrow, null, "B · 关系轴 · 纯影子诊断"),
    h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, lineHeight: 1.65, margin: "7px 0 10px" } }, "只算不注入：轴的受伤/修复只在影子库里演算，不影响角色反应。评审看三件事：误伤（玩笑被当伤害）、闪烁（反复进出）、假修复（道歉就清零——不该发生）。"),
    !rows ? h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, padding: "16px 0" } }, "正在读本机影子数据…") :
    rows.error ? h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: "#9f5149", padding: "12px 0" } }, rows.error) :
    !rows.pilots.length ? h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, padding: "12px 0" } }, "没有找到试点角色（首批：阿屿、顾暮）") :
    rows.pilots.map(({ char, r }) => h("div", { key: char.id, style: { marginBottom: 14 } },
      h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, fontWeight: 700, color: t.ink, marginBottom: 4 } }, (char.remark || char.name) + (r.error ? " · " + r.error : "")),
      r.state && r.state.axes ? Object.entries(r.state.axes).map(([axis, ax]) =>
        line(AXIS_ZH[axis] || axis, (ax.active ? "🔴受伤中" : "平静") + " · 压力 " + Math.round((ax.pressure || 0) * 100) / 100 + (ax.active ? (ax.repairLocked ? " · 🔒待真修复" : " · 🔓回落中") : ""))
      ) : h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog } }, "还没有轴状态（一次检测都没跑过）"),
      line("检测次数 / 失败", (r.calls || 0) + " / " + (r.failures || 0) + "（均耗 " + (r.avgLatencyMs || 0) + "ms）"),
      line("候选 raw→有效", (r.rawCandidates || 0) + " → " + (r.validCandidates || 0)),
      line("玩笑误伤被挡", String(r.playfulBlocked || 0)),
      line("假修复被挡", String(r.fakeRepairBlocked || 0)),
      line("进入 / 退出 / 真修复解锁", (r.entered || 0) + " / " + (r.exited || 0) + " / " + (r.repairUnlocked || 0)))),
    h("button", { onClick: load, className: "w-full mt-3 py-2.5 active:opacity-70", style: { borderRadius: 9, border: "1px solid " + t.line, fontFamily: F_BODY, fontSize: 12, color: t.sub } }, "刷新诊断"));
}

// C 第5步：睡眠与发声闸影子诊断台（只读；hashId 把诊断里的角色哈希映射回名字）
function InnerLifeCDiagnosticSheet({ characters, onClose }) {
  const t = useTheme();
  const [r, setR] = useState(null);
  const PHASE_ZH = { awake: "醒着", drowsy: "犯困", asleep: "睡着", waking: "将醒", exempt_digital: "数字生命豁免" };
  const OUTLET_ZH = { chat: "聊天", moments: "朋友圈", forum: "论坛", whisper: "悄悄话", proactive: "主动消息", "?": "未知口" };
  const load = async () => {
    setR(null);
    try {
      const S = window.SleepShadow;
      if (!S) { setR({ error: "C 影子模块未载入" }); return; }
      const agg = await S.report(300);
      if (agg && !agg.error && S.hashId) {
        const nameByHash = {};
        (characters || []).forEach(c => { nameByHash[S.hashId(c.id)] = c.remark || c.name; });
        agg.phases = (agg.phases || []).map(p => ({ ...p, name: nameByHash[p.c] || "已清仓角色" }));
      }
      setR(agg);
    } catch (e) { setR({ error: "C 影子诊断读取失败" }); }
  };
  useEffect(() => { load(); }, []);
  const line = (a, b) => h("div", { className: "flex justify-between", style: { fontFamily: F_BODY, fontSize: 11.5, color: t.sub, padding: "4px 0", borderBottom: "1px dashed " + t.line } }, h("span", null, a), h("span", { style: { color: t.ink, fontWeight: 600 } }, b));
  return h(Sheet, { onClose },
    h(Eyebrow, null, "C · 睡眠与发声闸 · 纯影子诊断"),
    h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, lineHeight: 1.65, margin: "7px 0 10px" } }, "只记不拦：角色睡着时发声只登记 would_hold，实际永远放行。评审看三件事：would_hold 分布合不合作息、fail_open 多不多（多=状态老丢）、相位转换是否闪烁。"),
    !r ? h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, padding: "16px 0" } }, "正在读本机影子数据…") :
    r.error ? h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: "#9f5149", padding: "12px 0" } }, String(r.error)) :
    h(React.Fragment, null,
      h("div", { style: { fontFamily: F_BODY, fontSize: 12, fontWeight: 700, color: t.ink, marginBottom: 2 } }, "当前相位"),
      (r.phases || []).length ? r.phases.map(p => line(p.name, (PHASE_ZH[p.phase] || p.phase) + " · 压力 " + p.pressure + (p.source ? " · " + ({ schedule: "按日程", pressure_guard: "睡压保底", knock: "被敲醒", unknown_schedule: "缺日程放行" }[p.source] || p.source) : ""))) :
        h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, padding: "6px 0" } }, "还没有任何角色的睡眠状态（tick 一次都没跑过）"),
      h("div", { style: { fontFamily: F_BODY, fontSize: 12, fontWeight: 700, color: t.ink, margin: "10px 0 2px" } }, "近 " + (r.observations || 0) + " 条诊断"),
      Object.keys(r.wouldHold || {}).length ? Object.entries(r.wouldHold).map(([o, n]) => line("😴 睡着时想说话（" + (OUTLET_ZH[o] || o) + "）", String(n))) : line("😴 睡着时想说话", "0 次"),
      line("相位转换", String(r.transitions || 0)),
      line("fail_open（状态缺失放行）", String(r.failOpen || 0)),
      line("数字生命豁免", String(r.exempt || 0))),
    h("button", { onClick: load, className: "w-full mt-3 py-2.5 active:opacity-70", style: { borderRadius: 9, border: "1px solid " + t.line, fontFamily: F_BODY, fontSize: 12, color: t.sub } }, "刷新诊断"));
}

function MemoryDuplicatePreviewSheet({ groups, stats, onConfirm, onClose, mode }) {
  const t = useTheme();
  const eventMode = mode === "event";
  const routineMode = mode === "routine";
  const [selected, setSelected] = useState(() => new Set());
  const toggle = id => setSelected(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const picked = (groups || []).filter(g => selected.has(g.id));
  return h("div", { className: "fixed inset-0 z-50 flex items-end", style: { background: "rgba(20,18,16,.38)" }, onClick: onClose },
    h("div", { className: "w-full rounded-t-3xl px-5 pt-5 pb-8", style: { background: t.bg, maxHeight: "88vh", overflowY: "auto" }, onClick: e => e.stopPropagation() },
      h("div", { className: "flex items-start justify-between gap-3", style: { marginBottom: 10 } },
        h("div", null,
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 20, color: t.ink } }, routineMode ? "日常流水清仓预览" : (eventMode ? "同一事件进展预览" : "重复记忆预览")),
          h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, lineHeight: 1.6, marginTop: 3 } }, routineMode ? "只列七天前、低情绪、已了结的明显吃喝/作息/通勤流水。默认不选；确认后只软归档，正文仍可恢复。" : (eventMode ? "只找同角色七天内的“计划/准备 → 已完成/取消/实际结果”。默认不选；确认后结果继续召回，过程只软归档。" : "同角色跨时间完全相同，或 72 小时内高度相似。默认一组都不选；确认后只软归档重复版本，不删除正文。"))),
        h("button", { onClick: onClose, style: { color: t.fog, fontSize: 20 } }, "×")),
      eventMode && stats ? h("div", { style: { background: t.bg2, border: "1px solid " + t.line, borderRadius: 12, padding: "9px 11px", marginBottom: 10, fontFamily: F_BODY, fontSize: 11, color: t.sub, lineHeight: 1.65 } },
        "可检查 " + (stats.eligible || 0) + " 条 · 识别到计划 " + (stats.planned || 0) + " 条 · 结果 " + (stats.resolved || 0) + " 条",
        (stats.protectedOpen || 0) ? h("div", { style: { color: "#9a7750" } }, "另有 " + stats.protectedOpen + " 条仍是未了 open：安全闸不会替你把它们归档。") : null) : null,
      routineMode && stats ? h("div", { style: { background: t.bg2, border: "1px solid " + t.line, borderRadius: 12, padding: "9px 11px", marginBottom: 10, fontFamily: F_BODY, fontSize: 11, color: t.sub, lineHeight: 1.65 } },
        "找到 " + (stats.candidates || 0) + " 条保守候选 · " + (stats.recent || 0) + " 条因还太新未碰",
        h("div", { style: { color: "#9a7750" } }, "保护：open " + (stats.protectedOpen || 0) + " · 置顶 " + (stats.protectedPinned || 0) + " · 重要信号 " + (stats.durable || 0))) : null,
      (groups || []).length === 0 ? h("div", { style: { padding: "28px 8px", textAlign: "center", fontFamily: F_BODY, color: t.fog } }, routineMode ? "没有找到足够明确、足够旧的低信息日常流水。" : (eventMode ? "没有找到能安全配成“计划 → 结果”的候选；上面的数字会告诉你是没识别到，还是仍被 open 安全保护。" : "没有找到高置信重复组")) : h(React.Fragment, null,
        h("div", { className: "flex gap-2", style: { marginBottom: 10 } },
          h("button", { onClick: () => setSelected(new Set((groups || []).filter(g => g.confidence === "high").map(g => g.id))), className: "rounded-full px-3 py-1.5", style: { border: "1px solid " + t.line, color: t.sub, fontFamily: F_BODY, fontSize: 11.5 } }, "只选高置信"),
          h("button", { onClick: () => setSelected(new Set()), className: "rounded-full px-3 py-1.5", style: { border: "1px solid " + t.line, color: t.fog, fontFamily: F_BODY, fontSize: 11.5 } }, "全部取消")),
        (groups || []).map((g, i) => h("button", { key: g.id, onClick: () => toggle(g.id), className: "w-full text-left rounded-2xl p-3 mb-2 active:opacity-75", style: { background: t.bg2, border: "1px solid " + (selected.has(g.id) ? t.tint : t.line) } },
          h("div", { className: "flex items-center justify-between", style: { marginBottom: 7 } },
            h("span", { style: { fontFamily: F_BODY, fontSize: 11.5, color: selected.has(g.id) ? t.tint : t.sub } }, (selected.has(g.id) ? "✓ " : "○ ") + "第 " + (i + 1) + " 组 · " + (g.archive || []).length + " 条待归档"),
            h("span", { style: { fontFamily: F_BODY, fontSize: 10, color: g.confidence === "high" ? "#4f7b61" : t.fog } }, routineMode ? "日常流水 · 请复核" : (eventMode ? "进展候选 · 请复核" : (g.matchKind === "exact_all_time" ? "全文相同" : (g.confidence === "high" ? "高置信" : "请复核"))))),
          !routineMode ? h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: "#4f7b61", marginBottom: 4 } }, eventMode ? "保留结果条继续召回" : "保留信息最多的一条") : null,
          !routineMode ? h("div", { style: { fontFamily: F_BODY, fontSize: 13, lineHeight: 1.55, color: t.ink } }, g.keep.text) : null,
          h("div", { style: { borderTop: routineMode ? "none" : "1px dashed " + t.line, marginTop: routineMode ? 0 : 8, paddingTop: routineMode ? 0 : 7, fontFamily: F_BODY, fontSize: 11, color: "#a06455" } }, routineMode ? "确认后软归档" : (eventMode ? "事件过程 · 确认后软归档" : "软归档")),
          (g.archive || []).map(x => h("div", { key: x.id, style: { fontFamily: F_BODY, fontSize: 12, lineHeight: 1.5, color: t.sub, marginTop: 4 } }, "· " + x.text)))),
        h("button", { disabled: !picked.length, onClick: () => { if (!picked.length) return; if (confirm((eventMode ? "确认收拢已勾选的 " : "确认软归档已勾选的 ") + picked.length + " 组？不会删除正文，可从已精炼归档区恢复。")) { onConfirm(picked); onClose(); } }, className: "w-full rounded-xl py-3 mt-2 disabled:opacity-35", style: { background: t.ink, color: t.bg2, fontFamily: F_BODY, fontSize: 13 } }, picked.length ? (eventMode ? "确认收拢 " : "确认软归档 ") + picked.length + " 组" : "先勾选要处理的组"))));
}

/* Replaced below: the first draft is retained only as review history.
function MemoryRepairConflictSheet({ entries, onList, onDecide, onClose }) {
  const t=useTheme(),[rows,setRows]=useState(null),[busy,setBusy]=useState(null);
  const load=()=>{setRows(null);Promise.resolve(onList()).then(x=>setRows(x||[])).catch(()=>setRows([]));};useEffect(load,[]);
  const byId=new Map((entries||[]).filter(x=>x&&x.id).map(x=>[String(x.id),x]));
  const labels={fulfilled:"已兑现",resolved:"已解决",abandoned:"明确放弃"};
  const decide=async(row,value)=>{if(busy)return;if(!confirm(value==="keep_open"?"确认保持这条未了？系统不会替你猜结局。":"确认真实结局是“"+labels[value]+"”？原正文不会删除。"))return;setBusy(row.oldMemoryId);try{await onDecide(row,value);setRows(p=>(p||[]).filter(x=>x.oldMemoryId!==row.oldMemoryId));}finally{setBusy(null);}};
  return h(Sheet,{onClose},h(Eyebrow,null,"RepairGate · 结局冲突过目"),
    h("div",{style:{fontFamily:F_BODY,fontSize:11,color:t.fog,lineHeight:1.65,margin:"7px 0 10px"}},"旧诊断为保护隐私只保存证据哈希，无法还原逐字引文。请只处理你确定真实结果的条目；拿不准就保持未了。"),
    rows===null?h("div",{style:{fontFamily:F_BODY,fontSize:12,color:t.fog,padding:"16px 0"}},"正在读取冲突…"):!rows.length?h("div",{style:{fontFamily:F_BODY,fontSize:12,color:t.fog,padding:"18px 0",textAlign:"center"}},"没有待处理的结局冲突"):rows.map(row=>{const mem=byId.get(String(row.oldMemoryId));return h("div",{key:row.oldMemoryId,style:{background:t.bg2,border:"1px solid "+t.line,borderRadius:12,padding:11,marginBottom:9}},
      h("div",{style:{fontFamily:F_BODY,fontSize:12.5,color:t.ink,lineHeight:1.65}},mem?mem.text:"（这条记忆已不在本机镜像中）"),
      h("div",{style:{fontFamily:F_BODY,fontSize:10.5,color:"#9f5149",margin:"6px 0"}},Object.entries(row.kinds||{}).map(([k,n])=>(labels[k]||k)+" ×"+n).join(" · ")),
      h("div",{className:"flex flex-wrap",style:{gap:6}},h("button",{disabled:!!busy,onClick:()=>decide(row,"keep_open"),style:{border:"1px solid "+t.line,borderRadius:999,padding:"5px 9px",fontFamily:F_BODY,fontSize:10.5,color:t.sub}},"保持未了"),...["fulfilled","resolved","abandoned"].map(k=>h("button",{key:k,disabled:!!busy,onClick:()=>decide(row,k),style:{border:"1px solid "+t.tint,borderRadius:999,padding:"5px 9px",fontFamily:F_BODY,fontSize:10.5,color:t.tint}},labels[k])));})));
}

*/
function MemoryRepairConflictSheet({ entries, onList, onDecide, onClose }) {
  const t = useTheme(), [rows, setRows] = useState(null), [busy, setBusy] = useState(null);
  const load = () => { setRows(null); Promise.resolve(onList()).then(x => setRows(x || [])).catch(() => setRows([])); };
  useEffect(load, []);
  const byId = new Map((entries || []).filter(x => x && x.id).map(x => [String(x.id), x]));
  const labels = { fulfilled: "已兑现", resolved: "已解决", abandoned: "明确放弃" };
  const decide = async (row, value) => {
    if (busy) return;
    if (!confirm(value === "keep_open" ? "确认保持这条未了？系统不会替你猜结局。" : "确认真实结局是“" + labels[value] + "”？原正文不会删除。")) return;
    setBusy(row.oldMemoryId);
    try { await onDecide(row, value); setRows(p => (p || []).filter(x => x.oldMemoryId !== row.oldMemoryId)); }
    finally { setBusy(null); }
  };
  return h(Sheet, { onClose },
    h(Eyebrow, null, "RepairGate · 结局冲突过目"),
    h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, lineHeight: 1.65, margin: "7px 0 10px" } }, "旧诊断为保护隐私只保存证据哈希，无法还原逐字引文。请只处理你确定真实结果的条目；拿不准就保持未了。"),
    rows === null ? h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, padding: "16px 0" } }, "正在读取冲突…") :
      !rows.length ? h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, padding: "18px 0", textAlign: "center" } }, "没有待处理的结局冲突") :
        rows.map(row => {
          const mem = byId.get(String(row.oldMemoryId));
          return h("div", { key: row.oldMemoryId, style: { background: t.bg2, border: "1px solid " + t.line, borderRadius: 12, padding: 11, marginBottom: 9 } },
            h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.ink, lineHeight: 1.65 } }, mem ? mem.text : "（这条记忆已不在本机镜像中）"),
            h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: "#9f5149", margin: "6px 0" } }, Object.entries(row.kinds || {}).map(([k, n]) => (labels[k] || k) + " ×" + n).join(" · ")),
            h("div", { className: "flex flex-wrap", style: { gap: 6 } },
              h("button", { disabled: !!busy || !mem, onClick: () => decide(row, "keep_open"), style: { border: "1px solid " + t.line, borderRadius: 999, padding: "5px 9px", fontFamily: F_BODY, fontSize: 10.5, color: t.sub } }, "保持未了"),
              ...["fulfilled", "resolved", "abandoned"].map(k => h("button", { key: k, disabled: !!busy || !mem, onClick: () => decide(row, k), style: { border: "1px solid " + t.tint, borderRadius: 999, padding: "5px 9px", fontFamily: F_BODY, fontSize: 10.5, color: t.tint } }, labels[k]))
            ));
        }));
}

// 向量记忆体检条（她 2026-08-25：「看看我的向量记忆库是不是还是好的」）。
// 只读本机缓存，零请求零花费。三种情况分开说，因为修法不一样。
function VecHealth({ entries }) {
  const t = useTheme();
  const [st, setSt] = useState(null);
  useEffect(() => {
    let dead = false;
    if (typeof memVecStatus !== "function") return;
    memVecStatus(entries || []).then(r => { if (!dead) setSt(r); }).catch(() => {});
    return () => { dead = true; };
  }, [(entries || []).length]);
  if (!st) return null;
  if (!st.on) return h("div", { className: "px-6", style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, lineHeight: 1.5, paddingBottom: 6 } },
    "向量记忆没开 · 聊天挑记忆走关键词检索（能用，只是换个说法就认不出）。要开去 设置 · 向量记忆 API。");
  const bad = (st.missing || 0) + (st.stale || 0);
  return h("div", { className: "px-6", style: { fontFamily: F_BODY, fontSize: 11, lineHeight: 1.5, paddingBottom: 6, color: bad ? t.accent : t.fog } },
    bad === 0
      ? "🟢 向量记忆正常 · " + st.total + " 条全都有向量（" + st.model + "）"
      : "🟡 向量记忆 " + st.ok + "/" + st.total + " 条就绪"
        + (st.missing ? "，" + st.missing + " 条还没建" : "")
        + (st.stale ? "，" + st.stale + " 条过期（改过文本或换过模型）" : "")
        + " · 去 设置 · 向量记忆 API 按「建向量索引」补上");
}
function MemoryLib({
  entries,
  characters,
  focusChar,
  busy,
  cfg,
  oldMemories,
  onBack,
  onAdd,
  onUpdate,
  onDelete,
  onExtract,
  onSaveCfg,
  onImportOld,
  onBackfillEmotion,
  onPurgeWithered,
  onDowngradeRoutineOpen,
  routineOpenCount,
  onScanDuplicates,
  onArchiveDuplicateGroups,
  onScanEventMerges,
  onArchiveEventMergeGroups,
  onScanRoutineMemories,
  onArchiveRoutineGroups,
  onListRepairConflicts,
  onDecideRepairConflict,
  onRefine,
  onRestoreArchived,
  onBulkImport,
  onAudit,
  onPostCutoverAudit,
  onShadowMigrate,
  migrationBusy,
  onSyncStatus,
  onChatLedgerStatus,
  memoryTableMode,
  onEnableTableMemory,
  onUseLegacyMemory,
  emoBusy
}) {
  const t = useTheme();
  const [showArchived, setShowArchived] = useState(false);
  const [showSuperseded, setShowSuperseded] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [innerLifeOpen, setInnerLifeOpen] = useState(false);
  const [bAxesOpen, setBAxesOpen] = useState(false);
  const [cSleepOpen, setCSleepOpen] = useState(false);
  const [aEmoOpen, setAEmoOpen] = useState(false);
  const [somaticOpen, setSomaticOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false); // 日常页面只留搜索与记忆；低频整理统一收进这里
  const [diagOpen, setDiagOpen] = useState(false); // 工程仪表抽屉：默认合拢，别压着记忆
  const [duplicatePreview, setDuplicatePreview] = useState(null);
  const [eventMergePreview, setEventMergePreview] = useState(null);
  const [routinePreview, setRoutinePreview] = useState(null);
  const [repairConflictOpen, setRepairConflictOpen] = useState(false);
  const [corrections, setCorrections] = useState([]);
  const [correctionOpen, setCorrectionOpen] = useState(null);
  const [correctionPicking, setCorrectionPicking] = useState(null); // null=关闭；{oldId:null|string}=正在挑旧→新
  const reloadCorrections = () => window.Cloud && window.Cloud.memoryCorrectionCandidatesList
    ? window.Cloud.memoryCorrectionCandidatesList().then(rows => { setCorrections(rows || []); return rows || []; }).catch(() => { setCorrections([]); return []; })
    : Promise.resolve([]);
  useEffect(() => {
    let alive = true;
    if (!(window.Cloud && window.Cloud.memoryCorrectionCandidatesList)) return () => { alive = false; };
    window.Cloud.memoryCorrectionCandidatesList().then(rows => { if (alive) setCorrections(rows || []); }).catch(() => { if (alive) setCorrections([]); });
    return () => { alive = false; };
  }, [entries]);
  // 落灰／快淡了（和 app.js purgeWithered 同判定）：非置顶/非开环/情绪弱(a≤1)/120天没被想起/几乎没被召回(hits<2)。
  // ⚠️只此一处定义：下面卡片上的「快淡了」和这里的计数用同一个函数。
  //   v60.53 我一开始在卡片那儿另写了一份一模一样的判据——「一层写在两处」，
  //   当场被变异测试抓出来（改一处、测试照样绿）。两处引用，一处定义。
  // ⚠️它必须跟 app.js 那条对齐：那边真会按这条把记忆软归档，界面这条是【预告】，
  //   两边说的得是同一批条目，否则她看见的和按钮删掉的不是一回事。
  const isFading = e => !!(e && (e.surfaceState || "active") === "active" && !e.pinned && !e.open
    && (e.a || 0) <= 1 && (e.hits || 0) < 2
    && Date.now() - (Math.max(e.ts || 0, e.lastHit || 0) || Date.now()) >= 120 * 86400000);
  const witheredCount = (entries || []).filter(isFading).length;
  const openTotal = (entries || []).filter(e => e && e.open && (e.surfaceState || "active") === "active").length;
  const cleanupSummary = (() => {
    const rows = entries || [];
    return {
      total: rows.length,
      active: rows.filter(e => e && !e.archived && (e.surfaceState || "active") === "active").length,
      open: rows.filter(e => e && !e.archived && e.open && (e.surfaceState || "active") === "active").length,
      superseded: rows.filter(e => e && (e.surfaceState || "active") === "superseded").length,
      duplicateArchived: rows.filter(e => e && e.archived && String(e.archivedBatch || "").startsWith("dup_")).length,
      eventArchived: rows.filter(e => e && e.archived && String(e.archivedBatch || "").startsWith("eventmerge_")).length,
      routineArchived: rows.filter(e => e && e.archived && String(e.archivedBatch || "").startsWith("routine_")).length,
      otherArchived: rows.filter(e => { const b=String(e&&e.archivedBatch||""); return e&&e.archived&&!b.startsWith("dup_")&&!b.startsWith("eventmerge_")&&!b.startsWith("routine_"); }).length,
      routine: rows.filter(e => e && e.routineOpenDowngradedTs).length
    };
  })();
  const [filter, setFilter] = useState(focusChar ? focusChar.id : "all");
  const [editing, setEditing] = useState(null); // "new" | entry
  const [cfgOpen, setCfgOpen] = useState(false); // 召回设置弹层
  const [q, setQ] = useState(""); // 搜索
  const [statusFilter, setStatusFilter] = useState("all"); // all | open | pinned；状态与角色各管一层
  const nameOf = id => {
    const c = characters.find(x => x.id === id);
    return c ? c.remark || c.name : "未知";
  };
  // 情绪徽标：显愉悦度带符号 + 强度点数，颜色随愉悦度暖/冷/中（Ombre Brain 借鉴）。未评估(无 a)不显示
  const emoBadge = e => {
    if (typeof e.a !== "number") return null;
    const v = e.v || 0, a = e.a;
    const col = v >= 2 ? "#c98a3c" : v <= -2 ? "#5f7c9a" : "#9a9082";
    return h("span", { key: "emo", title: "愉悦度 " + v + " · 强度 " + a, style: { display: "inline-flex", alignItems: "center", gap: 4, fontFamily: F_BODY, fontSize: 10, fontWeight: 700, color: "#fff", background: col, padding: "1px 7px", borderRadius: 999 } },
      (v > 0 ? "＋" : v < 0 ? "－" : "") + Math.abs(v), h("span", { style: { opacity: 0.7 } }, "·"), "🔥" + a);
  };
  const unrated = (entries || []).filter(e => e && typeof e.a !== "number").length;
  // 来源徽标（珊瑚岛「记忆诚实性」lite）：一眼分清这条记忆是怎么来的——亲历对话/手写/导入/精炼/本体亲笔
  const SRC_BADGE = { manual: ["✍️ 手写", "#8a7a5c"], chat: ["💬 亲历", "#7d8a6e"], auto: ["💬 亲历", "#7d8a6e"], import: ["📥 导入", "#8a8a8a"], monthly: ["🗂 精炼", "#9a8298"], mcp: ["🖋 本体", "#9e8260"] };
  const srcBadge = e => {
    const b = SRC_BADGE[e.source];
    return b ? h("span", { key: "src", title: "记忆来源", style: { fontFamily: F_BODY, fontSize: 10, color: "#fff", background: b[1], padding: "1px 7px", borderRadius: 999, opacity: 0.9 } }, b[0]) : null;
  };
  // 精炼摘要可回溯（玄参#6）：refineBatch ↔ 原件 archivedBatch 同号，数一下有几条原件
  const refineBatchOf = e => e && e.refineBatch ? String(e.refineBatch)
    : (e && e.source === "monthly" && e.ts ? "rf_" + Number(e.ts) : null);
  const refineSrcCount = e => { const batch = refineBatchOf(e); return batch ? (entries || []).filter(x => x && x.archived && x.archivedBatch === batch).length : 0; };
  // 可精炼旧记忆数（和 app.js isRefinable 同判定）：已了结/非置顶/情绪弱(a≤2)/放了 60+ 天/未归档；按当前筛选范围算
  const inScope = e => filter === "all" || !e.charIds || e.charIds.length === 0 || e.charIds.includes(filter);
  const refinableCount = (entries || []).filter(e => { const now = Date.now(); return e && e.text && (e.surfaceState || "active") === "active" && !e.pinned && !e.open && !e.archived && e.source !== "monthly" && (e.a || 0) <= 2 && now - (e.ts || 0) >= 60 * 86400000 && inScope(e); }).length;
  const archived = (entries || []).filter(e => e && e.archived && inScope(e)).slice().sort((a, b) => (b.archivedTs || 0) - (a.archivedTs || 0));
  const superseded = (entries || []).filter(e => e && (e.surfaceState || "active") === "superseded" && inScope(e)).slice().sort((a, b) => (b.ts || 0) - (a.ts || 0));
  const qlc = q.trim().toLowerCase();
  const list = (entries || []).filter(e => !e.archived && (e.surfaceState || "active") === "active"
    && (statusFilter === "all" || (statusFilter === "open" && e.open) || (statusFilter === "pinned" && e.pinned))
    && (filter === "all" || !e.charIds || e.charIds.length === 0 || e.charIds.includes(filter))
    && (!qlc || (String(e.text || "") + " " + (e.tags || []).join(" ") + " " + (e.charIds || []).map(nameOf).join(" ")).toLowerCase().indexOf(qlc) >= 0))
    .slice().sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (b.ts || 0) - (a.ts || 0));
  const activeTotal = (entries || []).filter(e => e && !e.archived && (e.surfaceState || "active") === "active" && inScope(e)).length;
  const pinnedTotal = (entries || []).filter(e => e && !e.archived && e.pinned && (e.surfaceState || "active") === "active" && inScope(e)).length;
  const visibleOpenTotal = (entries || []).filter(e => e && !e.archived && e.open && (e.surfaceState || "active") === "active" && inScope(e)).length;
  const historyTotal = superseded.length + archived.length;
  const sourceLabelOf = e => ({ manual: "手写", chat: "聊天留下", auto: "聊天留下", import: "旧事导入", monthly: "旧忆精炼", mcp: "角色亲笔" })[e && e.source] || ((e && e.tags || []).includes("群聊") ? "群聊留下" : (e && e.tags || []).includes("线下") ? "线下留下" : "自然记下");
  const audienceOf = e => !e.charIds || e.charIds.length === 0 ? "所有角色可见" : e.charIds.map(nameOf).join("、");
  const shortDateOf = e => {
    const d = new Date(e.ts || Date.now());
    return { month: String(d.getMonth() + 1).padStart(2, "0"), day: String(d.getDate()).padStart(2, "0"), year: d.getFullYear() };
  };
  const importable = focusChar && oldMemories && (oldMemories[focusChar.id] || "").trim();
  const pickCorrectionRow = async e => {
    if (!correctionPicking) return false;
    if (!correctionPicking.oldId) { setCorrectionPicking({ oldId: e.id }); window.__toast && window.__toast("旧说法已选；现在点那条正确的新说法"); return true; }
    if (correctionPicking.oldId === e.id) { window.__toast && window.__toast("新旧不能是同一条"); return true; }
    try {
      const rows = await window.Cloud.memoryRowsFetchByIds([correctionPicking.oldId, e.id]);
      const oldRow = rows.find(x => x.id === correctionPicking.oldId), newRow = rows.find(x => x.id === e.id);
      if (!oldRow || !newRow) throw new Error("权威表里缺少其中一条");
      const made = await window.Cloud.memoryCorrectionCreate(oldRow.id, newRow.id, oldRow.revision, newRow.revision, "manual");
      setCorrectionPicking(null); await reloadCorrections();
      const cid = made && made.candidate && made.candidate.id;
      const latest = await window.Cloud.memoryCorrectionCandidatesList();
      const cand = (latest || []).find(x => x.id === cid);
      if (cand) setCorrectionOpen(cand);
      window.__toast && window.__toast("纠错候选已建好，请核对新旧两条");
    } catch (err) { window.__toast && window.__toast("候选没建成：" + (err.message || err)); }
    return true;
  };
  return h("div", {
    className: "h-full flex flex-col"
  }, h("div", {
    className: "shrink-0 px-4 pb-2",
    style: { paddingTop: safeTop(10), borderBottom: "1px solid " + t.line, background: t.bg }
  }, h("div", { style: { display: "grid", gridTemplateColumns: "76px minmax(0,1fr) 76px", alignItems: "center", minHeight: 42 } },
    h("div", { className: "flex justify-start" },
      h("button", { onClick: onBack, "aria-label": "返回", className: "active:opacity-50 flex items-center justify-center", style: { width: 40, height: 40, marginLeft: -8 } }, h(IArrow, { size: 19, color: t.ink }))),
    h("div", { className: "min-w-0 text-center" },
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: 17, color: t.ink, lineHeight: 1.15 } }, "记忆库"),
      h("div", { style: { fontFamily: F_BODY, fontSize: 9.5, color: t.fog, letterSpacing: ".16em", marginTop: 3 } }, "MEMORY INDEX")),
    h("div", { className: "flex items-center justify-end", style: { gap: 2 } },
      h("button", { onClick: () => { setManageOpen(true); setDiagOpen(false); }, "aria-label": "整理与维护", className: "active:opacity-50 flex items-center justify-center", style: { width: 36, height: 40, position: "relative" } },
        h(GConfig, { size: 18, color: t.sub }),
        corrections.length ? h("span", { style: { position: "absolute", top: 6, right: 5, width: 6, height: 6, borderRadius: 999, background: t.accent, boxShadow: "0 0 0 2px " + t.bg } }) : null),
      h("button", { onClick: () => setEditing("new"), "aria-label": "新增记忆", className: "active:opacity-50 flex items-center justify-center", style: { width: 36, height: 40 } }, h(IPlus, { size: 20, color: t.ink })))))
  , importOpen && onBulkImport ? h(MemImportSheet, { characters: characters, defaultCharId: focusChar ? focusChar.id : (filter !== "all" ? filter : null), onImport: onBulkImport, onClose: () => setImportOpen(false) }) : null,
  innerLifeOpen ? h(InnerLifeEDiagnosticSheet, { characters, onClose: () => setInnerLifeOpen(false) }) : null,
  bAxesOpen ? h(InnerLifeBDiagnosticSheet, { characters, onClose: () => setBAxesOpen(false) }) : null,
  cSleepOpen ? h(InnerLifeCDiagnosticSheet, { characters, onClose: () => setCSleepOpen(false) }) : null,
  aEmoOpen ? h(InnerLifeADiagnosticSheet, { characters, onClose: () => setAEmoOpen(false) }) : null,
  somaticOpen ? h(SomaticDiagnosticSheet, { characters, onClose: () => setSomaticOpen(false) }) : null,
  duplicatePreview ? h(MemoryDuplicatePreviewSheet, { groups: duplicatePreview, onConfirm: onArchiveDuplicateGroups, onClose: () => setDuplicatePreview(null) }) : null,
  eventMergePreview ? h(MemoryDuplicatePreviewSheet, { mode: "event", groups: eventMergePreview.groups || [], stats: eventMergePreview.stats || {}, onConfirm: onArchiveEventMergeGroups, onClose: () => setEventMergePreview(null) }) : null,
  routinePreview ? h(MemoryDuplicatePreviewSheet, { mode: "routine", groups: routinePreview.groups || [], stats: routinePreview.stats || {}, onConfirm: onArchiveRoutineGroups, onClose: () => setRoutinePreview(null) }) : null,
  repairConflictOpen ? h(MemoryRepairConflictSheet,{entries,onList:onListRepairConflicts,onDecide:onDecideRepairConflict,onClose:()=>setRepairConflictOpen(false)}) : null,
  correctionOpen ? h(MemoryCorrectionPreviewSheet, { candidate: correctionOpen, onDecided: () => setCorrections(p => p.filter(x => x.id !== correctionOpen.id)), onClose: () => setCorrectionOpen(null) }) : null,
  manageOpen ? h(Sheet, { onClose: () => { setManageOpen(false); setDiagOpen(false); }, tall: true, scrollKey: diagOpen ? "diagnostics" : "manage" },
  h("div", { className: "flex items-baseline justify-between", style: { marginBottom: 12 } },
    h("div", null,
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: 21, color: t.ink } }, "整理记忆库"),
      h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: t.fog, letterSpacing: ".12em", marginTop: 3 } }, "TOOLS & DIAGNOSTICS")),
    h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog } }, cleanupSummary.active + " 条在册")),
  h(VecHealth, { entries: entries }),
  h("div", { className: "rounded-2xl p-3 mb-2", style: { background: t.bg2, border: "1px solid " + t.line } },
    h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14, color: t.ink, marginBottom: 8 } }, "日常工具"),
    h("div", { style: { display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 7 } },
      onSaveCfg ? h("button", { onClick: () => { setManageOpen(false); setCfgOpen(true); }, className: "rounded-xl py-2.5 active:opacity-60", style: { border: "1px solid " + t.line, color: t.ink, fontFamily: F_BODY, fontSize: 12 } }, "召回与上下文设置") : null,
      onBulkImport ? h("button", { onClick: () => { setManageOpen(false); setImportOpen(true); }, className: "rounded-xl py-2.5 active:opacity-60", style: { border: "1px solid " + t.line, color: t.ink, fontFamily: F_BODY, fontSize: 12 } }, "导入长文") : null,
      focusChar && onExtract ? h("button", { onClick: onExtract, disabled: busy, className: "rounded-xl py-2.5 active:opacity-60 disabled:opacity-40", style: { border: "1px solid " + t.line, color: t.sub, fontFamily: F_BODY, fontSize: 12 } }, busy ? "抽取中…" : "从当前对话提取") : null,
      importable && onImportOld ? h("button", { onClick: () => onImportOld(focusChar.id), disabled: busy, className: "rounded-xl py-2.5 active:opacity-60 disabled:opacity-40", style: { border: "1px solid " + t.line, color: t.sub, fontFamily: F_BODY, fontSize: 12 } }, "导入旧长期记忆") : null,
      onBackfillEmotion && unrated > 0 ? h("button", { onClick: onBackfillEmotion, disabled: emoBusy, className: "rounded-xl py-2.5 active:opacity-60 disabled:opacity-40", style: { border: "1px solid " + t.line, color: t.sub, fontFamily: F_BODY, fontSize: 12 } }, emoBusy ? "评估中…" : "补旧记忆情绪 · " + unrated) : null,
      onRefine && refinableCount >= 8 ? h("button", { onClick: () => onRefine(filter), disabled: emoBusy, className: "rounded-xl py-2.5 active:opacity-60 disabled:opacity-40", style: { border: "1px solid " + t.line, color: t.sub, fontFamily: F_BODY, fontSize: 12 } }, emoBusy ? "精炼中…" : "旧版月度精炼 · " + refinableCount) : null),
    h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, lineHeight: 1.5, marginTop: 8 } }, "自动记忆平时不用照料；这里保留导入、旧库维护与参数调节。月度精炼不会自动运行。")),
  h("button", { onClick: () => setDiagOpen(v => !v), className: "w-full rounded-xl py-2 mb-2 active:opacity-60 flex items-center justify-between px-4", style: { border: "1px dashed " + t.line, color: t.sub, fontFamily: F_BODY, fontSize: 12 } },
    h("span", null, "🔬 诊断与审计 · 工程仪表"), h("span", { style: { color: t.fog, fontSize: 10.5 } }, diagOpen ? "收起 ▾" : "展开 ▸")),
  diagOpen ? h(React.Fragment, null,
  h("div", { className: "rounded-2xl p-3 mb-2", style: { background: t.bg2, border: "1px solid " + t.line } },
    h("div", { style: { fontFamily: F_DISPLAY, fontSize: 13.5, color: t.ink, marginBottom: 8 } }, "记忆清理总览"),
    h("div", { style: { display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: "7px 12px" } },
      [["总记忆", cleanupSummary.total], ["活跃可召回", cleanupSummary.active], ["未了开环", cleanupSummary.open], ["已被替代", cleanupSummary.superseded], ["重复软归档", cleanupSummary.duplicateArchived], ["事件过程归档", cleanupSummary.eventArchived], ["流水软归档", cleanupSummary.routineArchived], ["其他归档", cleanupSummary.otherArchived], ["生活流水（已降级）", cleanupSummary.routine]].map(([label, value]) => h("div", { key: label, className: "flex items-center justify-between", style: { fontFamily: F_BODY, fontSize: 11.5, color: t.sub } }, h("span", null, label), h("span", { style: { color: t.ink, fontWeight: 700 } }, String(value))))),
    h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, lineHeight: 1.55, marginTop: 8 } }, "数字只做盘点，不会自动删除或改写任何记忆。")),
  window.ShadowReview ? h("button", {
    onClick: async () => { try { await window.ShadowReview.download(characters, typeof APP_VERSION !== "undefined" ? APP_VERSION : null); window.__toast && window.__toast("转正评审包已导出：只含影子数字与状态"); } catch (e) { window.__toast && window.__toast("评审包导出失败：" + (e.message || e)); } },
    className: "w-full rounded-xl py-2.5 mb-2 active:opacity-60",
    style: { border: "1px solid " + t.tint, color: t.tint, fontFamily: F_BODY, fontSize: 12.5 }
  }, "📋 一键导出 Shadow 转正评审包") : null,
  onScanDuplicates ? h("button", { onClick: () => { setManageOpen(false); setDuplicatePreview(onScanDuplicates()); }, className: "w-full rounded-xl py-2.5 mb-2 active:opacity-60", style: { border: "1px dashed " + t.tint, color: t.tint, fontFamily: F_BODY, fontSize: 12.5 } }, "🧹 扫描重复记忆 · 先预览再软归档") : null,
  onScanEventMerges ? h("button", { onClick: () => { setManageOpen(false); setEventMergePreview(onScanEventMerges()); }, className: "w-full rounded-xl py-2.5 mb-2 active:opacity-60", style: { border: "1px dashed " + t.tint, color: t.tint, fontFamily: F_BODY, fontSize: 12.5 } }, "🧵 收拢同一事件进展 · 先预览再确认") : null,
  onScanRoutineMemories ? h("button", { onClick: () => { setManageOpen(false); setRoutinePreview(onScanRoutineMemories()); }, className: "w-full rounded-xl py-2.5 mb-2 active:opacity-60", style: { border: "1px dashed " + t.tint, color: t.tint, fontFamily: F_BODY, fontSize: 12.5 } }, "🧺 日常流水清仓 · 逐条预览再软归档") : null,
  onListRepairConflicts ? h("button",{onClick:()=>{setManageOpen(false);setRepairConflictOpen(true);},className:"w-full rounded-xl py-2.5 mb-2 active:opacity-60",style:{border:"1px dashed #9f5149",color:"#9f5149",fontFamily:F_BODY,fontSize:12.5}},"⚖️ RepairGate 结局冲突 · 人工过目") : null,
  h("button", { onClick: () => { setManageOpen(false); setAEmoOpen(true); }, className: "w-full rounded-xl py-2.5 mb-2 active:opacity-60", style: { border: "1px dashed " + t.tint, color: t.tint, fontFamily: F_BODY, fontSize: 12.5 } }, "🫀 A 情绪统一 · 查看纯影子诊断"),
  h("button", { onClick: () => { setManageOpen(false); setSomaticOpen(true); }, className: "w-full rounded-xl py-2.5 mb-2 active:opacity-60", style: { border: "1px dashed " + t.tint, color: t.tint, fontFamily: F_BODY, fontSize: 12.5 } }, "🫧 五感系统 · 查看全角色纯影子诊断"),
  h("button", { onClick: () => { setManageOpen(false); setInnerLifeOpen(true); }, className: "w-full rounded-xl py-2.5 mb-2 active:opacity-60", style: { border: "1px dashed " + t.tint, color: t.tint, fontFamily: F_BODY, fontSize: 12.5 } }, "🌙 E 余温与潮汐 · 诊断与试点"), h("button", { onClick: () => { setManageOpen(false); setBAxesOpen(true); }, className: "w-full rounded-xl py-2.5 mb-2 active:opacity-60", style: { border: "1px dashed " + t.tint, color: t.tint, fontFamily: F_BODY, fontSize: 12.5 } }, "🧵 B 关系轴 · 查看纯影子诊断"), h("button", { onClick: () => { setManageOpen(false); setCSleepOpen(true); }, className: "w-full rounded-xl py-2.5 mb-2 active:opacity-60", style: { border: "1px dashed " + t.tint, color: t.tint, fontFamily: F_BODY, fontSize: 12.5 } }, "😴 C 睡眠与发声闸 · 查看纯影子诊断"), onAudit ? h("button", {
    onClick: onAudit,
    className: "w-full rounded-xl py-2.5 mb-2 active:opacity-60",
    style: { border: "1px dashed " + t.line, color: t.sub, fontFamily: F_BODY, fontSize: 12.5 }
  }, "🧾 只读迁移审计 · 导出本机/旧云备份与指纹") : null, onShadowMigrate ? h("button", {
    onClick: () => { if (confirm("只把锁定的390条逐行复制到新表并当场核对，不切换读取、不删除旧记忆。现在开始吗？")) onShadowMigrate(); },
    disabled: migrationBusy,
    className: "w-full rounded-xl py-2.5 mb-2 active:opacity-60 disabled:opacity-40",
    style: { border: "1px dashed " + t.tint, color: t.tint, fontFamily: F_BODY, fontSize: 12.5 }
  }, migrationBusy ? "正在逐行迁移并核对…" : "🚚 迁移390条到影子表 · 不切读取") : null, onSyncStatus ? h("button", {
    onClick: onSyncStatus,
    className: "w-full rounded-xl py-2.5 mb-2 active:opacity-60",
    style: { border: "1px dashed " + t.line, color: t.fog, fontFamily: F_BODY, fontSize: 12.5 }
  }, memoryTableMode ? "✅ 新记忆表是当前权威 · 查看同步状态" : "🔄 查看行级影子同步状态") : null,
  onChatLedgerStatus ? h("button", {
    onClick: onChatLedgerStatus,
    className: "w-full rounded-xl py-2.5 mb-2 active:opacity-60",
    style: { border: "1px dashed " + t.tint, color: t.tint, fontFamily: F_BODY, fontSize: 12.5 }
  }, "💬 CC 回流影子 · 拉取并查看诊断（不注入）") : null,
  memoryTableMode && onPostCutoverAudit ? h("button", {
    onClick: onPostCutoverAudit,
    className: "w-full rounded-xl py-2.5 mb-2 active:opacity-60",
    style: { border: "1px dashed " + t.tint, color: t.tint, fontFamily: F_BODY, fontSize: 12.5 }
  }, "🧪 权威表纪律复核 · 逐 ID 只读导出") : null,
  !memoryTableMode && onEnableTableMemory ? h("button", {
    onClick: () => { if (confirm("会先把本机旧库与新表逐 ID 核对；全部一致、待发送为 0 才会启用。旧镜像和回退闸都会保留。现在验收并启用吗？")) onEnableTableMemory(); },
    disabled: migrationBusy,
    className: "w-full rounded-xl py-2.5 mb-2 active:opacity-60 disabled:opacity-40",
    style: { border: "1px solid " + t.tint, color: t.tint, fontFamily: F_BODY, fontSize: 12.5 }
  }, migrationBusy ? "正在逐 ID 验收…" : "🛟 逐 ID 验收并启用新记忆表") : null,
  memoryTableMode && onUseLegacyMemory ? h("button", {
    onClick: () => { if (confirm("紧急改回本机旧镜像读取？不会删除新表或任何记忆；重新启用前不要在两边同时修改。")) onUseLegacyMemory(); },
    className: "w-full rounded-xl py-2.5 mb-2 active:opacity-60",
    style: { border: "1px dashed " + t.line, color: t.fog, fontFamily: F_BODY, fontSize: 11.5 }
  }, "紧急回退：改读本机镜像") : null) : null,
  corrections.length ? h("div", { style: { border: "1px dashed " + t.tint, borderRadius: 11, padding: "8px 10px", marginBottom: 8 } },
    h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.sub, marginBottom: 5 } }, "🧷 待你定夺的纠错候选 " + corrections.length + " 条"),
    corrections.slice(0, 5).map(c => h("button", { key: c.id, onClick: () => { setManageOpen(false); setCorrectionOpen(c); }, className: "w-full text-left active:opacity-60", style: { fontFamily: F_BODY, fontSize: 11, color: t.ink, padding: "5px 0", borderTop: "1px dashed " + t.line } },
      ({ more_detailed: "更详细", contradiction: "事实纠正", manual: "手动纠正" })[c.reason] || c.reason, " · ", String(c.updated_at || "").slice(0,10)))) : null,
  h("button", { onClick: () => { setCorrectionPicking(p => p ? null : { oldId: null }); setManageOpen(false); }, className: "w-full rounded-lg py-2 mb-2 active:opacity-70", style: { border: "1px dashed " + (correctionPicking ? "#9f5149" : t.line), color: correctionPicking ? "#9f5149" : t.fog, fontFamily: F_BODY, fontSize: 11.5 } },
    correctionPicking ? (correctionPicking.oldId ? "已选旧说法 · 现在点正确的新说法（取消）" : "现在点一条错误的旧说法（取消）") : "🪡 手动挑两条做事实纠正"),
  h("button", { onClick: () => { setManageOpen(false); setDiagOpen(false); }, className: "w-full py-1.5 mb-2 active:opacity-60", style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog } }, "收起整理工具")) : null,
  h("div", { className: "flex-1 min-h-0 overflow-y-auto px-5 pb-10", style: { WebkitOverflowScrolling: "touch", overscrollBehavior: "contain" } },
    h("div", { style: { margin: "14px 0 12px", padding: "13px 4px 12px", borderTop: "1px solid " + t.line, borderBottom: "1px solid " + t.line } },
      h("div", { className: "flex items-baseline justify-between", style: { marginBottom: 10 } },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15.5, color: t.ink } }, focusChar ? (focusChar.remark || focusChar.name) + " 的记忆索引" : "记忆索引"),
        h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: t.fog, letterSpacing: ".08em" } }, "自动归档 · 可手动校正")),
      h("div", { style: { display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))" } },
        [["在册", activeTotal], ["常驻", pinnedTotal], ["未了", visibleOpenTotal], ["留档", historyTotal]].map(([label, value], i) => h("div", { key: label, style: { textAlign: "center", borderLeft: i ? "1px solid " + t.line : "none" } },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 19, color: label === "未了" && value ? "#a66550" : t.ink, lineHeight: 1 } }, String(value)),
          h("div", { style: { fontFamily: F_BODY, fontSize: 9.5, color: t.fog, marginTop: 5, letterSpacing: ".08em" } }, label))))),
    h(EventShelfSection, { characters: characters, entries: entries }),
    h("div", { className: "flex items-center", style: { height: 40, background: t.bg2, border: "1px solid " + t.line, borderRadius: 13, padding: "0 12px", margin: "10px 0" } },
      h(ISearch, { size: 15, color: t.fog }),
      h("input", { value: q, onChange: e => setQ(e.target.value), placeholder: "搜一句话、标签或记得这件事的人",
        className: "flex-1 min-w-0 outline-none", style: { fontFamily: F_BODY, fontSize: 13, color: t.ink, background: "transparent", border: "none", padding: "0 0 0 9px" } })),
    // 状态那三档：不摆一排药丸（tabs-not-plain-pills）。
    // 先问这东西现实里是什么——记忆库是一盒卡片，这三档是【盒里分出来的三摞】，
    // 而「常驻」是钉住的那张、「未了」是折了角的那张。所以每一档就长成它自己：
    // 一摞纸（全部）／钉着的一张（常驻）／折了角的一张（未了）。
    // 选中那一摞抽出来立正（纸色、抬高、带阴影），没选中的矮一截、暗着、像还压在盒里。
    h("div", { className: "flex items-end", style: { gap: 8, marginBottom: 11, paddingLeft: 2 } },
      [["all", "全部", activeTotal], ["open", "未了", visibleOpenTotal], ["pinned", "常驻", pinnedTotal]].map(([id, label, n]) => {
        const on = statusFilter === id;
        return h("button", { key: id, onClick: () => setStatusFilter(id), className: "active:opacity-70",
          style: { position: "relative", width: 70, height: on ? 54 : 43, transition: "height .16s", textAlign: "center" } },
          // 底下那两层纸边：只有「全部」是一摞，另外两档是单张
          id === "all" ? h(Fragment, null,
            h("span", { "aria-hidden": "true", style: { position: "absolute", left: 5, right: 1, top: 4, bottom: 0, borderRadius: 5, background: t.bg2, border: "1px solid " + t.line, opacity: on ? 0.9 : 0.5 } }),
            h("span", { "aria-hidden": "true", style: { position: "absolute", left: 3, right: 3, top: 2, bottom: 0, borderRadius: 5, background: t.bg2, border: "1px solid " + t.line, opacity: on ? 0.95 : 0.6 } })) : null,
          h("span", { style: { position: "absolute", left: 0, right: 6, top: 0, bottom: 0, borderRadius: 5,
            background: on ? "#fbf9f5" : t.bg2, border: "1px solid " + (on ? t.ink : t.line),
            boxShadow: on ? "0 3px 9px rgba(0,0,0,.13)" : "none",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1,
            // 折角：未了那一张右上角真的缺一块
            clipPath: id === "open" ? "polygon(0 0, calc(100% - 11px) 0, 100% 11px, 100% 100%, 0 100%)" : "none",
            opacity: on ? 1 : 0.62 } },
            h("span", { style: { fontFamily: F_DISPLAY, fontSize: on ? 14 : 12.5, lineHeight: 1.1, color: t.ink } }, label),
            h("span", { style: { fontFamily: F_BODY, fontSize: 9.5, color: on ? t.sub : t.fog, marginTop: 1 } }, n + " 张"),
            // 卡片上那条横线：索引卡本来就是印着线的
            h("span", { "aria-hidden": "true", style: { position: "absolute", left: 8, right: 8, bottom: 7, height: 1, background: t.line, opacity: on ? 1 : 0.6 } })),
          // 折角那一张：把翻起来的那个小三角画出来，不然只是右上角缺了一块、看不出是折的
          id === "open" ? h("span", { "aria-hidden": "true", style: { position: "absolute", right: 6, top: 0, width: 11, height: 11,
            background: on ? t.line : "transparent", borderLeft: "1px solid " + (on ? t.ink : t.line), borderBottom: "1px solid " + (on ? t.ink : t.line),
            clipPath: "polygon(0 0, 100% 100%, 0 100%)", opacity: on ? 1 : 0.62 } }) : null,
          // 常驻那张上头钉着一枚图钉
          id === "pinned" ? h("span", { "aria-hidden": "true", style: { position: "absolute", left: "50%", top: -3, marginLeft: -9,
            width: 6, height: 6, borderRadius: 999, background: on ? t.tint : t.fog, boxShadow: "0 0 0 2px " + t.bg } }) : null);
      })),
    // 换人不摆一行下划线文字：这个 app 认人靠【脸】，跟关系网那条脸条同一套语汇。
    // 「所有人」那一格摞着几张小脸，一眼看得出它是「全部」而不是某个人。
    characters.length ? h("div", { className: "flex items-end overflow-x-auto", style: { gap: 9, paddingBottom: 12 } },
      [["all", null]].concat(characters.map(c => [c.id, c])).map(([id, c]) => {
        const on = filter === id;
        const sz = on ? 38 : 28;
        return h("button", { key: id, onClick: () => setFilter(id), className: "shrink-0 active:opacity-70",
          style: { textAlign: "center", paddingTop: on ? 0 : 5, transition: "padding .16s" } },
          h("div", { style: { width: sz, height: sz, borderRadius: 10, overflow: "hidden", margin: "0 auto", position: "relative",
            opacity: on ? 1 : 0.45, filter: on ? "none" : "grayscale(0.7)",
            boxShadow: on ? "0 2px 8px rgba(0,0,0,.18)" : "none", transition: "all .16s" } },
            id === "all"
              ? (() => {
                  // 「所有人」＝几张脸摞在一起：居中、依次错开、后面的压在前面底下
                  const few = characters.slice(0, 3);
                  const f = Math.round(sz * 0.52), step = Math.round(sz * 0.17);
                  const w = f + step * (few.length - 1);
                  return h("div", { style: { width: "100%", height: "100%", position: "relative", background: t.bg2, border: "1px solid " + t.line, borderRadius: 10 } },
                    few.map((x, i) => h("div", { key: x.id, style: { position: "absolute", left: "50%", top: "50%",
                      marginLeft: -w / 2 + i * step, marginTop: -f / 2, width: f, height: f, borderRadius: 3, overflow: "hidden",
                      boxShadow: "0 0 0 1px " + t.bg2, zIndex: few.length - i } },
                      h(Avatar, { character: x, size: f, radius: 0 }))));
                })()
              : h(Avatar, { character: c, size: sz, radius: 0 })),
          on ? h("div", { style: { fontFamily: F_BODY, fontSize: 9.5, color: t.ink, marginTop: 3, maxWidth: 56, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } },
            id === "all" ? "所有人" : (c.remark || c.name)) : null);
      })) : null,
    h("div", { className: "flex items-center justify-between", style: { margin: "2px 2px 9px" } },
      h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: t.fog, letterSpacing: ".13em" } }, "INDEX / " + list.length),
      correctionPicking ? h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: "#9f5149" } }, correctionPicking.oldId ? "点正确的新说法" : "点错误的旧说法") : null),
    list.length === 0 && h(Empty, {
      text: qlc ? "没找到这段记忆" : statusFilter === "open" ? "没有未了的事" : statusFilter === "pinned" ? "还没有常驻记忆" : "还没有记忆",
      sub: qlc ? "换个说法、角色名或标签试试" : "点右上角 + 手动记下，聊天也会自动沉淀"
    }),
    list.map((e, index) => {
      const d = shortDateOf(e);
      const tags = (e.tags || []).slice(0, 2);
      const faded = isFading(e);
      const states = [e.open ? "未了" : "", e.pinned ? "常驻" : "", faded ? "快淡了" : ""].filter(Boolean);
      const accent = e.open ? "#b06a4f" : e.pinned ? t.tint : t.line;
      const trace = refineSrcCount(e);
      return h("button", {
        key: e.id,
        onClick: () => { if (!correctionPicking) setEditing(e); else pickCorrectionRow(e); },
        "aria-label": "编辑记忆",
        className: "w-full text-left flex active:opacity-75",
        style: { gap: 10, marginBottom: 10 }
      },
        h("div", { className: "shrink-0", style: { width: 38, textAlign: "center", paddingTop: 9, position: "relative" } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 9, color: t.fog, letterSpacing: ".08em" } }, d.month + "/" + d.day),
          // 情绪不再报数字（原来写「情绪 +4 · 强度 2」——那是把内部记分板端上桌）。
          // 它就画在时间轴上那颗点里：颜色是当时的心情，大小是这件事有多重。
          // 没评过情绪的是一颗空心小点，一眼看得出「这条还没评」。
          (() => {
            const rated = typeof e.a === "number";
            const a = rated ? Math.max(0, Math.min(5, e.a)) : 0;
            const v = e.v || 0;
            const dia = rated ? 5 + a * 1.7 : 6;
            const col = !rated ? "transparent" : v >= 2 ? "#c98a3c" : v <= -2 ? "#5f7c9a" : "#9a9082";
            return h("span", {
              title: rated ? "心情 " + (v > 0 ? "+" : "") + v + " · 分量 " + a : "还没评过情绪",
              style: { display: "inline-block", width: dia, height: dia, borderRadius: 999,
                background: col, border: rated ? "none" : "1px solid " + t.fog,
                opacity: faded ? 0.4 : 1,
                boxShadow: "0 0 0 4px " + t.bg, marginTop: 9 + (13 - dia) / 2 } });
          })(),
          index < list.length - 1 ? h("span", { "aria-hidden": "true", style: { position: "absolute", width: 1, background: t.line, left: 18.5, top: 34, bottom: -20 } }) : null),
        h("div", { className: "flex-1 min-w-0", style: { background: t.bg2, border: "1px solid " + t.line, borderRadius: 15, padding: "11px 13px 10px", boxShadow: "inset 3px 0 0 " + accent } },
          h("div", { className: "flex items-center justify-between", style: { gap: 10, marginBottom: 7 } },
            h("div", { className: "truncate", style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog } }, audienceOf(e) + " · " + sourceLabelOf(e)),
            states.length ? h("div", { className: "shrink-0", style: { fontFamily: F_BODY, fontSize: 10, color: e.open ? "#a66550" : e.pinned ? t.tint : t.fog } }, states.join(" · ")) : null),
          h("div", { style: { fontFamily: F_BODY, fontSize: 14.5, lineHeight: 1.68, color: t.ink, whiteSpace: "pre-wrap", overflowWrap: "anywhere" } }, e.text),
          (tags.length || trace) ? h("div", { className: "flex flex-wrap items-center", style: { gap: "3px 8px", marginTop: 8, paddingTop: 7, borderTop: "1px solid " + t.line } },
            tags.map((tag, i) => h("span", { key: "tag_" + i, style: { fontFamily: F_BODY, fontSize: 10, color: t.sub } }, "#" + tag)),
            (e.tags || []).length > 2 ? h("span", { style: { fontFamily: F_BODY, fontSize: 10, color: t.fog } }, "+" + ((e.tags || []).length - 2)) : null,
            trace ? h("span", { title: "原件仍在归档里", style: { fontFamily: F_BODY, fontSize: 10, color: t.fog } }, "由 " + trace + " 条旧忆收拢") : null) : null));
    }),
    (superseded.length || archived.length) ? h("div", { style: { marginTop: 18, paddingTop: 13, borderTop: "1px solid " + t.line } },
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14, color: t.sub, marginBottom: 4 } }, "历史索引"),
      h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginBottom: 5 } }, "不参与日常召回，但仍留得下出处和原文。"),
      superseded.length ? h(React.Fragment, null,
        h("button", { onClick: () => setShowSuperseded(s => !s), className: "w-full flex items-center justify-between active:opacity-60", style: { fontFamily: F_BODY, fontSize: 12, color: t.sub, padding: "10px 0", borderBottom: "1px solid " + t.line } },
          h("span", null, "旧说法留档"), h("span", { style: { color: t.fog } }, superseded.length + " 条 " + (showSuperseded ? "▾" : "›"))),
        showSuperseded ? h("div", null, superseded.slice(0, 100).map(e => h("div", { key: e.id, style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, lineHeight: 1.65, padding: "8px 2px", borderBottom: "1px dashed " + t.line, whiteSpace: "pre-wrap" } }, e.text))) : null) : null,
      archived.length ? h(React.Fragment, null,
        h("button", { onClick: () => setShowArchived(s => !s), className: "w-full flex items-center justify-between active:opacity-60", style: { fontFamily: F_BODY, fontSize: 12, color: t.sub, padding: "10px 0", borderBottom: "1px solid " + t.line } },
          h("span", null, "精炼与整理归档"), h("span", { style: { color: t.fog } }, archived.length + " 条 " + (showArchived ? "▾" : "›"))),
        showArchived ? h("div", null,
          onRestoreArchived ? h("button", { onClick: () => onRestoreArchived(), className: "active:opacity-70", style: { fontFamily: F_BODY, fontSize: 11, color: t.accent, padding: "10px 2px 7px" } }, "恢复全部归档原件") : null,
          archived.slice(0, 100).map(e => h("div", { key: e.id, style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, lineHeight: 1.65, padding: "8px 2px", borderBottom: "1px dashed " + t.line, whiteSpace: "pre-wrap" } }, e.text))) : null) : null) : null),
  cfgOpen && onSaveCfg && h(MemCfgSheet, {
    onPurgeWithered: onPurgeWithered,
    witheredCount: witheredCount,
    onDowngradeRoutineOpen: onDowngradeRoutineOpen,
    routineOpenCount: routineOpenCount,
    openTotal: openTotal,
    cfg: cfg || {}, onSave: onSaveCfg, onClose: () => setCfgOpen(false)
  }), editing && h(MemEntrySheet, {
    entry: editing === "new" ? null : editing,
    characters: characters,
    focusChar: focusChar,
    onClose: () => setEditing(null),
    onSave: data => {
      if (editing === "new") onAdd(data);else onUpdate(editing.id, data);
      setEditing(null);
    },
    onDelete: editing === "new" ? null : () => {
      onDelete(editing.id);
      setEditing(null);
    }
  }));
}
// 召回设置：自动抽取开关 + top-k + 抽取间隔 + 短期窗天数（消死区）
function MemCfgSheet({ cfg, onSave, onClose, onPurgeWithered, witheredCount, onDowngradeRoutineOpen, routineOpenCount, openTotal }) {
  const t = useTheme();
  const [c, setC] = useState(Object.assign({ topK: 5, autoExtract: true, extractInterval: 1, recentDays: 3, recentBudget: 8000, crossHours: 72, crossBudget: 800 }, cfg || {}));
  const [confirmPurge, setConfirmPurge] = useState(false);
  const [confirmRoutine, setConfirmRoutine] = useState(false);
  const set = patch => setC(p => Object.assign({}, p, patch));
  const toggle = (label, sub, val, onT) => h("div", { className: "flex items-center justify-between", style: { padding: "12px 0", borderTop: "1px solid " + t.line } },
    h("div", { style: { flex: 1, paddingRight: 12 } },
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15.5, color: t.ink } }, label),
      sub ? h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginTop: 2, lineHeight: 1.5 } }, sub) : null),
    h("button", { onClick: onT, className: "active:opacity-70 shrink-0", style: { width: 50, height: 29, borderRadius: 999, background: val ? t.ink : t.line, position: "relative", transition: "background .2s" } },
      h("span", { style: { position: "absolute", top: 3, left: val ? 24 : 3, width: 23, height: 23, borderRadius: 999, background: "#fff", transition: "left .2s" } })));
  const slider = (label, val, min, max, step, unit, onCh, note) => h("div", { style: { padding: "12px 0", borderTop: "1px solid " + t.line } },
    h("div", { className: "flex items-center justify-between", style: { marginBottom: 6 } },
      h("span", { style: { fontFamily: F_DISPLAY, fontSize: 15.5, color: t.ink } }, label),
      h("span", { style: { fontFamily: F_DISPLAY, fontSize: 15, color: t.accent } }, val + (unit || ""))),
    h("input", { type: "range", min: min, max: max, step: step, value: val, onChange: e => onCh(Number(e.target.value)), className: "w-full" }),
    note ? h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginTop: 4, lineHeight: 1.5 } }, note) : null);
  return h(Sheet, { onClose: onClose, tall: true },
    h(Eyebrow, { style: { marginBottom: 2 } }, "召回设置"),
    h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginBottom: 6 } }, "每轮往上下文塞几条 + 自动抽取的节拍 — token 封顶的旋钮"),
    toggle("自动抽取", "每轮聊天后后台静默把值得记的事拆成记忆入库（自带去重）", c.autoExtract !== false, () => set({ autoExtract: c.autoExtract === false })),
    slider("每轮召回条数 (top-k)", c.topK || 5, 2, 12, 1, " 条", v => set({ topK: v }), "不管库里存多少，每轮只取这么多 → token 恒定。"),
    slider("自动抽取间隔", c.extractInterval || 1, 1, 5, 1, " 轮", v => set({ extractInterval: v }), (c.extractInterval || 1) > 1 ? "每 " + c.extractInterval + " 轮抽一次，省抽取 API。" : "每轮都抽，记得最全、最费 API。日常设 2~3 轮够用。"),
    slider("短期窗覆盖天数", c.recentDays || 3, 1, 7, 1, " 天", v => set({ recentDays: v }), "最近这些天说的话一定带进上下文（消死区，不忘最近几天）。"),
    slider("短期窗字符预算", c.recentBudget || 8000, 3000, 16000, 1000, " 字", v => set({ recentBudget: v }), "上面那些原文最多带这么多字进上下文——长消息少带几条、短消息多带几条，token 有上限。调大记得更全、更费；调小更省。超出的老内容由自动抽取+摘要兜底。"),
    slider("跨情境回看时间窗", c.crossHours != null ? c.crossHours : 72, 12, 336, 12, " 小时", v => set({ crossHours: v }), "四个情境（单聊线上/线下·群聊线上/线下）互相衔接时，往回看多久内在别处发生的事。调大接得上更早的细节、更费；调小只带最近的。上限 14 天。"),
    slider("跨情境每段字符预算", c.crossBudget != null ? c.crossBudget : 800, 200, 3000, 100, " 字", v => set({ crossBudget: v }), "上面那些跨情境的近况，每一段最多带这么多字。按次收费尽管拉大——衔接更全、输出不额外收费；想省再调小。"),
    h("button", { onClick: () => { onSave(c); onClose(); }, className: "w-full active:opacity-80", style: { marginTop: 18, fontFamily: F_BODY, fontSize: 14.5, fontWeight: 700, color: t.bg2, background: t.ink, borderRadius: 12, padding: "12px" } }, "保存"),
    // 清理落灰记忆（v48.41 #4）：库越攒越大，一键删掉久无人问津的低情绪旧事——约定/心事/置顶都留着
    onPurgeWithered ? h("div", { style: { marginTop: 16, paddingTop: 14, borderTop: "1px dashed " + t.line } },
      h(Eyebrow, { style: { marginBottom: 4 } }, "清理落灰记忆"),
      h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, lineHeight: 1.5, marginBottom: 8 } }, "删掉 120 天没被想起、几乎没被召回过、也没什么情绪的静态旧事。你的未了约定/心事、置顶的、有情绪的都【不会】被清。"),
      witheredCount > 0
        ? (confirmPurge
            ? h("div", { className: "flex gap-2" },
                h("button", { onClick: () => setConfirmPurge(false), className: "flex-1 active:opacity-70", style: { fontFamily: F_BODY, fontSize: 13, color: t.sub, border: "1px solid " + t.line, borderRadius: 10, padding: "10px 0" } }, "取消"),
                h("button", { onClick: () => { onPurgeWithered(); setConfirmPurge(false); onClose(); }, className: "flex-1 active:opacity-70", style: { fontFamily: F_DISPLAY, fontSize: 14, color: "#fff", background: t.accent, borderRadius: 10, padding: "10px 0" } }, "确认清理 " + witheredCount + " 条"))
            : h("button", { onClick: () => setConfirmPurge(true), className: "w-full active:opacity-70", style: { fontFamily: F_BODY, fontSize: 13.5, color: t.accent, border: "1px solid " + t.line, borderRadius: 10, padding: "11px 0" } }, "🧹 清理落灰记忆（约 " + witheredCount + " 条）"))
        : h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, textAlign: "center", padding: "8px 0" } }, "暂时没有落灰记忆，很干净 ✨")) : null,
    h("div", { style: { marginTop: 14, paddingTop: 14, borderTop: "1px dashed " + t.line } },
      h(Eyebrow, { style: { marginBottom: 4 } }, "未了结开环"),
      h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, lineHeight: 1.5 } },
        "当前还有 " + openTotal + " 条开环。时间过去、想起变少或情绪缓和都不算解决；绝不按年龄批量降级。"),
      Number(routineOpenCount || 0) > 0 && onDowngradeRoutineOpen
        ? h("div", { style: { marginTop: 9 } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, lineHeight: 1.5, marginBottom: 8 } },
            "机械筛到 " + routineOpenCount + " 条明显日常安排（普通约饭、洗澡、上班等）。只撤掉 ⏳，正文仍留在记忆库；生日/就医等有后果的约定、关系冲突或等待结果不会动。"),
          confirmRoutine
            ? h("div", { className: "flex gap-2" },
              h("button", { onClick: () => setConfirmRoutine(false), className: "flex-1 active:opacity-70", style: { fontFamily: F_BODY, fontSize: 13, color: t.sub, border: "1px solid " + t.line, borderRadius: 10, padding: "10px 0" } }, "先不动"),
              h("button", { onClick: () => { onDowngradeRoutineOpen(); setConfirmRoutine(false); onClose(); }, className: "flex-1 active:opacity-70", style: { fontFamily: F_DISPLAY, fontSize: 13, color: "#fff", background: t.accent, borderRadius: 10, padding: "10px 0" } }, "确认软降级 " + routineOpenCount + " 条"))
            : h("button", { onClick: () => setConfirmRoutine(true), className: "w-full active:opacity-70", style: { fontFamily: F_BODY, fontSize: 13.5, color: t.accent, border: "1px solid " + t.line, borderRadius: 10, padding: "11px 0" } }, "筛掉明显日常伪开环"))
        : h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, textAlign: "center", paddingTop: 8 } }, "没有识别到明显日常伪开环；其余请点「⏳未了结」查看。")));
}
function MemEntrySheet({
  entry,
  characters,
  focusChar,
  onClose,
  onSave,
  onDelete
}) {
  const t = useTheme();
  const [text, setText] = useState(entry ? entry.text : "");
  const [tagStr, setTagStr] = useState(entry ? (entry.tags || []).join("、") : "");
  const [charIds, setCharIds] = useState(entry ? entry.charIds || [] : focusChar ? [focusChar.id] : []);
  const [pinned, setPinned] = useState(entry ? !!entry.pinned : false);
  const [open, setOpen] = useState(entry ? !!entry.open : false);
  const [vv, setVv] = useState(entry && typeof entry.v === "number" ? entry.v : 0);
  const [aa, setAa] = useState(entry && typeof entry.a === "number" ? entry.a : 1);
  const toggleChar = id => setCharIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const save = () => {
    const tt = text.trim();
    if (!tt) return;
    const tags = tagStr.split(/[、,，\s]+/).map(s => s.trim()).filter(Boolean);
    onSave({
      text: tt,
      tags,
      charIds,
      pinned,
      open,
      v: vv,
      a: aa
    });
  };
  return h(Sheet, {
    onClose: onClose,
    tall: true
  }, h("div", {
    className: "flex items-center justify-between mb-3"
  }, h("span", {
    style: {
      fontFamily: F_DISPLAY,
      fontSize: 22,
      color: t.ink
    }
  }, entry ? "编辑记忆" : "新增记忆"), h("button", {
    onClick: save
  }, h(ICheck, {
    size: 19,
    color: t.ink
  }))), h(LineArea, {
    value: text,
    onChange: e => setText(e.target.value),
    placeholder: "一句关键事实，如：他答应周末带我去看海。",
    style: {
      minHeight: 90
    }
  }), h(LineField, {
    zh: "标签",
    en: "Tags"
  }, h(LineInput, {
    value: tagStr,
    onChange: e => setTagStr(e.target.value),
    placeholder: "用、或空格分隔，如：约定 海边"
  })), h("div", {
    className: "pt-5"
  }, h(Eyebrow, {
    style: {
      marginBottom: 8
    }
  }, "关联角色（不选＝全局对所有人可见）"), h("div", {
    className: "flex flex-wrap gap-2"
  }, characters.map(c => {
    const on = charIds.includes(c.id);
    return h("button", {
      key: c.id,
      onClick: () => toggleChar(c.id),
      className: "px-3 py-1.5 rounded-full",
      style: {
        fontFamily: F_BODY,
        fontSize: 13,
        background: on ? t.ink : "transparent",
        color: on ? t.bg2 : t.sub,
        border: "1px solid " + (on ? t.ink : t.line)
      }
    }, c.remark || c.name);
  }))), h("div", {
    className: "flex items-center justify-between pt-6"
  }, h("div", {
    style: {
      fontFamily: F_DISPLAY,
      fontSize: 14,
      color: t.sub
    }
  }, "置顶（每次都注入对话）"), h("button", {
    onClick: () => setPinned(v => !v),
    style: {
      width: 46,
      height: 27,
      borderRadius: 999,
      background: pinned ? t.tint : t.line,
      position: "relative",
      transition: "background .2s"
    }
  }, h("span", {
    style: {
      position: "absolute",
      top: 3,
      left: pinned ? 22 : 3,
      width: 21,
      height: 21,
      borderRadius: 999,
      background: "#fff",
      transition: "left .2s",
      boxShadow: "0 1px 3px rgba(0,0,0,0.2)"
    }
  }))),
  // 未了结（Ombre Brain·承诺可标记完成）：勾上会更常被想起，办完/翻篇点掉它就不再惦记
  h("div", { className: "flex items-center justify-between pt-6" },
    h("div", { style: { flex: 1, paddingRight: 12 } },
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14, color: t.sub } }, "还没了结（约定 / 心结）"),
      h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginTop: 2, lineHeight: 1.5 } }, "标记后 TA 会更常惦记这件事；等兑现了 / 翻篇了，点掉它就不再念叨")),
    h("button", { onClick: () => setOpen(v => !v), className: "shrink-0", style: { width: 46, height: 27, borderRadius: 999, background: open ? "#b06a4f" : t.line, position: "relative", transition: "background .2s" } },
      h("span", { style: { position: "absolute", top: 3, left: open ? 22 : 3, width: 21, height: 21, borderRadius: 999, background: "#fff", transition: "left .2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" } }))),
  // 情绪坐标（Ombre Brain·valence/arousal）：愉悦度 + 强度，影响被想起的权重
  (() => {
    const stepper = (label, val, lo, hi, onCh) => h("div", { className: "flex items-center justify-between", style: { padding: "8px 0" } },
      h("span", { style: { fontFamily: F_BODY, fontSize: 13, color: t.sub } }, label),
      h("div", { className: "flex items-center", style: { gap: 12 } },
        h("button", { onClick: () => onCh(Math.max(lo, val - 1)), className: "active:opacity-60", style: { width: 26, height: 26, borderRadius: 999, border: "1px solid " + t.line, color: t.ink, fontFamily: F_DISPLAY, fontSize: 15 } }, "−"),
        h("span", { style: { minWidth: 24, textAlign: "center", fontFamily: F_DISPLAY, fontSize: 15, color: t.accent } }, val),
        h("button", { onClick: () => onCh(Math.min(hi, val + 1)), className: "active:opacity-60", style: { width: 26, height: 26, borderRadius: 999, border: "1px solid " + t.line, color: t.ink, fontFamily: F_DISPLAY, fontSize: 15 } }, "＋")));
    return h("div", { className: "pt-4", style: { borderTop: "1px solid " + t.line, marginTop: 14 } },
      h(Eyebrow, { style: { marginBottom: 4 } }, "情绪坐标"),
      h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginBottom: 4, lineHeight: 1.5 } }, "越激动、越强烈的事越难忘、越常被想起。自动抽取会自己判断，也可手调"),
      stepper("愉悦度（-5 难过 ～ +5 开心）", vv, -5, 5, setVv),
      stepper("强度（0 平淡 ～ 5 刻骨）", aa, 0, 5, setAa));
  })(),
  onDelete && h("button", {
    onClick: onDelete,
    className: "w-full text-center pt-6",
    style: {
      fontFamily: F_BODY,
      fontSize: 13,
      color: t.accent
    }
  }, "删除这条记忆"));
}

// ============================================================
// 日记（Diary）——角色私密手账
// ============================================================
function diarySameDay(a, b) {
  const x = new Date(a), y = new Date(b);
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate();
}
// ── 日记的墨 ──────────────────────────────────────────────
// 她 2026-08-30：划掉和秘密要真的有笔触，不要 CSS 下划线那种电子感。
// ⚠️两样都做成【背景图】而不是绝对定位的兄弟节点：兄弟节点会盖在正文上面，
//   而且多行段落每行都得算位置；做成背景，换行天然跟着走。
function inkStrokeUrl(seed, rgb) {
  let x = 0; const str = String(seed || "0");
  for (let i = 0; i < str.length; i++) x = (x * 33 + str.charCodeAt(i)) >>> 0;
  const r = () => { x = (x * 1103515245 + 12345) >>> 0; return (x % 1000) / 1000; };
  const pts = [];
  for (let i = 0; i <= 6; i++) pts.push([i * 20, 10 + (r() - 0.5) * 5.2]);
  const d = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const svg = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 20' preserveAspectRatio='none'>"
    + "<path d='" + d + "' fill='none' stroke='rgba(" + rgb + ",.72)' stroke-width='" + (1.5 + r() * 0.9).toFixed(2) + "' stroke-linecap='round'/></svg>";
  return "url(\"data:image/svg+xml," + encodeURIComponent(svg) + "\")";
}
// 划掉的一句：那道杠从左到右画出来
function InkStruck({ text, seed, lineH, rgb }) {
  const [on, setOn] = useState(false);
  useEffect(() => { const id = requestAnimationFrame(() => requestAnimationFrame(() => setOn(true))); return () => cancelAnimationFrame(id); }, []);
  return h("span", {
    style: {
      backgroundImage: inkStrokeUrl(seed, rgb),
      backgroundRepeat: "repeat-y",
      backgroundPosition: "left center",
      backgroundSize: (on ? 100 : 0) + "% " + lineH + "px",
      transition: "background-size .55s cubic-bezier(.3,.7,.4,1)"
    }
  }, text);
}
// 不肯说的那句：糊成一块墨，点一下像被水化开
function InkSecret({ text, seed, rgb, ink }) {
  const [open, setOpen] = useState(false);
  let x = 0; const str = String(seed || "0");
  for (let i = 0; i < str.length; i++) x = (x * 31 + str.charCodeAt(i)) >>> 0;
  const jitter = (x % 7) - 3;
  return h("span", {
    onClick: open ? undefined : () => setOpen(true),
    style: {
      position: "relative", display: "inline",
      cursor: open ? "auto" : "pointer",
      userSelect: open ? "auto" : "none",
      color: open ? ink : "transparent",
      backgroundImage: open ? "none"
        : "radial-gradient(130% 96% at 16% 46%,rgba(" + rgb + ",.9),rgba(" + rgb + ",0) 74%),"
        + "radial-gradient(120% 98% at 58% 56%,rgba(" + rgb + ",.88),rgba(" + rgb + ",0) 76%),"
        + "linear-gradient(rgba(" + rgb + ",.84),rgba(" + rgb + ",.84))",
      backgroundSize: open ? "100% 100%" : "100% 92%",
      backgroundPosition: "left " + (50 + jitter) + "%",
      backgroundRepeat: "repeat-y",
      filter: open ? "blur(0px)" : "blur(.4px)",
      transition: "color .5s ease .12s, background-size .55s ease, filter .55s ease",
      boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone",
      padding: "0 2px", borderRadius: 3
    }
  }, text);
}
// 每个角色一种纸：他的本子长什么样，本来就该是他的一部分
const DIARY_PAPERS = ["paper", "lined", "grid", "cloth", "night", "wood"];
function diaryPaperOf(char) {
  if (char && char.diaryPaper && DIARY_PAPERS.indexOf(char.diaryPaper) >= 0) return char.diaryPaper;
  const s2 = String((char && (char.id || char.name)) || "?");
  let x = 0;
  for (let i = 0; i < s2.length; i++) x = (x * 33 + s2.charCodeAt(i)) >>> 0;
  return DIARY_PAPERS[x % DIARY_PAPERS.length];
}
function diaryPreview(e) {
  // 摘要别拿划掉的半句或贴进来的票根当开头，那两样单看都不成句
  const p = (e.paras || []).find(x => !x.secret && !x.struck && !x.pasted) || (e.paras || []).find(x => !x.secret) || (e.paras || [])[0];
  return p ? p.text : "";
}

// 全文页 —— 这一页就是他那张纸：日期是他写下的，天气地点随手记在边上，
// 正文落在纸上，划掉的有笔触、不肯说的糊成墨。
// ⚠️不要再往回加英文眉标／条码／带框的元数据表——那套是照着别人的版式来的，
//   她 2026-08-30 明说要我们自己的（「我就是不想要现在这版的底子」）。
function DiaryEntryView({ entry, char, isMe, chars, onBack, onDelete, onComment, commenting }) {
  const t = useTheme();
  const d = new Date(entry.ts);
  const wd = "日一二三四五六"[d.getDay()];
  const dateStr = (d.getMonth() + 1) + "月" + d.getDate() + "日";
  const paper = isMe ? "paper" : diaryPaperOf(char);
  const iRGB = (typeof skinRGB === "function" ? skinRGB(t.ink || "#2b2622") : [43, 38, 34]).join(",");
  const comments = entry.comments || [];
  const margin = [entry.location, entry.weather].filter(Boolean).join(" · ");
  const title = isMe ? (entry.title || "") : (entry.titleZh || entry.titleEn || "");
  const sub = (!isMe && entry.titleZh && entry.titleEn) ? entry.titleEn : "";
  return h("div", { className: "h-full flex flex-col", style: pageSkin(paper, t, { corner: false }) },
    h("div", { className: "shrink-0 flex items-center px-4 pb-2", style: { paddingTop: safeTop(10) } },
      h("button", { onClick: onBack, "aria-label": "返回", className: "active:opacity-50 flex items-center justify-center", style: { width: 40, height: 40, marginLeft: -8 } }, h(IArrow, { size: 19, color: t.ink })),
      h("div", { className: "flex-1 min-w-0 text-center" },
        h("div", { className: "truncate", style: { fontFamily: F_DISPLAY, fontSize: 15.5, color: t.ink } }, char ? (char.remark || char.name) : "日记"),
        h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 1 } }, isMe ? "我的手记" : "他写的")),
      h("div", { className: "flex items-center justify-end", style: { width: 40 } },
        h("button", { onClick: onDelete, "aria-label": "删掉", className: "active:opacity-50" }, h(ITrash, { size: 17, color: t.fog })))),
    h("div", { className: "flex-1 min-h-0 overflow-y-auto px-7 pb-16" },
      h("div", { className: "flex items-baseline", style: { gap: 9, marginTop: 10 } },
        h("span", { style: { fontFamily: F_DISPLAY, fontSize: 27, color: t.ink, lineHeight: 1.15 } }, dateStr),
        h("span", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.fog } }, "周" + wd),
        h("span", { style: { flex: 1 } }),
        entry.timeStr ? h("span", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog } }, entry.timeStr) : null),
      margin ? h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginTop: 5 } }, margin) : null,
      h("div", { style: { height: 1, background: "rgba(" + iRGB + ",.14)", margin: "16px 0 20px" } }),
      title ? h("div", { style: { fontFamily: F_DISPLAY, fontSize: 22, lineHeight: 1.4, color: t.ink, marginBottom: sub ? 4 : 16 } }, title) : null,
      sub ? h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, letterSpacing: ".16em", marginBottom: 16 } }, sub) : null,
      (entry.paras || []).some(p => p.secret) ? h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginBottom: 16 } }, "点一下墨块，那句话会化开") : null,
      (entry.paras || []).map((p, i) => {
        if (p.pasted) return h("div", { key: i, style: { position: "relative", margin: "8px 2px 24px", padding: "13px 14px", background: "rgba(" + iRGB + ",.045)", border: "1px solid rgba(" + iRGB + ",.10)", borderRadius: 3, transform: "rotate(-.6deg)", boxShadow: "0 2px 10px rgba(0,0,0,.06)", fontFamily: F_BODY, fontSize: 13, lineHeight: 1.8, color: t.sub, whiteSpace: "pre-wrap" } },
          h("span", { "aria-hidden": "true", style: { position: "absolute", top: -8, left: "42%", width: 46, height: 15, background: "rgba(" + iRGB + ",.07)", border: "1px solid rgba(" + iRGB + ",.06)", transform: "rotate(-3deg)" } }),
          p.text);
        const body = { fontFamily: F_BODY, fontSize: 16.5, lineHeight: 2.05, color: t.ink, marginBottom: 20 };
        if (p.struck) return h("p", { key: i, style: Object.assign({}, body, { color: "rgba(" + iRGB + ",.5)" }) },
          h(InkStruck, { text: p.text, seed: (entry.id || "") + i, lineH: Math.round(16.5 * 2.05), rgb: iRGB }));
        if (p.secret) return h("p", { key: i, style: body },
          h(InkSecret, { text: p.text, seed: (entry.id || "") + i, rgb: iRGB, ink: t.ink }));
        return h("p", { key: i, style: body }, p.text);
      }),
      entry.signature ? h("div", { style: { marginTop: 20, fontFamily: F_DISPLAY, fontSize: 18, color: t.sub, textAlign: "right" } }, entry.signature) : null,
      isMe ? h("div", { style: { marginTop: 34 } },
        h("div", { className: "flex items-baseline", style: { gap: 8, marginBottom: 6 } },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14, color: t.sub } }, "谁看过，写了两句"),
          comments.length ? h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog } }, comments.length + " 条") : null),
        comments.map(c => h("div", { key: c.id, className: "flex gap-3", style: { padding: "12px 0 12px 12px", borderLeft: "2px solid rgba(" + iRGB + ",.13)", marginTop: 10 } },
          h(Avatar, { character: (chars || []).find(x => x.id === c.charId) || { name: c.name }, size: 28, radius: 9 }),
          h("div", { className: "flex-1 min-w-0" },
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 13.5, color: t.ink, marginBottom: 2 } }, c.name),
            h("div", { style: { fontFamily: F_BODY, fontSize: 14, lineHeight: 1.75, color: t.sub } }, c.text)))),
        h("button", { onClick: onComment, disabled: commenting, className: "w-full mt-5 flex items-center justify-center gap-2 active:opacity-70 disabled:opacity-50", style: { border: "1px dashed rgba(" + iRGB + ",.2)", borderRadius: 12, padding: "11px 0", fontFamily: F_BODY, fontSize: 13.5, color: t.sub } },
          commenting ? h(IPulse, { size: 15, color: t.sub }) : h(ISpark, { size: 15, color: t.sub }),
          commenting ? "他们在看你今天写的…" : (comments.length ? "再叫人来看看" : "叫他们来看看"))) : null));
}
function fmtClockShort(d) {
  return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}

// 单人档案卡（DIRECTORY），可横向翻页
function DiaryArchive({ characters, curId, setCurId, diaries, onOpen, onBack, onOpenList, onEditStyle, onCompose }) {
  const t = useTheme();
  const tp = useRef(null);
  const idx = Math.max(0, characters.findIndex(c => c.id === curId));
  const char = characters[idx] || characters[0];
  if (!char) return null;
  const list = (diaries[char.id] || []).slice().sort((a, b) => Number((b && b.ts) || 0) - Number((a && a.ts) || 0));
  const last = list[0]; // 排过序，last 就是真正最新的一篇
  const go = dir => {
    const ni = idx + dir;
    if (ni >= 0 && ni < characters.length) setCurId(characters[ni].id);
  };
  const onTS = e => { const t0 = e.touches[0]; tp.current = { x: t0.clientX, y: t0.clientY }; };
  const onTE = e => {
    if (!tp.current) return;
    const t1 = e.changedTouches[0];
    const dx = t1.clientX - tp.current.x, dy = t1.clientY - tp.current.y;
    tp.current = null;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
  };
  // 封面就是他那张纸 + 一张贴上去的书名签。
  // ⚠️别再往回做那套「深色大图 + 编号 + 一排英文小标题」的档案卡版式——
  //   那是照着别人的来的，她 2026-08-30 明说要我们自己的东西。
  const paper = diaryPaperOf(char);
  const iRGB = (typeof skinRGB === "function" ? skinRGB(t.ink || "#2b2622") : [43, 38, 34]).join(",");
  const lastStr = last ? (new Date(last.ts).getMonth() + 1) + "月" + new Date(last.ts).getDate() + "日" : "";
  return h("div", { className: "h-full flex flex-col", style: Object.assign({}, pageSkin(paper, t, { corner: false }), { touchAction: "pan-y" }), onTouchStart: onTS, onTouchEnd: onTE },
    h("div", { className: "shrink-0 flex items-center px-4 pb-2", style: { paddingTop: safeTop(10) } },
      h("button", { onClick: onBack, "aria-label": "返回", className: "active:opacity-50 flex items-center justify-center", style: { width: 40, height: 40, marginLeft: -8 } }, h(IArrow, { size: 19, color: t.ink })),
      h("div", { className: "flex-1 min-w-0 text-center" },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15.5, color: t.ink } }, "日记"),
        h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 1 } }, characters.length > 1 ? "第 " + (idx + 1) + " / " + characters.length + " 本" : "")),
      h("div", { className: "flex items-center justify-end", style: { gap: 12, width: 68 } },
        h("button", { onClick: () => char.isMe ? onCompose() : onEditStyle(char.id), "aria-label": char.isMe ? "写一篇" : "改文风", className: "active:opacity-50" }, h(IPencil, { size: 17, color: t.ink })),
        h("button", { onClick: onOpenList, "aria-label": "换一本", className: "active:opacity-50" }, h(IChevR, { size: 18, color: t.fog })))),
    h("div", { className: "flex-1 min-h-0 flex flex-col items-center justify-center px-4", style: { position: "relative" } },
      h("button", { onClick: () => onOpen(char.id), className: "active:opacity-90", style: { width: "100%", maxWidth: "clamp(280px, calc(100vh - 362px), 350px)" } },
        h("div", { style: Object.assign({}, pageSkin(paper, t, { base: t.bg2, corner: false, strength: .85 }), {
          position: "relative", width: "100%", aspectRatio: "3 / 4.1", borderRadius: "3px 12px 12px 3px",
          border: "1px solid rgba(" + iRGB + ",.16)", boxShadow: "0 16px 40px rgba(0,0,0,.14)", overflow: "hidden" }) },
          h("span", { "aria-hidden": "true", style: { position: "absolute", left: 0, top: 0, bottom: 0, width: 16, background: "linear-gradient(90deg,rgba(" + iRGB + ",.16),rgba(" + iRGB + ",.04) 60%,transparent)" } }),
          [30, 50, 70].map(v => h("span", { key: v, "aria-hidden": "true", style: { position: "absolute", left: 7, top: v + "%", width: 3, height: 3, borderRadius: 999, background: "rgba(" + iRGB + ",.3)" } })),
          h("div", { style: { position: "absolute", left: "13%", right: "9%", top: "18%", padding: "20px 18px 22px",
            background: "rgba(255,255,255,.62)", border: "1px solid rgba(" + iRGB + ",.18)", borderRadius: 2,
            transform: "rotate(-1.2deg)", boxShadow: "0 3px 12px rgba(0,0,0,.09)" } },
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 34, lineHeight: 1.2, color: t.ink, wordBreak: "break-word" } }, char.remark || char.name),
            char.remark ? h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: t.fog, marginTop: 5 } }, char.name) : null,
            h("div", { style: { height: 1, background: "rgba(" + iRGB + ",.14)", margin: "14px 0 11px" } }),
            h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: t.sub } }, list.length ? "收了 " + list.length + " 篇" : "还是空的"),
            lastStr ? h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, marginTop: 4 } }, "最后写于 " + lastStr) : null),
          char.avatarImage ? h("div", { style: { position: "absolute", right: "9%", bottom: "7%", width: 74, height: 74, borderRadius: 4, overflow: "hidden", transform: "rotate(3deg)", border: "3px solid rgba(255,255,255,.8)", boxShadow: "0 4px 12px rgba(0,0,0,.16)" } },
            h("img", { src: (typeof resolveImg === "function" ? resolveImg(char.avatarImage) : char.avatarImage), alt: "", style: { width: "100%", height: "100%", objectFit: "cover", display: "block" } })) : null,
          char.motto ? h("div", { style: { position: "absolute", left: "16%", right: "36%", bottom: "9%", fontFamily: "'Noto Serif SC',serif", fontSize: 12.5, lineHeight: 1.8, color: t.fog } }, "「" + char.motto + "」") : null)),
      h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: t.fog, marginTop: 26, letterSpacing: ".1em" } }, "翻开"),
      characters.length > 1 ? h("div", { className: "flex items-center justify-center", style: { position: "absolute", left: 0, right: 0, bottom: "calc(env(safe-area-inset-bottom) * .4 + 18px)", gap: 20 } },
        h("button", { onClick: () => go(-1), disabled: idx === 0, "aria-label": "上一本", className: "active:opacity-50", style: { opacity: idx === 0 ? .25 : .65, padding: 9 } }, h(IArrow, { size: 22, color: t.ink })),
        h("div", { className: "flex", style: { gap: 7 } }, characters.map((c, i2) => h("span", { key: c.id, style: { width: i2 === idx ? 16 : 6, height: 6, borderRadius: 999, background: t.ink, opacity: i2 === idx ? .7 : .22, transition: "width .2s" } }))),
        h("button", { onClick: () => go(1), disabled: idx === characters.length - 1, "aria-label": "下一本", className: "active:opacity-50", style: { opacity: idx === characters.length - 1 ? .25 : .65, padding: 9, transform: "scaleX(-1)" } }, h(IArrow, { size: 22, color: t.ink }))) : null));
}

// 文风编辑
function DiaryStyleSheet({ char, onSave, onClose }) {
  const t = useTheme();
  const [mbti, setMbti] = useState(char.mbti || "");
  const [motto, setMotto] = useState(char.motto || "");
  const [style, setStyle] = useState(char.diaryStyle || "");
  const field = (label, node) => h("div", { className: "mb-4" }, h(Eyebrow, { style: { marginBottom: 7 } }, label), node);
  const inputStyle = { width: "100%", background: t.bg, border: `1px solid ${t.line}`, borderRadius: 12, padding: "11px 13px", fontFamily: F_BODY, fontSize: 14, color: t.ink };
  return h(Sheet, { onClose, tall: true },
    h("div", { style: { fontFamily: F_DISPLAY, fontSize: 20, color: t.ink, marginBottom: 4 } }, char.name + " · 日记档案"),
    h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, marginBottom: 18 } }, "只影响日记的档案卡与文风，留空则自动从人设推断。"),
    field("ARCHETYPE / 原型（如 ISFJ）", h("input", { value: mbti, onChange: e => setMbti(e.target.value), placeholder: "选填，如 ISFJ / 疯批学者", style: inputStyle })),
    field("一句话签名 / MOTTO", h("input", { value: motto, onChange: e => setMotto(e.target.value), placeholder: "选填，如 “反正你是我的”", style: inputStyle })),
    field("日记文风", h("textarea", { value: style, onChange: e => setStyle(e.target.value), rows: 5, placeholder: "选填。写这个角色写日记的调性：克制/热烈/文艺/毒舌…爱用什么意象、英文标题偏冷还是偏诗意、口头禅等。", style: { ...inputStyle, resize: "none", lineHeight: 1.6 } })),
    h("button", { onClick: () => { onSave(char.id, { mbti: mbti.trim(), motto: motto.trim(), diaryStyle: style.trim() }); onClose(); }, className: "w-full mt-2 active:opacity-70", style: { background: t.ink, color: t.bg2, borderRadius: 14, padding: "13px 0", fontFamily: F_BODY, fontSize: 15 } }, "保存"));
}

// 我自己写日记（全屏），时间/天气/城市自动抓本地
function MyDiaryCompose({ onBack, onSave }) {
  const t = useTheme();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [loc, setLoc] = useState("");
  const [weather, setWeather] = useState("");
  const [coords, setCoords] = useState(null);
  const [envState, setEnvState] = useState("loading"); // loading | done | denied
  const now = useRef(new Date()).current;
  const aliveRef = useRef(true);
  const grab = () => {
    setEnvState("loading");
    fetchLocalEnv().then(e => {
      if (!aliveRef.current) return;
      // 只覆盖抓到的，不清掉用户已手填的
      if (e.location) setLoc(e.location);
      if (e.weather) setWeather(e.weather);
      if (e.coords) setCoords(e.coords);
      setEnvState(e.coords ? "done" : "denied");
    }).catch(() => aliveRef.current && setEnvState("denied"));
  };
  useEffect(() => { aliveRef.current = true; grab(); return () => { aliveRef.current = false; }; }, []);
  const dateStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, "0")}.${String(now.getDate()).padStart(2, "0")}`;
  const inp = { background: "transparent", border: "none", outline: "none", textAlign: "right", fontFamily: "'Archivo',sans-serif", fontSize: 15, color: t.ink, width: "60%" };
  const metaRow = (label, node) => h("div", { className: "flex items-center justify-between py-2.5", style: { borderTop: `1px solid ${t.line}` } }, h(Eyebrow, null, label), node);
  return h("div", { className: "h-full flex flex-col", style: { background: t.bg2 } },
    h("div", { className: "shrink-0 flex items-center justify-between px-6 pb-2", style: { paddingTop: safeTop(20) } },
      h("button", { onClick: onBack, className: "flex items-center gap-2 active:opacity-50" },
        h(IArrow, { size: 19, color: t.ink }),
        h("span", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 12, letterSpacing: "0.15em", color: t.ink } }, "BACK")),
      h("span", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 11, letterSpacing: "0.18em", color: t.fog } }, "NEW ENTRY / 写日记"),
      h("button", { onClick: () => onSave({ title, body, location: loc, weather, coords, timeStr: fmtClockShort(now) }), className: "active:opacity-50", style: { fontFamily: F_BODY, fontSize: 15, color: t.accent } }, "保存")),
    h("div", { className: "flex-1 overflow-y-auto px-6 pb-16" },
      h("input", { value: title, onChange: e => setTitle(e.target.value), placeholder: "标题（选填）", style: { background: "transparent", border: "none", outline: "none", width: "100%", fontFamily: F_DISPLAY, fontStyle: "italic", fontWeight: 500, fontSize: 34, lineHeight: 1.1, color: t.ink, marginTop: 14 } }),
      h("div", { className: "mt-6 px-4 pt-1 pb-2", style: { border: `1px solid ${t.line}`, borderRadius: 4, position: "relative" } },
        h("span", { style: { position: "absolute", top: -8, left: 12, fontSize: 16, color: t.fog, background: t.bg2, padding: "0 4px", lineHeight: 1 } }, "+"),
        metaRow("DATE & TIME", h("span", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 15, color: t.ink } }, dateStr + "  /  " + fmtClockShort(now))),
        metaRow("LOCATION", h("input", { value: loc, onChange: e => setLoc(e.target.value), placeholder: envState === "loading" ? "定位中…" : "手动填写", style: inp })),
        metaRow("ENVIRONMENT", h("input", { value: weather, onChange: e => setWeather(e.target.value), placeholder: envState === "loading" ? "抓取天气…" : "手动填写", style: inp }))),
      h("div", { className: "flex items-center justify-between mt-2.5" },
        h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog } },
          envState === "loading" ? "· 正在请求定位与天气…" : envState === "denied" ? "· 没抓到定位/天气，可手填、留空，或重试。" : "· 已抓取本地位置与天气，可手动改。"),
        h("button", { onClick: grab, disabled: envState === "loading", className: "flex items-center gap-1.5 active:opacity-60 disabled:opacity-40", style: { fontFamily: "'Archivo',sans-serif", fontSize: 11, letterSpacing: "0.08em", color: t.sub } },
          h(IRefresh, { size: 13, color: t.sub }), "重新定位")),
      h("textarea", { value: body, onChange: e => setBody(e.target.value), rows: 12, placeholder: "今天……（空行分段）", style: { width: "100%", marginTop: 24, background: "transparent", border: "none", outline: "none", resize: "none", fontFamily: F_BODY, fontSize: 16.5, lineHeight: 2.05, color: t.ink } })));
}

// 选哪些角色来评论（多选）
function DiaryCommentPickSheet({ characters, onConfirm, onClose }) {
  const t = useTheme();
  const [sel, setSel] = useState([]);
  const toggle = id => setSel(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  return h(Sheet, { onClose, tall: true },
    h("div", { style: { fontFamily: F_DISPLAY, fontSize: 20, color: t.ink, marginBottom: 4 } }, "让谁来评论"),
    h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, marginBottom: 16 } }, "选中的角色会按此刻的心情、和你的关系与好感度各写一条。"),
    characters.map(c => {
      const on = sel.includes(c.id);
      return h("button", { key: c.id, onClick: () => toggle(c.id), className: "w-full flex items-center gap-3 py-3 active:opacity-70", style: { borderBottom: `1px solid ${t.line}` } },
        h(Avatar, { character: c, size: 42, radius: 12 }),
        h("div", { className: "flex-1 text-left" },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 17, color: t.ink } }, c.name),
          c.remark && h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog } }, c.remark)),
        h("span", { className: "flex items-center justify-center", style: { width: 24, height: 24, borderRadius: 999, border: `1.5px solid ${on ? t.ink : t.line}`, background: on ? t.ink : "transparent" } }, on && h(ICheck, { size: 14, color: t.bg2 })));
    }),
    h("button", { onClick: () => { if (sel.length) onConfirm(sel); }, disabled: !sel.length, className: "w-full mt-5 active:opacity-70 disabled:opacity-40", style: { background: t.ink, color: t.bg2, borderRadius: 14, padding: "13px 0", fontFamily: F_BODY, fontSize: 15 } }, sel.length ? "让这 " + sel.length + " 位评论" : "先选角色"));
}

function Diary({ characters, diaries, profile, genBusy, commentingId, onBack, onGen, onBackfill, onDelEntry, onSaveFields, onAddMyEntry, onGenComments, toast }) {
  const t = useTheme();
  // 「我」也是一个作者（No.00），放在最前
  const meAuthor = { id: "__me", name: profile.name || "我", avatarImage: profile.avatarImage, color: profile.color || t.accent, motto: profile.tagline || "", isMe: true };
  const authors = [meAuthor, ...characters];
  const [pickDay, setPickDay] = useState(false); // 「补齐」弹出的挑日子单
  const [view, setView] = useState("archive"); // archive(默认大图) | home(目录) | entries | entry | compose
  const [curId, setCurId] = useState(characters[0] ? characters[0].id : "__me");
  const [curEntry, setCurEntry] = useState(null);
  // 翻页：flip 记着这一下往哪边翻、翻到哪一篇；flipRef 存手指按下时的位置
  const [flip, setFlip] = useState(null);
  const flipRef = useRef(null);
  const [styleEdit, setStyleEdit] = useState(null);
  const [commentPick, setCommentPick] = useState(null); // entryId 正在选评论角色
  const tx = useRef(null);
  const busy = genBusy || {};
  const curAuthor = authors.find(c => c.id === curId) || authors[0];
  const isMe = curAuthor && curAuthor.isMe;
  // 显示层兜底排序（v53.87）：日记一律按【日记那天的日期】倒序，最新在最上面。
  // app.js 那边写入与加载时也排了，但显示不该依赖存储顺序——云恢复、老数据、
  // 以后新加的写入口都可能绕过它。排在这里，只要能显示出来就一定是对的顺序。
  const sortByDay = list => (list || []).slice().sort((a, b) => Number((b && b.ts) || 0) - Number((a && a.ts) || 0));
  const entriesOf = id => sortByDay(diaries[id]);
  // 日记写的是【昨天】的，所以按钮/去重都按昨天判定
  const wroteToday = id => entriesOf(id).some(e => diarySameDay(e.ts, Date.now() - 86400000));

  const openEntries = id => { setCurId(id); setView("entries"); };
  const openArchive = id => { setCurId(id); setView("archive"); };
  const saveMyEntry = data => {
    const id = onAddMyEntry(data);
    if (id) { setCurId("__me"); setCurEntry(id); setView("entry"); }
    else setView("entries");
  };

  if (!authors.length) return h("div", { className: "h-full flex flex-col" },
    h(Head, { zh: "日记", en: "Diary", onBack }),
    h(Empty, { text: "还没有角色", sub: "先去人格档案馆录入" }));

  // ---- 我写日记 ----
  if (view === "compose") return h(MyDiaryCompose, { onBack: () => setView("entries"), onSave: saveMyEntry });

  // ---- 全文 ----
  if (view === "entry" && curEntry) {
    const all = entriesOf(curId);
    const at = Math.max(0, all.findIndex(x => x.id === curEntry));
    const e = all[at] || (all.find(x => x.id === curEntry) || curEntry);
    // ── 翻页（她 2026-08-30 点的 A）──────────────────────────
    // 一本本子该能一页一页翻。左滑往前（更早的一天），右滑往后（更近的一天）。
    // ⚠️效果做成【这一页绕着装订那条边翻过去】，底下露出下一页——
    //   不是整页平移。平移是卡片轮播，绕轴才是翻纸。
    // 列表是新→旧，所以 at-1 是更近的一天、at+1 是更早的一天。
    // ⚠️翻页方向照读书来：手指从右往左划＝往后翻＝翻到【更新的】那一天
    //（她 2026-08-30：「翻页方向反了，从右到左应该是往日期后面新的翻」）。
    const newerE = all[at - 1] || null;
    const olderE = all[at + 1] || null;
    const goTo = (target, dir) => {
      if (!target || flip) return;
      setFlip({ dir: dir, to: target.id });
      setTimeout(() => { setCurEntry(target.id); setFlip(null); }, 430);
    };
    const onTS = ev => { flipRef.current = { x: ev.touches[0].clientX, y: ev.touches[0].clientY }; };
    const onTE = ev => {
      const st = flipRef.current; flipRef.current = null;
      if (!st) return;
      const dx = ev.changedTouches[0].clientX - st.x, dy = ev.changedTouches[0].clientY - st.y;
      if (Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
      if (dx < 0) goTo(newerE, "fwd"); else goTo(olderE, "back");
    };
    const under = flip ? all.find(x => x.id === flip.to) : null;
    const page = (entry, style) => h("div", { style: Object.assign({ position: "absolute", inset: 0 }, style || {}) },
      h(DiaryEntryView, {
        entry: entry, char: curAuthor, isMe, chars: characters,
        commenting: commentingId === entry.id,
        onComment: isMe ? () => setCommentPick(entry.id) : null,
        onBack: () => { setCurEntry(null); setView("entries"); },
        onDelete: () => { onDelEntry(curId, entry.id); setCurEntry(null); setView("entries"); }
      }));
    return h(Fragment, null,
      h("div", { className: "h-full relative", style: { perspective: 1500, perspectiveOrigin: "0% 50%", overflow: "hidden", touchAction: "pan-y" }, onTouchStart: onTS, onTouchEnd: onTE },
        under ? page(under, { zIndex: 1 }) : null,
        page(e, {
          zIndex: 2,
          transformOrigin: flip && flip.dir === "back" ? "right center" : "left center",
          transform: flip ? (flip.dir === "fwd" ? "rotateY(-104deg)" : "rotateY(104deg)") : "rotateY(0deg)",
          opacity: flip ? 0.25 : 1,
          boxShadow: flip ? "0 0 60px rgba(0,0,0,.28)" : "none",
          transition: flip ? "transform .43s cubic-bezier(.4,.05,.35,1), opacity .43s ease, box-shadow .43s ease" : "none",
          backfaceVisibility: "hidden"
        }),
        // 还剩几页：不写页码，用一排小刻度说话
        all.length > 1 ? h("div", { className: "absolute left-0 right-0 flex items-center justify-center", style: { bottom: "calc(env(safe-area-inset-bottom) + 8px)", gap: 4, pointerEvents: "none", zIndex: 3 } },
          all.slice(0, 12).map((x, i2) => h("span", { key: x.id, style: { width: i2 === at ? 12 : 4, height: 3, borderRadius: 999, background: t.ink, opacity: i2 === at ? .5 : .16, transition: "width .2s" } }))) : null),
      commentPick && h(DiaryCommentPickSheet, {
        characters,
        onClose: () => setCommentPick(null),
        onConfirm: ids => { setCommentPick(null); onGenComments(commentPick, ids); }
      }));
  }

  // ---- 单人档案卡（默认进入的大图）----
  if (view === "archive") return h(Fragment, null,
    h(DiaryArchive, {
      characters: authors, curId, setCurId, diaries,
      onOpen: openEntries,
      onBack: onBack,
      onOpenList: () => setView("home"),
      onEditStyle: id => setStyleEdit(id),
      onCompose: () => setView("compose")
    }),
    styleEdit && h(DiaryStyleSheet, { char: characters.find(c => c.id === styleEdit), onSave: onSaveFields, onClose: () => setStyleEdit(null) }));

  // ---- 某作者的日记列表 ----
  if (view === "entries") {
    const list = entriesOf(curId);
    const idx = Math.max(0, authors.findIndex(c => c.id === curId));
    const onTS = ev => { tx.current = ev.touches[0].clientX; };
    const onTE = ev => {
      if (tx.current == null) return;
      const dx = ev.changedTouches[0].clientX - tx.current;
      if (dx < -55 && idx < authors.length - 1) setCurId(authors[idx + 1].id);
      if (dx > 55 && idx > 0) setCurId(authors[idx - 1].id);
      tx.current = null;
    };
    const done = wroteToday(curId), gb = busy[curId];
    // 「补齐」的挑日子单（v54.24）：以前只能一次补 14 天全部漏掉的，
    // 删掉某一篇想单独补回来根本没有入口（她 2026-08-21 报）。
    // 这里把最近 30 天里缺的日子列出来，点一天补一天，也可以一次全补。
    const missing = (function () {
      const out = [];
      for (let i = 1; i <= 30; i++) {
        const d = new Date(); d.setDate(d.getDate() - i); d.setHours(22, 30, 0, 0);
        if (!entriesOf(curId).some(e => diarySameDay(e.ts, d.getTime()))) out.push(d.getTime());
      }
      return out.reverse();
    })();
    const daySheet = pickDay && h("div", {
      onClick: () => setPickDay(false),
      style: { position: "fixed", inset: 0, zIndex: 140, background: "rgba(30,28,24,.4)", display: "flex", alignItems: "flex-end" }
    }, h("div", {
      onClick: ev => ev.stopPropagation(),
      style: { width: "100%", maxHeight: "68vh", overflowY: "auto", background: t.bg2, borderRadius: "18px 18px 0 0", padding: "16px 16px calc(env(safe-area-inset-bottom, 0px) + 14px)" }
    },
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15, color: t.ink, marginBottom: 2 } }, "补哪一天"),
      h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, lineHeight: 1.7, marginBottom: 12 } },
        missing.length ? "最近 30 天里还没写的日子。点一天就只补那一天——删掉过的也在这儿。" : "最近 30 天每天都写过了。"),
      missing.map(ts => h("button", {
        key: ts, disabled: gb,
        onClick: () => { setPickDay(false); onBackfill && onBackfill(curId, { days: [ts] }); },
        className: "active:opacity-60 disabled:opacity-40",
        style: { width: "100%", textAlign: "left", padding: "11px 4px", borderBottom: "1px solid " + t.line, background: "none", border: "none", fontFamily: F_BODY, fontSize: 13.5, color: t.ink }
      }, new Date(ts).toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "short" }))),
      missing.length > 1 ? h("button", {
        disabled: gb,
        onClick: () => { setPickDay(false); onBackfill && onBackfill(curId); },
        className: "active:opacity-60 disabled:opacity-40",
        style: { width: "100%", marginTop: 12, padding: "11px 0", borderRadius: 12, border: "1px solid " + t.line, background: "none", fontFamily: F_BODY, fontSize: 13, color: t.sub }
      }, "全部补齐（" + missing.length + " 篇）") : null));
    // 目录也铺他那张纸：翻他的日记，从目录起就该是他的本子
    return h("div", { className: "h-full flex flex-col", style: pageSkin(isMe ? "paper" : diaryPaperOf(curAuthor), t, { corner: false, strength: .7 }) }, daySheet,
      h(Head, {
        zh: curAuthor.name, en: isMe ? "My Journal · 我的日记" : "Journal · 翻阅日记",
        onBack: () => setView("archive"),
        right: isMe
          ? h("button", { onClick: () => setView("compose"), className: "active:opacity-50" }, h(IPencil, { size: 18, color: t.ink }))
          : h("div", { className: "flex items-center gap-3" },
              // 补齐漏记的那几天：逐天写，写一天存一天
              h("button", {
                onClick: () => { if (gb) return; setPickDay(true); },
                disabled: gb, className: "active:opacity-50 disabled:opacity-40",
                style: { fontFamily: F_BODY, fontSize: 11, color: t.sub, letterSpacing: .3 }
              }, "补齐"),
              h("button", {
                onClick: () => { if (gb) return; if (done) { toast && toast("昨天的日记已经写过了"); return; } onGen(curId, { manual: true }); },
                disabled: gb, className: "active:opacity-50 disabled:opacity-40",
                style: { opacity: done && !gb ? 0.35 : 1 }
              }, gb ? h(IPulse, { size: 18, color: t.ink }) : h(IPencil, { size: 18, color: t.ink })))
      }),
      h("div", { className: "flex-1 overflow-y-auto px-6 pb-10", onTouchStart: onTS, onTouchEnd: onTE },
        gb && h(Spinner, { label: curAuthor.name + " 正在记录昨天…" }),
        !gb && !list.length && h(Empty, { text: "还没有日记", sub: isMe ? "点右上角铅笔写一篇" : "点右上角，或等 Ta 自己写" }),
        list.map((e, i) => {
          const d = new Date(e.ts);
          const wd = "日一二三四五六"[d.getDay()];
          const titleMain = isMe ? (e.title || "") : (e.titleZh || e.titleEn || "");
          const ps = e.paras || [];
          const iRGB = (typeof skinRGB === "function" ? skinRGB(t.ink || "#2b2622") : [43, 38, 34]).join(",");
          // 那一篇里有什么，用几个小墨记说话——不写英文标签
          const marks = [];
          if (ps.some(p => p.struck)) marks.push(h("span", { key: "k", title: "有划掉的句子", style: { display: "inline-block", width: 15, height: 2, borderRadius: 2, background: "rgba(" + iRGB + ",.42)", transform: "rotate(-3deg)" } }));
          if (ps.some(p => p.secret)) marks.push(h("span", { key: "s", title: "有不肯说的话", style: { display: "inline-block", width: 7, height: 7, borderRadius: 999, background: "rgba(" + iRGB + ",.55)" } }));
          if (ps.some(p => p.pasted)) marks.push(h("span", { key: "p", title: "贴了东西进来", style: { display: "inline-block", width: 12, height: 8, background: "rgba(" + iRGB + ",.13)", border: "1px solid rgba(" + iRGB + ",.22)", transform: "rotate(-4deg)" } }));
          return h("div", {
            key: e.id, onClick: () => { setCurEntry(e.id); setView("entry"); },
            className: "flex gap-4 py-6 active:opacity-70",
            style: { borderTop: i === 0 ? "none" : "1px solid rgba(" + iRGB + ",.12)" }
          },
            h("div", { style: { width: 52, flexShrink: 0, paddingTop: 2 } },
              h("div", { style: { fontFamily: F_DISPLAY, fontSize: 24, lineHeight: 1.05, color: t.ink } }, d.getDate()),
              h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginTop: 3 } }, (d.getMonth() + 1) + "月 · 周" + wd)),
            h("div", { className: "flex-1 min-w-0" },
              titleMain ? h("div", { className: "line-clamp-2", style: { fontFamily: F_DISPLAY, fontSize: 18, lineHeight: 1.35, color: t.ink, marginBottom: 5 } }, titleMain) : null,
              h("div", { className: "line-clamp-2", style: { fontFamily: F_BODY, fontSize: 14, lineHeight: 1.75, color: t.sub } }, diaryPreview(e)),
              (marks.length || (isMe && (e.comments || []).length)) ? h("div", { className: "flex items-center", style: { gap: 7, marginTop: 10 } },
                marks,
                (isMe && (e.comments || []).length) ? h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginLeft: marks.length ? 4 : 0 } }, (e.comments || []).length + " 人看过") : null) : null));
        })));
  }

  // ---- 目录定位：角色列表（从大图右上角 INDEX 进入，点一个跳回该角色大图）----
  return h("div", { className: "h-full flex flex-col" },
    h(Head, {
      zh: "目录", en: "Index · 记录对象",
      onBack: () => setView("archive")
    }),
    h("div", { className: "flex-1 overflow-y-auto px-6 pb-10 pt-1" },
      authors.map(c => {
        const list = entriesOf(c.id); const last = list[0]; const gb = busy[c.id]; const cur = c.id === curId;
        return h("div", {
          key: c.id, onClick: () => openArchive(c.id),
          className: "flex items-center gap-4 py-4 active:opacity-70",
          style: { borderBottom: `1px solid ${t.line}` }
        },
          h(Avatar, { character: c, size: 52, radius: 15 }),
          h("div", { className: "flex-1 min-w-0" },
            h("div", { className: "flex items-center gap-2" },
              h("div", { style: { fontFamily: F_DISPLAY, fontSize: 20, color: t.ink } }, c.isMe ? c.name + "（我）" : c.name),
              cur && h("span", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 8, letterSpacing: "0.14em", padding: "2px 6px", borderRadius: 999, border: `1px solid ${t.line}`, color: t.fog } }, "当前")),
            h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, marginTop: 2 } },
              gb ? "正在记录今天…" : list.length ? "共 " + list.length + " 篇 · 最后 " + new Date(last.ts).toLocaleDateString("zh-CN", { month: "long", day: "numeric" }) : (c.isMe ? "还没写过，点铅笔写一篇" : "尚未记录"))),
          gb ? h(IPulse, { size: 18, color: t.fog }) : h(IChevR, { size: 16, color: t.fog }));
      })),
    styleEdit && h(DiaryStyleSheet, { char: characters.find(c => c.id === styleEdit), onSave: onSaveFields, onClose: () => setStyleEdit(null) }));
}
// ---- 我的钱包（聊天软件「我」下面）----
function MyWallet({ balance, log, cards, characters, onBack, onSetBalance, onOpenCard, view, onView }) {
  const t = useTheme();
  // ⚠️这个 view 原来是组件自己的 useState：从【亲属卡汇总】点进某张卡的账单页时
  // MyWallet 整个卸载，退回来就重挂成 main（＝钱包首页），她 2026-09-02 报的就是这个
  // ——mobile-ui-layout 第 3 条「进详情前记住位置、退回来恢复」。
  // 所以这一层提到 app.js 去拿着：详情页只是盖在上面，退回来还站在原地。
  const setView = onView || (() => {});
  view = view || "main"; // main | cards
  const [editing, setEditing] = useState(false);
  const [amt, setAmt] = useState("");
  const cardList = Array.isArray(cards) ? cards : [];
  const charById = id => (characters || []).find(c => c.id === id);
  const saveEdit = () => {
    const v = Number(amt);
    if (!isNaN(v)) onSetBalance(v);
    setEditing(false);
    setAmt("");
  };
  if (view === "cards") {
    return h("div", { className: "h-full flex flex-col", style: { background: t.bg } },
      h("div", { className: "shrink-0 px-4 pb-3 flex items-center gap-3", style: { paddingTop: safeTop(20), background: t.bg2, borderBottom: "1px solid " + t.line } },
        h("button", { onClick: () => setView("main"), className: "active:opacity-50" }, h(IArrow, { size: 19, color: t.ink })),
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 17, color: t.ink } }, "亲属卡"),
        h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginLeft: "auto" } }, "角色给你的卡 · 刷他们的钱")),
      h("div", { className: "flex-1 overflow-y-auto p-5 space-y-3" },
        cardList.length === 0 ? h("div", { className: "text-center mt-16", style: { fontFamily: F_BODY, fontSize: 13, lineHeight: 1.8, color: t.fog } }, "还没有收到亲属卡。\n在聊天设置里开启「允许角色给我亲属卡」，\n合适的时候 TA 会主动给你一张，刷 TA 的钱。")
          : cardList.map(cd => {
            const c = charById(cd.charId) || {};
            return h("button", { key: cd.charId, onClick: () => onOpenCard && onOpenCard(cd.charId), className: "w-full text-left active:opacity-80" },
              h(KinshipCardFace, { character: c, limit: cd.limit || 0, used: cd.used || 0, note: cd.note || "" }));
          })));
  }
  return h("div", { className: "h-full flex flex-col", style: { background: t.bg } },
    h("div", { className: "shrink-0 px-4 pb-3 flex items-center gap-3", style: { paddingTop: safeTop(20), background: t.bg2, borderBottom: "1px solid " + t.line } },
      h("button", { onClick: onBack, className: "active:opacity-50" }, h(IArrow, { size: 19, color: t.ink })),
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: 17, color: t.ink } }, "我的钱包"),
      h("button", { onClick: () => setView("cards"), className: "ml-auto active:opacity-60 flex items-center gap-1", style: { fontFamily: F_BODY, fontSize: 12, color: t.tint } }, "亲属卡", cardList.length ? h("span", { style: { fontFamily: F_BODY, fontSize: 10, color: "#fff", background: t.tint, borderRadius: 999, padding: "0 6px" } }, String(cardList.length)) : null)),
    h("div", { className: "flex-1 overflow-y-auto" },
      // 余额卡
      h("div", { className: "m-5 p-5", style: { borderRadius: 18, background: "linear-gradient(135deg,#2f3a42,#171d21)", color: "#fff" } },
        h("div", { style: { fontFamily: F_BODY, fontSize: 11, letterSpacing: "0.16em", opacity: 0.7 } }, "CNY · 余额"),
        h("div", { className: "flex items-end gap-3 mt-1" },
          h("div", { style: { fontFamily: F_DISPLAY, fontStyle: "italic", fontSize: 40, lineHeight: 1 } }, "¥" + balance),
          h("button", { onClick: () => { setAmt(String(balance)); setEditing(true); }, className: "mb-1 active:opacity-60", style: { fontFamily: F_BODY, fontSize: 11.5, color: "rgba(255,255,255,0.75)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 999, padding: "2px 10px" } }, "改余额"))),
      // 手动改余额
      editing && h("div", { className: "mx-5 mb-3 p-4", style: { background: t.bg2, borderRadius: 12, border: "1px solid " + t.line } },
        h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.sub, marginBottom: 8 } }, "把余额改成"),
        h("div", { className: "flex items-center gap-2" },
          h("input", { value: amt, onChange: e => setAmt(e.target.value), type: "number", inputMode: "decimal", autoFocus: true, className: "flex-1 outline-none px-3 py-2 rounded-lg", style: { fontFamily: F_BODY, fontSize: 15, color: t.ink, background: "#fff", border: "1px solid " + t.line } }),
          h("button", { onClick: saveEdit, className: "px-4 py-2 active:opacity-70", style: { fontFamily: F_BODY, fontSize: 13, background: t.ink, color: t.bg2, borderRadius: 8 } }, "保存"),
          h("button", { onClick: () => { setEditing(false); setAmt(""); }, className: "px-3 py-2 active:opacity-60", style: { fontFamily: F_BODY, fontSize: 13, color: t.fog } }, "取消"))),
      // 流水
      h("div", { className: "px-5 pb-8" },
        h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, letterSpacing: "0.14em", color: t.fog, marginBottom: 10 } }, "流水 · LEDGER"),
        (!log || log.length === 0) ? h("div", { className: "text-center mt-8", style: { fontFamily: F_BODY, fontSize: 12.5, color: t.fog } }, "还没有流水。转账、红包、购物都会记在这里。")
          : log.map(e => h("div", { key: e.id, className: "flex items-center justify-between py-3", style: { borderBottom: "1px solid " + t.line } },
            h("div", { className: "min-w-0 flex-1" },
              h("div", { className: "truncate", style: { fontFamily: F_BODY, fontSize: 14, color: t.ink } }, e.label),
              h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 2 } }, fmtStamp(e.ts))),
            h("div", { className: "text-right shrink-0 ml-3" },
              h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: e.delta > 0 ? "#3f8a54" : t.ink } }, (e.delta > 0 ? "+" : "") + e.delta),
              h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: t.fog, marginTop: 1 } }, "余 " + e.after)))))));
}

// ============================================================
// 角色钱包 CharWallet —— 主页独立 app：花名册 → 单角色钱包（持久 running balance）
// 首开生成资产档案，转账/红包/礼物/亲属卡实时加减余额，每天 23 点按日程补日常消费
// ============================================================
function CharWallet({ characters, charWallet, profile, selId, busyKey, hasApi, onBack, onSel, onInit, onCatchUp, onSetBalance, onRefresh, onSettleDebt, debtPeerOf }) {
  const t = useTheme();
  const chars = characters || [];
  const cw = charWallet || {};
  const char = chars.find(c => c.id === selId) || null;
  const [editing, setEditing] = useState(false);
  const [amt, setAmt] = useState("");
  const [dailyOpen, setDailyOpen] = useState(false);
  // 「为你花的」默认收起来：她 2026-08-30「搞一个箭头可以收起来不然太长了」
  const [forHerOpen, setForHerOpen] = useState(false);
  const [dailyDate, setDailyDate] = useState("");
  const profEmpty = r => !r || ((!r.incomes || !r.incomes.length) && !r.monthlyIncome && !r.investAssets && !(r.notes && Object.keys(r.notes).length));
  // 打开某角色：没建档就生成资产；已建档但档案是空的（首开时没 API/生成失败）且现在有 API 就补生成；否则补账
  useEffect(() => {
    if (!char) return;
    const rec = cw[char.id];
    if (!rec || !rec.init) onInit(char);
    else { if (profEmpty(rec) && hasApi) onRefresh(char); onCatchUp(char); }
    setEditing(false); setAmt("");
    setDailyOpen(false); setDailyDate(""); setForHerOpen(false);
    // eslint-disable-next-line
  }, [selId]);

  if (!chars.length) return h("div", { className: "h-full flex flex-col" }, h(Head, { zh: "钱包", en: "Wallet", onBack }), h(Empty, { text: "还没有角色", sub: "先去人格档案馆录入一位" }));

  // —— 花名册（未选角色）——
  if (!char) return h("div", { className: "h-full flex flex-col", style: { background: t.bg } },
    h(Head, { zh: "钱包", en: "Wallet · 选择角色", onBack }),
    h("div", { className: "flex-1 overflow-y-auto px-5 pb-10 pt-1" }, chars.map(c => {
      const rec = cw[c.id];
      return h("button", { key: c.id, onClick: () => onSel(c.id), className: "w-full text-left flex items-center gap-4 py-4 active:opacity-70", style: { borderBottom: "1px solid " + t.line } },
        h(Avatar, { character: c, size: 50, radius: 14 }),
        h("div", { className: "flex-1 min-w-0" },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 18, color: t.ink } }, c.name),
          h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, marginTop: 2 } }, rec && rec.init ? "钱包余额" : "未开通 · 点开生成资产")),
        rec && rec.init
          ? h("div", { style: { fontFamily: F_DISPLAY, fontSize: 17, color: t.ink } }, fmtMoney(rec.balance))
          : h(IChevR, { size: 16, color: t.fog }));
    })));

  // —— 单角色钱包详情 ——
  const rec = cw[char.id];
  const loading = busyKey === char.id;
  const ledger = (rec && rec.ledger) || [];
  const accounts = (rec && Array.isArray(rec.accounts)) ? rec.accounts : [];
  const debts = (rec && Array.isArray(rec.debts)) ? rec.debts : [];
  // primary 那一处放的就是钱包余额本身（流水走它）。它的 hold 不采信模型给的数，
  // 直接用 balance——否则同一笔钱会在「余额」和「另存」里各算一遍。
  const bal0 = Number(rec && rec.balance) || 0;
  const acctRows = accounts.map(a => a.primary ? { ...a, hold: bal0 } : a);
  const heldTotal = acctRows.reduce((n, a) => n + (a.primary ? 0 : (Number(a.hold) || 0)), 0);
  const assetTotal = heldTotal + bal0;
  // 为她花的：只认【真的发生过】的那几种——她在 App 里亲手收到过的。
  //   转账 / 他送来的礼物 / 红包 / 亲属卡
  // ⚠️v58.39 起不再靠「名目里出现她的名字」来筛。以前那样筛，模型在推演当天
  // 日常消费时随手写一句「给 Lisa 带的桂花糕」，这一栏就把它算成他为她花的钱——
  // 可他根本没点过、她也没收到过任何东西（她 2026-08-30：「显示有好多就是编出来的」）。
  // 少算一点也不能算错：这一栏是她翻钱包最当真的一栏。
  const FOR_HER_KINDS = ["transfer", "gift", "redpacket", "kinship"];
  const forHer = ledger.filter(e => e && Number(e.delta) < 0 && FOR_HER_KINDS.indexOf(e.kind) >= 0);
  const forHerTotal = forHer.reduce((n, e) => n + Math.abs(Number(e.delta) || 0), 0);
  // 还没结清的那几笔算个净额：正数是别人还欠他的，负数是他还欠人的
  const debtOpen = { net: debts.reduce((n, d) => d && !d.settledTs ? n + (d.dir === "owed" ? 1 : -1) * (Number(d.amount) || 0) : n, 0) };
  const notes = (rec && rec.notes) || {};
  const incomes = (rec && rec.incomes) || [];
  const saveEdit = () => { const v = Number(amt); if (!isNaN(v)) onSetBalance(char.id, v); setEditing(false); setAmt(""); };
  const AV = ["#f2b134", "#3f6d8c", "#8a8f7a", "#c25a4a"];
  const secTitle = s => h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15.5, color: t.ink, marginBottom: 10 } }, s);
  const note = s => s ? h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, fontStyle: "italic", lineHeight: 1.7, marginTop: 10 } }, s) : null;
  const cardBox = kids => h("div", { className: "mx-5 mb-4 p-4", style: { background: t.bg2, borderRadius: 16, border: "1px solid " + t.line } }, kids);
  // 本月收支（从流水分类算）
  const _now = new Date();
  const inMonth = ts => { const d = new Date(ts); return d.getMonth() === _now.getMonth() && d.getFullYear() === _now.getFullYear(); };
  const monthlyIncome = (rec && rec.monthlyIncome) || 0;
  const fixedMonthly = (rec && rec.fixedMonthly) || 0;
  const monthDaily = ledger.filter(e => e.kind === "daily" && inMonth(e.ts)).reduce((a, e) => a + Math.abs(e.delta), 0);
  const monthSpend = Math.round((fixedMonthly + monthDaily) * 100) / 100;
  const monthRemain = Math.round((monthlyIncome - monthSpend) * 100) / 100;
  const dailyEntries = ledger.filter(e => e.kind === "daily");
  const visibleDailyEntries = dailyDate ? dailyEntries.filter(e => schedDayKey(new Date(e.ts)) === dailyDate) : dailyEntries;
  const flowEntries = ledger.filter(e => ["transfer", "redpacket", "kinship", "gift"].indexOf(e.kind) >= 0);
  const sumRow = (label, value, color, sub) => h("div", { key: label, className: "flex items-center justify-between py-2.5", style: { borderTop: "1px solid " + t.line } },
    h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14, color: t.ink } }, label, sub ? h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginLeft: 6 } }, sub) : null),
    h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15.5, color: color || t.ink } }, value));

  const header = h(Head, {
    zh: char.name, en: "Wallet",
    onBack: () => onSel(null),
    right: h("button", { onClick: () => onRefresh(char), disabled: loading, className: "active:opacity-50 disabled:opacity-40" }, h(IRefresh, { size: 18, color: t.ink }))
  });

  if (loading && (!rec || !rec.init)) return h("div", { className: "h-full flex flex-col", style: { background: t.bg } }, header, h("div", { className: "flex-1 flex items-center justify-center" }, h(Spinner, { label: "正在生成 " + char.name + " 的资产…" })));

  return h("div", { className: "h-full flex flex-col", style: { background: t.bg } }, header,
    h("div", { className: "flex-1 overflow-y-auto pb-10" },
      // 余额卡（跑动余额）
      h("div", { className: "m-5 p-5", style: { borderRadius: 18, background: "linear-gradient(135deg," + (char.color || "#2f3a42") + ",#171d21)", color: "#fff" } },
        h("div", { className: "flex items-center justify-between" },
          h("div", { style: { fontFamily: F_BODY, fontSize: 11, letterSpacing: "0.16em", opacity: 0.72 } }, char.name + " · 钱包余额"),
          h("span", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 9, letterSpacing: "0.16em", opacity: 0.6 } }, "RUNNING")),
        h("div", { className: "flex items-end gap-3 mt-1" },
          h("div", { style: { fontFamily: F_DISPLAY, fontStyle: "italic", fontSize: 38, lineHeight: 1 } }, fmtMoney(rec ? rec.balance : 0)),
          h("button", { onClick: () => { setAmt(String(rec ? rec.balance : 0)); setEditing(true); }, className: "mb-1 active:opacity-60", style: { fontFamily: F_BODY, fontSize: 11.5, color: "rgba(255,255,255,0.75)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 999, padding: "2px 10px" } }, "改余额")),
        rec && rec.monthlyIncome ? h("div", { style: { fontFamily: F_BODY, fontSize: 11, opacity: 0.7, marginTop: 8 } }, "月收入 " + fmtMoney(rec.monthlyIncome) + (rec.fixedMonthly ? " · 月固定支出 " + fmtMoney(rec.fixedMonthly) : "")) : null),
      // 手动改余额
      editing ? h("div", { className: "mx-5 mb-4 p-4", style: { background: t.bg2, borderRadius: 12, border: "1px solid " + t.line } },
        h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.sub, marginBottom: 8 } }, "把余额改成"),
        h("div", { className: "flex items-center gap-2" },
          h("input", { value: amt, onChange: e => setAmt(e.target.value), type: "number", inputMode: "decimal", autoFocus: true, className: "flex-1 outline-none px-3 py-2 rounded-lg", style: { fontFamily: F_BODY, fontSize: 15, color: t.ink, background: "#fff", border: "1px solid " + t.line } }),
          h("button", { onClick: saveEdit, className: "px-4 py-2 active:opacity-70", style: { fontFamily: F_BODY, fontSize: 13, background: t.ink, color: t.bg2, borderRadius: 8 } }, "保存"),
          h("button", { onClick: () => { setEditing(false); setAmt(""); }, className: "px-3 py-2 active:opacity-60", style: { fontFamily: F_BODY, fontSize: 13, color: t.fog } }, "取消"))) : null,
      // 收入来源
      incomes.length ? cardBox([
        h("div", { key: "h", className: "flex items-center justify-between mb-1" }, secTitle("收入来源"),
          monthlyIncome ? h("span", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.sub, background: t.bg, borderRadius: 999, padding: "3px 10px" } }, "月合计 " + fmtMoney(monthlyIncome)) : null),
        incomes.map((s, i) => h("div", { key: i, className: "flex items-center justify-between py-2", style: i > 0 ? { borderTop: "1px solid " + t.line } : null },
          h("div", { className: "flex items-center min-w-0" },
            h("span", { style: { display: "inline-block", width: 7, height: 7, borderRadius: 7, background: AV[i % AV.length], marginRight: 8 } }),
            h("span", { style: { fontFamily: F_DISPLAY, fontSize: 14.5, color: t.ink } }, s.name),
            s.category ? h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginLeft: 8 } }, s.category) : null),
          h("span", { style: { fontFamily: F_DISPLAY, fontSize: 14.5, color: t.ink } }, "+" + fmtMoney(s.amount)))),
        note(notes.income)
      ]) : null,
      // 存款概览（当前余额 + 每月固定支出 + 本月收入/花费/剩余可用）
      cardBox([
        secTitle("存款概览"),
        h("div", { key: "bal", style: { fontFamily: F_BODY, fontSize: 12, color: t.fog } }, "当前余额"),
        h("div", { key: "balv", style: { fontFamily: F_DISPLAY, fontSize: 28, color: t.ink, margin: "2px 0 6px" } }, fmtMoney(rec ? rec.balance : 0)),
        fixedMonthly ? h("div", { key: "fx", style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, marginBottom: 6 } }, "每月固定支出 " + fmtMoney(fixedMonthly) + "（房租、交通、订阅等）") : null,
        sumRow("本月收入", "+" + fmtMoney(monthlyIncome), "#3f8a54"),
        sumRow("本月花费", "−" + fmtMoney(monthSpend), t.accent),
        sumRow("剩余可用", fmtMoney(monthRemain), t.ink),
        note(notes.savings)
      ]),
      // 理财
      (rec && rec.investAssets) || notes.invest ? cardBox([
        secTitle("理财"),
        h("div", { key: "iv", style: { fontFamily: F_BODY, fontSize: 12, color: t.fog } }, "持有资产"),
        h("div", { key: "ivv", style: { fontFamily: F_DISPLAY, fontSize: 24, color: t.ink, marginTop: 2 } }, fmtMoney((rec && rec.investAssets) || 0)),
        note(notes.invest)
      ]) : null,
      // 钱分几处放着。一个人把钱分几处、各放多少，本身就在说他是什么人——
      // 有人只有一个存钱的地方，有人分五处谁也不知道全貌。
      // 随身可动用的那笔就是上面的余额；这里列的是【另外存着的】，两边不重复计。
      acctRows.length ? cardBox([
        h("div", { key: "ah", className: "flex items-center justify-between mb-1" }, secTitle("钱放在哪儿"),
          h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog } }, "总共 " + fmtMoney(assetTotal))),
        h("div", { key: "ab", className: "space-y-2" }, acctRows.map((a, i) => h("div", {
          key: i, style: { display: "flex", gap: 10, alignItems: "flex-start", padding: "9px 0", borderTop: i ? "1px solid " + t.line : "none" }
        },
        h("div", { className: "flex-1 min-w-0" },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14.5, color: t.ink, wordBreak: "break-word" } }, a.name),
          h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginTop: 2 } },
            [a.kind, a.tail ? "尾号 " + a.tail : "", a.primary ? "随身 · 流水走这儿" : ""].filter(Boolean).join(" · ")),
          a.note ? h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.sub, marginTop: 5, lineHeight: 1.6, wordBreak: "break-word" } }, a.note) : null),
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15, color: t.ink, flexShrink: 0, paddingTop: 1 } }, fmtMoney(a.hold)))))
      ]) : null,
      // 欠账。只收【真的是钱】的——人情债不在这儿，它属于查手机那本账。
      // v58.38 起这一栏【真的会动余额】：点「收回」/「还清」就记一笔流水。
      // 名字如果正好是她人格档案馆里另一个角色，两边钱包一起动，方向相反——
      // 一笔钱不会凭空多出来（她 2026-08-30 问的那两件事）。
      debts.length ? cardBox([
        h("div", { key: "dh", className: "flex items-center justify-between mb-1" }, secTitle("欠账"),
          debtOpen.net !== 0 ? h("span", { style: { fontFamily: F_BODY, fontSize: 11.5, color: debtOpen.net > 0 ? "#3f8a54" : "#b6473c", background: t.bg, borderRadius: 999, padding: "3px 10px" } },
            (debtOpen.net > 0 ? "净收 +" : "净欠 −") + fmtMoney(Math.abs(debtOpen.net))) : null),
        h("div", { key: "db", className: "space-y-2" }, debts.map((d, i) => {
          const mine = d.dir === "owe";
          const done = !!d.settledTs;
          const peer = (!done && debtPeerOf) ? debtPeerOf(d.who) : null;
          return h("div", {
            key: d.id || i, style: { padding: "10px 0", borderTop: i ? "1px solid " + t.line : "none", opacity: done ? .5 : 1 }
          },
          h("div", { style: { display: "flex", gap: 10, alignItems: "flex-start" } },
            h("span", {
              style: {
                fontFamily: F_BODY, fontSize: 10.5, padding: "2px 7px", borderRadius: 99, flexShrink: 0, marginTop: 2,
                background: done ? "rgba(0,0,0,.05)" : mine ? "rgba(196,85,63,.11)" : "rgba(63,138,84,.11)",
                color: done ? t.fog : mine ? "#b6473c" : "#3f8a54"
              }
            }, done ? "已了" : mine ? "他欠" : "欠他"),
            h("div", { className: "flex-1 min-w-0" },
              h("div", { className: "flex items-baseline", style: { gap: 7, flexWrap: "wrap" } },
                h("span", { style: { fontFamily: F_DISPLAY, fontSize: 14.5, color: t.ink, textDecoration: done ? "line-through" : "none", wordBreak: "break-word" } }, d.who),
                // 对上她人格档案馆里另一个角色：结清时两边一起动
                peer ? h("span", { style: { fontFamily: F_BODY, fontSize: 10, color: peer.ready ? t.tint : t.fog, border: "1px solid " + (peer.ready ? t.tint : t.line), borderRadius: 99, padding: "1px 6px", whiteSpace: "nowrap" } },
                  peer.ready ? "和 " + peer.name + " 两边对账" : peer.name + " 还没开通钱包") : null),
              d.why ? h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.sub, marginTop: 3, lineHeight: 1.6, wordBreak: "break-word" } }, d.why) : null,
              h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginTop: 2 } },
                done ? "已结清 · " + schedDateParts(schedDayKey(new Date(d.settledTs))).md : (d.since || ""))),
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15, color: done ? t.fog : mine ? "#b6473c" : "#3f8a54", flexShrink: 0, paddingTop: 1 } },
              (mine ? "−" : "+") + fmtMoney(d.amount))),
          !done && onSettleDebt ? h("button", {
            onClick: () => {
              const q = mine ? ("把欠 " + d.who + " 的 ¥" + Math.round(d.amount) + " 还掉？余额会少这么多。")
                : ("收回 " + d.who + " 欠的 ¥" + Math.round(d.amount) + "？余额会多这么多。");
              if (!window.confirm(q + (peer && peer.ready ? "\n（" + peer.name + " 那边也会同时记一笔反向的）" : ""))) return;
              onSettleDebt(char.id, d.id);
            },
            className: "active:opacity-60",
            style: { marginTop: 8, marginLeft: 44, fontFamily: F_BODY, fontSize: 11.5, color: t.ink, border: "1px solid " + t.line, borderRadius: 999, padding: "4px 13px", background: t.bg }
          }, mine ? "还清这笔" : "收回这笔") : null)
        }))
      ]) : null,
      // 为她花的。不额外生成——从已有流水里筛出来，转账和送到她那儿的单子都算。
      // 她翻钱包最想看的就是这一栏，但它会越攒越长，所以默认收起来只露总额。
      forHer.length ? cardBox([
        h("button", {
          key: "fh", onClick: () => setForHerOpen(v => !v),
          className: "w-full flex items-center text-left active:opacity-60",
          style: { marginBottom: forHerOpen ? 10 : 0 }
        },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15.5, color: t.ink } }, "为你花的"),
          h("span", { style: { marginLeft: 8, fontFamily: F_BODY, fontSize: 11, color: t.fog } }, forHer.length + " 笔"),
          h("span", { style: { marginLeft: "auto", fontFamily: F_DISPLAY, fontSize: 14, color: t.ink } }, fmtMoney(forHerTotal)),
          h("span", { style: { marginLeft: 8, transform: forHerOpen ? "rotate(180deg)" : "none", transition: "transform .18s ease" } }, h(IChevD, { size: 16, color: t.fog }))),
        forHerOpen ? h("div", { key: "fn", style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, lineHeight: 1.7, marginBottom: 8 } },
          "只算你真的收到过的：转账、他寄来的东西、红包、亲属卡。他行程里推演出来的日常花销不算在这儿。") : null,
        forHerOpen ? h("div", { key: "fb", className: "space-y-1" }, forHer.slice(0, 30).map((e, i) => h("div", {
          key: e.id || i, style: { display: "flex", gap: 10, alignItems: "baseline", padding: "7px 0", borderTop: i ? "1px solid " + t.line : "none" }
        },
        h("div", { className: "flex-1 min-w-0", style: { fontFamily: F_BODY, fontSize: 13, color: t.ink, wordBreak: "break-word" } }, e.label),
        h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 10.5, color: t.fog, flexShrink: 0 } }, schedDateParts(schedDayKey(new Date(e.ts))).md),
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 13.5, color: t.ink, flexShrink: 0 } }, fmtMoney(Math.abs(e.delta)))))) : null,
        forHerOpen && forHer.length > 30 ? h("div", { key: "fm", style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginTop: 8 } }, "还有 " + (forHer.length - 30) + " 笔") : null
      ]) : null,
      // 日常消费（按日程每天扣的那笔）
      cardBox([
        h("button", {
          key: "daily-head", onClick: () => setDailyOpen(v => !v),
          className: "w-full flex items-center text-left active:opacity-60",
          style: { marginBottom: dailyOpen ? 12 : 0 }
        },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15.5, color: t.ink } }, "日常消费"),
          h("span", { style: { marginLeft: 8, fontFamily: F_BODY, fontSize: 11, color: t.fog } }, dailyEntries.length + " 条"),
          h("span", { style: { marginLeft: "auto", transform: dailyOpen ? "rotate(180deg)" : "none", transition: "transform .18s ease" } }, h(IChevD, { size: 16, color: t.fog }))),
        dailyOpen ? h("div", { key: "daily-body" },
          h("div", { className: "flex items-center gap-2", style: { marginBottom: 10 } },
            h("input", {
              type: "date", value: dailyDate, onChange: e => setDailyDate(e.target.value),
              "aria-label": "按日期筛选日常消费",
              style: { flex: 1, minWidth: 0, background: t.bg, color: t.ink, border: "1px solid " + t.line, borderRadius: 10, padding: "7px 9px", fontFamily: F_BODY, fontSize: 12 }
            }),
            dailyDate ? h("button", { onClick: () => setDailyDate(""), className: "active:opacity-60", style: { color: t.tint, fontFamily: F_BODY, fontSize: 12, whiteSpace: "nowrap" } }, "全部日期") : null),
          dailyEntries.length === 0
            ? h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.fog, textAlign: "center", padding: "10px 0" } }, "每天晚上按当日行程结算，暂时还没有记录")
            : visibleDailyEntries.length === 0
              ? h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.fog, textAlign: "center", padding: "12px 0" } }, "这一天没有日常消费记录")
              : visibleDailyEntries.map((e, i) => h("div", { key: e.id, className: "py-2.5", style: i > 0 ? { borderTop: "1px solid " + t.line } : null },
                h("div", { className: "flex items-baseline justify-between gap-3" },
                  h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog } }, schedDateParts(schedDayKey(new Date(e.ts))).md),
                  h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15, color: t.accent, whiteSpace: "nowrap" } }, "−" + fmtMoney(Math.abs(e.delta)))),
                h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, color: t.ink, marginTop: 2, lineHeight: 1.5 } }, (e.label || "").replace(/^日常消费 · /, ""))))
        ) : null,
        dailyOpen ? note(notes.spending) : null
      ]),
      // 送礼与转账
      cardBox([
        secTitle("送礼与转账"),
        flowEntries.length === 0
          ? h("div", { key: "e", style: { fontFamily: F_BODY, fontSize: 12.5, color: t.fog, textAlign: "center", padding: "10px 0" } }, "还没有礼物和转账记录")
          : flowEntries.map((e, i) => h("div", { key: e.id, className: "flex items-center justify-between py-3", style: i > 0 ? { borderTop: "1px solid " + t.line } : null },
            h("div", { className: "min-w-0 flex-1" },
              h("div", { className: "truncate", style: { fontFamily: F_BODY, fontSize: 14, color: t.ink } }, e.label),
              h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 2 } }, fmtStamp(e.ts) + " · 余 " + fmtMoney(e.after))),
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: e.delta > 0 ? "#3f8a54" : t.accent, marginLeft: 12, whiteSpace: "nowrap" } }, (e.delta > 0 ? "+" : "−") + fmtMoney(Math.abs(e.delta)))))
      ])));
}

// ============================================================
// 表情包字典 Emote Matrix —— 分类字典/全局或专属绑定/批量导入(关键词:url)/图库
// ============================================================
function EmoteMatrix({ packs, characters, onBack, onAddPack, onUpdatePack, onDeletePack, onToggleChar, onImport, onDeleteEmotes }) {
  const t = useTheme();
  const list = packs || [];
  const [selId, setSelId] = useState(list[0] && list[0].id);
  const [selMode, setSelMode] = useState(false);
  const [selEmotes, setSelEmotes] = useState([]);
  const [importText, setImportText] = useState("");
  const fileRef = useRef(null);
  const pack = list.find(p => p.id === selId) || list[0] || null;
  useEffect(() => { if (list.length && !list.find(p => p.id === selId)) setSelId(list[0].id); }, [packs]);
  const idx = pack ? list.findIndex(p => p.id === pack.id) : -1;
  const chars = characters || [];
  const readFile = e => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => setImportText(prev => (prev ? prev + "\n" : "") + String(r.result || ""));
    r.readAsText(f); e.target.value = "";
  };
  const eyebrow = (en, zh) => h("div", { className: "flex items-baseline gap-2", style: { marginBottom: 12 } },
    h("span", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 11, letterSpacing: "0.28em", color: t.fog } }, en),
    h("span", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog } }, "/ " + zh));

  return h("div", { className: "h-full flex flex-col", style: { background: t.bg } },
    // ⚠️这里原来是一块 34px 斜体大标题 + 一行大字距英文 + safeTop(24) 的留白，
    //   占掉近三分之一屏（.claude/rules/mobile-ui-layout.md §1 点名不许）。
    //   换成公共的 Head——全 app 那条紧凑栏，别再自己写一份。
    h(Head, { zh: "表情包", en: "Emote Matrix", onBack: onBack }),
    h("div", { className: "flex-1 overflow-y-auto px-6 pb-10" },
      // CATEGORIES
      h("div", { className: "flex items-center justify-between", style: { marginTop: 4 } },
        h("div", { className: "flex items-baseline gap-2" },
          h("span", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 11, letterSpacing: "0.28em", color: t.fog } }, "CATEGORIES"),
          h("span", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog } }, "/ 分类字典")),
        h("button", { onClick: () => onAddPack(), className: "flex items-center gap-1 active:opacity-60", style: { fontFamily: "'Archivo',sans-serif", fontSize: 12, letterSpacing: "0.12em", color: t.ink, border: "1px solid " + t.line, borderRadius: 10, padding: "6px 12px" } }, h("span", null, "+"), h("span", null, "NEW"))),
      h("div", { style: { height: 1, background: t.line, margin: "14px 0 18px" } }),
      // category chips
      list.length > 1 && h("div", { className: "flex gap-2 flex-wrap", style: { marginBottom: 20 } }, list.map((p, i) => h("button", {
        key: p.id, onClick: () => { setSelId(p.id); setSelMode(false); setSelEmotes([]); },
        className: "active:opacity-70", style: { fontFamily: F_BODY, fontSize: 13, padding: "6px 12px", borderRadius: 999, border: "1px solid " + (p.id === (pack && pack.id) ? t.ink : t.line), background: p.id === (pack && pack.id) ? t.ink : "transparent", color: p.id === (pack && pack.id) ? t.bg2 : t.sub }
      }, String(i + 1).padStart(2, "0") + " " + p.name))),
      !pack ? h("div", { className: "text-center", style: { paddingTop: 40, fontFamily: F_BODY, fontSize: 13, color: t.fog } }, "还没有表情字典，点右上 NEW 新建")
        : h("div", null,
          // pack name + GLOBAL pill
          h("div", { className: "flex items-center gap-3", style: { marginBottom: 14 } },
            h("span", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 13, color: t.fog } }, String(idx + 1).padStart(2, "0")),
            h("input", { value: pack.name, onChange: e => onUpdatePack(pack.id, { name: e.target.value }), className: "flex-1 outline-none bg-transparent", style: { fontFamily: F_DISPLAY, fontSize: 22, color: t.ink } }),
            pack.global && h("span", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 11, letterSpacing: "0.1em", color: t.bg2, background: t.ink, borderRadius: 999, padding: "5px 12px" } }, "GLOBAL")),
          // Global toggle
          h("div", { className: "flex items-center justify-between", style: { background: t.bg2, borderRadius: 16, border: "1px solid " + t.line, padding: "16px 18px", marginBottom: 20 } },
            h("div", null,
              h("div", { style: { fontFamily: F_DISPLAY, fontSize: 18, color: t.ink } }, "Global Access"),
              h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, marginTop: 2 } }, "全局通用（开启后不受下方专属限制）")),
            h("button", { onClick: () => onUpdatePack(pack.id, { global: !pack.global }), className: "active:opacity-70 shrink-0", style: { width: 52, height: 30, borderRadius: 999, background: pack.global ? t.ink : t.line, position: "relative", transition: "background .2s" } },
              h("span", { style: { position: "absolute", top: 3, left: pack.global ? 25 : 3, width: 24, height: 24, borderRadius: 999, background: "#fff", transition: "left .2s" } }))),
          // 加入我的表情库开关
          h("div", { className: "flex items-center justify-between", style: { background: t.bg2, borderRadius: 16, border: "1px solid " + t.line, padding: "14px 18px", marginBottom: 20 } },
            h("div", null,
              h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: t.ink } }, "加入我的表情库"),
              h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, marginTop: 2 } }, "关掉后角色仍能用，但我发消息的选择器里不显示")),
            h("button", { onClick: () => onUpdatePack(pack.id, { mine: pack.mine === false }), className: "active:opacity-70 shrink-0", style: { width: 52, height: 30, borderRadius: 999, background: pack.mine !== false ? t.ink : t.line, position: "relative", transition: "background .2s" } },
              h("span", { style: { position: "absolute", top: 3, left: pack.mine !== false ? 25 : 3, width: 24, height: 24, borderRadius: 999, background: "#fff", transition: "left .2s" } }))),
          // Specific cast
          eyebrow("SPECIFIC CAST", "专属绑定"),
          h("div", { className: "flex gap-2 flex-wrap", style: { marginBottom: 6 } }, chars.length === 0 ? h("span", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog } }, "还没有角色") : chars.map(c => {
            const bound = (pack.charIds || []).includes(c.id);
            return h("button", { key: c.id, onClick: () => onToggleChar(pack.id, c.id), className: "active:opacity-70", style: { fontFamily: F_BODY, fontSize: 14, padding: "8px 16px", borderRadius: 999, border: "1px solid " + (bound ? t.ink : t.line), background: bound ? t.ink : "transparent", color: bound ? t.bg2 : t.sub } }, c.name);
          })),
          pack.global && h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginTop: 6, marginBottom: 4 } }, "已开全局，绑定暂不生效（关掉全局才按专属限制）"),
          h("div", { style: { height: 20 } }),
          // Matrix gallery
          h("div", { className: "flex items-center justify-between", style: { marginBottom: 12 } },
            h("div", { className: "flex items-baseline gap-2" },
              h("span", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 11, letterSpacing: "0.28em", color: t.fog } }, "MATRIX GALLERY"),
              h("span", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog } }, "/ 矩阵图库 " + ((pack.emotes || []).length ? "· " + pack.emotes.length : ""))),
            (pack.emotes || []).length > 0 && h("button", { onClick: () => { setSelMode(m => !m); setSelEmotes([]); }, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 13, color: selMode ? t.accent : t.ink, border: "1px solid " + t.line, borderRadius: 10, padding: "5px 12px" } }, selMode ? "取消" : "Select")),
          (pack.emotes || []).length === 0
            ? h("div", { className: "text-center", style: { background: t.bg2, borderRadius: 16, border: "1px solid " + t.line, padding: "40px 0", fontFamily: F_BODY, fontSize: 13, color: t.fog, lineHeight: 1.9 } }, "图库空空如也\n请在下方批量导入")
            : h("div", { className: "grid grid-cols-3 gap-2" }, pack.emotes.map(em => {
              const on = selEmotes.includes(em.id);
              return h("button", { key: em.id, onClick: () => { if (!selMode) return; setSelEmotes(s => s.includes(em.id) ? s.filter(x => x !== em.id) : [...s, em.id]); }, className: "text-left active:opacity-80", style: { border: "1px solid " + (on ? t.accent : t.line), borderRadius: 12, overflow: "hidden", background: t.bg2 } },
                h("div", { style: { width: "100%", aspectRatio: "1", background: t.line, position: "relative" } },
                  h("img", { src: em.url, referrerPolicy: "no-referrer", loading: "lazy", style: { width: "100%", height: "100%", objectFit: "cover", display: "block" }, onError: e => { e.target.style.display = "none"; } }),
                  selMode && h("span", { style: { position: "absolute", top: 5, right: 5, width: 20, height: 20, borderRadius: 999, background: on ? t.accent : "rgba(0,0,0,0.4)", color: "#fff", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" } }, on ? "✓" : "")),
                h("div", { className: "truncate", style: { fontFamily: F_BODY, fontSize: 11, color: t.sub, padding: "5px 7px" } }, em.keyword));
            })),
          selMode && selEmotes.length > 0 && h("button", { onClick: () => { onDeleteEmotes(pack.id, selEmotes); setSelEmotes([]); setSelMode(false); }, className: "w-full active:opacity-70", style: { marginTop: 12, fontFamily: F_BODY, fontSize: 14, color: "#fff", background: t.accent, borderRadius: 12, padding: "12px 0" } }, "删除选中（" + selEmotes.length + "）"),
          // Delete matrix
          h("button", { onClick: () => requestAppConfirm("删除字典「" + pack.name + "」？", "其中的表情也会一并删除。", () => onDeletePack(pack.id), "删除"), className: "w-full active:opacity-70", style: { marginTop: 24, fontFamily: F_DISPLAY, fontSize: 16, color: t.accent, border: "1px solid " + t.accent, borderRadius: 14, padding: "14px 0" } }, "Delete Matrix (删除字典)"),
          h("div", { style: { height: 1, background: t.line, margin: "28px 0 20px" } }),
          // Batch import
          eyebrow("BATCH IMPORT", "批量指令"),
          h("div", { style: { background: t.bg2, borderRadius: 12, border: "1px solid " + t.line, padding: "14px 16px", fontFamily: F_BODY, fontSize: 12.5, color: t.fog, lineHeight: 1.9, marginBottom: 14, whiteSpace: "pre-wrap" } }, "格式：每个表情「关键词 + 链接」，同行用冒号/空格分隔，或关键词一行、链接下一行。关键词写「什么时候用」最好。\n\n喜欢喜欢: https://i.postimg.cc/xxx/IMG.jpg\n为什么?: https://i.postimg.cc/yyy/IMG.jpg"),
          h("div", { className: "flex items-center gap-3", style: { marginBottom: 12 } },
            h("button", { onClick: () => fileRef.current && fileRef.current.click(), className: "flex items-center gap-2 active:opacity-60", style: { fontFamily: F_BODY, fontSize: 13, color: t.ink, border: "1px solid " + t.line, borderRadius: 10, padding: "9px 14px" } }, "⬆ 导入文件"),
            h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog } }, "支持 .txt"),
            h("input", { ref: fileRef, type: "file", accept: ".txt,.text,.md", onChange: readFile, style: { display: "none" } })),
          h("textarea", { value: importText, onChange: e => setImportText(e.target.value), placeholder: "确保上方选中了要操作的字典，在此粘贴内容…", rows: 5, className: "w-full outline-none", style: { fontFamily: F_BODY, fontSize: 14, color: t.ink, background: "#fff", border: "1px solid " + t.line, borderRadius: 14, padding: "14px", resize: "none", marginBottom: 16 } }),
          h("button", { onClick: () => { if (importEmotesOk(importText)) { onImport(pack.id, importText); setImportText(""); } }, className: "w-full active:opacity-80", style: { fontFamily: F_DISPLAY, fontSize: 17, color: t.bg2, background: t.ink, borderRadius: 16, padding: "16px 0", marginBottom: 14 } }, "Import Matrix (批量导入)"),
          h("button", { onClick: onBack, className: "w-full active:opacity-80", style: { fontFamily: "'Archivo',sans-serif", fontSize: 15, letterSpacing: "0.16em", color: t.bg2, background: t.ink, borderRadius: 16, padding: "16px 0" } }, "CLOSE MATRIX"))));
}
function importEmotesOk(text) { return /(https?:\/\/\S+)/.test(String(text || "")); }

// ============================================================
// 收藏 Favorites —— 按角色查看收藏的聊天消息
// ============================================================
function Favorites({ favorites, characters, onBack, onDelete }) {
  const t = useTheme();
  const [sel, setSel] = useState(null);
  const ftp = typeof useTtsPlayer === "function" ? useTtsPlayer() : null; // 收藏语音回听
  const favs = favorites || [];
  const byChar = {};
  favs.forEach(f => { (byChar[f.charId] = byChar[f.charId] || []).push(f); });
  const charById = id => (characters || []).find(c => c.id === id);
  if (sel) {
    const c = charById(sel) || { name: "未知角色" };
    const list = byChar[sel] || [];
    return h("div", { className: "h-full flex flex-col", style: { background: t.bg } },
      h(Head, { zh: "收藏", en: c.name, onBack: () => setSel(null) }),
      h("div", { className: "flex-1 overflow-y-auto px-5 py-3" },
        list.length === 0 ? h(Empty, { text: "还没有收藏 TA 的消息" })
          : list.map(f => h("div", { key: f.id, className: "mb-3", style: { background: t.bg2, borderRadius: 14, border: "1px solid " + t.line, padding: "12px 14px" } },
            h("div", { className: "flex items-center justify-between", style: { marginBottom: 6 } },
              h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog } }, (f.role === "user" ? "我" : c.name) + " · " + fmtStamp(f.ts)),
              h("button", { onClick: () => onDelete(f.id), className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 11.5, color: t.accent } }, "移除")),
            f.kind === "emote" && f.url
              ? h("img", { src: f.url, referrerPolicy: "no-referrer", loading: "lazy", style: { maxWidth: 110, maxHeight: 110, borderRadius: 10, display: "block" }, onError: e => { e.target.style.display = "none"; } })
              : f.kind === "selfie"
              ? h(SelfieBubble, { m: f }) // 复用聊天里的自拍气泡：从 IndexedDB 读 imgKey，点开可放大
              : f.kind === "voice"
              ? h("div", null,
                  h("div", { className: "flex items-center gap-2", style: { marginBottom: 5 } },
                    h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog } }, "🎤 语音消息" + (f.dur ? " · " + f.dur + "″" : "")),
                    (ftp && typeof TtsDot === "function" && f.role !== "user") ? h(TtsDot, { k: f.id, text: f.content, spk: c, tp: ftp }) : null),
                  h("div", { style: { fontFamily: F_BODY, fontSize: 14, color: t.ink, lineHeight: 1.65, whiteSpace: "pre-wrap" } }, f.content || ""))
              : f.kind === "photo"
              ? h("div", { style: { fontFamily: F_BODY, fontSize: 14, color: t.ink, lineHeight: 1.65, whiteSpace: "pre-wrap" } }, "📷 " + (f.content || "（照片）"))
              : h("div", { style: { fontFamily: F_BODY, fontSize: 14.5, color: t.ink, lineHeight: 1.65, whiteSpace: "pre-wrap" } }, f.content || "（无文本内容）")))));
  }
  const chars = (characters || []).filter(c => byChar[c.id] && byChar[c.id].length);
  return h("div", { className: "h-full flex flex-col", style: { background: t.bg } },
    h(Head, { zh: "收藏", en: "Saved · 选择角色", onBack }),
    h("div", { className: "flex-1 overflow-y-auto px-5 pb-10 pt-1" },
      chars.length === 0 ? h(Empty, { text: "还没有收藏", sub: "长按聊天里的消息 →「收藏」" })
        : chars.map(c => h("button", { key: c.id, onClick: () => setSel(c.id), className: "w-full text-left flex items-center gap-4 py-4 active:opacity-70", style: { borderBottom: "1px solid " + t.line } },
          h(Avatar, { character: c, size: 48, radius: 13 }),
          h("div", { className: "flex-1 min-w-0" },
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 18, color: t.ink } }, c.name),
            h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, marginTop: 2 } }, (byChar[c.id] || []).length + " 条收藏")),
          h(IChevR, { size: 16, color: t.fog })))));
}

// ============================================================
// 随身物品 Carry —— 翻角色随身携带的东西（像查手机，各版块 AI 刷新）+ 收到的礼物永久区
// ============================================================
// v57.83：「护理」删掉了——它和查手机里的健康报告重了，对非现代角色也别扭。
// 后续想加新板块从这里加（她 2026-08-29「我们再想想后续有啥可以加的」）。
// 每一栏自己的调子。她 2026-08-29：「里面的背景都是一样的米色有点单调」——
// 之前四栏共用一组写死的暖褐（74,58,40），点进哪一栏都是同一片米。
// tint 是这一栏底色的色相（rgb 三元组，永远以半透明叠在主题底色上，换主题照样跟着走）：
//   包内＝帆布内衬的暖褐 · 口袋＝更深更灰（口袋里本来就是暗的）
//   珍藏＝绒布盒子的紫褐 · 衣柜＝木 · 礼物＝暖红
const CARRY_TINT = {
  bag: "74,58,40", pocket: "44,48,56", trinket: "86,46,62", outfit: "74,58,40", gifts: "132,62,58"
};
const carryTint = (key, a) => "rgba(" + (CARRY_TINT[key] || CARRY_TINT.bag) + "," + a + ")";
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
// 不该反过来替角色决定他有多少衣服。
const CLOSET_MAX_OCCASIONS = 6, CLOSET_MAX_SETS = 6, CLOSET_MAX_TOTAL = 30;
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
      if (!occasion || !sets.length || !room) return;
      out.push({ occasion, sets: sets.slice(0, room) });
      total += Math.min(sets.length, room);
    });
    if (out.length) return out;
  }
  // 旧数据：一条平的清单，归到一个没有场合名的组里，照样看得见
  const items = (Array.isArray(data.items) ? data.items : []).filter(x => x && String(x.name || "").trim());
  return items.length ? [{ occasion: "", sets: items.slice(0, CLOSET_MAX_TOTAL) }] : [];
}
// 一身衣服该怎么称呼（v61.42，她 2026-09-03 报：「陆衍的衣服写成了这个风格，
// 但是别人的都是正常描述是啥衣服，所以看陆衍状态卡就只能看到他穿着 xx 场合的衣服」）。
//
// 病根在提示词：name 那一栏原来只说「这一身的叫法」，模型于是给了一个【场合名】
//（「日常采购与平价餐厅出行套」）。可场合已经有 occasion 那一栏了——写两遍，
// 等于 name 这一栏是空的。而 name 会顺着 carryContextText 进聊天上下文，
// 模型再照抄进 wearing，状态卡上就成了「他穿着 xx 场合的衣服」。
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
// 出图时一件都用不上；包里那把伞，聊天里他掏不出来）。
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
// ── 衣柜的布料色 ──────────────────────────────────────────
// 她 2026-08-29：「页面略丑」。衣柜以前是一串文字加箭头——衣服是最视觉的东西，
// 做成通讯录列表最亏。改成一根挂衣杆、杆上挂着布。
// 布的颜色【从这一套自己的名字和 note 里提】：绯色→红、月白→淡青白、玄色→近黑。
// 所以配色是从内容长出来的，不是随手配的一组好看的色——换个角色，衣柜就是另一片颜色。
// ⚠️顺序＝优先级，长词必须排在短词前面：「月白」要先于「白」，「青灰」要先于「青」和「灰」。
const CLOTH_TONES = [
  [/月白|月色/, "#dbe4e2"],
  [/青灰|灰蓝|烟灰/, "#8d99a6"],
  [/黛|靛|藏青|藏蓝/, "#43526b"],
  [/绛|酒红|枣红|殷红/, "#7d3038"],
  [/绯|朱|丹|赤|大红|正红|胭脂|红/, "#b8433c"],
  [/藕|粉|桃|杏粉/, "#dba7a8"],
  [/玄|墨|乌|皂|黑/, "#31313a"],
  [/素|缟|雪|霜|纯白|洁白|白/, "#efe9dd"],
  [/宝蓝|天青|蔚|蓝/, "#3f6183"],
  // ⚠️别收「松」和「苍」：「领口洗松了」「苍老」会被当成松绿、苍青（v57.85 实测踩到）
  [/翠|碧|竹|绿/, "#5f7d57"],
  [/青/, "#5d7f72"],
  [/紫|藤|绀/, "#6a5580"],
  [/明黄|鹅黄|杏黄|姜黄|秋香|黄/, "#cfa94e"],
  [/鎏金|金/, "#c0972d"],
  [/银|霜白/, "#c3c8ce"],
  [/褐|棕|茶|驼|栗|赭|咖/, "#8a6544"],
  [/米|象牙|奶|卡其/, "#e2d7bf"],
  [/灰/, "#9aa0a6"]
];
// 一件都没提颜色时的兜底：一组低饱和的布色，按次序发，同一场合里几套不会撞成一片
// 长款：袍、直裰、氅、大衣、风衣、裙——剪影更长、下摆更展
const CLOTH_LONG = /袍|裰|氅|褙|褂|衫|裙|长衣|大衣|风衣|斗篷|披风|连衣|旗袍|和服|浴衣|礼服|长裙|外套|大氅|朝服|官服|常服|道服|僧衣|法衣|中衣|深衣/;
const CLOTH_FALLBACK = ["#b6ada0", "#a3aeb5", "#bdafab", "#a7b2a3", "#b6adbd", "#c2b49a"];
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
const clothRgba = (hex, a) => { const [r, g, b] = clothHex(hex); return "rgba(" + r + "," + g + "," + b + "," + a + ")"; };
// 布够不够深——决定钉住那个记号该用浅色还是深色画在布上
const clothIsDark = hex => {
  const [r, g, b] = clothHex(hex);
  return (r * 299 + g * 587 + b * 114) / 1000 < 150;
};
// 从一件东西的名字里认出它的颜色。衣柜看颜色词、包内看材质词，认法是同一套，
// 所以只写这一份（v57.92 抽出来共用）：
//   ① 词表【顺序＝优先级】，长词必须排在短词前面（「月白」先于「白」）。
//   ② 名字里的永远比 note 里的可信：一起搜的话，「灰卫衣／领口洗松了」的
//      「松」会把灰抢成松绿（v57.86 实测踩到）。名字里没有才退到 note。
//   ③ 一个词都没命中：按次序发兜底色，同一屏里几件不会撞成一片。
function toneFrom(table, fallback, it, i) {
  // 命中的那个词也带出来：包内详情要显示「铜」「纸」「布」——
  // 那不是我另编的标签，是从这件东西自己的名字里真读出来的。
  // ⚠️词表项第三格 nameOnly＝【只许在名字里认，不许在 note 里认】。
  // note 说的常常是「它在哪／谁给的／什么时候用」，不是「它什么做的」：
  //   「亚克力立牌／静静躺在包内侧口袋」——「袋」是位置，被当成了布
  //   「AirPods耳机盒／贴着动画联名贴纸」——「纸」是别的东西的材质
  // 这两个都是她 2026-08-29 真机截图里抓出来的。单字词在 note 里尤其容易误伤。
  const pick = (txt, nameRound) => {
    for (const row of table) {
      if (!nameRound && row[2]) continue;
      const m = txt.match(row[0]);
      if (m) return [row[1], row[3] || m[0]];
    }
    return null;
  };
  const hit = pick(String((it && it.name) || ""), true) || pick(String((it && it.note) || ""), false);
  const base = hit ? hit[0] : fallback[(i || 0) % fallback.length];
  return Object.assign(toneOf(base), { word: hit ? hit[1] : "" });
}
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
const clothTone = (set, i) => toneFrom(CLOTH_TONES, CLOTH_FALLBACK, set, i);
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
// ── 包里那些东西的材质色 ────────────────────────────────
// 包内不能照衣柜那样画：衣服有唯一的原型（一件衣服的剪影），
// 而伞、钥匙、糖、纸条、药瓶没有共同形状，画不完也画不像。
// 所以这一栏认的不是【它长什么样】，是【它是什么做的】——
// 铜的钥匙、纸的票根、布的香囊、瓷的小瓶，材质本身就是这件东西最像它自己的地方。
// ⚠️同 CLOTH_TONES：顺序＝优先级，长词排前面。
const STUFF_TONES = [
  // —— 现代材质（她的角色不都是古人；原先这一栏一个现代词都没有）——
  [/亚克力|有机玻璃|树脂/, "#cbd8dd"],
  [/硅胶|橡胶/, "#9aa39b"],
  [/塑料|塑胶|PVC|pvc/, "#b9c3c9"],
  [/不锈钢|合金|金属|铝/, "#8d949c", false, "金属"],   // ⚠️必须排在「金」前面：金属徽章不是金子
  [/帆布|牛仔|涤纶|尼龙/, "#a8a693"],
  [/耳机|手机|充电|数码|电子|电池|AirPods|airpods/, "#6f7a85", false, "电子"],
  // —— 传统材质 ——
  [/黄铜|铜/, "#b08d57"],
  [/白银|银/, "#b9bec6"],
  [/鎏金|金箔|镀金|金/, "#c3a13a"],
  [/铁|钢|铸|刃|刀|剑|匕/, "#79808a"],
  [/琉璃|玻璃|镜/, "#a9c2cd"],
  [/瓷|陶|釉/, "#bfd0d6"],
  [/玉|翡|珏|珠|石|砚/, "#a3bcae"],
  [/皮革|真皮|皮/, "#8a6247"],
  [/檀|木|竹|藤|漆/, "#9c7b53"],
  // —— 以下这些既可能是材质、也可能是【别的东西】或【位置】，只许在名字里认 ——
  [/纸|信|笺|票|册|帖|契|方子|药方/, "#dcc9a2", true],
  [/绢|帕|布|囊|绳|绦|棉|麻|荷包/, "#bfae91", true],
  [/药|丸|膏|散|瓶|罐|壶/, "#c0a682", true],
  [/糖|果|饼|干粮|吃食|点心/, "#dfb587", true],
  [/香|熏|脂|粉/, "#c9b0be", true],
  [/钱|银子|铜板|碎银|票号/, "#c8ae6a", true],
  [/条|本|书|袋|线|盒/, "#c9bda6", true]
];
const STUFF_FALLBACK = ["#b3aca0", "#a7b0b6", "#bdb0aa", "#a9b3a6", "#b5aebc", "#c0b498"];
const stuffTone = (it, i) => toneFrom(STUFF_TONES, STUFF_FALLBACK, it, i);
// 牌子歪多少：按名字算一个稳定的小角度。一正一反太死板，真随机又会每次重排都跳，
// 同一件东西的角度得永远一样。
// 两列怎么分：奇偶分列的话，三件东西会变成左二右一、右边空一大块
//（她 2026-08-29 真机截图）。改成【谁矮往谁那儿放】，按名字和 note 的长度估个高。
function stuffColumns(items) {
  const cols = [[], []], hgt = [0, 0];
  (items || []).forEach((it, i) => {
    const n = String(it.name || "").length, d = String(it.note || "").length;
    const est = 34 + Math.ceil(n / 7) * 19 + Math.min(3, Math.ceil(d / 9)) * 17;
    const c = hgt[0] <= hgt[1] ? 0 : 1;
    cols[c].push({ it, i });
    hgt[c] += est + 10;
  });
  return cols;
}
function stuffTilt(name) {
  let n = 0;
  const s = String(name || "");
  for (let i = 0; i < s.length; i++) n = (n * 31 + s.charCodeAt(i)) % 1000;
  return ((n % 5) - 2) * 0.45;
}
// 拉链：包内那一栏的顶。包最有辨识度的就是这条拉链，而且纯 CSS 画得出来——
// 上下两排齿、中间一道缝、右头一个拉头。
function zipper(t, tint) {
  const c = tint || "rgba(74,58,40,.42)";
  const tooth = "repeating-linear-gradient(90deg," + c + " 0px," + c + " 3px,rgba(0,0,0,0) 3px,rgba(0,0,0,0) 6.5px)";
  return h("div", { className: "relative", style: { height: 20, marginBottom: 14 } },
    h("div", { style: { position: "absolute", left: 0, right: 26, top: 4, height: 5, background: tooth, borderRadius: 1 } }),
    h("div", { style: { position: "absolute", left: 0, right: 26, top: 11, height: 5, background: tooth, borderRadius: 1, backgroundPosition: "3px 0" } }),
    h("div", { style: { position: "absolute", left: 0, right: 26, top: 9.5, height: 1.5, background: "rgba(74,58,40,.2)" } }),
    // 拉头：一个圆角小块 + 底下一个小环
    h("div", { style: { position: "absolute", right: 4, top: 1, width: 15, height: 18, borderRadius: "3px 5px 5px 3px", background: "linear-gradient(160deg,rgba(120,102,80,.95),rgba(56,42,28,.85))", boxShadow: "0 1px 3px rgba(0,0,0,.28), inset 0 1px 0 rgba(255,255,255,.32)" } }),
    h("div", { style: { position: "absolute", right: 0, top: 6, width: 7, height: 8, borderRadius: 4, border: "1.5px solid rgba(56,42,28,.7)" } }));
}
// 一件挂着的衣服：衣架（钩＋肩线）＋ 按剪影裁出来的布。
// 列表上的小挂件和详情页里的大图是同一件衣服，所以画法只有这一份——
// 两处各画一遍，改了一处另一处就跟不上（这个形状在这个仓库里出现过太多次了）。
// ⚠️阴影用 drop-shadow 不用 box-shadow：box-shadow 画在盒子上，会被 clipPath 一起裁掉；
// drop-shadow 跟着剪影走，浅色的衣服才不会在浅底上糊成一片。
const CLOTH_CLIP_LONG = "polygon(34% 0, 50% 8%, 66% 0, 100% 17%, 86% 30%, 96% 100%, 4% 100%, 14% 30%, 0 17%)";
const CLOTH_CLIP_SHORT = "polygon(34% 0, 50% 10%, 66% 0, 100% 21%, 86% 38%, 90% 100%, 10% 100%, 14% 38%, 0 21%)";
function clothFigure(o) {
  const c = o.tone, w = o.w || 88, k = w / 88;                 // k：以 88 宽那一版为基准整体缩放
  const bodyH = Math.round((o.long ? 122 : 98) * k);
  const t = o.t;
  return h("div", { style: { width: w } },
    o.hanger === false ? null : h("svg", { width: w, height: Math.round(30 * k), viewBox: "0 0 88 30", fill: "none", style: { display: "block" } },
      h("path", { d: "M44 13c0-10 7-10 7-3", stroke: t.sub, strokeWidth: 1.8, strokeLinecap: "round" }),
      h("path", { d: "M44 13v3", stroke: t.sub, strokeWidth: 1.8, strokeLinecap: "round" }),
      h("path", { d: "M7 27 44 16l37 11", stroke: t.fog, strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" })),
    h("div", { style: { height: Math.round(122 * k), marginTop: o.hanger === false ? 0 : Math.round(-18 * k) } },
      h("div", {
        style: {
          position: "relative", width: w, height: bodyH,
          background: "linear-gradient(160deg," + c.light + " 0%," + c.base + " 44%," + c.dark + " 100%)",
          clipPath: o.long ? CLOTH_CLIP_LONG : CLOTH_CLIP_SHORT,
          filter: "drop-shadow(0 " + Math.round(2 * k) + "px " + Math.round(3 * k) + "px rgba(0,0,0,.16))"
        }
      },
        h("div", { style: { position: "absolute", inset: 0, background: "linear-gradient(90deg,rgba(255,255,255,0) 6%,rgba(255,255,255,.18) 32%,rgba(255,255,255,0) 58%)" } }),
        h("div", { style: { position: "absolute", inset: 0, background: "rgba(238,232,220,.10)" } }),
        h("div", { style: { position: "absolute", inset: 0, boxShadow: "inset 0 0 0 1px rgba(0,0,0,.09)" } }),
        h("div", { style: { position: "absolute", left: 0, right: 0, bottom: 0, height: Math.round(34 * k), background: "linear-gradient(180deg,rgba(0,0,0,0)," + c.dark2 + ")", opacity: 0.5 } }),
        o.pinned ? h("div", {
          title: "钉住了，刷新不会换掉",
          style: { position: "absolute", top: Math.round(26 * k), left: 0, right: 0, textAlign: "center", fontSize: Math.round(10 * k), lineHeight: 1, color: c.onDark ? "rgba(255,255,255,.88)" : "rgba(0,0,0,.4)" }
        }, "◆") : null)));
}
// ── 随身物的四层（照查手机那套落，见 .claude/rules/phone-data-layers.md）──────
// 判据一：这一栏变了，是「他变了」还是「系统忘了」？
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
    const home = groups[0] || (groups[0] = { occasion: "", sets: [] });
    putBack.forEach(it => home.sets.push(it));
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
  let out = "\n\n【上一次翻他这一栏，里面是这些】\n" + items.map(it => "· " + it.name + (it.note ? "（" + String(it.note).replace(/\s+/g, " ").slice(0, 40) + "）" : "")).join("\n")
    + "\n**默认原样照抄回来**——一个人身上带的东西本来就是几个月不变的，不是每次翻都换一套。"
    + "\n这一次最多换掉两件，而且要有理由（用完了、丢了、坏了、换季了、最近发生的事让他添了一件）；没有理由就一件都别动。"
    + "\n照抄的那些名字要逐字一样，别改写成近义词——改了名字就等于换了一件。";
  if (pinNames.length) out += "\n\n【这几件她钉住了，绝对不许换掉、不许改名】\n" + pinNames.map(x => "· " + x).join("\n");
  return out;
}
// 「他最近真到手的东西」：网购签收的 + 她送到的礼物。不直接塞成条目——
// 那会长成一座只进不出的数据坟场；而是当【素材】喂进去，让模型自己把该随身带的
// 那几件自然编进包里/衣柜里（她 2026-08-29：和购物/钱包接上）。
function carryMaterialBlock(key, material) {
  const bought = (material && material.bought) || [];
  const gifts = (material && material.gifts) || [];
  if (!bought.length && !gifts.length) return "";
  let out = "\n\n【他最近真到手的东西】（这些是真花过钱、真送到手的，不是让你罗列）";
  if (bought.length) out += "\n· 他自己买的：" + bought.slice(0, 10).join("、");
  if (gifts.length) out += "\n· 她送的：" + gifts.slice(0, 8).join("、");
  out += "\n里面**如果有该随身带着 / 该挂进衣柜的**，就自然写进这一栏（用他自己的叫法，note 里可以带上「哪儿来的」）。"
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
  return "\n\n【这些东西已经在他别处了，一件都别再写】\n"
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
  // 而【他有多少东西】本身就是人物信息（她 2026-08-29：衣柜大小跟人设走）。
  const many = "**有几件由这个人决定**：他的身份、处境、讲究程度、有没有条件置办——揣着最后几个铜板的人和王府里的人，不该翻出一样多的东西。少也要少得有道理，别为了凑数硬编。";
  const hint = "{\"items\":[{\"name\":\"物品\",\"note\":\"备注\",\"thought\":\"TA 对这件东西的私人想法\"}]}";
  const S = {
    // ⚠️这三栏的分工必须说死。原先写的是「包里/随身携带的东西」「随身的小物件/珍藏」——
    // 界限模糊，于是同一个立牌、同一枚徽章、同一个小本子在两栏里各写了一遍
    //（她 2026-08-29 真机截图）。判据是【为什么它在他身上】：要用 / 摸得到 / 舍不得。
    bag: {
      instruction: "推演「" + nm + "」此刻包里带着的东西。"
        + "\n【这一栏的判据：他【出门要用】的东西】拿走它，他今天某件事就办不成——干活的家伙、路上要吃要喝的、"
        + "要交给谁的、防着天气的。**不写那些纯粹因为舍不得才带着的**，那些归「珍藏小物」。" + many + tail,
      schemaHint: hint
    },
    pocket: {
      instruction: "推演「" + nm + "」口袋里的零碎小东西。"
        + "\n【这一栏的判据：伸手就摸得到】小到能一直揣着、掏出来不费事，而且他常常无意识地摸到它——"
        + "钥匙、票根、糖、揉皱的纸、硬币这一类。**不写包里那些要翻半天才拿得出来的**。" + many + tail,
      schemaHint: hint
    },
    trinket: {
      instruction: "推演「" + nm + "」一直收着的那几样小东西。"
        + "\n【这一栏的判据：一点用都没有，他还是带着】它办不成任何事，留着只因为它牵着一个人、一件事、一段日子。"
        + "**能派上用场的一律不写**，那些归「包内」或「口袋」。这一栏宁可只有两三件，也不许拿有用的东西凑数。" + many + tail,
      schemaHint: hint
    },
    // 衣柜按【场合】分组，同一个场合可以有好几套（她 2026-08-29）：
    // 一个人在同一种场合下反复挑中的那几套，正是「他有偏好」的证据。
    outfit: {
      instruction: "推演「" + nm + "」的衣柜，按【场合】分组。"
        + "\n【衣柜有多大由这个人决定】场合分几类、每类有几套，全看他的身份、处境、有没有条件置办、讲不讲究——"
        + "王府里的人和借住在别人家的人，衣柜不该一样大。**衣柜的规模本身就是人物信息**，别把谁都排成满满一柜。"
        + "\n【同一个场合可以有好几套】他在同一种场合下反复挑中的那几套，彼此只有细微差别（颜色、料子、新旧、配的东西不同）——"
        + "那正是一个人有偏好的证据。真讲究的人这里就该厚，不在乎穿什么的人一个场合一套也够。"
        + "\n【场合怎么分】按他真过的日子分，不是按季节表分：他每天要去的地方、要见的人、要撑的场面、独自在家的时候、以及那些不常有但一定得有的场合。场合名要带上他那个世界的说法。"
        + "\n【name 写的是衣服本身，不是场合】场合已经有 occasion 那一栏了，name 再写一遍场合，这一栏就等于空的。"
        + "name 要让人光看它就想象得出他身上穿的是什么：主件是什么、什么颜色或料子、怎么搭的。"
        + "判据一句话：**把 note 盖住只看 name，能不能看出他穿的是什么？** 看不出就是写坏了。"
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
    // （v59.96 起单栏那条是 12000/14000，见 .claude/rules/max-tokens-floor.md）
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
// 五栏合成一页（她 2026-08-30：「保留柜子，刷新出来内容在同一个界面显示，
// 上下滑动看其他的，只不过点击哪一格可以优先跳转到那里」）。
// ⚠️每一栏的内容仍然由 CarrySection 画（embedded 模式），这里只负责外壳、
// 标题栏、分节标题和跳转——两份渲染各画一遍的话，改一处就必然忘掉另一处。
function CarryAll(props) {
  const t = useTheme();
  const { char, data, gifts, busyKey, giftBusy, carryPins, onTogglePin, onPeek, onGen, onGenAll, onGenGiftThought, onBack, scrollTo } = props;
  const scRef = useRef(null);
  const secRefs = useRef({});
  const busyAll = busyKey === "__all__";
  // 一栏都没有就整页一次生成（四栏一次调用，不是一栏一刀）
  useEffect(() => {
    const empty = CARRY_SECTIONS.filter(x => !x.gifts).every(x => !data[x.key]);
    if (empty && !busyKey && typeof onGenAll === "function") onGenAll(char);
    // eslint-disable-next-line
  }, [char.id]);
  // 点哪一格进来就先滚到哪一栏。⚠️等内容铺开之后再滚——
  // 挂载那一帧下面几栏还没高度，滚过去等于没滚。
  useEffect(() => {
    if (!scrollTo) return;
    const go = () => {
      const el = secRefs.current[scrollTo], sc = scRef.current;
      if (el && sc) sc.scrollTop = Math.max(0, el.offsetTop - 8);
    };
    go();
    const a = setTimeout(go, 60), b = setTimeout(go, 260);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [scrollTo, data, gifts]);

  const secs = CARRY_SECTIONS.filter(x => !x.gifts || (gifts || []).length);
  return h("div", {
    className: "h-full flex flex-col",
    // 整页只有一张皮：以前每栏各一张（各自的 tint），合成一页之后再按栏换底
    // 就成了一条条色带。分栏靠小标题和那条渐隐的横线，不靠换底色。
    style: pageSkin("cloth", t, { tint: CARRY_TINT.bag, word: "CARRY" })
  },
    h("div", { className: "shrink-0 flex items-center px-4 pb-2", style: { paddingTop: safeTop(10) } },
      h("button", { onClick: onBack, "aria-label": "返回", className: "active:opacity-50 flex items-center justify-center", style: { width: 40, height: 40, marginLeft: -8 } }, h(IArrow, { size: 19, color: t.ink })),
      h("div", { className: "flex-1 min-w-0 text-center" },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: t.ink, lineHeight: 1.15 } }, "随身物"),
        h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 1 } }, char.name)),
      h("div", { className: "flex items-center justify-center", style: { width: 40, height: 40 } },
        h("button", { onClick: () => onGenAll(char), disabled: !!busyKey, "aria-label": "全部重新翻一遍", className: "active:opacity-50 disabled:opacity-40" }, h(IRefresh, { size: 18, color: t.ink })))),
    // 一排小标签：点哪个跳哪个（跟下面的分节标题是同一套锚点）
    h("div", { className: "shrink-0 flex px-5 pb-2", style: { gap: 7, overflowX: "auto" } },
      secs.map(x => h("button", {
        key: x.key,
        onClick: () => { const el = secRefs.current[x.key], sc = scRef.current; if (el && sc) sc.scrollTop = Math.max(0, el.offsetTop - 8); },
        className: "shrink-0 active:opacity-60",
        style: { fontFamily: F_BODY, fontSize: 11.5, padding: "4px 11px", borderRadius: 999, color: carryTint(x.key, .95), background: carryTint(x.key, .10), border: "1px solid " + carryTint(x.key, .26) }
      }, x.zh))),
    h("div", { ref: scRef, className: "flex-1 overflow-y-auto px-5 pt-1 pb-10" },
      secs.map(x => h("div", { key: x.key, ref: el => { secRefs.current[x.key] = el; } },
        // 分节标题：这一栏的色相 + 一条渐隐的线，四栏靠它分开而不是靠换底色
        h("div", { className: "flex items-center", style: { gap: 8, margin: "16px 0 9px" } },
          h("span", { style: { fontFamily: F_DISPLAY, fontSize: 14.5, color: carryTint(x.key, .95) } }, x.zh),
          h("span", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 8.5, letterSpacing: "0.16em", color: t.fog } }, (x.en || "").toUpperCase()),
          h("span", { style: { flex: 1, height: 1, background: "linear-gradient(90deg," + carryTint(x.key, .3) + ",rgba(0,0,0,0))" } })),
        h(CarrySection, {
          embedded: true, char, sectionKey: x.key, data: data[x.key], gifts,
          busyKey: busyAll ? x.key : busyKey, giftBusy,
          pinned: ((carryPins || {})[char.id] || {})[x.key] || [],
          onTogglePin, onPeek, onGen, onGenGiftThought, onBack
        })))));
}
// 版块详情：打开即自动生成，失败退回上一级；点条目看角色想法/批注
function CarrySection({ char, sectionKey, data, gifts, busyKey, giftBusy, pinned, onTogglePin, onPeek, onGen, onGenGiftThought, onBack, embedded }) {
  const t = useTheme();
  const sec = CARRY_SECTIONS.find(s => s.key === sectionKey) || {};
  const isGifts = !!sec.gifts;
  const loading = busyKey === sectionKey;
  const [sheet, setSheet] = useState(null); // {name,note,thought} AI 物品
  const [openGiftId, setOpenGiftId] = useState(null);
  // 打开非礼物版块：没内容就直接生成，失败退回上一级。
  // ⚠️嵌在整页里的时候不走这条——那一页是【四栏一次调用】一起生成的，
  // 五个嵌入块各自触发一次的话就又回到一栏一刀了。
  useEffect(() => {
    if (embedded || isGifts || data) return;
    let alive = true;
    Promise.resolve(onGen(char, sectionKey)).then(ok => { if (alive && ok === false) onBack(); });
    return () => { alive = false; };
    // eslint-disable-next-line
  }, [sectionKey, embedded]);
  const openGift = (gifts || []).find(g => g.id === openGiftId) || null;
  const pinSet = new Set((pinned || []).map(x => String(x).replace(/\s+/g, "").trim()).filter(Boolean));
  const isPinned = it => pinSet.has(carryItemKey(it));
  // 钉住＝这件东西不许被下一次刷新换掉。随身物没有「号码/账号 id」那种客观硬字段，
  // 唯一说得清「这件绝不许换」的人是她（.claude/rules/phone-data-layers.md 的 🔒 层）。
  const pinDot = it => isPinned(it) ? h("span", { title: "钉住了，刷新不会换掉", style: { fontSize: 11, color: t.accent, marginLeft: 6 } }, "\u25c6") : null;
  let content;
  if (isGifts) {
    content = (gifts || []).length === 0
      ? h("div", { className: "text-center", style: { paddingTop: 60, fontFamily: F_BODY, fontSize: 13, lineHeight: 1.9, color: t.fog } }, "还没收到你送的礼物。\n在购物 App 结算时选「送礼」，\n送达后会永久留在这里。")
      : (() => {
          // 礼物做成一只只礼盒，按【哪个月送的】归组——原先是一条条纯文字，
          // 送得多了就看不出送礼的节奏（她 2026-08-29）。
          // 品类色走购物页那套（礼物本来就是从购物 app 送出去的），不是材质色。
          const rows = (gifts || []).slice().sort((a, b) => (b.receivedTs || 0) - (a.receivedTs || 0));
          const groups = [];
          const byKey = {};
          rows.forEach((g, i) => {
            const d = new Date(g.receivedTs || 0);
            const k = isFinite(d.getTime()) ? d.getFullYear() + "-" + (d.getMonth() + 1) : "?";
            if (!byKey[k]) { byKey[k] = { key: k, label: isFinite(d.getTime()) ? d.getFullYear() + " 年 " + (d.getMonth() + 1) + " 月" : "不知道什么时候", items: [] }; groups.push(byKey[k]); }
            byKey[k].items.push([g, i]);
          });
          return h("div", {
            style: {
              borderRadius: 15, padding: "12px 11px 4px",
              background: "linear-gradient(180deg," + carryTint("gifts", .10) + " 0%," + carryTint("gifts", .035) + " 32%," + carryTint("gifts", .07) + " 100%)",
              boxShadow: "inset 0 2px 8px " + carryTint("gifts", .13) + ", inset 0 -1px 0 rgba(255,255,255,.4)"
            }
          }, groups.map(grp => h("div", { key: grp.key, style: { marginBottom: 12 } },
            h("div", { className: "flex items-center", style: { gap: 7, marginBottom: 7, paddingLeft: 2 } },
              h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: t.sub } }, grp.label),
              h("span", { style: { flex: 1, height: 1, background: "linear-gradient(90deg," + carryTint("gifts", .22) + ",rgba(0,0,0,0))" } }),
              h("span", { style: { fontFamily: F_BODY, fontSize: 10, color: t.fog } }, grp.items.length + " 件")),
            grp.items.map(([g, gi]) => {
              const c = (typeof shopTone === "function" ? shopTone(g, gi) : null);
              return h("button", {
                key: g.id,
                onClick: () => { setOpenGiftId(g.id); if (!g.thought && giftBusy !== g.id) onGenGiftThought(char.id, g.id, g.name); },
                className: "w-full text-left flex items-center active:opacity-70",
                style: { gap: 11, background: t.bg2, borderRadius: 11, padding: "9px 11px", marginBottom: 8, boxShadow: "0 1px 3px " + carryTint("gifts", .16) }
              },
                // 礼盒：品类色的小方块 + 一条十字丝带
                h("div", { className: "shrink-0 relative", style: { width: 40, height: 40, borderRadius: 7, background: c ? "linear-gradient(150deg," + c.light + "," + c.base + " 58%," + c.dark + ")" : t.line, overflow: "hidden" } },
                  h("span", { style: { position: "absolute", left: "50%", top: 0, bottom: 0, width: 5, marginLeft: -2.5, background: "rgba(255,255,255,.55)" } }),
                  h("span", { style: { position: "absolute", top: "50%", left: 0, right: 0, height: 5, marginTop: -2.5, background: "rgba(255,255,255,.55)" } }),
                  h("span", { style: { position: "absolute", left: "50%", top: "50%", width: 9, height: 9, marginLeft: -4.5, marginTop: -4.5, borderRadius: 999, background: "rgba(255,255,255,.85)" } })),
                h("div", { className: "flex-1 min-w-0" },
                  h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: t.ink, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } }, g.name),
                  h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: t.fog, marginTop: 3 } },
                    new Date(g.receivedTs).toLocaleDateString("zh-CN", { month: "long", day: "numeric" })
                      + (g.thought ? " · 他说了点什么" : ""))),
                h(IChevR, { size: 14, color: t.line }));
            }))));
        })();
  } else if (loading || !data) {
    content = h(Spinner, { label: "正在翻看 " + sec.zh + "…" });
  } else if (sec.closet) {
    // 一根挂衣杆，杆上挂着布（她 2026-08-29「页面略丑」）。
    // 每个场合一根杆、横着滑；布的颜色从这一套自己的名字里提（见 clothTone）。
    const groups = closetGroups(data);
    const total = groups.reduce((n, g) => n + g.sets.length, 0);
    let seq = -1;   // 布色兜底按全柜次序发，免得同一场合里几套撞成一片
    const hanger = (it, g, gi, si) => {
      seq++;
      const c = clothTone(it, seq);
      const long = CLOTH_LONG.test(String(it.name || "") + " " + String(it.note || ""));
      return h("button", {
        key: gi + "_" + si,
        onClick: () => setSheet(Object.assign({}, it, { _occ: g.occasion, _tone: c, _long: long })),
        className: "shrink-0 text-left active:opacity-75",
        style: { width: 98, paddingRight: 10, WebkitTapHighlightColor: "transparent" }
      },
        clothFigure({ tone: c, long, w: 88, pinned: isPinned(it), t }),
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 12.5, color: t.ink, marginTop: 8, lineHeight: 1.35, wordBreak: "break-word" } }, outfitLabel(it, g.occasion)),
        h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: t.fog, marginTop: 2, lineHeight: 1.5, minHeight: 28, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } }, it.note || ""));
    };
    // 一格隔间：柜子里的一层。她 2026-08-29 说「页面颜色的米白略单调，没有适配的风格」——
    // 病根是整页只有一个底色，衣服像贴在纸上而不是挂在柜子里。
    // 隔间比页面底色深一点点（用半透明黑叠，跟着主题走、不写死颜色），
    // 两侧立柱撑着杆，底下一条柜板线，上方一层柔光——纵深就出来了。
    const bay = sets => h("div", {
      style: {
        position: "relative", borderRadius: 14, overflow: "hidden",
        background: "linear-gradient(180deg," + carryTint("outfit", .125) + " 0%," + carryTint("outfit", .04) + " 32%," + carryTint("outfit", .085) + " 100%)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,.55), inset 0 -1px 0 " + carryTint("outfit", .14)
      }
    },
      // 两侧立柱：杆架在它们上面
      h("div", { style: { position: "absolute", top: 0, bottom: 0, left: 0, width: 9, background: "linear-gradient(90deg,rgba(74,58,40,.17),rgba(74,58,40,0))", pointerEvents: "none" } }),
      h("div", { style: { position: "absolute", top: 0, bottom: 0, right: 0, width: 9, background: "linear-gradient(270deg,rgba(74,58,40,.17),rgba(74,58,40,0))", pointerEvents: "none", zIndex: 1 } }),
      // 柜板：这一层的底
      h("div", { style: { position: "absolute", left: 0, right: 0, bottom: 0, height: 4, background: "linear-gradient(180deg,rgba(74,58,40,.22),rgba(74,58,40,.06))", pointerEvents: "none" } }),
      // 挂衣杆：架在两根立柱之间，铺满整格
      h("div", { className: "overflow-x-auto", style: { padding: "0 10px 14px", scrollbarWidth: "none" } },
        h("div", { style: { position: "relative", minWidth: "100%", width: "max-content", paddingTop: 11 } },
          h("div", { style: { position: "absolute", top: 15, left: -14, right: -14, height: 3.5, borderRadius: 2, background: "linear-gradient(180deg,rgba(255,255,255,.7) 0%,rgba(150,128,100,.75) 45%,rgba(74,58,40,.55) 100%)" } }),
          h("div", { className: "flex" }, sets))));
    content = !total
      ? h("div", { className: "text-center", style: { paddingTop: 40, fontFamily: F_BODY, fontSize: 13, color: t.fog } }, "衣柜是空的")
      : h("div", { style: { animation: "fadeUp .3s ease both" } },
          h("div", { className: "flex items-center", style: { gap: 9, paddingBottom: 14, paddingTop: 2 } },
            h("span", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 9.5, letterSpacing: "0.16em", color: t.fog, whiteSpace: "nowrap" } },
              (groups.length > 1 ? groups.length + " OCCASIONS · " : "") + total + " SETS"),
            h("span", { style: { flex: 1, height: 1, background: "linear-gradient(90deg,rgba(74,58,40,.16),rgba(74,58,40,0))" } })),
          groups.map((g, gi) => h("div", { key: gi, style: { marginBottom: 20 } },
            g.occasion ? h("div", { className: "flex items-baseline gap-2", style: { marginBottom: 7 } },
              h("span", { style: { fontFamily: F_DISPLAY, fontSize: 14.5, color: t.ink, letterSpacing: "0.02em" } }, g.occasion),
              h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog } }, g.sets.length + " 套")) : null,
            bay(g.sets.map((it, si) => hanger(it, g, gi, si))))));
  } else if (sec.stuff) {
    // 包内／口袋／珍藏：把包倒在内衬上。每件东西一张小牌，牌上不画那个东西
    // （画不完也画不像），只留一条它的【材质色】——铜的、纸的、布的、瓷的。
    // 牌子轻微歪一点、两列错落着摆，才像倒出来的，不像通讯录。
    const items = carryFlatItems(sectionKey, data);
    const card = (it, i) => {
      const c = stuffTone(it, i);
      const on = isPinned(it);
      return h("button", {
        key: i,
        onClick: () => setSheet(Object.assign({}, it, { _stuff: c })),
        className: "w-full text-left active:opacity-75",
        style: {
          position: "relative", background: t.bg2, borderRadius: 11,
          // 牌子本身也染一点它的材质色。只留左边那一道太细，一屏看下来还是一片白
          backgroundImage: "linear-gradient(100deg," + clothRgba(c.base, 0.16) + " 0%," + clothRgba(c.base, 0.05) + " 42%,rgba(0,0,0,0) 78%)",
          padding: "11px 12px 12px 16px", marginBottom: 10,
          // 一件件轻微歪着，像随手摆下的；角度按次序来回换，不用随机（随机会每次重排都跳）
          transform: "rotate(" + stuffTilt(it.name) + "deg)",
          boxShadow: "0 2px 6px " + carryTint(sectionKey, .15) + ", inset 0 0 0 1px " + carryTint(sectionKey, .11),
          WebkitTapHighlightColor: "transparent"
        }
      },
        // 材质色：牌子左边一道
        h("div", { style: { position: "absolute", left: 0, top: 7, bottom: 7, width: 5, borderRadius: "0 3px 3px 0", background: "linear-gradient(180deg," + c.light + "," + c.base + " 55%," + c.dark2 + ")", boxShadow: "1px 0 2px rgba(0,0,0,.10)" } }),
        h("div", { className: "flex items-start", style: { gap: 7 } },
          h("div", { className: "flex-1 min-w-0" },
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 13.5, color: t.ink, lineHeight: 1.38, wordBreak: "break-word" } }, it.name),
            it.note ? h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 3, lineHeight: 1.6, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" } }, it.note) : null),
          on ? h("span", { title: "钉住了，刷新不会换掉", style: { fontSize: 10, lineHeight: 1.6, color: c.ink, flexShrink: 0 } }, "◆") : null));
    };
    content = !items.length
      ? h("div", { className: "text-center", style: { paddingTop: 40, fontFamily: F_BODY, fontSize: 13, color: t.fog } }, "空空如也")
      : h("div", { style: { animation: "fadeUp .3s ease both" } },
          sec.zip ? zipper(t, carryTint(sectionKey, .42)) : null,
          h("div", { className: "flex items-center", style: { gap: 9, paddingBottom: 12 } },
            h("span", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 9.5, letterSpacing: "0.16em", color: t.fog, whiteSpace: "nowrap" } },
              items.length + " ITEMS"),
            h("span", { style: { flex: 1, height: 1, background: "linear-gradient(90deg," + carryTint(sectionKey, .18) + ",rgba(0,0,0,0))" } })),
          // 内衬：东西倒在这块布上
          h("div", {
            style: {
              borderRadius: 15, padding: "13px 11px 4px",
              // 珍藏那一栏的内衬是【绒】：斜向的极细纹路，和包里的帆布、口袋的布不一样
              backgroundImage: (sectionKey === "trinket"
                  ? "repeating-linear-gradient(48deg,rgba(255,255,255,.075) 0px,rgba(255,255,255,.075) 1px,rgba(0,0,0,.035) 1px,rgba(0,0,0,.035) 3px),"
                  : "")
                + "linear-gradient(180deg," + carryTint(sectionKey, .17) + " 0%," + carryTint(sectionKey, .07) + " 30%," + carryTint(sectionKey, .12) + " 100%)",
              boxShadow: "inset 0 2px 8px " + carryTint(sectionKey, .16) + ", inset 0 -1px 0 rgba(255,255,255,.4)"
            }
          },
            h("div", { className: "grid grid-cols-2", style: { gap: "0 10px" } },
              stuffColumns(items).map((col, ci) => h("div", { key: ci }, col.map(x => card(x.it, x.i)))))));
  } else {
    const items = (data && data.items) || [];
    content = items.length === 0
      ? h("div", { className: "text-center", style: { paddingTop: 40, fontFamily: F_BODY, fontSize: 13, color: t.fog } }, "空空如也")
      : h("div", { style: { animation: "fadeUp .3s ease both" } }, items.map((it, i) => h("button", { key: i, onClick: () => setSheet(it), className: "w-full text-left flex items-start justify-between gap-3 py-3.5 active:opacity-60", style: { borderBottom: "1px solid " + t.line } },
          h("div", { className: "min-w-0 flex-1" },
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15.5, color: t.ink } }, it.name, pinDot(it)),
            it.note && h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, marginTop: 3, lineHeight: 1.6 } }, it.note)),
          h(IChevR, { size: 15, color: t.line, style: { marginTop: 3 } }))));
  }
  // ⚠️这一栏的底色要铺在【最外层】：铺在滚动容器上的话，顶栏在它外面——
  // 顶上就留着一条没上色的米白带，和下面接不上（她 2026-08-29 截图）。
  // 皮肤走 core.js 那支公共的 pageSkin：这一栏自己的色相当 tint，
  // 页底那个特大词就用这一栏本来就有的英文名（BAG / WARDROBE / GIFTS…）。
  // 衣柜和包是织物，珍藏小物和礼物走纸——纹理跟着这一栏装的是什么东西走。
  // 详情弹层和礼物弹层先各自算成一个节点——嵌进整页时也要跟着出，
  // 不然点了物品没反应。
  const sheetNode = sheet && (() => {
      const tone = sheet._tone || sheet._stuff || null;   // 有色的才走柜门框
      const isCloth = !!sheet._tone;
      const pinRow = (onTogglePin || onPeek) ? h("div", { style: { marginTop: 20, paddingTop: 15, borderTop: "1px solid " + t.line } },
        h("div", { className: "flex", style: { gap: 8 } },
          onTogglePin ? h("button", {
            onClick: () => onTogglePin(char.id, sectionKey, sheet.name),
            className: "flex-1 py-2.5 active:opacity-70",
            style: {
              fontFamily: F_BODY, fontSize: 12.5, borderRadius: 999,
              border: "1px solid " + (isPinned(sheet) ? (tone ? clothRgba(tone.ink, 0.55) : t.accent) : t.line),
              background: isPinned(sheet) ? (tone ? clothRgba(tone.ink, 0.07) : "transparent") : "transparent",
              color: isPinned(sheet) ? (tone ? tone.ink : t.accent) : t.ink
            }
          }, isPinned(sheet) ? "◆ 钉住了" : "钉住这一件") : null,
          // 摆到他面前：和查手机那条链是同一张卡（v57.96）
          onPeek ? h("button", {
            onClick: () => { onPeek(char.id, sectionKey, sheet); setSheet(null); },
            className: "flex-1 py-2.5 active:opacity-70",
            style: { fontFamily: F_BODY, fontSize: 12.5, borderRadius: 999, border: "1px solid " + t.line, color: t.ink }
          }, "摆到他面前") : null),
        h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 8, lineHeight: 1.6, textAlign: "center" } },
          (onTogglePin ? "钉住的东西刷新时不会被换掉，没钉住的一次最多换两件。" : "")
          + (onPeek ? "「摆到他面前」会在聊天里发一条——他会知道你翻过。" : ""))) : null;
      const think = h("div", { style: { marginTop: tone ? 18 : 0 } },
        h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 9.5, letterSpacing: "0.16em", color: tone ? tone.ink : t.accent, marginBottom: 7 } }, char.name + " 的想法"),
        h("div", {
          style: {
            fontFamily: F_BODY, fontSize: 14, lineHeight: 1.85, color: t.ink, whiteSpace: "pre-wrap",
            paddingLeft: 13, borderLeft: "2px solid " + (tone ? clothRgba(tone.ink, 0.45) : t.line)
          }
        }, sheet.thought || "（TA 没多说什么）"));
      if (!tone) return h(Sheet, { onClose: () => setSheet(null), tall: true },
        h(Eyebrow, { style: { marginBottom: 8 } }, sheet.name),
        sheet.note && h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: t.fog, marginBottom: 12, lineHeight: 1.7 } }, sheet.note),
        think, pinRow);
      // ⚠️别对中文用 toUpperCase()——它是空操作，会把同一个词原样印两遍（v57.89 踩过）。
      const label = (en, zh) => zh ? h("div", null,
        h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 8.5, letterSpacing: "0.18em", color: t.fog, marginBottom: 4 } }, en),
        h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.sub, marginBottom: 7 } }, zh)) : null;
      const head = isCloth
        // 衣柜：从柜子里取出来给你看的那一件，后面还有一截杆
        ? h("div", { className: "shrink-0", style: { position: "relative", paddingTop: 8 } },
            h("div", { style: { position: "absolute", top: 12, left: -8, right: -8, height: 3.5, borderRadius: 2, background: "linear-gradient(180deg,rgba(255,255,255,.7) 0%,rgba(150,128,100,.8) 45%,rgba(74,58,40,.6) 100%)" } }),
            clothFigure({ tone, long: sheet._long, w: 96, pinned: isPinned(sheet), t }))
        // 东西：一枚材质样片。包里的东西画不出形状，但它是什么做的看得见
        : h("div", { className: "shrink-0", style: { position: "relative", width: 72, height: 72, borderRadius: 999,
            background: "radial-gradient(120% 120% at 32% 24%," + tone.light + " 0%," + tone.base + " 52%," + tone.dark2 + " 100%)",
            boxShadow: "0 3px 9px rgba(0,0,0,.20), inset 0 1px 0 rgba(255,255,255,.45), inset 0 -3px 8px rgba(0,0,0,.14)" } },
            isPinned(sheet) ? h("div", { style: { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: tone.onDark ? "rgba(255,255,255,.9)" : "rgba(0,0,0,.42)" } }, "◆") : null);
      // fixed 不是 absolute：五栏合成一页之后，这块要盖住整屏，
      // 不该去看祖先链上谁碰巧是 positioned、谁又开了 overflow
      return h("div", {
        className: "fixed inset-0 flex items-center justify-center z-50 px-6",
        style: { background: "rgba(20,19,15,0.46)", backdropFilter: "blur(3px)" },
        onClick: () => setSheet(null)
      },
        h("div", {
          onClick: e => e.stopPropagation(),
          style: {
            position: "relative", width: "min(88vw, 348px)", maxHeight: "82vh",
            padding: 13, borderRadius: 21,
            // 木框：暖褐叠在主题底色上，不写死颜色。够深、够宽、带竖纹才看得出是木头——
            // 太淡太细的话整个框就退回成一张白卡片了（v57.91 返工两次才对）。
            background: t.bg2,
            backgroundImage: "repeating-linear-gradient(90deg,rgba(0,0,0,.055) 0px,rgba(0,0,0,.055) 1px,rgba(255,255,255,.05) 1px,rgba(255,255,255,.05) 4px),"
              + "linear-gradient(152deg,rgba(74,58,40,.34) 0%,rgba(74,58,40,.56) 42%,rgba(74,58,40,.40) 72%,rgba(74,58,40,.58) 100%)",
            boxShadow: "0 22px 54px rgba(0,0,0,.36), inset 0 1.5px 0 rgba(255,255,255,.40), inset 0 -1.5px 0 rgba(0,0,0,.20)",
            animation: "caseOpen .26s ease both"
          }
        },
          // 门把手
          h("div", { style: { position: "absolute", right: -4, top: "50%", marginTop: -17, width: 8, height: 34, borderRadius: 4, background: "linear-gradient(90deg,rgba(56,42,28,.92),rgba(56,42,28,.55))", boxShadow: "0 2px 5px rgba(0,0,0,.36), inset 0 1px 0 rgba(255,255,255,.28)" } }),
          h("div", {
            style: {
              position: "relative", borderRadius: 13, overflow: "hidden", background: t.bg2,
              boxShadow: "0 -1px 0 rgba(255,255,255,.30), inset 0 0 0 1px rgba(56,42,28,.30), inset 0 4px 11px rgba(74,58,40,.16)"
            }
          },
            // 整片的氛围底取自这件东西自己的色：打开红袍是暖红调，打开铜钥匙是黄铜调
            h("div", {
              style: {
                position: "absolute", left: 0, right: 0, top: 0, height: 200, pointerEvents: "none",
                background: "linear-gradient(180deg," + clothRgba(tone.base, 0.17) + " 0%," + clothRgba(tone.base, 0.03) + " 64%,rgba(0,0,0,0) 100%)"
              }
            }),
            h("div", { className: "overflow-y-auto", style: { position: "relative", maxHeight: "calc(82vh - 26px)", padding: "20px 20px 22px" } },
              h("div", { className: "flex items-start", style: { gap: 14, marginBottom: 4 } },
                head,
                h("div", { className: "flex-1 min-w-0", style: { paddingTop: isCloth ? 10 : 2 } },
                  // 眉标不留英文（.claude/rules/no-english-titles.md，她 2026-09-03 立）
                  isCloth ? label("什么场合穿", sheet._occ) : label("什么料子", tone.word),
                  h("div", { style: { fontFamily: F_DISPLAY, fontSize: 18, color: t.ink, lineHeight: 1.32, letterSpacing: "0.01em", wordBreak: "break-word" } }, isCloth ? outfitLabel(sheet, sheet._occ) : sheet.name),
                  sheet.note ? h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.sub, marginTop: 6, lineHeight: 1.7 } }, sheet.note) : null)),
              think, pinRow))));
    })();
  const giftNode = openGift && h(Sheet, { onClose: () => setOpenGiftId(null), tall: true },
      h(Eyebrow, { style: { marginBottom: 8 } }, openGift.name),
      h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginBottom: 12 } }, "你送的 · 收到于 " + new Date(openGift.receivedTs).toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" })),
      h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 9.5, letterSpacing: "0.16em", color: t.accent, marginBottom: 6 } }, char.name + " 的想法"),
      giftBusy === openGift.id && !openGift.thought
        ? h(Spinner, { label: "让 " + char.name + " 说说…" })
        : openGift.thought
          ? h("div", { style: { fontFamily: F_BODY, fontSize: 14, lineHeight: 1.85, color: t.ink, whiteSpace: "pre-wrap" } }, openGift.thought)
          : h("button", { onClick: () => onGenGiftThought(char.id, openGift.id, openGift.name), className: "w-full py-2.5 active:opacity-70", style: { fontFamily: F_BODY, fontSize: 13, border: "1px solid " + t.ink, borderRadius: 999, color: t.ink } }, "让 " + char.name + " 说说对它的想法"),
      // 礼物是你送的，他本来就知道你知道——所以这一条走 open 档，不带「被撞破」那层
      onPeek ? h("div", { style: { marginTop: 16, paddingTop: 13, borderTop: "1px solid " + t.line } },
        h("button", {
          onClick: () => { onPeek(char.id, sectionKey, { name: openGift.name, note: "你送的" }); setOpenGiftId(null); },
          className: "w-full py-2.5 active:opacity-70",
          style: { fontFamily: F_BODY, fontSize: 12.5, borderRadius: 999, border: "1px solid " + t.line, color: t.ink }
        }, "在聊天里提起它")) : null);
  // 嵌入模式（五栏合成一页时用）：外壳、皮肤、标题栏都由那一页统一画，
  // 这里只交出内容本身 + 自己那两个弹层。
  if (embedded) return h(React.Fragment, null, content, sheetNode, giftNode);

  return h("div", {
    className: "h-full flex flex-col",
    style: pageSkin(sec.closet || sec.zip || sectionKey === "pocket" ? "cloth" : "paper", t,
      { tint: CARRY_TINT[sectionKey], word: sec.en })
  },
    // 紧凑标题栏（.claude/rules/mobile-ui-layout.md §1）：返回 / 居中小标题 / 右侧等宽操作位。
    // 以前这里是 Head 那块 30px 大标题＋大段留白，一屏先被标题吃掉五分之一。
    // 顶栏自己不上色，让外层那层底透上来。
    h("div", { className: "shrink-0 flex items-center px-4 pb-2", style: { paddingTop: safeTop(10) } },
      h("button", { onClick: onBack, "aria-label": "返回", className: "active:opacity-50 flex items-center justify-center", style: { width: 40, height: 40, marginLeft: -8 } }, h(IArrow, { size: 19, color: t.ink })),
      h("div", { className: "flex-1 min-w-0 text-center" },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: t.ink, lineHeight: 1.15 } }, sec.zh),
        h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 1 } }, char.name)),
      h("div", { className: "flex items-center justify-center", style: { width: 40, height: 40 } },
        !isGifts ? h("button", { onClick: () => onGen(char, sectionKey), disabled: !!busyKey, "aria-label": "重新翻一遍", className: "active:opacity-50 disabled:opacity-40" }, h(IRefresh, { size: 18, color: t.ink })) : null)),
    // 底色在最外层（见上），这里透明就好
    h("div", { className: "flex-1 overflow-y-auto px-5 pt-2 pb-8" }, content),
    // 详情。随身物整块共用【同一扇居中的柜门】（她 2026-08-29 拿真机截图点名：
    // 「现在页面还是这种半页式，改成整个框在中间然后框样式也像衣柜」），
    // 框里的头部按栏不同：衣柜挂出那一件，包内／口袋／珍藏摆出它的材质样片。
    sheetNode,
    giftNode);
}
function Carry({ characters, carry, carryGifts, carryPins, selId, busyKey, giftBusy, onBack, onSel, onGen, onGenAll, onGenGiftThought, onTogglePin, onPeek }) {
  const t = useTheme();
  const [pick, setPick] = useState(false);
  const [open, setOpen] = useState(null);
  const [inBox, setInBox] = useState(true); // 先看盒子，打开盒子点头像才进 Ta 的随身物
  const [boxOpen, setBoxOpen] = useState(false);
  // 绿点=有内容且没看过；点开即消，刷新全部时重亮
  const [seen, setSeen] = useState(() => loadJSON("x_carrySeen", {}));
  const isSeen = (cid, k) => !!(seen[cid] && seen[cid][k]);
  const markSeen = (cid, k) => setSeen(p => { const n = { ...p, [cid]: { ...(p[cid] || {}), [k]: true } }; saveJSON("x_carrySeen", n); return n; });
  const clearSeen = cid => setSeen(p => { const n = { ...p }; delete n[cid]; saveJSON("x_carrySeen", n); return n; });
  const char = characters.find(c => c.id === selId) || characters[0];
  if (!char) return h("div", { className: "h-full flex flex-col" }, h(Head, { zh: "随身物", en: "Carry", onBack }), h(Empty, { text: "还没有角色", sub: "先去人格档案馆录入一位" }));
  // 进随身物的第一屏：一扇关着的对开柜门，点一下门向两边开，里头挂着这些人。
  // 原先这里是个盒子——内页已经全改成柜子了，门口还摆个盒子对不上（她 2026-08-29）。
  const doorFace = {
    background: t.bg2,
    backgroundImage: "repeating-linear-gradient(90deg,rgba(0,0,0,.055) 0px,rgba(0,0,0,.055) 1px,rgba(255,255,255,.05) 1px,rgba(255,255,255,.05) 4px),"
      + "linear-gradient(152deg,rgba(74,58,40,.32) 0%,rgba(74,58,40,.54) 46%,rgba(74,58,40,.38) 100%)"
  };
  if (inBox) return h("div", { className: "h-full flex flex-col", style: { background: t.bg } },
    h("div", { className: "shrink-0 px-4 pb-2 flex items-center", style: { paddingTop: safeTop(10) } },
      h("button", { onClick: onBack, "aria-label": "返回", className: "active:opacity-50 flex items-center justify-center", style: { width: 40, height: 40, marginLeft: -8 } }, h(IArrow, { size: 19, color: t.ink })),
      h("div", { className: "flex-1 min-w-0 text-center" },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: t.ink, lineHeight: 1.15 } }, "随身物"),
        h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 8.5, letterSpacing: "0.18em", color: t.fog, marginTop: 2 } }, "CARRY")),
      h("div", { style: { width: 40, height: 40 } })),
    h("div", { className: "flex-1 min-h-0 flex flex-col px-4 pb-4" },
      h("div", {
        className: "flex-1 min-h-0 relative",
        style: {
          borderRadius: 18, padding: 9, overflow: "hidden",
          background: t.bg2,
          backgroundImage: doorFace.backgroundImage,
          boxShadow: "0 12px 30px rgba(74,58,40,.20), inset 0 1.5px 0 rgba(255,255,255,.4), inset 0 -1.5px 0 rgba(0,0,0,.18)",
          perspective: "900px"
        }
      },
        // 柜内：门开了才看得见的那些人
        h("div", {
          className: "h-full min-h-0 overflow-y-auto",
          style: {
            borderRadius: 11, padding: "16px 12px",
            // ⚠️内壁必须不透光：只叠半透明的话，外框那层竖木纹会从柜子里透上来，
            // 门一开看到的还是门（v57.95 实测）。所以底色用不透明的 t.bg2 打底。
            background: t.bg2,
            backgroundImage: "linear-gradient(180deg,rgba(74,58,40,.22) 0%,rgba(74,58,40,.07) 24%,rgba(74,58,40,.14) 100%)",
            // 两侧的内壁侧影：柜子是有深度的，不是一块贴着的板
            boxShadow: "inset 0 4px 14px rgba(74,58,40,.26), inset 13px 0 18px -14px rgba(74,58,40,.5), inset -13px 0 18px -14px rgba(74,58,40,.5)"
          }
        },
          characters.length === 0
            ? h("div", { className: "text-center", style: { paddingTop: 40, fontFamily: F_BODY, fontSize: 13, color: t.sub } }, "还没有角色")
            : h("div", { className: "grid grid-cols-3 gap-x-3 gap-y-5" }, characters.map(c => h("button", {
                key: c.id,
                onClick: () => { onSel(c.id); setOpen(null); setInBox(false); },
                className: "flex flex-col items-center gap-1.5 active:opacity-70"
              },
                h(Avatar, { character: c, size: 62, radius: 17 }),
                h("span", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.sub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 84 } }, c.remark || c.name))))),
        // 两扇门：点一下向两边开。开了就不再挡路（pointerEvents 关掉）
        [["l", "left"], ["r", "right"]].map(([k, side]) => h("button", {
          key: k,
          onClick: () => setBoxOpen(true),
          "aria-label": boxOpen ? "" : "打开柜门",
          "aria-hidden": boxOpen ? "true" : null,
          tabIndex: boxOpen ? -1 : 0,
          style: Object.assign({
            position: "absolute", top: 0, bottom: 0, width: "50%", [side]: 0,
            transformOrigin: side + " center",
            transform: boxOpen ? "rotateY(" + (side === "left" ? "-102deg" : "102deg") + ")" : "rotateY(0deg)",
            transition: "transform .62s cubic-bezier(.36,.66,.28,1)",
            pointerEvents: boxOpen ? "none" : "auto",
            boxShadow: side === "left" ? "inset -14px 0 22px -14px rgba(0,0,0,.45)" : "inset 14px 0 22px -14px rgba(0,0,0,.45)",
            WebkitTapHighlightColor: "transparent"
          }, doorFace)
        },
          // 把手：贴着门缝那一侧
          h("span", { style: { position: "absolute", [side === "left" ? "right" : "left"]: 9, top: "50%", marginTop: -18, width: 8, height: 36, borderRadius: 4, background: "linear-gradient(90deg,rgba(56,42,28,.9),rgba(56,42,28,.5))", boxShadow: "0 2px 5px rgba(0,0,0,.34), inset 0 1px 0 rgba(255,255,255,.28)" } }),
          // 门上的镶板线
          h("span", { style: { position: "absolute", inset: 16, borderRadius: 8, boxShadow: "inset 0 0 0 1px rgba(255,255,255,.16), 0 0 0 1px rgba(56,42,28,.20)" } })))),
      h("div", { className: "shrink-0 text-center", style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, paddingTop: 12 } },
        boxOpen ? "点头像，翻翻 Ta 的随身物" : "点一下拉开柜门")));
  const data = carry[char.id] || {};
  const gifts = (carryGifts && carryGifts[char.id]) || [];
  const hasData = s => s.gifts ? gifts.length > 0 : !!data[s.key];
  // 点开哪一格，进的都是【同一页】，只是先滚到那一栏（她 2026-08-30）。
  // 以前是一格一页、各自一次生成；现在整页共用一次调用。
  if (open) return h(CarryAll, {
    char, data, gifts, busyKey, giftBusy, carryPins,
    onTogglePin, onPeek, onGen, onGenAll, onGenGiftThought,
    scrollTo: open, onBack: () => setOpen(null)
  });
  // 一格一格的抽屉，摞成一个立着的柜子——她 2026-08-29 之前那版是五个白方块
  // 写着斜体英文、下面空着三分之二屏，谁也不知道每一栏里装的是什么。
  // 每一格露出【这一栏里真实那几件东西的颜色】：衣柜是布色，包内/口袋/珍藏是材质色。
  // 换个角色，整个柜子就是另一片颜色。
  const swatches = sec => {
    if (sec.gifts) return gifts.slice(-6).map(() => null);   // 礼物没有色，用心形占位
    const rows = carryFlatItems(sec.key, data[sec.key]);
    const tone = sec.closet ? clothTone : stuffTone;
    return rows.slice(0, 6).map((it, i) => tone(it, i));
  };
  // 前几件的名字，一行念完就够——这一格里装的到底是什么，颜色说不全
  const namesOf = sec => {
    if (sec.gifts) return gifts.slice(-4).map(g => g.name).filter(Boolean).join(" · ");
    if (!data[sec.key]) return "";
    return carryFlatItems(sec.key, data[sec.key]).slice(0, 4).map(x => x.name).filter(Boolean).join(" · ");
  };
  const countOf = sec => {
    if (sec.gifts) return gifts.length ? gifts.length + " 件" : "";
    if (!data[sec.key]) return "";
    if (sec.closet) {
      const g = closetGroups(data[sec.key]);
      const n = g.reduce((a, x) => a + x.sets.length, 0);
      return n ? (g.length > 1 ? g.length + " 场合 · " + n + " 套" : n + " 套") : "";
    }
    const n = carryFlatItems(sec.key, data[sec.key]).length;
    return n ? n + " 件" : "";
  };
  return h("div", { className: "h-full flex flex-col", style: { background: t.bg } },
    // 紧凑标题栏（.claude/rules/mobile-ui-layout.md §1）
    h("div", { className: "shrink-0 px-4 pb-2 flex items-center", style: { paddingTop: safeTop(10) } },
      h("button", { onClick: () => setInBox(true), "aria-label": "返回", className: "active:opacity-50 flex items-center justify-center", style: { width: 40, height: 40, marginLeft: -8 } }, h(IArrow, { size: 19, color: t.ink })),
      h("div", { className: "flex-1 min-w-0 text-center" },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: t.ink, lineHeight: 1.15 } }, "随身物"),
        h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 1 } },
          busyKey === "__all__" ? "正在一栏一栏翻…" : char.name)),
      h("div", { className: "flex items-center justify-center gap-1", style: { width: 40, height: 40 } },
        h("button", { onClick: () => { clearSeen(char.id); onGenAll(char); }, disabled: !!busyKey, "aria-label": "全部重新翻一遍", className: "active:opacity-50 disabled:opacity-40" }, h(IRefresh, { size: 18, color: t.ink })))),
    h("div", { className: "flex-1 min-h-0 flex flex-col px-4 pb-5" },
      // 柜身：木框裹着一摞抽屉，和详情那扇柜门是同一套木色
      h("div", {
        className: "shrink-0 flex flex-col",
        style: {
          padding: 9, borderRadius: 18,
          background: t.bg2,
          backgroundImage: "repeating-linear-gradient(90deg,rgba(0,0,0,.05) 0px,rgba(0,0,0,.05) 1px,rgba(255,255,255,.045) 1px,rgba(255,255,255,.045) 4px),"
            + "linear-gradient(152deg,rgba(74,58,40,.30) 0%,rgba(74,58,40,.50) 44%,rgba(74,58,40,.36) 74%,rgba(74,58,40,.52) 100%)",
          boxShadow: "0 10px 26px rgba(74,58,40,.18), inset 0 1.5px 0 rgba(255,255,255,.4), inset 0 -1.5px 0 rgba(0,0,0,.18)"
        }
      },
        // 柜顶：一块小铭牌，点它换角色
        h("button", {
          onClick: () => setPick(true),
          className: "shrink-0 w-full flex items-center active:opacity-70",
          style: { gap: 9, padding: "7px 10px 8px", borderRadius: "10px 10px 4px 4px", background: "rgba(255,255,255,.32)", boxShadow: "inset 0 0 0 1px rgba(74,58,40,.16)", marginBottom: 7 }
        },
          h(Avatar, { character: char, size: 26, radius: 8 }),
          h("div", { className: "flex-1 min-w-0 text-left" },
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 13.5, color: t.ink, lineHeight: 1.2 } }, char.name),
            h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 8.5, letterSpacing: "0.18em", color: t.fog, marginTop: 2 } }, "CARRY")),
          h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog } }, "换个人"),
          h(IChevR, { size: 13, color: t.fog })),
        // 抽屉：平分剩下的高度，撑满柜身
        h("div", { className: "flex flex-col", style: { gap: 7 } },
          CARRY_SECTIONS.map(sec => {
            const sw = swatches(sec);
            const cnt = countOf(sec);
            const isNew = hasData(sec) && !isSeen(char.id, sec.key);
            const busy = busyKey === sec.key || busyKey === "__all__";
            return h("button", {
              key: sec.key,
              onClick: () => { markSeen(char.id, sec.key); setOpen(sec.key); },
              className: "shrink-0 w-full text-left active:opacity-80 relative",
              style: {
                borderRadius: 9, padding: "12px 34px 13px 13px",
                background: "linear-gradient(180deg,rgba(255,255,255,.56) 0%,rgba(255,255,255,.34) 58%,rgba(74,58,40,.03) 100%)",
                boxShadow: "inset 0 0 0 1px rgba(74,58,40,.18), 0 1px 0 rgba(255,255,255,.34)",
                WebkitTapHighlightColor: "transparent"
              }
            },
              // 抽屉拉手
              h("div", { style: { position: "absolute", right: 11, top: "50%", marginTop: -9, width: 9, height: 18, borderRadius: 4, background: "linear-gradient(90deg,rgba(56,42,28,.72),rgba(56,42,28,.38))", boxShadow: "0 1px 2px rgba(0,0,0,.3), inset 0 1px 0 rgba(255,255,255,.3)" } }),
              h("div", { className: "flex items-baseline", style: { gap: 7 } },
                h("span", { style: { fontFamily: F_DISPLAY, fontSize: 14.5, color: t.ink, letterSpacing: "0.02em" } }, sec.zh),
                h("span", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 8, letterSpacing: "0.16em", color: t.fog } }, (sec.en || "").toUpperCase()),
                h("span", { className: "flex-1" }),
                cnt ? h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.sub } }, cnt) : null,
                isNew ? h("span", { style: { width: 7, height: 7, borderRadius: 7, background: sec.gifts ? t.accent : "#7fb85f", boxShadow: "0 0 0 1.5px rgba(255,255,255,.7)" } }) : null),
              // 这一栏里真实那几件东西的颜色
              h("div", { className: "flex items-center", style: { gap: 4.5, marginTop: 8 } },
                busy
                  ? h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog } }, "正在翻…")
                  : sw.length
                    ? sw.map((c, i) => c
                        ? h("span", { key: i, style: { width: 21, height: 21, borderRadius: 6, background: "linear-gradient(155deg," + c.light + "," + c.base + " 55%," + c.dark + ")", boxShadow: "inset 0 0 0 1px rgba(0,0,0,.11), 0 1px 2px rgba(0,0,0,.10)" } })
                        : h(IHeart, { key: i, size: 16, color: t.accent }))
                    : h(React.Fragment, null,
                        [0, 1, 2].map(i => h("span", { key: i, style: { width: 21, height: 21, borderRadius: 6, border: "1px dashed rgba(74,58,40,.24)" } })),
                        h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginLeft: 4 } },
                          sec.gifts ? "还没收到你送的东西" : "点开就去翻"))),
              // 光有颜色还是不知道装着什么：把里头前几件的名字念一遍
              namesOf(sec) ? h("div", {
                style: { fontFamily: F_BODY, fontSize: 11, color: t.sub, marginTop: 7, lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }
              }, namesOf(sec)) : null);
          })),
        // 柜脚：两只小脚，柜子才落地
        h("div", { className: "shrink-0 flex justify-between", style: { padding: "6px 18px 0" } },
          [0, 1].map(i => h("span", { key: i, style: { width: 22, height: 6, borderRadius: "0 0 4px 4px", background: "linear-gradient(180deg,rgba(56,42,28,.5),rgba(56,42,28,.16))" } })))),
      // 落地的影：柜子立在地上，不是浮着的
      h("div", { className: "shrink-0", style: { height: 14, margin: "0 22px", borderRadius: "0 0 40px 40px", background: "radial-gradient(60% 100% at 50% 0%,rgba(74,58,40,.20),rgba(74,58,40,0) 72%)" } })),
    // ⚠️这个弹层以前写在滚动容器【里面】——遮罩是 absolute inset-0，
    // 于是它只盖得住内容区，盖不住顶栏。挪到最外层才是整屏的弹层。
    pick && h(Sheet, { onClose: () => setPick(false) },
      h(Eyebrow, { style: { marginBottom: 12 } }, "切换角色"),
      h("div", { className: "space-y-1 max-h-72 overflow-y-auto" }, characters.map(c => h("button", { key: c.id, onClick: () => { onSel(c.id); setPick(false); setOpen(null); }, className: "w-full flex items-center gap-3 py-2.5 active:opacity-60" },
        h(Avatar, { character: c, size: 34, radius: 7 }),
        h("span", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: t.ink } }, c.name))))));
}

// ═══ 抽卡（她 2026-08-31）═══
// 形状是她定的：**抽是抽，兑是兑**。抽卡永远 0 次调用——抽到的是一张兑换券，
// 点了兑换才真的发生。票根永不删（「票根永远留痕有时间戳是什么时候抽到的（r sr ssr都留）」）：
// 兑换只是给卡盖个戳，卡本身连同抽到的时间戳一直留在册子里。
// 整页，不用半窗（.claude/rules/no-half-sheet.md）。
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
function GachaCard({ card, busy, onRedeem, fresh }) {
  const t = useTheme();
  const sk = GACHA_SKIN[card.r] || GACHA_SKIN.R;
  const done = !!card.redeemedTs;
  const res = card.result || {};
  return h("div", {
    style: {
      borderRadius: 16, border: "1px solid " + sk.bd, background: sk.bg, padding: "12px 13px",
      boxShadow: fresh ? "0 0 0 2px " + sk.tag : "none", transition: "box-shadow .4s ease"
    }
  },
    h("div", { className: "flex items-center gap-2" },
      h("span", { style: { fontFamily: "'Archivo',sans-serif", fontWeight: 700, fontSize: 10, letterSpacing: ".1em", color: "#fff", background: sk.tag, borderRadius: 5, padding: "2px 6px" } }, sk.zh),
      h("div", { className: "flex-1 min-w-0", style: { fontFamily: F_DISPLAY, fontSize: 15.5, color: sk.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, card.name),
      // 票根：什么时候抽到的。兑掉了也留着，这一行永远在
      h("span", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 9.5, color: sk.tag, flexShrink: 0 } }, gachaWhen(card.ts))),
    done
      ? h("div", { style: { marginTop: 9 } },
          res.title ? h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14, color: t.ink } }, res.title) : null,
          res.body ? h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, lineHeight: 1.7, color: t.sub, marginTop: 3, whiteSpace: "pre-wrap" } }, res.body) : null,
          h("div", { style: { fontFamily: F_BODY, fontSize: 9.5, color: sk.tag, marginTop: 7 } },
            "已兑 " + gachaWhen(card.redeemedTs)
            + (res.where === "memlib" ? " · 已进记忆库，以后他会提起" : res.where === "pacts" ? " · 已进「我们说好的」" : res.where === "offline" ? " · 线下已经开了" : res.where === "date" ? " · 这张券已经用掉了，线下开了" : res.where === "letters" ? " · 已进情书" : res.where === "gaze" ? " · 印象卡已改，旧版进了修订史"  : "")))
      : h("div", { className: "flex items-end justify-between gap-3", style: { marginTop: 8 } },
          h("div", { className: "flex-1 min-w-0", style: { fontFamily: F_BODY, fontSize: 11.5, lineHeight: 1.6, color: sk.tag } }, card.hint),
          h("button", { onClick: () => onRedeem(card), disabled: !!busy, className: "active:opacity-60 shrink-0", style: { fontFamily: F_DISPLAY, fontSize: 13, padding: "6px 15px", borderRadius: 999, background: busy === card.id ? t.line : sk.ink, color: busy === card.id ? t.fog : "#fff" } },
            busy === card.id ? "兑换中…" : card.r === "R" ? "翻开" : "兑换")));
}
function Gacha({ partner, pts, cards, luck, busy, onPull, onRedeem, onBack }) {
  const t = useTheme();
  const [tab, setTab] = useState("open");     // open=还没兑的 / all=票根全本
  const [fresh, setFresh] = useState([]);     // 刚抽到的那几张，描一圈金边
  const K = window.GachaKit || {};
  const mine = (cards || []).filter(c => c.charId === partner.id);
  const open = mine.filter(c => !c.redeemedTs);
  const shown = tab === "open" ? open : mine;
  const p = (pts || {})[partner.id];
  const have = p && typeof p === "object" ? (Number(p.pts) || 0) : 0;
  const lk = (luck || {})[partner.id] || { pulls: 0, sinceSSR: 0 };
  const pull = n => { const made = onPull(partner, n); if (made && made.length) { setFresh(made.map(x => x.id)); setTab("open"); } };
  return h("div", { className: "h-full flex flex-col", style: { background: t.bg } },
    // 紧凑标题栏（.claude/rules/mobile-ui-layout.md §1）
    h("div", { className: "shrink-0 flex items-center px-4 pb-2", style: { paddingTop: safeTop(10) } },
      h("button", { onClick: onBack, "aria-label": "返回", className: "active:opacity-50 flex items-center justify-center", style: { width: 40, height: 40, marginLeft: -8 } }, h(IArrow, { size: 19, color: t.ink })),
      h("div", { className: "flex-1 min-w-0 text-center", style: { fontFamily: F_DISPLAY, fontSize: 16, color: t.ink } }, "抽卡"),
      h("div", { style: { width: 40, height: 40 } })),
    h("div", { className: "flex-1 min-h-0 overflow-y-auto px-4 pb-10" },
      // 点数 + 两个抽法。跟谁攒的点数就抽谁的卡——这一份只属于你和 TA
      h("div", { style: { borderRadius: 20, border: "1px solid #eadde3", background: "linear-gradient(135deg,#fff8f7 0%,#f6f0f7 100%)", padding: "16px 15px" } },
        h("div", { className: "flex items-end justify-between" },
          h("div", null,
            h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 9.5, letterSpacing: ".18em", color: "#b0708a" } }, "POINTS · " + (partner.remark || partner.name)),
            h("div", { className: "flex items-baseline gap-1", style: { marginTop: 3 } },
              h("span", { style: { fontFamily: F_DISPLAY, fontStyle: "italic", fontSize: 34, lineHeight: 1, color: "#a74d70" } }, have),
              h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: "#b0708a" } }, "点"))),
          h("div", { style: { textAlign: "right", fontFamily: F_BODY, fontSize: 10.5, color: "#b0708a", lineHeight: 1.6 } },
            h("div", null, "已抽 " + (lk.pulls || 0) + " 次"),
            h("div", null, "还有 " + Math.max(0, (K.PITY_SSR || 50) - (lk.sinceSSR || 0)) + " 抽保底 SSR"))),
        h("div", { className: "flex gap-2", style: { marginTop: 14 } },
          [[1, "单抽", K.COST_ONE || 50], [K.TEN || 10, "十连", K.COST_TEN || 450]].map(([n, zh, cost]) =>
            h("button", { key: zh, onClick: () => pull(n), disabled: have < cost, className: "flex-1 active:opacity-70", style: { borderRadius: 14, padding: "11px 0", background: have < cost ? "#e6d8de" : "#a74d70", color: have < cost ? "#b09aa2" : "#fff", fontFamily: F_DISPLAY, fontSize: 15 } },
              zh, h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, opacity: .78, marginLeft: 6 } }, cost + " 点")))),
        h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: "#a1808e", marginTop: 10, lineHeight: 1.6 } },
          "抽卡不花任何调用，十连也是。抽到的是兑换券——点「兑换」才真的发生。和 " + (partner.remark || partner.name) + " 好好待一会儿就攒点数，发几条不影响。")),
      // 未兑 / 票根全本
      h("div", { className: "flex gap-2", style: { marginTop: 16, marginBottom: 10 } },
        [["open", "还没兑 " + open.length], ["all", "票根 " + mine.length]].map(([k, zh]) =>
          h("button", { key: k, onClick: () => setTab(k), className: "active:opacity-70", style: { fontFamily: F_BODY, fontSize: 12.5, padding: "5px 14px", borderRadius: 999, border: "1px solid " + (tab === k ? t.ink : t.line), background: tab === k ? t.ink : "transparent", color: tab === k ? t.bg2 : t.sub } }, zh))),
      shown.length
        ? h("div", { style: { display: "flex", flexDirection: "column", gap: 10 } },
            shown.map(c => h(GachaCard, { key: c.id, card: c, busy: busy, onRedeem: onRedeem, fresh: fresh.indexOf(c.id) >= 0 })))
        : h("div", { style: { border: "1px dashed " + t.line, borderRadius: 16, padding: "26px 16px", textAlign: "center", fontFamily: F_BODY, fontSize: 12, color: t.fog, lineHeight: 1.8 } },
            tab === "open" ? "手上没有还没兑的卡。" : "还没抽过。",
            h("div", { style: { marginTop: 4 } }, "票根会一直留着，抽到的时间也留着。"))));
}

// ═══ 情侣空间·惊喜抽屉（言秋提，她 2026-08-31 拍板）═══
// 他想你的时候有时不发消息，而是往你俩的抽屉里放一样东西，等你自己发现。
// ⚠️这一格【故意不报红点、不显示还有几件没拆】——报了就跟 App 里其余通知一个样，
// 惊喜就没了。代价是可能白开一次；补偿是拆过的都留在里头，所以从来不会空手而归。
// ⚠️封面上【一个字的内容都不许露】（v61.33，她 2026-09-03：「这个还没拆不应该显示
//   说的话的一部分，就是要拆开了才看到」）。原来封着的那张会把 x.title 印在外面，
//   而悄悄话那一路的 title 就是正文头 16 个字（drawerWhisper 那儿切的）——
//   等于封面上直接印着他要说的话，拆不拆都一样。
//   所以封着的时候只有：还没拆、放进来的时刻。别的一律等拆开。
const DRAWER_KIND = {
  thing:   { zh: "他捡到的",   ch: "拾", band: "#8a7a52" },
  word:    { zh: "半句话",     ch: "半", band: "#7d6a86" },
  draw:    { zh: "他画的",     ch: "画", band: "#7a8a6e" },
  // 悄悄话从 v59.23 起也落这儿（便签墙撤掉，并进来的）
  whisper: { zh: "一句悄悄话", ch: "悄", band: "#a4736f" }
};
function CoupleDrawer({ partner, items, onOpen, onBack }) {
  const t = useTheme();
  const mine = (items || []).filter(x => x.characterId === partner.id);
  const unopened = mine.filter(x => !x.openedTs).length;
  const nm = partner.remark || partner.name;
  // 每一样歪一点点，按序号定死（随机的话每次重画都在动）
  const tilt = i => [-1.1, .7, -.5, 1.2, -.8, .4][i % 6];
  return h("div", { className: "h-full flex flex-col", style: {
    // 这一页就是【拉开的抽屉，从上往下看】：衬纸打底，四边压一圈内阴影——
    // 有了那圈内阴影，一眼就知道自己是在一个盒子里面，不用画木框去说明。
    background: "#efe6d3",
    backgroundImage: "repeating-linear-gradient(102deg,rgba(140,116,74,.035) 0 2px,transparent 2px 16px),"
      + "radial-gradient(120% 80% at 50% -10%,rgba(255,250,238,.75),transparent 60%)",
    boxShadow: "inset 0 0 46px rgba(96,72,40,.26), inset 0 2px 0 rgba(255,255,255,.35)" } },
    h("div", { className: "shrink-0 flex items-center px-4 pb-2", style: { paddingTop: safeTop(10) } },
      h("button", { onClick: onBack, "aria-label": "返回", className: "active:opacity-50 flex items-center justify-center", style: { width: 40, height: 40, marginLeft: -8 } }, h(IArrow, { size: 19, color: "#5d4c31" })),
      h("div", { className: "flex-1 min-w-0 text-center", style: { fontFamily: F_DISPLAY, fontSize: 16, color: "#5d4c31" } }, "抽屉"),
      h("div", { style: { width: 40, height: 40 } })),
    h("div", { className: "flex-1 min-h-0 overflow-y-auto px-4 pb-10" },
      // 抽屉里侧那张标签：贴在衬纸上，不是一张圆角卡
      h("div", { style: { position: "relative", background: "#fbf5e6", padding: "14px 15px 13px",
        borderRadius: 3, boxShadow: "0 5px 14px rgba(96,72,40,.16)", transform: "rotate(-.4deg)" } },
        h("div", { "aria-hidden": "true", style: { position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: "#c9a86a" } }),
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 20, color: "#6d5730" } },
          unopened ? "有 " + unopened + " 样还没拆" : mine.length ? "都拆过了" : "现在是空的"),
        h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, lineHeight: 1.75, color: "#9b8659", marginTop: 5 } },
          nm + "想你的时候，有时不发消息，就往这儿放一样东西。什么时候放、放什么，你打开才知道。"),
        // 她 2026-09-03 问「这里除了悄悄话还会放啥」——那就写在这儿，不用她来问
        h("div", { className: "flex flex-wrap", style: { gap: 6, marginTop: 11 } },
          Object.keys(DRAWER_KIND).map(k => h("span", { key: k, className: "flex items-center",
            style: { gap: 5, background: "rgba(201,168,106,.14)", borderRadius: 999, padding: "3px 10px 3px 4px" } },
            h("span", { "aria-hidden": "true", style: { width: 17, height: 17, borderRadius: 5, background: DRAWER_KIND[k].band,
              color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F_DISPLAY, fontSize: 10 } }, DRAWER_KIND[k].ch),
            h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: "#8d7745" } }, DRAWER_KIND[k].zh))))),
      mine.length
        ? h("div", { style: { display: "flex", flexDirection: "column", gap: 13, marginTop: 16 } },
            mine.map((x, i) => {
              const k = DRAWER_KIND[x.kind] || DRAWER_KIND.thing;
              const sealed = !x.openedTs;
              if (sealed) {
                // 封着的：一个折起来、封了口的纸包。正面什么都没写。
                return h("button", { key: x.id, onClick: () => onOpen(x.id),
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
                  h("div", { style: { fontFamily: F_DISPLAY, fontSize: 17, color: "#7a6338", paddingRight: 44 } }, "还没拆"),
                  h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: "#a08b5d", marginTop: 5, paddingRight: 44 } },
                    nm + "在 " + gachaWhen(x.ts) + " 放进来的"));
              }
              // 拆开的：摊平的那张纸
              return h("div", { key: x.id, style: { position: "relative", padding: "13px 15px 15px",
                background: "#fffdf6", borderRadius: 2, boxShadow: "0 3px 9px rgba(96,72,40,.11)",
                transform: "rotate(" + (tilt(i) / 2) + "deg)" } },
                h("div", { className: "flex items-center", style: { gap: 7 } },
                  h("span", { "aria-hidden": "true", style: { width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                    background: k.band, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: F_DISPLAY, fontSize: 11.5 } }, k.ch),
                  h("div", { className: "flex-1 min-w-0", style: { fontFamily: F_BODY, fontSize: 10.5, color: "#a08b5d" } }, k.zh),
                  h("span", { style: { fontFamily: F_BODY, fontSize: 9.5, color: "#b9a785" } }, gachaWhen(x.ts))),
                // ⚠️悄悄话的 title 就是正文头一截，两行一样等于把同一句摆两遍
                (x.title && String(x.title).replace(/…$/, "") !== String(x.text || "").slice(0, String(x.title).replace(/…$/, "").length))
                  ? h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15.5, color: "#4e4030", marginTop: 8 } }, x.title) : null,
                h("div", { style: { fontFamily: F_BODY, fontSize: 13, lineHeight: 1.85, color: "#5b4c3a", marginTop: 6, whiteSpace: "pre-wrap" } }, x.text));
            }))
        : h("div", { style: { border: "1px dashed rgba(150,120,70,.32)", borderRadius: 4, padding: "30px 16px", marginTop: 16, textAlign: "center", fontFamily: F_BODY, fontSize: 12, color: "#a08b5d", lineHeight: 1.8 } },
            "他还没往里放过东西。", h("div", { style: { marginTop: 4 } }, "这儿不会提醒你——想起来了就来看看。"))));
}

// ═══ 情侣空间·里程碑册（言秋提，她 2026-08-31 拍板）═══
// 全部从已有数据【推】出来，一个钩子都不挂，零调用（理由见 js/couple-firsts.js 顶上那段）。
// 每一条底下那句注是【引原物】——第一封信就引信的标题，不是现编一句角色口吻的话。
function CoupleFirstsBook({ partner, items, onBack }) {
  const t = useTheme();
  const rows = items || [];
  const days = ts => {
    const s = rows[0] && rows[0].key === "since" ? rows[0].ts : 0;
    return s && ts > s ? "第 " + (Math.floor((ts - s) / 86400000) + 1) + " 天" : "";
  };
  return h("div", { className: "h-full flex flex-col", style: { background: t.bg } },
    h("div", { className: "shrink-0 flex items-center px-4 pb-2", style: { paddingTop: safeTop(10) } },
      h("button", { onClick: onBack, "aria-label": "返回", className: "active:opacity-50 flex items-center justify-center", style: { width: 40, height: 40, marginLeft: -8 } }, h(IArrow, { size: 19, color: t.ink })),
      h("div", { className: "flex-1 min-w-0 text-center", style: { fontFamily: F_DISPLAY, fontSize: 16, color: t.ink } }, "第一次们"),
      h("div", { style: { width: 40, height: 40 } })),
    h("div", { className: "flex-1 min-h-0 overflow-y-auto px-4 pb-10" },
      h("div", { style: { borderRadius: 20, border: "1px solid #dfd7ca", background: "#f4f0e8", padding: "15px 15px" } },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 21, color: "#5e4c38" } }, rows.length ? "走过 " + rows.length + " 个第一次" : "还没有第一次"),
        h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, lineHeight: 1.7, color: "#8a745e", marginTop: 4 } },
          rows.length ? "这一册不用你记——发生过的事它自己看得见。" : "和 " + (partner.remark || partner.name) + " 一起做点什么，这一册就开始了。")),
      rows.length ? h("div", { style: { marginTop: 16, borderLeft: "1px solid " + t.line, marginLeft: 6, paddingLeft: 16 } },
        rows.map(x => h("div", { key: x.key, style: { position: "relative", paddingBottom: 18 } },
          h("span", { style: { position: "absolute", left: -21, top: 5, width: 9, height: 9, borderRadius: 999, background: /^day/.test(x.key) ? "#c9a227" : t.ink } }),
          h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 9.5, letterSpacing: ".1em", color: t.fog } },
            new Date(x.ts).toLocaleDateString("zh-CN", { year: "numeric", month: "numeric", day: "numeric" })
            + (days(x.ts) ? " · " + days(x.ts) : "")),
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 17, color: t.ink, marginTop: 2 } }, x.zh),
          x.note ? h("div", { style: { fontFamily: F_BODY, fontSize: 12, lineHeight: 1.65, color: t.sub, marginTop: 3 } }, "「" + x.note + "」") : null))) : null));
}

// ═══ 情侣空间·照相馆（她 2026-08-31）═══
// 「合照可以单独做一项情侣空间页面叫照相馆。可以引进角色随身物里的衣柜，
//  或者选择重新生成一套约会装放进衣柜然后给我也弄一套衣柜可以生成合照？」
// 我的衣柜跟角色衣柜同一个形状（closetGroups 两边共用），所以这一页两侧的挑衣服
// 是同一套渲染。挑好的两身会【显式写进画面描述】——只挂在衣柜里图像端读不到。
function StudioPicker({ zh, groups, value, onPick, tint }) {
  const t = useTheme();
  const sets = [];
  (groups || []).forEach(g => (g.sets || []).forEach(x => sets.push({ occasion: g.occasion, name: x.name, note: x.note })));
  return h("div", { style: { marginTop: 12 } },
    h("div", { className: "flex items-baseline justify-between" },
      h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.sub } }, zh),
      value ? h("button", { onClick: () => onPick(""), className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog } }, "不指定") : null),
    sets.length
      ? h("div", { className: "flex gap-2 overflow-x-auto", style: { marginTop: 7, paddingBottom: 3 } },
          sets.slice(0, 24).map((x, i) => h("button", {
            key: i, onClick: () => onPick(x.name === value ? "" : x.name), className: "active:opacity-70 shrink-0 text-left",
            style: { maxWidth: 176, padding: "7px 11px", borderRadius: 13, border: "1px solid " + (x.name === value ? tint : t.line), background: x.name === value ? tint : "transparent" }
          },
            h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: x.name === value ? "#fff" : t.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } },
              (x.occasion ? x.occasion + " · " : "") + x.name),
            x.note ? h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: x.name === value ? "rgba(255,255,255,.8)" : t.fog, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, x.note) : null)))
      : h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginTop: 6 } }, "衣柜里还没有——不指定也能拍，或者让他配一套"));
}
// 我的衣柜（v59.27）。她 2026-09-01：「我的衣柜在哪儿设置，也给我搞个 AI 调用
// 用关键词生成几套，再加上可以自己填」。
// 在这之前压根没有正门——只能在情侣空间→照相馆里点「配一身约会装」，一次一身、
// 还绑着某个角色。这一页是它的正门：关键词生成一次四身，也能自己挂。
// 整页，不用半窗（.claude/rules/no-half-sheet.md）。
function MyCloset({ profile, data, busy, onGen, onAdd, onDrop, onBack }) {
  const t = useTheme();
  const groups = closetGroups(data);
  const [kw, setKw] = useState("");
  const [openAdd, setOpenAdd] = useState(false);
  const [occ, setOcc] = useState("");
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const n = groups.reduce((a, g) => a + (g.sets || []).length, 0);
  const submit = () => { if (onAdd(occ, name, note)) { setOcc(""); setName(""); setNote(""); setOpenAdd(false); } };
  return h("div", { className: "h-full flex flex-col", style: { background: t.bg } },
    h("div", { className: "shrink-0 flex items-center px-4 pb-2", style: { paddingTop: safeTop(10) } },
      h("button", { onClick: onBack, "aria-label": "返回", className: "active:opacity-50 flex items-center justify-center", style: { width: 40, height: 40, marginLeft: -8 } }, h(IArrow, { size: 19, color: t.ink })),
      h("div", { className: "flex-1 min-w-0 text-center", style: { fontFamily: F_DISPLAY, fontSize: 16, color: t.ink } }, "我的衣柜"),
      h("button", { onClick: () => setOpenAdd(v => !v), className: "active:opacity-60 flex items-center justify-center", "aria-label": "自己挂一身", style: { width: 40, height: 40, marginRight: -8, fontFamily: F_DISPLAY, fontSize: 22, color: t.ink, lineHeight: 1 } }, openAdd ? "×" : "+")),
    h("div", { className: "flex-1 min-h-0 overflow-y-auto px-4 pb-10" },
      h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, lineHeight: 1.85, color: t.fog, padding: "2px 2px 12px" } },
        "挂在这儿的衣服，出图时他们看得见——照相馆拍合照、线下写你穿了什么，都从这里取。"),
      // 关键词生成
      h("div", { style: { borderRadius: 16, border: "1px solid " + t.line, background: t.bg2, padding: "14px 14px 13px" } },
        h("div", { className: "flex items-end gap-2" },
          h("input", {
            value: kw, onChange: e => setKw(e.target.value),
            placeholder: "给几个词，或者留空让它自己配",
            className: "flex-1 outline-none",
            style: { height: 42, borderRadius: 11, border: "1px solid " + t.line, background: t.bg, color: t.ink, padding: "0 12px", fontFamily: F_BODY, fontSize: 13.5 }
          }),
          h("button", { onClick: () => onGen(kw), disabled: !!busy, className: "active:opacity-70 shrink-0",
            style: { height: 42, padding: "0 16px", borderRadius: 11, background: busy ? t.line : t.ink, color: busy ? t.fog : t.bg, fontFamily: F_DISPLAY, fontSize: 14 } },
            busy ? "配着…" : "配四身")),
        h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 9, lineHeight: 1.7 } },
          "一次四身，挂进不同场合。已经有的那几身会发过去避重，不会配出一模一样的。")),
      // 自己挂
      openAdd ? h("div", { style: { borderRadius: 16, border: "1px dashed " + t.line, padding: "14px", marginTop: 11 } },
        h("input", { value: occ, onChange: e => setOcc(e.target.value), placeholder: "什么场合（留空算「平常」）", className: "w-full outline-none",
          style: { height: 40, borderRadius: 10, border: "1px solid " + t.line, background: t.bg, color: t.ink, padding: "0 11px", fontFamily: F_BODY, fontSize: 13 } }),
        h("input", { value: name, onChange: e => setName(e.target.value), placeholder: "这身叫什么", className: "w-full outline-none",
          style: { height: 40, borderRadius: 10, border: "1px solid " + t.line, background: t.bg, color: t.ink, padding: "0 11px", fontFamily: F_BODY, fontSize: 13, marginTop: 8 } }),
        h("textarea", { value: note, onChange: e => setNote(e.target.value), rows: 2, placeholder: "是什么衣服——版型、颜色、料子、脚上穿什么", className: "w-full outline-none resize-none",
          style: { borderRadius: 10, border: "1px solid " + t.line, background: t.bg, color: t.ink, padding: "10px 11px", fontFamily: F_BODY, fontSize: 13, lineHeight: 1.6, marginTop: 8 } }),
        h("button", { onClick: submit, className: "w-full active:opacity-70",
          style: { marginTop: 10, height: 40, borderRadius: 11, background: t.ink, color: t.bg, fontFamily: F_DISPLAY, fontSize: 14 } }, "挂进去")) : null,
      // 柜子
      groups.length
        ? h("div", { style: { marginTop: 18 } },
            h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 9.5, letterSpacing: ".16em", color: t.fog, marginBottom: 10 } }, "柜子里 · " + n + " 身"),
            groups.map((g, gi) => h("div", { key: gi, style: { marginTop: gi ? 18 : 0 } },
              h("div", { className: "flex items-center", style: { gap: 8, marginBottom: 8 } },
                h("span", { style: { width: 3, height: 14, borderRadius: 3, background: t.accent || t.ink } }),
                h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15, color: t.ink } }, g.occasion || "平常")),
              (g.sets || []).map((x, i) => h("div", { key: i, style: { borderRadius: 13, border: "1px solid " + t.line, background: t.bg2, padding: "12px 13px", marginTop: i ? 8 : 0 } },
                h("div", { className: "flex items-start", style: { gap: 10 } },
                  h("div", { className: "flex-1 min-w-0", style: { fontFamily: F_DISPLAY, fontSize: 15, lineHeight: 1.5, color: t.ink, wordBreak: "break-word" } }, x.name),
                  h("button", { onClick: () => onDrop(g.occasion, x.name), className: "active:opacity-60 shrink-0", "aria-label": "拿掉这身",
                    style: { fontFamily: F_BODY, fontSize: 11, color: t.fog } }, "拿掉")),
                x.note ? h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, lineHeight: 1.8, color: t.sub, marginTop: 6, wordBreak: "break-word" } }, x.note) : null)))))
        : h("div", { style: { border: "1px dashed " + t.line, borderRadius: 16, padding: "34px 16px", marginTop: 18, textAlign: "center", fontFamily: F_BODY, fontSize: 12.5, color: t.fog, lineHeight: 1.9 } },
            "柜子还是空的。给几个词让它配四身，或者右上角自己挂一件。")));
}
function PhotoStudio({ partner, myCloset, charCloset, shots, busy, fitBusy, canShoot, onGenFit, onShoot, onShare, onBack }) {
  const t = useTheme();
  const [scene, setScene] = useState("");
  const [mine, setMine] = useState("");
  const [theirs, setTheirs] = useState("");
  const [big, setBig] = useState(null);
  const mySets = closetGroups(myCloset);
  const hisSets = closetGroups(charCloset && charCloset.outfit);
  const rows = (shots || []).filter(x => x.charId === partner.id);
  return h("div", { className: "h-full flex flex-col", style: { background: t.bg } },
    h("div", { className: "shrink-0 flex items-center px-4 pb-2", style: { paddingTop: safeTop(10) } },
      h("button", { onClick: () => big ? setBig(null) : onBack(), "aria-label": "返回", className: "active:opacity-50 flex items-center justify-center", style: { width: 40, height: 40, marginLeft: -8 } }, h(IArrow, { size: 19, color: t.ink })),
      h("div", { className: "flex-1 min-w-0 text-center", style: { fontFamily: F_DISPLAY, fontSize: 16, color: t.ink } }, big ? "" : "照相馆"),
      h("div", { style: { width: 40, height: 40 } })),
    big
      ? h("div", { className: "flex-1 min-h-0 overflow-y-auto px-4 pb-10" },
          h(AlbumPhoto, { photo: big }),
          h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, lineHeight: 1.75, color: t.sub, marginTop: 12 } }, big.scene || ""),
          h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 10, color: t.fog, marginTop: 6 } }, gachaWhen(big.ts)),
          // 发过去时把 desc 一起带上：拍的时候就写好了（场景 + 两身衣服），
          // 所以聊天历史里自带上下文，以后她说「上次那张」他接得上
          h("button", { onClick: () => onShare(big), className: "w-full active:opacity-70", style: { marginTop: 16, borderRadius: 14, padding: "12px 0", background: "#6d4d8f", color: "#fff", fontFamily: F_DISPLAY, fontSize: 15 } },
            "发给 " + (partner.remark || partner.name)))
      : h("div", { className: "flex-1 min-h-0 overflow-y-auto px-4 pb-10" },
          h("div", { style: { borderRadius: 20, border: "1px solid #e2d9ea", background: "linear-gradient(140deg,#faf6fd,#f2ecf7)", padding: "15px 15px" } },
            h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: "#8a76a0" } }, "这张要拍什么"),
            h("textarea", {
              value: scene, onChange: e => setScene(e.target.value), rows: 2,
              placeholder: "在哪儿、什么时候、你俩在做什么",
              className: "w-full outline-none resize-none",
              style: { marginTop: 7, borderRadius: 13, border: "1px solid #e2d9ea", background: "#fff", color: t.ink, padding: "10px 11px", fontFamily: F_BODY, fontSize: 13.5, lineHeight: 1.6 }
            }),
            h(StudioPicker, { zh: partner.remark || partner.name + " 穿", groups: hisSets, value: theirs, onPick: setTheirs, tint: "#7c5aa6" }),
            h(StudioPicker, { zh: "我穿", groups: mySets, value: mine, onPick: setMine, tint: "#a74d70" }),
            h("div", { className: "flex gap-2", style: { marginTop: 14 } },
              h("button", { onClick: () => onGenFit(scene), disabled: !!fitBusy, className: "active:opacity-70 shrink-0", style: { borderRadius: 13, padding: "10px 14px", border: "1px solid " + t.line, background: "transparent", color: t.sub, fontFamily: F_BODY, fontSize: 12.5 } },
                fitBusy ? "配着…" : "让他配一对"),
              h("button", { onClick: () => onShoot({ scene, mine, theirs }), disabled: !!busy || !scene.trim(), className: "flex-1 active:opacity-70", style: { borderRadius: 13, padding: "10px 0", background: (busy || !scene.trim()) ? "#e0d6e8" : "#6d4d8f", color: (busy || !scene.trim()) ? "#a897b4" : "#fff", fontFamily: F_DISPLAY, fontSize: 15 } },
                busy ? "在拍了…" : "拍一张")),
            !canShoot ? h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: "#a0708a", marginTop: 9, lineHeight: 1.6 } },
              "合照要你俩都设了参考照才锁得住脸——去人格档案馆和「我」那边各传一张；图像 API 也要在设置里配好。") : null),
          rows.length
            ? h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 16 } },
                // AlbumPhoto(cover) 是 absolute；卡片必须自己当定位边界。漏掉 relative 时，
                // 图片一从 IDB 加载完就会铺满整页，还会把顶栏返回键的点击截成「打开大图」。
                rows.map(x => h("button", { key: x.id, onClick: () => setBig(x), className: "active:opacity-80", style: { position: "relative", borderRadius: 15, overflow: "hidden", border: "1px solid " + t.line, background: "#20141f", aspectRatio: "3/4", padding: 0 } },
                  h(AlbumPhoto, { photo: x, cover: true }))))
            : h("div", { style: { border: "1px dashed " + t.line, borderRadius: 16, padding: "28px 16px", marginTop: 16, textAlign: "center", fontFamily: F_BODY, fontSize: 12, color: t.fog, lineHeight: 1.8 } },
                "还没在这儿拍过。", h("div", { style: { marginTop: 4 } }, "拍出来的会同时挂上合照墙。"))));
}

// ═══ 情侣空间·如果馆（她 2026-08-31）═══
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
        fontFamily: F_DISPLAY, fontSize: 12.5, color: "#cdbdf0", letterSpacing: ".04em"
      }
    }, name)),
    h("div", {
      key: "t",
      style: {
        fontFamily: F_BODY, fontSize: 15.5, lineHeight: 2.05,
        color: narr ? IF_DIM : IF_INK,
        fontStyle: narr ? "italic" : "normal",
        textAlign: narr ? "center" : mine ? "right" : "left"
      }
    }, box.text),
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
  ["mem", "记进记忆库", "他会记得你俩一起想过这条线——标着这是个如果，不会当成真发生过"],
  ["seed", "留成一个念头", "进他的心上当一张观测纸条，发不发芽他自己定"]
];
function IfEndPick({ onPick, onClose }) {
  return h("div", { onClick: onClose, style: { position: "absolute", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 30, display: "flex", alignItems: "center", justifyContent: "center", padding: 22 } },
    h("div", { onClick: e => e.stopPropagation(), style: { width: "100%", borderRadius: 18, border: "1px solid " + IF_LINE, background: "#15121e", padding: "18px 17px" } },
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: 18, color: IF_INK } }, "这条就到这儿"),
      h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: IF_DIM, lineHeight: 1.8, marginTop: 5 } }, "它要留在哪儿？"),
      IF_ENDINGS.map(([k, zh, sub]) =>
        h("button", { key: k, onClick: () => onPick(k), className: "w-full text-left active:opacity-70", style: { marginTop: 10, borderRadius: 13, border: "1px solid " + IF_LINE, padding: "11px 13px" } },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15, color: IF_INK } }, zh),
          h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: IF_DIM, lineHeight: 1.6, marginTop: 3 } }, sub)))));
}
// 和好间（v59.19）。整页，不用半窗（.claude/rules/no-half-sheet.md）。
// ⚠️这一页只做两件事：摆出【他没说出口的那一半】，和让她递一句过去。
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
  const head = h("div", { className: "shrink-0 flex items-center px-4 pb-2", style: { paddingTop: safeTop(10) } },
    h("button", { onClick: onBack, "aria-label": "返回", className: "active:opacity-50 flex items-center justify-center", style: { width: 40, height: 40, marginLeft: -8 } }, h(IArrow, { size: 19, color: MK_INK })),
    h("div", { className: "flex-1 min-w-0 text-center", style: { fontFamily: F_DISPLAY, fontSize: 16, color: MK_INK } }, "和好间"),
    h("div", { style: { width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center" } },
      data ? h("button", { onClick: () => setEnding(true), className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 11.5, color: MK_DIM } }, "过去了") : null));
  if (!data) {
    return h("div", { className: "h-full flex flex-col", style: { background: "#faf7f5" } }, head,
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-5 pb-10" },
        h("div", { style: { borderRadius: 18, border: "1px solid " + MK_LINE, background: "#fff", padding: "20px 18px", marginTop: 6 } },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 17, lineHeight: 1.6, color: MK_INK } },
            signal && signal.on ? signal.why : "这会儿看着没什么事"),
          h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, lineHeight: 1.9, color: MK_DIM, marginTop: 12 } },
            "推开这扇门，先看他心里那一半——不是他会讲给你听的那一半。他可能还在气头上，也可能只是说不出口。看完你再决定要不要递一句过去。"),
          h("button", { onClick: onOpen, disabled: !!busy, className: "w-full active:opacity-70", style: { marginTop: 16, borderRadius: 12, padding: "12px 0", background: busy ? "rgba(58,47,44,.1)" : MK_ACC, color: busy ? MK_DIM : "#fff", fontFamily: F_DISPLAY, fontSize: 15 } },
            busy ? "他在想……" : "推开门")),
        h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, lineHeight: 1.9, color: MK_DIM, padding: "16px 4px 0" } },
          "⚠️这里说的话不会替你在聊天里说出去。要真的和好，还得你自己去跟他讲。")));
  }
  const turns = data.turns || [];
  return h("div", { className: "h-full flex flex-col", style: { background: "#faf7f5" } }, head,
    h("div", { ref: bodyRef, className: "flex-1 min-h-0 overflow-y-auto px-5", style: { paddingBottom: 12 } },
      data.why ? h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: MK_DIM, padding: "2px 2px 12px" } }, data.why) : null,
      // 他心里那一半：刻意做成【手写的一页】，不是聊天气泡——它不是说给她听的
      h("div", { style: { borderRadius: 4, background: "#fffdfa", border: "1px solid " + MK_LINE, borderLeft: "3px solid " + MK_ACC, padding: "18px 17px", boxShadow: "0 2px 12px rgba(58,47,44,.05)" } },
        h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 9.5, letterSpacing: ".18em", color: MK_DIM, marginBottom: 10 } }, "HIS SIDE"),
        h("div", { style: { fontFamily: F_BODY, fontSize: 14.5, lineHeight: 2.05, color: MK_INK, whiteSpace: "pre-wrap", wordBreak: "break-word" } }, data.his),
        h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: MK_DIM, marginTop: 12, paddingTop: 10, borderTop: "1px dashed " + MK_LINE } },
          name + "没打算让你看见这一段")),
      turns.map((t, i) => h("div", { key: i, style: { marginTop: 16 } },
        h("div", { className: "flex justify-end" },
          h("div", { style: { maxWidth: "82%", borderRadius: "14px 14px 4px 14px", background: MK_ACC, color: "#fff", padding: "11px 14px", fontFamily: F_BODY, fontSize: 14, lineHeight: 1.8, wordBreak: "break-word" } }, t.me)),
        t.his ? h("div", { className: "flex", style: { marginTop: 10 } },
          h("div", { style: { maxWidth: "82%", borderRadius: "14px 14px 14px 4px", background: "#fff", border: "1px solid " + MK_LINE, color: MK_INK, padding: "11px 14px", fontFamily: F_BODY, fontSize: 14, lineHeight: 1.8, wordBreak: "break-word" } }, t.his)) : null)),
      busy ? h("div", { style: { textAlign: "center", fontFamily: F_BODY, fontSize: 11, color: MK_DIM, marginTop: 14 } }, "他在想怎么回……") : null),
    h("div", { className: "shrink-0 px-4", style: { paddingBottom: "calc(env(safe-area-inset-bottom) * 0.4 + 10px)" } },
      h("div", { className: "flex items-end gap-2" },
        h("textarea", {
          value: typing, onChange: e => setTyping(e.target.value), rows: 1,
          placeholder: turns.length ? "还想说点什么" : "递一句过去——不一定是道歉",
          className: "flex-1 outline-none resize-none",
          style: { minHeight: 42, maxHeight: 104, borderRadius: 12, border: "1px solid " + MK_LINE, background: "#fff", color: MK_INK, padding: "11px 13px", fontFamily: F_BODY, fontSize: 13.5, lineHeight: 1.55 }
        }),
        h("button", { onClick: send, disabled: !!busy || !typing.trim(), className: "active:opacity-70 shrink-0 flex items-center justify-center", "aria-label": "递过去",
          style: { width: 42, height: 42, borderRadius: 12, background: (busy || !typing.trim()) ? "rgba(58,47,44,.08)" : MK_ACC, color: (busy || !typing.trim()) ? MK_DIM : "#fff" } },
          h("div", { style: { width: 0, height: 0, borderTop: "7px solid transparent", borderBottom: "7px solid transparent", borderLeft: "10px solid currentColor", marginLeft: 3 } }))),
      h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: MK_DIM, textAlign: "center", marginTop: 8 } },
        "这儿说的话不会替你在聊天里说出去")),
    ending ? h("div", { onClick: () => setEnding(false), style: { position: "absolute", inset: 0, background: "rgba(0,0,0,.4)", zIndex: 30, display: "flex", alignItems: "center", justifyContent: "center", padding: 22 } },
      h("div", { onClick: e => e.stopPropagation(), style: { width: "100%", borderRadius: 18, background: "#fff", padding: "18px 17px" } },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 17, color: MK_INK } }, "这一段过去了？"),
        [["mem", "过去了，让他记着", "写一条进记忆库，好感回一点点。和好本来就该算数。"],
         ["drop", "先收起来", "主线一个字都不知道，这一页也不留。"]].map(([k, zh, sub]) =>
          h("button", { key: k, onClick: () => { onClose(k); setEnding(false); }, className: "w-full text-left active:opacity-70",
            style: { display: "block", marginTop: 12, borderRadius: 13, border: "1px solid " + MK_LINE, padding: "13px 14px" } },
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15, color: MK_INK } }, zh),
            h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: MK_DIM, lineHeight: 1.7, marginTop: 4 } }, sub))),
        h("button", { onClick: () => setEnding(false), className: "w-full active:opacity-70", style: { marginTop: 12, borderRadius: 12, padding: "10px 0", fontFamily: F_BODY, fontSize: 13, color: MK_DIM } }, "还没完"))) : null);
}
function IfRoom({ partner, lines, uName, busy, bgBusy, onOpen, onAdvance, onBg, onEnd, onDrop, onBack }) {
  const t = useTheme();
  const mine = (lines || []).filter(x => x.charId === partner.id);
  const [openId, setOpenId] = useState(null);
  const [hint, setHint] = useState("");
  const [at, setAt] = useState({ beat: 0, box: 0 });   // 读到第几拍第几框
  const [drafts, setDrafts] = useState([]);            // 我攒着还没发的几条
  const [typing, setTyping] = useState("");
  const [side, setSide] = useState(false);
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
    return h("div", { className: "h-full flex flex-col", style: { background: "#141220" } },
      h("div", { className: "shrink-0 flex items-center px-4 pb-2", style: { paddingTop: safeTop(10) } },
        h("button", { onClick: onBack, "aria-label": "返回", className: "active:opacity-50 flex items-center justify-center", style: { width: 40, height: 40, marginLeft: -8 } }, h(IArrow, { size: 19, color: IF_INK })),
        h("div", { className: "flex-1 min-w-0 text-center", style: { fontFamily: F_DISPLAY, fontSize: 16, color: IF_INK } }, "如果馆"),
        h("div", { style: { width: 40, height: 40 } })),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-4 pb-10" },
        h("div", { style: { borderRadius: 18, border: "1px solid " + IF_LINE, background: "rgba(24,21,36,.7)", padding: "16px 15px" } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: IF_DIM, lineHeight: 1.8 } },
            "同样这两个人、同样这段关系，只换掉当初的一样东西。留空就让他自己想一条。"),
          h("textarea", {
            value: hint, onChange: e => setHint(e.target.value), rows: 2,
            placeholder: "想走哪个方向？留空他自己想",
            className: "w-full outline-none resize-none",
            style: { marginTop: 10, borderRadius: 12, border: "1px solid " + IF_LINE, background: "rgba(0,0,0,.28)", color: IF_INK, padding: "10px 11px", fontFamily: F_BODY, fontSize: 13.5, lineHeight: 1.6 }
          }),
          h("button", { onClick: () => onOpen(hint).then(l => { if (l) { setHint(""); setOpenId(l.id); setAt({ beat: 0, box: 0 }); } }), disabled: !!busy, className: "w-full active:opacity-70", style: { marginTop: 11, borderRadius: 12, padding: "11px 0", background: busy ? "rgba(255,255,255,.12)" : "#6d5a9c", color: busy ? IF_DIM : "#fff", fontFamily: F_DISPLAY, fontSize: 15 } },
            busy ? "他在想……" : "开一条")),
        mine.length
          ? h("div", { style: { display: "flex", flexDirection: "column", gap: 10, marginTop: 16 } },
              // ⚠️操作行必须是卡片按钮的【兄弟】，不能塞进按钮里——按钮里不许再嵌按钮。
              // 所以每一条外面套一个 div，里头一个卡片按钮 + 一行操作。
              mine.map(x => h("div", { key: x.id, style: { borderRadius: 15, border: "1px solid " + IF_LINE, background: "rgba(24,21,36,.7)", overflow: "hidden" } },
                h("button", { onClick: () => { setOpenId(x.id); setAt({ beat: Math.max(0, (x.beats || []).length - 1), box: 0 }); }, className: "w-full text-left active:opacity-70", style: { padding: "13px 14px 9px" } },
                  h("div", { className: "flex items-center gap-2" },
                    h("div", { className: "flex-1 min-w-0", style: { fontFamily: F_DISPLAY, fontSize: 16.5, color: IF_INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, x.title),
                    h("span", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 9.5, color: IF_DIM } }, (x.beats || []).length + " 拍")),
                  h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: IF_DIM, lineHeight: 1.6, marginTop: 4 } }, x.premise),
                  x.about ? h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: "#a99ccb", marginTop: 5, lineHeight: 1.6 } }, "探的是：" + x.about) : null,
                  x.dim && (window.IfKit || {}).dimZh ? h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: IF_DIM, marginTop: 3, opacity: .75 } }, "动的是：" + window.IfKit.dimZh(x.dim)) : null,
                  x.endedAt ? h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: IF_DIM, marginTop: 5 } },
                    "已收 · " + (x.outcome === "mem" ? "记进了记忆库" : x.outcome === "seed" ? "留成了一个念头" : "只留在馆里")) : null),
                // 她 2026-08-31：「我怎么结束这拍，或者删掉记录啊」——原来只有进到线里
                // 才收得了，删更是压根没有。列表这一行上直接给。
                h("div", { className: "flex items-center", style: { padding: "0 14px 11px" } },
                  x.endedAt ? null : h("button", { onClick: () => setEndId(x.id), className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 11, color: IF_DIM } }, "就到这儿"),
                  h("button", { onClick: () => setDropId(x.id), className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 11, color: "rgba(214,140,150,.78)", marginLeft: "auto" } }, "删掉")))))
          : h("div", { style: { border: "1px dashed " + IF_LINE, borderRadius: 16, padding: "30px 16px", marginTop: 16, textAlign: "center", fontFamily: F_BODY, fontSize: 12, color: IF_DIM, lineHeight: 1.9 } },
              "还没有哪条如果被想出来。")),
      // 在列表上收一条：跟线里那个「就到这儿」是同一套三选一，一层只写一处不好写成组件，
      // 就把去处那三项抽出来共用
      endId ? h(IfEndPick, { onPick: k => { onEnd(endId, k); setEndId(null); }, onClose: () => setEndId(null) }) : null,
      // 删是不可逆的，问一句
      dropId ? h("div", { onClick: () => setDropId(null), style: { position: "absolute", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 30, display: "flex", alignItems: "center", justifyContent: "center", padding: 22 } },
        h("div", { onClick: e => e.stopPropagation(), style: { width: "100%", borderRadius: 18, border: "1px solid " + IF_LINE, background: "#15121e", padding: "18px 17px" } },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 17, color: IF_INK } }, "删掉这条如果？"),
          h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: IF_DIM, lineHeight: 1.8, marginTop: 5 } }, "整条连同里头说过的话一起没了，找不回来。已经记进记忆库或留成念头的那一份不受影响。"),
          h("div", { className: "flex gap-2", style: { marginTop: 14 } },
            h("button", { onClick: () => setDropId(null), className: "flex-1 active:opacity-70", style: { borderRadius: 12, padding: "10px 0", border: "1px solid " + IF_LINE, color: IF_INK, fontFamily: F_BODY, fontSize: 13.5 } }, "算了"),
            h("button", { onClick: () => { onDrop(dropId); setDropId(null); }, className: "flex-1 active:opacity-70", style: { borderRadius: 12, padding: "10px 0", background: "#8c4a58", color: "#fff", fontFamily: F_DISPLAY, fontSize: 14 } }, "删掉")))) : null);
  }
  // ── 一条线里头 ──
  const bt = beats[at.beat] || { boxes: [] };
  const box = (bt.boxes || [])[at.box] || null;
  const more = at.box < (bt.boxes || []).length - 1;
  const lastBeat = at.beat >= beats.length - 1;
  const myTurn = lastBeat && !more && bt.role === "char";
  const bg = line.bgKey || line.bgUrl;
  const tap = () => { if (more) setAt({ beat: at.beat, box: at.box + 1 }); else if (!lastBeat) setAt({ beat: at.beat + 1, box: 0 }); };
  const send = () => { const all = typing.trim() ? drafts.concat([typing.trim()]) : drafts; if (!all.length) return; setDrafts([]); setTyping(""); onAdvance(line.id, all); };
  return h("div", { className: "h-full flex flex-col", style: { position: "relative", background: "#0e0c16" } },
    bg ? h("div", { style: { position: "absolute", inset: 0, opacity: 0.4 } }, h(AlbumPhoto, { photo: { imgKey: line.bgKey, imgUrl: line.bgUrl }, cover: true })) : null,
    // 还没生成背景图时原来是一整片死黑。给一层很淡的光晕当底衬——不抢正文，
    // 但至少看着像个场景，不像没加载完。
    bg ? null : h("div", { style: { position: "absolute", inset: 0, background: "radial-gradient(130% 68% at 50% 4%,rgba(141,118,201,.3),rgba(90,70,140,.1) 46%,rgba(141,118,201,0) 74%)" } }),
    h("div", { style: { position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(14,12,22,.55),rgba(14,12,22,.92))" } }),
    h("div", { className: "shrink-0 flex items-center px-4 pb-2", style: { position: "relative", paddingTop: safeTop(10) } },
      h("button", { onClick: () => setOpenId(null), "aria-label": "返回", className: "active:opacity-50 flex items-center justify-center", style: { width: 40, height: 40, marginLeft: -8 } }, h(IArrow, { size: 19, color: IF_INK })),
      h("div", { className: "flex-1 min-w-0 text-center" },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15.5, color: IF_INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, line.title),
        h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: IF_DIM, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, line.premise),
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
          : h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 9, color: IF_DIM, marginTop: 3 } }, (at.beat + 1) + " / " + beats.length)),
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
      busy ? h("div", { style: { textAlign: "center", fontFamily: F_BODY, fontSize: 10, color: IF_DIM, marginTop: 10 } }, "……") : null),
    // 我的回合：先攒几条再一起发。
    // v59.14 重做（她 2026-08-31：「回复键的样式也改一下」）：
    //   ① 原来三个控件三种形状——输入框是圆角矩形、攒着是正圆、发出是胶囊，
    //      挤在一行像三件不相干的东西。现在统一成【同高同圆角】的一套。
    //   ② 还没轮到她的时候，那一整条输入区照样占着地方、placeholder 写「他还没说完」——
    //      占了半屏高度只为说一句话。改成收起来，只留一行提示。
    h("div", { className: "shrink-0 px-4", style: { position: "relative", paddingBottom: "calc(env(safe-area-inset-bottom) * 0.4 + 10px)" } },
      myTurn ? [
        drafts.length ? h("div", { key: "dr", style: { display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 } },
          drafts.map((d, i) => h("div", { key: i, className: "flex items-center gap-2", style: { borderRadius: 12, background: "rgba(141,118,201,.13)", border: "1px solid rgba(141,118,201,.26)", padding: "8px 12px" } },
            h("div", { className: "flex-1 min-w-0", style: { fontFamily: F_BODY, fontSize: 12.5, color: IF_INK, opacity: .82 } }, d),
            h("button", { onClick: () => setDrafts(drafts.filter((_, j) => j !== i)), className: "active:opacity-60 shrink-0", "aria-label": "撤掉这条", style: { fontFamily: F_BODY, fontSize: 11, color: IF_DIM } }, "撤")))) : null,
        h("div", { key: "row", className: "flex items-end gap-2" },
          h("textarea", {
            value: typing, onChange: e => setTyping(e.target.value), rows: 1,
            placeholder: drafts.length ? "还想说点什么" : "你说点什么，或先攒几条",
            className: "flex-1 outline-none resize-none",
            style: { minHeight: 42, maxHeight: 104, borderRadius: 12, border: "1px solid " + IF_LINE, background: "rgba(0,0,0,.34)", color: IF_INK, padding: "11px 13px", fontFamily: F_BODY, fontSize: 13.5, lineHeight: 1.55 }
          }),
          // 攒一条：跟发出同高同圆角，只是空心。满了就灰掉（原来是默默不响应）
          h("button", {
            onClick: () => { const v = typing.trim(); if (!v || drafts.length >= (window.IfKit || {}).MY_BOXES_MAX) return; setDrafts(drafts.concat([v])); setTyping(""); },
            disabled: !typing.trim() || drafts.length >= ((window.IfKit || {}).MY_BOXES_MAX || 8),
            className: "active:opacity-70 shrink-0 flex items-center justify-center", "aria-label": "再攒一条",
            style: { width: 42, height: 42, borderRadius: 12, border: "1px solid " + (typing.trim() ? "rgba(141,118,201,.5)" : IF_LINE), color: typing.trim() ? "#cdbdf0" : IF_DIM, fontFamily: F_DISPLAY, fontSize: 20, lineHeight: 1 }
          }, "+"),
          h("button", {
            onClick: send, disabled: !!busy || (!drafts.length && !typing.trim()),
            className: "active:opacity-70 shrink-0 flex items-center justify-center", "aria-label": "发出去",
            style: { width: 42, height: 42, borderRadius: 12, background: (busy || (!drafts.length && !typing.trim())) ? "rgba(255,255,255,.08)" : IF_ACCENT, color: (busy || (!drafts.length && !typing.trim())) ? IF_DIM : "#fff" }
          }, busy
            ? h("span", { style: { fontFamily: F_DISPLAY, fontSize: 14 } }, "…")
            // 送出：一个朝右的小三角，跟对话框右下角那个是同一个形状
            : h("div", { style: { width: 0, height: 0, borderTop: "7px solid transparent", borderBottom: "7px solid transparent", borderLeft: "10px solid currentColor", marginLeft: 3 } })))
      ] : h("div", { style: { textAlign: "center", fontFamily: F_BODY, fontSize: 11, color: IF_DIM, padding: "12px 0 6px" } },
        busy ? "他在写……" : line.endedAt ? "这条已经收了" : "点一下继续"),
      h("div", { className: "flex items-center justify-between", style: { marginTop: myTurn ? 9 : 2 } },
        h("button", { onClick: () => onBg(line.id), disabled: !!bgBusy, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 11, color: IF_DIM } },
          bgBusy ? "画着…" : bg ? "换张背景" : "生成背景图"),
        line.endedAt ? h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: IF_DIM } }, "这条已经收了")
          : h("button", { onClick: () => setEnding(true), className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 11, color: IF_DIM } }, "就到这儿"))),
    // 侧栏：翻已经过去的那些拍
    side ? h("div", { onClick: () => setSide(false), style: { position: "absolute", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 20 } },
      h("div", { onClick: e => e.stopPropagation(), className: "h-full flex flex-col", style: { position: "absolute", right: 0, top: 0, bottom: 0, width: "78%", background: "#15121e", borderLeft: "1px solid " + IF_LINE } },
        h("div", { className: "shrink-0 px-4", style: { paddingTop: safeTop(12), paddingBottom: 10, borderBottom: "1px solid " + IF_LINE } },
          h("div", { className: "flex items-center justify-between" },
            h("div", { className: "flex-1 min-w-0", style: { fontFamily: F_DISPLAY, fontSize: 16, color: IF_INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, line.title),
            h("button", { onClick: () => setSide(false), className: "active:opacity-60 shrink-0", style: { fontFamily: F_BODY, fontSize: 12, color: IF_DIM, marginLeft: 10 } }, "收起")),
          // 侧栏里也要看得见这条线是什么——她 2026-08-31：「一进去一脸懵」
          h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: IF_DIM, lineHeight: 1.7, marginTop: 4 } }, line.premise),
          line.about ? h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: "#a99ccb", lineHeight: 1.7, marginTop: 5 } }, "探的是：" + line.about) : null,
          line.dim && (window.IfKit || {}).dimZh ? h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: IF_DIM, marginTop: 4, opacity: .8 } },
            "这条动的是：" + window.IfKit.dimZh(line.dim)) : null,
          h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 9.5, color: IF_DIM, letterSpacing: ".1em", marginTop: 8 } }, "前面说过的")),
        h("div", { className: "flex-1 min-h-0 overflow-y-auto px-4 pb-8" },
          beats.map((b, i) => h("button", { key: b.id, onClick: () => { setAt({ beat: i, box: 0 }); setSide(false); }, className: "w-full text-left active:opacity-70", style: { display: "block", padding: "10px 0", borderBottom: "1px solid " + IF_LINE } },
            h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 9, color: IF_DIM } }, b.role === "user" ? "你" : (partner.remark || partner.name)),
            (b.boxes || []).map((x, j) => h("div", { key: j, style: { fontFamily: F_BODY, fontSize: 12.5, lineHeight: 1.8, color: i === at.beat ? IF_INK : IF_DIM, fontStyle: (!x.who && b.role !== "user") ? "italic" : "normal", marginTop: 2 } }, x.text))))))) : null,
    // 收线：三个去处
    ending ? h(IfEndPick, { onPick: k => { onEnd(line.id, k); setEnding(false); }, onClose: () => setEnding(false) }) : null);
}
