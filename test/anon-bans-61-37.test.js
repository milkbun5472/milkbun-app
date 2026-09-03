// v61.37 她 2026-09-03：「匿名信箱的 prompt 还是语气不对为啥」。
//
// 病根和 v60.27 通话、v61.16 穿书那两次一字不差：这三层规则是【靠调用点一条条 push 的】，
// 不是 buildBundle 白送的 —— 换个入口就一条都没有，而且不会留下任何能 grep 的痕迹。
// 匿名箱手上全是【问句】，逐条作答时最顺手的开口就是把问题原样反问回来，
// 所以「回声禁令」这一处尤其不能少。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const app = fs.readFileSync("js/app.js", "utf8");

const grab = (from, to) => {
  const a = app.indexOf(from); const b = app.indexOf(to, a);
  assert.ok(a > 0 && b > a, "抠不出：" + from);
  return app.slice(a, b);
};

test("三层写成一份共用的，不许两条路各抄一遍", () => {
  assert.match(app, /const anonBans = \(\) =>/);
  assert.match(app, /ECHO_QUESTION_BAN[\s\S]{0,80}REGISTER_FOLLOWS_SCENE/);
  assert.match(app, /window\.ReplyPacing \? "\\n\\n" \+ window\.ReplyPacing\.reading\(\)/);
  // 只此一份
  assert.equal((app.match(/const anonBans = /g) || []).length, 1);
});

test("两条匿名路都接上了（陌生网友 / 她自己攒的那一箱）", () => {
  const netizen = grab("const genNetizenQ = async char => {", "  // 我问的:先【放进箱子】");
  const box = grab("const openAnonBox = async char => {", "\n  const askAnon");
  assert.match(netizen, /\+ anonBans\(\),/, "陌生网友那一路没接");
  assert.match(box, /\+ anonBans\(\),/, "她自己那一箱没接");
  // 定义那一行写的是 `const anonBans = () =>`，不含 "anonBans()"，所以这里数到的就是【用了几处】
  assert.equal((app.match(/\+ anonBans\(\),/g) || []).length, 2, "接的处数变了，检查是不是又多了一条路没接");
});

test("『可以反问回去』旁边要说清跟回声的区别", () => {
  // 这两句原来紧挨着：一句鼓励反问，一句禁止回声。不说清区别，模型只会照着前一句写。
  const hits = app.match(/可以反问回去\(但别把人家的原话原样抛回来当问句,那是回声,见下\)/g) || [];
  assert.equal(hits.length, 2, "两条路都得说清");
});

test("树洞的语域要单独点明：对陌生人和对熟人不是一个分寸", () => {
  assert.match(app, /【这是树洞，不是聊天】/);
});

test("这条规矩自己也得改：名单从六处变七处", () => {
  const rule = fs.readFileSync(".claude/rules/four-surfaces-same-context.md", "utf8");
  assert.match(rule, /名单是【七处】/);
  assert.match(rule, /匿名信箱是第七处/);
  // 每补一处都要在那张表里留一行，否则下一个人还会漏
  assert.match(rule, /\| v61\.37 \| \*\*匿名信箱也不在这张名单上\*\*/);
});
