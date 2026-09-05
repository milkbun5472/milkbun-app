// 加笔的玩法长厚一点（她 2026-09-05：「1+3，但是后果不能他们弃坑不写，
// 就是看他们批注才有意思」「没写完的同人文改到底可以让她先继续写下去然后我们再继续改」）。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const fic = fs.readFileSync(path.join(__dirname, "..", "js", "fanfic.js"), "utf8");

// 纯函数抠出来真跑（同 fanfic-spine-60-97 的那把钥匙）
const F = (() => {
  const a = fic.indexOf("  const RP_WINDOW_CHARS = 9000;");
  const b = fic.indexOf("\n  // 编个热度数字");
  assert.ok(a > 0 && b > a, "抠不出穿书引擎那一段");
  return new Function(
    "const extractJSON=s=>{try{return JSON.parse(s)}catch(e){return null}};"
    + "const ficPenName=id=>'笔名'+id; const ficHeat=s=>({kudos:1,hits:2});"
    + "let __n=0; const uid=p=>p+'_'+(++__n); let __reply=''; const callAI=async()=>__reply;"
    + "const __say=v=>{__reply=v};"
    + "const buildRPSystem=()=>''; const rpAnchorLine=()=>''; const rpStartLine=()=>'';"
    + fic.slice(a, b)
    + "\nreturn {genRPEnding,rpToFic,rpDevBand,rpAuthorBlock,rpPullBlock,__say};")();
})();

// ── 偏离度：改的是【她怎么在场】，不是【还在不在场】 ──────────────
test("四档都还在，越改她站得越靠前", () => {
  const tags = [0, 24, 25, 54, 55, 79, 80, 100].map(n => F.rpDevBand(n).tag);
  assert.equal(tags.join("|"), "还看着|还看着|开始往回拽|开始往回拽|下场跟你抢笔|下场跟你抢笔|跟你一起写|跟你一起写");
  // 越界和脏值都要有个落点，不许返回 undefined 让整条链炸
  assert.equal(F.rpDevBand(999).tag, "跟你一起写");
  assert.equal(F.rpDevBand(-5).tag, "还看着");
  assert.equal(F.rpDevBand(undefined).tag, "还看着");
});

test("最高那一档不是弃坑——她伸手更狠，只是方向反过来", () => {
  const hi = F.rpDevBand(95).line;
  assert.match(hi, /加码/);
  assert.match(hi, /「认了」不等于放手/, "写成「她认输了」，模型就会开始不写了");
  ["弃坑", "断更", "不再批注", "撒手不管"].forEach(w =>
    assert.equal(F.rpDevBand(95).line.indexOf(w) >= 0 && w !== "撒手不管", false, "最高档里出现了「" + w + "」"));
  // 伸手和页边两处都吃到这一层，而且都带那句「她不会撒手」
  const sess = { dev: 95, transcript: [1], authorCard: { temper: "先冷着看" } };
  [F.rpPullBlock({ author: "某太太" }, sess), F.rpAuthorBlock({ author: "某太太" }, sess)].forEach(blk => {
    assert.match(blk, /偏离度 95\/100 · 跟你一起写/);
    assert.match(blk, /不会撒手不管/);
  });
  // 低偏离那一档发的是另一段话，不是同一段
  assert.match(F.rpAuthorBlock({ author: "某太太" }, { dev: 3 }), /偏离度 3\/100 · 还看着/);
});

