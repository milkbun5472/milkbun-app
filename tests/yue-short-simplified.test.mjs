import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const eng = readFileSync(new URL("../js/engine.js", import.meta.url), "utf8");
const a = eng.indexOf("function _transStrip("), b = eng.indexOf("\n}\n", eng.indexOf("function translatableLang(")) + 3;
const translatableLang = new Function(eng.slice(a, b) + "\nreturn translatableLang;")();
test("简体粤语短句一个粤语字也出「译」，普通话不误认", () => {
  for (const s of ["我要瞓啦 听日仲要去健身", "阿乖 生日快乐呢句我记低咗", "你拍我一下 就为咗讲句可爱", "我呢边眼都睁唔开", "讲真 你今晚点解咁精神"]) assert.equal(translatableLang(s), "粤语", s);
  for (const s of ["唔，好吧", "今天去健身了", "你在干嘛呀"]) assert.equal(translatableLang(s), "", s);
});
