import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
test("从别的房间带回主聊天的交接带上是哪天的事", () => {
  global.fmtStampAI = () => "前天";
  global.localStorage = { getItem: () => JSON.stringify([{ personId: "c1", roomName: "小号", summary: "她用小号来找过我", ts: 1, toTs: 100 }]), setItem() {} };
  const R = require("../js/chat-rooms.js");
  assert.match(R.prompt({ id: "main", personId: "c1", carryCount: 4 }, []), /「小号」（前天）：她用小号来找过我/);
});
