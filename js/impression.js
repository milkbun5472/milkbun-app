// ============================================================
// 月度印象（impression）—— 每个月，每个角色眼里的「你」长什么样
// 一张剪影 + 三个关键词 + 一句他亲口说的话。按角色收进珍藏册，漏掉的月份可以补。
// 素材=当月和这个角色之间真实发生的事；底子=「Ta 眼里」(x_gaze) 已经攒下的长期印象。
// 剪影不需要锁脸(看不见五官)，所以完全不碰参考照那套，也就不吃合照那些审核麻烦。
// ============================================================
(function () {
  const useState = React.useState, useEffect = React.useEffect;
  const K = "x_impressions";
  const load = () => { try { return JSON.parse(localStorage.getItem(K) || "{}"); } catch (e) { return {}; } };
  const save = d => { try { localStorage.setItem(K, JSON.stringify(d)); } catch (e) {} };
  const uid = () => "im_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  // 图标：一轮月亮 + 一道侧影
  window.GImpression = p => h(Svg, p,
    h("path", { d: "M12 3a9 9 0 100 18 9 9 0 000-18z" }),
    h("path", { d: "M15.5 20.4c-1.6-1-2.2-2.6-2.2-4.3 0-2.1 1.2-3 1.2-4.6 0-1.5-1.2-2.4-2.6-2.4-1.7 0-2.9 1.2-3.4 2.6" }));

  // ---- 月份工具 ----
  const monthKeyOf = ts => { const d = new Date(ts); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); };
  const monthLabel = k => { const [y, m] = String(k).split("-"); return y + " 年 " + Number(m) + " 月"; };
  const monthRange = k => {
    const [y, m] = String(k).split("-").map(Number);
    return { start: new Date(y, m - 1, 1).getTime(), end: new Date(y, m, 1).getTime() - 1 };
  };
  // 可写的月份 = 【已经过完的月】。本月还在发生，写不出"这个月你是什么样"——
  // 和周刊同一条规矩：报道窗口必须已经关闭（她 2026-08-20 指出）。
  // 所以 i 从 1 起：最近可写的是上个月，本月要等下月 1 号 0 点。
  const prevMonths = (n, now) => {
    const out = [], d = now ? new Date(now) : new Date();
    for (let i = 1; i <= n; i++) out.push(monthKeyOf(new Date(d.getFullYear(), d.getMonth() - i, 1).getTime()));
    return out;
  };
  const latestWritable = now => prevMonths(1, now)[0];
  const isWritable = (k, now) => String(k) <= String(latestWritable(now));
  // 下一次开写的时刻 = 下个月 1 号 0 点
  const nextOpenAt = now => { const d = now ? new Date(now) : new Date(); return new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime(); };

  // ---- 当月素材：单聊 + 单人线下 + 互通群里他说的话 ----
  function monthMaterial(charId, charName, monthKey, uName, groups) {
    const { start, end } = monthRange(monthKey);
    const inWin = ts => ts != null && ts >= start && ts <= end;
    const rows = [];
    // 用 loadJSON（自带 try/catch，还会先读 IDB 镜像）：以前是裸 JSON.parse，
    // 任何一条记录坏掉就整个函数抛，而补齐外面没有 catch——表现就是"点了没反应"。
    const grab = k => { try { return typeof loadJSON === "function" ? (loadJSON(k, []) || []) : (JSON.parse(localStorage.getItem(k) || "[]") || []); } catch (e) { return []; } };
    const clean = m => {
      if (!m || m.recalled || m.role === "system" || m.kind === "ooc" || m.kind === "silence") return "";
      return String(m.content || "").replace(/\s+/g, " ").trim();
    };
    (grab("x_chat:" + charId)).forEach(m => {
      if (!inWin(m.ts)) return;
      const t = clean(m); if (!t) return;
      rows.push({ ts: m.ts, who: m.role === "user" ? uName : charName, text: t });
    });
    (grab("x_offline:" + charId)).forEach(s => ((s && s.msgs) || []).forEach(m => {
      if (!inWin(m.ts)) return;
      const t = clean(m); if (!t) return;
      rows.push({ ts: m.ts, who: m.role === "user" ? uName : m.role === "narration" ? "【场景】" : charName, text: t });
    }));
    // 群聊也要算（v54.07）：她和顾朝顾暮大半的话是在群里说的，只数单聊会得出"七月没来往"
    // 这个荒唐结论。封闭群（没开记忆互通）不算——记忆不进也不出，和周刊同一条规矩。
    const gset = grab("x_groupSettings") || {};
    (groups || []).forEach(g => {
      if (!g || !(g.memberIds || []).includes(charId)) return;
      if (!(gset[g.id] && gset[g.id].memoryInterop)) return;
      (grab("x_gchat:" + g.id)).forEach(m => {
        if (!inWin(m.ts)) return;
        const txt = clean(m); if (!txt) return;
        // 群里只取【他和她】两个人的话：别的成员说什么不构成"他眼里的她"
        const isUser = m.role === "user";
        const isHim = m.senderId === charId;
        if (!isUser && !isHim) return;
        rows.push({ ts: m.ts, who: isUser ? uName : charName, text: "【群】" + txt });
      });
    });
    rows.sort((a, b) => a.ts - b.ts);
    return rows;
  }
  // 分来源数一遍：界面上直接显示，省得"明明聊了很多却说没有"只能靠猜（她 2026-08-20 两次撞到）
  function materialBreakdown(charId, charName, monthKey, uName, groups) {
    const rows = monthMaterial(charId, charName, monthKey, uName, groups);
    const g = rows.filter(r => String(r.text).indexOf("【群】") === 0).length;
    let all = 0;
    try { all = (typeof loadJSON === "function" ? (loadJSON("x_chat:" + charId, []) || []) : []).length; } catch (e) {}
    return { total: rows.length, group: g, direct: rows.length - g, chatAll: all };
  }
  // 他自己说过的话：拿来当声纹样本，quote 才不会写成通用文艺腔
  const ownLines = (rows, charName) => rows.filter(r => r.who === charName && r.text.length >= 6 && r.text.length <= 60)
    .map(r => r.text).slice(-12);
  const toText = (rows, budget) => {
    let s = rows.map(r => r.who + "：" + r.text).join("\n");
    return s.length > budget ? "……（略去较早部分）\n" + s.slice(s.length - budget) : s;
  };

  // ---- 生成 ----
  // ⚠️三个关键词以前定死了槽位（气质/状态/他的私心），结果第三格必然长成「拿她没办法」
  //   「无法计算」——雷同是这条规则自己造出来的。改成给一批取词角度，按期轮换取三个。
  const TAG_ANGLES = [
    "她做事的方式（不是评价，是动作层面的习惯）", "她说话的调子", "她身上你最先注意到的那一处",
    "她让你意外的地方", "她其实很笨拙的地方", "她固执的地方", "她的软处",
    "你嘴上不承认的那点心思", "她这个月变了的地方", "她一直没变的地方",
    "旁人不会注意、只有你看得见的细节", "你拿她当什么（一个名词，不许是比喻）"
  ];
  // 句式骰子：光说"别写套路"没用——两个角色照样收敛到同一个架构。
  // 得直接指定这一张【用哪种写法】，把结构本身也掷一次（小剧场那套骰子的同一个道理）。
  const QUOTE_FORMS = [
    "只写她做过的一个具体动作，写完就停，不解释、不评价、不升华。",
    "直接引用她这个月说过的一句原话，然后接一句你当时【没说出口】的反应。",
    "写成一句抱怨——抱怨的内容是真的，但读得出你其实并不想她改。",
    "只写你自己身上发生的变化，从头到尾不描述她。",
    "一个比喻。但本体必须是这个月真的出现过的东西，不许用月亮、星星、海、光这类现成意象。",
    "一句问句，问的是你自己也答不上来的事。",
    "陈述一件事实，句号结束。不许有转折，不许有「却」「反而」「结果」。",
    "写你第一次注意到某件事的那一刻，具体到时间或场合。",
    "把她和一件很小的日常物件放在一起写，物件必须在记录里出现过。",
    "写你为她做过、但没告诉她的一件事。",
    "写一句你以为自己会习惯、结果没习惯的事。",
    "两句：第一句写她，第二句把话锋转回你自己，但不许用「而我」开头。"
  ];
  // 已经被写烂的那个骨架——不点名它，模型每次都会滑回去（民国那次学到的：得指着说）
  const BANNED_SHAPE = "\n\n【这个骨架已经用烂了，禁止再用】\n"
    + "「我［推演／分析／计算／设想］了很多种…… → 结果她一句话／一个动作 → 我的［逻辑／防线／线路／计划］全部［破产／失效／崩塌／被切断］」\n"
    + "同义改写也算：换成「所有理性」「全部预设」「精密的推演」照样是它。看到自己在写这个句子，推翻重来。\n"
    + "title 同理：「不讲理的X」「不按套路的X」这类【形容词+抽象名词】的取名法已经用过，换一种。";
  // 「不够个人化」的病根：不逼它扣住具体的事，它就会写放之四海皆准的漂亮话。
  // 治法和日记那次一样——给一条【可判定】的检验标准，而不是再加一句"要具体"。
  const CONCRETE_RULE = "\n\n【最高优先 · 必须扣住真的发生过的事】\n"
    + "title、tags、quote、silhouette 四样【都】要长在下面那段真实记录上，不许凭空抒情。\n"
    + "· quote 里必须有一处【只有你们俩对得上号的具体东西】：她说过的某一句原话、某件真的发生过的小事、"
    + "某个反复出现的细节。可以不点破前因后果，但那个东西必须真的在记录里出现过。\n"
    + "· 【自检】写完把她的名字换成任何一个别人——如果这句话照样成立，说明写空了，推翻重写。\n"
    + "· 不许用「温柔又坚强」「像月亮一样」这类谁都能套的词；宁可写得小、写得怪，也别写得大而空。";
  // 她自己说过的话：给模型一把具体的钩子，quote 才有东西可以扣
  const herLines = (rows, uName) => rows.filter(r => r.who === uName && r.text.length >= 4 && r.text.length <= 50)
    .map(r => r.text).slice(-14);

  const hashOf = str => { let x = 0; String(str || "x").split("").forEach(ch => { x = (x * 31 + ch.charCodeAt(0)) >>> 0; }); return x; };
  // 起点按角色+月份定（同一张卡不会自己重掷），再按 turn【确定性轮转】——
  // 靠哈希碰运气会撞面：turn 0 和 1 抽到同一个写法，重写就等于原地打转（实测撞过）。
  // 轮转保证每重写一次必然换一面，转满一圈才回到起点。
  function pickN(pool, n, seedStr, turn) {
    const base = hashOf(seedStr) % pool.length, step = Number(turn || 0);
    const out = [];
    for (let i = 0; i < n && i < pool.length; i++) out.push(pool[(base + step * n + i) % pool.length]);
    return out;
  }
  async function genText(active, char, profile, monthKey, rows, gazeText, opts) {
    const turn = Number((opts && opts.turn) || 0);
    const seed = String(char.id || char.name) + "|" + monthKey + "|" + turn;
    const form = pickN(QUOTE_FORMS, 1, String(char.id || char.name) + "|" + monthKey + "|form", turn)[0];
    const angles = pickN(TAG_ANGLES, 3, String(char.id || char.name) + "|" + monthKey + "|tag", turn);
    const past = ((opts && opts.past) || []).map(x => String(x || "").trim()).filter(Boolean).slice(0, 6);
    const uName = (profile && profile.name) || "她";
    const lines = ownLines(rows, char.name);
    const sys = (typeof ANTI_CLICHE !== "undefined" ? ANTI_CLICHE + "\n\n" : "")
      + (typeof CHARCARD_RULE !== "undefined" ? CHARCARD_RULE + "\n\n" : "")
      + "你就是「" + char.name + "」本人。现在回望这一个月，写下【" + uName + " 在你眼里是什么样子】。\n"
      + "【你的人设】\n" + String(char.persona || char.name).slice(0, 1600)
      + (gazeText ? "\n\n【你心里对 " + uName + " 已有的长期印象（底子，别推翻，只在它上面往前长一点）】\n" + gazeText : "")
      + (lines.length ? "\n\n【你这个月真的说过的话 · 声纹最高优先】\n" + lines.map((x, i) => (i + 1) + ". " + x).join("\n")
        + "\n这些是你的原话，用来校准词汇、句长、口癖、攻击性与礼貌度。下面写的东西必须是同一个人说的，遮住名字也该认得出。" : "")
      + (herLines(rows, uName).length ? "\n\n【" + uName + " 这个月说过的话 · quote 可以直接扣住其中一句】\n"
        + herLines(rows, uName).map((x, i) => (i + 1) + ". " + x).join("\n") : "")
      + CONCRETE_RULE + BANNED_SHAPE
      + (past.length ? "\n\n【你以往几个月写过的话 · 骨架不许重复】\n" + past.map((x, i) => (i + 1) + ". " + x).join("\n")
        + "\n换个说法、换个词、换个角色都不算换骨架——句子的【搭法】必须和上面每一句都不一样。" : "")
      + "\n\n【这个月你和 " + uName + " 之间真实发生的事】\n" + (toText(rows, 5200) || "（这个月几乎没有来往。）")
      + "\n\n【要写四样东西】\n"
      + "① title：给这个月的她起一个短称呼（≤8 字），像一句私下的叫法，不是称号也不是标签。\n"
      + "② tags：三个关键词，每个 2~5 个字。这一期【必须】分别从这三个角度取：\n"
      + angles.map((a, i) => "   " + (i + 1) + "）" + a).join("\n")
      + "\n   三个之间不许同义，也不许都在夸她。\n"
      + "③ quote：**你亲口说的**、关于她的话。必须是你会说的话，别写成通用抒情散文，也别写成人物介绍。"
      + "用「她」称呼她，不要直呼名字。≤60 字。\n"
      + "   【这一张的写法·必须照办】" + form + "\n"
      + "   写法是硬性的：哪怕你觉得别的写法更漂亮，也按这一条来。\n"
      + "④ silhouette：一句【画面描述】，用来画她的剪影。只写：轮廓姿态（侧脸/回头/低头/站着/坐着…）、"
      + "身边有什么意象（月亮、雨、书页、猫、灯、雾…）、以及整体色调冷暖。**不许写五官、不许写表情**——剪影是看不见脸的。"
      + "意象【必须从这个月真实发生过的事里长出来】（她提过的东西、你们真的去过的地方、反复出现的物件），别凭空堆砌月亮和雨；"
      + "整体气质要和你写的那三个关键词对得上——关键词是冷的，画面就不该是暖的。\n"
      + "\n【输出】只输出 JSON，不要代码块：\n"
      + '{"title":"","tags":["","",""],"quote":"","silhouette":""}';
    const raw = await callAI(active, sys, [{ role: "user", content: "开始写这个月的印象。" }], { maxTokens: 2000, timeout: 120000 });
    const d = (typeof parseJSONLoose === "function" ? parseJSONLoose(raw) : extractJSON(raw)) || {};
    const tags = (Array.isArray(d.tags) ? d.tags : []).map(x => String(x || "").trim()).filter(Boolean).slice(0, 3);
    const quote = String(d.quote || "").trim();
    if (!quote || !tags.length) throw new Error("这个月的印象没写全，再试一次");
    return { title: String(d.title || "").trim(), tags, quote, silhouette: String(d.silhouette || "").trim() };
  }

  // 剪影图：艺术插画，不是照片。刻意不给参考照——看不见脸，给了只会让它去画五官。
  // 剪影不能只照着一句场景描述画——那样画出来跟这个月的印象没关系。
  // 把这一期的三个关键词和短称呼一起喂进去：它们才是这张图真正要画的东西（她 2026-08-20 提）。
  async function genArt(desc, profile, mood) {
    const look = String((profile && profile.appearance) || "").slice(0, 120);
    const tags = (mood && Array.isArray(mood.tags) ? mood.tags : []).filter(Boolean);
    const prompt = "一幅【剪影艺术插画】：画面主体是一个人的纯黑剪影，**完全看不见五官、没有脸部细节**，"
      + "只有轮廓与发丝的形状。水墨与水彩晕染的质感，大量留白，像杂志内页的一幅意象插画。\n"
      + (tags.length ? "【这幅画要画出的气质·最重要】" + tags.join("、")
        + (mood && mood.title ? "（一句话概括：" + mood.title + "）" : "")
        + "。姿态、光线、冷暖、留白多少，全部服务于这几个词——画面读起来必须就是这种感觉。\n" : "")
      + "【画面】" + (desc || "一个人的侧影，身后是一轮月亮，冷色调。") + "\n"
      + (look ? "【轮廓参考·只取发型长度与身形，不画五官】" + look + "\n" : "")
      + "【硬性要求】不出现文字、不出现边框、不画成头像或证件照；构图竖幅；整体安静、克制、有留白；"
      + "画面必须是可公开展示的：衣着完整，不露骨。";
    const out = await generateSelfieImage(prompt, null);
    if (!out || !out.blob) throw new Error("剪影没出来");
    const durl = await blobToDataUrl(out.blob);
    return typeof imgToVault === "function" ? await imgToVault(durl) : durl;
  }

  window.Impression = { load, save, materialBreakdown, monthKeyOf, monthLabel, monthRange, prevMonths, latestWritable, isWritable, nextOpenAt, monthMaterial, genText, genArt, uid };
})();

