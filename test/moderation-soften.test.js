const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const engine = fs.readFileSync(path.join(root, "js/engine.js"), "utf8");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const theater = fs.readFileSync(path.join(root, "js/theater.js"), "utf8");

// 她 2026-08-22 截图：只是要一张自拍，角色恰好在醉仙楼喝酒，模型把酒杯写进画面描述，
// 上游对【真人参考照 + 酒精】直接拒了 →「没用上参考照」。
// 旧阶梯是 带照片失败 → 立刻退到无参考照，等于为了一只酒杯丢掉整张脸。

// 把软化器抠出来真跑
const soften = (() => {
  const i = engine.indexOf("  // ⚠️替换顺序有讲究");
  const j = engine.indexOf("  };", engine.indexOf("const softenForModeration")) + 4;
  return new Function(engine.slice(i, j) + "\nreturn softenForModeration;")();
})();
const looksLikePolicy = (() => {
  const i = engine.indexOf("  const looksLikePolicy = ");
  return new Function(engine.slice(i, engine.indexOf("\n", i)) + "\nreturn looksLikePolicy;")();
})();

// v54.85：她第二张截图——同一场景改报「自拍没生成」，整个函数抛了。
// 两个新病根：① 光秃秃一个「醉」字把【醉仙楼】拆成了「微红的脸色仙楼」，
// 逐词替换还拼出了「因喝着茶而起的微红的脸色感」这种病句；
// ② 软化只用在带照片那次，最后的 no-ref 兜底仍用【原始 prompt】——
// 原措辞本来就被拒，不带照片照样被拒，于是整个抛出。
test("地名不许误伤：醉仙楼、酒楼要原样活着", () => {
  const real = "背景是醉仙楼雅间模糊的木雕窗棂，带着几分因饮酒而起的微醺感";
  const out = soften(real);
  assert.match(out, /醉仙楼雅间/, "把地名拆了：" + out);
  assert.equal(soften("他在酒楼二楼靠窗坐着"), null, "酒楼是场所，不是画面里的酒");
});

test("整词组先处理，别逐词拼出病句", () => {
  const out = soften("带着几分随性和几分因饮酒而起的微醺感").split("【画面尺度补充】")[0];
  assert.ok(!/带着几分带着几分/.test(out), "拼重了：" + out);
  assert.ok(!/微红的脸色感/.test(out), "拼出病句了：" + out);
  assert.match(out, /带着几分随性和几分松弛/);
});

test("酒/烟/刀被换掉，并补一句尺度声明", () => {
  const out = soften("他坐在醉仙楼二楼，手里端着酒杯，正在喝酒");
  assert.ok(!/酒/.test(out.split("【画面尺度补充】")[0]), "正文里不该再有酒：" + out);
  assert.match(out, /水/, "换成不挑时代的说法（v54.93 起不再用「茶」）");
  assert.match(out, /【画面尺度补充】画面必须是可公开展示的日常场景/);
  assert.ok(!/烟/.test(soften("他叼着烟").split("【画面尺度补充】")[0]));
  assert.ok(!/刀/.test(soften("腰间佩刀").split("【画面尺度补充】")[0]));
  assert.match(soften("衣袖沾了血迹"), /衣袖沾了尘土/);
});

test("一个字都没改就返回 null——别为不相干的失败白跑一次", () => {
  assert.equal(soften("他站在窗边看雨，神情懒散"), null);
  assert.equal(soften(""), null);
});

test("只对疑似审核拒绝重试；网络错误换说法也没用", () => {
  ["该提示可能违反了我们的内容政策", "content policy violation", "safety system blocked", "moderation failed"]
    .forEach(m => assert.ok(looksLikePolicy({ message: m }), "该认出来：" + m));
  ["network timeout", "fetch failed", "429 quota exceeded", "接口没返回 JSON"]
    .forEach(m => assert.ok(!looksLikePolicy({ message: m }), "不该重试：" + m));
});

