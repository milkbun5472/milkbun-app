import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const comp = readFileSync(new URL("../js/components.js", import.meta.url), "utf8");
const scr = (readFileSync(new URL("../js/screens.js", import.meta.url), "utf8") + "\n" + readFileSync(new URL("../js/screens-ui.js", import.meta.url), "utf8"));
test("聊天多选画成四格漫画：分镜→一张图→app 排台词", () => {
  assert.match(comp, /"data-wk": "selcomic"[\s\S]{0,400}"画成漫画"/);   // v76.120 字号写成 calc(Npx * …)，样式变长
  assert.match(app, /onComic: \(?indices(, \w+\))? =>/);
  assert.match(app, /const comicFromMessages = async/);
  assert.match(app, /不要任何文字、不要对话气泡/);
  assert.match(app, /opt && opt\.comic \? await comicCompose/);
});
test("照相馆题材与换画风", () => {
  assert.match(app, /STUDIO_THEMES/);
  assert.match(app, /overlay: ?"magazine"/);
  assert.match(scr, /"data-wk": "studiothemes"/);
  assert.match(scr, /"data-wk": "studiorestyle"/);
});
