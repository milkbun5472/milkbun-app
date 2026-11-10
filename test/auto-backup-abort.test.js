const test = require("node:test"); const assert = require("node:assert"); const fs = require("fs");
test("挑文件夹被系统拒（AbortError）时给中文出路，不露英文", async () => {
  const src = fs.readFileSync(__dirname + "/../js/auto-backup.js", "utf8");
  const g = { showDirectoryPicker: async () => { const e = new Error("The user aborted a request."); e.name = "AbortError"; throw e; } };
  const fn = new Function("globalThis", "window", src + "\n;return (globalThis.AutoBackup||window.AutoBackup);");
  let api; try { api = fn(g, g); } catch (e) { api = g.AutoBackup; }
  api = api || g.AutoBackup;
  await assert.rejects(() => api.pick(), e => /新建一个文件夹/.test(e.message));
});