// ============================================================
// 界面：头像墙 → 某个角色的珍藏册 → 单张卡片
// ============================================================
(function () {
  const useState = React.useState;
  const M = window.Impression;

  function ImpressionApp(props) {
    const t = useTheme();
    const uName = (props.profile && props.profile.name) || "我";
    const [book, setBook] = useState(() => M.load());
    const [curChar, setCurChar] = useState(null);
    const [cardId, setCardId] = useState(null);
    const [busy, setBusy] = useState("");
    const put = fn => setBook(p => { const n = fn(p); M.save(n); return n; });
    // ⚠️imgSrc 不是全局的：它是 theater.js 自己内部声明的（js/theater.js 里那份）。
    // 照抄用法却没带上定义，一进这个页面就 ReferenceError、整个 App 白屏（她 2026-08-20 撞到）。
    const imgSrc = ref => (typeof resolveImg === "function" ? resolveImg(ref) : ref);
    // 头像与存相册照小剧场那套自己实现——components 里那两个不是全局的，拿不到
    const avatarOf = (c, size) => (c && c.avatarImage)
      ? h("img", { src: imgSrc(c.avatarImage), style: { width: size, height: size, borderRadius: 999, objectFit: "cover", display: "block" } })
      : h("div", { style: { width: size, height: size, borderRadius: 999, background: (c && c.color) || "#c2bdb1", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F_DISPLAY, fontSize: Math.round(size / 2.4), color: "#fff" } }, String((c && c.name) || "?").slice(0, 1));
    const saveToAlbum = async ref => {
      try {
        let blob = null;
        if (String(ref).indexOf("iv_") === 0 && typeof imgVaultFetchBlob === "function") blob = await imgVaultFetchBlob(ref);
        if (!blob) blob = await (await fetch(imgSrc(ref))).blob();
        const file = new File([blob], "impression_" + Date.now() + ".png", { type: blob.type || "image/png" });
        if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file] });
        else { window.open(URL.createObjectURL(blob), "_blank"); props.toast("在新页长按图片存储"); }
      } catch (e) { if (!/Abort/i.test(String(e && e.name || e))) props.toast("保存失败"); }
    };
    const listOf = id => (book[id] || []).slice().sort((a, b) => String(b.monthKey).localeCompare(String(a.monthKey)));

    const S = {
      wrap: { position: "relative", height: "100%", display: "flex", flexDirection: "column", background: t.bg },
      btn: on => ({ padding: "6px 12px", borderRadius: 999, border: "1px solid " + (on ? t.accent : t.line), background: on ? t.accent : "transparent", color: on ? "#fff" : t.ink, fontFamily: F_BODY, fontSize: 12 })
    };
    const header = (title, right) => h("div", { style: { display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: "1px solid " + t.line } },
      h("button", { onClick: back, style: { background: "none", border: "none", color: t.ink, fontSize: 19, padding: "2px 6px" } }, "←"),
      h("div", { style: { flex: 1, fontFamily: F_DISPLAY, fontSize: 17, color: t.ink } }, title), right || null);
    function back() {
      if (cardId) return setCardId(null);
      if (curChar) return setCurChar(null);
      props.onBack();
    }

    // ---- 生成一个月 ----
    async function make(charId, monthKey, opts) {
      const char = (props.characters || []).find(c => c.id === charId);
      if (!char) return;
      if (!props.active) return props.toast("请先配置线下 API");
      if (!M.isWritable(monthKey)) { props.toast(M.monthLabel(monthKey) + " 还没过完，等下个月 1 号 0 点再写"); return false; }
      const rows = M.monthMaterial(charId, char.name, monthKey, uName, props.groups);
      if (rows.length < 6) {
        // 报出实际条数：以前只说"几乎没有来往"，她明明聊了很多也不知道是哪一步没数到
        if (!(opts && opts.quiet)) props.toast(M.monthLabel(monthKey) + " 只找到 " + rows.length + " 条你俩的往来（单聊+单人线下+互通群），写不出印象");
        return false;
      }
      setBusy(charId + monthKey);
      try {
        const gazeText = window.Gaze && window.Gaze.text ? String(window.Gaze.text(charId, uName) || "").slice(0, 900) : "";
        const past = (book[charId] || []).filter(x => x.monthKey !== monthKey).map(x => x.quote);
        const d = await M.genText(props.active, char, props.profile, monthKey, rows, gazeText, { turn: 0, past });
        let img = null;
        // 图出不来不算失败：字才是主体，剪影可以之后单独补
        try { if (typeof imgApiReady === "function" && imgApiReady()) img = await M.genArt(d.silhouette, props.profile, { tags: d.tags, title: d.title }); }
        catch (e) { props.toast("字写好了，剪影没出来：" + (e.message || "稍后可单独重出")); }
        const entry = { id: M.uid(), monthKey, title: d.title, tags: d.tags, quote: d.quote, silhouette: d.silhouette, img, turn: 0, ts: Date.now() };
        put(p => Object.assign({}, p, { [charId]: [entry].concat((p[charId] || []).filter(x => x.monthKey !== monthKey)) }));
        return true;
      } catch (e) { props.toast("生成失败：" + (e.message || "重试")); return false; }
      finally { setBusy(""); }
    }
    // 只重出剪影，字不动
    async function redrawArt(charId, entry) {
      if (!(typeof imgApiReady === "function" && imgApiReady())) return props.toast("请先配置图像 API");
      setBusy(charId + entry.monthKey);
      try {
        const img = await M.genArt(entry.silhouette, props.profile, { tags: entry.tags, title: entry.title });
        put(p => Object.assign({}, p, { [charId]: (p[charId] || []).map(x => x.id === entry.id ? Object.assign({}, x, { img }) : x) }));
      } catch (e) { props.toast("剪影没出来：" + (e.message || "重试")); } finally { setBusy(""); }
    }
    // 只重写文案，剪影原样留着——出图慢又贵，不该为了换一句话把画也重刷一遍（她 2026-08-20 提）
    async function rewriteText(charId, entry) {
      const char = (props.characters || []).find(c => c.id === charId); if (!char) return;
      if (!props.active) return props.toast("请先配置线下 API");
      setBusy(charId + entry.monthKey);
      try {
        const rows = M.monthMaterial(charId, char.name, entry.monthKey, uName, props.groups);
        const gazeText = window.Gaze && window.Gaze.text ? String(window.Gaze.text(charId, uName) || "").slice(0, 900) : "";
        // turn+1 = 换一面骰子：不换的话「只重写文案」会拿到同一个写法，等于原地打转
        const turn = Number(entry.turn || 0) + 1;
        // 自己上一版也算"往期"——重写就是为了不要它，别把它再写一遍
        const past = (book[charId] || []).filter(x => x.monthKey !== entry.monthKey).map(x => x.quote).concat([entry.quote]);
        const d = await M.genText(props.active, char, props.profile, entry.monthKey, rows, gazeText, { turn, past });
        put(p => Object.assign({}, p, { [charId]: (p[charId] || []).map(x => x.id === entry.id
          ? Object.assign({}, x, { title: d.title, tags: d.tags, quote: d.quote, silhouette: d.silhouette, turn }) : x) }));
        props.toast("换了个写法，剪影没动");
      } catch (e) { props.toast("重写失败：" + (e.message || "重试")); } finally { setBusy(""); }
    }
    // 补齐：最近 12 个月里有素材、却还没写过的，一月一月补（失败即停，已写好的都留着）
    async function backfill(charId) {
      const char = (props.characters || []).find(c => c.id === charId); if (!char) return;
      if (busy) return props.toast("正在写，别急");
      if (!props.active) return props.toast("请先配置线下 API");
      let want = [];
      // 整段包起来：以前任何一步抛出去，外面没人接，表现就是"点了没反应"
      try {
        const have = new Set((book[charId] || []).map(x => x.monthKey));
        const all = M.prevMonths(12);                       // 已经过完的 12 个月
        const missing = all.filter(k => !have.has(k));
        want = missing.filter(k => M.monthMaterial(charId, char.name, k, uName, props.groups).length >= 6);
        if (!want.length) {
          // 分清三种"没得补"，别一律一句话打发
          return props.toast(!missing.length ? "最近一年每个月都写过了"
            : "漏掉的那 " + missing.length + " 个月几乎没有来往，写不出印象");
        }
      } catch (e) { return props.toast("翻旧账的时候出错了：" + (e.message || "未知")); }
      if (!confirm("补齐 " + want.length + " 个月？会一个月一个月写，中途失败前面的都保留。")) return;
      want.reverse();
      let done = 0;
      for (const k of want) {
        const ok = await make(charId, k, { quiet: true });
        if (!ok) { props.toast("补到 " + M.monthLabel(k) + " 时停下了，已写好 " + done + " 个"); return; }
        done++; props.toast("已补 " + done + "/" + want.length, 1200);
      }
      props.toast("补齐了 " + done + " 个月");
    }

    // ---- 单张卡片 ----
    if (cardId && curChar) {
      const e = listOf(curChar).find(x => x.id === cardId);
      const c = (props.characters || []).find(x => x.id === curChar) || {};
      if (!e) { setCardId(null); return null; }
      return h("div", { style: S.wrap }, header(M.monthLabel(e.monthKey)),
        h("div", { style: { flex: 1, overflowY: "auto", padding: "18px 18px 40px" } },
          h("div", { style: { borderRadius: 16, overflow: "hidden", background: t.bg2, border: "1px solid " + t.line, boxShadow: "0 12px 34px rgba(0,0,0,.10)" } },
            h("div", { style: { position: "relative", width: "100%", aspectRatio: "3 / 4", background: t.bg } },
              e.img ? h("img", { src: imgSrc(e.img), style: { width: "100%", height: "100%", objectFit: "cover", display: "block" } })
                : h("div", { style: { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F_BODY, fontSize: 12, color: t.fog, textAlign: "center", padding: 20 } }, "还没有剪影"),
              // 三个关键词浮在图上，像原图那样错落挂着
              h("div", { style: { position: "absolute", inset: 0, pointerEvents: "none" } },
                (e.tags || []).slice(0, 3).map((tag, i) => h("div", {
                  key: i,
                  style: { position: "absolute", top: [18, 46, 74][i] + "%", [i === 1 ? "left" : "right"]: "6%",
                    background: "rgba(28,25,22,.72)", color: "#f3ece0", padding: "5px 12px", borderRadius: 999,
                    fontFamily: F_BODY, fontSize: 12.5, letterSpacing: ".04em", backdropFilter: "blur(2px)" } }, tag)))),
            h("div", { style: { padding: "18px 18px 22px" } },
              e.title ? h("div", { style: { fontFamily: F_DISPLAY, fontSize: 19, color: t.ink, textAlign: "center", marginBottom: 12 } }, "{ " + e.title + " }") : null,
              h("div", { style: { fontFamily: "'Noto Serif SC',serif", fontSize: 15, lineHeight: 2, color: t.ink, textAlign: "center" } }, "“" + e.quote + "”"),
              h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, textAlign: "right", marginTop: 14 } }, "—— " + (c.name || "TA") + " 眼里的 " + uName))),
          h("div", { style: { display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap", justifyContent: "center" } },
            e.img ? h("button", { onClick: () => saveToAlbum(e.img), style: S.btn(false) }, "保存到相册") : null,
            h("button", { onClick: () => rewriteText(curChar, e), disabled: !!busy, style: S.btn(false) }, busy ? "在写…" : "只重写文案"),
            h("button", { onClick: () => redrawArt(curChar, e), disabled: !!busy, style: S.btn(false) }, busy ? "在画…" : (e.img ? "只重出剪影" : "补一张剪影")),
            h("button", { onClick: () => { if (!confirm("删掉这个月的印象？")) return; put(p => Object.assign({}, p, { [curChar]: (p[curChar] || []).filter(x => x.id !== e.id) })); setCardId(null); }, style: Object.assign({}, S.btn(false), { color: "#a4442e" }) }, "删除"))));
    }

    // ---- 某个角色的珍藏册 ----
    if (curChar) {
      const c = (props.characters || []).find(x => x.id === curChar) || {};
      const mine = listOf(curChar);
      // 能写的是【上个月】：本月还在过，写不出"这个月你是什么样"
      const openMonth = M.latestWritable();
      const hasThis = mine.some(x => x.monthKey === openMonth);
      const openAt = new Date(M.nextOpenAt());
      return h("div", { style: S.wrap },
        header((c.name || "?") + " 眼里的 " + uName,
          h("button", { onClick: () => backfill(curChar), disabled: !!busy, style: S.btn(false) }, "补齐")),
        h("div", { style: { flex: 1, overflowY: "auto", padding: "14px 14px 34px" } },
          // 已经写过就不给整张重来的入口：那会连剪影一起重刷一遍，白花一次出图。
          // 想换东西请进卡片，那里能分开「只重写文案」和「只重出剪影」。
          h("button", { onClick: () => hasThis ? props.toast("点进那张卡片，可以只重写文案或只重出剪影") : make(curChar, openMonth), disabled: !!busy,
            style: { width: "100%", padding: "12px 0", borderRadius: 14, border: "1px dashed " + t.line, background: "transparent", color: hasThis ? t.fog : t.ink, fontFamily: F_BODY, fontSize: 13, marginBottom: 4 } },
            busy ? "在写…" : (hasThis ? M.monthLabel(openMonth) + " 已写过 · 点卡片可单独重写" : "写 " + M.monthLabel(openMonth) + "的印象")),
          h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, textAlign: "center", marginBottom: 14, lineHeight: 1.7 } },
            "本月还在过，写不出这个月你是什么样。" + (openAt.getMonth() + 1) + " 月 1 日 0 点开写。",
            // 素材数就摆在这儿：写不出来的时候一眼看得出是没素材、还是根本没读到
            (function () {
              let b = null;
              try { b = M.materialBreakdown(curChar, c.name, openMonth, uName, props.groups); } catch (e) { return null; }
              return h("div", { style: { marginTop: 4 } },
                M.monthLabel(openMonth) + "素材：单聊+线下 " + b.direct + " 条 · 群 " + b.group + " 条"
                + (b.total < 6 && b.chatAll ? "（这个角色的聊天记录一共 " + b.chatAll + " 条，只是都不在这个月）" : ""));
            })()),
          mine.length ? h("div", { style: { display: "flex", flexWrap: "wrap", gap: 10 } },
            mine.map(e => h("div", { key: e.id, onClick: () => setCardId(e.id), style: { width: "calc((100% - 10px) / 2)" } },
              h("div", { style: { width: "100%", aspectRatio: "3 / 4", borderRadius: 12, overflow: "hidden", background: t.bg2, border: "1px solid " + t.line, position: "relative" } },
                e.img ? h("img", { src: imgSrc(e.img), style: { width: "100%", height: "100%", objectFit: "cover", display: "block" } }) : null,
                h("div", { style: { position: "absolute", left: 0, right: 0, bottom: 0, padding: "18px 10px 8px", background: "linear-gradient(transparent, rgba(20,18,16,.78))", color: "#f3ece0", fontFamily: F_BODY, fontSize: 11 } },
                  (e.tags || []).slice(0, 2).join(" · "))),
              h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.sub, marginTop: 5 } }, M.monthLabel(e.monthKey)),
              e.title ? h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, e.title) : null)))
            : h("div", { style: { textAlign: "center", marginTop: 60, fontFamily: F_BODY, fontSize: 13, color: t.fog, lineHeight: 2 } }, "还没有印象。", h("br"), "写一个月看看，或者点右上角补齐。")));
    }

    // ---- 头像墙 ----
    return h("div", { style: S.wrap }, header("月度印象"),
      h("div", { style: { flex: 1, overflowY: "auto", padding: "14px 14px 34px" } },
        h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, lineHeight: 1.8, marginBottom: 14 } },
          "每个月，每个人眼里的你长得都不一样。一张剪影、三个词、一句他亲口说的话。"),
        (props.characters || []).length ? h("div", { style: { display: "flex", flexWrap: "wrap", gap: 10 } },
          (props.characters || []).map(c => {
            const n = (book[c.id] || []).length;
            const cover = listOf(c.id).find(x => x.img);
            return h("div", { key: c.id, onClick: () => setCurChar(c.id), style: { width: "calc((100% - 20px) / 3)", textAlign: "center" } },
              h("div", { style: { position: "relative", width: "100%", aspectRatio: "1 / 1", borderRadius: 12, overflow: "hidden", background: t.bg2, border: "1px solid " + t.line } },
                cover ? h("img", { src: imgSrc(cover.img), style: { width: "100%", height: "100%", objectFit: "cover", display: "block", opacity: .5 } }) : null,
                h("div", { style: { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" } },
                  avatarOf(c, 48))),
              h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.ink, marginTop: 5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, c.name),
              h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: t.fog } }, n ? n + " 个月" : "还没有"));
          }))
          : h("div", { style: { textAlign: "center", marginTop: 70, fontFamily: F_BODY, fontSize: 13, color: t.fog } }, "还没有角色。")));
  }
  window.ImpressionApp = ImpressionApp;
})();
