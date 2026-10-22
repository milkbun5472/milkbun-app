// 照影（她 2026-10-22「就照影吧，做吧」）：让角色做性格小测，看着他一题题选，心声就是选的理由，留档在题目下面。
// 这一份是开机就在的那一半：题库、计分、存档、给聊天用的那一行。页面在 zhaoying.js（点开才装）。
//
// ⚠️题目是我们自己写的（她：「这个我们自己研究一下」）。几条规矩：
//   · 题面是日常场景，不出现术语（不说「外向」「依恋」），选项不让人一眼看出在测什么；
//   · 计分全在代码里：模型只管选，结果不交给它判——不然谁测都是同一个热门类型；
//   · 结果只是「他做过这套、那次选了这些」这件事，不是贴在他身上的标签（她一直不喜欢标签顶掉人设）。
(function (g) {
  "use strict";
  const KEY = "x_zhaoying";

  // ── 题库 ─────────────────────────────────────────────────
  // 每题 opts：[{ t: 选项文字, s: { 维度: 分 } }]
  const T = [];

  // 1. 四个字母那套：每个维度 4 题，两两相对
  T.push({
    id: "mbti", cat: "xg", name: "MBTI", sub: "十六种人格里的哪一种",
    axes: [["E", "I"], ["S", "N"], ["T", "F"], ["J", "P"]],
    qs: [
      { q: "难得空出一整个周末，你最想", opts: [{ t: "约几个朋友出去，热闹一点", s: { E: 1 } }, { t: "谁也不约，一个人待着把电充满", s: { I: 1 } }] },
      { q: "聚会上来了一群不认识的人", opts: [{ t: "挺好，正好认识几个新朋友", s: { E: 1 } }, { t: "找个认识的人待在旁边，等着差不多了就走", s: { I: 1 } }] },
      { q: "心里有事没想通的时候", opts: [{ t: "找人说出来，说着说着就理清了", s: { E: 1 } }, { t: "自己先闷着想清楚，想好了再说", s: { I: 1 } }] },
      { q: "一整天都在跟人打交道，晚上回到家", opts: [{ t: "还挺来劲，想再跟谁聊两句", s: { E: 1 } }, { t: "累，只想关门谁都别找我", s: { I: 1 } }] },
      { q: "照着说明书组装一样东西", opts: [{ t: "一步一步照着来，心里踏实", s: { S: 1 } }, { t: "扫一眼大概，剩下的边装边琢磨", s: { N: 1 } }] },
      { q: "跟人讲一件刚发生的事，你更常", opts: [{ t: "从头到尾讲清楚：几点、在哪、谁说了什么", s: { S: 1 } }, { t: "直接说这件事让你想到了什么", s: { N: 1 } }] },
      { q: "发呆的时候脑子里多半是", opts: [{ t: "待会儿要做的事、今天吃什么", s: { S: 1 } }, { t: "要是当初怎样、以后会怎样", s: { N: 1 } }] },
      { q: "你更信", opts: [{ t: "亲眼见过、亲手试过的", s: { S: 1 } }, { t: "直觉，说不上来但就是觉得对", s: { N: 1 } }] },
      { q: "朋友哭着跟你说被人欺负了，你第一反应", opts: [{ t: "先弄清楚怎么回事，帮他想怎么办", s: { T: 1 } }, { t: "先抱住他，让他哭完", s: { F: 1 } }] },
      { q: "要做一个对别人有影响的决定，你更看重", opts: [{ t: "道理上站不站得住", s: { T: 1 } }, { t: "大家心里好不好受", s: { F: 1 } }] },
      { q: "有人当面说你做错了", opts: [{ t: "他说得对就改，没什么", s: { T: 1 } }, { t: "嘴上不说，心里会难受一阵", s: { F: 1 } }] },
      { q: "吵架吵到最后，你更想要", opts: [{ t: "把对错掰扯清楚", s: { T: 1 } }, { t: "两个人别再难受了", s: { F: 1 } }] },
      { q: "出门旅行之前", opts: [{ t: "行程、住哪、几点出发都排好", s: { J: 1 } }, { t: "订个票就走，到了再说", s: { P: 1 } }] },
      { q: "有件事明天截止", opts: [{ t: "早几天就弄完了", s: { J: 1 } }, { t: "最后一晚上爆发", s: { P: 1 } }] },
      { q: "你的桌面／房间", opts: [{ t: "东西都有固定位置", s: { J: 1 } }, { t: "看着乱，但我知道东西在哪", s: { P: 1 } }] },
      { q: "计划好的事临时被打乱", opts: [{ t: "有点烦，得重新安排一下", s: { J: 1 } }, { t: "无所谓，换一个也挺好", s: { P: 1 } }] }
    ]
  });

  // 2. 靠近与退开（依恋）：焦虑 A、回避 V 两条轴
  T.push({
    id: "attach", cat: "gx", name: "依恋类型", sub: "在亲近的人面前，是往前靠还是往后退",
    qs: [
      { q: "喜欢的人半天没回消息", opts: [{ t: "该干嘛干嘛，他忙完会回", s: {} }, { t: "隔一会儿看一眼手机", s: { A: 1 } }, { t: "开始想是不是我说错话了", s: { A: 2 } }, { t: "那我也不回了", s: { V: 1, A: 1 } }] },
      { q: "对方说「我们聊聊」", opts: [{ t: "好啊，聊什么", s: {} }, { t: "心一下子提起来", s: { A: 2 } }, { t: "第一反应是想躲开", s: { V: 2 } }] },
      { q: "跟一个人越来越近的时候", opts: [{ t: "挺开心的，自然而然", s: {} }, { t: "怕哪天他就不这样了", s: { A: 2 } }, { t: "会想往后退一点，留点地方给自己", s: { V: 2 } }] },
      { q: "很难过的那天晚上", opts: [{ t: "会找最亲的那个人说", s: {} }, { t: "想找他，又怕打扰他", s: { A: 1, V: 1 } }, { t: "自己扛过去，不想让人看见", s: { V: 2 } }] },
      { q: "对方说想每天都见你", opts: [{ t: "好啊", s: {} }, { t: "心里很高兴，又有点不敢信", s: { A: 1 } }, { t: "有点喘不过气", s: { V: 2 } }] },
      { q: "吵完架冷了两天", opts: [{ t: "我会先去找他说开", s: {} }, { t: "一直在等他来找我，等得很煎熬", s: { A: 2 } }, { t: "过一阵就淡了，不太想去碰", s: { V: 2 } }] },
      { q: "「你对我是真心的吗」这种话", opts: [{ t: "很少问，也不太需要问", s: {} }, { t: "会想反复确认", s: { A: 2 } }, { t: "被问到会有点不自在", s: { V: 1 } }] },
      { q: "把自己最狼狈的一面给对方看", opts: [{ t: "可以，他是自己人", s: {} }, { t: "怕他看到了就不喜欢我了", s: { A: 2 } }, { t: "不会，那是我自己的事", s: { V: 2 } }] },
      { q: "一个人过一辈子", opts: [{ t: "也能过，但有人陪更好", s: {} }, { t: "想想就害怕", s: { A: 2 } }, { t: "好像也挺自在", s: { V: 2 } }] },
      { q: "对方说「我需要一点自己的时间」", opts: [{ t: "好，你忙", s: {} }, { t: "是不是我哪里不好", s: { A: 2 } }, { t: "正好，我也是", s: { V: 1 } }] }
    ]
  });

  // 3. 心意怎么给：五种（陪伴 Q、言语 W、礼物 G、行动 D、触碰 K）
  T.push({
    id: "love", cat: "gx", name: "爱的语言", sub: "你最会用哪一种方式对人好，也最吃哪一种",
    qs: [
      { q: "对方生日，你最想", opts: [{ t: "空出一整天只陪他", s: { Q: 1 } }, { t: "写一段很长的话给他", s: { W: 1 } }, { t: "挑一样他念叨很久的东西", s: { G: 1 } }] },
      { q: "累了一天回家，最想对方", opts: [{ t: "把饭做好了等你", s: { D: 1 } }, { t: "什么都不说先抱一下", s: { K: 1 } }, { t: "坐下来听你说今天", s: { Q: 1 } }] },
      { q: "最让你心里一软的是", opts: [{ t: "他说「你今天很好看」", s: { W: 1 } }, { t: "他顺路给你带了你爱吃的", s: { G: 1 } }, { t: "他牵了你的手", s: { K: 1 } }] },
      { q: "道歉的时候你更会", opts: [{ t: "把要说的话认认真真说出来", s: { W: 1 } }, { t: "默默把惹他不高兴的事做好", s: { D: 1 } }, { t: "买点什么哄他", s: { G: 1 } }] },
      { q: "最受不了的是", opts: [{ t: "在一起却各玩各的手机", s: { Q: 1 } }, { t: "他从来不夸你", s: { W: 1 } }, { t: "很久没抱过了", s: { K: 1 } }] },
      { q: "他生病了，你会", opts: [{ t: "请假陪在旁边", s: { Q: 1 } }, { t: "跑去买药煮粥", s: { D: 1 } }, { t: "一直握着他的手", s: { K: 1 } }] },
      { q: "收到哪样最开心", opts: [{ t: "一张手写的小纸条", s: { W: 1 } }, { t: "一个他记得你随口提过的小东西", s: { G: 1 } }, { t: "他帮你把一直拖着的事办了", s: { D: 1 } }] },
      { q: "异地的晚上", opts: [{ t: "开着视频一起做各自的事", s: { Q: 1 } }, { t: "睡前发一大段想你", s: { W: 1 } }, { t: "寄个包裹给他", s: { G: 1 } }] },
      { q: "看电影的时候", opts: [{ t: "靠在一起", s: { K: 1 } }, { t: "看完要聊很久", s: { Q: 1 } }, { t: "提前把零食饮料都买好", s: { D: 1 } }] },
      { q: "你心里「他很爱我」的证据是", opts: [{ t: "他说过的那些话", s: { W: 1 } }, { t: "他为我做过的那些事", s: { D: 1 } }, { t: "他留下的那些东西", s: { G: 1 } }, { t: "他抱我的样子", s: { K: 1 } }] }
    ]
  });

  // 4. 三观：四条轴（自我 Me／大家 Us、守规矩 R／看情况 X、求稳 St／敢闯 Ad、理想 Id／现实 Re）
  T.push({
    id: "values", cat: "xl", name: "三观", sub: "什么事在你这儿更重",
    axes: [["Me", "Us"], ["R", "X"], ["St", "Ad"], ["Id", "Re"]],
    qs: [
      { q: "家里希望你回老家，你自己想留在外面", opts: [{ t: "留下，日子是自己的", s: { Me: 1 } }, { t: "回去，家里人更要紧", s: { Us: 1 } }] },
      { q: "团队拿了奖，大半是你的功劳", opts: [{ t: "该是我的就说清楚", s: { Me: 1 } }, { t: "算大家的，不提也行", s: { Us: 1 } }] },
      { q: "深夜没车的路口，红灯", opts: [{ t: "等绿灯", s: { R: 1 } }, { t: "看没车就过", s: { X: 1 } }] },
      { q: "朋友求你帮个小忙，但这忙有点违规", opts: [{ t: "不帮，规矩就是规矩", s: { R: 1 } }, { t: "看情况，伤不着人就帮", s: { X: 1 } }] },
      { q: "一份稳定的工作，一个前途很好但可能失败的机会", opts: [{ t: "稳的", s: { St: 1 } }, { t: "去试试", s: { Ad: 1 } }] },
      { q: "手里有一笔闲钱", opts: [{ t: "存起来", s: { St: 1 } }, { t: "拿去做点什么", s: { Ad: 1 } }] },
      { q: "一件事很有意义但不赚钱", opts: [{ t: "值得做", s: { Id: 1 } }, { t: "先把饭吃饱再说", s: { Re: 1 } }] },
      { q: "「人应该为了喜欢的事活着」", opts: [{ t: "对", s: { Id: 1 } }, { t: "说得轻巧", s: { Re: 1 } }] }
    ]
  });

  // 5. 像哪种动物：猫 Ca、狗 Do、狼 Wo、狐 Fo、兔 Ra、熊 Be
  T.push({
    id: "animal", cat: "xg", name: "动物塑", sub: "要是变成一只动物，你是哪只",
    qs: [
      { q: "到了一个新地方", opts: [{ t: "先找个角落观察", s: { Ca: 1, Ra: 1 } }, { t: "到处跑跑看看", s: { Do: 1 } }, { t: "先认清谁说了算", s: { Wo: 1, Fo: 1 } }] },
      { q: "有人来摸你的头", opts: [{ t: "看心情，可能躲开", s: { Ca: 1 } }, { t: "开心，再来", s: { Do: 1, Ra: 1 } }, { t: "你谁啊", s: { Wo: 1 } }] },
      { q: "你更擅长", opts: [{ t: "察言观色，见机行事", s: { Fo: 1 } }, { t: "护着自己人", s: { Wo: 1, Be: 1 } }, { t: "让人想抱抱", s: { Ra: 1, Be: 1 } }] },
      { q: "一个人的下午", opts: [{ t: "晒太阳睡觉", s: { Ca: 1, Be: 1 } }, { t: "等谁回来", s: { Do: 1 } }, { t: "琢磨点小心思", s: { Fo: 1 } }] },
      { q: "被惹毛了", opts: [{ t: "冷着脸走开", s: { Ca: 1 } }, { t: "当场咬回去", s: { Wo: 1 } }, { t: "表面笑笑，记着", s: { Fo: 1 } }, { t: "缩起来，自己难受", s: { Ra: 1 } }] },
      { q: "喜欢一个人的时候", opts: [{ t: "绕着他转，藏不住", s: { Do: 1 } }, { t: "嘴上不说，但会出现在他附近", s: { Ca: 1 } }, { t: "认定了就一直守着", s: { Wo: 1 } }] },
      { q: "朋友眼里的你", opts: [{ t: "靠得住，像座山", s: { Be: 1 } }, { t: "聪明，有点难猜", s: { Fo: 1 } }, { t: "软软的，容易受惊", s: { Ra: 1 } }] },
      { q: "冬天", opts: [{ t: "囤好吃的，窝起来", s: { Be: 1 } }, { t: "照样出去跑", s: { Do: 1, Wo: 1 } }, { t: "找最暖的那块地方", s: { Ca: 1, Ra: 1 } }] },
      { q: "一群人里，你通常是", opts: [{ t: "带头的", s: { Wo: 1 } }, { t: "气氛组", s: { Do: 1 } }, { t: "出主意的", s: { Fo: 1 } }, { t: "被照顾的", s: { Ra: 1 } }] },
      { q: "最怕", opts: [{ t: "被关起来", s: { Wo: 1, Ca: 1 } }, { t: "被丢下", s: { Do: 1, Ra: 1 } }, { t: "被看穿", s: { Fo: 1 } }, { t: "没吃的", s: { Be: 1 } }] }
    ]
  });

  // 6. 九型人格（她 2026-10-22 加）：九种各 6 个选项指着，选得最多的那种就是
  T.push({
    id: "ennea", cat: "xg", name: "九型人格", sub: "你心里最怕什么、最想要什么",
    qs: [
      { q: "别人交给你的事做完了，你最在意", opts: [{ t: "有没有哪儿做得不够对", s: { N1: 1 } }, { t: "他满不满意", s: { N2: 1 } }, { t: "能不能拿出去说是我做的", s: { N3: 1 } }] },
      { q: "一群人吵起来了，你", opts: [{ t: "先弄明白怎么回事再开口", s: { N5: 1 } }, { t: "心里发紧，看看站哪边稳妥", s: { N6: 1 } }, { t: "只想大家别吵了", s: { N9: 1 } }] },
      { q: "最怕别人觉得你", opts: [{ t: "平平无奇，跟谁都一样", s: { N4: 1 } }, { t: "被困住了，没得玩", s: { N7: 1 } }, { t: "软，好欺负", s: { N8: 1 } }] },
      { q: "有人夸你，你最想听的是", opts: [{ t: "做得真好，挑不出毛病", s: { N1: 1 } }, { t: "你真的帮了我好多", s: { N2: 1 } }, { t: "你跟别人都不一样", s: { N4: 1 } }] },
      { q: "周末一个人在家", opts: [{ t: "翻书查资料，把一件事搞懂", s: { N5: 1 } }, { t: "列个单子，想去哪玩", s: { N7: 1 } }, { t: "躺着发呆，挺舒服", s: { N9: 1 } }] },
      { q: "碰到一个新机会", opts: [{ t: "先问清楚风险，有没有后路", s: { N6: 1 } }, { t: "上，做出点样子来", s: { N3: 1 } }, { t: "我说了算就干", s: { N8: 1 } }] },
      { q: "朋友找你诉苦", opts: [{ t: "放下手里的事陪他", s: { N2: 1 } }, { t: "帮他理理到底哪儿出了问题", s: { N1: 1 } }, { t: "听着，心里替他难受好久", s: { N4: 1 } }] },
      { q: "刚到一个新地方上班，你最先", opts: [{ t: "弄清楚怎么做才能被看到", s: { N3: 1 } }, { t: "先看着，别急着冒头", s: { N5: 1 } }, { t: "找一个靠得住的前辈", s: { N6: 1 } }] },
      { q: "心情不好的时候", opts: [{ t: "找点开心的事把它盖过去", s: { N7: 1 } }, { t: "谁惹的我就找谁", s: { N8: 1 } }, { t: "不想麻烦别人，自己消化", s: { N9: 1 } }] },
      { q: "看到桌上东西摆歪了", opts: [{ t: "忍不住摆正", s: { N1: 1 } }, { t: "没注意", s: { N9: 1 } }, { t: "觉得歪着也挺好看", s: { N4: 1 } }] },
      { q: "有人需要帮忙但没开口", opts: [{ t: "我看得出来，主动去帮", s: { N2: 1 } }, { t: "等他自己开口", s: { N5: 1 } }, { t: "自己人就帮，外人再说", s: { N8: 1 } }] },
      { q: "做选择最纠结的是", opts: [{ t: "选了这个就错过了别的", s: { N7: 1 } }, { t: "哪个更稳，不会出事", s: { N6: 1 } }, { t: "哪个更能证明我行", s: { N3: 1 } }] },
      { q: "你的包里", opts: [{ t: "有一样对你很特别的小东西，别人看不懂", s: { N4: 1 } }, { t: "都是用得上的东西", s: { N5: 1 } }, { t: "塞满了好玩的小玩意", s: { N7: 1 } }] },
      { q: "有人插队", opts: [{ t: "当面说他", s: { N8: 1 } }, { t: "心里很不舒服，这不对", s: { N1: 1 } }, { t: "算了，不差这一会儿", s: { N9: 1 } }] },
      { q: "最让你累的是", opts: [{ t: "一直被需要，顾不上自己", s: { N2: 1 } }, { t: "不知道该信谁", s: { N6: 1 } }, { t: "一直被人盯着看", s: { N5: 1 } }] },
      { q: "你最想被人记住的是", opts: [{ t: "我做成过的事", s: { N3: 1 } }, { t: "我就是我，有自己的样子", s: { N4: 1 } }, { t: "我护住了身边的人", s: { N8: 1 } }] },
      { q: "计划好的事被打乱", opts: [{ t: "那就换个更好玩的", s: { N7: 1 } }, { t: "心慌，想再确认别的会不会也变", s: { N6: 1 } }, { t: "不舒服，事情就该照规矩来", s: { N1: 1 } }] },
      { q: "跟人闹了点不愉快之后", opts: [{ t: "先去问是不是我哪儿让他不高兴了", s: { N2: 1 } }, { t: "想想怎么扳回来", s: { N3: 1 } }, { t: "先当没事，过两天就好了", s: { N9: 1 } }] }
    ]
  });

  // 7. 适合你的另一半（她 2026-10-22 加）：六种，选得最多的那种
  T.push({
    id: "partner", cat: "gx", name: "适合你的另一半", sub: "你心里那个人，大概是什么样子",
    qs: [
      { q: "你生病了，最希望对方", opts: [{ t: "熬粥喂药，一直在旁边", s: { Wa: 1 } }, { t: "讲笑话逗你，让你忘了难受", s: { Fu: 1 } }, { t: "什么也不说，就一直守着", s: { Mi: 1 } }] },
      { q: "最理想的约会", opts: [{ t: "他早就安排好了", s: { St: 1 } }, { t: "临时起意，说走就走", s: { Fu: 1 } }, { t: "就在家待着，腻在一起", s: { Ni: 1 } }] },
      { q: "吵架的时候，你希望他", opts: [{ t: "先低头哄你", s: { Wa: 1 } }, { t: "把话说清楚，对就是对", s: { Eq: 1 } }, { t: "追着你，不让你走", s: { Ni: 1 } }] },
      { q: "最让你心动的一瞬间", opts: [{ t: "他对别人很冷，只对你笑", s: { Mi: 1 } }, { t: "他认真做事的样子", s: { St: 1 } }, { t: "他接住了你每一个梗", s: { Fu: 1 } }] },
      { q: "你最受不了的是", opts: [{ t: "他太闷，没意思", s: { Fu: 1 } }, { t: "他什么都顺着你，没主见", s: { Eq: 1 } }, { t: "他忽冷忽热", s: { St: 1 } }, { t: "他不黏你", s: { Ni: 1 } }] },
      { q: "他记得你哪件事最让你心动", opts: [{ t: "你随口说过的喜好", s: { Wa: 1 } }, { t: "你们第一次见面的细节", s: { Ni: 1 } }, { t: "你说过的梦想，他还一直推着你去做", s: { Eq: 1 } }] },
      { q: "他的朋友圈", opts: [{ t: "几乎不发", s: { Mi: 1 } }, { t: "常发好玩的", s: { Fu: 1 } }, { t: "置顶的那条是你", s: { Ni: 1 } }] },
      { q: "你累了一天回到家", opts: [{ t: "灯开着，饭在锅里", s: { Wa: 1 } }, { t: "他什么都不问，安安静静陪你坐着", s: { Mi: 1 } }, { t: "他扑过来抱住你", s: { Ni: 1 } }] },
      { q: "出去玩迷路了", opts: [{ t: "他早就查好了路", s: { St: 1 } }, { t: "他说那就随便走走，说不定更好玩", s: { Fu: 1 } }, { t: "你俩争到底是谁带错的，然后一起笑", s: { Eq: 1 } }] },
      { q: "你希望他的过去", opts: [{ t: "简单干净，一眼看得到", s: { Wa: 1 } }, { t: "有一段你不知道的故事", s: { Mi: 1 } }, { t: "也有过低谷，所以能互相撑着", s: { Eq: 1 } }] },
      { q: "一起拿主意的时候", opts: [{ t: "他听你的", s: { Wa: 1 } }, { t: "吵一架，吵出个更好的", s: { Eq: 1 } }, { t: "他替你拿主意", s: { St: 1 } }, { t: "他嘴上不说，最后做的正是你想要的", s: { Mi: 1 } }] },
      { q: "他最该对你说的一句", opts: [{ t: "有我在", s: { St: 1 } }, { t: "我想你了", s: { Ni: 1 } }, { t: "你还挺厉害的", s: { Eq: 1 } }, { t: "走，带你去个地方", s: { Fu: 1 } }] }
    ]
  });

  // 8. 心理年龄（她 2026-10-22 加）：每个选项带一个岁数，取平均
  T.push({
    id: "mindage", cat: "xl", name: "心理年龄", sub: "你心里住着几岁的自己",
    qs: [
      { q: "收到礼物，你最开心的是", opts: [{ t: "拆包装那一下", s: { age: 8 } }, { t: "拍照发出去", s: { age: 18 } }, { t: "正好用得上", s: { age: 35 } }, { t: "心意到了就好", s: { age: 60 } }] },
      { q: "周末早上", opts: [{ t: "起来就看动画打游戏", s: { age: 10 } }, { t: "睡到中午", s: { age: 18 } }, { t: "照计划把事做完", s: { age: 35 } }, { t: "早起去买菜", s: { age: 55 } }] },
      { q: "路边有只猫", opts: [{ t: "蹲下去逗半天", s: { age: 8 } }, { t: "拍照", s: { age: 18 } }, { t: "看一眼，挺可爱", s: { age: 35 } }, { t: "想着它冷不冷饿不饿", s: { age: 60 } }] },
      { q: "跟人闹了矛盾", opts: [{ t: "哭，或者闹", s: { age: 8 } }, { t: "生闷气，发条朋友圈", s: { age: 18 } }, { t: "找个时间说开", s: { age: 35 } }, { t: "算了，不值得", s: { age: 65 } }] },
      { q: "钱这件事", opts: [{ t: "有就花", s: { age: 10 } }, { t: "攒着买喜欢的", s: { age: 20 } }, { t: "按月存，有规划", s: { age: 38 } }, { t: "能省就省，以防万一", s: { age: 60 } }] },
      { q: "你最常挂在嘴边的", opts: [{ t: "好耶 / 不要", s: { age: 8 } }, { t: "绝了 / 救命", s: { age: 18 } }, { t: "行，我来", s: { age: 35 } }, { t: "都行，随缘", s: { age: 60 } }] },
      { q: "新年愿望", opts: [{ t: "想要一样东西", s: { age: 8 } }, { t: "变好看，谈个恋爱", s: { age: 18 } }, { t: "升职加薪", s: { age: 38 } }, { t: "家里人平平安安", s: { age: 60 } }] },
      { q: "一个人的晚上", opts: [{ t: "抱着玩偶看动画", s: { age: 8 } }, { t: "刷手机到半夜", s: { age: 18 } }, { t: "看书，学点东西", s: { age: 35 } }, { t: "泡脚早睡", s: { age: 60 } }] },
      { q: "听到一首老歌", opts: [{ t: "不知道是谁唱的", s: { age: 10 } }, { t: "有点土", s: { age: 18 } }, { t: "想起某段日子", s: { age: 38 } }, { t: "跟着哼，眼眶有点热", s: { age: 60 } }] },
      { q: "做错了事", opts: [{ t: "先藏起来", s: { age: 8 } }, { t: "找个理由", s: { age: 18 } }, { t: "认了，想办法补", s: { age: 35 } }, { t: "看得开，谁没错过", s: { age: 60 } }] },
      { q: "别人跟你吐槽", opts: [{ t: "听不太懂，先抱抱", s: { age: 8 } }, { t: "跟着一起骂", s: { age: 16 } }, { t: "帮他出主意", s: { age: 35 } }, { t: "听着，说一句都会过去的", s: { age: 60 } }] },
      { q: "人这辈子最要紧的", opts: [{ t: "开心", s: { age: 10 } }, { t: "被喜欢", s: { age: 18 } }, { t: "活出个样子", s: { age: 35 } }, { t: "平安健康", s: { age: 60 } }] }
    ]
  });

  // 9. 大五人格（她 2026-10-22「做吧宝宝」）：五条线，每条三题，选「高」那头的算一分
  T.push({
    id: "bigfive", cat: "xg", name: "大五人格", sub: "五条线，看你在每一条上站在哪儿",
    qs: [
      { q: "去一家常吃的店", opts: [{ t: "点每次都点的那道", s: {} }, { t: "试一道没吃过的", s: { O: 1 } }] },
      { q: "答应别人的小事", opts: [{ t: "一定记着办", s: { C: 1 } }, { t: "经常转头就忘", s: {} }] },
      { q: "一桌人吃饭", opts: [{ t: "话最多的那个是我", s: { E: 1 } }, { t: "我多半在听", s: {} }] },
      { q: "朋友找你借钱", opts: [{ t: "能帮就帮", s: { A: 1 } }, { t: "先问清楚为什么", s: {} }] },
      { q: "发出去的消息对方半天没回", opts: [{ t: "会翻来覆去地想", s: { N: 1 } }, { t: "没回就没回", s: {} }] },
      { q: "朋友推荐一部看不懂的怪电影", opts: [{ t: "算了，不是我的菜", s: {} }, { t: "越看不懂越想看", s: { O: 1 } }] },
      { q: "出门之前", opts: [{ t: "钥匙手机钱包检查一遍", s: { C: 1 } }, { t: "抓起就走", s: {} }] },
      { q: "周五晚上", opts: [{ t: "出去找点乐子", s: { E: 1 } }, { t: "在家最舒服", s: {} }] },
      { q: "别人跟你想得不一样", opts: [{ t: "先想想他为什么这么想", s: { A: 1 } }, { t: "直接说他不对", s: {} }] },
      { q: "睡觉之前", opts: [{ t: "常把今天的事过一遍，睡不着", s: { N: 1 } }, { t: "躺下就睡", s: {} }] },
      { q: "你更常琢磨", opts: [{ t: "明天要做的事", s: {} }, { t: "一些没答案的问题", s: { O: 1 } }] },
      { q: "一件事做到一半很无聊", opts: [{ t: "咬牙做完", s: { C: 1 } }, { t: "先放着，以后再说", s: {} }] },
      { q: "有事要问人", opts: [{ t: "直接打电话", s: { E: 1 } }, { t: "能发消息就不打电话", s: {} }] },
      { q: "排队有人插到你前面", opts: [{ t: "算了", s: { A: 1 } }, { t: "当面说他", s: {} }] },
      { q: "一点小事出了岔子", opts: [{ t: "心情坏一整天", s: { N: 1 } }, { t: "过一会儿就忘了", s: {} }] }
    ]
  });

  // 10. 吵架的时候你是哪种（她 2026-10-22）：五种，各 6 个选项指着
  T.push({
    id: "fight", cat: "gx", name: "吵架的时候你是哪种", sub: "吵起来的那一刻，你会往哪边走",
    qs: [
      { q: "吵着吵着，对方声音大了", opts: [{ t: "我也大起来，吵到底", s: { Cl: 1 } }, { t: "翻出他上次的事", s: { Ol: 1 } }, { t: "先软下来", s: { So: 1 } }] },
      { q: "吵到一半", opts: [{ t: "说「你上次也是这样」", s: { Ol: 1 } }, { t: "起身走开", s: { Es: 1 } }, { t: "把话一句一句掰清楚", s: { Cl: 1 } }] },
      { q: "吵完的那天晚上", opts: [{ t: "等他先来找我", s: { Co: 1 } }, { t: "我先发消息道歉", s: { So: 1 } }, { t: "当作没发生过", s: { Es: 1 } }] },
      { q: "吵架时你最常说的一句", opts: [{ t: "你什么意思", s: { Cl: 1 } }, { t: "随便你", s: { Co: 1 } }, { t: "你每次都这样", s: { Ol: 1 } }] },
      { q: "发现其实是自己错了", opts: [{ t: "马上认", s: { So: 1 } }, { t: "嘴上不认，行动上改", s: { Co: 1 } }, { t: "转移话题", s: { Es: 1 } }] },
      { q: "对方翻你旧账", opts: [{ t: "我也翻他的", s: { Ol: 1 } }, { t: "说清楚那次到底怎么回事", s: { Cl: 1 } }, { t: "不吭声", s: { Es: 1 } }] },
      { q: "吵架的时候最怕", opts: [{ t: "话没说完就被打断", s: { Cl: 1 } }, { t: "把关系吵坏了", s: { So: 1 } }, { t: "被逼着当场表态", s: { Es: 1 } }] },
      { q: "冷静下来以后", opts: [{ t: "吵过的每句话都记很久", s: { Ol: 1 } }, { t: "几天都不想理他", s: { Co: 1 } }, { t: "先抱一下再说", s: { So: 1 } }] },
      { q: "有人劝你们和好", opts: [{ t: "我又没错", s: { Co: 1 } }, { t: "那我先低个头", s: { So: 1 } }, { t: "别管我，我出去走走", s: { Es: 1 } }] },
      { q: "吵完之后你心里", opts: [{ t: "一笔一笔都记着", s: { Ol: 1 } }, { t: "想立刻说开", s: { Cl: 1 } }, { t: "早就不气了，只是拉不下脸", s: { Co: 1 } }] }
    ]
  });

  // 11. 你小时候是个什么样的小孩（她 2026-10-22）
  T.push({
    id: "child", cat: "xl", name: "你小时候是个什么样的小孩", sub: "那个小孩，现在还在你身上吗",
    qs: [
      { q: "放学回家第一件事", opts: [{ t: "写作业", s: { Gd: 1 } }, { t: "出去疯", s: { Pl: 1 } }, { t: "躲进自己房间", s: { Qt: 1 } }] },
      { q: "家里大人吵架", opts: [{ t: "去哄他们", s: { Wr: 1 } }, { t: "躲起来", s: { Qt: 1 } }, { t: "哭着要人抱", s: { Sp: 1 } }] },
      { q: "老师眼里的你", opts: [{ t: "最省心的那个", s: { Gd: 1 } }, { t: "最让人头疼的那个", s: { Pl: 1 } }, { t: "没什么存在感的那个", s: { Qt: 1 } }] },
      { q: "想要一样东西", opts: [{ t: "撒个娇就有了", s: { Sp: 1 } }, { t: "自己攒钱买", s: { Wr: 1 } }, { t: "不敢开口", s: { Qt: 1 } }] },
      { q: "你的玩具", opts: [{ t: "收得整整齐齐", s: { Gd: 1 } }, { t: "全都拆过", s: { Pl: 1 } }, { t: "让给弟弟妹妹了", s: { Wr: 1 } }] },
      { q: "生病的时候", opts: [{ t: "全家围着我转", s: { Sp: 1 } }, { t: "自己吃药，怕大人担心", s: { Wr: 1 } }, { t: "正好不用上学", s: { Pl: 1 } }] },
      { q: "小时候最常听到的一句", opts: [{ t: "这孩子真懂事", s: { Wr: 1 } }, { t: "又闯祸了", s: { Pl: 1 } }, { t: "这孩子真乖", s: { Gd: 1 } }] },
      { q: "过年见亲戚", opts: [{ t: "上去表演节目", s: { Sp: 1 } }, { t: "规规矩矩叫人", s: { Gd: 1 } }, { t: "躲在大人身后", s: { Qt: 1 } }] },
      { q: "摔了一跤", opts: [{ t: "大哭，等人来", s: { Sp: 1 } }, { t: "爬起来接着跑", s: { Pl: 1 } }, { t: "怕被骂，偷偷把伤藏起来", s: { Wr: 1 } }] },
      { q: "你的秘密基地", opts: [{ t: "自己的书桌", s: { Gd: 1 } }, { t: "衣柜里、被子里", s: { Qt: 1 } }, { t: "大人的怀里", s: { Sp: 1 } }] }
    ]
  });

  // 12. 你是江湖里的哪一号人（她 2026-10-22）
  T.push({
    id: "jianghu", cat: "wan", name: "你是江湖里的哪一号人", sub: "要是活在武侠里，你是谁",
    qs: [
      { q: "路见不平", opts: [{ t: "拔刀就上", s: { Xi: 1 } }, { t: "记下这笔账，日后再算", s: { Ma: 1 } }, { t: "看一眼就走", s: { Ys: 1 } }] },
      { q: "你的兵器", opts: [{ t: "一把剑", s: { Xi: 1 } }, { t: "一套银针", s: { Sh: 1 } }, { t: "一张嘴", s: { Sw: 1 } }] },
      { q: "手下有一百个人", opts: [{ t: "带他们闯出个名堂", s: { Ba: 1 } }, { t: "让他们都怕我", s: { Ma: 1 } }, { t: "散了吧，我一个人自在", s: { Ys: 1 } }] },
      { q: "有人受了伤倒在路边", opts: [{ t: "先救人", s: { Sh: 1 } }, { t: "先问是谁干的", s: { Xi: 1 } }, { t: "把这事编成故事讲出去", s: { Sw: 1 } }] },
      { q: "你住在", opts: [{ t: "深山里", s: { Ys: 1 } }, { t: "总舵", s: { Ba: 1 } }, { t: "茶馆楼上", s: { Sw: 1 } }] },
      { q: "被人背叛了", opts: [{ t: "不死不休", s: { Ma: 1 } }, { t: "让他走，此生不见", s: { Ys: 1 } }, { t: "替他把伤治好，两清", s: { Sh: 1 } }] },
      { q: "江湖上提起你", opts: [{ t: "说你仗义", s: { Xi: 1 } }, { t: "说你可怕", s: { Ma: 1 } }, { t: "说你什么都知道", s: { Sw: 1 } }] },
      { q: "你最想要", opts: [{ t: "天下太平", s: { Xi: 1 } }, { t: "一帮好兄弟", s: { Ba: 1 } }, { t: "没人来打扰", s: { Ys: 1 } }] },
      { q: "打不过的时候", opts: [{ t: "先退，留着命", s: { Sh: 1 } }, { t: "喊兄弟来", s: { Ba: 1 } }, { t: "动点歪心思", s: { Ma: 1 } }] },
      { q: "你的口头禅", opts: [{ t: "救人要紧", s: { Sh: 1 } }, { t: "听我说个故事", s: { Sw: 1 } }, { t: "都听我的", s: { Ba: 1 } }] },
      { q: "夜里睡不着", opts: [{ t: "上屋顶喝酒", s: { Xi: 1 } }, { t: "磨刀", s: { Ma: 1 } }, { t: "把今天听来的事记下来", s: { Sw: 1 } }] },
      { q: "退隐以后", opts: [{ t: "开个医馆", s: { Sh: 1 } }, { t: "收几个徒弟", s: { Ba: 1 } }, { t: "种田钓鱼", s: { Ys: 1 } }] }
    ]
  });

  // ── 分类（她 2026-10-22「搞个分类，不用上下疯狂划」）：内置的写在每套的 cat 上；她出的、他出的落进「自己出的」，也能自己挑一类
  const CATS = [["all", "全部", "✧"], ["xg", "性格", "?"], ["gx", "关系", "♡"], ["xl", "心里", "◷"], ["wan", "好玩", "✦"], ["mine", "自己出的", "✎"]];
  function catOf(t) { const c = t && t.cat; return ["xg", "gx", "xl", "wan"].indexOf(c) >= 0 ? c : (t && t.custom ? "mine" : "wan"); }

  // ── 结果 ─────────────────────────────────────────────────
  const MBTI_NAME = {
    INTJ: "安静的谋划家", INTP: "爱钻牛角尖的思考者", ENTJ: "天生带队的人", ENTP: "爱抬杠的点子王",
    INFJ: "看得很深的守望者", INFP: "心里有片海的理想派", ENFJ: "照顾所有人的那个", ENFP: "停不下来的热情鬼",
    ISTJ: "说到做到的老实人", ISFJ: "默默把事做好的守护者", ESTJ: "把日子管得井井有条的人", ESFJ: "热络周到的张罗者",
    ISTP: "动手比说话快的人", ISFP: "安静的感受派", ESTP: "说走就走的行动派", ESFP: "走到哪热闹到哪"
  };
  const ATTACH = {
    secure: ["安心型", "靠得近也站得稳：信得过对方，也信得过自己"],
    anxious: ["想要确认型", "很在乎，所以常常想再确认一次"],
    avoid: ["留一扇门型", "亲近可以，但心里要给自己留个地方"],
    fearful: ["想靠近又怕型", "想要人陪，又怕靠得太近会受伤"]
  };
  const LOVE = { Q: "陪着你", W: "说给你听", G: "带给你", D: "替你做", K: "抱住你" };
  const VALUES = { Me: "先顾好自己", Us: "先顾好大家", R: "守规矩", X: "看情况", St: "求稳", Ad: "敢闯", Id: "信理想", Re: "看现实" };
  const ENNEA = {
    N1: ["1 号 · 完美型", "心里有一把尺，想把事做对，也对自己最严"], N2: ["2 号 · 助人型", "总先顾着别人，被需要的时候最安心"],
    N3: ["3 号 · 成就型", "想做成点什么，也想被看见做成了"], N4: ["4 号 · 自我型", "想被真正懂，最怕活得跟谁都一样"],
    N5: ["5 号 · 观察型", "先看懂再开口，需要一块自己的地方"], N6: ["6 号 · 忠诚型", "想要靠得住的人和事，心里常备着后路"],
    N7: ["7 号 · 活跃型", "想把日子过得好玩，不想被困住"], N8: ["8 号 · 领袖型", "自己扛着走，护着自己人，不肯示弱"],
    N9: ["9 号 · 和平型", "不想起冲突，让大家都舒服，自己往后放"]
  };
  const PARTNER = {
    Wa: ["温柔、会照顾人的那种", "你需要一个把你放在心上、把日子打理暖的人"], Fu: ["有趣、能陪你一起疯的那种", "跟他在一起，日子不会无聊"],
    St: ["沉稳、靠得住的那种", "有他在，天塌下来你也不慌"], Mi: ["有点难懂、让人想靠近的那种", "他不多说，但你越看越想懂他"],
    Eq: ["跟你势均力敌的那种", "能吵能和好，互相推着往前走"], Ni: ["黏人、把你当全世界的那种", "你想要被很满很满地需要"]
  };
  const B5 = { O: ["好奇", "对没见过的东西总想碰一碰", "喜欢熟悉的、稳妥的"], C: ["靠谱", "说了就会做到", "随性，走一步看一步"], E: ["外向", "人多的地方你最有劲", "一个人待着最充电"],
    A: ["随和", "先替别人着想", "有话直说，不太顺着别人"], N: ["敏感", "心里的事放不太下", "什么事都看得开"] };
  const B5_LV = ["低", "偏低", "偏高", "高"];
  const FIGHT = { Cl: ["当场说清型", "吵就吵明白，话不说完不罢休"], Co: ["冷战型", "嘴上不说，用沉默等对方先低头"], So: ["先认错型", "比起输赢，更怕把人吵没了"],
    Ol: ["翻旧账型", "每一笔都记得，吵着吵着就全翻出来"], Es: ["躲开型", "吵不下去就走，等风头过了再说"] };
  const CHILD = { Gd: ["乖小孩", "省心、守规矩，大人一放就放心"], Pl: ["皮小孩", "闯祸最多，笑得也最多"], Qt: ["闷小孩", "躲在角落里，自己跟自己玩"],
    Wr: ["小大人", "很早就懂事，先顾着大人的情绪"], Sp: ["被宠着的小孩", "摔一跤就有人来抱"] };
  const JIANGHU = { Xi: ["侠客", "路见不平就拔刀"], Ma: ["魔头", "谁惹了你，你都记着"], Ys: ["隐士", "江湖的事，你只想远远看着"],
    Sh: ["神医", "先救人，别的再说"], Sw: ["说书人", "江湖上什么事都瞒不过你"], Ba: ["帮主", "有你在，兄弟们就有地方去"] };
  const topOf = (map, sc) => Object.keys(map).sort((a, b) => (sc[b] || 0) - (sc[a] || 0))[0];
  const ANIMAL = {
    Ca: ["猫", "有自己的脾气，愿意靠近的时候才靠近"], Do: ["狗", "热乎乎的，喜欢就绕着转"], Wo: ["狼", "认定了就守着，对外人冷"],
    Fo: ["狐狸", "聪明，心思多，不太好猜"], Ra: ["兔子", "软，容易受惊，被护着会很乖"], Be: ["熊", "慢吞吞的，可靠，抱起来很暖"]
  };
  function tally(test, picks) {
    const sc = {};
    (picks || []).forEach((p, i) => { const q = test.qs[i]; const o = q && q.opts[p]; if (o) Object.keys(o.s).forEach(k => { sc[k] = (sc[k] || 0) + o.s[k]; }); });
    return sc;
  }
  // 平分时取前一个（题数是偶数的那几套才可能平）
  const pickAxis = (sc, a, b) => ((sc[a] || 0) >= (sc[b] || 0) ? a : b);
  function resultOf(testId, picks) {
    const test = byId(testId); if (!test) return null;
    if (test.custom) return customResult(test, picks);
    const sc = tally(test, picks);
    if (testId === "mbti") {
      const code = test.axes.map(([a, b]) => pickAxis(sc, a, b)).join("");
      // 四个字母要露出来（她 2026-10-22「实际 mbti 也没显示出来」）：卡上、结果框里都只摆 title
      return { code, title: code + " · " + (MBTI_NAME[code] || code), line: "" };
    }
    if (testId === "attach") {
      const n = test.qs.length, A = (sc.A || 0) / n, V = (sc.V || 0) / n;
      const k = A >= 0.7 && V >= 0.5 ? "fearful" : A >= 0.7 ? "anxious" : V >= 0.6 ? "avoid" : "secure";
      return { code: k, title: ATTACH[k][0], line: ATTACH[k][1] };
    }
    if (testId === "love") {
      const order = Object.keys(LOVE).sort((a, b) => (sc[b] || 0) - (sc[a] || 0));
      return { code: order[0], title: "最会" + LOVE[order[0]], line: "其次是" + LOVE[order[1]] };
    }
    if (testId === "values") {
      const tags = test.axes.map(([a, b]) => VALUES[pickAxis(sc, a, b)]);
      return { code: test.axes.map(([a, b]) => pickAxis(sc, a, b)).join("-"), title: tags.join(" · "), line: "" };
    }
    if (testId === "ennea") {
      const order = Object.keys(ENNEA).sort((a, b) => (sc[b] || 0) - (sc[a] || 0));
      return { code: order[0], title: ENNEA[order[0]][0], line: ENNEA[order[0]][1] };
    }
    if (testId === "partner") {
      const order = Object.keys(PARTNER).sort((a, b) => (sc[b] || 0) - (sc[a] || 0));
      return { code: order[0], title: "适合你的是：" + PARTNER[order[0]][0], line: PARTNER[order[0]][1] };
    }
    if (testId === "mindage") {
      const n = (picks || []).filter((p, i) => test.qs[i] && test.qs[i].opts[p]).length || 1;
      const age = Math.round((sc.age || 0) / n);
      const line = age < 14 ? "心里住着个小孩" : age < 24 ? "还在青春里" : age < 40 ? "刚刚好的大人" : age < 55 ? "早熟的老灵魂" : "看透了的老人家";
      return { code: String(age), title: "心理年龄 " + age + " 岁", line };
    }
    if (testId === "bigfive") {
      const keys = Object.keys(B5), lv = k => Math.max(0, Math.min(3, sc[k] || 0));
      const far = keys.slice().sort((a, b) => Math.abs(lv(b) - 1.5) - Math.abs(lv(a) - 1.5))[0];
      return { code: keys.map(k => k + lv(k)).join(""), title: keys.map(k => B5[k][0] + B5_LV[lv(k)]).join(" · "), line: "最明显的一条：" + (lv(far) >= 2 ? B5[far][1] : B5[far][2]) };
    }
    if (testId === "fight") { const k = topOf(FIGHT, sc); return { code: k, title: FIGHT[k][0], line: FIGHT[k][1] }; }
    if (testId === "child") { const k = topOf(CHILD, sc); return { code: k, title: "小时候是个" + CHILD[k][0], line: CHILD[k][1] }; }
    if (testId === "jianghu") { const k = topOf(JIANGHU, sc); return { code: k, title: "江湖里你是：" + JIANGHU[k][0], line: JIANGHU[k][1] }; }
    if (testId === "animal") {
      const order = Object.keys(ANIMAL).sort((a, b) => (sc[b] || 0) - (sc[a] || 0));
      return { code: order[0], title: "像一只" + ANIMAL[order[0]][0], line: ANIMAL[order[0]][1] };
    }
    if (test.custom) return customResult(test, picks);
    return null;
  }
  function byId(id) { return T.find(t => t.id === id) || customs().find(t => t.id === id) || null; }

  // ── 自己出的题（她 2026-10-22「可以自己自定义题目或者给主题让ai生成一套题然后可以编辑」「ab可以选」）──
  //   { id:"zc_…", custom:true, name, sub, scored, results:[{title,line}], qs:[{ q, opts:[{ t, r }] }] }
  //   scored＝算分：每个选项 r 指向一个结果，选得最多的那个就是测出来的；不算分＝做完了由他自己说一句。
  const CKEY = "x_zhaoyingTests";
  function customs() { try { const v = typeof loadJSON === "function" ? loadJSON(CKEY, []) : []; return Array.isArray(v) ? v.filter(t => t && t.id && Array.isArray(t.qs)) : []; } catch (e) { return []; } }
  function cleanTest(t) {
    const results = (t.results || []).map(r => ({ title: String((r && r.title) || "").trim().slice(0, 30), line: String((r && r.line) || "").trim().slice(0, 80) })).filter(r => r.title).slice(0, 8);
    const scored = !!t.scored && results.length >= 2;
    const qs = (t.qs || []).map(q => ({ q: String((q && q.q) || "").trim().slice(0, 120),
      opts: ((q && q.opts) || []).map(o => ({ t: String((o && o.t) || "").trim().slice(0, 60), r: scored ? Math.max(0, Math.min(results.length - 1, Number(o && o.r) || 0)) : undefined })).filter(o => o.t).slice(0, 4) }))
      .filter(q => q.q && q.opts.length >= 2).slice(0, 30);
    return { id: t.id || "zc_" + Date.now().toString(36), custom: true, name: String(t.name || "").trim().slice(0, 20) || "我出的题", sub: String(t.sub || "").trim().slice(0, 60), scored, results: scored ? results : [], qs,
      ...(t.by ? { by: String(t.by) } : {}), ...(["xg", "gx", "xl", "wan"].indexOf(t.cat) >= 0 ? { cat: t.cat } : {}) };
  }
  function saveCustom(t) { const c = cleanTest(t); if (!c.qs.length) return null; const l = customs().filter(x => x.id !== c.id); saveJSON(CKEY, [...l, c]); return c; }
  function delCustom(id) { saveJSON(CKEY, customs().filter(x => x.id !== id)); }
  function allTests() { return T.concat(customs()); }
  function customResult(test, picks) {
    if (!test.scored) return { code: "", title: "", line: "", free: true };
    const n = test.results.map(() => 0);
    (picks || []).forEach((p, i) => { const o = test.qs[i] && test.qs[i].opts[p]; if (o && n[o.r] != null) n[o.r]++; });
    let k = 0; n.forEach((v, i) => { if (v > n[k]) k = i; });
    return { code: String(k), title: test.results[k].title, line: test.results[k].line };
  }
  // 给个主题，用她那条线路出一套（出完进编辑页，她改好了才存）
  async function genTest(route, theme, count, scored) {
    const n = Math.max(4, Math.min(20, Number(count) || 10));
    const sys = "你给一个手机里的小测出题。主题：" + String(theme || "").trim() + "。出 " + n + " 道题，每题 2 到 4 个选项。"
      + "题面是日常里会碰到的具体场景或问题，口语，短；选项是人在那个场景里真的会有的不同反应，彼此拉得开，不让人一眼看出哪个是标准答案，也不出现术语。"
      + (scored ? "先定 3 到 5 种结果，每种一个短名字和一句说明；每个选项用 r 标它更指向第几种结果（从 0 数），让每种结果在各题里都有选项指向。" : "这套不算分，不用写结果。")
      + "\n只输出 JSON，不要代码块：{\"name\":\"这套题的名字\",\"sub\":\"一句话说测什么\"," + (scored ? "\"results\":[{\"title\":\"\",\"line\":\"\"}]," : "") + "\"qs\":[{\"q\":\"\",\"opts\":[{\"t\":\"\"" + (scored ? ",\"r\":0" : "") + "}]}]}";
    const raw = await callAI(route, sys, [{ role: "user", content: "出题。" }], { maxTokens: 12000, timeout: 120000 });
    const d = parseJSONLoose(raw) || {};
    const t = cleanTest(Object.assign({}, d, { id: "", scored }));
    t.id = "";
    if (!t.qs.length) throw new Error("没出成题");
    return t;
  }

  // ── 存档：{ [who]: [{ id, testId, ts, picks:[], whys:[], code, title, line }] }，who＝角色 id 或 "me" ──
  const loadAll = () => { try { const v = typeof loadJSON === "function" ? loadJSON(KEY, {}) : JSON.parse(localStorage.getItem(KEY) || "{}"); return v && typeof v === "object" ? v : {}; } catch (e) { return {}; } };
  const saveAll = v => { try { if (typeof saveJSON === "function") saveJSON(KEY, v); else localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {} };
  function recordsOf(who, testId) {
    const l = (loadAll()[who] || []).slice().sort((a, b) => b.ts - a.ts);
    return testId ? l.filter(r => r.testId === testId) : l;
  }
  function addRecord(who, rec) {
    const all = loadAll();
    all[who] = [Object.assign({ id: "zy_" + Date.now().toString(36) }, rec), ...(all[who] || [])].slice(0, 60);
    saveAll(all);
  }
  function delRecord(who, id) { const all = loadAll(); all[who] = (all[who] || []).filter(r => r.id !== id); saveAll(all); }

  const dateZh = ts => { const d = new Date(ts); return (d.getMonth() + 1) + "月" + d.getDate() + "日"; };
  const optText = (test, i, p) => { const o = test.qs[i] && test.qs[i].opts[p]; return o ? o.t : ""; };

  // 聊天时他知道的那一行（她 2026-10-22：「就他能看到结果并且知道自己选了啥」）：
  //   每套只摆最近一次，带上那次每题选了什么；更早的只报个结果。写的是「你做过这些」，不是「你是谁」。
  function chatNote(charId) {
    const l = recordsOf(charId); if (!l.length) return "";
    const seen = {};
    const lines = [];
    l.forEach(r => {
      const t = byId(r.testId); if (!t) return;
      if (seen[r.testId]) { seen[r.testId].push(dateZh(r.ts) + "「" + r.title + "」"); return; }
      seen[r.testId] = [];
      const picks = (r.picks || []).map((p, i) => (i + 1) + "." + optText(t, i, p).slice(0, 14)).join("；");
      lines.push({ t, r, picks });
    });
    return "你做过照影里的小测（这是你自己做过的事，结果只是那次测出来的，不用照着它演）：\n" + lines.map(x =>
      "·「" + x.t.name + "」" + dateZh(x.r.ts) + " 测出「" + x.r.title + "」" + (x.r.scene ? "（那次的前提是：" + x.r.scene + "）" : "") + (seen[x.t.id].length ? "（更早几次：" + seen[x.t.id].slice(0, 3).join("、") + "）" : "") + "。那次你选的：" + x.picks).join("\n");
  }

  // 让他做一套题的那一段（照影页里调 runProbe）
  // scene：她给这一次定的处境（她 2026-10-22「换个处境再做」）——同一套题，在那个前提下的你会怎么选
  function askInstruction(test, meName, prev, scene) {
    return "你在手机上做一套小测「" + test.name + "」（" + test.sub + "）。一题一题照你自己真实的样子选——不是挑看起来好的那个，也不是猜出题人想要什么。"
      + (scene ? "\n这一次有个前提：" + String(scene).slice(0, 60) + "。照这个前提下的你来答，心声里也是那时候的你；跟平时一样的题就一样，不为了显得不同硬改。" : "")
      + "每题最后落定一个选项。steps 是你手指在这一题上的过程：手指移到一个选项上、按下去，那一刻脑子里一闪而过的东西写在 think——"
      // 心声别写成分析（她 2026-10-22「心声太像模型分析了」：一句句都是「我这人向来…」「我最在乎…」，像在给自己写人物小传）
      + "是你真在想事情时冒出来的那种：想到了哪个人、哪件事、哪个画面，或者只是一句嘀咕。它不是给自己下定义，也不是解释你是什么样的人、为什么这么选；有的题根本不用想，那就一两个字。第一人称，照你平时说话的口气。"
      // 纠结的人可以来回好几次（她 2026-10-22「有些角色可能会来回选好几次纠结的吧」）：原来卡在两到四步，最多改一两回
      + "大多数题一步就定。只有你这个人在这题上真的会拿不准、会反复的时候，才写多步：按了一个又改到另一个，在两三个之间来回、改过去又改回来，最多六下；每一下心里冒的东西可以不一样。最后一步就是你最终选的。犹不犹豫、来回几次照你的性子来，不为了好看硬晃，也不为了干脆硬压。"
      + (meName ? "这是「" + meName + "」让你做的，她会看到你每一题选了什么、为什么。" : "")
      + (prev && prev.length ? "\n你以前做过这套：" + prev.slice(0, 3).map(r => dateZh(r.ts) + "测出「" + r.title + "」").join("；") + "。这次照你现在的样子答，变了就变了，没变也不用硬改。" : "")
      + (test.custom && !test.scored ? "\n这套不算分。全部做完后，feel 写你做完这一套的感觉，一两句，照你自己说话的样子。" : "")
      // 结果下面那段评语（她 2026-10-22「写一小段评语，每个角色就算答案一样评语也不一样」）：同一次调用里一起写，不多花一枪
      + "\nreview 是另一件事：测试页面在结果下面给做题这个人写的一小段解读，三四句，用「他」称呼你、口气是测试页面的口气，不是你自己说话。只照你这一次每题怎么选、哪几题来回改过、心声里露出来的东西写，点到具体的题；别写这一类人谁都对得上的话。"
      + "\n题目：\n" + test.qs.map((q, i) => (i + 1) + ". " + q.q + "\n" + q.opts.map((o, j) => "   " + j + ") " + o.t).join("\n")).join("\n");
  }
  const ASK_SCHEMA = "{\"answers\":[{\"i\":1,\"steps\":[{\"at\":0,\"think\":\"按下这一项时心里的话\"}]}],\"review\":\"结果下面的评语\"}";
  function askSchema(test) { return test && test.custom && !test.scored ? ASK_SCHEMA.replace(/\}$/, ",\"feel\":\"做完的感觉\"}") : ASK_SCHEMA; }
  function readAnswers(test, d) {
    const arr = Array.isArray(d && d.answers) ? d.answers : Array.isArray(d) ? d : [];
    const picks = [], whys = [], paths = [];
    const ok = (q, v) => { const n = Number(v); return n >= 0 && n < q.opts.length && Math.floor(n) === n; };
    test.qs.forEach((q, i) => {
      const a = arr.find(x => x && Number(x.i) === i + 1) || arr[i] || {};
      let st = (Array.isArray(a.steps) ? a.steps : []).filter(x => x && ok(q, x.at)).slice(0, 6)
        .map(x => ({ at: Number(x.at), think: String(x.think || "").trim().slice(0, 160) }));
      if (!st.length) { const p = ok(q, a.pick) ? Number(a.pick) : Math.floor(Math.random() * q.opts.length); st = [{ at: p, think: String(a.why || "").trim().slice(0, 160) }]; }
      picks.push(st[st.length - 1].at); paths.push(st);
      whys.push(st.map(x => x.think).filter(Boolean).join(" "));
    });
    return { picks, whys, paths, feel: String((d && d.feel) || "").trim().slice(0, 120), review: String((d && d.review) || "").trim().slice(0, 400) };
  }

  // ── 聊天里那张卡（她 2026-10-22：「点进去再按头像选人发卡到聊天让他做」）──────────
  //   kind:"zyask"＝她发去的邀请：他做的时候写「在做…」，做完了点开就是看他做（ZhaoyingWatch）；
  //   kind:"zyshare"＝早先转发过去的结果卡，照旧能显示。
  const PAPER = "#f6f1ea", INK = "#3b332a", FOG = "#9a8a76", LINE = "#e2d8ca", ACC = "#b0764a";
  // 每套一个颜色和大符号：照影页的封面和聊天里那张卡共用这一份
  const PAL = { mbti: { a: "#f3d9c8", b: "#d9a38a", deep: "#b5674a", g: "?" }, attach: { a: "#dfe3ef", b: "#a9b3d3", deep: "#5f6d9e", g: "⇄" },
    love: { a: "#f6d6dc", b: "#e29aa8", deep: "#c05a6f", g: "♡" }, values: { a: "#e3e8d6", b: "#b3c094", deep: "#6f8150", g: "⚖" }, animal: { a: "#f1e3c4", b: "#d8b778", deep: "#a27b2f", g: "✦" },
    ennea: { a: "#e6dcef", b: "#b9a3d3", deep: "#6e5596", g: "9" }, partner: { a: "#f7dfd3", b: "#e8a98f", deep: "#b4593d", g: "∞" }, mindage: { a: "#dcece8", b: "#9fcbbf", deep: "#3f7f70", g: "◷" },
    bigfive: { a: "#e2e6ee", b: "#a8b5cc", deep: "#4f6187", g: "≋" }, fight: { a: "#f5dad6", b: "#e09c92", deep: "#a84b3f", g: "↯" },
    child: { a: "#fbe9cf", b: "#efc68a", deep: "#a36d24", g: "☁" }, jianghu: { a: "#e4e0d6", b: "#b8ad93", deep: "#6b5c3c", g: "剑" } };
  const PAL_C = [PAL.love, PAL.attach, PAL.values, PAL.animal, PAL.mbti];
  function pal(tt) { const id = String((tt && tt.id) || ""); return PAL[id] || Object.assign({}, PAL_C[id.split("").reduce((a, ch) => a + ch.charCodeAt(0), 0) % PAL_C.length], { g: String((tt && tt.name) || "？").slice(0, 1) }); }
  // 聊天里那张卡（她 2026-10-22「这张卡好丑修一修」）：跟照影页封面同一套——这一套的颜色、大符号、名字，下面一颗状态签
  function card(m) {
    const h = g.React && g.React.createElement; if (!h) return null;
    const z = (m && m.zy) || {};
    const ask = m && m.kind === "zyask";
    const st = z.status;
    const tap = ask && st === "done" && typeof g.__zyOpen === "function" ? () => g.__zyOpen(m) : null;
    const tt = byId(z.testId) || { id: z.testId || z.testName, name: z.testName };
    const c = pal(tt);
    const big = ask ? (st === "done" ? (z.title || "做完了") : st === "failed" ? "这次没做成" : st === "doing" ? "在做…" : "想让你做这一套") : (z.title || "");
    const foot = ask ? (st === "done" ? "点开看他怎么选的 ›" : st === "failed" ? "回照影再发一次" : st === "wait" ? "等你按回复，他就开始做" : "做完了会在这儿亮起来") : "—— " + (z.who || "") + " 测的";
    return h("div", { "data-wk": "zyshare", "data-kind": ask ? "ask" : "result", "data-status": st || "", onClick: tap || undefined,
      style: { position: "relative", width: 228, maxWidth: "100%", borderRadius: 16, overflow: "hidden", padding: "12px 14px 12px",
        background: "linear-gradient(135deg, " + c.a + " 0%, " + c.b + " 100%)", boxShadow: "0 6px 16px -10px " + c.deep, cursor: tap ? "pointer" : "default", boxSizing: "border-box" } },
      h("span", { "aria-hidden": true, style: { position: "absolute", right: -4, top: -12, fontSize: 78, lineHeight: 1, color: "rgba(255,255,255,.45)", pointerEvents: "none" } }, c.g),
      h("div", { style: { position: "relative", fontSize: 10.5, letterSpacing: ".22em", color: c.deep } }, "照影" + (tt.qs ? " · " + tt.qs.length + " 题" : "")),
      h("div", { style: { position: "relative", fontSize: 17, color: "#2e261e", marginTop: 4, lineHeight: 1.35, maxWidth: "82%" } }, z.testName || tt.name || ""),
      z.scene ? h("div", { style: { position: "relative", fontSize: 11.5, color: c.deep, marginTop: 3 } }, "这一次假设：" + z.scene) : null,
      h("div", { style: { position: "relative", display: "inline-block", marginTop: 10, padding: "4px 11px", borderRadius: 999, background: "rgba(255,255,255,.72)", fontSize: 13, color: "#2e261e", lineHeight: 1.45, maxWidth: "100%", boxSizing: "border-box" } }, big),
      !ask && z.line && z.line !== z.title ? h("div", { style: { position: "relative", fontSize: 12, color: "rgba(46,38,30,.75)", marginTop: 6, lineHeight: 1.5 } }, z.line) : null,
      h("div", { style: { position: "relative", fontSize: 11.5, color: ask && st === "done" ? "#fff" : "rgba(46,38,30,.62)", marginTop: 8,
        ...(ask && st === "done" ? { display: "inline-block", background: c.deep, padding: "3px 10px", borderRadius: 999 } : {}) } }, foot));
  }

  // ── 看他做（借查手机「看他玩」那套公共零件：触控圆点 WatchDot、浮着的心声 WatchThought、底下那条 WatchBar）──
  //   题目从上往下排开，圆点挪到他选的那一项上按一下，这一题的心声浮在屏幕上；
  //   放完了心声才落进每题底下留档，最上面摆结果。
  // 留档：这一题手指落过的每一下、每一句心声都落下来；改过选的标上当时按的是哪项
  function whyBox(test, q, path) {
    const h = g.React.createElement, lines = path.filter(x => x.think);
    if (!lines.length) return null;
    const multi = path.length > 1;
    return h("div", { "data-wk": "zywhy", style: { marginTop: 8, padding: "6px 10px", borderLeft: "2px solid " + ACC, background: "rgba(176,118,74,.06)", borderRadius: "0 6px 6px 0", fontStyle: "italic", fontSize: 12.5, color: "#6f5f4d", lineHeight: 1.65 } },
      lines.map((x, k) => h("div", { key: k, style: { marginTop: k ? 4 : 0 } }, multi ? h("span", { style: { fontStyle: "normal", fontSize: 11, color: ACC, marginRight: 4 } }, "按在「" + String((q.opts[x.at] || {}).t || "").slice(0, 10) + "」") : null, x.think)));
  }
  function ZhaoyingWatch(p) {
    const R = g.React, h = R.createElement, W = g.PhoneWatch || {};
    const test = byId(p.testId), rec = p.rec;
    const [pos, setPos] = R.useState({ q: p.replay === false ? test.qs.length : -1, s: 0 });   // 第几题、这题的第几下；q＝题数就是放完了
    const step = pos.q, sub = pos.s, setStep = q => setPos({ q, s: 0 });
    // 每题的过程：手指落了哪几下（犹豫的会先按一个再改）；老记录只有一下
    const pathOf = i => (rec.paths && rec.paths[i] && rec.paths[i].length) ? rec.paths[i] : [{ at: rec.picks[i], think: (rec.whys && rec.whys[i]) || "" }];
    const [phase, setPhase] = R.useState("");          // move / press / think
    const [dot, setDot] = R.useState({ x: null, y: null, press: false });
    const [speed, setSpeed] = R.useState(1), [paused, setPaused] = R.useState(false);
    const boxRef = R.useRef(null), resRef = R.useRef(0), optRefs = R.useRef({}), timer = R.useRef(null), doneRef = R.useRef(false);
    const done = step >= test.qs.length;
    const wait = (ms, fn) => { clearTimeout(timer.current); timer.current = setTimeout(fn, ms / speed); };
    R.useEffect(() => () => clearTimeout(timer.current), []);
    R.useEffect(() => { if (step === -1 && !paused) wait(700, () => setStep(0)); }, [step, paused]);
    R.useEffect(() => {
      if (done) { setDot({ x: null, y: null }); if (!doneRef.current) { doneRef.current = true; p.onDone && p.onDone(); } return; }
      if (step < 0 || paused) return;
      const path = pathOf(step), at = path[Math.min(sub, path.length - 1)].at, th = path[Math.min(sub, path.length - 1)].think || "";
      const el = optRefs.current[step + ":" + at], box = boxRef.current;
      if (sub === 0 && el && box) {
        const top = el.offsetTop - box.clientHeight / 2 + 40;
        try { box.scrollTo({ top: Math.max(0, top), behavior: "smooth" }); } catch (e) { box.scrollTop = Math.max(0, top); }
      }
      setPhase("move");
      wait(sub ? 380 : 520, () => {
        const el2 = optRefs.current[step + ":" + at], box2 = boxRef.current;
        if (el2 && box2) setDot({ x: el2.offsetLeft + Math.min(el2.offsetWidth - 30, 70), y: el2.offsetTop - box2.scrollTop + el2.offsetHeight / 2, press: false });
        wait(520, () => {
          setDot(d => Object.assign({}, d, { press: true })); setPhase("press");
          wait(220, () => {
            setDot(d => Object.assign({}, d, { press: false })); setPhase("think");
            wait(1500 + Math.min(3200, th.length * 70), () => setPos(sub + 1 < path.length ? { q: step, s: sub + 1 } : { q: step + 1, s: 0 }));
          });
        });
      });
    }, [step, sub, paused, speed]);
    const res = { title: rec.title, line: rec.line, free: rec.free };
    // 这一题此刻亮着哪一项：做完的亮最后那项；正在做的，按下去才换，改选前先亮着上一下
    const lit = i => { if (done || i < step) return rec.picks[i]; if (i !== step) return -1;
      const path = pathOf(i); return (phase === "press" || phase === "think") ? path[Math.min(sub, path.length - 1)].at : sub > 0 ? path[sub - 1].at : -1; };
    const nowThink = step >= 0 && !done ? (pathOf(step)[Math.min(sub, pathOf(step).length - 1)] || {}).think || "" : "";
    return h("div", { "data-wk": "zywatch", style: { position: "fixed", inset: 0, zIndex: 120, background: PAPER, display: "flex", flexDirection: "column" } },
      h("div", { "data-wk": "head", style: { flexShrink: 0, padding: "12px 16px 10px", paddingTop: typeof g.safeTop === "function" ? g.safeTop(12) : 12, borderBottom: "1px solid " + LINE } },
        h("div", { style: { fontSize: 11, letterSpacing: ".2em", color: FOG } }, "照影 · " + test.name),
        h("div", { style: { fontSize: 17, color: INK, marginTop: 3 } }, (p.name || "他") + (done ? " 做完了" : " 在做"))),
      h("div", { style: { position: "relative", flex: 1, minHeight: 0 } },
        h("div", { ref: boxRef, style: { position: "absolute", inset: 0, overflowY: "auto", padding: "8px 18px 160px" } },

          test.qs.map((q, i) => h("div", { key: i, "data-wk": "zyq", style: { padding: "12px 0", borderBottom: "1px dashed " + LINE, opacity: !done && i > step ? 0.55 : 1 } },
            h("div", { style: { display: "flex", gap: 8, alignItems: "baseline" } },
              h("span", { style: { fontSize: 12, color: ACC, flexShrink: 0 } }, "Q" + (i + 1)),
              h("span", { style: { fontSize: 14, color: INK, lineHeight: 1.65 } }, q.q)),
            h("div", { style: { marginTop: 8, display: "flex", flexDirection: "column", gap: 6 } }, q.opts.map((o, j) => {
              const on = lit(i) === j;
              return h("div", { key: j, ref: el => { optRefs.current[i + ":" + j] = el; }, "data-wk": "zyopt", "data-on": on ? "1" : "0",
                style: { display: "flex", alignItems: "center", gap: 9, fontSize: 13, padding: "8px 10px", borderRadius: 8, border: "1px solid " + (on ? ACC : LINE), background: on ? "rgba(176,118,74,.12)" : "#fffaf3", color: on ? INK : "#7d6f60", transition: "all .25s" } },
                h("span", { style: { flexShrink: 0, width: 14, height: 14, borderRadius: 999, border: "1.5px solid " + (on ? ACC : "#cbbca9"), background: on ? ACC : "transparent", boxShadow: on ? "inset 0 0 0 2px #fffaf3" : "none", transition: "all .25s" } }),
                h("span", null, o.t));
            })),
            // 放完了才留档：心声落在这一题底下
            done ? whyBox(test, q, pathOf(i)) : null)),
          // 放完了：结果和评语摆在题目最下面（她 2026-10-22），放完自己滚过去
          done ? h("div", { "data-wk": "zyresult", ref: el => { if (el && !resRef.current) { resRef.current = 1; try { el.scrollIntoView({ behavior: "smooth", block: "center" }); } catch (e) {} } }, style: { margin: "18px 0 8px", padding: "16px 14px 14px", borderRadius: 12, background: "#fffaf3", border: "1px solid " + LINE, boxShadow: "inset 0 0 0 4px #fffaf3, inset 0 0 0 5px " + LINE, animation: "wkpop .35s ease-out both" } },
            h("div", { style: { fontSize: 11, letterSpacing: ".2em", color: FOG } }, (p.name || "他") + (res.free ? " 做完说" : " 测出来是")),
            h("div", { style: { fontSize: 21, color: INK, marginTop: 4 } }, res.title),
            res.line && res.line !== res.title ? h("div", { style: { fontSize: 13, color: "#6d6255", marginTop: 4, lineHeight: 1.6 } }, res.line) : null,
            rec.review ? h("div", { "data-wk": "zyreview", style: { fontSize: 13, color: "#5d5246", marginTop: 10, paddingTop: 10, borderTop: "1px dashed " + LINE, lineHeight: 1.75 } }, rec.review) : null,
            // 存成图／收进时刻：看完就在这儿点（她 2026-10-22）
            (p.onSaveImage || p.onPin) ? h("div", { "data-wk": "zyrecacts", style: { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 } },
              p.onSaveImage ? h("button", { onClick: p.onSaveImage, style: { fontSize: 12.5, color: ACC, border: "1px solid " + ACC, borderRadius: 999, padding: "6px 14px", minHeight: 40, background: "transparent" } }, "存成图") : null,
              p.onPin ? h("button", { onClick: p.onPin, style: { fontSize: 12.5, color: ACC, border: "1px solid " + ACC, borderRadius: 999, padding: "6px 14px", minHeight: 40, background: "transparent" } }, "收进时刻") : null) : null) : null),
        W.WatchDot ? h(W.WatchDot, dot) : null,
        W.WatchThought && !done && phase === "think" ? h(W.WatchThought, { text: nowThink }) : null,
        W.WatchBar ? h(W.WatchBar, { noKnock: true, done, paused, speed, i: Math.max(0, Math.min(step + 1, test.qs.length)), total: test.qs.length,
          onPause: () => setPaused(v => !v), onSpeed: () => setSpeed(v => v >= 3 ? 1 : v + 1), onSkip: () => { clearTimeout(timer.current); setStep(test.qs.length); },
          onClose: () => { clearTimeout(timer.current); p.onClose && p.onClose(); } }) : null));
  }

  // ── 他给她出题（她 2026-10-22「他给你出题」）：照他自己想知道她什么来出，结果交给她做 ──
  function charTestInstruction(meName) {
    return "你想更了解「" + meName + "」，给她出一套小测，让她在手机上做。出什么由你：照你这个人会好奇她什么、你们之间聊过什么、你一直没问出口的，挑你真想知道的。"
      + "6 到 10 道题，每题 2 到 4 个选项。题面是具体的日常场景或问题，用你自己说话的口气；选项是人在那个场景里真会有的不同反应，彼此拉得开。"
      + "这套不算分，她做完你会看到她每题选了什么。name 是这套题的名字，sub 是你写在最前面给她的一句话。";
  }
  const CHAR_TEST_SCHEMA = "{\"name\":\"\",\"sub\":\"\",\"qs\":[{\"q\":\"\",\"opts\":[{\"t\":\"\"}]}]}";

  // ── 结果存成一张图（她 2026-10-22）：纸色底、结果、每题选了什么和心声 ──
  function resultImage(test, rec, name) {
    const W = 750, PAD = 48, c = document.createElement("canvas"), x = c.getContext("2d");
    const FONT = "'PingFang SC','Noto Sans SC','Microsoft YaHei',sans-serif";
    const wrap = (txt, size, maxW) => { x.font = size + "px " + FONT; const out = []; let line = "";
      for (const ch of String(txt || "")) { if (ch === "\n" || x.measureText(line + ch).width > maxW) { out.push(line); line = ch === "\n" ? "" : ch; } else line += ch; }
      if (line) out.push(line); return out; };
    const rows = [];
    const add = (txt, size, color, gap, indent) => wrap(txt, size, W - PAD * 2 - (indent || 0)).forEach((l, k) => rows.push({ l, size, color, gap: k ? size * 0.5 : (gap || 0), indent: indent || 0 }));
    add("照影 · " + test.name, 22, FOG, 0);
    add((name || "") + (rec.free ? " 做完说" : " 测出来是"), 24, FOG, 26);
    add(rec.title || "", 44, INK, 10);
    if (rec.line && rec.line !== rec.title) add(rec.line, 26, "#6d6255", 12);
    if (rec.scene) add("这一次的前提：" + rec.scene, 24, ACC, 14);
    if (rec.review) add(rec.review, 24, "#6d6255", 16);
    test.qs.forEach((q, i) => {
      add("Q" + (i + 1) + "  " + q.q, 27, INK, 34);
      add("→ " + optText(test, i, (rec.picks || [])[i]), 26, ACC, 10, 20);
      const w = (rec.whys || [])[i]; if (w) add("「" + w + "」", 24, "#6f5f4d", 8, 20);
    });
    add(dateZh(rec.ts || Date.now()) + " · 秋秋机", 22, FOG, 40);
    let H = PAD; rows.forEach(r => { H += r.gap + r.size * 1.45; }); H += PAD;
    c.width = W; c.height = Math.ceil(H);
    x.fillStyle = PAPER; x.fillRect(0, 0, W, c.height);
    x.strokeStyle = LINE; x.lineWidth = 2; x.strokeRect(16, 16, W - 32, c.height - 32);
    let y = PAD; x.textBaseline = "top";
    rows.forEach(r => { y += r.gap; x.font = r.size + "px " + FONT; x.fillStyle = r.color; x.fillText(r.l, PAD + r.indent, y); y += r.size * 1.45; });
    return new Promise(res => c.toBlob(b => res(b), "image/png"));
  }

  g.Zhaoying = { TESTS: T, allTests, customs, saveCustom, delCustom, genTest, askSchema, byId, resultOf, recordsOf, addRecord, delRecord, chatNote, askInstruction, ASK_SCHEMA, readAnswers, dateZh, optText, cleanTest, charTestInstruction, CHAR_TEST_SCHEMA, resultImage, pal, CATS, catOf };
  g.ZhaoyingCard = function (p) { return card(p && p.m); };
  g.ZhaoyingWatch = ZhaoyingWatch;
  // 主屏图标：一面小圆镜
  g.GZhaoying = function (p) {
    const h = g.React && g.React.createElement; if (!h) return null;
    const kids = [h("circle", { key: 1, cx: 12, cy: 10, r: 6.5 }), h("path", { key: 2, d: "M12 16.5V21M9 21h6M9.5 8.2a3 3 0 0 1 2.5-1.2" })];
    if (typeof g.Svg === "function") return h(g.Svg, p, kids);
    return h("svg", { width: (p && p.size) || 24, height: (p && p.size) || 24, viewBox: "0 0 24 24", fill: "none", stroke: (p && p.color) || "currentColor", strokeWidth: 1.6, strokeLinecap: "round" }, kids);
  };
})(typeof window !== "undefined" ? window : globalThis);
