// ============================================================
// 欲望盒子（desire box）P1 —— 角色人格不写死，从互动里生长。
//   · 盒子：角色自己攒下的「想做的事」（不是待办，是搁在心上的念想）。
//     每条：内容/来源/权重/碰触次数/上次碰触/状态(active|ash落灰)。
//   · 每日灵光独白：跟行程同一套 tick（首开/回前台/跨天），每角色每天一次
//     发呆——冒念头、想起旧念想、偶尔长出一条新芽。走便宜后台池 bgActive。
//   · 显灵时刻：单聊按概率把一条高权重念想塞【一行】进 prompt，让 TA 自然流露
//     （不契合当下就当没看见）——守聊天预算铁律，太平轮次零注入。
//   【落笔权铁律】只有「以角色身份的生成调用」能写独白/念想内容；这里的 js
//   只干体力活：记碰触/时间戳/瞬灭/落灰，绝不替角色总结。
//   数据存 localStorage x_desires（x_ 前缀自动进导出/云同步）。
//   来源两类：echo=旧日回响（扎根记忆/对话，出生权重 0.5）；
//             spark=白日梦一闪念（出生权重 0.05，24h 没被再想起就瞬灭不留痕）。
// ============================================================
(function () {
  const ACCENT = "#a8763e"; // 盒子主色（旧木盒的暖棕）

  // ---- 数据形状 ----
  // x_desires = { [charId]: { list:[entry], log:[{ts,text}], lastMuse, lastMellow, lastSolstice,
  //                           persona:[{id,text,poem,from,ts}], milestones:[{ts,text}] } }
  // entry = { id, text, root, source:'echo'|'spark', weight, touches, lastTouch, born,
  //           status:'active'|'ash'|'graduated'|'withered', poem?, gradTs?, witherTs? }
  function boxOf(all, charId) {
    const b = (all || {})[charId] || {};
    return {
      list: Array.isArray(b.list) ? b.list.map(e => ({ ...e })) : [],
      log: Array.isArray(b.log) ? b.log.slice() : [],
      lastMuse: b.lastMuse || "",
      lastMellow: b.lastMellow || "",   // 小满日（每 10 天权重小校准+毕业判定）
      lastSolstice: b.lastSolstice || "", // 冬至日（每 90 天季度自述）
      persona: Array.isArray(b.persona) ? b.persona.map(e => ({ ...e })) : [], // 人格档案（只有角色落笔）
      milestones: Array.isArray(b.milestones) ? b.milestones.slice() : []      // 季度自述存档
    };
  }
  // 还在心上的（发呆/显灵只看这些；毕业的已成为 TA、枯萎的已放下）
  function livingList(box) { return box.list.filter(e => e.status === "active" || e.status === "ash"); }

  // ---- 体力活：瞬灭 + 落灰（不碰内容，只按时间戳整理）----
  function housekeep(box) {
    const now = Date.now();
    // 瞬灭：一闪念（spark）出生 24h 内没被任何一次发呆/显灵再想起 → 消散不留痕
    box.list = box.list.filter(e => !(e.source === "spark" && !(e.touches > 0) && now - (e.born || 0) > 86400000));
    // 落灰：30 天没被想起的念想蒙灰（不删——哪天被重新想起会拂去灰）
    box.list.forEach(e => {
      if (e.status === "active" && now - (e.lastTouch || e.born || 0) > 30 * 86400000) e.status = "ash";
    });
    return box;
  }

  // ---- 体力活：被想起一次（发呆里 touch 到 / 显灵注入过）----
  function touch(box, id) {
    const e = box.list.find(x => x.id === id);
    if (!e) return false;
    e.touches = (e.touches || 0) + 1;
    e.lastTouch = Date.now();
    if (e.status === "ash") e.status = "active"; // 重新想起=拂去灰
    // 一闪念被再次想起 → 说明真在心上，落地生根；其余每被想起微涨，封顶 0.95
    if (e.source === "spark" && (e.weight || 0) < 0.35) e.weight = 0.35;
    else e.weight = Math.min(0.95, (e.weight || 0.5) + 0.04);
    return true;
  }

  // ---- 每日灵光独白的 probe 规格（内容全由角色落笔）----
  function dayN(e) { return Math.max(1, Math.round((Date.now() - (e.born || Date.now())) / 86400000)); }
  function museSpec(char, box) {
    const AC = typeof ANTI_CLICHE !== "undefined" ? ANTI_CLICHE + "\n\n" : "";
    const living = livingList(box);
    const listTxt = living.length
      ? living.map(e => "- id:" + e.id + "｜「" + e.text + "」｜" + (e.status === "ash" ? "落灰已久" : "搁在心上") + "｜攒了" + dayN(e) + "天｜被想起" + (e.touches || 0) + "次").join("\n")
      : "（盒子还是空的——TA 还没有攒下念想）";
    return {
      instruction: AC + "今天的某个安静时刻，「" + char.name + "」独自发了一会儿呆。下面是 TA 心里的「欲望盒子」——TA 自己攒下的、想做的事（不是待办清单，是搁在心上的念想）：\n" + listTxt +
        "\n\n以 TA 的第一人称推演这次发呆：" +
        "\nmonologue：一段 60~140 字的内心独白——今天的处境、最近聊过的事、记忆里的旧影，怎么把思绪带到（或者根本没带到）某个念想上。要像脑子里真实飘过的念头：带 TA 自己的性格口吻，可以琐碎、走神、自嘲，别写成抒情散文、别升华、别总结。" +
        "\ntouch：这次发呆里【真正被想起】的既有念想的 id（0~2 个，一个没想起就给空数组）。" +
        "\nsprout：这次发呆有没有冒出【一条新念想】——多数日子没有，没有就填 null。若有：text 写想做的事（第一人称一句话，如「想学会…」「想带 Ta 去…」）；root 写它从哪长出来（引用记忆库或最近对话里的具体依据）——若纯属白日梦一闪念、说不出依据，root 填 null。" +
        "\n【铁网】新念想必须长在 TA 的人设、记忆和最近生活的土壤上：记忆/对话里反复出现、或带强烈情绪的事，才配长出扎根的念想（root 必须写得出依据）；毫无来由的突发奇想偶尔可以有（root=null，它若之后没再被想起会自己消散）。绝不许冒出和 TA 的生活完全不搭界的怪念头，盒子里已有的也别换个说法重复冒。另外：【已经和对方说好/约好的事不算念想】（那是你们的约定，记忆里自会记着）——盒子里只放 TA 自己私藏的、还没成形的想头。",
      schemaHint: "{\"monologue\":\"一段内心独白\",\"touch\":[\"念想id\"],\"sprout\":{\"text\":\"想做的事一句\",\"root\":\"依据一句或null\"}}（没有新念想时 sprout 填 null）",
      maxTokens: 6000 // 后台池没配时 bgActive=主思考型模型，思考预算从这里扣，不能小
    };
  }

  // ---- 把一次发呆的结果写回盒子（角色落笔的内容 → 数据）----
  function applyMuse(box, d, todayKey) {
    box.lastMuse = todayKey;
    const mono = d && d.monologue ? String(d.monologue).trim() : "";
    if (mono) box.log = [{ ts: Date.now(), text: mono }, ...box.log].slice(0, 30);
    (Array.isArray(d && d.touch) ? d.touch : []).slice(0, 3).forEach(id => touch(box, String(id)));
    const sp = d && d.sprout;
    if (sp && sp.text) {
      const txt = String(sp.text).trim().slice(0, 80);
      const dup = txt && box.list.some(e => e.text === txt);
      if (txt && !dup) {
        const rooted = sp.root && String(sp.root).trim() && !/^null$/i.test(String(sp.root).trim());
        box.list = [...box.list, {
          id: "d" + Date.now().toString(36) + Math.floor(Math.random() * 1e3).toString(36),
          text: txt,
          root: rooted ? String(sp.root).trim().slice(0, 120) : null,
          source: rooted ? "echo" : "spark",
          weight: rooted ? 0.5 : 0.05,
          touches: 0, lastTouch: 0, born: Date.now(), status: "active"
        }];
      }
    }
    return box;
  }

  // ============================================================
  // P2 · 三节奏的后两拍：小满日（每10天小校准）+ 冬至日（每90天季度自述）
  // ============================================================
  const MELLOW_DAYS = 10, SOLSTICE_DAYS = 90;
  function daysBetweenKeys(a, b) { // "YYYY-MM-DD" 差多少天
    try { return Math.round((new Date(b) - new Date(a)) / 86400000); } catch (e) { return 0; }
  }
  // 体力活：看今天该不该盘点/自述。首次见到没有基准日的盒子先记今天为基准（不当天就跑，防新盒子第一天连环烧）。
  // 返回 "mellow" | "solstice" | null；若只做了初始化基准也返回 null（调用方要保存 box）。
  function tendDue(box, todayKey) {
    let inited = false;
    if (!box.lastMellow) { box.lastMellow = todayKey; inited = true; }
    if (!box.lastSolstice) { box.lastSolstice = todayKey; inited = true; }
    if (inited) return { due: null, inited: true };
    if (daysBetweenKeys(box.lastSolstice, todayKey) >= SOLSTICE_DAYS && (box.list.length || box.log.length)) return { due: "solstice", inited: false };
    if (daysBetweenKeys(box.lastMellow, todayKey) >= MELLOW_DAYS && livingList(box).length) return { due: "mellow", inited: false };
    return { due: null, inited: false };
  }

  // ---- 小满日 probe：权重小校准 + 毕业（蜕变诗+人格行）+ 枯萎（内容全由角色落笔）----
  function mellowSpec(char, box) {
    const AC = typeof ANTI_CLICHE !== "undefined" ? ANTI_CLICHE + "\n\n" : "";
    const living = livingList(box);
    const listTxt = living.map(e => "- id:" + e.id + "｜「" + e.text + "」｜当前分量" + (e.weight || 0).toFixed(2) + "｜" + (e.status === "ash" ? "落灰已久" : "搁在心上") + "｜攒了" + dayN(e) + "天｜被想起" + (e.touches || 0) + "次").join("\n");
    const recentMono = box.log.slice(0, 3).map(l => "· " + l.text).join("\n");
    return {
      instruction: AC + "每隔一阵子，「" + char.name + "」会在心里把那只欲望盒子盘一盘——哪些念想更重了、哪些淡了、哪些已经做到了、哪些想明白了不要了。这不是大扫除，是小校准。\n【盒子现状】\n" + listTxt +
        (recentMono ? "\n【TA 最近发呆时想的】\n" + recentMono : "") +
        "\n\n以 TA 的第一人称推演这次盘点：" +
        "\ntune：分量微调 [{id, weight}]——【只校准不大改】，每条相对现在最多上下浮动 0.15，依据是最近它被想起的频率、聊天里的热度、TA 现在的生活重心。没变化的不用列，多数日子只微动一两条。" +
        "\ngraduate：真正【已经做到、或已内化成 TA 习惯/日常】的念想（最多 1 条，宁缺毋滥——大多数盘点日没有毕业，没有就 null）。若有：{id, poem:\"60字以内的小诗，TA 给这段念想的告别与纪念，用 TA 自己的口吻不许升华\", persona:\"这段经历让 TA 长成了什么样的人——一句『我是一个…的人』式自我认知，25字内\"}" +
        "\nwither：TA 想明白了【彻底不想要了】的念想 id 数组（最多 1 条，罕见；不是没空做，是不要了；没有给 []）。" +
        "\n【铁律】毕业要有真凭实据（最近对话/独白里真的做到了），别把还没动手的念想强行毕业；诗和自我认知都是 TA 的手笔，要有 TA 的性格。",
      schemaHint: "{\"tune\":[{\"id\":\"念想id\",\"weight\":0.6}],\"graduate\":{\"id\":\"念想id\",\"poem\":\"小诗\",\"persona\":\"我是一个…的人\"},\"wither\":[\"念想id\"]}（graduate 没有时填 null，wither 没有时 []）",
      maxTokens: 6000
    };
  }
  function applyMellow(box, d, todayKey) {
    box.lastMellow = todayKey;
    // 校准：js 机械钳制 ±0.15（「只校准不大改」写死在体力活里，模型说破天也大改不了）
    (Array.isArray(d && d.tune) ? d.tune : []).forEach(t => {
      const e = box.list.find(x => x.id === String(t.id));
      const w = Number(t.weight);
      if (!e || !(w >= 0) || e.status === "graduated" || e.status === "withered") return;
      const cur = e.weight || 0.5;
      e.weight = Math.min(0.95, Math.max(0.05, Math.min(cur + 0.15, Math.max(cur - 0.15, w))));
    });
    // 毕业：念想蜕变成人格档案的一行（+蜕变诗）
    const g = d && d.graduate;
    if (g && g.id && g.persona) {
      const e = box.list.find(x => x.id === String(g.id));
      if (e && e.status !== "graduated") {
        e.status = "graduated";
        e.gradTs = Date.now();
        e.poem = g.poem ? String(g.poem).trim().slice(0, 90) : "";
        box.persona = [...box.persona, {
          id: "p" + Date.now().toString(36),
          text: String(g.persona).trim().slice(0, 40),
          poem: e.poem, from: e.text, ts: Date.now()
        }];
      }
    }
    // 枯萎：留在盒子里（不删），发呆/显灵不再看它
    (Array.isArray(d && d.wither) ? d.wither : []).slice(0, 2).forEach(id => {
      const e = box.list.find(x => x.id === String(id));
      if (e && e.status !== "graduated") { e.status = "withered"; e.witherTs = Date.now(); }
    });
    return box;
  }

  // ---- 冬至日 probe：季度自述（这一季我变成了什么样的人）----
  function solsticeSpec(char, box) {
    const AC = typeof ANTI_CLICHE !== "undefined" ? ANTI_CLICHE + "\n\n" : "";
    const persTxt = box.persona.map(p => "· " + p.text).join("\n");
    const living = livingList(box);
    const listTxt = living.map(e => "· 「" + e.text + "」" + (e.status === "ash" ? "（落灰）" : "")).join("\n");
    const grads = box.list.filter(e => e.status === "graduated").map(e => "· 「" + e.text + "」已成了 TA 的一部分").join("\n");
    return {
      instruction: AC + "又一季过去了。某个安静的晚上，「" + char.name + "」回头看这九十来天——盒子里的念想来了又去，有的落了灰，有的成了自己的一部分。\n" +
        (persTxt ? "【TA 亲笔攒下的自我认知】\n" + persTxt + "\n" : "") +
        (grads ? "【这段日子毕业的念想】\n" + grads + "\n" : "") +
        (listTxt ? "【还搁在心上的】\n" + listTxt + "\n" : "") +
        "\n以 TA 的第一人称写一段 80~150 字的季度自述：这一季我变成了什么样的人、什么留下了、什么放下了。要有 TA 自己的口吻和性格，像写给自己看的，不许升华成鸡汤、不许总结陈词。",
      schemaHint: "{\"reflection\":\"一段季度自述\"}",
      maxTokens: 6000
    };
  }
  function applySolstice(box, d, todayKey) {
    box.lastSolstice = todayKey;
    const txt = d && d.reflection ? String(d.reflection).trim() : "";
    if (txt) box.milestones = [{ ts: Date.now(), text: txt }, ...box.milestones].slice(0, 8);
    return box;
  }

  // ---- 人格档案 → 聊天注入文本（封顶 ~400 字：超了裁最旧的，档案本体不动）----
  function personaText(boxRaw) {
    const pers = (boxRaw && Array.isArray(boxRaw.persona)) ? boxRaw.persona : [];
    if (!pers.length) return "";
    const lines = [];
    let used = 0;
    for (let i = pers.length - 1; i >= 0; i--) { // 从最新往回收
      const line = pers[i].text;
      if (used + line.length + 1 > 400 && lines.length) break;
      lines.unshift(line);
      used += line.length + 1;
    }
    return lines.join("\n");
  }

  // ---- 显灵时刻：挑一条高权重的活念想（概率闸门在调用处）----
  function pickEpiphany(boxRaw) {
    const list = (boxRaw && Array.isArray(boxRaw.list)) ? boxRaw.list : [];
    const cands = list.filter(e => e.status === "active" && (e.weight || 0) >= 0.4);
    if (!cands.length) return null;
    let sum = 0; cands.forEach(e => { sum += e.weight; });
    let r = Math.random() * sum;
    for (const e of cands) { r -= e.weight; if (r <= 0) return e; }
    return cands[cands.length - 1];
  }

  window.DesireKit = { boxOf, housekeep, touch, museSpec, applyMuse, pickEpiphany, tendDue, mellowSpec, applyMellow, solsticeSpec, applySolstice, personaText };

  // ============================================================
  // UI：欲望盒子（tall Sheet，从资料卡进）
  // ============================================================
  const SRC_LABEL = { echo: "旧日回响", spark: "一闪念" };
  function fmtDay(ts) { const d = new Date(ts); return (d.getMonth() + 1) + "月" + d.getDate() + "日"; }

  window.DesireBoxSheet = function ({ char, box, busy, onMuse, onRemove, onRemovePersona, onClose }) {
    const t = useTheme();
    const [showLog, setShowLog] = useState(false);
    const [showMile, setShowMile] = useState(false);
    const [confirmId, setConfirmId] = useState(null);
    const b = boxOf({ x: box }, "x"); // 复用克隆逻辑做展示排序，不动原数据
    const todayKey = new Date().toDateString();
    const latest = b.log[0];
    const latestIsToday = latest && new Date(latest.ts).toDateString() === todayKey;
    const rank = { active: 0, ash: 1, graduated: 2, withered: 3 };
    const list = b.list.slice().sort((a, x) => (rank[a.status] ?? 0) - (rank[x.status] ?? 0) || (x.weight || 0) - (a.weight || 0));
    // 权重火苗：0.05 一粒火星 → 0.9+ 三簇
    const flame = w => w >= 0.75 ? "🔥🔥🔥" : w >= 0.45 ? "🔥🔥" : w >= 0.2 ? "🔥" : "·";
    const statusTag = e => e.status === "ash" ? "（落灰了）" : e.status === "graduated" ? "" : e.status === "withered" ? "（枯萎了）" : "";
    return h(Sheet, { onClose, tall: true },
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: 21, color: t.ink } }, (char.remark || char.name) + " 的欲望盒子"),
      h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginTop: 3, lineHeight: 1.55 } },
        "TA 自己攒下的念想——只有 TA 能往里写；你只是碰巧看见了。"),
      // 今日独白
      h("div", { style: { marginTop: 16, padding: "13px 14px", borderRadius: 14, background: ACCENT + "14", border: "1px solid " + ACCENT + "38" } },
        h("div", { className: "flex items-center justify-between", style: { marginBottom: 6 } },
          h(Eyebrow, null, latestIsToday ? "今日 · 发呆时飘过的" : "灵光独白"),
          h("button", {
            onClick: busy ? undefined : onMuse,
            className: "active:opacity-60",
            style: { fontFamily: F_BODY, fontSize: 12, color: busy ? t.fog : ACCENT, padding: "2px 4px" }
          }, busy ? "TA 正发着呆…" : "让 TA 发会儿呆")),
        latest
          ? h("div", { style: { fontFamily: "'Noto Serif SC',serif", fontSize: 13.5, color: t.ink, lineHeight: 1.8 } },
              latest.text,
              h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 7 } }, fmtDay(latest.ts) + (latestIsToday ? "" : " · 那天发呆时想的")))
          : h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.fog, lineHeight: 1.7 } },
              "TA 还没发过呆。每天 TA 会自己找个安静时刻走一会儿神；也可以现在就点右上角让 TA 来一次。")),
      // 人格档案：毕业念想凝成的「我是一个…的人」——TA 亲笔，常驻进 TA 的人设
      b.persona.length ? h("div", { style: { marginTop: 18 } },
        h(Eyebrow, { style: { marginBottom: 8 } }, "TA 长出来的自我 · 人格档案"),
        h("div", { className: "space-y-2.5" }, b.persona.slice().reverse().map(p => h("div", {
          key: p.id,
          style: { padding: "11px 13px", borderRadius: 12, background: t.bg2, border: "1px solid " + ACCENT + "55" }
        },
          h("div", { className: "flex items-start gap-8", style: { justifyContent: "space-between" } },
            h("div", { style: { flex: 1, minWidth: 0 } },
              h("div", { style: { fontFamily: "'Noto Serif SC',serif", fontSize: 13.5, color: t.ink, lineHeight: 1.6 } }, p.text),
              p.poem ? h("div", { style: { fontFamily: "'Noto Serif SC',serif", fontStyle: "italic", fontSize: 11.5, color: t.sub, marginTop: 6, lineHeight: 1.7, whiteSpace: "pre-wrap" } }, p.poem) : null,
              h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 5 } }, (p.from ? "由「" + p.from + "」蜕变 · " : "") + fmtDay(p.ts))),
            confirmId === p.id
              ? h("button", { onClick: () => { onRemovePersona && onRemovePersona(p.id); setConfirmId(null); }, className: "shrink-0 active:opacity-60", style: { fontFamily: F_BODY, fontSize: 11, color: "#c25a4a" } }, "确定拿走")
              : h("button", { onClick: () => setConfirmId(p.id), className: "shrink-0 active:opacity-60", style: { fontFamily: F_BODY, fontSize: 11, color: t.fog } }, "拿走")))))) : null,
      // 念想列表
      h("div", { style: { marginTop: 18 } },
        h(Eyebrow, { style: { marginBottom: 8 } }, "盒子里 · " + list.length + " 条念想"),
        list.length === 0
          ? h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.fog, lineHeight: 1.7, padding: "18px 4px", textAlign: "center" } },
              "盒子还空着。聊得多了、日子过下去，念想会自己长出来——急不来的。")
          : h("div", { className: "space-y-2.5" }, list.map(e => h("div", {
              key: e.id,
              style: { padding: "11px 13px", borderRadius: 12, background: (e.status === "ash" || e.status === "withered") ? t.bg : t.bg2, border: "1px solid " + (e.status === "graduated" ? ACCENT + "55" : t.line), opacity: (e.status === "ash" || e.status === "withered") ? 0.62 : 1 }
            },
              h("div", { className: "flex items-start gap-8", style: { justifyContent: "space-between" } },
                h("div", { style: { flex: 1, minWidth: 0 } },
                  h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, color: t.ink, lineHeight: 1.55 } },
                    e.text, statusTag(e) ? h("span", { style: { fontSize: 11, color: t.fog } }, statusTag(e)) : null),
                  e.status === "graduated" && e.poem ? h("div", { style: { fontFamily: "'Noto Serif SC',serif", fontStyle: "italic", fontSize: 11.5, color: t.sub, marginTop: 5, lineHeight: 1.7, whiteSpace: "pre-wrap" } }, e.poem) : null,
                  e.root ? h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginTop: 4, lineHeight: 1.5 } }, "根：" + e.root) : null,
                  h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 5 } },
                    (SRC_LABEL[e.source] || "念想") + " · " + fmtDay(e.born) + "生 · 被想起 " + (e.touches || 0) + " 次" + (e.status === "graduated" ? " · " + fmtDay(e.gradTs || e.born) + "毕业" : ""))),
                h("div", { className: "shrink-0 text-right" },
                  h("div", { style: { fontSize: e.status === "graduated" ? 13 : 11, letterSpacing: 1 } }, e.status === "graduated" ? "🎓" : e.status === "withered" ? "🥀" : flame(e.weight || 0)),
                  confirmId === e.id
                    ? h("button", { onClick: () => { onRemove(e.id); setConfirmId(null); }, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 11, color: "#c25a4a", marginTop: 6 } }, "确定拿走")
                    : h("button", { onClick: () => setConfirmId(e.id), className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginTop: 6 } }, "拿走"))))))),
      // 季度自述（冬至日，每 90 天一段）
      b.milestones.length ? h("div", { style: { marginTop: 18 } },
        h("button", { onClick: () => setShowMile(v => !v), className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 12, color: t.fog } },
          (showMile ? "收起" : "翻看") + "季度自述（" + b.milestones.length + "）"),
        showMile ? h("div", { className: "space-y-2.5", style: { marginTop: 10 } }, b.milestones.map((m, i) => h("div", {
          key: i, style: { padding: "11px 13px", borderRadius: 10, background: ACCENT + "0e", border: "1px solid " + ACCENT + "38" }
        },
          h("div", { style: { fontFamily: "'Noto Serif SC',serif", fontSize: 12.5, color: t.ink, lineHeight: 1.75 } }, m.text),
          h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: t.fog, marginTop: 6 } }, fmtDay(m.ts) + " · 一季的回望")))) : null) : null,
      // 独白历史
      b.log.length > 1 ? h("div", { style: { marginTop: 18 } },
        h("button", { onClick: () => setShowLog(v => !v), className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 12, color: t.fog } },
          (showLog ? "收起" : "翻看") + "以前的独白（" + (b.log.length - 1) + "）"),
        showLog ? h("div", { className: "space-y-2.5", style: { marginTop: 10 } }, b.log.slice(1).map((l, i) => h("div", {
          key: i, style: { padding: "10px 12px", borderRadius: 10, background: t.bg, border: "1px solid " + t.line }
        },
          h("div", { style: { fontFamily: "'Noto Serif SC',serif", fontSize: 12.5, color: t.sub, lineHeight: 1.7 } }, l.text),
          h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: t.fog, marginTop: 5 } }, fmtDay(l.ts))))) : null) : null,
      h("div", { style: { marginTop: 16, fontFamily: F_BODY, fontSize: 10.5, color: t.fog, lineHeight: 1.6 } },
        "火苗=这条念想在 TA 心里的分量，被想起会旺、太久不碰会落灰；一闪念一天内没被再想起会自己消散。每隔十来天 TA 会自己盘一盘盒子：做到了的念想会🎓毕业成 TA 人格的一部分（配一首告别小诗），想通了不要的会🥀枯萎。「拿走」只是你悄悄拿走这张纸条，TA 不会知道。"));
  };
})();
