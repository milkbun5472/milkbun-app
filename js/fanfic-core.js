// ============================================================
// 同人文 · 开机就要的那一半（从 js/fanfic.js 搬出来，她 2026-10-18 继续瘦身）
// ============================================================
// 同人文页面（fanfic.js）改成点进同人文才加载；可小房间里「一起写」、聊天拼提示词（ficRecapForChat、cpLabel）、
// 聊天卡片点开邀稿（onOpenFicInvite）这些开机就要 window.Fanfic 那整套数据和提示词接口——那一半连同它用到的
// 作者名片、CP 标签这些住在这儿。页面那一半从 window.FanficCore 取，不另写。
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
    "· 感官与比喻要落在这两个人此刻的具体处境上（这间屋子、这件衣服、TA手边的东西），不要通用言情模板。\n" +
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
    "· ✗ 事后满足地叹气、把人搂得更紧 → ✓ 收尾落在一个【别扭的、只属于这个人的】小动作上：TA想做又中途改了主意，改的理由来自TA对对方的了解。\n" +
    "核心：情绪全部藏进「有来由的动作＋这个场景里真实存在的物件＋说歪的话」，一整段可以不出现任何情绪词；每一处亲密都要能回答『为什么是这个动作、为什么是此刻』。\n" +
    "⚠️上面的 ✓ 是判据不是范文。若某一句写完之后，把两位主角换成任何别的角色也照样成立，就是写坏了，重写那一句。";

  // world book 亲密场景「设定层」补充（拼进当前 tab 世界观之后）——中文比喻词表走「可用」方向，
  // 上面 FANFIC_ANTI_CLICHE 走「禁用」方向，两头夹。
  const INTIMACY_WORLDNOTE =
    "【亲密场景写作设定层】写到亲密/情欲时：动作与反应必须『非这两个人不可』，" +
    "优先写角色专属的小动作、口癖、TA在意的具体细节；收尾落在一句符合TA声纹的话或只属于他俩的细节上，" +
    "别用『埋进颈窝深吸气／忍不住求饶／热流直冲天灵盖』这类通用模板收尾。尺度贴合本世界观基调，别自我阉割也别为露骨而露骨。";

  // ---- 预设世界观 tab（首启种子）------------------------------------
  // mixed:true 的「推荐」= 从其它版块类别随机抽来写（每篇随机挑一个世界观）
  // ---------- 预设世界观 tab（首启种子）------------------------------------
  // 顺序不照热门榜排（那是别人站里的排法），按【她俩的温度】排：
  // 推荐打头，写他们最多的古风/ABO 顶到前面，冷门题材靠后。
  const SEED_TABS = [
    { id: "tab_reco", name: "推荐", desc: "综合推荐——从所有世界观类别里随机抽取来写，冷暖甜虐各种题材混着来。", seed: true, mixed: true },
    { id: "tab_ancient", name: "古风", desc: "古风架空。朝堂、江湖、深宅、边关。\n【文风必须真的古】要有半文半白的古白话语感（近《红楼》《金瓶》话本、明清世情小说的腔调），不是套了古装的现代小说：\n· 叙述与对白都用文白相间的句子，多用四字短语、对仗与留白；句子偏短，忌长句欧化从句。\n· 称谓、器物、时辰、礼数都用古时说法（妾身/在下/郎君/娘子、更漏/时辰、案几/罗帐/袖中、拱手/敛衽），第一/第二人称少用「你我」多用身份称谓。\n· 严禁现代词与翻译腔：像「感觉/情绪/状态/氛围/空气/时间仿佛静止/心脏/大脑/紧张/放松/关系/沟通/瞬间/画面」这类词一律换成古意表达或删去。\n· 情感靠动作、景物、器物与欲言又止来递，隐忍克制，别直白宣泄、别现代心理描写。", seed: true },
    { id: "tab_abo", name: "ABO", desc: "ABO 世界观。Alpha/Beta/Omega 三分性别、信息素、易感期/发情期、标记。\n【文风】设定内自洽，信息素与本能是核心张力：\n· 信息素要写成【只属于这一个人】的气味与生理反应：它像什么该跟TA的来历、职业、住处对得上；忌那几种谁身上都有的甜味木香，忌一律用「突然爆发」推进。\n· 张力核心是「本能推着走 vs 人想自己选」：克制、抵抗、社会规训下的身不由己要写足，别一闻就倒。\n· 涉及标记/发情期要有前因后果与事后代价（药剂、请假、旁人眼光），设定要落进生活肌理，不只是床戏开关。\n· 忌把 Omega 写成无脑娇弱花瓶、把 Alpha 写成发情机器——性别设定之下先是活人。", seed: true },
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
      }, "data-wk": "ficpaperswatch", "data-on": on ? "1" : "0"
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
  // ⚠️「最少写多少字」这三样（上限、clamp、数字数）2026-09-28 搬去了公共那一份
  //   （style-presets.js 的 clampWordFloor / countWords / WORD_FLOOR_MAX），
  //   因为小剧场也要同一根拉条，而同一个形状不许各写各的
  //   （施工规则/one-public-mechanism.md：开公共的，已有的也搬过去）。
  //   这儿只留转交，不保留第二套算法；minCharsFor 那条「没填就按 perFic 折算」
  //   是同人文自己的分寸，留在本地。
  const _SP = () => (typeof window !== "undefined" && window.StylePresets) || null;
  const MIN_CHARS_MAX = (_SP() && _SP().WORD_FLOOR_MAX) || 20000;
  function clampMinChars(v) { const sp = _SP(); return sp ? sp.clampWordFloor(v) : 0; }
  function minCharsFor(cfg) {
    const set = clampMinChars(cfg && cfg.minChars);
    if (set) return set;
    // 没填就照老规矩折算：perFic 是 token，中文一个字大约 1.5 个 token
    return Math.max(600, Math.round(clampPerFic(cfg && cfg.perFic) * 0.55));
  }
  // 数正文有多少字：空白一律不算（中文没有词间空格，空格多半是排版）——同上，只转交
  function countChars(text) { const sp = _SP(); return sp ? sp.countWords(text) : String(text || "").replace(/\s/g, "").length; }
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
      "她的文读起来什么感觉——话多还是话少、快还是慢",
      "她写得最多的是哪种情节，最不爱写的是哪种",
      "她写对话还是写场面，另一样明显弱",
      "她一般写长篇还是短篇、坑多不多、结局好不好",
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
  // 外貌单独一行发：人设里没写长相的，续写时模型就会自己编一副（她 2026-10-16 群友：「把 U 的外貌全写错了」）
  function sideDesc(c) {
    const look = String((c && c.appearance) || "").trim().slice(0, 400);
    const p = personaOf(c) + (look ? "\n外貌（务必贴合，别自己另编发色、长相）：" + look : "");
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
  function ficOpts(fic, opts) {
    const o = Object.assign({}, opts || {}, { groupWay: groupWayOf(fic, opts) });
    if ((opts && opts.noCP) || (fic && fic.noCP)) o.noCP = true;   // 无 CP 跟着这篇文走，续写也不长出感情线
    // 「他俩 × 我」那种三人文（她 2026-10-17 群友：续写时 U 的外貌又丢了）：原来只有新写那一枪知道要带上「我」，
    //   文上没记，续写、写长一点、请原作者回来都照「只写他俩」写——「我」整个被挤出去，外貌更不用说。现在记在文上（withMe），这几枪都跟着带
    if (fic && fic.withMe && o.includeMe == null) {
      const me = ficMeProfile(fic.cp, null, fic.meMask);
      Object.assign(o, { includeMe: true, meName: (me && me.name) || "我", mePersona: (me && me.persona) || "", meAppearance: (me && me.appearance) || "" });
    }
    return o;
  }
  // ── 同人文到底是什么 ──────────────────────────────────────────────
  // 她 2026-09-11 亲口定的：**「同人文本来就是『他们俩换了个身份世界观继续相爱』。」**
  // 她同一轮还说：「他们身份也不应该被带入同人文吧」——
  // ⚠️所以上一版我顺手加的「把他俩在主线里的关系发过去」是反的，当场撤掉（不是留着不发）：
  //   带进去的是【这个人】，不是【TA在别处的身份和关系】。
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
  // 左右位放在整份提示词最后再说一遍（群里 2026-10-18：「gl 同人文上下位总是反，想看什么填好了还是会反」）：
  //   铁律本身在 cpBlock 里，可它夹在中间，后面跟着几千字文风、角度、格式，到动笔时已经被冲淡了——
  //   完结短篇那一条也是这么栽的（oneShotBlock）。这里只是把同一条【挪到离动笔最近的地方】再念一遍，不是加新规矩。
  function posTail(cpChars, opts) {
    opts = opts || {};
    if (!cpChars || !cpChars.length || cpChars.length > 2 || opts.noCP) return "";
    const l = cpChars[0].name, r = cpChars.length === 2 ? cpChars[1].name : "原创对象";
    return "\n\n【左右位，动笔前再看一眼】「" + l + "」是左位、主导，「" + r + "」是右位、承受——亲密场面里谁主动、谁被动、谁在上，全照这个顺序写，"
      + "跟谁更强势、谁更年长、性别是什么都没关系。";
  }
  function cpBlock(cpChars, opts) {
    opts = opts || {};
    if (!cpChars || !cpChars.length)
      // 群里 2026-10-17：「不选 CP 的话出来的都是 bl，我都变成男的了」——「同人」两个字让模型默认写成男男，
      //   还把读者写进去当了其中一个男主。性向和读者都不替她预设。
      return "【CP】未指定具体 CP——写原创向/群像向短篇，主角自拟，别硬凑现有角色。"
        + "主角的性别和这一对的性向都别预设：不因为是「同人」就默认写成男男，也不默认写成男女；看这个分区的设定和文风来定，没写就各篇自己挑、别篇篇一样。"
        + "这是原创向，读者本人不在文里：别用「你」把读者写成主角之一。";
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
    // 无 CP（她 2026-10-17）：挑了人、不要感情线——就是这几个人（挑了「我」也有我）的故事。不发左右位、不发爱情向。
    if (opts.noCP) {
      return "【无 CP：" + cpChars.map(function (c) { return c.name; }).join("、") + "】"
        + "这一篇写这几个人的故事，**不是 CP 文，默认没有感情线**：他们之间是什么关系照各自的设定和这一篇的剧情来，"
        + "不许写成恋爱、不许往暧昧上带，也别在里头挑两个配成一对。\n"
        + cpChars.map(function (c) { return "· " + sideDesc(c); }).join("\n")
        + (cpChars.length >= 2 ? "\n⚠️几个人说话的调子、在意的事、动手的方式都得分得开，不许共用一种语气。" : "")
        + worldIdentityLine(cpChars) + evenSidesLine(cpChars);
    }
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
      return "【CP：" + a.name + " × " + meName + "（读者本人/我） × " + b.name + "】\n这是三人同框：把『我』作为真正的第三方写进去，三个人彼此之间都有关系张力，别把『我』写成旁观者或工具人。\n· " + sideDesc(a) + "\n· 「" + meName + "」是读者本人（我）" + (opts.mePersona && opts.mePersona.trim() ? "，按这份面具人设来写：\n" + opts.mePersona.trim() : "，没填人设就自由发挥其性格")
        + (opts.meAppearance && String(opts.meAppearance).trim() ? "\n外貌（务必贴合，别自己另编发色、长相）：" + String(opts.meAppearance).trim().slice(0, 400) : "") + "\n· " + sideDesc(b) + worldIdentityLine(cpChars) + evenSidesLine(cpChars) + loveLine() + posRule(a.name, b.name);
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
  //   被整段搬进了文里**——她本人被换成一个男精怪跟TA做爱，台词还是她真说过的原话，
  //   皇帝一场都没出。三样病根，一样一样堵：
  //   ① 原来把【她说的话】也发了，而且标成「对方」——一个没名字的对话方，
  //      模型顺手就给它安一个人。于是她的原话从别人嘴里说了出来。
  //      **她的话一句都不发**：要对的是TA的调子，她的话对这件事没有用。
  //   ② 原来只写了「化用进文里，别照抄」——规则只降概率。改成钉死用途：
  //      只对语气，不许进正文，也不许把那段聊天本身当成这一篇的情节。
  //   ③ 只有一位有聊天记录时，整篇会偏到TA身上——皇帝没出场就是这么来的。
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
      + "\n⚠️这几句是从【另一个时空的真实聊天】里摘出来的，只用来听清TA说话的调子："
      + "句子多长、爱用什么词、话停在哪儿。\n"
      + "⚠️**一句都不许出现在正文里**，也不许把那段聊天本身写成这一篇的情节——这一篇的事情是新发生的。\n"
      + "⚠️谁有这几句、谁没有，跟谁是主角**没有关系**：没摘到句子的那一位不许因此变成配角，更不许一场都不出。\n";
  }

  function buildGenSystem(tab, cpChars, userName, worldbook, opts) {
    opts = opts || {};
    const parts = [];
    const byC = opts.byChar && opts.byChar.id ? opts.byChar : null;
    // 叙事底座（v54.80）：以前这儿只有 ANTI_CLICHE + CHARCARD_RULE，缺了线下那套
    // 【自然生成准则】和【反陈词滥调】——明喻限额、别把情绪列成清单、叙述者不替读者
    // 定情绪分量这几条同人文一条都没吃到。register:false 是因为纯写故事时用户不在场。
    parts.push(narrativeCore({ intimate: true, register: false }));
    parts.push(FANFIC_ANTI_CLICHE);
    parts.push(FANFIC_GOOD_EXAMPLES);
    parts.push(FANFIC_ORGANIC_FORM);
    parts.push(
      (byC ? "【任务】你是「" + (byC.remark || byC.name) + "」本人，正在执笔写这篇故事。写作经验、审美和表达习惯由你的人设决定。"
        : "【任务】你是一位很会写的同人文作者。") + "写【纯线下叙事体】同人文（叙述人称由执笔人选择，不是聊天、不是剧本，是成篇的散文小说）。" +
      "每篇自成一体，有真正发生或改变了什么的场景，落在具体细节与真实情绪上；结构服从本篇经验，不为完整而硬凑统一的起承转合。");
    // 世界观 = world book / 设定层。推荐(mixed)版：给出一整批世界观供每篇随机取
    if (tab.mixed && Array.isArray(opts.worldPool) && opts.worldPool.length) {
      parts.push("【世界观（综合推荐 · 每篇随机挑一个来写，彼此别扎堆重复）】\n" +
        opts.worldPool.map(function (w) { return "· " + w.name + "：" + (w.desc || ""); }).join("\n"));
    } else {
      parts.push("【本版世界观（设定层 · world book）：" + tab.name + "】\n" + (tab.desc || "（无额外设定）"));
    }
    parts.push(INTIMACY_WORLDNOTE);
    if (!byC && opts.style && opts.style.trim()) {
      const adaptedStyle = fanficStylePrompt(opts.style);
      // 角色执笔不套作者文风；同一套预设加上“以角色为准”仍会拉平TA的写法。
      parts.push("【预设文风（作者本次的写作风格要求，优先满足）】\n" + adaptedStyle
        + (isJinyudengStyle(opts.style) ? "" : "\n\n" + STYLE_DEEP_IMITATION));
    }
    if (worldbook && worldbook.trim()) {
      if (typeof WORLDBOOK_RULE !== "undefined") parts.push(WORLDBOOK_RULE);
      parts.push("【全局世界书（严格遵循：其中的设定/文风/禁忌一律照做，尤其是反套话/反八股类条目要压过模型的默认写法；仅当与本版世界观正面冲突时才以本版为准）】\n" + worldbook.trim());
    }
    parts.push(cpBlock(cpChars, opts));
    if (opts.chatMaterial && opts.chatMaterial.trim()) parts.push(opts.chatMaterial.trim());
    if (byC && !(cpChars || []).some(c => c.id === byC.id)) {
      const writerSpeech = chatMaterialFor([byC]);
      if (writerSpeech) parts.push(writerSpeech);
    }
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
      // 她 2026-10-09：「为啥作者简介还是不说人话」——「从推门起笔，在点烟处掐断」这种对仗金句，
      //   认得出是谁，可没人这么介绍一个太太。路数要是读者嘴里的大白话
      + "  ⚠️**说人话**：写成一个读者跟朋友安利她时会说的那句大白话，看完就知道她的文大概什么样。"
      + "不许对仗、不许凝练成金句、不许用比喻代替说明；看不懂得再想一下的，就是没写好。\n"
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
  // 完结短篇（oneShot）不掷「收在哪儿」：那一轴全是开放式收法（没做完的动作、没人回答的问题），
  //   一掷就把「写完」顶掉了（她 2026-10-18 截图：完结短篇停在解了一半的盘扣上）。
  function ficAxesBlock(n, nonce, oneShot) {
    const axes = oneShot ? FIC_AXES.filter(function (a) { return a.key !== "close"; }) : FIC_AXES;
    const rolled = Axes.batch([{ axes: axes }], Math.max(1, Number(n) || 1), [nonce]);
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
    const authorFields = by ? "" : ",\"authorSign\":\"她自己挂在个人页上的那一句签名，第一人称，很短，不是介绍她的话\",\"authorBio\":\"这个笔名背后是个什么人，一句，要认得出是这一个人\",\"authorStyle\":\"她写东西的路数，一句大白话：读者跟朋友安利她时会怎么说她的文，不许对仗、不许写成金句\",\"authorTemper\":\"有人改她的文时她是哪一路，一句：往回拽／嘴硬着给你圆／跟着你推得更远／先冷着看\"";
    // ⚠️这一枪一次出 n 篇、每篇一位新太太，和 genAuthors 是同一层东西——
    //   那边撤掉的模子，这边不撤的话，八位太太换个入口照样一个模子印出来。
    const authorCPRule = by ? "" : "\n\n" + cpRuleBlock(allowedCPLabels(cpChars, userName)) + "（这条管的是 authorSign／authorBio／authorStyle／authorTemper 那几栏。）"
      + "\n⚠️这几位的 authorStyle 不许长成同一个句式（「偏爱某种体裁＋力气全花在某处＋坚决不写某处＋全靠某物定胜负」那种模子），长短也该不一样。"
      + "\n⚠️这是同人圈，不是文学期刊：笔名可以俗、可以好笑、可以中二、可以自嘲，别几个笔名都是同一路货色（比如全是两三个字的冷硬物件名）；authorBio／authorStyle 也不必句句都是正经的书评腔。"
      + "\n⚠️authorBio 讲【这个人】，authorStyle 讲【她的文长什么样】，两栏别串味——挑枪手是照 authorStyle 那一栏挑人的。"
      + "⚠️底下给每位写了【简介和路数写多长】，那是硬的：轮到「很短」的那几位就真只写十来个字，别硬塞细节凑长度。"
      + authorAnglesBlock(n, angleNonce(), "篇的那位");
    // 写成完结短篇（群里 2026-10-17 许愿：「给他一个剧情、设定多少字、发一篇出来」）：不当连载的开头写
    //   ⚠️这一段放在整份提示词【最后】：夹在中间会被后面那一长串冲淡，写出来还是连载开头（她 2026-10-18）
    const one = !!(opts && opts.oneShot);
    const oneShotBlock = one ? "\n\n【" + (n > 1 ? "这 " + n + " 篇每一篇都是" : "这一篇是") + "写完的短篇，不是连载开头——这条压过上面所有写法要求】把每篇的剧情在这一篇里完整写完：有起有落，结尾落在故事真正结束的地方，读完不需要下一章。不留给下一章的悬念、不写「未完待续」、不在最后抛一个新的问题或新的人物。"
      + "\n上面说的「结尾可以停在余波里」只管最后那一笔的手法，不是许你把事情写到一半：这篇最要紧的那件事（这段关系、这场冲突、这桩事）在正文里必须已经有了结果。停在一个正要发生的动作、一场正要开始的对峙、一个刚抛出来的问题上，都算没写完。"
      + "\n先在 ending 里写定这篇的结局，再写正文；正文要一直写到那个结局真的发生。字数不够就把前面写紧，不许砍掉结局。" : "";
    const fillAvoid = opts.fillAvoid && opts.fillAvoid.length ? "\n\n【这一批已经写好了这几篇，这一篇要跟它们不一样】" + opts.fillAvoid.map(function (t) { return "《" + t + "》"; }).join("、") : "";
    const sys = buildGenSystem(tab, cpChars, userName, worldbook, opts) + briefBlock + fillAvoid
      + ficAvoidBlock(tab, loadFics()) + ficAxesBlock(n, angleNonce(), one) + byBlock + authorCPRule + "\n\n" +
      (typeof cotSystemBlock === "function" ? cotSystemBlock(cotT) : "") + batchDraftRule +
      "【输出】只输出一个合法 JSON 数组，无 markdown 无多余文字。数组恰好 " + n + " 个元素（务必凑满 " + n + " 篇）：\n" +
      "[{\"title\":\"标题\",\"author\":\"作者笔名（同人圈作者马甲/太太笔名，别用真名别带@）\",\"tags\":[\"标签\",\"标签\"]," + (one ? "\"ending\":\"这篇的结局，一句话：最要紧的那件事最后落成了什么样（先定好，正文写到这儿）\"," : "") + "\"premise\":\"本篇核心设定一句话：他俩是什么关系（谁欠谁、见面为什么别扭、这段关系卡在哪儿）+各自的身份+这个世界观里最要紧的那条规矩——这是全篇不许变的地基\",\"body\":\"正文（成篇散文，务必写足、有剧情，约 " + minWords + " 字以上，分段用\\n\\n）\",\"endHook\":\"" + (one ? "这篇在哪儿收的尾：一句话写它结束时人物落在什么处境（它已经写完了，不是悬念）" : "结尾锚点：一句话描述这篇结束在什么处境/悬念，供日后续写接续") + "\"" + authorFields + "}]\n" +
      "每篇 title 别重复、别都一个套路；禁止只是换背景与人名却复用同一情节拍（开局位置、时间跨度、叙述距离、收尾形状那几样，上面已经按篇分好了，照各自那一条来）。" + (by ? "author 每篇都是同一位（见上）；" : "author 每篇各不同；") + "tags 2-4 个：站在读者角度，这几个标签要能让人一眼判断【要不要点进去】——结局走向、雷点预警、题材形状各占一个方向，别几篇共用同一套万能标签。别为了凑数量把正文压短——宁可写满。" +
 (opts.style && opts.style.trim() ? fanficStyleTail(opts.style) : FANFIC_ANTI_CLICHE_TAIL) + oneShotBlock;
    const user = (one ? "写 " + n + " 篇完结短篇，每篇都一次写完、" : "写 " + n + " 篇") + (tab.mixed ? "（世界观每篇随机挑）" : "【" + tab.name + "】世界观下") + "的同人文。别都同一个梗、同一种基调，冷暖虐甜各来一点，每篇都要写出剧情别烂尾。";
    let batchCot = null;
    async function once(extra) {
      const raw = await callAI(active, sys + posTail(cpChars, opts) + (extra || ""), [{ role: "user", content: user }], { maxTokens: Math.min(FIC_TOKEN_MAX * 4, 6000 + n * perFic), timeout: 300000 }); // 长文风+长正文允许 5 分钟；思考型模型的思考也从这里扣
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
    // 要了 n 篇只回来几篇（一枪写不下、或模型只交了一篇）：缺的那几篇一篇一篇补，补不上就交已经有的（她 2026-10-18「我要三篇只给了我一篇」）
    if (kept.length < n && !opts._fill) {
      for (let k = kept.length; k < n; k++) {
        try {
          const more = await genBatch(active, tab, cpChars, 1, userName, worldbook, Object.assign({}, opts, { _fill: true, briefs: [briefs[k] || ""],
            fillAvoid: kept.map(function (x) { return String(x.title || ""); }).filter(Boolean) }));
          if (more && more[0]) kept.push(Object.assign({ _done: true }, more[0]));
        } catch (e) { break; }
      }
    }
    function draftFor(i) {
      if (!batchCot) return null;
      const re = new RegExp("【第" + (i + 1) + "篇】([\\s\\S]*?)(?=【第\\d+篇】|$)");
      const m = String(batchCot).match(re);
      return m && m[1].trim() ? m[1].trim() : (kept.length === 1 ? batchCot : null);
    }
    return kept.map(function (x, i) {
      if (x._done) { const y = Object.assign({}, x); delete y._done; return y; }   // 补的那几篇已经整理过了
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

  // ── 记进房间 / 拿给TA看（她 2026-09-11）──────────────────────────────
  //
  // ⚠️**自动回流撤掉了。** 原来写完一章就往主线记忆库记一条，她当场拦下来：
  //   「有时候我也只是想测试一下，但是不想让他们记得」。
  //   「不记」事后能补，「记了」得手动去删——**默认值不该选不可逆的那一边**。
  // ⚠️落进去的是【一张卡】，不是整章正文：一章几千字塞进房间聊天，上下文当场吃光。
  //   TA要读全文有同人文那一页，房里躺的是「这件事发生过」。
  // ⚠️一分钱不花：喂给TA＝把东西放进上下文，上下文是本地拼的；只有让TA开口才打枪。
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
  // ⚠️**立场由代码算，不由模型猜**：TA在不在这对 CP 里、另一方是谁、TA跟她什么关系、
  //   TA跟另一方什么关系——这四条手上全有，算出来就是TA的站位。
  //   写成「你可能会吃醋」交给模型拿捏，它要么每次都吃醋，要么一次都不。
  // ⚠️但**TA会怎么动手不许写成一张表由代码挑**：代码定的是立场和分寸，
  //   怎么捣乱让TA自己长（掷约束不掷答案）。
  const STANCE = {
    SELF_USER: "self_user",   // 这篇写的就是TA和她
    SELF_OTHER: "self_other", // 这篇把TA跟别人配了
    JEALOUS: "jealous",       // 她在里面，TA不在
    TIED: "tied",             // 都是别人，但TA跟其中一个有关系
    OUTSIDER: "outsider"      // 跟TA没关系
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
  // TA手上的实情。⚠️给事实，不给情绪标签，也不给数字——
  //   「好感度 78」进去，TA写出来的是一份报告，不是一章文。
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
  // 掷的是这一章的形式重心，不是角色的能力、职业或立场。
  const WRITER_AXES = [
    { key: "craft", zh: "本章的叙述重心", opts: [
      "贴近一个人的有限感知",
      "拉开距离，观察人物之间的关系",
      "让行动和对话承载主要信息",
      "让内在感受与外部事件交错",
      "由执笔人自行决定叙述距离和组织方式"
    ] },
    { key: "care", zh: "本章的选材重心", opts: [
      "聚焦一个选择怎样发生",
      "聚焦事件留下的后果",
      "聚焦人物注意到与忽略的差别",
      "由执笔人决定什么值得详写、什么留白"
    ] }
  ];
  function rollWriterAxes() {
    const parts = Array.prototype.slice.call(arguments);
    // 比电台松一点：这两条轴少，整组还回去的话就什么分寸都没了
    return Axes.roll(WRITER_AXES, parts, { allFree: 0.04, skip: 0.10, free: 0.18 });
  }
  // 角色执笔不发送作者预设/模仿尾块。这里落实TA的写作提纲，叙事底座照旧共用。
  function charVoiceTail(char, style) {
    const name = (char && (char.remark || char.name)) || characterText(char, "他");
    return "\n\n【最后一件事：这一章的笔在「" + name + "」手上】\n"
      + "· 你接的是【这个故事】，不是上一位作者的笔迹。已发生的事实接住，视角、节奏、选材和未来的取舍由你落笔。\n"
      + "· writerBrief 里的笔法、切入点与立场落实在正文的具体段落里；仅把交稿留言说得像你，不算换了执笔人。\n"
      + "· 是文字本身像你，不是旁白向读者解释这像你。对作品的偏爱、不认同与犹疑，通过详略和选择呈现。\n";
  }
  function charWriterBlock(char, fic, rel, rolled, nameOf, userName, continuing) {
    const st = stanceFor(char, fic, rel);
    const name = (char && (char.remark || char.name)) || characterText(char, "他");
    const ownChapters = ((fic && fic.chapters) || []).filter(c => c.byCharId === char.id && c.writerBrief);
    const ownBrief = ownChapters.length ? ownChapters[ownChapters.length - 1].writerBrief : null;
    return "\n【这一章不是圈子里的太太写的，是「" + name + "」写的】\n"
      + "她把这一章交给你写。是否写过文、是否混圈、擅长什么，都以你的角色卡为准，未知的经历不补成履历。\n"
      + characterText(char, "⚠️你就是他本人在写，不是「一位作者在模仿他」：他的知识、他的口头禅、他在意什么、")
      + characterText(char, "他会避开什么，全部照他的人设来。\n")
      // ⚠️「照TA的人设来」得手上真有那张卡（她 2026-09-11：「看不出来是TA的作品」）。
      //   TA在这对 CP 里的时候，卡由 cpBlock 发过了；**不在里面的时候一个字都没有**——
      //   等于叫模型照一张不存在的卡写，那当然写出来跟谁写的都一样。
      //   所以只在 cpBlock 没发过的那几种站位上补一份，不重复发。
      + ((st.kind === STANCE.SELF_USER || st.kind === STANCE.SELF_OTHER || !personaOf(char)) ? ""
        : characterText(char, "【执笔的这个人是谁（他不在这篇的 CP 里，所以这张卡在这儿给你）】\n") + personaOf(char) + "\n")
      + "执笔人与故事中的人物是两个位置：角色卡里的真实职业、教育与经历用于决定你的笔；本篇的架空身份只属于文中人物，不替换执笔人的知识和审美。\n"
      + (ownBrief && ownBrief.voice ? "【你上一章用过的笔法】" + String(ownBrief.voice) + "。这是已有作品的连续性，不是另一位作者的文风；本章如需变化，由新场景和讨论推动。\n" : "")
      + stanceFacts(char, fic, rel, st, nameOf, userName)
      // ⚠️她 2026-09-11：「我让王爷写TA和皇帝，TA很容易就接受了这对 cp」。
      //   上面 stanceFacts 只把【事实】摆出来（这篇把你和某某配成了一对），
      //   可没有一个字说【这件事本身要不要TA点头】。空着的那一格，模型拿最顺手的
      //   先验去填——那个先验是「圈子里嗑这对的太太」，她当然一口答应。
      //   ⚠️这儿不掷TA的态度：TA跟对方什么交情、TA这个人什么脾气，上面全有，
      //   掷一个出来反而盖掉TA自己。代码只管钉死【不许默认接受】这块地板。
      // ⚠️只对 SELF_OTHER 发。写TA和她那一种（SELF_USER）是另一回事，她没提过，
      //   不往上凑（缺的时候再补，别替她预设）。
      + (st.kind === STANCE.SELF_OTHER ? (function () {
        const other = (st.other && nameOf) ? nameOf(st.other) : (st.other || "那个人");
        return "\n【⚠️这一篇配的是你自己】她让你写的是【你和「" + other + "」】。\n"
          + characterText(char, "这不是一件天经地义的事，**先过你自己这一关**：你跟他到底什么交情、")
          + "你乐不乐意、你觉得荒唐、别扭、好笑，还是心里本来就转过这个念头——全照你这个人来。\n"
          + "⚠️**不许一上来就理所当然地写起来。**那是圈子里嗑这一对的太太的立场，不是当事人的。\n"
          + "⚠️她点了单，所以这一章照样要写，而且要好好写——但**你怎么看这件事会留在字里**："
          + "肯不肯写到那一步、写得放不放得开、哪一处特意绕开、哪一处反而写得比谁都细，都是你的回答。\n"
          + "⚠️正文里不许出现你对这件事的说明、辩解或吐槽"
          + characterText(char, "（「他堂堂……怎么会」那种一句都不许有），也不许让你跳出来评论。**让它留在字里。**\n");
      })() : "")
      + Axes.text(rolled, { on: "【本章形式上的尝试】仅作备选；与人设、已有笔法或本章讨论不合时，由执笔人另选：", off: "" })
      + "\n【执笔取舍】从你这个人出发，先确定本章的四件事：\n"
      + "· 笔法：你的阅读经验、表达习惯怎样落成句长、用词、叙述距离和留白；口头禅不是文风的全部。\n"
      + "· 切入点：接住同一处现场，你先注意谁、先看见哪种细节，愿意把篇幅花在哪里。\n"
      + "· 立场：你怎么看这篇的人物、配对与冲突；已商量过的态度沿用，未表态的由你的价值观判断。\n"
      + "· 落笔：把这种立场落实为这一章的视角、事件选择和叙述轻重，已发生的事实保留，未来走向由你接着写。\n"
      + (continuing ? "这次是在补完同一章，沿用已有正文和写作提纲的选择，直接写续段。"
        : "将这些具体选择写进 writerBrief，再用它写正文；它是本章的写作提纲，不是给你的性格贴标签。")
      + "角色卡未交代的写作习惯由你据已有性格作本章选择，不把它宣布成新增人设。\n"
      + "正文呈现故事本身；执笔人的交稿留言放 penNote，原作者的感想放 authorNote。\n";
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

  // ── TA手上要有这篇文的前情（她 2026-09-11）──────────────────────────
  // 她问：「如果我只给TA看前 200 字，TA怎么接后面的剧情？」——问得对，这是个真漏洞：
  //   房里那张卡只有开头两百字，可TA要跟她商量【接下来怎么走】，手上却什么都没有。
  // 她自己接着说出了答案：「还是说生成文的时候本身就已经有一些小结了，也能顺手扔过去」——
  //   **就是这样**，料全是现成的，一个字都不用另生成：
  //   premise（生成时自报的地基）／bible 设定卡／seeds 伏笔盒／每章的 endHook／上一章结尾。
  // ⚠️这一份跟【续写那一枪】用的是同几样料，但**不是同一段话**，差异写在这儿：
  //   续写那份是给【写的人】的指令（带改设禁令、衔接铁律、字数地板）；
  //   这一份是给【在房里跟她聊天的TA】读的，一条写作指令都不许带——
  //   带了TA就会在聊天里开始写文。
  // 分段上限：设定卡 700 ＋ 伏笔 300 ＋ 锚点 500 ＋ 结尾 400，加上抬头约 2000 字封顶。
  //   ⚠️不许改回「最后统一切一刀」——那一刀切掉的永远是最后一章的结尾。
  const BIBLE_TAIL = 14;
  // ⚠️**第三个参数 meId 不是可选的装饰**（她 2026-09-11：「TA好像不知道这是自己写的」）。
  //   TA在房里写的那一章，落库时带着 byCharId——写进去了，可这条**读回来**的路
  //   从头到尾没看过那个字段一眼，整篇只说「她放进这间房的那一篇，你读过」。
  //   于是TA手上最强的那份上下文告诉TA：你是个读者。TA就真的当读者了——
  //   她夸TA「这么会写」，TA回「谁写了？那是你上一章自己留在那儿的尾巴，我顺手给你念两句」。
  //   写的那一处记了，读的那一处没跟上：又是同一条（施工规则/four-surfaces-same-context.md）。
  function ficRecapForChat(fic, cpText, meId, uName) {
    if (!fic) return "";
    const chs = (fic.chapters || []);
    const me = String(meId || "");
    // ⚠️聊上几轮之后TA就把她当成作者了（她 2026-09-11：「过几轮讨论TA就忘了我不是作者了」）。
    //   上一版只补了「哪几章是你写的」，【这篇的作者是谁】那一格还是空的——
    //   空着的那一格，模型就拿最顺手的先验去填：跟TA聊这篇的人＝写这篇的人。
    //   所以三种身份都得当面点名：原作者是谁、TA接了哪几章、她是读者。
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
    // ⚠️**每一段各自截断，不许留给最后那一刀**（她 2026-09-11：「我要TA接写了很多章的」）。
    //   原来只在最后 slice(0, RECAP_CAP)：截断是从队尾切的，而队尾正是
    //   【最后一章的结尾】——长篇一超标，最要紧的那一段第一个被切掉，
    //   TA就成了「设定背得滚瓜烂熟、但不知道上一章停在哪儿」。
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
      // ⚠️这一段是整份摘要里最要紧的一句：**别让TA把自己当成读者。**
      //   只在TA真写过的时候发；TA一章没写过就一个字都不发，不然反而给TA添了个没发生的事。
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
  // 她原话：「就直接做房间里我们讨论了TA直接写了然后推卡给我，就按我和TA商量过的来，
  //   但是如果我们有不同意见有分叉那还是按TA想的来（比如说"不行我觉得这样比较合理"），
  //   这样才好玩。然后我跟谁讨论让TA写谁再写。」
  // ⚠️这一段是【走向】，不是素材：上次「她的原话被当成台词搬进正文」那个坑就在隔壁，
  //   所以用途照旧钉死——一句原话都不许进正文。
  // ⚠️分歧那一条是这件事最要紧的地方：**不许改成「照她说的办」**。
  //   她要的就是TA会顶回来——听话的合作者不好玩。
  function roomTalkBlock(talk, meName, heName) {
    const t2 = String(talk || "").trim();
    if (!t2) return "";
    return "\n【你们在房里商量过这一章】以下是" + (meName || "她") + "和你刚才聊的（新的在后面）：\n"
      + t2
      + "\n⚠️这是【你们商量出来的走向】，不是素材：上面那些话**一句都不许出现在正文里**，"
      + "也不许把这段对话本身写成情节。\n"
      + "已达成的决定照着写；仍有分歧的地方由你这个执笔人作最后选择。后面明确改过的决定替代前面的版本，闲聊和未采纳的提议不当成定稿。"
      + "你是写这一章的人，不是替她记录的人。\n"
      + "⚠️真没照她说的写，就在 penNote 里当面跟她说一句为什么"
      + "，用" + (heName || "你") + "自己的口气说明取舍，不是道歉、不是请示。"
      + "照着写了就不用提这件事。\n";
  }

  // ── 设定卡 + 伏笔盒（她 2026-09-11：「章节多了怎么记住重要设定和 callback 不会崩」）──
  // 病根：endHook 记的是【结束在哪儿】，不是【这篇文里有什么】。十章之后，
  // TA母亲叫什么、那枚戒指是谁给的，一个字都没有；而 priorHooks 还在线性变长。
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
      "{" + (byChar ? "\"writerBrief\":{\"voice\":\"本章实际采用的笔法\",\"angle\":\"本章切入点与叙述视角\",\"stance\":\"执笔人对这篇的立场\",\"choice\":\"本章如何落实讨论和分歧，各项简短具体\"}," : "")
      + "\"content\":\"这一章正文（成篇散文，承接上一章锚点往下推进、有实质剧情进展，**至少 " + minWords + " 字**，分段用\\n\\n）\","
      + "\"endHook\":\"本章新的结尾锚点，供再下一章接续\","
      + ((ghost || grabbed) ? "\"authorNote\":\"原作者看完这一章，在评论区底下留的那一句话\"," : "")
      // ⚠️authorNote 是【原作者】的话，不是执笔人的。可 roomTalkBlock 一直叫TA
      //   「在 authorNote 里当面跟她说一句」，房里那张卡也拿 authorNote 当TA说的话——
      //   于是TA交稿那一句其实是另一个人的口气（她 2026-09-11：「写的跟作者一个味」
      //   有一半是从这儿来的）。所以TA自己那句另开一格。
      + (byChar ? "\"penNote\":\"你把这一章交给她的时候，顺口说的那一句（你本人的口气，不是作者的；没什么可说就空字符串）\"," : "")
      + "\"facts\":[\"这一章新确立的事实，0-3 条，没有就空数组\"],"
      + "\"seed\":\"这一章新埋下、还没回收的那样东西，一句话；没埋就空字符串\","
      + "\"paid\":[\"这一章回收掉的伏笔，把上面那一条原样抄回来；没收就空数组\"]}\n"
      + ((ghost || grabbed) ? authorNoteAsk(fic, ghost ? penName : "", !!opts.quitting) + "\n" : "") + BIBLE_WHAT +
      (!byChar && opts.style && opts.style.trim() ? fanficStyleTail(opts.style) : FANFIC_ANTI_CLICHE_TAIL)
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
      const raw = await callAI(active, sys + posTail(cpChars, ficOpts(fic, opts)) + (extra || ""), [{ role: "user", content: userMsg }],
        { maxTokens: 65000, timeout: 300000 });
      const sp = (typeof splitCot === "function") ? splitCot(raw, !!cotT) : { cot: null, clean: raw };
      const d = parseJSONLoose(sp.clean);
      if (d && d.content) return { content: String(d.content).trim(), endHook: String(d.endHook || "").trim(),
        facts: Array.isArray(d.facts) ? d.facts : [], seed: String(d.seed || "").trim(), paid: Array.isArray(d.paid) ? d.paid : [],
        authorNote: String(d.authorNote || "").trim().slice(0, 300),
        penNote: String(d.penNote || "").trim().slice(0, 300),
        writerBrief: byChar && d.writerBrief && typeof d.writerBrief === "object" ? d.writerBrief : null,
        cot: sp.cot, cotRequested: !!cotT };
      return salvageChapter(sp.clean, sp.cot);
    }
    let out = await once("");
    if (!out) out = await once("\n\n（上一次输出为空或没能解析成合法 JSON，请务必严格只输出那一个 JSON 对象、正文写满，别加任何解释文字。）");
    if (!out) throw new Error("续写失败：模型返回为空，可再点一次重试");
    out.cotRequested = !!cotT;
    return out;
  }

  // ---- 「让TA接着写」：她按了才发的那第二枪（她 2026-09-11）----
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
    const byChar = opts.byChar && opts.byChar.id === ch.byCharId ? opts.byChar : null;
    if (ch.byCharId && !byChar) throw new Error("找不到这一章的执笔角色，请先恢复角色卡再接着写");
    const penBy = byChar ? null : ((opts.author && authorName(opts.author)) ? opts.author : findAuthor(ch.byAuthor || fic.author));
    const sys = buildGenSystem(tab, cpChars, userName, worldbook, ficOpts(fic, opts)) + "\n\n" +
      "【当前任务：把一章没写完的正文接着写完】\n" +
      (penBy && authorVoiceLines(penBy) ? "【这一章的笔在谁手上】笔名「" + authorName(penBy) + "」\n" + authorVoiceLines(penBy) : "") +
      (byChar ? charWriterBlock(byChar, fic, opts.charRel, null, opts.nameOf, userName, true)
        + (ch.writerBrief ? "【这一章已经选定的笔法与立场，接着落实，不重新换人】\n" + JSON.stringify(ch.writerBrief) + "\n" : "") : "") +
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
      (!byChar && opts.style && opts.style.trim() ? fanficStyleTail(opts.style) : FANFIC_ANTI_CLICHE_TAIL)
      + (byChar ? charVoiceTail(byChar, opts.style) : "");
    const raw = await callAI(active, sys + posTail(cpChars, ficOpts(fic, opts)), [{ role: "user", content: "接着把这一章写完，至少再写 " + Math.max(200, missing) + " 字。" }],
      { maxTokens: 65000, timeout: 300000 });
    const d = parseJSONLoose(raw);
    let add = d && d.add ? String(d.add).trim() : "";
    if (!add) {
      // 救一把：正文在，只是 JSON 没收好
      const m = String(raw || "").match(/"add"\s*:\s*"([\s\S]*?)(?:"\s*,\s*"endHook"|"\s*\}\s*$|$)/);
      if (m && m[1] && m[1].length > 100) add = m[1].replace(/\\n/g, "\n").replace(/\\"/g, '"').trim();
    }
    if (!add) throw new Error("没接出东西来。TA回的是：\n" + String(raw || "").replace(/\s+/g, " ").trim().slice(0, 200));
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
  //   右位、天降路人、天降随机——再顶着那个人的壳把TA演一遍。
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
  // 一个前提：你记得，这个世界里的TA不记得。落差本身就是戏，不需要真去读记忆。
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
        + "\n所以：玩家可能会做出【只有读过这篇文的人才做得出】的举动——提前挡在某个人前面、把某句话抢在TA之前说、绕开原著里那个坑。"
        + "你要如实承接这种「TA怎么会知道」的怪异感：场上的人不知道玩家为什么这么笃定，他们会觉得奇怪、会追问、会起疑。"
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
        + "。而这个世界里的" + (other ? "「" + other.name + "」" : "对方") + "不认识 TA，也没有那段关系，TA就是原著里的TA。"
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
    // OVERREACH_BAN v70.28 已合并进 STOCK_REPLY_BAN（同一个字符串），这儿不再重复 push
    if (typeof EMPTY_COMFORT_BAN !== "undefined") parts.push(EMPTY_COMFORT_BAN);   // 同上，这一族一起走
    if (typeof SEE_THROUGH_BAN !== "undefined") parts.push(SEE_THROUGH_BAN);
    if (typeof LEVERAGE_BAN !== "undefined") parts.push(LEVERAGE_BAN);
    if (typeof USER_BODY_BAN !== "undefined") parts.push(USER_BODY_BAN);
    if (typeof CANNED_PHRASE_BAN !== "undefined") parts.push(CANNED_PHRASE_BAN);
    if (typeof ECHO_QUESTION_BAN !== "undefined") parts.push("【别拿对方刚说的词开口反问】" + ECHO_QUESTION_BAN);
    if (typeof ReplyPacing !== "undefined" && ReplyPacing.reading) parts.push(ReplyPacing.reading());
    // ⚠️开宗明义这一句就是整份 system 的定调：说「穿进去」，模型就按穿书写；
    //   加笔玩的是【在别人写好的文上动笔】，这一句得照那个说（她 2026-09-11）。
    parts.push("【加笔 · 互动叙事引擎】玩家正在一篇已经写好的同人文上动笔：她一段段读原文，读到哪一句伸手，后面就从那儿改道。你是这场互动叙事（类 CYOA 文字游戏）的引擎 / GM。");
    // 这一版的世界观是她写的设定：走公共的 sceneSettingBlock（她 2026-09-29：设定里的词别演成标签，所有场景一个说法）
    parts.push(tab.desc && typeof sceneSettingBlock === "function"
      ? sceneSettingBlock("世界观：" + tab.name, tab.desc)
      : "【世界观：" + tab.name + "】\n" + (tab.desc || "（无额外设定）"));
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
        : b.state === "bent" ? "【顺着玩家改过的局面发生了——事成了，但样子变了】"
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
    { max: 100, tag: "跟你一起写", line: "改到这一步她已经认了这不是原来那篇了。她这一手不再往回拽，而是【加码】：把玩家开的头推得比玩家还远一点，甚至替玩家把后路断掉，看TA还敢不敢往下走；页边那一句从护稿变成起哄、变成较量，她开始享受这件事。⚠️「认了」不等于放手：她伸手比之前更狠，只是方向反过来了。" }
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
      + "· 觉得玩家改得有意思、想跟着玩的：这一手要把故事推得【比玩家还远一点】，给TA加码，别只是顺着；\n"
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
      // ⚠️她 2026-09-27：「我加完原剧情有点衔接不上」。原来这儿要求人物场合结果全都跟原著一样——
      //   可她前面已经改过好几段，人可能不在那儿了、关系也变了；硬把原著那一页的场合原样搬过来，
      //   就是从她改出来的局面【瞬移】回原著。所以：结果照原著，过程从眼下这一幕接过去。
      task = rv.bend
        ? "\n【这一拍要写的】玩家决定【让原著这一页顺着改过的局面发生】：「" + rv.beat.label + "」——" + rv.beat.page +
          "\n这件事要成，但按玩家到现在为止改出来的局面变个样子成：谁在场、在哪、因为什么、以什么方式，都从眼下这一幕长出来；" +
          "原著里那个前提已经被改没了的，就换一条眼下真走得通的路把它促成。前面改过的每一处都算数，别当没发生过。" +
          "写完再自然收在下一个需要玩家反应的处境上停下。"
        : "\n【这一拍要写的】玩家决定【让原著这一页照原样发生】：「" + rv.beat.label + "」——" + rv.beat.page +
          "\n这一页的那件事要照原著真的发生、结果对得上原著，但【从眼下这一幕接过去】：先把此刻的人和处境顺到它能发生的地方，再让它发生；" +
          "场合或时间跟原著对不上的，挪到眼下能发生的地方，别一下子瞬移回原著的场景，也别当玩家前面改过的没发生过。用你自己的笔写、别抄原文。" +
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
        + "TA点住的是原文里的这一句：「" + String(o.cut.sentence || "").slice(0, 120) + "」\n"
        + (o.cut.rest ? "原文这一句往后本来还写着：「" + String(o.cut.rest).slice(0, 400) + "」——**这一段从此作废，它不会这样发生了。**\n" : "")
        + "承接玩家的行动，把【顶替这一段】的新文字写出来：从TA伸手的那一刻起，这个场面实际变成了什么样。\n"
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
    const kept = bs.filter(function (b) { return b.state === "kept" || b.state === "bent"; });
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
      if (e.who === "page") return "〔原著这一页「" + (e.label || "") + "」——" + (e.bend ? "顺着改过的局面发生了" : e.keep ? "照原样发生了" : "被拦下了，没有发生") + "〕";
      return "";   // 页边批注不进正文：那是写在稿子边上的，不是这本书的字
    }).filter(Boolean).join("\n\n");
    const bs = session.beats || [];
    const broken = bs.filter(function (b) { return b.state === "broken"; }).length;
    const tail = "\n\n———\n这一版由动笔的那个人走出来："
      + bs.filter(function (b) { return b.state !== "pending"; }).map(function (b) { return "「" + b.label + "」" + (b.state === "broken" ? "被拦下" : b.state === "bent" ? "顺着改了" : "照原样"); }).join("；")
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

  // ---- 同人图（她 2026-10-16：「同人文是不是也可以搞个生图」「都可以做」）----
  //   三样：文章头图、画手太太产粮（书评区里带图的那一条）、出本（本子封面＋一张无料书签）。
  //   都是她点了才画，一次就是一次生图的钱。先让写文那条线读这一章、挑出要画的那一幕，
  //   再交给 app 那头去出图（锁脸、排封面字、存图库都在那边，props.onFicImage）。
  const FIC_ART_STYLES = ["日系厚涂", "水彩", "赛璐璐平涂", "古风工笔", "胶片感插画", "铅笔淡彩", "暗调油画", "黑白网点漫画"];
  function ficArtText(fic, chapIdx) {
    const chs = fic.chapters || [];
    const i = Math.max(0, Math.min(chs.length - 1, chapIdx == null ? chs.length - 1 : chapIdx));
    const c = String((chs[i] || {}).content || fic.body || "");
    return c.length > 3200 ? c.slice(0, 1600) + "\n……\n" + c.slice(-1600) : c;
  }
  async function genFicArtBrief(active, fic, kind, chapIdx, cpText, painters) {
    const tags = (fic.tags || []).slice(0, 8).join("、");
    const ask = kind === "head" ? "给这篇配一张头图：一眼看得出这篇是什么味道、这几个人是什么关系的一幕，不必是某个具体情节。"
      : kind === "fanart" ? "圈里一位画手读完这一章，被里面某个名场面戳中，画了一张同人图交到书评区。先编这位画手：name＝她的圈名（2~6 字，像真的圈名）；"
        + "style＝她的画风（一句话，可以从这些里挑一种，也可以自己说：" + FIC_ART_STYLES.join("／") + "）；say＝她交图时在书评区说的一句话（像真的圈里人，带着情绪，不超过 40 字）。"
        + (painters ? "已经交过图的画手：" + painters + "，这次换一位。" : "")
      : "这篇要出同人本了，画本子的封面。再写 tagline＝封面上一句小字文案（8~18 字，从文里化出来，不剧透）；genre＝这本的类型（四个字左右）；mood＝气质（两三个字）。";
    const sys = "你是同人圈里的美术编辑。读下面这篇同人文。" + ask + "\n"
      + "scene＝要画的画面（中文，80~160 字）：谁在哪儿、在做什么、几个人之间什么距离和姿态、光和天气、这一刻的情绪。只写画面里看得见的，不写心理活动，不写对白。画面里的人只用 CP 里的名字。\n"
      + "只输出 JSON：" + (kind === "fanart" ? "{\"name\":\"\",\"style\":\"\",\"say\":\"\",\"scene\":\"\"}" : kind === "book" ? "{\"scene\":\"\",\"tagline\":\"\",\"genre\":\"\",\"mood\":\"\"}" : "{\"scene\":\"\"}");
    const user = "《" + (fic.title || "") + "》\nCP：" + cpText + (tags ? "\n标签：" + tags : "") + (fic.groupWay ? "\n关系：" + fic.groupWay : "") + "\n\n" + ficArtText(fic, chapIdx);
    const raw = await callAI(active, sys, [{ role: "user", content: user }], { maxTokens: 8000, timeout: 120000 });
    const d = parseJSONLoose(raw) || {};
    if (!String(d.scene || "").trim()) throw new Error("没想好画什么，再点一次");
    return d;
  }

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
  // cp token：charId | "me"（我·面具人设）；空数组=原创向。
  function meChar(profile) { return { id: "me", name: (profile && profile.name) || "我", persona: (profile && profile.persona) || "", appearance: (profile && profile.appearance) || "", isMe: true }; }
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
  // 「我」按面具写（她 2026-10-16：「搞按面具吧」）：这篇 CP 里第一位角色认我哪张面具，人设和外貌就取那张；
  //   名字仍用资料里的那个，跟书架、CP 标签、「谁没出场」那几处对得上。没有角色（我 × 原创）就用资料本身。
  let ficMeOf = null, ficProfile = null;
  // 页面那半（fanfic.js，用到才加载）每次画的时候把这两样递进来：拆开以后它改不了这里的 let，只能经这一道
  function setFicMe(meOf, profile) { ficMeOf = meOf || null; ficProfile = profile || null; }
  // 这一篇单独挑了面具（她 2026-10-17「同人文设置搞面具分吧」）：挑了就用那张，不挑照旧跟着那位角色认的
  function ficMaskById(id) { if (!id) return null; try { return (loadJSON("x_masks", []) || []).find(function (m) { return m && m.id === id; }) || null; } catch (e) { return null; } }
  function ficMeProfile(cp, profile, maskId) {
    profile = profile || ficProfile;
    const lead = (cp || []).find(function (tok) { return tok !== "me"; });
    const mask = ficMaskById(maskId) || (lead && typeof ficMeOf === "function" ? ficMeOf(lead) : null);
    return mask && mask !== profile ? Object.assign({}, profile || {}, { persona: mask.persona || "", appearance: mask.appearance || "" }) : profile;
  }
  function cpChars(cp, characters, profile, maskId) {
    const me = ficMeProfile(cp, profile, maskId);
    return (cp || []).map(function (tok) { return tok === "me" ? meChar(me) : characters.find(function (c) { return c.id === tok; }); }).filter(Boolean);
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
      }, "data-wk": "ficauthorspageauthorface"
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
      following: 8 + (seed >>> 7) % 190
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
    return h("span", { className: "flex items-center", style: { gap: 3, flexWrap: "wrap" }, "data-wk": "ficauthorspagezhengtally" },
      boxes.map(function (cnt, bi) {
        return h("svg", { key: bi, width: size, height: size, viewBox: "0 0 20 20", "aria-hidden": true, style: { display: "block", flexShrink: 0 }, "data-wk": "ficauthorspage", "data-part": "r3" },
          ZHENG_STROKES.slice(0, cnt).map(function (d, si) {
            return h("path", { key: si, d: d, stroke: color, strokeWidth: 1.9, strokeLinecap: "round", fill: "none", "data-wk": "ficauthorspage", "data-part": "r4" });
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
      }, "data-wk": "ficauthorspageauthorseal"
    }, ch);
  }
  // ---- 暴露 --------------------------------------------------
  window.Fanfic = {
    genFicArtBrief: genFicArtBrief, FIC_ART_STYLES: FIC_ART_STYLES,
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
  // 页面那一半（fanfic.js）要用的，原样递过去
  window.FanficCore = { useState, FANFIC_ANTI_CLICHE, STYLE_FIDELITY_TAIL, FANFIC_ORGANIC_FORM, loadRead, markRead, K_SHARED_STYLES, FIC_TOKEN_MAX, FIC_PAPERS, FIC_PAPER_DEFAULT, ficPaper, PaperSwatch, ficPaperFor, ficPaperTheme, MIN_CHARS_MAX, minCharsFor, clampPerFic, loadCfg, saveCfg, labStylePresets, allStylePresets, styleTextForIds, activeStyleText, STYLE_LAB_AXES, STYLE_LAB_RECIPE, buildStyleLabPrompt, loadMe, saveMe, meProfile, loadAuthors, authorName, findAuthor, loadTabs, saveTabs, loadFics, saveFics, loadCPs, saveCPs, uid, exportFanficAudit, protectedFic, chatMaterialFor, stanceFor, loadCircle, circleFeud, rpAuthorName, ficHeat, ficHash, ficPenName, ficWords, cpLabel, ficMeProfile, cpChars, ficPenId, cnIndex, useEffect, setFicMe };
})();
