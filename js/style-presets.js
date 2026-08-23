// ============================================================
// 文风预设台 · 数据层（style presets）
//
// 一处生产、三处消费：预设在这里搭好，线下 / 小剧场 / 同人文各自决定「吃不吃」。
// 不吃＝三处的行为和以前一模一样，一个字都不变（consumer 里全部走 presetOn 开关）。
//
// 为什么会有这个东西（Lisa 2026-08-23）：她发现小剧场的正文反而比线下干净。
// 查下来原因不是「小剧场没规矩」，恰恰相反——小剧场比单人线下【多】吃了五条：
// NARRATIVE_ANTI_CLICHE、INTIMATE_ANTI_CLICHE、镜头不随人物收缩、成段不要一句一行、
// 一次只演一拍。而线下一条都没有，还额外背着记忆库/行程/前情/霜骨一大堆事实块跟它抢权重。
// 所以这里做的第一件事，就是把那几条从小剧场里【原样】抽出来当模块，让线下也吃得到。
// 抽出来的是同一份字符串（下面三个常量），theater.js 直接引用，不留第二份会飘的副本。
// ============================================================
(function () {
  const KEY = "x_stylePresets";
  const MKEY = "x_styleModules";   // 她自己导入的模块（酒馆预设拆出来的那种）
  const RUNS = "x_styleLabRuns";

  // ---- 从 theater.js 原样抽出来的三条（它现在引用这里，字面量只此一份）----
  const SM_BEAT = uName => "【节拍】一次回复只演【一拍】:你的一个反应、至多一次行动和随之的话;演到需要 " + uName + " 回应、选择或行动的位置就自然停下。不把几个情绪阶段压进同一拍(震惊、想通、劝阻、逼问要分几个来回演),不替 Ta 说出 Ta 没说出口的意图,也不自问自答替 Ta 推进。一拍限制的是【剧情推进量】,不是篇幅——同一拍之内照样要写足。";
  const SM_CAMERA = "【镜头不随人物收缩】角色的克制是【台词】的克制,不是【镜头】的克制。他话少、冷淡、不外露,恰恰意味着叙述要接住更多:说这句话之前先做完的那个动作、停顿的那一下、手上正在做的事、他注意到却没提起的东西、身体先于话给出的反应。绝不能因为他是个冷淡的人就把段落缩成「我看着你。」——那不是克制,那是没写;他不说的部分必须在纸面上有分量。每句台词旁边至少要有一处具体的、看得见的动作或环境细节;但也不许拿华丽形容词和情绪副词充数,要的是具体物件与动作,不是修饰。";
  const SM_PARAGRAPH = "【成段,不要一句一行】把动作、感觉、台词织进【连续的段落】里,一段通常三五句连着写;绝不要每写一句就换行空一段——一句一段会让整场戏看起来支离破碎、像剧本提纲而不是小说。「我看着你。」「我停了一下。」这种单句尤其不许独立成段,要么并进前后的叙述里,要么就删掉。只有真正需要一个停顿感的关键处,才允许一句独立成段,一整拍里至多用一次。\n【别学历史的排版】前文里如果全是短句短段,那是旧毛病,不是范例:照上面的要求写,不要模仿它。";

  // ---- 模块库 ----
  // text 可以是字符串，也可以是 ctx => 字符串（需要用户名/角色名时）。
  // builtinIn 列出「这个消费方本来就已经无条件塞过了」的场合——在那儿会被自动跳过，
  // 免得同一条规矩在一个 prompt 里出现两遍（重复的规矩不会更管用，只会挤掉别的）。
  const CATS = [
    {
      id: "camera", zh: "镜头", hint: "写的时候镜头往哪儿放、看多近",
      mods: [
        { id: "cam_no_shrink", name: "镜头不随人物收缩", hint: "冷淡的人不等于短段落——他不说的部分要在纸面上有分量", text: SM_CAMERA, builtinIn: ["theater"] },
        { id: "cam_hands", name: "近景在手上", hint: "优先写手正在摆弄的具体物件，而不是脸上的表情", text: "【近景在手上】每一段里至少有一次把镜头落到【手正在做的事】上:拿着什么、怎么拿的、放下时碰到了什么、指腹蹭到的是哪种材质。人物的状态先从手上泄出来,再轮到脸和话。不要连着写两段「他看着我」「我看着他」——视线不是动作,手才是。" },
        { id: "cam_offstage", name: "画外", hint: "让不在场的东西通过声音和痕迹存在", text: "【画外】这个场景不止有你们两个人份的空气:隔壁的动静、外面的车、锅里还在响的东西、没关的窗、上一个人留下的痕迹——每一拍允许有一到两处来自画外的信息进来,它们不需要被解释,出现过就行。但不要为了有氛围而持续往里加新的声音光影,画外是偶尔漏进来的,不是背景音轨。" }
      ]
    },
    {
      id: "layout", zh: "排版", hint: "段落长什么样、标点怎么用",
      mods: [
        { id: "lay_paragraph", name: "成段，不要一句一行", hint: "一段三五句连着写，别写成剧本提纲", text: SM_PARAGRAPH, builtinIn: ["theater"] },
        { id: "lay_no_markdown", name: "不用 markdown", hint: "禁止 *动作* 星号、井号标题、分隔线", text: "【纯散文格式】正文里不许出现任何标记语言:不用星号包动作(*他笑了*)、不用井号标题、不用分隔线、不用列表符号、不用粗体斜体。动作和心理直接写进句子里,靠语言本身区分,不靠符号。" },
        { id: "lay_dialogue_quote", name: "对话用引号", hint: "台词一律「」或“”，不用破折号引导", text: "【对话格式】所有说出口的话一律用引号包起来;没说出口的想法不加引号、也不用括号标注。不要用破折号引导台词,不要把台词单独顶格排成剧本。" },
        { id: "lay_no_period", name: "句尾不硬凑句号", hint: "该断就断，不为整齐而补标点", text: "【标点跟着语气走】不要为了整齐给每句都补上句号:话说到一半被打断就断在那里,气没喘匀就用逗号连下去,一个词能成一句就让它成一句。省略号和破折号有实际用处时才用,不要拿来充节奏。" }
      ]
    },
    {
      id: "beat", zh: "节拍", hint: "一次推进多少、在哪儿停",
      mods: [
        { id: "beat_one", name: "一次只演一拍", hint: "演到需要对方行动的位置就停", text: ctx => SM_BEAT((ctx && ctx.uName) || "对方"), builtinIn: ["theater"] },
        { id: "beat_no_closer", name: "不写收尾句", hint: "最后一句不许是总结、感慨或情绪定调", text: "【不写收尾句】一段的最后一句不许是总结、不许是感慨、不许给这一拍下情绪定语(「那一刻我忽然明白…」「空气里只剩下…」「有些东西已经不一样了」这类一概不要)。就停在最后一个真实发生的动作或一句话上,哪怕看起来没收住——没收住是对的,生活本来就不给收尾句。" },
        { id: "beat_uneven", name: "节奏不匀", hint: "允许一段很长一段很短，不平均分配", text: "【节奏不匀】不要每段都写成差不多的长度。真正在发生事的地方可以写很长,过场的地方两句就够。不许按「环境一句→动作一句→心理一句→台词一句」的固定配比轮流交作业;这一刻值得停留在哪儿就停留在哪儿,别的部分允许一笔带过。" }
      ]
    },
    {
      id: "anticliche", zh: "去八股", hint: "把最常见的几套模板明确点名禁掉",
      mods: [
        { id: "ac_no_ceo", name: "别滑进霸总腔", hint: "点名禁掉攥手腕/往怀里带/冷笑/挑眉那一整套", text: "【别滑进霸总腔】下面这些是网文霸总的【现成模板】,一律不许用:\n· 动作模板:攥住/扣住手腕、捏下巴抬起脸、往怀里带/揽进怀里、拦在身前、抵在墙上、拇指碾过腕骨或唇角、手指收紧。\n· 表情模板:冷笑、嗤笑、挑眉、勾唇、眯起眼、没什么温度的笑、眼底暗了暗。\n· 句式模板:「他没说话,只是……」「空气瞬间凝固」「他的声音低了下来」「不容拒绝地」「不由分说」。\n· 旁白模板:替人物盖章定性(「这个男人向来说一不二」「他从不解释」)。\n禁的是【模板】,不是强势的人物:他照样可以强硬、可以动手、可以不讲道理——但要用这个人自己会做的具体动作去写,不许套上面这几张现成的皮。" },
        { id: "ac_no_label", name: "不给情绪贴标签", hint: "写征兆，不写结论", text: "【不给情绪贴标签】不许直接写出情绪的名字(愤怒、失落、慌乱、心疼、委屈、释然…),也不许用「他感到…」「她意识到…」这种句式把结论端出来。只写征兆:动作变了、说话的速度变了、手上的事停了、注意力跑到别处去了。读者自己会读出来;你一说出名字,那份情绪就死了。" },
        { id: "ac_no_organ", name: "器官式反应", hint: "心脏漏拍/喉结滚动/瞳孔骤缩，全禁", text: "【器官式反应一概不要】心脏漏了一拍、心跳骤停、喉结滚动、瞳孔骤缩、呼吸一滞、血液冲上头顶、耳根发烫、后背发凉、指尖发麻——这一整类拿器官当情绪计量表的写法全部禁用。身体反应要写就写具体的、有来由的:手上的东西没拿稳、往后退了半步、把话咽回去改了个说法。" },
        { id: "ac_metaphor_quota", name: "比喻限量", hint: "一段最多一个，且必须来自这个人真的见过的东西", text: "【比喻限量】一整段最多一个明喻或暗喻,超了就删。用的喻体必须是【这个人物在他的生活里真的见过的东西】——他没进过实验室就别用显微镜作比,没见过海就别写像潮水。宁可不打比方,直接把那个东西本身写清楚。" },
        { id: "ac_no_echo", name: "不重说一遍", hint: "同一个意思不许换个说法再写一次", text: "【不重说一遍】一个意思写过一次就不要再换个说法写第二次。写了动作就不要再用旁白解释这个动作说明了什么;写了台词就不要再补一句它其实是什么意思。段落里每出现一句「也就是说/换句话说/仿佛在说」性质的句子,就删掉它。" }
      ]
    },
    {
      id: "craft", zh: "笔法", hint: "具体怎么下笔的技法",
      mods: [
        { id: "craft_object", name: "具体名词优先", hint: "能用名词就不用形容词", text: "【具体名词优先】能用一个具体的名词说清的,就不要用形容词堆:不写「昂贵的香水味」写它是什么味道,不写「破旧的房间」写墙上那块起皮的地方。每段里形容词的总数应该少于名词和动词;删掉一个形容词句子还成立,那它就该删。" },
        { id: "craft_subtext", name: "台词带潜台词", hint: "人说的从来不是他真正想说的", text: "【台词带潜台词】人在意的事很少直接说出口。台词优先写成【绕开真正想说的那句】:问一件不相干的小事、挑一个无关紧要的毛病、答非所问、忽然说起别的。真正的意思由这个绕法本身透出来。整场里至多允许一句人物真的把心里话直说,而且要留到值得的位置。" },
        { id: "craft_env_actor", name: "环境参与", hint: "环境不是布景板，要真的干扰到人", text: "【环境参与】环境不是描写完就撂在一边的布景:它要在这一拍里真的干扰到人——东西倒了得去扶、水开了得去关、有人经过就得压低声音、光太暗就得凑近才看得清。每次写环境都要问一句「它让谁改变了动作」,答不上来就别写。" },
        { id: "craft_body_first", name: "身体先于话", hint: "先有反应，后有决定说什么", text: "【身体先于话】人先有身体反应,再决定说什么。写一句台词之前,先给出说这句话之前那半秒身体做了什么:停下手里的事、换了个站姿、把视线移开、咽了一下才开口。顺序不许倒过来——不要先说完话再补一个动作当装饰。" },
        { id: "craft_time_texture", name: "时间有质感", hint: "等待和间隔要真的被写出来", text: "【时间有质感】等待、沉默和间隔要占真实的篇幅,不许用「过了一会儿」「许久」一笔带过。这几秒里有东西在继续走:锅还在响、雨还在下、他手上的活没停。让读者跟着一起等完那段时间,而不是被通知时间过去了。" },
        { id: "craft_withhold", name: "有意不写", hint: "最重的那句留白，让读者自己补", text: "【有意不写】整场里最重的那个意思,不要写出来。铺到它明明白白摆在那儿的时候就停手——换个动作、岔开话题、让人物去做点别的。留白不是省略信息,是把已经足够清楚的东西交给读者自己完成;每场至少要有一处这样的地方。" }
      ]
    },
    {
      id: "voice", zh: "声音", hint: "叙述者是谁、他怎么称呼人",
      mods: [
        { id: "voice_register", name: "称谓锚", hint: "不用「这女人/那家伙/这丫头」这类类型化叫法", text: "【称谓锚】心里想到对方时,用这个人物【自己真的会用】的称呼——名字、小名、或者他习惯的那个叫法。「这女人」「那女人」「这丫头」「这小东西」「那家伙」这类类型化的叫法一律不许出现,除非人设里写明了他就是这么叫她的。这一条在内心独白和心声里尤其要守,那正是网文腔最容易钻进来的地方。" },
        { id: "voice_no_narrator", name: "叙述者不评价", hint: "叙述者只呈现，不给人物盖章", text: "【叙述者不评价】叙述的那个声音只负责呈现,不负责评判:不许出现「他这个人向来…」「她大概是这世上最…」这种替人物盖章的句子,也不许由叙述来夸自己笔下的人好看、厉害、危险。人物是什么样,让他做的事说明。" }
      ]
    },
    {
      id: "intimacy", zh: "亲密戏", hint: "尺度上去之后最容易垮的几处",
      mods: [
        { id: "int_no_purple", name: "不写紫色散文", hint: "尺度上来了，形容词反而要更少", text: "【不写紫色散文】亲密段落里形容词和比喻要比平时【更少】,不是更多。禁止用「灭顶」「席卷」「支离破碎」「化成一滩水」这类夸张动词和整段的抽象排比。越到这种时候越写具体:谁在哪儿、手放在什么位置、衣服卡在哪里、谁先停下来的。" },
        { id: "int_concrete", name: "靠动作推进", hint: "亲密戏也是有先后顺序的具体事件", text: "【亲密戏也靠动作推进】它和别的场景一样是一连串有先后、有因果的具体动作,不是一团情绪。每一步都要能说清是谁做的、下一步为什么是这一步。中间照样可以有笨拙、有打断、有说错话、有停下来问一句——那些才是让它像真的发生过的东西。" },
        { id: "int_after", name: "留出之后", hint: "别在高点收尾，写完之后那几分钟", text: "【留出之后】不要停在最高的那一下。写完之后那几分钟:谁先起来的、谁去关的灯、话是怎么重新接上的、有没有人假装刚才没发生。收在这里比收在高点更有余味。" }
      ]
    }
  ];

  const MODULES = {};
  CATS.forEach(c => c.mods.forEach(m => { MODULES[m.id] = Object.assign({ cat: c.id }, m); }));

  // ---- 存取 ----
  const loadJ = (k, d) => { try { return typeof loadJSON === "function" ? loadJSON(k, d) : JSON.parse(localStorage.getItem(k) || JSON.stringify(d)); } catch (e) { return d; } };
  const saveJ = (k, v) => { try { if (typeof saveJSON === "function") saveJSON(k, v); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { throw new Error("存不下了，可能是本地存储满了"); } };

  // ---- 她自己导入的模块 ----
  // 内置模块是我写的，改不了；导入的模块跟它们平级：一样能勾、能排序、能删。
  // 单独存一个键，这样内置那份以后我改版不会把她导的东西冲掉。
  function userModules() {
    const a = loadJ(MKEY, []);
    return (Array.isArray(a) ? a : []).filter(m => m && m.id && String(m.text || "").trim());
  }
  function saveUserModules(next) { saveJ(MKEY, next || []); return next || []; }
  function removeUserModule(id) { return saveUserModules(userModules().filter(m => m.id !== id)); }
  function moduleById(id) {
    if (MODULES[id]) return MODULES[id];
    return userModules().find(m => m.id === id) || null;
  }
  // 内置分类 + 导入分类（按 cat 归堆，顺序按第一次出现）
  function allCats() {
    const out = CATS.slice();
    const seen = {};
    userModules().forEach(m => {
      const id = m.cat || "imported";
      if (!seen[id]) { seen[id] = { id: id, zh: m.catZh || "我导入的", hint: m.catHint || "", mods: [], user: true }; out.push(seen[id]); }
      seen[id].mods.push(m);
    });
    return out;
  }
  // 导入一整包：{ modules:[{id?,cat?,catZh?,name,hint?,text}], presets:[{id?,name,mods?,free?,freePos?}] }
  // id 相同就原地覆盖，同一包导两次不会变出两份。
  function importBundle(data) {
    const d = data || {};
    if (!Array.isArray(d.modules) && !Array.isArray(d.presets)) throw new Error("这个 json 里没有 modules 也没有 presets");
    let mN = 0, pN = 0;
    if (Array.isArray(d.modules) && d.modules.length) {
      const cur = userModules();
      const map = {};
      cur.forEach(m => { map[m.id] = m; });
      d.modules.forEach(function (m, i) {
        const text = String((m && m.text) || "").trim();
        const name = String((m && m.name) || "").trim();
        if (!text || !name) return;
        const id = String((m && m.id) || "").trim() || ("um_" + i + "_" + name.replace(/\s+/g, "").slice(0, 12));
        if (MODULES[id]) return;                    // 不许顶掉内置模块
        map[id] = { id: id, cat: String((m && m.cat) || "imported"), catZh: String((m && m.catZh) || "我导入的"),
          catHint: String((m && m.catHint) || ""), name: name, hint: String((m && m.hint) || "").trim() || "导入的模块", text: text, user: true };
        mN++;
      });
      saveUserModules(Object.keys(map).map(k => map[k]));
    }
    if (Array.isArray(d.presets) && d.presets.length) {
      const cur = list();
      const map = {};
      cur.forEach(p => { map[p.id] = p; });
      d.presets.forEach(function (p, i) {
        const name = String((p && p.name) || "").trim();
        if (!name) return;
        const id = String((p && p.id) || "").trim() || ("sp_imp_" + i + "_" + name.replace(/\s+/g, "").slice(0, 10));
        map[id] = { id: id, name: name, mods: Array.isArray(p.mods) ? p.mods.slice() : [],
          free: String((p && p.free) || ""), freePos: p && p.freePos === "before" ? "before" : "after", ts: 0 };
        pN++;
      });
      save(Object.keys(map).map(k => map[k]));
    }
    return { modules: mN, presets: pN };
  }

  // preset: { id, name, mods:[moduleId...]（数组顺序就是喂进去的顺序）, free:"手写/导入的整段", freePos:"before"|"after", ts }
  function list() { const a = loadJ(KEY, []); return Array.isArray(a) ? a : []; }
  function save(next) { saveJ(KEY, next || []); return next || []; }
  function byId(id) { return list().find(p => p && p.id === id) || null; }
  function upsert(p) {
    const cur = list();
    const i = cur.findIndex(x => x && x.id === p.id);
    const next = i >= 0 ? cur.map(x => x.id === p.id ? Object.assign({}, x, p) : x) : cur.concat([p]);
    save(next); return next;
  }
  function remove(id) { const next = list().filter(p => p && p.id !== id); save(next); return next; }

  // ---- 组装 ----
  // surface: "offline" | "theater" | "fanfic"。builtinIn 命中的模块在那个 surface 会被跳过。
  function textFor(preset, surface, ctx) {
    const p = typeof preset === "string" ? byId(preset) : preset;
    if (!p) return "";
    const rows = (p.mods || [])
      .map(moduleById)
      .filter(m => m && !(surface && m.builtinIn && m.builtinIn.indexOf(surface) >= 0))
      .map(m => typeof m.text === "function" ? m.text(ctx || {}) : m.text)
      .filter(x => String(x || "").trim());
    const free = String(p.free || "").trim();
    const parts = free && p.freePos === "before" ? [free].concat(rows) : rows.concat(free ? [free] : []);
    return parts.join("\n\n");
  }

  // 三处消费方共用的外壳。以前这段话在 engine.js 里抄了两份（单人线下 + 群线下），
  // 现在只此一份；末尾那句关于【本场口味】的说明是新加的：口味块挪到文风之后了，
  // 得说清它只调这一场的节奏，不许翻掉文风本身的句式规矩。
  function wrap(styleText) {
    const s = String(styleText || "").trim();
    if (!s) return "";
    return "【文风要求 · 文体层最高优先】以下这份文风由用户亲自设定，在【句式、意象、比喻、格式、节奏、禁用词、段落安排】这些【怎么写】的事情上，它高于上文任何通用叙事准则——两边冲突时一律以它为准（例如它若禁止一切明喻，那就一个「像／似的／仿佛」都不许有，上文的「每段最多一次」不作数）。\n但它管的只是文体：人称、视角归属、场景与事实的连续性、不替用户做决定这些硬规矩不受它影响。下文若还有【本场口味】，那只调这一场的节奏与关注点，不改这份文风的句式与用词规矩。\n\n" + s;
  }

  // 消费方的统一入口：开关关着就返回空串，调用处照旧走它原来的那条路。
  function blockFor(holder, surface, ctx) {
    if (!holder || !holder.presetOn || !holder.presetId) return "";
    return textFor(holder.presetId, surface, ctx);
  }

  // ---- 测试台的固定剧本 ----
  // 必须固定：换了场景就没法比较两份预设谁写得好。四个场景覆盖不同的失败模式。
  const TEST_SCENES = [
    { id: "quiet", name: "安静的一场", setting: "深夜的厨房，只开了抽油烟机上那盏灯。他在洗今天最后一只碗，水声不大。你刚从外面回来，还没换鞋。", user: "我把钥匙丢在台面上，没说话。" },
    { id: "friction", name: "有摩擦的一场", setting: "傍晚的客厅。一件说好了要办的事他没办，你今天才知道。电视开着但没人在看。", user: "「你什么时候打算告诉我？」" },
    { id: "close", name: "靠得很近的一场", setting: "散场后的车里，还没发动。外面在下小雨，雨刷没开，玻璃上全是水。", user: "我伸手把他领口那颗歪掉的扣子扶正了。" },
    { id: "walk", name: "在外面走的一场", setting: "冬天的傍晚，你们沿着一条商铺快关门的街往回走，谁都没提刚才那件事。", user: "我走慢了一点，等他跟上来。" }
  ];

  function loadRuns() { const a = loadJ(RUNS, []); return Array.isArray(a) ? a : []; }
  function pushRun(r) { const next = [r].concat(loadRuns()).slice(0, 12); saveJ(RUNS, next); return next; }
  function clearRuns() { saveJ(RUNS, []); return []; }

  // 试写一段。走和线下同一套叙事底座，但不带记忆库/行程/前情——测试台要的是
  // 干净对照：同一个人设、同一个场景、只有预设不同，输出的差别才算得上是预设的差别。
  //
  // ⚠️最低字数必须真的兑现。第一版这里是裸调一次就完，她设 1500 结果吐了 200
  // （2026-08-23）——线下有 ensureOfflineMinimumScene 兜底补写，测试台没有，
  // 于是同一个模型在两边表现完全不同，那对照就白比了。这里补一套同样的补写循环。
  const LEN_FLOOR = target => "\n【最终正文硬下限】用户设置的是最低值，不是建议：正文必须至少有 " + target
    + " 个非空白可见字符。用更多真正发生的行动、后果、判断、对话和有效场景推进达到下限；不堆形容词、不加多余比喻、不反复认证同一种感受、不把一个动作逐帧注水。";

  function visibleCount(t) {
    return typeof offlineVisibleCharCount === "function"
      ? offlineVisibleCharCount(t)
      : String(t == null ? "" : t).replace(/\s/g, "").length;
  }

  async function runTest(active, opts) {
    const o = opts || {};
    const char = o.char || {};
    const scene = o.scene || TEST_SCENES[0];
    const uName = o.uName || "你";
    const styleText = o.preset ? textFor(o.preset, "offline", { uName: uName, charName: char.name }) : "";
    const minW = Math.max(0, Number(o.minWords) || 0);
    const canStream = typeof routeCanStream === "function" ? routeCanStream(active) : false;
    const sys = [
      typeof narrativeCore === "function" ? narrativeCore({ intimate: true }) : "",
      "【文风测试台】这是一次离线试写，不属于任何真实剧情，写完就丢。别提到测试这件事。",
      "【角色人设（性格与声纹的根基）】\n" + (char.persona || char.name || "（未设定）"),
      char.appearance ? "【外貌】" + char.appearance : "",
      "【场景】" + scene.setting,
      // 「写到需要对方行动就停」和一个很高的下限是直接打架的：不说清优先级，
      // 模型会挑省事的那条听，写两百字就交卷。
      "【对方主权】" + uName + " 的行动和台词只由 Ta 本人给出，你只写「我」的言行心理与环境，不替 Ta 做动作、说台词、下决定。"
        + (minW >= 800 ? "这一条管的是【不许替对方做主】，不是让你早点收笔——本轮要一直写到下限为止，中间该有的过程一个都别略过。" : "这一段写到需要 Ta 回应的位置就自然停下。"),
      wrap(styleText),
      "【输出】用第一人称『我』完全代入「" + (char.name || "他") + "」，称对方为『你』，对话用引号，写成连续的场景正文。"
        + "只输出正文，不要 JSON、不要标题、不要任何解释。",
      minW ? LEN_FLOOR(minW) : ""
    ].filter(x => String(x || "").trim()).join("\n\n");
    const budget = t => canStream ? Math.min(20000, t) : Math.min(9000, t);

    const firstBudget = budget(Math.max(3000, Math.ceil((minW || 600) * 2.6 + 2000)));   // 思考型模型先吃一大块，别掐在半路
    let text = String(await callAI(active, sys, [{ role: "user", content: scene.user }], {
      maxTokens: firstBudget, stream: canStream, timeout: 240000
    }) || "").trim();

    const notes = [];
    // 没达标就补写，最多两次。每次都要整篇重交，不做机械拼接。
    let attempts = 0;
    while (minW && attempts < 2 && visibleCount(text) < minW) {
      attempts++;
      const had = visibleCount(text);
      const rsys = [
        typeof narrativeCore === "function" ? narrativeCore({ intimate: true }) : "",
        "【定稿补足】你是这篇场景正文的编辑。当前只有 " + had + " 个非空白可见字符，用户设的下限是 " + minW + "，必须达到。",
        "保留原稿已经发生的全部事实、动作先后、人物决定、台词含义、叙事人称与结尾落点；不删减、不概括、不擅自升级事件。",
        "在同一时间段内补足真正可写的内容：让已有动作产生具体后果，让人物继续观察、判断、回应和说话，让环境实际参与行动。不复述开头，不重复认证同一种感受，不堆生理反应、强度形容和空泛心理。",
        wrap(styleText),
        "只输出补足后的完整正文，不要 JSON、不要解释、不要报告字数。"
      ].filter(x => String(x || "").trim()).join("\n\n");
      let got = "";
      try {
        got = String(await callAI(active, rsys, [{
          role: "user",
          content: "把下面这篇补足为完整定稿，保留全文并自然扩展到至少 " + minW + " 个非空白可见字符：\n\n" + text
        }], {
          // 补写要把整篇原文再吐一遍才谈得上加长，所以预算必须比首轮【更大】，不是更小。
          // 线下就栽过这个跟头：按首轮的额度压补写→返回被截断→解析失败→白花一次，
          // 结果「留下来的比丢掉的还短」（她 2026-08-22）。
          // 补写 = 从头写够 minW（＝首轮的量）＋ 还得把已有的 had 字原样再吐一遍，
          // 所以永远是首轮预算【加上】原文那部分，不是另算一个可能更小的数。
          maxTokens: budget(firstBudget + Math.ceil(had * 2.2) + 500),
          stream: canStream, timeout: 240000
        }) || "").trim();
      } catch (e) {
        notes.push("第 " + attempts + " 次补写没问成：" + String((e && e.message) || e).slice(0, 60));
        break;
      }
      const gained = visibleCount(got);
      if (gained > had) { text = got; notes.push("补写 " + attempts + "：" + had + " → " + gained); }
      else { notes.push("补写 " + attempts + "：只拿回 " + gained + " 字，没改善，保留原稿"); break; }
    }
    const final = visibleCount(text);
    if (minW && final < minW) notes.push("⚠️模型不肯写到 " + minW + "，最终 " + final + " 字");
    return { text: text, chars: final, notes: notes };
  }

  window.StylePresets = {
    CATS: CATS, MODULES: MODULES, TEST_SCENES: TEST_SCENES,
    allCats: allCats, moduleById: moduleById, userModules: userModules,
    removeUserModule: removeUserModule, importBundle: importBundle,
    list: list, save: save, byId: byId, upsert: upsert, remove: remove,
    textFor: textFor, blockFor: blockFor, wrap: wrap,
    loadRuns: loadRuns, pushRun: pushRun, clearRuns: clearRuns, runTest: runTest,
    SM_BEAT: SM_BEAT, SM_CAMERA: SM_CAMERA, SM_PARAGRAPH: SM_PARAGRAPH
  };
})();
