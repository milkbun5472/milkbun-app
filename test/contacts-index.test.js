const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const R = f => path.join(__dirname, "..", "js", f);
const engine = fs.readFileSync(R("engine.js"), "utf8");
const comp = fs.readFileSync(R("components.js"), "utf8");
const app = fs.readFileSync(R("app.js"), "utf8");

const i = engine.indexOf("const PINYIN_ANCHORS");
const py = new Function(engine.slice(i, engine.indexOf("// 重复规则（v56.35）")) + "\nreturn { pinyinInitial, pinyinSections, _pyCollator };")();

// 她 2026-08-26：「通讯录按微信那样按首字母排，有备注按备注首字母，没有按实际名字」
test("汉字取拼音首字母，不靠拼音表", () => {
  assert.ok(py._pyCollator, "这台机器的 Intl 没带拼音排序，下面的断言无从谈起");
  [["裴照川", "P"], ["沈屿白", "S"], ["顾朝", "G"], ["江识", "J"], ["陆衍", "L"], ["许言秋", "X"], ["阿朝", "A"]]
    .forEach(([n, L]) => assert.equal(py.pinyinInitial(n), L, n));
});

test("英文名按自己的首字母，其它一律进 #", () => {
  assert.equal(py.pinyinInitial("Lisa"), "L");
  assert.equal(py.pinyinInitial("v"), "V");
  assert.equal(py.pinyinInitial("0号"), "#");
  assert.equal(py.pinyinInitial(""), "#");
  assert.equal(py.pinyinInitial(null), "#");
});

test("有备注按备注排，没备注才按本名", () => {
  const secs = py.pinyinSections([{ id: 1, name: "沈屿白", remark: "阿屿" }, { id: 2, name: "裴照川" }]);
  const A = secs.find(s => s.letter === "A");
  assert.ok(A && A.items[0].id === 1, "阿屿要落在 A，不是 S");
  assert.ok(secs.some(s => s.letter === "P"));
  assert.ok(!secs.some(s => s.letter === "S"));
});

test("# 永远排最后", () => {
  const secs = py.pinyinSections([{ name: "0号" }, { name: "阿朝" }, { name: "张三" }]);
  assert.deepEqual(secs.map(s => s.letter), ["A", "Z", "#"]);
});

test("Intl 不给力时全体落到 #，至少不乱排", () => {
  const seg = engine.slice(i, engine.indexOf("// 重复规则（v56.35）"));
  const noIntl = new Function("Intl", seg + "\nreturn { pinyinInitial, pinyinSections };")({ Collator: function () { throw new Error("no icu"); } });
  assert.equal(noIntl.pinyinInitial("裴照川"), "#");
  assert.equal(noIntl.pinyinInitial("Lisa"), "L", "拉丁字母不依赖 Intl，照旧");
  assert.deepEqual(noIntl.pinyinSections([{ name: "裴照川" }, { name: "阿朝" }]).map(s => s.letter), ["#"]);
});

// 她 2026-08-26：「做截图这俩收纳放字母分类上面」
test("通讯录顶上是群聊和标签两个入口，下面才是字母分组", () => {
  const seg = comp.slice(comp.indexOf('tab === "contacts" && (() => {'), comp.indexOf('tab === "moments"'));
  const gi = seg.indexOf('entry("群聊"'), ti = seg.indexOf('entry("标签"'), si = seg.indexOf("secs.map(sec =>");
  assert.ok(gi > 0 && ti > gi, "群聊在标签上面");
  assert.ok(si > ti, "两个入口都要排在字母分组上面");
  assert.match(comp, /pinyinSections\(characters\)/);
  assert.match(seg, /id: "mcontact-" \+ sec\.letter/, "字母分组要有锚点，右边索引才跳得过去");
  // v60.73：索引条搬出了滚动区（原来跟着内容滚，得下滑一段才露出来），
  // 所以它不在这一段里；这里只钉「列表和索引用的是同一份分组」。
  assert.match(seg, /const secs = contactSecs\.length \? contactSecs/, "列表和索引必须共用同一份分组");
});

