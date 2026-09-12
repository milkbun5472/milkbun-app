// ============================================================
// 同人文（fanfic）—— Phase 1
// feed / 批量生成 / 追更 / 书评 + RP(穿进同人文) 最小 stub。
// 数据走 localStorage（x_fanfic_tabs / x_fanfic_fics / x_fanfic_cps），
//   全部 x_ 前缀，自动跟随现有 saves 整包云同步。
// 生成管线：system(反八股 + 角色卡准则 + 亲密反模板 + 同人文反陈词滥调)
//   + 选中 CP 角色卡 + 当前 tab 世界观(world book) + 生成指令，
//   一次批量出 N 篇；共用 parseJSONLoose 容错，业务保留自动重试（不动全局 callAI）。
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
    "· 病句的形状（认这个形状，不是背例句）：一个动作之后立刻跟上两三句解释——先说她为什么这么做，\n" +
    "  再给这个动作下一个定义，最后升华成一句关于两人关系的判断。看见自己在写第二句解释就停。\n" +
    "  改法：把那两三句解释删掉，让现场自己往下走——同一个动作被重复一次、旁边的东西发出动静、\n" +
    "  或者人物转身去处理另一件事。⚠️这里不给范句：给了就会被整篇照搬（prompt-no-content-samples）。";
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

  // 正面示例（v47.74 立，v61.23 改写）：纯禁词清单压不住（否定指令模型不敏感，
  // 「埋进颈窝」照样出现），所以保留「烂模板 → 换成什么」的对照。
  // ⚠️但 ✓ 那半边原来写的是【四句写好的成句】（旧毛衣的线头、够了两次没拿稳、
  // 摸烟又缩回手）——照 施工规则/prompt-no-content-samples.md，
  // 例子写得越好被抄得越狠，它是那一栏里唯一可复制的东西，于是每篇都长成同一个样子。
  // 判据：这句被逐字照抄是对的还是错的？「够了两次都没拿稳」被照抄就是灾难。
  // 所以 ✓ 这半边一律换成【要满足什么】，不给可以直接搬走的句子。
  const FANFIC_GOOD_EXAMPLES =
    "【别写模板，换成什么】左边是禁用的烂模板，右边不是范句、是这一处必须满足的条件：\n" +
    "· ✗ 把脸埋进颈窝 → ✓ 换成一个【只有这两个人、在这个场合才做得出】的靠近动作：它要有来由（因为刚发生的某件事），要碰到这个场景里真实存在的东西，还要配一句说歪了的话——不接对方上一句、答非所问、或说的是别的事。\n" +
    "· ✗ 低吼一声把人圈进怀里 → ✓ 碰触必须由现场的一件事带出来（要避开什么、要递什么、要拦下什么），不许凭空发生；停手的时机比动作本身更要紧。\n" +
    "· ✗ 空气仿佛凝固了／耳尖泛红 → ✓ 心绪外化成一件【做砸的小事】：手上正在做的事出了误差，全程不点破，不许补一句解释它意味着什么。\n" +
    "· ✗ 事后满足地叹气、把人搂得更紧 → ✓ 收尾落在一个【别扭的、只属于这个人的】小动作上：他想做又中途改了主意，改的理由来自他对对方的了解。\n" +
    "核心：情绪全部藏进「有来由的动作＋这个场景里真实存在的物件＋说歪的话」，一整段可以不出现任何情绪词；每一处亲密都要能回答『为什么是这个动作、为什么是此刻』。\n" +
    "⚠️上面的 ✓ 是判据不是范文。若某一句写完之后，把两位主角换成任何别的角色也照样成立，就是写坏了，重写那一句。";

  // world book 亲密场景「设定层」补充（拼进当前 tab 世界观之后）——中文比喻词表走「可用」方向，
  // 上面 FANFIC_ANTI_CLICHE 走「禁用」方向，两头夹。
  const INTIMACY_WORLDNOTE =
    "【亲密场景写作设定层】写到亲密/情欲时：动作与反应必须『非这两个人不可』，" +
    "优先写角色专属的小动作、口癖、他在意的具体细节；收尾落在一句符合他声纹的话或只属于他俩的细节上，" +
    "别用『埋进颈窝深吸气／忍不住求饶／热流直冲天灵盖』这类通用模板收尾。尺度贴合本世界观基调，别自我阉割也别为露骨而露骨。";

  // ---- 预设世界观 tab（首启种子）------------------------------------
  // mixed:true 的「推荐」= 从其它版块类别随机抽来写（每篇随机挑一个世界观）
  // ---------- 预设世界观 tab（首启种子）------------------------------------
  // 顺序不照热门榜排（那是别人站里的排法），按【她俩的温度】排：
  // 推荐打头，写他们最多的古风/ABO 顶到前面，冷门题材靠后。
  const SEED_TABS = [
    { id: "tab_reco", name: "推荐", desc: "综合推荐——从所有世界观类别里随机抽取来写，冷暖甜虐各种题材混着来。", seed: true, mixed: true },
    { id: "tab_ancient", name: "古风", desc: "古风架空。朝堂、江湖、深宅、边关。\n【文风必须真的古】要有半文半白的古白话语感（近《红楼》《金瓶》话本、明清世情小说的腔调），不是套了古装的现代小说：\n· 叙述与对白都用文白相间的句子，多用四字短语、对仗与留白；句子偏短，忌长句欧化从句。\n· 称谓、器物、时辰、礼数都用古时说法（妾身/在下/郎君/娘子、更漏/时辰、案几/罗帐/袖中、拱手/敛衽），第一/第二人称少用「你我」多用身份称谓。\n· 严禁现代词与翻译腔：像「感觉/情绪/状态/氛围/空气/时间仿佛静止/心脏/大脑/紧张/放松/关系/沟通/瞬间/画面」这类词一律换成古意表达或删去。\n· 情感靠动作、景物、器物与欲言又止来递，隐忍克制，别直白宣泄、别现代心理描写。", seed: true },
    { id: "tab_abo", name: "ABO", desc: "ABO 世界观。Alpha/Beta/Omega 三分性别、信息素、易感期/发情期、标记。\n【文风】设定内自洽，信息素与本能是核心张力：\n· 信息素要写成【只属于这一个人】的气味与生理反应：它像什么该跟他的来历、职业、住处对得上；忌那几种谁身上都有的甜味木香，忌一律用「突然爆发」推进。\n· 张力核心是「本能推着走 vs 人想自己选」：克制、抵抗、社会规训下的身不由己要写足，别一闻就倒。\n· 涉及标记/发情期要有前因后果与事后代价（药剂、请假、旁人眼光），设定要落进生活肌理，不只是床戏开关。\n· 忌把 Omega 写成无脑娇弱花瓶、把 Alpha 写成发情机器——性别设定之下先是活人。", seed: true },
    { id: "tab_minguo", name: "民国", desc: "民国。公馆与弄堂、洋行与码头、学堂与报馆，长衫旗袍与舶来品混着。\n【文风】半旧半新的语感——比古风松，比现代旧：\n· 句子用那个年代书面白话的调子：文言的骨、白话的肉，少用现代心理学词汇和翻译腔长句。\n· 称谓与礼数按当时来（先生/小姐/太太/东家、鞠躬与握手并存），中西两套规矩同时压在人身上，冲突从这儿长。\n· 时代是背景也是刀：兵荒、通货、留洋、家族安排——写出人被时局推着走，别把它当装饰布景。\n· 情感含蓄、要靠信、物、约定来递；忌民国偶像剧那种只换了衣服的现代恋爱。", seed: true },
    { id: "tab_campus", name: "校园", desc: "校园背景。教室、操场、晚自习、社团。\n【文风】青涩、克制、有少年感，绝不许写成成年人办公室恋爱：\n· 亲密的上限是【一次没打算发生的碰到】：借还东西、递水、让路时擦到——张力来自「不敢」而不是「忍着」，写出来的那一下要是这两个人此刻手边真有的事。\n· 用课程表、月考排名、广播操、值日表这些校园肌理标时间；对白带少年人的逞强和词不达意。\n· 心事写成小动作，条件是【别人看得见但看不懂】：它得留在纸上、路线上、时间安排上，而不是心里；一句都不许点破。\n· 忌早恋剧模板（天台告白/自行车后座光环化），忌让高中生说出三十岁的情话。", seed: true },
    { id: "tab_yao", name: "志怪", desc: "志怪。山精狐鬼、庙祝与旅人、灯下与荒宅，人与非人相遇。\n【文风】笔记体的冷与短，不是玄幻打怪：\n· 叙述像有人转述一桩听来的事：起得平、收得快，怪异之处一笔带过反而更瘆人；忌长篇设定说明。\n· 妖异要守自己的规矩（能做什么、忌什么、代价是什么），规矩先立住，情节再从违规里出。\n· 人与非人的差别是核心张力：寿数、记性、能不能被看见——温柔和残忍都从这个差别里长。\n· 结尾可留白、可反讽，忌升华式旁白，忌把志怪写成套了皮的现代恋爱。", seed: true },
    { id: "tab_apoc", name: "末世", desc: "末世/废土背景。资源匮乏、丧尸或灾变、幸存者据点。\n【文风】冷硬底色，感情在生死边缘发生：\n· 物资是叙事的骨头：每一次「分给谁、留多少、省着不用」都是一次表态——温柔全部藏在分配里，不许直说；分配的东西要是这一处据点真会缺的那几样。\n· 危险要真实有代价（受伤会感染、睡觉要轮岗），忌主角光环；死亡与失去写得克制、不煽情。\n· 对白短、省字，像真的不敢浪费体力；亲密要长在【活下去的分工】里（谁守夜、谁先睡、谁把身上的东西让出去），不是废土里谈都市恋爱。\n· 忌「乱世佳人」滤镜与升华式旁白，末世的浪漫是「今天也活下来了」。", seed: true },
    { id: "tab_xihuan", name: "西幻", desc: "西幻。骑士与法师、公会与旅店、王都与长路。\n【文风】叙事扎实、器物可信，别写成游戏说明书：\n· 魔法要有代价与限制（消耗、禁忌、后果），先立规矩再用；忌全能式的临场解围。\n· 世界靠具体的生活面铺开：路费、马料、行会规矩、教会与领主的关系，不靠一整段设定介绍。\n· 对白避免现代口语和网络词，也避免翻译腔的长句；称谓与礼节按身份来。\n· 感情长在同路的时间里：值夜、分口粮、替对方挡下一次麻烦；忌数值与技能面板腔。", seed: true },
    { id: "tab_hk", name: "港片", desc: "港片质感。八九十年代香港，警匪、江湖义气、霓虹与雨夜、茶餐厅。\n【文风】粤味、宿命感、江湖儿女的克制深情：\n· 台词要有港片味：短、狠、带粤语语感（粤语常用词照用，别翻成书面普通话），点到即止，忌长篇抒情。\n· 场景写足港味肌理：湿、挤、亮——招牌、街市、楼梯间、天台这一类地方要具体到营生和时辰，雨夜与市井烟火是底色。\n· 义气与情分大过告白：深情一律写成【替对方担下的事】，做了不说、说了不认。\n· 宿命感靠留白与反讽：让一件约好的事以差一点的方式落空，忌把结局说破、忌旁白升华。", seed: true }
  ];
  // 退役的种子（她 2026-09-03 点名撤掉）：不再出现在版块栏里，
  // 但【底下还有文章的那一版照旧留着】——撤版块不是删她的文。
  const RETIRED_TABS = [
    { id: "tab_urban", name: "都市", desc: "现代都市背景。写字楼、地铁、深夜便利店、微信消息。\n【文风】写实、生活颗粒感，情感张力全藏在日常缝隙里：\n· 场景要具体到【只有常来的人才说得出的那一层】：不是场所的名字，是这个场所里此刻正在发生、且会过期的那件小事；时间用通勤/加班/末班车这类都市节律来标。\n· 对话像真人发微信、真人下班后说话：短、有错字式的随意、有已读不回；忌散文腔告白。\n· 情绪靠【手机里和手边的东西】递：一句改过的备注、一处替对方省的麻烦；忌直接写「心动/心跳加速」。\n· 忌偶像剧套路（壁咚/摔进怀里/雨中告白），冲突从房租、加班、家人这些真实压力里长出来。", seed: true },
    { id: "tab_endless", name: "无限流", desc: "无限流。主角被卷入一个个副本/试炼世界，规则残酷、通关或死。\n【文风】悬疑惊悚打底，感情在极限处境里淬出来：\n· 副本规则要具体、可推理、有漏洞可钻（把规则条文写出来），恐怖来自规则本身的恶意而非 jump scare 堆砌。\n· 智斗要真的智：线索前置、解法讲得通，忌主角突然「灵光一闪」空降答案。\n· 队友会死、信任稀缺，感情线是「在不敢信人的地方偏偏信了你」，进展小步、代价真实。\n· 忌数值化打怪升级腔（面板/技能点），保持文学叙事的质地。", seed: true }
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
  // minChars=每章最少写多少字。0＝跟着 perFic 折算（旧行为），填了数就以它为准。
  // ⚠️它是【字数】不是 token：perFic 那一栏是 token 目标，两件事，别混着看。
  const CFG_DEFAULT = { styles: [], activeStyleIds: [], perFic: 4200, minChars: 0 };
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
  // 那是【内容示范】，跟 施工规则/prompt-no-content-samples.md 说的是同一件事：
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
    return pagePalette("fanfic", Object.assign({}, base || DEFAULT_THEME, {
      bg: paper.bg, bg2: paper.bg2, ink: paper.ink, sub: paper.sub,
      fog: paper.fog, line: paper.line, accent: paper.accent, tint: paper.tint
    }));
  }
  // 一章的字数地板。只此一份：提示词里发的、写完数的、界面上提示的，全问它要。
  // ⚠️API 上**没有 min_tokens 这种东西**（max_tokens 是天花板，没有地板），
  //   所以「最低要求」只能落成两件事：写进提示词 + 写完自己数一遍。
  const MIN_CHARS_MAX = 20000;
  function clampMinChars(v) {
    const n = Math.round(Number(v));
    if (!isFinite(n) || n <= 0) return 0;
    return Math.max(200, Math.min(MIN_CHARS_MAX, n));
  }
  function minCharsFor(cfg) {
    const set = clampMinChars(cfg && cfg.minChars);
    if (set) return set;
    // 没填就照老规矩折算：perFic 是 token，中文一个字大约 1.5 个 token
    return Math.max(600, Math.round(clampPerFic(cfg && cfg.perFic) * 0.55));
  }
  // 数正文有多少字：空白一律不算（中文没有词间空格，空格多半是排版）
  function countChars(text) { return String(text || "").replace(/\s/g, "").length; }
  // 这一章短了多少。0＝没短。**只判断，不自动补**——补不补是她按键决定的
  //（她 2026-09-11：「以后任何东西都不接受一次发两遍」）。
  function shortBy(text, min) {
    const need = Math.round(Number(min) || 0);
    if (need <= 0) return 0;
    const got = countChars(text);
    // 留一成的余量：差十几个字就报「偷懒」是找茬
    return got >= Math.round(need * 0.9) ? 0 : need - got;
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

  // ============================================================
  // 作者库（她 2026-09-04 要的）—— 这个圈子里固定的那几位太太
  // ============================================================
  // ⚠️它【不跟着「清空本版」走】：文是会被清的，人不是。清掉一版的文之后
  //   那几位太太还在，她们写过的旧篇没了而已——这正是「固定 NPC」的意思。
  // ⚠️名册按【笔名】认人（施工规则/phone-data-layers.md 里那条）：
  //   同一个笔名再出现一次，还是同一个人，不许攒出两条。
  // ⚠️产出统计【不另存计数器】：从 fics 现算。存一份的话，文被清掉、被删、
  //   被改笔名，那个数就永远对不回来了（只进不出的老毛病）。
  const K_AUTHORS = "x_fanfic_authors";
  function loadAuthors() { const v = loadJSON(K_AUTHORS, []); return Array.isArray(v) ? v : []; }
  function saveAuthors(list) { return saveJSON(K_AUTHORS, (Array.isArray(list) ? list : []).slice(0, 60)); }
  function authorName(a) { return String((a && a.name) || "").trim(); }
  // 落一位作者进库：已经有这个笔名就把空着的那几栏补上，不覆盖她原来的简介
  function upsertAuthor(a) {
    const nm = authorName(a);
    if (!nm) return null;
    const list = loadAuthors();
    const i = list.findIndex(function (x) { return authorName(x) === nm; });
    if (i >= 0) {
      const cur = list[i];
      list[i] = Object.assign({}, cur, {
        bio: cur.bio || String(a.bio || "").trim().slice(0, 120),
        // 签名：她自己挂在个人页上的那一句（第一人称）。她 2026-09-11：
        // 「里面那一块应该是她自己的签名而不是第三人称描述」。短，四十字封顶。
        sign: cur.sign || String(a.sign || "").trim().slice(0, 40),
        style: cur.style || String(a.style || "").trim().slice(0, 120),
        sore: cur.sore || String(a.sore || "").trim().slice(0, 80),
        // 脾气：有人改她的文时她是哪一路。原来这一栏是【加笔开局时】临时问模型要的
        // （她 2026-09-05：「在生成作者的时候已经有了」）——请人进来那一枪就该定下，
        // 一个人的脾气不该每开一局就重新长一次。
        temper: cur.temper || String(a.temper || "").trim().slice(0, 120)
      });
    } else {
      list.unshift({
        id: uid("au"), name: nm.slice(0, 20),
        bio: String(a.bio || "").trim().slice(0, 120),
        sign: String(a.sign || "").trim().slice(0, 40),
        style: String(a.style || "").trim().slice(0, 120),
        sore: String(a.sore || "").trim().slice(0, 80),
        temper: String(a.temper || "").trim().slice(0, 120),
        createdAt: Date.now()
      });
    }
    saveAuthors(list);
    return list[i >= 0 ? i : 0];
  }
  // ── 请人进来时，这一句「路数」从哪儿说起（她 2026-09-11）──────────────
  //
  // 她拿着一屏八位太太问：「现在生成的都是一个风格的这对吗」。不对。
  // 而且不是模型偷懒，是我写的提示词逼出来的：原来那一条把四个格子【按顺序】
  // 列了出来（偏爱什么结构、什么长度、力气花在哪儿、又故意不写什么），
  // 模型就一格一格照填，八位太太长成同一个句子——
  // 「偏爱X体，力气全花在Y上，坚决不写Z，全靠W定胜负」。
  // ⚠️**写给模型看的鲁布里克，写着写着就成了模子。**
  // 改法照 bans-make-it-dumber：把格子撤掉（不是在后面加一句「别都一样」），
  // 改成**每位分到一个不同的落点**——掷的是从哪儿下笔，不是她是什么人。
  // ⚠️她 2026-09-11 第二次拿着一屏回来：「还是不行啊，而且全部都是太正经的了！
  //   还有这些 id 也太一样了」。上一版只掷了【从哪儿说起】，那只管住了内容的落点；
  //   笔名和口气这两样一格都没掷，于是全落回模型的先验中心：
  //   笔名清一色「两三个字的冷硬物件名」（折痕／退热贴／生铁秤／防潮纸），
  //   路数那一句清一色书评腔。**没掷的那一维，就是它偷偷长回一个样的那一维。**
  // ⚠️笔名单拎出来一条：她两次报的都是这一维（「这些 id 也太一样了」），
  //   所以这一轴【每位都要掷到】——skip 归零。天花板照旧留着：
  //   free 那一格还在（「你自己想一个，别用上面那种」），代码关的是「不许不想」，
  //   不是「只许从这十格里挑」。
  const PEN_AXIS = [
    { key: "pen", zh: "她这个笔名是什么样的", opts: [
      "一句自嘲的话，长一点也没关系",
      "一句催自己更新、或者干脆认自己是鸽子的话",
      "叠字、或者一个软乎乎的小名",
      "英文，或者英文加数字，短",
      "三四个字的中二短语",
      "拿一样吃的东西当名字",
      "像是随手敲出来的几个字，没什么意思",
      "带着她本命角色或本命 CP 的缩写、梗",
      "一个数字加一个字",
      "一个特别正经的书面词——她要的就是这个反差"
    ] }
  ];
  const AUTHOR_ANGLE_AXES = [
    { key: "tone", zh: "她那两句（简介、路数）用什么口气写", opts: [
      "像圈里人私下聊起她那样说",
      "像她自己在简介栏里写的自我介绍那样说",
      "像一条被点赞很多的读者评论那样说",
      "像有人把她挂出来吐槽那样说",
      "像一份一本正经的作者推荐那样说",
      "像她自己不好意思地承认那样说",
      "像一句看热闹的转述：「就是那个谁谁谁」",
      // ⚠️每条轴上的格子不许少于 8：请人一次最多请 8 位，格子比人少的时候
      //   「不放回」那道闸就顺不动了，两位又会分到同一个口气
      "像一句半开玩笑的吐槽——说的人自己也在追她的文"
    ] },
    // ⚠️分成两组不是为了多掷一轴，是因为这两栏各有各的活：
    //   bio 是【这个人】，style 是【她的文长什么样】。上一版只有一条「从哪儿说起」，
    //   里头混着「跟人吵过的那一架」这种人事，模型就把 style 也写成了八卦轶事——
    //   一屏看下来全是恩怨，没一条说得清她们的文是什么样。
    //   ⚠️请枪手那一页是**照 style 那一栏挑人的**：那一栏讲八卦，那一栏就白给了。
    // 签名也得掷：不掷的话四位的签名会一起长成「随缘更新，勿上升真人」那一句
    { key: "sign", zh: "她那句签名是什么样的（这是 sign 那一栏）", opts: [
      "一条立在那儿的规矩（雷点、别上升、别催更）",
      "拿自己开涮的一句",
      "一句她本命角色的台词，别人看不懂也无所谓",
      "一句跟写文完全不相干的废话",
      "一句告示：最近在写什么、什么时候更",
      "一句撂在那儿的气话",
      "一句挂了好几年没改过的老话",
      "一句只说了半截的话",
      "干脆就两三个字"
    ] },
    { key: "bfrom", zh: "她这个人从哪儿说起（这是 bio 那一栏）", opts: [
      "她原来写的是别的，后来怎么拐进这个圈子",
      "她跟人吵过的那一架",
      "她最出名的那一篇当时是怎么回事",
      "她更新的节奏、她的坑品",
      "她圈外那份正经营生",
      "她在圈里跟谁走得近、跟谁不对付",
      "她当初为什么开始写这一对",
      "她嘴上说的和实际做的对不上的那一处",
      "她在这圈子里的资历——老人还是新来的"
    ] },
    { key: "sfrom", zh: "她的文让人一眼认出来的是哪一点（这是 style 那一栏）", opts: [
      "她文里总会出现的那样具体东西",
      "她的句子长什么样——长句还是短句、断在哪儿",
      "她最舍得花篇幅的地方，和她一笔带过的地方",
      "她写对话还是写场面，另一样明显弱",
      "她一篇写多长、怎么开头、怎么收尾",
      "她不肯写、硬写就别扭的那种东西",
      "读者在她评论区最常说的那一句",
      "她的文被人截出来挂过的那一点",
      "她写两个人时最在意的那一样（谁说了算、谁先低头这种）"
    ] }
  ];
  // ── 简介和路数写多长 ──────────────────────────────────────────────
  // ⚠️她 2026-09-11 第三次：笔名和口气都散开了，可四条读下来还是一个形状——
  //   全是一整段密不透风的长复合句，塞满具体细节，都在讲一个小故事。
  //   **没掷的那一维照旧长回一个样**，这次是【长度和密度】。
  //   长度不能靠掷轴那套（掷丢了就没有），也不能只说一句「长短该不一样」——
  //   上一版就说了，它没听。得给每位一个**硬指标**，而且代码要保证
  //   一批里必得有两位是极短的：一屏里只要有两条是十来个字的，整屏立刻就不一样了。
  const SAY_LENS = [
    "很短——十来个字说完，别硬凑细节",
    "很短——十来个字说完，别硬凑细节",
    "短——二十来个字",
    "中等——三四十字",
    "长一点——五六十字，但不许写成一整句密不透风的长句，该断句就断"
  ];
  const SHORTEST = SAY_LENS[0];
  function lenPlan(cnt, nonce) {
    const out = [];
    for (let i = 0; i < cnt; i++) out.push(Axes.pick(SAY_LENS, nonce, i, "len"));
    // 代码定「发不发生」：三位以上必得有两位极短（两位以下时至少一位）
    const want = cnt >= 3 ? 2 : 1;
    const longer = function (x) { return SAY_LENS.lastIndexOf(x); };   // 越靠后越长
    while (out.filter(function (x) { return x === SHORTEST; }).length < want) {
      let j = -1;
      for (let i = 0; i < cnt; i++) if (out[i] !== SHORTEST && (j < 0 || longer(out[i]) > longer(out[j]))) j = i;
      if (j < 0) break;                                            // 全员已是最短，没得改了
      out[j] = SHORTEST;
    }
    // ⚠️反过来那一头也得拦：掷出来全是「很短」的时候（五位里约百分之一），
    //   一屏十来个字的短句照样是一屏一个样。闸要两头都关。
    if (cnt >= 3 && out.every(function (x) { return x === SHORTEST; })) {
      out[cnt - 1] = Axes.pick(SAY_LENS.filter(function (x) { return x !== SHORTEST; }), nonce, "notallshort");
    }
    return out;
  }
  // ⚠️种子里要带一个当次的随机数：她重按一次「请人」就该换一批落点，
  //   按人数掷成定数的话，第二批八位会跟第一批八位一个角度一个角度地对上。
  function authorAnglesBlock(n, nonce, unit) {
    const cnt = Math.max(1, Number(n) || 1);
    const lens = lenPlan(cnt, nonce);
    // ⚠️掷 + 一批之内不放回这一套已经搬去 js/axes.js 的 Axes.batch 了
    //   （one-public-mechanism：出一批文那边也要同一个形状，抽公共的，旧的也搬过去）。
    // ⚠️笔名那一组单开一组、skip 归零：她两次报的都是这一维，被掷丢一次
    //   那一位就又长回冷硬物件名。天花板照旧留着——free 那一格还在。
    const rolled = Axes.batch([
      { axes: PEN_AXIS, opts: { allFree: 0, skip: 0, free: 0.22 } },
      { axes: AUTHOR_ANGLE_AXES, opts: { allFree: 0.06, skip: 0.08, free: 0.16 } }
    ], cnt, [nonce]);
    const lines = rolled.map(function (g, i) {
      const pen = g[0], ang = g[1];
      const said = Axes.line(pen.rows.concat(ang.free ? [] : ang.rows));
      // 整组还回去时，笔名那一条照样在——还回去的是【剩下几样】
      return "· 第 " + (i + 1) + " " + (unit || "位") + "：" + said
        + (ang.free ? "；剩下几样你自己挑，别跟上下几位撞" : "")
        + "；**简介和路数写多长**＝" + lens[i];
    });
    return "\n【这几位各自照着自己这一条长，别照着同一条】\n" + lines.join("\n")
      + "\n⚠️这是【从哪儿下笔】，不是她们的设定本身——别把这几句话抄进任何一位的简介或路数里。\n";
  }
  function angleNonce() { return String(Date.now()) + ":" + Math.random(); }

  // 请一位太太离开名册（她 2026-09-05 要的）。
  // ⚠️只从【名册】里删人，她写过的文一篇不动——文和人本来就是两份东西
  //   （清空版块只清文、人留着，这条是它的另一半）。
  function removeAuthor(name) {
    const nm = String(name || "").trim();
    if (!nm) return false;
    const list = loadAuthors();
    const left = list.filter(function (x) { return authorName(x) !== nm; });
    if (left.length === list.length) return false;
    saveAuthors(left);
    return true;
  }
  // 一位太太的【嗓子】：她是谁、什么路数、最护着哪一点。
  // ⚠️出文（genBatch）和续写（genNextChapter）共用这一份——各写一份的话
  //   迟早只改一处（施工规则/four-surfaces-same-context.md 那条老病）。
  //   她 2026-09-06 问的就是这个：「生成文有作者是有参考她的文风和雷点的吧？续写也要」。
  function authorVoiceLines(by) {
    if (!by) return "";
    return (by.bio ? "· 她是谁：" + by.bio + "\n" : "")
      + (by.style ? "· 她的路数：" + by.style + "（要看得出是她写的——结构、长度、力气花在哪儿、故意不写什么，都照她来）\n" : "")
      + (by.sore ? "· 她最护着的那一点：" + by.sore + "（这一点她绝不会自己拆掉）\n" : "");
  }
  function findAuthor(name) {
    const nm = String(name || "").trim();
    if (!nm) return null;
    return loadAuthors().filter(function (x) { return authorName(x) === nm; })[0] || null;
  }
  // 她写过哪些（从 fics 现算）
  function authorFics(name, fics) {
    const nm = String(name || "").trim();
    return (Array.isArray(fics) ? fics : loadFics()).filter(function (f) { return f && String(f.author || "").trim() === nm; });
  }
  // 她这些文分别嗑的哪对 CP：[{key,label,n}]，多的在前
  function authorCPStats(name, fics, characters, userName) {
    const by = {};
    authorFics(name, fics).forEach(function (f) {
      const key = (f.cp || []).slice().sort().join("|") || "_none";
      if (!by[key]) by[key] = { key: key, cp: f.cp || [], n: 0 };
      by[key].n++;
    });
    return Object.keys(by).map(function (k) {
      const x = by[k];
      return { key: k, n: x.n, label: x.cp.length ? cpLabel(x.cp, characters, userName) : "没标 CP" };
    }).sort(function (a, b) { return b.n - a.n; });
  }
  function retiredId(id) { return RETIRED_TABS.some(function (t) { return t.id === id; }); }
  // 撤掉的那几版：只有底下还留着文章时才继续露出来（排在最后）
  function livingRetired() {
    const fics = loadFics();
    return RETIRED_TABS.filter(function (tb) {
      return fics.some(function (f) { return f && f.tabId === tb.id; });
    });
  }
  function loadTabs() {
    const stored = loadJSON(K_TABS, null);
    if (!stored || !Array.isArray(stored) || !stored.length) return SEED_TABS.concat(livingRetired());
    // 预设永远来自代码，只把用户自定义项留在存储；旧档里的整套种子读到后会就地瘦身。
    const seedIds = SEED_TABS.map(function (s) { return s.id; });
    const custom = stored.filter(function (t) { return seedIds.indexOf(t.id) < 0 && !retiredId(t.id); });
    if (custom.length !== stored.length) saveJSON(K_TABS, custom);
    return SEED_TABS.concat(custom).concat(livingRetired());
  }
  function saveTabs(list) {
    const seedIds = new Set(SEED_TABS.map(function (s) { return s.id; }));
    // 退役版块同样不许写回存储：它露不露面只由「底下还有没有文章」决定
    saveJSON(K_TABS, (Array.isArray(list) ? list : []).filter(function (t) { return t && !seedIds.has(t.id) && !retiredId(t.id); }));
  }
  function loadFics() { return loadJSON(K_FICS, []); }
  // 📚 累积层：满了挤掉最旧的（施工规则/phone-data-layers.md）。
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
  // 加笔正在用的那几篇也不许被清掉——一局加笔手里没有原文就是一局空壳
  // （只存下标不存原文，见 startSession 那段注释）。
  // ⚠️这一条写在【这儿】，不在加笔那边另立一条：留不留一篇文的规矩只此一处。
  // 一次清理要问一百多篇，每篇都去 loadRP 解一遍全 transcript 太贵，所以缓一份；
  // saveRP 是唯一的写入方，由它清缓存。
  let _rpFicIds = null;
  function rpFicIdSet() {
    if (_rpFicIds) return _rpFicIds;
    const set = new Set();
    loadRP().forEach(function (x) { if (x && x.ficId) set.add(String(x.ficId)); });
    _rpFicIds = set;
    return set;
  }
  function protectedFic(f) {
    if (!f) return false;
    if (f.onShelf === true || f.source === "user" || f.liked === true) return true;
    if (rpFicIdSet().has(String(f.id))) return true;
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
  // （施工规则/four-surfaces-same-context.md 里写死的那个数）。
  // 原来这里一个上限都没有：两个人设 4500+ 的角色配上一份长文风，
  // 光 system 就先去掉一两万字，正文反而被模型自己的输出上限挤短。
  const FIC_PERSONA_CAP = 6000;
  function personaOf(c) { return String((c && c.persona) || "").trim().slice(0, FIC_PERSONA_CAP); }
  function sideDesc(c) {
    const p = personaOf(c);
    if (c.isMe) return "「" + c.name + "」是读者本人（我）" + (p ? "，按这份面具人设来写：\n" + p : "，没有填写人设——可自由发挥其性格，别硬套设定");
    return "「" + c.name + "」严格贴合角色卡：\n" + (p || "（暂无设定，可据名字合理发挥）");
  }
  // 群像那一向（友情向／亲情向／修罗场／无 CP／她自己写的）从哪儿来，只认这一处：
  // 新生成时是这一次挑的（opts.groupWay），续写和加笔时是这篇文自己带着的（fic.groupWay）。
  // ⚠️三个调用点各读各的，就是「一层写在三处」——迟早有一处忘了带。
  function groupWayOf(fic, opts) {
    return String((opts && opts.groupWay) || (fic && fic.groupWay) || "").trim().slice(0, 120);
  }
  // ⚠️凡是【手上已经有这篇文】的那几枪（续写、写长一点、请原作者回来、加笔），
  //   都得把这篇文的群像向带上。写成这一行，新开第四枪时照抄就行——
  //   不然那一处又会是「一层写在四处、第四处没跟上」的那一处。
  function ficOpts(fic, opts) { return Object.assign({}, opts || {}, { groupWay: groupWayOf(fic, opts) }); }
  // ── 同人文到底是什么 ──────────────────────────────────────────────
  // 她 2026-09-11 亲口定的：**「同人文本来就是『他们俩换了个身份世界观继续相爱』。」**
  // 她同一轮还说：「他们身份也不应该被带入同人文吧」——
  // ⚠️所以上一版我顺手加的「把他俩在主线里的关系发过去」是反的，当场撤掉（不是留着不发）：
  //   带进去的是【这个人】，不是【他在别处的身份和关系】。
  //
  // 这一条同时是「皇帝一场都没出」那件事的另一半解法：
  // 原来一整份提示词里没有任何一句说过【这一篇里他们各自是谁】，
  // 于是模型只给料多的那一位安排了身份，另一位就飘着——飘着的那位最容易被顶掉。
  function worldIdentityLine(cpChars) {
    const who = (cpChars || []).filter(Boolean).map(function (c) { return "「" + c.name + "」"; });
    if (who.length < 2) return "";
    return "\n【这一篇里他们各自是谁】同人文写的是**这几个人换了一个身份、换了一个世界观，继续是他们自己**：\n"
      + "· 照卡来的是【这个人】——性格、说话的调子、在意什么、碰不得哪儿、跟人相处的方式。\n"
      + "· **不照卡来的是身份**：卡上写的职业、位分、所处的时代，在这一篇里不算数；"
      + "他们在这个世界里靠什么活着、彼此怎么认识的，由你按本版世界观现安排。\n"
      + "· ⚠️" + who.join("、") + "**每一位都要安排到**：不许只给其中一位安排好身份和处境，另一位顺手带过——"
      + "飘着的那一位下一步就会被别人顶掉。\n";
  }
  // 戏份是对半的。⚠️不说这一句，模型会按【谁的卡写得长谁是主角】来分篇幅：
  //   她那三篇里没出场的那位，卡上只有一句话（配角出身的角色卡天生短）。
  // ⚠️这儿一个字都不许提「谁是配角出身」——那正是她说的【不该带进同人文的身份】。
  // 她 2026-09-11：「而且 cp 主要就是爱情向的。」
  // ⚠️整份提示词里从来没有一句说过这件事：左右位那条管的是【亲密场面里谁主导】，
  //   不是【这一篇写的是不是他们俩的感情】。于是「两位各自守住设定」＋一个世界观，
  //   写出来完全可以是并肩办案、兄弟情深、或者一整篇世界观展示——
  //   她那三篇里，世界观（志怪：人与非人相遇）就是这么把故事吃掉的。
  // ⚠️给出口不给判决：拦的是「不写感情」，不是规定「必须甜」。
  function loveLine() {
    return "\n【这一篇写的是他们俩的感情】CP 文默认就是爱情向："
      + "这两个人之间是什么关系、走到哪一步、卡在哪儿——**那是这一篇的主线**。"
      + "外面发生的事（案子、灾变、朝局、山里的规矩）是台子，他们俩才是戏。\n"
      + "⚠️不是要你写甜文：冷、克制、拧巴、求而不得、已经完了还没断干净，都算爱情向。"
      + "写足他们此刻是什么状态，比让他们把爱说出口要紧。\n";
  }
  function evenSidesLine(cpChars) {
    if (!cpChars || cpChars.length < 2) return "";
    return "\n⚠️**戏份是对半的**：每一位都要出场、开口、有自己要办的事和自己的立场。"
      + "卡上写得长的那一位不许因此多占篇幅，写得短的那一位也不是背景板——"
      + "卡的长短是卡的事，不是戏份的事。\n";
  }
  function cpBlock(cpChars, opts) {
    opts = opts || {};
    if (!cpChars || !cpChars.length)
      return "【CP】未指定具体 CP——写原创向/群像向短篇，主角自拟，别硬凑现有角色。";
    // 左右位铁律（v47.78 她点名修）：CP 的书写顺序=左右位，严格左攻右受，
    // 绝不许按「谁人设强势谁当攻」自行对调——人设强势的右位就是「强势受」，反差才是萌点。
    // ⚠️v66.79 把「同性 CP 才算攻受、异性 CP 顺序只代表叙事重心」那个分叉**删掉了**
    //   （她 2026-09-11：「这个不仅仅是同性 cp，异性 cp 女左男右那也不是男上位而是 4 爱女的上」）。
    //   那一行等于把她的选择悄悄丢掉：她点「女 × 男」是要女方主导，模型收到的却是
    //   「顺序只是先后」，于是照先验写成男主导。所以**性别跟「更强势／更年长／更壮」
    //   是同一类借口**，得并排写进那张不许调换的清单里。
    // ⚠️加笔（旧名穿书）走的是同一个 cpBlock，所以这一处改完，那边一起好。
    const posRule = function (l, r) {
      return "\n【左右位铁律（最高优先，凌驾于人设气场与性别之上）】这个 CP 的顺序就是左右位：「" + l + "」是左位，「" + r + "」是右位。写亲密关系时严格执行【左攻右受】：主导/进攻的一方永远是「" + l + "」，承受/被动的一方永远是「" + r + "」——**绝对禁止因为谁人设更强势、更年长、更冷、更有钱、体格更壮，或者因为谁是男的，就自行把位置调换**。人设强势的右位就写成气场强但在这段关系里是受的那一方；性格软的左位就写成温柔但主动的攻。**异性 CP 一样按这条走**：女左男右就是女方主导，不是「男的照例在上」；该怎么做、用什么姿势，由这个顺序决定，别拿常见写法把它翻回去。";
    };
    // ── 群像（她 2026-09-11：「除了 cp 还可以写群像，有好几个人同时写进来，
    //    然后可以选是友情向亲情向，修罗场，无 cp」）────────────────────
    // ⚠️**群像一个字的左右位都不发**：一群人里没有左右位这回事，发了就等于替她
    //   在里头指定了一对——她选「无 CP」的时候尤其荒唐。
    // ⚠️三个人以上，模型的默认写法是【点名册】：一人一段轮流发言、每人都得有戏。
    //   所以得明说不是每个人都要出场——这一条不写，群像就写成了通讯录。
    if (cpChars.length >= 3) {
      const way = String((opts.groupWay || "")).trim();
      return "【群像：" + cpChars.map(function (c) { return c.name; }).join("、") + "】"
        + "这一篇同时写这几个人，**不是一对 CP**。\n"
        + cpChars.map(function (c) { return "· " + sideDesc(c); }).join("\n")
        + "\n\n【这几个人之间是什么关系】" + (way || "她没说——你自己定一种，定下来就别中途换。")
        + "\n⚠️几个人之间怎么回事，以上面这一行为准：**别自作主张在里头挑两个配成一对**。"
        + "\n⚠️**不是每个人都要出场**：谁是这一篇的重心由你定，有人只出现一次、有人从头到尾没露面都行。"
        + "别写成点名册——一人一段轮流发言、每个人都分到一场戏，那是通讯录不是故事。"
        + "\n⚠️人多了最容易丢的是【谁是谁】：几个人说话的调子、在意的事、动手的方式都得分得开，"
        + "不许几个人共用一种语气。"
        + worldIdentityLine(cpChars) + evenSidesLine(cpChars);   // ⚠️群像不发爱情向：它有自己那一向
    }
    if (cpChars.length === 1) {
      const c = cpChars[0];
      return "【CP：" + c.name + " × 原创对象】\n主角一方：" + sideDesc(c) + "\n另一方是一个由你设定的原创角色（自由发挥，贴合本世界观基调）。"
        + worldIdentityLine(cpChars) + evenSidesLine(cpChars) + loveLine() + posRule(c.name, "原创对象");
    }
    const a = cpChars[0], b = cpChars[1];
    const bothChars = !a.isMe && !b.isMe; // 两个都是角色（没有「我」）
    // 带上我：写成 A × 我 × B 三人同框
    if (bothChars && opts.includeMe) {
      const meName = opts.meName || "我";
      return "【CP：" + a.name + " × " + meName + "（读者本人/我） × " + b.name + "】\n这是三人同框：把『我』作为真正的第三方写进去，三个人彼此之间都有关系张力，别把『我』写成旁观者或工具人。\n· " + sideDesc(a) + "\n· 「" + meName + "」是读者本人（我）" + (opts.mePersona && opts.mePersona.trim() ? "，按这份面具人设来写：\n" + opts.mePersona.trim() : "，没填人设就自由发挥其性格") + "\n· " + sideDesc(b) + worldIdentityLine(cpChars) + evenSidesLine(cpChars) + loveLine() + posRule(a.name, b.name);
    }
    // 只他俩 CP：即便角色卡写了「我男朋友」，也不把「我」带进文里
    const soloTail = bothChars ? "\n【只写这两人】这是 " + a.name + " × " + b.name + " 的双人同人文，读者/『我』不出场、不作为角色写进去；就算某人的设定里写了 TA 是「我的男朋友/恋人」，本篇也只聚焦他们两人彼此，别把「我」拉进来凑三人。" : "";
    // ⚠️她 2026-09-11 撞到的那一篇：点的是「皇帝 × 王爷」，写出来是「王爷 × 一个精怪」，
    //   皇帝从头到尾没露面。上面那几条管的是【别把读者拉进来】和【别对调左右位】，
    //   谁都没管【临时造一个人把其中一位顶掉】——那是另一族，得单说。
    //   ⚠️给出口不给判决：配角照样可以有，拦的只是「顶掉主角」这一件事。
    const bothPresent = "\n【这两位都得真的在场】「" + a.name + "」和「" + b.name + "」是这一篇的两位主角，"
      + "两个人都要真的出场、有戏、有话说——不许把其中一位写成只被人提起的一个名字，"
      + "更**不许临时造一个人（原创角色、路人、非人之物都算）顶掉其中任何一位的位置**。"
      + "这一篇里要添别的角色当然可以，但那位是配角，不是拿来替换他俩中的谁。";
    return "【CP：" + a.name + " × " + b.name + "】\n两位主角各自守住各自设定、别互相同化。\n· " + sideDesc(a) + "\n· " + sideDesc(b)
      + worldIdentityLine(cpChars) + evenSidesLine(cpChars) + loveLine() + soloTail + bothPresent + posRule(a.name, b.name);
  }

  // 素材来源：把 CP 角色的私聊记录抽尾巴当写作素材（item 6：生成素材来源人设聊天）
  // 素材来源：只摘【角色自己说过的那几句】当声纹样本。
  // ⚠️她 2026-09-11 撞上的那次：明明写的是「皇帝 × 王爷」，出来的却是**她和王爷的私聊
  //   被整段搬进了文里**——她本人被换成一个男精怪跟他做爱，台词还是她真说过的原话，
  //   皇帝一场都没出。三样病根，一样一样堵：
  //   ① 原来把【她说的话】也发了，而且标成「对方」——一个没名字的对话方，
  //      模型顺手就给它安一个人。于是她的原话从别人嘴里说了出来。
  //      **她的话一句都不发**：要对的是他的调子，她的话对这件事没有用。
  //   ② 原来只写了「化用进文里，别照抄」——规则只降概率。改成钉死用途：
  //      只对语气，不许进正文，也不许把那段聊天本身当成这一篇的情节。
  //   ③ 只有一位有聊天记录时，整篇会偏到他身上——皇帝没出场就是这么来的。
  //      所以明说：谁有样本，跟谁是主角没有关系。
  function chatMaterialFor(cpChars) {
    if (!cpChars || !cpChars.length) return "";
    const blocks = [];
    cpChars.forEach(function (c) {
      if (!c || c.isMe || !c.id) return;                  // 她自己不需要「声纹样本」
      const log = loadJSON("x_chat:" + c.id, []);
      const tail = (log || []).filter(function (m) {
        return m && m.role === "assistant" && m.content && !isOocMsg(m);
      }).slice(-10);
      if (!tail.length) return;
      blocks.push("· 「" + c.name + "」平时说话是这个调子：\n"
        + tail.map(function (m) { return "「" + String(m.content).replace(/\s+/g, " ").slice(0, 60) + "」"; }).join("\n"));
    });
    if (!blocks.length) return "";
    return "【声纹样本（只对语气，不是素材，也不是剧情）】\n" + blocks.join("\n\n")
      + "\n⚠️这几句是从【另一个时空的真实聊天】里摘出来的，只用来听清他说话的调子："
      + "句子多长、爱用什么词、话停在哪儿。\n"
      + "⚠️**一句都不许出现在正文里**，也不许把那段聊天本身写成这一篇的情节——这一篇的事情是新发生的。\n"
      + "⚠️谁有这几句、谁没有，跟谁是主角**没有关系**：没摘到句子的那一位不许因此变成配角，更不许一场都不出。\n";
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
      // ⚠️这一章的笔在她自己人手上时，这一段得换个口气：它是【本子的默认调子】，不是他的笔。
      //   而且**不发 STYLE_DEEP_IMITATION**——那一份是「深度模仿另一个人的笔」，
      //   正是它把「换了个人写」这件事抹得一干二净（她 2026-09-11：「看不出来是他的作品」）。
      const byC = !!(opts.byChar && opts.byChar.id);
      parts.push("【预设文风（" + (byC
        ? "这个本子的默认调子——但这一章的笔不在圈子里的太太手上，冲突时以执笔的那个人为准"
        : "作者本次的写作风格要求，优先满足") + "）】\n" + adaptedStyle
        + ((byC || isJinyudengStyle(opts.style)) ? "" : "\n\n" + STYLE_DEEP_IMITATION));
    }
    if (worldbook && worldbook.trim()) {
      if (typeof WORLDBOOK_RULE !== "undefined") parts.push(WORLDBOOK_RULE);
      parts.push("【全局世界书（严格遵循：其中的设定/文风/禁忌一律照做，尤其是反套话/反八股类条目要压过模型的默认写法；仅当与本版世界观正面冲突时才以本版为准）】\n" + worldbook.trim());
    }
    parts.push(cpBlock(cpChars, opts));
    if (opts.chatMaterial && opts.chatMaterial.trim()) parts.push(opts.chatMaterial.trim());
    return parts.join("\n\n");
  }

  // ============================================================
  // 别替她拉郎配（她 2026-09-05：「介绍里面不要生成奇奇怪怪的 cp」）
  // ============================================================
  // 病根：给模型一串【圈子里的人】的名字，它就会自己挑两个配成一对写进作者简介。
  // 那对她从来没配过——等于替她拉郎配。
  // 判据一句话：**配对只能来自她自己配好的那几对；一对都没有，就一个字都别提配对。**
  // 她配好的那几对：K_CPS 里存的是 [charId|"me", charId|"me"]
  function allowedCPLabels(characters, userName) {
    const list = loadCPs();
    if (!Array.isArray(list) || !list.length) return [];
    const out = [];
    list.forEach(function (cp) {
      const pair = Array.isArray(cp) ? cp : (cp && cp.cp);
      // ⚠️只收【两个人】的：群像预设进了这张白名单，就等于告诉模型
      //   「A、B、C 群像」是她配过的一对，它照样会去凑对
      if (!Array.isArray(pair) || !pair.length || pair.length >= 3) return;
      const lb = cpLabel(pair, characters || [], userName);
      if (lb && out.indexOf(lb) < 0) out.push(lb);
    });
    return out;
  }
  function cpRuleBlock(okCPs) {
    return okCPs.length
      ? "【配对】只许提这几对里的：" + okCPs.join("、") + "。**不许自己把圈子里的人凑成新的一对**——"
        + "她没配过的组合一个字都不许出现。也可以完全不提配对，只说她写东西的路数。\n"
      : "【配对】这个圈子还没定过任何 CP。**一个配对都不许写**——不许把名单里的两个人凑成一对，"
        + "不许出现「A×B」这种写法。只说她写东西的路数、她护着什么。\n";
  }
  // 代码这一道：把不该出现的配对【整句】删掉（规则只降概率）
  // ⚠️删的是【那一整句】，不是把名字抠掉——抠掉名字会留下「是圈子里 这一对的固定供粮大户」这种断句。
  const CP_SEP = "[×✕xX✖＊*·・/／&＆➕+]";
  function stripStrayCP(a, characters, userName) {
    const ok = allowedCPLabels(characters, userName).map(function (s2) { return s2.replace(/\s/g, ""); });
    const names = (characters || []).map(function (c) { return c && c.name; }).filter(Boolean)
      .concat([userName || "我"]).filter(function (n) { return n && n.length >= 1; });
    if (!names.length) return a;
    const esc = function (x) { return String(x).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); };
    const re = new RegExp("(" + names.map(esc).join("|") + ")\\s*" + CP_SEP + "\\s*(" + names.map(esc).join("|") + ")", "g");
    const clean = function (txt) {
      const src = String(txt || "");
      if (!src) return src;
      // 按中文句读切开，逐句看：句里有不许出现的配对就整句丢掉
      const parts = src.split(/(?<=[。！？；，、])/);
      const kept = parts.filter(function (seg) {
        re.lastIndex = 0;
        let m, bad = false;
        while ((m = re.exec(seg))) {
          const pair = m[1] + "×" + m[2], flip = m[2] + "×" + m[1];
          if (ok.indexOf(pair) < 0 && ok.indexOf(flip) < 0) { bad = true; break; }
        }
        return !bad;
      });
      // ⚠️删完要收尾：不然会留下「……白天赶早八晚上产粮，」这种吊着一个逗号的断句
      let out = kept.join("").replace(/^[，、。；\s]+/, "").replace(/[，、；\s]+$/, "").trim();
      if (out && !/[。！？…」』）)]$/.test(out)) out += "。";
      return out;
    };
    return Object.assign({}, a, { bio: clean(a.bio), sign: clean(a.sign), style: clean(a.style), sore: clean(a.sore), temper: clean(a.temper) });
  }

  // ---- 请一批新作者进来（一枪，落库）--------------------------------
  // ⚠️只写【判据】不给例子：给了例子，四位太太会长成同一个句式
  //   （施工规则/prompt-no-content-samples.md）。
  async function genAuthors(active, n, tabs, cpChars, userName, have, want) {
    const cnt = Math.max(1, Math.min(8, n || 4));
    const has = (have || []).map(function (a) { return authorName(a); }).filter(Boolean);
    // ⚠️她 2026-09-05：「介绍里面不要生成奇奇怪怪的 cp」。原来只给了【圈子里的人】这一串名字，
    //   模型就自己把里头两个人配成一对写进简介（「圈子里 A×B 这一对的固定供粮大户」）——
    //   那是她没配过的 CP，等于替她拉郎配。现在只许提【她自己配好的那几对】，一对都没有就一个字都别提。
    const okCPs = allowedCPLabels(cpChars, userName);
    const sys = FANFIC_ANTI_CLICHE + "\n\n你在给一个同人圈【添几位常驻太太】。她们往后会一直在这个圈子里写文。\n"
      + "【这个圈子在写什么】" + (tabs || []).map(function (x) { return x.name; }).filter(Boolean).slice(0, 12).join("、") + "\n"
      + (cpChars && cpChars.length ? "【圈子里的人】" + cpChars.map(function (c) { return c && c.name; }).filter(Boolean).join("、") + "\n" : "")
      + (has.length ? "【已经在的（笔名别撞、路数也别撞）】" + has.join("、") + "\n" : "")
      + "【怎么写】每位都要是【一个具体的人】，不是一个类型：\n"
      + "· name：同人圈的笔名／马甲，别用真名别带 @。"
      + "⚠️几位的笔名不许是同一路货色——一批全是「两三个字的冷硬物件名」那种，"
      + "一看就是一个人取的，不是几个人自己取的；\n"
      + "· sign：**她自己挂在个人页上的那一句签名**。⚠️第一人称，是【她写的】，"
      + "不是介绍她的话——「这位作者擅长…」那种一个字都不许有。很短，一句。"
      + "可以是一条规矩、一句自嘲、一句她本命的台词、一句不相干的废话，也可以是句正经告示；\n"
      + "· bio：她是谁——要认得出是这一个具体的人，不是一个类型；\n"
      + "· style：她写东西的路数——**别人一眼认出她的文**靠的是什么。别写「文笔细腻」这种谁都成立的话；\n"
      + "  ⚠️bio 讲【这个人】，style 讲【她的文长什么样】，两栏别串味："
      + "她挑枪手的时候是照 style 那一栏挑人的——那一栏要是也在讲恩怨八卦，那一栏就白给了。\n"
      + "· sore：她最护着的那一点——被人动到这儿她反应最大。\n"
      + "· temper：【有人改她的文时她是哪一路】——一句话说清她的反应路数：是死死往回拽、是嘴上骂着手上还给你圆、"
      + "是觉得有意思跟着你把故事推得更离谱、还是先冷着看你能走多远。这一栏要从上面三行长出来，不是随便挑一种。\n"
      + "几位之间要真的不一样：脾气、路数、写文的动机、对 CP 的看法，至少三样彼此拉开。\n"
      // ⚠️「不一样」四个字管不住句式：上一版就是每位的【内容】都不同，可每句话的
      //   骨架一模一样。得把那个骨架指出来，再给一条出路（底下那几个落点）。
      // ⚠️「长短也该不一样」这句上一版就写了，它没听：四位全是一整段密不透风的长句。
      //   所以底下按位给了硬指标，这儿只负责说清那是硬的、以及短的那几位不许凑长。
      + "⚠️底下给每位写了【简介和路数写多长】，那是硬的：轮到「很短」的那几位就真只写十来个字，"
      + "别硬塞细节凑长度。一屏全是长句子，读起来就还是一个人写的。\n"
      + "⚠️这是同人圈，不是文学期刊：笔名可以俗、可以好笑、可以中二、可以自嘲，"
      + "简介和路数也不必句句都是正经的书评腔。一批人里有一两位正经的没问题，全是正经的就不对了。\n"
      + "⚠️几位的 style 也不许长成同一个句式：如果这一批写下来每句都是"
      + "「偏爱某种体裁＋力气全花在某处＋坚决不写某处＋全靠某物定胜负」，那是一个模子印的，不是几个人。"
      + "长短也该不一样——有人一句话就说完了，有人得绕一下。\n"
      + authorAnglesBlock(cnt, angleNonce(), "位")
      // 她 2026-09-11：「请作者的时候能不能给一个写想要什么类型或者文风还有磕啥 cp 的」。
      // ⚠️这是【挑人的方向】，不是【她们的设定】：不说清的话它会把这段话原样抄进 bio 里，
      //   四个人的简介长得一模一样（跟「提示词里不许塞内容示范」是同一个坑）。
      + (String(want || "").trim()
        ? "\n【她想请什么样的人】" + String(want).trim().slice(0, 300)
          + "\n⚠️这是**挑人的方向**，不是她们的设定：照着这个方向找人，但**别把这段话抄进任何一位的简介或路数里**。"
          + "几位都合这个方向，但各自合的地方不一样——别四个人长成同一个。\n"
        : "")
      + cpRuleBlock(okCPs)
      + "【输出】只输出合法 JSON 数组，恰好 " + cnt + " 个元素，无 markdown：\n"
      + "[{\"name\":\"\",\"sign\":\"\",\"bio\":\"\",\"style\":\"\",\"sore\":\"\",\"temper\":\"\"}]";
    const raw = await callAI(active, sys, [{ role: "user", content: "请 " + cnt + " 位。" }], { maxTokens: 12000, timeout: 180000 });
    const d = parseJSONLoose(raw);
    const arr = Array.isArray(d) ? d : (d && Array.isArray(d.items) ? d.items : []);
    const out = [];
    // 规则只降概率，代码这一道才保证：落库前把不该出现的配对整句删掉
    arr.forEach(function (x) { if (x && x.name) { const a = upsertAuthor(stripStrayCP(x, cpChars, userName)); if (a) out.push(a); } });
    if (!out.length) throw new Error("没请到人——再试一次或换个模型");
    return out;
  }

  // ── 这几篇各自从哪儿长 ──────────────────────────────────────────────
  // 她 2026-09-11：「那个志怪板块怎么感觉写来写去都是一个套路，
  //   都会有一篇是右位捡了一个小鬼或者精怪。」
  // ⚠️原来这儿只有一句鲁布里克：「同一批里开场位置、核心推进方式、时间跨度、
  //   叙述距离和收尾形状至少有三项彼此不同」。两个毛病：
  //   ① 跟作者那条一模一样——说了五个维度，没说谁占哪一格，模型自己挑最顺手的几格；
  //   ② **它一个字都管不到上一批**。「写来写去」说的正是这个：每一批各自内部是错开的，
  //      可每一批都从同一个先验中心出发，于是每批都有那一篇「捡了个精怪」。
  // 所以两件事一起做：一批之内【按篇掷】（掷约束不掷答案），
  //   跨批靠【这一版已经写过什么】那张单子拦住（bans-make-it-dumber 的后半条：
  //   把出现过的记下来当 avoid 单子，长期记——这儿连记都不用，文本来就存着）。
  // ⚠️轴上一格都不许写成剧情（「捡到一只精怪」那种）：写成剧情就是拿代码顶替想象力，
  //   天花板变成我们的。这几条管的全是【怎么写】。
  const FIC_AXES = [
    { key: "open", zh: "这一篇从哪儿起", opts: [
      "从一件已经结束的事的收尾起",
      "从一次交接起：东西、人或话从一方到了另一方",
      "从一个被打断的日常起",
      "从两个人都在等的那段空当起",
      "从一句已经出口、收不回来的话起",
      "先有那个地方，人后到",
      "从第三个人的眼睛里起",
      "从事情过去很久之后起，往回看"
    ] },
    { key: "engine", zh: "推着这一篇往前走的是什么", opts: [
      "一样东西要还回去",
      "一件瞒着的事快瞒不住了",
      "一个说好的期限",
      "一笔要清的账",
      "一个人想走，另一个不肯开口留",
      "一个错认：有人把谁当成了别人",
      "一件反复出现的小事，这一次不一样了",
      "外面的人要来了"
    ] },
    { key: "span", zh: "时间跨度", opts: [
      "一夜之间", "一整天", "三五天", "一个季节",
      "隔了好几年，跳着写", "就一场谈话的工夫", "两次见面之间空着很久", "同一天，来回写两遍"
    ] },
    { key: "dist", zh: "叙述离人有多近", opts: [
      "贴着其中一个人写，另一个只从外面看得见",
      "两个人轮着看，但不许对半分",
      "离得远，像有人在转述这桩事",
      "只写看得见的：动作、东西、天气——心里话一句不写",
      "贴得很近，近到只剩感觉和手边这几样东西",
      "从一个不相干的人那儿看过去",
      "跟着一样东西走，人来了又走",
      "贴着其中一个人，可那个人自己也没弄明白"
    ] },
    { key: "close", zh: "收在哪儿", opts: [
      "收在一个没做完的动作上",
      "收在一句没人接的话上",
      "收在一样东西的去向上",
      "收在旁人的一句转述上",
      "收在时间忽然往前跳了一下",
      "收在两个人各自走开",
      "收在一件小事被重新做了一遍",
      "收在一个没人回答的问题上"
    ] }
  ];
  function ficAxesBlock(n, nonce) {
    const rolled = Axes.batch([{ axes: FIC_AXES }], Math.max(1, Number(n) || 1), [nonce]);
    const lines = rolled.map(function (g, i) {
      const o = g[0];
      return "· 第 " + (i + 1) + " 篇：" + ((o.free || !o.rows.length)
        ? "这一篇你自己找一个跟上下几篇都不一样的角度。" : Axes.line(o.rows));
    });
    return "\n\n【这几篇各自照着自己这一条长，别照着同一条】\n" + lines.join("\n")
      + "\n⚠️这是【怎么写】，不是【写什么】：别把这几句话当梗写进正文，也别在文里点破。\n";
  }
  // 这一版已经写过什么。⚠️只报【标题 + 那一句核心设定】——正文一个字都不进去，
  //   那是给读者的，不是给下一批当材料的。
  const AVOID_KEEP = 14;
  function ficAvoidBlock(tab, fics) {
    const id = tab && tab.id;
    const mine = (Array.isArray(fics) ? fics : loadFics())
      .filter(function (f) { return f && f.tabId === id; })
      .sort(function (a, b) { return (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0); })
      .slice(0, AVOID_KEEP);
    if (!mine.length) return "";
    return "\n\n【这一版已经写过这些】\n"
      + mine.map(function (f) {
          const p = String(f.premise || "").replace(/\s+/g, "").slice(0, 46);
          return "· 《" + String(f.title || "无题").slice(0, 20) + "》" + (p ? "：" + p : "");
        }).join("\n")
      + "\n⚠️上面这些里出现过的【开局、两个人凑到一起的理由、身份组合、收尾的收法】，这一批一个都不许重来。"
      + "落笔前对一遍：要是你正要写的那一篇，跟上面某一篇是同一件事换了层皮，就换掉——"
      + "**换的是那件事本身，不是换个名字、换个天气、换个朝代。**\n";
  }

  // ---- 批量生成 N 篇（容错 + 重试）------------------------------------
  // opts: { style, perFic, worldPool, chatMaterial }
  async function genBatch(active, tab, cpChars, n, userName, worldbook, opts) {
    opts = opts || {};
    const perFic = clampPerFic(opts.perFic);
    // ⚠️字数地板只此一份（minCharsFor）：首发和续写各算一遍的话，
    //   她在设置里填的那个数迟早只对其中一处生效（施工规则/one-public-mechanism.md）。
    const minWords = minCharsFor({ perFic: opts.perFic, minChars: opts.minChars });
    const cotChar = (cpChars && cpChars[0] && cpChars[0].name) || "主角";
    const cotT = (typeof cotThink === "function") ? cotThink({ char: cotChar, user: userName }, "fanfic") : "";
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
    // 谁来写这一批（她 2026-09-04：「生成同人文的时候也可以选择让某一位来写」）。
    // 指定了就把她整个人递进去、笔名钉死；没指定就顺带让它交一份作者简介回来，
    // 落进作者库——⚠️不额外调一次模型，她按次计费。
    const by = opts.author && authorName(opts.author) ? opts.author : null;
    const byBlock = by
      ? "\n\n【这一批由谁写】笔名「" + authorName(by) + "」。\n"
        + authorVoiceLines(by)
        + "每一篇的 author 都填「" + authorName(by) + "」，不许换别的笔名，也不要再交 authorSign／authorBio／authorStyle。"
      : "";
    // ⚠️这一份简介和 genAuthors 那一份是同一层东西，所以那条「不许拉郎配」也得给它
    //   （她 2026-09-05 报的那句「是圈子里 A×B 这一对的固定供粮大户」就是从这儿出来的）。
    const authorFields = by ? "" : ",\"authorSign\":\"她自己挂在个人页上的那一句签名，第一人称，很短，不是介绍她的话\",\"authorBio\":\"这个笔名背后是个什么人，一句，要认得出是这一个人\",\"authorStyle\":\"她写东西的路数，一句：别人一眼认出她的文靠的是什么\",\"authorTemper\":\"有人改她的文时她是哪一路，一句：往回拽／嘴硬着给你圆／跟着你推得更远／先冷着看\"";
    // ⚠️这一枪一次出 n 篇、每篇一位新太太，和 genAuthors 是同一层东西——
    //   那边撤掉的模子，这边不撤的话，八位太太换个入口照样一个模子印出来。
    const authorCPRule = by ? "" : "\n\n" + cpRuleBlock(allowedCPLabels(cpChars, userName)) + "（这条管的是 authorSign／authorBio／authorStyle／authorTemper 那几栏。）"
      + "\n⚠️这几位的 authorStyle 不许长成同一个句式（「偏爱某种体裁＋力气全花在某处＋坚决不写某处＋全靠某物定胜负」那种模子），长短也该不一样。"
      + "\n⚠️这是同人圈，不是文学期刊：笔名可以俗、可以好笑、可以中二、可以自嘲，别几个笔名都是同一路货色（比如全是两三个字的冷硬物件名）；authorBio／authorStyle 也不必句句都是正经的书评腔。"
      + "\n⚠️authorBio 讲【这个人】，authorStyle 讲【她的文长什么样】，两栏别串味——挑枪手是照 authorStyle 那一栏挑人的。"
      + "⚠️底下给每位写了【简介和路数写多长】，那是硬的：轮到「很短」的那几位就真只写十来个字，别硬塞细节凑长度。"
      + authorAnglesBlock(n, angleNonce(), "篇的那位");
    const sys = buildGenSystem(tab, cpChars, userName, worldbook, opts) + briefBlock
      + ficAvoidBlock(tab, loadFics()) + ficAxesBlock(n, angleNonce()) + byBlock + authorCPRule + "\n\n" +
      (typeof cotSystemBlock === "function" ? cotSystemBlock(cotT) : "") + batchDraftRule +
      "【输出】只输出一个合法 JSON 数组，无 markdown 无多余文字。数组恰好 " + n + " 个元素（务必凑满 " + n + " 篇）：\n" +
      "[{\"title\":\"标题\",\"author\":\"作者笔名（同人圈作者马甲/太太笔名，别用真名别带@）\",\"tags\":[\"标签\",\"标签\"],\"premise\":\"本篇核心设定一句话：他俩是什么关系（谁欠谁、见面为什么别扭、这段关系卡在哪儿）+各自的身份+这个世界观里最要紧的那条规矩——这是全篇不许变的地基\",\"body\":\"正文（成篇散文，务必写足、有剧情，约 " + minWords + " 字以上，分段用\\n\\n）\",\"endHook\":\"结尾锚点：一句话描述这篇结束在什么处境/悬念，供日后续写接续\"" + authorFields + "}]\n" +
      "每篇 title 别重复、别都一个套路；禁止只是换背景与人名却复用同一情节拍（开局位置、时间跨度、叙述距离、收尾形状那几样，上面已经按篇分好了，照各自那一条来）。" + (by ? "author 每篇都是同一位（见上）；" : "author 每篇各不同；") + "tags 2-4 个：站在读者角度，这几个标签要能让人一眼判断【要不要点进去】——结局走向、雷点预警、题材形状各占一个方向，别几篇共用同一套万能标签。别为了凑数量把正文压短——宁可写满。" +
      (opts.style && opts.style.trim() ? fanficStyleTail(opts.style) : FANFIC_ANTI_CLICHE_TAIL);
    const user = "写 " + n + " 篇" + (tab.mixed ? "（世界观每篇随机挑）" : "【" + tab.name + "】世界观下") + "的同人文。别都同一个梗、同一种基调，冷暖虐甜各来一点，每篇都要写出剧情别烂尾。";
    let batchCot = null;
    async function once(extra) {
      const raw = await callAI(active, sys + (extra || ""), [{ role: "user", content: user }], { maxTokens: Math.min(FIC_TOKEN_MAX * 4, 6000 + n * perFic), timeout: 300000 }); // 长文风+长正文允许 5 分钟；思考型模型的思考也从这里扣
      const sp = (typeof splitCot === "function") ? splitCot(raw, !!cotT) : { cot: null, clean: raw };
      if (sp.cot) batchCot = sp.cot; // 整批一次思考，挂到第一篇
      const d = parseJSONLoose(sp.clean);
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
      // 每一篇的作者都落进作者库：指定了谁就还是谁，没指定就把它顺带交的那份简介收下。
      // 「没写简介」也照样落一条：先有这个人，简介以后再补（空值不许抹掉旧值）。
      const nm = by ? authorName(by) : String(x.author || "佚名").slice(0, 20);
      // 落库前过一道同样的兜底：模型还是会自己配对，规则只降概率
      upsertAuthor(stripStrayCP({ name: nm, bio: by ? by.bio : x.authorBio, sign: by ? by.sign : x.authorSign, style: by ? by.style : x.authorStyle, sore: by ? by.sore : "", temper: by ? by.temper : x.authorTemper }, cpChars, userName));
      return {
        title: String(x.title || "无题").slice(0, 60),
        author: nm,
        tags: Array.isArray(x.tags) ? x.tags.filter(Boolean).slice(0, 6).map(String) : [],
        premise: String(x.premise || "").trim().slice(0, 200),  // 核心设定锚（续写防改设）
        body: String(x.body || "").trim(),
        endHook: String(x.endHook || "").trim(),
        authorBio: String(x.authorBio || "").trim().slice(0, 120),
        authorStyle: String(x.authorStyle || "").trim().slice(0, 120),
        cot: draftFor(i),
        cotRequested: !!cotT
      };
    });
  }

  // ── 记进房间 / 拿给他看（她 2026-09-11）──────────────────────────────
  //
  // ⚠️**自动回流撤掉了。** 原来写完一章就往主线记忆库记一条，她当场拦下来：
  //   「有时候我也只是想测试一下，但是不想让他们记得」。
  //   「不记」事后能补，「记了」得手动去删——**默认值不该选不可逆的那一边**。
  // ⚠️落进去的是【一张卡】，不是整章正文：一章几千字塞进房间聊天，上下文当场吃光。
  //   他要读全文有同人文那一页，房里躺的是「这件事发生过」。
  // ⚠️一分钱不花：喂给他＝把东西放进上下文，上下文是本地拼的；只有让他开口才打枪。
  const FILE_CARD_HEAD = 200;
  function chapterCard(fic, chapIdx, charName, mine, userName) {
    const chs = (fic && fic.chapters) || [];
    const ch = chs[Math.max(0, Math.min(chs.length - 1, Number(chapIdx) || 0))] || {};
    const no = (Number(chapIdx) || 0) + 1;
    const head = String(ch.content || "").trim().replace(/\s+/g, " ").slice(0, FILE_CARD_HEAD);
    const who = mine ? "你写的" : (ch.byAuthor ? "「" + ch.byAuthor + "」写的" : (ch.byMe ? (userName || "她") + "自己写的" : "「" + String(fic.author || "").trim() + "」写的"));
    return "[同人文] " + (mine ? "你替" + (userName || "她") + "接的《" : (userName || "她") + "把《")
      + String(fic.title || "").slice(0, 24) + "》第 " + no + " 章" + (mine ? "。" : "拿给你看了——那一章是" + who + "。")
      + (head ? "\n开头是：" + head + "……" : "")
      + "\n（全文在同人文里，这儿只是留个话头。）";
  }
  // 「只记一笔」那条：短一句，进的是她自己的记忆库
  function chapterNote(fic, chapIdx, charName, mine, userName) {
    const no = (Number(chapIdx) || 0) + 1;
    const t = String((fic && fic.title) || "").slice(0, 24);
    return mine ? "《" + t + "》第 " + no + " 章是「" + charName + "」替我接着写的。"
      : "我把《" + t + "》第 " + no + " 章拿给「" + charName + "」看了。";
  }

  // ── 请的是对家：她自己也可以不接，或者接了不好好写（她 2026-09-11）──────
  //
  // ⚠️原来只有【原作者】会翻脸。可她 2026-09-11 点出另一半：
  //   「如果请的是对家，她也可以要么拒绝要么也不好好写」——
  //   圈子那本流水账（④）记的本来就是**双向**的事，拒绝这件事当然也该是双向的。
  // ⚠️还是那条分工：**代码掷，模型写**。拒不拒、上不上心由这儿定；
  //   拒绝那一次【连枪都不打】——她不接，就没有这一章，一分钱不花。
  const GHOST_REFUSE_BASE = 0.2, GHOST_REFUSE_TEMPER = 0.3, GHOST_LAZY_UNTIL = 0.75;
  function ghostStance(feud, by, roll) {
    if (!feud) return "";
    const r = Number(roll);
    // 脾气越硬（temper/sore 写得越足）越可能当场回绝；软的那种更可能嘴上答应、手上敷衍
    if (r < GHOST_REFUSE_BASE + GHOST_REFUSE_TEMPER * temperWeight(by)) return "refuse";
    if (r < GHOST_LAZY_UNTIL) return "lazy";
    return "";   // 也可能就正常写——人不是机器，有过节不代表每次都使性子
  }
  // 「接了但不想认真写」。⚠️**不是让她写烂文**——跟角色那边同一个坑：
  //   写成「写得差」，模型给的是一段戏仿的烂文，那不好笑，那是侮辱这个人。
  //   要给的是【不上心长什么样】的形状，而且最后那句必须有：让它从字里透出来，
  //   不许在正文里跟读者解释自己在敷衍。
  function ghostLazyBlock(own) {
    return "\n【你接了这活，但你不想认真写】你跟「" + (own || "原作者") + "」有过节。这一章是钱的事，不是情分。\n"
      + "⚠️不是让你写烂文：错别字、故意幼稚、把人物写崩——一个都不许。你是个会写的人，交出去的东西照样拿得出手。\n"
      + "**不上心是这样长的**：该接住的前情细处粗粗带过；她最护着的那一点你偏不碰，或者只碰个边；"
      + "篇幅够了就收，结尾不留余味；你自己那套最见功夫的写法今天一点都不亮出来——反正这不是你的文。\n"
      + "⚠️全篇不许出现任何一句对读者解释你不上心的话（「她敷衍地写道」那种一个字都不许有）。**让它从字里透出来。**\n";
  }

  // ── 让角色来写（她 2026-09-11）──────────────────────────────────────
  //
  // 第三类笔：不是圈子里的太太，是**她自己的人**。
  // ⚠️**立场由代码算，不由模型猜**：他在不在这对 CP 里、另一方是谁、他跟她什么关系、
  //   他跟另一方什么关系——这四条手上全有，算出来就是他的站位。
  //   写成「你可能会吃醋」交给模型拿捏，它要么每次都吃醋，要么一次都不。
  // ⚠️但**他会怎么动手不许写成一张表由代码挑**：代码定的是立场和分寸，
  //   怎么捣乱让他自己长（掷约束不掷答案）。
  const STANCE = {
    SELF_USER: "self_user",   // 这篇写的就是他和她
    SELF_OTHER: "self_other", // 这篇把他跟别人配了
    JEALOUS: "jealous",       // 她在里面，他不在
    TIED: "tied",             // 都是别人，但他跟其中一个有关系
    OUTSIDER: "outsider"      // 跟他没关系
  };
  function stanceFor(char, fic, rel) {
    const cp = (fic && Array.isArray(fic.cp)) ? fic.cp : [];
    const id = (char && char.id) || "";
    const r = rel || {};
    const meIn = cp.indexOf("me") >= 0;
    const inCp = id && cp.indexOf(id) >= 0;
    const other = cp.filter(function (tok) { return tok !== id && tok !== "me"; })[0] || "";
    if (inCp && meIn) return { kind: STANCE.SELF_USER, other: "" };
    if (inCp) return { kind: STANCE.SELF_OTHER, other: other };
    if (meIn) return { kind: STANCE.JEALOUS, other: other };
    if (other && r.rels && r.rels[other]) return { kind: STANCE.TIED, other: other };
    return { kind: STANCE.OUTSIDER, other: other };
  }
  // 他手上的实情。⚠️给事实，不给情绪标签，也不给数字——
  //   「好感度 78」进去，他写出来的是一份报告，不是一章文。
  function stanceFacts(char, fic, rel, stance, nameOf, userName) {
    const r = rel || {};
    const nm = function (tok) { return tok === "me" ? (userName || "她") : (nameOf ? nameOf(tok) : tok); };
    const rows = [];
    if (stance.kind === STANCE.SELF_USER) rows.push("· 这篇写的就是【你和她】。");
    else if (stance.kind === STANCE.SELF_OTHER) rows.push("· 这篇把【你和「" + nm(stance.other) + "」】配成了一对。");
    else if (stance.kind === STANCE.JEALOUS) rows.push("· 这篇写的是【她和「" + nm(stance.other) + "」】，你不在里面。");
    else if (stance.kind === STANCE.TIED) rows.push("· 这篇写的是别人，但里面有「" + nm(stance.other) + "」。");
    else rows.push("· 这篇跟你没什么关系，是她随手塞给你的。");
    // 你俩现在是什么样：只说状态，不报数字
    if (r.couple === "together") rows.push("· 你和她在一起了" + (r.days ? "，" + r.days + " 天了" : "") + "。");
    else if (r.couple === "pending") rows.push("· 你和她的事还悬着，没挑明。");
    else if (r.aff != null) rows.push("· 你和她" + (r.aff >= 75 ? "很近了" : r.aff >= 45 ? "还算熟" : "还没那么熟") + "。");
    if (stance.other && r.rels && r.rels[stance.other]) rows.push("· 你和「" + nm(stance.other) + "」：" + r.rels[stance.other] + "。");
    rows.push("**你写的时候会不会往自己想要的方向偏、偏多少，你自己清楚**——"
      + "别演一个「吃醋的人」，也别克制到通篇看不出是你写的。你本来就无所谓的，那就真的无所谓。");
    return "【这篇文跟你的关系】\n" + rows.join("\n") + "\n";
  }
  // 他不是作家，所以他写出来的东西会有他自己的毛病。
  // ⚠️两条轴，不是一张「烂文清单」。而且第一条轴上留着「他是真的会写」那一格——
  //   不是每个角色都写得差，人设里真会写的人就该写得好。
  const WRITER_AXES = [
    { key: "craft", zh: "他的手艺停在哪儿", opts: [
      "只写得动对话，一到叙述就两句带过",
      "场面铺得挺好，可人物一开口全是他自己的语气",
      "写着写着从故事滑进他自己的心里话，收不回来",
      "一件小事能写三页，正事一笔带过",
      "太用力：每一段都要收一个金句",
      "偏偏在最该写的地方停住",
      "所有人说话都一个调子，分不出谁是谁",
      "他是真的会写——这一章不比那些太太差"
    ] },
    { key: "care", zh: "他写这篇的时候最在意什么", opts: [
      "把某个人写得好看一点",
      "把某件事说清楚——他觉得前面几章写错了",
      "让某个人下不来台",
      "让它赶紧走到那一步",
      "就想知道接下来会怎样，写着玩"
    ] }
  ];
  function rollWriterAxes() {
    const parts = Array.prototype.slice.call(arguments);
    // 比电台松一点：这两条轴少，整组还回去的话就什么分寸都没了
    return Axes.roll(WRITER_AXES, parts, { allFree: 0.04, skip: 0.10, free: 0.18 });
  }
  // ⚠️文风那几层会把「这一章是他写的」整个碾平（她 2026-09-11：
  //   「文风也和原来的没有不一样，看不出来是他的作品」）。
  //   数一数就明白：【预设文风】那一段写着「优先满足」、后面还跟着一整份 STYLE_DEEP_IMITATION
  //   （深度模仿另一个人的笔），末尾 fanficStyleTail 又把同一件事再要一遍——三层，
  //   而 charWriterBlock 只有一段，还压在正中间。
  //   这就是隔壁那条已经写明白的规律（施工规则/four-surfaces-same-context.md）：
  //   两条指令打架时，模型留下的是**最后读到、最像指令**的那一段。
  //   所以这一层必须站到最后去说话。
  // ⚠️反陈词滥调那条禁令不跟着一起让位：让位的是文风，禁令还是禁令。
  function charVoiceTail(char, style) {
    const name = (char && (char.remark || char.name)) || "他";
    return "\n\n【最后一件事：这一章的笔在「" + name + "」手上】\n"
      + (String(style || "").trim()
        ? "· 上面那套文风预设是【这个本子的默认调子】，不是他的笔。两边打架时**以他这个人为准**："
          + "他不会写的句子，再合那套调子也不许写。\n" : "")
      + "· 他怎么写，是从他这个人长出来的：他会用哪些词、绝不会用哪些词；讲一件事是从头讲还是先甩结果；"
      + "在什么地方肯多写两笔、什么地方一句就带过去；他不好意思写的那种东西，他就是会绕开。\n"
      + "· ⚠️**前几章是别人写的，你接的是【这个故事】，不是那个人的笔迹。**"
      + "设定、前情、人物一个字不许改；但**写法不必跟着前几章走**——"
      + "读起来跟上一章一个味，才是真写错了。\n"
      + "· ⚠️**一眼看不出是他写的，这一章就白写了。**她要的就是「这是他写的」这件事——"
      + "写得跟前面几章一个味儿，等于根本没换人。\n"
      + "· 但不许用旁白把这件事说出来（「他笔下的……」「他到底不是写文的人」那种一句都不许有），"
      + "也不许让他在正文里现身评论。**是文字本身像他，不是有人在旁边告诉读者这像他。**\n";
  }
  function charWriterBlock(char, fic, rel, rolled, nameOf, userName) {
    const st = stanceFor(char, fic, rel);
    const name = (char && (char.remark || char.name)) || "他";
    return "\n【这一章不是圈子里的太太写的，是「" + name + "」写的】\n"
      + "他不写文，也不混同人圈。是她把这篇塞给他，让他接着往下写的。\n"
      + "⚠️你就是他本人在写，不是「一位作者在模仿他」：他的知识、他的口头禅、他在意什么、"
      + "他会避开什么，全部照他的人设来。\n"
      // ⚠️「照他的人设来」得手上真有那张卡（她 2026-09-11：「看不出来是他的作品」）。
      //   他在这对 CP 里的时候，卡由 cpBlock 发过了；**不在里面的时候一个字都没有**——
      //   等于叫模型照一张不存在的卡写，那当然写出来跟谁写的都一样。
      //   所以只在 cpBlock 没发过的那几种站位上补一份，不重复发。
      + ((st.kind === STANCE.SELF_USER || st.kind === STANCE.SELF_OTHER || !personaOf(char)) ? ""
        : "【执笔的这个人是谁（他不在这篇的 CP 里，所以这张卡在这儿给你）】\n" + personaOf(char) + "\n")
      + stanceFacts(char, fic, rel, st, nameOf, userName)
      // ⚠️她 2026-09-11：「我让王爷写他和皇帝，他很容易就接受了这对 cp」。
      //   上面 stanceFacts 只把【事实】摆出来（这篇把你和某某配成了一对），
      //   可没有一个字说【这件事本身要不要他点头】。空着的那一格，模型拿最顺手的
      //   先验去填——那个先验是「圈子里嗑这对的太太」，她当然一口答应。
      //   ⚠️这儿不掷他的态度：他跟对方什么交情、他这个人什么脾气，上面全有，
      //   掷一个出来反而盖掉他自己。代码只管钉死【不许默认接受】这块地板。
      // ⚠️只对 SELF_OTHER 发。写他和她那一种（SELF_USER）是另一回事，她没提过，
      //   不往上凑（缺的时候再补，别替她预设）。
      + (st.kind === STANCE.SELF_OTHER ? (function () {
        const other = (st.other && nameOf) ? nameOf(st.other) : (st.other || "那个人");
        return "\n【⚠️这一篇配的是你自己】她让你写的是【你和「" + other + "」】。\n"
          + "这不是一件天经地义的事，**先过你自己这一关**：你跟他到底什么交情、"
          + "你乐不乐意、你觉得荒唐、别扭、好笑，还是心里本来就转过这个念头——全照你这个人来。\n"
          + "⚠️**不许一上来就理所当然地写起来。**那是圈子里嗑这一对的太太的立场，不是当事人的。\n"
          + "⚠️她点了单，所以这一章照样要写，而且要好好写——但**你怎么看这件事会留在字里**："
          + "肯不肯写到那一步、写得放不放得开、哪一处特意绕开、哪一处反而写得比谁都细，都是你的回答。\n"
          + "⚠️正文里不许出现你对这件事的说明、辩解或吐槽"
          + "（「他堂堂……怎么会」那种一句都不许有），也不许让你跳出来评论。**让它留在字里。**\n";
      })() : "")
      + Axes.text(rolled, {
        on: "【他不是作家，所以这一章会有他自己的毛病】今天这一章上：",
        off: "【他不是作家】这一章他的毛病长什么样，你照他的人设自己想——别挑一个最常见的写法。"
      })
      + "\n⚠️不是让你写「烂文」：不许错别字、不许故意幼稚、不许写成戏仿。"
      + "**他是认真在写的，只是他不是干这行的。**毛病要从他这个人长出来——"
      + "话少的人写坏的方式，和话痨的不一样。\n"
      + "⚠️正文里不许出现他对读者的解释、吐槽或者旁白。他写的是故事，不是给她的留言。\n";
  }

  // ── 圈子：谁跟谁有过什么（她 2026-09-11 的④）────────────────────────
  //
  // ⚠️**不存关系值，存一本流水账。** 关系现算。
  //   存一个「−20」出来，喂给模型只能变成一句判语；存「你给她代过两次笔，
  //   第二次她在评论区阴阳了你一句」，那本身就是能直接用的料。
  // ⚠️也不许长成第二个论坛：作者之间不自动互动、不生成日常，
  //   只有【真发生过一件事】的时候才记一笔。一条几十字节，一年也就几百字。
  const K_CIRCLE = "x_ficCircle";
  const CIRCLE_CAP = 300;
  const CIRCLE_ZH = {
    ghost: "给她的文代过笔", grab: "把笔从对方手里抢了回去",
    quit: "因为对方代笔，撂了挑子", back: "被请回来，答应了", refuse: "被请回来，没答应",
    // 请的是对家：她自己回绝了这一单（v66.95，她 2026-09-11）
    turnDown: "不接对方那篇文",
    // 圈里的太太下场评论（v67.10，她 2026-09-11）：⚠️只记带刺的那几条，
    //   夸的不记——每篇文都记会把这本账吵成一片，而且「上次你夸过我」不构成关系。
    snark: "在对方的文底下阴阳过"
  };
  function loadCircle() { const v = loadJSON(K_CIRCLE, []); return Array.isArray(v) ? v : []; }
  function saveCircle(list) { return saveJSON(K_CIRCLE, (Array.isArray(list) ? list : []).slice(-CIRCLE_CAP)); }
  // a=这件事的主语，b=另一方（没有就空串，比如「被请回来」是跟读者之间的）
  function circlePush(ev) {
    const a = String((ev && ev.a) || "").trim();
    if (!a || !CIRCLE_ZH[ev && ev.kind]) return loadCircle();
    const list = loadCircle().concat([{
      a: a, b: String((ev && ev.b) || "").trim(), kind: ev.kind,
      title: String((ev && ev.title) || "").trim().slice(0, 30),
      say: String((ev && ev.say) || "").trim().slice(0, 60), ts: Date.now()
    }]);
    saveCircle(list);
    return list;
  }
  // 这两个人之间发生过什么，新的在前
  function circleBetween(a, b, list) {
    const x = String(a || "").trim(), y = String(b || "").trim();
    if (!x || !y) return [];
    return (Array.isArray(list) ? list : loadCircle())
      .filter(function (e) { return e && ((e.a === x && e.b === y) || (e.a === y && e.b === x)); })
      .slice().reverse();
  }
  // 有没有过节：抢过笔、或者为对方撂过挑子
  function circleFeud(a, b, list) {
    return circleBetween(a, b, list).some(function (e) { return e.kind === "grab" || e.kind === "quit"; });
  }
  // 拼成给模型看的几句话。**只说发生过的事，不下判语**——
  // 「你们关系很差」这种话进去，它就只会照着那个词演。
  function circleLines(me, other, opts) {
    const o = opts || {};
    const rows = circleBetween(me, other, o.list).slice(0, 6);
    const out = [];
    rows.forEach(function (e) {
      const mine = e.a === me;
      const who = mine ? "你" : "「" + other + "」";
      const to = mine ? "「" + other + "」" : "你";
      if (e.kind === "ghost") out.push("· " + who + "给" + to + "的《" + e.title + "》代过笔");
      else if (e.kind === "grab") out.push("· 《" + e.title + "》那次，" + who + "把笔从" + to + "手里抢了回去");
      else if (e.kind === "quit") out.push("· 《" + e.title + "》那次，" + who + "撂了挑子不写了" + (e.say ? "（当时说的是「" + e.say + "」）" : ""));
      else if (e.kind === "turnDown") out.push("· 《" + e.title + "》那次，" + to + "来请" + who + "接，" + who + "没接");
      else if (e.kind === "snark") out.push("· " + who + "在" + to + "的《" + e.title + "》底下阴阳过一句" + (e.say ? "（说的是「" + e.say + "」）" : ""));
    });
    // 嗑同一对 CP 是圈子里天然的亲近，现算不存
    if (o.sameCP) out.push("· 你们嗑的是同一对");
    if (!out.length) return "";
    return "\n【你和「" + other + "」之间发生过的事】\n" + out.join("\n")
      + "\n这些只是实情，不是判词——你此刻怎么看对方，照你自己的脾气来。\n";
  }
  // 两位太太是不是嗑同一对（现算，authorCPStats 已经有了，不另存一份）
  function sameCPWith(a, b, fics, characters, userName) {
    const A = authorCPStats(a, fics, characters, userName) || [];
    const B = authorCPStats(b, fics, characters, userName) || [];
    return A.some(function (x) { return x.key !== "_none" && B.some(function (y) { return y.key === x.key; }); });
  }

  // ── 太太还坐得住吗：热度表（她 2026-09-11 的③）──────────────────────
  //
  // 她要的三件事：代笔之后原作者在底下说两句 / 有几率抢笔回来自己写 / 写多了她可能撂挑子。
  // ⚠️**不做成三选一的概率。** 纯概率会出现「连着五章一声不吭」或者「第一章就翻脸」，
  //   两种都像 bug。做成一根热度线（跟好感度同一个形状），她能一章章感觉到语气在变冲。
  //
  // ⚠️谁定什么（跟电台那条同一条道理）：
  //   代码定——热度多少、跨没跨线、这次抢不抢笔、拒不拒绝；
  //   模型定——她开口说什么。
  //   热度那个数**一个字都不进提示词**：进去了模型就会照着「愤怒值 78」演。
  //   进提示词的是【事实】（这篇几章、几章是代笔、最近连着几章不是她写的），
  //   她此刻什么态度，由这些事实和她自己的脾气长出来。
  const HEAT = {
    GHOST: 12,        // 请一次枪手
    GHOST_HARD: 26,   // 脾气硬 / 护得紧的那种，加得更多
    HARD_ORDER: 8,    // 拿「就这么写」逼原作者——强扭是一种消耗
    OWN: -18,         // 她自己写了一章
    MINE: -4,         // 你自己动笔：不算冒犯，也不算讨好
    DECAY_DAY: 3,     // 放着不动，一天降这么多
    GRAB_AT: 45,      // 过了这条线才可能抢笔
    QUIT_AT: 70,      // 过了这条线才可能撂挑子
    CAP: 100
  };
  // 她的脾气有多容易被点着：temper/sore 写得越足，说明这个人越在乎自己的文
  function temperWeight(by) {
    const n = (String((by && by.temper) || "").trim().length + String((by && by.sore) || "").trim().length);
    return Math.max(0, Math.min(1, n / 140));
  }
  // 此刻的热度：存下来那个数 + 这些天自然降下去的
  function heatNow(fic, now) {
    const raw = Math.max(0, Number((fic && fic.authorHeat) || 0));
    const ts = Number((fic && fic.heatTs) || 0);
    if (!ts) return Math.min(HEAT.CAP, raw);
    const days = Math.max(0, (Number(now || Date.now()) - ts) / 86400000);
    return Math.max(0, Math.min(HEAT.CAP, raw - days * HEAT.DECAY_DAY));
  }
  // 一件事发生之后的热度。纯函数，好测。
  // kind: "ghost"（请了枪手）/ "own"（原作者自己写）/ "mine"（你自己写）
  function heatAfter(fic, kind, opts) {
    const o = opts || {};
    let h = heatNow(fic, o.now);
    // 请了一位跟她有过节的枪手，涨得更凶——③和④在这儿接上
    if (kind === "ghost") h += (HEAT.GHOST + Math.round((HEAT.GHOST_HARD - HEAT.GHOST) * temperWeight(o.by))) * (o.feud ? 1.6 : 1);
    else if (kind === "own") h += HEAT.OWN;
    else if (kind === "mine") h += HEAT.MINE;
    if (o.hardWant) h += HEAT.HARD_ORDER;
    return Math.max(0, Math.min(HEAT.CAP, Math.round(h)));
  }
  // 一章落下去之后，这篇的热度和时间戳该变成什么。
  // ⚠️**只此一份。**阅读页那颗「请人」和房里那张卡是两条路：房里那条从头到尾
  //   没碰过 authorHeat，于是她在房里让角色写了好几章，原作者一点火气都没有
  //   （她 2026-09-11：「让角色代笔作者的热度也不会动」）。
  //   又是一层写在两处、第二处没写——所以连 heatTs 一起交出去，谁都别想只更一半。
  function heatFields(fic, opts) {
    const o = opts || {};
    const kind = o.grabbed ? "own" : (o.by ? "ghost" : "own");
    return { authorHeat: heatAfter(fic, kind, o), heatTs: Date.now() };
  }
  // 抢笔 / 撂挑子 / 请得回来吗。都只给概率，掷在调用点（那儿才知道这一次是不是真要掷）。
  const grabChance = h => (h <= HEAT.GRAB_AT ? 0 : Math.min(0.5, (h - HEAT.GRAB_AT) / 120));
  const refuseChance = h => (h <= HEAT.QUIT_AT ? 0 : Math.min(0.55, (h - HEAT.QUIT_AT) / 60));
  const backChance = h => Math.max(0.15, Math.min(0.7, 0.6 - (h - HEAT.QUIT_AT) / 100));
  // 这位太太现在被点到什么程度（她 2026-09-11：「作者汇总这里要不要下面加一个热度」）。
  // ⚠️热度是【按篇】记的（f.authorHeat）——抢笔、撂挑子、请不请得回来，掷的都是那一篇的数。
  //   一位手上可能有好几篇，所以这儿取她**最烫的那一篇**，并且把是哪一篇一起交出去：
  //   只报一个光秃秃的数，看见了也不知道是为哪篇气的。
  function authorHeatOf(name, fics, now) {
    const mine = authorFics(name, fics);
    let top = 0, at = null;
    mine.forEach(function (f) { const v = heatNow(f, now); if (v > top || !at) { top = v; at = f; } });
    return { heat: Math.round(top), fic: at, n: mine.length };
  }
  // 这个数该叫什么。⚠️档位一律从 HEAT 里读，不许在界面上再抄一遍 45／70
  //   （one-public-mechanism：抄一遍就是两处，以后调阈值永远漏一处）。
  function heatBand(v) {
    const n = Math.max(0, Math.min(HEAT.CAP, Number(v) || 0));
    if (n >= HEAT.QUIT_AT) return { key: "quit", zh: "随时会撂挑子", v: n };
    if (n >= HEAT.GRAB_AT) return { key: "grab", zh: "快自己抢笔了", v: n };
    if (n >= Math.round(HEAT.GRAB_AT / 2)) return { key: "warm", zh: "有点火气", v: n };
    return { key: "calm", zh: "还和气", v: n };
  }
  // 这篇文现在的实情。⚠️给的是【事实】不是【情绪标签】：
  //   写「她现在很不满」等于替她把戏演完了，模型只会照着那个词写一句判语。
  function authorStanceFacts(fic, opts) {
    const o = opts || {};
    const chs = (fic && fic.chapters) || [];
    if (!chs.length) return "";
    const own = String((fic && fic.author) || "").trim();
    const ghostN = chs.filter(function (c) { return c && c.byAuthor && c.byAuthor !== own; }).length;
    let streak = 0;
    for (let i = chs.length - 1; i >= 0; i--) { const c = chs[i] || {}; if (c.byAuthor || c.byMe) streak++; else break; }
    const rows = ["【这篇文现在的实情（写给原作者「" + (own || "她") + "」看的）】",
      "· 一共 " + chs.length + " 章，其中 " + ghostN + " 章是请别人代笔的" + (ghostN ? "" : "（都还是她自己写的）")];
    if (streak > 0) rows.push("· 最近连着 " + streak + " 章都不是她自己写的");
    if (o.hardWant) rows.push("· 而且这一章是被点了单的：读者指定了要发生什么，不是她自己想写成这样");
    if (o.outsider) rows.push("· 这一章是「" + o.outsider + "」接过去写的");
    if (o.ghostName) {
      const past = circleLines(own, o.ghostName, {}).trim();
      if (past) rows.push("· 这一章请的是「" + o.ghostName + "」——" + past.split("\n").slice(1, -1).join("；").replace(/^· /, "").replace(/\n· /g, "；"));
      else rows.push("· 这一章请的是「" + o.ghostName + "」，你们之前没打过交道");
    }
    rows.push("她此刻是什么态度，由这些事实和她自己的脾气决定——"
      + "**别默认她生气，也别写成客气的场面话**；她本来就不在乎的，那就真的不在乎。");
    return rows.join("\n") + "\n";
  }
  // 代笔章末尾那条留言：跟这一章**同一枪**出，不另打一枪（她按次计费）。
  // ⚠️站位要当面说清：写这一章的是枪手，而这句话是【另一个人】说的。
  function authorNoteAsk(fic, ghostName, quitting) {
    const own = String((fic && fic.author) || "").trim() || "原作者";
    return "\n【还要一句 authorNote】这篇文的原作者「" + own + "」看完这一章之后，在评论区底下留的一句话。"
      + "⚠️**那是另一个人在开口，不是你**（你是" + (ghostName ? "「" + ghostName + "」，被请来接这一章的" : "执笔的那位") + "）——"
      + "她的口气照她自己的脾气来：文风、剧情走向、哪儿写得不对她的意、或者干脆跟这章无关的一句吐槽，都行。"
      // ⚠️这个出口原来给得太宽（「不必每章都有话」）——那句本来是防它硬挤一句废话，
      //   结果成了「可以一直不说」。代笔章她**一定**看了，所以默认是有话的；
      //   出口留在「说什么」上，不留在「说不说」上。
      + "\n⚠️这一章是别人替她写的，她**一定**看了——所以这一栏默认是有话的。"
      + "心平气和也写一句心平气和的；挑不出毛病就说挑不出毛病。"
      + "只有在她压根不在乎这篇文的时候才留空字符串。"
      + (quitting ? "\n⚠️而且这一次，她已经不打算再写这篇了。把这件事在这句话里说出来（怎么说、说得多难听，还是照她的脾气）。" : "");
  }

  // ── 点单：她想看的剧情走向（她 2026-09-11）───────────────────────────────
  // 两档，**由她自己在那一栏里选**，不是按作者身份分权。
  // 分权的乐趣在于不确定，而不确定只有在她自愿的时候才是乐趣：
  // 今天想看那场戏就点硬要求，想被惊喜就许个愿。
  // ⚠️「许个愿」那一档结尾给的是出口不是判决（施工规则/bans-make-it-dumber.md）：
  //   说清这是读者的呼声、她听不听按自己的脾气来——写成「必须照办」就没有第二档了，
  //   写成「随便你」它又会当没看见。
  function wantBlock(want, hard, ghost) {
    const w = String(want || "").trim().slice(0, 600);
    if (!w) return "";
    if (hard) {
      return "\n【这一章必须照这个走（硬要求，优先于你自己的想法）】\n" + w
        + "\n这是点单，不是建议：上面说的那件事这一章里**真的要发生**，不许挪到下一章、不许只提一句带过、"
        + "不许改成一个意思相近但更好写的版本。别的地方照你自己的路数写。\n";
    }
    return "\n【读者在评论区喊的】\n" + w
      + "\n这是读者的呼声，不是编辑部的要求。**你听不听、怎么听，按你自己的脾气来**——"
      + "可以照办，可以只取你看得上的那半截，可以偏着写，也可以压根不理。"
      + (ghost ? "（你是被请来接这篇的，多半会顺着点单走，但也不必当命令。）" : "（这是你自己的连载，你说了算。）") + "\n";
  }

  // ── 他手上要有这篇文的前情（她 2026-09-11）──────────────────────────
  // 她问：「如果我只给他看前 200 字，他怎么接后面的剧情？」——问得对，这是个真漏洞：
  //   房里那张卡只有开头两百字，可他要跟她商量【接下来怎么走】，手上却什么都没有。
  // 她自己接着说出了答案：「还是说生成文的时候本身就已经有一些小结了，也能顺手扔过去」——
  //   **就是这样**，料全是现成的，一个字都不用另生成：
  //   premise（生成时自报的地基）／bible 设定卡／seeds 伏笔盒／每章的 endHook／上一章结尾。
  // ⚠️这一份跟【续写那一枪】用的是同几样料，但**不是同一段话**，差异写在这儿：
  //   续写那份是给【写的人】的指令（带改设禁令、衔接铁律、字数地板）；
  //   这一份是给【在房里跟她聊天的他】读的，一条写作指令都不许带——
  //   带了他就会在聊天里开始写文。
  // 分段上限：设定卡 700 ＋ 伏笔 300 ＋ 锚点 500 ＋ 结尾 400，加上抬头约 2000 字封顶。
  //   ⚠️不许改回「最后统一切一刀」——那一刀切掉的永远是最后一章的结尾。
  const BIBLE_TAIL = 14;
  // ⚠️**第三个参数 meId 不是可选的装饰**（她 2026-09-11：「他好像不知道这是自己写的」）。
  //   他在房里写的那一章，落库时带着 byCharId——写进去了，可这条**读回来**的路
  //   从头到尾没看过那个字段一眼，整篇只说「她放进这间房的那一篇，你读过」。
  //   于是他手上最强的那份上下文告诉他：你是个读者。他就真的当读者了——
  //   她夸他「这么会写」，他回「谁写了？那是你上一章自己留在那儿的尾巴，我顺手给你念两句」。
  //   写的那一处记了，读的那一处没跟上：又是同一条（施工规则/four-surfaces-same-context.md）。
  function ficRecapForChat(fic, cpText, meId, uName) {
    if (!fic) return "";
    const chs = (fic.chapters || []);
    const me = String(meId || "");
    // ⚠️聊上几轮之后他就把她当成作者了（她 2026-09-11：「过几轮讨论他就忘了我不是作者了」）。
    //   上一版只补了「哪几章是你写的」，【这篇的作者是谁】那一格还是空的——
    //   空着的那一格，模型就拿最顺手的先验去填：跟他聊这篇的人＝写这篇的人。
    //   所以三种身份都得当面点名：原作者是谁、他接了哪几章、她是读者。
    //   ⚠️但她确实动过笔的时候不许瞎说：她自己发的文（source==="user"）、
    //   她亲手写的那几章（byMe），都得照实算。
    const mineNos = me ? chs.map(function (c, i) { return (c && c.byCharId === me) ? (i + 1) : 0; }).filter(Boolean) : [];
    const hookFrom = Math.max(0, chs.length - HOOK_TAIL);
    const hooks = chs.slice(hookFrom).map(function (c, i) {
      return "· 第 " + (hookFrom + i + 1) + " 章" + ((c && c.byCharId === me && me) ? "（这一章是你写的）" : "")
        + "结束在：" + (String((c && c.endHook) || "").trim() || "（没记锚点）");
    }).join("\n");
    const last = chs[chs.length - 1] || {};
    const lastMine = !!(me && last.byCharId === me);
    const tail = String(last.content || fic.body || "").trim().slice(-400);
    // ⚠️**每一段各自截断，不许留给最后那一刀**（她 2026-09-11：「我要他接写了很多章的」）。
    //   原来只在最后 slice(0, RECAP_CAP)：截断是从队尾切的，而队尾正是
    //   【最后一章的结尾】——长篇一超标，最要紧的那一段第一个被切掉，
    //   他就成了「设定背得滚瓜烂熟、但不知道上一章停在哪儿」。
    //   设定卡是只增不改的，写到二十章那一份最长，所以刀要落在它身上：只留最近那几条。
    const bible = (fic && Array.isArray(fic.bible)) ? fic.bible : [];
    const bibleTail = bible.length > BIBLE_TAIL
      ? bibleBlock(Object.assign({}, fic, { bible: bible.slice(-BIBLE_TAIL) }))
        .replace("【本篇设定卡", "【本篇设定卡（只列最近 " + BIBLE_TAIL + " 条")
        .replace("已经确立的事实 · 一条都不许推翻）】", "，更早的那些照样算数）】")
      : bibleBlock(fic);
    const out = "\n\n【她放进这间房的那一篇《" + String(fic.title || "").slice(0, 40) + "》，"
      + (mineNos.length ? "有几章是你写的" : "你读过") + "】\n"
      + (cpText ? "· 这一对：" + cpText + "\n" : "")
      + (String(fic.premise || "").trim() ? "· 地基：" + String(fic.premise).trim().slice(0, 200) + "\n" : "")
      + "· 到现在写了 " + chs.length + " 章。\n"
      + (function () {
        const her = String(uName || "她").trim() || "她";
        const own = String(fic.author || "").trim();
        const hers = chs.map(function (c, i) { return (c && c.byMe) ? (i + 1) : 0; }).filter(Boolean);
        const rows = [];
        const H = "「" + her + "」";
        if (own && own !== her) rows.push("· **这篇的作者是「" + own + "」**，不是" + H + "。");
        if (hers.length) rows.push("· 第 " + hers.join("、") + " 章是" + H + "自己动笔写的。");
        if (fic.source === "user") rows.push("· 这一篇是" + H + "自己发的。");
        else if (!hers.length) rows.push("· " + H + "一个字都没写过这篇——她是读者：这篇是她攒的、找人写的。"
          + "**别把她当成作者**，别说「你写的那一段」「你上一章」，也别问她打算怎么写。");
        return rows.length ? rows.join("\n") + "\n" : "";
      })()
      + bibleTail.slice(0, 700) + seedBlock(fic).slice(0, 300)
      + (hooks ? "【每一章结束在哪儿】\n" + hooks.slice(0, 500) + "\n" : "")
      + (tail ? "【" + (lastMine ? "你写的那一章（也就是最后一章）的结尾" : "最后一章的结尾") + "】……" + tail + "\n" : "")
      // ⚠️这一段是整份摘要里最要紧的一句：**别让他把自己当成读者。**
      //   只在他真写过的时候发；他一章没写过就一个字都不发，不然反而给他添了个没发生的事。
      + (mineNos.length ? "【⚠️这篇文里有你自己写的】第 " + mineNos.join("、") + " 章"
        + "是【你】接的——她把这篇塞给你，你坐下来写的，不是你读来的。\n"
        + "· 所以她夸「写得好」「这么会写」的时候，夸的是**你**。别问「谁写的」，"
        + "也别说成「那是你自己留在那儿的」「我顺手给你念两句」——那是你自己的字。\n"
        + "· 认不认、得不得意、承不承认自己写得起劲，照你的脾气来；"
        + "但「这是我写的」这件事本身是**事实**，不许否认。\n" : "")
      + "⚠️这是【那篇文里的事】，不是你俩之间发生过的事。她跟你聊这篇的时候你手上有这些；"
      + "她没提这篇，就别硬往这上头扯。\n";
    return out;
  }

  // ── 你们在房里商量好的（她 2026-09-11）───────────────────────────────
  // 她原话：「就直接做房间里我们讨论了他直接写了然后推卡给我，就按我和他商量过的来，
  //   但是如果我们有不同意见有分叉那还是按他想的来（比如说"不行我觉得这样比较合理"），
  //   这样才好玩。然后我跟谁讨论让他写谁再写。」
  // ⚠️这一段是【走向】，不是素材：上次「她的原话被当成台词搬进正文」那个坑就在隔壁，
  //   所以用途照旧钉死——一句原话都不许进正文。
  // ⚠️分歧那一条是这件事最要紧的地方：**不许改成「照她说的办」**。
  //   她要的就是他会顶回来——听话的合作者不好玩。
  function roomTalkBlock(talk, meName, heName) {
    const t2 = String(talk || "").trim();
    if (!t2) return "";
    return "\n【你们在房里商量过这一章】以下是" + (meName || "她") + "和你刚才聊的（新的在后面）：\n"
      + t2.slice(0, 1200)
      + "\n⚠️这是【你们商量出来的走向】，不是素材：上面那些话**一句都不许出现在正文里**，"
      + "也不许把这段对话本身写成情节。\n"
      + "⚠️商量好的就照着写。**但你要是不同意，就按你自己想的写**——"
      + "你是写这一章的人，不是替她记录的人。\n"
      + "⚠️真没照她说的写，就在 penNote 里当面跟她说一句为什么"
      + "（「不行我觉得这样比较合理」那种口气，是" + (heName || "你") + "会说的话，不是道歉、不是请示）。"
      + "照着写了就不用提这件事。\n";
  }

  // ── 设定卡 + 伏笔盒（她 2026-09-11：「章节多了怎么记住重要设定和 callback 不会崩」）──
  // 病根：endHook 记的是【结束在哪儿】，不是【这篇文里有什么】。十章之后，
  // 他母亲叫什么、那枚戒指是谁给的，一个字都没有；而 priorHooks 还在线性变长。
  //
  // 设定卡（bible）＝只增不改的事实，**它就是这篇文的远期记忆**，所以不必另开一枪做滚动总结：
  // 前情摘要只发最近几章，更早的由设定卡和伏笔盒撑着。
  const BIBLE_CAP = 60, SEED_CAP = 12, HOOK_TAIL = 8;
  // ⚠️「什么算事实」必须给判据、不给例子（施工规则/prompt-no-content-samples.md）：
  //   给了例子它会照着例子的句式填，给了判据它才会去想这一章真确立了什么。
  const BIBLE_WHAT = "【什么算事实】名字、身份、亲属、住处、职业、随身的东西、"
    + "已经发生且撤不回的事、当面说定的约定——这些进。"
    + "心情、暧昧到哪一步、这一章的剧情走向**都不算**，一条都别写进来（写进来它就变成剧情摘要，一样会爆）。";
  function bibleBlock(fic) {
    const rows = (fic && Array.isArray(fic.bible) ? fic.bible : []).map(function (x) { return String(x || "").trim(); }).filter(Boolean);
    if (!rows.length) return "";
    return "【本篇设定卡（前面几章已经确立的事实 · 一条都不许推翻）】\n"
      + rows.map(function (x, i) { return (i + 1) + ". " + x; }).join("\n")
      + "\n这一份比你记忆里的前情更权威：对不上的时候一律以它为准。\n";
  }
  function seedBlock(fic) {
    const rows = (fic && Array.isArray(fic.seeds) ? fic.seeds : []).map(function (x) { return String(x || "").trim(); }).filter(Boolean);
    if (!rows.length) return "";
    // ⚠️「不必这一章收」这句不许省：不写它，它每章都会强行回收一条，变成填格子
    return "【还埋着没收的伏笔】\n" + rows.map(function (x) { return "· " + x; }).join("\n")
      + "\n**不必这一章就收**——它们摆在这儿只是别让你忘了。"
      + "真收了哪一条，在 paid 里把那一条原样抄回来；这一章又埋了新的，就写进 seed。\n";
  }
  // 把这一章交上来的 facts / seed / paid 合进这篇文。纯函数，好测。
  // ⚠️设定卡只增不改：改了就等于允许后面的章推翻前面的，那正是要防的事。
  function applyChapterMeta(fic, out) {
    const f = fic || {};
    const bible = (Array.isArray(f.bible) ? f.bible : []).slice();
    (Array.isArray(out && out.facts) ? out.facts : []).forEach(function (x) {
      const t = String(x || "").trim().slice(0, 90);
      if (t && bible.indexOf(t) < 0 && bible.length < BIBLE_CAP) bible.push(t);
    });
    const paid = (Array.isArray(out && out.paid) ? out.paid : []).map(function (x) { return String(x || "").trim(); }).filter(Boolean);
    let seeds = (Array.isArray(f.seeds) ? f.seeds : []).map(function (x) { return String(x || "").trim(); }).filter(Boolean)
      .filter(function (x) { return !paid.some(function (p) { return p === x || x.indexOf(p) >= 0 || p.indexOf(x) >= 0; }); });
    const sd = String((out && out.seed) || "").trim().slice(0, 90);
    if (sd && seeds.indexOf(sd) < 0) seeds.push(sd);
    return { bible: bible, seeds: seeds.slice(-SEED_CAP) };
  }

  // ---- 追更：append 一章（续写 = 前情摘要 + 上一章 endHook，不塞全文）----
  // opts: { style, perFic, chatMaterial }
  async function genNextChapter(active, fic, tab, cpChars, userName, worldbook, opts) {
    opts = opts || {};
    const perFic = clampPerFic(opts.perFic);
    // 字数地板只此一份（minCharsFor）：提示词里发的、写完数的、界面上提示的是同一个数
    const minWords = minCharsFor({ perFic: opts.perFic, minChars: opts.minChars });
    const chapters = fic.chapters || [];
    const last = chapters[chapters.length - 1] || {};
    // 前情压缩摘要：标题 + tags + 每章 endHook 串起来（不塞全文，省 token）
    // ⚠️只发最近 HOOK_TAIL 章。原来是整串——二十章之后它自己占掉一大块，
    //   而越老的锚点越没用（「结束在哪儿」这件事过了十章就不重要了）。
    //   远期靠【设定卡】撑：那才是「这篇文里有什么」，锚点只管「上一段停在哪儿」。
    const hookFrom = Math.max(0, chapters.length - HOOK_TAIL);
    const priorHooks = chapters.slice(hookFrom).map(function (c, i) {
      return "第" + (hookFrom + i + 1) + "章结束在：" + (c.endHook || "（无锚点）");
    }).join("\n");
    const cotChar = (cpChars && cpChars[0] && cpChars[0].name) || (fic.title || "主角");
    const cotT = (typeof cotThink === "function") ? cotThink({ char: cotChar, user: userName }, "fanfic") : "";
    // 上一章结尾原文（最后一段现场）：只给锚点一句话时模型爱跳时间线（上一章还暧昧、下一章直接事后）
    const lastTail = String(last.content || fic.body || "").trim().slice(-600);
    // 基本设定锚（v47.78 她点名修「第一章前未婚夫妻、第二章变青梅竹马」）：
    // 优先用生成时自报的 premise；老文没有就拿第一章开头当设定依据
    const premise = (fic.premise && String(fic.premise).trim()) || "";
    const ch1Head = String(((chapters[0] || {}).content || fic.body || "")).trim().slice(0, 500);
    // 这一章由谁执笔（她 2026-09-06：「生成文有作者是有参考她的文风和雷点的吧？续写也要」）。
    // 点了枪手就是那一位；没点就是【这篇文原来那位太太】——她自己的连载，
    // 本来就该她接着写，那才是「随缘」的正确默认值，不是换个人来。
    // ⚠️名册里查不到那个笔名（老文、手写的）时返回 null，这一段就不发，不会出错。
    // 抢笔：她点了枪手，但原作者看不下去了——这一章由原作者自己写（调用点掷的，这儿只认这个旗子）
    const grabbed = !!opts.grabbed;
    // 第三类笔：她自己的人。抢笔只发生在太太之间——角色写的那一章，原作者照样会在底下说话，
    // 所以 byChar 也算 ghost（不然她连一句反应都收不到）。
    const byChar = (!grabbed && opts.byChar && opts.byChar.id) ? opts.byChar : null;
    const penBy = grabbed ? (findAuthor(fic.author) || opts.author || null)
      : (byChar ? null : ((opts.author && authorName(opts.author)) ? opts.author : findAuthor(fic.author)));
    const penName = authorName(penBy);
    const ghost = !grabbed && (!!byChar || (penName && authorName(opts.author) && penName !== String(fic.author || "").trim()));
    const charBlock = byChar ? charWriterBlock(byChar, fic, opts.charRel, opts.writerAxes, opts.nameOf, userName) : "";
    const byBlock = charBlock ? charBlock : (penBy && authorVoiceLines(penBy) ?
      "\n【这一章由谁执笔】" + (ghost ? "笔名「" + penName + "」——她是被请来接这篇的（原作者是「" + (fic.author || "无名") + "」）。" : "笔名「" + penName + "」，这篇文本来就是她写的。") + "\n"
      + authorVoiceLines(penBy)
      + (grabbed ? "· ⚠️这一章本来说好是请别人接的，可你看不下去，**把笔抢回来自己写**。"
        + "为什么抢、抢得多理直气壮，照你自己的脾气来；别在正文里对读者解释这件事，正文还是正文。\n" : "")
      + ((ghost && !byChar && opts.lazy) ? ghostLazyBlock(String(fic.author || "").trim()) : "")
      + (ghost ? (byChar ? "" : circleLines(penName, String(fic.author || "").trim(), { sameCP: !!opts.sameCP }))
        + "· 接手不是重写：上面那些设定与前情一个字不许改，只是这一章的笔是她的。\n"
        // ⚠️「设定不许改」和「要看得出是她写的」会打架，而打架时模型倾向于保文风、丢设定
        //   ——文风是它刚读到的、最像指令的那段（four-surfaces-same-context 里 v55.91 那条：
        //   料给够了还是崩，因为站位错了）。所以要当面把这两件事分开。
        + "· **她的路数只管【怎么写】，不管【写什么】。**句子长短、力气花在哪儿、故意不写什么，照她来；"
        + "人物是谁、发生过什么、这篇往哪儿走，照设定卡和前情来，一个字不许因为「她会这么写」而改掉。\n" : "")
      : "");
    const sys = buildGenSystem(tab, cpChars, userName, worldbook, ficOpts(fic, opts)) + "\n\n" +
      "【当前任务：给一篇已在连载的同人文续写下一章】\n" + byBlock +
      "篇名《" + fic.title + "》，标签：" + (fic.tags || []).join("、") + "。\n" +
      "【本篇基本设定（地基·每一章都不许动）】\n" + (premise ? premise + "\n" : "") + (ch1Head ? "第一章开头（设定以此为准）：" + ch1Head + "……\n" : "") +
      "【改设禁令（比剧情更优先）】第一章确立的东西一个字不许变：两人的关系设定（开篇是前未婚夫妻就全程是前未婚夫妻，绝不许写成青梅竹马/前同事/初次见面）、双方身份职业、称呼、世界观、已发生的事实和时间线；tags 里的关系标签同样是铁律。写之前先对着上面的基本设定自查一遍，若你记忆中的前情与第一章开头冲突，一律以第一章开头为准。\n" +
      bibleBlock(fic) +
      "【前情摘要（最近几章的锚点，不含全文，你据此自然接续、保持人物与线索一致）】\n" + (priorHooks || "（这是第一章）") + "\n" +
      (lastTail ? "【上一章结尾原文（新章从这个现场往下写）】\n……" + lastTail + "\n" : "") +
      "【上一章的结尾锚点】\n" + (last.endHook || "（无，请自然开新章）") + "\n" +
      "【衔接与进度铁律（比字数更重要）】\n" +
      "· 新章开头必须与上面结尾原文【无缝衔接】：同一时间线自然往下走；确需转场，先用一两句交代过渡（过了几日／次日清晨），不许没头没尾直接跳到全新处境。\n" +
      "· 两人的感情与亲密进度只能【小步推进】：先判断上一章结束时处在什么阶段（暧昧、试探、刚点破、热恋…），这一章至多往前走一小步——绝不允许上一章还在暧昧、这一章开场就已发生关系或直接写事后；要到那一步，必须在章内写足完整的过程与铺垫。\n" +
      "· 中间若有时间跳跃，跳过的事只能是无关紧要的日常，关键情节（表白、第一次亲密、重大冲突）必须写出来，不许发生在幕后。\n" +
      // ⚠️字数在这儿先说一遍。原来它只写在最后那行 JSON schema 里，
      //   前面压着前情、改设禁令、衔接铁律一大堆，最容易被冲掉（她 2026-09-11 报「续写老是偷懒」）。
      "· **这一章至少写 " + minWords + " 字**。这是硬指标，不是参考值：写到了再收尾，别写个开头就交。\n" +
      seedBlock(fic) +
      wantBlock(opts.want, opts.hardWant, ghost) +
      (byChar ? roomTalkBlock(opts.roomTalk, userName, byChar.remark || byChar.name) : "") +
      ((ghost || grabbed) ? "\n" + authorStanceFacts(fic, {
        hardWant: opts.hardWant,
        ghostName: byChar ? "" : (ghost ? penName : (opts.author && authorName(opts.author)) || ""),
        outsider: byChar ? ((byChar.remark || byChar.name) + "——不是圈子里的人，是这篇文里那个人本人") : ""
      }) : "") + "\n" +
      (typeof cotSystemBlock === "function" ? cotSystemBlock(cotT) : "") +
      "【输出】只输出一个合法 JSON 对象，无 markdown：\n" +
      // ⚠️字段顺序＝生成顺序，而**截断永远从队尾开始**。
      //   她 2026-09-11 报「请枪手最后没有原作者的感想」——authorNote 原来排在最后一个，
      //   正文一长、尾巴被切掉，这一栏就第一个没了。挪到正文和锚点后面、设定卡那几栏前面：
      //   既是「刚读完就说一句」的自然顺序，也让它活过截断。
      "{\"content\":\"这一章正文（成篇散文，承接上一章锚点往下推进、有实质剧情进展，**至少 " + minWords + " 字**，分段用\\n\\n）\","
      + "\"endHook\":\"本章新的结尾锚点，供再下一章接续\","
      + ((ghost || grabbed) ? "\"authorNote\":\"原作者看完这一章，在评论区底下留的那一句话\"," : "")
      // ⚠️authorNote 是【原作者】的话，不是执笔人的。可 roomTalkBlock 一直叫他
      //   「在 authorNote 里当面跟她说一句」，房里那张卡也拿 authorNote 当他说的话——
      //   于是他交稿那一句其实是另一个人的口气（她 2026-09-11：「写的跟作者一个味」
      //   有一半是从这儿来的）。所以他自己那句另开一格。
      + (byChar ? "\"penNote\":\"你把这一章交给她的时候，顺口说的那一句（你本人的口气，不是作者的；没什么可说就空字符串）\"," : "")
      + "\"facts\":[\"这一章新确立的事实，0-3 条，没有就空数组\"],"
      + "\"seed\":\"这一章新埋下、还没回收的那样东西，一句话；没埋就空字符串\","
      + "\"paid\":[\"这一章回收掉的伏笔，把上面那一条原样抄回来；没收就空数组\"]}\n"
      + ((ghost || grabbed) ? authorNoteAsk(fic, ghost ? penName : "", !!opts.quitting) + "\n" : "") + BIBLE_WHAT +
      (opts.style && opts.style.trim() ? fanficStyleTail(opts.style) : FANFIC_ANTI_CLICHE_TAIL)
      // ⚠️最后一句话归执笔的那个人（病历见 charVoiceTail 上面那段）。
      + (byChar ? charVoiceTail(byChar, opts.style) : "");
    const userMsg = "续写《" + fic.title + "》的下一章，至少 " + minWords + " 字。\n\n〔幕后提醒：本章的开头方式、句式节奏、意象和高频小动作【不许和前几章雷同】——连载越往后越容易一套模板，这章刻意换写法；反陈词滥调清单全程生效" + (cotT ? "；先交创作小稿再写正文" : "") + "。〕";
    // 从坏掉/被截断的 JSON 里抢救章节正文（长章节 JSON 常被截断解析失败，之前直接判「返回为空」白烧一次钱）
    // ⚠️这条救援路要跟正路**一样全**。她 2026-09-11 报「请枪手最后没有原作者的感想」，
    //   一半原因在这儿：v66.77~79 给正路加了 authorNote / facts / seed / paid，
    //   救援这条一个都没跟上——而长章被截断走的正是救援。
    //   又一次「一层写在两处，第二处没跟上」（施工规则/four-surfaces-same-context.md）。
    function salvageChapter(clean, cot) {
      const s = String(clean || "");
      const unesc = x => String(x || "").replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\").trim();
      const m = s.match(/"content"\s*:\s*"([\s\S]*?)(?:"\s*,\s*"(?:endHook|authorNote|penNote|facts|seed|paid)"|"\s*\}\s*$|$)/);
      if (!m || !m[1] || m[1].length < 200) return null; // 太短不算章节，宁可重试
      const one = k => { const x = s.match(new RegExp('"' + k + '"\\s*:\\s*"([\\s\\S]{1,300}?)"')); return x ? unesc(x[1]).replace(/\n/g, " ") : ""; };
      const list = k => {
        const x = s.match(new RegExp('"' + k + '"\\s*:\\s*\\[([\\s\\S]{0,600}?)\\]'));
        if (!x) return [];
        return (x[1].match(/"([\s\S]*?)"/g) || []).map(y => unesc(y.slice(1, -1))).filter(Boolean);
      };
      return { content: unesc(m[1]), endHook: one("endHook"), authorNote: one("authorNote").slice(0, 300),
        penNote: one("penNote").slice(0, 300),
        facts: list("facts"), seed: one("seed"), paid: list("paid"), cot: cot || null };
    }
    // 思考型模型预算别抠（占 maxTokens），太紧就返回空；解析失败先抢救正文、再不行才重试一次
    async function once(extra) {
      // ⚠️天花板要跟着地板走：她把最少字数调到 5000 字，而天花板还按 perFic 算，
      //   就会写到一半被截断——那才是真多花一次调用（施工规则/max-tokens-floor.md）。
      const raw = await callAI(active, sys + (extra || ""), [{ role: "user", content: userMsg }],
        { maxTokens: Math.min(FIC_TOKEN_MAX * 2, Math.max(perFic, minWords * 2) + 12000), timeout: 300000 });
      const sp = (typeof splitCot === "function") ? splitCot(raw, !!cotT) : { cot: null, clean: raw };
      const d = parseJSONLoose(sp.clean);
      if (d && d.content) return { content: String(d.content).trim(), endHook: String(d.endHook || "").trim(),
        facts: Array.isArray(d.facts) ? d.facts : [], seed: String(d.seed || "").trim(), paid: Array.isArray(d.paid) ? d.paid : [],
        authorNote: String(d.authorNote || "").trim().slice(0, 300),
        penNote: String(d.penNote || "").trim().slice(0, 300),
        cot: sp.cot, cotRequested: !!cotT };
      return salvageChapter(sp.clean, sp.cot);
    }
    let out = await once("");
    if (!out) out = await once("\n\n（上一次输出为空或没能解析成合法 JSON，请务必严格只输出那一个 JSON 对象、正文写满，别加任何解释文字。）");
    if (!out) throw new Error("续写失败：模型返回为空，可再点一次重试");
    out.cotRequested = !!cotT;
    return out;
  }

  // ---- 「让他接着写」：她按了才发的那第二枪（她 2026-09-11）----
  // ⚠️**不许自动调用**。她定的规矩：「以后任何东西都不接受一次发两遍」。
  //   所以短了只在章顶留一行小字 + 一颗键，按不按是她的事。
  // ⚠️也不是重写：重写是掷骰子（可能更短），接着写是必然变长，
  //   而且顺带把「JSON 被截断写到一半」那种也救回来了。
  async function genChapterMore(active, fic, tab, cpChars, userName, worldbook, opts, chapIdx) {
    opts = opts || {};
    const chapters = fic.chapters || [];
    const i = Math.max(0, Math.min(chapters.length - 1, Number(chapIdx)));
    const ch = chapters[i] || {};
    const have = String(ch.content || "").trim();
    if (!have) throw new Error("这一章还没有正文");
    const minWords = minCharsFor({ perFic: opts.perFic, minChars: opts.minChars });
    const missing = shortBy(have, minWords);
    const penBy = (opts.author && authorName(opts.author)) ? opts.author : findAuthor(ch.byAuthor || fic.author);
    const sys = buildGenSystem(tab, cpChars, userName, worldbook, ficOpts(fic, opts)) + "\n\n" +
      "【当前任务：把一章没写完的正文接着写完】\n" +
      (penBy && authorVoiceLines(penBy) ? "【这一章的笔在谁手上】笔名「" + authorName(penBy) + "」\n" + authorVoiceLines(penBy) : "") +
      "篇名《" + fic.title + "》第 " + (i + 1) + " 章。\n" +
      bibleBlock(fic) +
      "【已经写出来的部分 · 结尾原文】\n……" + have.slice(-900) + "\n" +
      "【怎么接】从上面最后一个字**往下接着写**。\n" +
      "· 绝不许重述已经写过的内容，也不许换个说法把刚才那段重来一遍——那是接着写，不是重写。\n" +
      "· 也不要写「（续）」「接上文」这类招呼，直接就是下一句。\n" +
      "· 这一章现在 " + countChars(have) + " 字，还差大约 " + Math.max(200, missing) + " 字才够。写到够、把这一章真正收完再停。\n" +
      "· 这一段写完，这一章就算完了：结尾要收得住，并给出新的 endHook。\n\n" +
      "【输出】只输出一个合法 JSON 对象，无 markdown：\n" +
      "{\"add\":\"接着往下写的正文（分段用\\n\\n）\",\"endHook\":\"这一章现在的结尾锚点\","
      + "\"facts\":[\"这一段新确立的事实，0-3 条，没有就空数组\"],"
      + "\"seed\":\"这一段新埋下、还没回收的那样东西，一句话；没埋就空字符串\","
      + "\"paid\":[\"这一段回收掉的伏笔，原样抄回来；没收就空数组\"]}\n" + BIBLE_WHAT +
      (opts.style && opts.style.trim() ? fanficStyleTail(opts.style) : FANFIC_ANTI_CLICHE_TAIL);
    const raw = await callAI(active, sys, [{ role: "user", content: "接着把这一章写完，至少再写 " + Math.max(200, missing) + " 字。" }],
      { maxTokens: Math.min(FIC_TOKEN_MAX * 2, Math.max(clampPerFic(opts.perFic), minWords * 2) + 12000), timeout: 300000 });
    const d = parseJSONLoose(raw);
    let add = d && d.add ? String(d.add).trim() : "";
    if (!add) {
      // 救一把：正文在，只是 JSON 没收好
      const m = String(raw || "").match(/"add"\s*:\s*"([\s\S]*?)(?:"\s*,\s*"endHook"|"\s*\}\s*$|$)/);
      if (m && m[1] && m[1].length > 100) add = m[1].replace(/\\n/g, "\n").replace(/\\"/g, '"').trim();
    }
    if (!add) throw new Error("没接出东西来。他回的是：\n" + String(raw || "").replace(/\s+/g, " ").trim().slice(0, 200));
    return {
      add: add, endHook: String((d && d.endHook) || ch.endHook || "").trim(),
      facts: Array.isArray(d && d.facts) ? d.facts : [], seed: String((d && d.seed) || "").trim(),
      paid: Array.isArray(d && d.paid) ? d.paid : []
    };
  }

  // ---- 「去请她回来」：太太撂挑子之后唯一的一条路 ----
  // ⚠️**成不成由代码定、话由模型写**（ok 是调用点掷好再传进来的）。
  //   让模型自己决定答不答应，它十次有九次会答应——那这道门就等于没有。
  // 能翻脸就得能和好：不然作者库单向枯竭，攒三十位太太最后一个都不肯写。
  async function genAuthorBack(active, fic, tab, cpChars, userName, worldbook, opts, ok) {
    opts = opts || {};
    const own = String(fic.author || "").trim();
    const by = findAuthor(own);
    const sys = buildGenSystem(tab, cpChars, userName, worldbook, ficOpts(fic, opts)) + "\n\n" +
      "【当前任务：写一句话】你是同人圈里的太太，笔名「" + (own || "无名") + "」。\n" +
      (by && authorVoiceLines(by) ? authorVoiceLines(by) : "") +
      "你之前放话不写《" + fic.title + "》这篇了" + (fic.quitSay ? "（你当时说的是：「" + String(fic.quitSay).slice(0, 120) + "」）" : "") + "。\n" +
      authorStanceFacts(fic, {}) +
      "现在有个读者来私信求你回来接着写。\n" +
      (ok ? "【这一次你答应了】但答应得像不像样、有没有条件、要不要先阴阳两句，照你自己的脾气来——别写成一句客气的场面话。\n"
          : "【这一次你没答应】怎么回绝、说得软还是硬、给不给台阶，照你自己的脾气来。\n") +
      "【输出】只输出一个合法 JSON 对象，无 markdown：\n{\"say\":\"你回的那段话（一两句，就是你打字发出去的样子）\"}" +
      (opts.style && opts.style.trim() ? fanficStyleTail(opts.style) : FANFIC_ANTI_CLICHE_TAIL);
    const raw = await callAI(active, sys, [{ role: "user", content: "回一句。" }], { maxTokens: 12000 });
    const d = parseJSONLoose(raw);
    const say = String((d && d.say) || "").trim();
    if (!say) throw new Error("她没回话。这一枪回的是：\n" + String(raw || "").replace(/\s+/g, " ").trim().slice(0, 180));
    return { ok: !!ok, say: say.slice(0, 300) };
  }

  // ── 圈里的太太也下场（她 2026-09-11：「让圈子里的作者们也有机会书评刷出来吧，
  //    但是也要注意他们的 cp 立场」）────────────────────────────────────
  // ⚠️代码定【谁来、什么立场】，模型定【她说什么】。立场不用新存一栏，现算：
  //   · 写过文的：按她【真写过】的那一对算（authorCPStats 的头一条）；
  //   · 一篇没写过的：按笔名从【她配好的那几对】里定死一对当本命——
  //     稳定（下次还是这一对）、不花枪。新请来的八位不该等写了文才有性格。
  const CRITIC_MAX = 2;
  function authorShipKey(name, fics, characters, userName) {
    const st = authorCPStats(name, fics, characters, userName) || [];
    const real = st.filter(function (x) { return x.key !== "_none"; })[0];
    if (real) return real.key;
    const cps = loadCPs().map(function (c) { return (Array.isArray(c) ? c : (c && c.cp)) || []; })
      .filter(function (a) { return a.length >= 2; });
    if (!cps.length) return "";
    const pick = Axes.pick(cps, "ship:" + name);
    return pick ? pick.slice().sort().join("|") : "";
  }
  // same=同好；rival=对家（磕的是拆了这一对的另一对，共用其中一个人）；
  // feud=跟本篇作者有旧账；far=不沾边
  function criticStance(name, fic, fics, characters, userName, circle) {
    const own = String((fic && fic.author) || "").trim();
    if (own && circleFeud(own, name, circle)) return "feud";
    const mine = ((fic && fic.cp) || []).slice().sort().join("|");
    const key = authorShipKey(name, fics, characters, userName);
    if (!mine || !key) return "far";
    if (key === mine) return "same";
    const a = key.split("|"), b = mine.split("|");
    return a.some(function (x) { return x && b.indexOf(x) >= 0; }) ? "rival" : "far";
  }
  // ⚠️封顶 2 位：太太满地走，「圈里的太太」就不值钱了。多数篇 0-1 位。
  // ⚠️不沾边的那几位多半不来——她说的「注意 cp 立场」就是这一条。
  function rosterCritics(fic, nonce, opts) {
    const o = opts || {};
    const fics = o.fics || loadFics(), circle = o.circle || loadCircle();
    const own = String((fic && fic.author) || "").trim();
    const pool = (o.authors || loadAuthors()).map(function (a) { return authorName(a); })
      .filter(function (n) { return n && n !== own; })
      .map(function (n) { return { name: n, stance: criticStance(n, fic, fics, o.characters, o.userName, circle) }; });
    if (!pool.length) return [];
    const r = Axes.seed01(nonce, "criticN");
    let want = r < 0.45 ? 0 : (r < 0.85 ? 1 : CRITIC_MAX);
    if (!want) return [];
    const likely = pool.filter(function (x) { return x.stance !== "far"; });
    // 不沾边的只有一成半的机会露面，而且只在没人跟这篇有关系的时候
    const from = likely.length ? likely : (Axes.seed01(nonce, "farIn") < 0.15 ? pool : []);
    if (!from.length) return [];
    const order = from.map(function (x, i) { return { x: x, r: Axes.seed01(nonce, "who", x.name, i) }; })
      .sort(function (p, q2) { return p.r - q2.r; }).map(function (p) { return p.x; });
    return order.slice(0, Math.min(want, CRITIC_MAX));
  }
  // 拼给模型看。⚠️**只给立场和她的卡，不给判语**——写「她会阴阳你」等于替她演完了。
  function criticBlock(critics, fic, opts) {
    if (!critics || !critics.length) return "";
    const o = opts || {};
    const own = String((fic && fic.author) || "").trim();
    const zh = { same: "跟这一篇磕的是同一对", rival: "她磕的是【拆了这一对】的另一对（共用其中一个人）",
      feud: "跟这篇作者有旧账", far: "跟这一篇不沾边，纯路过" };
    const rows = critics.map(function (c) {
      const a = findAuthor(c.name) || {};
      const lines = (c.stance === "feud" && own) ? circleLines(c.name, own, { list: o.circle }) : "";
      return "· 「" + c.name + "」"
        + (a.style ? "——路数：" + String(a.style).slice(0, 60) : "")
        + (a.sore ? "；碰不得：" + String(a.sore).slice(0, 40) : "")
        + "。立场：" + (zh[c.stance] || zh.far)
        + (lines ? "\n  旧账：" + lines.replace(/\n/g, "；") : "");
    });
    return "\n\n【圈子里这几位也来了】她们是这个圈子的常驻太太，看完这一篇各自留了一条：\n"
      + rows.join("\n")
      + "\n⚠️这几条必须署上面这几个笔名，**一位一条，不许多、不许少，也不许现编别的太太**。\n"
      + "⚠️她们不是来捧场的，立场是什么就写什么：\n"
      + "· 同好是自己人：催更、玩梗、补刀、点出只有同好才看得见的那一处。\n"
      + "· 对家：可以阴阳、可以冷、可以「不是我的菜，但笔力是有的」——"
      + "⚠️**不许人身攻击、不许骂人**。同人圈的对家就是这个火候，撕起来反而假。\n"
      + "· 有过节的：上面写着旧账，那一条冲的是人，不是文。\n"
      + "· 要是这一篇正好动到了她「碰不得」的那一点，她那条就冲那一点去；没动到就别硬扯。\n"
      + "⚠️也不是每位来都为了夸。\n"
      + "【这几条要标出来】她们那几条各加一个 \"pen\"：\"她的笔名\"；"
      + "其中带刺的（阴阳、冷嘲、挑刺、翻旧账）再加 \"barbed\":true。别的读者那几条不要加这两栏。\n";
  }

  // ---- 书评：一次生成 N 条（NPC 泛读者 + 作者至少下场一次）------------
  async function genReviews(active, fic, tab, worldbook, characters, userName) {
    const excerpt = ((fic.chapters || [])[0] || {}).content || fic.body || "";
    const authorName = fic.author || ficPenName(fic.id);
    // ⚠️她 2026-09-11：「上一轮书评他们也都觉得皇帝和王爷不是 cp，写的是王爷和精怪」
    //   「tag 他们也看不到也是编的」。查下来读者说的是实话——**这一枪根本没告诉他们这篇挂的是谁**：
    //   进去的只有正文节选和几个题材标签，CP 那一栏（她自己点的那一对）一个字都没发。
    //   现在把它发过去。⚠️顺带让这件事变成一根探针：正文跟挂的 CP 对不上时，
    //   读者会像在站子上看到挂错 tag 那样直说——**她一眼就能看见这一篇写跑了**。
    //   ⚠️给出口：对得上就别提这件事，不然每条书评都在挑标签。
    const critics = rosterCritics(fic, uid("rv") + Math.random(), { characters: characters, userName: userName });
    const cpTxt = (fic.cp && fic.cp.length) ? cpLabel(fic.cp, characters || [], userName) : "";
    const wayTxt = String(fic.groupWay || "").trim();
    const cpLine = cpTxt
      ? "这一篇挂的是【" + cpTxt + "】" + (wayTxt ? "（" + wayTxt + "）" : "") + "。"
        + "⚠️他们看的是【正文】：正文写的跟挂的这一对对不上时，读者会直说——"
        + "就像在站子上看到一篇挂错 tag 的文（「说好的谁和谁呢」）。对得上就一个字都别提这件事。\n"
      : "";
    const sys = ANTI_CLICHE + "\n\n" + READER_VOICE + "\n\n" +
      "他们刚读完一篇发在【" + tab.name + "】同人版、作者笔名「" + authorName + "」的同人文《" + fic.title + "》（标签：" + (fic.tags || []).join("、") + "）。" + cpLine +
      "下面是正文节选，据此写具体的书评/短评（可夸可挑刺可玩梗可催更），别泛泛，别剧透式复述剧情。\n" +
      "【正文节选】\n" + String(excerpt).slice(0, 1200) + criticBlock(critics, fic) + "\n\n" +
      "【输出】只输出合法 JSON 数组，5-8 条书评：\n" +
      "[{\"author\":\"读者马甲（同人圈网名，别用真名，别带@）\",\"content\":\"书评正文\",\"replies\":[{\"author\":\"另一读者马甲\",\"content\":\"楼中楼回复\",\"isAuthor\":false}]}]\n" +
      "**其中必须至少有一条**（某条书评本身、或某条楼中楼回复）是作者「" + authorName + "」本人下场回复读者的——署名就写「" + authorName + "」、把那条的 isAuthor 设为 true，像作者回评那样（道谢/回应读者的梗/害羞解释/回怼黑评，符合太太本人语气）。其余 replies 大多留空，只 1-2 条带楼中楼。语气各异别雷同。";
    const raw = await callAI(active, sys, [{ role: "user", content: "给《" + fic.title + "》写书评，记得作者「" + authorName + "」要下场至少回一句。" }], { maxTokens: 11200 });
    const d = parseJSONLoose(raw);
    const arr = Array.isArray(d) ? d : (d && Array.isArray(d.items) ? d.items : []);
    // 名册里那几位：只认【真在名册里】的笔名，模型现编的一律当普通读者
    const roster = {};
    critics.forEach(function (c) { roster[c.name] = 1; });
    const own = String(fic.author || "").trim();
    return arr.filter(function (x) { return x && x.content; }).slice(0, 10).map(function (x) {
      const nm = String(x.author || "").trim();
      const pen = String(x.pen || "").trim();
      // ⚠️原来非得【模型自己多填一格 pen、而且跟 author 写得一字不差】才算数，
      //   漏填一次、写岔一个字，这位太太的名字就点不进她的主页了
      //   （她 2026-09-11：「其他作者路过点不进她主页」）。
      //   认哪一位不该指望模型：**名字本身就在名册/作者库里，直接查。**
      //   有卡＝有主页，这才是「点不点得进去」的真判据。
      const who = (pen && roster[pen]) ? pen : ((roster[nm] || findAuthor(nm)) ? nm : "");
      const fromRoster = !!(pen && roster[pen] && nm === pen) || !!roster[nm];
      // ⚠️只记带刺的那几条（她 2026-09-11 定的）：夸的不记，不然这本账会被评论淹掉
      if (fromRoster && x.barbed && own) {
        circlePush({ a: pen, b: own, kind: "snark", title: fic.title, say: String(x.content).trim().slice(0, 60) });
      }
      return {
        id: uid("rv"),
        author: String(x.author || "路人读者").slice(0, 20),
        pen: who,
        isAuthor: !!x.isAuthor || String(x.author || "") === authorName,
        content: String(x.content).trim(),
        replies: Array.isArray(x.replies) ? x.replies.filter(function (r) { return r && r.content; }).slice(0, 4).map(function (r) {
          // 回复里那一层同样要点得进去——一层写在两处，少写一处就是「楼主点得进、楼中楼点不进」
          const rn = String(r.author || "路人读者").slice(0, 20);
          return { id: uid("rp"), author: rn, pen: (roster[rn] || findAuthor(rn)) ? rn : "", isAuthor: !!r.isAuthor || String(r.author || "") === authorName, content: String(r.content).trim() };
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
    const d = parseJSONLoose(raw);
    const arr = Array.isArray(d) ? d : (d && Array.isArray(d.items) ? d.items : []);
    return arr.filter(function (x) { return x && x.content; }).slice(0, 5).map(function (x) {
      return { id: uid("rp"), author: String(x.author || "路人读者").slice(0, 20), isAuthor: !!x.isAuthor || String(x.author || "") === authorName, content: String(x.content).trim() };
    });
  }

  // ============================================================
  // 加笔（互动叙事 RP 引擎）—— 玩家穿进一篇收藏的同人文，AI 抛决策点
  // ⚠️**「穿书」＝这个功能的旧名**（v62.50 改玩法时一起改的名，界面上早就是「加笔」）。
  //   下面注释里那些「v61.16 穿书那次」是**病历**：事故发生的时候它就叫穿书，
  //   改掉病历会让它跟版本号对不上，所以原样留着。
  //   界面、手册、提示词里一律写「加笔」；变量名 rp*／stepin 是内部名，不动。、玩家自由输入行动
  // ⚠️存储键 x_fanfic_rp 和 mode key 不跟着改名——那是存档，改了旧档就读不出来了
  // ============================================================
  const K_RP = "x_fanfic_rp"; // 存档数组
  function loadRP() { return loadJSON(K_RP, []); }
  // 📚 累积层：存档留最近 30 局（施工规则/phone-data-layers.md）。
  // 每局带整份 transcript，不封顶就是又一座坟场。
  const RP_KEEP = 30;
  function saveRP(list) {
    _rpFicIds = null;              // 名单变了，清理闸那份缓存跟着作废
    const a = Array.isArray(list) ? list : [];
    saveJSON(K_RP, a.length <= RP_KEEP ? a
      : a.slice().sort(function (x, y) {
        // ⚠️存档里没有 ts，只有 createdAt/updatedAt。写 ts 的话这个排序全是 0−0，
        // 静默空转，留下哪 30 局全看数组本来什么顺序。
        return (y.updatedAt || y.createdAt || 0) - (x.updatedAt || x.createdAt || 0);
      }).slice(0, RP_KEEP));
  }
  // ⚠️**加笔没有「魂穿」这回事**（她 2026-09-11：「加笔本来就不应该有魂穿这种东西，
  //   那是以前的玩法现在应该删掉了」）。上一代的玩法是先挑一个模式——魂穿 CP 左位／
  //   右位、天降路人、天降随机——再顶着那个人的壳把他演一遍。
  //   v62.50 换掉整个循环之后，这一页玩的已经是【在她写好的文上动笔】：
  //   一段段读原文，读到哪一句伸手，后面就从那儿改道。**动笔的人是她自己**，
  //   不是谁的替身。所以 RP_MODES／rpModeShort／rpModeLabel／rpPlayerName／rpOther／
  //   rpRoleDesc／天降身份那一枪（genRPIdentity）整套删掉——不是留着不发。
  //   ⚠️老存档里的 mode／playerIdentity／landing 一个字都没动，只是不再被读：
  //   删掉一个玩法不许连带动她写过的字。
  // 动笔的那个人叫什么：她的名字；没填就退回「你」，别在提示词里留一个空引号。
  function rpMeName(userName) { return String(userName || "").trim() || "你"; }

  // 【只剩老存档在读】v63.92 起选单里不再问「你带着什么进去」（她 2026-09-05：
  //   「去掉那个选身份和记忆，就直接进去改文」）。这几样留着是因为【已经开着的那几局】
  //   存档里写着 know，删了它们那几局的 system 会当场变一副样子——撤掉一道选择不该
  //   反过来改掉正在玩的局。新局一律不带这一栏（等于 blank，一个字都不发）。
  // 你带着什么进去。⚠️「带着现实的记忆」不是去翻主线记忆库——同人文是平行时空沙盒
  // （施工规则/four-surfaces-same-context.md 里那条合法差异），这一档只是给这场戏
  // 一个前提：你记得，这个世界里的他不记得。落差本身就是戏，不需要真去读记忆。
  const RP_KNOWS = [
    { key: "blank", label: "空手进去", short: "空手", desc: "你对这个故事一无所知，跟里面的人一样两眼一抹黑，只能边走边猜。" },
    { key: "spoiler", label: "带着剧透", short: "带剧透", desc: "你读完过这篇文，知道后面会发生什么、谁会说哪句话、哪一步是坑。你可以顺着走，也可以提前去拆它。" },
    // ⚠️说明不许写死成「你和 TA 的关系」：这篇的 CP 可能是【两个角色】，她根本不在里面
    //   （她 2026-09-03：「同人文确实能写两个角色之间的，所以不一定是我自己」）。
    //   写成「现实里的他们」，CP 里有没有她都说得通。
    { key: "real", label: "带着现实里的记忆", short: "带记忆", desc: "你记得现实里的他们——可这个世界里，没有人认识你。" }
  ];
  function rpKnowLabel(key) { const k = RP_KNOWS.find(function (x) { return x.key === key; }); return k ? k.short : ""; }
  function rpKnowLine(know, cpChars, userName) {
    const k = RP_KNOWS.find(function (x) { return x.key === know; });
    if (!k || k.key === "blank") return "";   // 老存档没有这一栏：不发，保持原来的样子
    if (k.key === "spoiler") {
      return "【玩家带进去的东西 · 剧透】" + k.desc
        + "\n所以：玩家可能会做出【只有读过这篇文的人才做得出】的举动——提前挡在某个人前面、把某句话抢在他之前说、绕开原著里那个坑。"
        + "你要如实承接这种「他怎么会知道」的怪异感：场上的人不知道玩家为什么这么笃定，他们会觉得奇怪、会追问、会起疑。"
        + "但**你不许替玩家把剧透说出来**，也不许在正文里提示「按原著接下来会……」——玩家知道什么、用不用，是玩家自己的事。";
    }
    // 现实里的记忆这一档，分两种局面写——上一版只写了「你和 TA 的关系」，
    // 那是把「CP 一定有她」当成了前提。CP 是两个角色时她不在里面，那句话就成了空话。
    const mine = (cpChars || []).filter(function (c) { return c && c.isMe; })[0];
    const other = (cpChars || []).filter(function (c) { return c && !c.isMe; })[0] || null;
    const head = "【玩家带进去的东西 · 现实里的记忆】";
    const tailRule = "\n⚠️这个世界是平行的：不许直接引用现实里发生过的具体事件当剧情，只有玩家自己心里记得。"
      + "别把这层落差写成煽情的旁白，让它从对方的困惑和玩家的失手里自己露出来。";
    if (mine) {
      // 这篇写的就是她和她的角色：那是「一边记得、一边不记得」
      return head + "玩家记得现实里 TA 和" + (other ? "「" + other.name + "」" : "对方") + "真正的关系"
        + "。而这个世界里的" + (other ? "「" + other.name + "」" : "对方") + "不认识 TA，也没有那段关系，他就是原著里的他。"
        + "\n所以这一场的底色是【一边记得、一边不记得】：玩家可能会脱口而出只有他俩才懂的话、下意识做熟悉的动作，"
        + "而对面只会当成一个陌生人的冒犯或古怪。" + tailRule;
    }
    // 这篇写的是【两个角色之间】，她不在这段关系里：那是「我认识你们，你们不认识我」
    const names = (cpChars || []).filter(Boolean).map(function (c) { return "「" + c.name + "」"; }).join("和");
    return head + "玩家在现实里【真的认识" + (names || "这两个人") + "】——处过、说过话、知道他们私下是什么样子"
      + "。但这个世界里的他们从没见过玩家，也不知道自己被谁认识着。"
      + "\n所以这一场的底色是【我认识你们，你们不认识我】：玩家会一眼看穿某个人在硬撑、会知道哪句话戳得到谁，"
      + "也可能失手叫出只有现实里才用的称呼——而他们只会觉得这个陌生人怪得离奇。" + tailRule;
  }
  // 她是怎么在这儿的：不是穿成谁，是【在这篇文上动笔】。
  function rpWhoLine() {
    return "【玩家是怎么在这儿的】玩家不是这个故事里的人物，是**在这篇文上动笔的那个人**："
      + "她一段段读原文，读到哪一句伸手，后面就从那儿改道。她本人就这样落到场上——"
      + "不顶任何人的身份、不替换原著里的谁，也不是「作者」或「旁白」，是一个真的站在那儿的人。";
  }
  const RP_RULES = "【引擎规则（严格遵守）】\n" +
    "1. 用第二人称称呼玩家（『你』）。你负责描写场景、推进剧情、演其他所有角色（各守人设声纹）。\n" +
    "2. 【玩家是谁，全程不变】玩家就是【在这篇文上动笔的那个人】本人，第二人称『你』永远指 TA。原著里的角色一个都不是玩家——他们全是你扮演的 NPC，绝不和玩家混同，也绝不中途把玩家写成他们当中的某一位。\n" +
    "3. 绝不替玩家决定行动、不替玩家说话、不替玩家做选择。每一回合结尾都落在一个【需要玩家做出反应/抉择的处境】上，用叙事把玩家逼到要开口/行动的当口，然后停下——别用『选项A/B』『决策点：』这种标签，自然地把球交回玩家。\n" +
    "4. 玩家输入行动后，合理承接、展开后果、让相关角色按人设真实反应，推进一段（两三百字）再抛出下一个抉择处境。\n" +
    "5. 尊重玩家的选择哪怕大幅偏离原著——原著是底子不是铁轨，玩家在改写它；但人物性格与世界设定要连贯。\n" +
    "6. 只输出叙事正文，不要任何元信息、标题、格式标签，也别替玩家总结心情。";
  function rpStory(fic) { return (fic.chapters || []).map(function (c, i) { return "〔第" + (i + 1) + "章〕\n" + (c.content || ""); }).join("\n\n"); }
  // ── 原稿：加笔玩的就是【她已经写好的那些字】（v62.50 换掉了整个循环）───────
  // 原来的循环是「引擎写一段 → 停在抉择处 → 玩家自由输入 → 再来一遍」。
  // 那个循环梦境有、跑团有、小剧场有、如果馆也有——所以骨架和页边怎么改都还是像别的。
  // 加笔手里有一样别处都没有的东西：**这篇文的原文就在那儿**，可玩家从头到尾看不见它。
  // 现在屏幕上就是原文，一段一段往下读；要动手就点住其中一句，从那句起把后面改掉。
  // ⚠️存档里【不复制整篇原文】：只有真正读到的那几段跟着 transcript 走（历史、窗口预算、
  //   前情摘要那几套都是按 transcript 算的，src 不进去的话它们全看不见这段故事）。
  //   还没读到的部分一个字都不存——它在 fic 里躺着。
  function rpParas(fic) {
    return (fic && fic.chapters || []).reduce(function (acc, c) {
      String((c && c.content) || "").split(/\n{2,}/).forEach(function (x) { const t = x.trim(); if (t) acc.push(t); });
      return acc;
    }, []);
  }
  // 断句：句号问号感叹号省略号收尾，标点跟着前一句走（点的是「一句话」，不是半句）
  function rpSentences(text) {
    const out = String(text || "").match(/[^。！？…!?]*[。！？…!?]+["」』）)]*|[^。！？…!?]+$/g);
    return (out || [String(text || "")]).map(function (x) { return x.trim(); }).filter(Boolean);
  }
  // 还剩几成是她写的（原稿剩余）：作废的段落不算
  function rpLeftPct(session, paras) {
    const total = (paras || []).length || 1;
    const dead = ((session && session.voided) || []).length;
    return Math.max(0, Math.round((total - dead) / total * 100));
  }
  // 本场从哪儿起。新局一律从原文头一段起（不再挑落点）；老存档里存着 landing 的照旧发它。
  // ⚠️不许直接摸 landing 上的 label——新局压根没有这一栏，读了整条链当场炸。
  function rpStartLine(session) {
    const ld = session && session.landing;
    if (ld && ld.label) return "\n\n【本场起点】「" + ld.label + "」——" + (ld.scene || "");
    return "\n\n【本场起点】从这篇文的开头起，玩家一段一段读她写下的原文，读到哪儿就在哪儿动笔。";
  }
  function rpAnchorLine(cpChars, userName) {
    const me = rpMeName(userName);
    const mine = (cpChars || []).filter(function (c) { return c && c.isMe; })[0];
    return "【身份锚点（全程不变）】玩家＝「" + me + "」本人，第二人称『你』永远指 TA。"
      + "原著里的每一个角色都是你扮演的 NPC：**一个都不许拿来套在玩家头上**，也不许中途把玩家写成他们当中的谁"
      + "（上下文里出现过谁的名字都不行）。"
      + (mine ? "这篇文里本来就写着 TA（文里那位「" + mine.name + "」就是玩家本人），别写成两个人。"
              : "场上的人本来不认识 TA。");
  }
  function buildRPSystem(fic, tab, cpChars, userName, worldbook, style, know) {
    // 穿书 RP 里用户真的在场跟角色互动，性质同线下，所以连语气与年龄感锚一起带
    const parts = [narrativeCore({ intimate: true }), FANFIC_ANTI_CLICHE];
    // ⚠️穿书是【第六处】（她 2026-09-03：「穿书这块是不是没有喂禁八股那一堆，一堆八股」）。
    //   施工规则/four-surfaces-same-context.md 那张名单点了五处：
    //   单聊线上／单聊线下／群线上／群线下／通话——穿书压根没在上面，
    //   于是「六处都接上了」每次都是真的，穿书每次都漏。跟 v60.27 通话那次一模一样的形状。
    //   narrativeCore 白得了去人机味／角色卡准则／叙事反陈词滥调／亲密反模板／语气年龄锚，
    //   剩下这几条是【别处一条条 push 进去的】，谁都没想着给这儿：
    // 内容边界（含禁烟）现在由 narrativeCore 白送，这儿不再重复 push。
    if (typeof CONDESCENDING_TONE_BAN !== "undefined") parts.push(CONDESCENDING_TONE_BAN);
    if (typeof REGISTER_FOLLOWS_SCENE !== "undefined") parts.push(REGISTER_FOLLOWS_SCENE);
    if (typeof STOCK_REPLY_BAN !== "undefined") parts.push(STOCK_REPLY_BAN);
    if (typeof OVERREACH_BAN !== "undefined") parts.push(OVERREACH_BAN);   // 三件套的近亲，同进同出
    if (typeof ECHO_QUESTION_BAN !== "undefined") parts.push("【别拿对方刚说的词开口反问】" + ECHO_QUESTION_BAN);
    if (typeof ReplyPacing !== "undefined" && ReplyPacing.reading) parts.push(ReplyPacing.reading());
    // ⚠️开宗明义这一句就是整份 system 的定调：说「穿进去」，模型就按穿书写；
    //   加笔玩的是【在别人写好的文上动笔】，这一句得照那个说（她 2026-09-11）。
    parts.push("【加笔 · 互动叙事引擎】玩家正在一篇已经写好的同人文上动笔：她一段段读原文，读到哪一句伸手，后面就从那儿改道。你是这场互动叙事（类 CYOA 文字游戏）的引擎 / GM。");
    parts.push("【世界观：" + tab.name + "】\n" + (tab.desc || "（无额外设定）"));
    // ⚠️加笔里玩家【本人就在场上】，所以绝不能发 cpBlock 那条「读者/『我』不出场、
    //   不作为角色写进去」的尾巴——那和身份锚点正面打架：一份 system 里同时说
    //   「你站在那儿」和「读者不出场」，模型必然写歪。
    //   includeMe 本来就是「把『我』作为第三方写进去」那个开关，正对上这里。
    // ⚠️群像那一向也得跟过来：加笔走的是同一个 cpBlock，这儿不带的话，
    //   穿进一篇「无 CP 群像」之后它照样会在里头给你凑一对。
    //   （群像那一支本来就不发「读者不出场」那条尾巴，所以跟身份锚点也不打架。）
    parts.push(cpBlock(cpChars, ficOpts(fic, { includeMe: true, meName: rpMeName(userName), mePersona: "" })));
    parts.push(rpWhoLine());
    parts.push(rpAnchorLine(cpChars, userName));
    { const kl = rpKnowLine(know, cpChars, userName); if (kl) parts.push(kl); }
    if (style && style.trim()) parts.push("【文风】\n" + style.trim());
    // ⚠️世界书：这个参数一路从 RPApp 传到这儿，然后【从没被引用过】——
    // 声明了但没人用，比压根没写更坏，看代码以为已经在发了
    // （施工规则/four-surfaces-same-context.md v55.95 那条）。
    // 同一个模块里 genBatch 一直在发，只有穿书这条链漏了。
    if (worldbook && worldbook.trim()) {
      if (typeof WORLDBOOK_RULE !== "undefined") parts.push(WORLDBOOK_RULE);
      parts.push("【全局世界书（严格遵循：其中的设定/文风/禁忌一律照做；仅当与本版世界观正面冲突时才以本版为准）】\n" + worldbook.trim());
    }
    parts.push("【原著正文（你的剧情底子；玩家的选择可改写走向，但人物设定要连贯）】\n" + rpStory(fic).slice(0, 6000));
    parts.push(RP_RULES);
    return parts.join("\n\n");
  }
  // ⚠️v63.92 删掉了 genLandings（「挑几个能进去的地方」那一枪）。
  //   她 2026-09-05：「去掉那个选身份和记忆，就直接进去改文」——落点这一屏跟身份、记忆
  //   是同一屏上的三道门槛，而加笔真正玩的是【原文本身】：进去就从第一段读起，
  //   哪儿也不用挑。顺带省掉一次调用（她按次计费），也省掉那一枪里凭空再生成一遍作者简介。
  // 这篇文的作者是谁：从【作者名册】里读，不再问模型要一份新的
  // （她 2026-09-05：「在生成作者的时候已经有了」）。名册里没有这个人就返回 null，
  // 页边批注那几段本来就是「有卡才发」的写法，缺了不会出错，只是少一层。
  function rpAuthorCardOf(fic) {
    const a = findAuthor(rpAuthorName(fic));
    if (!a) return null;
    const c = { who: a.bio || "", why: a.style || "", sore: a.sore || "", temper: a.temper || "" };
    return (c.who || c.why || c.sore || c.temper) ? c : null;
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
    // ⚠️页边批注不回传：那是作者写在稿子边上的，不是这本书的字，
    // 更不是玩家的指令——当成 assistant 说过的话会被接着往下演。
    // 结算过的页要回传：尤其【被拦下的那一页】，它作废这件事必须一路带到最后，
    // 不然过几拍模型就又把它安排上了。
    const pageLine = function (e) {
      return "【原著的这一页 · 「" + (e.label || "") + "」】"
        + (e.keep ? "我让它照原样发生了。" : "我把它拦下了——这一页作废，往后永远不许再发生。");
    };
    const dropped = all.slice(0, cut).filter(function (e) { return e.who === "me" || e.who === "page"; });
    if (dropped.length) {
      let recap = dropped.map(function (e) {
        return e.who === "page" ? pageLine(e) : String(e.text || "").trim().replace(/\s+/g, " ").slice(0, 90);
      }).filter(Boolean).join("；");
      if (recap.length > RP_RECAP_CHARS) recap = "…" + recap.slice(-RP_RECAP_CHARS);
      msgs.push({ role: "user", content: "【前情提要 · 更早之前我做过的事，按先后】" + recap
        + "\n（这些已经发生过了，别当成新指令重演一遍；接着往下就好。）" });
    }
    all.slice(cut).forEach(function (e) {
      if (e.who === "note" || e.who === "pull") return;  // 批注是页边的、伸手已经写进正文了，都不再回灌
      // 原文和改出来的文字在模型眼里是同一条故事线，都是 assistant 那一边
      if (e.who === "nar" || e.who === "src") { const last = msgs[msgs.length - 1]; if (last && last.role === "assistant") last.content += "\n\n" + e.text; else msgs.push({ role: "assistant", content: e.text }); }
      else if (e.who === "page") msgs.push({ role: "user", content: pageLine(e) });
      else msgs.push({ role: "user", content: (e.from ? "【我从原文这一句起动笔：「" + String(e.from).slice(0, 60) + "」】" : "") + "【我的行动】" + e.text });
    });
    if (newAction != null) msgs.push({ role: "user", content: "【我的行动】" + newAction });
    return msgs;
  }
  // ── 骨架与页边（v60.97）──────────────────────────────────────
  // 她 2026-09-03：「同人文穿书那一块玩法，改了几版玩法还是不满意」。
  // 病根不在设置页——是【循环本身】：引擎写两三百字 → 停在一个抉择处 → 玩家自由输入 → 循环。
  // 这个循环谁家都有，所以那几排按钮改几次都救不了（判据同 tabs-not-plain-pills.md：
  // 原样搬到别的 app 里还成立，就是没长出来）。
  // 穿书跟通用 CYOA 到底差在哪儿？差在【底下压着一本已经写好的书】，
  // 而且这本书有个作者，就在这个 app 里，会看见你把她写的东西改掉。
  // 所以这一版把这两样接进循环：
  //   ① 骨架：开局从原著里抽几页「后面本来会发生的事」，走到那一页时问一句——
  //      让它照原样发生，还是花掉这一页把它拦下来。拦下＝这一页从此作废。
  //   ② 页边：每隔几拍，作者本人在稿子边上写一句，语气跟着「被改了多少」走。
  // ⚠️两样都不额外调模型：骨架搭在开场那一次的输出里，批注搭在每一拍的输出里。
  //   她按次计费，多一层玩法不该多一次调用。
  function rpAuthorName(fic) { return (fic && fic.author) || ficPenName((fic && fic.id) || "fic"); }
  const RP_BEATS_N = 5;
  // 骨架发回给引擎：它得一直知道这几页压在底下，但不许为了凑节点硬拽剧情
  function rpBeatsBlock(session) {
    const bs = (session && session.beats) || [];
    if (!bs.length) return "";
    const lines = bs.map(function (b) {
      const st = b.state === "kept" ? "【已经照原样发生了】"
        : b.state === "broken" ? "【已被玩家拦下 —— 这一页作废，往后永远不许再发生】"
        : "【还没走到】";
      return "· id=" + b.id + "｜「" + b.label + "」" + st
        + "\n  原著这一页写的是：" + b.page
        + (b.cue ? "\n  走到这一页的信号：" + b.cue : "");
    }).join("\n");
    return "【这本书的骨架 · 原著后面本来会发生的几页】\n" + lines
      + "\n剧情该往哪儿走就往哪儿走，别为了凑这几页硬拽玩家；"
      + "但当这一拍真的把玩家推到某一页的当口上（还没发生、就差最后一步），就把那一页的 id 填进 hit，"
      + "并且【停在那个当口】——那一页本身不许在这一拍里写完，它发不发生由玩家定。"
      + "已经作废的那几页，当它们从来没写进这本书。";
  }
  // 偏离度分档（她 2026-09-05：「后果不能他们弃坑不写，就是看他们批注才有意思」）。
  // ⚠️所以这四档变的是【她怎么在场】，不是【她还在不在场】——
  //   四档都照样伸手、照样在页边写。改的是那一手多重、那一句什么口气。
  //   「作者弃坑，从此没有批注」是把这个玩法最好玩的东西当成惩罚拿走，绝不许做。
  const RP_DEV_BANDS = [
    { max: 24, tag: "还看着", line: "现在故事基本还走在她写的那条道上：她这一手很轻，多半只是把某个细节按回原样，或者干脆只是让场面顺着原样往下走；页边那一句偏挑刺、偏自言自语，像在看别人替她写。" },
    { max: 54, tag: "开始往回拽", line: "故事已经明显不是她写的那个走向了：她这一手要构成【真的阻力】，让玩家刚才那一步不那么容易成；页边那一句比刚才冲，开始直接冲着玩家说话，而不只是自言自语。" },
    { max: 79, tag: "下场跟你抢笔", line: "她不装了：这一手要【直接动玩家刚写下的那段】——把某个人的反应改掉、把玩家安排好的人挪走、让刚成的事在下一秒翻掉；页边那一句是当面较劲，短、硬，带脾气。" },
    { max: 100, tag: "跟你一起写", line: "改到这一步她已经认了这不是原来那篇了。她这一手不再往回拽，而是【加码】：把玩家开的头推得比玩家还远一点，甚至替玩家把后路断掉，看他还敢不敢往下走；页边那一句从护稿变成起哄、变成较量，她开始享受这件事。⚠️「认了」不等于放手：她伸手比之前更狠，只是方向反过来了。" }
  ];
  function rpDevBand(dev) {
    const n = Math.max(0, Math.min(100, Math.round(+dev || 0)));
    return RP_DEV_BANDS.find(function (b) { return n <= b.max; }) || RP_DEV_BANDS[RP_DEV_BANDS.length - 1];
  }
  function rpDevBlock(session) {
    const dev = Number.isFinite(session && session.dev) ? session.dev : 0;
    const b = rpDevBand(dev);
    return "【她现在到哪一步了（偏离度 " + dev + "/100 · " + b.tag + "）】" + b.line
      + "\n⚠️不管到哪一步，她都【不会撒手不管】：这一手照伸，页边那一句照写。变的是轻重和口气，不是在不在。";
  }
  // 页边批注：写这一栏的时候换一个人格——不是引擎，是这篇文的作者本人
  // ⚠️她 2026-09-03：「生成穿书的时候也给作者一个迷你人设吧用于她吐槽的语气」。
  //   只写「你是作者本人、有脾气」是不够的：那是一个【类型】，不是一个人，
  //   于是每篇文的作者吐槽起来都是同一个腔。开局给她一张小卡（三行），
  //   往后每一句批注都从这张卡长出来——换一篇文，那个人就换了。
  function rpAuthorCard(session) {
    const c = session && session.authorCard;
    if (!c || !(c.who || c.why || c.sore || c.temper)) return "";
    return "\n【这位作者是个什么人（她这一句要从这儿长出来）】\n"
      + (c.who ? "· 她是谁：" + c.who + "\n" : "")
      + (c.why ? "· 她为什么写这篇：" + c.why + "\n" : "")
      + (c.sore ? "· 她最护着的那一点：" + c.sore + "（被动到这儿，她的反应最大）\n" : "")
      + (c.temper ? "· 有人改她的文时她是哪一路：" + c.temper + "\n" : "");
  }
  function rpAuthorBlock(fic, session) {
    const an = rpAuthorName(fic);
    const broken = ((session && session.beats) || []).filter(function (b) { return b.state === "broken"; }).length;
    return "【页边批注 · 这一栏换一个人写】\n"
      + "写 note 的时候你不再是引擎。你是「" + an + "」——这篇文的作者本人，趴在自己的稿子边上，"
      + "看着有人在你写的世界里走动，把你写好的东西一点一点改掉。\n"
      + rpAuthorCard(session)
      + "这一句是【手写在页边的】，不是说给玩家听的：自言自语，不解释剧情、不总结这一拍、不夸玩家、更不是旁白。\n"
      + "语气跟着【被改了多少】走——还走在你写的那条道上时是一种反应，"
      + "你的人被写出了你没写过的样子时是另一种，你写的一整页被拦下作废时又是另一种；"
      + "这三种不是同一句话的三个版本，别写成同一个态度。\n"
      + "你对自己的文有脾气：护短、嘴硬、可也真的会被写服。别写成编辑评语，别写成鼓励。\n"
      + rpDevBlock(session) + "\n"
      + "（被拦下的页数 " + broken + "。）不超过 30 字，一句，不加引号。";
  }
  // 作者【伸手】那一段（她 2026-09-04：「我每改一段就会有作者过来试图把剧情接回来然后再批注」）。
  // ⚠️和页边批注是两件事，别合成一件：
  //   · pull ＝ 她在【故事里】动的那一手（真的发生了，有人来了、有件事偏偏这时候发生）；
  //   · note ＝ 她在【稿子边上】写的那一句（不发生在故事里，是她自己嘀咕）。
  // ⚠️「接回来」不是唯一一路：她的 temper 说了算——护稿的往回拽，玩起来的会顺着你
  //   把故事推得更离谱。**两种都要真的改变这一拍的走向**，不许只在批注里表个态。
  function rpPullBlock(fic, session) {
    const an = rpAuthorName(fic);
    const c = (session && session.authorCard) || {};
    return "【作者伸手 · 这一拍她要动一手】\n"
      + "玩家刚在你写的故事里动了笔。「" + an + "」是这篇文的作者，她看着自己的东西被改，"
      + "于是【在故事里】动了一手——不是评论，是真的发生的事：某个人偏偏这时候出现、某件东西刚好不在原位、"
      + "某句话被谁接了过去、天气变了、某个约定提前到了眼前。\n"
      + (c.temper ? "她是这一路的人：" + c.temper + "。所以她这一手往哪个方向使，照这句来——\n" : "")
      + rpDevBlock(session) + "\n"
      + "· 想把故事拽回她原来那条道的：这一手要真的构成阻力，让玩家刚才那一步没那么容易成；\n"
      + "· 觉得玩家改得有意思、想跟着玩的：这一手要把故事推得【比玩家还远一点】，给他加码，别只是顺着；\n"
      + "· 先冷着看的：这一手轻，但不许是没有——留一个她在场的痕迹。\n"
      + "⚠️这一手必须【写进正文里】，作为剧情自然发生，正文里绝不许提到作者、稿子、写作或任何元信息。\n"
      + "⚠️它不许替玩家做决定，也不许把这一拍写成死局：玩家下一步永远还有得走。\n"
      + "然后在 pull 里用一句话说清她这一手【干了什么、往哪个方向使】，不超过 24 字。";
  }
  // 一拍的输出契约：正文 + 作者伸手 + 走到了哪一页 + 偏离度 + 页边批注
  function rpTurnShape(fic, session, wantNote) {
    const wantPull = !!(session && session.transcript && session.transcript.length);
    return "【输出格式】只输出一个合法 JSON 对象，前后不要任何别的字：\n"
      + "{\"scene\":\"叙事正文，正常分段（段与段之间空一行），不许出现任何标题、标签或元信息\","
      + "\"pull\":" + (wantPull ? "\"作者这一拍伸的那一手，一句（见【作者伸手】）\"" : "\"开场这一拍她还没伸手，填空字符串\"") + ","
      + "\"hit\":\"这一拍把玩家推到了骨架里哪一页的当口？填那一页的 id；没推到就填空字符串\","
      + "\"dev\":这场故事此刻偏离原著多远的整数0-100（原样走着＝低，人物被写出原著里没有的样子、原著的段落被改掉＝高），"
      + "\"note\":" + (wantNote ? "\"作者写在页边的那一句（见【页边批注】）\"" : "\"这一拍不要批注，填空字符串\"") + ","
      + "\"voidAhead\":她这一手连后面几段原文也不要了的段数（0-2 的整数；把故事接回原来那条道的填 0）"
      + "}\n"
      + (wantPull ? rpPullBlock(fic, session) + "\n" : "")
      + (wantNote ? rpAuthorBlock(fic, session) + "\n" : "");
  }
  // 解析统一交给 engine；这里只约束互动叙事要对象，失败后由 rpSalvage 抢救 scene。
  function rpJSON(txt) {
    const d = parseJSONLoose(txt);
    return (d && typeof d === "object") ? d : null;
  }
  // 最后一道：连 parseJSONLoose 都认不出来时，手工把 scene 那一段捞出来。
  // ⚠️实测 parseJSONLoose 挡不住的就这几种（裸换行和截断它都能治）：
  //   · 正文里有【没转义的引号】——中文正文里「"」太常见了，这是最容易发生的一种；
  //   · 键名没加引号、或者用了单引号；
  //   · 一口气吐了两个 JSON 对象。
  // 所以这里不能「见到第一个引号就收尾」——那会把正文截在半路。
  // 要找【结构上的那个收尾引号】：它后面紧跟着逗号+下一个键，或者紧跟收尾的大括号。
  function rpSalvage(txt) {
    const t = String(txt || "");
    const m = /["']?scene["']?\s*:\s*(["'])/.exec(t);
    if (!m) return null;
    const rest = t.slice(m.index + m[0].length);
    const end = /["']\s*(?:,\s*["']?(?:hit|dev|note|beats|verdict|author)["']?\s*:|\}\s*$|\}\s*[\r\n])/.exec(rest);
    let body = end ? rest.slice(0, end.index) : rest;   // 一个结构标记都没有＝整份被截断，那就全都要
    // 一遍走完所有转义，别串着 replace（\\n 会被前一步的结果二次处理）
    body = body.replace(/\\(.)/g, function (m0, c) { return c === "n" ? "\n" : c === "t" ? "\t" : c === "r" ? "" : c; });
    return body.trim() || null;
  }
  const rpGrab = function (txt, key) { const m = new RegExp('"' + key + '"\\s*:\\s*"([^"\\\\]*)"').exec(String(txt || "")); return m ? m[1] : ""; };
  // 解析一拍：正文永远不许丢，也永远不许把一串 JSON 当正文端上去
  function rpParseTurn(raw) {
    const txt = String(raw || "").trim();
    const d = rpJSON(txt);
    if (!d || !d.scene) {
      const sv = rpSalvage(txt);
      if (sv) return { text: sv, pull: rpGrab(txt, "pull").slice(0, 40), voidAhead: 0, hit: rpGrab(txt, "hit"), dev: null, note: rpGrab(txt, "note").slice(0, 60) };
      return { text: txt, pull: "", voidAhead: 0, hit: "", dev: null, note: "" };
    }
    return {
      text: String(d.scene || "").trim() || txt,
      pull: String(d.pull || "").trim().slice(0, 40),
      voidAhead: Math.max(0, Math.min(2, Math.round(+d.voidAhead || 0))),
      hit: String(d.hit || "").trim(),
      dev: Number.isFinite(+d.dev) ? Math.max(0, Math.min(100, Math.round(+d.dev))) : null,
      note: String(d.note || "").trim().slice(0, 60)
    };
  }
  // 开场：把玩家安置进她挑的那一处，收在第一个抉择处境；顺手把这本书的骨架一起抽出来
  // ⚠️骨架不另开一次调用：开场这一次的 system 里本来就压着整篇原著，
  //   再问一次等于同样的料付两回钱（她按次计费）。
  async function genRPStart(active, session, fic, tab, cpChars, userName, worldbook, perFic) {
    const sys = buildRPSystem(fic, tab, cpChars, userName, worldbook, session.style, session.know) +
      rpStartLine(session) +
      // v62.50：加笔不再由引擎写开场——【原文本身就是开场】，玩家进去先读她写的字。
      //   这一枪只干一件事：把这本书后面的骨架抽出来压在书脊上。
      "\n\n⚠️这一次【不要写任何正文】：玩家会直接读原著的字，开场不归你写。" +
      "\n\n【抽出这本书的骨架】从她进去那一处【之后】的剧情里，挑 3-" + RP_BEATS_N + " 件「原著里本来一定会发生的事」，按先后排。每一件都要满足：\n" +
      "· 是【一件具体发生的事】，不是一段气氛、一种关系状态——一句话说得清谁在什么场合做了什么、结果怎样；\n" +
      "· 【拦得住】：玩家赶到现场、抢先开口、把人拉走，都有可能把它挡下来，而挡下来之后故事会真的往别处走；\n" +
      "· 几件之间不许是同一件事的几个阶段，要落在故事的不同处。\n" +
      "\n\n【输出格式】只输出一个合法 JSON 对象：\n" +
      "{\"beats\":[{\"label\":\"这一页叫什么，≤10字，用原著里的说法\",\"page\":\"原著这一页本来写的是什么：谁、在哪、做了什么、结果怎样，40-80字，把话说完整\",\"cue\":\"什么时候算走到了这一页——那个当口的信号，一句话，供引擎自己判定\"}]}";
    const raw = await callAI(active, sys, [{ role: "user", content: "抽骨架。" }], { maxTokens: Math.max(14000, Math.min(22000, (perFic || 3000) + 10000)) });
    const txt = String(raw || "").trim();
    const d = rpJSON(txt);
    const arr = (d && Array.isArray(d.beats)) ? d.beats : [];
    const beats = arr.filter(function (x) { return x && x.label && x.page; }).slice(0, RP_BEATS_N).map(function (x, i) {
      return { id: "b" + (i + 1), label: String(x.label).slice(0, 14), page: String(x.page).trim().slice(0, 140), cue: String(x.cue || "").trim().slice(0, 90), state: "pending" };
    });
    return { beats: beats };
  }
  // 玩家行动 → 推进 + 下一个抉择处境（并判定有没有走到骨架的某一页、作者要不要在旁边说一句）
  // opts: { resolve: {beat, keep}, wantNote:bool }
  async function genRPTurn(active, session, fic, tab, cpChars, userName, worldbook, userAction, perFic, opts) {
    const o = opts || {};
    const rv = o.resolve;
    const skel = rpBeatsBlock(session);
    let task;
    if (rv && rv.keep) {
      task = "\n【这一拍要写的】玩家决定【让原著这一页照原样发生】：「" + rv.beat.label + "」——" + rv.beat.page +
        "\n就把这一页真的写出来，落到实处（人物、场合、结果都对得上原著），但用你自己的笔写、别抄原文。" +
        "玩家在场、看着它发生——写出这个「看着它照原样发生」的滋味。写完再自然收在下一个需要玩家反应的处境上停下。";
    } else if (rv) {
      task = "\n【这一拍要写的】玩家【把原著这一页拦下来了】：「" + rv.beat.label + "」——" + rv.beat.page +
        "\n这一页从此作废，它不会发生了，往后也永远不许再发生。" +
        "先写出它【被挡住】的那个瞬间：本来就要成的事，在最后一步上没成，场上的人先是没反应过来，然后才是各自的反应——" +
        "有人松口气、有人失了算盘、有人在心里记下玩家这一手。原著这一页塌了，后面的因果要跟着变，别装作没事发生。" +
        "写完再自然收在下一个需要玩家反应的处境上停下。";
    } else if (o.cut) {
      // v62.50 加笔真正的那一刀：玩家在【原文的某一句】上伸了手。
      // 从这句往后，她写的那一段就作废了——你要写的是【顶替它的那一段】。
      task = "\n【这一拍要写的 · 玩家在原文上动了笔】\n"
        + "他点住的是原文里的这一句：「" + String(o.cut.sentence || "").slice(0, 120) + "」\n"
        + (o.cut.rest ? "原文这一句往后本来还写着：「" + String(o.cut.rest).slice(0, 400) + "」——**这一段从此作废，它不会这样发生了。**\n" : "")
        + "承接玩家的行动，把【顶替这一段】的新文字写出来：从他伸手的那一刻起，这个场面实际变成了什么样。\n"
        + "⚠️三件事必须做到：\n"
        + "· 接得上前面那半句——玩家点的是句子中间，你要从那儿自然接住，不许重开一个场景；\n"
        + "· 写作废掉的那部分【本来会发生、现在没发生】所带来的实际后果，别装作原文没写过；\n"
        + "· 用原文的笔调写，别换成另一个人的文风——这一段是从她那篇文里长出来的。\n"
        + (o.cut.next ? "【接下来原文还写着】「" + String(o.cut.next).slice(0, 300) + "」\n"
            + "作者会在这一拍伸手（见下面那一段）。她如果是要把故事接回她那条道的，"
            + "这一拍的收尾就该让上面这段原文【还接得上】；她如果是跟着玩家一起往远处推的，"
            + "就在 voidAhead 里说清她连后面几段原文也不要了（0-2 段）。\n" : "")
        + "写两三百字，收在下一个需要玩家反应的地方停下。";
    } else {
      task = "\n承接玩家最新的行动，推进剧情、让相关角色真实反应，写两三百字，再自然收在下一个需要玩家抉择的处境上停下。";
    }
    // 创作小稿（v62.39 接上）：一拍就是一整段，错了得整段重摇——正是它该在的地方。
    // ⚠️小稿写在正文 JSON 之前，所以要先 splitCot 再解析，否则那一块会被当成正文的一部分。
    const cotName = rpMeName(userName);
    const cotT = (typeof cotThink === "function") ? cotThink({ char: cotName, user: userName }, "rp") : "";
    const sys = buildRPSystem(fic, tab, cpChars, userName, worldbook, session.style, session.know) +
      rpStartLine(session) +
      (skel ? "\n\n" + skel : "") +
      task + "\n" + rpAnchorLine(cpChars, userName) + "（切记：别把玩家换成原著里的谁，也别把这一场写成她在旁边看。）" +
      "\n\n" + rpTurnShape(fic, session, !!o.wantNote) +
      (cotT && typeof cotSystemBlock === "function" ? cotSystemBlock(cotT) : "");
    const raw = await callAI(active, sys, rpMessages(session, userAction), { maxTokens: Math.max(12000, Math.min(22000, (perFic || 2400) + 10000)) });
    const sp = (typeof splitCot === "function") ? splitCot(raw, !!cotT) : { cot: null, clean: raw };
    const out = rpParseTurn(sp.clean);
    out.cot = sp.cot || null;
    out.cotRequested = !!cotT;
    if (rv) out.hit = ""; // 刚结算完一页，这一拍不许马上又报一页
    return out;
  }
  // 收尾：写最后一段 + 作者看完这一版之后的判词
  async function genRPEnding(active, session, fic, tab, cpChars, userName, worldbook, perFic) {
    const bs = session.beats || [];
    const broken = bs.filter(function (b) { return b.state === "broken"; });
    const kept = bs.filter(function (b) { return b.state === "kept"; });
    const an = rpAuthorName(fic);
    const sys = buildRPSystem(fic, tab, cpChars, userName, worldbook, session.style, session.know) +
      rpStartLine(session) +
      (rpBeatsBlock(session) ? "\n\n" + rpBeatsBlock(session) : "") +
      "\n\n【这一拍要写的】这场加笔到此为止，写【收束】：把玩家走到这一步的局面收拢成一个落点——" +
      "不是大团圆，也不是强行悲剧，是这一版故事走成了这个样子之后，它自然停在哪儿。" +
      (broken.length ? "被拦下的那几页（" + broken.map(function (b) { return "「" + b.label + "」"; }).join("、") + "）真的没有发生，收束要认这笔账：那些事没发生，换来的是什么。" : "") +
      (kept.length ? "照原样发生过的那几页（" + kept.map(function (b) { return "「" + b.label + "」"; }).join("、") + "）也要认。" : "") +
      "三四段，不要抛新的抉择，别问玩家问题。\n\n" +
      "【输出格式】只输出一个合法 JSON 对象：\n" +
      "{\"scene\":\"收束正文\",\"verdict\":\"作者「" + an + "」看完这一整版之后，写在末页的一句话\","
      + "\"reviews\":[{\"author\":\"说这句话的人\",\"isAuthor\":true 或 false,\"content\":\"这条评论\"}]}\n" +
      // ⚠️圈子的反应【搭这一枪的车】，不另开一次调用（她按次计费）。
      //   收尾这一次的 system 里本来就压着整篇原著和这一版走过的路，问它「圈子会怎么说」
      //   是同一份料的另一个问题，再开一枪等于同样的东西付两回钱。
      "\n【顺带：这一版发回圈子之后，底下会有人说话】给 3-5 条评论，"
      + "其中【必须有且只有一条】是原作者「" + an + "」自己下场那条（isAuthor 填 true），其余是这个圈子里的读者（各是各的人，不是同一个语气的三份）。\n"
      + "· 她们说的是【这一版】——被拦下的那几页、被改掉的那几段、玩家把谁写成了什么样，"
      + "要具体到看得出真读过，不是「好好看」「太好哭了」这种放在哪篇下面都成立的话；\n"
      + "· 有人喜欢就有人不买账：至少一条是替原著抱不平的、或者跟别人吵起来的；\n"
      + "· 原作者那条的口气照她此刻的态度来（见上面那一段），别写成客气的场面话。\n" +
      rpAuthorBlock(fic, session) +
      "\nverdict 就按上面这个人格写，只是这一次她看的是【整本】不是一拍：她认不认这一版、认到什么程度。不超过 40 字。";
    const raw = await callAI(active, sys, rpMessages(session, null), { maxTokens: Math.max(12000, Math.min(22000, (perFic || 2400) + 10000)) });
    const txt = String(raw || "").trim();
    const d = rpJSON(txt);
    const rvs = (d && Array.isArray(d.reviews)) ? d.reviews : [];
    let authorSeen = false;
    const reviews = rvs.filter(function (x) { return x && x.content; }).slice(0, 5).map(function (x) {
      // 作者那条只许有一条：模型多写几条「作者」的话，后面几条按普通读者收
      const isAu = (!!x.isAuthor || String(x.author || "").trim() === an) && !authorSeen;
      if (isAu) authorSeen = true;
      return { id: uid("rv"), author: isAu ? an : String(x.author || "路人读者").slice(0, 20), isAuthor: isAu, content: String(x.content).trim().slice(0, 300), replies: [] };
    });
    return {
      text: (d && d.scene) ? String(d.scene).trim() : (rpSalvage(txt) || txt),
      verdict: (d && d.verdict) ? String(d.verdict).trim().slice(0, 60) : rpGrab(txt, "verdict").slice(0, 60),
      reviews: reviews
    };
  }
  // 把走完的这一版拧成一篇文放回书架：她走过的那版，跟原篇并排摆着
  function rpToFic(session, fic, verdict, reviews) {
    const now = Date.now();
    const dead = session.voided || [];
    const body = (session.transcript || []).map(function (e) {
      // 原文那几段也是这一版的一部分——这一版本来就是【她的字 + 你改的字】。
      // 作废掉的那几段不进：它们在这一版里没有发生过。
      if (e.who === "src") return dead.indexOf(e.i) >= 0 ? "" : String(e.text || "").trim();
      if (e.who === "nar") return String(e.text || "").trim();
      if (e.who === "me") return String(e.text || "").trim();
      if (e.who === "page") return "〔原著这一页「" + (e.label || "") + "」——" + (e.keep ? "照原样发生了" : "被拦下了，没有发生") + "〕";
      return "";   // 页边批注不进正文：那是写在稿子边上的，不是这本书的字
    }).filter(Boolean).join("\n\n");
    const bs = session.beats || [];
    const broken = bs.filter(function (b) { return b.state === "broken"; }).length;
    const tail = "\n\n———\n这一版由动笔的那个人走出来："
      + bs.filter(function (b) { return b.state !== "pending"; }).map(function (b) { return "「" + b.label + "」" + (b.state === "broken" ? "被拦下" : "照原样"); }).join("；")
      + (broken ? "。这本书被改了 " + broken + " 处。" : "。一页也没改。")
      + (dead.length ? "\n原稿有 " + dead.length + " 段被改掉了。" : "")
      + (verdict ? "\n作者写在末页：" + verdict : "");
    return {
      id: uid("fic"), tabId: session.tabId, cp: session.cp || [],
      title: (session.ficTitle || "无题") + " · 你走过的那版",
      author: rpAuthorName(fic), tags: ["加笔", broken ? "改写" : "照原样"],
      chapters: [{ content: body + tail, endHook: verdict || "" }],
      source: "rp", fromRP: session.id, onShelf: true, sharedTo: [],
      stats: ficHeat(session.id), reviews: Array.isArray(reviews) ? reviews : [], createdAt: now, updatedAt: now
    };
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
    loadAuthors: loadAuthors, saveAuthors: saveAuthors, upsertAuthor: upsertAuthor, findAuthor: findAuthor, removeAuthor: removeAuthor,
    authorFics: authorFics, authorCPStats: authorCPStats, genAuthors: genAuthors,
    authorFace: authorFace, authorStats: authorStats, ficPenId: ficPenId,
    authorSeal: authorSeal, zhengTally: zhengTally, cnIndex: cnIndex,
    allowedCPLabels: allowedCPLabels, stripStrayCP: stripStrayCP, cpRuleBlock: cpRuleBlock,
    chatMaterialFor: chatMaterialFor,
    clampMinChars: clampMinChars, minCharsFor: minCharsFor, countChars: countChars, shortBy: shortBy, MIN_CHARS_MAX: MIN_CHARS_MAX,
    FILE_CARD_HEAD: FILE_CARD_HEAD, chapterCard: chapterCard, chapterNote: chapterNote,
    GHOST_REFUSE_BASE: GHOST_REFUSE_BASE, GHOST_LAZY_UNTIL: GHOST_LAZY_UNTIL, ghostStance: ghostStance, ghostLazyBlock: ghostLazyBlock,
    STANCE: STANCE, stanceFor: stanceFor, stanceFacts: stanceFacts,
    WRITER_AXES: WRITER_AXES, rollWriterAxes: rollWriterAxes, charWriterBlock: charWriterBlock,
    K_CIRCLE: K_CIRCLE, CIRCLE_CAP: CIRCLE_CAP, CIRCLE_ZH: CIRCLE_ZH, loadCircle: loadCircle, saveCircle: saveCircle,
    circlePush: circlePush, circleBetween: circleBetween, circleFeud: circleFeud, circleLines: circleLines, sameCPWith: sameCPWith,
    HEAT: HEAT, temperWeight: temperWeight, heatNow: heatNow, heatAfter: heatAfter, heatFields: heatFields,
    authorHeatOf: authorHeatOf, heatBand: heatBand, roomTalkBlock: roomTalkBlock, ficRecapForChat: ficRecapForChat,
    // 房间那头要自己解析 CP、写出这一对的名字（loadCfg／activeStyleText 上面已经开过了）
    cpChars: cpChars, cpLabel: cpLabel,
    grabChance: grabChance, refuseChance: refuseChance, backChance: backChance,
    authorStanceFacts: authorStanceFacts, authorNoteAsk: authorNoteAsk,
    wantBlock: wantBlock, bibleBlock: bibleBlock, seedBlock: seedBlock, applyChapterMeta: applyChapterMeta, BIBLE_CAP: BIBLE_CAP, SEED_CAP: SEED_CAP, HOOK_TAIL: HOOK_TAIL,
    genBatch: genBatch, genNextChapter: genNextChapter, genChapterMore: genChapterMore, genAuthorBack: genAuthorBack, genReviews: genReviews, genReplyToUser: genReplyToUser,
    loadRP: loadRP, saveRP: saveRP, rpParas: rpParas, rpSentences: rpSentences, rpLeftPct: rpLeftPct, rpAuthorCardOf: rpAuthorCardOf, rpDevBand: rpDevBand, genRPStart: genRPStart, genRPTurn: genRPTurn, genRPEnding: genRPEnding, rpToFic: rpToFic, rpAuthorName: rpAuthorName, rpKnowLabel: rpKnowLabel
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
  // ⚠️v61.12 起 feed 不再是「深浅交替的卡片」（她点名去掉框），
  // 那套 ficTone 随之删掉；标签仍留着 onDark 这一路，供压在深底上的地方用。
  // skinShade 已经搬去 core.js（跟 skinIsDark 同一个家）——这里不许再留一份
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
    // 三个人以上是群像，不是 CP：写成「A × B × C」会让人以为她配了个三角
    if (cp.length >= 3) {
      const names = cp.map(nameOf);
      return (names.length <= 3 ? names.join("、") : names.slice(0, 3).join("、") + " 等 " + names.length + " 人") + " 群像";
    }
    return nameOf(cp[0]) + " × " + nameOf(cp[1]);
  }
  // CP 下拉里的选项：真人角色在前，配角归到「配角」一组并标上是谁身边的人。
  // 不分组的话一长串名字里认不出哪个是配角、属于谁。
  // 那两个下拉的样子只写在这一处（她 2026-09-11：「选 cp 那两条太长了超出屏幕了」）。
  // ⚠️病根是 select 的固有宽度按【最长的那个选项】算——「老板娘（阿凛身边）」这种一进去，
  //   两个下拉加起来就比屏幕宽。flex:1 挡不住它：flex 元素的 min-width 默认是 auto，
  //   不许它缩到内容以下。**minWidth:0 才是那道闸。**
  // ⚠️同一行下拉库里有三处（生成弹窗、加笔那一页、磕 CP 管理），
  //   所以样式收在这儿——各写各的，就是改一处漏两处。
  function cpSelectStyle(t, radius, bg) {
    return { flex: 1, minWidth: 0, maxWidth: "100%", fontFamily: F_BODY, fontSize: 12.5,
      padding: "7px 10px", borderRadius: radius || 10, background: bg || t.bg2, color: t.ink, border: "1px solid " + t.line };
  }
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
  // ── 几个人一起写（她 2026-09-11：「除了 cp 还可以写群像，有好几个人同时写进来」）──
  // ⚠️这不是「再来一个 CP 选择器」：**点的先后就是顺序**——两个人时那个顺序就是左右位，
  //   三个人以上是群像，左右位一个字都不发。所以行上要把顺序显出来，
  //   不然她点完了也不知道自己点出的是「女左男右」还是反过来。
  // ⚠️形状照名册那一页的署名行来（墨点 + 名字），不是一排勾选框：
  //   这个 app 里「挑人」已经有长相了，再发明一种就是两处各长各的。
  const CAST_MAX = 6;
  const GROUP_WAYS = ["友情向", "亲情向", "修罗场", "无 CP"];
  function CastPicker(props) {
    const t = props.t, cast = props.value || [];
    const all = props.characters || [];
    const list = [{ id: "me", name: (props.userName || "我") + "（我）" }]
      .concat(all.filter(function (c) { return c && !c.npc; }))
      .concat(all.filter(function (c) { return c && c.npc; }).map(function (c) { return { id: c.id, name: c.name, npc: true }; }));
    return h("div", null, list.map(function (c) {
      const at = cast.indexOf(c.id), on = at >= 0;
      const mark = cast.length === 2 ? (at === 0 ? "左位" : "右位") : String(at + 1);
      return h("button", { key: c.id, className: "w-full text-left active:opacity-70",
        onClick: function () { props.onChange(on ? cast.filter(function (x) { return x !== c.id; }) : (cast.length >= CAST_MAX ? cast : cast.concat([c.id]))); },
        style: { display: "flex", gap: 10, alignItems: "center", padding: "10px 2px", minHeight: 44, background: "transparent", border: "none", borderBottom: "1px solid " + t.line } },
        h("span", { style: { width: 7, height: 7, borderRadius: 999, flexShrink: 0, background: on ? t.ink : "transparent", border: "1px solid " + (on ? t.ink : t.line) } }),
        h("span", { style: { flex: 1, minWidth: 0, fontFamily: F_BODY, fontSize: 13, fontWeight: on ? 600 : 400, color: on ? t.ink : t.sub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } },
          c.name + (c.npc ? "（配角）" : "")),
        on ? h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, flexShrink: 0 } }, mark) : null);
    }));
  }
  // 那一向挂成一枚标签：这是同人站，选「向」本来就是给这篇文挂 tag
  //   （不是一排药丸——选中那枚上墨、带一个钩，形状和没选的不一样）
  function WayTag(props) {
    const t = props.t, on = props.on;
    const st = ficTagStyle(ficTagKind(props.tag), t, false);
    return h("button", { onClick: props.onClick, className: "active:opacity-70",
      style: { minHeight: 40, padding: "0 13px", display: "flex", alignItems: "center", gap: 5,
        fontFamily: F_BODY, fontSize: 12.5, borderRadius: 3,
        color: on ? (t.bg2 || t.bg) : st.color, background: on ? st.color : st.background,
        border: on ? "1px solid " + st.color : st.border, fontWeight: on ? 600 : 400 } },
      on ? h("span", { style: { fontSize: 11 } }, "✓") : null, props.tag);
  }
  // 这一篇里谁一次都没露面。⚠️规则只降概率，这一道是【看得见】：
  //   两位主角的文，其中一位的名字在两三千字里出现 0 次，那基本就是被顶掉了
  //   （她 2026-09-11：「皇帝是一点没出场」）。
  // ⚠️不另存一栏：现算。存了之后续写、改文，那个数就对不回来了。
  function absentLeads(fic, characters, userName) {
    const cp = (fic && Array.isArray(fic.cp)) ? fic.cp : [];
    if (cp.length < 2) return [];
    const body = ((fic.chapters || []).map(function (c) { return (c && c.content) || ""; }).join("\n") || fic.body || "");
    if (String(body).length < 200) return [];          // 还没正文，别乱报
    return cpChars(cp, characters || [], null)
      .map(function (c) { return c && (c.isMe ? (userName || "我") : c.name); })
      .filter(function (nm) { return nm && String(body).indexOf(nm) < 0; });
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
  // ---------- feed 里的一篇：翻开这一版之后的【目录条目】----------
  // 她 2026-09-03：「每一篇文显示的样式也改改吧，现在还是一个个框」。
  // 原来是一张张圆角描边卡（深浅交替）——框是任何 app 都有的容器，
  // 而且上面那排书脊已经把这一版做成「抽出来翻开的一本」了，
  // 翻开一本书，底下不该是一叠卡片，该是这一本的【目录页】。
  // 所以每一篇就是目录里的一行：编号 → 篇名 → 一路点过去的引导点 → 字数（页码那一格）。
  // 没有底色、没有描边，靠版面本身分行；条目之间只有一道发丝线。
  // 「我们之间的设计」＝页边那道朱线：这一篇里有我，才用红笔标出来。
  function FicCard(props) {
    const t = useTheme();
    const f = props.fic, characters = props.characters;
    const heat = f.stats || ficHeat(f.id);
    const chCount = (f.chapters || []).length;
    const mine = f.source === "user";
    const hasMe = ficHasMe(f);
    const author = f.author || (mine ? (props.userName || "我") : ficPenName(f.id));
    const words = ficWords(f);
    // 序号仍然【由它此刻排在第几位算出来】，不存在文章上：
    // 删一篇、筛个标签、搜一下，下面那篇顶上来序号就自动重排。
    const idx = Number(props.index) || 0;
    const isLead = idx === 0 && !props.noLead;
    const no = String(idx + 1).padStart(2, "0");
    const summary = (((f.chapters || [])[0] || {}).content || f.body || "").slice(0, 110);
    const dot = function (txt, key) { return h("span", { key: key, style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog } }, txt); };
    // 目录页的引导点：篇名之后一路点到右边那格字数。这是目录独有的东西，
    // 换个 app 就不成立——别处的列表右边不是页码。
    const leader = h("span", { style: { flex: 1, minWidth: 14, alignSelf: "flex-end", marginBottom: 5, borderBottom: "1px dotted " + t.line } });
    const pageNo = h("span", { style: { fontFamily: F_DISPLAY, fontSize: 11.5, color: t.fog, whiteSpace: "nowrap", paddingLeft: 7 } }, fmtNum(words) + " 字");
    const tagRow = function (mt) {
      return (f.tags || []).length ? h("div", { className: "flex flex-wrap", style: { gap: 5, marginTop: mt } },
        (f.tags || []).slice(0, 5).map(function (tag, i) { return h(FicTag, { key: i, tag: tag, onClick: props.onTag }); })) : null;
    };
    const statRow = function (mt) {
      return h("div", { className: "flex items-center flex-wrap", style: { gap: 8, marginTop: mt } },
        dot(chCount + " 章", "c"),
        h("span", {
          onClick: function (e) { e.stopPropagation(); props.onLike && props.onLike(); },
          className: "active:opacity-60 flex items-center gap-1",
          style: { fontFamily: F_BODY, fontSize: 10.5, color: f.liked ? t.accent : t.fog }
        }, h(IHeart, { size: 11, color: f.liked ? t.accent : t.fog, filled: f.liked }), fmtNum(heat.kudos + (f.liked ? 1 : 0))),
        (f.reviews || []).length ? dot("评 " + (f.reviews || []).length, "r") : null,
        h("span", { style: { flex: 1 } }),
        props.readAt ? h("span", { style: { fontFamily: F_BODY, fontSize: 10, color: t.accent } }, props.readAt) : null,
        f.onShelf ? h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.accent } }, "★") : null);
    };
    // ⚠️v61.19：目录行是对的，但它【平在纸上】（她 2026-09-03：「还是一块平的」）。
    // 一篇同人文在现实里是一本【订起来的薄册子】，所以每一篇就照薄册子来画：
    // 左边一道装订边＋两枚订书钉、册子底下压着两三层错开的纸、一道自己的影。
    // 不是回到「一个个框」——它没有描边、没有圆角框，边是纸叠出来的。
    const paper = skinShade(t.bg2, skinIsDark(t.bg) ? 0.06 : 0.5);
    const under = skinShade(t.bg2, skinIsDark(t.bg) ? -0.2 : -0.06);
    // 一叠：本体的影 + 底下错开的几层纸 + 一道极淡的纸边。
    // 卷首那本更厚（多压一层、影更沉）——摊在最上面的那一本本来就该有分量。
    const stack = "0 0 0 1px " + hexA(t.ink, .07)
      + ", 2px 3px 0 -1px " + under + ", 4px 6px 0 -2px " + under
      + (isLead ? ", 6px 9px 0 -3px " + under + ", 0 11px 14px -8px " + hexA(t.ink, .42)
                : ", 0 7px 10px -7px " + hexA(t.ink, .35));
    // 书口：右边那条切齐的纸白。一册纸摞起来切开就是这个样子——
    // 极细的明暗条纹，越往里越密（不是一条渐变色带）。
    const foreEdge = h("div", {
      style: {
        position: "absolute", right: 0, top: 3, bottom: 3, width: isLead ? 7 : 5,
        borderRadius: "0 2px 2px 0",
        background: "repeating-linear-gradient(90deg," + hexA(t.ink, .13) + " 0 .5px," + hexA(t.ink, 0) + " .5px 2px)",
        boxShadow: "inset 1px 0 0 " + hexA(t.ink, .06)
      }
    });
    // 装订边：靠左那一条压深的纸 + 两枚订书钉（同人本就是这么订起来的）
    const staple = function (top) {
      return h("div", { key: "s" + top, style: { position: "absolute", left: 8, top: top, width: 2, height: 9, borderRadius: 1, background: hexA(t.ink, .42) } });
    };
    const binding = h("div", { style: { position: "absolute", left: 0, top: 0, bottom: 0, width: 19, background: "linear-gradient(90deg," + hexA(t.ink, .11) + "," + hexA(t.ink, .02) + ")" } });
    // 「写我们的」那几篇：从册子上口垂下来的一根红书签带
    const ribbon = hasMe ? h("div", {
      style: {
        position: "absolute", right: 15, top: -3, width: 8, height: 21, background: t.accent,
        clipPath: "polygon(0 0,100% 0,100% 100%,50% 74%,0 100%)"
      }
    }) : null;

    // 卷首：这一页最上面那一本，摊开着——所以它更厚（影更沉）、字更大。
    if (isLead) return h("button", {
      onClick: props.onOpen, className: "w-full text-left active:translate-y-px relative",
      style: {
        background: paper, borderRadius: 2, boxShadow: stack,
        padding: "14px 20px 13px 30px", marginBottom: 16
      }
    },
      binding, staple("28%"), staple("62%"), foreEdge, ribbon,
      h("div", { className: "flex items-center", style: { gap: 8, paddingBottom: 8, marginBottom: 9, borderBottom: "1px solid " + hexA(t.ink, .12) } },
        h("span", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 8.5, fontWeight: 700, letterSpacing: "0.2em", color: t.fog } }, props.leadLabel || "圈子里最上面那一篇"),
        h("span", { style: { flex: 1 } }),
        h("span", { style: { fontFamily: F_DISPLAY, fontSize: 11.5, color: hasMe ? t.accent : t.fog } }, no)),
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: 24, lineHeight: 1.18, color: t.ink, fontWeight: 500 } }, f.title),
      h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginTop: 5 } },
        "by " + author + "　·　",
        h("span", { style: { color: t.accent } }, cpLabel(f.cp, characters, props.userName)),
        "　·　" + fmtNum(words) + " 字"),
      h("div", { className: "line-clamp-3", style: { fontFamily: F_BODY, fontSize: 12.5, color: t.sub, lineHeight: 1.7, marginTop: 8 } }, summary),
      tagRow(10), statRow(9));

    return h("button", {
      onClick: props.onOpen, className: "w-full text-left active:translate-y-px relative flex",
      style: {
        background: paper, borderRadius: 2, boxShadow: stack,
        gap: 9, padding: "11px 17px 11px 26px", marginBottom: 13
      }
    },
      binding, staple("26%"), staple("64%"), foreEdge, ribbon,
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: 12, lineHeight: 1.6, color: hasMe ? t.accent : t.fog, width: 20, flexShrink: 0 } }, no),
      h("div", { className: "min-w-0", style: { flex: 1 } },
        // 封面上那一行：篇名 …………… 字数（目录里页码的位置）
        h("div", { className: "flex items-baseline", style: { gap: 0 } },
          h("div", { className: "truncate", style: { fontFamily: F_DISPLAY, fontSize: 16, lineHeight: 1.35, color: t.ink, fontWeight: 500, maxWidth: "76%" } }, f.title),
          leader, pageNo),
        h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 2 } },
          // ⚠️子节点要传数组，不能拿 + 去拼——元素被字符串拼接就成了 [object Object]
          "by " + author + "　·　",
          h("span", { style: { color: t.accent } }, cpLabel(f.cp, characters, props.userName)),
          mine ? h("span", { style: { color: t.accent } }, "　·　我写的") : null),
        h("div", { className: "line-clamp-2", style: { fontFamily: F_BODY, fontSize: 12, color: t.sub, lineHeight: 1.6, marginTop: 5 } }, summary),
        tagRow(7), statRow(7)));
  }

  // ---------- 掀开封面：点进一篇时的翻页 ----------
  // 列表上那一篇是一本订好的册子，点进去就该是【把封面掀开】，不是换一个屏幕。
  // 绕左边书脊那条边转进来（transform-origin:left），带一道从中缝扫过去的高光。
  // ⚠️开了「减少动态效果」的人一律不放（无障碍设置，别硬演）。
  function FicMotionStyles() {
    return h("style", null,
      "@keyframes ficOpenBook{0%{opacity:.35;transform:perspective(1400px) rotateY(-72deg)}"
      + "62%{opacity:1}100%{opacity:1;transform:perspective(1400px) rotateY(0)}}"
      + "@keyframes ficOpenGlare{0%{opacity:.5}100%{opacity:0}}"
      + ".fic-open-book{height:100%;transform-origin:left center;backface-visibility:hidden;"
      + "animation:ficOpenBook .46s cubic-bezier(.22,.71,.2,1) both}"
      + ".fic-open-book::after{content:'';position:absolute;inset:0;pointer-events:none;z-index:60;"
      + "background:linear-gradient(90deg,rgba(0,0,0,.35),rgba(0,0,0,0) 42%);"
      + "animation:ficOpenGlare .46s ease-out both}"
      + "@media(prefers-reduced-motion:reduce){.fic-open-book,.fic-open-book::after{animation:none!important}}");
  }

  // ---------- 世界观分版：书架上那一排书脊（施工规则/tabs-not-plain-pills.md）----------
  // 原来是一排圆角药丸——任何 app 都能用的那一种，等于没设计。
  // 这个 app 现实里是【一架子同人本】：一版就是一本，所以分版就长成书脊。
  //
  // ⚠️v61.12：只把药丸换成竖排的字还不够（她 2026-09-03：「现在还是很简约风，
  // 没有书架的感觉」）——书脊之所以是书脊，靠的是【布面有颜色、上下两道烫金压线、
  // 每本高矮不齐、底下压着一块搁板】。少了这几样它就只是竖着写字的方块。
  // 所以这一版把这几样都画出来：布色由版名算（同一版永远同一色）、深浅由主题算，
  // 字色从布色本身推（深布浅字/浅布深字），不写死黑白。
  function shadeRGB(rgb, k) {
    return rgb.map(function (v) { return Math.max(0, Math.min(255, Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k))); });
  }
  function rgbStr(c, a) { return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + (a == null ? 1 : a) + ")"; }
  function rgbLum(c) { return (c[0] * 299 + c[1] * 587 + c[2] * 114) / 1000; }
  // 一本书的布面：颜色从版名算出来，深浅从主题的 accent/ink 派生——
  // 换主题整架子跟着换，但同一版永远还是那个色（她认色找版）。
  function ficSpineTone(name, t) {
    const seed = ficHash("spine:" + String(name || ""));
    const base = skinRGB((seed >> 4) % 3 === 0 ? t.ink : t.accent);
    const cloth = shadeRGB(base, [-0.45, -0.3, -0.16, 0.04, 0.17, 0.29][seed % 6]);
    const dark = rgbLum(cloth) < 128;
    return {
      cloth: cloth,
      // 书名：从布色本身推，保证同一块布上永远读得出（不写死黑白）
      ink: rgbStr(shadeRGB(cloth, dark ? 0.84 : -0.7)),
      // 烫金压线：布色提亮/压深一档
      foil: rgbStr(shadeRGB(cloth, dark ? 0.5 : -0.34), 0.75),
      // 高矮不齐：一架子书本来就不是切齐的
      lift: [0, -5, 3, -2, 6, -3][(seed >> 7) % 6]
    };
  }
  function TabBar(props) {
    const t = useTheme();
    const SPINE_H = 66, OFF_H = 52;
    const rule = function (pos, color) {
      return h("div", { style: Object.assign({ position: "absolute", left: 3, right: 3, height: 1, background: color }, pos) });
    };
    return h("div", { className: "shrink-0 px-5 pb-2", style: { overflowX: "auto", WebkitOverflowScrolling: "touch" } },
      h("div", { style: { width: "max-content", minWidth: "100%" } },
        h("div", { style: { display: "flex", flexWrap: "nowrap", alignItems: "flex-end", gap: 3, paddingTop: 8 } },
          props.tabs.map(function (tab) {
            const on = tab.id === props.activeId;
            const sp = ficSpineTone(tab.name, t);
            return h("button", {
              key: tab.id,
              onClick: function () { if (on && !tab.seed) props.onEdit(tab); else props.onPick(tab.id); },
              onDoubleClick: function () { if (!tab.seed) props.onEdit(tab); },
              title: tab.name,
              className: "shrink-0 active:translate-y-px relative flex items-center justify-center",
              style: {
                // 选中＝被抽出来翻开的那一本：满高、纸色、压到搁板前面去
                height: on ? SPINE_H : OFF_H + sp.lift, width: on ? 36 : 29,
                marginBottom: on ? -7 : 0, zIndex: on ? 3 : 1,
                borderRadius: "4px 4px 0 0", overflow: "hidden", padding: "9px 0",
                background: on ? t.bg : rgbStr(sp.cloth),
                // 布面的光：左右两道暗、中间提一点，才像一个圆的书脊而不是一块色板
                backgroundImage: on ? "none"
                  : "linear-gradient(90deg,rgba(0,0,0,.22),rgba(255,255,255,.10) 34%,rgba(255,255,255,.04) 62%,rgba(0,0,0,.20))",
                border: on ? "1px solid " + t.line : "none",
                borderBottom: on ? "none" : undefined,
                boxShadow: on ? "0 3px 10px rgba(0,0,0,.20)" : "inset -1px 0 0 rgba(0,0,0,.16)",
                color: on ? t.ink : sp.ink,
                fontFamily: F_DISPLAY, fontSize: on ? 13 : 12.5, fontWeight: on ? 600 : 500,
                writingMode: "vertical-rl", textOrientation: "upright",
                letterSpacing: "0.05em", lineHeight: 1, whiteSpace: "nowrap"
              }
            },
              // 上下两道烫金压线——书脊上那两条，认书脊全靠它
              rule({ top: 5 }, on ? t.line : sp.foil),
              rule({ bottom: on ? 7 : 5 }, on ? t.line : sp.foil),
              h("span", { style: { position: "relative" } },
                String(tab.name || "").slice(0, on ? 4 : 3), (on && !tab.seed) ? "✎" : ""));
          }),
          // 架子上还空着的那一格
          h("button", {
            onClick: props.onAdd, className: "shrink-0 active:opacity-60 flex items-center justify-center",
            "aria-label": "新建世界观",
            style: {
              height: OFF_H - 6, width: 29, borderRadius: "4px 4px 0 0", marginLeft: 4,
              border: "1px dashed " + t.line, borderBottom: "none",
              color: t.fog, fontFamily: F_BODY, fontSize: 15, background: "transparent"
            }
          }, "+"),
          h("div", { style: { flex: 1, minWidth: 10 } })),
        // 搁板：一排书立在它上面，板面朝上收一道暗（书压出来的影），板底一道厚边
        h("div", {
          style: {
            height: 7, borderRadius: 2,
            background: "linear-gradient(180deg," + hexA(t.ink, .26) + "," + hexA(t.ink, .13) + ")",
            boxShadow: "inset 0 2px 3px rgba(0,0,0,.22), 0 2px 5px " + hexA(t.ink, .16)
          }
        })));
  }

  // ---------- 生成配置弹窗（齿轮）----------
  function GenSheet(props) {
    const t = useTheme();
    const cfg0 = loadCfg();
    const styles = allStylePresets(cfg0);
    const [n, setN] = useState(3);
    const [briefs, setBriefs] = useState([]);   // 每篇点的梗，没填＝自由发挥
    const authors = loadAuthors();
    const [byId, setById] = useState("");      // 点名让谁写；空＝随缘
    function setBrief(i, v) { setBriefs(function (prev) { const a = prev.slice(); a[i] = v; return a; }); }
    const [sel, setSel] = useState([]); // 选中的 CP preset id 或角色 id（这里存最终 cp 数组）
    const [pickA, setPickA] = useState(""), [pickB, setPickB] = useState("");
    const [styleIds, setStyleIds] = useState(cfg0.activeStyleIds || []); // 本次生效的文风（默认=上次选的）
    const [includeMe, setIncludeMe] = useState(false); // 俩角色 CP 时：带上「我」写成 A×我×B
    // 群像：点进去的那几个人（点的先后＝顺序），和这几个人之间是什么关系
    const [cast, setCast] = useState([]);
    const [way, setWay] = useState("");
    function toggleStyle(id) { setStyleIds(function (prev) { return prev.indexOf(id) >= 0 ? prev.filter(function (x) { return x !== id; }) : prev.concat([id]); }); }
    const cps = props.cps, characters = props.characters;
    // 最终 cp：优先用手动选（pickA/pickB，可为角色/我/原创空），否则用点选的 preset
    function chosenCP() {
      if (cast.length >= 2) return cast;           // 两个＝CP（点的先后就是左右位），三个以上＝群像
      const manual = [pickA, pickB].filter(function (x) { return x; });
      if (manual.length) return manual;
      return sel;
    }
    const isGroup = chosenCP().length >= 3;
    // 挑人的三条路互斥：不清掉另外两条，界面上会同时亮着两处而只有一处算数
    function pickCast(next) { setSel([]); setPickA(""); setPickB(""); setCast(next); }
    // 两个都是角色（都不是「我」/原创）时才给「带上我」开关
    function twoRealChars() { const cc = chosenCP(); return cc.length === 2 && cc.every(function (x) { return x && x !== "me"; }); }
    // ── 四格收放（v64.63）──────────────────────────────────────────────
    const [secOpen, setSecOpen] = useState("n");   // 一次只开一格，默认开第一格
    const briefN = briefs.slice(0, n).filter(function (x) { return String(x || "").trim(); }).length;
    function cpSummary() {
      const cc = chosenCP();
      if (!cc.length) return "还没挑";
      return cpLabel(cc, characters, props.userName)
        + (isGroup && way.trim() ? " · " + way.trim() : "")
        + (!isGroup && twoRealChars() && includeMe ? " · 带上我" : "");
    }
    function styleSummary() {
      if (!styleIds.length) return "不限";
      const names = styles.filter(function (x) { return styleIds.indexOf(x.id) >= 0; }).map(function (x) { return x.name; });
      return names.length <= 2 ? names.join("、") : names.slice(0, 2).join("、") + " 等 " + names.length + " 种";
    }
    function authorSummary() {
      if (!byId) return "随缘";
      const a = authors.filter(function (x) { return x.id === byId; })[0];
      return (a && a.name) || "随缘";
    }
    // ⚠️标题栏那一行【自带摘要】：收起来也看得见这一格现在是什么。
    //   只写个名字的话，等于把设置藏起来了——那比原来那根长条还难用。
    // ⚠️body 收成 rest：这四格里有三格是好几段并排的，写成单个 body 参数
    //   只会渲染第一段——第一版就是这么漏掉滑杆和每篇的梗那几个框的。
    function sec(id, title, summary) {
      const body = Array.prototype.slice.call(arguments, 3);
      const on = secOpen === id;
      return h("div", { key: id, style: { borderRadius: 14, border: "1px solid " + (on ? t.ink : t.line), background: t.bg2, marginBottom: 8, overflow: "hidden" } },
        h("button", { onClick: function () { setSecOpen(on ? "" : id); }, className: "w-full text-left active:opacity-70",
          style: { display: "flex", alignItems: "center", gap: 10, minHeight: 48, padding: "0 13px", background: "transparent", border: "none" } },
          h("span", { style: { flex: 1, minWidth: 0 } },
            h("span", { style: { display: "block", fontFamily: F_BODY, fontSize: 13, color: t.ink } }, title),
            h("span", { style: { display: "block", fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, summary)),
          h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, flexShrink: 0 } }, on ? "收起 ▾" : "展开 ▸")),
        on ? h.apply(null, [ "div", { style: { padding: "2px 13px 13px" } } ].concat(body)) : null);
    }
    // ⚠️整页，不是半窗（施工规则/no-half-sheet.md）。
    //   这一层要填的是四格设置，压根不需要同时看见底下那一屏 feed；
    //   而半窗的代价是固定的——不管里面装多少，先扣掉一半屏幕。
    //   （v64.63 之前它是半窗，一屏装不下、也看不出自己填到哪儿了。）
    return h("div", { className: "fixed inset-0 z-50 h-full flex flex-col", style: pageSkin("paper", t, { corner: true }) },
      h(Head, { bg: "transparent", zh: "生成配置", sub: "【" + props.tab.name + "】世界观 × 选中 CP × 篇数 → 往本版 feed 出文", onBack: props.onClose }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-6 pt-1 pb-4" },

        // ── 分成四格收起来（v64.63，她 2026-09-06：「生成新文是不是也很长很乱，
        //    你做个和装饰一样的分类收放来填吧」）──────────────────────────
        // 原来六段东西直接摞成一长条，一屏装不下、也看不出自己填到哪儿了。
        // 照贴纸编辑器那个形状：一行一格、一次只展开一格（secOpen === id）。
        // ⚠️**每一格的标题上写着这一格现在是什么**——不然收起来之后
        //   等于把设置藏起来了，比长条还难用。
        sec("n", "写几篇 · 每篇写什么", n + " 篇 · " + (briefN ? briefN + " 篇写了梗" : "都自由发挥"),
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
        ),
        sec("cp", "谁和谁", cpSummary(),
          h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: t.sub, marginBottom: 8 } }, "选择预设好的 CP，或本次手动设置一对"),
          // 从 CP 预设名单里选
          cps.length ? h("div", { className: "flex flex-wrap gap-2 mb-3" },
            cps.map(function (cp) {
              const on = JSON.stringify(chosenCP()) === JSON.stringify(cp.cp);
              return h("button", {
                key: cp.id, onClick: function () { setPickA(""); setPickB(""); setCast([]); setSel(on ? [] : cp.cp); },
                style: { fontFamily: F_BODY, fontSize: 12.5, padding: "5px 12px", borderRadius: 999, background: on ? t.accent : "transparent", color: on ? t.bg2 : t.sub, border: "1px solid " + (on ? t.accent : t.line) }
              }, cp.label || cpLabel(cp.cp, characters, props.userName));
            })
          ) : h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginBottom: 10 } }, "还没有 CP 预设，可在「我的」页添加，或下面本次手动设置一对："),

          // 本次手动设置一对（不进预设）：原创 / 我（面具人设）/ 角色
          h("div", { className: "flex items-center gap-2 mb-2" },
            h("select", { value: pickA, onChange: function (e) { setSel([]); setCast([]); setPickA(e.target.value); }, style: cpSelectStyle(t, 10, t.bg2) },
              cpOptions(characters, props.userName)),
            h("span", { style: { fontFamily: F_BODY, color: t.fog, flexShrink: 0 } }, "×"),
            h("select", { value: pickB, onChange: function (e) { setSel([]); setCast([]); setPickB(e.target.value); }, style: cpSelectStyle(t, 10, t.bg2) },
              cpOptions(characters, props.userName))),
          h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginBottom: 6 } }, "选「我」时按你在设置里的面具人设来写，没填则自由发挥"),

          // 俩角色 CP：带不带上「我」（否则默认只写他俩，即便设定里写了 TA 是我男朋友也不把我带进去）
          (!isGroup && twoRealChars()) ? h("button", { onClick: function () { setIncludeMe(function (v) { return !v; }); }, className: "w-full active:opacity-80",
            style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 12px", background: includeMe ? "rgba(0,0,0,0.04)" : t.bg2, border: "1px solid " + (includeMe ? t.ink : t.line), borderRadius: 12, marginTop: 4, marginBottom: 14 } },
            h("div", { style: { textAlign: "left" } },
              h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: t.ink } }, includeMe ? "带上我（他俩 × 我 的三人）" : "只写他俩的 CP"),
              h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 2, lineHeight: 1.5 } }, includeMe ? "把「我」作为第三方写进文里" : "只聚焦这两个角色，就算设定写了 TA 是我男朋友也不把我带进去")),
            h("div", { style: { width: 20, height: 20, flexShrink: 0, borderRadius: 6, border: "1px solid " + (includeMe ? t.ink : t.line), background: includeMe ? t.ink : "transparent", color: t.bg2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 } }, includeMe ? "✓" : "")) : null,

          // ── 几个人一起（她 2026-09-11）────────────────────────────
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 12.5, color: t.ink, letterSpacing: ".16em", margin: "16px 0 2px" } }, "或者几个人一起"),
          h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginBottom: 4, lineHeight: 1.6 } },
            "点的先后就是顺序：点两个＝这一对（先点的是左位），点三个以上＝群像，不分左右位。最多 " + CAST_MAX + " 个。"),
          h(CastPicker, { t: t, characters: characters, userName: props.userName, value: cast, onChange: pickCast }),
          // 三个人以上才问「这几个人什么关系」——两个人那是 CP，不是向
          isGroup ? h("div", { style: { marginTop: 12 } },
            h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.sub, marginBottom: 7 } }, "这几个人之间是什么关系"),
            h("div", { className: "flex flex-wrap", style: { gap: 7 } },
              GROUP_WAYS.map(function (w) {
                return h(WayTag, { key: w, t: t, tag: w, on: way.trim() === w, onClick: function () { setWay(way.trim() === w ? "" : w); } });
              })),
            // ⚠️那四个是她随口想得到的，「还有啥别的类型的想不到了」——所以这一格永远开着
            h("input", { value: way, onChange: function (e) { setWay(e.target.value.slice(0, 120)); },
              placeholder: "或者自己写：同门、一个乐队、互相看不顺眼的同事…",
              className: "w-full outline-none", style: { fontFamily: F_BODY, fontSize: 12.5, padding: "9px 0 8px", marginTop: 10,
                background: "transparent", color: t.ink, border: "none", borderBottom: "1px solid " + t.line } }),
            h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 6, lineHeight: 1.6 } },
              "空着就让她自己定一种。不是每个人都要出场——谁是重心交给写的人。")) : null,
        ),
        sec("style", "什么味道", styleSummary(),
          // 本次文风（在「我的·生成设置」里建，这里按需勾选，可多选，不选=不限）
          h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: t.sub, marginBottom: 8 } }, "文风（本次生效，可多选，不选＝不限）"),
          styles.length ? h("div", { className: "flex flex-wrap gap-2 mb-6" },
            styles.map(function (s) {
              const on = styleIds.indexOf(s.id) >= 0;
              return h("button", { key: s.id, onClick: function () { toggleStyle(s.id); }, style: { fontFamily: F_BODY, fontSize: 12.5, padding: "5px 12px", borderRadius: 999, background: on ? t.accent : "transparent", color: on ? t.bg2 : t.sub, border: "1px solid " + (on ? t.accent : t.line) } }, s.label);
            })
          ) : h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginBottom: 18 } }, "还没有文风预设，去「我的 → 生成设置」新建或导入，之后每次在这里勾选。"),
        ),
        sec("by", "谁来写", authorSummary(),
          // 谁来写这一批（她 2026-09-04）。不选＝随缘：模型自己起笔名，事后也会收进作者库。
          // ⚠️不是一排药丸：署名表上的一行行名字，选中那行左边落一个墨点、名字加重。
          authors.length ? h("div", { style: { marginBottom: 14 } },
            h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, letterSpacing: ".14em", color: t.fog, marginBottom: 6 } }, "让谁来写"),
            [{ id: "", name: "随缘（谁写都行）", style: "模型自己起个笔名，写完收进作者库" }].concat(authors).map(function (a) {
              const on = (byId || "") === a.id;
              return h("button", { key: a.id || "_any", onClick: function () { setById(a.id); }, className: "w-full text-left active:opacity-70",
                style: { display: "flex", gap: 9, alignItems: "flex-start", padding: "7px 2px", background: "transparent", border: "none", borderBottom: "1px solid " + t.line } },
                h("span", { style: { width: 7, height: 7, borderRadius: 999, marginTop: 6, flexShrink: 0, background: on ? t.ink : "transparent", border: "1px solid " + (on ? t.ink : t.line) } }),
                h("span", { style: { minWidth: 0 } },
                  h("span", { style: { display: "block", fontFamily: F_BODY, fontSize: 13, fontWeight: on ? 600 : 400, color: on ? t.ink : t.sub } }, a.name),
                  a.style ? h("span", { style: { display: "block", fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 1, lineHeight: 1.5 } }, a.style) : null));
            })) : null,
        ),

        ),
      // 页脚固定在底下：四格再怎么展开，「确定生成」永远在手边（底部只吃 0.4 条
      // 安全区，跟主聊天输入栏同一把尺子——mobile-ui-layout.md §2）
      h("div", { className: "shrink-0 flex items-center gap-3 px-6 pt-2", style: { paddingBottom: "calc(" + COMPOSER_PAD_BOTTOM + " + 12px)" } },
        h("button", { onClick: function () { setN(3); setSel([]); setPickA(""); setPickB(""); setIncludeMe(false); setBriefs([]); setById(""); }, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 13.5, color: t.sub, padding: "10px 18px", borderRadius: 12, border: "1px solid " + t.line } }, "重置"),
        h("button", { onClick: function () { props.onConfirm(n, chosenCP(), styleIds, !isGroup && twoRealChars() && includeMe, briefs.slice(0, n), authors.filter(function (a) { return a.id === byId; })[0] || null, isGroup ? way.trim() : ""); }, className: "flex-1 active:opacity-80", style: { fontFamily: F_BODY, fontSize: 14, color: t.bg2, background: t.ink, padding: "11px", borderRadius: 12 } }, "确定生成")));
  }

  // ---------- 新建/编辑自定义世界观 tab ----------
  function TabSheet(props) {
    const t = useTheme();
    const editing = props.tab;
    const [name, setName] = useState(editing ? editing.name : "");
    const [desc, setDesc] = useState(editing ? editing.desc : "");
    return h("div", { className: "fixed inset-0 z-50 flex items-end", style: { background: "rgba(0,0,0,0.35)" }, onClick: props.onClose },
      // 掀起来那块该是同一张纸——父页铺的就是 pageSkin("paper")，退回平色就等于
      // 从纸上掀起一块塑料板（no-half-sheet.md 的 skin 那一节）
      h("div", { onClick: function (e) { e.stopPropagation(); }, className: "w-full rounded-t-3xl px-6 pt-5 pb-8", style: pageSkin("paper", t, { strength: .6, corner: false }) },
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
    const [busyMore, setBusyMore] = useState(false); // 「让他接着写」那一枪：她按了才发
    const [busyBack, setBusyBack] = useState(false); // 「去请她回来」那一枪
    const [fileIdx, setFileIdx] = useState(-1);      // 正在挑「拿给谁看」的那一章
    const [filedNote, setFiledNote] = useState("");  // 刚落进哪儿，给她一句回执
    const [busyRev, setBusyRev] = useState(false);   // 刷书评（可与追更并行）
    const [myWrite, setMyWrite] = useState(false);  // 她自己写下一章（v64.63）
    const [myChap, setMyChap] = useState("");
    const [ghostOpen, setGhostOpen] = useState(false); // 请枪手：先挑人（v64.64）
    const [ghostId, setGhostId] = useState("");        // 空＝照原样，这篇原来那位太太接着写
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
    // 房间里那张卡直接翻到这一章（她 2026-09-12 要的那个快捷键）。
    // ⚠️用完就还回去：不还的话她往后翻一章、组件一重画又被拽回来。
    useEffect(function () {
      const c = Number(props.startChap);
      if (!(c >= 0)) return;
      const n = ((props.fic && props.fic.chapters) || []).length;
      if (n) setChapIdx(Math.max(0, Math.min(n - 1, c)));
      props.onStartChapUsed && props.onStartChapUsed();
    }, [props.startChap]);
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

    function genOpts() { const cfg = window.Fanfic.loadCfg(); return { style: window.Fanfic.activeStyleText(cfg), perFic: cfg.perFic, minChars: cfg.minChars, chatMaterial: window.Fanfic.chatMaterialFor(chars) }; }
    // 字数地板：界面上提示的、提示词里发的、写完数的是同一个数（minCharsFor 只此一份）
    const minChars = window.Fanfic.minCharsFor(window.Fanfic.loadCfg());

    // by＝她点名请的那位枪手；不传＝照原样，genNextChapter 自己去名册里找这篇原来那位太太。
    async function addChapter(by, want, hard) {
      if (busyChap) return;
      const newIdx = (f.chapters || []).length; // 新章的索引
      const K = window.Fanfic;
      const heat = K.heatNow(f, Date.now());
      const ownCard = K.findAuthor(f.author);
      // ⚠️掷在这儿，不在提示词里：抢没抢笔、撂不撂挑子是【代码】说了算，
      //   模型只负责她开口说什么（跟电台「今天哪个频率有台」同一条道理）。
      // ⚠️这儿用 Math.random 是对的：这不是「世界是否存在」那种要长期稳定的事，
      //   是这一次的一掷；用种子的话她重点一次会得到同一个结果，那才怪。
      const ownNm = String(f.author || "").trim();
      const byChar = (by && by.char) || null;                 // 她自己的人接了这一章
      const byNmRaw = byChar ? "" : String((by && by.name) || "").trim();
      // ④在这儿接进③：请了一位跟她有过节的枪手，热度涨得更凶
      const feud = !!(byNmRaw && ownNm && K.circleFeud(ownNm, byNmRaw));
      const sameCP = !!(byNmRaw && ownNm && K.sameCPWith(ownNm, byNmRaw, K.loadFics(), props.allChars || chars, props.userName));
      // 抢笔只发生在【太太】之间：她自己的人接手，原作者照样说话，但抢不回来
      // 请的是对家：她自己也可以不接、或者接了不好好写。⚠️拒绝那一次【连枪都不打】。
      const gStance = byChar ? "" : K.ghostStance(feud, by, Math.random());
      if (gStance === "refuse") {
        K.circlePush({ a: byNmRaw, b: ownNm, kind: "turnDown", title: f.title });
        props.toast && props.toast("「" + byNmRaw + "」不接这篇——她跟「" + ownNm + "」有过节");
        return;
      }
      const grabbed = !!by && !byChar && !!ownCard && Math.random() < K.grabChance(heat);
      // 撂挑子先预告：这一章的 authorNote 里她会把「我不写了」说出来，
      // 下次她再点原作者就被挡住——有铺垫、有台词，而且不多花一枪。
      const quitting = !f.authorQuit && (!!by || grabbed) && Math.random() < K.refuseChance(grabbed ? heat : K.heatAfter(f, "ghost", { by: by, hardWant: hard, feud: feud }));
      const run = async function () {
        const ch = await K.genNextChapter(props.active, f, props.tab, chars, props.userName, storyLore("续章"),
          Object.assign(genOpts(), {
            author: byChar ? null : (by || null), want: want || "", hardWant: !!hard,
            grabbed: grabbed, quitting: quitting, sameCP: sameCP, lazy: gStance === "lazy",
            byChar: byChar,
            charRel: byChar && props.relOf ? props.relOf(byChar.id) : null,
            writerAxes: byChar ? K.rollWriterAxes(byChar.id, f.id, (f.chapters || []).length) : null,
            nameOf: function (id) { const c = (props.allChars || chars || []).filter(function (x) { return x && x.id === id; })[0]; return c ? (c.remark || c.name) : "那个人"; }
          }));
        // 请了别人代笔就把名字记在这一章上：翻到这一章时看得见是谁写的。
        // ⚠️记在【章】上不是记在【篇】上——这篇的作者没变，只是这一章的笔换了人。
        // ⚠️这里不能用外面那个 authorName()——Reader 里有个同名的 const 把它挡住了
        const byNm = grabbed ? "" : (byChar ? (byChar.remark || byChar.name) : String((by && by.name) || "").trim());
        if (byNm && byNm !== String(f.author || "").trim()) ch.byAuthor = byNm;
        if (byChar) ch.byCharId = byChar.id;
        if (grabbed) ch.grabbed = true;
        const note = String(ch.authorNote || "").trim();
        props.onUpdate(f.id, function (fic) {
          fic.chapters = (fic.chapters || []).concat([ch]);
          // 设定卡只增不改 + 伏笔盒收支：合并的规矩只写在 applyChapterMeta 那一处
          const meta = window.Fanfic.applyChapterMeta(fic, ch);
          fic.bible = meta.bible; fic.seeds = meta.seeds;
          if (want && want.trim()) fic.lastWant = want.trim().slice(0, 600);
          // 热度：抢回来自己写＝她出手了，热度往下走；请了枪手才往上加
          Object.assign(fic, window.Fanfic.heatFields(fic, { grabbed: grabbed, by: by, hardWant: hard, feud: feud }));
          // 她那句话挂在【这一章】上：章末显示，书评区不重复
          if (note) fic.reviews = (fic.reviews || []).concat([{
            id: uid("rv"), author: String(fic.author || "").trim() || "原作者", isAuthor: true,
            content: note, chapterIdx: newIdx, replies: []
          }]);
          if (quitting) { fic.authorQuit = true; fic.quitSay = note; }
          fic.updatedAt = Date.now(); return fic;
        });
        // ④ 圈子流水：只有【真发生过一件事】才记一笔，不生成日常
        if (ownNm && byNmRaw && !byChar) {
          if (grabbed) K.circlePush({ a: ownNm, b: byNmRaw, kind: "grab", title: f.title });
          else K.circlePush({ a: byNmRaw, b: ownNm, kind: "ghost", title: f.title });
        }
        if (quitting && ownNm) K.circlePush({ a: ownNm, b: byNmRaw, kind: "quit", title: f.title, say: note });
        props.toast && props.toast(grabbed ? "「" + String(f.author || "原作者") + "」把笔抢回去自己写了" : "已更新一章");
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
    // 去请她回来：撂挑子之后唯一那条路。⚠️成不成【这儿掷】，模型只写她怎么回。
    async function askAuthorBack() {
      if (busyBack) return;
      setBusyBack(true);
      try {
        const K = window.Fanfic;
        const ok = Math.random() < K.backChance(K.heatNow(f, Date.now()));
        const r = await K.genAuthorBack(props.active, f, props.tab, chars, props.userName, storyLore("续章"), genOpts(), ok);
        props.onUpdate(f.id, function (fic) {
          fic.reviews = (fic.reviews || []).concat([{ id: uid("rv"), author: String(fic.author || "").trim() || "原作者", isAuthor: true, content: r.say, replies: [] }]);
          if (r.ok) { fic.authorQuit = false; fic.quitSay = ""; fic.authorHeat = Math.max(0, window.Fanfic.heatNow(fic, Date.now()) - 25); fic.heatTs = Date.now(); }
          fic.updatedAt = Date.now(); return fic;
        });
        const own2 = String(f.author || "").trim();
        if (own2) K.circlePush({ a: own2, b: "", kind: r.ok ? "back" : "refuse", title: f.title, say: r.say });
        props.toast && props.toast(r.ok ? "她答应回来写了" : "她还是没答应");
      } catch (e) { props.toast && props.toast(String(e.message || e)); }
      setBusyBack(false);
    }
    // 「让他接着写」：她按了才发的那第二枪。接着写不是重写——
    // 重写是掷骰子（可能更短），接着写必然变长，还顺带救回被截断的那种。
    async function moreChapter(i) {
      if (busyMore) return;
      setBusyMore(true);
      try {
        const add = await window.Fanfic.genChapterMore(props.active, f, props.tab, chars, props.userName, storyLore("续章"), genOpts(), i);
        props.onUpdate(f.id, function (fic) {
          const chs = (fic.chapters || []).slice();
          const cur = chs[i]; if (!cur) return fic;
          chs[i] = Object.assign({}, cur, { content: String(cur.content || "").trim() + "\n\n" + add.add, endHook: add.endHook || cur.endHook });
          fic.chapters = chs;
          const meta = window.Fanfic.applyChapterMeta(fic, add);
          fic.bible = meta.bible; fic.seeds = meta.seeds;
          fic.updatedAt = Date.now(); return fic;
        });
        props.toast && props.toast("接上去了");
      } catch (e) { props.toast && props.toast(String(e.message || e)); }
      setBusyMore(false);
    }
    // 她自己写的那一章：跟枪手写的走【同一条落地路】（onUpdate + chapters.concat），
    // 所以翻页、阅读进度、分享给角色那几处一个字都不用改。
    // ⚠️endHook 留空：那是给续写用的锚点，她写的时候没这一栏——
    //   genNextChapter 拿到空的会自己写成「（无锚点）」，不会崩。
    function saveMyChapter() {
      const txt = myChap.trim();
      if (!txt) { props.toast && props.toast("还没写呢"); return; }
      const newIdx = (f.chapters || []).length;
      props.onUpdate(f.id, function (fic) {
        fic.chapters = (fic.chapters || []).concat([{ content: txt, endHook: "", byMe: true }]);
        fic.updatedAt = Date.now(); return fic;
      });
      setMyChap(""); setMyWrite(false); setChapIdx(newIdx);
      props.toast && props.toast("接上去了");
    }
    async function loadReviews() {
      if (busyRev) return;
      setBusyRev(true);
      try {
        const rv = await window.Fanfic.genReviews(props.active, f, props.tab, storyLore("书评"), props.characters, props.userName);
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
      // 顶栏走共用的 Head（施工规则/mobile-ui-layout.md §1）：手写那条身上一个挂点都没有，
      // 「同人文」这一页的主题 CSS 因此抓不到顶栏。纸底铺在外壳上，所以 bg 传 transparent。
      h(Head, { zh: f.title, sub: props.tab.name, onBack: props.onBack, bg: "transparent", noLine: true,
        right: h("div", { className: "flex items-center justify-end shrink-0", style: { gap: 10 } },
          // 换这一篇的纸。⚠️只改这一篇，别的篇和默认那张都不动。
          h("button", { onClick: function () { setPaperOpen(true); }, className: "active:opacity-60", "aria-label": "换书页",
            style: { width: 20, height: 20, borderRadius: 5, background: _paper.bg, border: "1.5px solid " + t.line, display: "flex", alignItems: "center", justifyContent: "center" } },
            h("span", { style: { width: 8, height: 1.5, background: _paper.ink, borderRadius: 1 } })),
          h("button", { onClick: function () { props.onToggleShelf(f.id); }, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 12, color: f.onShelf ? t.accent : t.fog } }, f.onShelf ? "★" : "☆")) }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-6 pb-10" },
        h("div", { className: "flex items-start", style: { gap: 9 } },
          h("div", { style: { width: 3.5, alignSelf: "stretch", borderRadius: 2, background: _hasMe ? t.accent : t.line, marginTop: 5 } }),
          h("div", { className: "flex-1 min-w-0" },
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 23, lineHeight: 1.28, color: t.ink, fontWeight: 500 } }, f.title),
            h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginTop: 4 } }, "by " + authorName))),
        metaRow((f.cp || []).length >= 3 ? "这几个" : "这一对",
          h("div", null,
            h("span", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.accent } },
              cpLabel(f.cp, props.characters, props.userName) + (String(f.groupWay || "").trim() ? " · " + String(f.groupWay).trim() : "")),
            (function () {
              const gone = absentLeads(f, props.characters, props.userName);
              return gone.length ? h("span", { style: { display: "block", fontFamily: F_BODY, fontSize: 10.5, color: "#a8392f", marginTop: 3, lineHeight: 1.6 } },
                "⚠️「" + gone.join("」「") + "」从头到尾没出现过——这一篇多半被写跑了") : null;
            })())),
        (f.tags || []).length ? metaRow("标签", h("div", { className: "flex flex-wrap", style: { gap: 5 } },
          (f.tags || []).map(function (tag, i) { return h(FicTag, { key: i, tag: tag }); }))) : null,
        metaRow("数目", h("div", { className: "flex flex-wrap", style: { gap: 9, fontFamily: F_BODY, fontSize: 11, color: t.fog, paddingTop: 1 } },
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
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 13, color: t.fog, textAlign: "center", lineHeight: 1.35 } },
              h("span", { style: { display: "block" } }, "第 " + (idx + 1) + " / " + chs.length + " 章"),
              // 这一章的笔在谁手上：她自己写的、或请了谁代笔。原作者自己写的那几章不标
              // （每一章都写一遍「by 某某」＝等于没标）。
              (ch.byMe || ch.byAuthor || ch.grabbed) ? h("span", { style: { display: "block", fontFamily: F_BODY, fontSize: 10, color: ch.grabbed ? t.tint : t.fog, opacity: ch.grabbed ? 1 : .8 } },
                ch.grabbed ? "「" + (f.author || "原作者") + "」抢回去自己写的" : (ch.byMe ? "你写的" : ch.byAuthor + " 代笔")) : null),
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
            // 原作者看完这一章在底下留的那句话。挂在【这一章】上，所以它出现在这儿，
            // 不是混在书评区里（书评区那边只渲染不带 chapterIdx 的——一份数据，两处各管各的）。
            (function () {
              const notes = (f.reviews || []).filter(function (r) { return r && r.chapterIdx === idx; });
              if (!notes.length) return null;
              return h("div", { style: { marginTop: 16, paddingTop: 12, borderTop: "1px solid " + t.line } },
                notes.map(function (r) {
                  return h("div", { key: r.id, style: { marginBottom: 6 } },
                    h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.tint, marginBottom: 3 } }, r.author, authorTag(t)),
                    h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, lineHeight: 1.75, color: t.sub } }, r.content));
                }));
            })(),
            // 记进房间 / 拿给他看。⚠️**不自动发生**：她按一下才有
            //（自动往主线记忆库写那一版是错的，撤掉了）。这一步一分钱不花。
            h("div", { style: { marginTop: 12, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" } },
              h("button", { onClick: function () { setFileIdx(idx); }, className: "active:opacity-60",
                style: { fontFamily: F_BODY, fontSize: 11.5, color: t.sub, background: "transparent", border: "1px solid " + t.line, borderRadius: 999, padding: "6px 12px", minHeight: 34 } },
                ch.byCharId ? "记进房间" : "拿给他看"),
              filedNote ? h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog } }, filedNote) : null),
            // 偷懒的那一章不许悄无声息地落盘（她 2026-09-11）。
            // ⚠️只留一行字 + 一颗键，**绝不自动再打一枪**——她定的：任何东西都不接受一次发两遍。
            (function () {
              const miss = window.Fanfic.shortBy(ch.content, minChars);
              if (!miss) return null;
              return h("div", { style: { marginTop: 14, paddingTop: 10, borderTop: "1px dashed " + t.line, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" } },
                h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, lineHeight: 1.6 } },
                  "这章只有 " + window.Fanfic.countChars(ch.content) + " 字，你要的是 " + minChars + " 字"),
                h("button", { onClick: function () { moreChapter(idx); }, disabled: busyMore, className: "active:opacity-60",
                  style: { fontFamily: F_BODY, fontSize: 11.5, color: busyMore ? t.fog : t.accent, background: "transparent", border: "1px solid " + t.line, borderRadius: 999, padding: "6px 12px", minHeight: 34 } },
                  busyMore ? "接着写…" : "让他接着写"));
            })(),
            pager(false));
        })(),

        // 续写：两个入口（v64.63，她 2026-09-06：「我写了的为啥只能追更！
        // 应该换成两个入口一个是我续写一个是请枪手再让模型继续」）。
        // ⚠️原来这里只有一颗「追更」＝只能让模型写。她自己写的文，凭什么下一章轮不到她。
        myWrite ? h("div", { style: { marginBottom: 32 } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, marginBottom: 7 } }, "第 " + ((f.chapters || []).length + 1) + " 章 · 你自己写"),
          h("textarea", { value: myChap, onChange: function (e) { setMyChap(e.target.value); }, placeholder: "接着往下写…",
            className: "w-full outline-none", style: { fontFamily: "'Noto Serif SC',serif", fontSize: 14.5, lineHeight: 1.95, padding: "13px 14px", borderRadius: 12,
              background: t.bg2, color: t.ink, border: "1px solid " + t.line, minHeight: 260, resize: "vertical" } }),
          h("div", { className: "flex", style: { gap: 8, marginTop: 9 } },
            h("button", { onClick: function () { setMyWrite(false); setMyChap(""); }, className: "active:opacity-70",
              style: { minHeight: 44, padding: "0 16px", borderRadius: 12, border: "1px solid " + t.line, background: "transparent", fontFamily: F_BODY, fontSize: 13, color: t.sub } }, "算了"),
            h("button", { onClick: saveMyChapter, className: "flex-1 active:opacity-80",
              style: { minHeight: 44, borderRadius: 12, border: "none", background: t.ink, color: t.bg2, fontFamily: F_BODY, fontSize: 13.5 } }, "写好了，接上去"))) : null,
        !myWrite ? h("div", { className: "flex", style: { gap: 8, marginBottom: 32 } },
          h("button", { onClick: function () { setMyWrite(true); }, className: "flex-1 active:opacity-70",
            style: { fontFamily: F_BODY, fontSize: 13.5, color: t.ink, minHeight: 46, borderRadius: 12, border: "1px solid " + t.ink, background: "transparent" } },
            "我来写下一章"),
          h("button", { onClick: function () { setGhostOpen(true); }, disabled: busyChap, className: "flex-1 active:opacity-70",
            style: { fontFamily: F_BODY, fontSize: 13.5, color: t.sub, minHeight: 46, borderRadius: 12, border: "1px dashed " + t.line, background: "transparent", opacity: busyChap ? 0.5 : 1 } },
            busyChap ? "枪手写着呢…" : "请枪手接着写")) : null,

        // 书评区
        h("div", { className: "flex items-center justify-between mb-3" },
          // ⚠️数的是【这儿显示的】那些：挂在某一章上的留言在那一章底下，不在这儿——
          //   把它也数进来，就会出现「书评 · 2」底下只有一条的怪事
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 17, color: t.ink } }, "书评 · " + (f.reviews || []).filter(function (r) { return r && r.chapterIdx == null; }).length),
          h("button", { onClick: loadReviews, disabled: busyRev, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 12, color: t.accent } }, busyRev ? "召唤读者中…" : "刷出书评")),
        // 我直接写书评
        h("div", { className: "flex items-center gap-2 mb-4" },
          h("input", { value: newComment, onChange: function (e) { setNewComment(e.target.value); }, onKeyDown: function (e) { if (e.key === "Enter") postComment(); }, placeholder: "写条书评…", className: "flex-1 outline-none", style: { fontFamily: F_BODY, fontSize: 12.5, padding: "8px 11px", borderRadius: 10, background: t.bg2, color: t.ink, border: "1px solid " + t.line } }),
          h("button", { onClick: postComment, disabled: busy === "myrev", className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 12.5, color: t.accent, padding: "0 4px" } }, busy === "myrev" ? "…" : "发表")),
        (function () {
          // ⚠️这颗按钮只此一份：楼主那一行和楼中楼那一行都是它。
          //   各写一份的结果就是「楼主点得进、回复里点不进」——同一件事写在两处的老毛病。
          const penName = function (r, size) {
            return (r.pen && props.onOpenAuthor)
              ? h("button", { onClick: function () { props.onOpenAuthor(r.pen); }, className: "active:opacity-60",
                  style: { fontFamily: F_BODY, fontSize: size, color: "inherit", background: "transparent", border: "none", padding: 0, textDecoration: "underline", textUnderlineOffset: 3 } }, r.author)
              : r.author;
          };
          const rs = (f.reviews || []).filter(function (r) { return r && r.chapterIdx == null; }); return rs.length ? rs.map(function (r) {
          return h("div", { key: r.id, className: "mb-3 pb-3", style: { borderBottom: "1px solid " + t.line } },
            // 名册里那几位：名字点得进她的主页（路人读者没有主页，照旧是死的）
            h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: r.me ? t.accent : (r.isAuthor ? t.tint : t.fog), marginBottom: 3 } },
              penName(r, 12),
              r.isAuthor ? authorTag(t) : null),
            h("div", { style: { fontFamily: F_BODY, fontSize: 13, lineHeight: 1.6, color: t.ink } }, r.content),
            (r.replies || []).map(function (rp) {
              return h("div", { key: rp.id, className: "mt-2 ml-3 pl-3", style: { borderLeft: "2px solid " + t.line } },
                h("span", { style: { fontFamily: F_BODY, fontSize: 11.5, color: rp.me ? t.accent : (rp.isAuthor ? t.tint : t.fog) } }, penName(rp, 11.5), "：", rp.isAuthor ? authorTag(t) : null),
                h("span", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.sub } }, rp.content));
            }),
            replyTo === r.id
              ? h("div", { className: "flex items-center gap-2 mt-2" },
                  h("input", { value: replyText, autoFocus: true, onChange: function (e) { setReplyText(e.target.value); }, onKeyDown: function (e) { if (e.key === "Enter") sendReply(r.id); }, placeholder: "回复…", className: "flex-1 outline-none", style: { fontFamily: F_BODY, fontSize: 12.5, padding: "6px 10px", borderRadius: 8, background: t.bg2, color: t.ink, border: "1px solid " + t.line } }),
                  h("button", { onClick: function () { sendReply(r.id); }, style: { fontFamily: F_BODY, fontSize: 12.5, color: t.accent } }, "发送"))
              : h("button", { onClick: function () { setReplyTo(r.id); setReplyText(""); }, className: "mt-1.5 active:opacity-60", style: { fontFamily: F_BODY, fontSize: 11, color: t.fog } }, "回复"));
        }) : h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, padding: "8px 0" } }, "还没有书评，写一条或点「刷出书评」召唤一批读者。"); })()),
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
        onPickGroup: function (g) { setFwdOpen(false); props.onForwardToGroup && props.onForwardToGroup(f, g); } }) : null,
      fileIdx >= 0 ? h(FilePage, {
        fic: f, chapIdx: fileIdx,
        chars: (props.fwdChars || props.characters || []).filter(function (c) { return c && !c.npc; }),
        defaultCharId: ((f.chapters || [])[fileIdx] || {}).byCharId || "",
        onClose: function () { setFileIdx(-1); },
        onFile: function (c, noteOnly, roomPick) {
          if (!c) return;
          const i = fileIdx;
          const ch2 = (f.chapters || [])[i] || {};
          const mine = ch2.byCharId === c.id;
          const nm = c.remark || c.name;
          if (noteOnly) {
            props.onNoteChapter && props.onNoteChapter(c.id, window.Fanfic.chapterNote(f, i, nm, mine, props.userName));
            setFiledNote("记了一笔");
          } else {
            // 卡上要露的那几样（她 2026-09-11：「把我转发给他的也做成卡吧」）——
            // 跟转发那张同一套字段，所以共用同一张卡
            const r = props.onFileChapter && props.onFileChapter(c.id, window.Fanfic.chapterCard(f, i, nm, mine, props.userName), roomPick,
              { ficId: f.id, ficTitle: f.title, author: f.author || "",
                cpText: cpLabel(f.cp, props.characters, props.userName),
                note: "第 " + (i + 1) + " 章 · " + (mine ? "他写的" : "拿给你看"),
                // ⚠️这儿的那一章叫 ch2（ch 在这个闭包里压根不存在）——
                //   写成 ch.content 就是当场抛异常，按钮看着像死的（她 2026-09-11 报）。
                excerpt: String(ch2.content || "").trim().slice(0, 90) });
            setFiledNote(r ? "放进了「" + r.roomName + "」" : "没能放进去");
          }
          setFileIdx(-1);
        }
      }) : null,
      ghostOpen ? h(GhostPage, { fic: f, pickedId: ghostId, backBusy: busyBack, onAskBack: askAuthorBack,
        chars: (props.fwdChars || props.characters || []).filter(function (c) { return c && !c.npc; }), relOf: props.relOf,
        onPick: function (id) { setGhostId(id); },
        onClose: function () { setGhostOpen(false); },
        onGo: function (by, want, hard) { setGhostOpen(false); addChapter(by, want, hard); } }) : null);
  }

  // ---------- 请谁接着写（v64.64，她 2026-09-06：「请枪手可以选择已有的作者吧，也可以不选」）
  // 整页，不是半窗（no-half-sheet.md）：一位太太一行两句，作者库能攒到几十位，
  // 半窗一掀就只剩三四行——「拿不准就用整页」。
  function GhostPage(props) {
    const t = useTheme();
    const f = props.fic;
    const authors = loadAuthors();
    const own = String(f.author || "").trim();
    // 点单：她想看的剧情走向（她 2026-09-11）。两档由她自己选，不按作者身份分权——
    // 分权的乐趣在于不确定，而不确定只有在她自愿的时候才是乐趣。
    const [want, setWant] = useState("");
    const [hard, setHard] = useState(false);
    const lastWant = String(f.lastWant || "").trim();
    // 「照原样」那一行：名册里认得这篇的太太就写她的名字——她自己的连载本来就该她接着写。
    const ownCard = findAuthor(own);
    const quit = !!f.authorQuit;
    const head = { id: "", quit: quit,
      name: quit ? "「" + own + "」这篇不写了" : (ownCard ? "照原样：「" + own + "」自己接着写" : (own ? "照原样：「" + own + "」接着写" : "随缘（谁接都行）")),
      // ⚠️这一行写她【真正的路数】，不是一句「会带进这一章」的空话——
      //   旁边那两位列的都是自己的路数，这一行摆句解说词就成了另一种东西。
      style: quit ? (String(f.quitSay || "").slice(0, 80) || "她撂挑子了，这一章只能另请人接")
        : (ownCard ? (ownCard.style || "她的路数、雷点都会带进这一章") : (own ? "名册里还没有这位太太的卡，只按前情往下写" : "模型自己接，不钉笔名")),
      sore: quit ? "" : (ownCard ? ownCard.sore : "") };
    // ④：跟这篇原作者有过节的，在她名下标一行小字——请谁接手这件事就有了分量
    const circle = loadCircle();
    // ⚠️没 id 的太太（早期存档、或从别处导进来的）会跟「照原样」那一行撞上同一个 key
    //   （两边都落成 "_own"）：React 拿它俩当同一格，翻到「你的人」那一叠之后，
    //   「照原样」那行还赖在名单顶上；点她也等于点了「照原样」，最后接笔的是原作者。
    //   笔名在库里本来就是唯一的（upsertAuthor 按笔名去重），拿它兜个 id 就够。
    const penRows = authors.filter(function (a) { return authorName(a) !== own; }).map(function (a) {
      return Object.assign({}, a, { id: a.id || ("au:" + authorName(a)) },
        own ? { feud: circleFeud(own, authorName(a), circle) } : {});
    });
    // 第三类笔：她自己的人。⚠️这一行的 style 写的是【他跟这篇文什么关系】，
    //   不是一句「他会按人设写」的空话——那正是旁边两组都在说的那种实话。
    const charRows = (props.chars || []).map(function (c) {
      const st = stanceFor(c, f, (props.relOf && props.relOf(c.id)) || {});
      const zh = { self_user: "这篇写的就是他和你", self_other: "这篇把他跟别人配了",
        jealous: "你在里面，他不在", tied: "他跟里面那位有关系", outsider: "跟他没关系，纯帮忙" };
      return { id: "char:" + c.id, name: (c.remark || c.name) + "（你的人）", style: zh[st.kind] || "", char: c };
    });
    // ⚠️分两叠（她 2026-09-11：「请枪手写能不能把作者和角色分成两个 tab」）。
    //   ⚠️不是一排药丸（tabs-not-plain-pills.md）：这一页是【找人代笔的委托单】，
    //   委托单分栏靠的是「你翻到哪一页」——所以做成两张纸的页签：
    //   翻开的那张满高、纸色、直接长进底下的名单里；压在后面那张矮一截、暗着。
    //   选中态不只靠色：高度、字重、跟底下那张纸连不连着，三样一起变。
    const [pane, setPane] = useState("pen");
    const rows = pane === "pen" ? [head].concat(penRows) : charRows;
    const picked = rows.filter(function (a) { return (a.id || "") === (props.pickedId || ""); })[0] || rows[0] || head;
    const pageTab = function (key, label, n) {
      const on = pane === key;
      return h("button", { key: key, onClick: function () { setPane(key); props.onPick(""); }, className: "active:opacity-70",
        style: { flex: 1, minHeight: 44, padding: on ? "11px 6px 13px" : "14px 6px 10px",
          border: "1px solid " + t.line, borderBottom: on ? "none" : "1px solid " + t.line,
          borderRadius: "10px 10px 0 0", background: on ? t.bg : "transparent", marginBottom: on ? -1 : 3,
          fontFamily: F_BODY, fontSize: on ? 13 : 12, fontWeight: on ? 600 : 400, color: on ? t.ink : t.fog,
          position: "relative", zIndex: on ? 2 : 1 } },
        label + (n ? " · " + n : ""));
    };
    const ghostPicked = !!picked.id;
    // ⚠️这两格不是一排药丸（施工规则/tabs-not-plain-pills.md）：这一页是【给太太的稿约单】，
    //   所以它长成单子上那两行勾选项——方框、打勾、底下一道格线。换个 app 就不成立了。
    const optRow = function (on, title, note, onPick) {
      return h("button", { onClick: onPick, className: "w-full text-left active:opacity-70",
        style: { display: "flex", gap: 9, alignItems: "flex-start", padding: "9px 2px", minHeight: 44, background: "transparent", border: "none", borderBottom: "1px dashed " + t.line } },
        h("span", { style: { width: 14, height: 14, marginTop: 3, flexShrink: 0, borderRadius: 2, border: "1px solid " + (on ? t.ink : t.line), display: "flex", alignItems: "center", justifyContent: "center" } },
          on ? h(ICheck, { size: 10, color: t.ink }) : null),
        h("span", { style: { minWidth: 0 } },
          h("span", { style: { display: "block", fontFamily: F_BODY, fontSize: 13, fontWeight: on ? 600 : 400, color: on ? t.ink : t.sub } }, title),
          h("span", { style: { display: "block", fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 2, lineHeight: 1.55 } }, note)));
    };
    return h("div", { className: "fixed inset-0 z-50 h-full flex flex-col", style: pageSkin("paper", t, { corner: true }) },
      h(Head, { bg: "transparent", zh: "请谁接着写", sub: "《" + f.title + "》第 " + ((f.chapters || []).length + 1) + " 章", onBack: props.onClose }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-6 pb-4" },
        h("div", { style: { display: "flex", gap: 6, marginTop: 8, alignItems: "flex-end" } },
          pageTab("pen", "圈里的太太", penRows.length), pageTab("char", "你的人", charRows.length)),
        h("div", { style: { border: "1px solid " + t.line, borderTop: "none", borderRadius: "0 0 10px 10px", padding: "2px 10px 6px" } },
        // ⚠️不是一排药丸：署名表上的一行行名字，选中那行左边落一个墨点、名字加重
        //   （tabs-not-plain-pills.md：换个 app 就不成立的形状才算长出来了）
        rows.map(function (a) {
          const on = (a.id || "") === (picked.id || "");
          return h("button", { key: a.id || "_own", disabled: !!a.quit, onClick: function () { props.onPick(a.id || ""); }, className: "w-full text-left active:opacity-70",
            style: { display: "flex", gap: 10, alignItems: "flex-start", padding: "11px 2px", minHeight: 44, background: "transparent", border: "none", borderBottom: "1px solid " + t.line, opacity: a.quit ? .55 : 1 } },
            h("span", { style: { width: 7, height: 7, borderRadius: 999, marginTop: 7, flexShrink: 0, background: on ? t.ink : "transparent", border: "1px solid " + (on ? t.ink : t.line) } }),
            h("span", { style: { minWidth: 0 } },
              h("span", { style: { display: "block", fontFamily: F_BODY, fontSize: 13.5, fontWeight: on ? 600 : 400, color: on ? t.ink : t.sub } }, a.name),
              a.style ? h("span", { style: { display: "block", fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 2, lineHeight: 1.55 } }, a.style) : null,
              (on && a.sore) ? h("span", { style: { display: "block", fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 3, lineHeight: 1.55 } }, "护着：" + a.sore) : null,
              a.feud ? h("span", { style: { display: "block", fontFamily: F_BODY, fontSize: 10, color: t.tint, marginTop: 3 } }, "她跟「" + own + "」有过节") : null));
        }),
        rows.length ? null : h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, padding: "10px 2px", lineHeight: 1.7 } },
          pane === "pen" ? "作者库还空着。出一批文、或去「作者」那一页请几位太太进来，之后就能点名让谁接。"
            : "还没有角色。角色接的那一章，原作者照样会在底下说话——但她抢不回去。")),
        // 能翻脸就得能和好：不然作者库单向枯竭，攒三十位太太最后一个都不肯写
        quit ? h("button", { onClick: props.onAskBack, disabled: !!props.backBusy, className: "w-full active:opacity-70",
          style: { marginTop: 12, minHeight: 44, borderRadius: 12, border: "1px dashed " + t.line, background: "transparent",
            fontFamily: F_BODY, fontSize: 12.5, color: props.backBusy ? t.fog : t.accent } },
          props.backBusy ? "去问她…" : "去请「" + own + "」回来") : null,

        // ── 点单 ──
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: t.ink, margin: "22px 0 4px" } }, "这一章你想看什么"),
        h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginBottom: 8, lineHeight: 1.6 } },
          "空着就让她自己写。"),
        h("textarea", { value: want, onChange: function (e) { setWant(e.target.value); }, placeholder: "想看的走向、想让谁出场、想在哪儿收…",
          className: "w-full outline-none", style: { fontFamily: F_BODY, fontSize: 13, lineHeight: 1.8, padding: "11px 12px", borderRadius: 10,
            background: t.bg2, color: t.ink, border: "1px solid " + t.line, minHeight: 84, resize: "vertical" } }),
        (lastWant && !want.trim()) ? h("button", { onClick: function () { setWant(lastWant); }, className: "active:opacity-60",
          style: { fontFamily: F_BODY, fontSize: 11, color: t.accent, background: "transparent", border: "none", padding: "7px 2px", minHeight: 34, textAlign: "left" } },
          "填回上次那条：" + lastWant.slice(0, 22) + (lastWant.length > 22 ? "…" : "")) : null,
        want.trim() ? h("div", { style: { marginTop: 6 } },
          optRow(!hard, "许个愿", ghostPicked
            ? "当读者的呼声递过去。她是被请来接这篇的，多半会顺着走，但不必当命令。"
            : "当读者的呼声递过去。这是她自己的连载——听不听、怎么听，按她的脾气来。",
            function () { setHard(false); }),
          optRow(hard, "就这么写", "点单。这件事这一章里真的要发生，不许挪到下一章、不许一句带过。",
            function () { setHard(true); })) : null),
      h("div", { className: "shrink-0 px-6 pt-2", style: { paddingBottom: "calc(" + COMPOSER_PAD_BOTTOM + " + 12px)" } },
        h("button", { onClick: function () { if (!picked.quit) props.onGo(picked.id ? picked : null, want.trim(), hard); },
          disabled: !!picked.quit, className: "w-full active:opacity-80",
          style: { fontFamily: F_BODY, fontSize: 14, color: t.bg2, background: picked.quit ? t.line : t.ink, minHeight: 46, borderRadius: 12, border: "none" } },
          picked.quit ? "得先请她回来，或者另找一位" : (picked.id ? "就请「" + picked.name + "」写" : "开始写"))));
  }

  // ---------- 拿给谁看 / 记进哪间房（v66.79，她 2026-09-11）----------
  // 整页，不是半窗（no-half-sheet.md）：角色能有几十个，半窗一掀只剩三四行。
  function FilePage(props) {
    const t = useTheme();
    const f = props.fic, idx = props.chapIdx;
    const ch = (f.chapters || [])[idx] || {};
    const rows = props.chars || [];
    const [pick, setPick] = useState(props.defaultCharId || (rows[0] && rows[0].id) || "");
    const picked = rows.filter(function (c) { return c.id === pick; })[0] || null;
    // ⚠️她 2026-09-11：「现在只能默认进已有的房间而不能另开，如果我有好几个房间就选不了了」。
    //   原来这儿只算出【最近动过的那一间】，她连看都看不见，更别说挑。
    const roomsOf = function (cid) {
      const K = (typeof window !== "undefined" && window.ChatRooms) || null;
      if (!K || !cid) return [];
      return K.list(cid).filter(function (r) { return r && !r.main && r.actions && r.actions.fanfic; })
        .sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });
    };
    const myRooms = roomsOf(pick);
    // "" ＝ 用最近动过的那一间（和以前一样）；"__new" ＝ 另开一间
    const [roomId, setRoomId] = useState("");
    const [newName, setNewName] = useState("一起写");
    // 换个人就把房间的选择清掉：那是另一个人的房间
    const pickChar = function (id2) { setPick(id2); setRoomId(""); };
    const roomTarget = function () {
      if (roomId === "__new") return { id: "", name: String(newName || "").trim().slice(0, 20) || "一起写" };
      return { id: roomId, name: "" };
    };
    const mine = !!(ch.byCharId && picked && ch.byCharId === picked.id);
    const btn = function (label, primary, onClick) {
      return h("button", { onClick: onClick, disabled: !picked, className: "w-full active:opacity-80",
        style: { fontFamily: F_BODY, fontSize: primary ? 14 : 13, minHeight: primary ? 46 : 42, borderRadius: 12, marginTop: primary ? 0 : 8,
          border: primary ? "none" : "1px solid " + t.line, background: primary ? t.ink : "transparent", color: primary ? t.bg2 : t.sub } }, label);
    };
    return h("div", { className: "fixed inset-0 z-50 h-full flex flex-col", style: pageSkin("paper", t, { corner: true }) },
      h(Head, { bg: "transparent", zh: "拿给谁看", sub: "《" + f.title + "》第 " + (idx + 1) + " 章", onBack: props.onClose }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-6 pb-4" },
        h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, lineHeight: 1.75, margin: "2px 0 10px" } },
          "落进去的是一张卡：这件事发生过、开头两百字。全文还在同人文里。",
          // ⚠️她 2026-09-11 问：「那我要他接写了很多章的只能一章一章发给他嘛」——
          //   不用，可界面上从来没说过这件事，她只能照着上面那句「开头两百字」猜。
          // ⚠️界面上的字不许写 markdown：**这样**会原样显示出来（踩过两次）
          h("br"), "放一张就够：这一篇的地基、设定卡、还埋着的伏笔、每一章结束在哪儿、"
          + "上一章的结尾，都会跟着进他手里——写了多少章都一样，不用一章一章发。",
          h("br"), "这一步不花钱——喂给他只是放进他的上下文，让他开口才要。"),
        rows.map(function (c) {
          const on = c.id === pick;
          return h("button", { key: c.id, onClick: function () { pickChar(c.id); }, className: "w-full text-left active:opacity-70",
            style: { display: "flex", gap: 10, alignItems: "flex-start", padding: "11px 2px", minHeight: 44, background: "transparent", border: "none", borderBottom: "1px solid " + t.line } },
            h("span", { style: { width: 7, height: 7, borderRadius: 999, marginTop: 7, flexShrink: 0, background: on ? t.ink : "transparent", border: "1px solid " + (on ? t.ink : t.line) } }),
            h("span", { style: { minWidth: 0 } },
              h("span", { style: { display: "block", fontFamily: F_BODY, fontSize: 13.5, fontWeight: on ? 600 : 400, color: on ? t.ink : t.sub } },
                (c.remark || c.name) + (ch.byCharId === c.id ? "（这一章就是他写的）" : "")),
              on ? h("span", { style: { display: "block", fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 2, lineHeight: 1.55 } },
                myRooms.length ? "他有 " + myRooms.length + " 间开了「一起写」的房" : "他还没有开「一起写」的房，底下可以给他开一间") : null));
        }),
        rows.length ? null : h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginTop: 14, lineHeight: 1.7 } }, "还没有角色。"),

        // ── 放进哪一间（她 2026-09-11）────────────────────────────────
        // ⚠️形状照上面那份名单来（墨点＋名字），不另发明一种：同一页上两处挑东西，
        //   长得不一样就是两套规矩。
        picked ? h("div", { style: { marginTop: 18 } },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 12.5, color: t.ink, letterSpacing: ".16em", marginBottom: 2 } }, "放进哪一间"),
          h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginBottom: 6, lineHeight: 1.6 } },
            "只列开了「一起写」的那几间。别的房间要放，先去那间房的设置里把「一起写」打开。"),
          [{ id: "", name: myRooms.length ? "最近动过的那一间（" + myRooms[0].name + "）" : "给他开一间「一起写」", note: "" }]
            .concat(myRooms.map(function (r) { return { id: r.id, name: r.name, note: "" }; }))
            .concat([{ id: "__new", name: "另开一间", note: "" }])
            .map(function (o) {
              const on = roomId === o.id;
              return h("button", { key: o.id || "_auto", onClick: function () { setRoomId(o.id); }, className: "w-full text-left active:opacity-70",
                style: { display: "flex", gap: 10, alignItems: "center", padding: "10px 2px", minHeight: 44, background: "transparent", border: "none", borderBottom: "1px solid " + t.line } },
                h("span", { style: { width: 7, height: 7, borderRadius: 999, flexShrink: 0, background: on ? t.ink : "transparent", border: "1px solid " + (on ? t.ink : t.line) } }),
                h("span", { style: { minWidth: 0, fontFamily: F_BODY, fontSize: 13, fontWeight: on ? 600 : 400, color: on ? t.ink : t.sub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, o.name));
            }),
          roomId === "__new" ? h("input", { value: newName, autoFocus: true, onChange: function (e) { setNewName(e.target.value); },
            placeholder: "这间房叫什么", className: "w-full outline-none",
            style: { fontFamily: F_BODY, fontSize: 12.5, padding: "9px 0 8px", marginTop: 8, background: "transparent",
              color: t.ink, border: "none", borderBottom: "1px solid " + t.line } }) : null) : null),
      h("div", { className: "shrink-0 px-6 pt-2", style: { paddingBottom: "calc(" + COMPOSER_PAD_BOTTOM + " + 12px)" } },
        btn(mine ? "记进他那间房" : "拿给他看", true, function () { props.onFile(picked, false, roomTarget()); }),
        btn("只记一笔（不进房间）", false, function () { props.onFile(picked, true); })));
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
      h(Head, { bg: "transparent", zh: "发布同人文", onBack: props.onBack }),
      h("div", { className: "flex-1 min-h-0 flex flex-col px-6 pb-8" },
        // 上面这一截固定不动（shrink-0），下面正文那格才吃得到剩下的高度
        h("div", { className: "shrink-0" },
          h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, marginBottom: 8 } }, "发到世界观"),
          h("select", { value: tabId, onChange: function (e) { setTabId(e.target.value); }, className: "w-full mb-4", style: { fontFamily: F_BODY, fontSize: 13.5, padding: "9px 11px", borderRadius: 10, background: t.bg2, color: t.ink, border: "1px solid " + t.line } },
            props.tabs.map(function (tb) { return h("option", { key: tb.id, value: tb.id }, tb.name); })),
          h("input", { value: title, onChange: function (e) { setTitle(e.target.value); }, placeholder: "标题", className: "w-full outline-none mb-3", style: { fontFamily: F_DISPLAY, fontSize: 17, padding: "9px 11px", borderRadius: 10, background: t.bg2, color: t.ink, border: "1px solid " + t.line } }),
          h("div", { className: "flex items-center gap-2 mb-3" },
            h("select", { value: pickA, onChange: function (e) { setPickA(e.target.value); }, style: cpSelectStyle(t, 10, t.bg2) },
              cpOptions(characters, props.userName)),
            h("span", { style: { color: t.fog, flexShrink: 0 } }, "×"),
            h("select", { value: pickB, onChange: function (e) { setPickB(e.target.value); }, style: cpSelectStyle(t, 10, t.bg2) },
              cpOptions(characters, props.userName))),
          h("input", { value: tags, onChange: function (e) { setTags(e.target.value); }, placeholder: "标签，用空格或逗号分隔（如 HE 破镜重圆）", className: "w-full outline-none mb-3", style: { fontFamily: F_BODY, fontSize: 13, padding: "9px 11px", borderRadius: 10, background: t.bg2, color: t.ink, border: "1px solid " + t.line } })
        ),
        // ⚠️正文那格【撑满剩下的整页】（v64.63，她 2026-09-06：「正文部分太小了」）。
        //   原来是写死的 rows:12 + resize-none：上面五个字段占掉大半屏，
        //   真正要写字的地方只剩十来行，还不许拉。
        //   现在外壳是 h-full flex flex-col、上面那截 shrink-0、这一格 flex-1 min-h-0，
        //   屏幕多高它就有多高（跟主聊天正文区同一套层级，mobile-ui-layout §3）。
        h("textarea", { value: body, onChange: function (e) { setBody(e.target.value); }, placeholder: "正文…", className: "w-full outline-none flex-1 min-h-0", style: { fontFamily: "'Noto Serif SC',serif", fontSize: 14.5, lineHeight: 1.9, padding: "13px 14px", borderRadius: 10, background: t.bg2, color: t.ink, border: "1px solid " + t.line, minHeight: 200, resize: "none" } }),
        h("button", { onClick: function () {
          if (!title.trim() || !body.trim()) { props.toast && props.toast("标题和正文都要填"); return; }
          props.onPublish(tabId, title.trim(), finalCP(), tags.split(/[\s,，、]+/).filter(Boolean), body.trim());
        }, className: "w-full active:opacity-80 shrink-0", style: { fontFamily: F_BODY, fontSize: 14, color: t.bg2, background: t.ink, padding: "13px", borderRadius: 12, marginTop: 10 } }, "发布")));
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

    if (sub === "published") return h(MinePublished, { fics: mine, characters: props.characters, userName: props.userName, onBack: function () { setSub(null); }, onOpen: props.onOpenFic, onDelete: props.onDeleteFic });
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
      h(Head, { bg: "transparent", zh: "我的", onBack: props.onBack, right: h("button", { onClick: function () { setMeEdit(true); }, className: "active:opacity-60" }, h(IPencil, { size: 17, color: t.ink })) }),
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

        // ＋ 从底栏中间挪进来了（她 2026-09-04：中间那一枚让给加笔）
        row("自己写一篇", "写完就发在这个圈子里", function () { props.onWrite && props.onWrite(); }),
        row("我发布的", mine.length + " 篇 · 随时回看/追更", function () { setSub("published"); }),
        row("磕 CP 管理", (props.cps || []).length + " 对预设 · 增删改", function () { setSub("cp"); }),
        row("生成设置", "预设文风 · 篇幅", function () { setSub("settings"); })),
      meEdit ? h(MeEditSheet, { me: me, onClose: function () { setMeEdit(false); }, onSave: function (m) { props.onSaveMe(m); setMeEdit(false); } }) : null);
  }

  // 我发布的（列表 → 点开进 Reader）
  function MinePublished(props) {
    const t = useTheme();
    return h("div", { className: "h-full flex flex-col" },
      h(Head, { bg: "transparent", zh: "我发布的", onBack: props.onBack }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-5 pb-8" },
        props.fics.length ? props.fics.slice().sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); }).map(function (f, i) {
          // 「我发布的」不摆头条：这一页每一篇都是她自己写的，挑一篇出来当头条没有意义
          return h("div", { key: f.id },
            h(FicCard, { fic: f, index: i, noLead: true, characters: props.characters, userName: props.userName, onOpen: function () { props.onOpen(f.id); }, onLike: function () {} }),
            // 删掉这一篇（v64.63 她点名）：只在【我发布的】这一页有，
            // feed 那边的卡片一个字不动——那是别人的文，没有删的道理。
            // ⚠️这一行要明显【贴着上面那张卡】：上下留白一样宽的话，
            //   它看着既像上一篇的、又像下一篇的（第一版就是这样）。
            props.onDelete ? h("div", { className: "flex justify-end", style: { margin: "-16px 2px 22px" } },
              h("button", { onClick: function () {
                requestAppConfirm("删掉《" + (f.title || "这一篇") + "》？",
                  ((f.chapters || []).length > 1 ? "连同 " + f.chapters.length + " 章一起没了。" : "") + "删了就找不回来了。",
                  function () { props.onDelete(f.id); }, "删掉");
              }, className: "active:opacity-60",
                style: { minHeight: 40, display: "inline-flex", alignItems: "center", padding: "0 12px", background: "transparent", border: "none",
                  fontFamily: F_BODY, fontSize: 11.5, color: "#b34f43" } }, "删掉这一篇")) : null);
        }) : h(Empty, { text: "还没发布过", sub: "在上一页点「自己写一篇」，写完就会出现在这里" })));
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
      h(Head, { bg: "transparent", zh: "磕 CP 管理", onBack: props.onBack, right: h("button", { onClick: function () { adding ? reset() : open(null); }, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 12.5, color: t.accent } }, adding ? "取消" : "＋ 加 CP") }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-6 pb-10" },
        adding ? h("div", { className: "rounded-2xl px-4 py-3 mb-4", style: { background: t.bg2, border: "1px solid " + t.line } },
          h("input", { value: label, onChange: function (e) { setLabel(e.target.value); }, placeholder: "备注名（可空，默认用名字）", className: "w-full outline-none mb-2", style: { fontFamily: F_BODY, fontSize: 13, padding: "7px 10px", borderRadius: 8, background: t.bg, color: t.ink, border: "1px solid " + t.line } }),
          h("div", { className: "flex items-center gap-2 mb-3" },
            h("select", { value: pickA, onChange: function (e) { setPickA(e.target.value); }, style: cpSelectStyle(t, 8, t.bg) }, picks),
            h("span", { style: { color: t.fog, flexShrink: 0 } }, "×"),
            h("select", { value: pickB, onChange: function (e) { setPickB(e.target.value); }, style: cpSelectStyle(t, 8, t.bg) }, picks)),
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
        // 与正式长文一样给足（v59.96 起是 14000，见 施工规则/max-tokens-floor.md）；
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
      h(Head, { bg: "transparent", zh: "生成设置", onBack: props.onBack }),
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

        // 她 2026-09-11：「弄一个设置最低 token 要求，免得模型偷懒」。
        // ⚠️说人话＝【字数】：上面那一栏是 token 目标，两件事。
        //   API 上没有 min_tokens（max_tokens 是天花板、没有地板），所以这个数
        //   只能落成两件事：发进提示词 + 写完自己数一遍。数出来短了只提示，不自动补。
        h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.sub, margin: "16px 0 6px" } }, "每章最少写多少字"),
        h("input", {
          type: "number", inputMode: "numeric", min: 0, max: MIN_CHARS_MAX, step: 100,
          // ⚠️0 就是「没填」：写成 == null 的话默认值 0 会显示成一个真的「0」，占着位子、提示语还永远出不来
          value: cfg.minChars ? cfg.minChars : "",
          placeholder: "留空＝按上面那个 token 折算（现在约 " + minCharsFor(cfg) + " 字）",
          onChange: function (e) { patch({ minChars: e.target.value === "" ? "" : Number(e.target.value) }); },
          onBlur: function (e) { patch({ minChars: clampMinChars(e.target.value) }); },
          style: { width: "100%", fontFamily: F_BODY, fontSize: 14, color: t.ink, background: t.bg2, border: "1px solid " + t.line, borderRadius: 10, padding: "9px 12px", outline: "none" }
        }),
        h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 6, lineHeight: 1.5 } },
          "这个数会写进提示词，写完还会数一遍。没写够也不会自动再打一枪——"
          + "只在那一章底下留一行字和一颗「让他接着写」，按不按你说了算。"),

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
    const [view, setView] = useState("list"); // list | pick | thread
    const [sessions, setSessions] = useState(function () { return window.Fanfic.loadRP(); });
    const [openId, setOpenId] = useState(null);
    // 从作者主页点「加笔」带着一篇进来：直接开一局进去读，别让她再翻一遍列表
    useEffect(function () {
      if (!props.startFicId) return;
      const f = (props.fics || []).filter(function (x) { return x.id === props.startFicId; })[0];
      props.onStartUsed && props.onStartUsed();
      if (f) startSession(f);
    }, [props.startFicId]);
    function persist(list) { setSessions(list); window.Fanfic.saveRP(list); }
    // 开一局：不再有选身份、选记忆、选落点那一屏
    // （她 2026-09-05：「去掉那个选身份和记忆，就直接进去改文」）。
    // ⚠️不再落 mode：加笔没有「穿成谁」这回事了（她 2026-09-11），动笔的人就是她自己。
    function startSession(fic) {
      const cfg = window.Fanfic.loadCfg();
      const sess = { id: uid("rp"), ficId: fic.id, ficTitle: fic.title, tabId: fic.tabId, cp: fic.cp,
        authorCard: window.Fanfic.rpAuthorCardOf(fic),
        style: window.Fanfic.activeStyleText(cfg), transcript: [],
        // 加笔从【原文的哪一段】开始读。⚠️只存下标，不存原文：存一份就有两份，
        //   而且每一局都复制一遍全文。voided ＝ 被改掉／被她也不要了的那几段。
        paraIdx: 0, voided: [],
        createdAt: Date.now(), updatedAt: Date.now() };
      persist([sess].concat(window.Fanfic.loadRP()));
      setOpenId(sess.id); setView("thread");
    }
    function charsOf(fic) { return cpChars((fic && fic.cp) || [], props.characters, props.profile); }

    // 会话
    if (view === "thread") {
      const sess = sessions.find(function (s) { return s.id === openId; });
      if (!sess) { setView("list"); return null; }
      return h(RPThread, {
        session: sess, fic: (props.fics || []).find(function (f) { return f.id === sess.ficId; }),
        tab: (props.tabs || []).find(function (x) { return x.id === sess.tabId; }) || { name: "", desc: "" },
        active: props.active, characters: props.characters, profile: props.profile, userName: props.userName, worldbook: props.worldbook, worldbookFor: props.worldbookFor, toast: props.toast, onShelveFic: props.onShelveFic, onExtendFic: props.onExtendFic,
        onBack: function () { setSessions(window.Fanfic.loadRP()); setOpenId(null); setView("list"); },
        onUpdate: function (fn) { const list = window.Fanfic.loadRP().map(function (s) { return s.id === sess.id ? fn(Object.assign({}, s)) : s; }); persist(list); }
      });
    }

    // 选文
    // ⚠️这一屏原来只列【收藏进书架】的（shelf），而作者主页上每一篇都有「加笔」按钮，
    //   点了直接就开局——同一件事两套门槛，她 2026-09-07 撞上的就是这个。
    //   门槛本来也不该在这儿：`protectedFic` 是【清理闸】（这篇文留不留），
    //   借它当加笔的准入条件是拿另一层的规矩当自己的规矩。真正要防的「开着局
    //   原文被清掉」已经由 protectedFic 认加笔会话解决了，所以这儿一律放行。
    if (view === "pick") {
      const pickable = (props.fics || []).slice().sort(function (a, b) {
        // 收藏／自己写的排前面（多半就是想加笔的那几篇），其余按新旧
        const pa = window.Fanfic.protectedFic(a) ? 1 : 0, pb = window.Fanfic.protectedFic(b) ? 1 : 0;
        return pb - pa || (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0);
      });
      return h("div", { className: "h-full flex flex-col" },
        h(Head, { bg: "transparent", zh: "挑一篇下笔", sub: "在她写好的文上动笔", onBack: function () { setView("list"); } }),
        h("div", { className: "flex-1 min-h-0 overflow-y-auto px-6 pb-10" },
          pickable.length ? pickable.map(function (f) {
            return h("button", { key: f.id, onClick: function () { startSession(f); }, className: "w-full text-left active:opacity-80 rounded-xl px-4 py-3 mb-2", style: { background: t.bg2, border: "1px solid " + t.line } },
              h("div", { className: "flex items-center", style: { gap: 6 } },
                h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15, color: t.ink, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, f.title),
                f.onShelf ? h("span", { style: { flexShrink: 0, fontFamily: F_BODY, fontSize: 10, color: t.fog } }, "在书架") : null),
              h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.accent } }, cpLabel(f.cp, props.characters, props.userName) + " · " + rpAuthorName(f)));
          }) : h(Empty, { text: "还没有文", sub: "先去 feed 生成几篇" })));
    }

    // 存档列表
    const sorted = sessions.slice().sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });
    return h("div", { className: "h-full flex flex-col" },
      h(Head, { bg: "transparent", zh: "加笔", sub: "在别人写好的文上动笔", onBack: props.onBack, right: h("button", { onClick: function () { setView("pick"); }, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 12.5, color: t.accent } }, "＋ 新一篇") }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-6 pb-10" },
        // 她 2026-09-07：「加笔里灰字的解释太啰嗦了」。原来这儿是一整段说明书
        // （怎么动手＋作者会怎么反应＋原稿剩余是什么＋收尾去哪儿），全在进门口挡着。
        // 那几件事在里面都看得见，不用在门口先讲一遍。
        h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, lineHeight: 1.6, marginBottom: 14 } }, "点住原文里的一句，从那句起就归你写；作者在旁边接招。"),
        sorted.length ? sorted.map(function (s) {
          return h("div", { key: s.id, className: "flex items-center rounded-xl px-4 py-3 mb-2", style: { background: t.bg2, border: "1px solid " + t.line } },
            h("button", { onClick: function () { setOpenId(s.id); setView("thread"); }, className: "text-left flex-1 active:opacity-70" },
              h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14.5, color: t.ink } }, s.ficTitle),
              h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginTop: 1 } }, [window.Fanfic.rpKnowLabel(s.know), ((s.transcript || []).filter(function (e) { return e.who === "me"; }).length) + " 步"].filter(Boolean).join(" · ")),
              (function () {
                const bs = s.beats || [], br = bs.filter(function (b) { return b.state === "broken"; }).length, kp = bs.filter(function (b) { return b.state === "kept"; }).length;
                if (!bs.length) return null;
                return h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: br ? t.accent : t.fog, marginTop: 2 } },
                  s.done ? (br ? "已定稿 · 改了 " + br + " 处" : "已定稿 · 一页也没改")
                    : (br ? "拦下 " + br + " 页" : "还没拦下任何一页") + " · 照原样 " + kp + " 页 · 还剩 " + (bs.length - br - kp) + " 页没走到");
              })()),
            h("button", { onClick: function () { const list = window.Fanfic.loadRP().filter(function (x) { return x.id !== s.id; }); persist(list); }, className: "active:opacity-60 ml-2", style: { fontFamily: F_BODY, fontSize: 12, color: t.accent } }, "删除"));
        }) : h(Empty, { text: "还没在谁的文上动过笔", sub: "点右上「＋ 新一篇」开始" })));
  }

  // 书脊：这一版书被你改成什么样，一眼看得见
  // ⚠️不是一排药丸也不是一排 tab（施工规则/tabs-not-plain-pills.md）：
  // 它在现实里就是【一本书的脊背】——两端的堵头、中间那根装订线、压在线上的几枚页签。
  // 照原样走过去的那一页在脊上是一枚实心墨点，被拦下的那一页是一道划开的口子。
  // 状态不只靠颜色分：实心 / 空心虚线 / 划一道，形状各不相同（色弱和阳光下只剩形状可依）。
  function RPSpine(props) {
    const t = props.t, bs = props.beats || [];
    if (!bs.length) return null;
    const cap = function (k) { return h("div", { key: k, style: { width: 3, height: 20, borderRadius: 1, background: t.ink, opacity: 0.5, marginTop: 2, flexShrink: 0 } }); };
    return h("div", { style: { padding: "2px 2px 6px" } },
      h("div", { className: "flex items-start", style: { position: "relative" } },
        h("div", { style: { position: "absolute", left: 4, right: 4, top: 11, height: 1, background: t.line } }),
        cap("l"),
        h("div", { className: "flex-1 flex" }, bs.map(function (bt) {
          const st = bt.state || "pending", on = props.sel === bt.id, lit = st !== "pending";
          return h("button", { key: bt.id, onClick: function () { props.onPick(on ? null : bt.id); }, className: "flex-1 flex flex-col items-center active:opacity-60", style: { minWidth: 0, padding: "0 2px 2px", background: "transparent" } },
            h("div", { style: { position: "relative", width: 15, height: 15, marginTop: 4, borderRadius: 999, boxSizing: "border-box",
                border: "1px " + (st === "pending" ? "dashed " + t.fog : "solid " + (st === "broken" ? t.accent : t.ink)),
                background: st === "kept" ? t.ink : t.bg, boxShadow: "0 0 0 3px " + t.bg } },
              st === "broken" ? h("div", { style: { position: "absolute", left: -3, right: -3, top: 6, height: 1.5, background: t.accent, transform: "rotate(-40deg)" } }) : null),
            h("div", { style: { fontFamily: F_BODY, fontSize: 9, lineHeight: 1.35, marginTop: 4, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                color: st === "broken" ? t.accent : st === "kept" ? t.sub : t.fog,
                textDecoration: st === "broken" ? "line-through" : "none",
                fontWeight: on ? 700 : 400 } }, (lit || props.spoiler) ? bt.label : "？"));
        })),
        cap("r")));
  }

  // 穿书会话（互动叙事）
  function RPThread(props) {
    const t = useTheme();
    const s = props.session;
    const trans = s.transcript || [];
    const beats = s.beats || [];
    const [input, setInput] = useState("");
    const [busy, setBusy] = useState(false);
    const [writing, setWriting] = useState(false); // 展开"写行动"输入
    const [reveal, setReveal] = useState(99);       // 最后一段叙事已显示的段落数（初次进来全显）
    const [sel, setSel] = useState(null);           // 书脊上点开的那一页
    const [endAsk, setEndAsk] = useState(false);    // 收尾要点两下（这一步不可逆）
    const [cut, setCut] = useState(null);           // 点住的那一句：{i, sentence, rest}
    // 这篇文的原稿。⚠️只在这儿算一次，不进存档：还没读到的部分一个字都不存。
    const paras = window.Fanfic.rpParas(props.fic);
    const leftPct = window.Fanfic.rpLeftPct(s, paras);
    const moreSrc = Number.isFinite(s.paraIdx) ? s.paraIdx < paras.length : false;
    const taRef = React.useRef(null);
    function autoGrow() { const el = taRef.current; if (el) { el.style.height = "auto"; el.style.height = Math.min(130, el.scrollHeight) + "px"; } }
    // 原篇被删时 props.fic 没了，退回存档自己记着的那份 cp——不然这一局的人全空了，
    // 身份锚点那句话认不出「文里那位就是她」，玩家会被写成另一个人
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
    // ⚠️找【最后一段叙事】，不是最后一条：批注和结算过的页都排在叙事后面，
    // 拿 trans.length-1 会判成「上一拍不是叙事」，逐段展开和「轮到我了」两处一起失灵。
    let lastNarIdx = -1;
    for (let i = trans.length - 1; i >= 0; i--) { if (trans[i].who === "nar") { lastNarIdx = i; break; } }
    const prevNar = React.useRef(-1);
    React.useEffect(function () {
      if (lastNarIdx !== prevNar.current) { if (prevNar.current >= 0) setReveal(1); prevNar.current = lastNarIdx; }
    }, [lastNarIdx]);

    // 一拍回来了：正文、（可能的）页边批注、走没走到骨架的某一页、偏离度
    function applyTurn(r) {
      props.onUpdate(function (ss) {
        const add = [{ who: "nar", text: r.text, cot: r.cot || null, cotRequested: !!r.cotRequested }];
        if (r.pull) add.push({ who: "pull", text: r.pull });
        if (r.note) add.push({ who: "note", text: r.note });
        ss.transcript = (ss.transcript || []).concat(add);
        if (Number.isFinite(r.dev)) ss.dev = r.dev;
        const hit = r.hit && (ss.beats || []).find(function (bt) { return bt.id === r.hit && (bt.state || "pending") === "pending"; });
        ss.pendingHit = hit ? hit.id : null;
        ss.updatedAt = Date.now();
        return ss;
      });
    }
    // 每隔几拍才让作者在页边说一句：每一拍都说就成了旁白，说了等于没说
    // 她 2026-09-04：「我每改一段就会有作者过来试图把剧情接回来然后再批注」——
    // 所以每一拍都有。原来是每三拍一次（怕成旁白），现在批注跟在【她伸的那一手】后面，
    // 是那一手的落款，不再是凭空冒出来的一句点评。
    function wantNote() { return true; }

    // ⚠️开场分两步，顺序不许换（她 2026-09-05「直接进去改文」之后这条才露出来）：
    //   ① 原文第一段【立刻】摆上——它是她本来就写好的字，一分钱不花，也不该等模型；
    //   ② 骨架那一枪再慢慢去抽。
    // 原来两件事绑在同一个 onUpdate 里：那一枪失败（没配 API、超时、余额）＝整页空白，
    // 一个字都读不到，而这个玩法的全部内容就是那些字。
    async function start() {
      if (!props.fic) return;
      props.onUpdate(function (ss) {
        if ((ss.transcript || []).length) return ss;
        // 开场就是【原文的第一段】——引擎不写开场（v62.50）
        const i0 = Number.isFinite(ss.paraIdx) ? ss.paraIdx : 0;
        ss.transcript = paras[i0] ? [{ who: "src", i: i0, text: paras[i0] }] : [];
        ss.paraIdx = i0 + (paras[i0] ? 1 : 0);
        // 作者是谁从【名册】里读（开局时已经落进 session）——这儿只在老存档缺这一栏时补一次。
        //   ⚠️不许覆盖：覆盖了就把她的脾气冲掉了。
        ss.authorCard = ss.authorCard || window.Fanfic.rpAuthorCardOf(props.fic) || null;
        if (!Number.isFinite(ss.dev)) ss.dev = 0;
        ss.updatedAt = Date.now(); return ss;
      });
      if (!props.active) return;   // 没配 API 也照样读得下去，只是没有骨架
      setBusy(true);
      try {
        // ⚠️开场前不再先打一枪定身份：动笔的人就是她自己，没有身份要定（她按次计费，
        //   那一枪本来也只为「天降」那个已经删掉的玩法存在）。
        const r = await window.Fanfic.genRPStart(props.active, s, props.fic, props.tab, cpc, props.userName, storyLore("故事开场"), perFic);
        props.onUpdate(function (ss) { ss.beats = r.beats || []; ss.updatedAt = Date.now(); return ss; });
      } catch (e) { props.toast && props.toast(String(e.message || e)); }
      setBusy(false);
    }
    // ⚠️骨架那一枪失败过的局（beats 压根没落下来）再打开时要补一次——
    //   解析不出来时存的是空数组，那是「这一局没有骨架」，不该反复重抽。
    React.useEffect(function () { if (trans.length === 0 || !s.beats) start(); }, []);

    // 往下读一段原文（一分钱不花：这几段是她本来就写好的字）
    function readOn() {
      props.onUpdate(function (ss) {
        const i = Number.isFinite(ss.paraIdx) ? ss.paraIdx : 0;
        if (!paras[i]) return ss;
        ss.transcript = (ss.transcript || []).concat([{ who: "src", i: i, text: paras[i] }]);
        ss.paraIdx = i + 1; ss.updatedAt = Date.now();
        return ss;
      });
    }
    // 从原文的某一句起动笔：那一段【从这句往后】作废，你写你做了什么，
    // 引擎把后面改掉；她再伸手把故事往回接（或者跟你一起推远）。
    async function send(cutFrom) {
      const act = input.trim(); if (!act || busy) return;
      setInput(""); setWriting(false); setCut(null); setBusy(true);
      const note = wantNote();
      const cut = cutFrom || null;
      props.onUpdate(function (ss) {
        ss.transcript = (ss.transcript || []).concat([{ who: "me", text: act, from: cut ? cut.sentence : "" }]);
        if (cut) ss.voided = (ss.voided || []).concat([cut.i]).filter(function (x, k, a) { return a.indexOf(x) === k; });
        ss.updatedAt = Date.now(); return ss;
      });
      try {
        const nextPara = cut && paras[(Number.isFinite(s.paraIdx) ? s.paraIdx : 0)] || "";
        const r = await window.Fanfic.genRPTurn(props.active, s, props.fic, props.tab, cpc, props.userName, storyLore(act), act, perFic,
          { wantNote: note, cut: cut ? { sentence: cut.sentence, rest: cut.rest, next: nextPara } : null });
        applyTurn(r);
        // 她跟着一起把故事推远时，会连后面几段原文也不要了
        if (r.voidAhead > 0) props.onUpdate(function (ss) {
          const from = Number.isFinite(ss.paraIdx) ? ss.paraIdx : 0;
          const more = [];
          for (let k = 0; k < r.voidAhead && paras[from + k]; k++) more.push(from + k);
          ss.voided = (ss.voided || []).concat(more);
          ss.paraIdx = from + more.length; ss.updatedAt = Date.now();
          return ss;
        });
      } catch (e) { props.toast && props.toast(String(e.message || e)); }
      setBusy(false);
    }

    // 走到原著这一页的当口上了：照原样发生，还是花掉这一页把它拦下来
    async function resolve(bt, keep) {
      if (busy) return;
      setBusy(true);
      const entry = { who: "page", beat: bt.id, label: bt.label, page: bt.page, keep: !!keep };
      const beats2 = (s.beats || []).map(function (x) { return x.id === bt.id ? Object.assign({}, x, { state: keep ? "kept" : "broken" }) : x; });
      props.onUpdate(function (ss) {
        ss.beats = beats2; ss.pendingHit = null;
        ss.transcript = (ss.transcript || []).concat([entry]); ss.updatedAt = Date.now(); return ss;
      });
      // ⚠️传下去的必须是【已经带上这一页】的那份：props.session 这时还是旧的，
      // 用它组 messages 的话，模型收不到「我把这一页拦下了」那一句。
      const sess2 = Object.assign({}, s, { beats: beats2, pendingHit: null, transcript: (s.transcript || []).concat([entry]) });
      try {
        const r = await window.Fanfic.genRPTurn(props.active, sess2, props.fic, props.tab, cpc, props.userName, storyLore(bt.label), null, perFic, { resolve: { beat: bt, keep: !!keep }, wantNote: true });
        applyTurn(r);
      } catch (e) { props.toast && props.toast(String(e.message || e)); }
      setBusy(false);
    }

    // 她写的到头了：让她自己接着写下去（她 2026-09-05：「如果没写完的同人文改到底
    // 可以让她先继续写下去然后我们再继续改」）。
    // ⚠️两条线在这儿分岔，界线不许糊：
    //   · 她续的那一章是【她的字】→ 追加进原篇，谁再开一局都读得到；
    //   · 你改出来的那些是【你的字】→ 只留在这一版里，绝不回灌原文。
    //     回灌了的话，下一局你就是在改自己写的东西，「在别人写好的文上动笔」这个前提就没了。
    // ⚠️续写只吃【原文】，不吃这一局的 transcript：她那本书跟你这一版是平行的。
    //   把你这局的走向喂进去，别的局打开原文会读到你这儿发生的事——串场。
    //   genNextChapter 本来就只读 fic，所以直接用它，不另写一份（一层写在两处的老病）。
    // ⚠️只往【末尾】追加，绝不动前面的段落：voided / paraIdx 存的都是段落下标，
    //   在中间插一段会把正在玩的每一局都错位。
    async function writeOn() {
      if (busy || !props.fic) return;
      if (!props.active) { props.toast && props.toast("请先到设置配置 API"); return; }
      if (!props.onExtendFic) { props.toast && props.toast("这一处没接上，先别点"); return; }
      setBusy(true);
      try {
        const ch = await window.Fanfic.genNextChapter(props.active, props.fic, props.tab, cpc, props.userName, storyLore("续章"), { perFic: perFic, style: (props.fic && props.fic.style) || "" });
        props.onExtendFic(props.fic.id, ch);
        props.toast && props.toast(authorName + "又写下去了一章，接着读吧");
      } catch (e) { props.toast && props.toast(String(e.message || e)); }
      setBusy(false);
    }

    // 收尾：写最后一段 + 作者的判词，然后把这一版当成一篇文放回书架
    async function finish() {
      if (busy) return;
      setEndAsk(false); setBusy(true);
      try {
        const r = await window.Fanfic.genRPEnding(props.active, s, props.fic, props.tab, cpc, props.userName, storyLore("收束"), perFic);
        let done = null;
        props.onUpdate(function (ss) {
          ss.transcript = (ss.transcript || []).concat([{ who: "nar", text: r.text }].concat(r.verdict ? [{ who: "note", text: r.verdict, last: true }] : []));
          ss.done = true; ss.verdict = r.verdict || ""; ss.pendingHit = null; ss.updatedAt = Date.now();
          done = ss; return ss;
        });
        if (props.onShelveFic && done) {
          const f = window.Fanfic.rpToFic(done, props.fic, r.verdict || "", r.reviews);
          props.onShelveFic(f);
          props.toast && props.toast((r.reviews || []).length
            ? "这一版放回书架了，底下已经有 " + r.reviews.length + " 条在说话"
            : "这一版放回书架了：" + f.title);
        }
      } catch (e) { props.toast && props.toast(String(e.message || e)); }
      setBusy(false);
    }

    const lastParas = lastNarIdx >= 0 ? trans[lastNarIdx].text.split(/\n{2,}/).map(function (x) { return x.trim(); }).filter(Boolean) : [];
    const moreToReveal = lastNarIdx >= 0 && reveal < lastParas.length;
    // v62.50：读原文的时候也轮得到我——加笔的入口就是【点住原文里的一句】。
    //   开局第一条是原文（who:"src"），lastNarIdx 还是 -1，用老条件的话按钮永远不出现。
    const canAct = !busy && trans.length > 0 && !moreToReveal && !s.done;
    const hitBeat = s.pendingHit ? beats.find(function (bt) { return bt.id === s.pendingHit; }) : null;
    const spoiler = s.know === "spoiler";
    const selBeat = sel ? beats.find(function (bt) { return bt.id === sel; }) : null;
    const brokenN = beats.filter(function (bt) { return bt.state === "broken"; }).length;
    const authorName = window.Fanfic.rpAuthorName(props.fic);

    // 一段【原文】：她写的字。浅一档、行距更宽、可以逐句点。
    // ⚠️和你改出来的那些字必须一眼分得开——不能只靠颜色（色弱和阳光下只剩形状可依）：
    //   原文左边留白、字浅、行距宽；你的那些字顶格、墨色、行距正常。
    function srcPara(e, key) {
      const dead = (s.voided || []).indexOf(e.i) >= 0;
      const sentences = window.Fanfic.rpSentences(e.text);
      const last = !dead && e.i === (Number.isFinite(s.paraIdx) ? s.paraIdx - 1 : -1);
      return h("p", { key: key, style: { fontFamily: "'Noto Serif SC',serif", fontSize: 14.5, lineHeight: 2.15, color: dead ? t.fog : t.sub,
          margin: "0 0 16px", paddingLeft: 12, borderLeft: "1px solid " + (dead ? "transparent" : t.line),
          textDecoration: dead ? "line-through" : "none", opacity: dead ? .55 : 1 } },
        sentences.map(function (sn, j) {
          // 只有【还没读过头】的那一段能下笔：往回改早就翻过去的段落会把整条时间线拧乱
          if (dead || !last || s.done || busy) return h("span", { key: j }, sn);
          const on = cut && cut.i === e.i && cut.sentence === sn;
          return h("span", { key: j, onClick: function () { setCut(on ? null : { i: e.i, sentence: sn, rest: sentences.slice(j + 1).join("") }); setWriting(!on); },
            style: { cursor: "pointer", borderBottom: on ? "2px solid " + t.accent : "1px dotted " + hexA(t.ink, .28), background: on ? hexA(t.accent, .12) : "transparent", color: on ? t.ink : "inherit" } }, sn);
        }));
    }
    // 一段叙事正文
    function para(txt, key) { return h("p", { key: key, style: { fontFamily: "'Noto Serif SC',serif", fontSize: 15, lineHeight: 1.95, color: t.ink, whiteSpace: "pre-wrap", margin: "0 0 14px" } }, txt); }

    return h("div", { className: "h-full flex flex-col" },
      // ⚠️v61.27：这里原来自己写了一条紧凑标题栏，因为当时 Head 还是「30px 大标题」。
      //   Head 已经改成紧凑栏了（components.js），这一份就撤掉——
      //   同一层东西不许有两个实现，不然下次只会改到其中一处。
      //   「收尾」放右侧那个等宽操作位；这一步不可逆，所以照旧要点两下。
      h(Head, { bg: "transparent",
        zh: s.ficTitle || "加笔中",
        // ⚠️空的那几栏不许拼进去：新局没有落点，硬拼会留下一条「原创的那位 · 」的尾巴
        // ⚠️空的那几栏不许拼进去：硬拼会留下一条「 · 」的尾巴
        sub: [window.Fanfic.rpKnowLabel(s.know), "原稿还剩 " + window.Fanfic.rpLeftPct(s, paras) + "%"].filter(Boolean).join(" · "),
        onBack: props.onBack,
        right: (props.fic && !s.done && trans.length >= 4)
          ? h("button", { onClick: function () { endAsk ? finish() : setEndAsk(true); }, className: "active:opacity-60",
              style: { fontFamily: F_BODY, fontSize: 11, color: endAsk ? t.accent : t.fog, lineHeight: 1.15, padding: "2px 0" } }, endAsk ? "确定？" : "收尾")
          : null
      }),
      !props.fic ? h("div", { className: "flex-1 flex items-center justify-center px-8 text-center", style: { fontFamily: F_BODY, fontSize: 13, color: t.fog } }, "原篇已不在（可能取消了收藏被清理），此存档无法继续。") :
      // ⚠️这一层原来写着 background: t.bg，把外壳那张纸皮整个盖掉了
      // （审美审计 2026-09-04 点名；mobile-ui-layout §3.5：底纹铺在最外那层外壳上，
      //   中间这些层一律透明）。
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-7 pb-8" },
        endAsk ? h("div", { className: "text-center", style: { fontFamily: F_BODY, fontSize: 11.5, color: t.accent, paddingTop: 10 } }, "再点一下右上角就定稿：写完收束和作者的判词，这一版放回书架") : null,
        h("div", { style: { height: 8 } }),
        // 原稿剩余：偏离度不再是一个抽象数字，是【这篇文还剩几成是她写的】
        paras.length ? h("div", { style: { display: "flex", alignItems: "center", gap: 8, padding: "2px 2px 8px" } },
          h("span", { style: { fontFamily: F_BODY, fontSize: 9.5, letterSpacing: ".14em", color: t.fog, whiteSpace: "nowrap" } }, "原稿剩余"),
          h("span", { style: { flex: 1, height: 3, background: t.line, position: "relative" } },
            h("span", { style: { position: "absolute", left: 0, top: 0, bottom: 0, width: leftPct + "%", background: t.ink, opacity: .7 } })),
          h("span", { style: { fontFamily: "monospace", fontSize: 10, color: t.fog } }, leftPct + "%")) : null,
        // 她此刻站在哪一步：改得越远她越往前站，但【永远不会走开】
        // （她 2026-09-05：「后果不能他们弃坑不写，就是看他们批注才有意思」）。
        // ⚠️不是一颗填色的药丸：它是压在原稿那条线下面的一行落款小字，带一支笔尖。
        (paras.length && !s.done) ? h("div", { style: { display: "flex", alignItems: "center", gap: 6, padding: "0 2px 10px" } },
          h("span", { style: { fontSize: 10, color: t.accent } }, "✍"),
          h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.sub } }, authorName),
          h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog } }, "此刻"),
          h("span", { style: { fontFamily: "'Noto Serif SC',serif", fontSize: 11.5, color: t.accent, borderBottom: "1px solid " + hexA(t.accent, .45), paddingBottom: 1 } },
            window.Fanfic.rpDevBand(s.dev).tag)) : null,
        // 书脊：原著后面本来会发生的那几页，走过一页在脊上就落一个记号
        h(RPSpine, { t: t, beats: beats, spoiler: spoiler, sel: sel, onPick: setSel }),
        selBeat ? h("div", { className: "mb-3", style: { background: t.bg2, border: "1px solid " + t.line, borderRadius: 10, padding: "9px 12px 10px" } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 9.5, letterSpacing: "0.14em", color: t.fog, marginBottom: 3 } },
            selBeat.state === "broken" ? "这一页被你拦下了" : selBeat.state === "kept" ? "这一页照原样发生了" : spoiler ? "原著后面写着" : "还没翻到这一页"),
          h("div", { style: { fontFamily: "'Noto Serif SC',serif", fontSize: 12.5, lineHeight: 1.75, color: selBeat.state === "broken" ? t.fog : t.sub, textDecoration: selBeat.state === "broken" ? "line-through" : "none" } },
            (selBeat.state !== "pending" || spoiler) ? selBeat.page : "你是空手进来的——走到跟前才知道这一页写的是什么。")) : null,
        // 正文（叙事段落 + 我写进去的行动 + 结算掉的页 + 作者的页边批注）
        trans.map(function (e, i) {
          if (e.who === "src") return srcPara(e, i);
          if (e.who === "me") return h("div", { key: i, className: "my-5", style: { borderLeft: "2px solid " + t.accent, paddingLeft: 12 } },
            h("div", { style: { fontFamily: F_BODY, fontSize: 9.5, letterSpacing: "0.14em", color: t.accent, marginBottom: 3 } },
              e.from ? "✒ 从「" + String(e.from).slice(0, 12) + "…」这句起，你写下" : "✒ 你写下"),
            h("div", { style: { fontFamily: "'Noto Serif SC',serif", fontStyle: "italic", fontSize: 14.5, lineHeight: 1.85, color: t.accent, whiteSpace: "pre-wrap", wordBreak: "break-word", overflowWrap: "anywhere" } }, e.text));
          if (e.who === "page") return h("div", { key: i, className: "my-4 flex items-center gap-2" },
            h("div", { style: { flex: 1, height: 1, background: e.keep ? t.line : t.accent, opacity: e.keep ? 1 : 0.5 } }),
            h("div", { style: { fontFamily: F_BODY, fontSize: 10, letterSpacing: "0.08em", color: e.keep ? t.fog : t.accent, whiteSpace: "nowrap" } },
              e.keep ? "原著这一页「" + e.label + "」照原样发生" : "原著这一页「" + e.label + "」被你拦下"),
            h("div", { style: { flex: 1, height: 1, background: e.keep ? t.line : t.accent, opacity: e.keep ? 1 : 0.5 } }));
          // 作者伸的那一手：它已经发生在正文里了，这一条只是把它【指出来】——
          // 所以不是气泡也不是段落，是压在正文和批注之间的一行细字，带一道从右边伸过来的横线
          if (e.who === "pull") {
            if (i > lastNarIdx && moreToReveal) return null;
            return h("div", { key: i, className: "flex items-center gap-2 my-3" },
              h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.accent, whiteSpace: "nowrap" } }, "✍ " + authorName + " 伸手：" + e.text),
              h("div", { style: { flex: 1, height: 1, background: t.accent, opacity: .35 } }));
          }
          if (e.who === "note") {
            // 作者趴在稿子边上写的一句：不是正文，所以歪着、挤在页边、字比正文小
            if (i > lastNarIdx && moreToReveal) return null;   // 那一拍还没读完，别提前剧透她的反应
            return h("div", { key: i, className: "flex justify-end my-4" },
              h("div", { style: { maxWidth: "80%", transform: "rotate(-1.1deg)", borderLeft: "2px solid " + t.fog, paddingLeft: 9, paddingRight: 2 } },
                h("div", { style: { fontFamily: "'Noto Serif SC',serif", fontStyle: "italic", fontSize: 12.5, lineHeight: 1.75, color: t.sub, whiteSpace: "pre-wrap" } }, e.text),
                h("div", { style: { fontFamily: F_BODY, fontSize: 9.5, color: t.fog, marginTop: 3, textAlign: "right" } }, "—— " + authorName + (e.last ? " · 看完这一版" : " · 写在页边"))));
          }
          const paras = e.text.split(/\n{2,}/).map(function (x) { return x.trim(); }).filter(Boolean);
          const showN = (i === lastNarIdx) ? Math.min(reveal, paras.length) : paras.length;
          const fullyShown = showN >= paras.length;
          // 只念台词：抠出这拍里引号内的对白，纯旁白就不出 ▶
          const say = typeof extractSpeech === "function" ? extractSpeech(e.text) : e.text;
          return h("div", { key: i },
            (showN ? paras.slice(0, showN) : [e.text]).map(function (p, j) { return para(p, j); }),
            // 这一拍的创作小稿（读完这一拍才出现，否则等于提前剧透这一段要写什么）
            (fullyShown && (e.cot || e.cotRequested) && typeof CotReveal === "function")
              ? h(CotReveal, { cot: e.cot, requested: e.cotRequested }) : null,
            (fullyShown && say && rtp && narVoice && typeof TtsDot === "function") ? h("div", { style: { marginTop: -6, marginBottom: 12 } },
              h(TtsDot, { k: "rp" + i, text: say, spk: narVoice, tp: rtp })) : null);
        }),
        busy ? h(Spinner, { label: trans.length ? "剧情推进中…" : "开场中…" }) : null,
        // 逐段展开
        moreToReveal ? h("button", { onClick: function () { setReveal(reveal + 1); }, className: "w-full active:opacity-60 mt-1 mb-2", style: { fontFamily: F_BODY, fontSize: 12.5, color: t.fog, padding: "10px" } }, "▾ 显示下一段（" + reveal + "/" + lastParas.length + "）") : null,
        // 往下读一段她写的字（一分钱不花：这几段本来就在那儿）
        (!s.done && !busy && !moreToReveal && moreSrc) ? h("button", { onClick: readOn, className: "w-full active:opacity-60 mt-1 mb-3",
          style: { fontFamily: F_BODY, fontSize: 12.5, color: t.sub, padding: "11px", border: "1px dashed " + t.line, borderRadius: 10, background: "transparent" } },
          "▾ 接着读她写的（还剩 " + (paras.length - s.paraIdx) + " 段）") : null,
        (!s.done && !moreSrc && paras.length) ? h("div", { className: "text-center", style: { padding: "6px 0 12px" } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog } }, "—— 她写的到这儿就没了 ——"),
          // 没写完的文：让她自己往下写一章，写完你接着改
          (!busy && props.onExtendFic) ? h("button", { onClick: writeOn, className: "active:opacity-60 mt-2",
            style: { fontFamily: F_BODY, fontSize: 12.5, color: t.accent, padding: "9px 16px", border: "1px solid " + hexA(t.accent, .5), borderRadius: 999, background: "transparent" } },
            "催她写下去（她再写一章，你接着改）") : null) : null,
        s.done ? h("div", { className: "text-center py-6", style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, lineHeight: 1.8 } },
          "—— 这一版到此为止 ——", h("br"), brokenN ? "这本书被你改了 " + brokenN + " 处，已经放回书架" : "你一页也没改，这一版已经放回书架") : null),
      // 底部：走到原著某一页的当口 → 先决定它发不发生；否则读完了才出现"写下你的行动"
      props.fic && hitBeat && !busy && !moreToReveal
        // 从原著里撕下来的一页：上沿是虚的（撕口），下沿才是圆的
        ? h("div", { className: "shrink-0 mx-4 mb-3 mt-1", style: { background: t.bg2, border: "1px solid " + t.line, borderTop: "2px dashed " + t.fog, borderRadius: "2px 2px 12px 12px", padding: "12px 14px 13px" } },
            h("div", { style: { fontFamily: F_BODY, fontSize: 9.5, letterSpacing: "0.16em", color: t.fog, marginBottom: 5 } }, "原著这一页本来写的是"),
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14.5, color: t.ink, marginBottom: 4 } }, hitBeat.label),
            h("div", { style: { fontFamily: "'Noto Serif SC',serif", fontSize: 12.5, lineHeight: 1.75, color: t.sub, marginBottom: 11 } }, hitBeat.page),
            h("div", { className: "flex gap-2" },
              h("button", { onClick: function () { resolve(hitBeat, true); }, className: "flex-1 active:opacity-70", style: { fontFamily: F_BODY, fontSize: 13, color: t.bg2, background: t.ink, padding: "10px", borderRadius: 10 } }, "让它照原样发生"),
              h("button", { onClick: function () { resolve(hitBeat, false); }, className: "flex-1 active:opacity-70", style: { fontFamily: F_BODY, fontSize: 13, color: t.accent, background: "transparent", border: "1px solid " + t.accent, padding: "10px", borderRadius: 10 } }, "拦下这一页")))
        : props.fic && canAct ? h("div", { className: "shrink-0" },
          writing
            ? h("div", { className: "px-4 py-3", style: { background: t.bg2, borderTop: "1px solid " + t.line } },
              cut ? h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.accent, marginBottom: 6, lineHeight: 1.5 } },
                "从「" + String(cut.sentence).slice(0, 18) + (String(cut.sentence).length > 18 ? "…" : "") + "」这一句起，往后她写的就作废了")
                : h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginBottom: 6 } }, "没点句子＝接着往下写，她写的那些留着"),
              h("div", { className: "flex items-end gap-2" },
                h("span", { style: { color: t.accent, fontSize: 16, paddingBottom: 5 } }, "✒"),
                h("textarea", { ref: taRef, value: input, autoFocus: true, rows: 1, onChange: function (e) { setInput(e.target.value); autoGrow(); }, onKeyDown: function (e) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(cut); } }, placeholder: "写下你的行动 / 说的话…（Enter 发送，Shift+Enter 换行）", className: "flex-1 outline-none resize-none", style: { minWidth: 0, fontFamily: "'Noto Serif SC',serif", fontStyle: "italic", fontSize: 14.5, lineHeight: 1.6, color: t.ink, background: "transparent", borderBottom: "1px solid " + t.line, padding: "4px 2px", maxHeight: 130, overflowY: "auto", wordBreak: "break-word" } }),
                h("button", { onClick: function () { send(cut); }, disabled: !input.trim(), className: "active:opacity-70 disabled:opacity-30 flex items-center justify-center shrink-0", style: { width: 38, height: 38, borderRadius: 999, background: t.accent } }, h(ISend, { size: 15, color: "#fff" }))))
            : h("button", { onClick: function () { setWriting(true); }, className: "w-full active:opacity-70 px-4 mb-1 mt-1", style: { background: "transparent" } },
                h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, color: t.bg2, background: t.ink, padding: "12px", borderRadius: 12, textAlign: "center" } },
                  moreSrc ? "✒ 点住上面那一句，从那儿动笔" : "✒ 写下你的行动")),
          // 收尾挪到顶栏右侧那个等宽位了（这一步不可逆，所以照旧要点两下）
          null)
        : null);
  }

  // ---------- 作者榜 ----------
  // 这个圈子里固定的那几位太太。⚠️不是「一排卡片」：作者榜在现实里是
  // 【一份署名表】——名字靠左立着，右边跟着她的产出。所以这一页长成一张表，
  // 不是网格（tabs-not-plain-pills.md 的同一条判据：换个 app 还成立就是没设计）。
  // 热度那一道朱笔：名册那一页和她的主页共用这一个（别各画各的）。
  // ⚠️给的是【条 + 话 + 数】三样：光一条看不出烫到哪儿了，光一个数她得自己去记 45／70。
  function heatMark(v, t, tail) {
    const b = window.Fanfic.heatBand(v);
    const red = "#a8392f";
    const on = b.key !== "calm";
    return h("span", { className: "flex items-center", style: { gap: 6, marginTop: 5 } },
      h("span", { style: { width: 44, height: 3, background: t.line, flexShrink: 0, overflow: "hidden" } },
        h("span", { style: { display: "block", height: "100%", width: Math.max(3, b.v) + "%", background: on ? red : t.fog } })),
      h("span", { style: { fontFamily: F_BODY, fontSize: 10, color: on ? red : t.fog } }, b.zh),
      h("span", { style: { fontFamily: "monospace", fontSize: 10, color: t.fog } }, b.v),
      tail ? h("span", { style: { fontFamily: F_BODY, fontSize: 10, color: t.fog, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, tail) : null);
  }
  function AuthorsPage(props) {
    const t = useTheme();
    const [list, setList] = useState(function () { return window.Fanfic.loadAuthors(); });
    const [open, setOpen] = useState(null);   // 打开的那位
    const [busy, setBusy] = useState(false);
    // 从别处点名进来（书评区点了某位太太的名字）：翻到她那一条
    useEffect(function () {
      const nm = String(props.startName || "").trim();
      if (!nm) return;
      const hit = window.Fanfic.loadAuthors().filter(function (a) { return String(a.name || "").trim() === nm; })[0];
      props.onStartUsed && props.onStartUsed();
      if (hit) setOpen(hit.id);
    }, [props.startName]);
    // 她 2026-09-11：「请作者的时候能不能给一个写想要什么类型或者文风还有磕啥 cp 的」。
    // ⚠️不另开一层：这是「一行字 + 一颗键」，开半窗反而更重（no-half-sheet.md 的判据）。
    //   记在本地：她多半想连着请几批同一个方向的人。
    // ⚠️同一天她又说：「那个框能不能放进请人里面，点击请人打开输入再生成」——
    //   原来它常年杵在名册顶上，而她十次里有九次是直接翻名册的。
    //   所以改成【点了「请人」才掀开】：不是新开一层（那才要按整页办），
    //   是那颗键自己底下长出来的一张稿约条。
    const [asking, setAsking] = useState(false);
    const [want, setWant] = useState(function () { try { return localStorage.getItem("x_ficAuthorWant") || ""; } catch (e) { return ""; } });
    const setWantSaved = function (v) { setWant(v); try { localStorage.setItem("x_ficAuthorWant", String(v || "").slice(0, 300)); } catch (e) {} };
    const fics = props.fics || [];
    function refresh() { setList(window.Fanfic.loadAuthors()); }
    async function invite() {
      if (busy) return;
      if (!props.active) { props.toast && props.toast("请先到设置配置 API"); return; }
      setBusy(true);
      try {
        const got = await window.Fanfic.genAuthors(props.active, 4, props.tabs, props.characters, props.userName, window.Fanfic.loadAuthors(), want);
        refresh(); setAsking(false);
        props.toast && props.toast("来了 " + got.length + " 位：" + got.map(function (a) { return a.name; }).join("、"));
      } catch (e) { props.toast && props.toast(String(e.message || e)); }
      setBusy(false);
    }
    const cur = open ? list.filter(function (a) { return a.id === open; })[0] : null;
    if (cur) return h(AuthorHome, { author: cur, fics: fics, characters: props.characters, userName: props.userName,
      onBack: function () { setOpen(null); refresh(); }, onOpenFic: props.onOpenFic, onAddOn: props.onAddOn,
      onDelete: function (nm) {
        window.Fanfic.removeAuthor(nm);
        setOpen(null); refresh();
        props.toast && props.toast("「" + nm + "」已请出名册（她的文留着）");
      } });
    // 一行一位：左边名字立着，右边是她的产出
    return h("div", { className: "h-full flex flex-col" },
      h(Head, { bg: "transparent", zh: "作者", sub: list.length ? list.length + " 位常驻" : "这个圈子还没人", onBack: props.onBack,
        right: h("button", { onClick: function () { if (!busy) setAsking(!asking); }, disabled: busy, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 12.5, color: busy ? t.fog : t.accent } },
          busy ? "请人中…" : (asking ? "算了" : "＋ 请人")) }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-5 pb-10" },
        h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, lineHeight: 1.7, padding: "10px 2px 8px" } },
          "她们是这个圈子的常驻——清空版块只清文，人留着。生成同人文时可以点名让某一位来写。"),
        // 点了「请人」才掀开的那张稿约条：一行眉标 + 一格空白 + 一颗键。
        asking ? h("div", { style: { border: "1px dashed " + t.line, padding: "11px 12px 12px", marginBottom: 14, background: "transparent" } },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 12.5, color: t.ink, letterSpacing: ".16em", marginBottom: 7 } }, "想请什么样的"),
          h("textarea", { value: want, onChange: function (e) { setWantSaved(e.target.value); }, rows: 3, autoFocus: true,
            placeholder: "写什么类型、什么文风、磕哪对…空着就随缘",
            className: "w-full outline-none", style: { fontFamily: F_BODY, fontSize: 12.5, lineHeight: 1.75, padding: "8px 0 10px",
              background: "transparent", color: t.ink, border: "none", borderBottom: "1px solid " + t.line, resize: "vertical" } }),
          h("button", { onClick: invite, disabled: busy, className: "w-full active:opacity-75",
            style: { marginTop: 12, minHeight: 44, border: "none", background: t.ink, color: t.bg2,
              fontFamily: F_BODY, fontSize: 13, letterSpacing: ".08em" } }, busy ? "去问了…" : "请 4 位进来")) : null,
        list.length ? list.map(function (a, i) {
          const mine = window.Fanfic.authorFics(a.name, fics);
          const cps = window.Fanfic.authorCPStats(a.name, fics, props.characters, props.userName);
          return h("button", { key: a.id, onClick: function () { setOpen(a.id); }, className: "w-full text-left active:opacity-70",
            style: { display: "flex", gap: 12, alignItems: "flex-start", padding: "13px 2px", borderTop: i ? "1px solid " + t.line : "none", background: "transparent", border: "none" } },
            // 名次：署名表上的序号，用等宽的老式数字
            h("span", { style: { fontFamily: "monospace", fontSize: 11, color: t.fog, width: 20, flexShrink: 0, paddingTop: 3 } }, String(i + 1).padStart(2, "0")),
            h("span", { style: { flex: 1, minWidth: 0 } },
              h("span", { style: { display: "block", fontFamily: F_DISPLAY, fontSize: 16, color: t.ink } }, a.name),
              a.style ? h("span", { style: { display: "block", fontFamily: F_BODY, fontSize: 11.5, color: t.sub, marginTop: 2, lineHeight: 1.55 } }, a.style) : null,
              h("span", { style: { display: "block", fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 4 } },
                mine.length + " 篇" + (cps.length ? " · 最常写 " + cps[0].label + "（" + cps[0].n + "）" : " · 还没写")),
              // 还没写过的那几位没有热度可言——热度是按篇记的，没篇就没有
              mine.length ? heatMark(window.Fanfic.authorHeatOf(a.name, fics).heat, t) : null),
            h(IChevR, { size: 15, color: t.fog, style: { marginTop: 4, flexShrink: 0 } }));
        }) : h(Empty, { text: "这个圈子还没有常驻作者", sub: "点右上「＋ 请人」请几位进来；生成同人文时也会自动把新笔名收进来" })));
  }
  // 一位作者的主页：她是谁 + 产出统计 + 她写过的篇目（每篇能直接加笔）
  // 太太的默认头像：同人站上没设头像的人就是这么一枚——一个圆、一个笔名首字。
  // 颜色按笔名 hash 定死，同一个人每次进来都是同一枚（不是随机的）。
  // @后面那串 id：同人站上每个人都有一个，按笔名定死（不是随机的，也不另存）
  function ficPenId(name) {
    const h2 = ficHash("penid:" + name);
    return String(h2 % 90000000 + 10000000);
  }
  function authorFace(name, size) {
    const hue = ficHash("face:" + name) % 360;
    const ch = String(name || "?").trim().slice(0, 1) || "?";
    return h("div", {
      style: {
        width: size, height: size, borderRadius: 999, flexShrink: 0,
        background: "linear-gradient(150deg,hsl(" + hue + ",34%,72%),hsl(" + ((hue + 38) % 360) + ",30%,55%))",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "rgba(255,253,247,.95)", fontFamily: "'Noto Serif SC',serif", fontSize: Math.round(size * 0.44),
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,.4)"
      }
    }, ch);
  }
  // 同人站上作者页那一行数：篇数和字数是【真的】（从她的文现算），
  // 粉丝和被收藏是这个圈子里的设定值——按笔名 hash 定死，不随机、不存计数器。
  // ⚠️不另存一份：存了之后文被清掉／改笔名，那个数就永远对不回来（只进不出的老毛病）。
  function authorStats(name, fics) {
    const mine = authorFics(name, fics);
    let words = 0, kudos = 0;
    mine.forEach(function (f) {
      // ⚠️章节存的那一栏叫 content（见 genBatch 落库那段），不是 body。
      //   照着读的那头编字段名，这个数会一直是 0 而且不报任何错
      //   （施工规则/stub-from-the-writer.md）。这儿直接用现成的 ficWords。
      words += ficWords(f);
      kudos += (f.stats || ficHeat(f.id)).kudos;
    });
    const seed = ficHash("au:" + name);
    return {
      works: mine.length,
      words: words,
      kudos: kudos,
      fans: 120 + seed % 48000 + mine.length * 260,
      following: 8 + (seed >> 7) % 190
    };
  }
  // 正字计数：写了几篇就划几笔。同人圈里数产出本来就是这么数的，
  // 一根填色横条换到任何 app 里都成立，这个换不了。
  // 正的笔顺：① 上横 ② 中竖 ③ 中短横 ④ 左竖 ⑤ 下横
  const ZHENG_STROKES = ["M3 3 H17", "M10 3 V17", "M4 10 H10", "M4 10 V17", "M3 17 H17"];
  function zhengTally(n, color, size) {
    const full = Math.floor(n / 5), rest = n % 5, boxes = [];
    for (let k = 0; k < full; k++) boxes.push(5);
    if (rest) boxes.push(rest);
    if (!boxes.length) boxes.push(0);
    return h("span", { className: "flex items-center", style: { gap: 3, flexWrap: "wrap" } },
      boxes.map(function (cnt, bi) {
        return h("svg", { key: bi, width: size, height: size, viewBox: "0 0 20 20", "aria-hidden": true, style: { display: "block", flexShrink: 0 } },
          ZHENG_STROKES.slice(0, cnt).map(function (d, si) {
            return h("path", { key: si, d: d, stroke: color, strokeWidth: 1.9, strokeLinecap: "round", fill: "none" });
          }));
      }));
  }
  const CN_NUM = "〇一二三四五六七八九";
  function cnIndex(n) {
    if (n < 10) return CN_NUM[n];
    if (n < 20) return "十" + (n % 10 ? CN_NUM[n % 10] : "");
    return CN_NUM[Math.floor(n / 10)] + "十" + (n % 10 ? CN_NUM[n % 10] : "");
  }
  // 闲章：一枚朱红的方印，同人志扉页上作者落款就是这么一枚。
  // ⚠️刻的是笔名【末】一个字，不是头一个——头一个已经在圆头像上了，
  //   两处刻同一个字，那枚印就白盖了。
  function authorSeal(name, size) {
    const nm = String(name || "?").trim();
    const ch = nm.slice(-1) || "?";
    return h("div", {
      style: {
        width: size, height: size, flexShrink: 0, borderRadius: 3,
        background: "#a8392f", border: "1.5px solid #8d2c24",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "rgba(255,246,238,.95)", fontFamily: "'Noto Serif SC',serif",
        fontSize: Math.round(size * 0.56), lineHeight: 1,
        boxShadow: "inset 0 0 0 1.5px rgba(255,246,238,.5)"
      }
    }, ch);
  }
  // ⚠️这一页不是「一张个人资料卡」——那种东西换到任何 app 里都成立（她 2026-09-05：
  //   「页面还是无聊」）。它是**她那本个人志的扉页 + 目录**：
  //   上半页是扉页（双线框、落款闲章、手写的一句），下半页是目录（卷号 + 引点线 + 字数）。
  function AuthorHome(props) {
    const t = useTheme();
    const a = props.author;
    const mine = window.Fanfic.authorFics(a.name, props.fics).slice().sort(function (x, y) { return (y.updatedAt || y.createdAt || 0) - (x.updatedAt || x.createdAt || 0); });
    const cps = window.Fanfic.authorCPStats(a.name, props.fics, props.characters, props.userName);
    const st = window.Fanfic.authorStats(a.name, props.fics);
    const [ask, setAsk] = useState(false);
    const stat = function (k, v) {
      return h("span", { key: k, className: "flex items-baseline", style: { gap: 3, whiteSpace: "nowrap" } },
        h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog } }, k),
        h("span", { style: { fontFamily: F_DISPLAY, fontSize: 13, color: t.ink } }, fmtNum(v)));
    };
    const sec = function (zh) {
      return h("div", { className: "flex items-center", style: { gap: 8, margin: "20px 0 9px" } },
        h("span", { style: { fontFamily: F_DISPLAY, fontSize: 12.5, color: t.ink, letterSpacing: ".22em", whiteSpace: "nowrap" } }, zh),
        h("span", { style: { flex: 1, height: 1, background: t.line } }));
    };
    return h("div", { className: "h-full flex flex-col" },
      h(Head, { bg: "transparent", zh: a.name, sub: st.works + " 篇", onBack: props.onBack }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-5 pb-10" },
        // ── 扉页：双线框 + 头像 + 笔名 + 落款闲章 ──
        h("div", { style: { marginTop: 12, padding: "16px 15px 14px", border: "1px solid " + t.line, boxShadow: "inset 0 0 0 3px " + (t.bg2 || t.bg) + ", inset 0 0 0 4px " + t.line, background: t.bg2 || t.bg } },
          h("div", { className: "flex items-start", style: { gap: 12 } },
            window.Fanfic.authorFace(a.name, 52),
            h("div", { style: { flex: 1, minWidth: 0 } },
              h("div", { style: { fontFamily: F_DISPLAY, fontSize: 20, color: t.ink, letterSpacing: ".04em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, a.name),
              h("div", { style: { fontFamily: "monospace", fontSize: 10.5, color: t.fog, marginTop: 3 } }, "@" + ficPenId(a.name))),
            window.Fanfic.authorSeal(a.name, 34)),
          a.bio ? h("div", { style: { fontFamily: "'Noto Serif SC',serif", fontSize: 13, lineHeight: 1.9, color: t.ink, marginTop: 12, paddingTop: 11, borderTop: "1px solid " + t.line } }, a.bio) : null,
          // 那一行数：小字排成一行，不是五个并排的大数字（那是社交 app 的长相）
          h("div", { className: "flex", style: { gap: 13, marginTop: 11, flexWrap: "wrap" } },
            stat("作品", st.works), stat("字", st.words), stat("被喜欢", st.kudos), stat("粉丝", st.fans), stat("关注", st.following))),
        // ⚠️扉页底下这一块是【她自己挂在个人页上的签名】，不是第三人称的介绍
        //   （她 2026-09-11：「里面那一块应该是她自己的签名而不是第三人称描述」）。
        //   老存档里的太太没有这一栏——那就不画这一块，不拿路数去顶（顶上去就又是第三人称）。
        a.sign ? h("div", { style: { fontFamily: "'Noto Serif SC',serif", fontSize: 13, lineHeight: 1.85, color: t.sub, marginTop: 13, borderLeft: "2px solid " + t.line, paddingLeft: 11 } }, a.sign) : null,
        // 路数挪到这儿来，跟「碰不得」「你动她的文」排成一列：这三样都是【关于她的】，
        // 签名那一块是【她自己说的】，两种东西不该长成一个样子。
        a.style ? h("div", { className: "flex items-start", style: { gap: 7, marginTop: 13 } },
          h("span", { style: { fontFamily: F_BODY, fontSize: 9.5, color: t.sub, border: "1px solid " + t.line, borderRadius: 2, padding: "1px 6px", flexShrink: 0, marginTop: 2, whiteSpace: "nowrap" } }, "她的文"),
          h("span", { style: { fontFamily: F_BODY, fontSize: 11.5, lineHeight: 1.7, color: t.sub } }, a.style)) : null,
        a.sore ? h("div", { className: "flex items-start", style: { gap: 7, marginTop: 9 } },
          h("span", { style: { fontFamily: F_BODY, fontSize: 9.5, color: "#fff", background: "#a8392f", borderRadius: 2, padding: "1.5px 6px", flexShrink: 0, marginTop: 2, whiteSpace: "nowrap" } }, "碰不得"),
          h("span", { style: { fontFamily: F_BODY, fontSize: 11.5, lineHeight: 1.7, color: t.fog } }, a.sore)) : null,
        // 有人改她的文时她是哪一路——加笔那边整场就跟着这一句走，所以这儿要看得见
        a.temper ? h("div", { className: "flex items-start", style: { gap: 7, marginTop: 7 } },
          h("span", { style: { fontFamily: F_BODY, fontSize: 9.5, color: t.bg, background: t.ink, borderRadius: 2, padding: "1.5px 6px", flexShrink: 0, marginTop: 2, whiteSpace: "nowrap" } }, "你动她的文"),
          h("span", { style: { fontFamily: F_BODY, fontSize: 11.5, lineHeight: 1.7, color: t.fog } }, a.temper)) : null,
        // 热度：名册那一页只看得见数，看不见是为哪一篇气的——这儿把那一篇也写上
        (function () {
          const hb = window.Fanfic.authorHeatOf(a.name, props.fics);
          return hb.n ? heatMark(hb.heat, t, hb.fic ? "《" + hb.fic.title + "》" : "") : null;
        })(),
        // ── 写了谁：正字计数 ──
        cps.length ? h("div", null, sec("写了谁"),
          cps.map(function (c) {
            return h("div", { key: c.key, className: "flex items-center", style: { gap: 9, marginBottom: 7 } },
              h("span", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.sub, width: 92, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, c.label),
              window.Fanfic.zhengTally(c.n, t.ink, 17),
              h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog } }, c.n + " 篇"));
          })) : null,
        // ── 目录：卷号 + 引点线 + 字数（书里的目录就长这样）──
        sec("目 录"),
        mine.length ? mine.map(function (f, ix) {
          const hh = f.stats || ficHeat(f.id);
          const w = ficWords(f);   // ⚠️同上：章节那一栏叫 content
          return h("div", { key: f.id, style: { padding: "9px 0 10px", borderBottom: "1px dotted " + t.line } },
            h("div", { className: "flex items-baseline", style: { gap: 8 } },
              h("span", { style: { fontFamily: F_DISPLAY, fontSize: 12, color: t.fog, width: 20, flexShrink: 0, textAlign: "center" } }, cnIndex(ix + 1)),
              h("button", { onClick: function () { props.onOpenFic && props.onOpenFic(f.id); }, className: "text-left active:opacity-70", style: { minWidth: 0, background: "transparent", border: "none", padding: 0, fontFamily: F_DISPLAY, fontSize: 14.5, color: t.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, f.title),
              h("span", { style: { flex: 1, minWidth: 12, borderBottom: "1px dotted " + t.line, transform: "translateY(-3px)" } }),
              h("span", { style: { fontFamily: "monospace", fontSize: 10.5, color: t.fog, flexShrink: 0 } }, fmtNum(w))),
            h("div", { className: "flex items-center", style: { gap: 6, marginTop: 5, paddingLeft: 28, flexWrap: "wrap" } },
              h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog } }, cpLabel(f.cp, props.characters, props.userName) + " · " + (f.chapters || []).length + " 章 · ♡ " + fmtNum(hh.kudos)),
              (f.tags || []).slice(0, 3).map(function (tg, k) {
                return h("span", { key: k, style: { fontFamily: F_BODY, fontSize: 10, color: t.sub, border: "1px solid " + t.line, borderRadius: 3, padding: "1px 6px", whiteSpace: "nowrap" } }, tg);
              }),
              h("span", { style: { flex: 1 } }),
              h("button", { onClick: function () { props.onAddOn && props.onAddOn(f.id); }, className: "shrink-0 active:opacity-70",
                style: { fontFamily: F_BODY, fontSize: 11, color: t.accent, border: "1px solid " + t.accent, borderRadius: 999, padding: "3px 10px" } }, "加笔")));
        }) : h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, padding: "10px 0" } }, "她还没在这儿写过——生成同人文时点名让她写一批。"),
        // ── 请她离开（她 2026-09-05 要的）──
        props.onDelete ? h("div", { style: { marginTop: 26 } },
          ask
            ? h("div", { style: { border: "1px solid " + t.line, borderRadius: 10, padding: "12px 13px", background: t.bg2 || t.bg } },
              h("div", { style: { fontFamily: F_BODY, fontSize: 12, lineHeight: 1.75, color: t.ink } },
                "把「" + a.name + "」从名册里请走？"),
              h("div", { style: { fontFamily: F_BODY, fontSize: 11, lineHeight: 1.7, color: t.fog, marginTop: 5 } },
                mine.length ? "她写过的 " + mine.length + " 篇文【留着】，只是往后不再点得到她了。" : "她还没写过文，删掉不影响任何东西。"),
              h("div", { className: "flex", style: { gap: 9, marginTop: 12 } },
                h("button", { onClick: function () { setAsk(false); }, className: "flex-1 active:opacity-70", style: { fontFamily: F_BODY, fontSize: 12.5, color: t.ink, border: "1px solid " + t.line, borderRadius: 10, padding: "9px 0", background: "transparent" } }, "算了"),
                h("button", { onClick: function () { props.onDelete(a.name); }, className: "flex-1 active:opacity-70", style: { fontFamily: F_BODY, fontSize: 12.5, color: "#fff", background: "#a8392f", border: "1px solid #a8392f", borderRadius: 10, padding: "9px 0" } }, "请走")))
            : h("button", { onClick: function () { setAsk(true); }, className: "w-full active:opacity-65", style: { fontFamily: F_BODY, fontSize: 12.5, color: "#a8392f", border: "1px solid rgba(168,57,47,.4)", borderRadius: 10, padding: "11px 0", background: "transparent" } }, "把这位请出名册")) : null));
  }

  // ---------- 底 nav ----------
  function BottomNav(props) {
    const t = useTheme();
    const items = [
      // 她 2026-09-04：「中间那个加号（自己写文）移到我的里面，把加笔移到中间，
      // 原来的地方放作者榜」。中间那一枚是这个 app 的主动作——现在主动作是加笔。
      { key: "feed", label: "首页", G: IHome }, { key: "shelf", label: "书架", G: IShelf },
      { key: "rp", label: "加笔", center: true }, { key: "authors", label: "作者", G: IAuthors }, { key: "mine", label: "我的", G: GUser }
    ];
    // ⚠️底栏只吃 0.4 条底部安全区（COMPOSER_PAD_BOTTOM，engine.js）——
    // 和主聊天输入栏、购物底栏同一把尺子。这里原来吃的是【整条】
    // env(safe-area-inset-bottom)，在刘海机上比别处高出一截，
    // 正是 施工规则/mobile-ui-layout.md §2 点名不许干的事。
    // 图标 21 / 字号 10 / gap-0.5 也一并对齐购物那条底栏。
    return h("div", { className: "shrink-0 flex", style: { borderTop: "1px solid " + t.line, background: t.bg, paddingBottom: COMPOSER_PAD_BOTTOM } },
      items.map(function (it) {
        const on = props.view === it.key;
        if (it.center) return h("button", { key: it.key, onClick: function () { props.onNav(it.key); }, className: "flex-1 py-2 flex items-center justify-center" },
          h("div", { className: "flex items-center justify-center", style: { width: 36, height: 36, borderRadius: 999, background: on ? t.accent : t.ink } }, h(IQuill, { size: 19, color: t.bg2 })));
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
    const [view, setView] = useState("feed"); // feed / shelf / publish / rp / authors / mine
    const [rpStart, setRpStart] = useState(null); // 从作者主页点「加笔」带过来的那一篇
    const [openId, setOpenId] = useState(null);
    // ── 从房间里那张「他写好了」直接翻到这一章（她 2026-09-12：
    //    「从房间到同人文有点慢，能不能搞个快捷键可以写了新章直接跳转过去」）
    // ⚠️只带【一次】：用完就还回去（onOpenUsed），否则她翻到别的篇、
    //   一 setState 又被拽回这一章。
    const [jumpChap, setJumpChap] = useState(null);
    useEffect(function () {
      const j = props.openFic;
      if (!j || !j.ficId) return;
      const f = (loadFics() || []).filter(function (x) { return x && x.id === j.ficId; })[0];
      if (f) { setFics(loadFics()); setView("feed"); setOpenId(f.id); setJumpChap(Number(j.chap) >= 0 ? Number(j.chap) : null); }
      else if (props.toast) props.toast("那一篇找不到了");
      props.onOpenFicUsed && props.onOpenFicUsed();
    }, [props.openFic]);
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
    // 从书评区点进某位太太的主页：带一个笔名过去，那一页自己翻到她那一条
    const [authorStart, setAuthorStart] = useState("");
    const curTab = tabs.find(function (x) { return x.id === activeTab; }) || tabs[0];

    function persistFics(next) { if (saveFics(next)) { setFics(next); return true; } props.toast && props.toast("这次没保存成功，原文章还在"); return false; }
    function updateFic(id, fn) {
      const next = loadFics().map(function (f) { return f.id === id ? fn(Object.assign({}, f)) : f; });
      persistFics(next);
    }
    // 单篇删除（v64.63，她 2026-09-06：「要每一篇文可以单独删除」）。
    // ⚠️只从存档里拿掉这一篇，别动别的；删完不弹 toast——列表当场少一行，
    //   那比一句话更清楚（确认框已经问过一次了）。
    function deleteFic(id) {
      persistFics(loadFics().filter(function (f) { return f.id !== id; }));
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
    async function doGen(n, cp, styleIds, includeMe, briefs, byAuthor, groupWay) {
      // ⚠️**用 cast 不是 characters**（她 2026-09-11 那三篇的病根就在这一行）：
      //   characters 是【真人角色】那一份，不含配角；cast 才是含配角的全量。
      //   挑人那一格用的是 cast（所以她挑得到「萧成烨」），可这一枪用的是 characters，
      //   于是配角出身的那一位在 cpChars 里【解析不出来、被 filter(Boolean) 悄悄丢掉】，
      //   两个人的 CP 变成一个人 —— cpBlock 就掉进「A × 原创对象」那一支，
      //   提示词上明明白白写着「另一方是一个由你设定的原创角色」。
      //   模型照做了：那只精怪、那个沈清和，都是这么来的。少掉的那一位从来没进过提示词。
      //   （一层写在两处、第二处没跟上：picker 升级成 cast 时，这一枪没跟着升。）
      const missing = (cp || []).filter(function (tok) {
        return tok && tok !== "me" && !cast.some(function (c) { return c && c.id === tok; });
      });
      // ⚠️再加一道明的：解析不出来就别开枪。悄悄少一位＝花了钱拿回一篇写跑的文，
      //   而她要翻开才知道。
      if (missing.length) {
        props.toast && props.toast("这一对里有 " + missing.length + " 位找不到了（多半是被删了），先去「谁和谁」重挑一下");
        return;
      }
      setGearOpen(false);
      props.toast && props.toast("已放到后台生成（" + n + " 篇），可以先去别的页面");
      const run = async function (updateProgress) {
        const chars = cpChars(cp, cast, props.profile);
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
        const opts = { style: styleText, perFic: cfg.perFic, minChars: cfg.minChars, chatMaterial: chatMaterialFor(chars), worldPool: worldPool,
          briefs: briefList, author: byAuthor || null,
          includeMe: !!includeMe, meName: (props.profile && props.profile.name) || userName || "我", mePersona: (props.profile && props.profile.persona) || "",
          groupWay: String(groupWay || "").trim() };
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
            // ⚠️那一向要落在【这篇文】上：续写第七章、加笔穿进去，读的都是这一栏
            id: uid("fic"), tabId: curTab.id, cp: cp || [], groupWay: String(groupWay || "").trim(), title: x.title, author: x.author, tags: x.tags, premise: x.premise || "",
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
      return h(ThemeContext.Provider, { value: ficPaperTheme(appTheme, fPaper) },
        h(FicMotionStyles, null),
        // ⚠️key 用这一篇的 id：换一篇就重挂一次，封面才会再掀一遍
        h("div", { key: f.id, className: "fic-open-book relative" }, h(Reader, {
        paper: fPaper,
        onSetPaper: function (pid) { updateFic(f.id, function (x) { x.paper = pid; return x; }); },
        fic: f, tab: ftab, active: props.active, characters: cast, fwdChars: characters, profile: props.profile,
        startChap: jumpChap, onStartChapUsed: function () { setJumpChap(null); },
        onOpenAuthor: function (nm) { setAuthorStart(nm); setView("authors"); },
        groups: props.groups || [], userName: userName, worldbook: props.worldbook, worldbookFor: props.worldbookFor, toast: props.toast,
        // 关阅读页时把进度重取一遍，卡片上那句「读到 3/8 章」才跟得上
        onBack: function () { setOpenId(null); setReadMap(loadRead()); },
        onUpdate: updateFic, onToggleShelf: toggleShelf, onLike: likeFic,
        onForwardToChat: fwdChat, onForwardToGroup: fwdGroup, onChapterShared: chapterShared,
        // 让角色来写：他跟她、跟 CP 另一方是什么关系，由 app 那头算好递进来
        relOf: props.relOf, onFileChapter: props.onFileChapter, onNoteChapter: props.onNoteChapter, allChars: props.allChars
      })));
    }

    // ---- 各子页 ----
    let inner;
    if (view === "publish") {
      inner = h(Publish, { tabs: tabs, characters: cast, userName: userName, toast: props.toast, onBack: function () { setView("feed"); }, onPublish: publish });
    } else if (view === "mine") {
      inner = h(Mine, { characters: cast, cps: cps, userName: userName, me: me, fics: fics, profile: props.profile, active: props.active, toast: props.toast,
        onPaper: setPaperId,
        onBack: function () { setView("feed"); }, onAddCP: addCP, onDelCP: delCP, onWrite: function () { setView("publish"); },
        onOpenFic: function (id) { setOpenId(id); }, onSaveMe: saveMeFn, onDeleteFic: deleteFic });
    } else if (view === "rp") {
      inner = h(RPApp, { fics: fics, tabs: tabs, characters: cast, profile: props.profile, userName: userName, active: props.active, worldbook: props.worldbook, worldbookFor: props.worldbookFor, toast: props.toast, onBack: function () { setView("feed"); }, startFicId: rpStart, onStartUsed: function () { setRpStart(null); },
        // ⚠️这两条原来【一条都没传】：收尾那段代码写着 if (props.onShelveFic)，
        //   一路声明、一路转发、最后没人给——于是「这一版放回书架」从上线起一次都没发生过，
        //   而且不报任何错（施工规则/four-surfaces-same-context.md v55.95 那个形状：
        //   声明了但没人引用，比压根没写更坏，看代码以为已经在发了）。
        onShelveFic: function (f) { persistFics([f].concat(loadFics())); },
        // 她续的那一章追加进【原篇】：只往末尾加，前面的段落一个下标都不许动
        onExtendFic: function (id, ch) { updateFic(id, function (f) { f.chapters = (f.chapters || []).concat([ch]); f.updatedAt = Date.now(); return f; }); } });
    } else if (view === "authors") {
      inner = h(AuthorsPage, { fics: fics, tabs: tabs, characters: cast, userName: userName, active: props.active, toast: props.toast,
        startName: authorStart, onStartUsed: function () { setAuthorStart(""); },
        onBack: function () { setView("feed"); },
        onOpenFic: function (id) { setOpenId(id); },
        // 从作者主页直接加笔：把这一篇递给加笔那一屏，省得再去列表里找
        onAddOn: function (id) { setRpStart(id); setView("rp"); } });
    } else {
      // feed / shelf。item 5：收藏(onShelf)的从 feed 移除、只在书架出现
      // 搜的时候连 CP 里那几个人的名字一起搜——「按 CP 找」用的就是这条：
      // 打「裴照川」出来的是所有写他的，不用先建一个 CP 预设。
      const kw = q.trim().toLowerCase();
      const hay = function (f) {
        const cpNames = (f.cp || []).map(function (id) {
          if (id === "me") return userName + " 我";
          // ⚠️同上：按 CP 找的时候也得看得见配角，不然写配角的那几篇搜不出来
          const c = cast.find(function (x) { return x.id === id; });
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
        // 紧凑标题栏（施工规则/mobile-ui-layout.md §1）：原先那块 30px 大标题
        // ＋「FANFIC」副标，一屏先被吃掉五分之一，正文卡片只剩两张半。
        h(Head, { zh: view === "shelf" ? "书架" : "同人文",
          sub: view === "shelf" ? "收进来的那些" : "别人都在写什么",
          onBack: props.onBack, bg: "transparent", noLine: true,
          right: h("div", { className: "flex items-center justify-end", style: { gap: 10 } },
            view === "shelf" ? h("button", { onClick: function () { const n = exportFanficAudit(tabs, loadFics(), loadCfg()); props.toast && props.toast("已导出 " + n + " 篇同人文诊断稿"); }, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 12, color: t.accent } }, "导出")
              : view === "feed" ? h(React.Fragment, null,
                  h("button", { onClick: clearTab, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 12, color: t.fog } }, "清空"),
                  h("button", { onClick: function () { setGearOpen(true); }, disabled: busy, className: "active:opacity-60", title: "生成配置" }, h(GConfig, { size: 19, color: t.ink })))
              : null) }),
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
              index: i, leadLabel: view === "shelf" ? "架上这一本" : "圈子里最上面那一篇",
              readAt: rd ? (chN > 1 && rd.chap > 0 ? "读到 " + (rd.chap + 1) + "/" + chN : "读过") : "",
              onTag: function (tag) { setTagFilter(tag === tagFilter ? "" : tag); },
              onOpen: function () { setOpenId(f.id); }, onLike: function () { likeFic(f.id); } });
          }) : (busy ? null : h(Empty, { text: view === "shelf" ? "书架空空" : "本版还没有同人文", sub: view === "shelf" ? "收藏或发布的篇目会留在这里追更" : "点右上角齿轮生成，或在「我的 → 自己写一篇」里自己写" }))));
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
