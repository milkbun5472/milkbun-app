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

  // ── 自己传的字体（她 2026-09-18：「能不能搞一个可以上传自定义字体的」）────────
  // 两条路，因为外面这件事本来就有两种形态：
  //   kind:"file" —— 一个字体文件（.woff2 / .woff / .ttf / .otf）。存进图片保险箱
  //     （那本来就是个通用的 blob 仓，不是只能放图），@font-face 直接指 blob 地址。
  //     ⚠️字族名由我们自己造（lisa-u-<id>），不问文件里写的是什么——中文字体的
  //       内部字族名十有八九是英文缩写，猜错就是一个字都不生效。
  //   kind:"link" —— 一条 CSS 链接（Google Fonts、中文网字计划那种）。不占存储、
  //     自带按字分包所以手机上快，但断网就没有，而且字族名只有对面知道，得她填。
  const CUSTOM_MAX = 8;
  const FILE_EXT = Object.freeze([".woff2", ".woff", ".ttf", ".otf"]);
  // 字族名要原样写进 CSS，所以只留人能读的那几类字符。引号大括号分号一律不许过去。
  const safeFamily = raw => String(raw || "").replace(/[^0-9A-Za-z\u4e00-\u9fa5 _-]/g, "").trim().slice(0, 40);
  const safeId = raw => String(raw || "").replace(/[^0-9a-z]/gi, "").slice(0, 24);
  // 一条自定义字体洗成名单里的一张卡；洗不出来（缺文件、缺字族名）就返回 null，
  // 让它在名单里直接不出现——宁可少一张卡，也不要一张点了没反应的卡。
  const customFace = e => {
    if (!e || typeof e !== "object") return null;
    const id = safeId(e.id), zh = safeFamily(e.name);
    if (!id || !zh) return null;
    if (e.kind === "file") {
      if (!/^iv_[A-Za-z0-9_-]+$/.test(String(e.ref || ""))) return null;
      const c = { id, kind: "file", name: zh, ref: String(e.ref) };
      return { key: "u:" + id, zh, hint: "你传的", stack: "'lisa-u-" + id + "',sans-serif", google: "", custom: c, family: "lisa-u-" + id };
    }
    if (e.kind === "link") {
      const fam = safeFamily(e.family);
      if (!fam || !/^https:\/\//.test(String(e.href || ""))) return null;
      const c = { id, kind: "link", name: zh, family: fam, href: String(e.href) };
      return { key: "u:" + id, zh, hint: "链接", stack: "'" + fam + "',sans-serif", google: "", custom: c, family: fam };
    }
    return null;
  };
  const customList = custom => (Array.isArray(custom) ? custom : []).slice(0, CUSTOM_MAX).map(customFace).filter(Boolean);
  // 名单只有这一处：内置那十支 + 她自己传的那几支。别处不许再拼一份。
  const facesWith = custom => FACES.concat(customList(custom));

  const faceOf = (key, custom) => facesWith(custom).filter(f => f.key && f.key === String(key || ""))[0] || null;
  // 认不出的（存档是别人的、或者名单以后删过某一支）一律当「默认」，不许把变量写成空值
  const clean = (raw, custom) => {
    const x = raw && typeof raw === "object" ? raw : {};
    const one = k => (faceOf(x[k], custom) ? String(x[k]) : "");
    return { body: one("body"), display: one("display") };
  };
  const stackOf = (key, custom) => { const f = faceOf(key, custom); return f ? f.stack : ""; };

  // 挑了哪几支就要去拉哪几支；自带的那几支 google 是空串，天然不进这张单子。
  const googleSpecs = (fonts, custom) => {
    const c = clean(fonts, custom);
    return [...new Set([c.body, c.display].map(k => { const f = faceOf(k, custom); return f ? f.google : ""; }).filter(Boolean))];
  };
  // 挑中的那几支里，走链接那一路的（要挂 <link>）
  const linkHrefs = (fonts, custom) => {
    const c = clean(fonts, custom);
    return [...new Set([c.body, c.display].map(k => { const f = faceOf(k, custom); return (f && f.custom && f.custom.kind === "link") ? f.custom.href : ""; }).filter(Boolean))];
  };
  // 挑中的那几支里，走文件那一路的保险箱键（导出主题包时要跟着一起打包）
  const fileRefs = (fonts, custom) => {
    const c = clean(fonts, custom);
    return [...new Set([c.body, c.display].map(k => { const f = faceOf(k, custom); return (f && f.custom && f.custom.kind === "file") ? f.custom.ref : ""; }).filter(Boolean))];
  };

  // compile 出来的 CSS 头一段。两支都没挑就一个字都不发——
  // core.js 那两个 var() 自带兜底值，没有这段就是原来那套。
  // 她自己传的文件那几支的 @font-face，全发一遍。选单里要画字样卡就得靠它
  // （卡上那支字还没被挑中，走不到 cssVars 那条路）。找不到文件的那支直接不发。
  const faceBlocks = (custom, resolve) => customList(custom)
    .filter(f => f.custom.kind === "file")
    .map(f => {
      const url = typeof resolve === "function" ? resolve(f.custom.ref) : "";
      if (!url) return "";
      return "@font-face {\n  font-family: '" + f.family + "';\n  src: url(\"" + String(url).replace(/["\\\n\r]/g, "") + "\");\n  font-display: swap;\n}";
    }).filter(Boolean).join("\n");

  const cssVars = (fonts, custom, resolve) => {
    const c = clean(fonts, custom), rows = [], faces = [], seen = {};
    // 传文件那一路要先有 @font-face，变量才指得着。
    // ⚠️保险箱里找不到那份文件时【整支跳过】，不写 @font-face 也不写变量——
    //   写了就是把字指向一个空地址，屏幕上会变成没有字；跳过只是落回原来那套。
    const pick = k => {
      const f = faceOf(k, custom);
      if (!f) return "";
      if (f.custom && f.custom.kind === "file") {
        const url = typeof resolve === "function" ? resolve(f.custom.ref) : "";
        if (!url) return "";
        if (!seen[f.family]) {
          seen[f.family] = 1;
          faces.push("@font-face {\n  font-family: '" + f.family + "';\n  src: url(\"" + String(url).replace(/["\\\n\r]/g, "") + "\");\n  font-display: swap;\n}");
        }
      }
      return f.stack;
    };
    const body = c.body ? pick(c.body) : "", display = c.display ? pick(c.display) : "";
    if (body) rows.push("  --f-body: " + body + ";");
    if (display) rows.push("  --f-display: " + display + ";");
    const varBlock = rows.length ? ":root {\n" + rows.join("\n") + "\n}" : "";
    return [faces.join("\n"), varBlock].filter(Boolean).join("\n");
  };

  // 真去把字体文件拉下来。同一个 spec 只挂一次 <link>；断网就是拉不到，
  // 那时候 var() 里那串备选名会顺位往下找，不会变成没有字。
  const LINK_MARK = "data-lisa-font";
  const ensure = (fonts, custom) => {
    if (typeof document === "undefined") return [];
    const added = [];
    const put = (mark, href) => {
      if (document.querySelector('link[' + LINK_MARK + '="' + mark.replace(/"/g, "") + '"]')) return;
      const el = document.createElement("link");
      el.rel = "stylesheet"; el.setAttribute(LINK_MARK, mark);
      el.href = href;
      document.head.appendChild(el); added.push(mark);
    };
    googleSpecs(fonts, custom).forEach(spec => put(spec, "https://fonts.googleapis.com/css2?family=" + spec + "&display=swap"));
    linkHrefs(fonts, custom).forEach(href => put(href, href));
    return added;
  };

  return { FACES, CUSTOM_MAX, FILE_EXT, safeFamily, safeId, customFace, customList, facesWith,
    faceOf, clean, stackOf, googleSpecs, linkHrefs, fileRefs, faceBlocks, cssVars, ensure, LINK_MARK };
});
