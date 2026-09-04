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

test("线下与后台模型在文字 API 列表页统一选择", () => {
  assert.match(screens, /routeBox\("线下与创作模型"/);
  assert.match(screens, /routeBox\("后台任务模型"/);
  assert.match(screens, /不再绑在某一张 API 编辑卡里/);
});

test("语音页不再误挂图像站点编辑状态", () => {
  const tts = screens.slice(screens.indexOf("function TtsApiConfig"), screens.indexOf("function CacheStatCard"));
  assert.doesNotMatch(tts, /图像站点/);
  assert.doesNotMatch(tts, /setEditing/);
  const image = screens.slice(screens.indexOf("function ImageApiConfig"), screens.indexOf("function CtxDebug"));
  assert.match(image, /已保存 " \+ store\.profiles\.length \+ " 条/);
  assert.match(image, /返回图像站点/);
});

// v61.97 改：原来这个暗门挂在顶栏那行英文（"Config"）上，而 v61.40
// 「标题不留英文」之后 Head 不再渲染纯拉丁的 en——那个 span 连同暗门一起没了，
// 她只能来问「现在 toy 取消隐藏的条件是啥」。现在挂在【标题本身】上：
// 这一页只要还有标题，入口就还在，不会再被别的规矩顺手删掉。
test("隐藏配件暗门放在不会跳页的设置首页标题上", () => {
  assert.match(screens, /onTitleTap: page === "home" \? toyKnock : undefined/);
  assert.doesNotMatch(screens, /const eyebrow = page === "home"/, "挂在英文上那条老路还留着");
  assert.doesNotMatch(screens, /title: "数据管理"[^\n]+toyKnock/);
});

test("数据页把空间、照片、云同步、备份和危险操作分别做成入口盒子", () => {
  assert.match(screens, /const \[part, setPart\] = useState\(""\)/);
  assert.match(screens, /!part \? h\(ConfigTileGrid/);
  assert.match(screens, /返回数据管理/);
  for (const title of ["本地空间", "本机照片库", "云同步", "导入与导出", "危险操作"])
    assert.match(screens, new RegExp(title));
});

test("上下文诊断直接进入透视内容，不再套第二层折叠", () => {
  const ctx = screens.slice(screens.indexOf("function CtxDebug"), screens.indexOf("function ConfigFold"));
  assert.doesNotMatch(ctx, /setFolded/);
  assert.match(ctx, /上下文透视/);
});
