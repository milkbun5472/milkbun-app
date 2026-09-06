// 穿书重做（她 2026-09-03：「同人文穿书那一块玩法，改了几版玩法还是不满意，
// 因为还是很想参考过的功能嘤」，然后在两个方案里选了「两样都要」）。
//
// 病根不在设置页——是【循环本身】：引擎写两三百字 → 停在一个抉择处 → 玩家自由输入 → 循环。
// 这个循环谁家都有（判据同 施工规则/tabs-not-plain-pills.md：原样搬到别的 app
// 里还成立，就是没长出来），所以那几排按钮改几次都救不了。
// 穿书跟通用 CYOA 差在【底下压着一本已经写好的书】，而且这本书的作者就在这个 app 里。
// 这一版把这两样接进循环：① 骨架（原著后面那几页，走到时选照原样 / 拦下）
// ② 页边（作者本人隔几拍在稿子边上写一句）。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const fic = fs.readFileSync(path.join(__dirname, "..", "js", "fanfic.js"), "utf8");

// 纯函数抠出来真跑：rpMessages / rpBeatsBlock / rpTurnShape / rpParseTurn / rpToFic
const F = (() => {
  const a = fic.indexOf("  const RP_WINDOW_CHARS = 9000;");
  const b = fic.indexOf("\n  // 编个热度数字");
  assert.ok(a > 0 && b > a, "抠不出穿书引擎那一段");
  return new Function(
    "const extractJSON=s=>{try{return JSON.parse(s)}catch(e){return null}};"
    + "const ficPenName=id=>'笔名'+id; const ficHeat=s=>({kudos:1,hits:2});"
    + "const uid=p=>p+'_1'; let __reply=''; const callAI=async()=>__reply;"
    + "const __say=v=>{__reply=v};"
    + "const buildRPSystem=()=>''; const rpAnchorLine=()=>''; const rpStartLine=()=>'';"
    + fic.slice(a, b)
    + "\nreturn {rpMessages,rpBeatsBlock,rpTurnShape,rpParseTurn,rpToFic,rpAuthorName,genRPStart,__say};")();
})();

const beat = (id, label, state) => ({ id, label, page: label + "本来会发生", cue: "那个当口", state });

