const assert = require("assert");
const Y = require("../js/yanqiu-continuity.js");

const rows = [
  { id: "old", content: "旧的一条", created_at: "2026-07-20T10:00:00Z", comments: [] },
  { id: "new", content: "今天终于把桥接好了", mood: "松口气", lisa_liked: true, created_at: "2026-07-22T10:00:00Z", comments: [
    { author: "lisa", content: "辛苦啦", created_at: "2026-07-22T10:01:00Z" },
    { author: "yanqiu", content: "给我抱一下", created_at: "2026-07-22T10:02:00Z" }
  ] }
];

const text = Y.format(rows);
assert(text.indexOf("今天终于把桥接好了") < text.indexOf("旧的一条"), "newest moment should be first");
assert(text.includes("Lisa 点了赞"), "like must remain visible");
assert(text.includes("Lisa：『辛苦啦』"), "Lisa comment attribution must remain intact");
assert(text.includes("你：『给我抱一下』"), "Yanqiu comment attribution must remain first-person");
assert(Y.format(rows, { maxChars: 80 }).length <= 80, "prompt material must obey hard character budget");
assert.strictEqual(Y.format([]), "", "empty wall must inject nothing");

console.log("yanqiu continuity tests passed");