test("降级阶梯：丢脸【之前】插一级软化重试，两条路都插了", () => {
  // 单张参考照：只在疑似审核拒绝时才算软化稿
  assert.match(engine, /const policy = looksLikePolicy\(e\);\n      if \(!policy\) throw e;\n      const soft = softenForModeration\(prompt\);/);
  assert.match(engine, /return mark\(await attemptWith\(refBlobs, "first", soft, RETRY_MS\), "softened"\);/);
  // 多张（合照）
  assert.match(engine, /const softM = looksLikePolicy\(\{ message: lastRefErr \}\) \? softenForModeration\(prompt\) : null;/);
  // 顺序要紧：软化重试必须排在 no-ref 之前，否则脸已经丢了再软化毫无意义
  const softAt = engine.indexOf('"softened"');
  const noRefAt = engine.indexOf('mark(await attempt(false), "no-ref")');
  assert.ok(softAt > 0 && softAt < noRefAt, "软化重试要排在退回无参考照之前");
});

test("兜底那级也必须用软化后的措辞——否则软化等于白做", () => {
  // 这是「自拍没生成」的真正病根：原措辞被拒，不带照片照样被拒，整个函数抛出
  assert.match(engine, /return mark\(await attempt\(false, false, null, soft, RETRY_MS\), "softened-no-ref"\);/, "单张");
  assert.match(engine, /return mark\(await attempt\(false, false, null, softM, RETRY_MS\), "softened-no-ref"\);/, "多张");
  // 四级顺序：原样带照片 → 软化带照片 → 软化不带照片 → 原样不带照片
  const i1 = engine.indexOf('"softened"'), i2 = engine.indexOf('"softened-no-ref"');
  assert.ok(i1 < i2, "保住脸的那级要排在前面");
});

