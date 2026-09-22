// 群里读者 2026-09-22：「点开一起读界面是这个」——白屏 + 那条红带。
//
// 真凶在 js/read.js：书架那一处把 askDrop【按值】递给了 useLongPressMenu，
// 而 askDrop 是几十行之后才 const 出来的 —— 这一行在【渲染那一刻】就要去取那个名字，
// TDZ 当场抛，React 把整棵树卸掉，屏幕一片白。
// 同一个文件底下那一册（AnnoBook）一直是包了一层的写法，这一处是漏掉的那一个。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = fs.readFileSync(path.join(__dirname, "..", "js", "read.js"), "utf8");

test("长按删那一处不许把还没声明的名字按值递进去", () => {
  const calls = [...read.matchAll(/useLongPressMenu\(([^)]*)\)/g)].map(m => m[1].trim());
  assert.ok(calls.length >= 2, "抠不出那两处长按");
  calls.forEach(v => assert.ok(/^function\s*\(/.test(v),
    "useLongPressMenu(" + v + ")：裸名字会在渲染那一刻就求值——它要是下面才 const 出来，就是白屏"));
});

// ⚠️这条不是只管这一行：同一个形状在别处照样会白屏，所以钉的是【这个文件里所有
//   const 出来的函数，不许在声明之前被当作值传出去】那一类写法里最常踩的那几个。
test("askDrop 和 askDropRow 都在声明之后才被用到", () => {
  ["askDrop", "askDropRow"].forEach(name => {
    const decl = read.indexOf("const " + name + " = ");
    assert.ok(decl > 0, "抠不出 " + name);
    // 声明之前只允许出现在【函数体里】（延后求值），不允许作为裸参数
    const before = read.slice(0, decl);
    const bare = new RegExp("[(,]\\\\s*" + name + "\\\\s*[),]");
    assert.ok(!bare.test(before), name + " 在声明之前就被当成值传出去了——渲染时 TDZ，整页白屏");
  });
});