// 她 2026-09-03：「通讯录旁边的字母不是固定在侧边的，要下滑才有」
test("A-Z 索引钉在不滚的那一层，且跟着滚动高亮当前那一格", () => {
  assert.match(comp, /const listRef = useRef\(null\)/);
  assert.match(comp, /ref: listRef,\n\s*className: "h-full overflow-y-auto"/, "滚动容器要拿得到 ref");
  // 索引条是滚动容器的兄弟，挂在 relative 的外壳上
  assert.match(comp, /className: "flex-1 min-h-0", style: \{ position: "relative" \}/);
  assert.match(comp, /tab === "contacts" && characters\.length > 6 && contactSecs\.length > 1/);
  assert.match(comp, /position: "absolute", right: 0, top: 0, bottom: 0, width: 24/);
  // 旧的那条（absolute 挂在会滚的内容上）必须是删掉的，不是留着
  assert.doesNotMatch(comp, /右侧 A-Z 索引条/);
  // 滚到哪一段哪一格上墨
  assert.match(comp, /setCurLetter\(c => c === cur \? c : cur\)/);
  assert.match(comp, /const on = curLetter === sec\.letter/);
});

test("群聊入口列出所有群，标签走原来那个分组管理", () => {
  assert.match(comp, /groupList && h\(Sheet/);
  assert.match(comp, /setGroupList\(false\); onOpenGroup && onOpenGroup\(g\)/, "点一个群要能直接进去");
  assert.match(comp, /setGroupList\(false\); onNewGroup && onNewGroup\(\)/, "也能从这儿新建");
  assert.match(comp, /entry\("标签".*?setGroupMgr\(true\)/s);
});

// 她 2026-08-26：「聊天顶上做个微信一样的搜索框」
test("聊天列表顶部有搜索，名字和最后一条消息都能搜", () => {
  assert.match(comp, /const \[q, setQ\] = useState\(""\)/);
  assert.match(comp, /const shownItems = chatItems\.filter\(hitItem\)/);
  const hit = comp.slice(comp.indexOf("const hitItem = it =>"), comp.indexOf("const shownItems"));
  assert.match(hit, /it\.g\.name/);
  assert.match(hit, /it\.c\.remark/);
  assert.match(hit, /it\.last\.content/, "最后一条消息也要能搜到");
  assert.match(comp, /没搜到「/, "搜不到要有话说，别只剩一片空白");
});

// 她 2026-08-26 问：加了皇帝 NPC 以后他会出现在朋友圈评论吗 → 熟人名单要真的写进提示词。
// 但她随后拦下了「只能从名单里挑」那版：「原本其他角色能看到他们的同学舍友评论还挺有意思的
// 不要收紧」——所以名单是【优先】，不是【白名单】。
test("熟人名单写进提示词，但只当优先人选、不封死", () => {
  const seg = app.slice(app.indexOf("const genMoment = async char =>"), app.indexOf("const likeMoment"));
  assert.match(seg, /const peerNames = /);
  assert.match(seg, /liveChars\.forEach\(o => \{ if \(rels\[char\.id \+ "->" \+ o\.id\] \|\| rels\[o\.id \+ "->" \+ char\.id\]\)/, "任一方向有关系就算");
  assert.match(seg, /npcsOf\(char\.id\)\.forEach\(add\)/, "自己的 NPC 也要算进来");
  assert.match(seg, /peerNames\.join\("、"\)/, "得把名字真的写进提示词，光说「从关系网里挑」不算");
  assert.match(seg, /【优先】人选/);
  assert.match(seg, /也【不限于】这些人/, "同学舍友那种没建卡的人还得能来评论");
  assert.match(seg, /同学、舍友、同事、下属、邻居、旧友/);
  assert.ok(!/只能从这份名单里挑/.test(seg), "别再退回白名单那版");
});