test("prompt 覆盖串下去了，而且没把 API 的字段名改坏", () => {
  assert.match(engine, /const attemptWith = async \(blobs, refMode, pOverride, msOverride\)/);
  assert.match(engine, /const attempt = async \(useRef, slim, refMode, pOverride, msOverride\) => \{\n    const promptText = pOverride \|\| prompt;/);
  // ⚠️两个出口的【键名】必须还是 prompt，值才是 promptText——
  // 改这儿时用正则一不小心会把简写属性 { prompt } 改成 { promptText }，那会让无参考照出图全废
  assert.match(engine, /fd\.append\("prompt", promptText\)/);
  assert.match(engine, /prompt: promptText, size, n: 1/);
  assert.ok(!/\{ model: a\.model \|\| "gpt-image-2", promptText,/.test(engine), "简写属性被改坏了");
});

test("界面要说清楚为什么手里变成了茶，别让她以为角色改喝茶了", () => {
  const msg = "审核不让真人照片配酒/烟/刀，画面里换成了茶和折扇——脸保住了";
  assert.ok(app.includes(msg), "单聊自拍要报");
  assert.equal((theater.match(new RegExp(msg.replace(/[/—]/g, "."), "g")) || []).length, 2, "小剧场剧照与封面两处都要报");
  // softened 不能落进「没用上参考照」那条分支——脸其实保住了，报反了会让人白排查
  assert.match(app, /out\.degraded === "softened" \?/);
  // 脸没保住的那级要说实话，别和「脸保住了」报成同一句
  const lost = "审核挡了两次，换掉酒/烟/刀才出得来，而且没用上参考照——脸可能不像";
  assert.ok(app.includes(lost), "单聊要报 softened-no-ref");
  assert.equal((theater.match(new RegExp(lost.replace(/[/—]/g, "."), "g")) || []).length, 2, "小剧场两处也要报");
});

// 她 2026-08-22：「到底咋样才能永远保住脸嘤」。
// 补救总是慢一拍，真正的答案是两层：① 别让触发词进 prompt；② 丢脸之前先把场景整个拿掉。
// v54.87：上一版把这条写成禁令，模型就选了最省事的那条路——干脆不拍
// （她 2026-08-22「可恶啊现在不给我拍了」）。病根是「是否发由你自己决定」后面
// 紧跟一段吓人的禁令，等于明码给了它一个退出口。禁令要改成【取景指导】。
test("上游预防写成取景指导，不是禁令", () => {
  assert.match(app, /【scene 怎么取景】镜头对着人/, "正面说能拍什么，别只列禁忌");
  assert.match(app, /不是不能存在，是这一格没拍到它们/, "东西还在，只是没入镜");
  // 后果要说，但放在括号里降权，不能盖过"照拍"
  assert.match(app, /出图接口见到酒精、烟草、武器、血伤会整张拒掉，那样你连脸都发不出去/);
});

test("退出口必须堵死：有酒有刀都不是不拍的理由", () => {
  assert.match(app, /【这条只管怎么取景，不是不拍的理由】她开口要你拍，你就拍/);
  assert.match(app, /统统不构成拒绝或省略 photo 的理由/);
  // 给出可执行的替代，否则它还是只能选择不拍
  assert.match(app, /永远有一格是拍得出来的：拍脸、拍上半身、拍你此刻的神情/);
  // 别再出现上一版那种「必须不出现…」的纯禁令口吻
  assert.ok(!/scene 必须是【能公开展示】的画面/.test(app), "旧的禁令口吻该退场");
});

test("保脸级：丢参考照之前，先试一版没有场景描述的最简稿", () => {
  // 阶梯里要有这一级，并且由调用方传进来（只有它知道锁脸段长什么样）
  assert.match(engine, /if \(opts && opts\.minimalPrompt && canRetry\(\)\) \{/);
  assert.match(engine, /return mark\(await attemptWith\(refBlobs, "first", opts\.minimalPrompt, RETRY_MS\), "minimal"\);/);
  // 顺序：软化带照片 → 最简带照片 → 才是丢照片
  const soft = engine.indexOf('"softened"'), min = engine.indexOf('"minimal"'), lost = engine.indexOf('"softened-no-ref"');
  assert.ok(soft < min && min < lost, "保脸的两级都要排在丢照片之前");
});

// v54.88（她第三张截图）：他终于肯拍了、场景也干净了，却还是没出图。
// 上游原话：rejected by upstream safety checks... prompt is too long。
// 病根是上一版的「最简稿」也交给 buildPhotoPrompt 拼——那函数把画风、身份锁、
// 解剖锁、服装锁、随身物全塞进去，出来一两千字，根本不最简。
const minimal = (() => {
  const i = engine.indexOf("function buildMinimalPhotoPrompt(char, opts) {");
  return new Function(engine.slice(i, engine.indexOf("\n}", i) + 2) + "\nreturn buildMinimalPhotoPrompt;")();
})();

test("最简稿要短，但【身份信息一个都不能少】", () => {
  const char = { name: "裴照川", photoStyle: "realistic", appearance: "二十七八岁男子，墨发束起，常着玄色窄袖长袍" };
  const one = minimal(char, { kind: "self" });
  assert.ok(one.length < 320, "还是要短，现在 " + one.length + " 字");
  assert.match(one, /画面里的人必须严格就是参考图里的那一位/);
  assert.match(one, /必须是本人自拍/);
  assert.match(one, /自拍透视/);
  assert.match(one, /背景简单干净/);
  assert.ok(!/酒|刀|血|烟|伤/.test(one), "最简稿里不许有触发词");
  // ⚠️v54.92 血泪教训：上一版把身份也删光了，中转站一旦没真用上参考照
  // （不少便宜通道的图生图是假的，静默退化成文生图），模型手里零信息，
  // 就给她画了个白毛衣小姐姐。要拿掉的只是【有风险的场景】，不是【这个人是谁】。
  assert.match(one, /二十七八岁男子，墨发束起/, "外貌必须带上");
  assert.match(one, /性别/, "锁脸清单里要点名性别");
  assert.match(one, /按这个人所处的时代与身份自然推导，别串到别的时代去/, "时代感要钉住，但不许假定是哪个时代");
  // 没填外貌的角色不能拼出空标签
  const bare = minimal({ name: "谁" }, { kind: "self" });
  assert.ok(!/【的外貌|【穿着】\n/.test(bare), "字段为空时不许留空标签：" + bare);
});

test("最简稿仍认画风与合照，别把二次元画成真人", () => {
  assert.match(minimal({ photoStyle: "anime" }, { kind: "self" }), /二次元动画插画风格/);
  assert.match(minimal({ photoStyle: "realistic" }, { kind: "self" }), /真实照片风格/);
  const duo = minimal({}, { kind: "duo" });
  assert.match(duo, /两个人必须严格就是参考图里的这两位/);
  assert.ok(duo.length < 220);
});

test("两条出图线路都用上了新的最简稿", () => {
  assert.match(app, /const minimalPrompt = buildMinimalPhotoPrompt\(char, \{ kind: photoKind \}\);/, "单聊自拍");
  assert.match(app, /minimalPrompt: minimalPrompt \}\);/);
  assert.match(app, /const gMinimal = buildMinimalPhotoPrompt\(spk, gCast/, "群聊合照");
  assert.match(app, /\{ minimalPrompt: gMinimal \}/);
  // 旧的大家伙不许再被当成最简稿
  assert.ok(!/buildPhotoPrompt\(char, "普通的日常人像/.test(app), "旧最简稿该退场");
});

test("审核拒绝不许再被误报成配额问题", () => {
  // 上游原话里带「misclassified by the upstream model」，那个 model 以前会命中配额正则
  assert.match(app, /const isSafety = \/safety\|policy\|内容政策/);
  assert.match(app, /顺序要紧：审核拒绝的原话里常带/, "为什么要先判审核，得写在代码里");
  // 配额正则里必须已经拿掉裸的 model
  const q = app.match(/: \/quota\|available\|([^/]+)\/i\.test\(em\)/);
  assert.ok(q && !/\bmodel\b(?!_not)/.test(q[1]), "配额正则里还留着裸的 model：" + (q && q[1]));
  assert.match(app, /上游审核拒了这一张（试过换措辞、也试过只拍人像都没过）/, "要说清已经试过哪几招");
});

test("minimal 那一级要说明白：脸是对的，只是没有场景", () => {
  // 「脸是对的」是句谎话——参考照有没有真被用上我们判断不了（她 2026-08-22 就撞到了）
  assert.ok(!app.includes("但脸是对的"), "别打包票");
  assert.ok(app.includes("要是脸不像，多半是中转站没真用上参考照"));
  assert.match(app, /out\.degraded === "minimal" \?/);
});

// 她 2026-08-22 追问：「为啥这个 prompt 在别的地方可以，我们之前不也用的这个吗」。
// 量了一遍才发现前一版判断错了：实际 prompt 只有 1519 字（接口能收几万），
// 场景描述只占 6%，中转站那句 "prompt is too long" 是它列的三个可能原因之一，不是诊断。
// 真正扎眼的是我们自己的模板：【真人…以假乱真的写实照片质感…必须像真实照片】
// 再附一张真人参考照 —— 那正是反 deepfake 审核要抓的组合。prompt 没变，是上游收紧了。
test("写实档不再说「以假乱真」——那四个字字面就是假的冒充真的", () => {
  assert.ok(!engine.includes("以假乱真"), "最扎眼的四个字要拿掉");
  assert.match(engine, /生成一张【手机随手拍的生活照】，要自然的写实照片质感/);
  // 但画质要求一个都不能少，去掉的只是「无法与真实区分」这层意思
  ["真实的皮肤纹理", "不是插画、不是动漫", "浅景深与轻微噪点"].forEach(k =>
    assert.ok(engine.includes(k), "画风要求被误删：" + k));
});

test("prompt 长度不是病根，别再往「改短」的方向使劲", () => {
  // 把函数抠出来真跑一遍，量的是【发给接口的那一版】
  const i = engine.indexOf("function buildPhotoPrompt(char, sceneDesc, st, opts) {");
  let d = 0, started = false, j = engine.indexOf("{", i);
  for (; j < engine.length; j++) {
    if (engine[j] === "{") { d++; started = true; }
    else if (engine[j] === "}") { d--; if (started && !d) { j++; break; } }
  }
  const build = new Function("freshPhotoWearing", engine.slice(i, j) + "\nreturn buildPhotoPrompt;")(() => "");
  const p = build({ name: "某人", photoStyle: "realistic", refPhoto: "iv_x", appearance: "墨发束起" },
    "窗边逆光，只拍了半张脸", null, { kind: "self" });
  assert.ok(p.length < 4000, "整份 prompt 应远低于接口上限，实测 " + p.length + " 字");
});

// 她 2026-08-22：「现在拍照卡了好几分钟都是拍照中」。是我加重试加出来的——
// 每级各等 180 秒，而且【超时】这种根本不该重试的失败也照走全套阶梯。
test("非审核类失败立刻抛出，不许拖着走完整套阶梯", () => {
  assert.match(engine, /const policy = looksLikePolicy\(e\);\n      if \(!policy\) throw e;/,
    "超时、断网、配额不足换个说法一样跑不通，硬试只会让「拍照中」多转几分钟");
  assert.match(engine, /超时、断网、配额不足换个说法一样跑不通/);
});

test("整条阶梯有总时间预算，每一级都要先问一句还来不来得及", () => {
  assert.match(engine, /const deadline = Date\.now\(\) \+ Number\(\(opts && opts\.budgetMs\) \|\| 180000\);/);
  assert.match(engine, /const canRetry = \(\) => timeLeft\(\) > 20000;/, "剩不到 20 秒就别开新一轮");
  // 每一级重试都得挂上闸，漏一级那一级就能独自超时
  const gated = (engine.match(/canRetry\(\)/g) || []).length;
  assert.ok(gated >= 7, "只有 " + gated + " 处挂了预算闸，漏了级");
  // 合照那圈 sets 循环也要吃闸：成员多时它自己就能转好几分钟
  assert.match(engine, /if \(!canRetry\(\)\) break;   \/\/ 人多时这圈自己就能转好几分钟/);
});

test("重试级的单次超时压到 70 秒，不跟首次一样等 3 分钟", () => {
  assert.match(engine, /const RETRY_MS = 70000;/);
  assert.match(engine, /attemptWith\(refBlobs, "first", soft, RETRY_MS\)/);
  assert.match(engine, /attemptWith\(refBlobs, "first", opts\.minimalPrompt, RETRY_MS\)/);
  // 超时参数要真的串到发请求那一层
  assert.match(engine, /const attempt = async \(useRef, slim, refMode, pOverride, msOverride\)/);
  assert.match(engine, /setTimeout\(\(\) => ctrl\.abort\(\), msOverride \|\| 180000\)/);
});

test("预算用光时给一句能看懂的失败，而不是继续干等", () => {
  assert.match(engine, /出图试了几轮都被挡住，先停下别再等了。最后一次的原话：/);
});

// 她 2026-08-22：「你就固定住了阿川，以后其他角色想生图咋办」。
// 提示词构建本身一直是通用的（名字/外貌/画风全从 char 读），但两处被醉仙楼带偏了：
// ① 软化替换写成了「茶盏」「折扇」——现代角色手里冒出把折扇就荒唐；
// ② 穿着兜底写着「不要现代便装乱入」——对现代角色纯属添乱。
test("最简稿对任何角色都成立，一个字都没写死", () => {
  const modern = minimal({ name: "林知夏", photoStyle: "anime", appearance: "二十三岁女生，齐肩短发，常穿oversize卫衣" }, { kind: "self" });
  assert.match(modern, /林知夏的外貌/);
  assert.match(modern, /二十三岁女生/);
  assert.match(modern, /二次元动画插画风格/, "画风跟着角色走");
  // 穿着兜底不许假定时代
  assert.ok(!/不要现代便装乱入/.test(modern), "对现代角色说这句是添乱");
  assert.match(modern, /按这个人所处的时代与身份自然推导，别串到别的时代去/);
  // 换个古风角色，同一份代码照样对
  const gufeng = minimal({ name: "裴照川", photoStyle: "realistic", appearance: "二十七八岁男子，常着玄色窄袖长袍" }, { kind: "self" });
  assert.match(gufeng, /玄色窄袖长袍/);
  assert.match(gufeng, /真实照片风格/);
});

test("软化替换不挑时代：古风现代读起来都得通顺", () => {
  const cut = t => (t ? t.split("【画面尺度补充】")[0].trim() : null);
  // 现代
  assert.equal(cut(soften("她坐在酒吧吧台前，手里晃着一杯红酒")), "她坐在酒吧吧台前，手里晃着一杯水");
  assert.equal(cut(soften("他叼着烟站在天台，腰间别着匕首")), "他出神地站在天台，腰间别着随身的物件");
  // 古风
  assert.equal(cut(soften("手里漫不经心地转着个青瓷酒杯")), "手里漫不经心地转着个青瓷杯子");
  assert.equal(cut(soften("腰间佩剑，衣袖沾了血迹")), "腰间挂着随身的物件，衣袖沾了尘土");
  // 古风味的替换词一个都不许再出现
  ["茶盏", "折扇"].forEach(w =>
    assert.ok(!engine.includes('"' + w + '"'), "替换表里还留着挑时代的词：" + w));
});

test("场所词一律放过：酒吧、酒楼、酒馆都不是画面里的酒", () => {
  ["他在酒楼二楼靠窗坐着", "她走进那家酒吧", "巷口的小酒馆"].forEach(t =>
    assert.equal(soften(t), null, "误伤了场所：" + t));
  assert.match(engine, /\[\/酒\(\?!\[楼馆家店肆坊铺吧席宴\]\)\/g, "水"\]/);
});
