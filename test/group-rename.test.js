const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const comp = fs.readFileSync(path.join(root, "js/components.js"), "utf8");

// 她 2026-08-28：「群聊好像从来没设置可以改名，找了一圈没找到」。
// 确实没有——「群名称」那个输入框一直只在 NewGroupSheet（建群）里，
// GroupSettingsSheet 的 onSave 里压根没有 name 这个字段。

test("群设置页要有群名输入框，并且真的传出去", () => {
  const sheet = comp.slice(comp.indexOf("function GroupSettingsSheet("), comp.indexOf("function NewGroupSheet("));
  assert.match(sheet, /const \[gName, setGName\] = useState\(\(group && group\.name\) \|\| ""\)/);
  assert.match(sheet, /placeholder: "群名称"/);
  assert.match(sheet, /defaultOffline: gDefaultOffline, name: gName \}\)/, "存的时候要把 name 一起带上");
  assert.match(sheet, /maxLength: 24/);
});

// 群产生的记忆打的是「群聊 + 群名」这对 tag（groupId 是本地字段，云端同步一圈就没了）。
// 只改 groups 里那个字段的话，旧记忆会变成孤儿：召不回来，清群时也删不掉。
const renameSrc = (() => {
  const i = app.indexOf("  const renameGroup = (groupId, rawName) => {");
  assert.ok(i > 0, "renameGroup 没了");
  return app.slice(i, app.indexOf("\n  };", i) + 5);
})();

const drive = ({ groups, mem, id, name }) => {
  const st = { patch: null, saved: null, toast: "" };
  const fn = new Function("groups", "updateGroup", "memLibRef", "saveMemLib", "toast",
    renameSrc + "\nreturn renameGroup;")(
      groups,
      (gid, patch) => { st.patch = { gid, patch }; },
      { current: mem },
      next => { st.saved = next; },
      msg => { st.toast = msg; });
  fn(id, name);
  return st;
};

const base = () => ({
  groups: [{ id: "g1", name: "三人群" }],
  mem: [
    { id: "m1", text: "在群里聊了排骨汤", tags: ["群聊", "三人群"] },
    { id: "m2", text: "另一个群的事", tags: ["群聊", "朝暮"] },
    { id: "m3", text: "私聊的事", tags: ["日常"] }
  ]
});

test("改名要同时迁走记忆的标签，别把旧记忆变成孤儿", () => {
  const r = drive({ ...base(), id: "g1", name: "王府夜话" });
  assert.deepEqual(r.patch, { gid: "g1", patch: { name: "王府夜话" } });
  assert.ok(r.saved, "记忆库没被写回");
  assert.deepEqual(r.saved[0].tags, ["群聊", "王府夜话"]);
  assert.deepEqual(r.saved[1].tags, ["群聊", "朝暮"], "别的群不许动");
  assert.deepEqual(r.saved[2].tags, ["日常"], "私聊记忆不许动");
  assert.match(r.toast, /迁走 1 条/);
});

test("名字没变、空名、群不存在都直接不动", () => {
  assert.equal(drive({ ...base(), id: "g1", name: "三人群" }).patch, null);
  assert.equal(drive({ ...base(), id: "g1", name: "   " }).patch, null);
  assert.equal(drive({ ...base(), id: "nope", name: "随便" }).patch, null);
});

test("首尾空格要去掉，超过 24 字截断", () => {
  assert.equal(drive({ ...base(), id: "g1", name: "  王府夜话  " }).patch.patch.name, "王府夜话");
  assert.equal(drive({ ...base(), id: "g1", name: "长".repeat(40) }).patch.patch.name, "长".repeat(24));
});

test("没有记忆要迁时也照常改名，别静默失败", () => {
  const r = drive({ groups: [{ id: "g1", name: "三人群" }], mem: [], id: "g1", name: "王府夜话" });
  assert.deepEqual(r.patch, { gid: "g1", patch: { name: "王府夜话" } });
  assert.equal(r.saved, null, "没东西要迁就别白写一次盘");
  assert.equal(r.toast, "已改名");
});

test("群名住在 group 上、别的住在 groupSettings 上——保存时要拆开", () => {
  assert.match(app, /const \{ name: _gname, \.\.\.rest \} = patch \|\| \{\};/);
  assert.match(app, /if \(_gname != null\) renameGroup\(activeGroup\.id, _gname\);/);
  assert.match(app, /if \(Object\.keys\(rest\)\.length\) saveGroupSettings\(activeGroup\.id, rest\);/);
});
