// 如果馆（她 2026-08-31 提，形状她定的）
//
// 跟小剧场的分界要先说清楚，不然做出来就是第二个小剧场：
//   · 小剧场 = 【换掉两个人是谁】。身份、职业、世界全换，只留性格机制，张力现编。
//   · 如果馆 = 【两个人还是这两个人、这段关系还是这段关系】，只换掉【一个变量】。
// 她给的那几个例子（形态变了 / 换了时代 / 不记得了）全都落在后者上。
//
// ⚠️提示词里【不放她举的那几个例子】——放了模型就照着抄，每条线都长成同一个样子
//（见 .claude/rules/prompt-no-content-samples.md）。改成写【维度】和【判据】。
(function (root) {
  "use strict";

  // 一拍里最多几个框。她要的是「一个气泡一个框、点一下出下一个」，
  // 所以一拍本来就该是好几框；但一口气二十框就成了念长文，点到手酸。
  const BOXES_MIN = 3, BOXES_MAX = 6;
  const BOX_CAP = 120;          // 单框字数：框是一口气读完的一屏，长了就不是框了
  const MY_BOXES_MAX = 8;       // 她一个回合能攒几条

  // 四个可动的维度各给一个 key：记下这条线动的是哪一样，下次才好岔开。
  // 她 2026-08-31 报「怎么来来回回都是差不多的」——三条线全落在同一个维度上，
  // 因为模型每次都挑那个最顺手的。光说「别重复」不够，得把【动过哪几样】告诉它。
  const DIMS = [
    ["form", "他的形态", "不再是人的样子，或换成另一种存在"],
    ["era", "他所处的时代与身份", "生在别的年代，或从这边落到那边"],
    ["memory", "他还记不记得你", "记忆缺了一块，或整个人不认得你了"],
    ["fork", "你俩之间那个岔路口", "当初没遇上、遇上了错过了、或者已经分开了"]
  ];
  const dimZh = function (k) { const d = DIMS.find(function (x) { return x[0] === k; }); return d ? d[1] : ""; };

  // 这条「如果」该有多大——她 2026-08-31 亲口划的那条线。
  // 只给维度和判据，一个具体例子都不给。
  const IF_SCALE = "【这条「如果」该有多大】\n"
    + "可以动的只有这四样，挑【一样】动，别一次动几样：\n"
    + DIMS.map(function (d) { return "· " + d[1] + "（" + d[0] + "）——" + d[2] + "；"; }).join("\n") + "\n"
    + "⚠️动完之后，【那个人的核心一个字都不许换】：脾气、说话的方式、在意什么、"
    + "对她的那点心思——这些换掉就不是「如果他怎样」，而是换了个人，那是小剧场的活。\n"
    + "⚠️也不许往小里写：只换一顿饭、一个地点、一次出门，那是今天的日程，不是如果。\n"
    + "判据一句话：**换个角色照样成立的，就是想坏了。**";

  // 一拍怎么写。旁白和台词是【两种框】，界面上长得不一样，所以必须分开给。
  const IF_BEAT = "【怎么写这一拍】\n"
    + "把这一拍拆成 " + BOXES_MIN + "-" + BOXES_MAX + " 个【框】，一框一口气读完（" + BOX_CAP + "字以内）。\n"
    + "· who 留空＝旁白：写画面、动作、气味、光线，第三人称。\n"
    + "· who 填他的名字＝他说出口的话：只写话本身，别把动作塞进引号里。\n"
    + "两种框穿插着来，别整拍全是旁白、也别整拍全是对白。\n"
    + "⚠️绝不替她说话、绝不替她做决定——最后一框要落在一个她能接话的地方，"
    + "但不许写成一个问句清单逼她选。";

  function clip(s, n) {
    const v = String(s == null ? "" : s).replace(/\s+/g, " ").trim();
    return v.length > n ? v.slice(0, n) : v;
  }
  // 模型给的框收口成 [{who,text}]。who 只认【他的名字】或空——
  // 认别的名字等于让它替她说话，那是这一层最要紧的一条禁令。
  function normBoxes(raw, charName) {
    const arr = Array.isArray(raw) ? raw : (raw && Array.isArray(raw.boxes) ? raw.boxes : []);
    const out = [];
    arr.forEach(function (b) {
      if (!b) return;
      const text = clip(typeof b === "string" ? b : b.text, BOX_CAP);
      if (!text) return;
      const who = typeof b === "string" ? "" : clip(b.who, 24);
      const me = String(charName || "").trim();
      // ⚠️who 填了【别人】的名字（多半是她的）：整框丢掉，不要转成旁白留下来——
      // 转成旁白只是把名字摘了，那句话还是替她说的，而「绝不替她说话」是这一层
      // 最要紧的一条。宁可少一框。
      if (who && who !== me) return;
      out.push({ who: who ? me : "", text: text });
    });
    return out.slice(0, BOXES_MAX);
  }
  // 已经想过的那几条：原样发回去，并挑明还没动过哪几个维度。
  // ⚠️只发【题目和前提】，不发正文——那是别的线的内容，混进来只会让它串味。
  function avoidBlock(prior) {
    const rows = (Array.isArray(prior) ? prior : []).slice(0, 8)
      .map(function (x) { return x && x.title ? "· 「" + x.title + "」：" + String(x.premise || "").slice(0, 40) : ""; })
      .filter(Boolean);
    if (!rows.length) return "";
    const used = {};
    (Array.isArray(prior) ? prior : []).slice(0, 8).forEach(function (x) { if (x && x.dim) used[x.dim] = 1; });
    const fresh = DIMS.filter(function (d) { return !used[d[0]]; }).map(function (d) { return d[1]; });
    return "\n\n【已经想过这几条，一条都不许再想】\n" + rows.join("\n")
      + "\n⚠️不是换个说法就算新的：**同一样东西变了、只是换个词说**（同一个设定换个名字、"
      + "同一个身份换个说法）也算重复。这一条要动的必须是【上面那几条没动过的那一样】。\n"
      + (fresh.length
        ? "上面那几条已经动过：" + DIMS.filter(function (d) { return used[d[0]]; }).map(function (d) { return d[1]; }).join("、")
          + "。**这一条从【" + fresh.join("】或【") + "】里挑一样动。**"
        : "四样都动过了，那就在【同一样】里换一个完全不同的走法，但绝不许跟上面任何一条撞在同一个点子上。");
  }
  function openPrompt(charName, uName, hint, prior) {
    const h = clip(hint, 200);
    return "你要为「" + charName + "」和「" + uName + "」想一条【如果线】，然后把它的开场写出来。\n"
      + "这不是换一个世界换一批人：**他俩还是他俩，这段关系还是这段关系**，只是当初有一样东西不一样了。\n\n"
      + IF_SCALE + "\n\n"
      + (h ? "【她给的方向】" + h + "\n这就是这条线要走的方向，按它来，别另起炉灶。\n\n"
           : "【她没给方向】那就从【他这个人身上】长出一条来：哪一样变了，最能把他这个人显出来？\n"
             + "别挑那个最顺手的——换个角色照样成立的，就是想坏了。\n\n")
      + IF_BEAT + avoidBlock(prior) + "\n\n"
      + "另外给四样：title＝这条线叫什么（八个字以内，别剧透结局）；"
      + "premise＝一句话说清哪一样不一样了；"
      + "dim＝这条动的是上面四样里的哪一个（只填 " + DIMS.map(function (d) { return d[0]; }).join(" / ") + " 之一）；"
      + "bg＝这条线的背景画面提示词（一句英文，只写地方和光线氛围，不要写人）。";
  }
  function beatPrompt(charName, uName) {
    return "接着往下演这一拍。\n" + IF_BEAT + "\n\n"
      + "⚠️别急着收尾，也别开新线头往外岔——顺着刚才那一下往前走一步就好。\n"
      + "「" + uName + "」刚才那几句就在上面，接住她真正说的那句，别当没看见。";
  }
  const OPEN_SHAPE = "{\"title\":\"这条线叫什么\",\"premise\":\"哪一样不一样了，一句话\",\"dim\":\"form/era/memory/fork 之一\",\"bg\":\"背景画面提示词，一句英文\",\"boxes\":[{\"who\":\"留空＝旁白，填名字＝他说的话\",\"text\":\"这一框的内容\"}]}";
  const BEAT_SHAPE = "{\"boxes\":[{\"who\":\"留空＝旁白，填名字＝他说的话\",\"text\":\"这一框的内容\"}]}";

  const api = {
    BOXES_MIN: BOXES_MIN, BOXES_MAX: BOXES_MAX, BOX_CAP: BOX_CAP, MY_BOXES_MAX: MY_BOXES_MAX,
    IF_SCALE: IF_SCALE, IF_BEAT: IF_BEAT, DIMS: DIMS, dimZh: dimZh, avoidBlock: avoidBlock,
    normBoxes: normBoxes, openPrompt: openPrompt, beatPrompt: beatPrompt,
    OPEN_SHAPE: OPEN_SHAPE, BEAT_SHAPE: BEAT_SHAPE
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  // ⚠️叫 IfKit 不叫 IfRoom：screens.js 里那个页面组件就叫 IfRoom，两个都是全局，
  // 后加载的这一个会把组件函数原样盖成一个对象，React 当场报 #130（元素类型不是
  // 函数是对象）——而 node --check 和整套测试一个字都不会说。跟房里 GachaKit /
  // DesireKit / TrpgMap 一个叫法。
  if (root) root.IfKit = api;
})(typeof window !== "undefined" ? window : globalThis);