// ── 收尾：这一版发回圈子之后有人说话 ────────────────────────
test("圈子的反应搭收尾这一枪的车，不另开一次调用", () => {
  const seg = fic.slice(fic.indexOf("async function genRPEnding("), fic.indexOf("  // 把走完的这一版拧成一篇文"));
  assert.equal((seg.match(/await callAI\(/g) || []).length, 1, "多开了一枪＝同一份料付两回钱");
  assert.match(seg, /其中【必须有且只有一条】是原作者/);
  assert.match(seg, /至少一条是替原著抱不平的/, "全场叫好等于没有圈子");
  assert.doesNotMatch(seg.slice(seg.indexOf("【顺带")), /如「|比如「|例如「/, "给了例句，每篇底下都会长出同一批评论");
});

test("作者那条只许有一条，其余按读者收", async () => {
  F.__say(JSON.stringify({
    scene: "灯灭了。", verdict: "这版我不认，但我读完了。",
    reviews: [
      { author: "三钱薄荷脑", isAuthor: true, content: "你把她写得太硬了。" },
      { author: "三钱薄荷脑", isAuthor: true, content: "冒充我的第二条" },
      { author: "路人甲", content: "原著那一页被拦下我不服。" },
      { author: "", content: "没署名的这条也得收" }
    ]
  }));
  const r = await F.genRPEnding(null, { beats: [], transcript: [] }, { author: "三钱薄荷脑" }, {}, [], "我", "", 3000);
  assert.equal(r.text, "灯灭了。");
  assert.equal(r.reviews.length, 4);
  assert.equal(r.reviews.filter(x => x.isAuthor).length, 1, "作者下场了两次");
  assert.equal(r.reviews[1].isAuthor, false);
  assert.equal(r.reviews[3].author, "路人读者", "没署名的掉成空名字");
  assert.ok(r.reviews.every(x => Array.isArray(x.replies)), "结构对不上书评那一套，界面会当场炸");
  // 模型没给这一栏：空数组，不许 undefined 一路传到 rpToFic
  F.__say(JSON.stringify({ scene: "灯灭了。", verdict: "" }));
  const r2 = await F.genRPEnding(null, { beats: [], transcript: [] }, { author: "三钱薄荷脑" }, {}, [], "我", "", 3000);
  assert.deepEqual(r2.reviews, []);
  // 模型把这一栏写成了别的形状：也得是空数组，不许当场抛错（那一枪的正文会跟着一起丢）
  F.__say(JSON.stringify({ scene: "灯灭了。", verdict: "", reviews: "三条好评" }));
  const r3 = await F.genRPEnding(null, { beats: [], transcript: [] }, { author: "三钱薄荷脑" }, {}, [], "我", "", 3000);
  assert.deepEqual(r3.reviews, []);
  assert.equal(r3.text, "灯灭了。");
});

test("那几条真的跟着这一版进书架", () => {
  const f = F.rpToFic({ ficTitle: "某篇", transcript: [{ who: "src", i: 0, text: "她写的" }], beats: [], voided: [] },
    { author: "三钱薄荷脑" }, "判词", [{ id: "rv_1", author: "路人甲", content: "不服", replies: [] }]);
  assert.equal(f.reviews.length, 1);
  assert.equal(f.reviews[0].content, "不服");
  // 老存档 / 没带书评的那次不许变成 undefined
  assert.deepEqual(F.rpToFic({ transcript: [], beats: [] }, {}, "").reviews, []);
});

// ⚠️这一条是这次真正的病：if (props.onShelveFic) 一路声明、一路转发，最后没人传，
//   于是「这一版放回书架」从上线起一次都没发生过，而且不报任何错。
test("收尾那一版真的有人接住——onShelveFic 不许再是空的", () => {
  assert.match(fic, /onShelveFic: function \(f\) \{ persistFics\(\[f\]\.concat\(loadFics\(\)\)\); \}/, "还是没人传");
  assert.match(fic, /onExtendFic: function \(id, ch\) \{ updateFic\(id, function \(f\) \{ f\.chapters = \(f\.chapters \|\| \[\]\)\.concat\(\[ch\]\)/);
  // RPApp 收到了也要往下转给 RPThread，中间断一节和没传一样
  const app = fic.slice(fic.indexOf("  function RPApp(props) {"), fic.indexOf("  // 书脊：这一版书被你改成什么样"));
  assert.match(app, /onShelveFic: props\.onShelveFic, onExtendFic: props\.onExtendFic,/);
});

// ── 残卷：她接着写，你接着改 ──────────────────────────────
test("她续的那一章是【她的字】：追加进原篇，且只往末尾加", () => {
  const w = fic.slice(fic.indexOf("    async function writeOn() {"), fic.indexOf("    // 收尾：写最后一段"));
  assert.ok(w.length > 200, "抠不出 writeOn");
  // 用现成的续写，不另写一份（一层写在两处）
  assert.match(w, /window\.Fanfic\.genNextChapter\(props\.active, props\.fic, props\.tab, cpc/);
  // ⚠️围栏：续写只吃原文，绝不许把这一局的 transcript 喂进去（别的局会读到你这儿发生的事）
  assert.doesNotMatch(w, /transcript|\bss?\.(voided|beats|dev)\b/, "把这一局的走向喂进原文了——串场");
  const gn = fic.slice(fic.indexOf("  async function genNextChapter("), fic.indexOf("  // ---- 书评"));
  assert.doesNotMatch(gn, /session|transcript/, "续写那一枪读到了加笔这一局的东西");
  // 只往末尾 concat：在中间插一段会把 voided / paraIdx 那些下标全错位
  assert.match(fic, /f\.chapters = \(f\.chapters \|\| \[\]\)\.concat\(\[ch\]\)/);
  assert.doesNotMatch(fic, /chapters\.splice\(/);
  // 读到底才出现这个按钮，而且没接上就不显示（一个点了没反应的按钮比没有更坏）
  assert.match(fic, /\(!busy && props\.onExtendFic\) \? h\("button", \{ onClick: writeOn/);
});
