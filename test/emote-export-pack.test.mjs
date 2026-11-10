import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const ui = readFileSync(new URL("../js/screens-ui.js", import.meta.url), "utf8");
test("表情包页有导出这一版、导出全部", () => {
  assert.match(ui, /onExportPacks\(\[pack\.id\]\)/);
  assert.match(ui, /onExportPacks\(list\.map\(x => x\.id\)\)/);
  assert.match(app, /onExportPacks: exportEmotePacks/);
});
test("导出把图库里的图装进文件，导入只加不覆盖", () => {
  assert.match(app, /kind: "emotes", version: 1/);
  assert.match(app, /imgVaultFetchBlob\(url\)/);
  assert.match(app, /parsed\.kind === "emotes"\) return await importEmotePackFile/);
  assert.match(app, /commitEmotePacks\(\[\.\.\.\(emotePacksRef\.current \|\| \[\]\), \.\.\.add\]\)/);
});
