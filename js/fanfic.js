// ============================================================
// 同人文（fanfic）—— Phase 1
// feed / 批量生成 / 追更 / 书评 + RP(穿进同人文) 最小 stub。
// 数据走 localStorage（x_fanfic_tabs / x_fanfic_fics / x_fanfic_cps），
//   全部 x_ 前缀，自动跟随现有 saves 整包云同步。
// 生成管线：system(反八股 + 角色卡准则 + 亲密反模板 + 同人文反陈词滥调)
//   + 选中 CP 角色卡 + 当前 tab 世界观(world book) + 生成指令，
//   一次批量出 N 篇；extractJSON/repairJSON 容错 + 自动重试（不动全局 callAI）。
// ============================================================
(function () {
  const useState = React.useState, useEffect = React.useEffect;

  // ---- 内置 prompt 块 -------------------------------------------------
  // 同人文专用「反陈词滥调」第五节：ban 掉网文/翻译腔里烂大街的意象词。
  // 只焊进本模块的 prose 生成，不进全局。
  const FANFIC_ANTI_CLICHE =
    "【同人文 · 反陈词滥调（写 prose 时持续生效，优先级同去人机味）】\n" +
    "· 禁用这批被写烂的意象词及其近义堆砌：形容皮肤/身体用「白玉／羊脂／凝脂／欺霜赛雪／白皙如瓷」；形容头发用「瀑布般／如瀑／墨色的瀑布」；缠绕纠缠一律不用「藤蔓／藤蔓般缠绕／attach 藤蔓」；还有「琉璃／碎钻／星辰大海／灵魂深处／宿命／劫」这类空转大词。\n" +
    "· 【尤其禁掉这批同人烂梗动作/称呼，一次都别出现】：把头/脸「埋进颈窝／埋在颈间／蹭颈窝」、把对方或自己比作「小兽／幼兽／大型犬／奶狗／小奶猫」、「低吼一声／喉间溢出／闷哼／黏腻的气音」、「危险地眯起眼／勾唇一笑／挑眉」、「收紧的手臂／禁锢／圈进怀里／扣住后颈」、「耳尖泛红／红透了耳根」。要写亲密与情绪，请另找只属于这两个人、这个场景的具体动作。\n" +
    "· 别写「不知是不是错觉」「仿佛过了一个世纪」「时间仿佛静止」「空气都凝固了」这类填充句。\n" +
    "· 感官与比喻要落在这两个人此刻的具体处境上（这间屋子、这件衣服、他手边的东西），不要通用言情模板。\n" +
    "· 台词要有人味、有停顿、有言外之意，别让人物开口就是散文腔或宣言腔。";
  // 尾部再压一遍（放输出指令后，利用模型对结尾的注意力）——item：整篇再加一次八股提醒
  const FANFIC_ANTI_CLICHE_TAIL =
    "\n\n【落笔前再自检一遍】通篇不许出现：埋进颈窝、小兽/幼兽/大型犬、低吼一声/喉间溢出、勾唇/挑眉、圈进怀里/扣住后颈、耳尖泛红，以及白玉凝脂、如瀑长发、藤蔓般缠绕、星辰大海、灵魂深处这类烂词。发现自己要写这些，就换成此情此景独有的具体细节。";

  // 有例文时，不能再拿一长串禁词盖在 prompt 尾部：模型会把注意力全花在避词，
  // 最后只学到例文的生僻词皮肤，句子仍是「动作→解释→抽象总结」的 AI 八股。
  // 这一块教的是可迁移的句法机制；示例为本项目原创，只学方法、不复制外部作者句子。
  const STYLE_DEEP_IMITATION =
    "【文风学习方式 · 借骨不借皮】\n" +
    "· 先在心里观察例文的句长变化、停顿位置、段落怎样转场、叙述离身体有多近；不要输出这份分析。\n" +
    "· 模仿上述句法与叙述距离，不要只摘例文里的冷僻名词、形容词、比喻和意象。只换词不换句法，视为没有遵循文风。\n" +
    "· 文风预设是一只调色盘，不是每段都必须执行的流程图。即使预设列出『感知→联想→记忆→确认』等链条，也只可择机取其中一两步；全文完整跑这类链条不得超过两次。\n" +
    "· 连续两段不得都以心理分析为主要内容。一次内省之后，至少用两段让外界发生可观察的新变化：一句没有说完的话、位置移动、物件易手、任务受阻、信息出现或人物作出选择。不要只是换一组意象继续想。\n" +
    "· 禁止在一个动作后立刻替读者解释『这意味着什么』；禁止连续使用『她只是／这不是……而是……／关于……／仿佛……／像一种……』把现场改写成论文。\n" +
    "· 抽象判断能删就删。人物的恐惧、爱意、犹疑要留在动作的误差、物件的位置、话语的岔开与段落空白里，让读者自己抵达。\n" +
    "· 原创对照（只学改法，禁止照抄）：\n" +
    "  ✗『她收回手。关于他的体温，她早已放弃用感觉判断；这个动作只为确认他仍属于人类。』\n" +
    "  ✓『她的手背离开他的额头。水壶在桌角响了一声；她转过去关火，回来时又碰了碰同一个地方。』\n" +
    "  前者把动作解释三遍，后者让重复本身承担情绪。正文优先采用后者的写法。";
  const STYLE_FIDELITY_TAIL =
    "\n\n【最后校准 · 文风看句子，不看生词】交稿前删掉动作后的心理讲解、主题总结和同义复述。随机看三段：若拿掉冷僻词后仍是标准 AI 的『动作—解释—升华』句式，就重写那三段；让句长、停顿、留白和视角贴近所选例文，但不得复制例文原句。中后段若连续两段都只在解释人物，请把其中至少一段改成会改变下一刻的现场事件。结尾停在动作、物件、声音、话语或未完成的选择上；严禁解释标题是什么意思、意象象征什么、两人的关系究竟是什么。";

  // 金鱼灯原预设是一份 1.3 万字的「风格施工手册」：它要求每段使用多种指定句法、
  // 罕见词配额、心理追问链和全知叙述判断。单条例句好看，整份直喂却会稳定产出
  // 动作→剖析→定义→升华的八股。原预设仍完整留在用户文风库；这里只做同人文专用翻译。
  const JINYUDENG_FANFIC_ADAPTER =
    "【金鱼灯 · 小说适配版】\n" +
    "目标是贴近人物知觉的文学叙事，不是展示写作技巧。让现场和意识一起向前走。\n" +
    "· 从人物实际看见、碰到、听见的一件东西进入；材质、温度、距离只写当前场景确实存在的部分。\n" +
    "· 长句只在知觉真的发生转向时出现，前后必须有朴素短句透气。不要每段使用同一套长定语、谓语后置或句末判断。\n" +
    "· 心理只能来自人物有限、偏颇甚至错误的理解。叙述者不替人物揭晓『真正动机』，不把一次动作翻译成关系结论；矛盾可以悬而未决。\n" +
    "· 冷僻词和生死词没有配额。普通词准确就用普通词；罕见名词每两三段至多一个，且必须是人物知识范围内不可替换的实物。\n" +
    "· 比喻只在压力最高处使用一个，并让它来自此人的职业、经历或眼前物；不用连续比喻给同一感受换包装。\n" +
    "· 对话、误解、选择、阻碍和物件易手都是真正的叙事动作。每次内省都必须改变人物下一步怎样说或怎样做。\n" +
    "· 结尾停在仍有余波的现场，不总结人物成长，不解释题目、象征或这段关系。\n" +
    "风格的辨识度来自观察顺序、句子呼吸和人物独有的注意力，不来自生僻词密度。";
  const JINYUDENG_FANFIC_TAIL =
    "\n\n【金鱼灯适配终检】正文是否真的发生了事，而非只换着词分析同一种心情？若叙述者说出了人物的『真正动机』或结尾解释了题目，请删掉解释，让动作、对话和最后一件物品自行留下余味。";

  function isJinyudengStyle(text) {
    text = String(text || "");
    return /\[金鱼灯\]|金鱼灯jinyudeng|<writing_style>[\s\S]{0,200}\[金鱼灯\]/i.test(text);
  }
  function fanficStylePrompt(text) {
    return isJinyudengStyle(text) ? JINYUDENG_FANFIC_ADAPTER : String(text || "").trim();
  }
  function fanficStyleTail(text) {
    // 有文风也不能撤掉全局陈词禁令；v51.75 曾用风格终检替换禁令，导致幼兽/气音/涟漪复发。
    return (isJinyudengStyle(text) ? JINYUDENG_FANFIC_TAIL : STYLE_FIDELITY_TAIL) + FANFIC_ANTI_CLICHE_TAIL;
  }

  // 版块管「发生在哪里」，文风管「文字怎么活」。这一层专门拆掉每篇都按同一骨架行进的八股。
  const FANFIC_ORGANIC_FORM =
    "【叙事形状 · 禁止标准作文骨架】\n" +
    "· 世界观版块只决定背景与生活规则，不等于固定文风；句法、叙述距离、段落呼吸以本次文风预设为准。\n" +
    "· 不必凑标准『起承转合』，也不必每篇都有误会—解释—和好、偶遇—心动—告白或危机—营救—升华。先判断这篇真正有压力的那一刻，从最有生命的切口进入。\n" +
    "· 开头可以落在半句话、一个动作之后、事情已发生的现场或平静生活中；不要篇篇先交代天气、地点、人物关系。结尾允许停在余波、未说完的话、生活继续的一刻，不写总结陈词和主题升华。\n" +
    "· 场景详略允许不匀：值得停留的几分钟写深，其余时间可以跳过。别机械轮播环境描写→心理解释→身体反应→台词→金句。\n" +
    "· 心理不是解说词。能由选择、错手做的小事、话说到一半或对物件的处置显出的，就别再替人物概括一遍。";

  // 正面示例（v47.74）：纯禁词清单压不住（否定指令模型不敏感，「埋进颈窝」照样出现）——
  // 上「烂模板 → 正确方向」对照，教思路不给可抄的句子；示例场景是现代的，古风等板块自行翻成对应时代的同款思路
  const FANFIC_GOOD_EXAMPLES =
    "【正面示例（学右边的写法思路，严禁照抄字句和场景）】每组左边是禁用的烂模板，右边是正确方向：\n" +
    "· ✗ 他把脸埋进你的颈窝 → ✓ 他靠过来时没接你的话，下巴抵在你肩上那截旧毛衣的线头上，半晌说了句「这件该扔了」。——亲近写成【有来由的动作＋一句说歪的话】，不用贴脸通用动作。\n" +
    "· ✗ 他低吼一声把你圈进怀里 → ✓ 他抬手把你往回带了半步，正好避开泼出来的水，手指在你袖口停了一下才松开。——碰触要有具体事件承载，不凭空发生。\n" +
    "· ✗ 空气仿佛凝固了／耳尖泛红 → ✓ 他伸手去够杯子，够了两次都没拿稳。——心绪外化成一件做砸的小事，全程不点破。\n" +
    "· ✗ 事后他满足地叹了口气，把人搂得更紧 → ✓ 他背过身去摸烟，摸到一半想起对方讨厌烟味，手又缩回来，假装只是在找打火机。——收尾落在只属于这个人的别扭细节上。\n" +
    "核心：情绪全部藏进「有来由的动作＋具体物件＋说歪的话」里，一整段可以不出现任何情绪词；每一处亲密都要能回答「为什么是这个动作、为什么是此刻」。";

  // world book 亲密场景「设定层」补充（拼进当前 tab 世界观之后）——中文比喻词表走「可用」方向，
  // 上面 FANFIC_ANTI_CLICHE 走「禁用」方向，两头夹。
  const INTIMACY_WORLDNOTE =
    "【亲密场景写作设定层】写到亲密/情欲时：动作与反应必须『非这两个人不可』，" +
    "优先写角色专属的小动作、口癖、他在意的具体细节；收尾落在一句符合他声纹的话或只属于他俩的细节上，" +
    "别用『埋进颈窝深吸气／忍不住求饶／热流直冲天灵盖』这类通用模板收尾。尺度贴合本世界观基调，别自我阉割也别为露骨而露骨。";

  // ---- 预设世界观 tab（首启种子）------------------------------------
  // mixed:true 的「推荐」= 从其它版块类别随机抽来写（每篇随机挑一个世界观）
  const SEED_TABS = [
    { id: "tab_reco", name: "推荐", desc: "综合推荐——从所有世界观类别里随机抽取来写，冷暖甜虐各种题材混着来。", seed: true, mixed: true },
    { id: "tab_urban", name: "都市", desc: "现代都市背景。写字楼、地铁、深夜便利店、微信消息。\n【文风】写实、生活颗粒感，情感张力全藏在日常缝隙里：\n· 场景要具体到店名式的细节（不是「一家便利店」而是「收银台边加热柜里最后一个包子」）；时间用通勤/加班/末班车这类都市节律来标。\n· 对话像真人发微信、真人下班后说话：短、有错字式的随意、有已读不回；忌散文腔告白。\n· 情绪靠物件与动作递：外卖备注、共享歌单、帮忙拧瓶盖；忌直接写「心动/心跳加速」。\n· 忌偶像剧套路（壁咚/摔进怀里/雨中告白），冲突从房租、加班、家人这些真实压力里长出来。", seed: true },
    { id: "tab_campus", name: "校园", desc: "校园背景。教室、操场、晚自习、社团。\n【文风】青涩、克制、有少年感，绝不许写成成年人办公室恋爱：\n· 亲密的上限是借橡皮时碰到手、递水时的迟疑——张力来自「不敢」而不是「忍着」。\n· 用课程表、月考排名、广播操、值日表这些校园肌理标时间；对白带少年人的逞强和词不达意。\n· 心事写成小动作：草稿纸角落的名字划掉又写、绕远路经过对方班级门口。\n· 忌早恋剧模板（天台告白/自行车后座光环化），忌让高中生说出三十岁的情话。", seed: true },
    { id: "tab_apoc", name: "末世", desc: "末世/废土背景。资源匮乏、丧尸或灾变、幸存者据点。\n【文风】冷硬底色，感情在生死边缘发生：\n· 物资是叙事的骨头：半瓶水怎么分、子弹省着打、抗生素给谁用——温柔全部藏在分配里，不许直说。\n· 危险要真实有代价（受伤会感染、睡觉要轮岗），忌主角光环；死亡与失去写得克制、不煽情。\n· 对白短、省字，像真的不敢浪费体力；亲密是背靠背值夜、把外套让出去，不是废土里谈都市恋爱。\n· 忌「乱世佳人」滤镜与升华式旁白，末世的浪漫是「今天也活下来了」。", seed: true },
    { id: "tab_abo", name: "ABO", desc: "ABO 世界观。Alpha/Beta/Omega 三分性别、信息素、易感期/发情期、标记。\n【文风】设定内自洽，信息素与本能是核心张力：\n· 信息素写成具体的、只属于这个人的气味与生理反应，忌万能的「奶香/松木香突然爆发」流水线描写。\n· 张力核心是「本能推着走 vs 人想自己选」：克制、抵抗、社会规训下的身不由己要写足，别一闻就倒。\n· 涉及标记/发情期要有前因后果与事后代价（药剂、请假、旁人眼光），设定要落进生活肌理，不只是床戏开关。\n· 忌把 Omega 写成无脑娇弱花瓶、把 Alpha 写成发情机器——性别设定之下先是活人。", seed: true },
    { id: "tab_endless", name: "无限流", desc: "无限流。主角被卷入一个个副本/试炼世界，规则残酷、通关或死。\n【文风】悬疑惊悚打底，感情在极限处境里淬出来：\n· 副本规则要具体、可推理、有漏洞可钻（把规则条文写出来），恐怖来自规则本身的恶意而非 jump scare 堆砌。\n· 智斗要真的智：线索前置、解法讲得通，忌主角突然「灵光一闪」空降答案。\n· 队友会死、信任稀缺，感情线是「在不敢信人的地方偏偏信了你」，进展小步、代价真实。\n· 忌数值化打怪升级腔（面板/技能点），保持文学叙事的质地。", seed: true },
    { id: "tab_ancient", name: "古风", desc: "古风架空。朝堂、江湖、深宅、边关。\n【文风必须真的古】要有半文半白的古白话语感（近《红楼》《金瓶》话本、明清世情小说的腔调），不是套了古装的现代小说：\n· 叙述与对白都用文白相间的句子，多用四字短语、对仗与留白；句子偏短，忌长句欧化从句。\n· 称谓、器物、时辰、礼数都用古时说法（妾身/在下/郎君/娘子、更漏/时辰、案几/罗帐/袖中、拱手/敛衽），第一/第二人称少用「你我」多用身份称谓。\n· 严禁现代词与翻译腔：像「感觉/情绪/状态/氛围/空气/时间仿佛静止/心脏/大脑/紧张/放松/关系/沟通/瞬间/画面」这类词一律换成古意表达或删去。\n· 情感靠动作、景物、器物与欲言又止来递，隐忍克制，别直白宣泄、别现代心理描写。", seed: true },
    { id: "tab_era", name: "年代", desc: "年代文。上世纪某个年代（六七十年代/九十年代）背景，粮票、大院、国营厂、书信。\n【文风】质朴、有时代颗粒感：\n· 器物与制度要对得上年代：工分、供销社、的确良、传呼机、下岗潮——细节错年代是硬伤。\n· 语言带那个年代的说法（处对象/相看/介绍人），忌现代网络词和翻译腔；书信、电报、托人捎话是重要的情感载体。\n· 情感表达符合年代的含蓄：一辆自行车、一张电影票、多打的一份饭；忌现代恋爱观直接穿越回去。\n· 时代是命运的推手（招工、返城、分房），人物被时代裹着走，写出身不由己里的相守。", seed: true },
    { id: "tab_hk", name: "港片", desc: "港片质感。八九十年代香港，警匪、江湖义气、霓虹与雨夜、茶餐厅。\n【文风】粤味、宿命感、江湖儿女的克制深情：\n· 台词要有港片味：短、狠、带粤语语感（食咗饭未/唔该/差人），点到即止，忌普通话式长篇抒情。\n· 场景写足港味肌理：霓虹招牌倒映的湿马路、大排档塑料凳、庙街、天台水塔——雨夜和烟火气是底色。\n· 义气与情分大过告白：递烟、挡枪、留一碗云吞面，深情全在做不在说。\n· 宿命感靠留白与命运的反讽（约好的人没来、电话亭响了没人接），忌把结局说破、忌旁白升华。", seed: true }
  ];

  // ---- 存储 ----------------------------------------------------------
  const K_TABS = "x_fanfic_tabs";
  const K_FICS = "x_fanfic_fics";
  // 读到哪儿了：{ ficId: { chap, ts } }。长文追更几章之后，
  // 每次点进去都从第一章开始翻是最劝退的一件事（v58.02）。
  const K_READ = "x_fanfic_read";
  function loadRead() { return loadJSON(K_READ, {}) || {}; }
  function markRead(ficId, chap) {
    if (!ficId) return;
    const m = loadRead();
    m[ficId] = { chap: Math.max(0, Number(chap) || 0), ts: Date.now() };
    // 只留最近读过的 200 篇，别让它长成坟场
    const keys = Object.keys(m);
    if (keys.length > 200) {
      keys.sort(function (a, b) { return (m[b].ts || 0) - (m[a].ts || 0); }).slice(200).forEach(function (k) { delete m[k]; });
    }
    saveJSON(K_READ, m);
  }
  const K_CPS = "x_fanfic_cps";
  const K_CFG = "x_fanfic_cfg"; // 生成设置：预设文风 + 每篇 max token
  const K_SHARED_STYLES = "x_offlineStyles"; // 与线下共用的本地文风库（不复制长 prompt）

  // 文风做成多个自定义预设，可多选任意切换；perFic=每篇/每章目标 token（放宽，别老骗刷下一章）
  const CFG_DEFAULT = { styles: [], activeStyleIds: [], perFic: 4200 };
  // 她 2026-08-30：「把 token 也放开了写」。原来是 2000–8000 的滑杆。
  // 上限留一个：填成天文数字只会让请求直接被模型拒掉或挂到超时，那不是「放开」。
  const FIC_TOKEN_MAX = 60000;
  // ── 书页（她 2026-08-30：「背景换成书页，设置加好几种预设，包括深夜模式的」）──
  // ⚠️一张纸得【连纸带墨】一起给：深夜那张纸配深色墨就什么都看不见了。
  // 所以每一张纸就是一整套主题 token，套在 ThemeContext 上——
  // 卡片、标签、深浅交替那一套全都读 useTheme()，换纸自动跟着走，不用挨个改。
  const FIC_PAPERS = [
    { id: "cream", label: "米黄", hint: "旧书内页", bg: "#efe6d2", bg2: "#f7f1e2", ink: "#33291c", sub: "#5c4f3c", fog: "#a1927a", line: "#ddd0b4", accent: "#a8543f", tint: "#4a6484" },
    { id: "plain", label: "素白", hint: "新书", bg: "#f2f1ee", bg2: "#fbfaf7", ink: "#22211e", sub: "#4d4b45", fog: "#9a978e", line: "#e0ded7", accent: "#b2543f", tint: "#41627d" },
    { id: "kraft", label: "牛皮", hint: "毛边本", bg: "#e2d4ba", bg2: "#ece1cb", ink: "#3b2f1e", sub: "#63523a", fog: "#a39070", line: "#d0bd9c", accent: "#9d4f34", tint: "#4c6350" },
    { id: "bamboo", label: "竹青", hint: "线装书", bg: "#e4e8dd", bg2: "#eef1e8", ink: "#242a22", sub: "#4b5347", fog: "#93998c", line: "#d2d8c8", accent: "#8a5340", tint: "#3f6459" },
    { id: "night", label: "深夜", hint: "关灯读", bg: "#191919", bg2: "#232322", ink: "#e6e1d6", sub: "#b4aea1", fog: "#7e796e", line: "#333230", accent: "#c98d5a", tint: "#7ba0b8" },
    { id: "ink", label: "墨蓝", hint: "深夜·冷", bg: "#161a20", bg2: "#1f242c", ink: "#dfe4ea", sub: "#a9b1bb", fog: "#767e88", line: "#2c323a", accent: "#c98d7a", tint: "#7fa8c4" }
  ];
  const FIC_PAPER_DEFAULT = "cream";
  function ficPaper(cfg) {
    const want = (cfg && cfg.paper) || FIC_PAPER_DEFAULT;
    return FIC_PAPERS.find(function (p) { return p.id === want; }) || FIC_PAPERS[0];
  }
  // 纸的小样。⚠️示范用「A × B」这种【格式示范】，不写「裴照川 × 我」——
  // 那是【内容示范】，跟 .claude/rules/prompt-no-content-samples.md 说的是同一件事：
  // 判据「这个例子被逐字照抄是对的还是错的」在界面上也成立，
  // 小样是用来看纸和墨的，不是用来看谁和谁的。
  function PaperSwatch(props) {
    const pp = props.paper, on = props.on;
    return h("button", {
      onClick: props.onPick, className: "active:opacity-80 text-left",
      style: {
        background: pp.bg, borderRadius: 11, padding: "9px 10px 8px", overflow: "hidden",
        border: "2px solid " + (on ? pp.accent : "rgba(128,128,128,0.28)"),
        boxShadow: on ? "0 0 0 2px " + pp.accent + "44" : "0 1px 3px rgba(0,0,0,0.10)"
      }
    },
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: 13.5, color: pp.ink, lineHeight: 1.2 } }, pp.label),
      h("div", { style: { fontFamily: F_BODY, fontSize: 9.5, color: pp.fog, marginTop: 2 } }, pp.hint),
      h("div", { style: { height: 1, background: pp.line, margin: "7px 0 5px" } }),
      h("div", { style: { fontFamily: F_BODY, fontSize: 9.5, color: pp.sub, lineHeight: 1.35 } }, "灯芯爆了一下。"),
      h("div", { style: { fontFamily: F_BODY, fontSize: 9, color: pp.accent, marginTop: 3 } }, "A × B"));
  }
  // 这一篇用哪张纸（她 2026-08-30：「每一篇可以单独设置」）。
  // 篇上写了就用篇的；没写就退回设置里那张【默认书页】——
  // 列表页和新生成的篇目都得有张纸，所以默认那一档不能撤。
  function ficPaperFor(fic, cfg) {
    if (fic && fic.paper && FIC_PAPERS.some(function (p) { return p.id === fic.paper; })) return ficPaper({ paper: fic.paper });
    return ficPaper(cfg);
  }
  // 纸 → 主题。⚠️只覆盖【看得见的那几个色】，别的原样继承她自己的主题，
  // 免得换张纸把她在主题工作台调过的东西一起顶掉。
  function ficPaperTheme(base, paper) {
    return Object.assign({}, base || DEFAULT_THEME, {
      bg: paper.bg, bg2: paper.bg2, ink: paper.ink, sub: paper.sub,
      fog: paper.fog, line: paper.line, accent: paper.accent, tint: paper.tint
    });
  }
  function clampPerFic(v) {
    const n = Math.round(Number(v));
    if (!isFinite(n) || n <= 0) return CFG_DEFAULT.perFic;
    return Math.max(500, Math.min(FIC_TOKEN_MAX, n));
  }
  function loadCfg() {
    const c = loadJSON(K_CFG, null) || {};
    if (c.style && !c.styles) { c.styles = [{ id: "st_legacy", label: "我的文风", text: c.style }]; c.activeStyleIds = ["st_legacy"]; delete c.style; }
    return Object.assign({}, CFG_DEFAULT, c);
  }
  function saveCfg(c) { saveJSON(K_CFG, c); }
  function sharedStylePresets() {
    return (loadJSON(K_SHARED_STYLES, []) || []).filter(function (s) { return s && s.key && s.prompt; }).map(function (s) {
      return { id: "shared:" + s.key, label: s.name || "共享文风", text: s.prompt, shared: true };
    });
  }
  // 文风预设台（x_stylePresets）里搭好的预设。同人文本来就支持多选文风，所以不给它
  // 另造一个「是否吃入」开关——勾上就是吃，不勾就是完全照旧。
  function labStylePresets() {
    if (!window.StylePresets) return [];
    return (window.StylePresets.list() || []).map(function (p) {
      const text = window.StylePresets.textFor(p, "fanfic", {});
      return text ? { id: "preset:" + p.id, label: (p.name || "预设") + "（预设台）", text: text, lab: true } : null;
    }).filter(Boolean);
  }
  function allStylePresets(cfg) { return (cfg.styles || []).concat(labStylePresets()).concat(sharedStylePresets()); }
  function styleTextForIds(cfg, ids) {
    ids = ids || [];
    return allStylePresets(cfg).filter(function (s) { return ids.indexOf(s.id) >= 0; }).map(function (s) { return s.text; }).filter(Boolean).join("\n\n");
  }
  function activeStyleText(cfg) {
    return styleTextForIds(cfg, cfg.activeStyleIds || []);
  }

  // 文风实验室：把“喜欢这篇的感觉”拆成可组合的叙事零件。
  // 样例只作为句法/叙述距离参照，不允许模型复制人物、情节或原句。
  const STYLE_LAB_AXES = [
    { id: "close", label: "贴身限知", text: "叙述贴着当前人物的有限感知走；不知道的事不替人物揭晓，允许误读、迟疑和自相矛盾。" },
    { id: "breath", label: "长短呼吸", text: "句长随注意力变化：朴素短句承担落点，较长句只用于知觉或回忆真的转向；段落长短不必整齐。" },
    { id: "scene", label: "现场推进", text: "每段都让现场发生一点变化：人移动、物件易手、话被打断、信息出现或选择落下；不靠换一组比喻原地抒情。" },
    { id: "subtext", label: "对白潜台词", text: "对白允许绕开真正的问题、说半句、答非所问；人物关系从措辞和停顿显出，不写成观点宣言。" },
    { id: "embodied", label: "情绪落身体", text: "心理从呼吸、视线、手上正在做的事和动作误差里显影；少用情绪名词，不在动作后追加解释。" },
    { id: "memory", label: "触发式回忆", text: "回忆必须被眼前具体事物触发，短暂进入后回到现场并改变下一步；不整段交代履历。" },
    { id: "plain", label: "准确普通词", text: "优先使用准确的普通词。罕见词只在不可替代且符合人物知识时出现，不以辞藻密度冒充文学性。" },
    { id: "open_end", label: "余波收尾", text: "结尾停在动作、声音、物件、话语或未完成的选择上；不总结成长，不解释标题、象征和关系结论。" }
  ];
  const STYLE_LAB_RECIPE = ["close", "breath", "scene", "subtext", "embodied", "memory", "plain", "open_end"];
  function buildStyleLabPrompt(name, source, axes, notes, samples) {
    const picked = STYLE_LAB_AXES.filter(function (a) { return (axes || []).indexOf(a.id) >= 0; });
    const excerpts = (samples || []).map(function (s) { return String(s || "").trim().slice(0, 1600); }).filter(Boolean).slice(0, 3);
    const out = ["【" + (String(name || "文风实验").trim() || "文风实验") + " · 可迁移写法】"];
    if (source && String(source).trim()) out.push("来源备注（只作溯源，不是写作指令）：" + String(source).trim().slice(0, 240));
    out.push("目标：学习叙述距离、句子呼吸、观察顺序和留白方式；绝不复制样例的人名、情节、设定、意象或原句，也不把技巧逐条机械打卡。");
    picked.forEach(function (a) { out.push("· " + a.text); });
    if (notes && String(notes).trim()) out.push("\n【本次补充】\n" + String(notes).trim().slice(0, 1800));
    if (excerpts.length) {
      out.push("\n【短样例：借骨不借皮】\n只观察句长变化、段落转场、视角贴近程度、对白和动作如何分工。禁止续写或改写样例本身。");
      excerpts.forEach(function (s, i) { out.push("样例 " + (i + 1) + "：\n" + s); });
    }
    out.push("\n【交稿自检】拿掉形容词后，段落仍应靠人物的注意力、选择和现场变化成立。若出现『动作—解释—总结』三连，删掉解释，让读者自己抵达。");
    return out.join("\n");
  }
  // 我的·作者主页资料（头像/昵称/id/背景 + 粉丝/关注；热度由我发布的篇目派生）
  const K_ME = "x_fanfic_me";
  function loadMe() { return loadJSON(K_ME, null); }
  function saveMe(m) { saveJSON(K_ME, m); }
  function meProfile(stored, profile) {
    return Object.assign({
      name: (profile && profile.name) || "我", handle: "", bio: (profile && profile.tagline) || "",
      avatar: (profile && profile.avatarImage) || null, bg: null, heat: 0, fans: 0, following: 0
    }, stored || {});
  }

  function loadTabs() {
    const stored = loadJSON(K_TABS, null);
    if (!stored || !Array.isArray(stored) || !stored.length) return SEED_TABS.slice();
    // 预设永远来自代码，只把用户自定义项留在存储；旧档里的整套种子读到后会就地瘦身。
    const seedIds = SEED_TABS.map(function (s) { return s.id; });
    const custom = stored.filter(function (t) { return seedIds.indexOf(t.id) < 0; });
    if (custom.length !== stored.length) saveJSON(K_TABS, custom);
    return SEED_TABS.concat(custom);
  }
  function saveTabs(list) {
    const seedIds = new Set(SEED_TABS.map(function (s) { return s.id; }));
    saveJSON(K_TABS, (Array.isArray(list) ? list : []).filter(function (t) { return t && !seedIds.has(t.id); }));
  }
  function loadFics() { return loadJSON(K_FICS, []); }
  // 📚 累积层：满了挤掉最旧的（.claude/rules/phone-data-layers.md）。
  // 每篇都带全文，不封顶的话几个月下来就是一座数据坟场。
  // 受保护的（收藏/自己写的/点过赞/在追的）一律不算进额度。
  const FIC_KEEP = 150;
  function saveFics(list) {
    const all = Array.isArray(list) ? list : [];
    const keep = [], pool = [];
    all.forEach(function (f) { (protectedFic(f) ? keep : pool).push(f); });
    if (pool.length <= FIC_KEEP) return saveJSON(K_FICS, all);
    const live = new Set(pool.slice().sort(function (a, b) {
      return (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0);
    }).slice(0, FIC_KEEP).map(function (f) { return f.id; }));
    return saveJSON(K_FICS, all.filter(function (f) { return protectedFic(f) || live.has(f.id); }));
  }
  function loadCPs() { return loadJSON(K_CPS, []); }
  function saveCPs(list) { saveJSON(K_CPS, list); }

  function uid(pfx) { return (pfx || "f") + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  // 导出只带同人文成品与写作配置，供文风/重复句式诊断；不夹带角色卡、聊天素材、密钥或书评区。
  function exportFanficAudit(tabs, fics, cfg) {
    const presets = allStylePresets(cfg).map(function (s) {
      return { id: s.id, label: s.label || "未命名文风", shared: !!s.shared, text: String(s.text || "") };
    });
    const tabById = {};
    (tabs || []).forEach(function (tab) { tabById[tab.id] = tab; });
    const bundle = {
      kind: "lisa_fanfic_audit",
      schema_version: 1,
      exported_at: new Date().toISOString(),
      app_version: (typeof APP_VERSION !== "undefined" ? APP_VERSION : "unknown"),
      note: "仅含同人文正文、板块与文风配置；不含角色卡、聊天记录、密钥和书评。旧文章可能没有 generation_style_ids。",
      active_style_ids: (cfg.activeStyleIds || []).slice(),
      style_presets: presets,
      stories: (fics || []).map(function (f) {
        const tab = tabById[f.tabId] || {};
        return {
          id: f.id,
          title: f.title || "",
          author: f.author || "",
          board: { id: f.tabId || "", name: tab.name || "", description: tab.desc || "" },
          tags: (f.tags || []).slice(),
          premise: f.premise || "",
          source: f.source || "",
          created_at: f.createdAt ? new Date(f.createdAt).toISOString() : null,
          updated_at: f.updatedAt ? new Date(f.updatedAt).toISOString() : null,
          generation_style_ids: (f.generationStyleIds || []).slice(),
          generation_style_labels: (f.generationStyleLabels || []).slice(),
          chapters: (f.chapters || []).map(function (ch, i) {
            return { number: i + 1, content: ch.content || "", end_hook: ch.endHook || "" };
          })
        };
      })
    };
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    // 存文件走 engine.js 的 saveTextFile：iOS PWA 里 <a download> 点了什么都不会发生
    window.saveTextFile("lisa-fanfic-audit-" + stamp + ".json", JSON.stringify(bundle, null, 2), "application/json");
    return bundle.stories.length;
  }

  // 清空本版时哪些留下。⚠️v58.04 补上 liked 和「读到一半」：
  // 原来只认 ★收藏 和自己写的，于是点了♡＝已经表过态、读到第 5 章＝正在追，
  // 两种都照删，x_fanfic_read 里还剩一条指向不存在的文的孤儿记录。
  // 判据：她对这篇【做过任何一个动作】，就不许背着她删掉。
  function protectedFic(f) {
    if (!f) return false;
    if (f.onShelf === true || f.source === "user" || f.liked === true) return true;
    const r = loadRead()[f.id];
    return !!(r && r.chap > 0);   // 只翻到第一章不算追，翻过页才算
  }

  // ---- 泛读者人格（书评用，不碰角色卡）--------------------------------
  // 走朋友圈随机 NPC 那套「路人读者」，各种画风。
  const READER_VOICE =
    "你在扮演一批逛同人文的普通读者/太太粉，各种画风都有：考据党、颜狗、含泪嗑生死、只会打「啊啊啊」的、" +
    "阴阳怪气挑刺的、催更的、玩梗的、认真写长评的。别都一个腔调，别客服腔、别写得像编辑评语。用真实的同人圈黑话和语气。";

  // ---- 组生成 prompt --------------------------------------------------
  // cpChars: 已解析对象数组（0/1/2 个，元素可能是 meChar，带 isMe）
  // 人设每人封顶 6000 字——和跑团那条链同一个额度
  // （.claude/rules/four-surfaces-same-context.md 里写死的那个数）。
  // 原来这里一个上限都没有：两个人设 4500+ 的角色配上一份长文风，
  // 光 system 就先去掉一两万字，正文反而被模型自己的输出上限挤短。
  const FIC_PERSONA_CAP = 6000;
  function personaOf(c) { return String((c && c.persona) || "").trim().slice(0, FIC_PERSONA_CAP); }
  function sideDesc(c) {
    const p = personaOf(c);
    if (c.isMe) return "「" + c.name + "」是读者本人（我）" + (p ? "，按这份面具人设来写：\n" + p : "，没有填写人设——可自由发挥其性格，别硬套设定");
    return "「" + c.name + "」严格贴合角色卡：\n" + (p || "（暂无设定，可据名字合理发挥）");
  }
  function cpBlock(cpChars, opts) {
    opts = opts || {};
    if (!cpChars || !cpChars.length)
      return "【CP】未指定具体 CP——写原创向/群像向短篇，主角自拟，别硬凑现有角色。";
    // 左右位铁律（v47.78 她点名修）：CP 的书写顺序=左右位，同性 CP 严格左攻右受，
    // 绝不许按「谁人设强势谁当攻」自行对调——人设强势的右位就是「强势受」，反差才是萌点
    const posRule = function (l, r) {
      return "\n【左右位铁律（最高优先，凌驾于人设气场之上）】这个 CP 的顺序就是左右位：「" + l + "」是左位，「" + r + "」是右位。若两人是同性 CP，写亲密关系时严格执行【左攻右受】：主导/进攻的一方永远是「" + l + "」，承受/被动的一方永远是「" + r + "」——**绝对禁止因为谁人设更强势、更年长、更冷、更有钱、体格更壮就自行把位置调换**。人设强势的右位就写成气场强但在这段关系里是受的那一方；性格软的左位就写成温柔但主动的攻。若是异性 CP，顺序代表叙事重心先后即可。";
    };
    if (cpChars.length === 1) {
      const c = cpChars[0];
      return "【CP：" + c.name + " × 原创对象】\n主角一方：" + sideDesc(c) + "\n另一方是一个由你设定的原创角色（自由发挥，贴合本世界观基调）。" + posRule(c.name, "原创对象");
    }
    const a = cpChars[0], b = cpChars[1];
    const bothChars = !a.isMe && !b.isMe; // 两个都是角色（没有「我」）
    // 带上我：写成 A × 我 × B 三人同框
    if (bothChars && opts.includeMe) {
      const meName = opts.meName || "我";
      return "【CP：" + a.name + " × " + meName + "（读者本人/我） × " + b.name + "】\n这是三人同框：把『我』作为真正的第三方写进去，三个人彼此之间都有关系张力，别把『我』写成旁观者或工具人。\n· " + sideDesc(a) + "\n· 「" + meName + "」是读者本人（我）" + (opts.mePersona && opts.mePersona.trim() ? "，按这份面具人设来写：\n" + opts.mePersona.trim() : "，没填人设就自由发挥其性格") + "\n· " + sideDesc(b) + posRule(a.name, b.name);
    }
    // 只他俩 CP：即便角色卡写了「我男朋友」，也不把「我」带进文里
    const soloTail = bothChars ? "\n【只写这两人】这是 " + a.name + " × " + b.name + " 的双人同人文，读者/『我』不出场、不作为角色写进去；就算某人的设定里写了 TA 是「我的男朋友/恋人」，本篇也只聚焦他们两人彼此，别把「我」拉进来凑三人。" : "";
    return "【CP：" + a.name + " × " + b.name + "】\n两位主角各自守住各自设定、别互相同化。\n· " + sideDesc(a) + "\n· " + sideDesc(b) + soloTail + posRule(a.name, b.name);
  }

  // 素材来源：把 CP 角色的私聊记录抽尾巴当写作素材（item 6：生成素材来源人设聊天）
  function chatMaterialFor(cpChars) {
    if (!cpChars || !cpChars.length) return "";
    const blocks = [];
    cpChars.forEach(function (c) {
      const log = loadJSON("x_chat:" + c.id, []);
      const tail = (log || []).filter(function (m) { return m && (m.role === "user" || m.role === "assistant") && m.content && !isOocMsg(m); }).slice(-14);
      if (!tail.length) return;
      const lines = tail.map(function (m) { return (m.role === "assistant" ? c.name : "对方") + "：" + String(m.content).slice(0, 80); });
      blocks.push("· 和「" + c.name + "」的近期聊天（可提炼 TA 的说话习惯、你俩的相处质感、在意的事，化用进文里，别照抄）：\n" + lines.join("\n"));
    });
    return blocks.length ? "【素材来源 · 角色真实聊天记录】\n" + blocks.join("\n\n") : "";
  }

  function buildGenSystem(tab, cpChars, userName, worldbook, opts) {
    opts = opts || {};
    const parts = [];
    // 叙事底座（v54.80）：以前这儿只有 ANTI_CLICHE + CHARCARD_RULE，缺了线下那套
    // 【自然生成准则】和【反陈词滥调】——明喻限额、别把情绪列成清单、叙述者不替读者
    // 定情绪分量这几条同人文一条都没吃到。register:false 是因为纯写故事时用户不在场。
    parts.push(narrativeCore({ intimate: true, register: false }));
    parts.push(FANFIC_ANTI_CLICHE);
    parts.push(FANFIC_GOOD_EXAMPLES);
    parts.push(FANFIC_ORGANIC_FORM);
    parts.push(
      "【任务】你是一位很会写的同人文作者。写【纯线下叙事体】短篇同人文（第三人称或第二人称皆可，不是聊天、不是剧本，是成篇的散文小说）。" +
      "每篇自成一体，有真正发生或改变了什么的场景，落在具体细节与真实情绪上；结构服从本篇经验，不为完整而硬凑统一的起承转合。");
    // 世界观 = world book / 设定层。推荐(mixed)版：给出一整批世界观供每篇随机取
    if (tab.mixed && Array.isArray(opts.worldPool) && opts.worldPool.length) {
      parts.push("【世界观（综合推荐 · 每篇随机挑一个来写，彼此别扎堆重复）】\n" +
        opts.worldPool.map(function (w) { return "· " + w.name + "：" + (w.desc || ""); }).join("\n"));
    } else {
      parts.push("【本版世界观（设定层 · world book）：" + tab.name + "】\n" + (tab.desc || "（无额外设定）"));
    }
    parts.push(INTIMACY_WORLDNOTE);
    if (opts.style && opts.style.trim()) {
      const adaptedStyle = fanficStylePrompt(opts.style);
      parts.push("【预设文风（作者本次的写作风格要求，优先满足）】\n" + adaptedStyle + (isJinyudengStyle(opts.style) ? "" : "\n\n" + STYLE_DEEP_IMITATION));
    }
    if (worldbook && worldbook.trim()) {
      if (typeof WORLDBOOK_RULE !== "undefined") parts.push(WORLDBOOK_RULE);
      parts.push("【全局世界书（严格遵循：其中的设定/文风/禁忌一律照做，尤其是反套话/反八股类条目要压过模型的默认写法；仅当与本版世界观正面冲突时才以本版为准）】\n" + worldbook.trim());
    }
    parts.push(cpBlock(cpChars, opts));
    if (opts.chatMaterial && opts.chatMaterial.trim()) parts.push(opts.chatMaterial.trim());
    return parts.join("\n\n");
  }

  // ---- 批量生成 N 篇（容错 + 重试）------------------------------------
  // opts: { style, perFic, worldPool, chatMaterial }
  async function genBatch(active, tab, cpChars, n, userName, worldbook, opts) {
    opts = opts || {};
    const perFic = clampPerFic(opts.perFic);
    const minWords = Math.max(600, Math.round(perFic * 0.55)); // 大致字数下限
    const cotChar = (cpChars && cpChars[0] && cpChars[0].name) || "主角";
    const cotT = (typeof cotThink === "function") ? cotThink({ char: cotChar, user: userName }) : "";
    const batchDraftRule = cotT ? "\n【本批小稿分篇】这次要写 " + n + " 篇，请在同一个创作小稿标记块里依次写『【第1篇】』『【第2篇】』直到『【第" + n + "篇】』；每篇各自写在意/推进/避开/自定义检查，不能共用一份泛泛计划。\n" : "";
    // 她这次点名要写什么。没填的那几篇明确说【自由发挥】——
    // 不说的话模型会拿填了的那几条去套没填的，一批文全长成一个样。
    const briefs = Array.isArray(opts.briefs) ? opts.briefs : [];
    const briefBlock = briefs.some(function (x) { return String(x || "").trim(); })
      ? "\n\n【这一批每篇分别要写什么（作者点的梗，优先满足）】\n"
        + Array.from({ length: n }, function (_, i) {
            const b = String(briefs[i] || "").trim();
            return "第" + (i + 1) + "篇：" + (b ? b.slice(0, 600) : "（没点，自由发挥——别去套上面那几条，这一篇要有自己的走向）");
          }).join("\n")
        + "\n点了梗的那几篇：把它当成【这一篇的地基】写足，不是在结尾提一句就算数；\n"
        + "但也别把她那句话原样抄进正文当台词或标题。"
      : "";
    const sys = buildGenSystem(tab, cpChars, userName, worldbook, opts) + briefBlock + "\n\n" +
      (typeof cotSystemBlock === "function" ? cotSystemBlock(cotT) : "") + batchDraftRule +
      "【输出】只输出一个合法 JSON 数组，无 markdown 无多余文字。数组恰好 " + n + " 个元素（务必凑满 " + n + " 篇）：\n" +
      "[{\"title\":\"标题\",\"author\":\"作者笔名（同人圈作者马甲/太太笔名，别用真名别带@）\",\"tags\":[\"标签\",\"标签\"],\"premise\":\"本篇核心设定一句话：他俩是什么关系（谁欠谁、见面为什么别扭、这段关系卡在哪儿）+各自的身份+这个世界观里最要紧的那条规矩——这是全篇不许变的地基\",\"body\":\"正文（成篇散文，务必写足、有剧情，约 " + minWords + " 字以上，分段用\\n\\n）\",\"endHook\":\"结尾锚点：一句话描述这篇结束在什么处境/悬念，供日后续写接续\"}]\n" +
      "每篇 title 别重复、别都一个套路；同一批里开场位置、核心推进方式、时间跨度、叙述距离和收尾形状至少有三项彼此不同，禁止只是换背景与人名却复用同一情节拍。author 每篇各不同；tags 2-4 个：站在读者角度，这几个标签要能让人一眼判断【要不要点进去】——结局走向、雷点预警、题材形状各占一个方向，别几篇共用同一套万能标签。别为了凑数量把正文压短——宁可写满。" +
      (opts.style && opts.style.trim() ? fanficStyleTail(opts.style) : FANFIC_ANTI_CLICHE_TAIL);
    const user = "写 " + n + " 篇" + (tab.mixed ? "（世界观每篇随机挑）" : "【" + tab.name + "】世界观下") + "的同人文。别都同一个梗、同一种基调，冷暖虐甜各来一点，每篇都要写出剧情别烂尾。";
    let batchCot = null;
    async function once(extra) {
      const raw = await callAI(active, sys + (extra || ""), [{ role: "user", content: user }], { maxTokens: Math.min(FIC_TOKEN_MAX * 4, 6000 + n * perFic), timeout: 300000 }); // 长文风+长正文允许 5 分钟；思考型模型的思考也从这里扣
      const sp = (typeof splitCot === "function") ? splitCot(raw, !!cotT) : { cot: null, clean: raw };
      if (sp.cot) batchCot = sp.cot; // 整批一次思考，挂到第一篇
      let d = extractJSON(sp.clean);
      if (!d && typeof repairJSON === "function") { try { d = JSON.parse(repairJSON(sp.clean)); } catch (e) {} }
      if (Array.isArray(d)) return d;
      if (d && Array.isArray(d.items)) return d.items;
      if (d && d.title) return [d]; // 模型只吐了一篇对象
      return null;
    }
    let arr = await once("");
    if (!arr || !arr.length) arr = await once("\n\n（上一次输出没能解析成合法 JSON 数组，请务必严格只输出 JSON 数组、别加任何解释文字。）");
    if (!arr || !arr.length) throw new Error("生成失败：模型没有返回可解析的篇目，可重试或换模型");
    const kept = arr.filter(function (x) { return x && (x.title || x.body); }).slice(0, n);
    function draftFor(i) {
      if (!batchCot) return null;
      const re = new RegExp("【第" + (i + 1) + "篇】([\\s\\S]*?)(?=【第\\d+篇】|$)");
      const m = String(batchCot).match(re);
      return m && m[1].trim() ? m[1].trim() : (kept.length === 1 ? batchCot : null);
    }
    return kept.map(function (x, i) {
      return {
        title: String(x.title || "无题").slice(0, 60),
        author: String(x.author || "佚名").slice(0, 20),
        tags: Array.isArray(x.tags) ? x.tags.filter(Boolean).slice(0, 6).map(String) : [],
        premise: String(x.premise || "").trim().slice(0, 200),  // 核心设定锚（续写防改设）
        body: String(x.body || "").trim(),
        endHook: String(x.endHook || "").trim(),
        cot: draftFor(i),
        cotRequested: !!cotT
      };
    });
  }

  // ---- 追更：append 一章（续写 = 前情摘要 + 上一章 endHook，不塞全文）----
  // opts: { style, perFic, chatMaterial }
  async function genNextChapter(active, fic, tab, cpChars, userName, worldbook, opts) {
    opts = opts || {};
    const perFic = clampPerFic(opts.perFic);
    const minWords = Math.max(600, Math.round(perFic * 0.55));
    const chapters = fic.chapters || [];
    const last = chapters[chapters.length - 1] || {};
    // 前情压缩摘要：标题 + tags + 每章 endHook 串起来（不塞全文，省 token）
    const priorHooks = chapters.map(function (c, i) {
      return "第" + (i + 1) + "章结束在：" + (c.endHook || "（无锚点）");
    }).join("\n");
    const cotChar = (cpChars && cpChars[0] && cpChars[0].name) || (fic.title || "主角");
    const cotT = (typeof cotThink === "function") ? cotThink({ char: cotChar, user: userName }) : "";
    // 上一章结尾原文（最后一段现场）：只给锚点一句话时模型爱跳时间线（上一章还暧昧、下一章直接事后）
    const lastTail = String(last.content || fic.body || "").trim().slice(-600);
    // 基本设定锚（v47.78 她点名修「第一章前未婚夫妻、第二章变青梅竹马」）：
    // 优先用生成时自报的 premise；老文没有就拿第一章开头当设定依据
    const premise = (fic.premise && String(fic.premise).trim()) || "";
    const ch1Head = String(((chapters[0] || {}).content || fic.body || "")).trim().slice(0, 500);
    const sys = buildGenSystem(tab, cpChars, userName, worldbook, opts) + "\n\n" +
      "【当前任务：给一篇已在连载的同人文续写下一章】\n" +
      "篇名《" + fic.title + "》，标签：" + (fic.tags || []).join("、") + "。\n" +
      "【本篇基本设定（地基·每一章都不许动）】\n" + (premise ? premise + "\n" : "") + (ch1Head ? "第一章开头（设定以此为准）：" + ch1Head + "……\n" : "") +
      "【改设禁令（比剧情更优先）】第一章确立的东西一个字不许变：两人的关系设定（开篇是前未婚夫妻就全程是前未婚夫妻，绝不许写成青梅竹马/前同事/初次见面）、双方身份职业、称呼、世界观、已发生的事实和时间线；tags 里的关系标签同样是铁律。写之前先对着上面的基本设定自查一遍，若你记忆中的前情与第一章开头冲突，一律以第一章开头为准。\n" +
      "【前情摘要（历章锚点，不含全文，你据此自然接续、保持人物与线索一致）】\n" + (priorHooks || "（这是第一章）") + "\n" +
      (lastTail ? "【上一章结尾原文（新章从这个现场往下写）】\n……" + lastTail + "\n" : "") +
      "【上一章的结尾锚点】\n" + (last.endHook || "（无，请自然开新章）") + "\n" +
      "【衔接与进度铁律（比字数更重要）】\n" +
      "· 新章开头必须与上面结尾原文【无缝衔接】：同一时间线自然往下走；确需转场，先用一两句交代过渡（过了几日／次日清晨），不许没头没尾直接跳到全新处境。\n" +
      "· 两人的感情与亲密进度只能【小步推进】：先判断上一章结束时处在什么阶段（暧昧、试探、刚点破、热恋…），这一章至多往前走一小步——绝不允许上一章还在暧昧、这一章开场就已发生关系或直接写事后；要到那一步，必须在章内写足完整的过程与铺垫。\n" +
      "· 中间若有时间跳跃，跳过的事只能是无关紧要的日常，关键情节（表白、第一次亲密、重大冲突）必须写出来，不许发生在幕后。\n\n" +
      (typeof cotSystemBlock === "function" ? cotSystemBlock(cotT) : "") +
      "【输出】只输出一个合法 JSON 对象，无 markdown：\n" +
      "{\"content\":\"这一章正文（成篇散文，承接上一章锚点往下推进、有实质剧情进展，约 " + minWords + " 字以上，分段用\\n\\n）\",\"endHook\":\"本章新的结尾锚点，供再下一章接续\"}" +
      (opts.style && opts.style.trim() ? fanficStyleTail(opts.style) : FANFIC_ANTI_CLICHE_TAIL);
    const userMsg = "续写《" + fic.title + "》的下一章。\n\n〔幕后提醒：本章的开头方式、句式节奏、意象和高频小动作【不许和前几章雷同】——连载越往后越容易一套模板，这章刻意换写法；反陈词滥调清单全程生效" + (cotT ? "；先交创作小稿再写正文" : "") + "。〕";
    // 从坏掉/被截断的 JSON 里抢救章节正文（长章节 JSON 常被截断解析失败，之前直接判「返回为空」白烧一次钱）
    function salvageChapter(clean, cot) {
      const s = String(clean || "");
      const m = s.match(/"content"\s*:\s*"([\s\S]*?)(?:"\s*,\s*"endHook"|"\s*\}\s*$|$)/);
      if (!m || !m[1] || m[1].length < 200) return null; // 太短不算章节，宁可重试
      const txt = m[1].replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\").trim();
      const hk = s.match(/"endHook"\s*:\s*"([\s\S]{1,200}?)"/);
      return { content: txt, endHook: hk ? hk[1].replace(/\\n/g, " ").trim() : "", cot: cot || null };
    }
    // 思考型模型预算别抠（占 maxTokens），太紧就返回空；解析失败先抢救正文、再不行才重试一次
    async function once(extra) {
      const raw = await callAI(active, sys + (extra || ""), [{ role: "user", content: userMsg }], { maxTokens: Math.min(FIC_TOKEN_MAX * 2, perFic + 10000), timeout: 300000 });
      const sp = (typeof splitCot === "function") ? splitCot(raw, !!cotT) : { cot: null, clean: raw };
      let d = extractJSON(sp.clean);
      if (!d && typeof repairJSON === "function") { try { d = JSON.parse(repairJSON(sp.clean)); } catch (e) {} }
      if (d && d.content) return { content: String(d.content).trim(), endHook: String(d.endHook || "").trim(), cot: sp.cot, cotRequested: !!cotT };
      return salvageChapter(sp.clean, sp.cot);
    }
    let out = await once("");
    if (!out) out = await once("\n\n（上一次输出为空或没能解析成合法 JSON，请务必严格只输出那一个 JSON 对象、正文写满，别加任何解释文字。）");
    if (!out) throw new Error("续写失败：模型返回为空，可再点一次重试");
    out.cotRequested = !!cotT;
    return out;
  }

  // ---- 书评：一次生成 N 条（NPC 泛读者 + 作者至少下场一次）------------
  async function genReviews(active, fic, tab, worldbook) {
    const excerpt = ((fic.chapters || [])[0] || {}).content || fic.body || "";
    const authorName = fic.author || ficPenName(fic.id);
    const sys = ANTI_CLICHE + "\n\n" + READER_VOICE + "\n\n" +
      "他们刚读完一篇发在【" + tab.name + "】同人版、作者笔名「" + authorName + "」的同人文《" + fic.title + "》（标签：" + (fic.tags || []).join("、") + "）。" +
      "下面是正文节选，据此写具体的书评/短评（可夸可挑刺可玩梗可催更），别泛泛，别剧透式复述剧情。\n" +
      "【正文节选】\n" + String(excerpt).slice(0, 1200) + "\n\n" +
      "【输出】只输出合法 JSON 数组，5-8 条书评：\n" +
      "[{\"author\":\"读者马甲（同人圈网名，别用真名，别带@）\",\"content\":\"书评正文\",\"replies\":[{\"author\":\"另一读者马甲\",\"content\":\"楼中楼回复\",\"isAuthor\":false}]}]\n" +
      "**其中必须至少有一条**（某条书评本身、或某条楼中楼回复）是作者「" + authorName + "」本人下场回复读者的——署名就写「" + authorName + "」、把那条的 isAuthor 设为 true，像作者回评那样（道谢/回应读者的梗/害羞解释/回怼黑评，符合太太本人语气）。其余 replies 大多留空，只 1-2 条带楼中楼。语气各异别雷同。";
    const raw = await callAI(active, sys, [{ role: "user", content: "给《" + fic.title + "》写书评，记得作者「" + authorName + "」要下场至少回一句。" }], { maxTokens: 11200 });
    let d = extractJSON(raw);
    if (!d && typeof repairJSON === "function") { try { d = JSON.parse(repairJSON(raw)); } catch (e) {} }
    const arr = Array.isArray(d) ? d : (d && Array.isArray(d.items) ? d.items : []);
    return arr.filter(function (x) { return x && x.content; }).slice(0, 10).map(function (x) {
      return {
        id: uid("rv"),
        author: String(x.author || "路人读者").slice(0, 20),
        isAuthor: !!x.isAuthor || String(x.author || "") === authorName,
        content: String(x.content).trim(),
        replies: Array.isArray(x.replies) ? x.replies.filter(function (r) { return r && r.content; }).slice(0, 4).map(function (r) {
          return { id: uid("rp"), author: String(r.author || "路人读者").slice(0, 20), isAuthor: !!r.isAuthor || String(r.author || "") === authorName, content: String(r.content).trim() };
        }) : []
      };
    });
  }

  // ---- 我评论/回复 → 生成 NPC（含作者）的回复（item 3）--------------
  // 返回 [{id,author,content,isAuthor}]；挂到我那条书评/楼层的 replies 下
  async function genReplyToUser(active, fic, tab, myText, threadCtx) {
    const authorName = fic.author || ficPenName(fic.id);
    const excerpt = ((fic.chapters || [])[0] || {}).content || fic.body || "";
    const sys = ANTI_CLICHE + "\n\n" + READER_VOICE + "\n\n" +
      "在同人文《" + fic.title + "》（作者「" + authorName + "」）的书评区，一个读者刚发了下面这条评论/回复，其他读者和作者本人陆续来接话。\n" +
      (threadCtx ? "【所在楼层的上文】\n" + threadCtx + "\n" : "") +
      "【正文节选（供理解在聊什么）】\n" + String(excerpt).slice(0, 700) + "\n" +
      "【读者刚发的这条】\n" + myText + "\n\n" +
      "【输出】只输出合法 JSON 数组，2-4 条回复这条评论的话（自然接话/共鸣/抬杠/补充/玩梗）：\n" +
      "[{\"author\":\"马甲\",\"content\":\"回复\",\"isAuthor\":false}]\n" +
      "**其中让作者「" + authorName + "」本人至少回一条**（那条 author 写「" + authorName + "」、isAuthor 设 true）。别都一个腔调，别客服腔。";
    const raw = await callAI(active, sys, [{ role: "user", content: "针对这条评论生成回复。" }], { maxTokens: 12000 });
    let d = extractJSON(raw);
    if (!d && typeof repairJSON === "function") { try { d = JSON.parse(repairJSON(raw)); } catch (e) {} }
    const arr = Array.isArray(d) ? d : (d && Array.isArray(d.items) ? d.items : []);
    return arr.filter(function (x) { return x && x.content; }).slice(0, 5).map(function (x) {
      return { id: uid("rp"), author: String(x.author || "路人读者").slice(0, 20), isAuthor: !!x.isAuthor || String(x.author || "") === authorName, content: String(x.content).trim() };
    });
  }

  // ============================================================
  // 穿书（互动叙事 RP 引擎）—— 玩家穿进一篇收藏的同人文，AI 抛决策点、玩家自由输入行动
  // ⚠️存储键 x_fanfic_rp 和 mode key 不跟着改名——那是存档，改了旧档就读不出来了
  // ============================================================
  const K_RP = "x_fanfic_rp"; // 存档数组
  function loadRP() { return loadJSON(K_RP, []); }
  // 📚 累积层：存档留最近 30 局（.claude/rules/phone-data-layers.md）。
  // 每局带整份 transcript，不封顶就是又一座坟场。
  const RP_KEEP = 30;
  function saveRP(list) {
    const a = Array.isArray(list) ? list : [];
    saveJSON(K_RP, a.length <= RP_KEEP ? a
      : a.slice().sort(function (x, y) {
        // ⚠️存档里没有 ts，只有 createdAt/updatedAt。写 ts 的话这个排序全是 0−0，
        // 静默空转，留下哪 30 局全看数组本来什么顺序。
        return (y.updatedAt || y.createdAt || 0) - (x.updatedAt || x.createdAt || 0);
      }).slice(0, RP_KEEP));
  }
  const RP_MODES = [
    { key: "left", label: "魂穿 · CP 左位", short: "魂穿左位" },
    { key: "right", label: "魂穿 · CP 右位", short: "魂穿右位" },
    // ⚠️passerby 留在表里【只为了老存档还认得出这个字】，选单里不再出现
    //   （她 2026-09-03：「天降路人删了吧就留一个随机」）——它和 random 本来就
    //   高度重合：random 抽出来的多半也是个路人，多这一档只是让人多做一次选择。
    { key: "passerby", label: "天降 · 路人 / 配角", short: "天降路人", legacy: true },
    { key: "random", label: "天降 · 随机身份", short: "天降随机" }
  ];
  function rpModeLabel(key) { const m = RP_MODES.find(function (x) { return x.key === key; }); return m ? m.short : key; }
  // 短名（存档行、穿书中那一屏顶上）也要写真名——她 2026-09-03：「这里没改呢」。
  // 拿不到 cpChars 的地方仍旧回落到 rpModeLabel，不至于空着。
  function rpModeShort(key, cpChars) {
    const a = cpChars && cpChars[0], b = cpChars && cpChars[1];
    const c = key === "left" ? a : key === "right" ? b : null;
    if (key === "left" || key === "right") return c ? (c.isMe ? "我自己" : c.name) : rpModeLabel(key);
    return rpModeLabel(key);
  }
  // ── 选项这一屏改了两处（v60.91，她 2026-09-03「这几样我都是直接参考了别人的」）──
  // 「魂穿 / 天降」这几个词不算抄——它们是同人圈的通用说法，跟 AU、年下一样。
  // 真正的毛病是另外两件：
  //   ① 「CP 左位 / 右位」是废话：这两个人的名字代码里明明拿得到，而且这篇的 CP
  //      就是【她和她的角色】——「左位」其实是「穿成我自己」。这个落差别家没有，
  //      却被两个抽象词盖掉了。所以按钮上直接写名字。
  //   ② 四个选项全在问【你是谁】，没有一个在问【你知道多少】。而「带着剧透穿进去」
  //      才是穿书这个题材最核心的乐趣。所以补上第二排：你带着什么进去。
  function rpModeText(key, cpChars) {
    const a = cpChars && cpChars[0], b = cpChars && cpChars[1];
    const who = function (c, fallback) {
      if (!c) return fallback;
      return c.isMe ? "穿成我自己（" + c.name + "）" : "穿成 " + c.name;
    };
    if (key === "left") return who(a, "魂穿 · 左位");
    if (key === "right") return who(b, "魂穿 · 右位");
    return rpModeLabel(key) === key ? key : (RP_MODES.find(function (x) { return x.key === key; }) || {}).label || key;
  }
  // 你带着什么进去。⚠️「带着现实的记忆」不是去翻主线记忆库——同人文是平行时空沙盒
  // （.claude/rules/four-surfaces-same-context.md 里那条合法差异），这一档只是给这场戏
  // 一个前提：你记得，这个世界里的他不记得。落差本身就是戏，不需要真去读记忆。
  const RP_KNOWS = [
    { key: "blank", label: "空手进去", short: "空手", desc: "你对这个故事一无所知，跟里面的人一样两眼一抹黑，只能边走边猜。" },
    { key: "spoiler", label: "带着剧透", short: "带剧透", desc: "你读完过这篇文，知道后面会发生什么、谁会说哪句话、哪一步是坑。你可以顺着走，也可以提前去拆它。" },
    { key: "real", label: "带着现实里的记忆", short: "带记忆", desc: "你记得现实里你和 TA 真正的关系——但这个世界里的 TA 完全不认识你。" }
  ];
  function rpKnowLabel(key) { const k = RP_KNOWS.find(function (x) { return x.key === key; }); return k ? k.short : ""; }
  function rpKnowLine(know, mode, cpChars, userName) {
    const k = RP_KNOWS.find(function (x) { return x.key === know; });
    if (!k || k.key === "blank") return "";   // 老存档没有这一栏：不发，保持原来的样子
    if (k.key === "spoiler") {
      return "【玩家带进去的东西 · 剧透】" + k.desc
        + "\n所以：玩家可能会做出【只有读过这篇文的人才做得出】的举动——提前挡在某个人前面、把某句话抢在他之前说、绕开原著里那个坑。"
        + "你要如实承接这种「他怎么会知道」的怪异感：场上的人不知道玩家为什么这么笃定，他们会觉得奇怪、会追问、会起疑。"
        + "但**你不许替玩家把剧透说出来**，也不许在正文里提示「按原著接下来会……」——玩家知道什么、用不用，是玩家自己的事。";
    }
    const other = rpOther(mode, cpChars);
    return "【玩家带进去的东西 · 现实里的记忆】" + k.desc
      + (other ? "这个世界里的「" + other.name + "」不认识玩家，也没有那段关系——他就是原著里的他。" : "")
      + "\n所以这一场的底色是【一边记得、一边不记得】：玩家可能会脱口而出只有他俩才懂的话、下意识做熟悉的动作，"
      + "而对面只会当成一个陌生人的冒犯或古怪。别把这层落差写成煽情的旁白，让它从对方的困惑和玩家的失手里自己露出来。"
      + "⚠️这个世界是平行的：不许直接引用现实里发生过的具体事件当剧情，只有玩家自己心里记得。";
  }
  // 玩家固定扮演谁（魂穿=某主角名；天降=session.playerIdentity.name）
  function rpPlayerName(mode, cpChars, identity) {
    const a = cpChars[0], b = cpChars[1];
    if (mode === "left") return a ? a.name : "左位主角";
    if (mode === "right") return b ? b.name : "右位主角";
    return identity && identity.name ? identity.name : null;
  }
  function rpOther(mode, cpChars) { // 魂穿时的"对方"（另一位主角）
    if (mode === "left") return cpChars[1] || null;
    if (mode === "right") return cpChars[0] || null;
    return null;
  }
  function rpRoleDesc(mode, cpChars, userName, identity) {
    const a = cpChars[0], b = cpChars[1];
    if (mode === "left") return "玩家【魂穿成主角「" + (a ? a.name : "左位主角") + "」】——顶着 TA 的身份、外壳、人际关系登场，但言行与选择完全由玩家真实决定，可以偏离 TA 的原设（这正是穿书的乐趣）。" + (b ? "另一位主角「" + b.name + "」是对方，由你（引擎）扮演的 NPC。" : "");
    if (mode === "right") return "玩家【魂穿成主角「" + (b ? b.name : "右位主角") + "」】——顶着 TA 的身份登场，但言行由玩家决定，可偏离原设。" + (a ? "另一位主角「" + a.name + "」是对方，由你扮演的 NPC。" : "");
    if (mode === "passerby") return identity && identity.name
      ? "玩家【天降成「" + identity.name + "」】——" + (identity.role || "一个闯入这个世界的路人 / 配角") + "。原著里本没有 TA，全程就是这个固定身份，【绝不会变成原著里的主角，也绝不是现实里操作游戏的那个人】。"
      : "玩家【天降成一个路人 / 配角】——原著里本没有 TA，作为闯入这个世界的新角色出现（开场给 TA 一个合理身份，之后固定不变）。";
    return identity && identity.name
      ? "玩家【天降身份：「" + identity.name + "」】——" + (identity.role || "一个合理有趣的身份") + "。全程固定，【绝不会变成原著主角，也绝不是现实里操作游戏的那个人】。"
      : "玩家【天降 · 随机身份】——开场为玩家安排一个合理又有趣的固定身份，一旦定下全程不变。";
  }
  const RP_RULES = "【引擎规则（严格遵守）】\n" +
    "1. 用第二人称称呼玩家（『你』）。你负责描写场景、推进剧情、演其他所有角色（各守人设声纹）。\n" +
    "2. 【身份绝对固定】玩家自始至终就是那一个人（见身份锚点），第二人称『你』永远指 TA；【绝对不许中途把玩家换成别的角色、也不许把 CP 两人的位置对调】。玩家魂穿的是哪一位，就一直是哪一位；另一位始终是『对方』、是你扮演的 NPC，绝不和玩家混同。\n" +
    "3. 绝不替玩家决定行动、不替玩家说话、不替玩家做选择。每一回合结尾都落在一个【需要玩家做出反应/抉择的处境】上，用叙事把玩家逼到要开口/行动的当口，然后停下——别用『选项A/B』『决策点：』这种标签，自然地把球交回玩家。\n" +
    "4. 玩家输入行动后，合理承接、展开后果、让相关角色按人设真实反应，推进一段（两三百字）再抛出下一个抉择处境。\n" +
    "5. 尊重玩家的选择哪怕大幅偏离原著——原著是底子不是铁轨，玩家在改写它；但人物性格与世界设定要连贯。\n" +
    "6. 只输出叙事正文，不要任何元信息、标题、格式标签，也别替玩家总结心情。";
  function rpStory(fic) { return (fic.chapters || []).map(function (c, i) { return "〔第" + (i + 1) + "章〕\n" + (c.content || ""); }).join("\n\n"); }
  function rpAnchorLine(mode, cpChars, identity) {
    const me = rpPlayerName(mode, cpChars, identity), other = rpOther(mode, cpChars);
    if (me) return "【身份锚点（全程不变）】玩家 = 「" + me + "」，第二人称『你』永远指 " + me + "。绝不把玩家换成原著里的别的角色，也绝不当成现实里操作游戏的那个人（哪怕上下文里出现过别的名字，也不许拿来套在玩家头上）。" + (other ? "另一位「" + other.name + "」是对方 / NPC，绝不和玩家对调或混同。" : "");
    return "【身份锚点（全程不变）】玩家 = 你在开场为其设定的那个天降身份，第二人称『你』永远指这个身份，中途绝不更换、绝不变成原著主角或现实用户本人。";
  }
  // 天降模式：先确定玩家这次的固定身份（一个具体名字），供全程锚定
  async function genRPIdentity(active, fic, tab, cpChars, mode, landing, userName, worldbook) {
    const sys = ANTI_CLICHE + "\n\n你在为一场穿书互动叙事【确定玩家这次的固定身份】。穿进去的方式：" + rpRoleDesc(mode, cpChars, userName, null) +
      "\n世界观：" + tab.name + "。降落点：「" + (landing && landing.label || "") + "」——" + (landing && landing.scene || "") +
      (worldbook && worldbook.trim() ? "\n【全局世界书（这个身份要合得上里面的设定与禁忌）】\n" + worldbook.trim().slice(0, 3000) : "") +
      "\n【原著正文节选】\n" + rpStory(fic).slice(0, 2500) +
      "\n\n给玩家安排一个具体、贴合这个世界观的固定身份（" + (mode === "passerby" ? "一个原著里没有的路人 / 配角" : "一个合理有趣的身份，可与原著相关也可全新") + "）。这个身份不能是原著已有的两位主角、也不能叫『" + (userName || "用户") + "』。\n" +
      "只输出 JSON：{\"name\":\"这个身份的名字 / 称谓\",\"role\":\"一句话身份说明（职业 / 处境 / 和主角是什么关系或毫无关系）\"}";
    const raw = await callAI(active, sys, [{ role: "user", content: "定身份。" }], { maxTokens: 8400 });
    let d = extractJSON(raw);
    if (!d && typeof repairJSON === "function") { try { d = JSON.parse(repairJSON(raw)); } catch (e) {} }
    if (d && d.name) return { name: String(d.name).slice(0, 20), role: String(d.role || "").slice(0, 90) };
    return { name: "无名路人", role: "一个刚好路过的陌生人" };
  }
  function buildRPSystem(fic, tab, cpChars, mode, userName, worldbook, style, identity, know) {
    // 穿书 RP 里用户真的在场跟角色互动，性质同线下，所以连语气与年龄感锚一起带
    const parts = [narrativeCore({ intimate: true }), FANFIC_ANTI_CLICHE];
    parts.push("【穿书 · 互动叙事引擎】玩家『穿』进了一篇同人文里，你是这场互动叙事（类 CYOA 文字游戏）的引擎 / GM。");
    parts.push("【世界观：" + tab.name + "】\n" + (tab.desc || "（无额外设定）"));
    // ⚠️天降模式下玩家【就是】场上的第三个人，这时绝不能发 cpBlock 那条
    // 「读者/『我』不出场、不作为角色写进去」的尾巴——那和身份锚点正面打架，
    // 一份 system 里同时说「你是闯进来的路人」和「读者不出场」，模型必然写歪。
    // includeMe 本来就是「把『我』作为第三方写进去」那个开关，正对上这里。
    const playerIsThirdParty = mode === "passerby" || mode === "random";
    parts.push(cpBlock(cpChars, playerIsThirdParty
      ? { includeMe: true, meName: (identity && identity.name) || userName || "我", mePersona: "" }
      : {}));
    parts.push("【玩家的身份 / 穿进去的方式】" + rpRoleDesc(mode, cpChars, userName, identity));
    parts.push(rpAnchorLine(mode, cpChars, identity));
    { const kl = rpKnowLine(know, mode, cpChars, userName); if (kl) parts.push(kl); }
    if (style && style.trim()) parts.push("【文风】\n" + style.trim());
    // ⚠️世界书：这个参数一路从 RPApp 传到这儿，然后【从没被引用过】——
    // 声明了但没人用，比压根没写更坏，看代码以为已经在发了
    // （.claude/rules/four-surfaces-same-context.md v55.95 那条）。
    // 同一个模块里 genBatch 一直在发，只有穿书这条链漏了。
    if (worldbook && worldbook.trim()) {
      if (typeof WORLDBOOK_RULE !== "undefined") parts.push(WORLDBOOK_RULE);
      parts.push("【全局世界书（严格遵循：其中的设定/文风/禁忌一律照做；仅当与本版世界观正面冲突时才以本版为准）】\n" + worldbook.trim());
    }
    parts.push("【原著正文（你的剧情底子；玩家的选择可改写走向，但人物设定要连贯）】\n" + rpStory(fic).slice(0, 6000));
    parts.push(RP_RULES);
    return parts.join("\n\n");
  }
  // 生成可选降落节点（3-4 个）
  // 不收 worldbook：降落点是【从原著正文里挑】的，那些场景本来就已经合着世界书写成了。
  // 留一个没人引用的参数比缺一层更坏——看代码会以为它在发。
  async function genLandings(active, fic, tab, cpChars, mode, userName, know) {
    const sys = ANTI_CLICHE + "\n\n你在为一场『穿书』的互动叙事挑【降落节点】。玩家会这样穿进去：" + rpRoleDesc(mode, cpChars, userName) +
      (rpKnowLine(know, mode, cpChars, userName) ? "\n" + rpKnowLine(know, mode, cpChars, userName) : "") +
      "\n世界观：" + tab.name + "。\n【原著正文】\n" + rpStory(fic).slice(0, 5000) +
      "\n\n从原著里挑 3-4 个适合玩家空降切入、有戏剧张力的场景当可选起点（可以是原著已有的关键场景，也可以是其缝隙里合理的时刻）。\n" +
      "只输出合法 JSON 数组：[{\"label\":\"简短场景名（≤10字）\",\"scene\":\"用【完整的一两句话】说明这个节点是什么处境、在故事哪个位置，约 20-40 字，务必把话说完整、别断在半句\"}]";
    const raw = await callAI(active, sys, [{ role: "user", content: "给降落节点。" }], { maxTokens: 9600 });
    let d = extractJSON(raw);
    if (!d && typeof repairJSON === "function") { try { d = JSON.parse(repairJSON(raw)); } catch (e) {} }
    const arr = Array.isArray(d) ? d : (d && Array.isArray(d.items) ? d.items : []);
    // 不硬截断成半句：只在超长时于句读处截，末尾补省略号
    const trimScene = function (s) {
      s = String(s || "").trim();
      if (s.length <= 60) return s;
      const cut = s.slice(0, 60);
      const m = cut.match(/^[\s\S]*[。！？…，、；]/);
      return (m ? m[0] : cut) + "…";
    };
    const out = arr.filter(function (x) { return x && x.label; }).slice(0, 4).map(function (x) { return { id: uid("ld"), label: String(x.label).slice(0, 16), scene: trimScene(x.scene) }; });
    if (!out.length) out.push({ id: uid("ld"), label: "从头开始", scene: "从故事最初的场景切入" });
    return out;
  }
  // 组 RP 对话 messages（transcript 尾巴 + 本次行动）
  // ⚠️原来是死板的 slice(-10)。一条叙事两三百字，十条≈五个回合——
  // 玩到第六回合，前面做过的一切【一点痕迹都不留】，模型会把玩家早先的选择当没发生。
  // 改成两件事：
  //   ① 窗口按【字数预算】收，短回合能多留几轮；
  //   ② 掉出窗口的那些【玩家自己的行动】压成一行前情带回去。
  //      只带玩家的行动、不带叙事：玩家做过什么才是这场的骨头，
  //      而且这条是本地拼的，不额外调一次模型（她按次计费）。
  const RP_WINDOW_CHARS = 9000;
  const RP_WINDOW_MIN = 10;     // 再长也至少留这么多条，别把最近几轮也挤掉
  const RP_RECAP_CHARS = 1200;
  function rpMessages(session, newAction) {
    const all = session.transcript || [];
    let chars = 0, cut = all.length;
    for (let i = all.length - 1; i >= 0; i--) {
      const c = String(all[i].text || "").length + 24;
      if (all.length - i > RP_WINDOW_MIN && chars + c > RP_WINDOW_CHARS) break;
      chars += c; cut = i;
    }
    const msgs = [];
    const dropped = all.slice(0, cut).filter(function (e) { return e.who === "me"; });
    if (dropped.length) {
      let recap = dropped.map(function (e) { return String(e.text || "").trim().replace(/\s+/g, " ").slice(0, 90); })
        .filter(Boolean).join("；");
      if (recap.length > RP_RECAP_CHARS) recap = "…" + recap.slice(-RP_RECAP_CHARS);
      msgs.push({ role: "user", content: "【前情提要 · 更早之前我做过的事，按先后】" + recap
        + "\n（这些已经发生过了，别当成新指令重演一遍；接着往下就好。）" });
    }
    all.slice(cut).forEach(function (e) {
      if (e.who === "nar") { const last = msgs[msgs.length - 1]; if (last && last.role === "assistant") last.content += "\n\n" + e.text; else msgs.push({ role: "assistant", content: e.text }); }
      else msgs.push({ role: "user", content: "【我的行动】" + e.text });
    });
    if (newAction != null) msgs.push({ role: "user", content: "【我的行动】" + newAction });
    return msgs;
  }
  // 开场：安置玩家进降落节点，收在第一个抉择处境
  async function genRPStart(active, session, fic, tab, cpChars, userName, worldbook, perFic) {
    const id = session.playerIdentity;
    const sys = buildRPSystem(fic, tab, cpChars, session.mode, userName, worldbook, session.style, id, session.know) +
      "\n\n【本场起点】玩家从这个节点空降：「" + session.landing.label + "」——" + session.landing.scene +
      "\n\n现在写【开场】：用两三段把玩家安置进这个场景（" + (id ? "玩家这次的固定身份是「" + id.name + "」（" + id.role + "），开场自然点明并让 TA 入场" : "以玩家的身份视角") + "），营造氛围、带出在场关键人物，最后自然收在一个需要玩家做出反应/抉择的处境上，然后停下等玩家开口。";
    const raw = await callAI(active, sys, [{ role: "user", content: "开始这场穿书。" }], { maxTokens: Math.max(12000, Math.min(20000, (perFic || 3000) + 8000)) });
    return String(raw || "").trim();
  }
  // 玩家行动 → 推进 + 下一个抉择处境
  async function genRPTurn(active, session, fic, tab, cpChars, userName, worldbook, userAction, perFic) {
    const sys = buildRPSystem(fic, tab, cpChars, session.mode, userName, worldbook, session.style, session.playerIdentity, session.know) +
      "\n\n【本场起点】「" + session.landing.label + "」——" + session.landing.scene +
      "\n承接玩家最新的行动，推进剧情、让相关角色真实反应，写两三百字，再自然收在下一个需要玩家抉择的处境上停下。\n" + rpAnchorLine(session.mode, cpChars, session.playerIdentity) + "（切记：别把玩家换人、别对调 CP 位置、别把玩家当成现实用户本人。）";
    const raw = await callAI(active, sys, rpMessages(session, userAction), { maxTokens: Math.max(11000, Math.min(20000, (perFic || 2400) + 8000)) });
    return String(raw || "").trim();
  }

  // 编个热度数字（稳定：按 id 派生），feed 展示用
  // ⚠️两项各用一个独立种子、且必须走 ficHash（FNV-1a）：
  // 原来是 h*31+c 再取模，"f2"/"f3"/"f4" 只差 1，%4000 之后还是只差 1，
  // 三篇文一整列全是「3.2k」——一眼假。hits 用 h>>3 同理，丢的是低位。
  function ficHeat(seed) {
    return { kudos: 30 + ficHash("kudos:" + seed) % 4000, hits: 500 + ficHash("hits:" + seed) % 90000 };
  }

  // ---- 暴露 --------------------------------------------------
  window.Fanfic = {
    loadTabs: loadTabs, saveTabs: saveTabs, loadFics: loadFics, saveFics: saveFics,
    loadCPs: loadCPs, saveCPs: saveCPs, loadCfg: loadCfg, saveCfg: saveCfg, activeStyleText: activeStyleText,
    allStylePresets: allStylePresets, styleTextForIds: styleTextForIds,
    loadMe: loadMe, saveMe: saveMe, meProfile: meProfile, protectedFic: protectedFic,
    chatMaterialFor: chatMaterialFor,
    genBatch: genBatch, genNextChapter: genNextChapter, genReviews: genReviews, genReplyToUser: genReplyToUser,
    loadRP: loadRP, saveRP: saveRP, genLandings: genLandings, genRPIdentity: genRPIdentity, genRPStart: genRPStart, genRPTurn: genRPTurn, rpModeLabel: rpModeLabel, rpModeText: rpModeText, rpModeShort: rpModeShort, rpKnowLabel: rpKnowLabel, RP_KNOWS: RP_KNOWS
  };

  // ============================================================
  // UI
  // ============================================================
  function fmtNum(n) { return n >= 10000 ? (n / 10000).toFixed(1) + "w" : n >= 1000 ? (n / 1000).toFixed(1) + "k" : String(n); }
  // 稳定 hash：同一个 id 永远得到同一个笔名、同一批数字
  // FNV-1a + 一步雪崩。⚠️别用 h*31+c 那种：它对相似的输入低位有结构，
  // f5/f10、f6/f11、f7/f12 会连着撞出同一个笔名（实测踩到）。
  function ficHash(s) {
    let h2 = 2166136261 >>> 0;
    s = String(s || "");
    for (let i = 0; i < s.length; i++) { h2 ^= s.charCodeAt(i); h2 = Math.imul(h2, 16777619) >>> 0; }
    h2 ^= h2 >>> 13; h2 = Math.imul(h2, 0x5bd1e995) >>> 0; h2 ^= h2 >>> 15;
    return h2 >>> 0;
  }
  // ---- AO3 那套标签分色（她 2026-08-29：「可以参考 ao3 的页面」）----------
  // AO3 最认得出的三样：左边的分级色条、成堆的分色标签、底下那行统计数字。
  // 标签按【它在提醒你什么】分色，不是随便配色：
  //   预警＝要不要做好心理准备 · 糖＝放心看 · 结构＝这篇是什么写法 · 其余中性
  const FIC_TAG_KINDS = [
    [/BE|be预警|虐|刀|慎入|预警|黑化|病娇|死亡|失忆|悲|致郁/i, "warn"],
    [/HE|he|甜|糖|治愈|日常|温馨|轻松|沙雕|团圆/i, "sweet"],
    [/IF线|AU|au|穿越|穿书|重生|架空|书信体|第一人称|群像|年下|年上|先婚|abo|ABO|无限流/i, "form"]
  ];
  function ficTagKind(tag) {
    const s = String(tag || "");
    for (const [re, k] of FIC_TAG_KINDS) if (re.test(s)) return k;
    return "plain";
  }
  // 深卡上那三档要提亮：#a4342c 这种压在 t.ink 底上几乎读不出来
  function ficTagStyle(kind, t, onDark) {
    const c = onDark
      ? { warn: "#e8907e", sweet: "#a8c47e", form: "#93b4d6" }
      : { warn: "#a4342c", sweet: "#5d7a3f", form: "#4a6484" };
    const wrap = function (hex, a1, a2) { return { color: hex, background: hexA(hex, onDark ? .14 : a1), border: "1px solid " + hexA(hex, onDark ? .34 : a2) }; };
    if (kind === "warn") return wrap(c.warn, .09, .22);
    if (kind === "sweet") return wrap(c.sweet, .10, .24);
    if (kind === "form") return wrap(c.form, .09, .22);
    return { color: onDark ? "rgba(255,255,255,.5)" : t.fog, background: "transparent", border: "1px solid " + (onDark ? "rgba(255,255,255,.2)" : t.line) };
  }
  function hexA(hex, a) { return "rgba(" + skinRGB(hex).join(",") + "," + a + ")"; }
  // 卡片的深浅两套 token。
  // ⚠️深＝t.ink 底，浅＝t.bg2 底，两套都从主题算：浅色主题里 ink 是深的（深卡压在浅页上），
  // 深色主题里 ink 是浅的（浅卡压在深页上）——反正永远是【和页面拉开对比的那一块】，
  // 不写死黑白，她把主题调成什么样这套都成立。
  function ficTone(dark, t) {
    if (!dark) return { onDark: false, bg: t.bg2, ink: t.ink, sub: t.sub, fog: t.fog, line: t.line, cp: t.accent, num: t.fog };
    // ⚠️纸本来就是深的（深夜／墨蓝）时，「高对比那一块」不能再拿 t.ink 当底——
    // ink 在深色纸上是【浅】的，做出来就是一大块亮米色怼在脸上，
    // 关灯读正好晃眼，等于把深夜模式做废了。
    // 深纸上改成【比纸再沉一档】：还是拉得开，但整页仍然是暗的。
    if (skinIsDark(t.bg)) {
      const lit = "rgba(" + skinRGB(t.ink).join(",") + ",";
      return { onDark: true, bg: skinShade(t.bg, -0.34), ink: t.ink, sub: t.sub, fog: t.fog, line: lit + ".14)", cp: t.accent, num: lit + ".30)" };
    }
    const on = "rgba(" + skinRGB(t.bg2).join(",") + ",";
    return { onDark: true, bg: t.ink, ink: t.bg2, sub: on + ".78)", fog: on + ".46)", line: on + ".18)", cp: "#e8907e", num: on + ".32)" };
  }
  // 往黑里压 / 往白里提一档（k<0 变暗，k>0 变亮）
  function skinShade(hex, k) {
    const c = skinRGB(hex).map(function (v) { return Math.max(0, Math.min(255, Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k))); });
    return "rgb(" + c.join(",") + ")";
  }
  // 作者笔名：原先一律「佚名」，一整页看下来像没人写过（AO3 上作者名是最抢眼的一行）。
  // 按 id 派生一个稳定的中文笔名——同一篇永远同一个人，同一个人写的几篇天然聚在一起。
  const PEN_A = ["三更", "不周", "南风", "旧岁", "长安", "青隅", "半盏", "拾叁", "无尽", "白露", "枕流", "临江", "十七", "淮南", "云间", "折戟", "寒山", "扶苏",
    "空山", "夜航", "松间", "槐序", "洛水", "秋渡", "斜阳", "北窗", "廿一", "残章", "微雨", "陈酿"];
  const PEN_B = ["雪", "灯下", "客", "未眠", "旧梦", "书", "生", "无恙", "不归", "记", "拾遗", "手记", "旧事", "同学", "小酌", "闲笔",
    "又及", "在读", "补记", "眠", "抄书", "候场", "写字", "打烊"];
  function ficPenName(seed) {
    // 两截各用一个【独立的种子】，不是同一个 hash 移位——
    // 移位丢掉的是低位，剩下的高位对相邻 id 几乎不变，八篇能撞出同一个后缀（实测踩到）。
    return PEN_A[ficHash("pen:" + seed) % PEN_A.length]
      + PEN_B[ficHash("nib:" + seed) % PEN_B.length];
  }
  // 这一篇的字数（AO3 统计行里最要紧的那个数）
  function ficWords(f) {
    const chs = (f && f.chapters) || [];
    const n = chs.reduce(function (a, c) { return a + String((c && c.content) || "").replace(/\s/g, "").length; }, 0);
    return n || String((f && f.body) || "").replace(/\s/g, "").length;
  }
  // CP 里有没有「我」——这是这个 app 和 AO3 不一样的地方：
  // 书架上有一半的文是写你们俩的，那一半该一眼看得出来。
  function ficHasMe(f) { return ((f && f.cp) || []).indexOf("me") >= 0; }
  // cp token：charId | "me"（我·面具人设）；空数组=原创向。
  function meChar(profile) { return { id: "me", name: (profile && profile.name) || "我", persona: (profile && profile.persona) || "", isMe: true }; }
  function cpLabel(cp, characters, userName) {
    if (!cp || !cp.length) return "原创向";
    const nameOf = function (tok) { if (tok === "me") return userName || "我"; const c = characters.find(function (x) { return x.id === tok; }); return c ? c.name : "原创"; };
    if (cp.length === 1) return nameOf(cp[0]) + " × 原创";
    return nameOf(cp[0]) + " × " + nameOf(cp[1]);
  }
  // CP 下拉里的选项：真人角色在前，配角归到「配角」一组并标上是谁身边的人。
  // 不分组的话一长串名字里认不出哪个是配角、属于谁。
  function cpOptions(characters, userName) {
    const all = characters || [];
    const live = all.filter(function (c) { return c && !c.npc; });
    const npcs = all.filter(function (c) { return c && c.npc; });
    const one = function (c, suffix) { return h("option", { key: c.id, value: c.id }, c.name + (suffix || "")); };
    const out = [h("option", { key: "_orig", value: "" }, "原创角色"),
      h("option", { key: "_me", value: "me" }, "我（" + (userName || "我") + "）")];
    live.forEach(function (c) { out.push(one(c)); });
    if (npcs.length) {
      out.push(h("optgroup", { key: "_npc", label: "配角" }, npcs.map(function (c) {
        const owner = live.find(function (x) { return String(x.id) === String(c.ownerId); });
        return one(c, owner ? "（" + owner.name + "身边）" : "");
      })));
    }
    return out;
  }
  function cpChars(cp, characters, profile) {
    return (cp || []).map(function (tok) { return tok === "me" ? meChar(profile) : characters.find(function (c) { return c.id === tok; }); }).filter(Boolean);
  }

  // ---------- feed 卡片（AO3 那套信息架构）----------
  // 她 2026-08-29：「参考 ao3 的页面再加点我们之间的设计」。
  // AO3 的作品卡最认得出的是三样：左边一道分级色条、成堆的分色标签、
  // 底下那行 Words · Chapters · Kudos。原先这张卡里标题/CP/作者/摘要/标签
  // 一律差不多大小，一眼扫过去分不出主次。
  // 「我们之间的设计」＝那道色条标的不是分级，是【这篇里有没有我】。
  function FicTag(props) {
    const t = useTheme();
    const st = ficTagStyle(ficTagKind(props.tag), t, !!props.onDark);
    return h(props.onClick ? "button" : "span", {
      onClick: props.onClick ? function (e) { e.stopPropagation(); props.onClick(props.tag); } : undefined,
      className: props.onClick ? "active:opacity-60" : "",
      style: Object.assign({ fontFamily: F_BODY, fontSize: 10, borderRadius: 4, padding: "1.5px 7px", whiteSpace: "nowrap" }, st)
    }, props.tag);
  }
  function FicCard(props) {
    const t = useTheme();
    const f = props.fic, characters = props.characters;
    const heat = f.stats || ficHeat(f.id);
    const chCount = (f.chapters || []).length;
    const mine = f.source === "user";
    const hasMe = ficHasMe(f);
    const author = f.author || (mine ? (props.userName || "我") : ficPenName(f.id));
    const words = ficWords(f);
    // 深浅交替＋序号，全部【由它此刻排在第几位算出来】，不存在文章上。
    // 于是删掉一篇，下面那篇顶上来就自动变色、序号也跟着重排；
    // 按标签筛、搜索之后同理——index 是【当前这一屏】的位置，不是它在库里的位置。
    const idx = Number(props.index) || 0;
    const isLead = idx === 0 && !props.noLead;
    const dark = isLead || idx % 2 === 0;
    const c = ficTone(dark, t);
    const no = String(idx + 1).padStart(2, "0");
    const dot = function (txt, key) { return h("span", { key: key, style: { fontFamily: F_BODY, fontSize: 10.5, color: c.fog } }, txt); };
    const tagRow = function (mt) {
      return (f.tags || []).length ? h("div", { className: "flex flex-wrap", style: { gap: 5, marginTop: mt } },
        (f.tags || []).slice(0, 5).map(function (tag, i) { return h(FicTag, { key: i, tag: tag, onDark: c.onDark, onClick: props.onTag }); })) : null;
    };
    const statRow = function (mt, bordered) {
      return h("div", { className: "flex items-center flex-wrap", style: Object.assign({ gap: 8, marginTop: mt },
        bordered ? { paddingTop: 9, borderTop: "1px solid " + c.line } : {}) },
        dot(fmtNum(words) + " 字", "w"),
        dot(chCount + " 章", "c"),
        h("span", {
          onClick: function (e) { e.stopPropagation(); props.onLike && props.onLike(); },
          className: "active:opacity-60 flex items-center gap-1",
          style: { fontFamily: F_BODY, fontSize: 10.5, color: f.liked ? c.cp : c.fog }
        }, h(IHeart, { size: 11, color: f.liked ? c.cp : c.fog, filled: f.liked }), fmtNum(heat.kudos + (f.liked ? 1 : 0))),
        (f.reviews || []).length ? dot("评 " + (f.reviews || []).length, "r") : null,
        h("span", { style: { flex: 1 } }),
        props.readAt ? h("span", { style: { fontFamily: F_BODY, fontSize: 10, color: c.cp } }, props.readAt) : null,
        f.onShelf ? h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: c.cp } }, "★") : null);
    };
    const summary = (((f.chapters || [])[0] || {}).content || f.body || "").slice(0, 110);

    // 头条：一屏总得有一块压得住的深色，否则整屏明度全挤在一起，眼睛没有落点
    if (isLead) return h("button", {
      onClick: props.onOpen, className: "w-full text-left active:opacity-90 mb-2.5 relative",
      style: { background: c.bg, borderRadius: 16, overflow: "hidden", padding: "15px 16px 13px" }
    },
      h("div", { style: { position: "absolute", right: -30, bottom: -40, width: 150, height: 150, borderRadius: 999, background: "rgba(" + skinRGB(t.accent).join(",") + ",.22)" } }),
      h("div", { style: { position: "relative" } },
        h("div", { className: "flex items-center", style: { gap: 8 } },
          h("span", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 8.5, fontWeight: 700, letterSpacing: "0.2em", color: c.fog } }, props.leadLabel || "TOP OF THE FEED"),
          // 头条没有左边那道色条，所以「有我」这一层落在序号上——
          // 和下面每一行是同一套说法（序号是暖色＝这篇写的是我们）
          h("span", { style: { fontFamily: F_DISPLAY, fontSize: 12, color: hasMe ? t.accent : c.num } }, no)),
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 25, lineHeight: 1.15, color: c.ink, marginTop: 7, fontWeight: 500 } }, f.title),
        h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: c.fog, marginTop: 5 } },
          "by " + author + "　·　" + cpLabel(f.cp, characters, props.userName)),
        h("div", { className: "line-clamp-3", style: { fontFamily: F_BODY, fontSize: 12.5, color: c.sub, lineHeight: 1.65, marginTop: 9 } }, summary),
        tagRow(10), statRow(9, false)));

    return h("button", {
      onClick: props.onOpen,
      className: "w-full text-left active:opacity-80 mb-2.5 relative flex",
      style: Object.assign({ border: "1px solid " + (dark ? c.bg : t.line), borderRadius: 14, overflow: "hidden", gap: 11, padding: "12px 14px 11px 15px" },
        // 浅卡也上同一套皮（base 换成 bg2、不要角上的弧和大字、力度压到四成）：
        // 列表页大半个屏都被卡片盖住，只装修页底等于没装修。深卡是实底，不上皮。
        dark ? { background: c.bg } : pageSkin("paper", t, { base: t.bg2, corner: false, strength: .4 }))
    },
      // 左边那道：有我＝暖色，别人的 CP＝淡的。一眼分出「写我们的」和「别的」
      h("div", { style: { position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: hasMe ? t.accent : c.line } }),
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: 22, lineHeight: 1, color: hasMe ? t.accent : c.num, width: 30, flexShrink: 0, paddingTop: 2 } }, no),
      h("div", { className: "min-w-0", style: { flex: 1 } },
        h("div", { className: "flex items-start justify-between", style: { gap: 8 } },
          h("div", { className: "min-w-0 flex-1" },
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16.5, lineHeight: 1.28, color: c.ink, fontWeight: 500 } }, f.title),
            h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: c.fog, marginTop: 3 } },
              // ⚠️子节点要传数组，不能拿 + 去拼——元素被字符串拼接就成了 [object Object]
              "by " + author + "　·　",
              h("span", { style: { color: c.cp } }, cpLabel(f.cp, characters, props.userName)))),
          mine ? h("span", { style: { fontFamily: F_BODY, fontSize: 9.5, color: t.bg2, background: t.accent, borderRadius: 5, padding: "2px 6px", whiteSpace: "nowrap" } }, "我写的") : null),
        h("div", { className: "line-clamp-2", style: { fontFamily: F_BODY, fontSize: 12, color: c.sub, lineHeight: 1.6, marginTop: 6 } }, summary),
        tagRow(8), statRow(8, false)));
  }

  // ---------- 世界观 tab 栏（可横滑 + 末尾 +；自定义版块点已选再点=编辑）----------
  function TabBar(props) {
    const t = useTheme();
    return h("div", { className: "shrink-0 px-5 pb-2", style: { overflowX: "auto", WebkitOverflowScrolling: "touch" } },
      h("div", { style: { display: "flex", flexWrap: "nowrap", alignItems: "center", gap: 8, width: "max-content" } },
        props.tabs.map(function (tab) {
          const on = tab.id === props.activeId;
          return h("button", {
            key: tab.id,
            onClick: function () { if (on && !tab.seed) props.onEdit(tab); else props.onPick(tab.id); },
            onDoubleClick: function () { if (!tab.seed) props.onEdit(tab); },
            className: "shrink-0 active:opacity-70",
            style: {
              fontFamily: F_BODY, fontSize: 13.5, whiteSpace: "nowrap", padding: "5px 14px", borderRadius: 999,
              background: on ? t.ink : "transparent", color: on ? t.bg2 : t.sub, border: "1px solid " + (on ? t.ink : t.line)
            }
          }, tab.name, (on && !tab.seed) ? " ✎" : "");
        }),
        h("button", {
          onClick: props.onAdd, className: "shrink-0 active:opacity-60",
          style: { fontFamily: F_BODY, fontSize: 15, padding: "4px 12px", borderRadius: 999, color: t.fog, border: "1px dashed " + t.line }
        }, "+")));
  }

  // ---------- 生成配置弹窗（齿轮）----------
  function GenSheet(props) {
    const t = useTheme();
    const cfg0 = loadCfg();
    const styles = allStylePresets(cfg0);
    const [n, setN] = useState(3);
    const [briefs, setBriefs] = useState([]);   // 每篇点的梗，没填＝自由发挥
    function setBrief(i, v) { setBriefs(function (prev) { const a = prev.slice(); a[i] = v; return a; }); }
    const [sel, setSel] = useState([]); // 选中的 CP preset id 或角色 id（这里存最终 cp 数组）
    const [pickA, setPickA] = useState(""), [pickB, setPickB] = useState("");
    const [styleIds, setStyleIds] = useState(cfg0.activeStyleIds || []); // 本次生效的文风（默认=上次选的）
    const [includeMe, setIncludeMe] = useState(false); // 俩角色 CP 时：带上「我」写成 A×我×B
    function toggleStyle(id) { setStyleIds(function (prev) { return prev.indexOf(id) >= 0 ? prev.filter(function (x) { return x !== id; }) : prev.concat([id]); }); }
    const cps = props.cps, characters = props.characters;
    // 最终 cp：优先用手动选（pickA/pickB，可为角色/我/原创空），否则用点选的 preset
    function chosenCP() {
      const manual = [pickA, pickB].filter(function (x) { return x; });
      if (manual.length) return manual;
      return sel;
    }
    // 两个都是角色（都不是「我」/原创）时才给「带上我」开关
    function twoRealChars() { const cc = chosenCP(); return cc.length === 2 && cc.every(function (x) { return x && x !== "me"; }); }
    return h("div", { className: "fixed inset-0 z-50 flex items-end", style: { background: "rgba(0,0,0,0.35)" }, onClick: props.onClose },
      h("div", { onClick: function (e) { e.stopPropagation(); }, className: "w-full rounded-t-3xl px-6 pt-5 pb-8", style: { background: t.bg, maxHeight: "82vh", overflowY: "auto" } },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 21, color: t.ink, marginBottom: 4 } }, "生成配置"),
        h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, marginBottom: 18 } }, "【" + props.tab.name + "】世界观 × 选中 CP × 篇数 → 往本版 feed 出文"),

        h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: t.sub, marginBottom: 8 } }, "生成篇数　" + n + " 篇"),
        h("input", { type: "range", min: 1, max: 8, value: n, onChange: function (e) { setN(Number(e.target.value)); }, className: "w-full mb-4" }),

        // 每篇一个框：想好了就写，没写的那篇自由发挥。
        // ⚠️框数跟着篇数走，但 briefs 不随之截断——她把篇数调小再调回来，
        // 之前写的那几条还在（改成截断的话，手一滑就白写了）。
        h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: t.sub, marginBottom: 2 } }, "每篇想看什么（可留空）"),
        h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginBottom: 8, lineHeight: 1.5 } }, "留空的那篇自由发挥；写了的会当成那一篇的地基，不是结尾提一句"),
        h("div", { className: "mb-6", style: { display: "flex", flexDirection: "column", gap: 6 } },
          Array.from({ length: n }, function (_, i) {
            return h("div", { key: i, className: "flex items-start", style: { gap: 8 } },
              h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, paddingTop: 8, width: 26, flexShrink: 0 } }, "第" + (i + 1)),
              h("textarea", {
                value: briefs[i] || "", onChange: function (e) { setBrief(i, e.target.value); },
                rows: 1, placeholder: "自由发挥",
                style: { flex: 1, minWidth: 0, fontFamily: F_BODY, fontSize: 12.5, lineHeight: 1.55, color: t.ink, background: t.bg2, border: "1px solid " + t.line, borderRadius: 10, padding: "6px 10px", outline: "none", resize: "vertical" }
              }));
          })),

        // 本次文风（在「我的·生成设置」里建，这里按需勾选，可多选，不选=不限）
        h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: t.sub, marginBottom: 8 } }, "文风（本次生效，可多选，不选＝不限）"),
        styles.length ? h("div", { className: "flex flex-wrap gap-2 mb-6" },
          styles.map(function (s) {
            const on = styleIds.indexOf(s.id) >= 0;
            return h("button", { key: s.id, onClick: function () { toggleStyle(s.id); }, style: { fontFamily: F_BODY, fontSize: 12.5, padding: "5px 12px", borderRadius: 999, background: on ? t.accent : "transparent", color: on ? t.bg2 : t.sub, border: "1px solid " + (on ? t.accent : t.line) } }, s.label);
          })
        ) : h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginBottom: 18 } }, "还没有文风预设，去「我的 → 生成设置」新建或导入，之后每次在这里勾选。"),

        h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: t.sub, marginBottom: 8 } }, "选择预设好的 CP，或本次手动设置一对"),
        // 从 CP 预设名单里选
        cps.length ? h("div", { className: "flex flex-wrap gap-2 mb-3" },
          cps.map(function (cp) {
            const on = JSON.stringify(chosenCP()) === JSON.stringify(cp.cp);
            return h("button", {
              key: cp.id, onClick: function () { setPickA(""); setPickB(""); setSel(on ? [] : cp.cp); },
              style: { fontFamily: F_BODY, fontSize: 12.5, padding: "5px 12px", borderRadius: 999, background: on ? t.accent : "transparent", color: on ? t.bg2 : t.sub, border: "1px solid " + (on ? t.accent : t.line) }
            }, cp.label || cpLabel(cp.cp, characters, props.userName));
          })
        ) : h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginBottom: 10 } }, "还没有 CP 预设，可在「我的」页添加，或下面本次手动设置一对："),

        // 本次手动设置一对（不进预设）：原创 / 我（面具人设）/ 角色
        h("div", { className: "flex items-center gap-2 mb-2" },
          h("select", { value: pickA, onChange: function (e) { setSel([]); setPickA(e.target.value); }, style: { flex: 1, fontFamily: F_BODY, fontSize: 12.5, padding: "7px 10px", borderRadius: 10, background: t.bg2, color: t.ink, border: "1px solid " + t.line } },
            cpOptions(characters, props.userName)),
          h("span", { style: { fontFamily: F_BODY, color: t.fog } }, "×"),
          h("select", { value: pickB, onChange: function (e) { setSel([]); setPickB(e.target.value); }, style: { flex: 1, fontFamily: F_BODY, fontSize: 12.5, padding: "7px 10px", borderRadius: 10, background: t.bg2, color: t.ink, border: "1px solid " + t.line } },
            cpOptions(characters, props.userName))),
        h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginBottom: 6 } }, "选「我」时按你在设置里的面具人设来写，没填则自由发挥"),

        // 俩角色 CP：带不带上「我」（否则默认只写他俩，即便设定里写了 TA 是我男朋友也不把我带进去）
        twoRealChars() ? h("button", { onClick: function () { setIncludeMe(function (v) { return !v; }); }, className: "w-full active:opacity-80",
          style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 12px", background: includeMe ? "rgba(0,0,0,0.04)" : t.bg2, border: "1px solid " + (includeMe ? t.ink : t.line), borderRadius: 12, marginTop: 4, marginBottom: 14 } },
          h("div", { style: { textAlign: "left" } },
            h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: t.ink } }, includeMe ? "带上我（他俩 × 我 的三人）" : "只写他俩的 CP"),
            h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 2, lineHeight: 1.5 } }, includeMe ? "把「我」作为第三方写进文里" : "只聚焦这两个角色，就算设定写了 TA 是我男朋友也不把我带进去")),
          h("div", { style: { width: 20, height: 20, flexShrink: 0, borderRadius: 6, border: "1px solid " + (includeMe ? t.ink : t.line), background: includeMe ? t.ink : "transparent", color: t.bg2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 } }, includeMe ? "✓" : "")) : null,

        h("div", { className: "flex items-center gap-3" },
          h("button", { onClick: function () { setN(3); setSel([]); setPickA(""); setPickB(""); setIncludeMe(false); setBriefs([]); }, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 13.5, color: t.sub, padding: "10px 18px", borderRadius: 12, border: "1px solid " + t.line } }, "重置"),
          h("button", { onClick: function () { props.onConfirm(n, chosenCP(), styleIds, twoRealChars() && includeMe, briefs.slice(0, n)); }, className: "flex-1 active:opacity-80", style: { fontFamily: F_BODY, fontSize: 14, color: t.bg2, background: t.ink, padding: "11px", borderRadius: 12 } }, "确定生成"))));
  }

  // ---------- 新建/编辑自定义世界观 tab ----------
  function TabSheet(props) {
    const t = useTheme();
    const editing = props.tab;
    const [name, setName] = useState(editing ? editing.name : "");
    const [desc, setDesc] = useState(editing ? editing.desc : "");
    return h("div", { className: "fixed inset-0 z-50 flex items-end", style: { background: "rgba(0,0,0,0.35)" }, onClick: props.onClose },
      h("div", { onClick: function (e) { e.stopPropagation(); }, className: "w-full rounded-t-3xl px-6 pt-5 pb-8", style: { background: t.bg } },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 21, color: t.ink, marginBottom: 14 } }, editing ? "编辑世界观" : "新世界观"),
        h("input", { value: name, onChange: function (e) { setName(e.target.value); }, placeholder: "世界观名（如『民国』『星际』）", className: "w-full outline-none mb-3", style: { fontFamily: F_BODY, fontSize: 14, padding: "10px 12px", borderRadius: 10, background: t.bg2, color: t.ink, border: "1px solid " + t.line } }),
        h("textarea", { value: desc, onChange: function (e) { setDesc(e.target.value); }, placeholder: "世界观描述（= 生成时的设定层 / world book，越具体越好：背景、基调、这个世界的规则）", rows: 5, className: "w-full outline-none mb-4 resize-none", style: { fontFamily: F_BODY, fontSize: 13, lineHeight: 1.6, padding: "10px 12px", borderRadius: 10, background: t.bg2, color: t.ink, border: "1px solid " + t.line } }),
        h("div", { className: "flex items-center gap-3" },
          editing && !editing.seed ? h("button", { onClick: function () { props.onDelete(editing.id); }, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 13.5, color: t.accent, padding: "10px 16px", borderRadius: 12, border: "1px solid " + t.line } }, "删除") : null,
          h("button", { onClick: function () { if (name.trim()) props.onSave(editing ? editing.id : null, name.trim(), desc.trim()); }, className: "flex-1 active:opacity-80", style: { fontFamily: F_BODY, fontSize: 14, color: t.bg2, background: t.ink, padding: "11px", borderRadius: 12 } }, "保存"))));
  }

  // 作者署名 badge
  function authorTag(t) { return h("span", { style: { fontFamily: F_BODY, fontSize: 9, color: t.bg2, background: t.tint, borderRadius: 5, padding: "0px 5px", marginLeft: 5 } }, "作者"); }

  // ---------- 阅读页（含追更 + 书评）----------
  function Reader(props) {
    // 这一篇自己的纸：篇上写了用篇的，没写用默认那张（props.paper 由 FanficApp 算好传下来，
    // 它同时也是套在外层 Provider 上的那一张——两处必须是同一张，否则头上那个色块跟正文对不上）。
    const t = useTheme();
    const _paper = props.paper || ficPaper(loadCfg());
    const [paperOpen, setPaperOpen] = useState(false);
    const f = props.fic;
    const [busy, setBusy] = useState("");         // 内联小操作（发书评/回复）
    const chapterTaskKey = "fanfic:chapter:" + f.id;
    const [busyChap, setBusyChap] = useState(function () { return !!(window.BackgroundGeneration && window.BackgroundGeneration.state(chapterTaskKey).busy); }); // 追更（离开阅读页仍继续）
    const [busyRev, setBusyRev] = useState(false);   // 刷书评（可与追更并行）
    const [replyTo, setReplyTo] = useState(null); // review id
    const [replyText, setReplyText] = useState("");
    const [newComment, setNewComment] = useState("");
    const [fwdOpen, setFwdOpen] = useState(false);
    // 打开时回到上次读到的那一章（v58.02）
    const [chapIdx, setChapIdx] = useState(function () {
      const r = loadRead()[props.fic && props.fic.id];
      const n = (props.fic && props.fic.chapters || []).length;
      return r && r.chap > 0 && r.chap < n ? r.chap : 0;
    });
    const swipeRef = React.useRef({ x: 0, y: 0 });
    // 翻到/生成新章后跳到该章开头（别落在中间，省得往回翻）
    const chapRef = React.useRef(null);
    const firstChap = React.useRef(true);
    React.useEffect(function () {
      if (firstChap.current) { firstChap.current = false; return; }
      if (chapRef.current) chapRef.current.scrollIntoView({ behavior: "auto", block: "start" });
    }, [chapIdx]);
    React.useEffect(function () {
      if (!window.BackgroundGeneration) return;
      return window.BackgroundGeneration.subscribe(chapterTaskKey, function (s) {
        setBusyChap(!!s.busy);
        if (s.status === "done" && s.result && Number.isInteger(s.result.chapterIndex)) setChapIdx(s.result.chapterIndex);
      });
    }, [chapterTaskKey]);
    const chars = cpChars(f.cp, props.characters, props.profile);
    const storyLore = function (extra) {
      const ids = chars.filter(function (c) { return c && !c.isMe && c.id; }).map(function (c) { return c.id; });
      return props.worldbookFor ? props.worldbookFor(ids, [f.title, props.tab && props.tab.name, extra || ""].filter(Boolean).join("\n")) : props.worldbook;
    };
    function goChap(to) { const chs = f.chapters || []; if (to >= 0 && to < chs.length) { setChapIdx(to); markRead(f.id, to); } }
    // 进来就算读过一次——不然只看了第一章的文永远不会留下记录
    useEffect(function () { markRead(f.id, chapIdx); }, [f.id]);
    const authorName = f.author || (f.source === "user" ? (props.userName || "我") : ficPenName(f.id));

    function genOpts() { const cfg = window.Fanfic.loadCfg(); return { style: window.Fanfic.activeStyleText(cfg), perFic: cfg.perFic, chatMaterial: window.Fanfic.chatMaterialFor(chars) }; }

    async function addChapter() {
      if (busyChap) return;
      const newIdx = (f.chapters || []).length; // 新章的索引
      const run = async function () {
        const ch = await window.Fanfic.genNextChapter(props.active, f, props.tab, chars, props.userName, storyLore("续章"), genOpts());
        props.onUpdate(f.id, function (fic) { fic.chapters = (fic.chapters || []).concat([ch]); fic.updatedAt = Date.now(); return fic; });
        props.toast && props.toast("已更新一章");
        // item 8：新章推给曾被转发看过这篇的角色（不麻烦的轻量版）
        if (props.onChapterShared && (f.sharedTo || []).length) props.onChapterShared(f, ch, newIdx + 1);
        return { chapterIndex: newIdx, chapter: ch };
      };
      props.toast && props.toast("追更已放到后台，可以先离开阅读页");
      if (!window.BackgroundGeneration) {
        setBusyChap(true);
        try { await run(); setChapIdx(newIdx); } catch (e) { props.toast && props.toast(String(e.message || e)); }
        setBusyChap(false); return;
      }
      try { await window.BackgroundGeneration.start(chapterTaskKey, { label: "追更生成中" }, run); }
      catch (e) { props.toast && props.toast(String(e.message || e)); }
    }
    async function loadReviews() {
      if (busyRev) return;
      setBusyRev(true);
      try {
        const rv = await window.Fanfic.genReviews(props.active, f, props.tab, storyLore("书评"));
        props.onUpdate(f.id, function (fic) { fic.reviews = (fic.reviews || []).concat(rv); return fic; });
      } catch (e) { props.toast && props.toast(String(e.message || e)); }
      setBusyRev(false);
    }
    // 我发一条顶层书评 → 生成 NPC（含作者）回复挂它下面
    async function postComment() {
      const txt = newComment.trim(); if (!txt) return;
      const rvId = uid("rv");
      props.onUpdate(f.id, function (fic) { fic.reviews = (fic.reviews || []).concat([{ id: rvId, author: props.userName || "我", me: true, content: txt, replies: [] }]); return fic; });
      setNewComment("");
      if (!props.active) return;
      setBusy("myrev");
      try {
        const reps = await window.Fanfic.genReplyToUser(props.active, f, props.tab, txt, "");
        if (reps.length) props.onUpdate(f.id, function (fic) { (fic.reviews || []).forEach(function (r) { if (r.id === rvId) r.replies = (r.replies || []).concat(reps); }); return fic; });
        else props.toast && props.toast("读者们暂时没接话，点这条书评可再催一次");
      } catch (e) { props.toast && props.toast(String(e.message || e)); }
      setBusy("");
    }
    // 我回复某条书评 → 也生成 NPC（含作者）回复
    async function sendReply(rvId) {
      const txt = replyText.trim(); if (!txt) return;
      const rv = (f.reviews || []).find(function (r) { return r.id === rvId; }) || {};
      const ctx = "「" + rv.author + "」：" + rv.content + (rv.replies || []).map(function (x) { return "\n「" + x.author + "」：" + x.content; }).join("");
      props.onUpdate(f.id, function (fic) {
        (fic.reviews || []).forEach(function (r) { if (r.id === rvId) r.replies = (r.replies || []).concat([{ id: uid("rp"), author: props.userName || "我", content: txt, me: true }]); });
        return fic;
      });
      setReplyText(""); setReplyTo(null);
      if (!props.active) return;
      setBusy("myrep");
      try {
        const reps = await window.Fanfic.genReplyToUser(props.active, f, props.tab, txt, ctx);
        if (reps.length) props.onUpdate(f.id, function (fic) { (fic.reviews || []).forEach(function (r) { if (r.id === rvId) r.replies = (r.replies || []).concat(reps); }); return fic; });
        else props.toast && props.toast("没人接话，稍后再试一次");
      } catch (e) { props.toast && props.toast(String(e.message || e)); }
      setBusy("");
    }

    const _heat = f.stats || ficHeat(f.id);
    const _words = ficWords(f);
    const _hasMe = ficHasMe(f);
    // AO3 的 work header：标题 by 作者 / 关系 / 一整块标签 / 底下那行统计。
    // 原先这里是 Head 那块 30px 大标题「阅读」，标题本身反而排在下面（v58.02）。
    const metaRow = function (label, node) {
      return h("div", { className: "flex", style: { gap: 9, marginTop: 6 } },
        h("span", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 8.5, letterSpacing: "0.14em", color: t.fog, width: 58, flexShrink: 0, paddingTop: 3 } }, label),
        h("div", { className: "flex-1 min-w-0" }, node));
    };
    // 阅读页的皮肤压到六成：这一页要读几千字，纹理不能跟正文抢。
    return h("div", { className: "h-full flex flex-col", style: pageSkin("paper", t, { strength: .6 }) },
      h("div", { className: "shrink-0 flex items-center px-4 pb-2", style: { paddingTop: safeTop(10) } },
        h("button", { onClick: props.onBack, "aria-label": "返回", className: "active:opacity-50 flex items-center justify-center", style: { width: 40, height: 40, marginLeft: -8 } }, h(IArrow, { size: 19, color: t.ink })),
        h("div", { className: "flex-1 min-w-0 text-center px-1" },
          h("div", { className: "truncate", style: { fontFamily: F_DISPLAY, fontSize: 15, color: t.ink, lineHeight: 1.2 } }, f.title),
          h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: t.fog, marginTop: 1 } }, props.tab.name)),
        h("div", { className: "flex items-center justify-end shrink-0", style: { gap: 10, minWidth: 56 } },
          // 换这一篇的纸。⚠️只改这一篇，别的篇和默认那张都不动。
          h("button", { onClick: function () { setPaperOpen(true); }, className: "active:opacity-60", "aria-label": "换书页",
            style: { width: 20, height: 20, borderRadius: 5, background: _paper.bg, border: "1.5px solid " + t.line, display: "flex", alignItems: "center", justifyContent: "center" } },
            h("span", { style: { width: 8, height: 1.5, background: _paper.ink, borderRadius: 1 } })),
          h("button", { onClick: function () { props.onToggleShelf(f.id); }, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 12, color: f.onShelf ? t.accent : t.fog } }, f.onShelf ? "★" : "☆"))),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-6 pb-10" },
        h("div", { className: "flex items-start", style: { gap: 9 } },
          h("div", { style: { width: 3.5, alignSelf: "stretch", borderRadius: 2, background: _hasMe ? t.accent : t.line, marginTop: 5 } }),
          h("div", { className: "flex-1 min-w-0" },
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 23, lineHeight: 1.28, color: t.ink, fontWeight: 500 } }, f.title),
            h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginTop: 4 } }, "by " + authorName))),
        metaRow("RELATION", h("span", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.accent } }, cpLabel(f.cp, props.characters, props.userName))),
        (f.tags || []).length ? metaRow("TAGS", h("div", { className: "flex flex-wrap", style: { gap: 5 } },
          (f.tags || []).map(function (tag, i) { return h(FicTag, { key: i, tag: tag }); }))) : null,
        metaRow("STATS", h("div", { className: "flex flex-wrap", style: { gap: 9, fontFamily: F_BODY, fontSize: 11, color: t.fog, paddingTop: 1 } },
          h("span", null, fmtNum(_words) + " 字"),
          h("span", null, (f.chapters || []).length + " 章"),
          h("span", null, "♡ " + fmtNum(_heat.kudos + (f.liked ? 1 : 0))),
          h("span", null, "评 " + ((f.reviews || []).length)))),
        h("div", { style: { height: 1, background: t.line, margin: "14px 0 4px" } }),
        // 点赞 / 转发
        h("div", { className: "flex items-center gap-4 mb-5" },
          h("button", { onClick: function () { props.onLike(f.id); }, className: "active:opacity-60 flex items-center gap-1.5", style: { fontFamily: F_BODY, fontSize: 12.5, color: f.liked ? t.accent : t.sub } },
            h(IHeart, { size: 16, color: f.liked ? t.accent : t.sub, filled: f.liked }), f.liked ? "已赞" : "点赞"),
          h("button", { onClick: function () { setFwdOpen(true); }, className: "active:opacity-60 flex items-center gap-1.5", style: { fontFamily: F_BODY, fontSize: 12.5, color: t.sub } },
            h(IRepeat, { size: 16, color: t.sub }), "转发")),
        // 章节（翻页，不再一路下滑；顶部+底部箭头 + 左右滑动）
        (function () {
          const chs = f.chapters || [];
          const idx = Math.min(Math.max(0, chapIdx), Math.max(0, chs.length - 1));
          const ch = chs[idx] || {};
          const btn = function (label, to, disabled) { return h("button", { onClick: function () { goChap(to); }, disabled: disabled, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 12.5, color: disabled ? t.line : t.sub, padding: "2px 4px" } }, label); };
          const pager = function (top) { return chs.length > 1 ? h("div", { className: "flex items-center justify-between " + (top ? "mb-4 pb-2" : "mt-5 pt-3"), style: (top ? { borderBottom: "1px solid " + t.line } : { borderTop: "1px solid " + t.line }) },
            btn("‹ 上一章", idx - 1, idx <= 0),
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 13, color: t.fog } }, "第 " + (idx + 1) + " / " + chs.length + " 章"),
            btn("下一章 ›", idx + 1, idx >= chs.length - 1)) : null; };
          return h("div", {
            ref: chapRef,
            className: "mb-6",
            style: { scrollMarginTop: 8 },
            // 翻页手势必须「横向显著大于纵向」：之前只看 dx，下滑读文时手指稍斜就被当成翻上一章，
            // 一路卡回第一章还跳章首（她报的 bug 根因）
            onTouchStart: function (e) { swipeRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; },
            onTouchEnd: function (e) { const s = swipeRef.current || { x: 0, y: 0 }; const dx = e.changedTouches[0].clientX - s.x, dy = e.changedTouches[0].clientY - s.y; if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.4) return; if (dx < 0) goChap(idx + 1); else goChap(idx - 1); }
          },
            pager(true),
            // 正文按【读小说】排：字大一档、行距松开、段与段之间留白。
            // AO3 是不缩进＋段间距那一派，中文长文这样读着最不累（v58.02）。
            h("div", { style: { fontFamily: "'Noto Serif SC',serif", fontSize: 16, lineHeight: 2.05, color: t.ink, letterSpacing: "0.01em" } },
              String(ch.content || "").split(/\n\s*\n|\n/).filter(function (x) { return x.trim(); }).map(function (para, pi) {
                return h("p", { key: pi, style: { margin: "0 0 1.05em" } }, para.trim());
              })),
            ((ch.cot || ch.cotRequested) && typeof CotReveal === "function") ? h(CotReveal, { cot: ch.cot, requested: ch.cotRequested }) : null,
            pager(false));
        })(),

        // 追更按钮
        h("button", { onClick: addChapter, disabled: busyChap, className: "w-full active:opacity-70 mb-8", style: { fontFamily: F_BODY, fontSize: 13.5, color: t.sub, padding: "11px", borderRadius: 12, border: "1px dashed " + t.line, opacity: busyChap ? 0.5 : 1 } },
          busyChap ? "后台续写中…可以离开本页" : "＋ 追更下一章"),

        // 书评区
        h("div", { className: "flex items-center justify-between mb-3" },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 17, color: t.ink } }, "书评 · " + (f.reviews || []).length),
          h("button", { onClick: loadReviews, disabled: busyRev, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 12, color: t.accent } }, busyRev ? "召唤读者中…" : "刷出书评")),
        // 我直接写书评
        h("div", { className: "flex items-center gap-2 mb-4" },
          h("input", { value: newComment, onChange: function (e) { setNewComment(e.target.value); }, onKeyDown: function (e) { if (e.key === "Enter") postComment(); }, placeholder: "写条书评…", className: "flex-1 outline-none", style: { fontFamily: F_BODY, fontSize: 12.5, padding: "8px 11px", borderRadius: 10, background: t.bg2, color: t.ink, border: "1px solid " + t.line } }),
          h("button", { onClick: postComment, disabled: busy === "myrev", className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 12.5, color: t.accent, padding: "0 4px" } }, busy === "myrev" ? "…" : "发表")),
        (f.reviews || []).length ? (f.reviews || []).map(function (r) {
          return h("div", { key: r.id, className: "mb-3 pb-3", style: { borderBottom: "1px solid " + t.line } },
            h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: r.me ? t.accent : (r.isAuthor ? t.tint : t.fog), marginBottom: 3 } }, r.author, r.isAuthor ? authorTag(t) : null),
            h("div", { style: { fontFamily: F_BODY, fontSize: 13, lineHeight: 1.6, color: t.ink } }, r.content),
            (r.replies || []).map(function (rp) {
              return h("div", { key: rp.id, className: "mt-2 ml-3 pl-3", style: { borderLeft: "2px solid " + t.line } },
                h("span", { style: { fontFamily: F_BODY, fontSize: 11.5, color: rp.me ? t.accent : (rp.isAuthor ? t.tint : t.fog) } }, rp.author + "：", rp.isAuthor ? authorTag(t) : null),
                h("span", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.sub } }, rp.content));
            }),
            replyTo === r.id
              ? h("div", { className: "flex items-center gap-2 mt-2" },
                  h("input", { value: replyText, autoFocus: true, onChange: function (e) { setReplyText(e.target.value); }, onKeyDown: function (e) { if (e.key === "Enter") sendReply(r.id); }, placeholder: "回复…", className: "flex-1 outline-none", style: { fontFamily: F_BODY, fontSize: 12.5, padding: "6px 10px", borderRadius: 8, background: t.bg2, color: t.ink, border: "1px solid " + t.line } }),
                  h("button", { onClick: function () { sendReply(r.id); }, style: { fontFamily: F_BODY, fontSize: 12.5, color: t.accent } }, "发送"))
              : h("button", { onClick: function () { setReplyTo(r.id); setReplyText(""); }, className: "mt-1.5 active:opacity-60", style: { fontFamily: F_BODY, fontSize: 11, color: t.fog } }, "回复"));
        }) : h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, padding: "8px 0" } }, "还没有书评，写一条或点「刷出书评」召唤一批读者。")),
      // 只给这一篇换纸（她 2026-08-30：「每一篇可以单独设置」）
      paperOpen ? h("div", { className: "fixed inset-0 z-50 flex items-end", style: { background: "rgba(0,0,0,0.35)" }, onClick: function () { setPaperOpen(false); } },
        h("div", { onClick: function (e) { e.stopPropagation(); }, className: "w-full rounded-t-3xl px-6 pt-5 pb-8", style: { background: t.bg, maxHeight: "72vh", overflowY: "auto" } },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 20, color: t.ink } }, "这一篇的书页"),
          h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, margin: "4px 0 14px", lineHeight: 1.5 } },
            "只换《" + f.title + "》这一篇；别的篇和默认那张都不动。"),
          h("div", { style: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 } },
            FIC_PAPERS.map(function (pp) {
              return h(PaperSwatch, {
                key: pp.id, paper: pp, on: _paper.id === pp.id,
                onPick: function () { props.onSetPaper && props.onSetPaper(pp.id); setPaperOpen(false); }
              });
            })),
          // 跟着默认走＝把这一篇的单独设置撤掉，不是再选一张
          f.paper ? h("button", {
            onClick: function () { props.onSetPaper && props.onSetPaper(""); setPaperOpen(false); },
            className: "w-full active:opacity-60", style: { fontFamily: F_BODY, fontSize: 12.5, color: t.fog, padding: "12px 0 2px" }
          }, "跟着默认书页走") : null)) : null,
      fwdOpen ? h(FwdSheet, { characters: props.fwdChars || props.characters, groups: props.groups, onClose: function () { setFwdOpen(false); },
        onPickChar: function (c) { setFwdOpen(false); props.onForwardToChat && props.onForwardToChat(f, c); },
        onPickGroup: function (g) { setFwdOpen(false); props.onForwardToGroup && props.onForwardToGroup(f, g); } }) : null);
  }

  // ---------- 转发选人 sheet ----------
  function FwdSheet(props) {
    const t = useTheme();
    return h("div", { className: "fixed inset-0 z-50 flex items-end", style: { background: "rgba(0,0,0,0.35)" }, onClick: props.onClose },
      h("div", { onClick: function (e) { e.stopPropagation(); }, className: "w-full rounded-t-3xl px-6 pt-5 pb-8", style: { background: t.bg, maxHeight: "70vh", overflowY: "auto" } },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 20, color: t.ink, marginBottom: 14 } }, "转发给…"),
        // ⚠️只列真人角色：配角（npc）能被写进 CP，但没有自己的聊天窗口，转不过去。
        // 现在传进来的本来就是真人那份，这道滤是把规则留在本地——
        // 不必指望三个文件外的调用方永远记得传对。
        (props.characters || []).filter(function (c) { return c && !c.npc; }).map(function (c) {
          return h("button", { key: c.id, onClick: function () { props.onPickChar(c); }, className: "w-full flex items-center gap-3 py-2.5 active:opacity-60" },
            h(Avatar, { character: c, size: 34 }),
            h("div", { style: { fontFamily: F_BODY, fontSize: 14, color: t.ink } }, c.remark || c.name));
        }),
        (props.groups || []).length ? h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, margin: "10px 0 4px" } }, "群聊") : null,
        (props.groups || []).map(function (g) {
          return h("button", { key: g.id, onClick: function () { props.onPickGroup(g); }, className: "w-full flex items-center gap-3 py-2.5 active:opacity-60" },
            h("div", { style: { width: 34, height: 34, borderRadius: 10, background: t.line, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F_BODY, fontSize: 11, color: t.sub } }, "群"),
            h("div", { style: { fontFamily: F_BODY, fontSize: 14, color: t.ink } }, g.name));
        })));
  }

  // ---------- 发布（我手写发文）----------
  function Publish(props) {
    const t = useTheme();
    const [title, setTitle] = useState("");
    const [tags, setTags] = useState("");
    const [body, setBody] = useState("");
    const [cp, setCp] = useState([]);
    const [pickA, setPickA] = useState(""), [pickB, setPickB] = useState("");
    const [tabId, setTabId] = useState(props.tabs[0] && props.tabs[0].id);
    const characters = props.characters;
    function finalCP() { return [pickA, pickB].filter(function (x) { return x; }); }
    return h("div", { className: "h-full flex flex-col" },
      h(Head, { zh: "发布同人文", en: "Publish", onBack: props.onBack }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-6 pb-10" },
        h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, marginBottom: 8 } }, "发到世界观"),
        h("select", { value: tabId, onChange: function (e) { setTabId(e.target.value); }, className: "w-full mb-4", style: { fontFamily: F_BODY, fontSize: 13.5, padding: "9px 11px", borderRadius: 10, background: t.bg2, color: t.ink, border: "1px solid " + t.line } },
          props.tabs.map(function (tb) { return h("option", { key: tb.id, value: tb.id }, tb.name); })),
        h("input", { value: title, onChange: function (e) { setTitle(e.target.value); }, placeholder: "标题", className: "w-full outline-none mb-3", style: { fontFamily: F_DISPLAY, fontSize: 17, padding: "9px 11px", borderRadius: 10, background: t.bg2, color: t.ink, border: "1px solid " + t.line } }),
        h("div", { className: "flex items-center gap-2 mb-3" },
          h("select", { value: pickA, onChange: function (e) { setPickA(e.target.value); }, style: { flex: 1, fontFamily: F_BODY, fontSize: 12.5, padding: "7px 10px", borderRadius: 10, background: t.bg2, color: t.ink, border: "1px solid " + t.line } },
            cpOptions(characters, props.userName)),
          h("span", { style: { color: t.fog } }, "×"),
          h("select", { value: pickB, onChange: function (e) { setPickB(e.target.value); }, style: { flex: 1, fontFamily: F_BODY, fontSize: 12.5, padding: "7px 10px", borderRadius: 10, background: t.bg2, color: t.ink, border: "1px solid " + t.line } },
            cpOptions(characters, props.userName))),
        h("input", { value: tags, onChange: function (e) { setTags(e.target.value); }, placeholder: "标签，用空格或逗号分隔（如 HE 破镜重圆）", className: "w-full outline-none mb-3", style: { fontFamily: F_BODY, fontSize: 13, padding: "9px 11px", borderRadius: 10, background: t.bg2, color: t.ink, border: "1px solid " + t.line } }),
        h("textarea", { value: body, onChange: function (e) { setBody(e.target.value); }, placeholder: "正文…", rows: 12, className: "w-full outline-none mb-4 resize-none", style: { fontFamily: "'Noto Serif SC',serif", fontSize: 14.5, lineHeight: 1.8, padding: "11px", borderRadius: 10, background: t.bg2, color: t.ink, border: "1px solid " + t.line } }),
        h("button", { onClick: function () {
          if (!title.trim() || !body.trim()) { props.toast && props.toast("标题和正文都要填"); return; }
          props.onPublish(tabId, title.trim(), finalCP(), tags.split(/[\s,，、]+/).filter(Boolean), body.trim());
        }, className: "w-full active:opacity-80", style: { fontFamily: F_BODY, fontSize: 14, color: t.bg2, background: t.ink, padding: "12px", borderRadius: 12 } }, "发布")));
  }

  // ---------- 我的页 hub（作者主页 + 我发布的 + CP管理 + 设置）----------
  function Mine(props) {
    const t = useTheme();
    const [sub, setSub] = useState(null); // null | "published" | "cp" | "settings"
    const [meEdit, setMeEdit] = useState(false);
    const me = props.me;
    const mine = (props.fics || []).filter(function (f) { return f.source === "user"; });
    // 热度 = 手动值优先；否则按我发布篇目的赞+评+章 汇总
    const derivedHeat = mine.reduce(function (s, f) { return s + ((f.stats && f.stats.kudos) || 0) + (f.liked ? 1 : 0) + (f.reviews || []).length * 5 + (f.chapters || []).length; }, 0);
    const heat = me.heat > 0 ? me.heat : derivedHeat;

    if (sub === "published") return h(MinePublished, { fics: mine, characters: props.characters, userName: props.userName, onBack: function () { setSub(null); }, onOpen: props.onOpenFic });
    if (sub === "cp") return h(MineCP, { cps: props.cps, characters: props.characters, userName: props.userName, toast: props.toast, onBack: function () { setSub(null); }, onAddCP: props.onAddCP, onDelCP: props.onDelCP });
    if (sub === "settings") return h(MineSettings, { active: props.active, toast: props.toast, onPaper: props.onPaper, onBack: function () { setSub(null); } });

    const row = function (label, desc, onClick) {
      return h("button", { onClick: onClick, className: "w-full flex items-center justify-between rounded-2xl px-4 py-3.5 mb-2.5 active:opacity-70", style: { background: t.bg2, border: "1px solid " + t.line } },
        h("div", { className: "text-left" },
          h("div", { style: { fontFamily: F_BODY, fontSize: 14, color: t.ink } }, label),
          desc ? h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginTop: 1 } }, desc) : null),
        h(IChevR, { size: 16, color: t.fog }));
    };
    const stat = function (num, lab) {
      return h("div", { className: "text-center" },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 18, color: t.ink } }, fmtNum(num)),
        h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 1 } }, lab));
    };
    return h("div", { className: "h-full flex flex-col" },
      h(Head, { zh: "我的", en: "Mine", onBack: props.onBack, right: h("button", { onClick: function () { setMeEdit(true); }, className: "active:opacity-60" }, h(IPencil, { size: 17, color: t.ink })) }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-6 pb-10" },
        // 作者主页卡：背景图 + 头像 + 昵称 + id + 简介 + 三个统计
        h("div", { className: "rounded-2xl overflow-hidden mb-5", style: { border: "1px solid " + t.line } },
          h("div", { style: { height: 92, background: me.bg ? "center/cover no-repeat url(\"" + me.bg + "\")" : "linear-gradient(120deg," + t.tint + "," + t.ink + ")" } }),
          h("div", { className: "px-4 pb-4", style: { background: t.bg2, marginTop: -28 } },
            h(Avatar, { character: { name: me.name, avatarImage: me.avatar, color: t.tint }, size: 56, radius: 16 }),
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 19, color: t.ink, marginTop: 8 } }, me.name),
            me.handle ? h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog } }, "@" + me.handle) : null,
            me.bio ? h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.sub, marginTop: 6, lineHeight: 1.5 } }, me.bio) : null,
            h("div", { className: "flex items-center gap-6 mt-3 pt-3", style: { borderTop: "1px solid " + t.line } },
              stat(heat, "热度"), stat(me.fans || 0, "粉丝"), stat(me.following || 0, "关注")))),

        row("我发布的", mine.length + " 篇 · 随时回看/追更", function () { setSub("published"); }),
        row("磕 CP 管理", (props.cps || []).length + " 对预设 · 增删改", function () { setSub("cp"); }),
        row("生成设置", "预设文风 · 篇幅", function () { setSub("settings"); })),
      meEdit ? h(MeEditSheet, { me: me, onClose: function () { setMeEdit(false); }, onSave: function (m) { props.onSaveMe(m); setMeEdit(false); } }) : null);
  }

  // 我发布的（列表 → 点开进 Reader）
  function MinePublished(props) {
    const t = useTheme();
    return h("div", { className: "h-full flex flex-col" },
      h(Head, { zh: "我发布的", en: "Published", onBack: props.onBack }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-5 pb-8" },
        props.fics.length ? props.fics.slice().sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); }).map(function (f, i) {
          // 「我发布的」不摆头条：这一页每一篇都是她自己写的，挑一篇出来当头条没有意义
          return h(FicCard, { key: f.id, fic: f, index: i, noLead: true, characters: props.characters, userName: props.userName, onOpen: function () { props.onOpen(f.id); }, onLike: function () {} });
        }) : h(Empty, { text: "还没发布过", sub: "用底部 ＋ 写一篇，会出现在这里随时回看" })));
  }

  // CP 预设管理（独立页）
  function MineCP(props) {
    const t = useTheme();
    const [adding, setAdding] = useState(false);
    const [editId, setEditId] = useState(null);
    const [label, setLabel] = useState("");
    const [pickA, setPickA] = useState(""), [pickB, setPickB] = useState("");
    const characters = props.characters, cps = props.cps;
    function reset() { setAdding(false); setEditId(null); setLabel(""); setPickA(""); setPickB(""); }
    function open(cp) { setEditId(cp ? cp.id : null); setLabel(cp ? cp.label : ""); setPickA(cp ? (cp.cp[0] || "") : ""); setPickB(cp ? (cp.cp[1] || "") : ""); setAdding(true); }
    function save() {
      const cp = [pickA, pickB].filter(function (x) { return x; });
      if (!cp.length) { props.toast && props.toast("至少选一个（我 / 角色）"); return; }
      const obj = { id: editId || uid("cp"), label: label.trim() || cpLabel(cp, characters, props.userName), cp: cp };
      if (editId) { props.onDelCP(editId); }
      props.onAddCP(obj); reset();
    }
    const picks = cpOptions(characters, props.userName);
    return h("div", { className: "h-full flex flex-col" },
      h(Head, { zh: "磕 CP 管理", en: "Ships", onBack: props.onBack, right: h("button", { onClick: function () { adding ? reset() : open(null); }, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 12.5, color: t.accent } }, adding ? "取消" : "＋ 加 CP") }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-6 pb-10" },
        adding ? h("div", { className: "rounded-2xl px-4 py-3 mb-4", style: { background: t.bg2, border: "1px solid " + t.line } },
          h("input", { value: label, onChange: function (e) { setLabel(e.target.value); }, placeholder: "备注名（可空，默认用名字）", className: "w-full outline-none mb-2", style: { fontFamily: F_BODY, fontSize: 13, padding: "7px 10px", borderRadius: 8, background: t.bg, color: t.ink, border: "1px solid " + t.line } }),
          h("div", { className: "flex items-center gap-2 mb-3" },
            h("select", { value: pickA, onChange: function (e) { setPickA(e.target.value); }, style: { flex: 1, fontFamily: F_BODY, fontSize: 12.5, padding: "7px 10px", borderRadius: 8, background: t.bg, color: t.ink, border: "1px solid " + t.line } }, picks),
            h("span", { style: { color: t.fog } }, "×"),
            h("select", { value: pickB, onChange: function (e) { setPickB(e.target.value); }, style: { flex: 1, fontFamily: F_BODY, fontSize: 12.5, padding: "7px 10px", borderRadius: 8, background: t.bg, color: t.ink, border: "1px solid " + t.line } }, picks)),
          h("button", { onClick: save, className: "w-full active:opacity-80", style: { fontFamily: F_BODY, fontSize: 13, color: t.bg2, background: t.ink, padding: "9px", borderRadius: 10 } }, editId ? "保存修改" : "保存 CP")) : null,
        cps.length ? cps.map(function (cp) {
          return h("div", { key: cp.id, className: "flex items-center justify-between rounded-xl px-4 py-3 mb-2", style: { background: t.bg2, border: "1px solid " + t.line } },
            h("button", { onClick: function () { open(cp); }, className: "text-left flex-1 active:opacity-60" },
              h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, color: t.ink } }, cp.label),
              h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog } }, cpLabel(cp.cp, characters, props.userName))),
            h("button", { onClick: function () { setEditId(cp.id); open(cp); }, className: "active:opacity-60 mr-3", style: { fontFamily: F_BODY, fontSize: 12, color: t.sub } }, "编辑"),
            h("button", { onClick: function () { props.onDelCP(cp.id); }, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 12, color: t.accent } }, "删除"));
        }) : h(Empty, { text: "还没有 CP 预设", sub: "加几对，生成时一键选" })));
  }

  // 生成设置（独立页）：多文风预设可多选切换 + 篇幅
  function MineSettings(props) {
    const t = useTheme();
    const [cfg, setCfg] = useState(window.Fanfic.loadCfg());
    const [sharedStyles, setSharedStyles] = useState(function () { return loadJSON(K_SHARED_STYLES, []) || []; });
    const [adding, setAdding] = useState(false);
    const [importing, setImporting] = useState(false);
    const [label, setLabel] = useState(""), [text, setText] = useState("");
    const [labOpen, setLabOpen] = useState(false);
    const [labName, setLabName] = useState("贴身叙事 · 留白呼吸");
    const [labSource, setLabSource] = useState("");
    const [labAxes, setLabAxes] = useState([]);
    const [labNotes, setLabNotes] = useState("");
    const [labSamples, setLabSamples] = useState(["", "", ""]);
    const [labScene, setLabScene] = useState("");
    const [labTesting, setLabTesting] = useState(false);
    const [labAB, setLabAB] = useState(null);
    function patch(p) { const n = Object.assign({}, cfg, p); setCfg(n); window.Fanfic.saveCfg(n); }
    function addStyle() {
      if (!text.trim()) { props.toast && props.toast("文风内容不能为空"); return; }
      const s = { id: uid("st"), label: label.trim() || "文风" + ((cfg.styles || []).length + 1), text: text.trim() };
      patch({ styles: (cfg.styles || []).concat([s]), activeStyleIds: (cfg.activeStyleIds || []).concat([s.id]) });
      setAdding(false); setLabel(""); setText("");
    }
    function toggle(id) {
      const on = (cfg.activeStyleIds || []).indexOf(id) >= 0;
      patch({ activeStyleIds: on ? cfg.activeStyleIds.filter(function (x) { return x !== id; }) : (cfg.activeStyleIds || []).concat([id]) });
    }
    function del(id) { patch({ styles: (cfg.styles || []).filter(function (s) { return s.id !== id; }), activeStyleIds: (cfg.activeStyleIds || []).filter(function (x) { return x !== id; }) }); }
    function toggleLabAxis(id) {
      setLabAxes(labAxes.indexOf(id) >= 0 ? labAxes.filter(function (x) { return x !== id; }) : labAxes.concat([id]));
    }
    function useCloseNarrativeRecipe() {
      setLabName("贴身叙事 · 留白呼吸");
      setLabAxes(STYLE_LAB_RECIPE.slice());
      setLabNotes("场景的温度来自人物当下会注意什么，而不是叙述者替人物分析。允许朴素句子、重复、停顿和不体面的念头；对白之后不急着解释，回忆进入后必须落回眼前的人或物。");
    }
    function saveLabStyle() {
      const prompt = buildStyleLabPrompt(labName, labSource, labAxes, labNotes, labSamples);
      if (!labAxes.length && !labNotes.trim() && !labSamples.some(function (s) { return s.trim(); })) {
        props.toast && props.toast("先选一些文风骨架，或贴一段短样例"); return;
      }
      const s = { id: uid("st"), label: labName.trim() || "文风实验", text: prompt, kind: "style-lab", sourceNote: labSource.trim(), createdAt: Date.now() };
      // 实验稿默认不启用，防止“保存一下”立刻改变下一篇成文。
      patch({ styles: (cfg.styles || []).concat([s]) });
      setLabOpen(false);
      props.toast && props.toast("已保存文风实验 · 默认未启用，勾选后才生效");
    }
    async function testLabStyle() {
      if (!props.active) { props.toast && props.toast("先在 API 设置里选一个可用模型"); return; }
      if (!labScene.trim()) { props.toast && props.toast("先写一个想测试的场景"); return; }
      const style = buildStyleLabPrompt(labName, labSource, labAxes, labNotes, labSamples);
      const task = "把下面场景写成 350～550 字的小说片段。只写正文，不起标题，不解释写法。必须让现场发生变化，并停在一个尚有余波的具体动作上。\n\n【场景】\n" + labScene.trim();
      setLabTesting(true); setLabAB(null);
      try {
        // 两边使用完全相同的场景与篇幅；唯一变量是实验文风。
        // 思考型模型会把内部思考也计入 maxTokens；1400 曾导致正文只剩几十字。
        // 与正式长文一样给足（v59.96 起是 14000，见 .claude/rules/max-tokens-floor.md）；
        // 她按次计费，在这里省预算省不到钱，只会换来一次写半截再重来。
        const base = await callAI(props.active, FANFIC_ORGANIC_FORM + "\n\n" + FANFIC_ANTI_CLICHE, [{ role: "user", content: task }], { maxTokens: 14000, timeout: 300000 });
        const styled = await callAI(props.active, FANFIC_ORGANIC_FORM + "\n\n【本次实验文风】\n" + style + "\n\n" + STYLE_FIDELITY_TAIL, [{ role: "user", content: task }], { maxTokens: 14000, timeout: 300000 });
        const cleanBase = String(base || "").trim(), cleanStyled = String(styled || "").trim();
        setLabAB({ base: cleanBase, styled: cleanStyled, baseShort: cleanBase.length < 280, styledShort: cleanStyled.length < 280 });
      } catch (e) { props.toast ? props.toast("A/B 生成失败：" + String(e.message || e)) : alert(String(e.message || e)); }
      setLabTesting(false);
    }
    function importStyleFile() {
      const inp = document.createElement("input");
      inp.type = "file"; inp.accept = ".docx,.txt,.md,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      inp.onchange = async function () {
        const file = inp.files && inp.files[0]; if (!file) return;
        setImporting(true);
        try {
          const reader = window.readWritingStyleDocument;
          if (typeof reader !== "function") throw new Error("文风解析器尚未加载，请刷新后再试");
          const prompt = await reader(file);
          const base = String(file.name || "导入文风").replace(/\.(docx|txt|md)$/i, "");
          const key = "style_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
          const item = { key: key, name: base || "导入文风", prompt: prompt, source: "local-file", importedAt: Date.now() };
          const next = sharedStyles.concat([item]);
          setSharedStyles(next); saveJSON(K_SHARED_STYLES, next);
          patch({ activeStyleIds: (cfg.activeStyleIds || []).concat(["shared:" + key]) });
          props.toast && props.toast("已导入「" + item.name + "」，只保存在本机文风库");
        } catch (e) { props.toast ? props.toast(String(e.message || e)) : alert(String(e.message || e)); }
        setImporting(false);
      };
      inp.click();
    }
    return h("div", { className: "h-full flex flex-col" },
      h(Head, { zh: "生成设置", en: "Settings", onBack: props.onBack }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-6 pb-10" },
        h("div", { className: "flex items-center justify-between mb-2" },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 17, color: t.ink } }, "预设文风"),
          h("div", { className: "flex items-center gap-3" },
            h("button", { onClick: importStyleFile, disabled: importing, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 12.5, color: t.accent, opacity: importing ? 0.5 : 1 } }, importing ? "解析中…" : "导入文件"),
            h("button", { onClick: function () { setAdding(!adding); }, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 12.5, color: t.accent } }, adding ? "取消" : "＋ 新建"))),
        h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginBottom: 10 } }, "版块只管世界背景；文风在这里单独选择。可导入 DOCX / TXT / MD，和线下共用同一份本地文风库，不上传原文件。"),
        h("div", { className: "rounded-2xl px-4 py-3 mb-4", style: { background: t.bg2, border: "1px solid " + t.line } },
          h("button", { onClick: function () { setLabOpen(!labOpen); }, className: "w-full flex items-center justify-between text-left active:opacity-70" },
            h("div", null,
              h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15.5, color: t.ink } }, "文风实验室"),
              h("div", { style: { fontFamily: F_BODY, fontSize: 10.8, color: t.fog, marginTop: 2 } }, "拆骨架 · 放短样例 · 预览后保存")),
            h("span", { style: { color: t.accent, fontSize: 13 } }, labOpen ? "收起" : "打开")),
          labOpen ? h("div", { style: { marginTop: 13 } },
            h("button", { onClick: useCloseNarrativeRecipe, className: "active:opacity-70", style: { fontFamily: F_BODY, fontSize: 12, color: t.accent, border: "1px solid " + t.accent, borderRadius: 999, padding: "6px 10px", marginBottom: 11 } }, "一键填入 · 贴身叙事骨架"),
            h("input", { value: labName, onChange: function (e) { setLabName(e.target.value); }, placeholder: "给这套实验取名", className: "w-full outline-none mb-2", style: { fontFamily: F_BODY, fontSize: 13, padding: "8px 10px", borderRadius: 9, background: t.bg, color: t.ink, border: "1px solid " + t.line } }),
            h("input", { value: labSource, onChange: function (e) { setLabSource(e.target.value); }, placeholder: "来源备注（作者 / 链接 / 自己的样稿，可留空）", className: "w-full outline-none mb-3", style: { fontFamily: F_BODY, fontSize: 12, padding: "8px 10px", borderRadius: 9, background: t.bg, color: t.ink, border: "1px solid " + t.line } }),
            h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.sub, marginBottom: 7 } }, "选择真正想借的骨架"),
            h("div", { className: "flex flex-wrap gap-2 mb-3" }, STYLE_LAB_AXES.map(function (a) {
              const on = labAxes.indexOf(a.id) >= 0;
              return h("button", { key: a.id, onClick: function () { toggleLabAxis(a.id); }, className: "active:opacity-70", style: { fontFamily: F_BODY, fontSize: 11.5, color: on ? t.bg2 : t.sub, background: on ? t.ink : t.bg, border: "1px solid " + (on ? t.ink : t.line), borderRadius: 999, padding: "6px 9px" } }, a.label);
            })),
            h("textarea", { value: labNotes, onChange: function (e) { setLabNotes(e.target.value); }, rows: 3, placeholder: "额外说明：例如少写全知判断、允许人物想错、对白别太完整……", className: "w-full outline-none resize-y mb-3", style: { fontFamily: F_BODY, fontSize: 12.5, lineHeight: 1.6, padding: "9px 10px", borderRadius: 9, background: t.bg, color: t.ink, border: "1px solid " + t.line } }),
            h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.sub, marginBottom: 3 } }, "短样例（可选，1～3 段）"),
            h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, lineHeight: 1.5, marginBottom: 8 } }, "只贴你有权使用的短段落。系统会明确要求借句法、不借人名情节和原句。"),
            labSamples.map(function (sample, i) {
              return h("textarea", { key: i, value: sample, onChange: function (e) { const next = labSamples.slice(); next[i] = e.target.value; setLabSamples(next); }, rows: 3, maxLength: 1600, placeholder: "样例 " + (i + 1) + (i ? "（可留空）" : ""), className: "w-full outline-none resize-y mb-2", style: { fontFamily: "'Noto Serif SC',serif", fontSize: 12.5, lineHeight: 1.65, padding: "9px 10px", borderRadius: 9, background: t.bg, color: t.ink, border: "1px solid " + t.line } });
            }),
            h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.sub, margin: "10px 0 6px" } }, "同场景 A/B 试写"),
            h("textarea", { value: labScene, onChange: function (e) { setLabScene(e.target.value); }, rows: 3, placeholder: "例如：分别多年后在医院走廊重逢，其中一人先认出了对方，却装作没有。", className: "w-full outline-none resize-y mb-2", style: { fontFamily: F_BODY, fontSize: 12.5, lineHeight: 1.6, padding: "9px 10px", borderRadius: 9, background: t.bg, color: t.ink, border: "1px solid " + t.line } }),
            h("button", { onClick: testLabStyle, disabled: labTesting, className: "w-full active:opacity-75", style: { fontFamily: F_BODY, fontSize: 12, color: t.accent, background: "transparent", border: "1px solid " + t.accent, padding: "9px", borderRadius: 10, opacity: labTesting ? 0.5 : 1, marginBottom: 9 } }, labTesting ? "正在生成两份…" : "试写 A/B（会调用模型 2 次）"),
            labAB ? h("div", { className: "grid grid-cols-1 gap-2 mb-3" },
              [["A · 不带文风", labAB.base], ["B · 实验文风", labAB.styled]].map(function (it) {
                return h("div", { key: it[0], style: { background: t.bg, border: "1px solid " + t.line, borderRadius: 10, padding: 10 } },
                  h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: it[0][0] === "B" ? t.accent : t.fog, marginBottom: 5 } }, it[0]),
                  h("div", { style: { fontFamily: "'Noto Serif SC',serif", fontSize: 12.5, lineHeight: 1.75, color: t.ink, whiteSpace: "pre-wrap", maxHeight: 260, overflowY: "auto" } }, it[1] || "（模型返回为空）"),
                  (it[0][0] === "A" ? labAB.baseShort : labAB.styledShort) ? h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.accent, marginTop: 7 } }, "⚠ 正文不足 280 字，上游可能提前停止；这份不适合拿来比较，请重试。") : null);
              })) : null,
            h("details", { style: { marginTop: 5, marginBottom: 10 } },
              h("summary", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.accent, cursor: "pointer" } }, "预览最终提示词"),
              h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, lineHeight: 1.65, whiteSpace: "pre-wrap", color: t.sub, background: t.bg, border: "1px solid " + t.line, borderRadius: 9, padding: 10, marginTop: 7, maxHeight: 260, overflowY: "auto" } }, buildStyleLabPrompt(labName, labSource, labAxes, labNotes, labSamples))),
            h("button", { onClick: saveLabStyle, className: "w-full active:opacity-80", style: { fontFamily: F_BODY, fontSize: 13, color: t.bg2, background: t.ink, padding: "10px", borderRadius: 10 } }, "保存实验稿（暂不启用）")) : null),
        adding ? h("div", { className: "rounded-2xl px-4 py-3 mb-4", style: { background: t.bg2, border: "1px solid " + t.line } },
          h("input", { value: label, onChange: function (e) { setLabel(e.target.value); }, placeholder: "文风名（如 冷冽白描 / 治愈慢热 / 港风）", className: "w-full outline-none mb-2", style: { fontFamily: F_BODY, fontSize: 13, padding: "7px 10px", borderRadius: 8, background: t.bg, color: t.ink, border: "1px solid " + t.line } }),
          h("textarea", { value: text, onChange: function (e) { setText(e.target.value); }, rows: 7, placeholder: "文风描述，越具体越好，想写多长写多长（无字数限制）：多用短句白描、冷色调意象、情绪藏在动作里、少直白抒情、禁用某些词……", className: "w-full outline-none resize-y mb-3", style: { fontFamily: F_BODY, fontSize: 13, lineHeight: 1.6, padding: "9px 11px", borderRadius: 8, background: t.bg, color: t.ink, border: "1px solid " + t.line, minHeight: 120 } }),
          h("button", { onClick: addStyle, className: "w-full active:opacity-80", style: { fontFamily: F_BODY, fontSize: 13, color: t.bg2, background: t.ink, padding: "9px", borderRadius: 10 } }, "保存文风")) : null,
        (cfg.styles || []).length ? (cfg.styles || []).map(function (s) {
          return h("div", { key: s.id, className: "rounded-xl px-4 py-3 mb-2", style: { background: t.bg2, border: "1px solid " + t.line } },
            h("div", { className: "flex items-center justify-between" },
              h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, color: t.ink } }, s.label),
              h("button", { onClick: function () { del(s.id); }, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 12, color: t.accent } }, "删除")),
            h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginTop: 4, lineHeight: 1.5 } }, s.text));
        }) : (adding ? null : h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, marginBottom: 8 } }, "还没有文风预设。")),

        (function () {
          const labs = labStylePresets();
          if (!labs.length) return null;
          return h("div", { style: { marginTop: 14 } },
            h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginBottom: 7 } }, "文风预设台 · 线下／小剧场／同人文共用"),
            labs.map(function (s) {
              const on = (cfg.activeStyleIds || []).indexOf(s.id) >= 0;
              return h("button", { key: s.id, onClick: function () { toggle(s.id); }, className: "w-full text-left rounded-xl px-4 py-3 mb-2 active:opacity-75", style: { background: on ? t.bg2 : "transparent", border: "1px solid " + (on ? t.accent : t.line) } },
                h("div", { className: "flex items-center justify-between" },
                  h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, color: t.ink } }, s.label),
                  h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: on ? t.accent : t.fog } }, on ? "本次默认启用" : "点按启用")),
                h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginTop: 4, lineHeight: 1.5 } }, String(s.text || "").slice(0, 180) + (String(s.text || "").length > 180 ? "…" : "")));
            }));
        })(),

        sharedStyles.length ? h("div", { style: { marginTop: 14 } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginBottom: 7 } }, "共享本地文风 · 线下与同人文都可用"),
          sharedStyles.map(function (s) {
            const id = "shared:" + s.key, on = (cfg.activeStyleIds || []).indexOf(id) >= 0;
            return h("button", { key: s.key, onClick: function () { toggle(id); }, className: "w-full text-left rounded-xl px-4 py-3 mb-2 active:opacity-75", style: { background: on ? t.bg2 : "transparent", border: "1px solid " + (on ? t.accent : t.line) } },
              h("div", { className: "flex items-center justify-between" },
                h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, color: t.ink } }, s.name || "共享文风"),
                h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: on ? t.accent : t.fog } }, on ? "本次默认启用" : "点按启用")),
              h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginTop: 4, lineHeight: 1.5 } }, String(s.prompt || "").slice(0, 180) + (String(s.prompt || "").length > 180 ? "…" : "")));
          })) : null,

        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 17, color: t.ink, margin: "18px 0 8px" } }, "篇幅"),
        h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.sub, marginBottom: 6 } }, "每篇 / 每章约多少 token（越高越长、越有剧情）"),
        // 直接填数字，不再是 2000–8000 那把滑杆。只在存的时候夹一下范围，
        // 中间允许是空串——不然打字打到一半就被回填成 500。
        h("input", {
          type: "number", inputMode: "numeric", min: 500, max: FIC_TOKEN_MAX, step: 100,
          value: cfg.perFic == null ? "" : cfg.perFic,
          onChange: function (e) { patch({ perFic: e.target.value === "" ? "" : Number(e.target.value) }); },
          onBlur: function (e) { patch({ perFic: clampPerFic(e.target.value) }); },
          style: { width: "100%", fontFamily: F_BODY, fontSize: 14, color: t.ink, background: t.bg2, border: "1px solid " + t.line, borderRadius: 10, padding: "9px 12px", outline: "none" }
        }),
        h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 6, lineHeight: 1.5 } },
          "范围 500–" + FIC_TOKEN_MAX + "。设太高的话，一次请求会很久，也更容易撞上模型自己的上限或超时。"),

        // ── 书页 ──
        h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.sub, margin: "22px 0 3px" } }, "默认书页"),
        h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginBottom: 9, lineHeight: 1.5 } },
          "换纸连墨一起换：深夜那两张是浅字深底，关灯读不刺眼。这里定的是【默认】那张——"
          + "翻开某一篇之后，点右上角那个小色块可以单独给那一篇换。"),
        h("div", { style: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 } },
          FIC_PAPERS.map(function (pp) {
            return h(PaperSwatch, {
              key: pp.id, paper: pp, on: (cfg.paper || FIC_PAPER_DEFAULT) === pp.id,
              onPick: function () { patch({ paper: pp.id }); props.onPaper && props.onPaper(pp.id); }
            });
          }))));
  }

  // 作者主页资料编辑
  function MeEditSheet(props) {
    const t = useTheme();
    const [m, setM] = useState(Object.assign({}, props.me));
    function set(k, v) { const o = {}; o[k] = v; setM(Object.assign({}, m, o)); }
    function pickImg(key) {
      const inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/*";
      inp.onchange = function () { const f = inp.files[0]; if (!f) return; resizeImageFile(f, key === "bg" ? 1080 : 480, 0.82).then(function (d) { set(key, d); }); };
      inp.click();
    }
    return h("div", { className: "fixed inset-0 z-50 flex items-end", style: { background: "rgba(0,0,0,0.35)" }, onClick: props.onClose },
      h("div", { onClick: function (e) { e.stopPropagation(); }, className: "w-full rounded-t-3xl px-6 pt-5 pb-8", style: { background: t.bg, maxHeight: "86vh", overflowY: "auto" } },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 20, color: t.ink, marginBottom: 14 } }, "编辑作者主页"),
        h("div", { className: "flex items-center gap-4 mb-4" },
          h("button", { onClick: function () { pickImg("avatar"); }, className: "active:opacity-70" }, h(Avatar, { character: { name: m.name, avatarImage: m.avatar, color: t.tint }, size: 56, radius: 16 })),
          h("button", { onClick: function () { pickImg("bg"); }, className: "flex-1 active:opacity-70", style: { height: 56, borderRadius: 12, background: m.bg ? "center/cover no-repeat url(\"" + m.bg + "\")" : t.bg2, border: "1px dashed " + t.line, fontFamily: F_BODY, fontSize: 11.5, color: t.fog } }, m.bg ? "换背景图" : "＋ 背景图")),
        h("input", { value: m.name, onChange: function (e) { set("name", e.target.value); }, placeholder: "昵称", className: "w-full outline-none mb-2", style: { fontFamily: F_BODY, fontSize: 14, padding: "9px 11px", borderRadius: 10, background: t.bg2, color: t.ink, border: "1px solid " + t.line } }),
        h("input", { value: m.handle, onChange: function (e) { set("handle", e.target.value.replace(/^@/, "")); }, placeholder: "id（@handle，不带 @）", className: "w-full outline-none mb-2", style: { fontFamily: F_BODY, fontSize: 13, padding: "9px 11px", borderRadius: 10, background: t.bg2, color: t.ink, border: "1px solid " + t.line } }),
        h("textarea", { value: m.bio, onChange: function (e) { set("bio", e.target.value); }, rows: 2, placeholder: "个人简介 / 太太的一句话", className: "w-full outline-none resize-none mb-2", style: { fontFamily: F_BODY, fontSize: 13, lineHeight: 1.5, padding: "9px 11px", borderRadius: 10, background: t.bg2, color: t.ink, border: "1px solid " + t.line } }),
        h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 } },
          [["heat", "热度"], ["fans", "粉丝"], ["following", "关注"]].map(function (fld) {
            return h("div", { key: fld[0] },
              h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginBottom: 3 } }, fld[1]),
              h("input", { type: "number", value: m[fld[0]] || 0, onChange: function (e) { set(fld[0], Number(e.target.value) || 0); }, className: "outline-none", style: { width: "100%", minWidth: 0, boxSizing: "border-box", fontFamily: F_BODY, fontSize: 13, padding: "8px 9px", borderRadius: 10, background: t.bg2, color: t.ink, border: "1px solid " + t.line } }));
          })),
        h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginBottom: 14, marginTop: -6 } }, "热度留 0 则按你发布的篇目自动统计"),
        h("button", { onClick: function () { props.onSave(m); }, className: "w-full active:opacity-80", style: { fontFamily: F_BODY, fontSize: 14, color: t.bg2, background: t.ink, padding: "12px", borderRadius: 12 } }, "保存")));
  }

  // ---------- 穿书（互动叙事 RP）----------
  function RPApp(props) {
    const t = useTheme();
    const [view, setView] = useState("list"); // list | pick | setup | thread
    const [sessions, setSessions] = useState(function () { return window.Fanfic.loadRP(); });
    const [openId, setOpenId] = useState(null);
    const [newFic, setNewFic] = useState(null);
    const [mode, setMode] = useState("left");
    const [know, setKnow] = useState("blank");
    const [landings, setLandings] = useState(null);
    const [busy, setBusy] = useState("");
    const shelf = (props.fics || []).filter(function (f) { return window.Fanfic.protectedFic(f); });
    function persist(list) { setSessions(list); window.Fanfic.saveRP(list); }
    function tabOf(fic) { return (props.tabs || []).find(function (x) { return x.id === (fic && fic.tabId); }) || { name: "", desc: "" }; }
    function charsOf(fic) { return cpChars((fic && fic.cp) || [], props.characters, props.profile); }

    // 会话
    if (view === "thread") {
      const sess = sessions.find(function (s) { return s.id === openId; });
      if (!sess) { setView("list"); return null; }
      return h(RPThread, {
        session: sess, fic: (props.fics || []).find(function (f) { return f.id === sess.ficId; }),
        tab: (props.tabs || []).find(function (x) { return x.id === sess.tabId; }) || { name: "", desc: "" },
        active: props.active, characters: props.characters, profile: props.profile, userName: props.userName, worldbook: props.worldbook, worldbookFor: props.worldbookFor, toast: props.toast,
        onBack: function () { setSessions(window.Fanfic.loadRP()); setOpenId(null); setView("list"); },
        onUpdate: function (fn) { const list = window.Fanfic.loadRP().map(function (s) { return s.id === sess.id ? fn(Object.assign({}, s)) : s; }); persist(list); }
      });
    }

    // 选文
    if (view === "pick") {
      return h("div", { className: "h-full flex flex-col" },
        h(Head, { zh: "选一篇穿进去", en: "Choose", onBack: function () { setView("list"); } }),
        h("div", { className: "flex-1 min-h-0 overflow-y-auto px-6 pb-10" },
          h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginBottom: 12 } }, "只能穿进【已收藏进书架】的篇目（去 feed 里点 ☆ 收藏）"),
          shelf.length ? shelf.map(function (f) {
            return h("button", { key: f.id, onClick: function () { setNewFic(f); setMode("left"); setKnow("blank"); setLandings(null); setView("setup"); }, className: "w-full text-left active:opacity-80 rounded-xl px-4 py-3 mb-2", style: { background: t.bg2, border: "1px solid " + t.line } },
              h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15, color: t.ink } }, f.title),
              h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.accent } }, cpLabel(f.cp, props.characters, props.userName)));
          }) : h(Empty, { text: "书架空空", sub: "先去收藏几篇再来穿" })));
    }

    // 设定穿进去的方式 + 生成降落节点
    if (view === "setup") {
      const cpc = charsOf(newFic);
      // legacy 的那几档不进选单（老存档照旧读得出来，见 RP_MODES 上的注释）
      const modeAvail = function (k) { const m = RP_MODES.find(function (x) { return x.key === k; }); return !!m && !m.legacy; };
      async function makeLandings() {
        if (!props.active) { props.toast && props.toast("请先到设置配置 API"); return; }
        setBusy("land");
        try { const lds = await window.Fanfic.genLandings(props.active, newFic, tabOf(newFic), cpc, mode, props.userName, know); setLandings(lds); }
        catch (e) { props.toast && props.toast(String(e.message || e)); }
        setBusy("");
      }
      function startSession(landing) {
        const cfg = window.Fanfic.loadCfg();
        const sess = { id: uid("rp"), ficId: newFic.id, ficTitle: newFic.title, tabId: newFic.tabId, cp: newFic.cp, mode: mode, know: know, landing: landing, style: window.Fanfic.activeStyleText(cfg), transcript: [], createdAt: Date.now(), updatedAt: Date.now() };
        persist([sess].concat(window.Fanfic.loadRP()));
        setOpenId(sess.id); setNewFic(null); setLandings(null); setView("thread");
      }
      return h("div", { className: "h-full flex flex-col" },
        h(Head, { zh: "穿书设定", en: "Step In", onBack: function () { setView("pick"); } }),
        h("div", { className: "flex-1 min-h-0 overflow-y-auto px-6 pb-10" },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 18, color: t.ink, marginBottom: 2 } }, newFic.title),
          h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.accent, marginBottom: 16 } }, cpLabel(newFic.cp, props.characters, props.userName)),
          h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.sub, marginBottom: 8 } }, "你穿成谁"),
          h("div", { className: "grid grid-cols-2 gap-2 mb-5" }, RP_MODES.filter(function (m) { return modeAvail(m.key); }).map(function (m) {
            const on = mode === m.key;
            // 按钮上写真名（「穿成 沈屿白」「穿成我自己」），不再是抽象的「CP 左位 / 右位」
            return h("button", { key: m.key, onClick: function () { setMode(m.key); setLandings(null); }, className: "text-left active:opacity-70", style: { padding: "10px 12px", borderRadius: 12, background: on ? t.ink : t.bg2, color: on ? t.bg2 : t.ink, border: "1px solid " + (on ? t.ink : t.line), fontFamily: F_BODY, fontSize: 13 } }, window.Fanfic.rpModeText(m.key, cpc));
          })),
          // 第二排：你带着什么进去。四个「你是谁」之外的另一维——穿书真正的乐趣在这儿
          h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.sub, marginBottom: 8 } }, "你带着什么进去"),
          h("div", { className: "mb-6" }, window.Fanfic.RP_KNOWS.map(function (k) {
            const on = know === k.key;
            return h("button", { key: k.key, onClick: function () { setKnow(k.key); setLandings(null); }, className: "w-full text-left active:opacity-70 mb-2", style: { padding: "10px 12px", borderRadius: 12, background: on ? t.ink : t.bg2, color: on ? t.bg2 : t.sub, border: "1px solid " + (on ? t.ink : t.line) } },
              h("div", { style: { fontFamily: F_BODY, fontSize: 13 } }, k.label),
              h("div", { style: { fontFamily: F_BODY, fontSize: 11, lineHeight: 1.55, marginTop: 3, opacity: on ? 0.75 : 0.62 } }, k.desc));
          })),
          !landings ? h("button", { onClick: makeLandings, disabled: busy === "land", className: "w-full active:opacity-80", style: { fontFamily: F_BODY, fontSize: 14, color: t.bg2, background: t.accent, padding: "12px", borderRadius: 12, opacity: busy === "land" ? 0.6 : 1 } }, busy === "land" ? "推演降落点中…" : "生成降落节点")
            : h("div", null,
              h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.sub, marginBottom: 8 } }, "选一个降落节点（从这一段开始）"),
              landings.map(function (ld) {
                return h("button", { key: ld.id, onClick: function () { startSession(ld); }, className: "w-full text-left active:opacity-80 rounded-xl px-4 py-3 mb-2", style: { background: t.bg2, border: "1px solid " + t.line } },
                  h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14.5, color: t.ink } }, ld.label),
                  h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginTop: 2, lineHeight: 1.5 } }, ld.scene));
              }),
              h("button", { onClick: function () { setLandings(null); }, className: "w-full active:opacity-60 mt-1", style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, padding: "8px" } }, "重新生成降落点"))));
    }

    // 存档列表
    const sorted = sessions.slice().sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });
    return h("div", { className: "h-full flex flex-col" },
      h(Head, { zh: "穿书", en: "Step Into Fic", onBack: props.onBack, right: h("button", { onClick: function () { setView("pick"); }, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 12.5, color: t.accent } }, "＋ 新穿书") }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-6 pb-10" },
        h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, lineHeight: 1.6, marginBottom: 14 } }, "选一篇收藏的同人文穿进去：AI 抛出处境，你输入自己的行动，剧情随你改写。每篇可开无限个存档，随时保存。"),
        sorted.length ? sorted.map(function (s) {
          return h("div", { key: s.id, className: "flex items-center rounded-xl px-4 py-3 mb-2", style: { background: t.bg2, border: "1px solid " + t.line } },
            h("button", { onClick: function () { setOpenId(s.id); setView("thread"); }, className: "text-left flex-1 active:opacity-70" },
              h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14.5, color: t.ink } }, s.ficTitle),
              h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginTop: 1 } }, window.Fanfic.rpModeShort(s.mode, charsOf({ cp: s.cp })) + (window.Fanfic.rpKnowLabel(s.know) ? " · " + window.Fanfic.rpKnowLabel(s.know) : "") + " · " + (s.landing && s.landing.label || "") + " · " + ((s.transcript || []).filter(function (e) { return e.who === "me"; }).length) + " 步")),
            h("button", { onClick: function () { const list = window.Fanfic.loadRP().filter(function (x) { return x.id !== s.id; }); persist(list); }, className: "active:opacity-60 ml-2", style: { fontFamily: F_BODY, fontSize: 12, color: t.accent } }, "删除"));
        }) : h(Empty, { text: "还没有穿书存档", sub: "点右上「＋ 新穿书」开始" })));
  }

  // 穿书会话（互动叙事）
  function RPThread(props) {
    const t = useTheme();
    const s = props.session;
    const trans = s.transcript || [];
    const [input, setInput] = useState("");
    const [busy, setBusy] = useState(false);
    const [writing, setWriting] = useState(false); // 展开"写行动"输入
    const [reveal, setReveal] = useState(99);       // 最后一段叙事已显示的段落数（初次进来全显）
    const prevLen = React.useRef(trans.length);
    const taRef = React.useRef(null);
    function autoGrow() { const el = taRef.current; if (el) { el.style.height = "auto"; el.style.height = Math.min(130, el.scrollHeight) + "px"; } }
    // 原篇被删时 props.fic 没了，退回存档自己记着的那份 cp——不然顶上又变回「魂穿左位」
    const cpc = cpChars((props.fic && props.fic.cp) || s.cp || [], props.characters, props.profile);
    const storyLore = function (extra) {
      const ids = cpc.filter(function (c) { return c && !c.isMe && c.id; }).map(function (c) { return c.id; });
      const recent = (s.transcript || []).slice(-8).map(function (x) { return x.text || ""; }).join("\n");
      return props.worldbookFor ? props.worldbookFor(ids, [props.fic && props.fic.title, props.tab && props.tab.name, recent, extra || ""].filter(Boolean).join("\n")) : props.worldbook;
    };
    const perFic = (window.Fanfic.loadCfg().perFic) || 3000;
    const rtp = typeof useTtsPlayer === "function" ? useTtsPlayer() : null; // 幕文朗读（懒合成，读前800字，重听免费）
    // 用哪个音色读幕文：优先非「我」的主角、且配了音色的那个
    const narVoice = cpc.find(function (c) { return c && !c.isMe && c.voiceId; }) || cpc.find(function (c) { return c && c.voiceId; }) || null;
    // 新叙事到来 → 只先露第一段，其余点击逐段展开
    React.useEffect(function () {
      if (trans.length > prevLen.current && trans[trans.length - 1] && trans[trans.length - 1].who === "nar") setReveal(1);
      prevLen.current = trans.length;
    }, [trans.length]);

    async function start() {
      if (!props.active || !props.fic) return;
      setBusy(true);
      try {
        let sess = s;
        // 天降模式：先确定玩家这次的固定身份（一个具体名字），全程锚定，避免被当成用户本人/主角
        if ((s.mode === "passerby" || s.mode === "random") && !s.playerIdentity) {
          const id = await window.Fanfic.genRPIdentity(props.active, props.fic, props.tab, cpc, s.mode, s.landing, props.userName, storyLore("进入故事"));
          props.onUpdate(function (ss) { ss.playerIdentity = id; return ss; });
          sess = Object.assign({}, s, { playerIdentity: id });
        }
        const text = await window.Fanfic.genRPStart(props.active, sess, props.fic, props.tab, cpc, props.userName, storyLore("故事开场"), perFic);
        props.onUpdate(function (ss) { ss.transcript = [{ who: "nar", text: text }]; ss.updatedAt = Date.now(); return ss; });
      } catch (e) { props.toast && props.toast(String(e.message || e)); }
      setBusy(false);
    }
    React.useEffect(function () { if (trans.length === 0) start(); }, []);

    async function send() {
      const act = input.trim(); if (!act || busy) return;
      setInput(""); setWriting(false); setBusy(true);
      props.onUpdate(function (ss) { ss.transcript = (ss.transcript || []).concat([{ who: "me", text: act }]); ss.updatedAt = Date.now(); return ss; });
      try {
        const text = await window.Fanfic.genRPTurn(props.active, s, props.fic, props.tab, cpc, props.userName, storyLore(act), act, perFic);
        props.onUpdate(function (ss) { ss.transcript = (ss.transcript || []).concat([{ who: "nar", text: text }]); ss.updatedAt = Date.now(); return ss; });
      } catch (e) { props.toast && props.toast(String(e.message || e)); }
      setBusy(false);
    }

    const lastIdx = trans.length - 1;
    const lastIsNar = lastIdx >= 0 && trans[lastIdx].who === "nar";
    const lastParas = lastIsNar ? trans[lastIdx].text.split(/\n{2,}/).map(function (x) { return x.trim(); }).filter(Boolean) : [];
    const moreToReveal = lastIsNar && reveal < lastParas.length;
    const canAct = !busy && lastIsNar && !moreToReveal; // 读完当前叙事才轮到我行动

    // 一段叙事正文
    function para(txt, key) { return h("p", { key: key, style: { fontFamily: "'Noto Serif SC',serif", fontSize: 15, lineHeight: 1.95, color: t.ink, whiteSpace: "pre-wrap", margin: "0 0 14px" } }, txt); }

    return h("div", { className: "h-full flex flex-col" },
      h(Head, { zh: "穿书中", en: window.Fanfic.rpModeShort(s.mode, cpc), onBack: props.onBack }),
      !props.fic ? h("div", { className: "flex-1 flex items-center justify-center px-8 text-center", style: { fontFamily: F_BODY, fontSize: 13, color: t.fog } }, "原篇已不在（可能取消了收藏被清理），此存档无法继续。") :
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-7 pb-8", style: { background: t.bg } },
        // 书名/起点抬头
        h("div", { className: "text-center py-4 mb-2" },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 17, color: t.ink } }, s.ficTitle),
          h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, letterSpacing: "0.1em", color: t.fog, marginTop: 3 } }, window.Fanfic.rpModeShort(s.mode, cpc) + " · " + (s.landing && s.landing.label || "") + (s.playerIdentity && s.playerIdentity.name ? " · 你是「" + s.playerIdentity.name + "」" : ""))),
        // 正文（叙事段落 + 我用羽毛笔写进去的行动），最后一段按 reveal 逐段显示
        trans.map(function (e, i) {
          if (e.who === "me") return h("div", { key: i, className: "my-5", style: { borderLeft: "2px solid " + t.accent, paddingLeft: 12 } },
            h("div", { style: { fontFamily: F_BODY, fontSize: 9.5, letterSpacing: "0.14em", color: t.accent, marginBottom: 3 } }, "✒ 你写下"),
            h("div", { style: { fontFamily: "'Noto Serif SC',serif", fontStyle: "italic", fontSize: 14.5, lineHeight: 1.85, color: t.accent, whiteSpace: "pre-wrap", wordBreak: "break-word", overflowWrap: "anywhere" } }, e.text));
          const paras = e.text.split(/\n{2,}/).map(function (x) { return x.trim(); }).filter(Boolean);
          const showN = (i === lastIdx) ? Math.min(reveal, paras.length) : paras.length;
          const fullyShown = showN >= paras.length;
          // 只念台词：抠出这拍里引号内的对白，纯旁白就不出 ▶
          const say = typeof extractSpeech === "function" ? extractSpeech(e.text) : e.text;
          return h("div", { key: i },
            (showN ? paras.slice(0, showN) : [e.text]).map(function (p, j) { return para(p, j); }),
            (fullyShown && say && rtp && narVoice && typeof TtsDot === "function") ? h("div", { style: { marginTop: -6, marginBottom: 12 } },
              h(TtsDot, { k: "rp" + i, text: say, spk: narVoice, tp: rtp })) : null);
        }),
        busy ? h(Spinner, { label: trans.length ? "剧情推进中…" : "开场中…" }) : null,
        // 逐段展开
        moreToReveal ? h("button", { onClick: function () { setReveal(reveal + 1); }, className: "w-full active:opacity-60 mt-1 mb-2", style: { fontFamily: F_BODY, fontSize: 12.5, color: t.fog, padding: "10px" } }, "▾ 显示下一段（" + reveal + "/" + lastParas.length + "）") : null),
      // 底部：读完了才出现"写下你的行动"（羽毛笔），不做成常驻聊天框
      props.fic && canAct ? (writing
        ? h("div", { className: "shrink-0 flex items-end gap-2 px-4 py-3", style: { background: t.bg2, borderTop: "1px solid " + t.line } },
            h("span", { style: { color: t.accent, fontSize: 16, paddingBottom: 5 } }, "✒"),
            h("textarea", { ref: taRef, value: input, autoFocus: true, rows: 1, onChange: function (e) { setInput(e.target.value); autoGrow(); }, onKeyDown: function (e) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }, placeholder: "写下你的行动 / 说的话…（Enter 发送，Shift+Enter 换行）", className: "flex-1 outline-none resize-none", style: { minWidth: 0, fontFamily: "'Noto Serif SC',serif", fontStyle: "italic", fontSize: 14.5, lineHeight: 1.6, color: t.ink, background: "transparent", borderBottom: "1px solid " + t.line, padding: "4px 2px", maxHeight: 130, overflowY: "auto", wordBreak: "break-word" } }),
            h("button", { onClick: send, disabled: !input.trim(), className: "active:opacity-70 disabled:opacity-30 flex items-center justify-center shrink-0", style: { width: 38, height: 38, borderRadius: 999, background: t.accent } }, h(ISend, { size: 15, color: "#fff" })))
        : h("button", { onClick: function () { setWriting(true); }, className: "shrink-0 active:opacity-70 mx-4 mb-3 mt-1", style: { fontFamily: F_BODY, fontSize: 13.5, color: t.bg2, background: t.ink, padding: "12px", borderRadius: 12 } }, "✒ 写下你的行动")) : null);
  }

  // ---------- 底 nav ----------
  function BottomNav(props) {
    const t = useTheme();
    const items = [
      { key: "feed", label: "首页", G: IHome }, { key: "shelf", label: "书架", G: IShelf },
      { key: "publish", label: "发布", center: true }, { key: "rp", label: "穿书", G: IPortal }, { key: "mine", label: "我的", G: GUser }
    ];
    // ⚠️底栏只吃 0.4 条底部安全区（COMPOSER_PAD_BOTTOM，engine.js）——
    // 和主聊天输入栏、购物底栏同一把尺子。这里原来吃的是【整条】
    // env(safe-area-inset-bottom)，在刘海机上比别处高出一截，
    // 正是 .claude/rules/mobile-ui-layout.md §2 点名不许干的事。
    // 图标 21 / 字号 10 / gap-0.5 也一并对齐购物那条底栏。
    return h("div", { className: "shrink-0 flex", style: { borderTop: "1px solid " + t.line, background: t.bg, paddingBottom: COMPOSER_PAD_BOTTOM } },
      items.map(function (it) {
        const on = props.view === it.key;
        if (it.center) return h("button", { key: it.key, onClick: function () { props.onNav(it.key); }, className: "flex-1 py-2 flex items-center justify-center" },
          h("div", { className: "flex items-center justify-center", style: { width: 36, height: 36, borderRadius: 999, background: t.ink } }, h(IPlus, { size: 19, color: t.bg2 })));
        return h("button", { key: it.key, onClick: function () { props.onNav(it.key); }, className: "flex-1 py-2 flex flex-col items-center gap-0.5 active:opacity-60", style: { color: on ? t.ink : t.fog } },
          h(it.G, { size: 21, color: on ? t.ink : t.fog }),
          h("span", { style: { fontFamily: F_BODY, fontSize: 10, fontWeight: on ? 600 : 400 } }, it.label));
      }));
  }

  // ============================================================
  // 主组件
  // ============================================================
  function FanficApp(props) {
    const appTheme = useTheme();
    // 她选的那张纸。⚠️用 state 存一份：在设置里换纸之后要立刻重绘，
    // 光读 loadCfg() 不会触发渲染。
    const [paperId, setPaperId] = useState(function () { return (loadCfg() || {}).paper || FIC_PAPER_DEFAULT; });
    const t = ficPaperTheme(appTheme, ficPaper({ paper: paperId }));
    const [tabs, setTabs] = useState(loadTabs);
    const [fics, setFics] = useState(loadFics);
    const [cps, setCps] = useState(loadCPs);
    const [me, setMe] = useState(function () { return meProfile(loadMe(), props.profile); });
    const [activeTab, setActiveTab] = useState(tabs[0] && tabs[0].id);
    const [view, setView] = useState("feed"); // feed / shelf / publish / rp / mine
    const [openId, setOpenId] = useState(null);
    const [gearOpen, setGearOpen] = useState(false);
    const [tabSheet, setTabSheet] = useState(null); // null | {} (new) | tabObj (edit)
    // 点标签只看这个标签的（AO3 上最常用的那一下）
    const [tagFilter, setTagFilter] = useState("");
    const [q, setQ] = useState("");            // 搜一下：标题／笔名／CP 里的人／标签／开头
    const [meOnly, setMeOnly] = useState(false); // 只看写我的
    // 读到哪儿了。关掉阅读页时重取一次，卡片上的「读到 3/8 章」才跟得上
    const [readMap, setReadMap] = useState(loadRead);
    const FANFIC_BATCH_TASK = "fanfic:batch";
    const [busy, setBusy] = useState(function () { return !!(window.BackgroundGeneration && window.BackgroundGeneration.state(FANFIC_BATCH_TASK).busy); });
    const [genProg, setGenProg] = useState(function () { return window.BackgroundGeneration ? window.BackgroundGeneration.state(FANFIC_BATCH_TASK).progress : null; });

    useEffect(function () {
      if (!window.BackgroundGeneration) return;
      return window.BackgroundGeneration.subscribe(FANFIC_BATCH_TASK, function (s) {
        setBusy(!!s.busy);
        setGenProg(s.progress || null);
        if (s.status === "done") setFics(loadFics());
      });
    }, []);

    const userName = (props.profile && props.profile.name) || "我";
    const characters = props.characters || [];          // 真人角色：转发选人用这份
    // cast＝含配角的全量：CP 选择、CP 名字解析、CP 预设都得看得见配角。
    // 老调用方没给 allChars 时退回 characters，行为和以前一样。
    const cast = props.allChars || characters;
    const curTab = tabs.find(function (x) { return x.id === activeTab; }) || tabs[0];

    function persistFics(next) { if (saveFics(next)) { setFics(next); return true; } props.toast && props.toast("这次没保存成功，原文章还在"); return false; }
    function updateFic(id, fn) {
      const next = loadFics().map(function (f) { return f.id === id ? fn(Object.assign({}, f)) : f; });
      persistFics(next);
    }
    function toggleShelf(id) {
      updateFic(id, function (f) { f.onShelf = !f.onShelf; return f; });
      props.toast && props.toast("已" + (loadFics().find(function (f) { return f.id === id; }).onShelf ? "收藏" : "取消收藏"));
    }

    // 点赞（切换）
    function likeFic(id) { updateFic(id, function (f) { f.liked = !f.liked; return f; }); }
    function saveMeFn(m) { setMe(m); saveMe(m); props.toast && props.toast("已保存"); }
    // 转发：记录 sharedTo（item 8：新章推给这些角色）并调 app.js 真正 push
    function fwdChat(fic, ch) { updateFic(fic.id, function (f) { const s = f.sharedTo || []; if (s.indexOf(ch.id) < 0) s.push(ch.id); f.sharedTo = s; return f; }); props.onForwardToChat && props.onForwardToChat(fic, ch); }
    function fwdGroup(fic, g) { props.onForwardToGroup && props.onForwardToGroup(fic, g); }
    // 追更后通知曾被分享的角色读新章
    function chapterShared(fic, ch, chapNo) { props.onNotifyChapter && props.onNotifyChapter(fic, ch, chapNo, fic.sharedTo || []); }

    // 生成
    async function doGen(n, cp, styleIds, includeMe, briefs) {
      setGearOpen(false);
      props.toast && props.toast("已放到后台生成（" + n + " 篇），可以先去别的页面");
      const run = async function (updateProgress) {
        const chars = cpChars(cp, characters, props.profile);
        const routedWorldbook = props.worldbookFor ? props.worldbookFor((cp || []).filter(function (id) { return id && id !== "me"; }), [curTab.name, curTab.desc, (briefs || []).join("\n")].filter(Boolean).join("\n")) : props.worldbook;
        const cfg = loadCfg();
        // 本次勾选的文风（GenSheet 传来）→ 用它，并记住当默认；没传就退回上次的
        let styleText;
        let selectedStyleIds;
        if (Array.isArray(styleIds)) {
          saveCfg(Object.assign({}, cfg, { activeStyleIds: styleIds }));
          styleText = styleTextForIds(cfg, styleIds);
          selectedStyleIds = styleIds.slice();
        } else {
          styleText = activeStyleText(cfg);
          selectedStyleIds = (cfg.activeStyleIds || []).slice();
        }
        const selectedStyleLabels = allStylePresets(cfg).filter(function (s) { return selectedStyleIds.indexOf(s.id) >= 0; }).map(function (s) { return s.label || "未命名文风"; });
        // 推荐(mixed)版：把其它世界观当池子供每篇随机取
        const worldPool = curTab.mixed ? tabs.filter(function (x) { return !x.mixed; }) : null;
        const briefList = Array.isArray(briefs) ? briefs : [];
        const opts = { style: styleText, perFic: cfg.perFic, chatMaterial: chatMaterialFor(chars), worldPool: worldPool,
          briefs: briefList,
          includeMe: !!includeMe, meName: (props.profile && props.profile.name) || userName || "我", mePersona: (props.profile && props.profile.persona) || "" };
        // 超长文风（如金鱼灯）若一口气索要多篇，Supabase 代理要等整份 JSON 写完才回，
        // 很容易先撞上云端长请求时限。保留文风全文、不压字数，改为一篇一交：
        // 每篇完成立刻落库；中途失败也不赔掉已经写好的篇目。普通文风仍是一批一次调用。
        const LONG_STYLE_CHARS = 6000;
        const oneByOne = n > 1 && String(styleText || "").length >= LONG_STYLE_CHARS;
        const made = [];
        function records(arr, offset) {
          const now = Date.now();
          return arr.map(function (x, i) {
          return {
            id: uid("fic"), tabId: curTab.id, cp: cp || [], title: x.title, author: x.author, tags: x.tags, premise: x.premise || "",
            chapters: [{ content: x.body, endHook: x.endHook, cot: x.cot || null, cotRequested: !!x.cotRequested }], source: "npc", onShelf: false, sharedTo: [],
            generationStyleIds: selectedStyleIds.slice(), generationStyleLabels: selectedStyleLabels.slice(),
            stats: ficHeat(x.title + now + i + offset), reviews: [], createdAt: now - i - offset, updatedAt: now - i - offset
          };
          });
        }
        if (oneByOne) {
          for (let i = 0; i < n; i++) {
            updateProgress && updateProgress({ done: i, total: n }, "长文风分篇生成");
            // ⚠️分篇那条支路也得把这一篇的梗带上，否则长文风下点的梗静默失效
            const arr = await window.Fanfic.genBatch(props.active, curTab, chars, 1, userName, routedWorldbook,
              Object.assign({}, opts, { briefs: [briefList[i] || ""] }));
            const part = records(arr, i);
            made.push.apply(made, part);
            if (part.length) saveFics(part.concat(loadFics()));
            updateProgress && updateProgress({ done: i + 1, total: n }, "长文风分篇生成");
          }
        } else {
          const arr = await window.Fanfic.genBatch(props.active, curTab, chars, n, userName, routedWorldbook, opts);
          made.push.apply(made, records(arr, 0));
          saveFics(made.concat(loadFics()));
        }
        props.toast && props.toast("已生成 " + made.length + " 篇");
        return made;
      };
      if (!window.BackgroundGeneration) {
        setBusy(true);
        try { await run(); setFics(loadFics()); } catch (e) { props.toast && props.toast(String(e.message || e)); }
        setBusy(false); return;
      }
      try { await window.BackgroundGeneration.start(FANFIC_BATCH_TASK, { label: "同人文生成中" }, run); }
      catch (e) { props.toast && props.toast(String(e.message || e)); }
    }

    // 清空本版里没被留下的那些。
    // ⚠️这个按钮以前叫「刷新」，摆在齿轮旁边——但它【只删不生成】，
    // 生成在齿轮里。手一滑，点过赞、追到一半的文一次全没，还没有二次确认。
    // 现在：叫它本来的名字，删之前先说清楚要删几篇、留几篇。
    function clearTab() {
      const here = loadFics().filter(function (f) { return f.tabId === curTab.id; });
      const doomed = here.filter(function (f) { return !protectedFic(f); });
      if (!doomed.length) { props.toast && props.toast("本版没有可清的：剩下的都是收藏／自己写的／点过赞／在追的"); return; }
      const kept = here.length - doomed.length;
      requestAppConfirm("清空【" + curTab.name + "】里的 " + doomed.length + " 篇？",
        (kept ? "另外 " + kept + " 篇会留下（收藏／自己写的／点过赞／在追的）。\n" : "") + "清完这一版是空的，要新的文请点齿轮生成。",
        function () { if (persistFics(loadFics().filter(function (f) { return f.tabId !== curTab.id || protectedFic(f); }))) props.toast && props.toast("已清空 " + doomed.length + " 篇"); }, "清空");
    }

    // 发布（onShelf=false → 留在 feed + 我发布的；source=user 刷新受保护不会被清）
    function publish(tabId, title, cp, tags, body) {
      const now = Date.now();
      const fic = { id: uid("fic"), tabId: tabId, cp: cp || [], title: title, author: me.name || userName, tags: tags, chapters: [{ content: body, endHook: "" }], source: "user", onShelf: false, sharedTo: [], stats: ficHeat(title + now), reviews: [], createdAt: now, updatedAt: now };
      persistFics([fic].concat(loadFics()));
      setActiveTab(tabId); setView("feed");
      props.toast && props.toast("已发布");
    }

    // tab 增删改
    function saveTab(id, name, desc) {
      let next;
      if (id) next = tabs.map(function (tb) { return tb.id === id ? Object.assign({}, tb, { name: name, desc: desc }) : tb; });
      else { const nt = { id: uid("tab"), name: name, desc: desc }; next = tabs.concat([nt]); }
      setTabs(next); saveTabs(next); setTabSheet(null);
      if (!id) props.toast && props.toast("已添加世界观");
    }
    function delTab(id) {
      const next = tabs.filter(function (tb) { return tb.id !== id; });
      setTabs(next); saveTabs(next); setTabSheet(null);
      if (activeTab === id) setActiveTab(next[0] && next[0].id);
    }

    function addCP(cp) { const next = cps.concat([cp]); setCps(next); saveCPs(next); }
    function delCP(id) { const next = cps.filter(function (c) { return c.id !== id; }); setCps(next); saveCPs(next); }

    // ---- 阅读页 ----
    // ⚠️所有 return 都得包在这一层里。阅读页这一支是提前 return 的，
    // 忘了包的话它就绕过了纸的主题——选了深夜，列表黑了、翻开还是米黄（实测踩到）。
    const onPaper = function (node) { return h(ThemeContext.Provider, { value: t }, node); };
    if (openId) {
      const f = fics.find(function (x) { return x.id === openId; });
      if (!f) { setOpenId(null); return null; }
      const ftab = tabs.find(function (x) { return x.id === f.tabId; }) || curTab;
      // ⚠️这一篇用【它自己那张纸】，不是列表那张：外层 Provider 和传给 Reader 的
      // 必须是同一张，否则头上那个小色块跟正文对不上。
      const fPaper = ficPaperFor(f, { paper: paperId });
      return h(ThemeContext.Provider, { value: ficPaperTheme(appTheme, fPaper) }, h(Reader, {
        paper: fPaper,
        onSetPaper: function (pid) { updateFic(f.id, function (x) { x.paper = pid; return x; }); },
        fic: f, tab: ftab, active: props.active, characters: cast, fwdChars: characters, profile: props.profile,
        groups: props.groups || [], userName: userName, worldbook: props.worldbook, worldbookFor: props.worldbookFor, toast: props.toast,
        // 关阅读页时把进度重取一遍，卡片上那句「读到 3/8 章」才跟得上
        onBack: function () { setOpenId(null); setReadMap(loadRead()); },
        onUpdate: updateFic, onToggleShelf: toggleShelf, onLike: likeFic,
        onForwardToChat: fwdChat, onForwardToGroup: fwdGroup, onChapterShared: chapterShared
      }));
    }

    // ---- 各子页 ----
    let inner;
    if (view === "publish") {
      inner = h(Publish, { tabs: tabs, characters: cast, userName: userName, toast: props.toast, onBack: function () { setView("feed"); }, onPublish: publish });
    } else if (view === "mine") {
      inner = h(Mine, { characters: cast, cps: cps, userName: userName, me: me, fics: fics, profile: props.profile, active: props.active, toast: props.toast,
        onPaper: setPaperId,
        onBack: function () { setView("feed"); }, onAddCP: addCP, onDelCP: delCP,
        onOpenFic: function (id) { setOpenId(id); }, onSaveMe: saveMeFn });
    } else if (view === "rp") {
      inner = h(RPApp, { fics: fics, tabs: tabs, characters: cast, profile: props.profile, userName: userName, active: props.active, worldbook: props.worldbook, worldbookFor: props.worldbookFor, toast: props.toast, onBack: function () { setView("feed"); } });
    } else {
      // feed / shelf。item 5：收藏(onShelf)的从 feed 移除、只在书架出现
      // 搜的时候连 CP 里那几个人的名字一起搜——「按 CP 找」用的就是这条：
      // 打「裴照川」出来的是所有写他的，不用先建一个 CP 预设。
      const kw = q.trim().toLowerCase();
      const hay = function (f) {
        const cpNames = (f.cp || []).map(function (id) {
          if (id === "me") return userName + " 我";
          const c = characters.find(function (x) { return x.id === id; });
          return c ? (c.name + " " + (c.remark || "")) : "";
        }).join(" ");
        return [f.title, f.author || ficPenName(f.id), cpNames, (f.tags || []).join(" "),
          (((f.chapters || [])[0] || {}).content || f.body || "").slice(0, 120)].join(" ").toLowerCase();
      };
      const list = fics.filter(function (f) {
        if (tagFilter && (f.tags || []).indexOf(tagFilter) < 0) return false;
        if (meOnly && !ficHasMe(f)) return false;
        if (kw && hay(f).indexOf(kw) < 0) return false;
        // 搜的时候跨版搜：她记得有那么一篇，但多半不记得它在哪一版
        if (view === "shelf") return f.onShelf === true;
        if (kw) return !f.onShelf;
        return f.tabId === (curTab && curTab.id) && !f.onShelf;
      }).sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });
      inner = h("div", { className: "flex-1 min-h-0 flex flex-col" },
        // 紧凑标题栏（.claude/rules/mobile-ui-layout.md §1）：原先那块 30px 大标题
        // ＋「FANFIC」副标，一屏先被吃掉五分之一，正文卡片只剩两张半。
        h("div", { className: "shrink-0 flex items-center px-4 pb-2", style: { paddingTop: safeTop(10) } },
          h("button", { onClick: props.onBack, "aria-label": "返回", className: "active:opacity-50 flex items-center justify-center", style: { width: 40, height: 40, marginLeft: -8 } }, h(IArrow, { size: 19, color: t.ink })),
          h("div", { className: "flex-1 min-w-0 text-center" },
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: t.ink, lineHeight: 1.15 } }, view === "shelf" ? "书架" : "同人文"),
            h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 8.5, letterSpacing: "0.18em", color: t.fog, marginTop: 2 } }, view === "shelf" ? "SHELF" : "FANFIC")),
          h("div", { className: "flex items-center justify-end", style: { gap: 10, minWidth: 40 } },
            view === "shelf" ? h("button", { onClick: function () { const n = exportFanficAudit(tabs, loadFics(), loadCfg()); props.toast && props.toast("已导出 " + n + " 篇同人文诊断稿"); }, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 12, color: t.accent } }, "导出")
              : view === "feed" ? h(React.Fragment, null,
                  h("button", { onClick: clearTab, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 12, color: t.fog } }, "清空"),
                  h("button", { onClick: function () { setGearOpen(true); }, disabled: busy, className: "active:opacity-60", title: "生成配置" }, h(GConfig, { size: 19, color: t.ink })))
              : null)),
        view === "feed" ? h(TabBar, {
          tabs: tabs, activeId: activeTab, onPick: setActiveTab,
          onAdd: function () { setTabSheet({}); }, onEdit: function (tb) { setTabSheet(tb); }
        }) : null,
        // 搜一下 + 只看写我的。搜的时候跨版搜，因为她多半不记得那篇在哪一版。
        h("div", { className: "px-5 pb-2 flex items-center", style: { gap: 8 } },
          h("input", {
            value: q, onChange: function (e) { setQ(e.target.value); },
            placeholder: "搜标题、笔名、CP 里的人、标签…",
            style: { flex: 1, minWidth: 0, fontFamily: F_BODY, fontSize: 12, color: t.ink, background: t.bg2, border: "1px solid " + t.line, borderRadius: 999, padding: "6px 12px", outline: "none" }
          }),
          q ? h("button", { onClick: function () { setQ(""); }, className: "active:opacity-60 shrink-0", style: { fontFamily: F_BODY, fontSize: 11, color: t.accent } }, "清除") : null,
          h("button", {
            onClick: function () { setMeOnly(function (v) { return !v; }); }, className: "active:opacity-70 shrink-0",
            style: { fontFamily: F_BODY, fontSize: 11.5, padding: "5px 11px", borderRadius: 999, background: meOnly ? t.accent : "transparent", color: meOnly ? t.bg2 : t.sub, border: "1px solid " + (meOnly ? t.accent : t.line) }
          }, "有我")),
        // 正在按标签筛：得看得见、且随手能取消，不然点进去就出不来了
        tagFilter ? h("div", { className: "px-5 pb-2 flex items-center", style: { gap: 8 } },
          h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog } }, "只看"),
          h(FicTag, { tag: tagFilter }),
          h("button", { onClick: function () { setTagFilter(""); }, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 11, color: t.accent } }, "取消")) : null,
        q ? h("div", { className: "px-5 pb-2" },
          h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog } }, "跨版搜「" + q.trim() + "」· " + list.length + " 篇")) : null,
        // 板块简介收进固定高度的滚动框（简介写长后曾占掉三分之一屏挡文）：默认露两三行，框内下滑看全部
        view === "feed" && curTab && curTab.desc ? h("div", { className: "px-5 pb-2" },
          h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, lineHeight: 1.55, whiteSpace: "pre-line", maxHeight: 62, overflowY: "auto", WebkitOverflowScrolling: "touch", background: t.bg2, border: "1px solid " + t.line, borderRadius: 10, padding: "7px 10px" } }, curTab.desc)) : null,
        h("div", { className: "flex-1 min-h-0 overflow-y-auto px-5 pb-6" },
          busy ? h(Spinner, { label: genProg && genProg.total ? ("后台生成中 " + genProg.done + "/" + genProg.total + "…可以离开本页") : "后台生成中…可以离开本页，回来会自动接上" }) : null,
          list.length ? list.map(function (f, i) {
            const rd = readMap[f.id];
            const chN = (f.chapters || []).length;
            return h(FicCard, {
              key: f.id, fic: f, characters: cast, userName: userName,
              // ⚠️位置传【当前这一屏的下标】，不是它在库里的位置：
              // 删一篇、筛个标签、搜一下，下面那篇顶上来就该自动变色、序号跟着重排。
              index: i, leadLabel: view === "shelf" ? "ON THE SHELF" : "TOP OF THE FEED",
              readAt: rd ? (chN > 1 && rd.chap > 0 ? "读到 " + (rd.chap + 1) + "/" + chN : "读过") : "",
              onTag: function (tag) { setTagFilter(tag === tagFilter ? "" : tag); },
              onOpen: function () { setOpenId(f.id); }, onLike: function () { likeFic(f.id); } });
          }) : (busy ? null : h(Empty, { text: view === "shelf" ? "书架空空" : "本版还没有同人文", sub: view === "shelf" ? "收藏或发布的篇目会留在这里追更" : "点右上角齿轮生成，或用底部加号自己写" }))));
    }

    // 发布/我的/rp 是全屏子页（自带返回箭头回 feed），不叠底 nav；feed/shelf 才显示底 nav
    const showNav = view === "feed" || view === "shelf";
    // 页面皮肤：纸纹＋光＋角上的弧。⚠️页底那个特大词【去掉了】（她 2026-08-30 点名）——
    // 这一处是在读书，一整页压着个 FANFIC 太吵；别处还留着。
    // 整个 App 套上她选的那张纸：卡片、标签、深浅交替全都读 useTheme()，
    // 换张纸自动跟着走，一个组件都不用改。
    return onPaper(
      h("div", { className: "h-full flex flex-col", style: pageSkin("paper", t, { corner: true }) },
      inner,
      showNav ? h(BottomNav, { view: view, onNav: function (k) { setView(k); } }) : null,
      gearOpen ? h(GenSheet, { tab: curTab, cps: cps, characters: cast, userName: userName, onClose: function () { setGearOpen(false); }, onConfirm: doGen }) : null,
      tabSheet ? h(TabSheet, { tab: tabSheet.id ? tabSheet : null, onClose: function () { setTabSheet(null); }, onSave: saveTab, onDelete: delTab }) : null));
  }

  window.FanficApp = FanficApp;
})();
