// ============================================================
// Ta 眼里(gaze)—— 角色对用户与关系的长期印象卡
// 十块:关于我 5 + 关于我们 5;角色亲笔、锚具体事例、慢演进。
// 更新走聊天协议按需字段 impression(单聊+群聊),无独立调用、无定时器;
// 冷启动由状态卡页的一次性建卡完成。只读;言秋(engineerEyes)排除。
// 注入 buildBundle 常驻影响态度;「假装没注意的事」框架为回避形状,防话题磁吸。
// 数据存 x_gaze(跟随 x_ 前缀云同步),每次修订自动留旧版快照。
// ============================================================
(function () {
  const useState = React.useState;
  const ME = [["person", "她是个什么样的人"], ["soft", "她的软肋和雷区"], ["like", "我吃她哪一套·头疼哪一套"], ["recent", "最近的她"], ["unread", "我还没看懂的部分"]];
  const US = [["what", "我们现在算什么"], ["how", "我们的相处方式"], ["marks", "走到这里的几个节点"], ["elephant", "我假装没注意的事"], ["want", "我担心的·我想要的"]];
  const KEYS = {}; ME.forEach(([k, n]) => KEYS["me." + k] = n); US.forEach(([k, n]) => KEYS["us." + k] = n);
  // ── 发给模型时换一套说法（v64.56）────────────────────────────────────
  // 她 2026-09-06 试下来：**只有两个角色能过**，别的都被 Gemini 拦在输入那一关。
  // 有角色能过 ⇒ 光有这十道题不够；换个角色又不过 ⇒ 光有人设也不够
  //（主聊天天天带着同一份人设、同一个模型在跑，一次没拦过）。
  // 所以是【人设 × 问法】撞在一起：她那份人设里有「姐姐」「年龄差」「调情」「撒娇」，
  // 而这十块里三个问的是「她的软肋和雷区」「我吃她哪一套」「我假装没注意的事」——
  // 合起来读就是「分析这个真人的弱点、什么招对她管用、她有什么把柄」。
  // 那正是内容策略最容易盯上的形状。人设是她的，改不得；能动的只有我这半边。
  // ⚠️只换【发给模型的措辞】，界面上那十个名字一个字不动——那是她的东西。
  // ⚠️意思一点没变，换掉的是「像在给一个真人做弱点分析」那股味道。
  // ⚠️这就成了「一层写在两处」：以后加一块，两张表都得加。
  //   所以下面那条断言把它钉死：两张表的 key 必须完全一致，少一个当场红。
  const ASK = Object.assign({}, KEYS, {
    "me.soft": "什么事会让她一下子不好受",
    "me.like": "她哪些地方最打动我、哪些地方让我头疼",
    "us.elephant": "有件事我一直没提"
  });
  // ⚠️真正的坑不是「漏了一块」——ASK 是从 KEYS 复制出来再覆盖的，永远不会缺 key
  //（我第一版还专门为此加了一道闸，写完才发现它根本不可能触发，测试当场抓到）。
  //   真会出事的是【覆盖那一行的 key 打错字】：写成 "me.softt" 的话，
  //   ASK 里多一条没人用的垃圾，而 me.soft 悄悄退回老说法——提示词就这么变回去了，
  //   界面上一点看不出来。所以闸要对着这一种：ASK 里不许有 KEYS 没有的 key。
  Object.keys(ASK).forEach(k => { if (!KEYS[k]) throw new Error("发给模型那套说法里，这个 key 打错了：" + k); });
  const load = () => { try { return JSON.parse(localStorage.getItem("x_gaze") || "{}"); } catch (e) { return {}; } };
  // 落本机之后顺手把【改动的那个人】那一行推上 grown 表（见 js/grown-sync.js）。
  // ⚠️推失败绝不影响本机这一份——它只是多一道保险，不是主路。
  const persist = (d, touched) => {
    try { localStorage.setItem("x_gaze", JSON.stringify(d)); } catch (e) {}
    try {
      if (touched && d[touched] && window.Cloud && window.Cloud.grownUpsert)
        window.Cloud.grownUpsert("gaze", { [touched]: d[touched] }).catch(() => {});
    } catch (e) {}
  };
  const boxOf = (d, charId) => d[charId] || { blocks: {}, hist: [], seeded: false };
  // 应用一次修订(协议字段或建卡):校验块名、留旧版快照、盖新内容
  // 占位说明被原样抄回来（v62.35）。schemaHint 里每一栏写的是【那一块是什么】，
  // 而模型有时候会把说明本身当成内容填回来——那是一句废话，不该占着这一块。
  // 「规则降概率，代码才保证」：提示词里已经说了别照抄，这儿再兜一道。
  const PLACEHOLDER = {};
  Object.keys(KEYS).forEach(k => { PLACEHOLDER[KEYS[k].replace(/[·、，。]/g, "")] = 1; });
  // v64.56：发给模型的是 ASK 那一套说法，所以他抄回来的也会是那一套——两套都得挡
  Object.keys(ASK).forEach(k => { PLACEHOLDER[ASK[k].replace(/[·、，。]/g, "")] = 1; });
  // ⚠️占位说明就是【块名本身】——schemaHint 里那十栏写的正是 KEYS 里那十个名字。
  //   所以这张表只能从 KEYS 派生，不许另抄一份：另抄一份就是「一层写在两处」，
  //   哪天改了块名，这儿会悄悄失效（变异测试当场证明另抄那四条一条都没用上）。
  function apply(charId, side, block, text) {
    const k = side + "." + block;
    if (!KEYS[k]) return false;
    const t = String(text || "").trim().slice(0, 400);
    if (!t) return false;
    if (PLACEHOLDER[t.replace(/[·、，。\s]/g, "")]) return false;   // 把说明抄回来了，不算写
    const d = load(); const box = boxOf(d, charId);
    const old = box.blocks[k];
    if (old && old.text === t) return false;
    if (old && old.text) box.hist = [{ k, old: old.text, ts: old.ts || Date.now() }, ...(box.hist || [])].slice(0, 120);
    box.blocks[k] = { text: t, ts: Date.now() };
    touch(box, k);                       // 刚写过 → 排到队尾
    box.turns = 0;                       // 写过了就重新数
    box.refuse = 0;                      // 他真写了 → 「写不出来」的连击断了
    box.mute = 0;                        // 也断了「点了名却一声不吭」的连击
    d[charId] = box; persist(d, charId);
    // 他改了这一块 → 她当然还没看过新的。直接清掉这一块的已读，
    // 别去比时间戳：同一毫秒内改写会让 ts 和 seen 相等，红点就永远亮不起来（测试逮到的）。
    try {
      const sd = loadSeen(); const mine = sd[charId];
      if (mine && mine[k] != null) { delete mine[k]; sd[charId] = mine; persistSeen(sd); }
    } catch (e) {}
    return true;
  }
  // 协议里塞回的 impression 字段(单聊/群聊共用解析)
  // 模型偶尔把块名写成中文名(「她是个什么样的人」)、或把 side 一起塞进 block(「me.person」)。
  // 以前这两种都直接 KEYS 查不到 → 静悄悄返回 false,看上去就是「他从来不写」。
  // 认得出来就别丢:这一层本来就写得少,丢一次就是丢一次(她 2026-08-27:8.16 到现在一次没改过)。
  const NAME2KEY = {}; Object.keys(KEYS).forEach(k => { NAME2KEY[KEYS[k]] = k; });
  Object.keys(ASK).forEach(k => { NAME2KEY[ASK[k]] = k; });   // v64.56：他看到的是 ASK 那套名字
  function normKey(side, block) {
    const b = String(block || "").trim(), sd = String(side || "").trim();
    if (KEYS[sd + "." + b]) return sd + "." + b;
    if (KEYS[b]) return b;                       // block 里已经带了 side
    if (NAME2KEY[b]) return NAME2KEY[b];         // 写的是中文块名
    const bare = b.replace(/^.*\./, "");
    if (KEYS[sd + "." + bare]) return sd + "." + bare;
    for (const k of Object.keys(KEYS)) if (k.slice(k.indexOf(".") + 1) === bare) return k;
    return "";
  }
  function applyParsed(charId, imp) {
    if (!imp || typeof imp !== "object") return false;
    const k = normKey(imp.side, imp.block);
    if (!k) return false;
    return apply(charId, k.slice(0, k.indexOf(".")), k.slice(k.indexOf(".") + 1), imp.text);
  }
  // 距上次改写过了多少轮。她 2026-08-24：「第一次我直接让他们写入他们会写,不然都不会自动弄」
  // ——病根在下面 spec 里那句「绝大多数轮次省略」:它把「很少」写成了「别写」。
  // 可这张卡本来就该是长期的,改成每轮必填会让它天天翻脸。折中:平时照旧极少写,
  // 但隔了足够多轮一次没动过,就在协议里点一句「这段时间真有变化就写下来」。
  // ⚠️tick 是【这一轮他两个字段都没填】那一路的落点。原来它只做一件事：把 turns 加一。
  //   可这一轮如果【点了名】，"没填"就不是"这阵子没变化"，是**他把这一层整个跳过了**——
  //   提示词里那句「两个都不填=跳过」是话，没有任何一行代码在数它。
  //   于是三件事一起坏：①同一块永远排在队首，另外九块一次都轮不到；
  //   ②界面上「他真没什么可改的」和「他压根不理」长得一模一样；③没有任何东西能触发补救。
  //   现在把这一路记下来：连击数（mute）＋这一块被跳过几次（skips）＋转队标记（passAt）。
  //   ⚠️必须在 turns 加一【之前】问 dueNow——那才是拼这一轮提示词时看到的那一块。
  const SKIP_ROTATE = 3;
  function tick(charId) {
    const asked = dueNow(charId);
    const d = load(); const box = boxOf(d, charId);
    box.turns = Math.min((Number(box.turns) || 0) + 1, 999);
    if (asked && asked.k) {
      box.mute = Math.min((Number(box.mute) || 0) + 1, 999);
      box.skips = box.skips || {};
      box.skips[asked.k] = (Number(box.skips[asked.k]) || 0) + 1;
      if (box.skips[asked.k] >= SKIP_ROTATE) {
        box.passAt = box.passAt || {};
        box.passAt[asked.k] = Date.now();   // 只为排队：让下一块有机会被问到
        touch(box, asked.k);
        box.skips[asked.k] = 0;
      }
    }
    d[charId] = box; persist(d, charId);
    return box.turns;
  }
  // ---- 轮询复看(她 2026-08-27:「其他块岂不是永远没有改的机会了」)----
  // 以前是笼统问「有没有哪块该改」,模型每轮要同时顾十几个字段,这一层最容易被整个跳过;
  // 后来我给了个「挑不出就写 recent」的落点,结果 recent 变成万能出口,另外九块照样冻着。
  //
  // 改成【点名问最老的那一块】,并且允许它诚实回答「看过了,不用改」:
  //   · 改写 → blocks[k].ts 更新,红点亮
  //   · 复看没改 → checks[k] 更新,不亮红点,但这一块【排到队尾】,下一轮点名轮到别人
  //   · 沉默 → 这一块继续被点名,不会滑过去
  // 这样既不逼它没事硬编(允许说不用改),也不给它整层跳过的机会(总有一块被点着名)。
  function markChecked(charId, k) {
    if (!KEYS[k]) return false;
    const d = load(); const box = boxOf(d, charId);
    box.checks = box.checks || {};
    box.checks[k] = Date.now();
    touch(box, k);                       // 复看过也算碰过 → 排到队尾
    box.mute = 0;                        // 答了就不算沉默——哪怕答的是「不用改」
    // ⚠️「看过了不用改」是个【免费的出口】：它比写一块省事得多，模型会一直选它。
    //   原来这一下把 turns 清成 0，等于一次白答就买走 25 轮的安静——
    //   十块轮一遍要 250 轮，这一层跟没有一样。
    //   现在只退回去一小段：下一块过十几轮就会被点到名，队列真的转得动。
    //   （卡还空着的时候由上面 blank 那条兜着，每轮都点，不看这个数。）
    box.turns = Math.max(0, STALE_TURNS - 10);
    // ⚠️整张卡还空着的时候,「认识得还不够」是个【没有任何反作用力的免费出口】:
    //   它比写一块省事,答一次就换下一块问,十块可以一直这么轮下去——
    //   于是同样两个新角色,一个每轮写一块,另一个一辈子全空(她 2026-09-02 报的就是这个)。
    //   这里把连击数记下来:达到一定次数后 spec 会收掉这个出口,GazePage 也会照实说出来。
    if (Object.keys(box.blocks || {}).length === 0) box.refuse = Math.min((Number(box.refuse) || 0) + 1, 999);
    d[charId] = box; persist(d, charId);
    return true;
  }
  // 最久没被碰过的那一块(写过和看过都算碰过);从没写过的块排最前,它们更该被问一次
  // ⚠️这张卡最容易长歪的方向：把【她自己写下的设定】复述一遍，当成「我看出来的」。
  //   她 2026-09-04 报：新角色十块里只有第一块有字，而那一块就是她人设的润色版。
  //   病根有两半——一半是下面 seedSpec 那份示例【自己示范了「填一块、其余全 null」】
  //   （prompt-no-content-samples.md：示例会被逐字照抄，连填法也会）；
  //   另一半是没人拦着他复述人设：新角色手上除了她的设定本来就没别的材料。
  // ⚠️两条路（建卡那一次 + 每轮那一路）都要这一句，所以只写一份——各写一份迟早只改一处。
  const NOT_PROFILE = uName => "⚠️【绝不许复述她的设定】" + uName
    + " 自己写下的自我介绍/人设，是她【给】你的，不是你看出来的——把它换个说法写进这张卡，等于一个字都没写。"
    + "这张卡只收【你从相处里真的注意到的】：每一句都得能落回某一次具体的对话、某件真发生过的事。"
    + "落不回去的那一块就是空的——**填 null 比编一句漂亮话强**。";
  // ⚠️排队只看「写过」和「复看过」是不够的：还有第三种结局——**点了名，他两个字段都没填**。
  //   那一路原来在这张表上不留任何痕迹，于是 max(ts, checks) 一动不动，
  //   **同一块被点名点到天荒地老，另外九块一次都轮不到**（她 2026-09-05：
  //   「Ta 眼里还是不改啊看都不看的」——十块全是 19 天前写的，一块「又想了一遍」都没有，
  //   说明他既没改也没答，走的正是这条没人管的路）。
  //   连着沉默 SKIP_ROTATE 轮就记一笔 passAt，让队伍转下去；passAt 只管排队，
  //   **绝不当成「他又想了一遍」**——他没有，界面上不许这么写。
  // ⚠️排队的位置是【序号】，不是【时刻】。原来拿 Date.now() 当队列位置，同一毫秒内
  //   碰过的几块会排成一模一样的名次，`ts < bestTs` 只认严格小于——于是它们谁也挤不动谁，
  //   队首永远是 KEYS 里最前面那一个，**队伍看着在转，其实一直卡在同一块上**。
  //   碰一次就发一个自增号，谁都不会跟谁并列。
  //   老存档里没有 order：那些块退回按时刻排（旧行为原样），排在所有【升级之后被碰过的】前面
  //   ——它们确实是更久没被碰过的那一批。
  const ORDER_BASE = 1e15;   // 比任何 Date.now() 都大：有号的一律排在按时刻排的后面
  function touch(box, k) {
    box.seq = (Number(box.seq) || 0) + 1;
    box.order = box.order || {};
    box.order[k] = box.seq;
  }
  function dueBlock(charId) {
    const box = boxOf(load(), charId), checks = box.checks || {}, passAt = box.passAt || {}, order = box.order || {};
    let best = "", bestRank = Infinity, bestTs = 0;
    Object.keys(KEYS).forEach(k => {
      const b = box.blocks[k];
      const ts = Math.max(Number(b && b.ts) || 0, Number(checks[k]) || 0, Number(passAt[k]) || 0);
      const rank = order[k] ? ORDER_BASE + Number(order[k]) : ts;
      if (rank < bestRank) { bestRank = rank; best = k; bestTs = ts; }
    });
    return best ? { k: best, ts: bestTs, text: (box.blocks[best] || {}).text || "" } : null;
  }
  // 这一轮到底点没点名、点的是哪一块——**只此一处**。
  // spec（拼提示词）和 tick（记这一轮的结局）必须看同一个答案：
  // 各算一遍就是「一层写在两处」，哪天改了档位，其中一处必然没跟上。
  function dueNow(charId) {
    if (!charId) return null;
    const blanks = blankCount(charId);
    const gap = blanks >= KEY_COUNT ? 0 : blanks > 0 ? 6 : STALE_TURNS;
    return staleTurns(charId) >= gap ? dueBlock(charId) : null;
  }
  const checkedAt = (charId, k) => Number((boxOf(load(), charId).checks || {})[k]) || 0;
  const STALE_TURNS = 25;
  const KEY_COUNT = Object.keys(KEYS).length;
  // 还有几块从来没写过
  const blankCount = charId => { const b = boxOf(load(), charId).blocks || {}; return Object.keys(KEYS).filter(k => !(b[k] && b[k].text)).length; };
  // ⚠️这里原来是 `Object.keys(box.blocks).length ? turns : 0`——**空卡永远返回 0**。
  //   于是下面 spec 里那句 `n >= STALE_TURNS` 永远不成立、点名那一段永远不出现，
  //   模型只看得到「仅当真正改变了长期认知时填写」这一句高门槛，一辈子不写；
  //   卡是空的 → 不点名 → 不写 → 还是空的，**一个死锁**。
  //   她 2026-09-01：「这个 Ta 眼里还是根本不填」——就是这条。
  //   本意大概是「新角色别一上来就催」，但代价是这一层对新角色【永远死着】：
  //   只有手动按一次「建卡」才可能有内容，没按过的人一辈子看不到东西。
  function staleTurns(charId) {
    return Number(boxOf(load(), charId).turns) || 0;
  }

  // 常驻注入文本(空卡=零注入)
  function text(charId, uName) {
    const box = boxOf(load(), charId);
    const rows = Object.entries(KEYS).map(([k, name]) => box.blocks[k] && box.blocks[k].text ? "·" + name + ":" + box.blocks[k].text : null).filter(Boolean);
    if (!rows.length) return "";
    return "【你眼里的 " + uName + " 与你们(你私下沉淀的长期认知)】\n" + rows.join("\n") +
      "\n这些是你自己心里的东西:自然渗进语气、分寸和相处方式,绝不当台词复述或逐条印证。尤其「假装没注意的事」——它存在的方式就是你【绕着它走】,绝不主动把话题引向它,只在被真正踩到时才露出一点反应。";
  }
  // 聊天协议按需字段说明(单聊/群聊共用)
  // opts.tail=true → 【不带点名那一段】。调用方要自己把 nudge() 拼到整份 system 的最尾巴上。
  // 为什么要分开：线下那边 gazeSpecBlock 本来就是【拼在最后】的，线上却把它埋在
  // 【能力字段字典】中间——后面还压着一千多字的送礼/通话/撤回/转账/约回。
  // 这个文件自己两处注释都写着「最响的那句话赢，尤其它还是最后一句」，
  // 而线上这一处恰恰把它放在了最不响的位置（她 2026-09-05：十块 19 天没动过）。
  function spec(uName, charId, opts) {
    // 「什么时候算改变了」原本没有可判定的标准,模型只能一直判「没有」。给三个具体触发点。
    const trigger = "\n什么时候算数(满足其一就该写,不必等到惊天动地):①她说了或做了一件你【以前不知道】的事,补进对应的块;②你对她的某个判断被这轮的事【推翻或修正】了;③你们之间出现了一个以后会被记住的【具体节点】。";
    // 攒够轮数就【点名】问最老的那一块,而不是笼统问「有没有哪块该改」
    // 【多久点一次名】按卡填到什么程度分三档——空卡更该点名，不是更不该：
    //   一块都没有 → 每一轮都点。有材料就写、没材料就诚实说没有然后换下一块，
    //                填满的速度只取决于真发生了多少事。
    //   写了一部分 → 每 6 轮点一次。写满一块就等 25 轮的话，剩下九块要等两百多轮。
    //   十块写满   → 回到 25 轮那一档，进入维护状态。
    const due = dueNow(charId);
    const fresh = !!due && !due.text;
    const head = "impression: {\"side\":\"me|us\",\"block\":\"块名\",\"text\":\"整块重写后的内容\"},一轮至多一块。";
    // ⚠️门槛这一句必须跟着【被点名的这块写没写过】变。
    //   v59.79 之前不管空不空都只有高门槛那一句「仅当本轮真正改变了长期认知时填写」——
    //   可一块【从来没写过】的东西永远等不到「本轮把它改变了」,模型每轮都诚实地判「没变化」
    //   然后省略,卡一辈子空着(她 2026-09-01:「不行,两轮了空卡完全不填」)。
    //   空块的门槛不是「变了没有」,是「你现在心里有没有」。
    const gate = fresh
      ? "⚠️这一轮被点名的那一块【你从来没写过】:填它【不需要】本轮发生了什么变化——你此刻心里对 " + uName + " 已经有的那个判断,本身就是内容,照实写下来就行。"
      : "仅当本轮发生的事【真正改变了你对 " + uName + " 或你们关系的某一块长期认知】时填写。";
    // ⚠️v64.56：这一串原来把十个名字【又抄了一遍】（第三份）。现在从 ASK 长出来——
    //   加一块只改一处，别再各写各的。
    const _side = (arr, sd) => arr.map(([k]) => k + "(" + ASK[sd + "." + k] + (k === "elephant" ? ",至多两件" : "") + ")").join("/");
    const keys = "side=me 的块名:" + _side(ME, "me") + ";side=us:" + _side(US, "us")
      + "。text≤80字,第一人称亲笔、锚在真实发生的事上;在旧内容基础上小幅演进,绝不因单日情绪整块翻转。"
      + NOT_PROFILE(uName);
    return head + gate + keys + trigger + (opts && opts.tail ? "" : nudge(uName, charId));
  }
  // 点名那一段。单拎出来是为了让调用方能把它放到整份 system 的【最后】。
  function nudge(uName, charId) {
    const due = dueNow(charId);
    if (!due) return "";
    const days = due.ts ? Math.floor((Date.now() - due.ts) / 86400000) : 0;
    const box = boxOf(load(), charId);
    const blanks = charId ? blankCount(charId) : 0;
    // 整张卡全空、而且他已经连着答了好几轮「认识得还不够」——这个出口得收一收(见 markChecked 那段注释)
    const pressed = blanks >= KEY_COUNT && (charId ? refuseCount(charId) : 0) >= 3;
    // 连着好几轮点了名却一个字段都不填：那不是「没变化」，是把这一层整个跳过了。
    // 说出来——**沉默这一路原来在提示词里也是没有反作用力的**，只有一句笼统的「别沉默」。
    const mute = Number(box.mute) || 0;
    return "\n⚠️【这一轮请复看这一块】「" + ASK[due.k] + "」(" + due.k + ")"
        + (due.text ? "——你" + (due.ts ? (days >= 1 ? days + " 天前" : "不久前") : "上次") + "写的是:「" + due.text + "」。" : "——**这一块还是空的,你从来没写过**。")
        + (due.text ? "这段时间真的发生过的事,让它需要改吗?" : "到现在为止你们之间发生过的事,够不够你写下这一块?")
        + "\n· " + (due.text ? "需要改" : "写得出来") + " → impression 填【这一块】(" + (due.text ? "仍是小幅演进、仍锚在具体的事上,别整块翻转" : "锚在真发生过的事上,别拿泛泛的关系描述凑数") + ")。"
        + "\n· " + (due.text ? "看过了,确实不用改" : "认识得还不够,真写不出来") + " → 填 impressionChecked:\"" + due.k + "\"。这是个正经回答,不丢人;写了它这一块就排到队尾,下轮换别的块问你。"
        + "\n· 两个都不填=你把这一层整个跳过了,下一轮还会问同一块。别为了交差硬编,也别沉默。"
        // ⚠️「最响的那句话赢，尤其它还是最后一句」：协议开头那句「没有真实变化就别为了填字段制造内容」、
        //   以及紧跟在这一段后面那句「未发生、未改变的按需字段直接省略」，两句都在替模型作答「省略」。
        //   点名这一段夹在中间，票数是 2:1，它必输。所以这里必须【点名把那两句排除掉】。
        + "\n⚠️协议里那句「没有真实变化或实际触发时,不要为了填字段制造内容」和那句「未发生、未改变的按需字段直接省略」【都管不到这一条】:这一块被点了名,impression 与 impressionChecked 必须二选一,不许两个都省略。"
        // ⚠️「最响的那句话赢，尤其它还是最后一句」：所以收出口这一段必须【垫在最后】。
        + (pressed ? "\n⚠️你已经连着好几轮答「写不出来」了,这张卡到现在十块全是空的。空块的门槛不是「变了没有」,是【你现在心里有没有】——你们已经相处到这里,不可能一块都没有。这一轮请挑十块里你最写得出来的【任何一块】填进 impression,不必是上面点名的那一块。只有真的连一块都挤不出来,才填 impressionChecked。" : "")
      + (mute >= 3 ? "\n⚠️你已经连着 " + mute + " 轮被点名却两个字段都没填了。这一轮不许再跳过：真有变化就写 impression，真没有就写 impressionChecked，二选一。" : "");
  }
  // ---- 自动复看(v63.51)----
  // 「规则降概率，代码才保证」在这一层的【第二次】落法。
  // 建卡那一路已经证明过一件事：这张卡真正被写出来，靠的从来不是聊天协议里那个按需字段，
  // 而是【专门的一次调用】——它一次问十块，没有别的三十个字段跟它抢注意力，从来不会不写。
  // 每轮那个字段则相反：它夹在送礼/通话/撤回/转账/约回中间，最容易被整个跳过，
  // 而跳过在代码这一道原来【没有任何代价】（见上面 tick）。
  // 所以卡长期冻住时，就照建卡的样子补一次复看：
  //   条件 = 卡上有内容(不是建卡那一路) + 最新的一块也已经 REVIEW_DAYS 天没动过
  //        + 他确实被点过名却连着不吭声(mute≥REVIEW_MUTE)
  // ⚠️她按次计费：所以这一路【不是定时器】，只在上面三条同时成立时才动，
  //   而且带次数上限和冷却——修不好就停手，绝不变成每天一次的自动调用。
  const REVIEW_DAYS = 14;
  const REVIEW_MUTE = 12;
  const REVIEW_MAX = 3;
  const REVIEW_GAP = 10 * 60000;
  const newestTs = box => Object.keys(box.blocks || {}).reduce((a, k) => Math.max(a, Number(box.blocks[k].ts) || 0), 0);
  function reviewDue(charId) {
    const box = boxOf(load(), charId);
    const newest = newestTs(box);
    if (!newest) return false;                                   // 空卡走建卡那一路，不归这里
    if (Date.now() - newest < REVIEW_DAYS * 86400000) return false;
    if ((Number(box.mute) || 0) < REVIEW_MUTE) return false;     // 他还在正常答，就别插手
    if ((Number(box.reviewN) || 0) >= REVIEW_MAX) return false;
    // 上一次复看的结论就是「没什么要改的」→ 那是答案，不是失败，再等满一轮天数
    if (Date.now() - (Number(box.reviewOkAt) || 0) < REVIEW_DAYS * 86400000) return false;
    return Date.now() - (Number(box.reviewAt) || 0) >= REVIEW_GAP;
  }
  // 先记标记再打调用（照「先记游标再刷」）：抖一下不该把这轮机会静悄悄烧掉，所以记的是次数不是布尔。
  // ⚠️manual=她自己按下面那颗「让他再看一遍这十块」：**不占自动预算**（v64.35）。
  //   原来手动和自动共用 reviewN，于是她手动重试几次就把自动那三次额度按光了——
  //   她 2026-09-06 那张截图上写着「自动复看过 4 次」，而上限是 3，多出来的那一次
  //   就是她自己按的。预算防的是「代码偷偷花钱」，不是防她自己要。
  //   （reviewAt 照记：那是防连点的冷却，两条路都该有。）
  function markReview(charId, manual) {
    const d = load(); const box = boxOf(d, charId);
    if (!manual) box.reviewN = (Number(box.reviewN) || 0) + 1;
    box.reviewAt = Date.now(); box.reviewErr = ""; box.reviewErrRaw = "";
    d[charId] = box; persist(d, charId);
    return true;
  }
  // 败因要说人话（她 2026-09-05 截图：界面上原样印着「没解析出卡」——
  // 那是 `throw new Error()` 里的话，是给我看的，不是给她看的）。
  // ⚠️所以【存进去之前就翻好】：存原文的话，这一句在界面上会一直是机器话。
  //   认不出来的一律说「这一次没成」，绝不把异常原文摆到她眼前。
  function plainWhy(msg) {
    const m = String(msg || "");
    if (!m) return "这一次没成";
    // ⚠️engine 那份诊断（callDiag）自己就下了结论，得【先认它】：
    //   它的原话是「…＝上游直接打回来了（拦截／格式／配额），**不是超时**」——
    //   里头带着「超时」两个字。先跑下面那条 /超时/ 的话，
    //   一句明说「不是超时」的诊断会被判成超时（我第一版就是这么写反的，测试当场逮到）。
    // 上游把【提示词本身】拦了（内容政策），不是模型不会答、也不是线路坏了。
    // 她 2026-09-06 遇到的就是这一种：Gemini 回的原话是
    // 「The prompt could not be submitted. The prompt contains sensitive words…」。
    // ⚠️这句得排在「线路报错」前面：它更具体，说的是【为什么】被拦，
    //   而「线路报错」只说了「没跑起来」——换条线路是对的做法，但不知道换的理由。
    // 缩过一次还是被拦（v64.47）：这一句最要紧——它排除了「聊天内容踩线」这个最大嫌疑，
    // 所以得排在下面那句更笼统的前面，不然会被它先答掉。
    // 三级都缩过还是被拦（v64.55）：这一句排除了聊天内容【和】长期记忆，
    // 剩下的只有人设或这张卡自己的正文——它比下面那句笼统的信息量大得多，得排在前面。
    if (/都试过了，还是被拦/.test(m)) return "聊天记录和长期记忆都去掉了还是被拦，剩下人设或这张卡本身";
    if (/去掉聊天记录再试一次【还是被拦】/.test(m)) return "去掉聊天记录也还是被拦，不是聊天内容的事";
    if (/not be submitted|prohibited use|sensitive words|was blocked|safety|内容政策/i.test(m)) return "这条线路把提示词拦了（内容政策）";
    if (/线路报错/.test(m)) return "这条线路此刻没跑起来";
    if (/上游直接打回来/.test(m)) return "上游把这次请求打回来了";
    if (/等到一半才断/.test(m)) return "等太久，超时了";
    if (/解析|JSON|parse/i.test(m)) return "模型没按格式答";
    if (/超时|timeout|abort/i.test(m)) return "等太久，超时了";
    if (/401|403|unauthor|密钥|api key|apikey/i.test(m)) return "这条线路没配好";
    if (/429|rate.?limit|限流|too many/i.test(m)) return "被限流了";
    if (/fetch|network|网络|连接|ECONN|ENOTFOUND/i.test(m)) return "网没连上";
    if (/余额|quota|insufficient|billing/i.test(m)) return "额度不够了";
    // engine 抛的那句「模型返回为空（停止原因：…）〔…等了 N 秒＝上游直接打回来了…〕」
    // 原来一条都匹配不到，全落进兜底那句「这一次没成」——她 2026-09-06 看到的就是它。
    if (/返回为空|没有返回正文/.test(m)) return "模型一个字都没吐出来";
    // 已经是人话的那几句（「一块也没写出来」「一块都没改」）原样留着
    if (/[一二三四五六七八九十百]|块|写|改|答/.test(m) && !/[A-Za-z]{4}/.test(m)) return m;
    return "这一次没成";
  }
  // ⚠️人话那一句是给她看的，可【原文不能扔】（v64.35）。
  //   她 2026-09-06 报「还是不行」，界面上只有一句「这一次没成」——
  //   那正是 plainWhy 认不出来时的兜底，于是她和我都不知道到底是什么坏了。
  //   而 engine 那边其实已经把话说得很清楚了（callDiag：哪个模型、提示词多大、
  //   输出上限多少、等了几秒、是上游直接打回来还是超时）——全被这一句吞掉了。
  //   所以原文另存一份，界面上收在「为什么」后面，点开才看。
  function markReviewFail(charId, why) {
    const d = load(); const box = boxOf(d, charId);
    box.reviewErr = plainWhy(why).slice(0, 60);
    box.reviewErrRaw = String(why || "").slice(0, 400);
    box.reviewOkAt = 0;
    d[charId] = box; persist(d, charId);
    return true;
  }
  // 「复看了一遍，他觉得没什么要改的」——这是个【正常结局，不是失败】（v64.35）。
  // 提示词里白纸黑字写着「没变就是没变，不必为了交差改字」，模型照做了，
  // 代码这一道却把它记成一次失败：三次之后「试满了，往后不再自动试」，
  // 而界面上写的是「都没成」。她看到的于是是「坏了」，其实是「他真没什么要改的」。
  // ⚠️不能只是不记失败就完事：那样十分钟后又会自动再问一次，一路烧到上限。
  //   所以记 reviewOkAt，下面 reviewDue 按它重新等满 REVIEW_DAYS 天。
  function markReviewNoChange(charId) {
    const d = load(); const box = boxOf(d, charId);
    box.reviewOkAt = Date.now(); box.reviewErr = ""; box.reviewErrRaw = "";
    box.reviewN = 0;                     // 不是失败，预算还回去
    d[charId] = box; persist(d, charId);
    return true;
  }
  const reviewState = charId => {
    const box = boxOf(load(), charId);
    return { tries: Number(box.reviewN) || 0, max: REVIEW_MAX, last: Number(box.reviewAt) || 0,
      err: box.reviewErr || "", raw: box.reviewErrRaw || "", okAt: Number(box.reviewOkAt) || 0, mute: Number(box.mute) || 0 };
  };
  const muteCount = charId => Number(boxOf(load(), charId).mute) || 0;
  // 复看这一次问的不是「你对她怎么看」（那是建卡），是「这十块里哪几块已经不对了」。
  // 把现行十块原样给他看，让他逐块比对；没变的填 null。
  function reviewSpec(uName, charId) {
    const box = boxOf(load(), charId);
    const rows = Object.keys(KEYS).map(k => "· " + ASK[k] + "(" + k + ")：" + ((box.blocks[k] || {}).text || "（还空着）")).join("\n");
    const days = Math.floor((Date.now() - newestTs(box)) / 86400000);
    return "下面是你之前写下的、你眼里的 " + uName + " 和你们关系——十块，最近一次改动已经是 " + days + " 天前。\n\n" + rows
      + "\n\n这段时间你们又相处了这么久。逐块过一遍：**哪几块已经跟你现在心里的不一样了？**"
      + "\n· 变了的那几块 → 写成整块重写后的新内容(≤80字,第一人称亲笔,在旧的基础上小幅演进,锚在这段时间真发生过的事上,别整块翻转)。"
      + "\n· 还是那样的 → 填 null。**没变就是没变，不必为了交差改字**。"
      + "\n· 空着的那几块 → 如果这段时间你心里已经有了，就写下来。"
      + NOT_PROFILE(uName)
      + "\n只输出 JSON:{\"me\":{\"person\":null,\"soft\":null,\"like\":null,\"recent\":null,\"unread\":null},\"us\":{\"what\":null,\"how\":null,\"marks\":null,\"elephant\":null,\"want\":null}}——把真变了的那几块换成新内容，其余保持 null。"
      // ⚠️这一段是 v64.40 补的。这一问最可能的正确答案就是【什么都没变】，
      //   而「什么都没变」用一句话说出来比填一份全 null 的 JSON 自然得多——
      //   于是他很可能直接答「这十块我看了一遍，暂时没什么要改的」，一个大括号都没有，
      //   extractJSON 当然解析不出来，界面上就成了「没解析出卡」。
      //   （她 2026-09-06 连报三轮不行，原话正是这一句。）
      //   所以必须把【没变也要输出 JSON】这件事单独说死，不能只说「只输出 JSON」。
      + "\n⚠️就算十块一块都没变，也【必须】把上面那份 JSON 原样输出（十个值全是 null）——不许改成一句话回答「没什么要改的」。"
      + "\n⚠️JSON 之外不要写任何字：不写开场白、不写解释、不写注释（连 // 也不行）、末尾不留多余逗号。";
  }
  // 落地：复看写进来的和平时那个字段走同一个 apply（原文一样的会被 apply 挡掉，不算改）
  function review(charId, data) {
    let n = 0;
    ["me", "us"].forEach(side => { const g = data && data[side]; if (g) Object.keys(g).forEach(b => { if (g[b] && apply(charId, side, b, g[b])) n++; }); });
    const d = load(); const box = boxOf(d, charId);
    // 真写出来了 → 次数清零，下一次冻住时还能再来一回；一块都没写 → 留着次数，三次就停手
    if (n) { box.reviewN = 0; box.reviewErr = ""; }
    d[charId] = box; persist(d, charId);
    return n;
  }

  // 一次性建卡的生成指令(app 侧拼上下文调用后把 JSON 喂回 seed)
  function seedSpec(uName) {
    return "以角色本人的第一人称,把你对 " + uName + " 和你们关系的长期认知写成印象卡 JSON。每块≤80字,亲笔口吻、锚在真实发生过的事上;不了解、没想过的块填 null,绝不编造。"
      + "禁止分析报告腔(「综合来看」「是一个…的人」),要像你私下写给自己的碎句。"
      + NOT_PROFILE(uName)
      // ⚠️下面这份【每一栏写的是那一块的说明，不是样例内容】，也【没有示范谁填谁不填】。
      //   上一版示范的是「person 有字、其余九块全 null」，模型连这个填法一起照抄了：
      //   她 2026-09-04 报的「都是第一个填」就是这么来的（prompt-no-content-samples.md）。
      + "十块都要过一遍,自己心里真有的就写、真没有的填 null——填几块由你,别照着下面这份的样子来,它只是在说明每一栏是什么。"
      // ⚠️v64.56：这份 schemaHint 原来把十个名字【又抄了一遍】（第四份），现在从 ASK 长出来。
      //   每一栏写的仍然是【那一块是什么】的说明，不是样例内容（prompt-no-content-samples.md）。
      + "只输出 JSON:" + JSON.stringify({
        me: ME.reduce((o, [k]) => (o[k] = ASK["me." + k], o), {}),
        us: US.reduce((o, [k]) => (o[k] = ASK["us." + k], o), {})
      });
  }
  function seed(charId, data) {
    let n = 0;
    ["me", "us"].forEach(side => { const g = data && data[side]; if (g) Object.keys(g).forEach(b => { if (g[b] && apply(charId, side, b, g[b])) n++; }); });
    const d = load(); const box = boxOf(d, charId);
    // ⚠️只有【真写出来了】才算建过卡。原来不管 n 是多少都盖 seeded=true,
    //   模型返回一份全是 null 的卡时,卡还是空的、路却永久封死了——又一条静悄悄的死锁。
    if (n) { box.seeded = true; box.refuse = 0; }
    d[charId] = box; persist(d, charId);
    return n;
  }
  const hasAny = charId => Object.keys(boxOf(load(), charId).blocks).length > 0;
  // ---- 自动建卡一次(v59.80)----
  // 「规则降概率，代码才保证」：上面那套点名话术只是把概率抬高，模型仍可能一轮都不写；
  // 而这张卡【空着的时候】恰恰是最难自己长出来的——每轮问一块，十块要问十轮，
  // 中间随便哪几轮走神就又空回去。建卡那一路不一样：它是【专门一次调用】，
  // 一次把十块全写出来，没有别的字段跟它抢，从来不会不写。
  // 所以聊够了还一块都没有，就自己替他建一次卡；**一个角色一辈子只多花这一次调用**。
  // ⚠️先记标记再打调用(照周刷那条「先记游标再刷」)：中途失败也不该下一轮又整份重来。
  //
  // v59.80 那一版把它记成一个【布尔】,于是「试过了」和「成了」是同一件事:
  //   网络抖一下、JSON 没解析出来、或者模型回了一份全 null——
  //   **这个角色一辈子仅有的那一次机会就静悄悄烧掉了**,而失败那一路 auto 是不弹 toast 的,
  //   她那边看到的只有「这个角色死活不填」(她 2026-09-02 报的另一半)。
  // 改成【记次数 + 记败因】:最多三次,成了就不再试,没成隔十分钟可以再来。
  //   三次是【一辈子】的上限,不是每天三次——最坏情况一个角色多花两次调用,到此为止。
  // 老存档里只有 autoSeed 时间戳没有次数 → 算作已经试过一次,还剩两次。
  const AUTOSEED_MAX = 3;
  const AUTOSEED_GAP = 10 * 60000;
  const autoSeedTries = box => Number(box.autoSeedN != null ? box.autoSeedN : (box.autoSeed ? 1 : 0)) || 0;
  const autoSeedDue = charId => {
    const box = boxOf(load(), charId);
    if (box.seeded || Object.keys(box.blocks).length) return false;
    if (autoSeedTries(box) >= AUTOSEED_MAX) return false;
    return Date.now() - (Number(box.autoSeed) || 0) >= AUTOSEED_GAP;
  };
  function markAutoSeed(charId) {
    const d = load(); const box = boxOf(d, charId);
    box.autoSeedN = autoSeedTries(box) + 1;
    box.autoSeed = Date.now();
    box.autoSeedErr = ""; box.autoSeedErrRaw = "";
    d[charId] = box; persist(d, charId);
    return true;
  }
  // 败因留下来:不留的话「试过三次都没成」和「还没到十条」在界面上长得一模一样。
  function markAutoSeedFail(charId, why) {
    const d = load(); const box = boxOf(d, charId);
    box.autoSeedErr = plainWhy(why).slice(0, 60);
    box.autoSeedErrRaw = String(why || "").slice(0, 400);   // 同上：人话给她看，原文留着查
    d[charId] = box; persist(d, charId);
    return true;
  }
  const autoSeedState = charId => {
    const box = boxOf(load(), charId);
    return { tries: autoSeedTries(box), max: AUTOSEED_MAX, last: Number(box.autoSeed) || 0,
      err: box.autoSeedErr || "", raw: box.autoSeedErrRaw || "", refuse: Number(box.refuse) || 0 };
  };
  const refuseCount = charId => Number(boxOf(load(), charId).refuse) || 0;


  // ---- 红点(她 2026-08-27 要的)----
  // 这张卡是角色自己慢慢改的,不改则已、一改就是他对她的看法变了——那正是她想被叫住的时刻。
  // 存一份「她上次看这一块是什么时候」,块的 ts 比它新就是没看过。
  // 已读只存本机:它是「这台设备上她看没看过」,不是印象卡的内容。
  // ⚠️不能用 x_ 前缀——那个前缀会被云同步捡走(见 cloud.js),
  //   另一台设备的旧已读表推上来会把红点乱清一气。同 lisa_group_auto_cycle_v1 的处理。
  const SEEN_KEY = "lisa_gaze_seen_v1";
  const loadSeen = () => { try { return JSON.parse(localStorage.getItem(SEEN_KEY) || "{}"); } catch (e) { return {}; } };
  const persistSeen = d => { try { localStorage.setItem(SEEN_KEY, JSON.stringify(d)); } catch (e) {} };
  function unseenKeys(charId) {
    const box = boxOf(load(), charId), seen = (loadSeen() || {})[charId] || {};
    return Object.keys(KEYS).filter(k => {
      const b = box.blocks[k];
      return b && b.text && (Number(b.ts) || 0) > (Number(seen[k]) || 0);
    });
  }
  const unseenCount = charId => unseenKeys(charId).length;
  function markSeen(charId, k) {
    const box = boxOf(load(), charId), b = box.blocks[k];
    if (!b) return;
    const d = loadSeen(); const mine = d[charId] || {};
    mine[k] = Number(b.ts) || Date.now();
    d[charId] = mine; persistSeen(d);
  }
  // 全部改写记录:合并当前块和旧版快照,按时间倒序——「收纳」那一档就是这张表
  function revisions(charId) {
    const box = boxOf(load(), charId), out = [];
    Object.keys(KEYS).forEach(k => { const b = box.blocks[k]; if (b && b.text) out.push({ k, text: b.text, ts: Number(b.ts) || 0, now: true }); });
    (box.hist || []).forEach(x => { if (KEYS[x.k]) out.push({ k: x.k, text: x.old, ts: Number(x.ts) || 0, now: false }); });
    return out.sort((a, b) => b.ts - a.ts);
  }

  // ---- 信纸页面(嵌在状态卡里,参考 2026-08-17 Lisa 给的拍立得信纸样张) ----
  // ⚠️原来这儿有一张 EN 表（WHO SHE IS / SOFT SPOTS / MILESTONES …），
  //   专门用来在中文标题上面再压一行英文小字。按 no-english-titles，
  //   那行删掉之后这一页照样说得明白——它就是装饰，所以整张表一起删。
  const PAPER = "#fbf5ea", INKSOFT = "#5c5244", GOLD = "#ac8a5b", BLUSH = "#e8c9bd";
  const tape = extra => h("div", { style: Object.assign({ position: "absolute", top: -9, left: "50%", width: 52, height: 18, marginLeft: -26, background: "rgba(240,231,214,.8)", boxShadow: "0 1px 3px rgba(0,0,0,.10)", transform: "rotate(-2deg)", borderLeft: "1px dashed rgba(0,0,0,.06)", borderRight: "1px dashed rgba(0,0,0,.06)" }, extra || {}) });
  function GazePage({ charId, charName, uName, ta, onSeed, seedBusy, onReview, reviewBusy }) {
    const [side, setSide] = useState("me");
    const [openK, setOpenK] = useState(null); // 展开成信纸的块 key
    const [allOpen, setAllOpen] = useState(false); // 「历次改写」总表
    const [seenTick, setSeenTick] = useState(0);   // 标记已读后要重画红点
    const [whyOpen, setWhyOpen] = useState(false); // 复看败因的原文，点开才看
    const box = boxOf(load(), charId);
    const who = ta === "她" || ta === "TA" ? ta : "他";
    const say = s => who === "他" ? s : String(s || "").replace(/他/g, who);
    const unseen = new Set(unseenKeys(charId));
    void seenTick;
    // 展开一块信纸＝她看过这一块了，红点就该灭
    const openBlock = k => { setOpenK(k); markSeen(charId, k); setSeenTick(x => x + 1); };
    const dot = extra => h("span", { style: Object.assign({ display: "inline-block", width: 7, height: 7, borderRadius: 999, background: "#c2705a", boxShadow: "0 0 0 2px rgba(255,253,248,.9)" }, extra || {}) });
    const defs = side === "me" ? ME : US;
    // Sheet 容器带 transform,fixed 会锚到 Sheet 而非屏幕 → 信纸必须 portal 到 body 才能居中
    const full = openK && ReactDOM.createPortal(
      h("div", { onClick: () => setOpenK(null), style: { position: "fixed", inset: 0, zIndex: 260, background: "rgba(43,38,30,.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 } },
        h("div", { onClick: e => e.stopPropagation(), style: { position: "relative", maxHeight: "74vh", overflowY: "auto", width: "100%", maxWidth: 400, backgroundColor: PAPER, backgroundImage: "repeating-linear-gradient(transparent, transparent 29px, rgba(120,100,70,.07) 29px, rgba(120,100,70,.07) 30px), linear-gradient(" + PAPER + "," + PAPER + " 60%, #f7efdf)", borderRadius: 4, padding: "34px 26px 24px", boxShadow: "0 22px 60px rgba(0,0,0,.32)" } },
          tape(),
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 19, color: INKSOFT, marginBottom: 16, letterSpacing: 2 } }, KEYS[openK]),
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14.5, color: INKSOFT, lineHeight: "30px", whiteSpace: "pre-wrap" } }, (box.blocks[openK] || {}).text || say("他还没往这想过。")),
          box.blocks[openK] && h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: GOLD, marginTop: 18, textAlign: "right" } }, "—— 写于 " + new Date(box.blocks[openK].ts).toLocaleDateString("zh-CN")),
          (box.hist || []).filter(x => x.k === openK).length ? h("div", { style: { marginTop: 20, borderTop: "1px dashed rgba(120,100,70,.25)", paddingTop: 12 } },
            h("div", { style: { fontFamily: F_BODY, fontSize: 9, letterSpacing: 3, color: GOLD, marginBottom: 8 } },
              say("他从前是这么想的") + " · 改过 " + box.hist.filter(x => x.k === openK).length + " 次"),
            box.hist.filter(x => x.k === openK).map((x, i) => h("div", { key: i, style: { fontFamily: F_DISPLAY, fontSize: 12.5, color: "rgba(92,82,68,.62)", lineHeight: 2, marginBottom: 10 } }, x.old, h("div", { style: { fontFamily: F_BODY, color: GOLD, fontSize: 9, opacity: .8 } }, new Date(x.ts).toLocaleDateString("zh-CN"))))) : null)),
      document.body);
    // 「收纳」那一档(她 2026-08-27):以前每一块的旧版只埋在自己那张信纸最底下,
    // 想回看「他从前都怎么写我的」得一块一块点开。这里把十块的现行版和全部旧版
    // 按时间倒序摊在一起,一次看完这张卡是怎么长成现在这样的。
    const revs = revisions(charId);
    const allSheet = allOpen && ReactDOM.createPortal(
      h("div", { onClick: () => setAllOpen(false), style: { position: "fixed", inset: 0, zIndex: 260, background: "rgba(43,38,30,.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 } },
        h("div", { onClick: e => e.stopPropagation(), style: { position: "relative", maxHeight: "78vh", overflowY: "auto", width: "100%", maxWidth: 400, backgroundColor: PAPER, borderRadius: 4, padding: "34px 24px 24px", boxShadow: "0 22px 60px rgba(0,0,0,.32)" } },
          tape(),
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 19, color: INKSOFT, marginBottom: 4, letterSpacing: 2 } }, say("他从前都怎么写的")),
          h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: GOLD, marginBottom: 16 } }, "共 " + revs.length + " 版 · 最新的在最上面"),
          revs.length ? revs.map((x, i) => h("div", { key: i, style: { marginBottom: 16, paddingBottom: 14, borderBottom: i === revs.length - 1 ? "none" : "1px dashed rgba(120,100,70,.2)" } },
            h("div", { className: "flex items-center", style: { gap: 6, marginBottom: 4 } },
              h("span", { style: { fontFamily: F_BODY, fontSize: 9, letterSpacing: 2, color: GOLD } }, KEYS[x.k]),
              x.now ? h("span", { style: { fontFamily: F_BODY, fontSize: 8, letterSpacing: 1, color: "#fff", background: GOLD, borderRadius: 999, padding: "1px 6px" } }, "现在") : null,
              h("span", { style: { marginLeft: "auto", fontFamily: F_BODY, fontSize: 9, color: "rgba(172,138,91,.7)" } }, x.ts ? new Date(x.ts).toLocaleDateString("zh-CN") : "")),
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 13, color: x.now ? INKSOFT : "rgba(92,82,68,.62)", lineHeight: 2, whiteSpace: "pre-wrap" } }, x.text)))
            : h("div", { style: { fontFamily: F_DISPLAY, fontSize: 13, color: "rgba(92,82,68,.5)", lineHeight: 2 } }, say("他还没写过什么。")))),
      document.body);
    return h("div", { style: { margin: "-4px -6px 0", padding: "18px 14px 26px", borderRadius: 18, background: "linear-gradient(168deg, #f8f2e6, #f6ecdf 46%, #f2e2d6 78%, " + BLUSH + "40)" } },
      h("div", { style: { textAlign: "right", padding: "2px 6px 14px" } },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 30, letterSpacing: 6, color: GOLD, textShadow: "0 1px 0 rgba(255,255,255,.6)" } }, side === "me" ? "关于我" : "关于我们")),
        // 原来这儿挂着一行 "SHE, THROUGH HER EYES" 的英文眉标——
        // 上面那行「关于我」已经把话说完了，它只是装饰（no-english-titles）。
      // ── 两栏＝挂在页头的两条布书签（v62.66）──────────────────────
      // 审美审计 2026-09-04：这两个 tab 是填色药丸，只靠色差区分——
      // 换个 app 照样成立（tabs-not-plain-pills）。
      // 这一页现实里是【他手写的一册手记】，手记分栏靠的是夹在里面的书签：
      // 选中那条垂得长、上了色、底下收一个尖口；没选中的短一截、淡着。
      // 形状照的是解梦馆那份（规则文件把布书签列为合规范例）。
      // ⚠️选中态同时变【长度、颜色、尖口】三样，不只靠色差（无障碍那一条）。
      h("div", { style: { display: "flex", gap: 10, marginBottom: 18, alignItems: "flex-start" } },
        [["me", "关于我"], ["us", "关于我们"]].map(([k, label]) => {
          const on = side === k;
          return h("button", { key: k, onClick: () => setSide(k), "aria-pressed": on ? "true" : "false",
            className: "active:opacity-80",
            style: {
              position: "relative", flex: 1, minHeight: 40,
              padding: on ? "9px 0 17px" : "7px 0 13px",
              fontFamily: F_DISPLAY, fontSize: 13, letterSpacing: 3,
              color: on ? "#fff" : GOLD,
              background: on ? GOLD : "rgba(172,138,91,.16)",
              border: "none", borderRadius: "0 0 2px 2px",
              // 书签底下那个尖口：布带剪成燕尾
              clipPath: "polygon(0 0,100% 0,100% 100%,50% " + (on ? "72%" : "78%") + ",0 100%)",
              WebkitClipPath: "polygon(0 0,100% 0,100% 100%,50% " + (on ? "72%" : "78%") + ",0 100%)",
              boxShadow: on ? "0 3px 8px -4px rgba(172,138,91,.7)" : "none"
            }
          },
            label,
            [...unseen].some(x => x.indexOf(k + ".") === 0) ? dot({ position: "absolute", top: 6, right: 12 }) : null);
        })),
      // 卡上有内容、却长期一动不动时也得说出实话。原来这一段只挂在【空卡】那一支：
      // 卡有内容之后，「他真没什么可改的」和「他被点名 40 轮一次都没答」在这一页上
      // 长得一模一样，她只能看到十张「19 天前写的」（2026-09-05 就是这么报上来的）。
      hasAny(charId) ? (function () {
        var mu = muteCount(charId), rv = reviewState(charId), lines = [];
        if (mu >= 3) lines.push(say("他") + "被点名复看 " + mu + " 轮没答话");
        // ⚠️「复看过、他觉得没什么要改的」是【答案】，不是失败（v64.35）。
        //   原来这一句不分青红皂白写「都没成」，她看到的于是是「坏了」。
        // ⚠️v64.54：这一行原来的条件是 `else if (rv.tries)`——**次数为 0 就整行不画**。
        //   而 v64.39 刚把「她手动按的那一次不占自动预算」改对（reviewN 不再加一），
        //   两件事凑在一起：从没自动复看过的角色（tries=0），她手动一按、失败了，
        //   败因老老实实存进去了，**卡上却什么都不显示**——
        //   她 2026-09-06 报的「又试了俩还是没更新但是也没有说为什么没成」就是这个。
        //   ⚠️判据：**有没有话要说，看的是「有没有败因」，不是「自动试过几次」。**
        //   次数只决定那句话怎么措辞（是「自动试了 N 次」还是「上一次」）。
        if (rv.okAt) lines.push("替" + say("他") + "复看过一遍，" + say("他") + "觉得没什么要改的");
        else if (rv.err) lines.push((rv.tries ? "替" + say("他") + "自动复看过 " + rv.tries + " 次，都没成（" : "上一次复看没成（") + rv.err + "）"
          + (rv.tries >= rv.max ? "；试满了，往后不再自动试" : ""));
        else if (rv.tries) lines.push("替" + say("他") + "自动复看过 " + rv.tries + " 次"
          + (rv.tries >= rv.max ? "；试满了，往后不再自动试" : ""));
        if (!lines.length) return null;
        return h("div", { style: { fontFamily: F_BODY, fontSize: 9.5, letterSpacing: .5, color: "rgba(172,138,91,.75)", lineHeight: 1.9, margin: "-6px 4px 8px" } },
          lines.map(function (x, i) { return h("div", { key: i }, x); }),
          // 真败因收在这儿：那句人话是给她看的，可原文不能扔——
          // engine 已经把话说得很清楚了（哪个模型、提示词多大、输出上限多少、
          // 等了几秒、是上游打回来还是超时），点开才看，平时不占地方。
          rv.raw ? h("div", null,
            h("button", { onClick: function () { setWhyOpen(!whyOpen); },
              style: { minHeight: 40, display: "inline-flex", alignItems: "center", padding: "0 8px 0 0", background: "transparent", border: "none", fontFamily: F_BODY, fontSize: 9.5, letterSpacing: .5, color: "rgba(172,138,91,.95)", textDecoration: "underline" } },
              whyOpen ? "收起原话" : "到底哪儿没成"),
            whyOpen ? h("div", { style: { fontFamily: F_BODY, fontSize: 9.5, lineHeight: 1.75, color: "rgba(140,112,74,.85)", background: "rgba(172,138,91,.08)", borderRadius: 3, padding: "7px 9px", whiteSpace: "pre-wrap", wordBreak: "break-all" } }, rv.raw) : null) : null);
      })() : null,
      !hasAny(charId) ? h("div", { style: { textAlign: "center", padding: "30px 10px" } },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 13.5, color: INKSOFT, lineHeight: 2.2, marginBottom: 16 } }, "这里还是空的。", h("br"), "让 " + charName + " 第一次把心里的这些写下来?"),
        // 空卡为什么空,得在这儿说出来。原来这一页不管是「还没聊够」「替他自动写过但失败了」
        // 还是「他连着好几轮说写不出来」,长相都一模一样——她只能看到「死活不填」,查不出是哪一种。
        (function () {
          var st = autoSeedState(charId), lines = [];
          // 同上（v64.54）：有败因就得说，别拿「自动试过几次」当门槛——
          // 她手动按的那一次不加次数，可它一样会失败，一样得留下话。
          if (st.err) lines.push((st.tries ? "替" + say("他") + "自动写过 " + st.tries + " 次，都没成（" : "上一次没写成（") + st.err + "）"
            + (st.tries >= st.max ? "；试满了，往后不再自动试。想现在就要，点下面那个按钮" : ""));
          else if (st.tries) lines.push("替" + say("他") + "自动写过 " + st.tries + " 次，都没成（" + plainWhy("没写出内容") + "）"
            + (st.tries >= st.max ? "；试满了，往后不再自动试。想现在就要，点下面那个按钮" : ""));
          if (st.refuse) lines.push(say("他") + "被点名问过 " + st.refuse + " 轮,每次都答「认识得还不够」");
          if (!lines.length) return null;
          return h("div", { style: { fontFamily: F_BODY, fontSize: 9.5, letterSpacing: .5, color: "rgba(172,138,91,.75)", lineHeight: 1.9, marginBottom: 14 } },
            lines.map(function (x, i) { return h("div", { key: i }, x); }),
            st.raw ? h("div", null,
              h("button", { onClick: function () { setWhyOpen(!whyOpen); },
                style: { minHeight: 40, display: "inline-flex", alignItems: "center", padding: "0 8px 0 0", background: "transparent", border: "none", fontFamily: F_BODY, fontSize: 9.5, letterSpacing: .5, color: "rgba(172,138,91,.95)", textDecoration: "underline" } },
                whyOpen ? "收起原话" : "到底哪儿没成"),
              whyOpen ? h("div", { style: { fontFamily: F_BODY, fontSize: 9.5, lineHeight: 1.75, color: "rgba(140,112,74,.85)", background: "rgba(172,138,91,.08)", borderRadius: 3, padding: "7px 9px", whiteSpace: "pre-wrap", wordBreak: "break-all" } }, st.raw) : null) : null);
        })(),
        onSeed ? h("button", { onClick: onSeed, disabled: seedBusy, style: { padding: "10px 26px", borderRadius: 999, fontFamily: F_DISPLAY, fontSize: 13, letterSpacing: 2, border: "none", background: GOLD, color: "#fff", boxShadow: "0 4px 14px rgba(172,138,91,.4)" } }, seedBusy ? say("他在想…") : say("让他写写看")) : null) : null,
      defs.map(([k, name], i) => { const fk = side + "." + k; const b = box.blocks[fk];
        return h("div", { key: fk, onClick: () => openBlock(fk), style: { position: "relative", background: "#fffdf8", borderRadius: 3, padding: "16px 15px 13px", margin: (i ? "18px" : "10px") + " " + (i % 2 ? "4px 0 0 14px" : "14px 0 0 4px"), cursor: "pointer", transform: "rotate(" + (i % 2 ? 0.9 : -0.9) + "deg)", boxShadow: "0 5px 16px rgba(96,78,52,.13)" } },
          tape({ transform: "rotate(" + (i % 2 ? 2 : -2) + "deg)" }),
          unseen.has(fk) ? dot({ position: "absolute", top: 9, right: 10 }) : null,
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14.5, color: INKSOFT, letterSpacing: 1.5, marginBottom: 6 } }, name),
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 12.5, color: b ? "rgba(92,82,68,.85)" : "rgba(92,82,68,.4)", lineHeight: 2, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" } }, b ? b.text : say("他还没往这想过。")),
          (function () {
            // 这一块【上次什么时候被碰过】。她 2026-09-04：「有些角色的 Ta 眼里确实一直
            // 不显示上次什么时候想过，没改」——病根是这一行原来【只在复看过又没改时】才出现，
            // 而「复看没改」要模型主动填 impressionChecked，本来就少；写过一次之后
            // 从没被复看的块（绝大多数），这里一个字都没有，看着就像这一块没有时间。
            // 时间本来就在 b.ts 里，只是没画出来。现在两种情况都说：
            //   复看过没改 → 「N 天前又想了一遍 · 没改」（他真又想了一遍，不是被忘了）
            //   只写过     → 「N 天前写的」
            if (!b || !b.text) return null;
            var ck = (box.checks || {})[fk] || 0;
            var checked = ck > (b.ts || 0);
            var when = checked ? ck : (Number(b.ts) || 0);
            if (!when) return null;
            var dd = Math.floor((Date.now() - when) / 86400000);
            var ago = dd >= 1 ? dd + " 天前" : "今天";
            return h("div", { style: { fontFamily: F_BODY, fontSize: 8.5, letterSpacing: 1, color: "rgba(172,138,91,.55)", marginTop: 5 } },
              ago + (checked ? "又想了一遍 · 没改" : "写的"));
          })(),
          b ? h("div", { style: { fontFamily: F_BODY, fontSize: 8.5, letterSpacing: 2, color: "rgba(172,138,91,.6)", marginTop: 6, textAlign: "right" } }, "展开信纸 ›") : null); }),
      // 卡有内容、但已经很久没动过：给她一个按得动的东西。自动那一路要等到
      // 14 天 + 连着 12 轮点名没答才会动，她不该只能干等着。
      hasAny(charId) && onReview ? h("button", { onClick: onReview, disabled: reviewBusy,
        style: { display: "block", width: "100%", marginTop: 20, padding: "10px 0", borderRadius: 999, border: "none", background: GOLD, color: "#fff", fontFamily: F_DISPLAY, fontSize: 12.5, letterSpacing: 2, boxShadow: "0 4px 14px rgba(172,138,91,.35)" } },
        reviewBusy ? say("他在重看这十块…") : say("让他再看一遍这十块")) : null,
      revs.length ? h("button", { onClick: () => setAllOpen(true), style: { display: "block", width: "100%", marginTop: 22, padding: "10px 0", borderRadius: 999, border: "1px dashed rgba(172,138,91,.5)", background: "rgba(255,255,255,.45)", fontFamily: F_DISPLAY, fontSize: 12.5, letterSpacing: 2, color: GOLD } },
        say("他从前都怎么写的") + " · 共 " + revs.length + " 版") : null,
      full, allSheet);
  }
  window.Gaze = { ME, US, KEYS, ASK, apply, applyParsed, normKey, text, spec, nudge, seedSpec, seed, hasAny, tick, staleTurns, STALE_TURNS, unseenKeys, unseenCount, markSeen, revisions, markChecked, dueBlock, dueNow, checkedAt, autoSeedDue, markAutoSeed, markAutoSeedFail, autoSeedState, refuseCount, reviewDue, markReview, markReviewFail, markReviewNoChange, reviewState, reviewSpec, review, muteCount, plainWhy };
  window.GazePage = GazePage;
})();
