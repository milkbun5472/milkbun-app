// v62.06 的名片头像那圈奶油边把整个 App 开不了机（一进去就是救援页）。
//
// 病：components.js 里直接喊了 `skinShade(t.bg2, .3)`，而 skinShade 那时候只长在
//     js/fanfic.js 的闭包里——同一个页面里加载了、但根本不在全局作用域上。
//     浏览器抛 ReferenceError，React 整棵树挂掉，`启动出错了` 兜底页接管。
//
// 它旁边那个 skinIsDark 反而没事：因为它是 core.js 顶层的真全局。
// 一行代码里一个能用、一个不能用，长得一模一样——这正是这一类 bug 最坑的地方，
// 而 node --test 那 3200 条一条都没响：没有任何一条测试真的把这些文件放一起跑过。
//
// 判据（跟 four-surfaces 那条同源）：**这一处是靠什么把这个函数拿到手的？**
//   顶层定义 → 谁都拿得到；别人闭包里的 → 换个文件就一个字都没有，
//   而且不会留下任何能 grep 的痕迹让你发现它不见了。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const jsDir = path.join(root, "js");
const files = fs.readdirSync(jsDir).filter(f => f.endsWith(".js"));
const src = Object.fromEntries(files.map(f => [f, fs.readFileSync(path.join(jsDir, f), "utf8")]));

// 主题色那一家：一律靠裸名字调用、一律跨文件用，所以一律必须是顶层真全局
const FAMILY = ["skinRGB", "skinIsDark", "skinShade"];

test("skin 那一家全在 core.js 顶层，且只有一份", () => {
  FAMILY.forEach(name => {
    const top = new RegExp("^function " + name + "\\(", "m");
    assert.match(src["core.js"], top, name + " 不在 core.js 顶层——跨文件调用会 ReferenceError");
    // 别处再长一份就是「一层写在两处」：改了这边那边不跟，颜色会对不上
    files.filter(f => f !== "core.js").forEach(f => {
      assert.doesNotMatch(src[f], new RegExp("(?:function|const|let|var)\\s+" + name + "\\b"),
        "js/" + f + " 又自己留了一份 " + name);
    });
  });
});

test("凡是喊了 skin 那几个名字的文件，都真拿得到（不是靠别人的闭包）", () => {
  const globals = new Set();
  files.forEach(f => {
    let m;
    const re = /^(?:function|const|let|var)\s+([A-Za-z_$][\w$]*)/gm;
    while ((m = re.exec(src[f]))) globals.add(m[1]);
  });
  files.forEach(f => {
    // 裸名字调用（排除 obj.skinShade( 这种成员调用）
    const called = [...src[f].matchAll(/(?<![.\w$])(skin[A-Z]\w*)\s*\(/g)].map(m => m[1]);
    [...new Set(called)].forEach(name => assert.ok(globals.has(name),
      "js/" + f + " 调了 " + name + "，但它不是任何文件的顶层定义——开机就崩"));
  });
});

test("名片头像那一行确实是这么调的（回归点本身别被改没了）", () => {
  const i = src["components.js"].indexOf("onClick: onEditProfile");
  assert.ok(i > 0, "名片头像那个按钮没了");
  assert.match(src["components.js"].slice(i, i + 400), /skinShade\(t\.bg2/,
    "那圈奶油边不再走 skinShade 的话，这条回归要重新挑锚点");
});