test("骨架是【和开场同一次调用】抽出来的——多一层玩法不该多花她一次钱", () => {
  const a = fic.indexOf("  async function genRPStart(");
  const b = fic.indexOf("\n  // 玩家行动 →", a);
  assert.ok(a > 0 && b > a, "找不到 genRPStart");
  const seg = fic.slice(a, b);
  assert.equal((seg.match(/await callAI\(/g) || []).length, 1, "开场这一步不许调第二次模型");
  assert.match(seg, /\\"beats\\":\[/, "开场没顺手把骨架一起要回来");
  // 别处也不许偷偷再开一次专门问骨架的调用
  assert.doesNotMatch(fic, /async function genRPBeats/, "骨架不该单独一次调用");
  // 抽出来的每一页都要落成 pending，客户端才认得出「还没走到」
  assert.match(seg, /state: "pending"/);
});

// v62.50：加笔不再由引擎写开场——原文本身就是开场，这一枪只抽骨架
test("开场那一枪只抽骨架，不写正文", async () => {
  const S = { playerIdentity: null, landing: { label: "三更值房", scene: "只剩一盏灯" }, mode: "left", know: "spoiler" };
  F.__say(JSON.stringify({ beats: [
    { label: "灯下那盏茶", page: "他把凉茶换了一盏热的。", cue: "灯将尽的时候" },
    { label: "卷宗被掉包", page: "宗册被换掉一页。", cue: "宗册离手的当口" }] }));
  const r = await F.genRPStart(null, S, {}, {}, [], "我", "", 3000);
  assert.equal(r.text, undefined, "开场正文不归它写了（原文就是开场）");
  assert.equal(r.beats.length, 2, "骨架没被接住——那这一版玩法整个不存在");
  assert.equal(r.beats[0].id, "b1");
  assert.equal(r.beats[0].state, "pending");
  assert.equal(r.beats[1].label, "卷宗被掉包");
  // 模型这次没按格式写：这一局没有骨架，但照样开得了场（原文摆在那儿）
  F.__say("他推门进来的时候，肩上还落着雪。");
  const raw = await F.genRPStart(null, S, {}, {}, [], "我", "", 3000);
  assert.deepStrictEqual(raw.beats, [], "解析不出来就该是空骨架，不许抛错");
  assert.deepEqual(raw.beats, []);
});

test("被拦下的那一页是【作废】，不是「这次先不写」", () => {
  const s = { beats: [beat("b1", "灯下那盏茶", "kept"), beat("b2", "卷宗被掉包", "broken"), beat("b3", "雪夜跪门", "pending")] };
  const blk = F.rpBeatsBlock(s);
  assert.ok(blk.indexOf("b2") > 0 && blk.indexOf("b3") > 0, "骨架没发回给引擎");
  assert.match(blk, /作废/);
  assert.match(blk, /永远不许再发生/, "只说「这一拍别写」的话，过几拍它自己就又安排上了");
  // 还没走到的那几页：只许把 id 填进 hit 停在当口，不许替玩家把它写完
  assert.match(blk, /hit/);
  assert.match(blk, /不许在这一拍里写完/);
  assert.equal(F.rpBeatsBlock({}), "", "没有骨架的老存档一个字都不多发");
});

test("这一页的下场要一路带到最后：窗口里带、掉出窗口也带", () => {
  const page = { who: "page", beat: "b2", label: "卷宗被掉包", keep: false };
  const near = F.rpMessages({ transcript: [{ who: "nar", text: "叙事" }, page] }, null);
  const line = near.map(m => m.content).join("\n");
  assert.match(line, /卷宗被掉包/);
  assert.match(line, /作废/, "拦下这件事没发回去，模型过几拍就又把它安排上了");
  // 掉出窗口之后，前情提要里仍然要认这笔账
  const long = { transcript: [page].concat(Array.from({ length: 30 }, (_, i) =>
    i % 2 ? { who: "nar", text: "叙".repeat(600) } : { who: "me", text: "行动" + i })) };
  const far = F.rpMessages(long, null).map(m => m.content).join("\n");
  assert.match(far, /前情提要/);
  assert.match(far, /卷宗被掉包/, "掉出窗口就把「这一页作废」忘了");
});

test("页边批注不回传：那是写在稿子边上的，不是玩家的指令也不是这本书的字", () => {
  const t = [{ who: "nar", text: "叙事" }, { who: "note", text: "这句不该被当成指令" }, { who: "me", text: "我开口" }];
  const out = F.rpMessages({ transcript: t }, null).map(m => m.role + ":" + m.content).join("\n");
  assert.doesNotMatch(out, /这句不该被当成指令/, "批注被当成正文/指令发回去了");
  assert.match(out, /【我的行动】我开口/, "玩家的行动反而丢了");
  // 落回书架的那一版正文里也不许有批注
  const f = F.rpToFic({ id: "rp1", ficTitle: "值夜", tabId: "tb", cp: [], transcript: t, beats: [] }, { author: "半盏灯" }, "");
  assert.doesNotMatch(f.chapters[0].content, /这句不该被当成指令/);
  assert.match(f.chapters[0].content, /我开口/);
});

test("作者只在被点名的那几拍开口，其余拍明说了不要", () => {
  const s = { dev: 40, beats: [beat("b1", "灯", "broken")] };
  const on = F.rpTurnShape({ author: "半盏灯" }, s, true);
  const off = F.rpTurnShape({ author: "半盏灯" }, s, false);
  assert.match(on, /页边批注/);
  assert.match(on, /半盏灯/, "写批注的时候得换成作者本人的站位，不是引擎在评论");
  assert.doesNotMatch(off, /页边批注 · 这一栏换一个人写/, "不要批注的那几拍还把整段人格发出去，等于白花钱");
  assert.match(off, /填空字符串/);
  // 语气跟着【被改了多少】走，而不是每次一个态度
  assert.match(on, /偏离度 40\/100/);
  assert.match(on, /被拦下的页数 1/);
  // 不许给内容示范（施工规则/prompt-no-content-samples.md）：给了就会被逐字照抄
  assert.doesNotMatch(on, /如「|比如「|例如「/);
});

test("正文永远不许因为 JSON 没解析出来而丢", () => {
  const bad = F.rpParseTurn("模型这次没按格式写，直接给了一整段正文。");
  assert.equal(bad.text, "模型这次没按格式写，直接给了一整段正文。");
  assert.equal(bad.hit, "");
  const good = F.rpParseTurn(JSON.stringify({ scene: "正文", hit: "b3", dev: 250, note: "一句" }));
  assert.equal(good.text, "正文");
  assert.equal(good.hit, "b3");
  assert.equal(good.dev, 100, "偏离度没夹在 0-100 里");
  // scene 空的时候也别把整段丢了
  assert.equal(F.rpParseTurn('{"scene":"","hit":""}').text, '{"scene":"","hit":""}');
});

test("走过的这一版放回书架，跟原篇并排摆着", () => {
  const sess = { id: "rp1", ficTitle: "值夜", tabId: "tb", cp: ["c1", "c2"],
    beats: [beat("b1", "灯下那盏茶", "kept"), beat("b2", "卷宗被掉包", "broken"), beat("b3", "雪夜跪门", "pending")],
    transcript: [{ who: "nar", text: "叙事一段" }, { who: "page", beat: "b2", label: "卷宗被掉包", keep: false }] };
  const f = F.rpToFic(sess, { author: "半盏灯" }, "行吧。");
  assert.equal(f.onShelf, true, "不进书架的话下次清理就把它扫了（protectedFic 认的是 onShelf）");
  assert.match(f.title, /值夜/);
  assert.match(f.chapters[0].content, /这本书被改了 1 处/);
  assert.match(f.chapters[0].content, /「卷宗被掉包」被拦下/);
  assert.match(f.chapters[0].content, /行吧。/, "作者的判词没写进末页");
  // 一页也没改的那一版要另说，不能也写「改了 0 处」
  const clean = F.rpToFic(Object.assign({}, sess, { beats: [beat("b1", "灯下那盏茶", "kept")] }), {}, "");
  assert.match(clean.chapters[0].content, /一页也没改/);
  // 作者署名照原篇的作者，没有就按 id 派生的笔名
  assert.equal(f.author, "半盏灯");
  assert.equal(F.rpAuthorName({ id: "f2" }), "笔名f2");
});

test("走到当口那一拍，两条路都摆在她面前，而且真的传下去了", () => {
  // ⚠️别拿「原著这一页本来写的是」当锚：genRPStart 的提示词里也有这句，
  // 找到的是那一处，然后整段断言都在扫提示词。认底部那张卡自己的东西。
  const a = fic.indexOf('h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14.5, color: t.ink, marginBottom: 4 } }, hitBeat.label)');
  assert.ok(a > 0, "抉择卡没了");
  const card = fic.slice(a, a + 1400);
  assert.match(card, /让它照原样发生/);
  assert.match(card, /拦下这一页/);
  assert.match(card, /resolve\(hitBeat, true\)/);
  assert.match(card, /resolve\(hitBeat, false\)/);
  // 结算真的走到引擎那一层
  assert.match(fic, /\{ resolve: \{ beat: bt, keep: !!keep \}, wantNote: true \}/);
  // 结算这一拍传下去的是【已经带上这一页】的那份，不是还没更新的 props.session
  // ⚠️收尾这个词文件里出现好几次，其中一处在 resolve 之前——
  // 不从 a 往后找的话 slice 会反过来、整段变成空串，断言全部静默通过。
  const ra = fic.indexOf("    async function resolve(bt, keep) {");
  assert.ok(ra > 0, "找不到 resolve");
  const r = fic.slice(ra, fic.indexOf("    // 收尾", ra));
  assert.ok(r.length > 400, "抠 resolve 抠空了");
  assert.match(r, /const sess2 = Object\.assign\(\{\}, s, \{[^}]*transcript: \(s\.transcript \|\| \[\]\)\.concat\(\[entry\]\)/,
    "传的是旧 session 的话，模型收不到「我把这一页拦下了」那一句");
  assert.match(r, /window\.Fanfic\.genRPTurn\(props\.active, sess2,/);
});

test("「轮到我了」认的是最后一段【叙事】，不是最后一条", () => {
  // 批注和结算掉的页都排在叙事后面：拿 trans.length-1 判的话，
  // 逐段展开和底部那个入口会一起失灵
  assert.match(fic, /for \(let i = trans\.length - 1; i >= 0; i--\) \{ if \(trans\[i\]\.who === "nar"\)/);
  // v62.50：读原文时也轮得到我——开局第一条是原文（who:"src"），lastNarIdx 还是 -1，
  // 用老条件的话「点住那一句动笔」永远出不来
  assert.match(fic, /const canAct = !busy && trans\.length > 0 && !moreToReveal && !s\.done;/);
  assert.doesNotMatch(fic, /const lastIsNar = /, "旧的那套判断还留着");
});

test("空手进来的人，走到跟前才知道这一页写的是什么", () => {
  // 「你带着什么进去」这一维现在真的改玩法，不只是提示词里多一段话
  assert.match(fic, /\(lit \|\| props\.spoiler\) \? bt\.label : "？"/);
  assert.match(fic, /\(selBeat\.state !== "pending" \|\| spoiler\) \? selBeat\.page :/);
  assert.match(fic, /const spoiler = s\.know === "spoiler";/);
});

test("书脊是一本书的脊背，不是一排药丸", () => {
  const a = fic.indexOf("  function RPSpine(props) {");
  const b = fic.indexOf("\n  // 穿书会话（互动叙事）", a);
  assert.ok(a > 0 && b > a, "找不到 RPSpine");
  const sp = fic.slice(a, b);
  // 三种状态形状各不相同，不是只换个色（色弱和阳光下只剩形状可依）
  assert.match(sp, /dashed/, "还没走到的那几页得是空心虚线");
  assert.match(sp, /background: st === "kept" \? t\.ink : t\.bg/, "照原样走过的那一页要是实心墨点");
  assert.match(sp, /rotate\(-40deg\)/, "被拦下的那一页要有一道划开的口子");
  assert.match(sp, /textDecoration: st === "broken" \? "line-through" : "none"/);
  // 深色主题里不许写死白色（tabs-not-plain-pills.md 那条）
  assert.doesNotMatch(sp, /#fff|#ffffff|"white"/i);
});
