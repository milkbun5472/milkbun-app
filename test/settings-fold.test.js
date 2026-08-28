const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const screens = fs.readFileSync(require("node:path").join(__dirname, "../js/screens.js"), "utf8");

test("总设置页使用入口卡片和独立子页面", () => {
  assert.match(screens, /function ConfigTile\(/);
  assert.match(screens, /const \[page, setPage\] = useState\("home"\)/);
  for (const title of ["API 与模型", "感知", "创作小稿", "情侣问答", "外观与壁纸", "聊天气泡", "数据管理", "上下文诊断"])
    assert.match(screens, new RegExp(title));
});

test("API 入口按用途拆成独立卡片页", () => {
  for (const title of [
    "文字模型", "图像 API", "语音 API", "向量记忆", "真声耳朵", "额度与缓存"
  ]) assert.match(screens, new RegExp(title));
});

test("文字与图像 API 方案都能直接复制副本", () => {
  assert.match(screens, /const duplicateProfile = source =>/);
  assert.match(screens, /复制副本/);
  assert.match(screens, /const addSite = \(copy, source\) =>/);
});

test("API 列表和编辑表单分成两层页面", () => {
  assert.match(screens, /const \[editing, setEditing\] = useState\(false\)/);
  assert.match(screens, /if \(!editing\) return h\("div"/);
  assert.match(screens, /返回 API 方案/);
  assert.match(screens, /返回图像站点/);
});

test("隐藏配件暗门放在不会跳页的 CONFIG 标题", () => {
  assert.match(screens, /page === "home" \? h\("span", \{ onClick: e => \{ e\.stopPropagation\(\); toyKnock\(\); \}/);
  assert.doesNotMatch(screens, /title: "数据管理"[^\n]+toyKnock/);
});

test("数据页把空间、照片、云同步、备份和危险操作分别折叠", () => {
  assert.match(screens, /const \[part, setPart\] = useState\(""\)/);
  for (const title of ["本地空间", "本机照片库", "云同步", "导入与导出", "危险操作"])
    assert.match(screens, new RegExp(title));
});
