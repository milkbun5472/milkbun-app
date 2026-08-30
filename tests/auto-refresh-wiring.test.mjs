import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const screens = fs.readFileSync(new URL("../js/screens.js", import.meta.url), "utf8");
const weekly = fs.readFileSync(new URL("../js/weekly.js", import.meta.url), "utf8");

test("automatic content paths pass through the global and character policy", () => {
  for (const id of ["phone", "diary", "wallet", "schedule", "desire", "moments", "forum", "whisper", "capsule", "proactive"]) {
    assert.match(app, new RegExp(`autoRefreshOn\\(\\"${id}\\"`), `missing ${id} gate`);
  }
});

test("settings exposes a master switch and expandable character scope", () => {
  assert.match(screens, /title: "自动更新"/);
  assert.match(screens, /props\.onSetGlobal\(f\.id, on\)/);
  assert.match(screens, /props\.onSetChar\(f\.id, c\.id, on\)/);
  assert.match(screens, /scrollRef\.current\.scrollTop = 0/);
});

test("weekly auto bind is opt-in and uses only selected participants", () => {
  assert.match(weekly, /if \(!props\.autoEnabled/);
  assert.match(weekly, /const participants = props\.autoCharacters \|\| \[\]/);
});
