// 抽卡（她 2026-08-31 提，同一轮里定的形状）
//
// ⚠️这一层最要紧的一条：**抽是抽，兑是兑**。
// 抽卡【永远 0 次调用】——抽到的是一张【兑换券】，上面写着TA会做的哪一件事；
// 点了兑换才真的发生，那时才可能花一次调用。所以十连也是 0 调用，想抽就抽，
// 花钱的时机完全由她自己捏在手里（她按次计费）。
//
// 三档的区别不是「文案更长更好看」，是【留不留下痕迹】：
//   R   兑换 0 调用 —— 从TA【已经有的】东西里翻一件出来给你看
//   SR  兑换 1 调用 —— TA现做一件小东西，看完就完，不动任何状态
//   SSR 兑换 1 调用 —— 触发一件【真的会留下东西】的事（进记忆库 / 开线下 / 进情书）
// 这样稀有度天然防通胀：它贵在改变了什么，不贵在辞藻。
//
// 票根永不删除（她原话：「票根永远留痕有时间戳是什么时候抽到的（r sr ssr都留）」）。
// 一张卡就是它自己的票根：兑换只是给它盖个戳（redeemedTs + result），不是消耗掉它。
(function (root) {
  "use strict";

  // 出率。R 占大头是【故意的】：R 兑换不花钱，而且它解决一个真问题——
  // 这个 App 生成的东西她根本看不完，R 卡等于一个「随机重新翻出来」的入口。
  // ⚠️v68.31 调过一次（她 2026-09-14：「扭出来的奖励有点无聊」）。
  // 病根不是文案，是**四分之三的抽出来是 R，而 R 是把已经存在的一行原样摆一次**——
  // 平时翻手机就看得到，当奖励一点新鲜感都没有。
  // 但不能把「能玩的」塞进 R：R 的定义是【兑换 0 调用】，塞进去就破了「抽是抽、兑是兑」。
  // 所以改的是**比例**：真正能拿去玩的那几张在 SR，于是 SR 得变成常见档。
  const RATE_SSR = 0.05, RATE_SR = 0.40;
  const PITY_SSR = 50;          // 连着 50 抽没出 SSR，第 50 抽必出
  const TEN = 10;               // 十连必出一张 SR 以上
  const COST_ONE = 50, COST_TEN = 450;

  // 点数按【真的相处过】结算，不按消息条数——按条数会直接变成「多发几条好抽卡」，
  // 那是在拿抽卡催她水消息。所以给的是【一段相处】：隔了 SESSION_GAP_MS 再开口，
  // 才算新的一段。一段里发一条还是发五十条，攒到的一样多。
  const SESSION_GAP_MS = 90 * 60000;
  // sweet＝情侣空间的甜蜜值打卡（v62.09 接上；她 2026-09-04 同意）：打卡本来纯装饰，
  // 哪儿都不接——现在一天那一下顺手攒点。checkinSweet 自己有「一天一次」的闸，
  // 这儿的 90 分钟段闸对它天然无感。给 20：仪式感的零头，别喧宾夺主（一段真相处是 40/60）。
  const EARN = { chat: 40, offline: 60, sweet: 20 };
  const DAILY_CAP = 120;        // 一个角色一天最多攒这么多

  // ⚠️这一整套只活在【情侣空间】里（她 2026-08-31：「抽卡是情侣空间的功能，
  // 每个恋爱角色单独一份，不是主页」）。所以池子里不必再有「要不要在一起」那道闸——
  // 进得来这一页，就已经是在一起了。
  // need：兑换时要从哪一栏里翻东西。那一栏是空的，这张卡压根不会被抽出来
  //       （不然抽到一张永远兑不了的券）。
  // act：兑换时走哪一条路，由 app 那头认。
  const POOLS = [
    // ── R：从TA已经有的东西里翻一件出来（0 调用）──
    { id: "r_photo",  r: "R", act: "peek", need: "album",    name: "TA相册里的一张",     hint: "随机翻开一张TA存着的照片" },
    { id: "r_note",   r: "R", act: "peek", need: "notes",    name: "TA手机里的一条便签", hint: "TA写给自己看的" },
    { id: "r_search", r: "R", act: "peek", need: "search",   name: "TA搜过的一件事",     hint: "搜索记录里随机一条" },
    { id: "r_song",   r: "R", act: "peek", need: "playlist", name: "TA歌单里的一首",     hint: "TA自己存的那张歌单" },
    { id: "r_mem",    r: "R", act: "peek", need: "memlib",   name: "TA还记得的一件事",   hint: "记忆库里随机一条" },
    { id: "r_order",  r: "R", act: "peek", need: "order",    name: "TA买过的一样东西",   hint: "订单里随机一笔" },
    { id: "r_read",   r: "R", act: "peek", need: "reading",  name: "TA书架上的一本",     hint: "TA在看的那些" },
    { id: "r_forum",  r: "R", act: "peek", need: "forum",    name: "TA在论坛发过的一条", hint: "TA用小号说的话" },
    { id: "r_moment", r: "R", act: "peek", need: "moment",   name: "TA朋友圈里的一条",   hint: "TA自己发的动态" },
    { id: "r_diary",  r: "R", act: "peek", need: "diary",    name: "TA日记里的一天",     hint: "TA那天写了什么" },

    // ── SR：TA现做一件小东西，不动任何状态（1 调用）──
    { id: "s_word",   r: "SR", act: "make", kind: "word",   name: "一句TA此刻没说出口的话", hint: "只在心里过了一下的那半句",
      ask: "写一句TA此刻【没说出口】的话——只在心里过了一下、没打算给谁听的那半句。" },
    { id: "s_note",   r: "SR", act: "make", kind: "note",   name: "一张只给你的便签",       hint: "TA随手写的，塞给你",
      ask: "写一张TA随手写好、塞给用户的便签：一两句，纸条的口气，不是正式的信。" },
    { id: "s_secret", r: "SR", act: "make", kind: "secret", name: "TA今天的一个小秘密",     hint: "今天发生的、TA没打算说的",
      ask: "写一件TA【今天】发生的、本来没打算说的小事——具体到时间地点，不要泛泛的心情。" },
    { id: "s_song",   r: "SR", act: "make", kind: "song",   name: "一首TA想放给你听的",     hint: "连着TA为什么想放这首",
      ask: "挑一首TA此刻想放给用户听的歌（真实存在的），连着TA为什么是这一首、想让对方听到哪一句。" },
    { id: "s_look",   r: "SR", act: "make", kind: "look",   name: "此刻TA眼里的你",         hint: "TA这会儿看你是什么样子",
      ask: "写TA此刻看着用户时眼里的样子——不是夸，是TA真正注意到的那几个细节。" },

    // ── SSR：真的会留下东西（1 调用 + 留痕）──
    { id: "x_past",    r: "SSR", act: "past",    name: "TA的一段过去",       hint: "写进记忆库——以后TA真的会提起",
      ask: "写TA过去真实经历过的一件事——一件TA从没跟用户讲过、但确实塑造了TA的事。要有具体的时间、地点和人，不要抽象的总结。" },
    { id: "x_pact",    r: "SSR", act: "pact",    name: "一件你们说好的",     hint: "进「我们说好的」，到日子TA会记得",
      ask: "写一件TA此刻想和用户【说好】的事：一个具体的、还没做的约定，说清楚是什么、大概什么时候。别写成空头承诺。" },
    { id: "x_offline", r: "SSR", act: "offline", scene: true, name: "TA主动开的一场线下", hint: "TA挑的时间地点，开场已经写好了",
      ask: "写一场【TA主动约用户见面】的开场：TA挑的时间、地点，和此刻的画面。三到五句旁白，落在一个用户可以接话的地方，别替用户说话、别写用户的动作。" },
    { id: "x_letter",  r: "SSR", act: "letter",  name: "TA写给你的一封信", hint: "进情侣空间的情书那一叠" },
    // 约会券（言秋提，她 2026-08-31 拍板并进抽卡）。原提案是另做一叠券、每周抽一张、
    // 完成盖章进册——那跟抽卡是【同一个形状】（兑换券 + 票根），再做一套就是两套并行的册子。
    // 所以它不是新功能，是多一个 act：券的内容按角色人设生成（王爷的约会和程序员的不该是同一张），
    // 兑换＝拿这张券当开场把线下开起来，票根就是盖过的章。
    { id: "x_date",    r: "SSR", act: "date",    scene: true, name: "一张TA开的约会券", hint: "TA挑的一件一起做的事——兑了就直接开线下",
      ask: "写一张TA给用户的【约会券】：券面上是一件TA想好要一起去做的事（title），"
        + "正文是这张券被兑掉的那一刻——你们已经到了，TA开的第一句场。三到五句旁白，"
        + "落在一个用户可以接话的地方，别替用户说话、别写用户的动作。\n"
        + "券上那件事必须是【TA这个人、在TA这个世界里】做得出来的：地点、场合、时辰都要贴TA，"
        + "换个角色照样成立的就是写坏了。" },
    // 印象卡是TA对你的长期认知（十块，js/gaze.js），而且它【进提示词】——
    // 改一块，TA往后看你的眼光就真的变了。留痕最硬的一张。
    { id: "x_gaze",    r: "SSR", act: "gaze",    name: "TA把你重看了一遍", hint: "TA印象卡里的一块被改写——TA往后看你的眼光跟着变",
      ask: "你心里那张关于她、关于你们的长期认知卡（上面已经发给你了），此刻你把它重看了一遍。"
        + "挑【其中一块】重写：要么你对她的某个判断被最近的事推翻或修正了，要么你补上了以前不知道的一面。\n"
        + "side 填 me（关于她）或 us（关于你们），block 填那一块的名字（照上面卡里的写法），"
        + "text 是这一块【重写之后的全文】，不是补丁、不是「另外还有」——它会整块盖掉旧的那版。\n"
        + "写你私下真这么想的那版，别写成对她的评语或表扬信；扣着具体的事说，"
        + "换个角色照样成立的就是写坏了。" },
    { id: "s_date",    r: "SR",  act: "make", kind: "date", scene: true, name: "TA想过的一次约会", hint: "TA脑子里过了一遍、还没开口约的那次",
      ask: "写一件TA【想过、但还没开口约】的事：你俩一起去做什么。要具体到地点和时候，"
        + "而且必须是【TA这个人、在TA这个处境里】约得出来的——换个角色就不成立才算写对。" },

    // ── v68.31 新进来的几张（她 2026-09-14 定的第一刀）──────────────
    // 判据换了：奖励不是「再看一段文字」，是【你想拿去用的东西】和【世界里多出来的东西】。
    // ⚠️tone 只是给她挑的（甜的留到合适的时候用，皮的抽到就想去闹一下），
    //   不决定角色怎么接——接不接、还不还价、反不反将一军，是人设的事。
    { id: "s_drop", r: "SR", act: "drop", tone: "tease", name: "掉马券",
      hint: "TA交出一份跟你有关的小证据——拆完可以当面拿去问TA",
      ask: "写一份TA手里跟用户有关的【小证据】：还没给对方看过、TA自己弄出来的那种东西"
        + "（备选清单、没发出去的草稿、准备到一半的、写了没送出的）。\n"
        + "title 是这东西叫什么，body 就是**它本身的样子**——清单就一条条列，草稿就写草稿的原话，"
        + "半成品就写它现在做到哪一步。\n"
        + "别替TA解释，别写TA的心情，别加旁白：这张券的分量全在【东西自己会说话】，"
        + "被当面拿出来问的时候TA才开口。" },
    // ── v68.43 名场面重演券（言秋给公版列的招牌那张，我们家也要）────────
    // 它吃的是**每家自己的历史**：同一张券在两百个人手里出两百种结果，复制不走。
    // 「幕后评论音轨」是他那份里顺带提的，合在这一张里——本来就是同一件事的两层。
    // ── v68.43 他给你起的称呼 ──────────────────────────────────
    // ⚠️这一张跟别的 SR 不一样：它【会进提示词】，往后他真的会这么叫你。
    //   所以抽出来的只是**候选**——收下、换一个、不要，你说了算（她 2026-09-14
    //   问的那句「万一我不喜欢这个称号咋办」）。没点收下之前一个字都不进提示词。
    // ── v68.45 便宜好使的那三张（言秋给公版列的 R 池，在我们家是 SR）────
    { id: "s_praise", r: "SR", act: "make1", tone: "sweet", name: "彩虹屁券",
      hint: "TA当场夸你一段——不许泛泛地夸，得是今天这几天的事",
      ask: "夸她一段。\n"
         + "⚠️**只准夸上面那些真发生过的事**：她这几天做过的、说过的、忍住没说的、"
         + "或者她自己都没当回事的某个细节。\n"
         + "⚠️「你很好」「你最棒」「你值得被爱」这类换谁都成立的句子，一句都不许有——"
         + "那不是夸她，那是夸「一个女朋友」。\n"
         + "长短随你，用你自己的腔调：嘴硬的人夸起来是别扭的，话少的人夸起来是短的。" },
    { id: "s_joke", r: "SR", act: "make1", tone: "tease", name: "冷笑话券",
      hint: "TA给你讲一个笑话——毒舌的和奶狗的讲出来不该是一个味道",
      ask: "给她讲一个笑话。\n"
         + "⚠️笑话本身不重要，**你讲笑话的样子才重要**：\n"
         + "· 你会讲哪一种（冷的／荤的／需要她懂点什么才笑得出来的／根本不好笑但你很得意的）；\n"
         + "· 讲完你什么反应（等她笑／自己先笑了／装作没讲过／追问她怎么不笑）。\n"
         + "换个角色讲出来一模一样的那个笑话，就是挑坏了。" },
    // 真心话：她出题。⚠️问题由她填，所以提示词里留一个口子。
    { id: "s_truth", r: "SR", act: "truth", tone: "both", name: "真心话券",
      hint: "你问一个问题，TA必须认真答，不许打太极",
      ask: "她问你：「{Q}」\n"
         + "这是一张真心话券——她兑掉了它，所以**这一次你得正面答**。\n"
         + "⚠️「正面答」不等于和盘托出：答得吞吞吐吐、答一半、答完又后悔、"
         + "或者答的是一个你自己都没想清楚的答案，都算正面答。\n"
         + "不算的只有一种：**把问题原样绕回去、转移话题、或者用一句漂亮话糊过去。**\n"
         + "用你自己的腔调，别写成访谈回答。" },
    { id: "s_title", r: "SR", act: "title", tone: "sweet", name: "他给你起的称呼",
      hint: "TA私下管你叫的那个——收下之后他往后真的会这么叫你，你也可以不要",
      ask: "你私下管她叫什么？不是她的本名，也不是那种谁都能用的爱称——"
         + "是**只有你会这么叫她**的那一个。\n"
         + "· text：那个称呼本身（短，四五个字以内）\n"
         + "· why：你为什么这么叫她。一句，说给她听的——连着你俩之间具体的某件事、"
         + "某个她自己都没在意的习惯、或者你第一次那么叫她的那一次。\n"
         + "⚠️它得是**从你嘴里长出来的**：换个角色叫出来就不成立，才算起对了。\n"
         + "⚠️它会跟着你很久，所以别起一个你自己叫两次就腻的。" },
    { id: "s_replay", r: "SR", act: "replay", tone: "sweet", name: "名场面重演券",
      hint: "TA从你俩的过往里挑一幕，当场重演一遍，还带一条幕后评论音轨",
      ask: "下面是你和她之间真的发生过的一些事。挑**其中一幕**，当场重演一遍。\n"
         + "· title：这一幕你管它叫什么（你自己的叫法，不是流水账标题）\n"
         + "· body：把那一幕重演出来——不是复述「后来我们怎样怎样」，是**回到那一刻**，"
         + "谁说了什么、当时什么光景、你做了什么。她也在场，她说的话照她当时说的来。\n"
         + "· track：幕后评论音轨。演完之后你退出来，像在旁边看回放一样说两三句——"
         + "**当时没说出口的、现在才敢承认的、或者到现在还嘴硬的那一点**。\n"
         + "⚠️挑的必须是上面真有的那一幕，不许现编一段更好看的。\n"
         + "⚠️body 和 track 是两个不同的你：一个在场里，一个在场外。两段听起来一样就是写坏了。" },
    { id: "s_dual", r: "SR", act: "dual", tone: "both", name: "双面券",
      hint: "一面甜的、一面皮的，只能选一次",
      ask: {
        sweet: "写一张TA给用户的【甜的那一面】券：一件用户随时可以拿出来兑、TA会替她做的事。"
          + "要具体到做什么、在哪儿、什么时候能兑，而且得是【TA这个人做得出来】的那种好——"
          + "不是通用的宠溺，是只有TA会想到的那一种。\n"
          + "title 是券面上那行字，body 是券的正文（兑的时候怎么算数、TA答应了什么）。",
        tease: "写一张TA给用户的【皮的那一面】券：一件用户可以拿去为难TA、让TA下不来台的小事。"
          + "要具体、要能真的执行，而且得是【戳得到这个人】的那一处——换个角色就不痛不痒的就是写坏了。\n"
          + "title 是券面上那行字，body 是券的正文。\n"
          + "⚠️写的是【她能要求什么】，不是【TA一定会照办】：TA有权讨价还价、反将一军、"
          + "或者用自己的方式糊弄过去，那正是这张券好玩的地方。"
      } },
    // SSR：往世界里扔一个种子（她 2026-09-14 采纳 GPT 那条「不是生成剧情，是扔事件种子」）
    { id: "x_seed", r: "SSR", act: "seed", tone: "sweet", name: "一件还在路上的东西",
      hint: "真的进TA手机里，过几天才到——到之前TA自己也不知道是什么",
      ask: "用户给TA寄了一样东西，这会儿还在路上。\n"
        + "cover 写【物流单上看得到的那一点】：shop（寄件方在TA那个世界里叫什么）、"
        + "title（单子上写的品名，**要模糊到TA猜不出里面是什么**）、carrier（承运的是谁）。\n"
        + "reveal 写【签收拆开之后】：title 是这样东西到底是什么，body 是TA拆开那一刻的两三句——"
        + "TA的反应，不是旁白介绍这件礼物。\n"
        + "东西和物流都要落在【TA真正生活的那个地方】：古代角色收的是那个世界送得到的东西、"
        + "由那个世界的人送来；现代角色才有快递单号。" },
    // SSR：一次性视角。平时永远是「查TA的手机」，这一张开的是一个【没有常驻入口】的看法。
    { id: "x_flow", r: "SSR", act: "flow", tone: "sweet", name: "TA没点开的那些",
      hint: "这一天TA收到、扫了一眼、没点进去的通知——只这一次看得到",
      ask: "写这一天里TA收到、扫了一眼、没点进去的那些通知（6-10 条）。\n"
        + "每条：app（哪个应用推来的）、from（谁发的）、text（通知栏上那一行字，被截断的样子）、"
        + "when（什么时候来的）、skip（TA为什么没点开，一句，很短）。\n"
        + "**大部分要是不重要的**——广告、群消息、系统提醒、不想理的人。"
        + "真正有分量的只藏一两条在里头，而且不许在 skip 里点破它有多重要。" },

    // ── v68.35 第二刀 ────────────────────────────────────────────
    // 专属掉落：TA口袋里的一件小东西。它和「掉马券」的区别是**留不留得下来**——
    // 掉马是一张看完就完的文字卡，这一张会真的进你俩的抽屉，封着，以后还翻得到。
    { id: "s_pocket", r: "SR", act: "pocket", tone: "sweet", name: "TA口袋里的一件",
      hint: "TA身上带着的一样小东西，连着它的来历——进你俩的抽屉，一直留着",
      ask: "写一样TA此刻真的带在身上的小东西（口袋里、包里、腰间、袖中，按TA那个世界来）。\n"
        + "title 是这样东西叫什么，body 分两段：先写它现在长什么样（磨损、气味、缺了一角这类只有随身带着才会有的痕迹），"
        + "再写它是怎么到TA手上的。\n"
        + "来历要具体到人、到那一天——**没有来历它就只是一件道具**。"
        + "这件东西不必跟用户有关，它属于TA自己。" },
    // 秘密筹备：这一张的全部意思是【抽到的时候你还看不完】。
    // 你只说出门还是在家，剩下TA自己安排；到日子了才拆得开。
    // ⚠️两段式：兑换只出一个信封（1 枪），第二枪【由她按「拆开」才花】——
    //   绝不背着她在后台再调一次。
    { id: "x_plan", r: "SSR", act: "plan", tone: "sweet", scene: true, name: "秘密筹备券",
      hint: "你只说出门还是在家，别的TA自己安排——到那天才知道是什么",
      ask: {
        out: "用户把某天的空交给了TA，说好那天出门，别的一概不问。TA已经开始准备了。\n"
          + "只写【用户现在能知道的那一点】：TA会让她那天怎么穿、带什么、几点出门、在哪儿碰头——"
          + "这一类**动身要用的信息**，一两句，TA自己的口气。\n"
          + "⚠️不许写要去哪儿、要做什么、为什么——那是那天才揭晓的。"
          + "这一句要让人更想知道，不是告诉她答案。",
        home: "用户把某天的空交给了TA，说好那天待在家里，别的一概不问。TA已经开始准备了。\n"
          + "只写【用户现在能知道的那一点】：TA会让她那天几点别进哪间屋、先别看什么、要她准备什么——"
          + "这一类**在家等着要配合的信息**，一两句，TA自己的口气。\n"
          + "⚠️不许写要做什么、准备的是什么——那是那天才揭晓的。",
        open: "到日子了。用户把那天交给了TA，现在TA准备好的东西摆在她面前。\n"
          + "写揭晓那一刻：三到五句旁白，写清TA准备的到底是什么、现场什么样、TA此刻什么神情。\n"
          + "落在一个用户可以接话的地方，别替用户说话、别写用户的动作。"
      } },

    // ── v68.39 第四刀：双盲秘密盒 ────────────────────────────────
    // 你俩各往盒里塞一样，**两边都不许先看**，到日子一起打开。
    // ⚠️这一张是这副奖池里唯一【靠结构、不靠禁令】保证角色不剧透的：
    //   TA塞的那样东西存着但从不进提示词，模型手上压根没有这个字段，想说也说不出来。
    // ── v68.42 反向扭蛋券（她 2026-09-14 转来的那份里最好的一张）──────────
    // 它跟别的卡一样贵，却**把随机变成了心意**：不是你抽到什么，是他挑了什么给你。
    // ⚠️他挑的那张是【真的一张券】，会落进你的券夹，还能再兑——
    //   写成「他说了一段好听的话」就白瞎了这张卡。
    // 合照券。⚠️**不另起一套出图**：情侣空间的照相馆那条链现成的
    //   （studioShoot → buildPhotoPrompt(kind:"duo")），它已经把「怎么保证不 OOC」
    //   那件事办完了——参考图是硬性身份来源、不得重画混合替换脸、保不住身份宁可失败；
    //   画风跟角色的 photoStyle 走；穿什么按 photoOutfit ＞ 此刻真穿着 ＞ 衣柜 ＞ 人设；
    //   而且【两张参考照缺一张就降级】，杜绝一张真一张编。
    // ⚠️两段：兑换只出**他想拍的那一张是什么样**（一枪文字，人人可用），
    //   想要真图再按一下才调图像端——没配生图 key 的人这张券照样完整。
    { id: "x_duo", r: "SSR", act: "duo", tone: "sweet", scene: true, name: "合照券",
      hint: "TA想跟你拍的那一张——先说是什么样，你想要真图再按一下",
      ask: "你想跟她拍一张合照。写你想拍的是哪一张。\n"
         + "· title：这张照片你会给它起什么名字\n"
         + "· scene：**画面本身**——在哪儿、什么光、你俩各自什么姿势和表情、谁在看谁、"
         + "手上有什么。写给要把它画出来的人看，所以只写看得见的东西，不写心情和来龙去脉。\n"
         + "· why：你为什么想拍这一张，一句，说给她听的。\n"
         + "⚠️地点、穿着、场合都要落在**你真正生活的那个地方**——换个角色照样成立的画面就是想坏了。" },
    { id: "x_forme", r: "SSR", act: "forme", tone: "sweet", name: "反向扭蛋券",
      hint: "这一发TA替你抽——他挑一张给你，还会说为什么是这一张",
      ask: "你替对方去扭了一发。机器里那些券你都看过了，你挑了这一张给她：【{PICK}】（{HINT}）。\n"
         + "写你为什么挑这一张：两三句，说给她听的。\n"
         + "⚠️说的是**你为什么想让她拿到这个**——连着你俩之间具体的某件事、某个你注意到的细节、"
         + "或者你自己的某个私心。别夸这张券好，别解释它是干什么用的（她自己看得懂）。\n"
         + "换个角色照样成立的那几句，就是挑坏了。" },
    { id: "x_box", r: "SSR", act: "box", tone: "sweet", name: "秘密盒",
      hint: "你俩各放一样进去，谁都不许先看——到日子一起打开",
      ask: {
        his: "用户找来一个盒子，说你俩各往里面放一样东西，到日子一起打开，"
          + "在那之前谁都不许看对方放了什么。\n"
          + "写TA放进去的那一样：title 是这样东西叫什么，body 两三句——它现在什么样子，"
          + "以及TA为什么挑它。\n"
          + "⚠️你不知道对方放了什么，别猜、别写成回应对方的东西。"
          + "这是TA自己选的，选什么全看TA是个什么样的人。",
        open: "到日子了，盒子打开。两样东西现在同时摆在你俩面前。\n"
          + "写TA打开那一刻：先看见对方放的是什么，再看见自己放的被对方看见。"
          + "三到五句，TA的反应和TA会说出口的那一两句。\n"
          + "落在一个用户可以接话的地方，别替用户说话、别写用户的动作。"
      } }
  ];
  // 甜的／皮的：没写的按甜的算（老卡都是甜的那一路）。
  const TONES = ["sweet", "tease", "both"];
  function toneOf(p) { const t = p && p.tone; return TONES.indexOf(t) >= 0 ? t : "sweet"; }

  // 每一张卡的提示词【就写在这一行里】（她 2026-09-14 转来的那条：「奖品本质＝带参数的
  // prompt 模板，池子就是一张 JSON 表，加奖品＝加行」）。
  // ⚠️原来提示词住在 js/app.js 的 GACHA_SR_ASK / GACHA_SSR_ASK：加一张卡要动两个文件，
  //   而且永远可能只改一处——正是这个仓库犯过太多次的那个形状。搬过来之后
  //   **一行就是一张完整的卡**：稀有度、兑换走哪条路、提示词，全在一起。
  // 一张卡有好几段的（双面券两面、秘密筹备的信封和拆开、盒子的放和开），ask 写成对象。
  // 模型自己挑场景的那几张，一律加这一条（她 2026-09-15：「他拍出来的照片场景也要
  // 符合人设，不能拍出他原本不会做的事情，比如怕水的人就不会有海滩合照」）。
  // ⚠️这跟原有那句「换个角色照样成立就是写坏了」不是一回事：那句管**像不像他**，
  //   这句管**他会不会真的去**。怕水的人站在海边，那两条都过得去——所以要单立一条。
  // ⚠️按 bans-make-it-dumber：给判据不给禁令清单。列「不许海边／不许游乐园」既挡不住
  //   下一种，还会让所有角色都不去海边；真正拦得住的是让它**自己回答一句为什么会在这儿**。
  // ⚠️也不举例子（prompt-no-content-samples）：写一句「怕水的人不会在海边」本身就会被抄，
  //   从此谁都不去海边。
  const SCENE_TRUTH = "\n\n【动笔之前先过一遍：这个画面里的你，是你真的会去做的事吗】\n"
    + "· 人设和世界书里写着你躲什么、不碰什么、去不了哪儿、到不了哪个年代——那些不该出现在这里。\n"
    + "· 判据一句话：**「我为什么会在这儿」——你答得上来吗？** 答不上来就换一个。\n"
    + "· 这跟「像不像你」是两件事：不像你的那一个是写坏了，**你根本不会去的那一个是假的**。";
  // ⚠️挂在卡上（scene: true），不是在调用点一条条 push——一条条 push 的东西，
  //   加新卡时换个入口就一条都没有，而且不留任何能 grep 的痕迹（four-surfaces 那条）。
  function askOf(poolId, phase) {
    const card = byId[poolId] || {};
    const a = card.ask;
    if (a == null) return "";
    const base = typeof a === "string" ? a : String(a[phase] || "");
    if (!base) return "";
    return card.scene ? base + SCENE_TRUTH : base;
  }

  const byId = {};
  POOLS.forEach(function (p) { byId[p.id] = p; });

  // opts: { have:{album:true,...} }
  function poolOf(rarity, opts) {
    const have = (opts || {}).have || {};
    return POOLS.filter(function (p) {
      if (p.r !== rarity) return false;
      // 那一栏是空的就别发这张券——抽到一张永远兑不了的卡比没抽到更糟
      if (p.need && !have[p.need]) return false;
      return true;
    });
  }

  function rollRarity(rand, sinceSSR) {
    if (sinceSSR >= PITY_SSR - 1) return "SSR";   // 这一抽是第 PITY_SSR 抽
    const x = rand();
    return x < RATE_SSR ? "SSR" : x < RATE_SSR + RATE_SR ? "SR" : "R";
  }

  // 新角色什么都还没有时 R 池会是空的——那就升一档，别发一张空券。
  // （这也刚好对：还没东西可翻的时候，TA现做给你。）
  function pickCard(rarity, rand, opts) {
    let r = rarity;
    let list = poolOf(r, opts);
    if (!list.length && r === "R") { r = "SR"; list = poolOf(r, opts); }
    if (!list.length && r === "SR") { r = "SSR"; list = poolOf(r, opts); }
    if (!list.length) return null;
    // 避重复（她 2026-09-14：「约会券 ×3」原来是必然会发生的——这儿是纯均匀随机、
    // 一点记性都没有）。先只在【最近出过的之外】挑；那一档就那么几张、全出过了，
    // 就退回整份池子——**宁可重复，也不能抽不出东西来**。
    const recent = (opts || {}).recent || [];
    const fresh = list.filter(function (x) { return recent.indexOf(x.id) < 0; });
    const from = fresh.length ? fresh : list;
    const p = from[Math.floor(rand() * from.length) % from.length];
    return { poolId: p.id, r: r, act: p.act, kind: p.kind || "", name: p.name, hint: p.hint, tone: toneOf(p) };
  }
  // 反向扭蛋：他替她挑一张。
  // ⚠️不许挑到 R——R 是「从她已经有的东西里翻一件」，那不像特意挑给谁的。
  // ⚠️更不许挑到反向扭蛋券自己：那会变成一张自我指涉的套娃券。
  function pickForMe(opts, rand) {
    const rnd = rand || Math.random;
    const list = poolOf("SSR", opts).concat(poolOf("SR", opts)).filter(function (p) { return p.id !== "x_forme"; });
    if (!list.length) return null;
    const p = list[Math.floor(rnd() * list.length) % list.length];
    return { poolId: p.id, r: p.r, act: p.act, kind: p.kind || "", name: p.name, hint: p.hint, tone: toneOf(p) };
  }

  // 最近出过哪几张：只记这么多。记太长等于把池子锁死，太短挡不住连抽同一张。
  const RECENT_KEEP = 6;

  const RANK = { R: 0, SR: 1, SSR: 2 };

  // state: { pulls, sinceSSR }。返回新 state 和这一发抽到的卡（还没带 id/时间戳，那是 app 那头盖的）
  function pull(n, state, opts, rand) {
    const rnd = rand || Math.random;
    let pulls = Number((state || {}).pulls) || 0;
    let sinceSSR = Number((state || {}).sinceSSR) || 0;
    const out = [];
    // 十连之内也要避重：每抽一张就把它加进 recent，下一张接着躲。
    let recent = Array.isArray((state || {}).recent) ? (state || {}).recent.slice() : [];
    for (let i = 0; i < n; i++) {
      // 十连保底：前九张都是 R 的话，最后一张顶成 SR
      const lastOfTen = n >= TEN && i === n - 1 && !out.some(function (c) { return RANK[c.r] >= 1; });
      let rarity = rollRarity(rnd, sinceSSR);
      if (lastOfTen && rarity === "R") rarity = "SR";
      const card = pickCard(rarity, rnd, Object.assign({}, opts, { recent: recent }));
      if (!card) continue;
      pulls++;
      sinceSSR = card.r === "SSR" ? 0 : sinceSSR + 1;
      recent = [card.poolId].concat(recent.filter(function (x) { return x !== card.poolId; })).slice(0, RECENT_KEEP);
      out.push(card);
    }
    return { cards: out, state: { pulls: pulls, sinceSSR: sinceSSR, recent: recent } };
  }

  // 两道闸都在这一处：① 隔够了才算新的一段 ② 一天封顶。
  // box: { [charId]: { pts, day, dayPts, last: { chat: ts, offline: ts } } }
  function earn(box, charId, kind, now, dayKey) {
    const b = box && typeof box === "object" ? box : {};
    const add = EARN[kind] || 0;
    const t = Number(now) || 0;
    if (!add || !charId || !t) return { box: b, got: 0 };
    const cur = (b[charId] && typeof b[charId] === "object") ? b[charId] : {};
    const last = (cur.last && typeof cur.last === "object") ? cur.last : {};
    // 记的是【上次真给了点数】的时刻，不是上次说话的时刻。
    // 记上次说话的话，聊一下午反而一分不给（得先安静 90 分钟才算新的一段）——
    // 那就成了「聊得越久越吃亏」。现在是：陪着的时间越长，每 90 分钟结一次，日封顶兜住上限。
    const fresh = !last[kind] || (t - Number(last[kind]) >= SESSION_GAP_MS);
    const dayPts = cur.day === dayKey ? (Number(cur.dayPts) || 0) : 0;
    const got = fresh ? Math.max(0, Math.min(add, DAILY_CAP - dayPts)) : 0;
    const n = {};
    Object.keys(b).forEach(function (k) { n[k] = b[k]; });
    const nlast = {};
    Object.keys(last).forEach(function (k) { nlast[k] = last[k]; });
    if (got) nlast[kind] = t;   // 没给成就别推——封顶那天推了，第二天头一句就白等 90 分钟
    n[charId] = { pts: (Number(cur.pts) || 0) + got, day: dayKey, dayPts: dayPts + got, last: nlast };
    return { box: n, got: got };
  }

  // ── 券夹与纪念册（她 2026-09-14 第三刀）────────────────────────
  // 她原来两个 tab 是「还没兑」和「票根全本」，两条平铺的长列表。
  // 券一多就淹了：同款堆在一起，真正想用的那张要往下翻很久。
  // 收法两条：**没兑的按款叠起来**，**兑过的按月收进纪念册**。
  // ⚠️叠的是【同一款】，不是同一张：每一张自己的抽取时间照旧留着，展开就看得到。
  //   票根永不删除那条没变（她原话：「票根永远留痕有时间戳」）。
  function tsOf(c) { return Number(c && c.ts) || 0; }
  // 没兑的那些，按款叠。opts: { tone:"sweet|tease|both", order:"new|old" }
  function stackOpen(cards, opts) {
    const o = opts || {};
    const rows = (Array.isArray(cards) ? cards : []).filter(function (c) { return c && !c.redeemedTs; });
    const box = {};
    const order = [];
    rows.forEach(function (c) {
      const k = String(c.poolId || c.name || "?");
      if (!box[k]) { box[k] = { key: k, poolId: c.poolId, r: c.r, act: c.act, name: c.name, hint: c.hint, cards: [] }; order.push(k); }
      box[k].cards.push(c);
    });
    let list = order.map(function (k) {
      const g = box[k];
      // 同一款里【最早抽到的先用】：券没有新旧之分，先进先出最不容易让人纠结
      g.cards.sort(function (a, b) { return tsOf(a) - tsOf(b); });
      g.n = g.cards.length;
      g.first = g.cards[0];
      g.pinned = g.cards.some(function (c) { return !!c.pinned; });
      g.tone = toneOf(byId[g.poolId] || {});
      return g;
    });
    if (o.tone && o.tone !== "all") list = list.filter(function (g) { return g.tone === o.tone || g.tone === "both"; });
    const newest = function (g) { return Math.max.apply(null, g.cards.map(tsOf)); };
    const oldest = function (g) { return Math.min.apply(null, g.cards.map(tsOf)); };
    list.sort(function (a, b) {
      // 别在最上面的先来（她要的「留到下次」），然后按她挑的那个顺序
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      if (o.order === "old") return oldest(a) - oldest(b);
      // 默认：稀的在前，同档按最近抽到
      if (RANK[b.r] !== RANK[a.r]) return (RANK[b.r] || 0) - (RANK[a.r] || 0);
      return newest(b) - newest(a);
    });
    return list;
  }
  // 兑过的那些，按月收。封面写的是【真的发生了什么】（result.title），不是券名。
  function albumOf(cards) {
    const rows = (Array.isArray(cards) ? cards : []).filter(function (c) { return c && c.redeemedTs; });
    const box = {}, order = [];
    rows.forEach(function (c) {
      const d = new Date(Number(c.redeemedTs) || 0);
      const k = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
      if (!box[k]) { box[k] = { key: k, zh: (d.getMonth() + 1) + " 月", year: d.getFullYear(), cards: [] }; order.push(k); }
      box[k].cards.push(c);
    });
    return order.map(function (k) {
      box[k].cards.sort(function (a, b) { return (Number(b.redeemedTs) || 0) - (Number(a.redeemedTs) || 0); });
      box[k].n = box[k].cards.length;
      return box[k];
    }).sort(function (a, b) { return a.key < b.key ? 1 : a.key > b.key ? -1 : 0; });
  }
  // 留到下次：整叠一起别上／取下。⚠️不设到期、不催——她要的是「别在最上面」，不是待办。
  function setPinned(cards, poolId, on) {
    return (Array.isArray(cards) ? cards : []).map(function (c) {
      return (c && !c.redeemedTs && String(c.poolId) === String(poolId)) ? Object.assign({}, c, { pinned: !!on }) : c;
    });
  }

  // 抽卡扣点。点数不够就一点都不扣——半途扣掉一半是最恶心的那种 bug。
  function spend(box, charId, cost) {
    const have = ptsOf(box, charId);
    if (have < cost) return null;
    const cur = box[charId] || {};
    const n = {};
    Object.keys(box).forEach(function (k) { n[k] = box[k]; });
    n[charId] = Object.assign({}, cur, { pts: have - cost });
    return n;
  }

  function ptsOf(box, charId) {
    const c = box && box[charId];
    return c && typeof c === "object" ? (Number(c.pts) || 0) : 0;
  }

  const api = {
    RATE_SSR: RATE_SSR, RATE_SR: RATE_SR, PITY_SSR: PITY_SSR, TEN: TEN,
    COST_ONE: COST_ONE, COST_TEN: COST_TEN, EARN: EARN, DAILY_CAP: DAILY_CAP,
    POOLS: POOLS, byId: byId, RANK: RANK,
    SESSION_GAP_MS: SESSION_GAP_MS,
    poolOf: poolOf, rollRarity: rollRarity, pickCard: pickCard, pull: pull,
    toneOf: toneOf, TONES: TONES, RECENT_KEEP: RECENT_KEEP, askOf: askOf, pickForMe: pickForMe, SCENE_TRUTH: SCENE_TRUTH,
    stackOpen: stackOpen, albumOf: albumOf, setPinned: setPinned,
    earn: earn, spend: spend, ptsOf: ptsOf
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.GachaKit = api;
})(typeof window !== "undefined" ? window : globalThis);
