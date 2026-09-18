// 换字体（她 2026-09-18 转小红书里读者「老大问问秋秋怎么换字体呀！」）
//
// 全 App 的字体只有两支：正文（F_BODY）和标题（F_DISPLAY）。它们在 core.js 里
// 被写成 CSS 变量，四十来个文件、五千来处行内样式全都从那两个变量里取值——
// 所以换字体这件事最后只是【改两个变量】，不用碰任何一处界面代码。
//
// ⚠️字体名单只有这一份。主题工作台的选单、compile 出来的 CSS、要不要去 Google
//   拉字体，三处都问它要（one-public-mechanism）。另抄一份就是又开了一处要同步的地方。
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FontChoice = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  // google：Google Fonts css2 的 family 串；空＝手机／电脑自带，不用下载。
  // ⚠️自带那几支写的是 iOS 和安卓两边的名字，谁有算谁的，最后还兜一档通用的。
  const FACES = Object.freeze([
    { key: "",          zh: "默认",     hint: "原来那套",       stack: "",  google: "" },
    { key: "songti",    zh: "思源宋体", hint: "有笔锋，偏文气", stack: "'Noto Serif SC',serif", google: "Noto+Serif+SC:wght@400;500" },
    { key: "heiti",     zh: "思源黑体", hint: "干净，最好读",   stack: "'Noto Sans SC',sans-serif", google: "Noto+Sans+SC:wght@400;500;700" },
    { key: "xiaowei",   zh: "站酷小薇", hint: "细宋，清瘦",     stack: "'ZCOOL XiaoWei',serif", google: "ZCOOL+XiaoWei" },
    { key: "kuaile",    zh: "站酷快乐", hint: "圆头，孩子气",   stack: "'ZCOOL KuaiLe',cursive", google: "ZCOOL+KuaiLe" },
    { key: "maobi",     zh: "毛笔手写", hint: "浓墨，适合标题", stack: "'Ma Shan Zheng',cursive", google: "Ma+Shan+Zheng" },
    { key: "shouxie",   zh: "钢笔手写", hint: "细手写，像信",   stack: "'Zhi Mang Xing',cursive", google: "Zhi+Mang+Xing" },
    { key: "sysKai",    zh: "系统楷体", hint: "自带，不用下载", stack: "'Kaiti SC','STKaiti','KaiTi','楷体',serif", google: "" },
    { key: "sysSong",   zh: "系统宋体", hint: "自带，不用下载", stack: "'Songti SC','STSong','SimSun','宋体',serif", google: "" },
    { key: "sysHei",    zh: "系统黑体", hint: "自带，不用下载", stack: "'PingFang SC','HarmonyOS Sans SC','Microsoft YaHei','微软雅黑',system-ui,sans-serif", google: "" }
  ]);

  const faceOf = key => FACES.filter(f => f.key && f.key === String(key || ""))[0] || null;
  // 认不出的（存档是别人的、或者名单以后删过某一支）一律当「默认」，不许把变量写成空值
  const clean = raw => {
    const x = raw && typeof raw === "object" ? raw : {};
    const one = k => (faceOf(x[k]) ? String(x[k]) : "");
    return { body: one("body"), display: one("display") };
  };
  const stackOf = key => { const f = faceOf(key); return f ? f.stack : ""; };

  // 挑了哪几支就要去拉哪几支；自带的那几支 google 是空串，天然不进这张单子。
  const googleSpecs = fonts => {
    const c = clean(fonts);
    return [...new Set([c.body, c.display].map(k => { const f = faceOf(k); return f ? f.google : ""; }).filter(Boolean))];
  };

  // compile 出来的 CSS 头一段。两支都没挑就一个字都不发——
  // core.js 那两个 var() 自带兜底值，没有这段就是原来那套。
  const cssVars = fonts => {
    const c = clean(fonts), rows = [];
    if (c.body) rows.push("  --f-body: " + stackOf(c.body) + ";");
    if (c.display) rows.push("  --f-display: " + stackOf(c.display) + ";");
    return rows.length ? ":root {\n" + rows.join("\n") + "\n}" : "";
  };

  // 真去把字体文件拉下来。同一个 spec 只挂一次 <link>；断网就是拉不到，
  // 那时候 var() 里那串备选名会顺位往下找，不会变成没有字。
  const LINK_MARK = "data-lisa-font";
  const ensure = fonts => {
    if (typeof document === "undefined") return [];
    const specs = googleSpecs(fonts), added = [];
    specs.forEach(spec => {
      if (document.querySelector('link[' + LINK_MARK + '="' + spec + '"]')) return;
      const el = document.createElement("link");
      el.rel = "stylesheet"; el.setAttribute(LINK_MARK, spec);
      el.href = "https://fonts.googleapis.com/css2?family=" + spec + "&display=swap";
      document.head.appendChild(el); added.push(spec);
    });
    return added;
  };

  return { FACES, faceOf, clean, stackOf, googleSpecs, cssVars, ensure, LINK_MARK };
});
