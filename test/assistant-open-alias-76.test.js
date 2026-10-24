// 她 2026-10-24 截图：秋秋出的跳转卡写「messages」，攻略里那条叫 chat →「没应用」；回话里的 ** 原样露着
const assert = require("node:assert/strict"), fs = require("fs");
const ex = fs.readFileSync("js/assistant-extras.js", "utf8"), app = fs.readFileSync("js/app.js", "utf8"), as = fs.readFileSync("js/assistant.js", "utf8");
const a = ex.indexOf("  const OPEN_ID_ALIAS"), b = ex.indexOf("  TARGETS.open = {", a);
const openEntry = new Function("S", ex.slice(a, b) + ";return openEntry;")(x => String(x == null ? "" : x));
const E = [{ id: "chat", app: "chat", zh: "说话 · 单聊" }, { id: "config", app: "config", zh: "设置" }, { id: "gacha", app: "couple", zh: "抽卡" }, { id: "couple", app: "couple", zh: "情侣空间" }];
const M = { entries: E, byId: id => E.find(x => x.id === id) || null };
assert.equal(openEntry(M, "messages").id, "chat");
assert.equal(openEntry(M, "Settings").id, "config");
assert.equal(openEntry(M, "设置").id, "config");
assert.equal(openEntry(M, "gacha").id, "gacha", "认得的 id 照旧");
assert.equal(openEntry(M, "瞎写的"), null);
assert.match(ex, /const e = openEntry\(M, eid\);/);
assert.match(ex, /OPEN_APP_SUBS\.chat = \{ chats: "聊天", contacts: "通讯录", moments: "朋友圈", me: /);
assert.match(app, /if \(app === "chat" && parts\.length === 1 && \["chats", "contacts", "moments", "me"\]\.indexOf\(parts\[0\]\) >= 0\) \{ setMsgTab\(parts\[0\]\); setScreen\("messages"\); return true; \}/);
assert.match(as, /WebkitUserSelect: "text" \} \}, qqBold\(m\.text\)\)/);
console.log("ok");
