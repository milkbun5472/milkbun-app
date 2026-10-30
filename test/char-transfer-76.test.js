const test = require("node:test"), assert = require("node:assert"), T = require("../js/char-transfer.js");
const J = JSON.stringify;
const src = {
  x_characters: J([{ id: "c1", name: "甲" }, { id: "c10", name: "乙" }, { id: "c3", name: "丙" }]),
  x_groups: J([{ id: "g1", memberIds: ["c1", "c3"] }, { id: "g2", memberIds: ["c1", "c10"] }]),
  x_chats: J({ c1: [{ role: "user", content: "hi" }], c10: [{ role: "user", content: "x" }], "c1::r1": [{ content: "房里" }] }),
  "x_offline:c1": J([{ id: "s1" }]), "x_offline:c10": J([{ id: "s2" }]),
  x_rels: J([{ id: "r1", from: "c1", to: "c3" }, { id: "r2", from: "c1", to: "c10" }]),
  x_memLib: J([{ id: "m1", text: "a", charIds: ["c1"] }, { id: "m2", text: "b", charIds: ["c10"] }, { id: "m3", text: "全局" }]),
  x_groupChats: J({ g1: [{ content: "群" }], g2: [{ content: "别的群" }] }),
  x_theme: J({ bg: "#fff" }), x_api: J([{ url: "k" }]), x_profile: J({ name: "我" })
};
test("只挑跟这几个人有关的；牵扯到没选的人、全局的都不带；c1 不会认成 c10", () => {
  const p = T.pick(src, ["c1", "c3"]);
  const d = p.data;
  assert.deepEqual(JSON.parse(d.x_characters).map(c => c.id), ["c1", "c3"]);
  assert.deepEqual(JSON.parse(d.x_groups).map(g => g.id), ["g1"]);
  assert.deepEqual(Object.keys(JSON.parse(d.x_chats)).sort(), ["c1", "c1::r1"]);
  assert.ok(d["x_offline:c1"] && !d["x_offline:c10"]);
  assert.deepEqual(JSON.parse(d.x_rels).map(r => r.id), ["r1"]);
  assert.deepEqual(JSON.parse(d.x_memLib).map(m => m.id), ["m1"]);
  assert.deepEqual(Object.keys(JSON.parse(d.x_groupChats)), ["g1"]);
  assert.ok(!d.x_theme && !d.x_api && !d.x_profile);
});
test("合并：加进去不覆盖，编号撞了换新号，提到它的地方一起换", () => {
  const pack = Object.assign(T.pick(src, ["c1"]), { selfies: { img_c1_1: "data:x" } });
  const local = { x_characters: J([{ id: "c1", name: "本机的甲" }]), x_chats: J({ c1: [{ content: "本机" }] }), x_theme: J({ bg: "#000" }) };
  const r = T.merge(local, pack);
  const nid = r.map.c1;
  assert.ok(nid && nid !== "c1");
  const chars = JSON.parse(r.writes.x_characters);
  assert.deepEqual(chars.map(c => c.id), ["c1", nid]);
  assert.equal(chars[0].name, "本机的甲");
  const chats = JSON.parse(r.writes.x_chats);
  assert.deepEqual(chats.c1, [{ content: "本机" }]);
  assert.ok(chats[nid] && chats[nid + "::r1"]);
  assert.ok(r.writes["x_offline:" + nid]);
  assert.ok(!("x_theme" in r.writes));
  assert.ok(r.pack.selfies["img_" + nid + "_1"]);
});
