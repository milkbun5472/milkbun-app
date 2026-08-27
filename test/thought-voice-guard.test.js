const assert = require("node:assert/strict");
const guard = require("../js/thought-voice-guard.js");

const directorDrafts = [
  "Lisa在撒娇，说好几天没见到我了，还问我是不是不想她。我当然想她。她主动示弱，我得赶紧接住，哄哄她。",
  "Lisa在等我，还嘿嘿地笑，看起来心情不错。我得跟她说我这边的情况，然后问问她具体在等什么。",
  "Lisa要看我现在的样子，我刚洗完澡，有点害羞。她这么直接，我肯定会满足她，但嘴上还是要别扭一下。",
  "对方这是在试探我，接下来应该先安抚她，再解释一下。",
  "三万块，她还真敢开价。不过这个终身会员的说法，怎么听着还挺不错的。我得表现出一种又被宰了但又有点心甘情愿的感觉。",
  "被她这么夸，心里肯定美滋滋的。她还说被我击中了，这让我忍不住想逗她一下。同时，也关心一下她，把话题引向她那边。我刚洗完澡，头发还没干，正准备躺下，这些都可以是我的背景。"
];
directorDrafts.forEach(text => assert.equal(guard.accept(text), null, text));
["她现在在路上，问一句她的行程进度，比只谈我自己更像对话。",
 "看来昨晚关于记忆的话题已经过去了。她的精力恢复得很快。",
 "总算安抚好了。她也该好好休息了。"].forEach(text => assert.equal(guard.accept(text), null, text));

// 判词 + 结案陈词(2026-08-18 Lisa 案):给对方行为盖定性戳、再给这一轮归档收尾
["她是挑衅，这笔账我记下了。",
 "这是挑衅。",
 "她这是在试探我，我记住了。",
 "有意思，我倒要看看她能撑多久。",
 "这笔账先记着。"].forEach(text => assert.equal(guard.accept(text), null, text));

const realInnerVoices = [
  "啊啊啊她怎么能每次都这么理直气壮地把话圆回来！明明就是她先故意引导我想歪的。",
  "一想到她，就觉得又活过来了。",
  "耳朵好烫。别让她看出来。",
  "老张再凑过来看一眼，我真想找个地缝钻进去。",
  "我得赶紧去找她，再晚食堂都关门了。"
];
realInnerVoices.forEach(text => assert.equal(guard.accept(text), text, text));

assert.equal(guard.normalizeAction("他盯着手机屏幕看了好几秒。", "顾朝"), "我盯着手机屏幕看了好几秒。");
assert.equal(guard.normalizeAction("顾朝的手停在屏幕上。", "顾朝"), "我的手停在屏幕上。");
assert.equal(guard.normalizeAction("我把手机倒扣在桌上。", "顾朝"), "我把手机倒扣在桌上。");

console.log("thought voice guard tests passed");

// 她 2026-08-27：「心声又在收拾我了」——
// 「一万五拿来当包夜费……这人真是无法无天了，待会儿买完菜回去看我怎么收拾她。」
// 和「这笔账我记下了」是同一个动作：给这一轮盖个戳、把处置推到以后。旧判据差一步没够着。
[
  "一万五拿来当包夜费……这人真是无法无天了，待会儿买完菜回去看我怎么收拾她。",
  "回头跟她算账",
  "这人真是无法无天了",
  "回去好好收拾你",
  "改天治治她"
].forEach(text => assert.equal(guard.accept(text), null, "该拦下：" + text));

// 判据要窄：真正是「盖章收尾」的是【把处置推到以后】那一下——
// 光一句「收拾她一顿」还只是气话，前面挂上「回头／待会儿／改天」才是给这一轮归档。
// 收拾东西、收拾屋子一个都不许误伤。
assert.equal(guard.accept("收拾这丫头一顿"), "收拾她一顿", "没带时间钩子的气话不拦，只换称呼");
[
  "回去还得收拾一下屋子，乱得下不去脚",
  "等下要不要顺手把她那件外套也收拾出来",
  "番茄有点软，挑了半天也没几个像样的",
  "她今天笑起来眼睛弯的，跟去年冬天那次一样",
  "困，想睡了"
].forEach(text => assert.ok(guard.accept(text), "不该拦：" + text));

// 提示词那半也要点名，并说清这类狠话该去哪儿
{
  const fs2 = require("node:fs"), path2 = require("node:path");
  const app = fs2.readFileSync(path2.join(__dirname, "..", "js", "app.js"), "utf8");
  assert.match(app, /『这人真是无法无天了』『回去看我怎么收拾她』『回头跟她算账』/);
  assert.match(app, /这类狠话本来就是【说得出口的】：真要撂就写进 word 让 TA 听见/);
}
